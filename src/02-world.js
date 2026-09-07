// ============================================================================
// WORLD: regions, buildings, NPCs, spawns, map generation
// ============================================================================
const map = new Uint8Array(MAP_W * MAP_H);
const variant = new Uint8Array(MAP_W * MAP_H);
const idx = (tx, ty) => ty * MAP_W + tx;
const inMap = (tx, ty) => tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
const tileAt = (tx, ty) => inMap(tx, ty) ? map[idx(tx, ty)] : T.WALL;
const setTile = (tx, ty, t) => { if (inMap(tx, ty)) map[idx(tx, ty)] = t; };
const tc = v => (v + 0.5) * TILE; // tile → pixel centre

const SPAWN = { x: tc(4), y: tc(7) };
const SWORD_POS = { x: tc(11), y: tc(7) };
const SIGN_TILE = { x: 65, y: 27 };
const VILLAGE = { x0: 85, y0: 14, x1: 140, y1: 56, name: 'Thistledown' };
const VILLAGE_SPAWN = { x: tc(112), y: tc(33) };
const CASTLE = { x: 104, y: 42, w: 18, h: 13 };
const REGIONS = [
  { name: 'The Cave', sub: 'Where you woke', x0: 0, y0: 0, x1: 20, y1: 15 },
  { name: 'Castle Thistledown', sub: "Seat of Duke Ferrin", x0: CASTLE.x, y0: CASTLE.y, x1: CASTLE.x + CASTLE.w - 1, y1: CASTLE.y + CASTLE.h - 1 },
  { name: 'Thistledown', sub: 'A village that still stands', x0: 85, y0: 14, x1: 140, y1: 56 },
  { name: 'Grey Quarry', sub: 'Iron and coal in the rock', x0: 46, y0: 1, x1: 62, y1: 14 },
  { name: "Miller's Pond", sub: 'Shrimp, and trout for the patient', x0: 36, y0: 30, x1: 50, y1: 44 },
  { name: 'Goblin Camp', sub: 'Their machines are here', x0: 140, y0: 18, x1: 159, y1: 42 },
  { name: 'Wolfwood', sub: 'Keep to the paths', x0: 0, y0: 62, x1: 159, y1: 95 },
  { name: 'Goblin Fields', sub: 'The road east', x0: 21, y0: 0, x1: 159, y1: 61 },
];
const regionAt = (tx, ty) => REGIONS.find(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) || REGIONS[REGIONS.length - 1];

