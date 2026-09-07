// ============================================================================
// ITEMS, GEAR, RECIPES, SHOPS, SKILLS, MONSTERS
// ============================================================================
// weapon: {str, att, cd, perk, ranged}; armour: {slot, def}; tool: 'axe'|'pickaxe'|'hoe'|'rod'|'hammer' with tier
const ITEMS = {
  coins: { name: 'Coins', value: 1, color: '#f5c542', shape: 'coins', stack: 1e9 },
  // materials
  wood: { name: 'Logs', value: 2, color: '#c9a36a', shape: 'log', burn: 40 },
  oak_log: { name: 'Oak logs', value: 8, color: '#8a5a2b', shape: 'log', burn: 60 },
  stone: { name: 'Stone', value: 2, color: '#b8bcc4', shape: 'rock' },
  iron_ore: { name: 'Iron ore', value: 14, color: '#8e7d6b', shape: 'rock' },
  coal: { name: 'Coal', value: 20, color: '#2f2f35', shape: 'rock' },
  iron_bar: { name: 'Iron bar', value: 30, color: '#a9adb5', shape: 'bar' },
  steel_bar: { name: 'Steel bar', value: 70, color: '#d5d9e0', shape: 'bar' },
  plank: { name: 'Plank', value: 3, color: '#d8a95e', shape: 'plank', place: 'PLANK' },
  door: { name: 'Door', value: 20, color: '#8a5a2b', shape: 'door', place: 'DOOR' },
  bed: { name: 'Bed', value: 40, color: '#c94a5a', shape: 'bed', place: 'BED' },
  lodestone: { name: 'Lodestone', value: 120, color: '#7ec8ff', shape: 'lodestone', place: 'LODESTONE' },
  workbench: { name: 'Workbench', value: 30, color: '#a07a4a', shape: 'bench', place: 'WORKBENCH' },
  goblin_trap: { name: 'Goblin trap', value: 45, color: '#8f96a3', shape: 'trap', place: 'TRAP' },
  goblin_scrap: { name: 'Goblin scrap', value: 15, color: '#9fd3ff', shape: 'scrap' },
  blast_powder: { name: 'Blast powder', value: 18, color: '#4a4a52', shape: 'powder' },
  spider_silk: { name: 'Spider silk', value: 4, color: '#e9eef5', shape: 'silk' },
  wool: { name: 'Wool', value: 6, color: '#f2f2ec', shape: 'wool' },
  wolf_pelt: { name: 'Wolf pelt', value: 14, color: '#7a7068', shape: 'pelt' },
  boar_tusk: { name: 'Boar tusk', value: 12, color: '#f2e9d8', shape: 'tusk' },
  potato_seed: { name: 'Potato seed', value: 2, color: '#b8a070', shape: 'seed', seed: 'potato' },
  wheat_seed: { name: 'Wheat seed', value: 2, color: '#d8c070', shape: 'seed', seed: 'wheat' }, // grows like potatoes; flour at a workbench, pies at an oven (34-food)
  wheat: { name: 'Wheat', value: 3, color: '#e0b84a', shape: 'wheat' },
  // food
  raw_beef: { name: 'Raw beef', value: 5, color: '#c0504d', shape: 'meat', cook: 'cooked_beef' },
  cooked_beef: { name: 'Cooked beef', value: 12, color: '#8b4a2b', shape: 'meat', heal: 8 },
  raw_shrimp: { name: 'Raw shrimp', value: 3, color: '#f4b6a0', shape: 'fish', cook: 'shrimp' },
  shrimp: { name: 'Shrimp', value: 6, color: '#e88a5a', shape: 'fish', heal: 4 },
  raw_trout: { name: 'Raw trout', value: 8, color: '#9fb7c9', shape: 'fish', cook: 'trout' },
  trout: { name: 'Trout', value: 18, color: '#c98a5a', shape: 'fish', heal: 7 },
  potato: { name: 'Potato', value: 3, color: '#c9a66b', shape: 'potato', heal: 2, cook: 'baked_potato' },
  baked_potato: { name: 'Baked potato', value: 8, color: '#a97a3b', shape: 'potato', heal: 6 },
  burnt_food: { name: 'Burnt food', value: 0, color: '#3a3330', shape: 'meat' },
  bread: { name: 'Bread', value: 8, color: '#d9a55b', shape: 'bread', heal: 5 },
  meat_pie: { name: 'Meat pie', value: 25, color: '#c98a3a', shape: 'pie', heal: 12 },
  // tools
  bronze_axe: { name: 'Bronze axe', value: 16, color: '#b8863a', shape: 'axe', stack: 1, tool: 'axe', tier: 1, weapon: { str: 5, att: 1, cd: 0.6 } },
  iron_axe: { name: 'Iron axe', value: 56, color: '#a9adb5', shape: 'axe', stack: 1, tool: 'axe', tier: 2, weapon: { str: 8, att: 4, cd: 0.6 } },
  bronze_pickaxe: { name: 'Bronze pickaxe', value: 20, color: '#b8863a', shape: 'pickaxe', stack: 1, tool: 'pickaxe', tier: 1 },
  iron_pickaxe: { name: 'Iron pickaxe', value: 70, color: '#a9adb5', shape: 'pickaxe', stack: 1, tool: 'pickaxe', tier: 2 },
  steel_axe: { name: 'Steel axe', value: 150, color: '#d5d9e0', shape: 'axe', stack: 1, tool: 'axe', tier: 2, weapon: { str: 14, att: 8, cd: 0.6 } },
  steel_pickaxe: { name: 'Steel pickaxe', value: 190, color: '#d5d9e0', shape: 'pickaxe', stack: 1, tool: 'pickaxe', tier: 2 },
  bronze_hoe: { name: 'Bronze hoe', value: 15, color: '#b8863a', shape: 'hoe', stack: 1, tool: 'hoe', tier: 1 },
  hammer: { name: 'Hammer', value: 5, color: '#8a7a6a', shape: 'hammer', stack: 1, tool: 'hammer', tier: 1 },
  fishing_rod: { name: 'Fishing rod', value: 40, color: '#a07a4a', shape: 'rod', stack: 1, tool: 'rod', tier: 1 },
  // weapons
  wooden_sword: { name: 'Wooden sword', value: 10, color: '#c9a36a', shape: 'sword', stack: 1, weapon: { str: 4, att: 2, cd: 0.45 } },
  bronze_dagger: { name: 'Bronze dagger', value: 20, color: '#b8863a', shape: 'dagger', stack: 1, weapon: { str: 3, att: 4, cd: 0.3, perk: 'swift' } },
  iron_dagger: { name: 'Iron dagger', value: 60, color: '#a9adb5', shape: 'dagger', stack: 1, weapon: { str: 5, att: 7, cd: 0.3, perk: 'swift' } },
  iron_sword: { name: 'Iron sword', value: 110, color: '#a9adb5', shape: 'sword', stack: 1, weapon: { str: 9, att: 8, cd: 0.45 } },
  iron_warhammer: { name: 'Iron warhammer', value: 150, color: '#a9adb5', shape: 'warhammer', stack: 1, weapon: { str: 12, att: 5, cd: 0.7, perk: 'knockback' } },
  iron_battleaxe: { name: 'Iron battleaxe', value: 160, color: '#a9adb5', shape: 'battleaxe', stack: 1, weapon: { str: 13, att: 6, cd: 0.75, perk: 'cleave' } },
  steel_sword: { name: 'Steel sword', value: 320, color: '#d5d9e0', shape: 'sword', stack: 1, weapon: { str: 16, att: 14, cd: 0.45 } },
  steel_battleaxe: { name: 'Steel battleaxe', value: 420, color: '#d5d9e0', shape: 'battleaxe', stack: 1, weapon: { str: 21, att: 10, cd: 0.75, perk: 'cleave' } },
  steel_dagger: { name: 'Steel dagger', value: 160, color: '#d5d9e0', shape: 'dagger', stack: 1, weapon: { str: 9, att: 12, cd: 0.3, perk: 'swift' } },
  steel_warhammer: { name: 'Steel warhammer', value: 400, color: '#d5d9e0', shape: 'warhammer', stack: 1, weapon: { str: 20, att: 9, cd: 0.7, perk: 'knockback' } },
  // mithril weapons live here with the rest of the gear; their recipes are in 24-dwarves.js beside the other mithril smithing
  mithril_dagger: { name: 'Mithril dagger', value: 450, color: '#7aa0d0', shape: 'dagger', stack: 1, weapon: { str: 15, att: 22, cd: 0.3, perk: 'swift' } },
  mithril_warhammer: { name: 'Mithril warhammer', value: 1100, color: '#7aa0d0', shape: 'warhammer', stack: 1, weapon: { str: 32, att: 18, cd: 0.7, perk: 'knockback' } },
  shortbow: { name: 'Shortbow', value: 50, color: '#a07a4a', shape: 'bow', stack: 1, weapon: { str: 0, att: 6, cd: 0.6, ranged: true } },
  oak_bow: { name: 'Oak bow', value: 120, color: '#8a5a2b', shape: 'bow', stack: 1, weapon: { str: 0, att: 10, cd: 0.58, ranged: true } },
  stone_arrow: { name: 'Stone arrows', value: 1, color: '#b8bcc4', shape: 'arrow', arrow: { str: 5 } },
  iron_arrow: { name: 'Iron arrows', value: 3, color: '#a9adb5', shape: 'arrow', arrow: { str: 9 } },
  bomb: { name: 'Goblin bomb', value: 40, color: '#2f2f35', shape: 'bomb', throwable: true },
  // armour
  ruined_helm: { name: 'Ruined helm', value: 12, color: '#6e5a4a', shape: 'helm', stack: 1, armour: { slot: 'helm', def: 2 } },
  ruined_body: { name: 'Ruined chainmail', value: 24, color: '#6e5a4a', shape: 'body', stack: 1, armour: { slot: 'body', def: 4 } },
  bronze_helm: { name: 'Bronze helm', value: 24, color: '#b8863a', shape: 'helm', stack: 1, armour: { slot: 'helm', def: 3 } },
  bronze_body: { name: 'Bronze platebody', value: 48, color: '#b8863a', shape: 'body', stack: 1, armour: { slot: 'body', def: 7 } },
  bronze_legs: { name: 'Bronze platelegs', value: 36, color: '#b8863a', shape: 'legs', stack: 1, armour: { slot: 'legs', def: 5 } },
  bronze_shield: { name: 'Bronze shield', value: 32, color: '#b8863a', shape: 'shield', stack: 1, armour: { slot: 'shield', def: 4 } },
  iron_helm: { name: 'Iron helm', value: 90, color: '#a9adb5', shape: 'helm', stack: 1, armour: { slot: 'helm', def: 5 } },
  iron_body: { name: 'Iron platebody', value: 240, color: '#a9adb5', shape: 'body', stack: 1, armour: { slot: 'body', def: 12 } },
  iron_legs: { name: 'Iron platelegs', value: 170, color: '#a9adb5', shape: 'legs', stack: 1, armour: { slot: 'legs', def: 8 } },
  iron_shield: { name: 'Iron shield', value: 150, color: '#a9adb5', shape: 'shield', stack: 1, armour: { slot: 'shield', def: 7 } },
  steel_helm: { name: 'Steel helm', value: 260, color: '#d5d9e0', shape: 'helm', stack: 1, armour: { slot: 'helm', def: 9 } },
  steel_body: { name: 'Steel platebody', value: 620, color: '#d5d9e0', shape: 'body', stack: 1, armour: { slot: 'body', def: 20 } },
  steel_legs: { name: 'Steel platelegs', value: 440, color: '#d5d9e0', shape: 'legs', stack: 1, armour: { slot: 'legs', def: 14 } },
  steel_shield: { name: 'Steel shield', value: 390, color: '#d5d9e0', shape: 'shield', stack: 1, armour: { slot: 'shield', def: 12 } },
};
for (const k in ITEMS) { ITEMS[k].id = k; if (!ITEMS[k].stack) ITEMS[k].stack = ITEMS[k].arrow ? 1000 : 50; }
const EQUIP_SLOTS = ['weapon', 'helm', 'body', 'legs', 'shield'];

