#!/usr/bin/env node
// Balance report: loads the built game headlessly and prints expected time-to-kill, damage taken,
// XP/hour and gathering rates for reference loadouts. node tools/balance.js [index.html]
const fs = require('fs'), vm = require('vm'), path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const noop = () => { };
const ctx2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined, set: () => true });
const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
const store = {};
const g = { innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, setTimeout,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  performance: { now: () => Date.now() }, console: Object.assign(Object.create(console), { table: noop, warn: noop }), navigator: { maxTouchPoints: 0 },
  document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null } };
g.window = g; vm.createContext(g); vm.runInContext(script, g, { filename: 'index.html' });
const ev = code => vm.runInContext(code, g);
const XP = ev('XP_TABLE'), DEFS = ev('MONSTER_DEFS'), ITEMS = ev('ITEMS');
const acc = (a, d) => a > d ? 1 - (d + 2) / (2 * (a + 1)) : a / (2 * (d + 1));
// reference loadouts along the intended path
const LOADOUTS = [
  { name: 'Start: lv1 wooden sword', melee: 1, def: 1, weapon: 'wooden_sword', armour: [] },
  { name: 'Ch2: lv5 iron dagger', melee: 5, def: 4, weapon: 'iron_dagger', armour: ['ruined_helm', 'ruined_body'] },
  { name: 'Ch3: lv10 iron sword + iron helm/body', melee: 10, def: 8, weapon: 'iron_sword', armour: ['iron_helm', 'iron_body', 'iron_legs', 'iron_shield'] },
  { name: 'Ch4: lv20 steel sword + iron set', melee: 20, def: 16, weapon: 'steel_sword', armour: ['iron_helm', 'iron_body', 'iron_legs', 'iron_shield'] },
  { name: 'Ch4b: lv30 mithril sword + steel body', melee: 30, def: 25, weapon: 'mithril_sword', armour: ['steel_helm', 'steel_body', 'iron_legs', 'iron_shield'] },
  { name: 'Ch5a: lv35 mithril sword + scale helm/shield + mithril body', melee: 35, def: 30, weapon: 'mithril_sword', armour: ['scale_helm', 'mithril_body', 'mithril_legs', 'scale_shield'] },
  { name: 'Ch5: lv45 mithril battleaxe + mithril set', melee: 45, def: 40, weapon: 'mithril_battleaxe', armour: ['mithril_helm', 'mithril_body', 'mithril_legs', 'mithril_shield'] },
  { name: 'End: lv60 Fang + godly set', melee: 60, def: 55, weapon: 'fang_of_the_fang', armour: ['godly_helm', 'godly_body', 'godly_legs', 'godly_shield'] },
];
const setLoadout = L => ev(`player.skills.melee.xp = XP_TABLE[${L.melee}]; player.skills.defence.xp = XP_TABLE[${L.def}]; player.equip = { weapon: ${JSON.stringify(L.weapon)}, helm: null, body: null, legs: null, shield: null }; ${L.armour.map(a => `player.equip[ITEMS['${a}'].armour.slot] = '${a}';`).join(' ')} player.mech = null; recomputeMaxHp(); ({ att: playerAttackRoll(), max: playerMaxHit(), def: playerDefRoll(), hp: player.maxHp, cd: ITEMS['${L.weapon}'].weapon.cd })`);
const MONS = ['spider', 'goblin', 'boar', 'wolf', 'sapper', 'brute', 'guard_m', 'walker', 'bulldozer', 'barrelbeast', 'dwarf_guard', 'elf_sentinel', 'ash_drake', 'green_dragon', 'red_dragon', 'the_fang'].filter(k => DEFS[k]);
console.log('\n== COMBAT: expected seconds to kill / HP lost per kill (player must eat if HP lost > maxHp) ==');
for (const L of LOADOUTS) {
  if (!ITEMS[L.weapon] || L.armour.some(a => !ITEMS[a])) { console.log(`\n-- ${L.name}: skipped (item id missing in this build)`); continue; }
  const p = setLoadout(L);
  const rows = [];
  for (const k of MONS) {
    const m = DEFS[k];
    const pAcc = acc(p.att, (m.def + 8) * 64), pDps = pAcc * (1 + p.max) / 2 / p.cd;
    const mAcc = acc((m.att + 8) * 64, p.def), mDps = mAcc * (1 + m.maxHit) / 2 / (m.mech ? 1.6 : 1.1);
    const ttk = m.hp / pDps, lost = mDps * ttk;
    rows.push(`${k.padEnd(12)} lv${String(m.level).padStart(2)} ttk ${ttk.toFixed(1).padStart(6)}s  hit ${(pAcc * 100).toFixed(0).padStart(3)}%  taken ${lost.toFixed(0).padStart(4)} hp`);
  }
  console.log(`\n-- ${L.name}: att ${p.att}, max hit ${p.max}, def ${p.def}, hp ${p.hp}`);
  console.log(rows.join('\n'));
}
console.log('\n== XP: kills needed per level band (melee 4xp/dmg, no kill bonus) ==');
if (DEFS.ash_drake) console.log(`kill bonus (30-ashdrake): level x 10 xp for level >= 10 — ash drake ${DEFS.ash_drake.hp * 4 + DEFS.ash_drake.level * 10} xp/kill, green dragon ${DEFS.green_dragon.hp * 4 + DEFS.green_dragon.level * 10}, red dragon ${DEFS.red_dragon.hp * 4 + DEFS.red_dragon.level * 10}, walker ${DEFS.walker.hp * 4 + DEFS.walker.level * 10}`);
for (const lv of [2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 99]) console.log(`level ${String(lv).padStart(2)}: ${XP[lv].toLocaleString().padStart(11)} xp  = ${(XP[lv] / (12 * 4)).toFixed(0).padStart(6)} goblins  / ${(XP[lv] / (45 * 4)).toFixed(0).padStart(5)} brutes / ${(XP[lv] / (260 * 4)).toFixed(0).padStart(4)} green dragons`);
console.log('\n== GATHERING: expected seconds per log/ore (success chance per swing × swing time) ==');
const gather = (lv, req, tier, base = 2.2) => { const chance = Math.min(0.9, 0.35 + (lv - req) * 0.02 + tier * 0.1); return Math.max(0.9, base - tier * 0.4) / chance; };
for (const [name, req, xp] of [['tree', 1, 25], ['oak', 5, 37], ['jungle', 15, 60], ['rock', 1, 17], ['iron', 5, 35], ['coal', 10, 50], ['mithril', 20, 80], ['obsidian', 35, 120]]) {
  const rows = [1, 2, 3].map(t => { const s = gather(Math.max(req, 1), req, t); return `tier${t}: ${s.toFixed(1)}s (${(3600 / s * xp).toFixed(0)} xp/h)`; });
  console.log(`${name.padEnd(9)} req ${String(req).padStart(2)}  ${rows.join('   ')}`);
}
console.log('\n== ECONOMY ==');
const val = id => ITEMS[id] ? ITEMS[id].value : NaN;
console.log(`goblin coins/kill avg ${(3 + 9) / 2}; scrap 18/${DEFS.goblin.drops.table.reduce((s, r) => s + r[3], 0)} chance × 15 value`);
for (const id of ['fishing_rod', 'hammer', 'bronze_hoe', 'lobster_pot', 'yew_bow', 'mithril_pickaxe', 'hover_armour', 'godly_body']) console.log(`${id.padEnd(16)} value ${val(id)}`);
const rod = 60, goblinCoins = 6 + 0.32 * 15 * 0.6; console.log(`rod (60c) ≈ ${(rod / goblinCoins).toFixed(0)} goblins; hire Garrick (150c) ≈ ${(150 / goblinCoins).toFixed(0)} goblins; walker repair (3 bars+4 scrap) needs ~${Math.ceil(4 / 0.32)} goblin kills for scrap`);
