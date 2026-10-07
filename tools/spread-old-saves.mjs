#!/usr/bin/env node
// ============================================================================
// SPREAD-OLD-SAVES — the synthetic matrix of old saves (the Great Spread spec, §10 proof 1; Stage 4c)
// Boots the STAGE 3 build (the 260 x 180 map, WORLD_V 1: master d523504's index.html, built from that commit) headless,
// makes each knight with the old game's own rules (placeAction, plantSeed, the walker's repair and boarding, the mare
// bought from Fennick and ridden, Hollowford's board and its build buttons, the guild founding itself, an instance
// entered), and writes each save exactly as the old game wrote it to tests/fixtures/spread-matrix.json:
//   [{ name, about, save }]   (save: the old game's localStorage string)
// tools/spread-migrate-check.mjs --matrix migrates every one on this build and checks it.
//   node tools/spread-old-saves.mjs [--old path/to/stage3/index.html] [--out FILE]
// Without --old it builds d523504 (git archive) into a scratch folder under the system's temp directory first.
// The end-of-story knight is tests/fixtures/spread-old-end.json (Stage 3's playthrough save, tools/spread-old-end.mjs).
// ============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boot } from './fingerprint.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const out = opt('--out', path.join(ROOT, 'tests', 'fixtures', 'spread-matrix.json'));
const S3 = 'd523504';

function oldBuild() {
  const given = opt('--old', null); if (given) return given;
  const dir = path.join(os.tmpdir(), 'fanglands-spread-s3-' + S3);
  const html = path.join(dir, 'index.html');
  if (fs.existsSync(html)) return html;
  fs.mkdirSync(dir, { recursive: true });
  execSync(`git archive ${S3} | tar -x -C "${dir}"`, { cwd: ROOT });
  // build.sh's own concatenation (src/page.html around src/[0-9]*.js in name order), without its gates
  const src = path.join(dir, 'src'), page = fs.readFileSync(path.join(src, 'page.html'), 'utf8');
  const cut = page.indexOf('<!-- SCRIPTS -->'), head = page.slice(0, page.lastIndexOf('\n', cut) + 1), tail = page.slice(page.indexOf('\n', cut) + 1);
  const files = fs.readdirSync(src).filter(f => /^[0-9].*\.js$/.test(f)).sort();
  const body = files.map(f => `// ---- src/${f} ----\n${fs.readFileSync(path.join(src, f), 'utf8')}\n`).join('');
  fs.writeFileSync(html, head + '<script>\n' + body + '</script>\n' + tail);
  return html;
}

