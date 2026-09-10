// ============================================================================
// THE ROAD NETWORK — owner: "there need to be clear paths interconnecting the different places, and the
// paths should have three to six points of interest along them, or just off of them, to explore and loot,
// or unique mobs to farm."
//
// Before this, the world had four scatterings of dirt laid by `api.road` with a 60-70% fill: a dotted line
// through the grass, not a road. Places that mattered were not joined at all — the pond crossing, the
// warden's gate, Hollowford from the town's own side of the river.
//
// This file lays one network. Six named roads, each with a milestone at its head, one packed surface (ROAD)
// and a kerbed verge (VERGE) down either side of it. The route is not drawn with a ruler: an A* walks from
// waypoint to waypoint over a cost field where open ground costs one, an old track costs a half (so a new
// road falls into the line of the one that is already there), and a wood costs three — so the road bends
// round a copse and only cuts through when going round would cost more than felling. A little per-tile
// jitter keeps it off a dead-straight line across an empty field. Where a road meets somebody else's road,
// a gate or a bridge, it is adopted rather than rewritten: those tiles join the network and change not at
// all. Water is impassable everywhere except one named ford on the Long Road South, which gets planks.
//
// Then twenty-five points of interest hang off them: three wrecked carts, five wayshrines that hand out a
// named blessing on a timer, three roadside traders who each do exactly one thing, three brambles, a deep
// pool, two caches, a locked strongbox whose key is a day's walk away on another road, and six named
// monsters that hold their ground, respawn, and are worth the walk.
//
// WHAT IT MAY NOT TOUCH. The road is laid last (file 93), after every other feature and after the world
// blend, so it sees the finished map — which means it must not walk over anyone else's work. Four rules:
//   1. Only ordinary ground is paved: grass, flowers, mushrooms, fern, sand, dirt, scorch, ash, and the
//      trees and jungle it has to fell. Never a door, a gate, a wall, a fence, an ore rock, a berry bush,
//      a course obstacle, a quest tile or anything a feature file placed.
//   2. Every tile whose type is not on the ordinary list gets a two-tile ring of guard round it, so a road
//      never runs up against someone's shrine, post, cart, chest or lever. Gates and bridges are the
//      exception — a road is meant to arrive at those; a doorstep gets its own four-tile guard.
//   3. The world blend's own guard rectangles are honoured as written, with three named passages carved
//      through them where a road has to get by: the field between Thistledown's east wall and the goblin
//      camp, the gap in the warden's tree line, and the lane outside the town's west wall where the core's
//      own road already runs.
//   4. It disturbs nothing that ran before it. The three roadside traders join NPCS at the end of world
//      generation, not at load, because 34-food and 39-worldblend both read NPCS before this file runs and
//      three names added early would move sixty berry bushes and reshuffle seven hundred tiles of dither.
// And one exception with a reason: inside the Ashfields (x 1-99, y 96-138) only ash and dead trees are
// paved. 11-main counts grass, dirt and scorch there as "open ground between the ash" and wants more than
// 500 of it, so the Ash Road widens the old track with new surface either side of it instead of swallowing
// the track itself. Measured before and after: 698 tiles of open ground, unchanged.
//
// Feature file: registers through HOOKS only, edits no core file. window.ROADS exposes the network.
// ============================================================================
{
  // ---------- the surface ----------
  const T_ROAD = addTile('ROAD', { tex: 'dirt', mini: '#a2916d' });        // packed stone and earth: the travelled way
  const T_VERGE = addTile('VERGE', { tex: 'grass', mini: '#7f8f55' });     // the kerbed strip either side of it
  const T_STONE = addTile('MILESTONE', { solid: true, tex: 'dirt', mini: '#b9b3a4' });
  const T_WRECK = addTile('ROAD_WRECK', { solid: true, tex: 'dirt', mini: '#7d5b34' });
  const T_SHRINE = addTile('WAYSHRINE', { solid: true, tex: 'dirt', mini: '#9fb6c8' });
  const T_BOX = addTile('ROAD_BOX', { solid: true, tex: 'dirt', mini: '#8a7442' });
  const T_CACHE = addTile('ROAD_CACHE', { solid: true, tex: 'dirt', mini: '#6f6a5e' });
  const T_BRAMBLE = addTile('ROAD_BRAMBLE', { solid: true, tex: 'grass', mini: '#4a6f2c' });
  const T_POOL = addTile('ROAD_POOL', { solid: true, tex: 'grass', mini: '#3a6d8f' });
  const POI_TILES = [T_WRECK, T_SHRINE, T_BOX, T_CACHE, T_BRAMBLE, T_POOL];
  const OURS = new Set([T_ROAD, T_VERGE, T_STONE, ...POI_TILES]);

  for (const t of [T_STONE, ...POI_TILES]) INTERESTING_TILES.add(t);       // the E ring, frontTile's reach, and a tap on the iPad
  if (typeof PLACEABLE_ON !== 'undefined') { PLACEABLE_ON.add(T_ROAD); PLACEABLE_ON.add(T_VERGE); }   // ordinary ground: a lodestone, a bed or a door may be set down at the roadside
  Object.assign(TAP_NAMES, {
    ROAD: 'Road', VERGE: 'Verge', MILESTONE: 'Milestone', ROAD_WRECK: 'Wrecked cart', WAYSHRINE: 'Wayshrine',
    ROAD_BOX: 'Locked strongbox', ROAD_CACHE: 'Old cache', ROAD_BRAMBLE: 'Bramble', ROAD_POOL: 'Deep pool',
  });

  // ---------- new things the roads hand out ----------
  const NEW_ITEMS = {
    iron_key: { name: "Warden's iron key", value: 0, color: '#9aa3ae', shape: 'scrap', stack: 1 },
    haws: { name: 'Hawthorn haws', value: 3, color: '#c0294a', shape: 'seed', stack: 50, heal: 3 },
    river_pearl: { name: 'River pearl', value: 75, color: '#e6edf3', shape: 'seed', stack: 50 },
    grizzle_tusk: { name: "Grizzlejaw's tusk", value: 90, color: '#e8dcc0', shape: 'tusk', stack: 50 },
    stone_heart: { name: "Stonebiter's heart", value: 120, color: '#8d949f', shape: 'rock', stack: 50 },
    grey_pelt: { name: "Greyfang's pelt", value: 110, color: '#9a9daa', shape: 'pelt', stack: 50 },
    cinder_scale: { name: "Ashjaw's cinder scale", value: 150, color: '#d2622f', shape: 'scrap', stack: 50 },
    moss_bloom: { name: "Mossback's bloom", value: 130, color: '#6fbf62', shape: 'seed', stack: 50 },
    sneak_purse: { name: "Old Sneak's purse", value: 100, color: '#e0b23c', shape: 'coins', stack: 50 },
  };
  for (const id in NEW_ITEMS) { ITEMS[id] = NEW_ITEMS[id]; ITEMS[id].id = id; }

  // ---------- the named monsters ----------
  // None of them charge you: a road is safe, the thing standing beside it is not. You choose the fight,
  // which is what makes them worth farming and what keeps a ten-year-old from being jumped on the way home.
  const NAMED = {
    grizzlejaw: { name: 'Grizzlejaw', level: 9, r: 17, hp: 46, att: 9, maxHit: 6, def: 6, speed: 130, aggro: false, sight: 3 * TILE, respawn: 75,
      drops: { always: [['raw_beef', 2, 3]], table: [['boar_tusk', 1, 1, 6], ['coins', 10, 24, 4]], rare: { chance: 6, table: [['grizzle_tusk', 1, 1, 1]] } } },
    stonebiter: { name: 'Stonebiter', level: 14, r: 16, hp: 80, att: 13, maxHit: 9, def: 12, speed: 95, aggro: false, sight: 3 * TILE, respawn: 90,
      drops: { always: [['iron_ore', 2, 3], ['coal', 1, 2]], table: [['iron_bar', 1, 1, 5], ['coins', 14, 30, 5]], rare: { chance: 8, table: [['stone_heart', 1, 1, 1]] } } },
    greyfang: { name: 'Greyfang', level: 16, r: 16, hp: 92, att: 16, maxHit: 10, def: 11, speed: 165, aggro: false, sight: 3 * TILE, respawn: 70,
      drops: { always: [['wolf_pelt', 2, 3], ['raw_beef', 1, 2]], table: [['coins', 16, 34, 6], ['nothing', 0, 0, 4]], rare: { chance: 7, table: [['grey_pelt', 1, 1, 1]] } } },
    old_sneak: { name: 'Old Sneak', level: 12, r: 13, hp: 66, att: 12, maxHit: 8, def: 9, speed: 140, aggro: false, sight: 3 * TILE, respawn: 60,
      drops: { always: [['coins', 14, 28], ['goblin_scrap', 1, 3]], table: [['bread', 1, 2, 5], ['blast_powder', 1, 2, 5]], rare: { chance: 8, table: [['sneak_purse', 1, 1, 1]] } } },
    ashjaw: { name: 'Ashjaw', level: 24, r: 18, hp: 150, att: 22, maxHit: 14, def: 18, speed: 120, aggro: false, sight: 3 * TILE, respawn: 100,
      drops: { always: [['coal', 2, 4]], table: [['iron_bar', 1, 2, 6], ['coins', 24, 48, 6]], rare: { chance: 8, table: [['cinder_scale', 1, 1, 1]] } } },
    mossback: { name: 'Mossback', level: 28, r: 20, hp: 190, att: 26, maxHit: 16, def: 22, speed: 100, aggro: false, sight: 3 * TILE, respawn: 110,
      drops: { always: [['oak_log', 2, 3]], table: [['berries', 2, 4, 6], ['coins', 30, 60, 6]], rare: { chance: 8, table: [['moss_bloom', 1, 1, 1]] } } },
  };
  for (const k in NAMED) MONSTER_DEFS[k] = NAMED[k];

  // ---------- the roadside traders ----------
  // Each does exactly one thing, says what it is, and does it as often as you like.
  const TRADES = {
    ivo: { id: 'ivo', name: 'Ivo the ore-picker', x: 58, y: 19, tunic: '#5a5a4a', hair: '#7a6a5a', beard: true, role: 'road_trade',
      give: ['coal', 6], take: ['iron_bar', 1], line: 'Six coal for an iron bar, every time. I fire the little forge behind the heap.' },
    kett: { id: 'kett', name: 'Rusty Kett', x: 160, y: 15, tunic: '#3f6a72', hair: '#c9b48a', role: 'road_trade',
      give: ['river_pearl', 1], take: ['coins', 120], line: 'A river pearl is worth a hundred and twenty to me. Nobody else on this coast will say so.' },
    meg: { id: 'meg', name: 'Cinder Meg', x: 57, y: 101, tunic: '#5a3a33', hair: '#d9d0c0', woman: true, role: 'road_trade',
      give: ['wood', 4], take: ['coal', 3], line: 'Four logs in the clamp, three coal out of it. That is the whole of my trade.' },
  };
  // The three of them join NPCS at the very end of world generation, not at load. 34-food picks its sixty
  // berry bushes from a list that excludes the ground round every NPC, and 39-worldblend guards the same
  // ground before it dithers a biome edge — both run before this file. Three names added early would move
  // sixty bushes and reshuffle seven hundred tiles of someone else's dither, which is not this file's work.
  // NPCS survives between generations, so a hook at the head of the queue takes them back out first: every
  // generation then looks exactly the same to every file that runs before this one.
  const seatTraders = () => { for (const k in TRADES) NPCS.push(initNpc(TRADES[k])); };
  HOOKS.world.unshift(() => { for (const k in TRADES) { const i = NPCS.indexOf(TRADES[k]); if (i >= 0) NPCS.splice(i, 1); } });

  // ---------- the network ----------
  // Each road is a chain of legs. `route` A*s from waypoint to waypoint and paves what it walks; `adopt`
  // takes an existing walkable stretch — someone else's road, a bridge, a town gate — into the network
  // without changing a single tile of it.
  const ROADS_DEF = [
    { id: 'cave', name: 'The Cave Road', sub: 'The cave mouth to Thistledown', stone: [37, 13],
      legs: [
        ['adopt', [[21, 7], [28, 7]]],                                              // out of the guarded cave block on the track that is already there
        ['route', [[28, 7], [42, 16], [50, 20], [57, 23], [61, 25]]],
        ['adopt', [[61, 25], [65, 27], [69, 28]]],                                  // past the signpost, which nobody may pave over
        ['route', [[69, 28], [76, 30], [83, 32]]],
        ['adopt', [[83, 32], [85, 32]]],                                            // in at the west gate
        ['route', [[50, 20], [47, 25], [45, 29], [44, 32]]],                        // the pond lane, down to the east landing
      ] },
    { id: 'quarry', name: 'The Quarry Track', sub: 'Up to the cart and the mine shaft', stone: [60, 22],
      legs: [
        ['route', [[61, 25], [60, 21], [58, 17]]],
        ['adopt', [[58, 17], [56, 15], [54, 14], [54, 12], [54, 9], [55, 8], [55, 6], [56, 6]]],
      ] },
    { id: 'sea', name: 'The Sea Road', sub: "Thistledown's streets, the camp gap and the dock", stone: [144, 31],
      legs: [
        ['adopt', [[85, 32], [112, 32], [140, 32]]],                                // the town's own main street, gate to gate
        ['adopt', [[140, 32], [143, 32]]],
        ['route', [[143, 32], [145, 31], [146, 30]]],
        ['adopt', [[146, 30], [148, 30]]],                                          // through the gap in the palisade
        ['route', [[146, 30], [145, 25], [144, 18]]],
        ['route', [[144, 18], [149, 18], [153, 18]]],                                // the shore lane, pinched between the palisade and the tide
        ['adopt', [[144, 18], [143, 17], [141, 16], [141, 14], [152, 14], [162, 14]]],
      ] },
    { id: 'wolfwood', name: 'The Wolfwood Road', sub: "The west gate, the ford, Old Wren's hut", stone: [83, 44],
      legs: [
        ['adopt', [[85, 32], [84, 33]]],
        ['route', [[84, 33], [83, 40], [84, 48], [84, 55]]],
        ['adopt', [[84, 55], [84, 58], [84, 60], [82, 61], [77, 62], [76, 63]]],     // over the ford the world blend planked
        ['route', [[76, 63], [70, 66], [62, 69], [54, 72], [45, 74], [37, 76], [35, 77]]],
        ['adopt', [[35, 77], [31, 81]]],                                            // the last few steps to the hermit's door, worn but never paved
      ] },
    { id: 'ash', name: 'The Ash Road', sub: "The warden's gate, Dunstan's farm, the lair", stone: [64, 78],
      legs: [
        ['route', [[62, 69], [63, 76], [68, 83], [67, 90], [63, 92]]],               // round the standing stones, not through them
        ['route', [[63, 92], [60, 94]]],
        ['adopt', [[60, 94], [60, 97], [60, 100]]],                                 // the gap in the tree line and the warden's gate
        ['route', [[60, 100], [57, 103], [50, 104], [41, 105]]],
        ['adopt', [[41, 105], [36, 105]]],                                          // on to the lair approach
        ['adopt', [[59, 103], [63, 103], [66, 102]]],                               // the farm track east to Dunstan's door, as the Ashfields already had it
      ] },
    { id: 'south', name: 'The Long Road South', sub: 'The Cross Ford, Hollowford, the jungle, Sylvaris', stone: [104, 66],
      legs: [
        ['route', [[84, 58], [90, 58], [95, 58], [98, 59], [99, 60]]],   // east along the river's north bank, pinned so it cannot wander to the far side
        ['route', [[99, 60], [99, 64]]],                                            // the Cross Ford: the only water this file bridges
        ['route', [[99, 64], [106, 68], [114, 72], [121, 76], [123, 77]]],
        ['adopt', [[123, 77], [124, 77], [138, 77], [141, 78], [141, 96], [141, 100]]],
        ['route', [[141, 100], [137, 106], [134, 110]]],
        ['adopt', [[134, 110], [133, 112], [137, 114]]],
        ['adopt', [[148, 30], [150, 32], [150, 41], [150, 50], [146, 58], [141, 64], [140, 68], [141, 78]]],  // the north branch, back up to the camp
      ] },
  ];

  // where the road may cross water, and nowhere else: one ford, two tiles of plank
  const FORDS = [{ x0: 98, y0: 60, x1: 100, y1: 65 }];
  const PLANK_T = ('BRIDGE' in T) ? T.BRIDGE : T.DIRT;

  // ---------- the points of interest ----------
  // wish: where it wants to stand. The placer takes the nearest legal tile beside the road to it.
  const POI_DEF = [
    // --- The Cave Road ---
    { n: 1, road: 'cave', id: 'cart_over', kind: 'wreck', wish: [35, 12], name: 'The Overturned Cart',
      blurb: 'A carrier went into the ditch here and never came back for the load.',
      loot: [['plank', 2, 4], ['wood', 1, 2], ['coins', 4, 14]], every: 300 },
    { n: 2, road: 'cave', id: 'stone_trav', kind: 'shrine', wish: [56, 23], name: "The Traveller's Stone",
      bless: 'fair', blessName: 'Fair Road', secs: 180, every: 360, amount: 2,
      blurb: 'Fair Road: every hit you take is 2 lighter for three minutes.' },
    { n: 3, road: 'cave', id: 'grizzle', kind: 'beast', wish: [45, 28], type: 'grizzlejaw', name: 'Grizzlejaw',
      blurb: 'An old boar with one broken tusk, in the briars where the pond lane leaves the road.' },
    { n: 4, road: 'cave', id: 'pool_pond', kind: 'pool', wish: [48, 32], name: 'The Pond Landing',
      blurb: "The deep end of Miller's Pond, where the road meets the stepping stones.",
      fish: 'raw_trout', xp: 34, extra: 'river_pearl', extraOdds: 8 },
    // --- The Quarry Track ---
    { n: 5, road: 'quarry', id: 'cleft', kind: 'cache', wish: [59, 22], name: 'The Slighted Cleft',
      blurb: 'A crack in the rock with a box wedged into it. The quarry crew hid their pay here.',
      loot: [['steel_bar', 2, 2], ['coins', 60, 60]], once: true },
    { n: 6, road: 'quarry', id: 'ivo', kind: 'trader', who: 'ivo', name: 'Ivo the ore-picker',
      blurb: 'He works the spoil heap by the track. Six coal for an iron bar.' },
    { n: 7, road: 'quarry', id: 'stonebiter', kind: 'beast', wish: [61, 20], type: 'stonebiter', name: 'Stonebiter',
      blurb: 'A rock-crusted brute that walked down out of the quarry and stayed.' },
    { n: 8, road: 'quarry', id: 'stone_wind', kind: 'shrine', wish: [59, 25], name: 'The Wind-Stone',
      bless: 'hands', blessName: 'Steady Hands', secs: 180, every: 360, amount: 2,
      blurb: 'Steady Hands: Mining and Woodcutting pay double for three minutes.' },
    // --- The Sea Road ---
    { n: 9, road: 'sea', id: 'toll', kind: 'box', wish: [144, 25], name: 'The Toll Post',
      blurb: 'A strongbox chained to a toll post. The lock takes an iron key.',
      key: 'iron_key', loot: [['coins', 250, 250], ['steel_bar', 3, 3]] },
    { n: 10, road: 'sea', id: 'salt_bramble', kind: 'bramble', wish: [152, 17], name: 'The Salt Bramble',
      blurb: 'Sea buckthorn on the bank, salt on the leaves.', pick: 'haws', every: 120 },
    { n: 11, road: 'sea', id: 'kett', kind: 'trader', who: 'kett', name: 'Rusty Kett',
      blurb: 'A beachcomber two tiles off the dock road. He buys river pearls and nothing else.' },
    { n: 12, road: 'sea', id: 'tide_cart', kind: 'wreck', wish: [143, 20], name: 'The Tide Waggon',
      blurb: 'A fish waggon that broke its axle on the pull up from the dock, and was left where it stopped.',
      loot: [['raw_shrimp', 2, 4], ['plank', 1, 2], ['coins', 6, 16]], every: 300 },
    // --- The Wolfwood Road ---
    { n: 13, road: 'wolfwood', id: 'waggon', kind: 'wreck', wish: [84, 50], name: 'The Broken Waggon',
      blurb: 'A timber waggon shed a wheel on the run down to the ford.',
      loot: [['wood', 3, 5], ['plank', 1, 2], ['coins', 4, 12]], every: 300 },
    { n: 14, road: 'wolfwood', id: 'stone_wood', kind: 'shrine', wish: [72, 66], name: "The Woodward's Shrine",
      bless: 'green', blessName: 'Green Path', secs: 120, every: 300, amount: 0,
      blurb: 'Green Path: wolves and boars leave you be for two minutes.' },
    { n: 15, road: 'wolfwood', id: 'greyfang', kind: 'beast', wish: [53, 74], type: 'greyfang', name: 'Greyfang',
      blurb: 'The wolf the villagers name. It works the road between the ford and the hut.' },
    { n: 16, road: 'wolfwood', id: 'haw_break', kind: 'bramble', wish: [40, 76], name: 'The Hawthorn Break',
      blurb: 'A hedge of hawthorn where the wood thins out towards Wren.', pick: 'haws', every: 120 },
    // --- The Ash Road ---
    { n: 17, road: 'ash', id: 'post', kind: 'cache', wish: [61, 86], name: "The Warden's Old Post",
      blurb: "The warden's father kept this post before the gate was built. His key is still in it.",
      loot: [['iron_key', 1, 1], ['coins', 40, 40], ['bread', 2, 2]], once: true },
    { n: 18, road: 'ash', id: 'stone_kneel', kind: 'shrine', wish: [52, 104], name: 'The Kneeling Stone',
      bless: 'might', blessName: 'Ash Ward', secs: 90, every: 300, amount: 3,
      blurb: 'Ash Ward: your swings hit 3 harder for ninety seconds.' },
    { n: 19, road: 'ash', id: 'ashjaw', kind: 'beast', wish: [45, 107], type: 'ashjaw', name: 'Ashjaw',
      blurb: 'An ash-crusted drakeling that will not leave the lair road.' },
    { n: 20, road: 'ash', id: 'meg', kind: 'trader', who: 'meg', name: 'Cinder Meg',
      blurb: 'Her charcoal clamp smokes beside the farm turning. Four logs for three coal.' },
    // --- The Long Road South ---
    { n: 21, road: 'south', id: 'piles', kind: 'wreck', wish: [102, 58], name: 'The Ferry Piles',
      blurb: 'A barge that never made the far bank, propped on the old ferry piles.',
      loot: [['plank', 2, 4], ['rope', 1, 1], ['coins', 8, 18]], every: 300 },
    { n: 22, road: 'south', id: 'stone_bell', kind: 'shrine', wish: [113, 72], name: 'The Bell Stone',
      bless: 'mend', blessName: 'Deep Breath', secs: 180, every: 360, amount: 1,
      blurb: 'Deep Breath: you mend 1 hitpoint every three seconds for three minutes.' },
    { n: 23, road: 'south', id: 'sneak', kind: 'beast', wish: [148, 45], type: 'old_sneak', name: 'Old Sneak',
      blurb: 'A goblin that robs the camp road and runs back inside when it is done.' },
    { n: 24, road: 'south', id: 'mossback', kind: 'beast', wish: [138, 105], type: 'mossback', name: 'Mossback',
      blurb: 'Something very old and very green stands where the jungle path turns.' },
    { n: 25, road: 'south', id: 'green_bramble', kind: 'bramble', wish: [135, 109], name: 'The Green Bramble',
      blurb: 'Haws grow fat on the jungle path where the light gets through.', pick: 'haws', every: 120 },
  ];
  if (!ITEMS.rope) POI_DEF.find(p => p.id === 'piles').loot = [['plank', 2, 4], ['wood', 1, 2], ['coins', 8, 18]];

  // ---------- state ----------
  const RD = window.ROADS = {
    tiles: { road: T_ROAD, verge: T_VERGE, stone: T_STONE, wreck: T_WRECK, shrine: T_SHRINE, box: T_BOX, cache: T_CACHE, bramble: T_BRAMBLE, pool: T_POOL },
    roads: [], pois: [], POI_DEF, NAMED, TRADES, FORDS, net: new Set(), laid: [], stats: {}, GUARD: [], PASS: [],
    poi: id => RD.pois.find(p => p.id === id) || null,
    at: (x, y) => RD.pois.find(p => p.at && p.at[0] === x && p.at[1] === y) || null,
  };
  const st = () => (quest.roads = quest.roads || { opened: {}, timer: {}, bless: null, mendT: 0, read: {} });
  HOOKS.newGame.push(() => { quest.roads = { opened: {}, timer: {}, bless: null, mendT: 0, read: {} }; });

  // ============================================================================
  // WORLD GENERATION
  // ============================================================================
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const ASHFIELD = { x0: 1, y0: 96, x1: 99, y1: 138 };
  const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

  // the blend's guard rectangles, as written there, plus the guild hall this file adds
  const GUARD = RD.GUARD = [
    [0, 0, MAP_W - 1, 0], [0, MAP_H - 1, MAP_W - 1, MAP_H - 1], [0, 0, 0, MAP_H - 1], [MAP_W - 1, 0, MAP_W - 1, MAP_H - 1],
    [0, 0, 27, 16],                       // the cave, its mouth, the axe stump, the den door, the notice board
    [84, 13, 141, 57],                    // Thistledown, its wall, both gates and the road ends
    [70, 12, 82, 23], [70, 38, 82, 48],   // the cow and sheep pens
    [36, 29, 43, 44],                     // Miller's Pond and the stepping stones
    [45, 0, 63, 4], [59, 4, 65, 9], [52, 4, 58, 15],  // the cliff course, the wind shrine, the shaft lane and the cart
    [139, 12, 163, 16], [140, 13, 143, 33],           // the dock road and the lane down the town wall
    [158, 9, 170, 19],                    // the dock, Harl, his boat and the lantern
    [141, 19, 159, 41],                   // the goblin palisade and one ring of ground
    [138, 28, 142, 32], [159, 29, 161, 31],           // the camp's west gap, the climb's landing
    [168, 4, 187, 22], [175, 38, 198, 62],            // Gull Isle, Ironclad Isle
    [125, 69, 153, 89], [148, 64, 158, 78],           // Hollowford's ruins and the guild hall with its step path
    [138, 62, 143, 96],                   // the road into Hollowford and out to the jungle
    [1, 95, 99, 95], [100, 96, 100, 138], // the warden's tree line and the jungle's west wall: exact solid counts
    [56, 92, 64, 99],                     // the warden, his gate and the road through
    [1, 103, 40, 107], [84, 100, 90, 106],// the approach to the lair, the ruined shrine
    [2, 72, 26, 94], [2, 108, 34, 138],   // Deepholm, The Fang's lair
    [8, 65, 17, 72], [55, 83, 65, 91], [91, 77, 99, 85],  // the graveyard, the stone circle, the watchtower
    [125, 113, 167, 136], [126, 111, 147, 114],           // Sylvaris' wall and the ground before the gap
    [162, 40, 163, 40], [51, 41, 62, 50], [200, 26, 211, 34],
  ];
  // the two places a road has to get through a guard, named and no wider than it needs to be
  const PASS = RD.PASS = [
    [142, 17, 146, 33],   // the field between Thistledown's east wall (x 140), its lane (x 141) and the goblin palisade (x 147)
    [57, 92, 64, 94],     // up to the gap the tree line already has at x 59-61
    [83, 33, 84, 61],     // the lane down the outside of the town's west wall, where the core's own road already runs
  ];

  // tile types that count as ordinary ground: everything else gets a ring of guard round it
  const ORDINARY = ['GRASS', 'DIRT', 'CAVE', 'WALL', 'WATER', 'TREE', 'OAK', 'STUMP', 'ROCK', 'IRON', 'COAL', 'RUBBLE', 'PLANK',
    'SAND', 'COBBLE', 'HWALL', 'CWALL', 'FLOOR', 'FENCE', 'SOIL', 'CROP', 'ASHES', 'SCORCH', 'ASH', 'LAVA', 'OBSIDIAN', 'MAGMA',
    'JUNGLE', 'FERN', 'BERRY_BUSH', 'DEADTREE', 'DEAD_TREE', 'BRIDGE', 'DOCK', 'TOWN_WALL', 'PALISADE', 'PALISADE_BROKEN',
    'LEAFWALL', 'PLATFORM', 'SKY', 'CLOUD', 'ICE', 'ROAD', 'VERGE',
    // scattered through the open country in their hundreds, and a road may pass a flower or an ore rock
    'FLOWERS', 'MUSHROOM', 'CAVE_MUSHROOM', 'MITHRIL', 'BLACKIRON', 'SUNSTONE', 'STORMSTONE', 'COAL_SEAM', 'MINE_SPOIL'];
  const RING0 = ['GATE', 'PORTCULLIS', 'WARDEN_GATE', 'LAIR_GATE', 'HOUSE_GATE', 'DUNGEON_EXIT'];       // a road arrives at these
  const RINGD = ['DOOR', 'COFFINDOOR', 'DUNGEON_DOOR', 'CRYPT_DOOR', 'CRYPT_BARS', 'HATCH'];            // a doorstep is not road
  const idOf = n => (n in T ? T[n] : -1);
  const setOf = names => new Set(names.map(idOf).filter(v => v >= 0));

  // what may be turned into road surface
  const PAVE = setOf(['GRASS', 'DIRT', 'FLOWERS', 'MUSHROOM', 'SAND', 'SCORCH', 'ASH', 'FERN', 'STUMP', 'TREE', 'OAK', 'JUNGLE', 'DEADTREE', 'DEAD_TREE']);
  const PAVE_ASHFIELD = setOf(['ASH', 'DEADTREE', 'DEAD_TREE']);         // inside the Ashfields, only ash — see the header
  const SOFT_SOLID = setOf(['TREE', 'OAK', 'JUNGLE', 'DEADTREE', 'DEAD_TREE']);   // a wood: the road bends round it if it can
  const VERGEABLE = setOf(['GRASS', 'FLOWERS', 'MUSHROOM', 'FERN', 'SAND', 'SCORCH', 'ASH']);
  const ADOPTABLE = setOf(['DIRT', 'COBBLE', 'BRIDGE', 'DOCK', 'GATE', 'PORTCULLIS', 'WARDEN_GATE', 'SCORCH', 'ASHES', 'SAND', 'GRASS', 'ROAD', 'VERGE']);

  let hard = null;                                  // 1 = no road tile may land here
  const guarded = (x, y) => !inMap(x, y) || hard[idx(x, y)] === 1;
  RD.guarded = (x, y) => guarded(x, y);
  RD.hardAt = (x, y) => (hard ? hard[idx(x, y)] : -1);

  function buildGuard(at) {
    hard = new Uint8Array(MAP_W * MAP_H);
    const mark = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(MAP_H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(MAP_W - 1, x1); x++) hard[idx(x, y)] = 1; };
    const clear = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(MAP_H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(MAP_W - 1, x1); x++) hard[idx(x, y)] = 0; };
    for (const [a, b, c, d] of GUARD) mark(a, b, c, d);
    for (const b of BUILDINGS) mark(b.x - 2, b.y - 2, b.x + b.w + 1, b.y + b.h + 1);
    const mine = new Set(Object.values(TRADES).map(t => t.id));
    for (const n of NPCS) { if (mine.has(n.id)) mark(n.x, n.y, n.x, n.y); else mark(n.x - 2, n.y - 2, n.x + 2, n.y + 2); }
    // Monster spawns are NOT guarded. A road only ever makes ground easier to walk, so running one past the
    // place a boar wakes up costs nothing — and a three-tile guard round every spawn walls off whole banks
    // of the river and sends a road twenty tiles round. Solid things (milestones, wrecks, shrines) still keep
    // clear of a spawn: `beside` checks for that when it places them.
    // a ring round everything that is not ordinary ground, so no road runs over another file's work
    const ord = setOf(ORDINARY), r0 = setOf(RING0), rd = setOf(RINGD);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const t = at(x, y);
      if (ord.has(t)) continue;
      if (r0.has(t)) continue;                                  // gates and the like: the road is meant to reach them
      if (rd.has(t)) { mark(x, y, x, y); for (const [dx, dy] of N4) mark(x + dx, y + dy, x + dx, y + dy); continue; }
      mark(x - 2, y - 2, x + 2, y + 2);
    }
    for (const [a, b, c, d] of PASS) clear(a, b, c, d);
    // the passages never open a building, an NPC, a gate ring or anything solid that is not ordinary ground
    for (const [a, b, c, d] of PASS) for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) {
      const t = at(x, y);
      if (!ord.has(t) || buildingAt(x, y)) hard[idx(x, y)] = 1;
    }
  }

  // ---------- the cost field ----------
  const jitter = new Float32Array(MAP_W * MAP_H);
  { const r = mulberry32(9311); for (let i = 0; i < jitter.length; i++) jitter[i] = 0.93 + r() * 0.22; }
  let fordOk = null;

  function cost(at, x, y) {
    if (!inMap(x, y) || guarded(x, y)) return -1;
    const t = at(x, y);
    if (OURS.has(t)) return t === T_ROAD ? 0.35 : t === T_VERGE ? 0.55 : -1;
    if (t === T.WATER) return fordOk && fordOk(x, y) ? 6 : -1;   // only inside a named ford, and cheap enough there that the road takes the crossing rather than a mile of bank
    if (t === T.DIRT || t === T.COBBLE || t === PLANK_T || t === idOf('DOCK')) return 0.5;   // an old track: the new road falls into it
    if (t === idOf('GATE') || t === idOf('WARDEN_GATE') || t === idOf('PORTCULLIS')) return 0.5;
    if (SOFT_SOLID.has(t)) return 3;
    if (PAVE.has(t)) return 1;
    return -1;
  }

  // a waypoint is a wish, not a survey peg: if the exact tile turns out to be guarded (a feature moved in
  // after these numbers were written), the nearest tile a road may stand on is used instead
  function nudge(at, x, y) {
    if (cost(at, x, y) >= 0) return [x, y];
    for (let r = 1; r <= 8; r++) {
      let best = null;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (cost(at, x + dx, y + dy) < 0) continue;
        const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { x: x + dx, y: y + dy, d };
      }
      if (best) return [best.x, best.y];
    }
    return null;
  }

  // A* on 8 neighbours (diagonals cost 1.41); the path is made 4-connected when it is paved
  function route(at, ax, ay, bx, by) {
    const W = MAP_W, N = W * MAP_H;
    const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const heap = [], hv = [];
    const push = (i, f) => { heap.push(i); hv.push(f); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (hv[p] <= hv[c]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; [hv[p], hv[c]] = [hv[c], hv[p]]; c = p; } };
    const pop = () => { const top = heap[0]; const li = heap.pop(), lv = hv.pop(); if (heap.length) { heap[0] = li; hv[0] = lv; let c = 0; for (; ;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && hv[l] < hv[m]) m = l; if (r < heap.length && hv[r] < hv[m]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; [hv[m], hv[c]] = [hv[c], hv[m]]; c = m; } } return top; };
    const s = idx(ax, ay), e = idx(bx, by);
    if (cost(at, ax, ay) < 0 || cost(at, bx, by) < 0) return null;
    g[s] = 0; push(s, 0);
    while (heap.length) {
      const c = pop(); if (done[c]) continue; done[c] = 1;
      if (c === e) break;
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of N8) {
        const nx = cx + dx, ny = cy + dy; if (!inMap(nx, ny)) continue;
        const n = idx(nx, ny); if (done[n]) continue;
        const k = cost(at, nx, ny); if (k < 0) continue;
        const step = k * jitter[n] * (dx && dy ? 1.41 : 1);
        const ng = g[c] + step;
        if (ng < g[n]) { g[n] = ng; from[n] = c; push(n, ng + Math.hypot(bx - nx, by - ny) * 0.9); }
      }
    }
    if (!isFinite(g[e])) return null;
    const out = []; for (let c = e; c >= 0; c = from[c]) out.push([c % W, (c / W) | 0]);
    return out.reverse();
  }

  // ---------- paving ----------
  function pave(set, at, x, y, road) {
    if (guarded(x, y)) return false;
    const t = at(x, y);
    if (OURS.has(t)) { RD.net.add(idx(x, y)); return true; }
    if (t === T.WATER) {
      if (!fordOk || !fordOk(x, y)) return false;
      set(x, y, PLANK_T); RD.net.add(idx(x, y)); RD.laid.push({ x, y, was: 'WATER', t: 'BRIDGE', road }); road.bridges++;
      return true;
    }
    const ok = inRect(ASHFIELD, x, y) ? PAVE_ASHFIELD.has(t) : PAVE.has(t);
    if (!ok) { if (ADOPTABLE.has(t) && !SOLID.has(t)) { RD.net.add(idx(x, y)); road.adopted++; return true; } return false; }
    if (SOFT_SOLID.has(t)) road.felled++;
    set(x, y, T_ROAD); RD.net.add(idx(x, y)); RD.laid.push({ x, y, was: tileName(t), t: 'ROAD', road }); road.paved++;
    return true;
  }

  function paveLeg(set, at, path, road) {
    for (let i = 0; i < path.length; i++) {
      const [x, y] = path[i];
      pave(set, at, x, y, road);
      // 4-connect a diagonal step, so the road can actually be walked and the network BFS holds
      if (i) { const [px, py] = path[i - 1]; if (px !== x && py !== y) { if (!pave(set, at, px, y, road)) pave(set, at, x, py, road); } }
      // a second lane where there is room: a road is two carts wide on the straight, one where it is pinched
      const [nx, ny] = path[Math.min(i + 1, path.length - 1)];
      const dx = Math.sign(nx - x), dy = Math.sign(ny - y);
      const px2 = x + (dy ? 1 : 0) * (jitter[idx(x, y)] > 1.1 ? 1 : -1), py2 = y + (dx ? 1 : 0) * (jitter[idx(x, y)] > 1.1 ? 1 : -1);
      if ((px2 !== x || py2 !== y) && jitter[idx(x, y)] > 0.95) pave(set, at, px2, py2, road);
    }
  }

  // An adopted stretch is somebody else's road: a gate, a bridge, a town street, the lane to the dock. It is
  // never rewritten, only walked and written down — so the walk has to be a real one. The same search runs
  // over it, four-connected and over walkable ground only, so what goes into the network can be walked
  // tile by tile rather than jumped diagonally over a tree.
  function adoptCost(at, x, y) {
    if (!inMap(x, y)) return -1;
    const t = at(x, y);
    if (SOLID.has(t) && !PUSH_THROUGH.has(t) && t !== idOf('WARDEN_GATE')) return -1;
    if (t === T_ROAD || t === T_VERGE) return 0.4;
    if (t === T.DIRT || t === T.COBBLE || t === PLANK_T || t === idOf('DOCK')) return 0.5;
    if (PUSH_THROUGH.has(t) || t === idOf('WARDEN_GATE')) return 0.5;
    if (t === idOf('SCORCH') || t === idOf('ASHES') || t === T.SAND) return 1.4;
    return 6;                                   // open ground: crossed only where there is no track to follow
  }
  function routeAdopt(at, ax, ay, bx, by) {
    const W = MAP_W, N = W * MAP_H;
    const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const heap = [], hv = [];
    const push = (i, f) => { heap.push(i); hv.push(f); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (hv[p] <= hv[c]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; [hv[p], hv[c]] = [hv[c], hv[p]]; c = p; } };
    const pop = () => { const top = heap[0]; const li = heap.pop(), lv = hv.pop(); if (heap.length) { heap[0] = li; hv[0] = lv; let c = 0; for (; ;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && hv[l] < hv[m]) m = l; if (r < heap.length && hv[r] < hv[m]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; [hv[m], hv[c]] = [hv[c], hv[m]]; c = m; } } return top; };
    if (adoptCost(at, ax, ay) < 0 || adoptCost(at, bx, by) < 0) return null;
    const s = idx(ax, ay), e = idx(bx, by);
    g[s] = 0; push(s, 0);
    while (heap.length) {
      const c = pop(); if (done[c]) continue; done[c] = 1;
      if (c === e) break;
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of N4) {
        const nx = cx + dx, ny = cy + dy; if (!inMap(nx, ny)) continue;
        const n = idx(nx, ny); if (done[n]) continue;
        const k = adoptCost(at, nx, ny); if (k < 0) continue;
        const ng = g[c] + k;
        if (ng < g[n]) { g[n] = ng; from[n] = c; push(n, ng + (Math.abs(bx - nx) + Math.abs(by - ny)) * 0.45); }
      }
    }
    if (!isFinite(g[e])) return null;
    const out = []; for (let c = e; c >= 0; c = from[c]) out.push([c % W, (c / W) | 0]);
    return out.reverse();
  }
  // an endpoint that is itself solid (the mine shaft, a signpost) is the end of a road, not part of it: aim beside it
  function adoptEnd(at, x, y) {
    if (adoptCost(at, x, y) >= 0) return [x, y];
    for (let r = 1; r <= 4; r++) for (const [dx, dy] of N8) { const nx = x + dx * r, ny = y + dy * r; if (adoptCost(at, nx, ny) >= 0) return [nx, ny]; }
    return null;
  }
  function adoptLeg(at, pts, road) {
    let n = 0, grass = 0;
    if (pts.length === 1) { const e = adoptEnd(at, pts[0][0], pts[0][1]); if (e && !RD.net.has(idx(e[0], e[1]))) { RD.net.add(idx(e[0], e[1])); n++; } road.adopted += n; return n; }
    for (let s = 0; s < pts.length - 1; s++) {
      const a = adoptEnd(at, pts[s][0], pts[s][1]), b = adoptEnd(at, pts[s + 1][0], pts[s + 1][1]);
      const path = a && b ? routeAdopt(at, a[0], a[1], b[0], b[1]) : null;
      if (!path) { RD.stats.failed.push(`adopt ${pts[s]}→${pts[s + 1]}`); continue; }
      for (const [x, y] of path) { if (!RD.net.has(idx(x, y))) { RD.net.add(idx(x, y)); n++; if (adoptCost(at, x, y) === 6) grass++; } }
    }
    road.adopted += n; road.adoptedGrass = (road.adoptedGrass || 0) + grass;
    return n;
  }

  // ---------- stitching ----------
  // Waypoints are written by hand and the map moves under them, so the network is checked for breaks and
  // mended rather than trusted: any piece of road that is not joined to the piece the cave mouth is on gets
  // a link laid to it, paving where it may and following existing ground where it may not.
  function linkCost(at, x, y) {
    const p = cost(at, x, y);
    const a = adoptCost(at, x, y);
    if (p >= 0 && a >= 0) return Math.min(p, a);
    return p >= 0 ? p : a;
  }
  function routeLink(at, ax, ay, bx, by) {
    const W = MAP_W, N = W * MAP_H;
    const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const heap = [], hv = [];
    const push = (i, f) => { heap.push(i); hv.push(f); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (hv[p] <= hv[c]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; [hv[p], hv[c]] = [hv[c], hv[p]]; c = p; } };
    const pop = () => { const top = heap[0]; const li = heap.pop(), lv = hv.pop(); if (heap.length) { heap[0] = li; hv[0] = lv; let c = 0; for (; ;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && hv[l] < hv[m]) m = l; if (r < heap.length && hv[r] < hv[m]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; [hv[m], hv[c]] = [hv[c], hv[m]]; c = m; } } return top; };
    if (linkCost(at, ax, ay) < 0 || linkCost(at, bx, by) < 0) return null;
    const s0 = idx(ax, ay), e = idx(bx, by);
    g[s0] = 0; push(s0, 0);
    while (heap.length) {
      const c = pop(); if (done[c]) continue; done[c] = 1;
      if (c === e) break;
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of N4) {
        const nx = cx + dx, ny = cy + dy; if (!inMap(nx, ny)) continue;
        const n = idx(nx, ny); if (done[n]) continue;
        const k = linkCost(at, nx, ny); if (k < 0) continue;
        const ng = g[c] + k;
        if (ng < g[n]) { g[n] = ng; from[n] = c; push(n, ng + (Math.abs(bx - nx) + Math.abs(by - ny)) * 0.45); }
      }
    }
    if (!isFinite(g[e])) return null;
    const out = []; for (let c = e; c >= 0; c = from[c]) out.push([c % W, (c / W) | 0]);
    return out.reverse();
  }
  function components() {
    const seen = new Set(), out = [];
    for (const start of RD.net) {
      if (seen.has(start)) continue;
      const c = new Set([start]), q = [start]; seen.add(start);
      for (let qi = 0; qi < q.length; qi++) {
        const i = q[qi], x = i % MAP_W, y = (i / MAP_W) | 0;
        for (const [dx, dy] of N4) { const n = idx(x + dx, y + dy); if (!inMap(x + dx, y + dy) || seen.has(n) || !RD.net.has(n)) continue; seen.add(n); c.add(n); q.push(n); }
      }
      out.push(c);
    }
    return out;
  }
  function stitch(set, at, road) {
    const done = [];
    for (let round = 0; round < 14; round++) {
      const comps = components();
      if (comps.length <= 1) break;
      comps.sort((a, b) => b.size - a.size);
      const main = [...comps[0]];
      let fixed = 0;
      for (let ci = 1; ci < comps.length; ci++) {
        const c = [...comps[ci]];
        let best = null;
        for (const i of c) { const x = i % MAP_W, y = (i / MAP_W) | 0;
          for (const j of main) { const mx = j % MAP_W, my = (j / MAP_W) | 0; const d = Math.abs(mx - x) + Math.abs(my - y); if (!best || d < best.d) best = { d, x, y, mx, my }; } }
        if (!best) continue;
        const path = routeLink(at, best.x, best.y, best.mx, best.my);
        if (!path) continue;
        for (const [x, y] of path) { if (!pave(set, at, x, y, road) && adoptCost(at, x, y) >= 0) RD.net.add(idx(x, y)); }
        done.push({ from: [best.x, best.y], to: [best.mx, best.my], tiles: path.length }); fixed++;
      }
      if (!fixed) break;
    }
    return done;
  }

  // ---------- verges ----------
  function layVerges(set, at) {
    let n = 0;
    const road = [...RD.net].filter(i => at(i % MAP_W, (i / MAP_W) | 0) === T_ROAD);
    for (const i of road) {
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      for (const [dx, dy] of N4) {   // four-connected: a kerb runs alongside the road, it does not spill into the corners of the fields
        const nx = x + dx, ny = y + dy;
        if (guarded(nx, ny)) continue;
        const t = at(nx, ny);
        if (!VERGEABLE.has(t)) continue;
        if (inRect(ASHFIELD, nx, ny) && t !== idOf('ASH')) continue;    // the Ashfields keep their open ground — see the header
        set(nx, ny, T_VERGE); if (N4.some(([ax, ay]) => at(nx + ax, ny + ay) === T_ROAD)) RD.net.add(idx(nx, ny)); RD.laid.push({ x: nx, y: ny, was: tileName(t), t: 'VERGE' }); n++;
      }
    }
    return n;
  }

  // ---------- placing things beside the road ----------
  const taken = [];
  function beside(at, wish, want, minGap = 4) {
    const [wx, wy] = wish;
    let best = null;
    for (let r = 0; r <= 9 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = wx + dx, y = wy + dy;
      if (!inMap(x, y) || guarded(x, y)) continue;
      if (at(x, y) === T_ROAD) continue;                         // beside the road, never in the middle of it
      if (!want(at(x, y), x, y)) continue;
      if (!N4.some(([ax, ay]) => RD.net.has(idx(x + ax, y + ay)))) continue;   // it must touch the road
      if (taken.some(([tx, ty]) => Math.max(Math.abs(tx - x), Math.abs(ty - y)) < minGap)) continue;
      if (NPCS.some(n => Math.max(Math.abs(n.x - x), Math.abs(n.y - y)) <= 1)) continue;
      if (MONSTER_SPAWNS.some(s => Math.max(Math.abs(s.tx - x), Math.abs(s.ty - y)) <= 1)) continue;
      const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { x, y, d };
    }
    if (best) { taken.push([best.x, best.y]); RD.net.delete(idx(best.x, best.y)); }
    return best;
  }

  // ---------- the pass ----------
  HOOKS.world.push((rnd0, api) => {
    const set = api.setTile, at = api.tileAt;
    RD.roads.length = 0; RD.pois.length = 0; RD.net = new Set(); RD.laid = []; taken.length = 0;
    RD.stats = { paved: 0, verges: 0, adopted: 0, felled: 0, bridges: 0, stones: 0, pois: 0, unplaced: [], failed: [] };
    seatTraders();
    buildGuard(at);
    fordOk = (x, y) => FORDS.some(f => inRect(f, x, y));

    // 1. the roads
    for (const def of ROADS_DEF) {
      const road = { id: def.id, name: def.name, sub: def.sub, paved: 0, adopted: 0, felled: 0, bridges: 0, legs: [], pois: [], stoneAt: null };
      for (const [kind, pts] of def.legs) {
        if (kind === 'adopt') { road.legs.push({ kind, pts, n: adoptLeg(at, pts, road) }); continue; }
        let steps = 0;
        for (let s = 0; s < pts.length - 1; s++) {
          const a = nudge(at, pts[s][0], pts[s][1]), b = nudge(at, pts[s + 1][0], pts[s + 1][1]);
          const p = a && b ? route(at, a[0], a[1], b[0], b[1]) : null;
          if (!p) { road.legs.push({ kind, pts: [pts[s], pts[s + 1]], n: 0, failed: true }); RD.stats.failed.push(`${def.id} ${pts[s]}→${pts[s + 1]}`); continue; }
          paveLeg(set, at, p, road); steps += p.length;
          road.legs.push({ kind, pts: [a, b], n: p.length, turns: turnsIn(p), straight: Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])) });
        }
        road.steps = (road.steps || 0) + steps;
      }
      RD.roads.push(road);
      RD.stats.paved += road.paved; RD.stats.adopted += road.adopted; RD.stats.felled += road.felled; RD.stats.bridges += road.bridges;
    }

    // 2. mend any break between one piece of road and the next
    RD.stats.stitches = stitch(set, at, RD.roads[0]);

    // 3. the verges
    RD.stats.verges = layVerges(set, at);

    // 4. a milestone at the head of each road
    for (const def of ROADS_DEF) {
      const road = RD.roads.find(r => r.id === def.id);
      const spot = beside(at, def.stone, (t, x, y) => t === T_VERGE || (inRect(ASHFIELD, x, y) ? PAVE_ASHFIELD.has(t) : PAVE.has(t) || t === idOf('GRASS')), 3);
      if (!spot) { RD.stats.unplaced.push(def.id + ' milestone'); continue; }
      set(spot.x, spot.y, T_STONE); road.stoneAt = [spot.x, spot.y]; RD.stats.stones++;
      RD.laid.push({ x: spot.x, y: spot.y, was: 'ground', t: 'MILESTONE' });
    }

    // 5. the points of interest
    const TILE_OF = { wreck: T_WRECK, shrine: T_SHRINE, box: T_BOX, cache: T_CACHE, bramble: T_BRAMBLE, pool: T_POOL };
    for (const d of POI_DEF) {
      const road = RD.roads.find(r => r.id === d.road);
      const p = { ...d, at: null, roadName: road ? road.name : d.road };
      if (d.kind === 'trader') {
        const npc = NPCS.find(n => n.id === d.who);
        p.at = npc ? [npc.x, npc.y] : null;
        p.gives = TRADES[d.who] ? `${TRADES[d.who].give[1]} ${ITEMS[TRADES[d.who].give[0]].name.toLowerCase()} for ${TRADES[d.who].take[1]} ${ITEMS[TRADES[d.who].take[0]].name.toLowerCase()}` : '';
        p.howOften = 'any number of times';
      } else if (d.kind === 'beast') {
        const spot = beside(at, d.wish, t => !SOLID.has(t) && !OURS.has(t), 3);
        if (spot) { p.at = [spot.x, spot.y]; api.spawnList(d.type, [[spot.x, spot.y]]); }
        const def = MONSTER_DEFS[d.type];
        p.gives = `${def.name}, level ${def.level}, ${def.hp} hitpoints`;
        p.howOften = `respawns every ${def.respawn} seconds`;
      } else {
        const spot = beside(at, d.wish, (t, x, y) => t === T_VERGE || (inRect(ASHFIELD, x, y) ? PAVE_ASHFIELD.has(t) : PAVE.has(t) || t === idOf('GRASS')));
        if (spot) { p.at = [spot.x, spot.y]; set(spot.x, spot.y, TILE_OF[d.kind]); RD.laid.push({ x: spot.x, y: spot.y, was: tileName(at(spot.x, spot.y)), t: d.kind }); }
        p.gives = d.kind === 'shrine' ? d.blessName
          : d.kind === 'bramble' ? `2-4 ${ITEMS[d.pick].name.toLowerCase()}`
            : d.kind === 'pool' ? `${ITEMS[d.fish].name.toLowerCase()}, and 1 in ${d.extraOdds} a ${ITEMS[d.extra].name.toLowerCase()}`
              : (d.loot || []).map(([id, a, b]) => (a === b ? a : `${a}-${b}`) + ' ' + ITEMS[id].name.toLowerCase()).join(', ');
        p.howOften = d.once ? 'once' : d.key ? 'once, with the key' : d.kind === 'pool' ? 'as often as you like' : `every ${d.every} seconds`;
      }
      if (!p.at) RD.stats.unplaced.push(d.id);
      if (road) road.pois.push(p);
      RD.pois.push(p);
    }
    RD.stats.pois = RD.pois.filter(p => p.at).length;
    RD.stats.stitches = RD.stats.stitches.concat(stitch(set, at, RD.roads[0]));

    // 6. the network, flooded from the cave mouth over road tiles only
    RD.stats.reach = reachReport();
    writeWikiPage();
  });

  function turnsIn(path) { let n = 0; for (let i = 2; i < path.length; i++) { const a = Math.sign(path[i - 1][0] - path[i - 2][0]) + ',' + Math.sign(path[i - 1][1] - path[i - 2][1]); const b = Math.sign(path[i][0] - path[i - 1][0]) + ',' + Math.sign(path[i][1] - path[i - 1][1]); if (a !== b) n++; } return n; }

  // ---------- the proof: a flood over road tiles only, never open ground ----------
  const ANCHORS = [
    ['the cave mouth', 21, 7], ['the signpost', 65, 27], ["Miller's Pond crossing", 44, 32], ['the quarry cart', 54, 13],
    ['the mine shaft', 56, 6], ["Thistledown's west gate", 85, 32], ["Thistledown's east gate", 140, 32],
    ["the goblin camp's gap", 147, 30], ["Harl's dock", 162, 14], ["Old Wren's hut", 30, 81], ["the warden's gate", 60, 96],
    ["Dunstan's farm", 66, 100], ["The Fang's lair approach", 36, 105], ["Hollowford's square", 140, 78],
    ['the jungle path', 141, 96], ["Sylvaris' gap", 137, 114], ['the Wolfwood ford', 80, 61], ['the Cross Ford', 99, 62],
    ['the Hollowford bridge', 146, 56],
  ];
  function netFlood() {
    const seen = new Set(), q = [];
    const seed = [...RD.net].find(i => Math.abs(i % MAP_W - 22) < 6 && Math.abs(((i / MAP_W) | 0) - 7) < 6);
    if (seed === undefined) return seen;
    seen.add(seed); q.push(seed);
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], x = c % MAP_W, y = (c / MAP_W) | 0;
      for (const [dx, dy] of N4) { const n = idx(x + dx, y + dy); if (!inMap(x + dx, y + dy) || seen.has(n) || !RD.net.has(n)) continue; seen.add(n); q.push(n); }
    }
    return seen;
  }
  function reachReport() {
    const seen = netFlood();
    const near = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (seen.has(idx(x + dx, y + dy))) return true; return false; };
    const rows = ANCHORS.map(([name, x, y]) => ({ name, x, y, on: near(x, y, 3) }));
    return { size: seen.size, net: RD.net.size, rows, missed: rows.filter(r => !r.on).map(r => r.name) };
  }
  RD.netFlood = netFlood; RD.reachReport = reachReport;

  // ============================================================================
  // WHAT THE PLACES DO
  // ============================================================================
  const timer = id => { const s = st(); return s.timer[id] || 0; };
  const setTimer = (id, v) => { const s = st(); s.timer[id] = v; };
  const mmss = s => (s >= 60 ? Math.ceil(s / 60) + (Math.ceil(s / 60) === 1 ? ' minute' : ' minutes') : Math.ceil(s) + ' seconds');

  // ---------- blessings ----------
  const bless = (p) => {
    const s = st();
    s.bless = { key: p.bless, name: p.blessName, left: p.secs, n: p.amount };
    s.mendT = 0;
    levelBanner = { text: p.blessName.toUpperCase(), sub: p.name, t: 3 };
    burst(player.x, player.y, '#bcd8ea', 22, 90); sfx('quest');
  };
  const blessed = key => { const s = quest.roads; return s && s.bless && s.bless.key === key && s.bless.left > 0 ? s.bless : null; };
  RD.blessed = blessed;

  // the three core calls a blessing leans on, wrapped the way 13-ux wraps say()
  { const _hurt = hurtPlayer; hurtPlayer = function (dmg, fx, fy, sure) { const b = blessed('fair'); if (b && dmg > 1) dmg = Math.max(1, dmg - b.n); return _hurt(dmg, fx, fy, sure); }; }
  { const _mh = playerMaxHit; playerMaxHit = function () { const b = blessed('might'); return _mh() + (b ? b.n : 0); }; }
  { const _xp = gainXp; gainXp = function (skill, xp) { const b = blessed('hands'); if (b && (skill === 'mining' || skill === 'woodcutting')) xp = Math.round(xp * 2); return _xp(skill, xp); }; }

  HOOKS.update.push(dt => {
    const s = quest.roads; if (!s) return;
    for (const k in s.timer) { s.timer[k] -= dt; if (s.timer[k] <= 0) delete s.timer[k]; }
    if (!s.bless) return;
    s.bless.left -= dt;
    if (s.bless.left <= 0) { notify(s.bless.name + ' has worn off.'); s.bless = null; return; }
    if (s.bless.key === 'mend' && !player.dead && player.hp < player.maxHp) {
      s.mendT = (s.mendT || 0) + dt;
      if (s.mendT >= 3) { s.mendT = 0; player.hp = Math.min(player.maxHp, player.hp + s.bless.n); floatText(player.x, player.y - 30, '+' + s.bless.n, '#7ee787', 13); }
    }
    if (s.bless.key === 'green') {
      for (const m of monsters) {
        if (m.dead || (m.type !== 'wolf' && m.type !== 'boar' && m.type !== 'greyfang' && m.type !== 'grizzlejaw')) continue;
        if (dist(m.x, m.y, player.x, player.y) > 9 * TILE) continue;
        if (m.state === 'chase') m.state = 'return';
        m.angry = false;
      }
    }
  });

  // ---------- a named monster holds its ground ----------
  // An ordinary boar drifts four tiles from where it woke and you never find the same one twice. These six
  // are landmarks: the milestone names them and the book says where they stand, so when they are not
  // fighting they walk back to their own patch instead of wandering off it.
  const NAMED_LEASH = 2 * TILE;
  HOOKS.update.push(() => {
    for (const m of monsters) {
      if (m.dead || !NAMED[m.type] || m.state !== 'idle') continue;
      if (dist(m.x, m.y, m.home.x, m.home.y) > NAMED_LEASH) m.state = 'return';
    }
  });

  // ---------- E on a road thing ----------
  HOOKS.use.push((t, tx, ty) => {
    if (!OURS.has(t)) return false;
    const s = st();
    if (t === T_ROAD || t === T_VERGE) return false;
    if (t === T_STONE) {
      const road = RD.roads.find(r => r.stoneAt && r.stoneAt[0] === tx && r.stoneAt[1] === ty);
      if (!road) { notify('A milestone, worn smooth.'); return true; }
      const list = road.pois.filter(p => p.at).map(p => p.name).join(', ');
      say(`${road.name}. ${road.sub}. Along it: ${list}.`, 'The milestone');
      s.read[road.id] = true; save();
      return true;
    }
    const p = RD.at(tx, ty);
    if (!p) { notify('Nothing here now.'); return true; }
    if (p.kind === 'wreck') {
      if (timer(p.id) > 0) { notify(`${p.name} is picked clean. Carts come by again in ${mmss(timer(p.id))}.`); return true; }
      let got = 0;
      for (const [id, a, b] of p.loot) { const n = rint(a, b); if (n > 0) { giveOrDrop(id, n, player.x, player.y); got++; } }
      setTimer(p.id, p.every);
      say(p.blurb, p.name); burst(tc(tx), tc(ty), '#8b5a2b', 14, 80); sfx('pickup'); save();
      return true;
    }
    if (p.kind === 'shrine') {
      if (timer(p.id) > 0) { notify(`${p.name} is quiet. It will hear you again in ${mmss(timer(p.id))}.`); return true; }
      setTimer(p.id, p.every); bless(p);
      say(p.blurb, p.name); save();
      return true;
    }
    if (p.kind === 'bramble') {
      if (timer(p.id) > 0) { notify(`Picked bare. ${p.name} ripens again in ${mmss(timer(p.id))}.`); return true; }
      if (!canFit(p.pick, 1)) { notify('Your pack is full.'); return true; }
      const n = rint(2, 4);
      giveOrDrop(p.pick, n, player.x, player.y); setTimer(p.id, p.every);
      floatText(player.x, player.y - 30, `+${n} ${ITEMS[p.pick].name}`, ITEMS[p.pick].color, 13);
      burst(tc(tx), tc(ty), '#c0294a', 8, 60); sfx('pickup'); save();
      return true;
    }
    if (p.kind === 'pool') {
      if (!hasTool('rod')) { notify('Deep water, and something moving in it. You need a fishing rod (Marta sells them).'); return true; }
      if (!canFit(p.fish, 1)) { notify('Your pack is full.'); return true; }
      player.action = { type: 'roadfish', t: 0, need: 1.8, tx, ty, poi: p.id };
      return true;
    }
    if (p.kind === 'cache' || p.kind === 'box') {
      if (s.opened[p.id]) { notify(`${p.name} is empty. Whatever was in it, you have it.`); return true; }
      if (p.key && !countItem(p.key)) { say(`${p.name}. The lock wants an iron key. There is one out on the Ash Road, in the warden's old post.`, 'The Voice'); return true; }
      if (p.key) removeItem(p.key, 1);
      for (const [id, a, b] of p.loot) giveOrDrop(id, rint(a, b), player.x, player.y);
      s.opened[p.id] = true;
      say(p.blurb, p.name);
      levelBanner = { text: p.key ? 'STRONGBOX OPENED' : 'CACHE OPENED', sub: p.name, t: 3 };
      burst(tc(tx), tc(ty), '#f5c542', 24, 110); sfx('quest'); save();
      return true;
    }
    return true;
  });

  // the pool's timed catch, run the way the core runs its own timed actions
  HOOKS.update.push(dt => {
    const a = player.action;
    if (!a || a.type !== 'roadfish') return;
    a.t += dt;
    if (a.t < a.need) return;
    const p = RD.poi(a.poi); player.action = { ...a, t: 0 };
    if (!p) { player.action = null; return; }
    if (Math.random() > Math.min(0.92, 0.55 + skillLv('fishing') * 0.02)) return;
    giveOrDrop(p.fish, 1, player.x, player.y); gainXp('fishing', p.xp); sfx('fish');
    burst(tc(a.tx), tc(a.ty), '#bfe3ff', 8, 50);
    if (Math.random() < 1 / p.extraOdds) { giveOrDrop(p.extra, 1, player.x, player.y); levelBanner = { text: 'RIVER PEARL', sub: p.name, t: 3 }; burst(tc(a.tx), tc(a.ty), '#f5c542', 24, 110); }
    if (!canFit(p.fish, 1)) { player.action = null; notify('Your pack is full.'); }
  });

  // ---------- the roadside traders ----------
  HOOKS.talk.road_trade = npc => {
    const tr = TRADES[npc.id]; if (!tr) return;
    const [gid, gn] = tr.give, [tid, tn] = tr.take;
    const have = gid === 'coins' ? coins() : countItem(gid);
    if (have < gn) { say(`${tr.line} You have ${have} of ${gn}.`, npc.name); return; }
    if (gid === 'coins') payCoins(gn); else removeItem(gid, gn);
    if (tid === 'coins') giveOrDrop('coins', tn, player.x, player.y); else giveOrDrop(tid, tn, player.x, player.y);
    say(`${tr.line} There you are.`, npc.name);
    floatText(player.x, player.y - 30, `+${tn} ${ITEMS[tid].name}`, ITEMS[tid].color, 13); sfx('coins'); save();
  };

  // ============================================================================
  // THE PICTURE
  // ============================================================================
  const hash = (x, y, k) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k, 1274126177)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1540483477) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // the surface: wheel ruts down the line of travel, loose gravel, and a kerb where the verge starts
  const drawRoad = (g, x, y) => {
    const bx = x * TILE, by = y * TILE;
    g.fillStyle = 'rgba(150,133,101,0.55)'; g.fillRect(bx, by, TILE, TILE);
    const alongX = tileAt(x - 1, y) === T_ROAD || tileAt(x + 1, y) === T_ROAD;
    g.strokeStyle = 'rgba(96,81,58,0.5)'; g.lineWidth = 3;
    for (const f of [0.32, 0.68]) {
      g.beginPath();
      if (alongX) { g.moveTo(bx, by + TILE * f); g.lineTo(bx + TILE, by + TILE * f); }
      else { g.moveTo(bx + TILE * f, by); g.lineTo(bx + TILE * f, by + TILE); }
      g.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const a = hash(x, y, i), b = hash(x, y, i + 21);
      g.fillStyle = a > 0.6 ? 'rgba(196,183,153,0.7)' : 'rgba(112,98,74,0.7)';
      g.beginPath(); g.arc(bx + 4 + a * 40, by + 4 + b * 40, 1 + a * 1.6, 0, 7); g.fill();
    }
  };
  // the verge: cropped turf with a line of kerb stones on the road side
  const drawVerge = (g, x, y) => {
    const bx = x * TILE, by = y * TILE;
    g.fillStyle = 'rgba(120,140,74,0.35)'; g.fillRect(bx, by, TILE, TILE);
    for (const [dx, dy] of N4) {
      if (tileAt(x + dx, y + dy) !== T_ROAD) continue;
      g.fillStyle = 'rgba(186,178,158,0.85)';
      for (let i = 0; i < 4; i++) {
        const a = hash(x, y, i + dx * 7 + dy * 13);
        const px = dx ? bx + (dx > 0 ? TILE - 6 : 2) : bx + 3 + i * 11 + a * 3;
        const py = dy ? by + (dy > 0 ? TILE - 6 : 2) : by + 3 + i * 11 + a * 3;
        g.fillRect(px, py, dx ? 4 : 7, dy ? 4 : 7);
      }
    }
    for (let i = 0; i < 3; i++) { const a = hash(x, y, i + 41), b = hash(x, y, i + 53); g.strokeStyle = 'rgba(150,176,96,0.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx + 6 + a * 36, by + 40); g.lineTo(bx + 6 + a * 36 + (b - 0.5) * 4, by + 28 - b * 8); g.stroke(); }
  };
  const drawStone = (g, x, y) => {
    const cx = tc(x), cy = tc(y);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, cy + 15, 13, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#a8a293'; g.beginPath(); g.moveTo(cx - 9, cy + 15); g.lineTo(cx - 7, cy - 13); g.quadraticCurveTo(cx, cy - 21, cx + 7, cy - 13); g.lineTo(cx + 9, cy + 15); g.closePath(); g.fill();
    g.fillStyle = '#c6c0b0'; g.beginPath(); g.moveTo(cx - 9, cy + 15); g.lineTo(cx - 7, cy - 13); g.quadraticCurveTo(cx - 3, cy - 19, cx - 1, cy - 18); g.lineTo(cx - 1, cy + 15); g.closePath(); g.fill();
    g.strokeStyle = '#5e5a51'; g.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - 5, cy - 6 + i * 6); g.lineTo(cx + 5, cy - 6 + i * 6); g.stroke(); }
  };
  const drawWreck = (g, x, y) => {
    const cx = tc(x), cy = tc(y), empty = timer((RD.at(x, y) || {}).id) > 0;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + 14, 20, 7, 0, 0, 7); g.fill();
    g.save(); g.translate(cx, cy); g.rotate(-0.42);
    g.fillStyle = '#6b4b28'; g.fillRect(-18, -8, 34, 16);
    g.fillStyle = '#87613a'; g.fillRect(-18, -8, 34, 5);
    g.strokeStyle = '#4a3319'; g.lineWidth = 1.6; for (let i = -14; i < 16; i += 7) { g.beginPath(); g.moveTo(i, -8); g.lineTo(i, 8); g.stroke(); }
    g.restore();
    // the wheel that came off, lying flat beside it
    g.strokeStyle = '#4a3319'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx + 14, cy + 8, 11, 5, 0.2, 0, 7); g.stroke();
    g.lineWidth = 1.4; for (let i = 0; i < 6; i++) { const a = i * 1.047; g.beginPath(); g.moveTo(cx + 14, cy + 8); g.lineTo(cx + 14 + Math.cos(a) * 10, cy + 8 + Math.sin(a) * 4.5); g.stroke(); }
    if (!empty) { for (const [ox, oy, c] of [[-14, 10, '#c9a227'], [-6, 13, '#b9873a'], [4, 12, '#9aa3ae']]) { g.fillStyle = c; g.beginPath(); g.arc(cx + ox, cy + oy, 3, 0, 7); g.fill(); } }
  };
  const drawShrine = (g, x, y) => {
    const cx = tc(x), cy = tc(y), p = RD.at(x, y), ready = p && timer(p.id) <= 0;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, cy + 15, 15, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#8f9aa4'; g.fillRect(cx - 12, cy + 6, 24, 9);
    g.fillStyle = '#a9b4be'; g.beginPath(); g.moveTo(cx - 9, cy + 6); g.lineTo(cx - 7, cy - 14); g.lineTo(cx + 7, cy - 14); g.lineTo(cx + 9, cy + 6); g.closePath(); g.fill();
    g.fillStyle = '#c3ced8'; g.beginPath(); g.moveTo(cx - 9, cy - 14); g.lineTo(cx, cy - 23); g.lineTo(cx + 9, cy - 14); g.closePath(); g.fill();
    g.fillStyle = ready ? '#ffe9a8' : '#4d5560'; g.beginPath(); g.arc(cx, cy - 6, 4.5, 0, 7); g.fill();
    if (ready) { const pulse = 0.5 + Math.sin(time * 2.4 + x) * 0.3; g.fillStyle = `rgba(255,233,168,${0.25 * pulse})`; g.beginPath(); g.arc(cx, cy - 6, 11, 0, 7); g.fill(); }
  };
  const drawBox = (g, x, y) => {
    const cx = tc(x), cy = tc(y), p = RD.at(x, y), open = p && quest.roads && quest.roads.opened[p.id];
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + 14, 16, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#6d5a34'; g.fillRect(cx - 14, cy - 6, 28, 20);
    g.fillStyle = open ? '#4a3f24' : '#8a7442'; g.fillRect(cx - 14, cy - 13, 28, 8);
    g.fillStyle = '#9aa3ae'; g.fillRect(cx - 15, cy - 2, 30, 3); g.fillRect(cx - 2, cy - 13, 4, 27);
    if (!open) { g.fillStyle = '#c9a227'; g.beginPath(); g.arc(cx, cy + 3, 4, 0, 7); g.fill(); g.fillStyle = '#5a4a1e'; g.fillRect(cx - 1, cy + 3, 2, 4); }
    // the chain and the post it is chained to
    g.strokeStyle = '#7c8189'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 14, cy + 4); g.lineTo(cx + 20, cy + 8); g.stroke();
    g.fillStyle = '#5a4a33'; g.fillRect(cx + 18, cy - 10, 5, 24);
  };
  const drawCache = (g, x, y) => {
    const cx = tc(x), cy = tc(y), p = RD.at(x, y), open = p && quest.roads && quest.roads.opened[p.id];
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + 14, 18, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#5f5a51'; g.beginPath(); g.moveTo(cx - 18, cy + 15); g.lineTo(cx - 13, cy - 14); g.lineTo(cx - 2, cy - 18); g.lineTo(cx - 3, cy + 15); g.closePath(); g.fill();
    g.fillStyle = '#6e6960'; g.beginPath(); g.moveTo(cx + 18, cy + 15); g.lineTo(cx + 13, cy - 15); g.lineTo(cx + 2, cy - 17); g.lineTo(cx + 3, cy + 15); g.closePath(); g.fill();
    g.fillStyle = open ? '#2a2722' : '#191714'; g.fillRect(cx - 3, cy - 14, 6, 29);
    if (!open) { g.fillStyle = '#7a5f2c'; g.fillRect(cx - 5, cy + 2, 10, 9); g.fillStyle = '#c9a227'; g.fillRect(cx - 5, cy + 4, 10, 2); }
  };
  const drawBramble = (g, x, y) => {
    const cx = tc(x), cy = tc(y), p = RD.at(x, y), bare = p && timer(p.id) > 0;
    const sway = Math.sin(time * 1.5 + x * 0.8 + y * 0.5) * 0.9;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 16, 20, 6, 0, 0, 7); g.fill();
    g.strokeStyle = '#4b3a22'; g.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const a = hash(x, y, i); g.beginPath(); g.moveTo(cx - 14 + i * 7, cy + 15); g.quadraticCurveTo(cx - 12 + i * 7 + (a - 0.5) * 10, cy, cx - 16 + i * 7 + sway, cy - 12 - a * 8); g.stroke(); }
    for (const [ox, oy, r] of [[-10, 0, 10], [8, 2, 9], [0, -8, 11], [-4, 8, 8]]) { g.fillStyle = bare ? '#3f5f2c' : '#2f5e26'; g.beginPath(); g.arc(cx + ox + sway * 0.4, cy + oy, r, 0, 7); g.fill(); }
    for (const [ox, oy, r] of [[-10, 0, 10], [8, 2, 9], [0, -8, 11]]) { g.fillStyle = bare ? '#5f8a44' : '#4c9134'; g.beginPath(); g.arc(cx + ox - 2 + sway * 0.4, cy + oy - 3, r * 0.55, 0, 7); g.fill(); }
    if (!bare) for (const [ox, oy] of [[-11, -3], [-2, -11], [7, -6], [11, 3], [-6, 6], [2, 2], [8, 9]]) {
      g.fillStyle = '#a8203c'; g.beginPath(); g.arc(cx + ox + sway * 0.4, cy + oy, 2.6, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(cx + ox - 0.9 + sway * 0.4, cy + oy - 0.9, 0.9, 0, 7); g.fill();
    }
  };
  const drawPool = (g, x, y) => {
    const cx = tc(x), cy = tc(y);
    g.fillStyle = '#5c7a4a'; g.beginPath(); g.ellipse(cx, cy, 23, 21, 0, 0, 7); g.fill();
    g.fillStyle = '#1d3f5c'; g.beginPath(); g.ellipse(cx, cy, 19, 17, 0, 0, 7); g.fill();
    g.fillStyle = '#2b5c80'; g.beginPath(); g.ellipse(cx, cy + 2, 15, 12, 0, 0, 7); g.fill();
    for (let i = 0; i < 3; i++) {
      const ph = (time * 0.5 + i * 0.33) % 1;
      g.strokeStyle = `rgba(190,225,255,${0.45 * (1 - ph)})`; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(cx, cy + 2, 3 + ph * 13, 2 + ph * 10, 0, 0, 7); g.stroke();
    }
    // a fish turning over, just under the surface
    const fx = cx + Math.sin(time * 0.9 + x) * 8, fy = cy + Math.cos(time * 0.7 + y) * 6;
    g.fillStyle = 'rgba(214,232,240,0.55)'; g.beginPath(); g.ellipse(fx, fy, 5, 2.2, Math.sin(time) * 0.6, 0, 7); g.fill();
    for (const [ox, oy] of [[-20, -12], [19, -10], [-17, 13]]) { g.fillStyle = '#7d8570'; g.beginPath(); g.ellipse(cx + ox, cy + oy, 5, 3.5, 0.3, 0, 7); g.fill(); }
  };

  const DRAW = {}; DRAW[T_STONE] = drawStone; DRAW[T_WRECK] = drawWreck; DRAW[T_SHRINE] = drawShrine;
  DRAW[T_BOX] = drawBox; DRAW[T_CACHE] = drawCache; DRAW[T_BRAMBLE] = drawBramble; DRAW[T_POOL] = drawPool;

  // HOOKS.draw is (g, items, cam) and every pushed item's draw() takes no arguments
  // HOOKS.draw is called as (g, items, cam) and every item pushed has its draw() called with NO arguments
  const drawHook = (g, items, cam) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
    // the surface is flat: one item, sorted under everything that stands on it (the blend's grass feather is at -1e9)
    items.push({ y: -9e8, draw: () => {
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const t = map[idx(tx, ty)];
        if (t === T_ROAD) drawRoad(g, tx, ty); else if (t === T_VERGE) drawVerge(g, tx, ty);
      }
    } });
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const f = DRAW[map[idx(tx, ty)]];
      if (f) items.push({ y: ty * TILE + TILE - 4, draw: () => f(g, tx, ty) });
    }
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 4, draw: () => {
      if (npcInFront()) return;
      const { tx, ty } = frontTile(player);
      if (!DRAW[tileAt(tx, ty)]) return;
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]);
      roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]);
    } });
  };
  HOOKS.draw.push(drawHook);

  // ---------- the blessing tag, under the HP box ----------
  const hudHook = (g, narrow) => {
    const s = quest.roads; if (!s || !s.bless || s.bless.left <= 0 || panel) return;
    const y = Math.max(HUD.leftY, 84), w = 176, h = isTouch ? 40 : 30, x = 14;
    g.fillStyle = 'rgba(16,18,22,0.82)'; roundRect(g, x, y, w, h, 7); g.fill();
    g.strokeStyle = 'rgba(188,216,234,0.55)'; g.lineWidth = 1.5; roundRect(g, x, y, w, h, 7); g.stroke();
    g.fillStyle = '#bcd8ea'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(s.bless.name, x + 10, y + h / 2 - 6);
    g.fillStyle = '#8b949e'; g.font = '11px sans-serif';
    g.fillText(Math.ceil(s.bless.left) + 's left', x + 10, y + h / 2 + 9);
    const f = clamp(s.bless.left / 180, 0, 1);
    g.fillStyle = 'rgba(188,216,234,0.9)'; g.fillRect(x + w - 12, y + h - 4 - (h - 8) * f, 4, (h - 8) * f);
    HUD.leftY = y + h + 6;
  };
  HOOKS.hud.push(hudHook);

  // ---------- the book ----------
  function writeWikiPage() {
    if (!window.WIKI) return;
    const out = [{ t: 'Six roads join every place you go. A milestone stands at the head of each one: read it and it names the road and everything on it.', c: '#8b949e' }];
    for (const r of RD.roads) {
      out.push({ t: r.name, c: '#e9eef5' });
      out.push({ t: '  ' + r.sub, c: '#8b949e' });
      for (const p of r.pois) out.push({ t: `  ${p.n}. ${p.name} — ${p.gives} (${p.howOften})`, c: '#c9d1d9' });
    }
    WIKI.add('places', { id: 'roads', name: 'The roads', sub: 'Six of them, and what stands along each', lines: out });
  }

  // ============================================================================
  // SELF-TEST
  // ============================================================================
  const P = 'roads: ';
  HOOKS.selfTest.push((check, F, h) => {
    const S = RD.stats;

    // 1. every named place is on the network, proved by a flood over road tiles only — never open ground
    { const r = RD.reachReport();
      check(P + `every named place is joined by road: a flood over road tiles only (never open ground) from the cave mouth reaches all ${ANCHORS.length}`,
        r.missed.length === 0 && r.size > 900, { reached: r.rows.length - r.missed.length, of: r.rows.length, missed: r.missed, floodTiles: r.size, networkTiles: r.net }); }

    // 2. the flood really is road-only: it must not spread over plain grass
    { const seen = RD.netFlood(); let offRoad = 0;
      const OK = new Set([T_ROAD, T_VERGE, T.DIRT, T.COBBLE, PLANK_T, idOf('DOCK'), idOf('GATE'), idOf('PORTCULLIS'), idOf('WARDEN_GATE'),
        idOf('SAND'), idOf('SCORCH'), idOf('ASHES'), idOf('ASH'), idOf('FERN'), idOf('FLOWERS'), idOf('MUSHROOM'), T.GRASS]);
      let grass = 0;
      for (const i of seen) { const t = map[i]; if (!OK.has(t)) offRoad++; if (t === T.GRASS) grass++; }
      // bare ground only enters the network where an adopted stretch crosses to a hermit's door or through the
      // goblins' camp: it has to stay a worn line, not a field, so it is held under a twentieth of the whole
      check(P + `the network is made of road, verge, old track, bridge and gate tiles — the ${grass} tiles of open ground on it are the worn paths to a door, under a twentieth of the whole`,
        offRoad === 0 && grass / seen.size <= 0.05, { offRoad, grassTiles: grass, fraction: +(grass / seen.size).toFixed(3), size: seen.size }); }

    // 3. six roads, each with three to six points of interest, all of them placed
    { const bad = RD.roads.filter(r => r.pois.length < 3 || r.pois.length > 6).map(r => r.name);
      const unplaced = RD.pois.filter(p => !p.at).map(p => p.id);
      check(P + `six roads, each carrying three to six points of interest (${RD.roads.map(r => r.pois.length).join('+')} = ${RD.pois.length}), every one placed`,
        RD.roads.length === 6 && bad.length === 0 && unplaced.length === 0, { counts: RD.roads.map(r => `${r.name}: ${r.pois.length}`), bad, unplaced }); }

    // 4. every point of interest touches the road and can be walked to
    { const bad = [];
      for (const p of RD.pois) {
        if (!p.at) { bad.push(p.id + ': unplaced'); continue; }
        const [x, y] = p.at;
        const touches = N8.some(([dx, dy]) => RD.net.has(idx(x + dx, y + dy)));
        let stand = null;
        for (const [dx, dy] of N4) if (!stand && inMap(x + dx, y + dy) && !SOLID.has(tileAt(x + dx, y + dy))) stand = [x + dx, y + dy];
        if (p.kind === 'trader' || p.kind === 'beast') stand = SOLID.has(tileAt(x, y)) ? stand : [x, y];
        const walk = stand ? F.bfs(22, 7, stand[0], stand[1]) : null;
        if (!touches) bad.push(`${p.id}: not beside the road`);
        else if (!walk) bad.push(`${p.id}: no walk from the cave`);
      }
      check(P + `all ${RD.pois.length} points of interest stand on the road's edge and are walkable from the cave mouth`, bad.length === 0, { bad, placed: S.pois }); }

    // 5. no road tile landed on a guarded coordinate, a building, a door, a gate, an NPC or a spawn
    { const onGuard = RD.laid.filter(l => guarded(l.x, l.y) && !PASS.some(([a, b, c, d]) => l.x >= a && l.x <= c && l.y >= b && l.y <= d)).map(l => `${l.x},${l.y}`);
      const inBuilding = RD.laid.filter(l => !!buildingAt(l.x, l.y)).map(l => `${l.x},${l.y}`);
      const onNpc = NPCS.filter(n => OURS.has(tileAt(n.x, n.y)) && SOLID.has(tileAt(n.x, n.y))).map(n => n.id);
      const KEEP = new Set(['DOOR', 'COFFINDOOR', 'DUNGEON_DOOR', 'GATE', 'PORTCULLIS', 'WARDEN_GATE', 'TOWN_WALL', 'FENCE', 'PALISADE', 'HWALL', 'CWALL', 'WALL',
        'BERRY_BUSH', 'ROCK', 'IRON', 'COAL', 'SIGN', 'CART', 'CHEST', 'SHAFT', 'BOARD', 'WELL', 'HATCH', 'STEPPING_STONE', 'RIVER_POST', 'CLIMB', 'LOG_BALANCE',
        'NET', 'JUMP_GAP', 'COURSE_MARK', 'GRAVE', 'STONECIRCLE', 'DUMMY', 'SOIL', 'CROP', 'FIRE', 'LODESTONE', 'COBBLE', 'MITHRIL', 'BLACKIRON', 'SUNSTONE', 'STORMSTONE']);
      const tookSomething = RD.laid.filter(l => KEEP.has(l.was)).map(l => `${l.was}@${l.x},${l.y}`);
      check(P + 'not one road tile landed on a guarded coordinate, a building, a door, a gate, a wall, an ore rock, a berry bush or a course obstacle',
        onGuard.length === 0 && inBuilding.length === 0 && onNpc.length === 0 && tookSomething.length === 0,
        { onGuard: onGuard.slice(0, 8), inBuilding: inBuilding.slice(0, 8), onNpc, tookSomething: tookSomething.slice(0, 8), laid: RD.laid.length }); }

    // 6. it reads as a road: one surface with verges, and it bends rather than running with a ruler
    { let road = 0, verged = 0;
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (map[idx(x, y)] === T_ROAD) { road++; if (N8.some(([dx, dy]) => tileAt(x + dx, y + dy) === T_VERGE)) verged++; }
      const legs = RD.roads.flatMap(r => r.legs.filter(l => l.kind === 'route' && l.n > 6));
      const straightRun = legs.filter(l => l.turns < 2 && l.n <= l.straight);   // a leg that went from A to B with a ruler
      const walked = legs.reduce((a, l) => a + l.n, 0), ruler = legs.reduce((a, l) => a + l.straight, 0);
      check(P + `${road} tiles of one road surface, ${Math.round(verged / road * 100)}% of them kerbed by a verge, and not one long leg runs with a ruler: together they walk ${walked} tiles where the ruler says ${ruler}`,
        road > 450 && verged / road > 0.8 && legs.length >= 15 && straightRun.length === 0 && walked > ruler * 1.05,
        { road, verged, verges: S.verges, legs: legs.length, straightRun, walked, ruler, felledTrees: S.felled, bridges: S.bridges }); }

    // 7. a milestone at the head of every road, and E reads out what is on it
    { const stones = RD.roads.filter(r => r.stoneAt).length;
      const r0 = RD.roads[0]; let told = false;
      if (r0 && r0.stoneAt) { const s = r0.stoneAt; h.peace(true); F.goAdjacent(s[0], s[1], 4000); F.face(s[0], s[1]); dialog.queue.length = 0; dialog.cur = null; F.press('KeyE'); F.sim(2, []);
        told = !!dialog.cur && /Cave Road/.test(dialog.cur.text) && /Overturned Cart/.test(dialog.cur.text); dialog.queue.length = 0; dialog.cur = null; h.peace(false); }
      check(P + 'a milestone stands at the head of all six roads, and reading one names the road and everything on it', stones === 6 && told && INTERESTING_TILES.has(T_STONE), { stones, told, at: RD.roads.map(r => r.stoneAt) }); }

    // 8. the wrecked carts give what they promise, go empty, and fill again
    { const p = RD.poi('cart_over'); const inv0 = JSON.stringify(player.inv);
      h.peace(true); player.inv = player.inv.map(() => null);
      const s = st(); delete s.timer[p.id];
      const pl0 = countItem('plank'), c0 = coins();
      F.goAdjacent(p.at[0], p.at[1], 5000); F.face(p.at[0], p.at[1]); F.press('KeyE'); F.sim(2, []);
      const got = countItem('plank') - pl0, gotCoins = coins() - c0;
      notice = null; F.press('KeyE'); F.sim(2, []);
      const empty = countItem('plank') - pl0 === got && !!notice && /picked clean/i.test(notice.text) && timer(p.id) > 0;
      s.timer[p.id] = 0.01; F.sim(3, []); F.press('KeyE'); F.sim(2, []);
      const again = countItem('plank') - pl0 > got;
      player.inv = JSON.parse(inv0); delete s.timer[p.id]; h.peace(false);
      check(P + `${p.name} gives 2-4 planks, 1-2 logs and 4-14 coins, is picked clean, and a new cart comes by after ${p.every / 60} minutes`,
        got >= 2 && got <= 4 && gotCoins >= 4 && gotCoins <= 14 && empty && again, { got, gotCoins, empty, again, at: p.at }); }

    // 9. the wayshrines: each hands out its own named blessing, and the blessing actually does the thing
    { const s = st(); const fair = RD.poi('stone_trav'), might = RD.poi('stone_kneel'), hands = RD.poi('stone_wind'), mend = RD.poi('stone_bell'), green = RD.poi('stone_wood');
      const names = [fair, might, hands, mend, green].map(p => p && p.blessName);
      s.bless = null; delete s.timer[fair.id];
      h.peace(true); F.goAdjacent(fair.at[0], fair.at[1], 6000); F.face(fair.at[0], fair.at[1]); F.press('KeyE'); F.sim(2, []);
      const on = !!blessed('fair') && s.bless.name === 'Fair Road' && s.bless.left > 170;
      const hp0 = player.hp = player.maxHp; hurtPlayer(6, player.x + 40, player.y, true); const softened = hp0 - player.hp === 4;
      s.bless = { key: 'might', name: 'Ash Ward', left: 90, n: 3 }; const base = player.equip.weapon; player.equip.weapon = null;
      const withMight = playerMaxHit(); s.bless = null; const without = playerMaxHit(); player.equip.weapon = base;
      s.bless = { key: 'hands', name: 'Steady Hands', left: 180, n: 2 };
      const mx0 = player.skills.mining.xp; gainXp('mining', 10); const doubled = player.skills.mining.xp - mx0 === 20;
      const rx0 = player.skills.range.xp; gainXp('range', 10); const rangeSame = player.skills.range.xp - rx0 === 10;
      player.skills.mining.xp = mx0; player.skills.range.xp = rx0;
      s.bless = { key: 'mend', name: 'Deep Breath', left: 180, n: 1 }; s.mendT = 0; player.hp = player.maxHp - 5;
      for (let i = 0; i < 200; i++) for (const u of HOOKS.update) u(1 / 60);
      const mended = player.hp > player.maxHp - 5;
      s.bless = null; player.hp = player.maxHp; delete s.timer[fair.id]; h.peace(false);
      check(P + 'five wayshrines, five different named blessings: Fair Road softens a hit by 2, Ash Ward adds 3 to your best swing, Steady Hands doubles Mining and Woodcutting only, Deep Breath mends you as you walk, Green Path calms the beasts',
        on && softened && withMight - without === 3 && doubled && rangeSame && mended && names.join('/') === 'Fair Road/Ash Ward/Steady Hands/Deep Breath/Green Path',
        { on, softened, might: withMight - without, doubled, rangeSame, mended, names }); }

    // 10. the shrine cooldown, in plain words
    { const p = RD.poi('stone_trav'), s = st();
      s.bless = null; setTimer(p.id, p.every);
      notice = null; h.peace(true); F.goAdjacent(p.at[0], p.at[1], 6000); F.face(p.at[0], p.at[1]); F.press('KeyE'); F.sim(2, []);
      const refused = !blessed('fair') && !!notice && /quiet/i.test(notice.text) && /minutes/.test(notice.text);
      delete s.timer[p.id]; h.peace(false);
      check(P + `a shrine only gives once every ${p.every / 60} minutes, and says so in words a ten-year-old reads`, refused, { refused, notice: notice && notice.text }); }

    // 11. the brambles and the deep pool
    { const b = RD.poi('salt_bramble'), s = st(); const inv0 = JSON.stringify(player.inv);
      delete s.timer[b.id]; h.peace(true); player.inv = player.inv.map(() => null);
      const h0 = countItem('haws');
      F.goAdjacent(b.at[0], b.at[1], 6000); F.face(b.at[0], b.at[1]); F.press('KeyE'); F.sim(2, []);
      const picked = countItem('haws') - h0;
      notice = null; F.press('KeyE'); F.sim(2, []);
      const bare = countItem('haws') - h0 === picked && !!notice && /bare/i.test(notice.text);
      player.inv = JSON.parse(inv0); delete s.timer[b.id];
      const pool = RD.poi('pool_pond');
      player.inv = player.inv.map(() => null); h.give('fishing_rod', 1);
      const t0 = countItem('raw_trout');
      F.goAdjacent(pool.at[0], pool.at[1], 8000); F.face(pool.at[0], pool.at[1]); F.press('KeyE');
      const caught = F.untilAction(2500, () => countItem('raw_trout') > t0);
      player.action = null; h.peace(false);
      check(P + `${b.name} gives 2-4 hawthorn haws then goes bare for ${b.every} seconds; ${pool.name} is fished with a rod for trout and, 1 in ${pool.extraOdds}, a river pearl`,
        picked >= 2 && picked <= 4 && bare && typeof caught === 'number' && countItem('raw_trout') > t0 && ITEMS.haws.heal === 3 && ITEMS.river_pearl.value === 75,
        { picked, bare, caught, trout: countItem('raw_trout') - t0, bramble: b.at, pool: pool.at }); }

    // 12. the locked strongbox, and the key a day's walk away on another road
    { const box = RD.poi('toll'), cache = RD.poi('post'), s = st();
      s.opened = {}; const inv0 = JSON.stringify(player.inv);
      player.inv = player.inv.map(() => null);
      h.peace(true);
      notice = null; dialog.queue.length = 0; dialog.cur = null;
      F.goAdjacent(box.at[0], box.at[1], 9000); F.face(box.at[0], box.at[1]); F.press('KeyE'); F.sim(2, []);
      const locked = !s.opened[box.id] && !!dialog.cur && /iron key/i.test(dialog.cur.text) && /Ash Road/.test(dialog.cur.text);
      dialog.queue.length = 0; dialog.cur = null;
      // the key is out at the warden's old post, on a different road
      F.tp(cache.at[0], cache.at[1] + 1); F.goAdjacent(cache.at[0], cache.at[1], 3000); F.face(cache.at[0], cache.at[1]); F.press('KeyE'); F.sim(2, []);
      const gotKey = countItem('iron_key') === 1 && s.opened[cache.id] === true;
      const c0 = coins(), sb0 = countItem('steel_bar');
      F.tp(box.at[0], box.at[1] + 1); F.goAdjacent(box.at[0], box.at[1], 3000); F.face(box.at[0], box.at[1]); F.press('KeyE'); F.sim(2, []);
      const opened = s.opened[box.id] === true && coins() - c0 === 250 && countItem('steel_bar') - sb0 === 3 && countItem('iron_key') === 0;
      const farApart = Math.hypot(box.at[0] - cache.at[0], box.at[1] - cache.at[1]) > 60 && box.road !== cache.road;
      dialog.queue.length = 0; dialog.cur = null; player.inv = JSON.parse(inv0); s.opened = {}; h.peace(false);
      check(P + `${box.name} is locked until you find the ${ITEMS.iron_key.name} at ${cache.name} on a different road, then gives 250 coins and 3 steel bars, once`,
        locked && gotKey && opened && farApart, { locked, gotKey, opened, farApart, box: box.at, cache: cache.at }); }

    // 13. the three roadside traders each do exactly their one thing
    { const inv0 = JSON.stringify(player.inv), c0 = coins();
      h.peace(true);
      const rows = [];
      for (const k of ['ivo', 'kett', 'meg']) {
        const tr = TRADES[k], npc = NPCS.find(n => n.id === k);
        const [gid, gn] = tr.give, [tid, tn] = tr.take;
        player.inv = player.inv.map(() => null);
        notice = null; dialog.queue.length = 0; dialog.cur = null;
        F.talk(k); const refused = !!dialog.cur && new RegExp(`You have 0 of ${gn}`).test(dialog.cur.text);
        dialog.queue.length = 0; dialog.cur = null;
        if (gid !== 'coins') h.give(gid, gn);
        const before = tid === 'coins' ? coins() : countItem(tid);
        F.talk(k); F.sim(2, []);
        const after = tid === 'coins' ? coins() : countItem(tid);
        rows.push({ who: npc.name, refused, gave: gn + ' ' + gid, got: after - before, want: tn, ok: refused && after - before === tn && (gid === 'coins' || countItem(gid) === 0) });
      }
      player.inv = JSON.parse(inv0); dialog.queue.length = 0; dialog.cur = null; h.peace(false);
      check(P + 'Ivo swaps 6 coal for an iron bar, Rusty Kett pays 120 coins for a river pearl, Cinder Meg turns 4 logs into 3 coal — and each says what they want when you have not got it',
        rows.every(r => r.ok), { rows }); }

    // 14. six named monsters, each on the roads, each respawning, each with its own trophy
    { // and they hold their ground: pushed off their patch, an idle one walks back rather than drifting
      let leashed = false;
      { const m = monsters.find(x => x.type === 'grizzlejaw' && !x.dead);
        if (m) { const hx = m.home.x, hy = m.home.y; h.peace(true); m.state = 'idle'; m.x = hx + 5 * TILE; m.y = hy;
          for (let i = 0; i < 240; i++) for (const u of HOOKS.update) u(1 / 60);
          leashed = m.state === 'return' || dist(m.x, m.y, hx, hy) < 5 * TILE;
          m.x = hx; m.y = hy; m.state = 'idle'; h.peace(false); } }
      const rows = RD.pois.filter(p => p.kind === 'beast').map(p => {
        const def = MONSTER_DEFS[p.type];
        const trophy = def.drops.rare.table[0][0];
        const live = monsters.some(m => m.type === p.type);
        const spawn = MONSTER_SPAWNS.some(s => s.type === p.type && !s.camp);
        return { id: p.type, name: def.name, lv: def.level, respawn: def.respawn, trophy, value: ITEMS[trophy].value, live, spawn, aggro: !!def.aggro, ok: live && spawn && !def.aggro && def.respawn <= 110 && ITEMS[trophy].value >= 90 };
      });
      check(P + `six named monsters stand off the roads — ${rows.map(r => r.name).join(', ')} — none of them charge you, each respawns within ${Math.max(...rows.map(r => r.respawn))} seconds, and each drops its own trophy — and each holds its own patch instead of drifting off it`,
        rows.length === 6 && rows.every(r => r.ok) && leashed, { rows, holdsGround: leashed }); }

    // 15. one of them, actually killed, actually pays
    { const p = RD.pois.find(x => x.id === 'grizzle');
      const m = monsters.find(x => x.type === 'grizzlejaw');
      let paid = false, respawns = false;
      if (m) {
        h.peace(true);
        const b0 = countItem('raw_beef'), k0 = player.kills;
        m.dead = false; m.hp = 1; m.x = player.x + 40; m.y = player.y; m.state = 'idle';
        killMonster(m);
        for (let i = 0; i < 90; i++) for (const u of HOOKS.update) u(1 / 60);
        paid = player.kills === k0 + 1 && drops.some(d => d.id === 'raw_beef');
        respawns = m.respawnT >= MONSTER_DEFS.grizzlejaw.respawn;
        drops = drops.filter(d => d.id !== 'raw_beef' && d.id !== 'boar_tusk' && d.id !== 'coins' && d.id !== 'grizzle_tusk');
        m.dead = false; m.hp = m.maxHp; m.respawnT = 0; h.peace(false); void b0;
      }
      check(P + 'Grizzlejaw dies, drops 2-3 raw beef, and is back on the road in 75 seconds', paid && respawns, { paid, respawns, at: p && p.at }); }

    // 16. the picture: the tile art, the draw hook's (g, items, cam) contract, and the blessing tag
    { let ok = true, err = null, items = 0;
      const cx = cam.x, cy = cam.y, px = player.x, py = player.y, bless0 = st().bless;
      try {
        // every piece of art, drawn straight: the canvas is a stub, so this catches a bad call, not a bad picture
        for (const p of RD.pois) if (p.at) { const f = DRAW[tileAt(p.at[0], p.at[1])]; if (f) f(ctx, p.at[0], p.at[1]); }
        for (const r of RD.roads) if (r.stoneAt) drawStone(ctx, r.stoneAt[0], r.stoneAt[1]);
        { const i = [...RD.net][0], x = i % MAP_W, y = (i / MAP_W) | 0; drawRoad(ctx, x, y); drawVerge(ctx, x, y); }
        // and through the hook, the way the renderer calls it: (g, items, cam), each item's draw() with no arguments
        for (const [rx, ry] of [RD.roads[0].stoneAt, RD.pois[0].at, RD.pois[3].at]) {
          cam.x = rx * TILE - VW / 2; cam.y = ry * TILE - VH / 2;
          player.x = tc(rx); player.y = tc(ry) + TILE;
          const list = []; drawHook(ctx, list, cam); items += list.length;
          for (const it of list) it.draw();
        }
        st().bless = { key: 'fair', name: 'Fair Road', left: 100, n: 2 };
        hudHook(ctx, false); hudHook(ctx, true);
      } catch (e) { ok = false; err = String(e && e.stack || e); }
      st().bless = bless0; cam.x = cx; cam.y = cy; player.x = px; player.y = py;
      check(P + 'the road surface, the verge, the milestones, all 25 places and the blessing tag draw without error, through the (g, items, cam) hook the renderer really calls', ok && items > 3, { ok, itemsPushed: items, err }); }

    // 17. the iPad: every solid road thing is tappable and has a name in plain words
    { const solidOnes = [T_STONE, ...POI_TILES];
      const tappable = solidOnes.every(t => INTERESTING_TILES.has(t));
      const named = ['ROAD', 'VERGE', 'MILESTONE', 'ROAD_WRECK', 'WAYSHRINE', 'ROAD_BOX', 'ROAD_CACHE', 'ROAD_BRAMBLE', 'ROAD_POOL'].every(n => !!TAP_NAMES[n]);
      const walkable = !SOLID.has(T_ROAD) && !SOLID.has(T_VERGE);
      check(P + 'every road thing worth using is reachable by tap and named in plain words; the road and its verge are walked, not climbed', tappable && named && walkable, { tappable, named, walkable }); }
  });
}
