// ============================================================================
// MONSTER LOOK — every monster in the game drawn in the owner-approved new look (78-monsterart.js holds the drawings).
// Where: drawCharacter is wrapped, so every place the game draws a monster gets it at once: the world, dungeons and
// instances, online puppets (75-coop), dying and falling bodies (79-deaths draws them through drawCharacter, and its
// own wrapper sits on top of this one: this file loads before it on purpose), the book's portraits (44-wiki) and the
// admin panel's (76-admin). Anything that is not a monster type (the knight, his machine) goes straight on to the old
// drawCharacter, untouched.
// What a drawing reads: only what a puppet built from the 'mon' snapshot row also has (docs/ONLINE.md; the shared
// world's spec): type, facing, moving, hurt, attackT, stunT, state, hp / maxHp, and `phase` where a boss uses one. The
// walk's clock, a swing's progress and the moment a state began are kept HERE, per monster, from what is drawn (a
// puppet's walkT never moves and its attackT only changes when a row lands). Where a look needs more than the row
// gives, one field per type carries it (LOOK_FIELDS below, and window.MONSTER_LOOK.FIELDS): read off the local monster
// when the game set it, from `phase` when a row brought it, and a plain look when neither is there.
// Cost: the small and common monsters are pictures, made once per type, facing, step, swing frame, state and pixel
// ratio and kept in a byte-budgeted cache (as 82-knightgear does for the crowd of knights); the big rare ones are drawn
// live. window.MONSTER_LOOK is the test handle.
// ============================================================================
const MONSTER_LOOK = (() => {
  const ART = MONSTER_ART, NEW = ART.NEW_DRAW, SIZE = ART.MOB_SIZE, H = ART.H;
  const TWO_PI = Math.PI * 2;
  // seconds a type's attackT counts down from when it strikes (the core's melee and throw set 0.2; these set their own)
  const ATTACK_T = { green_dragon: 0.3, red_dragon: 0.3, the_fang: 0.25, ally_knight: 0.22 };
  const ELEMENTS = ['fire', 'ice', 'storm', 'stone'];
  // the extra state each type's look reads, beyond the row's 14 columns: what it is, its values, and where the game sets
  // it today. A puppet gets it from the row's optional `phase` column (the shared world adds it in phase 1).
  const LOOK_FIELDS = {
    thunderbird: { field: 'phase', values: ['hunt', 'high', 'perch'], means: 'where the storm bird is: hunting low, lifted into the cloud (no sword reaches it), or perched on a mast (hit it now)', setBy: '66-storm (m.phase)' },
    the_fang: { field: 'element', values: ELEMENTS, means: 'the element the Fang is in (its colours, its breath, its motes); a row brings it as phase', setBy: '28-thefang setElement (m.element, every 25 s)' },
    zombie_brute: { field: 'phase', values: ['wind', 'stagger'], means: 'hauling the headstone up for its slam (1.1 s), or dragging it back out of the ground after one (1.7 s)', setBy: '54-graves bruteTick (m.windT > 0 is wind, m.stagT > 0 is stagger)' },
    cinderwight: { field: 'phase', values: ['feed', 'cold'], means: 'its heart is out on the ground and it drinks from it (a dark hole in its chest), or the heart was broken and it is cold (steel blue)', setBy: '46-cinderwight (m.heart alive is feed, m.coldT > 0 is cold)' },
    cinder_heart: { field: 'emberT', values: 'seconds since it was set down (0 to 10)', means: 'how far the ember has burned down', setBy: '46-cinderwight kindle (m.emberT); without it the look counts from when it was first drawn' },
    ally_knight: { field: 'ally', values: ['hale', 'garrick'], means: 'which Dragon Killer it is (Sergeant Hale or Sir Garrick) and the name under him', setBy: '37-dragonkillers spawnAlly (m.ally, m.allyName)' },
    giant_mithril: { field: 'state', values: ['idle', 'stir', 'waking'], means: 'the golem inside the rock: asleep, stirring, breaking out (already a row column)', setBy: '91-royalmine' },
    giant_stormstone: { field: 'state', values: ['idle', 'stir', 'waking'], means: 'as the giant mithril ore', setBy: '91-royalmine' },
    golemling: { field: 'state', values: ['emerge'], means: 'climbing up out of the floor (already a row column)', setBy: '91-royalmine' },
    ginormous_golem: { field: 'state', values: ['sleep', 'rise', 'fight', 'windup', 'slam'], means: 'asleep on his seat, standing up, fighting, fists up, fists down (already a row column)', setBy: '91-royalmine' },
    zombie_calm: { field: 'state', values: ['chase'], means: 'a calm zombie roused into a fight wakes into the fighting zombie (already a row column)', setBy: 'the core (07-update) when it is hit' },
    grave_zombie_calm: { field: 'state', values: ['chase'], means: 'as the calm zombie', setBy: 'the core (07-update)' },
  };
  const ON = { on: true, pics: true };
  const STATS = { live: 0, pics: 0, made: 0, hits: 0, wrapped: 0, passed: 0 };
  const isMonsterKind = kind => typeof kind === 'string' && kind !== 'player' && kind !== 'playermech' && !!NEW[kind] && !!MONSTER_DEFS[kind];

  // ---------- what this file remembers of each monster it draws (never on the monster: it is saved and sent) ----------
  const MEM = new WeakMap();
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  function seedOf(e, type) {
    if (typeof e.nid === 'string' && e.nid) return hashStr(type + ':' + e.nid) * TWO_PI;
    const h = e.home && Number.isFinite(e.home.x) ? e.home : e;
    return hashStr(type + ':' + Math.round(+h.x || 0) + ',' + Math.round(+h.y || 0)) * TWO_PI;
  }
  function memOf(e, type) {
    let s = MEM.get(e);
    if (!s || s.type !== type) {
      s = { type, t: time, walk: 0, sw0: -1e9, swDur: 0.2, prevAtk: 0, ph: null, phAt: time, born: time, seed: seedOf(e, type) };
      MEM.set(e, s);
    }
    return s;
  }

  // ---------- the view: the sample's `e`, built from what the monster (or a puppet's row) has ----------
  function stateField(e, type) {
    // the one extra field each type reads (LOOK_FIELDS); a row's `phase` stands in when the local field is not there
    if (type === 'zombie_brute') return e.windT > 0 ? 'wind' : e.stagT > 0 ? 'stagger' : (e.windT === undefined && e.stagT === undefined && (e.phase === 'wind' || e.phase === 'stagger')) ? e.phase : null;
    if (type === 'cinderwight') return (e.coldT || 0) > 0 ? 'cold' : (e.heart && !e.heart.dead) ? 'feed' : (e.coldT === undefined && e.heart === undefined && (e.phase === 'feed' || e.phase === 'cold')) ? e.phase : null;
    if (type === 'the_fang') return ELEMENTS.includes(e.element) ? e.element : ELEMENTS.includes(e.phase) ? e.phase : 'fire';
    if (type === 'thunderbird') return e.phase === 'high' || e.phase === 'perch' ? e.phase : 'hunt';
    return null;
  }
  function viewOf(e, type) {
    const s = memOf(e, type);
    const dt = Math.max(0, Math.min(0.25, time - s.t)); s.t = time;
    if (e.moving) s.walk = (s.walk + dt * 8) % (TWO_PI * 64);
    // a swing: started when attackT rose (a puppet's attackT only changes when a row lands, so the swing runs on this clock)
    const a = +e.attackT || 0;
    if (a > 0 && (s.prevAtk <= 0 || a > s.prevAtk + 1e-4)) { const dur = Math.max(a, ATTACK_T[type] || 0.2); s.swDur = dur; s.sw0 = time - (dur - a); }
    s.prevAtk = a;
    const p = (time - s.sw0) / s.swDur, swing = p >= 0 && p < 1 ? p : -1;
    // the state that began a moment ago, for the poses that play out from it (a puppet's wind-up)
    const st = stateField(e, type);
    if (st !== s.ph) { s.ph = st; s.phAt = time; }
    let fx = e.facing ? +e.facing.x : 0, fy = e.facing ? +e.facing.y : 1;
    if (!Number.isFinite(fx)) fx = 0; if (!Number.isFinite(fy)) fy = 1;
    const L = Math.hypot(fx, fy); if (L < 1e-6) { fx = 0; fy = 1; } else { fx /= L; fy /= L; }
    const v = { type, facing: { x: fx, y: fy }, moving: !!e.moving, walkT: s.walk, attackT: swing >= 0 ? 0.22 * (1 - swing) : 0, hurtT: +e.hurtT || 0,
      seed: s.seed, state: e.state, stunT: +e.stunT || 0, hp: e.hp, maxHp: e.maxHp, unarmed: !!e.unarmed };
    if (type === 'thunderbird') v.phase = st;
    else if (type === 'the_fang') v.element = st;
    else if (type === 'zombie_brute') {
      if (typeof e.windT === 'number' || typeof e.stagT === 'number') { v.windT = e.windT || 0; v.stagT = e.stagT || 0; }
      else if (st === 'wind') v.windT = Math.max(0, 1.1 - (time - s.phAt));
      else if (st === 'stagger') v.stagT = Math.max(0, 1.7 - (time - s.phAt));
    } else if (type === 'cinderwight') { if (st === 'cold') v.coldT = 1; else if (st === 'feed') v.heart = { dead: false }; }
    else if (type === 'cinder_heart') v.emberT = typeof e.emberT === 'number' ? e.emberT : Math.min(10, time - s.born);
    else if (type === 'ally_knight') v.ally = e.ally === 'hale' || e.ally === 'garrick' ? e.ally : (Math.floor(s.seed * 7) % 2 ? 'garrick' : 'hale');
    return v;
  }
  // which approved drawing a monster wears right now: a calm zombie roused into a fight wakes into the fighting one
  function lookType(type, e) {
    if ((type === 'zombie_calm' || type === 'grave_zombie_calm') && e.state === 'chase') return type === 'zombie_calm' ? 'zombie' : 'grave_zombie';
    return type;
  }

  // ---------- drawing ----------
  // the box each type is drawn in, around its middle, in game pixels: [x0, y0, x1, y1] at rest (standing, walking, every
  // facing and state) then the same with a swing (its swoosh, a jab, a breath), measured off MONSTER_ART in headless
  // Chromium at every 16th of a turn (~/.fanglands/work/monsterlook/measure/boxes.js), 3 px added all round
  const BOX = { goblin: [-25, -23, 25, 17, -35, -29, 35, 30], sapper: [-27, -23, 27, 17, -35, -29, 35, 30],
    brute: [-49, -43, 49, 26, -63, -53, 63, 55], spider: [-14, -14, 14, 14, -14, -14, 14, 14], giant_spider: [-26, -26, 26, 26, -26, -26, 26, 26],
    wolf: [-24, -19, 24, 18, -26, -19, 26, 18], boar: [-20, -14, 20, 17, -24, -14, 24, 17], grave_skeleton: [-28, -28, 28, 18, -43, -36, 43, 38],
    zombie: [-17, -23, 17, 19, -21, -23, 21, 19], ash_drake: [-76, -76, 76, 76, -95, -95, 95, 95], rimhawk: [-26, -40, 28, 33, -26, -40, 28, 33],
    green_dragon: [-87, -109, 87, 87, -110, -133, 110, 87], sheep: [-18, -16, 18, 17, -18, -16, 19, 17], cow: [-28, -20, 28, 25, -30, -20, 30, 25],
    guard_m: [-27, -42, 27, 20, -65, -57, 65, 59], guard_f: [-26, -40, 26, 20, -63, -56, 63, 58], dwarf_guard: [-39, -31, 39, 21, -48, -38, 48, 43],
    castle_guard: [-23, -37, 23, 18, -59, -52, 59, 54], elf_sentinel: [-21, -27, 21, 25, -42, -34, 42, 36],
    sky_sentinel: [-37, -45, 37, 21, -70, -61, 70, 64], vampire: [-18, -24, 18, 20, -39, -31, 39, 33],
    count_ashvane: [-45, -50, 45, 29, -71, -60, 72, 64], ally_knight: [-35, -45, 35, 21, -69, -61, 69, 63],
    zombie_calm: [-17, -25, 16, 19, -20, -25, 20, 19], grave_risen: [-17, -28, 17, 19, -20, -28, 20, 19],
    grave_zombie: [-20, -27, 20, 21, -24, -27, 24, 21], grave_zombie_calm: [-19, -31, 19, 21, -24, -31, 24, 21],
    zombie_brute: [-91, -88, 118, 87, -119, -109, 119, 87], cinderwight: [-36, -72, 36, 35, -47, -72, 47, 35],
    cinder_heart: [-25, -26, 25, 25, -25, -26, 25, 25], walker: [-57, -109, 57, 42, -90, -109, 90, 42],
    yard_walker: [-59, -109, 59, 42, -92, -109, 92, 42], bulldozer: [-71, -106, 69, 44, -87, -106, 87, 54],
    yard_dozer: [-71, -106, 69, 44, -87, -106, 87, 54], barrelbeast: [-79, -133, 79, 61, -101, -133, 101, 61],
    gnasher: [-77, -128, 77, 51, -77, -128, 106, 53], golemling: [-19, -55, 19, 31, -19, -61, 19, 31],
    mithril_golem: [-47, -51, 47, 39, -68, -51, 68, 42], stormstone_golem: [-63, -81, 63, 52, -92, -81, 92, 56],
    ginormous_golem: [-107, -113, 107, 87, -177, -114, 177, 105], giant_mithril: [-61, -67, 57, 44, -62, -67, 58, 44],
    giant_stormstone: [-77, -103, 76, 55, -79, -104, 77, 55], brood_mother: [-111, -111, 112, 111, -147, -146, 146, 147],
    thunderbird: [-101, -181, 112, 118, -133, -184, 133, 125], red_dragon: [-108, -134, 120, 124, -204, -228, 200, 176],
    dustjaw: [-59, -39, 59, 34, -62, -47, 62, 40], the_fang: [-172, -190, 182, 185, -263, -263, 263, 263], };
  const boxOf = (type, swinging) => { const b = BOX[type]; if (!b) return [-40, -50, 40, 40]; return swinging ? [b[4], b[5], b[6], b[7]] : [b[0], b[1], b[2], b[3]]; };
  function paint(g, v, draw) {
    const k = SIZE[draw] || 1;
    g.save(); if (k !== 1) g.scale(k, k);
    NEW[draw](g, v);
    g.restore();
  }
  // a hit flashes the whole body red, every colour (the sample's own tint), the way the knight flashes
  function tint(cg, w, h) {
    cg.save(); cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = 'rgba(255,90,90,0.45)'; cg.fillRect(0, 0, w, h); cg.restore();
  }
  const canvasOf = (w, h) => { if (typeof document === 'undefined' || !document.createElement) return null; const c = document.createElement('canvas'); c.width = w; c.height = h; const cg = c.getContext ? c.getContext('2d') : null; return cg ? { c, cg } : null; };
  const picScale = () => Math.max(1, Math.min(2, typeof DPR === 'number' && DPR > 0 ? DPR : 1));

  // ---------- pictures: the small, common monsters, drawn once per pose and kept ----------
  // A picture is one type, one of 8 facings (16 for the spiders and the hawk, seen from above and turned to face), one
  // frame (8 steps of a walk, 4 of a swing, 12 of the standing clock), hurt or not, at the screen's pixel ratio. The
  // standing clock runs 6 frames a second on a 2 s loop, each monster's own seed setting where on the loop it is, so a
  // crowd does not breathe in step. The rest (machines, golems, dragons, bosses: big, few, and full of state) is drawn live.
  const PIC_TYPES = new Set(['goblin', 'sapper', 'brute', 'spider', 'giant_spider', 'wolf', 'boar', 'sheep', 'cow', 'grave_skeleton', 'zombie', 'zombie_calm',
    'grave_risen', 'grave_zombie', 'grave_zombie_calm', 'guard_m', 'guard_f', 'dwarf_guard', 'castle_guard', 'elf_sentinel', 'sky_sentinel', 'vampire', 'rimhawk']);
  const TOP_DIRS = new Set(['spider', 'giant_spider', 'rimhawk']);
  const WALK_N = 8, SWING_N = 4, IDLE_N = 12, IDLE_FPS = 6;
  const PIC_MAX = 1400, PIC_BYTES = 48 * 1024 * 1024;
  const PICS = new Map();
  let picBytes = 0;
  function lruGet(k) { const v = PICS.get(k); if (v) { PICS.delete(k); PICS.set(k, v); } return v; }
  function lruPut(k, v) {
    PICS.set(k, v); picBytes += v.bytes;
    while (PICS.size > PIC_MAX || (picBytes > PIC_BYTES && PICS.size > 1)) {
      const [k0, o] = PICS.entries().next().value; PICS.delete(k0); picBytes -= o.bytes;
      try { o.c.width = 0; o.c.height = 0; } catch (err) { }
    }
  }
  function clearPics() { for (const o of PICS.values()) { try { o.c.width = 0; o.c.height = 0; } catch (err) { } } PICS.clear(); picBytes = 0; }
  // the pose a picture is made in: the view snapped to the picture's facing and frame, its clock set to the frame's own
  function picPose(v, draw, s) {
    const dirs = TOP_DIRS.has(draw) ? 16 : 8;
    const a = Math.atan2(v.facing.y, v.facing.x), dir = ((Math.round(a / (TWO_PI / dirs)) % dirs) + dirs) % dirs, da = dir * TWO_PI / dirs;
    const swing = v.attackT > 0 ? 1 - v.attackT / 0.22 : -1;
    const w8 = v.moving ? Math.floor(((v.walkT % TWO_PI) + TWO_PI) % TWO_PI / TWO_PI * WALK_N) % WALK_N : -1;
    let frame, t;
    if (swing >= 0) { const ai = Math.min(SWING_N - 1, Math.floor(swing * SWING_N)); frame = 'a' + ai + (w8 >= 0 ? 'w' + w8 : ''); t = 0.3 + ai * 0.05 + Math.max(0, w8) * 0.25; }
    else if (w8 >= 0) { frame = 'w' + w8; t = 0.1 + w8 * 0.25; }
    else { const i = Math.floor(time * IDLE_FPS + s.seed / TWO_PI * IDLE_N) % IDLE_N; frame = 'i' + ((i + IDLE_N) % IDLE_N); t = ((i + IDLE_N) % IDLE_N) / IDLE_FPS; }
    const pv = Object.assign({}, v, { facing: { x: Math.cos(da), y: Math.sin(da) }, seed: 0,
      walkT: w8 >= 0 ? (w8 + 0.5) / WALK_N * TWO_PI : 0, attackT: swing >= 0 ? 0.22 * (1 - (Math.min(SWING_N - 1, Math.floor(swing * SWING_N)) + 0.5) / SWING_N) : 0 });
    return { key: draw + '|' + dir + '|' + frame + '|' + (v.unarmed ? 'u' : '') + '|' + (v.hurtT > 0 ? 'h' : ''), pv, t, swing: swing >= 0 };
  }
  function drawPic(g, v, draw, s) {
    const ss = picScale(), P = picPose(v, draw, s), key = P.key + '|' + ss;
    let p = lruGet(key);
    if (!p) {
      const b = boxOf(draw, P.swing), w = b[2] - b[0], h = b[3] - b[1];
      const cv = canvasOf(Math.ceil(w * ss), Math.ceil(h * ss)); if (!cv) return false;
      cv.cg.setTransform(ss, 0, 0, ss, -b[0] * ss, -b[1] * ss);
      const T0 = time; time = P.t;
      try { paint(cv.cg, P.pv, draw); } finally { time = T0; }
      if (v.hurtT > 0) tint(cv.cg, cv.c.width, cv.c.height);
      p = { c: cv.c, x0: b[0], y0: b[1], w, h, bytes: cv.c.width * cv.c.height * 4 };
      lruPut(key, p); STATS.made++;
    } else STATS.hits++;
    g.drawImage(p.c, p.x0, p.y0, p.w, p.h);
    STATS.pics++;
    return true;
  }
  // a big one drawn live, hurt: into a scratch picture first, so the flash colours the body and not the ground under it
  let scratch = null;
  function drawLiveHurt(g, v, draw) {
    const ss = picScale(), b = boxOf(draw, v.attackT > 0), w = b[2] - b[0], h = b[3] - b[1], W = Math.ceil(w * ss), Hh = Math.ceil(h * ss);
    if (!scratch || scratch.c.width < W || scratch.c.height < Hh) scratch = canvasOf(Math.max(W, scratch ? scratch.c.width : 0), Math.max(Hh, scratch ? scratch.c.height : 0));
    if (!scratch) { paint(g, v, draw); return; }
    const cg = scratch.cg; cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, W, Hh);
    cg.setTransform(ss, 0, 0, ss, -b[0] * ss, -b[1] * ss); paint(cg, v, draw);
    cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = 'rgba(255,90,90,0.45)'; cg.fillRect(0, 0, W, Hh); cg.globalCompositeOperation = 'source-over';
    g.drawImage(scratch.c, 0, 0, W, Hh, b[0], b[1], W / ss, Hh / ss);
  }
  // e at the origin of g (drawCharacter has translated to it)
  function drawLook(g, e, type) {
    const v = viewOf(e, type), draw = lookType(type, e), s = MEM.get(e);
    // the Echo of the Fang: a knight who has slain the real one sees it a little see-through (28-thefang)
    const echo = type === 'the_fang' && typeof quest !== 'undefined' && quest.fang && quest.fang.slain;
    if (echo) { g.save(); g.globalAlpha *= 0.75; }
    try {
      if (PIC_TYPES.has(draw) && g === ctx && ON.pics && drawPic(g, v, draw, s)) { }
      else { STATS.live++; if (v.hurtT > 0 && g === ctx) drawLiveHurt(g, v, draw); else paint(g, v, draw); }
      if (type === 'ally_knight') allyName(g, e, v);
    } finally { if (echo) g.restore(); }
  }
  // a Dragon Killer's name under his feet, as 37-dragonkillers always wrote it
  function allyName(g, e, v) {
    const name = e.allyName || (v.ally === 'garrick' ? 'Sir Garrick' : 'Sergeant Hale'), y = Math.round(BOX.ally_knight[3] + 8);
    g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(name, 0, y); g.fillStyle = '#9fe0b0'; g.fillText(name, 0, y);
  }

  // ---------- the wrap ----------
  const _drawCharacter = drawCharacter;
  drawCharacter = function (g, e, kind) {
    if (!ON.on || !e || !isMonsterKind(kind)) { STATS.passed++; return _drawCharacter(g, e, kind); }
    STATS.wrapped++;
    g.save(); g.translate(+e.x || 0, +e.y || 0);
    try { drawLook(g, e, kind); } finally { g.restore(); }
  };

  return { ON, STATS, LOOK_FIELDS, ATTACK_T, BOX, PIC_TYPES, viewOf, lookType, isMonsterKind, drawLook, boxOf, picPose, clearPics, PICS, MEM, _drawCharacter };
})();
window.MONSTER_LOOK = MONSTER_LOOK;