const html = oldBuild();
const g = boot(html);
const ev = code => vm.runInContext(code, g);
const end = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'spread-old-end.json'), 'utf8').trim();
g.__END = end;
// the old game's helpers, inside its own scope
ev(String.raw`
  { let a = 0x5EED; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var F = FANGLANDS, K = () => title.slotKey(1);
  var quiet = () => { dialog.queue.length = 0; dialog.cur = null; levelBanner = null; notice = null; closePanel(); window.__peace = true; for (const m of monsters) m.state = 'idle'; };
  var fresh = () => { localStorage.removeItem(K()); title.startSlot(1); title.active = false; quiet(); };
  var fromEnd = () => { localStorage.setItem(K(), window.__END); title.startSlot(1); title.active = false; quiet(); };
  var done = () => { quiet(); save(); return localStorage.getItem(K()); };
  var give = (id, n) => { if (!ITEMS[id]) throw new Error('no item ' + id); const left = addItem(id, n); if (left) throw new Error('no room for ' + id); };
  var P = id => ATLAS.port(id).map(Math.round);
  // an open tile near (cx, cy) with open ground on its west (to stand on) and nothing of the knight's on it
  var openNear = (cx, cy) => { for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, y = cy + dy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const ok = [[x, y], [x - 1, y], [x + 1, y], [x, y + 1]].every(([a, b]) => inMap(a, b) && PLACEABLE_ON.has(tileAt(a, b)) && !insideBuilding(a, b) && !buildingAt(a, b) && !mapDiffs.has(idx(a, b)) && !NPCS.some(n => circleHitsTile(n.px, n.py, 16, a, b)));
    if (ok) return [x, y]; } throw new Error('no open ground near ' + cx + ',' + cy); };
  // place an item from the pack on (x, y), the way Q does: standing west of it, facing east
  // (planks, doors and walls go on the island only since 3 Oct (64-island); a save from before holds them on the overworld,
  // so the old game's own changeTile lays one the way Q did then)
  var place = (id, x, y) => { give(id, 1); F.tp(x - 1, y); player.facing = { x: 1, y: 0 }; placeAction(id);
    if (tileAt(x, y) !== T[ITEMS[id].place] && notice && /on your island/.test(notice.text)) { removeItem(id, 1); changeTile(x, y, T[ITEMS[id].place]); } if (tileAt(x, y) !== T[ITEMS[id].place]) throw new Error('could not place ' + id + ' at ' + x + ',' + y + ': ' + (notice && notice.text)); };
  // E on a tile the way useAction hands it to the features (HOOKS.use): the beast is wider than a tile, so no facing is needed
  var useOn = (x, y) => { for (const f of HOOKS.use) if (f(tileAt(x, y), x, y)) return true; return false; };
  var useAt = (x, y) => { F.tp(x - 1, y); player.facing = { x: 1, y: 0 }; F.press('KeyE'); F.sim(2, []); };
`);
const make = (name, about, code) => {
  const save = ev(`(() => { ${code}; return done(); })()`);
  const d = JSON.parse(save);
  return { name, about, save, stage: d.quest.stage, diffs: (d.mapDiffs || []).length, worldV: d.worldV || 1 };
};

const M = [];
// 1. a tutorial knight: still in the cave, the sword not taken
M.push(make('tutorial', 'a new knight in the cave: stage 1, the sword still in the light', `fresh(); advanceQuest(1); quiet();`));
// 2. mid-story: out of the cave, trained, the camp's walker down (its wreck in the camp), on the road to the Duke
M.push(make('mid-story', 'stage 8: the camp walker brought down (its wreck lies in the camp), a stump felled on the road, a plank and a door placed',
  `fresh(); quest.stage = 8; quest.walkerKilled = true; player.visitedVillage = true; swordTaken = true;
   const w = openNear(...P('camp.walker')); changeTile(w[0], w[1], T.WRECK);
   const s = openNear(...P('signpost.sign')); changeTile(s[0], s[1], T.STUMP); regrow.push({ i: idx(s[0], s[1]), t: T.TREE, timer: 60 });
   const a = openNear(...ATLAS.frame('signpost').p(64, 29)); place('plank', a[0], a[1]); place('door', a[0] + 1, a[1]);`));
// 3. the end of the story (the Stage 3 playthrough's own save)
M.push({ name: 'end-game', about: "Stage 3's playthrough to stage 16: the bars freed, the warden's and the lair's gates open, the beast's wreck in Hollowford, the walker's and the bulldozer's wrecks in the camp", save: end, stage: 16, diffs: JSON.parse(end).mapDiffs.length, worldV: 1 });
// 4. the bank full: a bed and a lodestone placed out on the Goblin Fields come back with nowhere in the bank
const fill = `const skip = new Set(['bed', 'lodestone', 'plank', 'door', 'coins', 'potato_seed', 'potato', 'wheat_seed', 'wheat']), spare = Object.keys(ITEMS).filter(id => !skip.has(id));
   player.bank = spare.slice(0, BANK_SLOTS).map(id => ({ id, qty: 2 }));`;
M.push(make('bank-full', 'the end-game knight, his bank full of other things (60 slots), a bed and a lodestone placed in the open',
  `fromEnd(); const a = openNear(...ATLAS.frame('drill_field').p(57, 45)); place('lodestone', a[0], a[1]); place('bed', a[0] + 1, a[1]); ${fill}`));
