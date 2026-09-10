// ============================================================================
// LIGHTING — one registry of light sources, and Deepholm lit like the city it is
//
// WHAT WAS WRONG. Two flat scrims over every dark place at once, from two files that did not know about
// each other, and between them one hard-coded list of two tile kinds:
//
//   1. 16-instances drawDark() lights exactly two tile kinds — TORCH and DUNGEON_EXIT — plus a circle
//      round the knight. Any other lit thing a feature builds is invisible to it.
//   2. Deepholm's lamps are LAMP (24-dwarves), not TORCH, so that list would never have found them.
//      24-dwarves works around this with a second, private copy of the same technique and its own
//      hard-coded arrays. Two files, two lists, no way for a third to join in.
//   3. Worse, and measured: the core's STARTING-CAVE darkness (09-render, `isCaveTile(ptx,pty) ||
//      cam.x < (CAVE_EXIT_X+2)*TILE && cam.y < 17*TILE`) describes a rectangle in the map's top-left
//      corner — and every instance map is written into that same corner. Standing in Deepholm's
//      entrance hall the test is true (isCaveTile(14,5)); standing at the throne it is true as well
//      (cam 196,682). So the core laid a SECOND scrim over the undercity, 0.72 across rows 0–15 and
//      0.60 below, on top of the dwarves' own 0.55 — a combined 0.874 in the north, 0.82 in the south —
//      and punched two holes in it that belong to a cave 70 rows away: one at world (21, 7.5), which
//      lands inside Deepholm's east mithril gallery, and one on the starting sword at (11, 7), in the
//      entrance hall, for as long as the starting sword is left where it lies. A hall full of lamps
//      sitting in the dark, with a bright patch in the rock that answers to nothing.
//
// And in none of the three does light have a COLOUR. A hole is punched in a flat scrim with
// destination-out, so a forge, a lamp, a torch and a shaft of daylight all read the same: absence of
// dark. That is why the knight's own circle looks like a torch dragged around the room.
//
// WHAT THIS IS. A registry any feature can add to — `LIGHTS.add({ tile, r, color, tint, flicker })` —
// and one painter that uses it. Every light is cut out of the scrim as before AND painted back in its
// own colour on a second pass, so a forge is orange-hot, a lamp is warm yellow, a ladder is daylight
// and mithril is cold blue. Scenes (`LIGHTS.scene`) give a place its ambient darkness and its ROOM
// lights: soft ellipses that lift a whole hall at once, which is how the throne hall reads as a room
// rather than four lamps in a black box. The mithril galleries deliberately get no room light, so they
// stay dark and a lamp is worth walking to.
//
// HOW IT TAKES OVER without editing a core file:
//   · 16-instances and 24-dwarves each push their scrim as one world item at exactly y = 1e9. This file's
//     HOOKS.draw handler runs last (89), so those items are already in the list: while a scene of ours is
//     open they are lifted out and ours is pushed in their place. LIGHTS.stats().dropped counts them and
//     the self-test asserts it is exactly one per scene, so a double scrim can never come back unnoticed.
//   · The core's starting-cave scrim is painted inside render() itself, after HOOKS.draw, with no flag to
//     turn it off — and a feature may not edit a core file. It paints into the module-scope canvas
//     `darkLayer` and blits that. So while a scene of ours owns the screen, darkLayer hands out a context
//     that only forwards setTransform and clearRect: the core's paint goes nowhere and the blit is empty.
//     Outside an instance nothing is intercepted and the starting cave darkens exactly as it always has.
//
// Feature file: registers through HOOKS only, adds no tile, no key and no saved state.
// window.LIGHTS = { add, addSource, scene, sample, survey, lights, list, get, scenes, activeScene,
//                   profile, strengthAt, stats, suppressing }.
// ============================================================================
{
  // ---------- the falloff every light shares ----------
  // The same three gradient stops the game has always used (1 at the core, 0.75 at 55%, 0 at the rim),
  // written once as a function so what the painter draws and what LIGHTS.sample() reports cannot drift.
  const INNER_PX = 10, MID = 0.55, MID_A = 0.75;
  // A room light is not a bigger torch: a lit hall is evenly lit until it reaches its walls. Its curve holds
  // a plateau (0.88 of full at 62% of the way out) and then falls, so a hall reads as a room and a torch
  // still reads as a torch.
  const ROOM_INNER = 0.06, ROOM_SPREAD = 1.4, ROOM_MID = 0.62, ROOM_MID_A = 0.88;
  const curve = (t, mid, midA) => t <= 0 ? 1 : t >= 1 ? 0 : t <= mid ? 1 - (t / mid) * (1 - midA) : midA * (1 - (t - mid) / (1 - mid));
  const profile = t => curve(t, MID, MID_A);
  const profileRoom = t => curve(t, ROOM_MID, ROOM_MID_A);
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  // ---------- the registry ----------
  const SPECS = [];                 // every registered tile light, in registration order
  const BY_TILE = new Map();        // tile id → spec (rebuilt whenever a name resolves)
  const DYN = [];                   // fn(out, scene) — sources that are not tiles (the knight, a boss, a fireball)
  const SCENES = {};                // id → { ambient, rooms, player }
  const STATS = { dropped: 0, coreScrimSwallowed: 0, painted: 0, lights: 0 };

  function resolve() {
    BY_TILE.clear();
    for (const s of SPECS) { const id = T[s.tile]; if (id !== undefined) { s.id = id; BY_TILE.set(id, s); } }
  }
  // add({ tile, r, color, ... }) — tile is the tile NAME, never a raw id: ids move when a feature is added.
  function add(spec) {
    if (!spec || !spec.tile) throw new Error('LIGHTS.add: needs a tile name');
    const s = {
      name: spec.name || spec.tile.toLowerCase(), tile: spec.tile, id: undefined,
      r: spec.r === undefined ? 150 : spec.r,          // reach, in pixels (a tile is 48)
      lift: spec.lift === undefined ? 1 : spec.lift,   // how much of the darkness it takes away at its core, 0–1
      color: spec.color || '#ffc46a',                  // what colour it burns
      tint: spec.tint === undefined ? 0.16 : spec.tint,// how much of that colour washes over the ground
      flicker: spec.flicker || 0,                      // ± this fraction of the reach, live
      speed: spec.speed === undefined ? 7 : spec.speed,
      ox: spec.ox || 0, oy: spec.oy || 0,              // where the flame sits inside its tile
    };
    s.rgb = hexRgb(s.color);
    SPECS.push(s); resolve();
    return s;
  }
  const addSource = fn => { DYN.push(fn); return fn; };
  function scene(id, def) {
    SCENES[id] = {
      id, ambient: { color: (def.ambient && def.ambient.color) || '#04060e', alpha: (def.ambient && def.ambient.alpha) || 0.7 },
      rooms: def.rooms || [], player: def.player || null,
    };
    return SCENES[id];
  }

  // ---------- what is lit right now ----------
  // A scene owns the screen while its instance is open. An instance that asked for `dark: true` and never
  // registered a scene gets the plain cave one, so 16-instances' own dungeons keep working for free.
  function activeScene() {
    if (!window.INSTANCES) return null;
    const id = INSTANCES.active();
    if (!id) return null;
    if (SCENES[id]) return SCENES[id];
    const inst = INSTANCES.get(id);
    return inst && inst.dark ? SCENES.__cave : null;
  }

  // Collect every light that can reach a tile rect. Room lights always come (they are the size of a hall);
  // tile lights are read straight off the live map, which is the instance's map while one is open.
  function gather(sc, rect, withKnight, live) {
    const out = [];
    for (const rm of sc.rooms) {
      out.push({
        kind: 'room', name: rm.name, room: rm,
        x: (rm.x0 + rm.x1 + 1) * TILE / 2, y: (rm.y0 + rm.y1 + 1) * TILE / 2,
        rx: (rm.x1 - rm.x0 + 1) * TILE / 2 * ROOM_SPREAD, ry: (rm.y1 - rm.y0 + 1) * TILE / 2 * ROOM_SPREAD,
        lift: rm.lift, tint: rm.tint || 0, color: rm.color, rgb: hexRgb(rm.color),
      });
    }
    if (BY_TILE.size) for (let ty = rect.y0; ty <= rect.y1; ty++) for (let tx = rect.x0; tx <= rect.x1; tx++) {
      if (!inMap(tx, ty)) continue;
      const s = BY_TILE.get(map[idx(tx, ty)]);
      if (!s) continue;
      const w = (live && s.flicker) ? 1 + s.flicker * Math.sin(time * s.speed + tx * 1.7 + ty * 0.9) : 1;
      out.push({ kind: 'point', name: s.name, spec: s, at: tx + ',' + ty, x: tc(tx) + s.ox, y: tc(ty) + s.oy, r: s.r * w, lift: s.lift, tint: s.tint, color: s.color, rgb: s.rgb });
    }
    if (withKnight) for (const f of DYN) f(out, sc);
    return out;
  }
  const strengthAt = (L, x, y) => {
    if (L.kind === 'room') {
      const nd = Math.hypot((x - L.x) / L.rx, (y - L.y) / L.ry);
      return profileRoom(nd <= ROOM_INNER ? 0 : (nd - ROOM_INNER) / (1 - ROOM_INNER));
    }
    const d = Math.hypot(x - L.x, y - L.y);
    return profile(d <= INNER_PX ? 0 : (d - INNER_PX) / (L.r - INNER_PX));
  };
  const viewRect = (pad) => ({
    x0: Math.max(0, Math.floor(cam.x / TILE) - pad), x1: Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + pad),
    y0: Math.max(0, Math.floor(cam.y / TILE) - pad), y1: Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + pad),
  });

  // ---------- reading the light, in numbers ----------
  // sample(worldX, worldY) answers what the overlay does at one point: how much darkness is left over the
  // ground (alpha, 0 = fully lit, ambient = untouched) and what colour is washed over it. The painter below
  // draws exactly this, so a self-test can quote the same numbers the screen shows.
  function sample(x, y, opts = {}) {
    const sc = opts.scene ? SCENES[opts.scene] : activeScene();
    if (!sc) return { lit: false, alpha: 0, ambient: 0, cut: 0, tint: { r: 0, g: 0, b: 0, a: 0 }, top: null, sources: 0 };
    const t = Math.max(TILE * 6, 220) / TILE;
    const rect = { x0: Math.floor(x / TILE - t), x1: Math.ceil(x / TILE + t), y0: Math.floor(y / TILE - t), y1: Math.ceil(y / TILE + t) };
    const lights = gather(sc, rect, opts.knight === true, opts.live === true);
    let a = sc.ambient.alpha, tr = 0, tg = 0, tb = 0, ta = 0, top = null, best = 0, hit = 0;
    for (const L of lights) {
      const s = strengthAt(L, x, y);
      if (s <= 0) continue;
      hit++;
      const cut = L.lift * s;
      a *= (1 - cut);
      const ti = L.tint * s;
      ta += ti; tr += L.rgb[0] * ti; tg += L.rgb[1] * ti; tb += L.rgb[2] * ti;
      if (cut > best) { best = cut; top = L.name; }
    }
    return {
      lit: true, alpha: +a.toFixed(4), ambient: sc.ambient.alpha, cut: +(1 - a / sc.ambient.alpha).toFixed(4),
      tint: ta > 0 ? { r: Math.round(tr / ta), g: Math.round(tg / ta), b: Math.round(tb / ta), a: +Math.min(ta, 1).toFixed(4) } : { r: 0, g: 0, b: 0, a: 0 },
      top, sources: hit,
    };
  }
  // survey a rectangle of tiles: the place's own light, with the knight left out of it.
  function survey(x0, y0, x1, y1, opts = {}) {
    let n = 0, sum = 0, min = 9, max = -9, darkest = null, brightest = null;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!inMap(tx, ty)) continue;
      if (opts.floorOnly !== false && SOLID.has(map[idx(tx, ty)])) continue;
      const a = sample(tc(tx), tc(ty), { scene: opts.scene, knight: false }).alpha;
      n++; sum += a;
      if (a < min) { min = a; brightest = { tx, ty, alpha: a }; }
      if (a > max) { max = a; darkest = { tx, ty, alpha: a }; }
    }
    return n ? { n, mean: +(sum / n).toFixed(4), min: +min.toFixed(4), max: +max.toFixed(4), darkest, brightest } : { n: 0 };
  }

  // ---------- the painter ----------
  const layer = document.createElement('canvas');
  function paintOne(dg, L, peak, rgb) {
    const sx = L.x - cam.x, sy = L.y - cam.y;
    if (peak <= 0) return;
    if (L.kind === 'room') {
      if (sx + L.rx < 0 || sy + L.ry < 0 || sx - L.rx > VW || sy - L.ry > VH) return;
      dg.save(); dg.translate(sx, sy); dg.scale(1, L.ry / L.rx);
      const gr = dg.createRadialGradient(0, 0, L.rx * ROOM_INNER, 0, 0, L.rx);
      gr.addColorStop(0, `rgba(${rgb},${peak})`); gr.addColorStop(ROOM_MID, `rgba(${rgb},${peak * ROOM_MID_A})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      dg.fillStyle = gr; dg.beginPath(); dg.arc(0, 0, L.rx, 0, 7); dg.fill();
      dg.restore();
      return;
    }
    if (sx < -L.r || sy < -L.r || sx > VW + L.r || sy > VH + L.r) return;
    const gr = dg.createRadialGradient(sx, sy, INNER_PX, sx, sy, L.r);
    gr.addColorStop(0, `rgba(${rgb},${peak})`); gr.addColorStop(MID, `rgba(${rgb},${peak * MID_A})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    dg.fillStyle = gr; dg.beginPath(); dg.arc(sx, sy, L.r, 0, 7); dg.fill();
  }
  function paint(g, sc) {
    if (layer.width !== canvas.width || layer.height !== canvas.height) { layer.width = canvas.width; layer.height = canvas.height; }
    const dg = layer.getContext('2d');
    dg.setTransform(DPR, 0, 0, DPR, 0, 0);
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, VW, VH);
    const [ar, ag, ab] = hexRgb(sc.ambient.color);
    dg.fillStyle = `rgba(${ar},${ag},${ab},${sc.ambient.alpha})`;
    dg.fillRect(0, 0, VW, VH);
    const lights = gather(sc, viewRect(5), true, true);
    STATS.painted++; STATS.lights = lights.length;
    dg.globalCompositeOperation = 'destination-out';           // first cut the dark away
    for (const L of lights) paintOne(dg, L, L.lift, '0,0,0');
    dg.globalCompositeOperation = 'lighter';                   // then put the colour back, light on light
    for (const L of lights) paintOne(dg, L, L.tint, L.rgb.join(','));
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layer, 0, 0); g.restore();
  }

  // ---------- taking the screen over from the old scrims ----------
  // (1) The core's starting-cave scrim. See the header: its rectangle is the map's top-left corner, which is
  // also where every instance map lives, and it has no off switch. While a scene of ours is open the core's
  // paint is handed a context that only forwards setTransform and clearRect, so `darkLayer` is left empty and
  // the blit inside render() draws nothing. Everywhere else `darkLayer` behaves exactly as it always did.
  let suppress = false;
  const NOOP = () => { };
  const STOPS = { addColorStop: NOOP };
  const realDg = darkLayer.getContext.bind(darkLayer);
  const SINK = new Proxy({}, {
    get: (t, k) => {
      if (k === 'setTransform' || k === 'clearRect') return (...a) => realDg('2d')[k](...a);
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => STOPS;
      if (k === 'fillRect') return () => { STATS.coreScrimSwallowed++; };
      return typeof k === 'string' ? NOOP : undefined;
    },
    set: () => true,
  });
  darkLayer.getContext = (...a) => (suppress ? SINK : realDg(...a));

  // (2) The two instance scrims. 16-instances (`dark: true`) and 24-dwarves (Deepholm) each push exactly one
  // world item at y = 1e9. HOOKS.draw runs in file order and this file is 89, so by the time we are called the
  // item is already in the list: lift it out and put ours in its place. Nothing else pushes at that exact y
  // inside an instance — the other 1e9 items in the game are use-highlights for the bulldozer, the barrel
  // beast and the dozer bay, none of whose tiles exist on an instance map — and the self-test asserts the
  // count is exactly one in each dark place, so a second scrim can never creep back in unseen.
  const LEGACY_Y = 1e9;
  HOOKS.draw.push((g, items) => {
    const sc = activeScene();
    suppress = !!sc;                                    // set every frame: render() reaches the core's cave block after this
    if (!sc) { STATS.dropped = 0; return; }
    let dropped = 0;
    for (let i = items.length - 1; i >= 0; i--) if (items[i].y === LEGACY_Y) { items.splice(i, 1); dropped++; }
    STATS.dropped = dropped;
    items.push({ y: LEGACY_Y, draw: () => paint(g, sc) });
  });
  HOOKS.newGame.push(() => { STATS.dropped = 0; STATS.coreScrimSwallowed = 0; STATS.painted = 0; STATS.lights = 0; });

  // ============================================================================
  // THE SOURCES
  // Anything with a tile can join in from any feature file: LIGHTS.add({ tile: 'MY_BRAZIER', r, color }).
  // ============================================================================
  add({ name: 'lamp',    tile: 'LAMP',         r: 140, lift: 1.00, color: '#ffc46a', tint: 0.18, flicker: 0.05, speed: 5.0, ox: 10, oy: -12 }); // dwarven lamp: warm, steady, a hundred years of it
  add({ name: 'forge',   tile: 'FORGE',        r: 150, lift: 1.00, color: '#ff6a18', tint: 0.30, flicker: 0.14, speed: 8.5, oy: -2 });          // hotter and far redder than a lamp
  add({ name: 'torch',   tile: 'TORCH',        r: 176, lift: 1.00, color: '#ff9432', tint: 0.20, flicker: 0.12, speed: 9.0, oy: -14 });         // the coal road and the spider den
  add({ name: 'exit',    tile: 'DUNGEON_EXIT', r: 168, lift: 1.00, color: '#fff6d2', tint: 0.16, oy: -10 });                                     // daylight down the shaft
  add({ name: 'ladder',  tile: 'LADDER_UP',    r: 156, lift: 0.95, color: '#eaf1ff', tint: 0.11, oy: -10 });                                     // Deepholm's way out, cold against the lamps
  add({ name: 'fire',    tile: 'FIRE',         r: 150, lift: 1.00, color: '#ff8a24', tint: 0.24, flicker: 0.16, speed: 10 });
  add({ name: 'oven',    tile: 'OVEN',         r: 128, lift: 0.90, color: '#ffa040', tint: 0.20, flicker: 0.10, speed: 7 });
  add({ name: 'mithril', tile: 'MITHRIL',      r: 66,  lift: 0.30, color: '#9fc0e8', tint: 0.10, flicker: 0.22, speed: 3.0, oy: -4 });          // the blue rock catches what light reaches it

  // The knight carries no torch. His own light is short and nearly colourless — eyes, not a flame — so a
  // lamp is worth walking to instead of being dragged around inside a bright circle.
  addSource((out, sc) => {
    if (player.dead) return;
    const p = sc.player || {};
    out.push({ kind: 'point', name: 'knight', x: player.x, y: player.y, r: p.r || 150, lift: p.lift === undefined ? 0.85 : p.lift, tint: p.tint === undefined ? 0.04 : p.tint, color: '#cfe0f2', rgb: hexRgb('#cfe0f2') });
  });

  // ============================================================================
  // THE PLACES
  // ============================================================================
  // Any instance that asked for `dark: true` and said nothing else: a plain unlit cave.
  SCENES.__cave = { id: '__cave', ambient: { color: '#04060e', alpha: 0.70 }, rooms: [], player: { r: 160, lift: 0.88 } };
  // A cave is not a city: nobody lit it for you, so the knight's own light carries more of the work here
  // than it does in Deepholm, and the torches somebody else wedged into the rock are the landmarks.
  scene('spider_den', { ambient: { color: '#05060f', alpha: 0.72 }, player: { r: 160, lift: 0.88 } });
  scene('coalmine',   { ambient: { color: '#050508', alpha: 0.66 }, player: { r: 165, lift: 0.90 } }); // coal dust drinks the light; nine torches and the way out

  // DEEPHOLM. The rooms are 24-dwarves' own carve() rectangles. The two mithril galleries are missing from
  // this list on purpose: they get one lamp each and nothing else, so they stay dark and you walk to the lamp.
  scene('deepholm', {
    ambient: { color: '#05070f', alpha: 0.82 },
    player: { r: 128, lift: 0.70 },                    // a lit city does the work; the knight's own light steps back
    rooms: [
      { name: 'entrance hall',    x0: 11, y0: 3,  x1: 17, y1: 7,  lift: 0.62, color: '#dfe9ff', tint: 0.07 }, // daylight falls down the ladder shaft
      { name: 'the avenue',       x0: 13, y0: 8,  x1: 15, y1: 17, lift: 0.45, color: '#ffcf9c', tint: 0.06 },
      { name: 'great forge hall', x0: 6,  y0: 10, x1: 22, y1: 16, lift: 0.60, color: '#ffab5e', tint: 0.10 }, // the forges throw heat the length of it
      { name: 'throne hall',      x0: 8,  y0: 18, x1: 20, y1: 23, lift: 0.74, color: '#ffd489', tint: 0.15 }, // the grand room, and it should look like one
    ],
  });

  window.LIGHTS = {
    add, addSource, scene, sample, survey, activeScene,
    lights: (opts = {}) => { const sc = opts.scene ? SCENES[opts.scene] : activeScene(); return sc ? gather(sc, opts.rect || { x0: 0, y0: 0, x1: MAP_W - 1, y1: MAP_H - 1 }, opts.knight === true, false) : []; },
    list: () => SPECS.map(s => ({ name: s.name, tile: s.tile, id: s.id, r: s.r, lift: s.lift, color: s.color, tint: s.tint, flicker: s.flicker })),
    scenes: () => Object.keys(SCENES),
    get: name => SPECS.find(s => s.name === name),
    profile, strengthAt, stats: () => ({ ...STATS }), suppressing: () => suppress,
  };
}

