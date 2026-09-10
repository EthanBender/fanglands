// ============================================================================
// UNDERGROUND — what the surface owes to a place that went under it
// Owner's ask: "Deepholm is underground, it should not appear on the main map, it should be its own map.
// This should apply for all instances and all indoor stuff that's not a building with roof removal. This
// will also give you more space on the main map for more overworld development."
//
// 24-dwarves moved the undercity into an instance of its own. Two things are left over, and both live here
// so the move is one readable piece of work:
//
//   1. THE GROUND IT LEFT BEHIND. Deepholm used to be a 25 × 23 block of rock and hall at x 2–26, y 72–94,
//      right in the middle of Wolfwood. 02-world already grows ordinary wood over the whole map before any
//      feature carves it, and 39-worldblend never touched the rectangle (it marks it hard), so the floor of
//      the wood under Deepholm was there all along and is simply uncovered now. What is NOT ordinary is the
//      ring of rock outcrops 39-worldblend scatters "at the foot of Deepholm's walls" (1–3 tiles outside the
//      rectangle): with no walls there is no foot, and a ring of grey stone hugging a rectangle of nothing is
//      exactly the ghost the owner does not want. Those go back to wood here, in Wolfwood's own mix.
//
//   2. THE COAL ROAD. 53-coalmine's cart stands inside Deepholm and rides you down to the seam — but an
//      instance cannot be opened from inside another one. This file hops: out of Deepholm, down to the seam,
//      and back into Deepholm beside the cart when the shift ends.
//
// Feature file: registers through HOOKS only and edits no core file. window.UNDERGROUND exposes the hop.
// ============================================================================
{
  // the rectangle Deepholm used to occupy on the overworld, and the band 39-worldblend rocked up round it
  const OLD = { x0: 2, y0: 72, x1: 26, y1: 94 };
  const RING = 3;
  const rectDist = (x, y) => Math.max(OLD.x0 - x, 0, x - OLD.x1, OLD.y0 - y, y - OLD.y1);
  const STATS = { softened: 0, ring: 0, ash: 0 };

  // ---------- 1. give the rectangle back to Wolfwood ----------
  // Runs last of all the world hooks (file order), so it sees the finished map: 24-dwarves has stopped
  // carving, 39-worldblend has blended, 53-coalmine has berthed its cart inside the instance.
  HOOKS.world.push((rnd0, api) => {
    const rnd = mulberry32(0x0deb01);      // its own stream: what the passes before this drew must not move the result
    STATS.softened = 0; STATS.ring = 0;
    // Wolfwood's own mix, as 02-world lays it: about a quarter wood (oaks 3 in 10 of that), a few mushrooms,
    // the rest open grass. A tile picked this way sits in the wood without anyone being able to point at it.
    const wood = () => { const r = rnd(); return r < 0.26 ? (rnd() < 0.3 ? T.OAK : T.TREE) : r < 0.30 ? T.MUSHROOM : T.GRASS; };
    for (let y = OLD.y0 - RING; y <= OLD.y1 + RING; y++) for (let x = OLD.x0; x <= OLD.x1 + RING; x++) {
      if (!inMap(x, y) || x < 1 || y < 1 || x > MAP_W - 2 || y > MAP_H - 2) continue;
      const d = rectDist(x, y); if (d < 1 || d > RING) continue;
      STATS.ring++;
      if (buildingAt(x, y) || api.tileAt(x, y) !== T.ROCK) continue;   // only the grey outcrops go; iron and coal are ordinary Wolfwood
      api.setTile(x, y, wood()); STATS.softened++;
    }

    // The other thing the rectangle blocked: 39-worldblend drifts the Ashfields' ash up into Wolfwood's last
    // three rows (y 92–94) right across the map — except here, because it may not write inside a rectangle it
    // marks hard. That left the drift stopping dead at a straight line down x 26. It runs through now, at the
    // density it has on the far side of the line, measured row by row so it always matches rather than guesses.
    const ASH = ('ASH' in T) ? T.ASH : -1;
    const GRASSY = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM]);
    STATS.ash = 0;
    if (ASH >= 0) for (let y = 92; y <= 94; y++) {
      let ash = 0, open = 0;
      for (let x = OLD.x1 + 1; x <= 99; x++) { const t = api.tileAt(x, y); if (t === ASH) ash++; else if (GRASSY.has(t)) open++; }
      const p = (ash + open) ? ash / (ash + open) : 0;
      for (let x = OLD.x0; x <= OLD.x1; x++) if (GRASSY.has(api.tileAt(x, y)) && !buildingAt(x, y) && rnd() < p) { api.setTile(x, y, ASH); STATS.ash++; }
    }
  });

  // ---------- 2. the hop: one instance to another and back ----------
  // INSTANCES.enter refuses while another instance is open (and rightly: there is one `map`). A ride that
  // starts underground therefore leaves first — which puts the knight on the shaft step in Grey Quarry —
  // opens the second instance from there, and comes back down when that one closes.
  let hop = null;                          // { back: instance id, at: [tx, ty] inside it, via: the instance we rode into }
  HOOKS.newGame.push(() => { hop = null; });

  function standAt(tx, ty) {
    player.action = null; player.x = tc(tx); player.y = tc(ty); player.facing = { x: 0, y: -1 };
    const s = safeSpot(player.x, player.y, player.r, 'player'); if (s) { player.x = s.x; player.y = s.y; }
  }
  // ride from the instance you are standing in into `toId`, and remember the tile to come back to.
  // Returns false when there is nothing to hop out of, so the caller can enter the ordinary way.
  function rideFrom(toId, back) {
    if (!window.INSTANCES || !window.DEEPHOLM || player.dead) return false;
    const from = INSTANCES.active();
    if (from !== DEEPHOLM.ID) return false;
    INSTANCES.leave();                                       // up the shaft: the surface, standing on the shaft step
    if (!INSTANCES.enter(toId)) {                            // the ride was refused: put the knight back where he was
      INSTANCES.enter(DEEPHOLM.ID, DEEPHOLM.SHAFT_STEP); standAt(back[0], back[1]); return false;
    }
    hop = { back: from, at: [back[0], back[1]], via: toId };
    return true;
  }
  // the ride ended (the shift ran out, the haul cart was called, the ladder was climbed, L was pressed):
  // the knight is back on the surface, so take him back down to the tile he rode from.
  HOOKS.update.push(() => {
    if (!hop || !window.INSTANCES) return;
    if (INSTANCES.active() === hop.via) return;               // still down at the seam
    const h = hop; hop = null;
    if (player.dead || INSTANCES.active()) return;            // died down there, or ended up somewhere else: leave him where he is
    if (INSTANCES.enter(h.back, DEEPHOLM.SHAFT_STEP)) { standAt(h.at[0], h.at[1]); burst(player.x, player.y, '#c9a36a', 14, 80); }
  });
  // a save never describes an instance (16-instances), so a load in the middle of a ride must not drag the
  // knight back underground: the save put him on the surface and that is where he stays.
  const _load = load;
  load = () => { hop = null; return _load(); };

  window.UNDERGROUND = { OLD, RING, rideFrom, stats: () => ({ ...STATS }), get hop() { return hop; } };

  // ---------- the book ----------
  // 44-wiki builds Deepholm's page from the live tables. As a region it read its forge and anvil straight off
  // the overworld map; as an instance those tiles are not on `map`, and the dwarves have never been in NPCS.
  // Both are written in here so the page says everything it said before, and the people it never listed.
  if (window.WIKI && window.DEEPHOLM) WIKI.add('places', {
    id: 'deepholm', name: 'Deepholm', sub: 'The dwarven undercity', kind: 'instance',
    npcs: DEEPHOLM.DWARVES.map(d => d.name + (d.shop && SHOPS[d.shop] ? ` — ${SHOPS[d.shop].name}` : '')),
    stations: ['Forge', 'Anvil'],
    buildings: ['The great forge hall', "King Thrain's throne hall", 'The mithril galleries'],
  });

  // ---------- self-test ----------
  const P = 'underground: ';
  HOOKS.selfTest.push((check, F, h) => {
    if (!window.INSTANCES || !window.DEEPHOLM) { check(P + 'Deepholm needs the instance system', false, {}); return; }
    const D = window.DEEPHOLM;
    const tileOf = () => [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
    const onStep = () => { const [x, y] = tileOf(); return x === D.SHAFT_STEP[0] && y === D.SHAFT_STEP[1]; };
    const sum = () => { let s = 0; for (let i = 0; i < map.length; i++) s = (Math.imul(s, 31) + map[i]) | 0; return s; };
    h.peace(true);
    if (INSTANCES.active()) INSTANCES.leave();
    const rg0 = regrow, fr0 = fires; regrow = []; fires = [];      // the surface must hold still while its checksum is compared
    const sum0 = sum(), n0 = monsters.length;

    // ---- the shaft is the door, and the way out puts you back on its step ----
    { F.tp(54, 14); const w = F.goAdjacent(D.SHAFT.x, D.SHAFT.y, 1500); F.face(D.SHAFT.x, D.SHAFT.y); F.press('KeyE'); F.sim(2, []);
      const inside = INSTANCES.active() === D.ID, at = tileOf(), banner = !!areaBanner && areaBanner.name === 'Deepholm';
      const swapped = tileAt(D.LADDER.x, D.LADDER.y) === D.tiles.ladder && tileAt(D.THRONE.x, D.THRONE.y) === D.tiles.throne && tileAt(0, 0) === T.WALL;
      const guards = monsters.filter(m => m.type === 'dwarf_guard').length;
      // Death and his house stand at (25–30, 10–14) on the surface: inside the undercity they are put away
      const deathAway = !NPCS.some(n => n.id === 'death1') && !BUILDINGS.some(b => b.id === 'death1');
      // the shaft, the ladder and everything solid worth using down there are tap-to-move targets on an iPad
      const tappable = [D.tiles.shaft, D.tiles.ladder, D.tiles.mithril, D.tiles.chest, D.tiles.throne].every(t => INTERESTING_TILES.has(t));
      F.press('KeyL'); F.sim(2, []);
      const out = INSTANCES.active() === null && onStep() && sum() === sum0 && monsters.length === n0 && NPCS.some(n => n.id === 'death1') && BUILDINGS.some(b => b.id === 'death1');
      check(P + 'E on the Grey Quarry shaft opens Deepholm (its own map, its own guards, Death put away, shaft and ladder tappable); L climbs out onto the shaft step with the surface exactly as it was',
        typeof w === 'number' && inside && banner && swapped && guards === 2 && deathAway && tappable && at[0] === D.ENTRY[0] && at[1] === D.ENTRY[1] && out,
        { walked: w, inside, banner, swapped, guards, deathAway, tappable, entry: at, out, onStep: onStep(), same: sum() === sum0 }); }

    // ---- everyone and everything down there is reachable on foot from the ladder ----
    { D.enter(); F.tp(D.ENTRY[0], D.ENTRY[1]);
      const want = [];
      for (const d of D.DWARVES) want.push([d.name, d.x, d.y]);
      want.push(["King Thrain's throne", D.THRONE.x, D.THRONE.y], ['the ladder out', D.LADDER.x, D.LADDER.y]);
      D.FORGES.forEach(([x, y], i) => want.push(['forge ' + (i + 1), x, y]));
      D.ANVILS.forEach(([x, y], i) => want.push(['anvil ' + (i + 1), x, y]));
      D.CHESTS.forEach(([x, y], i) => want.push(['dwarven chest ' + (i + 1), x, y]));
      D.LAMPS.forEach(([x, y], i) => want.push(['lamp ' + (i + 1), x, y]));
      D.MITHRIL_ROCKS.forEach(([x, y], i) => want.push(['mithril rock ' + (i + 1), x, y]));
      D.GUARDS.forEach(([x, y], i) => want.push(['guard post ' + (i + 1), x, y]));
      if (window.COALMINE) want.push(['the coal cart', COALMINE.CART_T.x, COALMINE.CART_T.y]);
      // a target that is solid (a rock, a chest, the throne, a lamp) counts when a tile beside it is walkable-to
      const beside = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => F.bfs(D.ENTRY[0], D.ENTRY[1], x + dx, y + dy)).filter(Boolean);
      const bad = want.filter(([, x, y]) => !beside(x, y).length).map(([n, x, y]) => `${n} @${x},${y}`);
      // and one of them walked for real, not just flooded to
      const walked = F.goAdjacent(D.THRONE.x, D.THRONE.y, 2500);
      const rug = tileAt(13, 21) === T.RUG;
      check(P + `every dwarf, lamp, rock, forge, anvil, chest, guard post and the coal cart is walkable from the ladder (${want.length}), and the knight can walk to the throne`,
        bad.length === 0 && typeof walked === 'number' && rug, { targets: want.length, unreachable: bad, walkedToThrone: walked, throneRug: rug });
      INSTANCES.leave(); }

    // ---- nothing of Deepholm is left on the surface ----
    { const gone = { LAMP: 0, LADDER_UP: 0, MITHRIL: 0, DWARF_THRONE: 0, DWARF_CHEST: 0, COAL_CART: 0, COAL_RAIL: 0 };
      const ids = { LAMP: D.tiles.lamp, LADDER_UP: D.tiles.ladder, MITHRIL: D.tiles.mithril, DWARF_THRONE: D.tiles.throne, DWARF_CHEST: D.tiles.chest,
        COAL_CART: window.COALMINE ? COALMINE.tiles.cart : -1, COAL_RAIL: window.COALMINE ? COALMINE.tiles.rail : -1 };
      let shafts = 0;
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const t = map[idx(x, y)]; if (t === D.tiles.shaft) shafts++; for (const k in ids) if (t === ids[k]) gone[k]++; }
      const nobody = !D.DWARVES.some(d => NPCS.some(n => n.id === d.id));
      check(P + 'the only thing Deepholm leaves on the overworld is the shaft at Grey Quarry: no lamp, ladder, mithril, throne, chest, cart or rail, and no dwarf in NPCS',
        shafts === 1 && Object.values(gone).every(v => v === 0) && nobody && tileAt(D.SHAFT.x, D.SHAFT.y) === D.tiles.shaft && !SOLID.has(tileAt(D.SHAFT_STEP[0], D.SHAFT_STEP[1])),
        { shafts, leftOver: gone, nobody, step: tileAt(D.SHAFT_STEP[0], D.SHAFT_STEP[1]) }); }

    // ---- the vacated rectangle is ordinary Wolfwood: walkable, joined to the rest of the map, and it looks it ----
    { const U = window.UNDERGROUND, O = U.OLD;
      const mix = {}; let solid = 0, floor = 0, alien = 0;
      const WOODY = new Set([T.GRASS, T.TREE, T.OAK, T.FLOWERS, T.MUSHROOM, T.DIRT, T.ROCK, T.IRON, T.COAL, T.STUMP, ('ASH' in T) ? T.ASH : T.GRASS]);
      for (let y = O.y0; y <= O.y1; y++) for (let x = O.x0; x <= O.x1; x++) {
        const t = map[idx(x, y)];
        mix[t] = (mix[t] || 0) + 1;
        if (!WOODY.has(t)) alien++;
        if (SOLID.has(t)) solid++; else floor++;
      }
      // How thick the wood stands, over land only and never through a building. 02-world only scatters forest
      // from x 21 east (CAVE_EXIT_X + 1), so Wolfwood's western columns are open meadow all the way down the
      // map and its eastern ones are thick wood — which is why the rectangle is measured against the SAME
      // columns just north of it and the SAME rows just east of it, rather than against one flat number.
      // (roads, paths and drifted ash are left out of the count: the forest pass only ever planted on grass)
      const PLANTED = new Set([T.GRASS, T.TREE, T.OAK, T.FLOWERS, T.MUSHROOM, T.ROCK, T.IRON, T.COAL]);
      const dens = (x0, y0, x1, y1) => { let t = 0, n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const v = map[idx(x, y)]; if (!PLANTED.has(v) || buildingAt(x, y)) continue; n++; if (v === T.TREE || v === T.OAK) t++; } return n ? t / n : -1; };
      const westIn = dens(2, 72, 20, 94), westOut = dens(2, 62, 20, 71);       // the open western meadow, inside the old rectangle and just north of it
      const eastIn = dens(21, 72, 26, 94), eastOut = dens(27, 72, 45, 94);     // the thick eastern wood, inside the old rectangle and just east of it
      const matches = Math.abs(westIn - westOut) <= 0.08 && Math.abs(eastIn - eastOut) <= 0.15 && eastOut > 0.1;
      // and the Ashfields' drift crosses the old rectangle instead of stopping at its wall
      let ashIn = 0, ashOut = 0;
      for (let y = 92; y <= 94; y++) { for (let x = 2; x <= 26; x++) if (map[idx(x, y)] === T.ASH) ashIn++; for (let x = 27; x <= 60; x++) if (map[idx(x, y)] === T.ASH) ashOut++; }
      // a flood over the whole map from the cave road: every open tile in the rectangle must be in it
      const seen = new Uint8Array(MAP_W * MAP_H), q = [];
      const pass = t => !SOLID.has(t) || PUSH_THROUGH.has(t);
      const push = (x, y) => { if (!inMap(x, y)) return; const i = idx(x, y); if (seen[i] || !pass(map[i])) return; seen[i] = 1; q.push(i); };
      push(21, 7);
      for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
      let stranded = 0; for (let y = O.y0; y <= O.y1; y++) for (let x = O.x0; x <= O.x1; x++) if (pass(map[idx(x, y)]) && !seen[idx(x, y)]) stranded++;
      // the ghost of the massif: 39-worldblend's outcrops at the foot of walls that are not there any more
      let ringRock = 0, woodRock = 0;
      for (let y = O.y0 - U.RING; y <= O.y1 + U.RING; y++) for (let x = O.x0; x <= O.x1 + U.RING; x++) {
        const d = Math.max(O.x0 - x, 0, x - O.x1, O.y0 - y, y - O.y1);
        if (inMap(x, y) && d >= 1 && d <= U.RING && map[idx(x, y)] === T.ROCK) ringRock++;
      }
      for (let y = 70; y <= 94; y++) for (let x = 34; x <= 110; x++) if (map[idx(x, y)] === T.ROCK) woodRock++;  // the same wood, well clear of the old rectangle
      const region = regionAt(14, 83).name, spawns = MONSTER_SPAWNS.filter(s => s.tx >= O.x0 && s.tx <= O.x1 && s.ty >= O.y0 && s.ty <= O.y1).length;
      check(P + '575 tiles of Wolfwood come back at x 2–26, y 72–94: no wall, nothing stranded, the wood as thick inside the old rectangle as it is on each side of it, the ash still drifting through its last rows, and no ring of outcrops round a rectangle of nothing',
        alien === 0 && (mix[T.WALL] || 0) === 0 && stranded === 0 && floor + solid === 575 && floor >= 500 && matches && region === 'Wolfwood' && ringRock === 0 && woodRock > 10 && spawns >= 1 && ashIn > 0 && ashOut > 0,
        { open: floor, solid, alien, walls: mix[T.WALL] || 0, stranded, region, spawnsBack: spawns, ringRock, ringChecked: U.stats().ring, ringSoftened: U.stats().softened, woodRock,
          woodInside: { west: +westIn.toFixed(3), east: +eastIn.toFixed(3) }, woodBeside: { west: +westOut.toFixed(3), east: +eastOut.toFixed(3) }, ashDrift: { inside: ashIn, beside: ashOut, laid: U.stats().ash } }); }

    // ---- save and reload while you are down there ----
    { D.enter(); F.tp(D.THRONE.x, D.THRONE.y - 2); const wasIn = INSTANCES.active() === D.ID;
      save(); const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      const still = INSTANCES.active() === D.ID;
      const ok = load(); F.sim(2, []);
      check(P + 'saving inside Deepholm writes the surface with the knight on the shaft step; a reload lands him there, outside, with the overworld back',
        wasIn && still && raw.player.x === tc(D.SHAFT_STEP[0]) && raw.player.y === tc(D.SHAFT_STEP[1]) && raw.player.region !== 'Deepholm' && ok && INSTANCES.active() === null && onStep() && player.region === 'Grey Quarry' && sum() === sum0,
        { wasIn, still, saved: [raw.player.x / TILE - 0.5, raw.player.y / TILE - 0.5], savedRegion: raw.player.region, loaded: ok, at: tileOf(), region: player.region, same: sum() === sum0 }); }

    // ---- the coal road: the cart is in Deepholm, it rides down, and the shift ends back beside it ----
    if (window.COALMINE) {
      const q0 = quest.coalmine ? { ...quest.coalmine } : null;
      D.enter();
      const c = COALMINE.CART_T;
      if (!hasTool('pickaxe')) h.give('bronze_pickaxe', 1);
      F.tp(c.x, c.y + 1); F.face(c.x, c.y);
      const cartHere = tileAt(c.x, c.y) === COALMINE.tiles.cart;
      F.press('KeyE'); F.sim(2, []);
      const down = INSTANCES.active() === COALMINE.MINE.id, hopping = !!UNDERGROUND.hop && UNDERGROUND.hop.back === D.ID;
      const run = COALMINE.run, faces = run ? run.faces.length : 0;
      let mined = 0;
      if (run && run.faces.length) { const [fx, fy] = run.faces[0]; F.tp(fx + 1, fy); F.face(fx, fy); F.press('KeyE'); if (player.action) player.action.t = player.action.need; F.sim(2, []); mined = run.coal; }
      if (COALMINE.run) COALMINE.endRun('test');
      F.sim(3, []);
      const back = INSTANCES.active() === D.ID, at = tileOf(), beside = at[0] === c.x && at[1] === c.y + 1;
      check(P + 'the coal cart still stands in Deepholm and still works: E rides you down to the seam, a face still pays coal, and the end of the shift puts you back beside the cart underground',
        cartHere && down && hopping && faces === COALMINE.SEAM_LIVE && mined >= 2 && back && beside && !UNDERGROUND.hop,
        { cartHere, rodeDown: down, hopping, faces, mined, backInDeepholm: back, at, cart: [c.x, c.y] });
      INSTANCES.leave();
      if (q0) quest.coalmine = q0;
    }

    if (INSTANCES.active()) INSTANCES.leave();
    regrow = rg0; fires = fr0; save(); h.peace(false);
  });
}
