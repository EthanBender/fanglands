#!/usr/bin/env node
// ============================================================================
// SPREAD-MIGRATE-CHECK — the save migration's proofs (the Great Spread spec, §10 proofs 1-4; Stage 4c)
// Boots this build's index.html headless (tools/fingerprint.mjs's sandbox) and moves old saves into the new world the
// way a knight's page does (the slot, then title.startSlot: a fresh world, load(), SPREAD.prepare and SPREAD.finish).
// For every save it checks:
//   - the story kept: quest.stage, and every flag and count of the old quest and the knight (bar the positions §10 moves);
//   - nothing lost: every item in the pack, the bank, the gear, Death's chest and Aldous's keeping is there in at least
//     the old number (the refunds come on top); the coins are the same;
//   - machines conserved: every walker, bulldozer, Barrelbeast and wreck of the old map (and the one he rode) stands on
//     the new one; the mare, if he had her, is tied at a rail;
//   - he wakes on a tile he can stand on, by the Fountain Square (or the cave for a tutorial knight);
//   - the save is stamped worldV 2 / worldRev / mapW 400, nothing is locked, and a second load changes nothing;
//   - the town's walks: from the Fountain Square he reaches every person, building door, map marker and station a fresh
//     game reaches, and every parked machine and the mare has a reached tile beside it (nothing parked shuts a way);
//   - the sweep (proof 3): every position-shaped value of the migrated save (a number pair, {x, y}, {tx, ty}, 'x,y') is
//     at a path SPREAD.HANDLED names.
// and prints, per knight: the stage before and after, where he wakes, refunds, owed, machines parked, remakes applied.
//   --matrix [FILE]   the synthetic old saves (tests/fixtures/spread-matrix.json, made by tools/spread-old-saves.mjs)
//   --fixture [FILE]  the end-of-story save (tests/fixtures/spread-old-end.json) and the coverage proof (proof 2): every
//                     quest-made tile of the old map at its frame-mapped cell on the new one
//   --export FILE     the real saves: an admin export ({ saves: [{ name_lc, ver, json }], save_pins }), used locally only.
//                     It holds password hashes: this tool reads `saves` and `save_pins` and nothing else, and prints
//                     knight names, stages and counts only.
//   --json FILE       the full per-save report as JSON
//   --rev-base FILE   the worldRev sweep (§10, Stage 5 and 6): every save is first moved into world 2 by the PREVIOUS
//                     build (FILE, an index.html of an older WORLD_REV: what the live world's knights hold now), and that
//                     world-2 save of the older rev is what this build loads and sweeps. On top, the end-of-story save
//                     gets a plank on the middle of every footprint box this build adds (and one far from all of them):
//                     each inside one comes back to the knight as a plank, the far one stays where it is.
//   [index.html]      the build to test (default: this tree's)
// With no input flag it runs --fixture and --matrix. Exit 1 on any failed save.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { boot } from './fingerprint.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = k => argv.includes(k);
const val = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const html = argv.find((a, i) => a.endsWith('.html') && (i === 0 || !argv[i - 1].startsWith('--'))) || path.join(ROOT, 'index.html');
const any = has('--matrix') || has('--fixture') || has('--export');
const inputs = [];
if (has('--fixture') || !any) inputs.push({ kind: 'fixture', file: val('--fixture', path.join(ROOT, 'tests', 'fixtures', 'spread-old-end.json')) });
if (has('--matrix') || !any) inputs.push({ kind: 'matrix', file: val('--matrix', path.join(ROOT, 'tests', 'fixtures', 'spread-matrix.json')) });
if (has('--export')) inputs.push({ kind: 'export', file: val('--export', null) });

// ---------- the saves ----------
const saves = [];
for (const inp of inputs) {
  const text = fs.readFileSync(inp.file, 'utf8');
  if (inp.kind === 'fixture') saves.push({ src: 'fixture', name: 'spread-old-end', save: text.trim(), coverage: true });
  else if (inp.kind === 'matrix') for (const m of JSON.parse(text)) saves.push({ src: 'matrix', name: m.name, about: m.about, save: m.save });
  else {
    const d = JSON.parse(text);   // read `saves` and `save_pins` only: the accounts (and their hashes) are never touched
    for (const s of d.saves || []) saves.push({ src: 'real', name: s.name_lc, ver: s.ver, save: s.json });
    for (const s of d.save_pins || []) saves.push({ src: 'real', name: s.name_lc, ver: 'pin', save: s.json });
  }
}
if (!saves.length) { console.log('spread-migrate-check: no saves'); process.exit(1); }

