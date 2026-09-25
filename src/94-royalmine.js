// ============================================================================
// THE KING'S KNOCK — King Thrain's royal mine, the giant ores that wake up, and Gorm the Ginormous
// Cohen, 2026-09-24: "please finish the golom mini game". The owner's design (docs/BACKLOG.md): a story quest
// for the dwarf king, not a fetch; his throne moves aside onto a secret stair; an ornate royal mine with giant
// ores that may wake a golem instead of paying out; and the ginormous golem as a skilling boss you fight while
// stopping little golems from mending him.
//
// THE STORY. Deepholm starts knocking under the floor. Thrain says it is nothing; Brunhild knows a golem's
// knock, and little pebble golems are stealing coal from the forge you relit. The third one you catch holds a
// chip of heartstone cut with the king's own mark (it is on the back of his throne). That is the turn: a hundred
// years ago young Thrain made Gorm, the biggest golem ever, and never called him home. He stands up, the throne
// grinds aside, and the Stair of Kings goes down into the King's Deep. Behind the Heart Door no sword touches
// Gorm: you MINE a glowing heartstone vein, WARM the stone at the heart forge and THROW it at him, smashing the
// little golems before they reach him. The first time he falls you KNOCK three times, as the old rule says, and
// Thrain walks in and calls his friend home. Your knight gets a statue in the Gallery of Kings, and Gorm wakes
// again 45 seconds after every fall, for as long as you like, with friends.
//
// ONLINE (docs/ONLINE.md, the keeper model). Gorm is the instance's spawn 'i0'. Everything that SPAWNS or MOVES
// shared things — woken golems, the little golems, Gorm's pin, his scaling, his mending and re-forming — runs
// only where mayScript() is true (offline, or the map's keeper). The vein glow, the falling rocks, Gorm's stomp
// and whether a giant rock is restless are read off the wall clock (ROYALMINE.now(), corrected by welcome.at), so
// every client agrees without a message. A thrown stone travels as an ordinary hit with bomb:true; a sword is
// swallowed at the sender and never sent. The quest, the throne, the door, your arms, the payout roll and the
// ending are yours alone. Tile changes never sync, and none needs to.
//
// Feature file. Edits nothing but one two-line seam in src/24-dwarves.js (talkBefore for dwarves). Wraps, by
// reassignment with explicit arguments and each keeping __inner: hitMonster, playerAttack, tapAt, tapPathTo,
// finishGather, render, load, INSTANCES.enter, INSTANCES.leave. window.ROYALMINE is the handle.
// ============================================================================
{
  // =========================================================================
  // 1. TILES (8 new; the map is a Uint8Array, so ids stay well under 256 for the Cloud Kingdom)
  // =========================================================================
  const RM_ID = 'royalmine';
  const ROYAL_STAIR = addTile('ROYAL_STAIR', { solid: true, tex: 'wall', mini: '#e0b060' });
  const ROYAL_STATUE = addTile('ROYAL_STATUE', { solid: true, tex: 'cave', mini: '#b8b2a2' });
  const ROYAL_CHASM = addTile('ROYAL_CHASM', { solid: true, tex: 'cave', mini: '#1a0e0a' });
  const HEART_DOOR = addTile('HEART_DOOR', { solid: true, tex: 'wall', mini: '#8a2a1a' });
  const HEART_FORGE = addTile('HEART_FORGE', { solid: true, tex: 'cave', mini: '#ff5a2a' });
  const HEART_VEIN = addTile('HEART_VEIN', { solid: true, tex: 'wall', mini: '#c83a1a' });
  const GIANT_MITHRIL = addTile('GIANT_MITHRIL', { solid: true, tex: 'cave', mini: '#6f8fbf' });
  const GIANT_STORM = addTile('GIANT_STORM', { solid: true, tex: 'cave', mini: '#7a5aa8' });
  for (const t of [ROYAL_STAIR, ROYAL_STATUE, HEART_DOOR, HEART_FORGE, HEART_VEIN, GIANT_MITHRIL, GIANT_STORM]) INTERESTING_TILES.add(t);

  // tiles this file reuses from other feature files, looked up by name (ids are only known at load)
  const DH = window.DEEPHOLM;
  const DW_THRONE = DH ? DH.tiles.throne : -1, DW_LAMP = DH ? DH.tiles.lamp : -1, DW_MITHRIL = DH ? DH.tiles.mithril : -1, DW_CHEST = DH ? DH.tiles.chest : -1;
  const T_PILLAR = ('MINE_PILLAR' in T) ? T.MINE_PILLAR : T.WALL, T_RAIL = ('COAL_RAIL' in T) ? T.COAL_RAIL : T.CAVE, T_BRIDGE = ('BRIDGE' in T) ? T.BRIDGE : T.COBBLE;
  const T_SUN = ('SUNSTONE' in T) ? T.SUNSTONE : T.IRON, T_STORM = ('STORMSTONE' in T) ? T.STORMSTONE : T.IRON;

  // =========================================================================
  // 2. THE KING'S DEEP, to scale: one character is one tile, 56 x 44, no randomness anywhere
  // =========================================================================
  const W = 56, H = 44;
  const ROWS = [
    '########################################################',
    '########################################################',
    '###########################^############################',
    '#####################...L..E..L...######################',
    '#####################.S.........S.######################',
    '#####################.............######################',
    '#####################.S.........S.######################',
    '#####################.............######################',
    '#####################.S.........S.######################',
    '#####################L...........L######################',
    '##########################...###########################',
    '######.C....L....L.....f.......a.....L....L....C.#######',
    '######...........................................#######',
    '######.MM.P....P....P.............P....P....P.MM.#######',
    '######.MM.....................................MM.#######',
    '######...........................................#######',
    '######.+++++++++++++++++++++++++++++++++++++++++.#######',
    '######...........................................#######',
    '######....P....P....P.............P....P....P....#######',
    '######...........................................#######',
    '######..........L.....................L..........#######',
    '#########...##############...##############...##########',
    '##L____________#########################___u_____u__L###',
    '##____________i##.L.................L.##______GGG____###',
    '##m__MM__________.....................________GGG___t###',
    '##___MM__________.....................________GGG____###',
    '##_____________##.....................##_____________###',
    '##m______MM___L~~~~~~~~~~~===~~~~~~~~~~~L_GGG________###',
    '##_______MM____~~~~~~~~~~~===~~~~~~~~~~~__GGG___GGG_t###',
    '##___MM________~~~~~~~~~~~===~~~~~~~~~~~__GGG___GGG__###',
    '##m__MM_______m#####L.............L#####c_______GGG__###',
    '##_____________#####...............#####____________u###',
    '##c__m__m__i__c#####...............#####t_____t_____c###',
    '##########################DDD###########################',
    '#############_____________________________##############',
    '############__r_______F_________F_______r__#############',
    '############_______________________________#############',
    '###########v_______________________________v############',
    '############_______________________________#############',
    '############_______________O_______________#############',
    '###########v_______________________________v############',
    '############__r_________________________r__#############',
    '#############_____________________________##############',
    '####################v#############v#####################',
  ];
  const LEGEND = {
    '#': T.WALL, '.': T.COBBLE, '_': T.CAVE, 'E': T.COBBLE, '^': ROYAL_STAIR, 'S': ROYAL_STATUE, 'L': DW_LAMP, 'P': T_PILLAR, '+': T_RAIL,
    'f': T.FORGE, 'a': T.ANVIL, 'C': DW_CHEST, 'm': DW_MITHRIL, 'i': T.IRON, 'c': T.COAL, 'u': T_SUN, 't': T_STORM, 'M': GIANT_MITHRIL, 'G': GIANT_STORM,
    '~': ROYAL_CHASM, '=': T_BRIDGE, 'D': HEART_DOOR, 'F': HEART_FORGE, 'v': HEART_VEIN, 'r': T.CAVE, 'O': T.CAVE,
  };
  // the builder writes its own grid: build() is handed the instance's setter, not the live map (tileAt would read the overworld)
  function buildGrid() {
    const grid = new Uint8Array(W * H).fill(T.WALL);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = ROWS[y][x]; const t = LEGEND[c]; grid[y * W + x] = t === undefined ? T.WALL : t; }
    return grid;
  }
  const GRID = buildGrid();
  const gridAt = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? GRID[y * W + x] : T.WALL;
  const ENTRY = [27, 3], STAIR_UP = [27, 2], STAIR_DOWN = [14, 23], STAIR_STAND = [14, 22];
  const DOOR = [[26, 33], [27, 33], [28, 33]];
  const FORGES = [[22, 35], [32, 35]];
  const VEINS = [[11, 37], [11, 40], [20, 43], [34, 43], [43, 40], [43, 37]];   // W1 W2 S1 S2 E1 E2
  const VEIN_NAMES = ['west', 'west', 'south', 'south', 'east', 'east'];
  const BURROWS = [[14, 35], [40, 35], [14, 41], [40, 41]];
  const GORM_HOME = [27, 39];
  const CART = [8, 16];
  const HALL = { x0: 12, y0: 34, x1: 42, y1: 42 };
  const ROOMS = {
    gallery: { name: 'Gallery of Kings', x0: 21, y0: 3, x1: 33, y1: 9 },
    delving: { name: 'Delving Hall', x0: 6, y0: 11, x1: 48, y1: 20 },
    bays: { name: 'Mithril Bays', x0: 2, y0: 22, x1: 14, y1: 32 },
    face: { name: 'Deep Face', x0: 40, y0: 22, x1: 52, y1: 32 },
    bridgehead: { name: 'Bridgehead', x0: 17, y0: 23, x1: 37, y1: 26 },
    underfall: { name: 'Underfall', x0: 15, y0: 27, x1: 39, y1: 29 },
    landing: { name: 'Lower Landing', x0: 20, y0: 30, x1: 34, y1: 32 },
    heart: { name: 'Heart of the Mountain', x0: 12, y0: 34, x1: 42, y1: 42 },
  };
  const BANNERS = [[23, 2], [31, 2], [9, 10], [14, 10], [40, 10], [45, 10]], TORN = [[20, 33], [34, 33]];
  const STATUES = [
    { x: 22, y: 4, name: 'Brand', look: { tunic: '#8c867b', hair: '#a8a295', crown: true, beard: true, shoulder: '#9d978b', weapon: { shape: 'warhammer', color: '#b3ad9f' } },
      text: 'KING BRAND THE FOUNDER. He cut the first stair of Deepholm with one hammer and one very long week.' },
    { x: 32, y: 4, name: 'Hrodis', look: { tunic: '#8c867b', hair: '#a8a295', crown: true, woman: true, shoulder: '#9d978b' },
      text: 'QUEEN HRODIS. She found the first heartstone and made the first golem. It was called Pebble, and it could carry one bucket.' },
    { x: 22, y: 6, name: 'Orm', look: { tunic: '#8c867b', hair: '#a8a295', crown: true, beard: true, shoulder: '#9d978b', weapon: { shape: 'axe', color: '#b3ad9f' } },
      text: 'KING ORM. In his day a hundred golems dug these halls, and the lamps were never put out.' },
    { x: 32, y: 6, name: 'Sif', look: { tunic: '#8c867b', hair: '#a8a295', crown: true, woman: true, shoulder: '#9d978b', weapon: { shape: 'sword', color: '#b3ad9f' } },
      text: 'QUEEN SIF THE LAWGIVER. She made the golem rule: every night the king knocks three times, and his golems come home.' },
    { x: 22, y: 8, name: 'Thrain', look: { tunic: '#8c867b', hair: '#a8a295', crown: true, beard: true, shoulder: '#9d978b' },
      text: 'KING THRAIN, YOUNG. He made Gorm, the biggest golem ever, to dig a throne of gold. Someone has scratched under it: HE NEVER CALLED HIM HOME.',
      after: 'KING THRAIN. He made Gorm, the biggest golem ever. A hundred years later, he called him home.' },
    { x: 32, y: 8, name: 'you', empty: true,
      text: 'An empty plinth. The plaque says: FOR THE ONE WHO CALLS GORM HOME.', after: 'A new statue, still dusty from the chisel. It is a knight. It is you.' },
  ];
  // the giant rocks, from their top-left corners
  const ROCKS = [];
  for (const [x, y] of [[7, 13], [46, 13], [5, 24], [9, 27], [5, 29]]) ROCKS.push({ x, y, size: 2, tile: GIANT_MITHRIL, kind: 'mithril' });
  for (const [x, y] of [[46, 23], [42, 27], [48, 28]]) ROCKS.push({ x, y, size: 3, tile: GIANT_STORM, kind: 'storm' });
  ROCKS.forEach((r, i) => { r.i = i; });
  const rockIndexAt = (tx, ty) => { for (const r of ROCKS) if (tx >= r.x && tx < r.x + r.size && ty >= r.y && ty < r.y + r.size) return r.i; return -1; };
  // every cave tile in Gorm's hall where a rock may fall: not round Gorm, not at a forge or a burrow, not in the doorway
  const ROCK_SPOTS = [];
  for (let y = HALL.y0; y <= HALL.y1; y++) for (let x = HALL.x0; x <= HALL.x1; x++) {
    if (gridAt(x, y) !== T.CAVE) continue;
    if (Math.abs(x - GORM_HOME[0]) <= 2 && Math.abs(y - GORM_HOME[1]) <= 2) continue;
    if (FORGES.some(([fx, fy]) => Math.abs(x - fx) <= 1 && Math.abs(y - fy) <= 1)) continue;
    if (BURROWS.some(([bx, by]) => Math.abs(x - bx) <= 1 && Math.abs(y - by) <= 1)) continue;
    if (y === 34 && x >= 26 && x <= 28) continue;
    ROCK_SPOTS.push([x, y]);
  }

  // =========================================================================
  // 3. THE NUMBERS — every tunable in one table
  // =========================================================================
  const N = {
    GORM_HP: 1200, GORM_PER_KNIGHT: 600, GORM_KNIGHTS_MAX: 4, REFORM: 45, EMPTY_HEAL: 30,
    THROW_RANGE: 8, THROW_CD: 0.5, THROW_FLIGHT: 0.45, THROW_MIN: 70, THROW_MAX: 90, KID_THROW: 1.25,
    ARMS: 5, VEIN_WINDOW: 20000, VEIN_TAKE: 3, VEIN_XP: 45, VEIN_LV: 20, KID_LV: 10, HEART_PICK_SWING: 0.6,
    WARM_TIME: 1.0, WARM_XP: 40, WARM_LV: 20,
    LING_EVERY: [12, 9], LING_EVERY_HALF: [8, 6], LING_MAX: 4, LING_SPEED: 50, MEND: 80, KID_MEND: 40,
    ROCK_WINDOW: 4500, ROCK_WARN: 1.5, KID_ROCK_WARN: 2.2, ROCK_R: 30, ROCK_DMG: [9, 14], KID_ROCK_DMG: [4, 7], ROCKS_PER: 4,
    PAYOUT_XP: 300, PITY: 30, QUEST_XP: 1200, QUEST_COINS: 800,
    RESTLESS_WINDOW: 10000, RESTLESS_QUIET: 20, WAKE_ANIM: 0.9, REMOTE_MINE: 1.2, REMOTE_REACH: 1.3,
    THIEF_SPEED: 55, THIEF_NIBBLE_EVERY: 3, THIEF_NIBBLE: 0.6, THIEF_RESPAWN: 4, THIEF_REACH: 40, THIEF_E: 50, THIEF_TAP: 70,
    SLIDE: 2.0, DOOR_OPEN: 1.2, TREMOR_EVERY: 25,
  };
  const GIANT = {
    [GIANT_MITHRIL]: { key: 'mithril', lv: 22, xp: 110, pay: [['mithril_ore', 2]], cracks: 3, regrow: 75, restless: 0.25, golem: 'rock_golem', label: 'giant mithril rock', wakes: 'A ROCK GOLEM WAKES!' },
    [GIANT_STORM]: { key: 'storm', lv: 30, xp: 150, pay: [['stormstone_ore', 2], ['coal', 1]], cracks: 4, regrow: 100, restless: 0.35, golem: 'boulder_golem', label: 'giant stormstone rock', wakes: 'A BOULDER GOLEM WAKES!' },
  };
  // the core GATHER table: its pickaxe gate, its level notice and its swing timer are the ones every rock uses
  for (const t of [GIANT_MITHRIL, GIANT_STORM]) { const g = GIANT[t]; GATHER[t] = { skill: 'mining', tool: 'pickaxe', lv: g.lv, xp: g.xp, item: g.pay[0][0], fall: 0, leaves: T.RUBBLE, regrow: g.regrow, label: g.label }; }

  // =========================================================================
  // 4. SMALL HELPERS: the clock, two integer hashes, who may script, who else is here
  // =========================================================================
  let nowFn = null, skew = 0;
  const now = () => (nowFn ? nowFn() : Date.now()) + (nowFn ? 0 : skew);
  if (window.NET && NET.on) NET.on('welcome', msg => { if (msg && typeof msg.at === 'number' && Number.isFinite(msg.at)) skew = msg.at - Date.now(); });
  // an integer hash to [0,1): the same on every client, for the same inputs
  function h32(a, b) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const mayScript = () => !window.NET || !NET.online() || !!(window.COOP && COOP.isKeeper());
  const inside = () => !!(window.INSTANCES && INSTANCES.active() === RM_ID);
  const inDeep = () => !!(window.INSTANCES && DH && INSTANCES.active() === DH.ID);
  const tileOf = (x, y) => [Math.floor(x / TILE), Math.floor(y / TILE)];
  const inRect = (r, tx, ty) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;
  const inHallPx = (x, y) => { const [tx, ty] = tileOf(x, y); return inRect(HALL, tx, ty); };
  const kid = () => !!window.__kidmode;
  const R = () => { const q = quest.royal || (quest.royal = { stage: 0, caught: 0, door: false, falls: 0, best: 0, payouts: 0, seenHow: false, seenRestless: false, seenWake: false, seenGiant: false });
    if (typeof q.stage !== 'number') q.stage = 0; return q; };
  const dq = () => quest.dwarf || { stage: 0 };
  const thrain = () => DH ? DH.DWARVES.find(d => d.id === 'thrain') : null;
  // remote knights, from the presence the players file keeps (with their map and what they are doing)
  function remotesOn(map) {
    if (!window.NET || !NET.online()) return [];
    const out = [], me = NET.me, RM = window.PLAYERS && PLAYERS.remote;
    if (RM && typeof RM === 'object') for (const n in RM) { const e = RM[n]; if (e && n !== me && e.map === map && typeof e.x === 'number' && typeof e.y === 'number') out.push({ n, x: e.x, y: e.y, act: e.act || null, dead: !!e.dead }); }
    return out;
  }
  // how many knights stand in Gorm's hall: the local one plus the keeper model's remote knights on this map
  function knightsInHall() {
    let n = inside() && !player.dead && inHallPx(player.x, player.y) ? 1 : 0;
    if (window.NET && NET.online() && window.COOP && COOP.knightsHere) for (const k of COOP.knightsHere()) if (!k.dead && inHallPx(k.x, k.y)) n++;
    return n;
  }
  const say2 = (text, who) => { LOG.push((who || 'The Voice') + ': ' + text); if (LOG.length > 300) LOG.shift(); say(text, who || 'The Voice'); };
  const LOG = [];
  const setLive = (tx, ty, t) => { if (tileAt(tx, ty) !== t) changeTile(tx, ty, t); };
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const nudgeOut = e => { if (!collides(e.x, e.y, e.r || 13, e === player ? 'player' : 'beast')) return; const s = safeSpot(e.x, e.y, e.r || 13, e === player ? 'player' : 'beast'); if (s) { e.x = s.x; e.y = s.y; } };

  // =========================================================================
  // 5. ITEMS — three, each with its own drawing
  // =========================================================================
  Object.assign(ITEMS, {
    heartstone_chip: { name: 'Heartstone chip', value: 0, color: '#d8452a', shape: 'rock' },
    crownheart: { name: 'The crownheart', value: 0, color: '#e0342a', shape: 'rock' },
    heartstone_pickaxe: { name: 'Heartstone pickaxe', value: 5000, color: '#e0482a', shape: 'pickaxe', tool: 'pickaxe', tier: 3 },
  });
  for (const id of ['heartstone_chip', 'crownheart', 'heartstone_pickaxe']) { ITEMS[id].id = id; ITEMS[id].stack = 1; }
  if (window.KEYRING) {
    KEYRING.register('heartstone_chip', 'Red stone, warm as a coal. A crown over an anvil is cut into it.');
    KEYRING.register('crownheart', "King Thrain's. The first heart he ever gave Gorm. The Heart Door knows it.");
  }
  const hasHeartPick = () => countItem('heartstone_pickaxe') > 0 || Object.values(player.equip || {}).includes('heartstone_pickaxe');
  // the crown over the anvil: King Thrain's mark, cut into the chip, the crownheart, his banners, his throne and Gorm's chest
  function mark(g, cx, cy, s, col) {
    g.save(); g.translate(cx, cy); g.scale(s, s); g.fillStyle = col;
    g.beginPath(); g.moveTo(-6, 1); g.lineTo(5, 1); g.lineTo(5, 3); g.lineTo(2, 3); g.lineTo(2, 5); g.lineTo(4, 7); g.lineTo(-4, 7); g.lineTo(-2, 5); g.lineTo(-2, 3); g.lineTo(-4, 3); g.quadraticCurveTo(-7, 3, -8.4, 1.6); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-5, -1); g.lineTo(-5, -6); g.lineTo(-2.5, -3.2); g.lineTo(0, -7.4); g.lineTo(2.5, -3.2); g.lineTo(5, -6); g.lineTo(5, -1); g.closePath(); g.fill();
    g.restore();
  }
  if (window.ICONS) {
    // a small red shard, still warm, with the king's mark cut into it
    ICONS.set('heartstone_chip', (g, size, item) => {
      g.fillStyle = '#7a1e12'; g.beginPath(); g.moveTo(-6, 5); g.lineTo(-7.4, -1); g.lineTo(-2, -7); g.lineTo(5, -6); g.lineTo(7.4, 1); g.lineTo(2, 7); g.closePath(); g.fill();
      g.fillStyle = item.color; g.beginPath(); g.moveTo(-5, 4); g.lineTo(-6, -1); g.lineTo(-1.6, -5.6); g.lineTo(4, -4.8); g.lineTo(5.8, 1); g.lineTo(1.6, 5.4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = 'rgba(255,190,120,0.55)'; g.beginPath(); g.moveTo(-4, -1); g.lineTo(-1.4, -4.4); g.lineTo(1.6, -4); g.lineTo(-2, -0.4); g.closePath(); g.fill();
      mark(g, 0.4, 0.8, 0.42, '#f5c542');
    });
    // a heart-cut red gem held in a small gold crown setting
    ICONS.set('crownheart', (g, size, item) => {
      g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(-8, -3); g.lineTo(-8, -8.4); g.lineTo(-4.4, -5); g.lineTo(0, -9); g.lineTo(4.4, -5); g.lineTo(8, -8.4); g.lineTo(8, -3); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#b8862a'; g.fillRect(-8, -4, 16, 2.4);
      g.fillStyle = item.color; g.beginPath(); g.moveTo(0, 8.6); g.bezierCurveTo(-9, 2, -8, -5, -3.6, -4.2); g.bezierCurveTo(-1.6, -3.8, 0, -2, 0, -1); g.bezierCurveTo(0, -2, 1.6, -3.8, 3.6, -4.2); g.bezierCurveTo(8, -5, 9, 2, 0, 8.6); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,220,200,0.6)'; g.beginPath(); g.ellipse(-3, -1, 2, 1.2, -0.6, 0, 7); g.fill();
      g.fillStyle = '#ffd08a'; g.beginPath(); g.arc(0, -8, 1, 0, 7); g.fill();
    });
    // a red crystal head, faceted, on a dark-iron haft bound in gold
    ICONS.set('heartstone_pickaxe', (g, size, item) => {
      g.save(); g.rotate(-0.35);
      g.fillStyle = '#2e2f36'; g.fillRect(-1.5, -5.4, 3, 14.4); g.fillStyle = '#f5c542'; g.fillRect(-2, 2.6, 4, 2); g.fillRect(-2, 6.4, 4, 2);
      g.fillStyle = item.color; g.beginPath(); g.moveTo(0, -8.6); g.lineTo(-9.4, -4.4); g.lineTo(-7.4, -2.6); g.lineTo(-2, -4.6); g.lineTo(0, -3.4); g.lineTo(2, -4.6); g.lineTo(7.4, -2.6); g.lineTo(9.4, -4.4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#ffb080'; g.beginPath(); g.moveTo(0, -8); g.lineTo(-5, -5.6); g.lineTo(-2, -5.2); g.closePath(); g.fill();
      g.fillStyle = '#7a1e12'; g.beginPath(); g.moveTo(0, -8); g.lineTo(5, -5.6); g.lineTo(2, -5.2); g.closePath(); g.fill();
      g.restore();
    });
  }

  // =========================================================================
  // 6. MONSTERS — two woken golems, the little ones, and Gorm
  // =========================================================================
  Object.assign(MONSTER_DEFS, {
    rock_golem: { name: 'Rock golem', level: 24, r: 20, hp: 110, att: 24, maxHit: 9, def: 28, speed: 70, aggro: true, sight: 7 * TILE, respawn: 1e9,
      drops: { always: [['coal', 3, 5]], table: [['mithril_bar', 1, 2, 30], ['mithril_ore', 3, 4, 30], ['sunstone_ore', 2, 3, 25], ['sunstone_bar', 1, 1, 15]] } },
    boulder_golem: { name: 'Boulder golem', level: 34, r: 30, hp: 240, att: 34, maxHit: 13, def: 40, speed: 55, aggro: true, sight: 7 * TILE, respawn: 1e9,
      drops: { always: [['coal', 5, 8], ['mithril_bar', 1, 1]], table: [['stormstone_ore', 3, 5, 35], ['stormstone_bar', 1, 2, 25], ['sunstone_bar', 1, 2, 25], ['mithril_bar', 2, 3, 15]] } },
    golemling: { name: 'Little golem', level: 8, r: 11, hp: 30, att: 1, maxHit: 0, def: 4, speed: 50, aggro: false, harmless: true, sight: 4 * TILE, respawn: 1e9,
      drops: { always: [['coal', 1, 1]] } },
    gorm: { name: 'Gorm the Ginormous', level: 50, r: 46, hp: N.GORM_HP, att: 40, maxHit: 12, def: 60, speed: 0, aggro: true, sight: 10 * TILE, respawn: 1e9, drops: {} },
  });
  const SPAWNED = new Set(['rock_golem', 'boulder_golem', 'golemling']);
  // the payout, rolled locally by rollDrops so a pickaxe gets the core's own RARE DROP banner
  const HOARD = {
    always: [['coins', 400, 700], ['coal', 8, 14]],
    table: [['mithril_bar', 4, 6, 30], ['sunstone_bar', 3, 5, 25], ['stormstone_ore', 6, 10, 20], ['stormstone_bar', 2, 3, 15], ['mithril_ore', 10, 15, 10]],
    rare: { chance: 25, table: [['heartstone_pickaxe', 1, 1, 1]] },
  };
  function makeMon(type, x, y) {
    const d = MONSTER_DEFS[type];
    return { type, x, y, home: { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: !!d.aggro, state: 'idle', wanderT: 99, wander: { x: 0, y: 0 },
      attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 1e9, facing: { x: 0, y: 1 }, walkT: 0, moving: false, stunT: 0, royalSpawned: true };
  }
  const gorm = () => monsters.find(m => m.type === 'gorm') || null;
  const gormUp = () => { const m = gorm(); return !!m && !m.dead && !m.gone && m.hp > 0; };

  // =========================================================================
  // 7. THE QUEST: "The King's Knock"
  // =========================================================================
  QUEST_DEFS.royal = { name: "The King's Knock" };
  const QTEXT = {
    1: () => 'Something is knocking under Deepholm. Ask King Thrain what it is.',
    2: () => 'King Thrain says it is nothing. He did not look at you when he said it. Brunhild the smith might know more.',
    3: () => `Catch the pebble thieves before they dive down a crack. Caught: ${Math.min(3, R().caught || 0)}/3. Swing at one, or tap it.`,
    4: () => 'A heartstone chip, marked with a crown over an anvil. You have seen that mark before. Look at King Thrain\'s throne.',
    5: () => 'Go down the Stair of Kings behind the throne. Find the Heart Door at the far end of the royal mine. Fighting Gorm needs Mining 20 and Smithing 20.',
    6: () => 'Gorm is behind the Heart Door. Mine a glowing vein, warm the stone at the heart forge, and throw it at him. When he falls, knock three times.',
    7: () => `Done. Gorm wakes again 45 seconds after he sleeps. Put to sleep: ${R().falls || 0} times. Best: ${R().best ? mmss(R().best) : 'not yet'}.`,
  };
  HOOKS.questText.royal = () => { const s = R().stage; return QTEXT[s] ? QTEXT[s]() : 'Nothing yet.'; };
  HOOKS.activeQuests.push(() => { const s = R().stage; return s >= 1 && s <= 6 ? ['royal'] : []; });
  HOOKS.mapTarget.push(() => { const s = R().stage; return s >= 1 && s <= 6 && DH ? { x: DH.SHAFT.x, y: DH.SHAFT.y, label: "The King's Knock: Deepholm, down the mine shaft", id: 'royal' } : null; });
  function setStage(s) {
    const q = R(); if (s <= q.stage) return;
    q.stage = s;
    if (s >= 1 && s <= 6 && !quest.untrackedByPlayer) quest.tracked = 'royal';
    save();
  }

  // ---------- the cutscene feeder: long speeches go out a line at a time, and an act fires as its line comes up ----------
  // say() refuses to queue more than eight lines (a runaway hook must not queue a minute of talk), and the turn is
  // sixteen. So a speech waits here and is fed to the dialogue one line ahead of what is on screen.
  const cine = [];
  let cineWait = null;
  const cineSay = (who, text, act) => cine.push({ who, text, act: act || null });
  const cineAct = act => cine.push({ act });
  function cineFeed() {
    if (cineWait) {
      const w = cineWait, live = dialog.cur === w.entry || dialog.queue.includes(w.entry);
      if (dialog.cur === w.entry || !live) { cineWait = null; w.act(); } else return;
    }
    while (cine.length && dialog.queue.length === 0) {
      const s = cine.shift();
      if (!s.text) { if (s.act) s.act(); continue; }
      const n0 = dialog.queue.length;
      say2(s.text, s.who);
      const entry = dialog.queue.length > n0 ? dialog.queue[dialog.queue.length - 1] : null;
      if (s.act) { if (entry) cineWait = { entry, act: s.act }; else s.act(); }
      break;
    }
  }
  // leaving mid-speech: every act still happens (the stage moves on, the item is given), the words are dropped
  function cineFlush() { if (cineWait) { const w = cineWait; cineWait = null; w.act(); } while (cine.length) { const s = cine.shift(); if (s.act) s.act(); } }
  const cineBusy = () => cine.length > 0 || !!cineWait;

  // =========================================================================
  // 8. THE INSTANCE and the world pass that rebuilds it on every world-gen
  // =========================================================================
  function build(setTile) { const grid = buildGrid(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) setTile(x, y, grid[y * W + x]); }
  const checksum = () => { const grid = buildGrid(); let s = 0; for (let i = 0; i < grid.length; i++) s = (Math.imul(s, 31) + grid[i]) | 0; return s; };
  if (window.INSTANCES && DH) INSTANCES.define(RM_ID, {
    name: "The King's Deep", sub: 'The royal mine under the throne', w: W, h: H, build,
    entry: ENTRY, exit: null, step: DH.SHAFT_STEP, dark: false,
    spawns: [['gorm', GORM_HOME[0], GORM_HOME[1]]],
    voice: 'The King\'s Deep. Gold on every pillar, and lamps that never went out. Nobody has walked here for a hundred years.',
  });
  // define() stamps the entry tile as cave; the map says flagstone, so the world pass lays the rows again exactly
  function worldHook() {
    const inst = window.INSTANCES && INSTANCES.get(RM_ID); if (!inst) return;
    const grid = buildGrid(); for (let i = 0; i < grid.length; i++) inst.tiles[i] = grid[i];
  }
  HOOKS.world.push(() => worldHook());

  // =========================================================================
  // 9. LIGHT: the King's Deep is lit like a palace, not a cave
  // =========================================================================
  if (window.INSTANCE_LIGHT) INSTANCE_LIGHT.set(RM_ID, 'lamplit');
  if (window.LIGHTS) {
    LIGHTS.scene(RM_ID, {
      ambient: { color: '#0a0806', alpha: 0.40 },
      player: { r: 130, lift: 0.7 },
      rooms: [
        { ...ROOMS.gallery, lift: 0.80, color: '#ffe2a8' },
        { ...ROOMS.delving, lift: 0.78, color: '#ffd489' },
        { ...ROOMS.bays, lift: 0.55, color: '#ffcf9c' },
        { ...ROOMS.face, lift: 0.55, color: '#ffcf9c' },
        { ...ROOMS.bridgehead, lift: 0.60, color: '#ffb070' },
        { ...ROOMS.landing, lift: 0.60, color: '#ffb070' },
        { ...ROOMS.heart, lift: 0.62, color: '#ff8a4a', tint: 0.12 },
      ],
    });
    LIGHTS.add({ name: 'heart forge', tile: 'HEART_FORGE', r: 150, lift: 1, color: '#ff5a2a', tint: 0.26, flicker: 0.14, speed: 8.5, oy: -6 });
    LIGHTS.add({ name: 'royal stair', tile: 'ROYAL_STAIR', r: 150, lift: 0.95, color: '#ffe9b0', tint: 0.14 });
    LIGHTS.add({ name: 'underfall', tile: 'ROYAL_CHASM', r: 90, lift: 0.6, color: '#ff7030', tint: 0.25, flicker: 0.1, speed: 2.4 });
    LIGHTS.addSource((out, sc) => {
      if (!sc || sc.id !== RM_ID) return;
      const t = now(), lit = litVeins(t);
      for (const v of lit) { const [x, y] = VEINS[v]; out.push({ kind: 'point', name: 'heartstone vein', x: tc(x), y: tc(y), r: 70, lift: 0.9, tint: 0.22, color: '#ff6a3a', rgb: [255, 106, 58] }); }
      const gm = gorm();
      if (gm && !gm.dead) out.push({ kind: 'point', name: 'gorm', x: gm.x, y: gm.y - 58, r: 170, lift: 0.85, tint: 0.2, color: '#ff6a3d', rgb: [255, 106, 61] });
      if (arms.raw + arms.warm > 0 && !player.dead) out.push({ kind: 'point', name: 'warm stones', x: player.x, y: player.y - 30, r: 60, lift: 0.6, tint: 0.18, color: '#ffd08a', rgb: [255, 208, 138] });
    });
  }

  // =========================================================================
  // 10. DEEPHOLM: the knocking, the pebble thieves, and the throne that moves
  // =========================================================================
  const FORGE_SPOTS = [[10, 11], [18, 11]];
  const CRACKS = [[4, 5], [24, 5], [9, 21]];
  const TH = { list: [], due: [], made: 0, tremorT: 0 };
  let guest = false, riding = false;
  // BFS over Deepholm's own tile map (its template: the throne never moves there), 4-neighbour, walkable = not solid
  function deepPath(from, to) {
    const inst = window.INSTANCES && INSTANCES.get(DH.ID); if (!inst) return null;
    const w = inst.w, h = inst.h, tiles = inst.tiles, prev = new Int32Array(w * h).fill(-1), q = [from[1] * w + from[0]];
    prev[q[0]] = q[0];
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi]; if (c === to[1] * w + to[0]) break;
      const cx = c % w, cy = (c / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx; if (prev[n] !== -1 || SOLID.has(tiles[n])) continue;
        prev[n] = c; q.push(n);
      }
    }
    const goal = to[1] * w + to[0]; if (prev[goal] === -1) return null;
    const path = []; let c = goal; while (c !== q[0]) { path.push([c % w, (c / w) | 0]); c = prev[c]; } return path.reverse();
  }
  function spawnThief() {
    const k = TH.made++, from = FORGE_SPOTS[k % 2], crack = CRACKS[k % 3];
    const path = deepPath(from, crack) || [crack];
    const t = { id: 'thief' + k, x: tc(from[0]), y: tc(from[1]), path, i: 0, t: 0, nibbleT: 0, sinceNibble: 0, walkT: 0, facing: { x: 0, y: 1 }, crack };
    TH.list.push(t); burst(t.x, t.y, '#8f8a80', 8, 50);
    return t;
  }
  function clearThieves() { TH.list.length = 0; TH.due.length = 0; }
  function catchThief(t, how) {
    const i = TH.list.indexOf(t); if (i < 0) return false;
    TH.list.splice(i, 1);
    const q = R(); q.caught = (q.caught || 0) + 1;
    burst(t.x, t.y, '#9a948a', 16, 110); burst(t.x, t.y, '#2b2b33', 6, 60); sfx('hit');
    giveOrDrop('coal', 1, player.x, player.y);
    if (q.caught >= 3) {
      for (const o of TH.list.slice()) burst(o.x, o.y, '#9a948a', 10, 80);
      clearThieves();
      say2('The last thief falls apart. Inside the pebbles is a chip of red stone, warm as a coal.');
      say2('Cut into it, very small: a crown over an anvil.');
      giveOrDrop('heartstone_chip', 1, player.x, player.y);
      setStage(4);
    } else {
      floatText(t.x, t.y - 20, 'Caught!', '#ffe9a8', 16);
      notify('It falls apart into pebbles. The coal rolls out.');
      TH.due.push(time + N.THIEF_RESPAWN);
      save();
    }
    TH.lastHow = how;
    return true;
  }
  function thiefInFront(reach) {
    let best = null;
    for (const t of TH.list) {
      const d = dist(player.x, player.y, t.x, t.y); if (d > reach) continue;
      const dot = ((t.x - player.x) * player.facing.x + (t.y - player.y) * player.facing.y) / (d || 1);
      if (dot < 0.2 && d > 20) continue;
      if (!best || d < best.d) best = { t, d };
    }
    return best ? best.t : null;
  }
  function tapCatch(id) {
    const t = TH.list.find(o => o.id === id);
    if (!t || dist(player.x, player.y, t.x, t.y) > N.THIEF_TAP) { notify('It scurried off. Tap it again!'); return; }
    catchThief(t, 'tap');
  }
  if (typeof TAP_PEOPLE !== 'undefined') TAP_PEOPLE.push(() => inDeep() && R().stage === 3 ? TH.list.map(t => ({ x: t.x, y: t.y, r: 12, id: t.id, name: 'Pebble thief', talk: () => tapCatch(t.id) })) : []);
  function stepThieves(dt) {
    for (const t of TH.list.slice()) {
      t.t += dt; t.walkT += dt;
      if (t.nibbleT > 0) { t.nibbleT -= dt; continue; }
      t.sinceNibble += dt;
      if (t.sinceNibble >= N.THIEF_NIBBLE_EVERY) { t.sinceNibble = 0; t.nibbleT = N.THIEF_NIBBLE; continue; }
      let step = N.THIEF_SPEED * dt;
      while (step > 0 && t.i < t.path.length) {
        const [wx, wy] = t.path[t.i], gx = tc(wx), gy = tc(wy), dx = gx - t.x, dy = gy - t.y, d = Math.hypot(dx, dy);
        if (d <= step) { t.x = gx; t.y = gy; step -= d; t.i++; continue; }
        t.x += dx / d * step; t.y += dy / d * step; t.facing = { x: dx / d, y: dy / d }; step = 0;
      }
      if (t.i >= t.path.length) {
        TH.list.splice(TH.list.indexOf(t), 1);
        burst(t.x, t.y, '#5a554c', 14, 70);
        notify('A pebble thief dove down a crack with your coal. Here comes another one.');
        TH.due.push(time + N.THIEF_RESPAWN);
      }
    }
    TH.due.sort((a, b) => a - b);
    while (TH.due.length && TH.due[0] <= time && TH.list.length < 2) { TH.due.shift(); spawnThief(); }
  }
  // ---------- the knocking ----------
  function tremor() {
    if (window.IMPACT) IMPACT.wave(tc(14), tc(23), 0.8, 'royal-knock');
    for (let k = 0; k < 6; k++) {
      const x = player.x + rint(-150, 150), y = player.y + rint(-170, -50);
      for (let j = 0; j < 5; j++) particles.push({ x: x + rint(-8, 8), y, vx: rint(-10, 10), vy: 60 + Math.random() * 50, t: 0.6 + Math.random() * 0.5, color: j % 2 ? '#8f887a' : '#b0a894', r: 1.6 + Math.random() * 1.6 });
    }
    floatText(tc(14), tc(23) + 8, 'knock knock knock', '#e8cf9a', 14);
    sfx('boom');
  }
  // ---------- the throne ----------
  const slide = {
    on: false, t: 0, story: false,
    start(story) { startSlide(!!story); },
    x() { if (!this.on) return tileAt(16, 23) === DW_THRONE && tileAt(14, 23) !== DW_THRONE ? 16 : 14; const k = clamp(this.t / N.SLIDE, 0, 1); return 14 + 2 * (k * k * (3 - 2 * k)); },
  };
  const slid = () => inDeep() && tileAt(STAIR_DOWN[0], STAIR_DOWN[1]) === ROYAL_STAIR;
  function startSlide(story) {
    if (!inDeep()) { if (story) finishStory(); return; }
    if (slid()) { if (story) finishStory(); return; }
    slide.on = true; slide.t = 0; slide.story = story;
    setLive(14, 23, T.CAVE);
    for (let k = 0; k < 4; k++) burst(tc(14) + rint(-20, 20), tc(23) + 12, '#9a927f', 10, 70);
    if (window.IMPACT) IMPACT.wave(tc(14), tc(23), 1.4, 'royal-throne');
    sfx('open'); floatText(tc(15), tc(23) - 30, 'GRRRIND', '#e8cf9a', 17);
  }
  function finishSlide() {
    const story = slide.story; slide.on = false; slide.t = 0; slide.story = false;
    if (inDeep()) {
      setLive(14, 23, ROYAL_STAIR); setLive(16, 23, DW_THRONE);
      const th = thrain(); if (th) { th.px = tc(11); th.py = tc(23); }
      nudgeOut(player); for (const m of monsters) if (!m.dead) nudgeOut(m);
      levelBanner = { text: 'THE THRONE MOVES', sub: 'A stair goes down into the dark.', t: 4 }; sfx('quest');
      burst(tc(14), tc(23), '#ffe9b0', 18, 90);
    }
    if (story) finishStory();
  }
  function finishStory() { setStage(5); }
  // on every entry to Deepholm, and after a new game or a load: the throne is where the quest says it is
  function applyThrone() {
    const th = thrain();
    if (!inDeep()) { if (th) { th.px = tc(DH.THRONE.x); th.py = tc(DH.THRONE.y); } return; }
    if (R().stage >= 5 || guest) { setLive(14, 23, ROYAL_STAIR); setLive(16, 23, DW_THRONE); if (th) { th.px = tc(11); th.py = tc(23); } }
    else { setLive(14, 23, DW_THRONE); setLive(16, 23, T.CAVE); if (th) { th.px = tc(DH.THRONE.x); th.py = tc(DH.THRONE.y); } }
  }
  function closeAll() {
    slide.on = false; slide.t = 0; slide.story = false; guest = false; riding = false; clearThieves(); cine.length = 0; cineWait = null;
    const th = thrain(); if (th && DH) { th.px = tc(DH.THRONE.x); th.py = tc(DH.THRONE.y); }
  }

  // ---------- the talk seam in 24-dwarves: Thrain and Brunhild, only in the stages this quest owns ----------
  const THRAIN = 'King Thrain', BRUN = 'Brunhild the smith';
  function thrainTalk(d) {
    if (dq().stage < 2) return false;
    const q = R();
    if (q.stage < 5 && !guest && !slid() && remotesOn(RM_ID).length) {
      say2('Your friend is down my stair already. Any friend of theirs may follow. Just this once, knight.', THRAIN);
      guest = true; startSlide(false);
      return true;
    }
    if (q.stage === 1) { say2('Knocking? The mountain is old. Old things creak.', THRAIN); say2('A king does not leave his throne over a noise. Go and smith something.', THRAIN); setStage(2); return true; }
    if (q.stage === 2 || q.stage === 3) { say2('It is nothing, knight. Nothing at all.', THRAIN); return true; }
    if (q.stage === 4) { if (!cineBusy()) theTurn(); return true; }
    if (q.stage === 5 || q.stage === 6) { say2('The stair is behind the throne. Gorm is at the very bottom, past the bridge. Mine, warm, throw.', THRAIN); return true; }
    if (q.stage >= 7) { say2(pick(['He wakes again every time the mountain\'s heart beats. He does not mind. I think he likes the company.', 'Go and play with him, knight. I cannot. My knees are a hundred and forty years old.']), THRAIN); return true; }
    return false;
  }
  function brunhildTalk(d) {
    if (dq().stage < 2) return false;
    const q = R();
    if (q.stage === 2) {
      say2('Three knocks, then quiet, then three more? That is a golem\'s knock.', BRUN);
      say2('Golems are ore with a heartstone for a heart. The old dwarves made them to dig.', BRUN);
      say2('The rule was: every night the king knocks three times, and his golems come home. Nobody has made a golem in a hundred years.', BRUN);
      say2('And ever since you lit the great forge, something keeps stealing my coal. Little grey things. Golems eat fire.', BRUN);
      say2('There! There goes one! Catch it before it gets down a crack!', BRUN);
      q.caught = 0; setStage(3); clearThieves(); spawnThief(); TH.due.push(time + 5);
      openPanel('shop', d.shop || 'dwarf');
      return true;
    }
    if (q.stage === 3) { say2('Catch them! They are slow, but they are sneaky.', BRUN); openPanel('shop', d.shop || 'dwarf'); return true; }
    if (q.stage === 4) { say2('A crown over an anvil. That is the king\'s own mark. Take it to him.', BRUN); openPanel('shop', d.shop || 'dwarf'); return true; }
    return false;
  }
  HOOKS.talkBefore.dwarf_king = thrainTalk;
  HOOKS.talkBefore.dwarf_shop = brunhildTalk;
  const TURN = [
    'Where did you find that?',
    'Give it here. ... Yes. That is my mark. That is my heartstone.',
    'A hundred years ago I was a young king. I wanted a throne of gold.',
    'So I made a golem to dig for it. The biggest golem ever made. I named him Gorm.',
    'I gave him heartstone after heartstone so he would dig faster. He grew, and grew.',
    'Then Gorm found the heart of the mountain, and he would not stop digging. He made little golems out of his rubble, to mend him when he got hurt.',
    'I should have knocked three times and called him home. I never did. I was afraid of him.',
    'So I shut the royal mine, and I put my throne on the only door. I have sat on it ever since.',
    'Hilde thinks I sit here because I am a king. I sit here because I am ashamed.',
    'You chased his little ones and you did not run. So I will not sit here any longer. Stand back.',
    'There. The Stair of Kings. It goes down to the royal mine.',
    'Take this. My crownheart. The first heart I ever gave Gorm. The door at the back of the mine will know it.',
    'No sword can hurt Gorm. Only a heartstone can crack a heartstone.',
    'Mine the glowing veins in his hall. Warm them at the old heart forge. Then throw them at him.',
    'And smash his little ones before they reach him, or they will mend him.',
    'When he falls, knock three times. Tell him his king calls him home.',
  ];
  function giveCrownheart() {
    if (countItem('heartstone_chip') > 0) removeItem('heartstone_chip', 1);
    if (!countItem('crownheart')) giveOrDrop('crownheart', 1, player.x, player.y);
  }
  function theTurn() {
    TURN.forEach((line, i) => cineSay(THRAIN, line, i === 9 ? () => startSlide(true) : i === 11 ? giveCrownheart : null));
    cineAct(() => { if (R().stage < 5) finishStory(); });
  }

  // =========================================================================
  // 11. THE KING'S DEEP: stations, the giant rocks, the veins, the forge and the throw
  // =========================================================================
  const arms = { raw: 0, warm: 0 };
  const fight = { landed: 0, smashed: 0, fallSeen: false, paid: false, downAt: null, lifeStart: null, lastHp: null, lastMax: null, lastDown: false,
    throwCd: 0, clangNoteT: -99, mendNoteT: -99, halfSaid: false, inHall: false, hallBannerT: -99, knocks: 0, mendFlashT: -99, hitFlashT: -99, lastRockDmg: 0, stirred: {}, dustT: 0 };
  const stones = [];
  const vein = { taken: {} };
  const K = { lingT: 0, burrow: 0, emptyT: 0, downT: 0, remoteMine: {} };
  const rocks = { win: null, list: [], landed: true, debris: [] };
  const wakes = [];
  const golemOf = {}, quietUntil = {}, rockStage = {};
  const ending = { on: false, thrain: null };
  const knockRings = [];
  const TEST = { noLings: false, noRocks: false };
  let doorAnim = null;

  // ---------- the clock-derived schedules: the same answer on every client ----------
  const PAIRS = []; for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) PAIRS.push([a, b]);
  const rawPair = win => Math.floor(mulberry32((win * 40503) ^ 0x6e17)() * 15);
  // a pair that matches the window before it moves on to the next pair; walked from six windows back so it never repeats
  function pairIndex(win) { let p = rawPair(win - 6); for (let w = win - 5; w <= win; w++) { let r = rawPair(w); if (r === p) r = (r + 1) % 15; p = r; } return p; }
  const litVeins = t => PAIRS[pairIndex(Math.floor(t / N.VEIN_WINDOW))];
  function rocksAt(t) {
    const win = Math.floor(t / N.ROCK_WINDOW), out = [];
    for (let k = 0; k < N.ROCKS_PER; k++) out.push(ROCK_SPOTS[Math.floor(mulberry32((win * 16 + k) ^ 0x70c5)() * ROCK_SPOTS.length)]);
    return out;
  }
  const restlessRaw = (i, t) => h32(i + 1, Math.floor(t / N.RESTLESS_WINDOW)) < GIANT[ROCKS[i].tile].restless;
  function golemAlive(i) {
    const g = golemOf[i]; if (g && monsters.includes(g) && !g.dead) return true;
    const r = ROCKS[i], cx = (r.x + r.size / 2) * TILE, cy = (r.y + r.size / 2) * TILE, type = GIANT[r.tile].golem;
    for (const m of monsters) if (m.remote && !m.dead && !m.gone && m.type === type && dist(m.home.x, m.home.y, cx, cy) < 4 * TILE) return true;
    return false;
  }
  function restless(i, t) { if (golemAlive(i)) return false; if (quietUntil[i] && time < quietUntil[i]) return false; return restlessRaw(i, t); }
  const rockIntact = i => { const r = ROCKS[i]; for (let y = r.y; y < r.y + r.size; y++) for (let x = r.x; x < r.x + r.size; x++) if (tileAt(x, y) !== r.tile) return false; return true; };
  const rockCentre = r => ({ x: (r.x + r.size / 2) * TILE, y: (r.y + r.size / 2) * TILE });
  const rectDistTiles = (r, px, py) => { const dx = Math.max(r.x * TILE - px, 0, px - (r.x + r.size) * TILE), dy = Math.max(r.y * TILE - py, 0, py - (r.y + r.size) * TILE); return Math.hypot(dx, dy) / TILE; };

  // ---------- waking a golem out of a giant rock ----------
  function spawnGolem(i, near) {
    const r = ROCKS[i], type = GIANT[r.tile].golem, d = MONSTER_DEFS[type];
    const who = near || player;
    let best = null;
    for (let y = r.y - 1; y <= r.y + r.size; y++) for (let x = r.x - 1; x <= r.x + r.size; x++) {
      if (x >= r.x && x < r.x + r.size && y >= r.y && y < r.y + r.size) continue;
      if (SOLID.has(tileAt(x, y))) continue;
      const dd = dist(tc(x), tc(y), who.x, who.y); if (!best || dd < best.d) best = { x, y, d: dd };
    }
    const at = best ? { x: tc(best.x), y: tc(best.y) } : rockCentre(r);
    const s = safeSpot(at.x, at.y, d.r, 'beast') || at;
    const m = makeMon(type, s.x, s.y); m.royalRock = i; m.emergeT = N.WAKE_ANIM; m.attackCd = N.WAKE_ANIM + 0.3; m.state = 'idle';
    monsters.push(m); golemOf[i] = m;
    return m;
  }
  function wake(i, near) {
    const r = ROCKS[i], g = GIANT[r.tile], c = rockCentre(r);
    wakes.push({ i, t: 0 });
    if (window.IMPACT) IMPACT.wave(c.x, c.y, 1.2, 'royal-wake-' + i);
    floatText(c.x, c.y - r.size * 24 - 8, g.wakes, '#ff9a4a', 22);
    burst(c.x, c.y, '#8f887a', 24, 150); burst(c.x, c.y, '#ff7a3a', 10, 90); sfx('boom');
    const q = R(); if (!q.seenWake) { q.seenWake = true; say2('Golems are ore with a heart. Beat it, and the ore it was made of is yours.'); save(); }
    if (mayScript() && !golemAlive(i)) return spawnGolem(i, near);
    return null;
  }
  // a landed crack on a giant rock: the ore, or a golem (the core's roll, the core's swing timer)
  function crackGiant(a, t) {
    player.action = null;
    const i = rockIndexAt(a.tx, a.ty); if (i < 0) return;
    const r = ROCKS[i], g = GIANT[t], G = GATHER[t], c = rockCentre(r);
    let chance = Math.min(0.9, 0.35 + (skillLv('mining') - G.lv) * 0.02 + a.tier * 0.1);
    if (hasHeartPick() && inside()) chance = Math.min(0.97, chance + 0.15);
    burst(tc(a.tx), tc(a.ty), r.kind === 'storm' ? '#b8a0ff' : '#bcd4f5', 6, 60);
    if (Math.random() > chance) { player.action = { ...a, t: 0 }; return; }
    if (restless(i, now())) { wake(i, player); return; }
    for (const [id, n] of g.pay) giveOrDrop(id, n, player.x, player.y);
    gainXp('mining', g.xp); sfx('chop');
    for (let k = 0; k < 3; k++) burst(c.x + rint(-20, 20), c.y + rint(-20, 20), r.kind === 'storm' ? '#9a86e0' : '#8fb0e0', 8, 110);
    const q = R(); if (!q.seenGiant) { q.seenGiant = true; say2('A giant rock. It has soaked up so much heartstone that sometimes it wakes up. Crack it and see what you get.'); }
    rockStage[i] = (rockStage[i] || 0) + 1;
    if (rockStage[i] >= g.cracks) {
      rockStage[i] = 0;
      for (let y = r.y; y < r.y + r.size; y++) for (let x = r.x; x < r.x + r.size; x++) { changeTile(x, y, T.RUBBLE); regrow.push({ i: idx(x, y), t, timer: g.regrow }); }
      notify('The giant rock is rubble. It will grow back.');
      burst(c.x, c.y, '#8f887a', 30, 160); if (window.IMPACT) IMPACT.wave(c.x, c.y, 0.9, 'royal-rubble-' + i);
    } else player.action = { ...a, t: 0 };
    save();
  }
  const _finishGather = finishGather;
  finishGather = function () {
    const a = player.action, t = a ? tileAt(a.tx, a.ty) : -1;
    if (t !== GIANT_MITHRIL && t !== GIANT_STORM) return _finishGather();
    crackGiant(a, t);
  };
  finishGather.__inner = _finishGather;
  // a tap on the middle of a giant rock walks to the side of it that can be reached
  const openBeside = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inMap(x + dx, y + dy) && !SOLID.has(tileAt(x + dx, y + dy)));
  const _tapPathTo = tapPathTo;
  tapPathTo = function (tx, ty, adjacent) {
    const t = tileAt(tx, ty);
    if ((t === GIANT_MITHRIL || t === GIANT_STORM) && !openBeside(tx, ty)) {
      const i = rockIndexAt(tx, ty);
      if (i >= 0) {
        const r = ROCKS[i]; let best = null;
        for (let y = r.y; y < r.y + r.size; y++) for (let x = r.x; x < r.x + r.size; x++) if (openBeside(x, y)) { const d = dist(tc(x), tc(y), player.x, player.y); if (!best || d < best.d) best = { x, y, d }; }
        if (best) return _tapPathTo(best.x, best.y, adjacent);
      }
    }
    return _tapPathTo(tx, ty, adjacent);
  };
  tapPathTo.__inner = _tapPathTo;

  // ---------- the veins, the forge, the throw ----------
  const veinAt = (tx, ty) => VEINS.findIndex(([x, y]) => x === tx && y === ty);
  const veinKey = (win, v) => win + ':' + v;
  const veinTaken = (v, t) => vein.taken[veinKey(Math.floor(t / N.VEIN_WINDOW), v)] || 0;
  const isLit = (v, t) => litVeins(t).includes(v);
  const mineLv = () => kid() ? N.KID_LV : N.VEIN_LV, warmLv = () => kid() ? N.KID_LV : N.WARM_LV;
  const carried = () => arms.raw + arms.warm;
  function startVein(tx, ty) {
    const v = veinAt(tx, ty); if (v < 0) return;
    const t = now();
    if (!hasTool('pickaxe')) { notify('You need a pickaxe to cut heartstone.'); return; }
    if (skillLv('mining') < mineLv()) { notify(`You need Mining level ${mineLv()} to cut heartstone.`); return; }
    if (!isLit(v, t)) { notify('This vein has gone dark. Find the one that is glowing.'); return; }
    if (veinTaken(v, t) >= N.VEIN_TAKE) { notify('You have taken all this vein will give you. The glow will move soon.'); return; }
    if (carried() >= N.ARMS) { notify('Your arms are full. Warm your stones and throw them.'); return; }
    const tier = hasTool('pickaxe');
    player.action = { type: 'heartvein', tx, ty, v, t: 0, need: hasHeartPick() ? N.HEART_PICK_SWING : Math.max(0.7, 1.6 - 0.25 * tier), tier };
  }
  function finishVein(a) {
    player.action = null;
    const t = now(), v = a.v;
    if (!isLit(v, t)) { notify('This vein has gone dark. Find the one that is glowing.'); return; }
    const key = veinKey(Math.floor(t / N.VEIN_WINDOW), v);
    if ((vein.taken[key] || 0) >= N.VEIN_TAKE) { notify('You have taken all this vein will give you. The glow will move soon.'); return; }
    if (carried() >= N.ARMS) { notify('Your arms are full. Warm your stones and throw them.'); return; }
    vein.taken[key] = (vein.taken[key] || 0) + 1; arms.raw++;
    gainXp('mining', N.VEIN_XP); sfx('chop');
    burst(tc(a.tx), tc(a.ty), '#ff7a4a', 10, 80); burst(tc(a.tx), tc(a.ty), '#ffd08a', 5, 50);
    floatText(player.x, player.y - 44, '+1 heartstone', '#ff9a6a', 13);
    if (vein.taken[key] < N.VEIN_TAKE && carried() < N.ARMS) player.action = { ...a, t: 0 };
  }
  function startWarm(tx, ty) {
    if (arms.raw <= 0) { notify('The heart forge is hot. Bring it a raw heartstone from a glowing vein.'); return; }
    if (skillLv('smithing') < warmLv()) { notify(`You need Smithing level ${warmLv()} to warm a heartstone.`); return; }
    player.action = { type: 'heartwarm', tx, ty, t: 0, need: N.WARM_TIME };
  }
  function finishWarm(a) {
    player.action = null;
    if (arms.raw <= 0) return;
    arms.raw--; arms.warm++; gainXp('smithing', N.WARM_XP);
    floatText(player.x, player.y - 44, 'Warmed!', '#ffb050', 15); burst(tc(a.tx), tc(a.ty) - 10, '#ffb050', 12, 90); sfx('anvil');
    if (arms.raw > 0) player.action = { ...a, t: 0 };
  }
  function throwStone() {
    if (!inside() || player.dead) return false;
    if (arms.warm <= 0) { notify('You have no warm heartstones. Mine a vein, then warm it at the forge.'); return false; }
    const gm = gorm();
    if (!gm || gm.dead || gm.gone) return false;
    if (dist(player.x, player.y, gm.x, gm.y) > N.THROW_RANGE * TILE) { notify('Too far. Get closer to Gorm.'); return false; }
    if (fight.throwCd > 0) return false;
    arms.warm--; fight.throwCd = N.THROW_CD;
    { const dx = gm.x - player.x, dy = gm.y - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
    player.attackT = 0.22; player.action = null;
    const base = rint(N.THROW_MIN, N.THROW_MAX), dmg = kid() ? Math.round(base * N.KID_THROW) : base;
    stones.push({ x0: player.x, y0: player.y - 30, t: 0, dmg, m: gm });
    sfx('swing');
    return true;
  }
  function landStone(s) {
    const m = monsters.includes(s.m) ? s.m : gorm();
    const tx = m ? m.x : s.x0, ty = m ? m.y - 50 : s.y0;
    burst(tx, ty, '#ff6a2a', 18, 140); burst(tx, ty, '#ffd08a', 10, 90);
    if (!m || m.dead || m.gone) return;
    // counted before the hit lands: the stone that fells him is part of the share his fall pays out
    fight.landed++; fight.hitFlashT = time; fight.lastThrowDmg = s.dmg;
    hitMonster(m, s.dmg, 0, true, 'stone');
    floatText(m.x, m.y - 120, 'CRACK!', '#ffb050', 20);
    if (window.IMPACT) IMPACT.wave(m.x, m.y, 1.0, 'royal-stone');
  }
  // a sword, an arrow, a bomb or a friend's blade on Gorm: stone on stone, and nothing reaches him
  function clang(m, source) {
    floatText(m.x + rint(-12, 12), m.y - 70, 'CLANG', '#dfe6ee', 16); burst(m.x, m.y - 30, '#ffe9a8', 8, 120); sfx('anvil');
    if ((source === undefined || source === 'player') && time - fight.clangNoteT > 4) { fight.clangNoteT = time; notify('Your sword bounces off. Only a warm heartstone can hurt Gorm.'); }
  }
  function crumble() {
    if (!carried()) return;
    arms.raw = 0; arms.warm = 0;
    notify('Your heartstones cool and crumble to red dust. They only stay warm in Gorm\'s hall.');
    if (!player.dead) burst(player.x, player.y - 30, '#a0402a', 14, 70);
  }

  // ---------- the little golems (keeper only) ----------
  function spawnGolemling(k) {
    const [bx, by] = BURROWS[((k | 0) % 4 + 4) % 4];
    const m = makeMon('golemling', tc(bx), tc(by)); m.state = 'idle'; m.wanderT = 99;
    monsters.push(m);
    burst(m.x, m.y, '#8f887a', 12, 80); burst(m.x, m.y, '#8fe07a', 5, 50);
    return m;
  }
  function mend(gm, m) {
    const amt = kid() ? N.KID_MEND : N.MEND;
    gm.hp = Math.min(gm.maxHp, gm.hp + amt);
    const i = monsters.indexOf(m); if (i >= 0) monsters.splice(i, 1);
    mendSeen(gm, amt);
  }
  function mendSeen(gm, amt) {
    floatText(gm.x, gm.y - 116, `+${amt} MENDED`, '#9be27a', 18); burst(gm.x, gm.y - 40, '#9be27a', 16, 90);
    fight.mendFlashT = time;
    if (time - fight.mendNoteT > 8) { fight.mendNoteT = time; notify('A little golem reached Gorm and mended him. Smash them first!'); }
  }

  // ---------- the fall, the payout, the ending ----------
  const itemWords = (id, q) => { const n = ITEMS[id].name.toLowerCase(); return `${q} ${q > 1 && /(bar|pickaxe)$/.test(n) ? n + 's' : n}`; };
  function payout() {
    const q = R();
    // xp first: a level-up banner must not paint over the RARE DROP banner rollDrops raises
    gainXp('mining', N.PAYOUT_XP); gainXp('smithing', N.PAYOUT_XP);
    const before = drops.length;
    rollDrops({ drops: HOARD }, player.x, player.y);
    const got = drops.slice(before).map(d => ({ id: d.id, qty: d.qty }));
    q.payouts = (q.payouts || 0) + 1;
    const banked = (player.bank || []).filter(s => s && s.id === 'heartstone_pickaxe').reduce((s, b) => s + b.qty, 0);
    let pick = got.some(d => d.id === 'heartstone_pickaxe');
    if (!pick && q.payouts >= N.PITY && countItem('heartstone_pickaxe') + banked === 0 && !Object.values(player.equip || {}).includes('heartstone_pickaxe')) {
      drops.push({ x: player.x + rint(-10, 10), y: player.y + rint(-10, 10), id: 'heartstone_pickaxe', qty: 1, t: 0, rare: true });
      levelBanner = { text: 'RARE DROP', sub: ITEMS.heartstone_pickaxe.name, t: 3 }; burst(player.x, player.y, '#f5c542', 30, 160);
      got.push({ id: 'heartstone_pickaxe', qty: 1 }); pick = true;
    }
    if (pick) say2('A pickaxe with a heartstone for a head. It is warm, and it hums when a giant rock is about to wake.');
    const order = got.filter(d => d.id === 'coins').concat(got.filter(d => d.id !== 'coins' && d.id !== 'coal')).concat(got.filter(d => d.id === 'coal'));
    fight.lastPayout = got;
    notify("Gorm's rubble: " + order.map(d => itemWords(d.id, d.qty)).join(', ') + '.');
    return got;
  }
  const noteQ = [], bannerQ = [];
  function onFall() {
    if (fight.fallSeen) return;
    fight.fallSeen = true; fight.downAt = time; fight.knocks = 0;
    const q = R(), secs = fight.lifeStart != null ? time - fight.lifeStart : null;
    q.falls = (q.falls || 0) + 1;
    if (secs != null && secs >= 1 && (!q.best || secs < q.best)) q.best = Math.round(secs);
    if (inside()) {
      const gm = gorm(); if (gm) { burst(gm.x, gm.y - 40, '#8f887a', 40, 180); burst(gm.x, gm.y - 60, '#ff6a2a', 20, 120); if (window.IMPACT) IMPACT.wave(gm.x, gm.y, 2.2, 'royal-fall'); }
      sfx('boss');
    }
    const helped = fight.landed >= 1 || fight.smashed >= 3, b0 = levelBanner;
    if (helped && !fight.paid) { fight.paid = true; payout(); }
    else if (!helped) notify('You did not help this time. Throw a stone or smash three little golems to earn a share.');
    // the fall is the headline; a RARE DROP or a level-up from the payout follows it a moment later instead of being lost
    if (levelBanner && levelBanner !== b0) bannerQ.push({ at: time + 2.6, b: { ...levelBanner, t: 3.2 } });
    levelBanner = q.stage === 6 ? { text: 'GORM FALLS', sub: 'Knock three times to call him home.', t: 5 } : { text: 'GORM SLEEPS', sub: 'He will wake again soon.', t: 4 };
    if (secs != null) noteQ.push({ at: time + 3, text: `Put to sleep in ${mmss(secs)} · best ${q.best ? mmss(q.best) : mmss(secs)}` });
    fight.landed = 0; fight.smashed = 0; fight.lifeStart = null; fight.halfSaid = false;
    save();
  }
  function completeQuest() {
    const q = R(); if (q.stage >= 7) return;
    gainXp('mining', N.QUEST_XP); gainXp('smithing', N.QUEST_XP); giveOrDrop('coins', N.QUEST_COINS, player.x, player.y);
    q.stage = 7; levelBanner = { text: 'QUEST COMPLETE', sub: "The King's Knock", t: 4.5 }; sfx('quest');
    burst(tc(32), tc(8), '#f5c542', 20, 100);
    save();
  }
  const knockReady = () => inside() && R().stage === 6 && fight.fallSeen && !gormUp() && !ending.on && !player.dead && dist(player.x, player.y, tc(GORM_HOME[0]), tc(GORM_HOME[1])) <= 6 * TILE;
  function knock() {
    if (!knockReady()) return false;
    fight.knocks++;
    knockRings.push({ x: player.x, y: player.y - 18, t: 0 });
    floatText(player.x, player.y - 46, 'knock', '#f5c542', 16); sfx('boom');
    if (fight.knocks >= 3) startEnding();
    return true;
  }
  function startEnding() {
    ending.on = true;
    cineSay('Gorm', 'Knock... knock... knock.');
    cineSay('The Voice', 'Three knocks, like the old rule. Gorm\'s eyes open, soft as embers.');
    cineSay('Gorm', 'King... calls... Gorm... home?');
    cineAct(() => { ending.thrain = { x: tc(27), y: tc(32) + 12, tx: tc(27), ty: tc(35), a: 0, out: false, walkT: 0 }; });
    cineSay(THRAIN, 'I do, old friend. I am sorry it took me a hundred years. Rest now.');
    cineSay('Gorm', 'Gorm... rests.');
    cineAct(completeQuest);
    cineSay(THRAIN, 'Thank you, knight. The royal mine is open again. Come and dig whenever you like.');
    cineSay(THRAIN, 'Gorm will wake again when the mountain\'s heart beats. He likes a game. Bring your friends.');
    cineAct(() => { if (ending.thrain) { ending.thrain.out = true; ending.thrain.tx = tc(27); ending.thrain.ty = tc(32) + 12; } ending.on = false; });
  }

  // =========================================================================
  // 12. USE (E, and a tap, which walks up and presses E)
  // =========================================================================
  // first in line: a pebble thief in front of you, and the throne once it has moved (24-dwarves answers for it otherwise)
  HOOKS.use.unshift((t, tx, ty) => {
    if (inDeep() && R().stage === 3 && !player.mech) { const th = thiefInFront(N.THIEF_E); if (th) { catchThief(th, 'use'); return true; } }
    if (inDeep() && t === DW_THRONE && slid()) { notify("King Thrain's old throne. He stands beside it now."); return true; }
    return false;
  });
  const PEOPLE = [
    { id: 'bram', name: 'Bram', x: 12, y: 15, tunic: '#5a6a3a', hair: '#8a5a2a', helm: '#8f96a3', lines: ['The golden lamps are lit again. My grandad would weep.', 'A giant rock that shakes is a golem getting up. Hit it then and out it comes.', "Heartstone only stays warm in Gorm's hall. Don't try to take it home. Everyone tries."] },
    { id: 'sigrun', name: 'Sigrun', x: 42, y: 15, tunic: '#6a3a5a', hair: '#e0c080', woman: true, lines: ['The king walked down the stair today. On his own two feet!', 'Giant stormstone needs Mining thirty. Giant mithril needs twenty-two.', "The glow in Gorm's hall moves every twenty seconds. Watch the walls."] },
  ];
  for (const p of PEOPLE) { p.px = tc(p.x); p.py = tc(p.y); p.facing = { x: 0, y: 1 }; }
  const peopleHere = () => inside() && R().stage >= 7;
  const talkPerson = p => { const dx = p.px - player.x, dy = p.py - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; say2(pick(p.lines), p.name); };
  function personInFront() {
    if (!peopleHere()) return null;
    let best = null;
    for (const p of PEOPLE) { const d = dist(player.x, player.y, p.px, p.py); if (d > 80) continue; const dot = ((p.px - player.x) * player.facing.x + (p.py - player.y) * player.facing.y) / (d || 1); if (dot < 0.2 && d > 30) continue; if (!best || d < best.d) best = { p, d }; }
    return best ? best.p : null;
  }
  if (typeof TAP_PEOPLE !== 'undefined') {
    TAP_PEOPLE.push(() => peopleHere() ? PEOPLE.map(p => ({ x: p.px, y: p.py, r: 13, id: p.id, name: p.name, talk: () => talkPerson(p) })) : []);
    TAP_PEOPLE.push(() => inside() && ending.thrain && ending.thrain.a > 0.5 ? [{ x: ending.thrain.x, y: ending.thrain.y, r: 13, id: 'thrain_end', name: THRAIN, talk: () => {} }] : []);
  }
  function rideDown() {
    if (!window.UNDERGROUND) return false;
    riding = true;
    const ok = UNDERGROUND.rideFrom(RM_ID, STAIR_STAND);
    riding = false;
    if (ok) notify('You go down the Stair of Kings.');
    return ok;
  }
  function climbUp() {
    INSTANCES.leave();
    notify('You climb the Stair of Kings back to the throne hall.');
    // without a ride to come back from (the stair was not how you came), walk the knight up the stair all the same
    if (!(window.UNDERGROUND && UNDERGROUND.hop) && DH && INSTANCES.enter(DH.ID, DH.SHAFT_STEP)) { player.x = tc(STAIR_STAND[0]); player.y = tc(STAIR_STAND[1]); player.facing = { x: 0, y: -1 }; }
    save();
  }
  function useDoor() {
    const q = R();
    if (doorAnim) return;
    const guestHere = guest || remotesOn(RM_ID).length > 0;
    if (countItem('crownheart') > 0) { doorAnim = { t: 0, keep: true }; if (q.stage === 5) say2('The crownheart glows in your hand. The door grinds open.'); }
    else if (guestHere) { doorAnim = { t: 0, keep: false }; notify('Your friend has been this way. The door knows. It grinds open.'); }
    else { notify('A round door of red stone, with a heart-shaped hole in the middle. It will not move.'); return; }
    if (window.IMPACT) IMPACT.wave(tc(27), tc(33), 1.0, 'royal-door');
    sfx('open'); burst(tc(27), tc(33), '#a04030', 16, 80);
  }
  function openDoorNow(keep) {
    for (const [x, y] of DOOR) setLive(x, y, T.COBBLE);
    if (keep) { const q = R(); q.door = true; if (q.stage === 5) setStage(6); }
    burst(tc(27), tc(33), '#8f887a', 24, 120);
    save();
  }
  function applyDoor() { if (!inside()) return; if (R().door) for (const [x, y] of DOOR) setLive(x, y, T.COBBLE); }
  HOOKS.use.push((t, tx, ty) => {
    if (inside()) { const p = personInFront(); if (p) { talkPerson(p); return true; } }
    if (t === ROYAL_STAIR) {
      if (inside()) { climbUp(); return true; }
      if (inDeep()) { if (!rideDown()) notify('The stair is dark. You cannot go down right now.'); return true; }
      return true;
    }
    if (!inside()) return false;
    if (knockReady() && dist(player.x, player.y, tc(GORM_HOME[0]), tc(GORM_HOME[1])) <= 3 * TILE) { knock(); return true; }
    if (t === ROYAL_STATUE) { const s = STATUES.find(o => o.x === tx && o.y === ty); if (s) say2(R().stage >= 7 && s.after ? s.after : s.text, 'The plaque'); return true; }
    if (t === HEART_DOOR) { useDoor(); return true; }
    if (t === HEART_FORGE) { startWarm(tx, ty); return true; }
    if (t === HEART_VEIN) { startVein(tx, ty); return true; }
    return false;
  });

  // =========================================================================
  // 13. THE WRAPPERS (each explicit, each keeps __inner)
  // =========================================================================
  // hitMonster: outermost, after 75-coop. Filter at the sender, trust 'remote' at the keeper.
  const _hitMonster = hitMonster;
  hitMonster = function (m, dmg, knock, fromBomb, source) {
    if (m && m.type === 'gorm') {
      if (source === 'remote') { if (!fromBomb) return; return _hitMonster(m, dmg, knock, fromBomb, source); }
      if (source === 'stone') { if (!m.remote) m.lastHitBy = null; return _hitMonster(m, dmg, 0, true, 'stone'); }
      clang(m, source);
      return;
    }
    return _hitMonster(m, dmg, knock, fromBomb, source);
  };
  hitMonster.__inner = _hitMonster;
  // playerAttack: a swing catches a pebble thief in Deepholm, and throws a warm stone at Gorm in his hall
  const lingInReach = () => monsters.some(m => m.type === 'golemling' && !m.dead && !m.gone && dist(player.x, player.y, m.x, m.y) < 64 && ((m.x - player.x) * player.facing.x + (m.y - player.y) * player.facing.y) > 0);
  const _playerAttack = playerAttack;
  playerAttack = function () {
    if (player.dead) return _playerAttack();
    if (inDeep() && R().stage === 3 && player.attackCd <= 0) {
      const th = thiefInFront(N.THIEF_REACH);
      if (th) { player.attackT = 0.22; player.attackCd = 0.45; sfx('swing'); catchThief(th, 'swing'); return; }
    }
    if (inside() && arms.warm > 0 && !lingInReach()) {
      const gm = gorm();
      if (gm && !gm.dead && !gm.gone) {
        const dx = gm.x - player.x, dy = gm.y - player.y, d = Math.hypot(dx, dy) || 1;
        if ((dx * player.facing.x + dy * player.facing.y) / d > 0.3 && d <= N.THROW_RANGE * TILE) { throwStone(); return; }
      }
    }
    return _playerAttack();
  };
  playerAttack.__inner = _playerAttack;
  // Gorm on screen: a finger anywhere on his body. With a warm stone it throws; without one it swings (and clangs)
  function gormScreenHit(sx, sy) {
    const gm = gorm(); if (!gm || gm.dead || gm.gone || !inside()) return null;
    const wx = sx + cam.x, wy = sy + cam.y;
    return (Math.abs(wx - gm.x) <= 62 && wy >= gm.y - 116 && wy <= gm.y + 50) ? gm : null;
  }
  const _tapAt = tapAt;
  tapAt = function (sx, sy) {
    if (!player.dead && !paused && !(typeof title !== 'undefined' && title.active)) {
      const gm = gormScreenHit(sx, sy);
      if (gm && arms.warm > 0 && dist(player.x, player.y, gm.x, gm.y) <= N.THROW_RANGE * TILE) { throwStone(); return true; }
      if (gm) return _tapAt(gm.x - cam.x, gm.y - cam.y);
    }
    return _tapAt(sx, sy);
  };
  tapAt.__inner = _tapAt;
  // render: the ore rocks and rubble keep the mine's floor under them instead of a square of grass
  const SWAP = [T.COAL, T.IRON, T_SUN, T_STORM, T.RUBBLE].filter((t, i, a) => a.indexOf(t) === i);
  const _render = render;
  render = function () {
    if (window.__instance !== RM_ID) return _render();
    const keep = SWAP.map(t => TEX_NAME[t]);
    for (const t of SWAP) TEX_NAME[t] = 'cave';
    try { return _render(); } finally { for (let i = 0; i < SWAP.length; i++) TEX_NAME[SWAP[i]] = keep[i]; }
  };
  render.__inner = _render;
  // load: a save never describes an instance, so the throne comes back closed with everything else
  const _load = load;
  load = function () { const r = _load(); closeAll(); arms.raw = 0; arms.warm = 0; syncEdge(); return r; };
  load.__inner = _load;
  // INSTANCES.enter / leave: the throne and the door are set the moment you arrive, not a frame later
  let lastInst = null;
  function syncEdge() {
    const cur = window.INSTANCES ? INSTANCES.active() : null;
    if (cur === lastInst) return;
    const was = lastInst; lastInst = cur;
    if (was) onLeave(was);
    if (cur) onEnter(cur);
  }
  if (window.INSTANCES) {
    const _enter = INSTANCES.enter, _leave = INSTANCES.leave;
    INSTANCES.enter = function (id, step) { const ok = _enter(id, step); syncEdge(); return ok; };
    INSTANCES.leave = function () { const ok = _leave(); syncEdge(); return ok; };
    INSTANCES.enter.__inner = _enter; INSTANCES.leave.__inner = _leave;
  }
  function onEnter(id) {
    if (DH && id === DH.ID) {
      applyThrone();
      const q = R();
      let knocked = false;
      if (dq().stage >= 2 && q.stage === 0) {
        setStage(1);
        say2('The floor of Deepholm shakes. Dust falls from the roof.');
        say2('Under your boots, something knocks. Knock, knock, knock. Then quiet. Then three more.');
        tremor(); knocked = true;
      }
      // the knocking comes again every 25 s while the quest is still in Deepholm; a knight coming back in hears it soon
      TH.tremorT = knocked ? N.TREMOR_EVERY : 3;
      clearThieves();
      if (q.stage === 3) { TH.due.push(time + 1, time + 5); }
    }
    if (id === RM_ID) {
      applyDoor(); doorAnim = null;
      arms.raw = 0; arms.warm = 0; stones.length = 0; wakes.length = 0; knockRings.length = 0;
      Object.assign(fight, { landed: 0, smashed: 0, fallSeen: false, paid: false, downAt: null, lifeStart: null, lastHp: null, lastMax: null, lastDown: false, inHall: false, knocks: 0, halfSaid: false, stirred: {} });
      Object.assign(K, { lingT: 0, burrow: 0, emptyT: 0, downT: 0, remoteMine: {} });
      rocks.win = null; rocks.list = []; rocks.landed = true; rocks.debris = [];
      for (const k in golemOf) delete golemOf[k];
      ending.on = false; ending.thrain = null;
    }
  }
  function onLeave(id) {
    if (DH && id === DH.ID) {
      // a speech in progress keeps going wherever you walk (Thrain calls after you down the stair); only the slide is finished now
      if (slide.on) finishSlide();
      clearThieves();
      const th = thrain(); if (th) { th.px = tc(DH.THRONE.x); th.py = tc(DH.THRONE.y); }
      if (!riding) guest = false;
    }
    if (id === RM_ID) {
      crumble(); stones.length = 0; doorAnim = null; ending.thrain = null;
    }
  }

  // =========================================================================
  // 14. EVERY TICK
  // =========================================================================
  function deepTick(dt) {
    const q = R();
    if (q.stage >= 1 && q.stage <= 4) { TH.tremorT -= dt; if (TH.tremorT <= 0) { TH.tremorT = N.TREMOR_EVERY; tremor(); } }
    if (q.stage === 3) stepThieves(dt); else if (TH.list.length || TH.due.length) clearThieves();
    if (slide.on) {
      slide.t += dt;
      const th = thrain(), k = clamp(slide.t / 0.8, 0, 1);
      if (th) { th.px = lerp(tc(14), tc(11), k * k * (3 - 2 * k)); th.py = tc(23); }
      if (Math.floor(slide.t * 9) !== Math.floor((slide.t - dt) * 9)) { const x = tc(slide.x()) - 22; for (let j = 0; j < 4; j++) particles.push({ x: x + rint(-6, 6), y: tc(23) + rint(4, 18), vx: rint(-30, -5), vy: rint(-30, 5), t: 0.5 + Math.random() * 0.4, color: j % 2 ? '#9a927f' : '#c8bda4', r: 2 + Math.random() * 2 }); }
      if (slide.t >= N.SLIDE) finishSlide();
    }
  }
  function keeperTick(dt) {
    // golems and little golems never respawn: once they have lain there a moment they are gone
    if (monsters.some(m => SPAWNED.has(m.type) && m.dead && m.deadT > 1.5)) monsters = monsters.filter(m => !(SPAWNED.has(m.type) && m.dead && m.deadT > 1.5));
    for (const k in golemOf) { const g = golemOf[k]; if (!g || !monsters.includes(g) || g.dead) { if (g) quietUntil[k] = time + N.RESTLESS_QUIET; delete golemOf[k]; } }
    const gm = monsters.find(m => m.type === 'gorm' && !m.remote);
    if (gm) {
      const n = knightsInHall();
      if (!gm.dead) { gm.x = gm.home.x; gm.y = gm.home.y; }
      if (n === 0) { K.emptyT += dt; if (K.emptyT >= N.EMPTY_HEAL && !gm.dead && gm.hp < gm.maxHp) gm.hp = gm.maxHp; } else K.emptyT = 0;
      if (!gm.dead && gm.hp >= gm.maxHp) { const want = N.GORM_HP + N.GORM_PER_KNIGHT * (clamp(n, 1, N.GORM_KNIGHTS_MAX) - 1); if (gm.maxHp !== want) { gm.maxHp = want; gm.hp = want; } }
      if (gm.dead) {
        K.downT += dt;
        if (K.downT >= N.REFORM && !ending.on) {
          gm.dead = false; gm.hp = gm.maxHp; gm.state = 'idle'; gm.deadT = 0; gm.x = gm.home.x; gm.y = gm.home.y; gm.attackCd = 1.5; gm.lastHitBy = null; K.downT = 0;
          burst(gm.x, gm.y - 40, '#ff6a2a', 30, 160); burst(gm.x, gm.y, '#8f887a', 30, 140);
        }
      } else K.downT = 0;
      // the little golems crawl out of the rubble in turn and walk to him
      const lings = monsters.filter(m => m.type === 'golemling' && !m.dead && !m.remote);
      if (!gm.dead && n > 0 && !TEST.noLings) {
        const i2 = n >= 2 ? 1 : 0, every = gm.hp < gm.maxHp * 0.5 ? N.LING_EVERY_HALF[i2] : N.LING_EVERY[i2];
        K.lingT += dt;
        if (K.lingT >= every) { if (lings.length < N.LING_MAX) { K.lingT = 0; lings.push(spawnGolemling(K.burrow++)); } else K.lingT = every; }
      } else K.lingT = 0;
      for (const m of lings) {
        if (gm.dead) { m.moving = false; continue; }
        m.state = 'idle'; m.wanderT = 99; m.wander = { x: 0, y: 0 };
        const dx = gm.x - m.x, dy = gm.y - m.y, d = Math.hypot(dx, dy) || 1;
        if (d < gm.r + 14) { mend(gm, m); continue; }
        const st = N.LING_SPEED * dt;
        moveEntity(m, dx / d * st, dy / d * st, 'beast');
        m.facing = { x: dx / d, y: dy / d }; m.moving = true; m.walkT += dt * 8;
      }
    }
    // a friend mining a restless giant rock wakes it here, where the monsters live
    const seen = {};
    for (const k of remotesOn(RM_ID)) {
      seen[k.n] = true;
      let i = -1; if (k.act === 'mine' && !k.dead) for (const r of ROCKS) if (rockIntact(r.i) && rectDistTiles(r, k.x, k.y) <= N.REMOTE_REACH) { i = r.i; break; }
      if (i < 0) { delete K.remoteMine[k.n]; continue; }
      const e = K.remoteMine[k.n] && K.remoteMine[k.n].i === i ? K.remoteMine[k.n] : (K.remoteMine[k.n] = { i, t: 0 });
      e.t += dt;
      if (e.t >= N.REMOTE_MINE && restless(i, now()) && !golemAlive(i)) { e.t = -1e9; wake(i, { x: k.x, y: k.y }); }
    }
    for (const n in K.remoteMine) if (!seen[n]) delete K.remoteMine[n];
  }
  function mineTick(dt) {
    fight.throwCd = Math.max(0, fight.throwCd - dt);
    const a = player.action;
    if (a && a.type === 'heartvein' && a.t >= a.need) finishVein(a);
    else if (a && a.type === 'heartwarm' && a.t >= a.need) finishWarm(a);
    if (pressed.has('KeyZ') && !player.dead) throwStone();
    // the hall itself: the first step, and your stones crumbling if you leave it or fall
    const inH = !player.dead && inHallPx(player.x, player.y);
    if (inH && !fight.inHall) {
      const q = R();
      if (!q.seenHow) {
        q.seenHow = true; save();
        levelBanner = { text: 'GORM THE GINORMOUS', sub: 'Only a heartstone can crack a heartstone.', t: 4 }; fight.hallBannerT = time;
        say2('Gorm opens his eyes. They glow like a forge.');
        openPanel('royal_howto');
      } else if (time - fight.hallBannerT > 60) { fight.hallBannerT = time; levelBanner = { text: 'GORM THE GINORMOUS', sub: 'Only a heartstone can crack a heartstone.', t: 3 }; }
    }
    if (!inH && fight.inHall && carried()) crumble();
    if (player.dead && carried()) crumble();
    fight.inHall = inH;
    // stones in flight
    for (const s of stones.slice()) { s.t += dt; if (s.t >= N.THROW_FLIGHT) { stones.splice(stones.indexOf(s), 1); landStone(s); } }
    // Gorm: the life clock, the fall (seen on every client), the mend a puppet shows, halfway
    const gm = gorm();
    if (gm && !gm.gone) {
      const down = gm.dead || gm.hp <= 0;
      if (down) { gm.deadT = Math.max(gm.deadT || 0, 0.8); if (!fight.fallSeen) onFall(); }
      else {
        if (fight.fallSeen && gm.hp >= gm.maxHp) { fight.fallSeen = false; fight.paid = false; if (fight.downAt != null) floatText(gm.x, gm.y - 120, 'Gorm wakes again!', '#ffb050', 18); fight.downAt = null; fight.knocks = 0; }
        if (fight.lifeStart == null && inH && !fight.fallSeen) fight.lifeStart = time;
        if (!mayScript() && fight.lastHp != null && !fight.lastDown && gm.hp - fight.lastHp >= 20 && !(fight.lastHp >= fight.lastMax)) mendSeen(gm, Math.round(gm.hp - fight.lastHp));
        if (!fight.halfSaid && gm.hp < gm.maxHp * 0.5 && !fight.fallSeen) { fight.halfSaid = true; if (inH) levelBanner = { text: 'HE IS CRUMBLING', sub: 'The little golems are coming faster.', t: 3 }; }
      }
      fight.lastHp = gm.hp; fight.lastMax = gm.maxHp; fight.lastDown = down;
    }
    // the rocks that fall where the shadows are: the same four on every client, plus one where you stood
    stepRocks(dt);
    // the giant rocks: waking, restless, and growing back whole
    for (const w of wakes.slice()) { w.t += dt; if (w.t >= N.WAKE_ANIM) wakes.splice(wakes.indexOf(w), 1); }
    for (const m of monsters) if (m.emergeT > 0) m.emergeT = Math.max(0, m.emergeT - dt);
    const t = now();
    fight.dustT -= dt;
    for (const r of ROCKS) {
      if (!rockIntact(r.i)) {
        let grown = 0; for (let y = r.y; y < r.y + r.size; y++) for (let x = r.x; x < r.x + r.size; x++) if (tileAt(x, y) === r.tile) grown++;
        if (grown > 0) {
          const set = new Set();
          for (let y = r.y; y < r.y + r.size; y++) for (let x = r.x; x < r.x + r.size; x++) { set.add(idx(x, y)); if (tileAt(x, y) !== r.tile) changeTile(x, y, r.tile); }
          regrow = regrow.filter(e => !set.has(e.i)); rockStage[r.i] = 0;
        }
        continue;
      }
      if (!restless(r.i, t)) continue;
      const c = rockCentre(r), near = dist(player.x, player.y, c.x, c.y) < 9 * TILE;
      if (!near) continue;
      const key = r.i + ':' + Math.floor(t / N.RESTLESS_WINDOW);
      if (!fight.stirred[key]) { fight.stirred[key] = true; floatText(c.x, c.y - r.size * 24 - 6, 'It is stirring!', '#ff9a4a', 15); const q = R(); if (!q.seenRestless) { q.seenRestless = true; say2('That giant rock is shaking. A golem is waking inside it. Hit it now and the golem comes out. Wait, and it settles down.'); save(); } }
      if (fight.dustT <= 0) burst(c.x + rint(-r.size * 18, r.size * 18), (r.y + r.size) * TILE - 6, '#9a927f', 5, 40);
    }
    if (fight.dustT <= 0) fight.dustT = 0.45;
    // the Heart Door grinding open
    if (doorAnim) { doorAnim.t += dt; if (Math.random() < 0.3) burst(tc(27) + rint(-50, 50), tc(33) + 16, '#8f887a', 3, 40); if (doorAnim.t >= N.DOOR_OPEN) { const keep = doorAnim.keep; doorAnim = null; openDoorNow(keep); } }
    // keeper, or alone: everything that spawns or moves shared things
    if (mayScript()) keeperTick(dt);
    // the ending: King Thrain walks in, and out again
    const e = ending.thrain;
    if (e) {
      const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
      if (d > 1) { const st = Math.min(d, 70 * dt); e.x += dx / d * st; e.y += dy / d * st; e.walkT += dt * 8; e.moving = true; } else e.moving = false;
      e.a = e.out && d <= 1 ? Math.max(0, e.a - dt * 0.8) : Math.min(1, e.a + dt * 2);
      if (e.out && e.a <= 0) ending.thrain = null;
    }
    for (const k of knockRings.slice()) { k.t += dt; if (k.t > 1.2) knockRings.splice(knockRings.indexOf(k), 1); }
    for (const k in vein.taken) { const w = +k.split(':')[0]; if (w < Math.floor(t / N.VEIN_WINDOW) - 2) delete vein.taken[k]; }
  }
  function stepRocks(dt) {
    const t = now(), win = Math.floor(t / N.ROCK_WINDOW), age = (t - win * N.ROCK_WINDOW) / 1000, warn = kid() ? N.KID_ROCK_WARN : N.ROCK_WARN;
    const active = gormUp() && knightsInHall() > 0 && !TEST.noRocks && !window.__peace;
    if (win !== rocks.win) {
      rocks.win = win;
      const me = !player.dead && inHallPx(player.x, player.y) ? [{ x: player.x, y: player.y, you: true }] : [];
      rocks.list = active ? rocksAt(t).map(([x, y]) => ({ x: tc(x), y: tc(y) })).concat(me) : [];
      rocks.landed = age >= warn;
    }
    if (!active && rocks.list.length && !rocks.landed) { rocks.list = []; rocks.landed = true; }
    if (!rocks.landed && age >= warn) {
      rocks.landed = true;
      let hit = false;
      for (const r of rocks.list) {
        burst(r.x, r.y, '#8f887a', 12, 110); burst(r.x, r.y, '#5a554c', 6, 60);
        rocks.debris.push({ x: r.x, y: r.y, t: 0, v: rint(0, 2) });
        if (!hit && !player.dead && dist(player.x, player.y, r.x, r.y) < N.ROCK_R) {
          hit = true; const [lo, hi] = kid() ? N.KID_ROCK_DMG : N.ROCK_DMG; const dmg = rint(lo, hi); fight.lastRockDmg = dmg; hurtPlayer(dmg, r.x, r.y - 8, true);
        }
      }
      if (rocks.list.length) sfx('hit');
    }
    for (const d of rocks.debris.slice()) { d.t += dt; if (d.t > 1.4) rocks.debris.splice(rocks.debris.indexOf(d), 1); }
  }
  HOOKS.update.push(dt => {
    syncEdge();
    cineFeed();
    if (noteQ.length && time >= noteQ[0].at) notify(noteQ.shift().text);
    if (bannerQ.length && time >= bannerQ[0].at) levelBanner = bannerQ.shift().b;
    if (!window.INSTANCES) return;
    const cur = INSTANCES.active();
    if (DH && cur === DH.ID) deepTick(dt);
    else if (cur === RM_ID) mineTick(dt);
  });
  // who landed the killing blow: a little golem smashed counts toward your share; Gorm's fall is seen here too
  HOOKS.kill.push(m => {
    if (!m) return;
    if (m.type === 'golemling') fight.smashed++;
    else if (m.type === 'gorm') onFall();
    else if ((m.type === 'rock_golem' || m.type === 'boulder_golem') && m.royalRock !== undefined) quietUntil[m.royalRock] = time + N.RESTLESS_QUIET;
  });
  function royalReset() {
    quest.royal = { stage: 0, caught: 0, door: false, falls: 0, best: 0, payouts: 0, seenHow: false, seenRestless: false, seenWake: false, seenGiant: false };
    closeAll(); arms.raw = 0; arms.warm = 0; stones.length = 0; wakes.length = 0; knockRings.length = 0; noteQ.length = 0; bannerQ.length = 0; doorAnim = null;
    for (const k in golemOf) delete golemOf[k]; for (const k in quietUntil) delete quietUntil[k]; for (const k in rockStage) delete rockStage[k];
    for (const k in vein.taken) delete vein.taken[k];
    Object.assign(fight, { landed: 0, smashed: 0, fallSeen: false, paid: false, downAt: null, lifeStart: null, lastHp: null, lastMax: null, lastDown: false, inHall: false, knocks: 0, halfSaid: false, stirred: {} });
    ending.on = false; ending.thrain = null; lastInst = window.INSTANCES ? INSTANCES.active() : null;
  }
  HOOKS.newGame.push(royalReset);

  // =========================================================================
  // 15. THE ART
  // =========================================================================
  const GOLD = '#e8b84a', GOLD_L = '#f7dc8a', GOLD_D = '#8a6418', HEART = '#e0402a', HEART_L = '#ffb070';
  const vis = pad => ({ x0: Math.max(0, Math.floor(cam.x / TILE) - pad), x1: Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + pad), y0: Math.max(0, Math.floor(cam.y / TILE) - pad), y1: Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + pad) });
  const hh = (a, b, c) => h32(a * 131 + b, c * 977 + 7);          // a stable 0..1 per tile, for scattering details
  const ease = k => k * k * (3 - 2 * k);
  function heartPath(g, cx, cy, s) {
    g.beginPath(); g.moveTo(cx, cy + 9 * s);
    g.bezierCurveTo(cx - 11 * s, cy + 1 * s, cx - 9 * s, cy - 8 * s, cx - 4 * s, cy - 7.4 * s);
    g.bezierCurveTo(cx - 1.6 * s, cy - 7 * s, cx, cy - 5 * s, cx, cy - 3.6 * s);
    g.bezierCurveTo(cx, cy - 5 * s, cx + 1.6 * s, cy - 7 * s, cx + 4 * s, cy - 7.4 * s);
    g.bezierCurveTo(cx + 9 * s, cy - 8 * s, cx + 11 * s, cy + 1 * s, cx, cy + 9 * s); g.closePath();
  }
  const floorish = t => !SOLID.has(t);
  // ---------- the ground layer: one item that paints under everything that stands ----------
  function paintGround(g) {
    const v = vis(1);
    for (let ty = v.y0; ty <= v.y1; ty++) for (let tx = v.x0; tx <= v.x1; tx++) {
      const t = tileAt(tx, ty), x = tx * TILE, y = ty * TILE;
      if (t === T.WALL || t === HEART_VEIN || t === HEART_DOOR) { wallTrim(g, tx, ty, t); continue; }
      if (t === ROYAL_CHASM) { drawChasm(g, tx, ty); continue; }
      if (t === T_BRIDGE) { drawBridgeDeck(g, tx, ty); continue; }
      // a stall, a lamp, a statue or a pillar on the flagstones keeps the flagstones under it
      if (t !== T.COBBLE && t !== T.CAVE && t !== ROYAL_STAIR) {
        const cob = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(tx + dx, ty + dy) === T.COBBLE);
        const want = cob ? 'cobble' : 'cave';
        if (TEX_NAME[t] !== want) { const img = tex[want + variant[idx(tx, ty)]]; if (img) g.drawImage(img, x, y, TILE, TILE); if (t === T.RUBBLE) drawRubbleProp(g, tx, ty); }
      }
      if (t === T.COBBLE && (tx + ty) % 4 === 0) {
        const cx = x + TILE / 2, cy = y + TILE / 2;
        g.fillStyle = 'rgba(40,28,10,0.35)'; g.beginPath(); g.moveTo(cx, cy - 7); g.lineTo(cx + 7, cy); g.lineTo(cx, cy + 7); g.lineTo(cx - 7, cy); g.closePath(); g.fill();
        g.fillStyle = GOLD; g.beginPath(); g.moveTo(cx, cy - 5); g.lineTo(cx + 5, cy); g.lineTo(cx, cy + 5); g.lineTo(cx - 5, cy); g.closePath(); g.fill();
        g.fillStyle = GOLD_L; g.beginPath(); g.moveTo(cx, cy - 5); g.lineTo(cx + 2, cy - 2); g.lineTo(cx, cy); g.lineTo(cx - 2, cy - 2); g.closePath(); g.fill();
      }
      if (t === T_RAIL) drawRail(g, tx, ty);
    }
    for (const [bx, by] of BURROWS) if (bx >= v.x0 && bx <= v.x1 && by >= v.y0 && by <= v.y1) drawBurrow(g, bx, by);
    for (const [x, y] of BANNERS) if (x >= v.x0 - 1 && x <= v.x1 + 1 && y >= v.y0 && y <= v.y1) drawBanner(g, x, y, false);
    for (const [x, y] of TORN) if (x >= v.x0 - 1 && x <= v.x1 + 1 && y >= v.y0 && y <= v.y1) drawBanner(g, x, y, true);
    for (let k = 0; k < VEINS.length; k++) { const [x, y] = VEINS[k]; if (x >= v.x0 - 1 && x <= v.x1 + 1 && y >= v.y0 - 1 && y <= v.y1 + 1) drawVein(g, k); }
    if (tileAt(STAIR_UP[0], STAIR_UP[1]) === ROYAL_STAIR) drawStairUp(g, STAIR_UP[0], STAIR_UP[1]);
  }
  function wallTrim(g, tx, ty, t) {
    const x = tx * TILE, y = ty * TILE;
    const S = floorish(tileAt(tx, ty + 1)), Nn = floorish(tileAt(tx, ty - 1)), Ww = floorish(tileAt(tx - 1, ty)), E = floorish(tileAt(tx + 1, ty));
    if (S && t !== HEART_DOOR) {
      // the face you can see: dressed stone under a gilt cornice, a gold band where it meets the floor
      g.fillStyle = '#4b443c'; g.fillRect(x, y + 18, TILE, TILE - 18);
      g.fillStyle = '#57504a'; for (let k = 0; k < 2; k++) g.fillRect(x, y + 21 + k * 13, TILE, 5);
      g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(x, y + 32, TILE, 1.5); g.fillRect(x, y + 45 - 1.5, TILE, 1.5);
      const off = (tx % 2) * 12; for (const jx of [off + 6, off + 30]) { g.fillRect(x + jx, y + 20, 1.5, 12); g.fillRect(x + ((jx + 12) % TILE), y + 33, 1.5, 11); }
      g.fillStyle = GOLD_D; g.fillRect(x, y + 16, TILE, 4); g.fillStyle = GOLD; g.fillRect(x, y + 16, TILE, 2);
      g.fillStyle = GOLD; g.fillRect(x, y + TILE - 3, TILE, 3);
      g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(x, y + TILE - 3, TILE, 1);
    }
    g.fillStyle = GOLD;
    if (Nn) g.fillRect(x, y, TILE, 3);
    if (Ww) g.fillRect(x, y, 3, TILE);
    if (E) g.fillRect(x + TILE - 3, y, 3, TILE);
  }
  function drawChasm(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, top = tileAt(tx, ty - 1) !== ROYAL_CHASM, bot = tileAt(tx, ty + 1) !== ROYAL_CHASM;
    const p = 0.5 + 0.5 * Math.sin(time * 1.3 + tx * 0.55);
    const gr = g.createLinearGradient(0, y, 0, y + TILE);
    if (top) { gr.addColorStop(0, '#0e0605'); gr.addColorStop(1, `rgb(${60 + p * 20},${22 + p * 8},10)`); }
    else if (bot) { gr.addColorStop(0, `rgb(${60 + p * 20},${22 + p * 8},10)`); gr.addColorStop(1, '#0e0605'); }
    else { gr.addColorStop(0, `rgb(${70 + p * 22},${26 + p * 8},10)`); gr.addColorStop(0.5, `rgb(${120 + p * 40},${46 + p * 16},14)`); gr.addColorStop(1, `rgb(${70 + p * 22},${26 + p * 8},10)`); }
    g.fillStyle = gr; g.fillRect(x, y, TILE, TILE);
    // glints of the fire far below, drifting
    for (let k = 0; k < 3; k++) {
      const ph = (time * (0.18 + hh(tx, ty, k) * 0.15) + hh(tx, ty, k + 5)) % 1, ex = x + 6 + hh(tx, ty, k + 9) * 36, ey = y + TILE - ph * TILE * 1.2;
      const a = Math.sin(ph * Math.PI) * 0.9; if (a <= 0.02) continue;
      g.fillStyle = `rgba(255,${150 + k * 30},70,${a.toFixed(3)})`; g.beginPath(); g.arc(ex + Math.sin(time * 2 + k) * 2, ey, 1.2 + k * 0.4, 0, 7); g.fill();
    }
    if (top) {
      // the near cliff: the floor's edge and the rock falling away under it
      g.fillStyle = '#3d342c'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + TILE, y);
      for (let k = 6; k >= 0; k--) g.lineTo(x + k * 8, y + 14 + hh(tx, k, 1) * 8);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x, y + 20, TILE, 6);
      g.fillStyle = GOLD; g.fillRect(x, y, TILE, 2);
    }
    if (bot) { g.fillStyle = '#2a221c'; g.fillRect(x, y + TILE - 5, TILE, 5); g.fillStyle = 'rgba(255,160,90,0.25)'; g.fillRect(x, y + TILE - 6, TILE, 1.5); }
  }
  function drawBridgeDeck(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, over = tileAt(tx - 1, ty) === ROYAL_CHASM || tileAt(tx + 1, ty) === ROYAL_CHASM;
    g.fillStyle = '#6d655b'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#7a7266'; for (let k = 0; k < 3; k++) g.fillRect(x + 1, y + k * 16 + 1, TILE - 2, 13);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 3; k++) g.fillRect(x, y + k * 16 + 14, TILE, 2);
    if (!over) return;
    // parapets with gilt caps on the two outer edges, posts at every flagstone
    const west = tileAt(tx - 1, ty) === ROYAL_CHASM, east = tileAt(tx + 1, ty) === ROYAL_CHASM;
    for (const side of [west ? 0 : -1, east ? 1 : -1]) {
      if (side < 0) continue;
      const px = side === 0 ? x : x + TILE - 8;
      g.fillStyle = '#3f3831'; g.fillRect(px, y, 8, TILE);
      g.fillStyle = '#5a5249'; g.fillRect(px + 1, y, 6, TILE);
      g.fillStyle = GOLD; g.fillRect(px + 2.5, y, 3, TILE);
      g.fillStyle = GOLD_L; for (const py of [y + 6, y + 30]) { g.beginPath(); g.arc(px + 4, py, 3.4, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(side === 0 ? px - 4 : px + 8, y, 4, TILE);
    }
  }
  function drawRail(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#5a4128'; for (let k = 0; k < 4; k++) g.fillRect(x + 3 + k * 12, y + 10, 6, 28);
    g.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 0; k < 4; k++) g.fillRect(x + 3 + k * 12, y + 36, 6, 2);
    for (const ry of [y + 14, y + 30]) { g.fillStyle = '#5c5f68'; g.fillRect(x, ry, TILE, 4); g.fillStyle = GOLD; g.fillRect(x, ry, TILE, 1.5); }
  }
  function drawBurrow(g, bx, by) {
    const cx = tc(bx), cy = tc(by) + 4;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + 6, 22, 9, 0, 0, 7); g.fill();
    for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2, rr = 15 + hh(bx, by, k) * 4; g.fillStyle = ['#6e675c', '#7d766a', '#5f594f'][k % 3]; g.beginPath(); g.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.55, 5 + hh(k, by, bx) * 3, 3.6, a, 0, 7); g.fill(); }
    g.fillStyle = '#16100c'; g.beginPath(); g.ellipse(cx, cy, 10, 5.5, 0, 0, 7); g.fill();
    g.fillStyle = `rgba(143,224,122,${0.18 + 0.12 * Math.sin(time * 3 + bx)})`; g.beginPath(); g.ellipse(cx, cy, 6, 3, 0, 0, 7); g.fill();
  }
  function drawBanner(g, tx, ty, torn) {
    const x = tx * TILE, y = ty * TILE, cx = x + TILE / 2, sway = Math.sin(time * 1.1 + tx) * 1.2;
    g.fillStyle = GOLD_D; g.fillRect(cx - 16, y + 3, 32, 3); g.fillStyle = GOLD; g.fillRect(cx - 16, y + 3, 32, 1.5);
    g.fillStyle = GOLD_L; g.beginPath(); g.arc(cx - 17, y + 4.5, 2.4, 0, 7); g.arc(cx + 17, y + 4.5, 2.4, 0, 7); g.fill();
    g.fillStyle = torn ? '#5a2a24' : '#8e1f1c';
    g.beginPath(); g.moveTo(cx - 13, y + 6); g.lineTo(cx + 13, y + 6);
    if (torn) { g.lineTo(cx + 13 + sway, y + 26); g.lineTo(cx + 7 + sway, y + 30); g.lineTo(cx + 9 + sway, y + 38); g.lineTo(cx + 1 + sway, y + 33); g.lineTo(cx - 5 + sway, y + 40); g.lineTo(cx - 8 + sway, y + 29); g.lineTo(cx - 13 + sway, y + 34); }
    else { g.lineTo(cx + 13 + sway, y + 42); g.lineTo(cx + sway, y + 35); g.lineTo(cx - 13 + sway, y + 42); }
    g.closePath(); g.fill();
    g.strokeStyle = torn ? 'rgba(200,160,80,0.5)' : GOLD; g.lineWidth = 1.5; g.stroke();
    if (!torn) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx + 7, y + 7, 5, 30); }
    mark(g, cx + sway * 0.5, y + 21, 0.95, torn ? 'rgba(200,160,80,0.55)' : GOLD_L);
    if (torn) { g.strokeStyle = 'rgba(30,10,8,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 10, y + 12); g.lineTo(cx + 4, y + 24); g.stroke(); }
  }
  function drawVein(g, k) {
    const [tx, ty] = VEINS[k], x = tx * TILE, y = ty * TILE, t = now(), lit = isLit(k, t);
    const left = N.VEIN_WINDOW - (t % N.VEIN_WINDOW), flick = lit && left < 2000 ? (Math.sin(time * 28) > 0 ? 1 : 0.35) : 1;
    const taken = lit ? veinTaken(k, t) : 0, spent = lit && taken >= N.VEIN_TAKE;
    const pulse = 0.65 + 0.35 * Math.sin(time * 4 + k);
    // which way the vein faces: toward the hall floor
    const fx = floorish(tileAt(tx + 1, ty)) ? 1 : floorish(tileAt(tx - 1, ty)) ? -1 : 0, fy = floorish(tileAt(tx, ty - 1)) ? -1 : floorish(tileAt(tx, ty + 1)) ? 1 : 0;
    const cx = x + TILE / 2 + fx * 8, cy = y + TILE / 2 + fy * 8;
    if (lit && !spent) {
      const a = (0.45 * pulse * flick).toFixed(3);
      const gr = g.createRadialGradient(cx, cy, 4, cx, cy, 58); gr.addColorStop(0, `rgba(255,140,90,${a})`); gr.addColorStop(1, 'rgba(255,140,90,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 58, 0, 7); g.fill();
    }
    const core = lit && !spent ? `rgba(255,${150 + Math.round(60 * pulse)},${120 + Math.round(40 * pulse)},${(0.95 * flick).toFixed(3)})` : '#6a1e14';
    const edge = lit && !spent ? `rgba(255,90,60,${(0.9 * flick).toFixed(3)})` : '#3e120c';
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let s = 0; s < 3; s++) {
      const a0 = hh(tx, ty, s) * 6.28, len = 16 + s * 4;
      g.strokeStyle = edge; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy);
      for (let j = 1; j <= 3; j++) { const a = a0 + (j % 2 ? 0.5 : -0.5); g.lineTo(cx + Math.cos(a) * len * j / 3, cy + Math.sin(a) * len * j / 3); }
      g.stroke(); g.strokeStyle = core; g.lineWidth = 2.2; g.stroke();
    }
    // the crystals that break off: one for every stone still in the vein this glow
    g.fillStyle = core;
    for (let j = 0; j < (lit ? N.VEIN_TAKE - taken : 2); j++) { const a = j * 2.1 + hh(ty, tx, j) * 1.5, r = 7 + j * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r - 5); g.lineTo(cx + Math.cos(a) * r + 3.5, cy + Math.sin(a) * r + 2); g.lineTo(cx + Math.cos(a) * r - 3.5, cy + Math.sin(a) * r + 2); g.closePath(); g.fill(); }
    if (lit && !spent) { g.fillStyle = `rgba(255,240,220,${(0.8 * pulse * flick).toFixed(3)})`; g.beginPath(); g.arc(cx + Math.sin(time * 3 + k) * 5, cy - 3, 1.8, 0, 7); g.fill(); }
  }
  function drawStairUp(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#231a12'; g.fillRect(x + 6, y + 4, TILE - 12, TILE - 4);
    for (let k = 0; k < 5; k++) { const sy = y + TILE - 8 - k * 8, w = TILE - 14 - k * 3; g.fillStyle = `rgb(${120 + k * 22},${100 + k * 20},${72 + k * 16})`; g.fillRect(x + TILE / 2 - w / 2, sy, w, 6); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + TILE / 2 - w / 2, sy + 5, w, 1.5); }
    const gr = g.createLinearGradient(0, y, 0, y + TILE); gr.addColorStop(0, 'rgba(255,233,176,0.55)'); gr.addColorStop(1, 'rgba(255,233,176,0)'); g.fillStyle = gr; g.fillRect(x + 6, y + 4, TILE - 12, TILE - 4);
    g.fillStyle = GOLD; g.fillRect(x + 3, y + 2, 4, TILE - 2); g.fillRect(x + TILE - 7, y + 2, 4, TILE - 2);
    g.fillStyle = GOLD_L; g.beginPath(); g.moveTo(x + 3, y + 6); g.quadraticCurveTo(x + TILE / 2, y - 12, x + TILE - 3, y + 6); g.lineTo(x + TILE - 7, y + 6); g.quadraticCurveTo(x + TILE / 2, y - 6, x + 7, y + 6); g.closePath(); g.fill();
    mark(g, x + TILE / 2, y - 3, 0.5, GOLD_D);
  }
  // the Stair of Kings where the throne stood: steps going down, and the warm light of the King's Deep coming up
  function drawStairDown(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#1b130d'; g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    for (let k = 0; k < 5; k++) { const sy = y + 6 + k * 8, w = TILE - 12 - k * 4; g.fillStyle = `rgb(${128 - k * 20},${106 - k * 18},${78 - k * 14})`; g.fillRect(x + TILE / 2 - w / 2, sy, w, 6); }
    const gl = 0.35 + 0.15 * Math.sin(time * 2.2);
    const gr = g.createRadialGradient(x + TILE / 2, y + TILE - 8, 2, x + TILE / 2, y + TILE - 8, 34); gr.addColorStop(0, `rgba(255,190,110,${gl})`); gr.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = gr; g.fillRect(x, y, TILE, TILE);
    g.strokeStyle = GOLD; g.lineWidth = 3; g.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
  }

  // ---------- things that stand ----------
  function drawPillar(g, tx, ty) {
    const x = tc(tx), base = ty * TILE + TILE - 6, top = ty * TILE - 34;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x + 3, base + 3, 18, 7, 0, 0, 7); g.fill();
    g.fillStyle = GOLD_D; g.beginPath(); g.ellipse(x, base, 16, 6, 0, 0, 7); g.fill();
    g.fillStyle = GOLD; g.fillRect(x - 15, base - 8, 30, 7); g.fillStyle = GOLD_L; g.fillRect(x - 15, base - 8, 30, 2);
    const sg = g.createLinearGradient(x - 11, 0, x + 11, 0); sg.addColorStop(0, '#8f877a'); sg.addColorStop(0.35, '#b7ae9d'); sg.addColorStop(1, '#6a6358');
    g.fillStyle = sg; g.fillRect(x - 11, top + 10, 22, base - 8 - top - 10);
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (const fx of [-7, -2, 3, 8]) g.fillRect(x + fx, top + 12, 1.6, base - 10 - top - 12);
    g.fillStyle = 'rgba(255,245,220,0.18)'; for (const fx of [-5, 0]) g.fillRect(x + fx, top + 12, 1.2, base - 10 - top - 12);
    g.fillStyle = GOLD_D; g.fillRect(x - 16, top + 2, 32, 10); g.fillStyle = GOLD; g.fillRect(x - 15, top + 2, 30, 6); g.fillStyle = GOLD_L; g.fillRect(x - 15, top + 2, 30, 2);
    g.fillStyle = '#7d7568'; g.fillRect(x - 18, top - 4, 36, 7);
    g.fillStyle = GOLD; g.beginPath(); g.arc(x - 11, top + 9, 2.6, 0, 7); g.arc(x + 11, top + 9, 2.6, 0, 7); g.fill();
  }
  function drawCart(g, tx, ty) {
    const x = tc(tx), y = tc(ty) - 4;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 16, 20, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#5a4128'; g.beginPath(); g.moveTo(x - 20, y - 10); g.lineTo(x + 20, y - 10); g.lineTo(x + 16, y + 10); g.lineTo(x - 16, y + 10); g.closePath(); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 2.5; g.stroke(); g.fillStyle = GOLD; g.fillRect(x - 20, y - 11, 40, 3);
    for (const [ox, oy, c] of [[-10, -12, '#6f8fbf'], [-2, -15, '#8fb0e0'], [7, -12, '#5a7aa8'], [13, -10, '#e8a640'], [-14, -9, '#9a86e0']]) { g.fillStyle = c; g.beginPath(); g.ellipse(x + ox, y + oy, 6, 4.4, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(230,240,255,0.8)'; g.beginPath(); g.arc(x - 3, y - 16, 1.4, 0, 7); g.fill();
    g.fillStyle = '#2e2f36'; for (const wx of [-11, 11]) { g.beginPath(); g.arc(x + wx, y + 11, 5, 0, 7); g.fill(); g.fillStyle = GOLD; g.beginPath(); g.arc(x + wx, y + 11, 1.8, 0, 7); g.fill(); g.fillStyle = '#2e2f36'; }
  }
  const STONE = { tunic: '#8c867b', hair: '#a8a295', shoulder: '#9d978b' };
  function stoneLook(l) {
    const out = { tunic: STONE.tunic, hair: STONE.hair, shoulder: STONE.shoulder };
    if (l.helm) out.helm = '#9a9488'; if (l.body) out.body = '#948e82'; if (l.shield) out.shield = '#a39d91';
    if (l.weapon) out.weapon = { shape: l.weapon.shape || 'sword', color: '#b3ad9f' }; else if (!l.helm) out.fists = true;
    for (const k of ['crown', 'beard', 'woman', 'wings']) if (l[k]) out[k] = l[k];
    return out;
  }
  function drawStatue(g, s, hasKnight) {
    const x = s.x * TILE, y = s.y * TILE, cx = x + TILE / 2;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx + 2, y + TILE - 3, 22, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#5f5a52'; g.fillRect(x + 5, y + 20, TILE - 10, TILE - 22);
    g.fillStyle = '#7a746a'; g.fillRect(x + 5, y + 16, TILE - 10, 6);
    g.fillStyle = GOLD_D; g.fillRect(x + 13, y + 29, 22, 10); g.fillStyle = GOLD; g.fillRect(x + 14, y + 30, 20, 8);
    g.fillStyle = GOLD_D; for (let k = 0; k < 3; k++) g.fillRect(x + 17, y + 32 + k * 2, 14 - k * 3, 1);
    if (s.empty && !hasKnight) {
      g.fillStyle = 'rgba(200,190,170,0.35)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + 12 + k * 6, y + 18 + (k % 2) * 2, 1.4, 0, 7); g.fill(); }
      return;
    }
    const look = s.empty ? stoneLook(playerLook()) : stoneLook(s.look);
    const e = { facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, walkT: 0, moving: false };
    g.save(); g.translate(cx, y + 2); g.scale(1.25, 1.25);
    drawHuman(g, e, look);
    g.restore();
    if (s.empty) { g.fillStyle = 'rgba(245,238,220,0.5)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(cx - 10 + k * 7, y + 17 + Math.sin(time * 2 + k) * 0.6, 1.3, 0, 7); g.fill(); } }
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
    mark(g, cx, y + 34, 0.7, GOLD);
    for (let k = 0; k < 3; k++) { const ph = (time * 0.9 + k * 0.33) % 1; g.fillStyle = `rgba(255,${170 + k * 20},80,${(1 - ph).toFixed(3)})`; g.beginPath(); g.arc(cx - 8 + k * 8 + Math.sin(time * 3 + k) * 3, y + 6 - ph * 26, 1.4, 0, 7); g.fill(); }
  }
  function drawDoor(g) {
    const cx = tc(27), y = 33 * TILE, open = R().door || tileAt(27, 33) === T.COBBLE, k = doorAnim ? clamp(doorAnim.t / N.DOOR_OPEN, 0, 1) : open ? 1 : 0;
    // the arch: two gilt posts and a lintel with the king's mark, standing whether the door is shut or open
    g.fillStyle = '#4b443c'; g.fillRect(cx - 78, y - 6, 10, TILE + 6); g.fillRect(cx + 68, y - 6, 10, TILE + 6);
    g.fillStyle = GOLD; g.fillRect(cx - 76, y - 6, 3, TILE + 6); g.fillRect(cx + 73, y - 6, 3, TILE + 6);
    if (k < 1) {
      // the round door of red stone, with the heart-shaped hole the crownheart fits
      g.save(); g.translate(cx + k * 64, y + 24); g.rotate(k * 1.6); g.scale(1, 0.92);
      g.fillStyle = '#3a120c'; g.beginPath(); g.arc(0, 0, 32, 0, 7); g.fill();
      const dg = g.createRadialGradient(-8, -8, 4, 0, 0, 30); dg.addColorStop(0, '#b84a34'); dg.addColorStop(1, '#6e2218'); g.fillStyle = dg; g.beginPath(); g.arc(0, 0, 29, 0, 7); g.fill();
      g.strokeStyle = GOLD; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 29, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); g.lineTo(Math.cos(a) * 27, Math.sin(a) * 27); g.stroke(); }
      g.fillStyle = '#140806'; heartPath(g, 0, -1, 1.25); g.fill();
      if (countItem('crownheart') > 0 && inside()) { g.fillStyle = `rgba(255,120,80,${(0.25 + 0.2 * Math.sin(time * 4)).toFixed(3)})`; heartPath(g, 0, -1, 1.25); g.fill(); }
      g.restore();
    }
    g.fillStyle = '#4b443c'; g.fillRect(cx - 78, y - 10, 156, 10);
    g.fillStyle = GOLD_D; g.fillRect(cx - 78, y - 1, 156, 3); g.fillStyle = GOLD; g.fillRect(cx - 78, y - 10, 156, 2.5);
    mark(g, cx, y - 5, 0.55, GOLD_L);
  }

  // ---------- the giant rocks: one drawing across the whole footprint ----------
  function drawGiant(g, r) {
    const S = r.size * TILE, x0 = r.x * TILE, y0 = r.y * TILE, t = now(), st = rockStage[r.i] || 0;
    const rest = restless(r.i, t) || (hasHeartPick() && restlessRaw(r.i, t + 3000) && !golemAlive(r.i));
    const w = wakes.find(o => o.i === r.i), split = w ? Math.sin(clamp(w.t / N.WAKE_ANIM, 0, 1) * Math.PI) : 0;
    const shake = rest ? Math.sin(time * 42 + r.i) * 2 : 0;
    const storm = r.kind === 'storm', cx = x0 + S / 2 + shake, cy = y0 + S / 2;
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); g.ellipse(cx, y0 + S - 6, S * 0.46, S * 0.14, 0, 0, 7); g.fill();
    // an irregular boulder, the same shape every time for the same rock
    const pts = [];
    const n = storm ? 11 : 9;
    for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + k / n * Math.PI * 2, rr = 0.86 + hh(r.i, k, 3) * 0.14; pts.push([Math.cos(a) * S * 0.47 * rr, Math.sin(a) * S * 0.44 * rr + S * 0.02]); }
    const body = storm ? ['#5a4a8e', '#6a5aa8', '#4a3d78'] : ['#5f7aa8', '#6f8fbf', '#4f6890'];
    for (const half of split > 0 ? [-1, 1] : [0]) {
      g.save();
      if (half) { g.beginPath(); if (half < 0) g.rect(x0 - S, y0 - S, S * 1.5 + shake, S * 3); else g.rect(cx, y0 - S, S * 1.5, S * 3); g.clip(); g.translate(half * split * 14, -split * 4); }
      const bg = g.createLinearGradient(cx - S / 2, cy - S / 2, cx + S / 2, cy + S / 2); bg.addColorStop(0, body[1]); bg.addColorStop(1, body[2]);
      g.fillStyle = bg; g.beginPath(); for (const [px, py] of pts) g.lineTo(cx + px, cy + py); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.stroke();
      // facets catching the lamp light
      g.fillStyle = 'rgba(255,255,255,0.13)'; g.beginPath(); g.moveTo(cx + pts[n - 1][0] * 0.8, cy + pts[n - 1][1] * 0.8); g.lineTo(cx + pts[0][0] * 0.85, cy + pts[0][1] * 0.85); g.lineTo(cx + pts[1][0] * 0.6, cy + pts[1][1] * 0.6); g.lineTo(cx - S * 0.05, cy - S * 0.05); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + pts[3][0] * 0.9, cy + pts[3][1] * 0.9); g.lineTo(cx + pts[5][0] * 0.9, cy + pts[5][1] * 0.9); g.closePath(); g.fill();
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (!storm) {
        // thick bright mithril veins
        for (let v = 0; v < 3; v++) {
          const a = hh(r.i, v, 11) * 6.28; g.strokeStyle = '#3d5680'; g.lineWidth = 5.5; g.beginPath(); g.moveTo(cx + Math.cos(a) * S * 0.36, cy + Math.sin(a) * S * 0.3);
          g.quadraticCurveTo(cx + Math.cos(a + 1.8) * S * 0.12, cy + Math.sin(a + 1.8) * S * 0.1, cx + Math.cos(a + 3) * S * 0.33, cy + Math.sin(a + 3) * S * 0.28); g.stroke();
          g.strokeStyle = '#bcd4f5'; g.lineWidth = 3; g.stroke(); g.strokeStyle = 'rgba(240,248,255,0.8)'; g.lineWidth = 1; g.stroke();
        }
        for (let k = 0; k < 6; k++) { const a = hh(r.i, k, 21) * 6.28, d = hh(k, r.i, 22) * S * 0.3; g.fillStyle = `rgba(230,240,255,${(0.4 + 0.5 * Math.sin(time * 3 + k + r.i)).toFixed(3)})`; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.7, 0, 7); g.fill(); }
      } else {
        // lilac lightning in the rock, and a crown of crystals on top
        for (let v = 0; v < 3; v++) {
          let px = cx - S * 0.34 + v * S * 0.1, py = cy - S * 0.26 + v * S * 0.2; g.strokeStyle = '#3a2e5e'; g.lineWidth = 5; g.beginPath(); g.moveTo(px, py);
          const pts2 = []; for (let j = 0; j < 5; j++) { px += S * 0.13; py += (j % 2 ? -1 : 1) * S * 0.08; pts2.push([px, py]); g.lineTo(px, py); } g.stroke();
          g.strokeStyle = `rgba(200,176,255,${(0.75 + 0.25 * Math.sin(time * 6 + v + r.i)).toFixed(3)})`; g.lineWidth = 2.4; g.stroke();
        }
        for (let k = 0; k < 5; k++) {
          const bx = cx - S * 0.22 + k * S * 0.11, by = cy - S * 0.33 + Math.abs(k - 2) * 5, h = S * (0.2 - Math.abs(k - 2) * 0.03);
          g.fillStyle = k % 2 ? '#c8b0ff' : '#a98ae8'; g.beginPath(); g.moveTo(bx - 6, by); g.lineTo(bx - 2, by - h); g.lineTo(bx + 3, by - h * 0.92); g.lineTo(bx + 6, by); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(bx - 3, by - 2); g.lineTo(bx - 1.5, by - h * 0.85); g.lineTo(bx, by - 2); g.closePath(); g.fill();
        }
      }
      // crack stages: hairline, then deep, then a chunk gone
      const glow = rest ? `rgba(255,${120 + Math.round(40 * Math.sin(time * 9))},60,0.95)` : null;
      if (st >= 1 || rest) { g.strokeStyle = glow || 'rgba(20,16,24,0.7)'; g.lineWidth = glow ? 2.2 : 1.3; g.beginPath(); g.moveTo(cx - S * 0.3, cy - S * 0.1); g.lineTo(cx - S * 0.12, cy - S * 0.02); g.lineTo(cx - S * 0.05, cy + S * 0.14); g.moveTo(cx + S * 0.1, cy - S * 0.3); g.lineTo(cx + S * 0.18, cy - S * 0.12); g.lineTo(cx + S * 0.3, cy - S * 0.06); g.stroke(); }
      if (st >= 2 || rest) { g.strokeStyle = glow || 'rgba(12,10,16,0.85)'; g.lineWidth = glow ? 3.5 : 3; g.beginPath(); g.moveTo(cx - S * 0.02, cy - S * 0.36); g.lineTo(cx + S * 0.04, cy - S * 0.12); g.lineTo(cx - S * 0.06, cy + S * 0.05); g.lineTo(cx + S * 0.05, cy + S * 0.3); g.stroke(); }
      if (st >= 3) { g.fillStyle = '#1e1a22'; g.beginPath(); g.moveTo(cx + S * 0.2, cy + S * 0.12); g.lineTo(cx + S * 0.4, cy + S * 0.08); g.lineTo(cx + S * 0.36, cy + S * 0.3); g.lineTo(cx + S * 0.18, cy + S * 0.28); g.closePath(); g.fill(); }
      if (rest) {
        // something inside is waking: ember eyes in the deepest crack
        const eg = g.createRadialGradient(cx, cy - S * 0.04, 1, cx, cy - S * 0.04, S * 0.28); eg.addColorStop(0, 'rgba(255,140,60,0.45)'); eg.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = eg; g.beginPath(); g.arc(cx, cy - S * 0.04, S * 0.28, 0, 7); g.fill();
        const blink = Math.sin(time * 2.3 + r.i) > 0.94 ? 0.2 : 1;
        g.fillStyle = '#ffdd88'; for (const ex of [-7, 7]) { g.beginPath(); g.ellipse(cx + ex, cy - S * 0.06, 3.6, 2.6 * blink, 0, 0, 7); g.fill(); }
        g.fillStyle = '#ff5a1a'; for (const ex of [-7, 7]) { g.beginPath(); g.arc(cx + ex, cy - S * 0.06, 1.4 * blink, 0, 7); g.fill(); }
      }
      g.restore();
    }
  }

  // ---------- the golems ----------
  // the pebble thieves and the little golems are the same little creature: a handful of stones that learned to walk
  function drawPebbler(g, e, opts) {
    const mv = e.moving || opts.moving, wt = e.walkT || 0, bob = mv ? Math.abs(Math.sin(wt * 1.3)) * 2 : 0, lp = mv ? Math.sin(wt * 1.3) * 3 : 0, hurt = !!opts.hurt;
    const dir = (e.facing && e.facing.x < -0.1) ? -1 : 1;
    g.save(); g.scale(dir, 1);
    g.fillStyle = hurt ? '#e0b0a0' : '#666158'; g.beginPath(); g.ellipse(-4 + lp * 0.4, 8, 3.4, 2.6, 0, 0, 7); g.ellipse(4 - lp * 0.4, 8, 3.4, 2.6, 0, 0, 7); g.fill();
    g.translate(0, -bob);
    g.fillStyle = hurt ? '#f0c8b8' : '#8a857a'; g.beginPath(); g.ellipse(0, 0, 9, 7.5, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#f8d8c8' : '#a09a8c'; g.beginPath(); g.ellipse(-4, -4, 4.8, 4, 0.3, 0, 7); g.fill(); g.beginPath(); g.ellipse(4.5, -3, 4, 3.4, -0.3, 0, 7); g.fill();
    g.fillStyle = hurt ? '#d8b0a0' : '#76716a'; g.beginPath(); g.ellipse(1, 4, 5.4, 3.2, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#e8c0b0' : '#7f7a70'; g.beginPath(); g.arc(-9, 1 + lp * 0.3, 2.8, 0, 7); g.arc(9, 1 - lp * 0.3, 2.8, 0, 7); g.fill();
    g.fillStyle = '#1e1a16'; g.beginPath(); g.arc(3, -2, 1.3, 0, 7); g.arc(7, -2, 1.3, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(3.4, -2.4, 0.5, 0, 7); g.arc(7.4, -2.4, 0.5, 0, 7); g.fill();
    if (opts.crumb) {
      const p = 0.6 + 0.4 * Math.sin(time * 5 + (e.x || 0) * 0.1);
      const gr = g.createRadialGradient(-2, -9, 0.5, -2, -9, 9); gr.addColorStop(0, `rgba(160,255,120,${(0.6 * p).toFixed(3)})`); gr.addColorStop(1, 'rgba(160,255,120,0)'); g.fillStyle = gr; g.beginPath(); g.arc(-2, -9, 9, 0, 7); g.fill();
      g.fillStyle = '#8fe07a'; g.beginPath(); g.moveTo(-4.5, -8); g.lineTo(-2, -12.5); g.lineTo(0.5, -8.5); g.closePath(); g.fill();
      g.fillStyle = '#e8ffd8'; g.beginPath(); g.arc(-2, -9.6, 1, 0, 7); g.fill();
    }
    if (opts.coal) {
      g.fillStyle = '#26262c'; g.beginPath(); g.ellipse(10, -1, 4.6, 3.8, 0.3, 0, 7); g.fill();
      g.fillStyle = `rgba(255,150,60,${(0.5 + 0.4 * Math.sin(time * 6)).toFixed(3)})`; g.beginPath(); g.arc(11, -2, 1.2, 0, 7); g.fill();
    }
    g.restore();
  }
  HOOKS.drawMonster.golemling = (g, e, hurt) => drawPebbler(g, e, { crumb: true, hurt });
  function golemBody(g, e, hurt, big) {
    const wt = e.walkT || 0, mv = e.moving, stomp = mv ? Math.sin(wt * 0.8) : 0, s = big ? 1.45 : 1;
    const em = e.emergeT > 0 ? 1 - e.emergeT / N.WAKE_ANIM : 1;
    const c = big ? { a: '#5a4a8e', b: '#6f5fb0', d: '#3f3468', vein: '#e8a640', eye: '#ffb040' } : { a: '#5f7aa8', b: '#7593c6', d: '#435c86', vein: '#bcd4f5', eye: '#ff7a2a' };
    if (hurt) { c.a = '#e8c0c0'; c.b = '#f4d4d4'; c.d = '#c8a0a0'; }
    const dir = (e.facing && e.facing.x < -0.1) ? -1 : 1;
    g.save(); g.translate(0, (1 - em) * 26); g.scale(s * dir * (0.5 + em * 0.5), s * (0.5 + em * 0.5));
    if (e.attackT > 0) g.rotate(-0.12);
    // legs, stamping
    g.fillStyle = c.d; roundRect(g, -12, 4 - Math.max(0, stomp) * 4, 9, 13, 3); g.fill(); roundRect(g, 3, 4 - Math.max(0, -stomp) * 4, 9, 13, 3); g.fill();
    // arms swinging against the legs
    g.fillStyle = c.a; roundRect(g, -21, -14 + stomp * 2, 8, 16, 3); g.fill(); roundRect(g, 13, -14 - stomp * 2, 8, 16, 3); g.fill();
    g.fillStyle = c.d; g.beginPath(); g.arc(-17, 4 + stomp * 2, 5, 0, 7); g.arc(17, 4 - stomp * 2, 5, 0, 7); g.fill();
    // the body: stacked blocks of the rock it woke from
    const bg = g.createLinearGradient(-14, -20, 14, 6); bg.addColorStop(0, c.b); bg.addColorStop(1, c.a);
    g.fillStyle = bg; roundRect(g, -14, -20, 28, 26, 5); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-14, -6, 28, 2); g.fillRect(-1, -20, 2, 14);
    g.strokeStyle = c.vein; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-10, -15); g.lineTo(-4, -10); g.lineTo(-7, -2); g.moveTo(5, -16); g.lineTo(10, -8); g.lineTo(6, 2); g.stroke();
    if (big) {
      // crystal shoulders
      for (const sx of [-1, 1]) { g.fillStyle = '#c8b0ff'; g.beginPath(); g.moveTo(sx * 12, -18); g.lineTo(sx * 17, -32); g.lineTo(sx * 21, -18); g.closePath(); g.fill(); g.fillStyle = '#a98ae8'; g.beginPath(); g.moveTo(sx * 17, -19); g.lineTo(sx * 23, -27); g.lineTo(sx * 24, -17); g.closePath(); g.fill(); }
    }
    // the head, and the ember eye (two for a boulder golem)
    g.fillStyle = c.b; roundRect(g, -8, -31, 16, 12, 4); g.fill();
    g.fillStyle = c.d; g.fillRect(-8, -24, 16, 2.5);
    const ep = 0.7 + 0.3 * Math.sin(time * 5 + (e.x || 0));
    const eg = g.createRadialGradient(2, -26, 0.5, 2, -26, 8); eg.addColorStop(0, `rgba(255,160,70,${(0.8 * ep).toFixed(3)})`); eg.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = eg; g.beginPath(); g.arc(2, -26, 8, 0, 7); g.fill();
    g.fillStyle = c.eye; if (big) { g.beginPath(); g.arc(-2.5, -26, 2, 0, 7); g.arc(3.5, -26, 2, 0, 7); g.fill(); } else { g.beginPath(); g.arc(2, -26, 2.4, 0, 7); g.fill(); }
    g.restore();
  }
  HOOKS.drawMonster.rock_golem = (g, e, hurt) => golemBody(g, e, hurt, false);
  HOOKS.drawMonster.boulder_golem = (g, e, hurt) => golemBody(g, e, hurt, true);

  // ---------- Gorm the Ginormous: stacked boulders, a stone crown, a heart of glowing stone ----------
  const G_STONE = '#6d665c', G_LIGHT = '#8a8275', G_DARK = '#4f4940', G_MOSS = '#5f8a3a';
  function gormVeins(g, pts) { g.strokeStyle = '#8a6418'; g.lineWidth = 3.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.strokeStyle = GOLD; g.lineWidth = 1.6; g.stroke(); }
  function gormHeart(g, cx, cy, s, glow) {
    const p = 0.75 + 0.25 * Math.sin(time * 3.2);
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 44 * s); gr.addColorStop(0, `rgba(255,120,60,${(0.5 * glow * p).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,90,40,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 44 * s, 0, 7); g.fill();
    g.fillStyle = '#3a120c'; heartPath(g, cx, cy + 1, 2.45 * s); g.fill();
    const hg = g.createRadialGradient(cx - 4 * s, cy - 6 * s, 1, cx, cy, 22 * s); hg.addColorStop(0, glow > 0.5 ? '#ffd08a' : '#b85a3a'); hg.addColorStop(0.5, glow > 0.5 ? '#ff6a2a' : '#8a2a1a'); hg.addColorStop(1, glow > 0.5 ? '#b8281a' : '#4a1410');
    g.fillStyle = hg; heartPath(g, cx, cy, 2.2 * s); g.fill();
    mark(g, cx, cy - 2 * s, 1.05 * s, glow > 0.5 ? GOLD_L : '#8a6418');
  }
  function drawGorm(g, e, hurt) {
    const awake = !inside() || knightsInHall() > 0;
    const t = now(), since = t % N.ROCK_WINDOW, sk = awake ? clamp(since / 450, 0, 1) : 1;
    const lift = sk < 0.55 ? Math.sin(sk / 0.55 * Math.PI) * 11 : 0, shake = sk >= 0.5 && sk < 0.8 ? Math.sin(time * 60) * 2.5 * (1 - (sk - 0.5) / 0.3) : 0;
    const frac = e.maxHp ? clamp(e.hp / e.maxHp, 0, 1) : 1, sit = awake ? 0 : 1;
    const flash = hurt || time - fight.hitFlashT < 0.14, mendK = clamp(1 - (time - fight.mendFlashT) / 0.9, 0, 1);
    g.save(); g.scale(0.86, 0.86); g.translate(shake, 0);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 42, 76, 17, 0, 0, 7); g.fill();
    // legs (standing), or folded in front of him while he sleeps
    if (!sit) {
      g.fillStyle = G_DARK; roundRect(g, -38, -6, 28, 48, 9); g.fill(); roundRect(g, 10, -6 - lift, 28, 48, 9); g.fill();
      g.fillStyle = G_STONE; g.beginPath(); g.arc(-24, 14, 11, 0, 7); g.arc(24, 14 - lift, 11, 0, 7); g.fill();
      g.fillStyle = '#5a534a'; g.beginPath(); g.ellipse(-25, 40, 19, 8, 0, 0, 7); g.ellipse(25, 40 - lift, 19, 8, 0, 0, 7); g.fill();
    } else {
      g.fillStyle = G_DARK; roundRect(g, -52, 18, 46, 22, 10); g.fill(); roundRect(g, 6, 18, 46, 22, 10); g.fill();
      g.fillStyle = '#5a534a'; g.beginPath(); g.ellipse(-50, 34, 12, 9, 0, 0, 7); g.ellipse(50, 34, 12, 9, 0, 0, 7); g.fill();
    }
    g.translate(0, sit * 30);
    // arms: boulders hanging to his knuckles (resting on the ground while he sleeps)
    for (const sd of [-1, 1]) {
      g.fillStyle = G_DARK; g.beginPath(); g.ellipse(sd * 58, -60, 17, 21, sd * 0.2, 0, 7); g.fill();
      g.fillStyle = G_STONE; roundRect(g, sd * 64 - 12, -46, 24, 42 - sit * 8, 10); g.fill();
      g.fillStyle = G_LIGHT; g.beginPath(); g.ellipse(sd * 60, 0 - sit * 10, 17, 14, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(sd * 64 - 12, -26, 24, 2.5);
    }
    // the body
    const TORSO = [[-48, -10], [-56, -48], [-42, -78], [-14, -90], [14, -90], [42, -78], [56, -48], [48, -10], [22, 0], [-22, 0]];
    const tg = g.createLinearGradient(-50, -90, 50, 0); tg.addColorStop(0, G_LIGHT); tg.addColorStop(0.55, G_STONE); tg.addColorStop(1, G_DARK);
    g.fillStyle = tg; g.beginPath(); TORSO.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(255,245,225,0.12)'; g.beginPath(); g.moveTo(-42, -76); g.lineTo(-14, -88); g.lineTo(-20, -60); g.lineTo(-48, -46); g.closePath(); g.fill();
    gormVeins(g, [[-44, -30], [-30, -38], [-34, -58], [-18, -70]]); gormVeins(g, [[40, -20], [30, -34], [38, -52]]); gormVeins(g, [[-10, -8], [4, -18], [0, -26]]);
    // shoulders, with the moss of a hundred years on them
    for (const sd of [-1, 1]) {
      g.fillStyle = G_STONE; g.beginPath(); g.arc(sd * 44, -72, 21, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,245,225,0.12)'; g.beginPath(); g.arc(sd * 44 - 5, -78, 10, 0, 7); g.fill();
      g.fillStyle = G_MOSS; g.beginPath(); g.ellipse(sd * 46, -88, 13, 6, sd * 0.3, 0, 7); g.fill(); g.fillStyle = '#7aa84a'; g.beginPath(); g.ellipse(sd * 42, -90, 6, 3, 0, 0, 7); g.fill();
    }
    g.fillStyle = G_MOSS; g.beginPath(); g.ellipse(-6, -89, 12, 4, 0, 0, 7); g.fill();
    // cracks as he wears down: one set at two thirds, more and a chunk gone at a third
    if (frac < 0.66) { g.strokeStyle = 'rgba(20,14,10,0.8)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-30, -70); g.lineTo(-22, -52); g.lineTo(-30, -36); g.moveTo(24, -80); g.lineTo(30, -62); g.lineTo(22, -50); g.stroke(); }
    if (frac < 0.33) { g.strokeStyle = 'rgba(10,8,6,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-50, -30); g.lineTo(-36, -24); g.lineTo(-40, -8); g.moveTo(36, -30); g.lineTo(46, -16); g.stroke(); g.fillStyle = '#231c16'; g.beginPath(); g.moveTo(52, -72); g.lineTo(62, -64); g.lineTo(54, -54); g.lineTo(46, -62); g.closePath(); g.fill(); }
    // the heart you are cracking
    gormHeart(g, 0, -44, 1, awake ? 1 : 0.35);
    if (mendK > 0) { g.strokeStyle = `rgba(170,240,110,${(0.8 * mendK).toFixed(3)})`; g.lineWidth = 4; g.beginPath(); g.arc(0, -44, 30 + (1 - mendK) * 26, 0, 7); g.stroke(); g.fillStyle = `rgba(245,210,90,${(0.25 * mendK).toFixed(3)})`; heartPath(g, 0, -44, 2.3); g.fill(); }
    // the head, bowed while he sleeps; the crown young Thrain cut for him
    g.save(); g.translate(0, sit * 10); if (sit) g.rotate(0.12);
    g.fillStyle = G_STONE; g.beginPath(); g.ellipse(0, -100, 22, 17, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,245,225,0.12)'; g.beginPath(); g.ellipse(-6, -106, 10, 6, 0, 0, 7); g.fill();
    g.fillStyle = G_DARK; g.fillRect(-20, -106, 40, 5);
    const fx = e.facing ? clamp(e.facing.x, -1, 1) * 2 : 0;
    if (awake) {
      const ep = 0.8 + 0.2 * Math.sin(time * 6);
      for (const ex of [-8, 8]) { const eg = g.createRadialGradient(ex + fx, -99, 0.5, ex + fx, -99, 11); eg.addColorStop(0, `rgba(255,200,100,${ep.toFixed(3)})`); eg.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = eg; g.beginPath(); g.arc(ex + fx, -99, 11, 0, 7); g.fill(); }
      g.fillStyle = '#fff0c0'; for (const ex of [-8, 8]) { g.beginPath(); g.ellipse(ex + fx, -99, 4.4, 2.6, 0, 0, 7); g.fill(); }
      g.fillStyle = '#ff6a1a'; for (const ex of [-8, 8]) { g.beginPath(); g.arc(ex + fx, -99, 1.6, 0, 7); g.fill(); }
    } else { g.strokeStyle = '#8a3a20'; g.lineWidth = 2.5; for (const ex of [-8, 8]) { g.beginPath(); g.moveTo(ex - 4, -98); g.lineTo(ex + 4, -98); g.stroke(); } }
    g.fillStyle = '#8f887b'; g.beginPath(); g.moveTo(-20, -112); g.lineTo(-20, -126); g.lineTo(-12, -118); g.lineTo(-6, -131); g.lineTo(0, -119); g.lineTo(6, -132); g.lineTo(12, -118); g.lineTo(20, -127); g.lineTo(20, -112); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = GOLD; for (const [cx, cy] of [[-10, -115], [4, -116], [14, -114]]) { g.beginPath(); g.arc(cx, cy, 1.8, 0, 7); g.fill(); }
    g.restore();
    if (flash) { g.globalAlpha = 0.5; g.fillStyle = '#ffffff'; g.beginPath(); TORSO.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); g.beginPath(); g.ellipse(0, -100, 22, 17, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
    if (sit) for (let k = 0; k < 3; k++) { const ph = (time * 0.4 + k / 3) % 1; g.fillStyle = `rgba(160,150,135,${(0.35 * (1 - ph)).toFixed(3)})`; g.beginPath(); g.arc(-40 + k * 40 + Math.sin(time + k) * 6, -96 - ph * 40, 4 + ph * 6, 0, 7); g.fill(); }
    g.restore();
  }
  HOOKS.drawMonster.gorm = (g, e, hurt) => drawGorm(g, e, hurt);
  // Gorm down: a heap of the stones he is made of, the crown fallen forward, the heart barely lit
  function drawKneel(g, x, y) {
    const soft = fight.knocks >= 3 || ending.on;
    g.save(); g.translate(x, y); g.scale(0.86, 0.86);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 38, 84, 18, 0, 0, 7); g.fill();
    for (const [bx, by, rx, ry, c] of [[-56, 26, 22, 14, G_DARK], [56, 24, 20, 13, G_DARK], [-30, 30, 26, 14, G_STONE], [34, 32, 24, 12, G_STONE], [0, 36, 30, 10, G_DARK]]) { g.fillStyle = c; g.beginPath(); g.ellipse(bx, by, rx, ry, 0, 0, 7); g.fill(); }
    g.fillStyle = G_STONE; g.beginPath(); g.ellipse(0, 0, 50, 34, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,245,225,0.1)'; g.beginPath(); g.ellipse(-14, -12, 22, 12, 0, 0, 7); g.fill();
    for (const sd of [-1, 1]) { g.fillStyle = G_STONE; g.beginPath(); g.arc(sd * 44, -8, 19, 0, 7); g.fill(); g.fillStyle = G_MOSS; g.beginPath(); g.ellipse(sd * 46, -22, 11, 5, 0, 0, 7); g.fill(); }
    gormVeins(g, [[-36, 4], [-20, -8], [-24, -20]]);
    gormHeart(g, 0, -4, 0.7, soft ? 0.9 : 0.25 + 0.1 * Math.sin(time * 2));
    g.fillStyle = G_STONE; g.beginPath(); g.ellipse(6, 20, 20, 15, 0, 0, 7); g.fill();
    g.fillStyle = G_DARK; g.fillRect(-12, 14, 36, 4);
    if (soft) { g.fillStyle = 'rgba(255,190,110,0.85)'; for (const ex of [-1, 13]) { g.beginPath(); g.ellipse(ex, 21, 3.4, 1.6, 0, 0, 7); g.fill(); } }
    else { g.strokeStyle = '#5a2a18'; g.lineWidth = 2; for (const ex of [-1, 13]) { g.beginPath(); g.moveTo(ex - 3, 21); g.lineTo(ex + 3, 21); g.stroke(); } }
    g.save(); g.translate(34, 28); g.rotate(0.5);
    g.fillStyle = '#8f887b'; g.beginPath(); g.moveTo(-18, 0); g.lineTo(-18, -12); g.lineTo(-10, -6); g.lineTo(-4, -16); g.lineTo(2, -7); g.lineTo(8, -17); g.lineTo(13, -6); g.lineTo(18, -13); g.lineTo(18, 0); g.closePath(); g.fill();
    g.restore();
    g.restore();
  }
  // the dwarves of this file are drawn as 24-dwarves draws its own: a short knight with a great beard
  function dwarfBeard(g, hair) { g.fillStyle = hair; g.beginPath(); g.ellipse(0, -1, 7, 6, 0, 0, Math.PI); g.fill(); g.beginPath(); g.ellipse(-3, 4, 2.2, 3.5, 0, 0, 7); g.ellipse(3, 4, 2.2, 3.5, 0, 0, 7); g.fill(); }
  function drawDwarf(g, d, alpha) {
    const e = { x: d.px, y: d.py, r: 11, facing: d.facing || { x: 0, y: 1 }, hurtT: 0, attackT: 0, moving: !!d.moving, walkT: d.walkT || 0 };
    const near = dist(player.x, player.y, e.x, e.y) < 110;
    if (near && !d.moving) e.facing = { x: Math.sign(player.x - e.x) || 0, y: Math.sign(player.y - e.y) || 1 };
    g.save(); g.globalAlpha = alpha === undefined ? 1 : alpha; g.translate(e.x, e.y + (d.moving ? Math.sin(e.walkT) * 1.5 : 0));
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 10, 11, 5, 0, 0, 7); g.fill();
    g.scale(0.85, 0.85); g.translate(0, 2);
    drawHuman(g, e, { tunic: d.tunic, hair: d.hair, apron: d.apron, helm: d.helm || null, crown: d.crown, woman: d.woman, beard: !d.woman, shoulder: d.shoulder || '#6a5a4a' });
    if (!d.woman) dwarfBeard(g, d.hair);
    g.restore();
    if (near) { g.save(); g.globalAlpha = alpha === undefined ? 1 : alpha; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(d.name, e.x, e.y - 24); g.fillStyle = '#ffe9a8'; g.fillText(d.name, e.x, e.y - 24); g.restore(); }
  }
  // 24-dwarves' throne, drawn at any x while it grinds aside
  function drawThroneAt(g, px, ty) {
    const x = px - TILE / 2, y = ty * TILE, cx = px;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, y + TILE - 4, 18, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#5a5d64'; g.fillRect(x + 8, y + 2, TILE - 16, TILE - 6);
    g.fillStyle = '#6e7178'; g.fillRect(x + 11, y + 5, TILE - 22, TILE - 12);
    g.fillStyle = '#f5c542'; g.fillRect(x + 8, y + 2, TILE - 16, 4); g.fillRect(x + 8, y + 2, 3, TILE - 6); g.fillRect(x + TILE - 11, y + 2, 3, TILE - 6);
    g.fillStyle = '#8a8d95'; g.fillRect(x + 14, y + 24, TILE - 28, 14);
    g.fillStyle = '#7aa0d0'; g.beginPath(); g.arc(cx, y + 12, 3.5, 0, 7); g.fill();
  }
  // the king's crest on the back of his throne: the same mark as the chip
  function drawCrest(g, px, ty) { const y = ty * TILE; g.fillStyle = '#4b443c'; g.beginPath(); g.moveTo(px - 11, y + 3); g.lineTo(px - 9, y - 9); g.lineTo(px + 9, y - 9); g.lineTo(px + 11, y + 3); g.closePath(); g.fill(); mark(g, px, y - 3, 0.62, GOLD); }

  // ---------- floor effects: falling-rock shadows, the rubble they leave, the little golems' paths ----------
  function paintFloorFx(g) {
    const t = now(), warn = kid() ? N.KID_ROCK_WARN : N.ROCK_WARN, age = (t % N.ROCK_WINDOW) / 1000;
    if (!rocks.landed) for (const r of rocks.list) {
      const k = clamp(age / warn, 0, 1), rad = lerp(8, N.ROCK_R, k);
      g.fillStyle = `rgba(0,0,0,${(0.18 + 0.4 * k).toFixed(3)})`; g.beginPath(); g.ellipse(r.x, r.y + 6, rad, rad * 0.55, 0, 0, 7); g.fill();
      g.strokeStyle = `rgba(240,82,77,${(0.35 + 0.45 * k * (0.6 + 0.4 * Math.sin(time * 14))).toFixed(3)})`; g.lineWidth = 2; g.setLineDash([5, 4]);
      g.beginPath(); g.ellipse(r.x, r.y + 6, N.ROCK_R, N.ROCK_R * 0.55, 0, 0, 7); g.stroke(); g.setLineDash([]);
    }
    for (const d of rocks.debris) { const a = clamp(1 - d.t / 1.4, 0, 1); g.fillStyle = `rgba(110,103,92,${a.toFixed(3)})`; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(d.x + (k - 1.5) * 7, d.y + 6 + (k % 2) * 3, 5 - k * 0.5 + d.v, 3.4, 0, 0, 7); g.fill(); } }
    const gm = gorm();
    if (gm && !gm.dead && !gm.gone) {
      g.strokeStyle = 'rgba(143,224,122,0.55)'; g.lineWidth = 2; g.setLineDash([3, 6]);
      for (const m of monsters) if (m.type === 'golemling' && !m.dead && !m.gone) { g.beginPath(); g.moveTo(m.x, m.y + 4); g.lineTo(gm.x, gm.y + 20); g.stroke(); }
      g.setLineDash([]);
    }
  }
  function drawFallingRocks(g) {
    const t = now(), warn = kid() ? N.KID_ROCK_WARN : N.ROCK_WARN, age = (t % N.ROCK_WINDOW) / 1000, k = (age - (warn - 0.3)) / 0.3;
    if (rocks.landed || k <= 0) return;
    for (const r of rocks.list) {
      const h = (1 - clamp(k, 0, 1)) * 150, x = r.x, y = r.y - h;
      g.fillStyle = '#6e675c'; g.beginPath(); g.ellipse(x, y, 14, 11, 0.3, 0, 7); g.fill();
      g.fillStyle = '#8a8275'; g.beginPath(); g.ellipse(x - 4, y - 4, 6, 4, 0.3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, 14, 11, 0.3, 0, 7); g.stroke();
    }
  }
  // your arms: the stones you carry ride over your head, dull red while raw and glowing orange once warm
  function drawArms(g) {
    const n = carried(); if (!n || player.dead) return;
    for (let i = 0; i < n; i++) {
      const warm = i >= arms.raw, x = player.x + (i - (n - 1) / 2) * 10, y = player.y - 38 - (i % 2) * 3;
      if (warm) { const p = 0.65 + 0.35 * Math.sin(time * 6 + i); const gr = g.createRadialGradient(x, y, 1, x, y, 11); gr.addColorStop(0, `rgba(255,200,110,${(0.7 * p).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); }
      g.fillStyle = warm ? '#ff9a3a' : '#7a2a1c'; g.beginPath(); g.moveTo(x - 5, y + 3); g.lineTo(x - 4, y - 3); g.lineTo(x + 1, y - 5); g.lineTo(x + 5, y - 1); g.lineTo(x + 3, y + 4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = warm ? '#fff0c0' : '#a8503a'; g.beginPath(); g.arc(x - 1, y - 1.5, 1.4, 0, 7); g.fill();
    }
  }
  function drawStones(g) {
    for (const s of stones) {
      const m = monsters.includes(s.m) ? s.m : gorm(), tx = m ? m.x : s.x0, ty = m ? m.y - 50 : s.y0, k = clamp(s.t / N.THROW_FLIGHT, 0, 1);
      const x = lerp(s.x0, tx, k), y = lerp(s.y0, ty, k) - Math.sin(k * Math.PI) * 70;
      const gr = g.createRadialGradient(x, y, 1, x, y, 16); gr.addColorStop(0, 'rgba(255,210,120,0.9)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill();
      g.fillStyle = '#ff9a3a'; g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fill(); g.fillStyle = '#fff0c0'; g.beginPath(); g.arc(x - 1.5, y - 1.5, 2, 0, 7); g.fill();
      for (let j = 1; j <= 3; j++) { const kk = Math.max(0, k - j * 0.06), xx = lerp(s.x0, tx, kk), yy = lerp(s.y0, ty, kk) - Math.sin(kk * Math.PI) * 70; g.fillStyle = `rgba(255,150,60,${(0.4 - j * 0.1).toFixed(3)})`; g.beginPath(); g.arc(xx, yy, 4 - j, 0, 7); g.fill(); }
    }
  }
  // the next thing to do, ringed in gold: the glowing vein, then the forge, then Gorm; and where to knock
  function nextTarget() {
    if (!inside() || !fight.inHall) return null;
    if (knockReady()) return { x: tc(GORM_HOME[0]), y: tc(GORM_HOME[1]) - 20, r: 60 };
    if (!gormUp()) return null;
    if (arms.warm > 0 && !arms.raw) { const gm = gorm(); return { x: gm.x, y: gm.y - 50, r: 62 }; }
    if (arms.raw > 0) { let best = null; for (const [x, y] of FORGES) { const d = dist(player.x, player.y, tc(x), tc(y)); if (!best || d < best.d) best = { x: tc(x), y: tc(y), r: 30, d }; } return best; }
    const t = now(); let best = null;
    for (const v of litVeins(t)) { if (veinTaken(v, t) >= N.VEIN_TAKE) continue; const [x, y] = VEINS[v], d = dist(player.x, player.y, tc(x), tc(y)); if (!best || d < best.d) best = { x: tc(x), y: tc(y), r: 30, d }; }
    return best;
  }
  function drawTarget(g) {
    const tg = nextTarget(); if (!tg) return;
    const p = Math.sin(time * 5), r = tg.r + p * 4;
    g.strokeStyle = `rgba(245,197,66,${(0.7 + 0.25 * p).toFixed(3)})`; g.lineWidth = 3; g.beginPath(); g.arc(tg.x, tg.y, r, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(245,197,66,0.3)'; g.lineWidth = 6; g.beginPath(); g.arc(tg.x, tg.y, r + 5, 0, 7); g.stroke();
  }
  function drawSwing(g) {
    const a = player.action; if (!a || player.dead || (a.type !== 'heartvein' && a.type !== 'heartwarm')) return;
    const ang = Math.atan2(player.facing.y, player.facing.x);
    g.save(); g.translate(player.x, player.y);
    if (a.type === 'heartvein') {
      const sw = Math.sin(time * 14) * 0.6; g.rotate(ang - 0.7 + sw); g.fillStyle = '#6b4a2a'; g.fillRect(2, -1.5, 26, 3);
      g.fillStyle = hasHeartPick() ? '#e0482a' : '#a9adb5'; g.beginPath(); g.moveTo(24, -2); g.quadraticCurveTo(30, -8, 34, -6); g.lineTo(30, 0); g.lineTo(34, 6); g.quadraticCurveTo(30, 8, 24, 2); g.closePath(); g.fill();
    } else {
      // holding the raw stone into the heat
      g.rotate(ang); const k = clamp(a.t / a.need, 0, 1);
      g.fillStyle = `rgb(${Math.round(122 + 133 * k)},${Math.round(42 + 110 * k)},${Math.round(28 + 30 * k)})`; g.beginPath(); g.arc(22, 0, 5, 0, 7); g.fill();
    }
    g.restore();
  }

  // ---------- the draw hook: (g, items, cam), and every item's draw() takes no arguments ----------
  HOOKS.draw.push((g, items) => {
    const inR = inside(), inD = inDeep();
    if (!inR && !inD) return;
    if (inR) {
      items.push({ y: -9e7, draw: () => paintGround(g) });
      items.push({ y: -9e7 + 1, draw: () => paintFloorFx(g) });
      const v = vis(3);
      for (let ty = v.y0; ty <= v.y1; ty++) for (let tx = v.x0; tx <= v.x1; tx++) {
        const t = tileAt(tx, ty);
        if (t === T_PILLAR) items.push({ y: ty * TILE + TILE - 5, draw: () => drawPillar(g, tx, ty) });
        else if (t === ROYAL_STATUE) { const s = STATUES.find(o => o.x === tx && o.y === ty); if (s) items.push({ y: ty * TILE + TILE - 4, draw: () => drawStatue(g, s, R().stage >= 7) }); }
        else if (t === HEART_FORGE) items.push({ y: ty * TILE + TILE - 6, draw: () => drawHeartForge(g, tx, ty) });
      }
      if (tileAt(CART[0], CART[1]) === T_RAIL && CART[0] >= v.x0 && CART[0] <= v.x1 && CART[1] >= v.y0 && CART[1] <= v.y1) items.push({ y: tc(CART[1]) + 12, draw: () => drawCart(g, CART[0], CART[1]) });
      for (const r of ROCKS) if (r.x + r.size >= v.x0 && r.x <= v.x1 && r.y + r.size >= v.y0 && r.y <= v.y1 && rockIntact(r.i)) items.push({ y: (r.y + r.size) * TILE - 4, draw: () => drawGiant(g, r) });
      if (33 >= v.y0 - 2 && 33 <= v.y1 + 2) items.push({ y: 34 * TILE - 6, draw: () => drawDoor(g) });
      const gm = gorm();
      // Gorm is drawn a second time just over the core's pass, so the small name tag the core puts at his middle
      // (monster r + 20 above his centre, which on a giant is his chest) sits under him; his boss bar says who he is
      if (gm && !gm.dead && !gm.gone) items.push({ y: gm.y + gm.r + 0.01, draw: () => { g.save(); g.translate(gm.x, gm.y); drawGorm(g, gm, gm.hurtT > 0); g.restore(); } });
      else if (fight.downAt != null) items.push({ y: tc(GORM_HOME[1]) + 40, draw: () => drawKneel(g, tc(GORM_HOME[0]), tc(GORM_HOME[1])) });
      if (peopleHere()) for (const p of PEOPLE) items.push({ y: p.py + 13, draw: () => drawDwarf(g, p) });
      const e = ending.thrain;
      if (e) items.push({ y: e.y + 13, draw: () => drawDwarf(g, { px: e.x, py: e.y, name: THRAIN, tunic: '#7a2e2e', hair: '#d9d0c0', crown: true, shoulder: '#c9a36a', moving: e.moving, walkT: e.walkT, facing: e.moving ? { x: 0, y: e.out ? -1 : 1 } : { x: 0, y: 1 } }, e.a) });
      items.push({ y: player.y + player.r + 0.02, draw: () => { drawSwing(g); drawArms(g); } });
      items.push({ y: 1e9 + 2, draw: () => { drawFallingRocks(g); drawTarget(g); } });
      items.push({ y: 1e9 + 3, draw: () => {
        drawStones(g);
        for (const k of knockRings) { const a = clamp(1 - k.t / 1.2, 0, 1); g.strokeStyle = `rgba(245,197,66,${a.toFixed(3)})`; g.lineWidth = 4; g.beginPath(); g.arc(k.x, k.y, 10 + k.t * 90, 0, 7); g.stroke(); }
      } });
    }
    if (inD) {
      const q = R();
      if (q.stage === 3) items.push({ y: -9e7, draw: () => { for (const [x, y] of CRACKS) drawCrack(g, x, y); } });
      if (tileAt(STAIR_DOWN[0], STAIR_DOWN[1]) === ROYAL_STAIR) items.push({ y: -9e7 + 1, draw: () => drawStairDown(g, STAIR_DOWN[0], STAIR_DOWN[1]) });
      for (const t of TH.list) items.push({ y: t.y + 10, draw: () => { g.save(); g.translate(t.x, t.y + (t.nibbleT > 0 ? Math.sin(time * 30) * 1 : 0)); drawPebbler(g, t, { coal: true, moving: t.nibbleT <= 0 }); g.restore(); } });
      if (slide.on) items.push({ y: 23 * TILE + TILE - 6, draw: () => { const px = tc(slide.x()); drawThroneAt(g, px, 23); drawCrest(g, px, 23); } });
      if (q.stage >= 1) { const v = vis(1); for (let ty = v.y0; ty <= v.y1; ty++) for (let tx = v.x0; tx <= v.x1; tx++) if (tileAt(tx, ty) === DW_THRONE) items.push({ y: ty * TILE + TILE - 6 + 0.05, draw: () => drawCrest(g, tc(tx), ty) }); }
    }
  });
  function drawCrack(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 3, 18, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#120e0c'; g.beginPath(); g.moveTo(cx - 14, cy); g.lineTo(cx - 6, cy - 5); g.lineTo(cx - 1, cy - 2); g.lineTo(cx + 6, cy - 6); g.lineTo(cx + 15, cy + 1); g.lineTo(cx + 5, cy + 5); g.lineTo(cx - 2, cy + 3); g.lineTo(cx - 9, cy + 6); g.closePath(); g.fill();
    g.fillStyle = '#7d766a'; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(a) * 17, cy + Math.sin(a) * 8 + 2, 2.2, 0, 7); g.fill(); }
  }

  // =========================================================================
  // 16. THE HUD: the chase in Deepholm; in Gorm's hall the chip, THROW and KNOCK, and the arrows to little golems
  // =========================================================================
  // THROW and KNOCK sit left of USE on a tablet, finger-sized, clear of the stick, CHAT and the thumb seats. Where
  // there is no such room (a phone) they take a row on the left column like BLOCK does.
  function actionSeat() {
    if (!touchMode() || HK.short()) return null;
    const mx = x => window.__stickRight === true ? VW - x : x;
    const r = 40, x = mx(VW - 250), y = VH - 96, box = { x: x - r, y: y - r, w: r * 2, h: r * 2 };
    const over = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const sx = window.__stickRight === true ? VW - 110 : 110, stick = { x: sx - 60, y: VH - 170, w: 120, h: 120 };
    if (over(box, stick) || box.x < 0 || box.x + box.w > VW) return null;
    for (let i = 0; i <= 5; i++) { const p = HK.thumbSeat(i); if (over(box, { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 })) return null; }
    const chat = { x: mx(VW - 250) - 34, y: VH - 200 - 34, w: 68, h: 68 };
    if (over(box, chat)) return null;
    return { x, y, r, box };
  }
  function drawHowToChip(g) {
    const pad = 9, L = HK.LINE(), lings = monsters.filter(m => m.type === 'golemling' && !m.dead && !m.gone).length;
    const rowsN = 4 + (lings > 0 ? 1 : 0), q = HK.row();
    const s = HK.slot(Math.max(pad * 2 + L * rowsN + 6, q + pad * 2));
    HK.plate(g, s.x, s.y, s.w, s.h, { tone: lings > 0 ? HK.C.BAD : null });
    const ix = s.x + pad + 4, iw = s.w - pad * 2 - 8 - q;
    let y = s.y + pad + L - 3;
    g.textAlign = 'left'; g.fillStyle = HK.C.INK; g.font = `700 13px ${DISPLAY}`; g.fillText("GORM'S HALL", ix, y);
    // the three steps: the one you are on is lit
    y += L + 2;
    const step = carried() === 0 ? 0 : arms.raw > 0 ? 1 : 2, words = ['MINE', 'WARM', 'THROW'];
    let x = ix;
    for (let i = 0; i < 3; i++) {
      g.font = i === step ? 'bold 13px sans-serif' : 'bold 11px sans-serif';
      const w = g.measureText(words[i]).width;
      if (i === step) { roundRect(g, x - 4, y - 12, w + 8, 16, 4); g.fillStyle = 'rgba(245,197,66,0.30)'; g.fill(); }
      g.fillStyle = i === step ? HK.C.INK : HK.C.DIM; g.fillText(words[i], x, y); x += w + 8;
      if (i < 2) { g.font = 'bold 11px sans-serif'; g.fillStyle = HK.C.DIM; g.fillText('>', x, y); x += g.measureText('>').width + 8; }
    }
    y += L;
    g.font = 'bold 11px sans-serif'; g.fillStyle = HK.C.DIM; g.fillText('HEARTSTONES', ix, y);
    g.font = '12px sans-serif'; g.fillStyle = HK.C.INK; g.fillText(`raw ${arms.raw} · warm ${arms.warm} · arms hold ${N.ARMS}`, ix + g.measureText('HEARTSTONES').width + 18, y);
    y += L;
    const left = Math.ceil((N.VEIN_WINDOW - now() % N.VEIN_WINDOW) / 1000);
    g.font = '12px sans-serif'; g.fillStyle = HK.C.DIM; g.fillText(`The glow moves in ${left}s`, ix, y);
    if (lings > 0) {
      y += L;
      g.font = 'bold 11px sans-serif'; const lw = g.measureText('LITTLE GOLEMS WALKING:').width;
      g.fillStyle = HK.C.INK; g.fillText('LITTLE GOLEMS WALKING:', ix, y);
      roundRect(g, ix + lw + 6, y - 12, 24, 16, 5); g.fillStyle = HK.C.BAD; g.fill();
      g.fillStyle = HK.C.INK; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText(String(lings), ix + lw + 18, y); g.textAlign = 'left';
    }
    HK.control(g, s.x + s.w - pad - q, s.y + pad, q, q, '?', () => openPanel('royal_howto'), { hit: 'royal:howto' });
    return s;
  }
  function drawActionButton(g) {
    const ready = knockReady();
    if (!ready && !gormUp()) return;
    const label = ready ? 'KNOCK' : touchMode() ? 'THROW' : 'THROW (Z)', action = ready ? knock : throwStone;
    const seat = actionSeat();
    if (seat) {
      HK.disc(g, seat.x, seat.y, seat.r, label, { tone: ready || arms.warm > 0 ? HK.C.GOOD : null });
      if (arms.warm > 0 || ready) { g.strokeStyle = `rgba(245,197,66,${(0.55 + 0.35 * Math.sin(time * 5)).toFixed(3)})`; g.lineWidth = 2.5; g.beginPath(); g.arc(seat.x, seat.y, seat.r + 4, 0, 7); g.stroke(); }
      buttons.push({ x: seat.box.x, y: seat.box.y, w: seat.box.w, h: seat.box.h, label, action: () => action() });
      return;
    }
    const b = HK.slot(HK.row());
    HK.control(g, b.x, b.y, HK.ctrlW(), b.h, label, () => action(), { tone: ready || arms.warm > 0 ? HK.C.GOOD : null, on: ready || arms.warm > 0 });
  }
  function drawChevrons(g) {
    for (const m of monsters) {
      if (m.type !== 'golemling' || m.dead || m.gone) continue;
      const sx = m.x - cam.x, sy = m.y - cam.y;
      if (sx >= 0 && sx <= VW && sy >= 0 && sy <= VH) continue;
      const cx = VW / 2, cy = VH / 2, ang = Math.atan2(sy - cy, sx - cx), inset = 26;
      const k = Math.min((VW / 2 - inset) / Math.max(Math.abs(Math.cos(ang)), 1e-6), (VH / 2 - inset) / Math.max(Math.abs(Math.sin(ang)), 1e-6));
      const ex = cx + Math.cos(ang) * k, ey = cy + Math.sin(ang) * k;
      g.save(); g.translate(ex, ey); g.rotate(ang);
      g.fillStyle = HK.C.BAD; g.beginPath(); g.moveTo(12, 0); g.lineTo(-6, -10); g.lineTo(-1, 0); g.lineTo(-6, 10); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5; g.stroke(); g.restore();
    }
  }
  function drawRoyalHud(g) {
    if (paused || (typeof title !== 'undefined' && title && title.active)) return;
    if (inDeep() && R().stage === 3 && !panel) {
      const pad = 9, s = HK.slot(pad * 2 + HK.LINE());
      HK.plate(g, s.x, s.y, s.w, s.h, { tone: HK.C.WARN });
      g.textAlign = 'left'; g.font = `700 13px ${DISPLAY}`; g.fillStyle = HK.C.INK; g.fillText('PEBBLE THIEVES', s.x + pad + 4, s.y + pad + HK.LINE() - 3);
      g.textAlign = 'right'; g.font = 'bold 12px sans-serif'; g.fillText(`caught ${Math.min(3, R().caught || 0)} / 3`, s.x + s.w - pad - 4, s.y + pad + HK.LINE() - 3); g.textAlign = 'left';
    }
    if (!inside() || !fight.inHall) return;
    if (!panel) { drawHowToChip(g); drawActionButton(g); }
    drawChevrons(g);
  }
  HOOKS.hud.push(g => drawRoyalHud(g));
  HOOKS.panel.royal_howto = (g, narrow) => {
    const { px, py, w, h } = panelBox(g, 480, 348, 'HOW TO PLAY', 'Gorm the Ginormous');
    const lines = ['1. MINE a glowing vein in the wall.', '2. WARM it at the heart forge.', '3. THROW it at Gorm.', 'Smash the little golems before they reach him. They mend him.', 'Rocks fall where the shadows are. Step out of them.'];
    let y = py + 88;
    for (let i = 0; i < lines.length; i++) {
      const big = i < 3;
      if (big) { g.fillStyle = 'rgba(245,197,66,0.16)'; roundRect(g, px + 18, y - 20, w - 36, 30, 6); g.fill(); }
      g.fillStyle = big ? HK.C.INK : HK.C.DIM; g.font = big ? 'bold 16px sans-serif' : '14px sans-serif'; g.textAlign = 'left';
      wrapText(g, lines[i], px + 28, y, w - 56, 18);
      y += big ? 38 : 30;
    }
    g.textAlign = 'left';
    const bw = 150, bh = HK.row();
    button(g, px + w / 2 - bw / 2, py + h - bh - 16, bw, bh, 'GOT IT', () => closePanel(), '#238636');
  };

  // =========================================================================
  // 17. THE AUDIT, THE KEYS, THE BOOK
  // =========================================================================
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    add('mining', 'giant mithril rock (a crack)', 22, 110, 2.5, "the King's Deep: 5 rocks, 3 cracks each, regrow 75 s", 110 * 5 * 3 * 3600 / 85);
    add('mining', 'giant stormstone rock (a crack)', 30, 150, 2.5, "the King's Deep: 3 rocks, 4 cracks each, regrow 100 s", 150 * 3 * 4 * 3600 / 110);
    add('mining', 'heartstone vein (Gorm)', 20, 45, 3.6, 'loop-limited: mine, walk, warm, throw');
    add('smithing', 'warm a heartstone (Gorm)', 20, 40, 3.6, 'loop-limited: mine, walk, warm, throw');
    add('mining', 'Gorm put to sleep (bonus)', 20, 300, 150, 'every fall you helped with');
    add('smithing', 'Gorm put to sleep (bonus)', 20, 300, 150, 'every fall you helped with');
    add('melee', 'little golem', 1, 120, 6, "Gorm's hall, while he is awake", 120 * 300);
    const P = window.PLAYTHROUGH;
    if (P && P.killXp && P.killSecs) {
      add('melee', 'rock golem (woken)', 24, P.killXp('rock_golem'), P.killSecs('rock_golem', 24).ttk + 20, 'woken out of a giant mithril rock');
      add('melee', 'boulder golem (woken)', 34, P.killXp('boulder_golem'), P.killSecs('boulder_golem', 34).ttk + 25, 'woken out of a giant stormstone rock');
    }
    add('mining', "The King's Knock (once)", 1, N.QUEST_XP, 0, 'quest');
    add('smithing', "The King's Knock (once)", 1, N.QUEST_XP, 0, 'quest');
  });
  HOOKS.keyHelp.push({ action: 'Throw a warm heartstone (Gorm\'s hall)', codes: ['KeyZ'] });
  if (window.WIKI) {
    WIKI.add('places', { id: 'the_king_s_deep', name: "The King's Deep", sub: 'The royal mine under the throne', kind: 'instance', lines: [
      'The royal mine of the dwarf kings, under King Thrain\'s throne in Deepholm. Shut for a hundred years. The Stair of Kings goes down to it from where the throne used to stand.',
      '',
      'THE GALLERY OF KINGS, where you arrive: the statues of the old kings and queens, with a plaque on each. One plinth is empty.',
      'THE DELVING HALL: twelve gilded pillars, the royal rail, a forge and an anvil, two chests, and giant mithril rocks.',
      'THE MITHRIL BAYS (west): mithril, iron and coal, and three more giant mithril rocks.',
      'THE DEEP FACE (east): stormstone, sunstone and coal, and three giant stormstone rocks.',
      'THE BRIDGE OF KINGS over the Underfall, a chasm with fire at the bottom of it.',
      'THE HEART DOOR, round and red, at the far end. Only the crownheart opens it.',
      'THE HEART OF THE MOUNTAIN, behind the door: Gorm the Ginormous. Read "Gorm\'s hall" under Skills.',
    ] });
    WIKI.add('quests', { id: 'royal', name: "The King's Knock", lines: [
      'King Thrain, in the throne hall of Deepholm. It starts the first time you go down into Deepholm after the great forge is lit again.',
      '',
      'Something knocks under Deepholm, three knocks at a time. The king says it is nothing. Brunhild the smith says it is a golem\'s knock, and little pebble golems are stealing her coal.',
      'Catch three of them (swing at one, press USE in front of one, or tap it). The last one holds a chip of heartstone with a crown over an anvil cut into it. The same mark is on the king\'s throne.',
      'Show the king. He made Gorm, a hundred years ago, and never called him home.',
      'Reward: the Stair of Kings and the royal mine, the crownheart, 1200 Mining xp, 1200 Smithing xp, 800 coins, and your own statue in the Gallery of Kings.',
    ] });
    WIKI.add('skills', { id: 'gorm', name: "Gorm's hall: how to put Gorm to sleep", lines: [
      'No sword, arrow or bomb can hurt Gorm. Only a heartstone can crack a heartstone.',
      '',
      '1. MINE. Two of the six veins in the hall walls glow at a time, and the glow moves every 20 seconds. Each glowing vein gives you 3 stones before it goes quiet. Any pickaxe, Mining 20 (10 in kid mode). 45 Mining xp a stone.',
      '2. WARM. A heart forge warms one raw stone a second. Smithing 20 (10 in kid mode). 40 Smithing xp a stone.',
      '3. THROW. Press Z, the THROW button, swing while you face him, or tap him. Up to 8 tiles away. 70 to 90 damage a stone (a quarter more in kid mode). Your arms hold 5 stones, raw and warm together. They crumble if you leave the hall.',
      '',
      'Gorm has 1200 health, and 600 more for every other knight in the hall (up to four). A little golem crawls out of a burrow every 12 seconds (9 with friends; 8 and 6 once he is below half), up to 4 at a time. If one reaches him it mends him 80 (40 in kid mode). Smash them first.',
      'Every 4.5 seconds rocks fall: four across the hall and one where you stand. Step out of the shadow. A rock hits for 9 to 14 (4 to 7 in kid mode).',
      '',
      'WHEN HE SLEEPS every knight who threw a stone, or smashed three little golems, gets his rubble: 400 to 700 coins and 8 to 14 coal always, one of 4 to 6 mithril bars (30 in 100), 3 to 5 sunstone bars (25), 6 to 10 stormstone ore (20), 2 to 3 stormstone bars (15) or 10 to 15 mithril ore (10), plus 300 Mining xp and 300 Smithing xp.',
      'One time in 25 his rubble holds the Heartstone pickaxe. If you have not had one by your 30th share, the 30th gives it to you.',
      'He wakes again 45 seconds after he falls. If the hall stays empty for 30 seconds he mends himself.',
    ] });
    WIKI.add('skills', { id: 'giant_rocks', name: 'Giant rocks', lines: [
      'In the King\'s Deep some rocks are giants: 2 by 2 tiles of mithril, or 3 by 3 of stormstone. They have soaked up so much heartstone that sometimes they wake up.',
      'GIANT MITHRIL: Mining 22. Each crack pays 2 mithril ore and 110 Mining xp. Three cracks and it falls to rubble; it grows back in 75 seconds.',
      'GIANT STORMSTONE: Mining 30. Each crack pays 2 stormstone ore, 1 coal and 150 Mining xp. Four cracks, and 100 seconds to grow back.',
      'A giant rock that SHAKES, glows red in its cracks and shows two eyes is stirring. Crack it then and a golem climbs out instead of ore: a rock golem (level 24) from mithril, a boulder golem (level 34) from stormstone. Wait, and it settles down.',
      'A rock golem drops 3 to 5 coal and mithril or sunstone. A boulder golem drops 5 to 8 coal, a mithril bar, and stormstone, sunstone or more mithril.',
      'The Heartstone pickaxe cuts heartstone faster, lands more cracks on a giant rock, and shows you its eyes 3 seconds early.',
    ] });
  }

  // =========================================================================
  // 18. THE HANDLE
  // =========================================================================
  window.ROYALMINE = {
    ID: RM_ID, W, H, ROWS, ROCKS, VEINS, BURROWS, FORGES, STATUES, ROCK_SPOTS, HOARD, N, GIANT, DOOR, HALL, ROOMS, PAIRS, PEOPLE, CRACKS, FORGE_SPOTS, GORM_HOME,
    tiles: { stair: ROYAL_STAIR, statue: ROYAL_STATUE, chasm: ROYAL_CHASM, door: HEART_DOOR, forge: HEART_FORGE, vein: HEART_VEIN, giantMithril: GIANT_MITHRIL, giantStorm: GIANT_STORM },
    now, setNow(fn) { nowFn = typeof fn === 'function' ? fn : null; }, get skew() { return skew; }, set skew(v) { skew = +v || 0; },
    litVeins, rocksAt, restless, restlessRaw, mayScript, gorm, arms, fight, slide, thieves: TH, get guest() { return guest; }, set guest(v) { guest = !!v; },
    throwStone, payout, spawnGolemling, wake, applyThrone, checksum, knock, knockReady, stones, rocks, ending, cine, K, TEST, golemOf, rockStage, LOG, h32,
    catchThief, spawnThief, tapCatch, finishSlide, climbUp, rideDown, knightsInHall, remotesOn, crumble, onFall, worldHook, drawHud: drawRoyalHud, actionSeat,
    drawStatue, drawGorm, cineBusy, cineFlush,
    state: () => ({ inside: inside(), inDeep: inDeep(), stage: R().stage, arms: { ...arms }, guest, slide: { on: slide.on, t: slide.t }, thieves: TH.list.length, fall: fight.fallSeen, knocks: fight.knocks, lings: monsters.filter(m => m.type === 'golemling' && !m.dead).length }),
  };

  // =========================================================================
  // 19. SELF-TEST — every check restores the quest, Deepholm's throne, the instance, the wire, the clock,
  // the pack and the levels it touched, so the rest of the suite (and 58-underground on the next run) sees
  // a closed throne and a knight on the surface.
  // =========================================================================
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'royal: ';
    if (!window.INSTANCES || !DH || !INSTANCES.get(RM_ID)) { check(P + 'the royal mine needs Deepholm and the instance system', false, {}); return; }
    const clone = o => (o === undefined || o === null) ? o : JSON.parse(JSON.stringify(o));
    const S0 = { royal: clone(quest.royal), dwarf: clone(quest.dwarf), tracked: quest.tracked, untracked: quest.untrackedByPlayer, inv: player.inv.map(s => s ? { ...s } : null),
      bank: (player.bank || []).map(s => ({ ...s })), keyring: (player.keyring || []).slice(), skills: clone(player.skills), equip: { ...player.equip }, hp: player.hp,
      kid: window.__kidmode, touch: window.__forceTouch, stick: window.__stickRight, nowFn, random: Math.random, deathKeep: clone(deathKeep), px: player.x, py: player.y,
      kills: player.kills, bed: player.bedSpawn, deaths: player.deaths, test: { ...TEST }, peace: window.__peace, dq: dialog.queue.slice(), dc: dialog.cur };
    const netWas = window.NET ? { enabled: NET.enabled, token: NET.token, fake: NET.fake } : null;
    const sizeW = Object.getOwnPropertyDescriptor(window, 'innerWidth'), sizeH = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    const lv = (sk, n) => { player.skills[sk].xp = XP_TABLE[n]; };
    const out = () => { let k = 0; while (INSTANCES.active() && k++ < 4) INSTANCES.leave(); };
    const fresh = over => { quest.royal = Object.assign({ stage: 0, caught: 0, door: false, falls: 0, best: 0, payouts: 0, seenHow: true, seenRestless: true, seenWake: true, seenGiant: true }, over || {}); };
    const drainD = () => { dialog.queue.length = 0; dialog.cur = null; };
    const secs = s => F.sim(Math.round(s * 60), []);
    const intoRoyal = () => { out(); INSTANCES.enter(RM_ID); F.step([]); return INSTANCES.active() === RM_ID; };
    const intoDeep = () => { out(); DH.enter(); F.step([]); return inDeep(); };
    const tie = ms => { const t0 = time; nowFn = () => ms + (time - t0) * 1000; };
    const freeze = ms => { nowFn = () => ms; };
    const emptyPack = () => { player.inv = player.inv.map(() => null); addItem('mithril_pickaxe', 1); };
    const say0 = () => LOG.length;
    const floated = text => floaters.some(f => f.text === text);
    const tapWorld = (wx, wy) => { render(); const sx = wx - cam.x, sy = wy - cam.y; pointerDown(sx, sy, 'mouse'); pointerUp('mouse'); return [sx, sy]; };
    const pickMon = type => monsters.filter(m => m.type === type && !m.dead);
    const unring = id => { for (let k = 0; k < 5 && countItem(id) > 0; k++) removeItem(id, countItem(id)); };
    // an honest clock: the first time in a window of `ms` where fn(window) says yes
    const findTime = (fn, win, from) => { for (let k = (from || 1000); k < (from || 1000) + 4000; k++) if (fn(k)) return k * win + 1; return null; };
    // a recording context: what a panel or chip paints, in words and in where it lands (13-ux's canvas swallows everything)
    const recorder = () => {
      const log = { text: [], at: [] }; let m = [1, 0, 0, 1, 0, 0]; const stack = [];
      const ap = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
      const mul = n => { m = [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; };
      return new Proxy({}, {
        get: (t, k) => {
          if (k === '__log') return log;
          if (k === 'measureText') return s => ({ width: String(s).length * 6 });
          if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: () => { } });
          if (k === 'save') return () => stack.push(m.slice());
          if (k === 'restore') return () => { const s = stack.pop(); if (s) m = s; };
          if (k === 'translate') return (x, y) => mul([1, 0, 0, 1, x, y]);
          if (k === 'scale') return (x, y) => mul([x, 0, 0, y, 0, 0]);
          if (k === 'rotate') return a => mul([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
          if (k === 'setTransform') return (a, b, c, d, e, f) => { m = [a, b, c, d, e, f]; };
          if (k === 'fillText' || k === 'strokeText') return s => log.text.push(String(s));
          if (k === 'fillRect') return (x, y, w, hh2) => log.at.push(['rect', ...ap(x + w / 2, y + hh2 / 2)]);
          if (k === 'arc' || k === 'ellipse') return (x, y) => log.at.push([k, ...ap(x, y)]);
          return typeof k === 'string' ? () => { } : undefined;
        },
        set: () => true,
      });
    };
    // the wire, faked: we are Cohen; Ann is a friend who may be keeper, or stand in the hall
    let sent = [], sock = null;
    const push = msg => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(msg) }); };
    const goOnline = () => {
      sent = []; NET.enabled = true; NET.token = 'royal-test';
      NET.useFake({ call: async () => ({}), open: () => { sock = { readyState: 1, send(str) { const m = JSON.parse(str); sent.push(m); if (m.t === 'hello') push({ t: 'welcome', me: 'Cohen', at: Date.now(), keeper: 'Cohen' }); }, close() { sock.readyState = 3; } }; return sock; } });
      NET.connect(); return NET.online();
    };
    const goOffline = () => {
      if (!netWas) return;
      NET.disconnect(); NET.fake = netWas.fake; NET.enabled = netWas.enabled; NET.token = netWas.token; NET.status = 'off'; NET.me = null;
      if (window.COOP) COOP.reset();
      if (window.PLAYERS && PLAYERS.remote && typeof PLAYERS.remote === 'object') delete PLAYERS.remote.Ann;
    };
    const ann = (x, y, act) => push({ t: 'p', n: 'Ann', map: RM_ID, region: "The King's Deep", x: Math.round(x), y: Math.round(y), fx: 0, fy: 1, mv: false, wt: 0, hp: 25, mhp: 25, lv: 12, look: null, mech: null, dead: false, def: 576, act: act || null });
    const keeper = n => push({ t: 'keeper', map: RM_ID, n });
    const monRow = (m, dead) => [m.nid || 'i0', m.type, Math.round(m.x), Math.round(m.y), dead ? 0 : m.hp, m.maxHp, 'idle', 0, 1, 0, 0, dead ? 1 : 0, 0, 0];
    h.peace(true); out(); closePanel(); drainD();
    const bag = () => player.inv.filter(Boolean).map(s => s.id);
    try {
      player.inv = new Array(INV_SLOTS).fill(null); addItem('mithril_pickaxe', 1); addItem('iron_sword', 1); player.equip.weapon = 'iron_sword';
      unring('heartstone_chip'); unring('crownheart');
      TEST.noLings = true; TEST.noRocks = true;

      // ---- 1. the instance ----
      { const inst = INSTANCES.get(RM_ID);
        const rowsOk = ROWS.length === 44 && ROWS.every(r => r.length === 56);
        const sum1 = checksum(), sum2 = checksum();
        const inR = intoRoyal(), stair = tileAt(27, 2) === ROYAL_STAIR, entry = !SOLID.has(tileAt(27, 3)) && tileAt(27, 3) === T.COBBLE, atEntry = Math.floor(player.x / TILE) === 27 && Math.floor(player.y / TILE) === 3;
        const gal = window.LIGHTS ? LIGHTS.sample(tc(27), tc(6), { knight: false }) : { alpha: 1 };
        intoDeep(); const forgeHall = window.LIGHTS ? LIGHTS.sample(tc(14), tc(13), { knight: false }) : { alpha: 0 }; out();
        check(P + "the King's Deep is a 56 x 44 instance built from its rows (the same every build), the Stair of Kings at (27,2), you arrive on the flagstones at (27,3), lamplit, and the Gallery is lighter than Deepholm's forge hall",
          inst.w === 56 && inst.h === 44 && rowsOk && sum1 === sum2 && inR && stair && entry && atEntry && INSTANCE_LIGHT.of(RM_ID) === 'lamplit' && LIGHTS.scenes().includes(RM_ID) && gal.alpha < forgeHall.alpha,
          { w: inst.w, h: inst.h, rowsOk, sums: [sum1, sum2], inR, stair, entry, atEntry, mode: INSTANCE_LIGHT.of(RM_ID), gallery: gal.alpha, forgeHall: forgeHall.alpha }); }

      // ---- 2. everything can be walked to; the hall is shut until the door opens ----
      { const inst = INSTANCES.get(RM_ID), tiles = inst.tiles;
        const bfs = open => { const d = new Int32Array(W * H).fill(-1), q = [ENTRY[1] * W + ENTRY[0]]; d[q[0]] = 0;
          for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (d[n] >= 0) continue; const t = tiles[n]; if (SOLID.has(t) && !(open && t === HEART_DOOR)) continue; d[n] = d[c] + 1; q.push(n); } }
          return d; };
        const open = bfs(true), shut = bfs(false);
        const touches = (d, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && d[ny * W + nx] >= 0; });
        const want = new Set([ROYAL_STATUE, DW_LAMP, DW_MITHRIL, T.IRON, T.COAL, T_SUN, T_STORM, T.FORGE, T.ANVIL, DW_CHEST, HEART_VEIN, HEART_FORGE, ROYAL_STAIR]);
        const bad = []; let walk = 0, lost = 0, hallShut = 0, hallTiles = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const t = tiles[y * W + x];
          if (want.has(t) && !touches(open, x, y)) bad.push(tileName(t) + '@' + x + ',' + y);
          if (!SOLID.has(t) || t === HEART_DOOR) { walk++; if (open[y * W + x] < 0) lost++; if (inRect(HALL, x, y)) { hallTiles++; if (shut[y * W + x] < 0) hallShut++; } }
        }
        for (const r of ROCKS) { let ok = false; for (let y = r.y; y < r.y + r.size; y++) for (let x = r.x; x < r.x + r.size; x++) if (touches(open, x, y)) ok = true; if (!ok) bad.push('giant rock ' + r.i); }
        for (const [x, y] of BURROWS.concat([GORM_HOME])) if (open[y * W + x] < 0) bad.push('floor ' + x + ',' + y);
        let shutUse = 0; for (const [x, y] of FORGES.concat(VEINS)) if (!touches(shut, x, y)) shutUse++;
        check(P + `every statue, lamp, ore, giant rock, station, chest, vein and forge is walkable from the stair; with the door shut all ${hallTiles} floor tiles of Gorm's hall and its ${shutUse} forges and veins are cut off; the door approach is 61 steps, Gorm 68`,
          bad.length === 0 && lost === 0 && hallShut === hallTiles && hallTiles === 273 && shutUse === 8 && open[32 * W + 27] === 61 && open[39 * W + 27] === 68,
          { unreachable: bad.slice(0, 6), lostWithDoorOpen: lost, hallTiles, hallShutOff: hallShut, forgesAndVeinsShut: shutUse, toDoor: open[32 * W + 27], toGorm: open[39 * W + 27] }); }

      // ---- 3. the knocking starts on the way IN to Deepholm, once the forge is lit ----
      { drainD(); quest.dwarf = { stage: 1, chests: [], visited: true }; fresh({ stage: 0 });
        intoDeep(); F.sim(2, []); const none = R().stage === 0; out();
        quest.dwarf.stage = 2; drainD(); const s0 = say0(); intoDeep(); F.sim(2, []);
        const started = R().stage === 1 && LOG.slice(s0).some(l => l === 'The Voice: The floor of Deepholm shakes. Dust falls from the roof.');
        out(); quest.dwarf.stage = 1; fresh({ stage: 0 }); intoDeep(); F.sim(2, []); quest.dwarf.stage = 2; F.sim(90, []);
        const notInside = R().stage === 0; out();
        check(P + 'the knocking starts on the frame you enter Deepholm with the great forge lit (stage 1 and the Voice), not before the forge, and not while you are already inside',
          none && started && notInside, { beforeTheForge: none, onEntry: started, alreadyInside: notInside, stage: R().stage }); drainD(); }

      // ---- 4. the first two talks ----
      const talkThrain = () => { F.tp(14, 22); player.facing = { x: 0, y: 1 }; closePanel(); F.press('KeyE'); F.sim(2, []); };
      const talkBrun = () => { F.tp(13, 11); F.face(12, 11); closePanel(); F.press('KeyE'); F.sim(2, []); };
      { quest.dwarf = { stage: 2, chests: [], visited: true }; fresh({ stage: 1 }); intoDeep(); applyThrone(); drainD();
        let s0 = say0(); talkThrain(); const t1 = R().stage === 2 && LOG[s0] === 'King Thrain: Knocking? The mountain is old. Old things creak.';
        s0 = say0(); talkBrun(); const b1 = R().stage === 3 && LOG[s0] === 'Brunhild the smith: Three knocks, then quiet, then three more? That is a golem\'s knock.' && TH.list.length >= 1 && panel === 'shop';
        closePanel(); clearThieves();
        // before the forge is lit the dwarves are 24-dwarves' own
        for (const id of ['coal', 'iron_bar']) removeItem(id, countItem(id));
        quest.dwarf.stage = 1; fresh({ stage: 1 }); drainD(); s0 = say0(); talkThrain();
        const orig = !!dialog.cur && dialog.cur.who === 'King Thrain' && /Five coal and three iron bars/.test(dialog.cur.text) && R().stage === 1 && LOG.length === s0;
        quest.dwarf.stage = 0; drainD(); talkThrain(); const orig0 = !!dialog.cur && /knight of the surface/.test(dialog.cur.text) && R().stage === 1;
        check(P + 'Thrain at stage 1 says it is nothing (stage 2); Brunhild at stage 2 knows the knock, a pebble thief runs and her shop opens (stage 3); before the forge is lit both say what 24-dwarves says',
          t1 && b1 && orig && orig0, { thrain: t1, brunhild: b1, beforeForge: orig, dwarfStage0: orig0, said: LOG.slice(-3) });
        out(); drainD(); closePanel(); }

      // ---- 5. the pebble thieves: caught by a swing, by E and by a tap; one that escapes is replaced ----
      { quest.dwarf = { stage: 2, chests: [], visited: true }; fresh({ stage: 3, caught: 0 }); intoDeep(); drainD(); clearThieves();
        const coal0 = countItem('coal');
        const place = (tx, ty) => { const t = spawnThief(); t.x = tc(tx); t.y = tc(ty); t.nibbleT = 999; return t; };
        let th = place(14, 13); F.tp(14, 13); player.x = th.x - 26; player.facing = { x: 1, y: 0 }; player.attackCd = 0; F.press('Space'); F.step([]);
        const bySwing = R().caught === 1 && !TH.list.includes(th) && TH.lastHow === 'swing';
        clearThieves(); th = place(14, 14); F.tp(14, 14); player.x = th.x; player.y = th.y - 34; player.facing = { x: 0, y: 1 }; closePanel(); F.press('KeyE'); F.step([]);
        const byE = R().caught === 2 && TH.lastHow === 'use';
        // one that reaches a crack dives down it, and another comes within four seconds
        clearThieves(); const run = spawnThief(); run.i = run.path.length - 1; const last = run.path[run.path.length - 1]; run.x = tc(last[0]) - 3; run.y = tc(last[1]); run.nibbleT = 0; run.sinceNibble = 0;
        F.tp(14, 14); let s = 0; while (TH.list.includes(run) && s++ < 60) F.step([]);
        const gone = !TH.list.includes(run); s = 0; while (!TH.list.length && s++ < 260) F.step([]);
        const replaced = gone && TH.list.length === 1 && s <= Math.ceil(4.1 * 60) && TH.list[0] !== run;
        clearThieves(); const coalMid = countItem('coal');
        th = place(14, 16); F.tp(14, 12); tapWorld(th.x, th.y); s = 0; while (TH.list.includes(th) && s++ < 400) F.step([]);
        const byTap = TH.lastHow === 'tap' && R().stage === 4 && R().caught === 3;
        const chip = countItem('heartstone_chip') === 1 && KEYRING.held('heartstone_chip') && !player.inv.some(x => x && x.id === 'heartstone_chip');
        check(P + 'pebble thieves are caught by a swing, by E and by a tap (a coal each); one that reaches a crack is replaced within 4 s; the third leaves the heartstone chip on the keyring (no pack slot) and stage 4',
          bySwing && byE && replaced && byTap && chip && coalMid >= coal0 + 2, { bySwing, byE, escaped: gone, replacedIn: s, byTap, chip, coal: countItem('coal') - coal0, stage: R().stage });
        out(); drainD(); }

      // ---- 6. the turn: the throne grinds aside, Thrain stands, the crownheart ----
      { quest.dwarf = { stage: 2, chests: [], visited: true }; fresh({ stage: 4, caught: 3 }); unring('crownheart'); if (!KEYRING.held('heartstone_chip')) KEYRING.add('heartstone_chip');
        intoDeep(); drainD(); const s0 = say0();
        talkThrain();
        let n = 0; while (!slide.on && n++ < 2000) { if (dialog.cur) advanceDialog(); F.step([]); }
        slide.t = 1.0; const midX = slide.x();
        n = 0; while (slide.on && n++ < 200) F.step([]);
        const th = thrain();
        const tiles = tileAt(14, 23) === ROYAL_STAIR && tileAt(16, 23) === DW_THRONE, tp = Math.abs(th.px - tc(11)) < 0.01 && Math.abs(th.py - tc(23)) < 0.01 && th.x === 14 && th.y === 23;
        const stage5 = R().stage === 5;
        n = 0; while ((cineBusy() || dialog.cur || dialog.queue.length) && n++ < 3000) { if (dialog.cur) advanceDialog(); F.step([]); }
        const lines = LOG.slice(s0).filter(l => l.startsWith('King Thrain: ')).map(l => l.slice(13));
        const inOrder = TURN.every((l, i) => lines[i] === l) && lines.length === 16;
        const crown = KEYRING.held('crownheart') && countItem('crownheart') === 1 && countItem('heartstone_chip') === 0;
        check(P + 'the turn: sixteen lines in order; halfway through the slide the throne is at x 15; at 2.0 s the stair is at (14,23), the throne at (16,23), Thrain stands at (11,23) (his home tile still 14,23), the chip became the crownheart, stage 5',
          Math.abs(midX - 15) <= 0.2 && tiles && tp && stage5 && inOrder && crown, { midX: +midX.toFixed(3), tiles, thrainMoved: tp, stage5, lines: lines.length, firstBad: TURN.findIndex((l, i) => lines[i] !== l), crown }); }

      // ---- 7. the throne stays moved: out and back in, and through a save; a new game closes it ----
      { const again = () => { out(); DH.enter(); F.step([]); return tileAt(14, 23) === ROYAL_STAIR && tileAt(16, 23) === DW_THRONE; };
        const reentry = again(); out(); save(); load(); const afterLoad = again();
        out(); const q = clone(quest.royal); royalReset(); DH.enter(); F.step([]);
        const closed = tileAt(14, 23) === DW_THRONE && tileAt(16, 23) === T.CAVE && thrain().px === tc(14) && thrain().py === tc(23);
        out(); quest.royal = q;
        check(P + 'the moved throne is put back where the quest says on every entry: still moved after going out and back in and after a save and load; a new game closes it (the throne on 14,23 that 58-underground walks to)',
          reentry && afterLoad && closed, { reentry, afterLoad, newGameClosed: closed }); }

      // ---- 8. the Stair of Kings ----
      { fresh({ stage: 5 }); quest.dwarf = { stage: 2, chests: [], visited: true };
        intoDeep(); drainD(); const s0 = say0(); F.tp(14, 22); player.facing = { x: 0, y: 1 }; F.press('KeyE'); F.sim(3, []);
        const down = INSTANCES.active() === RM_ID, noTalk = !LOG.slice(s0).some(l => l.startsWith('King Thrain')) && !(dialog.cur && dialog.cur.who === 'King Thrain');
        F.tp(27, 3); player.facing = { x: 0, y: -1 }; F.press('KeyE'); F.sim(3, []);
        const upByStair = inDeep() && Math.floor(player.x / TILE) === 14 && Math.floor(player.y / TILE) === 22;
        F.tp(14, 22); player.facing = { x: 0, y: 1 }; F.press('KeyE'); F.sim(3, []); const down2 = INSTANCES.active() === RM_ID;
        F.press('KeyL'); F.sim(3, []);
        const upByL = inDeep() && Math.floor(player.x / TILE) === 14 && Math.floor(player.y / TILE) === 22;
        check(P + 'E on the stair from (14,22) facing south goes down into the King\'s Deep without opening Thrain\'s talk; the stair up and L both bring you back to (14,22)',
          down && noTalk && upByStair && down2 && upByL, { down, noTalk, upByStair, down2, upByL, at: [Math.floor(player.x / TILE), Math.floor(player.y / TILE)] });
        out(); drainD(); }

      // ---- 9. ordinary ore in the royal mine, and no square of grass under it ----
      { fresh({ stage: 6, door: true }); intoRoyal(); lv('mining', 40); emptyPack();
        const mineAt = (rx, ry, sx, sy, id) => { F.tp(sx, sy); F.face(rx, ry); const n0 = countItem(id), x0 = player.skills.mining.xp; F.press('KeyE'); const r = F.untilAction(1500, () => countItem(id) > n0 || drops.some(d => d.id === id)); player.action = null; return { got: typeof r === 'number', xp: player.skills.mining.xp - x0 }; };
        const mi = mineAt(2, 24, 3, 24, 'mithril_ore'), st = mineAt(52, 24, 51, 24, 'stormstone_ore'), co = mineAt(40, 30, 41, 30, 'coal');
        let inside1 = null; const probe = () => { inside1 = TEX_NAME[T.COAL]; };
        HOOKS.draw.push(probe); render(); HOOKS.draw.splice(HOOKS.draw.indexOf(probe), 1);
        out(); render(); const outside = TEX_NAME[T.COAL];
        check(P + "mithril, stormstone and coal mine in the King's Deep (mithril 80 xp by 24-dwarves' own handler); while it draws, coal and the other ores sit on the mine's floor texture, and outside it they are grass again",
          mi.got && mi.xp === 80 && st.got && co.got && inside1 === 'cave' && outside === 'grass', { mithril: mi, stormstone: st, coal: co, texInside: inside1, texOutside: outside }); }

      // ---- 10 and 11. giant rocks: a calm clock pays ore crack by crack, then rubble and a regrow each tile ----
      const calm = i => findTime(k => h32(i + 1, k) >= GIANT[ROCKS[i].tile].restless, N.RESTLESS_WINDOW);
      const loud = i => findTime(k => h32(i + 1, k) < GIANT[ROCKS[i].tile].restless, N.RESTLESS_WINDOW);
      const crackAll = (r, sx, sy, fx, fy, id) => {
        const got = []; F.tp(sx, sy); F.face(fx, fy);
        for (let c = 0; c < GIANT[r.tile].cracks; c++) {
          const n0 = countItem(id) + drops.filter(d => d.id === id).reduce((a, d) => a + d.qty, 0), x0 = player.skills.mining.xp, co0 = countItem('coal');
          if (!player.action) { F.face(fx, fy); F.press('KeyE'); }
          const s = F.untilAction(2400, () => player.skills.mining.xp > x0);
          got.push({ s, ore: countItem(id) + drops.filter(d => d.id === id).reduce((a, d) => a + d.qty, 0) - n0, xp: player.skills.mining.xp - x0, coal: countItem('coal') - co0 });
        }
        player.action = null; return got;
      };
      { fresh({ stage: 6, door: true }); intoRoyal(); emptyPack(); const r = ROCKS[0];
        freeze(calm(0)); lv('mining', 21); F.tp(7, 15); F.face(7, 14); notice = null; F.press('KeyE'); F.sim(2, []);
        const refused = !player.action && !!notice && notice.text === 'You need Mining level 22 for this giant mithril rock.';
        lv('mining', 22); const got = crackAll(r, 7, 15, 7, 14, 'mithril_ore');
        const rub = [[7, 13], [8, 13], [7, 14], [8, 14]].every(([x, y]) => tileAt(x, y) === T.RUBBLE);
        const rg = regrow.filter(e => e.t === GIANT_MITHRIL && e.timer > 70 && e.timer <= 75 && [[7, 13], [8, 13], [7, 14], [8, 14]].some(([x, y]) => e.i === idx(x, y)));
        const pays = got.length === 3 && got.every(o => o.ore === 2 && o.xp === 110);
        // a tap on the rock walks up beside it
        for (const [x, y] of [[7, 13], [8, 13], [7, 14], [8, 14]]) changeTile(x, y, GIANT_MITHRIL); regrow = regrow.filter(e => e.t !== GIANT_MITHRIL); rockStage[0] = 0;
        F.tp(10, 17); F.step([]); tapWorld(tc(8), tc(13)); const tapped = tap.kind === 'use' && !!player.walkPath; let s = 0; while (player.walkPath && player.walkPath.length && s++ < 300) F.step([]);
        const beside = Math.max(Math.abs(Math.floor(player.x / TILE) - 7.5), Math.abs(Math.floor(player.y / TILE) - 13.5)) <= 1.5; tapCancel('manual'); player.action = null;
        check(P + 'giant mithril (2x2): refused at Mining 21 with the core notice; at 22 on a calm clock three cracks pay 2 mithril ore and 110 xp each, then all four tiles are rubble with a 75 s regrow each; a tap on it walks you beside it',
          refused && pays && rub && rg.length === 4 && tapped && beside, { refused, notice: notice && notice.text, got, rubble: rub, regrows: rg.length, tapped, beside }); }
      { fresh({ stage: 6, door: true }); intoRoyal(); emptyPack(); const r = ROCKS[5];
        freeze(calm(5)); lv('mining', 30); const got = crackAll(r, 45, 24, 46, 24, 'stormstone_ore');
        let rub = 0; for (let y = 23; y <= 25; y++) for (let x = 46; x <= 48; x++) if (tileAt(x, y) === T.RUBBLE) rub++;
        const pays = got.length === 4 && got.every(o => o.ore === 2 && o.coal === 1 && o.xp === 150);
        F.tp(40, 28); const path = tapPathTo(43, 28, true); const end = path && path.length ? path[path.length - 1] : null;
        const nextTo = !!end && ROCKS[6] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const x = end[0] + dx, y = end[1] + dy; return x >= 42 && x <= 44 && y >= 27 && y <= 29; });
        check(P + 'giant stormstone (3x3): four cracks pay 2 stormstone ore, 1 coal and 150 xp each and all nine tiles fall to rubble; a tap on its middle tile (43,28) is walked to the side of it you can reach',
          pays && rub === 9 && nextTo, { got, rubble: rub, pathEnd: end, nextTo }); }

      // ---- 12. restless rocks wake a golem instead of paying out, and only where it may spawn ----
      { fresh({ stage: 6, door: true, seenWake: true }); intoRoyal(); emptyPack(); lv('mining', 30);
        const T0 = loud(0); freeze(T0);
        const R0 = Math.random; Math.random = () => 0.01;
        F.tp(7, 15); F.face(7, 14); const ore0 = countItem('mithril_ore'); floaters.length = 0; F.press('KeyE'); F.untilAction(300, () => pickMon('rock_golem').length > 0 || !player.action);
        Math.random = R0;
        const woke = pickMon('rock_golem').length === 1 && countItem('mithril_ore') === ore0 && !player.action && floated('A ROCK GOLEM WAKES!');
        const g1 = pickMon('rock_golem')[0], besideRock = !!g1 && rectDistTiles(ROCKS[0], g1.x, g1.y) < 1.6;
        monsters = monsters.filter(m => m.type !== 'rock_golem'); for (const k in golemOf) delete golemOf[k]; for (const k in quietUntil) delete quietUntil[k];
        freeze(calm(0)); Math.random = () => 0.01; F.tp(7, 15); F.face(7, 14); F.press('KeyE'); F.untilAction(300, () => countItem('mithril_ore') > ore0); player.action = null; Math.random = R0;
        const calmOk = pickMon('rock_golem').length === 0 && countItem('mithril_ore') === ore0 + 2;
        rockStage[0] = 0;
        // online, as somebody else's guest on this map: the crack is seen, the golem is the keeper's to make
        let nonKeeper = false, remoteWake = false;
        if (window.NET && window.COOP) {
          out(); goOnline(); intoRoyal(); keeper('Ann'); F.step([]);
          freeze(T0); Math.random = () => 0.01; F.tp(7, 15); F.face(7, 14); F.press('KeyE'); F.untilAction(300, () => !player.action); Math.random = R0;
          nonKeeper = !monsters.some(m => m.type === 'rock_golem') && monsters.every(m => m.remote);
          goOffline(); goOnline(); intoRoyal(); keeper('Cohen'); F.step([]);
          freeze(T0); player.x = tc(20); player.y = tc(15);
          const ax = tc(9) + 6, ay = tc(14);
          for (let k = 0; k < 80; k++) { if (k % 8 === 0) ann(ax, ay, 'mine'); F.step([]); }
          remoteWake = pickMon('rock_golem').length === 1 && COOP.isKeeper();
          monsters = monsters.filter(m => m.type !== 'rock_golem'); goOffline();
        }
        check(P + 'a crack on a restless giant rock pays no ore, wakes exactly one rock golem beside it and stops the swing; on a calm clock it never does; online a guest spawns nothing, and the keeper wakes one for a friend who mines a restless rock for 1.3 s',
          woke && besideRock && calmOk && nonKeeper && remoteWake, { woke, besideRock, calmOk, nonKeeper, remoteWake });
        out(); }

      // ---- 13. golems: their drops are real items; the dead are cleared and never come back ----
      { const ids = []; for (const t of ['rock_golem', 'boulder_golem', 'golemling', 'gorm']) { const d = MONSTER_DEFS[t].drops || {}; for (const r of (d.always || []).concat(d.table || [])) ids.push(r[0]); }
        const allReal = ids.every(id => ITEMS[id]) && HOARD.always.concat(HOARD.table, HOARD.rare.table).every(r => ITEMS[r[0]]);
        fresh({ stage: 6, door: true }); intoRoyal(); const m = spawnGolem(0, player); m.hp = 1; F.tp(10, 15); killMonster(m); F.sim(100, []);
        const cleared = !monsters.includes(m); F.sim(300, []); const never = !monsters.some(o => o.type === 'rock_golem');
        check(P + 'every golem drop and every item in Gorm\'s rubble is a real item; a dead golem is cleared after 1.5 s and never respawns', allReal && cleared && never, { allReal, cleared, never });
        out(); }

      // ---- 14. the Heart Door ----
      { fresh({ stage: 5, door: false }); unring('crownheart');
        intoRoyal(); F.tp(27, 32); player.facing = { x: 0, y: 1 }; notice = null; F.press('KeyE'); F.sim(90, []);
        const shut = DOOR.every(([x, y]) => tileAt(x, y) === HEART_DOOR) && !!notice && notice.text === 'A round door of red stone, with a heart-shaped hole in the middle. It will not move.';
        KEYRING.add('crownheart'); F.press('KeyE'); F.sim(80, []);
        const opened = DOOR.every(([x, y]) => tileAt(x, y) === T.COBBLE) && R().stage === 6 && R().door === true;
        out(); intoRoyal(); const stays = DOOR.every(([x, y]) => tileAt(x, y) === T.COBBLE);
        let guestOpen = false;
        if (window.NET) {
          out(); unring('crownheart'); fresh({ stage: 2, door: false });
          goOnline(); intoRoyal(); keeper('Cohen'); ann(tc(30), tc(20)); F.step([]);
          F.tp(27, 32); player.facing = { x: 0, y: 1 }; notice = null; F.press('KeyE'); F.sim(80, []);
          guestOpen = DOOR.every(([x, y]) => tileAt(x, y) === T.COBBLE) && R().stage === 2 && !R().door;
          goOffline();
        }
        check(P + 'the Heart Door will not move without the crownheart (the exact notice); with it, it grinds open to flagstones and stage 6, and stays open next time; a guest whose friend is down here gets through without it, stage unchanged',
          shut && opened && stays && guestOpen, { shut, notice: notice && notice.text, opened, stays, guestOpen });
        out(); }

      // ---- 15. no sword works; a stone does, and online a stone is the only hit sent ----
      { fresh({ stage: 6, door: true }); intoRoyal(); const gm = gorm(); F.tp(27, 36); arms.warm = 0; arms.raw = 0;
        const hp0 = gm.hp, mx0 = player.skills.melee.xp; floaters.length = 0;
        player.x = gm.x; player.y = gm.y + 70; player.facing = { x: 0, y: -1 }; player.attackCd = 0; F.press('Space'); F.step([]);
        explode(gm.x, gm.y, 64, 6, 14, 'player'); hitMonster(gm, 7, 8); hitMonster(gm, 6, 14, false, 'companion');
        const immune = gm.hp === hp0 && player.skills.melee.xp === mx0 && floated('CLANG');
        hitMonster(gm, 80, 0, true, 'stone'); const stoneHit = gm.hp === hp0 - 80;
        let silent = false, stoneSent = false;
        if (window.NET && window.COOP) {
          out(); goOnline(); intoRoyal(); keeper('Ann'); const gx = tc(27), gy = tc(39);
          push({ t: 'mon', n: 'Ann', list: [['i0', 'gorm', gx, gy, 1200, 1200, 'idle', 0, 1, 0, 0, 0, 0, 0]] }); F.step([]);
          const pg = gorm(); sent = [];
          player.x = gx; player.y = gy + 70; player.facing = { x: 0, y: -1 }; player.attackCd = 0; arms.warm = 0; F.press('Space'); F.step([]);
          silent = !!pg && pg.remote && !sent.some(m => m.t === 'hit');
          arms.warm = 1; fight.throwCd = 0; throwStone(); F.sim(30, []);
          const hits = sent.filter(m => m.t === 'hit');
          stoneSent = hits.length === 1 && hits[0].nid === 'i0' && hits[0].dmg === fight.lastThrowDmg && hits[0].bomb === true && hits[0].knock === 0;
          goOffline();
        }
        check(P + 'a sword, a bomb, an arrow and a companion leave Gorm untouched (0 melee xp, CLANG); a stone takes exactly its damage; online a sword on puppet Gorm sends nothing and a throw sends one hit with bomb:true',
          immune && stoneHit && silent && stoneSent, { immune, hp: gm.hp, stoneHit, silent, stoneSent });
        out(); }

      // ---- 16. the veins ----
      { const T0 = 40000 * 20000 + 1000; const same = JSON.stringify(litVeins(T0)) === JSON.stringify(litVeins(T0 + 18000)), next = JSON.stringify(litVeins(T0)) !== JSON.stringify(litVeins(T0 + 20000));
        let neverRepeats = true; for (let w = 40000; w < 40300; w++) if (JSON.stringify(litVeins(w * 20000)) === JSON.stringify(litVeins((w + 1) * 20000))) neverRepeats = false;
        fresh({ stage: 6, door: true }); intoRoyal(); emptyPack(); lv('mining', 20); freeze(T0); arms.raw = 0; arms.warm = 0;
        const [v] = litVeins(T0), dark = [0, 1, 2, 3, 4, 5].find(k => !litVeins(T0).includes(k));
        const stand = k => { const [x, y] = VEINS[k]; const s = [[1, 0], [-1, 0], [0, -1], [0, 1]].map(([dx, dy]) => [x + dx, y + dy]).find(([a, b]) => !SOLID.has(tileAt(a, b))); F.tp(s[0], s[1]); F.face(x, y); };
        stand(v); const x0 = player.skills.mining.xp; F.press('KeyE'); F.untilAction(200, () => arms.raw >= 1);
        const one = arms.raw === 1 && player.skills.mining.xp - x0 === 45;
        F.untilAction(400, () => arms.raw >= 3); player.action = null;
        notice = null; F.press('KeyE'); F.step([]); const fourth = !player.action && arms.raw === 3 && !!notice && /taken all this vein/.test(notice.text);
        stand(dark); notice = null; F.press('KeyE'); F.step([]); const darkNo = !player.action && !!notice && /gone dark/.test(notice.text);
        const T1 = T0 + 20000; freeze(T1); const [v2] = litVeins(T1); arms.raw = 5; stand(v2); notice = null; F.press('KeyE'); F.step([]);
        const full = !player.action && !!notice && /arms are full/.test(notice.text);
        arms.raw = 0; lv('mining', 19); notice = null; F.press('KeyE'); F.step([]); const low = !player.action && !!notice && notice.text === 'You need Mining level 20 to cut heartstone.';
        window.__kidmode = true; lv('mining', 9); notice = null; F.press('KeyE'); F.step([]); const kidLow = !player.action && !!notice && notice.text === 'You need Mining level 10 to cut heartstone.';
        lv('mining', 10); F.press('KeyE'); const kidOk = !!player.action && player.action.type === 'heartvein'; player.action = null; window.__kidmode = S0.kid;
        check(P + 'two veins glow per 20 s window (the same pair all window, a new pair the next, never the same twice running); a lit vein gives a raw stone and 45 Mining xp a swing, three a window; a dark vein, a fourth stone, a sixth in your arms and Mining 19 (9 in kid mode) are refused',
          same && next && neverRepeats && one && fourth && darkNo && full && low && kidLow && kidOk, { same, next, neverRepeats, one, fourth, darkNo, full, low, kidLow, kidOk });
        arms.raw = 0; out(); }

      // ---- 17. the heart forge ----
      { fresh({ stage: 6, door: true }); intoRoyal(); lv('smithing', 20); arms.raw = 2; arms.warm = 0;
        F.tp(22, 36); F.face(22, 35); const x0 = player.skills.smithing.xp; F.press('KeyE');
        const s1 = F.untilAction(200, () => arms.warm >= 1), s2 = F.untilAction(200, () => arms.warm >= 2);
        const warmed = arms.raw === 0 && arms.warm === 2 && player.skills.smithing.xp - x0 === 80 && s1 >= 55 && s1 <= 64 && s2 >= 55 && s2 <= 64;
        arms.raw = 1; arms.warm = 0; lv('smithing', 19); notice = null; F.press('KeyE'); F.step([]);
        const low = !player.action && !!notice && notice.text === 'You need Smithing level 20 to warm a heartstone.';
        check(P + 'the heart forge warms one raw stone a second for 40 Smithing xp each; Smithing 19 is refused', warmed && low, { warmed, frames: [s1, s2], xp: player.skills.smithing.xp - x0, low });
        arms.raw = 0; arms.warm = 0; out(); }

      // ---- 18. throwing: Z, the THROW button, a swing facing him, a tap on him ----
      { fresh({ stage: 6, door: true }); intoRoyal(); const gm = gorm(); lv('smithing', 20);
        const results = [];
        const tryOne = how => {
          gm.hp = gm.maxHp = 1200; gm.dead = false; fight.throwCd = 0; arms.warm = 1; arms.raw = 0;
          player.x = gm.x; player.y = gm.y - 4 * TILE; player.facing = { x: 0, y: 1 }; player.attackCd = 0; F.step([]);
          const hp0 = gm.hp; how(); const thrown = arms.warm === 0 && stones.length === 1; F.sim(36, []);
          const dmg = hp0 - gm.hp; results.push({ thrown, dmg }); return thrown && dmg >= N.THROW_MIN && dmg <= N.THROW_MAX;
        };
        const byZ = tryOne(() => F.press('KeyZ'));
        const byBtn = tryOne(() => { window.__forceTouch = true; F.step([]); render(); F.clickButton('THROW'); window.__forceTouch = S0.touch; });
        const bySwing = tryOne(() => F.press('Space'));
        const byTap = tryOne(() => { render(); tapAt(gm.x - cam.x, gm.y - 60 - cam.y); });
        arms.warm = 1; player.x = gm.x; player.y = gm.y - 9 * TILE; fight.throwCd = 0; notice = null; throwStone(); const far = arms.warm === 1 && !!notice && notice.text === 'Too far. Get closer to Gorm.';
        arms.warm = 0; notice = null; F.press('KeyZ'); const none = !!notice && notice.text === 'You have no warm heartstones. Mine a vein, then warm it at the forge.';
        check(P + 'Z, the THROW button, a swing facing Gorm and a tap on him each throw exactly one warm stone that hits for 70-90 within 0.6 s; at 9 tiles it is too far; with nothing warm you are told what to do',
          byZ && byBtn && bySwing && byTap && far && none, { byZ, byBtn, bySwing, byTap, results, far, none });
        out(); }

      // ---- 19. the little golems ----
      { TEST.noLings = false; fresh({ stage: 6, door: true }); intoRoyal(); const gm = gorm(); F.tp(27, 36); K.lingT = 0; F.step([]);
        const firstIn = F.untilAction(Math.ceil(12.5 * 60), () => pickMon('golemling').length > 0);
        monsters = monsters.filter(m => m.type !== 'golemling');
        let maxSeen = 0; for (let k = 0; k < 4; k++) spawnGolemling(k); for (let k = 0; k < 600; k++) { F.step([]); maxSeen = Math.max(maxSeen, pickMon('golemling').length); }
        monsters = monsters.filter(m => m.type !== 'golemling');
        gm.hp = 1000; const l1 = spawnGolemling(0); l1.x = gm.x + 40; l1.y = gm.y + 10; F.step([]); const mended = gm.hp === 1080 && !monsters.includes(l1);
        window.__kidmode = true; gm.hp = 1000; const l2 = spawnGolemling(1); l2.x = gm.x - 40; l2.y = gm.y + 10; F.step([]); const kidMend = gm.hp === 1040; window.__kidmode = S0.kid;
        gm.hp = 1000; const l3 = spawnGolemling(2); l3.hp = 1; hitMonster(l3, 5, 0); F.step([]); const smashed = l3.dead && gm.hp === 1000;
        let two = 'skipped', guestNone = false;
        if (window.NET && window.COOP) {
          out(); goOnline(); intoRoyal(); keeper('Cohen'); F.tp(27, 36); ann(tc(20), tc(38)); K.lingT = 0; F.step([]);
          let k = 0; for (; k < Math.ceil(9.5 * 60) && !pickMon('golemling').length; k++) { if (k % 30 === 0) ann(tc(20), tc(38)); F.step([]); }
          two = pickMon('golemling').length > 0 ? k : 'none';
          goOffline(); goOnline(); intoRoyal(); keeper('Ann'); F.tp(27, 36); F.step([]);
          F.sim(30 * 60, []);
          guestNone = !monsters.some(m => m.type === 'golemling') && monsters.every(m => m.remote);
          goOffline();
        }
        TEST.noLings = true;
        check(P + 'a little golem crawls out within 12.5 s alone (9.5 s with a friend in the hall), never more than 4 at once; one that reaches Gorm mends him 80 (40 in kid mode) and is gone; a smashed one mends nothing; a guest\'s game spawns none of its own',
          typeof firstIn === 'number' && maxSeen <= 4 && mended && kidMend && smashed && typeof two === 'number' && guestNone, { firstIn, maxSeen, mended, kidMend, smashed, withFriend: two, guestNone });
        out(); }

      // ---- 20. falling rocks ----
      { fresh({ stage: 6, door: true }); intoRoyal(); h.peace(false); TEST.noRocks = false; window.__kidmode = false;
        const W0 = 30000 * N.ROCK_WINDOW;
        const same = JSON.stringify(rocksAt(W0 + 10)) === JSON.stringify(rocksAt(W0 + 4400));
        const clearOf = (x, y, t) => rocksAt(t).every(([a, b]) => Math.hypot(a - x, b - y) > 2);
        let spot = null; for (const [x, y] of ROCK_SPOTS) if (clearOf(x, y, W0 + 10) && clearOf(x + 2, y, W0 + 10) && !SOLID.has(tileAt(x + 2, y)) && Math.hypot(x - 27, y - 39) > 4 && Math.hypot(x + 2 - 27, y - 39) > 4) { spot = [x, y]; break; }
        const at = W0 - 50; tie(at); F.tp(spot[0], spot[1]); rocks.win = null; player.hp = player.maxHp; F.sim(4, []);
        const hp0 = player.hp; F.sim(86, []); const early = player.hp === hp0; F.sim(8, []);
        const hitStill = player.hp < hp0 && fight.lastRockDmg >= 9 && fight.lastRockDmg <= 14;
        const W1 = W0 + N.ROCK_WINDOW; tie(W1 - 50); fight.lastRockDmg = 0; player.hp = player.maxHp; F.sim(6, []); F.tp(spot[0] + 2, spot[1]); const hp1 = player.hp; F.sim(100, []);
        const dodged = player.hp >= hp1 && fight.lastRockDmg === 0;
        window.__kidmode = true; const W2 = W0 + 2 * N.ROCK_WINDOW; tie(W2 - 50); F.tp(spot[0], spot[1]); fight.lastRockDmg = 0; player.hp = player.maxHp; F.sim(4, []);
        F.sim(96, []); const kidWait = fight.lastRockDmg === 0; F.sim(40, []); const kidHit = fight.lastRockDmg >= 4 && fight.lastRockDmg <= 7;
        window.__kidmode = S0.kid; TEST.noRocks = true; h.peace(true); player.hp = player.maxHp;
        check(P + 'rocks fall on the same spots for everyone in a 4.5 s window; a knight standing in a shadow is hit for 9-14 when it lands at 1.5 s; two tiles away costs nothing; in kid mode the shadow warns for 2.2 s and hits for 4-7',
          same && !!spot && early && hitStill && dodged && kidWait && kidHit, { same, spot, early, hitStill, dmg: fight.lastRockDmg, dodged, kidWait, kidHit });
        out(); }

      // ---- 21. scaling, the empty-hall mend, re-forming ----
      { let scaled = 'skipped';
        if (window.NET && window.COOP) {
          goOnline(); fresh({ stage: 6, door: true }); intoRoyal(); keeper('Cohen'); F.tp(27, 36); ann(tc(20), tc(38)); F.sim(4, []);
          const gm = gorm(); scaled = gm.maxHp === 1800 && gm.hp === 1800; goOffline(); out();
        }
        fresh({ stage: 6, door: true }); intoRoyal(); const gm = gorm(); F.tp(27, 31); gm.hp = 500; F.sim(Math.ceil(30.5 * 60), []); const healed = gm.hp === gm.maxHp;
        F.tp(27, 36); hitMonster(gm, gm.hp, 0, true, 'stone'); F.step([]); F.tp(27, 31); F.sim(Math.ceil(44 * 60), []); const stillDown = gm.dead; F.sim(Math.ceil(1.5 * 60), []);
        const reformed = !gm.dead && gm.hp === gm.maxHp;
        check(P + 'with a friend in the hall a fresh Gorm has 1800 health; 30 s with the hall empty mends him to full; 45 s after he falls he re-forms at full health',
          scaled === true && healed && stillDown && reformed, { scaled, healed, stillDown, reformed });
        out(); }

      // ---- 22. the fall, the payout, the pickaxe ----
      { fresh({ stage: 6, door: true, payouts: 0 }); intoRoyal(); emptyPack(); const gm = gorm(); F.tp(27, 35); drops = [];
        const have = id => countItem(id) + drops.filter(d => d.id === id).reduce((a, d) => a + d.qty, 0);
        const R0 = Math.random;
        Math.random = () => 0.5;
        const c0 = have('coins'), coal0 = have('coal'), mx0 = player.skills.mining.xp, sx0 = player.skills.smithing.xp, f0 = R().falls;
        gm.hp = 40; arms.warm = 1; fight.throwCd = 0; player.x = gm.x; player.y = gm.y - 4 * TILE; F.step([]); throwStone(); F.sim(36, []); F.sim(30, []);
        const coins1 = have('coins') - c0, coal1 = have('coal') - coal0;
        const paid1 = gm.dead && coins1 >= 400 && coins1 <= 700 && coal1 >= 8 && coal1 <= 14 && player.skills.mining.xp - mx0 === 300 + 0 && player.skills.smithing.xp - sx0 === 300 && R().falls === f0 + 1 && R().payouts === 1;
        F.sim(60, []); const once = R().payouts === 1 && R().falls === f0 + 1;
        // a new life: three little golems smashed and no stone thrown still earns a share
        const revive = () => { gm.dead = false; gm.hp = gm.maxHp; gm.deadT = 0; F.step([]); F.step([]); };
        revive(); fight.smashed = 3; fight.landed = 0; hitMonster(gm, gm.hp, 0, true, 'stone'); F.step([]); const paid2 = R().payouts === 2;
        revive(); fight.smashed = 0; fight.landed = 0; notice = null; hitMonster(gm, gm.hp, 0, true, 'stone'); F.step([]);
        const unpaid = R().payouts === 2 && !!notice && notice.text === 'You did not help this time. Throw a stone or smash three little golems to earn a share.';
        Math.random = () => 0.001; levelBanner = null; const got = payout(); const rare = got.some(d => d.id === 'heartstone_pickaxe') && !!levelBanner && levelBanner.text === 'RARE DROP';
        drops = drops.filter(d => d.id !== 'heartstone_pickaxe'); removeItem('heartstone_pickaxe', countItem('heartstone_pickaxe'));
        Math.random = () => 0.99; R().payouts = 5; const none = !payout().some(d => d.id === 'heartstone_pickaxe');
        R().payouts = 29; levelBanner = null; const pity = payout().some(d => d.id === 'heartstone_pickaxe') && R().payouts === 30 && !!levelBanner && levelBanner.text === 'RARE DROP';
        Math.random = R0;
        drops = drops.filter(d => d.id !== 'heartstone_pickaxe'); removeItem('heartstone_pickaxe', countItem('heartstone_pickaxe'));
        // online: a puppet seen dead with 0 hp is one fall; a puppet that only went missing is none
        let puppetOnce = false, goneNone = false;
        if (window.NET && window.COOP) {
          out(); goOnline(); intoRoyal(); keeper('Ann'); fight.landed = 1; F.tp(27, 35);
          const row = (hp, dead) => ['i0', 'gorm', tc(27), tc(39), hp, 1200, 'idle', 0, 1, 0, 0, dead ? 1 : 0, 0, 0];
          push({ t: 'mon', n: 'Ann', list: [row(1200, false)] }); F.step([]);
          const f1 = R().falls; push({ t: 'mon', n: 'Ann', list: [row(0, true)] }); F.step([]); push({ t: 'mon', n: 'Ann', list: [row(0, true)] }); F.step([]); F.step([]);
          puppetOnce = R().falls === f1 + 1;
          push({ t: 'mon', n: 'Ann', list: [row(1200, false)] }); F.step([]); const f2 = R().falls;
          F.sim(80, []); goneNone = R().falls === f2 && fight.fallSeen === false;
          goOffline();
        }
        check(P + 'Gorm falls once per life: a knight who landed a stone gets 400-700 coins, 8-14 coal, 300 Mining and 300 Smithing xp, once; three little golems smashed also earns it; neither earns the notice; 1 in 25 is the Heartstone pickaxe with RARE DROP, and the 30th share guarantees it; a dead puppet is one fall, a missing one none',
          paid1 && once && paid2 && unpaid && rare && none && pity && puppetOnce && goneNone && ITEMS.heartstone_pickaxe.tier === 3,
          { paid1, coins: coins1, coal: coal1, once, paid2, unpaid, rare, none, pity, puppetOnce, goneNone, tier: ITEMS.heartstone_pickaxe.tier });
        out(); }

      // ---- 23. the ending ----
      { fresh({ stage: 6, door: true, falls: 1, best: 90 }); intoRoyal(); const gm = gorm(); F.tp(27, 35); drainD();
        hitMonster(gm, gm.hp, 0, true, 'stone'); F.step([]);
        const fallsBanner = !!levelBanner && levelBanner.text === 'GORM FALLS';
        const c0 = countItem('coins'), mx0 = player.skills.mining.xp, sx0 = player.skills.smithing.xp, s0 = say0();
        let clicks = 0; for (let k = 0; k < 3; k++) { render(); if (F.clickButton('KNOCK')) clicks++; F.step([]); }
        let sawDone = false, n = 0; while ((cineBusy() || dialog.cur || dialog.queue.length) && n++ < 4000) { if (dialog.cur) advanceDialog(); F.step([]); if (levelBanner && levelBanner.text === 'QUEST COMPLETE') sawDone = true; }
        F.sim(10, []);
        const lines = LOG.slice(s0);
        const want = ['Gorm: Knock... knock... knock.', 'The Voice: Three knocks, like the old rule. Gorm\'s eyes open, soft as embers.', 'Gorm: King... calls... Gorm... home?', 'King Thrain: I do, old friend. I am sorry it took me a hundred years. Rest now.', 'Gorm: Gorm... rests.',
          'King Thrain: Thank you, knight. The royal mine is open again. Come and dig whenever you like.', 'King Thrain: Gorm will wake again when the mountain\'s heart beats. He likes a game. Bring your friends.'];
        const inOrder = want.every((l, i) => lines[i] === l);
        const done = R().stage === 7 && sawDone && player.skills.mining.xp - mx0 === 1200 && player.skills.smithing.xp - sx0 === 1200 && countItem('coins') - c0 === 800;
        const rec = recorder(); drawStatue(rec, STATUES[5], true);
        const x0 = 32 * TILE, x1 = 33 * TILE, y0 = 8 * TILE;
        const plinth = rec.__log.at.some(([k, x, y]) => k === 'rect' && x >= x0 && x <= x1 && y >= y0 && y <= y0 + TILE);
        const figure = rec.__log.at.filter(([k, x, y]) => (k === 'arc' || k === 'ellipse') && x >= x0 && x <= x1 && y >= y0 - 30 && y <= y0 + 30).length >= 3;
        const bram = tapPeople().some(p => p.id === 'bram') && tapPeople().some(p => p.id === 'sigrun');
        out(); const gone = !tapPeople().some(p => p.id === 'bram' || p.id === 'sigrun');
        check(P + 'the ending: with Gorm down at stage 6, three KNOCKs bring the seven lines in order, QUEST COMPLETE, +1200 Mining, +1200 Smithing, +800 coins and stage 7; the knight\'s statue is painted on the plinth at (32,8); Bram and Sigrun stand in the mine, and only there',
          fallsBanner && clicks === 3 && inOrder && done && plinth && figure && bram && gone, { fallsBanner, clicks, inOrder, firstBad: want.findIndex((l, i) => lines[i] !== l), done, stage: R().stage, plinth, figure, bram, gone }); }

      // ---- 24. your arms empty when you leave the hall, fall, or leave the mine ----
      { fresh({ stage: 6, door: true }); intoRoyal(); F.tp(27, 36); F.step([]); arms.raw = 1; arms.warm = 1; notice = null;
        F.tp(27, 31); F.step([]); const leftHall = carried() === 0 && !!notice && /crumble to red dust/.test(notice.text);
        F.tp(27, 36); F.step([]); arms.raw = 2; const dk = deathKeep; player.bedSpawn = null; hurtPlayer(player.hp + 999, player.x + 10, player.y, true); F.step([]); const died = carried() === 0;
        F.sim(200, []); player.hp = player.maxHp; deathKeep = dk;
        intoRoyal(); F.tp(27, 36); F.step([]); arms.warm = 2; out(); const leftMine = carried() === 0;
        const neverPacked = !player.inv.some(s => s && /heartstone$|^raw_heart|^warm_heart/.test(s.id));
        check(P + 'your stones crumble to red dust when you leave Gorm\'s hall, when you fall, and when you leave the mine; they are never in the pack', leftHall && died && leftMine && neverPacked, { leftHall, died, leftMine, neverPacked });
        out(); }

      // ---- 25. the iPad ----
      { const usable = [ROYAL_STAIR, ROYAL_STATUE, HEART_DOOR, HEART_FORGE, HEART_VEIN, GIANT_MITHRIL, GIANT_STORM].every(t => INTERESTING_TILES.has(t));
        fresh({ stage: 6, door: true }); intoRoyal(); F.tp(27, 36); F.step([]); window.__forceTouch = true; arms.raw = 1; arms.warm = 1; closePanel();
        const nb = buttons.length, text = []; let rec = recorder(); HUD.leftY = 200; HUD.leftCol = 0; drawRoyalHud(rec); text.push(...rec.__log.text); buttons.length = nb;
        const chip = ['MINE', 'WARM', 'THROW', 'HEARTSTONES'].every(w => text.some(t => t.includes(w)));
        const throwBtn = text.includes('THROW');
        const gm = gorm(); gm.hp = 0; gm.dead = true; fight.fallSeen = true; fight.downAt = time; R().stage = 6;
        rec = recorder(); HUD.leftY = 200; drawRoyalHud(rec); const knockBtn = rec.__log.text.includes('KNOCK'); buttons.length = nb;
        rec = recorder(); HOOKS.panel.royal_howto(rec, false); const card = rec.__log.text.includes('HOW TO PLAY') && rec.__log.text.includes('GOT IT') && rec.__log.text.some(t => t.startsWith('1. MINE')); buttons.length = nb;
        // on a 768 x 1024 iPad the THROW button sits clear of the stick, USE, CHAT and the boss bar
        gm.dead = false; gm.hp = gm.maxHp; fight.fallSeen = false; fight.downAt = null;
        const netE = window.NET ? NET.enabled : false; if (window.NET) NET.enabled = true;
        try { window.innerWidth = 768; window.innerHeight = 1024; } catch (e) { }
        render();
        const find = l => buttons.find(b => b.label === l);
        const thr = find('THROW'), use = find('USE'), chat = find('CHAT');
        const over = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        const stick = { x: 50, y: VH - 170, w: 120, h: 120 };
        const boss = { x: HK.colX(0), y: HUD_LAYOUT.bossBarY, w: HK.colW(), h: 20 + HK.meterH() };
        const clear = !!thr && thr.w >= 44 && thr.h >= 44 && !over(thr, stick) && !over(thr, use) && !over(thr, chat) && !over(thr, boss) && thr.x + thr.w <= VW && thr.y + thr.h <= VH;
        if (window.NET) NET.enabled = netE;
        if (sizeW) Object.defineProperty(window, 'innerWidth', sizeW); else { try { delete window.innerWidth; } catch (e) { } }
        if (sizeH) Object.defineProperty(window, 'innerHeight', sizeH); else { try { delete window.innerHeight; } catch (e) { } }
        window.__forceTouch = S0.touch; render();
        check(P + 'on the iPad: every new tile worth using is tappable; the chip paints MINE, WARM, THROW and HEARTSTONES; THROW and KNOCK and the HOW TO PLAY card with GOT IT paint; on 768 x 1024 THROW is finger-sized and clear of the stick, USE, CHAT and the boss bar',
          usable && chip && throwBtn && knockBtn && card && clear, { usable, chip, throwBtn, knockBtn, card, clear, thr: thr && [thr.x, thr.y, thr.w, thr.h], use: use && [use.x, use.y], chat: chat && [chat.x, chat.y] });
        arms.raw = 0; arms.warm = 0; out(); }

      // ---- 26. the audits ----
      { const a = window.ICONS ? ICONS.audit() : { missing: [], duplicates: [] };
        const ours = ['heartstone_chip', 'crownheart', 'heartstone_pickaxe'];
        const icons = ours.every(id => !a.missing.includes(id)) && !a.duplicates.some(([x, y]) => ours.includes(x) || ours.includes(y)) && ICONS.rarity('heartstone_pickaxe') === 'unique';
        const mons = ['rock_golem', 'boulder_golem', 'golemling', 'gorm'].every(t => typeof HOOKS.drawMonster[t] === 'function' && !!WIKI.get('monsters', t));
        const S = PLAYTHROUGH.sources(), has = (sk, name) => (S[sk] || []).some(r => r.name === name);
        const declared = has('mining', 'giant mithril rock (a crack)') && has('mining', 'giant stormstone rock (a crack)') && has('mining', 'heartstone vein (Gorm)') && has('smithing', 'warm a heartstone (Gorm)')
          && has('mining', 'Gorm put to sleep (bonus)') && has('smithing', 'Gorm put to sleep (bonus)') && has('melee', 'little golem') && has('melee', 'rock golem (woken)') && has('melee', 'boulder golem (woken)')
          && has('mining', "The King's Knock (once)") && has('smithing', "The King's Knock (once)");
        const p = PLAYTHROUGH.progression();
        const g22 = p.rows.find(r => r.skill === 'mining' && r.lv === 22 && /giant mithril/.test(r.what)), g30 = p.rows.find(r => r.skill === 'mining' && r.lv === 30 && /giant stormstone/.test(r.what));
        const gates = !!g22 && !!g30 && !g22.dead && !g30.dead && !p.rows.some(r => r.dead && r.kind !== 'cape');
        const ic = PLAYTHROUGH.instanceConnectivity(), icBad = ic.filter(r => r.dist < 0);
        out(); const sum = () => { let s = 0; for (let i = 0; i < map.length; i++) s = (Math.imul(s, 31) + map[i]) | 0; return s; };
        const before = sum(); worldHook(); const same = sum() === before;
        const wiki = !!WIKI.get('places', 'the_king_s_deep') && !!WIKI.get('quests', 'royal') && !!WIKI.get('skills', 'gorm') && !!WIKI.get('skills', 'giant_rocks');
        check(P + 'audits: the three new items each draw their own icon (the pickaxe is unique); the four new monsters each have a drawing and a wiki page; every XP source is declared; Mining 22 and 30 are gates with sources; every instance connects; the world hook leaves the overworld untouched; the book has the place, the quest and Gorm\'s hall',
          icons && mons && declared && gates && icBad.length === 0 && same && wiki, { icons, missing: a.missing.filter(id => ours.includes(id)), mons, declared, gates, g22: g22 && g22.best, g30: g30 && g30.best, instanceGaps: icBad.map(r => r.instance + ':' + r.name), sameOverworld: same, wiki }); }
    } catch (e) {
      check(P + 'the royal mine suite ran to the end without throwing', false, { error: String(e && e.stack || e).slice(0, 400) });
    } finally {
      Math.random = S0.random; nowFn = S0.nowFn;
      if (window.NET && NET.online()) goOffline();
      if (netWas) { NET.fake = netWas.fake; NET.enabled = netWas.enabled; NET.token = netWas.token; }
      out(); closePanel(); tapCancel('manual');
      closeAll(); monsters = monsters.filter(m => !SPAWNED.has(m.type));
      quest.royal = S0.royal === undefined ? undefined : S0.royal; if (quest.royal === undefined) delete quest.royal;
      if (S0.dwarf === undefined) delete quest.dwarf; else quest.dwarf = S0.dwarf;
      quest.tracked = S0.tracked; quest.untrackedByPlayer = S0.untracked;
      player.inv = S0.inv; player.bank = S0.bank; player.keyring = S0.keyring; if (window.KEYRING) KEYRING.absorb();
      player.skills = S0.skills; player.equip = S0.equip; recomputeMaxHp(); player.hp = Math.min(player.maxHp, Math.max(1, S0.hp)); player.dead = false;
      window.__kidmode = S0.kid; window.__forceTouch = S0.touch; window.__stickRight = S0.stick; deathKeep = S0.deathKeep; player.kills = S0.kills; player.bedSpawn = S0.bed; player.deaths = S0.deaths;
      Object.assign(TEST, S0.test); arms.raw = 0; arms.warm = 0; stones.length = 0; noteQ.length = 0; bannerQ.length = 0;
      player.x = S0.px; player.y = S0.py; player.action = null;
      dialog.queue.length = 0; dialog.queue.push(...S0.dq); dialog.cur = S0.dc; levelBanner = null;
      h.peace(S0.peace || false); render();
    }
  });
}
