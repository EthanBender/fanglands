// ============================================================================
// TOWNSFOLK — every follower and non-fighting townsperson drawn in the owner-approved new look (83-townsart.js holds the
// drawings, ported from the sample). The owner: "everything has been approved".
// WHO: Sera and Garrick (following, fighting, hurt, waiting, Sera on a machine, Sera in the goblin cage, their portrait in
// the companion panel and the plaque); every person in NPCS (Thistledown's town table, the new city's six, Death, Old
// Wren, Hollowford's three in the crypt, the heroes at the inn); Hollowford's square and the guild (31-rebuild,
// 41-guild); the ferry (26-boats: Harl at his jetty and at the oars, Pete); Deepholm (24-dwarves); Sylvaris (25-elves);
// Aerie and the sky city with their wings (36-skycity, 88-aerie); the Cloud Kingdom's people, walkers, Lark and the
// fliers (91-cloudkingdom); Goblin City's townsfolk as the new goblin (33-goblincity); Thistledown's fountain children
// and the stone statues of King Thrain, Queen Aelith and Queen Seraphel (95-thistledown).
// NOT HERE: anything in MONSTER_DEFS (guards, sentinels, vampires, the Dragon Killers: 78-monsterlook) and every knight
// (a look with `gear`: 82-knightgear).
// HOW A PERSON IS KNOWN: by `look.who`, a sample id the call site puts on the look it builds, never by colour. A who
// look goes to TOWNSFOLK.draw; nothing else is touched. An id the sample does not draw (Captain Roderick, Dunstan,
// Warden Brann, the Master of Skills, Marlow, Hux, the two unnamed fliers, and any person added later) is dressed by the
// sample's own npcFromToday from the look's flags (tunic, hair, woman, beard, apron, helm, crown, wing...): a villager in
// the new style, never the old drawing.
// THE CALL SITE'S PART: it builds its look with `who` and, when TOWNSFOLK.takes(look), translates to the feet and
// leaves out its own shadow, bob, extra scale and overlays (wings, hats, beards, ears): the new drawing has them all.
// It reads e.seated (no legs, no shadow), e.air (no ground shadow), e.unarmed (an empty main hand) and e.flapK (faster
// wings). TOWNSFOLK.labelUp(who, old) is how far above the feet the name goes (over the new head).
// WRAPS (by reassignment, explicit arguments): drawHuman (a who look comes here; every other look goes on down
// unchanged, so 77's party crown, 79's braid and 82's knight never see a townsperson) and drawNpc (the core's NPCS: the
// same facing turn, then the person through drawHuman with its id, and the name over the new head). This file loads
// after 82-knightgear, so its drawHuman is the outermost: a who look never reaches 77, 79 or 82.
// COST: a busy town must not slow the frame. A person drawn onto the world canvas at the screen's own scale is a
// picture, made once per person, facing (8), frame (8 steps of a walk, 4 of a swing, 12 of the standing clock at 6 a
// second on a 2 s loop, staggered by the person's seed so a crowd does not breathe in step) and pixel ratio, kept in a
// byte-budgeted cache (as 78-monsterlook and 82-knightgear do). Drawn live: a person talking, hurt off the world canvas,
// seated, in stone, scaled or turned (a panel, a portrait, a statue's sprite, Lark in the air, a flier), and Death.
// window.TOWNSFOLK is the test handle.
// ============================================================================
const TOWNSFOLK = (() => {
  const ART = TOWNSFOLK_ART, TWO_PI = Math.PI * 2, DOWN = { x: 0, y: 1 };
  const ON = { on: true, pics: true };
  const STATS = { live: 0, pics: 0, made: 0, hits: 0, tinted: 0, by: {}, defaults: {} };
  // the people the sample does not draw, and where they belong (npcFromToday picks the build from the group)
  const DEFAULTS = { captain: 'thistledown', dunstan: 'thistledown', brann: 'thistledown', skillmaster: 'thistledown', marlow: 'thistledown', hux: 'thistledown', wing1: 'cloud', wing2: 'cloud' };
  // both Deaths (the cave and Thistledown) are the sample's one Death
  const ALIAS = { death1: 'death2' };
  // drawn live always: Death's hourglass, blink and float run on clocks longer than a picture's 2 s loop
  const LIVE = new Set(['death2']);
  const idOf = who => ALIAS[who] || who;
  const takes = look => ON.on && !!look && typeof look.who === 'string' && !look.gear;

  // ---------- who draws a person ----------
  const DRAW = {}, SPEC = {};
  function drawerOf(who, look) {
    const id = idOf(who);
    let d = DRAW[id];
    if (d) return d;
    if (ART.NEW_NPC[id]) { d = ART.NEW_NPC[id]; SPEC[id] = ART.NPC_SPEC[id] || null; }
    else {
      const l = look || {}, spec = ART.npcFromToday(l, { group: DEFAULTS[id] || (l.wing ? 'cloud' : 'thistledown'), place: '' });
      d = ART.npc(spec); SPEC[id] = spec; STATS.defaults[id] = true;
    }
    DRAW[id] = d;
    return d;
  }
  // a number in [0, 2 pi) from the id: where on the standing clock a person is, so a crowd does not move in step
  const SEEDS = {};
  function seedOf(id) {
    let s = SEEDS[id];
    if (s !== undefined) return s;
    let h = 7;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100003;
    s = SEEDS[id] = (h % 1000) / 1000 * TWO_PI;
    return s;
  }

  // ---------- the talking pose: the person whose line is up, near the knight ----------
  // A line is said under a name (say(text, n.name)); the person is the one whose first proper word matches it (Old Harl
  // and Harl the ferryman, King Thrain), within 4 tiles of the knight.
  const STOP = new Set(['the', 'old', 'of', 'king', 'queen', 'master', 'captain', 'sister', 'warden', 'keeper', 'guildmaster', 'sergeant', 'duke', 'gatewarden', 'salt', 'sir', 'dame']);
  const KEYS = new Map();
  function nameKey(s) {
    let k = KEYS.get(s);
    if (k !== undefined) return k;
    k = String(s || '').toLowerCase().split(/[^a-z-]+/).filter(w => w && !STOP.has(w))[0] || '';
    if (KEYS.size > 400) KEYS.clear();
    KEYS.set(s, k);
    return k;
  }
  function talkT(who, look, e) {
    const d = typeof dialog !== 'undefined' && dialog ? dialog.cur : null;
    if (!d || !d.who || typeof e.x !== 'number' || typeof e.y !== 'number' || typeof player === 'undefined') return -1;
    const name = look.name || ART.NPC_NAMES[idOf(who)];
    if (!name) return -1;
    const a = nameKey(d.who);
    if (!a || a !== nameKey(name)) return -1;
    if (Math.hypot(player.x - e.x, player.y - e.y) > 4 * TILE) return -1;
    return +dialog.t || 0;
  }

  // ---------- a context that turns every colour: hurt (a red flash) and stone (the statues) ----------
  // The knight's way (82-knightgear tintCtx): every fillStyle, strokeStyle and gradient stop goes through a palette.
  // hurt: 40% of the way to #ff6b6b. stone: the colour's lightness on pale warm stone.
  const PALETTES = {
    hurt: (r, gg, b) => [r + (255 - r) * 0.4, gg + (107 - gg) * 0.4, b + (107 - b) * 0.4],
    stone: (r, gg, b) => { const v = 70 + (0.3 * r + 0.59 * gg + 0.11 * b) * 0.6; return [v + 5, v + 1, v - 7]; },
  };
  const TINTED = new Map();
  function tinted(c, kind) {
    if (typeof c !== 'string') return c;
    const k = kind + c;
    let o = TINTED.get(k);
    if (o !== undefined) return o;
    let r, gg, b, a = 1, m;
    if ((m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c))) {
      let h = m[1];
      if (h.length <= 4) h = h.split('').map(x => x + x).join('');
      const n = parseInt(h.slice(0, 6), 16); r = n >> 16; gg = (n >> 8) & 255; b = n & 255;
      if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
    } else if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c))) { r = +m[1]; gg = +m[2]; b = +m[3]; if (m[4] !== undefined) a = +m[4]; }
    else o = c;
    if (o === undefined) { const q = PALETTES[kind](r, gg, b).map(v => Math.max(0, Math.min(255, Math.round(v)))); o = a < 1 ? `rgba(${q[0]},${q[1]},${q[2]},${+a.toFixed(3)})` : `rgb(${q[0]},${q[1]},${q[2]})`; }
    if (TINTED.size > 4000) TINTED.clear();
    TINTED.set(k, o);
    return o;
  }
  function tintCtx(g, kind) {
    STATS.tinted++;
    const fix = v => typeof v === 'string' ? tinted(v, kind) : v && v.__tg ? v.__tg : v;
    return new Proxy(g, {
      get(o, k) {
        const v = o[k];
        if (typeof v !== 'function') return v;
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => { const gr = v.apply(o, a); return { __tg: gr, addColorStop: (t, c) => gr.addColorStop(t, tinted(c, kind)) }; };
        return (...a) => v.apply(o, a);
      },
      set(o, k, v) { o[k] = k === 'fillStyle' || k === 'strokeStyle' || k === 'shadowColor' ? fix(v) : v; return true; },
    });
  }

  // ---------- how much room a person takes ----------
  // A context that draws nothing and keeps the outermost point of every path through every translate, scale and rotate
  // (82-knightgear's Tracker): each person is measured once over every facing, standing, walking and swinging.
  const NOOP = () => { }, NOGRAD = { addColorStop: NOOP }, NOTEXT = { width: 10 };
  const TRACK_NOOPS = ['beginPath', 'closePath', 'fill', 'stroke', 'clip', 'clearRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage', 'setLineDash', 'putImageData', 'drawFocusIfNeeded', 'reset', 'roundRect', 'transform', 'setTransform', 'resetTransform'];
  class Tracker {
    constructor() { this.b = { l: 1e9, t: 1e9, r: -1e9, b: -1e9 }; this.m = [1, 0, 0, 1, 0, 0]; this.st = []; this.globalAlpha = 1; }
    pt(px, py) { const m = this.m, b = this.b, X = m[0] * px + m[2] * py + m[4], Y = m[1] * px + m[3] * py + m[5]; if (X < b.l) b.l = X; if (X > b.r) b.r = X; if (Y < b.t) b.t = Y; if (Y > b.b) b.b = Y; }
    box(x0, y0, w, h) { this.pt(x0, y0); this.pt(x0 + w, y0); this.pt(x0, y0 + h); this.pt(x0 + w, y0 + h); }
    mul(a, c, d, e, f, h) { const [A, B, C, D, E, F] = this.m; this.m = [A * a + C * c, B * a + D * c, A * d + C * e, B * d + D * e, A * f + C * h + E, B * f + D * h + F]; }
    save() { this.st.push(this.m.slice()); }
    restore() { if (this.st.length) this.m = this.st.pop(); }
    translate(tx, ty) { this.mul(1, 0, 0, 1, tx, ty); }
    scale(sx, sy) { this.mul(sx, 0, 0, sy, 0, 0); }
    rotate(a) { const c = Math.cos(a), s2 = Math.sin(a); this.mul(c, s2, -s2, c, 0, 0); }
    moveTo(x, y) { this.pt(x, y); }
    lineTo(x, y) { this.pt(x, y); }
    quadraticCurveTo(a, b2, c, d) { this.pt(a, b2); this.pt(c, d); }
    bezierCurveTo(a, b2, c, d, e, f) { this.pt(a, b2); this.pt(c, d); this.pt(e, f); }
    arcTo(a, b2, c, d) { this.pt(a, b2); this.pt(c, d); }
    arc(cx, cy, r) { this.box(cx - r, cy - r, 2 * r, 2 * r); }
    ellipse(cx, cy, rx, ry) { const r = Math.max(rx, ry); this.box(cx - r, cy - r, 2 * r, 2 * r); }
    rect(x0, y0, w, h) { this.box(x0, y0, w, h); }
    fillRect(x0, y0, w, h) { this.box(x0, y0, w, h); }
    createLinearGradient() { return NOGRAD; }
    createRadialGradient() { return NOGRAD; }
    createConicGradient() { return NOGRAD; }
    createPattern() { return null; }
    measureText() { return NOTEXT; }
    getTransform() { return undefined; }
  }
  for (const k of TRACK_NOOPS) Tracker.prototype[k] = NOOP;
  // a pose for drawing: the person's own view of what is going on
  const pose = (fx, fy, o) => Object.assign({ x: 0, y: 0, facing: { x: fx, y: fy }, moving: false, walkT: 0, attackT: 0, hurtT: 0, seed: 0, talking: false, talkT: 0 }, o || {});
  const FACE8 = [];
  for (let d = 0; d < 8; d++) FACE8.push({ x: Math.cos(d * TWO_PI / 8), y: Math.sin(d * TWO_PI / 8) });
  // with the clock held: a measure or a picture is drawn at a moment of its own, and the game's clock is put back after
  function at(t, fn) { const t0 = time; time = t; try { return fn(); } finally { time = t0; } }
  const BOX = {}, SWING_BOX = {}, STAND = {};
  // the box round everything a person draws (3 px more all round), for the size of their pictures: standing and walking,
  // every facing; and, for the followers' fighting frames only, the same with the swing (a sword's reach, a bow held out)
  function boxOf(id, swing) {
    const M = swing ? SWING_BOX : BOX;
    let b = M[id];
    if (b) return b;
    const d = drawerOf(id), tr = new Tracker();
    try {
      for (const f of FACE8) {
        if (swing) { for (let a = 0; a < 4; a++) for (const w of [-1, 1, 5]) at(0.3, () => d(tr, pose(f.x, f.y, { attackT: 0.22 * (1 - (a + 0.5) / 4), moving: w >= 0, walkT: w >= 0 ? (w + 0.5) / 8 * TWO_PI : 0 }))); continue; }
        for (const t of [0, 0.7, 1.4]) at(t, () => d(tr, pose(f.x, f.y)));
        for (let w = 0; w < 8; w++) at(0.1 + w * 0.25, () => d(tr, pose(f.x, f.y, { moving: true, walkT: (w + 0.5) / 8 * TWO_PI })));
      }
    } catch (err) { tr.b.l = -40; tr.b.t = -50; tr.b.r = 40; tr.b.b = 30; }
    const q = tr.b;
    b = M[id] = { l: Math.floor(q.l) - 3, t: Math.floor(q.t) - 3, r: Math.ceil(q.r) + 3, b: Math.ceil(q.b) + 3 };
    return b;
  }
  // the box of a person standing, facing us, with no shadow (the statues, the labels)
  function standOf(id) {
    let b = STAND[id];
    if (b) return b;
    const d = drawerOf(id), tr = new Tracker();
    try { at(0, () => d(tr, pose(0, 1, { air: true }))); } catch (err) { tr.b.l = -12; tr.b.t = -24; tr.b.r = 12; tr.b.b = 14; }
    const q = tr.b;
    b = STAND[id] = { l: q.l, t: q.t, r: q.r, b: q.b };
    return b;
  }
  // how far above the feet a name goes: over the new head (hats, crowns, hoods and wing tips included), and never lower
  // than where the call site put it before
  const labelUp = (who, old) => Math.max(old || 0, Math.ceil(-standOf(idOf(who)).t + 6));

  // ---------- pictures ----------
  const WALK_N = 8, SWING_N = 4, IDLE_N = 12, IDLE_FPS = 6;
  const PIC_MAX = 2400, PIC_BYTES = 48 * 1024 * 1024;
  const PICS = new Map();
  let picBytes = 0;
  const picScale = () => Math.max(1, Math.min(2, typeof DPR === 'number' && DPR > 0 ? DPR : 1));
  function lruGet(k) { const v = PICS.get(k); if (v) { PICS.delete(k); PICS.set(k, v); } return v; }
  function lruPut(k, v) {
    PICS.set(k, v); picBytes += v.bytes;
    while (PICS.size > PIC_MAX || (picBytes > PIC_BYTES && PICS.size > 1)) {
      const [k0, o] = PICS.entries().next().value; PICS.delete(k0); picBytes -= o.bytes;
      try { o.c.width = 0; o.c.height = 0; } catch (err) { }
    }
  }
  function clearPics() { for (const o of PICS.values()) { try { o.c.width = 0; o.c.height = 0; } catch (err) { } } PICS.clear(); picBytes = 0; }
  const canvasOf = (w, h) => { if (typeof document === 'undefined' || !document.createElement) return null; const c = document.createElement('canvas'); c.width = w; c.height = h; const cg = c.getContext ? c.getContext('2d') : null; return cg ? { c, cg } : null; };
  // a picture goes only onto the world canvas at the screen's own scale, not turned (a panel, a sprite, a scaled or
  // turned person is drawn live)
  function plain(g) {
    if (!ON.pics || g !== ctx) return false;
    if (typeof g.getTransform !== 'function') return true;
    const m = g.getTransform();
    if (!m || typeof m.a !== 'number') return true;
    const k = typeof DPR === 'number' && DPR > 0 ? DPR : 1;
    return Math.abs(m.a - k) < 1e-3 && Math.abs(m.d - k) < 1e-3 && Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6;
  }
  // the picture a person needs now: their facing snapped to 8, the frame (a swing, a step, or the standing clock), and
  // the pose to paint it in, with its own clock
  // A walk's 8 steps come in pairs that are the same pose (the step is the sine of the walk: steps 0 and 3, 1 and 2, 4
  // and 7, 5 and 6), so for most people a pair shares one picture. Not for those whose wings beat with the walk (the sky
  // folk, a winged default), Death (he leans and sways with it) or a goblin (the ears flick with it).
  const PAIRED = {};
  function paired(id) {
    let p = PAIRED[id];
    if (p !== undefined) return p;
    const fam = ART.NPC_FAMILY[id], P = SPEC[id];
    p = PAIRED[id] = !(fam === 'sky' || fam === 'death' || (P && (P.wings || P.ears === 'goblin')) || !P);
    return p;
  }
  function picPose(id, v) {
    const a = Math.atan2(v.facing.y, v.facing.x), dir = ((Math.round(a / (TWO_PI / 8)) % 8) + 8) % 8;
    const swing = v.attackT > 0 ? 1 - v.attackT / 0.22 : -1, ai = swing >= 0 ? Math.min(SWING_N - 1, Math.floor(swing * SWING_N)) : -1;
    let w8 = v.moving ? Math.floor(((v.walkT % TWO_PI) + TWO_PI) % TWO_PI / TWO_PI * WALK_N) % WALK_N : -1;
    if (w8 >= 0 && paired(id)) w8 = w8 < 4 ? Math.min(w8, 3 - w8) : 4 + Math.min(w8 - 4, 7 - w8);
    let frame, t;
    if (ai >= 0) { frame = 'a' + ai + (w8 >= 0 ? 'w' + w8 : ''); t = 0.3 + ai * 0.05 + Math.max(0, w8) * 0.25; }
    else if (w8 >= 0) { frame = 'w' + w8; t = 0.1 + w8 * 0.25; }
    else { const i = ((Math.floor(time * IDLE_FPS + v.seed / TWO_PI * IDLE_N) % IDLE_N) + IDLE_N) % IDLE_N; frame = 'i' + i; t = i / IDLE_FPS; }
    const f = FACE8[dir];
    const pv = pose(f.x, f.y, { moving: w8 >= 0, walkT: w8 >= 0 ? (w8 + 0.5) / WALK_N * TWO_PI : 0, attackT: ai >= 0 ? 0.22 * (1 - (ai + 0.5) / SWING_N) : 0, unarmed: !!v.unarmed, flapK: v.flapK || 0 });
    return { key: id + '|' + dir + '|' + frame + '|' + (v.unarmed ? 'u' : '') + (v.flapK > 1 ? 'f' + v.flapK : '') + '|' + (v.hurtT > 0 ? 'h' : ''), pv, t };
  }
  function drawPic(g, id, d, v) {
    const ss = picScale(), P = picPose(id, v), key = P.key + '|' + ss;
    let p = lruGet(key);
    if (!p) {
      const b = boxOf(id, v.attackT > 0), w = b.r - b.l, h = b.b - b.t;
      const cv = canvasOf(Math.ceil(w * ss), Math.ceil(h * ss));
      if (!cv) return false;
      cv.cg.setTransform(ss, 0, 0, ss, -b.l * ss, -b.t * ss);
      at(P.t, () => d(cv.cg, P.pv));
      if (v.hurtT > 0) { cv.cg.setTransform(1, 0, 0, 1, 0, 0); cv.cg.globalCompositeOperation = 'source-atop'; cv.cg.globalAlpha = 0.4; cv.cg.fillStyle = '#ff6b6b'; cv.cg.fillRect(0, 0, cv.c.width, cv.c.height); }
      p = { c: cv.c, x0: b.l, y0: b.t, w, h, bytes: cv.c.width * cv.c.height * 4 };
      lruPut(key, p); STATS.made++;
    } else STATS.hits++;
    g.drawImage(p.c, p.x0, p.y0, p.w, p.h);
    STATS.pics++;
    return true;
  }

  // ---------- the one way in: a who look on entity e, at (0, 0) = the feet's centre ----------
  const V = pose(0, 1);
  function draw(g, e, look) {
    e = e || {};
    const who = look.who, id = idOf(who), d = drawerOf(who, look);
    STATS.by[who] = (STATS.by[who] || 0) + 1;
    // the game hands facings as signs, (1, 1) and the like: the drawings want a unit vector
    const f = e.facing || DOWN;
    let fx = +f.x || 0, fy = +f.y || 0;
    const n = Math.hypot(fx, fy);
    if (n > 1e-6) { fx /= n; fy /= n; } else { fx = 0; fy = 1; }
    const tt = talkT(who, look, e);
    V.facing.x = fx; V.facing.y = fy;
    V.moving = !!e.moving; V.walkT = +e.walkT || 0; V.attackT = +e.attackT || 0; V.hurtT = +e.hurtT || 0;
    V.seed = seedOf(id); V.talking = tt >= 0; V.talkT = tt >= 0 ? tt : 0;
    V.seated = !!e.seated; V.air = !!e.air || !!look.stone; V.unarmed = !!e.unarmed; V.flapK = +e.flapK || 0;
    if (look.stone) {
      // a statue: all of it in stone, its clock stopped (no breathing, no sway)
      STATS.live++;
      V.moving = false; V.walkT = 0; V.attackT = 0; V.hurtT = 0; V.talking = false; V.seed = 0;
      at(0, () => d(tintCtx(g, 'stone'), V));
      return true;
    }
    if (!V.talking && !V.seated && !LIVE.has(id) && plain(g) && drawPic(g, id, d, V)) return true;
    STATS.live++;
    d(V.hurtT > 0 ? tintCtx(g, 'hurt') : g, V);
    return true;
  }

  // ---------- a portrait: head and shoulders in a round frame (the companion panel and its plaque) ----------
  // the head's centre and radius over the feet, from the person's build (Death floats, hooded, at 1.25)
  const HEADS = { death2: { y: -19.5, r: 8.8 } };
  function headOf(id) {
    if (HEADS[id]) return HEADS[id];
    const P = SPEC[id];
    if (!P) return { y: -15, r: 7.4 };
    const B = Object.assign({}, ART.BUILDS[P.build || 'adult'], P.geo || {}), s = B.s * (P.size || 1);
    return HEADS[id] = { y: B.hy * s - (P.lift || 0), r: B.hr * s };
  }
  function portrait(g, cx, cy, r, o) {
    if (!ON.on || !o || typeof o.who !== 'string') return false;
    const id = idOf(o.who), d = drawerOf(o.who, o);
    const hd = headOf(id), k = r * 0.56 / hd.r;
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TWO_PI); g.clip();
    g.fillStyle = o.down ? '#3a1d1d' : '#35506b'; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    g.translate(cx, cy + r * 0.06 - hd.y * k); g.scale(k, k);
    const v = pose(0, 1, { seed: seedOf(id), air: true });
    STATS.portraits = (STATS.portraits || 0) + 1;
    d(g, v);
    g.restore();
    if (o.down) { g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TWO_PI); g.clip(); g.fillStyle = 'rgba(80,0,0,0.45)'; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); g.restore(); }
    return true;
  }

  // ---------- a statue on its plinth: the scale that fits the sprite, and where the feet go ----------
  // room: from the plinth's top up to the sprite's top; half: half the sprite's width. Never bigger than maxS (the old
  // statues' 1.32). foot: how far the feet's centre sits above the lowest point drawn (the boots, a staff's foot).
  function statueFit(who, maxS, room, half) {
    const b = standOf(idOf(who)), tall = Math.max(1, b.b - b.t), wide = Math.max(1, -b.l, b.r);
    const s = Math.min(maxS, room / tall, half / wide);
    return { s, foot: b.b * s };
  }

  // ---------- drawing a person at a place ----------
  // translate to (x, y), the feet's centre, draw, put the context back; true when the new look took it
  function put(g, x, y, e, look) {
    if (!takes(look)) return false;
    g.save(); g.translate(x, y); drawHuman(g, e, look); g.restore();
    return true;
  }

  // ---------- the wraps ----------
  const _drawHuman = drawHuman;
  drawHuman = function (g, e, look) {
    if (takes(look)) return draw(g, e, look);
    return _drawHuman(g, e, look);
  };
  // the core's NPCS: the same facing turn toward the knight, then the person by id; no bob or shadow of the core's
  // (the drawing has its own), and the name over the new head
  const NPC_LOOK = new WeakMap();
  function npcLook(n) {
    let l = NPC_LOOK.get(n);
    if (!l || l.who !== (n.ghost ? 'death2' : n.id)) {
      l = { who: n.ghost ? 'death2' : n.id, name: n.name, tunic: n.tunic, hair: n.hair, apron: n.apron, helm: n.helmet ? '#8f96a3' : null, crown: n.crown, woman: n.woman, beard: n.beard, spear: n.helmet, shoulder: n.crown ? '#c9a36a' : '#7a6a5a' };
      NPC_LOOK.set(n, l);
    }
    return l;
  }
  const _drawNpc = drawNpc;
  drawNpc = function (g, n) {
    if (!ON.on || !n || typeof n.id !== 'string') return _drawNpc(g, n);
    const e = { x: n.px, y: n.py, r: 13, facing: n.facing, hurtT: 0, attackT: 0, moving: n.moving, walkT: n.walkT };
    const near = dist(player.x, player.y, e.x, e.y) < 110;
    if (near && !n.moving) e.facing = { x: Math.sign(player.x - e.x) || 0, y: Math.sign(player.y - e.y) || 1 };
    const look = npcLook(n);
    g.save(); g.translate(e.x, e.y); drawHuman(g, e, look); g.restore();
    if (near) {
      const y = e.y - labelUp(look.who, n.ghost ? 44 : 26);
      g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(n.name, e.x, y);
      g.fillStyle = n.ghost ? '#b58cff' : '#ffe9a8'; g.fillText(n.name, e.x, y);
    }
  };

  // a frame begins: nothing is pushed (PEOPLE_UI's audit draws only items at 1e9 and above)
  HOOKS.draw.push((g, items) => { STATS.frames = (STATS.frames || 0) + 1; });
  HOOKS.newGame.push(() => { clearPics(); });

  // ---------- self-test ----------
  // A context that writes down every call, its numbers (to a tenth) and every colour it is given, and keeps the
  // save/restore depth (the headless canvas is a stub).
  const REC_CALLS = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'fillRect', 'strokeRect', 'clearRect', 'fill', 'stroke', 'clip', 'setLineDash', 'translate', 'scale', 'rotate', 'drawImage', 'fillText', 'strokeText', 'setTransform', 'transform', 'resetTransform'];
  class Rec {
    constructor() { this.ops = []; this.depth = 0; this.low = 0; this.cols = []; this.fillStyle = '#000'; this.strokeStyle = '#000'; this.globalAlpha = 1; this.lineWidth = 1; }
    save() { this.depth++; this.ops.push('save'); }
    restore() { this.depth--; if (this.depth < this.low) this.low = this.depth; this.ops.push('restore'); }
    createLinearGradient() { const g = { stops: [], addColorStop: (t, c) => { g.stops.push(c); this.cols.push(c); } }; return g; }
    createRadialGradient() { return this.createLinearGradient(); }
    createPattern() { return null; }
    measureText() { return { width: 10 }; }
    getTransform() { return undefined; }
    sig() { return this.ops.join(';'); }
  }
  for (const k of REC_CALLS) Rec.prototype[k] = function (...a) {
    let s = k;
    for (const v of a) s += ',' + (typeof v === 'number' ? Math.round(v * 10) / 10 : typeof v);
    if (k === 'fill' || k === 'fillRect') { const f = this.fillStyle; s += ':' + (typeof f === 'string' ? f : 'grad'); if (typeof f === 'string') this.cols.push(f); }
    if (k === 'stroke') { const f = this.strokeStyle; s += ':' + (typeof f === 'string' ? f : 'grad'); if (typeof f === 'string') this.cols.push(f); }
    this.ops.push(s);
  };
  const IDS = () => Object.keys(ART.NEW_NPC);
  const rgbOf = c => { const m = /^#([0-9a-f]{6})/i.exec(c); if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; } const q = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(c); return q ? [+q[1], +q[2], +q[3]] : null; };
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'townsfolk: ';
    const ids = IDS();

    // 1. every person in the sample is drawn by the new look, by id: 8 facings x standing, walking, talking, seated and in
    // the air, with nothing thrown and every save put back; each drawing is the sample's (hundreds of calls, the old one
    // drew about twenty), and no two people of the sample draw the same
    { const bad = [], sigs = new Map(), dup = [], small = [];
      const by0 = Object.assign({}, STATS.by);
      for (const id of ids) {
        for (const f of FACE8) for (const o of [{}, { moving: true, walkT: 2.1 }, { talking: true, talkT: 0.6 }, { seated: true }, { air: true, flapK: 4 }]) {
          const r = new Rec();
          try { drawHuman(r, Object.assign({ facing: f }, o), { who: id }); } catch (err) { bad.push(id + ': ' + err.message); break; }
          if (r.depth !== 0 || r.low < 0) bad.push(id + ' save/restore ' + r.depth);
        }
        const r = new Rec(); at(0, () => drawerOf(id)(r, pose(0, 1, { seed: 0 })));
        if (r.ops.length < 150) small.push(id + ':' + r.ops.length);
        const s = r.sig();
        if (sigs.has(s)) dup.push(id + '=' + sigs.get(s)); else sigs.set(s, id);
      }
      const missed = ids.filter(id => !((STATS.by[id] || 0) > (by0[id] || 0)));
      check(P + 'every one of the ' + ids.length + ' people in the approved sample is drawn in the new look by id (the sample\'s own drawing, 150+ calls each), at 8 facings standing, walking, talking, seated and in the air, with nothing thrown and every save put back; no two of them draw the same',
        ids.length === 74 && !bad.length && !missed.length && !dup.length && !small.length, { n: ids.length, bad: bad.slice(0, 5), missed, dup, small }); }

    // 2. every person the game draws reaches the new look by id: each NPCS entry through the core's drawNpc, and every
    // place's own people in real frames (Hollowford's square and the guild, the ferry, Deepholm, Sylvaris, Aerie and the
    // Cloud Kingdom with Lark, the walkers and the fliers, Goblin City, the fountain children, the statues, the followers
    // and Sera in her cage). The people the sample does not draw are exactly the eight with the new-style default.
    { const seen = new Set(), calls = [], npcBad = [], q0 = JSON.stringify({ h: quest.hollowford, r: quest.rebuild, g: quest.guild }), c0 = player.companion ? JSON.parse(JSON.stringify(player.companion)) : null;
      const at0 = { x: player.x, y: player.y, facing: player.facing, mech: player.mech, r: player.r }, inst0 = window.INSTANCES ? INSTANCES.active() : null;
      const _dh = drawHuman;
      drawHuman = function (g, e, l) { if (l && typeof l.who === 'string') { seen.add(l.who); calls.push(l.who); } return _dh(g, e, l); };
      let threw = null;
      try {
        for (const n of NPCS) { const k = calls.length, w = n.ghost ? 'death2' : n.id; drawNpc(new Rec(), n); if (!calls.slice(k).includes(w)) npcBad.push(n.id); }
        // the knight on the person's own tile: a goblin in a hut is drawn only while the knight is in that hut too
        const look = (x, y) => { F.tp(Math.floor(x / TILE), Math.floor(y / TILE)); render(); };
        const taps = () => { const out = []; for (const f of TAP_PEOPLE) { try { for (const p of f() || []) if (p && typeof p.x === 'number') out.push(p); } catch (err) { } } return out; };
        h.peace(true);
        // the overworld: the square, the kids, the statues; Hollowford's square and the guild; the ferry; Sylvaris; Goblin City
        quest.hollowford = Object.assign({}, quest.hollowford || {}, { freed: true }); quest.rebuild = quest.rebuild || {}; quest.rebuild.done = Object.assign({}, quest.rebuild.done || {}, { house: true });
        F.tp(112, 36); F.sim(2, []); render();
        F.tp(139, 80); F.sim(2, []); render();
        quest.guild = Object.assign({}, quest.guild || {}, { founded: true, rank: 4 }); F.tp(153, 69); F.sim(2, []); render();
        F.tp(170, 14); render();
        F.tp(181, 15); render();
        for (const p of taps()) look(p.x, p.y);
        // the followers: each in turn, following and on the machine; Sera in the cage before she is freed
        for (const id of ['sera', 'garrick']) { player.companion = { id, hp: 50, mode: 'follow', x: player.x - 30, y: player.y, freed: { sera: true }, downT: 0 }; F.sim(2, []); render(); }
        player.companion = { id: null, hp: 0, mode: 'follow', x: 0, y: 0, freed: { sera: false }, downT: 0 };
        const CG = window.FANGLANDS.companion && FANGLANDS.companion.CAGE_POS; if (CG) { F.tp(CG.x, CG.y + 2); render(); }
        // Deepholm and Aerie (the sky city, the Cloud Kingdom: the residents, Lark, the walkers and the fliers)
        if (window.INSTANCES) {
          INSTANCES.enter('deepholm'); for (const p of taps()) look(p.x, p.y); INSTANCES.leave();
          INSTANCES.enter('aerie'); F.sim(2, []);
          for (const p of taps()) look(p.x, p.y);
          const K = window.KINGDOM;
          if (K) {
            for (const p of K.PEOPLE) look(p.px, p.py);
            look(K.LARK.px, K.LARK.py);
            for (const w of K.WALKERS) { F.sim(1, []); look(w.px, w.py); }
            for (const f of K.FLIERS) { F.sim(1, []); F.tp(Math.floor(f.px / TILE), Math.floor(f.py / TILE)); F.sim(1, []); F.tp(Math.floor(f.px / TILE), Math.floor(f.py / TILE)); render(); }
          }
          INSTANCES.leave();
        }
      } catch (err) { threw = err.message + ' ' + String(err.stack || '').split('\n')[1]; }
      finally {
        drawHuman = _dh;
        const q = JSON.parse(q0); quest.hollowford = q.h; quest.rebuild = q.r; quest.guild = q.g; player.companion = c0;
        if (window.INSTANCES && INSTANCES.active() && INSTANCES.active() !== inst0) INSTANCES.leave();
        Object.assign(player, at0); h.peace(false);
      }
      const want = ids.concat(Object.keys(DEFAULTS));
      const missing = want.filter(w => !seen.has(w));
      const defaults = Object.keys(STATS.defaults).sort(), want8 = Object.keys(DEFAULTS).sort();
      const sampleDefault = ids.filter(id => STATS.defaults[id]);
      check(P + 'every person the game draws reaches the new look by id: all ' + NPCS.length + ' in NPCS through drawNpc, and every place\'s own people in real frames (Hollowford, the guild, the ferry, Deepholm, Sylvaris, Aerie, the Cloud Kingdom with Lark, the walkers and the fliers, Goblin City, the fountain children, the statues, Sera and Garrick, the cage); only the eight the sample does not draw wear the new-style default',
        !threw && !npcBad.length && !missing.length && !sampleDefault.length && defaults.every(d => want8.includes(d)) && want8.every(d => defaults.includes(d)), { threw, npcBad, missing, defaults, sampleDefault, seen: seen.size }); }

    // 3. not ours: the guards and every other MONSTER_DEFS person go to 78-monsterlook, the knight to 82-knightgear; a who
    // look never reaches 77, 79 or 82 (no party crown on a goblin's chef's hat, no knight drawing)
    { const n0 = Object.values(STATS.by).reduce((a, b) => a + b, 0), kg = window.KNIGHTGEAR ? KNIGHTGEAR.STATS.live : 0;
      const types = ['guard_m', 'guard_f', 'dwarf_guard', 'castle_guard', 'elf_sentinel', 'sky_sentinel', 'vampire', 'count_ashvane', 'ally_knight'].filter(t => MONSTER_DEFS[t]);
      const ml = window.MONSTER_LOOK ? JSON.stringify(MONSTER_LOOK.STATS.by) : '';
      for (const t of types) for (const f of [{ x: 0, y: 1 }, { x: 1, y: 0 }]) drawCharacter(new Rec(), { x: 0, y: 0, r: 13, type: t, facing: f, hurtT: 0, attackT: 0, moving: false, walkT: 0, hp: 10, maxHp: 10 }, t);
      const n1 = Object.values(STATS.by).reduce((a, b) => a + b, 0);
      const ml1 = window.MONSTER_LOOK ? JSON.stringify(MONSTER_LOOK.STATS.by) : '';
      const kr = new Rec(); drawHuman(kr, { facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0 }, playerLook()); const kg1 = window.KNIGHTGEAR ? KNIGHTGEAR.STATS.live : 0;
      const n2 = Object.values(STATS.by).reduce((a, b) => a + b, 0);
      // a goblin with a chef's hat: the drawing has no party crown (77's crown path: up from -8.6, -13)
      const gr = new Rec(); const kg2 = window.KNIGHTGEAR ? KNIGHTGEAR.STATS.live : 0; drawHuman(gr, { facing: { x: 0, y: 1 } }, { who: 'grubb', tunic: '#8a3a2a', apron: true, hat: 'chef', fat: true });
      const kg3 = window.KNIGHTGEAR ? KNIGHTGEAR.STATS.live : 0, crown = gr.ops.some((o, i) => o === 'moveTo,-8.6,-13' && gr.ops[i + 1] === 'lineTo,-8.6,-17.2');
      check(P + 'the guards, sentinels, vampires and Dragon Killers (' + types.length + ' MONSTER_DEFS people) are the monster look\'s and the knight is 82-knightgear\'s: none of them is drawn here; a townsperson never reaches the knight\'s drawing or the party crown',
        n1 === n0 && ml1 !== ml && kg1 === kg + 1 && n2 === n1 && kg3 === kg2 && !crown, { n0, n1, n2, types: types.length, knight: kg1 - kg, crown }); }

    // 4. what they hold follows the owner's rules: it rests upright with the hand at the waist (no turn standing still);
    // facing us or side-on it is drawn after the body (in front), facing away before it (behind)
    { const bad = []; let n = 0;
      try {
        for (const id of ids) {
          const S = SPEC[id] || (drawerOf(id), SPEC[id]); if (!S || !S.held) continue;
          for (const [fx, fy, front] of [[0, 1, true], [1, 0, true], [-1, 0, true], [0, -1, false]]) {
            const r = new Rec(); let body = -1, held = -1, hb = null;
            ART.mark((g, what, C) => { if (what === 'body' && body < 0) body = r.ops.length; if (what === 'held' && held < 0) { held = r.ops.length; hb = { x: C.B.hand.x, y: C.B.hand.y + C.step * 0.5 + C.bob }; } });
            try { at(0, () => drawerOf(id)(r, pose(fx, fy))); } finally { ART.mark(null); }
            n++;
            if (body < 0 || held < 0) { bad.push(id + ' no marks'); continue; }
            if (front !== (held > body)) bad.push(id + (front ? ' behind facing ' + fx + ',' + fy : ' in front facing away'));
            // the next turn and move after the mark: to the hand at the waist, turned no more than the step allows
            const tr = r.ops.slice(held).find(o => o.startsWith('translate,')), ro = r.ops.slice(held).find(o => o.startsWith('rotate,'));
            const t = tr ? tr.split(',').slice(1).map(Number) : null, a = ro ? +ro.split(',')[1] : 0;
            if (!t || Math.abs(t[0] - hb.x) > 0.11 || Math.abs(t[1] - hb.y) > 0.11 || Math.abs(a) > 0.05) bad.push(id + ' not upright at the waist ' + JSON.stringify({ t, hb, a }));
          }
        }
      } catch (err) { bad.push('threw ' + err.message); }
      check(P + 'what each of them holds rests upright with the hand at the waist, in front of the body facing us or side-on and behind it facing away (' + n + ' drawings)', n >= 200 && !bad.length, { n, bad: bad.slice(0, 6) }); }

    // 5. the followers fight in the new style: Sera's bow comes up and draws, Garrick's sword swings round the shoulder (a
    // different pose at each quarter of the 0.22 s, none the resting pose), both behind the body facing away; hurt, every
    // colour flashes toward red the knight's way
    { const res = {}; let ok = true;
      for (const id of ['sera', 'garrick']) {
        const rest = new Rec(); at(0.3, () => drawerOf(id)(rest, pose(1, 0)));
        const poses = [0.2, 0.15, 0.1, 0.05].map(t => { const r = new Rec(); at(0.3, () => drawerOf(id)(r, pose(1, 0, { attackT: t }))); return r.sig(); });
        const distinct = new Set(poses).size === 4 && !poses.includes(rest.sig());
        let body = -1, held = -1; const rb = new Rec();
        ART.mark((g, what) => { if (what === 'body' && body < 0) body = rb.ops.length; if (what === 'held' && held < 0) held = rb.ops.length; });
        try { at(0.3, () => drawerOf(id)(rb, pose(0, -1, { attackT: 0.12 }))); } finally { ART.mark(null); }
        const t0 = STATS.tinted, hr = new Rec(); drawHuman(hr, { facing: { x: 0, y: 1 }, hurtT: 0.2 }, { who: id });
        const calm = new Rec(); drawHuman(calm, { facing: { x: 0, y: 1 }, hurtT: 0 }, { who: id });
        const reds = hr.cols.map(rgbOf).filter(Boolean), redder = reds.length > 20 && reds.every(c => c[0] >= c[1] - 1 && c[0] >= c[2] - 1 || (c[0] > 150));
        res[id] = { distinct, behind: held >= 0 && body >= 0 && held < body, tinted: STATS.tinted > t0, redder, differs: hr.sig() !== calm.sig() || hr.cols.join() !== calm.cols.join() };
        ok = ok && distinct && res[id].behind && res[id].tinted && res[id].differs;
      }
      // the bow draws: an arrow on the string while she pulls (a red fletching #c0392b and a steel head)
      const bw = new Rec(); at(0.3, () => drawerOf('sera')(bw, pose(1, 0, { attackT: 0.15 })));
      const arrow = bw.cols.includes('#c0392b');
      check(P + 'the followers fight in the new style: Sera\'s bow comes up and draws an arrow, Garrick\'s sword swings round the shoulder, a new pose at each quarter of the swing; facing away it is all behind the body; hurt, the whole follower flashes red',
        ok && arrow, Object.assign({ arrow }, res)); }

    // 6. the goblin townsfolk are the new goblin (the monster look's head: ears out, yellow eyes with red middles, fangs),
    // never the old round goblin; the sky folk keep their wings; children are child size
    { const gob = ['tinkerton', 'grubb', 'nix', 'snaggle', 'pipsqueak', 'gnash', 'mudge', 'skritch', 'ratchet'], sky = ids.filter(id => ART.NPC_FAMILY[id] === 'sky');
      // wider than the person's own hands: a goblin's ears and the sky folk's wings reach out past them
      const handsOf = id => { const S = SPEC[id] || (drawerOf(id), SPEC[id]) || {}, B = Object.assign({}, ART.BUILDS[S.build || 'adult'], S.geo || {}), k = B.s * (S.size || 1); return 2 * (B.hand.x + 2.05) * k; };
      // (the base draws a person with goblin ears through npc_goblinHead, 78-monsterart's goblin head)
      const gBad = gob.filter(id => { const S = SPEC[id] || (drawerOf(id), SPEC[id]); const r = new Rec(); at(0, () => drawerOf(id)(r, pose(0, 1))); return !S || S.ears !== 'goblin' || r.cols.includes('#8ad35a') || standOf(id).r - standOf(id).l < handsOf(id) + 1; });
      const wBad = sky.filter(id => standOf(id).r - standOf(id).l < handsOf(id) + 3);
      const kids = ['tess', 'robin', 'pip', 'fen', 'tilly', 'lark'].filter(id => (SPEC[id] || (drawerOf(id), SPEC[id]) || {}).build !== 'child');
      check(P + 'Goblin City\'s ' + gob.length + ' townsfolk are drawn on the new goblin (its ears and yellow eyes, never the old green circle), the ' + sky.length + ' sky folk spread their own wings, and the children are child size',
        gob.every(id => ART.NEW_NPC[id]) && !gBad.length && sky.length === 20 && !wBad.length && !kids.length, { gBad: gBad.map(id => id + ':' + Math.round(standOf(id).r - standOf(id).l)), wBad: wBad.map(id => id + ':' + Math.round(standOf(id).r - standOf(id).l) + '/' + Math.round(handsOf(id))), kids }); }

    // 7. a portrait (the companion panel, the plaque) is the person: HK.portrait draws Sera and Garrick in the new look, and
    // a face with no who is the kit's own
    { const p0 = STATS.portraits || 0, r1 = new Rec(), r2 = new Rec(), r3 = new Rec();
      HK.portrait(r1, 20, 20, 12, { who: 'sera', hair: '#c9843a', tunic: '#3a6a4a' });
      HK.portrait(r2, 20, 20, 12, { who: 'garrick', hair: '#8f96a3', tunic: '#7a2e2e', down: true });
      const p1 = STATS.portraits || 0;
      HK.portrait(r3, 20, 20, 12, { hair: '#c9843a', tunic: '#3a6a4a' });
      check(P + 'the companion panel and the plaque show Sera and Garrick as they are drawn in the world (head and shoulders in the round frame, a red veil when down); a portrait with no who is the kit\'s own',
        p1 - p0 === 2 && (STATS.portraits || 0) === p1 && r1.ops.length > 150 && r2.ops.length > 150 && r3.ops.length < 60 && r1.depth === 0 && r2.cols.includes('rgba(80,0,0,0.45)'), { made: p1 - p0, ops: [r1.ops.length, r2.ops.length, r3.ops.length] }); }

    // 8. the statues of King Thrain, Queen Aelith and Queen Seraphel are the people in the new look, all in stone (every
    // colour a grey within 14 of itself), held still, and inside their sprites (96 px tall, 48 wide, Seraphel 112)
    { const res = {}; let ok = true;
      for (const [id, half] of [['thrain', 24], ['aelith', 24], ['seraphel', 56]]) {
        const r = new Rec(); drawHuman(r, { facing: { x: 0, y: 1 } }, { who: id, stone: true });
        const r2 = new Rec(); const t0 = time; time += 0.77; try { drawHuman(r2, { facing: { x: 0, y: 1 } }, { who: id, stone: true }); } finally { time = t0; }
        const cols = r.cols.map(rgbOf).filter(Boolean), grey = cols.length > 30 && cols.every(c => Math.max(...c) - Math.min(...c) <= 14);
        const f = statueFit(id, 1.32, 61, half - 1), b = standOf(id);
        const top = -28 - f.foot + b.t * f.s, wide = Math.max(-b.l, b.r) * f.s;
        res[id] = { grey, still: r.sig() === r2.sig(), top: +top.toFixed(1), wide: +wide.toFixed(1), s: +f.s.toFixed(2) };
        ok = ok && grey && res[id].still && top >= -90 && wide <= half && f.s <= 1.32;
      }
      check(P + 'the statues of King Thrain, Queen Aelith and Queen Seraphel are the new look in stone (every colour grey), standing still, inside their sprites', ok, res); }

    // 9. pictures: a busy town costs a blit a person. After a first frame, the same frame again makes no picture; forty
    // townsfolk standing and walking in one frame are each put down from a picture (blits equal the people), and a
    // second pass at the same moment makes none
    { const on0 = ON.pics; let r = null;
      try {
        ON.pics = true; clearPics();
        const crowd = ids.filter(id => !LIVE.has(id)).slice(0, 40);
        const frame = () => { for (let i = 0; i < crowd.length; i++) drawHuman(ctx, { x: 0, y: 0, facing: FACE8[i % 8], moving: i % 2 === 1, walkT: i, attackT: 0, hurtT: 0 }, { who: crowd[i] }); };
        const s0 = Object.assign({}, STATS); frame();
        const s1 = Object.assign({}, STATS); frame();
        const s2 = Object.assign({}, STATS);
        r = { people: crowd.length, made1: s1.made - s0.made, made2: s2.made - s1.made, blits2: s2.pics - s1.pics, live2: s2.live - s1.live };
      } finally { ON.pics = on0; }
      check(P + 'a busy town costs a picture a person: forty townsfolk standing and walking are each put down from a picture made once, and the same frame again makes none and draws none live',
        r && r.made1 === r.people && r.made2 === 0 && r.blits2 === r.people && r.live2 === 0, r); }

    // 11. a real frame of Thistledown's square with its people out: after the first frame, the same moment drawn again
    // makes no picture and draws nobody live; every townsperson on screen is one blit
    { const at0 = { x: player.x, y: player.y }, t0 = time, d0 = dialog.cur; let r = null;
      try {
        F.tp(112, 33); dialog.cur = null; render();
        const s1 = Object.assign({}, STATS), by1 = Object.values(STATS.by).reduce((a, b) => a + b, 0);
        render();
        const by2 = Object.values(STATS.by).reduce((a, b) => a + b, 0);
        r = { people: by2 - by1, made: STATS.made - s1.made, live: STATS.live - s1.live, blits: STATS.pics - s1.pics };
      } finally { player.x = at0.x; player.y = at0.y; time = t0; dialog.cur = d0; }
      check(P + 'Thistledown\'s square, its people out: a frame drawn again makes no new picture and draws nobody live, one blit a person (' + (r ? r.people : 0) + ' people)',
        r && r.people >= 8 && r.made === 0 && r.live === 0 && r.blits === r.people, r); }

    // 10. names sit over the new heads (hats, crowns, hoods and wings included), never lower than before; the talking pose:
    // the person whose line is up, near the knight, raises a hand and moves the mouth (drawn live)
    { const low = ids.filter(id => labelUp(id, 26) < -standOf(id).t + 6 || labelUp(id, 26) < 26);
      const d0 = dialog.cur, p0 = { x: player.x, y: player.y };
      let talk = false, live = false;
      try {
        const b = NPCS.find(n => n.id === 'brakka');
        player.x = b.px; player.y = b.py + 40;
        dialog.cur = { text: 'Hot iron. Mind your hands.', who: 'Brakka the smith' }; dialog.t = 0.5;
        ART.mark((g, what, C) => { if (what === 'body' && C.talk) talk = true; });
        const l0 = STATS.live; drawHuman(ctx, { x: b.px, y: b.py, facing: { x: 0, y: 1 } }, { who: 'brakka' }); live = STATS.live === l0 + 1;
      } finally { ART.mark(null); dialog.cur = d0; player.x = p0.x; player.y = p0.y; }
      check(P + 'every name goes over the new head; the one whose line is up talks (a hand to the chest, the mouth moving), drawn live', !low.length && talk && live, { low, talk, live }); }
  });

  const API = { ON, STATS, ART, DEFAULTS, ALIAS, LIVE, takes, draw, put, portrait, statueFit, labelUp, boxOf, standOf, drawerOf, idOf, seedOf, nameKey, PICS, clearPics, tinted, Tracker, pose, headOf };
  return API;
})();
window.TOWNSFOLK = TOWNSFOLK;
