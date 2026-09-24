// ============================================================================
// WORLD SHAPE — regions with real outlines, and a world with a flow through it
// src/92-worldshape.js
//
// Two owner asks, one file.
//
// 1. "the individual regions need to not be rectangular or square, they should be more abstract in shape."
//    REGIONS in 02-world are literal x0/y0/x1/y1 boxes and regionAt() is a point-in-box test, so every border
//    is a ruled line and the area banner flips on a straight edge. This file gives thirteen regions a real
//    outline — a mask per region, wobbled off its box by smooth noise, with the boundary between two
//    neighbours cut by ONE shared curve so the two masks meet exactly and leave no gap. The boxes in REGIONS
//    are left exactly as they were: everything that reads them by name (35-night's no-go rects, 65-palisade,
//    46-cinderwight, 56-ashfields, the map labels in 10-hud) keeps the number it had. Only regionAt changes.
//    The ground follows the outline, so the picture changes where the name changes.
//
// 2. "high level portions of the map should be inaccessible from lower level portions ... you should not be
//    able to just walk right from spawn to the Ashfields. So maybe we need to play with elevations a little."
//    The land is cut into steps. The Wolfwood scarp is a rock face along the new Goblin Fields / Wolfwood
//    line: where the river already runs it IS the step, and where the river is not there the scarp is, so
//    the two make one unbroken line from the western trees to the sea. Its only ways down are the two roads
//    that cross it on their plank bridges, and one flight of steps cut in the rock (Agility 18, this file).
//    The Ashfields' rim becomes a wavy cliff instead of a ruled line of trees — the same solid tiles on row
//    95, redrawn as rock and carried down to the foot of the new outline — and Warden Brann's gate stays the
//    one notch through it. The jungle's northern edge becomes a wall of giants with the old road its one gap.
//
// Nothing here invents a new story gate: the audit in 42-playthrough knows exactly three (WARDEN_GATE 11,
// LAIR_GATE 14, CRYPT_BARS 10) and a gate it does not know is a gate that never opens. Every step this file
// adds is terrain with a way through it, and every one of those ways is listed in the self-test below.
//
// Feature file: registers through HOOKS only, edits no core file. window.WORLDSHAPE exposes the tables.
// ============================================================================
{
  const SEED = 9207;
  const Tn = n => (n in T ? T[n] : -1);
  const ASH = Tn('ASH'), SCORCH = Tn('SCORCH'), JUNGLE = Tn('JUNGLE'), FERN = Tn('FERN'), DEADTREE = Tn('DEADTREE');
  const BRIDGE = Tn('BRIDGE'), DOCK = Tn('DOCK'), WARDEN_GATE = Tn('WARDEN_GATE');
  const CLIFF = addTile('CLIFF', { solid: true, tex: 'wall', mini: '#6b6157' });            // a rock face: the step between two levels
  const STEPS = addTile('SCARP_STEPS', { solid: true, tex: 'dirt', mini: '#c9a36a' });      // steps cut in the face: solid below Agility 18
  const STEPS_LV = 18;
  const WS = window.WORLDSHAPE = { shapes: {}, stats: {}, STAIRS: [], CLIFF, STEPS, STEPS_LV };

  // ---------- smooth value noise: two octaves on a lattice, 0..1 (the same shape 39-worldblend uses) ----------
  const makeNoise = (seed, cell = 8) => {
    const r = mulberry32(seed), N = 64, lat = new Float32Array(N * N); for (let i = 0; i < lat.length; i++) lat[i] = r();
    const at = (ix, iy) => lat[((iy % N + N) % N) * N + ((ix % N + N) % N)];
    const sm = t => t * t * (3 - 2 * t);
    const oct = (x, y, c) => { const fx = x / c, fy = y / c, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy); return lerp(lerp(at(ix, iy), at(ix + 1, iy), tx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty); };
    return (x, y) => clamp(0.5 + (oct(x, y, cell) * 0.7 + oct(x + 37.3, y + 11.7, cell / 2) * 0.3 - 0.5) * 1.7, 0, 1);
  };
  const wob = (seed, cell) => { const n = makeNoise(seed, cell); return (x, y) => n(x, y) * 2 - 1; };   // −1..1
  const line = (seed, cell) => { const n = makeNoise(seed, cell); return v => n(v, v * 0.37 + 7) * 2 - 1; }; // −1..1 along one axis

  // ---------- the boundary curves shared by two neighbours ----------
  // One curve per seam, read by BOTH sides, so the masks meet with no overlap and no gap of "The Wilds".
  const cGW = line(SEED + 1, 13), cWA = line(SEED + 8, 11), cWJ = line(SEED + 3, 11);
  const sGW = x => 61.5 + cGW(x) * 6.5;                                     // Goblin Fields above, Wolfwood below
  // the Ashfields' rim: the last row of rock, 95 to 99, so the face and the name end on the same line
  const footWA = x => 95 + Math.round((cWA(x) * 0.5 + 0.5) * 4);
  const sWA = x => footWA(x) + 0.5;                                        // Wolfwood above, the Ashfields below (never north of the warden's line at y 95)
  const sWJ = x => (x >= 136 && x <= 146) ? 95.5 : 95.8 + cWJ(x) * 3.8;     // Wolfwood above, the Jungle below; pinned flat over the road in
  WS.seams = { sGW, sWA, sWJ, footWA };

  // ---------- the outlines ----------
  const NATIVE_FIND = Array.prototype.find;
  const BOX = {};
  for (let i = 0; i < REGIONS.length; i++) { const r = REGIONS[i]; if (!(r.name in BOX)) BOX[r.name] = { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }; }
  const inBox = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  const edgeIn = (b, x, y) => Math.min(x - b.x0, b.x1 - x, y - b.y0, b.y1 - y);  // inward distance to the box border, negative outside

  // a blob: the box border wanders in and out by `amp`; `grow` only ever lets it wander out
  const blob = (name, amp, seed, cell, grow) => { const w = wob(seed, cell || 7); const b = BOX[name];
    return (x, y) => { const d = edgeIn(b, x, y), n = w(x, y); return d + (grow ? Math.max(0, n) : n) * amp >= 0; }; };
  // the same, but for one pair of sides only: the seam curves own the other pair
  const bandX = (name, amp, seed, cell, grow) => { const w = wob(seed, cell || 9); const b = BOX[name];
    return (x, y) => { const d = Math.min(x - b.x0, b.x1 - x), n = w(x, y); return d + (grow ? Math.max(0, n) : n) * amp >= 0; }; };
  const bandS = (name, amp, seed, cell, grow) => { const w = wob(seed, cell || 9); const b = BOX[name];   // the south side alone
    return (x, y) => { const d = b.y1 - y, n = w(x, y); return d + (grow ? Math.max(0, n) : n) * amp >= 0; }; };
  // a lobe (a headland the region throws out) and a bite (a bay something else cuts into it), both ellipses
  const near = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

  // name -> fn(x, y) -> is this tile inside the region's outline. A region with no entry here keeps its box.
  const SHAPE = {}, FREE = {};
  const put = (name, fn, free) => { if (BOX[name]) { SHAPE[name] = fn; FREE[name] = free || ''; } };

  // the four big grounds, cut by the shared seams. Their north/south edges belong to the seams, their east
  // and west to a band of noise, and each throws out a headland or takes a bay from its neighbour.
  { const gf = bandX('Goblin Fields', 7, SEED + 11, 11, true);
    put('Goblin Fields', (x, y) => y >= 0 && y < sGW(x) && (gf(x, y) || near(x, y, 24, 34, 9, 13) || near(x, y, 150, 52, 10, 8)) && !near(x, y, 66, 57, 13, 7), 'ews'); }
  { const ww = bandX('Wolfwood', 7, SEED + 12, 11, true);
    put('Wolfwood', (x, y) => y > sGW(x) && y < (x < 100 ? sWA(x) : sWJ(x)) && (ww(x, y) || near(x, y, 66, 57, 13, 7) || near(x, y, 166, 78, 9, 12)), 'ewns'); }
  { const af = bandS('The Ashfields', 9, SEED + 13, 12, true);
    put('The Ashfields', (x, y) => x <= 99 && y > sWA(x) && (af(x, y) || near(x, y, 62, 148, 26, 12) || near(x, y, 16, 146, 14, 10)), 'ns'); }
  // The Jungle's east edge wanders in as well as out. It used to grow only, out over the bottom-right dead
  // space; the Redcut (90-canyon) stands there now and red rock is not jungle, so the eastern edge frays
  // into the jungle's own box instead. Only the east: the west band is masked off (a tile deeper than the
  // band's reach from the east edge is jungle whenever the south band says so, exactly as before).
  { const jg = bandS('The Jungle', 6, SEED + 14, 12, true); const je = bandX('The Jungle', 20, SEED + 15, 9, false); const jb = BOX['The Jungle'];
    put('The Jungle', (x, y) => x >= 100 && (x > 161 ? y >= jb.y0 : y > sWJ(x)) && (((x <= jb.x1 - 21 || je(x, y)) && jg(x, y) && !near(x, y, jb.x1 + 1, 150, 13, 16)) || near(x, y, 108, 90, 7, 8) || near(x, y, 156, 90, 8, 7)), 'ne'); }   // and a bay bitten out of the east side, where the red rock country begins

  // the enclaves: a blob each, inside the ground that carries them
  { const gq = blob('Grey Quarry', 7, SEED + 21, 5, true);
    put('Grey Quarry', (x, y) => gq(x, y) || near(x, y, 54, 16, 4, 4), 'nesw'); }
  put("Miller's Pond", blob("Miller's Pond", 4.2, SEED + 22, 6), 'nesw');
  put('Goblin Camp', blob('Goblin Camp', 4.5, SEED + 23, 6, true), 'nesw');
  put('Hollowford', blob('Hollowford', 4.4, SEED + 24, 7), 'nesw');
  put('Sylvaris', blob('Sylvaris', 3.6, SEED + 25, 6, true), 'nesw');
  put('Grubmarket', blob('Grubmarket', 4.4, SEED + 26, 7), 'nesw');
  put('Castle Gnash', blob('Castle Gnash', 3.6, SEED + 27, 6, true), 'nesw');
  put('The Far Shore', blob('The Far Shore', 5.5, SEED + 28, 9), 'nesw');
  // Thistledown only ever grows: the walled town keeps every tile it has and takes in the commons outside the
  // wall - the two paddocks and the ground round them - so its edge is the town's land, not its masonry.
  { const th = blob('Thistledown', 7, SEED + 29, 8, true); const b = BOX['Thistledown'];
    put('Thistledown', (x, y) => inBox(b, x, y) || th(x, y) || near(x, y, 76, 18, 8, 7) || near(x, y, 76, 43, 8, 7), 'nesw'); }

  // ---------- what every outline must still contain ----------
  // Everything the boxes hold today: every NPC, every tile of every building, every monster spawn, and the
  // exact coordinates other files assert. A tile that comes out in the wrong region is pushed back with a
  // small disc of its own region.
  const ASSERT = [
    [60, 110, 'The Ashfields'], [60, 94, 'Wolfwood'], [150, 100, 'The Jungle'], [133, 120, 'Sylvaris'],
    [150, 160, 'The Jungle'], [250, 80, 'The Far Shore'], [216, 30, 'Grubmarket'], [224, 66, 'Castle Gnash'],
    [206, 30, 'The Far Shore'], [190, 30, 'The Grey Sea'], [178, 13, 'Gull Isle'], [187, 50, 'Ironclad Isle'],
    [140, 80, 'Hollowford'], [14, 80, 'Wolfwood'], [12, 70, 'Wolfwood'], [14, 83, 'Wolfwood'],
    [62, 6, 'Grey Quarry'], [18, 120, "The Fang's Lair"], [117, 17, 'Thistledown'], [21, 7, 'Goblin Fields'],
    [148, 34, 'Goblin Camp'], [158, 30, 'Goblin Camp'], [43, 36, "Miller's Pond"], [56, 6, 'Grey Quarry'],
    [112, 49, 'Castle Thistledown'], [152, 68, 'Hollowford'], [155, 68, 'Hollowford'], [153, 70, 'Hollowford'],
    [137, 81, 'Hollowford'], [140, 77, 'Hollowford'], [142, 81, 'Hollowford'], [226, 52, 'Castle Gnash'],
    [216, 23, 'Grubmarket'], [230, 23, 'Grubmarket'], [234, 32, 'Grubmarket'], [224, 67, 'Castle Gnash'],
    [165, 14, 'The Grey Sea'], [181, 14, 'Gull Isle'], [30, 78, 'Wolfwood'], [66, 100, 'The Ashfields'],
    [140, 68, 'Hollowford'], [140, 76, 'Hollowford'], [52, 8, 'Grey Quarry'], [48, 6, 'Grey Quarry'],
    [90, 30, 'Thistledown'], [54, 13, 'Grey Quarry'], [141, 96, 'The Jungle'], [12, 27, 'Goblin Fields'],
  ];
  const NOT = [[141, 92, 'The Jungle']]; // 25-elves: the road down to Sylvaris is still Wolfwood where it leaves the wood

  // ---------- the masks ----------
  const KEEP_TILES = new Set([Tn('BERRY_BUSH')].filter(v => v >= 0)); // tiles an earlier pass put down because of the region it read
  // 90-canyon cut the Redcut out of red rock of its own, in a region this file gives no outline to. Every tile
  // it laid stays the Redcut's, so a neighbour's outline (the Jungle's, grown out over the box) cannot rename it.
  if (window.REDCUT && REDCUT.tiles) for (const k in REDCUT.tiles) if (REDCUT.tiles[k] >= 0) KEEP_TILES.add(REDCUT.tiles[k]);
  const MASK = {}; let built = false, ON = false;
  const boxRegion = (x, y) => NATIVE_FIND.call(REGIONS, r => inBox(r, x, y)) || REGIONS[REGIONS.length - 1];
  const maskHit = (r, x, y) => { const m = MASK[r.name]; return m ? m[y * MAP_W + x] === 1 : inBox(r, x, y); };
  const resolve = (x, y) => {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return NATIVE_FIND.call(REGIONS, r => inBox(r, x, y));
    for (let i = 0; i < REGIONS.length; i++) { const r = REGIONS[i]; if (maskHit(r, x, y)) return r; }
    return undefined;
  };
  function build() {
    built = true;
    const st = WS.stats = { regions: {}, repaired: [], failed: [], spawns: MONSTER_SPAWNS.length };
    for (const name in SHAPE) {
      const b = BOX[name], fn = SHAPE[name], m = MASK[name] = new Uint8Array(MAP_W * MAP_H), pad = 16;
      const x0 = Math.max(0, b.x0 - pad), x1 = Math.min(MAP_W - 1, b.x1 + pad), y0 = Math.max(0, b.y0 - pad), y1 = Math.min(MAP_H - 1, b.y1 + pad);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (fn(x, y)) m[y * MAP_W + x] = 1;
    }
    // put back anything an outline dropped: the tile, and the ring around it, joins its own region again
    const want = [];
    for (const n of NPCS) want.push([n.x, n.y, boxRegion(n.x, n.y).name]);
    for (const b of BUILDINGS) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) want.push([x, y, boxRegion(x, y).name]);
    for (const s of MONSTER_SPAWNS) want.push([s.tx, s.ty, boxRegion(s.tx, s.ty).name]);
    // things an earlier pass put down BECAUSE of the region a tile was in (34-food's berry bushes, 62-ores'
    // seams) keep the region that put them there, so no outline swallows a bush into a region that bans it
    if (KEEP_TILES.size) for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (KEEP_TILES.has(map[y * MAP_W + x])) want.push([x, y, boxRegion(x, y).name]);
    for (const a of ASSERT) want.push(a);
    const order = {}; for (let i = 0; i < REGIONS.length; i++) if (!(REGIONS[i].name in order)) order[REGIONS[i].name] = i;
    const claim = (name, x, y, r) => {
      const m = MASK[name], rank = order[name];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        if (m) m[ny * MAP_W + nx] = 1;
        for (let i = 0; i < rank; i++) { const o = MASK[REGIONS[i].name]; if (o) o[ny * MAP_W + nx] = 0; }
      }
    };
    for (let pass = 0; pass < 6; pass++) {
      let fixed = 0;
      for (const [x, y, name] of want) { const got = resolve(x, y); if (got && got.name === name) continue;
        claim(name, x, y, pass === 0 ? 1 : 2); st.repaired.push([x, y, name, got ? got.name : 'none']); fixed++; }
      for (const [x, y, name] of NOT) { const got = resolve(x, y); if (!got || got.name !== name) continue;
        const m = MASK[name]; if (m) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H) m[ny * MAP_W + nx] = 0; }
        st.repaired.push([x, y, 'not ' + name, got.name]); fixed++; }
      if (!fixed) break;
    }
    for (const [x, y, name] of want) { const got = resolve(x, y); if (!got || got.name !== name) st.failed.push([x, y, name, got ? got.name : 'none']); }
    for (const [x, y, name] of NOT) { const got = resolve(x, y); if (got && got.name === name) st.failed.push([x, y, 'not ' + name, got.name]); }
  }
  // how far each outline is from the box it came from: the ground it actually owns against the ground the box
  // owned, and how many different positions each free side of the border sits at (a ruled line sits at one)
  function measure(st) {
    const own = {}, boxOwn = {};
    for (const name in SHAPE) { own[name] = new Uint8Array(MAP_W * MAP_H); boxOwn[name] = new Uint8Array(MAP_W * MAP_H); }
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const a = resolve(x, y), b = boxRegion(x, y);
      if (a && own[a.name]) own[a.name][y * MAP_W + x] = 1;
      if (b && boxOwn[b.name]) boxOwn[b.name][y * MAP_W + x] = 1;
    }
    for (const name in SHAPE) {
      const o = own[name], c = boxOwn[name]; let mine = 0, was = 0, diff = 0;
      for (let i = 0; i < o.length; i++) { if (o[i]) mine++; if (c[i]) was++; if (o[i] !== c[i]) diff++; }
      const sides = { n: new Set(), s: new Set(), w: new Set(), e: new Set() };
      for (let x = 0; x < MAP_W; x++) { let first = -1, last = -1;
        for (let y = 0; y < MAP_H; y++) if (o[y * MAP_W + x]) { if (first < 0) first = y; last = y; }
        if (first >= 0) { sides.n.add(first); sides.s.add(last); } }
      for (let y = 0; y < MAP_H; y++) { let first = -1, last = -1;
        for (let x = 0; x < MAP_W; x++) if (o[y * MAP_W + x]) { if (first < 0) first = x; last = x; }
        if (first >= 0) { sides.w.add(first); sides.e.add(last); } }
      const free = FREE[name] || '';
      st.regions[name] = { tiles: mine, wasBox: was, changed: diff, pct: +(100 * diff / Math.max(1, was)).toFixed(1),
        n: sides.n.size, e: sides.e.size, s: sides.s.size, w: sides.w.size,
        bends: Math.min(...[...free].map(k => sides[k].size).concat([99])) };
    }
  }
  WS.build = () => { build(); ON = true; measure(WS.stats); return WS.stats; };   // forces a rebuild
  WS.measure = () => { measure(WS.stats); return WS.stats.regions; };
  WS.regionAt = (x, y) => { if (!built) build(); return resolve(x, y) || REGIONS[REGIONS.length - 1]; };
  WS.on = () => ON;
  WS.mask = name => MASK[name];
  WS.shapes = SHAPE;
  WS.boxRegion = boxRegion;

  // ---------- the pass: the ground follows the outline, and the land gets its steps ----------
  // Runs last of all the world hooks, so the map is finished when it starts. Until this hook runs the
  // outlines are OFF and regionAt answers exactly as it always did — so every earlier pass that reads a
  // region (34-food's berry bushes, 62-ores' seams, 39-worldblend's copses) generates the world it has
  // always generated, and this file only ever changes what came after it.
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const ROADS = [
    [[CAVE_EXIT_X + 1, 7], [SIGN_TILE.x, SIGN_TILE.y], [84, 32]], [[SIGN_TILE.x, SIGN_TILE.y], [54, 14]],
    [[84, 32], [84, 60], [60, 70], [31, 76]], [[141, 32], [150, 30]], [[141, 14], [141, 32]], [[141, 14], [161, 14]],
    [[150, 39], [150, 50], [146, 58], [141, 64], [140, 68]],
    [[60, 94], [60, 100], [56, 104], [48, 105], [36, 105]], [[60, 100], [63, 103], [69, 103]],
    [[141, 96], [141, 101], [136, 105], [132, 109], [133, 112]],
    [[54, 13], [54, 8], [55, 8], [55, 5], [57, 5]],
  ];
  const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)); };
  // the ground a region wears. Only tiles that changed owner are rewritten, and only from this list.
  const PLAIN = new Set([T.GRASS, T.DIRT, T.TREE, T.OAK, T.FLOWERS, T.MUSHROOM, ASH, SCORCH, FERN, JUNGLE, DEADTREE].filter(v => v >= 0));
  const TREES = new Set([T.TREE, T.OAK]);
  const SOFT = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, FERN].filter(v => v >= 0));
  const NODES = [[21, 7], [65, 27], [85, 32], [164, 14], [140, 76], [66, 100], [36, 105], [141, 96], [56, 6], [30, 78], [12, 70], [38, 36], [152, 30], [133, 112], [112, 33]];
  const NODE_NAMES = ['cave exit', 'signpost', 'Thistledown gate', 'dock', 'Hollowford', 'Dunstan', 'lair approach', 'jungle path', 'quarry shaft', "Wren's hut", "the knight's grave", "Miller's Pond", 'goblin camp', 'Sylvaris gap', 'Thistledown square'];

  // every generation starts with the outlines OFF, so a second new game reads the same regions the first did
  { const _generateWorld = generateWorld; generateWorld = () => { ON = false; _generateWorld(); }; }

  HOOKS.world.push((rnd0, api) => {
    const rnd = mulberry32(SEED);                  // its own stream: what drew before this must not move the result
    const set = api.setTile, at = api.tileAt;
    // the world is generated from one fixed seed, so the outlines are the same every time: built once, kept
    if (!built) build();
    ON = true;                                     // from here on regionAt answers with the outlines
    const S = WS.pass = { ground: {}, cliff: 0, rim: 0, line: 0, seal: 0, giants: 0, stairs: [], repairs: [], reach: null, freed: 0, kept: 0, stranded: 0 };

    // ---- tiles no pass of this file may touch ----
    const hard = new Uint8Array(MAP_W * MAP_H);
    const mark = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(MAP_H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(MAP_W - 1, x1); x++) hard[y * MAP_W + x] = 1; };
    mark(0, 0, MAP_W - 1, 0); mark(0, MAP_H - 1, MAP_W - 1, MAP_H - 1); mark(0, 0, 0, MAP_H - 1); mark(MAP_W - 1, 0, MAP_W - 1, MAP_H - 1);  // the tree border
    mark(0, 0, 27, 17);                                    // the cave, its mouth, the axe stump, the den door
    mark(VILLAGE.x0 - 1, VILLAGE.y0 - 1, VILLAGE.x1 + 1, VILLAGE.y1 + 1);
    for (const b of BUILDINGS) mark(b.x - 2, b.y - 2, b.x + b.w + 1, b.y + b.h + 1);
    for (const n of NPCS) mark(n.x - 2, n.y - 2, n.x + 2, n.y + 2);
    mark(SIGN_TILE.x - 3, SIGN_TILE.y - 3, SIGN_TILE.x + 3, SIGN_TILE.y + 3);
    mark(70, 12, 82, 23); mark(70, 38, 82, 48);            // the cow and sheep pens
    mark(36, 29, 43, 44);                                  // Miller's Pond west of the stepping stones, both their landings
    mark(45, 0, 63, 4); mark(59, 4, 65, 9); mark(52, 4, 58, 15); // the cliff course, the wind shrine, the shaft lane, the miners' cart
    mark(139, 12, 163, 16); mark(140, 13, 143, 33);        // the road to the dock and the lane down the village fence
    mark(158, 9, 170, 19);                                 // the dock, Harl, his boat
    mark(141, 19, 159, 41); mark(138, 28, 142, 32); mark(159, 29, 161, 31); // the palisade, its west gap, the climb's landing
    mark(168, 4, 187, 22); mark(175, 38, 198, 62);         // Gull Isle, Ironclad Isle
    mark(125, 69, 153, 89); mark(138, 62, 143, 96);        // Hollowford's ruins and streets, the road in from the north and out to the jungle
    mark(150, 66, 158, 73);                                // the guild hall and its board
    mark(53, 90, 68, 106);                                 // the warden, his gate, the road through and the fork below it
    mark(1, 103, 40, 107); mark(84, 100, 90, 106);         // the approach to the lair, the ruined shrine
    mark(2, 72, 26, 94); mark(2, 108, 34, 138);            // the reclaimed Deepholm ground, The Fang's lair
    mark(8, 65, 17, 72); mark(55, 83, 65, 91); mark(91, 77, 99, 85); // the graveyard, the stone circle, the watchtower
    mark(125, 113, 167, 136); mark(126, 111, 147, 114);    // Sylvaris' ring wall and the ground before its gap
    mark(51, 41, 62, 50);                                  // the flat lane the machines are driven on, south of the pens
    mark(200, 26, 211, 34);                                // Harl's far dock, his boat and the landing step
    for (const s of MONSTER_SPAWNS) mark(s.tx - 1, s.ty - 1, s.tx + 1, s.ty + 1);
    if (window.PROGRESSION) for (const c of PROGRESSION.CROSSINGS) { mark(c.a.x - 2, c.a.y - 2, c.a.x + 2, c.a.y + 2); mark(c.b.x - 2, c.b.y - 2, c.b.x + 2, c.b.y + 2); }
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const t = at(x, y); if (t === T.WATER || t === BRIDGE || t === DOCK || t === T.COBBLE || t === WARDEN_GATE || t === T.SOIL || t === T.CROP) hard[y * MAP_W + x] = 1; }
    // how far each tile is from the nearest road, stamped out to six tiles (nothing here cares past that)
    const roadD = new Float32Array(MAP_W * MAP_H).fill(99), RD = 6;
    for (const pl of ROADS) for (let k = 0; k < pl.length - 1; k++) {
      const [ax, ay] = pl[k], [bx, by] = pl[k + 1], len = Math.max(1, Math.hypot(bx - ax, by - ay));
      for (let st = 0; st <= len * 3; st++) {
        const px = ax + (bx - ax) * st / (len * 3), py = ay + (by - ay) * st / (len * 3);
        const x0 = Math.max(0, Math.floor(px - RD)), x1 = Math.min(MAP_W - 1, Math.ceil(px + RD));
        const y0 = Math.max(0, Math.floor(py - RD)), y1 = Math.min(MAP_H - 1, Math.ceil(py + RD));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x - px, y - py); const i = y * MAP_W + x; if (d < roadD[i]) roadD[i] = d; }
      }
    }
    const free = (x, y) => x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1 && !hard[y * MAP_W + x] && !buildingAt(x, y);
    const plain = (x, y) => free(x, y) && PLAIN.has(at(x, y));
    // a face may never take the last side to stand on from a rock, a seam or a chest that had one
    const strands = (x, y) => N4.some(([dx, dy]) => { const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny) || !SOLID.has(before[ny * MAP_W + nx]) || !SOLID.has(at(nx, ny))) return false;
      return !N4.some(([ex, ey]) => { const ax = nx + ex, ay = ny + ey; return inMap(ax, ay) && !(ax === x && ay === y) && !SOLID.has(at(ax, ay)); });
    });
    const addOk = (x, y) => roadD[y * MAP_W + x] > 2.6 && !N8.some(([dx, dy]) => { const t = at(x + dx, y + dy); return t === T.WATER || t === BRIDGE || t === DOCK; });

    const before = map.slice();
    const placed = new Uint8Array(MAP_W * MAP_H);
    // `placed` is only the rock this file stood where there was open ground: the repair below may dig that
    // out again, and may never dig out a wall that was already there (the warden's tree line, a hut, a rock)
    const put = (x, y, t) => { const i = y * MAP_W + x; set(x, y, t); if (SOLID.has(t) && !SOLID.has(before[i])) placed[i] = 1; };

    // ---- 1. the ground follows the outline ----
    // Every tile the outlines moved from one region to another is dressed in the ground of the region that
    // holds it now: wood for Wolfwood, open field for the fields, ash for the Ashfields, giants and fern for
    // the jungle, worked stone for the quarry, burnt ground for Hollowford, trodden dirt for the camps.
    const tree = () => (rnd() < 0.25 ? T.OAK : T.TREE);
    const GROUND = {
      // ash and scorched ground that drifted north are left where they lie: the Ashfields' drift through Wolfwood's
      // last rows and Hollowford's burn are other files' work, and 58-underground counts them
      'Wolfwood': (x, y, t) => TREES.has(t) || t === ASH || t === SCORCH ? null : t === FERN ? T.GRASS : (t === JUNGLE || t === DEADTREE) ? tree() : (t === T.GRASS && rnd() < 0.34 && addOk(x, y)) ? tree() : null,
      'Goblin Fields': (x, y, t) => TREES.has(t) ? (rnd() < 0.75 ? T.GRASS : null) : t === FERN ? T.GRASS : (t === JUNGLE || t === DEADTREE) ? T.GRASS : null,
      'The Wilds': (x, y, t) => (t === JUNGLE || t === DEADTREE) ? tree() : null,
      'The Ashfields': (x, y, t) => ASH < 0 ? null : SOFT.has(t) ? ASH : (TREES.has(t) || t === JUNGLE) ? (DEADTREE >= 0 ? DEADTREE : null) : (t === T.DIRT && rnd() < 0.6) ? ASH : null,
      'The Jungle': (x, y, t) => JUNGLE < 0 ? null : (TREES.has(t) || t === DEADTREE) ? JUNGLE : (t === ASH || t === SCORCH) ? T.GRASS : (t === T.GRASS && FERN >= 0 && rnd() < 0.4) ? FERN : null,
      'Grey Quarry': (x, y, t) => SOFT.has(t) ? T.DIRT : TREES.has(t) ? T.ROCK : (t === T.DIRT && rnd() < 0.18 && addOk(x, y)) ? T.ROCK : null,
      'Hollowford': (x, y, t) => SCORCH < 0 ? null : SOFT.has(t) ? (rnd() < 0.7 ? SCORCH : T.GRASS) : TREES.has(t) ? T.GRASS : null,
      'Goblin Camp': (x, y, t) => SOFT.has(t) ? (rnd() < 0.55 ? T.DIRT : null) : TREES.has(t) ? T.GRASS : null,
      'Grubmarket': (x, y, t) => SOFT.has(t) ? (rnd() < 0.5 ? T.DIRT : null) : TREES.has(t) ? T.GRASS : null,
      'Castle Gnash': (x, y, t) => SOFT.has(t) ? (rnd() < 0.5 ? T.DIRT : null) : TREES.has(t) ? T.GRASS : null,
      'Thistledown': (x, y, t) => TREES.has(t) ? T.GRASS : (t === T.GRASS && rnd() < 0.22 && addOk(x, y)) ? T.DIRT : null,
      "Miller's Pond": (x, y, t) => SOFT.has(t) && N8.some(([dx, dy]) => at(x + dx, y + dy) === T.WATER) ? T.SAND : TREES.has(t) ? T.GRASS : null,
      'Sylvaris': (x, y, t) => TREES.has(t) ? (JUNGLE >= 0 ? JUNGLE : null) : (t === T.GRASS && FERN >= 0 && rnd() < 0.45) ? FERN : null,
    };
    // the ground is dressed on every tile the outlines moved from one region to another, and on every tile
    // within five of a border, so the wood starts where the wood's name starts instead of a dozen tiles later
    const BAND = 5;
    const own = new Array(MAP_W * MAP_H);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const r = resolve(x, y); own[y * MAP_W + x] = r ? r.name : ''; }
    const dist = new Int8Array(MAP_W * MAP_H).fill(-1); const q = [];
    for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
      const i = y * MAP_W + x;
      if (!N4.some(([dx, dy]) => own[(y + dy) * MAP_W + x + dx] !== own[i])) continue;
      dist[i] = 0; q.push(i);
    }
    for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0;
      if (dist[c] >= BAND) continue;
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = ny * MAP_W + nx; if (dist[n] >= 0) continue; dist[n] = dist[c] + 1; q.push(n); } }
    for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
      const i = y * MAP_W + x, name = own[i], was = boxRegion(x, y);
      if (dist[i] < 0 && (!was || was.name === name)) continue;
      const g = GROUND[name]; if (!g || !plain(x, y)) continue;
      const t = at(x, y), to = g(x, y, t);
      if (to === null || to === undefined || to === t) continue;
      put(x, y, to); S.ground[name] = (S.ground[name] || 0) + 1;
    }

    // ---- 2. the Ashfields' rim: a wavy rock scarp where a ruled line of trees stood ----
    // 37-dragonkillers grows Wolfwood's last row (y 95, x 1-99) solid so the warden's gate is the only way
    // south. Those tiles become rock, and the face is carried down to the foot of the new outline, so the
    // burnt country reads as the plateau it is. Solid for solid on row 95: not one step of the walk changes.
    for (let x = 1; x <= 99; x++) {
      if (x >= 58 && x <= 62) continue;                              // the warden's road through the rim
      const foot = footWA(x);
      for (let y = 95; y <= foot; y++) {
        const t = at(x, y);
        if (y === 95 && SOLID.has(t) && (TREES.has(t) || t === T.ROCK)) { put(x, 95, CLIFF); S.cliff++; S.rim++; continue; }
        if (!plain(x, y) || !addOk(x, y) || strands(x, y)) continue;
        put(x, y, CLIFF); S.cliff++; S.rim++;
      }
    }

    // ---- 3. the jungle's edge: a wall of giants along the new line, the old road its one gap ----
    if (JUNGLE >= 0) for (let x = 100; x <= 161; x++) {
      if (x >= 134 && x <= 148) continue;                            // the road down to Sylvaris
      const y = Math.round(sWJ(x));
      if (!plain(x, y) || !addOk(x, y) || strands(x, y)) continue;
      if (!SOLID.has(at(x, y)) && roadD[y * MAP_W + x] <= 2.6) continue;
      put(x, y, JUNGLE); S.giants++;
    }

    // ---- 4. the Wolfwood scarp: the step between the road country and the wood ----
    // The river 39-worldblend cut runs along this line for most of its length and IS the step there: the
    // knight crosses it on a plank bridge where a road meets it, or on one of the three crossing posts
    // (45-progression). Where the river is NOT the step - the western end above Miller's Pond, and wherever
    // the channel wanders off the line - a rock face stands in its place, so the two make one unbroken step
    // from the western trees to the sea. Which columns those are is not guessed: the knight is flooded out
    // from the cave road with the water and the bridges shut, and every column he still reaches at the line
    // gets a face, until he reaches none.
    {
      const water = (x, y) => at(x, y) === T.WATER;
      const canLay = (x, y) => plain(x, y) && roadD[y * MAP_W + x] > 2.6 && !water(x, y) && !strands(x, y);
      // the row the face stands in at this column: the foot of the river's south bank where the channel runs
      // along the line, and the line itself where it does not
      const rowAt = x => {
        const sy = Math.round(sGW(x));
        let wy = null; for (let y = sy - 5; y <= sy + 5; y++) if (water(x, y)) wy = y;
        const target = wy === null ? sy : wy + 1;
        for (const off of [0, 1, -1, 2, -2, 3, 4]) if (canLay(x, target + off)) return target + off;
        return null;
      };
      let prev = null;
      const lay = (x, y) => { if (!canLay(x, y)) return; put(x, y, CLIFF); S.cliff++; S.line++; };
      for (let x = 1; x <= 161; x++) {
        const y = rowAt(x);
        if (y === null) { prev = null; continue; }
        if (prev !== null && Math.abs(y - prev) > 1) { const a2 = Math.min(prev, y), b2 = Math.max(prev, y); for (let k = a2; k <= b2; k++) lay(x, k); }
        else lay(x, y);
        prev = y;
      }
    }

    // ---- 5. the jungle road forks west under the canopy run ----
    // With the jungle's edge closed the only way in is the old road at x 137-145, so the road has to go where
    // the north edge used to let a knight in: a track along the foot of the wall to the canopy course's door
    // (48-agility2 puts its approach at 121,100 and says the run is "beside the path down from Hollowford").
    { const CARVE = new Set([T.TREE, T.OAK, T.ROCK, JUNGLE, FERN, T.GRASS, T.FLOWERS, T.MUSHROOM, DEADTREE].filter(v => v >= 0));
      S.track = 0;
      for (let x = 122; x <= 140; x++) { const y = 100; if (!free(x, y) || !CARVE.has(at(x, y))) continue; set(x, y, T.DIRT); S.track++; } }

    // ---- 6. the seal, proved rather than guessed ----
    // Flood the knight out from the cave road with the water and the plank bridges shut. Every column he
    // still reaches at the line is a leak, and gets a face, until he reaches none. What is left open is the
    // two roads on their plank bridges and the steps cut in the rock.
    const canLay = (x, y) => plain(x, y) && roadD[y * MAP_W + x] > 2.6 && at(x, y) !== T.WATER && !strands(x, y);
    const north = () => {
      const seen = new Uint8Array(MAP_W * MAP_H), q = [];
      const ok = t => (!SOLID.has(t) || PUSH_THROUGH.has(t)) && t !== BRIDGE && t !== DOCK && t !== T.WATER;
      const push = (x, y) => { if (!inMap(x, y)) return; const i = y * MAP_W + x; if (seen[i] || !ok(at(x, y))) return; seen[i] = 1; q.push(i); };
      push(CAVE_EXIT_X + 1, 7);
      for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4) push(x + dx, y + dy); }
      return seen;
    };
    const SOUTH = [[30, 78, "Wren's hut"], [12, 70, "the knight's grave"], [140, 76, 'Hollowford'], [60, 94, 'the warden']];
    const leaking = seen => SOUTH.filter(([nx, ny]) => seen[ny * MAP_W + nx]).map(t => t[2]);
    for (let pass = 0; pass < 6; pass++) {
      const seen = north(); let laid = 0;
      S.passes = pass; S.leaks = leaking(seen);
      if (!S.leaks.length) break;
      for (let x = 1; x <= 161; x++) {
        const sy = Math.round(sGW(x));
        for (const off of [0, 1, -1, 2, -2, 3, -3, 4]) { const y = sy + off;
          if (!inMap(x, y) || !seen[y * MAP_W + x] || !canLay(x, y)) continue;
          put(x, y, CLIFF); S.cliff++; S.seal++; laid++; break; }
      }
      if (!laid) break;
    }
    S.sealedLeaks = leaking(north());

    // ---- 7. nobody is walled in ----
    // A rock, an obsidian seam or a chest you could stand beside before this pass must still have a side to
    // stand on, AND that side must be ground a knight can walk to. Where a face closed the last one, the face
    // gives way — tile by tile, out through this file's own rock, until it meets ground he can reach.
    { const reachSet = () => {
        const seen = new Uint8Array(MAP_W * MAP_H), q = [];
        const ok = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || t === WARDEN_GATE;
        const push = (x, y) => { if (!inMap(x, y)) return; const i = y * MAP_W + x; if (seen[i] || !ok(at(x, y))) return; seen[i] = 1; q.push(i); };
        push(CAVE_EXIT_X + 1, 7);
        for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4) push(x + dx, y + dy); }
        return seen; };
      const ground = (x, y) => { const r = resolve(x, y); return r && r.name === 'The Ashfields' && ASH >= 0 ? ASH : r && r.name === 'The Jungle' && FERN >= 0 ? FERN : T.GRASS; };
      const openBefore = (x, y) => N4.some(([dx, dy]) => inMap(x + dx, y + dy) && !SOLID.has(before[(y + dy) * MAP_W + x + dx]));
      S.freed = 0;
      let seen = reachSet();
      const served = (x, y) => N4.some(([dx, dy]) => inMap(x + dx, y + dy) && seen[(y + dy) * MAP_W + x + dx]);
      // which side of the Wolfwood line a tile sits on: the digging may open this file's rock, but it may
      // never open a way through the step itself, so it never crosses from one side to the other
      const side = (x, y) => (y < sGW(x) ? 0 : 1);
      const stranded = [];
      for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
        if (!SOLID.has(before[y * MAP_W + x]) || !SOLID.has(at(x, y))) continue;
        if (!openBefore(x, y) || served(x, y)) continue;
        if (!N4.some(([dx, dy]) => inMap(x + dx, y + dy) && placed[(y + dy) * MAP_W + x + dx])) continue;  // nothing of ours to dig: an island, not a walling-in
        stranded.push([x, y]);
      }
      for (const [x, y] of stranded) {
        if (served(x, y)) continue;
        // dig out through this file's own rock until the digging meets ground the knight can reach
        const from = [[x, y]], seenD = new Set([y * MAP_W + x]); let cut = null;
        for (let qi = 0; qi < from.length && !cut && qi < 400; qi++) {
          const [cx, cy] = from[qi];
          for (const [dx, dy] of N4) { const nx = cx + dx, ny = cy + dy, ni = ny * MAP_W + nx;
            if (!inMap(nx, ny) || seenD.has(ni) || side(nx, ny) !== side(x, y)) continue;
            if (seen[ni]) { cut = [cx, cy, nx, ny]; break; }
            if (!placed[ni]) continue;
            seenD.add(ni); from.push([nx, ny]); }
        }
        if (!cut) continue;
        // walk the dug chain back to the walled-in tile, opening every step of this file's rock
        const undo = [];
        const open = (ox, oy) => { const oi = oy * MAP_W + ox; if (!placed[oi]) return; undo.push([ox, oy, at(ox, oy)]); set(ox, oy, ground(ox, oy)); };
        let [cx, cy] = [cut[0], cut[1]];
        while (!(cx === x && cy === y)) { open(cx, cy);
          let nxt = null; for (const [dx, dy] of N4) { const nx = cx + dx, ny = cy + dy; if (inMap(nx, ny) && seenD.has(ny * MAP_W + nx) && (nx !== cx || ny !== cy)) { nxt = [nx, ny]; break; } }
          if (!nxt) break; seenD.delete(cy * MAP_W + cx); [cx, cy] = nxt; }
        open(x, y);
        // digging near the line could open a way through the step itself: if it did, the rock goes back and
        // the tile stays walled in rather than the world losing its shape
        if (undo.some(([ox, oy]) => Math.abs(oy - sGW(ox)) < 12) && leaking(north()).length) {
          for (const [ox, oy, ot] of undo) set(ox, oy, ot);
          S.kept++;
        } else { S.freed += undo.length; seen = reachSet(); }
      }
      S.stranded = stranded.length; }
    S.leaks = leaking(north());

    // ---- 8. one climb cut in the rock, so the scarp is a road for a knight who has trained ----
    // A climb is only a climb if it joins the road country to the wood, so the candidates are measured, not
    // guessed: the tile above it must be ground the knight can walk to with the bridges shut, and the tile
    // below it ground he can only reach by crossing one.
    { const walk = block => {
        const seen = new Uint8Array(MAP_W * MAP_H), q = [];
        const ok = t => (!SOLID.has(t) || PUSH_THROUGH.has(t)) && !block.has(t);
        const push = (x, y) => { if (!inMap(x, y)) return; const i = y * MAP_W + x; if (seen[i] || !ok(at(x, y))) return; seen[i] = 1; q.push(i); };
        push(CAVE_EXIT_X + 1, 7);
        for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4) push(x + dx, y + dy); }
        return seen; };
      const road = walk(new Set([BRIDGE, DOCK].filter(v => v >= 0))), everywhere = walk(new Set());
      const joins = (x, y) => { const a = (y - 1) * MAP_W + x, b = (y + 1) * MAP_W + x;
        return (road[a] && everywhere[b] && !road[b]) || (road[b] && everywhere[a] && !road[a]); };
      const cand = [];
      for (let x = 1; x <= 161; x++) for (let y = 48; y <= 76; y++) {
        if (at(x, y) !== CLIFF || !free(x, y) || roadD[y * MAP_W + x] <= 4) continue;
        if (SOLID.has(at(x, y - 1)) || SOLID.has(at(x, y + 1)) || !joins(x, y)) continue;
        cand.push([x, y]); break;
      }
      if (cand.length) { const c = cand[Math.floor(cand.length / 2)];
        set(c[0], c[1], STEPS); S.stairs.push({ x: c[0], y: c[1], tile: tileName(STEPS), lv: STEPS_LV }); }
      S.climbable = cand.length;
    }

    // ---- 9. and every place on the map still connects ----
    for (const n of NPCS) if (SOLID.has(at(n.x, n.y))) set(n.x, n.y, insideBuilding(n.x, n.y) ? T.FLOOR : T.GRASS);
    for (const sp of MONSTER_SPAWNS) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = at(sp.tx + dx, sp.ty + dy); if (t === CLIFF || t === JUNGLE) set(sp.tx + dx, sp.ty + dy, T.GRASS); }
    const reachMap = () => {
      const seen = new Uint8Array(MAP_W * MAP_H), q = [];
      const pass = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || t === WARDEN_GATE;
      const push = (x, y) => { if (!inMap(x, y)) return; const i = y * MAP_W + x; if (seen[i] || !pass(at(x, y))) return; seen[i] = 1; q.push(i); };
      push(NODES[0][0], NODES[0][1]); for (const [dx, dy] of N4) push(NODES[0][0] + dx, NODES[0][1] + dy);
      for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4) push(x + dx, y + dy); }
      return seen;
    };
    const reach = () => { const seen = reachMap(), hit = (x, y) => inMap(x, y) && seen[y * MAP_W + x] === 1; return NODES.map(([x, y]) => hit(x, y) || N4.some(([dx, dy]) => hit(x + dx, y + dy))); };
    const MINE = new Set([CLIFF, JUNGLE, T.TREE, T.OAK, T.ROCK, DEADTREE].filter(v => v >= 0));
    let r = reach();
    for (let k = 1; k < NODES.length && !r.every(Boolean); k++) {
      if (r[k]) continue;
      let from = k - 1; while (from > 0 && !r[from]) from--;
      const [ax, ay] = NODES[from], [bx, by] = NODES[k], steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      let carved = 0;
      for (let i = 0; i <= steps; i++) { const x = Math.round(ax + (bx - ax) * i / steps), y = Math.round(ay + (by - ay) * i / steps);
        if (buildingAt(x, y) || !MINE.has(at(x, y))) continue; set(x, y, T.GRASS); carved++; }
      S.repairs.push({ from: NODE_NAMES[from], to: NODE_NAMES[k], carved });
      r = reach();
    }
    S.reach = r;
    WS.STAIRS = S.stairs;
  });

  // ---------- the climbs ----------
  const agLv = () => skillLv('agility');
  if (typeof INTERESTING_TILES !== 'undefined') { INTERESTING_TILES.add(STEPS); INTERESTING_TILES.add(CLIFF); }
  let hintT = 0;
  HOOKS.newGame.push(() => { hintT = 0; WALK_OVER.delete(STEPS); });
  HOOKS.update.push(dt => {
    const lv = agLv();
    if (lv >= STEPS_LV) WALK_OVER.add(STEPS); else WALK_OVER.delete(STEPS);
    hintT = Math.max(0, hintT - dt);
    if (hintT > 0 || player.dead || player.mech) return;
    for (const st of WS.STAIRS) { if (lv >= st.lv) continue;
      if (dist(player.x, player.y, tc(st.x), tc(st.y)) < 1.6 * TILE) { notify(`Steps cut in the rock face. Agility ${st.lv} climbs the scarp here.`); hintT = 12; break; } }
  });
  // E on a climb you are agile enough for carries you over the scarp, the way the river crossings do
  // (45-progression): walking into it works too, but a tap on the iPad reaches a solid tile through `use`,
  // never through `walk`. The scarp runs east and west, so a climb is always taken north or south.
  function climbOver(tx, ty, what) {
    const py = Math.floor(player.y / TILE);
    const dy = py < ty ? 1 : py > ty ? -1 : 0;
    if (!dy) { notify(`Stand above or below the ${what} and face it.`); return true; }
    const ny = ty + dy;
    if (!inMap(tx, ny) || SOLID.has(tileAt(tx, ny))) { notify(`There is no footing on the far side of the ${what}.`); return true; }
    player.x = tc(tx); player.y = tc(ny); player.action = null;
    gainXp('agility', 40); floatText(player.x, player.y - 34, 'Up! +40 Agility xp', '#7ee787', 15); burst(player.x, player.y, '#bfe3ff', 12, 70); sfx('ui');
    return true;
  }
  HOOKS.use.push((t, tx, ty) => {
    if (t === STEPS) { if (agLv() < STEPS_LV) { notify(`These steps need Agility ${STEPS_LV}. You are ${agLv()}.`); return true; }
      return climbOver(tx, ty, 'steps'); }
    if (t === CLIFF) { notify('A rock face. The ways up are the two roads over their bridges, and the steps cut in the rock.'); return true; }
    return false;
  });
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    add('agility', `the scarp steps (Agility ${STEPS_LV})`, STEPS_LV, 40, 6, 'a climb over the Wolfwood scarp, from the road country into the wood');
  });

  // ---------- drawing: a rock face reads as a step down, not as a wall ----------
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 1);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = map[idx(tx, ty)];
      if (t !== CLIFF && t !== STEPS) continue;
      const top = tileAt(tx, ty - 1) !== CLIFF && tileAt(tx, ty - 1) !== STEPS;
      const bot = tileAt(tx, ty + 1) !== CLIFF && tileAt(tx, ty + 1) !== STEPS;
      items.push({ y: tc(ty), draw: () => {
        const cx = tc(tx), cy = tc(ty), h = TILE / 2, v = variant[idx(tx, ty)] % 3;
        g.fillStyle = '#5a5249'; g.fillRect(cx - h, cy - h, TILE, TILE);
        g.fillStyle = ['#6b6157', '#655c53', '#71675c'][v];                 // the face
        for (let r = 0; r < 3; r++) { const yy = cy - h + 3 + r * 15, off = ((r + v) % 2) * 9;
          for (let s = -1; s < 2; s++) g.fillRect(cx - h + 2 + off + s * 17, yy, 15, 12); }
        if (top) { g.fillStyle = '#8b8175'; g.fillRect(cx - h, cy - h, TILE, 5); g.fillStyle = '#9c9285'; g.fillRect(cx - h, cy - h, TILE, 2); }
        if (bot) { g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(cx - h, cy + h - 7, TILE, 7); }
        if (t === STEPS) {   // steps cut into the face, bright when the knight is agile enough for them
          g.fillStyle = WALK_OVER.has(STEPS) ? '#d8b877' : '#8a7550';
          for (let k = 0; k < 4; k++) g.fillRect(cx - h + 5 + k * 3, cy + h - 8 - k * 9, TILE - 12 - k * 5, 6);
        }
      } });
    }
  });

  // ---------- teaching regionAt() the outlines without touching 02-world ----------
  // regionAt is `REGIONS.find(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) || REGIONS[last]`,
  // and it is a const in a core file: it cannot be reassigned and 02-world cannot be edited. The one seam is
  // REGIONS.find. This override recognises that predicate by its own parameter name, recovers the tile it is
  // asking about (the predicate is a box test, so a handful of probe boxes bisect tx and ty exactly), and
  // answers from the outlines instead. Any other predicate — `r => r.name === 'Goblin Camp'`, the overlap
  // test in 28-thefang — is handed straight to Array.prototype.find, untouched.
  const KIND = new WeakMap();
  const paramName = fn => { const m = /^\s*(?:async\s*)?(?:function\s*[\w$]*\s*)?\(?\s*([A-Za-z_$][\w$]*)/.exec(String(fn)); return m ? m[1] : null; };
  const isPointBox = fn => {
    if (KIND.has(fn)) return KIND.get(fn);
    let ok = false; const p = paramName(fn);
    if (p) { const s = String(fn), e = p.replace(/\$/g, '\\$');
      ok = new RegExp('>=\\s*' + e + '\\.x0\\b').test(s) && new RegExp('<=\\s*' + e + '\\.x1\\b').test(s)
        && new RegExp('>=\\s*' + e + '\\.y0\\b').test(s) && new RegExp('<=\\s*' + e + '\\.y1\\b').test(s); }
    KIND.set(fn, ok); return ok;
  };
  const INF = Infinity;
  const bisect = (pred, vertical) => { let lo = -64, hi = 400;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2);
      const ok = vertical ? pred({ x0: -INF, x1: INF, y0: lo, y1: mid }) : pred({ x0: lo, x1: mid, y0: -INF, y1: INF });
      if (ok) hi = mid; else lo = mid + 1; }
    return lo; };
  // does the predicate say yes for this region for reasons OTHER than its box? (16-instances adds a clause
  // that compares the region by identity, so the region object itself is widened and put back, never copied)
  const allows = (r, pred) => {
    const a = r.x0, b = r.x1, c = r.y0, d = r.y1;
    r.x0 = -INF; r.x1 = INF; r.y0 = -INF; r.y1 = INF;
    try { return !!pred(r); } finally { r.x0 = a; r.x1 = b; r.y0 = c; r.y1 = d; }
  };
  Object.defineProperty(REGIONS, 'find', {
    value: function (pred, thisArg) {
      if (!ON || typeof pred !== 'function' || !isPointBox(pred)) return NATIVE_FIND.call(this, pred, thisArg);
      if (!pred({ x0: -INF, x1: INF, y0: -INF, y1: INF }) || pred({ x0: 1, x1: -1, y0: 1, y1: -1 })) return NATIVE_FIND.call(this, pred, thisArg);
      const tx = bisect(pred, false), ty = bisect(pred, true);
      if (!pred({ x0: tx, x1: tx, y0: ty, y1: ty })) return NATIVE_FIND.call(this, pred, thisArg);
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return NATIVE_FIND.call(this, pred, thisArg);
      for (let i = 0; i < this.length; i++) { const r = this[i]; if (!maskHit(r, tx, ty)) continue; if (!allows(r, pred)) continue; return r; }
      return undefined;
    }, writable: true, configurable: true, enumerable: false,
  });

  // ---------- self-test ----------
  const P = 'worldshape: ';
  HOOKS.selfTest.push((check, F, h) => {
    const S = WS.pass || {}, tiles = window.PLAYTHROUGH ? PLAYTHROUGH.pristine : map;
    const TREES2 = new Set([T.TREE, T.OAK]);
    const flood = (block, from) => {
      const seen = new Uint8Array(MAP_W * MAP_H), q = [];
      const ok = t => (!SOLID.has(t) || PUSH_THROUGH.has(t)) && !block.has(t);
      const push = (x, y) => { if (!inMap(x, y)) return; const i = idx(x, y); if (seen[i] || !ok(tiles[i])) return; seen[i] = 1; q.push(i); };
      push(from[0], from[1]);
      for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4) push(x + dx, y + dy); }
      return seen;
    };
    const at = (seen, x, y) => !!(inMap(x, y) && seen[idx(x, y)]) || N4.some(([dx, dy]) => inMap(x + dx, y + dy) && seen[idx(x + dx, y + dy)]);
    const START = [Math.floor(SPAWN.x / TILE), Math.floor(SPAWN.y / TILE)];

    // ---- 1. the outlines are outlines, not boxes ----
    { const R = WS.measure(), names = Object.keys(R).sort();
      const thin = names.filter(n => R[n].pct < 12), ruled = names.filter(n => R[n].bends < 4);
      check(P + `${names.length} regions have an outline instead of a box: each differs from its bounding box over 12%+ of the ground it owns, and every free side of its border sits at four or more different rows or columns`,
        names.length === 13 && thin.length === 0 && ruled.length === 0 && WS.stats.failed.length === 0,
        { regions: names.length, tooSquare: thin, ruledEdges: ruled, worst: names.map(n => `${n} ${R[n].pct}% bends ${R[n].bends}`).sort() }); }

    // ---- 2. regionAt on both sides of a curved border ----
    { const rows = new Set(); let cols = 0, swapped = 0;
      for (let x = 1; x <= 159; x++) {
        const yb = Math.floor(WS.seams.sGW(x)); if (yb < 3 || yb > MAP_H - 4) continue;
        const above = regionAt(x, yb).name, below = regionAt(x, yb + 1).name;
        if (above === 'Wolfwood' && below === 'Goblin Fields') swapped++;   // the wood is never north of the fields
        if (above !== 'Goblin Fields' || below !== 'Wolfwood') continue;
        cols++; rows.add(yb);
      }

      const mixed = y => { const n = new Set(); for (let x = 1; x <= 159; x++) n.add(regionAt(x, y).name); return n; };
      const row62 = mixed(62), row96 = mixed(96);
      check(P + 'regionAt answers on both sides of a curved border: the Goblin Fields / Wolfwood line bends through eight or more different rows, and one row of the map holds both names at once',
        cols >= 60 && rows.size >= 8 && swapped === 0 && row62.has('Goblin Fields') && row62.has('Wolfwood') && row96.has('Wolfwood') && row96.has('The Ashfields'),
        { columnsOnTheLine: cols, distinctRows: rows.size, rows: [...rows].sort((a, b) => a - b), sidesSwapped: swapped, row62: [...row62], row96: [...row96] }); }

    // ---- 3. the ground changes where the name changes ----
    { let fieldT = 0, fieldN = 0, woodT = 0, woodN = 0;
      for (let x = 1; x <= 159; x++) {
        const yb = Math.floor(WS.seams.sGW(x)); if (yb < 8 || yb > MAP_H - 9) continue;
        if (regionAt(x, yb).name !== 'Goblin Fields' || regionAt(x, yb + 1).name !== 'Wolfwood') continue;
        for (let d = 1; d <= 5; d++) { const t = tiles[idx(x, yb - d)]; if (!SOLID.has(t) || TREES2.has(t)) { fieldN++; if (TREES2.has(t)) fieldT++; } }
        for (let d = 1; d <= 5; d++) { const t = tiles[idx(x, yb + d)]; if (!SOLID.has(t) || TREES2.has(t)) { woodN++; if (TREES2.has(t)) woodT++; } }
      }
      let ashIn = 0, inN = 0, ashOut = 0, outN = 0;
      for (let x = 1; x <= 99; x++) {
        const f = Math.floor(WS.seams.sWA(x));
        if (regionAt(x, f).name !== 'Wolfwood' || regionAt(x, f + 1).name !== 'The Ashfields') continue;
        for (let d = 1; d <= 3; d++) { inN++; if (tiles[idx(x, f + d)] === ASH) ashIn++; }
        for (let d = 3; d <= 6; d++) { outN++; if (tiles[idx(x, 95 - d)] === ASH) ashOut++; }
      }
      const wood = woodT / Math.max(1, woodN), field = fieldT / Math.max(1, fieldN), ash = ashIn / Math.max(1, inN), green = ashOut / Math.max(1, outN);
      check(P + 'the ground changes where the name changes: wood on the Wolfwood side of the line and open field on the other, ash below the Ashfields rim and none of it six rows above',
        wood > 0.18 && field < 0.09 && wood > field * 2.5 && ash > 0.5 && green < 0.12,
        { treesWoodSide: +wood.toFixed(3), treesFieldSide: +field.toFixed(3), ashBelowRim: +ash.toFixed(3), ashSixRowsAbove: +green.toFixed(3), dressed: S.ground }); }

    // ---- 4. every region still holds what it held ----
    { const bad = [];
      for (const n of NPCS) { const want = WS.boxRegion(n.x, n.y).name; if (regionAt(n.x, n.y).name !== want) bad.push(`${n.id} @${n.x},${n.y} ${want}→${regionAt(n.x, n.y).name}`); }
      for (const b of BUILDINGS) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { const want = WS.boxRegion(x, y).name; if (regionAt(x, y).name !== want) bad.push(`${b.id} @${x},${y} ${want}→${regionAt(x, y).name}`); }
      for (const sp of MONSTER_SPAWNS) { const want = WS.boxRegion(sp.tx, sp.ty).name; if (regionAt(sp.tx, sp.ty).name !== want) bad.push(`${sp.type} @${sp.tx},${sp.ty} ${want}→${regionAt(sp.tx, sp.ty).name}`); }
      check(P + `every region still holds everything its box held: ${NPCS.length} people, ${BUILDINGS.length} buildings, ${MONSTER_SPAWNS.length} monster spawns and every coordinate another file asserts`,
        bad.length === 0 && WS.stats.failed.length === 0, { moved: bad.slice(0, 12), moves: bad.length, unrepaired: WS.stats.failed, repairs: WS.stats.repaired.length }); }

    // ---- 5. a level-1 knight cannot walk to the high country ----
    { const seen = flood(new Set(), START);
      let ash = 0, lair = 0;
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { if (!seen[idx(x, y)]) continue; const n = regionAt(x, y).name; if (n === 'The Ashfields') ash++; else if (n === "The Fang's Lair") lair++; }
      const early = [['the signpost', 65, 27], ['Duke Ferrin', 112, 49], ["Hale's dummy", 88, 42], ['the goblin walker', 152, 30], ['the edge of Hollowford', 140, 68], ['the Barrelbeast yard', 140, 86], ['Old Wren', 30, 78], ["Harl's dock", 164, 14], ['the Deepholm shaft', 56, 6], ["Miller's Pond", 38, 36], ["Sylvaris' gap", 137, 114]];
      const missed = early.filter(([n, x, y]) => !at(seen, x, y)).map(e => e[0]);
      check(P + 'a level-1 knight on foot reaches nothing of the Ashfields or The Fang\'s lair, and reaches everything the story asks of him before the warden opens his gate',
        ash === 0 && lair === 0 && missed.length === 0,
        { ashfieldTilesReached: ash, lairTilesReached: lair, cannotReach: missed, dunstan: at(seen, 67, 104), lairGate: at(seen, 18, 108) }); }

    // ---- 6. the wood is a step down, and the ways over it are counted ----
    { const BR = Tn('BRIDGE'), DK = Tn('DOCK');
      const open = flood(new Set(), START), shut = flood(new Set([BR, DK].filter(v => v >= 0)), START);
      const south = [['Old Wren', 30, 78], ["the knight's grave", 12, 70], ['Hollowford', 140, 86], ["Warden Brann's gate", 60, 94], ["Sylvaris' gap", 137, 114]];
      const stillOpen = south.filter(([n, x, y]) => at(shut, x, y)).map(e => e[0]);
      const cutOff = south.filter(([n, x, y]) => !at(open, x, y)).map(e => e[0]);
      const posts = (window.PROGRESSION ? PROGRESSION.CROSSINGS : []).map(c => `${c.a.x},${c.a.y} Agility ${c.lv}`);
      check(P + 'the wood is a step down from the road country: with the plank bridges shut nothing beyond the line can be walked to, and with them open everything can',
        stillOpen.length === 0 && cutOff.length === 0 && (S.leaks || []).length === 0 && S.cliff > 200 && (S.stairs || []).length === 1,
        { reachableWithBridgesShut: stillOpen, unreachableWithThemOpen: cutOff, rockFaceTiles: S.cliff, sealPasses: S.passes, rockFromTheSeal: S.seal,
          waysOver: ['the Wolfwood path bridge', 'the Hollowford road bridge', ...(S.stairs || []).map(t => `${t.tile} at ${t.x},${t.y} (Agility ${t.lv})`)],
          shortcutsOnTheUpperRiver: posts }); }

    // ---- 7. the climbs ----
    { const a0 = { ...player.skills.agility }, hp0 = player.hp; h.peace(true);
      const rows = [];
      for (const st of (S.stairs || [])) {
        const tile = T[st.tile];
        const side = [[st.x, st.y + 1], [st.x, st.y - 1]].find(([x, y]) => !SOLID.has(tileAt(x, y)) && !SOLID.has(tileAt(st.x, st.y - (y - st.y))));
        if (!side) { rows.push({ tile: st.tile, standing: false }); continue; }
        player.skills.agility.xp = 0; F.sim(1, []);
        const shut = SOLID.has(tile) && !WALK_OVER.has(tile);
        F.tp(side[0], side[1]); F.face(st.x, st.y); F.press('KeyE'); F.sim(2, []);
        const refused = Math.floor(player.x / TILE) === side[0] && Math.floor(player.y / TILE) === side[1] && !!notice && new RegExp('Agility ' + st.lv).test(notice.text);
        player.skills.agility.xp = XP_TABLE[st.lv]; F.sim(1, []);
        const opens = WALK_OVER.has(tile);
        F.tp(side[0], side[1]); F.face(st.x, st.y); F.press('KeyE'); F.sim(2, []);
        const over = Math.floor(player.x / TILE) !== side[0] || Math.floor(player.y / TILE) !== side[1];
        rows.push({ tile: st.tile, lv: st.lv, at: [st.x, st.y], shut, refused, opens, over, standing: true });
      }
      player.skills.agility = a0; player.hp = hp0; F.sim(1, []);
      check(P + `the steps cut in the scarp are solid below Agility ${STEPS_LV}, refuse the climb and say so, and carry the knight over the step at that level`,
        rows.length === 1 && rows.every(r => r.standing && r.shut && r.refused && r.opens && r.over), { climbs: rows }); }

    // ---- 8. the rim and the jungle's edge ----
    { let rim = 0, line = 0; for (let x = 1; x <= 99; x++) { if (x >= 59 && x <= 61) continue; if (tiles[idx(x, 95)] === CLIFF) rim++; if (SOLID.has(tiles[idx(x, 95)])) line++; }
      let band = 0; for (let x = 1; x <= 99; x++) for (let y = 96; y <= WS.seams.footWA(x); y++) if (tiles[idx(x, y)] === CLIFF) band++;
      let wall = 0, gap = 0;
      for (let x = 100; x <= 161; x++) { const y = Math.round(WS.seams.sWJ(x)); if (SOLID.has(tiles[idx(x, y)])) wall++; else if (x >= 134 && x <= 148) gap++; }
      const gateShut = DRAGON_KILLERS ? DRAGON_KILLERS.GATE_T.every(([x, y]) => tiles[idx(x, y)] === Tn('WARDEN_GATE')) : false;
      check(P + "the Ashfields' rim is a wavy rock face where a ruled line of trees stood, the warden's gate is still the one notch through it, and the jungle's edge is a wall of giants with the old road its one gap",
        rim >= 70 && line === 96 && band >= 40 && gateShut && wall >= 30, { rimRockOnRow95: rim, solidOnRow95: line, rockBelowTheRow: band, gateShut, wallOnTheJungleLine: wall, roadGapColumns: gap }); }

    // ---- 9. the gates open ----
    { const st0 = quest.stage, dk = window.DRAGON_KILLERS;
      let opened = false, ashReached = 0;
      if (dk) {
        quest.stage = 11; F.sim(2, []);
        opened = dk.GATE_T.every(([x, y]) => tileAt(x, y) === T.DIRT);
        const seen = new Uint8Array(MAP_W * MAP_H), q = [];
        const ok = t => !SOLID.has(t) || PUSH_THROUGH.has(t);
        const push = (x, y) => { if (!inMap(x, y)) return; const i = idx(x, y); if (seen[i] || !ok(tileAt(x, y))) return; seen[i] = 1; q.push(i); };
        push(START[0], START[1]);
        for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4) push(x + dx, y + dy); }
        for (let y = 96; y < MAP_H; y++) for (let x = 0; x <= 99; x++) if (seen[idx(x, y)] && regionAt(x, y).name === 'The Ashfields') ashReached++;
        quest.stage = st0; dk.closeGate(); F.sim(1, []);
      }
      check(P + "every gate on the way south opens: Warden Brann's at stage 11, and the burnt country is walkable the moment it does",
        !!dk && opened && ashReached > 1200, { gateOpensAtStage: 11, ashfieldTilesReachedAfter: ashReached, climb: (S.stairs || []).map(t => `${t.tile} Agility ${t.lv}`) }); }
  });
}
