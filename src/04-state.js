// ============================================================================
// GAME STATE: player, inventory, equipment, quests, save/load
// ============================================================================
function newPlayer() {
  const skills = {};
  for (const s of SKILL_DEFS) skills[s.key] = { xp: 0 };
  return {
    x: SPAWN.x, y: SPAWN.y, r: 13, facing: { x: 1, y: 0 }, speed: 175,
    hp: 25, maxHp: 25, attackT: 0, attackCd: 0, hurtT: 0, sinceHurt: 99, walkT: 0, moving: false,
    equip: { weapon: null, helm: null, body: null, legs: null, shield: null },
    inv: new Array(INV_SLOTS).fill(null), bank: [], skills, kills: 0, highestHit: 0,
    dead: false, deadT: 0, deaths: 0, visitedVillage: false, action: null, region: null,
    home: null, homeCd: -1e9, bedSpawn: null, mech: null, tookAxe: false, tookPick: false, chests: [], innRested: false,
  };
}
let player = newPlayer();
let monsters = [];
let drops = [];
let particles = [];
let floaters = [];
let projectiles = [];
let swordTaken = false;
let quest = { stage: 0, kills: 0, bread: 'none', wren: 'none', walkerKilled: false, tracked: null };
let deathKeep = null; // { items: [{id, qty}] }
let paused = false;
let panel = null; // null | inventory | bank | shop | craft | coffin | skills | quests | map | station
let panelArg = null; let selectedSlot = -1;
let time = 0;
let levelBanner = null;
let areaBanner = null; // {name, sub, t}
let dialog = { queue: [], cur: null, shown: 0, t: 0 };
let notice = null;
let mapDiffs = new Map();
const blockHp = new Map(); // legacy hits map (dummy etc.)
let regrow = []; // {i, t, timer}
let crops = []; // {i, stage, t}
let fires = []; // {i, timer}
let introT = 0;

function spawnMonsters() {
  monsters = [];
  for (const s of MONSTER_SPAWNS) {
    const d = MONSTER_DEFS[s.type];
    monsters.push({
      type: s.type, x: tc(s.tx), y: tc(s.ty), home: { x: tc(s.tx), y: tc(s.ty) },
      r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: d.aggro, state: 'idle', wanderT: Math.random() * 2,
      wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0,
    });
  }
}
spawnMonsters();

function say(text, who = 'The Voice') { dialog.queue.push({ text, who }); }
function notify(text) { notice = { text, t: 2.8 }; }
function floatText(x, y, text, color = '#fff', size = 15) { floaters.push({ x, y, text, color, size, t: 1.1, vy: -38 }); }
function burst(x, y, color, n = 10, speed = 90) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random()); particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.5 + Math.random() * 0.4, color, r: 2 + Math.random() * 2.5 }); }
}
function openPanel(name, arg = null) { panel = name; panelArg = arg; selectedSlot = -1; }
function closePanel() { panel = null; panelArg = null; selectedSlot = -1; }

// ---------- inventory ----------
function countItem(id) { let n = 0; for (const s of player.inv) if (s && s.id === id) n += s.qty; return n; }
const coins = () => countItem('coins');
function addItem(id, qty = 1) {
  const def = ITEMS[id]; let left = qty;
  for (const s of player.inv) if (s && s.id === id && s.qty < def.stack && left > 0) { const take = Math.min(def.stack - s.qty, left); s.qty += take; left -= take; }
  for (let i = 0; i < player.inv.length && left > 0; i++) if (!player.inv[i]) { const take = Math.min(def.stack, left); player.inv[i] = { id, qty: take }; left -= take; }
  return left;
}
function removeItem(id, qty = 1) {
  let left = qty;
  for (let i = player.inv.length - 1; i >= 0 && left > 0; i--) { const s = player.inv[i]; if (s && s.id === id) { const take = Math.min(s.qty, left); s.qty -= take; left -= take; if (s.qty <= 0) player.inv[i] = null; } }
  return qty - left;
}
function canFit(id, qty) { const def = ITEMS[id]; let room = 0; for (const s of player.inv) { if (!s) room += def.stack; else if (s.id === id) room += def.stack - s.qty; } return room >= qty; }
function giveOrDrop(id, qty, x, y, quiet = false) {
  const left = addItem(id, qty);
  if (left > 0) { drops.push({ x: x + rint(-10, 10), y: y + rint(-10, 10), id, qty: left, t: 0 }); notify('Your pack is full. It fell to the ground.'); }
  else if (!quiet) floatText(player.x, player.y - 30, `+${qty} ${ITEMS[id].name}`, ITEMS[id].color);
}
function payCoins(n) { if (coins() < n) return false; removeItem('coins', n); return true; }
function bankAdd(id, qty) { const b = player.bank.find(s => s.id === id); if (b) b.qty += qty; else if (player.bank.length < BANK_SLOTS) player.bank.push({ id, qty }); else return false; return true; }
function hasTool(kind) { let best = 0; for (const s of player.inv) if (s && ITEMS[s.id].tool === kind) best = Math.max(best, ITEMS[s.id].tier); for (const k of EQUIP_SLOTS) { const e = player.equip[k]; if (e && ITEMS[e].tool === kind) best = Math.max(best, ITEMS[e].tier); } return best; }

