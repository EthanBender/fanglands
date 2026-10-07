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

// ---------- where things are (the spread spec, §9.1): every position is a read of the Atlas ----------
// A place's own spot, rect, building, person or spawn is written in the OLD map's numbers inside its place's frame
// (ATLAS.frame(id)), so it moves with that place at the spread; open land (the big grounds, the thickets, the wolves'
// wood) is the stretched world (AT_W, rounded to whole tiles where a tile is meant). Named spots are ports, the roads are
// ATLAS.TRACKS. Every reader of these tables (39, 92, 93, 01-atlas's rules, the tests) reads them, never a copy.
const AT_W = ATLAS.world, AT_CAVE = ATLAS.frame('cave'), AT_TD = ATLAS.frame('thistledown'), AT_QUARRY = ATLAS.frame('quarry'), AT_POND = ATLAS.frame('pond');
const AT_CAMP = ATLAS.frame('camp'), AT_WREN = ATLAS.frame('wren'), AT_CIRCLE = ATLAS.frame('stone_circle'), AT_TOWER = ATLAS.frame('watchtower');
const AT_SIGN = ATLAS.frame('signpost'), AT_DRILL = ATLAS.frame('drill_field'), AT_HF = ATLAS.frame('hollowford'), AT_DH = ATLAS.frame('deepholm_rock');
const AT_WHOLE = r => Object.assign({}, r, { x0: Math.round(r.x0), y0: Math.round(r.y0), x1: Math.round(r.x1), y1: Math.round(r.y1) });   // a world rect (AT_W.rect) in whole tiles
const AT_PORT = id => { const q = ATLAS.port(id); return { x: q[0], y: q[1] }; };

const SPAWN = (q => ({ x: tc(q.x), y: tc(q.y) }))(AT_PORT('cave.spawn'));
const SWORD_POS = (q => ({ x: tc(q.x), y: tc(q.y) }))(AT_PORT('cave.sword'));
const SIGN_TILE = AT_PORT('signpost.sign');
const VILLAGE = AT_TD.rect({ x0: 85, y0: 14, x1: 140, y1: 56, name: 'Thistledown' });
const VILLAGE_SPAWN = (q => ({ x: tc(q.x), y: tc(q.y) }))(AT_PORT('thistledown.square'));
const CASTLE = AT_TD.pt({ x: 104, y: 42, w: 18, h: 13 });
// the camp's own ground (the palisade and the field just west of it): the core scatters nothing here, every spawn in it is
// a camp monster (slow respawn), 39-worldblend's palisade guard is it, and 01-atlas's goblin_camp rule covers it
const CAMP_GROUND = AT_CAMP.rect({ x0: 142, y0: 20, x1: 158, y1: 40 });
// the quarry's rock rectangle the core scatters (39-worldblend keeps rows 3-4 of it for the cliff course)
const QUARRY_ROCK = AT_QUARRY.rect({ x0: 48, y0: 3, x1: 60, y1: 12 });
const REGIONS = [
  AT_CAVE.rect({ name: 'The Cave', sub: 'Where you woke', x0: 0, y0: 0, x1: 20, y1: 15 }),
  { name: 'Castle Thistledown', sub: "Seat of Duke Ferrin", x0: CASTLE.x, y0: CASTLE.y, x1: CASTLE.x + CASTLE.w - 1, y1: CASTLE.y + CASTLE.h - 1 },
  { name: 'Thistledown', sub: 'The city that still stands', x0: VILLAGE.x0, y0: VILLAGE.y0, x1: VILLAGE.x1, y1: VILLAGE.y1 },
  AT_QUARRY.rect({ name: 'Grey Quarry', sub: 'Iron and coal in the rock', x0: 46, y0: 1, x1: 62, y1: 14 }),
  AT_POND.rect({ name: "Miller's Pond", sub: 'Shrimp, and trout for the patient', x0: 36, y0: 30, x1: 50, y1: 44 }),
  AT_CAMP.rect({ name: 'Goblin Camp', sub: 'Their machines are here', x0: 145, y0: 18, x1: 159, y1: 42 }),
  // (Wolfwood's last row is the warden's line, the rim, on its pin through the warden's gate: 27-dragons' Ashfields box starts the row below)
  Object.assign(AT_WHOLE(AT_W.rect({ name: 'Wolfwood', sub: 'Keep to the paths', x0: 0, y0: 62, x1: 159, y1: 95 })), { y1: Math.round(AT_W.pin('rim', AT_W.y(95), ATLAS.port('warden.gate')[0])) }),
  AT_WHOLE(AT_W.rect({ name: 'Goblin Fields', sub: 'The road east', x0: 21, y0: 0, x1: 159, y1: 61 })),
  { name: 'The Wilds', sub: 'Uncharted', x0: AT_W.tx(0), y0: AT_W.ty(0), x1: MAP_W - 1, y1: MAP_H - 1 },
];
const regionAt = (tx, ty) => REGIONS.find(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) || REGIONS[REGIONS.length - 1];

