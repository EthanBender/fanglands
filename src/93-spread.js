// ============================================================================
// THE GREAT SPREAD'S NEW GROUND (Stage 4a of the spread spec, ~/.fanglands/work/spread/spec.md §4, §5, §13)
// src/93-spread.js
//
// The overworld is 400 x 280 now. Every old place moved rigidly to its new spot (src/01-atlas.js), the land between
// stretched, and the roads and the river were laid anew (ATLAS.TRACKS, laid by 02-world). This file adds what the move
// itself needs on top of that, and nothing the later stages build:
//
//   - the new places as REGIONS boxes, ahead of every ground, so each has its name on the map and in the banner;
//     the Sound, the Grub Fields and the Ash Wastes as grounds;
//   - one new tile, PROP, whose kind lives in a side table (PROPS): builders' STAKES round every reserved box, a
//     PLAQUE in each ("Builders' stakes. The Glasshouse is coming."), and BUOYS round Wreck Rock out in the Grey Sea;
//   - the water that keeps the east ferry-only: the Sound (x 303..311, the Grey Sea's south shore to the map's foot)
//     and the east sea along the map's east edge;
//   - Castle Brightwater's ring: a cliff all round, with no gap (the blimp is its only way in, chapter 10);
//   - a signpost (the old SIGN tile) beside every road node; 06-systems reads its words from ATLAS.signText;
//   - placeAction refuses a reserved box and a main road with the tile either side ("Builders have staked this ground.").
//
// Feature file: registers through HOOKS and wraps placeAction (as 54-graves and 63-house do); no core file edits.
// Its world pass runs after 92-worldshape and 93-ashedge (file order), so the land it stakes is the finished land, and
// before 96-atlas builds the Atlas, so the stakes, the cliffs and the water are in FIXED_SOLID and the grid.
// It uses no dice: every stake, plaque and signpost stands where the boxes and the roads say.
// ============================================================================
{
  const A = ATLAS, G = A.GROUNDS;
  const Tn = n => (n in T ? T[n] : -1);
  // (not solid: a peg and a string, a little board, a float; nothing a knight is walled in by, and a road's verge stays open)
  // The tile is made when the first world is generated, after every file has loaded and added its own tiles, so it takes
  // the first free id (245) and no later file's tile id moves.
  let PROP = -1;
  // idx -> { kind: 'stake' | 'plaque' | 'buoy', place, under }: what each PROP cell is, and the ground drawn beneath it
  const PROPS = new Map();
  const SP = window.SPREAD_GROUND = { PROP, PROPS, signs: [], stats: {} };
  const ensureProp = () => { if (PROP < 0) { PROP = addTile('PROP', { solid: false, tex: 'grass', mini: '#d9a35b' }); SP.PROP = PROP; INTERESTING_TILES.add(PROP); } return PROP; };
  const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

  // ---------- the new places' names (§4, ADDENDUM A) ----------
  // [anchor id, the name on the map, the plaque's place name]
  const NAMES = {
    old_bridge: ['The Old Bridge', 'The Old Bridge'], millbrook: ['Millbrook', 'Millbrook'], saltmere: ['Saltmere', 'Saltmere'],
    crossroads_inn: ['The Crossroads Inn', 'The Crossroads Inn'], beacon_hills: ['Beacon Hills', 'Beacon Hills'], hunters_lodge: ["Hunters' Lodge", "The Hunters' Lodge"],
    outpost_north: ['North Goblin Outpost', 'A goblin outpost'], outpost_south: ['South Goblin Outpost', 'A goblin outpost'], bandit_hills: ['Bandit Hills', 'The Bandit Hills'],
    skypier: ['Skypier', 'The Skypier'], wreck_rock: ['Wreck Rock', 'Wreck Rock'], brightwater: ['Castle Brightwater', 'Castle Brightwater'],
    ash_wastes: ['The Ash Wastes', null], sylvaris_growth: [null, null], alchemy: ['The Glasshouse', 'The Glasshouse'], necromancy: ['The Old Barrow', 'The Old Barrow'],
  };
  const PLAQUE = {
    ash_wastes: "Builders' stakes. The Ash Wastes are not open yet.",
    sylvaris_growth: "Builders' stakes. Sylvaris is growing.",
    blood_portal: "Builders' stakes. Something will open here one day.",
  };
  // a name whose last word is plural takes "are" ("The Bandit Hills are coming."), the rest "is"
  const isAre = name => /[^s']s$/.test(name.split(' ').pop()) ? 'are' : 'is';
  const plaqueText = id => PLAQUE[id] || (NAMES[id] && NAMES[id][1] ? `Builders' stakes. ${NAMES[id][1]} ${isAre(NAMES[id][1])} coming.` : "Builders' stakes.");
  SP.plaqueText = plaqueText;

  // ---------- REGIONS ----------
  // the new places first of all (each a box, ahead of every ground and of the Grey Sea round Wreck Rock); the Sound ahead
  // of the Jungle (whose box runs under it); the Grub Fields and the Ash Wastes just ahead of the Wilds (after the Redcut,
  // whose box lies inside the Grub Fields'). `atlas` keeps each one's Atlas id its anchor's.
  { const SUB = 'Builders have staked this ground';
    const boxes = A.reserved().filter(r => NAMES[r.id] && NAMES[r.id][0] && r.id !== 'ash_wastes')
      .map(r => ({ name: NAMES[r.id][0], sub: A.isBuilt(r.id) ? A.BUILT.get(r.id).sub : SUB, atlas: r.id, x0: r.box[0], y0: r.box[1], x1: r.box[2], y1: r.box[3] }));
    REGIONS.splice(0, 0, ...boxes);
    const jungle = REGIONS.findIndex(r => r.name === 'The Jungle');
    REGIONS.splice(jungle < 0 ? REGIONS.length - 1 : jungle, 0, { name: 'The Sound', sub: 'Deep water. Only the ferry crosses', atlas: 'sound', x0: G.sound[0], y0: G.sound[1], x1: G.sound[2], y1: G.sound[3] });
    const wild = REGIONS.findIndex(r => r.name === 'The Wilds'), aw = A.box('ash_wastes');
    REGIONS.splice(wild < 0 ? REGIONS.length - 1 : wild, 0,
      { name: 'The Grub Fields', sub: 'Scrub between Grubmarket and the Redcut', atlas: 'grub_fields', x0: G.grub_fields[0], y0: G.grub_fields[1], x1: G.grub_fields[2], y1: G.grub_fields[3] },
      { name: 'The Ash Wastes', sub: 'Not open yet', atlas: 'ash_wastes', x0: aw[0], y0: aw[1], x1: aw[2], y1: aw[3] });
  }

  // ---------- the pass ----------
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // the Sound and the east sea are laid FIRST of all the world passes too (and again in the pass below, which runs after
  // the coast and the jungle are drawn): every pass between sees the east cut off by water, as it is, so none of them
  // (39's reach repair, 92's walled-off check) counts the Grub Fields or the Far Shore as walkable from the mainland
  const water = api => { for (const b of [G.sound, G.east_sea]) for (let y = Math.max(0, b[1]); y <= Math.min(MAP_H - 1, b[3]); y++) for (let x = Math.max(0, b[0]); x <= Math.min(MAP_W - 1, b[2]); x++) if (api.tileAt(x, y) !== T.WATER) api.setTile(x, y, T.WATER); };
  HOOKS.world.unshift((rnd0, api) => { ensureProp(); water(api); });
  HOOKS.world.push((rnd0, api) => {
    const set = api.setTile, at = api.tileAt;
    PROPS.clear(); SP.signs = []; ARMS.clear();
    const S = SP.stats = { sea: 0, sound: 0, cliff: 0, stakes: {}, plaques: {}, buoys: 0, signs: 0, moved: [], skipped: [] };
    const WATER = T.WATER, CLIFF = Tn('CLIFF'), SAND = T.SAND;
    // the roads' centre lines: nothing of this file's stands within 2 tiles of one (a stake or a sign by the road, not on it)
    const roadD = new Float32Array(MAP_W * MAP_H).fill(99);
    const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
    for (const id of A.ROAD_IDS) { const pl = A.track(id);
      for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k];
        for (let y = Math.max(0, Math.floor(Math.min(ay, by) - 3)); y <= Math.min(MAP_H - 1, Math.ceil(Math.max(ay, by) + 3)); y++)
          for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - 3)); x <= Math.min(MAP_W - 1, Math.ceil(Math.max(ax, bx) + 3)); x++) { const d = segD(x, y, ax, ay, bx, by), i = y * MAP_W + x; if (d < roadD[i]) roadD[i] = d; } } }
    const near = new Uint8Array(MAP_W * MAP_H);   // a person, a spawn, a door: one tile all round stays as it is
    const mark = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(x + dx, y + dy)) near[(y + dy) * MAP_W + x + dx] = 1; };
    for (const n of NPCS) mark(n.x, n.y, 1);
    for (const s of MONSTER_SPAWNS) mark(s.tx, s.ty, 1);
    for (const id in A.PORTS) { const p = A.port(id); if (p) mark(Math.round(p[0]), Math.round(p[1]), 0); }
    const OPEN = t => !SOLID.has(t) && !PUSH_THROUGH.has(t) && t !== WATER;
    const KEEP = new Set([T.COBBLE, T.FLOOR, T.SOIL, T.CROP, T.DOOR, T.GATE, Tn('BRIDGE'), Tn('DOCK'), T.SIGN].filter(v => v >= 0));
    // ground a stake or a sign may stand on: open, not built, not by a person or a road, with three open sides
    const standable = (x, y, clear) => inMap(x, y) && x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1 && OPEN(at(x, y)) && !KEEP.has(at(x, y)) && !buildingAt(x, y) &&
      !near[y * MAP_W + x] && roadD[y * MAP_W + x] > clear && N4.filter(([dx, dy]) => OPEN(at(x + dx, y + dy))).length >= 3;
    const prop = (x, y, kind, place) => { const i = y * MAP_W + x; PROPS.set(i, { kind, place, under: at(x, y) }); set(x, y, PROP); };

    // ---- 1. the water that keeps the east ferry-only, and the east sea ----
    const flood = (b, key) => { for (let y = Math.max(0, b[1]); y <= Math.min(MAP_H - 1, b[3]); y++) for (let x = Math.max(0, b[0]); x <= Math.min(MAP_W - 1, b[2]); x++) if (at(x, y) !== WATER) { set(x, y, WATER); S[key]++; } };
    flood(G.sound, 'sound'); flood(G.east_sea, 'sea');
    // a sandy shore where the land meets the new water (soft ground only)
    for (const b of [G.sound, G.east_sea]) for (let y = Math.max(1, b[1]); y <= Math.min(MAP_H - 2, b[3]); y++) for (const x of [b[0] - 1, b[2] + 1]) {
      if (!inMap(x, y)) continue; const t = at(x, y); if (t === T.GRASS || t === T.FLOWERS || t === T.MUSHROOM || t === Tn('FERN') || t === T.DIRT) set(x, y, SAND); }
    // nothing wakes in the water: a spawn the new sea covered moves to the nearest dry open ground
    for (const s of MONSTER_SPAWNS) {
      if (at(s.tx, s.ty) !== WATER || MONSTER_DEFS[s.type].human) continue;
      let best = null;
      for (let r = 1; r <= 16 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = s.tx + dx, y = s.ty + dy;
        if (!inMap(x, y) || !OPEN(at(x, y)) || buildingAt(x, y) || inB(G.sound, x, y) || inB(G.east_sea, x, y)) continue;
        const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { x, y, d }; }
      if (best) { S.moved.push([s.type, s.tx, s.ty, best.x, best.y]); s.movedFrom = s.movedFrom || [s.tx, s.ty]; s.tx = best.x; s.ty = best.y; }
    }

    // ---- 1b. every aggressive spawn 6+ tiles off a main road (§4, Stage 4b) ----
    const RING8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
    // The open land stretched, the roads were laid anew: a wolf or a goblin whose old spot now lies by the Cave Road or the
    // Wolfwood Road would wake on every passing knight. Each moves to the nearest open ground of its own region 6.5+ tiles
    // from every main road's centre line (no dice: nearest first, ties by row then column). Not the fights a road leads
    // to (the camp, the outposts, the bandit hills, the lair, Hollowford's occupiers) nor the Ashfields' dragons on the Ash
    // Road, which the road goes through to its end (97-spreadchecks lists them).
    { const mainD = new Float32Array(MAP_W * MAP_H).fill(99);
      for (const id of A.MAIN_ROADS) { const pl = A.track(id);
        for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k];
          for (let y = Math.max(0, Math.floor(Math.min(ay, by) - 8)); y <= Math.min(MAP_H - 1, Math.ceil(Math.max(ay, by) + 8)); y++)
            for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - 8)); x <= Math.min(MAP_W - 1, Math.ceil(Math.max(ax, bx) + 8)); x++) { const d = segD(x, y, ax, ay, bx, by), i = y * MAP_W + x; if (d < mainD[i]) mainD[i] = d; } } }
      const KEEP_AT = ['camp', 'outpost_north', 'outpost_south', 'bandit_hills', 'fang_lair', 'hollowford'].map(id => A.box(id));
      const kept = (x, y) => KEEP_AT.some(b => b && x >= b[0] - 6 && x <= b[2] + 6 && y >= b[1] - 6 && y <= b[3] + 6) || /^The Ashfields$|^The Fang's Lair$/.test(regionAt(x, y).name);
      S.offRoad = [];
      for (const s of MONSTER_SPAWNS) {
        const d = MONSTER_DEFS[s.type]; if (!d || !d.aggro || s.camp || mainD[s.ty * MAP_W + s.tx] >= 6 || kept(s.tx, s.ty)) continue;
        const home = regionAt(s.tx, s.ty).name; let best = null;
        for (let r = 1; r <= 16 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = s.tx + dx, y = s.ty + dy;
          if (!inMap(x, y) || x < 1 || y < 1 || x > MAP_W - 2 || y > MAP_H - 2 || mainD[y * MAP_W + x] < 6.5 || !OPEN(at(x, y)) || buildingAt(x, y) || near[y * MAP_W + x] || A.reservedAt(x, y) || regionAt(x, y).name !== home) continue;
          // (open all round: a new game clears the ground about a spawn, and that clearing must not cut a way through a wall)
          if (!RING8.every(([ex, ey]) => OPEN(at(x + ex, y + ey)) && !buildingAt(x + ex, y + ey))) continue;
          const dd = Math.hypot(dx, dy); if (!best || dd < best.d) best = { x, y, d: dd };
        }
        if (best) { S.offRoad.push([s.type, s.tx, s.ty, best.x, best.y]); s.movedFrom = s.movedFrom || [s.tx, s.ty]; s.tx = best.x; s.ty = best.y; }
        else S.skipped.push('no ground 6 tiles off the road for the ' + s.type + ' at ' + s.tx + ',' + s.ty);
      } }

    // ---- 2. Castle Brightwater: a cliff ring one tile inside its box, no gap; sand between it and the east sea ----
    if (CLIFF >= 0) { const b = A.box('brightwater'), r = [b[0] + 1, b[1] + 1, b[2] - 1, b[3] - 1];
      for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) {
        const edge = x === r[0] || x === r[2] || y === r[1] || y === r[3];
        if (edge) { set(x, y, CLIFF); S.cliff++; } else if (SOLID.has(at(x, y)) && at(x, y) !== T.TREE && at(x, y) !== T.OAK) set(x, y, T.GRASS); }
      for (let y = b[1]; y <= b[3]; y++) if (at(b[2], y) !== WATER) set(b[2], y, SAND); }

    // ---- 3. stakes round every reserved box, a plaque in each, buoys round Wreck Rock ----
    for (const { id, box: b } of A.reserved()) {
      if (id === 'wreck_rock') {   // out in the Grey Sea: a buoy at each corner, a plaque buoy at the rock's own port
        for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) if (at(x, y) === WATER) { prop(x, y, 'buoy', id); S.buoys++; }
        const [px, py] = A.port('wreck_rock.rock'); if (at(px, py) === WATER) { prop(px, py, 'plaque', id); S.plaques[id] = 1; }
        continue;
      }
      // the perimeter, one stake every fourth tile (corners always); the Ash Wastes' edges on the map's border are the
      // border's, so only its north and east sides take stakes
      const ring = [];
      for (let x = b[0]; x <= b[2]; x++) ring.push([x, b[1]], [x, b[3]]);
      for (let y = b[1] + 1; y < b[3]; y++) ring.push([b[0], y], [b[2], y]);
      let n = 0;
      for (const [x, y] of ring) {
        const top = y === b[1] || y === b[3], side = x === b[0] || x === b[2];
        if (!((top && side) || (top && (x - b[0]) % 4 === 0) || (side && (y - b[1]) % 4 === 0))) continue;
        if (!standable(x, y, 2)) continue;
        prop(x, y, 'stake', id); n++;
      }
      S.stakes[id] = n;
      // the plaque: at the place's door port when it has one, else on its own ground nearest the road that serves it
      const door = A.port(id + '.door'), cand = [];
      if (door && standable(door[0], door[1], 1.5)) cand.push([door[0], door[1], 0]);
      else { let best = null;
        for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) { if (!standable(x, y, 2)) continue; const d = roadD[y * MAP_W + x]; if (!best || d < best[2]) best = [x, y, d]; }
        if (best) cand.push(best); }
      if (cand.length) { prop(cand[0][0], cand[0][1], 'plaque', id); S.plaques[id] = 1; } else S.skipped.push('no ground for ' + id + "'s plaque");
    }
    // the blood portals' keep-clear rings (§4): a stake at each corner of the ring of 3, the plaque at the port. Not
    // Thistledown's: its north lawn is 95-thistledown's own ground, painted and repainted from the capital's quest state,
    // and nothing of this file's may stand among the city's things (Stage 7 lays that portal itself)
    for (const pid of Object.keys(A.PORTS).filter(k => /\.blood_portal$/.test(k) && k !== 'thistledown.blood_portal')) {
      const [px, py] = A.port(pid).map(Math.round); let n = 0;
      for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) if (standable(px + dx, py + dy, 1.5)) { prop(px + dx, py + dy, 'stake', 'blood_portal'); n++; }
      if (OPEN(at(px, py)) && !KEEP.has(at(px, py)) && !buildingAt(px, py)) { prop(px, py, 'plaque', 'blood_portal'); S.plaques[pid] = 1; } else S.skipped.push('the port ' + pid + ' is not open ground');
      S.stakes[pid] = n;
    }

    // ---- 3b. every ore rock and berry bush still has a side a knight can walk to ----
    // On the bigger map the land round a seam is new (the quarry's south-west corner lost the old spur road that kept its
    // rock spill back, and 92's quarry ground turned that corner's dirt to rock), so a blackiron rock can end up walled in
    // by plain rock. Where one has no open side the knight can reach, the fewest plain rocks and trees between it and
    // reached ground give way (never an ore, a cliff, a building or anything within 3 rows of the Wolfwood scarp).
    if (window.ORES) {
      const pass = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || t === Tn('WARDEN_GATE') || t === Tn('LAIR_GATE') || t === Tn('CRYPT_BARS') || t === Tn('SCARP_STEPS');
      const DIG = new Set([T.ROCK, T.IRON, T.COAL, T.TREE, T.OAK].filter(v => v >= 0)), sGW = window.WORLDSHAPE && WORLDSHAPE.seams && WORLDSHAPE.seams.sGW;
      // (walked from each metal's own anchor, as 62-ores' check walks it: the cave mouth, or the Far Shore's landing)
      const reach = from => { const seen = new Uint8Array(MAP_W * MAP_H), q = []; const push = (x, y) => { if (!inMap(x, y)) return; const i = y * MAP_W + x; if (seen[i] || !pass(at(x, y))) return; seen[i] = 1; q.push(i); };
        push(...from); for (let k = 0; k < q.length; k++) { const c = q[k], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4) push(x + dx, y + dy); } return seen; };
      // (and every berry bush: 39's copses can close round one on the new land)
      const SPOTS = Object.assign({}, ORES.SPOTS), BUSH = Tn('BERRY_BUSH');
      if (BUSH >= 0) { SPOTS.berry = []; for (let i = 0; i < MAP_W * MAP_H; i++) if (map[i] === BUSH) SPOTS.berry.push([i % MAP_W, (i / MAP_W) | 0]); }
      let seen = null, seenKey = null; S.oreDug = [];
      for (const key in SPOTS) for (const [ox, oy] of SPOTS[key]) {
        const tier = ORES.BY_KEY[key], from = tier && tier.anchor ? tier.anchor : A.port('cave.mouth');
        if (!seen || seenKey !== key) { seen = reach(from); seenKey = key; }
        if (N4.some(([dx, dy]) => inMap(ox + dx, oy + dy) && seen[(oy + dy) * MAP_W + ox + dx])) continue;
        const prev = new Map(), q = [[ox, oy]]; prev.set(oy * MAP_W + ox, -1); let end = null;
        for (let k = 0; k < q.length && !end && k < 4000; k++) { const [x, y] = q[k];
          for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy, ni = ny * MAP_W + nx; if (!inMap(nx, ny) || prev.has(ni) || Math.hypot(nx - ox, ny - oy) > 12) continue;
            const t = at(nx, ny); if (sGW && Math.abs(ny - sGW(nx)) <= 3) continue;
            if (seen[ni]) { prev.set(ni, y * MAP_W + x); end = ni; break; }
            if (pass(t) || (DIG.has(t) && !buildingAt(nx, ny))) { prev.set(ni, y * MAP_W + x); q.push([nx, ny]); } } }
        if (end === null) { S.skipped.push('no dig frees the ' + key + ' rock at ' + ox + ',' + oy); continue; }
        for (let c = prev.get(end); c !== -1 && c !== oy * MAP_W + ox; c = prev.get(c)) { const x = c % MAP_W, y = (c / MAP_W) | 0; if (DIG.has(at(x, y))) { set(x, y, T.DIRT); S.oreDug.push([x, y]); } }
        seen = null;
      }
    }

    // ---- 4. a signpost beside every road node (§5): the old SIGN tile, two to six tiles off the node, off the road ----
    // (a post never cuts a way: the open ground round it, walked round the eight tiles about it, is one piece, so every
    // open side of it still reaches every other without it)
    const simple = (x, y) => { const o = RING8.map(([dx, dy]) => OPEN(at(x + dx, y + dy)));
      let runs = 0; for (let k = 0; k < 8; k++) if (o[k] && !o[(k + 7) % 8]) runs++;
      return runs === 1 || (runs === 0 && o.every(Boolean)); };
    for (const q of A.SIGNPOSTS) {
      const [nx, ny] = A.pointOf(q.at).map(Math.round);
      if (nx === SIGN_TILE.x && ny === SIGN_TILE.y) continue;   // the story's own signpost (02-world)
      let best = null;
      if (q.sign) { const [sx, sy] = A.pointOf(q.sign).map(Math.round); if (standable(sx, sy, 1.9) && simple(sx, sy)) best = { x: sx, y: sy, d: 0 }; }
      for (let r = 2; r <= 6 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = nx + dx, y = ny + dy;
        if (!standable(x, y, 1.9) || A.reservedAt(x, y) && PROPS.has(y * MAP_W + x) || !simple(x, y)) continue;
        // and a knight can stand beside it on the road side
        if (!N4.some(([ex, ey]) => roadD[(y + ey) * MAP_W + x + ex] <= 2.5 && OPEN(at(x + ex, y + ey)))) continue;
        const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { x, y, d };
      }
      if (!best) { S.skipped.push('no ground for the signpost at ' + nx + ',' + ny); continue; }
      set(best.x, best.y, T.SIGN); SP.signs.push([best.x, best.y, nx, ny]); S.signs++;
    }
  });
  // the passes that build on the finished land (HOOKS.built: the Stage 5 places and creatures): right after the stakes, so a
  // place can take its own up, and before 95-thistledown's snapshot and 96-atlas's build (both pushed by later files)
  // (61-markers made its markers in an earlier pass, from the people and tiles then down: they are made again once the
  // built places' people, shops and docks are there)
  HOOKS.world.push((rnd, api) => { for (const f of HOOKS.built) f(rnd, api); if (HOOKS.built.length && window.MARKERS && MARKERS.rebuildWorld) MARKERS.rebuildWorld(); });

  // ---------- what a road's signpost shows on its arms (08-draw's drawSignProp asks) ----------
  // up to three arms, each a short name pointing left (west-ish) or right; the story's own signpost keeps its arms
  const ARMS = new Map();
  const SHORT = { 'CROSSROADS INN': 'INN', "WARDEN'S GATE": 'WARDEN', 'OLD SIGNPOST': 'SIGNPOST', "HUNTERS' LODGE": 'LODGE', 'GOBLIN OUTPOST': 'OUTPOST', 'BANDIT HILLS': 'BANDITS' };   // (an arm holds about 12 letters)
  window.SIGN_ARMS = (tx, ty) => {
    if (window.__instance || (tx === SIGN_TILE.x && ty === SIGN_TILE.y)) return null;
    const i = ty * MAP_W + tx; if (ARMS.has(i)) return ARMS.get(i);
    const sign = SP.signs.find(q => q[0] === tx && q[1] === ty); let arms = null;
    if (sign) { const legs = A.signArms(tx, ty), seen = new Set(); arms = [];
      // (a built place may show four arms at its own crossroads: markBuilt's `arms`, 84-crossroads' four-way signpost)
      const four = [...A.BUILT].some(([id, info]) => info.arms === 4 && A.builtAt(sign[2], sign[3]) === id), max = four ? 4 : 3, step = four ? 14 : 16, top = four ? -44 : -42;
      for (const l of legs) { const w0 = l.to.replace(/\s*\(.*\)$/, '').replace(/^the /i, '').toUpperCase(), word = SHORT[w0] || w0.slice(0, 12); if (seen.has(word) || arms.length >= max) continue; seen.add(word);
        arms.push([top + arms.length * step, word, false, /west/.test(l.dir)]); }
      if (!arms.length) arms = null; }
    ARMS.set(i, arms); return arms;
  };

  // ---------- what a stake, a plaque, a buoy and a signpost say ----------
  HOOKS.use.push((t, tx, ty) => {
    if (t !== PROP || window.__instance) return false;
    const p = PROPS.get(ty * MAP_W + tx); if (!p) return false;
    say(p.kind === 'buoy' ? 'A buoy, tied to a builders\' line. ' + plaqueText(p.place) : plaqueText(p.place), 'Builders');
    return true;
  });
  // nothing is built on staked ground or on a main road (the road and the tile either side of it)
  { const _placeAction = placeAction;
    placeAction = function (id) {
      if (!window.__instance && !player.dead && !player.mech) {
        const { tx, ty } = frontTile(player, 40);
        const rid = inMap(tx, ty) ? A.builtAt(tx, ty) || A.reservedAt(tx, ty) : null;
        // (a built place keeps its ground: its people, paths and yards are not a knight's to build on)
        // (a name ending in s takes a bare apostrophe: "Beacon Hills' ground")
        if (rid && A.isBuilt(rid)) { const nm = NAMES[rid][1].replace(/^The /, 'the '); notify(`This is ${nm}${/s$/.test(nm) ? "'" : "'s"} ground. Build somewhere else.`); return; }
        if (inMap(tx, ty) && (rid || A.onMainRoad(tx, ty))) { notify('Builders have staked this ground.'); return; }
      }
      return _placeAction.apply(this, arguments);
    }; }

  // ---------- drawing: the ground beneath, then the stake, the plaque or the buoy ----------
  HOOKS.draw.push((g, items) => {
    if (window.__instance) return;
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 1);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const i = idx(tx, ty); if (map[i] !== PROP) continue;
      const p = PROPS.get(i); if (!p) continue;
      const px = tx * TILE, py = ty * TILE, v = variant[i] % 3;
      items.push({ y: -1e9 + 1, draw: () => { const img = tex[TEX_NAME[p.under] + v]; if (img) g.drawImage(img, px, py, TILE, TILE); } });
      items.push({ y: py + TILE - 4, draw: () => drawProp(g, px, py, p.kind) });
    }
  });
  function drawProp(g, px, py, kind) {
    const cx = px + TILE / 2, base = py + TILE - 8;
    if (kind === 'buoy') {   // a red and white float on the water, its line slack
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, base + 2, 11, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#d9483b'; g.beginPath(); g.arc(cx, base - 6, 9, Math.PI, 0); g.fill();
      g.fillStyle = '#f2efe6'; g.fillRect(cx - 9, base - 6, 18, 5);
      g.fillStyle = '#3a2a1a'; g.fillRect(cx - 1, base - 22, 2, 9);
      return;
    }
    if (kind === 'plaque') {   // a small board on two legs
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, base + 3, 14, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#6b4a2a'; g.fillRect(cx - 11, base - 14, 3, 17); g.fillRect(cx + 8, base - 14, 3, 17);
      g.fillStyle = '#c9a36a'; g.fillRect(cx - 15, base - 30, 30, 18);
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 2; g.strokeRect(cx - 15, base - 30, 30, 18);
      g.fillStyle = '#5a3d26'; for (let k = 0; k < 3; k++) g.fillRect(cx - 10, base - 26 + k * 5, 20 - k * 4, 2);
      return;
    }
    // a builders' stake: a pale peg with an orange ribbon
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, base + 3, 7, 3, 0, 0, 7); g.fill();
    g.fillStyle = '#d8c39a'; g.fillRect(cx - 2, base - 20, 4, 23);
    g.fillStyle = '#8a7550'; g.fillRect(cx - 2, base - 20, 4, 3);
    g.fillStyle = '#e8873a'; g.beginPath(); g.moveTo(cx + 2, base - 18); g.lineTo(cx + 12, base - 15); g.lineTo(cx + 2, base - 12); g.closePath(); g.fill();
  }

  // ---------- self-tests ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'spread: ', S = SP.stats;
    // every reserved place is staked, with a plaque that says what is coming
    const res = A.reserved().filter(r => !A.isBuilt(r.id)), unstaked = res.filter(r => r.id !== 'wreck_rock' && !(S.stakes[r.id] > 0)).map(r => r.id), noPlaque = res.filter(r => !S.plaques[r.id]).map(r => r.id);
    const plaques = [...PROPS.entries()].filter(([, p]) => p.kind === 'plaque');
    const glass = plaques.find(([, p]) => p.place === 'alchemy'), barrow = plaques.find(([, p]) => p.place === 'necromancy');
    // (a place Stage 5 has built takes its own stakes up: 85-riverside and the rest test their own ground)
    check(P + "every reserved place not yet built has builders' stakes round it and a plaque (the Glasshouse's says \"Builders' stakes. The Glasshouse is coming.\", the Old Barrow's \"... The Old Barrow is coming.\"), and Wreck Rock's buoys float in the Grey Sea",
      !unstaked.length && !noPlaque.length && !!glass && !!barrow && plaqueText('alchemy') === "Builders' stakes. The Glasshouse is coming." && plaqueText('necromancy') === "Builders' stakes. The Old Barrow is coming." && S.buoys >= 4,
      { unstaked, noPlaque, stakes: S.stakes, buoys: S.buoys, skipped: S.skipped });
    // the plaques' grammar: a plural name is "are" (the review of c34fddf read "The Bandit Hills is coming.")
    { const texts = res.map(r => [r.id, plaqueText(r.id)]), bad = texts.filter(([, t]) => /\b\w+s is coming\.$/.test(t));
      check(P + "every plaque reads right: \"Builders' stakes. The Bandit Hills are coming.\", and no plural name \"is coming\"", plaqueText('bandit_hills') === "Builders' stakes. The Bandit Hills are coming." && !bad.length, { bad, bandit: plaqueText('bandit_hills') }); }
    // E on a plaque reads it
    { const [i] = glass || []; let said = null;
      if (i !== undefined) { const x = i % MAP_W, y = (i / MAP_W) | 0, spot = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => [x + dx, y + dy]).find(([sx, sy]) => !SOLID.has(tileAt(sx, sy)));
        if (spot) { dialog.queue.length = 0; advanceDialog(); F.tp(spot[0], spot[1]); F.face(x, y); F.press('KeyE'); F.sim(2, []);
          const d = [dialog.cur, ...dialog.queue].find(q => q && q.who === 'Builders'); said = d ? d.text : null; dialog.queue.length = 0; advanceDialog(); } }
      check(P + "E on the Glasshouse plaque reads \"Builders' stakes. The Glasshouse is coming.\"", said === "Builders' stakes. The Glasshouse is coming.", { said }); }
    // nothing is built on staked ground or on a main road; beside the road it is
    { const traps = () => countItem('goblin_trap'); h.give('goblin_trap', 3); h.peace(true);
      const b = A.box('alchemy'), cx = Math.round((b[0] + b[2]) / 2), cy = Math.round((b[1] + b[3]) / 2);
      // (a goblin trap: the one thing a knight may still set down in the shared world; planks and walls go on his island)
      const tryAt = (x, y) => { F.tp(x, y + 1); player.facing = { x: 0, y: -1 }; notice = null; const n0 = traps(); placeAction('goblin_trap'); const placed = traps() < n0; if (placed && tileAt(x, y) === T.TRAP) changeTile(x, y, T.GRASS); return { placed, notice: notice && notice.text }; };
      const inBox = tryAt(cx, cy);
      const road = A.track('r1_cave'), [rx, ry] = road[2].map(Math.round), onRoad = tryAt(rx, ry);
      // three tiles off the Cave Road, on open grass, is anyone's
      let off = null; for (let d = 4; d <= 9 && !off; d++) for (const [ox, oy] of [[0, d], [0, -d], [d, 0], [-d, 0]]) { const x = rx + ox, y = ry + oy; if (!off && tileAt(x, y) === T.GRASS && tileAt(x, y + 1) === T.GRASS && !A.onMainRoad(x, y) && !A.reservedAt(x, y)) off = [x, y]; }
      const free = off ? tryAt(off[0], off[1]) : null;
      h.peace(false);
      check(P + "placeAction refuses inside a reserved box and on a main road, the road and one tile either side (\"Builders have staked this ground.\"), and places three tiles off the road",
        !inBox.placed && inBox.notice === 'Builders have staked this ground.' && !onRoad.placed && onRoad.notice === 'Builders have staked this ground.' && !!free && free.placed, { inBox, onRoad, free, at: [cx, cy, rx, ry, off] }); }
    // the east is ferry-only: the Sound and the east sea are water from end to end, and no tile east of the strait is
    // reached on foot from the cave mouth (bridges, gates and doors open; the ferry is a boat)
    { let dry = 0; for (const b of [G.sound, G.east_sea]) for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) if (tileAt(x, y) !== T.WATER) dry++;
      const seen = new Uint8Array(MAP_W * MAP_H), q = [], pass = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || t === Tn('WARDEN_GATE') || t === Tn('LAIR_GATE') || t === Tn('CRYPT_BARS');
      const push = (x, y) => { if (!inMap(x, y)) return; const i = y * MAP_W + x; if (seen[i] || !pass(tileAt(x, y))) return; seen[i] = 1; q.push(i); };
      push(...A.port('cave.mouth')); for (let k = 0; k < q.length; k++) { const c = q[k], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4) push(x + dx, y + dy); }
      let east = 0, eastAt = null; for (let y = 0; y < MAP_H; y++) for (let x = G.grub_fields[0]; x < MAP_W; x++) if (seen[y * MAP_W + x]) { east++; if (!eastAt) eastAt = [x, y]; }
      check(P + 'the Sound (x 303..311, y 140..279) and the east sea (x 392..399) are water end to end, and nothing east of the Sound (x 312 on) is reached on foot from the cave mouth', dry === 0 && east === 0, { dry, east, eastAt }); }
    // Castle Brightwater: no way in on foot (its landing is not reached from outside its ring)
    { const b = A.box('brightwater'), L = A.port('brightwater.landing'), outside = [b[0] - 1, Math.round((b[1] + b[3]) / 2)];
      const path = F.bfs(outside[0], outside[1], L[0], L[1]), ring = (() => { let n = 0; for (let y = b[1] + 1; y <= b[3] - 1; y++) for (let x = b[0] + 1; x <= b[2] - 1; x++) if ((x === b[0] + 1 || x === b[2] - 1 || y === b[1] + 1 || y === b[3] - 1) && tileAt(x, y) !== Tn('CLIFF')) n++; return n; })();
      check(P + "Castle Brightwater is ringed by cliff with no gap: its landing is not reached on foot from the Grub Fields", !path && ring === 0, { path: path && path.length, gaps: ring }); }
    // a signpost by every road node, readable from the road; its words name the roads' places
    { const want = A.SIGNPOSTS.filter(q => { const p = A.pointOf(q.at); return !(Math.round(p[0]) === SIGN_TILE.x && Math.round(p[1]) === SIGN_TILE.y); }).length, bad = SP.signs.filter(([x, y]) => tileAt(x, y) !== T.SIGN), fork = SP.signs.find(([, , nx, ny]) => { const p = A.pointOf(A.SIGNPOSTS[0].at); return nx === p[0] && ny === p[1]; });
      const words = fork ? A.signText(fork[0], fork[1]) : null;
      check(P + "a signpost stands beside every road node (" + want + " besides the story's), and the Mill Lane fork's names Millbrook, Thistledown and the cave, and says the way to Thistledown goes past the old signpost (chapter 4's sign)",
        SP.signs.length === want && !bad.length && !!words && /Millbrook/.test(words) && /Thistledown, south-east, past the old signpost\./.test(words) && /cave/.test(words), { signs: SP.signs.length, want, bad, words, skipped: S.skipped }); }
    // the road network is laid whole: each main road's centre line is open ground (a bridge, a gate or a door counts) from
    // end to end, bar the story signpost, the gates' own tiles and Hollowford's ruins
    { const gaps = {}, OKT = new Set([T.SIGN, Tn('WARDEN_GATE'), Tn('LAIR_GATE'), T.GATE, T.DOOR].filter(v => v >= 0)), hf = A.box('hollowford');
      for (const id of A.MAIN_ROADS) { const pl = A.track(id);
        for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k], n = Math.max(1, Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
          for (let s = 0; s <= n; s++) { const x = Math.round(ax + (bx - ax) * s / n), y = Math.round(ay + (by - ay) * s / n), t = tileAt(x, y);
            if (inB(hf, x, y) || OKT.has(t) || !SOLID.has(t) || PUSH_THROUGH.has(t)) continue; (gaps[id] = gaps[id] || []).push(x + ',' + y + ' ' + tileName(t)); } } }
      check(P + 'every main road is open from end to end (its centre line: no tree, rock, fence or wall on it, Hollowford\'s ruins and the gates aside)', !Object.keys(gaps).length, { gaps: Object.fromEntries(Object.entries(gaps).map(([k, v]) => [k, v.slice(0, 6)])) }); }
  });
}