// recipes: station null = from the pack. skill/lv gate + xp.
const RECIPES = [
  { out: 'plank', qty: 4, needs: [['wood', 2]], station: null, skill: 'crafting', lv: 1, xp: 6, label: '2 Logs → 4 Planks' }, // the first Crafting xp a new knight can earn
  { out: 'stone_arrow', qty: 5, needs: [['wood', 1], ['stone', 1]], station: 'workbench', skill: 'crafting', lv: 1, xp: 8, label: 'Logs + Stone → 5 Stone arrows' },
  { out: 'shortbow', qty: 1, needs: [['wood', 2], ['spider_silk', 1]], station: 'workbench', skill: 'crafting', lv: 1, xp: 25, label: '2 Logs + Spider silk → Shortbow' },
  { out: 'oak_bow', qty: 1, needs: [['oak_log', 2], ['spider_silk', 1]], station: 'workbench', skill: 'crafting', lv: 8, xp: 40, label: '2 Oak logs + Spider silk → Oak bow' },
  { out: 'door', qty: 1, needs: [['plank', 4]], station: 'workbench', skill: 'crafting', lv: 2, xp: 15, label: '4 Planks → Door' },
  { out: 'bed', qty: 1, needs: [['plank', 4], ['wool', 2]], station: 'workbench', skill: 'crafting', lv: 3, xp: 60, label: '4 Planks + 2 Wool → Bed' },
  { out: 'workbench', qty: 1, needs: [['plank', 8]], station: 'workbench', skill: 'crafting', lv: 4, xp: 60, label: '8 Planks → Workbench (for your base)' },
  { out: 'lodestone', qty: 1, needs: [['stone', 5], ['iron_bar', 1]], station: 'workbench', skill: 'crafting', lv: 5, xp: 120, label: '5 Stone + Iron bar → Lodestone' },
  { out: 'goblin_trap', qty: 1, needs: [['iron_bar', 1], ['plank', 2]], station: 'workshop', skill: 'crafting', lv: 3, xp: 60, label: 'Iron bar + 2 Planks → Goblin trap' },
  { out: 'iron_arrow', qty: 10, needs: [['iron_bar', 1], ['wood', 2]], station: 'workshop', skill: 'crafting', lv: 5, xp: 30, label: 'Iron bar + 2 Logs → 10 Iron arrows' },
  { out: 'bomb', qty: 1, needs: [['blast_powder', 1], ['goblin_scrap', 1]], station: 'alchemy', skill: 'crafting', lv: 2, xp: 45, label: 'Blast powder + Goblin scrap → Goblin bomb' },
  // smithing (anvil, needs a hammer)
  { out: 'iron_dagger', qty: 1, needs: [['iron_bar', 1]], station: 'anvil', skill: 'smithing', lv: 1, xp: 25, label: '1 bar → Iron dagger' },
  { out: 'iron_axe', qty: 1, needs: [['iron_bar', 1]], station: 'anvil', skill: 'smithing', lv: 2, xp: 25, label: '1 bar → Iron axe' },
  { out: 'iron_helm', qty: 1, needs: [['iron_bar', 1]], station: 'anvil', skill: 'smithing', lv: 3, xp: 25, label: '1 bar → Iron helm' },
  { out: 'iron_sword', qty: 1, needs: [['iron_bar', 2]], station: 'anvil', skill: 'smithing', lv: 4, xp: 50, label: '2 bars → Iron sword' },
  { out: 'iron_pickaxe', qty: 1, needs: [['iron_bar', 2]], station: 'anvil', skill: 'smithing', lv: 5, xp: 50, label: '2 bars → Iron pickaxe' },
  { out: 'iron_shield', qty: 1, needs: [['iron_bar', 2]], station: 'anvil', skill: 'smithing', lv: 6, xp: 50, label: '2 bars → Iron shield' },
  { out: 'iron_legs', qty: 1, needs: [['iron_bar', 2]], station: 'anvil', skill: 'smithing', lv: 7, xp: 50, label: '2 bars → Iron platelegs' },
  { out: 'iron_warhammer', qty: 1, needs: [['iron_bar', 3]], station: 'anvil', skill: 'smithing', lv: 8, xp: 75, label: '3 bars → Iron warhammer (knockback)' },
  { out: 'iron_battleaxe', qty: 1, needs: [['iron_bar', 3]], station: 'anvil', skill: 'smithing', lv: 9, xp: 75, label: '3 bars → Iron battleaxe (cleave)' },
  { out: 'iron_body', qty: 1, needs: [['iron_bar', 3]], station: 'anvil', skill: 'smithing', lv: 10, xp: 75, label: '3 bars → Iron platebody' },
  { out: 'steel_dagger', qty: 1, needs: [['steel_bar', 1]], station: 'anvil', skill: 'smithing', lv: 11, xp: 37, label: '1 steel bar → Steel dagger' },
  { out: 'steel_helm', qty: 1, needs: [['steel_bar', 1]], station: 'anvil', skill: 'smithing', lv: 12, xp: 37, label: '1 steel bar → Steel helm' },
  { out: 'steel_axe', qty: 1, needs: [['steel_bar', 1]], station: 'anvil', skill: 'smithing', lv: 12, xp: 37, label: '1 steel bar → Steel axe' },
  { out: 'steel_shield', qty: 1, needs: [['steel_bar', 2]], station: 'anvil', skill: 'smithing', lv: 13, xp: 75, label: '2 steel bars → Steel shield' },
  { out: 'steel_sword', qty: 1, needs: [['steel_bar', 2]], station: 'anvil', skill: 'smithing', lv: 14, xp: 75, label: '2 steel bars → Steel sword' },
  { out: 'steel_pickaxe', qty: 1, needs: [['steel_bar', 2]], station: 'anvil', skill: 'smithing', lv: 14, xp: 75, label: '2 steel bars → Steel pickaxe' },
  { out: 'steel_legs', qty: 1, needs: [['steel_bar', 2]], station: 'anvil', skill: 'smithing', lv: 15, xp: 75, label: '2 steel bars → Steel platelegs' },
  { out: 'steel_battleaxe', qty: 1, needs: [['steel_bar', 3]], station: 'anvil', skill: 'smithing', lv: 16, xp: 112, label: '3 steel bars → Steel battleaxe' },
  { out: 'steel_warhammer', qty: 1, needs: [['steel_bar', 3]], station: 'anvil', skill: 'smithing', lv: 17, xp: 112, label: '3 steel bars → Steel warhammer (knockback)' },
  { out: 'steel_body', qty: 1, needs: [['steel_bar', 3]], station: 'anvil', skill: 'smithing', lv: 18, xp: 112, label: '3 steel bars → Steel platebody' },
];
const SMELT = [
  { out: 'iron_bar', needs: [['iron_ore', 1]], lv: 1, xp: 12, label: 'Iron ore → Iron bar' },
  { out: 'steel_bar', needs: [['iron_ore', 1], ['coal', 1]], lv: 10, xp: 17, label: 'Iron ore + Coal → Steel bar' },
];
const SHOPS = {
  general: { name: "Marta's General Store", stock: [['fishing_rod', 60], ['hammer', 5], ['bread', 10], ['shrimp', 8], ['bronze_axe', 25], ['bronze_pickaxe', 30], ['bronze_helm', 30], ['bronze_shield', 40]] },
  bakery: { name: "Rosalind's Bakery", stock: [['bread', 8], ['meat_pie', 25], ['baked_potato', 6]] },
  seeds: { name: "Greta's Seed Stall", stock: [['potato_seed', 2], ['wheat_seed', 2], ['bronze_hoe', 15], ['potato', 3]] },
  smith: { name: "Brakka's Smithy", stock: [['hammer', 5], ['iron_dagger', 80], ['iron_helm', 120], ['bronze_body', 60], ['bronze_legs', 45]] },
};

