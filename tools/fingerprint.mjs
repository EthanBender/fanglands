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
//   map_hooks (primed)               also with each feature's own quest state primed (tinker, sky, capital.bell, kingdom,
//                                    redcut, dwarf, royalmine, orders, the War Shed, the island, the storm's Tinkerton) at
//                                    stages 0, 9 and 16; map_hooks_silent lists any hook no state made answer
//   night_lights                     every HOOKS.nightLights light over the whole overworld at night
//   exports, exports_unstable        every window.* handle the game sets, as data (HOUSE.STEP, SKYCITY.STEP_T ...); a handle
//                                    that differs between two boots of one build is kept by name only
//   render, render_late              every canvas call render() makes, view by view over the whole overworld at night (the
//                                    draw code's own coordinates: The Fang's circle light, lamps, the night's light holes),
//                                    on the new game and again on the later world (crypt freed, first house built, the War
//                                    Shed's wreck due, one frame of update), with late_diffs (that world's mapDiffs)
// Clocks and dice are fixed for the sweeps and the new game, so one build always gives the same hashes.
//
// Usage:
//   node tools/fingerprint.mjs [index.html]                    print {table: hash} as JSON
//   node tools/fingerprint.mjs [index.html] --out FILE [--from LABEL]   write the fingerprint (hashes, and every table gzipped) to FILE
//   node tools/fingerprint.mjs [index.html] --diff FILE        compare with FILE; name each changed table and its first
//                                                              20 differing entries; exit 1 on any difference
// --diff also prints the strict report (ATLAS.strict(), as src file:line) and fails on an entry docs/spread/strict-allow.json
// does not list ({ file?, anchor, x, y, reason }).
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
  // the canvas: a no-op, except while REC.on is set (the render sweeps below), when every call and every property set
  // is passed to REC.on with its arguments (numbers rounded to 1e-4 px: a sub-pixel float difference is not visible)
  const REC = { on: null };
  const rec = (k, args) => { if (REC.on) REC.on(k, args); };
  const grad = kind => (...a) => { rec(kind, a); return { addColorStop: (...b) => rec('addColorStop', b) }; };
  const ctx2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? (...a) => { rec('measureText', a); return { width: 10 }; } : (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient') ? grad(k) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? (...a) => rec(k, a) : undefined, set: (t, k, v) => { rec('=' + String(k), [v]); return true; } });
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
  g.__base = Object.keys(g).concat(['__base', '__REC']);   // the sandbox's own globals (the exports table skips them)
  vm.runInContext(script, g, { filename: 'index.html' });
  g.__REC = REC;
  return g;
}