// ---------- equipment ----------
const weaponDef = () => player.equip.weapon ? ITEMS[player.equip.weapon] : null;
function equipItem(slot) {
  const s = player.inv[slot]; if (!s) return;
  const def = ITEMS[s.id];
  const eslot = def.weapon ? 'weapon' : def.armour ? def.armour.slot : null;
  if (!eslot) return;
  const prev = player.equip[eslot];
  player.inv[slot] = null;
  player.equip[eslot] = s.id;
  if (prev) addItem(prev, 1);
  notify(`${def.name} equipped.`); recomputeMaxHp(); save();
}
function unequip(eslot) {
  const id = player.equip[eslot]; if (!id) return;
  if (!player.inv.some(x => !x)) { notify('Your pack is full.'); return; }
  player.equip[eslot] = null; addItem(id, 1); save();
}
function gearBonus(kind) { let b = 0; for (const k of EQUIP_SLOTS) { const e = player.equip[k]; if (!e) continue; const d = ITEMS[e]; if (kind === 'def' && d.armour) b += d.armour.def; if (kind === 'str' && d.weapon) b += d.weapon.str; if (kind === 'att' && d.weapon) b += d.weapon.att; } return b; }
function arrowSlot() { return player.inv.findIndex(s => s && ITEMS[s.id].arrow); }

// ---------- skills ----------
const skillLv = key => levelForXp(player.skills[key].xp);
const combatLevel = () => Math.max(1, Math.floor((skillLv('melee') + skillLv('defence')) / 2 + skillLv('range') / 4));
function recomputeMaxHp() { player.maxHp = 25 + 4 * (skillLv('defence') - 1) + 2 * (skillLv('melee') - 1) + Math.floor(skillLv('range') / 2); }
function gainXp(key, amount) {
  const s = player.skills[key];
  const before = levelForXp(s.xp);
  s.xp += amount;
  const after = levelForXp(s.xp);
  if (after > before) {
    const name = SKILL_DEFS.find(d => d.key === key).name;
    levelBanner = { text: `${name} level ${after}!`, sub: 'Level up', t: 2.6 };
    recomputeMaxHp();
    player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * 0.3));
    burst(player.x, player.y, '#ffe066', 24, 140);
    save();
  }
}