// buildings: door on the bottom wall at x+door (or top wall at x+doorTop). f = furniture [tile, rx, ry] inside.
const BUILDINGS = [
  { id: 'store', x: 90, y: 20, w: 7, h: 6, name: 'General Store', roof: '#7a3b2e', sign: 'STORE', door: 3, f: [[T.COUNTER, 1, 2], [T.COUNTER, 2, 2], [T.COUNTER, 3, 2], [T.SHELF, 1, 1], [T.SHELF, 2, 1], [T.SHELF, 4, 1], [T.SHELF, 5, 1]] },
  { id: 'bank', x: 99, y: 20, w: 8, h: 6, name: 'Bank of Thistledown', roof: '#3b4a7a', sign: 'BANK', door: 3, f: [[T.COUNTER, 1, 2], [T.COUNTER, 2, 2], [T.COUNTER, 3, 2], [T.COUNTER, 4, 2], [T.COUNTER, 5, 2], [T.CHEST, 1, 1], [T.CHEST, 6, 1], [T.RUG, 3, 3], [T.RUG, 4, 3]] },
  { id: 'bakery', x: 122, y: 20, w: 6, h: 6, name: 'Bakery', roof: '#8a6a2e', sign: 'BAKERY', door: 2, f: [[T.OVEN, 1, 1], [T.OVEN, 2, 1], [T.COUNTER, 1, 3], [T.COUNTER, 2, 3], [T.TABLE, 4, 2]] },
  { id: 'smithy', x: 90, y: 36, w: 7, h: 6, name: 'Smithy', roof: '#4a4a52', sign: 'SMITHY', door: 3, f: [[T.FORGE, 1, 1], [T.FORGE, 2, 1], [T.ANVIL, 4, 2], [T.COUNTER, 5, 3], [T.SHELF, 5, 1]] },
  { id: 'workshop', x: 99, y: 36, w: 7, h: 6, name: "Tinker's Workshop", roof: '#5a4a3a', sign: 'TINKER', door: 3, f: [[T.WORKBENCH, 1, 1], [T.WORKSHOP, 3, 1], [T.ALCHEMY, 5, 1], [T.SHELF, 5, 3], [T.TABLE, 1, 3]] },
  { id: 'inn', x: 122, y: 44, w: 8, h: 6, name: 'The Barrel & Boar', roof: '#6a3a2a', sign: 'INN', door: 3, f: [[T.COUNTER, 1, 1], [T.COUNTER, 2, 1], [T.TABLE, 4, 2], [T.TABLE, 6, 2], [T.TABLE, 4, 4], [T.BED, 6, 4], [T.RUG, 3, 3]] },
  { id: 'keep', x: 108, y: 46, w: 10, h: 7, name: 'The Keep', roof: '#5a2e7a', sign: 'KEEP', doorTop: 4, stone: true, f: [[T.THRONE, 4, 4], [T.RUG, 4, 2], [T.RUG, 4, 3], [T.TABLE, 1, 4], [T.TABLE, 8, 4], [T.SHELF, 1, 1], [T.SHELF, 8, 1]] },
  { id: 'death1', x: 25, y: 10, w: 6, h: 5, name: "Death's House", roof: '#2a2a33', sign: 'REST', door: 2, stone: true, coffin: true, f: [[T.GOLDPILE, 1, 1], [T.GOLDPILE, 4, 1], [T.GOLDPILE, 4, 2], [T.CHEST, 1, 2]] },
  { id: 'death2', x: 133, y: 48, w: 6, h: 5, name: "Death's House", roof: '#2a2a33', sign: 'REST', door: 2, stone: true, coffin: true, f: [[T.GOLDPILE, 1, 1], [T.GOLDPILE, 4, 1], [T.GOLDPILE, 4, 2], [T.CHEST, 1, 2]] },
  { id: 'hermit', x: 28, y: 76, w: 5, h: 5, name: "Wren's Hut", roof: '#4a5a3a', door: 2, f: [[T.BED, 1, 1], [T.TABLE, 3, 1], [T.SHELF, 3, 2]] },
  { id: 'h1', x: 130, y: 20, w: 5, h: 5, name: 'House', roof: '#6a4a3a', door: 2, f: [[T.BED, 1, 1], [T.TABLE, 3, 2]] },
  { id: 'h2', x: 88, y: 28, w: 4, h: 4, name: 'House', roof: '#4a5a3a', door: 1, f: [[T.BED, 1, 1]] },
  { id: 'h3', x: 94, y: 28, w: 4, h: 4, name: 'House', roof: '#6a4a3a', door: 1, f: [[T.TABLE, 1, 1]] },
  { id: 'h4', x: 124, y: 27, w: 4, h: 4, name: 'House', roof: '#5a4a5a', door: 1, f: [[T.BED, 1, 1]] },
  { id: 'h5', x: 130, y: 27, w: 5, h: 4, name: 'House', roof: '#6a4a3a', door: 2, f: [[T.BED, 1, 1], [T.SHELF, 3, 1]] },
  { id: 'h6', x: 92, y: 46, w: 4, h: 4, name: 'House', roof: '#4a5a3a', door: 1, f: [[T.TABLE, 1, 1]] },
  { id: 'h7', x: 98, y: 46, w: 4, h: 4, name: 'House', roof: '#6a4a3a', door: 1, f: [[T.BED, 1, 1]] },
  { id: 'h8', x: 134, y: 36, w: 5, h: 4, name: 'House', roof: '#5a4a5a', door: 2, f: [[T.BED, 1, 1], [T.TABLE, 3, 1]] },
  { id: 'h9', x: 126, y: 36, w: 4, h: 4, name: 'House', roof: '#4a5a3a', door: 1, f: [[T.SHELF, 1, 1]] },
];
const buildingAt = (tx, ty) => BUILDINGS.find(b => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h);
const insideBuilding = (tx, ty) => { const b = buildingAt(tx, ty); return b && tx > b.x && tx < b.x + b.w - 1 && ty > b.y && ty < b.y + b.h - 1 ? b : null; };

