// ============================================================================
// THE KNOCKING UNDER THE THRONE — King Thrain's royal mine, its giant ores, and the Ginormous Golem
// Cohen, 2026-09-24: "please finish the golom mini game". The owner's design (docs/BACKLOG.md): a story quest
// for the dwarf king, not a fetch; win his favour and he moves his throne aside onto a secret passage into an
// ornate royal mine; giant ores that may give ore OR wake a golem; and the ginormous golem, a skilling boss you
// fight while stopping little golems from healing it.
//
// THE STORY (quest.royalmine, 7 stages). Something knocks under the king's throne: two quick and one slow, a
// miner's "I am here, help me". Hilde tells the turn: under the throne is the Royal Mine, and the knocker is
// Pebble, her little golem, who held the door so everyone else could run from the Ginormous Golem fifty years
// ago. Warm her cold heartstone at a forge, knock the all-clear on the throne (three slow knocks), and Pebble
// knocks it back with one little extra. Thrain gives you the Kingstone off his throne and the throne slides
// aside onto a stair that stays open. The second turn is at the bottom: it was never the throne that held the
// mine shut. It was Pebble, holding the gate for fifty years.
//
// THE MINI-GAME (the Heart Chamber). Swords bounce off the Ginormous Golem. MINE a glowing heartstone vein,
// HEAT the stone at a heart forge, THROW it at him. SMASH the little golems before they reach him (he eats them
// and heals), DODGE the rock shadows, and STAY BACK from his slam. The Giant Hall and the Deep hold giant ores
// (2x2 mithril, 3x3 stormstone) that crack in stages and, sometimes, shake and stand up as a golem.
//
// ONLINE (docs/ONLINE.md, the keeper model). Everything that spawns or moves shared things runs only where
// inCharge() says so (offline, or this map's keeper): the golem's state machine, the little golems, the stir
// roll and the waking, regrowth, splicing, and snapping the rocks to their beds. The vein schedule comes from
// the wall clock (corrected by welcome.at), so every client lights the same two veins without a message.
// Rocks, the slam's damage, your stones, the reward, the quest, the throne and the gate are yours alone.
//
// Feature file. Edits nothing but two lines in src/24-dwarves.js (the dwarf:<id> talkBefore seam and
// DEEPHOLM.drawThrone). Wraps, by reassignment with explicit arguments: hitMonster, playerAttack, rollDrops,
// openPanel, tapAt, load. window.ROYALMINE is the handle for tests and the screenshot rig.
// ============================================================================
{
  const RM = 'royalmine';
  const DH = window.DEEPHOLM || null;

  // =========================================================================
  // 1. THE NUMBERS — every tunable in one block, so it can be tuned after Cohen plays
  // =========================================================================
  const NUM = {
    // the royal seams
    COAL_REGROW: 30, STORM_REGROW: 60,
    // the giant ores
    GIANT: {
      giant_mithril: { size: 2, r: 40, cracks: 6, lv: 20, xp: 40, swing: 2.0, swingMin: 1.0, wakeAt: 2, wakeChance: 1 / 3, regrow: 60, golem: 'mithril_golem', metal: 'mithril', ore: 'mithril_ore' },
      giant_stormstone: { size: 3, r: 62, cracks: 9, lv: 30, xp: 70, swing: 2.2, swingMin: 1.1, wakeAt: 3, wakeChance: 1 / 2, regrow: 90, golem: 'stormstone_golem', metal: 'stormstone', ore: 'stormstone_ore' },
    },
    SWING_STEP: 0.25, MINE_REACH: 60, STIR_PULSE: 1.2, STIR_SETTLE: 45, WAKE_TIME: 2.0, SPLICE: 1.5, HINT_GAP: 4,
    // the Ginormous Golem
    GOLEM_HP: 1000, PER_KNIGHT: 0.6, KNIGHTS_MAX: 4, KID_HP: 0.7, BAR_RANGE: 12,
    WAKE_R: 4, RISE: 0.9, NEAR_R: 3, NEAR_HOLD: 0.8, WINDUP: 1.2, KID_WINDUP: 1.6, SLAM: 0.5, SLAM_R: 3.2, SLAM_DMG: 12, KID_SLAM_DMG: 5, SLAM_KNOCK: 40, SLAM_CD: 4,
    SETTLE: 10, REVIVE: 30, FALL_HOLD: 1.0,
    // the veins, the forge and the throw
    VEIN_WINDOW: 20000, VEIN_TAKE: 4, CARRY: 5, VEIN_XP: 30, VEIN_SWING: 1.4, VEIN_STEP: 0.2, VEIN_MIN: 0.6, PICK_VEIN: 0.5, VEIN_FLASH: 1.0,
    HEAT: 0.8, HEAT_XP: 25,
    THROW_CD: 0.5, FLIGHT: 0.3, FLIGHT_SPEED: 900, DMG: 50, DMG_SMITH: 4, DMG_SMITH_MAX: 25, KID_DMG: 1.25, MELEE_PER_DMG: 2,
    REMOTE_MIN: 40, REMOTE_MAX: 100,
    // the little golems
    LING_FIRST: 10, LING_EVERY: 16, LING_EVERY_HALF: 11, LING_PER_KNIGHT: 0.35, KID_LING: 1.4, LING_MAX: 4, LING_WARN: 0.8,
    LING_SPEED: 42, KID_LING_SPEED: 30, LING_REACH: 70, LING_HEAL: 40, LING_HP: 12, KID_LING_HP: 8,
    // the falling rocks
    ROCK_EVERY: 5.0, ROCK_EVERY_HALF: 3.5, KID_ROCK_EVERY: 8, ROCK_R: 34, ROCK_LEAD: 0.6, ROCK_FALL: 1.4, KID_ROCK_FALL: 2.0, ROCK_DMG: 8, KID_ROCK_DMG: 3, ROCK_EXTRA: 3,
    // what it all pays
    FIGHT_XP: 200, HELP_STONES: 1, HELP_SMASH: 2, PITY: 24, QUEST_XP: 800, QUEST_COINS: 1000, WARM_XP: 60,
    // the story's clocks
    WARM_TIME: 2.0, SLIDE: 2.0, SLIDE_DUST: 0.15, KNOCK_RING: 0.6, ANSWER_PAUSE: 1.5,
  };

  // =========================================================================
  // 2. TILES — eight new ones (the map is a Uint8Array: 207 → 215 of 255, the Cloud Kingdom needs room too)
  // =========================================================================
  const ROYAL_STAIR = addTile('ROYAL_STAIR', { solid: true, tex: 'cave', mini: '#c9a36a' });
  const ROYAL_PILLAR = addTile('ROYAL_PILLAR', { solid: true, tex: 'cobble', mini: '#8a7d62' });
  const ORE_BED = addTile('ORE_BED', { solid: true, tex: 'cobble', mini: '#7a6a4a' });
  const HEART_VEIN = addTile('HEART_VEIN', { solid: true, tex: 'cave', mini: '#8a3a2e' });
  const HEART_FORGE = addTile('HEART_FORGE', { solid: true, tex: 'cobble', mini: '#c0502a' });
  const GOLEM_GATE = addTile('GOLEM_GATE', { solid: true, tex: 'cobble', mini: '#6e6450' });
  const ROYAL_COAL = addTile('ROYAL_COAL', { solid: true, tex: 'cave', mini: '#2f2f35' });
  const ROYAL_STORMSTONE = addTile('ROYAL_STORMSTONE', { solid: true, tex: 'cave', mini: '#6a4a9a' });
  const NEW_TILES = [ROYAL_STAIR, ROYAL_PILLAR, ORE_BED, HEART_VEIN, HEART_FORGE, GOLEM_GATE, ROYAL_COAL, ROYAL_STORMSTONE];
  // every one of them is solid and worth using, so a tap on the iPad walks up to it and presses USE (17-tap)
  for (const t of NEW_TILES) INTERESTING_TILES.add(t);
  // tiles this file borrows from 24-dwarves (ids are only known at load)
  const DW_LAMP = DH ? DH.tiles.lamp : T.WALL, DW_MITHRIL = DH ? DH.tiles.mithril : T.WALL, DW_THRONE = DH ? DH.tiles.throne : T.WALL;

  // the royal seams mine through the core's own GATHER table: its pickaxe gate, level notice, swing timer and
  // regrow are the ones the knight already knows. Stormstone's row is copied at load from 62-ores, so the
  // numbers cannot drift from the stormstone rocks on the Far Shore.
  {
    const stormRow = window.ORES && ORES.BY_KEY && ORES.BY_KEY.stormstone ? GATHER[ORES.BY_KEY.stormstone.tile] : null;
    GATHER[ROYAL_COAL] = Object.assign({}, GATHER[T.COAL], { regrow: NUM.COAL_REGROW, label: 'royal coal seam' });
    if (stormRow) GATHER[ROYAL_STORMSTONE] = Object.assign({}, stormRow, { regrow: NUM.STORM_REGROW, label: 'royal stormstone seam' });
  }

  // =========================================================================
  // 3. THE ROYAL MINE, to scale: one character is one tile (TILE = 48 px), flood-filled from the entry
  //    #  rock (gold trim on every face that touches . = or :)     .  cut-stone hall floor (gold inlay)
  //    ,  the rough floor of the Deep     =  the red and gold royal runner     :  the Heart Chamber floor
  //    ^  the stair up     L  a dwarven lamp     P  a carved pillar     c/s/m  royal coal / stormstone / mithril
  //    M  a giant mithril bed (2x2)     G  a giant stormstone bed (3x3)     O  the golem's seat (2x2)
  //    D  the golem gate     V  a heartstone vein     F  a heart forge     h  a rubble heap (floor)
  //    columns 0-47 left to right, rows 0-41 top to bottom
  // =========================================================================
  const W = 48, H = 42, ENTRY = [23, 3], STAIR_UP = [23, 2], STAIR_DOWN = [14, 23], STAIR_STAND = [14, 22];
  const LAYOUT = [
    '################################################',
    '################################################',
    '#######################^########################',
    '###Lc...c...c..L##L....==....L##L...........L###',
    '###...........s.##.....==.....##.............###',
    '###......P......##..P..==..P..##..MM....MM...###',
    '###m...................==.........MM....MM...###',
    '###....m...m...........==....................###',
    '###....................==.............P......###',
    '###m.....P......##..P..==..P..##.............###',
    '###...s...s.....##.....==.....##..MM....MM...###',
    '###.............##.....==.....##..MM....MM...###',
    '###Lc...c...c..L##L....==....L##.............###',
    '#######################==#######L...........L###',
    '#######################==#######################',
    '#####L,,,,,,,,m,,,,,L,,==,,L,,,,,m,,,,,,,,L#####',
    '#####,,,,,,,,,,,,,,,,,,==,,,,,,,,,,,,,,,,,,#####',
    '#####,,,,GGG,,,,,P,,,,,==,,,,,P,,,,,GGG,,,,#####',
    '#####,,,,GGG,,,,,,,,,,,==,,,,,,,,,,,GGG,,,,#####',
    '#####,,,,GGG,,,,,,,,,,,==,,,,,,,,,,,GGG,,,,#####',
    '#####,,,,,,,,,,,,P,,,,,==,,,,,P,,,,,,,,,,,,#####',
    '#####,,m,,,,,,,,,,,,,,,==,,,,,,,,,,,,,,,m,,#####',
    '#####L,,,,,,,,,,,,,,,,,==,,,,,,,,,,,,,,,,,L#####',
    '######################DDDD######################',
    '######################::::######################',
    '######################::::######################',
    '##################V::::::::::V##################',
    '################L::::::::::::::L################',
    '##############V:h::::::::::::::h:V##############',
    '##############::::::::::::::::::::##############',
    '#############::::::::::::::::::::::#############',
    '#############::::::::::::::::::::::#############',
    '############F::::::::::OO::::::::::F############',
    '#############::::::::::OO::::::::::#############',
    '#############::::::::::::::::::::::#############',
    '#############::::::::::::::::::::::#############',
    '##############::::::::::::::::::::##############',
    '##############V:h::::::::::::::h:V##############',
    '################L::::::::::::::L################',
    '###################::::::::::###################',
    '###################V########V###################',
    '################################################',
  ];
  const LEGEND = {
    '#': T.WALL, '.': T.COBBLE, ',': T.CAVE, '=': T.RUG, ':': T.COBBLE, h: T.COBBLE, '^': ROYAL_STAIR, L: DW_LAMP, P: ROYAL_PILLAR,
    c: ROYAL_COAL, s: ROYAL_STORMSTONE, m: DW_MITHRIL, M: ORE_BED, G: ORE_BED, O: ORE_BED, D: GOLEM_GATE, V: HEART_VEIN, F: HEART_FORGE,
  };
  const charAt = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? LAYOUT[y][x] : '#';
  // the rooms, for the light, the chip and "in the chamber"
  const RECTS = {
    hall: { name: 'Hall of Kings', x0: 18, y0: 3, x1: 29, y1: 12 },
    seams: { name: 'The Royal Seams', x0: 3, y0: 3, x1: 15, y1: 12 },
    giant: { name: 'The Giant Hall', x0: 32, y0: 3, x1: 44, y1: 13 },
    deep: { name: 'The Deep', x0: 5, y0: 15, x1: 42, y1: 22 },
    chamber: { name: 'The Heart Chamber', x0: 12, y0: 24, x1: 35, y1: 40 },
  };
  const WEST = [[18, 26], [14, 28], [14, 37], [19, 40]], EAST = [[29, 26], [33, 28], [33, 37], [28, 40]];
  const VEINS = WEST.concat(EAST);
  const FORGES = [[12, 32], [35, 32]];
  const HEAPS = [[16, 28], [31, 28], [16, 37], [31, 37]];
  const GATE = [[22, 23], [23, 23], [24, 23], [25, 23]];
  const SEAT = [23, 32], SEAT_C = { x: 24 * TILE, y: 33 * TILE };
  const PEBBLE_MINE = [21, 22], PEBBLE_HOME = [9, 21];
  // the instance's spawn list, in the fixed order 75-coop tags i0..i6
  const SPAWNS = [['ginormous_golem', 23, 31], ['giant_mithril', 34, 7], ['giant_mithril', 40, 7], ['giant_mithril', 34, 12], ['giant_mithril', 40, 12], ['giant_stormstone', 10, 20], ['giant_stormstone', 37, 20]];
  // the giant ores' beds (top-left corners) and their centres; an ore stands on its bed's exact centre
  const GIANTS = [[34, 5], [40, 5], [34, 10], [40, 10], [9, 17], [36, 17]].map(([x, y], k) => {
    const type = k < 4 ? 'giant_mithril' : 'giant_stormstone', size = NUM.GIANT[type].size;
    return { i: k + 1, nid: 'i' + (k + 1), type, bed: [x, y], size, c: { x: (x + size / 2) * TILE, y: (y + size / 2) * TILE } };
  });
  const bedOf = (tx, ty) => GIANTS.find(b => tx >= b.bed[0] && tx < b.bed[0] + b.size && ty >= b.bed[1] && ty < b.bed[1] + b.size) || null;
  const onSeat = (tx, ty) => tx >= SEAT[0] && tx <= SEAT[0] + 1 && ty >= SEAT[1] && ty <= SEAT[1] + 1;
  const isHeap = (tx, ty) => HEAPS.some(([x, y]) => x === tx && y === ty);
  const isVein = (tx, ty) => VEINS.some(([x, y]) => x === tx && y === ty);
  const inRectT = (r, tx, ty) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;
  const inChamberT = (tx, ty) => ty >= 26 && inRectT(RECTS.chamber, tx, ty);
  const inChamberPx = (x, y) => inChamberT(Math.floor(x / TILE), Math.floor(y / TILE));
  const roomAt = (tx, ty) => { for (const k of ['chamber', 'hall', 'seams', 'giant', 'deep']) if (inRectT(RECTS[k], tx, ty)) return RECTS[k]; return null; };

  // build(set, rnd) keeps its OWN grid: the setter writes the instance's tile array, which is not the live map
  // (tileAt inside a builder reads the overworld). rnd only picks decoration; it never decides a tile, and
  // Math.random is never touched, so every client builds the same mine.
  let lastDecor = null, DECOR = new Uint8Array(W * H);
  function build(set, rnd) {
    const grid = new Uint8Array(W * H), decor = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = LEGEND[LAYOUT[y][x]], v = t === undefined ? T.WALL : t;
      grid[y * W + x] = v; set(x, y, v);
      decor[y * W + x] = typeof rnd === 'function' ? Math.floor(rnd() * 4) : 0;
    }
    lastDecor = decor;
    return grid;
  }
  if (window.INSTANCES && DH) {
    INSTANCES.define(RM, {
      name: 'The Royal Mine', sub: "Under King Thrain's throne", w: W, h: H, entry: ENTRY, exit: null, dark: false, step: DH.SHAFT_STEP,
      spawns: SPAWNS, build, voice: 'The Royal Mine. Gold on the walls, and the lamps are still burning. Somebody has kept them lit.',
    });
    if (lastDecor) DECOR = lastDecor;
    // define() stamps the entry tile as cave floor; the royal runner goes right up to the stair
    const inst = INSTANCES.get(RM); if (inst) inst.tiles[ENTRY[1] * W + ENTRY[0]] = T.RUG;
  }
  const inMine = () => !!(window.INSTANCES && INSTANCES.active() === RM);
  const inDeep = () => !!(window.INSTANCES && DH && INSTANCES.active() === DH.ID);

  // =========================================================================
  // 4. ITEMS — two keys for the keyring, and two rare uniques from the golem
  // =========================================================================
  Object.assign(ITEMS, {
    hildes_heartstone: { name: "Hilde's heartstone", value: 0, color: '#8a2a1e', shape: 'rock' },
    kingstone: { name: 'The Kingstone', value: 0, color: '#9fc0e8', shape: 'rock' },
    heartstone_pickaxe: { name: 'Heartstone pickaxe', value: 3000, color: '#e0583c', shape: 'pickaxe', tool: 'pickaxe', tier: 3 },
    stoneheart_helm: { name: 'Stoneheart helm', value: 3000, color: '#8a8275', shape: 'helm', armour: { slot: 'helm', def: 24 } },
  });
  for (const id of ['hildes_heartstone', 'kingstone', 'heartstone_pickaxe', 'stoneheart_helm']) { ITEMS[id].id = id; ITEMS[id].stack = 1; }
  if (window.KEYRING) {
    KEYRING.register('hildes_heartstone', "Hilde's. The last heartstone in Deepholm. Cold for fifty years.");
    KEYRING.register('kingstone', "King Thrain's. The mithril stone from the top of his throne. The throne moves for whoever holds it.");
  }
  const hasHeartPick = () => countItem('heartstone_pickaxe') > 0 || player.equip.weapon === 'heartstone_pickaxe';
  if (window.ICONS) {
    // a dull red stone, wrapped in a scrap of blue apron cloth
    ICONS.set('hildes_heartstone', (g, size, item) => {
      g.fillStyle = '#4a140e'; g.beginPath(); g.moveTo(-6.4, 3); g.lineTo(-7.2, -2); g.lineTo(-3.2, -7.4); g.lineTo(3.8, -7.4); g.lineTo(7.2, -2); g.lineTo(5.6, 3); g.closePath(); g.fill();
      g.fillStyle = item.color; g.beginPath(); g.moveTo(-5.2, 2); g.lineTo(-5.8, -2); g.lineTo(-2.6, -6); g.lineTo(3, -6); g.lineTo(5.8, -2); g.lineTo(4.4, 2); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,170,140,0.35)'; g.beginPath(); g.moveTo(-3.8, -2.4); g.lineTo(-1.8, -5); g.lineTo(1.4, -5); g.lineTo(-1, -2); g.closePath(); g.fill();
      g.fillStyle = '#3a5f9a'; g.beginPath(); g.moveTo(-8.2, 0); g.quadraticCurveTo(0, 3.2, 8.2, 0); g.lineTo(7.2, 7); g.quadraticCurveTo(0, 9, -7.2, 7); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#26406a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-5, 3); g.lineTo(-4.2, 7.2); g.moveTo(0, 3.4); g.lineTo(0, 8.2); g.moveTo(5, 3); g.lineTo(4.2, 7.2); g.stroke();
      g.fillStyle = '#4c78bd'; g.beginPath(); g.ellipse(6.6, 1, 2.4, 2, 0.4, 0, 7); g.fill();
    });
    // a faceted mithril stud in a gold collar with four claws
    ICONS.set('kingstone', (g, size, item) => {
      g.fillStyle = '#9a6e1e'; g.beginPath(); g.arc(0, 0, 8.6, 0, 7); g.fill();
      g.fillStyle = '#f5c542'; g.beginPath(); g.arc(0, 0, 7.4, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#9a6e1e'; for (const [x, y] of [[-5.3, -5.3], [5.3, -5.3], [-5.3, 5.3], [5.3, 5.3]]) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
      g.fillStyle = item.color; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; g.lineTo(Math.cos(a) * 5.4, Math.sin(a) * 5.4); } g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e2eefc'; g.beginPath(); g.moveTo(0, -5); g.lineTo(-3.6, -1.4); g.lineTo(0, 0); g.lineTo(3.6, -1.4); g.closePath(); g.fill();
      g.fillStyle = '#5a7aa8'; g.beginPath(); g.moveTo(0, 5); g.lineTo(-3.6, 1.4); g.lineTo(0, 0); g.lineTo(3.6, 1.4); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-1.4, -2.6, 1, 0, 7); g.fill();
    });
    // a pick whose head is a glowing red crystal, on a dark-iron haft bound in gold
    ICONS.set('heartstone_pickaxe', (g, size, item) => {
      g.save(); g.rotate(-0.35);
      g.fillStyle = '#2e2f36'; g.fillRect(-1.5, -5.4, 3, 14.4); g.fillStyle = '#f5c542'; g.fillRect(-2, 2.6, 4, 2); g.fillRect(-2, 6.4, 4, 2);
      g.fillStyle = 'rgba(255,120,70,0.35)'; g.beginPath(); g.ellipse(0, -5.6, 8.6, 3.8, 0, 0, 7); g.fill();
      g.fillStyle = item.color; g.beginPath(); g.moveTo(0, -8.6); g.lineTo(-9, -4.4); g.lineTo(-7.2, -2.6); g.lineTo(-2, -4.6); g.lineTo(0, -3.4); g.lineTo(2, -4.6); g.lineTo(7.2, -2.6); g.lineTo(9, -4.4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#ffc08a'; g.beginPath(); g.moveTo(0, -8); g.lineTo(-5, -5.6); g.lineTo(-2, -5.2); g.closePath(); g.fill();
      g.fillStyle = '#7a1e12'; g.beginPath(); g.moveTo(0, -8); g.lineTo(5, -5.6); g.lineTo(2, -5.2); g.closePath(); g.fill();
      g.restore();
    });
    // a helm cut from a boulder, gold-riveted, with one small glowing crack
    ICONS.set('stoneheart_helm', (g, size, item) => {
      g.fillStyle = '#5f594f'; g.beginPath(); g.moveTo(-8.6, 5); g.quadraticCurveTo(-9, -7.6, 0, -8.4); g.quadraticCurveTo(9, -7.6, 8.6, 5); g.closePath(); g.fill();
      g.fillStyle = item.color; g.beginPath(); g.moveTo(-7.4, 4); g.quadraticCurveTo(-7.8, -6.4, 0, -7.2); g.quadraticCurveTo(7.8, -6.4, 7.4, 4); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,245,225,0.22)'; g.beginPath(); g.ellipse(-3.4, -4, 2.6, 1.6, -0.4, 0, 7); g.fill();
      g.fillStyle = '#4a453d'; g.fillRect(-8.8, 3.4, 17.6, 3.2); g.fillRect(-8.2, 6.4, 3, 2.6); g.fillRect(5.2, 6.4, 3, 2.6);
      g.fillStyle = '#f5c542'; for (const x of [-5.6, 0, 5.6]) { g.beginPath(); g.arc(x, 5, 1.1, 0, 7); g.fill(); }
      g.strokeStyle = '#ff6a3a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(1.4, -6.6); g.lineTo(2.8, -3.4); g.lineTo(1.2, -1.2); g.lineTo(3, 1.6); g.stroke();
      g.strokeStyle = '#ffd08a'; g.lineWidth = 1; g.stroke();
    });
  }

  // =========================================================================
  // 5. MONSTERS — two giant ores, two woken golems, the little golems and the Ginormous Golem
  // Every one has respawn 1e9: nothing here comes back on the core's timer (the keeper regrows and revives).
  // =========================================================================
  Object.assign(MONSTER_DEFS, {
    giant_mithril: { name: 'Giant mithril ore', level: 20, r: 40, hp: 6, att: 0, maxHit: 0, def: 1, speed: 0, aggro: false, harmless: true, sight: 0, respawn: 1e9,
      drops: { always: [['mithril_ore', 5, 7], ['coal', 2, 3]] } },
    giant_stormstone: { name: 'Giant stormstone ore', level: 30, r: 62, hp: 9, att: 0, maxHit: 0, def: 1, speed: 0, aggro: false, harmless: true, sight: 0, respawn: 1e9,
      drops: { always: [['stormstone_ore', 6, 8], ['coal', 3, 4]] } },
    mithril_golem: { name: 'Mithril golem', level: 30, r: 26, hp: 180, att: 32, maxHit: 11, def: 28, speed: 70, aggro: true, sight: 7 * TILE, respawn: 1e9,
      drops: { always: [['mithril_ore', 3, 5], ['coal', 2, 4]], table: [['mithril_bar', 1, 2, 40], ['iron_bar', 2, 4, 30], ['blackiron_bar', 1, 2, 20], ['nothing', 0, 0, 10]],
        rare: { chance: 20, table: [['sunstone_bar', 2, 2, 1]] } } },
    stormstone_golem: { name: 'Stormstone golem', level: 42, r: 36, hp: 360, att: 44, maxHit: 16, def: 40, speed: 58, aggro: true, sight: 7 * TILE, respawn: 1e9,
      drops: { always: [['stormstone_ore', 4, 6], ['coal', 4, 6]], table: [['stormstone_bar', 1, 2, 35], ['mithril_bar', 2, 3, 35], ['sunstone_bar', 1, 2, 20], ['nothing', 0, 0, 10]],
        rare: { chance: 25, table: [['stormstone_bar', 3, 4, 1]] } } },
    golemling: { name: 'Little golem', level: 8, r: 12, hp: NUM.LING_HP, att: 0, maxHit: 0, def: 1, speed: 0, aggro: false, harmless: true, sight: 0, respawn: 1e9, drops: {} },
    ginormous_golem: { name: 'Ginormous Golem', level: 50, r: 50, hp: NUM.GOLEM_HP, att: 0, maxHit: 0, def: 300, speed: 0, aggro: false, harmless: true, sight: 0, respawn: 1e9,
      drops: { always: [['coins', 150, 300], ['mithril_bar', 2, 3], ['coal', 8, 12]],
        table: [['sunstone_bar', 2, 3, 25], ['blackiron_bar', 3, 4, 25], ['stormstone_bar', 1, 2, 20], ['mithril_ore', 5, 8, 20], ['stormstone_ore', 4, 6, 10]],
        rare: { chance: 12, table: [['heartstone_pickaxe', 1, 1, 3], ['stoneheart_helm', 1, 1, 1]] } } },
  });
  const GIANT_TYPES = new Set(['giant_mithril', 'giant_stormstone']);
  const WOKEN = new Set(['mithril_golem', 'stormstone_golem']);
  // a monster shaped the way 75-coop's makeReal makes one, so a keeper handoff treats ours like any other
  function makeMon(type, x, y) {
    const d = MONSTER_DEFS[type];
    return { type, x, y, home: { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: !!d.aggro, state: 'idle', wanderT: 99, wander: { x: 0, y: 0 },
      attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 1e9, facing: { x: 0, y: 1 }, walkT: 0, moving: false, stunT: 0 };
  }

  // =========================================================================
  // 6. THE QUEST — "The Knocking Under the Throne"
  // quest.royalmine is plain JSON, saved with everything else and reset on a new game.
  // =========================================================================
  QUEST_DEFS.royalmine = { name: 'The Knocking Under the Throne' };
  const freshQuest = () => ({ stage: 0, fights: 0, best: 0, dry: 0, gotPick: false, told: {} });
  const R = () => {
    let q = quest.royalmine;
    if (!q || typeof q !== 'object') q = quest.royalmine = freshQuest();
    if (typeof q.stage !== 'number') q.stage = 0;
    if (!q.told || typeof q.told !== 'object') q.told = {};
    for (const k of ['fights', 'best', 'dry']) if (typeof q[k] !== 'number') q[k] = 0;
    return q;
  };
  const dwarfStage = () => (quest.dwarf && quest.dwarf.stage) || 0;
  const QTEXT = [
    'King Thrain in Deepholm cannot sleep. Go and see him on his throne.',
    "King Thrain heard a miner's knock under his throne: I am here, help me. Ask Hilde in the throne hall what is down there.",
    "Warm Hilde's cold heartstone at a forge. The great forge hall in Deepholm has two.",
    "Take the warm heartstone to King Thrain's throne and knock the all-clear: three slow knocks.",
    'Go down the stair where the throne stood. Find Pebble at the bottom of the Royal Mine.',
    'Beat the Ginormous Golem in the Heart Chamber. Swords bounce off: mine a glowing vein, heat it at a forge, throw it. Smash the little golems.',
    'The golem is down and Pebble is free. Go back up and tell King Thrain.',
  ];
  HOOKS.questText.royalmine = () => { const s = R().stage; return s <= 6 ? QTEXT[s] : 'Done.'; };
  HOOKS.activeQuests.push(() => dwarfStage() >= 2 && R().stage <= 6 ? ['royalmine'] : []);
  // on the overworld only: the Deepholm shaft at Grey Quarry
  HOOKS.mapTarget.push(() => (window.INSTANCES && INSTANCES.active()) || dwarfStage() < 2 || R().stage > 6 ? null
    : { x: DH ? DH.SHAFT.x : 56, y: DH ? DH.SHAFT.y : 6, label: 'Deepholm: King Thrain', id: 'royalmine' });
  function setStage(s) {
    const q = R(); if (s <= q.stage) return;
    q.stage = s;
    if (s <= 6 && !quest.untrackedByPlayer) quest.tracked = 'royalmine';
    save();
  }
  const told = key => { const t = R().told; if (t[key]) return true; t[key] = true; return false; };

  // =========================================================================
  // 7. SMALL HELPERS — who is in charge, the wall clock, the veins
  // =========================================================================
  const kid = () => !!window.__kidmode;
  const online = () => !!(window.NET && NET.online());
  // the keeper model: offline you run everything; online only the map's keeper spawns or moves shared things
  const inCharge = () => !window.NET || !NET.online() || !!(window.COOP && COOP.isKeeper());
  const remotes = () => { if (!online() || !window.COOP || !COOP.knightsHere) return []; try { return COOP.knightsHere().filter(k => !k.dead); } catch (e) { return []; } };
  const touch = () => typeof touchMode === 'function' && touchMode();
  const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const setLive = (tx, ty, t) => { if (tileAt(tx, ty) !== t) changeTile(tx, ty, t); };
  // a stable 0..1 per (a, b, c), for scattering drawn details the same way every frame
  const hh = (a, b, c) => { let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(((b | 0) + 0x632be5ab) ^ ((c | 0) * 977), 0xc2b2ae35); h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const voice = text => say(text, 'The Voice');

  // the wall clock every client reads the same (corrected by the world's welcome.at), so the veins agree
  let skew = 0, clockFn = null;
  const clock = () => clockFn ? clockFn() : Date.now() + skew;
  if (window.NET && NET.on) NET.on('welcome', m => { skew = m && typeof m.at === 'number' && Number.isFinite(m.at) ? clamp(m.at - Date.now(), -864e5, 864e5) : 0; });
  // every 20 s window lights one west vein and one east vein
  function litVeins(ms) {
    const w = Math.floor(ms / NUM.VEIN_WINDOW);
    const r = mulberry32((Math.imul(w, 2654435761) ^ 0x4ea27) >>> 0);
    return [WEST[Math.floor(r() * 4)], EAST[Math.floor(r() * 4)]];
  }
  const veinLit = (tx, ty, ms) => litVeins(ms).some(([x, y]) => x === tx && y === ty);

  // the golem and the rocks, wherever they are (a real monster, or the keeper's puppet of one)
  const AWAKE = new Set(['rise', 'fight', 'windup', 'slam']);
  const golemMon = () => { for (const m of monsters) if (m.type === 'ginormous_golem' && !m.gone) return m; return null; };
  const isAwake = m => !!m && !m.dead && AWAKE.has(m.state);
  const golemAwake = () => isAwake(golemMon());
  const giantMon = b => { for (const m of monsters) if (m.type === b.type && !m.gone && (m.nid === b.nid || (Math.abs(m.x - b.c.x) < 12 && Math.abs(m.y - b.c.y) < 12))) return m; return null; };
  const bedOfMon = m => GIANTS.find(b => b.type === m.type && (m.nid === b.nid || (Math.abs(m.x - b.c.x) < 12 && Math.abs(m.y - b.c.y) < 12))) || null;
  const lings = () => monsters.filter(m => m.type === 'golemling' && !m.dead && !m.gone);

  // the knight's run in the mine: never saved, and gone the moment he is anywhere else
  const run = {
    raw: 0, hot: 0, guest: false, throwCd: 0, stones: [], rocks: [], debris: [], rockT: 3, lastX: 0, lastY: 0, vx: 0, vy: 0,
    quota: {}, clangT: -99, hintT: -99, inChamber: false, lastRockDmg: 0, lastSlamDmg: 0, hitFlash: -99, mendFlash: -99, pendingBanner: null,
    // this life of the golem, as this client saw it
    life: { landed: 0, smashed: 0, start: null, deadSince: null, paid: false, half: false, fallen: false, lastHp: null, lastState: null, lastDead: null, windupAt: null },
    ores: {},   // nid → the last state this client saw, for the stir / settle / wake edges
  };
  const resetLife = () => Object.assign(run.life, { landed: 0, smashed: 0, start: null, deadSince: null, paid: false, half: false, fallen: false, windupAt: null });
  function crumble(quiet) {
    if (run.raw + run.hot > 0) {
      run.raw = 0; run.hot = 0;
      if (!quiet) notify('Your heartstones go cold and crumble to sand. They only burn down here.');
    }
  }

  // =========================================================================
  // 8. THE STORYTELLER — long speeches fed to the dialogue a line at a time, with acts at the right line
  // say() queues at most eight lines and Hilde's story is sixteen, so a speech waits here and is handed over
  // one line ahead of the box. An act runs when the line before it is on screen (or, with after: 'done', once
  // the box is empty); a wait counts seconds after the box is empty.
  // =========================================================================
  const seq = { steps: [], last: null };
  const line = (who, text) => ({ who, text });
  const act = (fn, after) => ({ act: fn, after: after || 'shown' });
  const seqBusy = () => seq.steps.length > 0;
  function play(...steps) { for (const s of steps) seq.steps.push(s); }
  function seqTick(dt) {
    for (let guard = 0; guard < 40 && seq.steps.length; guard++) {
      const s = seq.steps[0];
      if (s.text !== undefined) {
        if (dialog.queue.length) return;
        const n0 = dialog.queue.length; say(s.text, s.who);
        seq.last = dialog.queue.length > n0 ? dialog.queue[dialog.queue.length - 1] : null;
        seq.steps.shift(); continue;
      }
      const gone = !seq.last || (dialog.cur !== seq.last && !dialog.queue.includes(seq.last));
      const shown = gone || dialog.cur === seq.last, empty = !dialog.cur && !dialog.queue.length;
      if (s.act) { if (s.after === 'done' ? !empty : !shown) return; seq.steps.shift(); s.act(); continue; }
      if (s.wait !== undefined) { if (!empty) return; s.t = (s.t || 0) + dt; if (s.t < s.wait) return; seq.steps.shift(); continue; }
      seq.steps.shift();
    }
  }
  const seqClear = () => { seq.steps.length = 0; seq.last = null; };

  // =========================================================================
  // 9. KNOCKS — played on the throne (or by the knight, or by Pebble), and the knight held still to listen
  // =========================================================================
  const PATTERNS = { miner: [0, 0.25, 1.1], slow: [0, 0.8, 1.6], quick: [0, 0.25, 0.5] };
  const kp = { list: [], t: 0, done: null };
  // each entry: { t, kind: 'big' (the throne), 'small' (one little tap), 'mine' (the knight), 'pebble' }
  function playKnocks(list, done) { kp.list = list.map(k => Object.assign({ fired: false }, k)); kp.t = 0; kp.done = done || null; }
  const throneAt = () => ({ x: DH && tileAt(16, 23) === DW_THRONE && tileAt(14, 23) !== DW_THRONE ? tc(16) : tc(14), y: tc(23) });
  function knockFx(k) {
    const at = k.at || (k.kind === 'mine' ? { x: player.x, y: player.y } : throneAt());
    if (k.kind === 'small') { floatText(at.x, at.y - 22, 'tap', '#f3e3b8', 13); burst(at.x, at.y + 6, '#b8ad96', 5, 30); sfx('ui'); return; }
    if (k.kind === 'mine') { floatText(at.x, at.y - 40, 'knock', '#f3e3b8', 15); burst(at.x + player.facing.x * 16, at.y + player.facing.y * 16, '#b8ad96', 5, 40); sfx('hit'); return; }
    for (let j = 0; j < 3; j++) burst(at.x + rint(-14, 14), at.y + 10, j % 2 ? '#9a927f' : '#c8bda4', 6, 55);
    floatText(at.x, at.y - 34, 'KNOCK', '#ffe3a0', k.kind === 'pebble' ? 18 : 24);
    if (window.IMPACT) IMPACT.wave(at.x, at.y, 0.4);
    sfx('hit');
  }
  function knockTick(dt) {
    if (!kp.list.length) return;
    kp.t += dt;
    for (const k of kp.list) if (!k.fired && kp.t >= k.t) { k.fired = true; knockFx(k); }
    const end = kp.list[kp.list.length - 1].t + 0.45;
    if (kp.t >= end) { const d = kp.done; kp.list = []; kp.done = null; if (d) d(); }
  }
  const twice = PATTERNS.miner.map(t => ({ t, kind: 'big' })).concat(PATTERNS.miner.map(t => ({ t: t + PATTERNS.miner[2] + 1.4, kind: 'big' })));

  // 'rm_watch': the knight stands still while something plays out (the listening, the throne sliding)
  const hold = { on: false, x: 0, y: 0, t: 0, inst: null };
  function watch(secs) {
    hold.on = true; hold.x = player.x; hold.y = player.y; hold.t = secs; hold.inst = window.INSTANCES ? INSTANCES.active() : null;
    player.action = { type: 'rm_watch', t: 0, need: 0 };
    if (typeof tapCancel === 'function') tapCancel('manual');
  }
  function holdTick(dt) {
    if (!hold.on) return;
    hold.t -= dt;
    const here = window.INSTANCES ? INSTANCES.active() : null;
    if (hold.t <= 0 || player.dead || here !== hold.inst) { hold.on = false; if (player.action && player.action.type === 'rm_watch') player.action = null; return; }
    player.x = hold.x; player.y = hold.y; player.moving = false;
    if (!player.action || player.action.type !== 'rm_watch') player.action = { type: 'rm_watch', t: 0, need: 0 };
  }

  // =========================================================================
  // 10. DEEPHOLM — the throne, the stair, and King Thrain, re-applied from the quest every tick
  // The template (DEEPHOLM.set) follows the saved stage only, so the next entry shows it at once; the live map
  // (changeTile inside an instance never reaches mapDiffs) also opens for a guest's visit. At stage 0, which is
  // what a fresh game has, Deepholm is exactly what 24-dwarves builds.
  // =========================================================================
  const thrain = () => DH ? DH.DWARVES.find(d => d.id === 'thrain') : null;
  const slide = { on: false, t: 0, dust: 0 };
  function syncDeepholm() {
    if (!DH || !window.INSTANCES) return;
    const q = R(), openT = q.stage >= 4, openL = openT || run.guest, inside = inDeep();
    const want = open => [[14, 23, open ? ROYAL_STAIR : DW_THRONE], [15, 23, T.CAVE], [16, 23, open ? DW_THRONE : T.CAVE]];
    for (const [x, y, t] of want(openT)) if (DH.at(x, y) !== t) DH.set(x, y, t);
    if (inside) {
      if (slide.on) { setLive(14, 23, ROYAL_STAIR); setLive(16, 23, T.CAVE); }
      else for (const [x, y, t] of want(openL)) setLive(x, y, t);
    }
    const th = thrain();
    if (th) {
      if (slide.on && inside) { const k = ease(slide.t / NUM.SLIDE); th.px = tc(14 + 2 * k); th.py = tc(23); }
      else { const x = (inside ? openL : openT) ? 16 : 14; th.x = x; th.y = 23; th.px = tc(x); th.py = tc(23); }
    }
  }
  if (HOOKS.world) HOOKS.world.push(() => syncDeepholm());
  function startSlide() {
    if (!inDeep() || slide.on) return false;
    if (tileAt(14, 23) === ROYAL_STAIR && tileAt(16, 23) === DW_THRONE) return false;
    slide.on = true; slide.t = 0; slide.dust = 0;
    if (Math.floor(player.y / TILE) === 23) { player.x = tc(14); player.y = tc(21); }
    watch(NUM.SLIDE + 0.1);
    setLive(14, 23, ROYAL_STAIR); setLive(16, 23, T.CAVE);
    if (window.IMPACT) IMPACT.wave(tc(15), tc(23), 1.2);
    sfx('open'); floatText(tc(15), tc(23) - 40, 'GRRRIND', '#e8cf9a', 17);
    return true;
  }
  function finishSlide(quiet) {
    if (!slide.on) return;
    slide.on = false; slide.t = 0;
    const th = thrain(); if (th) { th.x = 16; th.px = tc(16); th.py = tc(23); }
    if (!inDeep()) return;
    setLive(16, 23, DW_THRONE);
    // nobody stays inside the throne's new tile
    if (collides(player.x, player.y, player.r, 'player')) { const s = safeSpot(player.x, player.y, player.r, 'player'); if (s) { player.x = s.x; player.y = s.y; } }
    if (window.IMPACT) IMPACT.wave(tc(16), tc(23), 0.8);
    burst(tc(14), tc(23), '#ffe9b0', 18, 90);
    if (!quiet) { levelBanner = { text: 'THE ROYAL MINE', sub: 'The throne has moved', t: 4 }; sfx('quest'); }
  }
  function slideTick(dt) {
    if (!slide.on) return;
    if (!inDeep()) { finishSlide(true); return; }
    slide.t += dt; slide.dust -= dt;
    if (slide.dust <= 0) {
      slide.dust = NUM.SLIDE_DUST;
      const x = tc(14 + 2 * ease(slide.t / NUM.SLIDE)) - 20;
      for (let j = 0; j < 4; j++) particles.push({ x: x + rint(-8, 8), y: tc(23) + rint(6, 18), vx: rint(-40, -8), vy: rint(-30, 5), t: 0.5 + Math.random() * 0.4, color: j % 2 ? '#9a927f' : '#c8bda4', r: 2 + Math.random() * 2 });
    }
    if (slide.t >= NUM.SLIDE) finishSlide(false);
  }

  // the roster: a friend on the map 'royalmine' opens the stair for this visit (the guest pass)
  let roster = [];
  if (window.NET && NET.on) NET.on('who', m => { roster = m && Array.isArray(m.list) ? m.list.filter(o => o && typeof o.n === 'string') : []; });
  const friendBelow = () => online() ? roster.find(o => o.map === RM && o.n !== NET.me) || null : null;

  // =========================================================================
  // 11. THE TALKS — through the dwarf:<id> seam in 24-dwarves (E and a tap both go through dwTalk).
  // Each returns false unless this quest has a line, so "The King Under the Quarry" and Brunhild's shop run
  // exactly as they always did.
  // =========================================================================
  const THRAIN = 'King Thrain', HILDE = 'Hilde', PEBBLE = 'Pebble', VOICE = 'The Voice';
  const busy = () => seqBusy() || kp.list.length > 0 || hold.on || slide.on;
  HOOKS.talkBefore['dwarf:thrain'] = d => {
    const q = R();
    // the guest pass: a friend is down in the mine, so the king lets you follow them for this visit
    if (q.stage < 4 && !run.guest) {
      const f = friendBelow();
      if (f) { say(`Your friend ${f.n} is down in my mine. Go on, then. The stair is open for you while they are below.`, THRAIN); run.guest = true; startSlide(); return true; }
    }
    if (dwarfStage() < 2) return false;
    if (q.stage === 0) {
      if (busy()) return true;
      if (told('listened')) play(line(THRAIN, 'Listen again, knight.'), act(startListen, 'done'));
      else play(line(THRAIN, 'Knight. Since you lit the great forge, I have not slept.'),
        line(THRAIN, 'Every night something knocks under my throne. Under it, where there is only rock.'),
        line(THRAIN, 'You have young ears. Stand still, be quiet, and listen.'), act(startListen, 'done'));
      return true;
    }
    if (q.stage === 1 || q.stage === 2) { say('Ask Hilde. Please.', THRAIN); return true; }
    if (q.stage === 3) {
      if (busy()) return true;
      play(line(THRAIN, 'It glows. I had forgotten that colour.'), line(THRAIN, 'Hilde told you the all-clear? Then knock it. Three slow knocks, like a big clock.'), act(openKnock, 'done'));
      return true;
    }
    if (q.stage === 4 || q.stage === 5) { say('The stair is right there, knight. Pebble is waiting.', THRAIN); return true; }
    if (q.stage === 6) { theEnd(); return true; }
    if (Math.random() < 0.5) { say('I sleep at night now. Hilde says I snore. Let her.', THRAIN); return true; }
    return false;
  };
  HOOKS.talkBefore['dwarf:hilde'] = d => {
    if (dwarfStage() < 2) return false;
    const q = R();
    if (q.stage === 1) { if (!busy()) hildeStory(); return true; }
    if (q.stage === 2) { say('Warm the stone first. The great forge hall has two forges.', HILDE); return true; }
    if (q.stage === 3) { say('It glows! Now the throne. Three slow knocks.', HILDE); return true; }
    if (q.stage >= 6 && !q.told.hildeDoor) { q.told.hildeDoor = true; say('You silly stone. You held that door the whole time?', HILDE); save(); return true; }
    if (q.stage >= 7 && Math.random() < 0.5) { say('Pebble has not left my side since you brought him up. Heavy little thing.', HILDE); return true; }
    return false;
  };
  for (const [id, text] of [['orik', 'Heartstone needs no coal. It burns by itself. I am still not used to it.'], ['dagny', 'The king sleeps at night now. The whole city can hear him.']]) {
    HOOKS.talkBefore['dwarf:' + id] = d => { if (dwarfStage() >= 2 && R().stage >= 7 && Math.random() < 0.5) { say(text, d.name); return true; } return false; };
  }

  // ---------- stage 0: listen to the knock and pick the rhythm you heard ----------
  function startListen() {
    if (!inDeep()) return;
    watch(twice[twice.length - 1].t + 0.6);
    playKnocks(twice, () => { if (inDeep() && R().stage === 0) openPanel('rm_listen'); });
  }
  function answerListen(k) {
    closePanel();
    if (R().stage !== 0) return;
    const pat = k === 1 ? PATTERNS.miner : k === 2 ? PATTERNS.slow : PATTERNS.quick;
    watch(pat[pat.length - 1] + 0.6);
    playKnocks(pat.map(t => ({ t, kind: 'mine' })), () => {
      if (R().stage !== 0) return;
      if (k === 1) {
        setStage(1);
        play(line(THRAIN, 'Two quick and one slow.'), line(THRAIN, "That is a miner's knock. It means: I am here. Help me."),
          line(THRAIN, 'But nobody is down there. Nobody alive. I made sure of it.'), line(THRAIN, 'Go and ask Hilde. She was a miner once. I do not want to talk about it.'));
      } else play(line(THRAIN, 'No. Listen again.'), act(startListen, 'done'));
    });
  }
  // ---------- stage 1: Hilde's story, the turn, and her cold heartstone ----------
  function hildeStory() {
    const L = t => line(HILDE, t);
    play(L('He sent you to me? Then he is finally ready to hear it.'),
      L('Under his throne there is a stair. It goes down to the Royal Mine.'),
      L('Gold on the walls. A lamp on every pillar. I worked there when I was a girl.'),
      L('Down there we found heartstone. A red stone with a fire inside it that never goes out.'),
      L('Put heartstone inside carved rock, and the rock stands up and works. That is a golem. We had hundreds. They carried our ore.'),
      L('The biggest one we ever made was so big we called him the Ginormous Golem. He guarded the deepest seam.'),
      L('One winter he got hungry. He ate the heartstone out of the walls. Then he ate the little golems. He kept growing.'),
      L('Thrain was a young king. He got us all up the stair, pushed his throne over the hole, and sat down on it. He has sat there ever since.'),
      L('Everyone got out. Everyone but Pebble.'),
      L('Pebble was my golem. Small as a dog, heavy as a cart. He held the door at the bottom so the rest of us could run.'),
      L('Two quick and one slow. I taught him that knock. Pebble is still alive down there.'),
      L('The king will say it is the Ginormous Golem copying Pebble\'s knock to trick him. So we prove it.'),
      L('Every miner had an all-clear knock. Three slow knocks: all safe, come on up. Pebble always knocked it back. The big one never learned it.'),
      L('Here. The last heartstone in Deepholm. I have kept it in my apron for fifty years. It went cold long ago.'),
      act(() => { if (R().stage === 1) { giveOrDrop('hildes_heartstone', 1, player.x, player.y); setStage(2); } }),
      L('Warm it at a forge. Golems follow warm heartstone the way you follow the smell of bread. Then take it to the king\'s throne and knock three slow knocks.'));
  }
  // ---------- stage 2: warm it at any forge (the forge panel waits) ----------
  const _openPanel = openPanel;
  openPanel = function (name, arg) {
    if (name === 'station' && arg === 'forge' && R().stage === 2 && countItem('hildes_heartstone') > 0 && !(window.KEYRING && KEYRING.held('kingstone'))) {
      player.action = { type: 'rm_warm', t: 0, need: NUM.WARM_TIME }; sfx('fire');
      return;
    }
    return _openPanel(name, arg);
  };
  function finishWarm() {
    player.action = null;
    if (R().stage !== 2) return;
    voice('The cold stone drinks the fire. It starts to glow, warm in your hand, like something alive.');
    gainXp('smithing', NUM.WARM_XP); setStage(3);
    burst(player.x, player.y - 30, '#ff8a4a', 18, 90); burst(player.x, player.y - 30, '#ffd08a', 10, 60);
  }
  // ---------- stage 3: the all-clear, and what comes back ----------
  const kn = { slots: 0, last: -99 };
  function openKnock() { if (!inDeep() || R().stage !== 3) return; kn.slots = 0; kn.last = -99; openPanel('rm_knock'); }
  function knockPress() {
    if (panel !== 'rm_knock') return;
    if (kn.slots > 0 && time - kn.last < NUM.KNOCK_RING) { kn.slots = 0; kn.last = time; notify('Too quick! Slow knocks, like a big clock. Try again.'); sfx('miss'); return; }
    kn.slots++; kn.last = time;
    const at = throneAt(); floatText(at.x, at.y - 30, 'knock', '#f3e3b8', 16); burst(at.x, at.y + 8, '#b8ad96', 6, 40); sfx('hit');
    if (kn.slots >= 3) { closePanel(); answerAllClear(); }
  }
  function answerAllClear() {
    const P = NUM.ANSWER_PAUSE;
    watch(P + 2.6);
    playKnocks(PATTERNS.slow.map(t => ({ t: P + t, kind: 'big' })).concat([{ t: P + 2.0, kind: 'small' }]), finishAllClear);
  }
  function finishAllClear() {
    if (R().stage !== 3) return;
    removeItem('hildes_heartstone', 1);
    giveOrDrop('kingstone', 1, player.x, player.y);
    setStage(4);
    startSlide();
    play(line(THRAIN, 'Three slow knocks. All clear.'),
      line(THRAIN, 'And one little knock at the end. Pebble always did that. He never could stop at three.'),
      line(VOICE, "You set Hilde's heartstone in the crack under the throne. A small stone hand takes it gently from below."),
      line(THRAIN, "Fifty years I have sat on my friend's door. I told myself it kept us safe. It only kept me from looking."),
      line(THRAIN, 'Knight, you have my favour. Take this.'),
      line(VOICE, 'He works the mithril stone out of the top of his throne and puts it in your hand.'),
      line(THRAIN, 'The Kingstone locks the throne in place. Whoever holds it can move the throne.'),
      line(THRAIN, 'Go down. Find Pebble and bring him home. And if the Ginormous Golem is still hungry, do what I could not.'));
  }
  // ---------- stage 6 → 7: Pebble is home ----------
  function theEnd() {
    const q = R(); if (q.stage !== 6) return;
    giveOrDrop('coins', NUM.QUEST_COINS, player.x, player.y); gainXp('mining', NUM.QUEST_XP); gainXp('smithing', NUM.QUEST_XP);
    q.stage = 7; save();
    levelBanner = { text: 'QUEST COMPLETE', sub: 'The Knocking Under the Throne', t: 4.5 }; sfx('quest');
    play(line(THRAIN, 'Pebble walked up my stair and knocked on my crown. Three slow, one little.'),
      line(THRAIN, 'It was never my throne holding the mine shut. It was a golem the size of a dog.'),
      line(THRAIN, 'The mine is open again, and the throne stays where it is. I have sat on it long enough.'),
      line(THRAIN, 'The Ginormous Golem will stand up again. He is made of the mountain. Knock him down when you like, and keep what he drops.'));
  }

  // ---------- Pebble: at the gate in the mine (stages 0-5), at Hilde's side in Deepholm (6 and after) ----------
  const PEBBLE_LINES = ['Pebble up here now. Light is nice. Warm.', 'Big golem get up again. Big golem always get up. That is his job. Go knock him down!',
    'Big rock shake? Step back! Golem inside.', 'Hilde say Pebble is silly stone. Pebble is good stone.', "Three slow knocks. Then one little one. That is Pebble's knock."];
  function pebbleSpot() { if (inMine() && R().stage <= 5) return PEBBLE_MINE; if (inDeep() && R().stage >= 6) return PEBBLE_HOME; return null; }
  function pebblePx() { const s = pebbleSpot(); return s ? { x: tc(s[0]), y: tc(s[1]) } : null; }
  function pebbleInFront() {
    const p = pebblePx(); if (!p || player.dead || player.mech) return null;
    const d = dist(player.x, player.y, p.x, p.y); if (d > 80) return null;
    const dot = ((p.x - player.x) * player.facing.x + (p.y - player.y) * player.facing.y) / (d || 1);
    if (dot < 0.2 && d > 30) return null;
    // a dwarf nearer in front of you wins (Hilde stands a tile and a half from his spot)
    if (inDeep()) for (const w of DH.DWARVES) {
      const e = dist(player.x, player.y, w.px, w.py); if (e >= d || e > 80) continue;
      const dot2 = ((w.px - player.x) * player.facing.x + (w.py - player.y) * player.facing.y) / (e || 1);
      if (!(dot2 < 0.2 && e > 30)) return null;
    }
    return p;
  }
  function pebbleTalk() {
    const p = pebblePx(); if (!p) return;
    { const dx = p.x - player.x, dy = p.y - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
    const q = R();
    if (inMine()) {
      if (q.stage === 4) {
        if (seqBusy()) return;
        const L = t => line(PEBBLE, t);
        play(L('Knock knock! Pebble here!'), L('You come down! Pebble knock and knock. Fifty years. Long time.'), L('Pebble got warm stone. Hilde stone! Pebble know it was friend.'),
          L('Pebble keep lamps lit. Kings like lamps.'), L('Pebble hold this door shut. Big golem is on the other side. Ginormous!'),
          L('Forge get hot upstairs, big golem wake up. Big golem hungry. Door shake. Pebble arms tired.'), L('Big golem too hard for sword. Clang! Sword bounce.'),
          L('But hot heartstone make him crack! Mine red stone in the wall. Cook it at forge. Throw it! Boom!'),
          L('Little golems crawl out of rocks. They walk to big golem, he eats them and gets better. Smash little ones first! They pull back together later. Golems always do.'),
          L('Rocks fall from roof. Dark spot on floor means rock coming. Move!'), L('Big golem sleeps in a gold ring. Step in ring, he wakes up. Ready? Pebble open door.'),
          act(openTheGate));
        return;
      }
      say('Red stone, hot stone, throw stone! Pebble cheer!', PEBBLE);
      play(act(() => { if (inMine() && !panel) openPanel('rm_rules'); }, 'done'));
      return;
    }
    if (q.stage >= 7 && !q.told.pebbleDoor) { q.told.pebbleDoor = true; say('Pebble good at doors.', PEBBLE); save(); }
    else say(pick(PEBBLE_LINES), PEBBLE);
    playKnocks(PATTERNS.slow.map(t => ({ t, kind: 'pebble', at: { x: p.x, y: p.y - 10 } })).concat([{ t: 2.0, kind: 'small', at: { x: p.x, y: p.y - 10 } }]));
  }
  function openTheGate() {
    if (R().stage === 4) setStage(5);
    if (!inMine()) return;
    syncGate();
    for (const [x, y] of GATE) { burst(tc(x), tc(y), '#8f887a', 12, 110); burst(tc(x), tc(y) - 10, '#c8bda4', 6, 60); }
    if (window.IMPACT) IMPACT.wave(tc(24) - TILE / 2, tc(23), 1.0);
    sfx('boom');
  }
  if (typeof TAP_PEOPLE !== 'undefined') TAP_PEOPLE.push(() => { const p = pebblePx(); return p ? [{ x: p.x, y: p.y, r: 13, id: 'pebble', name: 'Pebble', talk: () => pebbleTalk() }] : []; });

  // ---------- the stair: down where the throne stood, up at the top of the Hall of Kings ----------
  function rideDown() {
    if (!window.UNDERGROUND || !UNDERGROUND.rideFrom) { notify('The stair goes down into warm light.'); return false; }
    if (slide.on) finishSlide(true);
    const ok = UNDERGROUND.rideFrom(RM, STAIR_STAND);
    if (ok) notify('You go down the stair into the Royal Mine.');
    return ok;
  }
  function climbUp() {
    notify('Up to the throne hall.');
    const hop = window.UNDERGROUND ? UNDERGROUND.hop : null;
    INSTANCES.leave();
    // without a ride to come back from (a test, a friend's door), walk the knight up the stair all the same
    if (!hop && DH && INSTANCES.enter(DH.ID, DH.SHAFT_STEP)) { player.x = tc(STAIR_STAND[0]); player.y = tc(STAIR_STAND[1]); player.facing = { x: 0, y: -1 }; }
    save();
  }
  // the gate at the bottom of the runner: shut until Pebble opens it (or a friend is through it)
  function gateOpenWanted() {
    if (R().stage >= 5 || run.guest) return true;
    if (!player.dead && player.y >= 24 * TILE && inMine()) return true;
    return remotes().some(k => k.y >= 24 * TILE);
  }
  function syncGate() {
    if (!inMine()) return;
    const open = gateOpenWanted();
    if (open) { for (const [x, y] of GATE) setLive(x, y, T.COBBLE); return; }
    // never shut it on a knight standing in the doorway
    for (const [x, y] of GATE) if (circleHitsTile(player.x, player.y, player.r + 1, x, y)) return;
    for (const [x, y] of GATE) setLive(x, y, GOLEM_GATE);
  }

  // =========================================================================
  // 12. THE GIANT ORES — mined crack by crack; the keeper rolls whether one wakes
  // =========================================================================
  const GI = m => NUM.GIANT[m.type];
  function ensureOreRm(m) {
    if (m.rm && m.rm.kind === 'ore') return m.rm;
    const g = GI(m);
    m.rm = { kind: 'ore', rolled: m.state === 'stir' || m.state === 'waking' || (m.hp > 0 && m.hp <= g.wakeAt), stirT: 0, wakeT: 0, t: 0 };
    return m.rm;
  }
  function giantInFront() {
    let best = null;
    for (const m of monsters) {
      if (!GIANT_TYPES.has(m.type) || m.dead || m.gone) continue;
      const d = dist(player.x, player.y, m.x, m.y); if (d > m.r + NUM.MINE_REACH) continue;
      const dot = ((m.x - player.x) * player.facing.x + (m.y - player.y) * player.facing.y) / (d || 1);
      if (dot < 0.2) continue;
      if (!best || d < best.d) best = { m, d };
    }
    return best ? best.m : null;
  }
  // E on a bed, SWING facing a rock, or a tap on its sprite (which walks up and swings)
  function tryMineGiant(m, b) {
    const type = m ? m.type : b.type, g = NUM.GIANT[type];
    if (!m || m.dead) { notify('Rubble. It grows back soon.'); return true; }
    if (m.state === 'waking') return true;
    const tier = hasTool('pickaxe');
    if (!tier) { notify('A giant rock. You need a pickaxe.'); return true; }
    if (skillLv('mining') < g.lv) { notify(`You need Mining level ${g.lv} for giant ${g.metal} ore.`); return true; }
    if (player.action && player.action.type === 'rm_giant' && player.action.m === m) return true;
    if (!told('giant')) voice('A giant rock. Every swing cracks it a bit more. When it breaks it gives you a heap of ore. Unless it wakes up.');
    { const dx = m.x - player.x, dy = m.y - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
    player.action = { type: 'rm_giant', m, t: 0, need: Math.max(g.swingMin, g.swing - NUM.SWING_STEP * tier), tier };
    return true;
  }
  function finishGiant(a) {
    player.action = null;
    const m = a.m;
    if (!m || !monsters.includes(m) || m.dead || m.gone || m.state === 'waking') return;
    if (dist(player.x, player.y, m.x, m.y) > m.r + NUM.MINE_REACH + 24) return;
    const g = GI(m), cracks = hasHeartPick() ? 2 : 1;
    gainXp('mining', g.xp * cracks); sfx('chop');
    burst(m.x + rint(-m.r / 2, m.r / 2), m.y + rint(-m.r / 2, m.r / 3), g.metal === 'mithril' ? '#bcd4f5' : '#c8b0ff', 8, 80);
    hitMonster(m, cracks, 0, false, 'rm_mine');
    // keep swinging while it stands quietly; once it shakes, what happens next is the knight's own choice
    if (monsters.includes(m) && !m.dead && m.state !== 'stir' && m.state !== 'waking') player.action = { ...a, t: 0 };
  }
  // a crack that lands where the rock really lives (offline, or on the keeper): the stir roll, the break, the waking
  function crackGiant(m, n, by) {
    if (m.dead || m.state === 'waking') return;
    n = clamp(Math.round(+n || 0), 0, 2); if (!n) return;
    const g = GI(m), rm = ensureOreRm(m);
    m.lastHitBy = by || null;
    m.hp -= n; m.hurtT = 0.18;
    floatText(m.x, m.y - m.r - 6, `-${n}`, '#ffd166'); sfx('hit');
    if (m.state === 'stir') rm.stirT = 0;
    if (!rm.rolled && m.hp > 0 && m.hp <= g.wakeAt) { rm.rolled = true; if (ROYALMINE.rollWake(m.type)) { m.state = 'stir'; rm.stirT = 0; } }
    if (m.hp <= 0) {
      if (m.state === 'stir') { m.state = 'waking'; m.hp = 0.5; rm.wakeT = 0; }
      else { m.hp = 0; rm.t = 0; killMonster(m); }
    }
  }
  function wakeGolemFrom(m, b) {
    const rm = ensureOreRm(m), g = GI(m);
    m.dead = true; m.deadT = 0; m.hp = 0; m.respawnT = 1e9; m.state = 'idle'; m.lastHitBy = null; rm.t = 0; rm.wakeT = 0;
    const d = MONSTER_DEFS[g.golem], want = { x: b.c.x, y: (b.bed[1] + b.size) * TILE + TILE / 2 };
    const s = safeSpot(want.x, want.y, d.r, 'beast') || want;
    const gm = makeMon(g.golem, s.x, s.y); gm.attackCd = 1.2;
    monsters.push(gm);
    return gm;
  }
  function keeperOres(dt) {
    for (const b of GIANTS) {
      const m = giantMon(b); if (!m || m.remote) continue;
      const rm = ensureOreRm(m), g = GI(m);
      if (!m.dead) { m.x = m.home.x = b.c.x; m.y = m.home.y = b.c.y; m.moving = false; m.wander.x = 0; m.wander.y = 0; m.wanderT = 99; m.facing = { x: 0, y: 1 }; }
      if (m.dead) {
        rm.t += dt;
        if (rm.t >= g.regrow) { m.dead = false; m.deadT = 0; m.hp = m.maxHp; m.state = 'idle'; m.lastHitBy = null; m.x = m.home.x = b.c.x; m.y = m.home.y = b.c.y; rm.rolled = false; rm.t = 0; burst(b.c.x, b.c.y, g.metal === 'mithril' ? '#bcd4f5' : '#c8b0ff', 16, 90); }
      } else if (m.state === 'stir') {
        rm.stirT += dt;
        if (rm.stirT >= NUM.STIR_SETTLE) { m.state = 'idle'; m.hp = m.maxHp; rm.rolled = false; rm.stirT = 0; }
      } else if (m.state === 'waking') {
        rm.wakeT += dt;
        if (rm.wakeT >= NUM.WAKE_TIME) wakeGolemFrom(m, b);
      } else if (m.state !== 'idle') m.state = 'idle';
    }
    // woken golems and little golems never come back on the core's timer: once they have lain there a moment they go
    let cut = false; for (const m of monsters) if ((WOKEN.has(m.type) || m.type === 'golemling') && m.dead && m.deadT > NUM.SPLICE && !m.remote) { cut = true; break; }
    if (cut) monsters = monsters.filter(m => !((WOKEN.has(m.type) || m.type === 'golemling') && m.dead && m.deadT > NUM.SPLICE && !m.remote));
  }
  // what every client shows of the rocks: the shake, the settle, the waking (edges of the streamed state)
  function oreWatch(dt) {
    for (const b of GIANTS) {
      const m = giantMon(b), key = b.nid, prev = run.ores[key] || null;
      const st = !m ? 'none' : m.dead ? 'dead' : m.state;
      if (m && prev !== st) {
        if (st === 'stir') { floatText(m.x, m.y - m.r - 18, 'IT IS SHAKING!', '#ffb050', 18); if (!told('stir')) voice('That giant rock is shaking. Something inside is waking up! Finish it and meet the golem, or step away and let it settle.'); }
        else if (st === 'idle' && prev === 'stir') floatText(m.x, m.y - m.r - 18, 'It settles back to sleep', '#d8e4f0', 15);
        else if (st === 'waking') {
          floatText(m.x, m.y - m.r - 22, 'A GOLEM WAKES!', '#ff9a4a', 22); sfx('boss');
          if (window.IMPACT) IMPACT.wave(m.x, m.y, 1.2);
          burst(m.x, m.y, '#8f887a', 24, 150);
          if (!told('wake')) voice('The rock stands up. It is a golem! Beat it for the metal in its pockets.');
        }
      }
      run.ores[key] = st;
      if (m && st === 'stir') {
        m.rmPulse = (m.rmPulse || 0) - dt;
        if (m.rmPulse <= 0) { m.rmPulse = NUM.STIR_PULSE; burst(m.x + rint(-m.r, m.r), m.y + m.r * 0.6, '#9a927f', 7, 50); if (window.IMPACT && dist(player.x, player.y, m.x, m.y) < 12 * TILE) IMPACT.wave(m.x, m.y, 0.6); sfx('hit'); }
      }
    }
  }
  function giantHint(source) {
    if (source !== undefined && source !== 'player') return;
    if (time - run.hintT < NUM.HINT_GAP) return;
    run.hintT = time;
    if (!hasTool('pickaxe')) notify('A giant rock. You need a pickaxe.');
    else notify(touch() ? 'Mine it with a pickaxe. Tap the rock.' : 'Mine it with a pickaxe. Press E.');
  }

  // =========================================================================
  // 13. THE HEART CHAMBER — veins, forges, the throw
  // =========================================================================
  const veinKey = (ms, tx, ty) => Math.floor(ms / NUM.VEIN_WINDOW) + ':' + tx + ',' + ty;
  const carrying = () => run.raw + run.hot;
  function tryVein(tx, ty) {
    const tier = hasTool('pickaxe');
    if (!tier) { notify('A heartstone vein. You need a pickaxe.'); return; }
    if (!golemAwake()) { notify('The veins only glow while the golem is awake.'); return; }
    const ms = clock();
    if (!veinLit(tx, ty, ms)) { notify('This vein is dark. Wait for one to glow red.'); return; }
    if ((run.quota[veinKey(ms, tx, ty)] || 0) >= NUM.VEIN_TAKE) { notify('This vein is empty for now. Another will glow soon.'); return; }
    if (carrying() >= NUM.CARRY) { notify(`Your arms are full: ${NUM.CARRY} heartstones. Heat them and throw them.`); return; }
    const need = hasHeartPick() ? NUM.PICK_VEIN : Math.max(NUM.VEIN_MIN, NUM.VEIN_SWING - NUM.VEIN_STEP * tier);
    player.action = { type: 'rm_vein', tx, ty, t: 0, need, tier };
  }
  function finishVein(a) {
    player.action = null;
    const ms = clock(), key = veinKey(ms, a.tx, a.ty);
    if (!golemAwake() || !veinLit(a.tx, a.ty, ms)) return;
    if ((run.quota[key] || 0) >= NUM.VEIN_TAKE) { notify('This vein is empty for now. Another will glow soon.'); return; }
    if (carrying() >= NUM.CARRY) { notify(`Your arms are full: ${NUM.CARRY} heartstones. Heat them and throw them.`); return; }
    run.quota[key] = (run.quota[key] || 0) + 1; run.raw++;
    gainXp('mining', NUM.VEIN_XP); sfx('chop');
    burst(tc(a.tx), tc(a.ty), '#ff7a4a', 10, 80); burst(tc(a.tx), tc(a.ty), '#ffd08a', 5, 50);
    floatText(player.x, player.y - 44, '+1 heartstone', '#ff9a6a', 13);
    if (!told('raw')) notify('A raw heartstone. It is cold. Heat it at a forge.');
    if (run.quota[key] < NUM.VEIN_TAKE && carrying() < NUM.CARRY) player.action = { ...a, t: 0 };
  }
  function tryHeat(tx, ty) {
    if (run.raw <= 0) { notify('A heart forge. Bring raw heartstone from a glowing vein.'); return; }
    player.action = { type: 'rm_heat', tx, ty, t: 0, need: NUM.HEAT };
  }
  function finishHeat(a) {
    player.action = null;
    if (run.raw <= 0) return;
    run.raw--; run.hot++; gainXp('smithing', NUM.HEAT_XP); sfx('anvil');
    floatText(player.x, player.y - 44, 'Hot!', '#ffb050', 15); burst(tc(a.tx), tc(a.ty) - 10, '#ffb050', 12, 90);
    if (!told('hot')) notify(touch() ? 'Hot! Now throw it: tap THROW, or tap the golem.' : 'Hot! Now throw it at the golem: press T.');
    if (run.raw > 0) player.action = { ...a, t: 0 };
  }
  // the stone's damage: 50, and a quarter of your Smithing level on top (up to 25), a quarter more in kid mode
  const heartDmgBase = () => Math.round((NUM.DMG + Math.min(NUM.DMG_SMITH_MAX, Math.floor(skillLv('smithing') / NUM.DMG_SMITH))) * (kid() ? NUM.KID_DMG : 1));
  function throwHeart() {
    if (!inMine() || player.dead || !inChamberPx(player.x, player.y)) return false;
    if (run.hot <= 0) { notify('Nothing hot to throw. Mine a glowing vein, then heat it at a forge.'); return false; }
    const gm = golemMon();
    if (!isAwake(gm)) { notify('He is asleep. Step into the gold ring to wake him first.'); return false; }
    if (run.throwCd > 0) return false;
    run.hot--; run.throwCd = NUM.THROW_CD;
    { const dx = gm.x - player.x, dy = gm.y - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
    player.attackT = 0.22;
    if (player.action && (player.action.type === 'rm_vein' || player.action.type === 'rm_heat')) player.action = null;
    const d = dist(player.x, player.y - 26, gm.x, gm.y - 70);
    run.stones.push({ x0: player.x, y0: player.y - 26, t: 0, T: NUM.FLIGHT + d / NUM.FLIGHT_SPEED, dmg: ROYALMINE.heartDmg(), m: gm });
    sfx('swing');
    return true;
  }
  function landStone(s) {
    const m = monsters.includes(s.m) && !s.m.gone ? s.m : golemMon();
    const x = m ? m.x : s.x0, y = m ? m.y - 70 : s.y0;
    burst(x, y, '#ff6a2a', 16, 140); burst(x, y, '#ffd08a', 8, 90);
    // a stone that lands after he falls or sleeps shatters harmlessly
    if (!m || !isAwake(m)) { floatText(x, y - 20, 'crumbles', '#d8c0b0', 13); return; }
    run.life.landed++; run.hitFlash = time;
    hitMonster(m, s.dmg, 0, true, 'heartstone');
    gainXp('melee', NUM.MELEE_PER_DMG * s.dmg);
    for (let k = 0; k < 6; k++) particles.push({ x: x + rint(-24, 24), y: y + rint(-30, 20), vx: rint(-120, 120), vy: rint(-160, -40), t: 0.7, color: k % 2 ? '#6d665c' : '#8a8275', r: 3 + Math.random() * 3 });
    if (window.IMPACT) IMPACT.wave(m.x, m.y, 1.0);
    sfx('boom');
  }
  // what a swing does in front of a little golem: it is a smash, not a throw
  const lingInReach = () => { const w = weaponDef(), reach = (w ? 58 : 36) + 12; return lings().some(m => { const d = dist(player.x, player.y, m.x, m.y); return d <= reach + m.r && ((m.x - player.x) * player.facing.x + (m.y - player.y) * player.facing.y) / (d || 1) > 0.3; }); };

  // =========================================================================
  // 14. THE GINORMOUS GOLEM — the keeper's state machine (the streamed m.state is always written from m.rm)
  // 'sleep' → 'rise' (0.9 s) → 'fight' ⇄ 'windup' (1.2 s) → 'slam' (0.5 s) → 'fight'
  // =========================================================================
  function knightsWhere(pred) {
    const out = [];
    if (inMine() && !player.dead && pred(player.x, player.y)) out.push({ x: player.x, y: player.y, me: true });
    for (const k of remotes()) if (pred(k.x, k.y)) out.push(k);
    return out;
  }
  const nearSeat = r => (x, y) => dist(x, y, SEAT_C.x, SEAT_C.y) <= r;
  function ensureGolemRm(g) {
    if (g.rm && g.rm.kind === 'golem' && (g.dead || g.rm.phase === g.state)) return g.rm;
    const phase = AWAKE.has(g.state) || g.state === 'sleep' ? g.state : 'sleep';
    g.rm = { kind: 'golem', phase, t: 0, lingT: NUM.LING_FIRST, nearT: 0, slamCd: 0, settleT: 0, downT: 0, heap: 0, wasDead: !!g.dead,
      scale: Math.max(1, (g.maxHp || NUM.GOLEM_HP) / NUM.GOLEM_HP / (kid() ? NUM.KID_HP : 1)) };
    return g.rm;
  }
  function wakeGolem(g, rm, n) {
    const k = clamp(n, 1, NUM.KNIGHTS_MAX);
    rm.scale = 1 + NUM.PER_KNIGHT * (k - 1);
    g.maxHp = g.hp = Math.round(NUM.GOLEM_HP * rm.scale * (kid() ? NUM.KID_HP : 1));
    rm.phase = 'rise'; rm.t = 0; rm.lingT = NUM.LING_FIRST; rm.nearT = 0; rm.slamCd = 0; rm.settleT = 0;
  }
  function spawnLittle(i) {
    const [hx, hy] = HEAPS[(((i | 0) % 4) + 4) % 4];
    const m = makeMon('golemling', tc(hx), tc(hy));
    m.hp = m.maxHp = kid() ? NUM.KID_LING_HP : NUM.LING_HP;
    m.state = 'emerge'; m.rm = { kind: 'ling', t: 0, stuck: 0 };
    monsters.push(m);
    return m;
  }
  function crumbleLings() {
    let any = false;
    for (const m of monsters) if (m.type === 'golemling' && !m.remote) { any = true; if (!m.dead) { burst(m.x, m.y, '#8f887a', 10, 80); burst(m.x, m.y - 10, '#ff6a3a', 4, 50); } }
    if (any) monsters = monsters.filter(m => !(m.type === 'golemling' && !m.remote));
  }
  function keeperGolem(dt) {
    const g = golemMon(); if (!g || g.remote) return;
    const rm = ensureGolemRm(g);
    const chamber = knightsWhere(inChamberPx), ring = knightsWhere(nearSeat(NUM.WAKE_R * TILE)), near = knightsWhere(nearSeat(NUM.NEAR_R * TILE));
    if (g.dead) {
      if (!rm.wasDead) { rm.wasDead = true; rm.downT = 0; crumbleLings(); }
      rm.downT += dt;
      if (rm.downT >= NUM.REVIVE && !ring.length) {
        g.dead = false; g.deadT = 0; g.maxHp = g.hp = NUM.GOLEM_HP; g.lastHitBy = null; g.x = g.home.x = SEAT_C.x; g.y = g.home.y = SEAT_C.y;
        rm.phase = 'sleep'; rm.t = 0; rm.wasDead = false; rm.scale = 1; g.state = 'sleep';
      }
      return;
    }
    rm.wasDead = false;
    g.x = g.home.x = SEAT_C.x; g.y = g.home.y = SEAT_C.y; g.moving = false; g.wander.x = 0; g.wander.y = 0; g.wanderT = 99;
    if (rm.phase === 'sleep') { if (ring.length) wakeGolem(g, rm, chamber.length); }
    else if (rm.phase === 'rise') { rm.t += dt; if (rm.t >= NUM.RISE) { rm.phase = 'fight'; rm.t = 0; } }
    else if (rm.phase === 'windup') { rm.t += dt; if (rm.t >= (kid() ? NUM.KID_WINDUP : NUM.WINDUP)) { rm.phase = 'slam'; rm.t = 0; } }
    else if (rm.phase === 'slam') { rm.t += dt; if (rm.t >= NUM.SLAM) { rm.phase = 'fight'; rm.t = 0; rm.slamCd = NUM.SLAM_CD; rm.nearT = 0; } }
    else if (rm.phase === 'fight') {
      rm.slamCd = Math.max(0, rm.slamCd - dt);
      if (near.length && !window.__peace) rm.nearT += dt; else rm.nearT = 0;
      if (rm.nearT >= NUM.NEAR_HOLD && rm.slamCd <= 0) { rm.phase = 'windup'; rm.t = 0; }
    }
    if (AWAKE.has(rm.phase)) {
      // nobody left in the chamber: he settles back down, whole
      if (!chamber.length) { rm.settleT += dt; if (rm.settleT >= NUM.SETTLE) { rm.phase = 'sleep'; rm.t = 0; g.hp = g.maxHp; rm.settleT = 0; crumbleLings(); } }
      else rm.settleT = 0;
    }
    if (AWAKE.has(rm.phase)) {
      rm.lingT -= dt;
      if (rm.lingT <= 0) {
        const half = g.hp <= g.maxHp / 2, knights = Math.max(1, chamber.length);
        rm.lingT = (half ? NUM.LING_EVERY_HALF : NUM.LING_EVERY) / (1 + NUM.LING_PER_KNIGHT * (knights - 1)) * (kid() ? NUM.KID_LING : 1);
        const alive = lings().length;
        for (let k = 0; k < (half ? 2 : 1) && alive + k < NUM.LING_MAX; k++) spawnLittle(rm.heap++);
      }
      // the little golems walk straight to him; one that gets there is eaten, and he mends
      for (const m of monsters.slice()) {
        if (m.type !== 'golemling' || m.dead || m.remote) continue;
        if (!m.rm) m.rm = { kind: 'ling', t: m.state === 'emerge' ? 0 : NUM.LING_WARN, stuck: 0 };
        m.wander.x = 0; m.wander.y = 0; m.wanderT = 99;
        if (m.state === 'emerge') { m.rm.t += dt; m.moving = false; if (m.rm.t >= NUM.LING_WARN) m.state = 'walk'; continue; }
        m.state = 'walk';
        const dx = g.x - m.x, dy = g.y - m.y, d = Math.hypot(dx, dy) || 1;
        if (d <= NUM.LING_REACH || m.rm.stuck > 1) {
          g.hp = Math.min(g.maxHp, g.hp + Math.round(NUM.LING_HEAL * (rm.scale || 1) * (kid() ? 0.5 : 1)));
          burst(m.x, m.y, '#8f887a', 8, 60); const i = monsters.indexOf(m); if (i >= 0) monsters.splice(i, 1);
          continue;
        }
        const sp = (kid() ? NUM.KID_LING_SPEED : NUM.LING_SPEED) * dt, bx = m.x, by = m.y;
        moveEntity(m, dx / d * sp, dy / d * sp, 'beast');
        m.facing = { x: dx / d, y: dy / d }; m.moving = true; m.walkT += dt * 8;
        if (Math.hypot(m.x - bx, m.y - by) < sp * 0.2 && d < NUM.LING_REACH + 40) m.rm.stuck += dt; else m.rm.stuck = 0;
      }
    }
    g.state = rm.phase;
  }

  // =========================================================================
  // 15. WHAT EACH CLIENT DOES WITH THE FIGHT — rocks on your own knight, the slam's damage, the banners,
  // the heals and the fall (a knight who helped gets one roll of the golem's table, once per life)
  // =========================================================================
  function forceRock(x, y) { run.rocks.push({ x, y, t: 0, T: kid() ? NUM.KID_ROCK_FALL : NUM.ROCK_FALL }); }
  function rocksTick(dt) {
    if (dt > 0) {
      const vx = (player.x - run.lastX) / dt, vy = (player.y - run.lastY) / dt, sp = Math.hypot(vx, vy);
      if (sp < 400) { run.vx = vx; run.vy = vy; } else { run.vx = 0; run.vy = 0; }
    }
    run.lastX = player.x; run.lastY = player.y;
    const gm = golemMon(), active = isAwake(gm) && !player.dead && inChamberPx(player.x, player.y) && !window.__peace;
    if (active) {
      run.rockT -= dt;
      if (run.rockT <= 0) {
        const half = gm.hp <= gm.maxHp / 2;
        run.rockT = kid() ? NUM.KID_ROCK_EVERY : half ? NUM.ROCK_EVERY_HALF : NUM.ROCK_EVERY;
        floatText(SEAT_C.x, SEAT_C.y - 200, 'ROAR', '#ffb080', 16);
        forceRock(player.x + run.vx * NUM.ROCK_LEAD, player.y + run.vy * NUM.ROCK_LEAD);
        if (half) { const a = Math.random() * Math.PI * 2, r = Math.random() * NUM.ROCK_EXTRA * TILE; forceRock(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r); }
        if (!told('rock')) notify('Rocks fall where the dark spots are. Step out!');
      }
    } else run.rockT = Math.max(run.rockT, 2);
    for (const r of run.rocks.slice()) {
      r.t += dt;
      if (r.t < r.T) continue;
      run.rocks.splice(run.rocks.indexOf(r), 1);
      burst(r.x, r.y, '#8f887a', 14, 120); burst(r.x, r.y, '#5a554c', 8, 70); sfx('hit');
      if (window.IMPACT) IMPACT.wave(r.x, r.y, 0.5);
      run.debris.push({ x: r.x, y: r.y, t: 0 });
      if (!player.dead && inMine() && dist(player.x, player.y, r.x, r.y) < NUM.ROCK_R) { const dmg = kid() ? NUM.KID_ROCK_DMG : NUM.ROCK_DMG; run.lastRockDmg = dmg; hurtPlayer(dmg, r.x, r.y - 8, true); }
    }
    for (const d of run.debris.slice()) { d.t += dt; if (d.t > 1.4) run.debris.splice(run.debris.indexOf(d), 1); }
  }
  const inShadow = () => run.rocks.some(r => dist(player.x, player.y, r.x, r.y) < NUM.ROCK_R);
  const inSlam = () => !player.dead && dist(player.x, player.y, SEAT_C.x, SEAT_C.y) < NUM.SLAM_R * TILE;
  function lifeTick(dt) {
    const gm = golemMon(), L = run.life;
    if (!gm) return;
    const chamber = inChamberPx(player.x, player.y);
    if (!gm.dead) {
      if (L.lastDead === true || L.fallen) {
        if (L.lastDead === true) floatText(SEAT_C.x, SEAT_C.y - 120, 'The golem is pulling himself back together', '#d8e4f0', 15);
        resetLife();
      }
      if (gm.state === 'rise' && L.lastState !== 'rise') {
        golemRiseAt = time;
        if (chamber) { levelBanner = { text: 'THE GINORMOUS GOLEM', sub: 'Swords cannot hurt him', t: 3.5 }; sfx('boss'); }
      }
      if (gm.state === 'fight' && L.start === null) L.start = time;
      if (isAwake(gm) && gm.hp <= gm.maxHp / 2 && !L.half) { L.half = true; if (chamber) levelBanner = { text: 'HE IS ANGRY', sub: 'More little golems are coming', t: 3.5 }; }
      // a little golem got through: he mends, and everyone sees how much
      if (L.lastHp !== null && L.lastDead === false && isAwake(gm) && gm.maxHp === L.lastMax && gm.hp > L.lastHp + 0.5) {
        floatText(gm.x, gm.y - 150, `+${Math.round(gm.hp - L.lastHp)}`, '#8fe07a', 20); burst(gm.x, gm.y - 70, '#8fe07a', 14, 80); run.mendFlash = time;
        if (!told('heal')) notify('A little golem got through. The big golem ate it and got better.');
      }
      // a friend's stone: the chunks fly on this screen too
      if (L.lastHp !== null && L.lastDead === false && gm.hp < L.lastHp - 30 && time - (run.hitFlash || -9) > 0.1) { run.hitFlash = time; burst(gm.x, gm.y - 70, '#ff6a2a', 12, 120); }
      // the slam: the windup ring is drawn from here, the damage lands on your own knight only
      // over your own head when you are the one in the ring (over his, where a narrow screen can hide it under the HUD, otherwise)
      if (gm.state === 'windup' && L.lastState !== 'windup') { L.windupAt = time; const mine = inSlam(); floatText(mine ? player.x : SEAT_C.x, mine ? player.y - 58 : SEAT_C.y - 170, 'GET BACK!', '#ff6b6b', 22); }
      if (gm.state === 'slam' && L.lastState !== 'slam') {
        sfx('boom'); if (window.IMPACT) IMPACT.wave(SEAT_C.x, SEAT_C.y, 2.5);
        const d = dist(player.x, player.y, SEAT_C.x, SEAT_C.y);
        if (!player.dead && inMine() && d < NUM.SLAM_R * TILE) {
          const dmg = kid() ? NUM.KID_SLAM_DMG : NUM.SLAM_DMG; run.lastSlamDmg = dmg;
          hurtPlayer(dmg, SEAT_C.x, SEAT_C.y, true);
          const k = NUM.SLAM_KNOCK / (d || 1); moveEntity(player, (player.x - SEAT_C.x) * k, (player.y - SEAT_C.y) * k, playerWho());
        }
      }
    } else if (gm.hp <= 0) {
      if (L.deadSince === null) L.deadSince = time;
      if (!L.fallen && time - L.deadSince >= NUM.FALL_HOLD) { L.fallen = true; onFall(); }
    }
    L.lastHp = gm.hp; L.lastState = gm.dead ? 'dead' : gm.state; L.lastDead = !!gm.dead; L.lastMax = gm.maxHp;
  }
  let _rollDropsInner = null;
  function onFall() {
    const q = R(), L = run.life;
    burst(SEAT_C.x, SEAT_C.y - 40, '#8f887a', 40, 180); burst(SEAT_C.x, SEAT_C.y - 60, '#ff6a2a', 20, 120);
    if (window.IMPACT) IMPACT.wave(SEAT_C.x, SEAT_C.y, 2.2);
    sfx('boss');
    if (!inMine()) return;
    const secs = L.start !== null ? Math.max(0, L.deadSince - L.start) : null;
    const helped = L.landed >= NUM.HELP_STONES || L.smashed >= NUM.HELP_SMASH;
    let banner = null;
    if (helped && !L.paid) {
      L.paid = true; reward(); q.fights++;
      if (secs !== null && secs >= 1 && (!q.best || secs < q.best)) q.best = Math.round(secs);
    } else if (!helped) notify('You did not help this time, so no loot. Land a heartstone next time.');
    if (q.stage === 4 || q.stage === 5) {
      say('Big golem fall down! Pebble free! Pebble go up and see Hilde!', PEBBLE);
      q.stage = 6; if (!quest.untrackedByPlayer) quest.tracked = 'royalmine';
      banner = { text: 'PEBBLE IS FREE', sub: 'The Ginormous Golem is down', t: 4.5 };
    } else {
      banner = { text: 'THE GOLEM IS DOWN', sub: secs !== null ? `${mmss(secs)} · best ${mmss(q.best || secs)}` : (q.best ? `best ${mmss(q.best)}` : 'He will stand up again'), t: 4 };
      if (q.stage >= 7 && helped && !told('after')) voice('He will pull himself back together. Golems always do. Come back and knock him down again.');
    }
    // the fall's banner comes a tick after the loot, so a RARE DROP banner is moved to the second slot rather than lost
    run.pendingBanner = banner;
    save();
  }
  function reward() {
    const q = R(), before = drops.length;
    (_rollDropsInner || rollDrops)(MONSTER_DEFS.ginormous_golem, player.x, player.y);
    const got = drops.slice(before);
    if (got.some(d => d.id === 'heartstone_pickaxe')) { q.gotPick = true; q.dry = 0; }
    else if (!q.gotPick) {
      if (q.dry >= NUM.PITY) {
        giveOrDrop('heartstone_pickaxe', 1, player.x, player.y);
        levelBanner = { text: 'RARE DROP', sub: ITEMS.heartstone_pickaxe.name, t: 3 }; burst(player.x, player.y, '#f5c542', 30, 160);
        voice('The mountain kept count. The Heartstone pickaxe is yours.');
        q.gotPick = true; q.dry = 0;
      } else q.dry++;
    }
    gainXp('mining', NUM.FIGHT_XP); gainXp('smithing', NUM.FIGHT_XP); gainXp('melee', NUM.FIGHT_XP);
  }

  // =========================================================================
  // 16. THE WRAPPERS — outermost (this file loads after 75-coop and 88-aerie), explicit arguments every time
  // =========================================================================
  // hitMonster: the golem only takes heartstone; the giant ores only take a pickaxe's crack. On a puppet (a friend
  // keeps this map) the hit goes to the keeper in coop's own shape and nothing is predicted here.
  function clang(m, source) {
    floatText(m.x + rint(-14, 14), m.y - 110, 'CLANG', '#e8eef5', 16); burst(m.x, m.y - 60, '#ffe9a8', 6, 110); sfx('anvil');
    if ((source === undefined || source === 'player' || source === 'companion') && time - run.clangT >= NUM.HINT_GAP) { run.clangT = time; notify('Clang! Swords bounce off. Throw hot heartstone at him!'); }
  }
  const _hitMonster = hitMonster;
  hitMonster = function (m, dmg, knock, fromBomb, source) {
    if (m && m.type === 'ginormous_golem') {
      if (m.remote) {
        if (source === 'heartstone') {
          const n = clamp(Math.round(+dmg || 0), 0, 500);
          if (online()) NET.send({ t: 'hit', nid: m.nid, dmg: n, knock: 0, bomb: true });
          m.hurtT = 0.18; floatText(m.x, m.y - 90, `-${n}`, '#ffd166');
          return;
        }
        if (source !== 'monster' && source !== 'remote') clang(m, source);
        return;
      }
      if (source === 'heartstone') { if (!isAwake(m)) return; m.lastHitBy = null; return _hitMonster(m, dmg, 0, true, 'heartstone'); }
      if (source === 'remote') { if (fromBomb && dmg >= NUM.REMOTE_MIN && dmg <= NUM.REMOTE_MAX && isAwake(m)) return _hitMonster(m, dmg, 0, true, 'remote'); return; }
      if (source !== 'monster') clang(m, source);
      return;
    }
    if (m && GIANT_TYPES.has(m.type)) {
      if (m.remote) {
        if (source === 'rm_mine') {
          const n = clamp(Math.round(+dmg || 0), 0, 2);
          if (online()) NET.send({ t: 'hit', nid: m.nid, dmg: n, knock: 0, bomb: false });
          m.hurtT = 0.18; floatText(m.x, m.y - m.r - 6, `-${n}`, '#ffd166');
          return;
        }
        giantHint(source); return;
      }
      if (source === 'rm_mine') { crackGiant(m, dmg, null); return; }
      if (source === 'remote') { crackGiant(m, dmg, m.lastHitBy); return; }
      giantHint(source); return;
    }
    return _hitMonster(m, dmg, knock, fromBomb, source);
  };
  // playerAttack: SWING throws a hot stone in the chamber (unless a little golem is in reach: then it smashes),
  // and with a pickaxe it mines a giant rock in front of you
  const _playerAttack = playerAttack;
  playerAttack = function () {
    if (!player.dead && !player.mech && inMine()) {
      if (inChamberPx(player.x, player.y) && run.hot > 0 && golemAwake() && !lingInReach()) { throwHeart(); return; }
      if (hasTool('pickaxe')) {
        const m = giantInFront();
        if (m) {
          tryMineGiant(m);
          if (!player.action || player.action.type !== 'rm_giant') { player.attackCd = Math.max(player.attackCd, 0.6); if (typeof tap !== 'undefined' && tap.kind === 'monster' && tap.target === m) tapCancel('done'); }
          return;
        }
      }
    }
    return _playerAttack();
  };
  // rollDrops: the golem's own roll is given out by the fall (one per helper), never by the killing blow; a
  // broken giant's heap lands at the miner's feet, not inside its solid bed
  _rollDropsInner = rollDrops;
  rollDrops = function (def, x, y) {
    if (def === MONSTER_DEFS.ginormous_golem) return;
    if (def === MONSTER_DEFS.giant_mithril || def === MONSTER_DEFS.giant_stormstone) {
      const ore = def === MONSTER_DEFS.giant_mithril ? 'mithril_ore' : 'stormstone_ore', n0 = drops.length;
      _rollDropsInner(def, player.x, player.y);
      let n = 0; for (let i = n0; i < drops.length; i++) if (drops[i].id === ore) n += drops[i].qty;
      if (n) floatText(player.x, player.y - 52, `+${n} ${ITEMS[ore].name.toLowerCase()}`, ITEMS[ore].color, 16);
      return;
    }
    return _rollDropsInner(def, x, y);
  };
  // tapAt: with a hot stone, a tap on the golem (anywhere on his four and a half tiles) throws it
  function golemTapped(sx, sy) {
    const gm = golemMon(); if (!gm || gm.dead) return null;
    const wx = sx + cam.x, wy = sy + cam.y;
    if (dist(wx, wy, gm.x, gm.y) <= gm.r + 8) return gm;
    return Math.abs(wx - gm.x) <= 84 && wy >= gm.y - 200 && wy <= gm.y + 48 ? gm : null;
  }
  const _tapAt = tapAt;
  tapAt = function (sx, sy) {
    if (inMine() && run.hot > 0 && !player.dead && !paused && !(typeof title !== 'undefined' && title.active) && inChamberPx(player.x, player.y)) {
      const p = tapPick(sx, sy);
      const other = p && p.kind === 'monster' && p.monster.type !== 'ginormous_golem';
      if (!other && golemTapped(sx, sy)) { throwHeart(); return true; }
    }
    return _tapAt(sx, sy);
  };
  // load: a save never describes an instance, so the throne comes back from the loaded quest at once
  const _load = load;
  load = function () { const r = _load(); resetRun(); seqClear(); syncDeepholm(); return r; };

  // =========================================================================
  // 17. USE (E, and a tap on a tile, which walks up and presses E)
  // =========================================================================
  const PLAQUES = {
    '20,5': 'Carved: a dwarf with a pick, and a big rock with eyes. Under it: MINE THE GIANT ROCKS. SOMETIMES THEY WAKE UP.',
    '27,5': 'Carved: a giant golem with a glowing heart. Under it: HIS HEART IS IN THE WALLS. MINE THE GLOWING RED VEINS.',
    '20,9': 'Carved: a hand holding a red stone over a fire. Under it: HEAT THE STONE. THROW THE STONE.',
    '27,9': 'Carved: little rock people walking to a big one. Under it: STOP THE LITTLE ONES BEFORE HE EATS THEM.',
    '9,5': 'The Royal Seams. Coal, mithril and stormstone. They grow back fast down here.',
    '9,9': 'Queen Brenna dug this hall. The carving says she found the first heartstone.',
    '38,8': 'Blue giant rocks need Mining 20. Purple ones in the Deep need Mining 30. A giant rock gives you ore, or it gives you a fight.',
  };
  const plaqueAt = (tx, ty) => PLAQUES[tx + ',' + ty] || 'A carved pillar. Gold at the top, a dwarf face at the bottom.';
  // first in line: Pebble in front of you (nearer than any dwarf), and in the chamber, E throws a hot stone
  HOOKS.use.unshift((t, tx, ty) => {
    if (pebbleInFront()) { pebbleTalk(); return true; }
    if (inMine() && inChamberPx(player.x, player.y) && t !== HEART_VEIN && t !== HEART_FORGE && !isHeap(tx, ty) && (run.hot > 0 || golemAwake())) { throwHeart(); return true; }
    return false;
  });
  HOOKS.use.push((t, tx, ty) => {
    if (inDeep() && t === ROYAL_STAIR) { rideDown(); return true; }
    if (!inMine()) return false;
    if (t === ROYAL_STAIR) { climbUp(); return true; }
    if (t === ROYAL_PILLAR) { say(plaqueAt(tx, ty), 'The plaque'); return true; }
    if (t === HEART_VEIN) { tryVein(tx, ty); return true; }
    if (t === HEART_FORGE) { tryHeat(tx, ty); return true; }
    if (t === GOLEM_GATE) { say('A great stone door, shaking on its hinges. Pebble is holding it. Talk to Pebble.', VOICE); return true; }
    if (t === ORE_BED && onSeat(tx, ty)) {
      const gm = golemMon();
      if (!gm || gm.dead) notify('The golem is down. Up again soon.');
      else if (!isAwake(gm)) say('The Ginormous Golem, fast asleep. Step into the gold ring to wake him.', VOICE);
      else throwHeart();
      return true;
    }
    if (t === ORE_BED) { const b = bedOf(tx, ty); if (b) { tryMineGiant(giantMon(b), b); return true; } }
    if (isHeap(tx, ty)) { say('A heap of rubble. Something small is moving in there.', VOICE); return true; }
    return false;
  });

  // =========================================================================
  // 18. KILLS — breaking a rock or the golem pays no hidden kill bonus (30-ashdrake, 45-progression read
  // window.__companionHit); a woken golem pays the normal one. A smashed little golem counts toward your share.
  // =========================================================================
  const NO_BONUS = new Set(['giant_mithril', 'giant_stormstone', 'golemling', 'ginormous_golem']);
  let bonusWas, bonusHad = false, bonusOn = false;
  HOOKS.kill.unshift(m => { if (m && NO_BONUS.has(m.type)) { bonusHad = '__companionHit' in window; bonusWas = window.__companionHit; window.__companionHit = true; bonusOn = true; } });
  HOOKS.kill.push(m => {
    // put the flag back exactly as it was, absent included
    if (bonusOn) { if (bonusHad) window.__companionHit = bonusWas; else delete window.__companionHit; bonusOn = false; }
    if (m && m.type === 'golemling' && inMine()) { run.life.smashed++; if (!told('smash')) voice("Don't worry. Little golems pull themselves back together later. Golems always do."); }
  });

  // =========================================================================
  // 19. EVERY TICK
  // =========================================================================
  function resetRun() {
    run.raw = 0; run.hot = 0; run.guest = false; run.throwCd = 0; run.stones.length = 0; run.rocks.length = 0; run.debris.length = 0; run.rockT = 3;
    run.ores = {}; run.inChamber = false; run.pendingBanner = null;
    resetLife(); Object.assign(run.life, { lastHp: null, lastState: null, lastDead: null, lastMax: null });
    hold.on = false; kp.list = []; kp.done = null; slide.on = false; slide.t = 0;
  }
  function onEnterMine() {
    run.stones.length = 0; run.rocks.length = 0; run.debris.length = 0; run.rockT = 3; run.ores = {}; run.inChamber = false; run.lastX = player.x; run.lastY = player.y;
    resetLife(); Object.assign(run.life, { lastHp: null, lastState: null, lastDead: null, lastMax: null });
    syncGate();
  }
  function mineTick(dt) {
    syncGate();
    run.throwCd = Math.max(0, run.throwCd - dt);
    const inCh = !player.dead && inChamberPx(player.x, player.y);
    if (inCh && !run.inChamber) {
      if (!told('chamber')) voice('The Heart Chamber. The Ginormous Golem sits in the middle, asleep. Step into the gold ring to wake him.');
      if (!R().told.rules && !panel) { R().told.rules = true; save(); openPanel('rm_rules'); }
    }
    run.inChamber = inCh;
    const blocked = panel && !['skills', 'quests', 'map'].includes(panel);
    if (pressed.has('KeyT') && !blocked && !player.dead) throwHeart();
    const a = player.action;
    if (a && a.type === 'rm_vein' && (!golemAwake() || !veinLit(a.tx, a.ty, clock()))) player.action = null;
    for (const s of run.stones.slice()) { s.t += dt; if (s.t >= s.T) { run.stones.splice(run.stones.indexOf(s), 1); landStone(s); } }
    oreWatch(dt);
    rocksTick(dt);
    lifeTick(dt);
    if (!R().told.ling && lings().length) { R().told.ling = true; voice('A little golem! It is walking to the big one to be eaten. Smash it first!'); }
    // a shaking rock ends a tap's mining loop: whether to finish it is the knight's own choice
    if (typeof tap !== 'undefined' && tap.kind === 'monster' && tap.target && GIANT_TYPES.has(tap.target.type) && tap.target.state === 'stir' && (!player.action || player.action.type !== 'rm_giant')) tapCancel('done');
    if (inCharge()) { keeperOres(dt); keeperGolem(dt); }
    const w = Math.floor(clock() / NUM.VEIN_WINDOW);
    for (const k in run.quota) if (+k.split(':')[0] < w - 2) delete run.quota[k];
  }
  let lastWhere = null;
  HOOKS.update.push(dt => {
    seqTick(dt); knockTick(dt); holdTick(dt);
    if (run.pendingBanner) { levelBanner = run.pendingBanner; run.pendingBanner = null; }
    const here = window.INSTANCES ? INSTANCES.active() : null;
    if (here !== lastWhere) { if (here === RM) onEnterMine(); lastWhere = here; }
    if (here !== RM) { crumble(false); run.stones.length = 0; run.rocks.length = 0; }
    // a guest's visit ends when the knight leaves the underground
    if (here !== RM && here !== (DH ? DH.ID : 'deepholm')) run.guest = false;
    syncDeepholm();
    // the core ticks action types it does not know; ours finish here
    const a = player.action;
    if (a && a.need > 0 && a.t >= a.need) {
      if (a.type === 'rm_warm') finishWarm();
      else if (a.type === 'rm_giant') finishGiant(a);
      else if (a.type === 'rm_vein') finishVein(a);
      else if (a.type === 'rm_heat') finishHeat(a);
    }
    if (DH && here === DH.ID) {
      slideTick(dt);
      if (panel === 'rm_knock' && (pressed.has('KeyE') || pressed.has('Space'))) knockPress();
    } else if (slide.on) finishSlide(true);
    if (here === RM) mineTick(dt);
  });
  function onNewGame() {
    quest.royalmine = freshQuest();
    resetRun(); seqClear(); lastWhere = window.INSTANCES ? INSTANCES.active() : null;
    syncDeepholm();
  }
  HOOKS.newGame.push(onNewGame);

  // =========================================================================
  // 20. THE ART — a royal mine, lit and gilded; drawing never changes the game
  // =========================================================================
  const GOLD = '#e8b84a', GOLD_L = '#f7dc8a', GOLD_D = '#8a6418';
  const vis = pad => ({ x0: Math.max(0, Math.floor(cam.x / TILE) - pad), x1: Math.min(W - 1, Math.ceil((cam.x + VW) / TILE) + pad), y0: Math.max(0, Math.floor(cam.y / TILE) - pad), y1: Math.min(H - 1, Math.ceil((cam.y + VH) / TILE) + pad) });
  const FLOORISH = new Set(['.', '=', ':', 'h']);
  const COBBLE_ROOM = new Set(['.', '=', ':', 'h']);
  function heartPath(g, cx, cy, s) {
    g.beginPath(); g.moveTo(cx, cy + 9 * s);
    g.bezierCurveTo(cx - 11 * s, cy + 1 * s, cx - 9 * s, cy - 8 * s, cx - 4 * s, cy - 7.4 * s);
    g.bezierCurveTo(cx - 1.6 * s, cy - 7 * s, cx, cy - 5 * s, cx, cy - 3.6 * s);
    g.bezierCurveTo(cx, cy - 5 * s, cx + 1.6 * s, cy - 7 * s, cx + 4 * s, cy - 7.4 * s);
    g.bezierCurveTo(cx + 9 * s, cy - 8 * s, cx + 11 * s, cy + 1 * s, cx, cy + 9 * s); g.closePath();
  }
  // ---------- the floor layer: one item under everything that stands ----------
  function wallTrim(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    const S = FLOORISH.has(charAt(tx, ty + 1)), N = FLOORISH.has(charAt(tx, ty - 1)), Wt = FLOORISH.has(charAt(tx - 1, ty)), E = FLOORISH.has(charAt(tx + 1, ty));
    if (!(S || N || Wt || E)) return;
    if (S) {
      // the face you can see: dressed stone under a gilt cornice, a gold band where it meets the floor
      g.fillStyle = '#4b443c'; g.fillRect(x, y + 18, TILE, TILE - 18);
      g.fillStyle = '#57504a'; for (let k = 0; k < 2; k++) g.fillRect(x, y + 21 + k * 13, TILE, 5);
      g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(x, y + 32, TILE, 1.5); g.fillRect(x, y + 43.5, TILE, 1.5);
      const off = (tx % 2) * 12; for (const jx of [off + 6, off + 30]) { g.fillRect(x + jx, y + 20, 1.5, 12); g.fillRect(x + ((jx + 12) % TILE), y + 33, 1.5, 11); }
      g.fillStyle = GOLD_D; g.fillRect(x, y + 16, TILE, 4); g.fillStyle = GOLD; g.fillRect(x, y + 16, TILE, 2);
      g.fillStyle = GOLD; g.fillRect(x, y + TILE - 3, TILE, 3);
      g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(x, y + TILE - 3, TILE, 1);
    }
    g.fillStyle = GOLD;
    if (N) g.fillRect(x, y, TILE, 3);
    if (Wt) g.fillRect(x, y, 3, TILE);
    if (E) g.fillRect(x + TILE - 3, y, 3, TILE);
  }
  function inlay(g, tx, ty) {
    // a small gold figure set flush into the cut stone: carved first, then filled
    const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2, v = (DECOR[ty * W + tx] || 0) & 1;
    // a diamond, some with a ring inside (the build's rnd picks which): laid out on a grid, like a proper floor
    const shape = () => {
      g.beginPath(); g.moveTo(cx, cy - 9); g.lineTo(cx + 9, cy); g.lineTo(cx, cy + 9); g.lineTo(cx - 9, cy); g.closePath();
      if (v) { g.moveTo(cx + 4, cy); g.arc(cx, cy, 4, 0, 7); }
    };
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(30,22,10,0.45)'; g.lineWidth = 3.2; g.save(); g.translate(0.8, 0.8); shape(); g.stroke(); g.restore();
    g.strokeStyle = 'rgba(232,184,74,0.78)'; g.lineWidth = 1.8; shape(); g.stroke();
    g.fillStyle = 'rgba(247,220,138,0.85)'; g.beginPath(); g.arc(cx, cy, 1.4, 0, 7); g.fill();
    g.lineCap = 'butt';
  }
  function chamberCrack(g, tx, ty, glow) {
    // a thin zig-zag fissure in the chamber floor with a branch off it; the heartstone's red shows in it while he is awake
    if (hh(tx, ty, 3) > 0.17) return;
    const x = tx * TILE, y = ty * TILE, a0 = hh(tx, ty, 5) * Math.PI;
    const pts = []; let px = x + 8 + hh(tx, ty, 7) * 10, py = y + 12 + hh(ty, tx, 9) * 24;
    for (let k = 0; k < 5; k++) { pts.push([px, py]); const a = a0 + (k % 2 ? 0.7 : -0.7) + (hh(tx + k, ty, 11) - 0.5) * 0.5; px += Math.cos(a) * 7; py += Math.sin(a) * 6; }
    const path = () => {
      g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b));
      const [bx, by] = pts[2]; g.moveTo(bx, by); g.lineTo(bx + Math.cos(a0 + 1.4) * 7, by + Math.sin(a0 + 1.4) * 7);
    };
    g.lineCap = 'round';
    if (glow > 0.3) { g.strokeStyle = `rgba(255,90,40,${(0.25 * glow).toFixed(3)})`; g.lineWidth = 5; path(); g.stroke(); }
    g.strokeStyle = 'rgba(20,12,8,0.55)'; g.lineWidth = 1.6; path(); g.stroke();
    if (glow > 0.3) { g.strokeStyle = `rgba(255,${120 + Math.round(60 * glow)},60,${(0.6 * glow).toFixed(3)})`; g.lineWidth = 0.8; path(); g.stroke(); }
    g.lineCap = 'butt';
  }
  function floorTexUnder(g, tx, ty) {
    // a lamp, a seam or a pillar standing on cut stone keeps the cut stone under it (the tile's own texture is cave)
    const cob = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => COBBLE_ROOM.has(charAt(tx + dx, ty + dy)));
    const want = cob ? 'cobble' : 'cave', t = tileAt(tx, ty);
    if (TEX_NAME[t] === want) return;
    const img = tex[want + (variant[idx(tx, ty)] || 0)]; if (img) g.drawImage(img, tx * TILE, ty * TILE, TILE, TILE);
  }
  function drawBed(g, b) {
    const x = b.bed[0] * TILE, y = b.bed[1] * TILE, S = b.size * TILE, m = giantMon(b), mith = b.type === 'giant_mithril';
    g.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(g, x + 2, y + 6, S - 4, S - 4, 10); g.fill();
    g.fillStyle = '#5c554b'; roundRect(g, x + 4, y + 4, S - 8, S - 8, 10); g.fill();
    g.fillStyle = '#6a6358'; roundRect(g, x + 10, y + 10, S - 20, S - 20, 8); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 3; roundRect(g, x + 4, y + 4, S - 8, S - 8, 10); g.stroke();
    g.strokeStyle = GOLD_D; g.lineWidth = 1.5; roundRect(g, x + 10, y + 10, S - 20, S - 20, 8); g.stroke();
    g.fillStyle = GOLD_L; for (const [cx, cy] of [[x + 10, y + 10], [x + S - 10, y + 10], [x + 10, y + S - 10], [x + S - 10, y + S - 10]]) { g.beginPath(); g.arc(cx, cy, 3.2, 0, 7); g.fill(); }
    // a broken or woken rock leaves rubble on its bed until it grows back
    if (!m || m.dead) {
      const cx = x + S / 2, cy = y + S / 2 + 4;
      for (let k = 0; k < 9 + b.size * 3; k++) {
        const a = hh(b.i, k, 21) * Math.PI * 2, r = hh(k, b.i, 22) * S * 0.3;
        g.fillStyle = k % 3 === 0 ? (mith ? '#6f8fbf' : '#7a62b0') : k % 3 === 1 ? '#7d766a' : '#5f594f';
        g.beginPath(); g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, 5 + hh(b.i, k, 23) * 6, 4 + hh(k, b.i, 24) * 3, a, 0, 7); g.fill();
      }
    }
  }
  function drawSeat(g) {
    const cx = SEAT_C.x, cy = SEAT_C.y;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + 8, 58, 44, 0, 0, 7); g.fill();
    g.fillStyle = '#4f4940'; g.beginPath(); g.ellipse(cx, cy, 54, 42, 0, 0, 7); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 3; g.stroke();
    g.strokeStyle = GOLD_D; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy, 44, 33, 0, 0, 7); g.stroke();
  }
  function drawHeap(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty) + 6;
    // a little golem crawling out of it shakes it
    let shake = 0; for (const m of monsters) if (m.type === 'golemling' && !m.dead && m.state === 'emerge' && dist(m.x, m.y, tc(tx), tc(ty)) < 20) shake = 2.5;
    const sx = shake ? Math.sin(time * 50) * shake : 0;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + 8, 24, 9, 0, 0, 7); g.fill();
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, rr = 12 + hh(tx, ty, k) * 6;
      g.fillStyle = ['#6e675c', '#7d766a', '#5f594f'][k % 3];
      g.beginPath(); g.ellipse(cx + sx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.55, 6 + hh(k, ty, tx) * 3, 4.4, a, 0, 7); g.fill();
    }
    g.fillStyle = '#857d70'; g.beginPath(); g.ellipse(cx + sx, cy - 4, 12, 8, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,90,50,0.35)'; g.beginPath(); g.arc(cx + sx + 3, cy - 5, 2.4, 0, 7); g.fill();
  }
  function paintFloor(g, v) {
    const glow = golemAwake() ? 0.6 + 0.4 * Math.sin(time * 3) : 0.12;
    for (let ty = v.y0; ty <= v.y1; ty++) for (let tx = v.x0; tx <= v.x1; tx++) {
      const c = charAt(tx, ty), t = tileAt(tx, ty);
      if (c === '#') { wallTrim(g, tx, ty); continue; }
      if (c === 'L' || c === 'c' || c === 's' || c === 'm' || c === 'P') floorTexUnder(g, tx, ty);
      if (t === T.RUBBLE) { const img = tex['cave' + (variant[idx(tx, ty)] || 0)]; if (img) g.drawImage(img, tx * TILE, ty * TILE, TILE, TILE); drawRubbleProp(g, tx, ty); continue; }
      if (c === '.' && tx % 4 === 2 && ty % 4 === 2) inlay(g, tx, ty);
      else if (c === ':' || c === 'h') chamberCrack(g, tx, ty, glow);
    }
    for (const b of GIANTS) if (b.bed[0] + b.size >= v.x0 && b.bed[0] <= v.x1 && b.bed[1] + b.size >= v.y0 && b.bed[1] <= v.y1) drawBed(g, b);
    if (SEAT[1] + 2 >= v.y0 && SEAT[1] <= v.y1) drawSeat(g);
    for (const [x, y] of HEAPS) if (x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1) drawHeap(g, x, y);
    // the gate, open: its two leaves swung back against the doorway walls
    if (23 >= v.y0 && 23 <= v.y1 && tileAt(22, 23) !== GOLEM_GATE) for (const side of [-1, 1]) {
      const x = side < 0 ? 22 * TILE : 26 * TILE - 14, y = 23 * TILE - 10;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + (side < 0 ? 14 : -6), y + 8, 6, TILE + 2);
      g.fillStyle = '#6e6450'; g.fillRect(x, y, 14, TILE + 10); g.fillStyle = '#857a62'; g.fillRect(x + 2, y + 2, 10, TILE + 6);
      g.fillStyle = GOLD; g.fillRect(x, y + 6, 14, 3); g.fillRect(x, y + TILE - 2, 14, 3);
    }
  }
  function paintFloorFx(g) {
    const gm = golemMon(), awake = isAwake(gm);
    // the gold wake ring round the golem (red while he is awake)
    g.save(); g.lineWidth = 3; g.strokeStyle = awake ? 'rgba(240,82,77,0.75)' : (gm && !gm.dead ? `rgba(232,184,74,${(0.55 + 0.25 * Math.sin(time * 2)).toFixed(3)})` : 'rgba(232,184,74,0.25)');
    g.setLineDash([14, 8]); g.beginPath(); g.ellipse(SEAT_C.x, SEAT_C.y, NUM.WAKE_R * TILE, NUM.WAKE_R * TILE * 0.8, 0, 0, 7); g.stroke(); g.setLineDash([]);
    g.globalAlpha = 0.18; g.lineWidth = 10; g.stroke(); g.restore();
    // the slam: a red ring filling out to 3.2 tiles
    if (gm && gm.state === 'windup' && !gm.dead && run.life.windupAt !== null) {
      const k = clamp((time - run.life.windupAt) / (kid() ? NUM.KID_WINDUP : NUM.WINDUP), 0, 1), R2 = NUM.SLAM_R * TILE;
      g.fillStyle = `rgba(240,60,50,${(0.12 + 0.2 * k).toFixed(3)})`; g.beginPath(); g.ellipse(SEAT_C.x, SEAT_C.y, R2 * k, R2 * k * 0.8, 0, 0, 7); g.fill();
      g.strokeStyle = `rgba(255,80,60,${(0.6 + 0.35 * Math.sin(time * 20)).toFixed(3)})`; g.lineWidth = 3; g.setLineDash([8, 6]); g.beginPath(); g.ellipse(SEAT_C.x, SEAT_C.y, R2, R2 * 0.8, 0, 0, 7); g.stroke(); g.setLineDash([]);
    }
    // where the rocks will land
    for (const r of run.rocks) {
      const k = clamp(r.t / r.T, 0, 1), rad = lerp(8, NUM.ROCK_R, k);
      g.fillStyle = `rgba(0,0,0,${(0.2 + 0.45 * k).toFixed(3)})`; g.beginPath(); g.ellipse(r.x, r.y + 6, rad, rad * 0.6, 0, 0, 7); g.fill();
      g.strokeStyle = `rgba(240,82,77,${(0.35 + 0.45 * k).toFixed(3)})`; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.ellipse(r.x, r.y + 6, NUM.ROCK_R, NUM.ROCK_R * 0.6, 0, 0, 7); g.stroke(); g.setLineDash([]);
    }
    for (const d of run.debris) { const a = clamp(1 - d.t / 1.4, 0, 1); g.fillStyle = `rgba(110,103,92,${a.toFixed(3)})`; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(d.x + (k - 1.5) * 7, d.y + 6 + (k % 2) * 3, 5 - k * 0.5, 3.4, 0, 0, 7); g.fill(); } }
    // the little golems' paths: a faint dotted line to the one they are walking to
    if (gm && !gm.dead) { g.strokeStyle = 'rgba(255,120,80,0.45)'; g.lineWidth = 2; g.setLineDash([3, 7]); for (const m of lings()) if (m.state !== 'emerge') { g.beginPath(); g.moveTo(m.x, m.y + 4); g.lineTo(gm.x, gm.y + 10); g.stroke(); } g.setLineDash([]); }
  }

  // ---------- things that stand ----------
  function drawPillar(g, tx, ty) {
    const x = tc(tx), base = ty * TILE + TILE - 6, top = ty * TILE - 36;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x + 3, base + 3, 19, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#5a534a'; g.fillRect(x - 17, base - 12, 34, 12);
    g.fillStyle = GOLD; g.fillRect(x - 17, base - 13, 34, 3);
    const sg = g.createLinearGradient(x - 11, 0, x + 11, 0); sg.addColorStop(0, '#8f877a'); sg.addColorStop(0.35, '#b7ae9d'); sg.addColorStop(1, '#6a6358');
    g.fillStyle = sg; g.fillRect(x - 11, top + 10, 22, base - 13 - top - 10);
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (const fx of [-7, -2, 3, 8]) g.fillRect(x + fx, top + 12, 1.6, base - 26 - top);
    g.fillStyle = 'rgba(255,245,220,0.18)'; for (const fx of [-5, 0]) g.fillRect(x + fx, top + 12, 1.2, base - 26 - top);
    // the carved dwarf face at the foot: a brow, two eyes, and a beard that runs into the base
    const fy = base - 26;
    g.fillStyle = '#9d9483'; g.beginPath(); g.ellipse(x, fy, 9, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#5f584d'; g.fillRect(x - 7, fy - 5, 14, 2.5); g.beginPath(); g.arc(x - 3.5, fy - 1, 1.3, 0, 7); g.arc(x + 3.5, fy - 1, 1.3, 0, 7); g.fill();
    g.fillStyle = '#a89f8d'; g.beginPath(); g.moveTo(x - 8, fy + 2); g.quadraticCurveTo(x, fy + 16, x + 8, fy + 2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 3, fy + 4); g.lineTo(x - 2, fy + 10); g.moveTo(x + 3, fy + 4); g.lineTo(x + 2, fy + 10); g.stroke();
    // the gold capital
    g.fillStyle = GOLD_D; g.fillRect(x - 16, top + 2, 32, 10); g.fillStyle = GOLD; g.fillRect(x - 15, top + 2, 30, 6); g.fillStyle = GOLD_L; g.fillRect(x - 15, top + 2, 30, 2);
    g.fillStyle = '#7d7568'; g.fillRect(x - 18, top - 4, 36, 7);
    g.fillStyle = GOLD; g.beginPath(); g.arc(x - 11, top + 9, 2.6, 0, 7); g.arc(x + 11, top + 9, 2.6, 0, 7); g.fill();
  }
  function drawSeam(g, tx, ty, storm) {
    const x = tx * TILE, y = ty * TILE, cx = x + TILE / 2;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, y + TILE - 4, 20, 6, 0, 0, 7); g.fill();
    // the carved plinth, framed in gold
    g.fillStyle = '#5c554b'; g.fillRect(x + 5, y + 26, TILE - 10, 18);
    g.fillStyle = '#6d665a'; g.fillRect(x + 5, y + 26, TILE - 10, 5);
    g.strokeStyle = GOLD; g.lineWidth = 2; g.strokeRect(x + 5, y + 26, TILE - 10, 18);
    g.fillStyle = GOLD_L; g.beginPath(); g.arc(cx, y + 37, 2.4, 0, 7); g.fill();
    if (storm) {
      for (let k = 0; k < 5; k++) {
        const bx = cx - 13 + k * 6.5, h = 14 + Math.abs(2 - k) * -2 + 6;
        g.fillStyle = k % 2 ? '#8a6ac8' : '#6a4a9a'; g.beginPath(); g.moveTo(bx - 4, y + 27); g.lineTo(bx - 1, y + 27 - h); g.lineTo(bx + 2, y + 27 - h + 2); g.lineTo(bx + 4, y + 27); g.closePath(); g.fill();
      }
      g.strokeStyle = `rgba(220,200,255,${(0.4 + 0.6 * Math.max(0, Math.sin(time * 7 + tx))).toFixed(3)})`; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx - 6, y + 8); g.lineTo(cx - 1, y + 15); g.lineTo(cx - 4, y + 18); g.lineTo(cx + 3, y + 24); g.stroke();
    } else {
      for (const [ox, oy, r] of [[-9, 21, 7], [3, 19, 8.5], [11, 23, 6], [-2, 13, 6]]) { g.fillStyle = '#26262c'; g.beginPath(); g.ellipse(cx + ox, y + oy, r, r * 0.8, 0.3, 0, 7); g.fill(); }
      g.fillStyle = `rgba(255,150,60,${(0.4 + 0.3 * Math.sin(time * 3 + tx)).toFixed(3)})`; for (const [ox, oy] of [[-8, 19], [5, 16], [0, 11]]) { g.beginPath(); g.arc(cx + ox, y + oy, 1.4, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(cx + 1, y + 15, 1.2, 0, 7); g.fill();
    }
  }
  function veinFace(tx, ty) {
    // which way the vein looks: toward the chamber floor beside it
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) if (charAt(tx + dx, ty + dy) === ':' || charAt(tx + dx, ty + dy) === 'h') return [dx, dy];
    return [0, 1];
  }
  function drawVein(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, ms = clock(), awake = golemAwake(), lit = awake && veinLit(tx, ty, ms);
    const into = ms % NUM.VEIN_WINDOW, flash = lit && into < NUM.VEIN_FLASH * 1000 ? 1 - into / (NUM.VEIN_FLASH * 1000) : 0;
    const left = lit ? NUM.VEIN_TAKE - (run.quota[veinKey(ms, tx, ty)] || 0) : NUM.VEIN_TAKE;
    const [fx, fy] = veinFace(tx, ty), cx = x + TILE / 2 + fx * 8, cy = y + TILE / 2 + fy * 8;
    const pulse = 0.65 + 0.35 * Math.sin(time * 6 + tx), ang = Math.atan2(fy, fx);
    if (lit) {
      const gr = g.createRadialGradient(cx, cy, 4, cx, cy, 70); gr.addColorStop(0, `rgba(255,110,70,${(0.5 * pulse + 0.45 * flash).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,90,60,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 70, 0, 7); g.fill();
    }
    // the seam in the rock face
    g.fillStyle = lit ? '#5a1a10' : '#3a1610'; g.beginPath(); g.ellipse(cx - fx * 6, cy - fy * 6, 17, 13, ang, 0, 7); g.fill();
    // the crystals, pointing out of the wall toward the chamber: one for each stone this glow still holds
    for (let j = 0; j < 4; j++) {
      const a = ang + (j - 1.5) * 0.45 + (hh(tx, ty, j) - 0.5) * 0.2, len = 13 + hh(ty, tx, j) * 7, spent = j >= left;
      const bx = cx - fx * 6 + Math.cos(a + Math.PI / 2) * (j - 1.5) * 3, by = cy - fy * 6 + Math.sin(a + Math.PI / 2) * (j - 1.5) * 3;
      const tipx = bx + Math.cos(a) * (spent ? len * 0.35 : len), tipy = by + Math.sin(a) * (spent ? len * 0.35 : len), nx = -Math.sin(a) * 3.2, ny = Math.cos(a) * 3.2;
      g.fillStyle = spent ? '#4a1c14' : lit ? `rgb(255,${Math.round(90 + 70 * pulse + 60 * flash)},${Math.round(60 + 50 * flash)})` : '#7a2a1c';
      g.beginPath(); g.moveTo(bx + nx, by + ny); g.lineTo(tipx + nx * 0.4, tipy + ny * 0.4); g.lineTo(tipx, tipy); g.lineTo(tipx - nx * 0.4, tipy - ny * 0.4); g.lineTo(bx - nx, by - ny); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.stroke();
      if (!spent) { g.fillStyle = lit ? 'rgba(255,240,210,0.8)' : 'rgba(255,140,110,0.3)'; g.beginPath(); g.moveTo(bx + nx * 0.5, by + ny * 0.5); g.lineTo(tipx + nx * 0.2, tipy + ny * 0.2); g.lineTo(tipx, tipy); g.closePath(); g.fill(); }
    }
    if (lit) for (let k = 0; k < 3; k++) { const ph = (time * 1.4 + k / 3 + tx * 0.1) % 1; g.fillStyle = `rgba(255,${200 - k * 30},120,${(1 - ph).toFixed(3)})`; g.beginPath(); g.arc(cx + Math.sin(time * 3 + k * 2) * 8, cy - ph * 26, 1.6, 0, 7); g.fill(); }
  }
  function drawHeartForge(g, tx, ty) {
    const cx = tc(tx), y = ty * TILE, fl = Math.sin(time * 9 + tx) * 2;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx, y + TILE - 4, 24, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#4a433b'; roundRect(g, cx - 21, y + 8, 42, TILE - 12, 8); g.fill();
    g.fillStyle = '#5c544a'; roundRect(g, cx - 19, y + 8, 38, 12, 6); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 2; roundRect(g, cx - 21, y + 8, 42, TILE - 12, 8); g.stroke();
    const gr = g.createRadialGradient(cx, y + 14, 2, cx, y + 14, 30); gr.addColorStop(0, 'rgba(255,190,110,0.7)'); gr.addColorStop(1, 'rgba(255,90,40,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, y + 14, 30, 0, 7); g.fill();
    g.fillStyle = '#2a1a12'; heartPath(g, cx, y + 16, 1.25); g.fill();
    g.fillStyle = '#ff5a2a'; heartPath(g, cx, y + 15, 1.05); g.fill();
    g.fillStyle = '#ffb050'; g.beginPath(); g.moveTo(cx - 6, y + 17); g.quadraticCurveTo(cx - 5 + fl, y + 4, cx, y - 2 + fl); g.quadraticCurveTo(cx + 5 + fl, y + 4, cx + 6, y + 17); g.closePath(); g.fill();
    g.fillStyle = '#fff0c0'; g.beginPath(); g.moveTo(cx - 2.5, y + 16); g.quadraticCurveTo(cx - 2 + fl * 0.5, y + 8, cx, y + 5 + fl); g.quadraticCurveTo(cx + 2 + fl * 0.5, y + 8, cx + 2.5, y + 16); g.closePath(); g.fill();
    for (let k = 0; k < 3; k++) { const ph = (time * 0.9 + k * 0.33) % 1; g.fillStyle = `rgba(255,${170 + k * 20},80,${(1 - ph).toFixed(3)})`; g.beginPath(); g.arc(cx - 8 + k * 8 + Math.sin(time * 3 + k) * 3, y + 6 - ph * 26, 1.4, 0, 7); g.fill(); }
  }
  function drawGate(g) {
    const x0 = 22 * TILE, y = 23 * TILE, w = 4 * TILE, shake = R().stage <= 4 ? Math.sin(time * 23) * 1.2 : 0;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x0, y + TILE - 6, w, 8);
    for (const side of [0, 1]) {
      const lx = x0 + side * w / 2 + (side ? shake : -shake);
      g.fillStyle = '#5d554a'; g.fillRect(lx + 2, y - 16, w / 2 - 4, TILE + 12);
      g.fillStyle = '#6e6450'; g.fillRect(lx + 6, y - 12, w / 2 - 12, TILE + 4);
      g.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 0; k < 3; k++) g.fillRect(lx + 6, y - 2 + k * 14, w / 2 - 12, 2);
      g.fillStyle = GOLD; g.fillRect(lx + 2, y - 16, w / 2 - 4, 3); g.fillRect(lx + 2, y + TILE - 7, w / 2 - 4, 3);
      g.fillStyle = GOLD_L; for (const hy of [y - 6, y + 26]) { g.beginPath(); g.arc(side ? lx + w / 2 - 8 : lx + 8, hy, 3.4, 0, 7); g.fill(); }
      // half of the golem face carved across both leaves: an eye on each
      const ex = side ? lx + 20 : lx + w / 2 - 20;
      g.fillStyle = '#3a342c'; g.beginPath(); g.ellipse(ex, y + 6, 9, 6, 0, 0, 7); g.fill();
      g.fillStyle = `rgba(255,120,60,${(0.35 + 0.2 * Math.sin(time * 2)).toFixed(3)})`; g.beginPath(); g.ellipse(ex, y + 6, 5, 3, 0, 0, 7); g.fill();
    }
    // the carved heart where the leaves meet, and the brow over it
    g.fillStyle = '#3a342c'; heartPath(g, x0 + w / 2, y + 22, 1.5); g.fill();
    g.strokeStyle = GOLD_D; g.lineWidth = 2; heartPath(g, x0 + w / 2, y + 22, 1.5); g.stroke();
    g.fillStyle = '#4a433b'; g.fillRect(x0 + 24, y - 10, w - 48, 6);
  }
  function drawStairUp(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#231a12'; g.fillRect(x + 6, y + 4, TILE - 12, TILE - 4);
    for (let k = 0; k < 5; k++) { const sy = y + TILE - 8 - k * 8, w = TILE - 14 - k * 3; g.fillStyle = `rgb(${120 + k * 22},${100 + k * 20},${72 + k * 16})`; g.fillRect(x + TILE / 2 - w / 2, sy, w, 6); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + TILE / 2 - w / 2, sy + 5, w, 1.5); }
    const gr = g.createLinearGradient(0, y, 0, y + TILE); gr.addColorStop(0, 'rgba(255,233,176,0.55)'); gr.addColorStop(1, 'rgba(255,233,176,0)'); g.fillStyle = gr; g.fillRect(x + 6, y + 4, TILE - 12, TILE - 4);
    g.fillStyle = GOLD; g.fillRect(x + 3, y + 2, 4, TILE - 2); g.fillRect(x + TILE - 7, y + 2, 4, TILE - 2);
    g.fillStyle = GOLD_L; g.beginPath(); g.moveTo(x + 3, y + 6); g.quadraticCurveTo(x + TILE / 2, y - 12, x + TILE - 3, y + 6); g.lineTo(x + TILE - 7, y + 6); g.quadraticCurveTo(x + TILE / 2, y - 6, x + 7, y + 6); g.closePath(); g.fill();
  }
  function drawStairDown(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#1b130d'; g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    for (let k = 0; k < 5; k++) { const sy = y + 6 + k * 8, w = TILE - 12 - k * 4; g.fillStyle = `rgb(${128 - k * 20},${106 - k * 18},${78 - k * 14})`; g.fillRect(x + TILE / 2 - w / 2, sy, w, 6); }
    const gl = 0.35 + 0.15 * Math.sin(time * 2.2);
    const gr = g.createRadialGradient(x + TILE / 2, y + TILE - 8, 2, x + TILE / 2, y + TILE - 8, 34); gr.addColorStop(0, `rgba(255,190,110,${gl.toFixed(3)})`); gr.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = gr; g.fillRect(x, y, TILE, TILE);
    g.strokeStyle = GOLD; g.lineWidth = 3; g.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
  }
  // Pebble: small as a dog, heavy as a cart, with Hilde's warm stone glowing in his chest
  function drawPebble(g, x, y, pose) {
    const bob = pose === 'hold' ? Math.sin(time * 18) * 0.8 : Math.sin(time * 2.5) * 1.2, lean = pose === 'hold' ? 4 : 0;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 12, 15, 5, 0, 0, 7); g.fill();
    g.save(); g.translate(x + lean, y + bob);
    g.fillStyle = '#5f594f'; g.beginPath(); g.ellipse(-6, 9, 4.5, 3.5, 0, 0, 7); g.ellipse(6, 9, 4.5, 3.5, 0, 0, 7); g.fill();
    g.fillStyle = '#8a8275'; g.beginPath(); g.ellipse(0, -1, 14, 12, 0, 0, 7); g.fill();
    g.fillStyle = '#9d9587'; g.beginPath(); g.ellipse(-4, -6, 7, 5, -0.3, 0, 7); g.fill();
    g.fillStyle = '#6d665c'; g.beginPath(); g.ellipse(3, 6, 9, 4, 0, 0, 7); g.fill();
    // arms: out against the door, or down at his sides
    g.fillStyle = '#7d766a';
    if (pose === 'hold') { g.beginPath(); g.ellipse(13, -4, 6, 4, -0.3, 0, 7); g.ellipse(13, 4, 6, 4, 0.3, 0, 7); g.fill(); }
    else { g.beginPath(); g.arc(-14, 2, 4.5, 0, 7); g.arc(14, 2, 4.5, 0, 7); g.fill(); }
    const p = 0.7 + 0.3 * Math.sin(time * 3);
    const gr = g.createRadialGradient(0, 1, 1, 0, 1, 9); gr.addColorStop(0, `rgba(255,150,80,${(0.8 * p).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,100,50,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 1, 9, 0, 7); g.fill();
    g.fillStyle = '#ff7a3a'; heartPath(g, 0, 1, 0.42); g.fill();
    g.fillStyle = '#1e1a16'; g.beginPath(); g.arc(-4, -5, 2, 0, 7); g.arc(4, -5, 2, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(-3.4, -5.6, 0.8, 0, 7); g.arc(4.6, -5.6, 0.8, 0, 7); g.fill();
    g.fillStyle = '#5f8a3a'; g.beginPath(); g.ellipse(-2, -12, 6, 2.6, -0.2, 0, 7); g.fill();
    g.restore();
    if (dist(player.x, player.y, x, y) < 110) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText('Pebble', x, y - 22); g.fillStyle = '#ffe9a8'; g.fillText('Pebble', x, y - 22); }
  }

  // ---------- the giant ores: a boulder of its metal that cracks in three drawn stages ----------
  function drawGiantOre(g, e, hurt) {
    if (e.dead) return;
    const gd = NUM.GIANT[e.type]; if (!gd) return;
    const S = gd.size * TILE, mith = gd.metal === 'mithril', n = mith ? 11 : 13, id = Math.round((e.x || 0) / TILE) * 13 + Math.round((e.y || 0) / TILE) * 7 + (mith ? 1 : 2);
    // 09-render bobs a monster it thinks is moving; a rock never bobs
    if (e.moving) g.translate(0, -Math.sin(e.walkT || 0) * 2);
    const frac = e.maxHp ? clamp(e.hp / e.maxHp, 0, 1) : 1, st = e.state || 'idle';
    const shake = st === 'waking' ? 4.5 : st === 'stir' ? 2 : 0;
    const C = hurt ? { hi: '#fbe4e4', mid: '#e8c8c8', lo: '#b89898', deep: '#8a6a6a' }
      : mith ? { hi: '#a9c0e0', mid: '#7089b4', lo: '#4a5f86', deep: '#2f3d5a' } : { hi: '#a494d8', mid: '#6d5cae', lo: '#4a3c80', deep: '#2c2350' };
    const ore = mith ? '#dcebff' : '#e8dcff', oreDeep = mith ? '#5f8fd0' : '#9a6ae8', glowC = mith ? '160,210,255' : '210,170,255';
    const cy = -S * 0.1, rx = S * 0.46, ry = S * 0.44;
    g.save(); g.translate(shake ? Math.sin(time * 47 + e.x) * shake : 0, shake ? Math.cos(time * 39) * shake * 0.5 : 0);
    // the boulder's outline: lumpy, rounder on top, flat where it sits on its plinth
    const pts = [];
    for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + k / n * Math.PI * 2, rr = 0.88 + hh(id, k, 3) * 0.12; let y = cy + Math.sin(a) * ry * rr; if (y > S * 0.3) y = S * 0.3 + (y - S * 0.3) * 0.3; pts.push([Math.cos(a) * rx * rr, y]); }
    const outline = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
    const split = frac < 0.33 ? 6 : 0;
    // a shadow where it meets the plinth
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, S * 0.3, rx * 0.95, S * 0.08, 0, 0, 7); g.fill();
    for (const half of split ? [-1, 1] : [0]) {
      g.save();
      if (half) { g.beginPath(); g.rect(half < 0 ? -S : 0, -S, S, S * 2); g.clip(); g.translate(half * split, half < 0 ? 1 : 0); }
      const bg = g.createLinearGradient(-rx * 0.4, cy - ry, rx * 0.3, S * 0.3); bg.addColorStop(0, C.hi); bg.addColorStop(0.45, C.mid); bg.addColorStop(1, C.lo);
      g.fillStyle = bg; outline(); g.fill();
      // the lit top and the shadowed front, as two planes
      g.save(); outline(); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.ellipse(-rx * 0.22, cy - ry * 0.45, rx * 0.55, ry * 0.4, -0.35, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.moveTo(-rx, S * 0.08); g.quadraticCurveTo(0, S * 0.02, rx, S * 0.1); g.lineTo(rx, S * 0.4); g.lineTo(-rx, S * 0.4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-rx * 0.7, cy - ry * 0.1); g.lineTo(-rx * 0.15, cy + ry * 0.05); g.lineTo(rx * 0.45, cy - ry * 0.25); g.stroke();
      // nuggets of its metal set in the rock: six-sided, a dark rim, the metal, a bright top facet
      g.lineJoin = 'round';
      for (let k = 0; k < (mith ? 7 : 6); k++) {
        const a = hh(id, k, 41) * Math.PI * 2, d = 0.15 + Math.sqrt(hh(k, id, 42)) * 0.6, r = (mith ? 6 : 7) + hh(id, k, 43) * gd.size * 2.6;
        const nx = Math.cos(a) * rx * d, ny = cy + Math.sin(a) * ry * d * 0.85, tw = hh(k, id, 44) * 1.2;
        const hex = (rr) => { g.beginPath(); for (let j = 0; j < 6; j++) { const t = tw + j / 6 * Math.PI * 2, q = rr * (0.82 + hh(id + j, k, 45) * 0.26); const px = nx + Math.cos(t) * q, py = ny + Math.sin(t) * q * 0.82; j ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); };
        g.fillStyle = C.deep; hex(r); g.fill();
        g.fillStyle = oreDeep; hex(r * 0.74); g.fill();
        g.fillStyle = ore; g.beginPath(); g.moveTo(nx - r * 0.5, ny - r * 0.1); g.lineTo(nx - r * 0.1, ny - r * 0.55); g.lineTo(nx + r * 0.3, ny - r * 0.25); g.closePath(); g.fill();
      }
      if (!mith) {
        // stormstone: lightning living in the rock
        if (Math.sin(time * 5 + e.x) > 0.55) { g.strokeStyle = 'rgba(240,230,255,0.95)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-rx * 0.5, cy + ry * 0.05); g.lineTo(-rx * 0.2, cy + ry * 0.25); g.lineTo(-rx * 0.3, cy + ry * 0.38); g.lineTo(rx * 0.05, cy + ry * 0.55); g.stroke(); }
      }
      g.restore();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2.2; outline(); g.stroke();
      if (!mith) {
        // and a crown of crystals breaking out of its top
        for (let k = 0; k < 5; k++) {
          const bx = -rx * 0.42 + k * rx * 0.21, by = cy - ry * 0.78 + Math.abs(k - 2) * 6, hgt = S * (0.2 - Math.abs(k - 2) * 0.035);
          g.fillStyle = k % 2 ? '#d4c0ff' : '#a98ae8'; g.beginPath(); g.moveTo(bx - 7, by + 4); g.lineTo(bx - 3, by - hgt); g.lineTo(bx + 3, by - hgt * 0.9); g.lineTo(bx + 7, by + 4); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(40,20,80,0.5)'; g.lineWidth = 1.2; g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(bx - 3.5, by); g.lineTo(bx - 2, by - hgt * 0.85); g.lineTo(bx - 0.5, by); g.closePath(); g.fill();
        }
      }
      if (frac <= 0.66) {
        // deep cracks, and chips gone from the rim
        g.strokeStyle = 'rgba(10,8,14,0.9)'; g.lineWidth = 3.4; g.beginPath();
        g.moveTo(-rx * 0.65, cy - ry * 0.2); g.lineTo(-rx * 0.28, cy - ry * 0.05); g.lineTo(-rx * 0.12, cy + ry * 0.3);
        g.moveTo(rx * 0.2, cy - ry * 0.7); g.lineTo(rx * 0.36, cy - ry * 0.3); g.lineTo(rx * 0.62, cy - ry * 0.15); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-rx * 0.64, cy - ry * 0.24); g.lineTo(-rx * 0.27, cy - ry * 0.09); g.stroke();
        g.fillStyle = '#1e1822'; for (const k of [2, n - 3]) { const [px, py] = pts[k]; g.beginPath(); g.moveTo(px, py); g.lineTo(px * 0.76, py * 0.8 + 3); g.lineTo(px * 0.9, py * 0.9 + 9); g.closePath(); g.fill(); }
      }
      g.restore();
    }
    if (frac > 0.66) for (let k = 0; k < 6; k++) { const a = hh(id, k, 21) * 6.28, d = hh(k, id, 22) * rx * 0.7, tw = Math.max(0, Math.sin(time * 3 + k * 1.7)); if (tw < 0.2) continue; const x = Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8; g.fillStyle = `rgba(255,255,255,${(0.9 * tw).toFixed(3)})`; g.beginPath(); g.moveTo(x, y - 3.5 * tw); g.lineTo(x + 1.2, y); g.lineTo(x, y + 3.5 * tw); g.lineTo(x - 1.2, y); g.closePath(); g.fill(); }
    if (split) {
      // split open: the seam glows through the gap, and grit falls out of it
      const gr = g.createLinearGradient(0, cy - ry, 0, S * 0.3); gr.addColorStop(0, `rgba(${glowC},0)`); gr.addColorStop(0.5, `rgba(${glowC},0.9)`); gr.addColorStop(1, `rgba(${glowC},0.2)`);
      g.fillStyle = gr; g.fillRect(-split, cy - ry * 0.9, split * 2, ry * 1.6 + S * 0.1);
      for (let k = 0; k < 5; k++) { const ph = (time * 1.2 + k / 5) % 1; g.fillStyle = `rgba(160,150,135,${(1 - ph).toFixed(3)})`; g.beginPath(); g.arc(Math.sin(k * 2.1) * 5, cy + ph * (S * 0.42 - cy), 1.8, 0, 7); g.fill(); }
    }
    // rubble chipped off it, lying on the plinth
    if (frac <= 0.66) for (let k = 0; k < (split ? 6 : 3); k++) { g.fillStyle = k % 2 ? C.mid : C.lo; g.beginPath(); g.ellipse(-rx * 0.8 + hh(id, k, 31) * rx * 1.6, S * 0.3 + hh(k, id, 32) * 6, 4 + hh(id, k, 33) * 3, 3, 0, 0, 7); g.fill(); }
    if (st === 'stir' || st === 'waking') {
      // something inside is waking: two eyes, glowing in its metal's colour, in the deepest crack
      const wide = st === 'waking' ? 1.5 : 1, blink = st === 'stir' && Math.sin(time * 2.3 + e.x) > 0.94 ? 0.2 : 1, ey = cy - ry * 0.02;
      const eg = g.createRadialGradient(0, ey, 1, 0, ey, S * 0.32); eg.addColorStop(0, `rgba(${glowC},0.55)`); eg.addColorStop(1, `rgba(${glowC},0)`); g.fillStyle = eg; g.beginPath(); g.arc(0, ey, S * 0.32, 0, 7); g.fill();
      g.fillStyle = '#10141c'; g.beginPath(); g.ellipse(0, ey, 20 * wide, 8 * wide, 0, 0, 7); g.fill();
      g.fillStyle = mith ? '#e6f4ff' : '#f4ecff'; for (const ex of [-9, 9]) { g.beginPath(); g.ellipse(ex * wide, ey, 5 * wide, 3.4 * blink * wide, 0, 0, 7); g.fill(); }
      g.fillStyle = mith ? '#4a9aff' : '#b070ff'; for (const ex of [-9, 9]) { g.beginPath(); g.arc(ex * wide, ey, 2 * blink * wide, 0, 7); g.fill(); }
    }
    g.restore();
  }
  HOOKS.drawMonster.giant_mithril = (g, e, hurt) => drawGiantOre(g, e, hurt);
  HOOKS.drawMonster.giant_stormstone = (g, e, hurt) => drawGiantOre(g, e, hurt);

  // ---------- the woken golems: boulder bodies, two glowing eyes, a heavy two-step walk ----------
  function drawWokenGolem(g, e, hurt, big) {
    if (e.dead) return;
    if (e.rmBorn === undefined) e.rmBorn = time;
    const up = clamp((time - e.rmBorn) / 0.6, 0, 1);
    const wt = e.walkT || 0, mv = e.moving, step = mv ? Math.sin(wt * 0.8) : 0, s = big ? 1.4 : 1;
    const c = big ? { a: '#5a4a8e', b: '#6f5fb0', d: '#3f3468', seam: '#c8b0ff', eye: '#e0c8ff' } : { a: '#6f7f92', b: '#8a9aae', d: '#4f5c6c', seam: '#bcd8f5', eye: '#bfe4ff' };
    if (hurt) { c.a = '#e8c0c0'; c.b = '#f4d4d4'; c.d = '#c8a0a0'; }
    const dir = (e.facing && e.facing.x < -0.1) ? -1 : 1;
    if (e.moving) g.translate(0, -Math.sin(e.walkT || 0) * 2);
    g.save(); g.translate(0, (1 - up) * 18 + Math.abs(step) * 2.5); g.scale(s * dir * (0.6 + up * 0.4), s * (0.6 + up * 0.4));
    // legs, one stamp at a time
    g.fillStyle = c.d; roundRect(g, -13, 3 - Math.max(0, step) * 5, 10, 14, 3); g.fill(); roundRect(g, 3, 3 - Math.max(0, -step) * 5, 10, 14, 3); g.fill();
    // arms, raised as fists when it swings
    const raise = e.attackT > 0 ? 12 : 0;
    g.fillStyle = c.a; roundRect(g, -23, -16 - raise + step * 2, 9, 17, 3); g.fill(); roundRect(g, 14, -16 - raise - step * 2, 9, 17, 3); g.fill();
    g.fillStyle = c.d; g.beginPath(); g.arc(-18.5, 3 - raise + step * 2, 5.5, 0, 7); g.arc(18.5, 3 - raise - step * 2, 5.5, 0, 7); g.fill();
    if (!big) { g.fillStyle = GOLD; g.fillRect(-23, -3 - raise + step * 2, 9, 3); g.fillRect(14, -3 - raise - step * 2, 9, 3); }
    // the body: blocks of the rock it woke from, broad at the shoulder
    const bg = g.createLinearGradient(-15, -22, 15, 6); bg.addColorStop(0, c.b); bg.addColorStop(1, c.a);
    g.fillStyle = bg; g.beginPath(); g.moveTo(-17, -20); g.lineTo(17, -20); g.lineTo(13, 6); g.lineTo(-13, 6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = c.seam; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-11, -15); g.lineTo(-5, -9); g.lineTo(-8, -1); g.moveTo(6, -16); g.lineTo(11, -8); g.lineTo(7, 2); g.stroke();
    if (big) {
      for (const sx of [-1, 1]) { g.fillStyle = '#c8b0ff'; g.beginPath(); g.moveTo(sx * 13, -19); g.lineTo(sx * 18, -31); g.lineTo(sx * 22, -19); g.closePath(); g.fill(); }
      if (Math.sin(time * 9 + (e.x || 0)) > 0.4) { g.strokeStyle = 'rgba(240,230,255,0.95)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-9, -14); g.lineTo(-4, -8); g.lineTo(-7, -4); g.lineTo(-2, 1); g.stroke(); }
    }
    // the head and two glowing eyes
    g.fillStyle = c.b; roundRect(g, -9, -32, 18, 13, 4); g.fill();
    g.fillStyle = c.d; g.fillRect(-9, -25, 18, 2.5);
    const ep = 0.7 + 0.3 * Math.sin(time * 5 + (e.x || 0));
    g.fillStyle = `rgba(255,255,255,${(0.25 * ep).toFixed(3)})`; g.beginPath(); g.arc(-3.5, -28, 4.5, 0, 7); g.arc(3.5, -28, 4.5, 0, 7); g.fill();
    g.fillStyle = c.eye; g.beginPath(); g.arc(-3.5, -28, 2.2, 0, 7); g.arc(3.5, -28, 2.2, 0, 7); g.fill();
    g.restore();
  }
  HOOKS.drawMonster.mithril_golem = (g, e, hurt) => drawWokenGolem(g, e, hurt, false);
  HOOKS.drawMonster.stormstone_golem = (g, e, hurt) => drawWokenGolem(g, e, hurt, true);

  // ---------- the little golems: three stacked pebbles on stubby legs, a glowing red chip held up high ----------
  function drawLittle(g, e, hurt) {
    if (e.dead) return;
    const emerge = e.state === 'emerge', mv = e.moving && !emerge, wt = e.walkT || 0, lp = mv ? Math.sin(wt * 1.3) * 3 : 0;
    if (e.moving) g.translate(0, -Math.sin(e.walkT || 0) * 2);
    g.save();
    if (emerge) { g.translate(Math.sin(time * 40) * 1.5, 12); g.scale(0.8, 0.8); }
    g.fillStyle = hurt ? '#e0b0a0' : '#666158'; g.beginPath(); g.ellipse(-4 + lp * 0.4, 9, 3.4, 2.6, 0, 0, 7); g.ellipse(4 - lp * 0.4, 9, 3.4, 2.6, 0, 0, 7); g.fill();
    g.translate(0, mv ? -Math.abs(Math.sin(wt * 1.3)) * 2 : 0);
    g.fillStyle = hurt ? '#f0c8b8' : '#7d766a'; g.beginPath(); g.ellipse(0, 3, 9, 6.5, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#f8d8c8' : '#958e80'; g.beginPath(); g.ellipse(0, -5, 7, 5.5, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#f8d8c8' : '#a8a092'; g.beginPath(); g.ellipse(0, -12, 5, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#1e1a16'; g.beginPath(); g.arc(-2, -12.5, 1.1, 0, 7); g.arc(2, -12.5, 1.1, 0, 7); g.fill();
    // arms up, holding the chip over its head
    g.strokeStyle = hurt ? '#e8c0b0' : '#7f7a70'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-6, -4); g.lineTo(-5, -18); g.moveTo(6, -4); g.lineTo(5, -18); g.stroke();
    const p = 0.6 + 0.4 * Math.sin(time * 6 + (e.x || 0) * 0.1);
    const gr = g.createRadialGradient(0, -21, 0.5, 0, -21, 10); gr.addColorStop(0, `rgba(255,110,70,${(0.7 * p).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,90,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, -21, 10, 0, 7); g.fill();
    g.fillStyle = '#ff5a3c'; g.beginPath(); g.moveTo(-4.5, -19); g.lineTo(-1, -25); g.lineTo(4, -23); g.lineTo(3.5, -18); g.closePath(); g.fill();
    g.fillStyle = '#ffd0a0'; g.beginPath(); g.arc(-0.5, -22, 1.1, 0, 7); g.fill();
    g.restore();
  }
  HOOKS.drawMonster.golemling = (g, e, hurt) => drawLittle(g, e, hurt);

  // ---------- the Ginormous Golem: a mountain sitting down ----------
  const G_STONE = '#6d665c', G_LIGHT = '#8a8275', G_DARK = '#4f4940', G_DEEP = '#3d3831', G_MOSS = '#5f8a3a', G_MOSS_L = '#7aa84a';
  function drawColossus(g, e, flash) {
    const st = e.state || 'sleep', asleep = !AWAKE.has(st), frac = e.maxHp ? clamp(e.hp / e.maxHp, 0, 1) : 1, half = frac <= 0.5 && !asleep;
    const riseK = st === 'rise' && golemRiseAt !== null ? clamp((time - golemRiseAt) / NUM.RISE, 0, 1) : asleep ? 0 : 1;
    const breath = asleep ? 1 + Math.sin(time * 1.2) * 0.02 : 1 + Math.sin(time * 2.6) * 0.008;
    const shake = st === 'slam' ? Math.sin(time * 60) * 3 : 0;
    g.save(); g.translate(shake, 0);
    g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.ellipse(0, 40, 108, 26, 0, 0, 7); g.fill();
    g.translate(0, 40); g.scale(breath, breath); g.translate(0, -40);
    // the torso: a mountain, lit from the top left
    const TORSO = [[-80, 34], [-88, -18], [-68, -94], [-36, -116], [36, -116], [68, -94], [88, -18], [80, 34]];
    const tg = g.createLinearGradient(-80, -116, 80, 34); tg.addColorStop(0, G_LIGHT); tg.addColorStop(0.55, G_STONE); tg.addColorStop(1, G_DARK);
    g.fillStyle = tg; g.beginPath(); TORSO.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2.5; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 3; for (const y of [-70, -30, 6]) { g.beginPath(); g.moveTo(-76 + (y + 70) * 0.05, y); g.quadraticCurveTo(0, y + 8, 76 - (y + 70) * 0.05, y - 4); g.stroke(); }
    g.fillStyle = 'rgba(255,245,225,0.12)'; g.beginPath(); g.moveTo(-66, -90); g.lineTo(-34, -112); g.lineTo(-40, -70); g.lineTo(-76, -40); g.closePath(); g.fill();
    // the furnace in his chest: the heartstone he ate
    const hp = 0.75 + 0.25 * Math.sin(time * (half ? 7 : 3.2)), glow = asleep ? 0.35 : 1;
    const fg = g.createRadialGradient(0, -52, 2, 0, -52, 58); fg.addColorStop(0, `rgba(255,120,60,${(0.55 * glow * hp).toFixed(3)})`); fg.addColorStop(1, 'rgba(255,90,40,0)');
    g.fillStyle = fg; g.beginPath(); g.arc(0, -52, 58, 0, 7); g.fill();
    g.fillStyle = G_DEEP; g.beginPath(); g.ellipse(0, -52, 28, 23, 0, 0, 7); g.fill();
    g.strokeStyle = GOLD_D; g.lineWidth = 3; g.stroke();
    const hg = g.createRadialGradient(-5, -58, 1, 0, -52, 20); hg.addColorStop(0, glow > 0.5 ? '#ffe0a0' : '#c86a4a'); hg.addColorStop(0.5, glow > 0.5 ? '#ff6a2a' : '#8a2a1a'); hg.addColorStop(1, glow > 0.5 ? '#b8281a' : '#4a1410');
    g.fillStyle = hg; heartPath(g, 0, -53, 2.0); g.fill();
    // red cracks that multiply as he wears down
    const cracks = frac < 0.2 ? 5 : frac < 0.4 ? 4 : frac < 0.6 ? 3 : frac < 0.8 ? 2 : frac < 0.97 ? 1 : 0;
    const CR = [[[-52, -80], [-40, -62], [-50, -44], [-38, -30]], [[46, -84], [54, -64], [42, -50]], [[-62, -10], [-46, -2], [-54, 16]], [[30, -20], [48, -8], [40, 10], [56, 22]], [[-20, -100], [-8, -88], [-16, -76]]];
    const cp = 0.55 + 0.45 * Math.sin(time * (half ? 9 : 4));
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < cracks; k++) {
      g.strokeStyle = '#2a0e08'; g.lineWidth = 5; g.beginPath(); CR[k].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      g.strokeStyle = `rgba(255,${90 + Math.round(70 * cp)},50,${(0.6 + 0.4 * cp).toFixed(3)})`; g.lineWidth = 2.2; g.stroke();
    }
    // the head: a block with a gold-edged brow, bowed while he sleeps
    const drop = (1 - riseK) * 16;
    g.save(); g.translate(0, drop); if (asleep) g.rotate(0.06);
    g.fillStyle = G_STONE; roundRect(g, -36, -164, 72, 56, 12); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; roundRect(g, -36, -164, 72, 56, 12); g.stroke();
    g.fillStyle = 'rgba(255,245,225,0.12)'; roundRect(g, -30, -160, 30, 14, 6); g.fill();
    g.fillStyle = G_DEEP; g.fillRect(-34, -148, 68, 11);
    g.fillStyle = GOLD; g.fillRect(-34, -149, 68, 3); g.fillStyle = GOLD_D; g.fillRect(-34, -138, 68, 2);
    if (asleep && riseK <= 0) { g.strokeStyle = '#2a1a12'; g.lineWidth = 3; for (const ex of [-14, 14]) { g.beginPath(); g.moveTo(ex - 7, -128); g.lineTo(ex + 7, -128); g.stroke(); } }
    else {
      const eyeC = half ? '255,70,50' : '255,170,70', ep = 0.75 + 0.25 * Math.sin(time * 6);
      for (const ex of [-14, 14]) { const eg = g.createRadialGradient(ex, -128, 0.5, ex, -128, 14); eg.addColorStop(0, `rgba(${eyeC},${(ep * Math.max(0.3, riseK)).toFixed(3)})`); eg.addColorStop(1, `rgba(${eyeC},0)`); g.fillStyle = eg; g.beginPath(); g.arc(ex, -128, 14, 0, 7); g.fill(); }
      g.fillStyle = half ? '#ffd0c0' : '#fff0c0'; for (const ex of [-14, 14]) { g.beginPath(); g.ellipse(ex, -128, 6, 3.4 * Math.max(0.3, riseK), 0, 0, 7); g.fill(); }
      g.fillStyle = half ? '#ff3a20' : '#ff7a1a'; for (const ex of [-14, 14]) { g.beginPath(); g.arc(ex, -128, 2.2, 0, 7); g.fill(); }
    }
    g.strokeStyle = G_DEEP; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, -116); g.lineTo(-4, -114); g.lineTo(6, -117); g.lineTo(14, -115); g.stroke();
    g.fillStyle = G_MOSS; g.beginPath(); g.ellipse(-8, -165, 18, 5, 0, 0, 7); g.fill();
    g.restore();
    // shoulders, mossy from fifty years of sitting still
    for (const sd of [-1, 1]) {
      g.fillStyle = G_STONE; g.beginPath(); g.arc(sd * 72, -90, 28, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(255,245,225,0.12)'; g.beginPath(); g.arc(sd * 72 - 7, -98, 13, 0, 7); g.fill();
      g.fillStyle = G_MOSS; g.beginPath(); g.ellipse(sd * 74, -113, 18, 7, sd * 0.3, 0, 7); g.fill(); g.fillStyle = G_MOSS_L; g.beginPath(); g.ellipse(sd * 68, -116, 8, 3.5, 0, 0, 7); g.fill();
    }
    // arms: fists on the floor, both up in the windup, driven down in the slam
    const up = st === 'windup';
    for (const sd of [-1, 1]) {
      if (up) {
        g.fillStyle = G_DARK; g.beginPath(); g.ellipse(sd * 86, -130, 16, 34, sd * -0.35, 0, 7); g.fill();
        g.fillStyle = GOLD; g.save(); g.translate(sd * 90, -140); g.rotate(sd * -0.35); g.fillRect(-15, -4, 30, 7); g.restore();
        g.fillStyle = G_LIGHT; g.beginPath(); g.ellipse(sd * 64, -186, 24, 20, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.stroke();
      } else {
        const fy = st === 'slam' ? 38 : 26;
        g.fillStyle = G_DARK; g.beginPath(); g.ellipse(sd * 94, -48, 18, 30, sd * 0.15, 0, 7); g.fill();
        g.fillStyle = G_STONE; roundRect(g, sd * 98 - 15, -24, 30, 42, 12); g.fill();
        g.fillStyle = GOLD; g.fillRect(sd * 98 - 16, -12, 32, 7); g.fillStyle = GOLD_L; g.fillRect(sd * 98 - 16, -12, 32, 2);
        g.fillStyle = G_LIGHT; g.beginPath(); g.ellipse(sd * 98, fy, 25, 19, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; for (const k of [-8, 0, 8]) { g.beginPath(); g.moveTo(sd * 98 + k, fy - 12); g.lineTo(sd * 98 + k, fy - 2); g.stroke(); }
      }
    }
    // the knees, folded in front of him, and his feet
    for (const sd of [-1, 1]) {
      g.fillStyle = G_DARK; g.beginPath(); g.ellipse(sd * 60, 34, 22, 12, 0, 0, 7); g.fill();
      g.fillStyle = G_STONE; g.beginPath(); g.ellipse(sd * 40, 16, 30, 22, sd * 0.2, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(255,245,225,0.1)'; g.beginPath(); g.ellipse(sd * 36, 8, 14, 8, 0, 0, 7); g.fill();
    }
    // hit: he flashes white; mended: a green ring round the furnace
    if (flash) { g.globalAlpha = 0.45; g.fillStyle = '#ffffff'; g.beginPath(); TORSO.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); roundRect(g, -36, -164 + drop, 72, 56, 12); g.fill(); g.globalAlpha = 1; }
    const mk = clamp(1 - (time - run.mendFlash) / 0.9, 0, 1);
    if (mk > 0) { g.strokeStyle = `rgba(150,235,110,${(0.85 * mk).toFixed(3)})`; g.lineWidth = 4; g.beginPath(); g.arc(0, -52, 32 + (1 - mk) * 30, 0, 7); g.stroke(); }
    if (asleep) for (let k = 0; k < 3; k++) { const ph = (time * 0.35 + k / 3) % 1; g.fillStyle = `rgba(210,200,185,${(0.5 * (1 - ph)).toFixed(3)})`; g.font = `bold ${12 + Math.round(ph * 8)}px sans-serif`; g.textAlign = 'center'; g.fillText('z', 30 + k * 8 + ph * 16, -170 - ph * 40); }
    g.restore();
  }
  let golemRiseAt = null;
  function drawFallen(g, x, y) {
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 38, 110, 24, 0, 0, 7); g.fill();
    for (const [bx, by, rx, ry, c] of [[-78, 22, 24, 16, G_DARK], [80, 20, 22, 15, G_DARK], [-44, 26, 30, 16, G_STONE], [46, 28, 28, 14, G_STONE], [0, 32, 36, 12, G_DARK], [-20, -2, 42, 30, G_STONE], [26, -6, 38, 28, G_LIGHT]]) { g.fillStyle = c; g.beginPath(); g.ellipse(bx, by, rx, ry, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.stroke(); }
    for (const sd of [-1, 1]) { g.fillStyle = G_MOSS; g.beginPath(); g.ellipse(sd * 30, -26, 14, 5, sd * 0.3, 0, 7); g.fill(); }
    // the head, tipped over at his side, and the heartstone barely lit
    g.save(); g.translate(62, 6); g.rotate(1.1); g.fillStyle = G_STONE; roundRect(g, -30, -24, 60, 46, 10); g.fill(); g.fillStyle = GOLD; g.fillRect(-28, -14, 56, 3); g.restore();
    const p = 0.25 + 0.1 * Math.sin(time * 2);
    g.fillStyle = `rgba(255,110,60,${p.toFixed(3)})`; heartPath(g, -4, -4, 1.4); g.fill();
    g.restore();
  }
  // the core draws each monster through HOOKS.drawMonster and puts a small name tag at its middle; for the golem
  // that middle is his chest, so in the mine he is drawn by this file's own item just over the core's (the boss
  // bar says who he is) and the core's pass draws nothing. Anywhere else (the book's portrait) he draws small.
  HOOKS.drawMonster.ginormous_golem = (g, e, hurt) => {
    if (e.dead || (inMine() && monsters.includes(e))) return;
    g.save(); g.scale(0.42, 0.42); g.translate(0, 60); drawColossus(g, e, false); g.restore();
  };

  // ---------- the knight: the stones he carries, the pick swing, the stone warming in his hand ----------
  function drawCarry(g) {
    if (player.dead) return;
    const a = player.action, ang = Math.atan2(player.facing.y, player.facing.x);
    if (a && (a.type === 'rm_giant' || a.type === 'rm_vein')) {
      const sw = Math.sin(time * 14) * 0.6;
      g.save(); g.translate(player.x, player.y); g.rotate(ang - 0.7 + sw); g.fillStyle = '#6b4a2a'; g.fillRect(2, -1.5, 26, 3);
      g.fillStyle = hasHeartPick() ? '#e0583c' : (a.tier >= 3 ? '#7aa0d0' : a.tier === 2 ? '#a9adb5' : '#b8863a');
      g.beginPath(); g.moveTo(24, -2); g.quadraticCurveTo(30, -8, 34, -6); g.lineTo(30, 0); g.lineTo(34, 6); g.quadraticCurveTo(30, 8, 24, 2); g.closePath(); g.fill(); g.restore();
    }
    if (a && (a.type === 'rm_heat' || a.type === 'rm_warm')) {
      // the stone held into the heat, reddening as it warms
      const k = clamp(a.t / (a.need || 1), 0, 1), hx = player.x + Math.cos(ang) * 22, hy = player.y + Math.sin(ang) * 22 - 6;
      const gr = g.createRadialGradient(hx, hy, 1, hx, hy, 16); gr.addColorStop(0, `rgba(255,190,110,${(0.3 + 0.6 * k).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,120,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, 16, 0, 7); g.fill();
      g.fillStyle = `rgb(${Math.round(122 + 133 * k)},${Math.round(42 + 110 * k)},${Math.round(28 + 30 * k)})`; g.beginPath(); g.arc(hx, hy, 5.5, 0, 7); g.fill();
    }
    if (!inMine() || run.raw + run.hot <= 0) return;
    // the lump in his hand: glowing if it is hot
    const hot = run.hot > 0, hx = player.x + Math.cos(ang) * 13, hy = player.y + Math.sin(ang) * 9 - 4;
    if (hot) { const p = 0.65 + 0.35 * Math.sin(time * 7); const gr = g.createRadialGradient(hx, hy, 1, hx, hy, 14); gr.addColorStop(0, `rgba(255,200,110,${(0.75 * p).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, 14, 0, 7); g.fill(); }
    g.fillStyle = hot ? '#ff9a3a' : '#7a2a1c'; g.beginPath(); g.moveTo(hx - 5, hy + 3); g.lineTo(hx - 4, hy - 3); g.lineTo(hx + 1, hy - 5); g.lineTo(hx + 5, hy - 1); g.lineTo(hx + 3, hy + 4); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.stroke();
    // and the rest, counted over his head: dull ones raw, bright ones hot
    const n = run.raw + run.hot;
    for (let i = 0; i < n; i++) {
      const isHot = i < run.hot, x = player.x + (i - (n - 1) / 2) * 9, y = player.y - 44;
      g.fillStyle = isHot ? '#ffb050' : '#8a3a2e'; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 3.5, y); g.lineTo(x, y + 4); g.lineTo(x - 3.5, y); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
    }
  }
  function drawFalling(g) {
    for (const r of run.rocks) {
      const k = r.t / r.T; if (k < 0.7) continue;
      const h = (1 - (k - 0.7) / 0.3) * 160, x = r.x, y = r.y - h;
      g.fillStyle = '#6e675c'; g.beginPath(); g.ellipse(x, y, 15, 12, 0.3, 0, 7); g.fill();
      g.fillStyle = '#8a8275'; g.beginPath(); g.ellipse(x - 4, y - 4, 6, 4, 0.3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, 15, 12, 0.3, 0, 7); g.stroke();
    }
  }
  function drawStones(g) {
    for (const s of run.stones) {
      const m = monsters.includes(s.m) ? s.m : golemMon(), tx = m ? m.x : s.x0, ty = m ? m.y - 70 : s.y0, k = clamp(s.t / s.T, 0, 1), arc = 50 + dist(s.x0, s.y0, tx, ty) * 0.18;
      const at = kk => [lerp(s.x0, tx, kk), lerp(s.y0, ty, kk) - Math.sin(kk * Math.PI) * arc];
      // a fireball's tail of sparks along the arc, then the stone itself: red-hot, dark-edged so it shows against him
      for (let j = 6; j >= 1; j--) { const [xx, yy] = at(Math.max(0, k - j * 0.04)); g.fillStyle = `rgba(255,${120 + j * 14},50,${(0.6 - j * 0.08).toFixed(3)})`; g.beginPath(); g.arc(xx, yy, 7.5 - j * 0.9, 0, 7); g.fill(); }
      const [x, y] = at(k);
      const gr = g.createRadialGradient(x, y, 1, x, y, 24); gr.addColorStop(0, 'rgba(255,210,120,0.95)'); gr.addColorStop(1, 'rgba(255,110,40,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 24, 0, 7); g.fill();
      g.fillStyle = '#7a1e10'; g.beginPath(); g.arc(x, y, 8.5, 0, 7); g.fill();
      g.fillStyle = '#ff7a2a'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
      g.fillStyle = '#ffd070'; g.beginPath(); g.arc(x - 1, y - 1, 4, 0, 7); g.fill(); g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(x - 2, y - 2.5, 1.8, 0, 7); g.fill();
    }
  }
  // the next thing to do, marked in gold: the golem, the nearest forge, or the nearest glowing vein
  function nextTarget() {
    if (!inMine() || player.dead || !inChamberPx(player.x, player.y)) return null;
    const gm = golemMon(); if (!gm || gm.dead) return null;
    if (!isAwake(gm)) return { x: SEAT_C.x, y: SEAT_C.y - 150, kind: 'golem' };
    if (run.hot > 0) return { x: gm.x, y: gm.y - 175, kind: 'golem' };
    if (run.raw > 0) { let best = null; for (const [x, y] of FORGES) { const d = dist(player.x, player.y, tc(x), tc(y)); if (!best || d < best.d) best = { x: tc(x), y: tc(y) - 30, d, kind: 'forge' }; } return best; }
    const ms = clock(); let best = null;
    for (const [x, y] of litVeins(ms)) { if ((run.quota[veinKey(ms, x, y)] || 0) >= NUM.VEIN_TAKE) continue; const d = dist(player.x, player.y, tc(x), tc(y)); if (!best || d < best.d) best = { x: tc(x), y: tc(y) - 30, d, kind: 'vein' }; }
    return best;
  }
  function drawMarker(g) {
    const tg = nextTarget(); if (!tg) return;
    const b = Math.abs(Math.sin(time * 4)) * 8;
    // off the screen (a narrow iPad at a forge, say): the same chevron waits at the screen's edge, pointing the way
    const m = 30, x0 = cam.x + m, x1 = cam.x + VW - m, y0 = cam.y + m + 24, y1 = cam.y + VH - m;
    const off = tg.x < x0 || tg.x > x1 || tg.y - 17 < y0 || tg.y > y1;
    g.save();
    if (off) { const x = clamp(tg.x, x0, x1), y = clamp(tg.y, y0, y1); g.translate(x, y); g.rotate(Math.atan2(tg.y - y, tg.x - x) - Math.PI / 2); g.translate(0, b * 0.6); }
    else g.translate(tg.x, tg.y - b);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.moveTo(-13, -16); g.lineTo(13, -16); g.lineTo(0, 2); g.closePath(); g.fill();
    g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(-11, -17); g.lineTo(11, -17); g.lineTo(0, 0); g.closePath(); g.fill();
    g.fillStyle = '#fff2b0'; g.beginPath(); g.moveTo(-5, -15); g.lineTo(1, -15); g.lineTo(-2, -9); g.closePath(); g.fill();
    g.restore();
  }

  // ---------- the draw hook: (g, items, cam); every item's draw() takes no arguments ----------
  HOOKS.draw.push((g, items) => {
    const a = player.action;
    if (a && (a.type === 'rm_warm' || a.type === 'rm_giant' || a.type === 'rm_vein' || a.type === 'rm_heat') && !inMine()) items.push({ y: player.y + player.r + 0.02, draw: () => drawCarry(g) });
    if (inMine()) {
      const v = vis(2);
      items.push({ y: -1, draw: () => paintFloor(g, v) });
      items.push({ y: -0.5, draw: () => paintFloorFx(g) });
      for (let ty = v.y0; ty <= v.y1; ty++) for (let tx = v.x0; tx <= v.x1; tx++) {
        const t = tileAt(tx, ty);
        if (t === ROYAL_PILLAR) items.push({ y: ty * TILE + TILE - 5, draw: () => drawPillar(g, tx, ty) });
        else if (t === ROYAL_COAL || t === ROYAL_STORMSTONE) items.push({ y: ty * TILE + TILE - 4, draw: () => drawSeam(g, tx, ty, t === ROYAL_STORMSTONE) });
        else if (t === HEART_VEIN) items.push({ y: ty * TILE + TILE - 2, draw: () => drawVein(g, tx, ty) });
        else if (t === HEART_FORGE) items.push({ y: ty * TILE + TILE - 6, draw: () => drawHeartForge(g, tx, ty) });
        else if (t === ROYAL_STAIR) items.push({ y: ty * TILE + TILE - 8, draw: () => drawStairUp(g, tx, ty) });
      }
      if (tileAt(22, 23) === GOLEM_GATE && v.y0 <= 24 && v.y1 >= 22) items.push({ y: 24 * TILE - 4, draw: () => drawGate(g) });
      const pb = pebblePx(); if (pb) items.push({ y: pb.y + 13, draw: () => drawPebble(g, pb.x, pb.y, tileAt(22, 23) === GOLEM_GATE ? 'hold' : 'idle') });
      const gm = golemMon();
      if (gm && !gm.dead) items.push({ y: gm.y + gm.r + 0.01, draw: () => { g.save(); g.translate(gm.x, gm.y); drawColossus(g, gm, gm.hurtT > 0 || time - run.hitFlash < 0.12); g.restore(); } });
      else if (gm || run.life.fallen) items.push({ y: SEAT_C.y + 41, draw: () => drawFallen(g, SEAT_C.x, SEAT_C.y) });
      items.push({ y: player.y + player.r + 0.02, draw: () => drawCarry(g) });
      items.push({ y: 1e9 + 2, draw: () => { drawFalling(g); drawStones(g); } });
      items.push({ y: 1e9 + 3, draw: () => drawMarker(g) });
      return;
    }
    if (!inDeep()) return;
    if (tileAt(STAIR_DOWN[0], STAIR_DOWN[1]) === ROYAL_STAIR) {
      items.push({ y: -1, draw: () => drawStairDown(g, STAIR_DOWN[0], STAIR_DOWN[1]) });
      // the warm light of the Royal Mine coming up the stair, over the dark
      items.push({ y: 1e9 + 1, draw: () => {
        const x = tc(STAIR_DOWN[0]), y = tc(STAIR_DOWN[1]), p = 0.75 + 0.25 * Math.sin(time * 2.2);
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(x, y, 4, x, y, 64); gr.addColorStop(0, `rgba(255,200,120,${(0.4 * p).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 64, 0, 7); g.fill();
        for (let k = 0; k < 4; k++) { const ph = (time * 0.5 + k / 4) % 1; g.fillStyle = `rgba(255,220,150,${(0.6 * Math.sin(ph * Math.PI)).toFixed(3)})`; g.beginPath(); g.arc(x - 12 + k * 8 + Math.sin(time + k) * 3, y + 10 - ph * 40, 1.6, 0, 7); g.fill(); }
        g.restore();
      } });
    }
    // the Kingstone's crest on the top rail of the throne's back (24 sets its stud lower, where the seated king
    // hides it): the mithril stone until the all-clear, then an empty socket
    const crest = (px, ty, empty) => {
      const y = ty * TILE + 1, arch = r => { g.beginPath(); g.arc(px, y, r, Math.PI, 0); g.lineTo(px + r, y + 4); g.lineTo(px - r, y + 4); g.closePath(); };
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.save(); g.translate(0, 1.5); arch(8.5); g.fill(); g.restore();
      g.fillStyle = '#f5c542'; arch(8); g.fill(); g.strokeStyle = GOLD_D; g.lineWidth = 1.2; g.stroke();
      if (empty) { g.fillStyle = '#1a1614'; g.beginPath(); g.arc(px, y - 1, 4, 0, 7); g.fill(); g.strokeStyle = '#8a8d95'; g.lineWidth = 1.2; g.stroke(); }
      else { g.fillStyle = ITEMS.kingstone.color; g.beginPath(); g.arc(px, y - 1, 4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(px - 1.3, y - 2.3, 1.3, 0, 7); g.fill(); }
    };
    if (slide.on && DH.drawThrone) items.push({ y: 23 * TILE + TILE - 6, draw: () => { const fx = 14 + 2 * ease(slide.t / NUM.SLIDE); DH.drawThrone(g, fx, 23); crest(tc(fx), 23, R().stage >= 4); } });
    else {
      const at = tileAt(14, 23) === DW_THRONE ? 14 : tileAt(16, 23) === DW_THRONE ? 16 : null;
      if (at !== null) items.push({ y: 23 * TILE + TILE - 6 + 0.01, draw: () => crest(tc(at), 23, at === 16 || R().stage >= 4) });
    }
    const pb = pebblePx(); if (pb) items.push({ y: pb.y + 13, draw: () => drawPebble(g, pb.x, pb.y, 'idle') });
  });

  // =========================================================================
  // 21. THE HUD — a chip under the boss bar, THROW on touch, and three panels
  // =========================================================================
  function linesFor(g, text, maxW) {
    const words = String(text).split(' '), out = []; let ln = '';
    for (const w of words) { const t = ln ? ln + ' ' + w : w; if (g.measureText(t).width > maxW && ln) { out.push(ln); ln = w; } else ln = t; }
    if (ln) out.push(ln);
    return out;
  }
  function chipInfo() {
    const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE), room = roomAt(tx, ty), inCh = inChamberT(tx, ty);
    let line1 = null, tone = null;
    if (inCh) {
      const gm = golemMon();
      if (!gm || gm.dead) line1 = 'THE GOLEM IS DOWN. UP AGAIN SOON';
      else if (!isAwake(gm)) line1 = 'STEP INTO THE GOLD RING TO WAKE HIM';
      else if (gm.state === 'windup' && inSlam()) { line1 = 'GET BACK! HE IS GOING TO SLAM'; tone = HK.C.BAD; }
      else if (lings().some(m => dist(m.x, m.y, SEAT_C.x, SEAT_C.y) <= 4 * TILE)) { line1 = 'SMASH THE LITTLE GOLEM!'; tone = HK.C.BAD; }
      else if (inShadow()) { line1 = 'MOVE! A ROCK IS FALLING'; tone = HK.C.WARN; }
      else if (run.hot > 0) { line1 = touch() ? 'THROW IT! Tap THROW' : 'THROW IT! (T)'; tone = HK.C.GOOD; }
      else if (run.raw > 0) line1 = 'HEAT IT AT A FORGE';
      else line1 = 'MINE A GLOWING VEIN';
    } else if (room === RECTS.hall) line1 = 'READ THE CARVED PILLARS';
    else if (room === RECTS.seams) line1 = 'COAL, MITHRIL AND STORMSTONE';
    else if (room === RECTS.giant) line1 = 'GIANT ROCKS: MINING 20';
    else if (room === RECTS.deep) line1 = R().stage <= 4 && !run.guest ? 'PEBBLE IS AT THE BIG DOOR' : 'GIANT ROCKS: MINING 30';
    else if (room === RECTS.chamber) line1 = 'THE HEART CHAMBER IS AHEAD';
    return { title: room ? room.name.toUpperCase() : 'THE ROYAL MINE', line1, tone, inCh, line2: inCh || carrying() ? `RAW ${run.raw} · HOT ${run.hot} · CARRY ${NUM.CARRY}` : null };
  }
  function drawChip(g) {
    const info = chipInfo(), pad = 9, L = HK.LINE(), inner = HK.colW() - pad * 2 - 8;
    g.font = 'bold 12px sans-serif'; const l1 = info.line1 ? linesFor(g, info.line1, inner) : [];
    const s = HK.slot(pad * 2 + L * (1 + l1.length + (info.line2 ? 1 : 0)) + 3);
    HK.plate(g, s.x, s.y, s.w, s.h, { tone: info.tone });
    let y = s.y + pad + L - 3; const x = s.x + pad + 4;
    g.textAlign = 'left'; g.fillStyle = HK.C.INK; g.font = `700 13px ${DISPLAY}`; g.fillText(info.title, x, y);
    g.font = 'bold 12px sans-serif'; g.fillStyle = HK.C.INK; for (const ln of l1) { y += L; g.fillText(ln, x, y); }
    if (info.line2) { y += L; g.font = '12px sans-serif'; g.fillStyle = HK.C.DIM; g.fillText(info.line2, x, y); }
    if (touch() && info.inCh) { const b = HK.slot(HK.row()); HK.control(g, b.x, b.y, HK.ctrlW(), b.h, `THROW (${run.hot})`, () => throwHeart(), { tone: run.hot > 0 ? HK.C.GOOD : null, enabled: run.hot > 0 }); }
  }
  HOOKS.hud.push(g => {
    if (!inMine() || paused || panel || (typeof title !== 'undefined' && title && title.active)) return;
    drawChip(g);
  });
  // the core's boss bar (10-hud) shows any big monster within 12 tiles; the golem asleep behind his door, seen from
  // the Deep, is left out of it until he wakes or you walk into his chamber
  const _drawBossBars = drawBossBars;
  drawBossBars = function (g, y) {
    const gm = inMine() ? golemMon() : null;
    if (gm && !gm.dead && !isAwake(gm) && !inChamberPx(player.x, player.y)) { gm.dead = true; try { return _drawBossBars(g, y); } finally { gm.dead = false; } }
    return _drawBossBars(g, y);
  };
  // the dots of a rhythm, laid out by when each knock comes
  function drawRhythm(g, cx, cy, w, pat, lit) {
    const span = 1.6, x0 = cx - w / 2;
    for (const t of pat) { const x = x0 + (t / span) * w; g.fillStyle = lit ? '#ffe3a0' : '#f2f6fa'; g.beginPath(); g.arc(x, cy, 9, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5; g.stroke(); }
  }
  HOOKS.panel.rm_listen = (g, narrow) => {
    const w = Math.min(440, VW - 20), bh = Math.max(HK.row(), 58), gap = 10, h = 72 + 3 * (bh + gap) + HK.row() + 28;
    const { px, py } = panelBox(g, w, h, 'WHAT DID YOU HEAR?', 'Tap the knock you heard under the throne.');
    let y = py + 70;
    [PATTERNS.miner, PATTERNS.slow, PATTERNS.quick].forEach((pat, i) => {
      HK.control(g, px + 18, y, w - 36, bh, '', () => answerListen(i + 1), { hit: 'knock:' + (i + 1) });
      drawRhythm(g, px + w / 2, y + bh / 2, Math.min(260, w - 110), pat, false);
      y += bh + gap;
    });
    HK.control(g, px + w / 2 - 80, y + 4, 160, HK.row(), 'Listen again', () => { closePanel(); startListen(); }, { hit: 'Listen again' });
  };
  HOOKS.panel.rm_knock = (g, narrow) => {
    const w = Math.min(420, VW - 20), h = 350;
    const { px, py } = panelBox(g, w, h, 'THE ALL-CLEAR', 'Three slow knocks, like a big clock.');
    const cx = px + w / 2;
    for (let i = 0; i < 3; i++) {
      const sx = cx + (i - 1) * 60, sy = py + 92;
      g.strokeStyle = HK.C.DIM; g.lineWidth = 2; g.beginPath(); g.arc(sx, sy, 16, 0, 7); g.stroke();
      if (i < kn.slots) { g.fillStyle = HK.C.GOLD; g.beginPath(); g.arc(sx, sy, 12, 0, 7); g.fill(); }
    }
    const r = 58, by = py + 200, k = kn.slots > 0 ? clamp((time - kn.last) / NUM.KNOCK_RING, 0, 1) : 1;
    HK.disc(g, cx, by, r, 'KNOCK', { tone: k >= 1 ? HK.C.GOOD : null });
    g.strokeStyle = k >= 1 ? HK.C.GOOD : HK.C.WARN; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, by, r + 10, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke(); g.lineCap = 'butt';
    buttons.push({ x: cx - r, y: by - r, w: r * 2, h: r * 2, label: 'KNOCK', action: knockPress });
    g.fillStyle = HK.C.DIM; g.font = '12px sans-serif'; g.textAlign = 'center';
    g.fillText(touch() ? 'Tap KNOCK. Wait for the ring to turn green.' : 'Press E or Space. Wait for the ring to turn green.', cx, py + h - 20);
    g.textAlign = 'left';
  };
  // the rules card: six small pictures, one line each
  function rulePic(g, k, x, y, w, h) {
    const cx = x + w / 2, cy = y + h / 2;
    g.save(); roundRect(g, x, y, w, h, 6); g.fillStyle = 'rgba(40,32,26,0.9)'; g.fill(); g.clip();
    if (k === 0) { g.fillStyle = '#4b443c'; g.fillRect(x, y, w, h); g.strokeStyle = '#ff5a3c'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 12, cy + 8); g.lineTo(cx - 3, cy - 2); g.lineTo(cx + 2, cy + 4); g.lineTo(cx + 12, cy - 9); g.stroke(); g.fillStyle = '#ffd08a'; g.beginPath(); g.arc(cx + 2, cy + 4, 2.5, 0, 7); g.fill(); }
    else if (k === 1) { g.fillStyle = '#5c544a'; g.fillRect(cx - 12, cy - 4, 24, 16); g.fillStyle = '#ff5a2a'; heartPath(g, cx, cy - 3, 0.8); g.fill(); g.fillStyle = '#ffb050'; g.beginPath(); g.moveTo(cx - 4, cy - 2); g.quadraticCurveTo(cx, cy - 16, cx + 4, cy - 2); g.closePath(); g.fill(); }
    else if (k === 2) { g.fillStyle = G_STONE; g.fillRect(cx + 4, cy - 12, 16, 20); g.fillStyle = '#ff7a1a'; g.beginPath(); g.arc(cx + 9, cy - 6, 1.8, 0, 7); g.arc(cx + 15, cy - 6, 1.8, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,160,80,0.8)'; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(cx - 18, cy + 10); g.quadraticCurveTo(cx - 8, cy - 16, cx + 2, cy - 4); g.stroke(); g.setLineDash([]); g.fillStyle = '#ff9a3a'; g.beginPath(); g.arc(cx - 18, cy + 10, 4, 0, 7); g.fill(); }
    else if (k === 3) { g.fillStyle = '#958e80'; g.beginPath(); g.ellipse(cx, cy + 4, 8, 6, 0, 0, 7); g.ellipse(cx, cy - 5, 6, 5, 0, 0, 7); g.fill(); g.fillStyle = '#ff5a3c'; g.beginPath(); g.arc(cx, cy - 13, 3, 0, 7); g.fill(); g.strokeStyle = '#f0524d'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 13, cy - 13); g.lineTo(cx + 13, cy + 13); g.moveTo(cx + 13, cy - 13); g.lineTo(cx - 13, cy + 13); g.stroke(); }
    else if (k === 4) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.ellipse(cx, cy + 9, 15, 6, 0, 0, 7); g.fill(); g.fillStyle = '#8a8275'; g.beginPath(); g.ellipse(cx, cy - 8, 8, 6, 0.3, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 3, cy - 18); g.lineTo(cx - 3, cy - 14); g.moveTo(cx + 3, cy - 18); g.lineTo(cx + 3, cy - 14); g.stroke(); }
    else { g.strokeStyle = '#f0524d'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, cy + 8, 20, 7, 0, 0, 7); g.stroke(); g.fillStyle = G_LIGHT; g.beginPath(); g.ellipse(cx, cy - 4, 10, 8, 0, 0, 7); g.fill(); g.fillStyle = GOLD; g.fillRect(cx - 10, cy - 1, 20, 3); }
    g.restore();
  }
  function ruleLines() {
    return ['Mine a glowing red vein in the wall.', 'Heat the stone at a forge.',
      touch() ? 'Throw it at the golem. Tap THROW, or tap the golem.' : `Throw it at the golem. Press ${keyName('T')}, or click the golem.`,
      'Smash little golems before they reach him. They make him better.', 'Dark spot on the floor? A rock is falling. Move!', 'Stand too close and he slams the floor. Keep back.'];
  }
  HOOKS.panel.rm_rules = (g, narrow) => {
    const w = Math.min(540, VW - 20), head = 58, foot = HK.row() + 26;
    const rowH = clamp(Math.floor((Math.min(VH - 20, 540) - head - foot) / 6), 34, 60), h = head + rowH * 6 + foot;
    const { px, py } = panelBox(g, w, h, '', null);
    // the title, fitted to the width left of the close button
    let fs = 17; g.font = `700 ${fs}px ${DISPLAY}`; while (fs > 11 && g.measureText('HOW TO BEAT THE GINORMOUS GOLEM').width > w - 36 - HK.row() - 12) { fs--; g.font = `700 ${fs}px ${DISPLAY}`; }
    g.fillStyle = HK.C.INK; g.textAlign = 'left'; g.fillText('HOW TO BEAT THE GINORMOUS GOLEM', px + 18, py + 32);
    const lines = ruleLines(), picW = 52, tx = px + 18 + picW + 12, tw = w - (tx - px) - 18;
    for (let i = 0; i < 6; i++) {
      const y = py + head + i * rowH;
      rulePic(g, i, px + 18, y + 3, picW, rowH - 6);
      g.font = rowH >= 44 ? '14px sans-serif' : '12px sans-serif'; g.fillStyle = HK.C.INK;
      const ls = linesFor(g, lines[i], tw), lh = rowH >= 44 ? 17 : 14, top = y + rowH / 2 - (ls.length - 1) * lh / 2 + 5;
      ls.forEach((ln, j) => g.fillText(ln, tx, top + j * lh));
    }
    button(g, px + w / 2 - 70, py + h - HK.row() - 14, 140, HK.row(), 'GOT IT', () => closePanel(), '#238636');
  };

  // =========================================================================
  // 22. LIGHT — lit like a palace, not a cave
  // =========================================================================
  if (window.INSTANCE_LIGHT) INSTANCE_LIGHT.set(RM, 'lamplit');
  if (window.LIGHTS) {
    LIGHTS.scene(RM, {
      ambient: { color: '#0a0806', alpha: 0.45 }, player: { r: 140, lift: 0.75 },
      rooms: [
        { name: 'Hall of Kings', x0: 18, y0: 3, x1: 29, y1: 12, lift: 0.85, color: '#ffd489', tint: 0.16 },
        { name: 'Royal Seams', x0: 3, y0: 3, x1: 15, y1: 12, lift: 0.7, color: '#ffcf9c', tint: 0.08 },
        { name: 'Giant Hall', x0: 32, y0: 3, x1: 44, y1: 13, lift: 0.75, color: '#ffd489', tint: 0.10 },
        { name: 'The Deep', x0: 5, y0: 15, x1: 42, y1: 22, lift: 0.5, color: '#ffc98a', tint: 0.07 },
        { name: 'Heart Chamber', x0: 12, y0: 24, x1: 35, y1: 40, lift: 0.8, color: '#ff9a6a', tint: 0.14 },
      ],
    });
    LIGHTS.add({ name: 'royal stair', tile: 'ROYAL_STAIR', r: 130, color: '#ffcf7a', tint: 0.14 });
    LIGHTS.add({ name: 'heart forge', tile: 'HEART_FORGE', r: 160, color: '#ff5a1e', flicker: 0.14, speed: 8.5 });
    LIGHTS.addSource((out, sc) => {
      if (!sc || sc.id !== RM) return;
      const gm = golemMon(), awake = isAwake(gm);
      if (awake) for (const [x, y] of litVeins(clock())) out.push({ kind: 'point', name: 'heartstone vein', x: tc(x), y: tc(y), r: 90, lift: 0.9, tint: 0.2, color: '#ff5a3c', rgb: [255, 90, 60] });
      if (gm && !gm.dead) out.push({ kind: 'point', name: 'the golem\'s heart', x: gm.x, y: gm.y - 52, r: 160, lift: awake ? 0.9 : 0.5, tint: awake ? 0.22 : 0.1, color: '#ff6a3d', rgb: [255, 106, 61] });
    });
  }

  // =========================================================================
  // 23. THE AUDIT, THE KEYS, THE BOOK
  // =========================================================================
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    const P = window.PLAYTHROUGH, gs = lv => P && P.gatherSecs ? P.gatherSecs(lv, lv) : 4;
    add('mining', 'royal coal seam (Royal Mine)', 10, 50, gs(10), 'bronze tool, at the level it opens');
    add('mining', 'royal stormstone seam (Royal Mine)', 24, 95, gs(24), 'bronze tool, at the level it opens');
    add('mining', 'giant mithril ore, a crack (Royal Mine)', 20, 40, 1.5, 'every swing lands; six cracks a rock');
    add('mining', 'giant stormstone ore, a crack', 30, 70, 1.7, 'every swing lands; nine cracks a rock');
    add('mining', 'heartstone vein (Heart Chamber)', 1, 30, 1.0, 'while the Ginormous Golem is awake');
    add('mining', 'Ginormous Golem fight bonus', 1, 200, 120, 'every fall you helped with');
    add('mining', 'The Knocking Under the Throne (once)', 1, 800, 0, 'quest');
    add('smithing', 'heat heartstone at a heart forge', 1, 25, 0.8, 'the Heart Chamber');
    add('smithing', "Hilde's heartstone (once)", 1, 60, 0, 'quest');
    add('smithing', 'Ginormous Golem fight bonus', 1, 200, 120, 'every fall you helped with');
    add('smithing', 'The Knocking Under the Throne (once)', 1, 800, 0, 'quest');
    add('melee', 'hot heartstone on the Ginormous Golem (2 a damage)', 1, 110, 2.5, 'about 55 a stone');
    add('melee', 'Ginormous Golem fight bonus', 1, 200, 120, 'every fall you helped with');
    if (P && P.killXp && P.killSecs) {
      // how many the rocks can give in an hour: four mithril beds, one in three wakes; two stormstone, one in two
      const mPerH = 4 * 3600 / (6 * 1.5 + NUM.GIANT.giant_mithril.regrow) / 3, sPerH = 2 * 3600 / (9 * 1.7 + NUM.GIANT.giant_stormstone.regrow) / 2;
      add('melee', 'Mithril golem (Royal Mine)', 30, P.killXp('mithril_golem'), P.killSecs('mithril_golem', 30).ttk + 3, 'woken out of a giant mithril ore', P.killXp('mithril_golem') * mPerH);
      add('melee', 'Stormstone golem (Royal Mine)', 42, P.killXp('stormstone_golem'), P.killSecs('stormstone_golem', 42).ttk + 3, 'woken out of a giant stormstone ore', P.killXp('stormstone_golem') * sPerH);
    }
  });
  HOOKS.keyHelp.push({ action: 'Throw hot heartstone (Royal Mine)', codes: ['KeyT'] });
  if (window.WIKI) {
    WIKI.add('places', { id: 'the_royal_mine', name: 'The Royal Mine', sub: "Under King Thrain's throne", kind: 'instance', lines: [
      "The dwarves' royal mine, under King Thrain's throne in Deepholm. Shut for fifty years. When he has your favour, the throne slides aside onto a stair.",
      '',
      'THE HALL OF KINGS: where the stair comes down. Carved pillars tell you how the mine works: press E on one, or tap it.',
      'THE ROYAL SEAMS (west): coal (Mining 10), mithril (20) and stormstone (24). They grow back fast.',
      'THE GIANT HALL (east): four giant mithril ores, 2 by 2 (Mining 20).',
      'THE DEEP: two giant stormstone ores, 3 by 3 (Mining 30), and Pebble at the big stone gate.',
      'THE HEART CHAMBER, past the gate: the Ginormous Golem. Read his page for how to beat him.',
    ] });
    WIKI.add('quests', { id: 'royalmine', name: 'The Knocking Under the Throne', giver: 'King Thrain, in Deepholm (after the great forge is lit)',
      reward: '1000 coins, 800 Mining xp, 800 Smithing xp, and the Royal Mine', lines: [
        'King Thrain cannot sleep: something knocks under his throne. Listen, and pick the knock you heard.',
        'Hilde knows that knock. Warm her cold heartstone at a forge, then knock the all-clear on the throne: three slow knocks.',
        'The throne slides aside onto a stair. At the bottom of the Royal Mine, Pebble is holding a door shut. Beat what is behind it.',
        'Reward: 1000 coins, 800 Mining xp and 800 Smithing xp, and the Ginormous Golem stands up again, as often as you like.',
      ] });
    const rock = 'A rock, not a beast: mine it with a pickaxe (E, or tap it). Its level is the Mining level it needs. Every swing cracks it; when it breaks it gives you a heap of ore, unless it shakes first. A shaking rock is waking up: finish it and a golem stands up, or step away and it settles.';
    WIKI.add('monsters', { id: 'giant_mithril', blurb: rock + ' Six cracks, 40 Mining xp each. Grows back in 60 seconds. One in three wakes.' });
    WIKI.add('monsters', { id: 'giant_stormstone', blurb: rock + ' Nine cracks, 70 Mining xp each. Grows back in 90 seconds. One in two wakes.' });
    WIKI.add('monsters', { id: 'mithril_golem', where: ['The Royal Mine'], blurb: 'It wakes out of a giant mithril ore. It attacks you on sight. Beat it for the bars in its pockets.' });
    WIKI.add('monsters', { id: 'stormstone_golem', where: ['The Royal Mine'], blurb: 'It wakes out of a giant stormstone ore. Big, slow and hard. Beat it for the bars in its pockets.' });
    WIKI.add('monsters', { id: 'golemling', where: ['The Royal Mine'], blurb: 'A little golem. It crawls out of a rubble heap and walks to the Ginormous Golem to be eaten, and he heals 40. Smash it first: one or two hits.' });
    WIKI.add('monsters', { id: 'ginormous_golem', blurb: 'Swords, arrows and bombs bounce off him. MINE a glowing red vein in the chamber wall (two glow at a time, a new pair every 20 seconds, while he is awake). HEAT the stone at a heart forge. THROW it (T, THROW, SWING, or tap him): 50 damage, plus a quarter of your Smithing level (up to 25). He has 1000 health, and 600 more for every other knight in the chamber. Smash the little golems before they reach him. Step out of dark spots on the floor, and do not stand next to him. Everyone who helped gets his loot and 200 Mining, Smithing and Melee xp.' });
    WIKI.add('items', { id: 'hildes_heartstone', sources: [{ kind: 'given', text: "Hilde, in Deepholm (The Knocking Under the Throne). It lives on your keyring." }] });
    WIKI.add('items', { id: 'kingstone', sources: [{ kind: 'given', text: 'King Thrain, when you knock the all-clear (The Knocking Under the Throne). It lives on your keyring.' }] });
  }

  // =========================================================================
  // 24. THE HANDLE
  // =========================================================================
  window.ROYALMINE = {
    ID: RM, W, H, ENTRY, STAIR_UP, STAIR_DOWN, STAIR_STAND, LAYOUT, RECTS, WEST, EAST, VEINS, FORGES, HEAPS, SEAT, SEAT_C, GIANTS, GATE, SPAWNS, PEBBLE_MINE, PEBBLE_HOME, NUM, PATTERNS,
    tiles: { ROYAL_STAIR, ROYAL_PILLAR, ORE_BED, HEART_VEIN, HEART_FORGE, GOLEM_GATE, ROYAL_COAL, ROYAL_STORMSTONE },
    clock, setClock(fn) { clockFn = typeof fn === 'function' ? fn : null; }, litVeins,
    // overridable by tests: whether a rock that reaches its roll wakes, and what a hot stone hits for
    rollWake: type => Math.random() < (NUM.GIANT[type] ? NUM.GIANT[type].wakeChance : 0),
    heartDmg: () => heartDmgBase(),
    get run() { return run; },
    state: () => { const gm = golemMon(); return { inMine: inMine(), inDeep: inDeep(), stage: R().stage, raw: run.raw, hot: run.hot, guest: run.guest, slide: slide.on, gate: tileAt(22, 23) === GOLEM_GATE ? 'shut' : 'open', golem: gm ? { state: gm.state, hp: gm.hp, maxHp: gm.maxHp, dead: !!gm.dead } : null, lings: lings().length }; },
    throwHeart, spawnLittle, forceRock, syncDeepholm, startSlide, build, inCharge, golem: golemMon, seqBusy, knockPress, answerListen,
    debug: {
      wake(n) { const g = golemMon(); if (!g || g.remote) return false; const rm = ensureGolemRm(g); g.dead = false; wakeGolem(g, rm, n || 1); rm.phase = 'fight'; g.state = 'fight'; golemRiseAt = time - NUM.RISE; return true; },
      crack(nid, n) { const m = monsters.find(o => o.nid === nid); if (!m || m.dead) return false; m.hp = Math.max(0.5, m.hp - (n || 1)); return true; },
      stir(nid) { const m = monsters.find(o => o.nid === nid); if (!m || m.dead) return false; ensureOreRm(m).rolled = true; m.state = 'stir'; m.rm.stirT = 0; return true; },
      spawnGolem(type, tx, ty) { const m = makeMon(type, tc(tx), tc(ty)); monsters.push(m); return m; },
      setStage(n) { R().stage = n; syncDeepholm(); return n; },
      flush() { for (let k = 0; k < 400 && seq.steps.length; k++) { const s = seq.steps.shift(); if (s.act) s.act(); } },
    },
  };


  // =========================================================================
  // 25. SELF-TEST — every block saves and restores what it touches (the quests, the keyring, Thrain, Deepholm's
  // tiles, kid mode, touch, the wire, the instance, the skills, the pack and NUM), so the rest of the suite sees
  // a fresh stage-0 Deepholm and a knight on the surface.
  // =========================================================================
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'royalmine: ';
    if (!window.INSTANCES || !DH || !INSTANCES.get(RM)) { check(P + 'the Royal Mine needs Deepholm and the instance system', false, {}); return; }
    const clone = o => (o === undefined || o === null) ? o : JSON.parse(JSON.stringify(o));
    const dhSum = () => { const inst = INSTANCES.get(DH.ID); let s = 0; for (let i = 0; i < inst.tiles.length; i++) s = (Math.imul(s, 31) + inst.tiles[i]) | 0; return s; };
    const th0 = thrain();
    const S0 = {
      royal: clone(quest.royalmine), dwarf: clone(quest.dwarf), tracked: quest.tracked, untracked: quest.untrackedByPlayer, instances: clone(quest.instances),
      inv: player.inv.map(s => s ? { ...s } : null), bank: (player.bank || []).map(s => ({ ...s })), keyring: (player.keyring || []).slice(),
      skills: clone(player.skills), equip: { ...player.equip }, hp: player.hp, px: player.x, py: player.y, kills: player.kills, bed: player.bedSpawn, deaths: player.deaths,
      deathKeep: clone(deathKeep), kid: window.__kidmode, touch: window.__forceTouch, random: Math.random, clockFn, rollWake: ROYALMINE.rollWake, heartDmg: ROYALMINE.heartDmg,
      num: clone(NUM), peace: window.__peace, th: th0 ? { x: th0.x, px: th0.px, py: th0.py } : null, drops: drops.slice(), dhSum: dhSum(), companion: window.__companionHit,
    };
    const netWas = window.NET ? { enabled: NET.enabled, token: NET.token, fake: NET.fake } : null;
    const restoreNum = () => { for (const k in S0.num) { if (k === 'GIANT') { for (const t in S0.num.GIANT) Object.assign(NUM.GIANT[t], S0.num.GIANT[t]); } else NUM[k] = S0.num[k]; } };
    const out = () => { let k = 0; while (INSTANCES.active() && k++ < 4) INSTANCES.leave(); };
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; seqClear(); kp.list = []; kp.done = null; hold.on = false; };
    const fresh = over => { quest.royalmine = Object.assign(freshQuest(), { told: { rules: true, chamber: true, giant: true, stir: true, wake: true, raw: true, hot: true, ling: true, heal: true, smash: true, rock: true, after: true } }, over || {}); };
    const lv = (sk, n) => { player.skills[sk].xp = XP_TABLE[n]; };
    const until = (cond, max) => { let n = 0; while (n < max && !cond()) { if (dialog.cur) advanceDialog(); F.step([]); n++; } render(); return cond(); };
    const storyDone = () => !seqBusy() && !dialog.cur && !dialog.queue.length && !kp.list.length && !hold.on;
    const said = re => dialogLog.some(l => re.test(l.text));
    const intoDeep = () => { out(); DH.enter(); F.step([]); return inDeep(); };
    const intoMine = () => { out(); INSTANCES.enter(RM); F.step([]); return inMine(); };
    const emptyPack = (...ids) => { player.inv = new Array(INV_SLOTS).fill(null); for (const id of ids) addItem(id, 1); };
    const unring = id => { for (let k = 0; k < 5 && countItem(id) > 0; k++) removeItem(id, countItem(id)); };
    const tile = () => [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
    const talkThrain = () => { const t = thrain(); F.tp(t.x, 22); player.facing = { x: 0, y: 1 }; closePanel(); F.press('KeyE'); };
    const talkHilde = () => { F.tp(10, 21); player.facing = { x: 0, y: -1 }; closePanel(); F.press('KeyE'); };
    const beside = (tx, ty) => { for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const x = tx + dx, y = ty + dy; if (!SOLID.has(tileAt(x, y))) { F.tp(x, y); F.face(tx, ty); return [x, y]; } } return null; };
    const have = id => countItem(id) + drops.filter(d => d.id === id).reduce((a, d) => a + d.qty, 0);
    const newLife = g => { g.dead = false; g.deadT = 0; g.hp = g.maxHp = NUM.GOLEM_HP; g.rm = null; g.state = 'sleep'; F.step([]); };
    // a recording context: what a chip or a panel paints, in words (the headless canvas swallows everything)
    const recorder = () => { const log = { text: [] }; return new Proxy({}, { get: (t, k) => k === '__log' ? log : k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : (k === 'fillText' || k === 'strokeText') ? (s => log.text.push(String(s))) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? (() => ({ addColorStop: () => { } })) : typeof k === 'string' ? (() => { }) : undefined, set: () => true }); };
    // the wire, faked: we are Cohen; Ann and Ava are friends
    let sent = [], sock = null;
    const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
    const goOnline = () => {
      sent = []; NET.enabled = true; NET.token = 'royalmine-test';
      NET.useFake({ call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); sent.push(m); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: Date.now(), keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } });
      NET.connect(); return NET.online();
    };
    const goOffline = () => { if (!netWas) return; NET.disconnect(); NET.fake = netWas.fake; NET.enabled = netWas.enabled; NET.token = netWas.token; NET.status = 'off'; NET.me = null; if (window.COOP) COOP.reset(); roster = []; skew = 0; };
    const keeper = n => push({ t: 'keeper', map: RM, n });
    const monRow = (nid, type, x, y, hp, mhp, state) => [nid, type, Math.round(x), Math.round(y), hp, mhp, state, 0, 1, 0, 0, 0, 0, 0];
    h.peace(true); out(); closePanel(); drain();
    try {
      emptyPack('mithril_pickaxe', 'iron_sword'); player.equip.weapon = null;
      unring('hildes_heartstone'); unring('kingstone');
      NUM.LING_FIRST = 9999;

      // ---- 1. registers ----
      { const top = Math.max(...Object.values(T)), eight = new Set(NEW_TILES).size === 8 && NEW_TILES.every(t => typeof t === 'number');
        const tappable = NEW_TILES.every(t => INTERESTING_TILES.has(t)), icons = ['hildes_heartstone', 'kingstone', 'heartstone_pickaxe', 'stoneheart_helm'].every(id => window.ICONS && ICONS.has(id));
        const keys = !!(window.KEYRING && KEYRING.KEYS.hildes_heartstone && KEYRING.KEYS.kingstone);
        check(P + 'registers: 8 new tiles (top id ' + top + ' of 255), all tappable; 4 items with their own icons; both keys on the keyring; the quest; lamplit, with a lighting scene; the Heartstone pickaxe is tier 3',
          eight && top <= 255 && tappable && icons && keys && !!QUEST_DEFS.royalmine && INSTANCE_LIGHT.of(RM) === 'lamplit' && LIGHTS.scenes().includes(RM) && ITEMS.heartstone_pickaxe.tier === 3,
          { top, eight, tappable, icons, keys, light: INSTANCE_LIGHT.of(RM) }); }

      // ---- 2. the build is deterministic ----
      { const grab = seed => { const a = new Uint8Array(W * H); build((x, y, t) => { a[y * W + x] = t; }, mulberry32(seed)); return a; };
        const g1 = grab(11), g2 = grab(99), sum = a => { let s = 0; for (let i = 0; i < a.length; i++) s = (Math.imul(s, 31) + a[i]) | 0; return s; };
        const fromRows = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) fromRows[y * W + x] = LEGEND[LAYOUT[y][x]];
        const R0 = Math.random; let threw = false; Math.random = () => { throw new Error('Math.random inside build'); };
        try { build(() => { }, mulberry32(5)); } catch (e) { threw = true; } finally { Math.random = R0; }
        const inst = INSTANCES.get(RM), onFloor = SPAWNS.every(([, x, y]) => !SOLID.has(inst.tiles[y * W + x]));
        check(P + 'the mine builds identically from two different seeds, equal to its 42 rows, without touching Math.random; the 7 spawns stand on floor and (23,3) is the royal runner',
          sum(g1) === sum(g2) && sum(g1) === sum(fromRows) && !threw && onFloor && inst.tiles[3 * W + 23] === T.RUG && inst.w === 48 && inst.h === 42 && LAYOUT.length === 42 && LAYOUT.every(r => r.length === 48),
          { sums: [sum(g1), sum(g2), sum(fromRows)], threw, onFloor, runner: inst.tiles[3 * W + 23] === T.RUG }); }

      // ---- 3. connectivity ----
      { const inst = INSTANCES.get(RM), tl = inst.tiles, N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const bfs = open => { const d = new Int32Array(W * H).fill(-1), q = [ENTRY[1] * W + ENTRY[0]]; d[q[0]] = 0;
          for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % W, y = (c / W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (d[n] >= 0) continue; if (SOLID.has(tl[n]) && !(open && tl[n] === GOLEM_GATE)) continue; d[n] = d[c] + 1; q.push(n); } }
          return d; };
        const open = bfs(true), shut = bfs(false);
        const touches = (x, y) => N4.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && open[ny * W + nx] >= 0 && !SOLID.has(tl[ny * W + nx]); });
        let floor = 0, reached = 0, shutInside = 0, far = 0; const lost = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const t = tl[y * W + x];
          if (!SOLID.has(t)) { floor++; if (open[y * W + x] >= 0) reached++; if (y >= 24 && shut[y * W + x] >= 0) shutInside++; }
          if ([ROYAL_STAIR, ROYAL_PILLAR, HEART_VEIN, HEART_FORGE, GOLEM_GATE, ROYAL_COAL, ROYAL_STORMSTONE, DW_LAMP, DW_MITHRIL].includes(t) && !touches(x, y)) lost.push(tileName(t) + '@' + x + ',' + y);
          if ((charAt(x, y) === ':' || charAt(x, y) === 'h') && y >= 26 && Math.hypot(x + 0.5 - 24, y + 0.5 - 33) > 12) far++;
        }
        for (const b of GIANTS) { let ok = false; for (let y = b.bed[1]; y < b.bed[1] + b.size; y++) for (let x = b.bed[0]; x < b.bed[0] + b.size; x++) if (touches(x, y)) ok = true; if (!ok) lost.push('bed ' + b.nid); }
        check(P + `connectivity: with the gate open all ${floor} floor tiles are reached from the stair (${reached}); every seam, pillar, lamp, vein, forge, stair and bed touches reached floor; with the gate shut no tile at y 24 or below is reached; the whole chamber is within 12 tiles of the golem`,
          floor === 893 && reached === 893 && lost.length === 0 && shutInside === 0 && far === 0, { floor, reached, lost: lost.slice(0, 6), shutInside, far }); }

      // ---- 4. lit, not dark ----
      { intoMine(); const at = r => LIGHTS.sample((r.x0 + r.x1 + 1) * TILE / 2, (r.y0 + r.y1 + 1) * TILE / 2, { knight: false });
        const hall = at(RECTS.hall), giant = at(RECTS.giant), chamber = at(RECTS.chamber);
        check(P + `lit like a palace, not a cave: the overlay is ${hall.alpha} in the Hall of Kings, ${giant.alpha} in the Giant Hall and ${chamber.alpha} in the Heart Chamber (0.35 or less)`,
          hall.alpha <= 0.35 && giant.alpha <= 0.35 && chamber.alpha <= 0.35, { hall: hall.alpha, giant: giant.alpha, chamber: chamber.alpha });
        out(); }

      // ---- 5. the old quest first ----
      { quest.dwarf = { stage: 1, chests: [], visited: true }; fresh(); intoDeep(); drain(); dialogLog.length = 0;
        talkThrain(); F.sim(2, []);
        const oldLine = !!dialog.cur && dialog.cur.who === THRAIN && /Five coal and three iron bars/.test(dialog.cur.text) && R().stage === 0;
        drain(); quest.dwarf.stage = 2; dialogLog.length = 0; talkThrain();
        const opened = until(() => panel === 'rm_listen', 3000);
        check(P + 'below the first quest\'s end Thrain still asks for coal and iron (royal stage 0); once the forge is lit he tells of the knocking, it plays on the throne and "What did you hear?" opens',
          oldLine && opened && said(/You have young ears/) && R().stage === 0, { oldLine, opened, stage: R().stage }); }

      // ---- 6. listen ----
      { dialogLog.length = 0; render(); const c2 = F.clickButton('knock:2');
        until(() => said(/No\. Listen again\./), 400);
        const wrong = R().stage === 0 && said(/No\. Listen again\./);
        const back = until(() => panel === 'rm_listen', 1500);
        render(); const c1 = F.clickButton('knock:1');
        until(() => R().stage === 1, 300); until(() => said(/miner's knock/), 1500);
        check(P + 'knock:2 (slow, slow, slow) is wrong: stage 0, "No. Listen again.", the knocks replay and the panel returns; knock:1 (two quick, one slow) is right: stage 1, "a miner\'s knock"',
          c2 && wrong && back && c1 && R().stage === 1 && said(/miner's knock/), { c2, wrong, back, c1, stage: R().stage });
        until(storyDone, 3000); out(); }

      // ---- 7. Hilde ----
      { fresh({ stage: 1 }); unring('hildes_heartstone'); intoDeep(); drain(); dialogLog.length = 0;
        talkHilde(); until(storyDone, 6000);
        check(P + "Hilde tells the turn and gives her cold heartstone: stage 2, it is on the keyring (count 1) and not in the pack",
          R().stage === 2 && countItem('hildes_heartstone') === 1 && KEYRING.held('hildes_heartstone') && !player.inv.some(s => s && s.id === 'hildes_heartstone') && said(/Everyone but Pebble/),
          { stage: R().stage, count: countItem('hildes_heartstone'), held: KEYRING.held('hildes_heartstone') });
        out(); }

      // ---- 8. warm it at a forge ----
      { fresh({ stage: 2 }); if (!KEYRING.held('hildes_heartstone')) KEYRING.add('hildes_heartstone'); intoDeep(); drain();
        F.tp(10, 11); F.face(10, 10); closePanel(); const sx0 = player.skills.smithing.xp; F.press('KeyE');
        const warming = !!player.action && player.action.type === 'rm_warm' && panel !== 'station';
        F.sim(Math.ceil(2.2 * 60), []);
        const warmed = R().stage === 3 && player.skills.smithing.xp - sx0 === 60;
        fresh({ stage: 0 }); F.tp(10, 11); F.face(10, 10); closePanel(); F.press('KeyE'); const station = panel === 'station' && panelArg === 'forge'; closePanel();
        check(P + "at stage 2 E on Deepholm's forge warms Hilde's heartstone instead of opening the forge (2 s, +60 Smithing, stage 3); at stage 0 the same forge opens as always",
          warming && warmed && station, { warming, warmed, station, xp: player.skills.smithing.xp - sx0 });
        drain(); out(); }

      // ---- 9. the all-clear, the Kingstone, and the throne that slides ----
      { fresh({ stage: 3 }); if (!KEYRING.held('hildes_heartstone')) KEYRING.add('hildes_heartstone'); unring('kingstone'); intoDeep(); drain();
        talkThrain(); const panelUp = until(() => panel === 'rm_knock', 2500);
        notice = null; for (let k = 0; k < 3; k++) { render(); F.clickButton('KNOCK'); F.sim(6, []); }
        const quick = !!notice && /Too quick/.test(notice.text) && R().stage === 3 && panel === 'rm_knock';
        F.sim(60, []);
        for (let k = 0; k < 3; k++) { render(); F.clickButton('KNOCK'); F.sim(48, []); }
        F.sim(6 * 60, []);
        const swapped = R().stage === 4 && countItem('hildes_heartstone') === 0 && KEYRING.held('kingstone') && !player.inv.some(s => s && s.id === 'kingstone');
        F.sim(Math.ceil(2.5 * 60), []);
        const t = thrain(), moved = DH.at(14, 23) === ROYAL_STAIR && DH.at(16, 23) === DW_THRONE && tileAt(14, 23) === ROYAL_STAIR && tileAt(16, 23) === DW_THRONE && t.x === 16 && t.px === tc(16);
        out(); F.step([]); DH.enter(); F.step([]); const again = tileAt(14, 23) === ROYAL_STAIR && tileAt(16, 23) === DW_THRONE;
        save(); load(); F.step([]); DH.enter(); F.step([]); const loaded = tileAt(14, 23) === ROYAL_STAIR && thrain().x === 16;
        out(); const q = clone(quest.royalmine); for (const f of HOOKS.newGame) if (f === onNewGame) f();
        DH.enter(); F.step([]); const shut = tileAt(14, 23) === DW_THRONE && tileAt(16, 23) === T.CAVE && thrain().x === 14 && thrain().px === tc(14);
        out(); quest.royalmine = q; syncDeepholm();
        check(P + 'the all-clear: three quick KNOCKs are "Too quick" (still stage 3); three slow ones are answered, Hilde\'s heartstone goes, the Kingstone goes on the keyring (stage 4), and the throne slides to (16,23) with the stair at (14,23) and Thrain at x 16; it stays open after leaving and after a save and load; a new game shuts it',
          panelUp && quick && swapped && moved && again && loaded && shut, { panelUp, quick, swapped, moved, again, loaded, shut, stage: R().stage }); }

      // ---- 10. the stair ----
      { fresh({ stage: 4 }); intoDeep(); drain(); F.tp(14, 22); player.facing = { x: 0, y: 1 }; closePanel(); F.press('KeyE'); F.sim(2, []);
        const [ex, ey] = tile(), down = inMine() && ex === 23 && ey === 3 && !!UNDERGROUND.hop && UNDERGROUND.hop.back === DH.ID;
        F.tp(23, 3); player.facing = { x: 0, y: -1 }; F.press('KeyE'); F.sim(2, []);
        const [ux, uy] = tile(), up = inDeep() && ux === 14 && uy === 22;
        check(P + 'the stair: E from (14,22) facing south rides down into the Royal Mine at (23,3) (the hop remembers Deepholm); E on the stair up at (23,2) brings you back to (14,22)',
          down && up, { down, at: [ex, ey], up, back: [ux, uy] });
        drain(); out(); }

      // ---- 11. the royal seams ----
      { fresh({ stage: 5 }); intoMine(); drain(); emptyPack('mithril_pickaxe'); lv('mining', 10);
        F.tp(4, 4); F.face(4, 3); const c0 = countItem('coal'), x0 = player.skills.mining.xp; F.press('KeyE'); F.untilAction(900, () => countItem('coal') > c0); player.action = null;
        const coal = countItem('coal') === c0 + 1 && player.skills.mining.xp - x0 === 50 && tileAt(4, 3) === T.RUBBLE && regrow.some(e => e.i === idx(4, 3) && e.t === ROYAL_COAL);
        lv('mining', 23); F.tp(14, 5); F.face(14, 4); notice = null; F.press('KeyE'); const refused = !player.action && !!notice && /Mining level 24/.test(notice.text);
        lv('mining', 24); const s0 = countItem('stormstone_ore'), x1 = player.skills.mining.xp; F.press('KeyE'); F.untilAction(900, () => countItem('stormstone_ore') > s0); player.action = null;
        const storm = countItem('stormstone_ore') === s0 + 1 && player.skills.mining.xp - x1 === 95;
        check(P + 'royal seams: coal at Mining 10 pays coal and 50 xp and leaves rubble that regrows into the seam; stormstone is refused at Mining 23 and pays stormstone ore and 95 xp at 24',
          coal && refused && storm, { coal, refused, storm, notice: notice && notice.text });
        out(); }

      // ---- 12. a giant rock: swords are no use, a pickaxe cracks it ----
      { fresh({ stage: 5 }); intoMine(); drain(); ROYALMINE.rollWake = () => false; const b = GIANTS[0], m = giantMon(b);
        emptyPack('iron_sword'); player.equip.weapon = 'iron_sword'; lv('mining', 20); F.tp(34, 7); F.face(34, 6); player.attackCd = 0; notice = null; run.hintT = -99; F.press('Space'); F.step([]);
        const sword = m.hp === 6 && !!notice && /pickaxe/.test(notice.text);
        player.inv = new Array(INV_SLOTS).fill(null); addItem('mithril_pickaxe', 1); player.equip.weapon = null; player.attackCd = 0; F.face(34, 6); F.press('Space');
        const started = !!player.action && player.action.type === 'rm_giant';
        const x0 = player.skills.mining.xp; F.untilAction(400, () => m.hp < 6);
        const one = m.hp === 5 && player.skills.mining.xp - x0 === 40; player.action = null; m.hp = 6;
        lv('mining', 19); notice = null; F.face(34, 6); F.press('KeyE'); const low = !player.action && !!notice && /Mining level 20/.test(notice.text);
        check(P + 'giant mithril ore: a sword leaves it whole (hp 6) with the pickaxe hint; SWING with a pickaxe starts mining and a crack takes it to 5 for 40 Mining xp; at Mining 19 it says Mining level 20',
          sword && started && one && low, { sword, started, one, low, hp: m.hp, notice: notice && notice.text });
        out(); }

      // ---- 13. broken as ore ----
      { fresh({ stage: 5 }); intoMine(); drain(); ROYALMINE.rollWake = () => false; emptyPack('mithril_pickaxe'); lv('mining', 20);
        const m = giantMon(GIANTS[0]); F.tp(34, 7); F.face(34, 6);
        const o0 = have('mithril_ore'), mx = player.skills.melee.xp, dx = player.skills.defence.xp;
        F.press('KeyE'); F.untilAction(3000, () => m.dead); F.sim(3, []);
        const got = have('mithril_ore') - o0, dead = m.dead;
        const noBonus = player.skills.melee.xp === mx && player.skills.defence.xp === dx;
        NUM.GIANT.giant_mithril.regrow = 2; F.tp(30, 8); F.sim(Math.ceil(2.5 * 60), []);
        const back = !m.dead && m.hp === 6 && m.state === 'idle';
        check(P + `broken as ore: six cracks and it falls, ${got} mithril ore at the miner's feet (5 to 7), no hidden kill bonus in Melee or Defence; it grows back whole`,
          dead && got >= 5 && got <= 7 && noBonus && back, { dead, got, noBonus, back });
        restoreNum(); out(); }

      // ---- 14. woken as a golem ----
      { fresh({ stage: 5 }); intoMine(); drain(); ROYALMINE.rollWake = () => true; emptyPack('mithril_pickaxe'); lv('mining', 20);
        const b = GIANTS[0], m = giantMon(b); F.tp(34, 7); F.face(34, 6);
        F.press('KeyE'); F.untilAction(2000, () => m.state === 'stir' || m.dead);
        const stirred = m.state === 'stir' && m.hp === 2;
        const o0 = have('mithril_ore');
        for (let k = 0; k < 6 && m.state === 'stir'; k++) { F.face(34, 6); F.press('KeyE'); F.untilAction(300, () => !player.action || m.state !== 'stir'); }
        const waking = m.state === 'waking' && have('mithril_ore') === o0;
        F.sim(Math.ceil(2.2 * 60), []);
        const gs = monsters.filter(o => o.type === 'mithril_golem' && !o.dead);
        const near = gs.length === 1 && Math.max(b.bed[0] * TILE - gs[0].x, 0, gs[0].x - (b.bed[0] + b.size) * TILE, b.bed[1] * TILE - gs[0].y, 0, gs[0].y - (b.bed[1] + b.size) * TILE) <= 2 * TILE;
        const woke = m.dead && near;
        let dropsOre = false, gone = false;
        if (gs[0]) { const d0 = drops.length; gs[0].hp = 1; killMonster(gs[0]); dropsOre = drops.slice(d0).some(d => d.id === 'mithril_ore'); F.sim(2 * 60, []); gone = !monsters.includes(gs[0]); }
        check(P + 'woken: at hp 2 the rock shakes (stir); the last crack wakes it with no ore; 2 s later the rock is gone and one mithril golem stands beside its bed; its kill drops mithril ore and it is cleared soon after',
          stirred && waking && woke && dropsOre && gone, { stirred, waking, woke, golems: gs.length, dropsOre, gone });
        out(); }

      // ---- 15. a shaking rock left alone settles ----
      { fresh({ stage: 5 }); intoMine(); drain(); NUM.STIR_SETTLE = 2; const m = giantMon(GIANTS[1]); ROYALMINE.debug.stir('i2'); m.hp = 2;
        F.tp(30, 8); F.sim(Math.ceil(2.5 * 60), []);
        check(P + 'a shaking rock left alone settles back to sleep, whole again', m.state === 'idle' && m.hp === 6 && !m.dead, { state: m.state, hp: m.hp });
        restoreNum(); out(); }

      // ---- 16. Pebble opens the gate ----
      { fresh({ stage: 4 }); intoMine(); drain(); dialogLog.length = 0;
        const p = tapPeople().find(o => o.id === 'pebble'), shutFirst = GATE.every(([x, y]) => tileAt(x, y) === GOLEM_GATE);
        if (p) p.talk(); until(storyDone, 6000);
        const open = R().stage === 5 && GATE.every(([x, y]) => tileAt(x, y) === T.COBBLE) && said(/Pebble hold this door shut/);
        out(); intoMine(); const stays = GATE.every(([x, y]) => tileAt(x, y) === T.COBBLE);
        fresh({ stage: 3 }); out(); intoMine(); F.step([]); const shut3 = GATE.every(([x, y]) => tileAt(x, y) === GOLEM_GATE);
        check(P + 'Pebble stands at the gate (a tap target); talking to him at stage 4 tells his story and the gate opens (stage 5, floor tiles); it is open next time; for a stage-3 knight it is shut',
          !!p && shutFirst && open && stays && shut3, { pebble: !!p, shutFirst, open, stays, shut3 });
        drain(); out(); }

      // ---- 17. the rules card ----
      { fresh({ stage: 5 }); R().told.rules = false; intoMine(); drain(); closePanel();
        F.tp(24, 24); F.step([]); const notYet = panel !== 'rm_rules';
        F.tp(24, 26); F.step([]); F.step([]); const opened = panel === 'rm_rules';
        render(); const clicked = F.clickButton('GOT IT'); const closed = panel === null;
        F.tp(24, 24); F.step([]); F.tp(24, 26); F.step([]); F.step([]); const again = panel === 'rm_rules';
        check(P + 'the rules card opens the first time you step into the chamber, GOT IT closes it, and it does not open again',
          notYet && opened && clicked && closed && !again, { notYet, opened, clicked, closed, again });
        closePanel(); out(); }

      // ---- 18. swords bounce off ----
      { fresh({ stage: 5 }); intoMine(); drain(); const g = golemMon(); emptyPack('iron_sword'); player.equip.weapon = 'iron_sword';
        const hits = () => { const hp0 = g.hp; F.tp(22, 33); F.face(24, 33); player.attackCd = 0; F.press('Space'); hitMonster(g, 10, 8); hitMonster(g, 6, 14, false, 'companion'); hitMonster(g, 14, 30, true); return g.hp === hp0; };
        run.clangT = -99; notice = null; const asleep = hits() && !!notice && /bounce/.test(notice.text);
        ROYALMINE.debug.wake(); run.clangT = -99; notice = null; const awake = hits() && !!notice && /bounce/.test(notice.text);
        check(P + 'swords bounce off the golem: asleep and awake, a sword swing, an arrow, a companion and a bomb leave his hp as it was ("Clang! Swords bounce off...")',
          asleep && awake, { asleep, awake, hp: g.hp, notice: notice && notice.text });
        player.equip.weapon = null; out(); }

      // ---- 19. the gold ring wakes him, the empty chamber puts him back to sleep ----
      { fresh({ stage: 5 }); intoMine(); drain(); const g = golemMon();
        F.tp(24, 30); F.step([]); F.step([]);
        const rose = g.state === 'rise' && g.maxHp === 1000 && g.hp === 1000;
        const fight = typeof F.untilAction(Math.ceil(1.2 * 60), () => g.state === 'fight') === 'number';
        NUM.SETTLE = 2; F.tp(24, 24); F.sim(Math.ceil(2.5 * 60), []);
        const settled = g.state === 'sleep' && g.hp === g.maxHp;
        window.__kidmode = true; out(); intoMine(); const g2 = golemMon(); F.tp(24, 30); F.step([]); F.step([]); const kidHp = g2.maxHp === 700; window.__kidmode = S0.kid;
        check(P + 'stepping into the gold ring wakes him (rise, then fight within 1.2 s) with 1000 hp (700 in kid mode); an empty chamber puts him back to sleep, whole',
          rose && fight && settled && kidHp, { rose, fight, settled, kidHp: g2.maxHp });
        restoreNum(); out(); }

      // ---- 20. the veins ----
      { const ms = 1.7e12, pair = litVeins(ms), same = JSON.stringify(pair) === JSON.stringify(litVeins(ms + 1));
        const sideOk = WEST.some(v => v[0] === pair[0][0] && v[1] === pair[0][1]) && EAST.some(v => v[0] === pair[1][0] && v[1] === pair[1][1]);
        const pinned = JSON.stringify(pair) === '[[14,37],[33,28]]';
        let changes = 0; for (let k = 0; k < 10; k++) if (JSON.stringify(litVeins(ms + k * NUM.VEIN_WINDOW)) !== JSON.stringify(litVeins(ms + (k + 1) * NUM.VEIN_WINDOW))) changes++;
        fresh({ stage: 5 }); intoMine(); drain(); emptyPack('mithril_pickaxe'); lv('mining', 1); clockFn = () => ms; ROYALMINE.debug.wake(); run.raw = 0; run.hot = 0; run.quota = {};
        const [lx, ly] = pair[0]; beside(lx, ly); const x0 = player.skills.mining.xp; F.press('KeyE'); F.untilAction(200, () => run.raw >= 1);
        const one = run.raw === 1 && player.skills.mining.xp - x0 === 30;
        F.untilAction(600, () => run.raw >= 4); player.action = null;
        notice = null; F.face(lx, ly); F.press('KeyE'); F.step([]); const fifth = !player.action && run.raw === 4 && !!notice && /empty for now/.test(notice.text);
        const dark = WEST.find(v => !(v[0] === lx && v[1] === ly)); beside(dark[0], dark[1]); notice = null; F.press('KeyE'); F.step([]); const darkNo = !player.action && !!notice && /This vein is dark/.test(notice.text);
        run.raw = 4; run.hot = 1; beside(pair[1][0], pair[1][1]); notice = null; F.press('KeyE'); F.step([]); const full = !player.action && carrying() === 5 && !!notice && /arms are full: 5/.test(notice.text);
        check(P + 'veins: each 20 s window lights one west and one east vein, the same for everyone (pinned for 1.7e12 ms), changing across windows; a lit vein gives a raw heartstone and 30 Mining xp a swing, four a window; a dark vein, a fifth stone and a sixth in your arms are refused',
          same && sideOk && pinned && changes >= 1 && one && fifth && darkNo && full, { pair, same, sideOk, pinned, changes, one, fifth, darkNo, full, notice: notice && notice.text });
        run.raw = 0; run.hot = 0; clockFn = null; out(); }

      // ---- 21. the heart forge ----
      { fresh({ stage: 5 }); intoMine(); drain(); run.raw = 3; run.hot = 0; F.tp(13, 32); F.face(12, 32); const sx0 = player.skills.smithing.xp; F.press('KeyE');
        F.untilAction(400, () => run.hot >= 3); player.action = null;
        const heated = run.raw === 0 && run.hot === 3 && player.skills.smithing.xp - sx0 === 75;
        run.hot = 0; notice = null; closePanel(); F.press('KeyE'); F.step([]); const none = !player.action && !panel && !!notice && /A heart forge/.test(notice.text);
        check(P + 'a heart forge turns 3 raw stones into 3 hot ones (0.8 s each, +75 Smithing); with nothing raw it says what it wants and opens no panel', heated && none, { heated, hot: run.hot, xp: player.skills.smithing.xp - sx0, none });
        out(); }

      // ---- 22. the throw ----
      { fresh({ stage: 5 }); intoMine(); drain(); lv('smithing', 20); ROYALMINE.debug.wake(); const g = golemMon(); F.tp(18, 30);
        const dmg = ROYALMINE.heartDmg(); run.hot = 1; const hp0 = g.hp, mx0 = player.skills.melee.xp; F.press('KeyT'); F.untilAction(60, () => g.hp < hp0);
        const byT = hp0 - g.hp === dmg && run.hot === 0 && player.skills.melee.xp - mx0 === 2 * dmg && dmg === 55;
        run.hot = 1; run.throwCd = 0; window.__forceTouch = true; F.step([]); render(); const hp1 = g.hp; const clicked = F.clickButton('THROW (1)'); F.untilAction(60, () => g.hp < hp1); const byBtn = clicked && g.hp === hp1 - dmg; window.__forceTouch = S0.touch;
        run.hot = 1; run.throwCd = 0; render(); const hp2 = g.hp; tapAt(g.x - cam.x, g.y - cam.y); F.untilAction(60, () => g.hp < hp2); const byTap = g.hp === hp2 - dmg;
        run.hot = 0; run.throwCd = 0; notice = null; F.press('KeyT'); const nothing = !!notice && /Nothing hot/.test(notice.text);
        g.rm.phase = 'sleep'; g.state = 'sleep'; run.hot = 1; notice = null; F.press('KeyT'); const sleeping = !!notice && /asleep/.test(notice.text) && run.hot === 1;
        check(P + `throwing: T lands a hot stone for exactly ${dmg} (50 + a quarter of Smithing 20) and pays Melee 2 a damage; the THROW (1) control and a tap on the golem throw too; with nothing hot, or with him asleep, it says so`,
          byT && byBtn && byTap && nothing && sleeping, { byT, byBtn, byTap, nothing, sleeping, dmg });
        run.hot = 0; out(); }

      // ---- 23. the little golems ----
      { fresh({ stage: 5 }); intoMine(); drain(); ROYALMINE.debug.wake(); const g = golemMon(); g.rm.lingT = 9999; F.tp(18, 30);
        g.hp = g.maxHp - 100; const l = spawnLittle(0);
        const nextTo = dist(l.x, l.y, tc(HEAPS[0][0]), tc(HEAPS[0][1])) < TILE && MONSTER_DEFS.golemling.harmless && l.state === 'emerge';
        const hp0 = g.hp; F.untilAction(12 * 60, () => !monsters.includes(l)); const healed = !monsters.includes(l) && g.hp === Math.min(g.maxHp, hp0 + 40);
        g.hp = g.maxHp - 100; const l2 = spawnLittle(1); F.sim(60, []); const mx = player.skills.melee.xp, hp1 = g.hp;
        hitMonster(l2, l2.hp, 0); F.sim(12 * 60, []);
        const smashed = l2.dead || !monsters.includes(l2), nothing = g.hp === hp1, paid = player.skills.melee.xp > mx;
        check(P + 'a little golem crawls out of heap 0 (harmless), walks to the golem and is eaten: he heals 40 and it is gone; one smashed on the way heals nothing and pays Melee xp',
          nextTo && healed && smashed && nothing && paid, { nextTo, healed, hp: [hp0, g.hp], smashed, nothing, paid });
        out(); }

      // ---- 24. rocks ----
      { fresh({ stage: 5 }); intoMine(); drain(); ROYALMINE.debug.wake(); F.tp(18, 30); player.hp = player.maxHp;
        run.lastRockDmg = 0; forceRock(player.x, player.y); F.sim(Math.ceil(1.5 * 60), []); const hit = run.lastRockDmg === 8;
        window.__kidmode = true; player.hp = player.maxHp; run.lastRockDmg = 0; forceRock(player.x, player.y); F.sim(Math.ceil(2.1 * 60), []); const kidHit = run.lastRockDmg === 3; window.__kidmode = S0.kid;
        run.lastRockDmg = 0; const hp0 = player.hp; forceRock(player.x + 2 * TILE, player.y); F.sim(Math.ceil(1.5 * 60), []); const miss = run.lastRockDmg === 0 && player.hp >= hp0;
        check(P + 'a rock that lands where you stand hits for 8 (3 in kid mode, after a longer shadow); two tiles away it misses', hit && kidHit && miss, { hit, kidHit, miss });
        player.hp = player.maxHp; out(); }

      // ---- 25. the slam ----
      { fresh({ stage: 5 }); intoMine(); drain(); h.peace(false); run.rockT = 1e9; ROYALMINE.debug.wake(); const g = golemMon(); g.rm.lingT = 9999; g.rm.slamCd = 0;
        player.hp = player.maxHp; run.lastSlamDmg = 0; F.tp(24, 30); run.rockT = 1e9;
        const wound = typeof F.untilAction(4 * 60, () => { run.rockT = 1e9; return g.state === 'windup'; }) === 'number';
        const slammed = typeof F.untilAction(3 * 60, () => { run.rockT = 1e9; return run.lastSlamDmg > 0; }) === 'number' && run.lastSlamDmg === 12;
        window.__kidmode = true; player.hp = player.maxHp; run.lastSlamDmg = 0; g.rm.phase = 'fight'; g.state = 'fight'; g.rm.slamCd = 0; g.rm.nearT = 0; F.tp(24, 30);
        F.untilAction(6 * 60, () => { run.rockT = 1e9; return run.lastSlamDmg > 0; }); const kid5 = run.lastSlamDmg === 5; window.__kidmode = S0.kid;
        run.lastSlamDmg = 0; F.tp(24, 28); g.rm.phase = 'windup'; g.state = 'windup'; g.rm.t = 0; F.untilAction(3 * 60, () => { run.rockT = 1e9; return g.state === 'fight'; }); const safe = run.lastSlamDmg === 0;
        check(P + 'standing within 3 tiles for a moment winds him up and the slam hits for 12 (5 in kid mode); at 5 tiles the slam misses', wound && slammed && kid5 && safe, { wound, slammed, kid5, safe, last: run.lastSlamDmg });
        h.peace(true); player.hp = player.maxHp; out(); }

      // ---- 26. the fall and the reward ----
      { fresh({ stage: 5, dry: 0 }); intoMine(); drain(); emptyPack(); lv('smithing', 20); ROYALMINE.debug.wake(); const g = golemMon(); g.rm.lingT = 9999; F.tp(18, 30);
        g.hp = 30; run.hot = 1; const d0 = drops.length; F.press('KeyT'); F.untilAction(90, () => g.dead);
        const noCore = g.dead && drops.length === d0;
        const coins0 = have('coins'), bars0 = have('mithril_bar'), xm = player.skills.mining.xp, xs = player.skills.smithing.xp, xl = player.skills.melee.xp;
        F.sim(Math.ceil(1.2 * 60), []); F.step([]);
        const paid = have('coins') - coins0 >= 150 && have('mithril_bar') - bars0 >= 2 && player.skills.mining.xp - xm === 200 && player.skills.smithing.xp - xs === 200 && player.skills.melee.xp - xl === 200;
        const freed = R().stage === 6 && !!levelBanner && levelBanner.text === 'PEBBLE IS FREE';
        // a rare roll of 0: the pickaxe once, not twice, even with the pity count full
        newLife(g); ROYALMINE.debug.wake(); g.rm.lingT = 9999; run.life.landed = 1; R().dry = NUM.PITY; R().gotPick = false; const p0 = have('heartstone_pickaxe');
        Math.random = () => 0; g.hp = 1; hitMonster(g, 55, 0, true, 'heartstone'); F.sim(Math.ceil(1.2 * 60), []); Math.random = S0.random;
        const once = have('heartstone_pickaxe') - p0 === 1;
        // a knight who did not help gets nothing
        newLife(g); ROYALMINE.debug.wake(); g.rm.lingT = 9999; run.life.landed = 0; run.life.smashed = 0; const d1 = drops.length, c1 = have('coins');
        notice = null; g.hp = 1; _hitMonster(g, 5, 0, true, 'heartstone'); F.sim(Math.ceil(1.2 * 60), []);
        const noRoll = drops.length === d1 && have('coins') === c1 && !!notice && /did not help/.test(notice.text);
        // twenty-four dry falls: the next one gives the pickaxe
        newLife(g); ROYALMINE.debug.wake(); g.rm.lingT = 9999; run.life.landed = 1; R().gotPick = false; R().dry = NUM.PITY; const p1 = have('heartstone_pickaxe');
        Math.random = () => 0.99; g.hp = 1; hitMonster(g, 55, 0, true, 'heartstone'); F.sim(Math.ceil(1.2 * 60), []); Math.random = S0.random;
        const pity = have('heartstone_pickaxe') - p1 === 1 && R().gotPick && R().dry === 0;
        check(P + 'the fall: the killing stone adds no core drops; a second later a helper gets one roll of the golem\'s table (coins, mithril bars) and 200 Mining, Smithing and Melee; stage 5 → 6 with PEBBLE IS FREE; a rare roll gives the pickaxe once; a knight who did not help gets nothing; 24 dry falls make the next one give the pickaxe',
          noCore && paid && freed && once && noRoll && pity, { noCore, paid, freed, once, noRoll, pity, stage: R().stage, banner: levelBanner && levelBanner.text });
        out(); }

      // ---- 27. he pulls himself back together ----
      { fresh({ stage: 6 }); intoMine(); drain(); NUM.REVIVE = 2; const g = golemMon(); ROYALMINE.debug.wake(); run.life.landed = 0; g.hp = 1; _hitMonster(g, 5, 0, true, 'heartstone'); F.tp(18, 30);
        const died = g.dead; F.sim(Math.ceil(2.6 * 60), []);
        check(P + 'after he falls he pulls himself back together (the shrunk revive, nobody in the ring): alive, asleep, 1000 hp', died && !g.dead && g.state === 'sleep' && g.hp === NUM.GOLEM_HP, { died, dead: g.dead, state: g.state, hp: g.hp });
        restoreNum(); out(); }

      // ---- 28. leaving ----
      { fresh({ stage: 5 }); intoMine(); drain(); run.raw = 2; run.hot = 1; notice = null; out(); F.step([]);
        check(P + 'leaving the mine: the heartstones crumble ("They only burn down here")', run.raw === 0 && run.hot === 0 && !!notice && /crumble to sand/.test(notice.text), { raw: run.raw, hot: run.hot, notice: notice && notice.text }); }

      // ---- 29. the ending ----
      { fresh({ stage: 6 }); quest.dwarf = { stage: 2, chests: [], visited: true }; emptyPack(); intoDeep(); drain();
        const c0 = have('coins'), m0 = player.skills.mining.xp, s0 = player.skills.smithing.xp;
        talkThrain(); F.sim(2, []);
        const done = R().stage === 7 && have('coins') - c0 === 1000 && player.skills.mining.xp - m0 === 800 && player.skills.smithing.xp - s0 === 800 && !activeQuests().includes('royalmine');
        const pb = tapPeople().find(p => p.id === 'pebble'), home = !!pb && Math.floor(pb.x / TILE) === 9 && Math.floor(pb.y / TILE) === 21;
        check(P + 'the ending: Thrain at stage 6 gives 1000 coins, 800 Mining and 800 Smithing (stage 7, the quest done); Pebble lives at Hilde\'s side in Deepholm (9,21), and a tap reaches him',
          done && home, { done, stage: R().stage, coins: have('coins') - c0, home });
        drain(); out(); }

      // ---- 30. the guest pass ----
      if (window.NET) {
        fresh({ stage: 0 }); quest.dwarf = { stage: 2, chests: [], visited: true };
        goOnline(); intoDeep(); drain(); dialogLog.length = 0; push({ t: 'who', list: [{ n: 'Cohen', map: DH.ID }, { n: 'Ava', map: RM }] });
        talkThrain(); F.sim(Math.ceil(2.5 * 60), []);
        const guest = said(/Your friend Ava is down in my mine/) && run.guest && tileAt(14, 23) === ROYAL_STAIR && R().stage === 0;
        out(); F.step([]); DH.enter(); F.step([]); const shutAgain = tileAt(14, 23) === DW_THRONE && !run.guest;
        goOffline(); out();
        check(P + 'the guest pass: with a friend down in the mine, a stage-0 knight is let down the stair for this visit; out and back in, it is shut again', guest && shutAgain, { guest, shutAgain, stage: R().stage });
      }

      // ---- 31. online, somebody else keeps the mine ----
      if (window.NET && window.COOP) {
        fresh({ stage: 5 }); goOnline(); intoMine(); drain(); keeper('Ann'); F.step([]);
        const frame = () => push({ t: 'mon', n: 'Ann', list: [monRow('i0', 'ginormous_golem', SEAT_C.x, SEAT_C.y, 1000, 1000, 'fight'), monRow('i1', 'giant_mithril', GIANTS[0].c.x, GIANTS[0].c.y, 6, 6, 'idle')] });
        frame(); F.step([]);
        emptyPack('mithril_pickaxe'); lv('mining', 20); lv('smithing', 20); const p1 = monsters.find(m => m.nid === 'i1');
        // the frame is pushed only while nothing has been sent, so the puppet's hp is read before the keeper's next snapshot
        F.tp(34, 7); F.face(34, 6); sent = []; F.press('KeyE'); F.untilAction(200, () => { if (sent.some(m => m.t === 'hit')) return true; frame(); return false; }); player.action = null;
        const hits = sent.filter(m => m.t === 'hit'), mined = !!p1 && hits.length === 1 && hits[0].nid === 'i1' && hits[0].dmg === 1 && hits[0].knock === 0 && hits[0].bomb === false && p1.hp === 6;
        F.tp(18, 30); run.hot = 1; run.throwCd = 0; sent = []; frame(); F.press('KeyT'); F.untilAction(90, () => { frame(); return sent.some(m => m.t === 'hit'); });
        const th = sent.filter(m => m.t === 'hit'), thrown = th.length === 1 && th[0].nid === 'i0' && th[0].bomb === true && th[0].dmg === ROYALMINE.heartDmg();
        emptyPack('iron_sword'); player.equip.weapon = 'iron_sword'; run.hot = 0; F.tp(22, 33); F.face(24, 33); player.attackCd = 0; sent = []; frame(); F.press('Space'); F.step([]);
        const silent = !sent.some(m => m.t === 'hit'); player.equip.weapon = null;
        let puppets = true, local = false;
        F.tp(24, 30);
        for (let k = 0; k < 600; k++) { if (k % 20 === 0) frame(); F.step([]); if (!monsters.every(m => m.remote)) puppets = false; if (monsters.some(m => m.type === 'golemling' || WOKEN.has(m.type) || m.state === 'stir')) local = true; }
        goOffline(); out();
        check(P + 'online, a friend keeps the mine: mining the puppet rock sends one {hit i1, dmg 1, knock 0, bomb false} and changes nothing here; a throw sends {hit i0, bomb true, dmg ' + ROYALMINE.heartDmg() + '}; a sword on the golem sends nothing; 600 ticks later every monster is still the keeper\'s puppet and nothing was spawned or stirred here',
          mined && thrown && silent && puppets && !local, { mined, hits, thrown, th, silent, puppets, local });
      }

      // ---- 32. online, we keep the mine ----
      if (window.NET && window.COOP) {
        fresh({ stage: 5 }); goOnline(); intoMine(); drain(); keeper('Cohen'); F.step([]); ROYALMINE.debug.wake(); const g = golemMon(); g.rm.lingT = 9999; F.tp(18, 30);
        const hp0 = g.hp; push({ t: 'hit', n: 'Ann', nid: 'i0', dmg: 14, knock: 0, bomb: true }); const bomb = g.hp === hp0;
        push({ t: 'hit', n: 'Ann', nid: 'i0', dmg: 60, knock: 0, bomb: true }); const stone = g.hp === hp0 - 60;
        push({ t: 'hit', n: 'Ann', nid: 'i0', dmg: 60, knock: 0, bomb: false }); const sword = g.hp === hp0 - 60;
        const m1 = monsters.find(m => m.nid === 'i1'); push({ t: 'hit', n: 'Ann', nid: 'i1', dmg: 1, knock: 0, bomb: false }); const crack = !!m1 && m1.hp === 5;
        goOffline(); out();
        check(P + 'online, we keep the mine: a friend\'s bomb (14) and a friend\'s 60 without bomb:true do nothing to the golem, a friend\'s stone (60, bomb:true) takes exactly 60, and a friend\'s crack takes the rock to 5',
          COOP && bomb && stone && sword && crack, { bomb, stone, sword, crack, hp: g.hp });
      }

      // ---- 33. the audits ----
      { const S = PLAYTHROUGH.sources(), has = (sk, name) => (S[sk] || []).some(r => r.name === name);
        const labels = has('mining', 'royal coal seam (Royal Mine)') && has('mining', 'royal stormstone seam (Royal Mine)') && has('mining', 'giant mithril ore, a crack (Royal Mine)') && has('mining', 'giant stormstone ore, a crack')
          && has('mining', 'heartstone vein (Heart Chamber)') && has('mining', 'Ginormous Golem fight bonus') && has('mining', 'The Knocking Under the Throne (once)') && has('smithing', 'heat heartstone at a heart forge')
          && has('smithing', "Hilde's heartstone (once)") && has('melee', 'hot heartstone on the Ginormous Golem (2 a damage)') && has('melee', 'Mithril golem (Royal Mine)') && has('melee', 'Stormstone golem (Royal Mine)');
        const p = PLAYTHROUGH.progression(), dead = p.rows.filter(r => r.dead && r.kind !== 'cape').map(r => r.skill + ' ' + r.lv);
        const d = WIKI.rebuild(), types = ['giant_mithril', 'giant_stormstone', 'mithril_golem', 'stormstone_golem', 'golemling', 'ginormous_golem'];
        const pages = types.every(t => !!d.monsters[t]) && ['hildes_heartstone', 'kingstone', 'heartstone_pickaxe', 'stoneheart_helm'].every(id => !!d.items[id]) && !!d.places.the_royal_mine && !!d.quests.royalmine;
        const sums = types.filter(t => MONSTER_DEFS[t].drops.table).every(t => Math.abs(d.monsters[t].tablePct - 100) < 0.01);
        const a = ICONS.audit(), ours = ['hildes_heartstone', 'kingstone', 'heartstone_pickaxe', 'stoneheart_helm'];
        const icons = a.implicated === 0 && ours.every(id => !a.missing.includes(id));
        // the rarity rules 80-icons checks, and the three metals the golems pay in keep their tiers
        const shopIds = new Set(); for (const k in SHOPS) for (const r of SHOPS[k].stock || []) shopIds.add(r[0]);
        const rarityOk = ours.every(id => !shopIds.has(id)) && ICONS.rarity('sunstone_bar') === 'rare' && ICONS.rarity('stormstone_bar') === 'rare' && ICONS.rarity('mithril_bar') === 'uncommon'
          && ['epic', 'unique'].includes(ICONS.rarity('heartstone_pickaxe')) && ['epic', 'unique'].includes(ICONS.rarity('stoneheart_helm'));
        check(P + 'audits: every new XP source is declared; progression has no dead gate; the book has pages for the 6 monsters, 4 items, the place and the quest, with drop tables summing to 100%; no two items share an icon; the uniques are rare and sunstone, stormstone and mithril bars keep their tiers',
          labels && dead.length === 0 && pages && sums && icons && rarityOk, { labels, dead, pages, sums, implicated: a.implicated, missing: ours.filter(id => a.missing.includes(id)), tiers: ['sunstone_bar', 'stormstone_bar', 'mithril_bar', 'heartstone_pickaxe', 'stoneheart_helm', 'stormstone_ore'].map(id => id + ':' + ICONS.rarity(id)) }); }

      // ---- 34. the HUD ----
      { fresh({ stage: 5 }); intoMine(); drain(); ROYALMINE.debug.wake(); const g = golemMon(); g.rm.lingT = 9999; F.tp(18, 30); run.hot = 2;
        const paint = touchOn => { window.__forceTouch = touchOn; const rec = recorder(), nb = buttons.length; HUD.leftY = 200; HUD.leftCol = 0; drawChip(rec); const b = buttons.slice(nb).map(x => x.label); buttons.length = nb; return { text: rec.__log.text.join(' | '), b }; };
        const t1 = paint(true), throwBtn = t1.b.includes('THROW (2)') && /THROW IT/.test(t1.text);
        const l = spawnLittle(0); l.state = 'walk'; l.x = SEAT_C.x + 100; l.y = SEAT_C.y; const t2 = paint(true), smash = /SMASH THE LITTLE GOLEM!/.test(t2.text);
        monsters.splice(monsters.indexOf(l), 1);
        const t3 = paint(false), keys = /\(T\)/.test(t3.text) && !t3.b.some(x => /THROW \(/.test(x));
        window.__forceTouch = S0.touch;
        check(P + 'the HUD chip: in the chamber with 2 hot stones on touch there is a THROW (2) control and the chip says THROW IT; a little golem near him turns it to SMASH THE LITTLE GOLEM!; on a keyboard it says (T)',
          throwBtn && smash && keys, { throwBtn, smash, keys, touchText: t1.text, keyText: t3.text });
        // the core's boss bar: asleep behind his door he is left out of it from the Deep; in his chamber, or awake, he is in it
        const bar = () => { const rec = recorder(); HUD.leftY = 200; HUD.leftCol = 0; drawBossBars(rec, 200); return rec.__log.text.some(s => /GINORMOUS GOLEM/.test(s)); };
        g.rm.phase = 'sleep'; g.state = 'sleep'; run.hot = 0;
        F.tp(23, 21); const deepAsleep = bar(), stillAlive = !g.dead;
        F.tp(24, 28); const chamberAsleep = bar();
        ROYALMINE.debug.wake(); F.tp(23, 21); const deepAwake = bar();
        check(P + 'the boss bar leaves the golem out while he sleeps behind his door (seen from the Deep, 11.5 tiles away) and shows him in his chamber, or anywhere near once he is awake',
          !deepAsleep && stillAlive && chamberAsleep && deepAwake, { deepAsleep, stillAlive, chamberAsleep, deepAwake });
        // the windup: inside the slam ring the chip's first line is GET BACK!, even over a little golem; two tiles further out it is not
        g.rm.phase = 'windup'; g.state = 'windup'; run.hot = 1; const l2 = spawnLittle(0); l2.state = 'walk'; l2.x = SEAT_C.x + 100; l2.y = SEAT_C.y;
        player.x = SEAT_C.x; player.y = SEAT_C.y + 2 * TILE; const w1 = paint(false), back = /^THE HEART CHAMBER \| GET BACK! HE IS GOING TO SLAM/.test(w1.text);
        player.x = SEAT_C.x; player.y = SEAT_C.y + 5 * TILE; const w2 = paint(false), clear = !/GET BACK/.test(w2.text);
        monsters.splice(monsters.indexOf(l2), 1); g.rm.phase = 'fight'; g.state = 'fight';
        check(P + 'during the slam windup a knight inside the ring (2 tiles out) reads GET BACK! first on the chip, and one outside it (5 tiles out) does not',
          back && clear, { back, clear, inside: w1.text, outside: w2.text });
        run.hot = 0; out(); }

      // ---- 35. the Heartstone pickaxe ----
      { fresh({ stage: 5 }); intoMine(); drain(); ROYALMINE.rollWake = () => false; emptyPack('heartstone_pickaxe'); lv('mining', 20); clockFn = () => 1.7e12; ROYALMINE.debug.wake(); golemMon().rm.lingT = 9999; run.raw = 0; run.hot = 0; run.quota = {};
        beside(14, 37); F.press('KeyE'); const fastVein = !!player.action && player.action.type === 'rm_vein' && player.action.need === 0.5; player.action = null;
        const m = giantMon(GIANTS[0]); F.tp(34, 7); F.face(34, 6); const x0 = player.skills.mining.xp; F.press('KeyE'); F.untilAction(300, () => m.hp < 6);
        const two = m.hp === 4 && player.skills.mining.xp - x0 === 80; player.action = null;
        check(P + 'the Heartstone pickaxe, in the Royal Mine: a vein swing takes 0.5 s and a swing at a giant rock lands two cracks (80 xp)', fastVein && two, { fastVein, two, hp: m.hp });
        clockFn = null; out(); }
    } catch (e) {
      check(P + 'the royal mine suite ran to the end without throwing', false, { error: String(e && e.stack || e).slice(0, 600) });
    } finally {
      Math.random = S0.random; clockFn = S0.clockFn; ROYALMINE.rollWake = S0.rollWake; ROYALMINE.heartDmg = S0.heartDmg; restoreNum();
      if (window.NET && NET.online()) goOffline();
      if (netWas) { NET.fake = netWas.fake; NET.enabled = netWas.enabled; NET.token = netWas.token; }
      out(); closePanel(); if (typeof tapCancel === 'function') tapCancel('manual');
      drain(); resetRun();
      if (S0.royal === undefined) delete quest.royalmine; else quest.royalmine = S0.royal;
      if (S0.dwarf === undefined) delete quest.dwarf; else quest.dwarf = S0.dwarf;
      quest.tracked = S0.tracked; quest.untrackedByPlayer = S0.untracked; if (S0.instances) quest.instances = S0.instances;
      player.inv = S0.inv; player.bank = S0.bank; player.keyring = S0.keyring; if (window.KEYRING) KEYRING.absorb();
      player.skills = S0.skills; player.equip = S0.equip; recomputeMaxHp(); player.hp = Math.min(player.maxHp, Math.max(1, S0.hp)); player.dead = false; player.action = null;
      window.__kidmode = S0.kid; window.__forceTouch = S0.touch; deathKeep = S0.deathKeep; player.kills = S0.kills; player.bedSpawn = S0.bed; player.deaths = S0.deaths;
      player.x = S0.px; player.y = S0.py; drops = S0.drops; window.__companionHit = S0.companion;
      const t = thrain(); if (t && S0.th) { t.x = S0.th.x; t.px = S0.th.px; t.py = S0.th.py; }
      syncDeepholm();
      check(P + "afterwards Deepholm is exactly what 24-dwarves builds (the throne on 14,23, Thrain on it) and the knight is back on the surface",
        dhSum() === S0.dhSum && !INSTANCES.active() && (!thrain() || thrain().x === 14), { same: dhSum() === S0.dhSum, inst: INSTANCES.active() });
      levelBanner = null; notice = null; h.peace(S0.peace || false); render();
    }
  });
}
