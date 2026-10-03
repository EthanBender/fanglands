#!/usr/bin/env node
// ============================================================================
// FINGERPRINT — what proves "nothing visible changed" (the Great Spread spec, §9.4)
// Boots a built index.html headless (the same stubbed DOM and canvas as tools/headless.js and
// ~/.fanglands/tools/load.js), runs newGame(), and hashes every table a player could see move:
//
//   map, variant                     the generated overworld, tile by tile
//   core                             SPAWN, SWORD_POS, SIGN_TILE, VILLAGE, VILLAGE_SPAWN, CASTLE, DUMMIES, STALLS
//   regions, buildings, npcs         REGIONS, BUILDINGS, NPCS (id, x, y)
//   spawns                           MONSTER_SPAWNS with the camp flags (and any door-step move)
//   instances                        every instance's door, step, entry and exit
//   map_targets, map_hooks           MAP_TARGETS[0..16], and every HOOKS.mapTarget answer at stages 0..16
//   worldshape                       the WORLDSHAPE masks, stairs and pass numbers
//   crossings, blend, capital        PROGRESSION.CROSSINGS, BLEND.stats, CAPITAL.base
//   lights, boss_calls, atlas        LIGHTS sources, every HOOKS.bossCall's map and near, ATLAS.hash()
//
// Usage:
//   node tools/fingerprint.mjs [index.html]                    print {table: hash} as JSON
//   node tools/fingerprint.mjs [index.html] --out FILE [--from LABEL]   write the fingerprint (hashes, and every table gzipped) to FILE
//   node tools/fingerprint.mjs [index.html] --diff FILE        compare with FILE; name each changed table and its first
//                                                              20 differing entries; exit 1 on any difference
// The baseline (docs/spread/baseline-fingerprint.json) is master at the start of each stage, regenerated after every peer
// merge and before any conversion goes on top of it.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const file = argv.find((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--'))) || path.join(ROOT, 'index.html');

// ---------- the sandbox (tools/headless.js's, without the suite run) ----------
function boot(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const noop = () => { };
  const ctx2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined, set: () => true });
  const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
  const store = {};
  const g = {
    innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, setTimeout, clearTimeout,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: i => { const k = Object.keys(store)[i]; return k === undefined ? null : k; }, get length() { return Object.keys(store).length; } },
    performance: { now: () => Date.now() }, console: Object.assign(Object.create(console), { table: noop, log: noop, info: noop }), navigator: { maxTouchPoints: 0 },
    document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null },
  };
  g.window = g; g.__fullPlaythrough = false;
  vm.createContext(g);
  vm.runInContext(script, g, { filename: 'index.html' });
  return g;
}

// ---------- the tables, read inside the game's own scope (its top-level consts are not window properties) ----------
const COLLECT = String.raw`
(() => {
  newGame();
  const arr = a => a ? Array.from(a) : null;
  const pt = o => o ? [o.x, o.y] : null;
  const out = {};
  out.map = arr(map);
  out.variant = arr(variant);
  out.core = { SPAWN: pt(SPAWN), SWORD_POS: pt(SWORD_POS), SIGN_TILE: pt(SIGN_TILE), VILLAGE: [VILLAGE.x0, VILLAGE.y0, VILLAGE.x1, VILLAGE.y1], VILLAGE_SPAWN: pt(VILLAGE_SPAWN),
    CASTLE: [CASTLE.x, CASTLE.y, CASTLE.w, CASTLE.h], DUMMIES: DUMMIES.map(d => d.slice()), STALLS: STALLS.map(s => [s.x, s.y, s.npc]), MAP_W, MAP_H };
  out.regions = REGIONS.map(r => [r.name, r.sub, r.x0, r.y0, r.x1, r.y1]);
  out.buildings = BUILDINGS.map(b => [b.id, b.x, b.y, b.w, b.h, b.door === undefined ? null : b.door, b.doorTop === undefined ? null : b.doorTop, (b.f || []).map(f => f.slice())]);
  out.npcs = NPCS.map(n => [n.id, n.x, n.y]);
  out.spawns = MONSTER_SPAWNS.map(s => [s.type, s.tx, s.ty, !!s.camp, s.movedFrom || null]);
  const I = window.INSTANCES;
  out.instances = (I ? I.list() : []).slice().sort().map(id => { const d = I.get(id) || {}; return [id, d.door || null, d.step || null, d.entry || null, d.exit || null]; });
  out.map_targets = [];
  for (let s = 0; s <= 16; s++) { const t = MAP_TARGETS[s]; out.map_targets.push(t ? [s, t.x, t.y, t.label] : [s, null]); }
  // every HOOKS.mapTarget answer at each main-story stage, from a new game's quest state
  out.map_hooks = [];
  { const keep = JSON.stringify(quest);
    for (let s = 0; s <= 16; s++) {
      quest = JSON.parse(keep); quest.stage = s;
      HOOKS.mapTarget.forEach((f, k) => { let t = null; try { t = f(); } catch (e) { t = 'threw'; } out.map_hooks.push([s, k, t && typeof t === 'object' ? [t.x, t.y, t.label, t.id, t.map || null] : t]); });
    }
    // and again with every side quest asking (activeQuests() says yes to any id; bread and wren active): the side targets too
    const aq = window.activeQuests; class Every extends Array { includes() { return true; } }
    window.activeQuests = () => Every.from(aq());
    try {
      for (let s = 0; s <= 16; s++) {
        quest = JSON.parse(keep); quest.stage = s; quest.bread = 'active'; quest.wren = 'active';
        HOOKS.mapTarget.forEach((f, k) => { let t = null; try { t = f(); } catch (e) { t = 'threw'; } out.map_hooks.push(['all', s, k, t && typeof t === 'object' ? [t.x, t.y, t.label, t.id, t.map || null] : t]); });
      }
    } finally { window.activeQuests = aq; }
    quest = JSON.parse(keep); }
  const WS = window.WORLDSHAPE;
  out.worldshape = WS ? { masks: Object.keys(WS.shapes || {}).sort().map(n => [n, arr(WS.mask(n))]), stairs: WS.STAIRS, pass: WS.pass || null, seamsGW: WS.seams ? Array.from({ length: MAP_W }, (_, x) => WS.seams.sGW(x)) : null } : null;
  out.crossings = window.PROGRESSION ? PROGRESSION.CROSSINGS : null;
  out.blend = window.BLEND ? BLEND.stats : null;
  out.capital = window.CAPITAL ? { base: arr(CAPITAL.base) } : null;
  const L = window.LIGHTS;
  out.lights = L ? { list: L.list(), over: (() => { try { return L.lights({}); } catch (e) { return 'threw'; } })() } : null;
  const BC = HOOKS.bossCall || {};
  out.boss_calls = Object.keys(BC).sort().map(k => [k, BC[k] ? BC[k].map : null, BC[k] ? BC[k].near || null : null]);
  out.atlas = window.ATLAS ? ATLAS.hash() : null;
  return JSON.stringify(out);
})()`;