const DUMMIES = [[88, 42], [88, 44]];
const STALLS = [{ x: 108, y: 28, npc: 'greta' }, { x: 116, y: 28, npc: 'fennick' }];
// NPCs: x,y in tiles (centre). wander = walks around near home. lines = chatter.
const NPCS = [
  { id: 'marta', name: 'Marta', x: 92, y: 21, tunic: '#b04a3a', hair: '#3a2a1a', apron: true, role: 'shop', shop: 'general' },
  { id: 'aldous', name: 'Aldous the banker', x: 102, y: 21, tunic: '#2e3b6a', hair: '#d9d0c0', role: 'bank' },
  { id: 'rosalind', name: 'Rosalind', x: 125, y: 22, tunic: '#c89a4a', hair: '#7a3a1a', apron: true, role: 'shop', shop: 'bakery', woman: true },
  { id: 'brakka', name: 'Brakka the smith', x: 93, y: 39, tunic: '#5a4a3a', hair: '#2a1a0a', apron: true, role: 'shop', shop: 'smith', beard: true },
  { id: 'pim', name: 'Pim the tinker', x: 103, y: 39, tunic: '#6a5a8a', hair: '#c9843a', role: 'tinker', woman: true },
  { id: 'dorran', name: 'Dorran the innkeeper', x: 124, y: 46, tunic: '#6a3a2a', hair: '#3a2a1a', apron: true, role: 'inn', beard: true },
  { id: 'duke', name: 'Duke Ferrin', x: 112, y: 49, tunic: '#5a2e7a', hair: '#8a7a6a', crown: true, role: 'duke' },
  { id: 'hale', name: 'Sergeant Hale', x: 86, y: 43, tunic: '#4a4f5a', hair: '#2a1a0a', helmet: true, role: 'trainer' },
  { id: 'tobin', name: 'Tobin', x: 110, y: 33, tunic: '#6a6a4a', hair: '#5a3a1a', role: 'bread' },
  { id: 'greta', name: 'Greta', x: 108, y: 27, tunic: '#4a7a3a', hair: '#e0c080', apron: true, role: 'shop', shop: 'seeds', woman: true },
  { id: 'fennick', name: 'Fennick the trader', x: 116, y: 27, tunic: '#8a6a2a', hair: '#2a1a0a', role: 'trader' },
  { id: 'death1', name: 'Death', x: 27, y: 12, ghost: true, role: 'death' },
  { id: 'death2', name: 'Death', x: 135, y: 50, ghost: true, role: 'death' },
  { id: 'wren', name: 'Old Wren', x: 30, y: 78, tunic: '#5a6a4a', hair: '#d9d0c0', beard: true, role: 'hermit' },
  { id: 'v1', name: 'Ada', x: 100, y: 32, tunic: '#7a4a6a', hair: '#3a2a1a', woman: true, wander: true, role: 'villager', lines: ["Mind the guards' spears, they're sharper than they look.", 'Marta had rods in this morning.', 'The Duke pays for goblin scrap, I hear.'] },
  { id: 'v2', name: 'Bram', x: 118, y: 32, tunic: '#4a6a7a', hair: '#5a3a1a', wander: true, role: 'villager', lines: ['Wolves in the south wood again. Keep to the road.', 'A trap on the road took a goblin clean off its feet last week.', 'Fennick pays full price for pelts.'] },
  { id: 'v3', name: 'Cass', x: 112, y: 24, tunic: '#6a7a4a', hair: '#c9843a', woman: true, wander: true, role: 'villager', lines: ["Rosalind's pies. That's all I'll say.", 'They say Hollowford burned in a night.', 'Old Wren in the wood knows more than he lets on.'] },
  { id: 'v4', name: 'Dunn', x: 96, y: 33, tunic: '#5a5a5a', hair: '#2a1a0a', wander: true, role: 'villager', lines: ['Brakka can make a sword from a bar if you bring a hammer.', 'The quarry north of the road has coal, if you can dig it.', "Don't fish the pond at dusk. Trust me."] },
  { id: 'v5', name: 'Elsie', x: 128, y: 34, tunic: '#8a5a7a', hair: '#e0c080', woman: true, wander: true, role: 'villager', lines: ['Greta will sell you seed. Potatoes grow anywhere.', "The bank never loses a thing. Aldous counts twice.", 'I saw a goblin barrel walk. Walk!'] },
  { id: 'v6', name: 'Finn', x: 114, y: 40, tunic: '#4a5a8a', hair: '#3a2a1a', wander: true, role: 'villager', lines: ['Sergeant Hale drills at dawn. The dummies never win.', 'A bed and a lodestone and you can call anywhere home.', 'Pim can turn scrap and powder into something loud.'] },
];
for (const n of NPCS) { n.px = tc(n.x); n.py = tc(n.y); n.home = { x: n.px, y: n.py }; n.facing = { x: 0, y: 1 }; n.walkT = 0; n.moving = false; n.wanderT = Math.random() * 3; n.hurtT = 0; n.attackT = 0; n.r = 13; }