// ---------- the worldRev sweep: the saves as the previous build left them (world 2, its WORLD_REV) ----------
const revBase = val('--rev-base', null);
let revInfo = null;
if (revBase) {
  const gb = boot(revBase), evb = code => vm.runInContext(code, gb);
  evb(String.raw`{ let a = 0x5EED; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    var REVB = { one: raw => { const K = title.slotKey(1); localStorage.setItem(K, raw); dialog.queue.length = 0; dialog.cur = null; title.startSlot(1); return localStorage.getItem(K); } };`);
  const baseRev = +evb('WORLD_REV');
  for (const s of saves) {
    try { s.save = evb(`REVB.one(${JSON.stringify(s.save)})`); s.revFrom = JSON.parse(s.save).worldRev; } catch (e) { s.revErr = String(e && e.message || e); }
  }
  revInfo = { file: revBase, baseRev };
  for (const s of saves) s.coverage = false;   // proof 2 is the world-1 move's (the previous build made it); a sweep has its own planks below
}

// ---------- the game ----------
const g = boot(html);
const ev = code => vm.runInContext(code, g);
ev(String.raw`
  { let a = 0x5EED; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var CHECK = {};
  // the paths §10 moves on purpose: left out of the "story kept" comparison
  CHECK.moved = [/^quest\.markers\.seen/, /^quest\.graves/, /^quest\.graveNight/, /^quest\.boats\.(where|sailing)(\.|$)/, /^quest\.hollowford\.wreck/, /^quest\.fang\.looted/, /^quest\.spread/,
    /^player\.(x|y|facing|home|bedSpawn|mech|mechHp|r|speed|region|action|walkPath|tapTarget|moving|cityV|chests)(\.|$)/, /^player\.horse\.(at|under)/, /^player\.companion\.(x|y|mode)$/,
    /^player\.(hp|dead|deadT|attackT|attackCd|hurtT|sinceHurt|walkT|inv|bank|equip)(\.|$)/];
  CHECK.prims = (o, p, out) => { if (o === null || typeof o !== 'object') { out[p] = o; return out; } if (Array.isArray(o)) { o.forEach((v, i) => CHECK.prims(v, p + '.' + i, out)); return out; } for (const k of Object.keys(o)) CHECK.prims(o[k], p ? p + '.' + k : k, out); return out; };
  CHECK.items = d => { const n = {}; const add = (id, q) => { if (id && ITEMS[id]) n[id] = (n[id] || 0) + (q || 1); };
    const p = d.player || {}; for (const s of p.inv || []) if (s) add(s.id, s.qty); for (const s of p.bank || []) if (s) add(s.id, s.qty);
    for (const k in (p.equip || {})) if (p.equip[k]) add(p.equip[k], 1); if (d.deathKeep && Array.isArray(d.deathKeep.items)) for (const s of d.deathKeep.items) if (s) add(s.id, s.qty);
    const sp = d.quest && d.quest.spread; if (sp && Array.isArray(sp.owed)) for (const o of sp.owed) add(o.id, o.qty); return n; };
  CHECK.machines = d => { const n = {}; for (const [i, t] of d.mapDiffs || []) if (SPREAD.MACHINES.includes(t)) n[t] = (n[t] || 0) + 1;
    const m = d.player && d.player.mech; if (m && m.kind !== 'horse') { const t = { dozer: 'DOZER', beast: 'BEAST' }[m.kind] || 'MECH'; n[t] = (n[t] || 0) + 1; } return n; };
  CHECK.mares = d => (d.mapDiffs || []).filter(([i, t]) => t === 'HORSE').length;
  // the town's walks (the review of c34fddf: parked machines walled off Brakka's yard): from the Fountain Square, over the
  // tiles (4 ways, any tile not SOLID; a door pushes open, the hover armour's water does not count), what a knight reaches.
  // Each person, building door, map marker and station a FRESH game reaches (a tile within 1, 1 and 2 of it reached) a
  // migrated knight must reach too, and every parked machine and the mare must have a reached tile beside it.
  CHECK.STATIONS = ['ANVIL', 'FORGE', 'WORKBENCH', 'WORKSHOP', 'ALCHEMY', 'OVEN', 'DOZER_BAY', 'HITCH', 'BOARD', 'HOUSE_PORTAL', 'CHEST', 'LOOM'].filter(n => typeof T[n] === 'number');
  CHECK.reach = () => {
    // its own flood (not the migration's): 4 ways from the 5 x 5 round the square, any tile that is not SOLID
    const W = MAP_W, N = MAP_W * MAP_H, seen = new Uint8Array(N), q = new Int32Array(N); let n = 0;
    const take = i => { if (!seen[i] && !SOLID.has(map[i])) { seen[i] = 1; q[n++] = i; } };
    const sx = Math.floor(VILLAGE_SPAWN.x / TILE), sy = Math.floor(VILLAGE_SPAWN.y / TILE);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inMap(sx + dx, sy + dy)) take(idx(sx + dx, sy + dy));
    for (let k = 0; k < n; k++) { const c = q[k], x = c % W; if (x > 0) take(c - 1); if (x < W - 1) take(c + 1); if (c >= W) take(c - W); if (c + W < N) take(c + W); }
    const near = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(x + dx, y + dy) && seen[idx(x + dx, y + dy)]) return true; return false; };
    const got = new Set();
    for (const n of NPCS) if ((!n.map || n.map === 'over') && near(n.x, n.y, 1)) got.add('npc:' + n.id);
    for (const b of BUILDINGS) if (typeof b.x === 'number' && near(b.x + b.door, b.y + b.h - 1, 1)) got.add('door:' + b.name + '@' + b.x + ',' + b.y);
    if (window.MARKERS) for (const m of MARKERS.all()) if (near(m.x, m.y, 2)) got.add('marker:' + m.kind + ':' + m.label);
    const st = new Set(CHECK.STATIONS.map(n => T[n]));
    for (let i = 0; i < map.length; i++) if (st.has(map[i])) { const x = i % W, y = (i / W) | 0; if (near(x, y, 1)) got.add('station:' + tileName(map[i]) + '@' + x + ',' + y); }
    return { got, seen };
  };
  CHECK.fresh = null;
  CHECK.walks = R => {
    if (!CHECK.fresh) return { lost: [], boxed: [] };
    const { got, seen } = CHECK.reach(), lost = [...CHECK.fresh].filter(k => !got.has(k));
    const MACH = new Set(SPREAD.MACHINES.filter(n => n in T).map(n => T[n]).concat([MOUNTS.tiles.HORSE]));
    const free = i => { const x = i % MAP_W, y = (i / MAP_W) | 0; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inMap(x + dx, y + dy) && seen[idx(x + dx, y + dy)]); };
    const parked = (R && R.parkedAt || []).map(e => idx(e[0], e[1])).concat(R && R.mare ? [idx(R.mare[0], R.mare[1])] : []);
    const boxed = parked.filter(i => MACH.has(map[i]) && !free(i)).map(i => (i % MAP_W) + ',' + ((i / MAP_W) | 0));
    return { lost, boxed };
  };
  // proof 3: every position-shaped value in a save, by path (array indices as [], a key 'x,y' or 'kind:x,y' as <x,y>)
  CHECK.sweep = d => { const found = {}, gen = p => p.replace(/\.\d+(?=\.|$)/g, '[]');
    const walk = (v, p) => {
      if (/^(mapDiffs|regrow|crops|fires)(\.|$)/.test(p)) return;   // the migration's own lists (index-coded, not pairs)
      if (Array.isArray(v)) { if (v.length === 2 && v.every(n => typeof n === 'number')) found[gen(p)] = 'pair'; v.forEach((c, i) => walk(c, p + '.' + i)); return; }
      if (v && typeof v === 'object') {
        if (typeof v.x === 'number' && typeof v.y === 'number') found[gen(p)] = '{x,y}';
        if (typeof v.tx === 'number' && typeof v.ty === 'number') found[gen(p)] = '{tx,ty}';
        for (const k of Object.keys(v)) { const kk = /^([a-z_]+:)?-?\d+,-?\d+$/.test(k) ? '<x,y>' : k; if (kk === '<x,y>') found[gen(p + '.<x,y>')] = 'key'; walk(v[k], p ? p + '.' + kk : kk); }
        return; }
      if (typeof v === 'string' && /^([a-z_]+:)?-?\d+,-?\d+$/.test(v)) found[gen(p)] = '"x,y"';
    };
    walk(d, ''); return Object.keys(found).map(p => ({ path: p, shape: found[p], how: (SPREAD.HANDLED.find(([re]) => re.test(p)) || [null, null])[1] })); };
  CHECK.one = (raw, cov) => {
    const K = title.slotKey(1), before = JSON.parse(raw);
    localStorage.setItem(K, raw); dialog.queue.length = 0; dialog.cur = null; SPREAD.last = null; notice = null;
    title.startSlot(1);
    const R = SPREAD.last, wroteRaw = localStorage.getItem(K), after = JSON.parse(wroteRaw), err = window.__saveInError || null; window.__saveInError = null;
    const fail = [];
    if (!R) fail.push('not migrated' + (err ? ': ' + err.split('\n')[0] : '') + (SAVE_LOCK ? ' (locked: ' + (notice && notice.text) + ')' : ''));
    if (SAVE_LOCK) fail.push('SAVE_LOCK held');
    if (after.worldV !== WORLD_V || after.worldRev !== WORLD_REV || after.mapW !== MAP_W) fail.push('the save is not stamped: ' + JSON.stringify([after.worldV, after.worldRev, after.mapW]));
    // the story kept
    if ((before.quest || {}).stage !== after.quest.stage) fail.push('stage ' + (before.quest || {}).stage + ' -> ' + after.quest.stage);
    const moved = p => CHECK.moved.some(re => re.test(p));
    const pb = CHECK.prims({ quest: before.quest || {}, player: before.player || {} }, '', {}), pa = CHECK.prims({ quest: after.quest, player: after.player }, '', {});
    const changed = Object.keys(pb).filter(p => !moved(p) && pb[p] !== pa[p] && !(pb[p] === undefined && pa[p] === undefined));
    if (changed.length) fail.push('flags changed: ' + changed.slice(0, 8).map(p => p + ' ' + JSON.stringify(pb[p]) + '->' + JSON.stringify(pa[p])).join(', '));
    // nothing lost
    const ib = CHECK.items(before), ia = CHECK.items(after), lost = Object.keys(ib).filter(id => (ia[id] || 0) < ib[id]);
    if (lost.length) fail.push('items lost: ' + lost.map(id => id + ' ' + ib[id] + '->' + (ia[id] || 0)).join(', '));
    if ((ib.coins || 0) !== (ia.coins || 0)) fail.push('coins ' + (ib.coins || 0) + ' -> ' + (ia.coins || 0));
    // machines conserved, the mare tied
    const mb = CHECK.machines(before), ma = CHECK.machines(after), mk = [...new Set(Object.keys(mb).concat(Object.keys(ma)))];
    const mBad = mk.filter(k => (mb[k] || 0) !== (ma[k] || 0));
    if (mBad.length) fail.push('machines ' + mBad.map(k => k + ' ' + (mb[k] || 0) + '->' + (ma[k] || 0)).join(', '));
    if (after.player.mech) fail.push('still riding');
    const hadMare = !!(before.player && ((before.player.horse && before.player.horse.owned) || (before.player.mech && before.player.mech.kind === 'horse'))) || CHECK.mares(before) > 0;
    const h = after.player.horse, mares = CHECK.mares(after);
    if (hadMare && !(mares === 1 && h && Array.isArray(h.at) && tileAt(h.at[0], h.at[1]) === MOUNTS.tiles.HORSE)) fail.push('the mare is not tied: ' + JSON.stringify({ mares, at: h && h.at }));
    if (!hadMare && mares) fail.push('a mare from nowhere');
    // where he wakes
    const wt = [Math.floor(player.x / TILE), Math.floor(player.y / TILE)], town = !!(before.player && before.player.visitedVillage) || (before.quest || {}).stage >= 5;
    const sp = town ? VILLAGE_SPAWN : SPAWN, near = Math.hypot(player.x - sp.x, player.y - sp.y) <= 4 * TILE;
    if (collides(player.x, player.y, player.r, playerWho()) || !near) fail.push('wakes at ' + wt + (near ? ' inside something' : ' far from spawn'));
    if (after.player.home || after.player.bedSpawn) fail.push('home or bed kept');
    // the remade tiles stand at their cells (a remade old diff's tile is on the new map where its frame puts it)
    const remadeBad = R ? R.list.filter(e => e[3] === 'remade' && tileAt(e[4][0], e[4][1]) !== T[e[2]]) : [];
    if (remadeBad.length) fail.push('remade tiles missing: ' + remadeBad.slice(0, 4).map(e => e[2] + '@' + e[4]).join(', '));
    // the sweep
    const sweep = CHECK.sweep(after), unhandled = sweep.filter(s => !s.how);
    if (unhandled.length) fail.push('positions on no handled path: ' + unhandled.map(s => s.path + ' ' + s.shape).join(', '));
    if ((after.quest.graves || []).length) fail.push('graves kept');
    const coverage = cov ? JSON.parse(CHECK.coverage()) : null;
    // a second load changes nothing
    const snap = () => JSON.stringify([[...mapDiffs], player.x, player.y, player.inv, player.bank, player.equip, deathKeep, quest]);
    const s1 = snap(); SPREAD.last = null; dialog.queue.length = 0; dialog.cur = null;
    title.startSlot(1);
    const again = snap() === s1 && SPREAD.last === null && localStorage.getItem(K).length > 0;
    if (!again) fail.push('a second load changed something');
    // the town's walks: nothing a fresh game reaches is cut off, and every parked machine has a free side
    const walks = CHECK.walks(R);
    if (walks.lost.length) fail.push('cut off from the square: ' + walks.lost.slice(0, 6).join(', ') + (walks.lost.length > 6 ? ' and ' + (walks.lost.length - 6) + ' more' : ''));
    if (walks.boxed.length) fail.push('parked with no free side: ' + walks.boxed.join(' '));
    const bay = window.DOZERUP && DOZERUP.bay, post = MOUNTS.post, far = Math.max(0, ...(R && R.parkedAt || []).map(e => e[3])), mareRing = R && R.mare && post ? Math.max(Math.abs(R.mare[0] - post.x), Math.abs(R.mare[1] - post.y)) : null;
    if (far > 40) fail.push('a machine parked ' + far + ' tiles from the Bulldozer bay (the parking looks 40 out at most)');
    if (mareRing !== null && mareRing > 8) fail.push('the mare tied ' + mareRing + ' tiles from her rail');
    const rep = R ? { far, mareRing, walks: R.walks, wake: wt, town: R.town, refunds: R.refunds, parked: R.parked, mare: R.mare, remade: R.remade, dropped: R.dropped, sorted: R.sorted, markers: R.markers, lines: R.lines, list: R.list } : null;
    return JSON.stringify({ coverage, ok: !fail.length, fail, stageBefore: (before.quest || {}).stage, stageAfter: after.quest.stage, mb, ma, ib: Object.keys(ib).length, sweep, rep });
  };
  // proof 2: the coverage of the end-of-story save: every quest-made tile kind the old map held, at its frame-mapped cell
  CHECK.coverage = () => {
    const R = SPREAD.last; if (!R) return JSON.stringify({ ok: false, why: 'not migrated' });
    const want = { FLOOR: 'the chapel bars, freed (20-hollowford)', DIRT: "the warden's gate, open (37-dragonkillers)", CAVE: 'the lair gate, open (28-thefang)', STUMP: 'the axe taken from its stump (69-axestump)', BEAST_WRECK: "the Barrelbeast's wreck (20-hollowford)" };
    const kinds = {}; for (const e of R.list) if (e[3] === 'remade') { const ok = tileAt(e[4][0], e[4][1]) === T[e[2]] && mapDiffs.get(idx(e[4][0], e[4][1])) === T[e[2]]; (kinds[e[2]] = kinds[e[2]] || { n: 0, at: 0 }).n++; if (ok) kinds[e[2]].at++; }
    const missing = Object.keys(want).filter(k => !kinds[k] || kinds[k].at !== kinds[k].n);
    // the capital: made from quest state at world generation (95-thistledown): none of the old diffs in Thistledown's box was
    // a story tile left behind (each is placed, a machine, the mare, a crop, the same as the world, or dropped ground)
    const tdb = ATLAS.ANCHORS.thistledown.box, inTd = e => e[0] >= tdb[0] && e[0] <= tdb[2] && e[1] >= tdb[1] && e[1] <= tdb[3];
    const tdDiffs = R.list.filter(inTd), tdStory = tdDiffs.filter(e => e[3] === 'dropped' && !/^(TREE|OAK|ROCK|IRON|COAL|STUMP|RUBBLE|DIRT|GRASS|SOIL|ASHES|FIRE|PALISADE|SPENT_SEAM|SUNSTONE|BLACKIRON|OBSIDIAN|JUNGLE|ASH|COBBLE)$/.test(e[2]));
    return JSON.stringify({ ok: !missing.length && !tdStory.length, kinds, want, missing, remakes: R.remade, thistledown: { diffs: tdDiffs.length, storyLeft: tdStory } });
  };
`);