// ---------- quests ----------
const QUEST_DEFS = {
  main: { name: 'The Road to Hollowford' },
  bread: { name: 'A Loaf for Tobin' },
  wren: { name: "Wren's Silk" },
};
function questText(id = 'main') {
  if (id === 'bread') return quest.bread === 'done' ? 'Done.' : countItem('bread') ? 'Bring Tobin his loaf of bread.' : 'Tobin wants a loaf of bread (bakery, 8 coins).';
  if (id === 'wren') return quest.wren === 'done' ? 'Done.' : `Bring Old Wren 5 spider silk (${Math.min(5, countItem('spider_silk'))}/5). Cave spiders drop it.`;
  switch (quest.stage) {
    case 0: return 'Wake up.';
    case 1: return 'Find the sword in the light.';
    case 2: return 'Follow the Voice out of the cave (east).';
    case 3: return `First Blood: defeat goblins (${quest.kills}/3).`;
    case 4: return 'Follow the dirt road east to the signpost.';
    case 5: return 'Follow the road to Thistledown. Find the Duke in the castle keep.';
    case 6: return `Train for the Duke: Melee 5 (${skillLv('melee')}), Woodcutting 3 (${skillLv('woodcutting')}).`;
    case 7: return quest.walkerKilled ? 'The walker is down. Report to Duke Ferrin.' : 'Scout the Goblin Camp east of Thistledown and bring down their walker.';
    default: return 'Chapter 3 complete. The road to Hollowford is being built.';
  }
}
function activeQuests() { const q = ['main']; if (quest.bread === 'active') q.push('bread'); if (quest.wren === 'active') q.push('wren'); return q; }
function advanceQuest(stage) {
  if (stage <= quest.stage) return;
  quest.stage = stage;
  if (stage === 1) { say("You're finally awake.", 'The Voice'); say("There. In the light. Take it. You will need it.", 'The Voice'); }
  if (stage === 2) { say("A wooden sword. It will do for now. Follow my voice, knight. The way out is east.", 'The Voice'); }
  if (stage === 3) { say("Goblins. They have been getting bolder. Show them what a knight is.", 'The Voice'); say("Swing with Space. Not every swing lands. That is what levels are for.", 'The Voice'); }
  if (stage === 4) { say("Good. Follow the dirt road east. There is a signpost. Open your quests (J) if you lose the thread.", 'The Voice'); say("The goblins have machines now. Barrels that walk. You will see what they did to Hollowford.", 'The Voice'); }
  if (stage === 5) { say("Thistledown still stands. Its Duke sits in the castle at the south end of town. Keep to the road.", 'The Voice'); levelBanner = { text: 'CHAPTER 1 COMPLETE', sub: 'The Cave', t: 4 }; }
  if (stage === 6) { say("A knight? Then Hollowford may yet be avenged. But not by a level-one sword arm.", 'Duke Ferrin'); say("Train. Reach Melee 5 and Woodcutting 3. Brakka's forge and Hale's yard are yours. Then come back to me.", 'Duke Ferrin'); }
  if (stage === 7) { say("You have grown. Now the real work. East of the village the goblins hold a camp, and something walks in it. A barrel on iron legs.", 'Duke Ferrin'); say("Bring it down. Pim in the workshop can make you traps and bombs. Brakka can make you steel. Go.", 'Duke Ferrin'); levelBanner = { text: 'CHAPTER 2 COMPLETE', sub: 'Thistledown', t: 4 }; }
  if (stage === 8) { say("The walker is down? Then their machines can die. And what a goblin can build, a knight can repair.", 'Duke Ferrin'); say("This is the end of Chapter 3. Chapter 4 is being built: the road to Hollowford, and the Barrelbeast.", 'Fanglands'); levelBanner = { text: 'CHAPTER 3 COMPLETE', sub: 'Goblin Tech', t: 4 }; }
  save();
}

// ---------- save / load ----------
function save() {
  try {
    const data = { player, quest, swordTaken, deathKeep, mapDiffs: [...mapDiffs.entries()], regrow, crops, fires, time };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable: play on without saving */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    const fresh = newPlayer();
    player = Object.assign(fresh, d.player, { attackT: 0, attackCd: 0, hurtT: 0, dead: false, deadT: 0, action: null });
    player.equip = Object.assign({ weapon: null, helm: null, body: null, legs: null, shield: null }, d.player.equip || {});
    for (const s of SKILL_DEFS) if (!player.skills[s.key]) player.skills[s.key] = { xp: 0 };
    if (!Array.isArray(player.inv) || player.inv.length !== INV_SLOTS) { const inv = new Array(INV_SLOTS).fill(null); (player.inv || []).forEach((s, i) => { if (i < INV_SLOTS) inv[i] = s; }); player.inv = inv; }
    if (!Array.isArray(player.bank)) player.bank = [];
    quest = Object.assign({ stage: 0, kills: 0, bread: 'none', wren: 'none', walkerKilled: false, tracked: null }, d.quest || {});
    swordTaken = !!d.swordTaken; deathKeep = d.deathKeep || null;
    mapDiffs = new Map(d.mapDiffs || []);
    for (const [i, t] of mapDiffs) map[i] = t;
    regrow = Array.isArray(d.regrow) ? d.regrow : []; crops = Array.isArray(d.crops) ? d.crops : []; fires = Array.isArray(d.fires) ? d.fires : [];
    time = typeof d.time === 'number' ? d.time : 0;
    recomputeMaxHp();
    return true;
  } catch (e) { return false; }
}
function newGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  map.fill(0); generateWorld();
  mapDiffs = new Map(); regrow = []; crops = []; fires = []; blockHp.clear();
  player = newPlayer(); quest = { stage: 0, kills: 0, bread: 'none', wren: 'none', walkerKilled: false, tracked: null }; swordTaken = false; deathKeep = null;
  drops = []; particles = []; floaters = []; projectiles = []; dialog = { queue: [], cur: null, shown: 0, t: 0 };
  for (const n of NPCS) { n.px = n.home.x; n.py = n.home.y; }
  spawnMonsters(); paused = false; closePanel();
  time = 0; introT = 0; areaBanner = null; levelBanner = null;
}
function changeTile(tx, ty, t) { setTile(tx, ty, t); mapDiffs.set(idx(tx, ty), t); blockHp.delete(idx(tx, ty)); }