// 5. the bank and the pack full: owed by Aldous
M.push(make('bank-and-pack-full', 'the bank full and every pack slot taken: the placed bed, lodestone and plank are owed',
  `fromEnd(); const a = openNear(...ATLAS.frame('drill_field').p(57, 45)); place('lodestone', a[0], a[1]); place('bed', a[0] + 1, a[1]); place('plank', a[0] + 2, a[1]); ${fill}
   const more = spare.slice(BANK_SLOTS); player.inv = player.inv.map(s => s && (s.id === 'coins' || ITEMS[s.id].weapon || ITEMS[s.id].tool) ? s : { id: more.shift(), qty: 1 });`));
// 6. riding the walker: the camp's wreck repaired and boarded (the core's own repairMech and enterMech), driven to the pond
M.push(make('riding-walker', 'the end-game knight repairs the walker wreck in the camp, climbs in, and saves while riding it by the pond',
  `fromEnd(); const w = [...mapDiffs].find(([i, t]) => t === T.WRECK); const x = w[0] % MAP_W, y = Math.floor(w[0] / MAP_W);
   give('iron_bar', 3); give('goblin_scrap', 4); repairMech(x, y); enterMech(x, y); const p = openNear(...P('pond.outflow')); F.tp(p[0], p[1]);
   if (!player.mech) throw new Error('not in the walker');`));
// 7. riding the bulldozer, out in the quarry
M.push(make('riding-dozer', "the camp's bulldozer wreck repaired and boarded, saved while driving it in the quarry",
  `fromEnd(); const w = [...mapDiffs].find(([i, t]) => t === T.DOZER_WRECK); const x = w[0] % MAP_W, y = Math.floor(w[0] / MAP_W);
   for (const [id, n] of DOZER_REPAIR) give(id, n); repairDozer(x, y); enterDozer(x, y); const p = openNear(...P('quarry.shaft')); F.tp(p[0], p[1]);
   if (!player.mech || player.mech.kind !== 'dozer') throw new Error('not on the bulldozer');`));
// 8. riding the mare: bought from Fennick (tied at his rail), then ridden out of town
M.push(make('riding-mare', 'Cinder bought from Fennick and ridden; saved in the saddle on the road east of town',
  `fromEnd(); give('coins', MOUNTS.PRICE); MOUNTS.buyHorse(); const at = MOUNTS.state.at; F.tp(at[0] - 1, at[1]); player.facing = { x: 1, y: 0 }; MOUNTS.mount(at[0], at[1]);
   const p = openNear(...P('camp.walker').map((v, k) => v - (k ? 0 : 12))); F.tp(p[0], p[1]); if (!MOUNTS.riding()) throw new Error('not riding');`));
// 9. the mare left out in the Wolfwood
M.push(make('mare-in-wolfwood', 'Cinder ridden into the Wolfwood and left standing there',
  `fromEnd(); give('coins', MOUNTS.PRICE); MOUNTS.buyHorse(); const at = MOUNTS.state.at; F.tp(at[0] - 1, at[1]); player.facing = { x: 1, y: 0 }; MOUNTS.mount(at[0], at[1]);
   const p = openNear(...P('wren.wren').map((v, k) => v + (k ? 8 : 10))); F.tp(p[0], p[1]); MOUNTS.dismount(); const h = MOUNTS.state.at;
   if (!h || regionAt(h[0], h[1]).name !== 'Wolfwood') throw new Error('the mare is not in the Wolfwood: ' + JSON.stringify(h));`));
// 10. a bed he sleeps in and a lodestone home (out on the Goblin Fields)
M.push(make('bed-and-lodestone', 'a lodestone home and a bed beside it on the Goblin Fields; he has slept in the bed (bedSpawn) and H takes him home',
  `fromEnd(); const a = openNear(...ATLAS.frame('drill_field').p(57, 45)); place('lodestone', a[0], a[1]); place('bed', a[0] + 1, a[1]); useAt(a[0] + 1, a[1]);
   if (!player.home || !player.bedSpawn) throw new Error('no home or bed: ' + JSON.stringify([player.home, player.bedSpawn]));`));