// ---------- the tables, read inside the game's own scope (its top-level consts are not window properties) ----------
const COLLECT = String.raw`
(() => {
  // the dice from here on are seeded (the new game's walk timers, the sweeps' frame of update), so two boots of one build
  // reach the same state; world generation never draws Math.random (the world rules), so the map does not depend on it
  { let a = 0x5EED; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
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
    // and with each feature's own quest state primed, so the hooks gated on it answer: Tinkerton's lab (tinker.stage),
    // the wind shrine (sky.stage), the bell story (capital.bell), Lark (kingdom.stage), the Redcut (redcut.stage),
    // Deepholm and the Royal Mine (dwarf.visited, dwarf.stage, royalmine.stage), Fennick's orders, the War Shed (stage 9,
    // hollowford.toldShed), the island (player.visitedVillage), the storm's Tinkerton (boats.where farshore, tinker 0).
    // Each primer runs at main-story stages 0, 9 and 16, on a quest whose sub-objects the hooks themselves made first.
    HOOKS.mapTarget.forEach(f => { try { f(); } catch (e) { } });
    const made = JSON.stringify(quest), vv = player.visitedVillage;
    const setPath = (o, path, v) => { const ks = path.split('.'); let c = o; for (let i = 0; i < ks.length - 1; i++) { if (!c[ks[i]] || typeof c[ks[i]] !== 'object') c[ks[i]] = {}; c = c[ks[i]]; } c[ks[ks.length - 1]] = v; };
    const R = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const PRIMERS = [
      ['tinker.stage', R(0, 7)], ['sky.stage', R(0, 7)], ['capital.bell', R(0, 7)], ['kingdom.stage', R(0, 7)], ['redcut.stage', R(0, 5)],
      ['dwarf.stage', R(0, 4)], ['dwarf.visited', [true]], ['royalmine.stage', R(0, 7), { 'dwarf.stage': 2 }], ['orders.taken', [true]],
      ['hollowford.toldShed', [true]], ['visitedVillage', [true]], ['boats.where', ['farshore'], { 'tinker.stage': 0 }],
    ];
    const answered = HOOKS.mapTarget.map(() => false);
    const ask = tag => HOOKS.mapTarget.forEach((f, k) => { let t = null; try { t = f(); } catch (e) { t = 'threw'; } if (t && typeof t === 'object') answered[k] = true; out.map_hooks.push([tag, k, t && typeof t === 'object' ? [t.x, t.y, t.label, t.id, t.map || null] : t]); });
    out.map_hooks.forEach(([a, b, c, t]) => { const k = a === 'all' ? c : b, ans = a === 'all' ? t : c; if (ans && typeof ans === 'object') answered[k] = true; });
    for (const [path, vals, extra] of PRIMERS) for (const v of vals) for (const st of [0, 9, 16]) {
      quest = JSON.parse(made); quest.stage = st; player.visitedVillage = vv;
      if (path === 'visitedVillage') player.visitedVillage = v; else setPath(quest, path, v);
      if (extra) for (const k in extra) setPath(quest, k, extra[k]);
      ask(path + '=' + JSON.stringify(v) + '@' + st);
    }
    player.visitedVillage = vv; quest = JSON.parse(keep);
    // the hooks no primer made answer: none of them may hold a position the fingerprint cannot see (--diff prints them)
    out.map_hooks_silent = HOOKS.mapTarget.map((f, k) => answered[k] ? null : [k, String(f).replace(/\s+/g, ' ').slice(0, 140)]).filter(Boolean); }
  const WS = window.WORLDSHAPE;
  out.worldshape = WS ? { masks: Object.keys(WS.shapes || {}).sort().map(n => [n, arr(WS.mask(n))]), stairs: WS.STAIRS, pass: WS.pass || null, seamsGW: WS.seams ? Array.from({ length: MAP_W }, (_, x) => WS.seams.sGW(x)) : null } : null;
  out.crossings = window.PROGRESSION ? PROGRESSION.CROSSINGS : null;
  out.blend = window.BLEND ? BLEND.stats : null;
  out.capital = window.CAPITAL ? { base: arr(CAPITAL.base) } : null;
  const L = window.LIGHTS;
  out.lights = L ? { list: L.list(), over: (() => { try { return L.lights({}); } catch (e) { return 'threw'; } })() } : null;
  // every coordinate light a feature keeps (HOOKS.nightLights: 95-thistledown's lamps, torches and fountain ...), over the
  // whole overworld at night (the tile lights, fires, lamps and doors, are the map's and BUILDINGS' and hashed there)
  { const day0 = player.dayTime, NL = HOOKS.nightLights || [];
    if (window.NIGHT) player.dayTime = NIGHT.LIGHT + NIGHT.DUSK + 30;
    out.night_lights = NL.map((f, k) => { const all = []; try { f(all, 0, 0, MAP_W - 1, MAP_H - 1); } catch (e) { return [k, 'threw']; } return [k, all.map(L => [L.x, L.y, L.r])]; });
    player.dayTime = day0; }
  const BC = HOOKS.bossCall || {};
  out.boss_calls = Object.keys(BC).sort().map(k => [k, BC[k] ? BC[k].map : null, BC[k] ? BC[k].near || null : null]);
  out.atlas = window.ATLAS ? ATLAS.hash() : null;
  return JSON.stringify(out);
})()`;

// tables are compared entry by entry: an array's own items, or an object's keys
const entries = v => Array.isArray(v) ? v.map((x, i) => [i, x]) : (v && typeof v === 'object') ? Object.keys(v).map(k => [k, v[k]]) : [['value', v]];
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

