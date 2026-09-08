// ============================================================================
// PLAYTHROUGH AUDIT — src/42-playthrough.js
// Four groups of self-test checks about whether the game can actually be played from the cave to The Fang:
//   1. connectivity: BFS over the freshly generated overworld from the cave start (and from every place the game
//      teleports you to: the Deepholm ladder, Harl's landings) to every NPC, door step, instance door, map target,
//      board, dock, shrine, gate and boss spawn. A solid target counts as reached when a tile beside it is.
//   2. the main quest chain: stage 0 → 16, each stage's target walked from the previous stage's, with story gates
//      (the warden's gate, the crypt bars, the lair gate) allowed only once the stage that opens them has passed.
//   3. progression gates: every skill level the game asks for, the best XP source below it, and how long it takes
//      at the code's own rates (the same formulas tools/balance.js prints).
//   4. behind window.__fullPlaythrough (node tools/headless.js --play): a bot walks the story with real movement.
// Feature file: registers through HOOKS only, edits no core file. window.PLAYTHROUGH exposes the tables.
// ============================================================================
{
  // ---------- the world as a new game sees it: a snapshot taken every time generateWorld runs ----------
  let PRISTINE = null;
  const _generateWorld = generateWorld;
  generateWorld = () => { _generateWorld(); PRISTINE = map.slice(); };
  const pristine = () => PRISTINE || map;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const Tn = n => (n in T ? T[n] : -1);
  const STORY_GATES = { WARDEN_GATE: 11, LAIR_GATE: 14, CRYPT_BARS: 10 }; // tile name → the main-quest stage that opens it
  const gateId = {}; for (const n in STORY_GATES) gateId[n] = Tn(n);

  // BFS distances over `tiles` from the sources; `pass(t)` says what can be walked (sources are always seeded)
  function flood(tiles, srcs, pass) {
    const dist = new Int32Array(MAP_W * MAP_H).fill(-1), q = [];
    for (const [x, y] of srcs) { if (!inMap(x, y)) continue; const i = idx(x, y); if (dist[i] >= 0) continue; dist[i] = 0; q.push(i); }
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0;
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = ny * MAP_W + nx; if (dist[n] >= 0 || !pass(tiles[n])) continue; dist[n] = dist[c] + 1; q.push(n); }
    }
    return dist;
  }
  // a target is reached when its own tile or a 4-neighbour is (signs, doors, boards and shrines are solid): the route length in tiles, or -1
  function reachOf(dist, x, y) {
    let best = inMap(x, y) && dist[idx(x, y)] >= 0 ? dist[idx(x, y)] : -1;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const d = dist[idx(nx, ny)]; if (d >= 0 && (best < 0 || d + 1 < best)) best = d + 1; }
    return best;
  }
  // an NPC is reached when you can stand within talking range (118 px: two tiles, or a knight's move) on the same side of the walls, as npcInFront asks
  function talkReach(dist, x, y) {
    let best = -1; const inside = insideBuilding(x, y);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { if (Math.hypot(dx, dy) * TILE > 118) continue; const nx = x + dx, ny = y + dy; if (!inMap(nx, ny) || insideBuilding(nx, ny) !== inside) continue; const d = dist[idx(nx, ny)]; if (d >= 0 && (best < 0 || d < best)) best = d; }
    return best;
  }
  const strictPass = t => !SOLID.has(t);
  const openPass = t => !SOLID.has(t) || Object.values(gateId).includes(t);
  const passWithGates = names => { const ids = names.map(n => gateId[n]); return t => !SOLID.has(t) || ids.includes(t); };

  // ---------- where the game puts you down without walking: the roots ----------
  const ROOTS = {
    cave: { at: [Math.floor(SPAWN.x / TILE), Math.floor(SPAWN.y / TILE)], via: 'the cave start' },
    deepholm: { at: [14, 75], via: 'the Grey Quarry shaft (56,6)' },
    gull: { at: [173, 13], via: "Harl's ferry (10 coins)" },
    ironclad: { at: [180, 50], via: "Harl's ferry (25 coins, combat 8)" },
    farshore: { at: [206, 30], via: "Harl's ferry (40 coins, combat 10)" },
  };
  const rootFor = (x, y) => x >= 200 ? 'farshore' : (x >= 2 && x <= 26 && y >= 72 && y <= 94) ? 'deepholm' : (x >= 169 && x <= 186 && y >= 5 && y <= 21) ? 'gull' : (x >= 176 && x <= 197 && y >= 39 && y <= 61) ? 'ironclad' : 'cave';

  // ---------- the targets ----------
  // feature NPCs that live in their own lists (25-elves, 24-dwarves, 26-boats, 33-goblincity, 31-rebuild, 41-guild): known tiles from those files
  const CLOSURE_NPCS = [
    ['Queen Aelith', 133, 119], ['Lira', 158, 119], ['Thessaly', 133, 129], ['Faelan', 150, 132],
    ['King Thrain', 14, 93], ['Brunhild', 12, 81], ['Dagny', 16, 76], ['Orik', 16, 85], ['Hilde', 10, 90],
    ['Old Harl (dock)', 165, 14], ['Salt Pete', 181, 14],
    ['Tinkerton (castle gate)', 226, 52], ['Grubb', 216, 23], ['Nix', 230, 23], ['Old Snaggle', 216, 37], ['Pip-squeak', 222, 33], ['King Gnash', 224, 67], ['Mudge', 234, 32], ['Skritch', 219, 27], ['Ratchet', 230, 27],
    ['Old Tam (rebuilt square)', 137, 81], ['Nell (rebuilt square)', 140, 77], ['Pip (rebuilt square)', 142, 81],
    ['Guild staff (board)', 152, 68], ['Guild staff (chest)', 155, 68], ['Guild staff (door)', 153, 70],
  ];
  const LANDMARK_TILES = ['SIGN', 'AXESTUMP', 'CART', 'GRAVE', 'STONECIRCLE', 'CHEST', 'BOARD', 'REBUILD_BOARD', 'GUILD_BOARD', 'GUILD_CHEST', 'BOAT', 'SHRINE', 'WIND_SHRINE', 'SUMMON_CIRCLE', 'FANG_CHEST', 'FANG_HOARD',
    'SHAFT', 'LADDER_UP', 'DWARF_CHEST', 'DWARF_THRONE', 'STRONGBOX', 'BOTTLE', 'HULL', 'DOZER_BAY', 'LOOM', 'TOTEM', 'CAGE', 'WELL', 'HATCH', 'CRYPT_BARS', 'GATE', 'PORTCULLIS', 'WARDEN_GATE', 'LAIR_GATE', 'DUNGEON_DOOR',
    'DUMMY', 'SAWMILL', 'GOODWELL', 'BELLTOWER', 'GNASH_THRONE', 'GNASH_CHEST', 'ARENA_LEVER', 'MITHRIL', 'OBSIDIAN', 'LOBSTER_WATER', 'TARGET', 'THRONE', 'ANVIL', 'FORGE', 'OVEN', 'STEPPING_STONE', 'CLIMB'];
  const LANDMARK_CAP = 8; // tiles listed per type (gates, dummies, chests: all of them; mithril rocks, targets, stones: the first eight)
  const LANDINGS = [['dock landing', 164, 14], ['Gull Isle landing', 173, 13], ['Ironclad Isle landing', 180, 50], ['Far Shore landing', 206, 30]];
  const BOSS_TYPES = new Set(['walker', 'bulldozer', 'barrelbeast', 'ash_drake', 'green_dragon', 'red_dragon', 'the_fang', 'yard_walker', 'yard_dozer', 'castle_guard', 'dwarf_guard', 'elf_sentinel']);

  function targets() {
    const out = [], push = (group, name, x, y) => out.push({ group, name, x, y, root: rootFor(x, y) });
    for (const n of NPCS) push('npc', n.name + (n.id ? ` (${n.id})` : ''), n.x, n.y);
    for (const [name, x, y] of CLOSURE_NPCS) push('npc', name, x, y);
    for (const b of BUILDINGS) { if (b.door !== undefined) push('door', `${b.name} [${b.id}] door step`, b.x + b.door, b.y + b.h); if (b.doorTop !== undefined) push('door', `${b.name} [${b.id}] door step`, b.x + b.doorTop, b.y - 1); }
    if (window.INSTANCES) for (const id of INSTANCES.list()) { const i = INSTANCES.get(id); if (i.door) push('instance', `${i.name} door`, i.door[0], i.door[1]); if (i.step) push('instance', `${i.name} step`, i.step[0], i.step[1]); }
    push('instance', 'Aerie: the wind shrine (36-skycity)', 62, 6); push('instance', 'The Afterlands: the last knight\'s grave (35-night)', 12, 70);
    const seen = new Set();
    for (let s = 0; s <= 16; s++) { const t = MAP_TARGETS[s]; if (!t) continue; const k = t.x + ',' + t.y; if (seen.has(k)) continue; seen.add(k); push('maptarget', `MAP_TARGETS[${s}] ${t.label}`, t.x, t.y); }
    for (const t of mapTargets()) { const k = t.x + ',' + t.y; if (seen.has(k)) continue; seen.add(k); push('maptarget', `mapTarget ${t.label} (${t.id})`, t.x, t.y); }
    for (const [name, x, y, id] of [["Tinkerton's lab (tinker)", 247, 42], ['King Gnash (gnash)', 224, 67], ['The wind shrine (sky)', 62, 6], ['Notice board (board)', 105, 27], ['Captain of the Watch (law)', 110, 41], ['Dunstan (dragons)', 66, 100], ['Old Wren (wren)', 30, 78], ['Tobin (bread)', 110, 33]]) { const k = x + ',' + y; if (seen.has(k)) continue; seen.add(k); push('maptarget', `mapTarget ${name}`, x, y); }
    const tiles = pristine(), counts = {};
    // decoration is skipped: the bank's chests behind the counter; the second row of a lobster buoy and the middle stones of the pond crossing (only tiles that touch walkable ground are places to stand)
    const touchesGround = (x, y) => N4.some(([dx, dy]) => inMap(x + dx, y + dy) && !SOLID.has(tiles[idx(x + dx, y + dy)]));
    const skip = (n, x, y) => (n === 'CHEST' && buildingAt(x, y) && buildingAt(x, y).id === 'bank') || ((n === 'LOBSTER_WATER' || n === 'STEPPING_STONE') && !touchesGround(x, y));
    for (const n of LANDMARK_TILES) { const t = Tn(n); if (t < 0) continue; let c = 0; for (let y = 0; y < MAP_H && c < LANDMARK_CAP; y++) for (let x = 0; x < MAP_W && c < LANDMARK_CAP; x++) if (tiles[idx(x, y)] === t && !skip(n, x, y)) { c++; push('landmark', `${n} #${c}`, x, y); } counts[n] = c; }
    for (const [name, x, y] of LANDINGS) push('landing', name, x, y);
    for (const s of MONSTER_SPAWNS) if (BOSS_TYPES.has(s.type)) push('spawn', `${MONSTER_DEFS[s.type].name} spawn`, s.tx, s.ty);
    return out;
  }

  function connectivity() {
    const tiles = pristine(), dists = {}, opens = {};
    for (const k in ROOTS) { dists[k] = flood(tiles, [ROOTS[k].at], strictPass); opens[k] = flood(tiles, [ROOTS[k].at], openPass); }
    const single = {}; for (const g in STORY_GATES) single[g] = null;
    const rows = targets().map(t => {
      const reach = t.group === 'npc' ? talkReach : reachOf;
      const strict = reach(dists[t.root], t.x, t.y), open = reach(opens[t.root], t.x, t.y);
      let gate = null;
      if (strict < 0 && open >= 0) for (const g in STORY_GATES) { if (!single[g]) single[g] = {}; if (!single[g][t.root]) single[g][t.root] = flood(tiles, [ROOTS[t.root].at], passWithGates([g])); if (reach(single[g][t.root], t.x, t.y) >= 0) { gate = g; break; } }
      return { ...t, strict, open, dist: open >= 0 ? open : strict, gate, via: ROOTS[t.root].via };
    });
    // the roots themselves: the shaft and Harl must be reachable from the cave, or the root is a fiction
    const rootOk = { cave: true, deepholm: reachOf(dists.cave, 56, 6) >= 0, gull: reachOf(dists.cave, 165, 14) >= 0, ironclad: reachOf(dists.cave, 165, 14) >= 0, farshore: reachOf(dists.cave, 165, 14) >= 0 };
    for (const r of rows) if (!rootOk[r.root]) { r.strict = -1; r.open = -1; r.gate = null; }
    const unreachable = rows.filter(r => r.open < 0).map(r => `${r.name} @${r.x},${r.y} [${r.group}, from ${r.root}]`);
    const gated = rows.filter(r => r.strict < 0 && r.open >= 0).map(r => `${r.name} @${r.x},${r.y} behind ${r.gate || 'a story gate'}`);
    return { rows, unreachable, gated, rootOk };
  }

  // ---------- instances: entry → exit, boss, chest, the folk inside ----------
  function instanceConnectivity() {
    const out = [];
    if (!window.INSTANCES) return out;
    const KNOWN = { aerie: [['Queen Seraphel', 25, 6], ['Master Halcyon', 38, 18], ['the leap down', 25, 31]], tinker_lab: [['Tinkerton (lab)', 4, 3], ['the Gnasher rug', 12, 9], ['the arena lever', 21, 15]], afterlands: [['the fire', 30, 8], ['Count Ashvane', 46, 18], ['the crypt door out', 30, 2]], spider_den: [['the chest', 3, 26], ['the Brood Mother', 12, 22]] };
    for (const id of INSTANCES.list()) {
      const inst = INSTANCES.get(id); const W = inst.w, H = inst.h, tiles = inst.tiles;
      const dist = new Int32Array(W * H).fill(-1), q = []; const s = inst.entry[1] * W + inst.entry[0]; dist[s] = 0; q.push(s);
      for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % W, y = (c / W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (dist[n] >= 0 || SOLID.has(tiles[n])) continue; dist[n] = dist[c] + 1; q.push(n); } }
      const at = (x, y) => { let best = x >= 0 && y >= 0 && x < W && y < H && dist[y * W + x] >= 0 ? dist[y * W + x] : -1; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const d = dist[ny * W + nx]; if (d >= 0 && (best < 0 || d + 1 < best)) best = d + 1; } return best; };
      const want = [];
      if (inst.exit) want.push(['the exit', inst.exit[0], inst.exit[1]]);
      for (const [type, x, y] of inst.spawns) if (type === inst.boss) want.push([MONSTER_DEFS[type].name, x, y]);
      for (const w of KNOWN[id] || []) want.push(w);
      for (const [name, x, y] of want) out.push({ instance: inst.name, name, x, y, dist: at(x, y) });
    }
    return out;
  }

  // ---------- the main quest chain ----------
  const nearestGoblins = n => { const ex = CAVE_EXIT_X + 1; return MONSTER_SPAWNS.filter(s => s.type === 'goblin').map(s => ({ s, d: Math.hypot(s.tx - ex, s.ty - 7) })).sort((a, b) => a.d - b.d).slice(0, n).map(o => [o.s.tx, o.s.ty]); };
  const nearestTileTo = (tiles, types, fx, fy) => { let best = null; for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (types.includes(tiles[idx(x, y)])) { const d = Math.hypot(x - fx, y - fy); if (!best || d < best.d) best = { x, y, d }; } return best; };
  function chainStages() {
    const tiles = pristine(), tree = nearestTileTo(tiles, [T.TREE], 85, 32) || { x: 84, y: 30 };
    return [
      { stage: 0, what: 'wake in the cave', at: [ROOTS.cave.at] },
      { stage: 1, what: 'the wooden sword in the light', at: [[Math.floor(SWORD_POS.x / TILE), Math.floor(SWORD_POS.y / TILE)]] },
      { stage: 2, what: 'the cave mouth (x > 21.5)', at: [[CAVE_EXIT_X + 2, 7]] },
      { stage: 3, what: 'three goblins (the nearest spawns to the cave)', at: nearestGoblins(3) },
      { stage: 4, what: 'the signpost (E)', at: [[SIGN_TILE.x, SIGN_TILE.y]] },
      { stage: 5, what: 'Duke Ferrin in the keep', at: [[112, 49]] },
      { stage: 6, what: "Hale's dummy, a tree by the village, then the Duke", at: [[88, 42], [tree.x, tree.y], [112, 49]] },
      { stage: 7, what: 'the goblin walker in the camp, then the Duke', at: [[152, 30], [112, 49]] },
      { stage: 8, what: 'the edge of Hollowford (region entry)', at: [[140, 66]] },
      { stage: 9, what: 'the Barrelbeast in the yard', at: [[140, 86]] },
      { stage: 10, what: 'Old Tam in the chapel crypt (crypt bars: hammer, beast dead)', at: [[126, 88]], gate: 'CRYPT_BARS' },
      { stage: 11, what: "into the Ashfields past Warden Brann's gate", at: [[60, 97]], gate: 'WARDEN_GATE' },
      { stage: 12, what: 'Dunstan the dung farmer', at: [[67, 104]] },
      { stage: 13, what: 'the four ash drakes, then Dunstan', at: [[52, 100], [56, 110], [74, 110], [80, 100], [67, 104]] },
      { stage: 14, what: 'Old Wren, the wind shrine (Aerie), the Duke, the lair gate, the summoning circle, The Fang', at: [[30, 78], [62, 6], [112, 49], [18, 108], [18, 117], [18, 121]], gate: 'LAIR_GATE' },
      { stage: 15, what: 'home to Duke Ferrin', at: [[112, 49]] },
      { stage: 16, what: 'the knight of legend (credits)', at: [[112, 49]] },
    ];
  }
  function chain() {
    const tiles = pristine(), stages = chainStages(), rows = [];
    let from = stages[0].at[0];
    for (const st of stages) {
      const allowed = Object.keys(STORY_GATES).filter(g => STORY_GATES[g] <= st.stage);
      const legs = [];
      for (const to of st.at) {
        const all = Object.keys(STORY_GATES);
        const allD = reachOf(flood(tiles, [from], passWithGates(all)), to[0], to[1]);
        // a gate is needed for this leg when the walk fails with every OTHER gate open; it must be one a prior (or this) stage opens
        const needed = allD < 0 ? [] : all.filter(g => reachOf(flood(tiles, [from], passWithGates(all.filter(o => o !== g))), to[0], to[1]) < 0);
        const late = needed.filter(g => STORY_GATES[g] > st.stage);
        const okD = reachOf(flood(tiles, [from], passWithGates(allowed)), to[0], to[1]);
        legs.push({ from: from.slice(), to: to.slice(), dist: okD >= 0 ? okD : allD, gate: needed.join('+') || null, opensAt: needed.length ? Math.max(...needed.map(g => STORY_GATES[g])) : null, late, ok: okD >= 0 && late.length === 0 });
        from = to;
      }
      rows.push({ stage: st.stage, what: st.what, legs, ok: legs.every(l => l.ok), gate: st.gate || null, dist: legs.reduce((s, l) => s + Math.max(0, l.dist), 0) });
    }
    return rows;
  }

  // ---------- progression: gates and sources, at the code's own rates ----------
  // the same formulas tools/balance.js prints: accuracy, seconds per gather (chance × swing time), kill time
  const acc = (a, d) => a > d ? 1 - (d + 2) / (2 * (a + 1)) : a / (2 * (d + 1));
  const gatherSecs = (lv, req, tier = 1, base = 2.2) => { const chance = Math.min(0.9, 0.35 + (lv - req) * 0.02 + tier * 0.1); return Math.max(0.9, base - tier * 0.4) / chance; };
  const fishSecs = (lv, need = 1.8, base = 0.45) => need / Math.min(0.9, base + lv * 0.02);
  const loadout = L => L < 5 ? { w: 'wooden_sword', armour: 0 } : L < 12 ? { w: 'iron_dagger', armour: 6 } : L < 22 ? { w: 'iron_sword', armour: 32 } : L < 32 ? { w: 'steel_sword', armour: 55 } : { w: ITEMS.mithril_sword ? 'mithril_sword' : 'steel_sword', armour: 76 };
  function killSecs(type, L) {
    const m = MONSTER_DEFS[type], lo = loadout(L), w = ITEMS[lo.w].weapon;
    const maxHit = 2 + Math.floor((L + 8) * (w.str + 64) / 300), pAcc = acc((L + 8) * (64 + w.att), (m.def + 8) * 64), dps = pAcc * (1 + maxHit) / 2 / w.cd;
    const mAcc = acc((m.att + 8) * 64, (L + 8) * (64 + lo.armour)), taken = mAcc * (1 + m.maxHit) / 2 / (m.mech ? 1.6 : 1.1) * (m.hp / dps);
    return { ttk: m.hp / dps, taken, hit: pAcc };
  }
  const killXp = type => { const m = MONSTER_DEFS[type]; return m.hp * 4 + (m.level >= 10 ? m.level * 10 : 0); };
  // what a recipe's materials cost in seconds at the code's own gather rates (bronze tools, at the level each opens); a bar is its ore plus a smelt
  const MATERIAL_SECS = { wood: 4, oak_log: 4, jungle_log: 2.2, stone: 4, iron_ore: 4, coal: 4, mithril_ore: 2, obsidian: 2.2, iron_bar: 5.5, steel_bar: 9.5, mithril_bar: 11.5, plank: 2, spider_silk: 10, wool: 8, blast_powder: 15, goblin_scrap: 10, potato: 40, wheat: 40, berries: 5, flour: 80, raw_beef: 10, raw_trout: 8, dragon_scale: 60, scale_plate: 180 };
  const materialSecs = needs => needs.reduce((s, [id, q]) => s + q * (MATERIAL_SECS[id] || 10), 0);
  // how many of a monster the world offers per hour: spawns × respawn (the Goblin Camp's own refill every 1800 s)
  const supplyPerHour = type => { let n = 0; for (const s of MONSTER_SPAWNS) if (s.type === type) n += 3600 / (s.camp ? 1800 : (MONSTER_DEFS[type].respawn || 25)); return n; };
  const lapSecs = marks => { let tiles = 0; for (let i = 0; i < marks.length; i++) { const a = marks[i], b = marks[(i + 1) % marks.length]; tiles += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); } return tiles * TILE / 175 + 2 * TILE * (1 / 60 - 1 / 175); }; // two net tiles at speed 60
  function sources() {
    const S = {};
    const add = (skill, name, req, xp, secs, note, cap) => { let rate = secs > 0 ? xp * 3600 / secs : null; if (rate && cap) rate = Math.min(rate, cap); (S[skill] = S[skill] || []).push({ name, req, xp, secs, rate: rate === null ? null : Math.round(rate), note: note || '', passive: xp === 0 }); };
    const kill = (type, name, req, note) => add('melee', name, req, killXp(type), killSecs(type, req).ttk + 3, `${note || ''} ${Math.round(supplyPerHour(type))}/h in the world`.trim(), killXp(type) * supplyPerHour(type));
    const G = { woodcutting: [['tree', T.TREE], ['oak', T.OAK]], mining: [['rock', T.ROCK], ['iron rock', T.IRON], ['coal rock', T.COAL]] };
    for (const skill in G) for (const [name, t] of G[skill]) { const g = GATHER[t]; add(skill, name, g.lv, g.xp, gatherSecs(g.lv, g.lv), 'bronze tool, at the level it opens'); }
    if (Tn('JUNGLE') >= 0) add('woodcutting', 'jungle tree', 15, 60, 2.2, 'every swing lands (25-elves)');
    if (Tn('MITHRIL') >= 0) add('mining', 'mithril rock', 20, 80, 2.0, 'every swing lands (24-dwarves)');
    if (Tn('OBSIDIAN') >= 0) add('mining', 'obsidian', 28, 120, 2.2, 'every swing lands (27-dragons)');
    add('fishing', 'shrimp', 1, 10, fishSecs(1), 'rod at the pond'); add('fishing', 'trout (45% of catches)', 5, 0.45 * 30 + 0.55 * 10, fishSecs(5), 'average xp per catch from level 5');
    if (ITEMS.lobster_pot) add('fishing', 'lobster', 25, 90, 2.2 / 0.55, 'pot at Gull Isle');
    add('cooking', 'cook raw food at a fire', 1, 30, 1.2, 'plus the fish or beef'); add('cooking', "Tobin's loaf (once)", 1, 40, 0, 'quest');
    for (const r of RECIPES) if (r.skill && r.skill !== 'smithing') add(r.skill, r.label, r.lv, r.xp, materialSecs(r.needs), (r.station || 'from the pack') + ', materials at gather rates');
    for (const s of SMELT) add('smithing', s.label, s.lv, s.xp, 1.5 + materialSecs(s.needs), 'forge, ore at gather rates');
    for (const r of RECIPES) if (r.skill === 'smithing' && r.station === 'anvil') add('smithing', r.label, r.lv, r.xp, 1.8 + materialSecs(r.needs), 'anvil, bars at gather + smelt rates');
    if (window.INSTANCES && INSTANCES.get('aerie')) add('smithing', "Halcyon's sky forge (Godly Plated)", 30, 500, 0, 'dragon scale + mithril + obsidian, no anvil (36-skycity)');
    add('smithing', 'King Thrain (once)', 1, 200, 0, 'quest'); add('smithing', 'Queen Seraphel (once)', 1, 300, 0, 'quest');
    add('firemaking', 'logs', 1, 40, 1.5, ''); add('firemaking', 'oak logs', 1, 60, 1.5, ''); if (ITEMS.jungle_log) add('firemaking', 'jungle logs', 1, 90, 1.5, '');
    add('farming', 'a potato crop (till, plant, 3 growth stages, harvest 2-4)', 1, 5 + 8 + 15 * 3, 120, 'per plot; plots run in parallel'); if (ITEMS.dragon_dung) add('farming', 'Dunstan (once)', 1, 150, 0, 'quest');
    add('crafting', 'repair the walker (once per wreck)', 1, 120, 0, '3 bars + 4 scrap'); if (window.DOZERUP) for (const u of DOZERUP.UPGRADES) add('crafting', `dozer upgrade: ${u.name}`, u.lv, u.xp, 0, 'blueprint + parts, once (40-dozerup)');
    add('crafting', "Pim's powder run / Thessaly's wool (once each)", 1, 300, 0, 'notice board'); if (ITEMS.jungle_log) add('crafting', 'Queen Aelith (once)', 1, 150, 0, 'quest');
    add('range', 'arrows on a goblin (4 xp per damage)', 1, 4 * 3, 0.6, 'stone arrows, avg hit 3'); add('range', "Wren's silk (once)", 1, 60, 0, 'quest'); if (ITEMS.elven_arrow) add('range', "Lira's twenty (once)", 1, 500, 0, 'quest');
    for (const f of HOOKS.xpSource) { try { f(add); } catch (e) { } } // features declare their own (45-progression)
    kill('goblin', 'goblin soldier', 1, 'walk + kill;'); kill('wolf', 'wolf', 6); kill('sapper', 'goblin sapper', 7); kill('brute', 'goblin brute', 9); kill('walker', 'goblin walker', 18);
    if (MONSTER_DEFS.barrelbeast) add('melee', 'the Barrelbeast (once)', 28, killXp('barrelbeast'), 0, 'boss, dies once');
    if (MONSTER_DEFS.ash_drake) kill('ash_drake', 'ash drake', 30); if (MONSTER_DEFS.green_dragon) kill('green_dragon', 'green dragon', 45); if (MONSTER_DEFS.red_dragon) kill('red_dragon', 'red dragon', 60);
    add('defence', 'being hit (1.5 xp per damage)', 1, 1.5 * 2, 1.1, 'a goblin, avg hit 2');
    add('hitpoints', 'a third of Melee and Range xp', 1, 0, 0, 'passive (38-agility)');
    add('agility', 'Thistledown yard course (lap)', 1, 60, lapSecs([[86, 51], [93, 51], [98, 51], [99, 53], [92, 53]]), 'all obstacles level 1');
    add('agility', 'Grey Quarry cliff course (lap)', 30, 200, lapSecs([[47, 1], [53, 1], [57, 1], [60, 3], [52, 3]]), 'the gap at (57,3) needs Agility 30; the logs 20');
    for (const k in S) S[k].sort((a, b) => a.req - b.req || b.xp - a.xp);
    return S;
  }
  function gates() {
    const G = [];
    const add = (skill, lv, what, kind) => G.push({ skill, lv, what, kind: kind || 'level' });
    add('woodcutting', 3, "Duke Ferrin's training (stage 6)", 'quest'); add('melee', 5, "Duke Ferrin's training (stage 6)", 'quest');
    for (const t in GATHER) { const g = GATHER[t]; if (g.lv > 1) add(g.skill, g.lv, `gather ${g.label}`); }
    if (Tn('JUNGLE') >= 0) add('woodcutting', 15, 'jungle trees (Queen Aelith wants 8 logs)'); if (Tn('MITHRIL') >= 0) add('mining', 20, 'mithril rock'); if (Tn('OBSIDIAN') >= 0) add('mining', 28, 'obsidian (Godly Plated needs one per piece)');
    add('fishing', 5, 'trout'); if (ITEMS.lobster_pot) add('fishing', 25, 'lobster pots');
    for (const r of RECIPES) if (r.skill && r.lv > 1) add(r.skill, r.lv, r.label + (r.station === 'skyforge' ? ' [anvil recipe, dead: Halcyon forges it at 30]' : ''));
    for (const s of SMELT) if (s.lv > 1) add('smithing', s.lv, s.label);
    if (window.INSTANCES && INSTANCES.get('aerie')) add('smithing', 30, "Halcyon's sky forge (Godly Plated)");
    if (window.DOZERUP) for (const u of DOZERUP.UPGRADES) add('crafting', u.lv, `dozer upgrade: ${u.name}`);
    add('agility', 10, "Miller's Pond stepping stones (shortcut)"); add('agility', 25, "the Goblin Camp's crumbling palisade (shortcut)"); add('agility', 20, 'the cliff course logs and first gap'); add('agility', 30, 'the cliff course second gap (a full lap)');
    add('melee', 6, 'hire Garrick (combat level)', 'combat'); add('melee', 8, 'Ironclad Isle (combat level)', 'combat'); add('melee', 10, 'the Far Shore (combat level)', 'combat');
    for (const [type, what] of [['brood_mother', 'the Spider Den boss'], ['walker', 'the goblin walker (stage 7)'], ['gnasher', "the Gnasher (Tinkerton's lab)"], ['barrelbeast', 'the Barrelbeast (stage 9)'], ['ash_drake', 'ash drakes (stage 13)'], ['count_ashvane', 'Count Ashvane (the Afterlands)'], ['green_dragon', 'green dragons (scales)'], ['the_fang', 'The Fang (stage 14)']]) if (MONSTER_DEFS[type]) add('melee', MONSTER_DEFS[type].level, `${what}: monster level ${MONSTER_DEFS[type].level}`, 'boss');
    for (const s of SKILL_DEFS) add(s.key, 99, `${s.name} cape (Master of Skills)`, 'cape');
    G.sort((a, b) => a.skill.localeCompare(b.skill) || a.lv - b.lv);
    return G;
  }
  function progression() {
    const S = sources(), G = gates(), rows = [], bands = {};
    for (const g of G) {
      const list = S[g.skill] || [];
      const below = list.filter(s => s.req < g.lv && (s.xp > 0 || s.passive)), best = below.filter(s => !s.passive).slice().sort((a, b) => (b.rate || 0) - (a.rate || 0) || b.xp - a.xp)[0] || below[0] || null;
      const lastNew = below.reduce((m, s) => Math.max(m, s.req), below.length ? 0 : g.lv);
      const hours = best && best.rate ? +(XP_TABLE[Math.min(99, g.lv)] / best.rate).toFixed(2) : null;
      const gap = g.lv - lastNew;
      if (g.kind !== 'cape' && (!bands[g.skill] || gap > bands[g.skill].gap)) bands[g.skill] = { gap, at: g.lv, lastNew };
      rows.push({ ...g, xp: XP_TABLE[Math.min(99, g.lv)], best: best ? best.name : null, bestReq: best ? best.req : null, bestXp: best ? +best.xp.toFixed(1) : null, rate: best ? best.rate : null, hours, gap, dead: !best, passive: !!(best && best.passive) });
    }
    return { rows, bands, sources: S };
  }

  // ---------- the bot playthrough (window.__fullPlaythrough) ----------
  const F = () => window.FANGLANDS;
  const HOSTILE = Object.keys(MONSTER_DEFS).filter(k => MONSTER_DEFS[k].aggro && !MONSTER_DEFS[k].harmless && !MONSTER_DEFS[k].human);
  const PLAY = { steps: 0, budget: 0, healed: 0, meals: 0, deaths: 0, tps: [], forced: [], stages: [], log: [], last: '', started: 0, stage: 0 };
  const note = s => { PLAY.last = s; PLAY.log.push(`[${quest.stage}] ${s}`); };
  const tick = held => { F().step(held || []); PLAY.steps++; };
  const sim = (n, held) => { for (let i = 0; i < n; i++) tick(held); };
  const over = () => PLAY.steps > PLAY.budget;
  const ptx = () => Math.floor(player.x / TILE), pty = () => Math.floor(player.y / TILE);
  // the bot eats: whenever its hp drops under half, or under the biggest hit of anything chasing it, it is healed and the meal is counted
  function heal() {
    if (player.dead || player.mech) return;
    let threat = 0; for (const m of monsters) if (!m.dead && m.state === 'chase' && dist(m.x, m.y, player.x, player.y) < 6 * TILE) threat = Math.max(threat, MONSTER_DEFS[m.type].maxHit || 0);
    const th = Math.min(player.maxHp - 1, Math.max(Math.ceil(player.maxHp * 0.5), threat + 2));
    if (player.hp < th) { PLAY.healed += player.maxHp - player.hp; PLAY.meals++; player.hp = player.maxHp; }
  }
  function afterDeath() {
    PLAY.deaths++; note(`died at ${ptx()},${pty()}`); let n = 0; while (player.dead && n++ < 400) tick();
    if (deathKeep && coins() + (deathKeep.items.find(s => s.id === 'coins') || { qty: 0 }).qty >= coffinFee()) { const dh = BUILDINGS.find(b => b.id === 'death2'); if (dh && walk(dh.x + dh.door, dh.y + dh.h - 2)) { F().face(134, 50); F().press('KeyE'); PLAY.steps++; F().clickButton('Reclaim everything'); closePanel(); note('reclaimed the pack from Death'); } }
  }
  const chasing = r => monsters.filter(m => !m.dead && HOSTILE.includes(m.type) && m.state === 'chase' && dist(m.x, m.y, player.x, player.y) < r);
  // the pack is 20 slots: a real player banks or drops the junk; the bot drops it (counted) so quest items and loot still fit
  const KEEP = new Set(['coins', 'hammer', 'iron_bar', 'iron_ore', 'coal', 'goblin_scrap', 'blast_powder', 'bread', 'spider_silk', 'dragon_dung', 'dragon_scale', 'cloud_essence', 'wind_flute', 'dragon_horn', 'obsidian', 'mithril_bar', 'steel_bar']);
  const wanted = id => KEEP.has(id) || !!(ITEMS[id] && (ITEMS[id].tool || ITEMS[id].weapon || ITEMS[id].armour));
  function tidy(minFree = 4) {
    let free = player.inv.filter(s => !s).length; if (free >= minFree) return;
    for (let i = player.inv.length - 1; i >= 0 && free < minFree + 2; i--) { const s = player.inv[i]; if (!s || wanted(s.id)) continue; PLAY.junk = (PLAY.junk || 0) + s.qty; player.inv[i] = null; free++; }
    if (free < minFree) for (let i = player.inv.length - 1; i >= 0 && free < minFree; i--) { const s = player.inv[i]; if (!s || s.id === 'coins' || ['spider_silk', 'dragon_dung', 'dragon_scale', 'cloud_essence', 'wind_flute', 'dragon_horn'].includes(s.id) || (ITEMS[s.id].weapon || ITEMS[s.id].armour || ITEMS[s.id].tool)) continue; PLAY.junk = (PLAY.junk || 0) + s.qty; player.inv[i] = null; free++; }
  }
  // pick up what the last fight dropped: step onto every drop within reach (the core picks up within 25 px of the knight)
  function loot(radius = 4 * TILE) {
    tidy();
    for (let n = 0; n < 12 && !over(); n++) {
      const ds = drops.filter(d => dist(d.x, d.y, player.x, player.y) < radius && !d.skip && canFit(d.id, 1)).sort((a, b) => dist(a.x, a.y, player.x, player.y) - dist(b.x, b.y, player.x, player.y)); if (!ds.length) return;
      const d = ds[0]; let s = 0; d.warned = false;
      while (drops.includes(d) && s++ < 150 && !player.dead) { const dx = d.x - player.x, dy = d.y - player.y; if (Math.hypot(dx, dy) < 6) { tick(); continue; } const h = []; if (Math.abs(dx) > 1) h.push(dx > 0 ? 'KeyD' : 'KeyA'); if (Math.abs(dy) > 1) h.push(dy > 0 ? 'KeyS' : 'KeyW'); tick(h); }
      if (drops.includes(d)) d.skip = true; // stuck behind something: leave it
    }
  }
  function brawl(types, max, radius = 6 * TILE) {
    let s = 0, stuck = 0, lx = 0, ly = 0;
    while (s < max && !over()) {
      heal(); if (player.dead) { afterDeath(); return 'died'; }
      const gs = monsters.filter(m => types.includes(m.type) && !m.dead && dist(m.x, m.y, player.x, player.y) < radius); if (!gs.length) { loot(); return s; }
      gs.sort((a, b) => dist(a.x, a.y, player.x, player.y) - dist(b.x, b.y, player.x, player.y)); const g = gs[0];
      const dx = g.x - player.x, dy = g.y - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d };
      if (d < g.r + 50) { pressed.add('Space'); tick(); for (let k = 0; k < 5; k++) { heal(); tick(); } s += 6; }
      else {
        if (Math.abs(player.x - lx) < 0.5 && Math.abs(player.y - ly) < 0.5) stuck++; else stuck = 0; lx = player.x; ly = player.y;
        if (stuck > 30) { stuck = 0; const r = F().walkTo(Math.floor(g.x / TILE), Math.floor(g.y / TILE), 400); PLAY.steps += typeof r === 'number' ? r : 400; s += 400; if (r === 'nopath') { g.x = player.x + 60; g.y = player.y; note(`nudged a stuck ${g.type} (nopath)`); } }
        else { tick(F().held(dx, dy)); s++; }
      }
    }
    return 'timeout';
  }
  // walk somewhere with real movement; what attacks on the way gets fought
  function walk(tx, ty, adjacent = false, max = 6000) {
    for (let attempt = 0; attempt < 8 && !over(); attempt++) {
      const r = adjacent ? F().goAdjacent(tx, ty, max) : F().walkTo(tx, ty, max);
      if (typeof r === 'number') { PLAY.steps += r; return true; }
      if (r !== 'nopath') PLAY.steps += max;
      if (player.dead) { afterDeath(); continue; }
      if (r === 'nopath') { if (!adjacent) { const r2 = F().goAdjacent(tx, ty, max); if (typeof r2 === 'number') { PLAY.steps += r2; return true; } } note(`no path to ${tx},${ty} from ${ptx()},${pty()}`); return false; }
      brawl(HOSTILE, 3000); heal();
    }
    return false;
  }
  const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
  function talk(id) {
    const n = NPCS.find(n => n.id === id); if (!n) { note(`no NPC ${id}`); return false; }
    for (let attempt = 0; attempt < 4 && !over(); attempt++) {
      closePanel(); const r = F().talk(id); PLAY.steps += typeof r === 'number' ? r + 3 : 4003;
      if (typeof r === 'number') return true;
      if (player.dead) { afterDeath(); continue; }
      const b = insideBuilding(n.x, n.y); if (b && b.door !== undefined) walk(b.x + b.door, b.y + b.h); else if (b && b.doorTop !== undefined) walk(b.x + b.doorTop, b.y - 1); else brawl(HOSTILE, 3000);
    }
    note(`could not reach ${id} to talk`); return false;
  }
  function useAt(tx, ty) { if (!walk(tx, ty, true)) return false; F().face(tx, ty); F().press('KeyE'); PLAY.steps++; sim(2); return true; }
  // a timed action on a tile (chop, mine, fish): press E until the item count rises, fighting off whatever interrupts
  function harvest(tx, ty, itemId, max = 900) {
    const c0 = countItem(itemId); let s = 0; tidy(2);
    if (!walk(tx, ty, true)) return false;
    while (countItem(itemId) === c0 && s < max && !over()) {
      if (chasing(4 * TILE).length) { brawl(HOSTILE, 2000); if (!walk(tx, ty, true)) return false; }
      if (!player.action) { F().face(tx, ty); F().press('KeyE'); PLAY.steps++; if (!player.action && notice) { note(`E on ${tx},${ty}: ${notice.text}`); return false; } }
      tick(); s++; heal(); if (player.dead) { afterDeath(); return false; }
    }
    return countItem(itemId) > c0;
  }
  // the nearest tile of a type that has a walkable side the knight can actually get to (quarry rock stands in solid blocks)
  function nearestReachable(types, from, skip) {
    const fx = from ? from.x : player.x, fy = from ? from.y : player.y, cands = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (types.includes(map[idx(x, y)]) && !(skip && skip.has(idx(x, y)))) cands.push({ x, y, d: dist(tc(x), tc(y), fx, fy) });
    cands.sort((a, b) => a.d - b.d);
    for (const c of cands.slice(0, 40)) for (const [dx, dy] of N4) { const ax = c.x + dx, ay = c.y + dy; if (inMap(ax, ay) && !SOLID.has(map[idx(ax, ay)]) && F().bfs(ptx(), pty(), ax, ay)) return c; }
    return null;
  }
  function gather(types, itemId, want, from) {
    let guard = 0; const tried = new Set();
    while (countItem(itemId) < want && guard++ < 40 && !over()) {
      const t = nearestReachable(types, from, tried); if (!t) { note(`no reachable ${itemId} tile`); return false; }
      if (!harvest(t.x, t.y, itemId)) tried.add(idx(t.x, t.y));
    }
    return countItem(itemId) >= want;
  }
  function grindTo(skill, lv, types, spots, max, stop) {
    let s = 0, i = 0; note(`grinding ${skill} to ${lv === 99 ? 'the stage' : lv} on ${types.join('/')}`);
    while (skillLv(skill) < lv && s < max && !over() && !(stop && stop())) {
      const gs = monsters.filter(m => types.includes(m.type) && !m.dead && dist(m.x, m.y, player.x, player.y) < 14 * TILE);
      if (!gs.length) { const p = spots[i++ % spots.length]; if (!walk(p[0], p[1])) { s += 500; } sim(30); s += 30; continue; }
      gs.sort((a, b) => dist(a.x, a.y, player.x, player.y) - dist(b.x, b.y, player.x, player.y)); const g = gs[0];
      if (dist(g.x, g.y, player.x, player.y) > 6 * TILE) { if (!walk(Math.floor(g.x / TILE), Math.floor(g.y / TILE), true, 1500)) { g.x = player.x + 60; g.y = player.y; } }
      const r = brawl(types, 3000, 8 * TILE); s += typeof r === 'number' ? r : 3000;
    }
    return skillLv(skill) >= lv;
  }
  function station(standX, standY, faceX, faceY, panelName, label, itemId, n = 1) {
    for (let k = 0; k < n && !over(); k++) {
      if (!walk(standX, standY)) return false; F().face(faceX, faceY); F().press('KeyE'); PLAY.steps++;
      if (panel !== panelName) { note(`could not open ${panelName} at ${faceX},${faceY}`); return false; }
      const c0 = countItem(itemId); if (!F().clickButton(label)) { note(`no button "${label}" (${notice && notice.text})`); closePanel(); return false; }
      let s = 0; while (countItem(itemId) <= c0 && s++ < 200) tick();
      closePanel(); if (countItem(itemId) <= c0) return false;
    }
    return true;
  }
  function buy(npcId, label) { if (!talk(npcId)) return false; const ok = F().clickButton(label); closePanel(); return ok; }
  function equipBest() {
    for (let i = 0; i < player.inv.length; i++) { const s = player.inv[i]; if (!s) continue; const d = ITEMS[s.id]; if (!d.weapon && !d.armour) continue; if (d.weapon && d.weapon.ranged) continue;
      const slot = d.weapon ? 'weapon' : d.armour.slot; const cur = player.equip[slot] ? ITEMS[player.equip[slot]] : null;
      const score = x => x.weapon ? (2 + Math.floor((skillLv('melee') + 8) * (x.weapon.str + 64) / 300)) * (1 - 0.5 / (x.weapon.cd * 10)) / x.weapon.cd : x.armour.def;
      if (!cur || score(d) > score(cur)) equipItem(i); }
  }
  // hunt a monster type until an item count is reached (drakes for dung and scales, cave spiders for silk)
  function hunt(type, itemId, want, tries, waitTicks = 600) {
    let n = 0, kills0 = player.kills;
    while (countItem(itemId) < want && n++ < tries && !over()) {
      const m = monsters.filter(o => o.type === type && !o.dead).sort((a, b) => dist(a.x, a.y, player.x, player.y) - dist(b.x, b.y, player.x, player.y))[0];
      if (!m) { sim(waitTicks); continue; }
      const w = walk(Math.floor(m.x / TILE), Math.floor(m.y / TILE), true, 3000); const r = brawl([type], 20000, 8 * TILE);
      if (n <= 2 || n % 5 === 0) note(`hunt ${type} #${n}: walk ${w}, brawl ${r}, ${itemId} ${countItem(itemId)}/${want}, kills +${player.kills - kills0}, free slots ${player.inv.filter(s => !s).length}`);
    }
    return countItem(itemId) >= want;
  }
  const stageStart = (st) => { PLAY.stages.push({ stage: st, steps: PLAY.steps, meals: PLAY.meals, deaths: PLAY.deaths, healed: PLAY.healed, kills: player.kills, melee: skillLv('melee') }); };
  const force = (why, fn) => { PLAY.forced.push({ stage: quest.stage, why }); note(`FORCED past stage ${quest.stage}: ${why}`); fn(); };
  const tp = (x, y, why) => { PLAY.tps.push({ stage: quest.stage, x, y, why }); F().tp(x, y); note(`tp ${x},${y}: ${why}`); };
  const waitStage = (st, max = 300) => { let n = 0; while (quest.stage < st && n++ < max) tick(); return quest.stage >= st; };

  function play(budget = 1500000) {
    const Fh = F();
    Object.assign(PLAY, { steps: 0, budget, healed: 0, meals: 0, deaths: 0, tps: [], forced: [], stages: [], log: [], last: '', stage: 0 });
    window.__peace = false; Fh.newGame(); drain(); PLAY.started = Date.now();
    const untilStage = (st, fn, forceFn) => { if (quest.stage >= st) return; stageStart(quest.stage); try { fn(); } catch (e) { note('error: ' + (e && e.message)); } if (quest.stage < st) force(`stage ${st} not reached (${PLAY.last})`, forceFn); };
    // 0 → 1: wake
    untilStage(1, () => { sim(120); }, () => advanceQuest(1));
    // 1 → 2: the sword
    untilStage(2, () => { walk(Math.floor(SWORD_POS.x / TILE), Math.floor(SWORD_POS.y / TILE)); sim(5); }, () => { swordTaken = true; player.equip.weapon = 'wooden_sword'; advanceQuest(2); });
    // 2 → 3: out of the cave; the axe in the stump
    untilStage(3, () => { walk(CAVE_EXIT_X + 3, 7); sim(5); }, () => { tp(CAVE_EXIT_X + 3, 7, 'forced out of the cave'); advanceQuest(3); });
    useAt(23, 9); drain();
    // 3 → 4: first blood
    untilStage(4, () => { grindTo('melee', 99, ['goblin'], [[30, 8], [34, 12], [40, 10]], 40000, () => quest.stage >= 4); }, () => { quest.kills = 3; advanceQuest(4); });
    // the goblin fields: melee 5 for the Duke, coins for a hammer, and a first look at gear from the drops
    untilStage(5, () => { grindTo('melee', 5, ['goblin'], [[40, 8], [47, 20], [52, 28], [58, 22], [62, 30], [66, 18]], 60000); note(`melee ${skillLv('melee')}, coins ${coins()}, kills ${player.kills}`); walk(SIGN_TILE.x - 1, SIGN_TILE.y); F().face(SIGN_TILE.x, SIGN_TILE.y); F().press('KeyE'); PLAY.steps++; sim(3); drain(); }, () => advanceQuest(5));
    // 5 → 6: the Duke
    untilStage(6, () => { talk('duke'); drain(); }, () => advanceQuest(6));
    // 6 → 7: Woodcutting 3 (seven trees), Melee 5, back to the Duke
    untilStage(7, () => {
      if (!hasTool('axe')) { note('no axe: buying one from Marta'); buy('marta', 'Buy 25'); drain(); }
      { const tried = new Set(); while (skillLv('woodcutting') < 3 && !over()) { const tree = nearestReachable([T.TREE], { x: tc(84), y: tc(30) }, tried); if (!tree) break; if (!harvest(tree.x, tree.y, 'wood')) tried.add(idx(tree.x, tree.y)); if (tried.size > 12) break; } }
      note(`woodcutting ${skillLv('woodcutting')}, melee ${skillLv('melee')}`);
      if (skillLv('melee') < 5) grindTo('melee', 5, ['goblin'], [[47, 20], [52, 28], [58, 22], [62, 30], [66, 18], [72, 26]], 60000);
      talk('duke'); drain();
    }, () => { player.skills.melee.xp = Math.max(player.skills.melee.xp, XP_TABLE[5]); player.skills.woodcutting.xp = Math.max(player.skills.woodcutting.xp, XP_TABLE[3]); advanceQuest(7); });
    // 7 → 8: gear up (hammer, iron dagger + helm, bronze body/legs/shield), melee 15 on goblins, wolves and the camp, then the walker
    untilStage(8, () => {
      equipBest();
      // a pickaxe from the miners' cart, Mining 5 on the quarry's rocks, iron ore for two bars
      if (!player.tookPick) useAt(54, 13);
      if (hasTool('pickaxe')) { const tried = new Set(); while (skillLv('mining') < 5 && !over()) { const r = nearestReachable([T.ROCK], { x: tc(54), y: tc(8) }, tried); if (!r) break; if (!harvest(r.x, r.y, 'stone')) tried.add(idx(r.x, r.y)); if (tried.size > 12) break; } gather([T.IRON], 'iron_ore', 2, { x: tc(54), y: tc(8) }); }
      note(`mining ${skillLv('mining')}, iron ore ${countItem('iron_ore')}, coins ${coins()}`);
      if (coins() < 5) grindTo('melee', 99, ['goblin'], [[47, 20], [52, 28], [58, 22]], 8000);
      if (!hasTool('hammer')) buy('brakka', 'Buy 5'); drain();
      if (hasTool('hammer') && countItem('iron_ore') >= 1) { station(92, 38, 92, 37, 'station', 'Iron ore → Iron bar', 'iron_bar', Math.min(2, countItem('iron_ore'))); if (countItem('iron_bar') >= 1) station(94, 39, 94, 38, 'station', '1 bar → Iron dagger', 'iron_dagger'); if (countItem('iron_bar') >= 1 && skillLv('smithing') >= 3) station(94, 39, 94, 38, 'station', '1 bar → Iron helm', 'iron_helm'); }
      equipBest(); drain();
      // melee 12 on the fields and Wolfwood's edge, then the camp (sappers, brutes, goblins) to 15
      grindTo('melee', 12, ['goblin', 'wolf', 'boar'], [[60, 52], [70, 50], [80, 8], [100, 60], [116, 60], [90, 60], [70, 56]], 120000);
      if (coins() >= 105) { buy('brakka', 'Buy 60'); buy('brakka', 'Buy 45'); } if (coins() >= 40) buy('marta', 'Buy 40'); equipBest(); drain();
      grindTo('melee', 15, ['goblin', 'sapper', 'brute'], [[144, 24], [146, 26], [148, 30], [153, 24], [155, 30], [147, 36], [154, 34], [150, 38]], 120000);
      note(`melee ${skillLv('melee')}, defence ${skillLv('defence')}, hp ${player.maxHp}, weapon ${player.equip.weapon}, coins ${coins()}`);
      const wk = monsters.find(m => m.type === 'walker'); let tries = 0;
      while (wk && !wk.dead && tries++ < 6 && !over()) { walk(Math.floor(wk.x / TILE), Math.floor(wk.y / TILE), true, 3000); brawl(['walker', 'goblin', 'sapper', 'brute'], 20000, 8 * TILE); }
      note(`walker dead: ${wk && wk.dead}, quest.walkerKilled ${quest.walkerKilled}`);
      // Sera: the cage opens once the camp is clear
      brawl(['goblin', 'sapper', 'brute', 'bulldozer'], 30000, 12 * TILE); if (!monsters.some(m => !m.dead && ['goblin', 'sapper', 'brute', 'walker', 'bulldozer'].includes(m.type) && dist(m.x, m.y, tc(148), tc(34)) <= 6 * TILE)) { useAt(148, 34); drain(); note(`companion: ${player.companion && player.companion.id}`); }
      talk('duke'); drain();
    }, () => { quest.walkerKilled = true; advanceQuest(8); });
    // 8 → 9: the road south to Hollowford
    untilStage(9, () => { walk(150, 41); walk(141, 64); walk(140, 67); waitStage(9, 60); }, () => { tp(140, 68, 'forced to Hollowford'); advanceQuest(9); });
    // 9 → 10: the Barrelbeast. Melee 20 first, on the camp's leftovers and the Hollowford patrols
    untilStage(10, () => {
      grindTo('melee', 20, ['goblin', 'sapper', 'brute', 'wolf'], [[140, 70], [133, 78], [148, 78], [130, 80], [150, 74], [128, 75], [143, 66], [130, 72], [110, 82], [145, 80]], 150000);
      equipBest(); note(`melee ${skillLv('melee')}, defence ${skillLv('defence')}, hp ${player.maxHp}, ${player.equip.weapon}/${player.equip.body}`);
      const bb = monsters.find(m => m.type === 'barrelbeast'); let tries = 0;
      while (bb && !bb.dead && tries++ < 8 && !over()) { walk(Math.floor(bb.x / TILE), Math.floor(bb.y / TILE), true, 3000); brawl(['barrelbeast', 'goblin', 'sapper', 'brute'], 30000, 9 * TILE); }
      waitStage(10, 60);
    }, () => { const bb = monsters.find(m => m.type === 'barrelbeast'); if (bb && !bb.dead) { bb.hp = 1; killMonster(bb); } else { (quest.hollowford || (quest.hollowford = {})).beastKilled = true; advanceQuest(10); } });
    // 10 → 11: the crypt bars (three hammer blows), Old Tam
    untilStage(11, () => {
      if (!hasTool('hammer')) buy('brakka', 'Buy 5');
      brawl(['brute', 'goblin', 'sapper'], 20000, 8 * TILE);
      for (let k = 0; k < 4 && tileAt(128, 85) === T.CRYPT_BARS && !over(); k++) { closePanel(); useAt(128, 85); sim(3); }
      note(`bars at 128,85: ${tileAt(128, 85) === T.CRYPT_BARS ? 'standing' : 'broken'}; hammer ${hasTool('hammer')}, at ${ptx()},${pty()}, notice ${notice && notice.text}, said ${dialog.cur && dialog.cur.text}`);
      talk('tam'); drain(); waitStage(11, 60);
    }, () => { const hf = quest.hollowford || (quest.hollowford = {}); hf.rewarded = true; advanceQuest(11); });
    // 11 → 12: the warden's road (the gate opens itself at stage 11)
    untilStage(12, () => { walk(60, 94); sim(5); walk(60, 98); waitStage(12, 60); }, () => { tp(60, 98, 'forced past the warden'); advanceQuest(12); });
    // 12 → 13: Dunstan
    untilStage(13, () => { talk('dunstan'); drain(); }, () => advanceQuest(13));
    // 13 → 14: five dragon dung from the ash drakes
    untilStage(14, () => {
      hunt('ash_drake', 'dragon_dung', 5, 14);
      note(`dung ${countItem('dragon_dung')}, melee ${skillLv('melee')}`); closePanel(); talk('dunstan'); closePanel(); drain(); waitStage(14, 60);
    }, () => { (quest.dragons || (quest.dragons = {})).salve = true; quest.dragons.stage = 2; advanceQuest(14); });
    // 14 → 15: the Song of Above (Wren's silk, the flute, Aerie: 5 scales + 3 essence), the Dragon Killers, the lair, the horn, The Fang
    untilStage(15, () => {
      // Wren's silk: five strands from the cave spiders
      if (quest.wren !== 'done') { talk('wren'); drain(); hunt('spider', 'spider_silk', 5, 60, 300); talk('wren'); drain(); }
      if (!countItem('wind_flute') && quest.sky && quest.sky.stage === 0) { talk('wren'); drain(); }
      note(`wren ${quest.wren}, flute ${countItem('wind_flute')}, sky ${quest.sky && quest.sky.stage}`);
      // dragon scales from the drakes (one in four kills or so)
      hunt('ash_drake', 'dragon_scale', 5, 60);
      note(`scales ${countItem('dragon_scale')}, melee ${skillLv('melee')}`);
      // up to Aerie
      if (useAt(62, 6) && window.INSTANCES && INSTANCES.active() === 'aerie') {
        note('in Aerie'); drain();
        for (const [x, y] of [[8, 17], [25, 27], [42, 20]]) if (countItem('cloud_essence') < 3) { useAt(x, y); }
        // Queen Seraphel stands at (25,6); the winged folk answer E within two tiles, so stand right under her
        for (let k = 0; k < 2; k++) { closePanel(); walk(25, 7); F().face(25, 6); F().press('KeyE'); PLAY.steps++; sim(2); drain(); }
        note(`sky ${quest.sky && quest.sky.stage}, essence ${countItem('cloud_essence')}`);
        useAt(25, 31); sim(3);
      }
      if (window.INSTANCES && INSTANCES.active()) { INSTANCES.leave(); note('left Aerie by the API (the leap tile was not reached)'); }
      note(`back on the ground: ${player.region} at ${ptx()},${pty()}`);
      talk('duke'); drain(); note(`dragon killers formed: ${quest.dk && quest.dk.formed}, horn ${countItem('dragon_horn')}`);
      walk(18, 107); useAt(18, 108); drain(); walk(18, 116); F().face(18, 117); F().press('KeyE'); PLAY.steps++; sim(3); drain();
      const fang = monsters.find(m => m.type === 'the_fang'); let t2 = 0;
      while (fang && !fang.dead && t2++ < 12 && !over()) { walk(Math.floor(fang.x / TILE), Math.floor(fang.y / TILE), true, 3000); brawl(['the_fang'], 40000, 12 * TILE); }
      note(`the Fang dead: ${fang && fang.dead}`); waitStage(15, 60);
    }, () => { const m = monsters.find(m => m.type === 'the_fang'); if (m && !m.dead) { m.hp = 1; killMonster(m); } else advanceQuest(15); });
    // 15 → 16: home
    untilStage(16, () => { walk(112, 48); talk('duke'); drain(); waitStage(16, 60); }, () => advanceQuest(16));
    stageStart(quest.stage);
    PLAY.stage = quest.stage; PLAY.seconds = +((Date.now() - PLAY.started) / 1000).toFixed(1); PLAY.gameMinutes = +(PLAY.steps / 3600).toFixed(1);
    return PLAY;
  }

  window.PLAYTHROUGH = { connectivity, instanceConnectivity, chain, chainStages, progression, sources, gates, play, PLAY, get pristine() { return pristine(); }, killSecs, killXp, gatherSecs, fishSecs };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'playthrough: ';
    if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
    { const c = connectivity(); const groups = ['npc', 'door', 'instance', 'maptarget', 'landmark', 'landing', 'spawn'];
      for (const g of groups) { const rows = c.rows.filter(r => r.group === g), bad = rows.filter(r => r.open < 0); check(P + `${g}: every target is walkable from where the game puts you (${rows.length})`, bad.length === 0, { n: rows.length, unreachable: bad.map(r => `${r.name} @${r.x},${r.y}`), gated: rows.filter(r => r.strict < 0 && r.open >= 0).length }); }
      if (c.unreachable.length) check(P + 'unreachable targets', false, { unreachable: c.unreachable });
      check(P + 'the roots hold: the shaft and Old Harl are reachable from the cave', c.rootOk.deepholm && c.rootOk.gull, c.rootOk); }
    { const rows = instanceConnectivity(), bad = rows.filter(r => r.dist < 0); check(P + `instances: entry reaches the exit, the boss, the chest and the folk inside (${rows.length})`, bad.length === 0, { n: rows.length, unreachable: bad.map(r => `${r.instance}: ${r.name} @${r.x},${r.y}`) }); }
    { const rows = chain(), bad = rows.filter(r => !r.ok); check(P + 'main quest chain: every stage 0→16 walks from the last, story gates opened by a prior stage', bad.length === 0, { stages: rows.length, tiles: rows.reduce((s, r) => s + r.dist, 0), bad: bad.map(r => ({ stage: r.stage, legs: r.legs.filter(l => !l.ok).map(l => `${l.from}→${l.to} dist ${l.dist} gate ${l.gate} opens ${l.opensAt}`) })), gates: rows.filter(r => r.legs.some(l => l.gate)).map(r => `${r.stage}: ${r.legs.filter(l => l.gate).map(l => l.gate + '@' + l.opensAt).join(',')}`) }); }
    { const p = progression(), dead = p.rows.filter(r => r.dead && r.kind !== 'cape'); check(P + `progression: every skill gate has an XP source below it (${p.rows.length} gates)`, dead.length === 0, { gates: p.rows.length, dead: dead.map(r => `${r.skill} ${r.lv} ${r.what}`) });
      const wide = Object.entries(p.bands).filter(([, b]) => b.gap > 10).map(([k, b]) => `${k}: ${b.gap} levels (nothing new after ${b.lastNew} until ${b.at})`);
      check(P + 'progression: widest stretch of levels with no new XP source, per skill (10+ listed)', true, { wide }); }
    if (window.__fullPlaythrough) {
      const r = play();
      check(P + 'full bot playthrough 0→16 with real movement (node tools/headless.js --play)', r.stage >= 16 && r.forced.length === 0, { stage: r.stage, last: r.last, forced: r.forced, tps: r.tps, steps: r.steps, gameMinutes: r.gameMinutes, seconds: r.seconds, meals: r.meals, healed: Math.round(r.healed), junkDropped: r.junk || 0, deaths: r.deaths, kills: player.kills, melee: skillLv('melee'), defence: skillLv('defence'), stages: r.stages });
    }
  });
}
