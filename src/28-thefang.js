// ============================================================================
// CHAPTER 5 — THE FANG (feature file; registers through HOOKS only, edits no core file)
// A volcanic lair at the bottom of dragon country (x 2–34, y 108–138). Behind a sealed gate sleeps
// The Fang: a giant elemental dragon only legends have heard of. It cycles fire, ice, storm and stone.
// Everything lives in one block so no name leaks into the shared script scope.
// ============================================================================
{
  // ---------- geometry ----------
  const LAIR = { x0: 2, y0: 108, x1: 34, y1: 138 };
  const LAIR_NAME = "The Fang's Lair";
  const GATE = { x0: 17, x1: 19, y: 108, x: 18 };
  const FANG_HOME = { x: 18, y: 121 };
  const PILLARS = [[14, 111], [22, 111], [8, 113], [28, 113], [6, 119], [30, 119], [6, 126], [30, 126], [10, 128], [26, 128]];
  const MAGMA_SPOTS = [[3, 113], [4, 113], [3, 114], [5, 115], [4, 116], [32, 113], [33, 113], [33, 114], [31, 115], [32, 116], [3, 121], [4, 122], [3, 123], [33, 121], [32, 122], [33, 123],
    [12, 116], [24, 116], [11, 124], [25, 124], [8, 131], [28, 131], [8, 137], [28, 137]];
  const HOARD_SPOTS = [[11, 133], [25, 133], [15, 133], [21, 133], [10, 136], [26, 136], [13, 136], [23, 136]];
  const CHEST_T = { x: 18, y: 136 };
  const CIRCLE_T = { x: 18, y: 117 };   // the summoning circle: The Fang comes up when the dragon horn is sounded here (Dragon Killers)
  // the region goes in front of the first region that overlaps the lair (dragon country, or The Wilds), not at index 0:
  // regionAt() takes the first match, and earlier features check their own region sits first
  { const overlaps = r => r.x1 >= LAIR.x0 && r.x0 <= LAIR.x1 && r.y1 >= LAIR.y0 && r.y0 <= LAIR.y1; const at = REGIONS.findIndex(overlaps);
    REGIONS.splice(at < 0 ? REGIONS.length : at, 0, { name: LAIR_NAME, sub: 'Only legends have heard of it', x0: LAIR.x0, y0: LAIR.y0, x1: LAIR.x1, y1: LAIR.y1 }); }
  const inLair = (tx, ty) => tx >= LAIR.x0 && tx <= LAIR.x1 && ty >= LAIR.y0 && ty <= LAIR.y1;

  // ---------- tiles (ids captured locally; names must be unique across features — a duplicate addTile name aliases the NEXT tile's id) ----------
  const MAGMA = addTile('MAGMA', { solid: true, tex: 'dirt', mini: '#ff6a1a' });
  const LAIR_GATE = addTile('LAIR_GATE', { solid: true, tex: 'cwall', mini: '#3a3a42' });
  const ICE = addTile('ICE', { solid: false, tex: 'water', mini: '#bfe3ff' });
  const OBSIDIAN = addTile('LAIR_PILLAR', { solid: true, tex: 'wall', mini: '#15131a' });
  const BONES = addTile('LAIR_BONES', { tex: 'cave', mini: '#d9d0c0' });
  const HOARD = addTile('FANG_HOARD', { solid: true, tex: 'cave', mini: '#f5c542' });
  const FANG_CHEST = addTile('FANG_CHEST', { solid: true, tex: 'cave', mini: '#8a5a2b' });
  const SUMMON_CIRCLE = addTile('SUMMON_CIRCLE', { solid: true, tex: 'cave', mini: '#b58cff' });

  // ---------- state ----------
  // saved: quest.fang. runtime only: ice patches, fireballs, lightning strikes, credits timer, heat timer
  const fresh = () => ({ gateOpen: false, warned: false, slain: false, seen: false, looted: [], chest: false, summoned: false });
  const FQ = () => quest.fang || (quest.fang = fresh());
  const ICE_PATCHES = [];   // {tx, ty, t}
  const FIREBALLS = [];     // {kind:'fangfire', x, y, vx, vy, t, life, dmg}
  const STRIKES = [];       // {x, y, t, hit}
  const MAGMA_TILES = [];   // [tx, ty] — light sources
  let heatT = 0, credits = null;
  const fang = () => monsters.find(m => m.type === 'the_fang');
  const salved = () => !!(quest.dragons && quest.dragons.salve);
  HOOKS.newGame.push(() => { quest.fang = fresh(); ICE_PATCHES.length = 0; FIREBALLS.length = 0; STRIKES.length = 0; heatT = 0; credits = null; MONSTER_DEFS.the_fang.maxHit = 32; });

  // ---------- items ----------
  ITEMS.fang_of_the_fang = { name: 'Fang of the Fang', value: 5000, color: '#f5f0d8', shape: 'dagger', stack: 1, weapon: { str: 40, att: 40, cd: 0.4, perk: 'swift' } };
  ITEMS.fang_of_the_fang.id = 'fang_of_the_fang';
  ITEMS.dragon_horn = { name: 'Dragon horn', value: 1500, color: '#e8dcc0', shape: 'tusk', stack: 1 }; // the Duke's gift to the Dragon Killers: sounds The Fang up from under the lava
  ITEMS.dragon_horn.id = 'dragon_horn';

  // ---------- the elements ----------
  const ELEMENTS = ['fire', 'ice', 'storm', 'stone'];
  const EL = {
    fire: { name: 'Fire', col: '#ff6a1a', scale: '#7a2a1a', scale2: '#5a1e14', wing: 'rgba(255,110,40,0.55)', eye: '#ffd166', mote: '#ffb347', aura: a => `rgba(255,120,40,${a})`, cry: 'The Fang burns!' },
    ice: { name: 'Ice', col: '#8fd3ff', scale: '#3a6a8a', scale2: '#2a5070', wing: 'rgba(160,220,255,0.5)', eye: '#e6f7ff', mote: '#bfe3ff', aura: a => `rgba(140,210,255,${a})`, cry: 'The Fang freezes!' },
    storm: { name: 'Storm', col: '#d8c8ff', scale: '#3a3a5a', scale2: '#2a2a44', wing: 'rgba(200,180,255,0.5)', eye: '#fff7c0', mote: '#e8e0ff', aura: a => `rgba(190,170,255,${a})`, cry: 'The Fang storms!' },
    stone: { name: 'Stone', col: '#b0a08a', scale: '#5a554e', scale2: '#45413b', wing: 'rgba(150,140,120,0.6)', eye: '#ffb347', mote: '#8d9098', aura: a => `rgba(160,150,130,${a})`, cry: 'Stone skin: wait it out' },
  };

  // ---------- The Fang ----------
  MONSTER_DEFS.the_fang = { name: 'The Fang', level: 80, r: 40, hp: 900, att: 80, maxHit: 32, def: 55, speed: 80, aggro: true, sight: 9 * TILE, respawn: 900, drops: {} };
  // sprite: a serpentine body three times the knight's size — long tail, four clawed legs, two beating wings,
  // a crested, horned head with one enormous fang, wrapped in an aura that takes the colour of the element
  HOOKS.drawMonster.the_fang = (g, e, hurt) => {
    const ang = Math.atan2(e.facing.y, e.facing.x), t = time, el = e.element || 'fire', C = EL[el];
    const flap = Math.sin(t * (e.moving || e.state === 'chase' ? 6 : 2.5)), f = (flap + 1) / 2;
    // aura and orbiting motes (world-aligned)
    const pulse = 0.2 + Math.sin(t * 4) * 0.08;
    const gr = g.createRadialGradient(0, 0, 24, 0, 0, 120); gr.addColorStop(0, C.aura(pulse)); gr.addColorStop(1, C.aura(0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 120, 0, 7); g.fill();
    for (let k = 0; k < 8; k++) { const a = t * 1.5 + k * Math.PI / 4, r = 76 + Math.sin(t * 3 + k) * 12; g.fillStyle = C.mote; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r * 0.6, 2.5 + Math.sin(t * 5 + k) * 1, 0, 7); g.fill(); }
    g.save(); g.rotate(ang);
    const scale = hurt ? '#ff9a9a' : C.scale, scale2 = hurt ? '#ffb0b0' : C.scale2, dark = '#1a1a22', bone = '#f5f0d8';
    // tail: a serpent of shrinking segments, swaying
    for (let i = 10; i >= 0; i--) {
      const x = -30 - i * 12, y = Math.sin(t * 3 - i * 0.6) * (3 + i * 1.5), r = 15 - i * 1.2;
      g.fillStyle = i % 2 ? scale : scale2; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = C.col; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x, y - 3); g.lineTo(x + 4, y); g.lineTo(x, y + 3); g.closePath(); g.fill();
      if (i === 10) { g.fillStyle = bone; g.beginPath(); g.moveTo(x - 2, y - 7); g.lineTo(x - 18, y); g.lineTo(x - 2, y + 7); g.closePath(); g.fill(); }
    }
    // four legs with claws (front pair forward, back pair behind the body)
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [lx, ly, k] of [[18, -18, 0], [18, 18, 1], [-14, -18, 2], [-14, 18, 3]]) {
      const ph = e.moving ? Math.sin(e.walkT * 0.6 + k * Math.PI / 2) * 8 : 0, s = Math.sign(ly);
      const kx = lx + 6 + ph, ky = ly + s * 16, fx = lx + 14 + ph * 0.5, fy = ly + s * 30;
      g.strokeStyle = dark; g.lineWidth = 9; g.beginPath(); g.moveTo(lx, ly); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.strokeStyle = scale2; g.lineWidth = 5; g.beginPath(); g.moveTo(lx, ly); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.fillStyle = dark; g.beginPath(); g.ellipse(fx, fy, 9, 6, 0, 0, 7); g.fill();
      g.fillStyle = bone; for (const c of [-1, 0, 1]) { g.beginPath(); g.moveTo(fx + 2 + c * 4, fy + s * 3); g.lineTo(fx + 8 + c * 5, fy + s * 10); g.lineTo(fx - 1 + c * 4, fy + s * 6); g.closePath(); g.fill(); }
    }
    // wings: membrane on three bone fingers, beating
    for (const s of [-1, 1]) {
      const S = [0, s * 12], W = [-10, s * (40 + 22 * f)], T1 = [-64, s * (66 + 28 * f)], P1 = [-44, s * (52 + 18 * f)], P2 = [-30, s * (30 + 10 * f)], B = [-32, s * 10];
      g.fillStyle = C.wing; g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(W[0], W[1]); g.lineTo(T1[0], T1[1]); g.quadraticCurveTo(-56, s * (58 + 22 * f), P1[0], P1[1]); g.quadraticCurveTo(-40, s * (40 + 12 * f), P2[0], P2[1]); g.quadraticCurveTo(-34, s * 18, B[0], B[1]); g.closePath(); g.fill();
      g.strokeStyle = dark; g.lineWidth = 4; g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(W[0], W[1]); g.lineTo(T1[0], T1[1]); g.moveTo(W[0], W[1]); g.lineTo(P1[0], P1[1]); g.moveTo(W[0], W[1]); g.lineTo(P2[0], P2[1]); g.stroke();
      g.fillStyle = bone; g.beginPath(); g.moveTo(T1[0], T1[1]); g.lineTo(T1[0] - 6, T1[1] + s * 6); g.lineTo(T1[0] + 4, T1[1] + s * 5); g.closePath(); g.fill();
    }
    // body with scale rows and a ridge of plates
    g.fillStyle = scale; g.beginPath(); g.ellipse(0, 0, 36, 24, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; for (const ox of [-24, -12, 0, 12, 24]) { const hh = 24 * Math.sqrt(1 - (ox / 36) ** 2); g.beginPath(); g.arc(ox - 6, 0, hh, -1.2, 1.2); g.stroke(); }
    g.fillStyle = C.col; for (const ox of [-26, -14, -2, 10, 22]) { g.beginPath(); g.moveTo(ox - 5, 0); g.lineTo(ox, -5); g.lineTo(ox + 5, 0); g.lineTo(ox, 5); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.ellipse(-4, -9, 24, 6, 0, 0, 7); g.fill();
    if (el === 'stone') { g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-20, -14); g.lineTo(-8, -4); g.lineTo(-12, 8); g.moveTo(10, -16); g.lineTo(6, -2); g.lineTo(16, 10); g.stroke(); }
    // neck
    for (let i = 0; i < 3; i++) { const x = 34 + i * 11, y = Math.sin(t * 2 + i) * 2.5; g.fillStyle = i % 2 ? scale2 : scale; g.beginPath(); g.arc(x, y, 15 - i * 1.5, 0, 7); g.fill(); g.fillStyle = C.col; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x, y - 4); g.lineTo(x + 4, y); g.lineTo(x, y + 4); g.closePath(); g.fill(); }
    // head: crest spikes sweeping back, two horns, glowing eyes, the jaw and the fang
    const bite = e.attackT > 0 ? (1 - e.attackT / 0.2) : 0, hx = 68;
    g.fillStyle = scale2; for (const [cx, cy, l] of [[hx - 8, -8, 14], [hx - 6, 0, 18], [hx - 8, 8, 14]]) { g.beginPath(); g.moveTo(cx, cy - 4); g.lineTo(cx - l, cy); g.lineTo(cx, cy + 4); g.closePath(); g.fill(); }
    g.strokeStyle = bone; g.lineWidth = 4; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx - 6, s * 9); g.quadraticCurveTo(hx - 14, s * 22, hx - 28, s * 24); g.stroke(); }
    g.fillStyle = scale; g.beginPath(); g.ellipse(hx, 0, 22, 13, 0, 0, 7); g.fill();
    g.fillStyle = scale2; g.beginPath(); g.ellipse(hx + 12, 0, 13, 8, 0, 0, 7); g.fill();
    g.fillStyle = dark; g.beginPath(); g.moveTo(hx + 12, -7 - bite * 4); g.lineTo(hx + 30 + bite * 10, 0); g.lineTo(hx + 12, 7 + bite * 4); g.closePath(); g.fill(); // open maw
    const eg = 0.7 + Math.sin(t * 8) * 0.3;
    for (const s of [-1, 1]) { g.fillStyle = C.eye; g.beginPath(); g.ellipse(hx + 2, s * 6, 3.5, 2.2, s * 0.3, 0, 7); g.fill(); g.fillStyle = `rgba(255,255,255,${eg * 0.5})`; g.beginPath(); g.arc(hx + 3, s * 6, 1.2, 0, 7); g.fill(); }
    g.fillStyle = bone; // the fang itself, and its two lesser brothers
    g.beginPath(); g.moveTo(hx + 18, 2); g.lineTo(hx + 48 + bite * 6, 12 + bite * 4); g.lineTo(hx + 18, 9); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(hx + 18, -3); g.lineTo(hx + 34, -10); g.lineTo(hx + 18, -8); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(hx + 24, 4); g.lineTo(hx + 34, 9); g.lineTo(hx + 24, 8); g.closePath(); g.fill();
    g.fillStyle = dark; g.beginPath(); g.arc(hx + 20, -4, 1.6, 0, 7); g.arc(hx + 20, 4, 1.6, 0, 7); g.fill(); // nostrils
    // element breath at the nostrils
    if (el === 'fire') for (let k = 0; k < 3; k++) { const ph = (t * 1.2 + k * 0.33) % 1; g.fillStyle = `rgba(255,${120 + k * 40},40,${0.6 * (1 - ph)})`; g.beginPath(); g.arc(hx + 26 + ph * 20, (k - 1) * 5 + Math.sin(t * 9 + k) * 2, 3 + ph * 4, 0, 7); g.fill(); }
    else if (el === 'ice') for (let k = 0; k < 4; k++) { const ph = (t * 0.8 + k * 0.25) % 1; g.fillStyle = `rgba(230,245,255,${0.8 * (1 - ph)})`; g.beginPath(); g.arc(hx + 22 + ph * 24, (k - 1.5) * 5, 1.5 + ph * 1.5, 0, 7); g.fill(); }
    else if (el === 'storm') { g.strokeStyle = `rgba(255,250,200,${0.5 + Math.sin(t * 20) * 0.4})`; g.lineWidth = 2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx + 22, s * 4); g.lineTo(hx + 30, s * 10); g.lineTo(hx + 28, s * 16); g.lineTo(hx + 38, s * 22); g.stroke(); } }
    g.restore();
  };
  const setElement = (m, el) => {
    m.element = el; m.elemT = 0; m.fireCd = 0.6; m.iceCd = 0.5; m.stormCd = 0.8;
    const C = EL[el]; floatText(m.x, m.y - m.r - 34, C.cry, C.col, 16); burst(m.x, m.y, C.col, 30, 180);
  };
  HOOKS.hit.push((m, dmg) => {
    if (m.type !== 'the_fang') return;
    const C = EL[m.element || 'fire']; burst(m.x, m.y - 10, C.col, 5, 80);
    if (m.element === 'stone') { m.stoneTip = (m.stoneTip || 0) - 1; if (m.stoneTip <= 0) { m.stoneTip = 90; floatText(player.x, player.y - 40, 'Stone skin: wait it out', '#b0a08a', 14); } }
  });

  // ---------- gate, heat, ice patches ----------
  const openGate = quiet => {
    for (let x = GATE.x0; x <= GATE.x1; x++) if (tileAt(x, GATE.y) === LAIR_GATE) changeTile(x, GATE.y, T.CAVE);
    FQ().gateOpen = true;
    if (!quiet) { burst(tc(GATE.x), tc(GATE.y), '#ff6a1a', 40, 200); burst(tc(GATE.x), tc(GATE.y), '#3a3a42', 20, 120); say('The gate grinds open. Heat rolls out like a wall. Somewhere below, something enormous breathes.', 'The Voice'); }
    save();
  };
  const heatDamage = () => {
    if (player.mech) { player.mech.hp -= 2; floatText(player.x, player.y - 24, '-2 heat (walker)', '#ff8a5a'); if (player.mech.hp <= 0) wreckMech(); return; }
    player.hp -= 2; player.sinceHurt = 0; floatText(player.x, player.y - 24, '-2 heat', '#ff8a5a');
    if (player.hp <= 0) die();
  };
  const freeze = (tx, ty) => { changeTile(tx, ty, ICE); mapDiffs.delete(idx(tx, ty)); ICE_PATCHES.push({ tx, ty, t: 6 }); miniDirty = true; burst(tc(tx), tc(ty), '#bfe3ff', 8, 60); };
  const thaw = p => { if (tileAt(p.tx, p.ty) === ICE) { setTile(p.tx, p.ty, T.CAVE); mapDiffs.delete(idx(p.tx, p.ty)); miniDirty = true; } };
  const thawAll = () => { for (const p of ICE_PATCHES) thaw(p); ICE_PATCHES.length = 0; };
  const freezeAround = () => {
    const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE), cands = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (tileAt(ptx + dx, pty + dy) === T.CAVE && inLair(ptx + dx, pty + dy)) cands.push([ptx + dx, pty + dy]);
    for (let n = 0; n < 3 && cands.length; n++) { const i = Math.floor(Math.random() * cands.length); const [x, y] = cands.splice(i, 1)[0]; freeze(x, y); }
    floatText(player.x, player.y - 40, 'The ground freezes!', '#bfe3ff', 14);
  };
  const breathe = m => {
    const dx = player.x - m.x, dy = player.y - m.y, d = Math.hypot(dx, dy) || 1, sp = 320;
    FIREBALLS.push({ kind: 'fangfire', x: m.x + dx / d * 70, y: m.y + dy / d * 70, vx: dx / d * sp, vy: dy / d * sp, t: 0, life: d / sp + 0.5, dmg: rint(12, 24) });
    m.attackT = 0.25; m.fired = (m.fired || 0) + 1; burst(m.x + dx / d * 70, m.y + dy / d * 70, '#ff8a1a', 10, 90);
  };

  // the summoning: the horn on the circle wakes The Fang at its home, roaring
  function summonFang() {
    const fq = FQ(), m = fang(); if (!m) return false;
    fq.summoned = true;
    const sp = safeSpot(m.home.x, m.home.y, m.r, 'beast') || m.home;
    m.dead = false; m.deadT = 0; m.hp = m.maxHp; m.x = sp.x; m.y = sp.y; m.state = 'idle'; m.angry = true; m.stunT = 0; m.element = 'fire'; m.elemT = 0; m.fireCd = 1.5;
    levelBanner = { text: 'THE FANG ANSWERS', sub: 'Only legends have heard of it', t: 4.5 }; sfx('boss');
    for (const [c, n, sp2] of [['#ff6a1a', 60, 280], ['#b58cff', 40, 220], ['#3a3a42', 30, 160]]) burst(m.x, m.y, c, n, sp2);
    burst(player.x, player.y, '#b58cff', 20, 120); floatText(m.x, m.y - m.r - 40, 'ROAR', '#ff6a1a', 22);
    say('The horn sounds and the lava answers. The ground splits, and THE FANG rises out of it, roaring. Now, knight. Now.', 'The Voice');
    save(); return true;
  }

  HOOKS.update.push(dt => {
    const fq = FQ();
    const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
    const inside = player.region === LAIR_NAME;
    if (fq.gateOpen && tileAt(GATE.x, GATE.y) === LAIR_GATE) openGate(true);
    // heat: 2 hp a second without the salve
    if (inside && !player.dead && !salved()) {
      if (!fq.warned) { fq.warned = true; say('The heat. Without a salve against fire it will cook you where you stand. Get out, knight, or be quick.', 'The Voice'); save(); }
      heatT += dt; if (heatT >= 1) { heatT -= 1; heatDamage(); }
    } else heatT = 0;
    // ice underfoot slows the knight
    const onIce = !player.dead && !player.mech && tileAt(ptx, pty) === ICE;
    if (onIce && player.speed === 175) player.speed = 90; else if (!onIce && player.speed === 90) player.speed = 175;
    for (const p of ICE_PATCHES) { p.t -= dt; if (p.t <= 0) thaw(p); }
    for (let i = ICE_PATCHES.length - 1; i >= 0; i--) if (ICE_PATCHES[i].t <= 0) ICE_PATCHES.splice(i, 1);
    // the boss: slain once, slain for good (no 15-minute farm of a 3,000-coin weapon; a reload spawns it, this puts it back down)
    const m = fang();
    if (m && fq.slain) { if (!m.dead) { m.dead = true; m.deadT = 5; } m.respawnT = Infinity; }
    else if (m && !fq.summoned) { if (!m.dead) { m.dead = true; m.deadT = 5; } m.respawnT = Infinity; } // it sleeps under the lava until the dragon horn sounds on the circle
    if (m && !m.dead) {
      if (!m.element) { m.element = 'fire'; m.elemT = 0; }
      m.elemT = (m.elemT || 0) + dt;
      if (m.elemT >= 25) setElement(m, ELEMENTS[(ELEMENTS.indexOf(m.element) + 1) % ELEMENTS.length]);
      const dp = dist(m.x, m.y, player.x, player.y);
      const live = !window.__peace && !player.dead && dp <= MONSTER_DEFS.the_fang.sight;
      if (live && !fq.seen) { fq.seen = true; say('THE FANG. Only legends have heard of it. Now you have. Watch its colour, knight: it tells you what is coming.', 'The Voice'); save(); }
      MONSTER_DEFS.the_fang.maxHit = m.element === 'stone' ? 48 : 32;
      if (m.element === 'stone') m.hp = Math.min(m.maxHp, m.hp + 8 * dt);
      if (m.element === 'fire') { m.fireCd = (m.fireCd ?? 0) - dt; if (live && m.fireCd <= 0) { m.fireCd = 2; breathe(m); } }
      if (m.element === 'ice') { m.iceCd = (m.iceCd ?? 0) - dt; if (live && m.iceCd <= 0) { m.iceCd = 7; freezeAround(); } }
      if (m.element === 'storm') { m.stormCd = (m.stormCd ?? 0) - dt; if (live && m.stormCd <= 0) { m.stormCd = 4; STRIKES.push({ x: player.x, y: player.y, t: 0, hit: false }); } }
    } else MONSTER_DEFS.the_fang.maxHit = 32;
    // fireballs
    for (const p of FIREBALLS) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      particles.push({ x: p.x + (Math.random() - 0.5) * 8, y: p.y + (Math.random() - 0.5) * 8, vx: -p.vx * 0.1 + (Math.random() - 0.5) * 40, vy: -p.vy * 0.1 - 20, t: 0.3 + Math.random() * 0.2, color: Math.random() < 0.5 ? '#ff8a1a' : '#ffd166', r: 1.5 + Math.random() * 1.5 });
      const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
      if (SOLID.has(tileAt(tx, ty))) { p.done = true; burst(p.x, p.y, '#ff8a1a', 12, 100); continue; }
      if (!player.dead && dist(p.x, p.y, player.x, player.y) < player.r + 12) {
        const dmg = salved() ? Math.ceil(p.dmg / 2) : p.dmg; const m2 = fang(); if (m2) m2.fireHits = (m2.fireHits || 0) + 1;
        hurtPlayer(dmg, p.x, p.y, true); if (salved()) floatText(player.x, player.y - 40, 'salve', '#7ee787', 12);
        p.done = true; burst(p.x, p.y, '#ff8a1a', 18, 140); continue;
      }
      if (p.t >= p.life) { p.done = true; burst(p.x, p.y, '#ff8a1a', 8, 60); }
    }
    for (let i = FIREBALLS.length - 1; i >= 0; i--) if (FIREBALLS[i].done) FIREBALLS.splice(i, 1);
    // lightning
    for (const s of STRIKES) {
      s.t += dt;
      if (!s.hit && s.t >= 1) {
        s.hit = true; burst(s.x, s.y, '#fff7c0', 24, 200); burst(s.x, s.y, '#d8c8ff', 16, 120);
        if (!player.dead && dist(player.x, player.y, s.x, s.y) < 40) { const m2 = fang(); if (m2) m2.strikeHits = (m2.strikeHits || 0) + 1; hurtPlayer(rint(18, 30), s.x, s.y + 1, true); }
        else floatText(s.x, s.y - 20, 'dodged', '#d8c8ff', 13);
      }
      if (s.t >= 1.35) s.done = true;
    }
    for (let i = STRIKES.length - 1; i >= 0; i--) if (STRIKES[i].done) STRIKES.splice(i, 1);
    // the end of the story: home to the castle, then the credits
    if (quest.stage === 15 && player.region === 'Castle Thistledown') advanceQuest(16);
    if (credits) { credits.t -= dt; if (credits.t <= 0) { const next = credits.lines.shift(); if (next) { levelBanner = { text: next[0], sub: next[1], t: 3 }; credits.t = 3; } else credits = null; } }
  });
  // death: an enormous burst, the banner, the loot, and the story moves on
  HOOKS.kill.push(m => {
    if (m.type !== 'the_fang') return;
    const fq = FQ(); const first = !fq.slain; fq.slain = true;
    for (const [c, n, s] of [['#ff6a1a', 60, 280], ['#8fd3ff', 40, 220], ['#d8c8ff', 40, 220], ['#b0a08a', 30, 160], ['#f5c542', 50, 320]]) burst(m.x, m.y, c, n, s);
    levelBanner = { text: 'THE FANG IS SLAIN', sub: 'Chapter 5 complete', t: 5 };
    const loot = first ? [['coins', 1000], ['fang_of_the_fang', 1], ['mithril_bar', 4]] : []; if (first && ITEMS.dragon_scale) loot.push(['dragon_scale', 10]); // the legendary loot drops once
    for (const [id, q] of loot) if (ITEMS[id]) drops.push({ x: m.x + rint(-30, 30), y: m.y + rint(-30, 30), id, qty: q, t: 0, rare: id === 'fang_of_the_fang' });
    say('The Fang falls. The mountain shakes with it. Its great tooth lies loose in the ash: take it. No blade in the Fanglands will bite like it.', 'The Voice');
    thawAll(); FIREBALLS.length = 0; STRIKES.length = 0; m.element = 'fire'; m.elemT = 0; MONSTER_DEFS.the_fang.maxHit = 32;
    if (quest.stage < 15) advanceQuest(15); else save();
  });

  // the Duke learns of the kill from you, not from your footsteps: at stage 15 talking to him ends the story (the castle-entry trigger stays as a fallback)
  HOOKS.talkBefore.duke = n => {
    if (quest.stage === 14 && window.DRAGON_KILLERS) return window.DRAGON_KILLERS.duke(n); // 37-dragonkillers: the Song, the group, the horn
    if (quest.stage === 15) { say('The Fang? Slain? Then the old songs were waiting for you, knight. Thistledown owes you more than a keep can hold. The Dragon Killers will be sung about for a hundred years.', n.name); say('Sit. Eat. Tomorrow the whole town hears it from my mouth. Tonight, hear it from me: thank you.', n.name); advanceQuest(16); return true; }
    if (quest.stage >= 16) { say('The knight of legend, in my hall. Rest, friend. The Fanglands are at peace because of you.', n.name); return true; }
    return false;
  };
  // ---------- main quest, stages 14–16 ----------
  if (!HOOKS.mainQuest[14]) HOOKS.mainQuest[14] = { text: () => "Find The Fang's lair: a sealed gate at the far south of dragon country." };
  HOOKS.mainQuest[15] = { text: () => 'The Fang is slain. The Dragon Killers ride home: return to Duke Ferrin.', onEnter: () => {
    say('It is done. The dragon of legend is dead by your hand. Go home, knight. Thistledown should hear it from you.', 'The Voice');
  } };
  HOOKS.mainQuest[16] = { text: () => 'You are the knight of legend. Fanglands is at peace. (More is being built.)', onEnter: () => {
    say('You walked out of a cave with a wooden sword. You walk into this castle with the tooth of The Fang.', 'The Voice');
    say('The goblins are broken, Hollowford breathes, the dwarves forge again, and the dragon of legend is a story children will tell. You are the knight of legend. The Fanglands are at peace.', 'The Voice');
    levelBanner = { text: 'FANGLANDS', sub: 'Chapter 5 · The Fang', t: 3 };
    credits = { t: 3, lines: [['A game by Cohen', 'with a little help'], ['Thank you for playing', 'More is being built']] };
    burst(player.x, player.y, '#f5c542', 40, 200);
  } };

  // ---------- use: the gate, the hoard, the chest, the scenery ----------
  HOOKS.use.push((t, tx, ty) => {
    if (t === LAIR_GATE) { if (quest.stage >= 14) openGate(false); else say('Sealed. The heat behind it would cook a knight in his plate.', 'The Gate'); return true; }
    if (t === SUMMON_CIRCLE) {
      const fq = FQ();
      if (fq.slain) { say('The circle is cold. What it called is dead, and stays dead.', 'Summoning circle'); return true; }
      if (fq.summoned && fang() && !fang().dead) { say('The runes burn. The Fang is already awake, and it is behind you.', 'Summoning circle'); return true; }
      if (!countItem('dragon_horn')) { say('A ring of runes worn into the stone. Something is meant to be sounded here. The Duke would know.', 'Summoning circle'); return true; }
      summonFang(); return true;
    }
    if (t === HOARD) {
      const fq = FQ();
      if (!fq.slain) { say("The Fang's hoard. Gold from a hundred kingdoms, and it sleeps on every coin. Not yet.", 'The Voice'); return true; }
      const key = tx + ',' + ty;
      if (fq.looted.includes(key)) { notify('You have taken what you can carry from this pile.'); return true; }
      fq.looted.push(key); giveOrDrop('coins', 60, player.x, player.y); burst(tc(tx), tc(ty), '#f5c542', 14, 80); save(); return true;
    }
    if (t === FANG_CHEST) {
      const fq = FQ();
      if (!fq.slain) { say('An iron chest wrapped in chains, and the dragon between you and it. Slay The Fang first.', 'The Voice'); return true; }
      if (fq.chest) { notify('Empty. The legend is yours now.'); return true; }
      fq.chest = true;
      for (const [id, q] of [['coins', 500], ['mithril_bar', 2], ['steel_bar', 3], ['dragon_scale', 5]]) if (ITEMS[id]) giveOrDrop(id, q, player.x, player.y);
      say("The Fang's chest. Coins from kingdoms that no longer exist, bars of mithril, and the chains fall away in your hands.", 'The Voice');
      burst(tc(tx), tc(ty), '#f5c542', 24, 120); save(); return true;
    }
    if (t === MAGMA) { notify('Magma. It would melt a sword to a puddle.'); return true; }
    if (t === OBSIDIAN) { notify('A pillar of obsidian. Cold black glass, warm to the touch.'); return true; }
    if (t === BONES) { notify('Bones of the knights who came before. Their armour is a puddle in the ash.'); return true; }
    return false;
  });

  // ---------- world ----------
  HOOKS.world.push((rnd, api) => {
    MAGMA_TILES.length = 0; const set = api.setTile;
    for (let y = LAIR.y0; y <= LAIR.y1; y++) for (let x = LAIR.x0; x <= LAIR.x1; x++) { const edge = x === LAIR.x0 || x === LAIR.x1 || y === LAIR.y0 || y === LAIR.y1; set(x, y, edge ? T.WALL : T.CAVE); }
    for (let x = LAIR.x0 + 1; x < LAIR.x1; x++) if (x < 16 || x > 20) set(x, 130, T.WALL);       // the hoard room wall, five tiles open in the middle
    for (let y = 131; y <= 137; y++) for (let x = 3; x <= 33; x++) if (x <= 7 || x >= 29) set(x, y, T.WALL);
    for (let x = GATE.x0; x <= GATE.x1; x++) set(x, GATE.y, LAIR_GATE);
    for (const [x, y] of PILLARS) set(x, y, OBSIDIAN);
    for (const [x, y] of MAGMA_SPOTS) { set(x, y, MAGMA); MAGMA_TILES.push([x, y]); }
    for (let i = 0; i < 40; i++) { const x = 4 + Math.floor(rnd() * 29), y = 110 + Math.floor(rnd() * 19); if (api.tileAt(x, y) === T.CAVE && (x < 15 || x > 21)) set(x, y, BONES); }
    for (const [x, y] of HOARD_SPOTS) set(x, y, HOARD);
    set(CHEST_T.x, CHEST_T.y, FANG_CHEST);
    set(CIRCLE_T.x, CIRCLE_T.y, SUMMON_CIRCLE);
    // nothing else spawns in the lair; the dragon sleeps at its centre
    for (let i = MONSTER_SPAWNS.length - 1; i >= 0; i--) { const s = MONSTER_SPAWNS[i]; if (inLair(s.tx, s.ty)) MONSTER_SPAWNS.splice(i, 1); }
    api.spawnList('the_fang', [[FANG_HOME.x, FANG_HOME.y]]);
  });

  // ---------- drawing ----------
  function drawMagmaTile(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, cx = tc(tx), cy = tc(ty), v = (tx * 7 + ty * 13) % 3, gl = 0.55 + Math.sin(time * 3 + tx * 1.3 + ty * 0.7) * 0.3;
    g.fillStyle = '#2a2226'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#3a3034'; for (const [ox, oy, r] of [[8 + v * 6, 10, 9], [34 - v * 4, 30, 8], [16, 38, 6], [38, 8, 5]]) { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.7, v, 0, 7); g.fill(); }
    const gr = g.createRadialGradient(cx, cy, 4, cx, cy, 34); gr.addColorStop(0, `rgba(255,120,30,${gl * 0.5})`); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(x, y, TILE, TILE);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const cracks = [[[4, 12], [16, 22], [14, 34], [28, 44]], [[44, 6], [30, 18], [34, 30], [22, 40]], [[6, 40], [18, 28], [30, 26], [42, 14]]];
    const trace = c => { g.beginPath(); c.forEach(([px, py], i) => i ? g.lineTo(x + px, y + py) : g.moveTo(x + px, y + py)); g.stroke(); };
    for (let k = 0; k < 2; k++) { g.strokeStyle = `rgba(255,${90 + k * 40},20,${gl})`; g.lineWidth = 5 - k * 2; trace(cracks[(v + k) % 3]); }
    g.strokeStyle = `rgba(255,230,120,${gl})`; g.lineWidth = 1.2; trace(cracks[v]);
    for (let k = 0; k < 2; k++) { const ph = (time * 0.5 + tx * 0.31 + ty * 0.17 + k * 0.5) % 1; g.fillStyle = `rgba(255,170,60,${0.7 * (1 - ph)})`; g.beginPath(); g.arc(cx + Math.sin(time * 2 + k * 3 + tx) * 8, cy - ph * 30, 1.5 + (1 - ph), 0, 7); g.fill(); }
  }
  function drawIceTile(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = 'rgba(225,242,255,0.62)'; g.fillRect(x, y, TILE, TILE);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 6, y + 10); g.lineTo(x + 20, y + 22); g.lineTo(x + 16, y + 36); g.moveTo(x + 30, y + 6); g.lineTo(x + 26, y + 20); g.lineTo(x + 40, y + 30); g.stroke();
    g.fillStyle = `rgba(255,255,255,${0.35 + Math.sin(time * 4 + tx) * 0.2})`; g.beginPath(); g.ellipse(x + 30, y + 14, 8, 3, -0.6, 0, 7); g.fill();
    g.strokeStyle = 'rgba(160,210,240,0.8)'; g.lineWidth = 1; g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
  }
  function drawPillar(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + 14, 20, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#15131a'; g.beginPath(); g.moveTo(cx - 14, cy + 14); g.lineTo(cx - 11, cy - 46); g.lineTo(cx + 11, cy - 46); g.lineTo(cx + 14, cy + 14); g.closePath(); g.fill();
    g.fillStyle = 'rgba(120,90,160,0.25)'; g.fillRect(cx - 9, cy - 44, 5, 56);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(cx - 6, cy - 46); g.lineTo(cx - 2, cy - 46); g.lineTo(cx + 2, cy + 10); g.lineTo(cx - 4, cy + 10); g.closePath(); g.fill();
    g.fillStyle = `rgba(255,120,40,${0.15 + Math.sin(time * 3 + tx) * 0.08})`; g.fillRect(cx + 4, cy - 30, 4, 40); // magma light on the glass
    g.fillStyle = '#221e2a'; g.beginPath(); g.ellipse(cx, cy - 46, 11, 4, 0, 0, 7); g.fill();
  }
  function drawBones(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), v = (tx * 5 + ty * 3) % 3;
    g.save(); g.translate(cx, cy); g.rotate(v * 1.1);
    g.fillStyle = '#d9d0c0'; g.beginPath(); g.arc(-10, -6, 7, 0, 7); g.fill(); g.fillRect(-14, -1, 8, 5);
    g.fillStyle = '#2a2226'; g.beginPath(); g.arc(-12, -7, 2, 0, 7); g.arc(-7, -7, 2, 0, 7); g.fill();
    g.strokeStyle = '#d9d0c0'; g.lineWidth = 3; g.lineCap = 'round'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(2 + k * 6, -8); g.quadraticCurveTo(10 + k * 6, 0, 2 + k * 6, 10); g.stroke(); }
    g.beginPath(); g.moveTo(-4, 12); g.lineTo(14, 16); g.stroke();
    g.restore();
  }
  function drawHoard(g, tx, ty, looted) {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = '#c9a02a'; g.beginPath(); g.ellipse(cx, cy + 8, 20, 12, 0, 0, 7); g.fill();
    g.fillStyle = '#f5c542'; g.beginPath(); g.ellipse(cx, cy, 16, 10, 0, 0, 7); g.fill();
    if (!looted) { g.beginPath(); g.ellipse(cx - 2, cy - 8, 10, 6, 0, 0, 7); g.fill(); }
    g.fillStyle = '#fff2a8'; for (const [ox, oy] of [[-8, 2], [4, -6], [8, 4], [-2, -2]]) { g.beginPath(); g.arc(cx + ox, cy + oy, 2, 0, 7); g.fill(); }
    const gem = (tx + ty) % 3; g.fillStyle = ['#e63946', '#58a6ff', '#7ee787'][gem]; g.beginPath(); g.moveTo(cx + 6, cy - 10); g.lineTo(cx + 10, cy - 6); g.lineTo(cx + 6, cy - 2); g.lineTo(cx + 2, cy - 6); g.closePath(); g.fill();
    const s = Math.sin(time * 5 + tx * 2 + ty); if (s > 0.8) { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5; const sx = cx - 6 + gem * 5, sy = cy - 4; g.beginPath(); g.moveTo(sx - 5, sy); g.lineTo(sx + 5, sy); g.moveTo(sx, sy - 5); g.lineTo(sx, sy + 5); g.stroke(); }
  }
  function drawCircle(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), fq = FQ(), horn = countItem('dragon_horn') > 0 && !fq.slain && !fq.summoned, gl = horn ? 0.6 + Math.sin(time * 3) * 0.3 : 0.25 + Math.sin(time * 1.5) * 0.1;
    const gr = g.createRadialGradient(cx, cy, 4, cx, cy, 40); gr.addColorStop(0, `rgba(181,140,255,${gl * 0.5})`); gr.addColorStop(1, 'rgba(181,140,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 40, 0, 7); g.fill();
    g.strokeStyle = `rgba(181,140,255,${gl})`; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, 18, 0, 7); g.stroke(); g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, 11, 0, 7); g.stroke();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + time * 0.3; g.beginPath(); g.moveTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11); g.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18); g.stroke(); }
    g.fillStyle = `rgba(245,240,216,${gl})`; g.beginPath(); g.moveTo(cx - 4, cy - 6); g.lineTo(cx + 1, cy + 6); g.lineTo(cx + 3, cy - 6); g.closePath(); g.fill(); // a fang carved at the centre
    if (horn) for (let k = 0; k < 3; k++) { const ph = (time * 0.6 + k * 0.33) % 1; g.fillStyle = `rgba(181,140,255,${0.7 * (1 - ph)})`; g.beginPath(); g.arc(cx + Math.sin(time * 2 + k * 2) * 10, cy - ph * 36, 2, 0, 7); g.fill(); }
  }
  function drawFangChest(g, tx, ty, opened) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 8, y + 36, 32, 6);
    g.fillStyle = '#3a3a42'; g.fillRect(x + 7, y + 12, 34, 26); g.fillStyle = opened ? '#1b1b20' : '#2e2e36'; g.fillRect(x + 7, y + 8, 34, 12);
    g.fillStyle = '#c9a02a'; g.fillRect(x + 11, y + 8, 4, 30); g.fillRect(x + 33, y + 8, 4, 30); g.fillRect(x + 7, y + 19, 34, 3);
    if (!opened) { g.strokeStyle = '#8f96a3'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 4, y + 30); g.lineTo(x + 44, y + 16); g.moveTo(x + 4, y + 16); g.lineTo(x + 44, y + 30); g.stroke(); g.fillStyle = '#f5c542'; g.fillRect(x + 21, y + 20, 6, 8); }
    else { g.fillStyle = `rgba(245,197,66,${0.3 + Math.sin(time * 3) * 0.15})`; g.fillRect(x + 10, y + 12, 28, 6); }
    g.strokeStyle = '#1b1b20'; g.lineWidth = 1; g.strokeRect(x + 7, y + 8, 34, 30);
  }
  function drawGate(g, open) {
    const x = GATE.x0 * TILE, y = GATE.y * TILE, w = 3 * TILE;
    if (!open) {
      g.fillStyle = '#26262e'; g.fillRect(x + 2, y + 2, w - 4, TILE - 4); g.fillStyle = '#3a3a42'; g.fillRect(x + 2, y + 2, w - 4, 6);
      const gl = 0.5 + Math.sin(time * 3) * 0.3;
      g.strokeStyle = `rgba(255,90,20,${gl})`; g.lineWidth = 3; g.beginPath(); g.moveTo(x + w / 2, y + 2); g.lineTo(x + w / 2 - 3, y + 18); g.lineTo(x + w / 2 + 3, y + 30); g.lineTo(x + w / 2, y + TILE - 2); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; for (const [ax, ay, bx, by] of [[10, 8, 30, 26], [30, 26, 22, 42], [w - 12, 10, w - 34, 24], [w - 34, 24, w - 40, 40]]) { g.beginPath(); g.moveTo(x + ax, y + ay); g.lineTo(x + bx, y + by); g.stroke(); }
      g.fillStyle = '#4a4a52'; for (const by of [12, 30]) { g.fillRect(x + 4, y + by, w / 2 - 8, 5); g.fillRect(x + w / 2 + 4, y + by, w / 2 - 8, 5); }
      g.fillStyle = '#8f96a3'; for (const bx of [10, 40, 66, w - 10, w - 40, w - 66]) for (const by of [14, 32]) { g.beginPath(); g.arc(x + bx, y + by + 1, 1.8, 0, 7); g.fill(); }
      g.fillStyle = '#f5f0d8'; g.beginPath(); g.moveTo(x + w / 2 - 12, y + 12); g.lineTo(x + w / 2 - 3, y + 40); g.lineTo(x + w / 2 - 5, y + 12); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x + w / 2 + 12, y + 12); g.lineTo(x + w / 2 + 3, y + 40); g.lineTo(x + w / 2 + 5, y + 12); g.closePath(); g.fill();
    } else {
      const gl = 0.2 + Math.sin(time * 2) * 0.08; g.fillStyle = `rgba(255,120,40,${gl})`; g.fillRect(x, y, w, TILE);
      for (const s of [-1, 1]) { g.save(); g.translate(s < 0 ? x : x + w, y + 2); g.rotate(-s * 1.2); g.fillStyle = '#26262e'; g.fillRect(s < 0 ? 0 : -TILE * 1.4, -5, TILE * 1.4, 10); g.fillStyle = '#4a4a52'; g.fillRect(s < 0 ? 0 : -TILE * 1.4, -2, TILE * 1.4, 3); g.restore(); }
    }
  }
  function drawFireball(g, p) {
    const a = Math.atan2(p.vy, p.vx); g.save(); g.translate(p.x, p.y);
    const gr = g.createRadialGradient(0, 0, 2, 0, 0, 26); gr.addColorStop(0, 'rgba(255,240,180,0.9)'); gr.addColorStop(0.4, 'rgba(255,140,40,0.7)'); gr.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.fill();
    g.rotate(a); g.fillStyle = '#ff8a1a'; g.beginPath(); g.moveTo(10, 0); g.quadraticCurveTo(0, -9, -22 - Math.sin(time * 30) * 4, -3); g.quadraticCurveTo(-14, 0, -22 - Math.cos(time * 25) * 4, 3); g.quadraticCurveTo(0, 9, 10, 0); g.closePath(); g.fill();
    g.fillStyle = '#ffe066'; g.beginPath(); g.arc(2, 0, 6, 0, 7); g.fill(); g.restore();
  }
  function drawStrikeWarning(g, s) {
    const a = 0.35 + Math.sin(s.t * 20) * 0.25 * s.t;
    g.strokeStyle = `rgba(230,220,255,${a})`; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.arc(s.x, s.y, 40, 0, 7); g.stroke(); g.setLineDash([]);
    g.fillStyle = `rgba(200,180,255,${0.12 + s.t * 0.25})`; g.beginPath(); g.arc(s.x, s.y, 40 * Math.min(1, s.t), 0, 7); g.fill();
  }
  function drawStrikeBolt(g, s) {
    const k = clamp(1 - (s.t - 1) / 0.35, 0, 1);
    g.beginPath(); g.moveTo(s.x + 30, s.y - 400); g.lineTo(s.x - 10, s.y - 200); g.lineTo(s.x + 14, s.y - 120); g.lineTo(s.x - 6, s.y - 40); g.lineTo(s.x, s.y);
    g.strokeStyle = `rgba(200,180,255,${k * 0.6})`; g.lineWidth = 10; g.stroke(); g.strokeStyle = `rgba(255,255,255,${k})`; g.lineWidth = 4; g.stroke();
    g.fillStyle = `rgba(255,255,255,${k * 0.6})`; g.beginPath(); g.ellipse(s.x, s.y, 40, 16, 0, 0, 7); g.fill();
  }
  // darkness: an offscreen layer with holes cut by destination-out (the core's cave technique). Drawn as the last
  // world item so it sits over the lair but under the HUD. Lights: the knight, every magma crack, the boss, fireballs, lightning, the open gate.
  const fangDark = document.createElement('canvas');
  function drawDark(g) {
    const inside = player.region === LAIR_NAME;
    const rx = LAIR.x0 * TILE - cam.x, ry = LAIR.y0 * TILE - cam.y, rw = (LAIR.x1 - LAIR.x0 + 1) * TILE, rh = (LAIR.y1 - LAIR.y0 + 1) * TILE;
    if (!inside && (rx > VW || ry > VH || rx + rw < 0 || ry + rh < 0)) return;
    if (fangDark.width !== canvas.width || fangDark.height !== canvas.height) { fangDark.width = canvas.width; fangDark.height = canvas.height; }
    const dg = fangDark.getContext('2d');
    dg.setTransform(DPR, 0, 0, DPR, 0, 0); dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, VW, VH);
    dg.fillStyle = inside ? 'rgba(6,3,10,0.72)' : 'rgba(6,3,10,0.6)';
    if (inside) dg.fillRect(0, 0, VW, VH); else dg.fillRect(rx, ry, rw, rh);
    dg.globalCompositeOperation = 'destination-out';
    const lights = [];
    if (inside) lights.push({ x: player.x, y: player.y, r: 150 });
    for (const [mx, my] of MAGMA_TILES) lights.push({ x: tc(mx), y: tc(my), r: 80 + Math.sin(time * 3 + mx * 1.3 + my * 0.7) * 14 });
    const m = fang(); if (m && !m.dead) lights.push({ x: m.x, y: m.y, r: 210 + Math.sin(time * 4) * 20 });
    for (const p of FIREBALLS) lights.push({ x: p.x, y: p.y, r: 70 });
    for (const s of STRIKES) if (s.t >= 1) lights.push({ x: s.x, y: s.y, r: 240 });
    if (FQ().gateOpen) lights.push({ x: tc(GATE.x), y: tc(GATE.y), r: 120 });
    lights.push({ x: tc(CIRCLE_T.x), y: tc(CIRCLE_T.y), r: 90 });
    for (const L of lights) {
      const sx = L.x - cam.x, sy = L.y - cam.y; if (sx < -L.r || sy < -L.r || sx > VW + L.r || sy > VH + L.r) continue;
      const gr = dg.createRadialGradient(sx, sy, 8, sx, sy, L.r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = gr; dg.beginPath(); dg.arc(sx, sy, L.r, 0, 7); dg.fill();
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(fangDark, 0, 0); g.restore();
  }
  const USABLE = [LAIR_GATE, HOARD, FANG_CHEST, MAGMA, OBSIDIAN, BONES, SUMMON_CIRCLE];
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
    if (x1 < LAIR.x0 || x0 > LAIR.x1 || y1 < LAIR.y0 || y0 > LAIR.y1) return;
    const fq = FQ();
    for (let ty = Math.max(y0, LAIR.y0); ty <= Math.min(y1, LAIR.y1); ty++) for (let tx = Math.max(x0, LAIR.x0); tx <= Math.min(x1, LAIR.x1); tx++) {
      const t = tileAt(tx, ty);
      if (t === MAGMA) items.push({ y: -1e8 + ty * TILE, draw: () => drawMagmaTile(g, tx, ty) });          // ground overlays sort before anything standing
      else if (t === ICE) items.push({ y: -1e8 + ty * TILE, draw: () => drawIceTile(g, tx, ty) });
      else if (t === BONES) items.push({ y: -1e8 + ty * TILE + 1, draw: () => drawBones(g, tx, ty) });
      else if (t === OBSIDIAN) items.push({ y: ty * TILE + TILE - 4, draw: () => drawPillar(g, tx, ty) });
      else if (t === HOARD) items.push({ y: ty * TILE + TILE - 6, draw: () => drawHoard(g, tx, ty, fq.looted.includes(tx + ',' + ty)) });
      else if (t === FANG_CHEST) items.push({ y: ty * TILE + TILE - 6, draw: () => drawFangChest(g, tx, ty, fq.chest) });
      else if (t === SUMMON_CIRCLE) items.push({ y: -1e8 + ty * TILE + 2, draw: () => drawCircle(g, tx, ty) });
    }
    if (GATE.y >= y0 && GATE.y <= y1 && GATE.x1 >= x0 && GATE.x0 <= x1) { const open = tileAt(GATE.x, GATE.y) !== LAIR_GATE; items.push({ y: open ? -1e8 + GATE.y * TILE + 2 : GATE.y * TILE + TILE - 4, draw: () => drawGate(g, open) }); }
    for (const p of FIREBALLS) items.push({ y: p.y + 12, draw: () => drawFireball(g, p) });
    for (const s of STRIKES) { if (s.t < 1) items.push({ y: -1e8 + s.y + 3, draw: () => drawStrikeWarning(g, s) }); else items.push({ y: 1e9 - 1, draw: () => drawStrikeBolt(g, s) }); }
    items.push({ y: 1e9, draw: () => drawDark(g) });
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 1, draw: () => {
      const { tx, ty } = frontTile(player);
      if (USABLE.includes(tileAt(tx, ty))) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });
  // boss bar: under the HP box while the dragon is alive and within 12 tiles
  HOOKS.hud.push((g, narrow) => {
    const m = fang(); if (!m || m.dead || dist(m.x, m.y, player.x, player.y) > 12 * TILE) return;
    const C = EL[m.element || 'fire'], w = Math.min(236, VW - 28), h = 48, x = 14;
    const qh = quest.tracked && activeQuests().includes(quest.tracked) ? 54 : 0;
    const _lay = typeof HUD_LAYOUT !== 'undefined' ? HUD_LAYOUT : null; const _touchFloor = (isTouch && _lay && !_lay.short) ? _lay.hotbarY + _lay.hotbarH + 12 : 0; const y = Math.max(HUD.leftY, _touchFloor, 84); // shared left-HUD cursor: under the companion / wanted tags
    HUD.leftY = y + h + 6;
    roundRect(g, x, y, w, h, 10); g.fillStyle = 'rgba(10,14,22,0.82)'; g.fill(); g.strokeStyle = C.col; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#e6edf3'; g.font = `700 14px ${DISPLAY}`; g.textAlign = 'left'; g.fillText('THE FANG', x + 12, y + 19);
    g.fillStyle = C.col; g.font = 'bold 11px sans-serif'; g.textAlign = 'right'; g.fillText(C.name.toUpperCase() + (m.element === 'stone' ? ' · wait it out' : ''), x + w - 12, y + 19);
    g.fillStyle = '#2a2f3a'; roundRect(g, x + 12, y + 27, w - 24, 11, 5); g.fill();
    g.fillStyle = C.col; roundRect(g, x + 12, y + 27, (w - 24) * clamp(m.hp / m.maxHp, 0, 1), 11, 5); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText(`${Math.ceil(m.hp)} / ${m.maxHp}`, x + w / 2, y + 36);
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const fq = FQ(); h.peace(true); FIREBALLS.length = 0; STRIKES.length = 0; thawAll();
    fq.summoned = true; // the boss checks below want the dragon up: the horn-and-circle path is tested by 37-dragonkillers
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const iceCount = () => { let n = 0; for (let y = LAIR.y0; y <= LAIR.y1; y++) for (let x = LAIR.x0; x <= LAIR.x1; x++) if (tileAt(x, y) === ICE) n++; return n; };
    const defXp0 = player.skills.defence.xp; player.skills.defence.xp = XP_TABLE[skillLv('defence')]; // a level-up mid-fight would clamp the test hp back to maxHp
    // lair carved
    { let ring = true, cave = 0, gate = 0, magma = 0, pillars = 0, hoard = 0;
      for (let x = LAIR.x0; x <= LAIR.x1; x++) { const top = tileAt(x, LAIR.y0); if (!(top === T.WALL || top === LAIR_GATE || (top === T.CAVE && x >= GATE.x0 && x <= GATE.x1))) ring = false; if (tileAt(x, LAIR.y1) !== T.WALL) ring = false; }
      for (let y = LAIR.y0; y <= LAIR.y1; y++) { if (tileAt(LAIR.x0, y) !== T.WALL || tileAt(LAIR.x1, y) !== T.WALL) ring = false; }
      for (let y = LAIR.y0 + 1; y < LAIR.y1; y++) for (let x = LAIR.x0 + 1; x < LAIR.x1; x++) { const t = tileAt(x, y); if (t === T.CAVE) cave++; else if (t === MAGMA) magma++; else if (t === OBSIDIAN) pillars++; else if (t === HOARD) hoard++; }
      for (let x = GATE.x0; x <= GATE.x1; x++) if (tileAt(x, GATE.y) === LAIR_GATE || tileAt(x, GATE.y) === T.CAVE) gate++;
      check('fang: lair carved (WALL ring, CAVE interior, gate at (18,108), magma, pillars, hoard, chest, summoning circle)', ring && cave > 400 && gate === 3 && magma === MAGMA_SPOTS.length && pillars === PILLARS.length && hoard === HOARD_SPOTS.length && tileAt(CHEST_T.x, CHEST_T.y) === FANG_CHEST && tileAt(CIRCLE_T.x, CIRCLE_T.y) === SUMMON_CIRCLE && regionAt(18, 120).name === LAIR_NAME, { ring, cave, gate, magma, pillars, hoard }); }
    // the gate refuses below stage 14 and opens at 14
    { const st0 = quest.stage; for (let x = GATE.x0; x <= GATE.x1; x++) if (tileAt(x, GATE.y) !== LAIR_GATE) changeTile(x, GATE.y, LAIR_GATE); fq.gateOpen = false;
      quest.stage = 13; drain(); F.tp(GATE.x, GATE.y - 1); F.face(GATE.x, GATE.y); F.press('KeyE'); F.sim(2, []);
      const sealed = dialog.cur && /^Sealed/.test(dialog.cur.text) && tileAt(GATE.x, GATE.y) === LAIR_GATE && !fq.gateOpen;
      check('fang: gate is sealed below stage 14 (E: "Sealed...")', !!sealed, { st0, text: dialog.cur && dialog.cur.text, tile: tileAt(GATE.x, GATE.y) });
      quest.stage = 14; drain(); F.face(GATE.x, GATE.y); F.press('KeyE'); F.sim(2, []);
      const open = [GATE.x0, GATE.x, GATE.x1].every(x => tileAt(x, GATE.y) === T.CAVE) && fq.gateOpen;
      check('fang: gate opens at stage 14 (E → CAVE tiles, quest.fang.gateOpen)', open, { open, gateOpen: fq.gateOpen, tiles: [GATE.x0, GATE.x, GATE.x1].map(x => tileAt(x, GATE.y)) }); }
    // heat
    { quest.dragons = quest.dragons || {}; quest.dragons.salve = false; fq.warned = false; drain(); F.tp(18, 112); player.hp = 500; heatT = 0; F.sim(75, []);
      const hurt = player.hp === 498 && fq.warned && player.region === LAIR_NAME;
      quest.dragons.salve = true; player.hp = 500; heatT = 0; F.sim(75, []);
      check('fang: heat burns 2 hp a second without the salve, nothing with it (Voice warns once)', hurt && player.hp === 500, { hurt, hp: player.hp, warned: fq.warned, region: player.region }); }
    // the boss and its def
    const m = fang(); const d = MONSTER_DEFS.the_fang;
    { if (m) { m.dead = false; m.hp = m.maxHp; m.element = 'fire'; m.elemT = 0; m.stunT = 0; m.state = 'idle'; F.sim(1, []); } // one tick: maxHit follows the element (48 during stone)
      check('fang: The Fang exists in the lair: lv 80, r 40, 900 hp, att 80, max hit 32, def 55, speed 80, aggro, sight 9, respawn 900, sprite', !!m && d.level === 80 && d.r === 40 && d.hp === 900 && d.att === 80 && d.maxHit === 32 && d.def === 55 && d.speed === 80 && d.aggro && d.sight === 9 * TILE && d.respawn === 900 && Math.floor(m.home.x / TILE) === FANG_HOME.x && Math.floor(m.home.y / TILE) === FANG_HOME.y && typeof HOOKS.drawMonster.the_fang === 'function' && ITEMS.fang_of_the_fang.weapon.str === 40, { found: !!m, home: m && [m.home.x / TILE, m.home.y / TILE] }); }
    if (!m) { player.skills.defence.xp = defXp0; h.peace(false); return; }
    // element rotation
    { m.element = 'fire'; m.elemT = 0; const seen = ['fire']; for (let k = 0; k < 4; k++) { m.elemT = 24.99; F.sim(1, []); seen.push(m.element); }
      check('fang: elements rotate every 25 s: fire → ice → storm → stone → fire', seen.join(',') === 'fire,ice,storm,stone,fire', { seen }); }
    // fire breath
    { quest.dragons.salve = true; F.tp(18, 114); player.hp = 500; m.x = tc(18); m.y = tc(118); m.state = 'idle'; m.stunT = 0; m.element = 'fire'; m.elemT = 0; m.fireCd = 0; m.fired = 0; m.fireHits = 0;
      const hp0 = player.hp; h.peace(false); F.sim(200, []); h.peace(true); FIREBALLS.length = 0;
      check('fang: fire — breathes fireballs every 2 s that hurt (halved by the salve)', m.fired >= 1 && m.fireHits >= 1 && player.hp < hp0, { fired: m.fired, hits: m.fireHits, hp: player.hp, state: m.state }); }
    // ice
    { F.tp(18, 114); player.hp = 500; m.x = tc(18); m.y = tc(118); m.state = 'idle'; m.stunT = 0; m.element = 'ice'; m.elemT = 0; m.iceCd = 0;
      h.peace(false); F.sim(60, []); h.peace(true);
      const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE); let near = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (tileAt(ptx + dx, pty + dy) === ICE) near++;
      const appeared = iceCount() >= 1 && near >= 1 && ICE_PATCHES.length >= 1;
      const patch = ICE_PATCHES[0]; let slowed = false, restored = false; if (patch) { F.tp(patch.tx, patch.ty); F.step([]); slowed = player.speed === 90; F.tp(18, 110); F.step([]); restored = player.speed === 175; } // (18,110) is outside the 2-tile freeze radius
      F.sim(400, []); const gone = iceCount() === 0 && ICE_PATCHES.length === 0 && !mapDiffs.has(idx(patch ? patch.tx : 0, patch ? patch.ty : 0));
      check('fang: ice — 3 patches freeze near the knight, slow to 90, thaw after 6 s, never persist', appeared && slowed && restored && gone, { near, patches: ICE_PATCHES.length, slowed, restored, gone }); }
    // storm
    { F.tp(18, 114); player.hp = 500; m.x = tc(18); m.y = tc(118); m.state = 'idle'; m.stunT = 0; m.element = 'storm'; m.elemT = 0; m.stormCd = 0; m.strikeHits = 0;
      const hp0 = player.hp; h.peace(false); F.sim(2, []); const warned = STRIKES.length === 1 && STRIKES[0].t < 1; h.peace(true); F.sim(70, []);
      check('fang: storm — a warning circle for 1 s, then lightning for 18–30 if you stay', warned && m.strikeHits >= 1 && hp0 - player.hp >= 18 && hp0 - player.hp <= 30, { warned, hits: m.strikeHits, dmg: hp0 - player.hp }); STRIKES.length = 0; }
    // stone
    { m.element = 'stone'; m.elemT = 0; m.hp = 600; F.sim(60, []); const regen = m.hp >= 607 && m.hp <= 609, hard = MONSTER_DEFS.the_fang.maxHit === 48;
      floaters.length = 0; m.stoneTip = 0; hitMonster(m, 5); const tip = floaters.some(f => /Stone skin/.test(f.text));
      m.element = 'fire'; F.sim(1, []); check('fang: stone — regenerates 8 hp/s, bites at 1.5× (max hit 48), tells you to wait it out', regen && hard && tip && MONSTER_DEFS.the_fang.maxHit === 32, { hp: m.hp, hard, tip }); }
    // the kill
    { quest.stage = 14; fq.slain = false; F.tp(18, 114); player.facing = { x: 0, y: 1 }; m.dead = false; m.hp = 1; m.element = 'fire'; m.elemT = 0; m.state = 'idle'; m.stunT = 0; drops = drops.filter(dd => dd.id !== 'fang_of_the_fang');
      for (let i = 0; i < 150 && !m.dead; i++) { m.x = player.x; m.y = player.y + 70; m.stunT = 0; player.attackCd = 0; F.press('Space'); F.sim(3, []); }
      const fangDrop = countItem('fang_of_the_fang') >= 1 || drops.some(dd => dd.id === 'fang_of_the_fang'); const coinDrop = drops.some(dd => dd.id === 'coins' && dd.qty === 1000) || countItem('coins') >= 1000;
      check('fang: kill → THE FANG IS SLAIN, 1000 coins + Fang of the Fang + mithril bars, stage 15', m.dead && fq.slain && fangDrop && coinDrop && quest.stage === 15 && !!levelBanner && levelBanner.text === 'THE FANG IS SLAIN', { dead: m.dead, fangDrop, coinDrop, stage: quest.stage, banner: levelBanner && levelBanner.text }); drops = drops.filter(dd => dd.id !== 'coins' || dd.qty !== 1000); }
    // the hoard opens after the kill
    { const [hx, hy] = HOARD_SPOTS[0]; const c0 = coins(); F.tp(hx, hy + 1); F.face(hx, hy); F.press('KeyE'); F.sim(2, []); const gold = coins() === c0 + 60 || drops.some(dd => dd.id === 'coins' && dd.qty === 60);
      F.tp(CHEST_T.x, CHEST_T.y - 1); F.face(CHEST_T.x, CHEST_T.y); F.press('KeyE'); F.sim(2, []); check('fang: hoard piles and the chest give up their gold once the dragon is dead', gold && fq.looted.length === 1 && fq.chest, { gold, looted: fq.looted.length, chest: fq.chest }); }
    // home to the castle: stage 16 and the credits
    { drain(); F.tp(112, 48); F.sim(3, []); const s16 = quest.stage === 16 && !!levelBanner && levelBanner.text === 'FANGLANDS';
      F.sim(200, []); const b2 = levelBanner && levelBanner.text; F.sim(200, []); const b3 = levelBanner && levelBanner.text;
      check('fang: entering Castle Thistledown at stage 15 → stage 16, credits: FANGLANDS / A game by Cohen / Thank you for playing', s16 && b2 === 'A game by Cohen' && b3 === 'Thank you for playing', { stage: quest.stage, s16, b2, b3 }); }
    { const st = quest.stage; const texts = [15, 16].map(s => { quest.stage = s; return questText('main'); }); quest.stage = st;
      check('fang: quest log reads for stages 15–16', /Duke Ferrin/.test(texts[0]) && /knight of legend/.test(texts[1]), { texts }); }
    player.skills.defence.xp = defXp0; player.hp = Math.min(player.hp, player.maxHp); player.hurtT = 0; thawAll(); FIREBALLS.length = 0; STRIKES.length = 0; credits = null; h.peace(false);
  });
}