// ---------- the render sweeps: every canvas call render() makes, view by view over the whole overworld, at night ----------
// The knight stands at the middle of each view (the camera follows him), with the clock, the frame time, performance.now,
// Date.now and Math.random fixed for each view, so a view draws the same calls every run. This sees what no table holds:
// coordinates written in draw code (The Fang's summoning-circle light, a lamp drawn by position), the night's light
// holes, and anything a feature draws where its own constants say. One entry per view: its middle tile, the number of
// calls and their hash. A view that throws is recorded with its message.
const SWEEP_SETUP = String.raw`
(() => {
  const S = window.__SWEEP = {};
  const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const keepR = Math.random, keepPN = performance.now, keepDN = Date.now;
  S.views = () => { const out = [], W = MAP_W * TILE, H = MAP_H * TILE;
    for (let y = VH / 2; y < H + VH / 2; y += VH) for (let x = VW / 2; x < W + VW / 2; x += VW) out.push([Math.min(x, W - 1), Math.min(y, H - 1)]); return out; };
  S.view = (px, py, k) => {
    let c = 0; Math.random = mul(0xC0FFEE + k); performance.now = () => 1e6 + (c += 0.25); Date.now = () => 1.7e12 + c;
    const t0 = time; time = 1000;
    try {
      if (window.NIGHT) player.dayTime = NIGHT.LIGHT + NIGHT.DUSK + 30;
      player.x = px; player.y = py; player.dead = false; player.mech = null; player.moving = false; player.action = null;
      render(); return null;
    } catch (e) { return String(e && e.message || e).slice(0, 120); }
    finally { time = t0; Math.random = keepR; performance.now = keepPN; Date.now = keepDN; }
  };
  // the later world: the crypt freed and the first house built (31-rebuild's survivors and villagers in the square),
  // the War Shed's wreck due (20-hollowford rolls it out beside the door), one frame of update
  S.late = () => {
    let c = 0; const keepR2 = Math.random; Math.random = mul(0xBEEF); performance.now = () => 2e6 + (c += 0.25); Date.now = () => 1.8e12 + c;
    try {
      const hf = quest.hollowford || (quest.hollowford = {}); hf.freed = true; hf.wreckDue = true;
      quest.rebuild = Object.assign(quest.rebuild || {}, { done: Object.assign((quest.rebuild && quest.rebuild.done) || {}, { house: true }) });
      update(1 / 60);
      return null;
    } catch (e) { return String(e && e.message || e).slice(0, 120); }
    finally { Math.random = keepR2; performance.now = keepPN; Date.now = keepDN; }
  };
})()`;
function sweep(g) {
  const REC = g.__REC, rows = [];
  const views = JSON.parse(vm.runInContext('JSON.stringify(__SWEEP.views())', g));
  views.forEach(([px, py], k) => {
    const h = crypto.createHash('sha256'); let n = 0;
    const enc = v => typeof v === 'number' ? String(Math.round(v * 1e4) / 1e4) : typeof v === 'string' ? JSON.stringify(v) : typeof v === 'boolean' || v === null || v === undefined ? String(v) : 'o';
    REC.on = (name, args) => { n++; h.update(name + '(' + Array.prototype.map.call(args, enc).join(',') + ')\n'); };
    g.__k = k; g.__px = px; g.__py = py;
    let err = null;
    try { err = vm.runInContext('__SWEEP.view(__px, __py, __k)', g); } finally { REC.on = null; }
    rows.push([Math.floor(px / 48), Math.floor(py / 48), n, h.digest('hex').slice(0, 16), err]);
  });
  return rows;
}
// ---------- the game's exported handles: every window.* the game sets (bar functions), as data ----------
// window.HOUSE.STEP (the island's return step), SKYCITY.STEP_T, DH.SHAFT ... and every table a feature exposes for its
// tests. ATLAS is hashed by ATLAS.hash() (its frame tables are not on screen until 4a); the big grids are hashed above.
const EXPORTS = String.raw`
(() => {
  const SKIP = new Set(['ATLAS', 'FANGLANDS', 'PLAYTHROUGH', '__SWEEP', '__REC', '__base', '__k', '__px', '__py', 'window', 'self', 'globalThis', 'document', 'navigator', 'localStorage', 'performance', 'console']);
  const base = new Set(window.__base), out = {};
  const seen = new WeakSet();
  const walk = (v, d) => {
    if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : typeof v === 'number' && !Number.isFinite(v) ? String(v) : v;
    if (seen.has(v)) return '[seen]';
    if (d > 6) return '[deep]';
    if (ArrayBuffer.isView(v)) return v.length > 4096 ? '[grid ' + v.length + ']' : Array.from(v);
    seen.add(v);
    try {
      if (v instanceof Map) return ['Map', [...v.entries()].slice(0, 2000).map(([a, b]) => [walk(a, d + 1), walk(b, d + 1)])];
      if (v instanceof Set) return ['Set', [...v].slice(0, 2000).map(x => walk(x, d + 1))];
      if (Array.isArray(v)) return v.length > 4096 ? '[list ' + v.length + ']' : v.map(x => walk(x, d + 1));
      const o = {}; for (const k of Object.keys(v)) { let x; try { x = v[k]; } catch (e) { x = '[threw]'; } const w = walk(x, d + 1); if (w !== undefined) o[k] = w; }
      return o;
    } finally { seen.delete(v); }
  };
  for (const k of Object.keys(window).sort()) {
    if (base.has(k) || SKIP.has(k)) continue;
    let v; try { v = window[k]; } catch (e) { continue; }
    if (typeof v === 'function' || v === undefined) continue;
    const w = walk(v, 0); if (w !== undefined) out[k] = JSON.stringify(w);
  }
  return JSON.stringify(out);
})()`;

