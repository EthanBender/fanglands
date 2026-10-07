// ============================================================================
// THE ROADS (the Great Spread's Stage 6, ~/.fanglands/work/spread/spec.md §5, §6, §13 STAGE 6; ported from feat/roads2's
// engine, e9f9429, which was laid for the old 260x180 land and never merged)
// src/93-roads.js
//
// Stage 4 laid the whole network (ATLAS.TRACKS) as continuous dirt tracks. This file turns the six MAIN roads into real
// roads, and keeps every other track a track:
//
//   - a MAIN ROAD (the Cave Road, the Sea Road, the Long Road, the Goblin Road, the Wolfwood Road, the Ash Road) is ROAD,
//     three tiles wide, packed stone and gravel with wheel ruts, and a kerbed VERGE of cropped turf down either side;
//     a milestone at its head names it and everything on it; lantern posts stand along it every ~20 tiles and light the
//     dark (the Ash Road's are cairns: nothing burns out on the ash);
//   - a TRACK (Mill Lane, the Quarry Track, the Beacon Path, the Coast Path, the Jungle Path, the spurs, the Drovers'
//     Track, the Bandit Track) stays the worn dirt Stage 4 laid, with a cairn of stones every ~25 tiles (the Jungle Path
//     has lanterns, as §5 says);
//   - every signpost's arms name the NEXT stop on that road and how long the walk is ("→ Millbrook, south, 1 minute on
//     foot."), from the length of the road as it is laid (a knight walks 3.65 tiles a second; the mare twice that);
//   - places to stop for beside the roads (wrecked carts, wayshrines with their blessings, caches, a strongbox and the
//     iron key a road away, brambles, a deep pool, the traders and the named beasts): the POIs, below.
//
// HOW A ROAD IS LAID. Each leg of a main road (one track point to the next) is found by A* over a cost field: the old
// dirt track 0.5 (so the road falls into the line Stage 4 laid), open ground 1, a wood 3 (it bends round a copse rather
// than ploughing it), anything walkable that is someone else's 2 (adopted, never paved), the rest shut; a little per-tile
// jitter (its own mulberry32 stream) keeps it off a ruler. The search is bounded to the leg's box plus 24 tiles. Then the
// path is paved three wide: every tile within one of it that is ordinary open ground becomes ROAD, and the open ground
// beside the ROAD becomes VERGE. A track is walked the same way (adopted only), so its length is known and the network
// holds it.
//
// WHAT IT MAY NOT TOUCH. It runs LAST of all (a HOOKS.built pass, after every Stage 5 place), so it sees the finished land
// and no earlier pass sees it (Stage 5's lesson: an early pass moves every later pass's dice). Only ordinary ground is
// paved (grass, dirt, flowers, mushrooms, fern, sand, scorch, ash, and the trees it has to fell): never a door, a gate, a
// wall, a fence, an ore rock, a berry bush, a sign, a rail, a stake or anything a place put down. Inside every place's
// own box (the reserved plots, the built Stage 5 places, the inn's grown ground, the walled town, the camp's palisade,
// Hollowford, the lair, the cave and the other old places but the story signpost's meadow and the drill field's lane) the
// road is adopted as the place has it, never paved: a road meets a place at its gate. A doorstep, a person and a
// building keep a tile of clear ground round them. Nothing in the Ashfields is paved (roads2's open-ground rule, kept
// whole: 11-main counts grass, dirt and scorch there as the open ground between the ash): past the Warden's gate the Ash
// Road is its old dirt track across the ash, as it lies, marked by cairns.
//
// THE FOOTPRINT (§10): WORLD_REV 7. ATLAS.REVS[7] is every tile this pass changed or walked, grown by 2 (the road
// corridors and the cells of the things beside them), as row runs: an older save's diffs there are swept (a knight's
// plank on the new road comes back to him).
//
// Feature file: registers through HOOKS and wraps placeAction (as 93-spread does); no core file edits.
// ============================================================================
{
  const A = ATLAS, Tn = n => (n in T ? T[n] : -1);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const WALK = 175 / TILE, RIDE = 350 / TILE;   // tiles a second: the knight on foot (3.65) and on the mare (7.29)
  const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
  const SEED = (() => { let h = 2166136261; for (const c of '93-roads') h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; })();

  // ---------- the two tiles (made by the pass, after PROP and DECO, so no older tile id moves) ----------
  let T_ROAD = -1, T_VERGE = -1;
  const ensureTiles = () => {
    if (T_ROAD >= 0) return;
    if (window.DECO) DECO.ensure();
    T_ROAD = addTile('ROAD', { tex: 'dirt', mini: '#a89a74' });       // packed stone and gravel: the travelled way
    T_VERGE = addTile('VERGE', { tex: 'grass', mini: '#7f9455' });    // the kerbed strip of cropped turf either side
    RD.tiles.road = T_ROAD; RD.tiles.verge = T_VERGE;
    // ordinary ground: the mare may be tied on the road and a knight may stand anything on it the rules allow (the
    // wrap below keeps the road itself clear)
    PLACEABLE_ON.add(T_ROAD); PLACEABLE_ON.add(T_VERGE);
    if (typeof TAP_NAMES !== 'undefined') Object.assign(TAP_NAMES, { ROAD: 'Road', VERGE: 'Verge' });
  };

  // ---------- the network's names ----------
  const NAMES = {
    r1_cave: ['The Cave Road', 'The cave mouth to Thistledown'], r2_sea: ['The Sea Road', "Thistledown's east gate to Harl's dock"],
    r3_long: ['The Long Road', 'Thistledown, over the Old Bridge, to Hollowford'], r4_goblin: ['The Goblin Road', 'The Goblin Camp to Hollowford'],
    r5_wolfwood: ['The Wolfwood Road', 'The Old Bridge to the graveyard'], r6_ash: ['The Ash Road', "The Crossroads Inn to the Fang's lair"],
  };
  const RD = window.ROADS = {
    tiles: { road: -1, verge: -1 }, NAMES, WALK, RIDE, roads: {}, net: new Uint8Array(0), laid: [], stats: {}, things: new Map(), lights: [],
    // a road's laid length in tiles from track point k0 to k1 (either order), and the seconds that is on foot
    // (a fractional k lies between two track points: a fork on a road's line)
    span: (id, k0, k1) => { const r = RD.roads[id]; if (!r || !r.cum.length) return null; const n = r.cum.length - 1;
      const at = k => { k = Math.max(0, Math.min(n, k)); const a = Math.floor(k), f = k - a; return a >= n ? r.cum[n] : r.cum[a] + (r.cum[a + 1] - r.cum[a]) * f; };
      return Math.abs(at(k1) - at(k0)); },
    secs: tiles => tiles / WALK,
  };

  // ---------- what ground is what ----------
  let PAVE = null, FELL = null, VERGEABLE = null, ADOPT = null, GATES = null;
  const sets = () => {
    if (PAVE) return;
    const S = names => new Set(names.map(Tn).filter(v => v >= 0));
    PAVE = S(['GRASS', 'DIRT', 'FLOWERS', 'MUSHROOM', 'SAND', 'SCORCH', 'ASH', 'FERN', 'AF_DRYGRASS', 'AF_SINGED', 'AF_CINDERS']);
    FELL = S(['TREE', 'OAK', 'DEADTREE', 'DEAD_TREE', 'AF_CHARTREE']);             // a wood: felled only where going round costs more
    VERGEABLE = S(['GRASS', 'DIRT', 'FLOWERS', 'MUSHROOM', 'FERN', 'SAND', 'SCORCH', 'ASH', 'AF_DRYGRASS', 'AF_SINGED', 'AF_CINDERS']);
    ADOPT = S(['DIRT', 'COBBLE', 'BRIDGE', 'DOCK', 'GATE', 'SAND', 'SCORCH', 'ASHES', 'FLOOR', 'PLATFORM', 'CANOPY_DECK', 'LAIR_BONES', 'CITY_GATE', 'TD_LAWN']);
    GATES = S(['WARDEN_GATE', 'LAIR_GATE', 'CRYPT_BARS', 'CITY_GATE', 'GATE', 'DOOR', 'PORTCULLIS', 'SCARP_STEPS']);   // the story gates, open (quest-complete)
  };
  const walkable = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || GATES.has(t);

  // the places a road meets at their gate and never paves inside: every Atlas place's box and every reserved plot, but
  // Thistledown (its walls: the walled town, not the fields round it), the camp (its palisade), the story signpost's
  // meadow and the drill field's lane; and a built place's grown ground (the inn's)
  const OPEN_PLACES = new Set(['thistledown', 'camp', 'signpost', 'drill_field']);
  let PROTECT = null;   // Uint8Array: 1 = adopt only
  function buildProtect() {
    const P = new Uint8Array(MAP_W * MAP_H);
    const mark = b => { for (let y = Math.max(0, b[1]); y <= Math.min(MAP_H - 1, b[3]); y++) for (let x = Math.max(0, b[0]); x <= Math.min(MAP_W - 1, b[2]); x++) P[y * MAP_W + x] = 1; };
    for (const id of Object.keys(A.ANCHORS)) { if (OPEN_PLACES.has(id)) continue; const b = A.box(id); if (b) mark(b); }
    // Hollowford's burn: the scorched ring the fire left round the ruins, 8 tiles out (97-spreadchecks' seam transects read
    // its blend into the wood; a road paved through it would rule three of their lines): the roads come in on their old tracks
    // (16 on its west side, where the transects run 16 tiles out into the wood: the Long Road comes in on its old track)
    { const b = A.box('hollowford'); mark([b[0] - 16, b[1] - 8, b[2] + 8, b[3] + 8]); }
    for (const [, info] of A.BUILT) if (info.box) mark(info.box);
    mark([VILLAGE.x0 - 1, VILLAGE.y0 - 1, VILLAGE.x1 + 1, VILLAGE.y1 + 1]);
    { const CP = A.frame('camp'), r = CP.box([147, 20, 158, 40]); mark([r[0] - 1, r[1] - 1, r[2] + 1, r[3] + 1]); }   // the palisade and a tile round it
    // the blood portals' keep-clear rings (§4: a ring of 3) and Sylvaris' growth ring are reserved ground too
    for (const pid of Object.keys(A.PORTS).filter(k => /\.blood_portal$/.test(k))) { const [px, py] = A.port(pid).map(Math.round); mark([px - 3, py - 3, px + 3, py + 3]); }
    // a doorstep, a building and a person: a tile of clear ground round each
    for (const b of BUILDINGS) mark([b.x - 1, b.y - 1, b.x + b.w, b.y + b.h]);
    for (const n of NPCS) mark([n.x - 1, n.y - 1, n.x + 1, n.y + 1]);
    const DOORISH = new Set(['DOOR', 'COFFINDOOR', 'DUNGEON_DOOR', 'CRYPT_DOOR', 'HATCH', 'HOUSE_PORTAL', 'SHAFT', 'HITCH'].map(Tn).filter(v => v >= 0));
    for (let i = 0; i < map.length; i++) if (DOORISH.has(map[i])) { const x = i % MAP_W, y = (i / MAP_W) | 0; mark([x - 1, y - 1, x + 1, y + 1]); }
    PROTECT = P; RD.protect = P;
  }
  // the Ashfields as 11-main counts them (its open-ground rule): the stretched rows 96..138, from the first column to the
  // Ashfields / Jungle wall, the lair aside
  let inAF = () => false;
  function buildAF() {
    const AW = A.world, LAIR = A.frame('fang_lair').rect({ x0: 2, y0: 108, x1: 34, y1: 138 }), y0 = AW.ty(96), y1 = AW.ty(138), x0 = AW.tx(1);
    const edge = new Int16Array(MAP_H).fill(-1); for (let y = y0; y <= y1; y++) edge[y] = AW.line('jungle_west', y) - 1;
    inAF = (x, y) => y >= y0 && y <= y1 && x >= x0 && x <= edge[y] && !(x >= LAIR.x0 && x <= LAIR.x1 && y >= LAIR.y0 && y <= LAIR.y1);
    RD.inAF = (x, y) => inAF(x, y);
  }
  // may this tile become ROAD? (ordinary ground, outside every place and outside the Ashfields: past the Warden's gate the
  // Ash Road is the old track across the ash, as it lies, marked by cairns; 11-main's open ground there is untouched)
  const pavable = (x, y) => { if (!inMap(x, y) || x < 1 || y < 1 || x > MAP_W - 2 || y > MAP_H - 2 || PROTECT[y * MAP_W + x]) return false; const t = map[y * MAP_W + x];
    return !inAF(x, y) && (PAVE.has(t) || FELL.has(t)); };

  // ---------- the cost field and the search (its own jitter stream; the A* bounded to the leg's box plus 24) ----------
  let JIT = null;
  const jitter = () => { if (!JIT) { JIT = new Float32Array(MAP_W * MAP_H); const r = mulberry32(SEED); for (let i = 0; i < JIT.length; i++) JIT[i] = 0.93 + r() * 0.22; } return JIT; };
  // pave: the cost of laying a main road through (x, y); track: the cost of walking a track that stays as it lies
  // a person's own cell costs a little more (the warden stands in his gate: the road goes by him, so a rider passes)
  let WHO = null;
  function cost(x, y, mode) {
    const k = cost0(x, y, mode); return k >= 0 && WHO && WHO[y * MAP_W + x] ? k + 4 : k;
  }
  function cost0(x, y, mode) {
    const i = y * MAP_W + x, t = map[i];
    if (t === T_ROAD) return 0.35;
    if (t === T_VERGE) return 0.55;
    if (mode === 'track') {
      if (t === T.DIRT) return 0.5;
      if (!walkable(t)) return -1;
      return ADOPT.has(t) ? 1 : (window.DECO && t === DECO.id) ? 1 : 6;   // open ground: crossed only where no track runs
    }
    if (PROTECT[i]) return walkable(t) ? (ADOPT.has(t) || (window.DECO && t === DECO.id) ? 0.6 : 2) : -1;
    if (t === T.DIRT || t === T.COBBLE || t === Tn('BRIDGE') || t === Tn('DOCK')) return 0.5;   // an old track: the road falls into it
    if (GATES.has(t)) return 0.5;
    if (pavable(x, y)) return FELL.has(t) ? 3 : 1;
    return walkable(t) ? 2 : -1;
  }
  // A* on 8 neighbours (no corner cut past a shut tile), in a window; returns the path as [x, y] cells, or null
  function search(ax, ay, bx, by, mode, pad) {
    const X0 = Math.max(0, Math.min(ax, bx) - pad), Y0 = Math.max(0, Math.min(ay, by) - pad), X1 = Math.min(MAP_W - 1, Math.max(ax, bx) + pad), Y1 = Math.min(MAP_H - 1, Math.max(ay, by) + pad);
    const W = X1 - X0 + 1, H = Y1 - Y0 + 1, N = W * H, J = jitter();
    const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), k = new Float32Array(N).fill(-2);
    const kc = (lx, ly) => { const j = ly * W + lx; if (k[j] === -2) k[j] = cost(lx + X0, ly + Y0, mode); return k[j]; };
    const heap = [], hv = [];
    const push = (i, f) => { heap.push(i); hv.push(f); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (hv[p] <= hv[c]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; [hv[p], hv[c]] = [hv[c], hv[p]]; c = p; } };
    const pop = () => { const top = heap[0], li = heap.pop(), lv = hv.pop(); if (heap.length) { heap[0] = li; hv[0] = lv; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && hv[l] < hv[m]) m = l; if (r < heap.length && hv[r] < hv[m]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; [hv[m], hv[c]] = [hv[c], hv[m]]; c = m; } } return top; };
    const s = (ay - Y0) * W + (ax - X0), e = (by - Y0) * W + (bx - X0);
    if (kc(ax - X0, ay - Y0) < 0 || kc(bx - X0, by - Y0) < 0) return null;
    g[s] = 0; push(s, 0); let pops = 0;
    while (heap.length) {
      const c = pop(); if (done[c]) continue; done[c] = 1; pops++;
      if (c === e) break;
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of N8) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx; if (done[n]) continue;
        const kk = kc(nx, ny); if (kk < 0) continue;
        if (dx && dy && (kc(cx + dx, cy) < 0 || kc(cx, cy + dy) < 0)) continue;   // no squeezing between two shut corners
        const ng = g[c] + kk * J[(ny + Y0) * MAP_W + nx + X0] * (dx && dy ? Math.SQRT2 : 1);
        if (ng < g[n]) { g[n] = ng; from[n] = c; push(n, ng + Math.hypot(bx - X0 - nx, by - Y0 - ny) * (mode === 'track' ? 0.45 : 0.33)); }
      }
    }
    RD.stats.pops += pops;
    if (!isFinite(g[e])) return null;
    const out = []; for (let c = e; c >= 0; c = from[c]) out.push([c % W + X0, ((c / W) | 0) + Y0]);
    return out.reverse();
  }
  // a track point on something solid (a door, the mine shaft, a gate's post) is where a road ends, not part of it: the
  // nearest cell a road may stand on, within 4
  function standOn(x, y, mode) {
    x = Math.round(x); y = Math.round(y);
    const free = (cx, cy) => inMap(cx, cy) && cost(cx, cy, mode) >= 0 && !(WHO && WHO[cy * MAP_W + cx]);   // (nor where someone stands: the warden at his post)
    if (free(x, y)) return [x, y];
    for (let r = 1; r <= 4; r++) { let best = null;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !free(x + dx, y + dy)) continue;
        const d = Math.hypot(dx, dy); if (!best || d < best[2]) best = [x + dx, y + dy, d]; }
      if (best) return [best[0], best[1]]; }
    return null;
  }
  const stepLen = (a, b) => (a[0] !== b[0] && a[1] !== b[1] ? Math.SQRT2 : 1);

  // ---------- the pass ----------
  let NET = null;   // Uint8Array: 1 = a tile of the network (ROAD, a track's walked cells, the crossings adopted on the way)
  const addNet = (x, y) => { if (inMap(x, y)) NET[y * MAP_W + x] = 1; };
  // the Ashfields' open ground (11-main's count: grass, dirt and scorch between the ash), before and after the pass
  const afGreen = () => { const G = new Set([T.GRASS, T.DIRT, Tn('SCORCH')].filter(v => v >= 0)); let n = 0; for (let i = 0; i < map.length; i++) if (G.has(map[i]) && inAF(i % MAP_W, (i / MAP_W) | 0)) n++; return n; };
  RD.afGreen = afGreen;
  function lay(api) {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const set = api.setTile;
    ensureTiles(); sets(); buildProtect(); buildAF(); RD.afBefore = afGreen();
    WHO = new Uint8Array(MAP_W * MAP_H); for (const n of NPCS) if (inMap(n.x, n.y)) WHO[n.y * MAP_W + n.x] = 1;
    NET = RD.net = new Uint8Array(MAP_W * MAP_H);
    RD.laid = []; RD.roads = {};
    const S = RD.stats = { paved: 0, verges: 0, felled: 0, adopted: 0, pops: 0, legs: 0, failed: [], ms: 0, aStarMs: 0 };
    const changed = new Uint8Array(MAP_W * MAP_H);
    const put = (x, y, t, why) => { const i = y * MAP_W + x; if (map[i] === t) return; RD.laid.push({ x, y, was: tileName(map[i]), t: tileName(t), why }); set(x, y, t); changed[i] = 1; };
    // main roads first (so a track that meets one falls onto its surface), then the tracks
    const ids = A.MAIN_ROADS.concat(A.ROAD_IDS.filter(id => !A.MAIN_ROADS.includes(id)));
    for (const id of ids) {
      const main = A.MAIN_ROADS.includes(id), mode = main ? 'pave' : 'track', pl = A.track(id);
      const R = RD.roads[id] = { id, main, name: NAMES[id] ? NAMES[id][0] : null, sub: NAMES[id] ? NAMES[id][1] : null, path: [], cum: [0], legs: [], length: 0 };
      let at = null;
      for (let k = 1; k < pl.length; k++) {
        const a = at || standOn(pl[k - 1][0], pl[k - 1][1], mode), b = standOn(pl[k][0], pl[k][1], mode);
        const ts = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const p = a && b ? search(a[0], a[1], b[0], b[1], mode, 24) : null;
        S.aStarMs += (typeof performance !== 'undefined' ? performance.now() : Date.now()) - ts; S.legs++;
        if (!p) { S.failed.push(id + ' ' + (pl[k - 1] || []).map(Math.round) + '→' + pl[k].map(Math.round)); const L = Math.hypot(pl[k][0] - pl[k - 1][0], pl[k][1] - pl[k - 1][1]); R.cum.push(R.cum[R.cum.length - 1] + L); R.legs.push({ k, n: 0, failed: true }); at = b; continue; }
        let L = 0; for (let q = 1; q < p.length; q++) L += stepLen(p[q - 1], p[q]);
        R.cum.push(R.cum[R.cum.length - 1] + L); R.legs.push({ k, n: p.length, from: a, to: b, len: L });
        for (let q = R.path.length ? 1 : 0; q < p.length; q++) R.path.push(p[q]);
        at = b;
      }
      R.length = R.cum[R.cum.length - 1];
      // the walked cells join the network, side to side (a diagonal step takes the corner a knight walks round)
      for (let q = 0; q < R.path.length; q++) {
        const [x, y] = R.path[q]; addNet(x, y);
        if (q) { const [px, py] = R.path[q - 1]; if (px !== x && py !== y) { if (walkable(map[py * MAP_W + x])) addNet(x, py); else if (walkable(map[y * MAP_W + px])) addNet(px, y); } }
      }
      if (!main) continue;
      // paved three wide: every ordinary tile within one of the path
      for (const [x, y] of R.path) for (const [dx, dy] of [[0, 0], ...N4]) {
        const nx = x + dx, ny = y + dy; if (!pavable(nx, ny)) continue;
        const t = map[ny * MAP_W + nx]; if (t === T_ROAD) { addNet(nx, ny); continue; }
        if (FELL.has(t)) S.felled++;
        put(nx, ny, T_ROAD, id); addNet(nx, ny); S.paved++;
      }
    }
    // the verges: the open ground beside the road's surface, four-connected (a kerb runs alongside, it does not spill
    // into the corners of the fields)
    for (let i = 0; i < map.length; i++) {
      if (map[i] !== T_ROAD) continue; const x = i % MAP_W, y = (i / MAP_W) | 0;
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny) || PROTECT[ny * MAP_W + nx]) continue;
        const t = map[ny * MAP_W + nx]; if (t === T_ROAD || t === T_VERGE || !VERGEABLE.has(t)) continue;
        if (inAF(nx, ny)) continue;   // the Ashfields keep their ground (the road is its old track there)
        if (NET[ny * MAP_W + nx] && t === T.DIRT) continue;   // a track's own dirt is the track's
        put(nx, ny, T_VERGE, 'verge'); S.verges++; }
    }
    for (let i = 0; i < map.length; i++) if (NET[i] && map[i] !== T_ROAD && map[i] !== T_VERGE) S.adopted++;
    RD.changed = changed;
    S.ms = Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) * 10) / 10;
    S.aStarMs = Math.round(S.aStarMs * 10) / 10;
  }

  // ---------- the places the network reaches, and the ones it does not (each with its reason) ----------
  const OFF_ROAD = {
    pond: "Miller's Pond: Mill Lane runs past its west shore (the river leaves its east shore, and the lane has no bridge); the pond is water and its stepping stones an Agility course",
    stone_circle: 'the standing stones: the Ash Road goes round them, not through (section 5)',
    gull_isle: 'an island: Harl\'s boat from the dock', ironclad_isle: 'an island: by boat', far_shore: 'east of the Sound: Harl\'s ferry', redcut: 'east of the Sound: Harl\'s ferry',
    wreck_rock: 'out in the Grey Sea (reserved: a boat route later)', brightwater: 'ringed by cliff: the blimp, later (reserved)',
    drill_field: "the bulldozer's flat test lane in Thistledown's fields: no port", deepholm_rock: 'rock scenery (Deepholm is under it): no port',
    ash_wastes: 'reserved Wilds, not open yet', sylvaris_growth: "Sylvaris' growth ring, kept free",
  };
  RD.OFF_ROAD = OFF_ROAD;
  // a place's own way to its road (the north outpost's trail from its gap): walked into the network when none of its
  // ports is within 3 tiles of it
  function placeLinks() {
    const S = RD.stats; S.links = [];
    const reached = p => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = Math.round(p[0]) + dx, y = Math.round(p[1]) + dy; if (inMap(x, y) && NET[y * MAP_W + x]) return true; } return false; };
    for (const id of Object.keys(A.ANCHORS)) {
      if (OFF_ROAD[id]) continue;
      const ports = Object.keys(A.PORTS).filter(k => k.split('.')[0] === id).map(k => A.port(k)); if (!ports.length || ports.some(reached)) continue;
      const [px, py] = ports[0].map(Math.round), a = standOn(px, py, 'track'); if (!a) continue;
      let best = null; for (let y = a[1] - 20; y <= a[1] + 20; y++) for (let x = a[0] - 20; x <= a[0] + 20; x++) if (inMap(x, y) && NET[y * MAP_W + x]) { const d = Math.hypot(x - a[0], y - a[1]); if (!best || d < best.d) best = { x, y, d }; }
      if (!best) { S.links.push({ id, failed: 'no road within 20' }); continue; }
      const p = search(a[0], a[1], best.x, best.y, 'track', 12); if (!p) { S.links.push({ id, failed: 'no walk' }); continue; }
      for (let q = 0; q < p.length; q++) { const [x, y] = p[q]; addNet(x, y); if (q) { const [qx, qy] = p[q - 1]; if (qx !== x && qy !== y) { if (walkable(map[qy * MAP_W + x])) addNet(x, qy); else addNet(qx, y); } } }
      S.links.push({ id, tiles: p.length });
    }
  }

  // ---------- stitching: every piece of the network joined to the rest ----------
  // The tracks meet at their nodes, but a road that ends at one gate of a place and another that leaves by another gate
  // (Thistledown's west and east gates, Hollowford's four ways in) are joined only by the place's own streets: each piece
  // not joined to the largest is walked to it (a track's walk: over its streets and paths, never paved) from its nearest
  // cell, and the walk joins the network.
  function components() {
    const comp = new Int32Array(MAP_W * MAP_H).fill(-1), sizes = []; let n = 0;
    for (let i = 0; i < NET.length; i++) { if (!NET[i] || comp[i] >= 0) continue;
      const q = [i]; comp[i] = n; for (let k = 0; k < q.length; k++) { const c = q[k], x = c % MAP_W, y = (c / MAP_W) | 0;
        for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const j = ny * MAP_W + nx; if (NET[j] && comp[j] < 0) { comp[j] = n; q.push(j); } } }
      sizes.push(q.length); n++; }
    return { comp, sizes };
  }
  function stitch() {
    const S = RD.stats; S.stitches = [];
    let { comp, sizes } = components();
    const main = sizes.indexOf(Math.max(...sizes)), joined = new Set([main]);
    // each other piece, smallest first: a search outward from its cells (any tile, 30 at most) to the nearest joined cell,
    // then a track's walk between the two
    const order = sizes.map((n, k) => k).filter(k => k !== main).sort((a, b) => sizes[a] - sizes[b]);
    for (const k of order) {
      if (joined.has(k)) continue;
      const dist = new Map(), q = []; for (let i = 0; i < NET.length; i++) if (comp[i] === k) { dist.set(i, 0); q.push(i); }
      let hit = -1, src = new Map(q.map(i => [i, i]));
      for (let h = 0; h < q.length && hit < 0; h++) { const c = q[h], d = dist.get(c); if (d >= 30) continue; const x = c % MAP_W, y = (c / MAP_W) | 0;
        for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const j = ny * MAP_W + nx; if (dist.has(j)) continue;
          dist.set(j, d + 1); src.set(j, src.get(c)); if (NET[j] && joined.has(comp[j])) { hit = j; break; } q.push(j); } }
      if (hit < 0) { S.stitches.push({ piece: sizes[k], failed: 'nothing within 30' }); continue; }
      const a = src.get(hit), p = search(a % MAP_W, (a / MAP_W) | 0, hit % MAP_W, (hit / MAP_W) | 0, 'track', 24);
      if (!p) { S.stitches.push({ piece: sizes[k], failed: 'no walk' }); continue; }
      for (let r = 0; r < p.length; r++) { const [x, y] = p[r]; addNet(x, y); if (r) { const [px, py] = p[r - 1]; if (px !== x && py !== y) { if (walkable(map[py * MAP_W + x])) addNet(x, py); else addNet(px, y); } } }
      joined.add(k); S.stitches.push({ from: p[0], to: p[p.length - 1], tiles: p.length });
      // a walk may have crossed other pieces: they are joined now too
      for (const [x, y] of p) { const c = comp[y * MAP_W + x]; if (c >= 0) joined.add(c); }
    }
    S.components = components().sizes.length;
  }

  // ---------- the footprint: every tile the pass changed or walked, grown by 2, as row runs (REVS[7]) ----------
  const REV = 7, FOOT = [];
  if (A.REVS) A.REVS[REV] = { stage: '6', by: '93-roads', why: 'the roads: every tile the roads pass paved, walked or stood a thing on, grown by 2 (the road corridors and the cells beside them)', boxes: FOOT };
  function footprint() {
    const grow = 2, mark = new Uint8Array(MAP_W * MAP_H), src = RD.changed;
    for (let i = 0; i < src.length; i++) if (src[i] || NET[i]) { const x = i % MAP_W, y = (i / MAP_W) | 0;
      for (let dy = -grow; dy <= grow; dy++) for (let dx = -grow; dx <= grow; dx++) if (inMap(x + dx, y + dy)) mark[(y + dy) * MAP_W + x + dx] = 1; }
    FOOT.length = 0;
    for (let y = 0; y < MAP_H; y++) { let x = 0; while (x < MAP_W) { if (!mark[y * MAP_W + x]) { x++; continue; } const x0 = x; while (x < MAP_W && mark[y * MAP_W + x]) x++; FOOT.push([x0, y, x - 1, y]); } }
    RD.foot = mark;
  }

  // ---------- the forks: every point where three or more road legs meet ----------
  // (a track point shared by roads, each counting 2 legs where the road runs on through it and 1 where it ends there; and
  // a road's end on another's line between its points, a T). The miners' lane inside the quarry is the quarry's own.
  const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  function forks() {
    const pts = new Map(), key = p => Math.round(p[0]) + ',' + Math.round(p[1]);
    const tracks = A.ROAD_IDS.filter(id => id !== 'shaft_lane').map(id => [id, A.track(id)]);
    for (const [id, pl] of tracks) pl.forEach((p, k) => { const kk = key(p); if (!pts.has(kk)) pts.set(kk, { at: p.map(Math.round), legs: 0, roads: [] }); const q = pts.get(kk); q.legs += k === 0 || k === pl.length - 1 ? 1 : 2; if (!q.roads.includes(id)) q.roads.push(id); });
    for (const [id, pl] of tracks) for (const k of [0, pl.length - 1]) { const p = pl[k], q = pts.get(key(p));
      for (const [id2, pl2] of tracks) { if (id2 === id || q.roads.includes(id2)) continue;
        for (let j = 1; j < pl2.length; j++) if (segD(p[0], p[1], pl2[j - 1][0], pl2[j - 1][1], pl2[j][0], pl2[j][1]) < 1.5) { q.legs += 2; q.roads.push(id2); break; } } }
    return [...pts.values()].filter(q => q.legs >= 3);
  }
  RD.forks = forks;

  // the forks Stage 4 stood no post at (01-atlas SIGNPOSTS, `stage: 6`: 93-spread leaves them to this pass): where the
  // Glasshouse spur and the Old Barrow spur leave their roads, and Dunstan's turn (the shrine path off his farm path)
  A.SIGNPOSTS.push({ at: A.TRACKS.spur_glasshouse[0], stage: 6 }, { at: A.TRACKS.spur_barrow[0], stage: 6 }, { at: ['port', 'warden.turn'], stage: 6, here: "Dunstan's farm" });

  // ---------- the things beside the roads ----------
  // Solid ones (a milestone, and the POIs below) stand on 95-thistledown's TD_PROP tile (solid; outside the town's plan it
  // has no kind of the town's), as 84-crossroads' well does, with their kind in this file's side table (RD.things: idx ->
  // { kind, under, ... }); walkable ones (a lantern post on the verge, a cairn by a track) are DECO kinds (83-deco).
  const TD_PROP = () => Tn('TD_PROP');
  const KINDS = {};   // kind -> { draw(g, px, py, c, tx, ty), use(c, tx, ty) -> words, say: who }
  let taken = [];
  // a point `s` tiles along a road's laid path: the cell, and the way the road runs there
  function along(R, s) {
    const P = R.path; if (!P.length) return null;
    let acc = 0, q = 0; for (; q < P.length - 1; q++) { const L = stepLen(P[q], P[q + 1]); if (acc + L > s) break; acc += L; }
    const a = P[Math.max(0, q - 3)], b = P[Math.min(P.length - 1, q + 3)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return { q, x: P[q][0], y: P[q][1], dx: dx / l, dy: dy / l };
  }
  // open ground a thing may stand on: not a road's own cell, not a place's, not a building's, nobody standing there, and
  // (for a solid thing) the open ground round it one piece, so it never cuts a way
  const OPEN_GROUND = () => new Set(['GRASS', 'FLOWERS', 'MUSHROOM', 'FERN', 'SAND', 'SCORCH', 'ASH', 'DIRT', 'AF_DRYGRASS', 'AF_SINGED', 'AF_CINDERS', 'VERGE'].map(Tn).filter(v => v >= 0));
  let OG = null, DOORS = null, GREEN = null;
  const RING8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const simple = (x, y) => { const o = RING8.map(([dx, dy]) => walkable(map[(y + dy) * MAP_W + x + dx]) && !buildingAt(x + dx, y + dy));
    let runs = 0; for (let k = 0; k < 8; k++) if (o[k] && !o[(k + 7) % 8]) runs++; return runs === 1 || (runs === 0 && o.every(Boolean)); };
  // (the masks a stand reads, made once a pass: people and spawns with the tile round each, the reserved plots not built)
  let NEARP = null, RESV = null;
  const markNear = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(x + dx, y + dy)) NEARP[(y + dy) * MAP_W + x + dx] = 1; };
  function standMasks() {
    NEARP = new Uint8Array(MAP_W * MAP_H); RESV = new Uint8Array(MAP_W * MAP_H);
    for (const n of NPCS) markNear(n.x, n.y); for (const m of MONSTER_SPAWNS) markNear(m.tx, m.ty);
    for (const r of A.reserved()) { if (A.isBuilt(r.id)) continue; const b = r.box; for (let y = Math.max(0, b[1]); y <= Math.min(MAP_H - 1, b[3]); y++) for (let x = Math.max(0, b[0]); x <= Math.min(MAP_W - 1, b[2]); x++) RESV[y * MAP_W + x] = 1; }
  }
  function canStand(x, y, solid, inPlace) {
    if (!inMap(x, y) || x < 2 || y < 2 || x > MAP_W - 3 || y > MAP_H - 3) return false;
    const i = y * MAP_W + x; if (!OG.has(map[i]) || NET[i] || (!inPlace && PROTECT[i]) || NEARP[i] || RESV[i]) return false;
    if (inAF(x, y) && GREEN.has(map[i])) return false;   // the Ashfields' open ground is 11-main's: things stand on its ash
    // never on a doorstep or by a gate, a stair or a rail (Dunstan's door is where his farm path meets his shrine path)
    if (N8.some(([dx, dy]) => inMap(x + dx, y + dy) && DOORS.has(map[(y + dy) * MAP_W + x + dx])) || buildingAt(x, y)) return false;
    if (solid && (A.onMainRoad(x, y) || !simple(x, y) || cuts(x, y))) return false;
    return true;
  }
  // would a solid thing at (x, y) cut a way? Its open sides must still reach each other within 6 tiles of it (a flood
  // round it, the cell itself shut): the ring test alone missed a pocket by Dunstan's hut
  function cuts(x, y) {
    const R = 6, W = 2 * R + 1, seen = new Uint8Array(W * W), q = [];
    const ok = (cx, cy) => inMap(cx, cy) && !(cx === x && cy === y) && Math.abs(cx - x) <= R && Math.abs(cy - y) <= R && walkable(map[cy * MAP_W + cx]) && !buildingAt(cx, cy);
    const sides = N4.map(([dx, dy]) => [x + dx, y + dy]).filter(([cx, cy]) => ok(cx, cy)); if (sides.length < 2) return sides.length === 0;
    const push = (cx, cy) => { const j = (cy - y + R) * W + cx - x + R; if (seen[j] || !ok(cx, cy)) return; seen[j] = 1; q.push([cx, cy]); };
    push(sides[0][0], sides[0][1]); for (let k = 0; k < q.length; k++) for (const [dx, dy] of N4) push(q[k][0] + dx, q[k][1] + dy);
    return sides.some(([cx, cy]) => !seen[(cy - y + R) * W + cx - x + R]);
  }
  const near = (x, y, d) => taken.some(([tx, ty]) => Math.max(Math.abs(tx - x), Math.abs(ty - y)) < d);
  // the cell nearest `off` tiles to one side of the road at `s` (side 1: left of the way it runs from its start, -1: right),
  // within 3 of that, that touches the road or its verge (a knight walks up to it from the road)
  function beside(R, s, side, off, solid, gap, extra) {
    const p = along(R, s); if (!p) return null;
    const wx = p.x + Math.round(p.dy * side * off), wy = p.y + Math.round(-p.dx * side * off);
    let best = null;
    for (let r = 0; r <= 3 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = wx + dx, y = wy + dy;
      if (!N8.some(([ex, ey]) => inMap(x + ex, y + ey) && (NET[(y + ey) * MAP_W + x + ex] || map[(y + ey) * MAP_W + x + ex] === T_VERGE))) continue;
      if (near(x, y, gap) || !canStand(x, y, solid, false) || (extra && !extra(x, y))) continue;
      const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { x, y, d, s, q: p.q };
    }
    return best;
  }
  function thing(api, x, y, kind, info) { const i = y * MAP_W + x; RD.things.set(i, Object.assign({ kind, under: map[i] }, info || {})); RD.laid.push({ x, y, was: tileName(map[i]), t: kind, why: 'thing' }); api.setTile(x, y, TD_PROP()); RD.changed[i] = 1; taken.push([x, y]); }
  function deco(api, x, y, kind, info) { const i = y * MAP_W + x; RD.laid.push({ x, y, was: tileName(map[i]), t: kind, why: 'deco' }); DECO.put(api, x, y, kind); if (info) Object.assign(DECO.CELLS.get(i), info); RD.changed[i] = 1; taken.push([x, y]); }

  // the markers: a milestone at each end of a main road, lantern posts along it (cairns where it crosses the ash), a cairn
  // along every track every ~25 tiles (lanterns on the Jungle Path)
  const LANTERN_EVERY = 20, CAIRN_EVERY = 25;
  function markers(api) {
    OG = OPEN_GROUND();
    const S = RD.stats; S.lanterns = 0; S.cairns = 0; S.milestones = 0; S.unplaced = [];
    for (const id of Object.keys(RD.roads)) {
      const R = RD.roads[id]; R.marks = [];
      if (R.length < 18 || id === 'path_farm') continue;
      const lanterns = R.main || id === 'r3b_jungle';
      const every = lanterns ? LANTERN_EVERY : CAIRN_EVERY;
      let side = 1;
      for (let s = every / 2; s < R.length - 6; s += every, side = -side) {
        const p = along(R, s); if (!p || PROTECT[p.y * MAP_W + p.x]) continue;
        const ash = inAF(p.x, p.y), kind = lanterns && !ash ? 'road_lantern' : 'road_cairn';
        const o = R.main && !ash ? 2 : 1; let at = null;
        for (let k = 0; k <= 4 && !at; k++) for (const sg of k ? [1, -1] : [1]) at = at || beside(R, s + sg * k * 2, side, o, false, 6) || beside(R, s + sg * k * 2, -side, o, false, 6);
        if (!at) { S.unplaced.push(id + ' ' + kind + ' at ' + Math.round(s)); continue; }
        deco(api, at.x, at.y, kind, { road: id }); R.marks.push({ kind, x: at.x, y: at.y, s: Math.round(s) });
        if (kind === 'road_lantern') S.lanterns++; else S.cairns++;
      }
      if (!R.main) continue;
      // a milestone at each end, beside the road a few tiles out of the place it leaves (outside every place's ground)
      for (const end of [0, 1]) {
        let at = null;
        for (let d = 4; d <= 60 && !at; d += 2) { const s = end ? R.length - d : d; at = beside(R, s, end ? -1 : 1, 3, true, 3) || beside(R, s, end ? 1 : -1, 3, true, 3); }
        if (!at) { S.unplaced.push(id + ' milestone ' + (end ? 'end' : 'head')); continue; }
        thing(api, at.x, at.y, 'milestone', { road: id, end }); R.marks.push({ kind: 'milestone', x: at.x, y: at.y, s: Math.round(at.s) }); S.milestones++;
      }
    }
  }

  // every fork has a signpost within 2 tiles of its road: a post Stage 4 stood further off is moved in; a fork with none
  // (SIGNPOSTS' stage 6) gets one
  function forkSigns(api) {
    const SP = window.SPREAD_GROUND; if (!SP) return;
    standMasks(); OG = OG || OPEN_GROUND(); GREEN = GREEN || new Set([T.GRASS, T.DIRT, Tn('SCORCH')].filter(v => v >= 0)); DOORS = DOORS || new Set(['DOOR', 'COFFINDOOR', 'DUNGEON_DOOR', 'CRYPT_DOOR', 'HATCH', 'HOUSE_PORTAL', 'SHAFT', 'HITCH', 'GATE', 'PORTCULLIS', 'WARDEN_GATE', 'LAIR_GATE', 'CITY_GATE', 'SCARP_STEPS', 'CRYPT_BARS'].map(Tn).filter(v => v >= 0));
    const S = RD.stats; S.signsMoved = []; S.signsAdded = []; S.signsMissing = [];
    const cellsOf = f => { const out = []; for (let y = f.at[1] - 3; y <= f.at[1] + 3; y++) for (let x = f.at[0] - 3; x <= f.at[0] + 3; x++) if (inMap(x, y) && NET[y * MAP_W + x] && Math.hypot(x - f.at[0], y - f.at[1]) <= 2.5) out.push([x, y]); return out; };
    const cheb = (x, y, cells) => cells.reduce((m, [cx, cy]) => Math.min(m, Math.max(Math.abs(cx - x), Math.abs(cy - y))), 99);
    const FK = forks().map(f => Object.assign(f, { cells: cellsOf(f) }));
    const signNear = f => { let best = 99; for (let y = f.at[1] - 6; y <= f.at[1] + 6; y++) for (let x = f.at[0] - 6; x <= f.at[0] + 6; x++) if (inMap(x, y) && map[y * MAP_W + x] === T.SIGN) best = Math.min(best, cheb(x, y, f.cells)); return best; };
    for (const f of FK) {
      if (signNear(f) <= 2) continue;
      // the forks within 6 of this one are served by the same post (Dunstan's turn and his door, five apart)
      const group = FK.filter(g => g === f || (Math.hypot(g.at[0] - f.at[0], g.at[1] - f.at[1]) <= 6 && signNear(g) > 2));
      let best = null;
      for (let y = f.at[1] - 5; y <= f.at[1] + 5; y++) for (let x = f.at[0] - 5; x <= f.at[0] + 5; x++) {
        if (!canStand(x, y, true, true) || map[y * MAP_W + x] === T_ROAD || A.onMainRoad(x, y) && Math.hypot(x - f.at[0], y - f.at[1]) < 2) continue;
        const worst = Math.max(...group.map(g => cheb(x, y, g.cells))); if (worst > 2) continue;
        const d = worst * 10 + Math.hypot(x - f.at[0], y - f.at[1]); if (!best || d < best.d) best = { x, y, d };
      }
      if (!best) { S.signsMissing.push(f.at.join(',')); continue; }
      const entry = SP.signs.find(q => q[2] === f.at[0] && q[3] === f.at[1]) || SP.signs.find(q => group.some(g => q[2] === g.at[0] && q[3] === g.at[1]));
      if (entry) { const [ox, oy] = entry; RD.laid.push({ x: ox, y: oy, was: 'SIGN', t: 'GRASS', why: 'sign moved' }); api.setTile(ox, oy, T.GRASS); RD.changed[oy * MAP_W + ox] = 1; entry[0] = best.x; entry[1] = best.y; S.signsMoved.push([ox, oy, best.x, best.y]); }
      else { const node = A.SIGNPOSTS.find(q => q.stage === 6 && group.some(g => { const p = A.pointOf(q.at).map(Math.round); return p[0] === g.at[0] && p[1] === g.at[1]; }));
        if (!node) { S.signsMissing.push(f.at.join(',') + ' (no SIGNPOSTS node)'); continue; }
        const p = A.pointOf(node.at).map(Math.round); SP.signs.push([best.x, best.y, p[0], p[1]]); S.signsAdded.push([best.x, best.y]); }
      RD.laid.push({ x: best.x, y: best.y, was: tileName(map[best.y * MAP_W + best.x]), t: 'SIGN', why: 'fork sign' }); api.setTile(best.x, best.y, T.SIGN); RD.changed[best.y * MAP_W + best.x] = 1; taken.push([best.x, best.y]);
    }
    RD.forkList = FK.map(f => ({ at: f.at, roads: f.roads, sign: signNear(f) }));
  }

  // ============================================================================
  // THE PLACES TO STOP FOR (§5: roads2's 25 re-homed by road, and the new ones that fill the gaps)
  // ============================================================================
  // Each is { id, road, at: 0..1 along the road's laid length, side: 1 left / -1 right of the way it runs from its start,
  // kind, ... }: never a tile. The pass stands it on the nearest open ground beside the road there (a beast stands back
  // from it, a trader by it), looking up to 15 tiles either way along the road for room.
  const NEW_ITEMS = {
    iron_key: { name: "Warden's iron key", value: 0, color: '#9aa3ae', shape: 'scrap', stack: 1 },
    haws: { name: 'Hawthorn haws', value: 3, color: '#c0294a', shape: 'seed', stack: 50, heal: 3 },
    river_pearl: { name: 'River pearl', value: 75, color: '#e6edf3', shape: 'seed', stack: 50 },
    grizzle_tusk: { name: "Grizzlejaw's tusk", value: 90, color: '#e8dcc0', shape: 'tusk', stack: 50 },
    stone_heart: { name: "Stonebiter's heart", value: 120, color: '#8d949f', shape: 'rock', stack: 50 },
    grey_pelt: { name: "Greyfang's pelt", value: 110, color: '#9a9daa', shape: 'pelt', stack: 50 },
    cinder_scale: { name: "Ashjaw's cinder scale", value: 150, color: '#d2622f', shape: 'scrap', stack: 50 },
    moss_bloom: { name: "Mossback's bloom", value: 130, color: '#6fbf62', shape: 'seed', stack: 50 },
    sneak_purse: { name: "Old Sneak's purse", value: 100, color: '#e0b23c', shape: 'coins', stack: 50 },
  };
  for (const id in NEW_ITEMS) { ITEMS[id] = NEW_ITEMS[id]; ITEMS[id].id = id; }

  // the named beasts: none of them charges a knight (a road is safe; the thing beside it is not, and he chooses the fight),
  // each keeps to its own patch (`roam` 2: 07-update turns it for home past that) and drops its own trophy
  const NAMED = {
    grizzlejaw: { name: 'Grizzlejaw', level: 9, r: 17, hp: 46, att: 9, maxHit: 6, def: 6, speed: 130, aggro: false, sight: 3 * TILE, respawn: 75, roam: 2,
      drops: { always: [['raw_beef', 2, 3]], table: [['boar_tusk', 1, 1, 6], ['coins', 10, 24, 4]], rare: { chance: 6, table: [['grizzle_tusk', 1, 1, 1]] } } },
    stonebiter: { name: 'Stonebiter', level: 14, r: 16, hp: 80, att: 13, maxHit: 9, def: 12, speed: 95, aggro: false, sight: 3 * TILE, respawn: 90, roam: 2,
      drops: { always: [['iron_ore', 2, 3], ['coal', 1, 2]], table: [['iron_bar', 1, 1, 5], ['coins', 14, 30, 5]], rare: { chance: 8, table: [['stone_heart', 1, 1, 1]] } } },
    greyfang: { name: 'Greyfang', level: 16, r: 16, hp: 92, att: 16, maxHit: 10, def: 11, speed: 165, aggro: false, sight: 3 * TILE, respawn: 70, roam: 2,
      drops: { always: [['wolf_pelt', 2, 3], ['raw_beef', 1, 2]], table: [['coins', 16, 34, 6], ['nothing', 0, 0, 4]], rare: { chance: 7, table: [['grey_pelt', 1, 1, 1]] } } },
    old_sneak: { name: 'Old Sneak', level: 12, r: 13, hp: 66, att: 12, maxHit: 8, def: 9, speed: 140, aggro: false, sight: 3 * TILE, respawn: 60, roam: 2,
      drops: { always: [['coins', 14, 28], ['goblin_scrap', 1, 3]], table: [['bread', 1, 2, 5], ['blast_powder', 1, 2, 5]], rare: { chance: 8, table: [['sneak_purse', 1, 1, 1]] } } },
    ashjaw: { name: 'Ashjaw', level: 24, r: 18, hp: 150, att: 22, maxHit: 14, def: 18, speed: 120, aggro: false, sight: 3 * TILE, respawn: 100, roam: 2,
      drops: { always: [['coal', 2, 4]], table: [['iron_bar', 1, 2, 6], ['coins', 24, 48, 6]], rare: { chance: 8, table: [['cinder_scale', 1, 1, 1]] } } },
    mossback: { name: 'Mossback', level: 28, r: 20, hp: 190, att: 26, maxHit: 16, def: 22, speed: 100, aggro: false, sight: 3 * TILE, respawn: 110, roam: 2,
      drops: { always: [['oak_log', 2, 3]], table: [['berries', 2, 4, 6], ['coins', 30, 60, 6]], rare: { chance: 8, table: [['moss_bloom', 1, 1, 1]] } } },
  };
  for (const k in NAMED) MONSTER_DEFS[k] = NAMED[k];

  // the roadside traders: each does exactly one thing, says what it is, and does it as often as he likes. Declared here;
  // each stands where the pass finds him room, joining NPCS in the pass (and leaving them before every world, so no
  // earlier pass sees him: they keep rings clear round people with dice)
  const TRADES = {
    ivo: { id: 'ivo', name: 'Ivo the ore-picker', tunic: '#5a5a4a', hair: '#7a6a5a', beard: true, role: 'road_trade',
      give: ['coal', 6], take: ['iron_bar', 1], line: 'Six coal for an iron bar, every time. I fire the little forge behind the heap.' },
    kett: { id: 'kett', name: 'Rusty Kett', tunic: '#3f6a72', hair: '#c9b48a', role: 'road_trade',
      give: ['river_pearl', 1], take: ['coins', 120], line: 'A river pearl is worth a hundred and twenty to me. Nobody else on this coast will say so.' },
    cinder_meg: { id: 'cinder_meg', name: 'Cinder Meg', tunic: '#5a3a33', hair: '#d9d0c0', woman: true, role: 'road_trade',
      give: ['wood', 4], take: ['coal', 3], line: 'Four logs in the clamp, three coal out of it. That is the whole of my trade.' },
  };
  HOOKS.world.unshift(() => { for (const k in TRADES) { const i = NPCS.indexOf(TRADES[k]); if (i >= 0) NPCS.splice(i, 1); } });

  // the blessings a wayshrine (or the fisher's shrine, or the wayside well's cousin) hands out
  const POI_DEF = [
    // --- R1 the Cave Road ---
    { road: 'r1_cave', at: 0.18, side: -1, id: 'cart_over', kind: 'wreck', name: 'The Overturned Cart',
      blurb: 'A carrier went into the ditch here and never came back for the load.', loot: [['plank', 2, 4], ['wood', 1, 2], ['coins', 4, 14]], every: 300 },
    { road: 'r1_cave', at: 0.35, side: 1, id: 'grizzle', kind: 'beast', type: 'grizzlejaw', name: 'Grizzlejaw',
      blurb: 'An old boar with one broken tusk, in the briars where Mill Lane leaves the road.' },
    { road: 'r1_cave', at: 0.62, side: -1, id: 'stone_trav', kind: 'shrine', name: "The Traveller's Stone", bless: 'fair', blessName: 'Fair Road', secs: 180, every: 360, amount: 2,
      blurb: 'Fair Road: every hit you take is 2 lighter for three minutes.' },
    { road: 'r1_cave', at: 0.8, side: 1, id: 'fence_cache', kind: 'cache', name: 'The Broken Fence',
      blurb: 'A farmer hid his savings under the fence post, and the fence fell down before he came back.', loot: [['coins', 30, 30], ['bread', 2, 2], ['iron_bar', 1, 1]], once: true },
    // --- R1c Mill Lane, R1a the Quarry Track, R1b the Beacon Path ---
    { road: 'r1c_mill', at: 0.4, side: -1, id: 'pool_pond', kind: 'pool', name: 'The Deep Pool',
      blurb: "A deep, cold pool beside Mill Lane, fed from under Miller's Pond.", fish: 'raw_trout', xp: 34, extra: 'river_pearl', extraOdds: 8 },
    { road: 'r1a_quarry', at: 0.3, side: 1, id: 'stonebiter', kind: 'beast', type: 'stonebiter', name: 'Stonebiter',
      blurb: 'A rock-crusted brute that walked down out of the quarry and stayed.' },
    { road: 'r1a_quarry', at: 0.55, side: -1, id: 'cleft', kind: 'cache', name: 'The Slighted Cleft',
      blurb: 'A crack in the rock with a box wedged into it. The quarry crew hid their pay here.', loot: [['steel_bar', 2, 2], ['coins', 60, 60]], once: true },
    { road: 'r1a_quarry', at: 0.85, side: 1, id: 'ivo', kind: 'trader', who: 'ivo', name: 'Ivo the ore-picker',
      blurb: 'He works the spoil heap by the track. Six coal for an iron bar.' },
    { road: 'r1b_beacon', at: 0.1, side: 1, id: 'stone_wind', kind: 'shrine', name: 'The Wind-Stone', bless: 'hands', blessName: 'Steady Hands', secs: 180, every: 360, amount: 2,
      blurb: 'Steady Hands: Mining and Woodcutting pay double for three minutes.' },
    { road: 'r1b_beacon', at: 0.2, side: -1, id: 'beacon_cache', kind: 'cache', name: 'The Fallen Beacon',
      blurb: 'The old beacon on this spot fell down long ago. The keeper left his spare oil money in its stones.', loot: [['coins', 40, 40], ['oak_log', 3, 3]], once: true },
    // --- R2 the Sea Road ---
    { road: 'r2_sea', at: 0.19, side: 1, id: 'toll', kind: 'box', name: 'The Toll Post',
      blurb: 'A strongbox chained to a toll post. The lock takes an iron key.', key: 'iron_key', loot: [['coins', 250, 250], ['steel_bar', 3, 3]] },
    { road: 'r2_sea', at: 0.37, side: -1, id: 'sneak', kind: 'beast', type: 'old_sneak', name: 'Old Sneak',
      blurb: 'A goblin that robs the camp road and runs back home when it is done.' },
    { road: 'r2_sea', at: 0.63, side: 1, id: 'tide_cart', kind: 'wreck', name: 'The Tide Waggon',
      blurb: 'A fish waggon that broke its axle on the pull up from the dock, and was left where it stopped.', loot: [['raw_shrimp', 2, 4], ['plank', 1, 2], ['coins', 6, 16]], every: 300 },
    { road: 'r2_sea', at: 0.7, side: -1, id: 'salt_bramble', kind: 'bramble', name: 'The Salt Bramble',
      blurb: 'Sea buckthorn on the bank, salt on the leaves.', pick: 'haws', every: 120 },
    { road: 'r2_sea', at: 0.9, side: 1, id: 'kett', kind: 'trader', who: 'kett', name: 'Rusty Kett',
      blurb: 'A beachcomber by the dock road. He buys river pearls and nothing else.' },
    // --- R3 the Long Road ---
    { road: 'r3_long', at: 0.12, side: -1, id: 'waggon', kind: 'wreck', name: 'The Broken Waggon',
      blurb: 'A timber waggon shed a wheel on the run down to the river.', loot: [['wood', 3, 5], ['plank', 1, 2], ['coins', 4, 12]], every: 300 },
    { road: 'r3_long', at: 0.26, side: 1, id: 'piles', kind: 'wreck', name: 'The Ferry Piles',
      blurb: 'A barge that never made the far bank, left on the old ferry piles when the bridge was built.', loot: [['plank', 2, 4], ['wood', 1, 2], ['coins', 8, 18]], every: 300 },
    { road: 'r3_long', at: 0.56, side: 1, id: 'well', kind: 'well', name: 'The Wayside Well',
      blurb: 'Cold, clean water. A long drink and you feel whole again.', every: 120 },
    { road: 'r3_long', at: 0.68, side: -1, id: 'stone_bell', kind: 'shrine', name: 'The Bell Stone', bless: 'mend', blessName: 'Deep Breath', secs: 180, every: 360, amount: 1,
      blurb: 'Deep Breath: you mend 1 hitpoint every three seconds for three minutes.' },
    { road: 'r3_long', at: 0.76, side: 1, id: 'farmstead', kind: 'cache', name: 'The Burnt Farmstead',
      blurb: 'The fire that took Hollowford took this farm too. The family hid their good tools in the cellar.', loot: [['iron_bar', 2, 2], ['coins', 50, 50], ['meat_pie', 1, 1]], once: true },
    // --- R3b the Jungle Path ---
    { road: 'r3b_jungle', at: 0.4, side: 1, id: 'green_bramble', kind: 'bramble', name: 'The Green Bramble',
      blurb: 'Haws grow fat on the jungle path where the light gets through.', pick: 'haws', every: 120 },
    { road: 'r3b_jungle', at: 0.55, side: -1, id: 'mossback', kind: 'beast', type: 'mossback', name: 'Mossback',
      blurb: 'Something very old and very green stands where the jungle path turns.' },
    // --- R4a the Saltmere lane ---
    { road: 'r4a_saltmere', at: 0.45, side: 1, id: 'fisher', kind: 'shrine', name: "The Fisher's Shrine", bless: 'lines', blessName: 'Tight Lines', secs: 180, every: 360, amount: 2,
      blurb: 'Tight Lines: Fishing pays double for three minutes.' },
    // --- R5 the Wolfwood Road ---
    { road: 'r5_wolfwood', at: 0.2, side: 1, id: 'lore_wood', kind: 'lore', name: 'The Woodcutters\' Board',
      blurb: 'Carved into the board: "Wolfwood. Keep to the road after dark. The wolves keep to the trees. Mostly."' },
    { road: 'r5_wolfwood', at: 0.41, side: -1, id: 'stone_wood', kind: 'shrine', name: "The Woodward's Shrine", bless: 'green', blessName: 'Green Path', secs: 120, every: 300, amount: 0,
      blurb: 'Green Path: wolves, dogs and boars leave you be for two minutes.' },
    { road: 'r5_wolfwood', at: 0.59, side: 1, id: 'greyfang', kind: 'beast', type: 'greyfang', name: 'Greyfang',
      blurb: 'The wolf the villagers name. It walks the road between the Lodge and the hut.' },
    { road: 'r5_wolfwood', at: 0.7, side: -1, id: 'haw_break', kind: 'bramble', name: 'The Hawthorn Break',
      blurb: 'A hedge of hawthorn where the wood thins out on the way to Wren.', pick: 'haws', every: 120 },
    { road: 'r5_wolfwood', at: 0.86, side: 1, id: 'hollow_oak', kind: 'cache', name: 'The Hollow Oak',
      blurb: 'An old oak, hollow inside. Somebody keeps a little store in it for lost travellers.', loot: [['bread', 3, 3], ['coins', 25, 25], ['stone_arrow', 15, 15]], once: true },
    // --- R6 the Ash Road ---
    { road: 'r6_ash', at: 0.16, side: 1, id: 'post', kind: 'cache', name: "The Warden's Old Post",
      blurb: "The Warden's father kept this post before the gate was built. His key is still in it.", loot: [['iron_key', 1, 1], ['coins', 40, 40], ['bread', 2, 2]], once: true },
    { road: 'r6_ash', at: 0.32, side: -1, id: 'lore_ash', kind: 'lore', name: 'The Last Board',
      blurb: 'Painted on the board: "Past the gate the road is only a track across the ash. Follow the cairns. Turn back if you see wings."' },
    { road: 'r6_ash', at: 0.56, side: 1, id: 'cinder_meg', kind: 'trader', who: 'cinder_meg', name: 'Cinder Meg',
      blurb: 'Her charcoal clamp smokes beside the track past the gate. Four logs for three coal.' },
    { road: 'r6_ash', at: 0.68, side: -1, id: 'stone_kneel', kind: 'shrine', name: 'The Kneeling Stone', bless: 'might', blessName: 'Ash Ward', secs: 90, every: 300, amount: 3,
      blurb: 'Ash Ward: your swings hit 3 harder for ninety seconds.' },
    { road: 'r6_ash', at: 0.8, side: 1, id: 'ashjaw', kind: 'beast', type: 'ashjaw', name: 'Ashjaw',
      blurb: 'An ash-crusted drakeling that will not leave the lair road.' },
    { road: 'r6_ash', at: 0.9, side: -1, id: 'bones', kind: 'bones', name: 'The Bone Pile',
      blurb: 'Old bones, picked clean by the drakes. Some of them are still good for something.', every: 600 },
    // --- R7 the Drovers' Track ---
    { road: 'r7_drovers', at: 0.5, side: 1, id: 'lookout', kind: 'cache', name: "The Bandits' Lookout",
      blurb: 'A lookout the bandits built on their way to the hills, and forgot. Their stash is still under the boards.', loot: [['coins', 45, 45], ['stone_arrow', 20, 20], ['bread', 1, 1]], once: true },
  ];
  const BLESS_SKILLS = { hands: ['mining', 'woodcutting'], lines: ['fishing'] };
  const GREEN_RANGE = 9 * TILE;
  const GREEN_PATH = new Set(['wolf', 'boar', 'wild_dog', 'greyfang', 'grizzlejaw', 'bear']);
  RD.POI_DEF = POI_DEF; RD.NAMED = NAMED; RD.TRADES = TRADES; RD.NEW_ITEMS = NEW_ITEMS; RD.pois = [];
  RD.poi = id => RD.pois.find(p => p.id === id) || null;
  const st = () => (quest.roads = quest.roads || { opened: {}, timer: {}, bless: null, mendT: 0 });
  HOOKS.newGame.push(() => { quest.roads = { opened: {}, timer: {}, bless: null, mendT: 0 }; });

  // the things' standing: a solid thing 3 out (past the verge), a trader 3 out, a beast 6 out (it keeps to its patch, and
  // it never stands on the road)
  const SOLID_KIND = new Set(['wreck', 'shrine', 'cache', 'box', 'bramble', 'pool', 'well', 'bones', 'lore']);
  function placePois(api) {
    RD.pois = []; const S = RD.stats; S.pois = 0; S.poiUnplaced = [];
    for (const d of POI_DEF) {
      const R = RD.roads[d.road], p = Object.assign({}, d, { at: null, roadName: R && R.name || (A.ROAD_IDS.includes(d.road) ? d.road : null) });
      RD.pois.push(p);
      if (!R || !R.length) { S.poiUnplaced.push(d.id + ' (no road)'); continue; }
      const off = d.kind === 'beast' ? 6 : 3, solid = SOLID_KIND.has(d.kind), want = d.at * R.length;
      let spot = null;
      for (let k = 0; k <= 10 && !spot; k++) for (const sgn of k ? [1, -1] : [1]) {
        const s = want + sgn * k * 1.5; if (s < 3 || s > R.length - 3 || spot) continue;
        spot = beside(R, s, d.side, off, solid, d.kind === 'beast' ? 5 : 4, d.kind === 'beast' ? (x, y) => clearRing(x, y) && regionsAgree(x, y) : d.kind === 'trader' ? (x, y) => clearOf(x, y, 4) && regionsAgree(x, y) : null)
          || beside(R, s, -d.side, off, solid, d.kind === 'beast' ? 5 : 4, d.kind === 'beast' ? (x, y) => clearRing(x, y) && regionsAgree(x, y) : d.kind === 'trader' ? (x, y) => clearOf(x, y, 4) && regionsAgree(x, y) : null);
      }
      if (!spot) { S.poiUnplaced.push(d.id); continue; }
      p.at = [spot.x, spot.y]; p.s = Math.round(spot.s); S.pois++;
      if (d.kind === 'beast') { api.spawnList(d.type, [[spot.x, spot.y]]); const sp = MONSTER_SPAWNS[MONSTER_SPAWNS.length - 1]; sp.by = '93-roads'; RD.changed[spot.y * MAP_W + spot.x] = 1; taken.push([spot.x, spot.y]); markNear(spot.x, spot.y); }
      else if (d.kind === 'trader') { const n = TRADES[d.who]; n.x = spot.x; n.y = spot.y; initNpc(n); NPCS.push(n); RD.changed[spot.y * MAP_W + spot.x] = 1; taken.push([spot.x, spot.y]); markNear(spot.x, spot.y); }
      else thing(api, spot.x, spot.y, d.kind, { poi: d.id });
    }
  }
  // a person's or a beast's cell is where 92-worldshape's outline and its region's box agree (92's check counts every
  // person and spawn in the region its box says)
  const regionsAgree = (x, y) => !window.WORLDSHAPE || !WORLDSHAPE.boxRegion || regionAt(x, y).name === WORLDSHAPE.boxRegion(x, y).name;
  // a beast's patch: open ground all round (the core clears its 3 x 3 of trees and rocks, never ore: keep a tile off ore)
  const ORE = () => new Set(['IRON', 'COAL', 'MITHRIL', 'BLACKIRON', 'SUNSTONE', 'STORMSTONE', 'BERRY_BUSH'].map(Tn).filter(v => v >= 0));
  let ORES = null;
  // (and never on the camp's ground: its respawn rule and its CLEARED banner are the camp's)
  function clearRing(x, y) { ORES = ORES || ORE(); if (x >= CAMP_GROUND.x0 && x <= CAMP_GROUND.x1 && y >= CAMP_GROUND.y0 && y <= CAMP_GROUND.y1) return false; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const t = map[(y + dy) * MAP_W + x + dx]; if (ORES.has(t) || (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && !walkable(t) && !FELL.has(t) && t !== T.ROCK)) return false; } return !PROTECT[y * MAP_W + x]; }
  // a person: 4+ tiles from a signpost, a rail and every thing beside the road (E at one of them must not talk to him first)
  function clearOf(x, y, d) { for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { if (!inMap(x + dx, y + dy)) continue; const t = map[(y + dy) * MAP_W + x + dx]; if (t === T.SIGN || t === Tn('HITCH') || t === TD_PROP()) return false; } return true; }

  // ---------- what each one does ----------
  const timer = id => st().timer[id] || 0;
  const setTimer = (id, v) => { st().timer[id] = v; };
  const mmss = s => (s >= 60 ? Math.ceil(s / 60) + (Math.ceil(s / 60) === 1 ? ' minute' : ' minutes') : Math.ceil(s) + ' seconds');
  const blessed = key => { const q = quest.roads; return q && q.bless && q.bless.key === key && q.bless.left > 0 ? q.bless : null; };
  RD.blessed = blessed;
  function bless(p) { const q = st(); q.bless = { key: p.bless, name: p.blessName, left: p.secs, n: p.amount }; q.mendT = 0;
    levelBanner = { text: p.blessName.toUpperCase(), sub: p.name, t: 3 }; burst(player.x, player.y, '#bcd8ea', 22, 90); sfx('quest'); }
  // the three core calls a blessing leans on, wrapped the way 13-ux wraps say()
  { const _hurt = hurtPlayer; hurtPlayer = function (dmg, fx, fy, sure) { const b = blessed('fair'); if (b && dmg > 1) dmg = Math.max(1, dmg - b.n); return _hurt.call(this, dmg, fx, fy, sure); }; }
  { const _mh = playerMaxHit; playerMaxHit = function () { const b = blessed('might'); return _mh.apply(this, arguments) + (b && !arguments[0] ? b.n : 0); }; }
  { const _xp = gainXp; gainXp = function (skill, xp) { for (const k in BLESS_SKILLS) if (blessed(k) && BLESS_SKILLS[k].includes(skill)) xp = Math.round(xp * 2); return _xp.call(this, skill, xp); }; }
  HOOKS.update.push(dt => {
    const q = quest.roads; if (!q) return;
    for (const k in q.timer) { q.timer[k] -= dt; if (q.timer[k] <= 0) delete q.timer[k]; }
    if (!q.bless) return;
    q.bless.left -= dt;
    if (q.bless.left <= 0) { notify(q.bless.name + ' has worn off.'); q.bless = null; return; }
    if (q.bless.key === 'mend' && !player.dead && player.hp < player.maxHp) { q.mendT = (q.mendT || 0) + dt;
      if (q.mendT >= 3) { q.mendT = 0; player.hp = Math.min(player.maxHp, player.hp + q.bless.n); floatText(player.x, player.y - 30, '+' + q.bless.n, '#7ee787', 13); } }
    if (q.bless.key === 'green') for (const m of monsters) {
      if (m.dead || !GREEN_PATH.has(m.type) || dist(m.x, m.y, player.x, player.y) > GREEN_RANGE) continue;
      if (m.state === 'chase') m.state = 'return'; m.angry = false; }
  });
  function usePoi(p, tx, ty) {
    const q = st();
    if (p.kind === 'wreck') {
      if (timer(p.id) > 0) { notify(`${p.name} is picked clean. Another cart comes by in ${mmss(timer(p.id))}.`); return; }
      for (const [id, a, b] of p.loot) { const n = rint(a, b); if (n > 0) giveOrDrop(id, n, player.x, player.y); }
      setTimer(p.id, p.every); say(p.blurb, p.name); burst(tc(tx), tc(ty), '#8b5a2b', 14, 80); sfx('pickup'); save(); return;
    }
    if (p.kind === 'shrine') {
      if (timer(p.id) > 0) { notify(`${p.name} is quiet. It will hear you again in ${mmss(timer(p.id))}.`); return; }
      setTimer(p.id, p.every); bless(p); say(p.blurb, p.name); save(); return;
    }
    if (p.kind === 'well') {
      if (timer(p.id) > 0) { notify(`The bucket is still coming up. Try again in ${mmss(timer(p.id))}.`); return; }
      setTimer(p.id, p.every); player.hp = player.maxHp; floatText(player.x, player.y - 30, 'Whole again', '#7ee787', 13); say(p.blurb, p.name); burst(tc(tx), tc(ty), '#9fd0ff', 10, 50); sfx('pickup'); save(); return;
    }
    if (p.kind === 'bramble' || p.kind === 'bones') {
      const item = p.kind === 'bones' ? 'bone' : p.pick;
      if (timer(p.id) > 0) { notify(p.kind === 'bones' ? `Nothing useful left. Come back in ${mmss(timer(p.id))}.` : `Picked bare. ${p.name} ripens again in ${mmss(timer(p.id))}.`); return; }
      if (!canFit(item, 1)) { notify('Your pack is full.'); return; }
      const n = rint(2, 4); giveOrDrop(item, n, player.x, player.y); setTimer(p.id, p.every);
      floatText(player.x, player.y - 30, `+${n} ${ITEMS[item].name}`, ITEMS[item].color, 13); burst(tc(tx), tc(ty), p.kind === 'bones' ? '#e8e2d0' : '#c0294a', 8, 60); sfx('pickup'); save(); return;
    }
    if (p.kind === 'pool') {
      if (!hasTool('rod')) { notify('Deep water, and something moving in it. You need a fishing rod (Marta sells them).'); return; }
      if (!canFit(p.fish, 1)) { notify('Your pack is full.'); return; }
      player.action = { type: 'roadfish', t: 0, need: 1.8, tx, ty, poi: p.id }; return;
    }
    if (p.kind === 'lore') { say(p.blurb, p.name); return; }
    if (p.kind === 'cache' || p.kind === 'box') {
      if (q.opened[p.id]) { notify(`${p.name} is empty. Whatever was in it, you have it.`); return; }
      if (p.key && !countItem(p.key)) { const c = RD.poi('post'); say(`${p.name}. The lock wants an iron key. There is one on the Ash Road, in the Warden's old post${c && c.at ? '' : ''}.`, 'The Voice'); return; }
      if (p.key) removeItem(p.key, 1);
      for (const [id, a, b] of p.loot) giveOrDrop(id, rint(a, b), player.x, player.y);
      q.opened[p.id] = true; say(p.blurb, p.name);
      levelBanner = { text: p.key ? 'STRONGBOX OPENED' : 'CACHE OPENED', sub: p.name, t: 3 }; burst(tc(tx), tc(ty), '#f5c542', 24, 110); sfx('quest'); save();
    }
  }
  RD.usePoi = usePoi;
  // the pool's timed catch, run the way the core runs its own timed actions
  HOOKS.update.push(dt => {
    const a = player.action; if (!a || a.type !== 'roadfish') return;
    a.t += dt; if (a.t < a.need) return;
    const p = RD.poi(a.poi); player.action = Object.assign({}, a, { t: 0 });
    if (!p) { player.action = null; return; }
    if (Math.random() > Math.min(0.92, 0.55 + skillLv('fishing') * 0.02)) return;
    giveOrDrop(p.fish, 1, player.x, player.y); gainXp('fishing', p.xp); sfx('fish'); burst(tc(a.tx), tc(a.ty), '#bfe3ff', 8, 50);
    if (Math.random() < 1 / p.extraOdds) { giveOrDrop(p.extra, 1, player.x, player.y); levelBanner = { text: 'RIVER PEARL', sub: p.name, t: 3 }; burst(tc(a.tx), tc(a.ty), '#f5c542', 24, 110); }
    if (!canFit(p.fish, 1)) { player.action = null; notify('Your pack is full.'); }
  });
  // the traders
  HOOKS.talk.road_trade = npc => {
    const tr = TRADES[npc.id]; if (!tr) return;
    const [gid, gn] = tr.give, [tid, tn] = tr.take, have = gid === 'coins' ? coins() : countItem(gid);
    if (have < gn) { say(`${tr.line} You have ${have} of ${gn}.`, npc.name); return; }
    if (gid === 'coins') payCoins(gn); else removeItem(gid, gn);
    giveOrDrop(tid, tn, player.x, player.y);
    say(`${tr.line} There you are.`, npc.name); floatText(player.x, player.y - 30, `+${tn} ${ITEMS[tid].name}`, ITEMS[tid].color, 13); sfx('coins'); save();
  };
  // the blessing's plaque (59-hudkit: a thing that comes and goes)
  HOOKS.hud.push(g => {
    const q = quest.roads; if (!q || !q.bless || q.bless.left <= 0 || !window.HK || !HK.addPlaque) return;
    HK.addPlaque(g, { id: 'road_bless', emblem: 'star', name: q.bless.name.toUpperCase(), right: Math.ceil(q.bless.left) + 's', frac: Math.max(0, Math.min(1, q.bless.left / 180)), bar: 'good' });
  });
  // 42-playthrough: the named beasts on the xp curve
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => { for (const t in NAMED) { const m = NAMED[t]; add('melee', m.name + ' (a named beast by the road)', m.level, m.hp * 4 + m.level * 10, m.respawn, '93-roads, back ' + m.respawn + ' s after a kill'); } });

  // ---------- the markers' looks and words ----------
  const lit = () => !!(window.NIGHT && NIGHT.phase() !== 'day');
  if (window.DECO) {
    // a lantern post: a dark iron post on the verge with a lamp in a little cage; lit at night (HOOKS.nightLights below)
    DECO.kind('road_lantern', { foot: 4, use: () => 'A lantern post on the road. It burns all night, so nobody loses the way in the dark.',
      draw(g, px, py) { const cx = px + TILE / 2, base = py + TILE - 6, on = lit();
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, base + 2, 9, 3.5, 0, 0, 7); g.fill();
        g.fillStyle = '#3b3a3f'; g.fillRect(cx - 2.5, base - 44, 5, 46); g.fillRect(cx - 6, base - 2, 12, 4);
        g.fillStyle = '#2c2b30'; g.fillRect(cx - 8, base - 50, 16, 3); g.beginPath(); g.moveTo(cx - 7, base - 50); g.lineTo(cx, base - 57); g.lineTo(cx + 7, base - 50); g.closePath(); g.fill();
        g.fillStyle = on ? '#ffd877' : '#8c8467'; g.fillRect(cx - 5, base - 47, 10, 9);
        g.strokeStyle = '#2c2b30'; g.lineWidth = 1.2; g.strokeRect(cx - 5, base - 47, 10, 9); g.beginPath(); g.moveTo(cx, base - 47); g.lineTo(cx, base - 38); g.stroke();
        if (on) { const f = 0.75 + Math.sin(time * 7 + px) * 0.1; g.fillStyle = `rgba(255,214,120,${0.35 * f})`; g.beginPath(); g.arc(cx, base - 43, 13, 0, 7); g.fill(); } } });
    // a cairn: a little pile of grey stones, the top one set on its edge
    DECO.kind('road_cairn', { foot: 4, use: () => 'A cairn: stones piled up by travellers to mark the way. Add one if you like.',
      draw(g, px, py, c, tx, ty) { const cx = px + TILE / 2, base = py + TILE - 8, h = hash(tx, ty, 3);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, base + 3, 13, 4, 0, 0, 7); g.fill();
        const st = [[0, 0, 12, 6, '#8d8a84'], [-3, -8, 9, 5, '#a29e96'], [3, -15, 7, 4.5, '#8f8b85'], [-1 + h * 2, -22, 4.5, 4, '#b3afa6']];
        for (const [ox, oy, rx, ry, col] of st) { g.fillStyle = col; g.beginPath(); g.ellipse(cx + ox, base + oy, rx, ry, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(60,58,54,0.6)'; g.lineWidth = 1; g.stroke(); } } });
  }
  // the lamps light the dark (35-night's overworld scrim)
  if (HOOKS.nightLights) HOOKS.nightLights.push((out, x0, y0, x1, y1) => {
    if (window.__instance || !window.DECO || DECO.id < 0 || !lit()) return;
    for (const id in RD.roads) for (const m of RD.roads[id].marks || []) { if (m.kind !== 'road_lantern' || m.x < x0 - 3 || m.x > x1 + 3 || m.y < y0 - 3 || m.y > y1 + 3) continue;
      if (map[idx(m.x, m.y)] !== DECO.id) continue; out.push({ x: tc(m.x), y: m.y * TILE + TILE - 49, r: 110, kind: 'road lantern' }); }
  });
  // the stops along a road, in its order: the places its track names and the things beside it
  function stopsOf(R) {
    const out = [], pts = A.TRACKS[R.id], seen = new Set();
    pts.forEach((q, k) => { const pl = q[0] === 'port' ? q[1].split('.')[0] : null; if (k === 0 || k === pts.length - 1 || !pl) return; const w = A.signWords ? A.signWords(pl) : pl; if (seen.has(w)) return; seen.add(w); out.push({ s: R.cum[k], name: w }); });
    for (const p of RD.pois || []) if (p.road === R.id && p.at) out.push({ s: p.s || 0, name: p.name });
    return out.sort((a, b) => a.s - b.s).map(o => o.name);
  }
  RD.stopsOf = stopsOf;
  KINDS.milestone = { say: 'The milestone',
    use: c => { const R = RD.roads[c.road]; if (!R) return 'A milestone, worn smooth.';
      const ends = A.TRACKS[R.id], far = c.end ? ends[0] : ends[ends.length - 1], farName = far[0] === 'port' && A.signWords ? A.signWords(far[1].split('.')[0]) : 'the far end';
      const list = stopsOf(R), there = A.walkWords(R.length / WALK);
      return `${R.name}. ${R.sub}. To ${farName}: ${there} (half that on a horse).` + (list.length ? ` On the way: ${(c.end ? list.slice().reverse() : list).join(', ')}.` : ''); },
    // a squat grey stone with a rounded top and three cut lines
    draw(g, px, py) { const cx = px + TILE / 2, cy = py + TILE / 2;
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, cy + 15, 13, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#a8a293'; g.beginPath(); g.moveTo(cx - 9, cy + 15); g.lineTo(cx - 7, cy - 13); g.quadraticCurveTo(cx, cy - 21, cx + 7, cy - 13); g.lineTo(cx + 9, cy + 15); g.closePath(); g.fill();
      g.fillStyle = '#c6c0b0'; g.beginPath(); g.moveTo(cx - 9, cy + 15); g.lineTo(cx - 7, cy - 13); g.quadraticCurveTo(cx - 3, cy - 19, cx - 1, cy - 18); g.lineTo(cx - 1, cy + 15); g.closePath(); g.fill();
      g.strokeStyle = '#5e5a51'; g.lineWidth = 1.4; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - 5, cy - 6 + i * 6); g.lineTo(cx + 5, cy - 6 + i * 6); g.stroke(); } } };
  // ---------- the places to stop for: their looks (roads2's art, and the well, the bones and the boards) ----------
  const poiOf = c => RD.poi(c.poi);
  const useOf = c => { const p = poiOf(c); return (c2, tx, ty) => { if (p) usePoi(p, tx, ty); return null; }; };
  const shadow = (g, cx, cy, rx, ry) => { g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); };
  const POI_LOOK = {
    wreck(g, cx, cy, p, x, y) { const empty = p && timer(p.id) > 0;
      shadow(g, cx, cy + 14, 20, 7); g.save(); g.translate(cx, cy); g.rotate(-0.42);
      g.fillStyle = '#6b4b28'; g.fillRect(-18, -8, 34, 16); g.fillStyle = '#87613a'; g.fillRect(-18, -8, 34, 5);
      g.strokeStyle = '#4a3319'; g.lineWidth = 1.6; for (let i = -14; i < 16; i += 7) { g.beginPath(); g.moveTo(i, -8); g.lineTo(i, 8); g.stroke(); }
      g.restore();
      g.strokeStyle = '#4a3319'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx + 14, cy + 8, 11, 5, 0.2, 0, 7); g.stroke();
      g.lineWidth = 1.4; for (let i = 0; i < 6; i++) { const a = i * 1.047; g.beginPath(); g.moveTo(cx + 14, cy + 8); g.lineTo(cx + 14 + Math.cos(a) * 10, cy + 8 + Math.sin(a) * 4.5); g.stroke(); }
      if (!empty) for (const [ox, oy, col] of [[-14, 10, '#c9a227'], [-6, 13, '#b9873a'], [4, 12, '#9aa3ae']]) { g.fillStyle = col; g.beginPath(); g.arc(cx + ox, cy + oy, 3, 0, 7); g.fill(); } },
    shrine(g, cx, cy, p, x) { const ready = p && timer(p.id) <= 0;
      shadow(g, cx, cy + 15, 15, 6); g.fillStyle = '#8f9aa4'; g.fillRect(cx - 12, cy + 6, 24, 9);
      g.fillStyle = '#a9b4be'; g.beginPath(); g.moveTo(cx - 9, cy + 6); g.lineTo(cx - 7, cy - 14); g.lineTo(cx + 7, cy - 14); g.lineTo(cx + 9, cy + 6); g.closePath(); g.fill();
      g.fillStyle = '#c3ced8'; g.beginPath(); g.moveTo(cx - 9, cy - 14); g.lineTo(cx, cy - 23); g.lineTo(cx + 9, cy - 14); g.closePath(); g.fill();
      g.fillStyle = ready ? '#ffe9a8' : '#4d5560'; g.beginPath(); g.arc(cx, cy - 6, 4.5, 0, 7); g.fill();
      if (ready) { const pulse = 0.5 + Math.sin(time * 2.4 + x) * 0.3; g.fillStyle = `rgba(255,233,168,${0.25 * pulse})`; g.beginPath(); g.arc(cx, cy - 6, 11, 0, 7); g.fill(); } },
    box(g, cx, cy, p) { const open = p && quest.roads && quest.roads.opened[p.id];
      shadow(g, cx, cy + 14, 16, 6); g.fillStyle = '#6d5a34'; g.fillRect(cx - 14, cy - 6, 28, 20);
      g.fillStyle = open ? '#4a3f24' : '#8a7442'; g.fillRect(cx - 14, cy - 13, 28, 8);
      g.fillStyle = '#9aa3ae'; g.fillRect(cx - 15, cy - 2, 30, 3); g.fillRect(cx - 2, cy - 13, 4, 27);
      if (!open) { g.fillStyle = '#c9a227'; g.beginPath(); g.arc(cx, cy + 3, 4, 0, 7); g.fill(); g.fillStyle = '#5a4a1e'; g.fillRect(cx - 1, cy + 3, 2, 4); }
      g.strokeStyle = '#7c8189'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 14, cy + 4); g.lineTo(cx + 20, cy + 8); g.stroke();
      g.fillStyle = '#5a4a33'; g.fillRect(cx + 18, cy - 10, 5, 24); },
    cache(g, cx, cy, p) { const open = p && quest.roads && quest.roads.opened[p.id];
      shadow(g, cx, cy + 14, 18, 7);
      g.fillStyle = '#5f5a51'; g.beginPath(); g.moveTo(cx - 18, cy + 15); g.lineTo(cx - 13, cy - 14); g.lineTo(cx - 2, cy - 18); g.lineTo(cx - 3, cy + 15); g.closePath(); g.fill();
      g.fillStyle = '#6e6960'; g.beginPath(); g.moveTo(cx + 18, cy + 15); g.lineTo(cx + 13, cy - 15); g.lineTo(cx + 2, cy - 17); g.lineTo(cx + 3, cy + 15); g.closePath(); g.fill();
      g.fillStyle = open ? '#2a2722' : '#191714'; g.fillRect(cx - 3, cy - 14, 6, 29);
      if (!open) { g.fillStyle = '#7a5f2c'; g.fillRect(cx - 5, cy + 2, 10, 9); g.fillStyle = '#c9a227'; g.fillRect(cx - 5, cy + 4, 10, 2); } },
    bramble(g, cx, cy, p, x, y) { const bare = p && timer(p.id) > 0, sway = Math.sin(time * 1.5 + x * 0.8 + y * 0.5) * 0.9;
      shadow(g, cx, cy + 16, 20, 6); g.strokeStyle = '#4b3a22'; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const a = hash(x, y, i); g.beginPath(); g.moveTo(cx - 14 + i * 7, cy + 15); g.quadraticCurveTo(cx - 12 + i * 7 + (a - 0.5) * 10, cy, cx - 16 + i * 7 + sway, cy - 12 - a * 8); g.stroke(); }
      for (const [ox, oy, r] of [[-10, 0, 10], [8, 2, 9], [0, -8, 11], [-4, 8, 8]]) { g.fillStyle = bare ? '#3f5f2c' : '#2f5e26'; g.beginPath(); g.arc(cx + ox + sway * 0.4, cy + oy, r, 0, 7); g.fill(); }
      for (const [ox, oy, r] of [[-10, 0, 10], [8, 2, 9], [0, -8, 11]]) { g.fillStyle = bare ? '#5f8a44' : '#4c9134'; g.beginPath(); g.arc(cx + ox - 2 + sway * 0.4, cy + oy - 3, r * 0.55, 0, 7); g.fill(); }
      if (!bare) for (const [ox, oy] of [[-11, -3], [-2, -11], [7, -6], [11, 3], [-6, 6], [2, 2], [8, 9]]) { g.fillStyle = '#a8203c'; g.beginPath(); g.arc(cx + ox + sway * 0.4, cy + oy, 2.6, 0, 7); g.fill(); } },
    pool(g, cx, cy, p, x, y) {
      g.fillStyle = '#5c7a4a'; g.beginPath(); g.ellipse(cx, cy, 23, 21, 0, 0, 7); g.fill();
      g.fillStyle = '#1d3f5c'; g.beginPath(); g.ellipse(cx, cy, 19, 17, 0, 0, 7); g.fill();
      g.fillStyle = '#2b5c80'; g.beginPath(); g.ellipse(cx, cy + 2, 15, 12, 0, 0, 7); g.fill();
      for (let i = 0; i < 3; i++) { const ph = (time * 0.5 + i * 0.33) % 1; g.strokeStyle = `rgba(190,225,255,${0.45 * (1 - ph)})`; g.lineWidth = 1.4; g.beginPath(); g.ellipse(cx, cy + 2, 3 + ph * 13, 2 + ph * 10, 0, 0, 7); g.stroke(); }
      const fx = cx + Math.sin(time * 0.9 + x) * 8, fy = cy + Math.cos(time * 0.7 + y) * 6; g.fillStyle = 'rgba(214,232,240,0.55)'; g.beginPath(); g.ellipse(fx, fy, 5, 2.2, Math.sin(time) * 0.6, 0, 7); g.fill();
      for (const [ox, oy] of [[-20, -12], [19, -10], [-17, 13]]) { g.fillStyle = '#7d8570'; g.beginPath(); g.ellipse(cx + ox, cy + oy, 5, 3.5, 0.3, 0, 7); g.fill(); } },
    // a stone well with a little roof and a bucket on its rope
    well(g, cx, cy, p) { const ready = p && timer(p.id) <= 0;
      shadow(g, cx, cy + 15, 17, 6); g.fillStyle = '#8f8a80'; g.beginPath(); g.ellipse(cx, cy + 8, 15, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#a7a196'; g.fillRect(cx - 15, cy - 2, 30, 10); g.fillStyle = '#1d3346'; g.beginPath(); g.ellipse(cx, cy - 2, 12, 4.5, 0, 0, 7); g.fill();
      g.fillStyle = '#5a4128'; g.fillRect(cx - 14, cy - 26, 3, 25); g.fillRect(cx + 11, cy - 26, 3, 25);
      g.fillStyle = '#7a4a2a'; g.beginPath(); g.moveTo(cx - 18, cy - 24); g.lineTo(cx, cy - 34); g.lineTo(cx + 18, cy - 24); g.closePath(); g.fill();
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy - 24); g.lineTo(cx, ready ? cy - 12 : cy - 4); g.stroke();
      g.fillStyle = '#6b5236'; g.fillRect(cx - 4, ready ? cy - 12 : cy - 5, 8, 6); },
    // a heap of old bones and a horned skull
    bones(g, cx, cy, p) { const bare = p && timer(p.id) > 0;
      shadow(g, cx, cy + 12, 18, 6); g.strokeStyle = '#d9d2bc'; g.lineCap = 'round';
      for (const [x0, y0, x1, y1] of [[-14, 10, 6, 4], [-8, 0, 12, 10], [-2, 12, 14, -2], [-16, 2, -2, -6]].slice(0, bare ? 2 : 4)) { g.lineWidth = 3.5; g.beginPath(); g.moveTo(cx + x0, cy + y0); g.lineTo(cx + x1, cy + y1); g.stroke(); }
      g.lineCap = 'butt'; g.fillStyle = '#e6dfca'; g.beginPath(); g.ellipse(cx + 4, cy - 6, 8, 6.5, 0, 0, 7); g.fill();
      g.fillStyle = '#2a2622'; g.beginPath(); g.arc(cx + 1, cy - 7, 1.8, 0, 7); g.arc(cx + 7, cy - 7, 1.8, 0, 7); g.fill();
      g.strokeStyle = '#cfc6ae'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - 3, cy - 10); g.quadraticCurveTo(cx - 10, cy - 16, cx - 6, cy - 21); g.moveTo(cx + 11, cy - 10); g.quadraticCurveTo(cx + 18, cy - 16, cx + 14, cy - 21); g.stroke(); },
    // a weathered board on a post, its words cut into it
    lore(g, cx, cy) {
      shadow(g, cx, cy + 16, 10, 4); g.fillStyle = '#5a4128'; g.fillRect(cx - 2.5, cy - 14, 5, 31);
      g.fillStyle = '#9c7a4e'; g.fillRect(cx - 15, cy - 24, 30, 18); g.strokeStyle = '#5a4128'; g.lineWidth = 2; g.strokeRect(cx - 15, cy - 24, 30, 18);
      g.fillStyle = '#4a3420'; for (let k = 0; k < 3; k++) g.fillRect(cx - 10, cy - 20 + k * 5, 20 - (k % 2) * 6, 2); },
  };
  for (const kind of Object.keys(POI_LOOK)) KINDS[kind] = { say: null,
    use: (c, tx, ty) => { const p = poiOf(c); if (p) usePoi(p, tx, ty); return null; },
    draw: (g, px, py, c, tx, ty) => POI_LOOK[kind](g, px + TILE / 2, py + TILE / 2, poiOf(c), tx, ty) };
  RD.KINDS = KINDS;
  // E on a thing beside the road: its words (a POI's own handler may do more: RD.use)
  HOOKS.use.push((t, tx, ty) => {
    if (window.__instance || t !== TD_PROP()) return false;
    const c = RD.things.get(idx(tx, ty)), k = c && KINDS[c.kind]; if (!k) return false;
    const words = typeof k.use === 'function' ? k.use(c, tx, ty) : k.use;
    if (words) { if (k.say) say(words, typeof k.say === 'function' ? k.say(c) : k.say); else notify(words); }
    return true;
  });
  HOOKS.draw.push((g, items) => {
    if (window.__instance || !RD.things.size) return;
    const vis = (x, y, r) => x + r > cam.x && x - r < cam.x + VW && y + r > cam.y && y - r < cam.y + VH;
    for (const [i, c] of RD.things) {
      const tx = i % MAP_W, ty = (i / MAP_W) | 0, px = tx * TILE, py = ty * TILE, k = KINDS[c.kind];
      if (!k || map[i] !== TD_PROP() || !vis(px + TILE / 2, py + TILE / 2, TILE + TILE)) continue;
      const v = variant[i] % 3;
      items.push({ y: -1e9 + 1, draw: () => { const img = tex[TEX_NAME[c.under] + v]; if (img) g.drawImage(img, px, py, TILE, TILE); if (c.under === T_VERGE) drawVerge(g, tx, ty); else if (c.under === T_ROAD) drawRoad(g, tx, ty); } });
      items.push({ y: py + TILE - 4, draw: () => k.draw(g, px, py, c, tx, ty) });
    }
  });

  // the pass: last of the built passes (it is pushed after every Stage 5 place's, all of which load before 93)
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  HOOKS.built.push((rnd, api) => {
    const T0 = now(), ph = {}, run = (k, f) => { const t = now(); f(); ph[k] = Math.round((now() - t) * 10) / 10; };
    run('lay', () => lay(api)); run('links', placeLinks); run('stitch', stitch); RD.things.clear(); taken = [];
    run('signs', () => forkSigns(api)); run('pois', () => placePois(api)); run('markers', () => markers(api)); run('foot', footprint);
    run('ash', () => { RD.afAfter = afGreen(); });
    RD.stats.phases = ph; RD.stats.passMs = Math.round((now() - T0) * 10) / 10;
  });
  // the walk time of a leg (01-atlas signText asks it for every arm): the road's laid length over a knight's foot speed
  A.legSecs = (id, k0, k1) => { const L = RD.span(id, k0, k1); return L === null ? null : L / WALK; };

  // ---------- nothing is built on the road ----------
  { const _placeAction = placeAction;
    placeAction = function (id) {
      if (!window.__instance && !player.dead && !player.mech && T_ROAD >= 0) {
        const { tx, ty } = frontTile(player, 40), t = inMap(tx, ty) ? tileAt(tx, ty) : -1;
        if (t === T_ROAD || t === T_VERGE) { notify('This is the road. Build beside it.'); return; }
      }
      return _placeAction.apply(this, arguments);
    }; }

  // ============================================================================
  // THE PICTURE
  // ============================================================================
  const hash = (x, y, k) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k, 1274126177)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1540483477) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const isRoad = (x, y) => inMap(x, y) && map[idx(x, y)] === T_ROAD;
  // the surface: packed gravel, two wheel ruts down the line of travel, loose stones; edges blend into the verge
  function drawRoad(g, x, y) {
    const bx = x * TILE, by = y * TILE;
    const n = isRoad(x, y - 1), s = isRoad(x, y + 1), w = isRoad(x - 1, y), e = isRoad(x + 1, y);
    // packed gravel over the dirt it was laid on; an outside corner is rounded off (the worn shoulder shows), so a road
    // that steps across the map bends rather than stairs
    const CR = TILE * 0.31, tl = !n && !w ? CR : 0, tr = !n && !e ? CR : 0, br = !s && !e ? CR : 0, bl = !s && !w ? CR : 0;
    g.fillStyle = '#a3936f'; g.beginPath();
    g.moveTo(bx + tl, by); g.lineTo(bx + TILE - tr, by); if (tr) g.arcTo(bx + TILE, by, bx + TILE, by + tr, tr);
    g.lineTo(bx + TILE, by + TILE - br); if (br) g.arcTo(bx + TILE, by + TILE, bx + TILE - br, by + TILE, br);
    g.lineTo(bx + bl, by + TILE); if (bl) g.arcTo(bx, by + TILE, bx, by + TILE - bl, bl);
    g.lineTo(bx, by + tl); if (tl) g.arcTo(bx, by, bx + tl, by, tl);
    g.closePath(); g.fill();
    const alongX = (w || e) && (!(n || s) || (w && e));
    // the ruts only down the middle of the way (a tile with road on both sides across the line of travel)
    const mid = alongX ? n && s : w && e;
    if (mid) { g.strokeStyle = 'rgba(112,96,70,0.45)'; g.lineWidth = 3;
      for (const f of [0.28, 0.72]) { g.beginPath(); if (alongX) { g.moveTo(bx, by + TILE * f); g.lineTo(bx + TILE, by + TILE * f); } else { g.moveTo(bx + TILE * f, by); g.lineTo(bx + TILE * f, by + TILE); } g.stroke(); } }
    for (let i = 0; i < 7; i++) { const a = hash(x, y, i), b = hash(x, y, i + 21);
      g.fillStyle = a > 0.55 ? 'rgba(218,206,176,0.8)' : 'rgba(112,98,74,0.6)'; g.beginPath(); g.arc(bx + 6 + a * 36, by + 6 + b * 36, 1.2 + a * 1.7, 0, 7); g.fill(); }
  }
  // the verge: cropped turf with a row of kerb stones on the road side
  function drawVerge(g, x, y) {
    const bx = x * TILE, by = y * TILE;
    g.fillStyle = 'rgba(126,150,78,0.16)'; g.fillRect(bx, by, TILE, TILE);
    for (const [dx, dy] of N4) {
      if (!isRoad(x + dx, y + dy)) continue;
      g.fillStyle = 'rgba(196,188,166,0.9)';
      for (let i = 0; i < 4; i++) { const a = hash(x, y, i + dx * 7 + dy * 13);
        const px = dx ? bx + (dx > 0 ? TILE - 6 : 2) : bx + 3 + i * 11 + a * 3, py = dy ? by + (dy > 0 ? TILE - 6 : 2) : by + 3 + i * 11 + a * 3;
        g.fillRect(px, py, dx ? 4 : 7, dy ? 4 : 7); }
    }
    for (let i = 0; i < 3; i++) { const a = hash(x, y, i + 41), b = hash(x, y, i + 53); g.strokeStyle = 'rgba(150,180,96,0.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx + 6 + a * 36, by + 40); g.lineTo(bx + 6 + a * 36 + (b - 0.5) * 4, by + 28 - b * 8); g.stroke(); }
  }
  RD.drawRoad = drawRoad; RD.drawVerge = drawVerge;
  HOOKS.draw.push((g, items) => {
    if (window.__instance || T_ROAD < 0) return;
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 1);
    // the surface is flat: one item, under everything that stands on it
    items.push({ y: -1e9 + 0.5, draw: () => {
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const t = map[idx(tx, ty)]; if (t === T_ROAD) drawRoad(g, tx, ty); else if (t === T_VERGE) drawVerge(g, tx, ty); }
    } });
  });

  // ============================================================================
  // THE HORSE ON THE ROAD: a ride along a main road's laid path on the mare, timed (spec §13 STAGE 6: within 10% of its
  // length over 7.3 tiles a second). The knight is put on her at the road's start and steered cell to cell along it with
  // the arrow keys, as a player rides; the story gates stand open for the ride (a gate is not the road's).
  // ============================================================================
  RD.ride = (id, F, opts) => {
    const R = RD.roads[id]; F = F || window.FANGLANDS; if (!R || !R.path.length || !F || !window.MOUNTS) return null;
    const o = opts || {}, P = R.path, from = o.from || 0, to = Math.min(P.length - 1, o.to === undefined ? P.length - 1 : o.to);
    // (a story gate on the road stands open for the ride, as it does once its story is done: its tiles are ground while she
    // rides, and put back after)
    const shut = new Set([...GATES].filter(t => SOLID.has(t) && !PUSH_THROUGH.has(t))), opened = [];
    for (const [x, y] of P) for (const [dx, dy] of [[0, 0], ...N8]) { const i = (y + dy) * MAP_W + x + dx; if (inMap(x + dx, y + dy) && shut.has(map[i])) { opened.push([i, map[i]]); map[i] = T.DIRT; } }
    const keep = { x: player.x, y: player.y, mech: player.mech, r: player.r, speed: player.speed, peace: window.__peace };
    let frames = 0, stuck = 0, q = from, best = Infinity, err = null, tiles = 0;
    for (let k = from + 1; k <= to; k++) tiles += stepLen(P[k - 1], P[k]);
    try {
      window.__peace = true; player.dead = false; player.hp = player.maxHp; player.mech = null;
      F.tp(P[from][0], P[from][1]); F.step([]);
      if (!MOUNTS.mount()) return { id, err: 'could not mount', tiles };
      const limit = Math.ceil(tiles / RIDE * 60 * 2) + 120;
      while (q < to && frames < limit) {
        // the next cell of the road, reached within 0.45 of a tile
        const t = P[Math.min(to, q + 1)], tx = tc(t[0]), ty = tc(t[1]), dx = tx - player.x, dy = ty - player.y, d = Math.hypot(dx, dy);
        if (d < TILE * 0.45) { q = Math.min(to, q + 1); best = Infinity; stuck = 0; continue; }
        const keys = []; if (dx > TILE * 0.2) keys.push('KeyD'); else if (dx < -TILE * 0.2) keys.push('KeyA'); if (dy > TILE * 0.2) keys.push('KeyS'); else if (dy < -TILE * 0.2) keys.push('KeyW');
        F.step(keys); frames++;
        if (d < best - 1) { best = d; stuck = 0; } else if (++stuck > 90) break;   // no nearer for a second and a half: stuck
      }
    } catch (e) { err = String(e && e.message); }
    finally {
      for (const [i, t] of opened) map[i] = t;
      if (player.mech && player.mech.kind === 'horse') { player.mech = keep.mech; player.r = keep.r; player.speed = keep.speed; }
      player.x = keep.x; player.y = keep.y; window.__peace = keep.peace;
    }
    const secs = frames / 60, want = tiles / RIDE;
    return { id, tiles: Math.round(tiles * 10) / 10, secs: Math.round(secs * 100) / 100, want: Math.round(want * 100) / 100, off: Math.round((secs / want - 1) * 1000) / 10, done: q >= to, at: q < to ? P[q] : null, err };
  };

  // ============================================================================
  // SELF-TEST (roads2's checks, pointed at the new network; and Stage 6's proofs)
  // ============================================================================
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'roads: ', S = RD.stats, SP = window.SPREAD_GROUND;
    const played = window.PLAYTHROUGH && PLAYTHROUGH.pristine ? null : null; void played;
    // 1. the network: a flood over the network's own tiles (the roads, the tracks, the crossings they adopt; never open
    //    ground) from the cave mouth reaches every place's port, but the ones listed with their reason
    { const seen = new Uint8Array(MAP_W * MAP_H), q = [], [mx, my] = A.port('cave.mouth').map(Math.round);
      let s0 = -1; for (let r = 0; r <= 4 && s0 < 0; r++) for (let dy = -r; dy <= r && s0 < 0; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(mx + dx, my + dy) && NET[(my + dy) * MAP_W + mx + dx]) { s0 = (my + dy) * MAP_W + mx + dx; break; }
      if (s0 >= 0) { seen[s0] = 1; q.push(s0); }
      for (let k = 0; k < q.length; k++) { const c = q[k], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const j = ny * MAP_W + nx; if (!seen[j] && NET[j]) { seen[j] = 1; q.push(j); } } }
      const near = p => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = Math.round(p[0]) + dx, y = Math.round(p[1]) + dy; if (inMap(x, y) && seen[y * MAP_W + x]) return true; } return false; };
      const missed = [], places = []; let ports = 0;
      for (const id of Object.keys(A.ANCHORS)) { if (OFF_ROAD[id]) continue; const ps = Object.keys(A.PORTS).filter(k => k.split('.')[0] === id); if (!ps.length) continue; places.push(id); ports += ps.length; if (!ps.some(k => near(A.port(k)))) missed.push(id); }
      let road = 0, track = 0, cross = 0, open = 0, net = 0; const OPENT = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, Tn('FERN')].filter(v => v >= 0));
      for (let i = 0; i < NET.length; i++) { if (!NET[i]) continue; net++; const t = map[i]; if (t === T_ROAD) road++; else if (t === T.DIRT) track++; else if (OPENT.has(t)) open++; else cross++; }
      check(P + `the network is one: a flood over its own tiles alone (the ROAD, the tracks' dirt and the crossings they adopt: bridges, gates, the places' streets; never open ground) from the cave mouth reaches every one of the ${places.length} places' ports, but the ${Object.keys(OFF_ROAD).length} listed with their reason (the islands and the east by boat, the reserved plots); open ground is under a twentieth of it (the worn steps to a door and a track's corners)`,
        missed.length === 0 && q.length === net && places.length >= 25 && open / net < 0.05 && road > 1000, { missed, places: places.length, flood: q.length, net, road, track, crossings: cross, open, components: S.components, offRoad: OFF_ROAD }); }
    // 2. it reads as a road: one surface three wide with a kerbed verge along it, on the line of the track Stage 4 laid
    { let edges = 0, kerbed = 0, roadN = 0; for (let i = 0; i < map.length; i++) { if (map[i] !== T_ROAD) continue; roadN++; const x = i % MAP_W, y = (i / MAP_W) | 0; for (const [dx, dy] of N4) { const t = map[(y + dy) * MAP_W + x + dx]; if (t === T_ROAD) continue; edges++; if (t === T_VERGE || t === TD_PROP() || (window.DECO && t === DECO.id) || t === T.SIGN) kerbed++; } }
      const off = []; for (const id of A.MAIN_ROADS) { const R = RD.roads[id], pl = A.track(id); let far = 0;
        for (const [x, y] of R.path) { if (PROTECT[y * MAP_W + x]) continue; let d = Infinity; for (let k = 1; k < pl.length; k++) d = Math.min(d, segD(x, y, pl[k - 1][0], pl[k - 1][1], pl[k][0], pl[k][1])); if (d > 3) far++; }
        if (far) off.push(id + ' ' + far); }
      const wide = A.MAIN_ROADS.every(id => { const R = RD.roads[id]; let three = 0, n = 0; for (const [x, y] of R.path) { if (PROTECT[y * MAP_W + x] || inAF(x, y)) continue; n++; const lr = map[y * MAP_W + x] === T_ROAD && ((isRoad(x - 1, y) && isRoad(x + 1, y)) || (isRoad(x, y - 1) && isRoad(x, y + 1))); if (lr) three++; } return n === 0 || three / n > 0.85; });
      check(P + `${roadN} tiles of road surface on the six main roads, three wide down the middle of the way, its edges kerbed by a verge (${Math.round(kerbed / Math.max(1, edges) * 100)}% of them: the rest a tree, a wall, the water or a place's ground), and every road on the line of the track Stage 4 laid (within 3 of it, outside the places)`,
        roadN > 1000 && kerbed / edges > 0.55 && wide && !off.length, { roadN, edges, kerbed, off, wide, verges: S.verges, felled: S.felled }); }
    // 3. what it may not touch: no road, verge or thing inside a place's ground, a reserved plot or a built place (a road
    //    meets them at their gates), nothing laid on anything but ordinary ground, the Ashfields' open ground kept
    { const bad = [];
      for (const l of RD.laid) {
        const i = l.y * MAP_W + l.x, res = A.reservedAt(l.x, l.y);
        if ((l.t === 'ROAD' || l.t === 'VERGE') && PROTECT[i]) bad.push('paved a place ' + l.x + ',' + l.y);
        if (l.why !== 'sign moved' && l.why !== 'fork sign' && res) bad.push(l.t + ' in ' + res + ' ' + l.x + ',' + l.y);
        if (!(l.was in T) || !(PAVE.has(T[l.was]) || FELL.has(T[l.was]) || VERGEABLE.has(T[l.was]) || OG.has(T[l.was]) || l.was === 'ROAD' || l.was === 'VERGE' || l.was === 'SIGN')) bad.push('laid on ' + l.was + ' ' + l.x + ',' + l.y);
      }
      const inBuild = RD.laid.filter(l => buildingAt(l.x, l.y)).length, onNpc = NPCS.filter(n => (map[idx(n.x, n.y)] === TD_PROP() && RD.things.has(idx(n.x, n.y)))).map(n => n.id);
      check(P + "nothing a place has is touched: no road, verge or thing in a place's own ground, a reserved plot or a built place (a road meets each at its gate), nothing laid on anything but ordinary ground, no building or person stood on; the Ashfields' open ground (11-main's grass, dirt and scorch between the ash) is not paved",
        !bad.length && !inBuild && !onNpc.length && RD.afAfter >= RD.afBefore, { bad: bad.slice(0, 8), more: Math.max(0, bad.length - 8), inBuild, onNpc, afBefore: RD.afBefore, afAfter: RD.afAfter, laid: RD.laid.length }); }
    // 4. a signpost within 2 tiles of every fork (a node where three or more roads' legs meet): its road's tiles there
    { const forks = RD.forkList || [], bad = forks.filter(f => f.sign > 2).map(f => f.at.join(',') + ' ' + f.roads.join('/') + ' ' + f.sign);
      check(P + `a signpost stands within 2 tiles of every one of the ${forks.length} forks (where three or more road legs meet), three of them new (the Glasshouse spur, the Old Barrow spur, Dunstan's turn) and one moved in (the Skypier lane's)`, forks.length >= 14 && !bad.length && !S.signsMissing.length, { bad, missing: S.signsMissing, added: S.signsAdded, moved: S.signsMoved }); }
    // 5. every arm of every road's signpost names the next stop on that road and the walk to it; the walk is the road's laid
    //    length over a knight's foot speed (3.65 tiles a second)
    { const bad = [], sample = {};
      for (const [x, y] of (SP ? SP.signs : [])) { const t = A.signText(x, y) || '', arms = t.split(/\s{3}/).filter(a => a.startsWith('→'));
        if (!arms.length || arms.some(a => !/, (\d+ seconds|\d+ (and a half )?minutes?) on foot[,.]/.test(a))) bad.push(x + ',' + y + ': ' + t); }
      const mill = SP && SP.signs.find(q => { const p = A.pointOf(A.SIGNPOSTS[0].at); return q[2] === p[0] && q[3] === p[1]; });
      if (mill) sample.mill = A.signText(mill[0], mill[1]);
      // the walk: the Cave Road's laid length from the cave to the Mill Lane fork, in seconds, as its arm says it
      const R = RD.roads.r1_cave, k = A.TRACKS.r1_cave.findIndex(q => q[0] === 'n' && q[1] === A.pointOf(A.SIGNPOSTS[0].at)[0]), secs = R && k > 0 ? R.cum[k] / WALK : null;
      check(P + `every arm of every road's signpost (${SP ? SP.signs.length : 0}) names the next stop on its road and the walk to it ("→ Millbrook, south-west, 20 seconds on foot."), from the road's laid length at 3.65 tiles a second`,
        !bad.length && !!mill && new RegExp('The cave, north-west, ' + A.walkWords(secs).replace(/ on foot$/, '') + ' on foot').test(sample.mill), { bad: bad.slice(0, 4), sample, caveSecs: secs && Math.round(secs * 10) / 10 }); }
    // 6. the markers: a milestone at each end of every main road (E names the road, the far end with its walk, and every
    //    stop on the way), lanterns along the main roads lit at night, cairns along the tracks and the Ash Road's ash
    { const stones = [...RD.things].filter(([, c]) => c.kind === 'milestone'), byRoad = {}; for (const [, c] of stones) byRoad[c.road] = (byRoad[c.road] || 0) + 1;
      let said = null; const R1 = stones.find(([, c]) => c.road === 'r1_cave' && !c.end);
      if (R1) { const [i] = R1, x = i % MAP_W, y = (i / MAP_W) | 0, spot = N4.map(([dx, dy]) => [x + dx, y + dy]).find(([sx, sy]) => !SOLID.has(tileAt(sx, sy)));
        h.peace(true); dialog.queue.length = 0; dialog.cur = null; F.tp(spot[0], spot[1]); F.face(x, y); F.press('KeyE'); F.sim(2, []);
        const d = [dialog.cur, ...dialog.queue].find(q => q && q.who === 'The milestone'); said = d ? d.text : null; dialog.queue.length = 0; dialog.cur = null; h.peace(false); }
      const lant = Object.values(RD.roads).reduce((n, r) => n + (r.marks || []).filter(m => m.kind === 'road_lantern').length, 0), cairn = Object.values(RD.roads).reduce((n, r) => n + (r.marks || []).filter(m => m.kind === 'road_cairn').length, 0);
      const day = player.dayTime, lights = (dt) => { player.dayTime = dt; const out = []; for (const f of HOOKS.nightLights || []) f(out, 0, 0, MAP_W - 1, MAP_H - 1); return out.filter(l => l.kind === 'road lantern').length; };
      const night = lights(7 * 60 + 60 + 60), noon = lights(100); player.dayTime = day;
      check(P + `a milestone stands at each end of every main road (${stones.length}), and E on the Cave Road's names the road, the walk to its far end and every stop on the way; ${lant} lantern posts along the main roads burn at night (none by day); ${cairn} cairns mark the tracks and the Ash Road across the ash`,
        A.MAIN_ROADS.every(id => byRoad[id] >= 1) && stones.length >= 11 && !!said && /^The Cave Road\. /.test(said) && /on foot/.test(said) && /The Overturned Cart/.test(said) && /Grizzlejaw/.test(said) && lant >= 25 && night === lant && noon === 0 && cairn >= 8,
        { byRoad, said, lant, night, noon, cairn, unplaced: S.unplaced }); }
    // 7. the places to stop for: every one placed beside its road, and walked to from the cave mouth (story gates open)
    { const pass = t => walkable(t), seen = new Uint8Array(MAP_W * MAP_H), q = []; const [mx, my] = A.port('cave.mouth').map(Math.round);
      const push = (x, y) => { if (!inMap(x, y)) return; const i = y * MAP_W + x; if (seen[i] || !pass(map[i])) return; seen[i] = 1; q.push(i); };
      push(mx, my); for (let k = 0; k < q.length; k++) { const c = q[k]; for (const [dx, dy] of N4) push(c % MAP_W + dx, ((c / MAP_W) | 0) + dy); }
      const bad = [];
      for (const p of RD.pois) {
        if (!p.at) { bad.push(p.id + ' unplaced'); continue; }
        const [x, y] = p.at, R = RD.roads[p.road]; let d = Infinity; for (const [px, py] of R.path) d = Math.min(d, Math.hypot(px - x, py - y));
        const reach = SOLID.has(map[idx(x, y)]) ? N4.some(([dx, dy]) => seen[(y + dy) * MAP_W + x + dx]) : !!seen[y * MAP_W + x];
        if (d > (p.kind === 'beast' ? 8.5 : 5)) bad.push(p.id + ' ' + d.toFixed(1) + ' off its road'); if (!reach) bad.push(p.id + ' not reached');
      }
      const per = {}; for (const p of RD.pois) per[p.road] = (per[p.road] || 0) + 1;
      check(P + `all ${RD.pois.length} places to stop for stand beside their roads (within 5 tiles of the road's line, a named beast within 8.5) and are walked to from the cave mouth (story gates open): roads2's 25, re-homed by road, and 10 new`,
        RD.pois.length === 35 && !bad.length, { bad, per }); }
    // 8. the wrecked carts give what they promise, go empty, and fill again
    { const p = RD.poi('cart_over'), q0 = st(), inv0 = JSON.stringify(player.inv);
      h.peace(true); player.inv = player.inv.map(() => null); delete q0.timer[p.id];
      const pl0 = countItem('plank'), c0 = coins();
      F.goAdjacent(p.at[0], p.at[1], 5000); F.face(p.at[0], p.at[1]); F.press('KeyE'); F.sim(2, []);
      const got = countItem('plank') - pl0, gotCoins = coins() - c0;
      notice = null; F.press('KeyE'); F.sim(2, []);
      const empty = countItem('plank') - pl0 === got && !!notice && /picked clean/i.test(notice.text) && timer(p.id) > 0;
      q0.timer[p.id] = 0.01; F.sim(3, []); F.press('KeyE'); F.sim(2, []);
      const again = countItem('plank') - pl0 > got;
      player.inv = JSON.parse(inv0); delete q0.timer[p.id]; dialog.queue.length = 0; dialog.cur = null; h.peace(false);
      check(P + `${p.name} gives 2-4 planks, 1-2 logs and 4-14 coins, is picked clean, and a new cart comes by after ${p.every / 60} minutes`, got >= 2 && got <= 4 && gotCoins >= 4 && gotCoins <= 14 && empty && again, { got, gotCoins, empty, again, at: p.at }); }
    // 9. the wayshrines: each its own named blessing, and the blessing does the thing; the cooldown said in plain words
    { const q0 = st(), fair = RD.poi('stone_trav'), names = ['stone_trav', 'stone_kneel', 'stone_wind', 'stone_bell', 'stone_wood', 'fisher'].map(id => RD.poi(id).blessName);
      q0.bless = null; delete q0.timer[fair.id];
      h.peace(true); F.goAdjacent(fair.at[0], fair.at[1], 6000); F.face(fair.at[0], fair.at[1]); F.press('KeyE'); F.sim(2, []);
      const on = !!blessed('fair') && q0.bless.name === 'Fair Road' && q0.bless.left > 170;
      const hp0 = player.hp = player.maxHp; hurtPlayer(6, player.x + 40, player.y, true); const softened = hp0 - player.hp === 4;
      q0.bless = { key: 'might', name: 'Ash Ward', left: 90, n: 3 }; const base = player.equip.weapon; player.equip.weapon = null;
      const withMight = playerMaxHit(); q0.bless = null; const without = playerMaxHit(); player.equip.weapon = base;
      q0.bless = { key: 'hands', name: 'Steady Hands', left: 180, n: 2 };
      const mx0 = player.skills.mining.xp; gainXp('mining', 10); const doubled = player.skills.mining.xp - mx0 === 20;
      const rx0 = player.skills.range.xp; gainXp('range', 10); const rangeSame = player.skills.range.xp - rx0 === 10;
      q0.bless = { key: 'lines', name: 'Tight Lines', left: 180, n: 2 }; const fx0 = player.skills.fishing.xp; gainXp('fishing', 10); const fishDoubled = player.skills.fishing.xp - fx0 === 20;
      player.skills.mining.xp = mx0; player.skills.range.xp = rx0; player.skills.fishing.xp = fx0;
      q0.bless = { key: 'mend', name: 'Deep Breath', left: 180, n: 1 }; q0.mendT = 0; player.hp = player.maxHp - 5;
      for (let i = 0; i < 200; i++) for (const u of HOOKS.update) u(1 / 60);
      const mended = player.hp > player.maxHp - 5;
      q0.bless = null; player.hp = player.maxHp; setTimer(fair.id, fair.every);
      notice = null; F.goAdjacent(fair.at[0], fair.at[1], 6000); F.face(fair.at[0], fair.at[1]); F.press('KeyE'); F.sim(2, []);
      const refused = !blessed('fair') && !!notice && /quiet/i.test(notice.text) && /minutes/.test(notice.text);
      delete q0.timer[fair.id]; q0.bless = null; dialog.queue.length = 0; dialog.cur = null; h.peace(false);
      check(P + 'six wayshrines, six named blessings: Fair Road softens a hit by 2, Ash Ward adds 3 to the best swing, Steady Hands doubles Mining and Woodcutting only, Tight Lines doubles Fishing, Deep Breath mends as you walk, Green Path calms the beasts; a shrine gives once every six minutes and says so in plain words',
        on && softened && withMight - without === 3 && doubled && rangeSame && fishDoubled && mended && refused && names.join('/') === 'Fair Road/Ash Ward/Steady Hands/Deep Breath/Green Path/Tight Lines',
        { on, softened, might: withMight - without, doubled, rangeSame, fishDoubled, mended, refused, names }); }
    // 10. the brambles, the bone pile, the well and the deep pool
    { const b = RD.poi('salt_bramble'), bn = RD.poi('bones'), w = RD.poi('well'), q0 = st(), inv0 = JSON.stringify(player.inv);
      for (const p of [b, bn, w]) delete q0.timer[p.id];
      h.peace(true); player.inv = player.inv.map(() => null);
      const h0 = countItem('haws'); F.goAdjacent(b.at[0], b.at[1], 6000); F.face(b.at[0], b.at[1]); F.press('KeyE'); F.sim(2, []);
      const picked = countItem('haws') - h0; notice = null; F.press('KeyE'); F.sim(2, []);
      const bare = countItem('haws') - h0 === picked && !!notice && /bare/i.test(notice.text);
      const bo0 = countItem('bone'); F.tp(bn.at[0], bn.at[1] + 1); F.goAdjacent(bn.at[0], bn.at[1], 3000); F.face(bn.at[0], bn.at[1]); F.press('KeyE'); F.sim(2, []); const bones = countItem('bone') - bo0;
      player.hp = 3; F.tp(w.at[0], w.at[1] + 1); F.goAdjacent(w.at[0], w.at[1], 3000); F.face(w.at[0], w.at[1]); F.press('KeyE'); F.sim(2, []); const drank = player.hp === player.maxHp;
      player.inv = player.inv.map(() => null); h.give('fishing_rod', 1);
      const pool = RD.poi('pool_pond'), t0 = countItem('raw_trout');
      F.tp(pool.at[0], pool.at[1] + 1); F.goAdjacent(pool.at[0], pool.at[1], 8000); F.face(pool.at[0], pool.at[1]); F.press('KeyE');
      const caught = F.untilAction(2500, () => countItem('raw_trout') > t0);
      player.action = null; player.inv = JSON.parse(inv0); for (const p of [b, bn, w]) delete q0.timer[p.id]; dialog.queue.length = 0; dialog.cur = null; h.peace(false);
      check(P + `${b.name} gives 2-4 hawthorn haws then goes bare; ${bn.name} gives 2-4 bones; ${w.name} makes you whole; ${pool.name} is fished with a rod for trout (and, 1 in ${pool.extraOdds}, a river pearl)`,
        picked >= 2 && picked <= 4 && bare && bones >= 2 && bones <= 4 && drank && typeof caught === 'number' && ITEMS.haws.heal === 3 && ITEMS.river_pearl.value === 75, { picked, bare, bones, drank, caught }); }
    // 11. the locked strongbox, and the key a road away
    { const box = RD.poi('toll'), cache = RD.poi('post'), q0 = st(), inv0 = JSON.stringify(player.inv), opened0 = Object.assign({}, q0.opened);
      q0.opened = {}; player.inv = player.inv.map(() => null); h.peace(true); dialog.queue.length = 0; dialog.cur = null;
      F.tp(box.at[0], box.at[1] + 1); F.goAdjacent(box.at[0], box.at[1], 4000); F.face(box.at[0], box.at[1]); F.press('KeyE'); F.sim(2, []);
      const locked = !q0.opened[box.id] && !!dialog.cur && /iron key/i.test(dialog.cur.text) && /Ash Road/.test(dialog.cur.text);
      dialog.queue.length = 0; dialog.cur = null;
      F.tp(cache.at[0], cache.at[1] + 1); F.goAdjacent(cache.at[0], cache.at[1], 3000); F.face(cache.at[0], cache.at[1]); F.press('KeyE'); F.sim(2, []);
      const gotKey = countItem('iron_key') === 1 && q0.opened[cache.id] === true;
      const c0 = coins(), sb0 = countItem('steel_bar');
      F.tp(box.at[0], box.at[1] + 1); F.goAdjacent(box.at[0], box.at[1], 3000); F.face(box.at[0], box.at[1]); F.press('KeyE'); F.sim(2, []);
      const opened = q0.opened[box.id] === true && coins() - c0 === 250 && countItem('steel_bar') - sb0 === 3 && countItem('iron_key') === 0;
      const farApart = Math.hypot(box.at[0] - cache.at[0], box.at[1] - cache.at[1]) > 60 && box.road !== cache.road;
      dialog.queue.length = 0; dialog.cur = null; player.inv = JSON.parse(inv0); q0.opened = opened0; h.peace(false);
      check(P + `${box.name} on the Sea Road is locked until you find the ${ITEMS.iron_key.name} at ${cache.name} on the Ash Road, then gives 250 coins and 3 steel bars, once`, locked && gotKey && opened && farApart, { locked, gotKey, opened, farApart, box: box.at, cache: cache.at }); }
    // 12. the three roadside traders each do exactly their one thing
    { const inv0 = JSON.stringify(player.inv); h.peace(true); const rows = [];
      for (const k of ['ivo', 'kett', 'cinder_meg']) {
        const tr = TRADES[k], npc = NPCS.find(n => n.id === k), [gid, gn] = tr.give, [tid, tn] = tr.take;
        if (!npc) { rows.push({ who: k, ok: false, why: 'not standing' }); continue; }
        player.inv = player.inv.map(() => null); dialog.queue.length = 0; dialog.cur = null;
        { const sp = N8.map(([dx, dy]) => [npc.x + dx * 2, npc.y + dy * 2]).find(([x, y]) => inMap(x, y) && !SOLID.has(tileAt(x, y))); if (sp) F.tp(sp[0], sp[1]); }   // (Cinder Meg is past the Warden's gate)
        F.talk(k); const refused = !!dialog.cur && new RegExp('You have 0 of ' + gn).test(dialog.cur.text);
        dialog.queue.length = 0; dialog.cur = null; h.give(gid, gn);
        const before = tid === 'coins' ? coins() : countItem(tid); F.talk(k); F.sim(2, []); const after = tid === 'coins' ? coins() : countItem(tid);
        rows.push({ who: npc.name, refused, got: after - before, want: tn, ok: refused && after - before === tn && countItem(gid) === 0 });
      }
      player.inv = JSON.parse(inv0); dialog.queue.length = 0; dialog.cur = null; h.peace(false);
      check(P + 'Ivo swaps 6 coal for an iron bar, Rusty Kett pays 120 coins for a river pearl, Cinder Meg turns 4 logs into 3 coal, and each says what they want when you have not got it', rows.every(r => r.ok), { rows }); }
    // 13. six named beasts by the roads: none charges, each keeps to its patch, respawns, and drops its own trophy; one,
    //     killed, pays
    { const rows = RD.pois.filter(p => p.kind === 'beast').map(p => { const def = MONSTER_DEFS[p.type], trophy = def.drops.rare.table[0][0];
        return { name: def.name, live: monsters.some(m => m.type === p.type), spawn: MONSTER_SPAWNS.some(s => s.type === p.type && s.by === '93-roads'), ok: !def.aggro && def.roam === 2 && def.respawn <= 110 && ITEMS[trophy].value >= 90 }; });
      const m = monsters.find(x => x.type === 'grizzlejaw'); let paid = false, respawns = false;
      if (m) { h.peace(true); const k0 = player.kills; m.dead = false; m.hp = 1; m.x = player.x + 40; m.y = player.y; m.state = 'idle'; killMonster(m);
        for (let i = 0; i < 90; i++) for (const u of HOOKS.update) u(1 / 60);
        paid = player.kills === k0 + 1 && drops.some(d => d.id === 'raw_beef'); respawns = m.respawnT >= MONSTER_DEFS.grizzlejaw.respawn;
        drops = drops.filter(d => !['raw_beef', 'boar_tusk', 'coins', 'grizzle_tusk'].includes(d.id)); m.dead = false; m.hp = m.maxHp; m.respawnT = 0; m.x = m.home.x; m.y = m.home.y; h.peace(false); }
      check(P + `six named beasts stand off the roads (${rows.map(r => r.name).join(', ')}): none charges a knight, each keeps to its own patch (roam 2), comes back within 110 seconds and drops its own trophy; Grizzlejaw, killed, drops raw beef and comes back`,
        rows.length === 6 && rows.every(r => r.ok && r.live && r.spawn) && paid && respawns, { rows, paid, respawns }); }
    // 14. the picture: the road, the verge, every thing and marker and the blessing's plaque draw without error through the
    //     hooks the renderer calls; every solid thing is tappable and every kind named
    { let ok = true, err = null, items = 0; const cx = cam.x, cy = cam.y, px = player.x, py = player.y, b0 = st().bless;
      try {
        for (const [i, c] of RD.things) KINDS[c.kind].draw(ctx, (i % MAP_W) * TILE, ((i / MAP_W) | 0) * TILE, c, i % MAP_W, (i / MAP_W) | 0);
        for (const kind of ['road_lantern', 'road_cairn']) { const [x, y] = DECO.cells(kind)[0]; DECO.KINDS[kind].draw(ctx, x * TILE, y * TILE, DECO.at(x, y), x, y, 0); }
        const r = RD.roads.r1_cave.path[20]; drawRoad(ctx, r[0], r[1]); drawVerge(ctx, r[0], r[1] - 2);
        for (const p of RD.pois.slice(0, 6)) { cam.x = p.at[0] * TILE - VW / 2; cam.y = p.at[1] * TILE - VH / 2; const list = []; for (const f of HOOKS.draw) f(ctx, list, cam); items += list.length; for (const it of list) it.draw(); }
        st().bless = { key: 'fair', name: 'Fair Road', left: 100, n: 2 }; for (const f of HOOKS.hud) f(ctx, false);
      } catch (e) { ok = false; err = String(e && e.stack || e); }
      st().bless = b0; cam.x = cx; cam.y = cy; player.x = px; player.y = py;
      const tappable = INTERESTING_TILES.has(TD_PROP()) && !!TAP_NAMES.ROAD && !!TAP_NAMES.VERGE && !SOLID.has(T_ROAD) && !SOLID.has(T_VERGE);
      check(P + 'the road, the verge, every thing beside it, the lanterns, the cairns and the blessing draw without error through the hooks the renderer calls; every solid thing is tappable, and the road and its verge are walked, not climbed', ok && items > 6 && tappable, { ok, items, err, tappable }); }
    // 15. nothing is built on the road; a knight builds beside it
    { h.give('goblin_trap', 2); h.peace(true); const R = RD.roads.r3_long, at = R.path.find(([x, y]) => map[y * MAP_W + x] === T_ROAD && !A.onMainRoad(x, y)) || R.path.find(([x, y]) => map[y * MAP_W + x] === T_ROAD);
      const [x, y] = at; F.tp(x, y + 1); player.facing = { x: 0, y: -1 }; notice = null; const n0 = countItem('goblin_trap'); placeAction('goblin_trap');
      const refused = countItem('goblin_trap') === n0 && !!notice && /road|staked/i.test(notice.text); h.peace(false);
      check(P + 'nothing is set down on the road: placing on it is refused in plain words', refused, { at, notice: notice && notice.text }); }
    // 16. the A* time budget: the whole roads pass is cheap (spec §7's boot budget holds the world; this pass is a small
    //     part of it), each search bounded to its leg's box plus 24
    check(P + `the roads pass takes ${S.passMs} ms in all (its ${S.legs} A* searches ${S.aStarMs} ms, ${S.pops} cells settled): under 250 ms, the searches under 120 ms`, S.passMs < 250 && S.aStarMs < 120 && !S.failed.length, { passMs: S.passMs, aStarMs: S.aStarMs, pops: S.pops, legs: S.legs, failed: S.failed });
    // 17. the horse on the road: a ride down the Sea Road on the mare takes its length over 7.3 tiles a second, within 10%
    { const r = RD.ride('r2_sea', F);
      check(P + `the mare on the road: a ride down the Sea Road (${r && r.tiles} tiles) takes ${r && r.secs} s, its length over 7.3 tiles a second (${r && r.want} s) within 10%`, !!r && r.done && !r.err && Math.abs(r.off) <= 10, r); }
  });
}
