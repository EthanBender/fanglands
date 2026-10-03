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
// `monsters`, and a tap on it is a tap on nothing (tapPick is wrapped), so nothing can tap, target or fight it, and a
// drop still hidden under it can be neither tapped nor long-pressed.
// A death starts ONLY from HOOKS.monsterDeath(m, info) (info = { k, by, how, x, y }; phase-1 spec rule 9): offline and on
// the keeper, killMonster fires it (06-systems; 75-coop for a friend's last blow); on a friend's map 75-coop fires it on
// the keeper's word, its 'kill' message or its row turning dead, once per death. Never because hp reached 0 here: Cohen's
// own last blow on a friend's monster only holds it still and hurt (the stagger, at most 0.6 s) until the keeper's word
// comes back. A monster first seen already dead plays nothing. The keeper's 'kill' message pays this knight through
// 75-coop's payKill (not killMonster), and it can come back long after the body started falling: its drops, its grave
// and its banner are matched to the body by the monster's nid (two NET listeners, one each side of 75-coop's), not by age.
// What a kill lays on the ground waits for the body too: a grave marker (54-graves) and the Ginormous Golem's rubble heap
// (91-royalmine) come up as the body fades (markerAlpha, remains), and the golem's banner, loot and words come after his
// flash (payOut, from 91-royalmine's fall; a knight who leaves the mine before that is paid as he leaves, HOOKS.leaveInstance).
// Setting: Screen shake (43-settings) off means no shake, no flash over the screen and no ground wave (64-impact
// gates its own); the bodies still fall.
// Cost: one symbol read per monster per tick; nothing at all while no corpse is up. Drawing a corpse is its sprite
// once (four times while a machine breaks, twice while a golem splits) plus a few dozen plain shapes.
// Feature file: HOOKS.monsterDeath, HOOKS.update, HOOKS.draw, NET 'kill' (a listener each side of 75-coop's), wrapped
// killMonster / drawCharacter / drawHuman / drawDrop / tapPick / tickBanners / HK.drawBanners.
// Test handle: window.DEATHS.
// ============================================================================
const DEATHS = (() => {
  const DUR = 1, BOSS_DUR = 3, FLASH = 1.8, HOLD = 0.25, POP = 0.35, POP_U = 0.82, MAX = 48, FRESH = 0.3;
  // a monster's corpse while it lies dead (never enumerated: not saved, not sent, not copied by JSON)
  const DA = Symbol('death');
  // a drop waiting on a death: seconds before it pops, the pop's progress, and where it pops from
  const PIN = Symbol('popIn'), PT = Symbol('popT'), PFX = Symbol('popX'), PFY = Symbol('popY'), POWN = Symbol('popOwner');
  // a friend's monster Cohen's own blow felled, held still until the keeper's word (STAG); a grave marker waiting on a body (MK)
  const STAG = Symbol('stagger'), MK = Symbol('graveOf'), STAG_FOR = 0.1;
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
  const corpses = [], pending = [], stagger = [];
  // legs that come out of an animal rolled onto its side: birds show two thin legs, spiders already show eight (none
  // added), a cow's are pale with dark hooves so they do not read as stripes; everything else four dark ones
  const LEGS = { thunderbird: { n: 2, col: '#d8b04a', w: 0.07 }, rimhawk: { n: 2, col: '#d8b04a', w: 0.07 }, spider: { n: 0 }, giant_spider: { n: 0 }, brood_mother: { n: 0 },
    cow: { n: 4, col: '#e6dfd0', hoof: '#2a2420' } };
  const LEG_AT = { 2: [[-0.2, 0], [0.2, 2]], 4: [[-0.55, 0], [-0.3, 1], [0.3, 2], [0.5, 3]] };
  let made = 0;
  const API = { freeze: false };

  const cl01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const seg = (u, a, b) => cl01((u - a) / (b - a));
  const easeOut = k => 1 - (1 - k) * (1 - k);
  const easeIn = k => k * k;
  const hash = (s, i) => { const x = Math.sin(s * 127.1 + i * 311.7) * 43758.5453; return x - Math.floor(x); };
  const here = () => window.__instance || null;
  const shakeOn = () => { try { return typeof SETTINGS === 'undefined' || SETTINGS.get('shake') !== false; } catch (e) { return true; } };

  // a monster's own def may name its death (`death: 'undead'`) and mark it a boss (`boss: true`); docs/EXTENDING.md
  function kindOf(type) {
    const d = MONSTER_DEFS[type] || {};
    if (typeof d.death === 'string' && EVENTS[d.death]) return d.death;
    if (KIND[type]) return KIND[type];
    return d.mech ? 'machine' : d.human ? 'person' : 'beast';
  }
  function isBoss(type) {
    const d = MONSTER_DEFS[type];
    if (d && d.boss === true) return true;
    if (BOSS_TYPES.has(type)) return true;
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
    if (kind === 'person') body.unarmed = true;
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
    if (c.m && c.m[DA] === c) c.m[DA] = null;
    // its drops do not wait on a death that is not being shown any more
    for (const d of pending) if (d[POWN] === c && d[PIN] > 0) { d[PIN] = 0; d[PT] = 0; }
  }
  function hide(d, c) {
    if (!d || d[PIN] !== undefined) return;
    const wait = Math.max(0, popAt(c) - c.t);
    // not enumerable: a copy of the drop ({ ...d }, 16-instances carrying the floor out with the knight) is a plain drop
    // that shows at once, never one hidden for good by a wait nobody counts down
    const set = (k, v) => Object.defineProperty(d, k, { value: v, writable: true, configurable: true, enumerable: false });
    set(PIN, wait); set(PT, wait > 0 ? undefined : 0); set(PFX, c.x); set(PFY, c.y); set(POWN, c);
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
      const lg = LEGS[c.type] || { n: 4 };
      if (p.legs > 0 && lg.n) {
        g.rotate(ang); g.strokeStyle = lg.col || 'rgba(38,30,26,0.9)'; g.lineWidth = Math.max(1.2, r * (lg.w || 0.13)); g.lineCap = 'round';
        const up = c.side, base = r * 0.42 * p.sy, L = r * (0.3 + 0.4 * p.legs) * (lg.n === 2 ? 0.7 : 1);
        for (const [f, ph] of LEG_AT[lg.n]) {
          const lx = f * r, k = p.kick * Math.sin(ph * 1.7 + 1) * r * 0.3, kx = lx + k * 0.6, ex = kx + up * k * 0.2, ey = up * (base + L - Math.abs(k) * 0.3);
          g.beginPath(); g.moveTo(lx, up * base); g.lineTo(ex, ey); g.stroke();
          if (lg.hoof) { g.fillStyle = lg.hoof; g.beginPath(); g.arc(ex, ey, Math.max(1.4, r * 0.09), 0, 7); g.fill(); }
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
    beast: [[0.3, c => puff(c, c.x, c.y + c.r * 0.5, '#b9a98a', 8, 60)]],
    person: [[0.32, c => puff(c, c.x - c.fx * 9, c.y + c.r * 0.5, '#b9a98a', 6, 50)], [0.324, c => clink(c, 5)], [0.5, c => clink(c, 3)]],
    undead: [[0.1, c => puff(c, c.x, c.y - c.r * 0.6, dust(c)[1], 10, 50)], [0.45, c => puff(c, c.x, c.y + c.r * 0.6, dust(c)[0], 8, 40)]],
    machine: [[0.04, c => spark(c)], [0.16, c => spark(c)], [0.28, c => spark(c)], [0.42, c => { puff(c, c.x, c.y, '#ff8a1a', 14, 150); puff(c, c.x, c.y, '#4a4a52', 12, 110); }]],
    dragon: [[0.32, c => { puff(c, c.x, c.y + c.r * 0.4, '#a08a6a', 16, 120); if (window.IMPACT && IMPACT.wave) IMPACT.wave(c.x, c.y, c.boss ? 1.8 : 1.1); }]],
    golem: [[0.34, c => { puff(c, c.x, c.y, (c.rocks && c.rocks[0].col) || '#8f887a', 18, 120); puff(c, c.x, c.y - c.r * 0.4, '#d8d0c0', 8, 70); }]],
  };
  // the core's burst() draws on Math.random; these puffs are the same particles from the corpse's own seed, so a death
  // never moves the game's dice (a fight, a drop table or the bot's wander rolls exactly as it would have)
  function puff(c, x, y, color, n, speed) {
    const k = (c.puffs = (c.puffs || 0) + 1) * 17.3 + c.seed;
    for (let i = 0; i < n; i++) { const a = hash(k, i) * Math.PI * 2, sp = speed * (0.3 + hash(k, 50 + i)); particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.5 + hash(k, 100 + i) * 0.4, color, r: 2 + hash(k, 150 + i) * 2.5 }); }
  }
  function clink(c, n) { const w = pose(c).weapon; if (w) puff(c, c.x + w.x, c.y + w.y, '#e8ecf2', n, 70); }
  function spark(c) { puff(c, c.x + (hash(c.seed + c.t, 1) - 0.5) * c.r, c.y - c.r * 0.3, '#ffd166', 6, 110); }
  function flashFx(c) {
    c.flashed = true;
    if (window.SETTINGS && typeof SETTINGS.startShake === 'function') SETTINGS.startShake(c.r > 35 ? 8 : 6, 0.45);
    // the Ginormous Golem's crash is the biggest in the game (91-royalmine leaves its own wave to this one)
    if (window.IMPACT && IMPACT.wave) IMPACT.wave(c.x, c.y, c.type === 'ginormous_golem' ? 2.2 : 1.6);
    puff(c, c.x, c.y, '#fff2c0', 24, 200);
  }

  // ---------- each tick ----------
  function tick(dt) {
    // the stagger ends at the keeper's word (a corpse), when he says it lives, when it leaves, or after STAG_FOR past the wait
    if (stagger.length) for (let i = stagger.length - 1; i >= 0; i--) {
      const m = stagger[i];
      if (m[DA] || !m.dead || m.gone || !monsters.includes(m) || !(time < (m.localDeadUntil || 0) + STAG_FOR)) { m[STAG] = false; stagger.splice(i, 1); }
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
  }
  // the one place a death starts (phase-1 spec rule 9)
  HOOKS.monsterDeath.push(m => { if (m && m.dead && !m.gone && !m.phantom) spawn(m); });
  HOOKS.update.push(dt => tick(dt));
  HOOKS.newGame.push(() => { while (corpses.length) end(corpses[0]); pending.length = 0; for (const m of stagger) m[STAG] = false; stagger.length = 0; });
  HOOKS.draw.push((g, items) => {
    // the stagger: standing, hurt, still (the core skips drawing it, see drawCharacter below)
    for (const m of stagger) items.push({ y: m.y, draw: () => _drawCharacter(g, Object.assign({}, m, { dead: false, moving: false, attackT: 0, hurtT: Math.max(0.12, m.hurtT || 0) }), m.type) });
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
  // a grave a kill lays is the last one in quest.graves (54-graves pushes it)
  const lastGrave = () => (typeof quest !== 'undefined' && Array.isArray(quest.graves) && quest.graves.length) ? quest.graves[quest.graves.length - 1] : null;
  // what one kill added (its drops, its grave, a boss's banner) waits on the body c
  function adopt(c, was) {
    if (drops === was.arr) for (let i = was.n0; i < drops.length; i++) if (drops[i] && drops[i].t === 0) hide(drops[i], c);
    const gv = lastGrave(); if (gv && gv !== was.g0) gv[MK] = c;
    if (c.boss && levelBanner && levelBanner !== was.b0 && c.t < FLASH + HOLD) c.banner = levelBanner;
  }
  const note = () => ({ arr: drops, n0: drops.length, b0: levelBanner, g0: lastGrave() });
  // the kill itself starts nothing: HOOKS.monsterDeath (fired inside it) made the body; this only hands it what the kill made
  killMonster = function (m) {
    const was = note(), c0 = m ? m[DA] : null;
    _killMonster(m);
    if (!m || m.phantom) return;
    // Cohen's own blow on a friend's monster: no death until the keeper's word, so it stands still and hurt till then
    if (m.remote && m.dead && !m[DA] && !m[STAG]) { m[STAG] = true; stagger.push(m); return; }
    const c = API.of(m); if (!c || c === c0) return;
    adopt(c, was);
  };
  killMonster.__inner = _killMonster;
  const _drawCharacter = drawCharacter;
  drawCharacter = function (g, e, kind) { if (e.dead === true && (e[DA] || e[STAG])) return; return _drawCharacter(g, e, kind); };
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
  // ---------- online: the kill the keeper sends ----------
  // 75-coop pays it through its own payKill, never through killMonster, and it arrives a whole round trip after this
  // knight's own last blow (his 'hit' to the world, the keeper's next frame, the 'kill' back): often 0.2 s or more on home
  // Wi-Fi, by which time the body has been falling for a while. A listener ahead of 75-coop's notes the drops and the
  // banner as they were; one after it hands what that kill added to the body with the same nid (made now if the keeper's
  // 'mon' row has not turned it dead yet). A drop that comes late waits only for what is left of the fall (hide), so it
  // still pops out of the body; a boss banner is held until the flash just like one this knight's own kill set.
  // The body is made by 75-coop's own listener (HOOKS.monsterDeath on the keeper's word) or was made by the dead row before;
  // this never makes one. A kill that comes back after its body is gone (more than a second late) pays plain loot: the
  // death is never played twice.
  function paidKill(msg, was) {
    if (!msg || typeof msg.type !== 'string' || !MONSTER_DEFS[msg.type]) return;
    const nid = typeof msg.nid === 'string' ? msg.nid : null, inst = here();
    let c = nid ? corpses.find(k => k.nid === nid && k.inst === inst) || null : null;
    if (!c && !nid) { const x = Number(msg.x), y = Number(msg.y); for (const k of corpses) if (k.type === msg.type && k.inst === inst && Math.abs(x - k.x) < k.r + 48 && Math.abs(y - k.y) < k.r + 48) { c = k; break; } }
    if (c) adopt(c, was);
  }
  if (typeof NET !== 'undefined' && typeof NET.on === 'function') {
    let was = null;
    (NET.listeners.kill = NET.listeners.kill || []).unshift(() => { was = note(); });
    NET.on('kill', msg => { const w = was; was = null; if (w) paidKill(msg, w); });
  }
  // a tap on a body still falling is a tap on nothing (no tap ring, no walk into it, no long-press name), and a drop still
  // hidden under it cannot be picked, tapped or named by a long-press until it pops out
  const _tapPick = tapPick;
  tapPick = function (sx, sy) {
    if (!pending.length && !corpses.length) return _tapPick(sx, sy);
    let all = null;
    if (pending.length) { all = drops; drops = drops.filter(d => !(d[PIN] > 0)); }
    let p; try { p = _tapPick(sx, sy); } finally { if (all) drops = all; }
    if (p && (p.kind === 'monster' || p.kind === 'npc' || p.kind === 'person' || p.kind === 'item')) return p;
    const wx = sx + cam.x, wy = sy + cam.y, inst = here();
    for (const c of corpses) if (c.inst === inst && Math.hypot(wx - c.x, wy - c.y) <= c.r + 8 && pose(c).alpha > 0.25) return null;
    return p;
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
    const keep = { px: player.x, py: player.y, hp: player.hp, kills: player.kills, drops: drops.slice(), peace: window.__peace, banner: levelBanner, shake: typeof SETTINGS !== 'undefined' ? SETTINGS.get('shake') : true, mons: monsters, dc: dialog.cur, dq: dialog.queue.slice(),
      graves: Array.isArray(quest.graves) ? quest.graves.slice() : quest.graves, graveNight: quest.graveNight ? JSON.parse(JSON.stringify(quest.graveNight)) : quest.graveNight };
    const temp = [];
    const mk = (type, dx, dy, fx = 1) => {
      const d = MONSTER_DEFS[type], x = player.x + dx, y = player.y + dy;
      const m = { type, x, y, home: { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: false, state: 'idle', wanderT: 99, wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 1e9, facing: { x: fx, y: 0 }, walkT: 0, moving: false, stunT: 0 };
      monsters.push(m); temp.push(m); return m;
    };
    // the death's one entry (HOOKS.monsterDeath), as killMonster fires it, without the kill's drops, XP and graves
    const down = m => { m.dead = true; m.deadT = 0; m.hp = 0; m.respawnT = 1e9; monsterDied(m, 'blow', 'test'); };
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
      // (1b) the legs that come out as an animal rolls over fit it: four on a wolf, two on a bird, none added to a spider
      // (it already shows eight), and a cow's end in dark hooves
      {
        const tally = f => { const st = {}; f(new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() { } }) : typeof k === 'string' ? () => { st[k] = (st[k] || 0) + 1; } : undefined, set: () => true })); return st; };
        const ls = ['wolf', 'rimhawk', 'giant_spider', 'cow'].map((type, i) => mk(type, (i - 1.5) * 2 * TILE, 4 * TILE));
        ls.forEach(down); F.sim(24, []);
        const legs = ls.map(m => { const c = API.of(m); if (!c) return { type: m.type, corpse: false }; const a = tally(g => drawCorpse(g, c)), b = tally(g => drawCharacter(g, c.body, c.type));
          return { type: m.type, corpse: true, full: pose(c).legs === 1, strokes: (a.stroke || 0) - (b.stroke || 0), hooves: (a.arc || 0) - (b.arc || 0) }; });
        const by = Object.fromEntries(legs.map(o => [o.type, o]));
        check(P + 'an animal rolled onto its side shows legs that fit it: four on a wolf, two on a bird, none added to a spider, and a cow\'s end in hooves',
          legs.every(o => o.corpse && o.full) && by.wolf.strokes === 4 && by.wolf.hooves === 0 && by.rimhawk.strokes === 2 && by.giant_spider.strokes === 0 && by.cow.strokes === 4 && by.cow.hooves === 4, legs);
        F.sim(50, []);
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
      // Nothing of the dead monster can be tapped: a tap on the falling body is a tap on nothing (no walk, no ring, no
      // name), and a drop still hidden cannot be tapped or named either (the core's tapPick would find the drop or the tile)
      {
        const cow = mk('cow', 3 * TILE, 0); F.step([]); render();
        const s0 = screenOf(cow), before = tapPick(s0.sx, s0.sy);
        cow.hp = 0; const n0 = drops.length; killMonster(cow);
        const fresh = drops.slice(n0), at0 = { n: fresh.length, hidden: fresh.every(d => API.hidden(d)), drawn: calls(g => { for (const d of fresh) drawDrop(g, d); }).n };
        // one drop is set down beside the body, where a kid could tap it on its own
        const side = fresh[0]; if (side) { side.x = cow.x + cow.r + 26; side.y = cow.y; }
        const sideAt = () => side ? tapPick(side.x - cam.x, side.y - cam.y) : null;
        const after0 = tapPick(s0.sx, s0.sy), side0 = sideAt(), label0 = tapLabelFor(after0), sideLabel0 = tapLabelFor(side0);
        const walked = tapAt(s0.sx, s0.sy), ring = !!tap.marker, kind0 = tap.kind; tapCancel('manual');
        F.sim(50, []); const at08 = { hidden: fresh.some(d => API.hidden(d)), popping: fresh.every(d => API.popping(d)), drawn: calls(g => { for (const d of fresh) drawDrop(g, d); }).n, inData: fresh.every(d => drops.includes(d)) };
        const after08 = tapPick(s0.sx, s0.sy), side08 = sideAt();
        F.sim(30, []); const at13 = { plain: fresh.every(d => !API.hidden(d) && !API.popping(d)), drawn: calls(g => { for (const d of fresh) drawDrop(g, d); }).n, inData: fresh.every(d => drops.includes(d)) };
        check(P + 'drops are in the game the moment the monster dies, drawn only when its death ends, then pop out (pickup data untouched)', at0.n >= 1 && at0.hidden && at0.drawn === 0 && !at08.hidden && at08.popping && at08.drawn > 0 && at08.inData && at13.plain && at13.drawn > 0 && at13.inData, { at0, at08, at13 });
        const ok = !!before && before.kind === 'monster' && before.monster === cow && after0 === null && label0 === null && !walked && !ring && kind0 === null && after08 === null
          && !!side && (!side0 || side0.kind !== 'item') && sideLabel0 !== ITEMS[side.id].name && !!side08 && side08.kind === 'item' && side08.drop === side;
        check(P + 'nothing of a dead monster can be tapped: a tap or a long-press on the falling body does nothing, and loot still hidden cannot be tapped or named until it pops out',
          ok, { before: before && before.kind, after0, label0, walked, ring, kind0, after08: after08 && after08.kind, side0: side0 && side0.kind, sideLabel0, side08: side08 && side08.kind });
      }
      // (3a2) a drop still hidden under a body when the knight leaves an instance comes out with him (16-instances copies
      // the floor onto the step): the copy is a plain drop that shows at once, never one hidden for good
      if (typeof INSTANCES !== 'undefined' && INSTANCES.get && INSTANCES.get('spider_den')) {
        const ow = new Set(drops), inDen = INSTANCES.enter('spider_den'); F.step([]);
        const cow = mk('cow', 3 * TILE, 0); cow.hp = 0; const n0 = drops.length; killMonster(cow);
        const fresh = drops.slice(n0), hid = fresh.length >= 1 && fresh.every(d => API.hidden(d));
        INSTANCES.leave();
        const carried = drops.filter(d => !ow.has(d)), plain = carried.map(d => ({ hidden: API.hidden(d), popping: API.popping(d), drawn: calls(g => drawDrop(g, d)).n }));
        drops = drops.filter(d => ow.has(d));
        check(P + 'loot still hidden under a body when the knight leaves a dungeon comes out with him as plain loot, drawn at once (never hidden for good)',
          inDen && hid && carried.length === fresh.length && plain.every(o => !o.hidden && !o.popping && o.drawn > 0), { inDen, hid, made: fresh.length, carried: carried.length, plain });
      }
      // (3b) the start of a death is HOOKS.monsterDeath and nothing else (phase-1 spec rule 9): a monster that only reached 0 hp
      // plays nothing; killMonster fires the hook once, with { k, by, how, x, y }, and the body comes from it; a paid kill's
      // phantom (no body) fires nothing
      {
        const seen = []; const spy = (m, info) => seen.push({ m, info }); HOOKS.monsterDeath.push(spy);
        try {
          const a = mk('wolf', -2 * TILE, 2 * TILE); a.hp = 0; a.dead = true; a.deadT = 0; F.step([]); F.step([]);
          const quiet = !API.of(a) && !corpses.some(c => c.m === a) && seen.length === 0;
          const b = mk('boar', 2 * TILE, 2 * TILE); b.hp = 0; killMonster(b);
          const one = seen.filter(s => s.m === b), info = one[0] && one[0].info;
          const shaped = one.length === 1 && !!info && ['k', 'by', 'how', 'x', 'y'].every(k => k in info) && info.how === 'blow' && info.x === b.x && info.y === b.y && info.k != null && !!API.of(b) && API.of(b).t === 0;
          const n1 = seen.length, c1 = corpses.length;
          if (typeof COOP !== 'undefined' && COOP.phantomOf) killMonster(COOP.phantomOf({ type: 'wolf', nid: 'deaths:ph', x: player.x, y: player.y + 2 * TILE }));
          const phantom = seen.length === n1 && corpses.length === c1;
          check(P + 'a death starts only from HOOKS.monsterDeath: 0 hp alone plays nothing, killMonster fires it once with { k, by, how, x, y }, a paid kill with no body fires nothing', quiet && shaped && phantom, { quiet, seen: seen.length, info, phantom });
        } finally { HOOKS.monsterDeath.splice(HOOKS.monsterDeath.indexOf(spy), 1); }
      }
      // (3c) a grave a kill lays (54-graves) comes up as the body fades, never stuck through the falling body
      if (typeof GRAVES !== 'undefined' && !window.__instance) {
        // the game's own kill hooks (54-graves lays its marker in one) are back for this one kill
        const w = mk('wolf', -3 * TILE, -2 * TILE), g0 = lastGrave(), was = HOOKS.kill.length; HOOKS.kill.push(...hk); w.hp = 0;
        try { killMonster(w); } finally { HOOKS.kill.length = was; }
        const mkr = lastGrave() !== g0 ? lastGrave() : null;
        const shownNow = () => { const it = [], r = rec(); for (const hk of HOOKS.draw) hk(r.g, it, cam); return it.some(x => x.grave === mkr); };
        const at0 = { a: mkr && API.markerAlpha(mkr), shown: shownNow() };
        F.sim(44, []); const mid = { a: mkr && +API.markerAlpha(mkr).toFixed(2), shown: shownNow(), body: !!API.of(w) };
        F.sim(30, []); const end = { a: mkr && API.markerAlpha(mkr), shown: shownNow(), body: !!API.of(w) };
        check(P + 'a grave marker a kill lays is not drawn on the falling body: it comes up as the body fades, then stands as before', !!mkr && at0.a === 0 && !at0.shown && mid.body && mid.a > 0 && mid.a < 1 && mid.shown && !end.body && end.a === 1 && end.shown, { laid: !!mkr, at0, mid, end });
      }
      // (3d) a falling goblin, guard or castle guard is drawn without the weapon in his hand: it is only drawn flying off
      {
        const out = ['goblin', 'guard_m', 'castle_guard'].map((type, i) => {
          const m = mk(type, (i - 1) * 2 * TILE, -4 * TILE); down(m); const c = API.of(m); if (!c) return { type, corpse: false };
          const bare = calls(g => drawCharacter(g, c.body, type)).n, armed = calls(g => drawCharacter(g, Object.assign({}, c.body, { unarmed: false }), type)).n;
          return { type, corpse: true, unarmed: c.body.unarmed === true, bare, armed };
        });
        F.sim(70, []);
        check(P + 'a falling person\'s own sprite leaves the weapon out (goblin, town guard, castle guard), so it is never in his hand and flying at once', out.every(o => o.corpse && o.unarmed && o.bare > 0 && o.bare < o.armed), out);
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
      // (5) online: a puppet's death starts on the keeper's word (its row turning dead, or its 'kill'), once; the drops a
      // friend's kill pays wait for the body
      if (typeof NET !== 'undefined' && typeof COOP !== 'undefined') {
        const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake }, real = monsters;
        let sock = null; const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
        const fake = { call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: 0, keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } };
        const kills0 = player.kills, n0 = drops.length;
        const seen = []; const spy = (m, info) => seen.push({ nid: m.nid, how: info.how }); HOOKS.monsterDeath.push(spy);
        const fired = nid => seen.filter(s => s.nid === nid).length;
        try {
          NET.enabled = true; NET.token = 'deaths-test'; NET.useFake(fake); NET.connect();
          push({ t: 'keeper', map: 'over', n: 'Ann' });
          const x = Math.round(player.x + 3 * TILE), y = Math.round(player.y);
          const row = (dead, hp) => ['Ann:dd', 'wolf', x, y, hp, 22, 'chase', -1, 0, 0, 0, dead ? 1 : 0, 0, 0];
          push({ t: 'mon', n: 'Ann', list: [row(false, 22)] }); F.step([]);
          const p = COOP.find('Ann:dd'), alive = !!p && p.remote && !p.dead && !API.of(p);
          push({ t: 'mon', n: 'Ann', list: [row(true, 0)] }); F.step([]);
          const c = p && API.of(p), born = !!c && c.remote && c.kind === 'beast' && fired('Ann:dd') === 1 && seen[seen.length - 1].how === 'row';
          push({ t: 'kill', nid: 'Ann:dd', type: 'wolf', x, y }); F.step([]);
          const paid = drops.slice(n0), waits = paid.length > 0 && paid.every(d => API.hidden(d));
          push({ t: 'mon', n: 'Ann', list: [row(true, 0)] }); F.sim(25, []);
          const mid = c && { t: +c.t.toFixed(2), fall: pose(c).fall, drawn: calls(g => drawCorpse(g, c)).n, tap: tapPick(p.x - cam.x, p.y - cam.y) };
          push({ t: 'mon', n: 'Ann', list: [row(true, 0)] }); F.sim(40, []);
          const gone = !!c && !corpses.includes(c), shown = paid.every(d => !API.hidden(d)), once = fired('Ann:dd') === 1;
          check(P + 'online: a puppet whose row turns dead plays the same death (once, the kill after it starts nothing), the drops a friend\'s kill pays wait for it, and it is gone after', alive && born && waits && !!mid && mid.fall === 1 && mid.drawn > 20 && !mid.tap && gone && shown && once, { alive, born, paid: paid.length, waits, mid: mid && { t: mid.t, fall: mid.fall, drawn: mid.drawn, tap: mid.tap && mid.tap.kind }, gone, shown, fired: fired('Ann:dd') });
          // Cohen's own last blow on a friend's monster starts no death: it stands still and hurt until the keeper's word
          // (here its 'kill', coming back 0.2 s later while the rows still say alive), then falls; the rows that follow start nothing
          {
            const nid = 'Ann:own', ox = x, oy = y + 4 * TILE;
            const rw = dead => [nid, 'wolf', ox, oy, dead ? 0 : 22, 22, 'chase', -1, 0, 0, 0, dead ? 1 : 0, 0, 0];
            push({ t: 'mon', n: 'Ann', list: [rw(false)] }); F.step([]);
            const q = COOP.find(nid); let hold = null, waitAt = null;
            if (q) {
              q.hp = 0; killMonster(q);
              hold = { dead: q.dead, corpse: !!API.of(q), stag: API.staggering(q), core: calls(g => drawCharacter(g, q, q.type)).n, item: 0 };
              { const it = [], r = rec(); for (const hk of HOOKS.draw) hk(r.g, it, cam); const n0 = r.st.n; for (const e of it) if (e.y === q.y) e.draw(); hold.item = r.st.n - n0; }
              for (let i = 0; i < 12; i++) { push({ t: 'mon', n: 'Ann', list: [rw(false)] }); F.step([]); }
              waitAt = { corpse: !!API.of(q), stag: API.staggering(q), dead: q.dead, fired: fired(nid) };
              push({ t: 'kill', nid, type: 'wolf', x: ox, y: oy, to: 'Cohen' });
            }
            const qc = q && API.of(q), firedKill = fired(nid);
            for (let i = 0; i < 70; i++) { push({ t: 'mon', n: 'Ann', list: [rw(true)] }); F.step([]); }
            const res = { puppet: !!q, hold, waitAt, corpse: !!qc && qc.remote, firedKill, after: fired(nid), gone: !!qc && !corpses.includes(qc) };
            check(P + 'online: Cohen\'s own last blow on a friend\'s monster starts no death on his say-so: it holds still and hurt until the keeper\'s word, then falls, once', !!q && hold.dead && !hold.corpse && hold.stag && hold.core === 0 && hold.item >= 1 && !waitAt.corpse && waitAt.stag && waitAt.fired === 0 && res.corpse && firedKill === 1 && res.after === 1 && res.gone, res);
          }
          // a knight who walks up to a monster the keeper killed before he got there sees it already dead: no death plays
          {
            const nid = 'Ann:old'; push({ t: 'mon', n: 'Ann', list: [[nid, 'brood_mother', x, y + 6 * TILE, 0, MONSTER_DEFS.brood_mother.hp, 'idle', -1, 0, 0, 0, 1, 0, 0]] }); F.step([]);
            const q = COOP.find(nid); for (let i = 0; i < 5; i++) { push({ t: 'mon', n: 'Ann', list: [[nid, 'brood_mother', x, y + 6 * TILE, 0, MONSTER_DEFS.brood_mother.hp, 'idle', -1, 0, 0, 0, 1, 0, 0]] }); F.step([]); }
            const old = !!q && { dead: q.dead, deadT: q.deadT, core: q.deadT < 0.8 };
            check(P + 'online: a monster first seen already dead (killed before this knight arrived) plays no death, no flash and no shake (not even the core\'s old tip-and-fade)', !!q && q.dead && !old.core && !API.of(q) && fired(nid) === 0 && !corpses.some(k => k.nid === nid), { puppet: !!q, old, fired: fired(nid) });
          }
          // the keeper's 'kill' comes back a round trip after Cohen's own last blow felled the puppet (0.25 s, 0.5 s, 0.87 s,
          // after the pop would have started, and 1.25 s, after the body is gone): its drops wait for the body or pop out of
          // it, never lie there plain while it falls, and a kill after the body is gone never plays the death a second time
          const late = [];
          for (const lag of [15, 30, 52, 75]) {
            const nid = 'Ann:late' + lag, lx = x, ly = y + 2 * TILE;
            const rw = dead => [nid, 'wolf', lx, ly, dead ? 0 : 22, 22, 'chase', -1, 0, 0, 0, dead ? 1 : 0, 0, 0];
            push({ t: 'mon', n: 'Ann', list: [rw(false)] }); F.step([]);
            const q = COOP.find(nid); if (!q) { late.push({ lag, puppet: false }); continue; }
            q.hp = 0; killMonster(q); const own = !API.of(q);
            push({ t: 'mon', n: 'Ann', list: [rw(true)] }); F.step([]);
            const qc = API.of(q);
            for (let i = 1; i < lag; i++) { push({ t: 'mon', n: 'Ann', list: [rw(true)] }); F.step([]); }
            const m0 = drops.length, at = qc && +qc.t.toFixed(2), up = !!qc && corpses.includes(qc), c0 = corpses.length;
            push({ t: 'kill', nid, type: 'wolf', x: lx, y: ly, to: 'Cohen' });
            const got = drops.slice(m0), waitsOrPops = got.length > 0 && got.every(d => API.hidden(d) || API.popping(d)), second = corpses.length > c0 || corpses.some(k => k.nid === nid && k !== qc);
            let plain = 0, frames = 0;
            while (qc && corpses.includes(qc) && frames < 90) { for (const d of got) if (drops.includes(d) && !API.hidden(d) && !API.popping(d)) plain++; push({ t: 'mon', n: 'Ann', list: [rw(true)] }); F.step([]); frames++; }
            F.sim(30, []);
            late.push({ lag, own, corpse: !!qc, up, at, paid: got.length, waitsOrPops, plain, second, fired: fired(nid), gone: !!qc && !corpses.includes(qc), shown: got.every(d => !API.hidden(d) && !API.popping(d)) });
          }
          check(P + 'online: when the keeper\'s kill comes back late (0.25 s, 0.5 s, 0.87 s after Cohen\'s own last blow), its drops still wait for the falling body or pop out of it; at 1.25 s the body is gone, the loot lies plain and the death does not play twice',
            late.length === 4 && late.every(o => o.own && o.corpse && o.paid > 0 && o.plain === 0 && !o.second && o.fired === 1 && o.gone && o.shown && (o.lag < 60 ? o.up && o.waitsOrPops : !o.up && !o.waitsOrPops)), late);
          // a boss a friend's game kills: the banner the kill pays this knight waits for the flash here too, whether the
          // keeper's dead row or the 'kill' reaches this knight first
          const bossRuns = [];
          for (const rowFirst of [true, false]) {
            const nid = 'Ann:bm' + (rowFirst ? 'r' : 'k'), bx = x, by = y - 3 * TILE, bhp = MONSTER_DEFS.brood_mother.hp;
            const rb = dead => [nid, 'brood_mother', bx, by, dead ? 0 : bhp, bhp, 'chase', -1, 0, 0, 0, dead ? 1 : 0, 0, 0];
            push({ t: 'mon', n: 'Ann', list: [rb(false)] }); F.step([]);
            const q = COOP.find(nid);
            if (rowFirst) { push({ t: 'mon', n: 'Ann', list: [rb(true)] }); F.step([]); }
            let made = null; const say = m => { if (m.type === 'brood_mother' && m.nid === nid) levelBanner = made = { text: 'DEATHS ONLINE BANNER', sub: 'test', t: 3 }; };
            HOOKS.kill.push(say); levelBanner = null;
            try { push({ t: 'kill', nid, type: 'brood_mother', x: bx, y: by, to: 'Cohen' }); } finally { HOOKS.kill.splice(HOOKS.kill.indexOf(say), 1); }
            const qc = q && API.of(q), held0 = holding() && !!qc && !!made && qc.banner === made;
            for (let i = 0; i < 58; i++) { push({ t: 'mon', n: 'Ann', list: [rb(true)] }); F.step([]); }
            const at1 = { t: qc && +qc.t.toFixed(2), held: holding(), bt: made && made.t, ahead: bannerAhead('DEATHS ONLINE BANNER') };
            for (let i = 0; i < 70; i++) { push({ t: 'mon', n: 'Ann', list: [rb(true)] }); F.step([]); }
            const at22 = { t: qc && +qc.t.toFixed(2), held: holding(), bt: made && +made.t.toFixed(2), flashed: !!qc && qc.flashed };
            for (let i = 0; i < 60; i++) { push({ t: 'mon', n: 'Ann', list: [rb(true)] }); F.step([]); }
            bossRuns.push({ rowFirst, boss: !!qc && qc.boss, remote: !!qc && qc.remote, banner: !!made, held0, at1, at22, gone: !!qc && !corpses.includes(qc) });
            levelBanner = null; if (typeof clearShake === 'function') clearShake();
          }
          check(P + 'online: a boss\'s banner paid by a friend\'s kill is held until the flash on this screen too (not drawn, its time not running), then shows', bossRuns.every(o => o.boss && o.remote && o.banner && o.held0 && o.at1.held && o.at1.bt === 3 && o.at1.ahead && o.at22.flashed && !o.at22.held && o.at22.bt < 3 && o.gone), bossRuns);
        } finally {
          HOOKS.monsterDeath.splice(HOOKS.monsterDeath.indexOf(spy), 1);
          NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
          COOP.reset(); monsters = real; COOP.state.idxLen = -1; player.kills = kills0;
        }
      }
      // (5b) a death never rolls the game's dice: every puff, spark, clatter and flash comes from the corpse's own seed
      {
        const m = mk('walker', 0, -3 * TILE); down(m); F.step([]); const c = API.of(m), r0 = Math.random; let rolls = 0, fired = 0;
        Math.random = () => { rolls++; return r0(); };
        try { for (const k of Object.keys(EVENTS)) for (const [, fn] of EVENTS[k]) { const kind = c.kind; c.kind = k; fn(c); c.kind = kind; fired++; } flashFx(c); drawCorpse(rec().g, c); }
        finally { Math.random = r0; }
        check(P + 'a death never rolls the game\'s dice (its dust, sparks, clatter and flash come from its own seed)', !!c && fired >= 10 && rolls === 0, { fired, rolls });
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
      quest.graves = keep.graves; quest.graveNight = keep.graveNight;
      levelBanner = keep.banner; dialog.cur = keep.dc; dialog.queue.length = 0; dialog.queue.push(...keep.dq);
      if (typeof SETTINGS !== 'undefined') SETTINGS.set('shake', keep.shake);
    }
  });

  Object.assign(API, {
    DUR, BOSS_DUR, FLASH, HOLD, POP, KIND, BOSS_TYPES,
    list: () => corpses.slice(), of: m => (m && m[DA] && corpses.includes(m[DA])) ? m[DA] : null,
    spawn, pose, uOf, kindOf, isBoss, holding, popAt, draw: drawCorpse, drawFlash,
    hidden: d => !!d && d[PIN] > 0, popping: d => !!d && d[PIN] === 0 && d[PT] !== undefined, waiting: () => pending.length,
    staggering: m => !!m && !!m[STAG] && stagger.includes(m),
    // how much of what a death leaves on the ground shows: 0 while the body is up, rising as it fades, 1 once it is gone
    remains: m => { const c = API.of(m); return c ? 1 - pose(c).alpha : 1; },
    markerAlpha: mk => { const c = mk && mk[MK]; if (!c) return 1; if (!corpses.includes(c)) { mk[MK] = null; return 1; } return 1 - pose(c).alpha; },
    // a boss file paying out after the flash (91-royalmine's golem): the drops fn makes pop out of m's body
    payOut: (m, fn) => { const c = API.of(m), was = note(); fn(); if (c) adopt(c, was); },
    clear: () => { while (corpses.length) end(corpses[0]); },
  });
  return API;
})();
window.DEATHS = DEATHS;