// ---------- skills ----------
const SKILL_DEFS = [
  { key: 'melee', name: 'Melee' }, { key: 'defence', name: 'Defence' }, { key: 'range', name: 'Range', needs: 'a bow' },
  { key: 'woodcutting', name: 'Woodcutting', needs: 'an axe' }, { key: 'mining', name: 'Mining', needs: 'a pickaxe' }, { key: 'fishing', name: 'Fishing', needs: 'a rod' },
  { key: 'cooking', name: 'Cooking' }, { key: 'firemaking', name: 'Firemaking' }, { key: 'farming', name: 'Farming', needs: 'a hoe' },
  { key: 'smithing', name: 'Smithing' }, { key: 'crafting', name: 'Crafting' },
];
const XP_TABLE = [0, 0];
{ let acc = 0; for (let n = 1; n < 99; n++) { acc += Math.floor(n + 300 * Math.pow(2, n / 7)); XP_TABLE.push(Math.floor(acc / 4)); } }
const levelForXp = xp => { let lv = 1; while (lv < 99 && xp >= XP_TABLE[lv + 1]) lv++; return lv; };
const xpForLevel = lv => XP_TABLE[Math.min(99, lv)] || 0;

// ---------- monsters ----------
// drops: always [[id,min,max]], table [[id,min,max,weight]] ('nothing' allowed), rare {chance, table}
const MONSTER_DEFS = {
  spider: { name: 'Cave spider', level: 1, r: 7, hp: 3, att: 1, maxHit: 0, def: 1, speed: 90, aggro: false, harmless: true, sight: 0, respawn: 12,
    drops: { table: [['nothing', 0, 0, 6], ['spider_silk', 1, 1, 4]] } },
  goblin: { name: 'Goblin soldier', level: 2, r: 12, hp: 12, att: 3, maxHit: 3, def: 2, speed: 120, aggro: true, sight: 4.5 * TILE, respawn: 25,
    drops: { always: [['coins', 3, 9]], table: [['nothing', 0, 0, 30], ['goblin_scrap', 1, 1, 18], ['bread', 1, 1, 8], ['potato_seed', 1, 3, 10], ['blast_powder', 1, 1, 5], ['ruined_helm', 1, 1, 3], ['ruined_body', 1, 1, 2], ['bronze_dagger', 1, 1, 4]], rare: { chance: 40, table: [['iron_dagger', 1, 1, 3], ['iron_helm', 1, 1, 1]] } } },
  sapper: { name: 'Goblin sapper', level: 7, r: 12, hp: 24, att: 8, maxHit: 5, def: 6, speed: 110, aggro: true, sight: 6 * TILE, respawn: 40, thrower: true,
    drops: { always: [['coins', 6, 14], ['blast_powder', 1, 2]], table: [['nothing', 0, 0, 20], ['goblin_scrap', 1, 2, 20], ['bomb', 1, 1, 6], ['iron_ore', 1, 2, 8]], rare: { chance: 30, table: [['iron_warhammer', 1, 1, 1]] } } },
  brute: { name: 'Goblin brute', level: 9, r: 15, hp: 45, att: 10, maxHit: 8, def: 7, speed: 105, aggro: true, sight: 5 * TILE, respawn: 45,
    drops: { always: [['coins', 8, 20]], table: [['nothing', 0, 0, 24], ['goblin_scrap', 1, 3, 20], ['iron_ore', 1, 2, 12], ['ruined_body', 1, 1, 6], ['coal', 1, 1, 6]], rare: { chance: 25, table: [['iron_sword', 1, 1, 2], ['iron_body', 1, 1, 1]] } } },
  walker: { name: 'Goblin walker', level: 18, r: 22, hp: 110, att: 18, maxHit: 11, def: 12, speed: 70, aggro: true, sight: 6 * TILE, respawn: 3600, mech: true,
    drops: { always: [['goblin_scrap', 4, 8], ['iron_ore', 2, 4]], table: [['iron_bar', 1, 2, 10], ['blast_powder', 1, 3, 10], ['coal', 1, 2, 6]], rare: { chance: 6, table: [['iron_battleaxe', 1, 1, 1], ['iron_warhammer', 1, 1, 1]] } } },
  wolf: { name: 'Wolf', level: 6, r: 13, hp: 22, att: 7, maxHit: 5, def: 4, speed: 175, aggro: true, sight: 6 * TILE, respawn: 35,
    drops: { always: [['wolf_pelt', 1, 1]], table: [['nothing', 0, 0, 8], ['raw_beef', 1, 1, 4]] } },
  boar: { name: 'Boar', level: 4, r: 14, hp: 18, att: 5, maxHit: 4, def: 3, speed: 150, aggro: false, sight: 4 * TILE, respawn: 30,
    drops: { always: [['raw_beef', 1, 1]], table: [['nothing', 0, 0, 4], ['boar_tusk', 1, 1, 1]] } },
  sheep: { name: 'Sheep', level: 1, r: 12, hp: 8, att: 1, maxHit: 1, def: 1, speed: 70, aggro: false, sight: 3 * TILE, respawn: 40, drops: { always: [['wool', 1, 2]] } },
  cow: { name: 'Cow', level: 2, r: 15, hp: 14, att: 2, maxHit: 2, def: 2, speed: 60, aggro: false, sight: 3 * TILE, respawn: 45, drops: { always: [['raw_beef', 1, 2]] } },
  guard_m: { name: 'Town guard', level: 12, r: 13, hp: 55, att: 14, maxHit: 8, def: 12, speed: 150, aggro: false, sight: 6 * TILE, respawn: 60, human: true,
    drops: { always: [['coins', 10, 22]], table: [['nothing', 0, 0, 10], ['bread', 1, 1, 5], ['iron_dagger', 1, 1, 1]], rare: { chance: 30, table: [['iron_helm', 1, 1, 1]] } } },
  guard_f: { name: 'Town guard', level: 12, r: 13, hp: 55, att: 14, maxHit: 8, def: 12, speed: 150, aggro: false, sight: 6 * TILE, respawn: 60, human: true, woman: true,
    drops: { always: [['coins', 10, 22]], table: [['nothing', 0, 0, 10], ['bread', 1, 1, 5], ['iron_dagger', 1, 1, 1]], rare: { chance: 30, table: [['iron_helm', 1, 1, 1]] } } },
};