export function fingerprint(htmlFile) {
  const g = boot(htmlFile);
  const tables = JSON.parse(vm.runInContext(COLLECT, g));
  // the exports, from this boot and a second one: a handle whose data differs between two boots of the same build
  // (a clock, a die) cannot prove anything, so only its name is kept (exports_unstable)
  { const a = JSON.parse(vm.runInContext(EXPORTS, g)), g2 = boot(htmlFile), b = (vm.runInContext(COLLECT, g2), JSON.parse(vm.runInContext(EXPORTS, g2)));
    tables.exports = {}; tables.exports_unstable = [];
    for (const k of Object.keys(a).sort()) if (a[k] === b[k]) tables.exports[k] = JSON.parse(a[k]); else tables.exports_unstable.push(k); }
  // the render sweeps: the new game's world at night, then the later world (after S.late's one frame), and its mapDiffs
  vm.runInContext(SWEEP_SETUP, g);
  tables.render = sweep(g);
  const lateErr = vm.runInContext('__SWEEP.late()', g);
  tables.render_late = sweep(g);
  tables.late_diffs = { err: lateErr, diffs: JSON.parse(vm.runInContext('JSON.stringify([...mapDiffs.entries()].sort((a, b) => a[0] - b[0]).map(([i, t]) => [i % MAP_W, Math.floor(i / MAP_W), tileName(t)]))', g)) };
  const hashes = {};
  for (const k of Object.keys(tables)) hashes[k] = sha(JSON.stringify(tables[k]));
  hashes.all = sha(JSON.stringify(hashes));
  // the strict report (§8): frame points written far outside their own place, with the src file and line that wrote them.
  // Not part of the hashes: --diff fails on any entry docs/spread/strict-allow.json does not list.
  const raw = JSON.parse(vm.runInContext('JSON.stringify(window.ATLAS && ATLAS.strict ? ATLAS.strict() : [])', g));
  const html = fs.readFileSync(htmlFile, 'utf8'), lines = html.slice(html.indexOf('<script>') + 8).split('\n'), marks = [];
  lines.forEach((l, i) => { const m = /^\/\/ ---- src\/(.+) ----$/.exec(l); if (m) marks.push([i + 1, m[1]]); });
  const srcOf = at => { const m = /index\.html:(\d+)/.exec(at); if (!m) return at; const n = +m[1]; let f = null; for (const mk of marks) if (mk[0] < n) f = mk; else break; return f ? `src/${f[1]}:${n - f[0]}` : at; };
  const strict = raw.map(([at, anchor, x, y, hits]) => ({ at: srcOf(at), anchor, x, y, hits: hits || 1 }));
  return { hashes, tables, strict };
}
export function strictNew(strict, allowFile = path.join(ROOT, 'docs', 'spread', 'strict-allow.json')) {
  const allow = fs.existsSync(allowFile) ? JSON.parse(fs.readFileSync(allowFile, 'utf8')) : [];
  return strict.filter(e => !allow.some(a => a.anchor === e.anchor && a.x === e.x && a.y === e.y && (!a.file || e.at.startsWith(a.file))));
}

// the first n differing entries of one table, as readable lines
export function diffTable(name, a, b, n = 20, W = 260) {
  const out = [];
  if ((name === 'render' || name === 'render_late') && Array.isArray(a) && Array.isArray(b)) {   // one view per entry
    for (let i = 0; i < Math.max(a.length, b.length) && out.length < n; i++) {
      const p = a[i] || [], q = b[i] || [];
      if (JSON.stringify(p) !== JSON.stringify(q)) out.push(`  [${i}] the view centred on tile ${q[0] ?? p[0]},${q[1] ?? p[1]}: ${p[2]} calls ${p[3]}${p[4] ? ' (threw ' + p[4] + ')' : ''} -> ${q[2]} calls ${q[3]}${q[4] ? ' (threw ' + q[4] + ')' : ''}`);
    }
    return out;
  }
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
    const fresh = strictNew(fp.strict);
    for (const [k, src] of fp.tables.map_hooks_silent || []) console.log(`note: HOOKS.mapTarget[${k}] answered nothing in any primed state (its positions are not in the fingerprint): ${src.slice(0, 100)}`);
    if ((fp.tables.exports_unstable || []).length) console.log(`note: window handles that differ between two boots (hashed by name only): ${fp.tables.exports_unstable.join(', ')}`);
    for (const e of fresh) console.log(`strict report: ${e.at}: ${e.anchor} point ${e.x},${e.y} lies past its box + guard + 12 (docs/spread/strict-allow.json does not list it)`);
    if (!changed.length) { console.log(`fingerprint ${fp.hashes.all}: identical to ${diffFile}; strict report: ${fp.strict.length} entr${fp.strict.length === 1 ? 'y' : 'ies'}, ${fresh.length} new`); process.exit(fresh.length ? 1 : 0); }
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
