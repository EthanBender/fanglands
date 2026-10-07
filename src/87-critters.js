// ============================================================================
// THE STARTING CREATURES (the Great Spread, Stage 5a: ~/.fanglands/work/spread/spec.md §4 "Starting creatures", §13)
// src/87-critters.js
//
// The first walk out of the cave had goblins and boars and little else. These are the small things of the fields, the
// rungs between the cave spiders and the goblins on the way up (42-playthrough lists each one's kill on its curve):
//
//   crow       lv 2,  8 hp   peaceful   round the story signpost's meadow              drops feathers, now and then a coin it stole
//   giant rat  lv 3, 12 hp   peaceful   the meadow below the cave mouth                drops what it stole: coins, bread, seeds
//   snake      lv 4, 14 hp   peaceful   the reeds round Miller's Pond                  drops its skin
//   adder      lv 6, 18 hp   peaceful   the pond's quiet side                          always leaves its skin
//   wild dog   lv 6, 18 hp   ATTACKS    two packs of three in the fields, well off the road (sight 4 tiles)
//
// Where (§4): spawns are written in place frames (the signpost's, the pond's) or as world points (open land), so they move
// with the land. Every spawn stands where its point says, on open ground with nothing a new game clears round it (no tree,
// rock, flower or mushroom in its 3 x 3), so the world's tiles are exactly the last build's (the FOOTPRINT proof). The
// wild dogs stand 8.5+ tiles off every main road's centre line and keep to 2 tiles of home (def.roam), so a knight
// walking the road is never seen by one (2 + 4 + 1.5 < 8.5); the west pack is the Cave Road's beat at about 110 (§6: a
// stop within 10 tiles of the road). The places still staked (Millbrook, Saltmere, the Old Bridge, Beacon Hills) get
// their crows, rats and snakes when they are built (Stage 5b, 5d): CRITTERS.DEFS is the table they spawn from.
//
// The footprint (§10 "worldRev sweeps"): WORLD_REV 1 is this stage. ATLAS.REVS[1] is the 3 x 3 round each new spawn: a
// knight's own plank or wall standing there in a world-2 save of rev 0 comes back to him (SPREAD.sweep), so no creature
// wakes inside it.
//
// The look is 87-critterart (pictures only, stripped from the server's copy); the book's pages and the item icons too.
// Feature file: registers through HOOKS; the one core line it reads is def.roam (07-update).
// window.CRITTERS is the test handle.
// ============================================================================
{
  const A = ATLAS, W = A.world, SG = A.frame('signpost'), PD = A.frame('pond');

  // ---------- the creatures ----------
  // XP is the core's (hp x 4 below level 10): crow 32, giant rat 48 (a goblin's), snake 56, adder 72, wild dog 72.
  // drops: always [[id,min,max]], table [[id,min,max,weight]] ('nothing' allowed), rare {chance, table} (01-items)
  const DEFS = {
    crow: { name: 'Crow', level: 2, r: 10, hp: 8, att: 2, maxHit: 1, def: 1, speed: 150, aggro: false, sight: 3 * TILE, respawn: 30,
      drops: { table: [['nothing', 0, 0, 5], ['crow_feather', 1, 2, 6], ['coins', 1, 3, 2]] } },
    giant_rat: { name: 'Giant rat', level: 3, r: 12, hp: 12, att: 3, maxHit: 2, def: 2, speed: 125, aggro: false, sight: 3 * TILE, respawn: 30,
      drops: { table: [['nothing', 0, 0, 8], ['coins', 1, 4, 4], ['bread', 1, 1, 2], ['potato_seed', 1, 2, 3], ['wheat_seed', 1, 2, 2]] } },
    snake: { name: 'Snake', level: 4, r: 11, hp: 14, att: 5, maxHit: 3, def: 3, speed: 95, aggro: false, sight: 3 * TILE, respawn: 35, roam: 2,
      drops: { table: [['nothing', 0, 0, 4], ['snakeskin', 1, 1, 5]] } },
    adder: { name: 'Adder', level: 6, r: 12, hp: 18, att: 7, maxHit: 4, def: 4, speed: 105, aggro: false, sight: 3 * TILE, respawn: 40, roam: 2,
      drops: { always: [['snakeskin', 1, 1]] } },
    // aggro at sight 4 (§4), and a pack keeps to its patch: 2 tiles of home while it idles
    wild_dog: { name: 'Wild dog', level: 6, r: 13, hp: 18, att: 6, maxHit: 4, def: 4, speed: 165, aggro: true, sight: 4 * TILE, respawn: 45, roam: 2,
      drops: { table: [['nothing', 0, 0, 6], ['raw_beef', 1, 1, 3], ['wool', 1, 1, 2]] } },
  };
  Object.assign(MONSTER_DEFS, DEFS);

  // ---------- what they leave ----------
  // (added after 01-items' id-and-stack pass, so each sets its own)
  ITEMS.crow_feather = { id: 'crow_feather', name: 'Crow feather', value: 2, color: '#262a36', shape: 'silk', stack: 50 };
  ITEMS.snakeskin = { id: 'snakeskin', name: 'Snakeskin', value: 12, color: '#a8b47a', shape: 'pelt', stack: 50 };

  // ---------- where (§4) ----------
  // [type, points]: open land as world points (the old map's numbers, stretched), a place's own spots in its frame.
  // Each is a whole tile on the new map: rats (33,18) (35,21) (40,17); crows (107,40) (107,45) (112,37); snakes (75,52)
  // (78,57) (76,62); the adder (66,55); the west pack (122,35) (124,36) (122,37); the east pack (219,59) (221,60) (219,61).
  // Each stands where 92-worldshape's outline and its region's box agree (the spawn's region is the one its box says).
  const HAUNTS = [
    // the cave meadow (§4: 24..40 x 12..22), between Death's House and the road's first bend
    { id: 'cave_meadow', type: 'giant_rat', at: () => W.pts([[21, 12], [22, 14], [25, 11]]) },
    // the story signpost's meadow, both sides of the Cave Road (R1's stop at 85: the signpost and the crows)
    { id: 'signpost_meadow', type: 'crow', at: () => SG.pts([[67, 25], [67, 30]]).concat([W.p(69.5, 24)]) },
    // Miller's Pond: the reeds of its north, east and south shores, and the adder on the quiet west side
    { id: 'pond_reeds', type: 'snake', at: () => PD.pts([[46, 31], [49, 36], [47, 41]]) },
    { id: 'pond_reeds', type: 'adder', at: () => [PD.p(37, 34)] },
    // the fields between the signpost and the west gate, north of the Cave Road (R1's stop at 110)
    { id: 'west_fields', type: 'wild_dog', pack: true, at: () => W.pts([[75.5, 23], [77, 23.5], [75.5, 24]]) },
    // the fields between the town and the camp, south of the Sea Road's run to the camp gap and north of the outpost's stakes
    { id: 'east_fields', type: 'wild_dog', pack: true, at: () => W.pts([[135.5, 38], [136.5, 38.5], [135.5, 39.5]]) },
  ];
  const tilesOf = h => h.at().map(([x, y]) => [Math.round(x), Math.round(y)]);
  // every spawn this file makes, as whole tiles
  const SPOTS = () => HAUNTS.flatMap(h => tilesOf(h).map(([x, y]) => ({ id: h.id, type: h.type, x, y })));

  // ---------- the footprint (§10): WORLD_REV 1 ----------
  if (A.REVS) A.REVS[1] = { stage: '5a', by: '87-critters', why: 'the ground each new creature wakes on', boxes: SPOTS().map(s => [s.x - 1, s.y - 1, s.x + 1, s.y + 1]) };

  // ---------- the spawns ----------
  // On the finished land (HOOKS.built, after 92-worldshape, 93-ashedge and the stakes): those passes draw their own dice
  // tile by tile round every spawn, so a spawn added before them moved flowers and trees all over the map. No dice here:
  // every spawn stands where its point says, and the shared rnd is not drawn.
  HOOKS.built.push((rnd, api) => { for (const h of HAUNTS) api.spawnList(h.type, tilesOf(h)); });

  // ---------- the handle ----------
  const API = { DEFS, HAUNTS, SPOTS, ROAD_CLEAR: 8.5 };
  window.CRITTERS = API;

  // ---------- self-tests ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'critters: ';
    const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
    const roadD = (x, y) => { let b = Infinity; for (const id of A.MAIN_ROADS) { const pl = A.track(id); for (let k = 1; k < pl.length; k++) b = Math.min(b, segD(x, y, pl[k - 1][0], pl[k - 1][1], pl[k][0], pl[k][1])); } return b; };
    const spots = SPOTS(), mine = new Set(spots.map(s => s.type + '@' + s.x + ',' + s.y));
    // the spawns as the world has them (a fresh map: a --play run has changed this one)
    const tiles = window.PLAYTHROUGH ? PLAYTHROUGH.pristine : map;
    // (this file's own: a place built later spawns these kinds too, and marks each with its file, s.by)
    const ours = MONSTER_SPAWNS.filter(s => DEFS[s.type] && !s.by);

    // 1. the table as §4 has it
    { const D = MONSTER_DEFS, want = { crow: { lv: 2, hp: 8 }, giant_rat: { lv: 3, hp: 12 }, snake: { lv: 4, hp: 14 }, adder: { lv: 6, hp: 18 }, wild_dog: { lv: 6, hp: 18 } };
      const bad = Object.keys(want).filter(t => !D[t] || D[t].level !== want[t].lv || D[t].hp !== want[t].hp);
      const aggro = Object.keys(DEFS).filter(t => D[t].aggro);
      const drops = Object.keys(DEFS).flatMap(t => { const d = D[t].drops; return [...(d.always || []), ...(d.table || []), ...((d.rare && d.rare.table) || [])].map(r => r[0]).filter(id => id !== 'nothing' && !ITEMS[id]); });
      const xp = Object.keys(DEFS).map(t => D[t].hp * 4), spider = D.spider.hp * 4;
      check(P + 'crow lv 2 (8 hp), giant rat lv 3 (12 hp), snake lv 4, adder lv 6, wild dog lv 6 (18 hp), only the wild dogs attack on sight (4 tiles), every drop a real item, each kill worth more xp than a cave spider\'s',
        !bad.length && aggro.join() === 'wild_dog' && D.wild_dog.sight / TILE === 4 && !drops.length && xp.every(v => v > spider), { bad, aggro, drops, xp }); }

    // 2. every spawn where its point says, nothing moved, the count as written
    { const counts = {}; for (const s of ours) counts[s.type] = (counts[s.type] || 0) + 1;
      const moved = ours.filter(s => s.movedFrom).map(s => s.type + ' ' + s.movedFrom + '->' + s.tx + ',' + s.ty), stray = ours.filter(s => !mine.has(s.type + '@' + s.tx + ',' + s.ty)).map(s => s.type + '@' + s.tx + ',' + s.ty);
      check(P + 'the spawns stand where they are written: 3 giant rats, 3 crows, 3 snakes, 1 adder, 6 wild dogs, none moved by the door rule or the road pass',
        ours.length === spots.length && counts.giant_rat === 3 && counts.crow === 3 && counts.snake === 3 && counts.adder === 1 && counts.wild_dog === 6 && !moved.length && !stray.length, { counts, moved, stray }); }

    // 3. clean ground: open, with nothing a new game clears in the 3 x 3 round it (so not one tile of the world changed), off doors and staked ground
    { const CLEAR = new Set([T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM]), bad = [];
      for (const s of spots) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = tiles[idx(s.x + dx, s.y + dy)]; if (CLEAR.has(t) || (SOLID.has(t) && t !== T.WATER) || buildingAt(s.x + dx, s.y + dy)) bad.push(s.type + '@' + s.x + ',' + s.y + ' ' + tileName(t)); }
        const t0 = tiles[idx(s.x, s.y)]; if (t0 === T.WATER || SOLID.has(t0)) bad.push(s.type + '@' + s.x + ',' + s.y + ' stands in ' + tileName(t0));
        if (A.reservedAt(s.x, s.y) || A.onMainRoad(s.x, s.y)) bad.push(s.type + '@' + s.x + ',' + s.y + ' on staked ground or a main road');
      }
      check(P + 'every spawn stands on open ground with nothing a new game clears round it (the world\'s tiles are the last build\'s), off staked ground and off the main roads', !bad.length, { bad: bad.slice(0, 8) }); }

    // 4. the right ground: each in its haunt's region (where 92's outline and the region's box agree) and the Atlas zone of that region
    { const want = { cave_meadow: ['goblin_fields'], signpost_meadow: ['goblin_fields'], pond_reeds: ['miller_pond'], west_fields: ['goblin_fields'], east_fields: ['goblin_fields'] };
      const bad = spots.filter(s => !want[s.id].includes(A.zoneAt('over', s.x, s.y)) || A.slug(regionAt(s.x, s.y).name) !== A.zoneAt('over', s.x, s.y) || WORLDSHAPE.boxRegion(s.x, s.y).name !== regionAt(s.x, s.y).name)
        .map(s => s.type + '@' + s.x + ',' + s.y + ' ' + A.zoneAt('over', s.x, s.y) + ' / ' + regionAt(s.x, s.y).name);
      const MB = W.box([15, 8, 25, 14]).map(Math.round);   // §4's cave meadow, 24..40 x 12..21 on the new map
      const meadow = spots.filter(s => s.id === 'cave_meadow').every(s => s.x >= MB[0] && s.x <= MB[2] && s.y >= MB[1] && s.y <= MB[3]);
      const sign = spots.filter(s => s.id === 'signpost_meadow').every(s => dist(s.x, s.y, SIGN_TILE.x, SIGN_TILE.y) <= 10);
      const dry = spots.filter(s => s.id === 'pond_reeds' && !(() => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (tiles[idx(s.x + dx, s.y + dy)] === T.WATER) return true; return false; })()).map(s => s.type + '@' + s.x + ',' + s.y);
      check(P + 'each haunt on its own ground: rats in the cave meadow (24..40 x 12..21), crows within 10 tiles of the story signpost, snakes and the adder on Miller\'s Pond\'s shore (water within 2), the packs in the Goblin Fields; each spawn\'s Atlas zone is its region\'s, and 92\'s outline and the box agree on the region',
        !bad.length && meadow && sign && !dry.length, { bad, meadow, sign, dry, MB }); }

    // 5. the wild dogs: 8.5+ off every main road (sight 4 + roam 2 + the road's half-width never reach one); the west pack is the Cave Road's beat (within 10 tiles of it)
    { const dogs = spots.filter(s => s.type === 'wild_dog'), d = dogs.map(s => roadD(s.x, s.y));
      const west = dogs.map((s, i) => [s, d[i]]).filter(([s]) => s.id === 'west_fields'), r1 = Math.min(...west.map(([s]) => { const pl = A.track('r1_cave'); let b = Infinity; for (let k = 1; k < pl.length; k++) b = Math.min(b, segD(s.x, s.y, pl[k - 1][0], pl[k - 1][1], pl[k][0], pl[k][1])); return b; }));
      const reach = DEFS.wild_dog.roam + DEFS.wild_dog.sight / TILE + 1.5;
      check(P + `the wild dogs stand ${API.ROAD_CLEAR}+ tiles off every main road (a knight on the road is beyond a dog's roam and sight: ${reach} tiles), and the west pack is within 10 of the Cave Road (its beat)`,
        dogs.length === 6 && d.every(v => v >= API.ROAD_CLEAR && v > reach) && r1 <= 10, { d: d.map(v => +v.toFixed(1)), r1: +r1.toFixed(1), reach }); }

    // 6. reachable: a knight walks from the cave mouth to every one (4 ways over the tiles a knight can stand on)
    { const N = MAP_W * MAP_H, seen = new Uint8Array(N), q = new Int32Array(N); let n = 0;
      const take = i => { if (!seen[i] && !SOLID.has(tiles[i])) { seen[i] = 1; q[n++] = i; } };
      take(idx(Math.floor(SPAWN.x / TILE), Math.floor(SPAWN.y / TILE)));
      for (let k = 0; k < n; k++) { const c = q[k], x = c % MAP_W; if (x > 0) take(c - 1); if (x < MAP_W - 1) take(c + 1); if (c >= MAP_W) take(c - MAP_W); if (c + MAP_W < N) take(c + MAP_W); }
      const cut = spots.filter(s => !seen[idx(s.x, s.y)]).map(s => s.type + '@' + s.x + ',' + s.y);
      check(P + 'a knight walks from the cave to every creature\'s ground', !cut.length, { cut }); }

    // 7. the footprint: WORLD_REV 1 is this stage (later stages bump it past 1), its boxes the 3 x 3 round each spawn
    { const R = A.REVS && A.REVS[1], boxes = R ? R.boxes : [];
      const every = spots.every(s => boxes.some(b => b[0] === s.x - 1 && b[1] === s.y - 1 && b[2] === s.x + 1 && b[3] === s.y + 1));
      check(P + 'the footprint: WORLD_REV is 1 or later and ATLAS.REVS[1] is the 3 x 3 round each of the 16 spawns', WORLD_REV >= 1 && boxes.length === spots.length && every, { WORLD_REV, n: boxes.length }); }

    // 8. a wild dog wakes at 4 tiles and not at 5; idle, a dog keeps to 2 tiles of home; a crow fights back only when hit, and its kill pays 32 xp
    if (!window.__instance) {
      const px0 = player.x, py0 = player.y, hp0 = player.hp, peace0 = window.__peace;
      h.peace(false);
      // (this file's own: a built place's crows come first in the list now)
      const own = m => spots.some(s => s.type === m.type && s.x === Math.floor(m.home.x / TILE) && s.y === Math.floor(m.home.y / TILE));
      const dog = monsters.find(m => m.type === 'wild_dog' && !m.dead && own(m)), crow = monsters.find(m => m.type === 'crow' && !m.dead && own(m));
      const res = {};
      if (dog && crow) {
        const keep = monsters.map(m => [m, m.x, m.y, m.hp, m.state, m.angry, m.dead]);
        const reset = () => { for (const m of monsters) if (DEFS[m.type]) { m.x = m.home.x; m.y = m.home.y; m.state = 'idle'; m.angry = MONSTER_DEFS[m.type].aggro; m.attackCd = 1; } };
        // a knight of combat level 3 (the dogs leave a strong one alone: 07-update's aggressive rule)
        const sk0 = JSON.stringify(player.skills); for (const k of ['melee', 'defence', 'hitpoints', 'range']) if (player.skills[k]) player.skills[k].xp = 0;
        try {
          // its sight is 4 tiles: a knight 5 tiles off (1.25 sights) is not seen, one 3.5 off (0.875) is
          const S = DEFS.wild_dog.sight;
          reset(); player.x = dog.home.x + S * 1.25; player.y = dog.home.y; F.step([]); res.at5 = dog.state;
          reset(); player.x = dog.home.x + S * 0.875; player.y = dog.home.y; F.step([]); res.at35 = dog.state;
          // idle for 40 s with him 30 tiles off: never past 2 tiles (and the push of a packmate) from home
          reset(); player.x = dog.home.x + S * 7.5; player.y = dog.home.y; let far = 0;
          for (let i = 0; i < 2400; i++) { F.step([]); far = Math.max(far, dist(dog.x, dog.y, dog.home.x, dog.home.y)); }
          res.far = +(far / TILE).toFixed(2);
          // the crow: idle beside it nothing happens; blows until it falls pay 4 melee xp a point of damage (32 for its 8 hp, more on an overkill)
          reset(); const C = DEFS.crow.sight;   // 3 tiles
          player.x = crow.home.x + C * 0.5; player.y = crow.home.y; player.hp = player.maxHp; F.sim(30, []); res.calm = crow.state !== 'chase';
          const xp0 = player.skills.melee.xp, k0 = player.kills | 0; crow.hp = crow.maxHp;
          for (let i = 0; i < 60 && !crow.dead; i++) { crow.x = player.x + 30; crow.y = player.y; crow.attackCd = 1; player.hp = player.maxHp; player.facing = { x: 1, y: 0 }; pressed.add('Space'); F.step([]); F.sim(40, []); }
          res.killed = crow.dead; res.xp = player.skills.melee.xp - xp0; res.kills = (player.kills | 0) - k0;
        } finally {
          for (const [m, x, y, hp, st, an, dd] of keep) { m.x = x; m.y = y; m.hp = hp; m.state = st; m.angry = an; if (!dd && m.dead) { m.dead = false; m.respawnT = 0; } }
          const sk = JSON.parse(sk0); for (const k in sk) player.skills[k] = sk[k];
          drops = drops.filter(d => dist(d.x, d.y, crow.home.x, crow.home.y) > DEFS.crow.sight * 2);
          player.x = px0; player.y = py0; player.hp = hp0; window.__peace = peace0;
        }
      }
      check(P + 'a wild dog wakes at 3.5 tiles but not at 5, idles within 2 tiles of home (and a packmate\'s push), a crow lets a knight stand beside it, and the blows that fell it pay at least its 32 melee xp',
        !!dog && !!crow && res.at5 !== 'chase' && res.at35 === 'chase' && res.far <= 2.6 && res.calm && res.killed && res.kills === 1 && res.xp >= DEFS.crow.hp * 4, res);
    }
  });
}
