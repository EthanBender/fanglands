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