// buildings: door on the bottom wall at x+door (or top wall at x+doorTop). f = furniture [tile, rx, ry] inside.
const BUILDINGS = [
  AT_TD.pt({ id: 'store', x: 90, y: 20, w: 7, h: 6, name: 'General Store', roof: '#7a3b2e', sign: 'STORE', door: 3, f: [[T.COUNTER, 1, 2], [T.COUNTER, 2, 2], [T.COUNTER, 3, 2], [T.SHELF, 1, 1], [T.SHELF, 2, 1], [T.SHELF, 4, 1], [T.SHELF, 5, 1]] }),
  AT_TD.pt({ id: 'bank', x: 99, y: 20, w: 8, h: 6, name: 'Bank of Thistledown', roof: '#3b4a7a', sign: 'BANK', door: 3, f: [[T.COUNTER, 1, 2], [T.COUNTER, 2, 2], [T.COUNTER, 3, 2], [T.COUNTER, 4, 2], [T.COUNTER, 5, 2], [T.CHEST, 1, 1], [T.CHEST, 6, 1], [T.RUG, 3, 3], [T.RUG, 4, 3]] }),
  AT_TD.pt({ id: 'bakery', x: 122, y: 20, w: 6, h: 6, name: 'Bakery', roof: '#8a6a2e', sign: 'BAKERY', door: 2, f: [[T.OVEN, 1, 1], [T.OVEN, 2, 1], [T.COUNTER, 1, 3], [T.COUNTER, 2, 3], [T.TABLE, 4, 2]] }),
  AT_TD.pt({ id: 'smithy', x: 90, y: 36, w: 7, h: 6, name: 'Smithy', roof: '#4a4a52', sign: 'SMITHY', door: 3, f: [[T.FORGE, 1, 1], [T.FORGE, 2, 1], [T.ANVIL, 4, 2], [T.COUNTER, 5, 3], [T.SHELF, 5, 1]] }),
  AT_TD.pt({ id: 'workshop', x: 99, y: 36, w: 7, h: 5, name: "Tinker's Workshop", roof: '#5a4a3a', sign: 'TINKER', door: 3, f: [[T.WORKBENCH, 1, 1], [T.WORKSHOP, 3, 1], [T.ALCHEMY, 5, 1], [T.SHELF, 5, 3], [T.TABLE, 1, 3]] }),
  AT_TD.pt({ id: 'inn', x: 123, y: 44, w: 8, h: 6, name: 'The Barrel & Boar', roof: '#6a3a2a', sign: 'INN', doorTop: 3, f: [[T.COUNTER, 1, 1], [T.COUNTER, 2, 1], [T.TABLE, 4, 2], [T.TABLE, 6, 2], [T.TABLE, 4, 4], [T.BED, 6, 4], [T.RUG, 3, 3]] }),
  AT_TD.pt({ id: 'keep', x: 108, y: 46, w: 10, h: 7, name: 'The Keep', roof: '#5a2e7a', sign: 'KEEP', doorTop: 4, stone: true, f: [[T.THRONE, 4, 4], [T.RUG, 4, 2], [T.RUG, 4, 3], [T.TABLE, 1, 4], [T.TABLE, 8, 4], [T.SHELF, 1, 1], [T.SHELF, 8, 1]] }),
  AT_CAVE.pt({ id: 'death1', x: 25, y: 10, w: 6, h: 5, name: "Death's House", roof: '#2a2a33', sign: 'REST', door: 2, stone: true, coffin: true, f: [[T.GOLDPILE, 1, 1], [T.GOLDPILE, 4, 1], [T.GOLDPILE, 4, 2], [T.CHEST, 1, 2]] }),
  AT_TD.pt({ id: 'death2', x: 133, y: 48, w: 6, h: 5, name: "Death's House", roof: '#2a2a33', sign: 'REST', door: 2, stone: true, coffin: true, f: [[T.GOLDPILE, 1, 1], [T.GOLDPILE, 4, 1], [T.GOLDPILE, 4, 2], [T.CHEST, 1, 2]] }),
  AT_WREN.pt({ id: 'hermit', x: 28, y: 76, w: 5, h: 5, name: "Wren's Hut", roof: '#4a5a3a', door: 2, f: [[T.BED, 1, 1], [T.TABLE, 3, 1], [T.SHELF, 3, 2]] }),
  AT_TD.pt({ id: 'h1', x: 121, y: 36, w: 5, h: 4, name: 'House', roof: '#6a4a3a', door: 2, f: [[T.BED, 1, 1], [T.TABLE, 3, 2]] }),
  AT_TD.pt({ id: 'h2', x: 88, y: 26, w: 4, h: 4, name: 'House', roof: '#4a5a3a', door: 1, f: [[T.BED, 1, 1]] }),
  AT_TD.pt({ id: 'h3', x: 93, y: 27, w: 4, h: 4, name: 'House', roof: '#6a4a3a', door: 1, f: [[T.TABLE, 1, 1]] }),
  AT_TD.pt({ id: 'h4', x: 124, y: 27, w: 4, h: 4, name: 'House', roof: '#5a4a5a', door: 1, f: [[T.BED, 1, 1]] }),
  AT_TD.pt({ id: 'h5', x: 99, y: 27, w: 5, h: 4, name: 'House', roof: '#6a4a3a', door: 2, f: [[T.BED, 1, 1], [T.SHELF, 3, 1]] }),
  AT_TD.pt({ id: 'h6', x: 92, y: 46, w: 4, h: 4, name: 'House', roof: '#4a5a3a', doorTop: 1, f: [[T.TABLE, 2, 2]] }),
  AT_TD.pt({ id: 'h7', x: 98, y: 46, w: 4, h: 4, name: 'House', roof: '#6a4a3a', doorTop: 1, f: [[T.BED, 2, 2]] }),
  AT_TD.pt({ id: 'h8', x: 134, y: 36, w: 5, h: 4, name: 'House', roof: '#5a4a5a', door: 2, f: [[T.BED, 1, 1], [T.TABLE, 3, 1]] }),
  AT_TD.pt({ id: 'h9', x: 128, y: 36, w: 4, h: 4, name: 'House', roof: '#4a5a3a', door: 1, f: [[T.SHELF, 1, 1]] }),
];
const buildingAt = (tx, ty) => BUILDINGS.find(b => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h);
const insideBuilding = (tx, ty) => { const b = buildingAt(tx, ty); return b && tx > b.x && tx < b.x + b.w - 1 && ty > b.y && ty < b.y + b.h - 1 ? b : null; };