// 11. crops and fires: two potatoes growing, one ripe wheat, a fire burning, a tilled patch
M.push(make('crops-and-fires', 'tilled soil, two potatoes planted, a wheat crop ripe, and a fire lit beside them',
  `fromEnd(); give('bronze_hoe', 1); const a = openNear(...ATLAS.frame('drill_field').p(57, 45));
   for (let k = 0; k < 4; k++) { player.action = { type: 'till', t: 0, need: 1, tx: a[0] + k, ty: a[1] }; finishTill(); }
   give('potato_seed', 2); plantSeed(a[0], a[1]); plantSeed(a[0] + 1, a[1]); give('wheat_seed', 1); plantSeed(a[0] + 2, a[1]); crops[crops.length - 1].stage = 3;
   const f = openNear(a[0], a[1] + 3); give('wood', 1); player.action = { type: 'fire', tx: f[0], ty: f[1], log: 'wood', under: tileAt(f[0], f[1]) }; finishLightFire();
   if (crops.length < 3 || !fires.length) throw new Error('no crops or fire');`));
// 12. the crypt open
M.push(make('crypt-open', 'the earth by the last knight\'s grave opened: the crypt door stands east of it',
  `fresh(); quest.stage = 12; player.visitedVillage = true; quest.night = { crypt: true, told: true }; const c = P('graveyard.crypt'); changeTile(c[0], c[1], NIGHT.tiles.crypt);`));
// 13-15. the bars freed, the lair gate open, the warden's gate open: the end-game save holds all three; one each here,
// from a knight with only that change on his map
M.push(make('warden-gate-open', "stage 11: the warden's gate opened by the game's own openGate", `fresh(); quest.stage = 11; player.visitedVillage = true; DRAGON_KILLERS.openGate(true); if (!quest.dk.gate) throw new Error('gate shut');`));
M.push(make('bars-freed', 'the end-game knight with every other change of his map undone but the chapel bars he broke',
  `fromEnd(); const keep = new Set([T.FLOOR]); for (const [i, t] of [...mapDiffs]) if (!keep.has(t)) mapDiffs.delete(i);`));
M.push(make('lair-gate-open', "the end-game knight with only the lair gate's opening left on his map",
  `fromEnd(); for (const [i, t] of [...mapDiffs]) if (t !== T.CAVE) mapDiffs.delete(i);`));
// 16. Hollowford fully rebuilt: every project on Nell's board, through the board's own buttons
const rebuild = `fromEnd(); quest.stage = Math.max(quest.stage, 10);
   const order = [['Square', [['stone', 20]]], ['Well', [['stone', 10], ['plank', 4]]], ['House', [['plank', 30], ['stone', 10]]], ['Sawmill', [['plank', 10], ['stone', 5]]], ['Chapel', [['plank', 20], ['iron_bar', 5]]], ['Smithy', [['plank', 20], ['iron_bar', 8]]], ['Knight', [['plank', 40], ['stone', 10], ['mithril_bar', 2]]]];
   for (const [label, cost] of order) { for (const [id, n] of cost) { removeItem(id, countItem(id)); give(id, n); } openPanel('rebuild'); render(); if (!F.clickButton('Build: ' + label)) throw new Error('no Build: ' + label); F.sim(2, []); quiet(); }
   if (Object.keys(quest.rebuild.done).length !== 7) throw new Error('rebuild: ' + JSON.stringify(quest.rebuild.done));`;
M.push(make('hollowford-rebuilt', "every project on Nell's board built through the board's buttons: the square, the well, the first house, the sawmill, the chapel roof and bell, the smithy, the knight's house (a bed and a lodestone inside it)", rebuild));
// 17. the guild at its top rank: founded by Old Tam once the crypt is open and the first house stands
M.push(make('guild-top-rank', 'Hollowford rebuilt, the crypt open, the guild founded by Old Tam (the hall rebuilt), rank Guildmaster',
  `${rebuild}; quest.night = { crypt: true, told: true }; changeTile(...P('graveyard.crypt'), NIGHT.tiles.crypt);
   F.tp(...ATLAS.frame('hollowford').p(140, 78)); for (let k = 0; k < 600 && !quest.guild.founded; k++) F.step([]); quest.guild.rank = 4;
   if (!quest.guild.founded) throw new Error('the guild was not founded');`));