const MONSTER_SPAWNS = [];
const spawnList = (type, list) => { for (const [x, y] of list) MONSTER_SPAWNS.push({ type, tx: x, ty: y }); };

function generateWorld() {
  const rnd = mulberry32(WORLD_SEED);
  MONSTER_SPAWNS.length = 0;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const n = Math.sin(x * 0.37) * Math.cos(y * 0.29) + Math.sin((x + y) * 0.13) * 0.6;
    map[idx(x, y)] = n > 0.95 ? T.DIRT : T.GRASS;
    variant[idx(x, y)] = Math.floor(rnd() * 3);
  }
  // ---- the cave ----
  for (let y = 0; y <= 15; y++) for (let x = 0; x <= CAVE_EXIT_X; x++) {
    const border = x === 0 || y === 0 || y === 15 || (x >= 16 && (y < 6 || y > 8));
    setTile(x, y, border ? T.WALL : T.CAVE);
  }
  for (let x = 16; x <= CAVE_EXIT_X; x++) { setTile(x, 5, T.WALL); setTile(x, 9, T.WALL); }
  for (const [px, py] of [[3, 3], [4, 3], [8, 11], [9, 11], [9, 12], [12, 3], [13, 4], [5, 12], [13, 11]]) setTile(px, py, T.WALL);
  // ---- roads ----
  const road = (pts, tile = T.DIRT, width = 1, chance = 0.7) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s], [bx, by] = pts[s + 1]; const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = 0; k <= steps; k++) { const x = Math.round(ax + (bx - ax) * k / steps), y = Math.round(ay + (by - ay) * k / steps);
        for (let dy = -width; dy <= width; dy++) for (let dx = -width; dx <= width; dx++) if (Math.abs(dx) + Math.abs(dy) <= width && rnd() < chance) { const t = tileAt(x + dx, y + dy); if (t === T.GRASS || t === T.DIRT) setTile(x + dx, y + dy, tile); } }
    }
  };
  road([[CAVE_EXIT_X + 1, 7], [SIGN_TILE.x, SIGN_TILE.y], [84, 32]]);
  road([[SIGN_TILE.x, SIGN_TILE.y], [54, 14]], T.DIRT, 0, 0.8); // quarry spur
  road([[84, 32], [84, 60], [60, 70], [31, 76]], T.DIRT, 0, 0.6); // path into Wolfwood
  road([[141, 32], [150, 30]], T.DIRT, 0, 0.8); // east to the camp
  // ---- ponds ----
  for (const [px, py, pr] of [[43, 36, 4.5], [134, 60, 3.2]]) for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const d = dist(x, y, px, py);
    if (d < pr + Math.sin(x * 1.3 + y * 0.7) * 1.2) setTile(x, y, T.WATER);
    else if (d < pr + 2 + Math.sin(x * 0.9 + y * 1.1)) if (tileAt(x, y) !== T.WATER) setTile(x, y, T.SAND);
  }
  // ---- forests, rocks, flowers ----
  const inVillage = (x, y) => x >= VILLAGE.x0 && x <= VILLAGE.x1 && y >= VILLAGE.y0 && y <= VILLAGE.y1;
  const inQuarry = (x, y) => x >= 48 && x <= 60 && y >= 3 && y <= 12;
  const inCamp = (x, y) => x >= 142 && x <= 158 && y >= 20 && y <= 40;
  for (let y = 0; y < MAP_H; y++) for (let x = CAVE_EXIT_X + 1; x < MAP_W; x++) {
    const t = tileAt(x, y);
    if (t !== T.GRASS) continue;
    if (Math.abs(x - SIGN_TILE.x) < 3 && Math.abs(y - SIGN_TILE.y) < 3) continue;
    if (inVillage(x, y) || inCamp(x, y)) continue;
    const r = rnd();
    if (inQuarry(x, y)) { if (r < 0.30) setTile(x, y, T.ROCK); else if (r < 0.42) setTile(x, y, T.IRON); else if (r < 0.48) setTile(x, y, T.COAL); continue; }
    const wolfwood = y >= 62, thicket = (x > 56 && x < 80 && y < 14) || (x > 141 && y > 44);
    const treeChance = wolfwood ? 0.26 : thicket ? 0.22 : 0.07;
    if (r < treeChance) setTile(x, y, rnd() < (wolfwood ? 0.3 : 0.15) ? T.OAK : T.TREE);
    else if (r < treeChance + 0.025) setTile(x, y, rnd() < 0.2 ? T.IRON : T.ROCK);
    else if (r < treeChance + 0.045) setTile(x, y, wolfwood ? T.MUSHROOM : T.FLOWERS);
  }
  for (let x = 0; x < MAP_W; x++) { if (x > CAVE_EXIT_X) setTile(x, 0, T.TREE); setTile(x, MAP_H - 1, T.TREE); }
  for (let y = 0; y < MAP_H; y++) { setTile(MAP_W - 1, y, T.TREE); if (y > 15) setTile(0, y, T.TREE); }
  // ---- landmarks ----
  setTile(SIGN_TILE.x, SIGN_TILE.y, T.SIGN);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) setTile(SIGN_TILE.x + dx, SIGN_TILE.y + dy, T.DIRT);
  setTile(23, 9, T.AXESTUMP); setTile(22, 9, T.GRASS); setTile(24, 9, T.GRASS);
  setTile(54, 13, T.CART); for (let dx = -1; dx <= 1; dx++) setTile(54 + dx, 14, T.DIRT);
  setTile(12, 70, T.GRAVE); // the last knight
  for (const [sx, sy] of [[58, 84], [62, 84], [64, 87], [62, 90], [58, 90], [56, 87]]) setTile(sx, sy, T.STONECIRCLE);
  for (let y = 85; y <= 89; y++) for (let x = 57; x <= 63; x++) if (tileAt(x, y) !== T.STONECIRCLE) setTile(x, y, T.GRASS);
  // ruined watchtower with a chest
  for (let y = 78; y <= 84; y++) for (let x = 92; x <= 98; x++) setTile(x, y, T.GRASS);
  for (const [rx, ry] of [[93, 79], [94, 79], [95, 79], [97, 79], [93, 80], [93, 82], [97, 80], [97, 81], [93, 83], [95, 83], [96, 83], [97, 83]]) setTile(rx, ry, T.CWALL);
  setTile(95, 81, T.CHEST); setTile(94, 81, T.RUBBLE); setTile(96, 82, T.RUBBLE);
  // ---- village ----
  for (let y = VILLAGE.y0; y <= VILLAGE.y1; y++) for (let x = VILLAGE.x0; x <= VILLAGE.x1; x++) if ([T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM].includes(tileAt(x, y))) setTile(x, y, T.GRASS);
  for (let x = VILLAGE.x0; x <= VILLAGE.x1; x++) for (let dy = -1; dy <= 1; dy++) setTile(x, 32 + dy, T.COBBLE); // main street
  for (let y = 16; y <= 41; y++) setTile(112, y, T.COBBLE); for (let y = 16; y <= 41; y++) setTile(111, y, T.COBBLE); // north-south street
  for (let y = 26; y <= 38; y++) for (let x = 104; x <= 120; x++) setTile(x, y, T.COBBLE); // square
  for (let y = 27; y <= 31; y++) for (let x = 97; x <= 99; x++) setTile(x, y, T.DIRT); // lane to smithy row
  for (let y = 27; y <= 31; y++) setTile(126, y, T.DIRT); for (let y = 33; y <= 44; y++) setTile(126, y, T.DIRT); // east lane
  for (let x = 88; x <= 104; x++) setTile(x, 44, T.DIRT); // south lane
  setTile(116, 35, T.FIRE);
  for (let y = 50; y <= 53; y++) for (let x = 126; x <= 132; x++) setTile(x, y, T.SOIL); // allotments
  // village fence + gates
  for (let x = VILLAGE.x0; x <= VILLAGE.x1; x++) { setTile(x, VILLAGE.y0, T.FENCE); setTile(x, VILLAGE.y1, T.FENCE); }
  for (let y = VILLAGE.y0; y <= VILLAGE.y1; y++) { setTile(VILLAGE.x0, y, Math.abs(y - 32) <= 1 ? T.GATE : T.FENCE); setTile(VILLAGE.x1, y, Math.abs(y - 32) <= 1 ? T.GATE : T.FENCE); }
  // castle ring + portcullis + towers (corner CWALL); the keep is a building
  for (let y = CASTLE.y; y < CASTLE.y + CASTLE.h; y++) for (let x = CASTLE.x; x < CASTLE.x + CASTLE.w; x++) {
    const edge = x === CASTLE.x || y === CASTLE.y || x === CASTLE.x + CASTLE.w - 1 || y === CASTLE.y + CASTLE.h - 1;
    setTile(x, y, edge ? T.CWALL : T.COBBLE);
  }
  setTile(111, CASTLE.y, T.PORTCULLIS); setTile(112, CASTLE.y, T.PORTCULLIS);
  // training yard
  for (let y = 40; y <= 46; y++) for (let x = 85; x <= 90; x++) setTile(x, y, (x === 85 || x === 90 || y === 40 || y === 46) ? T.FENCE : T.DIRT);
  setTile(90, 43, T.GATE);
  for (const [dx, dy] of DUMMIES) setTile(dx, dy, T.DUMMY);
  for (const s of STALLS) { setTile(s.x, s.y, T.STALL); setTile(s.x + 1, s.y, T.STALL); }
  // buildings
  for (const b of BUILDINGS) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const edge = x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1;
      setTile(x, y, edge ? (b.stone ? T.CWALL : T.HWALL) : T.FLOOR);
    }
    if (b.door !== undefined) setTile(b.x + b.door, b.y + b.h - 1, b.coffin ? T.COFFINDOOR : T.DOOR);
    if (b.doorTop !== undefined) setTile(b.x + b.doorTop, b.y, T.DOOR);
    for (const [t, rx, ry] of b.f || []) setTile(b.x + rx, b.y + ry, t);
    // a clear step outside the door
    if (b.door !== undefined) { const t = tileAt(b.x + b.door, b.y + b.h); if (SOLID.has(t)) setTile(b.x + b.door, b.y + b.h, T.DIRT); }
  }
  // animal pens west of the village (gates on the road side)
  const pen = (x0, y0, x1, y1, gx, gy) => { for (let x = x0; x <= x1; x++) { setTile(x, y0, T.FENCE); setTile(x, y1, T.FENCE); } for (let y = y0; y <= y1; y++) { setTile(x0, y, T.FENCE); setTile(x1, y, T.FENCE); } for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) setTile(x, y, T.GRASS); setTile(gx, gy, T.GATE); };
  pen(72, 40, 80, 46, 80, 43); pen(72, 14, 80, 21, 80, 17);
  // goblin camp: palisade with a west gap, scrap heaps, a fire
  for (let y = 20; y <= 40; y++) for (let x = 142; x <= 158; x++) { const edge = x === 142 || x === 158 || y === 20 || y === 40; if (edge && !(x === 142 && Math.abs(y - 30) <= 1)) setTile(x, y, T.FENCE); else if (tileAt(x, y) === T.GRASS && rnd() < 0.25) setTile(x, y, T.DIRT); }
  setTile(150, 30, T.FIRE); for (const [px, py] of [[146, 24], [154, 25], [147, 36], [155, 35]]) setTile(px, py, T.PLANK);
  // ---- monsters ----
  spawnList('spider', [[3, 12], [7, 3], [11, 12], [14, 9], [6, 6]]);
  spawnList('goblin', [[27, 3], [34, 10], [27, 14], [40, 14], [40, 8], [47, 20], [52, 28], [58, 22], [55, 34], [62, 30], [48, 44], [66, 18], [72, 26], [60, 52], [100, 60], [116, 60], [40, 54], [30, 44], [70, 50], [80, 8]]);
  spawnList('boar', [[30, 24], [34, 30], [26, 36], [40, 46], [60, 44], [90, 60], [70, 56]]);
  spawnList('sheep', [[74, 42], [77, 44], [76, 41], [79, 43]]);
  spawnList('cow', [[74, 16], [77, 19], [79, 16]]);
  spawnList('guard_m', [[86, 30], [118, 36], [113, 43]]); spawnList('guard_f', [[104, 23], [126, 33], [110, 43]]);
  spawnList('wolf', [[20, 70], [40, 68], [50, 80], [75, 74], [90, 70], [110, 82], [130, 72], [145, 80], [70, 88], [25, 88]]);
  spawnList('sapper', [[146, 26], [154, 34], [150, 38]]); spawnList('brute', [[148, 30], [153, 24], [155, 30]]);
  spawnList('goblin', [[144, 24], [144, 36], [156, 38], [151, 22]]);
  spawnList('walker', [[152, 30]]);
  for (const s of MONSTER_SPAWNS) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const t = tileAt(s.tx + dx, s.ty + dy);
    if ([T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM].includes(t)) setTile(s.tx + dx, s.ty + dy, T.GRASS);
  }
  // NPC tiles walkable
  for (const n of NPCS) if (SOLID.has(tileAt(n.x, n.y))) setTile(n.x, n.y, insideBuilding(n.x, n.y) ? T.FLOOR : T.GRASS);
}
generateWorld();
const isCaveTile = (tx, ty) => tx <= CAVE_EXIT_X && ty <= 15;
const inVillageBounds = (x, y) => x > VILLAGE.x0 * TILE && x < (VILLAGE.x1 + 1) * TILE && y > VILLAGE.y0 * TILE && y < (VILLAGE.y1 + 1) * TILE;