const DUMMIES = AT_TD.pts([[88, 42], [88, 44]]);
const STALLS = AT_TD.pts([{ x: 108, y: 28, npc: 'greta' }, { x: 116, y: 28, npc: 'fennick' }]);
// NPCs: x,y in tiles (centre). wander = walks around near home. lines = chatter.
const NPCS = [
  AT_TD.pt({ id: 'marta', name: 'Marta', x: 92, y: 21, tunic: '#b04a3a', hair: '#3a2a1a', apron: true, role: 'shop', shop: 'general' }),
  AT_TD.pt({ id: 'aldous', name: 'Aldous the banker', x: 102, y: 21, tunic: '#2e3b6a', hair: '#d9d0c0', role: 'bank' }),
  AT_TD.pt({ id: 'rosalind', name: 'Rosalind', x: 125, y: 22, tunic: '#c89a4a', hair: '#7a3a1a', apron: true, role: 'shop', shop: 'bakery', woman: true }),
  AT_TD.pt({ id: 'brakka', name: 'Brakka the smith', x: 93, y: 39, tunic: '#5a4a3a', hair: '#2a1a0a', apron: true, role: 'shop', shop: 'smith', beard: true }),
  AT_TD.pt({ id: 'pim', name: 'Pim the tinker', x: 103, y: 39, tunic: '#6a5a8a', hair: '#c9843a', role: 'tinker', woman: true }),
  AT_TD.pt({ id: 'dorran', name: 'Dorran the innkeeper', x: 125, y: 46, tunic: '#6a3a2a', hair: '#3a2a1a', apron: true, role: 'inn', beard: true }),
  AT_TD.pt({ id: 'duke', name: 'Duke Ferrin', x: 112, y: 49, tunic: '#5a2e7a', hair: '#8a7a6a', crown: true, role: 'duke' }),
  AT_TD.pt({ id: 'hale', name: 'Sergeant Hale', x: 86, y: 43, tunic: '#4a4f5a', hair: '#2a1a0a', helmet: true, role: 'trainer' }),
  AT_TD.pt({ id: 'tobin', name: 'Tobin', x: 110, y: 33, tunic: '#6a6a4a', hair: '#5a3a1a', role: 'bread' }),
  AT_TD.pt({ id: 'greta', name: 'Greta', x: 108, y: 27, tunic: '#4a7a3a', hair: '#e0c080', apron: true, role: 'shop', shop: 'seeds', woman: true }),
  AT_TD.pt({ id: 'fennick', name: 'Fennick the trader', x: 116, y: 27, tunic: '#8a6a2a', hair: '#2a1a0a', role: 'trader' }),
  AT_CAVE.pt({ id: 'death1', name: 'Death', x: 27, y: 12, ghost: true, role: 'death' }),
  AT_TD.pt({ id: 'death2', name: 'Death', x: 135, y: 50, ghost: true, role: 'death' }),
  AT_WREN.pt({ id: 'wren', name: 'Old Wren', x: 30, y: 78, tunic: '#5a6a4a', hair: '#d9d0c0', beard: true, role: 'hermit' }),
  AT_TD.pt({ id: 'v1', name: 'Ada', x: 100, y: 32, tunic: '#7a4a6a', hair: '#3a2a1a', woman: true, wander: true, role: 'villager', lines: ["Mind the guards' spears, they're sharper than they look.", 'Marta had rods in this morning.', 'The Duke pays for goblin scrap, I hear.'] }),
  AT_TD.pt({ id: 'v2', name: 'Bram', x: 118, y: 32, tunic: '#4a6a7a', hair: '#5a3a1a', wander: true, role: 'villager', lines: ['Wolves in the south wood again. Keep to the road.', 'A trap on the road took a goblin clean off its feet last week.', 'Fennick pays full price for pelts.'] }),
  AT_TD.pt({ id: 'v3', name: 'Cass', x: 112, y: 24, tunic: '#6a7a4a', hair: '#c9843a', woman: true, wander: true, role: 'villager', lines: ["Rosalind's pies. That's all I'll say.", 'They say Hollowford burned in a night.', 'Old Wren in the wood knows more than he lets on.'] }),
  AT_TD.pt({ id: 'v4', name: 'Dunn', x: 96, y: 33, tunic: '#5a5a5a', hair: '#2a1a0a', wander: true, role: 'villager', lines: ['Brakka can make a sword from a bar if you bring a hammer.', 'The quarry north of the road has coal, if you can dig it.', "Don't fish the pond at dusk. Trust me."] }),
  AT_TD.pt({ id: 'v5', name: 'Elsie', x: 128, y: 34, tunic: '#8a5a7a', hair: '#e0c080', woman: true, wander: true, role: 'villager', lines: ['Greta will sell you seed. Potatoes grow anywhere.', "The bank never loses a thing. Aldous counts twice.", 'I saw a goblin barrel walk. Walk!'] }),
  AT_TD.pt({ id: 'v6', name: 'Finn', x: 114, y: 40, tunic: '#4a5a8a', hair: '#3a2a1a', wander: true, role: 'villager', lines: ['Sergeant Hale drills at dawn. The dummies never win.', 'A bed and a lodestone and you can call anywhere home.', 'Pim can turn scrap and powder into something loud.'] }),
];
function initNpc(n) { n.px = tc(n.x); n.py = tc(n.y); n.home = { x: n.px, y: n.py }; n.facing = { x: 0, y: 1 }; n.walkT = 0; n.moving = false; n.wanderT = Math.random() * 3; n.hurtT = 0; n.attackT = 0; n.r = 13; return n; }
for (const n of NPCS) initNpc(n);

