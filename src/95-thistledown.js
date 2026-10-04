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
// WRAPPED BY REASSIGNMENT (explicit arguments): drawBuilding (the sixteen town buildings, b.town, and Death's House), drawTower (the
//   castle's corner towers), drawFenceProp (no wooden gate art on the six town gate cells), drawFireProp (the square's
//   brazier), tapLabelFor, tapPick, load. Every one of them hands an instance straight to what it wrapped.
// Every fixed-coordinate draw starts with `if (window.__instance) return;` (Aerie's map overlaps x 85..99 of the town).
//
// ONLINE (docs/ONLINE.md): the plan is a literal and the painter uses no random numbers. MONSTER_SPAWNS keeps its
// length and order. Tess, Robin and the swans move by the wall clock (CLOCK.fixed ?? Date.now()), so friends see the
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
  // The capital moves as one rigid place: every map number in this file is the old map's, read through Thistledown's
  // frame (TD.x, TD.y, TD.p, TD.rect) or one of its ports; the plan's own window (X0, Y0) is already the frame's.
  const TD = ATLAS.frame('thistledown');
  const TOWN = TD.rect({ x0: 85, y0: 14, x1: 140, y1: 56 });
  const inTown = (x, y) => x >= TOWN.x0 && x <= TOWN.x1 && y >= TOWN.y0 && y <= TOWN.y1;
  const inPlan = PLAN.inPlan;
  const pi = (x, y) => (y - Y0) * W + (x - X0);
  const glyph = PLAN.at;
  const away = () => !!window.__instance;

  // =========================================================================
  // 1. tiles (four new ones: 240..243; the ceiling is 255)
  // =========================================================================
  // a mown lawn: walkable, but not GRASS, so a hoe cannot till it and nothing can be placed on it
  // open ground like the grass it replaced (owner's game on master: get off the mare, park a machine, set a lodestone or a fire
  // on any of it); still its own tile, so a hoe does not till the Duke's lawns
  const LAWN = addTile('TD_LAWN', { tex: 'grass', mini: '#7cc35a', placeableOn: true });
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
  const KIND_NAMES = ['', 'lamp', 'statue', 'plinth', 'bench', 'stall', 'sign', 'bell', 'sundial', 'hedge', 'fruit', 'cherry', 'roses', 'great', 'market', 'rose',
    'flowers', 'woodpile', 'cart', 'oldanvil', 'trough', 'well', 'table'];
  // the greenery kinds (TD_HEDGE); every other kind but the three fountains is a TD_PROP
  const GREEN_KINDS = new Set(['hedge', 'fruit', 'cherry', 'roses', 'flowers']);
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
  // the sixteen buildings of the town draw themselves here (drawBuilding is wrapped below), and Death's House with its own
  // painter (drawDeathHouse)
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
  const RECT = TD.rect({ x0: 85, y0: 14, x1: 140, y1: 56 });
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
    for (const [k, o] of [...CHUNKS]) dropChunk(k, o);
  }
  const baseAt = (x, y) => inPlan(x, y) ? base[pi(x, y)] : -1;
  // the ground layer paints a cell only while it is still what the world made it
  const pristineAt = (x, y) => snapped && inPlan(x, y) && tileAt(x, y) === base[pi(x, y)];

  // =========================================================================
  // 5. old saves: migrate() after every load
  // =========================================================================
  // Saves keep tile changes and positions. A save from before the city was rebuilt can hold a bed in what is now the
  // fountain, a lodestone in a hedge, the mare in a flower stall, a parked walker on the new Great Fountain, or the knight
  // in the moat. The tile rules run ONCE per knight, on the first load of a save made before the rebuild (player.cityV is
  // not 1); after that a knight's own changes in the city are his and are never undone on a load. A machine, a beast,
  // the mare or a wreck is never taken away: if its cell must be cleared it is moved to the nearest open ground.
  // Every rule is idempotent: a second load changes nothing.
  const OPEN = () => new Set([T.GRASS, T.DIRT, T.COBBLE, T.SOIL, T.FLOOR, LAWN]);
  let KEEP_CLEAR = null;
  function keepClear() {
    if (KEEP_CLEAR) return KEEP_CLEAR;
    const s = new Set(), add = (x, y) => { if (inMap(x, y)) s.add(idx(x, y)); };
    // where the people who stand still stand (a villager who wanders has no one spot)
    for (const n of NPCS) if (inTown(n.x, n.y) && !n.wander) add(n.x, n.y);
    for (const b of BUILDINGS) if (inTown(b.x, b.y)) { const [dx, dy] = doorOf(b), [sx, sy] = stepOf(b); add(dx, dy); add(sx, sy); }
    for (let y = TD.y(32); y <= TD.y(33); y++) for (let x = TD.x(111); x <= TD.x(113); x++) add(x, y);
    for (let y = TD.y(31); y <= TD.y(33); y++) { add(TD.x(86), y); add(TD.x(139), y); }
    // (the hitching rail's four sides are NOT kept clear: 51-mounts' own whistle ties the mare there)
    return (KEEP_CLEAR = s);
  }
  // the tiles that are a thing the knight owns or can mend, never deleted by a load: the walker, the bulldozer, the
  // Barrelbeast, their wrecks, and the mare
  const VEHICLE_NAMES = ['MECH', 'WRECK', 'DOZER', 'DOZER_WRECK', 'BEAST', 'BEAST_WRECK', 'HORSE'];
  const vehicleTiles = () => new Set(VEHICLE_NAMES.map(n => T[n]).concat(window.MOUNTS && MOUNTS.tiles ? [MOUNTS.tiles.HORSE] : []).filter(t => typeof t === 'number'));
  const MIG = { reverted: 0, kept: 0, moved: 0, refunds: [], log: [] };
  // The town's buildings as they stood before the rebuild (x, y, w, h, from master's 02-world before 50dbe74). A knight's
  // change on what was outdoor ground then and is a new house's floor now is undone like one in a hedge: a plank, a bed or
  // the mare is not left in somebody's house. A change inside a building that stood there before is still his.
  const OLD_RECTS = [[90, 20, 7, 6], [99, 20, 8, 6], [122, 20, 6, 6], [90, 36, 7, 6], [99, 36, 7, 6], [122, 44, 8, 6], [108, 46, 10, 7], [133, 48, 6, 5],
    [130, 20, 5, 5], [88, 28, 4, 4], [94, 28, 4, 4], [124, 27, 4, 4], [130, 27, 5, 4], [92, 46, 4, 4], [98, 46, 4, 4], [134, 36, 5, 4], [126, 36, 4, 4]]
    .map(([x, y, w, h]) => [...TD.p(x, y), w, h]);   // each top-left in the capital's frame
  const wasIndoors = (x, y) => OLD_RECTS.some(([bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by && y < by + bh);
  const newIndoors = (x, y) => { const b = buildingAt(x, y); return !!b && inTown(x, y) && !wasIndoors(x, y); };
  // the High Street, gate to gate (rows 31..33): an old save's solid thing there (a plank, a fence, a door, a walker wreck)
  // is taken off it, so the road is clear for riders from gate to gate
  const onHighStreet = (x, y) => y >= TD.y(31) && y <= TD.y(33) && x >= TD.x(86) && x <= TD.x(139);
  // the inn moved one tile east: its bed was at 128,48 and is at 129,48
  const OLD_INN_BED = TD.p(128, 48), INN_BED = TD.p(129, 48);
  // "17 planks, 1 bed and 1 lodestone"
  const many = (n, w) => n === 1 || /s$/.test(w) ? w : w + 's';
  function refundWords(o, where) {
    const parts = Object.keys(o).map(id => `${o[id]} ${many(o[id], (ITEMS[id].name || id).toLowerCase())}`);
    if (!parts.length) return null;
    const list = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
    return where === 'ground' ? `On the ground by you: ${list}.` : `Back in your ${where}: ${list}.`;
  }
  function placedItemFor(t) {
    const name = tileName(t);
    for (const id in ITEMS) if (ITEMS[id] && ITEMS[id].place === name) return id;
    return null;
  }
  // the nearest cell round (cx, cy), rings 1..R, where a moved machine may stand: the city's own open ground, as the world
  // made it (nothing of the knight's on it), not by a door, a gate or a person, not in a building, nobody standing on it,
  // not on a guard's post, and never on the High Street itself (rows 31..33 stay clear from gate to gate for riders)
  function parkSpot(cx, cy, R, open, clear) {
    const posts = new Set(MONSTER_SPAWNS.filter(sp => inTown(sp.tx, sp.ty)).map(sp => idx(sp.tx, sp.ty)));
    for (let r = 1; r <= R; r++) {
      let best = null;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy, i = idx(x, y);
        if (!inTown(x, y) || !inPlan(x, y) || (y >= TD.y(31) && y <= TD.y(33)) || posts.has(i) || !open.has(base[pi(x, y)]) || tileAt(x, y) !== base[pi(x, y)] || mapDiffs.has(i) || clear.has(i)) continue;
        if (insideBuilding(x, y) || buildingAt(x, y) || !PLACEABLE_ON.has(tileAt(x, y))) continue;
        if (NPCS.some(n => circleHitsTile(n.px, n.py, 14, x, y)) || circleHitsTile(player.x, player.y, player.r, x, y)) continue;
        const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { x, y, d };
      }
      if (best) return best;
    }
    return null;
  }
  function migrate() {
    if (away() || !snapped) return null;
    const pre = player.cityV !== 1;
    const open = OPEN(), clear = keepClear(), H0 = window.MOUNTS ? MOUNTS.tiles.HORSE : -1, VEH = vehicleTiles();
    const refund = { pack: {}, bank: {}, ground: {} };
    let changed = 0;
    if (pre) for (const [i, t] of [...mapDiffs.entries()]) {
      const x = i % MAP_W, y = Math.floor(i / MAP_W);
      if (x < RECT.x0 || x > RECT.x1 || y < RECT.y0 || y > RECT.y1) continue;
      const b = base[pi(x, y)];
      if (t === b) continue;
      // (a fire burns down to ashes by itself: it stays, as a fire anywhere else on a street does)
      const blocks = (SOLID.has(t) || PUSH_THROUGH.has(t) || VEH.has(t)) && t !== T.FIRE;
      if (open.has(b) && !clear.has(i) && !newIndoors(x, y) && !(onHighStreet(x, y) && blocks)) { MIG.kept++; continue; }
      // undo it: the ground the city has there, with no crop, fire or regrowth left behind
      setTile(x, y, b); mapDiffs.delete(i); miniDirtyTiles.add(i); changed++;
      crops = crops.filter(c => c.i !== i); fires = fires.filter(f => f.i !== i); regrow = regrow.filter(r => r.i !== i);
      if (VEH.has(t)) {
        // a machine, a beast, a wreck or the mare: moved, never lost (the mare to her rail)
        const post = window.MOUNTS && MOUNTS.post, home = t === H0 && post ? post : { x, y };
        const s = parkSpot(home.x, home.y, t === H0 ? 3 : 4, open, clear) || parkSpot(x, y, 8, open, clear);
        if (s) {
          const prev = tileAt(s.x, s.y); changeTile(s.x, s.y, t); MIG.moved++;
          if (t === H0 && player.horse) { player.horse.at = [s.x, s.y]; player.horse.under = tileName(prev); }
          MIG.log.push([x, y, tileName(t), 'moved', s.x, s.y]);
        } else {
          // nowhere open near it: it keeps its cell (still the knight's), never deleted
          changeTile(x, y, t); MIG.kept++; MIG.log.push([x, y, tileName(t), 'stays']);
        }
        continue;
      }
      MIG.reverted++; MIG.log.push([x, y, tileName(t)]);
      const id = placedItemFor(t);
      if (id) {
        const left = addItem(id, 1);
        // a full pack and a full bank: it waits on the ground by the knight, and he is told (never lost without a word)
        if (left) { if (bankAdd(id, 1)) refund.bank[id] = (refund.bank[id] || 0) + 1; else refund.ground[id] = (refund.ground[id] || 0) + 1; }
        else refund.pack[id] = (refund.pack[id] || 0) + 1;
      }
    }
    // where he wakes and where his lodestone takes him: only in the one pass that moves an old save into the new city, and
    // only when that pass took the bed or the lodestone away. A home is wherever 06-systems' safeSpot put it, which can be
    // a tile or two to the side of the stone when something solid stands just south of it, so a home is kept while any
    // lodestone is within 3 tiles of it (a home made in the new city is never touched: the pass runs once per knight)
    const tileOfPx = p => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
    // a knight who paid Dorran and slept at the inn wakes at the inn's bed, one tile east of where it stood; any other bed the
    // pass took away is gone, and he is told where he will wake
    let bedLost = false;
    if (pre && player.bedSpawn) {
      const [x, y] = tileOfPx(player.bedSpawn);
      if (x === OLD_INN_BED[0] && y === OLD_INN_BED[1] && tileAt(...INN_BED) === T.BED) player.bedSpawn = { x: tc(INN_BED[0]), y: tc(INN_BED[1]) };
      else if (inTown(x, y) && tileAt(x, y) !== T.BED) { player.bedSpawn = null; bedLost = true; }
    }
    if (pre && player.home) { const [x, y] = tileOfPx(player.home); if (inTown(x, y) && !nearestTileOfType(x, y, T.LODESTONE, 3)) player.home = null; }
    // and the knight himself, out of anything solid
    if (collides(player.x, player.y, player.r, playerWho())) { const sp = safeSpot(player.x, player.y, player.r, playerWho()) || respawnPoint(); player.x = sp.x; player.y = sp.y; MIG.unstuck = (MIG.unstuck || 0) + 1; }
    // what neither the pack nor the bank could take lies by him, where he now stands
    for (const id of Object.keys(refund.ground)) drops.push({ x: player.x + rint(-10, 10), y: player.y + rint(-10, 10), id, qty: refund.ground[id], t: 0 });
    miniDirty = true;
    // one line per knight, the first time he loads into the new city
    const lines = [];
    if (pre && player.visitedVillage) {
      lines.push('Thistledown has been rebuilt while you were away. Go and see the Great Fountain.');
      for (const w of ['pack', 'bank', 'ground']) { const l = refundWords(refund[w], w); if (l) lines.push(l); }
      if (bedLost) lines.push('The bed you slept in is gone. Until you sleep somewhere new, you will wake by the Great Fountain.');
      for (const l of lines) say(l, 'The Voice');
    }
    if (Object.keys(refund.pack).length || Object.keys(refund.bank).length || Object.keys(refund.ground).length) MIG.refunds.push(refund);
    if (pre) { player.cityV = 1; save(); }
    return { changed, lines, refund };
  }
  { const _load = load; load = function () { const ok = _load(); if (ok) migrate(); return ok; }; }

  const CHUNKS = new Map();
  // =========================================================================
  // 6. what people say
  // =========================================================================
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  // "4 minutes 10 seconds", "1 minute 1 second", "35 seconds": whole seconds, rounded up, never "0 seconds"
  function spanWords(sec) {
    const s = Math.max(1, Math.ceil(sec - 1e-9)), m = Math.floor(s / 60), r = s % 60;
    if (m && r) return `${plural(m, 'minute')} ${plural(r, 'second')}`;
    return m ? plural(m, 'minute') : plural(r, 'second');
  }
  // Ambrose reads the sky: the same clock 35-night runs (NIGHT.dayT, LIGHT, DUSK, DAY)
  function timeLine() {
    const N = window.NIGHT; if (!N) return 'The sun is up.';
    const t = N.dayT();
    if (t < N.LIGHT) return `The sun is up. Dusk comes in ${spanWords(N.LIGHT - t)}.`;
    if (t < N.LIGHT + N.DUSK) return `Dusk. It will be dark in ${spanWords(N.LIGHT + N.DUSK - t)}.`;
    return `Night. The sun comes up in ${spanWords(N.DAY - t)}.`;
  }
  const dialAngle = () => window.NIGHT ? NIGHT.dayT() / NIGHT.DAY * Math.PI * 2 : 0;
  const banner = (text, sub) => { levelBanner = { text, sub, t: 3.5 }; sfx('quest'); };
  // counters that only change which line comes next (not saved)
  const TALK = { ambrose: 0, wynn: 0 };
  const DUCHESS_LINE = 'Duchess came back for her cream last night. The bell rang once. Nobody minded.';
  const AMBROSE_HELLO = 'I ring the bell at dawn and at dusk. When you hear it at dusk, get indoors or get your sword out.';
  HOOKS.talk.td_bell = n => {
    const q = Q(), s = q.bell, who = n.name;
    if (s === 0 && quest.stage >= 6) {
      // a knight meeting him for the first time hears who he is before the story (after the Duke, the first talk is both)
      if (!q.ambroseMet) say(AMBROSE_HELLO, who);
      q.bell = 1; q.ambroseMet = true;
      say('Knight, may I ask you something? It will sound silly.', who);
      say('Every night at midnight, my bell rings once. Bong. Just once. Nobody is in the tower, and I have the only key.', who);
      say('The whole town says it is a ghost. I do not believe in ghosts. Mostly.', who);
      say('Osric at the West Gate watches the wall all night. Ask him what he has seen.', who);
      banner('NEW QUEST', 'The Bell at Midnight'); save();
      return;
    }
    if (s === 1) { say('Osric is at the West Gate. Ask him what he saw last night.', who); return; }
    if (s === 2) { say('A jug at the bakery? Then ask Rosalind what went missing.', who); return; }
    if (s === 3) { say('Footprints going to the maze? Look in the middle of it, at the sundial.', who); return; }
    if (s === 4) {
      q.bell = 5;
      say('Grey fur and a gold thistle? Then it is no ghost.', who);
      say('I will unlock the tower door for you. Climb up the Bell Tower and look at the bell. Quietly.', who);
      save(); return;
    }
    if (s === 5) { say('The tower door is open. Climb the Bell Tower and look at the bell. Quietly.', who); return; }
    if (s === 6) {
      q.bell = 'done';
      say('A grey cat with a purple collar? That is Duchess, the Duke\'s own cat. He has been looking for her all week.', who);
      say('She sleeps on the bell because it is warm. When she jumps down, the bell rings. Bong.', who);
      say('So the ghost of Thistledown is a cat who likes cream. The Duke says she may keep her bed in the tower. Thank you, knight.', who);
      giveOrDrop('coins', 75, player.x, player.y);
      banner('NO GHOST', 'The Bell at Midnight'); save();
      return;
    }
    if (!q.ambroseMet) { q.ambroseMet = true; say(AMBROSE_HELLO, who); save(); return; }
    if (storyDone() && TALK.ambrose++ % 2 === 1) { say(DUCHESS_LINE, who); return; }
    say(timeLine(), who);
  };
  const OSRIC = q => [
    'Welcome to Thistledown, knight. The High Street runs gate to gate. The Great Fountain is in the middle, and the castle is south of it, across the moat.',
    quest.walkerKilled ? 'They say you brought down the goblin walker. The watch has never slept so well.' : 'The gates stay open day and night. Horses ride through. Goblins do not.',
    'The smithy and the tinker are on your right as you come in. Sergeant Hale drills in the yard behind them.',
  ];
  HOOKS.talk.td_warden = n => {
    const q = Q(), who = n.name;
    if (q.bell === 1) {
      q.bell = 2;
      say('A ghost? Ha. Nobody came through my gate after dark. Nobody with two legs, anyway.', who);
      say('But something small ran along the top of the wall last night, quick as a blink. Then, bong, the bell.', who);
      say('And Rosalind\'s back window was open at midnight. I heard a jug fall over. Ask Rosalind at the bakery.', who);
      save(); return;
    }
    const L = OSRIC(q); say(L[q.osricN % L.length], who); q.osricN++;
  };
  const WYNN = ['The swans are called Lord and Lady. The ducklings do not have names yet. I am working on it.', 'I am not allowed in the maze on my own. There is a sundial in the middle. I have never seen it.', 'The ghost was a cat? I knew it. I KNEW it.'];
  HOOKS.talk.td_wynn = n => { const L = storyDone() ? WYNN : WYNN.slice(0, 2); say(L[TALK.wynn % L.length], n.name); TALK.wynn++; };
  // Rosalind: one talk of the story at step 2 (no shop that time); the next talk opens her bakery as always
  { const _shop = HOOKS.talkBefore.shop;
    HOOKS.talkBefore.shop = n => {
      if (n && n.id === 'rosalind' && Q().bell === 2) {
        Q().bell = 3;
        say('Oh, my cream! Somebody drank a whole jug of it last night. Somebody small.', n.name);
        say('There were footprints in the flour. Four little feet, and a line between them. Like a tail.', n.name);
        say('They went out the window and over the wall, towards the Duke\'s maze.', n.name);
        save(); return true;
      }
      return _shop ? _shop(n) : false;
    };
  }

  // =========================================================================
  // 7. what E (or a tap) on the city's things says
  // =========================================================================
  const PLAQUES = {
    last_knight: 'THE LAST KNIGHT OF HOLLOWFORD. He rode out alone to hold the road. His grave is in Wolfwood.',
    thrain: 'KING THRAIN OF THE DWARVES. His halls are deep under the hills, below the Grey Quarry.',
    aelith: 'QUEEN AELITH OF THE ELVES. Her people live in the jungle, far to the south.',
    seraphel: 'QUEEN SERAPHEL OF AERIE, THE CITY ABOVE THE CLOUDS. Most people say Aerie is only a story.',
  };
  const STATUE_NAME = { last_knight: 'Statue of the Last Knight', thrain: 'Statue of King Thrain', aelith: 'Statue of Queen Aelith', seraphel: 'Statue of Queen Seraphel' };
  const STALL_LINE = { apples: "Apples from the Duke's Orchard, in a heap.", candles: 'Candles of every size. Mabel makes them all.', flowers: 'Flowers in buckets. Moll picks them fresh.', cloth: 'Bolts of cloth. A sign says: BACK SOON.' };
  const SIGN_LINE = {
    west: 'WEST GATE. Out this way: the road to the cave where you woke, the Grey Quarry, and Wolfwood.',
    east: "EAST GATE. Out this way: the Goblin Camp, and Harl's dock on the Grey Sea.",
  };
  const PLAIN_LINE = {
    lamp: 'A street lamp. Mabel lights it at dusk.',
    bench: 'You sit for a moment. Your feet are grateful.',
    hedge: 'A hedge, clipped flat as a table.',
    fruit: 'An apple tree. The apples are not ripe yet.',
    cherry: 'A cherry tree in flower.',
    roses: "Roses. The Duke's own. Nobody picks these.",
    market: 'The market fountain. Children dare each other to drink from it.',
    rose: 'A little fountain. A frog sits on the rim and ignores you.',
    flowers: 'A flower bed. The bees are busy in it.',
    woodpile: "A woodpile for the smithy's fires. Every log is split the same size.",
    cart: "Brakka's handcart, heaped with charcoal for the forges.",
    oldanvil: 'An old anvil on a tree stump. The apprentices practise on it.',
    trough: 'A water trough. The smith cools hot iron in it, and it hisses.',
    well: 'The well on the Bell Green. The water is cold and clear.',
    table: "A table in the inn's garden. Somebody has left a tankard on it.",
  };
  const TOWER_LINE = 'A tower of the town wall. A guard on top waves at you.';
  const SUNDIAL_LINE = "The middle of the Duke's maze. Someone scratched into the sundial: FERRIN WAS HERE. AGED 10.";
  const KIND_TAP = { lamp: 'Street lamp', bench: 'Bench', stall: 'Market stall', sign: 'Signpost', bell: 'Bell Tower', sundial: 'Sundial', hedge: 'Hedge', fruit: 'Fruit tree', cherry: 'Cherry tree', roses: 'Roses', great: 'The Great Fountain', market: 'Market fountain', rose: 'Rose Garden fountain',
    flowers: 'Flower bed', woodpile: 'Woodpile', cart: 'Handcart', oldanvil: 'Old anvil', trough: 'Water trough', well: 'Well', table: 'Garden table' };
  const TOSS = [
    'You toss a coin. It spins, splashes, and sinks with the others.',
    'Plink. A fish nibbles it, decides it is not food, and swims off.',
    "The coin lands on the stone knight's boot and stays there.",
    "Splash. Somewhere, somebody's wish just got a little bit closer.",
    'The coin skips once, twice, and sinks. Good throw.',
    'You make a wish. The fountain keeps it a secret.',
  ];
  const statueDone = () => quest.stage >= 16;
  const OFFLINE_HERO = 'THE KNIGHT FROM THE CAVE';
  const onlineName = () => window.NET && NET.status === 'on' && NET.me ? String(NET.me).toUpperCase() : null;
  function heroNameNow() { return onlineName() || OFFLINE_HERO; }
  // a knight on the way into the online world: 71-login has loaded his save, but the world's welcome (and with it his
  // name, NET.me) has not come yet, or the line dropped. His plinth name waits for it.
  const joining = () => !!(window.NET && NET.enabled && NET.status !== 'on' && (NET.status === 'connecting' || (window.LOGIN && LOGIN.playing)));
  // the name on the plinth, saved the first time the Fang is seen dead: online it is the knight's own name; a name saved
  // offline gives way to it the first time this knight plays online
  function heroTick(q) {
    if (quest.stage < 16) return;
    if (!q.heroName) { if (!joining()) { q.heroName = heroNameNow(); save(); } }
    else if (q.heroName === OFFLINE_HERO && onlineName()) { q.heroName = onlineName(); save(); }
  }
  const heroName = () => Q().heroName || heroNameNow();
  const plinthLine = () => statueDone() ? `${heroName()}, WHO SLEW THE FANG. Thistledown will not forget.` : 'AN EMPTY PLINTH. Carved on the front: KEPT FOR THE KNIGHT WHO ENDS THE DRAGON.';
  // the name a tap shows and the speaker a use is said by
  function tapName(x, y) {
    const k = kindAt(x, y); if (!k) return null;
    if (k === 'statue') { const s = statueAt(x, y); return s ? STATUE_NAME[s.id] : null; }
    if (k === 'plinth') return statueDone() ? 'Statue of you' : 'Empty plinth';
    return KIND_TAP[k] || null;
  }
  // the line a thing says when used (and who says it); the story steps and the toss are in useThing
  function lineFor(x, y) {
    const k = kindAt(x, y); if (!k) return null;
    if (k === 'statue') { const s = statueAt(x, y); return s ? ['Plaque', PLAQUES[s.id]] : null; }
    if (k === 'plinth') return ['Plaque', plinthLine()];
    if (k === 'stall') { const s = stallAt(x, y); return s ? [KIND_TAP.stall, STALL_LINE[s.goods]] : null; }
    if (k === 'sign') { const s = signAt(x, y); return s ? [KIND_TAP.sign, SIGN_LINE[s.side]] : null; }
    if (k === 'bell') return ['Bell Tower', `The Bell Tower. ${timeLine()}`];
    if (k === 'sundial') return ['Sundial', SUNDIAL_LINE];
    if (k === 'great') return ['The Great Fountain', `The Great Fountain. People toss a coin in for luck. ${touchMode() ? 'Tap USE' : 'Press E'} again to toss 1 coin.`];
    if (PLAIN_LINE[k]) return [KIND_TAP[k], PLAIN_LINE[k]];
    return null;
  }
  const great = FOUNTAINS.find(f => f.id === 'great');
  const greatC = { x: (great.x + great.w / 2) * TILE, y: (great.y + great.h / 2) * TILE };
  function splash() { burst(greatC.x + (Math.random() - 0.5) * 50, greatC.y - 6, '#bfe6ff', 12, 70); sfx('splash'); }
  // the fountain's line takes the place of the one it is showing, so E pressed again and again (a keyboard: E does not turn
  // the page) shows each toss at once instead of stacking them behind the first
  function fountainSays(text, who) {
    if (dialog.cur && dialog.cur.who === who) { dialog.cur = { text, who }; dialog.shown = 0; dialog.t = 0; dialog.queue = dialog.queue.filter(l => l.who !== who); }
    else say(text, who);
  }
  function useGreat() {
    const q = Q(), who = 'The Great Fountain', now = time + 1;
    const armed = q.tossArmed > 0 && now >= q.tossArmed && now - q.tossArmed <= 6;
    if (!armed) { q.tossArmed = now; fountainSays(lineFor(great.x, great.y)[1], who); return; }
    if (coins() < 1) { fountainSays('You have no coins to toss.', who); return; }
    payCoins(1); const line = TOSS[q.tossed % TOSS.length]; q.tossed++; q.tossArmed = now;
    splash(); fountainSays(line, who); save();
  }
  // the story's two places: the sundial in the maze, and the Bell Tower
  function useSundial() {
    const q = Q();
    if (q.bell === 3) {
      q.bell = 4;
      say('Someone scratched into the sundial: FERRIN WAS HERE. AGED 10.', 'The Voice');
      say('On the warm stone lie tufts of soft grey fur, and a little gold thistle charm on a broken purple ribbon.', 'The Voice');
      say('Whoever drank the cream sleeps somewhere warm. Tell Ambrose what you found.', 'The Voice');
      save(); return;
    }
    say(SUNDIAL_LINE, 'Sundial');
  }
  const BELLST = { prev: null, swingT0: -99, rings: 0, midnights: 0 };
  const CAT = { t0: -99 };
  const BELL_TOP = { x: (PLAN.BELL.x + 1) * TILE, y: (PLAN.BELL.y + PLAN.BELL.h) * TILE - 210 };
  function ringBell(word) {
    BELLST.swingT0 = time; BELLST.rings++;
    sfx('bell');
    if (!away()) floatText(BELL_TOP.x, BELL_TOP.y, word || 'DONG', '#f5c542', 20);
  }
  function useBell() {
    const q = Q();
    if (q.bell === 5) {
      q.bell = 6;
      say('You climb the steps to the top of the tower, where the bell hangs. Two green eyes look back at you from the dark.', 'The Voice');
      say('A big grey cat is curled up on the bell, where the sun has warmed it all day. She yawns.', 'The Voice');
      say('She jumps down past you, and her tail catches the rope. The bell rings. BONG.', 'The Voice');
      say('Round her neck is a purple collar. The little gold charm is missing from it.', 'The Voice');
      ringBell(); CAT.t0 = time;
      save(); return;
    }
    const l = lineFor(PLAN.BELL.x, PLAN.BELL.y); say(l[1], l[0]);
  }
  function useThing(k, x, y) {
    if (k === 'great') return useGreat();
    if (k === 'sundial') return useSundial();
    if (k === 'bell') return useBell();
    const l = lineFor(x, y); if (l) say(l[1], l[0]);
  }
  HOOKS.use.push((t, tx, ty) => {
    if (away() || !inTown(tx, ty)) return false;
    if (t === PROP || t === FOUNT || t === HEDGE) { const k = kindAt(tx, ty); if (!k) return false; useThing(k, tx, ty); return true; }
    if (t === WALL_T() && isTowerCell(tx, ty)) { say(TOWER_LINE, 'Wall tower'); return true; }
    return false;
  });

  // ---------- the small folk: Duchess, Tess and Robin ----------
  // the wall clock moves them, so every knight online sees them in the same place without a message
  const CLOCK = { fixed: null };
  const wallMs = () => CLOCK.fixed !== null && CLOCK.fixed !== undefined ? CLOCK.fixed : Date.now();
  const KP = PLAN.KIDS.path.map(([x, y]) => [x + 0.5, y + 0.5]);
  const KLEN = (() => { let L = 0; for (let i = 0; i < KP.length - 1; i++) L += Math.hypot(KP[i + 1][0] - KP[i][0], KP[i + 1][1] - KP[i][1]); return L; })();
  // where a child is (in tiles) and which way they run: ping-pong along the U at 1.6 tiles a second
  function kidAt(ms) {
    const u = ((ms / 1000 * PLAN.KIDS.speed) % (2 * KLEN) + 2 * KLEN) % (2 * KLEN), back = u > KLEN; let s = back ? 2 * KLEN - u : u;
    for (let i = 0; i < KP.length - 1; i++) {
      const [ax, ay] = KP[i], [bx, by] = KP[i + 1], d = Math.hypot(bx - ax, by - ay);
      if (s <= d || i === KP.length - 2) { const k = d ? Math.min(1, s / d) : 0, dx = (bx - ax) / (d || 1), dy = (by - ay) / (d || 1); return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, dx: back ? -dx : dx, dy: back ? -dy : dy }; }
      s -= d;
    }
    return { x: KP[0][0], y: KP[0][1], dx: 0, dy: 1 };
  }
  const KIDS = [
    { id: 'tess', name: 'Tess', lag: 0, line: 'Catch me if you can!', look: { who: 'tess', tunic: '#c94a6a', hair: '#e0c080', woman: true, shoulder: '#e9d8b8', skin: '#f2d6bf' } },
    { id: 'robin', name: 'Robin', lag: PLAN.KIDS.lag, line: 'You are it! No, wait. Tess is it!', look: { who: 'robin', tunic: '#3f7db8', hair: '#6a3a1a', shoulder: '#d9c9a0', skin: '#e8c0a0' } },
  ];
  function kidsNow() { const ms = wallMs(); for (const k of KIDS) { const p = kidAt(ms - k.lag * 1000); k.px = tc(0) + (p.x - 0.5) * TILE; k.py = (p.y) * TILE; k.dx = p.dx; k.dy = p.dy; } return KIDS; }
  const duchessHome = () => ({ x: tc(PLAN.DUCHESS.x), y: tc(PLAN.DUCHESS.y) + 8 });
  const duchessHere = () => { const s = Q().bell; return (s === 6 || s === 'done') && time - CAT.t0 >= 2; };
  const DUCHESS_TAP = 'Duchess, the Duke\'s cat. She is pretending she cannot see you.';
  function smallFolk() {
    if (away()) return [];
    const out = kidsNow().map(k => ({ x: k.px, y: k.py, r: 12, id: 'td_' + k.id, name: k.name, talk: () => { tapFaceTo(k.px, k.py); say(k.line, k.name); } }));
    if (duchessHere()) { const d = duchessHome(); out.push({ x: d.x, y: d.y, r: 12, id: 'td_duchess', name: 'Duchess', talk: () => { tapFaceTo(d.x, d.y); say(DUCHESS_TAP, 'Duchess'); } }); }
    return out;
  }
  function tapFaceTo(x, y) { const dx = x - player.x, dy = y - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
  TAP_PEOPLE.push(() => smallFolk().filter(p => dist(p.x, p.y, player.x, player.y) < 30 * TILE));
  // E on one of them: in front of the knight, within reach (after the city's own things, which the handler above answers)
  function folkInFront() {
    if (away() || player.dead || player.mech) return null;
    let best = null, bd = 1e9;
    for (const p of smallFolk()) {
      const d = dist(player.x, player.y, p.x, p.y); if (d > 80) continue;
      const dot = ((p.x - player.x) * player.facing.x + (p.y - player.y) * player.facing.y) / (d || 1);
      if (dot < 0.3 && d > 30) continue;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  // pushed after the tile handler: facing a fountain or a lamp uses it even with a child running past
  HOOKS.use.push(() => { if (away() || !inTown(Math.floor(player.x / TILE), Math.floor(player.y / TILE))) return false; const p = folkInFront(); if (!p) return false; p.talk(); return true; });

  // a tap names the thing the way E does
  { const _tapLabelFor = tapLabelFor;
    tapLabelFor = function (p) {
      if (p && !away() && (p.kind === 'use' || p.kind === 'walk' || p.kind === 'wall') && inTown(p.tx, p.ty)) {
        const t = p.t;
        if (t === PROP || t === FOUNT || t === HEDGE) { const n = tapName(p.tx, p.ty); if (n) return n; }
        if (t === WALL_T() && isTowerCell(p.tx, p.ty)) return 'Wall tower';
        if (t === T.COBBLE || t === LAWN) { const s = PLAN.streetAt(p.tx, p.ty); if (s) return s.name.replace(/^The /, ''); }
        if (t === LAWN) return 'Lawn';
      }
      return _tapLabelFor(p);
    };
  }
  // a tap on the middle of a fountain (or on the bell) walks to the nearest cell of it that has open ground beside it
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // A cell to stand on beside a fountain or the bell is no good when one of the town's people who stay put stands on it or
  // right next to it (Tobin at 110,33, by the Great Fountain's north-west rim): the knight would end up facing him
  const STAYERS = () => NPCS.filter(n => !n.wander && inTown(n.x, n.y));
  const byStayer = (x, y) => STAYERS().some(n => Math.abs(n.x - x) <= 1 && Math.abs(n.y - y) <= 1);
  const standOpen = (x, y) => N4.some(([dx, dy]) => !SOLID.has(tileAt(x + dx, y + dy)) && !byStayer(x + dx, y + dy));
  function rimFor(tx, ty) {
    const k = kindAt(tx, ty), f = fountainAt(tx, ty);
    const same = (x, y) => f ? fountainAt(x, y) === f && tileAt(x, y) === FOUNT : kindAt(x, y) === k;
    const open = (x, y) => N4.some(([dx, dy]) => !SOLID.has(tileAt(x + dx, y + dy)));
    // the nearest rim cell with a clear place to stand; failing that, the nearest with any open ground
    for (const ok of [standOpen, open]) {
      let best = null, bd = 1e9;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = tx + dx, y = ty + dy; if (!same(x, y) || !ok(x, y)) continue;
        const d = dist(tc(x), tc(y), player.x, player.y); if (d < bd) { bd = d; best = [x, y]; }
      }
      if (best) return best;
    }
    return null;
  }
  // A tap on greenery or water that no one can stand beside (the middle of a hedge bed, Swan Pond where the swans swim, the
  // castle moat's far sides) walks to the nearest cell of the same bed, or of the same water, that can be reached, instead of
  // the core's "You can't get there." (fishing works from that shore). Nearest first, 10 cells round at most, 4 tries.
  const TWIN_R = 10;
  function reachableTwin(p) {
    const water = p.t === T.WATER, k = water ? null : kindAt(p.tx, p.ty);
    const same = (x, y) => water ? tileAt(x, y) === T.WATER : tileAt(x, y) === HEDGE && kindAt(x, y) === k;
    const cands = [];
    for (let r = 1; r <= TWIN_R; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = p.tx + dx, y = p.ty + dy;
      if (inTown(x, y) && same(x, y) && N4.some(([a, b]) => !SOLID.has(tileAt(x + a, y + b)))) cands.push([x, y, dx * dx + dy * dy]);
    }
    cands.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of cands.slice(0, 4)) if (tapPathTo(x, y, true)) return [x, y];
    return null;
  }
  { const _tapPick = tapPick;
    tapPick = function (sx, sy) {
      const p = _tapPick(sx, sy);
      if (!p || away() || p.kind !== 'use' || !inTown(p.tx, p.ty)) return p;
      if ((p.t === HEDGE || p.t === T.WATER) && !tapPathTo(p.tx, p.ty, true)) { const r = reachableTwin(p); return r ? Object.assign({}, p, { tx: r[0], ty: r[1] }) : p; }
      const k = kindAt(p.tx, p.ty);
      if (!(p.t === FOUNT || k === 'bell')) return p;
      const middle = p.t === FOUNT && fountainAt(p.tx, p.ty) === great && p.ty === TD.y(35) && (p.tx === TD.x(111) || p.tx === TD.x(112));
      if (!middle && standOpen(p.tx, p.ty)) return p;
      const r = rimFor(p.tx, p.ty);
      return r ? Object.assign({}, p, { tx: r[0], ty: r[1] }) : p;
    };
  }
  // E on a fountain or a town thing answers as that thing, even with one of the town's people beside it (Tobin by the
  // Great Fountain, the villager by the waiting plinth): the core talks to the person in front first. A person standing on
  // the faced cell itself still answers, and so does one standing between the knight and the thing (nearer along the way
  // the knight faces, and not off to one side), and so do the sellers over their stall counters.
  // A TAP on a town thing (a stall, a bench, a hedge, a lamp, a statue) is aimed at the thing, not at whoever stands near it:
  // it answers as the thing from every side, the sellers' stalls too (E still talks to a seller over the counter, and a tap
  // on the seller talks to her). Only a person standing on the tapped cell itself answers instead. TAPPED is set while
  // 17-tap's tapUseNow uses the cell the knight tapped.
  let TAPPED = null;
  { const _tapUseNow = tapUseNow;
    tapUseNow = function () {
      const u = tap.useTile;
      if (!u || away() || !inTown(u.tx, u.ty)) return _tapUseNow();
      const t = tileAt(u.tx, u.ty);
      if (!((t === PROP || t === FOUNT || t === HEDGE) && kindAt(u.tx, u.ty))) return _tapUseNow();
      TAPPED = { tx: u.tx, ty: u.ty };
      try { return _tapUseNow(); } finally { TAPPED = null; }
    };
  }
  { const _npcInFront = npcInFront;
    npcInFront = function () {
      const n = _npcInFront();
      if (!n || away()) return n;
      if (TAPPED) return Math.floor(n.px / TILE) === TAPPED.tx && Math.floor(n.py / TILE) === TAPPED.ty ? n : null;
      const ft = frontTile(player), tx = ft.tx, ty = ft.ty;
      if (!inTown(tx, ty)) return n;
      const t = tileAt(tx, ty);
      if (t !== FOUNT && !(t === PROP && kindAt(tx, ty) !== 'stall')) return n;
      if (Math.floor(n.px / TILE) === tx && Math.floor(n.py / TILE) === ty) return n;
      const fx = player.facing.x, fy = player.facing.y, fl = Math.hypot(fx, fy) || 1, ux = fx / fl, uy = fy / fl;
      const nx = n.px - player.x, ny = n.py - player.y, along = nx * ux + ny * uy, side = Math.abs(nx * uy - ny * ux);
      const thing = (tc(tx) - player.x) * ux + (tc(ty) - player.y) * uy;
      if (along > 0 && along < thing - 12 && side < 22) return n;
      return null;
    };
  }

  // =========================================================================
  // 8. every tick: the wards, Osric's welcome, the plinth, the bell
  // =========================================================================
  const WARD = { name: null, shown: null, since: -1e9, region: null, log: [] };
  const BARK = { t: 0, pending: false, quiet: 0, log: [] };
  // a banner across the top of the screen that the welcome tag would sit under, or a talk box (on a phone the Voice's box
  // is at the top of the screen, right where the tag is)
  // (while it fades too: at 0.3 s left a phone's THISTLEDOWN plate still showed, right over the tag)
  const bannerUp = () => !!(dialog.cur || (areaBanner && areaBanner.t > 0) || (typeof levelBanner !== 'undefined' && levelBanner && levelBanner.t > 0));
  // and a short breath after the banner has gone, so the two never arrive together
  const BARK_QUIET = 0.4;
  const PL = PLAN.PLINTH;
  HOOKS.update.push(dt => {
    const q = Q();
    heroTick(q);
    if (BARK.t > 0) BARK.t = Math.max(0, BARK.t - dt);
    if (player.region !== WARD.region) { WARD.region = player.region; WARD.since = time; }
    if (away() || player.dead) return;
    const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
    // a ward's banner on the way into it: not in the first 3.2 s after a region banner, never the same twice running
    const w = inTown(tx, ty) ? PLAN.wardAt(tx, ty) : null;
    WARD.name = w ? w.name : null;
    if (w && w.name !== WARD.shown && time - WARD.since >= 3.2) { WARD.shown = w.name; areaBanner = { name: w.name, sub: w.sub, t: 2.4 }; WARD.log.push(w.name); }
    // Gatewarden Osric calls out once, the first time a knight comes near; never while a banner is up (THISTLEDOWN as the
    // knight comes in at the gate, a ward's, a level's) or a talk box is open, or his tag would be drawn under it: he
    // waits for it to go
    const os = npc('osric');
    if (!q.barked && os) {
      const d = dist(player.x, player.y, os.px, os.py);
      if (d <= 3 * TILE) BARK.pending = true;
      else if (d > 9 * TILE) BARK.pending = false;
      if (BARK.pending && !bannerUp()) BARK.quiet += dt; else BARK.quiet = 0;
      if (BARK.pending && BARK.quiet >= BARK_QUIET) { BARK.pending = false; BARK.quiet = 0; q.barked = true; BARK.t = 4; BARK.log.push({ t: time, area: !!areaBanner, level: !!levelBanner }); save(); }
    }
    // the waiting plinth, once it holds the knight who slew the Fang
    if (statueDone() && !q.plinthTold && !dialog.cur && !dialog.queue.length && dist(player.x, player.y, tc(PL.x), tc(PL.y)) <= 8 * TILE) {
      q.plinthTold = true; say('The empty plinth by the castle gate is empty no longer.', 'The Voice'); save();
    }
  });
  // the bell rings at dawn and at dusk, for a knight in the town or the castle; and once at midnight, BONG, as the story
  // says (Duchess jumping down off it: the ghost of The Bell at Midnight), the middle of the night on the day clock
  const MIDNIGHT = N0 => N0.LIGHT + N0.DUSK + (N0.DAY - N0.LIGHT - N0.DUSK) / 2;
  HOOKS.update.push(() => {
    const N = window.NIGHT; if (!N) return;
    const t = N.dayT();
    if (BELLST.prev !== null && !away()) {
      const dawn = t < BELLST.prev && BELLST.prev - t > N.DAY / 2;
      const dusk = BELLST.prev < N.LIGHT && t >= N.LIGHT && t - BELLST.prev < N.DAY / 2;
      const mid = MIDNIGHT(N), midnight = BELLST.prev < mid && t >= mid && t - BELLST.prev < N.DAY / 2;
      const here = player.region === 'Thistledown' || player.region === 'Castle Thistledown';
      if ((dawn || dusk) && here) ringBell();
      else if (midnight && here) { ringBell('BONG'); BELLST.midnights++; }
    }
    BELLST.prev = t;
  });
  function resetCapital() {
    quest.capital = fresh(); player.cityV = 1;
    WARD.name = null; WARD.shown = null; WARD.since = -1e9; WARD.region = null; WARD.log.length = 0;
    BARK.t = 0; BARK.pending = false; BARK.quiet = 0; TALK.ambrose = 0; TALK.wynn = 0; CAT.t0 = -99; BELLST.prev = null; BELLST.swingT0 = -99;
    KEEP_CLEAR = null;
  }
  HOOKS.newGame.push(resetCapital);
  if (!SFX.bell) SFX.bell = () => { tone('sine', 523, 523, 1.4, 0.07); tone('sine', 1046, 1046, 1.4, 0.035); };
  if (!SFX.splash) SFX.splash = () => noise(0.25, 0.07, 0, 900);

  // ---------- the quest log and the map ----------
  const QTEXT = {
    0: 'Not started. Ambrose the bell-ringer, at the Bell Tower at the north end of Crown Street, has a question once you have met the Duke.',
    1: "Ambrose's bell rings by itself at midnight. Ask Gatewarden Osric at the West Gate what he has seen.",
    2: 'Osric heard a jug fall at the bakery at midnight. Ask Rosalind at the bakery, north of the High Street.',
    3: "Small footprints with a tail went from the bakery towards the Duke's maze. Look in the middle of the maze, at the sundial.",
    4: 'You found grey fur and a gold thistle charm on the sundial. Tell Ambrose at the Bell Tower.',
    // (the keys a child reads are the ones in his hands: USE on a touch screen, E on a keyboard)
    5: () => `Ambrose unlocked the Bell Tower. Climb it: walk up to the tower and ${touchMode() ? 'tap USE, or tap the tower' : 'press E'}.`,
    6: 'The ghost was a cat. Tell Ambrose.',
    done: "Done. The ghost of Thistledown is Duchess, the Duke's cat.",
  };
  HOOKS.questText.td_bell = () => { const v = QTEXT[Q().bell] || QTEXT[0]; return typeof v === 'function' ? v() : v; };
  HOOKS.activeQuests.push(() => storyOpen() ? ['td_bell'] : []);
  const TARGETS = { 1: [...TD.p(91, 30), 'Gatewarden Osric'], 2: [...TD.p(125, 22), 'Rosalind, the bakery'], 3: [...TD.p(133, 18), 'The sundial'], 4: [...TD.p(110, 17), 'Ambrose'], 5: [...TD.p(111, 17), 'The Bell Tower'], 6: [...TD.p(110, 17), 'Ambrose'] };
  HOOKS.mapTarget.push(() => { if (!storyOpen()) return null; const [x, y, label] = TARGETS[Q().bell]; return { x, y, label, id: 'td_bell' }; });

  // =========================================================================
  // 9. drawing
  //   Layers (y): the ground, blitted from cached chunks at -1e9 - 10, under every other file's ground marks (the tap ring,
  //   the fight-back ring), then the doorsteps and the drops on it, redrawn;
  //   the lily pads at -1e8 - 1; walls, towers, lamps, statues, fountains, greenery, stalls, the Bell Tower, the castle
  //   and the people y-sorted at the foot of their footprint; the bunting at 9e8, over every head; the lamp heads' glow at
  //   1e9 + 1, over the night;
  //   Osric's welcome at 1e9 + 3, over the night. Every item's draw takes no arguments, and every static body is a cached
  //   sprite (only water, flags, flames, smoke and creatures move).
  // =========================================================================
  const SS = 2;
  // the y the ground chunks sort at: before everything else that is drawn as an item
  const GROUND_Y = -1e9 - 10;
  // the fractional part, always 0..1 (a % 1 of a negative clock is negative)
  const fr = v => v - Math.floor(v);
  // (the ground's per-cell looks below hash the OLD map's cell, TD.ix / TD.iy, so the town looks the same when it moves)
  const hash = (x, y) => ((Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0) / 4294967296;
  const STATS = { frames: 0, chunks: 0, repaints: 0, painted: 0, items: 0, towers: 0, lampsLit: 0, fountains: 0, statues: 0, keep: 0, townBuildings: 0, deathHouse: 0, porches: 0, bellAlpha: 1, gateAlpha: {}, gateWho: {}, pics: 0, record: false, boxes: [] };
  const CACHE = {};
  function sprite(key, w, h, ax, ay, fn) {
    let s = CACHE[key];
    if (!s) {
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * SS)); c.height = Math.max(1, Math.ceil(h * SS));
      const cg = c.getContext ? c.getContext('2d') : null;
      if (cg) { try { cg.scale(SS, SS); cg.translate(ax, ay); fn(cg); } catch (e) { } }
      s = CACHE[key] = { c, w, h, ax, ay };
    }
    return s;
  }
  const blit = (g, s, x, y) => g.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h);
  const lit = () => !!(window.NIGHT && NIGHT.phase() !== 'day');
  const vis = (c, x0, y0, x1, y1) => x1 > c.x && x0 < c.x + VW && y1 > c.y && y0 < c.y + VH;
  // the knight behind something tall: it is drawn see-through, so he never vanishes behind it
  // A tall thing (a tower, a tree, a statue, the Bell Tower, the keep's turrets) goes see-through while a knight is behind
  // it: this knight, and the friends online on this map (73-players' REMOTE, where they are drawn), so a friend on the
  // grass behind the Bell Tower is not hidden from everyone else. The list is made once a frame.
  const KN = { t: NaN, px: NaN, py: NaN, dead: false, list: [] };
  function knightsNow() {
    if (KN.t === time && KN.px === player.x && KN.py === player.y && KN.dead === player.dead) return KN.list;
    const out = []; KN.t = time; KN.px = player.x; KN.py = player.y; KN.dead = player.dead; KN.list = out;
    if (!player.dead) out.push({ x: player.x, y: player.y, sort: player.y + player.r });
    const P = window.PLAYERS;
    if (P && P.remote && typeof P.mapId === 'function') { const my = P.mapId(); for (const n in P.remote) { const e = P.remote[n]; if (e && !e.dead && e.map === my && e.shown) out.push({ x: e.shown.x, y: e.shown.y, sort: e.shown.y + 13 }); } }
    return out;
  }
  function behindAlpha(x0, y0, x1, y1, sortY) {
    for (const k of knightsNow()) {
      if (k.sort >= sortY) continue;
      if (k.x + 14 > x0 && k.x - 14 < x1 && k.y + 14 > y0 && k.y - 34 < y1) return 0.45;
    }
    return 1;
  }
  // one item: drawn at y, and its box recorded for the self-test (C19) while STATS.record is on
  function put(items, y, box, draw, own) {
    items.push({ y, draw, capital: true });
    STATS.items++;
    if (STATS.record && box) STATS.boxes.push({ x0: box[0], y0: box[1], x1: box[2], y1: box[3], own: own || null, y });
  }
  const PURPLE = '#5a2e7a', PURPLE_D = '#42205a', PURPLE_L = '#7a4a9a', GOLD = '#f5c542', GOLD_D = '#c9a14a';
  const STONE = ['#6e7178', '#7d8087', '#9aa0a8'], SLATE = ['#4a4f5a', '#3a3f4a', '#5d6370'];

  // ---------- small pieces of heraldry ----------
  // the thistle: a gold head with a spiky crown on a stem with two leaves
  function thistle(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 10, s / 10);
    g.strokeStyle = col || GOLD; g.fillStyle = col || GOLD; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 2); g.lineTo(0, 11); g.stroke();
    g.beginPath(); g.moveTo(0, 7); g.quadraticCurveTo(-6, 4, -8, 8); g.quadraticCurveTo(-4, 9, 0, 8); g.fill();
    g.beginPath(); g.moveTo(0, 7); g.quadraticCurveTo(6, 4, 8, 8); g.quadraticCurveTo(4, 9, 0, 8); g.fill();
    g.beginPath(); g.ellipse(0, 0, 4, 3.4, 0, 0, 7); g.fill();
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.38; g.beginPath(); g.moveTo(Math.cos(a) * 2.5, -1 + Math.sin(a) * 2.5); g.lineTo(Math.cos(a) * 7.5, -1.5 + Math.sin(a) * 7.5); g.stroke(); }
    g.restore();
  }
  // the Duke's arms: a purple shield edged in gold with a gold thistle
  function arms(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s / 20, s / 20);
    g.fillStyle = GOLD_D; g.beginPath(); g.moveTo(-11, -12); g.lineTo(11, -12); g.lineTo(11, 0); g.quadraticCurveTo(10, 10, 0, 15); g.quadraticCurveTo(-10, 10, -11, 0); g.closePath(); g.fill();
    g.fillStyle = PURPLE; g.beginPath(); g.moveTo(-9, -10); g.lineTo(9, -10); g.lineTo(9, 0); g.quadraticCurveTo(8, 8, 0, 12.5); g.quadraticCurveTo(-8, 8, -9, 0); g.closePath(); g.fill();
    g.restore();
    thistle(g, x, y - s * 0.12, s * 0.42, GOLD);
  }
  // a long banner hanging from a pole: purple with a gold edge and a gold thistle, a swallowtail that flutters
  function hangBanner(g, cx, top, len, wd, phase) {
    const sw = Math.sin(time * 1.9 + (phase || 0)) * 2.5;
    g.fillStyle = '#3a3f4a'; g.fillRect(cx - wd / 2 - 3, top - 3, wd + 6, 3);
    g.fillStyle = GOLD; g.beginPath(); g.arc(cx - wd / 2 - 3, top - 1.5, 2, 0, 7); g.arc(cx + wd / 2 + 3, top - 1.5, 2, 0, 7); g.fill();
    g.fillStyle = PURPLE; g.beginPath(); g.moveTo(cx - wd / 2, top); g.lineTo(cx + wd / 2, top); g.lineTo(cx + wd / 2 + sw, top + len); g.lineTo(cx + sw * 0.5, top + len - wd * 0.42); g.lineTo(cx - wd / 2 + sw, top + len); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(cx - wd / 2, top, wd * 0.28, len - wd * 0.45);
    g.strokeStyle = GOLD; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - wd / 2 + 1.5, top); g.lineTo(cx - wd / 2 + 1.5 + sw, top + len - 1); g.moveTo(cx + wd / 2 - 1.5, top); g.lineTo(cx + wd / 2 - 1.5 + sw, top + len - 1); g.stroke();
    thistle(g, cx + sw * 0.35, top + len * 0.36, wd * 0.6, GOLD);
  }
  function pennant(g, x, y, len, col) {
    const t = time * 3 + x * 0.02, w1 = Math.sin(t) * 3.5, w2 = Math.sin(t + 1.3) * 4.5;
    g.fillStyle = col || PURPLE;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len * 0.5, y - 3 + w1, x + len, y + 3 + w2); g.quadraticCurveTo(x + len * 0.5, y + 7 + w1, x, y + 9); g.closePath(); g.fill();
    g.fillStyle = col === GOLD ? PURPLE : GOLD; g.beginPath(); g.moveTo(x + len * 0.7, y + 1.5 + w1 * 0.8); g.lineTo(x + len, y + 3 + w2); g.lineTo(x + len * 0.7, y + 7 + w1 * 0.8); g.closePath(); g.fill();
  }

  // ---------- the ground ----------
  // G_UDIRT / G_UGRASS: the core's own dirt or grass, painted under a prop that stands on it (the woodpiles, the cart, the
  // trough), where the core would show the prop tile's cobble texture
  const G_NONE = 0, G_STREET = 1, G_FLAG = 2, G_ASHLAR = 3, G_LAWN = 4, G_GRASS = 5, G_DIRT = 6, G_BRIDGE = 7, G_JETTY = 8, G_WATER = 9, G_GATE = 10, G_PORT = 11, G_UDIRT = 12, G_UGRASS = 13;
  const inCastle = (x, y) => x >= CASTLE.x && x < CASTLE.x + CASTLE.w && y >= CASTLE.y && y < CASTLE.y + CASTLE.h;
  const codeOf = (c, x, y) => c === '=' ? G_STREET : c === 'G' ? G_GATE : (c === '+' || c === 'N' || c === 'O') ? (inCastle(x, y) ? G_ASHLAR : G_FLAG) : c === 'P' ? G_PORT
    : c === '"' ? G_LAWN : c === 'b' ? G_BRIDGE : c === 'j' ? G_JETTY : c === '~' ? G_WATER : c === '.' || c === 'D' ? G_GRASS : c === ',' || c === 'Y' ? G_DIRT : G_NONE;
  // a solid thing stands on the ground most of its four neighbours share
  const UNDER = '+"=.,bNO';
  const SOLID_GLYPHS = 'lsnpkiBdhtF*xSvwcAqVU';
  const GCODE = new Uint8Array(W * H), GVAR = new Uint8Array(W * H);
  for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) {
    const c = glyph(x, y), i = pi(x, y);
    GVAR[i] = Math.floor(hash(TD.ix(x), TD.iy(y)) * 3);
    if (SOLID_GLYPHS.includes(c)) {
      const n = {}; for (const [dx, dy] of N4) { const d = glyph(x + dx, y + dy); if (UNDER.includes(d)) n[d] = (n[d] || 0) + 1; }
      let best = null; for (const d of UNDER) if (n[d] && (!best || n[d] > n[best])) best = d;
      const code = best ? codeOf(best, x, y) : G_NONE;
      GCODE[i] = (code === G_STREET || code === G_FLAG || code === G_ASHLAR || code === G_LAWN) ? code : code === G_DIRT ? G_UDIRT : code === G_GRASS ? G_UGRASS : G_NONE;
    } else {
      const code = codeOf(c, x, y);
      GCODE[i] = (code === G_GRASS || code === G_DIRT) ? G_NONE : code;
    }
  }
  const gcode = (x, y) => inPlan(x, y) ? GCODE[pi(x, y)] : G_NONE;
  // the cells the chunks paint edge to edge in opaque stone, lawn, planks or the core's own grass and dirt (water only gets
  // its coping): while one is as the world made it, the core skips its texture there (09-render reads GROUND_COVER), so
  // the ground is not drawn twice. At any pixel ratio: the chunks are blitted on whole device pixels (snapPx), so they meet.
  const COVERS = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) COVERS[i] = GCODE[i] !== G_NONE && GCODE[i] !== G_WATER ? 1 : 0;
  window.GROUND_COVER = (x, y) => !window.__instance && snapped && x >= X0 && y >= Y0 && x < X0 + W && y < Y0 + H && COVERS[pi(x, y)] === 1 && tileAt(x, y) === base[pi(x, y)]
    && CHUNK_SS[Math.floor((y - Y0) / CH) * CW + Math.floor((x - X0) / CH)] > 0;
  const isStreet = (x, y) => { const k = gcode(x, y); return k === G_STREET || k === G_GATE || k === G_BRIDGE; };
  const isWaterG = (x, y) => glyph(x, y) === '~';
  // the patterns, 48 x 48 (cached at 2x)
  function patSetts(g, v) {
    const r = mulberry32(0x5e77 + v * 97);
    g.fillStyle = '#3e352e'; g.fillRect(0, 0, 48, 48);
    const cols = ['#6f6254', '#77695a', '#655a4e', '#7d7060', '#6a5d50'];
    for (let row = 0; row < 6; row++) {
      const off = ((row + v) % 2) ? 6 : 0, y = row * 8;
      for (let c = -1; c < 5; c++) {
        const x = c * 12 + off;
        g.fillStyle = cols[Math.floor(r() * cols.length)]; roundRect(g, x + 1, y + 1, 10.4, 6.4, 1.6); g.fill();
        g.fillStyle = 'rgba(255,236,205,0.16)'; g.fillRect(x + 2, y + 1.2, 8.4, 1.2);
        g.fillStyle = 'rgba(25,18,12,0.25)'; g.fillRect(x + 1.5, y + 6.1, 9.4, 1.2);
      }
    }
  }
  function patFlag(g, v) {
    const r = mulberry32(0xf1a6 + v * 131);
    g.fillStyle = '#a5977a'; g.fillRect(0, 0, 48, 48);
    const cols = ['#ddd2b9', '#d6caae', '#e2d8c0', '#d0c3a6'];
    const layout = v === 0 ? [[0, 0, 24, 24], [24, 0, 24, 24], [0, 24, 24, 24], [24, 24, 24, 24]] : v === 1 ? [[0, 0, 30, 20], [30, 0, 18, 20], [0, 20, 18, 28], [18, 20, 30, 28]] : [[0, 0, 20, 28], [20, 0, 28, 18], [20, 18, 28, 30], [0, 28, 20, 20]];
    for (const [x, y, w, h] of layout) {
      g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x + 1, y + 1, w - 2, h - 2);
      g.fillStyle = 'rgba(255,250,235,0.55)'; g.fillRect(x + 1, y + 1, w - 2, 1.2); g.fillRect(x + 1, y + 1, 1.2, h - 2);
      g.fillStyle = 'rgba(90,70,40,0.12)'; g.fillRect(x + 1, y + h - 2.2, w - 2, 1.2);
    }
    for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(110,90,60,${(0.08 + r() * 0.1).toFixed(3)})`; g.fillRect(r() * 46, r() * 46, 1.3, 1.3); }
  }
  function patAshlar(g, v) {
    g.fillStyle = '#9b9384'; g.fillRect(0, 0, 48, 48);
    const cols = ['#d3ccbd', '#cdc5b5', '#d8d1c3'];
    for (let r0 = 0; r0 < 3; r0++) for (let c = -1; c < 3; c++) {
      const off = (r0 + v) % 2 ? 12 : 0, x = c * 24 + off, y = r0 * 16;
      g.fillStyle = cols[(r0 + c + v + 3) % 3]; g.fillRect(x + 1, y + 1, 22, 14);
      g.fillStyle = 'rgba(255,255,250,0.45)'; g.fillRect(x + 1, y + 1, 22, 1.2);
    }
  }
  function patLawn(g, v, light) {
    const r = mulberry32(0x1a3 + v * 97 + (light ? 7 : 0));
    g.fillStyle = light ? '#86cc63' : '#78bf56'; g.fillRect(0, 0, 48, 48);
    // the mower's stripe: a little lighter down the middle of the light stripes
    g.fillStyle = light ? 'rgba(220,255,190,0.18)' : 'rgba(20,70,20,0.10)'; g.fillRect(8, 0, 32, 48);
    for (let i = 0; i < 26; i++) { const x = r() * 46, y = r() * 44; g.strokeStyle = r() < 0.5 ? 'rgba(45,110,35,0.35)' : 'rgba(205,250,170,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + (r() - 0.5) * 3, y); g.stroke(); }
    if (v === 2) for (let i = 0; i < 2; i++) { const x = 8 + r() * 32, y = 8 + r() * 32; g.fillStyle = '#ffffff'; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 1.7, y + Math.sin(a) * 1.7, 1, 0, 7); g.fill(); } g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(x, y, 0.9, 0, 7); g.fill(); }
  }
  function patPlank(g, dir, v) {
    g.fillStyle = '#3d2a1a'; g.fillRect(0, 0, 48, 48);
    const cols = ['#8a6238', '#7d5832', '#94693c', '#83603a'];
    for (let k = 0; k < 4; k++) {
      g.fillStyle = cols[(k + v) % 4];
      if (dir === 'ew') { g.fillRect(0, k * 12 + 1, 48, 10.2); g.fillStyle = 'rgba(255,230,190,0.22)'; g.fillRect(0, k * 12 + 1, 48, 1.4); g.fillStyle = 'rgba(30,18,8,0.4)'; g.fillRect(((k * 17 + v * 11) % 40) + 4, k * 12 + 1, 1.4, 10); }
      else { g.fillRect(k * 12 + 1, 0, 10.2, 48); g.fillStyle = 'rgba(255,230,190,0.22)'; g.fillRect(k * 12 + 1, 0, 1.4, 48); g.fillStyle = 'rgba(30,18,8,0.4)'; g.fillRect(k * 12 + 1, ((k * 17 + v * 11) % 40) + 4, 10, 1.4); }
    }
    g.fillStyle = '#2b1d12'; for (let k = 0; k < 4; k++) { if (dir === 'ew') { g.beginPath(); g.arc(4, k * 12 + 6, 1.2, 0, 7); g.arc(44, k * 12 + 6, 1.2, 0, 7); g.fill(); } else { g.beginPath(); g.arc(k * 12 + 6, 4, 1.2, 0, 7); g.arc(k * 12 + 6, 44, 1.2, 0, 7); g.fill(); } }
  }
  const pat = (key, fn) => sprite('g:' + key, 48, 48, 0, 0, fn);
  function groundSprite(code, x, y) {
    const v = GVAR[pi(x, y)];
    switch (code) {
      case G_STREET: case G_GATE: return pat('setts' + v, g => patSetts(g, v));
      case G_FLAG: return pat('flag' + v, g => patFlag(g, v));
      case G_ASHLAR: case G_PORT: return pat('ashlar' + v, g => patAshlar(g, v));
      case G_LAWN: { const light = TD.ix(x) % 2 === 0; /* old x: the stripes keep their phase when the town moves */ return pat('lawn' + v + (light ? 'l' : 'd'), g => patLawn(g, v, light)); }
      case G_BRIDGE: { const d = x >= TD.x(133) && x <= TD.x(134) && y >= TD.y(25) && y <= TD.y(28) ? 'ew' : 'ew'; return pat('plank' + d + v, g => patPlank(g, d, v)); }
      case G_JETTY: return pat('plankns' + v, g => patPlank(g, 'ns', v));
      case G_UDIRT: case G_UGRASS: { const c = typeof tex !== 'undefined' && tex[(code === G_UDIRT ? 'dirt' : 'grass') + v]; return c ? { c } : null; }
    }
    return null;
  }
  // one cell of the ground, with its trimmings: kerbs, lawn edges, coping, rails, the gate's shade
  function drawCell(g, x, y) {
    const code = GCODE[pi(x, y)]; if (!code) return;
    const px = x * TILE, py = y * TILE;
    if (code === G_WATER) { drawCoping(g, x, y, px, py); return; }
    const s = groundSprite(code, x, y); if (s) g.drawImage(s.c, px, py, TILE, TILE);
    if (code === G_STREET || code === G_GATE) {
      // a pale kerb wherever the street meets flagstones, lawn or a wall
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy; if (isStreet(nx, ny)) continue;
        const nc = glyph(nx, ny); if (nc === '#' || nc === 'T' || nc === '-' || nc === '~') continue;
        if (dy) { const ky = dy < 0 ? py : py + 43; g.fillStyle = '#e4dac4'; g.fillRect(px, ky, 48, 5); g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(px, dy < 0 ? ky + 5 : ky - 1, 48, 1.2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(px, ky, 48, 1); for (let k = 1; k < 4; k++) { g.fillStyle = 'rgba(120,100,70,0.35)'; g.fillRect(px + k * 12, ky, 1, 5); } }
        else { const kx = dx < 0 ? px : px + 43; g.fillStyle = '#e4dac4'; g.fillRect(kx, py, 5, 48); g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(dx < 0 ? kx + 5 : kx - 1, py, 1.2, 48); for (let k = 1; k < 4; k++) { g.fillStyle = 'rgba(120,100,70,0.35)'; g.fillRect(kx, py + k * 12, 5, 1); } }
      }
      // a drain grate in the gutter now and then
      if (glyph(x, y) === '=' && hash(TD.ix(x) * 3, TD.iy(y) * 7) < 0.06) { g.fillStyle = '#2a2622'; g.fillRect(px + 18, py + 20, 12, 8); g.fillStyle = '#4c443c'; for (let k = 0; k < 4; k++) g.fillRect(px + 19 + k * 3, py + 21, 1.4, 6); }
    }
    if (code === G_GATE) { const sh = g.createLinearGradient(px, 0, px + 48, 0); sh.addColorStop(0, 'rgba(20,16,12,0.35)'); sh.addColorStop(0.5, 'rgba(20,16,12,0.18)'); sh.addColorStop(1, 'rgba(20,16,12,0.35)'); g.fillStyle = sh; g.fillRect(px, py, 48, 48); }
    if (code === G_PORT) { g.fillStyle = 'rgba(20,16,12,0.3)'; g.fillRect(px, py, 48, 48); g.fillStyle = '#2a2622'; g.fillRect(px, py + 20, 48, 6); g.fillStyle = '#4c443c'; for (let k = 0; k < 8; k++) g.fillRect(px + 2 + k * 6, py + 21, 2, 4); }
    if (code === G_LAWN) {
      // a clipped edge where the lawn meets stone
      g.fillStyle = 'rgba(30,70,25,0.45)';
      for (const [dx, dy] of N4) { const k = gcode(x + dx, y + dy), c2 = glyph(x + dx, y + dy); if (k === G_LAWN || SOLID_GLYPHS.includes(c2) && GCODE[pi(x + dx, y + dy)] === G_LAWN) continue; if (dy) g.fillRect(px, dy < 0 ? py : py + 46, 48, 2); else g.fillRect(dx < 0 ? px : px + 46, py, 2, 48); }
    }
    if (code === G_BRIDGE || code === G_JETTY) drawRails(g, x, y, px, py, code);
  }
  // stone coping round the moat and the pond, on the water side of the edge
  function drawCoping(g, x, y, px, py) {
    const pond = x >= PLAN.POND.x0 && x <= PLAN.POND.x1 && y >= PLAN.POND.y0 && y <= PLAN.POND.y1;
    const top = pond ? '#a7a08a' : '#a9adb3', face = pond ? '#857e68' : '#7d8087';
    for (const [dx, dy] of N4) {
      const c = glyph(x + dx, y + dy); if (c === '~' || c === 'b' || c === 'j' || c === '-') continue;
      if (dy < 0) { g.fillStyle = top; g.fillRect(px, py, 48, 6); g.fillStyle = face; g.fillRect(px, py + 6, 48, 4); g.fillStyle = 'rgba(0,20,40,0.25)'; g.fillRect(px, py + 10, 48, 3); }
      else if (dy > 0) { g.fillStyle = top; g.fillRect(px, py + 42, 48, 6); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(px, py + 42, 48, 1); }
      else { const kx = dx < 0 ? px : px + 42; g.fillStyle = top; g.fillRect(kx, py, 6, 48); g.fillStyle = 'rgba(0,20,40,0.22)'; g.fillRect(dx < 0 ? kx + 6 : kx - 3, py, 3, 48); }
      if (pond) { g.fillStyle = 'rgba(80,130,60,0.45)'; for (let k = 0; k < 3; k++) { const h0 = hash(TD.ix(x) * 5 + k, TD.iy(y) * 3 + dx + dy * 2); if (dy) g.fillRect(px + h0 * 40, dy < 0 ? py + 2 : py + 43, 6, 3); else g.fillRect(dx < 0 ? px + 1 : px + 43, py + h0 * 40, 3, 6); } }
    }
  }
  // the rails of the footbridge, the iron bands of the drawbridge, the jetty's posts
  function drawRails(g, x, y, px, py, code) {
    if (code === G_JETTY) { g.fillStyle = '#4a3420'; for (const [ox, oy] of [[3, 3], [41, 3], [3, 41], [41, 41]]) g.fillRect(px + ox, py + oy, 5, 5); return; }
    if (x >= TD.x(111) && x <= TD.x(112) && y === TD.y(41)) {
      // the drawbridge: oak, with two iron bands across and the hinge pins at the castle end
      g.fillStyle = '#3a3f4a'; g.fillRect(px, py + 10, 48, 4); g.fillRect(px, py + 34, 48, 4);
      g.fillStyle = '#6b707a'; for (const yy of [11, 35]) for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(px + 6 + k * 12, py + yy + 1, 1.3, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x === TD.x(111) ? px : px + 45, py, 3, 48);
      return;
    }
    // the footbridge over Swan Pond: rails on its east and west edges, lighter at the top of the arch
    const mid = y === TD.y(26) || y === TD.y(27);
    if (mid) { g.fillStyle = 'rgba(255,240,210,0.12)'; g.fillRect(px, py, 48, 48); }
    const side = x === PLAN.POND.bridge[0] ? -1 : 1, rx = side < 0 ? px + 1 : px + 41;
    g.fillStyle = '#5a3c22'; g.fillRect(rx, py, 6, 48); g.fillStyle = '#7a5530'; g.fillRect(rx + 1, py, 4, 48);
    g.fillStyle = 'rgba(255,230,190,0.3)'; g.fillRect(rx + 1, py, 1.2, 48);
    g.fillStyle = '#3d2a1a'; g.fillRect(rx - 1, py + 20, 8, 8);
  }
  // the chunks: 8 x 8 cells, painted at the screen's pixel ratio, the least recently used dropped past chunkMax
  const CH = 8, CW = Math.ceil(W / CH), CHH = Math.ceil(H / CH);
  let chunkMax = 20, chunkUse = 0;
  // CHUNK_SS[chunk]: the pixel ratio a chunk was last painted at, 0 while it has no painted picture (not made yet, dropped,
  // or its canvas gave no context, as an iPad short of canvas memory can). GROUND_COVER lets the core skip its own texture
  // only under a chunk that really holds a picture, so a chunk that could not be painted shows the core's ground, never
  // the black behind the map.
  const CHUNK_SS = new Float32Array(CW * CHH);
  const chunkKeyCell = k => { const m = /^(\d+),(\d+)@/.exec(k); return m ? +m[2] * CW + +m[1] : -1; };
  function dropChunk(k, o) { CHUNKS.delete(k); const i = chunkKeyCell(k); if (i >= 0) CHUNK_SS[i] = 0; try { o.c.width = 0; o.c.height = 0; } catch (e) { } }
  function chunkHash(cx, cy) { let s = 7; for (let y = Y0 + cy * CH; y < Math.min(Y0 + H, Y0 + cy * CH + CH); y++) for (let x = X0 + cx * CH; x < Math.min(X0 + W, X0 + cx * CH + CH); x++) s = (Math.imul(s, 31) + tileAt(x, y)) | 0; return s; }
  function paintChunk(ch, cx, cy, ss) {
    const c = ch.c, cg = c.getContext ? c.getContext('2d') : null;
    CHUNK_SS[cy * CW + cx] = 0;
    if (!cg) return;
    try {
      cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, c.width, c.height);
      cg.scale(ss, ss); cg.translate(-(X0 + cx * CH) * TILE, -(Y0 + cy * CH) * TILE);
      for (let y = Y0 + cy * CH; y < Math.min(Y0 + H, Y0 + cy * CH + CH); y++) for (let x = X0 + cx * CH; x < Math.min(X0 + W, X0 + cx * CH + CH); x++) if (pristineAt(x, y)) drawCell(cg, x, y);
      CHUNK_SS[cy * CW + cx] = ss;
    } catch (e) { }
    STATS.painted++;
  }
  // The pictures are made at the screen's real pixel ratio (1 to 2), not a rounded one: at 125% or 150% (most Windows
  // laptops, or a zoomed browser) a picture made at 1x or 2x was rescaled on every blit, soft, and about twice the frame.
  const picScale = () => Math.round(Math.max(1, Math.min(2, typeof DPR === 'number' && DPR > 0 ? DPR : 1)) * 100) / 100;
  // where a chunk edge lands on the screen, snapped to a whole device pixel, so neighbouring chunks meet with no seam at any
  // pixel ratio (09-render draws the world at scale DPR, offset by the rounded camera)
  const snapPx = (v, o) => Math.round((v - o) * DPR) / DPR + o;
  function groundChunk(cx, cy) {
    const ss = picScale(), key = cx + ',' + cy + '@' + ss;
    let ch = CHUNKS.get(key);
    const hsh = chunkHash(cx, cy);
    if (!ch) {
      const c = document.createElement('canvas'); c.width = Math.ceil(CH * TILE * ss); c.height = Math.ceil(CH * TILE * ss);
      ch = { c, used: 0, hash: hsh }; CHUNKS.set(key, ch); paintChunk(ch, cx, cy, ss);
      if (CHUNKS.size > chunkMax) {
        const old = [...CHUNKS.entries()].filter(([k]) => k !== key).sort((a, b) => a[1].used - b[1].used).slice(0, CHUNKS.size - chunkMax);
        for (const [k, o] of old) dropChunk(k, o);
      }
    } else if (ch.hash !== hsh) { ch.hash = hsh; paintChunk(ch, cx, cy, ss); STATS.repaints++; }
    ch.used = ++chunkUse;
    return ch;
  }
  // A knight away from the city (inside an instance, or 40 tiles past its walls) for 10 s gives its pictures back: the
  // ground chunks (up to 47 MB of canvas at a pixel ratio of 2) and the buildings' cached pictures. Nothing kept them while
  // he was in Aerie or the far east, on top of the Cloud Kingdom's own, under Safari's total canvas memory on an iPad.
  // They are made again, a few a frame, when he comes back.
  const FREE = { t: 0, freed: 0 };
  function freePictures() {
    for (const [k, o] of [...CHUNKS]) dropChunk(k, o);
    for (const p of PICS.values()) { try { p.c.width = 0; p.c.height = 0; } catch (e) { } }
    PICS.clear(); FREE.freed++;
  }
  HOOKS.update.push(dt => {
    const far = !!window.__instance || player.x < (X0 - 40) * TILE || player.x > (X0 + W + 40) * TILE || player.y < (Y0 - 40) * TILE || player.y > (Y0 + H + 40) * TILE;
    if (!far) { FREE.t = 0; return; }
    FREE.t += dt;
    if (FREE.t >= 10 && (CHUNKS.size || PICS.size)) freePictures();
  });
  // the town's door steps and the things lying on its paving: the chunks cover the core's, so they are drawn again on top
  const STEP_LIST = () => BUILDINGS.filter(b => inTown(b.x, b.y)).map(b => { const [sx, sy] = stepOf(b); return { sx, sy, up: b.door === undefined, coffin: !!b.coffin }; });
  function drawGround(g, c) {
    const cx0 = Math.max(0, Math.floor((c.x / TILE - X0) / CH)), cx1 = Math.min(CW - 1, Math.floor(((c.x + VW) / TILE - X0) / CH));
    const cy0 = Math.max(0, Math.floor((c.y / TILE - Y0) / CH)), cy1 = Math.min(CHH - 1, Math.floor(((c.y + VH) / TILE - Y0) / CH));
    if (cx1 < cx0 || cy1 < cy0) return;
    // room for every chunk in view and a few more; a view of more than 40 (a 4K screen at 100%, a browser zoomed far out)
    // may keep all 48 of the plan, or it would drop and repaint every chunk in view on every frame
    chunkMax = Math.min(CW * CHH, Math.max(chunkMax, (cx1 - cx0 + 1) * (cy1 - cy0 + 1) + 4));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const ch = groundChunk(cx, cy); if (!ch.c.width) continue;
      const ox = Math.round(c.x), oy = Math.round(c.y), wx = (X0 + cx * CH) * TILE, wy = (Y0 + cy * CH) * TILE;
      const sx = snapPx(wx, ox), sy = snapPx(wy, oy), sw = snapPx(wx + CH * TILE, ox) - sx, sh = snapPx(wy + CH * TILE, oy) - sy;
      g.drawImage(ch.c, sx, sy, sw, sh); STATS.chunks++;
    }
    for (const s of STEP_LIST()) if (gcode(s.sx, s.sy) && pristineAt(s.sx, s.sy) && vis(c, s.sx * TILE - 40, s.sy * TILE - 40, s.sx * TILE + 88, s.sy * TILE + 88)) drawDoorstep(g, s.sx, s.sy, s.up, s.coffin);
    for (const d of drops) { const tx = Math.floor(d.x / TILE), ty = Math.floor(d.y / TILE); if (gcode(tx, ty) && pristineAt(tx, ty) && vis(c, d.x - 30, d.y - 30, d.x + 30, d.y + 30)) drawDrop(g, d); }
  }

  // ---------- the curtain wall ----------
  // what side of the town a wall cell is on: N and S runs show a face, W and E runs are seen from above
  const wallSide = (x, y) => y === TOWN.y0 ? 'N' : y === TOWN.y1 ? 'S' : x === TOWN.x0 ? 'W' : x === TOWN.x1 ? 'E' : null;
  // a torch on every sixth plain wall cell of each run
  const TORCHES = new Set();
  { const runs = { N: [], S: [], W: [], E: [] };
    for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) { const s = wallSide(x, y); if (s && glyph(x, y) === '#') runs[s].push([x, y]); }
    for (const s in runs) runs[s].forEach(([x, y], i) => { if (i % 6 === 3) TORCHES.add(x + ',' + y); }); }
  function paintWallH(g, side, v) {
    // the walkway on top, the face below it (the town side for the north wall, the field side for the south)
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 46, 48, 6);
    g.fillStyle = STONE[0]; g.fillRect(0, 14, 48, 34);
    for (let r = 0; r < 3; r++) { const yy = 15 + r * 11, off = (r + v) % 2 ? 12 : 0; for (let c = -1; c < 3; c++) { g.fillStyle = ['#7d8087', '#767980', '#83868d'][(r + c + 3) % 3]; g.fillRect(off + c * 24 + 1, yy, 22, 10); } }
    const sh = g.createLinearGradient(0, 14, 0, 48); sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(0,0,0,0.18)'); g.fillStyle = sh; g.fillRect(0, 14, 48, 34);
    g.fillStyle = STONE[2]; g.fillRect(0, 2, 48, 12);
    g.fillStyle = '#b4b9c0'; g.fillRect(0, 2, 48, 3);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 13, 48, 1.5);
    // merlons on the outer edge: the far edge of the north wall, the near edge of the south wall
    for (let k = 0; k < 4; k += 2) {
      const mx = k * 12 + (v ? 12 : 0);
      if (side === 'N') { g.fillStyle = '#8b8f96'; g.fillRect(mx, -10, 12, 13); g.fillStyle = '#a9aeb5'; g.fillRect(mx, -10, 12, 3); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(mx + 9, -7, 3, 10); }
      else { g.fillStyle = '#8b8f96'; g.fillRect(mx, 2, 12, 14); g.fillStyle = '#b4b9c0'; g.fillRect(mx, 2, 12, 3); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(mx + 9, 5, 3, 11); }
    }
  }
  function paintWallV(g, side) {
    const outer = side === 'W' ? 0 : 40, inner = side === 'W' ? 40 : 0;
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(side === 'W' ? 44 : -4, 0, 8, 48);
    g.fillStyle = STONE[0]; g.fillRect(0, 0, 48, 48);
    g.fillStyle = STONE[2]; g.fillRect(8, 0, 32, 48);
    g.fillStyle = 'rgba(70,70,75,0.35)'; for (let r = 0; r < 4; r++) g.fillRect(8, r * 12 + 11, 32, 1);
    g.fillStyle = '#b4b9c0'; g.fillRect(inner + (side === 'W' ? 0 : 6), 0, 2, 48);
    for (let k = 0; k < 4; k += 2) { const my = k * 12; g.fillStyle = '#8b8f96'; g.fillRect(outer, my, 8, 12); g.fillStyle = '#a9aeb5'; g.fillRect(outer, my, 8, 2.5); }
    g.fillStyle = '#5f6268'; g.fillRect(outer, 12, 8, 12); g.fillRect(outer, 36, 8, 12);
  }
  // a torch on an iron bracket: lit from dusk (the gatehouse's two burn day and night: always); its glow is one sprite
  const paintTorchGlow = cg => { const gl = cg.createRadialGradient(0, 0, 1, 0, 0, 20); gl.addColorStop(0, 'rgba(255,190,90,0.45)'); gl.addColorStop(1, 'rgba(255,170,60,0)'); cg.fillStyle = gl; cg.beginPath(); cg.arc(0, 0, 20, 0, 7); cg.fill(); };
  function drawTorch(g, x, y, always) {
    g.fillStyle = '#2a2a30'; g.fillRect(x - 1.5, y - 2, 3, 12); g.fillRect(x - 5, y + 2, 10, 2.5);
    g.fillStyle = '#5a3a1e'; g.fillRect(x - 2, y - 10, 4, 9);
    if (always || lit()) {
      const f = 0.8 + Math.sin(time * 9 + x) * 0.2;
      if (lit()) { const a0 = g.globalAlpha; g.globalAlpha = a0 * f; blit(g, sprite('torchglow', 40, 40, 20, 20, paintTorchGlow), x, y - 14); g.globalAlpha = a0; }
      g.fillStyle = '#ff8a1a'; g.beginPath(); g.moveTo(x - 4, y - 10); g.quadraticCurveTo(x - 4, y - 18 - f * 3, x, y - 22 - f * 3); g.quadraticCurveTo(x + 4, y - 18 - f * 3, x + 4, y - 10); g.closePath(); g.fill();
      g.fillStyle = '#ffe066'; g.beginPath(); g.ellipse(x, y - 13, 1.8, 3.5, 0, 0, 7); g.fill();
    }
  }
  function drawWallCell(g, x, y) {
    const side = wallSide(x, y); if (!side) return;
    const px = x * TILE, py = y * TILE;
    if (side === 'N' || side === 'S') blit(g, sprite('wallH' + side + (x % 2), 48, 64, 0, 12, cg => paintWallH(cg, side, x % 2)), px, py);
    else blit(g, sprite('wallV' + side, 56, 48, side === 'E' ? 8 : 0, 0, cg => paintWallV(cg, side)), px, py);
    if (TORCHES.has(x + ',' + y)) {
      if (side === 'N') drawTorch(g, px + 24, py + 28);
      else if (side === 'S') drawTorch(g, px + 24, py + 10);
      else drawTorch(g, side === 'W' ? px + 40 : px + 8, py + 26);
    }
  }

  // ---------- the towers ----------
  // a round tower centred (cx, cy), radius R: its body from the base up to the rim, a merlon ring, a slate cone to the apex
  function paintRoundTower(g, R, base, rim, apex, slit) {
    const ry = R * 0.34;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(6, base + 4, R + 8, ry + 4, 0, 0, 7); g.fill();
    const body = g.createLinearGradient(-R, 0, R, 0);
    body.addColorStop(0, '#55585e'); body.addColorStop(0.32, '#9aa0a8'); body.addColorStop(0.7, '#7d8087'); body.addColorStop(1, '#4f535a');
    g.fillStyle = body; g.beginPath(); g.moveTo(-R, rim); g.lineTo(-R, base); g.ellipse(0, base, R, ry, 0, Math.PI, 0, true); g.lineTo(R, rim); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,40,45,0.35)'; g.lineWidth = 1;
    for (let yy = base - 10; yy > rim + 6; yy -= 10) { g.beginPath(); g.ellipse(0, yy, R, ry, 0, 0.05, Math.PI - 0.05); g.stroke(); }
    for (let yy = base - 5, r = 0; yy > rim + 6; yy -= 10, r++) for (let k = 0; k < 5; k++) { const a = (k + (r % 2) * 0.5) / 5 * Math.PI + 0.15; if (a > Math.PI - 0.1) continue; const sx = Math.cos(a) * R; g.beginPath(); g.moveTo(sx, yy + Math.sin(a) * ry - 5); g.lineTo(sx, yy + Math.sin(a) * ry + 5); g.stroke(); }
    if (slit) { g.fillStyle = '#23262c'; roundRect(g, -2.5, (base + rim) / 2 - 8, 5, 16, 2); g.fill(); g.fillRect(-5, (base + rim) / 2 - 1.5, 10, 3); }
    // the rim and its merlons
    g.fillStyle = '#9aa0a8'; g.beginPath(); g.ellipse(0, rim, R + 3, ry + 2, 0, 0, 7); g.fill();
    g.fillStyle = '#6e7178'; g.beginPath(); g.ellipse(0, rim, R - 4, ry - 2, 0, 0, 7); g.fill();
    for (let k = 0; k < 8; k++) { const a = Math.PI * (0.06 + k * 0.125), mx = Math.cos(a) * (R + 1), my = rim + Math.sin(a) * (ry + 1); g.fillStyle = '#8b8f96'; g.fillRect(mx - 4, my - 9, 8, 9); g.fillStyle = '#b4b9c0'; g.fillRect(mx - 4, my - 9, 8, 2); }
    // the slate cone and a gold finial
    const cone = g.createLinearGradient(-R, 0, R, 0); cone.addColorStop(0, '#2c3038'); cone.addColorStop(0.35, '#5d6370'); cone.addColorStop(0.7, '#4a4f5a'); cone.addColorStop(1, '#262a31');
    g.fillStyle = cone; g.beginPath(); g.moveTo(-R + 4, rim - 3); g.lineTo(0, apex); g.lineTo(R - 4, rim - 3); g.ellipse(0, rim - 3, R - 4, ry - 3, 0, 0, Math.PI); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { const f = k / 4; g.beginPath(); g.ellipse(0, rim - 3 - (rim - 3 - apex) * f, (R - 4) * (1 - f), (ry - 3) * (1 - f), 0, 0.15, Math.PI - 0.15); g.stroke(); }
    g.fillStyle = GOLD_D; g.beginPath(); g.ellipse(0, rim - 3, R - 3, ry - 2.5, 0, 0, Math.PI); g.lineTo(-R + 3, rim - 1); g.ellipse(0, rim - 1, R - 3, ry - 2.5, 0, Math.PI, 0, true); g.closePath(); g.fill();
    g.fillStyle = GOLD; g.beginPath(); g.arc(0, apex - 3, 3.5, 0, 7); g.fill(); g.fillRect(-1, apex - 13, 2, 10);
  }
  // the gate towers are clearly bigger than the wall's: radius 42, tall slate cones, long banners
  const TOWER_DEF = { wall: { R: 30, base: 30, rim: -14, apex: -64 }, gate: { R: 42, base: 52, rim: -14, apex: -106 } };
  const TOWERS = PLAN.TOWERS.map((t, i) => Object.assign({}, t, { i, gate: t.h === 3, cx: (t.x + 1) * TILE, cy: (t.y + t.h / 2) * TILE }));
  function drawTownTower(g, t) {
    const d = t.gate ? TOWER_DEF.gate : TOWER_DEF.wall, sortY = (t.y + t.h) * TILE - 2;
    const s = sprite(t.gate ? 'tower-gate2' : 'tower-wall', 2 * d.R + 30, d.base - d.apex + 40, d.R + 12, -d.apex + 16, cg => paintRoundTower(cg, d.R, d.base, d.rim, d.apex, true));
    const a = behindAlpha(t.cx - d.R, t.cy + d.apex - 20, t.cx + d.R, t.cy + d.base, sortY);
    if (a < 1) { g.save(); g.globalAlpha = a; }
    blit(g, s, t.cx, t.cy);
    if (t.gate) { hangBanner(g, t.cx, t.cy - 8, 60, 26, t.i); pennant(g, t.cx + 1, t.cy + d.apex - 12, 30); }
    else if (t.i % 2 === 0) pennant(g, t.cx + 1, t.cy + d.apex - 12, 24);
    if (a < 1) g.restore();
    STATS.towers++;
  }
  // THE GATEHOUSE over each town gate: a raised block of stone between the two gate towers, stepping out 16 px past both
  // faces of the wall, battlements round its roof, the Duke's arms on a carved boss and THISTLEDOWN on its lintel stone.
  // The passage runs under it in deep shade; at its outer face the portcullis is drawn up, its iron teeth hanging over the
  // dark mouth of the passage, and a torch burns either side, day and night. The road is never covered for good: the
  // whole gatehouse is faint (25%) while the knight is in the passage or within a tile of it.
  // RAISE: how far the roof stands over its footprint; the block's top (merlons) stays under row 30's top edge + 8, clear
  // of the house by the west gate (h2, whose wall ends at y 30 x 48).
  const GH = { half: 64, raise: 24, merlon: 10 };
  const gateBox = gate => {
    const cx = (gate.dir > 0 ? gate.x + 1 : gate.x) * TILE, x0 = cx - GH.half, x1 = cx + GH.half;
    const foot0 = TD.y(31) * TILE - 6, foot1 = TD.y(34) * TILE + 6, top = foot0 - GH.raise, bot = foot1 - GH.raise;
    return { cx, x0, x1, foot0, foot1, top, bot, outer: gate.dir > 0 ? x0 : x1, out: gate.dir > 0 ? -1 : 1 };
  };
  const nearGate = gate => { const b = gateBox(gate), pty = Math.floor(player.y / TILE); return player.x > b.x0 - TILE && player.x < b.x1 + TILE && pty >= TD.y(30) && pty <= TD.y(34); };
  // anybody under the roof: a friend online (where we draw her), a villager, a guard, a goblin. The roof sorts at row 34's
  // top edge, so a figure whose middle is over the roof's span and whose feet are between the merlons' top and row 34 is
  // drawn under it; while one is there the roof is faint, the same as for the knight himself
  const underRoof = (b, x, y) => x > b.x0 - 6 && x < b.x1 + 6 && y > b.top - GH.merlon && y < TD.y(34) * TILE + 4;
  function gateBusy(gate) {
    const b = gateBox(gate);
    if (nearGate(gate)) return 'knight';
    if (window.PLAYERS && PLAYERS.remote && typeof PLAYERS.mapId === 'function') {
      const my = PLAYERS.mapId();
      for (const n in PLAYERS.remote) { const e = PLAYERS.remote[n], p = e && (e.shown || e); if (e && e.map === my && p && underRoof(b, p.x, p.y)) return 'friend'; }
    }
    for (const n of NPCS) if (underRoof(b, n.px, n.py)) return 'person';
    for (const m of monsters) if (!m.dead && underRoof(b, m.x, m.y)) return 'monster';
    return null;
  }
  // the roof, cached once per side: walkway flags, battlements, the boss with the arms, the lintel with the name
  function paintGateRoof(g, w, h, out) {
    // local origin: the roof's top-left; the front face hangs GH.raise below it. The roof is the vault over the passage:
    // at each end an archway is cut into it (a half-ellipse, AW deep), and through it the road is seen going into the
    // shade of the passage; the outer archway carries the portcullis's iron teeth, drawn up
    const AW = 24, cy = h / 2, ry = h / 2 - 14;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(6, 8, w, h + GH.raise);
    // the front (south) face: coursed stone under a string course
    stoneWall(g, 0, h, w, GH.raise); g.fillStyle = '#5f6268'; g.fillRect(0, h, w, 3);
    // the roof: a parapet all round a walk of flags
    g.fillStyle = '#7d8087'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#a7acb3'; g.fillRect(10, 10, w - 20, h - 20);
    for (let r = 0; r * 16 < h - 20; r++) for (let c = 0; c * 24 < w - 20; c++) { g.fillStyle = ['#b4b9c0', '#aeb3ba', '#babfc6'][(r + c) % 3]; g.fillRect(11 + c * 24, 11 + r * 16, Math.min(22, w - 21 - c * 24), Math.min(14, h - 21 - r * 16)); }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(10, 10, w - 20, 3);
    // the battlements on the north and south edges, and on the end walls beyond the archways
    const merlon = (x, y, mw, mh) => { g.fillStyle = '#8b8f96'; g.fillRect(x, y, mw, mh); g.fillStyle = '#c3c7cc'; g.fillRect(x, y, mw, 2.5); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + mw - 2, y + 2.5, 2, mh - 2.5); };
    for (let x = 0; x < w; x += 20) { merlon(x, -GH.merlon, 12, GH.merlon + 6); merlon(x, h - 10, 12, 10); }
    // the carved boss with the Duke's arms in the middle of the roof
    const by = cy + 14;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(w / 2 + 3, by + 3, 25, 0, 7); g.fill();
    g.fillStyle = '#8b8f96'; g.beginPath(); g.arc(w / 2, by, 25, 0, 7); g.fill(); g.fillStyle = '#c3c7cc'; g.beginPath(); g.arc(w / 2, by, 21, 0, 7); g.fill();
    g.strokeStyle = GOLD_D; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, by, 21, 0, 7); g.stroke();
    arms(g, w / 2, by + 1, 30);
    // the two archways, cut out of the roof
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (const ex of [0, w]) { g.beginPath(); g.ellipse(ex, cy, AW, ry, 0, 0, 7); g.fill(); }
    g.restore();
    // their arches: a ring of pale voussoirs with a keystone; the outer one has the portcullis teeth hanging in it
    for (const [ex, side] of [[0, 1], [w, -1]]) {
      const a0 = side > 0 ? -Math.PI / 2 : Math.PI / 2, a1 = side > 0 ? Math.PI / 2 : Math.PI * 1.5;
      g.strokeStyle = '#5f6268'; g.lineWidth = 12; g.beginPath(); g.ellipse(ex, cy, AW + 5, ry + 5, 0, a0, a1); g.stroke();
      g.strokeStyle = '#c3c7cc'; g.lineWidth = 8; g.beginPath(); g.ellipse(ex, cy, AW + 5, ry + 5, 0, a0, a1); g.stroke();
      g.strokeStyle = 'rgba(60,60,65,0.55)'; g.lineWidth = 1;
      for (let k = 1; k < 12; k++) { const a = a0 + (a1 - a0) * k / 12; g.beginPath(); g.moveTo(ex + Math.cos(a) * (AW + 1), cy + Math.sin(a) * (ry + 1)); g.lineTo(ex + Math.cos(a) * (AW + 9), cy + Math.sin(a) * (ry + 9)); g.stroke(); }
      // the keystone
      const kx = ex + side * (AW + 5);
      g.fillStyle = '#d6d9dd'; g.beginPath(); g.moveTo(kx - side * 6, cy - 9); g.lineTo(kx + side * 7, cy - 12); g.lineTo(kx + side * 7, cy + 12); g.lineTo(kx - side * 6, cy + 9); g.closePath(); g.fill();
      g.strokeStyle = GOLD_D; g.lineWidth = 1.2; g.stroke();
      if (side === out) continue;
      // the outer arch: the portcullis drawn up, its iron teeth hanging into the archway
      for (let k = 0; k < 13; k++) {
        const a = a0 + (a1 - a0) * (k + 0.5) / 13, px = ex + Math.cos(a) * AW, py = cy + Math.sin(a) * ry, ix = ex + Math.cos(a) * (AW - 11), iy = cy + Math.sin(a) * (ry - 11);
        const nx = -Math.sin(a) * 3.5, ny = Math.cos(a) * 3.5;
        g.fillStyle = '#2a2d33'; g.beginPath(); g.moveTo(px + nx, py + ny); g.lineTo(ix, iy); g.lineTo(px - nx, py - ny); g.closePath(); g.fill();
      }
      g.strokeStyle = '#2a2d33'; g.lineWidth = 3; g.beginPath(); g.ellipse(ex, cy, AW, ry, 0, a0, a1); g.stroke();
    }
    // the lintel stone with the city's name, across the roof over the outer archway's crown
    const lw = w - 2 * AW - 12, lx = AW + 6, ly = 16;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(lx + 2, ly + 2, lw, 17);
    g.fillStyle = '#3a3f4a'; g.fillRect(lx, ly, lw, 17); g.strokeStyle = GOLD_D; g.lineWidth = 1.5; g.strokeRect(lx + 0.5, ly + 0.5, lw - 1, 16);
    g.fillStyle = GOLD; g.font = `800 9px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('THISTLEDOWN', w / 2, ly + 9); g.textBaseline = 'alphabetic';
  }
  function drawGatehouse(g, gate) {
    const b = gateBox(gate), w = b.x1 - b.x0, h = b.bot - b.top;
    // the passage under the block, in deep shade (drawn at full strength: the road can be seen running into it)
    const sh = g.createLinearGradient(b.x0 - 18, 0, b.x1 + 18, 0);
    sh.addColorStop(0, 'rgba(12,10,8,0)'); sh.addColorStop(0.14, 'rgba(12,10,8,0.55)'); sh.addColorStop(0.5, 'rgba(12,10,8,0.7)'); sh.addColorStop(0.86, 'rgba(12,10,8,0.55)'); sh.addColorStop(1, 'rgba(12,10,8,0)');
    g.fillStyle = sh; g.fillRect(b.x0 - 18, TD.y(31) * TILE, w + 36, 3 * TILE);
    const who = gateBusy(gate), a = who ? 0.25 : 1;
    STATS.gateAlpha[gate.x] = a; STATS.gateWho[gate.x] = who;
    g.save(); g.globalAlpha = a;
    blit(g, sprite('gatehouse3' + b.out, w + 12, h + GH.raise + GH.merlon + 12, 0, GH.merlon, cg => paintGateRoof(cg, w, h, b.out)), b.x0, b.top);
    // a torch either side of the outer archway, always burning
    for (const ty of [b.top + 14, b.bot - 2]) drawTorch(g, b.outer + b.out * 5, ty, true);
    g.restore();
  }

  // ---------- lamps ----------
  // the post is one tile and the lantern sits up to 40 px over the tile; a lamp right under a building keeps its lantern
  // below that building's wall (no art over another building)
  const LAMP_TOP = {};
  for (const [x, y] of LAMPS) { let top = y * TILE - 40; for (const b of BUILDINGS) { const bx0 = b.x * TILE, bx1 = (b.x + b.w) * TILE, by1 = (b.y + b.h) * TILE; if (x * TILE + 34 > bx0 && x * TILE + 14 < bx1 && by1 <= y * TILE + 1 && by1 > top) top = by1; } LAMP_TOP[x + ',' + y] = top; }
  function paintLamp(g, H0) {
    // local origin: the foot of the post (the tile's bottom, 6 px up); the finial on the lantern's cap is H0 + 3 px above it
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(4, 0, 11, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#1f2126'; g.fillRect(-6, -7, 12, 7); g.fillStyle = '#34373e'; g.fillRect(-4, -10, 8, 4);
    g.fillStyle = '#1f2126'; g.fillRect(-2, -H0 + 26, 4, H0 - 34); g.fillStyle = '#3d4048'; g.fillRect(-2, -H0 + 26, 1.4, H0 - 34);
    g.fillStyle = '#1f2126'; g.fillRect(-7, -H0 + 24, 14, 3);
    // the lantern: an iron cage with glass sides and a cap
    g.fillStyle = '#1f2126'; g.beginPath(); g.moveTo(-8, -H0 + 24); g.lineTo(-10, -H0 + 8); g.lineTo(10, -H0 + 8); g.lineTo(8, -H0 + 24); g.closePath(); g.fill();
    g.fillStyle = '#c9a14a'; g.beginPath(); g.moveTo(-11, -H0 + 8); g.lineTo(0, -H0); g.lineTo(11, -H0 + 8); g.closePath(); g.fill();
    g.fillStyle = '#1f2126'; g.beginPath(); g.arc(0, -H0 - 1, 2.4, 0, 7); g.fill();
  }
  const lampH = (tx, ty) => (ty + 1) * TILE - 6 - LAMP_TOP[tx + ',' + ty] - 4;
  function drawLamp(g, tx, ty) {
    const cx = tc(tx), foot = (ty + 1) * TILE - 6, H0 = lampH(tx, ty), lit0 = lit();
    blit(g, sprite('lamp' + H0, 32, H0 + 14, 16, H0 + 6, cg => paintLamp(cg, H0)), cx, foot);
    // the glass: dark by day, a warm flame from dusk (the glow over everything is LAMP_GLOW at 9e8)
    const gy = foot - H0 + 10;
    if (lit0) { const f = 0.85 + Math.sin(time * 6 + tx * 1.7) * 0.1; g.fillStyle = `rgba(255,214,120,${f.toFixed(3)})`; g.fillRect(cx - 7, gy, 14, 13); g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(cx, gy + 7, 2.4, 4, 0, 0, 7); g.fill(); STATS.lampsLit++; }
    else { g.fillStyle = 'rgba(70,82,96,0.85)'; g.fillRect(cx - 7, gy, 14, 13); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx - 5, gy + 1, 2, 10); }
    g.strokeStyle = '#1f2126'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, gy); g.lineTo(cx, gy + 13); g.stroke();
  }
  // the warm glow round a lit lantern: one sprite painted once, drawn with the lamp's flicker as its alpha (no gradient is
  // made per lamp per frame)
  const paintLampGlow = cg => { const gl = cg.createRadialGradient(0, 0, 2, 0, 0, 46); gl.addColorStop(0, 'rgba(255,220,140,0.55)'); gl.addColorStop(0.35, 'rgba(255,205,120,0.25)'); gl.addColorStop(1, 'rgba(255,200,110,0)'); cg.fillStyle = gl; cg.beginPath(); cg.arc(0, 0, 46, 0, 7); cg.fill(); };
  function lampGlow(g, tx, ty) {
    const cx = tc(tx), foot = (ty + 1) * TILE - 6, cy = foot - lampH(tx, ty) + 16;
    const f = 0.85 + Math.sin(time * 5 + tx * 1.3) * 0.08, a0 = g.globalAlpha;
    g.globalAlpha = a0 * f; blit(g, sprite('lampglow', 92, 92, 46, 46, paintLampGlow), cx, cy); g.globalAlpha = a0;
  }

  // ---------- statues and the waiting plinth ----------
  const STONE_LOOK = (o) => Object.assign({ tunic: '#c9c3b6', hair: '#b7b0a2', skin: '#d6d0c3', shoulder: '#bdb6a8' }, o);
  const STATUE_LOOK = {
    // the Last Knight of Hollowford: with 82-knightgear a knight look in stone (an iron helm, kite shield and sword, as
    // the old statue held), so he is drawn as every knight in the game is
    last_knight: STONE_LOOK({ helm: '#cfc9bc', shield: '#bfb8a9', weapon: { shape: 'sword', color: '#d8d2c6' }, gear: { helm: 'iron_helm', body: null, legs: null, shield: 'iron_shield', cape: null, weapon: 'iron_sword' }, stone: true }),
    thrain: STONE_LOOK({ who: 'thrain', stone: true, beard: true, crown: true, tool: 'hammer', toolColor: '#cfc9bc' }),
    aelith: STONE_LOOK({ who: 'aelith', stone: true, woman: true, crown: true, weapon: { shape: 'bow', color: '#cfc9bc' } }),
    seraphel: STONE_LOOK({ who: 'seraphel', stone: true, woman: true, crown: true, wing: 1.35 }),
  };
  function stoneWings(g) {
    for (const s of [-1, 1]) { g.save(); g.scale(s, 1); g.fillStyle = '#d4cec1'; g.strokeStyle = 'rgba(110,100,85,0.6)'; g.lineWidth = 0.8;
      for (let f = 0; f < 4; f++) { const a = -0.35 - f * 0.3, L = 20 - f * 3; g.beginPath(); g.moveTo(8, -2); g.quadraticCurveTo(8 + Math.cos(a) * L * 0.55, -2 + Math.sin(a) * L * 0.55 - 4, 8 + Math.cos(a) * L, -2 + Math.sin(a) * L); g.quadraticCurveTo(10 + Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.5 + 2, 8, 2); g.closePath(); g.fill(); g.stroke(); }
      g.restore(); }
  }
  // a plinth of pale stone with a bronze plaque; local origin is the foot (the tile's bottom)
  function paintPlinth(g, laurel) {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(4, -1, 21, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#8f8a80'; g.fillRect(-20, -8, 40, 7);
    g.fillStyle = '#c8c2b5'; g.fillRect(-17, -27, 34, 20); g.fillStyle = '#ddd7cb'; g.fillRect(-17, -27, 34, 3);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(9, -27, 8, 20);
    g.fillStyle = '#aaa395'; g.fillRect(-19, -30, 38, 4);
    if (laurel) {
      g.strokeStyle = laurel; g.lineWidth = 1.4; g.beginPath(); g.arc(0, -17, 7, Math.PI * 0.15, Math.PI * 0.85, true); g.stroke();
      g.fillStyle = laurel; for (let k = 0; k < 5; k++) { for (const s of [-1, 1]) { const a = Math.PI * (0.5 + s * (0.25 + k * 0.13)); g.beginPath(); g.ellipse(Math.cos(a) * 7, -17 + Math.sin(a) * 7, 2.2, 1, a, 0, 7); g.fill(); } }
    } else { g.fillStyle = '#9a6a2a'; g.fillRect(-8, -21, 16, 9); g.fillStyle = '#c9934a'; g.fillRect(-7, -20, 14, 1.4); g.fillStyle = 'rgba(60,35,10,0.6)'; for (let k = 0; k < 3; k++) g.fillRect(-5, -17 + k * 2.4, 10, 0.9); }
  }
  // a statue of one of the townsfolk (83-townsfolk, look.who and stone) is the person in the new look, all in stone, its
  // own wings and all, scaled to fit the sprite (never bigger than the old 1.32) with the feet on the plinth's top
  // A knight look (the Last Knight, with 82-knightgear) is fitted as the knight's own statue is (heroFit): his feet on
  // the plinth's top, inside the sprite, and nothing of him below the plinth's top (his cape's hem, a bow's tip)
  function paintFigure(g, look, wings, scale, half) {
    const fit = window.TOWNSFOLK && TOWNSFOLK.takes(look) ? TOWNSFOLK.statueFit(look.who, scale, 61, (half || 24) - 1) : null;
    const kf = !fit && look.gear && KG() ? heroFit(look, (half || 24) - 1) : null;
    g.save();
    if (fit) { g.translate(0, -28 - fit.foot); g.scale(fit.s, fit.s); }
    else if (kf) { g.beginPath(); g.rect(-(half || 24), -96, 2 * (half || 24), 96 + HERO_FEET + 1); g.clip(); g.translate(0, kf.y0); g.scale(kf.s, kf.s); }
    else { g.translate(0, -48); g.scale(scale, scale); }
    if (wings && !fit) { g.save(); g.translate(0, -2); stoneWings(g); g.restore(); }
    drawHuman(g, { x: 0, y: 0, r: 13, facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, moving: false, walkT: 0 }, look);
    g.restore();
  }
  // the new Last Knight holds his sword upright at his side: his sprite is a little wider than the old one's 48 px
  const STATUE_HALF = { seraphel: 56, last_knight: 32 };
  function drawStatue(g, s) {
    const cx = tc(s.x), foot = (s.y + 1) * TILE - 2;
    // Queen Seraphel's statue spreads her wings: her sprite is wider (STATUE_HALF)
    const half = STATUE_HALF[s.id] || 24;
    const spr = sprite('statue:' + s.id, half * 2, 96, half, 90, cg => { paintPlinth(cg, null); paintFigure(cg, STATUE_LOOK[s.id], s.id === 'seraphel', 1.32, half); });
    const a = behindAlpha(cx - half + 2, foot - 86, cx + half - 2, foot, foot);
    if (a < 1) { g.save(); g.globalAlpha = a; }
    blit(g, spr, cx, foot);
    if (a < 1) g.restore();
    STATS.statues++;
  }
  // the knight's own look in stone, for the statue on the waiting plinth. With 82-knightgear it also carries what he
  // wears (the six item ids) and `stone`: the new knight is drawn, in his own helm, armour, shield and weapon, all of
  // him in stone
  const KG = () => window.KNIGHTGEAR || null;
  function heroLook() {
    const l = playerLook(), w = weaponDef(), o = STONE_LOOK({});
    if (l.helm) o.helm = '#cfc9bc'; if (l.body) o.body = '#c3bdb0'; if (l.shield) o.shield = '#bfb8a9';
    if (w && w.shape) o.weapon = { shape: w.shape, color: '#d8d2c6' };
    // a girl knight's statue (79-boygirl): her braid and ribbon in stone
    if (l.girl) { o.girl = true; o.woman = true; o.ribbon = '#cfc9bc'; }
    if (KG() && l.gear) { o.gear = Object.assign({}, l.gear); o.stone = true; if (!o.weapon) o.fists = true; }
    return o;
  }
  // The new knight can stand taller and wider than the old one (an upright spear, a party hat, a battleaxe's blade), so
  // he is fitted: his feet on the plinth's top (y -31 from the foot), his top under the sprite's (-89), his sides inside
  // its 96 px, never bigger than the old statue (1.32). y0 is where his own feet's centre goes.
  const HERO_FEET = -31, HERO_TOP = -89, HERO_HALF = 46, HERO_S = 1.32;
  function heroFit(look, half) {
    const x = KG().extent(look), fb = KG().extent({ gear: {}, fists: true }).b;
    const s = Math.min(HERO_S, (half || HERO_HALF) / Math.max(1, -x.l, x.r), (HERO_FEET - HERO_TOP) / Math.max(1, fb - x.t));
    return { s, y0: HERO_FEET - fb * s };
  }
  const heroParty = look => !!look.gear && !!look.gear.helm && !!ITEMS[look.gear.helm] && !!ITEMS[look.gear.helm].partyHat;
  // the statue's sprite: one per look (and, for the new knight, per what he wears)
  const heroKey = look => 'plinth-hero:' + [look.helm, look.body, look.shield, look.weapon && look.weapon.shape, look.girl ? 'girl' : '', look.gear ? KG().SLOTS.map(k => look.gear[k] || '').join(',') : ''].join('|');
  function drawPlinth(g) {
    const cx = tc(PL.x), foot = (PL.y + 1) * TILE - 2;
    if (!statueDone()) { blit(g, sprite('plinth-empty', 48, 40, 24, 36, cg => paintPlinth(cg, '#8f8a80')), cx, foot); return; }
    const look = heroLook(), key = heroKey(look);
    const a = behindAlpha(cx - 22, foot - 86, cx + 22, foot, foot);
    if (a < 1) { g.save(); g.globalAlpha = a; }
    if (look.gear) {
      const f = heroFit(look);
      blit(g, sprite(key, 96, 96, 48, 90, cg => {
        paintPlinth(cg, GOLD);
        // nothing of him below the plinth's top: a bow at his side, a cape's hem would hang down over its front and laurel
        cg.save(); cg.beginPath(); cg.rect(-48, -96, 96, 96 + HERO_FEET + 1); cg.clip(); cg.translate(0, f.y0); cg.scale(f.s, f.s);
        drawHuman(cg, { x: 0, y: 0, r: 13, facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, moving: false, walkT: 0 }, look);
        cg.restore();
      }), cx, foot);
      // the gold laurel round the top of his head (the new knight's head is at (0, -11) r 8 in his own frame); in a party
      // hat it rings the hat's brim (the cone's foot, (0.9, -17.7) turned 0.22), not across the middle of the cone
      g.strokeStyle = GOLD; g.lineWidth = 2; g.beginPath();
      if (heroParty(look)) g.ellipse(cx + 0.9 * f.s, foot + f.y0 - 17.7 * f.s, 6.8 * f.s, 1.9 * f.s, 0.22, 0, Math.PI);
      else g.arc(cx, foot + f.y0 - 15 * f.s, 8.5 * f.s, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
    } else {
      blit(g, sprite(key, 48, 96, 24, 90, cg => { paintPlinth(cg, GOLD); paintFigure(cg, look, false, 1.32); }), cx, foot);
      // the gold laurel on his head
      g.strokeStyle = GOLD; g.lineWidth = 2; g.beginPath(); g.arc(cx, foot - 48 - 1.32 * 12, 1.32 * 8.5, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    }
    if (a < 1) g.restore();
  }

  // ---------- the fountains ----------
  function octagon(g, cx, cy, rx, ry) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); }
  // the Great Fountain: an octagonal basin about 190 x 140 px, an upper bowl on a pillar, and a bronze knight holding
  // the thistle banner. Its centre is (112, 35.5) in tiles; its highest pixel is 24 px over row 34.
  const GF = { cx: TD.x(112) * TILE, cy: TD.y(35.5) * TILE, rx: 95, ry: 52, bowlY: -30, bowlRx: 34, bowlRy: 11 };
  const COINS = [[-50, 6], [-22, 22], [18, -14], [44, 12], [-6, -26], [30, 30], [-38, -12], [8, 34], [56, -4]];
  function paintBasin(g) {
    const { rx, ry } = GF;
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(6, 14, rx + 4, ry + 8, 0, 0, 7); g.fill();
    octagon(g, 0, 10, rx, ry); g.fillStyle = '#8f8a80'; g.fill();
    octagon(g, 0, 0, rx, ry); g.fillStyle = '#d8d1c3'; g.fill(); g.strokeStyle = '#a69f91'; g.lineWidth = 2; g.stroke();
    // the rim's stones
    g.strokeStyle = 'rgba(120,110,95,0.45)'; g.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; g.beginPath(); g.moveTo(Math.cos(a) * (rx - 9), Math.sin(a) * (ry - 6)); g.lineTo(Math.cos(a) * rx, Math.sin(a) * ry); g.stroke(); }
    octagon(g, 0, 0, rx - 11, ry - 8); const wat = g.createLinearGradient(0, -ry, 0, ry); wat.addColorStop(0, '#6cc0ea'); wat.addColorStop(1, '#2b78b8'); g.fillStyle = wat; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(-40, -18, 20, 5, -0.2, 0, 7); g.fill();
    // the near rim face, carved with a running band
    g.fillStyle = '#c9c2b4'; for (let i = 0; i < 4; i++) { const a0 = Math.PI / 8 + i * Math.PI / 4, a1 = a0 + Math.PI / 4; const x0 = Math.cos(a0) * rx, y0 = Math.sin(a0) * ry, x1 = Math.cos(a1) * rx, y1 = Math.sin(a1) * ry; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x1, y1 + 10); g.lineTo(x0, y0 + 10); g.closePath(); g.fill(); g.strokeStyle = 'rgba(100,90,75,0.4)'; g.stroke(); }
    g.fillStyle = PURPLE; for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 4; if (Math.sin(a) <= 0.1) continue; g.beginPath(); g.arc(Math.cos(a) * rx * 0.98, Math.sin(a) * ry + 5, 3, 0, 7); g.fill(); }
  }
  function paintUpper(g) {
    // the pillar, the upper bowl, and the bronze knight on it with the thistle banner
    const by = GF.bowlY;
    g.fillStyle = '#bdb6a8'; g.fillRect(-9, by, 18, -by - 4); g.fillStyle = '#d8d1c3'; g.fillRect(-9, by, 5, -by - 4);
    g.fillStyle = '#9b9488'; g.beginPath(); g.ellipse(0, by + 1, GF.bowlRx, GF.bowlRy + 6, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#d8d1c3'; g.beginPath(); g.ellipse(0, by, GF.bowlRx, GF.bowlRy, 0, 0, 7); g.fill();
    g.fillStyle = '#4a9ad0'; g.beginPath(); g.ellipse(0, by + 0.5, GF.bowlRx - 4, GF.bowlRy - 3, 0, 0, 7); g.fill();
    // the bronze knight: standing on a little drum in the middle of the bowl
    g.fillStyle = '#7a5a2e'; g.fillRect(-7, by - 12, 14, 12);
    g.save(); g.translate(0, by - 22); g.scale(0.92, 0.92);
    drawHuman(g, { x: 0, y: 0, r: 13, facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, moving: false, walkT: 0 }, { tunic: '#9a6b2f', hair: '#7a5424', skin: '#b07a3a', shoulder: '#8a5e28', helm: '#a87a3a', shield: '#8a5e28' });
    g.restore();
    // the banner pole in his left hand (the west side, clear of a knight standing at the spawn north-east of it), up to
    // 24 px over row 34, and the thistle banner on it
    g.fillStyle = '#6a4a22'; g.fillRect(-11.2, by - 62, 2.2, 48);
    g.fillStyle = '#c9a14a'; g.beginPath(); g.arc(-10.1, by - 62.5, 2, 0, 7); g.fill();
  }
  function drawGreatFountain(g) {
    const { cx, cy, rx, ry } = GF, t = time;
    const top = TD.y(34) * TILE - 24;
    // see-through only where the bronze knight and his banner rise over the rim, and only for a knight behind them
    const a = behindAlpha(cx - 36, top, cx + 9, cy - 40, TD.y(37) * TILE - 4);
    if (a < 1) { g.save(); g.globalAlpha = a; }
    blit(g, sprite('gf-basin', 2 * rx + 24, 2 * ry + 30, rx + 12, ry + 6, paintBasin), cx, cy);
    // ripples, and coins glinting on the bottom (fixed places, so nothing rolls a die)
    g.save(); octagon(g, cx, cy, rx - 12, ry - 9); g.clip();
    for (let k = 0; k < 3; k++) { const ph = fr(t * 0.4 + k / 3), rr = 30 + ph * 60; g.strokeStyle = `rgba(255,255,255,${((1 - ph) * 0.5).toFixed(3)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy + 4, rr, rr * 0.55, 0, 0, 7); g.stroke(); }
    COINS.forEach(([ox, oy], i) => { const gl = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 1.7); g.fillStyle = `rgba(245,197,66,${(0.55 + 0.35 * gl).toFixed(3)})`; g.beginPath(); g.ellipse(cx + ox, cy + oy * 0.7, 3, 1.8, 0.3, 0, 7); g.fill(); if (gl > 0.92) { g.fillStyle = '#fffbe0'; g.fillRect(cx + ox - 0.6, cy + oy * 0.7 - 3, 1.2, 6); g.fillRect(cx + ox - 3, cy + oy * 0.7 - 0.6, 6, 1.2); } });
    g.restore();
    // four arcs of water from the upper bowl into the basin
    const by = cy + GF.bowlY;
    for (let k = 0; k < 4; k++) {
      const ang = Math.PI / 4 + k * Math.PI / 2, ex = cx + Math.cos(ang) * (rx * 0.62), ey = cy + Math.sin(ang) * (ry * 0.62) + 2;
      const sx = cx + Math.cos(ang) * (GF.bowlRx - 2), sy = by + Math.sin(ang) * (GF.bowlRy - 1);
      for (let j = 0; j < 3; j++) { const ph = fr(t * 1.4 + j / 3 + k * 0.17); g.strokeStyle = `rgba(220,242,255,${(0.8 - ph * 0.45).toFixed(3)})`; g.lineWidth = 2.6 - j * 0.6; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2 + Math.cos(ang) * 6, Math.min(sy, ey) - 14, ex, ey); g.stroke(); }
      for (let j = 0; j < 2; j++) { const ph = fr(t * 1.8 + j * 0.5 + k * 0.3); g.strokeStyle = `rgba(255,255,255,${((1 - ph) * 0.6).toFixed(3)})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(ex, ey, 4 + ph * 9, (4 + ph * 9) * 0.45, 0, 0, 7); g.stroke(); }
    }
    blit(g, sprite('gf-upper', 90, 106, 45, 96, paintUpper), cx, cy);
    // water falling off the upper bowl
    for (let k = 0; k < 9; k++) { const an = Math.PI * (0.08 + k * 0.105), x = cx + Math.cos(an) * GF.bowlRx, y0 = by + Math.sin(an) * GF.bowlRy, ph = fr(t * 1.6 + k * 0.37); g.strokeStyle = `rgba(215,238,255,${(0.35 + 0.3 * Math.sin((ph + k) * 6.28)).toFixed(3)})`; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + Math.cos(an) * 4, y0 + 8, x + Math.cos(an) * 6, y0 + 16); g.stroke(); }
    // the thistle banner, fluttering at the top of the bronze knight's pole
    { const px = cx - 10.1, py = by - 61, sw = Math.sin(t * 2.4) * 2;
      g.fillStyle = PURPLE; g.beginPath(); g.moveTo(px, py); g.lineTo(px - 22, py + 1 + sw * 0.4); g.lineTo(px - 19 - sw, py + 8); g.lineTo(px - 22, py + 15 + sw * 0.4); g.lineTo(px, py + 16); g.closePath(); g.fill();
      g.strokeStyle = GOLD; g.lineWidth = 1; g.stroke(); thistle(g, px - 9, py + 7, 7, GOLD); }
    // spray: placed by the clock
    const frame = Math.floor(t * 8);
    for (let k = 0; k < 18; k++) { const h1 = hash(k, frame), h2 = hash(frame + 7, k * 13 + 1), an = h1 * Math.PI * 2, d = 14 + h2 * 50; g.fillStyle = `rgba(255,255,255,${(0.4 + h1 * 0.5).toFixed(3)})`; g.beginPath(); g.arc(cx + Math.cos(an) * d, cy - 4 + Math.sin(an) * d * 0.45 - h2 * 12, 1 + h2, 0, 7); g.fill(); }
    if (a < 1) g.restore();
    STATS.fountains++;
  }
  // the market fountain (one jet) and the Rose Garden's lily fountain (a stone fish spouting)
  function paintSmallBasin(g, lily) {
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(4, 8, 44, 26, 0, 0, 7); g.fill();
    if (lily) { g.fillStyle = '#8f8a80'; g.beginPath(); g.ellipse(0, 6, 42, 26, 0, 0, 7); g.fill(); g.fillStyle = '#d4cdbf'; g.beginPath(); g.ellipse(0, 0, 42, 26, 0, 0, 7); g.fill(); g.fillStyle = '#3d8ac4'; g.beginPath(); g.ellipse(0, 1, 34, 19, 0, 0, 7); g.fill(); }
    else { octagon(g, 0, 7, 42, 26); g.fillStyle = '#8f8a80'; g.fill(); octagon(g, 0, 0, 42, 26); g.fillStyle = '#d8d1c3'; g.fill(); octagon(g, 0, 0, 34, 19); g.fillStyle = '#3d8ac4'; g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.ellipse(-12, -7, 10, 3, -0.2, 0, 7); g.fill();
    if (lily) {
      for (const [lx, ly, r] of [[-18, 4, 6], [14, 8, 5], [20, -6, 5]]) { g.fillStyle = '#4f9a45'; g.beginPath(); g.moveTo(lx, ly); g.arc(lx, ly, r, 0.4, Math.PI * 2 - 0.1); g.closePath(); g.fill(); }
      g.fillStyle = '#ffb3cf'; for (let q = 0; q < 5; q++) { const a = q / 5 * Math.PI * 2; g.beginPath(); g.ellipse(-18 + Math.cos(a) * 2.5, 2 + Math.sin(a) * 1.6, 2.4, 1.4, a, 0, 7); g.fill(); }
      // the stone fish on a rock, nose up
      g.fillStyle = '#a8a193'; g.beginPath(); g.ellipse(0, -2, 9, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#cfc8ba'; g.save(); g.translate(0, -10); g.rotate(-1.1); g.beginPath(); g.ellipse(0, 0, 9, 4.5, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-8, 0); g.lineTo(-14, -4); g.lineTo(-14, 4); g.closePath(); g.fill(); g.fillStyle = '#4a4540'; g.beginPath(); g.arc(4, -1.5, 1, 0, 7); g.fill(); g.restore();
    } else { g.fillStyle = '#bdb6a8'; g.fillRect(-4, -18, 8, 18); g.fillStyle = '#d8d1c3'; g.beginPath(); g.ellipse(0, -18, 9, 3.5, 0, 0, 7); g.fill(); }
  }
  function drawSmallFountain(g, f) {
    const cx = (f.x + 1) * TILE, cy = (f.y + 1) * TILE + 2, t = time, lily = f.id === 'rose';
    blit(g, sprite(lily ? 'fount-lily' : 'fount-market', 100, 64, 50, 30, cg => paintSmallBasin(cg, lily)), cx, cy);
    if (lily) {
      // the fish spouts an arc into the pool
      for (let j = 0; j < 3; j++) { const ph = fr(t * 1.3 + j / 3); g.strokeStyle = `rgba(220,242,255,${(0.8 - ph * 0.4).toFixed(3)})`; g.lineWidth = 2 - j * 0.4; g.beginPath(); g.moveTo(cx + 5, cy - 18); g.quadraticCurveTo(cx + 16, cy - 30, cx + 24, cy - 2); g.stroke(); }
      const ph = fr(t * 1.5); g.strokeStyle = `rgba(255,255,255,${((1 - ph) * 0.6).toFixed(3)})`; g.lineWidth = 1.1; g.beginPath(); g.ellipse(cx + 24, cy, 3 + ph * 8, (3 + ph * 8) * 0.45, 0, 0, 7); g.stroke();
    } else {
      // one jet, up and back down
      for (let j = 0; j < 4; j++) { const ph = fr(t * 1.6 + j / 4); g.strokeStyle = `rgba(225,244,255,${(0.75 * (1 - ph * 0.6)).toFixed(3)})`; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy - 20); g.quadraticCurveTo(cx + (j - 1.5) * 6, cy - 44, cx + (j - 1.5) * 13, cy - 8 + ph * 6); g.stroke(); }
      for (let k = 0; k < 8; k++) { const h1 = hash(k, Math.floor(t * 8)); g.fillStyle = `rgba(255,255,255,${(0.4 + h1 * 0.4).toFixed(3)})`; g.beginPath(); g.arc(cx + (h1 - 0.5) * 50, cy - 4 + hash(k * 3, Math.floor(t * 8)) * 12 - 6, 1.1, 0, 7); g.fill(); }
    }
    STATS.fountains++;
  }

  // ---------- greenery ----------
  function paintHedge(g, n, e, s, w, v) {
    const l = w ? 0 : 3, r = e ? 48 : 45, top = n ? -8 : -10, bot = s ? 38 : 30;
    const r2 = mulberry32(0xed9e + v * 31 + (n ? 1 : 0) + (e ? 2 : 0) + (s ? 4 : 0) + (w ? 8 : 0));
    g.fillStyle = '#3f8a3a'; g.fillRect(l, top, r - l, bot - top);
    if (!s) { g.fillStyle = '#2a6127'; g.fillRect(l, 30, r - l, 14); g.fillStyle = 'rgba(15,45,15,0.4)'; g.fillRect(l, 40, r - l, 4); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(l + 2, 44, r - l - 2, 4); }
    for (let i = 0; i < 26; i++) { const x = l + 2 + r2() * (r - l - 4), y = top + 2 + r2() * (bot - top - 4); g.fillStyle = r2() < 0.55 ? 'rgba(130,200,100,0.45)' : 'rgba(25,80,25,0.45)'; g.beginPath(); g.arc(x, y, 2 + r2() * 2, 0, 7); g.fill(); }
    if (!n) { g.fillStyle = 'rgba(190,240,150,0.5)'; g.fillRect(l, top, r - l, 2); }
  }
  function drawHedge(g, tx, ty) {
    const H0 = (x, y) => kindAt(x, y) === 'hedge';
    const n = H0(tx, ty - 1), e = H0(tx + 1, ty), s = H0(tx, ty + 1), w = H0(tx - 1, ty), v = GVAR[pi(tx, ty)] % 2;
    blit(g, sprite('hedge' + (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0) + v, 48, 60, 0, 12, cg => paintHedge(cg, n, e, s, w, v)), tx * TILE, ty * TILE);
  }
  function paintTree(g, kind, v, R) {
    const r = mulberry32(0x7ee + v * 101 + (kind === 'fruit' ? 9 : 0));
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(4, 0, R - 2, 7, 0, 0, 7); g.fill();
    g.fillStyle = kind === 'fruit' ? '#6b4a2a' : '#7a5a4a'; g.beginPath(); g.moveTo(-4, 0); g.quadraticCurveTo(-2 + v, -18, -3, -34); g.lineTo(3, -34); g.quadraticCurveTo(3 + v, -18, 4, 0); g.closePath(); g.fill();
    const k = R / 26, puffs = [[-14, -46, 16], [13, -48, 16], [0, -58, 19], [-7, -68, 13], [10, -66, 13], [0, -42, 14]].map(([x, y, rr]) => [x * k, y, rr * k]);
    const dark = kind === 'fruit' ? '#3f8a35' : '#e090b0', mid = kind === 'fruit' ? '#58a845' : '#f3add0', hi = kind === 'fruit' ? '#7cc35a' : '#ffd3e6';
    for (const [x, y, rr] of puffs) { g.fillStyle = dark; g.beginPath(); g.arc(x + 2, y + 3, rr, 0, 7); g.fill(); }
    for (const [x, y, rr] of puffs) { g.fillStyle = mid; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }
    for (const [x, y, rr] of puffs) { g.fillStyle = hi; g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.35, rr * 0.5, 0, 7); g.fill(); }
    // blossom on the apple trees (white and pink), little green apples; cherry trees are all blossom
    const n = kind === 'fruit' ? 16 : 22;
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = r() * 22 * k, x = Math.cos(a) * d, y = -56 + Math.sin(a) * d * 0.8; g.fillStyle = kind === 'fruit' ? (r() < 0.6 ? '#ffffff' : '#ffc6dc') : (r() < 0.5 ? '#fff4f8' : '#ff9ec4'); g.beginPath(); g.arc(x, y, 1.5 + r() * 1.2, 0, 7); g.fill(); }
    if (kind === 'fruit') for (let i = 0; i < 5; i++) { const a = r() * Math.PI * 2, d = r() * 18 * k; g.fillStyle = '#9fd04a'; g.beginPath(); g.arc(Math.cos(a) * d, -50 + Math.sin(a) * d * 0.7, 2.2, 0, 7); g.fill(); }
  }
  // a tree's half-width: 26 px, less where a building stands right beside it
  const TREE_R = {};
  for (const t of PLAN.TREES) { let R = 26; for (const b of BUILDINGS) { const bx0 = b.x * TILE, bx1 = (b.x + b.w) * TILE, by0 = b.y * TILE, by1 = (b.y + b.h) * TILE; if (by1 > t.y * TILE - 60 && by0 < (t.y + 1) * TILE) { const cx = tc(t.x); if (bx1 <= cx) R = Math.min(R, cx - bx1 - 1); if (bx0 >= cx) R = Math.min(R, bx0 - cx - 1); } } TREE_R[t.x + ',' + t.y] = Math.max(16, Math.min(26, R)); }
  function drawTree(g, tx, ty, kind) {
    const cx = tc(tx), by = (ty + 1) * TILE - 6, v = GVAR[pi(tx, ty)], R = TREE_R[tx + ',' + ty] || 26;
    const a = behindAlpha(cx - R, by - 84, cx + R, by - 20, by);
    if (a < 1) { g.save(); g.globalAlpha = a; }
    blit(g, sprite('tree-' + kind + v + 'r' + R, 2 * R + 12, 96, R + 6, 88, cg => paintTree(cg, kind, v, R)), cx, by);
    if (kind === 'cherry') for (let k = 0; k < 2; k++) { const h0 = hash(TD.ix(tx) * 7 + k, TD.iy(ty) * 3 + k), ph = fr(time * 0.25 + h0), px = cx - R * 0.7 + h0 * R * 1.4 + Math.sin(ph * 6 + k) * 4, py = by - 50 + ph * 46; g.fillStyle = `rgba(255,${180 + Math.floor(h0 * 50)},210,${(Math.sin(ph * Math.PI) * 0.85).toFixed(3)})`; g.beginPath(); g.ellipse(px, py, 2.2, 1.3, ph * 6, 0, 7); g.fill(); }
    if (a < 1) g.restore();
  }
  function paintRoses(g, v) {
    const r = mulberry32(0x7053 + v * 17);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(24, 40, 20, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#6b4a2a'; g.fillRect(6, 34, 36, 8); g.fillStyle = '#7a5a36'; g.fillRect(6, 34, 36, 2);
    g.fillStyle = '#2f6b2a'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(8 + r() * 32, 14 + r() * 20, 6 + r() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#3f8a3a'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(8 + r() * 32, 12 + r() * 18, 3 + r() * 2, 0, 7); g.fill(); }
    const cols = ['#c8243a', '#e0506a', '#ffffff', '#f06a8a'];
    for (let i = 0; i < 11; i++) { const x = 9 + r() * 30, y = 10 + r() * 22, c = cols[(i + v) % cols.length]; g.fillStyle = c; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); g.strokeStyle = 'rgba(80,0,20,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, 1.6, 0, 5); g.stroke(); }
  }
  const drawRoses = (g, tx, ty) => { const v = GVAR[pi(tx, ty)]; blit(g, sprite('roses' + v, 48, 48, 0, 0, cg => paintRoses(cg, v)), tx * TILE, ty * TILE); };
  // a flower bed in a timber frame: lavender spikes, marigolds, white daisies and cornflowers (the Duke's roses are the red ones)
  function paintFlowerBed(g, v) {
    const r = mulberry32(0xf10e + v * 23);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(25, 42, 21, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3c22'; g.fillRect(3, 24, 42, 18); g.fillStyle = '#7d5832'; g.fillRect(3, 24, 42, 3); g.fillRect(3, 37, 42, 5);
    g.fillStyle = 'rgba(255,230,190,0.25)'; g.fillRect(3, 37, 42, 1.2);
    g.fillStyle = '#4a3020'; g.fillRect(6, 27, 36, 10);
    g.fillStyle = '#3f7d33'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(8 + r() * 32, 22 + r() * 10, 4 + r() * 2.5, 0, 7); g.fill(); }
    g.fillStyle = '#5aa045'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(8 + r() * 32, 20 + r() * 9, 2.4 + r() * 1.5, 0, 7); g.fill(); }
    // lavender spikes at the back, flowers in front
    for (let i = 0; i < 6; i++) { const x = 8 + i * 6.4 + r() * 2, top = 6 + r() * 6; g.strokeStyle = '#4f7a3a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 26); g.lineTo(x, top + 6); g.stroke(); g.fillStyle = (i + v) % 2 ? '#8a6ad0' : '#a888e0'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x, top + k * 2.6, 1.6, 1.9, 0, 0, 7); g.fill(); } }
    const cols = ['#f5a623', '#ffffff', '#4a7ad8', '#f5c542', '#e0506a'];
    for (let i = 0; i < 9; i++) { const x = 8 + r() * 32, y = 20 + r() * 12, c = cols[(i + v) % cols.length]; g.fillStyle = c; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 1.7, y + Math.sin(a) * 1.7, 1.3, 0, 7); g.fill(); } g.fillStyle = c === '#ffffff' ? '#f5c542' : '#7a4a1a'; g.beginPath(); g.arc(x, y, 0.9, 0, 7); g.fill(); }
  }
  const drawFlowerBed = (g, tx, ty) => { const v = GVAR[pi(tx, ty)]; blit(g, sprite('flowerbed' + v, 48, 48, 0, 0, cg => paintFlowerBed(cg, v)), tx * TILE, ty * TILE); };

  // ---------- the Smithy Yard, the Bell Green and the inn's garden ----------
  // a woodpile of split logs, end-on, stacked between two stakes (inside its own tile: it stands against walls)
  function paintWoodpile(g, v) {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(26, 44, 22, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#4a3420'; g.fillRect(3, 6, 4, 38); g.fillRect(41, 6, 4, 38);
    g.fillStyle = '#6b4a2a'; g.fillRect(4, 40, 40, 4);
    const rows = [[8, 36, 5], [11, 27, 4], [14, 18, 3], [20, 10, 2]];
    rows.forEach(([x0, y, n], ri) => { for (let k = 0; k < n; k++) { const cx = x0 + 4 + k * 9 + (ri === 3 ? 4 : 0), cy = y; g.fillStyle = '#5a3c22'; g.beginPath(); g.arc(cx, cy, 4.8, 0, 7); g.fill(); g.fillStyle = (k + ri + v) % 3 ? '#d9b380' : '#caa06a'; g.beginPath(); g.arc(cx, cy, 3.6, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,80,40,0.5)'; g.lineWidth = 0.7; g.beginPath(); g.arc(cx, cy, 2, 0, 7); g.stroke(); } });
    g.fillStyle = 'rgba(255,240,210,0.2)'; g.fillRect(4, 6, 1.4, 38);
  }
  // the smithy's handcart: a plank box on one big spoked wheel, heaped with charcoal, its handles to the west (two tiles)
  function paintCart(g) {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(50, 46, 40, 6, 0, 0, 7); g.fill();
    g.strokeStyle = '#4a3420'; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(22, 26); g.lineTo(-2, 34); g.moveTo(22, 20); g.lineTo(0, 28); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = '#4a3420'; g.fillRect(80, 28, 4, 16);
    // the charcoal heap
    g.fillStyle = '#26221f'; g.beginPath(); g.moveTo(22, 12); g.quadraticCurveTo(36, -14, 52, -4); g.quadraticCurveTo(66, -14, 84, 12); g.closePath(); g.fill();
    g.fillStyle = '#3d3834'; for (const [x, y] of [[32, 2], [44, -4], [56, 0], [68, 4], [40, 8], [62, -6], [74, 9]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    // the box
    g.fillStyle = '#7d5832'; g.fillRect(20, 10, 66, 22); g.fillStyle = '#94693c'; g.fillRect(20, 10, 66, 3);
    g.fillStyle = 'rgba(30,18,8,0.4)'; g.fillRect(20, 20, 66, 1.4); for (const x of [38, 56, 72]) g.fillRect(x, 10, 1.4, 22);
    g.fillStyle = '#2a2d33'; g.fillRect(20, 10, 3, 22); g.fillRect(83, 10, 3, 22);
    // the wheel
    g.fillStyle = '#3d2a1a'; g.beginPath(); g.arc(52, 34, 14, 0, 7); g.fill(); g.fillStyle = '#94693c'; g.beginPath(); g.arc(52, 34, 11, 0, 7); g.fill(); g.fillStyle = '#3d2a1a'; g.beginPath(); g.arc(52, 34, 8.5, 0, 7); g.fill();
    g.strokeStyle = '#94693c'; g.lineWidth = 2; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.moveTo(52, 34); g.lineTo(52 + Math.cos(a) * 9, 34 + Math.sin(a) * 9); g.stroke(); }
    g.fillStyle = '#2a2d33'; g.beginPath(); g.arc(52, 34, 2.6, 0, 7); g.fill();
    g.strokeStyle = '#2a2d33'; g.lineWidth = 1.4; g.beginPath(); g.arc(52, 34, 13.5, 0, 7); g.stroke();
  }
  // the old anvil on a tree stump, a hammer resting against it (inside its tile: the smithy's wall is just north)
  function paintOldAnvil(g) {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(26, 44, 18, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#6b4a2a'; g.fillRect(11, 26, 26, 18); g.fillStyle = '#5a3c22'; g.fillRect(31, 26, 6, 18);
    g.strokeStyle = 'rgba(30,18,8,0.45)'; g.lineWidth = 1; for (const x of [16, 22, 28]) { g.beginPath(); g.moveTo(x, 28); g.lineTo(x + 1, 43); g.stroke(); }
    g.fillStyle = '#c9a36a'; g.beginPath(); g.ellipse(24, 26, 13, 5, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,80,40,0.6)'; g.beginPath(); g.ellipse(24, 26, 8, 3, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(24, 26, 4, 1.5, 0, 0, 7); g.stroke();
    // the anvil: horn to the west, a flat face, a waist and a foot
    g.fillStyle = '#2f3238'; g.fillRect(19, 18, 10, 6); g.fillRect(15, 22, 18, 3);
    g.beginPath(); g.moveTo(10, 12); g.lineTo(16, 10); g.lineTo(36, 10); g.lineTo(36, 17); g.lineTo(18, 17); g.closePath(); g.fill();
    g.fillStyle = '#5d6370'; g.fillRect(16, 10, 20, 2.4); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(18, 10, 14, 1);
    // the hammer, leaning on the stump
    g.strokeStyle = '#7a5530'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(40, 44); g.lineTo(37, 24); g.stroke();
    g.fillStyle = '#3d4048'; g.fillRect(33, 20, 9, 5);
  }
  // a water trough of planks with iron bands; the water is drawn live
  function paintTrough(g) {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(25, 42, 22, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3c22'; g.fillRect(3, 18, 42, 24); g.fillStyle = '#7d5832'; g.fillRect(3, 26, 42, 16);
    g.fillStyle = 'rgba(30,18,8,0.35)'; g.fillRect(3, 33, 42, 1.2);
    g.fillStyle = '#2a2d33'; g.fillRect(9, 26, 3, 16); g.fillRect(36, 26, 3, 16);
    g.fillStyle = '#94693c'; g.fillRect(3, 18, 42, 3); g.fillRect(3, 18, 3, 9); g.fillRect(42, 18, 3, 9);
    g.fillStyle = '#3d7fb0'; g.fillRect(6, 21, 36, 5);
  }
  function drawTrough(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    blit(g, sprite('trough', 48, 48, 0, 0, paintTrough), x, y);
    const ph = fr(time * 0.7 + tx * 0.1); g.strokeStyle = `rgba(255,255,255,${(0.5 * (1 - ph)).toFixed(3)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x + 24, y + 23.5, 4 + ph * 12, 1.4 + ph * 1.2, 0, 0, 7); g.stroke();
  }
  // the well on the Bell Green: a stone ring, two posts, a little shingled roof, a crank, a rope and a bucket (origin: the foot)
  function paintWell(g) {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(4, -2, 26, 7, 0, 0, 7); g.fill();
    // the posts and the roof
    g.fillStyle = '#5a3c22'; g.fillRect(-22, -64, 5, 50); g.fillRect(17, -64, 5, 50);
    g.fillStyle = '#7a4a2a'; g.beginPath(); g.moveTo(-28, -60); g.lineTo(0, -82); g.lineTo(28, -60); g.lineTo(24, -56); g.lineTo(0, -75); g.lineTo(-24, -56); g.closePath(); g.fill();
    g.fillStyle = '#a0603a'; g.beginPath(); g.moveTo(-26, -61); g.lineTo(0, -80); g.lineTo(0, -75); g.lineTo(-24, -57); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,20,10,0.35)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { const f = k / 4; g.beginPath(); g.moveTo(-26 + 26 * f, -61 - 19 * f); g.lineTo(26 - 26 * f, -61 - 19 * f); g.stroke(); }
    g.fillStyle = GOLD; g.beginPath(); g.arc(0, -83, 2.4, 0, 7); g.fill();
    // the windlass and its crank
    g.fillStyle = '#6b4a2a'; g.fillRect(-18, -48, 36, 6); g.fillStyle = '#2a2d33'; g.fillRect(18, -47, 8, 2.5); g.fillRect(25, -47, 2.5, 9);
    g.strokeStyle = '#c9a36a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(2, -42); g.lineTo(2, -24); g.stroke();
    g.fillStyle = '#6b4a2a'; g.fillRect(-3, -26, 10, 9); g.fillStyle = '#2a2d33'; g.fillRect(-3, -24, 10, 1.6);
    // the stone ring: the far rim, the dark water, the near wall
    g.fillStyle = '#9aa0a8'; g.beginPath(); g.ellipse(0, -18, 22, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#1d3550'; g.beginPath(); g.ellipse(0, -18, 16, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#7d8087'; g.beginPath(); g.moveTo(-22, -18); g.lineTo(-22, -2); g.ellipse(0, -2, 22, 8, 0, Math.PI, 0, true); g.lineTo(22, -18); g.ellipse(0, -18, 22, 8, 0, 0, Math.PI); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,40,45,0.4)'; g.lineWidth = 1; for (const yy of [-12, -6]) { g.beginPath(); g.ellipse(0, yy, 22, 8, 0, 0.1, Math.PI - 0.1); g.stroke(); }
    for (const [a, yy] of [[0.5, -15], [1.4, -15], [2.3, -15], [0.95, -9], [1.9, -9]]) { const sx = Math.cos(a) * 22; g.beginPath(); g.moveTo(sx, yy + Math.sin(a) * 8 - 3); g.lineTo(sx, yy + Math.sin(a) * 8 + 3); g.stroke(); }
    g.fillStyle = '#b4b9c0'; g.beginPath(); g.ellipse(0, -18, 22, 8, 0, Math.PI, 0); g.ellipse(0, -18, 18, 6, 0, 0, Math.PI, true); g.closePath(); g.fill();
  }
  // a trestle table in the inn's garden, a bench either side, a tankard and a plate on it
  function paintTable(g, v) {
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(25, 40, 22, 6, 0, 0, 7); g.fill();
    // the far bench, the table, the near bench
    g.fillStyle = '#6b4a2a'; g.fillRect(6, 8, 36, 5); g.fillStyle = '#4a3420'; g.fillRect(8, 13, 3, 5); g.fillRect(37, 13, 3, 5);
    g.fillStyle = '#4a3420'; g.fillRect(9, 26, 4, 12); g.fillRect(35, 26, 4, 12);
    g.fillStyle = '#8a6238'; g.fillRect(3, 14, 42, 14); g.fillStyle = '#9c7444'; g.fillRect(3, 14, 42, 2);
    g.fillStyle = 'rgba(30,18,8,0.3)'; g.fillRect(3, 20, 42, 1); g.fillRect(3, 24, 42, 1); g.fillStyle = '#5a3c22'; g.fillRect(3, 27, 42, 2.5);
    g.fillStyle = '#7d5832'; g.fillRect(5, 34, 38, 5); g.fillStyle = '#4a3420'; g.fillRect(7, 39, 3, 5); g.fillRect(38, 39, 3, 5);
    // a tankard, and a plate with a heel of bread
    const tx = v % 2 ? 31 : 13;
    g.fillStyle = '#9aa0a8'; g.fillRect(tx, 12, 7, 9); g.fillStyle = '#f3ead2'; g.fillRect(tx, 11, 7, 2.4); g.strokeStyle = '#9aa0a8'; g.lineWidth = 1.4; g.beginPath(); g.arc(tx + 8, 16, 2.4, -1.4, 1.4); g.stroke();
    const px = v % 2 ? 15 : 31; g.fillStyle = '#e8e2d4'; g.beginPath(); g.ellipse(px, 20, 6, 3, 0, 0, 7); g.fill(); g.fillStyle = '#c98a3a'; g.beginPath(); g.ellipse(px, 19, 3.2, 1.8, 0, 0, 7); g.fill();
  }
  function drawWell(g, tx, ty) {
    const cx = tc(tx), foot = (ty + 1) * TILE - 2;
    const a = behindAlpha(cx - 28, foot - 86, cx + 28, foot, foot);
    if (a < 1) { g.save(); g.globalAlpha = a; }
    blit(g, sprite('well', 64, 96, 32, 90, paintWell), cx, foot);
    // a glint on the water
    const ph = fr(time * 0.5); g.fillStyle = `rgba(200,230,255,${(0.5 * Math.sin(ph * Math.PI)).toFixed(3)})`; g.beginPath(); g.ellipse(cx - 4 + ph * 8, foot - 18, 3, 1, 0, 0, 7); g.fill();
    if (a < 1) g.restore();
  }

  // ---------- benches, signposts, the sundial ----------
  function paintBench(g) {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(-19, -3, 40, 5);
    g.fillStyle = '#1f2126'; g.fillRect(-18, -18, 4, 17); g.fillRect(14, -18, 4, 17); g.fillRect(-18, -30, 3, 14); g.fillRect(15, -30, 3, 14);
    g.fillStyle = '#8a6238'; for (let k = 0; k < 3; k++) g.fillRect(-20, -17 + k * 4, 40, 3); g.fillStyle = '#9c7444'; g.fillRect(-20, -17, 40, 1.2);
    g.fillStyle = '#7d5832'; g.fillRect(-19, -30, 38, 4); g.fillRect(-19, -24, 38, 4);
  }
  function paintSign(g, side) {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(4, 0, 10, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3c22'; g.fillRect(-3, -60, 6, 60); g.fillStyle = '#7a5530'; g.fillRect(-3, -60, 2, 60);
    const board = (y, dir, word) => {
      g.fillStyle = '#3d2a1a'; g.beginPath(); if (dir < 0) { g.moveTo(-22, y); g.lineTo(-16, y - 7); g.lineTo(20, y - 7); g.lineTo(20, y + 7); g.lineTo(-16, y + 7); } else { g.moveTo(22, y); g.lineTo(16, y - 7); g.lineTo(-20, y - 7); g.lineTo(-20, y + 7); g.lineTo(16, y + 7); } g.closePath(); g.fill();
      g.strokeStyle = GOLD_D; g.lineWidth = 1; g.stroke();
      g.fillStyle = GOLD; g.font = `700 6.5px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(word, dir < 0 ? 2 : -2, y + 0.5); g.textBaseline = 'alphabetic';
    };
    if (side === 'west') { board(-50, -1, 'WEST GATE'); board(-34, 1, 'FOUNTAIN'); } else { board(-50, 1, 'EAST GATE'); board(-34, -1, 'FOUNTAIN'); }
    g.fillStyle = GOLD; g.beginPath(); g.arc(0, -62, 3, 0, 7); g.fill();
  }
  function paintSundial(g) {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(3, 0, 17, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#9b9488'; g.fillRect(-15, -6, 30, 6); g.fillStyle = '#c8c2b5'; g.fillRect(-8, -22, 16, 17); g.fillStyle = '#ddd7cb'; g.fillRect(-8, -22, 4, 17);
    g.fillStyle = '#b8b1a3'; g.beginPath(); g.ellipse(0, -24, 16, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#b07a3a'; g.beginPath(); g.ellipse(0, -25, 13, 5.5, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(60,35,10,0.6)'; g.lineWidth = 0.8; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 9, -25 + Math.sin(a) * 3.8); g.lineTo(Math.cos(a) * 12, -25 + Math.sin(a) * 5); g.stroke(); }
    g.fillStyle = '#7a5424'; g.beginPath(); g.moveTo(0, -25); g.lineTo(0, -34); g.lineTo(6, -25); g.closePath(); g.fill();
  }
  function drawSundial(g, tx, ty) {
    const cx = tc(tx), foot = (ty + 1) * TILE - 4;
    blit(g, sprite('sundial', 40, 44, 20, 38, paintSundial), cx, foot);
    // the gnomon's shadow walks with the sun
    if (!lit()) { const an = dialAngle() + Math.PI / 2; g.strokeStyle = 'rgba(40,25,10,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, foot - 25); g.lineTo(cx + Math.cos(an) * 10, foot - 25 + Math.sin(an) * 4); g.stroke(); }
  }

  // ---------- the Market Court's stalls ----------
  function paintGoods(g, goods) {
    if (goods === 'apples') for (let i = 0; i < 16; i++) { const x = -38 + (i % 8) * 10 + (i > 7 ? 5 : 0), y = -2 - (i > 7 ? 6 : 0); g.fillStyle = i % 3 ? '#c8243a' : '#8fbf3a'; g.beginPath(); g.arc(x, y, 4.2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(x - 1.4, y - 1.4, 1.2, 0, 7); g.fill(); }
    else if (goods === 'candles') for (let i = 0; i < 9; i++) { const x = -38 + i * 9.5, h = 8 + (i * 7) % 10; g.fillStyle = ['#f3ead2', '#e8c86a', '#d9a0c0'][i % 3]; g.fillRect(x - 2.5, -h, 5, h); g.fillStyle = '#2a2018'; g.fillRect(x - 0.4, -h - 3, 0.8, 3); }
    else if (goods === 'flowers') for (let i = 0; i < 5; i++) { const x = -34 + i * 17; g.fillStyle = '#6b707a'; g.fillRect(x - 6, -8, 12, 9); g.fillStyle = '#3f8a3a'; g.beginPath(); g.arc(x, -10, 6, 0, 7); g.fill(); const c = ['#e0506a', '#f5c542', '#ffffff', '#b07ad8', '#ff8a3a'][i]; g.fillStyle = c; for (let q = 0; q < 5; q++) { g.beginPath(); g.arc(x - 4 + q * 2, -13 + (q % 2) * 3, 2.4, 0, 7); g.fill(); } }
    else for (let i = 0; i < 4; i++) { const x = -34 + i * 22, c = ['#5a2e7a', '#2e5a9a', '#b8352b', '#e6dcc4'][i]; g.fillStyle = c; roundRect(g, x - 9, -10, 18, 10, 3); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - 8, -9, 16, 2); }
  }
  // a two-tile counter under a striped awning; the local origin is the middle of the counter's front edge
  function paintStall(g, s) {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(-46, 0, 96, 6);
    // posts and the counter
    g.fillStyle = '#5a3c22'; g.fillRect(-46, -52, 4, 52); g.fillRect(42, -52, 4, 52);
    g.fillStyle = '#7d5832'; g.fillRect(-44, -20, 88, 20); g.fillStyle = '#94693c'; g.fillRect(-44, -24, 88, 6);
    g.fillStyle = 'rgba(30,18,8,0.35)'; for (let k = 1; k < 4; k++) g.fillRect(-44 + k * 22, -18, 1.2, 18);
    paintGoods(g, s.goods);
    if (s.goods === 'cloth') { g.fillStyle = '#3d2a1a'; g.fillRect(14, -40, 26, 13); g.strokeStyle = GOLD_D; g.lineWidth = 1; g.strokeRect(14, -40, 26, 13); g.fillStyle = '#f3ead2'; g.font = `700 4.6px ${DISPLAY}`; g.textAlign = 'center'; g.fillText('BACK', 27, -34); g.fillText('SOON', 27, -29); g.fillStyle = '#3d2a1a'; g.fillRect(25, -27, 3, 7); }
  }
  function drawAwning(g, cx, top, col) {
    const fl = Math.sin(time * 2.2 + cx * 0.01) * 1.2;
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx - 50, top + 26, 100, 5);
    for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#f6f1e6' : col; g.beginPath(); g.moveTo(cx - 50 + k * 10, top); g.lineTo(cx - 40 + k * 10, top); g.lineTo(cx - 40 + k * 10 + fl * 0.3, top + 20 + fl); g.lineTo(cx - 50 + k * 10 + fl * 0.3, top + 20 + fl); g.closePath(); g.fill(); }
    for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#f6f1e6' : col; g.beginPath(); g.arc(cx - 45 + k * 10 + fl * 0.3, top + 20 + fl, 5, 0, Math.PI); g.fill(); }
    g.fillStyle = '#5a3c22'; g.fillRect(cx - 51, top - 2, 102, 3);
  }
  function drawStall(g, s) {
    const cx = (s.x + 1) * TILE, foot = (s.y + 1) * TILE - 4;
    blit(g, sprite('stall-' + s.goods, 100, 60, 50, 56, cg => paintStall(cg, s)), cx, foot);
    drawAwning(g, cx, s.y * TILE - 24, s.awning);
  }

  // ---------- the Bell Tower ----------
  // a square stone tower about five tiles tall on its 2 x 2 footprint: the day-and-night dial on its south face, an open
  // belfry with the bronze bell, a slate pyramid roof and a pennant
  // FACE: the top of the dial's stretch of wall; BELFRY: the belfry's floor (both above the foot, in px)
  // TOP: the highest drawn pixel (the pennant's crest), over the foot
  const BT = { x: PLAN.BELL.x * TILE, foot: (PLAN.BELL.y + PLAN.BELL.h) * TILE, w: PLAN.BELL.w * TILE, FACE: -118, BELFRY: -150, TOP: -280 };
  function paintBellTower(g) {
    // local origin: the footprint's bottom-left; the tower rises 236 px
    const w = BT.w, face = BT.FACE, belfry = BT.BELFRY;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(6, -6, w, 12);
    g.fillStyle = STONE[0]; g.fillRect(0, belfry, w, -belfry);
    for (let r = 0; r * 12 < -belfry; r++) { const yy = -12 - r * 12, off = r % 2 ? 12 : 0; for (let c = -1; c < 5; c++) { g.fillStyle = ['#7d8087', '#767980', '#83868d'][(r + c + 6) % 3]; const xx = off + c * 24 + 1; g.fillRect(Math.max(0, xx), yy + 1, Math.min(22, w - Math.max(0, xx)), 10); } }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(w - 16, belfry, 16, -belfry);
    g.fillStyle = '#9aa0a8'; g.fillRect(-3, -8, w + 6, 8); g.fillRect(-2, face - 6, w + 4, 5); g.fillRect(-2, belfry - 2, w + 4, 6);
    // the dial's stone ring (the dial itself is drawn live)
    g.fillStyle = '#b4b9c0'; g.beginPath(); g.arc(w / 2, face + 40, 30, 0, 7); g.fill(); g.fillStyle = '#3a3f4a'; g.beginPath(); g.arc(w / 2, face + 40, 27, 0, 7); g.fill();
    // the door at the foot
    g.fillStyle = '#3d2a1a'; g.beginPath(); g.moveTo(w / 2 - 12, 0); g.lineTo(w / 2 - 12, -26); g.arc(w / 2, -26, 12, Math.PI, 0); g.lineTo(w / 2 + 12, 0); g.closePath(); g.fill();
    g.strokeStyle = '#9aa0a8'; g.lineWidth = 2; g.stroke(); g.fillStyle = GOLD; g.beginPath(); g.arc(w / 2 + 6, -16, 1.6, 0, 7); g.fill();
    // the belfry: four corner piers and the open arches between them
    g.fillStyle = '#2a2d33'; g.fillRect(6, belfry - 46, w - 12, 46);
    g.fillStyle = '#8b8f96'; for (const px of [0, w / 2 - 5, w - 10]) g.fillRect(px, belfry - 46, 10, 46);
    g.fillStyle = '#9aa0a8'; g.fillRect(-2, belfry - 50, w + 4, 6);
    // the slate pyramid roof
    const cone = g.createLinearGradient(0, 0, w, 0); cone.addColorStop(0, '#2c3038'); cone.addColorStop(0.4, '#5d6370'); cone.addColorStop(1, '#262a31');
    g.fillStyle = cone; g.beginPath(); g.moveTo(-6, belfry - 48); g.lineTo(w / 2, belfry - 100); g.lineTo(w + 6, belfry - 48); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1; for (let k = 1; k < 6; k++) { const f = k / 6, yy = belfry - 48 - 52 * f; g.beginPath(); g.moveTo(-6 + (w / 2 + 6) * f, yy); g.lineTo(w + 6 - (w / 2 + 6) * f, yy); g.stroke(); }
    g.fillStyle = GOLD; g.beginPath(); g.arc(w / 2, belfry - 102, 3.2, 0, 7); g.fill(); g.fillRect(w / 2 - 1, belfry - 118, 2, 16);
  }
  function drawBellTower(g) {
    const x = BT.x, foot = BT.foot, w = BT.w, belfry = foot + BT.BELFRY;
    // it rises over the north wall: a knight (or a friend) on the grass outside, behind it, sees through it
    const a = behindAlpha(x - 6, foot + BT.TOP, x + w + 6, foot, foot - 2);
    STATS.bellAlpha = Math.min(STATS.bellAlpha, a);
    if (a < 1) { g.save(); g.globalAlpha = a; }
    drawBellTowerBody(g, x, foot, w, belfry);
    if (a < 1) g.restore();
  }
  function drawBellTowerBody(g, x, foot, w, belfry) {
    blit(g, sprite('belltower', w + 20, 300, 10, 284, paintBellTower), x, foot);
    // the dial: blue sky with a sun over navy night with a moon, and one gold hand at dayT / DAY x 2 pi
    const dx = x + w / 2, dy = foot + BT.FACE + 40, R = 25;
    g.save(); g.beginPath(); g.arc(dx, dy, R, 0, 7); g.clip();
    g.fillStyle = '#6fb6e8'; g.fillRect(dx - R, dy - R, 2 * R, R); g.fillStyle = '#1d2a52'; g.fillRect(dx - R, dy, 2 * R, R);
    g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(dx, dy - 13, 6, 0, 7); g.fill(); g.strokeStyle = '#ffe27a'; g.lineWidth = 1.2; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(dx + Math.cos(a) * 8, dy - 13 + Math.sin(a) * 8); g.lineTo(dx + Math.cos(a) * 10.5, dy - 13 + Math.sin(a) * 10.5); g.stroke(); }
    g.fillStyle = '#f0f0e0'; g.beginPath(); g.arc(dx, dy + 13, 6, 0, 7); g.fill(); g.fillStyle = '#1d2a52'; g.beginPath(); g.arc(dx + 3, dy + 11.5, 5, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; for (const [sx, sy] of [[-14, 8], [12, 6], [-8, 18], [16, 16]]) g.fillRect(dx + sx, dy + sy, 1.3, 1.3);
    g.restore();
    g.strokeStyle = GOLD_D; g.lineWidth = 2; g.beginPath(); g.arc(dx, dy, R, 0, 7); g.stroke();
    const an = dialAngle() - Math.PI / 2;
    g.strokeStyle = GOLD; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx + Math.cos(an) * (R - 4), dy + Math.sin(an) * (R - 4)); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = GOLD; g.beginPath(); g.arc(dx, dy, 3, 0, 7); g.fill();
    if (lit()) { const gl = g.createRadialGradient(dx, dy, 4, dx, dy, 34); gl.addColorStop(0, 'rgba(255,220,140,0.25)'); gl.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = gl; g.beginPath(); g.arc(dx, dy, 34, 0, 7); g.fill(); }
    // the bronze bell in the belfry; it swings for two seconds when it rings
    const st = time - BELLST.swingT0, sw = st >= 0 && st < 2 ? Math.sin(st * 9) * 0.5 * (1 - st / 2) : 0;
    g.save(); g.translate(x + w / 2, belfry - 42); g.rotate(sw);
    g.fillStyle = '#5a3c22'; g.fillRect(-14, -2, 28, 4);
    g.fillStyle = '#b07a3a'; g.beginPath(); g.moveTo(-11, 26); g.quadraticCurveTo(-11, 6, 0, 4); g.quadraticCurveTo(11, 6, 11, 26); g.closePath(); g.fill();
    g.fillStyle = '#d9a75a'; g.fillRect(-12, 25, 24, 3); g.fillStyle = 'rgba(255,240,200,0.4)'; g.fillRect(-6, 9, 3, 15);
    g.fillStyle = '#6a4a22'; g.beginPath(); g.arc(sw * 6, 29, 2.5, 0, 7); g.fill();
    g.restore();
    // the rope down the south face
    g.strokeStyle = '#c9a36a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + w / 2 + 14, belfry - 14); g.lineTo(x + w / 2 + 14 + sw * 4, belfry + 26); g.stroke();
    pennant(g, x + w / 2 + 1, belfry - 118, 26);
  }

  // ---------- Castle Thistledown ----------
  const CW_SIDE = (x, y) => y === CASTLE.y ? 'N' : y === CASTLE.y + CASTLE.h - 1 ? 'S' : x === CASTLE.x ? 'W' : x === CASTLE.x + CASTLE.w - 1 ? 'E' : null;
  function paintCastleWallH(g, side, v) {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 46, 48, 6);
    g.fillStyle = '#8a8d94'; g.fillRect(0, 12, 48, 36);
    for (let r = 0; r < 3; r++) { const yy = 13 + r * 12, off = (r + v) % 2 ? 12 : 0; for (let c = -1; c < 3; c++) { g.fillStyle = ['#a4a8ae', '#9a9ea5', '#aeb2b8'][(r + c + 3) % 3]; g.fillRect(off + c * 24 + 1, yy, 22, 11); } }
    const sh = g.createLinearGradient(0, 12, 0, 48); sh.addColorStop(0, 'rgba(255,255,255,0.1)'); sh.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = sh; g.fillRect(0, 12, 48, 36);
    g.fillStyle = '#c3c7cc'; g.fillRect(0, 0, 48, 12); g.fillStyle = '#d6d9dd'; g.fillRect(0, 0, 48, 2.5); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 11, 48, 1.5);
    g.fillStyle = PURPLE; g.fillRect(0, 14, 48, 2);
    for (let k = 0; k < 4; k += 2) {
      const mx = k * 12 + (v ? 12 : 0);
      if (side === 'N') { g.fillStyle = '#a4a8ae'; g.fillRect(mx, -12, 12, 13); g.fillStyle = '#d6d9dd'; g.fillRect(mx, -12, 12, 2.5); }
      else { g.fillStyle = '#a4a8ae'; g.fillRect(mx, 0, 12, 14); g.fillStyle = '#d6d9dd'; g.fillRect(mx, 0, 12, 2.5); }
    }
  }
  function paintCastleWallV(g, side) {
    const outer = side === 'W' ? 0 : 40;
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(side === 'W' ? 44 : -4, 0, 8, 48);
    g.fillStyle = '#8a8d94'; g.fillRect(0, 0, 48, 48); g.fillStyle = '#c3c7cc'; g.fillRect(8, 0, 32, 48);
    g.fillStyle = 'rgba(70,70,75,0.3)'; for (let r = 0; r < 4; r++) g.fillRect(8, r * 12 + 11, 32, 1);
    for (let k = 0; k < 4; k += 2) { const my = k * 12; g.fillStyle = '#a4a8ae'; g.fillRect(outer, my, 8, 12); g.fillStyle = '#d6d9dd'; g.fillRect(outer, my, 8, 2.5); }
    g.fillStyle = '#7a7d84'; g.fillRect(outer, 12, 8, 12); g.fillRect(outer, 36, 8, 12);
  }
  function drawCastleWall(g, x, y) {
    const side = CW_SIDE(x, y); if (!side) return;
    if (side === 'N' || side === 'S') blit(g, sprite('cwH' + side + (x % 2), 48, 64, 0, 14, cg => paintCastleWallH(cg, side, x % 2)), x * TILE, y * TILE);
    else blit(g, sprite('cwV' + side, 56, 48, side === 'E' ? 8 : 0, 0, cg => paintCastleWallV(cg, side)), x * TILE, y * TILE);
  }
  // the castle's own round towers: pale stone, purple cones
  function paintCastleTower(g, R, base, rim, apex) {
    const ry = R * 0.34;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(6, base + 4, R + 8, ry + 4, 0, 0, 7); g.fill();
    const body = g.createLinearGradient(-R, 0, R, 0); body.addColorStop(0, '#74777e'); body.addColorStop(0.32, '#c3c7cc'); body.addColorStop(0.7, '#a4a8ae'); body.addColorStop(1, '#6a6d74');
    g.fillStyle = body; g.beginPath(); g.moveTo(-R, rim); g.lineTo(-R, base); g.ellipse(0, base, R, ry, 0, Math.PI, 0, true); g.lineTo(R, rim); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,60,65,0.3)'; g.lineWidth = 1; for (let yy = base - 10; yy > rim + 6; yy -= 10) { g.beginPath(); g.ellipse(0, yy, R, ry, 0, 0.05, Math.PI - 0.05); g.stroke(); }
    g.fillStyle = '#23262c'; roundRect(g, -2.5, (base + rim) / 2 - 8, 5, 16, 2); g.fill();
    g.fillStyle = PURPLE; g.beginPath(); g.ellipse(0, rim + 10, R + 0.5, ry, 0, 0, Math.PI); g.lineTo(-R - 0.5, rim + 7); g.ellipse(0, rim + 7, R + 0.5, ry, 0, Math.PI, 0, true); g.closePath(); g.fill();
    g.fillStyle = '#c3c7cc'; g.beginPath(); g.ellipse(0, rim, R + 3, ry + 2, 0, 0, 7); g.fill(); g.fillStyle = '#8a8d94'; g.beginPath(); g.ellipse(0, rim, R - 4, ry - 2, 0, 0, 7); g.fill();
    for (let k = 0; k < 8; k++) { const a = Math.PI * (0.06 + k * 0.125), mx = Math.cos(a) * (R + 1), my = rim + Math.sin(a) * (ry + 1); g.fillStyle = '#a4a8ae'; g.fillRect(mx - 4, my - 9, 8, 9); g.fillStyle = '#d6d9dd'; g.fillRect(mx - 4, my - 9, 8, 2); }
    const cone = g.createLinearGradient(-R, 0, R, 0); cone.addColorStop(0, PURPLE_D); cone.addColorStop(0.38, PURPLE_L); cone.addColorStop(0.7, PURPLE); cone.addColorStop(1, '#341848');
    g.fillStyle = cone; g.beginPath(); g.moveTo(-R + 4, rim - 3); g.lineTo(0, apex); g.lineTo(R - 4, rim - 3); g.ellipse(0, rim - 3, R - 4, ry - 3, 0, 0, Math.PI); g.closePath(); g.fill();
    g.fillStyle = GOLD; g.beginPath(); g.ellipse(0, rim - 3, R - 3, ry - 2.5, 0, 0, Math.PI); g.lineTo(-R + 3, rim - 1); g.ellipse(0, rim - 1, R - 3, ry - 2.5, 0, Math.PI, 0, true); g.closePath(); g.fill();
    g.fillStyle = GOLD; g.beginPath(); g.arc(0, apex - 3, 3.5, 0, 7); g.fill(); g.fillRect(-1, apex - 14, 2, 11);
  }
  const CASTLE_GATE_TOWERS = [{ cx: TD.x(110) * TILE, cy: TD.y(42.5) * TILE }, { cx: TD.x(114) * TILE, cy: TD.y(42.5) * TILE }];
  const TURRETS = [{ cx: tc(TD.x(104)), cy: tc(TD.y(48)) }, { cx: tc(TD.x(121)), cy: tc(TD.y(48)) }];
  function drawCastleGateTower(g, t, i) {
    blit(g, sprite('ctower-gate', 90, 150, 45, 116, cg => paintCastleTower(cg, 30, 22, -26, -86)), t.cx, t.cy);
    hangBanner(g, t.cx, t.cy - 18, 34, 15, i + 3);
    pennant(g, t.cx + 1, t.cy - 86 - 14, 22, GOLD);
    STATS.towers++;
  }
  function drawTurret(g, t) { blit(g, sprite('ctower-turret', 66, 110, 33, 84, cg => paintCastleTower(cg, 21, 18, -18, -66)), t.cx, t.cy); STATS.towers++; }
  // the castle's corner towers: the core's drawTower, wrapped (larger, with a gold pennant); an instance keeps the core's
  // The two at the back of the castle (its north side, by the moat) stand right under the Tinker's Workshop and house h1,
  // so they are squat: nothing of them rises over row 41, the moat, and their pennants fly outward (the NW one west).
  // The two at the front (south) are tall. Each draw records its box for C19.
  // top: the highest drawn pixel over the tower's centre (the pennant's crest)
  const CORNER = { north: { R: 32, base: 22, rim: -18, apex: -52, top: -72 }, south: { R: 32, base: 22, rim: -30, apex: -96, top: -117 } };
  const cornerTop = d => d.top;
  { const _drawTower = drawTower;
    drawTower = function (g, cx, cy) {
      if (away()) return _drawTower(g, cx, cy);
      const north = cy < tc(CASTLE.y + 1), d = north ? CORNER.north : CORNER.south, west = cx < tc(CASTLE.x + 1);
      blit(g, sprite(north ? 'ctower-corner-n' : 'ctower-corner', 100, 40 - cornerTop(d), 50, -cornerTop(d), cg => paintCastleTower(cg, d.R, d.base, d.rim, d.apex)), cx, cy);
      // the pennant on the finial's pole (it reaches 6.5 px over its anchor), flying outward from the castle
      pennant(g, cx + (west ? -1 : 1), cy + d.apex - (north ? 12 : 14), west ? -26 : 26, GOLD);
      if (STATS.record) STATS.boxes.push({ x0: cx - 50, y0: cy + cornerTop(d), x1: cx + 50, y1: cy + 40, own: 'castle', y: cy + TILE / 2 });
      STATS.towers++;
    };
  }
  // the portcullis between the castle's gate towers, raised, under a stone lintel
  function drawCastleArch(g) {
    const x = TD.x(111) * TILE, y = TD.y(42) * TILE;
    const near = Math.floor(player.x / TILE) >= TD.x(110) && Math.floor(player.x / TILE) <= TD.x(113) && Math.floor(player.y / TILE) >= TD.y(41) && Math.floor(player.y / TILE) <= TD.y(43);
    g.save(); g.globalAlpha = near ? 0.3 : 1;
    g.fillStyle = '#c3c7cc'; g.fillRect(x - 2, y - 18, 100, 14); g.fillStyle = '#d6d9dd'; g.fillRect(x - 2, y - 18, 100, 2.5);
    g.fillStyle = '#8a8d94'; g.fillRect(x - 2, y - 4, 100, 8);
    g.fillStyle = '#2a2d33'; for (let k = 0; k < 13; k++) { const tx = x + 2 + k * 7.3; g.beginPath(); g.moveTo(tx, y + 4); g.lineTo(tx + 3, y + 11); g.lineTo(tx + 6, y + 4); g.closePath(); g.fill(); }
    arms(g, x + 48, y - 11, 18);
    g.restore();
  }
  // the drawbridge's two chains, up to the gate towers
  function drawChains(g) {
    for (const [ax, tx] of [[TD.x(111) * TILE + 5, TD.x(110) * TILE + 24], [TD.x(113) * TILE - 5, TD.x(114) * TILE - 24]]) {
      const ay = TD.y(41) * TILE + 5, ty = TD.y(42.5) * TILE - 46;
      g.strokeStyle = '#2a2d33'; g.lineWidth = 1.6;
      const n = 9; for (let k = 0; k < n; k++) { const u = (k + 0.5) / n, x = lerp(ax, tx, u), y = lerp(ay, ty, u) + Math.sin(u * Math.PI) * 6; g.beginPath(); g.ellipse(x, y, k % 2 ? 1.6 : 2.6, k % 2 ? 2.6 : 1.6, Math.atan2(ty - ay, tx - ax), 0, 7); g.stroke(); }
    }
  }
  // lily pads on the moat, bobbing
  const LILIES = [];
  for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) if (glyph(x, y) === '~' && !(x >= PLAN.POND.x0 && x <= PLAN.POND.x1 && y >= PLAN.POND.y0 && y <= PLAN.POND.y1) && hash(TD.ix(x) * 7, TD.iy(y) * 11) < 0.32) LILIES.push([x, y, hash(x, y * 3)]);
  function drawLily(g, x, y, h0) {
    const lx = x * TILE + 12 + h0 * 24, ly = y * TILE + 14 + hash(TD.iy(y), TD.ix(x)) * 20, bob = Math.sin(time * 1.2 + h0 * 9) * 1.2;
    g.fillStyle = '#3f8a3a'; g.beginPath(); g.moveTo(lx, ly + bob); g.arc(lx, ly + bob, 8, 0.35, Math.PI * 2 - 0.1); g.closePath(); g.fill();
    g.fillStyle = 'rgba(160,220,120,0.45)'; g.beginPath(); g.arc(lx - 2, ly + bob - 2, 3.5, 0, 7); g.fill();
    if (h0 > 0.6) { g.fillStyle = '#ffd0e0'; for (let q = 0; q < 5; q++) { const a = q / 5 * Math.PI * 2; g.beginPath(); g.ellipse(lx + Math.cos(a) * 2.6, ly + bob - 2 + Math.sin(a) * 1.7, 2.6, 1.5, a, 0, 7); g.fill(); } g.fillStyle = '#ffe066'; g.beginPath(); g.arc(lx, ly + bob - 2, 1.3, 0, 7); g.fill(); }
  }

  // ---------- Swan Pond: the boat, the swans and the ducklings ----------
  function drawBoat(g) {
    const [bx, by] = PLAN.POND.boat, cx = tc(bx), cy = (by + 1) * TILE, bob = Math.sin(time * 1.4) * 1.5, tilt = Math.sin(time * 1.1) * 0.04;
    g.save(); g.translate(cx, cy + bob); g.rotate(tilt);
    g.fillStyle = 'rgba(0,30,60,0.25)'; g.beginPath(); g.ellipse(3, 4, 18, 44, 0, 0, 7); g.fill();
    g.fillStyle = '#6b4a2a'; g.beginPath(); g.moveTo(0, -44); g.quadraticCurveTo(18, -30, 16, 20); g.quadraticCurveTo(12, 40, 0, 42); g.quadraticCurveTo(-12, 40, -16, 20); g.quadraticCurveTo(-18, -30, 0, -44); g.closePath(); g.fill();
    g.fillStyle = '#9c7444'; g.beginPath(); g.moveTo(0, -38); g.quadraticCurveTo(13, -26, 11, 18); g.quadraticCurveTo(8, 34, 0, 36); g.quadraticCurveTo(-8, 34, -11, 18); g.quadraticCurveTo(-13, -26, 0, -38); g.closePath(); g.fill();
    g.fillStyle = '#5a3c22'; g.fillRect(-11, -10, 22, 4); g.fillRect(-10, 14, 20, 4);
    g.strokeStyle = '#c9a36a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-30, 8); g.moveTo(12, 0); g.lineTo(30, -4); g.stroke();
    g.restore();
    // the mooring rope to the jetty
    g.strokeStyle = '#c9a36a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, cy - 40 + bob); g.quadraticCurveTo(cx + 4, cy - 46, cx + 2, PLAN.POND.jetty[1] * TILE + 40); g.stroke();
  }
  // the two swans loop slowly, each its own side of the footbridge; four ducklings follow the east one
  function loopOf(L) { return { cx: (L.x0 + L.x1 + 1) / 2 * TILE, cy: (L.y0 + L.y1 + 1) / 2 * TILE, rx: Math.max(8, (L.x1 - L.x0 + 1) * TILE / 2 - 16), ry: (L.y1 - L.y0 + 1) * TILE / 2 - 18 }; }
  const SWAN_LOOPS = PLAN.POND.swans.map(loopOf);
  function swanAt(i, ms, lagS) { const L = SWAN_LOOPS[i], per = i ? 46 : 38, a = ((ms / 1000 - (lagS || 0)) / per) * Math.PI * 2 * (i ? 1 : -1) + i * 2.1; return { x: L.cx + Math.cos(a) * L.rx, y: L.cy + Math.sin(a) * L.ry, dx: -Math.sin(a) * L.rx * (i ? 1 : -1), dy: Math.cos(a) * L.ry * (i ? 1 : -1) }; }
  function drawSwan(g, p, s) {
    const face = p.dx >= 0 ? 1 : -1;
    g.save(); g.translate(p.x, p.y); g.scale(face * s, s);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(0, 6, 15, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#f7f6f0'; g.beginPath(); g.ellipse(-2, 0, 13, 7.5, 0, 0, 7); g.fill();
    g.fillStyle = '#e4e1d6'; g.beginPath(); g.ellipse(-5, -2, 8, 4.5, -0.2, 0, 7); g.fill();
    g.strokeStyle = '#f7f6f0'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(7, -1); g.quadraticCurveTo(14, -6, 9, -14); g.quadraticCurveTo(7, -19, 11, -19); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = '#e8702a'; g.beginPath(); g.moveTo(12, -20); g.lineTo(17, -18); g.lineTo(12, -17); g.closePath(); g.fill();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(11, -19.5, 0.9, 0, 7); g.fill();
    g.restore();
  }
  function drawDuckling(g, p) { g.fillStyle = '#e8c860'; g.beginPath(); g.ellipse(p.x, p.y, 4.5, 3, 0, 0, 7); g.fill(); g.beginPath(); g.arc(p.x + (p.dx >= 0 ? 3 : -3), p.y - 3, 2.4, 0, 7); g.fill(); g.fillStyle = '#e8702a'; g.fillRect(p.x + (p.dx >= 0 ? 5 : -7), p.y - 3.5, 2, 1.2); }

  // ---------- the small folk ----------
  function drawCat(g, x, y, running, t) {
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(0, 4, 9, 3, 0, 0, 7); g.fill();
    if (running) {
      const leg = Math.sin(t * 22) * 3;
      g.fillStyle = '#8a8d94'; g.beginPath(); g.ellipse(0, -4, 10, 4.5, 0, 0, 7); g.fill();
      g.fillRect(-7, -2, 2.5, 5 + leg); g.fillRect(5, -2, 2.5, 5 - leg);
      g.beginPath(); g.arc(9, -8, 4.2, 0, 7); g.fill(); g.beginPath(); g.moveTo(7, -11); g.lineTo(8.5, -15); g.lineTo(10, -11); g.moveTo(10, -11); g.lineTo(12, -14.5); g.lineTo(12.5, -10); g.fill();
      g.strokeStyle = '#8a8d94'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-9, -5); g.quadraticCurveTo(-16, -12, -14, -16); g.stroke();
      g.fillStyle = PURPLE; g.fillRect(6, -6, 5, 2);
    } else {
      // sitting, tail curled round her feet, a purple collar
      g.fillStyle = '#8a8d94'; g.beginPath(); g.ellipse(0, -5, 7.5, 8, 0, 0, 7); g.fill();
      g.beginPath(); g.arc(0, -15, 5.2, 0, 7); g.fill();
      g.beginPath(); g.moveTo(-4.5, -18); g.lineTo(-3.5, -23); g.lineTo(-1, -19); g.moveTo(1, -19); g.lineTo(3.5, -23); g.lineTo(4.5, -18); g.fill();
      g.strokeStyle = '#8a8d94'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(5, 1); g.quadraticCurveTo(12, 2, 9, -6 + Math.sin(time * 1.5) * 1.5); g.stroke();
      g.fillStyle = '#b8bbc2'; g.beginPath(); g.ellipse(0, -3, 3.5, 4.5, 0, 0, 7); g.fill();
      g.fillStyle = PURPLE; g.fillRect(-4, -11.5, 8, 2);
      g.fillStyle = '#7ad04a'; g.beginPath(); g.arc(-2, -15.5, 0.9, 0, 7); g.arc(2, -15.5, 0.9, 0, 7); g.fill();
    }
    g.restore();
  }
  function drawKid(g, k) {
    const e = { x: 0, y: 0, r: 13, facing: { x: k.dx, y: k.dy }, hurtT: 0, attackT: 0, moving: true, walkT: time * 12 };
    // the new look (83-townsfolk): a child's own build, step and shadow, so no scale, bob or shadow here
    if (window.TOWNSFOLK && TOWNSFOLK.put(g, k.px, k.py, Object.assign(e, { x: k.px, y: k.py }), k.look)) return;
    const bob = Math.abs(Math.sin(time * 10 + (k.lag || 0))) * 2;
    g.save(); g.translate(k.px, k.py - 4 - bob); g.scale(0.72, 0.72);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(0, 14 + bob, 11, 4.5, 0, 0, 7); g.fill();
    drawHuman(g, e, k.look);
    g.restore();
  }
  function drawBunting(g, a, b) {
    const top = (p) => { const [x, y] = p; return { x: tc(x), y: (y + 1) * TILE - 6 - lampH(x, y) + 6 }; };
    const p0 = top(a), p1 = top(b), sag = 22 + Math.sin(time * 1.3 + p0.x * 0.01) * 2;
    const pt = u => ({ x: lerp(p0.x, p1.x, u), y: lerp(p0.y, p1.y, u) + Math.sin(u * Math.PI) * sag });
    g.strokeStyle = '#3d2a1a'; g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k <= 16; k++) { const p = pt(k / 16); if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); } g.stroke();
    const n = Math.max(5, Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y) / 14)), cols = [PURPLE, GOLD, '#f6f1e6'];
    for (let k = 1; k < n; k++) { const p = pt(k / n), sw = Math.sin(time * 3 + k) * 1.8; g.fillStyle = cols[k % 3]; g.beginPath(); g.moveTo(p.x - 5, p.y); g.lineTo(p.x + 5, p.y); g.lineTo(p.x + sw, p.y + 11); g.closePath(); g.fill(); }
  }

  // ---------- the town's buildings (drawBuilding is wrapped: a town building draws itself here) ----------
  const hex2 = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const shade = (h, k) => { const [r, g2, b] = hex2(h); const f = v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return `rgb(${f(r)},${f(g2)},${f(b)})`; };
  const BIG = new Set(['store', 'bank', 'bakery', 'smithy', 'workshop', 'inn']);
  const STONE_FRONT = new Set(['bank', 'smithy']);
  const SMOKE = new Set(['bakery', 'smithy', 'inn']);
  // how far a building's art rises over its footprint (smoke from a chimney; the keep's two front turrets)
  const riseOf = b => b.id === 'keep' ? 60 : SMOKE.has(b.id) ? 64 : 0;
  function stoneWall(g, x, y, w, h) {
    g.fillStyle = '#8a8d94'; g.fillRect(x, y, w, h);
    for (let r = 0; r * 12 < h; r++) { const yy = y + r * 12, off = r % 2 ? 12 : 0; for (let c = -1; c * 24 < w + 24; c++) { const xx = x + off + c * 24; const x0 = Math.max(x, xx + 1), x1 = Math.min(x + w, xx + 23); if (x1 > x0) { g.fillStyle = ['#9ca0a7', '#a6aab0', '#92969d'][(r + c + 9) % 3]; g.fillRect(x0, yy + 1, x1 - x0, Math.min(10, y + h - yy - 1)); } } }
    const sh = g.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = sh; g.fillRect(x, y, w, h);
  }
  // the castle's pale stone (the keep, its tower), a shade lighter than the town's grey
  function paleWall(g, x, y, w, h) {
    g.fillStyle = '#8a8d94'; g.fillRect(x, y, w, h);
    for (let r = 0; r * 12 < h; r++) { const yy = y + r * 12, off = r % 2 ? 12 : 0; for (let c = -1; c * 24 < w + 24; c++) { const xx = x + off + c * 24; const x0 = Math.max(x, xx + 1), x1 = Math.min(x + w, xx + 23); if (x1 > x0) { g.fillStyle = ['#b9bcc2', '#aeb2b8', '#c3c6cb'][(r + c + 9) % 3]; g.fillRect(x0, yy + 1, x1 - x0, Math.min(10, y + h - yy - 1)); } } }
    const sh = g.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = sh; g.fillRect(x, y, w, h);
  }
  function plasterWall(g, x, y, w, h) {
    g.fillStyle = '#efe4cc'; g.fillRect(x, y, w, h);
    g.fillStyle = '#6b4a2a'; g.fillRect(x, y, w, 5); g.fillRect(x, y + h - 6, w, 6);
    for (let c = 0; c <= Math.floor(w / 48); c++) g.fillRect(Math.min(x + w - 5, x + c * 48), y, 5, h);
    // the timber braces in each bay
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 3.5;
    for (let c = 0; c < Math.floor(w / 48); c++) { const bx = x + c * 48; if ((c + Math.floor(x / 48)) % 2) { g.beginPath(); g.moveTo(bx + 5, y + h - 6); g.lineTo(bx + 16, y + 5); g.stroke(); } }
    const sh = g.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,255,255,0.1)'); sh.addColorStop(1, 'rgba(60,40,20,0.16)'); g.fillStyle = sh; g.fillRect(x, y, w, h);
  }
  function windowAt(g, cx, top, w, h, box, lit0) {
    g.fillStyle = '#5a3c22'; g.fillRect(cx - w / 2 - 3, top - 3, w + 6, h + 6);
    if (lit0) { const gl = g.createLinearGradient(0, top, 0, top + h); gl.addColorStop(0, '#ffe7a0'); gl.addColorStop(1, '#f5b24a'); g.fillStyle = gl; }
    else { const gl = g.createLinearGradient(0, top, 0, top + h); gl.addColorStop(0, '#9fc3dc'); gl.addColorStop(1, '#4f6d88'); g.fillStyle = gl; }
    g.fillRect(cx - w / 2, top, w, h);
    if (!lit0) { g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(cx - w / 2 + 2, top + h - 3); g.lineTo(cx - w / 2 + 2, top + 2); g.lineTo(cx - w / 2 + 6, top + 2); g.closePath(); g.fill(); }
    g.fillStyle = '#5a3c22'; g.fillRect(cx - 1, top, 2, h); g.fillRect(cx - w / 2, top + h / 2 - 1, w, 2);
    g.fillStyle = '#c9b48a'; g.fillRect(cx - w / 2 - 4, top + h + 2, w + 8, 3);
    if (box) {
      g.fillStyle = '#7d5832'; g.fillRect(cx - w / 2 - 3, top + h + 4, w + 6, 6);
      const cols = ['#e0506a', '#f5c542', '#ffffff', '#b07ad8'];
      for (let k = 0; k < 4; k++) { const fx = cx - w / 2 - 1 + k * (w + 2) / 3; g.fillStyle = '#3f8a3a'; g.beginPath(); g.arc(fx, top + h + 3, 3, 0, 7); g.fill(); g.fillStyle = cols[(k + Math.floor(cx / 48)) % 4]; g.beginPath(); g.arc(fx, top + h + 1, 2.2, 0, 7); g.fill(); }
    }
  }
  function woodDoor(g, cx, bottom, w, h) {
    g.fillStyle = '#4a3420'; g.beginPath(); g.moveTo(cx - w / 2 - 3, bottom); g.lineTo(cx - w / 2 - 3, bottom - h + w / 2); g.arc(cx, bottom - h + w / 2, w / 2 + 3, Math.PI, 0); g.lineTo(cx + w / 2 + 3, bottom); g.closePath(); g.fill();
    g.fillStyle = '#7d5832'; g.beginPath(); g.moveTo(cx - w / 2, bottom); g.lineTo(cx - w / 2, bottom - h + w / 2); g.arc(cx, bottom - h + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, bottom); g.closePath(); g.fill();
    g.fillStyle = 'rgba(40,24,12,0.45)'; for (let k = 1; k < 3; k++) g.fillRect(cx - w / 2 + k * w / 3 - 0.6, bottom - h + w / 2, 1.2, h - w / 2);
    g.fillStyle = '#2a2d33'; g.fillRect(cx - w / 2, bottom - h * 0.7, w, 2.5); g.fillRect(cx - w / 2, bottom - h * 0.3, w, 2.5);
    g.fillStyle = GOLD; g.beginPath(); g.arc(cx + w / 4, bottom - h * 0.45, 1.8, 0, 7); g.fill();
  }
  // a hipped roof from `top` (the back) to `eave` (the front), its ridge running east-west, tiles or slates in rows
  function hipRoof(g, x, top, w, eave, col) {
    const d = eave - top, inset = Math.min(w * 0.3, d * 0.55), ridge = top + d * 0.38;
    g.fillStyle = shade(col, -0.32); g.beginPath(); g.moveTo(x - 4, top); g.lineTo(x + w + 4, top); g.lineTo(x + w - inset, ridge); g.lineTo(x + inset, ridge); g.closePath(); g.fill();
    g.fillStyle = shade(col, -0.14); g.beginPath(); g.moveTo(x - 4, top); g.lineTo(x + inset, ridge); g.lineTo(x - 4, eave + 4); g.closePath(); g.fill();
    g.fillStyle = shade(col, -0.4); g.beginPath(); g.moveTo(x + w + 4, top); g.lineTo(x + w - inset, ridge); g.lineTo(x + w + 4, eave + 4); g.closePath(); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(x + inset, ridge); g.lineTo(x + w - inset, ridge); g.lineTo(x + w + 4, eave + 4); g.lineTo(x - 4, eave + 4); g.closePath(); g.fill();
    g.save(); g.beginPath(); g.moveTo(x + inset, ridge); g.lineTo(x + w - inset, ridge); g.lineTo(x + w + 4, eave + 4); g.lineTo(x - 4, eave + 4); g.closePath(); g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1;
    for (let yy = ridge + 7, r = 0; yy < eave + 4; yy += 7, r++) { g.beginPath(); g.moveTo(x - 4, yy); g.lineTo(x + w + 4, yy); g.stroke(); for (let xx = x - 4 + (r % 2) * 6; xx < x + w + 4; xx += 12) { g.beginPath(); g.moveTo(xx, yy - 7); g.lineTo(xx, yy); g.stroke(); } }
    g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x - 4, ridge, w + 8, (eave - ridge) * 0.3);
    g.restore();
    g.fillStyle = shade(col, -0.5); g.fillRect(x + inset, ridge - 2, w - inset * 2, 4);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 4, eave + 4, w + 8, 4);
    return { ridge, inset };
  }
  function smoke(g, x, y, warm) {
    for (let k = 0; k < 5; k++) { const ph = fr(time * 0.32 + k / 5); g.fillStyle = warm ? `rgba(200,195,190,${(0.6 * (1 - ph)).toFixed(3)})` : `rgba(230,230,230,${(0.55 * (1 - ph)).toFixed(3)})`; g.beginPath(); g.arc(x + Math.sin(ph * 5 + k) * 5 + ph * 10, y - ph * 56, 4 + ph * 10, 0, 7); g.fill(); }
  }
  function sparks(g, x, y) { for (let k = 0; k < 7; k++) { const h0 = hash(k, 3), ph = fr(time * (0.9 + h0) + h0); g.fillStyle = `rgba(255,${150 + Math.floor(h0 * 80)},60,${(1 - ph).toFixed(3)})`; g.fillRect(x - 6 + h0 * 12 + Math.sin(ph * 9 + k) * 4, y - ph * 40, 2, 2); } }
  function chimney(g, cx, top, stone) { g.fillStyle = stone ? '#7d8087' : '#8a5a3a'; g.fillRect(cx - 7, top, 14, 18); g.fillStyle = stone ? '#9aa0a8' : '#a5704a'; g.fillRect(cx - 9, top - 2, 18, 4); g.fillStyle = '#2a2018'; g.fillRect(cx - 5, top - 2, 10, 2); }
  // the iron bracket sign: an arm from the wall and a board hanging from it, with a drawn icon
  function bracketSign(g, x, y, icon, dir) {
    const d = dir || 1, sw = Math.sin(time * 1.7 + x * 0.03) * 0.07;
    g.fillStyle = '#1f2126'; g.fillRect(x, y - 2, 4, 6); g.fillRect(x, y, d * 26, 2.4);
    g.strokeStyle = '#1f2126'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 2, y + 10); g.quadraticCurveTo(x + d * 8, y + 2, x + d * 18, y + 1); g.stroke();
    g.save(); g.translate(x + d * 16, y + 3); g.rotate(sw);
    g.strokeStyle = '#1f2126'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, 0); g.lineTo(-6, 4); g.moveTo(6, 0); g.lineTo(6, 4); g.stroke();
    g.fillStyle = '#3d2a1a'; roundRect(g, -11, 4, 22, 20, 3); g.fill(); g.strokeStyle = GOLD_D; g.lineWidth = 1.2; g.stroke();
    g.save(); g.translate(0, 14); icon(g); g.restore();
    g.restore();
  }
  const ICON = {
    store: g => { g.fillStyle = '#a5763f'; g.fillRect(-7, -4, 8, 8); g.strokeStyle = '#5a3c22'; g.lineWidth = 1; g.strokeRect(-7, -4, 8, 8); g.beginPath(); g.moveTo(-7, -4); g.lineTo(1, 4); g.stroke(); g.fillStyle = '#d9c9a0'; g.beginPath(); g.moveTo(2, 5); g.quadraticCurveTo(1, -3, 5, -5); g.quadraticCurveTo(9, -3, 8, 5); g.closePath(); g.fill(); },
    bank: g => { g.fillStyle = '#c9a02a'; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill(); g.fillStyle = GOLD; g.beginPath(); g.arc(0, 0, 5.5, 0, 7); g.fill(); g.fillStyle = '#9a7a1a'; g.font = `800 7px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('T', 0, 0.5); g.textBaseline = 'alphabetic'; },
    bakery: g => { g.fillStyle = '#d9a04a'; g.beginPath(); g.ellipse(0, 0, 8, 5, 0, 0, 7); g.fill(); g.strokeStyle = '#8a5a2b'; g.lineWidth = 1; for (const k of [-3, 0, 3]) { g.beginPath(); g.moveTo(k - 1.5, -3); g.lineTo(k + 1.5, 2); g.stroke(); } },
    smithy: g => { g.fillStyle = '#9aa0a8'; g.beginPath(); g.moveTo(-8, -3); g.lineTo(6, -3); g.lineTo(9, -1); g.lineTo(5, 0); g.lineTo(3, 2); g.lineTo(-3, 2); g.lineTo(-5, 0); g.closePath(); g.fill(); g.fillRect(-3, 2, 6, 5); g.fillRect(-6, 6, 12, 2); },
    workshop: g => { g.fillStyle = '#d9a75a'; g.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, r = k % 2 ? 5.2 : 7.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.fillStyle = '#3d2a1a'; g.beginPath(); g.arc(0, 0, 2.4, 0, 7); g.fill(); },
    inn: g => { g.fillStyle = '#7d5832'; g.beginPath(); g.ellipse(-2, 3, 6, 4.5, 0, 0, 7); g.fill(); g.strokeStyle = '#2a2d33'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(-2, 3, 6, 4.5, 0, 0, 7); g.stroke(); g.fillStyle = '#e8c86a'; g.fillRect(1, -7, 7, 8); g.fillStyle = '#ffffff'; g.fillRect(1, -8, 7, 2.5); g.strokeStyle = '#e8c86a'; g.lineWidth = 1.2; g.beginPath(); g.arc(8.5, -3, 2.2, -1.2, 1.2); g.stroke(); },
  };
  function wordPlate(g, cx, y, word) {
    g.font = `700 9px ${DISPLAY}`; const w = Math.max(44, g.measureText ? g.measureText(word).width + 14 : 60);
    g.fillStyle = '#efe2c4'; g.fillRect(cx - w / 2, y, w, 14); g.strokeStyle = '#5a3c22'; g.lineWidth = 1; g.strokeRect(cx - w / 2, y, w, 14);
    g.fillStyle = '#3a2a1a'; g.textAlign = 'center'; g.fillText(word, cx, y + 10.5);
  }
  // the keep's door on its north wall: its frame on the roof's back edge, a lantern either side (as the core does for the keep)
  function topDoor(g, b, x, y) {
    const dx = x + b.doorTop * TILE;
    if (still()) {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(dx + 6, y, 36, 26);
      g.fillStyle = b.stone ? '#8a8d94' : '#efe4cc'; g.fillRect(dx + 7, y, 34, 24);
      g.fillStyle = '#5a3a1e'; g.fillRect(dx + 12, y, 24, 18); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(dx + 23, y, 2, 18);
      g.fillStyle = b.stone ? '#a4a8ae' : '#c9b48a'; g.fillRect(dx + 8, y + 18, 32, 4);
      g.fillStyle = GOLD; g.beginPath(); g.arc(dx + 30, y + 9, 2, 0, 7); g.fill();
    }
    if (moving()) { drawLantern(g, dx + 4, y + 12); drawLantern(g, dx + 44, y + 12); }
  }
  // A house's or the inn's door on its north wall (h6, h7, the inn): a little porch that stands out over the step behind
  // the house (as Aerie's do), with its own gabled hood in the roof's colour, a door, a sill, a lantern either side and the
  // inn's sign. On the roof's back edge, where the door was, it read as a door on top of the roof from the street. The
  // porch is its own item, sorted at the step's middle (drawHook), so a knight standing on the step is drawn in front of it
  // and one behind it is hidden by it; it is not part of the building's cached picture.
  const PORCH_FOR = b => b.town && b.doorTop !== undefined && b.id !== 'keep';
  function drawPorch(g, b) {
    const cx = (b.x + b.doorTop) * TILE + 24, y = b.y * TILE, top = y - 20, roof = b.roof;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 20, y + 2, 40, 6);
    // the porch's front wall and its door, standing on the house's back edge
    g.fillStyle = b.stone ? '#8a8d94' : '#efe4cc'; g.fillRect(cx - 19, top, 38, 28);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(cx + 11, top, 8, 28);
    g.fillStyle = '#5a3a1e'; g.fillRect(cx - 11, top + 6, 22, 22); g.fillStyle = '#6e4826'; g.fillRect(cx - 11, top + 6, 22, 3);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 1, top + 9, 2, 19);
    g.fillStyle = GOLD; g.beginPath(); g.arc(cx + 6, top + 18, 1.8, 0, 7); g.fill();
    g.fillStyle = b.stone ? '#a4a8ae' : '#c9b48a'; g.fillRect(cx - 20, top + 27, 40, 3);
    // the hood: a little gable in the roof's colour, its eaves past the walls
    g.fillStyle = shade(roof, -0.18); g.beginPath(); g.moveTo(cx - 25, top + 4); g.lineTo(cx, top - 14); g.lineTo(cx + 25, top + 4); g.closePath(); g.fill();
    g.fillStyle = roof; g.beginPath(); g.moveTo(cx - 25, top + 4); g.lineTo(cx, top - 14); g.lineTo(cx, top - 8); g.lineTo(cx - 19, top + 5); g.closePath(); g.fill();
    g.fillStyle = shade(roof, -0.45); g.fillRect(cx - 25, top + 4, 50, 3);
    drawLantern(g, cx - 26, top + 16); drawLantern(g, cx + 26, top + 16);
    if (ICON[b.id]) bracketSign(g, cx + 30, top - 4, ICON[b.id], 1);
    STATS.porches++;
  }
  // BPASS: 0 draws a building whole; 1 only what never moves (cached once per building and per day or night, see
  // drawTownBuilding); 2 only what moves or flickers (smoke, sparks, lanterns, the swinging signs, the awning, banners)
  let BPASS = 0;
  const still = () => BPASS !== 2, moving = () => BPASS !== 1;
  function drawHall(g, b, x, y, w, h) {
    const big = BIG.has(b.id), stone = STONE_FRONT.has(b.id), FH = big ? 58 : 46, eave = y + h - FH, lit0 = lit();
    if (still()) {
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 6, y + h - 4, w, 8);
      if (stone) stoneWall(g, x, eave, w, FH); else plasterWall(g, x, eave, w, FH);
      // windows across the front (the door's bay has none)
      const doorC = b.door !== undefined ? b.door : -9;
      for (let c = 0; c < b.w; c++) {
        if (Math.abs(c - doorC) < 1) continue;
        if (!big && b.w <= 4 && c !== 0 && c !== b.w - 1 && Math.abs(c - doorC) <= 1) continue;
        windowAt(g, x + c * TILE + 24, eave + (big ? 12 : 10), big ? 16 : 14, big ? 20 : 16, !big || b.id === 'inn' || b.id === 'bakery', lit0);
      }
      const roofCol = b.id === 'bank' ? '#3a3f4a' : b.id === 'smithy' ? '#4a4f5a' : b.roof;
      hipRoof(g, x, y + 2, w, eave, roofCol);
    }
    // chimneys, standing on the back slope
    if (b.id !== 'bank') { const chx = b.id === 'smithy' ? x + 40 : x + w - 30; if (still()) chimney(g, chx, y + 6, b.id === 'smithy'); if (moving() && SMOKE.has(b.id)) { smoke(g, chx, y + 2, b.id === 'smithy'); if (b.id === 'smithy') sparks(g, chx, y + 2); } }
    if (b.door !== undefined) {
      const dcx = x + b.door * TILE + 24, bottom = y + h;
      if (b.id === 'bank' && still()) {
        // two stone columns and a pediment either side of the door
        for (const ox of [-28, 22]) { g.fillStyle = '#c3c7cc'; g.fillRect(dcx + ox, eave - 2, 6, FH); g.fillStyle = '#e1e3e6'; g.fillRect(dcx + ox, eave - 2, 2, FH); g.fillStyle = '#9aa0a8'; g.fillRect(dcx + ox - 2, eave - 4, 10, 4); g.fillRect(dcx + ox - 2, bottom - 4, 10, 4); }
        g.fillStyle = '#c3c7cc'; g.beginPath(); g.moveTo(dcx - 34, eave + 2); g.lineTo(dcx, eave - 12); g.lineTo(dcx + 34, eave + 2); g.closePath(); g.fill();
      }
      if (still()) woodDoor(g, dcx, bottom, big ? 24 : 20, big ? 38 : 32);
      if (moving()) { drawLantern(g, dcx - 19, bottom - 26); drawLantern(g, dcx + 19, bottom - 26); }
      if (b.id === 'store' && moving()) {
        // a striped awning over the door
        const top = bottom - (big ? 44 : 38), fl = Math.sin(time * 2 + x) * 0.8;
        for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#f6f1e6' : '#b8352b'; g.beginPath(); g.moveTo(dcx - 30 + k * 10, top); g.lineTo(dcx - 20 + k * 10, top); g.lineTo(dcx - 20 + k * 10, top + 12 + fl); g.lineTo(dcx - 30 + k * 10, top + 12 + fl); g.closePath(); g.fill(); g.beginPath(); g.arc(dcx - 25 + k * 10, top + 12 + fl, 5, 0, Math.PI); g.fill(); }
        g.fillStyle = '#5a3c22'; g.fillRect(dcx - 31, top - 2, 62, 3);
      }
      if (ICON[b.id] && moving()) bracketSign(g, dcx + 26, eave + 6, ICON[b.id], 1);
    }
    // (a door on the north wall is its porch, drawn on its own: drawPorch)
    if (b.sign && still()) wordPlate(g, x + w / 2 + (b.door !== undefined && Math.abs(b.door * TILE + 24 - w / 2) < 30 ? 60 : 0), eave - 18, b.sign);
  }
  // Death's House at the east end (death2): dark coursed stone, narrow arched windows with a violet glow, a steep slate
  // roof with a crow on the ridge, the coffin door between two violet lanterns, and the REST plate. It kept the core's flat
  // dark box beside the new roofed fronts and was the one building that looked unfinished.
  const DEATH_ID = 'death2';
  function deathStone(g, x, y, w, h) {
    g.fillStyle = '#34323b'; g.fillRect(x, y, w, h);
    for (let r = 0; r * 12 < h; r++) { const yy = y + r * 12, off = r % 2 ? 12 : 0; for (let c = -1; c * 24 < w + 24; c++) { const xx = x + off + c * 24; const x0 = Math.max(x, xx + 1), x1 = Math.min(x + w, xx + 23); if (x1 > x0) { g.fillStyle = ['#46434f', '#4d4a57', '#423f4a'][(r + c + 9) % 3]; g.fillRect(x0, yy + 1, x1 - x0, Math.min(10, y + h - yy - 1)); } } }
    const sh = g.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,255,255,0.06)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = sh; g.fillRect(x, y, w, h);
  }
  function drawDeathHouse(g, b, x, y, w, h) {
    const FH = 60, eave = y + h - FH, bottom = y + h, dcx = x + b.door * TILE + 24, glow = lit() ? 0.85 : 0.55;
    if (still()) {
      g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(x + 6, bottom - 4, w, 8);
      deathStone(g, x, eave, w, FH);
      // narrow arched windows, one each side of the door, a faint violet light inside
      for (const c of [0, 1, 4, 5]) {
        const cx = x + c * TILE + 24, top = eave + 12, ww = 12, hh = 26;
        g.fillStyle = '#25232b'; g.beginPath(); g.moveTo(cx - ww / 2 - 3, top + hh + 2); g.lineTo(cx - ww / 2 - 3, top + 4); g.arc(cx, top + 4, ww / 2 + 3, Math.PI, 0); g.lineTo(cx + ww / 2 + 3, top + hh + 2); g.closePath(); g.fill();
        g.fillStyle = `rgba(181,140,255,${glow.toFixed(2)})`; g.beginPath(); g.moveTo(cx - ww / 2, top + hh); g.lineTo(cx - ww / 2, top + 4); g.arc(cx, top + 4, ww / 2, Math.PI, 0); g.lineTo(cx + ww / 2, top + hh); g.closePath(); g.fill();
        g.fillStyle = '#25232b'; g.fillRect(cx - 1, top - 2, 2, hh + 2); g.fillRect(cx - ww / 2, top + 13, ww, 2);
        g.fillStyle = '#6a6774'; g.fillRect(cx - ww / 2 - 4, top + hh + 2, ww + 8, 3);
      }
      hipRoof(g, x, y + 2, w, eave, '#3a3644');
      // a crow on the ridge
      const rx = x + w * 0.62, ry = y + 2 + (eave - y - 2) * 0.38 - 2;
      g.fillStyle = '#141318'; g.beginPath(); g.ellipse(rx, ry - 6, 7, 5, -0.2, 0, 7); g.fill(); g.beginPath(); g.arc(rx + 6, ry - 11, 3.6, 0, 7); g.fill();
      g.beginPath(); g.moveTo(rx - 6, ry - 6); g.lineTo(rx - 13, ry - 2); g.lineTo(rx - 6, ry - 3); g.closePath(); g.fill();
      g.fillStyle = '#5a5560'; g.beginPath(); g.moveTo(rx + 9, ry - 11); g.lineTo(rx + 13, ry - 10); g.lineTo(rx + 9, ry - 9.5); g.closePath(); g.fill();
      g.fillStyle = '#c9b8ff'; g.fillRect(rx + 6.5, ry - 12.5, 1.4, 1.4);
      // the coffin door, silver-edged, and the step's dark stone
      g.fillStyle = '#2a2a33'; g.beginPath(); g.moveTo(dcx - 10, bottom - 40); g.lineTo(dcx + 10, bottom - 40); g.lineTo(dcx + 17, bottom - 28); g.lineTo(dcx + 12, bottom); g.lineTo(dcx - 12, bottom); g.lineTo(dcx - 17, bottom - 28); g.closePath(); g.fill();
      g.strokeStyle = '#8b8b9a'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#6a6a7a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(dcx, bottom - 34); g.lineTo(dcx, bottom - 6); g.moveTo(dcx - 9, bottom - 26); g.lineTo(dcx + 9, bottom - 26); g.stroke();
      // the REST plate over the door: dark, with the violet word
      g.font = `700 10px ${DISPLAY}`; g.fillStyle = '#2a2a33'; g.fillRect(dcx - 34, eave - 20, 68, 16); g.strokeStyle = '#8b8b9a'; g.lineWidth = 1; g.strokeRect(dcx - 34, eave - 20, 68, 16);
      g.fillStyle = '#b58cff'; g.textAlign = 'center'; g.fillText(b.sign || 'REST', dcx, eave - 8);
    }
    if (moving()) { drawLantern(g, dcx - 24, bottom - 22, true); drawLantern(g, dcx + 24, bottom - 22, true); }
  }
  // the keep: a crenellated parapet, a slate great-hall roof, the Duke's arms over the north door, two front turrets at
  // the north corners, and a square tower with a spire in its south half. Only the turrets' cones rise over row 46.
  function keepTurret(g, cx, base, rim, apex, R) {
    const ry = R * 0.34;
    const body = g.createLinearGradient(cx - R, 0, cx + R, 0); body.addColorStop(0, '#74777e'); body.addColorStop(0.32, '#c3c7cc'); body.addColorStop(0.7, '#a4a8ae'); body.addColorStop(1, '#6a6d74');
    g.fillStyle = body; g.beginPath(); g.moveTo(cx - R, rim); g.lineTo(cx - R, base); g.ellipse(cx, base, R, ry, 0, Math.PI, 0, true); g.lineTo(cx + R, rim); g.closePath(); g.fill();
    g.fillStyle = '#23262c'; roundRect(g, cx - 2.5, (base + rim) / 2 - 7, 5, 14, 2); g.fill();
    g.fillStyle = '#c3c7cc'; g.beginPath(); g.ellipse(cx, rim, R + 3, ry + 2, 0, 0, 7); g.fill();
    for (let k = 0; k < 7; k++) { const a = Math.PI * (0.07 + k * 0.143), mx = cx + Math.cos(a) * (R + 1), my = rim + Math.sin(a) * (ry + 1); g.fillStyle = '#a4a8ae'; g.fillRect(mx - 4, my - 8, 8, 8); g.fillStyle = '#d6d9dd'; g.fillRect(mx - 4, my - 8, 8, 2); }
    const cone = g.createLinearGradient(cx - R, 0, cx + R, 0); cone.addColorStop(0, PURPLE_D); cone.addColorStop(0.38, PURPLE_L); cone.addColorStop(1, '#341848');
    g.fillStyle = cone; g.beginPath(); g.moveTo(cx - R + 3, rim - 3); g.lineTo(cx, apex); g.lineTo(cx + R - 3, rim - 3); g.ellipse(cx, rim - 3, R - 3, ry - 3, 0, 0, Math.PI); g.closePath(); g.fill();
    g.fillStyle = GOLD; g.fillRect(cx - R + 3, rim - 4, 2 * R - 6, 2.5); g.beginPath(); g.arc(cx, apex - 2, 3, 0, 7); g.fill(); g.fillRect(cx - 1, apex - 10, 2, 8);
  }
  function crenels(g, x, y, w) { for (let k = 0; k * 12 < w; k += 2) { g.fillStyle = '#a4a8ae'; g.fillRect(x + k * 12, y - 10, Math.min(12, w - k * 12), 10); g.fillStyle = '#d6d9dd'; g.fillRect(x + k * 12, y - 10, Math.min(12, w - k * 12), 2.5); } }
  function drawKeep(g, b, x, y, w, h) {
    const FH = 78, face = y + h - FH, lit0 = lit();
    // what moves: the spire's pennant, the two banners on the south face, the north door's lanterns (none of them overlaps
    // anything drawn after it in the whole keep, so they can go over the cached still keep)
    if (BPASS === 2) {
      pennant(g, x + w / 2 + 1, y + 40 - 22, 26);
      hangBanner(g, x + 4.5 * TILE + 24 - 30, face + 10, 52, 22, 1);
      hangBanner(g, x + 4.5 * TILE + 24 + 30, face + 10, 52, 22, 2);
      topDoor(g, b, x, y);
      return;
    }
    const mv = BPASS === 0;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 8, y + h - 4, w, 10);
    // the walls' tops: a parapet walk all round the great hall's roof
    g.fillStyle = '#9ca0a7'; g.fillRect(x, y, w, face - y);
    g.fillStyle = '#c3c7cc'; g.fillRect(x, y, w, 30); g.fillRect(x, y, 26, face - y); g.fillRect(x + w - 26, y, 26, face - y);
    g.fillStyle = 'rgba(70,70,75,0.3)'; for (let yy = y + 12; yy < face; yy += 14) { g.fillRect(x, yy, 26, 1); g.fillRect(x + w - 26, yy, 26, 1); }
    // the great hall's slate roof inside the parapet
    hipRoof(g, x + 26, y + 30, w - 52, face - 8, '#4a4f5a');
    // the north wall's door (112,46) with its lanterns, and the Duke's arms just inside it, under the frame
    topDoor(g, b, x, y);
    arms(g, x + b.doorTop * TILE + 24, y + 44, 26);
    // the square tower in the south half, standing up out of the hall's roof, with a slim slate spire and a pennant
    const tw = 88, tx0 = x + w / 2 - tw / 2, tBase = face - 2, tTop = y + 122;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(tx0 + 10, tBase - 8, tw, 10); g.fillRect(tx0 + tw, tTop + 12, 10, tBase - tTop - 12);
    paleWall(g, tx0, tTop, tw, tBase - tTop);
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(tx0 + tw - 16, tTop, 16, tBase - tTop);
    g.fillStyle = PURPLE; g.fillRect(tx0, tTop + 16, tw, 3);
    for (const ox of [-22, 0, 22]) windowAt(g, x + w / 2 + ox, tTop + 30, 9, 22, false, lit0);
    windowAt(g, x + w / 2, tTop + 72, 14, 26, false, lit0);
    crenels(g, tx0, tTop, tw); g.fillStyle = '#c3c7cc'; g.fillRect(tx0 - 2, tTop - 2, tw + 4, 5);
    const sb0 = tx0 + 14, sb1 = tx0 + tw - 14, sTop = y + 40;
    const sp = g.createLinearGradient(sb0, 0, sb1, 0); sp.addColorStop(0, '#2c3038'); sp.addColorStop(0.42, '#6a707d'); sp.addColorStop(1, '#262a31');
    g.fillStyle = sp; g.beginPath(); g.moveTo(sb0, tTop - 8); g.lineTo(x + w / 2, sTop); g.lineTo(sb1, tTop - 8); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1; for (let k = 1; k < 6; k++) { const f = k / 6, yy = tTop - 8 - (tTop - 8 - sTop) * f; g.beginPath(); g.moveTo(sb0 + (x + w / 2 - sb0) * f, yy); g.lineTo(sb1 - (sb1 - x - w / 2) * f, yy); g.stroke(); }
    g.fillStyle = GOLD_D; g.fillRect(sb0 - 2, tTop - 10, sb1 - sb0 + 4, 3);
    g.fillStyle = GOLD; g.beginPath(); g.arc(x + w / 2, sTop - 2, 3.5, 0, 7); g.fill(); g.fillRect(x + w / 2 - 1, sTop - 22, 2, 20);
    if (mv) pennant(g, x + w / 2 + 1, sTop - 22, 26);
    // the south face: grey stone, a purple string course, tall windows, two banners, a crenellated top
    paleWall(g, x, face, w, FH);
    g.fillStyle = PURPLE; g.fillRect(x, face + 4, w, 3);
    for (const c of [1, 3, 6, 8]) windowAt(g, x + c * TILE + 24, face + 18, 14, 30, false, lit0);
    if (mv) { hangBanner(g, x + 4.5 * TILE + 24 - 30, face + 10, 52, 22, 1); hangBanner(g, x + 4.5 * TILE + 24 + 30, face + 10, 52, 22, 2); }
    crenels(g, x, face, w);
    // little bartizans on the south face's corners, inside the footprint
    keepTurret(g, x + 18, face + 30, face - 20, face - 74, 16); keepTurret(g, x + w - 18, face + 30, face - 20, face - 74, 16);
    // the two front turrets at the north corners (their cones may rise 60 px over row 46)
    keepTurret(g, x + 30, y + 66, y + 10, y - 48, 26); keepTurret(g, x + w - 30, y + 66, y + 10, y - 48, 26);
  }
  function drawTownBuilding(g, b) {
    const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    if (b.town) STATS.townBuildings++; if (b.id === 'keep') STATS.keep++; if (b.id === DEATH_ID) STATS.deathHouse++;
    if (STATS.record) STATS.boxes.push({ x0: x, y0: y - riseOf(b), x1: x + w, y1: y + h, own: b.id, building: true });
    g.save();
    // the keep fades only where its two front turrets rise over row 46 and the knight is behind them
    if (b.id === 'keep') { const sy = (b.y + b.h) * TILE - 1, a = Math.min(behindAlpha(x, y - 60, x + 60, y + 70, sy), behindAlpha(x + w - 60, y - 60, x + w, y + 70, sy)); if (a < 1) g.globalAlpha = a; }
    const paint = b.id === 'keep' ? drawKeep : b.id === DEATH_ID ? drawDeathHouse : drawHall;
    // what never moves comes from a picture made once (per day or night); smoke, lanterns, signs and banners go on top
    const pic = buildingPic(b, paint, x, y, w, h);
    if (pic) { g.drawImage(pic.c, pic.x0, pic.y0, pic.w, pic.h); BPASS = 2; try { paint(g, b, x, y, w, h); } finally { BPASS = 0; } }
    else paint(g, b, x, y, w, h);
    g.restore();
  }
  // the pictures: the art round a building reaches 48 px past its sides and below it and up to its rise over its top
  // (the keep's turret cones); at the screen's pixel ratio (1 or 2), the 10 drawn least lately dropped
  const PICS = new Map(); let picUse = 0;
  const PIC_MAX = 10;
  function buildingPic(b, paint, x, y, w, h) {
    const ss = picScale(), key = b.id + (lit() ? '@n' : '@d') + ss;
    let p = PICS.get(key);
    if (!p) {
      const x0 = x - TILE, y0 = y - riseOf(b) - 24, pw = w + 2 * TILE, ph = h + riseOf(b) + 24 + TILE;
      const c = document.createElement('canvas'); c.width = Math.ceil(pw * ss); c.height = Math.ceil(ph * ss);
      const cg = c.getContext ? c.getContext('2d') : null;
      if (!cg || !c.width) return null;
      try { cg.scale(ss, ss); cg.translate(-x0, -y0); BPASS = 1; paint(cg, b, x, y, w, h); } catch (e) { BPASS = 0; return null; } finally { BPASS = 0; }
      p = { c, x0, y0, w: pw, h: ph, used: 0 }; PICS.set(key, p); STATS.pics++;
      if (PICS.size > PIC_MAX) { const old = [...PICS.entries()].filter(([k]) => k !== key).sort((a, b2) => a[1].used - b2[1].used).slice(0, PICS.size - PIC_MAX); for (const [k, o] of old) { PICS.delete(k); try { o.c.width = 0; o.c.height = 0; } catch (e) { } } }
    }
    p.used = ++picUse;
    return p;
  }
  { const _drawBuilding = drawBuilding; drawBuilding = function (g, b) { return (b && (b.town || b.id === DEATH_ID) && !window.__instance) ? drawTownBuilding(g, b) : _drawBuilding(g, b); }; }
  // the six town gate cells draw no wooden gate (the gatehouse is drawn instead)
  const TOWN_GATE_CELLS = new Set(PLAN.GATES.flatMap(gt => gt.rows.map(y => gt.x + ',' + y)));
  { const _drawFenceProp = drawFenceProp; drawFenceProp = function (g, tx, ty, gate) { if (!window.__instance && TOWN_GATE_CELLS.has(tx + ',' + ty)) return; return _drawFenceProp(g, tx, ty, gate); }; }
  // the square's fire is an iron brazier on a stone ring (still a T.FIRE: you can cook on it)
  const BRAZIER = (([x, y]) => ({ x, y }))(ATLAS.port('thistledown.brazier'));
  function drawBrazier(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx + 3, cy + 16, 18, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#7d8087'; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * 17, cy + 10 + Math.sin(a) * 6, 4, 0, 7); g.fill(); }
    g.strokeStyle = '#1f2126'; g.lineWidth = 3; for (const ox of [-10, 0, 10]) { g.beginPath(); g.moveTo(cx + ox * 0.6, cy - 4); g.lineTo(cx + ox, cy + 12); g.stroke(); }
    g.fillStyle = '#2a2d33'; g.beginPath(); g.ellipse(cx, cy - 4, 15, 6, 0, 0, Math.PI); g.lineTo(cx - 15, cy - 6); g.ellipse(cx, cy - 6, 15, 5, 0, Math.PI, 0, true); g.closePath(); g.fill();
    g.fillStyle = '#4a2a14'; g.beginPath(); g.ellipse(cx, cy - 6, 12, 4, 0, 0, 7); g.fill();
    for (let k = 0; k < 3; k++) { const ph = Math.sin(time * 9 + k * 2) * 3; g.fillStyle = ['#ff6a1a', '#ffa030', '#ffe066'][k]; g.beginPath(); g.moveTo(cx - 9 + k * 3, cy - 6); g.quadraticCurveTo(cx - 12 + k * 4, cy - 18 - ph, cx + (k - 1) * 3, cy - 30 - ph * 1.5 - k * 4); g.quadraticCurveTo(cx + 12 - k * 4, cy - 18 + ph, cx + 9 - k * 3, cy - 6); g.closePath(); g.fill(); }
    const gr = g.createRadialGradient(cx, cy - 10, 5, cx, cy - 10, 60); gr.addColorStop(0, 'rgba(255,170,60,0.26)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy - 10, 60, 0, 7); g.fill();
  }
  { const _drawFireProp = drawFireProp; drawFireProp = function (g, tx, ty) { if (window.__instance || tx !== BRAZIER.x || ty !== BRAZIER.y) return _drawFireProp(g, tx, ty); drawBrazier(g, tx, ty); }; }

  // ---------- the hook ----------
  const GATE_TOWERS = TOWERS.filter(t => t.gate);
  const drawHook = (g, items, c0) => {
    STATS.chunks = 0; STATS.repaints = 0; STATS.items = 0; STATS.towers = 0; STATS.porches = 0; STATS.lampsLit = 0; STATS.fountains = 0; STATS.statues = 0; STATS.keep = 0; STATS.townBuildings = 0; STATS.bellAlpha = 1; STATS.gateAlpha = {}; STATS.gateWho = {};
    if (STATS.record) STATS.boxes.length = 0;
    // every instance is written into the map's top-left corner: nothing of the town is drawn inside one
    if (window.__instance) return;
    const c = c0 || cam;
    STATS.frames++;
    const vx0 = Math.floor(c.x / TILE) - 2, vx1 = Math.ceil((c.x + VW) / TILE) + 2, vy0 = Math.floor(c.y / TILE) - 2, vy1 = Math.ceil((c.y + VH) / TILE) + 5;
    if (vx1 < X0 || vx0 >= X0 + W || vy1 < Y0 || vy0 >= Y0 + H) return;
    // under every ground overlay of the other files: 17-tap's ring and path dots (-1e9, -1e9 + 1), 69-retaliate's red ring
    // (-1e9 + 2) and 39-worldblend's feathers (-1e9, drawn on GRASS cells only, which the chunks never paint)
    put(items, GROUND_Y, null, () => drawGround(g, c));
    for (const [x, y, h0] of LILIES) if (x >= vx0 && x <= vx1 && y >= vy0 && y <= vy1) put(items, -1e8 - 1, null, () => drawLily(g, x, y, h0));
    const x0 = Math.max(X0, vx0), x1 = Math.min(X0 + W - 1, vx1), y0 = Math.max(Y0, vy0), y1 = Math.min(Y0 + H - 1, vy1);
    const WT = WALL_T();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = tileAt(x, y), ch = glyph(x, y);
      if (t === WT && inTown(x, y)) { put(items, tc(y), [x * TILE, y * TILE - 12, (x + 1) * TILE, (y + 1) * TILE], () => drawWallCell(g, x, y)); continue; }
      if (t === T.CWALL && ch === 'C') { put(items, tc(y) + 1, [x * TILE, y * TILE - 14, (x + 1) * TILE, (y + 1) * TILE], () => drawCastleWall(g, x, y)); continue; }
      const k = KIND_NAMES[KIND[pi(x, y)]];
      if (!k) continue;
      const want = k === 'great' || k === 'market' || k === 'rose' ? FOUNT : GREEN_KINDS.has(k) ? HEDGE : PROP;
      if (t !== want) continue;
      const px = x * TILE, py = y * TILE, by = (y + 1) * TILE;
      if (k === 'lamp') { put(items, by - 6, [tc(x) - 11, LAMP_TOP[x + ',' + y], tc(x) + 11, by], () => drawLamp(g, x, y)); if (lit()) put(items, 1e9 + 1, null, () => lampGlow(g, x, y)); }
      else if (k === 'statue') { const s = statueAt(x, y), hw = s ? (STATUE_HALF[s.id] || 24) - 2 : 22; if (s) put(items, by - 2, [tc(x) - hw, by - 92, tc(x) + hw, by], () => drawStatue(g, s)); }
      else if (k === 'plinth') put(items, by - 2, [tc(x) - 22, by - (statueDone() ? 92 : 36), tc(x) + 22, by], () => drawPlinth(g));
      else if (k === 'bench') put(items, by - 5, [tc(x) - 21, by - 37, tc(x) + 21, by], () => blit(g, sprite('bench', 48, 40, 24, 36, paintBench), tc(x), by - 5));
      else if (k === 'sign') { const s = signAt(x, y); if (s) put(items, by - 5, [tc(x) - 22, by - 72, tc(x) + 22, by], () => blit(g, sprite('sign-' + s.side, 48, 72, 24, 68, cg => paintSign(cg, s.side)), tc(x), by - 4)); }
      else if (k === 'stall') { const s = stallAt(x, y); if (s && s.x === x) put(items, by - 3, [px - 4, py - 24, px + 100, by], () => drawStall(g, s)); }
      else if (k === 'bell') { if (x === PLAN.BELL.x && y === PLAN.BELL.y) put(items, BT.foot - 2, [BT.x - 6, BT.foot + BT.TOP, BT.x + BT.w + 6, BT.foot], () => drawBellTower(g)); }
      else if (k === 'sundial') put(items, by - 4, [tc(x) - 17, by - 42, tc(x) + 17, by], () => drawSundial(g, x, y));
      else if (k === 'hedge') put(items, by - 3, [px, py - 10, px + 48, by], () => drawHedge(g, x, y));
      else if (k === 'fruit' || k === 'cherry') { const R = TREE_R[x + ',' + y] || 26; put(items, by - 6, [tc(x) - R, by - 6 - 84, tc(x) + R, by], () => drawTree(g, x, y, k)); }
      else if (k === 'roses') put(items, by - 4, [px, py, px + 48, by], () => drawRoses(g, x, y));
      else if (k === 'flowers') put(items, by - 4, [px, py, px + 48, by], () => drawFlowerBed(g, x, y));
      else if (k === 'woodpile') { const v = GVAR[pi(x, y)] % 2; put(items, by - 3, [px, py, px + 48, by], () => blit(g, sprite('woodpile' + v, 48, 48, 0, 0, cg => paintWoodpile(cg, v)), px, py)); }
      else if (k === 'cart') { if (glyph(x - 1, y) !== 'c') put(items, by - 3, [px - 4, py - 22, px + 96, by], () => blit(g, sprite('cart', 100, 76, 2, 22, paintCart), px, py)); }
      else if (k === 'oldanvil') put(items, by - 4, [px, py, px + 48, by], () => blit(g, sprite('oldanvil', 48, 48, 0, 0, paintOldAnvil), px, py));
      else if (k === 'trough') put(items, by - 4, [px, py, px + 48, by], () => drawTrough(g, x, y));
      else if (k === 'well') put(items, by - 2, [tc(x) - 28, by - 86, tc(x) + 28, by], () => drawWell(g, x, y));
      else if (k === 'table') { const v = GVAR[pi(x, y)] % 2; put(items, by - 4, [px, py, px + 48, by], () => blit(g, sprite('table' + v, 48, 48, 0, 0, cg => paintTable(cg, v)), px, py)); }
      else if (k === 'great') { if (x === great.x && y === great.y) put(items, (great.y + great.h) * TILE - 4, [GF.cx - GF.rx - 2, TD.y(34) * TILE - 24, GF.cx + GF.rx + 2, (great.y + great.h) * TILE], () => drawGreatFountain(g)); }
      else if (k === 'market' || k === 'rose') { const f = fountainAt(x, y); if (f && x === f.x && y === f.y) put(items, (f.y + f.h) * TILE - 4, [f.x * TILE, f.y * TILE - 30, (f.x + f.w) * TILE, (f.y + f.h) * TILE], () => drawSmallFountain(g, f)); }
    }
    // the back doors' porches, over the step behind the house, sorted at the step's middle
    for (const b of TOWN_BUILDINGS()) if (PORCH_FOR(b) && vis(c, (b.x + b.doorTop) * TILE - 40, b.y * TILE - 50, (b.x + b.doorTop) * TILE + 90, b.y * TILE + 12)) put(items, b.y * TILE - TILE / 2, [(b.x + b.doorTop) * TILE - 4, b.y * TILE - 34, (b.x + b.doorTop) * TILE + 52, b.y * TILE + 8], () => drawPorch(g, b), b.id);
    // the towers and the two gatehouses
    for (const t of TOWERS) {
      const d = t.gate ? TOWER_DEF.gate : TOWER_DEF.wall;
      if (!vis(c, t.cx - d.R - 30, t.cy + d.apex - 20, t.cx + d.R + 30, t.cy + d.base + 10)) continue;
      put(items, (t.y + t.h) * TILE - 2, [t.cx - d.R, t.cy + d.apex - 14, t.cx + d.R, (t.y + t.h) * TILE], () => drawTownTower(g, t));
    }
    for (const gt of PLAN.GATES) { const b = gateBox(gt); if (vis(c, b.x0 - 24, b.top - 24, b.x1 + 24, b.foot1 + 10)) put(items, TD.y(34) * TILE - 1, [b.x0 - 18, b.top - GH.merlon, b.x1 + 18, b.foot1 + 2], () => drawGatehouse(g, gt), 'gatehouse'); }
    // the castle: its gate towers, the raised portcullis, the turrets, the drawbridge's chains
    if (vis(c, TD.x(102) * TILE, TD.y(38) * TILE, TD.x(124) * TILE, TD.y(56) * TILE)) {
      CASTLE_GATE_TOWERS.forEach((t, i) => put(items, TD.y(43) * TILE - 2, [t.cx - 30, t.cy - 100, t.cx + 30, TD.y(43) * TILE], () => drawCastleGateTower(g, t, i)));
      put(items, TD.y(43) * TILE - 3, [TD.x(111) * TILE - 2, TD.y(42) * TILE - 18, TD.x(113) * TILE + 2, TD.y(42) * TILE + 11], () => drawCastleArch(g));
      for (const t of TURRETS) put(items, t.cy + 22, [t.cx - 21, t.cy - 80, t.cx + 21, t.cy + 24], () => drawTurret(g, t));
      put(items, TD.y(42) * TILE + 1, null, () => drawChains(g));
    }
    // Swan Pond: the boat, the swans, the ducklings
    { const P0 = PLAN.POND;
      if (vis(c, P0.x0 * TILE - 40, P0.y0 * TILE - 40, (P0.x1 + 1) * TILE + 40, (P0.y1 + 1) * TILE + 40)) {
        put(items, (P0.boat[1] + 2) * TILE - 10, null, () => drawBoat(g));
        const ms = wallMs();
        for (let i = 0; i < SWAN_LOOPS.length; i++) { const p = swanAt(i, ms); put(items, p.y + 4, null, () => drawSwan(g, p, 1)); }
        for (let k = 1; k <= 4; k++) { const p = swanAt(1, ms, k * 1.4); put(items, p.y + 2, null, () => drawDuckling(g, p)); }
      } }
    // the small folk: Tess and Robin round the fountain, Duchess on the bell plaza (or running there)
    for (const k of kidsNow()) if (vis(c, k.px - 30, k.py - 40, k.px + 30, k.py + 20)) put(items, k.py + 10, null, () => drawKid(g, k));
    { const u = (time - CAT.t0) / 2;
      if (u >= 0 && u < 1) { const fx = (PLAN.BELL.x + 0.5) * TILE, fy = BT.foot + 6, d = duchessHome(); const x = lerp(fx, d.x, u), y = lerp(fy, d.y, u) - Math.abs(Math.sin(u * Math.PI * 4)) * 6; put(items, y + 6, null, () => drawCat(g, x, y, true, time)); }
      else if (duchessHere()) { const d = duchessHome(); if (vis(c, d.x - 30, d.y - 40, d.x + 30, d.y + 20)) put(items, d.y + 6, null, () => drawCat(g, d.x, d.y, false, time)); } }
    // Gatewarden Osric's welcome, over his head for four seconds
    if (BARK.t > 0) { const os = npc('osric'); if (os) put(items, 1e9 + 3, null, () => { g.save(); g.translate(Math.round(cam.x), Math.round(cam.y)); g.globalAlpha = Math.min(1, BARK.t * 2); HK.tag(g, os.px - cam.x, os.py - 30 - cam.y, 'Welcome to Thistledown!'); g.restore(); }); }
    // bunting across the street, over every head
    for (const [a, b] of PLAN.BUNTING) { const ax = tc(a[0]), bx = tc(b[0]); if (vis(c, Math.min(ax, bx) - 20, Math.min(a[1], b[1]) * TILE - 120, Math.max(ax, bx) + 20, Math.max(a[1], b[1]) * TILE + 10)) put(items, 9e8, null, () => drawBunting(g, a, b)); }
  };
  HOOKS.draw.push(drawHook);

  // ---------- night: the lamps, the torches, the fountain and the dial light the street ----------
  // The pools are small (a lamp 72, the fountain 64, the dial 64): at 110 and 90 the 22 lamps' pools ran into each other and
  // Fountain Square at night was almost as bright as day. Each lamp's head glows over the dark instead (lampGlow, 1e9 + 1).
  const LAMP_R = 72, FOUNTAIN_R = 64, DIAL_R = 64;
  function townLights(out, x0, y0, x1, y1) {
    if (window.__instance) return;
    const on = lit(), inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    if (on) for (const [x, y] of LAMPS) if (inside(x, y)) out.push({ x: tc(x), y: y * TILE - 16, r: LAMP_R, kind: 'lamp' });
    if (on) for (const key of TORCHES) { const [x, y] = key.split(',').map(Number); if (inside(x, y)) out.push({ x: tc(x), y: tc(y) - 14, r: 70, kind: 'torch' }); }
    if (on) for (const gt of PLAN.GATES) if (inside(gt.x, TD.y(32))) { const b = gateBox(gt); for (const ty of [b.top + 14, b.bot - 2]) out.push({ x: b.outer + b.out * 5, y: ty - 14, r: 80, kind: 'gate torch' }); }
    if (inside(great.x + 1, great.y + 1)) out.push({ x: greatC.x, y: greatC.y, r: FOUNTAIN_R, kind: 'fountain' });
    if (inside(PLAN.BELL.x, PLAN.BELL.y)) out.push({ x: BT.x + BT.w / 2, y: BT.foot + BT.FACE + 40, r: DIAL_R, kind: 'dial' });
  }
  if (HOOKS.nightLights) HOOKS.nightLights.push(townLights);

  // =========================================================================
  // 10. the book
  // =========================================================================
  if (window.WIKI && WIKI.add) {
    const st = id => PLAN.STREETS.find(s => s.id === id).name;
    const lines = [
      'Thistledown, the city that still stands: the capital of the Fanglands, where every knight wakes and where a fallen knight comes back.',
      { t: 'THE GATES AND THE WALL', c: '#8b949e' },
      `A high wall of grey stone with ${PLAN.TOWERS.length} towers goes all the way round the city. The West Gate and the East Gate are stone gate towers, open day and night; horses ride through, goblins do not.`,
      { t: 'THE STREETS', c: '#8b949e' },
      `${st('high')} runs straight from gate to gate under ${LAMPS_N} iron lamps, with bunting across it. ${st('crown')} runs north from the fountain to the Bell Tower.`,
      `${PLAN.STREETS.filter(s => s.id !== 'high' && s.id !== 'crown').map(s => s.name).join(', ')}.`,
      { t: 'FOUNTAIN SQUARE', c: '#8b949e' },
      'The Great Fountain is in the middle of the city: toss a coin in for luck. Four hero statues stand round it: the Last Knight of Hollowford, King Thrain of the Dwarves, Queen Aelith of the Elves and Queen Seraphel of Aerie.',
      'An empty plinth by the castle gate is kept for the knight who ends the dragon.',
      { t: 'CASTLE THISTLEDOWN', c: '#8b949e' },
      'The castle stands in a moat. Cross the oak drawbridge, under the iron gate that is always pulled up, to the keep, where Duke Ferrin sits. The Duke grows roses in the courtyard.',
      { t: 'THE MARKET COURT', c: '#8b949e' },
      'Four stalls round the market fountain: Hettie\'s apples, Mabel\'s candles, Moll\'s flowers, and a cloth stall that is always BACK SOON.',
      { t: 'THE BELL TOWER', c: '#8b949e' },
      'At the north end of Crown Street. Its dial shows the day and the night. Ambrose rings the bell at dawn and at dusk.',
      { t: 'THE PARKS', c: '#8b949e' },
      `The Duke's Orchard along the north wall: ${PLAN.fruitTrees} apple trees. The Duke's Green: a hedge maze with a sundial in the middle, and Swan Pond with two swans, four ducklings, a footbridge and a rowing boat. The Rose Garden by the inn, with a little lily fountain. The Bell Green beside the Bell Tower, with a well, benches and two cherry trees. The inn's garden behind The Barrel & Boar, with tables on the lawn.`,
      { t: 'THE SMITHY YARD', c: '#8b949e' },
      'Behind the smithy and the Tinker\'s Workshop: the woodpiles, Brakka\'s handcart of charcoal, an old anvil on a stump, a water trough, and the pit where the bulldozer is mended.',
      { t: 'WHO STANDS WHERE', c: '#8b949e' },
      'Gatewarden Osric, inside the West Gate. Ambrose the bell-ringer, at the Bell Tower. Hettie, Mabel and Moll, at their stalls. Wynn, by Swan Pond. Captain Roderick of the guard, at the castle gate. The Master of Skills, in the castle yard.',
      'Marta at the General Store, Aldous at the bank, Rosalind at the bakery, Brakka at the smithy, Pim at the Tinker\'s Workshop, Dorran at The Barrel & Boar, Greta and Fennick on the square, Tobin by the fountain, Sergeant Hale in his yard, Death in his stone house, and Duke Ferrin in the keep.',
      'Tess and Robin play tag round the fountain.',
    ];
    WIKI.add('places', { id: 'thistledown_landmarks', name: 'Thistledown landmarks', sub: 'The city that still stands', kind: 'town', lines });
    WIKI.add('quests', { id: 'td_bell', name: 'The Bell at Midnight', giver: 'Ambrose the bell-ringer, at the Bell Tower in Thistledown, once you have met the Duke', reward: '75 coins', kind: 'Side quest' });
  }

  // =========================================================================
  // 11. keeping order, and never stuck in the stonework
  // =========================================================================
  // 16-instances hides the buildings inside an instance's rectangle (Aerie's takes in the town's west half) and puts
  // them back at the END of BUILDINGS, so a lookup that takes the first match picks a different building after a visit
  // to Aerie. Back on the overworld, BUILDINGS goes back to the order the world was built in.
  const ORD = new Map(); BUILDINGS.forEach((b, i) => ORD.set(b, i));
  const ordOf = b => ORD.has(b) ? ORD.get(b) : 1e9;
  function keepOrder() {
    if (away()) return false;
    let sorted = true; for (let i = 1; i < BUILDINGS.length; i++) if (ordOf(BUILDINGS[i - 1]) > ordOf(BUILDINGS[i])) { sorted = false; break; }
    if (sorted) return false;
    const s = BUILDINGS.slice().sort((a, b) => ordOf(a) - ordOf(b)); BUILDINGS.length = 0; for (const b of s) BUILDINGS.push(b);
    return true;
  }
  if (window.INSTANCES) { const _leave = INSTANCES.leave; INSTANCES.leave = () => { const r = _leave(); keepOrder(); return r; }; }
  { const _load2 = load; load = function () { const ok = _load2(); keepOrder(); return ok; }; }
  // A villager who walks into a lawn, a lamp or a hedge is turned back by the core (07-update) with a new direction on
  // the very next tick, so against the city's many edges he spun in place, rolling dice every frame. Here he stops for a
  // second and a half first (the core rolls again after that), like someone choosing which way to go.
  const PAUSE = 1.5;
  HOOKS.update.push(() => {
    if (away()) return;
    for (const n of NPCS) if (n.wander && n.wanderT === 0 && inTown(Math.floor(n.px / TILE), Math.floor(n.py / TILE))) { n.wanderT = PAUSE; n.dir = null; n.moving = false; }
  });
  // a knight put down inside the city's stonework (a fountain, a hedge, a lamp, a tower) by a teleport steps out of it
  const STUCK = { moves: 0 };
  HOOKS.update.push(() => {
    keepOrder();
    if (away() || player.dead) return;
    const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE), t = tileAt(tx, ty);
    if (!inTown(tx, ty) || !(t === FOUNT || t === HEDGE || t === PROP || t === WALL_T())) return;
    const sp = safeSpot(player.x, player.y, player.r, playerWho()); if (!sp) return;
    player.x = sp.x; player.y = sp.y; STUCK.moves++;
  });

  // =========================================================================
  // 12. self-test (C1-C21; every check puts back what it touched)
  // =========================================================================
  const DUKE_TALK0 = HOOKS.talkBefore.duke;
  const RESET = resetCapital;
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'capital: ';
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const said = () => (dialog.cur ? [dialog.cur] : []).concat(dialog.queue);
    const texts = () => said().map(d => d.text);
    const leave = () => { if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave(); };
    const N4c = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const names = {}; for (const k in T) names[T[k]] = k;
    h.peace(true); closePanel(); drain(); leave();
    const wasTouch = window.__forceTouch; window.__forceTouch = false;
    // a tile the checks borrow goes back exactly as it was, save diff and all (94-mountgates' pattern)
    const borrowed = [];
    const borrow = (tx, ty) => { const i = idx(tx, ty); borrowed.push({ tx, ty, t: tileAt(tx, ty), had: mapDiffs.has(i), d: mapDiffs.get(i) }); };
    const giveBack = () => { while (borrowed.length) { const b = borrowed.pop(); setTile(b.tx, b.ty, b.t); if (b.had) mapDiffs.set(idx(b.tx, b.ty), b.d); else mapDiffs.delete(idx(b.tx, b.ty)); } };
    const keep = { x: player.x, y: player.y, quest: JSON.stringify(quest), inv: player.inv.map(s => s ? { ...s } : null), horse: player.horse ? JSON.parse(JSON.stringify(player.horse)) : player.horse,
      mech: player.mech, r: player.r, speed: player.speed, day: player.dayTime, region: player.region, cityV: player.cityV, visited: player.visitedVillage, bed: player.bedSpawn, home: player.home, bank: player.bank.map(s => ({ ...s })) };
    const onFoot = () => { player.mech = null; player.r = 13; player.speed = 175; player.action = null; };
    const setCoins = n => { while (coins() > 0) payCoins(coins()); if (n > 0) h.give('coins', n); };
    // villagers who wander, and monsters, out of the way of the checks (put back at the end)
    const npcKeep = NPCS.map(n => ({ n, px: n.px, py: n.py, wanderT: n.wanderT }));
    const clearFolk = (cx, cy, r) => { for (const v of NPCS) if (v.wander && dist(v.px, v.py, tc(cx), tc(cy)) < r * TILE) { v.px = v.home.x + 40 * TILE; v.py = v.home.y; v.wanderT = 99; v.dir = null; } };
    const monKeep = monsters.map(m => ({ m, x: m.x, y: m.y }));
    const clearMonsters = (cx, cy, r) => { for (const m of monsters) if (dist(m.x, m.y, tc(cx), tc(cy)) < r * TILE) { m.x = tc(ATLAS.world.tx(5)); m.y = tc(ATLAS.world.ty(170)); } };   // parked far off in the open south-west
    CLOCK.fixed = 0;
    // the children at a fixed moment, on the far side of the fountain from where the checks stand
    const kidsAway = () => { for (let ms = 0; ms < 60000; ms += 250) { const ok = KIDS.every(k => { const p = kidAt(ms - k.lag * 1000); return p.y > TD.y(36); }); if (ok) { CLOCK.fixed = ms; return; } } };
    kidsAway();
    // a recording canvas: every call is logged with its arguments
    const recorder = () => { const log = []; const g = new Proxy({}, {
      get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? (() => ({ addColorStop: () => { } })) : typeof k === 'string' ? ((...a) => { log.push([k, a]); }) : undefined,
      set: () => true }); return { g, log }; };
    const screenTap = (tx, ty) => { render(); const sx = tc(tx) - cam.x, sy = tc(ty) - cam.y; tap.lastTap = null; tapCancel('manual'); pointerDown(sx, sy, 'mouse'); pointerUp('mouse'); };
    const untilTapDone = (max = 600) => { let s = 0; while (s < max && (tap.kind || (tap.path && tap.path.length))) { F.step([]); s++; } F.step([]); return s; };
    const walkable = (x, y) => !SOLID.has(tileAt(x, y));

    // ---- C1. the plan ----
    { const rowsOk = PLAN.ROWS.length === 45 && PLAN.ROWS.every(r => r.length === 58) && W === 58 && H === 45 && X0 === TD.x(84) && Y0 === TD.y(13);
      const known = PLAN.ROWS.every(r => [...r].every(c => c in PLAN.GLYPHS));
      const ids = ['TD_LAWN', 'TD_HEDGE', 'TD_PROP', 'TD_FOUNTAIN'].map(n => T[n]), maxId = Math.max(...Object.values(T));
      const tilesOk = ids.every(id => typeof id === 'number' && id <= 255) && SOLID.has(HEDGE) && SOLID.has(PROP) && SOLID.has(FOUNT) && !SOLID.has(LAWN) && PLACEABLE_ON.has(LAWN) && LAWN !== T.GRASS;
      // round 1 of review: the Smithy Yard, the Bell Green, the inn's garden and the kitchen garden took 184 plain grass
      // cells ('.' 215 -> 31); one lamp moved from 121,29 to 117,30 (still 22)
      const COUNTS = { '-': 202, '#': 144, 'T': 80, 'G': 6, '@': 507, '=': 282, '+': 457, '"': 263, 'h': 82, 'd': 1, 'O': 1, 'P': 2, 'u': 2, 't': 26, '*': 19, 'l': 22, 's': 4, 'p': 1, 'n': 11, 'k': 8, 'i': 2, 'B': 4, 'N': 1, 'D': 1, 'f': 62, '.': 31, ',': 119, 'a': 20, 'Y': 34, '~': 87, 'b': 10, 'j': 1, 'F': 20, 'x': 1, 'S': 4, 'C': 56, 'g': 2,
        'v': 21, 'w': 7, 'c': 2, 'A': 1, 'q': 1, 'V': 1, 'U': 2 };
      const off = Object.keys(COUNTS).filter(c => (PLAN.COUNTS[c] || 0) !== COUNTS[c]).map(c => `${c} ${PLAN.COUNTS[c]} want ${COUNTS[c]}`);
      const extra = Object.keys(PLAN.COUNTS).filter(c => !(c in COUNTS));
      const total = Object.values(COUNTS).reduce((a, b) => a + b, 0);
      let kProp = 0, kHedge = 0, kFount = 0, nProp = 0, nHedge = 0, nFount = 0;
      for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) { const n = PLAN.GLYPHS[glyph(x, y)], k = kindAt(x, y); if (n === 'TD_PROP') { nProp++; if (k) kProp++; } else if (n === 'TD_HEDGE') { nHedge++; if (k) kHedge++; } else if (n === 'TD_FOUNTAIN') { nFount++; if (k) kFount++; } }
      const towers = PLAN.TOWERS, t22 = towers.filter(t => t.w === 2 && t.h === 2).length, t23 = towers.filter(t => t.w === 2 && t.h === 3).length;
      let moat = 0, pond = 0; for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) if (glyph(x, y) === '~') { if (x >= PLAN.POND.x0 && x <= PLAN.POND.x1 && y >= PLAN.POND.y0 && y <= PLAN.POND.y1) pond++; else moat++; }
      const fr2 = { great: 0, market: 0, rose: 0 }; for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) { const k = kindAt(x, y); if (k in fr2) fr2[k]++; }
      const trees = { fruit: PLAN.TREES.filter(t => t.kind === 'fruit').length, cherry: PLAN.TREES.filter(t => t.kind === 'cherry').length };
      // the biggest patch of plain overworld grass ('.' and the dozer bay's 'D') left inside the walls
      let bigGrass = 0; { const seen = new Set(); for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) { const g0 = c => c === '.' || c === 'D'; if (!g0(glyph(x, y)) || seen.has(x + ',' + y)) continue; let n = 0; const st = [[x, y]]; seen.add(x + ',' + y); while (st.length) { const [cx, cy] = st.pop(); n++; for (const [dx, dy] of N4c) { const k = (cx + dx) + ',' + (cy + dy); if (!seen.has(k) && g0(glyph(cx + dx, cy + dy))) { seen.add(k); st.push([cx + dx, cy + dy]); } } } bigGrass = Math.max(bigGrass, n); } }
      const sha = (() => { let hsh = 0; for (const r of PLAN.ROWS) for (let i = 0; i < r.length; i++) hsh = (Math.imul(hsh, 31) + r.charCodeAt(i)) | 0; return hsh; })();
      check(P + 'C1 the plan: 45 rows of 58, every glyph known; TD_LAWN, TD_HEDGE, TD_PROP and TD_FOUNTAIN exist (ids <= 255); every glyph count is the plan\'s (2610 cells); 67 prop, 148 hedge and 20 fountain cells all have a kind; 18 towers (14 of 2x2, 4 of 2x3), 64 moat + 23 pond, 12 + 4 + 4 fountain cells, 14 fruit + 12 cherry trees, 22 lamps, and no plain grass patch inside the walls bigger than 6 cells',
        rowsOk && known && tilesOk && !off.length && !extra.length && total === 2610 && kProp === 67 && nProp === 67 && kHedge === 148 && nHedge === 148 && kFount === 20 && nFount === 20
        && towers.length === 18 && t22 === 14 && t23 === 4 && moat === 64 && pond === 23 && fr2.great === 12 && fr2.market === 4 && fr2.rose === 4 && trees.fruit === 14 && trees.cherry === 12 && LAMPS_N === 22 && bigGrass <= 6,
        { rowsOk, known, ids, maxId, tilesOk, off, extra, total, kProp, kHedge, kFount, towers: [towers.length, t22, t23], moat, pond, fountains: fr2, trees, lamps: LAMPS_N, bigGrass, sha }); }

    // ---- C2. nothing outside the town changes ----
    { let draws = 0, spawnCalls = 0; const rnd = () => { draws++; return 0.5; };
      const rec = () => { const w = []; return { w, api: { setTile: (x, y, t) => w.push([x, y, t]), tileAt, spawnList: () => { spawnCalls++; }, road: () => { }, pen: () => { } } }; };
      const a = rec(), b = rec(), R = Math.random; let threw = null;
      Math.random = () => { throw new Error('Math.random was called'); };
      try { paint(rnd, a.api); paint(rnd, b.api); } catch (e) { threw = e.message; } finally { Math.random = R; }
      const outside = a.w.filter(([x, y]) => x < TOWN.x0 || x > TOWN.x1 || y < TOWN.y0 || y > TOWN.y1).length;
      const same = JSON.stringify(a.w) === JSON.stringify(b.w);
      const halo = TOWN_BUILDINGS().filter(bd => bd.id !== 'h8').filter(bd => !(bd.x >= TD.x(88) && bd.y >= TD.y(17) && bd.x + bd.w <= TD.x(138) && bd.y + bd.h <= TD.y(54))).map(bd => bd.id);
      const h8 = BUILDINGS.find(bd => bd.id === 'h8'), d2 = BUILDINGS.find(bd => bd.id === 'death2');
      const today = !!h8 && h8.x === TD.x(134) && h8.y === TD.y(36) && h8.w === 5 && h8.h === 4 && !!d2 && d2.x === TD.x(133) && d2.y === TD.y(48) && d2.w === 6 && d2.h === 5;
      const npcOut = NPCS.filter(n => inTown(n.x, n.y) && n.id !== 'hale' && !(n.x >= TD.x(87) && n.x <= TD.x(138) && n.y >= TD.y(16) && n.y <= TD.y(54))).map(n => n.id);
      const hale = npc('hale'), haleOk = !!hale && hale.x === TD.x(86) && hale.y === TD.y(43);
      const edgeSpawns = MONSTER_SPAWNS.filter(s => inTown(s.tx, s.ty) && (s.tx <= TD.x(86) || s.tx >= TD.x(139) || s.ty <= TD.y(15) || s.ty >= TD.y(55))).map(s => s.type + '@' + s.tx + ',' + s.ty);
      check(P + 'C2 the painter draws no random number (Math.random is never called), never spawns, writes only inside x 85..140, y 14..56, and two runs write the same list; the buildings keep a one-tile halo inside the wall (h8 and Death\'s House as today), every town person is inside x 87..138, y 16..54 (Hale as today), and no spawn is within a tile of the wall',
        !threw && draws === 0 && spawnCalls === 0 && outside === 0 && same && a.w.length > 1000 && !halo.length && today && !npcOut.length && haleOk && !edgeSpawns.length,
        { threw, draws, spawnCalls, writes: a.w.length, outside, same, halo, today, npcOut, haleOk, edgeSpawns }); }

    // ---- C3. painted ----
    { const AG_NAMES = new Set(['DIRT', 'COURSE_MARK', 'LOG_BALANCE', 'NET', 'JUMP_GAP']);
      // the cells later passes own: 94's OWNED (ports), read, not a copy of their numbers
      const OWNED_TILE = { BOARD: 'BOARD', HOUSE_PORTAL: 'HOUSE_PORTAL', HITCH: 'HITCH', DOZER_BAY: 'DOZER_BAY', AGILITY_GATE: 'GATE' };
      const owned = {}; for (const k in PLAN.OWNED) owned[PLAN.OWNED[k].join(',')] = OWNED_TILE[k];
      const bad = [], live = [];
      for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) {
        const c = glyph(x, y), name = PLAN.GLYPHS[c]; if (!name) continue;
        const b = names[base[pi(x, y)]], key = x + ',' + y;
        if (owned[key]) { if (b !== owned[key]) bad.push(key + ' ' + b + ' want ' + owned[key]); }
        else if (c === 'Y') { if (!AG_NAMES.has(b)) bad.push(key + ' Y ' + b); }
        else if (b !== name) bad.push(key + ' ' + c + ' ' + b + ' want ' + name);
        if (!mapDiffs.has(idx(x, y)) && tileAt(x, y) !== base[pi(x, y)]) live.push(key + ' ' + names[tileAt(x, y)] + ' base ' + b);
      }
      check(P + 'C3 painted: the world as generated is the plan cell for cell, except what later passes lay on top (the notice board 105,27, the island portal 117,17, the hitching rail 119,27, the dozer bay 96,43, the agility track and its gate 87,50); with no saved change on a cell, the live tile is the generated one',
        snapped && !bad.length && !live.length, { snapped, bad: bad.slice(0, 8), live: live.slice(0, 8) }); }

    // ---- C4. walls and gates ----
    { const gateRows = x => { const r = []; for (let y = TOWN.y0; y <= TOWN.y1; y++) if (tileAt(x, y) === T.GATE) r.push(y); return r.join(','); };
      const wR = gateRows(TD.x(85)), eR = gateRows(TD.x(140)), ROWS3 = [TD.y(31), TD.y(32), TD.y(33)].join(',');
      const sides = [TD.p(85, 30), TD.p(85, 34), TD.p(140, 30), TD.p(140, 34)].every(([x, y]) => solidFor(tileAt(x, y), 'rider') && solidFor(tileAt(x, y), 'beast'));
      const towersOk = PLAN.TOWERS.every(t => { for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) if (tileAt(x, y) !== WALL_T()) return false; return true; });
      const port = []; for (let x = TD.x(104); x <= TD.x(121); x++) if (tileAt(x, TD.y(42)) === T.PORTCULLIS) port.push(x);
      const portOk = port.join(',') === [TD.x(111), TD.x(112)].join(',') && tileAt(...TD.p(110, 42)) === T.CWALL && tileAt(...TD.p(113, 42)) === T.CWALL;
      const bridge = tileAt(...TD.p(111, 41)) === T.BRIDGE && tileAt(...TD.p(112, 41)) === T.BRIDGE;
      let moat = 0; for (let x = TD.x(103); x <= TD.x(122); x++) for (const y of [TD.y(41), TD.y(55)]) if (tileAt(x, y) === T.WATER) moat++; for (let y = TD.y(42); y <= TD.y(54); y++) for (const x of [TD.x(103), TD.x(122)]) if (tileAt(x, y) === T.WATER) moat++;
      check(P + 'C4 walls and gates: T.GATE on exactly rows 31..33 at x 85 and x 140, stone above and below each (solid to riders and beasts); all 18 towers are town wall; 57-townwall counts 6 gate tiles; the portcullis is 111..112 at y 42 between castle wall; the drawbridge 111..112,41 is a bridge; the moat ring is 64 water tiles',
        wR === ROWS3 && eR === ROWS3 && sides && towersOk && TOWNWALL.tally.gates === 6 && portOk && bridge && moat === 64, { wR, eR, sides, towersOk, gates: TOWNWALL.tally.gates, port, bridge, moat }); }

    // ---- C5. the road ----
    // The fields outside the walls are not the city's: the goblin walker leaves its wreck wherever it falls, and a knight
    // parks where he likes. For C5, C6 and C9 a knight's own solid things on the road outside (x 76..84 and 141..147,
    // rows 30..34: only cells with a saved change, as changeTile lays a wreck, a machine or a plank) are borrowed off it,
    // and a machine or wreck a knight left on the High Street is lifted off it; all of it goes back after C9 (the --play bot
    // once left the goblin walker's wreck on 142,32, right outside the East Gate). The world's own tiles are never lifted,
    // so anything the world itself lays across the road still fails C5, C6 and C9.
    const roadKept = [];
    { const VEH = vehicleTiles();
      const lift = (x, y, to) => { const i = idx(x, y); roadKept.push({ x, y, t: tileAt(x, y), had: mapDiffs.has(i), d: mapDiffs.get(i) }); setTile(x, y, to); mapDiffs.delete(i); };
      for (let y = TD.y(30); y <= TD.y(34); y++) for (let x = TD.x(76); x <= TD.x(147); x++) {
        const t = tileAt(x, y), outside = x < TD.x(85) || x > TD.x(140);
        if (outside && mapDiffs.has(idx(x, y)) && (solidFor(t, 'rider') || solidFor(t, 'player'))) lift(x, y, T.GRASS);
        else if (!outside && VEH.has(t) && y >= TD.y(31) && y <= TD.y(33)) lift(x, y, base[pi(x, y)]);
      } }
    const roadBack = () => { while (roadKept.length) { const b = roadKept.pop(); setTile(b.x, b.y, b.t); if (b.had) mapDiffs.set(idx(b.x, b.y), b.d); else mapDiffs.delete(idx(b.x, b.y)); } };
    { const blocked = []; for (let y = TD.y(31); y <= TD.y(33); y++) for (let x = TD.x(84); x <= TD.x(141); x++) { const t = tileAt(x, y); if (solidFor(t, 'player') || solidFor(t, 'rider')) blocked.push(x + ',' + y); }
      const e = { x: tc(TD.x(80)), y: tc(TD.y(32)), r: 26 }; let hit = null, steps = 0;
      while (e.x < tc(TD.x(145)) && steps < 2000) { const x0 = e.x, y0 = e.y; moveEntity(e, 4, 0, 'rider'); steps++; if (e.x !== x0 + 4 || e.y !== y0) { hit = [+(e.x / TILE).toFixed(2), +(e.y / TILE).toFixed(2)]; break; } }
      check(P + 'C5 the High Street is open from x 84 to x 141 on rows 31..33 for a knight and a rider, and a body of radius 26 (the Barrelbeast) slides from (80,32) to (145,32) without touching anything',
        !blocked.length && !hit && e.x >= tc(TD.x(145)), { blocked: blocked.slice(0, 6), hit, at: +(e.x / TILE).toFixed(2) }); }

    // ---- C6. ride gate to gate on a mount ----
    { const rideOk = solidFor(T.GATE, 'rider') === false;
      if (!rideOk) check(P + 'C6 ride through Thistledown on a mount', false, { why: 'fix/mount-gates is not in this build' });
      else {
        const KINDS = [
          { kind: 'horse', name: 'mare', board: (tx, ty) => { changeTile(tx, ty, MOUNTS.tiles.HORSE); F.tp(tx - 1, ty); MOUNTS.mount(tx, ty); } },
          { kind: 'beast', name: 'Barrelbeast', board: (tx, ty) => { changeTile(tx, ty, BEAST.tiles.BEAST); for (const f of HOOKS.use) if (f(BEAST.tiles.BEAST, tx, ty)) break; } },
        ];
        const kindNow = () => player.mech ? (player.mech.kind || 'walker') : null;
        const board = (K, tx, ty) => { onFoot(); borrow(tx, ty); borrow(tx - 1, ty); F.tp(tx, ty); K.board(tx, ty); giveBack(); drain(); F.tp(tx, ty); F.step([]); return kindNow() === K.kind; };
        const log = {}; let ok = true;
        const runEW = (who) => {
          const WG = TD.x(85), EG = TD.x(140), cross = { [WG]: null, [EG]: null }; let s = 0, still = true;
          while (s < 4000 && player.x < tc(TD.x(144))) { F.sim(4, ['KeyD']); s += 4; const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE); if ((tx === WG || tx === EG) && cross[tx] === null) cross[tx] = ty; if (who && kindNow() !== who) still = false; }
          const east = player.x >= tc(TD.x(144));
          let b = 0; while (b < 4000 && player.x > tc(TD.x(81))) { F.sim(4, ['KeyA']); b += 4; if (who && kindNow() !== who) still = false; }
          const back = player.x <= tc(TD.x(81));
          return { east, back, cross, still, steps: [s, b], at: +(player.x / TILE).toFixed(2), rowsOk: [cross[WG], cross[EG]].every(r => r !== null && r >= TD.y(31) && r <= TD.y(33)) };
        };
        for (const K of KINDS) {
          const up = board(K, ...TD.p(80, 32));
          const ew = up ? runEW(K.kind) : null;
          const up2 = board(K, ...TD.p(111, 38));
          let s = 0; while (up2 && s < 1600 && player.y < tc(TD.y(44))) { F.sim(4, ['KeyS']); s += 4; }
          const inYard = player.y >= tc(TD.y(44));
          let b = 0; while (up2 && b < 1600 && player.y > tc(TD.y(39))) { F.sim(4, ['KeyW']); b += 4; }
          const out = player.y <= tc(TD.y(39)) && kindNow() === K.kind;
          log[K.kind] = { up, ew, up2, inYard, out };
          if (!(up && ew && ew.east && ew.back && ew.still && ew.rowsOk && up2 && inYard && out)) ok = false;
          onFoot();
        }
        // and on foot
        onFoot(); F.tp(...TD.p(80, 32)); F.step([]);
        const foot = runEW(null); log.foot = foot;
        if (!(foot.east && foot.back && foot.rowsOk)) ok = false;
        check(P + 'C6 on the mare and on the Barrelbeast the knight rides in through the West Gate, down the High Street and out of the East Gate (crossing both gate lines on rows 31..33, still mounted), and back; and from the fountain over the drawbridge into the castle yard and back; and on foot gate to gate', ok, log);
      }
      onFoot(); giveBack(); drain(); }

    // ---- C7. anchors on their tiles ----
    { const want = [[...ATLAS.port('thistledown.board'), 'BOARD'], [...TD.p(108, 28), 'STALL'], [...TD.p(109, 28), 'STALL'], [...TD.p(116, 28), 'STALL'], [...TD.p(117, 28), 'STALL'],
        [...ATLAS.port('thistledown.rail'), 'HITCH'], [...ATLAS.port('thistledown.house_portal'), 'HOUSE_PORTAL'], [...ATLAS.port('thistledown.dozer_bay'), 'DOZER_BAY'], [BRAZIER.x, BRAZIER.y, 'FIRE'],
        [...TD.p(112, 50), 'THRONE'], [...TD.p(135, 52), 'COFFINDOOR'], [...TD.p(88, 42), 'DUMMY'], [...TD.p(88, 44), 'DUMMY'], [...ATLAS.port('thistledown.agility_gate'), 'GATE']];
      for (const b of TOWN_BUILDINGS()) for (const [t, rx, ry] of b.f || []) if ([T.FORGE, T.ANVIL, T.WORKBENCH, T.WORKSHOP, T.ALCHEMY, T.OVEN].includes(t)) want.push([b.x + rx, b.y + ry, names[t]]);
      const bad = want.filter(([x, y, n]) => names[tileAt(x, y)] !== n).map(([x, y, n]) => `${x},${y} ${names[tileAt(x, y)]} want ${n}`);
      const marks = window.AGILITY ? AGILITY.COURSES.yard.marks.filter(([x, y]) => tileAt(x, y) !== AGILITY.TILES.MARK) : ['no AGILITY'];
      const open = [TD.p(111, 32), TD.p(112, 32), TD.p(113, 32), TD.p(111, 33), TD.p(112, 33), TD.p(113, 33), TD.p(111, 37), TD.p(111, 38), TD.p(111, 39), TD.p(110, 37), TD.p(112, 37)].filter(([x, y]) => SOLID.has(tileAt(x, y)));
      const stations = want.filter(w => ['FORGE', 'ANVIL', 'WORKBENCH', 'WORKSHOP', 'ALCHEMY', 'OVEN'].includes(w[2])).length;
      check(P + 'C7 every anchor is on its tile: the notice board, Greta\'s and Fennick\'s stalls, the hitching rail 119,27, the island portal, the dozer bay, the brazier 119,38, the forges, anvil, workbench, workshop, alchemy table and ovens, the throne, Death\'s coffin door, the dummies, the agility marks and its gate 87,50; the spawn cells and the Kings Walk are open',
        !bad.length && !marks.length && !open.length && stations >= 7, { bad, marks, open, stations }); }

    // ---- C8. people and spawns ----
    { const HOMES = { marta: TD.p(92, 21), aldous: TD.p(102, 21), rosalind: TD.p(125, 22), brakka: TD.p(93, 39), pim: TD.p(103, 39), dorran: TD.p(125, 46), duke: TD.p(112, 49), hale: TD.p(86, 43), tobin: TD.p(110, 33), greta: TD.p(108, 27), fennick: TD.p(116, 27), death2: TD.p(135, 50),
        v1: TD.p(100, 32), v2: TD.p(118, 32), v3: TD.p(112, 24), v4: TD.p(96, 33), v5: TD.p(128, 34), v6: TD.p(114, 40), skillmaster: TD.p(108, 44), captain: TD.p(110, 40),
        osric: TD.p(91, 30), ambrose: TD.p(110, 17), hettie: TD.p(114, 19), mabel: TD.p(119, 19), moll: TD.p(114, 25), wynn: TD.p(131, 24) };
      const bad = Object.keys(HOMES).filter(id => { const n = npc(id); return !n || n.x !== HOMES[id][0] || n.y !== HOMES[id][1]; }).map(id => { const n = npc(id); return id + (n ? '@' + n.x + ',' + n.y : ' missing'); });
      const GUARDS = ['guard_m@' + TD.p(89, 30), 'guard_m@' + TD.p(118, 36), 'guard_m@' + TD.p(113, 43), 'guard_f@' + TD.p(104, 23), 'guard_f@' + TD.p(126, 33), 'guard_f@' + TD.p(110, 43)];   // type@x,y
      const inT = MONSTER_SPAWNS.filter(s => inTown(s.tx, s.ty)).map(s => s.type + '@' + s.tx + ',' + s.ty).sort();
      const guardsOk = JSON.stringify(inT) === JSON.stringify(GUARDS.slice().sort());
      const roles = ['osric', 'ambrose', 'wynn'].every(id => HOOKS.talk[npc(id).role]) && ['hettie', 'mabel', 'moll'].every(id => npc(id).role === 'villager' && npc(id).lines.length === 2) && PLAN.PEOPLE.every(p => !npc(p.id).wander);
      check(P + 'C8 every town person stands where people expect them (the frozen table, plus the six new people, none of whom wander); the six guards are by type and tile and no other spawn is in the town; MONSTER_SPAWNS keeps its length (counted at the end of the world build)',
        !bad.length && guardsOk && roles && MONSTER_SPAWNS.length === SNAP.spawns && SNAP.spawns > 100, { bad, inT, guardsOk, roles, spawns: MONSTER_SPAWNS.length, atSnap: SNAP.spawns }); }

    // ---- C9. reach ----
    { const d = new Int32Array(MAP_W * MAP_H).fill(-1), q = [idx(...TD.p(80, 32))]; d[q[0]] = 0;
      for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0; for (const [dx, dy] of N4c) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny); if (d[n] >= 0 || SOLID.has(map[n])) continue; d[n] = d[c] + 1; q.push(n); } }
      const at = (x, y) => d[idx(x, y)];
      const reach = (x, y) => { let best = at(x, y); for (const [dx, dy] of N4c) { const v = at(x + dx, y + dy); if (v >= 0 && (best < 0 || v + 1 < best)) best = v + 1; } return best; };
      const miss = [];
      for (const b of TOWN_BUILDINGS()) { const [sx, sy] = stepOf(b); if (at(sx, sy) < 0) miss.push(b.id + ' step'); }
      // a person is reached when a knight can stand within talking range (118 px) on the same side of the walls (42-playthrough's rule): Marta and Aldous stand behind their counters
      const talkReach = (x, y) => { const ins = insideBuilding(x, y); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { if (Math.hypot(dx, dy) * TILE > 118) continue; if (insideBuilding(x + dx, y + dy) !== ins) continue; if (at(x + dx, y + dy) >= 0) return true; } return false; };
      for (const n of NPCS) if (inTown(n.x, n.y) && !talkReach(n.x, n.y)) miss.push(n.id);
      for (const s of MONSTER_SPAWNS) if (inTown(s.tx, s.ty) && at(s.tx, s.ty) < 0) miss.push(s.type + '@' + s.tx + ',' + s.ty);
      for (const [x, y] of [TD.p(92, 38), TD.p(94, 39), TD.p(100, 38), TD.p(102, 38), TD.p(104, 38), TD.p(112, 48), TD.p(105, 28), TD.p(117, 18), TD.p(134, 51), TD.p(135, 53), TD.p(133, 18), TD.p(111, 17), TD.p(133, 26), TD.p(130, 26), TD.p(86, 51), TD.p(142, 32)]) if (at(x, y) < 0) miss.push(x + ',' + y);
      const pc = window.PLAYTHROUGH ? PLAYTHROUGH.connectivity() : null, unreach = pc ? pc.unreachable : ['no PLAYTHROUGH'];
      const pockets = []; for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) if (glyph(x, y) !== '@' && !SOLID.has(tileAt(x, y)) && at(x, y) < 0) pockets.push(x + ',' + y);
      const paths = { duke: at(...TD.p(112, 48)), board: reach(...TD.p(105, 27)), forge: at(...TD.p(92, 38)), workbench: at(...TD.p(100, 38)), death: at(...TD.p(134, 51)), maze: at(...TD.p(133, 18)), eastGate: at(...TD.p(140, 32)), bell: at(...TD.p(111, 17)), captain: reach(...TD.p(110, 40)) };
      roadBack();
      check(P + 'C9 from outside the West Gate (80,32) a knight walks to every door step, every person, every guard, every station stand, the Duke, the board, the portal, the coffin, the sundial, the bell, the footbridge, the jetty, the agility start and out of the East Gate; the playthrough audit finds nothing unreachable; no walkable cell in the town is cut off',
        !miss.length && !unreach.length && !pockets.length, { miss, unreach: unreach.slice(0, 4), pockets: pockets.slice(0, 8), paths }); }

    // ---- C10. taps and uses ----
    { const bad = [];
      for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) { const t = tileAt(x, y); if (t !== PROP && t !== FOUNT && t !== HEDGE) continue; if (!kindAt(x, y) || !tapName(x, y) || !lineFor(x, y)) bad.push(x + ',' + y); }
      // groups: the cells of one thing (a fountain, the bell, a hedge row): each needs open ground beside it, except a hedge
      // row that is only scenery against the wall (as 91's K4 allows), which is counted and named
      const seen = new Set(), groups = []; const keyOf = (x, y) => { const k = kindAt(x, y); return k === 'great' || k === 'market' || k === 'rose' || k === 'bell' ? k : GREEN_KINDS.has(k) ? 'green' : k + '@' + x + ',' + y; };
      for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) { const t = tileAt(x, y); if ((t !== PROP && t !== FOUNT && t !== HEDGE) || seen.has(x + ',' + y)) continue; const key = keyOf(x, y), cells = [], st = [[x, y]]; seen.add(x + ',' + y);
        while (st.length) { const [cx, cy] = st.pop(); cells.push([cx, cy]); for (const [dx, dy] of N4c) { const nx = cx + dx, ny = cy + dy, kk = nx + ',' + ny; if (seen.has(kk) || !inTown(nx, ny) || ![PROP, FOUNT, HEDGE].includes(tileAt(nx, ny)) || keyOf(nx, ny) !== key) continue; seen.add(kk); st.push([nx, ny]); } }
        groups.push({ key, cells, open: cells.some(([cx, cy]) => N4c.some(([dx, dy]) => walkable(cx + dx, cy + dy))) }); }
      const lone = groups.filter(g => !g.open), loneProps = lone.filter(g => g.key !== 'green');
      const loneHedges = lone.filter(g => g.key === 'green').map(g => `${g.cells.length} hedge cells from ${g.cells[0]}`);
      // a tap on the middle of the Great Fountain walks to its rim and uses it
      setCoins(3); Q().tossArmed = 0; clearFolk(...TD.p(112, 33), 8); clearMonsters(...TD.p(112, 33), 6); drain(); onFoot();
      F.tp(...TD.p(112, 30)); F.step([]); screenTap(...TD.p(111, 35)); const walked = !!tap.kind; untilTapDone();
      const tapLine = texts()[0] || null, tapOk = !!tapLine && /^The Great Fountain\. People toss a coin in for luck\. Press E again to toss 1 coin\.$/.test(tapLine);
      // the west side of the fountain, where Tobin stands at 110,33: a tap from the West Gate road and from beside him, a
      // tap on the rim cell next to him, and E facing the rim from the west, all answer as the fountain (never as Tobin)
      const isFountain = l => !!l && /^The Great Fountain\. People toss a coin in for luck\./.test(l);
      const west = {};
      for (const [name, sx, sy, cx, cy] of [['tap 111,35 from 106,32', ...TD.p(106, 32), ...TD.p(111, 35)], ['tap 111,35 from 108,33', ...TD.p(108, 33), ...TD.p(111, 35)], ['tap 112,35 from 108,33', ...TD.p(108, 33), ...TD.p(112, 35)], ['tap 110,34 from the spawn', ...TD.p(112, 33), ...TD.p(110, 34)]]) {
        drain(); Q().tossArmed = 0; onFoot(); F.tp(sx, sy); F.step([]); screenTap(cx, cy); untilTapDone(); const l = texts()[0] || null; west[name] = { ok: isFountain(l), line: l, at: [Math.floor(player.x / TILE), Math.floor(player.y / TILE)] };
      }
      for (const [name, sx, sy, fx, fy] of [['E from 109,35 facing east', ...TD.p(109, 35), ...TD.p(110, 35)], ['E from 109,34 facing east', ...TD.p(109, 34), ...TD.p(110, 34)]]) {
        drain(); Q().tossArmed = 0; onFoot(); F.tp(sx, sy); F.face(fx, fy); F.step([]); F.press('KeyE'); const l = texts()[0] || null; west[name] = { ok: isFountain(l), line: l };
      }
      { drain(); Q().tossArmed = 0; onFoot(); F.tp(...TD.p(111, 33)); player.x = TD.x(111.4) * TILE; player.y = TD.y(33.3) * TILE; F.face(...TD.p(110, 34)); F.press('KeyE'); const l = texts()[0] || null; west['E from 111.4,33.3 facing 110,34'] = { ok: isFountain(l), line: l, ft: [frontTile(player).tx, frontTile(player).ty] }; }
      // and Tobin still talks when he is the one faced, and when he stands between the knight and the fountain
      { drain(); onFoot(); F.tp(...TD.p(109, 33)); F.face(...TD.p(110, 33)); F.step([]); F.press('KeyE'); const d0 = said()[0]; west['E on Tobin from 109,33'] = { ok: !!d0 && d0.who === npc('tobin').name, line: d0 && d0.text }; }
      { drain(); onFoot(); F.tp(...TD.p(110, 32)); player.y = tc(TD.y(32)) + 13; F.face(...TD.p(110, 34)); F.step([]); F.press('KeyE'); const d0 = said()[0]; west['E on Tobin, between the knight and the fountain'] = { ok: !!d0 && d0.who === npc('tobin').name, line: d0 && d0.text, ft: [frontTile(player).tx, frontTile(player).ty] }; }
      drain(); Q().tossArmed = 0;
      const westOk = Object.values(west).every(v => v.ok);
      // a tap on each statue reads its plaque
      const plaques = {};
      for (const s of PLAN.STATUES) { drain(); clearFolk(s.x, s.y, 8); clearMonsters(s.x, s.y, 6); F.tp(s.x, s.y === TD.y(35) ? TD.y(33) : TD.y(40)); F.step([]); screenTap(s.x, s.y); untilTapDone(); const d0 = said()[0]; plaques[s.id] = !!d0 && d0.who === 'Plaque' && d0.text === PLAQUES[s.id]; }
      // the six new people, each one's first line
      const st0 = quest.stage, R = Math.random; drain();
      quest.stage = Math.min(quest.stage, 5); Q().ambroseMet = false; Q().bell = 0; Q().osricN = 0; TALK.wynn = 0;
      const first = {}; Math.random = () => 0;
      try { for (const [id, want] of [['osric', OSRIC(Q())[0]], ['ambrose', 'I ring the bell at dawn and at dusk. When you hear it at dusk, get indoors or get your sword out.'], ['hettie', LINES.hettie[0]], ['mabel', LINES.mabel[0]], ['moll', LINES.moll[0]], ['wynn', WYNN[0]]]) { drain(); clearFolk(npc(id).x, npc(id).y, 6); F.talk(id); const d0 = said()[0]; first[id] = !!d0 && d0.text === want && d0.who === npc(id).name; } }
      finally { Math.random = R; quest.stage = st0; }
      const lampsLive = (() => { let n = 0; for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) if (tileAt(x, y) === PROP && kindAt(x, y) === 'lamp') n++; return n; })();
      const mabel22 = LINES.mabel[0].includes(`All ${lampsLive} of them`) && lampsLive === 22;
      check(P + 'C10 every prop, fountain and hedge cell has a kind, a tap name and a use line; every prop and fountain has open ground beside it (hedge rows may be scenery); a tap on the middle of the Great Fountain walks to its rim and gives its first line, from the West Gate road and from beside Tobin too, and E on its west rim is the fountain (Tobin still talks when faced); a tap on each statue reads its plaque; Osric, Ambrose, Hettie, Mabel, Moll and Wynn each give their first line; Mabel counts the 22 lamps',
        !bad.length && !loneProps.length && walked && tapOk && westOk && Object.values(plaques).every(Boolean) && Object.values(first).every(Boolean) && mabel22,
        { bad: bad.slice(0, 6), groups: groups.length, loneProps: loneProps.map(g => g.key), loneHedges, walked, tapLine, west, plaques, first, lampsLive }); }

    // ---- C10b. a tap on a town thing near one of the town's people answers as the thing, from every side it can be reached ----
    { leave(); onFoot(); drain(); const wrong = []; let tried = 0;
      const stay = STAYERS();
      for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) {
        const t = tileAt(x, y), k = kindAt(x, y);
        if (!k || !(t === PROP || t === HEDGE) || ['bell', 'sundial', 'great'].includes(k)) continue;
        if (!stay.some(n => Math.abs(n.x - x) <= 2 && Math.abs(n.y - y) <= 2)) continue;
        const want = lineFor(x, y); if (!want) continue;
        for (const [dx, dy] of N4) {
          const sx = x + dx, sy = y + dy;
          if (SOLID.has(tileAt(sx, sy)) || stay.some(n => n.x === sx && n.y === sy)) continue;
          drain(); F.tp(sx, sy); tap.useTile = { tx: x, ty: y }; tap.kind = 'use'; tap.goal = { tx: x, ty: y }; tapUseNow(); tried++;
          const d0 = said()[0];
          if (!d0 || d0.who !== want[0]) wrong.push([x, y, k, sx, sy, d0 ? d0.who : null]);
        }
      }
      drain(); tapCancel('manual');
      check(P + 'C10b a tap on a stall, a bench, a hedge, a lamp or a statue beside one of the town\'s people answers as the thing from every side it can be reached (the sellers too: E still talks over a counter)',
        tried >= 20 && !wrong.length, { tried, wrong: wrong.slice(0, 8) }); }

    // ---- C10c. greenery and water no one can stand beside: a tap walks to the nearest reachable cell of the same bed or water ----
    { leave(); onFoot(); drain(); F.tp(...TD.p(112, 33)); F.step([]);
      // what a knight on foot can reach from the fountain (4 ways, through anything not solid)
      const reach = new Uint8Array(MAP_W * MAP_H), q = [idx(...TD.p(112, 33))]; reach[q[0]] = 1;
      for (let i = 0; i < q.length; i++) { const c = q[i], cx = c % MAP_W, cy = Math.floor(c / MAP_W); for (const [dx, dy] of N4) { const x = cx + dx, y = cy + dy; if (!inMap(x, y) || x < TOWN.x0 - 8 || x > TOWN.x1 + 8 || y < TOWN.y0 - 8 || y > TOWN.y1 + 8) continue; const j = idx(x, y); if (reach[j] || SOLID.has(map[j])) continue; reach[j] = 1; q.push(j); } }
      const usable = (x, y) => N4.some(([dx, dy]) => inMap(x + dx, y + dy) && reach[idx(x + dx, y + dy)]);
      let lone = 0, sent = 0, hedgeMid = null; const stuck = [];
      for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) {
        const t = tileAt(x, y); if (!(t === HEDGE || t === T.WATER) || usable(x, y)) continue;
        lone++; const r = reachableTwin({ kind: 'use', tx: x, ty: y, t });
        if (r && usable(r[0], r[1])) { sent++; if (!hedgeMid && t === HEDGE) hedgeMid = [x, y]; } else stuck.push(x + ',' + y);
      }
      // the one bed no one can reach: the hedge between the agility track's fence and the south wall (scenery)
      const scenery = stuck.every(c => { const [x, y] = c.split(',').map(Number); return y === TD.y(55) && x >= TD.x(87) && x <= TD.x(102); });
      // and through a real tap (tapPick): the swans' water in the middle of Swan Pond, the south moat, a hedge's middle
      const viaTap = {};
      for (const [x, y] of [TD.p(136, 26), TD.p(112, 55)].concat(hedgeMid ? [hedgeMid] : [])) {
        const t = tileAt(x, y); F.tp(x, Math.max(TOWN.y0 + 2, y - 3)); F.step([]); render();
        const p = tapPick(tc(x) - cam.x, tc(y) - cam.y);
        viaTap[x + ',' + y] = !!p && p.kind === 'use' && tileAt(p.tx, p.ty) === t && usable(p.tx, p.ty) && !usable(x, y);
      }
      check(P + 'C10c a tap on greenery or water no one can stand beside (the middle of a bed, Swan Pond where the swans swim, the far sides of the moat) walks to the nearest reachable cell of the same bed or water; only the hedge row behind the agility fence (scenery) has none',
        lone >= 20 && sent >= 20 && scenery && !!hedgeMid && Object.values(viaTap).length === 3 && Object.values(viaTap).every(Boolean), { lone, sent, stuck, viaTap }); }

    // ---- C11. the coin toss ----
    { drain(); clearFolk(...TD.p(111, 33), 8); clearMonsters(...TD.p(111, 33), 6); onFoot(); F.tp(...TD.p(111, 33)); F.face(...TD.p(111, 34)); setCoins(5); const q = Q(); q.tossArmed = 0; const t0 = q.tossed;
      F.press('KeyE'); const l1 = texts()[0], c1 = coins(); drain();
      F.sim(30, []); F.press('KeyE'); const l2 = texts()[0], c2 = coins(), t2 = q.tossed; drain();
      setCoins(0); F.sim(10, []); F.press('KeyE'); const l3 = texts()[0], c3 = coins(), t3 = q.tossed; drain();
      // and after 6 s the toss is not armed any more: E gives the first line again
      setCoins(2); F.sim(400, []); F.press('KeyE'); const l4 = texts()[0], c4 = coins(); drain();
      // E five times running on a keyboard (it does not turn the page): one line on the page at a time, the newest toss
      setCoins(5); q.tossArmed = 0; const t5 = q.tossed; for (let k = 0; k < 5; k++) { F.press('KeyE'); F.sim(6, []); }
      const page = texts(), c5 = coins(), quick = page.length === 1 && page[0] === TOSS[(q.tossed - 1) % 6] && q.tossed === t5 + 4 && c5 === 1; drain();
      check(P + 'C11 the coin toss: one E gives the line and spends nothing; a second E within 6 s costs exactly 1 coin and counts the toss; with no coins it says so and nothing changes; after 6 s E gives the first line again; E pressed five times running shows one line, the newest toss, never a stack',
        /^The Great Fountain\. People toss a coin/.test(l1 || '') && c1 === 5 && l2 === TOSS[t0 % 6] && c2 === 4 && t2 === t0 + 1 && l3 === 'You have no coins to toss.' && c3 === 0 && t3 === t2 && /^The Great Fountain\. People toss/.test(l4 || '') && c4 === 2 && quick,
        { l1, c1, l2, c2, tossed: [t0, t2, t3], l3, c3, l4, c4, page, c5 }); }

    // ---- C12. the clock and the bell ----
    { const N = window.NIGHT, d0 = player.dayTime;
      player.dayTime = N.LIGHT - 250; const a = timeLine(); player.dayTime = N.LIGHT + N.DUSK - 35; const b = timeLine(); player.dayTime = N.DAY - 61; const c = timeLine();
      const words = [spanWords(250), spanWords(35), spanWords(61), spanWords(60), spanWords(1), spanWords(0.2), spanWords(121)];
      onFoot(); F.tp(...TD.p(112, 33)); F.step([]); const region = player.region;
      player.dayTime = N.LIGHT - 0.5; BELLST.prev = null; F.step([]); const r0 = BELLST.rings; F.sim(90, []); const rang = BELLST.rings - r0;
      F.sim(60, []); const again = BELLST.rings - r0;
      // and once at midnight: BONG, the ghost of the story
      player.dayTime = MIDNIGHT(N) - 0.5; BELLST.prev = null; F.step([]); const m0 = BELLST.midnights, mr0 = BELLST.rings; F.sim(90, []); const midnight = BELLST.midnights - m0, midRings = BELLST.rings - mr0;
      player.dayTime = 100; const ang = Math.abs(dialAngle() - N.dayT() / N.DAY * Math.PI * 2) < 1e-9;
      player.dayTime = d0; BELLST.prev = null;
      check(P + 'C12 Ambrose reads the clock ("The sun is up. Dusk comes in 4 minutes 10 seconds.", "Dusk. It will be dark in 35 seconds.", "Night. The sun comes up in 1 minute 1 second."); with the knight at the fountain the bell rings exactly once as dusk comes, and exactly once at midnight (BONG); the dial\'s hand is dayT / DAY x 2 pi',
        a === 'The sun is up. Dusk comes in 4 minutes 10 seconds.' && b === 'Dusk. It will be dark in 35 seconds.' && c === 'Night. The sun comes up in 1 minute 1 second.' && words.join('|') === '4 minutes 10 seconds|35 seconds|1 minute 1 second|1 minute|1 second|1 second|2 minutes 1 second' && region === 'Thistledown' && rang === 1 && again === 1 && midnight === 1 && midRings === 1 && ang,
        { a, b, c, words, region, rang, again, midnight, midRings, ang }); }

    // ---- C13. the story ----
    { const st0 = quest.stage, c0 = coins(), q = Q(), log = [];
      const tq = () => HOOKS.questText.td_bell(), mt = () => mapTargets().find(m => m.id === 'td_bell') || null;
      const step = (label) => { const m = mt(), b = Q().bell; log.push({ label, bell: b, text: tq() === (typeof QTEXT[b] === 'function' ? QTEXT[b]() : QTEXT[b]), target: b === 'done' ? !m : !!m && TARGETS[b] && m.x === TARGETS[b][0] && m.y === TARGETS[b][1], active: activeQuests().includes('td_bell') === storyOpen() }); };
      Object.assign(q, fresh()); drain(); quest.stage = 5;
      F.talk('ambrose'); const before = q.bell === 0 && !texts().some(t => /silly/.test(t)); drain();
      quest.stage = 6; clearBanners();
      F.talk('ambrose'); const newQ = q.bell === 1 && bannerAhead('NEW QUEST'); step('ambrose'); drain();
      F.talk('osric'); step('osric'); drain();
      F.talk('rosalind'); const noShop = panel !== 'shop'; step('rosalind'); drain(); closePanel();
      // a save and a load in the middle of the story keep the step
      save(); const okLoad = load(); F.step([]); const kept = Q().bell === 3 && okLoad; drain();
      onFoot(); F.tp(...TD.p(133, 18)); F.face(...TD.p(132, 18)); F.press('KeyE'); step('sundial'); drain();
      F.talk('ambrose'); step('ambrose 2'); drain();
      onFoot(); F.tp(...TD.p(111, 17)); F.face(...TD.p(111, 16)); F.press('KeyE'); const rang = BELLST.rings; step('bell'); drain();
      clearBanners(); const c1 = coins();
      F.talk('ambrose'); const noGhost = bannerAhead('NO GHOST') && coins() === c1 + 75; step('ambrose 3'); drain();
      F.talk('rosalind'); const shop = panel === 'shop'; closePanel(); drain();
      const order = log.map(l => l.bell).join(',');
      const duke = HOOKS.talkBefore.duke === DUKE_TALK0 && npc('duke').role === 'duke';
      // a new game puts the story back to the start
      const keepQ = JSON.stringify(quest.capital); RESET(); const reset = quest.capital.bell === 0 && quest.capital.tossed === 0 && player.cityV === 1; quest.capital = JSON.parse(keepQ);
      quest.stage = st0; setCoins(c0);
      check(P + 'C13 The Bell at Midnight: at stage 5 Ambrose has only his own line; at stage 6 the story goes Ambrose, Osric, Rosalind (no shop that time), the sundial, Ambrose, the Bell Tower, Ambrose: 1,2,3,4,5,6,done, with NEW QUEST and NO GHOST and exactly 75 coins; the quest log and the map ring are right at every step; Rosalind\'s next talk opens her shop; the Duke\'s talk is not touched; a save and load keeps the step; a new game resets it',
        before && newQ && order === '1,2,3,4,5,6,done' && log.every(l => l.text && l.target && l.active) && noShop && kept && noGhost && shop && duke && reset && rang >= 1,
        { before, newQ, order, log, noShop, kept, noGhost, shop, duke, reset }); }

    // ---- C13b. the words of the story: no key that never comes, the keys the child has in his hands, Ambrose's hello ----
    { const st0 = quest.stage, q = Q(), keep = JSON.stringify(q), t0 = window.__forceTouch; drain();
      Object.assign(q, fresh()); quest.stage = 6; F.talk('ambrose'); const hello = said().map(d => d.text), first = hello[0] === AMBROSE_HELLO && hello.some(t => /silly/.test(t)) && q.ambroseMet; drain();
      q.bell = 4; F.talk('ambrose'); const keyless = !said().some(d => /\bkey\b/i.test(d.text)) && said().some(d => /unlock the tower door/.test(d.text)); drain();
      window.__forceTouch = false; const desk = HOOKS.questText.td_bell(); window.__forceTouch = true; const touch = HOOKS.questText.td_bell(); window.__forceTouch = t0;
      const log = /press E\./.test(desk) && /tap USE/.test(touch) && !/press E/.test(touch) && !/\bkey\b/i.test(desk + touch);
      Object.assign(q, JSON.parse(keep)); quest.stage = st0; drain();
      // and he is a quest giver on the maps, as every other one in town is (61-markers' QUEST_ROLES)
      let marked = null; if (window.MARKERS && MARKERS.refresh && MARKERS.all) { MARKERS.refresh(); marked = MARKERS.all().some(m => m.kind === 'quest' && /Ambrose/.test(m.label || '')); }
      check(P + "C13b at stage 6 Ambrose's first talk opens with his own hello, then the story; no 'key' is promised (he unlocks the door); the quest log says press E on a keyboard and tap USE on a touch screen; Ambrose has a Quest marker on the maps",
        first && keyless && log && marked === true, { hello, keyless, desk, touch, marked }); }

    // ---- C14. the plinth ----
    { const st0 = quest.stage, q = Q(); drain();
      quest.stage = 15; const empty = lineFor(PL.x, PL.y)[1] === 'AN EMPTY PLINTH. Carved on the front: KEPT FOR THE KNIGHT WHO ENDS THE DRAGON.' && tapName(PL.x, PL.y) === 'Empty plinth';
      q.heroName = null; q.plinthTold = false; quest.stage = 16;
      // other lines may be showing at stage 16 (the Voice waits for an empty page): read and clear the page three times
      const LINE = 'The empty plinth by the castle gate is empty no longer.';
      onFoot(); F.tp(...TD.p(113, 37)); let told = 0; for (let k = 0; k < 3; k++) { F.sim(20, []); told += said().filter(d => d.text === LINE).length; drain(); }
      const name = q.heroName; F.sim(20, []); const told2 = said().filter(d => d.text === LINE).length;
      const plaque = lineFor(PL.x, PL.y)[1] === `${name}, WHO SLEW THE FANG. Thistledown will not forget.` && tapName(PL.x, PL.y) === 'Statue of you';
      STATS.record = true; render(); const box = STATS.boxes.find(b => b.x0 === tc(PL.x) - 22 && b.y1 === (PL.y + 1) * TILE); STATS.record = false;
      const statue = !!box && box.y0 === (PL.y + 1) * TILE - 92;
      const fangRoad = !SOLID.has(tileAt(...TD.p(112, 48))) && regionAt(...TD.p(112, 48)).name === 'Castle Thistledown' && !!HOOKS.mainQuest[16];
      // online: 71-login loads the save first and the world's welcome (with the knight's name) comes a moment later. While
      // it is on its way no name is saved; then the plinth carries his own name. A name saved offline gives way to it.
      const net0 = window.NET ? { enabled: NET.enabled, status: NET.status, me: NET.me } : null, online = {};
      if (net0) {
        try {
          q.heroName = null; NET.enabled = true; NET.status = 'connecting'; NET.me = null;
          for (let k = 0; k < 3; k++) heroTick(q); online.waiting = q.heroName;
          NET.status = 'on'; NET.me = 'Cohen'; heroTick(q); online.named = q.heroName; online.plaque = lineFor(PL.x, PL.y)[1];
          q.heroName = OFFLINE_HERO; heroTick(q); online.repaired = q.heroName;
          NET.status = 'off'; NET.me = null; NET.enabled = false; q.heroName = null; heroTick(q); online.offline = q.heroName;
        } finally { NET.enabled = net0.enabled; NET.status = net0.status; NET.me = net0.me; }
      }
      const onlineOk = !net0 || (online.waiting === null && online.named === 'COHEN' && online.plaque === 'COHEN, WHO SLEW THE FANG. Thistledown will not forget.' && online.repaired === 'COHEN' && online.offline === OFFLINE_HERO);
      q.heroName = name;
      quest.stage = st0; drain();
      check(P + 'C14 the waiting plinth: before stage 16 it is empty; at stage 16 it holds the knight (his name saved once, offline THE KNIGHT FROM THE CAVE), the plaque carries the name, the statue is drawn, and the Voice says so exactly once; online no name is saved until the world says who he is, then it is his own (COHEN), and an offline name gives way to it; the Fang\'s homecoming tile 112,48 is still open in the castle',
        empty && name === 'THE KNIGHT FROM THE CAVE' && told === 1 && told2 === 0 && plaque && statue && fangRoad && onlineOk, { empty, name, told, told2, plaque, statue, box, fangRoad, online }); }

    // ---- C14b. the statue is the knight as drawn everywhere else (82-knightgear), in stone, in what he wears ----
    if (window.KNIGHTGEAR) {
      const K = KNIGHTGEAR, st0 = quest.stage, eq0 = Object.assign({}, player.equip), r = {};
      // a context that keeps every colour set (fills, strokes, gradient stops)
      const cols = [], rg = new Proxy({}, { get: (o, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: (t, c) => cols.push(c) }) : (k in o ? o[k] : () => { }), set: (o, k, v) => { if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string') cols.push(v); o[k] = v; return true; } });
      const rgb = c => { let m = /^#([0-9a-f]{6})$/i.exec(c); if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; } m = /^rgba?\(([\d.]+),([\d.]+),([\d.]+)/.exec(String(c).replace(/\s/g, '')); return m ? [+m[1], +m[2], +m[3]] : null; };
      try {
        quest.stage = 16;
        // the Dragon slayer's kit and its upright spear (the tallest thing a knight holds)
        Object.assign(player.equip, { helm: 'dragon_helm', body: 'dragon_body', legs: 'dragon_legs', shield: null, cape: 'cape_melee', weapon: 'dragon_spear' });
        const look = heroLook(), f = heroFit(look), x = K.extent(look), fb = K.extent({ gear: {}, fists: true }).b;
        r.look = !!look.stone && !!look.gear && look.gear.helm === 'dragon_helm' && look.gear.weapon === 'dragon_spear';
        // in the sprite (96 x 96, anchored 48, 90): his top under its top, his sides inside it, his feet on the plinth
        r.fits = f.y0 + x.t * f.s >= -90 && Math.max(-x.l, x.r) * f.s <= 48 && Math.abs(f.y0 + fb * f.s - HERO_FEET) < 0.01 && f.s > 0.9 && f.s <= 1.32;
        // drawn: the new knight's drawing runs (in the stone palette) when the sprite is made, and not again while he
        // wears the same; a change of helm makes a new one (the two sprites are dropped first: an earlier run made them)
        const other = heroLook(); other.gear.helm = 'iron_helm';
        delete CACHE[heroKey(look)]; delete CACHE[heroKey(other)];
        const t0 = K.STATS.tinted, l0 = K.STATS.live; drawPlinth(ctx); r.made = [K.STATS.tinted - t0, K.STATS.live - l0];
        const l1 = K.STATS.live; drawPlinth(ctx); r.again = K.STATS.live - l1;
        player.equip.helm = 'iron_helm'; const l2 = K.STATS.live; drawPlinth(ctx); r.changed = K.STATS.live - l2;
        r.keys = heroKey(look) !== heroKey(other);
        // all of him in stone: every colour he sets is grey stone (no channel more than 14 from another)
        cols.length = 0; drawHuman(rg, { x: 0, y: 0, r: 13, facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, moving: false, walkT: 0 }, heroLook());
        const parsed = cols.map(rgb).filter(Boolean);
        r.stone = parsed.length >= 40 && parsed.every(([a, b, c]) => Math.max(a, b, c) - Math.min(a, b, c) <= 14);
        r.colours = parsed.length;
        // in a party hat with a bow: the laurel rings the hat's brim (a flat ring, not an arc over the cone's middle), and
        // the sprite is cut at the plinth's top (the bow at his side reached down over its front and its laurel)
        Object.assign(player.equip, { helm: 'party_hat_red', body: 'silk_cloak', legs: null, cape: 'cape_hitpoints', weapon: 'yew_bow' });
        const pl = heroLook(); delete CACHE[heroKey(pl)];
        const ops = []; const og = new Proxy({}, { get: (o, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in o ? o[k] : (...a) => ops.push(k + ' ' + a.filter(v => typeof v === 'number').map(v => v.toFixed(1)).join(' '))), set: (o, k, v) => { if (k === 'strokeStyle' && v === GOLD) ops.push('GOLD'); o[k] = v; return true; } });
        drawPlinth(og);
        const g0 = ops.lastIndexOf('GOLD'), after = ops.slice(g0);
        r.brim = heroParty(pl) && after.some(o => o.startsWith('ellipse ')) && !after.some(o => o.startsWith('arc '));
        // the sprite's own painting: a clip at the plinth's top before the knight
        const sp = []; const sg = new Proxy({}, { get: (o, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in o ? o[k] : (...a) => sp.push(k + ' ' + a.filter(v => typeof v === 'number').map(v => v.toFixed(1)).join(' '))), set: (o, k, v) => { o[k] = v; return true; } });
        const _sprite = sprite; let painted = false;
        try { sprite = (key, w, h, ax, ay, paint) => { if (key === heroKey(pl) && !painted) { painted = true; paint(sg); } return _sprite(key, w, h, ax, ay, paint); }; delete CACHE[heroKey(pl)]; drawPlinth(ctx); } finally { sprite = _sprite; }
        r.cut = sp.includes('rect -48.0 -96.0 96.0 66.0') && sp.indexOf('clip ') > sp.indexOf('rect -48.0 -96.0 96.0 66.0');
      } catch (err) { r.threw = String(err && err.message); }
      finally { for (const k in player.equip) if (!(k in eq0)) delete player.equip[k]; Object.assign(player.equip, eq0); quest.stage = st0; }
      check(P + 'C14b the statue on the plinth is the knight as he is drawn everywhere (82-knightgear) in what he wears, all of him in stone: the Dragon slayer\'s kit with its upright spear fits the sprite with his feet on the plinth, the drawing runs once to make the sprite, again only when his gear changes; in a party hat the laurel rings its brim, and nothing of him hangs below the plinth\'s top',
        !r.threw && r.look && r.fits && r.made[0] >= 1 && r.made[1] >= 1 && r.again === 0 && r.changed >= 1 && r.keys && r.stone && r.brim && r.cut, r); }

    // ---- C14c. the Last Knight of Hollowford at the Great Fountain is a knight drawn as every knight is (82-knightgear), in
    // stone, inside his sprite with his feet on the plinth ----
    if (window.KNIGHTGEAR) {
      const look = STATUE_LOOK.last_knight, K = KNIGHTGEAR, r = {};
      try {
        r.knight = !!look.gear && !!look.stone && look.gear.weapon === 'iron_sword';
        const f = heroFit(look, (STATUE_HALF.last_knight || 24) - 1), x = K.extent(look), fb = K.extent({ gear: {}, fists: true }).b;
        r.fits = f.y0 + x.t * f.s >= -90 && Math.max(-x.l, x.r) * f.s <= (STATUE_HALF.last_knight || 24) && Math.abs(f.y0 + fb * f.s - HERO_FEET) < 0.01 && f.s >= 1;
        const s0 = STATS.statues; delete CACHE['statue:last_knight']; const l0 = K.STATS.live; drawStatue(ctx, PLAN.STATUES.find(s => s.id === 'last_knight'));
        r.drawn = K.STATS.live - l0 === 1 && STATS.statues === s0 + 1;
      } catch (err) { r.threw = String(err && err.message); }
      check(P + 'C14c the Last Knight of Hollowford at the Great Fountain is a knight in the new look (82-knightgear), in stone, his sword upright at his side, inside his sprite with his feet on the plinth', !r.threw && r.knight && r.fits && r.drawn, r); }

    // ---- C15. night ----
    { const N = window.NIGHT, d0 = player.dayTime;
      onFoot(); F.tp(...TD.p(112, 33)); F.step([]);
      player.dayTime = N.LIGHT + N.DUSK + 30;
      const all = []; for (const f of HOOKS.nightLights) f(all, 0, 0, MAP_W - 1, MAP_H - 1);
      const lamps = all.filter(l => l.kind === 'lamp').length, torches = all.filter(l => l.kind === 'torch').length;
      const ov = N.overlay();
      // the night painter (35-night's drawNight, inside render) asks this file for its lights: a spy in townLights' place sees
      // the call and the lamps it is handed back (so a build where the night never reads the hook fails here)
      const at = HOOKS.nightLights.indexOf(townLights); let asked = 0, handed = 0;
      if (at >= 0) HOOKS.nightLights[at] = (out, ...a) => { asked++; const n0 = out.length; townLights(out, ...a); handed += out.slice(n0).filter(l => l.kind === 'lamp' && l.r === LAMP_R).length; };
      try { render(); } finally { if (at >= 0) HOOKS.nightLights[at] = townLights; }
      const litN = STATS.lampsLit;
      player.dayTime = 100; const day = []; for (const f of HOOKS.nightLights) f(day, 0, 0, MAP_W - 1, MAP_H - 1);
      player.dayTime = N.LIGHT + N.DUSK + 30;
      const inst = window.INSTANCES && INSTANCES.enter('aerie', [SKYCITY.STEP_T.x, SKYCITY.STEP_T.y]); const inside = []; for (const f of HOOKS.nightLights) f(inside, 0, 0, MAP_W - 1, MAP_H - 1); leave();
      player.dayTime = d0;
      check(P + 'C15 at night every lamp is a light (22 over the whole town, each a pool of 72 px), the wall torches light up, the night overlay is on, the night painter asks this file for its lights while rendering and gets the lamps in view, the lamps in view are drawn lit; by day no lamp is lit; in an instance the town lights nothing',
        lamps === 22 && all.filter(l => l.kind === 'lamp').every(l => l.r === LAMP_R) && LAMP_R <= 80 && torches === TORCHES.size && torches > 10 && ov > 0 && at >= 0 && asked >= 1 && handed >= 4 && litN > 0 && day.filter(l => l.kind === 'lamp').length === 0 && !!inst && inside.length === 0,
        { lamps, torches, ov, asked, handed, litN, day: day.length, inst: !!inst, inside: inside.length }); }

    // ---- C16. instances ----
    { leave(); const ok = INSTANCES.enter('aerie', [SKYCITY.STEP_T.x, SKYCITY.STEP_T.y]); F.sim(2, []); drain(); F.tp(92, 40);
      const cap = { items: null }; const hook = (g, items) => { cap.items = items; }; HOOKS.draw.push(hook);
      let calls = 0;
      try { render(); } finally { HOOKS.draw.splice(HOOKS.draw.indexOf(hook), 1); }
      const ours = (cap.items || []).filter(i => i.capital).length;
      const town = STATS.townBuildings, towers = STATS.towers;
      const { g } = recorder(); const store = BUILDINGS.find(b => b.id === 'store');
      const before = STATS.townBuildings; drawBuilding(g, store || { town: true, x: 0, y: 0, w: 1, h: 1, roof: '#000000' }); calls = STATS.townBuildings - before;
      leave();
      check(P + 'C16 in Aerie the town draws nothing: no capital item is pushed, no town building or tower is drawn, and drawBuilding hands a town building straight to what it wrapped',
        !!ok && ours === 0 && town === 0 && towers === 0 && calls === 0, { ok: !!ok, ours, town, towers, calls }); }

    // ---- C17. an old save ----
    { leave(); onFoot(); drain(); save();
      const sk = 'fanglands.slot.' + title.slot, raw0 = localStorage.getItem(sk), mirror0 = localStorage.getItem(SAVE_KEY);
      const d = JSON.parse(raw0 || mirror0);
      const cells = { bed: TD.p(111, 35), lode: TD.p(130, 21), fire: TD.p(100, 32), crop: TD.p(131, 51), horse: TD.p(114, 25), mech: TD.p(112, 35), wreck: TD.p(86, 32) };
      const touched = Object.values(cells);
      d.player.visitedVillage = true; delete d.player.cityV; d.player.x = tc(TD.x(103)); d.player.y = tc(TD.y(45)); d.player.mech = null; d.player.r = 13; d.player.speed = 175; d.player.dead = false; d.player.hp = Math.max(1, d.player.hp || 10);
      d.player.bedSpawn = { x: tc(TD.x(111)), y: tc(TD.y(35)) }; d.player.home = { x: tc(TD.x(130)), y: tc(TD.y(22)) };
      d.player.horse = { owned: true, hp: (MOUNTS.HP || 30), at: cells.horse, under: 'COBBLE' };
      d.player.inv = (d.player.inv || []).map((s, i) => i < 16 ? s : null);
      const ix = ([x, y]) => idx(x, y);
      d.mapDiffs = (d.mapDiffs || []).filter(([i]) => { const x = i % MAP_W, y = Math.floor(i / MAP_W); return !inTown(x, y); })
        .concat([[ix(cells.bed), 'BED'], [ix(cells.lode), 'LODESTONE'], [ix(cells.fire), 'FIRE'], [ix(cells.crop), 'CROP'], [ix(cells.horse), 'HORSE'], [ix(cells.mech), 'MECH'], [ix(cells.wreck), 'WRECK']]);
      d.fires = [{ i: ix(cells.fire), timer: 600 }]; d.crops = [{ i: ix(cells.crop), stage: 1, t: 0, crop: 'potato' }];
      const packBefore = { bed: (d.player.inv || []).filter(s => s && s.id === 'bed').reduce((a, s) => a + s.qty, 0), lodestone: (d.player.inv || []).filter(s => s && s.id === 'lodestone').reduce((a, s) => a + s.qty, 0) };
      const crafted = JSON.stringify(d);
      localStorage.setItem(sk, crafted); localStorage.setItem(SAVE_KEY, crafted);
      const log0 = MIG.log.length;
      const ok = load(); F.step([]);
      const lines = texts();
      // the walker parked on what is now the Great Fountain, and a wreck in the West Gate's mouth: moved, never lost
      const movedTo = (cell, name) => { const m = MIG.log.slice(log0).find(e => e[0] === cell[0] && e[1] === cell[1] && e[3] === 'moved'); return m && T[name] === tileAt(m[4], m[5]) && mapDiffs.get(idx(m[4], m[5])) === T[name] && tileAt(cell[0], cell[1]) === base[pi(cell[0], cell[1])] && Math.max(Math.abs(m[4] - cell[0]), Math.abs(m[5] - cell[1])) <= 4 ? [m[4], m[5]] : null; };
      const r = {
        ok, bed: tileAt(...cells.bed) === base[pi(...cells.bed)] && !mapDiffs.has(ix(cells.bed)), lode: tileAt(...cells.lode) === base[pi(...cells.lode)] && !mapDiffs.has(ix(cells.lode)),
        refunded: countItem('bed') === packBefore.bed + 1 && countItem('lodestone') === packBefore.lodestone + 1, spawnCleared: !player.bedSpawn && !player.home,
        fire: tileAt(...cells.fire) === T.FIRE && fires.some(f => f.i === ix(cells.fire)), crop: tileAt(...cells.crop) === T.CROP && crops.some(c => c.i === ix(cells.crop)),
        horseAt: player.horse && player.horse.at, horseOk: !!(player.horse && player.horse.at && tileAt(player.horse.at[0], player.horse.at[1]) === MOUNTS.tiles.HORSE && Math.max(Math.abs(player.horse.at[0] - MOUNTS.post.x), Math.abs(player.horse.at[1] - MOUNTS.post.y)) <= 3 && !keepClear().has(idx(player.horse.at[0], player.horse.at[1]))),
        oldHorse: tileAt(...cells.horse) === base[pi(...cells.horse)],
        free: !collides(player.x, player.y, player.r, playerWho()),
        voice: lines.filter(l => l === 'Thistledown has been rebuilt while you were away. Go and see the Great Fountain.').length, back: lines.filter(l => l === 'Back in your pack: 1 bed and 1 lodestone.').length, bedTold: lines.filter(l => /bed you slept in is gone/.test(l)).length,
        cityV: player.cityV,
        mech: movedTo(cells.mech, 'MECH'), wreck: movedTo(cells.wreck, 'WRECK'),
      };
      drain(); save(); const snapDiffs = JSON.stringify([...mapDiffs.entries()]), rev0 = MIG.reverted, at0 = [player.x, player.y], horse0 = JSON.stringify(player.horse);
      const ok2 = load(); F.step([]);
      r.second = ok2 && JSON.stringify([...mapDiffs.entries()]) === snapDiffs && MIG.reverted === rev0 && Math.abs(player.x - at0[0]) < 1 && Math.abs(player.y - at0[1]) < 1 && JSON.stringify(player.horse) === horse0 && texts().length === 0;
      // put the save, the map and the knight back as they were
      const horseCell = player.horse && player.horse.at, movedCells = MIG.log.slice(log0).filter(e => e[3] === 'moved').map(e => [e[4], e[5]]);
      for (const c of touched.concat(horseCell ? [horseCell] : [], movedCells)) setTile(c[0], c[1], base[pi(c[0], c[1])]);
      if (raw0 !== null) localStorage.setItem(sk, raw0); if (mirror0 !== null) localStorage.setItem(SAVE_KEY, mirror0);
      load(); F.step([]); drain();
      check(P + 'C17 an old save loads into the new city: the bed in the fountain and the lodestone in the hedge are taken back and refunded (bedSpawn and home cleared), the fire on the street and the crop in the allotment stay, the mare in the flower stall is re-parked beside the rail on open ground, the knight saved in the moat stands clear, the Voice says the city was rebuilt, "Back in your pack: 1 bed and 1 lodestone." and that his bed is gone, once each; a second load changes nothing',
        r.ok && r.bed && r.lode && r.refunded && r.spawnCleared && r.fire && r.crop && r.horseOk && r.oldHorse && r.free && r.voice === 1 && r.back === 1 && r.bedTold === 1 && r.cityV === 1 && r.second && !!r.mech && !!r.wreck, r); }

    // ---- C17b. an old save's things where new houses stand and on the High Street, a full pack and bank, the inn's bed, and a
    // knight saved on his own door where a hedge now grows ----
    { leave(); onFoot(); drain(); save();
      const sk = 'fanglands.slot.' + title.slot, raw0 = localStorage.getItem(sk), mirror0 = localStorage.getItem(SAVE_KEY);
      const d = JSON.parse(raw0 || mirror0);
      const cells = { plank: TD.p(101, 28), mech: TD.p(123, 37), door: TD.p(95, 32), wreck: TD.p(120, 31), hedgeDoor: TD.p(132, 15) };
      const ix = ([x, y]) => idx(x, y);
      d.player.visitedVillage = true; delete d.player.cityV; d.player.mech = null; d.player.r = 13; d.player.speed = 175; d.player.dead = false; d.player.hp = Math.max(1, d.player.hp || 10);
      d.player.x = tc(cells.hedgeDoor[0]); d.player.y = tc(cells.hedgeDoor[1]); d.player.bedSpawn = { x: tc(OLD_INN_BED[0]), y: tc(OLD_INN_BED[1]) }; d.player.home = null; d.player.horse = null;
      d.player.inv = new Array(INV_SLOTS).fill(null).map(() => ({ id: 'stone', qty: 50 }));
      d.player.bank = Object.keys(ITEMS).filter(id => !['plank', 'door', 'coins', 'stone'].includes(id)).slice(0, BANK_SLOTS).map(id => ({ id, qty: 1 }));
      d.mapDiffs = (d.mapDiffs || []).filter(([i]) => { const x = i % MAP_W, y = Math.floor(i / MAP_W); return !inTown(x, y); })
        .concat([[ix(cells.plank), 'PLANK'], [ix(cells.mech), 'MECH'], [ix(cells.door), 'DOOR'], [ix(cells.wreck), 'WRECK'], [ix(cells.hedgeDoor), 'DOOR']]);
      const crafted = JSON.stringify(d);
      localStorage.setItem(sk, crafted); localStorage.setItem(SAVE_KEY, crafted);
      const log0 = MIG.log.length, un0 = MIG.unstuck || 0, n0 = drops.length;
      const ok = load(); F.step([]);
      const lines = texts(), moved = cell => MIG.log.slice(log0).find(e => e[0] === cell[0] && e[1] === cell[1] && e[3] === 'moved');
      const ground = drops.slice(n0).filter(dd => dist(dd.x, dd.y, player.x, player.y) < 40).map(dd => dd.id + ':' + dd.qty).sort().join(',');
      const r = { ok,
        plank: tileAt(...cells.plank) === base[pi(...cells.plank)] && !mapDiffs.has(ix(cells.plank)), door: tileAt(...cells.door) === base[pi(...cells.door)] && !mapDiffs.has(ix(cells.door)),
        mech: !!moved(cells.mech) && !insideBuilding(moved(cells.mech)[4], moved(cells.mech)[5]), wreck: !!moved(cells.wreck) && !onHighStreet(moved(cells.wreck)[4], moved(cells.wreck)[5]),
        ground, groundLine: lines.filter(l => l === 'On the ground by you: 1 plank and 2 doors.').length,
        bed: !!player.bedSpawn && Math.floor(player.bedSpawn.x / TILE) === INN_BED[0] && Math.floor(player.bedSpawn.y / TILE) === INN_BED[1] && tileAt(...INN_BED) === T.BED && !lines.some(l => /bed you slept in is gone/.test(l)),
        free: !collides(player.x, player.y, player.r, playerWho()) && tileAt(...cells.hedgeDoor) === HEDGE, unstuck: (MIG.unstuck || 0) - un0,
        words: refundWords({ plank: 17, bed: 1, lodestone: 1 }, 'pack') };
      // put the save, the map and the knight back as they were
      for (const c of Object.values(cells).concat(MIG.log.slice(log0).filter(e => e[3] === 'moved').map(e => [e[4], e[5]]))) setTile(c[0], c[1], base[pi(c[0], c[1])]);
      drops = drops.slice(0, n0);
      if (raw0 !== null) localStorage.setItem(sk, raw0); if (mirror0 !== null) localStorage.setItem(SAVE_KEY, mirror0);
      load(); F.step([]); drain();
      check(P + "C17b an old save: a plank on what is now h5's floor and a door and a walker wreck on the High Street are taken off (the walker moved into the open, out of h1 and off the street); with the pack and the bank full the refunds lie by the knight ('On the ground by you: 1 plank and 2 doors.'); the inn's bed moves with the inn (129,48); a knight saved on his door where a hedge now grows is moved out by the pass itself; refunds read '17 planks, 1 bed and 1 lodestone'",
        r.ok && r.plank && r.door && r.mech && r.wreck && r.ground === 'door:2,plank:1' && r.groundLine === 1 && r.bed && r.free && r.unstuck === 1 && r.words === 'Back in your pack: 17 planks, 1 bed and 1 lodestone.', r); }

    // ---- C19b. a back door is a porch over the step behind the house, drawn in front of nothing but the step ----
    { leave(); onFoot(); drain(); const r = {};
      for (const id of ['inn', 'h6', 'h7']) {
        const b = BUILDINGS.find(o => o.id === id); F.tp(b.x + b.doorTop, b.y - 1); F.step([]);
        STATS.record = true; const items = []; try { drawHook(ctx, items, cam); } finally { STATS.record = false; }
        const porch = STATS.boxes.filter(bx => bx.own === id && !bx.building && bx.y1 <= b.y * TILE + 8 && bx.y0 < b.y * TILE - 20);
        // the knight standing on the step sorts after the porch (09-render sorts him at player.y + player.r): in front of it
        r[id] = { porches: porch.length, before: porch.length === 1 && porch[0].y < player.y + player.r, n: STATS.porches };
      }
      check(P + 'C19b the inn, h6 and h7 each draw one porch over the step behind the house (their door on the north wall), sorted before a knight standing on that step',
        Object.values(r).every(v => v.porches === 1 && v.before), r); }

    // ---- C19c. the city's pictures: given back after 10 s away and made again on return; a ground chunk whose canvas gave
    // no context (an iPad short of canvas memory) lets the core's own ground show under it, never the black behind the map ----
    { leave(); onFoot(); drain(); F.tp(...TD.p(112, 33)); F.step([]); render(); const r = { had: CHUNKS.size > 0 && PICS.size > 0 };
      const inst = window.INSTANCES && INSTANCES.enter('war_shed'); F.sim(9 * 60, []); r.kept = CHUNKS.size > 0; F.sim(90, []);
      r.freed = !!inst && CHUNKS.size === 0 && PICS.size === 0 && FREE.freed >= 1; leave();
      F.tp(...TD.p(112, 33)); F.step([]); render(); render(); r.back = CHUNKS.size > 0 && window.GROUND_COVER(...TD.p(112, 32)) === true;
      const ci = Math.floor((TD.y(32) - Y0) / CH) * CW + Math.floor((TD.x(112) - X0) / CH), key = [...CHUNKS.keys()].find(k => chunkKeyCell(k) === ci);
      if (key) dropChunk(key, CHUNKS.get(key));
      const ce = document.createElement;
      document.createElement = function (t) { const c = ce.apply(document, arguments); if (String(t).toLowerCase() === 'canvas') c.getContext = () => null; return c; };
      try { render(); r.blankCovered = window.GROUND_COVER(...TD.p(112, 32)); } finally { document.createElement = ce; }
      const key2 = [...CHUNKS.keys()].find(k => chunkKeyCell(k) === ci); if (key2) dropChunk(key2, CHUNKS.get(key2));
      render(); render(); r.again = window.GROUND_COVER(...TD.p(112, 32)) === true;
      check(P + "C19c the city's ground chunks and building pictures are given back after 10 s in an instance (not after 9) and made again on return; a chunk whose canvas gives no context does not hide the core's ground (GROUND_COVER false there), and once painted it covers again",
        r.had && r.kept && r.freed && r.back && r.blankCovered === false && r.again, r); }

    // ---- C24. a knight's machines and wrecks in the new city are his: never moved or deleted by a load ----
    { leave(); onFoot(); drain(); save();
      const sk = 'fanglands.slot.' + title.slot, raw0 = localStorage.getItem(sk), mirror0 = localStorage.getItem(SAVE_KEY);
      // the walker on the spawn, the bulldozer on Tobin's tile, the Barrelbeast by the fountain, a wreck just inside the
      // West Gate and the mare tied where 51-mounts' whistle ties her (under the rail): all of them KEEP_CLEAR cells
      const park = [[...TD.p(112, 33), 'MECH'], [...TD.p(110, 33), 'DOZER'], [...TD.p(113, 32), 'BEAST'], [...TD.p(86, 32), 'WRECK'], [MOUNTS.post.x, MOUNTS.post.y + 1, 'HORSE']].filter(([, , n]) => typeof T[n] === 'number');
      const cv0 = player.cityV; player.cityV = 1;
      for (const [x, y] of park) borrow(x, y);
      F.tp(...TD.p(108, 38)); F.step([]);
      for (const [x, y, n] of park) changeTile(x, y, T[n]);
      const diffs0 = mapDiffs.size, rev0 = MIG.reverted, mv0 = MIG.moved;
      const stillThere = () => park.every(([x, y, n]) => tileAt(x, y) === T[n] && mapDiffs.get(idx(x, y)) === T[n]);
      save(); const ok1 = load(); F.step([]); const after1 = stillThere() && mapDiffs.size === diffs0;
      save(); const ok2 = load(); F.step([]); const after2 = stillThere() && mapDiffs.size === diffs0 && MIG.reverted === rev0 && MIG.moved === mv0;
      const where = park.map(([x, y]) => [x, y, tileName(tileAt(x, y))]);
      giveBack(); player.cityV = cv0;
      if (raw0 !== null) localStorage.setItem(sk, raw0); if (mirror0 !== null) localStorage.setItem(SAVE_KEY, mirror0);
      load(); F.step([]); drain();
      check(P + 'C24 in the new city a knight\'s own things stay put across two saves and loads: the walker on the spawn, the bulldozer by Tobin, the Barrelbeast by the fountain, a wreck inside the West Gate and the mare under the rail (no change is undone, nothing is moved or deleted)',
        ok1 && ok2 && after1 && after2 && park.length === 5, { ok1, ok2, after1, after2, where, n: park.length }); }

    // ---- C26. a knight's home stays his home across loads ----
    // 06-systems puts a home with safeSpot one tile south of the lodestone, or a tile or two to the side when something solid
    // stands just south of it (a lamp, a house wall). That home must survive every load: in an old save that is moved into
    // the new city (the lodestone was on open ground, so it is kept) and in the new city itself.
    { leave(); onFoot(); drain(); save();
      const sk = 'fanglands.slot.' + title.slot, raw0 = localStorage.getItem(sk), mirror0 = localStorage.getItem(SAVE_KEY);
      const homeFor = (tx, ty) => safeSpot(tc(tx), tc(ty) + TILE, 13, 'person') || { x: tc(tx), y: tc(ty) + TILE };
      const tileOf = p => p ? [Math.floor(p.x / TILE), Math.floor(p.y / TILE)] : null;
      const cv0 = player.cityV, home0 = player.home, res = {};
      // 1. an old save: a lodestone on the lawn by the west wall with a street lamp right below it (86,18 over 86,19)
      { const L = TD.p(86, 18); borrow(L[0], L[1]);
        const southSolid = SOLID.has(tileAt(L[0], L[1] + 1)), openBase = OPEN().has(base[pi(L[0], L[1])]) && !keepClear().has(idx(L[0], L[1]));
        changeTile(L[0], L[1], T.LODESTONE); const home = homeFor(L[0], L[1]); player.home = home;
        const aside = JSON.stringify(tileOf(home)) !== JSON.stringify([L[0], L[1] + 1]);
        player.cityV = 0; F.tp(...TD.p(108, 38)); F.step([]); save();
        const ok1 = load(); F.step([]); drain(); const h1 = tileOf(player.home), lode1 = tileAt(L[0], L[1]) === T.LODESTONE;
        save(); const ok2 = load(); F.step([]); drain(); const h2 = tileOf(player.home);
        res.oldSave = { southSolid, openBase, aside, home: tileOf(home), ok1, ok2, h1, h2, lode1, cityV: player.cityV,
          kept: southSolid && openBase && aside && ok1 && ok2 && lode1 && !!h1 && !!h2 && JSON.stringify(h1) === JSON.stringify(tileOf(home)) && JSON.stringify(h2) === JSON.stringify(tileOf(home)) && player.cityV === 1 };
        giveBack(); }
      // 2. the new city: a lodestone just inside the store, its wall right below it (92,24 over 92,25)
      { const L = TD.p(92, 24); borrow(L[0], L[1]);
        const southSolid = SOLID.has(tileAt(L[0], L[1] + 1));
        changeTile(L[0], L[1], T.LODESTONE); const home = homeFor(L[0], L[1]); player.home = home; player.cityV = 1;
        const aside = JSON.stringify(tileOf(home)) !== JSON.stringify([L[0], L[1] + 1]);
        F.tp(...TD.p(108, 38)); F.step([]); save();
        const ok1 = load(); F.step([]); drain(); const h1 = tileOf(player.home);
        save(); const ok2 = load(); F.step([]); drain(); const h2 = tileOf(player.home);
        res.newCity = { southSolid, aside, home: tileOf(home), ok1, ok2, h1, h2,
          kept: southSolid && aside && ok1 && ok2 && !!h1 && !!h2 && JSON.stringify(h1) === JSON.stringify(tileOf(home)) && JSON.stringify(h2) === JSON.stringify(tileOf(home)) };
        giveBack(); }
      player.cityV = cv0; player.home = home0;
      if (raw0 !== null) localStorage.setItem(sk, raw0); if (mirror0 !== null) localStorage.setItem(SAVE_KEY, mirror0);
      load(); F.step([]); drain();
      check(P + 'C26 a knight\'s home stays across two loads when his lodestone has something solid just south of it (the home sits a tile to the side): a lodestone kept from an old save on the lawn over a street lamp, and one in the new city inside the store over its wall',
        res.oldSave.kept && res.newCity.kept, res); }

    // ---- C18. determinism ----
    // the snapshot is the last pass that can write a tile: only the Atlas's pass (src/96-atlas.js), which only reads, comes after it
    const writers = HOOKS.world.filter(f => !(window.ATLAS && f === ATLAS.pass));
    check(P + 'C18 the painter is the very first world pass (HOOKS.world[0]) and the snapshot the last that writes (only the Atlas reads after it); C2 shows it draws no random number', HOOKS.world[0] === paint && writers[writers.length - 1] === snap, { first: HOOKS.world[0] === paint, last: writers[writers.length - 1] === snap });

    // ---- C19. drawing ----
    { const keepSize = { k: Object.getOwnPropertyDescriptor(window, 'innerWidth'), l: Object.getOwnPropertyDescriptor(window, 'innerHeight') }; const setSize = (w, hh) => { Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true }); Object.defineProperty(window, 'innerHeight', { value: hh, configurable: true, writable: true }); resize(); };
      const putSize = () => { if (keepSize.k) Object.defineProperty(window, 'innerWidth', keepSize.k); if (keepSize.l) Object.defineProperty(window, 'innerHeight', keepSize.l); resize(); };
      // (104,40) and (100,42): the castle's corner towers beside the Tinker's Workshop; (121,18) the Bell Green; (127,52) the
      // inn's garden; (89,38) the woodyard; (81,32) the West Gate's gatehouse from the road
      const views = [TD.p(112, 33), TD.p(88, 32), TD.p(112, 40), TD.p(116, 22), TD.p(133, 22), TD.p(135, 44), TD.p(95, 17), TD.p(144, 32), TD.p(112, 38), TD.p(104, 40), TD.p(100, 42), TD.p(121, 18), TD.p(127, 52), TD.p(89, 38), TD.p(81, 32)], N = window.NIGHT, d0 = player.dayTime, r = {}, overlaps = [];
      let castleBoxes = 0, gateBoxes = 0;
      let threw = null;
      setSize(1280, 800);
      try {
        onFoot();
        for (const [x, y] of views) {
          F.tp(x, y); STATS.record = true; render(); STATS.record = false;
          r[x + ',' + y] = { items: STATS.items, chunks: STATS.chunks, towers: STATS.towers, lamps: LAMPS.filter(([lx, ly]) => Math.abs(lx - x) < 15 && Math.abs(ly - y) < 10).length, fountains: STATS.fountains, statues: STATS.statues, keep: STATS.keep };
          castleBoxes += STATS.boxes.filter(b => b.own === 'castle').length; gateBoxes += STATS.boxes.filter(b => b.own === 'gatehouse').length;
          for (const b of STATS.boxes) for (const bd of BUILDINGS) { if (bd.id === b.own) continue; const bx0 = bd.x * TILE, by0 = bd.y * TILE, bx1 = (bd.x + bd.w) * TILE, by1 = (bd.y + bd.h) * TILE; if (b.x1 > bx0 && b.x0 < bx1 && b.y1 > by0 && b.y0 < by1) overlaps.push({ view: [x, y], box: [b.x0, b.y0, b.x1, b.y1].map(v => Math.round(v)), own: b.own, building: bd.id }); }
        }
        player.dayTime = N.LIGHT + N.DUSK + 30; F.tp(...TD.p(112, 33)); render(); r.night = { lampsLit: STATS.lampsLit };
        player.dayTime = d0;
        // the spawn at 1280 x 800: few chunks, few items, and a still second frame repaints nothing
        F.tp(...TD.p(112, 33)); render(); render(); const perf = { chunks: STATS.chunks, items: STATS.items, repaints: STATS.repaints, size: CHUNKS.size, max: chunkMax };
        r.perf = perf;
        // the Great Fountain's top: its recorded box, and the highest point any of its drawing calls reaches
        F.tp(...TD.p(112, 38)); STATS.record = true; render(); STATS.record = false; const gf = STATS.boxes.find(b => b.x0 === GF.cx - GF.rx - 2); r.gfTop = gf ? gf.y0 : null;
        { const { g: rg, log: rl } = recorder(); drawGreatFountain(rg); let top = Infinity;
          // follow save / restore / translate / scale, so a piece drawn round a local origin (the thistle) is measured where it lands
          const st = []; let M = { ty: 0, sy: 1 };
          for (const [k, a] of rl) {
            if (k === 'save') { st.push({ ...M }); continue; } if (k === 'restore') { M = st.pop() || { ty: 0, sy: 1 }; continue; }
            if (k === 'translate') { M.ty += a[1] * M.sy; continue; } if (k === 'scale') { M.sy *= a[1]; continue; }
            const y = k === 'fillRect' ? a[1] : k === 'drawImage' ? (a.length >= 9 ? a[6] : a[2]) : (k === 'moveTo' || k === 'lineTo') ? a[1] : k === 'quadraticCurveTo' ? Math.min(a[1], a[3]) : k === 'arc' ? a[1] - a[2] : k === 'ellipse' ? a[1] - a[3] : Infinity;
            if (y === Infinity) continue; const wy = M.ty + y * M.sy; if (wy < top) top = wy; }
          r.gfDrawnTop = top; }
      } catch (e) { threw = String(e && e.stack || e).slice(0, 300); }
      STATS.record = false; player.dayTime = d0; putSize();
      const v88 = r['88,32'], v38 = r['112,38'], p = r.perf || {};
      check(P + 'C19 every view renders (spawn, both gates, the square, the drawbridge, the market, the Green, the Rose Garden, the Orchard, outside the East Gate, the castle\'s corner by the Tinker\'s Workshop, the Smithy Yard, the Bell Green, the inn\'s garden, and at night); towers and lamps at the West Gate; the Great Fountain, 4 statues and the keep from the square; at the spawn at most 20 chunk blits and 160 items, a still frame repaints nothing, and the chunk cache stays at or under 40; no drawn box covers another building (the castle\'s corner towers and the gatehouses record theirs too); the Great Fountain stays under 24 px over row 34',
        castleBoxes > 0 && gateBoxes > 0 && !threw && !!v88 && v88.towers > 0 && v88.lamps > 0 && !!v38 && v38.fountains >= 1 && v38.statues === 4 && v38.keep === 1 && p.chunks > 0 && p.chunks <= 20 && p.items <= 160 && p.repaints === 0 && p.size <= p.max && p.max <= 40 && !overlaps.length && r.gfTop !== null && r.gfTop >= TD.y(34) * TILE - 24 && r.gfDrawnTop >= TD.y(34) * TILE - 24 && r.night.lampsLit > 0,
        { threw, views: r, overlaps: overlaps.slice(0, 6), castleBoxes, gateBoxes }); }

    // ---- C20. ward banners ----
    { onFoot(); drain(); areaBanner = null; const shown = []; WARD.shown = null;
      const watch = () => { if (areaBanner && (!shown.length || shown[shown.length - 1].name !== areaBanner.name || shown[shown.length - 1].at !== areaBanner)) { shown.push({ name: areaBanner.name, t: time, at: areaBanner }); } };
      const walk = (tx, ty) => { const path = F.bfs(Math.floor(player.x / TILE), Math.floor(player.y / TILE), tx, ty); if (!path) return false; for (const [wx, wy] of path) { let s = 0; while (s < 120 && Math.hypot(tc(wx) - player.x, tc(wy) - player.y) > 4) { F.step(F.held(tc(wx) - player.x, tc(wy) - player.y)); watch(); s++; } } return true; };
      F.tp(...TD.p(82, 32)); F.sim(5, []); watch();
      const ok = walk(...TD.p(86, 32)) && walk(...TD.p(110, 32)) && walk(...TD.p(111, 27)) && walk(...TD.p(111, 32)) && walk(...TD.p(127, 32)) && walk(...TD.p(128, 24)) && walk(...TD.p(130, 24));
      for (let k = 0; k < 30; k++) { F.step([]); watch(); }
      const names2 = shown.map(s => s.name), wards = names2.filter(n => PLAN.WARDS.some(w => w.name === n));
      const regionT = (shown.find(s => s.name === 'Thistledown') || {}).t;
      const fsT = (shown.find(s => s.name === 'Fountain Square') || {}).t;
      const twice = wards.some((n, i) => i && wards[i - 1] === n);
      // and arriving in Fountain Square at once (a ride home, a fall, a teleport): the square's banner waits out the
      // Thistledown banner's 3.2 s, then shows (the walk above takes about 5 s, so it never tests the wait)
      onFoot(); F.tp(...TD.p(82, 32)); F.sim(5, []); areaBanner = null; WARD.shown = null; const quick = [];
      F.tp(...TD.p(112, 33)); let early = false, later = false; const t0 = time;
      for (let k = 0; k < 270; k++) { F.step([]); const a = areaBanner && areaBanner.name; if (a === 'Fountain Square') { if (time - t0 < 3.0) early = true; else later = true; } if (a && quick[quick.length - 1] !== a) quick.push(a); }
      check(P + 'C20 walking in at the West Gate, along the High Street to Crown Street and on to the Duke\'s Green shows Fountain Square and The Duke\'s Green once each, never within 3.2 s of the Thistledown banner, never the same twice running; arriving in the square at once, its banner waits the 3.2 s and then shows',
        ok && wards.filter(n => n === 'Fountain Square').length === 1 && wards.filter(n => n === "The Duke's Green").length === 1 && !twice && regionT !== undefined && fsT - regionT >= 3.2 && !early && later && quick[0] === 'Thistledown',
        { ok, shown: names2, gap: fsT - regionT, early, later, quick }); }

    // ---- C21. regions ----
    { onFoot(); F.tp(...TD.p(82, 32)); F.step([]); F.sim(60, ['KeyD']); const inRegion = player.region;
      const a = regionAt(...TD.p(112, 41)).name, b = regionAt(...TD.p(112, 43)).name;
      const bed0 = player.bedSpawn; player.bedSpawn = null; player.visitedVillage = true; const rp = respawnPoint(); player.bedSpawn = bed0;
      check(P + 'C21 walking in through the West Gate is Thistledown; 112,41 (the drawbridge) is Thistledown and 112,43 Castle Thistledown; a fallen knight comes back within 5 px of the spawn by the fountain',
        inRegion === 'Thistledown' && a === 'Thistledown' && b === 'Castle Thistledown' && dist(rp.x, rp.y, VILLAGE_SPAWN.x, VILLAGE_SPAWN.y) <= 5, { inRegion, a, b, rp: [rp.x, rp.y] }); }

    // ---- C22. order and the stonework (the safety nets in section 11) ----
    { leave(); const ids0 = BUILDINGS.map(b => b.id).join(','); INSTANCES.enter('aerie', [SKYCITY.STEP_T.x, SKYCITY.STEP_T.y]); F.sim(2, []); INSTANCES.leave(); F.step([]); const ids1 = BUILDINGS.map(b => b.id).join(',');
      onFoot(); drain(); F.tp(...TD.p(111, 35)); F.step([]); const t = tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE)), outOf = !SOLID.has(t) && !collides(player.x, player.y, player.r, 'player');
      // a villager who walks into the lawn west of Crown Street stops for PAUSE seconds instead of turning every frame
      const cass = npc('v3'), ck = { px: cass.px, py: cass.py, dir: cass.dir, wanderT: cass.wanderT };
      F.tp(...TD.p(112, 30)); cass.px = TD.x(111) * TILE + 0.5; cass.py = tc(TD.y(23)); cass.dir = { x: -1, y: 0 }; cass.wanderT = 5; F.step([]);
      const paused = cass.wanderT === PAUSE && cass.dir === null && cass.px === TD.x(111) * TILE + 0.5;
      Object.assign(cass, ck);
      check(P + 'C22 after a visit to Aerie the buildings are back in the order the world was built in; a knight put down inside the Great Fountain steps out of it; a villager who walks into a lawn stops for a moment instead of turning every frame',
        ids0 === ids1 && outOf && paused, { same: ids0 === ids1, outOf, paused, at: [+(player.x / TILE).toFixed(2), +(player.y / TILE).toFixed(2)] }); }

    // ---- C23. the small things: Osric's welcome, the children, Duchess, the after-story lines, the art wraps, the words elsewhere ----
    { const r = {}, q = Q();
      // Osric calls "Welcome to Thistledown!" once, the first time a knight comes within 3 tiles, as a tag (not a dialog)
      onFoot(); drain(); areaBanner = null; levelBanner = null; q.barked = false; BARK.t = 0; BARK.pending = false; F.tp(...TD.p(96, 32)); F.step([]); const before = BARK.t;
      F.tp(...TD.p(91, 32)); F.sim(30, []); const on = BARK.t > 3.4 && q.barked && !said().some(d => /Welcome to Thistledown!/.test(d.text));
      const cap = { items: null }; const hook = (g, items) => { cap.items = items; }; HOOKS.draw.push(hook); try { render(); } finally { HOOKS.draw.splice(HOOKS.draw.indexOf(hook), 1); }
      const tagItem = (cap.items || []).some(i => i.capital && i.y === 1e9 + 3);
      BARK.t = 0; F.tp(...TD.p(96, 32)); F.step([]); F.tp(...TD.p(91, 32)); F.sim(30, []); const once = BARK.t === 0;
      r.bark = before === 0 && on && tagItem && once;
      // ... but never under a banner: with THISTLEDOWN still up he waits, and calls out once it has gone
      q.barked = false; BARK.t = 0; BARK.pending = false; F.tp(...TD.p(96, 32)); F.step([]);
      areaBanner = { name: 'Thistledown', sub: 'The city that still stands', t: 2.5 }; F.tp(...TD.p(91, 32)); F.step([]);
      for (let k = 0; k < 30; k++) F.step([]);
      const held0 = BARK.t === 0 && BARK.pending && !q.barked && !!areaBanner;
      // still waiting while the banner fades (0.25 s left), and for a breath after it has gone
      areaBanner.t = 0.25; F.step([]); const heldFade = BARK.t === 0 && !q.barked; areaBanner = null; F.sim(12, []); const heldBreath = BARK.t === 0 && !q.barked;
      const held = held0 && heldFade && heldBreath;
      // the banner goes, but the Voice is talking (its box is at the top of a phone's screen): he waits for that too
      say('A line from the Voice.', 'The Voice'); areaBanner = null; F.step([]); const heldTalk = BARK.t === 0 && BARK.pending && !q.barked;
      drain(); F.sim(30, []); const after = BARK.t > 3.4 && q.barked && !areaBanner;
      r.barkHeld = held && heldTalk && after;
      if (!r.barkHeld) r.barkWhy = { held0, heldFade, heldBreath, heldTalk, after };
      // the town's new people have names no one else in the Fanglands has (a second Nell muddled Hollowford's Nell)
      const ours = new Set(PLAN.PEOPLE.map(p => p.name).concat(KIDS.map(k => k.name), ['Duchess']));
      const clash = NPCS.filter(n => !PLAN.PEOPLE.some(p => p.id === n.id)).map(n => n.name).filter(nm => ours.has(nm) || [...ours].some(o => o.split(' ')[0] === String(nm).split(' ')[0]));
      r.names = clash.length === 0 && KIDS[0].name === 'Tess';
      if (!r.names) r.clash = clash;
      // Tess and Robin: a pure function of the wall clock (the same on every client), on the U path, Robin 1.2 s behind Tess
      const a = kidAt(123456), b = kidAt(123456), path = PLAN.KIDS.path, onU = p => p.x >= path[0][0] + 0.5 - 1e-6 && p.x <= path[2][0] + 0.5 + 1e-6 && p.y >= path[0][1] + 0.5 - 1e-6 && p.y <= path[1][1] + 0.5 + 1e-6;
      let allOn = true; for (let ms = 0; ms < 20000; ms += 137) if (!onU(kidAt(ms))) allOn = false;
      CLOCK.fixed = 50000; const kids = smallFolk().filter(p => p.id === 'td_tess' || p.id === 'td_robin'); const lag = kidAt(50000 - PLAN.KIDS.lag * 1000);
      r.kids = a.x === b.x && a.y === b.y && allOn && kids.length === 2 && Math.abs(kids[1].x - tc(0) - (lag.x - 0.5) * TILE) < 1e-6;
      drain(); kids[0].talk(); r.tess = texts()[0] === 'Catch me if you can!'; drain(); kids[1].talk(); r.robin = texts()[0] === 'You are it! No, wait. Tess is it!'; drain();
      // the swans swim by the clock too, each its own side of the footbridge
      const sw = [0, 1].map(i => swanAt(i, 77777)); r.swans = sw[0].x < PLAN.POND.bridge[0] * TILE && sw[1].x > (PLAN.POND.bridge[1] + 1) * TILE && swanAt(1, 77777).x === sw[1].x;
      // Duchess: only after the story, tappable, and her line
      const keepBell = q.bell; q.bell = 4; const before2 = smallFolk().some(p => p.id === 'td_duchess');
      q.bell = 'done'; CAT.t0 = -99; const duch = smallFolk().find(p => p.id === 'td_duchess'); drain(); if (duch) duch.talk();
      r.duchess = !before2 && !!duch && texts()[0] === "Duchess, the Duke's cat. She is pretending she cannot see you." && duch.x === tc(PLAN.DUCHESS.x);
      // after the story: Ambrose alternates the time with Duchess, and Wynn has a third line
      drain(); q.ambroseMet = true; TALK.ambrose = 0; const al = []; for (let k = 0; k < 3; k++) { drain(); F.talk('ambrose'); al.push(texts()[0]); }
      TALK.wynn = 2; drain(); F.talk('wynn'); const wy = texts()[0];
      r.after = /^The sun is up|^Dusk|^Night/.test(al[0]) && al[1] === DUCHESS_LINE && /^The sun is up|^Dusk|^Night/.test(al[2]) && wy === 'The ghost was a cat? I knew it. I KNEW it.';
      q.bell = keepBell; drain(); CLOCK.fixed = 0;
      // the art wraps: no wooden gate on a town gate cell (but on a pen gate), the brazier instead of a campfire, the castle towers, the town buildings
      const calls = f => { const { g, log } = recorder(); f(g); return log.length; };
      r.gates = calls(g => drawFenceProp(g, ...TD.p(85, 32), true)) === 0 && calls(g => drawFenceProp(g, ...TD.p(140, 31), true)) === 0 && calls(g => drawFenceProp(g, ...TD.p(80, 43), true)) > 0;
      r.brazier = (() => { const { g, log } = recorder(); drawFireProp(g, BRAZIER.x, BRAZIER.y); return log.filter(e => e[0] === 'ellipse').length >= 3; })() && calls(g => drawFireProp(g, ...ATLAS.frame('camp').p(150, 30))) > 0;
      { const t0 = STATS.towers; calls(g => drawTower(g, tc(TD.x(104)), tc(TD.y(42)))); r.tower = STATS.towers === t0 + 1; }
      // (Death's House draws through the capital's own painter too, and is not one of the sixteen town buildings)
      { const b0 = STATS.townBuildings, d0 = STATS.deathHouse; calls(g => drawBuilding(g, BUILDINGS.find(b => b.id === 'bakery'))); calls(g => drawBuilding(g, BUILDINGS.find(b => b.id === 'death2'))); calls(g => drawBuilding(g, BUILDINGS.find(b => b.id === 'death1')));
        r.buildings = STATS.townBuildings === b0 + 1 && STATS.deathHouse === d0 + 1 && BUILDINGS.filter(b => b.town).length === 16; }
      // the words elsewhere: Ada, the region, the island arch, the sounds, the book
      const ada = npc('v1'); r.ada = ada.lines[0] === 'Lost? Find the Great Fountain. Every street comes back to it.' && ada.lines.length === 3;
      r.region = REGIONS.find(x => x.name === 'Thistledown').sub === 'The city that still stands';
      r.island = !window.HOUSE || HOUSE.DESTS.find(d => d.key === 'thistledown').line === 'The square, by the Great Fountain.';
      r.sounds = typeof SFX.bell === 'function' && typeof SFX.splash === 'function';
      r.wiki = !window.WIKI || (!!WIKI.get('places', 'thistledown_landmarks') && !!WIKI.get('quests', 'td_bell'));
      // the first visit: the Voice's line
      { const v0 = player.visitedVillage; player.visitedVillage = false; drain(); F.tp(...TD.p(96, 32)); F.step([]); r.voice = said().some(d => d.who === 'The Voice' && d.text === 'Thistledown. You will wake here now if you fall. Follow the street to the Great Fountain. The castle is south of it, across the moat.'); player.visitedVillage = v0; drain(); }
      check(P + "C23 the small things: Osric's welcome shows once as a tag over his head, never under a banner or a talk box (he waits for THISTLEDOWN, and the Voice, to go); the town's new people have names nobody else has; Tess and Robin and the swans move by the wall clock on their paths; Duchess comes after the story; Ambrose and Wynn have their after-story lines; the town gates draw no wooden gate, the square's fire is a brazier, the castle towers and the town buildings draw themselves (Death's House keeps its own); Ada, the region, the island arch, the sounds, the book and the Voice say the new words",
        Object.values(r).every(Boolean), r); }

    // ---- C25. nothing of the city hides the knight's own marks, or the knight ----
    { leave(); onFoot(); drain(); closePanel();
      // a tap to walk on the paving: 17-tap's ring and path dots (and 69-retaliate's red ring) sort after the city's ground
      clearFolk(...TD.p(108, 31), 8); clearMonsters(...TD.p(108, 31), 8); F.tp(...TD.p(112, 33)); F.step([]); screenTap(...TD.p(108, 31));
      const cap = { items: null }; const hook = (g, items) => { cap.items = items; }; HOOKS.draw.push(hook);
      try { render(); } finally { HOOKS.draw.splice(HOOKS.draw.indexOf(hook), 1); }
      const items = cap.items || [], ground = items.find(i => i.capital && i.y === GROUND_Y);
      const marks = items.filter(i => !i.capital && (i.y === -1e9 || i.y === -1e9 + 1 || i.y === -1e9 + 2));
      const under = items.filter(i => !i.capital && i.y <= GROUND_Y).length;
      const ringShown = !!tap.marker && marks.some(i => i.y === -1e9 + 1);
      tapCancel('manual');
      // the Bell Tower rises over the north wall: a knight on the grass behind it, outside, sees through it
      clearMonsters(...TD.p(112, 12), 6); F.tp(...TD.p(112, 12)); F.step([]); const open = !SOLID.has(tileAt(...TD.p(112, 12))) && Math.floor(player.y / TILE) === TD.y(12);
      STATS.record = true; render(); STATS.record = false; const bellA = STATS.bellAlpha;
      F.tp(...TD.p(112, 33)); F.step([]); render(); const bellFront = STATS.bellAlpha;
      // a friend online on that grass is seen through it by a knight standing in front of the tower (73-players' REMOTE)
      let friendA = null, alone = null;
      if (window.PLAYERS && PLAYERS.remote) {
        F.tp(...TD.p(112, 19)); F.step([]); render(); alone = STATS.bellAlpha;
        PLAYERS.remote.__bellTest = { n: '__bellTest', map: PLAYERS.mapId(), x: tc(TD.x(112)), y: tc(TD.y(12)), shown: { x: tc(TD.x(112)), y: tc(TD.y(12)) }, dead: false, r: 13 };
        try { KN.t = NaN; render(); friendA = STATS.bellAlpha; } finally { delete PLAYERS.remote.__bellTest; KN.t = NaN; }
      }
      check(P + 'C25 the city\'s ground sorts under every other ground mark: a tap to walk on the paving shows its ring and dots (nothing sorts under the ground); a knight on the grass behind the Bell Tower, outside the north wall, sees it drawn see-through (and from the fountain it is solid); a friend online on that grass makes it see-through for a knight in front of it',
        !!ground && ringShown && under === 0 && marks.every(i => i.y > ground.y) && open && bellA < 1 && bellFront === 1 && alone === 1 && friendA !== null && friendA < 1,
        { ground: !!ground, ringShown, marks: marks.length, under, open, bellA, bellFront, alone, friendA }); }

    // ---- C27. nobody vanishes under a gatehouse ----
    // The roof over each town gate is drawn faint (25%) while anybody is in the passage: the knight, a friend online, a
    // villager or a guard. Before, only the knight himself made it faint, and a friend walking in at the gate vanished,
    // name and all, for three tiles.
    { leave(); onFoot(); drain(); closePanel(); player.dayTime = 100;
      const R = window.PLAYERS && PLAYERS.remote, my = window.PLAYERS ? PLAYERS.mapId() : 'over', NAME = 'Capital Gate Test';
      const res = {};
      const put1 = (x, y) => { R[NAME] = { n: NAME, map: my, x, y, shown: { x, y }, facing: { x: 1, y: 0 }, moving: false, walkT: 0, hp: 20, mhp: 20, lv: 7, look: null, mech: null, dead: false, act: null, hurtT: 0, attackT: 0, r: 13, lastAt: Date.now(), role: 'player' }; };
      const view = (tx, ty, gx) => { F.tp(tx, ty); render(); return { a: STATS.gateAlpha[gx], who: STATS.gateWho[gx] || null }; };
      // anybody near the gates out of the way for the check (clearFolk parks wanderers 40 tiles east of home, which can be
      // the East Gate itself), put back after it
      const parked = NPCS.filter(n => n.id !== 'osric' && PLAN.GATES.some(gt => Math.abs(n.px - tc(gt.x)) < 5 * TILE && Math.abs(n.py - tc(TD.y(32))) < 5 * TILE)).map(n => ({ n, x: n.px, y: n.py }));
      for (const k of parked) { k.n.px = tc(ATLAS.world.tx(5)); k.n.py = tc(ATLAS.world.ty(170)); }
      for (const [gx, fx, fy, lx] of [[TD.x(85), TD.x(85.5), TD.y(32.5), TD.x(95)], [TD.x(140), TD.x(140.5), TD.y(31.6), TD.x(130)]]) {
        clearMonsters(gx, TD.y(32), 6);
        const empty = view(lx, TD.y(32), gx);
        let friend = { a: null, who: 'no PLAYERS' }; if (R) { put1(fx * TILE, fy * TILE); friend = view(lx, TD.y(32), gx); delete R[NAME]; }
        // a villager in the passage (Osric, put there for a frame)
        const os = npc('osric'), op = { x: os.px, y: os.py }; os.px = fx * TILE; os.py = fy * TILE; const person = view(lx, TD.y(32), gx); os.px = op.x; os.py = op.y;
        // and the knight himself
        F.tp(Math.floor(fx), TD.y(32)); render(); const knight = { a: STATS.gateAlpha[gx], who: STATS.gateWho[gx] || null };
        res[gx] = { empty, friend, person, knight };
      }
      if (R) delete R[NAME];
      for (const k of parked) { k.n.px = k.x; k.n.py = k.y; }
      const ok = [TD.x(85), TD.x(140)].every(gx => { const r = res[gx]; return r.empty.a === 1 && r.friend.a === 0.25 && r.friend.who === 'friend' && r.person.a === 0.25 && r.person.who === 'person' && r.knight.a === 0.25 && r.knight.who === 'knight'; });
      check(P + 'C27 nobody vanishes under a gatehouse: with a friend online in the West or the East Gate\'s passage the roof over it is drawn faint (25%), the same for a villager there and for the knight himself, and with nobody there it is solid',
        ok, res); }

    // ---- C28. the city keeps its frame cheap ----
    // Night lights are holes stamped from one picture per size (35-night), the lamps' glows are one picture, the town's
    // buildings are pictures made once (per day or night) with only their smoke, lanterns, signs and banners drawn each
    // frame, and the core does not draw a texture under the cells the city's own ground covers.
    { leave(); onFoot(); drain(); closePanel(); clearFolk(...TD.p(112, 33), 10); clearMonsters(...TD.p(112, 33), 10);
      F.tp(...TD.p(112, 33)); player.dayTime = 100; render(); render();
      const pics0 = STATS.pics; render(); render(); const picsDay = STATS.pics - pics0, bDay = STATS.townBuildings;
      player.dayTime = NIGHT.LIGHT + NIGHT.DUSK + 30; render(); render();
      const made0 = NIGHT.lightSprites.made, pics1 = STATS.pics; render(); render();
      const lightsNew = NIGHT.lightSprites.made - made0, picsNight = STATS.pics - pics1, lit = STATS.lampsLit;
      // the core's own texture pass: count the cells it would skip at the spawn, and that a cell a knight changed is drawn by it
      const vx0 = Math.floor(cam.x / TILE), vx1 = Math.ceil((cam.x + VW) / TILE), vy0 = Math.floor(cam.y / TILE), vy1 = Math.ceil((cam.y + VH) / TILE);
      let covered = 0, coveredOff = 0; for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) if (window.GROUND_COVER(x, y)) { covered++; if (!inPlan(x, y) || tileAt(x, y) !== base[pi(x, y)] || gcode(x, y) === G_NONE || gcode(x, y) === G_WATER) coveredOff++; }
      borrow(...TD.p(108, 32)); changeTile(...TD.p(108, 32), T.FIRE); const fireDrawn = !window.GROUND_COVER(...TD.p(108, 32)); giveBack();
      const inst = window.INSTANCES && INSTANCES.enter('aerie', [SKYCITY.STEP_T.x, SKYCITY.STEP_T.y]); const inAerie = window.GROUND_COVER(92, 40) || window.GROUND_COVER(...TD.p(112, 33)); leave();
      player.dayTime = 100; F.tp(...TD.p(112, 33)); render();
      check(P + 'C28 the frame stays cheap: by day and by night a second frame at the spawn makes no new building picture and no new night-light picture (the town buildings and the lamps still draw), the core skips its texture only under the city\'s own unchanged ground (a fire a knight lit is still drawn by it), and never in an instance',
        picsDay === 0 && picsNight === 0 && lightsNew === 0 && bDay > 0 && lit > 0 && covered > 100 && coveredOff === 0 && fireDrawn && !!inst && !inAerie,
        { picsDay, picsNight, lightsNew, buildings: bDay, lampsLit: lit, covered, coveredOff, fireDrawn, inst: !!inst, inAerie, pics: STATS.pics }); }

    // ---- C29. a Windows laptop at 125% or 150% (or a zoomed browser) ----
    // the ground chunks and the building pictures are made at the real pixel ratio, and the core still skips its texture
    // under the city's own ground, so the frame costs what it does at 1x or 2x
    { const dpr0 = DPR; leave(); onFoot(); drain(); closePanel();
      let chunkW = 0, picW = 0, covered = 0, want = 0;
      try {
        DPR = 1.5; CHUNKS.clear(); PICS.clear(); F.tp(...TD.p(112, 33)); player.dayTime = 100; render(); render();
        want = Math.ceil(CH * TILE * 1.5);
        for (const [k, ch] of CHUNKS) if (/@1\.5$/.test(k)) { chunkW = ch.c.width; break; }
        for (const [k, p] of PICS) if (/1\.5$/.test(k)) { picW = p.c.width / p.w; break; }
        const vx0 = Math.floor(cam.x / TILE), vx1 = Math.ceil((cam.x + VW) / TILE), vy0 = Math.floor(cam.y / TILE), vy1 = Math.ceil((cam.y + VH) / TILE);
        for (let y = vy0; y <= vy1; y++) for (let x = vx0; x <= vx1; x++) if (window.GROUND_COVER(x, y)) covered++;
      } finally { DPR = dpr0; CHUNKS.clear(); PICS.clear(); render(); }
      check(P + 'C29 at a 1.5 pixel ratio the city\'s ground chunks and building pictures are made at 1.5 (not rescaled from 1x or 2x on every frame) and the core still skips its texture under the city\'s ground',
        chunkW === want && picW >= 1.49 && picW <= 1.51 && covered > 100, { chunkW, want, picScale: picW, covered }); }

    // ---- C30. the Duke's lawns are open ground, like the grass they replaced ----
    // get off the mare on one, and a lodestone, a bed or a fire can stand on one; a hoe still does not till it
    { leave(); onFoot(); drain(); closePanel(); let lawn = null;
      for (let y = TOWN.y0 + 1; y < TOWN.y1 && !lawn; y++) for (let x = TOWN.x0 + 1; x < TOWN.x1 && !lawn; x++)
        if (tileAt(x, y) === LAWN && tileAt(x + 1, y) === LAWN && tileAt(x - 1, y) === LAWN && tileAt(x, y + 1) === LAWN && tileAt(x, y - 1) === LAWN && !buildingAt(x, y)) lawn = [x, y];
      const log = { lawn, placeable: PLACEABLE_ON.has(LAWN) }; let ok = !!lawn && PLACEABLE_ON.has(LAWN);
      if (lawn && window.MOUNTS) {
        const keepHorse = player.horse ? JSON.parse(JSON.stringify(player.horse)) : player.horse;
        for (let y = lawn[1] - 2; y <= lawn[1] + 2; y++) for (let x = lawn[0] - 2; x <= lawn[0] + 2; x++) borrow(x, y);
        changeTile(lawn[0] + 1, lawn[1], MOUNTS.tiles.HORSE); F.tp(lawn[0], lawn[1]); player.facing = { x: 1, y: 0 }; MOUNTS.mount(lawn[0] + 1, lawn[1]); drain();
        const up = !!player.mech; F.tp(lawn[0], lawn[1]); player.facing = { x: 1, y: 0 }; notice = null; MOUNTS.dismount(); const said = notice ? notice.text : '';
        log.up = up; log.down = !player.mech; log.said = said;
        if (!(up && !player.mech && !/No room/.test(said))) ok = false;
        onFoot(); giveBack(); drain(); if (keepHorse === undefined) delete player.horse; else player.horse = keepHorse;
      }
      check(P + 'C30 the Duke\'s lawns are open ground: the knight gets off the mare on one, and a lodestone, bed or fire may stand there (PLACEABLE_ON)', ok, log); }

    // ---- put everything back ----
    leave(); giveBack(); onFoot(); drain(); closePanel(); tapCancel('manual');
    CLOCK.fixed = null; STATS.record = false;
    for (const k of npcKeep) { k.n.px = k.px; k.n.py = k.py; k.n.wanderT = k.wanderT; }
    for (const k of monKeep) { k.m.x = k.x; k.m.y = k.y; }
    quest = Object.assign(quest, JSON.parse(keep.quest));
    player.inv = keep.inv.map(s => s ? { ...s } : null); player.bank = keep.bank.map(s => ({ ...s }));
    if (keep.horse === undefined) delete player.horse; else player.horse = keep.horse;
    player.mech = keep.mech; player.r = keep.r; player.speed = keep.speed; player.dayTime = keep.day; player.cityV = keep.cityV; player.visitedVillage = keep.visited; player.bedSpawn = keep.bed; player.home = keep.home;
    { const sp = safeSpot(keep.x, keep.y, player.r, playerWho()) || { x: keep.x, y: keep.y }; player.x = sp.x; player.y = sp.y; }
    BELLST.prev = null; window.__forceTouch = wasTouch; h.peace(false); save();
  });

  // the snapshot: the very last world pass (only 99-boot loads after this file, and it adds none)
  HOOKS.world.push(snap);
  window.CAPITAL = {
    PLAN, TILES, KIND, KIND_NAMES, base, STATS, CLOCK, WARD, migrate, paint, snap, Q, MIG, SNAP, kindAt, baseAt, pristineAt, keepClear,
    timeLine, spanWords, dialAngle, lineFor, tapName, useThing, heroName, TALK, BELLST, BARK, CAT, KIDS, kidAt, swanAt, smallFolk,
    CHUNKS, get chunkMax() { return chunkMax; }, drawHook, TOWERS, TORCHES, LAMP_TOP, TREE_R, GCODE, drawTownBuilding, rimFor, TOWN_GATE_CELLS,
  };
}
