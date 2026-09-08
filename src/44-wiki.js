// ============================================================================
// WIKI — an in-game book of everything: monsters, items, recipes, skills, places, quests.
// Feature file: registers through HOOKS only, edits no core file. One block, no leaked names.
//
// The book is built the first time it opens (so every feature file, whatever its number, is in it) from the
// live tables: MONSTER_DEFS, ITEMS, RECIPES, SMELT, SHOPS, SKILL_DEFS, XP_TABLE, REGIONS, MONSTER_SPAWNS,
// INSTANCES, QUEST_DEFS, GATHER, plus the tables features expose on window (DOZERUP blueprint drops,
// DRAGON_KILLERS dragon-item odds, SKYCITY's forge). Drop percentages are computed the way rollDrops rolls them.
//
// window.WIKI = { add(section, entry), get(section, id), open(section, id), sections, rebuild() }
//   add: a feature adds or overrides a page. entry = { id, name, ...fields of that section }.
//   Sections: monsters, items, recipes, skills, places, quests.
// Opening: K on the keyboard (K while facing a monster opens its page), the WIKI button on touch, or the
// Wiki button under an item in the pack panel.
// ============================================================================
{
  const SECTIONS = ['monsters', 'items', 'recipes', 'skills', 'places', 'quests'];
  const SECTION_NAME = { monsters: 'Monsters', items: 'Items', recipes: 'Recipes', skills: 'Skills', places: 'Places', quests: 'Quests' };
  const SECTION_SHORT = { monsters: 'Beasts', items: 'Items', recipes: 'Craft', skills: 'Skills', places: 'Places', quests: 'Quests' };
  const STATION_NAME = { workbench: 'Workbench (Tinker\'s Workshop)', anvil: 'Anvil (needs a hammer)', workshop: 'Tinker\'s table', alchemy: 'Alchemy table', forge: 'Forge (smelting)', loom: 'Thessaly\'s loom (Sylvaris)', oven: 'Oven (the bakery)', skyforge: 'Master Halcyon\'s cloud forge (Aerie)', null: 'Your pack (no station)' };
  const BOSS_TYPES = new Set(['walker', 'bulldozer', 'barrelbeast', 'brood_mother', 'gnasher', 'count_ashvane', 'the_fang', 'green_dragon', 'red_dragon']);
  const custom = {}; for (const s of SECTIONS) custom[s] = {};
  let data = null; // { monsters: {id: entry}, ... , order: {section: [ids]} }

  // ---------- hand-kept tables: things the game keeps inside closures (with the file they come from) ----------
  // extra places a monster is found (spawned by code, not a spawn list)
  const EXTRA_WHERE = {
    gnasher: ["Tinkerton's Lab, after you bring the four parts (Grubmarket)"],
    zombie: ['Anywhere wild, after dark (they turn to dust at dawn)'],
    grave_zombie: ['Near graves, after dark'],
    ally_knight: ["Fights beside you in The Fang's Lair (the Duke's Dragon Killers)"],
    the_fang: ["The Fang's Lair — sound the dragon horn to wake it"],
  };
  // loot that is not in a drops table: 28-thefang (first kill), 33-goblincity (Gnash's treasury)
  const EXTRA_DROPS = {
    the_fang: [['coins', 1000, 1000, 100, 'first kill only'], ['fang_of_the_fang', 1, 1, 100, 'first kill only'], ['mithril_bar', 4, 4, 100, 'first kill only'], ['dragon_scale', 10, 10, 100, 'first kill only']],
  };
  // items given by people, chests and quests (id → [text]). 06-systems, 16-instances, 20, 25, 26, 29, 33, 35, 36, 37, 38, 41.
  const GIVEN = {
    wooden_sword: ['In the light, in the cave where you woke'],
    bronze_axe: ['In the stump outside the cave (E)'],
    bronze_pickaxe: ['In the cart at Grey Quarry (E)'],
    coins: ['The chest in the ruined watchtower (Wolfwood): 60', 'Notice board jobs and guild jobs', 'The strongbox on Ironclad Isle: 120', 'The Fang, first kill: 1000'],
    ruined_helm: ['The chest in the ruined watchtower (Wolfwood)'],
    bronze_dagger: ['The chest in the ruined watchtower (Wolfwood)'],
    stone_arrow: ['The chest in the ruined watchtower (Wolfwood): 10', "The chest at the back of the Spider Den, after the Brood Mother: 30"],
    shortbow: ["Old Wren's reward for 5 spider silk (Wren's Silk)"],
    silk_cloak: ['Beat the Brood Mother in the Spider Den (first time)'],
    steel_helm: ["Old Tam's reward for freeing the survivors (Under the Chapel)"],
    steel_bar: ["Notice board: Scrap for the armoury (Duke Ferrin)", "King Gnash's treasury: 3", 'The strongbox on Ironclad Isle: 3'],
    iron_battleaxe: ['The strongbox on Ironclad Isle (after its five goblins)'],
    elven_arrow: ["Lira's reward for hitting 20 targets (Lira's Twenty): 30"],
    boiler: ["Grubb the cook in Grubmarket, for cooked beef"],
    gear_wheel: ["Nix the scrapper in Grubmarket, for goblin scrap"],
    bomb_chute: ["Old Snaggle in Grubmarket, for spider silk"],
    lightning_coil: ['Pip-squeak in Grubmarket, for bread'],
    tinker_goggles: ["Tinkerton's reward for bringing the Gnasher down (A Tinker Gone Wrong)"],
    gnash_crown: ["King Gnash's treasury, after the tribute (Gold for Gnash)"],
    mithril_bar: ["King Gnash's treasury: 2", 'The Fang, first kill: 4'],
    shadow_cloak: ['Beat Count Ashvane in the Afterlands (first time)'],
    wind_flute: ['Old Wren gives it (Song of Above)'],
    cloud_essence: ['Wisps of cloud in Aerie (E to pick one up; they grow back)'],
    dragon_horn: ["Duke Ferrin's gift to the Dragon Killers"],
    dragon_scale: ['The Fang, first kill: 10'],
    fang_of_the_fang: ['The Fang, first kill'],
    guild_cape: ['The Hollowford Guild board at Captain rank: 500 coins'],
  };
  // gathering that lives in feature files (jungle trees 25-elves, mithril 24-dwarves, obsidian 27-dragons, berries 34-food, lobster 26-boats)
  const GATHER_EXTRA = {
    jungle_log: [{ text: 'Chop a jungle tree in The Jungle with an axe · Woodcutting 15 · 60 xp', skill: 'woodcutting', lv: 15, what: 'Chop jungle trees (jungle logs)' }],
    mithril_ore: [{ text: 'Mine a mithril rock in Deepholm with a pickaxe · Mining 20 · 80 xp', skill: 'mining', lv: 20, what: 'Mine mithril rock in Deepholm' }],
    obsidian: [{ text: 'Mine obsidian in the Ashfields with a pickaxe · Mining 28 · 120 xp', skill: 'mining', lv: 28, what: 'Mine obsidian in the Ashfields' }],
    berries: [{ text: 'Pick a berry bush (E). It grows back in a couple of minutes.' }],
    raw_shrimp: [{ text: 'Fish at any water with a fishing rod · Fishing 1 · 10 xp', skill: 'fishing', lv: 1, what: 'Fish shrimp at any water' }],
    raw_trout: [{ text: 'Fish at any water with a fishing rod · Fishing 5 (45% of catches) · 30 xp', skill: 'fishing', lv: 5, what: 'Trout start to bite (45% of catches)' }],
    raw_lobster: [{ text: 'Lower a lobster pot at the buoys off Gull Isle · Fishing 25 · 90 xp', skill: 'fishing', lv: 25, what: 'Lobster pots at the buoys off Gull Isle' }],
    potato: [{ text: 'Plant a potato seed on tilled soil (hoe), wait, harvest (E) · Farming', skill: 'farming', lv: 1, what: 'Grow potatoes from seed' }],
    wheat: [{ text: 'Plant a wheat seed on tilled soil (hoe), wait, harvest (E) · Farming', skill: 'farming', lv: 1, what: 'Grow wheat from seed' }],
    burnt_food: [{ text: 'Cook something badly. Cooking level lowers the burn chance (3% a level, none at 10).' }],
  };
  const SKILL_EXTRA = {
    cooking: [{ lv: 1, text: 'Cook raw food at a fire or oven (30% burn chance, 3% less a level)' }, { lv: 10, text: 'Nothing burns any more' }],
    firemaking: [{ lv: 1, text: 'Light logs on open ground (Light fire in the pack)' }, { lv: 1, text: 'Oak and jungle logs burn longer' }],
    farming: [{ lv: 1, text: 'Till grass with a hoe, plant potato or wheat seed, harvest when grown' }],
    melee: [{ lv: 5, text: 'Duke Ferrin sends you after the goblin walker (with Woodcutting 3)' }],
    range: [{ lv: 1, text: 'Equip a bow and carry arrows: every hit trains Range' }],
    defence: [{ lv: 1, text: 'Every hit you take trains Defence; each level adds 4 max HP' }],
    smithing: [{ lv: 30, text: "Master Halcyon's cloud forge in Aerie: Godly Plated armour from dragon scales, mithril and obsidian (500 xp a piece)" }],
    agility: [{ lv: 1, text: "The log course south of Hale's yard and the cliff ledge at Grey Quarry" }],
    hitpoints: [{ lv: 1, text: 'Grows as you fight; more Hitpoints, more health' }],
  };
  const QUEST_INFO = {
    main: { giver: 'The Voice, then Duke Ferrin', reward: 'The story: chapter by chapter', kind: 'Main story' },
    bread: { giver: 'Tobin, in Thistledown square', reward: '30 coins', kind: 'Side quest' },
    wren: { giver: 'Old Wren, in his hut in Wolfwood', reward: 'A shortbow', kind: 'Side quest' },
    crypt: { giver: 'The survivors of Hollowford (Old Tam)', reward: '200 coins, a steel helm, 120 Defence xp', kind: 'Side quest' },
    law: { giver: 'Captain Roderick of the Watch, by the castle gate', reward: 'A clean name (pay the fine)', kind: 'Side quest' },
    dwarf: { giver: 'King Thrain, Deepholm (under Grey Quarry)', reward: "300 coins, 200 Smithing xp, Brunhild's forge opens", kind: 'Side quest' },
    elf_queen: { giver: 'Queen Aelith, Sylvaris', reward: "300 coins, 150 Crafting xp, Thessaly's loom opens", kind: 'Side quest' },
    elf_range: { giver: 'Lira the archery master, Sylvaris', reward: "30 elven arrows, 500 Range xp, Lira's shop opens", kind: 'Side quest' },
    dragons: { giver: 'Dunstan the dung farmer, the Ashfields', reward: '150 coins, 150 Farming xp, his stall opens', kind: 'Side quest' },
    board: { giver: 'The notice board in Thistledown square (and by the cave road)', reward: 'Coins and xp per job; the Duke pays a steel bar', kind: 'Tiny quests' },
    tinker: { giver: 'Tinkerton, Grubmarket (the Far Shore)', reward: "400 coins, Tinker's goggles, his shop opens", kind: 'Side quest' },
    gnash: { giver: 'King Gnash, Castle Gnash', reward: 'His treasury: 3 steel bars, 2 mithril bars, his crown', kind: 'Side quest' },
    rebuild: { giver: "The board in Hollowford's square", reward: 'A town again; 500 coins at the end', kind: 'Side quest' },
    guild: { giver: 'Old Tam, Hollowford', reward: 'Ranks, a chest, a cape (500 coins) and staff', kind: 'Side quest' },
    sky: { giver: 'Old Wren, then Queen Seraphel in Aerie', reward: "400 coins, 300 Smithing xp, Halcyon's forge", kind: 'Side quest' },
  };
  // people who live in feature places without a NPCS entry (33-goblincity, 36-skycity, 26-boats)
  const EXTRA_NPCS = {
    'Grubmarket': ['Tinkerton', 'Grubb the cook', 'Nix the scrapper', 'Old Snaggle', 'Pip-squeak'],
    'Castle Gnash': ['King Gnash'],
    'Aerie': ['Queen Seraphel', 'Master Halcyon'],
    'The Grey Sea': ["Old Harl and his ferry (10–40 coins a crossing)"],
    'Gull Isle': ['Salt Pete'],
  };
  const EXTRA_SHOPS = { 'Thistledown': ["Fennick's Stall (buys pelts, tusks, wool, silk, scrap, coal)", 'Master of Skills (capes at level 99)'], 'The Far Shore': [], 'Grubmarket': ["Tinkerton's Lab"], 'Deepholm': ["Brunhild's Forge"], 'Sylvaris': ["Lira's Range", "Thessaly's Loom"], 'Gull Isle': ["Salt Pete's Shack"], 'The Ashfields': ["Dunstan's Dung Farm"] };
  const SHOP_PLACE = { general: 'Thistledown', bakery: 'Thistledown', seeds: 'Thistledown', smith: 'Thistledown', dwarf: 'Deepholm', elf_range: 'Sylvaris', elf_weaver: 'Sylvaris', saltpete: 'Gull Isle', dung: 'The Ashfields', tinkerton: 'Grubmarket' };

  // ---------- helpers ----------
  const pct = v => { const p = Math.round(v * 100) / 100; return (p >= 10 || p === Math.floor(p)) ? String(Math.round(p * 10) / 10) : String(p); };
  const qtyText = (a, b) => a === b ? `${a}` : `${a}–${b}`;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const skillName = key => { const s = SKILL_DEFS.find(s => s.key === key); return s ? s.name : cap(key); };
  const itemName = id => (ITEMS[id] && ITEMS[id].name) || id;
  const monsterName = id => (MONSTER_DEFS[id] && MONSTER_DEFS[id].name) || id;
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const regionsNow = () => (window.INSTANCES && INSTANCES.active()) ? REGIONS.slice(1) : REGIONS; // the active instance sits at REGIONS[0]
  const regionNameAt = (tx, ty) => { const r = regionsNow().find(r => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1); return r ? r.name : 'The Wilds'; };
  const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

  // the exact odds rollDrops uses: always 100%; one row of the weighted table (weight / total); the rare table one time in `chance`, then by weight
  function dropRows(type, def) {
    const d = (def && def.drops) || {}; const rows = [];
    for (const [id, a, b] of d.always || []) if (ITEMS[id]) rows.push({ id, min: a, max: b, pct: 100, kind: 'always' });
    if (d.table && d.table.length) { const total = d.table.reduce((s, r) => s + r[3], 0); for (const [id, a, b, w] of d.table) rows.push({ id, min: a, max: b, pct: w / total * 100, kind: 'table' }); }
    if (d.rare && d.rare.table && d.rare.table.length) { const total = d.rare.table.reduce((s, r) => s + r[3], 0); for (const [id, a, b, w] of d.rare.table) rows.push({ id, min: a, max: b, pct: (1 / d.rare.chance) * (w / total) * 100, kind: 'rare', note: `1 in ${d.rare.chance}, then by luck` }); }
    // 40-dozerup: blueprints, one roll a kill (chance 1 = every kill while one is missing)
    const bp = window.DOZERUP && DOZERUP.BLUEPRINT_DROPS && DOZERUP.BLUEPRINT_DROPS[type];
    if (bp) for (const id of bp.pool) if (ITEMS[id]) rows.push({ id, min: 1, max: 1, pct: 100 / bp.chance, kind: 'extra', note: bp.pool.length > 1 ? `1 in ${bp.chance}: one of ${bp.pool.length} blueprints, the ones you are missing first` : bp.chance === 1 ? 'every kill while you are missing it' : `1 in ${bp.chance}, while you are missing it` });
    // 37-dragonkillers: one of four dragon items
    const dk = window.DRAGON_KILLERS && typeof DRAGON_KILLERS.chance === 'function' ? DRAGON_KILLERS.chance(type) : 0;
    if (dk > 0) for (const id of DRAGON_KILLERS.DRAGON_ITEMS) if (ITEMS[id]) rows.push({ id, min: 1, max: 1, pct: dk * 100 / DRAGON_KILLERS.DRAGON_ITEMS.length, kind: 'extra', note: `1 in ${Math.round(1 / dk)} for any dragon item, then one of four` });
    for (const [id, a, b, p, note] of EXTRA_DROPS[type] || []) if (ITEMS[id]) rows.push({ id, min: a, max: b, pct: p, kind: 'extra', note });
    return rows;
  }
  function monsterBlurb(def, e) {
    if (def.harmless) return `${def.name}s do not fight back. They are safe to practise on.`;
    const bits = [];
    bits.push(def.aggro ? 'It attacks you on sight.' : 'It leaves you alone unless you hit it first.');
    if (def.mech) bits.push('A goblin machine: bring it down and its wreck stays. Iron bars and scrap fix it, and then you can drive it.');
    if (def.thrower) bits.push('It throws bombs from a distance.');
    if (def.human) bits.push('It walks like a person and can push through doors.');
    if (e.boss) bits.push('A boss. Bring food, good armour and a plan.');
    return bits.join(' ');
  }

  // ---------- the build ----------
  function build() {
    const out = { order: {} }; for (const s of SECTIONS) out[s] = {};
    // ---- monsters ----
    const where = {};
    const addWhere = (type, place) => { (where[type] = where[type] || new Set()).add(place); };
    for (const s of MONSTER_SPAWNS) addWhere(s.type, regionNameAt(s.tx, s.ty));
    const instNames = [];
    if (window.INSTANCES && typeof INSTANCES.list === 'function') for (const id of INSTANCES.list()) { const inst = INSTANCES.get(id); if (!inst) continue; instNames.push(inst.name); for (const [type] of inst.spawns || []) addWhere(type, inst.name); }
    for (const type in MONSTER_DEFS) {
      const def = MONSTER_DEFS[type];
      const e = { id: type, name: def.name, level: def.level | 0, hp: def.hp, maxHit: def.maxHit, att: def.att, def: def.def, speed: def.speed, aggro: !!def.aggro, human: !!def.human, harmless: !!def.harmless, mech: !!def.mech, respawn: def.respawn,
        boss: BOSS_TYPES.has(type) || ((def.level | 0) >= 25 && def.hp >= 300), where: [...(where[type] || [])], drops: dropRows(type, def) };
      for (const x of EXTRA_WHERE[type] || []) { const place = x.split(/[,—(]/)[0].trim(); const i = e.where.indexOf(place); if (i >= 0) e.where[i] = x; else e.where.push(x); }
      e.tablePct = e.drops.filter(r => r.kind === 'table').reduce((s, r) => s + r.pct, 0);
      e.blurb = monsterBlurb(def, e); out.monsters[type] = e;
    }
    // ---- items ----
    const sources = {}; const src = (id, s) => { if (ITEMS[id]) (sources[id] = sources[id] || []).push(s); };
    for (const type in out.monsters) for (const r of out.monsters[type].drops) if (r.id !== 'nothing') src(r.id, { kind: 'drop', monster: type, pct: r.pct, min: r.min, max: r.max, note: r.note });
    for (const k in SHOPS) for (const [id, price] of SHOPS[k].stock || []) src(id, { kind: 'shop', shop: SHOPS[k].name, price, place: SHOP_PLACE[k] });
    const recipes = [];
    RECIPES.forEach((r, i) => { if (r.station === 'skyforge') return; recipes.push({ id: 'r' + i, name: r.label, out: r.out, qty: r.qty || 1, needs: r.needs, station: r.station, skill: r.skill, lv: r.lv || 1, xp: r.xp || 0 }); });
    SMELT.forEach((r, i) => recipes.push({ id: 's' + i, name: r.label, out: r.out, qty: 1, needs: r.needs, station: 'forge', skill: 'smithing', lv: r.lv || 1, xp: r.xp || 0 }));
    if (window.SKYCITY && Array.isArray(SKYCITY.FORGE)) SKYCITY.FORGE.forEach((f, i) => { if (ITEMS[f.out]) recipes.push({ id: 'f' + i, name: f.label, out: f.out, qty: 1, needs: [['dragon_scale', f.scales], ['mithril_bar', f.mithril], ['obsidian', 1]], station: 'skyforge', skill: 'smithing', lv: 30, xp: 500 }); });
    if (window.DOZERUP && Array.isArray(DOZERUP.UPGRADES)) DOZERUP.UPGRADES.forEach((u, i) => recipes.push({ id: 'u' + i, name: `${u.name} for the bulldozer`, out: null, qty: 1, needs: [[u.blueprint, 1]].concat(u.needs), station: 'dozerbay', skill: 'crafting', lv: u.lv, xp: u.xp, blurb: u.blurb, requires: u.requires }));
    for (const r of recipes) { if (r.out) src(r.out, { kind: 'recipe', recipe: r.id, label: r.name, station: r.station, skill: r.skill, lv: r.lv }); out.recipes[r.id] = r; }
    for (const t in GATHER) { const gth = GATHER[t]; src(gth.item, { kind: 'gather', text: `${gth.tool === 'axe' ? 'Chop' : 'Mine'} a ${gth.label} with ${gth.tool === 'axe' ? 'an axe' : 'a pickaxe'} · ${skillName(gth.skill)} ${gth.lv} · ${gth.xp} xp`, skill: gth.skill, lv: gth.lv, what: `${gth.tool === 'axe' ? 'Chop' : 'Mine'} ${gth.label}s (${itemName(gth.item)})` }); }
    for (const id in GATHER_EXTRA) for (const gx of GATHER_EXTRA[id]) src(id, Object.assign({ kind: 'gather' }, gx));
    for (const id in ITEMS) { const def = ITEMS[id]; if (def.cook && ITEMS[def.cook]) src(def.cook, { kind: 'cook', raw: id, text: `Cook ${def.name} at a fire or oven (Cooking, 30 xp)` }); if (def.seed && ITEMS[def.seed]) { /* the grown crop is listed under GATHER_EXTRA */ } }
    for (const id in GIVEN) for (const t of GIVEN[id]) src(id, { kind: 'given', text: t });
    for (const id in ITEMS) { const def = ITEMS[id]; if (def.capeSkill) src(id, { kind: 'shop', shop: 'Master of Skills (Thistledown)', price: def.value, note: `needs ${skillName(def.capeSkill)} 99` }); }
    const usedIn = {}; for (const r of recipes) for (const [id] of r.needs) (usedIn[id] = usedIn[id] || []).push(r.id);
    for (const id in ITEMS) { const def = ITEMS[id]; out.items[id] = { id, name: def.name, def, sources: sources[id] || [], usedIn: usedIn[id] || [] }; }
    // ---- skills ----
    for (const s of SKILL_DEFS) {
      const unlocks = [];
      for (const r of recipes) if (r.skill === s.key) unlocks.push({ lv: r.lv, text: r.name, link: { s: 'recipes', id: r.id } });
      for (const id in sources) for (const g of sources[id]) if (g.kind === 'gather' && g.skill === s.key) unlocks.push({ lv: g.lv, text: g.what || g.text, link: { s: 'items', id } });
      for (const x of SKILL_EXTRA[s.key] || []) unlocks.push(x);
      if (ITEMS['cape_' + s.key]) unlocks.push({ lv: 99, text: `${s.name} cape from the Master of Skills (999 coins)`, link: { s: 'items', id: 'cape_' + s.key } });
      unlocks.sort((a, b) => a.lv - b.lv);
      const milestones = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99].map(lv => ({ lv, xp: XP_TABLE[lv] }));
      out.skills[s.key] = { id: s.key, name: s.name, needs: s.needs, unlocks, milestones };
    }
    // ---- places ----
    const placeMonsters = {}, placeIds = {};
    const addPlace = (name, sub, rect, kind) => { const id = slug(name); if (out.places[id]) return out.places[id]; const p = { id, name, sub: sub || '', rect, kind, monsters: {}, npcs: [], shops: [], stations: [], buildings: [] }; out.places[id] = p; placeIds[name] = id; return p; };
    for (const r of regionsNow()) addPlace(r.name, r.sub, { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }, 'region');
    if (window.INSTANCES && typeof INSTANCES.list === 'function') for (const id of INSTANCES.list()) { const inst = INSTANCES.get(id); if (inst) addPlace(inst.name, inst.sub, null, 'instance'); }
    for (const type in where) for (const name of where[type]) { const p = out.places[placeIds[name]] || addPlace(name, '', null, 'region'); p.monsters[type] = (p.monsters[type] || 0) + 1; }
    for (const type in EXTRA_WHERE) { const m = EXTRA_WHERE[type][0].split(/[,—(]/)[0].trim(); const p = out.places[slug(m)]; if (p && !p.monsters[type]) p.monsters[type] = 1; }
    const spawnCount = {}; for (const s of MONSTER_SPAWNS) { const k = s.type + '|' + regionNameAt(s.tx, s.ty); spawnCount[k] = (spawnCount[k] || 0) + 1; }
    if (window.INSTANCES && typeof INSTANCES.list === 'function') for (const id of INSTANCES.list()) { const inst = INSTANCES.get(id); if (inst) for (const [type] of inst.spawns || []) { const k = type + '|' + inst.name; spawnCount[k] = (spawnCount[k] || 0) + 1; } }
    for (const pid in out.places) { const p = out.places[pid]; for (const type in p.monsters) { const n = spawnCount[type + '|' + p.name]; if (n) p.monsters[type] = n; } }
    const placeOf = (tx, ty) => out.places[placeIds[regionNameAt(tx, ty)]];
    for (const n of NPCS) { if (!(typeof n.x === 'number')) continue; const p = placeOf(n.x, n.y); if (!p) continue; const shop = n.shop && SHOPS[n.shop] ? ` — ${SHOPS[n.shop].name}` : ''; p.npcs.push(n.name + shop); if (n.shop && SHOPS[n.shop]) p.shops.push(SHOPS[n.shop].name); }
    for (const b of BUILDINGS) { const p = placeOf(b.x + Math.floor(b.w / 2), b.y + Math.floor(b.h / 2)); if (p && b.name && b.name !== 'House' && b.name !== 'Hut' && !p.buildings.includes(b.name)) p.buildings.push(b.name); }
    for (const name in EXTRA_NPCS) { const p = out.places[slug(name)]; if (p) for (const n of EXTRA_NPCS[name]) if (!p.npcs.some(x => x.startsWith(n))) p.npcs.push(n); }
    for (const name in EXTRA_SHOPS) { const p = out.places[slug(name)]; if (p) for (const s of EXTRA_SHOPS[name]) if (!p.shops.includes(s)) p.shops.push(s); }
    if (!(window.INSTANCES && INSTANCES.active())) { // the overworld map only: stations by region
      const STATIONS = [[T.ANVIL, 'Anvil'], [T.FORGE, 'Forge'], [T.WORKBENCH, 'Workbench'], [T.WORKSHOP, "Tinker's table"], [T.ALCHEMY, 'Alchemy table'], [T.OVEN, 'Oven'], [T.DUMMY, 'Training dummies'], [T.LODESTONE, 'Lodestone']];
      const want = new Map(STATIONS.map(([t, n]) => [t, n]));
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const t = map[y * MAP_W + x]; const n = want.get(t); if (!n) continue; const p = placeOf(x, y); if (p && !p.stations.includes(n)) p.stations.push(n); }
    }
    for (const pid in out.places) { const p = out.places[pid]; p.monsterList = Object.keys(p.monsters).map(type => ({ type, n: p.monsters[type] })).sort((a, b) => (out.monsters[a.type] ? out.monsters[a.type].level : 0) - (out.monsters[b.type] ? out.monsters[b.type].level : 0)); }
    // ---- quests ----
    for (const id in QUEST_DEFS) { const info = QUEST_INFO[id] || {}; out.quests[id] = { id, name: QUEST_DEFS[id].name, giver: info.giver || 'Ask around', reward: info.reward || 'Find out', kind: info.kind || (id === 'main' ? 'Main story' : 'Side quest') }; }
    // ---- custom pages ----
    for (const s of SECTIONS) for (const id in custom[s]) out[s][id] = Object.assign(out[s][id] ? { ...out[s][id] } : { id, name: id }, custom[s][id]);
    // ---- order: monsters by level, items by name, recipes by station then level, skills as defined, places as defined, quests as defined ----
    out.order.monsters = Object.keys(out.monsters).sort((a, b) => (out.monsters[a].level - out.monsters[b].level) || out.monsters[a].name.localeCompare(out.monsters[b].name));
    out.order.items = Object.keys(out.items).sort((a, b) => out.items[a].name.localeCompare(out.items[b].name));
    const stOrder = ['null', 'workbench', 'workshop', 'alchemy', 'oven', 'forge', 'anvil', 'loom', 'skyforge', 'dozerbay'];
    out.order.recipes = Object.keys(out.recipes).sort((a, b) => { const A = out.recipes[a], B = out.recipes[b]; return (stOrder.indexOf(String(A.station)) - stOrder.indexOf(String(B.station))) || (A.lv - B.lv) || A.name.localeCompare(B.name); });
    out.order.skills = Object.keys(out.skills);
    out.order.places = Object.keys(out.places).sort((a, b) => { const A = out.places[a], B = out.places[b]; const wild = n => n === 'The Wilds' ? 2 : n === 'Goblin Fields' ? 1 : 0; return (wild(A.name) - wild(B.name)) || (A.kind === B.kind ? 0 : A.kind === 'region' ? -1 : 1); });
    out.order.quests = Object.keys(out.quests);
    return out;
  }
  const ensure = () => data || (data = build());

  // ---------- panel state ----------
  const wk = { section: 'monsters', id: null, search: '', letter: '', page: 0, detailPage: 0, view: 'list', history: [] };
  const listFor = section => {
    const d = ensure(); const q = wk.search.trim().toLowerCase(), L = wk.letter;
    return d.order[section].filter(id => { const n = d[section][id].name.toLowerCase(); return q ? n.includes(q) : L ? n.startsWith(L.toLowerCase()) : true; });
  };
  function open(section, id, push = true) {
    ensure();
    if (!SECTIONS.includes(section)) section = 'monsters';
    if (push && wk.id && (wk.section !== section || wk.id !== id)) { wk.history.push({ s: wk.section, id: wk.id }); if (wk.history.length > 20) wk.history.shift(); }
    wk.section = section; wk.detailPage = 0;
    if (id && data[section][id]) { wk.id = id; wk.view = 'detail'; const list = listFor(section); const i = list.indexOf(id); if (i < 0) { wk.search = ''; wk.letter = ''; } }
    else { wk.id = null; wk.view = 'list'; }
    if (panel !== 'wiki') openPanel('wiki');
  }
  function setSection(s) { wk.section = s; wk.page = 0; wk.detailPage = 0; wk.id = null; wk.view = 'list'; wk.search = ''; wk.letter = ''; }

  // ---------- text lines for a page ----------
  // a line: { t, c, f, link: {s, id}, icon: itemId, head }
  const H = (t) => ({ t, c: '#f5c542', f: 'bold 12px sans-serif', head: true });
  const P = (t, c) => ({ t, c: c || '#c9d1d9' });
  const L = (t, s, id, icon, c) => ({ t, c: c || '#7ec8ff', link: { s, id }, icon });
  function pageLines(section, id) {
    const d = ensure(); const e = d[section][id]; const out = []; if (!e) return out;
    if (custom[section][id] && custom[section][id].lines) { for (const l of custom[section][id].lines) out.push(typeof l === 'string' ? P(l) : l); return out; }
    if (section === 'monsters') {
      out.push(P(`${e.boss ? 'BOSS · ' : ''}Combat level ${e.level} · ${e.hp} HP · hits up to ${e.maxHit}`, '#e6edf3'));
      out.push(P(`Attack ${e.att} · Defence ${e.def} · ${e.aggro ? 'Attacks on sight' : e.harmless ? 'Never fights' : 'Peaceful until hit'}`));
      if (e.blurb) out.push(P(e.blurb, '#8b949e'));
      out.push(H('WHERE TO FIND IT'));
      if (!e.where.length) out.push(P('Nobody has seen one yet.', '#8b949e'));
      for (const w of e.where) { const pid = slug(w.split(/[,—(]/)[0].trim()); out.push(d.places[pid] ? L(w, 'places', pid) : P(w)); }
      out.push(H('WHAT IT DROPS'));
      if (!e.drops.length) out.push(P('Nothing at all.', '#8b949e'));
      const kinds = [['always', 'Every time'], ['table', 'One of these each kill'], ['rare', 'Rare'], ['extra', 'Special']];
      for (const [k, title] of kinds) { const rows = e.drops.filter(r => r.kind === k); if (!rows.length) continue; out.push(P(title + ':', '#8b949e'));
        for (const r of rows) { if (r.id === 'nothing') { out.push(P(`   Nothing · ${pct(r.pct)}%`, '#6e7681')); continue; } out.push(L(`${itemName(r.id)} × ${qtyText(r.min, r.max)} · ${pct(r.pct)}%${r.note ? ' · ' + r.note : ''}`, 'items', r.id, r.id)); } }
      if (e.respawn) out.push(P(`Comes back after about ${e.respawn >= 1e8 ? 'never (once only)' : e.respawn >= 60 ? Math.round(e.respawn / 60) + ' min' : e.respawn + ' s'}.`, '#6e7681'));
    }
    if (section === 'items') {
      const def = e.def || ITEMS[id] || {};
      out.push(P(itemBlurb(def), '#e6edf3'));
      out.push(P(`Worth ${def.value} coins · stacks to ${def.stack >= 1e6 ? 'any number' : def.stack}`));
      if (def.weapon) out.push(P(`Weapon: strength +${def.weapon.str}, accuracy +${def.weapon.att}, swing every ${def.weapon.cd}s${def.weapon.perk ? ', perk: ' + def.weapon.perk : ''}${def.weapon.ranged ? ', shoots arrows' : ''}`));
      if (def.armour) out.push(P(`Worn on the ${def.armour.slot}: defence +${def.armour.def}${def.wings ? ' · has wings' : ''}`));
      if (def.tool) out.push(P(`Tool: ${def.tool}, tier ${def.tier}`));
      if (def.arrow) out.push(P(`Arrows: strength +${def.arrow.str}`));
      if (def.heal) out.push(P(`Eat it to heal ${def.heal}`));
      if (def.capeSkill) out.push(P(`Skill cape: ${skillName(def.capeSkill)}`));
      out.push(H('HOW TO GET IT'));
      if (!e.sources.length) out.push(P('Nobody knows yet. Keep exploring.', '#8b949e'));
      const drops = e.sources.filter(s => s.kind === 'drop').sort((a, b) => b.pct - a.pct);
      if (drops.length) { out.push(P('Dropped by:', '#8b949e')); for (const s of drops) out.push(L(`${monsterName(s.monster)} · ${pct(s.pct)}%${s.min !== undefined ? ' · × ' + qtyText(s.min, s.max) : ''}`, 'monsters', s.monster)); }
      const shops = e.sources.filter(s => s.kind === 'shop');
      if (shops.length) { out.push(P('Buy it:', '#8b949e')); for (const s of shops) { const pid = s.place ? slug(s.place) : null; out.push(pid && d.places[pid] ? L(`${s.shop} · ${s.price} coins${s.note ? ' · ' + s.note : ''}`, 'places', pid) : P(`${s.shop} · ${s.price} coins${s.note ? ' · ' + s.note : ''}`)); } }
      const recs = e.sources.filter(s => s.kind === 'recipe');
      if (recs.length) { out.push(P('Make it:', '#8b949e')); for (const s of recs) out.push(L(`${s.label} · ${STATION_NAME[s.station] || s.station} · ${skillName(s.skill)} ${s.lv}`, 'recipes', s.recipe)); }
      const gath = e.sources.filter(s => s.kind === 'gather' || s.kind === 'cook');
      if (gath.length) { out.push(P('Gather it:', '#8b949e')); for (const s of gath) out.push(s.kind === 'cook' ? L(s.text, 'items', s.raw) : P(s.text)); }
      const given = e.sources.filter(s => s.kind === 'given');
      if (given.length) { out.push(P('Given or found:', '#8b949e')); for (const s of given) out.push(P(s.text)); }
      if (e.usedIn.length) { out.push(H('USED FOR')); for (const rid of e.usedIn) if (d.recipes[rid]) out.push(L(d.recipes[rid].name, 'recipes', rid)); }
    }
    if (section === 'recipes') {
      out.push(P(`${STATION_NAME[String(e.station)] || (e.station === 'dozerbay' ? 'The bulldozer bay (Hollowford)' : e.station)}`, '#e6edf3'));
      out.push(P(`${skillName(e.skill)} level ${e.lv} · ${e.xp} xp`));
      if (e.blurb) out.push(P(e.blurb, '#8b949e'));
      if (e.requires) out.push(P(`Needs the ${e.requires} fitted first.`, '#8b949e'));
      out.push(H('YOU NEED'));
      for (const [nid, n] of e.needs) out.push(L(`${n} × ${itemName(nid)}`, 'items', nid, nid));
      if (e.out) { out.push(H('YOU GET')); out.push(L(`${e.qty} × ${itemName(e.out)}`, 'items', e.out, e.out)); }
    }
    if (section === 'skills') {
      const lv = player.skills[id] ? levelForXp(player.skills[id].xp) : 1;
      out.push(P(`Your level: ${lv}${e.needs ? ' · trains with ' + e.needs : ''}`, '#e6edf3'));
      if (id === 'melee' || id === 'defence' || id === 'range') out.push(P('Combat level = (Melee + Defence) / 2 + Range / 4', '#8b949e'));
      out.push(H('WHAT EACH LEVEL UNLOCKS'));
      if (!e.unlocks.length) out.push(P('It just gets better as it grows.', '#8b949e'));
      for (const u of e.unlocks) out.push(u.link ? L(`Lv ${u.lv}: ${u.text}`, u.link.s, u.link.id, undefined, lv >= u.lv ? '#7ec8ff' : '#8fa2b8') : P(`Lv ${u.lv}: ${u.text}`, lv >= u.lv ? '#c9d1d9' : '#8b949e'));
      out.push(H('XP TO REACH'));
      for (const m of e.milestones) out.push(P(`Level ${m.lv}: ${m.xp.toLocaleString()} xp`, lv >= m.lv ? '#c9d1d9' : '#8b949e'));
    }
    if (section === 'places') {
      if (e.sub) out.push(P(e.sub, '#e6edf3'));
      out.push(P(e.kind === 'instance' ? 'A place of its own: walk in through its door.' : e.rect ? `On the map at ${e.rect.x0}–${e.rect.x1} across, ${e.rect.y0}–${e.rect.y1} down.` : '', '#8b949e'));
      out.push(H('WHO LIVES HERE'));
      if (!e.monsterList.length) out.push(P('No monsters spawn here.', '#8b949e'));
      for (const m of e.monsterList) out.push(L(`${monsterName(m.type)}${m.n > 1 ? ' × ' + m.n : ''}${d.monsters[m.type] ? ' · lv ' + d.monsters[m.type].level : ''}`, 'monsters', m.type));
      if (e.npcs.length) { out.push(H('PEOPLE')); for (const n of e.npcs) out.push(P(n)); }
      if (e.shops.length) { out.push(H('SHOPS')); for (const s of e.shops) out.push(P(s)); }
      if (e.stations.length) { out.push(H('STATIONS')); out.push(P(e.stations.join(' · '))); }
      if (e.buildings.length) { out.push(H('BUILDINGS')); for (const b of e.buildings) out.push(P(b)); }
    }
    if (section === 'quests') {
      out.push(P(e.kind, '#e6edf3'));
      out.push(P(`From: ${e.giver}`));
      out.push(P(`Reward: ${e.reward}`));
      let now = null; try { now = questText(id); } catch (err) { now = null; }
      const active = (() => { try { return activeQuests().includes(id); } catch (err) { return false; } })();
      out.push(H(active ? 'RIGHT NOW' : 'STATUS'));
      out.push(P(now || (active ? 'In progress.' : 'Not started, or done.'), active ? '#c9d1d9' : '#8b949e'));
    }
    return out;
  }
  function wrapLines(g, text, maxW) { const words = String(text).split(' '); const lines = []; let line = ''; for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; } if (line) lines.push(line); return lines; }

  // ---------- the panel ----------
  const btn = (g, x, y, w, h, label, action, color, enabled) => button(g, x, y, w, h, label, action, color, enabled);
  HOOKS.panel.wiki = (g, narrow) => {
    const d = ensure();
    const touch = touchMode();
    const W = Math.min(780, VW - 20), Hh = Math.min(560, VH - 20);
    const { px, py, w, h } = panelBox(g, W, Hh, `Wiki${touch ? '' : ' (K)'}`, touch ? 'Tap a tab, then a letter, then a page. Blue lines open other pages.' : 'Type to search the list. Blue lines open other pages. Esc closes.');
    // tabs
    const tabW = Math.floor((w - 36 - 5 * 4) / 6), ty = py + 56;
    SECTIONS.forEach((s, i) => { const on = s === wk.section; btn(g, px + 18 + i * (tabW + 4), ty, tabW, 26, narrow ? SECTION_SHORT[s] : SECTION_NAME[s], () => setSection(s), on ? '#238636' : '#21262d', !on); });
    let top = ty + 34;
    const showList = !narrow || wk.view === 'list';
    const showDetail = !narrow || wk.view === 'detail';
    const listW = narrow ? w - 36 : touch ? 330 : 250, listX = px + 18;
    const detX = narrow ? px + 18 : listX + listW + 16, detW = narrow ? w - 36 : w - 36 - listW - 16;
    const list = listFor(wk.section);
    if (showList) {
      // search: a typed field on desktop, a letter row on touch
      if (!touch) {
        roundRect(g, listX, top, listW, 26, 6); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fill(); g.strokeStyle = '#30363d'; g.lineWidth = 1; g.stroke();
        g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillStyle = wk.search ? '#e6edf3' : '#6e7681'; g.fillText(wk.search ? wk.search + (Math.floor(time * 2) % 2 ? '|' : ' ') : 'Search: just type', listX + 8, top + 17);
        if (wk.search) btn(g, listX + listW - 54, top + 1, 52, 24, 'Clear', () => { wk.search = ''; wk.page = 0; }, '#21262d');
        top += 32;
      } else {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''); const perRow = 9, lw = Math.floor((listW - (perRow - 1) * 3) / perRow), lh = 24;
        letters.forEach((c, i) => { const on = wk.letter === c; btn(g, listX + (i % perRow) * (lw + 3), top + Math.floor(i / perRow) * (lh + 4), lw, lh, c, () => { wk.letter = on ? '' : c; wk.page = 0; }, on ? '#238636' : '#21262d'); });
        top += 3 * (lh + 4);
        btn(g, listX, top, 70, 24, 'Clear', () => { wk.letter = ''; wk.search = ''; wk.page = 0; }, '#21262d', !!(wk.letter || wk.search));
        g.fillStyle = '#8b949e'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText(`${list.length} ${wk.letter ? 'starting with ' + wk.letter : 'in all'}`, listX + 80, top + 16);
        top += 30;
      }
      const rowH = 26, pagerY = py + h - 40, rows = Math.max(1, Math.floor((pagerY - 8 - top) / rowH));
      const pages = Math.max(1, Math.ceil(list.length / rows)); wk.page = clamp(wk.page, 0, pages - 1);
      const slice = list.slice(wk.page * rows, wk.page * rows + rows);
      if (!list.length) { g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText('Nothing matches.', listX + 4, top + 18); }
      slice.forEach((id, i) => {
        const e = d[wk.section][id], y = top + i * rowH, on = id === wk.id;
        roundRect(g, listX, y, listW, rowH - 3, 6); g.fillStyle = on ? 'rgba(88,166,255,0.2)' : 'rgba(255,255,255,0.05)'; g.fill();
        let tx = listX + 8;
        if (wk.section === 'items') { drawItemIcon(g, id, listX + 14, y + rowH / 2 - 2, 14); tx = listX + 28; }
        g.fillStyle = on ? '#e6edf3' : '#c9d1d9'; g.font = on ? 'bold 12px sans-serif' : '12px sans-serif'; g.textAlign = 'left';
        let label = e.name; const extra = wk.section === 'monsters' ? `  lv ${e.level}` : wk.section === 'recipes' ? `  lv ${e.lv}` : '';
        const maxW = listW - (tx - listX) - 8 - (extra ? g.measureText(extra).width : 0);
        while (label.length > 6 && g.measureText(label).width > maxW) label = label.slice(0, -2) + '…';
        g.fillText(label, tx, y + 16);
        if (extra) { g.fillStyle = '#6e7681'; g.textAlign = 'right'; g.fillText(extra.trim(), listX + listW - 6, y + 16); }
        buttons.push({ x: listX, y, w: listW, h: rowH - 3, label: `wiki:${wk.section}:${id}`, action: () => { open(wk.section, id); } });
      });
      if (pages > 1) pager(g, listX, pagerY, listW, wk.page, pages, p => { wk.page = clamp(p, 0, pages - 1); });
      else { g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText(`${list.length} page${list.length === 1 ? '' : 's'}`, listX, pagerY + 19); }
    }
    if (showDetail) {
      let dy = narrow ? ty + 34 : top - (touch ? 0 : 0);
      if (narrow) { btn(g, detX, dy, 70, 26, 'Back', () => { wk.view = 'list'; wk.id = null; }, '#21262d'); dy += 32; }
      else if (wk.history.length) { btn(g, detX + detW - 70, ty + 34, 70, 26, 'Back', () => { const p = wk.history.pop(); if (p) open(p.s, p.id, false); }, '#21262d'); }
      if (!wk.id || !d[wk.section][wk.id]) {
        g.fillStyle = '#8b949e'; g.font = '13px sans-serif'; g.textAlign = 'left';
        const intro = { monsters: 'Pick a monster to see how tough it is, where it lives and exactly what it drops.', items: 'Pick an item to see what it does and every way to get one.', recipes: 'Every recipe, by station: what you need, what you get, and the level for it.', skills: 'What each skill unlocks at every level, and how much xp a level takes.', places: 'Every region and dungeon: who lives there, who trades there, what you can use there.', quests: 'Every quest, who gives it and what it pays.' }[wk.section];
        wrapText(g, intro, detX, dy + 30, detW, 18);
        return;
      }
      const e = d[wk.section][wk.id];
      g.fillStyle = '#e6edf3'; g.font = `700 16px ${DISPLAY}`; g.textAlign = 'left';
      let title = e.name; while (title.length > 6 && g.measureText(title).width > detW - (wk.section === 'items' ? 30 : 0) - (narrow ? 0 : 76)) title = title.slice(0, -2) + '…';
      if (wk.section === 'items') { drawItemIcon(g, wk.id, detX + 12, dy + 12, 22); g.fillText(title, detX + 30, dy + 19); } else g.fillText(title, detX, dy + 19);
      dy += 30;
      // lay the page out as wrapped rows, then show one screen of them
      g.font = '12px sans-serif';
      const rows = [];
      for (const l of pageLines(wk.section, wk.id)) { const indent = l.icon ? 22 : 0; const ls = wrapLines(g, l.t, detW - indent - 4); ls.forEach((t, i) => rows.push({ t, c: l.c, f: l.f, link: l.link, icon: i === 0 ? l.icon : null, head: l.head, first: i === 0, indent })); }
      const lh = 18, pagerY = py + h - 40, per = Math.max(3, Math.floor((pagerY - 6 - dy) / lh)), pages = Math.max(1, Math.ceil(rows.length / per));
      wk.detailPage = clamp(wk.detailPage, 0, pages - 1);
      const shown = rows.slice(wk.detailPage * per, wk.detailPage * per + per);
      shown.forEach((r, i) => {
        const y = dy + i * lh + (r.head ? 4 : 0);
        if (r.link) { roundRect(g, detX - 4, y - 2, detW + 4, lh - 1, 5); g.fillStyle = 'rgba(126,200,255,0.08)'; g.fill(); }
        if (r.icon) drawItemIcon(g, r.icon, detX + 9, y + 7, 14);
        g.fillStyle = r.c || '#c9d1d9'; g.font = r.f || (r.link ? 'bold 12px sans-serif' : '12px sans-serif'); g.textAlign = 'left'; g.fillText(r.t, detX + r.indent, y + 12);
        if (r.link && r.first) buttons.push({ x: detX - 4, y: y - 2, w: detW + 4, h: lh - 1, label: `wikilink:${r.link.s}:${r.link.id}`, action: () => open(r.link.s, r.link.id) });
      });
      if (pages > 1) { btn(g, detX, pagerY, 60, 30, 'Up', () => { wk.detailPage = Math.max(0, wk.detailPage - 1); }, '#21262d', wk.detailPage > 0); g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText(`${wk.detailPage + 1} / ${pages}`, detX + detW / 2, pagerY + 19); btn(g, detX + detW - 60, pagerY, 60, 30, 'Down', () => { wk.detailPage = Math.min(pages - 1, wk.detailPage + 1); }, '#21262d', wk.detailPage < pages - 1); }
    }
  };

  // ---------- keys: K opens (on a monster you face: its page); letters type into the search while the book is open ----------
  // Wrapped, not hooked: the core's own key handling (I, C, J...) runs at the top of update(), so typed letters must be taken before it.
  const KEYCHARS = {}; for (let i = 0; i < 26; i++) KEYCHARS['Key' + String.fromCharCode(65 + i)] = String.fromCharCode(97 + i); for (let i = 0; i < 10; i++) KEYCHARS['Digit' + i] = String(i); KEYCHARS.Space = ' '; KEYCHARS.Minus = '-'; KEYCHARS.Quote = "'";
  function facingMonster() {
    let best = null;
    for (const m of monsters) { if (m.dead) continue; const dd = dist(player.x, player.y, m.x, m.y); if (dd > 2 * TILE + m.r) continue; const dot = ((m.x - player.x) * player.facing.x + (m.y - player.y) * player.facing.y) / (dd || 1); const score = dd - (dot > 0.3 ? TILE : 0); if (!best || score < best.score) best = { m, score }; }
    return best ? best.m : null;
  }
  const _update = update;
  update = function (dt) {
    const titleUp = typeof title !== 'undefined' && title && title.active;
    if (!paused && !titleUp) {
      if (panel === 'wiki' && !touchMode()) {
        let typed = false;
        for (const code of [...pressed]) { if (KEYCHARS[code] !== undefined) { if (wk.search.length < 24) wk.search += KEYCHARS[code]; pressed.delete(code); keys.delete(code); typed = true; } else if (code === 'Backspace') { wk.search = wk.search.slice(0, -1); pressed.delete(code); keys.delete(code); typed = true; } }
        if (typed) { wk.page = 0; if (wk.id) { wk.id = null; wk.view = 'list'; } }
      } else if (pressed.has('KeyK') && !player.dead) {
        pressed.delete('KeyK');
        if (!panel) { const m = facingMonster(); if (m) open('monsters', m.type); else open(wk.section, wk.id, false); }
      }
    }
    return _update(dt);
  };

  // ---------- buttons: WIKI on the HUD, Wiki under an item in the pack ----------
  // Placement (never over another button, the minimap or the quest box):
  //   desktop → right of the HP box at (274, 14): the spec's VW/2+168 sits under the quest box on a 1280 screen.
  //   touch, wide → left of MENU at (VW/2-96, 14): VW/2+168 would touch the minimap on a 768 tablet.
  //   touch, narrow phone → beside HELP at (VW-74-64, stackBottom-28): the core puts the quest box straight under the stack
  //   (qy = topStackBottom + 10, drawn before HOOKS.hud runs), so "under the stack" would sit on the quest box.
  function wikiButtonRect(narrow) {
    if (!isTouch) return { x: 274, y: 14, w: 72, h: 26, label: 'Wiki (K)' };
    if (!narrow) return { x: VW / 2 - 96, y: 14, w: 60, h: 26, label: 'WIKI' };
    return { x: VW - 74 - 64, y: HUD_LAYOUT.topStackBottom - 28, w: 60, h: 28, label: 'WIKI' };
  }
  HOOKS.hud.push((g, narrow) => {
    if (typeof title !== 'undefined' && title && title.active) return;
    if (paused) return;
    const r = wikiButtonRect(narrow);
    button(g, r.x, r.y, r.w, r.h, r.label, () => panel === 'wiki' ? closePanel() : open(wk.section, wk.id, false), '#21262d');
    // the pack panel is drawn after this hook, so the Wiki button for the selected item is registered on the next frame's pass — it is drawn here from the
    // same numbers the core uses (panelBox size, grid, Equip/Drop row), sitting one row under the Equip / Drop buttons.
    if (panel === 'inventory' && selectedSlot >= 0 && player.inv[selectedSlot]) {
      const cols = narrow ? 5 : 10, size = narrow ? 44 : 46, gap = 6, eqw = 70;
      const pw = Math.min(cols * (size + gap) + 30 + eqw, VW - 20), ph = Math.min(narrow ? 440 : 300, VH - 20);
      const px = Math.round(VW / 2 - pw / 2), py = Math.round(Math.max(10, VH / 2 - ph / 2 - 20));
      const gy = py + 66 + Math.ceil(INV_SLOTS / cols) * (size + gap);
      const id = player.inv[selectedSlot].id;
      wikiInvButton = { x: px + 18 + eqw, y: gy + 58 + 36, w: 90, h: 26, id };
    } else wikiInvButton = null;
  });
  let wikiInvButton = null;
  // drawn after the pack panel (a panel hook cannot run for a core panel, so the button is painted by a wrapped render: see below)
  const _render = typeof render === 'function' ? render : null;
  if (_render) render = function () { const r = _render.apply(this, arguments); if (panel === 'inventory' && wikiInvButton && !paused) { const b = wikiInvButton; button(ctx, b.x, b.y, b.w, b.h, 'Wiki', () => open('items', b.id), '#1f4e78'); } return r; };

  window.WIKI = {
    sections: SECTIONS, state: wk,
    add(section, entry) { if (!SECTIONS.includes(section) || !entry || !entry.id) return false; custom[section][entry.id] = Object.assign({ name: entry.id }, entry); data = null; return true; },
    get(section, id) { const d = ensure(); return (d[section] && d[section][id]) || null; },
    open, rebuild() { data = null; return ensure(); }, lines: pageLines, list: listFor,
  };
  HOOKS.newGame.push(() => { data = null; wk.search = ''; wk.letter = ''; wk.id = null; wk.view = 'list'; wk.history.length = 0; });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'wiki: ';
    const d = WIKI.rebuild();
    // every monster has a page; weighted tables sum to 100
    { const bad = [], noPage = []; for (const type in MONSTER_DEFS) { const e = d.monsters[type]; if (!e) { noPage.push(type); continue; } if (MONSTER_DEFS[type].drops && MONSTER_DEFS[type].drops.table && MONSTER_DEFS[type].drops.table.length && Math.abs(e.tablePct - 100) > 0.01) bad.push([type, e.tablePct]); }
      const gob = d.monsters.goblin; const coin = gob && gob.drops.find(r => r.id === 'coins'), scrap = gob && gob.drops.find(r => r.id === 'goblin_scrap'), dag = gob && gob.drops.find(r => r.id === 'iron_dagger');
      const exact = !!coin && coin.pct === 100 && !!scrap && Math.abs(scrap.pct - 22.5) < 1e-9 && !!dag && Math.abs(dag.pct - (1 / 40) * (3 / 4) * 100) < 1e-9;
      check(P + 'every monster has a page; weighted drop tables sum to 100%; goblin odds match rollDrops (coins 100%, scrap 18/80, iron dagger 1/40 × 3/4)', noPage.length === 0 && bad.length === 0 && exact, { monsters: Object.keys(d.monsters).length, noPage, bad, coin: coin && coin.pct, scrap: scrap && scrap.pct, dag: dag && dag.pct }); }
    // every item has a page; the sourceless ones are listed
    { const noPage = [], noSource = []; for (const id in ITEMS) { const e = d.items[id]; if (!e) noPage.push(id); else if (!e.sources.length) noSource.push(id); }
      check(P + 'every item has a page', noPage.length === 0, { items: Object.keys(d.items).length, noPage });
      check(P + 'items with no known source', true, { count: noSource.length, ids: noSource }); }
    { const counts = {}; for (const s of SECTIONS) counts[s] = Object.keys(d[s]).length; check(P + 'sections built (counts)', SECTIONS.every(s => counts[s] > 0), counts); }
    // cross-link: goblin → its coin drop → the coins page → back to the goblin
    { closePanel(); WIKI.open('monsters', 'goblin'); render(); const onGob = panel === 'wiki' && wk.section === 'monsters' && wk.id === 'goblin'; const c1 = F.clickButton('wikilink:items:coins'); const onCoins = wk.section === 'items' && wk.id === 'coins'; const c2 = F.clickButton('wikilink:monsters:goblin'); const back = wk.section === 'monsters' && wk.id === 'goblin'; closePanel();
      check(P + 'cross-links: goblin page → tap its coin drop → coins page → tap "dropped by Goblin soldier" → goblin page', onGob && c1 && onCoins && c2 && back, { onGob, c1, onCoins, c2, back }); }
    // search narrows
    { closePanel(); const prev = window.__forceTouch; window.__forceTouch = false; WIKI.open('monsters', null); wk.search = ''; const all = WIKI.list('monsters').length; F.press('KeyG'); F.press('KeyO'); F.press('KeyB'); const typed = wk.search; const list = WIKI.list('monsters'); const ok = typed === 'gob' && list.length > 0 && list.length < all && list.every(id => /gob/i.test(d.monsters[id].name)) && panel === 'wiki';
      const i0 = panel; F.press('KeyI'); const stillWiki = panel === 'wiki' && wk.search === 'gobi'; // letters go to the search, not to the pack
      wk.search = ''; closePanel(); window.__forceTouch = prev;
      check(P + 'typing "gob" narrows the monster list to goblins; letters go to the search box, not to the panels', ok && stillWiki, { typed, all, narrowed: list.length, list, i0, stillWiki }); }
    // K on a monster you face
    { closePanel(); const o = h.openSpot(40, 24); F.tp(o.x, o.y); player.facing = { x: 1, y: 0 }; const gob = monsters.find(m => m.type === 'goblin'); const s0 = { x: gob.x, y: gob.y, dead: gob.dead, hp: gob.hp, state: gob.state }; h.peace(true); gob.dead = false; gob.hp = gob.maxHp; gob.x = player.x + TILE * 1.5; gob.y = player.y; gob.state = 'idle';
      F.press('KeyK'); const opened = panel === 'wiki' && wk.section === 'monsters' && wk.id === 'goblin'; F.press('Escape'); const closed = panel === null;
      Object.assign(gob, s0); h.peace(false); closePanel();
      check(P + 'K while facing a goblin opens its page; Esc closes the book', opened && closed, { opened, closed }); }
    // the pack panel's Wiki button
    { closePanel(); const inv0 = player.inv.map(s => s ? { ...s } : null); player.inv[0] = { id: 'iron_dagger', qty: 1 }; openPanel('inventory'); render(); F.clickButton('slot0'); render(); render(); const wb = buttons.find(b => b.label === 'Wiki'); const has = !!wb; const c = has ? (wb.action(), render(), true) : false; const onPage = panel === 'wiki' && wk.section === 'items' && wk.id === 'iron_dagger'; closePanel(); player.inv = inv0;
      check(P + 'Wiki button under a selected pack item opens that item\'s page', has && c && onPage, { has, c, onPage }); }
    // layout: no two buttons overlap at four viewports, book closed and open
    { const vw0 = VW, vh0 = VH; const hits = {}; const prevTouch = window.__forceTouch; window.__forceTouch = undefined;
      const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      for (const [w, hh, name] of [[390, 844, 'phone'], [844, 390, 'landscape'], [768, 1024, 'tablet'], [1280, 800, 'desktop']]) {
        VW = w; VH = hh;
        for (const state of ['closed', 'open']) {
          if (state === 'open') WIKI.open('monsters', 'goblin'); else closePanel();
          render(); const bs = buttons.filter(b => !b.offscreen && b.w > 0 && b.h > 0);
          for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (overlap(bs[i], bs[j])) (hits[name + ':' + state] = hits[name + ':' + state] || []).push(bs[i].label + ' × ' + bs[j].label);
          const wb = bs.some(b => /^wiki/i.test(b.label)); if (!wb) (hits[name + ':' + state] = hits[name + ':' + state] || []).push('no WIKI button');
        }
      }
      closePanel(); VW = vw0; VH = vh0; window.__forceTouch = prevTouch; render();
      check(P + 'no two on-screen buttons overlap at phone, landscape, tablet and desktop sizes, book closed and open (touch layouts only when the device is touch)', Object.keys(hits).length === 0, { hits, touch: isTouch }); }
    // WIKI.add
    { const ok0 = WIKI.add('monsters', { id: 'wiki_test_thing', name: 'Test thing', level: 3, hp: 1, maxHit: 1, att: 1, def: 1, aggro: false, boss: false, where: ['Nowhere'], drops: [], tablePct: 0, blurb: 'Only a test.' }); const got = WIKI.get('monsters', 'wiki_test_thing'); const listed = WIKI.list('monsters').includes('wiki_test_thing'); const lines = WIKI.lines('monsters', 'wiki_test_thing').length > 0;
      delete custom.monsters.wiki_test_thing; data = null; const gone = !WIKI.get('monsters', 'wiki_test_thing');
      check(P + 'WIKI.add puts a new page in the book (and it lists, and it draws)', ok0 && !!got && got.name === 'Test thing' && listed && lines && gone, { ok0, listed, lines, gone }); }
    wk.search = ''; wk.letter = ''; closePanel();
  });
}