// tables are compared entry by entry: an array's own items, or an object's keys
const entries = v => Array.isArray(v) ? v.map((x, i) => [i, x]) : (v && typeof v === 'object') ? Object.keys(v).map(k => [k, v[k]]) : [['value', v]];
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

export function fingerprint(htmlFile) {
  const g = boot(htmlFile);
  const tables = JSON.parse(vm.runInContext(COLLECT, g));
  const hashes = {};
  for (const k of Object.keys(tables)) hashes[k] = sha(JSON.stringify(tables[k]));
  hashes.all = sha(JSON.stringify(hashes));
  return { hashes, tables };
}

// the first n differing entries of one table, as readable lines
export function diffTable(name, a, b, n = 20, W = 260) {
  const out = [];
  if (name === 'map' || name === 'variant') {   // a tile grid: name the tile
    const len = Math.max(a ? a.length : 0, b ? b.length : 0);
    for (let i = 0; i < len && out.length < n; i++) if ((a || [])[i] !== (b || [])[i]) out.push(`  [${i}] tile ${i % W},${Math.floor(i / W)}: ${JSON.stringify((a || [])[i])} -> ${JSON.stringify((b || [])[i])}`);
    return out;
  }
  const ea = new Map(entries(a).map(([k, v]) => [String(k), JSON.stringify(v)])), eb = new Map(entries(b).map(([k, v]) => [String(k), JSON.stringify(v)]));
  for (const k of new Set([...ea.keys(), ...eb.keys()])) {
    if (ea.get(k) === eb.get(k)) continue;
    const cut = s => s === undefined ? '(missing)' : s.length > 300 ? s.slice(0, 300) + '...' : s;
    out.push(`  [${k}] ${cut(ea.get(k))}\n     -> ${cut(eb.get(k))}`);
    if (out.length >= n) break;
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fp = fingerprint(file);
  const outFile = opt('--out'), diffFile = opt('--diff');
  if (outFile) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    // the hashes in plain sight; the tables (for --diff's entry lists) gzipped, since the grids and masks are most of it
    const tablesGz = zlib.gzipSync(JSON.stringify(fp.tables), { level: 9 }).toString('base64');
    fs.writeFileSync(outFile, JSON.stringify({ made: new Date().toISOString(), from: opt('--from') || path.basename(file), hashes: fp.hashes, tablesGz }, null, 1) + '\n');
    console.log(`fingerprint ${fp.hashes.all} written to ${outFile}`);
  }
  if (diffFile) {
    const base = JSON.parse(fs.readFileSync(diffFile, 'utf8'));
    if (base.tablesGz && !base.tables) base.tables = JSON.parse(zlib.gunzipSync(Buffer.from(base.tablesGz, 'base64')).toString('utf8'));
    const changed = Object.keys({ ...base.hashes, ...fp.hashes }).filter(k => k !== 'all' && base.hashes[k] !== fp.hashes[k]);
    if (!changed.length) { console.log(`fingerprint ${fp.hashes.all}: identical to ${diffFile}`); process.exit(0); }
    console.log(`fingerprint ${fp.hashes.all} differs from ${diffFile} (${base.hashes.all}) in ${changed.length} table${changed.length > 1 ? 's' : ''}: ${changed.join(', ')}`);
    for (const k of changed) {
      console.log(`changed table: ${k}`);
      if (!base.tables) { console.log('  (the baseline has hashes only)'); continue; }
      for (const line of diffTable(k, base.tables[k], fp.tables[k], 20, (base.tables.core && base.tables.core.MAP_W) || 260)) console.log(line);
    }
    process.exit(1);
  }
  if (!outFile) console.log(JSON.stringify(fp.hashes, null, 1));
}