// ---------- run ----------
// the fresh game's walks: a new knight on a fresh world (the baseline the town's walks proof compares against)
ev(`localStorage.removeItem(title.slotKey(1)); title.startSlot(1); title.active = false; CHECK.fresh = CHECK.reach().got; CHECK.fresh.size`);
// the planks on the footprint (--rev-base): one on the middle of every box this build adds, and one far from all of them
if (revInfo) {
  const fx = saves.find(s => s.src === 'fixture');
  if (fx) {
    const plan = JSON.parse(ev(`(() => { const boxes = []; for (let r = ${revInfo.baseRev} + 1; r <= WORLD_REV; r++) { const R = ATLAS.REVS[r]; if (R && R.boxes) boxes.push(...R.boxes); }
      const mid = boxes.map(b => [Math.round((b[0] + b[2]) / 2), Math.round((b[1] + b[3]) / 2)]);
      const inB = (x, y) => boxes.some(b => x >= b[0] - 1 && x <= b[2] + 1 && y >= b[1] - 1 && y <= b[3] + 1);
      let far = null; for (let r = 0; r < 40 && !far; r++) for (let dx = -r; dx <= r && !far; dx++) { const x = mid[0][0] + 12 + dx, y = mid[0][1] + 12 + r; if (inMap(x, y) && !SOLID.has(map[idx(x, y)]) && map[idx(x, y)] !== T.WATER && !inB(x, y) && !ATLAS.reservedAt(x, y)) far = [x, y]; }
      return JSON.stringify({ mid, far, W: MAP_W }); })()`));
    const d = JSON.parse(fx.save), seen = new Set((d.mapDiffs || []).map(e => e[0]));
    for (const [x, y] of plan.mid.concat([plan.far])) { const i = y * plan.W + x; if (!seen.has(i)) (d.mapDiffs = d.mapDiffs || []).push([i, 'PLANK']); }
    saves.push({ src: 'rev', name: 'planks-on-footprint', save: JSON.stringify(d), planks: plan });
  }
}
const results = [];
const t0 = Date.now();
for (const s of saves) {
  let r;
  try { r = JSON.parse(ev(`CHECK.one(${JSON.stringify(s.save)}, ${!!s.coverage})`)); }
  catch (e) { r = { ok: false, fail: ['threw: ' + String(e && e.message || e).split('\n')[0]] }; }
  if (s.revErr) { r.ok = false; r.fail = (r.fail || []).concat(['the previous build could not move it: ' + s.revErr]); }
  if (revInfo && s.revFrom !== revInfo.baseRev && s.src !== 'rev') { r.ok = false; r.fail = (r.fail || []).concat(['the previous build stamped worldRev ' + s.revFrom + ', not ' + revInfo.baseRev]); }
  if (s.planks) {
    const pl = JSON.parse(ev(`JSON.stringify({ mids: ${JSON.stringify(s.planks.mid)}.map(([x, y]) => tileName(map[idx(x, y)])), far: tileName(map[idx(${s.planks.far[0]}, ${s.planks.far[1]})]), list: (SPREAD.last && SPREAD.last.list || []).filter(e => e[2] === 'PLANK').length, kind: SPREAD.last && SPREAD.last.kind })`));
    const back = (r.rep && r.rep.refunds) ? Object.values(r.rep.refunds).reduce((n, o) => n + (o.plank || 0), 0) : 0;
    r.planks = Object.assign(pl, { back });
    if (pl.mids.some(t => t === 'PLANK') || pl.far !== 'PLANK' || back !== s.planks.mid.length) { r.ok = false; r.fail = (r.fail || []).concat(['the footprint planks: ' + JSON.stringify(r.planks)]); }
  }
  if (s.coverage && r.coverage) { const c = r.coverage; if (!c.ok) { r.ok = false; r.fail = (r.fail || []).concat(['coverage: ' + JSON.stringify({ missing: c.missing, storyLeft: c.thistledown.storyLeft })]); } }
  results.push(Object.assign({ src: s.src, name: s.name, ver: s.ver }, r));
}

