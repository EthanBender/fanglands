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
  const ATLAS_V = 2;   // 2: the Great Spread (400 x 280; export() carries the anchors and the ports)
  const ID_RE = /^[a-z0-9_]{1,40}$/;
  const AREA_PRI = 2000;   // an area beats every region (regions are 1000 - their REGIONS index)
  // "The Fang's Lair" -> fang_lair, "Goblin Camp" -> goblin_camp, "Miller's Pond" -> miller_pond
  const slug = name => String(name || '').toLowerCase().replace(/^the\s+/, '').replace(/['’]s\b/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

  // ---------- the hand table (only where a place differs from the default) ----------
  // { id, kind, of, combat, pri, rects, spawn, call, pvp, safe, loose }
  // Positions are frame reads (the spread spec, §9.1): the frames are defined in the block below, and a rule's rects and
  // spawn are only read when build() runs (the last world pass), so each is a getter.
  const FR = id => window.ATLAS.frame(id), WR = () => window.ATLAS.world;
  const ATLAS_RULES = [
    // multi on the overworld: the gang fights
    // + the camp's ground with the region's box round it: the one rect generateWorld marks camp spawns in (CAMP_GROUND, from
    // x 142) and the Goblin Camp's REGIONS box (from x 145), both 02-world's, read not copied
    { id: 'goblin_camp', combat: 'multi', get rects() { const g = CAMP_GROUND, r = REGIONS.find(q => q.name === 'Goblin Camp'); return [[Math.min(g.x0, r.x0), Math.min(g.y0, r.y0), Math.max(g.x1, r.x1), Math.max(g.y1, r.y1)]]; } },
    { id: 'fang_lair', combat: 'multi' },
    { id: 'hollowford_square', kind: 'area', of: 'hollowford', combat: 'multi', get rects() { return [FR('hollowford').box([130, 70, 150, 90])]; } },   // the cracked well and the Barrelbeast's ground
    // where the green and red dragons sleep: open Ashfields ground, a world rect (whole tiles)
    { id: 'ashfields_dragons', kind: 'area', of: 'ashfields', combat: 'multi', get rects() { const W = WR(), af = REGIONS.find(r => r.name === 'The Ashfields'); return [[W.tx(40), W.ty(110), af ? af.x1 : W.tx(99), W.ty(139)]]; } },   // east as far as 27-dragons' Ashfields box (to the wall on its pin), read, not copied
    { id: 'iron_isle_wreck', kind: 'area', of: 'ironclad_isle', combat: 'multi', get rects() { return [FR('ironclad_isle').box([182, 43, 194, 56])]; } },  // the goblin wreck and its crew
    { id: 'deep_wilderlands', kind: 'reserved', combat: 'multi', pvp: true },                                   // named now, on no tile yet
    // Hollowford is rebuilt in play (31-rebuild, 41-guild): its building walls come and go, so they never count as fixed
    { id: 'hollowford', loose: true },
    // the square by the Great Fountain; safe stays the option the spec keeps off
    { id: 'thistledown', safe: false, get spawn() { return window.ATLAS.port('thistledown.square'); } },
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
    // (a region may name its Atlas id, `atlas`, where its name would slug to another: Castle Brightwater is `brightwater`)
    regs.forEach((r, k) => { const p = add(base(r.atlas || slug(r.name), r.name, r.sub, 'region', OVER)); if (p) { p.pri = 1000 - k; p.rects.push([r.x0, r.y0, r.x1, r.y1]); } });
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
    // a Stage 5 place built as a gang fight says so (markBuilt's `combat`: 86-outposts' rings are multi, as the camp is)
    const built = window.ATLAS && window.ATLAS.BUILT;
    if (built) for (const [id, info] of built) if (info.combat && byId[id]) byId[id].combat = info.combat;
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
    // the frames' anchors (each place's box on this map, a reserved place's plan box) and every named port, from the
    // Stage 4a spread on (§7): the server and the tests read positions from here, never from literals
    const F = window.ATLAS, anchors = {}, ports = {};
    if (F.ANCHORS) for (const id of Object.keys(F.ANCHORS).sort()) { const b = F.box(id); if (b) anchors[id] = { kind: F.ANCHORS[id].kind, box: b.map(v => Math.round(v)) }; }
    if (F.PORTS) for (const id of Object.keys(F.PORTS).sort()) { const q = F.port(id); if (q) ports[id] = [Math.round(q[0]), Math.round(q[1])]; }
    return {
      v: ATLAS_V, hash: A.hash, MAP_W, MAP_H, TILE, places: A.places.map(keep), grid: runs(A.grid), fixed,
      spawns: MONSTER_SPAWNS.map(s => [s.type, s.tx, s.ty, !!s.camp]), doors, calls, speed: Object.assign({}, SPEED_CAP, { max: SPEED_MAX }),
      anchors, ports,
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
// (the spread spec, §8; Stage 0). Stages 1-3 rewrote every file's coordinates as reads of a frame; Stage 4a moved the
// anchors: every place sits at its `to`, the world stretches through WORLD's breakpoints and the map is 400 x 280.
//
//   ATLAS.ANCHORS[id]  { box: [x0,y0,x1,y1] (old map, inclusive), at: [x,y] (where the box's top-left is now),
//                        to: [x,y] (the §2 top-left at the spread), kind: 'place', guard }    a place that moves rigidly
//                      { box: null, newBox: [...] (the 400x280 plan), kind: 'reserved' }     a new place, live from 4a
//   ATLAS.PORTS[id]    [anchorId, x, y]: a named point in that anchor's OLD coordinates (a door, a gate, a road end);
//                      ['new', x, y]: a point of a new place, in the 400x280 plan's coordinates (live from 4a)
//   ATLAS.TRACKS[id]   the road network (§5), the river and the node list; each point ['port', id] | ['n', x, y] (the new
//                      map's own) | ['w', x, y] (an old world point, stretched) | [anchorId, x, y]
//   ATLAS.GROUNDS      the new grounds (the Sound, the east sea, the Grub Fields), in the new map's coordinates
//   ATLAS.SIGNPOSTS    the road nodes that carry a signpost; ATLAS.signText(x, y) is what one says
//   ATLAS.WORLD        { xs, ys }: piecewise-linear, monotone breakpoints [old, new] of the stretched land between places
//   ATLAS.PINS         where a rigid place feature must meet a stretched world seam (§3)
//
//   const F = ATLAS.frame('hollowford')   F.x(v) F.y(v) (exact, reals allowed), F.p(x, y) -> [x, y], F.pt({x, y}),
//                                          F.pts(list), F.rect({x0, y0, x1, y1}), F.box([x0, y0, x1, y1]),
//                                          F.ix(v) F.iy(v) (new to old), F.dx, F.dy, F.inOld(x, y); pixels: F.x(112) * TILE
//   const W = ATLAS.world                  the same, real-valued; W.tx/W.ty rounded; W.ix/W.iy the inverse; W.pin(seam, v, along), W.unpin
//   ATLAS.port(id) ATLAS.box(id) ATLAS.track(id) ATLAS.guards() ATLAS.anchorOf(x, y) ATLAS.oldToNew(x, y) ATLAS.oldToNewWorld(x, y)
//   ATLAS.frameProblems() ATLAS.strict()
// oldToNew and oldToNewWorld are for the save migration and the tools ONLY, never for game code: game code names its frame.
// ATLAS.export() carries the anchors' boxes and the ports since Stage 4a (§7); ATLAS.hash() covers none of this table.
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
    brightwater:     { newBox: [366, 136, 391, 164] },     // x to 391, not 392: the map's outer 8-tile ring (x 392..399) is the east sea's (ADDENDUM C)
    ash_wastes:      { newBox: [0, 217, 159, 279] },
    sylvaris_growth: { newBox: [205, 198, 270, 250] },     // kept free for the growing Sylvaris
    // ADDENDUM A: ground reserved for the two skills built after the spread (the builder's boxes: both pass the spacing
    // test, 25+ tiles from every other place's centre, and lie within 10 tiles of a main road)
    alchemy:         { newBox: [110, 71, 125, 82] },       // the Glasshouse: Goblin Fields, east of Millbrook's bend of the river, beside the Long Road
    necromancy:      { newBox: [66, 106, 81, 119] },       // the Old Barrow: Wolfwood's dark west end, beside the Wolfwood Road
  };
  // the new grounds (§1, §4), in the 400x280 plan's coordinates: REGIONS boxes, and the water 93-spread lays
  const GROUNDS = {
    // the Sound: deep water from the Grey Sea's south shore to the map's foot, so the whole east is ferry-only. x 303..311,
    // nine wide as §1 has it but nine tiles west of §1's 312..320: 90-canyon's red country (the dust, scree and scrub round
    // the Redcut's rim) reaches 14 tiles west of the rim, to x 313, and the Sound must not drown it
    sound:       [303, 140, 311, 279],
    east_sea:    [392, 0, 399, 279],     // the east sea: the map's outer ring on the east (ADDENDUM C keeps x 392..399 for it)
    grub_fields: [312, 100, 391, 279],   // the Grub Fields: the Far Shore's scrub between Grubmarket and the Redcut, east of the Sound (the Redcut's own box wins inside it)
  };
  const GUARD = 3;   // the ring round every place that 39, 92, 93-roads and placeAction keep clear (ATLAS.guards())
  for (const id in ANCHORS) {
    const a = ANCHORS[id];
    if (a.box) Object.assign(a, { at: a.to.slice(), kind: 'place', guard: GUARD });   // Stage 4a: every place at its section-2 top-left
    else Object.assign(a, { box: null, kind: 'reserved', guard: GUARD });
  }
  // places that may lie inside another (§4 spacing): [inner, outer]
  const NESTED = [['watchtower', 'old_bridge'], ['sylvaris', 'sylvaris_growth']];
  // Old boxes overlap in seven places (quarry/thistledown, dock/gull_isle, dock/camp, thistledown/hollowford,
  // graveyard/deepholm_rock, wren/deepholm_rock, warden/stone_circle). "Smallest box wins" can split one thing between two
  // places that move apart at the spread, so a point inside more than one box has an owner only when one is DECIDED:
  // a rect here (each with the reason), or a port at that exact point. Every overlap tile is decided (Stage 3); a new
  // overlap point is refused by tools/anchor-of.mjs and tools/frame-codemod.mjs until a human decides
  // (docs/spread/README.md lists them).
  const OWNERS = [
    { box: [72, 14, 80, 21], id: 'thistledown', why: 'the cow pen 72..80 x 14..21: section 2 lists it under thistledown, not quarry' },
    { box: [128, 59, 140, 61], id: 'thistledown', why: "the south pond and its sandy shore (centre 134,60, 02-world's second pond, drawn in Thistledown's frame): the spec author's decision; section 2 had listed it under both" },
    { box: [170, 12, 171, 14], id: 'gull_isle', why: "Gull Isle's mooring (26-boats LOC.gull: the boat 170,13, the lantern 171,12, the planks 171..172 x 12..14) moves as one with the isle: the spec author's decision" },
    // decided at Stage 3 by the built structure each tile is part of (docs/spread/README.md lists them)
    { box: [156, 17, 159, 20], id: 'camp', why: "the palisade's north wall (PALISADE 156..158,20, drawn in the camp's frame by 02-world and 65-palisade) and the camp's corner inside its line" },
    { box: [160, 17, 161, 20], id: 'dock', why: "the shore east of where the palisade ends, inside the dock's keep-clear (92's DOCKF.box([158, 9, 170, 19])): the dock's beach and water" },
    { box: [168, 8, 169, 20], id: 'dock', why: "the water off the dock's end, where the dock's own boat lies (dock.boat 167,14): the dock's side of the channel to Gull Isle" },
    { box: [170, 8, 171, 20], id: 'gull_isle', why: "the water in the mooring's columns north and south of it (the mooring 170..171 x 12..14 is gull_isle's): the isle's side of the channel" },
    { box: [54, 90, 66, 91], id: 'stone_circle', why: "the circle's south stones (STONECIRCLE 58,90 and 62,90, drawn in its frame by 02-world) and the clear ground round it (39 and 92 keep CIRCLE.box([55, 83, 65, 91]))" },
    { box: [54, 92, 66, 92], id: 'warden', why: "the open row above the warden's tree line and notch (rows 93..95): its approach from the north, inside its keep-clear (92's WARD.box([53, 90, 68, 106])); nothing of the circle's is built there" },
    { box: [6, 72, 19, 72], id: 'graveyard', why: "the graveyard's south row, its gate's row (the port graveyard.gate 13,72), inside its keep-clear (GRAVE.box([8, 65, 17, 72]))" },
    { box: [6, 73, 19, 73], id: 'deepholm_rock', why: "the first row of the reclaimed Deepholm wood (58-underground's rectangle x 2..26, y 72..94, south of the graveyard's keep-clear)" },
    { box: [25, 73, 26, 83], id: 'deepholm_rock', why: "the east edge of the reclaimed Deepholm wood (58-underground's rectangle to x 26), open wood west of Old Wren's hut (28..29) and its yard" },
    { box: [70, 12, 72, 13], id: 'thistledown', why: "open grass north of the cow pen (thistledown's, 72..80 x 14..21): the quarry's rock (48..60) and its dozer spawn (70,8) lie north of row 12" },
    { box: [70, 14, 71, 16], id: 'thistledown', why: "open grass west of the cow pen's fence (72,14..21): the pen's side, nothing of the quarry's built there" },
    { box: [120, 59, 127, 61], id: 'thistledown', why: "the river and the scarp's foot west of the south pond (thistledown's 128..140), on the town's side of the river; Hollowford's ruins start at row 69" },
    { box: [141, 59, 141, 61], id: 'thistledown', why: "the grass east of the south pond's shore (thistledown's 128..140), the river's turn past the town's corner (thistledown.river_se 146,57)" },
  ];

  // ---------- the ports (~100): doors, gates, road ends and named spots ----------
  // (the *.arch ports are 63-house's arch landings, where an island arch sets the knight down)
  const PORTS = {
    'cave.spawn': ['cave', 4, 7], 'cave.sword': ['cave', 11, 7], 'cave.mouth': ['cave', 21, 7], 'cave.axe_stump': ['cave', 23, 9],
    'cave.death_house': ['cave', 25, 10], 'cave.board': ['cave', 24, 6], 'spider_den.door': ['cave', 22, 3], 'spider_den.step': ['cave', 23, 3],
    'quarry.shaft': ['quarry', 56, 6], 'quarry.shaft_step': ['quarry', 56, 7], 'quarry.shrine': ['quarry', 62, 6], 'quarry.shrine_step': ['quarry', 62, 7],
    'quarry.cart': ['quarry', 54, 13], 'quarry.spur': ['quarry', 54, 14], 'quarry.dozer_spawn': ['quarry', 70, 8], 'quarry.arch': ['quarry', 54, 8],
    'signpost.sign': ['signpost', 65, 27],
    'pond.centre': ['pond', 43, 36], 'pond.stones_n': ['pond', 43, 31], 'pond.stones_s': ['pond', 43, 40], 'pond.outflow': ['pond', 50, 37], 'pond.landing': ['pond', 45, 29], 'pond.arch': ['pond', 41, 39],
    'thistledown.origin': ['thistledown', 84, 13], 'thistledown.square': ['thistledown', 112, 33], 'thistledown.fountain': ['thistledown', 112, 35],
    'thistledown.duke': ['thistledown', 112, 49], 'thistledown.castle': ['thistledown', 104, 42], 'thistledown.west_gate': ['thistledown', 85, 32],
    'thistledown.east_gate': ['thistledown', 140, 32], 'thistledown.board': ['thistledown', 105, 27], 'thistledown.house_portal': ['thistledown', 117, 17],
    'thistledown.house_portal_step': ['thistledown', 117, 18], 'thistledown.rail': ['thistledown', 119, 27], 'thistledown.stall': ['thistledown', 116, 28],
    'thistledown.dozer_bay': ['thistledown', 96, 43], 'thistledown.agility_gate': ['thistledown', 87, 50], 'thistledown.forge': ['thistledown', 92, 37],
    'thistledown.anvil': ['thistledown', 94, 38], 'thistledown.brazier': ['thistledown', 119, 38], 'thistledown.death_house': ['thistledown', 133, 48],
    'thistledown.river_se': ['thistledown', 146, 57], 'thistledown.west_lane_n': ['thistledown', 84, 33], 'thistledown.west_lane_s': ['thistledown', 84, 60], 'thistledown.blood_portal': ['thistledown', 129, 21],
    'camp.west_gap': ['camp', 147, 30], 'camp.walker': ['camp', 152, 30], 'camp.cage': ['camp', 148, 34], 'camp.climb': ['camp', 158, 30],
    'camp.shed_door': ['camp', 147, 44], 'camp.shed_step': ['camp', 148, 44], 'camp.dozer_spawn': ['camp', 146, 38], 'camp.south': ['camp', 153, 40],
    'dock.planks': ['dock', 164, 14], 'dock.land': ['dock', 163, 14], 'dock.boat': ['dock', 167, 14], 'gull_isle.boat': ['gull_isle', 170, 13],
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
    'hollowford.west': ['hollowford', 120, 77], 'hollowford.east': ['hollowford', 158, 82], 'hollowford.blood_portal': ['hollowford', 154, 88], 'hollowford.arch': ['hollowford', 139, 79],
    'warden.gate': ['warden', 60, 96], 'warden.post': ['warden', 60, 95], 'warden.dunstan_hut': ['warden', 64, 98], 'warden.dunstan': ['warden', 67, 104],
    'warden.node': ['warden', 66, 100], 'warden.turn': ['warden', 64, 103], 'warden.east_wall': ['warden', 100, 96],
    'ash_shrine.shrine': ['ash_shrine', 87, 103],
    'fang_lair.gate': ['fang_lair', 18, 108], 'fang_lair.circle': ['fang_lair', 18, 117], 'fang_lair.approach': ['fang_lair', 20, 105], 'fang_lair.node': ['fang_lair', 36, 105],
    'canopy.door': ['canopy', 121, 101], 'sylvaris.gap': ['sylvaris', 137, 114], 'sylvaris.node': ['sylvaris', 133, 112],
    // §4/§5, in the 400x280 plan (old_bridge.south is 138,99, not 140,98: the watchtower's ruin stands on 141..145 x 97..101;
    // saltmere.huts is 251,72, not 256,72: at the spread 256,72 is the Grey Sea, and the Coast Path starts on the shore, by
    // the stilt huts Stage 5 builds out over the water)
    'old_bridge.span': ['new', 136, 93], 'old_bridge.south': ['new', 138, 99], 'goblin_road.bridge': ['new', 228, 92],
    'millbrook.gate': ['new', 86, 80], 'saltmere.gate': ['new', 252, 74], 'saltmere.huts': ['new', 251, 72], 'crossroads_inn.yard': ['new', 160, 122],
    'beacon_hills.tower_w': ['new', 116, 12], 'beacon_hills.tower_n': ['new', 128, 8], 'beacon_hills.tower_e': ['new', 139, 15],
    'hunters_lodge.door': ['new', 112, 110], 'outpost_north.road': ['new', 217, 70], 'outpost_south.road': ['new', 236, 100],
    'bandit_hills.toll': ['new', 262, 158], 'bandit_hills.hideout': ['new', 257, 168], 'skypier.pad': ['new', 167, 20], 'skypier.mast': ['new', 167, 12], 'brightwater.landing': ['new', 378, 150],
    'wreck_rock.rock': ['new', 283, 117], 'alchemy.door': ['new', 125, 78], 'necromancy.door': ['new', 73, 119],
    // 63-house's Wolfwood arch landing: open forest on the Wolfwood Road west of the Old Bridge (it was a world point)
    'wolfwood.arch': ['new', 125, 104],
  };
  // ports that lie outside their own box on purpose: relative geometry that moves with the place (one line of reason each)
  const PORT_REL = {
    'warden.east_wall': 'the Ashfields/Jungle wall is the old x 100 line; it moves with the warden frame (the jungle_west pin)',
    'thistledown.river_se': "the river's turn past the town's south-east corner, a row below the wall: it moves with the town (TRACKS.river)",
  };

  // ---------- the tracks: the spread's road network (§5) and its river ----------
  // Stage 4a lays the whole network as continuous DIRT tracks (02-world, at chance 1: 2 wide on a main road, 1 on a spur),
  // so every place, port and stake is joined on day one; Stage 6 paves the same TRACKS. Every end is a port; an interior
  // point is a port, a place's own point ([anchorId, x, y], its OLD coordinates) or a new-map point (['n', x, y], the
  // 400x280 plan's own coordinates). ['w', x, y] (an OLD world point through the stretch) is still read, for a track
  // written before the spread. 39-worldblend and 92-worldshape read every track but the river and the nodes as a road
  // (the river bridges them, nothing solid is added near them, the scarp leaves them open); 26-boats lays the dock's verge
  // from the Sea Road, 20-hollowford widens the Goblin Road, 25-elves trods the Jungle Path, 27-dragons and 93-ashedge
  // keep the Ash Road clear. A route differs from §5's sketch where a place stands in its way (each named below).
  const P = id => ['port', id], w = (x, y) => ['w', x, y], n = (x, y) => ['n', x, y];
  const TRACKS = {
    // R1 the Cave Road (main): the cave mouth, the Mill Lane fork 70,26, the story signpost, Thistledown's west gate
    // (east along row 7 first, north of Death's House 1 at the cave's corner)
    r1_cave: [P('cave.mouth'), n(33, 8), n(45, 14), n(70, 26), P('signpost.sign'), n(125, 48), P('thistledown.west_gate')],
    // R1a the Quarry Track (from the signpost; the Beacon fork at 98,30) to the miners' cart
    r1a_quarry: [P('signpost.sign'), n(98, 30), P('quarry.spur')],
    // R1b the Beacon Path: the fork on the Quarry Track, up the ridge to the three towers
    r1b_beacon: [n(98, 30), n(112, 20), P('beacon_hills.tower_w'), P('beacon_hills.tower_n'), P('beacon_hills.tower_e')],
    // R1c Mill Lane: west round Miller's Pond (§5 ran it by the pond's landing, but the river leaves the pond's east shore
    // there and Mill Lane has no bridge), down to Millbrook's gate
    r1c_mill: [n(70, 26), n(60, 38), n(57, 56), n(62, 72), P('millbrook.gate')],
    // R2 the Sea Road (main): the east gate, the Toll Post 215,49, the camp's gap fork 228,48, north round the palisade
    // (the camp's west field, not through its fence), the shore lane, Harl's dock
    r2_sea: [P('thistledown.east_gate'), n(200, 50), n(215, 49), n(228, 48), n(227, 36), n(246, 30), P('dock.land')],
    spur_camp_gap: [n(228, 48), P('camp.west_gap')],
    // R2a the Skypier spur (§5 lists it for Stage 7; laid now so the stakes are joined): up the lane outside the east wall
    r2a_skypier: [n(200, 50), n(200, 33), n(185, 25), P('skypier.pad')],
    // R3 the Long Road South (main): the lane outside the west wall (Thistledown's own), past the Glasshouse plot, over the
    // Old Bridge, west of the watchtower's ruin, the Crossroads Inn, Hollowford's west entry, the square
    r3_long: [P('thistledown.west_gate'), P('thistledown.west_lane_n'), ['thistledown', 84, 51], n(131, 82), P('old_bridge.span'), P('old_bridge.south'),
      n(146, 108), P('crossroads_inn.yard'), n(185, 126), P('hollowford.west'), P('hollowford.square')],
    spur_glasshouse: [n(134, 78), P('alchemy.door')],
    // R3b the Jungle Path: Hollowford's south exit through the giants' gap, the canopy fork 214,174, Sylvaris' gap
    r3b_jungle: [P('hollowford.south'), n(222, 160), n(214, 174), n(222, 195), P('sylvaris.gap')],
    spur_canopy: [n(214, 174), P('canopy.door')],
    // R4 the Goblin Road (main): out of the camp's south palisade gap (its own point), east of the War Shed, past the
    // north outpost's stakes (10 off), the plank bridge, past the south outpost's stakes (4 off), Hollowford's north entry
    r4_goblin: [['camp', 150, 39], n(238, 68), n(232, 80), P('goblin_road.bridge'), n(227, 104), P('hollowford.north')],
    // R4a the Saltmere spur (from the Goblin Road at 232,80); R4b the Coast Path back up to the Sea Road (a loop: dock,
    // Saltmere, camp)
    r4a_saltmere: [n(232, 80), P('saltmere.gate')],
    r4b_coast: [P('saltmere.huts'), n(250, 52), n(246, 30)],
    // R5 the Wolfwood Road (main): the bridge's south end, the Wolfwood arch landing, the Lodge, beside the Old Barrow,
    // past the step below Wren's door (the hut's own wall is not the road's), between the graveyard and the Deepholm rock,
    // the graveyard gate
    r5_wolfwood: [P('old_bridge.south'), P('wolfwood.arch'), P('hunters_lodge.door'), n(84, 121), n(62, 122), n(55, 126), n(50, 126), n(40, 126), n(36, 116), P('graveyard.gate')],
    spur_barrow: [n(73, 121), P('necromancy.door')],
    // R6 the Ash Road (main): the inn, round (not through) the stone circle, the Warden's post and gate, Dunstan's turn
    // (the warden's own points), the old ash path to the lair's approach and gate
    r6_ash: [P('crossroads_inn.yard'), n(130, 128), n(100, 140), P('warden.post'), P('warden.gate'), ['warden', 60, 100], ['warden', 56, 104], n(78, 164),
      P('fang_lair.node'), P('fang_lair.approach'), P('fang_lair.gate')],
    // R6a the Shrine spur, from Dunstan's turn; the farm path (the warden's own)
    r6a_shrine: [P('warden.turn'), P('ash_shrine.shrine')],
    path_farm: [['warden', 60, 100], ['warden', 63, 103], ['warden', 69, 103]],
    // R7 the Drovers' Track (a cart track, never paved): the inn to the south outpost
    r7_drovers: [P('crossroads_inn.yard'), n(200, 108), P('outpost_south.road')],
    // R8 the Bandit Track: Hollowford's east side to the bandit hills' toll
    r8_bandit: [P('hollowford.east'), n(255, 145), P('bandit_hills.toll')],
    // the miners' lane inside the quarry (24-dwarves')
    shaft_lane: [['quarry', 54, 13], ['quarry', 54, 8], ['quarry', 55, 8], ['quarry', 55, 5], ['quarry', 57, 5]],
    // the places that must stay mutually reachable, in chain order (39 reads the first nine, 92 all fifteen)
    nodes: [P('cave.mouth'), P('signpost.sign'), P('thistledown.west_gate'), P('dock.planks'), P('hollowford.heart'), P('warden.node'), P('fang_lair.node'),
      P('hollowford.south'), P('quarry.shaft'), P('wren.wren'), P('graveyard.grave'), ['pond', 38, 36], P('camp.walker'), P('sylvaris.node'), P('thistledown.square')],
    // the river, laid anew (§3, §5): from inside Miller's Pond (its old head) out by the east shore, south-east past
    // Millbrook's bend, then east along the
    // Goblin Fields / Wolfwood scarp under the two road bridges, out to the Grey Sea below Saltmere
    river: [['pond', 44, 38], P('pond.outflow'), n(90, 62), n(102, 70), n(106, 84), n(114, 96), n(124, 95), P('old_bridge.span'), n(148, 92), n(160, 97), n(170, 98),
      n(182, 93), n(196, 94), n(212, 97), P('goblin_road.bridge'), n(240, 94), n(252, 88), n(264, 84)],
  };
  // the main roads (§5: 2 wide; placeAction keeps them and the tile either side clear; Stage 6 paves them first)
  const MAIN_ROADS = ['r1_cave', 'r2_sea', 'r3_long', 'r4_goblin', 'r5_wolfwood', 'r6_ash'];
  // every road (a track that is not the river or the node list): what 02-world lays and 39 and 92 keep open
  const ROAD_IDS = Object.keys(TRACKS).filter(id => id !== 'river' && id !== 'nodes');
  // the signposts (§5): a SIGN beside every node with three or more legs, and at the Lodge and Millbrook; 06-systems sends a
  // SIGN other than the story's to ATLAS.signText, which names each arm and the place it leads to
  // { at: the node, sign: where the post stands (else 93-spread finds open ground two to four tiles off the node) }: the
  // two by Thistledown's gates stand clear of the High Street's line through the gates
  const SIGNPOSTS = [{ at: n(70, 26) }, { at: n(98, 30) }, { at: P('thistledown.west_gate'), sign: n(138, 54) }, { at: n(200, 50), sign: n(203, 46) }, { at: n(228, 48) },
    { at: n(232, 80) }, { at: n(246, 30) }, { at: P('old_bridge.south') }, { at: P('crossroads_inn.yard') }, { at: P('hollowford.square') }, { at: n(214, 174) },
    { at: ['warden', 60, 100] }, { at: P('hunters_lodge.door') }, { at: P('millbrook.gate') }];

  // ---------- the stretched world, and the seam pins (§3) ----------
  // Stage 4a (spec §3): old x 0..162 (the Goblin Fields, Wolfwood, the Ashfields and the Jungle) to 0..262, old 162..200
  // (the Grey Sea and the Sound) to 262..318, old 200..259 (the Far Shore, the Grub Fields and the Redcut) to 318..399;
  // every row 0..179 to 0..279. The first column and row inside the tree border stay where they are ([1, 1]): a pass that
  // runs "from the first column" (W.tx(1): the rim, the scarp, the dither) must start at 1, or the column between the
  // border and the scarp's first face is a way round it.
  const WORLD = { xs: [[0, 0], [1, 1], [162, 262], [200, 318], [259, 399]], ys: [[0, 0], [1, 1], [179, 279]] };
  // near each of its ports a pinned seam moves with the port's place (its old value through the port's frame) instead of
  // the stretch, tapered back to the stretch over 12 tiles either side (W.pin); `axis` is the coordinate the seam is
  // moved in, `along` the one it runs along
  const PINS = [
    { id: 'rim', seam: 'the Ashfields rim row (37 row 95, 92 footWA, 93 band)', axis: 'y', ports: ['warden.gate'] },
    { id: 'gw_steps', seam: 'the Goblin Fields / Wolfwood scarp (92 sGW)', axis: 'y', ports: ['graveyard.steps'] },
    { id: 'giants', seam: 'the Wolfwood / Jungle wall (92 sWJ)', axis: 'y', ports: ['hollowford.south'] },
    { id: 'jungle_west', seam: 'the Ashfields / Jungle wall (37 x 100, 39 jungle column)', axis: 'x', ports: ['warden.east_wall'], old: 100 },   // old: a straight seam's old line (W.line)
    // (the river is laid in the new map's own points through these ports, so its pin moves nothing: W.pin skips a new port)
    { id: 'river', seam: 'the river polyline (TRACKS.river)', axis: 'y', ports: ['old_bridge.span', 'goblin_road.bridge', 'pond.outflow'] },
    { id: 'strait', seam: 'the 39 strait and Far Shore coast loops', axis: 'x', ports: ['far_shore.strait'] },
    { id: 'sea', seam: "the Grey Sea's west coast (39 COVES)", axis: 'x', ports: ['dock.planks'] },   // + saltmere.jetty when Saltmere is drawn (Stage 5b)
  ];
  const TAPER = 12;

  // ---------- piecewise-linear maps ----------
  const pw = (pts, v) => {   // pts: [[from, to], ...] increasing; beyond the ends, the end segment's slope carries on
    let k = 0; while (k < pts.length - 2 && v > pts[k + 1][0]) k++;
    const [a0, b0] = pts[k], [a1, b1] = pts[k + 1];
    return b0 + (v - a0) * ((b1 - b0) / (a1 - a0));   // the slope first: an identity segment is exactly v for every real v (noise read through W.ix stays bit-identical)
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
    // a pinned seam's value v (new coordinates) at `along` (new coordinates). Near a port the seam is carried by the
    // port's place: its OLD value (W.iy(v), or W.ix) goes through the port's frame, so it keeps the distance from the
    // port it had on the old map (a seam 3 rows below the steps is 3 rows below them after the spread, not 3 rows
    // stretched); the offset (frame - stretch) tapers to 0 over TAPER tiles of `along` either side of the port
    pin(seamId, v, along) {
      const pin = PINS.find(q => q.id === seamId); if (!pin) throw new Error('ATLAS.world.pin: no seam ' + JSON.stringify(seamId));
      let off = 0;
      for (const pid of pin.ports) {
        const o = PORTS[pid], n = port(pid); if (!o || !n) continue;
        if (o[0] === 'new') continue;   // a port of a new place has no old position: it pins from Stage 4a
        const ax = pin.axis === 'y' ? 1 : 0, al = 1 - ax, F = FRAMES[o[0]];
        const delta = (ax ? F.y(W.iy(v)) : F.x(W.ix(v))) - v, d = Math.abs(along - n[al]);
        if (d < TAPER) off += delta * (1 - d / TAPER);
      }
      return v + off;
    },
    // the inverse along the seam's axis: the v whose pinned value is u (a band of rows about a seam, mapped back to old
    // rows through W.iy(W.unpin(...))). Exactly u wherever the pin moves nothing (always, before the spread).
    unpin(seamId, u, along) {
      if (W.pin(seamId, u, along) === u) return u;
      let lo = u - 256, hi = u + 256;   // pin is monotone in v (each port's frame and the stretch both are)
      for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (W.pin(seamId, m, along) < u) lo = m; else hi = m; }
      return (lo + hi) / 2;
    },
    // a straight pinned seam (a PIN with `old`, its old line): the new tile column (or row) it stands on at `along`.
    // The one read of that line: jungle_west is the Ashfields / Jungle wall, and every split, box edge and loop end on
    // the old x 100 line (39, 92 and 93) reads W.line('jungle_west', y), so the wall and the regions move together.
    line(seamId, along) {
      const pin = PINS.find(q => q.id === seamId); if (!pin || typeof pin.old !== 'number') throw new Error('ATLAS.world.line: no straight seam ' + JSON.stringify(seamId));
      return Math.round(W.pin(seamId, pin.axis === 'y' ? W.y(pin.old) : W.x(pin.old), along));
    },
  };

  // ---------- helpers ----------
  const live = id => !!ANCHORS[id] && ANCHORS[id].kind === 'place';
  function port(id) {
    const q = PORTS[id]; if (!q) return null;
    if (q[0] === 'new') return [q[1], q[2]];   // a new place's port, in the 400x280 plan's own coordinates (live since 4a)
    const f = FRAMES[q[0]]; return f ? [f.x(q[1]), f.y(q[2])] : null;
  }
  // a place's new box; a reserved place's (§4, live from 4a) is its plan box
  const box = id => live(id) ? FRAMES[id].newBox : ANCHORS[id] && ANCHORS[id].kind === 'reserved' ? ANCHORS[id].newBox.slice() : null;
  const area = b => (b[2] - b[0] + 1) * (b[3] - b[1] + 1);
  // the place box (OLD map) holding the point. One box: that place. More than one: the OWNERS rect or the port at that
  // exact point that decides it (decided: 'owner' | 'port'); otherwise the smallest box, flagged overlap: true (a human
  // decides; the tools refuse it). ties: other boxes of the same smallest area.
  const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
  function anchorOf(x, y) {
    let best = null, ties = [];
    const holders = Object.keys(ANCHORS).filter(id => ANCHORS[id].kind === 'place' && inB(ANCHORS[id].box, x, y));
    for (const id of holders) {
      const b = ANCHORS[id].box;
      if (!best || area(b) < area(ANCHORS[best].box)) { best = id; ties = []; } else if (area(b) === area(ANCHORS[best].box)) ties.push(id);
    }
    if (!best) return null;
    if (holders.length < 2) return { id: best, ties, holders, overlap: false, decided: null };
    const own = OWNERS.find(o => inB(o.box, x, y) && holders.includes(o.id));
    if (own) return { id: own.id, ties: [], holders, overlap: false, decided: 'owner' };
    const pid = Object.keys(PORTS).find(k => PORTS[k][0] !== 'new' && PORTS[k][1] === x && PORTS[k][2] === y && holders.includes(PORTS[k][0]));
    if (pid) return { id: PORTS[pid][0], ties: [], holders, overlap: false, decided: 'port' };
    return { id: best, ties, holders, overlap: true, decided: null };
  }
  // the migration's and the tools' mappings, never game code's
  function oldToNew(x, y) { const h = anchorOf(x, y); return h ? [FRAMES[h.id].x(x), FRAMES[h.id].y(y)] : null; }
  const oldToNewWorld = (x, y) => [W.x(x), W.y(y)];
  function track(id) {
    const t = TRACKS[id]; if (!t) return null;
    return t.map(q => q[0] === 'port' ? port(q[1]) : q[0] === 'n' ? [q[1], q[2]] : q[0] === 'w' ? [W.x(q[1]), W.y(q[2])] : FRAMES[q[0]] ? [FRAMES[q[0]].x(q[1]), FRAMES[q[0]].y(q[2])] : null);
  }
  // one track point, as [x, y] on the map
  const pointOf = q => q[0] === 'port' ? port(q[1]) : q[0] === 'n' ? [q[1], q[2]] : q[0] === 'w' ? [W.x(q[1]), W.y(q[2])] : FRAMES[q[0]] ? [FRAMES[q[0]].x(q[1]), FRAMES[q[0]].y(q[2])] : null;
  // the reserved places (§4 and addendum A): their boxes take stakes and a plaque, and placeAction refuses them
  // A reserved place a Stage 5 file has BUILT (ATLAS.markBuilt(id), at that file's load) stays a reserved anchor, so every world
  // pass before HOOKS.built sees the same ground (34-food, 62-ores and 93-spread's stakes read reservedAt; skipping a box
  // there would move dice all over the map); its file takes its own stakes up on the finished land. What changes: its
  // REGIONS line names the place, not the builders (93-spread), its signposts drop "(builders at work)", placeAction says
  // whose ground it is, and the beat report counts it a stop.
  // (BUILT: id -> { sub }, the line under the place's name in its banner and on the map)
  const BUILT = new Map();
  const markBuilt = (id, info) => { if (!ANCHORS[id] || ANCHORS[id].kind !== 'reserved') throw new Error('ATLAS.markBuilt: no reserved place ' + JSON.stringify(id)); BUILT.set(id, Object.assign({ sub: '' }, info)); return id; };
  const isBuilt = id => BUILT.has(id);
  // a new place's own frame (Stage 5): its points are offsets from its plan box's top-left corner (F.p(0, 0) is the box's
  // first tile), so the place moves with its box; the same calls as a place frame's
  function planFrame(id) {
    const a = ANCHORS[id]; if (!a || !a.newBox) throw new Error('ATLAS.planFrame: no new place ' + JSON.stringify(id));
    const b = a.newBox, x = v => b[0] + v, y = v => b[1] + v;
    const f = {
      id, x, y, tx: v => Math.round(x(v)), ty: v => Math.round(y(v)), ix: v => v - b[0], iy: v => v - b[1],
      p: (px, py) => [x(px), y(py)],
      pt: o => Object.assign({}, o, { x: x(o.x), y: y(o.y) }),
      pts: list => list.map(q => Array.isArray(q) ? [x(q[0]), y(q[1])] : Object.assign({}, q, { x: x(q.x), y: y(q.y) })),
      rect: r => Object.assign({}, r, { x0: x(r.x0), y0: y(r.y0), x1: x(r.x1), y1: y(r.y1) }),
      box: q => [x(q[0]), y(q[1]), x(q[2]), y(q[3])],
      w: b[2] - b[0] + 1, h: b[3] - b[1] + 1, get dx() { return b[0]; }, get dy() { return b[1]; },
    };
    return f;
  }
  const reserved = () => Object.keys(ANCHORS).filter(id => ANCHORS[id].kind === 'reserved').map(id => ({ id, box: ANCHORS[id].newBox.slice() }));
  const reservedAt = (tx, ty) => { for (const id in ANCHORS) { const a = ANCHORS[id]; if (a.kind === 'reserved' && inB(a.newBox, tx, ty)) return id; } return null; };
  // a built place's own ground: its staked box, or the box it grew to past its stakes (markBuilt's `box`: 84-crossroads'
  // inn runs south of the roads that cross its stakes); placeAction keeps it
  const builtAt = (tx, ty) => { for (const [id, info] of BUILT) if (info.box && inB(info.box, tx, ty)) return id; const r = reservedAt(tx, ty); return r && BUILT.has(r) ? r : null; };
  // a tile on a main road or one either side of it: within 2 tiles of a main road's centre line (the 2-wide road and
  // a tile of verge either side). A mask, made once (the tracks never move after load).
  const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  let MAIN_MASK = null;
  function onMainRoad(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    if (!MAIN_MASK) {
      MAIN_MASK = new Uint8Array(MAP_W * MAP_H);
      for (const id of MAIN_ROADS) { const pl = track(id);
        for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k];
          for (let y = Math.max(0, Math.floor(Math.min(ay, by) - 2)); y <= Math.min(MAP_H - 1, Math.ceil(Math.max(ay, by) + 2)); y++)
            for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - 2)); x <= Math.min(MAP_W - 1, Math.ceil(Math.max(ax, bx) + 2)); x++) if (segD(x, y, ax, ay, bx, by) <= 2) MAIN_MASK[y * MAP_W + x] = 1; } }
    }
    return MAIN_MASK[ty * MAP_W + tx] === 1;
  }
  // ---------- the signposts' words (§5): each arm, which way it points and the place at its far end ----------
  const PLACE_WORDS = { cave: 'the cave', signpost: 'the old signpost', quarry: 'Grey Quarry', pond: "Miller's Pond", thistledown: 'Thistledown', camp: 'the Goblin Camp',
    dock: "Harl's dock", hollowford: 'Hollowford', warden: "the Warden's gate", ash_shrine: 'the ash shrine', fang_lair: "the Fang's lair", canopy: 'the canopy run',
    sylvaris: 'Sylvaris', wren: "Old Wren's hut", graveyard: 'the graveyard', old_bridge: 'the Old Bridge', millbrook: 'Millbrook', saltmere: 'Saltmere',
    crossroads_inn: 'the Crossroads Inn', beacon_hills: 'Beacon Hills', hunters_lodge: "the Hunters' Lodge", outpost_north: 'the goblin outpost',
    outpost_south: 'the goblin outpost', bandit_hills: 'the Bandit Hills', skypier: 'the Skypier', alchemy: 'the Glasshouse', necromancy: 'the Old Barrow',
    wolfwood: 'Wolfwood', goblin_road: 'the goblin bridge' };
  const ROAD_WORDS = { r1_cave: 'the Cave Road', r1a_quarry: 'the Quarry Track', r1b_beacon: 'the Beacon Path', r1c_mill: 'Mill Lane', r2_sea: 'the Sea Road',
    spur_camp_gap: "the camp's gap", r2a_skypier: 'the Skypier lane', r3_long: 'the Long Road', spur_glasshouse: 'the Glasshouse plot', r3b_jungle: 'the Jungle Path',
    spur_canopy: 'the canopy run', r4_goblin: 'the Goblin Road', r4a_saltmere: 'the Saltmere lane', r4b_coast: 'the Coast Path', r5_wolfwood: 'the Wolfwood Road',
    spur_barrow: 'the Old Barrow', r6_ash: 'the Ash Road', r6a_shrine: 'the shrine path', path_farm: "Dunstan's farm", r7_drovers: "the Drovers' Track",
    r8_bandit: 'the Bandit Track', shaft_lane: 'the mine shaft' };
  // the landmarks an arm names when its road passes one ("→ Thistledown, south-east, past the old signpost.")
  // (the Hunters' Lodge since the review of bcb559f: the Old Bridge's post named only the graveyard, the Wolfwood Road's far
  // end, and not the Lodge, its next stop)
  const PAST_MARKS = ['signpost', 'old_bridge', 'crossroads_inn', 'goblin_road', 'hunters_lodge'];
  // the places an arm may name as the next stop (Stage 6): every place with words, but the Wolfwood arch (a landmark on the
  // way, not a stop)
  const STOP_PLACES = new Set(Object.keys(PLACE_WORDS).filter(k => k !== 'wolfwood'));
  // the walk time of a leg, in words a ten-year-old reads ("40 seconds on foot", "1 minute on foot", "2 and a half minutes
  // on foot"); legSecs(roadId, k0, k1) is set by 93-roads once the roads are laid (null before: no time is said)
  const walkWords = secs => {
    if (!(secs >= 0)) return null;
    if (secs < 50) return Math.max(5, Math.round(secs / 5) * 5) + ' seconds on foot';
    const m = Math.round(secs / 30) / 2, whole = Math.floor(m);
    return (m === whole ? whole + (whole === 1 ? ' minute' : ' minutes') : whole + ' and a half minutes') + ' on foot';
  };
  const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  // the words for a leg's far end: a port names its place (a reserved one says the builders are at work); a junction
  // names the road it meets
  const placeWords = pre => { const name = PLACE_WORDS[pre] || pre; return ANCHORS[pre] && ANCHORS[pre].kind === 'reserved' && !BUILT.has(pre) ? name + ' (builders at work)' : name; };
  function endWords(q, tid, here) {
    if (q[0] === 'port') return placeWords(q[1].split('.')[0]);
    const at = pointOf(q);
    // a place's own point: the road it meets there (Dunstan's farm path ends on the Ash Road), else that place, or the
    // road's own words when the sign stands in that place (the farm path's far end is Dunstan's door)
    const own = q[0] !== 'n' && q[0] !== 'w' && PLACE_WORDS[q[0]];
    for (const id of ROAD_IDS) if (id !== tid && track(id).some(p => Math.hypot(p[0] - at[0], p[1] - at[1]) < 1)) return ROAD_WORDS[id] || id;
    if (own && q[0] !== here) return placeWords(q[0]);
    return ROAD_WORDS[tid] || tid;
  }
  // a point `d` tiles along the polyline from index k toward index k + dir
  function along(pl, k, dir, d) {
    let [x, y] = pl[k];
    for (let i = k; i + dir >= 0 && i + dir < pl.length; i += dir) { const [nx, ny] = pl[i + dir], L = Math.hypot(nx - x, ny - y); if (L >= d) return [x + (nx - x) * d / L, y + (ny - y) * d / L]; d -= L; x = nx; y = ny; }
    return [x, y];
  }
  // the arms at a node: every road through it (or ending at it), and at a place's own node (a port of that place) every
  // road that leaves that place by another of its ports within 20 tiles (Hollowford's square: the roads from its four entries)
  function signLegs(nx, ny, place) {
    const legs = [];
    for (const id of ROAD_IDS) {
      const pts = TRACKS[id], pl = track(id);
      let best = -1, bd = 2.5; pl.forEach((p, k) => { const d = Math.hypot(p[0] - nx, p[1] - ny); if (d < bd) { bd = d; best = k; } });
      if (best < 0 && place) for (const k of [0, pl.length - 1]) { const q = pts[k]; if (q[0] === 'port' && q[1].split('.')[0] === place && Math.hypot(pl[k][0] - nx, pl[k][1] - ny) <= 20) best = k; }
      // (Stage 6: a node on a road's line between two of its points, a T: the road runs both ways from it, the Glasshouse
      // spur's fork on the Long Road)
      let seg = -1, segT = 0;
      if (best < 0) { let sd = 2.5; for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((nx - ax) * dx + (ny - ay) * dy) / l2)), d = Math.hypot(nx - ax - t * dx, ny - ay - t * dy); if (d < sd) { sd = d; seg = k; segT = t; } } }
      if (best < 0 && seg < 0) continue;
      for (const dir of [-1, 1]) { const end = dir < 0 ? 0 : pl.length - 1;
        // b: the point the walk starts from (the next one looked at is b + dir); kf: where the node lies, in track points
        const b = best >= 0 ? best : dir < 0 ? seg : seg - 1, kf = best >= 0 ? best : seg - 1 + segT;
        if (b === end) continue;
        const aim = pl[best >= 0 ? b : b + dir], [ax, ay] = Math.hypot(aim[0] - nx, aim[1] - ny) > 2.5 ? aim : along(pl, best >= 0 ? b : b + dir, dir, 8), a = Math.atan2(ay - ny, ax - nx), word = COMPASS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
        // a landmark the road passes on the way (the old signpost on the Cave Road, chapter 4's): the first one past this node
        let past = null; for (let k = b + dir; k !== end + dir && !past; k += dir) { if (k === end) break; const q = pts[k], pl0 = q[0] === 'port' ? q[1].split('.')[0] : null;
          if (PAST_MARKS.includes(pl0) && pl0 !== place && Math.hypot(pl[k][0] - nx, pl[k][1] - ny) > 2.5) past = PLACE_WORDS[pl0]; }
        // the NEXT stop along it (Stage 6): the first place the road reaches past this node (a port of a place but this one),
        // else the road's far end; `kf` and `stopK` are its track points, for the walk time (ATLAS.legSecs, 93-roads)
        let stopK = end; for (let k = b + dir; k !== end; k += dir) { const q = pts[k], pl0 = q[0] === 'port' ? q[1].split('.')[0] : null;
          if (pl0 && STOP_PLACES.has(pl0) && pl0 !== place && Math.hypot(pl[k][0] - nx, pl[k][1] - ny) > 2.5) { stopK = k; break; } }
        const to = endWords(pts[end], id, place), next = stopK === end ? to : placeWords(pts[stopK][1].split('.')[0]);
        legs.push({ road: id, to, dir: word, past, next, k: kf, stopK }); }
    }
    return legs;
  }
  // the node a signpost at (tx, ty) stands by (within 7 tiles), and the place it is a port of, if any
  // (a node on a place's own point is that place's too: the Warden's farm turn; `here` names a node's own ground in words
  // its place's would not: Dunstan's farm, inside the Warden's)
  function signNode(tx, ty) {
    let node = null, nd = 7.5, place = null, here = null;
    for (const q of SIGNPOSTS) { const p = pointOf(q.at); const d = Math.hypot(p[0] - tx, p[1] - ty); if (d < nd) { nd = d; node = p; place = q.at[0] === 'port' ? q.at[1].split('.')[0] : q.at[0] !== 'n' && q.at[0] !== 'w' && PLACE_WORDS[q.at[0]] ? q.at[0] : null; here = q.here || null; } }
    return node ? { node, place, here } : null;
  }
  // its arms, [{ road, to, dir }], each named once (the place it stands at is not an arm of its own)
  function signArms(tx, ty) {
    const at = signNode(tx, ty); if (!at) return [];
    const seen = new Set(), out = [];
    for (const l of signLegs(at.node[0], at.node[1], at.place)) { const k = (l.next || l.to) + '|' + l.dir; if (seen.has(k) || (at.place && (l.next || l.to) === placeWords(at.place)) || (at.here && (l.next || l.to) === at.here)) continue; seen.add(k); out.push(l); }
    return out;
  }
  // the text of the signpost at (tx, ty): the node it stands by (within 7 tiles), each arm on its own; null if none
  function signText(tx, ty) {
    const at = signNode(tx, ty); if (!at) return null;
    const { node, place } = at, arms = [], cap = w => w.charAt(0).toUpperCase() + w.slice(1);
    // each arm: the next stop, its way, the walk (once the roads are laid), and the road's far end if that is further on
    for (const l of signArms(tx, ty)) { const secs = A.legSecs && l.k !== undefined ? A.legSecs(l.road, l.k, l.stopK) : null, w = walkWords(secs);
      arms.push('→ ' + cap(l.next || l.to) + ', ' + l.dir + (w ? ', ' + w : '') + (l.next && l.next !== l.to ? ', then ' + l.to : l.past ? ', past ' + l.past : '') + '.'); }
    // a post at a place's own gate or door says where it stands (Thistledown's west gate: the town is through it)
    if (place && PLACE_WORDS[place]) { const b = box(place), here = b && (tx < b[0] || tx > b[2] || ty < b[1] || ty > b[3]) ? null : 'here';
      if (here) arms.unshift('Here: ' + cap(at.here || placeWords(place)) + '.'); else if (b) { const a = Math.atan2((b[1] + b[3]) / 2 - ty, (b[0] + b[2]) / 2 - tx); arms.unshift('→ ' + cap(placeWords(place)) + ', ' + COMPASS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8] + '.'); } }
    return arms.length ? arms.join('   ') : null;
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
    // now: every live box inside the map; two boxes may overlap only while both keep the old map's relative placement
    // (the same shift: §2's old boxes may overlap, and OWNERS decides each overlap tile; at Stage 0-3 every shift is 0,
    // and the jiggle moves an overlapping pair as one) or where NESTED allows it
    const now = Object.keys(ANCHORS).filter(live);
    for (const id of now) if (!inside(box(id), MAP_W, MAP_H)) problems.push(id + "'s box lies outside the map");
    const shift = id => (ANCHORS[id].at[0] - ANCHORS[id].box[0]) + ',' + (ANCHORS[id].at[1] - ANCHORS[id].box[1]);
    for (let i = 0; i < now.length; i++) for (let j = i + 1; j < now.length; j++)
      if (shift(now[i]) !== shift(now[j]) && !nested(now[i], now[j]) && meet(box(now[i]), box(now[j]))) problems.push(now[i] + ' and ' + now[j] + ' overlap');
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
    // each owner decision names a place and covers some overlap that place is part of (otherwise it decides nothing)
    for (const o of OWNERS) {
      if (!live(o.id)) { problems.push('OWNERS names no place anchor ' + o.id); continue; }
      let used = false;
      for (let x = o.box[0]; x <= o.box[2] && !used; x++) for (let y = o.box[1]; y <= o.box[3] && !used; y++) {
        const hs = Object.keys(ANCHORS).filter(id => live(id) && inB(ANCHORS[id].box, x, y)); used = hs.length > 1 && hs.includes(o.id);
      }
      if (!used || !o.why) problems.push('OWNERS rect ' + JSON.stringify(o.box) + ' (' + o.id + ') decides no overlap of ' + o.id + ', or gives no reason');
    }
    // the world is monotone; every pin names real ports; every track point resolves
    if (!monotone(WORLD.xs) || !monotone(WORLD.ys)) problems.push('WORLD is not monotone');
    for (const pin of PINS) for (const pid of pin.ports) if (!PORTS[pid]) problems.push('pin ' + pin.id + ' names no port ' + pid);
    for (const tid in TRACKS) for (const q of TRACKS[tid]) {
      if (q[0] === 'port' ? !PORTS[q[1]] : q[0] !== 'w' && q[0] !== 'n' && !live(q[0])) problems.push('track ' + tid + ' has a point that names nothing: ' + JSON.stringify(q));
      else if (q[0] === 'n' ? !(q[1] >= 0 && q[2] >= 0 && q[1] < PLAN_W && q[2] < PLAN_H) : q[0] !== 'port' && q[0] !== 'w' && !FRAMES[q[0]].inOld(q[1], q[2])) problems.push('track ' + tid + ' point ' + JSON.stringify(q) + ' lies outside ' + (q[0] === 'n' ? 'the planned map' : q[0] + "'s box"));
    }
    for (const id of MAIN_ROADS) if (!TRACKS[id]) problems.push('MAIN_ROADS names no track ' + id);
    for (const q of SIGNPOSTS) for (const r of [q.at, q.sign]) if (r && r[0] === 'port' && !PORTS[r[1]]) problems.push('a signpost names no port ' + r[1]);
    if (problems.length) console.error('ATLAS frames: ' + problems.join('; '));
  }

  // the worldRev footprints (§10 "worldRev sweeps"): a later stage that changes ground a knight may have built on (Stage 5's
  // places, Stage 6's roads) adds REVS[n] = { boxes: [[x0, y0, x1, y1], ...] } (the new map's coordinates) and bumps
  // WORLD_REV to n; a save with an older worldRev is swept in those boxes only (97-spread's SPREAD.sweep). 1: 87-critters; 2: 85-riverside; 3: 84-crossroads; 4: 86-wildplaces; 5: 86-outposts; 6: 86-bandits; 7: 93-roads (its boxes made by its pass: the laid road, grown by 2).
  const REVS = {};

  Object.assign(A, {
    ANCHORS, PORTS, PORT_REL, TRACKS, WORLD, PINS, NESTED, OWNERS, REVS, PLAN: { W: PLAN_W, H: PLAN_H },
    frame, world: W, port, box, track, guards, anchorOf, oldToNew, oldToNewWorld,
    MAIN_ROADS, ROAD_IDS, SIGNPOSTS, GROUNDS, pointOf, reserved, reservedAt, onMainRoad, signText, signLegs, signArms, walkWords, signWords: id => placeWords(id), legSecs: null, BUILT, markBuilt, isBuilt, builtAt, planFrame,
    frameProblems: () => problems.slice(), strict: () => [...STRICT.values()].map(e => e.slice()),
  });

  // ---------- self-tests ----------
  HOOKS.selfTest.push((check, F, h) => {
    const PF = 'atlas frames: ', strictBefore = new Map(STRICT);   // what the game logged so far: put back after these checks add their own
    check(PF + 'the anchor table is whole: boxes in the map and apart (old boxes may overlap where they still stand), the 400x280 plan apart, every port in its own box, WORLD monotone, every pin and track point naming something real', problems.length === 0, { problems: problems.slice(0, 8) });
    // Stage 4a: every place sits at its section-2 top-left, and the world stretches through section 3's breakpoints
    const offBad = Object.keys(FRAMES).filter(id => { const f = FRAMES[id], a = ANCHORS[id]; return f.dx !== a.to[0] - a.box[0] || f.dy !== a.to[1] - a.box[1] || f.ix(f.x(a.box[0] + 0.5)) !== a.box[0] + 0.5; });
    const wOk = MAP_W === PLAN_W && MAP_H === PLAN_H && W.x(0) === 0 && W.x(1) === 1 && W.y(1) === 1 && W.x(162) === 262 && W.x(200) === 318 && W.x(259) === 399 && W.y(179) === 279 && W.y(0) === 0 &&
      [0, 7.25, 61.5, 150, 199.5, 259].every(v => Math.abs(W.ix(W.x(v)) - v) < 1e-9) && [0, 3.5, 95, 179].every(v => Math.abs(W.iy(W.y(v)) - v) < 1e-9);
    const pinIds = PINS.every(pin => pin.ports.every(pid => PORTS[pid]));
    check(PF + "Stage 4a: every place sits at its section-2 top-left (each frame's offset is its new top-left less its old one), the map is 400 x 280, and the world stretches through section 3's breakpoints (old x 162 to 262, 200 to 318, 259 to 399; row 179 to 279; the first column and row inside the border kept) with the inverse undoing it",
      offBad.length === 0 && wOk && pinIds, { offBad, wOk, pinIds, map: [MAP_W, MAP_H] });
    // the API's shapes
    const Fh = frame('hollowford'), hx = Fh.dx, hy = Fh.dy, r = Fh.rect({ x0: 122, y0: 66, x1: 156, y1: 92, name: 'HF' }), pt = Fh.pt({ x: 140, y: 80, label: 'well' });
    const shapes = JSON.stringify(Fh.p(140, 80)) === JSON.stringify([140 + hx, 80 + hy]) && r.name === 'HF' && r.x1 === 156 + hx && pt.label === 'well' && pt.x === 140 + hx &&
      JSON.stringify(Fh.pts([[1, 2], { x: 3, y: 4 }]).map(q => Array.isArray(q) ? q : [q.x, q.y])) === JSON.stringify([[1 + hx, 2 + hy], [3 + hx, 4 + hy]]) && JSON.stringify(Fh.box([1, 2, 3, 4])) === JSON.stringify([1 + hx, 2 + hy, 3 + hx, 4 + hy]) && Fh.inOld(120, 59) && !Fh.inOld(119, 59);
    let threw = false; try { frame('nowhere'); } catch (e) { threw = true; }
    check(PF + "a frame answers in every shape the conversions use (p, pt, pts, rect, box, inOld) and keeps a rect's other fields; an unknown place throws", shapes && threw, { shapes, threw });
    // helpers
    const sp = port('thistledown.square'), span = port('old_bridge.span'), hfBox = box('hollowford'), obBox = box('old_bridge'), g = guards().find(q => q.id === 'hollowford');
    const smallest = anchorOf(160, 18), ow = oldToNew(140, 80), none = oldToNew(60, 70), nw = oldToNewWorld(60, 70), trackOk = Object.keys(TRACKS).every(id => track(id).every(q => Array.isArray(q) && q.length === 2 && Number.isFinite(q[0]) && Number.isFinite(q[1])));
    check(PF + "port, box, guards, anchorOf (an overlap tile goes to its owner: the dock / camp corner 160,18 to the dock), oldToNew (null on open land) and every track resolve at the spread: the square at 169,52, Hollowford's box 206..246 x 112..149, the well 140,80 at 226,133; a reserved place's port and box are live (the Old Bridge's span 136,93, its box 128..146 x 86..102)",
      JSON.stringify(sp) === '[169,52]' && JSON.stringify(span) === '[136,93]' && JSON.stringify(obBox) === '[128,86,146,102]' && JSON.stringify(hfBox) === '[206,112,246,149]' && g && g.x0 === hfBox[0] - ANCHORS.hollowford.guard && g.y1 === hfBox[3] + ANCHORS.hollowford.guard &&
      smallest && smallest.id === 'dock' && smallest.holders.includes('camp') && JSON.stringify(ow) === '[226,133]' && none === null && JSON.stringify(nw) === JSON.stringify([W.x(60), W.y(70)]) && trackOk,
      { sp, span, obBox, hfBox, g, smallest, ow, none, nw, trackOk });
    // an overlap point is flagged until a human decides it (an OWNERS rect, or a port at that exact point); since Stage 3
    // every one is decided, so no tile inside two old boxes is left open
    const pen = anchorOf(72, 14), gate = anchorOf(13, 72), pal = anchorOf(157, 20), stone = anchorOf(58, 90), alone = anchorOf(140, 80), pond = anchorOf(134, 60), moor = anchorOf(170, 13);
    const undecided = [];
    for (const id in ANCHORS) { const b = ANCHORS[id].box; if (!b) continue;
      for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) { const a = anchorOf(x, y); if (a && a.overlap && undecided.length < 8) undecided.push(x + ',' + y); } }
    check(PF + 'every point inside two old boxes has its owner decided (OWNERS, or a port at that point), none left for a human: the cow pen 72,14 and the south pond 134,60 are thistledown, not the smaller quarry or hollowford; the Gull Isle mooring 170,13 gull_isle, not the smaller dock; the palisade 157,20 the camp, not the smaller dock; the south stones 58,90 the stone circle; the gate 13,72 the graveyard',
      undecided.length === 0 && pen.id === 'thistledown' && pen.decided === 'owner' && !pen.overlap && pond.id === 'thistledown' && pond.decided === 'owner' && moor.id === 'gull_isle' && moor.decided === 'owner' &&
      pal.id === 'camp' && !pal.overlap && stone.id === 'stone_circle' && !stone.overlap && gate.id === 'graveyard' && !gate.overlap && alone.overlap === false && alone.decided === null,
      { undecided, pen, gate, pal, stone, alone, pond, moor });
    // TRACKS hold the spread's network (§5): the Cave Road from the cave mouth by the story signpost to the west gate, and
    // the river from Miller's Pond's outflow under the two road bridges to the sea
    const cave = track('r1_cave'), riv = TRACKS.river, has = (list, pid) => list.some(q => q[0] === 'port' && q[1] === pid);
    const caveOk = JSON.stringify(cave[0]) === JSON.stringify([CAVE_EXIT_X + 1, 7]) && cave.some(q => q[0] === SIGN_TILE.x && q[1] === SIGN_TILE.y) && JSON.stringify(cave[cave.length - 1]) === JSON.stringify(port('thistledown.west_gate'));
    const rivOk = riv[0][0] === 'pond' && has(riv, 'pond.outflow') && has(riv, 'old_bridge.span') && has(riv, 'goblin_road.bridge');
    const mainOk = MAIN_ROADS.length === 6 && MAIN_ROADS.every(id => TRACKS[id] && TRACKS[id].length >= 2) && ROAD_IDS.every(id => TRACKS[id][0][0] === 'port' || TRACKS[id][0][0] === 'n' || FRAMES[TRACKS[id][0][0]]);
    check(PF + "TRACKS hold the spread's road network (section 5: six main roads, their spurs, every end a port or a junction) and its river (Miller's Pond's outflow, under the Old Bridge and the goblin bridge, to the sea)",
      caveOk && rivOk && mainOk, { cave, caveOk, rivOk, mainOk });
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
