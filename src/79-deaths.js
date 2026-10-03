// ============================================================================
// DEATH ANIMATIONS — every monster goes down in a way that fits what it is (owner, 2026-10-03: "Mobs that are killed
// should have death animations as well").
// Kinds (kindOf): animals and spiders fall over, kick once and fade; goblins, guards and other people fall back and
// their weapon clatters away; the undead crumble into dust and bones; machines spark, smoke and break apart (the
// wreck tile the core lays at the kill stays: the pieces fade off it); dragons and drakes rear, crash down and let out
// a last breath of smoke; golems and the giant ores crack and split into rubble. About one second each. Bosses get a
// three second scene: the same death drawn slowly, then a flash and a short screen shake, then their own banner (a
// banner the boss's kill set is held back until the flash, and its time does not run while it is held).
// Loot: nothing about WHEN loot exists changes. The kill still rolls its drops into `drops` at the moment of the kill
// (hundreds of checks expect that). Only the drawing waits: a drop made by the kill is hidden until the death is
// nearly done, then pops out of the body to where it lies. Picking it up works the whole time, as before.
// How: the dead monster is copied into a corpse (DEATHS.list()) that this file ages and draws; the core's own
// 0.8 s tip-and-fade is skipped for a monster that has a corpse (drawCharacter is wrapped). The corpse is not in
// `monsters`, so nothing can tap, target or fight it. It is found two ways: killMonster (wrapped here, outside
// 75-coop's wrap, so the keeper's own kills and the helper's share pass through) and a scan each tick for a monster
// that has just turned dead without a kill call (a keeper's 'mon' row turning dead on a puppet, a companion's blow).
// So a puppet online plays the same death on every screen. Drops a friend's kill pays this knight through 75-coop's
// payKill (not killMonster) are found by the same scan: a fresh drop next to a fresh corpse waits for it.
// Setting: Screen shake (43-settings) off means no shake, no flash over the screen and no ground wave (64-impact
// gates its own); the bodies still fall.
// Cost: one symbol read per monster per tick; nothing at all while no corpse is up. Drawing a corpse is its sprite
// once (four times while a machine breaks, twice while a golem splits) plus a few dozen plain shapes.
// Feature file: HOOKS.update, HOOKS.draw, wrapped killMonster / drawCharacter / drawDrop / tickBanners / HK.drawBanners.
// Test handle: window.DEATHS.
// ============================================================================
const DEATHS = (() => {
  const DUR = 1, BOSS_DUR = 3, FLASH = 1.8, HOLD = 0.25, POP = 0.35, POP_U = 0.82, MAX = 48, FRESH = 0.3;
  // a monster's corpse while it lies dead (never enumerated: not saved, not sent, not copied by JSON)
  const DA = Symbol('death');
  // a drop waiting on a death: seconds before it pops, the pop's progress, and where it pops from
  const PIN = Symbol('popIn'), PT = Symbol('popT'), PFX = Symbol('popX'), PFY = Symbol('popY'), POWN = Symbol('popOwner');
  const KIND = {
    spider: 'beast', wolf: 'beast', boar: 'beast', sheep: 'beast', cow: 'beast', giant_spider: 'beast', brood_mother: 'beast',
    thunderbird: 'beast', rimhawk: 'beast', dustjaw: 'beast',
    goblin: 'person', sapper: 'person', brute: 'person', castle_guard: 'person', guard_m: 'person', guard_f: 'person',
    dwarf_guard: 'person', elf_sentinel: 'person', sky_sentinel: 'person', ally_knight: 'person',
    zombie: 'undead', grave_zombie: 'undead', zombie_calm: 'undead', grave_zombie_calm: 'undead', vampire: 'undead',
    count_ashvane: 'undead', grave_skeleton: 'undead', grave_risen: 'undead', zombie_brute: 'undead', cinderwight: 'undead', cinder_heart: 'undead',
    walker: 'machine', yard_walker: 'machine', bulldozer: 'machine', yard_dozer: 'machine', barrelbeast: 'machine', gnasher: 'machine',
    green_dragon: 'dragon', red_dragon: 'dragon', ash_drake: 'dragon', the_fang: 'dragon',
    mithril_golem: 'golem', stormstone_golem: 'golem', golemling: 'golem', ginormous_golem: 'golem', giant_mithril: 'golem', giant_stormstone: 'golem',
  };
  const BOSS_TYPES = new Set(['brood_mother', 'barrelbeast', 'gnasher', 'count_ashvane', 'thunderbird', 'the_fang', 'cinderwight', 'ginormous_golem', 'zombie_brute']);
  const WEAPON = { goblin: 'sword', sapper: 'sword', brute: 'club', castle_guard: 'spear', guard_m: 'spear', guard_f: 'spear', dwarf_guard: 'axe', elf_sentinel: 'bow', sky_sentinel: 'spear', ally_knight: 'sword' };
  // dust: grey grave dust, or black ash with embers for the burnt ones; no bones in a heart
  const ASH = new Set(['cinderwight', 'cinder_heart', 'vampire', 'count_ashvane']);
  const NO_BONES = new Set(['cinder_heart']);
  // how far ahead of its middle a dragon's snout is, in pixels (27-dragons, 30-ashdrake, 28-thefang)
  const MOUTH = { green_dragon: 46, red_dragon: 46, ash_drake: 38, the_fang: 88 };
  const corpses = [], pending = [];
  let made = 0;
  const API = { freeze: false };

  const cl01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const seg = (u, a, b) => cl01((u - a) / (b - a));
  const easeOut = k => 1 - (1 - k) * (1 - k);
  const easeIn = k => k * k;
  const hash = (s, i) => { const x = Math.sin(s * 127.1 + i * 311.7) * 43758.5453; return x - Math.floor(x); };
  const here = () => window.__instance || null;
  const shakeOn = () => { try { return typeof SETTINGS === 'undefined' || SETTINGS.get('shake') !== false; } catch (e) { return true; } };

  function kindOf(type) {
    if (KIND[type]) return KIND[type];
    const d = MONSTER_DEFS[type] || {};
    return d.mech ? 'machine' : d.human ? 'person' : 'beast';
  }
  function isBoss(type) {
    if (BOSS_TYPES.has(type)) return true;
    const d = MONSTER_DEFS[type];
    // the same rule the core uses to put up a boss banner
    if (d && d.level >= 25 && d.hp >= 300) return true;
    if (HOOKS.bossCall) for (const k in HOOKS.bossCall) { const b = HOOKS.bossCall[k]; if (b && b.type === type) return true; }
    return false;
  }
  // normalised time: a boss spends its first 1.8 s on what a monster does in its first 0.6 s, then flashes
  function uOf(c, t) {
    if (!c.boss) return cl01(t / DUR);
    return t < FLASH ? 0.6 * t / FLASH : cl01(0.6 + 0.4 * (t - FLASH) / (BOSS_DUR - FLASH));
  }
  const popAt = c => c.boss ? FLASH + (POP_U - 0.6) / 0.4 * (BOSS_DUR - FLASH) : POP_U * DUR;

  // ---------- making a corpse ----------
  function spawn(m) {
    if (!m || m.phantom || !MONSTER_DEFS[m.type]) return null;
    const old = m[DA];
    if (old && old.t === 0 && corpses.includes(old)) return old;
    // one death, one corpse: a keeper handoff copies a puppet's fresh death onto the real monster with the same nid
    if (m.nid) for (const c of corpses) if (c.nid === m.nid && c.t < FRESH + 0.2) { m[DA] = c; return c; }
    const def = MONSTER_DEFS[m.type], kind = kindOf(m.type), boss = isBoss(m.type);
    const fx0 = m.facing && Number.isFinite(m.facing.x) ? m.facing.x : 1, fy0 = m.facing && Number.isFinite(m.facing.y) ? m.facing.y : 0;
    const fl = Math.hypot(fx0, fy0) || 1, fx = fl ? fx0 / fl : 1, fy = fl ? fy0 / fl : 0;
    const body = Object.assign({}, m);
    body.x = 0; body.y = 0; body.dead = false; body.hurtT = 0; body.moving = false; body.attackT = 0; body.stunT = 0; body.facing = { x: fx0, y: fy0 };
    // a person's weapon leaves his hand at once: the sprite is drawn without it (08-draw, drawHuman below, 33's drawGob)
    if (kindOf(m.type) === 'person') body.unarmed = true;
    const r = m.r || def.r || 12;
    const seed = (++made) * 7.31 + (m.x || 0) * 0.013 + (m.y || 0) * 0.007;
    const c = {
      m, nid: m.nid || null, type: m.type, kind, boss, x: m.x, y: m.y, r, fx, fy, side: fx < -0.2 ? 1 : fx > 0.2 ? -1 : (hash(seed, 1) < 0.5 ? -1 : 1),
      body, t: 0, dur: boss ? BOSS_DUR : DUR, inst: here(), seed, remote: !!m.remote, banner: null, flashed: false,
      ext: m.type === 'ginormous_golem' ? 150 : Math.max(36, r * 2.6),
      weapon: kind === 'person' ? (WEAPON[m.type] || 'sword') : null,
      ash: ASH.has(m.type), bones: kind === 'undead' && !NO_BONES.has(m.type),
      rocks: null, cracks: null, plates: null,
    };
    if (kind === 'golem') {
      const stone = /storm/.test(m.type) ? ['#6f6a86', '#8a84a6', '#4c4862'] : /mithril/.test(m.type) ? ['#7f8a99', '#a6b2c2', '#55606e'] : ['#7d756a', '#9a9286', '#57514a'];
      c.rocks = []; for (let i = 0; i < 10; i++) { const a = hash(seed, 10 + i) * Math.PI * 2, d = r * (0.5 + hash(seed, 30 + i) * 0.9), s = 2.5 + hash(seed, 50 + i) * r * 0.2;
        c.rocks.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.55 + r * 0.35, s, col: stone[i % 3], rot: hash(seed, 70 + i) * 6 }); }
      // cracks run out from the chest and stay inside the body (about 0.6 of its radius)
      const cy0 = m.type === 'ginormous_golem' ? -60 : /^giant_/.test(m.type) ? -r * 0.15 : -r * 0.35, cs = m.type === 'ginormous_golem' ? 22 : r * 0.15;
      c.cracks = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + (hash(seed, 90 + i) - 0.5) * 0.6, pts = [[0, cy0]]; let x = 0, y = cy0;
        for (let k = 1; k <= 4; k++) { x += Math.cos(a) * cs + (hash(seed, 100 + i * 5 + k) - 0.5) * cs * 0.8; y += Math.sin(a) * cs * 0.8 + (hash(seed, 130 + i * 5 + k) - 0.5) * cs * 0.8; pts.push([x, y]); }
        c.cracks.push(pts); }
    }
    if (kind === 'machine') {
      c.plates = []; for (let i = 0; i < 6; i++) { const a = hash(seed, 160 + i) * Math.PI * 2; c.plates.push({ a, d: r * (0.9 + hash(seed, 170 + i) * 0.7), w: 4 + hash(seed, 180 + i) * 6, h: 3 + hash(seed, 190 + i) * 3, spin: (hash(seed, 200 + i) - 0.5) * 8 }); }
    }
    m[DA] = c;
    corpses.push(c);
    if (corpses.length > MAX) end(corpses[0]);
    return c;
  }
  function end(c) {
    const i = corpses.indexOf(c); if (i >= 0) corpses.splice(i, 1);
    // its drops do not wait on a death that is not being shown any more
    for (const d of pending) if (d[POWN] === c && d[PIN] > 0) { d[PIN] = 0; d[PT] = 0; }
  }
  function hide(d, c) {
    if (!d || d[PIN] !== undefined) return;
    const wait = Math.max(0, popAt(c) - c.t);
    d[PIN] = wait; d[PT] = wait > 0 ? undefined : 0; d[PFX] = c.x; d[PFY] = c.y; d[POWN] = c;
    pending.push(d);
  }

  // ---------- the pose: every number the drawing uses, as a pure function of the corpse and its age ----------
  function pose(c, t = c.t) {
    const u = uOf(c, t), r = c.r;
    const p = { u, kind: c.kind, alpha: 1, rot: 0, sx: 1, sy: 1, ox: 0, oy: 0, kick: 0, weapon: null, crumble: 0, pile: 0, bonesA: 0, split: 0, crack: 0, rattle: 0, smoke: 0, breath: 0, crash: 0, rubble: 0, flash: 0 };
    if (c.kind === 'beast') {
      // seen from above, an animal falling over rolls onto its side: its body narrows across its back, it tips a little,
      // and its legs come out on the side that is now up; the kick is those legs jerking once
      const f = easeIn(seg(u, 0, 0.3)), settle = u > 0.3 && u < 0.38 ? Math.sin(Math.PI * seg(u, 0.3, 0.38)) : 0;
      p.kick = u > 0.38 && u < 0.52 ? Math.sin(Math.PI * seg(u, 0.38, 0.52)) : 0;
      p.fall = f; p.rot = c.side * (0.4 * f - 0.06 * settle + 0.1 * p.kick); p.sy = 1 - 0.38 * f + 0.06 * settle; p.oy = r * 0.12 * f;
      p.legs = seg(u, 0.18, 0.3);
      p.alpha = 1 - seg(u, 0.62, 1);
    } else if (c.kind === 'person') {
      const f = easeIn(seg(u, 0, 0.32));
      p.rot = c.side * 1.5 * f; p.sy = 1 - 0.15 * f; p.ox = -c.fx * 9 * f; p.oy = -c.fy * 9 * f + r * 0.15 * f;
      const k = seg(u, 0.06, 0.5), px = -c.fy * c.side, py = c.fx * c.side, dx = c.fx * 0.75 + px * 0.65, dy = c.fy * 0.75 + py * 0.65, dl = Math.hypot(dx, dy) || 1;
      const D = 24 + r * 0.7, e = easeOut(k), hop = k < 0.6 ? 16 * Math.sin(Math.PI * k / 0.6) : 5 * Math.sin(Math.PI * (k - 0.6) / 0.4);
      p.weapon = { x: c.fx * 12 + dx / dl * D * e, y: c.fy * 12 - 2 + dy / dl * D * e, h: hop, rot: Math.atan2(c.fy, c.fx) + c.side * (k * Math.PI * 3.5 * (1 - 0.45 * k)), k };
      p.alpha = 1 - seg(u, 0.62, 1);
    } else if (c.kind === 'undead') {
      p.ox = u < 0.14 ? Math.sin(u * 180) * 1.6 * (1 - u / 0.14) : 0;
      p.crumble = easeOut(seg(u, 0.08, 0.62)); p.oy = p.crumble * r * 0.3;
      p.pile = easeOut(seg(u, 0.1, 0.6)); p.bonesA = c.bones ? seg(u, 0.35, 0.5) : 0;
      p.alpha = 1 - seg(u, 0.72, 1);
    } else if (c.kind === 'machine') {
      p.rattle = u < 0.42 ? 1 : 0;
      p.ox = Math.sin(u * 220) * 2 * p.rattle; p.rot = Math.sin(u * 170) * 0.05 * p.rattle;
      p.split = easeOut(seg(u, 0.42, 0.75));
      p.smoke = Math.min(1, u * 6) * (1 - seg(u, 0.78, 1));
      p.alpha = 1 - seg(u, 0.6, 1);
    } else if (c.kind === 'dragon') {
      const rear = seg(u, 0, 0.18); p.crash = easeIn(seg(u, 0.18, 0.32));
      const lift = rear * (1 - p.crash);
      p.oy = -8 * lift + r * 0.15 * p.crash; p.sx = 1 + 0.1 * lift; p.sy = (1 + 0.1 * lift) * (1 - 0.2 * p.crash); p.rot = c.side * 0.35 * p.crash;
      p.breath = seg(u, 0.36, 0.85);
      p.alpha = 1 - seg(u, 0.66, 1);
    } else {
      p.crack = seg(u, 0, 0.34); p.ox = p.crack < 1 ? Math.sin(u * 200) * 1.2 * p.crack : 0;
      p.split = easeOut(seg(u, 0.34, 0.7)); p.rubble = seg(u, 0.34, 0.6); p.oy = p.split * r * 0.2;
      p.alpha = 1 - seg(u, 0.66, 1);
    }
    if (c.boss && t >= FLASH) p.flash = 1 - cl01((t - FLASH) / 0.45);
    return p;
  }

  // ---------- drawing ----------
  function drawBody(g, c) {
    if (c.type === 'ginormous_golem' && window.ROYALMINE && typeof ROYALMINE.drawColossus === 'function') ROYALMINE.drawColossus(g, c.body, false);
    else drawCharacter(g, c.body, c.type);
  }
  function drawWeapon(g, kind) {
    g.lineCap = 'round';
    if (kind === 'spear') { g.strokeStyle = '#7a5a34'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-14, 0); g.lineTo(12, 0); g.stroke(); g.fillStyle = '#c9ccd3'; g.beginPath(); g.moveTo(12, -3.5); g.lineTo(20, 0); g.lineTo(12, 3.5); g.closePath(); g.fill(); }
    else if (kind === 'club') { g.fillStyle = '#6b4a2a'; g.fillRect(-10, -2, 18, 4); g.fillStyle = '#5a5a62'; g.fillRect(6, -6, 8, 12); }
    else if (kind === 'bow') { g.strokeStyle = '#7a5a2a'; g.lineWidth = 2.5; g.beginPath(); g.arc(-6, 0, 13, -1.1, 1.1); g.stroke(); g.strokeStyle = 'rgba(230,225,210,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6 + 13 * Math.cos(-1.1), 13 * Math.sin(-1.1)); g.lineTo(-6 + 13 * Math.cos(1.1), 13 * Math.sin(1.1)); g.stroke(); }
    else if (kind === 'axe') { g.strokeStyle = '#6b4a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.stroke(); g.fillStyle = '#b8bcc6'; g.beginPath(); g.moveTo(6, -1); g.lineTo(12, -8); g.lineTo(14, 2); g.closePath(); g.fill(); }
    else { const L = kind === 'dagger' ? 9 : 14; g.fillStyle = '#5a3a1e'; g.fillRect(-6, -2, 6, 4); g.fillStyle = '#8a6a3a'; g.fillRect(-1, -4.5, 2.5, 9); g.fillStyle = '#c9ccd3'; g.fillRect(1.5, -1.5, L, 3); g.fillStyle = '#eef1f5'; g.fillRect(1.5, -1.5, L, 1); }
  }
  function dust(c) { return c.ash ? ['#3d3633', '#5a504a', '#ff8a3a'] : ['#8d8478', '#b4ab9c', '#6a6258']; }
  function drawCorpse(g, c) {
    const p = pose(c), r = c.r, ext = c.ext;
    if (p.alpha <= 0) return;
    g.save(); g.globalAlpha *= p.alpha;
    if (c.kind === 'beast') {
      const ang = Math.atan2(c.fy, c.fx);
      g.save(); g.translate(c.x + p.ox, c.y + p.oy); g.rotate(p.rot);
      // squash across the animal's own back (its facing), not across the screen
      g.rotate(ang); g.scale(1, p.sy); g.rotate(-ang); drawBody(g, c);
      if (p.legs > 0) {
        g.rotate(ang); g.strokeStyle = 'rgba(38,30,26,0.9)'; g.lineWidth = Math.max(1.5, r * 0.13); g.lineCap = 'round';
        const up = c.side, base = r * 0.42 * p.sy, L = r * (0.3 + 0.4 * p.legs);
        for (const [lx, ph] of [[-r * 0.55, 0], [-r * 0.3, 1], [r * 0.3, 2], [r * 0.5, 3]]) {
          const k = p.kick * Math.sin(ph * 1.7 + 1) * r * 0.3, kx = lx + k * 0.6;
          g.beginPath(); g.moveTo(lx, up * base); g.lineTo(kx + up * k * 0.2, up * (base + L - Math.abs(k) * 0.3)); g.stroke();
        }
      }
      g.restore();
    } else if (c.kind === 'person' || c.kind === 'dragon') {
      g.save(); g.translate(c.x + p.ox, c.y + p.oy); g.rotate(p.rot); g.scale(p.sx, p.sy); drawBody(g, c); g.restore();
      if (p.weapon) {
        const w = p.weapon;
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(c.x + w.x, c.y + w.y + 4, 9, 3, 0, 0, 7); g.fill();
        g.save(); g.translate(c.x + w.x, c.y + w.y - w.h); g.rotate(w.rot); drawWeapon(g, c.weapon); g.restore();
      }
      if (c.kind === 'dragon' && p.breath > 0) {
        // the snout turns with the body as it crashes over
        const M = (MOUTH[c.type] || r * 1.8) * p.sx, cr = Math.cos(p.rot), sr = Math.sin(p.rot), hx = c.fx * M, hy = c.fy * M * p.sy / p.sx;
        const mx = c.x + p.ox + hx * cr - hy * sr, my = c.y + p.oy + hx * sr + hy * cr, dx = c.fx * cr - c.fy * sr, dy = c.fx * sr + c.fy * cr;
        if (p.breath < 0.3) { g.fillStyle = `rgba(255,140,40,${(0.7 * (1 - p.breath / 0.3)).toFixed(3)})`; g.beginPath(); g.arc(mx, my, 5 + r * 0.14, 0, 7); g.fill(); }
        for (let i = 0; i < 9; i++) {
          const a = (p.u - (0.36 + 0.4 * i / 9)) / 0.4; if (a <= 0 || a >= 1) continue;
          const wob = Math.sin(a * 6 + i) * 5, R = 4 + a * (10 + r * 0.5);
          g.fillStyle = `rgba(150,144,150,${(0.7 * (1 - a)).toFixed(3)})`;
          g.beginPath(); g.arc(mx + dx * a * (18 + r * 0.8) - dy * wob, my + dy * a * (18 + r * 0.8) + dx * wob - a * 22, R, 0, 7); g.fill();
          g.fillStyle = `rgba(90,86,92,${(0.45 * (1 - a)).toFixed(3)})`;
          g.beginPath(); g.arc(mx + dx * a * (18 + r * 0.8) - dy * wob + R * 0.3, my + dy * a * (18 + r * 0.8) + dx * wob - a * 22 + R * 0.25, R * 0.6, 0, 7); g.fill();
        }
      }
    } else if (c.kind === 'undead') {
      const [d0, d1, d2] = dust(c), top = -r * 1.9, bot = r * 1.2, cut = top + (bot - top) * p.crumble;
      if (p.pile > 0) {
        g.fillStyle = d0; g.beginPath(); g.ellipse(c.x, c.y + r * 0.75, r * 0.95 * p.pile, r * 0.38 * p.pile, 0, 0, 7); g.fill();
        g.fillStyle = d1; g.beginPath(); g.ellipse(c.x - r * 0.15, c.y + r * 0.66, r * 0.55 * p.pile, r * 0.2 * p.pile, 0, 0, 7); g.fill();
      }
      if (p.crumble < 1) { g.save(); g.translate(c.x + p.ox, c.y + p.oy); g.beginPath(); g.rect(-ext, cut, ext * 2, bot - cut + ext); g.clip(); drawBody(g, c); g.restore(); }
      if (p.bonesA > 0) {
        g.save(); g.globalAlpha *= p.bonesA; g.translate(c.x, c.y + r * 0.62); g.strokeStyle = '#e9e2d0'; g.lineWidth = 2.5; g.lineCap = 'round';
        for (const [a, L] of [[0.5, r * 0.55], [-0.4, r * 0.45]]) { g.save(); g.rotate(a); g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke(); g.fillStyle = '#e9e2d0'; for (const e of [-L / 2, L / 2]) { g.beginPath(); g.arc(e, -1.5, 1.8, 0, 7); g.arc(e, 1.5, 1.8, 0, 7); g.fill(); } g.restore(); }
        g.fillStyle = '#efe8d6'; g.beginPath(); g.arc(r * 0.35, -r * 0.12, Math.max(3, r * 0.22), 0, 7); g.fill();
        g.fillStyle = '#2a2420'; g.beginPath(); g.arc(r * 0.29, -r * 0.15, 1.3, 0, 7); g.arc(r * 0.42, -r * 0.15, 1.3, 0, 7); g.fill();
        g.restore();
      }
      for (let i = 0; i < 16; i++) {
        const born = 0.08 + 0.5 * (i / 16), a = (p.u - born) / 0.3; if (a <= 0 || a >= 1) continue;
        const from = top + (bot - top) * easeOut(cl01((born - 0.08) / 0.54));
        const x = c.x + (hash(c.seed, 300 + i) - 0.5) * r * 1.6 + (hash(c.seed, 330 + i) - 0.5) * 10 * a, y = c.y + from + (r * 0.7 - from) * a * a;
        g.fillStyle = i % 5 === 0 && c.ash ? d2 : (i % 2 ? d1 : d2 === '#ff8a3a' ? d0 : d2); const s = 1.5 + hash(c.seed, 360 + i) * 1.8; g.fillRect(x - s / 2, y - s / 2, s, s);
      }
    } else if (c.kind === 'machine') {
      if (p.split <= 0) { g.save(); g.translate(c.x + p.ox, c.y); g.rotate(p.rot); drawBody(g, c); g.restore(); }
      else {
        const d = p.split * r * 0.6;
        for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          g.save(); g.translate(c.x + qx * d, c.y + qy * d * 0.7 + p.split * r * 0.15); g.rotate(qx * qy * 0.35 * p.split);
          g.beginPath(); g.rect(qx < 0 ? -ext : 0, qy < 0 ? -ext : 0, ext, ext); g.clip(); drawBody(g, c); g.restore();
        }
        g.fillStyle = '#3a3a42';
        for (const pl of c.plates) { const k = p.split, x = c.x + Math.cos(pl.a) * pl.d * k, y = c.y + Math.sin(pl.a) * pl.d * k * 0.6 - Math.sin(Math.PI * k) * 10; g.save(); g.translate(x, y); g.rotate(pl.spin * k); g.fillRect(-pl.w / 2, -pl.h / 2, pl.w, pl.h); g.restore(); }
      }
      if (p.rattle) {
        g.strokeStyle = '#ffe08a'; g.lineWidth = 1.5; const f = Math.floor(p.u * 30);
        for (let i = 0; i < 3; i++) { const a = hash(c.seed + f, 400 + i) * Math.PI * 2, d0 = r * 0.4 * hash(c.seed + f, 410 + i), x = c.x + Math.cos(a) * d0, y = c.y - r * 0.3 + Math.sin(a) * d0;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke(); }
      }
      if (p.smoke > 0) for (let i = 0; i < 7; i++) {
        const ph = (p.u * 2.2 + i / 7) % 1, x = c.x + (hash(c.seed, 420 + i) - 0.5) * r * 0.9 + ph * 8, y = c.y - r * 0.6 - ph * r * 1.5;
        g.fillStyle = `rgba(58,58,66,${(0.5 * (1 - ph) * p.smoke).toFixed(3)})`; g.beginPath(); g.arc(x, y, 4 + ph * r * 0.5, 0, 7); g.fill();
      }
    } else {
      if (p.split <= 0) {
        g.save(); g.translate(c.x + p.ox, c.y); drawBody(g, c);
        g.strokeStyle = 'rgba(20,16,12,0.85)'; g.lineWidth = Math.max(1.5, Math.min(4, r * 0.07)); g.lineJoin = 'round';
        for (const pts of c.cracks) { const n = Math.max(1, Math.ceil(p.crack * (pts.length - 1))); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k <= n; k++) g.lineTo(pts[k][0], pts[k][1]); g.stroke(); }
        g.restore();
      } else {
        const d = p.split * r * 0.45;
        for (const s of [-1, 1]) {
          g.save(); g.translate(c.x + s * d, c.y + p.oy); g.rotate(s * 0.22 * p.split);
          g.beginPath(); g.rect(s < 0 ? -ext : 0, -ext * 1.4, ext, ext * 2.4); g.clip(); drawBody(g, c); g.restore();
        }
      }
      if (p.rubble > 0) for (const rk of c.rocks) {
        const k = easeOut(p.rubble), x = c.x + rk.x * k, y = c.y + rk.y * k - Math.sin(Math.PI * p.rubble) * 12;
        g.save(); g.translate(x, y); g.rotate(rk.rot); g.fillStyle = rk.col; g.beginPath(); g.moveTo(-rk.s, -rk.s * 0.4); g.lineTo(-rk.s * 0.2, -rk.s); g.lineTo(rk.s, -rk.s * 0.3); g.lineTo(rk.s * 0.5, rk.s * 0.7); g.lineTo(-rk.s * 0.7, rk.s * 0.6); g.closePath(); g.fill(); g.restore();
      }
    }
    g.restore();
  }
  // the boss flash: a white bloom on the body, and over the whole view while Screen shake is on
  function drawFlash(g, c) {
    const p = pose(c); if (p.flash <= 0) return;
    g.save();
    const R = Math.max(60, c.r * 3.2), gr = g.createRadialGradient(c.x, c.y, 4, c.x, c.y, R);
    gr.addColorStop(0, `rgba(255,248,220,${(0.85 * p.flash).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,248,220,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(c.x, c.y, R, 0, 7); g.fill();
    if (shakeOn()) { g.fillStyle = `rgba(255,250,235,${(0.4 * p.flash * p.flash).toFixed(3)})`; g.fillRect(cam.x - 20, cam.y - 20, VW + 40, VH + 40); }
    g.restore();
  }

  // ---------- moments: dust, sparks, the clatter, the crash, the flash ----------
  const EVENTS = {
    beast: [[0.3, c => burst(c.x, c.y + c.r * 0.5, '#b9a98a', 8, 60)]],
    person: [[0.32, c => burst(c.x - c.fx * 9, c.y + c.r * 0.5, '#b9a98a', 6, 50)], [0.324, c => clink(c, 5)], [0.5, c => clink(c, 3)]],
    undead: [[0.1, c => burst(c.x, c.y - c.r * 0.6, dust(c)[1], 10, 50)], [0.45, c => burst(c.x, c.y + c.r * 0.6, dust(c)[0], 8, 40)]],
    machine: [[0.04, c => spark(c)], [0.16, c => spark(c)], [0.28, c => spark(c)], [0.42, c => { burst(c.x, c.y, '#ff8a1a', 14, 150); burst(c.x, c.y, '#4a4a52', 12, 110); }]],
    dragon: [[0.32, c => { burst(c.x, c.y + c.r * 0.4, '#a08a6a', 16, 120); if (window.IMPACT && IMPACT.wave) IMPACT.wave(c.x, c.y, c.boss ? 1.8 : 1.1); }]],
    golem: [[0.34, c => { burst(c.x, c.y, (c.rocks && c.rocks[0].col) || '#8f887a', 18, 120); burst(c.x, c.y - c.r * 0.4, '#d8d0c0', 8, 70); }]],
  };
  function clink(c, n) { const w = pose(c).weapon; if (w) burst(c.x + w.x, c.y + w.y, '#e8ecf2', n, 70); }
  function spark(c) { burst(c.x + (hash(c.seed + c.t, 1) - 0.5) * c.r, c.y - c.r * 0.3, '#ffd166', 6, 110); }
  function flashFx(c) {
    c.flashed = true;
    if (window.SETTINGS && typeof SETTINGS.startShake === 'function') SETTINGS.startShake(c.r > 35 ? 8 : 6, 0.45);
    if (window.IMPACT && IMPACT.wave) IMPACT.wave(c.x, c.y, 1.6);
    burst(c.x, c.y, '#fff2c0', 24, 200);
  }

  // ---------- each tick ----------
  // only a corpse born this moment: an arrow that lands beside an older one is not its loot
  function nearCorpse(d) {
    for (const c of corpses) if (c.t < 0.2 && Math.abs(d.x - c.x) < c.r + 48 && Math.abs(d.y - c.y) < c.r + 48) return c;
    return null;
  }
  function tick(dt) {
    // a monster that has just turned dead without a kill call: a keeper's 'mon' row on a puppet, a companion's blow
    for (const m of monsters) {
      if (m.dead) { if (!m[DA] && m.deadT < FRESH && !m.gone && !m.phantom) spawn(m); }
      else if (m[DA]) m[DA] = null;
    }
    if (corpses.length && !API.freeze) {
      const inst = here();
      for (let i = corpses.length - 1; i >= 0; i--) {
        const c = corpses[i];
        // the knight changed map, or the monster stood up again (a boss that pulls himself together, a keeper that disagreed)
        if (c.inst !== inst || !c.m.dead) { end(c); continue; }
        const t0 = c.t; c.t += dt;
        const u0 = uOf(c, t0), u1 = uOf(c, c.t), ev = EVENTS[c.kind];
        if (ev) for (const [u, fn] of ev) if (u0 < u && u1 >= u) fn(c);
        if (c.boss && !c.flashed && c.t >= FLASH) flashFx(c);
        if (c.t >= c.dur) end(c);
      }
    }
    if (pending.length) for (let i = pending.length - 1; i >= 0; i--) {
      const d = pending[i];
      if (d[PIN] > 0) { if (!API.freeze) d[PIN] -= dt; if (d[PIN] <= 0) { d[PIN] = 0; d[PT] = 0; } continue; }
      if (!API.freeze) d[PT] = (d[PT] || 0) + dt;
      if (d[PT] >= POP) { delete d[PIN]; delete d[PT]; delete d[PFX]; delete d[PFY]; delete d[POWN]; pending.splice(i, 1); }
    }
    // a friend's kill pays this knight through 75-coop's own payKill: its fresh drops wait on the corpse beside them
    if (corpses.length) for (const d of drops) if (d.t < 0.12 && d[PIN] === undefined) { const c = nearCorpse(d); if (c) hide(d, c); }
  }
  HOOKS.update.push(dt => tick(dt));
  HOOKS.newGame.push(() => { while (corpses.length) end(corpses[0]); pending.length = 0; });
  HOOKS.draw.push((g, items) => {
    if (!corpses.length) return;
    const inst = here();
    for (const c of corpses) {
      if (c.inst !== inst || c.x < cam.x - 220 || c.x > cam.x + VW + 220 || c.y < cam.y - 220 || c.y > cam.y + VH + 220) continue;
      items.push({ y: c.y + (c.kind === 'golem' || c.kind === 'machine' ? c.r * 0.5 : 0), draw: () => drawCorpse(g, c) });
      if (c.boss && c.t >= FLASH && c.t < FLASH + 0.45) items.push({ y: 1e9 + 3, draw: () => drawFlash(g, c) });
    }
  });

  // ---------- the wraps ----------
  const _killMonster = killMonster;
  killMonster = function (m) {
    const arr = drops, n0 = drops.length, b0 = levelBanner;
    _killMonster(m);
    if (!m || m.phantom || !m.dead) return;
    const c = spawn(m); if (!c) return;
    if (drops === arr) for (let i = n0; i < drops.length; i++) if (drops[i] && drops[i].t === 0) hide(drops[i], c);
    if (c.boss && levelBanner && levelBanner !== b0) c.banner = levelBanner;
  };
  killMonster.__inner = _killMonster;
  const _drawCharacter = drawCharacter;
  drawCharacter = function (g, e, kind) { if (e.dead === true && e[DA]) return; return _drawCharacter(g, e, kind); };
  const _drawHuman = drawHuman;
  drawHuman = function (g, e, look) { if (e && e.unarmed && look) look = Object.assign({}, look, { weapon: null, spear: false, tool: null }); return _drawHuman(g, e, look); };
  const _drawDrop = drawDrop;
  drawDrop = function (g, d) {
    const pin = d[PIN];
    if (pin === undefined) return _drawDrop(g, d);
    if (pin > 0) return;
    const k = cl01((d[PT] || 0) / POP), e = easeOut(k);
    const ox = (d[PFX] - d.x) * (1 - e), oy = (d[PFY] - d.y) * (1 - e) - Math.sin(Math.PI * k) * 22;
    const s = k < 0.7 ? 0.5 + 0.7 * (k / 0.7) : 1.2 - 0.2 * ((k - 0.7) / 0.3);
    g.save(); g.translate(d.x + ox, d.y + oy); g.scale(s, s); g.translate(-d.x, -d.y); _drawDrop(g, d); g.restore();
  };
  function holding() {
    if (!corpses.length) return false;
    const lb = levelBanner; if (!lb) return false;
    for (const c of corpses) if (c.banner === lb && c.t < FLASH + HOLD) return true;
    return false;
  }
  const _tickBanners = tickBanners;
  tickBanners = function (dt) { if (holding()) return; return _tickBanners(dt); };
  if (typeof HK !== 'undefined' && typeof HK.drawBanners === 'function') {
    const _drawBanners = HK.drawBanners;
    HK.drawBanners = function (g, L) { if (holding()) { if (HK.FRAME) HK.FRAME.bannerOnNotice = false; return; } return _drawBanners(g, L); };
  }

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'deaths: ';
    if (typeof INSTANCES !== 'undefined' && INSTANCES.active && INSTANCES.active()) INSTANCES.leave();
    const keep = { px: player.x, py: player.y, hp: player.hp, kills: player.kills, drops: drops.slice(), peace: window.__peace, banner: levelBanner, shake: typeof SETTINGS !== 'undefined' ? SETTINGS.get('shake') : true, mons: monsters, dc: dialog.cur, dq: dialog.queue.slice() };
    const temp = [];
    const mk = (type, dx, dy, fx = 1) => {
      const d = MONSTER_DEFS[type], x = player.x + dx, y = player.y + dy;
      const m = { type, x, y, home: { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: false, state: 'idle', wanderT: 99, wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 1e9, facing: { x: fx, y: 0 }, walkT: 0, moving: false, stunT: 0 };
      monsters.push(m); temp.push(m); return m;
    };
    const down = m => { m.dead = true; m.deadT = 0; m.hp = 0; m.respawnT = 1e9; };
    // a recording canvas: counts every call, and fillRect on its own
    const rec = () => { const st = { n: 0, rect: 0 }; const fn = () => { st.n++; }; return { st, g: new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() { } }) : k === 'fillRect' ? () => { st.n++; st.rect++; } : typeof k === 'string' ? fn : undefined, set: () => true }) }; };
    const calls = f => { const r = rec(); f(r.g); return r.st; };
    const screenOf = m => ({ sx: m.x - cam.x, sy: m.y - cam.y });
    const hk = HOOKS.kill.splice(0);
    try {
      h.peace(true); API.freeze = false; API.clear(); dialog.cur = null; dialog.queue.length = 0;
      { const o = h.openSpot(60, 30); F.tp(o.x, o.y); }
      for (const m of monsters) if (!m.dead && dist(m.x, m.y, player.x, player.y) < 12 * TILE) { m.x += 30 * TILE; m.home = { x: m.x, y: m.y }; }
      // (1) each kind plays its own death and is gone after about a second
      const KINDS = [['wolf', 'beast'], ['giant_spider', 'beast'], ['goblin', 'person'], ['guard_m', 'person'], ['grave_skeleton', 'undead'], ['zombie', 'undead'], ['walker', 'machine'], ['bulldozer', 'machine'], ['green_dragon', 'dragon'], ['ash_drake', 'dragon'], ['mithril_golem', 'golem'], ['giant_mithril', 'golem']];
      const ms = KINDS.map(([type], i) => mk(type, ((i % 6) - 2.5) * 100, Math.floor(i / 6) * 150 - 80, i % 2 ? -1 : 1));
      const legacy = ms.map(m => { m.dead = true; m.deadT = 0.1; const n = calls(g => drawCharacter(g, m, m.type)).n; m.dead = false; m.deadT = 0; return n; });
      ms.forEach(down); F.step([]);
      const born = ms.map(m => API.of(m));
      F.sim(29, []);
      const mid = ms.map(m => { const c = API.of(m); return c ? { c, t: c.t, p: pose(c), drawn: calls(g => drawCorpse(g, c)).n, old: calls(g => drawCharacter(g, m, m.type)).n } : null; });
      F.sim(32, []);
      const after = ms.map(m => !API.of(m) && !corpses.some(c => c.m === m));
      const SHOWS = {
        beast: p => p.fall === 1 && p.legs === 1 && p.sy < 0.7 && p.alpha > 0.5,
        person: (p, c) => Math.abs(p.rot) > 1.4 && !!p.weapon && Math.hypot(p.weapon.x, p.weapon.y) > 20 && c.body.unarmed === true,
        undead: (p, c) => p.crumble > 0.6 && p.pile > 0.6 && (!c.bones || p.bonesA > 0.9),
        machine: p => p.split > 0.2 && p.smoke > 0,
        dragon: p => p.crash === 1 && p.breath > 0,
        golem: p => p.split > 0.3 && p.rubble > 0.5,
      };
      const WORDS = { beast: 'animals and spiders fall onto their side, kick once and fade', person: 'goblins and guards fall back and their weapon clatters away (the sprite drops it)', undead: 'the undead crumble into dust and bones', machine: 'machines spark, smoke and break apart', dragon: 'dragons and drakes crash down with a last breath of smoke', golem: 'golems and giant ores crack and split into rubble' };
      for (const kind of Object.keys(SHOWS)) {
        const idx = KINDS.map((k, i) => k[1] === kind ? i : -1).filter(i => i >= 0);
        const info = idx.map(i => { const x = mid[i]; return { type: KINDS[i][0], born: !!born[i] && born[i].kind === kind && !born[i].boss, t: x && +x.t.toFixed(2), shows: !!x && SHOWS[kind](x.p, x.c), drawn: x && x.drawn, oldFade: x && x.old, legacy: legacy[i], gone: after[i] }; });
        check(P + WORDS[kind] + '; about 1 s, then gone (the core\'s old tip-and-fade is not drawn as well)', info.every(o => o.born && Math.abs(o.t - 0.5) < 0.02 && o.shows && o.drawn > 20 && o.oldFade === 0 && o.legacy > 0 && o.gone), info);
      }
      // (2) a boss: a slow fall, the flash and a short shake at 1.8 s, gone at 3 s; with Screen shake off, no shake and no flash over the screen
      for (const shake of [true, false]) {
        if (typeof SETTINGS !== 'undefined') SETTINGS.set('shake', shake);
        const b = mk('brood_mother', 0, 3 * TILE); down(b); F.step([]); const c = API.of(b);
        F.sim(59, []); const at1 = c && { t: +c.t.toFixed(2), u: +pose(c).u.toFixed(2), flashed: c.flashed, on: corpses.includes(c) };
        F.sim(54, []); render(); const o = SETTINGS.shakeOffset();
        const at19 = c && { t: +c.t.toFixed(2), flashed: c.flashed, flash: +pose(c).flash.toFixed(2), shook: o.x !== 0 || o.y !== 0, transform: !!canvas.style.transform, screen: calls(g => drawFlash(g, c)).rect };
        F.sim(70, []); const gone = !!c && !corpses.includes(c);
        const ok = !!c && c.boss && c.dur === 3 && at1.on && at1.u < 0.6 && !at1.flashed && at19.flashed && at19.flash > 0 && gone && (shake ? at19.shook && at19.screen === 1 : !at19.shook && !at19.transform && at19.screen === 0);
        check(P + (shake ? 'a boss falls slowly, flashes and shakes the screen at 1.8 s, and is gone after 3 s' : 'with Screen shake off a boss still falls and blooms, but nothing shakes and nothing flashes over the screen'), ok, { boss: !!c && c.boss, dur: c && c.dur, at1, at19, gone });
        if (typeof SETTINGS !== 'undefined' && typeof clearShake === 'function') clearShake();
      }
      if (typeof SETTINGS !== 'undefined') SETTINGS.set('shake', keep.shake);
      // (3) the loot is in the game's data at the moment of the kill; it is only drawn late, popping out as the death ends.
      // Nothing of the dead monster can be tapped.
      {
        const cow = mk('cow', 3 * TILE, 0); F.step([]); render();
        const s0 = screenOf(cow), before = tapPick(s0.sx, s0.sy);
        cow.hp = 0; const n0 = drops.length; killMonster(cow);
        const fresh = drops.slice(n0), at0 = { n: fresh.length, hidden: fresh.every(d => API.hidden(d)), drawn: calls(g => { for (const d of fresh) drawDrop(g, d); }).n };
        const after0 = tapPick(s0.sx, s0.sy);
        F.sim(50, []); const at08 = { hidden: fresh.some(d => API.hidden(d)), popping: fresh.every(d => API.popping(d)), drawn: calls(g => { for (const d of fresh) drawDrop(g, d); }).n, inData: fresh.every(d => drops.includes(d)) };
        const after08 = tapPick(s0.sx, s0.sy);
        F.sim(30, []); const at13 = { plain: fresh.every(d => !API.hidden(d) && !API.popping(d)), drawn: calls(g => { for (const d of fresh) drawDrop(g, d); }).n, inData: fresh.every(d => drops.includes(d)) };
        check(P + 'drops are in the game the moment the monster dies, drawn only when its death ends, then pop out (pickup data untouched)', at0.n >= 1 && at0.hidden && at0.drawn === 0 && !at08.hidden && at08.popping && at08.drawn > 0 && at08.inData && at13.plain && at13.drawn > 0 && at13.inData, { at0, at08, at13 });
        check(P + 'nothing of a dead monster can be tapped: a tap on the falling body is not a monster', !!before && before.kind === 'monster' && before.monster === cow && (!after0 || after0.kind !== 'monster') && (!after08 || after08.kind !== 'monster'), { before: before && before.kind, after0: after0 && after0.kind, after08: after08 && after08.kind });
      }
      // (4) the boss's own banner waits for the flash, and its time does not run while it waits
      {
        const bm = mk('brood_mother', -3 * TILE, 0); bm.hp = 0;
        const say = m => { if (m === bm) levelBanner = { text: 'DEATHS TEST BANNER', sub: 'test', t: 3 }; };
        HOOKS.kill.push(say); levelBanner = null;
        try { killMonster(bm); } finally { HOOKS.kill.splice(HOOKS.kill.indexOf(say), 1); }
        const c = API.of(bm), lb = levelBanner, held0 = holding();
        F.sim(60, []); const at1 = { held: holding(), t: lb && lb.t, ahead: bannerAhead('DEATHS TEST BANNER'), drawn: true };
        { const r = rec(); HK.drawBanners(r.g, HK.cur ? HK.cur() : {}); at1.drawn = r.st.n > 0; }
        F.sim(70, []); const at22 = { held: holding(), t: lb && +lb.t.toFixed(2), ahead: bannerAhead('DEATHS TEST BANNER') };
        check(P + 'a boss\'s own banner is held until its flash (not drawn, its time not running), then shows as before', !!c && c.banner === lb && held0 && at1.held && at1.t === 3 && at1.ahead && !at1.drawn && !at22.held && at22.t < 3 && at22.ahead, { banner: !!lb, held0, at1, at22 });
        levelBanner = null;
      }
      // (5) online: a puppet whose 'mon' row turns dead plays the same death, and the drops a friend's kill pays wait for it
      if (typeof NET !== 'undefined' && typeof COOP !== 'undefined') {
        const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake }, real = monsters;
        let sock = null; const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
        const fake = { call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } };
        const kills0 = player.kills, n0 = drops.length;
        try {
          NET.enabled = true; NET.token = 'deaths-test'; NET.useFake(fake); NET.connect();
          push({ t: 'keeper', map: 'over', n: 'Ann' });
          const x = Math.round(player.x + 3 * TILE), y = Math.round(player.y);
          const row = (dead, hp) => ['Ann:dd', 'wolf', x, y, hp, 22, 'chase', -1, 0, 0, 0, dead ? 1 : 0, 0, 0];
          push({ t: 'mon', n: 'Ann', list: [row(false, 22)] }); F.step([]);
          const p = COOP.find('Ann:dd'), alive = !!p && p.remote && !p.dead && !API.of(p);
          push({ t: 'mon', n: 'Ann', list: [row(true, 0)] }); F.step([]);
          const c = p && API.of(p), born = !!c && c.remote && c.kind === 'beast';
          push({ t: 'kill', nid: 'Ann:dd', type: 'wolf', x, y }); F.step([]);
          const paid = drops.slice(n0), waits = paid.length > 0 && paid.every(d => API.hidden(d));
          push({ t: 'mon', n: 'Ann', list: [row(true, 0)] }); F.sim(25, []);
          const mid = c && { t: +c.t.toFixed(2), fall: pose(c).fall, drawn: calls(g => drawCorpse(g, c)).n, tap: tapPick(p.x - cam.x, p.y - cam.y) };
          push({ t: 'mon', n: 'Ann', list: [row(true, 0)] }); F.sim(40, []);
          const gone = !!c && !corpses.includes(c), shown = paid.every(d => !API.hidden(d));
          check(P + 'online: a puppet whose row turns dead plays the same death, the drops a friend\'s kill pays wait for it, and it is gone after', alive && born && waits && !!mid && mid.fall === 1 && mid.drawn > 20 && (!mid.tap || mid.tap.kind !== 'monster') && gone && shown, { alive, born, paid: paid.length, waits, mid: mid && { t: mid.t, fall: mid.fall, drawn: mid.drawn, tap: mid.tap && mid.tap.kind }, gone, shown });
        } finally {
          NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
          COOP.reset(); monsters = real; COOP.state.idxLen = -1; player.kills = kills0;
        }
      }
      // (6) ten deaths at once stay cheap: each is its sprite (four times at most) and a few dozen shapes
      {
        const ten = ['wolf', 'goblin', 'zombie', 'walker', 'green_dragon', 'mithril_golem', 'guard_f', 'grave_skeleton', 'bulldozer', 'boar'].map((t, i) => mk(t, (i % 5 - 2) * 110, Math.floor(i / 5) * 140 - 70));
        ten.forEach(down); F.step([]); F.sim(30, []);
        const cs = ten.map(m => API.of(m)).filter(Boolean), per = cs.map(c => calls(g => drawCorpse(g, c)).n), sprite = cs.map(c => calls(g => drawCharacter(g, c.body, c.type)).n);
        const r = rec(), t0 = performance.now(); for (let k = 0; k < 60; k++) for (const c of cs) drawCorpse(r.g, c); const ms = (performance.now() - t0) / 60;
        check(P + 'ten deaths at once: each costs at most its own sprite four times plus 300 canvas calls (the frame cost is measured in info)', cs.length === 10 && per.every((n, i) => n > 20 && n <= sprite[i] * 4 + 300), { n: cs.length, per, sprite, msPerFrameStub: +ms.toFixed(3) });
        F.sim(40, []);
      }
    } finally {
      HOOKS.kill.push(...hk);
      for (const m of temp) { const i = monsters.indexOf(m); if (i >= 0) monsters.splice(i, 1); const j = keep.mons.indexOf(m); if (j >= 0) keep.mons.splice(j, 1); }
      API.clear(); API.freeze = false;
      drops = keep.drops; player.x = keep.px; player.y = keep.py; player.hp = keep.hp; player.kills = keep.kills; h.peace(keep.peace);
      levelBanner = keep.banner; dialog.cur = keep.dc; dialog.queue.length = 0; dialog.queue.push(...keep.dq);
      if (typeof SETTINGS !== 'undefined') SETTINGS.set('shake', keep.shake);
    }
  });

  Object.assign(API, {
    DUR, BOSS_DUR, FLASH, HOLD, POP, KIND, BOSS_TYPES,
    list: () => corpses.slice(), of: m => (m && m[DA] && corpses.includes(m[DA])) ? m[DA] : null,
    spawn, pose, uOf, kindOf, isBoss, holding, popAt, draw: drawCorpse, drawFlash,
    hidden: d => !!d && d[PIN] > 0, popping: d => !!d && d[PIN] === 0 && d[PT] !== undefined, waiting: () => pending.length,
    clear: () => { while (corpses.length) end(corpses[0]); },
  });
  return API;
})();
window.DEATHS = DEATHS;