// 18. the beast rebuilt: the wreck in Hollowford repaired, parked where it lay
M.push(make('beast-rebuilt', "the Barrelbeast's wreck in Hollowford repaired through E (6 iron bars, 10 scrap, 2 blast powder): a working beast stands there",
  `fromEnd(); const w = quest.hollowford.wreck; for (const [id, n] of [['iron_bar', 6], ['goblin_scrap', 10], ['blast_powder', 2]]) { removeItem(id, countItem(id)); give(id, n); }
   const st = openNear(w[0] - 1, w[1]); F.tp(st[0], st[1]); F.face(w[0], w[1]); useOn(w[0], w[1]);
   if (tileAt(w[0], w[1]) !== T.BEAST) throw new Error('not repaired: ' + tileName(tileAt(w[0], w[1])));`));
// 19. the beast ridden away and left in the camp, its wreck gone from Hollowford
M.push(make('beast-ridden', 'the repaired Barrelbeast ridden to the camp and saved in the seat',
  `fromEnd(); const w = quest.hollowford.wreck; for (const [id, n] of [['iron_bar', 6], ['goblin_scrap', 10], ['blast_powder', 2]]) { removeItem(id, countItem(id)); give(id, n); }
   const st = openNear(w[0] - 1, w[1]); F.tp(st[0], st[1]); F.face(w[0], w[1]); useOn(w[0], w[1]); useOn(w[0], w[1]);
   if (!player.mech || player.mech.kind !== 'beast') throw new Error('not in the beast'); const p = openNear(...P('camp.walker')); F.tp(p[0], p[1]);`));
// 20. the wreck present (the end-game's beast wreck and two walker wrecks), with the companion following
M.push(make('wrecks-and-hero', 'the end-game knight with Sera following him, the beast wreck in Hollowford and the camp\'s wrecks untouched', `fromEnd();`));
// 21. saved inside an instance (the Spider Den): the save holds the step outside
M.push(make('in-instance', 'saved inside the Spider Den (16-instances writes the step outside the door)',
  `fromEnd(); const id = INSTANCES.list().find(k => /den/.test(k)) || INSTANCES.list()[0]; INSTANCES.enter(id); if (!INSTANCES.active()) throw new Error('not inside');`));
// 22. saved on the island
M.push(make('on-island', 'saved standing on his island (63-house)', `fromEnd(); HOUSE.enter(); if (!HOUSE.inside) throw new Error('not on the island');`));
// 23. a pinned save from the 160-wide map: no mapW, no worldV, its tiles in the 160-wide index
M.push((() => {
  const m = make('pinned-160', 'a save from the 160-wide map (an admin pin of an old version): no mapW and no worldV, so its tile indices are 160 wide; a plank, a bed and a stump',
    `fresh(); quest.stage = 6; player.visitedVillage = true; const a = openNear(...P('signpost.sign')); place('plank', a[0], a[1]); place('bed', a[0] + 1, a[1]);
     const s = openNear(a[0], a[1] + 3); changeTile(s[0], s[1], T.STUMP);`);
  const d = JSON.parse(m.save), W = d.mapW;
  d.mapDiffs = d.mapDiffs.map(([i, t]) => [(Math.floor(i / W)) * 160 + (i % W), t]).filter(([i]) => true);
  delete d.mapW; delete d.worldV;
  m.save = JSON.stringify(d); m.worldV = 1;
  return m;
})());
// 24. a knight saved mid-death
M.push(make('fallen', 'saved while falling (hp 0, dead): his pack in Death\'s chest', `fromEnd(); player.hp = 1; die();`));

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(M.map(({ name, about, save }) => ({ name, about, save })), null, 1) + '\n');
for (const m of M) console.log(`${m.name.padEnd(20)} stage ${String(m.stage).padStart(2)}  ${String(m.diffs).padStart(3)} map diffs  worldV ${m.worldV}`);
console.log(`spread-old-saves: ${M.length} old saves from the Stage 3 build (${path.relative(ROOT, html)}), written to ${path.relative(ROOT, out)}`);