const MONSTER_SPAWNS = [];
const spawnList = (type, list) => { for (const [x, y] of list) MONSTER_SPAWNS.push({ type, tx: Math.round(x), ty: Math.round(y) }); };   // whole tiles (a world point may not be)

function generateWorld() {
  const rnd = mulberry32(WORLD_SEED);
  MONSTER_SPAWNS.length = 0;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const n = Math.sin(x * 0.37) * Math.cos(y * 0.29) + Math.sin((x + y) * 0.13) * 0.6;
    map[idx(x, y)] = n > 0.95 ? T.DIRT : T.GRASS;
    variant[idx(x, y)] = Math.floor(rnd() * 3);
  }
  // ---- the cave ---- (its own frame: pinned at the origin at the spread, read like every other place)
  const CV = AT_CAVE, TD = AT_TD, CP = AT_CAMP, SC = AT_CIRCLE, TW = AT_TOWER, W = AT_W;
  for (let y = CV.y(0); y <= CV.y(15); y++) for (let x = CV.x(0); x <= CAVE_EXIT_X; x++) {
    const border = x === CV.x(0) || y === CV.y(0) || y === CV.y(15) || (x >= CV.x(16) && (y < CV.y(6) || y > CV.y(8)));
    setTile(x, y, border ? T.WALL : T.CAVE);
  }
  for (let x = CV.x(16); x <= CAVE_EXIT_X; x++) { setTile(x, CV.y(5), T.WALL); setTile(x, CV.y(9), T.WALL); }
  for (const [px, py] of CV.pts([[3, 3], [4, 3], [8, 11], [9, 11], [9, 12], [12, 3], [13, 4], [5, 12], [13, 11]])) setTile(px, py, T.WALL);
  // ---- roads ---- (ATLAS.TRACKS: each point a port, a place's own point or a world point)
  const road = (pts, tile = T.DIRT, width = 1, chance = 0.7) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s], [bx, by] = pts[s + 1]; const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = 0; k <= steps; k++) { const x = Math.round(ax + (bx - ax) * k / steps), y = Math.round(ay + (by - ay) * k / steps);
        for (let dy = -width; dy <= width; dy++) for (let dx = -width; dx <= width; dx++) if (Math.abs(dx) + Math.abs(dy) <= width && rnd() < chance) { const t = tileAt(x + dx, y + dy); if (t === T.GRASS || t === T.DIRT) setTile(x + dx, y + dy, tile); } }
    }
  };
  // the spread's network (ATLAS.TRACKS, §5): every road a continuous dirt track, laid whole (chance 1, so it draws no dice):
  // a main road two tiles wide (a second row below a level stretch, a second column west of a steep one), a spur or path
  // one. Everything after this reads them as roads (39 bridges them over the river and keeps solids off them, 92 leaves
  // the scarp open where they cross it).
  const lay = (pts, wide) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s], [bx, by] = pts[s + 1], steps = Math.max(1, Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      const level = Math.abs(bx - ax) >= Math.abs(by - ay), ox = wide && !level ? -1 : 0, oy = wide && level ? 1 : 0;
      for (let k = 0; k <= steps; k++) { const x = Math.round(ax + (bx - ax) * k / steps), y = Math.round(ay + (by - ay) * k / steps);
        for (const [px, py] of [[x, y], [x + ox, y + oy]]) { const t = tileAt(px, py); if (t === T.GRASS || t === T.DIRT) setTile(px, py, T.DIRT); } }
    }
  };
  for (const id of ATLAS.ROAD_IDS) if (id !== 'shaft_lane' && id !== 'path_farm') lay(ATLAS.track(id), ATLAS.MAIN_ROADS.includes(id) ? 1 : 0);
  // ---- ponds ---- (Miller's Pond, and the little one south of Thistledown; each shore's wobble read in its place's OLD
  // coordinates, so the pond keeps its shape wherever its place goes)
  for (const [F, [px, py], pr] of [[AT_POND, ATLAS.port('pond.centre'), 4.5], [TD, TD.p(134, 60), 3.2]]) for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const d = dist(x, y, px, py), ox = F.ix(x), oy = F.iy(y);
    if (d < pr + Math.sin(ox * 1.3 + oy * 0.7) * 1.2) setTile(x, y, T.WATER);
    else if (d < pr + 2 + Math.sin(ox * 0.9 + oy * 1.1)) if (tileAt(x, y) !== T.WATER) setTile(x, y, T.SAND);
  }
  // ---- forests, rocks, flowers ----
  const inVillage = (x, y) => x >= VILLAGE.x0 && x <= VILLAGE.x1 && y >= VILLAGE.y0 && y <= VILLAGE.y1;
  const inQuarry = (x, y) => x >= QUARRY_ROCK.x0 && x <= QUARRY_ROCK.x1 && y >= QUARRY_ROCK.y0 && y <= QUARRY_ROCK.y1;
  const inCamp = (x, y) => x >= CAMP_GROUND.x0 && x <= CAMP_GROUND.x1 && y >= CAMP_GROUND.y0 && y <= CAMP_GROUND.y1;
  const WOODS = REGIONS.find(r => r.name === 'Wolfwood');   // the wood is thick from Wolfwood's top row down
  for (let y = 0; y < MAP_H; y++) for (let x = CAVE_EXIT_X + 1; x < MAP_W; x++) {
    const t = tileAt(x, y);
    if (t !== T.GRASS) continue;
    if (Math.abs(x - SIGN_TILE.x) < 3 && Math.abs(y - SIGN_TILE.y) < 3) continue;
    if (inVillage(x, y) || inCamp(x, y)) continue;
    const r = rnd();
    if (inQuarry(x, y)) { if (r < 0.30) setTile(x, y, T.ROCK); else if (r < 0.42) setTile(x, y, T.IRON); else if (r < 0.48) setTile(x, y, T.COAL); continue; }
    // the thickets: east of the quarry's hills, and the land below the camp (open ground, the stretched world)
    const wolfwood = y >= WOODS.y0, thicket = (x > W.x(56) && x < W.x(80) && y < W.y(14)) || (x > W.x(141) && y > W.y(44));
    const treeChance = wolfwood ? 0.26 : thicket ? 0.22 : 0.07;
    if (r < treeChance) setTile(x, y, rnd() < (wolfwood ? 0.3 : 0.15) ? T.OAK : T.TREE);
    else if (r < treeChance + 0.025) setTile(x, y, rnd() < 0.2 ? T.IRON : T.ROCK);
    else if (r < treeChance + 0.045) setTile(x, y, wolfwood ? T.MUSHROOM : T.FLOWERS);
  }
  for (let x = 0; x < MAP_W; x++) { if (x > CAVE_EXIT_X) setTile(x, 0, T.TREE); setTile(x, MAP_H - 1, T.TREE); }
  for (let y = 0; y < MAP_H; y++) { setTile(MAP_W - 1, y, T.TREE); if (y > CV.y(15)) setTile(0, y, T.TREE); }
  // ---- landmarks ----
  // the cave mouth is the road's first tile: the scatter above may not stand a tree on it (the road's dither can miss it)
  { const [mx, my] = ATLAS.port('cave.mouth'); if (SOLID.has(tileAt(mx, my))) setTile(mx, my, T.DIRT); }
  setTile(SIGN_TILE.x, SIGN_TILE.y, T.SIGN);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) setTile(SIGN_TILE.x + dx, SIGN_TILE.y + dy, T.DIRT);
  { const [ax, ay] = ATLAS.port('cave.axe_stump'); setTile(ax, ay, T.AXESTUMP); setTile(ax - 1, ay, T.GRASS); setTile(ax + 1, ay, T.GRASS); }
  { const [cx, cy] = ATLAS.port('quarry.cart'), [sx, sy] = ATLAS.port('quarry.spur'); setTile(cx, cy, T.CART); for (let dx = -1; dx <= 1; dx++) setTile(sx + dx, sy, T.DIRT); }
  setTile(...ATLAS.port('graveyard.grave'), T.GRAVE); // the last knight
  for (const [sx, sy] of SC.pts([[58, 84], [62, 84], [64, 87], [62, 90], [58, 90], [56, 87]])) setTile(sx, sy, T.STONECIRCLE);
  for (let y = SC.y(85); y <= SC.y(89); y++) for (let x = SC.x(57); x <= SC.x(63); x++) if (tileAt(x, y) !== T.STONECIRCLE) setTile(x, y, T.GRASS);
  // ruined watchtower with a chest
  for (let y = TW.y(78); y <= TW.y(84); y++) for (let x = TW.x(92); x <= TW.x(98); x++) setTile(x, y, T.GRASS);
  for (const [rx, ry] of TW.pts([[93, 79], [94, 79], [95, 79], [97, 79], [93, 80], [93, 82], [97, 80], [97, 81], [93, 83], [95, 83], [96, 83], [97, 83]])) setTile(rx, ry, T.CWALL);
  setTile(...ATLAS.port('watchtower.chest'), T.CHEST); setTile(...TW.p(94, 81), T.RUBBLE); setTile(...TW.p(96, 82), T.RUBBLE);
  // ---- village ----
  for (let y = VILLAGE.y0; y <= VILLAGE.y1; y++) for (let x = VILLAGE.x0; x <= VILLAGE.x1; x++) if ([T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM].includes(tileAt(x, y))) setTile(x, y, T.GRASS);
  for (let x = VILLAGE.x0; x <= VILLAGE.x1; x++) for (let dy = -1; dy <= 1; dy++) setTile(x, TD.y(32) + dy, T.COBBLE); // main street
  for (let y = TD.y(16); y <= TD.y(41); y++) setTile(TD.x(112), y, T.COBBLE); for (let y = TD.y(16); y <= TD.y(41); y++) setTile(TD.x(111), y, T.COBBLE); // north-south street
  for (let y = TD.y(26); y <= TD.y(38); y++) for (let x = TD.x(104); x <= TD.x(120); x++) setTile(x, y, T.COBBLE); // square
  for (let y = TD.y(27); y <= TD.y(31); y++) for (let x = TD.x(97); x <= TD.x(99); x++) setTile(x, y, T.DIRT); // lane to smithy row
  for (let y = TD.y(27); y <= TD.y(31); y++) setTile(TD.x(126), y, T.DIRT); for (let y = TD.y(33); y <= TD.y(44); y++) setTile(TD.x(126), y, T.DIRT); // east lane
  for (let x = TD.x(88); x <= TD.x(104); x++) setTile(x, TD.y(44), T.DIRT); // south lane
  setTile(...ATLAS.port('thistledown.brazier'), T.FIRE);
  for (let y = TD.y(50); y <= TD.y(53); y++) for (let x = TD.x(126); x <= TD.x(132); x++) setTile(x, y, T.SOIL); // allotments
  // village fence + gates
  for (let x = VILLAGE.x0; x <= VILLAGE.x1; x++) { setTile(x, VILLAGE.y0, T.FENCE); setTile(x, VILLAGE.y1, T.FENCE); }
  for (let y = VILLAGE.y0; y <= VILLAGE.y1; y++) { setTile(VILLAGE.x0, y, Math.abs(y - TD.y(32)) <= 1 ? T.GATE : T.FENCE); setTile(VILLAGE.x1, y, Math.abs(y - TD.y(32)) <= 1 ? T.GATE : T.FENCE); }
  // castle ring + portcullis + towers (corner CWALL); the keep is a building
  for (let y = CASTLE.y; y < CASTLE.y + CASTLE.h; y++) for (let x = CASTLE.x; x < CASTLE.x + CASTLE.w; x++) {
    const edge = x === CASTLE.x || y === CASTLE.y || x === CASTLE.x + CASTLE.w - 1 || y === CASTLE.y + CASTLE.h - 1;
    setTile(x, y, edge ? T.CWALL : T.COBBLE);
  }
  setTile(TD.x(111), CASTLE.y, T.PORTCULLIS); setTile(TD.x(112), CASTLE.y, T.PORTCULLIS);
  // training yard
  for (let y = TD.y(40); y <= TD.y(46); y++) for (let x = TD.x(85); x <= TD.x(90); x++) setTile(x, y, (x === TD.x(85) || x === TD.x(90) || y === TD.y(40) || y === TD.y(46)) ? T.FENCE : T.DIRT);
  setTile(...TD.p(90, 43), T.GATE);
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
  const pen = (x0, y0, x1, y1, gx, gy) => { for (let x = x0; x <= x1; x++) { setTile(x, y0, T.FENCE); setTile(x, y1, T.FENCE); } for (let y = y0; y <= y1; y++) { setTile(x0, y, T.FENCE); setTile(x1, y, T.FENCE); } for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) setTile(x, y, T.GRASS); setTile(gx, gy, T.GATE);
    // the step outside the gate stays open ground (the scatter above may have stood a tree or a rock on it)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = gx + dx, y = gy + dy; if ((x < x0 || x > x1 || y < y0 || y > y1) && SOLID.has(tileAt(x, y))) setTile(x, y, T.GRASS); } };
  pen(...TD.box([72, 40, 80, 46]), ...TD.p(80, 43)); pen(...TD.box([72, 14, 80, 21]), ...TD.p(80, 17));
  // goblin camp: palisade with a west gap, scrap heaps, a fire
  // the palisade's west wall stands well clear of Thistledown's east wall (x 140): a 6-tile field between them, not 1
  { const [gx, gy] = ATLAS.port('camp.west_gap');
    for (let y = CP.y(20); y <= CP.y(40); y++) for (let x = CP.x(147); x <= CP.x(158); x++) { const edge = x === CP.x(147) || x === CP.x(158) || y === CP.y(20) || y === CP.y(40); if (edge && !(x === gx && Math.abs(y - gy) <= 1)) setTile(x, y, T.FENCE); else if (tileAt(x, y) === T.GRASS && rnd() < 0.25) setTile(x, y, T.DIRT); } }
  setTile(...CP.p(150, 30), T.FIRE); for (const [px, py] of CP.pts([[151, 24], [154, 25], [150, 36], [155, 35]])) setTile(px, py, T.PLANK); // inside the palisade's new west wall
  // ---- monsters ---- (each spawn in the frame of the place it stands in on the old map; open land is the world's,
  // and spawnList takes the whole tile)
  const DR = AT_DRILL, HF = AT_HF, DH = AT_DH, PD = AT_POND, SG = AT_SIGN;
  spawnList('spider', CV.pts([[3, 12], [7, 3], [11, 12], [14, 9], [6, 6]]));
  spawnList('goblin', [CV.p(27, 3), W.p(34, 10), CV.p(27, 14), W.p(40, 14), W.p(40, 8), W.p(47, 20), W.p(52, 28), W.p(58, 22), W.p(55, 34), SG.p(62, 30), PD.p(48, 44), W.p(66, 18), TD.p(72, 26), W.p(60, 52), TD.p(100, 60), TD.p(116, 60), W.p(40, 54), W.p(30, 44), TD.p(70, 50), W.p(80, 8)]);
  spawnList('boar', [W.p(30, 24), PD.p(34, 30), W.p(26, 36), PD.p(40, 46), DR.p(60, 44), TD.p(90, 60), TD.p(70, 56)]);
  spawnList('sheep', TD.pts([[74, 42], [77, 44], [76, 41], [79, 43]]));
  spawnList('cow', TD.pts([[74, 16], [77, 19], [79, 16]]));
  // (the West Gate's guard stands at 89,30, clear of the gate tower's cone: at 87,30 the cone hid his name)
  spawnList('guard_m', TD.pts([[89, 30], [118, 36], [113, 43]])); spawnList('guard_f', TD.pts([[104, 23], [126, 33], [110, 43]]));
  spawnList('wolf', [W.p(20, 70), W.p(40, 68), W.p(50, 80), W.p(75, 74), W.p(90, 70), W.p(110, 82), HF.p(130, 72), HF.p(145, 80), W.p(70, 88), DH.p(25, 88)]);
  spawnList('sapper', CP.pts([[146, 26], [154, 34], [150, 38]])); spawnList('brute', CP.pts([[148, 30], [153, 24], [155, 30]]));
  spawnList('goblin', CP.pts([[144, 24], [144, 36], [156, 38], [151, 22]]));
  spawnList('walker', [ATLAS.port('camp.walker')]);
  for (const h of HOOKS.world) h(rnd, { setTile, tileAt, spawnList, road, pen });
  // nothing wakes on a doorstep: a spawn (posted guards excepted — they stand at gates on purpose) within 3 tiles of any door moves to the
  // nearest open tile that is 4+ tiles from every building and clear of doors. The goblin on Death's House step at (27,14) is the one this is for.
  {
    const doors = [];
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const t = map[idx(x, y)]; if (t === T.DOOR || t === T.COFFINDOOR || t === T.PORTCULLIS) doors.push([x, y]); }
    for (const b of BUILDINGS) { if (b.door !== undefined) doors.push([b.x + b.door, b.y + b.h - 1]); if (b.doorTop !== undefined) doors.push([b.x + b.doorTop, b.y]); }
    const rectDist = (x, y, b) => Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.w - 1)), Math.max(b.y - y, 0, y - (b.y + b.h - 1)));
    const nearDoor = (x, y) => doors.some(([dx, dy]) => Math.hypot(dx - x, dy - y) <= 3);
    const open = (x, y) => inMap(x, y) && !SOLID.has(tileAt(x, y)) && !PUSH_THROUGH.has(tileAt(x, y)) && !buildingAt(x, y) && !nearDoor(x, y) && BUILDINGS.every(b => rectDist(x, y, b) >= 4);
    for (const s of MONSTER_SPAWNS) {
      if (MONSTER_DEFS[s.type].human || !nearDoor(s.tx, s.ty)) continue;
      let best = null;
      for (let ring = 1; ring <= 12 && !best; ring++) for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = s.tx + dx, y = s.ty + dy; if (!open(x, y)) continue;
        const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { x, y, d };
      }
      if (best) { s.movedFrom = [s.tx, s.ty]; s.tx = best.x; s.ty = best.y; }
    }
  }
  // the Goblin Camp's own monsters (inside the palisade, feature spawns included) respawn slowly and only while the knight is far — see killMonster / update
  for (const s of MONSTER_SPAWNS) if (s.tx >= CAMP_GROUND.x0 && s.tx <= CAMP_GROUND.x1 && s.ty >= CAMP_GROUND.y0 && s.ty <= CAMP_GROUND.y1) s.camp = true;
  for (const s of MONSTER_SPAWNS) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const t = tileAt(s.tx + dx, s.ty + dy);
    if ([T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM].includes(t)) setTile(s.tx + dx, s.ty + dy, T.GRASS);
  }
  // NPC tiles walkable
  for (const n of NPCS) if (SOLID.has(tileAt(n.x, n.y))) setTile(n.x, n.y, insideBuilding(n.x, n.y) ? T.FLOOR : T.GRASS);
}
const isCaveTile = (tx, ty) => tx <= CAVE_EXIT_X && ty <= AT_CAVE.y(15);
const inVillageBounds = (x, y) => x > VILLAGE.x0 * TILE && x < (VILLAGE.x1 + 1) * TILE && y > VILLAGE.y0 * TILE && y < (VILLAGE.y1 + 1) * TILE;
