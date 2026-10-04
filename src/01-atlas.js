// ============================================================================
// THE ATLAS — one table of every place in the Fanglands, for the shared world (docs/ONLINE.md, "The shared world", Stage 1)
// Owner-approved plan (phase 1): the world server will run the monsters, so it has to know the land the way the game does:
// which place each tile belongs to, where many knights may fight one monster (multi) and where one fights one (single),
// and which tiles no honest knight can ever stand in (FIXED_SOLID). The Room has no game, so it reads the same table from
// online/src/atlas.json, which tools/atlas.mjs writes from this file (run by build.sh); online/test/atlas-drift.mjs fails a
// deploy whose atlas.json is stale.
//
// Names are never written twice: a place's name and sub come from the REGIONS entry or the INSTANCES.define its feature
// already declares. ATLAS_RULES below only says how a place differs from the default (a region or instance with no rule is
// single combat, on its own rect or map), and draws the few areas no feature declares. Moving a border is one line.
//
// This file only defines; src/96-atlas.js runs the build as the very last HOOKS.world pass (after every feature has
// carved the world, before a save's changes are laid on it) and holds the drift self-tests and the reload plaque.
//
// window.ATLAS = { places, get(id), place(map, tx, ty), at(tx, ty), zoneAt(map, tx, ty), combatAt(map, tx, ty),
//                  inside(id, k), spawn(id), solidAt(map, tx, ty), hash(), export(), RULES, FIXED_TILES, SPEED_CAP, slug }
// ============================================================================
{
  const ATLAS_V = 1;
  const ID_RE = /^[a-z0-9_]{1,40}$/;
  const AREA_PRI = 2000;   // an area beats every region (regions are 1000 - their REGIONS index)
  // "The Fang's Lair" -> fang_lair, "Goblin Camp" -> goblin_camp, "Miller's Pond" -> miller_pond
  const slug = name => String(name || '').toLowerCase().replace(/^the\s+/, '').replace(/['’]s\b/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

  // ---------- the hand table (only where a place differs from the default) ----------
  // { id, kind, of, combat, pri, rects, spawn, call, pvp, safe, loose }
  const ATLAS_RULES = [
    // multi on the overworld: the gang fights
    { id: 'goblin_camp', combat: 'multi', rects: [[142, 18, 159, 42]] },     // + the camp spawns' rect (generateWorld marks camp spawns from x 142; the region starts at 145)
    { id: 'fang_lair', combat: 'multi' },
    { id: 'hollowford_square', kind: 'area', of: 'hollowford', combat: 'multi', rects: [[130, 70, 150, 90]] },   // the cracked well and the Barrelbeast's ground
    { id: 'ashfields_dragons', kind: 'area', of: 'ashfields', combat: 'multi', rects: [[40, 110, 99, 139]] },    // where the green and red dragons sleep
    { id: 'iron_isle_wreck', kind: 'area', of: 'ironclad_isle', combat: 'multi', rects: [[182, 43, 194, 56]] },  // the goblin wreck and its crew
    { id: 'deep_wilderlands', kind: 'reserved', combat: 'multi', pvp: true },                                   // named now, on no tile yet
    // Hollowford is rebuilt in play (31-rebuild, 41-guild): its building walls come and go, so they never count as fixed
    { id: 'hollowford', loose: true },
    // the square by the Great Fountain; safe stays the option the spec keeps off
    { id: 'thistledown', safe: false, spawn: [112, 33] },
    // every boss instance is multi (the Royal Mine's golem is its boss though the define names none)
    { id: 'spider_den', combat: 'multi' }, { id: 'war_shed', combat: 'multi' }, { id: 'tinker_lab', combat: 'multi' },
    { id: 'stormfront', combat: 'multi' }, { id: 'afterlands', combat: 'multi' }, { id: 'royalmine', combat: 'multi' },
  ];
  // What no honest knight can stand in, by tile name: rock and cave walls (every instance's walls too), castle, building and
  // town walls, cliffs and crags. Never water or lava (hover armour, boats, the ferry), never anything a knight can chop,
  // mine, burn, build, open or climb. 96-atlas's self-tests hold that.
  const FIXED_TILES = ['WALL', 'CWALL', 'HWALL', 'TOWN_WALL', 'KING_WALL', 'KING_TOWER', 'CLIFF', 'REDCLIFF', 'AF_CRAG'];
  // The fastest each mover goes, px/s (from the mounts' and machines' own tables; 96-atlas checks them against those tables);
  // steam is a machine's FULL STEAM run (55-riding), 1.15 s at a time. The movement check never allows more than the max.
  const SPEED_CAP = { foot: 175, hover: 200, horse: 350, dozer: 250, walker: 115, beast: 100, steam: 430 };
  const SPEED_MAX = Math.max(...Object.values(SPEED_CAP));

  // ---------- run-length codes (what atlas.json carries) ----------
  // a place grid: [value, count, value, count, ...]
  const runs = arr => { const out = []; let v = arr[0], n = 0; for (let i = 0; i < arr.length; i++) { if (arr[i] === v) n++; else { out.push(v, n); v = arr[i]; n = 1; } } if (arr.length) out.push(v, n); return out; };
  // a 0/1 mask: counts that alternate, starting with a run of 0s (which may be 0 long)
  const bitRuns = arr => { const out = []; let v = 0, n = 0; for (let i = 0; i < arr.length; i++) { const b = arr[i] ? 1 : 0; if (b === v) n++; else { out.push(n); v = b; n = 1; } } out.push(n); return out; };
  // a 64-bit hash of a string, as 16 hex digits (two 32-bit lanes, each a murmur-style mix)
  function hash64(s) {
    let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const hex = n => (n >>> 0).toString(16).padStart(8, '0');
    return hex(h2) + hex(h1);
  }

  // ---------- the built Atlas (filled by build(), from the last world pass) ----------
  const A = { places: [], byId: {}, grid: null, fixed: null, inst: {}, problems: [], facts: {}, hash: null, built: false };
  const OVER = 'over';
  const isHouse = map => typeof map === 'string' && (map === 'house' || map.startsWith('house:'));
  const inRect = (r, tx, ty) => tx >= r[0] && tx <= r[2] && ty >= r[1] && ty <= r[3];

  function build() {
    const places = [], problems = [], byId = {};
    const add = p => { if (byId[p.id]) { problems.push('two places are called ' + p.id); return null; } p.i = places.length; places.push(p); byId[p.id] = p; return p; };
    const base = (id, name, sub, kind, map) => ({ i: -1, id, name: String(name || id), sub: String(sub || ''), kind, map, combat: 'single', pri: 0, rects: [], spawn: null, call: null, pvp: false, safe: false, loose: false, of: null });
    const I = window.INSTANCES, ids = I && I.list ? I.list() : [];
    // an instance's own region sits at REGIONS[0] while the knight is inside it: that one is the instance, not a region
    const instNames = new Set(ids.map(id => (I.get(id) || {}).name));
    const regs = REGIONS.filter(r => !instNames.has(r.name));
    regs.forEach((r, k) => { const p = add(base(slug(r.name), r.name, r.sub, 'region', OVER)); if (p) { p.pri = 1000 - k; p.rects.push([r.x0, r.y0, r.x1, r.y1]); } });
    for (const id of ids) {
      const d = I.get(id); if (!d) continue;
      const p = add(base(id, d.name, d.sub, 'instance', id)); if (!p) continue;
      p.pri = 1000; p.rects.push([0, 0, d.w - 1, d.h - 1]); p.spawn = Array.isArray(d.entry) ? [d.entry[0], d.entry[1]] : null;
      if (d.boss) p.boss = true;
    }
    for (const r of ATLAS_RULES) {
      let p = byId[r.id];
      if (!p) {
        if (r.kind !== 'area' && r.kind !== 'reserved') { problems.push('a rule names ' + r.id + ', which is no region or instance'); continue; }
        const parent = r.of ? byId[r.of] : null;
        if (r.kind === 'area' && !parent) { problems.push('the area ' + r.id + ' is part of ' + r.of + ', which is no place'); continue; }
        p = add(base(r.id, parent ? parent.name : r.id, parent ? parent.sub : '', r.kind, parent ? parent.map : OVER)); if (!p) continue;
        p.of = parent ? parent.id : null; p.pri = AREA_PRI;
      }
      if (r.combat) p.combat = r.combat;
      if (typeof r.pri === 'number') p.pri = r.pri;
      if (r.rects) for (const q of r.rects) p.rects.push(q.slice(0, 4));
      if (r.spawn) p.spawn = r.spawn.slice(0, 2);
      if (r.call) p.call = r.call;
      for (const f of ['pvp', 'safe', 'loose']) if (typeof r[f] === 'boolean') p[f] = r[f];
    }
    // the overworld grid: every place painted lowest priority first, so the highest one owns each tile
    const grid = new Uint8Array(MAP_W * MAP_H).fill(255);
    const painted = places.filter(p => p.map === OVER && p.kind !== 'reserved').sort((a, b) => a.pri - b.pri || a.i - b.i);
    for (const p of painted) for (const r of p.rects) {
      const x0 = Math.max(0, r[0]), y0 = Math.max(0, r[1]), x1 = Math.min(MAP_W - 1, r[2]), y1 = Math.min(MAP_H - 1, r[3]);
      for (let y = y0; y <= y1; y++) grid.fill(p.i, y * MAP_W + x0, y * MAP_W + x1 + 1);
    }
    // the boss calls, from the boss files themselves: an overworld call is on the place under its `near` tile
    const calls = HOOKS.bossCall || {};
    for (const cid of Object.keys(calls).sort()) {
      const c = calls[cid]; if (!c) continue;
      const p = c.map === OVER ? (Array.isArray(c.near) ? places[grid[c.near[1] * MAP_W + c.near[0]]] : null) : byId[c.map];
      if (p && !p.call) p.call = cid;
      if (p && p.kind === 'instance') p.boss = true;
    }
    // FIXED_SOLID on the overworld, from the world as generated
    const fixedIds = new Set(FIXED_TILES.map(n => T[n]).filter(v => v !== undefined));
    const fixed = new Uint8Array(MAP_W * MAP_H);
    for (let i = 0; i < fixed.length; i++) {
      const t = map[i]; if (!fixedIds.has(t)) continue;
      const p = places[grid[i]];
      if (t === T.HWALL && p && (p.loose || (p.of && byId[p.of] && byId[p.of].loose))) continue;
      fixed[i] = 1;
    }
    // generateWorld makes every NPC's own tile walkable after the passes: never count one
    for (const n of NPCS) if (n.x >= 0 && n.y >= 0 && n.x < MAP_W && n.y < MAP_H) fixed[n.y * MAP_W + n.x] = 0;
    // each instance's mask from its built tiles (the island is every knight's own and is never checked)
    const inst = {};
    for (const id of ids) {
      const d = I.get(id); if (!d || !d.tiles || id === 'house') continue;
      const m = new Uint8Array(d.w * d.h);
      for (let i = 0; i < m.length; i++) if (fixedIds.has(d.tiles[i])) m[i] = 1;
      inst[id] = { w: d.w, h: d.h, mask: m };
    }
    // what the self-tests read later: the spawn tiles as the world made them (the suite changes tiles as it goes)
    const facts = { spawnOk: {}, worldPasses: HOOKS.world.length };
    for (const p of places) if (p.spawn && p.map === OVER) facts.spawnOk[p.id] = !SOLID.has(map[p.spawn[1] * MAP_W + p.spawn[0]]);
    for (const p of places) if (p.spawn && p.map !== OVER) { const d = I.get(p.map); facts.spawnOk[p.id] = !!d && !SOLID.has(d.tiles[p.spawn[1] * d.w + p.spawn[0]]); }
    for (const p of places) if (!ID_RE.test(p.id)) problems.push('the id ' + JSON.stringify(p.id) + ' is not a plain lower-case id');
    A.places = places; A.byId = byId; A.grid = grid; A.fixed = fixed; A.inst = inst; A.problems = problems; A.facts = facts; A.built = true;
    A.hash = hash64(JSON.stringify(judged()));
    return A;
  }

  // what the world judges by, in a fixed order: this is what hash() covers
  function judged() {
    const inst = {};
    for (const id of Object.keys(A.inst).sort()) inst[id] = [A.inst[id].w, A.inst[id].h, bitRuns(A.inst[id].mask)];
    return [ATLAS_V, MAP_W, MAP_H, TILE, A.places.map(p => [p.id, p.kind, p.map, p.combat, p.pri, p.rects, p.pvp, p.safe]), runs(A.grid), bitRuns(A.fixed), inst];
  }

  // ---------- lookups ----------
  const get = id => A.byId[id] || null;
  function place(mapId, tx, ty) {
    if (!A.built) return null;
    const m = mapId || OVER;
    if (m === OVER) return (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) ? (A.places[A.grid[ty * MAP_W + tx]] || null) : null;
    const p = A.byId[isHouse(m) ? 'house' : m];
    if (!p || p.kind !== 'instance') return null;
    return inRect(p.rects[0], tx, ty) ? p : null;
  }
  const at = (tx, ty) => place(OVER, tx, ty);
  const zoneAt = (mapId, tx, ty) => { const p = place(mapId, tx, ty); return p ? p.id : null; };
  const combatAt = (mapId, tx, ty) => { const p = place(mapId, tx, ty); return p ? (p.safe ? 'safe' : p.combat) : null; };
  // a knight or monster { x, y, map? } in pixels stands on that place (or on an area of it)
  const inside = (id, k) => { if (!k) return false; const p = place(k.map || OVER, Math.floor(k.x / TILE), Math.floor(k.y / TILE)); return !!p && (p.id === id || p.of === id); };
  const spawn = id => { const p = get(id); return p && p.spawn ? p.spawn.slice() : null; };
  function solidAt(mapId, tx, ty) {
    const m = mapId || OVER;
    if (m === OVER) { if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true; return !!(A.fixed && A.fixed[ty * MAP_W + tx]); }
    const q = A.inst[m]; if (!q) return false;
    if (tx < 0 || ty < 0 || tx >= q.w || ty >= q.h) return true;
    return !!q.mask[ty * q.w + tx];
  }

  // ---------- what tools/atlas.mjs writes (online/src/atlas.json) ----------
  function exportAtlas() {
    if (!A.built) return null;
    const keep = p => { const o = {}; for (const k of ['i', 'id', 'name', 'sub', 'kind', 'map', 'combat', 'pri', 'rects', 'spawn', 'call', 'pvp', 'safe', 'loose', 'of']) o[k] = p[k]; return o; };
    const fixed = { over: bitRuns(A.fixed) };
    for (const id of Object.keys(A.inst).sort()) fixed[id] = { w: A.inst[id].w, h: A.inst[id].h, runs: bitRuns(A.inst[id].mask) };
    const I = window.INSTANCES, doors = {};
    for (const id of (I && I.list ? I.list() : [])) { const d = I.get(id); doors[id] = { door: d.door || null, step: d.step || null, entry: d.entry || null, exit: d.exit || null }; }
    const calls = {};
    for (const cid of Object.keys(HOOKS.bossCall || {}).sort()) {
      const c = HOOKS.bossCall[cid]; if (!c) continue;
      const p = A.places.find(q => q.call === cid);
      calls[cid] = { map: c.map, near: c.near || null, type: c.type || null, place: p ? p.id : null };
    }
    return {
      v: ATLAS_V, hash: A.hash, MAP_W, MAP_H, TILE, places: A.places.map(keep), grid: runs(A.grid), fixed,
      spawns: MONSTER_SPAWNS.map(s => [s.type, s.tx, s.ty, !!s.camp]), doors, calls, speed: Object.assign({}, SPEED_CAP, { max: SPEED_MAX }),
    };
  }

  window.ATLAS = {
    get places() { return A.places; }, get, place, at, zoneAt, combatAt, inside, spawn, solidAt,
    hash: () => A.hash, export: exportAtlas, build, built: () => A.built, problems: () => A.problems.slice(), facts: () => A.facts,
    RULES: ATLAS_RULES, FIXED_TILES, SPEED_CAP, SPEED_MAX, V: ATLAS_V, slug, runs, bitRuns, hash64,
  };
}

// ============================================================================
// THE ATLAS FRAMES — every place named once, so the Great Spread (260x180 -> 400x280) is one table, not 2,000 literals
// (the spread spec, §8; Stage 0). Nothing in the game reads these yet except the self-tests at the end of this block:
// Stages 1-3 rewrite each file's coordinates as reads of a frame, and Stage 4a moves the anchors. Until then every
// frame is the identity, the world mapping is the identity and every pin's offset is 0, so nothing on screen moves.
//
//   ATLAS.ANCHORS[id]  { box: [x0,y0,x1,y1] (old map, inclusive), at: [x,y] (where the box's top-left is now),
//                        to: [x,y] (the §2 top-left at the spread), kind: 'place', guard }    a place that moves rigidly
//                      { box: null, newBox: [...] (the 400x280 plan), kind: 'reserved' }     a new place, live from 4a
//   ATLAS.PORTS[id]    [anchorId, x, y]: a named point in that anchor's OLD coordinates (a door, a gate, a road end);
//                      ['new', x, y]: a point of a new place, in the 400x280 plan's coordinates (live from 4a)
//   ATLAS.TRACKS[id]   today's road, path, river and node polylines; each point ['port', id] | ['w', x, y] | [anchorId, x, y]
//   ATLAS.WORLD        { xs, ys }: piecewise-linear, monotone breakpoints [old, new] of the stretched land between places
//   ATLAS.PINS         where a rigid place feature must meet a stretched world seam (§3)
//
//   const F = ATLAS.frame('hollowford')   F.x(v) F.y(v) (exact, reals allowed), F.p(x, y) -> [x, y], F.pt({x, y}),
//                                          F.pts(list), F.rect({x0, y0, x1, y1}), F.box([x0, y0, x1, y1]),
//                                          F.ix(v) F.iy(v) (new to old), F.dx, F.dy, F.inOld(x, y); pixels: F.x(112) * TILE
//   const W = ATLAS.world                  the same, real-valued; W.tx/W.ty rounded; W.ix/W.iy the inverse; W.pin(seam, v, along)
//   ATLAS.port(id) ATLAS.box(id) ATLAS.track(id) ATLAS.guards() ATLAS.anchorOf(x, y) ATLAS.oldToNew(x, y) ATLAS.oldToNewWorld(x, y)
//   ATLAS.frameProblems() ATLAS.strict()
// oldToNew and oldToNewWorld are for the save migration and the tools ONLY, never for game code: game code names its frame.
// None of this is in ATLAS.export() or ATLAS.hash() (§7: anchors and ports join export() in Stage 4a), so atlas.json and
// the world's hash do not move.
// ============================================================================
{
  const A = window.ATLAS;
  const PLAN_W = 400, PLAN_H = 280;   // the map the spread makes (§1)

  // ---------- the anchors: §2 (old box, and the top-left it moves to) and §4 (new places, reserved until 4a) ----------
  // A literal belongs to the place it sits in on the old map; boxes may overlap and the smallest box wins (tools/anchor-of.mjs).
  const ANCHORS = {
    cave:          { box: [0, 0, 30, 17],      to: [0, 0] },       // pinned at the origin: instances overlay the top-left
    quarry:        { box: [44, 0, 72, 16],     to: [78, 4] },      // widened to take the dozer spawn 70,8 and the cliff course
    signpost:      { box: [62, 24, 68, 30],    to: [102, 39] },
    pond:          { box: [34, 28, 50, 46],    to: [63, 49] },
    drill_field:   { box: [51, 40, 63, 51],    to: [108, 59] },
    thistledown:   { box: [70, 12, 141, 61],   to: [127, 31] },    // to y 61 for the south pond
    camp:          { box: [142, 17, 161, 48],  to: [227, 35] },
    dock:          { box: [156, 8, 171, 20],   to: [259, 17] },
    gull_isle:     { box: [168, 3, 188, 23],   to: [278, 8] },
    ironclad_isle: { box: [174, 37, 199, 63],  to: [286, 65] },
    far_shore:     { box: [200, 0, 259, 96],   to: [318, 3] },
    redcut:        { box: [200, 97, 259, 179], to: [323, 185] },
    graveyard:     { box: [6, 63, 19, 73],     to: [14, 101] },    // widened to take the Agility 18 scarp steps
    deepholm_rock: { box: [2, 72, 26, 94],     to: [11, 118] },
    wren:          { box: [25, 73, 35, 83],    to: [45, 117] },
    stone_circle:  { box: [54, 82, 66, 92],    to: [85, 127] },
    watchtower:    { box: [90, 76, 100, 86],   to: [138, 94] },    // becomes the Old Bridge's ruined tower
    hollowford:    { box: [120, 59, 160, 96],  to: [206, 112] },
    warden:        { box: [50, 90, 80, 108],   to: [98, 143] },
    ash_shrine:    { box: [82, 98, 92, 108],   to: [138, 155] },
    fang_lair:     { box: [0, 100, 44, 140],   to: [10, 167] },
    canopy:        { box: [119, 99, 135, 105], to: [205, 173] },
    sylvaris:      { box: [124, 108, 168, 137], to: [215, 208] },
    // §4: new and reserved places, in the 400x280 plan's coordinates
    old_bridge:      { newBox: [128, 86, 146, 102] },
    millbrook:       { newBox: [78, 78, 96, 94] },
    saltmere:        { newBox: [250, 64, 268, 80] },
    crossroads_inn:  { newBox: [152, 116, 168, 128] },
    beacon_hills:    { newBox: [112, 4, 142, 24] },
    hunters_lodge:   { newBox: [100, 104, 112, 114] },
    outpost_north:   { newBox: [212, 66, 222, 74] },
    outpost_south:   { newBox: [232, 98, 242, 106] },
    bandit_hills:    { newBox: [250, 148, 274, 170] },
    skypier:         { newBox: [160, 8, 174, 22] },
    wreck_rock:      { newBox: [278, 112, 288, 122] },
    brightwater:     { newBox: [366, 136, 392, 164] },
    ash_wastes:      { newBox: [0, 217, 159, 279] },
    sylvaris_growth: { newBox: [205, 198, 270, 250] },     // kept free for the growing Sylvaris
  };
  const GUARD = 3;   // the ring round every place that 39, 92, 93-roads and placeAction keep clear (ATLAS.guards())
  for (const id in ANCHORS) {
    const a = ANCHORS[id];
    if (a.box) Object.assign(a, { at: [a.box[0], a.box[1]], kind: 'place', guard: GUARD });   // Stage 0: at = the old top-left (identity)
    else Object.assign(a, { box: null, kind: 'reserved', guard: GUARD });
  }
  // places that may lie inside another (§4 spacing): [inner, outer]
  const NESTED = [['watchtower', 'old_bridge'], ['sylvaris', 'sylvaris_growth']];

  // ---------- the ports (~100): doors, gates, road ends and named spots ----------
  const PORTS = {
    'cave.spawn': ['cave', 4, 7], 'cave.sword': ['cave', 11, 7], 'cave.mouth': ['cave', 21, 7], 'cave.axe_stump': ['cave', 23, 9],
    'cave.death_house': ['cave', 25, 10], 'cave.board': ['cave', 24, 6], 'spider_den.door': ['cave', 22, 3], 'spider_den.step': ['cave', 23, 3],
    'quarry.shaft': ['quarry', 56, 6], 'quarry.shaft_step': ['quarry', 56, 7], 'quarry.shrine': ['quarry', 62, 6], 'quarry.shrine_step': ['quarry', 62, 7],
    'quarry.cart': ['quarry', 54, 13], 'quarry.spur': ['quarry', 54, 14], 'quarry.dozer_spawn': ['quarry', 70, 8],
    'signpost.sign': ['signpost', 65, 27],
    'pond.centre': ['pond', 43, 36], 'pond.stones_n': ['pond', 43, 31], 'pond.stones_s': ['pond', 43, 40], 'pond.outflow': ['pond', 50, 37], 'pond.landing': ['pond', 45, 29],
    'thistledown.origin': ['thistledown', 84, 13], 'thistledown.square': ['thistledown', 112, 33], 'thistledown.fountain': ['thistledown', 112, 35],
    'thistledown.duke': ['thistledown', 112, 49], 'thistledown.castle': ['thistledown', 104, 42], 'thistledown.west_gate': ['thistledown', 85, 32],
    'thistledown.east_gate': ['thistledown', 140, 32], 'thistledown.board': ['thistledown', 105, 27], 'thistledown.house_portal': ['thistledown', 117, 17],
    'thistledown.house_portal_step': ['thistledown', 117, 18], 'thistledown.rail': ['thistledown', 119, 27], 'thistledown.stall': ['thistledown', 116, 28],
    'thistledown.dozer_bay': ['thistledown', 96, 43], 'thistledown.agility_gate': ['thistledown', 87, 50], 'thistledown.forge': ['thistledown', 92, 37],
    'thistledown.anvil': ['thistledown', 94, 38], 'thistledown.brazier': ['thistledown', 119, 38], 'thistledown.death_house': ['thistledown', 133, 48],
    'thistledown.west_lane_n': ['thistledown', 84, 33], 'thistledown.west_lane_s': ['thistledown', 84, 60], 'thistledown.blood_portal': ['thistledown', 129, 21],
    'camp.west_gap': ['camp', 147, 30], 'camp.walker': ['camp', 152, 30], 'camp.cage': ['camp', 148, 34], 'camp.climb': ['camp', 158, 30],
    'camp.shed_door': ['camp', 147, 44], 'camp.shed_step': ['camp', 148, 44], 'camp.dozer_spawn': ['camp', 146, 38], 'camp.south': ['camp', 153, 40],
    'dock.planks': ['dock', 164, 14], 'dock.land': ['dock', 163, 14], 'dock.boat': ['dock', 167, 14], 'dock.boat2': ['dock', 170, 13],
    'gull_isle.pete': ['gull_isle', 181, 14], 'ironclad_isle.hull': ['ironclad_isle', 188, 46],
    'far_shore.strait': ['far_shore', 200, 30], 'far_shore.landing': ['far_shore', 206, 30], 'far_shore.city_gate': ['far_shore', 212, 30],
    'far_shore.lab_door': ['far_shore', 247, 41], 'far_shore.lab_step': ['far_shore', 247, 42], 'far_shore.blood_portal': ['far_shore', 218, 43],
    'redcut.mouth': ['redcut', 215, 105], 'redcut.marlow': ['redcut', 222, 152], 'redcut.hux': ['redcut', 233, 156],
    'graveyard.grave': ['graveyard', 12, 70], 'graveyard.crypt': ['graveyard', 13, 70], 'graveyard.crypt_step': ['graveyard', 14, 70],
    'graveyard.steps': ['graveyard', 13, 64], 'graveyard.gate': ['graveyard', 13, 72],
    'wren.hut': ['wren', 28, 76], 'wren.wren': ['wren', 30, 78], 'wren.door': ['wren', 30, 80],
    'stone_circle.centre': ['stone_circle', 60, 87], 'watchtower.chest': ['watchtower', 95, 81],
    'hollowford.square': ['hollowford', 140, 80], 'hollowford.heart': ['hollowford', 140, 76], 'hollowford.hatch': ['hollowford', 147, 70],
    'hollowford.barrelbeast': ['hollowford', 140, 86], 'hollowford.board': ['hollowford', 139, 78], 'hollowford.tam': ['hollowford', 126, 88],
    'hollowford.guild_hall': ['hollowford', 150, 66], 'hollowford.north': ['hollowford', 140, 68], 'hollowford.south': ['hollowford', 141, 96],
    'hollowford.west': ['hollowford', 120, 77], 'hollowford.east': ['hollowford', 158, 82], 'hollowford.blood_portal': ['hollowford', 154, 88],
    'warden.gate': ['warden', 60, 96], 'warden.post': ['warden', 60, 95], 'warden.dunstan_hut': ['warden', 64, 98], 'warden.dunstan': ['warden', 67, 104],
    'warden.node': ['warden', 66, 100], 'warden.turn': ['warden', 64, 103], 'warden.east_wall': ['warden', 100, 96],
    'ash_shrine.shrine': ['ash_shrine', 87, 103],
    'fang_lair.gate': ['fang_lair', 18, 108], 'fang_lair.circle': ['fang_lair', 18, 117], 'fang_lair.approach': ['fang_lair', 20, 105], 'fang_lair.node': ['fang_lair', 36, 105],
    'canopy.door': ['canopy', 121, 101], 'sylvaris.gap': ['sylvaris', 137, 114], 'sylvaris.node': ['sylvaris', 133, 112],
    // §4/§5, in the 400x280 plan
    'old_bridge.span': ['new', 136, 93], 'old_bridge.south': ['new', 140, 98], 'goblin_road.bridge': ['new', 228, 92],
    'millbrook.gate': ['new', 86, 80], 'saltmere.gate': ['new', 252, 74], 'saltmere.huts': ['new', 256, 72], 'crossroads_inn.yard': ['new', 160, 122],
    'beacon_hills.tower_w': ['new', 116, 12], 'beacon_hills.tower_n': ['new', 128, 8], 'beacon_hills.tower_e': ['new', 139, 15],
    'hunters_lodge.door': ['new', 112, 110], 'outpost_north.road': ['new', 217, 70], 'outpost_south.road': ['new', 236, 100],
    'bandit_hills.toll': ['new', 262, 158], 'skypier.pad': ['new', 167, 20],
  };
  // ports that lie outside their own box on purpose: relative geometry that moves with the place (one line of reason each)
  const PORT_REL = {
    'warden.east_wall': 'the Ashfields/Jungle wall is the old x 100 line; it moves with the warden frame (the jungle_west pin)',
  };

  // ---------- the tracks: today's values (no readers yet); each point a port, a world point or an anchor point ----------
  // 39-worldblend's and 92-worldshape's ROADS (11 polylines), the NODES (92's 15; 39 reads the first 9), 39's RIVER,
  // 27-dragons' PATH and FARM_PATH, 25-elves' PATH, 24-dwarves' shaft lane and 26-boats' dock lanes. Points are tagged by
  // the smallest old box that holds them (tools/anchor-of.mjs); the river is the stretched world's (§2), all 'w'.
  const P = id => ['port', id], w = (x, y) => ['w', x, y];
  const TRACKS = {
    road_cave: [P('cave.mouth'), P('signpost.sign'), ['thistledown', 84, 32]],
    road_quarry_spur: [P('signpost.sign'), P('quarry.spur')],
    road_wolfwood: [['thistledown', 84, 32], P('thistledown.west_lane_s'), w(60, 70), ['wren', 31, 76]],
    road_camp: [['thistledown', 141, 32], ['camp', 150, 30]],
    road_east_lane: [['thistledown', 141, 14], ['thistledown', 141, 32]],
    road_dock_lane: [['thistledown', 141, 14], ['dock', 161, 14]],
    road_hollowford: [['camp', 150, 39], w(150, 50), w(146, 58), ['hollowford', 141, 64], P('hollowford.north')],
    path_ash: [['warden', 60, 94], ['warden', 60, 100], ['warden', 56, 104], w(48, 105), P('fang_lair.node')],
    path_farm: [['warden', 60, 100], ['warden', 63, 103], ['warden', 69, 103]],
    path_jungle: [P('hollowford.south'), w(141, 101), w(136, 105), ['sylvaris', 132, 109], P('sylvaris.node')],
    shaft_lane: [['quarry', 54, 13], ['quarry', 54, 8], ['quarry', 55, 8], ['quarry', 55, 5], ['quarry', 57, 5]],
    nodes: [P('cave.mouth'), P('signpost.sign'), P('thistledown.west_gate'), P('dock.planks'), P('hollowford.heart'), P('warden.node'), P('fang_lair.node'),
      P('hollowford.south'), P('quarry.shaft'), P('wren.wren'), P('graveyard.grave'), ['pond', 38, 36], P('camp.walker'), P('sylvaris.node'), P('thistledown.square')],
    river: [w(44, 38), w(47, 44), w(48, 50), w(52, 56), w(62, 58), w(72, 60), w(84, 60), w(94, 61), w(102, 59), w(110, 62), w(118, 60), w(124, 62),
      w(128, 61), w(134, 60), w(140, 59), w(146, 57), w(154, 53), w(178, 47)],
  };

  // ---------- the stretched world, and the seam pins (§3) ----------
  const WORLD = { xs: [[0, 0], [MAP_W - 1, MAP_W - 1]], ys: [[0, 0], [MAP_H - 1, MAP_H - 1]] };   // identity until Stage 4a
  // each pinned seam is offset by (port's new place - where the stretch puts its old place), tapered to 0 over 12 tiles
  // either side; `axis` is the coordinate the seam is moved in, `along` the one it runs along
  const PINS = [
    { id: 'rim', seam: 'the Ashfields rim row (37 row 95, 92 footWA, 93 band)', axis: 'y', ports: ['warden.gate'] },
    { id: 'gw_steps', seam: 'the Goblin Fields / Wolfwood scarp (92 sGW)', axis: 'y', ports: ['graveyard.steps'] },
    { id: 'giants', seam: 'the Wolfwood / Jungle wall (92 sWJ)', axis: 'y', ports: ['hollowford.south'] },
    { id: 'jungle_west', seam: 'the Ashfields / Jungle wall (37 x 100, 39 jungle column)', axis: 'x', ports: ['warden.east_wall'] },
    { id: 'river', seam: 'the river polyline (TRACKS.river)', axis: 'y', ports: ['old_bridge.span', 'goblin_road.bridge', 'pond.outflow'] },
    { id: 'strait', seam: 'the 39 strait and Far Shore coast loops', axis: 'x', ports: ['far_shore.strait'] },
    { id: 'sea', seam: "the Grey Sea's west coast (39 COVES)", axis: 'x', ports: ['dock.planks'] },   // + saltmere.jetty when Saltmere is drawn (Stage 5b)
  ];
  const TAPER = 12;

  // ---------- piecewise-linear maps ----------
  const pw = (pts, v) => {   // pts: [[from, to], ...] increasing; beyond the ends, the end segment's slope carries on
    let k = 0; while (k < pts.length - 2 && v > pts[k + 1][0]) k++;
    const [a0, b0] = pts[k], [a1, b1] = pts[k + 1];
    return b0 + (v - a0) * (b1 - b0) / (a1 - a0);
  };
  const inv = pts => pts.map(([a, b]) => [b, a]);
  const monotone = pts => Array.isArray(pts) && pts.length >= 2 && pts.every((q, k) => k === 0 || (q[0] > pts[k - 1][0] && q[1] > pts[k - 1][1]));

  // ---------- the strict report: a frame point far outside its own place is logged with where it was written ----------
  // One entry per call site + anchor + point, with a hit count: a line that runs every tick is one entry, not the whole
  // log, and the cap (STRICT_MAX) counts distinct entries. Read by tools/headless.js after every self-test and --play run
  // and by tools/fingerprint.mjs; both fail on an entry docs/spread/strict-allow.json does not list.
  const STRICT = new Map(), STRICT_MAX = 200;
  // the line that called the frame: the stack below where(), strictPoint() and the frame method itself
  const where = () => { const s = String(new Error().stack || '').split('\n').filter(l => /^\s*at /.test(l)).map(l => l.trim()); return s[3] || s[s.length - 1] || '?'; };
  const strictPoint = (id, a, x, y) => {
    if (!a.box) return;
    const m = a.guard + 12, b = a.box;
    if (x >= b[0] - m && x <= b[2] + m && y >= b[1] - m && y <= b[3] + m) return;
    const at = where(), key = at + '|' + id + '|' + x + '|' + y, e = STRICT.get(key);
    if (e) e[4]++; else if (STRICT.size < STRICT_MAX) STRICT.set(key, [at, id, x, y, 1]);
  };

  // ---------- frames ----------
  // one object per anchor, made once: every method reads the anchor's `at` when it runs, so moving an anchor moves them all
  function mk(id, a) {
    const dx = () => a.at[0] - a.box[0], dy = () => a.at[1] - a.box[1];
    const x = v => v + dx(), y = v => v + dy();
    const p = (px, py) => { strictPoint(id, a, px, py); return [x(px), y(py)]; };
    return {
      id, x, y, p,
      tx: v => Math.round(x(v)), ty: v => Math.round(y(v)),
      pt: o => { strictPoint(id, a, o.x, o.y); return Object.assign({}, o, { x: x(o.x), y: y(o.y) }); },
      pts: list => { const out = []; for (const q of list) { const arr = Array.isArray(q), qx = arr ? q[0] : q.x, qy = arr ? q[1] : q.y; strictPoint(id, a, qx, qy); out.push(arr ? [x(qx), y(qy)] : Object.assign({}, q, { x: x(qx), y: y(qy) })); } return out; },
      rect: r => { strictPoint(id, a, r.x0, r.y0); strictPoint(id, a, r.x1, r.y1); return Object.assign({}, r, { x0: x(r.x0), y0: y(r.y0), x1: x(r.x1), y1: y(r.y1) }); },
      box: b => { strictPoint(id, a, b[0], b[1]); strictPoint(id, a, b[2], b[3]); return [x(b[0]), y(b[1]), x(b[2]), y(b[3])]; },
      ix: v => v - dx(), iy: v => v - dy(),
      get dx() { return dx(); }, get dy() { return dy(); },
      inOld: (ox, oy) => ox >= a.box[0] && ox <= a.box[2] && oy >= a.box[1] && oy <= a.box[3],
      get newBox() { return [x(a.box[0]), y(a.box[1]), x(a.box[2]), y(a.box[3])]; },
    };
  }
  const FRAMES = {};
  for (const id in ANCHORS) if (ANCHORS[id].kind === 'place') FRAMES[id] = mk(id, ANCHORS[id]);
  function frame(id) { const f = FRAMES[id]; if (!f) throw new Error('ATLAS.frame: no place anchor ' + JSON.stringify(id)); return f; }

  // the world: the same API, real-valued, through WORLD's breakpoints
  const W = {
    id: 'world',
    x: v => pw(WORLD.xs, v), y: v => pw(WORLD.ys, v),
    tx: v => Math.round(pw(WORLD.xs, v)), ty: v => Math.round(pw(WORLD.ys, v)),
    ix: v => pw(inv(WORLD.xs), v), iy: v => pw(inv(WORLD.ys), v),
    p: (x, y) => [W.x(x), W.y(y)],
    pt: o => Object.assign({}, o, { x: W.x(o.x), y: W.y(o.y) }),
    pts: list => list.map(q => Array.isArray(q) ? [W.x(q[0]), W.y(q[1])] : Object.assign({}, q, { x: W.x(q.x), y: W.y(q.y) })),
    rect: r => Object.assign({}, r, { x0: W.x(r.x0), y0: W.y(r.y0), x1: W.x(r.x1), y1: W.y(r.y1) }),
    box: b => [W.x(b[0]), W.y(b[1]), W.x(b[2]), W.y(b[3])],
    get dx() { return 0; }, get dy() { return 0; },
    inOld: (x, y) => x >= 0 && y >= 0 && x <= WORLD.xs[WORLD.xs.length - 1][0] && y <= WORLD.ys[WORLD.ys.length - 1][0],
    // a pinned seam's value v (new coordinates) at `along` (new coordinates): passes exactly through each of its ports
    pin(seamId, v, along) {
      const pin = PINS.find(q => q.id === seamId); if (!pin) throw new Error('ATLAS.world.pin: no seam ' + JSON.stringify(seamId));
      let off = 0;
      for (const pid of pin.ports) {
        const o = PORTS[pid], n = port(pid); if (!o || !n) continue;
        const ax = pin.axis === 'y' ? 1 : 0, al = 1 - ax;
        const oldAt = o[0] === 'new' ? null : o[1 + ax];
        if (oldAt === null) continue;   // a port of a new place has no old position: it pins from Stage 4a
        const delta = n[ax] - (ax ? W.y(oldAt) : W.x(oldAt)), d = Math.abs(along - n[al]);
        if (d < TAPER) off += delta * (1 - d / TAPER);
      }
      return v + off;
    },
  };

  // ---------- helpers ----------
  const live = id => !!ANCHORS[id] && ANCHORS[id].kind === 'place';
  function port(id) {
    const q = PORTS[id]; if (!q) return null;
    if (q[0] === 'new') { const pre = id.split('.')[0]; return !ANCHORS[pre] || live(pre) ? [q[1], q[2]] : null; }   // a reserved place's ports are live from 4a
    const f = FRAMES[q[0]]; return f ? [f.x(q[1]), f.y(q[2])] : null;
  }
  const box = id => live(id) ? FRAMES[id].newBox : null;
  const area = b => (b[2] - b[0] + 1) * (b[3] - b[1] + 1);
  // the smallest place box (OLD map) holding the point; ties are listed for a human
  function anchorOf(x, y) {
    let best = null, ties = [];
    for (const id in ANCHORS) {
      const a = ANCHORS[id]; if (a.kind !== 'place') continue;
      const b = a.box; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (!best || area(b) < area(ANCHORS[best].box)) { best = id; ties = []; } else if (area(b) === area(ANCHORS[best].box)) ties.push(id);
    }
    return best ? { id: best, ties, holders: Object.keys(ANCHORS).filter(id => ANCHORS[id].kind === 'place' && FRAMES[id].inOld(x, y)) } : null;
  }
  // the migration's and the tools' mappings, never game code's
  function oldToNew(x, y) { const h = anchorOf(x, y); return h ? [FRAMES[h.id].x(x), FRAMES[h.id].y(y)] : null; }
  const oldToNewWorld = (x, y) => [W.x(x), W.y(y)];
  function track(id) {
    const t = TRACKS[id]; if (!t) return null;
    return t.map(q => q[0] === 'port' ? port(q[1]) : q[0] === 'w' ? [W.x(q[1]), W.y(q[2])] : FRAMES[q[0]] ? [FRAMES[q[0]].x(q[1]), FRAMES[q[0]].y(q[2])] : null);
  }
  function guards() {
    const out = [];
    for (const id in ANCHORS) { const b = box(id); if (!b) continue; const g = ANCHORS[id].guard; out.push({ id, x0: b[0] - g, y0: b[1] - g, x1: b[2] + g, y1: b[3] + g }); }
    return out;
  }

  // ---------- the load-time self-tests (tables only; 92's corner test runs with the suite) ----------
  const problems = [];
  {
    const inside = (b, W2, H2) => b[0] >= 0 && b[1] >= 0 && b[2] <= W2 - 1 && b[3] <= H2 - 1 && b[0] <= b[2] && b[1] <= b[3];
    const meet = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
    const nested = (i, o) => NESTED.some(([p, q]) => (p === i && q === o) || (p === o && q === i));
    // now: every live box inside the map; two boxes may overlap only while both still sit where the old map put them
    // (§2: old boxes may overlap) or where NESTED allows it
    const now = Object.keys(ANCHORS).filter(live);
    for (const id of now) if (!inside(box(id), MAP_W, MAP_H)) problems.push(id + "'s box lies outside the map");
    const atHome = id => ANCHORS[id].at[0] === ANCHORS[id].box[0] && ANCHORS[id].at[1] === ANCHORS[id].box[1];
    for (let i = 0; i < now.length; i++) for (let j = i + 1; j < now.length; j++)
      if (!(atHome(now[i]) && atHome(now[j])) && !nested(now[i], now[j]) && meet(box(now[i]), box(now[j]))) problems.push(now[i] + ' and ' + now[j] + ' overlap');
    // the plan: every §2 box at its `to` and every §4 box inside 400x280, pairwise disjoint (bar NESTED)
    const plan = {};
    for (const id in ANCHORS) { const a = ANCHORS[id]; plan[id] = a.kind === 'place' ? [a.to[0], a.to[1], a.to[0] + a.box[2] - a.box[0], a.to[1] + a.box[3] - a.box[1]] : a.newBox; }
    const ids = Object.keys(plan);
    for (const id of ids) if (!plan[id] || !inside(plan[id], PLAN_W, PLAN_H)) problems.push(id + "'s planned box lies outside " + PLAN_W + 'x' + PLAN_H);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
      if (plan[ids[i]] && plan[ids[j]] && !nested(ids[i], ids[j]) && meet(plan[ids[i]], plan[ids[j]])) problems.push('the planned ' + ids[i] + ' and ' + ids[j] + ' overlap');
    // ports inside their own anchor's box (old box for a place; the plan's box for a new place)
    for (const pid in PORTS) {
      const [aid, x, y] = PORTS[pid], pre = pid.split('.')[0];
      if (aid === 'new') { const b = ANCHORS[pre] ? plan[pre] : [0, 0, PLAN_W - 1, PLAN_H - 1]; if (!(x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3])) problems.push('port ' + pid + ' lies outside ' + (ANCHORS[pre] ? pre + "'s planned box" : 'the planned map')); continue; }
      if (!live(aid)) { problems.push('port ' + pid + ' names no place anchor ' + aid); continue; }
      if (!FRAMES[aid].inOld(x, y) && !PORT_REL[pid]) problems.push('port ' + pid + ' lies outside ' + aid + "'s box");
    }
    for (const pid in PORT_REL) if (!PORTS[pid]) problems.push('PORT_REL names no port ' + pid);
    // the world is monotone; every pin names real ports; every track point resolves
    if (!monotone(WORLD.xs) || !monotone(WORLD.ys)) problems.push('WORLD is not monotone');
    for (const pin of PINS) for (const pid of pin.ports) if (!PORTS[pid]) problems.push('pin ' + pin.id + ' names no port ' + pid);
    for (const tid in TRACKS) for (const q of TRACKS[tid]) {
      if (q[0] === 'port' ? !PORTS[q[1]] : q[0] !== 'w' && !live(q[0])) problems.push('track ' + tid + ' has a point that names nothing: ' + JSON.stringify(q));
      else if (q[0] !== 'port' && q[0] !== 'w' && !FRAMES[q[0]].inOld(q[1], q[2])) problems.push('track ' + tid + ' point ' + JSON.stringify(q) + ' lies outside ' + q[0] + "'s box");
    }
    if (problems.length) console.error('ATLAS frames: ' + problems.join('; '));
  }

  Object.assign(A, {
    ANCHORS, PORTS, PORT_REL, TRACKS, WORLD, PINS, NESTED, PLAN: { W: PLAN_W, H: PLAN_H },
    frame, world: W, port, box, track, guards, anchorOf, oldToNew, oldToNewWorld,
    frameProblems: () => problems.slice(), strict: () => [...STRICT.values()].map(e => e.slice()),
  });

  // ---------- self-tests ----------
  HOOKS.selfTest.push((check, F, h) => {
    const PF = 'atlas frames: ', strictBefore = new Map(STRICT);   // what the game logged so far: put back after these checks add their own
    check(PF + 'the anchor table is whole: boxes in the map and apart (old boxes may overlap where they still stand), the 400x280 plan apart, every port in its own box, WORLD monotone, every pin and track point naming something real', problems.length === 0, { problems: problems.slice(0, 8) });
    // Stage 0: every frame, the world and every pin are the identity, so nothing on screen can have moved
    const notId = Object.keys(FRAMES).filter(id => { const f = FRAMES[id], a = ANCHORS[id]; return f.dx !== 0 || f.dy !== 0 || f.x(a.box[0] + 0.5) !== a.box[0] + 0.5 || f.iy(f.y(a.box[3])) !== a.box[3]; });
    const wId = [0, 7.25, MAP_W - 1].every(v => W.x(v) === v && W.ix(v) === v) && [0, 3.5, MAP_H - 1].every(v => W.y(v) === v && W.iy(v) === v) && W.tx(12.4) === 12 && W.ty(12.6) === 13;
    const pinsZero = PINS.every(pin => [0, 50, 96, 140].every(al => W.pin(pin.id, 42.5, al) === 42.5));
    check(PF + 'Stage 0: every frame, the world and every seam pin are the identity (frame.x = x, W.x = x, pin offset 0)', notId.length === 0 && wId && pinsZero, { notId, wId, pinsZero });
    // the API's shapes
    const Fh = frame('hollowford'), r = Fh.rect({ x0: 122, y0: 66, x1: 156, y1: 92, name: 'HF' }), pt = Fh.pt({ x: 140, y: 80, label: 'well' });
    const shapes = JSON.stringify(Fh.p(140, 80)) === '[140,80]' && r.name === 'HF' && r.x1 === 156 && pt.label === 'well' && pt.x === 140 &&
      JSON.stringify(Fh.pts([[1, 2], { x: 3, y: 4 }]).map(q => Array.isArray(q) ? q : [q.x, q.y])) === '[[1,2],[3,4]]' && JSON.stringify(Fh.box([1, 2, 3, 4])) === '[1,2,3,4]' && Fh.inOld(120, 59) && !Fh.inOld(119, 59);
    let threw = false; try { frame('nowhere'); } catch (e) { threw = true; }
    check(PF + "a frame answers in every shape the conversions use (p, pt, pts, rect, box, inOld) and keeps a rect's other fields; an unknown place throws", shapes && threw, { shapes, threw });
    // helpers
    const sp = port('thistledown.square'), reserved = port('old_bridge.span'), hfBox = box('hollowford'), g = guards().find(q => q.id === 'hollowford');
    const smallest = anchorOf(134, 60), ow = oldToNew(140, 80), none = oldToNew(60, 70), trackOk = Object.keys(TRACKS).every(id => track(id).every(q => Array.isArray(q) && q.length === 2 && Number.isFinite(q[0]) && Number.isFinite(q[1])));
    check(PF + 'port, box, guards, anchorOf (the smallest box wins), oldToNew (null on open land) and every track resolve; a reserved place has no box or port before 4a',
      JSON.stringify(sp) === '[112,33]' && reserved === null && box('old_bridge') === null && JSON.stringify(hfBox) === '[120,59,160,96]' && g && g.x0 === 117 && g.y1 === 99 &&
      smallest && smallest.id === 'hollowford' && smallest.holders.includes('thistledown') && JSON.stringify(ow) === '[140,80]' && none === null && JSON.stringify(oldToNewWorld(60, 70)) === '[60,70]' && trackOk,
      { sp, reserved, hfBox, g, smallest, ow, none, trackOk });
    // TRACKS hold today's values: the cave road ends where 02-world lays it, and the river is 39's 18 points
    const cave = track('road_cave'), riv = track('river');
    check(PF + "TRACKS hold today's values (the cave road from the cave mouth by the signpost to the lane outside the west gate; 18 river points from the pond to the sea)",
      JSON.stringify(cave) === JSON.stringify([[CAVE_EXIT_X + 1, 7], [SIGN_TILE.x, SIGN_TILE.y], [84, 32]]) && riv.length === 18 && riv[0][0] === 44 && riv[17][0] === 178, { cave, rivN: riv.length });
    // the strict report: a point far outside its own place is logged with where it was written, once per line (a hit count
    // for the rest). Whether the game's own entries are allowed is the runner's question (tools/headless.js and
    // tools/fingerprint.mjs read docs/spread/strict-allow.json), so this check does not ask that the game logged none.
    STRICT.clear(); frame('wren').p(30, 78); frame('wren').p(25 - 15, 83 + 15); const near = STRICT.size === 0;
    const far = () => frame('wren').p(200, 150);
    for (let k = 0; k < 30; k++) far();
    const e = [...STRICT.values()];
    const logged = e.length === 1 && e[0][1] === 'wren' && e[0][2] === 200 && e[0][4] === 30 && /index\.html|game|:\d+/.test(e[0][0]) && !/^at (where|strictPoint|p)\b/.test(e[0][0]);
    STRICT.clear(); for (const [k, v] of strictBefore) STRICT.set(k, v);
    check(PF + 'the strict report logs a frame point far outside its own place (past box + guard + 12) with the line that wrote it, once per line with a hit count (30 calls, one entry), and not a point within reach', near && logged, { near, logged, got: e.slice(0, 3) });
  });
}