// ---------- the report ----------
const words = o => Object.keys(o || {}).map(k => `${o[k]} ${k}`).join(', ') || '-';
const refundWords = rf => rf ? [['bank', rf.bank], ['pack', rf.pack], ['owed', rf.owed]].filter(([, o]) => Object.keys(o).length).map(([w, o]) => `${w}: ${words(o)}`).join('; ') || '-' : '-';
let src = null;
for (const r of results) {
  if (r.src !== src) { src = r.src; console.log(`\n== ${src === 'real' ? 'the real saves' : src === 'matrix' ? 'the synthetic matrix (proof 1)' : src === 'rev' ? 'the worldRev sweep: planks on the footprint' : 'the end-of-story save (proof 2)'}${revInfo ? ` (each moved first by ${path.basename(revInfo.file)}, WORLD_REV ${revInfo.baseRev})` : ''} ==`); }
  if (r.planks) console.log(`      planks: ${r.planks.back} back to the knight, the footprint tiles now ${[...new Set(r.planks.mids)].join('/')}, the far one ${r.planks.far}`);
  const rep = r.rep || {};
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${String(r.name).padEnd(20)}${r.ver !== undefined ? (' v' + r.ver).padEnd(7) : ''} stage ${r.stageBefore} -> ${r.stageAfter}, wakes ${rep.town ? 'in Thistledown' : 'in the cave'} at ${rep.wake}`);
  console.log(`      refunds ${refundWords(rep.refunds)}; machines parked ${words(rep.parked)}${rep.far ? ` (within ${rep.far} of the Bulldozer bay)` : ''}; mare ${rep.mare ? `tied at ${rep.mare} (${rep.mareRing} from her rail)` : '-'}; remakes ${words(rep.remade)}; dropped ${words(Object.fromEntries(Object.entries(rep.dropped || {}).filter(([, v]) => v)))}`);
  if (!r.ok) for (const f of r.fail) console.log('      ! ' + f);
  if (r.coverage) console.log(`      coverage: ${Object.keys(r.coverage.want).map(k => `${k} ${r.coverage.kinds[k] ? r.coverage.kinds[k].at + '/' + r.coverage.kinds[k].n : 0} (${r.coverage.want[k]})`).join('; ')}; Thistledown's box ${r.coverage.thistledown.diffs} old diffs, ${r.coverage.thistledown.storyLeft.length} story tiles left behind`);
}
// the sweep's paths, over every save
const paths = {};
for (const r of results) for (const s of r.sweep || []) (paths[s.path] = paths[s.path] || { shape: s.shape, how: s.how, n: 0 }).n++;
console.log('\n== the sweep (proof 3): every position-shaped path in the migrated saves ==');
for (const p of Object.keys(paths).sort()) console.log(`${paths[p].how ? 'ok ' : 'NO '} ${p} (${paths[p].shape}, ${paths[p].n} saves): ${paths[p].how || 'NOT HANDLED'}`);
const bad = results.filter(r => !r.ok);
const real = results.filter(r => r.src === 'real');
if (real.length) {
  const stageChanges = real.filter(r => r.stageBefore !== r.stageAfter).length;
  const lostMachines = real.filter(r => (r.fail || []).some(f => /^machines|^items lost|^coins/.test(f))).length;
  console.log(`\nthe real saves: ${real.length} saves of ${new Set(real.map(r => r.name)).size} knights; ${stageChanges} stage changes; ${lostMachines} with lost machines, items or coins`);
}
if (val('--json', null)) fs.writeFileSync(val('--json', null), JSON.stringify(results, null, 1));
console.log(`\nspread-migrate-check: ${results.length - bad.length} of ${results.length} saves pass (${Math.round((Date.now() - t0) / 1000)} s)${bad.length ? '; FAILED: ' + bad.map(r => r.name + (r.ver !== undefined ? ' v' + r.ver : '')).join(', ') : ''}`);
process.exit(bad.length ? 1 : 0);