// ============================================================================
// SELF-TEST
// Drawing is not exercised headless, so every check below reads LIGHTS.sample() / LIGHTS.survey() — the
// same falloff, the same lights and the same ambient the painter uses, written once above so the numbers
// quoted here and the pixels on the screen cannot drift apart.
// ============================================================================
{
  const P = 'lighting: ';
  const DH = 'deepholm';
  // 24-dwarves' own rectangles, repeated here so a hall that moves fails a test instead of going dark
  const GALLERIES = [[3, 3, 8, 9], [20, 3, 25, 9]];
  const THRONE = [8, 18, 20, 23];
  HOOKS.selfTest.push((check, F, h) => {
    if (!window.LIGHTS || !window.INSTANCES || !window.DEEPHOLM) { check(P + 'the lighting registry loaded', false, {}); return; }
    const L = window.LIGHTS, D = window.DEEPHOLM;
    h.peace(true);
    if (INSTANCES.active()) INSTANCES.leave();

    // ---- 1. every registered source lights at the radius it claims, and falls off to nothing at the rim ----
    { const bad = [];
      for (const s of L.list()) {
        const pt = { kind: 'point', x: 0, y: 0, r: s.r, lift: s.lift };
        const at = d => L.strengthAt(pt, d, 0);
        const mid = at(s.r * 0.5), edge = at(s.r), past = at(s.r * 1.5), core = at(0);
        let mono = true, prev = 1;
        for (let k = 1; k <= 20; k++) { const v = at(s.r * k / 20); if (v > prev + 1e-9) mono = false; prev = v; }
        if (!(core === 1 && edge === 0 && past === 0 && mid > 0.2 && mid < 1 && mono && s.r > 0 && s.lift > 0 && s.lift <= 1 && /^#[0-9a-f]{6}$/i.test(s.color))) bad.push({ name: s.name, core, mid: +mid.toFixed(3), edge, past, mono, r: s.r, color: s.color });
      }
      const names = L.list().map(s => s.name);
      // the list drawDark() had was two tile kinds long: TORCH and DUNGEON_EXIT. Deepholm's own lit things were in neither.
      const hasNew = ['lamp', 'forge', 'ladder', 'mithril'].every(n => names.includes(n)) && names.includes('torch') && names.includes('exit');
      check(P + `every registered source lights at the radius and colour it claims, and is nothing past its rim (${L.list().length} sources)`,
        bad.length === 0 && hasNew && L.list().length >= 8, { sources: L.list().length, names, bad, addedBeyondTheOldPair: hasNew }); }

    // ---- 2. Deepholm's twelve lamps and both forges are sources ----
    { D.enter();
      const all = L.lights({ scene: DH });
      const count = {}; for (const l of all) count[l.name] = (count[l.name] || 0) + 1;
      const at = name => all.filter(l => l.name === name).map(l => l.at).sort();
      const want = a => a.map(([x, y]) => x + ',' + y).sort();
      const lampsMatch = JSON.stringify(at('lamp')) === JSON.stringify(want(D.LAMPS));
      const forgesMatch = JSON.stringify(at('forge')) === JSON.stringify(want(D.FORGES));
      const rooms = all.filter(l => l.kind === 'room').map(l => l.name);
      check(P + 'all twelve of Deepholm’s lamps and both forges are light sources, on the tiles 24-dwarves stands them on, plus the ladder shaft and twelve mithril seams',
        count.lamp === 12 && lampsMatch && count.forge === 2 && forgesMatch && count.ladder === 1 && count.mithril === 12 && rooms.length === 4,
        { count, rooms, lampsMatch, forgesMatch, lampTiles: at('lamp'), forgeTiles: at('forge') });
      INSTANCES.leave(); }

    // ---- 3. beside a lamp it is lit; away from every source it is genuinely dark ----
    { D.enter(); F.tp(D.ENTRY[0], D.ENTRY[1]);
      const beside = L.sample(tc(12), tc(3), { knight: false });                 // the floor tile beside the entrance-hall lamp at 11,3
      let dark = { alpha: -1 };
      for (const [x0, y0, x1, y1] of GALLERIES) { const s = L.survey(x0, y0, x1, y1); if (s.n && s.max > dark.alpha) dark = { ...s.darkest, room: x0 < 10 ? 'west gallery' : 'east gallery' }; }
      const amb = L.activeScene().ambient.alpha;
      check(P + `beside a lamp the overlay is ${beside.alpha} and in the unlit mithril gallery it is ${dark.alpha} — out of an ambient darkness of ${amb}`,
        beside.alpha <= 0.10 && beside.top === 'lamp' && dark.alpha >= 0.60 && dark.alpha <= amb && amb >= 0.75,
        { besideLamp: { tile: '12,3', alpha: beside.alpha, litBy: beside.top, sources: beside.sources }, darkestGallery: dark, ambient: amb, timesDarker: +(dark.alpha / Math.max(beside.alpha, 0.0001)).toFixed(1) });
      INSTANCES.leave(); }

    // ---- 4. light has colour: a forge is not the same colour as a lamp ----
    { D.enter();
      const forge = L.sample(tc(D.FORGES[0][0]), tc(D.FORGES[0][1] + 1), { knight: false });
      const lamp = L.sample(tc(12), tc(3), { knight: false });
      const ladder = L.sample(tc(D.LADDER.x), tc(D.LADDER.y + 1), { knight: false });
      const blueGap = lamp.tint.b - forge.tint.b;                                 // the forge burns red; the lamp does not
      const coolerLadder = ladder.tint.b > forge.tint.b;
      check(P + `light carries colour — the forge washes the floor rgb(${forge.tint.r},${forge.tint.g},${forge.tint.b}) and the lamp rgb(${lamp.tint.r},${lamp.tint.g},${lamp.tint.b})`,
        forge.top === 'forge' && lamp.top === 'lamp' && blueGap >= 60 && forge.tint.a > lamp.tint.a && forge.tint.r >= 240 && coolerLadder,
        { forge: forge.tint, lamp: lamp.tint, ladder: ladder.tint, blueGap, forgeHotter: +(forge.tint.a - lamp.tint.a).toFixed(3) });
      INSTANCES.leave(); }

    // ---- 5. the throne hall reads as a room; the galleries are left dark on purpose ----
    { D.enter();
      const throne = L.survey(THRONE[0], THRONE[1], THRONE[2], THRONE[3]);
      const gal = GALLERIES.map(([a, b, c, d]) => L.survey(a, b, c, d));
      const galMean = +((gal[0].mean * gal[0].n + gal[1].mean * gal[1].n) / (gal[0].n + gal[1].n)).toFixed(4);
      const galDark = Math.max(gal[0].max, gal[1].max);
      // and the four room lights actually sit over floor 24-dwarves carved, not over rock
      const roomFloor = L.lights({ scene: DH }).filter(l => l.kind === 'room').map(l => ({ n: l.name, ok: !SOLID.has(map[idx(Math.round(l.x / TILE), Math.round(l.y / TILE))]) }));
      check(P + `the throne hall reads as the grand room it is (mean ${throne.mean}, darkest corner ${throne.max}) while the mithril galleries stay dark (mean ${galMean}, darkest ${galDark})`,
        throne.mean <= 0.22 && throne.max <= 0.35 && galMean >= throne.mean * 2 && galDark >= 0.75 && roomFloor.every(r => r.ok),
        { throneHall: throne, galleryMean: galMean, galleryDarkest: galDark, ratio: +(galMean / throne.mean).toFixed(2), roomsOverFloor: roomFloor });
      INSTANCES.leave(); }

    // ---- 6. one scrim, not three ----
    // The two flat overlays this file replaces are lifted out of the draw list, and the core's starting-cave
    // scrim — whose rectangle is the map corner every instance is written into — is swallowed instead of
    // being laid over the undercity a second time. Both are counted, so a silent return would fail here.
    { D.enter();
      // F.tp renders, so each frame is measured from a reading taken after the knight has already moved
      F.tp(D.ENTRY[0], D.ENTRY[1]);
      const hallLeak = isCaveTile(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
      const a0 = L.stats().coreScrimSwallowed; render(); const s1 = L.stats(); const hallSwallowed = s1.coreScrimSwallowed - a0;
      F.tp(D.THRONE.x, D.THRONE.y - 2);
      const throneLeak = cam.x < (CAVE_EXIT_X + 2) * TILE && cam.y < 17 * TILE;
      const b0 = L.stats().coreScrimSwallowed; render(); const s2 = L.stats(); const throneSwallowed = s2.coreScrimSwallowed - b0;
      check(P + 'one darkness over Deepholm and not three: the dwarves’ own flat scrim is lifted out of the draw list and the core’s starting-cave scrim (which really does reach the undercity) is swallowed',
        s1.dropped === 1 && s2.dropped === 1 && hallSwallowed === 1 && throneSwallowed === 1 && hallLeak && throneLeak && L.suppressing() && s2.lights > 6,
        { legacyScrimsLifted: s2.dropped, coreScrimSwallowedInTheEntranceHall: hallSwallowed, coreScrimSwallowedAtTheThrone: throneSwallowed, coreReachesEntranceHall: hallLeak, coreReachesThroneHall: throneLeak, lightsDrawn: s2.lights });
      INSTANCES.leave(); }

    // ---- 7. every dark place still darkens, and the places that were never ours are left alone ----
    { const dark = {}, ours = ['deepholm', 'spider_den', 'coalmine'];
      for (const id of ours) {
        INSTANCES.enter(id);
        const sc = L.activeScene(); const lights = L.lights();
        render();
        dark[id] = { scene: sc && sc.id, ambient: sc && sc.ambient.alpha, tileLights: lights.filter(l => l.kind === 'point').length, dropped: L.stats().dropped };
        INSTANCES.leave();
      }
      const notOurs = {};
      for (const id of ['tinker_lab', 'afterlands']) {
        if (!INSTANCES.get(id)) continue;
        INSTANCES.enter(id); render();
        notOurs[id] = { scene: L.activeScene(), dropped: L.stats().dropped, suppressing: L.suppressing() };
        INSTANCES.leave();
      }
      // the core's own starting cave is still the core's: nothing of ours is installed while you stand in it
      F.tp(10, 7); const swal0 = L.stats().coreScrimSwallowed; render();
      const cave = { isCave: isCaveTile(10, 7), scene: L.activeScene(), suppressing: L.suppressing(), swallowed: L.stats().coreScrimSwallowed - swal0 };
      check(P + 'every dark place still darkens — Deepholm, the Spider Den and the coal road each under exactly one scrim — and Tinkerton’s Lab, the Afterlands and the core’s starting cave are untouched',
        ours.every(id => dark[id].scene && dark[id].ambient >= 0.6 && dark[id].ambient <= 0.9 && dark[id].tileLights >= 1 && dark[id].dropped === 1)
        && Object.values(notOurs).every(v => v.scene === null && v.dropped === 0 && !v.suppressing)
        && cave.isCave && cave.scene === null && !cave.suppressing && cave.swallowed === 0,
        { ours: dark, untouched: notOurs, startingCave: cave }); }

    if (INSTANCES.active()) INSTANCES.leave();
    h.peace(false);
  });
}
