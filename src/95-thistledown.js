// ============================================================================
// THISTLEDOWN, THE CAPITAL. src/95-thistledown.js
//
// The owner, 2026-10-02, verbatim: "personally the design you did for the sky city was phenomenal I would sujest doing
// the same process on the main city". Thistledown is where every new knight wakes, where a fallen knight comes back,
// and the first place Cohen's friends see online. It was a village of roofs round a cobbled square. This file makes it
// a capital, in the overworld's own look: a curtain wall of grey coursed stone with eighteen towers and two gatehouses,
// the High Street from gate to gate under twenty-two iron lamps and bunting, the Great Fountain with four hero statues,
// Castle Thistledown in a moat with an oak drawbridge and a keep with a spire, the Bell Tower with its day-and-night
// dial, the Market Court, the Duke's Orchard, the Duke's Green with a hedge maze and Swan Pond, the Rose Garden, and
// buildings that read as what they are. People live there, and Ambrose the bell-ringer has one small story.
//
// THE PLAN is src/94-thistleplan.js (58 x 45 characters over x 84..141, y 13..57). HOW IT IS BUILT:
//   paint   the first HOOKS.world pass (unshift): every plan cell whose glyph names a tile is set to it, except
//           building cells. It draws no random numbers and writes nothing outside x 85..140, y 14..56, so the rest of the
//           world is exactly what it was, and every knight online builds the same city.
//   snap    the last HOOKS.world pass: CAPITAL.base is the plan window as generated, with what later passes laid on
//           top (the notice board, the island portal, the hitching rail, the dozer bay, the agility yard).
//   ground  drawn from cached 8x8-tile chunks, and only on cells whose live tile still equals CAPITAL.base: a fire, a
//           plank or a tilled cell shows the core's own art at once.
//   old saves  migrate() runs after every load: a saved change inside stone or water is undone (what was placed is
//           given back), the knight is moved out of anything solid, and the Voice says the city was rebuilt, once.
//
// WRAPPED BY REASSIGNMENT (explicit arguments): drawBuilding (the seventeen town buildings, b.town), drawTower (the
//   castle's corner towers), drawFenceProp (no wooden gate art on the six town gate cells), drawFireProp (the square's
//   brazier), tapLabelFor, tapPick, load. Every one of them hands an instance straight to what it wrapped.
// Every fixed-coordinate draw starts with `if (window.__instance) return;` (Aerie's map overlaps x 85..99 of the town).
//
// ONLINE (docs/ONLINE.md): the plan is a literal and the painter uses no random numbers. MONSTER_SPAWNS keeps its
// length and order. Nell, Robin and the swans move by the wall clock (CLOCK.fixed ?? Date.now()), so friends see the
// same thing with no message. Talk, the coin toss, the story, the plinth and the bell are per knight, saved in
// quest.capital and player.cityV. No new net message and no server change. Everyone still arrives at 112,33.
//
// State: quest.capital = { bell: 0..6 | 'done', tossed, barked, osricN, ambroseMet, heroName, plinthTold, tossArmed }
// (saved with the quest; reset in HOOKS.newGame) and player.cityV (1 once the rebuilt-city line has been said).
// Handle: window.CAPITAL (the end of the file).
// ============================================================================
{
  const PLAN = window.THISTLE_PLAN;
  const { X0, Y0, W, H } = PLAN;
  const TOWN = { x0: 85, y0: 14, x1: 140, y1: 56 };
  const inTown = (x, y) => x >= TOWN.x0 && x <= TOWN.x1 && y >= TOWN.y0 && y <= TOWN.y1;
  const inPlan = PLAN.inPlan;
  const pi = (x, y) => (y - Y0) * W + (x - X0);
  const glyph = PLAN.at;
  const away = () => !!window.__instance;

  // =========================================================================
  // 1. tiles (four new ones: 240..243; the ceiling is 255)
  // =========================================================================
  // a mown lawn: walkable, but not GRASS, so a hoe cannot till it and nothing can be placed on it
  const LAWN = addTile('TD_LAWN', { tex: 'grass', mini: '#7cc35a' });
  // clipped hedges, trees and rose bushes
  const HEDGE = addTile('TD_HEDGE', { solid: true, tex: 'grass', mini: '#2f6b2a' });
  // the city's things: lamps, statues, the plinth, benches, stalls, signposts, the bell, the sundial
  const PROP = addTile('TD_PROP', { solid: true, tex: 'cobble', mini: '#c9a14a' });
  const FOUNT = addTile('TD_FOUNTAIN', { solid: true, tex: 'water', mini: '#4aa3df' });
  const TILES = { LAWN, HEDGE, PROP, FOUNTAIN: FOUNT };
  const MAX_TILE = Math.max(...Object.values(T));
  if (MAX_TILE > 255) console.error('95-thistledown: tile id ' + MAX_TILE + ' does not fit the map (Uint8Array)');
  // a tap on a lamp, a statue, a stall or a fountain walks up to it and uses it (17-tap)
  if (typeof INTERESTING_TILES !== 'undefined') { INTERESTING_TILES.add(PROP); INTERESTING_TILES.add(FOUNT); }
  const WALL_T = () => (window.TOWNWALL ? TOWNWALL.tile : T.TOWN_WALL);

  // what each prop, piece of greenery or fountain cell is (0 = nothing)
  const KIND_NAMES = ['', 'lamp', 'statue', 'plinth', 'bench', 'stall', 'sign', 'bell', 'sundial', 'hedge', 'fruit', 'cherry', 'roses', 'great', 'market', 'rose'];
  const KIND_CODE = {}; KIND_NAMES.forEach((n, i) => { if (n) KIND_CODE[n] = i; });
  const KIND = new Uint8Array(W * H);
  for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) { const k = PLAN.kindAt(x, y); if (k) KIND[pi(x, y)] = KIND_CODE[k]; }
  const kindAt = (x, y) => inPlan(x, y) ? KIND_NAMES[KIND[pi(x, y)]] || null : null;
  const FOUNTAINS = PLAN.FOUNTAINS;
  const fountainAt = PLAN.fountainAt;
  const statueAt = (x, y) => PLAN.STATUES.find(s => s.x === x && s.y === y) || null;
  const stallAt = (x, y) => PLAN.STALLS.find(s => (x === s.x || x === s.x + 1) && y === s.y) || null;
  const signAt = (x, y) => PLAN.SIGNS.find(s => s.x === x && s.y === y) || null;
  const towerAt = PLAN.towerAt;
  const isTowerCell = (x, y) => !!towerAt(x, y);
  const LAMPS = PLAN.LAMPS, BENCHES = PLAN.BENCHES;
  const LAMPS_N = LAMPS.length;

  // =========================================================================
  // 2. the buildings and the people
  // =========================================================================
  // the seventeen buildings of the town draw themselves here (drawBuilding is wrapped below); Death's House keeps the core's art
  const TOWN_IDS = new Set(['store', 'bank', 'bakery', 'smithy', 'workshop', 'inn', 'keep', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9']);
  BUILDINGS.forEach(b => { if (TOWN_IDS.has(b.id)) b.town = true; });
  const TOWN_BUILDINGS = () => BUILDINGS.filter(b => b.town);
  const doorOf = b => b.door !== undefined ? [b.x + b.door, b.y + b.h - 1] : [b.x + b.doorTop, b.y];
  const stepOf = b => b.door !== undefined ? [b.x + b.door, b.y + b.h] : [b.x + b.doorTop, b.y - 1];

  // the six new people. Mabel counts the lamps: the number is the plan's own
  const LINES = {
    hettie: ["Apples from the Duke's Orchard by the north wall. He lets me pick the ones that fall.", 'Red ones and green ones. The green ones bite back.'],
    mabel: [`Every street lamp in Thistledown burns one of my candles. All ${LAMPS_N} of them. I count.`, 'I light them at dusk, when Ambrose rings the bell.'],
    moll: ['Flowers from beside the Rose Garden. The Duke says I may sell any that lean over the path.', "The roses by the castle are the Duke's own. Nobody touches those."],
  };
  for (const p of PLAN.PEOPLE) {
    if (NPCS.some(n => n.id === p.id)) continue;
    const n = Object.assign({}, p);
    if (LINES[p.id]) n.lines = LINES[p.id].slice();
    NPCS.push(initNpc(n));
  }
  const npc = id => NPCS.find(n => n.id === id) || null;
  // Ada's first line points new knights at the fountain
  { const ada = npc('v1'); if (ada && Array.isArray(ada.lines)) ada.lines[0] = 'Lost? Find the Great Fountain. Every street comes back to it.'; }

  // =========================================================================
  // 3. state
  // =========================================================================
  QUEST_DEFS.td_bell = { name: 'The Bell at Midnight' };
  const fresh = () => ({ bell: 0, tossed: 0, barked: false, osricN: 0, ambroseMet: false, heroName: null, plinthTold: false, tossArmed: 0 });
  const Q = () => {
    let q = quest.capital; if (!q || typeof q !== 'object') q = quest.capital = fresh();
    const f = fresh(); for (const k in f) if (q[k] === undefined) q[k] = f[k];
    return q;
  };
  const storyOpen = () => { const s = Q().bell; return typeof s === 'number' && s >= 1 && s <= 6; };
  const storyDone = () => Q().bell === 'done';

  // =========================================================================
  // 4. the paint: the first world pass (no random numbers, nothing outside the town)
  // =========================================================================
  const RECT = { x0: 85, y0: 14, x1: 140, y1: 56 };
  function paint(rnd, api) {
    for (let j = 0; j < H; j++) {
      const row = PLAN.ROWS[j];
      for (let i = 0; i < W; i++) {
        const name = PLAN.GLYPHS[row[i]];
        if (!name) continue;
        const x = X0 + i, y = Y0 + j;
        if (buildingAt(x, y)) continue;
        const id = name === 'TOWN_WALL' ? WALL_T() : T[name];
        if (typeof id !== 'number') continue;
        api.setTile(x, y, id);
      }
    }
  }
  HOOKS.world.unshift(paint);
  // CAPITAL.base: the plan window as the world generates it (the snapshot pass is pushed at the very end of this file)
  const base = new Uint8Array(W * H);
  let snapped = false;
  const SNAP = { spawns: -1 };
  function snap() {
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) base[j * W + i] = tileAt(X0 + i, Y0 + j);
    snapped = true; SNAP.spawns = MONSTER_SPAWNS.length;
    for (const k of CHUNKS.keys()) CHUNKS.delete(k);
  }
  const baseAt = (x, y) => inPlan(x, y) ? base[pi(x, y)] : -1;
  // the ground layer paints a cell only while it is still what the world made it
  const pristineAt = (x, y) => snapped && inPlan(x, y) && tileAt(x, y) === base[pi(x, y)];

  // =========================================================================
  // 5. old saves: migrate() after every load
  // =========================================================================
  // Saves keep tile changes and positions. A save from before the city was rebuilt can hold a bed in what is now the
  // fountain, a lodestone in a hedge, the mare in a flower stall, or the knight in the moat. Every rule here is
  // idempotent: a second load changes nothing.
  const OPEN = () => new Set([T.GRASS, T.DIRT, T.COBBLE, T.SOIL, T.FLOOR, LAWN]);
  let KEEP_CLEAR = null;
  function keepClear() {
    if (KEEP_CLEAR) return KEEP_CLEAR;
    const s = new Set(), add = (x, y) => { if (inMap(x, y)) s.add(idx(x, y)); };
    for (const n of NPCS) if (inTown(n.x, n.y)) add(n.x, n.y);
    for (const b of BUILDINGS) if (inTown(b.x, b.y)) { const [dx, dy] = doorOf(b), [sx, sy] = stepOf(b); add(dx, dy); add(sx, sy); }
    for (let y = 32; y <= 33; y++) for (let x = 111; x <= 113; x++) add(x, y);
    for (let y = 31; y <= 33; y++) { add(86, y); add(139, y); }
    const post = window.MOUNTS && MOUNTS.post;
    if (post) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(post.x + dx, post.y + dy);
    return (KEEP_CLEAR = s);
  }
  const MIG = { reverted: 0, kept: 0, refunds: [], log: [] };
  function placedItemFor(t) {
    const name = tileName(t);
    for (const id in ITEMS) if (ITEMS[id] && ITEMS[id].place === name) return id;
    return null;
  }
  function migrate() {
    if (away() || !snapped) return null;
    const open = OPEN(), clear = keepClear(), H0 = window.MOUNTS ? MOUNTS.tiles.HORSE : -1;
    const refund = { pack: {}, bank: {} };
    let horse = null, changed = 0;
    for (const [i, t] of [...mapDiffs.entries()]) {
      const x = i % MAP_W, y = Math.floor(i / MAP_W);
      if (x < RECT.x0 || x > RECT.x1 || y < RECT.y0 || y > RECT.y1) continue;
      const b = base[pi(x, y)];
      if (t === b) continue;
      if (open.has(b) && !clear.has(i)) { MIG.kept++; continue; }
      // undo it: the ground the city has there, with no crop, fire or regrowth left behind
      setTile(x, y, b); mapDiffs.delete(i); miniDirtyTiles.add(i); changed++; MIG.reverted++;
      crops = crops.filter(c => c.i !== i); fires = fires.filter(f => f.i !== i); regrow = regrow.filter(r => r.i !== i);
      MIG.log.push([x, y, tileName(t)]);
      if (t === H0) { horse = { x, y }; continue; }
      const id = placedItemFor(t);
      if (id) {
        const left = addItem(id, 1);
        if (left) { if (bankAdd(id, 1)) refund.bank[id] = (refund.bank[id] || 0) + 1; }
        else refund.pack[id] = (refund.pack[id] || 0) + 1;
      }
    }
    // the mare: back beside the rail, on open ground
    if (horse && player.horse && player.horse.owned) {
      const post = MOUNTS.post || { x: 119, y: 27 };
      let spot = null;
      for (let r = 1; r <= 3 && !spot; r++) {
        let best = null;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = post.x + dx, y = post.y + dy;
          if (!inMap(x, y) || !PLACEABLE_ON.has(tileAt(x, y)) || insideBuilding(x, y) || buildingAt(x, y) || clear.has(idx(x, y))) continue;
          if (NPCS.some(n => circleHitsTile(n.px, n.py, 14, x, y))) continue;
          const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { x, y, d };
        }
        spot = best;
      }
      if (spot) {
        const prev = tileAt(spot.x, spot.y);
        changeTile(spot.x, spot.y, H0);
        player.horse.at = [spot.x, spot.y]; player.horse.under = tileName(prev);
      } else { player.horse.at = null; player.horse.under = null; }
    } else if (horse && player.horse) { player.horse.at = null; player.horse.under = null; }
    // where he wakes and where his lodestone takes him: only while the bed and the lodestone are still there
    const tileOfPx = p => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
    if (player.bedSpawn) { const [x, y] = tileOfPx(player.bedSpawn); if (inTown(x, y) && tileAt(x, y) !== T.BED) player.bedSpawn = null; }
    if (player.home) { const [x, y] = tileOfPx(player.home); if (inTown(x, y - 1) && tileAt(x, y - 1) !== T.LODESTONE) player.home = null; }
    // and the knight himself, out of anything solid
    if (collides(player.x, player.y, player.r, playerWho())) { const sp = safeSpot(player.x, player.y, player.r, playerWho()) || respawnPoint(); player.x = sp.x; player.y = sp.y; }
    miniDirty = true;
    // one line per knight, the first time he loads into the new city
    const lines = [];
    if (player.cityV !== 1 && player.visitedVillage) {
      lines.push('Thistledown has been rebuilt while you were away. Go and see the Great Fountain.');
      const words = (o, where) => { const parts = Object.keys(o).map(id => `${o[id]} ${(ITEMS[id].name || id).toLowerCase()}`); return parts.length ? `Back in your ${where}: ${parts.join(', ')}.` : null; };
      const a = words(refund.pack, 'pack'), b2 = words(refund.bank, 'bank');
      if (a) lines.push(a); if (b2) lines.push(b2);
      for (const l of lines) say(l, 'The Voice');
    }
    if (Object.keys(refund.pack).length || Object.keys(refund.bank).length) MIG.refunds.push(refund);
    if (player.cityV !== 1) { player.cityV = 1; save(); }
    else if (changed) save();
    return { changed, lines, refund };
  }
  { const _load = load; load = function () { const ok = _load(); if (ok) migrate(); return ok; }; }

  const CHUNKS = new Map();
  // @@PART2@@

  // the snapshot: the very last world pass (only 99-boot loads after this file, and it adds none)
  HOOKS.world.push(snap);
  window.CAPITAL = { PLAN, TILES, KIND, KIND_NAMES, base, migrate, paint, snap, Q, MIG, kindAt, baseAt, pristineAt };
}
