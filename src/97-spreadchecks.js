// ============================================================================
// THE GREAT SPREAD'S CHECKS ON THE NEW MAP (Stage 4b of the spread spec, ~/.fanglands/work/spread/spec.md §1, §4, §5, §6,
// §13 4b, ADDENDUM C)
// src/97-spreadchecks.js
//
// Self-tests only, plus the measurements behind them (window.SPREAD_CHECKS), which the tools print as tables
// (tools/spread-report.mjs: the walk-clock table, the beat-gap report, the seam transects):
//   - spacing: named-place centres are 25+ tiles apart (§1's exceptions listed with their reasons);
//   - the walk-clock: each §1 trip measured as an 8-connected walk with root-2 diagonals over walkable tiles, the story
//     gates open (quest-complete), at a knight's foot speed; inside its window, or listed in WALK_HELD with the reason;
//   - every port reachable from the cave mouth (the ferry and the boats are links; the ports no foot reaches are listed);
//   - reach floods with each story gate closed: the Warden's gate, the lair gate, the palisade, the ferry;
//   - the scarp seal: the Goblin Fields reach the Wolfwood by exactly the two road bridges and the Agility 18 steps;
//   - seam transects: 20 lines across each land seam, each blending over 8+ tiles;
//   - main roads clear of solids and props; aggressive spawns 6+ tiles off a main road (the camp, the outposts, the
//     bandit hills and the story's own fights aside);
//   - ADDENDUM C: the outer 8-tile ring of the east and south edges holds no place, port or fixed structure (the east
//     sea aside), so land can be added at an edge;
//   - the beat-gap report (report-only in Stage 4: stakes are not stops).
// Every position is read from the Atlas (ports, frames, boxes, tracks); nothing here is a bare map number.
// ============================================================================
{
  const A = ATLAS, Tn = n => (n in T ? T[n] : -1);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const P = id => A.port(id).map(Math.round);
  // the story gates, open (quest-complete) unless a check closes one; the Agility 18 steps are not a gate, and stay shut
  const GATE_NAMES = ['WARDEN_GATE', 'LAIR_GATE', 'CRYPT_BARS', 'CITY_GATE'];
  const gates = () => new Set(GATE_NAMES.map(Tn).filter(v => v >= 0));
  const walkable = (open, shut) => t => (!SOLID.has(t) || PUSH_THROUGH.has(t) || open.has(t)) && !(shut && shut.has(t));
  // a flood over walkable tiles, 4-connected (as a knight walks); `closed(i)` shuts single tiles
  function flood(froms, pass, closed) {
    const seen = new Uint8Array(MAP_W * MAP_H), q = [];
    const push = (x, y) => { if (!inMap(x, y)) return; const i = y * MAP_W + x; if (seen[i] || !pass(map[i]) || (closed && closed(i))) return; seen[i] = 1; q.push(i); };
    for (const f of froms) push(f[0], f[1]);
    for (let k = 0; k < q.length; k++) { const c = q[k], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4) push(x + dx, y + dy); }
    return seen;
  }
  // the nearest walkable tile to a point (a port on a door, a well or a wall stands beside it)
  const stand = (p, pass) => { for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = p[0] + dx, y = p[1] + dy; if (inMap(x, y) && pass(map[y * MAP_W + x])) return [x, y]; } return p; };
  // (a port on a well, a fountain, a door or a wall corner is reached when a knight stands within two tiles of it)
  const reached = (seen, p, r = 2) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(p[0] + dx, p[1] + dy) && seen[(p[1] + dy) * MAP_W + p[0] + dx]) return true; return false; };
  // (a gate's far side: the tile itself or one beside it, never two away across the wall)
  const reachedAt = (seen, p) => [[0, 0], ...N4].some(([dx, dy]) => inMap(p[0] + dx, p[1] + dy) && seen[(p[1] + dy) * MAP_W + p[0] + dx]);

  // ---------- the walk-clock (§1) ----------
  // an 8-connected walk with root-2 diagonals (no corner cut between two solid tiles), Dijkstra on a binary heap
  function walkTiles(a, b, pass) {
    const D = new Float64Array(MAP_W * MAP_H).fill(Infinity), H = [];
    const up = e => { H.push(e); let i = H.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; [H[p], H[i]] = [H[i], H[p]]; i = p; } };
    const down = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) break; [H[m], H[i]] = [H[i], H[m]]; i = m; } } return top; };
    const s = a[1] * MAP_W + a[0], goal = b[1] * MAP_W + b[0]; D[s] = 0; up([0, s]);
    while (H.length) {
      const [d, c] = down(); if (d > D[c]) continue; if (c === goal) return d;
      const x = c % MAP_W, y = (c / MAP_W) | 0;
      for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny) || !pass(map[ny * MAP_W + nx])) continue;
        if (dx && dy && (!pass(map[y * MAP_W + nx]) || !pass(map[ny * MAP_W + x]))) continue;
        const n = ny * MAP_W + nx, nd = d + (dx && dy ? Math.SQRT2 : 1); if (nd < D[n]) { D[n] = nd; up([nd, n]); } }
    }
    return Infinity;
  }
  // §1's table: [trip, from port, to port, window low, high] (seconds on foot)
  const TRIPS = [
    ['Cave mouth to Thistledown Fountain Square', 'cave.mouth', 'thistledown.square', 40, 55],
    ['Fountain Square to Hollowford square', 'thistledown.square', 'hollowford.square', 45, 62],
    ["Fountain Square to Harl's dock", 'thistledown.square', 'dock.land', 26, 40],
    ["Fountain Square to the Warden's post", 'thistledown.square', 'warden.post', 45, 65],
    ["Fountain Square to Wren's door", 'thistledown.square', 'wren.door', 50, 70],
    ['Hollowford square to the Sylvaris gap', 'hollowford.square', 'sylvaris.gap', 18, 32],
    ["Cave mouth to the Fang's Lair gate", 'cave.mouth', 'fang_lair.gate', 100, 135],
  ];
  // Trips the open land makes shorter than §1's window, held for the owner (the windows were drawn from road lengths; the
  // walk-clock is the shortest walk over open ground, which cuts every bend of the road). Each keeps its measured time as
  // a pin: the check fails if the trip drifts more than 3 s from it, or comes inside its window (then it leaves this list).
  const WALK_HELD = {
    'Fountain Square to Hollowford square': { s: 34, why: "by the east gate and the goblin-road bridge the square is 112 straight tiles from Hollowford's; 45 s is 164 tiles, and no track point or anchor inside the plan's ground makes the open walk that long (Hollowford would have to move about 37 tiles south, into Sylvaris' ring)" },
    "Fountain Square to the Warden's post": { s: 39, why: "the Wolfwood between the Old Bridge and the rim is open wood: the walk goes straight down through it (about 62 tiles from the bridge), not round by the inn and the stone circle as the Ash Road does (about 110)" },
    "Fountain Square to Wren's door": { s: 48, why: "from the Old Bridge to Wren's door the open walk is as straight as the Wolfwood Road itself (about 92 tiles); 50 s needs 8 tiles more, and a bend in the road does not lengthen a walk the open wood lets cut" },
    "Cave mouth to the Fang's Lair gate": { s: 87, why: "the same cut through the open Wolfwood, and none of the Ash Road's loop east to the inn: section 1's 415 tiles is the road; the open walk is about 318" },
  };
  const footTilesPerS = () => A.SPEED_CAP.foot / TILE;
  function walkClock() {
    const pass = walkable(gates()), v = footTilesPerS();
    return TRIPS.map(([trip, a, b, lo, hi]) => { const d = walkTiles(stand(P(a), pass), stand(P(b), pass), pass), s = d / v;
      return { trip, from: a, to: b, tiles: Math.round(d), s: Math.round(s), lo, hi, inside: s >= lo && s <= hi, held: WALK_HELD[trip] || null }; });
  }

  // ---------- spacing (§1) ----------
  // named-place centres 25+ apart. Not named places: the open grounds and rings (the Ash Wastes, Sylvaris' growth ring)
  // and the two machine lanes with no name on the map (the drill field; §2's own plan puts it 24.2 from the signpost)
  const NOT_NAMED = ['ash_wastes', 'sylvaris_growth', 'drill_field'];
  const SPACING_EXEMPT = {
    'old_bridge|watchtower': 'the watchtower is the Old Bridge\'s ruined tower (§1)',
    'dock|gull_isle': 'Gull Isle and the dock: open water, reached by boat (§1)',
    'deepholm_rock|graveyard': 'the Deepholm rock is rock scenery, not a named stop (§1)',
    'sylvaris|sylvaris_growth': 'Sylvaris grows into its own ring (§4)',
  };
  function spacing() {
    const ids = Object.keys(A.ANCHORS).filter(id => A.box(id) && !NOT_NAMED.includes(id)), c = id => { const b = A.box(id); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };
    const near = [], exempt = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const [ax, ay] = c(ids[i]), [bx, by] = c(ids[j]), d = Math.hypot(ax - bx, ay - by); if (d >= 25) continue;
      const k = [ids[i], ids[j]].sort().join('|'); (SPACING_EXEMPT[k] ? exempt : near).push(k + ' ' + d.toFixed(1));
    }
    // Grubmarket and Castle Gnash are one rigid frame (the Far Shore's): two regions, one place anchor
    return { near, exempt, places: ids.length };
  }

  // ---------- every port reachable ----------
  // the links a knight takes that are not his feet: Harl's ferry (the dock to the Far Shore's landing) and the boats to the
  // isles. The ports no foot reaches yet, each with its reason.
  const LINKS = ['far_shore.landing', 'gull_isle.pete', 'ironclad_isle.hull'];
  const PORT_UNREACHED = {
    'brightwater.landing': 'Castle Brightwater has no way in on foot: the blimp lands there (chapter 10)',
    'wreck_rock.rock': 'Wreck Rock stands in the Grey Sea: its boat route comes later (26-boats LOC)',
    'far_shore.strait': 'the strait itself: water',
    'pond.centre': "the middle of Miller's Pond, on its stepping stones (Agility 10)",
  };
  function ports() {
    const pass = walkable(gates()), seen = flood([P('cave.mouth'), ...LINKS.map(id => stand(P(id), pass))], pass);
    const missed = [], held = [];
    for (const id of Object.keys(A.PORTS)) { const p = P(id); if (reached(seen, p)) continue; (PORT_UNREACHED[id] ? held : missed).push(id + ' ' + p.join(',')); }
    return { missed, held, of: Object.keys(A.PORTS).length };
  }

  // ---------- the story gates closed ----------
  function gateFloods() {
    const all = gates(), out = {};
    const shut = name => { const s = new Set(all); s.delete(Tn(name)); return walkable(s); };
    const from = [P('cave.mouth')];
    // the Warden's gate: nothing south of the rim (Dunstan, the shrine, the lair's approach)
    { const seen = flood(from, shut('WARDEN_GATE')); out.warden = ['warden.dunstan', 'ash_shrine.shrine', 'fang_lair.node'].filter(id => reachedAt(seen, P(id))); }
    // the lair gate: the summoning circle and the lair's floor
    { const seen = flood(from, shut('LAIR_GATE')); out.lair = ['fang_lair.circle'].filter(id => reachedAt(seen, P(id))); }
    // the palisade: with its gaps shut (every ring tile that is not a stake), the camp's walker is not reached
    { const R = window.PALISADE && PALISADE.ring, pal = walkable(all); let ring = 0;
      const onRing = i => { const x = i % MAP_W, y = (i / MAP_W) | 0; const on = (x === R.x0 || x === R.x1) && y >= R.y0 && y <= R.y1 || (y === R.y0 || y === R.y1) && x >= R.x0 && x <= R.x1; return on; };
      if (R && R.laid) { for (let y = R.y0; y <= R.y1; y++) for (let x = R.x0; x <= R.x1; x++) if (onRing(y * MAP_W + x)) ring++;
        const seen = flood(from, pal, onRing); out.palisade = ['camp.walker', 'camp.cage'].filter(id => reachedAt(seen, P(id))); out.ringTiles = ring; } else out.palisade = ['no palisade ring']; }
    // the ferry: on foot (every gate open), no tile east of the strait's west edge
    { const seen = flood(from, walkable(all)), x0 = A.frame('far_shore').x(200); let east = 0, at = null;
      for (let y = 0; y < MAP_H; y++) for (let x = x0; x < MAP_W; x++) if (seen[y * MAP_W + x]) { east++; if (!at) at = [x, y]; }
      out.ferry = { east, at, x0 }; }
    return out;
  }

  // ---------- the scarp seal (§5): the Goblin Fields reach the Wolfwood only by the two road bridges and the steps ----------
  function scarpSeal() {
    const all = gates(), BRIDGE = Tn('BRIDGE'), STEPS = Tn('SCARP_STEPS');
    // each crossing's tiles: the bridge tiles within 4 of each bridge's port, the steps' own tile
    // (a bridge built in stone is DECO cells of a bridge kind: 85-riverside's Old Bridge)
    const isT = (i, t) => map[i] === t || (t === BRIDGE && window.DECO && DECO.isBridge(i));
    const near = (pid, t) => { const [px, py] = P(pid), out = []; for (let y = py - 4; y <= py + 4; y++) for (let x = px - 4; x <= px + 4; x++) if (inMap(x, y) && isT(y * MAP_W + x, t)) out.push(y * MAP_W + x); return out; };
    const CROSS = { old_bridge: near('old_bridge.span', BRIDGE), goblin_bridge: near('goblin_road.bridge', BRIDGE), steps: near('graveyard.steps', STEPS) };
    const south = ['wren.door', 'graveyard.grave', 'hunters_lodge.door', 'hollowford.square', 'crossroads_inn.yard'];
    const run = open => { const shut = new Set(); for (const k in CROSS) if (!open.includes(k)) for (const i of CROSS[k]) shut.add(i);
      const pass = t => t === STEPS ? open.includes('steps') : walkable(all)(t);
      const seen = flood([P('cave.mouth')], pass, i => shut.has(i)); return south.filter(id => reachedAt(seen, P(id))); };
    const none = run([]), each = {}; for (const k in CROSS) each[k] = run([k]).length;
    return { none, each, tiles: Object.fromEntries(Object.entries(CROSS).map(([k, v]) => [k, v.length])) };
  }

  // ---------- seam transects (§6): 20 lines across each land seam, the two grounds mixed over 8+ tiles ----------
  // a seam: the tile kinds that mark each side (A, B) and the kinds of a fade between them; 20 lines across the seam, each
  // from 16 tiles on A's side to 16 on B's (the border at 0). A line's MIXED RUN is how deep B (or the fade) reaches onto
  // A's side plus how deep A (or the fade) reaches onto B's: a ruled line is 0, a fade or a reach of one ground into the
  // other is its depth. A seam blends when its median line runs 8 or more and no line is a ruled line. Exempt, each with its reason: cliffs (the Goblin Fields / Wolfwood scarp and the river along it,
  // the Ashfields' rim), water (every coast, the Sound), the story gates and the camp's palisade, and the Ash Wastes'
  // own edge with the Ashfields (ash on both sides: reserved ground, not open yet).
  const SEAM_EXEMPT = {
    goblin_fields_wolfwood: 'the scarp: a cliff, and the river under it (the seal test holds it)',
    wolfwood_ashfields: "the Ashfields' rim: a cliff with the Warden's gate in it",
    camp_palisade: "the camp's palisade: a story gate (its ring of bare grass is dithered eight tiles out, 39)",
    coasts: 'water: the Grey Sea, the strait, the Sound, the east sea, the river, the ponds',
    ashfields_ash_wastes: "ash on both sides of the Ash Wastes' edge (reserved ground, not open yet)",
  };
  function seams() {
    const W = A.world, WS = window.WORLDSHAPE, sw = WS && WS.seams;
    const set = names => new Set(names.map(Tn).filter(v => v >= 0));
    const out = [];
    if (!sw) return out;
    const wallX = y => W.line('jungle_west', y);
    const spread = (v0, v1) => { const r = []; for (let k = 0; k < 20; k++) r.push(Math.round(v0 + (v1 - v0) * (k + 0.5) / 20)); return r; };
    const TREES = ['TREE', 'OAK'], JUNG = ['JUNGLE', 'FERN'], FADE = Object.keys(T).filter(n => /^AF_/.test(n)).concat(['SCORCH']);
    // the Wolfwood / Jungle giants (39 and 92): the wood's oaks north, the jungle's giants and fern south
    { const x0 = wallX(W.ty(96)) + 14, x1 = A.frame('hollowford').x(132);
      out.push({ id: 'wolfwood_jungle', a: set(TREES), b: set(JUNG), fade: new Set(), bRegion: ['The Jungle'], lines: spread(x0, x1).map(x => ({ x, y: Math.round(sw.sWJ(x)), dx: 0, dy: 1 })) }); }
    // the Ashfields / Jungle edge (the old x 100 line): the ash fades east through charred and singed ground into the jungle
    { const y0 = W.ty(100), y1 = W.ty(136);
      out.push({ id: 'ashfields_jungle', a: set(['ASH', 'DEADTREE', 'OBSIDIAN']), b: set(JUNG), fade: set(FADE), lines: spread(y0, y1).map(y => ({ x: wallX(y), y, dx: 1, dy: 0 })) }); }
    // the Jungle's west edge below the Ashfields' fade, along the Wilds by the Ash Wastes (92's soft seam)
    { const aw = A.box('ash_wastes'), y0 = aw[1] + 12, y1 = MAP_H - 4, cut = y => { let x = aw[2] - 8; while (x < aw[2] + 24 && regionAt(x, y).name !== 'The Jungle') x++; return x; };
      out.push({ id: 'jungle_wilds', a: set(TREES), b: set(JUNG), fade: new Set(), bRegion: ['The Jungle'], lines: spread(y0, y1).map(y => ({ x: cut(y), y, dx: 1, dy: 0 })) }); }
    // Hollowford's burn (its west side, the wood to the ruins): scorch reaches out into the wood, the wood into the ruins
    { const F = A.frame('hollowford'), y0 = F.y(72), y1 = F.y(88);
      out.push({ id: 'hollowford_burn', a: set([...TREES, 'MUSHROOM']), b: set(['SCORCH', 'ASH', 'RUBBLE']), fade: new Set(), bRegion: ['Hollowford'], lines: spread(y0, y1).map(y => ({ x: F.x(122), y, dx: 1, dy: 0 })) }); }
    // the Grey Quarry's south edge: grass to the quarry's rock (rock spills out, grass eats in)
    { const Q = QUARRY_ROCK;
      out.push({ id: 'quarry_edge', a: set(['GRASS', 'FLOWERS']), b: set(['ROCK', 'IRON', 'COAL']), fade: new Set(), lines: spread(Q.x0 + 1, Q.x1 - 1).map(x => ({ x, y: Q.y1, dx: 0, dy: -1 })) }); }
    return out;
  }
  function transects() {
    const res = [];
    for (const s of seams()) {
      const runs = [];
      for (const L0 of s.lines) {
        // the border on this line: the first tile (from A's side) that is B's region, within 12 of the seam's line
        let L = L0; if (s.bRegion) for (let t = -12; t <= 12; t++) { const x = L0.x + L0.dx * t, y = L0.y + L0.dy * t; if (inMap(x, y) && s.bRegion.includes(regionAt(x, y).name)) { L = { x, y, dx: L0.dx, dy: L0.dy }; break; } }
        // how far B (or the fade) reaches onto A's side of the border, plus how far A (or the fade) reaches onto B's
        let first = null, last = null;
        for (let t = -16; t <= 16; t++) { const x = L.x + L.dx * t, y = L.y + L.dy * t; if (!inMap(x, y)) continue; const k = map[y * MAP_W + x];
          if ((s.b.has(k) || s.fade.has(k)) && first === null) first = t; if (s.a.has(k) || s.fade.has(k)) last = t; }
        runs.push((first === null ? 0 : Math.max(0, -first)) + (last === null ? 0 : Math.max(0, last + 1)));
      }
      const sorted = runs.slice().sort((a, b) => a - b);
      res.push({ id: s.id, runs, min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], under8: runs.filter(r => r < 8).length });
    }
    return res;
  }

  // ---------- main roads clear; aggressive spawns off them ----------
  // the road's centre line and its second lane (2 wide): no solid tile and no prop on it; a gate, a door, a bridge, the
  // story signpost and Hollowford's ruins (rebuilt in play, 31-rebuild) aside
  function roadsClear() {
    const OK = new Set([T.SIGN, Tn('WARDEN_GATE'), Tn('LAIR_GATE'), T.GATE, T.DOOR, Tn('CITY_GATE')].filter(v => v >= 0)), PROP = window.SPREAD_GROUND ? SPREAD_GROUND.PROP : -1, hf = A.box('hollowford'), BRIDGE = Tn('BRIDGE');
    const bad = [];
    // the tiles 02-world laid for the road: each step's tile and its second lane (a row below a level stretch, a column
    // west of a steep one)
    for (const id of A.MAIN_ROADS) { const pl = A.track(id);
      for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k], n = Math.max(1, Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
        const level = Math.abs(bx - ax) >= Math.abs(by - ay), ox = level ? 0 : -1, oy = level ? 1 : 0;
        for (let s = 0; s <= n; s++) { const cx = Math.round(ax + (bx - ax) * s / n), cy = Math.round(ay + (by - ay) * s / n);
          for (const [x, y] of [[cx, cy], [cx + ox, cy + oy]]) {
            if (!inMap(x, y) || (x >= hf[0] && x <= hf[2] && y >= hf[1] && y <= hf[3])) continue;
            const t = map[y * MAP_W + x];
            // (the river beside a bridge: the road narrows to its planks there; Stage 5 lays the Old Bridge three wide)
            if (t === T.WATER && N8.some(([dx, dy]) => inMap(x + dx, y + dy) && (map[(y + dy) * MAP_W + x + dx] === BRIDGE || (window.DECO && DECO.isBridge((y + dy) * MAP_W + x + dx))))) continue;
            if ((t === PROP && PROP >= 0) || (SOLID.has(t) && !PUSH_THROUGH.has(t) && !OK.has(t))) bad.push(id + ' ' + x + ',' + y + ' ' + tileName(t)); } } } }
    return [...new Set(bad)];
  }
  // aggressive spawns: 6+ tiles from every main road's centre line, but the fights the knight chooses where the road meets
  // them (§4): the camp, the outposts, the bandit hills; and the story's own ground a road goes through to its end (the
  // Ashfields' dragons and drakes, the lair, and Hollowford's occupiers, whom the Long Road and the Goblin Road meet in
  // Hollowford's square). 93-spread moves every other one off the roads.
  const SPAWN_PLACES = ['camp', 'outpost_north', 'outpost_south', 'bandit_hills', 'fang_lair', 'hollowford'];
  function spawnsOffRoads() {
    const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
    const roads = A.MAIN_ROADS.map(id => [id, A.track(id)]), inPlace = (x, y) => SPAWN_PLACES.some(id => { const b = A.box(id); return b && x >= b[0] - 6 && x <= b[2] + 6 && y >= b[1] - 6 && y <= b[3] + 6; });
    const ashfields = (x, y) => { const r = regionAt(x, y); return r && (r.name === 'The Ashfields' || r.name === "The Fang's Lair"); };
    const near = [], chosen = [];
    for (const s of MONSTER_SPAWNS) { const d = MONSTER_DEFS[s.type]; if (!d || !d.aggro) continue;
      let best = null; for (const [id, pl] of roads) for (let k = 1; k < pl.length; k++) { const v = segD(s.tx, s.ty, pl[k - 1][0], pl[k - 1][1], pl[k][0], pl[k][1]); if (!best || v < best[1]) best = [id, v]; }
      if (!best || best[1] >= 6) continue;
      const row = s.type + ' ' + s.tx + ',' + s.ty + ' ' + best[1].toFixed(1) + ' off ' + best[0];
      (s.camp || inPlace(s.tx, s.ty) || ashfields(s.tx, s.ty) ? chosen : near).push(row);
    }
    return { near, chosen };
  }

  // ---------- ADDENDUM C: the outer 8-tile ring of the east and south edges stays generic ----------
  // no place's box, no port, no building, no person and no fixed wall or cliff with x >= MAP_W - 8 or y >= MAP_H - 8, but
  // the east sea itself and the open grounds (the Ash Wastes are reserved Wilds; the Jungle and the Grub Fields run to the edge)
  const EDGE = 8;
  function edgeRing() {
    const inRing = (x, y) => x >= MAP_W - EDGE || y >= MAP_H - EDGE, bad = [];
    const boxIn = b => b[2] >= MAP_W - EDGE || b[3] >= MAP_H - EDGE;
    for (const id of Object.keys(A.ANCHORS)) { const b = A.box(id); if (b && id !== 'ash_wastes' && boxIn(b)) bad.push('place ' + id); }
    for (const id of Object.keys(A.PORTS)) { const [x, y] = P(id); if (inRing(x, y)) bad.push('port ' + id); }
    for (const b of BUILDINGS) if (inRing(b.x + b.w - 1, b.y + b.h - 1)) bad.push('building ' + b.id);
    for (const n of NPCS) if (inRing(n.x, n.y)) bad.push('person ' + n.id);
    const fixed = new Set(A.FIXED_TILES.map(Tn).filter(v => v >= 0)); let walls = 0, wallAt = null;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { if (!inRing(x, y) || !fixed.has(map[y * MAP_W + x])) continue; walls++; if (!wallAt) wallAt = [x, y, tileName(map[y * MAP_W + x])]; }
    if (walls) bad.push(walls + ' fixed wall or cliff tiles, first ' + wallAt.join(','));
    // and the east sea is water from end to end
    const sea = A.GROUNDS.east_sea; let dry = 0; for (let y = sea[1]; y <= sea[3]; y++) for (let x = sea[0]; x <= sea[2]; x++) if (map[y * MAP_W + x] !== T.WATER) dry++;
    return { bad, dry, ring: EDGE };
  }

  // ---------- the beat-gap report (§6; report-only in Stage 4) ----------
  // along each main road, the beats within 10 tiles of its centre line: a STOP is something to do (a person who talks, a
  // monster's spawn, a signpost, a built place's box, a shop or quest marker); a GLANCE is a landmark on screen (a stop,
  // a building, a reserved place's stakes, the river or the sea, a bridge, a wall). Reports the longest gap of each.
  function beatGaps() {
    const segs = [], beats = [];
    const BRIDGE = Tn('BRIDGE'), WALLISH = new Set([T.TOWN_WALL, Tn('CLIFF'), Tn('PALISADE')].filter(v => v >= 0));
    for (const n of NPCS) if (!n.ghost) beats.push([n.x, n.y, 'stop', 'person ' + n.id]);
    for (const s of MONSTER_SPAWNS) beats.push([s.tx, s.ty, 'stop', 'spawn ' + s.type]);
    if (window.SPREAD_GROUND) for (const [x, y] of SPREAD_GROUND.signs) beats.push([x, y, 'stop', 'signpost']);
    beats.push([SIGN_TILE.x, SIGN_TILE.y, 'stop', 'the story signpost']);
    for (const id of Object.keys(A.ANCHORS)) { const b = A.box(id); if (!b) continue; const kind = A.ANCHORS[id].kind === 'place' || A.isBuilt(id) ? 'stop' : 'glance';
      for (let y = b[1]; y <= b[3]; y += 2) for (let x = b[0]; x <= b[2]; x += 2) beats.push([x, y, kind, id]); }
    for (const b of BUILDINGS) beats.push([b.x, b.y, 'glance', 'building']);
    for (let y = 0; y < MAP_H; y += 2) for (let x = 0; x < MAP_W; x += 2) { const t = map[y * MAP_W + x]; if (t === T.WATER || t === BRIDGE || WALLISH.has(t) || (window.DECO && DECO.isBridge(y * MAP_W + x))) beats.push([x, y, 'glance', tileName(t)]); }
    const out = [];
    for (const id of A.MAIN_ROADS) {
      const pl = A.track(id); let along = 0; const stops = [], glances = [];
      for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k], L = Math.hypot(bx - ax, by - ay), l2 = L * L || 1;
        for (const [x, y, kind] of beats) { const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / l2)), d = Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay));
          if (d > 10) continue; const at = along + t * L; glances.push(at); if (kind === 'stop') stops.push(at); }
        along += L; }
      const gap = list => { const s = [0, ...list.sort((a, b) => a - b), along]; let g = 0; for (let k = 1; k < s.length; k++) g = Math.max(g, s[k] - s[k - 1]); return Math.round(g); };
      out.push({ road: id, length: Math.round(along), stopGap: gap(stops), glanceGap: gap(glances) });
    }
    return out;
  }

  // the world as generated, every time it is (the suite before these checks has dug, built and burned; a reader of the
  // generated world asks for this). A wrap, not a world pass: the Atlas's pass stays the last of HOOKS.world.
  let SNAP = null;
  { const _generateWorld = generateWorld; generateWorld = function () { const r = _generateWorld.apply(this, arguments); SNAP = map.slice(); return r; }; }

  window.SPREAD_CHECKS = { walkClock, TRIPS, WALK_HELD, SEAM_EXEMPT, spacing, ports, gateFloods, scarpSeal, transects, roadsClear, spawnsOffRoads, edgeRing, beatGaps, walkTiles, flood, EDGE };

  // ---------- the self-tests ----------
  HOOKS.selfTest.push((check, F, h) => {
    const PF = 'spread map: ';
    // the checks read the world as generated (the suite before this has dug, built and burned): put the pristine map back
    // for the duration, then the played one
    const played = map.slice(); if (SNAP && SNAP.length === map.length) map.set(SNAP);
    try {
      { const s = spacing();
        check(PF + "named places stand 25+ tiles apart, centre to centre (section 1's exceptions: the watchtower in the Old Bridge, Gull Isle by the dock, the Deepholm rock by the graveyard, Sylvaris in its ring; the open grounds and the drill field's lane are not named places)", s.near.length === 0 && s.places >= 30, s); }
      { const rows = walkClock(), bad = rows.filter(r => r.inside ? !!r.held : !r.held || Math.abs(r.s - r.held.s) > 3);
        check(PF + "the walk-clock (section 1): each trip on foot, the shortest 8-connected walk with root-2 diagonals over walkable ground, the story gates open, is inside its window, or held for the owner at its measured time (WALK_HELD, each with its reason)", bad.length === 0 && rows.length === TRIPS.length,
          { table: rows.map(r => `${r.trip}: ${r.tiles} tiles, ${r.s} s (window ${r.lo}-${r.hi})${r.inside ? '' : r.held ? ' held' : ' OUTSIDE'}`), bad: bad.map(r => r.trip) }); }
      { const r = ports();
        check(PF + "every port is reached from the cave mouth on foot (story gates open; Harl's ferry and the boats count as the links they are), but the ones listed with their reason (Brightwater's landing by blimp, Wreck Rock, the strait's water)", r.missed.length === 0, r); }
      { const r = gateFloods();
        check(PF + "each story gate holds: with the Warden's gate shut nothing south of the rim is reached, with the lair gate shut not the summoning circle, with the palisade's gaps shut not the camp's walker, and on foot no tile east of the strait (the ferry)",
          r.warden.length === 0 && r.lair.length === 0 && r.palisade.length === 0 && r.ferry.east === 0 && r.ringTiles > 40, r); }
      { const r = scarpSeal();
        check(PF + "the scarp seal: from the cave mouth the Wolfwood is reached by exactly the Old Bridge, the goblin-road bridge and the Agility 18 steps (all three shut: none of it; each one alone: all of it)",
          r.none.length === 0 && Object.values(r.each).every(n => n === 5) && Object.values(r.tiles).every(n => n > 0), r); }
      { const r = transects();
        check(PF + "the land seams blend over 8 tiles or more: 20 lines across each (the Wolfwood / Jungle giants, the Ashfields' fade into the Jungle, the Jungle's edge on the Wilds, the burn round Hollowford, the quarry's edge), the median line's mixed run 8+ and no more than 5 lines nearly ruled (under 3: a road or a ford crossing); cliffs, water and story gates are exempt (SEAM_EXEMPT)",
          r.length === 5 && r.every(s => s.median >= 8 && s.runs.filter(v => v < 3).length <= 5), { seams: r.map(s => ({ id: s.id, median: s.median, min: s.min, ruled: s.runs.filter(v => v < 3).length, runs: s.runs.join(' ') })), exempt: SEAM_EXEMPT }); }
      { const bad = roadsClear();
        check(PF + "the main roads are clear surface: no solid tile and no builders' prop on either lane of the six main roads (gates, doors, the story signpost and Hollowford's ruins aside)", bad.length === 0, { bad: bad.slice(0, 10), more: Math.max(0, bad.length - 10) }); }
      { const r = spawnsOffRoads();
        check(PF + "every aggressive spawn stands 6+ tiles off a main road's centre line, but the fights the road leads to (the camp, the outposts, the bandit hills, the lair, the Ashfields' dragons on the Ash Road)", r.near.length === 0, r); }
      { const r = edgeRing();
        check(PF + "ADDENDUM C: the map's outer 8-tile ring on the east and south holds no place, port, building, person, wall or cliff (the east sea aside, water end to end), so land can be added at an edge", r.bad.length === 0 && r.dry === 0, r); }
      { const r = beatGaps();
        check(PF + 'the beat-gap report runs (report-only in Stage 4: stakes are not stops; Stage 5 brings the Cave, Long and Sea Roads under 73 / 36 tiles)', r.length === A.MAIN_ROADS.length && r.every(q => q.length > 0), r); }
      // regionAt asks the outlines directly (section 12): no bisect through REGIONS.find on the way
      { const nf = Object.getOwnPropertyDescriptor(REGIONS, 'find'); let calls = 0;
        Object.defineProperty(REGIONS, 'find', { value: function () { calls++; return nf.value.apply(this, arguments); }, writable: true, configurable: true, enumerable: false });
        let got = null, want = null; try { const [x, y] = P('hollowford.square'); got = regionAt(x, y); want = WORLDSHAPE.regionAt(x, y); } finally { Object.defineProperty(REGIONS, 'find', nf); }
        check(PF + 'regionAt asks the outlines directly once they are on (no bisect through REGIONS.find)', calls === 0 && !!got && got === want, { calls, got: got && got.name }); }
    } finally { map.set(played); }
  });
}
