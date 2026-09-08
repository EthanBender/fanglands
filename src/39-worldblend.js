// ============================================================================
// WORLD BLEND — the last pass over the finished map, so the land reads as one place and not a row of
// postage stamps: an organic coastline with coves and a sandy rim, a river from Miller's Pond to the
// Grey Sea (plank bridges where it crosses the roads), the same coast treatment on the Far Shore's strait
// (33-goblincity), dithered biome edges (the Ashfields, the Jungle,
// Wolfwood, the Goblin Camp's ring, Grey Quarry), clumped woods on the open fields, and feathered grass
// edges at draw time. Feature file: registers through HOOKS only and edits no core file. Its world hook
// runs after every other feature's (file order), so it sees the finished map and only softens it.
// Everything lives in one block so no name leaks into the shared script scope.
// ============================================================================
{
  const SEED = 3907;
  const Tn = n => (n in T ? T[n] : -1);
  const ASH = Tn('ASH'), JUNGLE = Tn('JUNGLE'), FERN = Tn('FERN'), BRIDGE = Tn('BRIDGE'), DOCK = Tn('DOCK'), WARDEN_GATE = Tn('WARDEN_GATE'), BERRY = Tn('BERRY_BUSH'), DEADTREE = Tn('DEADTREE'), SCORCH = Tn('SCORCH'), OBSIDIAN = Tn('OBSIDIAN');
  const PLANKS = BRIDGE >= 0 ? BRIDGE : DOCK >= 0 ? DOCK : T.DIRT;   // what carries a road over the river
  const KEEPT = new Set([DOCK, Tn('BOAT'), Tn('SEAROCK'), Tn('DUNGEON_DOOR')].filter(v => v >= 0)); // placed by 26-boats / 16-instances: never rewritten
  const SEA = { x0: 162, y0: 0, x1: 199, y1: 95 };
  const VILL = { x0: 85, y0: 14, x1: 140, y1: 56 };
  const PAL = { x0: 142, y0: 20, x1: 158, y1: 40 };                   // the goblin palisade
  const QUARRY = { x0: 48, y0: 5, x1: 60, y1: 12 };                   // the rock rectangle the core scatters (rows 3–4 are the cliff course)
  const HF = { x0: 122, y0: 66, x1: 156, y1: 92 };                    // Hollowford: the goblins' fire cleared a rectangle of Wolfwood
  const DH = { x0: 2, y0: 72, x1: 26, y1: 94 };                       // Deepholm's walls, seen from Wolfwood as a block of rock
  const LAIR = { x0: 2, y0: 108, x1: 34, y1: 138 };                   // The Fang's lair, a block of wall in the ash
  const POND = { x: 43, y: 36 };
  // the roads every feature laid, as polylines: the river bridges them, and nothing solid is added within 2.5 tiles of them
  const ROADS = [
    [[CAVE_EXIT_X + 1, 7], [SIGN_TILE.x, SIGN_TILE.y], [84, 32]], [[SIGN_TILE.x, SIGN_TILE.y], [54, 14]],
    [[84, 32], [84, 60], [60, 70], [31, 76]], [[141, 32], [150, 30]], [[141, 14], [141, 32]], [[141, 14], [161, 14]],
    [[150, 39], [150, 50], [146, 58], [141, 64], [140, 68]],
    [[60, 94], [60, 100], [56, 104], [48, 105], [36, 105]], [[60, 100], [63, 103], [69, 103]],
    [[141, 96], [141, 101], [136, 105], [132, 109], [133, 112]],
    [[54, 13], [54, 8], [55, 8], [55, 5], [57, 5]],
  ];
  // the places that must stay mutually reachable, in chain order (the repair carves along the chain)
  const NODES = [[21, 7], [65, 27], [85, 32], [164, 14], [140, 76], [66, 100], [36, 105], [141, 96], [56, 6]];
  const NODE_NAMES = ['cave exit', 'signpost', 'Thistledown gate', 'dock', 'Hollowford', 'Dunstan', 'lair approach', 'jungle path', 'quarry shaft'];
  const GRASSY = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM]);
  const TREES = new Set([T.TREE, T.OAK]);
  const ROCKY = new Set([T.ROCK, T.IRON, T.COAL]);
  const LANDY = new Set([T.GRASS, T.TREE, T.OAK, T.FLOWERS, T.MUSHROOM]);                       // coast: land ↔ water
  const JUNGLY = new Set([T.GRASS, T.DIRT, T.TREE, T.OAK, T.FLOWERS, T.MUSHROOM, JUNGLE, FERN]); // the jungle floor the sea's south end eats
  const RIVER_CARVE = new Set([T.GRASS, T.DIRT, T.TREE, T.OAK, T.FLOWERS, T.MUSHROOM, T.SAND, T.ROCK, T.IRON, T.COAL, T.STUMP, BERRY]);
  const BRIDGEABLE = new Set([...RIVER_CARVE, T.COBBLE]);
  const RIMMABLE = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, FERN]);
  const REPAIRABLE = new Set([T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.STUMP, BERRY, JUNGLE, FERN, DEADTREE]);
  const BL = window.BLEND = { stats: {} };

  // ---------- smooth value noise: two octaves, bilinear on a lattice (6 tiles by default), 0..1 ----------
  const makeNoise = (seed, cell = 6) => {
    const r = mulberry32(seed), N = 64, lat = new Float32Array(N * N); for (let i = 0; i < lat.length; i++) lat[i] = r();
    const at = (ix, iy) => lat[((iy % N + N) % N) * N + ((ix % N + N) % N)];
    const sm = t => t * t * (3 - 2 * t);
    const oct = (x, y, c) => { const fx = x / c, fy = y / c, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy); return lerp(lerp(at(ix, iy), at(ix + 1, iy), tx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty); };
    // bilinear blends of uniform lattice values crowd the middle: stretch about 0.5 so the thresholds below mean what they say
    return (x, y) => clamp(0.5 + (oct(x, y, cell) * 0.7 + oct(x + 37.3, y + 11.7, cell / 2) * 0.3 - 0.5) * 1.7, 0, 1);
  };
  const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  const rectDist = (r, x, y) => Math.max(r.x0 - x, 0, x - r.x1, r.y0 - y, y - r.y1);
  const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)); };
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];

  // ---------- the pass ----------
  HOOKS.world.push((rnd0, api) => {
    const rnd = mulberry32(SEED);   // own stream: the result does not depend on how many draws the features before this made
    const set = api.setTile, at = api.tileAt;
    const S = BL.stats = { coast: { toWater: 0, toLand: 0, south: 0, far: 0 }, rim: 0, river: { tiles: 0, bridges: 0, banks: 0 }, relocated: [], dither: { ash: 0, column: 0, jungle: 0, wolfwood: 0, camp: 0, quarry: 0, hollowford: 0, deepholm: 0, lair: 0 }, clump: { cleared: 0, added: 0 }, reach: null, repairs: [], pockets: [], buildingsSame: null, villageSame: null };
    const sumRect = (x0, y0, x1, y1, s) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s = (Math.imul(s, 31) + at(x, y)) | 0; return s; };
    const sumBuildings = () => { let s = 7; for (const b of BUILDINGS) s = sumRect(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, s); return s; };
    const sumVillage = () => sumRect(VILL.x0, VILL.y0, VILL.x1, VILL.y1, 11);
    for (const n of NPCS) if (SOLID.has(at(n.x, n.y))) set(n.x, n.y, insideBuilding(n.x, n.y) ? T.FLOOR : T.GRASS); // the core's rule, applied before the snapshot so the checksums measure this pass alone
    const b0 = sumBuildings(), v0 = sumVillage();

    // ---- guards: tiles no pass may touch ----
    const hard = new Uint8Array(MAP_W * MAP_H);
    const mark = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(MAP_H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(MAP_W - 1, x1); x++) hard[idx(x, y)] = 1; };
    mark(0, 0, MAP_W - 1, 0); mark(0, MAP_H - 1, MAP_W - 1, MAP_H - 1); mark(0, 0, 0, MAP_H - 1); mark(MAP_W - 1, 0, MAP_W - 1, MAP_H - 1); // the tree border
    mark(0, 0, 27, 16);                                    // the cave, its mouth, the axe stump, the den door and the notice board by the road
    mark(VILL.x0 - 1, VILL.y0 - 1, VILL.x1 + 1, VILL.y1 + 1); // Thistledown, fence, gates and both road ends
    for (const b of BUILDINGS) mark(b.x - 2, b.y - 2, b.x + b.w + 1, b.y + b.h + 1);
    for (const n of NPCS) mark(n.x - 2, n.y - 2, n.x + 2, n.y + 2);
    mark(SIGN_TILE.x - 3, SIGN_TILE.y - 3, SIGN_TILE.x + 3, SIGN_TILE.y + 3);
    mark(70, 12, 82, 23); mark(70, 38, 82, 48);            // the cow and sheep pens
    mark(36, 29, 43, 44);                                  // Miller's Pond west of the stepping stones (x 43), both their landings included; the river leaves from the east shore
    mark(45, 0, 63, 4); mark(59, 4, 65, 9); mark(52, 4, 58, 15); // the cliff course, the wind shrine's clearing, the shaft lane and the miners' cart
    mark(139, 12, 163, 16); mark(140, 13, 143, 33);        // the road to the dock and its verge, the lane down the village fence
    mark(158, 9, 170, 19);                                 // the dock, Harl, his boat, the lantern: 4 tiles all round
    mark(PAL.x0 - 1, PAL.y0 - 1, PAL.x1 + 1, PAL.y1 + 1);  // the palisade and one ring of grass
    mark(138, 28, 142, 32); mark(159, 29, 161, 31);        // the camp's west gap, the climb's landing east of the palisade
    mark(168, 4, 187, 22); mark(175, 38, 198, 62);         // Gull Isle, Ironclad Isle
    mark(HF.x0 + 3, HF.y0 + 3, HF.x1 - 3, HF.y1 - 3);      // Hollowford's ruins, streets and square (its three-tile margin is blended below)
    mark(138, 62, 143, 96);                                // the road into Hollowford from the north (below the river's crossing) and the path out to the jungle
    mark(1, 95, 99, 95); mark(100, 96, 100, 138);          // the warden's tree line and the jungle's western wall: exact solid counts
    mark(56, 92, 64, 99);                                  // the warden, his gate, the road through
    mark(1, 103, 40, 107); mark(84, 100, 90, 106);         // the approach to the lair, the ruined shrine
    mark(2, 72, 26, 94); mark(2, 108, 34, 138);            // Deepholm, The Fang's lair
    mark(8, 65, 17, 72); mark(55, 83, 65, 91); mark(91, 77, 99, 85); // the graveyard, the stone circle, the watchtower
    mark(125, 113, 167, 136); mark(126, 111, 147, 114);    // Sylvaris' ring wall, the open ground before the gap
    mark(162, 40, 163, 40);                                // the boats' shore check
    mark(51, 41, 62, 50);                                  // the bulldozer's test lane south of the pens, as the core scattered it
    // the Far Shore (33-goblincity, reached by 26-boats): Harl's far dock, boat and lantern, the landing step and the road off it, four tiles all round;
    // every hut there is a BUILDINGS entry (guarded above) and every townsgoblin stands east of x 214, beyond the strait pass's reach (x ≤ 210)
    const FAR = REGIONS.find(r => r.name === 'The Far Shore') || null;
    if (FAR) mark(200, 26, 211, 34);
    const spawnG = new Uint8Array(MAP_W * MAP_H);
    const markSpawns = () => { spawnG.fill(0); for (const s of MONSTER_SPAWNS) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(s.tx + dx, s.ty + dy)) spawnG[idx(s.tx + dx, s.ty + dy)] = 1; };
    markSpawns();
    const roadD = new Float32Array(MAP_W * MAP_H).fill(99);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { let d = 99; for (const pl of ROADS) for (let s = 0; s < pl.length - 1; s++) d = Math.min(d, segDist(x, y, pl[s][0], pl[s][1], pl[s + 1][0], pl[s + 1][1])); roadD[idx(x, y)] = d; }
    const free = (x, y) => inMap(x, y) && !hard[idx(x, y)];
    const near8 = (x, y, f) => N8.some(([dx, dy]) => f(at(x + dx, y + dy)));
    const wet = t => t === T.WATER || t === T.SAND || t === BRIDGE || t === DOCK;
    const addOk = (x, y) => roadD[idx(x, y)] > 2.5 && !near8(x, y, wet); // where something solid may be added

    // ---- 1. the coastline: land against water by (x − 162) + noise×8, coves and headlands on top, the old straight shore forgotten ----
    const cn = makeNoise(SEED + 1, 7);
    const COVES = [[160, 24, 3, 1], [159, 46, 3.5, 1], [158, 58, 3, 1], [160, 72, 4, 1], [159, 86, 3, 1], [166, 38, 3.5, -1], [167, 64, 4, -1], [165, 80, 3.5, -1]]; // [x, y, r, +1 cove / −1 headland]
    const seaMade = new Set();
    for (let y = 1; y <= 94; y++) for (let x = 150; x <= 175; x++) {
      if (!free(x, y)) continue;
      let v = (x - SEA.x0) + (cn(x, y) * 2 - 1) * 8;
      for (const [cx, cy, r, sg] of COVES) { const d = dist(x, y, cx, cy); if (d < r + 1.5) v += sg * (r + 1.5 - d) * 2.5; }
      const t = at(x, y);
      if (v > 0) { if (LANDY.has(t) || (t === T.SAND && x >= SEA.x0)) { set(x, y, T.WATER); seaMade.add(idx(x, y)); S.coast.toWater++; } }
      else if (t === T.WATER || (t === T.SAND && x <= SEA.x0 + 1)) { set(x, y, T.GRASS); S.coast.toLand++; }
    }
    // the sea's south end against the jungle was a ruler line too
    for (let y = 91; y <= 99; y++) for (let x = 164; x <= 198; x++) {
      if (!free(x, y)) continue;
      const v = (SEA.y1 + 0.5 - y) + (cn(x + 200, y) * 2 - 1) * 5, t = at(x, y);
      if (v > 0) { if (y > SEA.y1 && JUNGLY.has(t)) { set(x, y, T.WATER); seaMade.add(idx(x, y)); S.coast.south++; } }
      else if (y <= SEA.y1 && t === T.WATER) { set(x, y, T.SAND); S.coast.south++; }
    }
    // ---- 1b. the Far Shore's strait: 33-goblincity carves water at x 200–203 and a sand strip at 204–206, both ruler-straight, y 4–95. The straight
    // beach is forgotten (grass; the shore rocks stay), then the water's edge wanders about x 205 by the same noise, with coves and headlands.
    // The strait must stay mostly water (33's own check counts it), so the edge is biased east and the headlands kept small.
    if (FAR) {
      const FEDGE = 205, FCOVES = [[206, 12, 3, 1], [206, 46, 3, 1], [206, 66, 3.5, 1], [206, 90, 3, 1], [202, 40, 2.5, -1], [201, 60, 3, -1], [202, 80, 2.5, -1]]; // [x, y, r, +1 cove / −1 headland]
      const FAR_LAND = new Set([T.GRASS, T.SAND, T.TREE, T.OAK, T.FLOWERS, T.MUSHROOM, T.ROCK]);
      for (let y = 4; y <= 95; y++) for (let x = 200; x <= 203; x++) if (at(x, y) === T.WATER) seaMade.add(idx(x, y)); // the strait counts as sea for the rim
      for (let y = 4; y <= 95; y++) for (let x = 200; x <= 210; x++) {
        if (!free(x, y) || KEEPT.has(at(x, y))) continue;
        let v = (FEDGE - x) + (cn(x + 300, y) * 2 - 1) * 3;   // > 0: water
        for (const [cx, cy, r, sg] of FCOVES) { const d = dist(x, y, cx, cy); if (d < r + 1.5) v += sg * (r + 1.5 - d) * 2.5; }
        const t = at(x, y);
        if (v > 0) { if (FAR_LAND.has(t)) { set(x, y, T.WATER); seaMade.add(idx(x, y)); S.coast.far++; } }
        else if (t === T.WATER) { set(x, y, T.GRASS); seaMade.delete(idx(x, y)); S.coast.far++; }
        else if (t === T.SAND) set(x, y, T.GRASS);            // the old beach; the rim pass below lays the new one along the new edge
      }
    }
    const isSea = (x, y) => at(x, y) === T.WATER && (inRect(SEA, x, y) || seaMade.has(idx(x, y)));

    // ---- 2. the river: Miller's Pond east-south-east to the sea, a noise-perturbed polyline one or two tiles wide ----
    // south off the pond's east shore first (the open fields west of the pens stay open: tests and goblins drill there), then east along
    // Wolfwood's edge, through the small pond south of Thistledown, and out to the sea by Hollowford's road
    const RIVER = [[44, 38], [47, 44], [48, 50], [52, 56], [62, 58], [72, 60], [84, 60], [94, 61], [102, 59], [110, 62], [118, 60], [124, 62], [128, 61], [134, 60], [140, 59], [146, 57], [154, 53], [178, 47]];
    const wn = makeNoise(SEED + 2, 6), ww = makeNoise(SEED + 3, 4);
    const centres = []; let acc = 0; // distance along the route: the wobble fades in over the first tiles so the channel leaves from inside the pond
    for (let s = 0; s < RIVER.length - 1; s++) {
      const [ax, ay] = RIVER[s], [bx, by] = RIVER[s + 1], len = Math.hypot(bx - ax, by - ay), tx = (bx - ax) / len, ty = (by - ay) / len;
      for (let k = 0; k <= len * 4; k++) {
        const t = Math.min(1, k / (len * 4)), px = ax + (bx - ax) * t, py = ay + (by - ay) * t, off = (wn(px, py) * 2 - 1) * 1.6 * Math.min(1, (acc + len * t) / 5);
        let x = Math.round(px - ty * off), y = Math.round(py + tx * off);
        if (x >= 118 && x <= 160 && y > 62) y = 62;         // Hollowford's guard starts at y 64: keep the second tile of the channel above it
        const last = centres[centres.length - 1];
        if (!last || last[0] !== x || last[1] !== y) centres.push([x, y]);
      }
      acc += len;
    }
    const chain = []; // 4-connected: step x first, then y
    for (const [x, y] of centres) { const last = chain[chain.length - 1]; if (last) { let [cx, cy] = last; while (cx !== x) { cx += Math.sign(x - cx); chain.push([cx, cy]); } while (cy !== y) { cy += Math.sign(y - cy); chain.push([cx, cy]); } } else chain.push([x, y]); }
    const riverSet = new Set();
    const carve = (x, y) => {
      if (!free(x, y)) return;
      const t = at(x, y); if (t === T.WATER) return;
      if (roadD[idx(x, y)] <= 1.2) { if (BRIDGEABLE.has(t)) { set(x, y, PLANKS); riverSet.add(idx(x, y)); S.river.bridges++; } return; }
      if (RIVER_CARVE.has(t)) { set(x, y, T.WATER); riverSet.add(idx(x, y)); S.river.tiles++; }
    };
    for (const [x, y] of chain) {
      if (x >= 150 && isSea(x, y)) break;                     // the sea: the river has arrived
      carve(x, y); if (ww(x, y) > 0.35) carve(x, y + 1);
    }
    // a spawn the river ran under moves to the nearest dry open ground (as the core does for doorsteps); nothing wakes in the water
    const dry = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === T.WATER) return false; return true; };
    for (const s of MONSTER_SPAWNS) {
      if (dry(s.tx, s.ty) || MONSTER_DEFS[s.type].human) continue;
      let best = null;
      for (let ring = 1; ring <= 12 && !best; ring++) for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = s.tx + dx, y = s.ty + dy;
        if (!inMap(x, y) || hard[idx(x, y)] || SOLID.has(at(x, y)) || PUSH_THROUGH.has(at(x, y)) || buildingAt(x, y) || !dry(x, y)) continue;
        const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { x, y, d };
      }
      if (best) { S.relocated.push([s.type, s.tx, s.ty, best.x, best.y]); s.movedFrom = [s.tx, s.ty]; s.tx = best.x; s.ty = best.y; }
    }
    markSpawns();
    // sandy banks: about half the grass beside the river
    const bn = makeNoise(SEED + 4, 3);
    for (const i of riverSet) { const x = i % MAP_W, y = (i / MAP_W) | 0; if (at(x, y) !== T.WATER) continue; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (free(nx, ny) && RIMMABLE.has(at(nx, ny)) && bn(nx, ny) > 0.5) { set(nx, ny, T.SAND); S.river.banks++; } } }

    // ---- 3. the sand rim: one tile wherever land meets the sea, a second where the noise says so ----
    const rn = makeNoise(SEED + 5, 5);
    const ring1 = [];
    for (let y = 0; y <= 99; y++) for (let x = 148; x <= 199; x++) if (free(x, y) && RIMMABLE.has(at(x, y)) && N4.some(([dx, dy]) => isSea(x + dx, y + dy))) ring1.push([x, y]);
    if (FAR) for (let y = 4; y <= 95; y++) for (let x = 200; x <= 211; x++) if (free(x, y) && RIMMABLE.has(at(x, y)) && N4.some(([dx, dy]) => isSea(x + dx, y + dy))) ring1.push([x, y]); // the strait's new edge
    for (const [x, y] of ring1) { set(x, y, T.SAND); S.rim++; }
    for (const [x, y] of ring1) for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (free(nx, ny) && RIMMABLE.has(at(nx, ny)) && rn(nx, ny) > 0.5) { set(nx, ny, T.SAND); S.rim++; } }
    set(162, 40, T.SAND); // the boats' shore check (also guarded, belt and braces)

    // ---- 4. biome edges: swap tiles across each straight seam by noise so the boundary wanders ----
    const dn = makeNoise(SEED + 6, 6);
    const ok = (x, y) => free(x, y) && !spawnG[idx(x, y)];
    const swap = (x, y, from, to, cond, key) => { if (!ok(x, y) || !from.has(at(x, y)) || !cond) return; set(x, y, to); S.dither[key]++; };
    const tree = () => (rnd() < 0.25 ? T.OAK : T.TREE);
    const ASHS = new Set([ASH]), JUNGLES = new Set([JUNGLE]);
    // the Ashfields' north edge (y 96): ash drifts up into Wolfwood's last rows, scorched grass shows through the first ash rows
    for (let x = 1; x <= 99; x++) {
      for (let y = 92; y <= 94; y++) swap(x, y, GRASSY, ASH, dn(x, y) > 0.5 + (94 - y) * 0.15, 'ash');
      for (let y = 96; y <= 99; y++) swap(x, y, ASHS, T.GRASS, dn(x, y) < 0.45 - (y - 96) * 0.1, 'ash');
    }
    // the jungle's west wall (x 100) stays; the ground either side of it mixes
    for (let y = 96; y <= 138; y++) {
      for (let x = 96; x <= 99; x++) swap(x, y, ASHS, T.GRASS, dn(x, y) < 0.45 - (99 - x) * 0.1, 'column');
      for (let x = 101; x <= 104; x++) swap(x, y, GRASSY, ASH, dn(x, y) > 0.5 + (x - 101) * 0.12, 'column');
    }
    // the jungle's north edge (y 96, x 101–161): jungle giants stand among Wolfwood's oaks, oaks among the giants — solid for solid, so no path changes
    for (let x = 101; x <= 161; x++) {
      for (let y = 92; y <= 95; y++) {
        swap(x, y, TREES, JUNGLE, dn(x, y) > 0.45 + (95 - y) * 0.15, 'jungle'); swap(x, y, GRASSY, FERN, dn(x + 7, y) > 0.6 + (95 - y) * 0.12, 'jungle');
        if (ok(x, y) && GRASSY.has(at(x, y)) && addOk(x, y) && dn(x + 13, y) > 0.7 + (95 - y) * 0.07) { set(x, y, JUNGLE); S.dither.jungle++; } // the jungle thickens northward
      }
      for (let y = 96; y <= 99; y++) {
        if (ok(x, y) && at(x, y) === JUNGLE && dn(x, y) < 0.55 - (y - 96) * 0.12) { set(x, y, tree()); S.dither.jungle++; }
        swap(x, y, JUNGLES, T.GRASS, dn(x + 29, y) < 0.32 - (y - 96) * 0.07, 'jungle'); // and thins southward into Wolfwood's density
      }
    }
    // Wolfwood's north edge (y 62): the wood reaches north in tongues, clearings reach south
    for (let x = 1; x <= 159; x++) {
      for (let y = 58; y <= 61; y++) if (ok(x, y) && GRASSY.has(at(x, y)) && addOk(x, y) && dn(x, y) > 0.5 + (61 - y) * 0.12) { set(x, y, tree()); S.dither.wolfwood++; }
      for (let y = 62; y <= 66; y++) swap(x, y, TREES, T.GRASS, dn(x, y) < 0.45 - (y - 62) * 0.1, 'wolfwood');
    }
    // the Goblin Camp's ring of bare grass: the thicket creeps in, trodden ground creeps out
    for (let y = 15; y <= 45; y++) for (let x = 136; x <= 164; x++) {
      const d = rectDist(PAL, x, y); if (d < 1 || d > 6 || !ok(x, y) || !GRASSY.has(at(x, y))) continue;
      const n = dn(x + 50, y);
      if (n > 0.42 + (6 - d) * 0.05 && addOk(x, y)) { set(x, y, tree()); S.dither.camp++; }
      else if (n < 0.14 + (6 - d) * 0.05) { set(x, y, T.DIRT); S.dither.camp++; }
    }
    // Grey Quarry: rock spills past the rectangle, grass eats into its edge
    for (let y = 5; y <= 18; y++) for (let x = 42; x <= 66; x++) {
      if (!ok(x, y)) continue;
      const d = rectDist(QUARRY, x, y), t = at(x, y);
      if (d >= 1 && d <= 5 && GRASSY.has(t) && addOk(x, y) && dn(x + 90, y) > 0.4 + d * 0.08) { set(x, y, rnd() < 0.2 ? T.IRON : T.ROCK); S.dither.quarry++; }
      else if (d === 0) { const depth = Math.min(x - QUARRY.x0, QUARRY.x1 - x, y - QUARRY.y0, QUARRY.y1 - y); if (depth <= 2 && ROCKY.has(t) && dn(x + 90, y) < 0.45 - depth * 0.12) { set(x, y, T.GRASS); S.dither.quarry++; } }
    }
    // Hollowford: the fire's edge was a rectangle; the wood reaches back into its margin, and scorched ground reaches out
    for (let y = HF.y0 - 3; y <= HF.y1 + 3; y++) for (let x = HF.x0 - 3; x <= HF.x1 + 3; x++) {
      if (!ok(x, y)) continue;
      const d = rectDist(HF, x, y), t = at(x, y), n = dn(x + 33, y + 17);
      if (d === 0) { const depth = Math.min(x - HF.x0, HF.x1 - x, y - HF.y0, HF.y1 - y); if (depth <= 3 && t === T.GRASS && addOk(x, y) && n > 0.5 + depth * 0.1) { set(x, y, tree()); S.dither.hollowford++; } }
      else if (d <= 3) {
        if (TREES.has(t) && n < 0.4 - (d - 1) * 0.1) { set(x, y, T.GRASS); S.dither.hollowford++; }
        else if (SCORCH >= 0 && t === T.GRASS && n > 0.78 + (d - 1) * 0.06) { set(x, y, SCORCH); S.dither.hollowford++; }
      }
    }
    // rock outcrops at the foot of Deepholm's walls, obsidian at the foot of the lair's: the blocks become massifs
    for (let y = DH.y0 - 3; y <= DH.y1 + 3; y++) for (let x = DH.x0; x <= DH.x1 + 3; x++) {
      const d = rectDist(DH, x, y); if (d < 1 || d > 3 || !ok(x, y) || !GRASSY.has(at(x, y)) || !addOk(x, y)) continue;
      if (dn(x + 120, y) > 0.5 + d * 0.1) { set(x, y, T.ROCK); S.dither.deepholm++; }
    }
    if (OBSIDIAN >= 0) for (let y = LAIR.y0; y <= LAIR.y1; y++) for (let x = LAIR.x1 + 1; x <= LAIR.x1 + 3; x++) {
      const d = x - LAIR.x1; if (!ok(x, y) || at(x, y) !== ASH || !addOk(x, y)) continue;
      if (dn(x + 140, y) > 0.5 + d * 0.1) { set(x, y, OBSIDIAN); S.dither.lair++; }
    }

    // ---- 5. the open fields: the even scatter of trees becomes copses and clearings ----
    const fn = makeNoise(SEED + 7, 8);
    for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
      if (!ok(x, y)) continue;
      const r = regionAt(x, y).name; if (r !== 'Goblin Fields' && r !== 'The Wilds') continue;
      const t = at(x, y), n = fn(x, y);
      if (TREES.has(t) && n < 0.4) { set(x, y, T.GRASS); S.clump.cleared++; }
      else if (t === T.GRASS && n > 0.75 && rnd() < 0.8 && addOk(x, y)) { set(x, y, rnd() < 0.15 ? T.OAK : T.TREE); S.clump.added++; }
    }

    // ---- 6. safety: nobody stands in a tree, nothing wakes in a pocket of wood, and the map's places still connect ----
    for (const n of NPCS) if (SOLID.has(at(n.x, n.y))) set(n.x, n.y, insideBuilding(n.x, n.y) ? T.FLOOR : T.GRASS);
    // a copse can close round a spawn's clearing: every mainland spawn must reach the cave road, or a line of trees is felled to it
    { const CLEAR = [T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM]; // the core clears these under a spawn after this hook; do it now so the check sees the clearing
      for (const sp of MONSTER_SPAWNS) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (CLEAR.includes(at(sp.tx + dx, sp.ty + dy))) set(sp.tx + dx, sp.ty + dy, T.GRASS);
      const MAINLAND = new Set(['Goblin Fields', 'The Wilds', 'Wolfwood', 'Goblin Camp', "Miller's Pond", 'Grey Quarry']);
      const FELL = new Set([T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.STUMP, BERRY]);
      for (let round = 0; round < 3; round++) {
        const seen = reachMap(); let fixed = 0;
        for (const sp of MONSTER_SPAWNS) {
          if (MONSTER_DEFS[sp.type].human || !MAINLAND.has(regionAt(sp.tx, sp.ty).name) || seen[idx(sp.tx, sp.ty)]) continue;
          let best = null;
          for (let ring = 1; ring <= 14 && !best; ring++) for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            const x = sp.tx + dx, y = sp.ty + dy; if (!inMap(x, y) || !seen[idx(x, y)]) continue;
            const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { x, y, d };
          }
          if (!best) continue;
          const steps = Math.max(Math.abs(best.x - sp.tx), Math.abs(best.y - sp.ty)); let felled = 0;
          for (let i = 0; i <= steps; i++) { const x = Math.round(sp.tx + (best.x - sp.tx) * i / steps), y = Math.round(sp.ty + (best.y - sp.ty) * i / steps); if (FELL.has(at(x, y)) && !buildingAt(x, y)) { set(x, y, T.GRASS); felled++; } }
          S.pockets.push([sp.type, sp.tx, sp.ty, felled]); fixed++;
        }
        if (!fixed) break;
      } }
    let r = reach();
    for (let k = 1; k < NODES.length && !r.every(Boolean); k++) {
      if (r[k]) continue;
      let from = k - 1; while (from > 0 && !r[from]) from--;
      const [ax, ay] = NODES[from], [bx, by] = NODES[k], steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)), carved = [];
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(ax + (bx - ax) * i / steps), y = Math.round(ay + (by - ay) * i / steps), t = at(x, y);
        if (buildingAt(x, y)) continue;
        if (REPAIRABLE.has(t)) { set(x, y, T.DIRT); carved.push([x, y]); }
        else if (t === T.WATER && riverSet.has(idx(x, y))) { set(x, y, PLANKS); carved.push([x, y]); }
      }
      S.repairs.push({ from: NODE_NAMES[from], to: NODE_NAMES[k], carved: carved.length });
      r = reach();
    }
    S.reach = r;
    S.buildingsSame = sumBuildings() === b0; S.villageSame = sumVillage() === v0;
    { const xs = new Set(); for (let y = 5; y <= 90; y++) for (let x = 150; x <= 199; x++) if (at(x, y) === T.WATER) { xs.add(x); break; } S.shoreX = xs.size; }
  });

  // BFS over walkable ground from the cave road (doors, gates and the warden's gate count as ways through)
  function reachMap() {
    const seen = new Uint8Array(MAP_W * MAP_H), q = [];
    const pass = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || t === WARDEN_GATE;
    const push = (x, y) => { if (!inMap(x, y)) return; const i = idx(x, y); if (seen[i] || !pass(tileAt(x, y))) return; seen[i] = 1; q.push(i); };
    push(NODES[0][0], NODES[0][1]); for (const [dx, dy] of N4) push(NODES[0][0] + dx, NODES[0][1] + dy);
    for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4) push(x + dx, y + dy); }
    return seen;
  }
  // a node counts as reached when it or a neighbour is (the signpost and the shaft are solid)
  function reach() {
    const seen = reachMap(), hit = (x, y) => inMap(x, y) && seen[idx(x, y)] === 1;
    return NODES.map(([x, y]) => hit(x, y) || N4.some(([dx, dy]) => hit(x + dx, y + dy)));
  }

  // ---------- draw: a soft edge where grass meets dirt, sand, cobbles, ash or scorched ground ----------
  // One flat item, sorted before everything (y −1e9), after the tile pass: a 6-px feathered strip of the neighbour's colour on the grass side.
  const EDGE = {}; const col = (n, c) => { if (n in T) EDGE[T[n]] = c; };
  col('DIRT', '#8a6740'); col('SAND', '#d9c88a'); col('COBBLE', '#7d8088'); col('ASH', '#5d5f66'); col('SCORCH', '#3d3632'); col('SOIL', '#5a3d26'); col('ASHES', '#4a4440'); col('CAVE', '#5d5f66');
  const GRASS_TEX = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, FERN].filter(t => t >= 0));
  const FEATHER = 6, strips = {};
  const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
  // side: 0 north, 1 east, 2 south, 3 west (where the neighbour is); the strip sits on that edge and fades into the tile
  const strip = (c, side) => {
    const k = c + side; if (strips[k]) return strips[k];
    const cv = document.createElement('canvas'), horiz = side === 0 || side === 2;
    cv.width = horiz ? TILE : FEATHER; cv.height = horiz ? FEATHER : TILE;
    const sg = cv.getContext('2d');
    const gr = horiz ? sg.createLinearGradient(0, side === 0 ? 0 : FEATHER, 0, side === 0 ? FEATHER : 0) : sg.createLinearGradient(side === 3 ? 0 : FEATHER, 0, side === 3 ? FEATHER : 0, 0);
    gr.addColorStop(0, rgba(c, 0.55)); gr.addColorStop(1, rgba(c, 0));
    sg.fillStyle = gr; sg.fillRect(0, 0, cv.width, cv.height);
    return strips[k] = cv;
  };
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE));
    items.push({ y: -1e9, draw: () => {
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!GRASS_TEX.has(map[idx(tx, ty)])) continue;
        const px = tx * TILE, py = ty * TILE;
        let c = EDGE[tileAt(tx, ty - 1)]; if (c) g.drawImage(strip(c, 0), px, py);
        c = EDGE[tileAt(tx + 1, ty)]; if (c) g.drawImage(strip(c, 1), px + TILE - FEATHER, py);
        c = EDGE[tileAt(tx, ty + 1)]; if (c) g.drawImage(strip(c, 2), px, py + TILE - FEATHER);
        c = EDGE[tileAt(tx - 1, ty)]; if (c) g.drawImage(strip(c, 3), px, py);
      }
    } });
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const S = BL.stats;
    { const xs = new Set(); for (let y = 5; y <= 90; y++) for (let x = 150; x <= 199; x++) if (tileAt(x, y) === T.WATER) { xs.add(x); break; }
      check('blend: the Grey Sea shore wanders (6+ distinct westmost-water columns over y 5–90), with coves and headlands', xs.size >= 6, { distinct: xs.size, coast: S.coast }); }
    { let rim = 0; for (let y = 2; y <= 93; y++) for (let x = 150; x <= 178; x++) if (tileAt(x, y) === T.SAND && N4.some(([dx, dy]) => tileAt(x + dx, y + dy) === T.WATER)) rim++;
      check('blend: a sand rim runs along the coast where the land meets the water', rim >= 60, { rim, laid: S.rim }); }
    { const seen = new Uint8Array(MAP_W * MAP_H), q = []; let sea = false;
      const push = (x, y) => { if (!inMap(x, y)) return; const i = idx(x, y); const t = tileAt(x, y); if (seen[i] || (t !== T.WATER && t !== BRIDGE && t !== DOCK)) return; seen[i] = 1; q.push(i); };
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) push(POND.x + dx, POND.y + dy); // the pond's water (its centre column is the agility course's stepping stones)
      for (let qi = 0; qi < q.length && !sea; qi++) { const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0; if (inRect(SEA, x, y) && tileAt(x, y) === T.WATER) { sea = true; break; } for (const [dx, dy] of N4) push(x + dx, y + dy); }
      check("blend: the river runs from Miller's Pond to the Grey Sea (one channel of water and bridges)", sea, { river: S.river, relocated: S.relocated }); }
    { let bridges = 0; for (let y = 30; y <= 70; y++) for (let x = 40; x <= 165; x++) if (tileAt(x, y) === PLANKS) bridges++;
      check('blend: plank bridges carry the Wolfwood path and the Hollowford road over the river', bridges >= 2, { bridges }); }
    { const r = reach(); const bad = NODE_NAMES.filter((n, i) => !r[i]);
      check('blend: cave exit, signpost, Thistledown gate, dock, Hollowford, Dunstan, the lair approach, the jungle path and the quarry shaft still connect', r.every(Boolean), { unreachable: bad, atGeneration: S.reach, repairs: S.repairs, pocketsOpened: S.pockets.length }); }
    { const bad = NPCS.filter(n => SOLID.has(tileAt(n.x, n.y))).map(n => n.id); check('blend: no NPC stands on a solid tile', bad.length === 0, { bad }); }
    check('blend: Thistledown and every building are untouched by the pass (checksums before and after)', S.buildingsSame === true && S.villageSame === true, { buildings: S.buildingsSame, village: S.villageSame });
    { let ash = 0, grass = 0; for (let y = 93; y <= 99; y++) for (let x = 10; x <= 90; x++) { const t = tileAt(x, y); if (t === ASH) ash++; else if (GRASSY.has(t)) grass++; }
      check('blend: the Ashfields edge is dithered (ash and grass both stand in rows 93–99, x 10–90)', ash > 20 && grass > 20, { ash, grass, dither: S.dither }); }
    if (REGIONS.some(r => r.name === 'The Far Shore')) {
      // the strait: 33-goblincity's water at x 200–203 met its sand at 204 along a ruler line; now the water's east edge wanders
      { const xs = new Set(); let rim = 0, water = 0; for (let y = 6; y <= 94; y++) for (let x = 210; x >= 198; x--) if (tileAt(x, y) === T.WATER) { xs.add(x); break; }
        for (let y = 4; y <= 95; y++) for (let x = 200; x <= 211; x++) { const t = tileAt(x, y); if (t === T.SAND && N4.some(([dx, dy]) => tileAt(x + dx, y + dy) === T.WATER)) rim++; }
        for (let y = 1; y <= 96; y++) for (let x = 200; x <= 203; x++) if (tileAt(x, y) === T.WATER) water++;
        check("blend: the Far Shore's strait wanders too (8+ distinct shoreline columns over y 6–94: coves and headlands) with a sand rim along it, and stays mostly water", xs.size >= 8 && rim >= 40 && water > 300, { distinct: xs.size, cols: [...xs].sort((a, b) => a - b), rim, water, far: S.coast.far }); }
      // the ferry's far dock (26-boats: dock 204–205 × 29–31, boat 203,30, landing step 206,30) is untouched and the landing still walks into town
      { const L = { x: 206, y: 30 }; const a = F.bfs(L.x, L.y, 219, 33), b = F.bfs(L.x, L.y, 216, 26);
        const dock = tileAt(204, 30) === DOCK && tileAt(205, 30) === DOCK && tileAt(203, 30) === Tn('BOAT') && tileAt(L.x, L.y) === T.SAND && tileAt(L.x + 1, L.y) === T.DIRT;
        check("blend: Harl's far dock, boat and landing step are untouched, and the landing still reaches Grubmarket's square and Grubb's doorstep on foot", dock && !!a && !!b, { dock, square: a && a.length, doorstep: b && b.length }); }
    }
    { let trees = 0, clumped = 0; for (let y = 1; y <= 61; y++) for (let x = 21; x <= 159; x++) { if (!TREES.has(tileAt(x, y)) || regionAt(x, y).name !== 'Goblin Fields') continue; trees++; if (N8.filter(([dx, dy]) => TREES.has(tileAt(x + dx, y + dy))).length >= 2) clumped++; }
      check('blend: the trees of Goblin Fields stand in copses, not an even scatter (half or more have two tree neighbours)', trees > 200 && clumped / trees >= 0.5, { trees, clumped: +(clumped / trees).toFixed(2), clump: S.clump }); }
  });
}
