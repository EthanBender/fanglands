#!/usr/bin/env node
// ============================================================================
// SIM-SUITE — the deploy gate for the server's game copy (docs/ONLINE.md, "The shared world", Stage 0)
//   node tools/sim-suite.mjs [index.html] [--only=reads,selftest,strippedtests,isolation,parity,instances,looks]
// 0. The stripped copy reads no stripped name's value from a kept file unless tools/build-sim.mjs STRIP_READS lists it
//    with its reason (with check 1b and the parity runs, what stands for the stripped build).
// 1. The whole HOOKS.selfTest suite through makeGame (the full build), with the same pass count as tools/headless.js
//    (which this runs too, in the same way headless.js does, for the count). A run with a failure is run once more:
//    the suite has a few known random flakes.
// 2. Two copies share nothing: INSTANCES, COOP, NIGHT, monsters; 2a. dice and clocks, read through the game's own code;
//    2b. the generated modules name no clock, dice or timer of the machine (every free name is a plain built-in).
// 3. Stripped equals full: the same seed gives the same map and, after 600 ticks, the same monster and knight state;
//    alone, and through SimHost with 5 scripted knights fighting on the overworld; 3c (Stage 2) the same through SimHost
//    in each map Stage 2 lets the world run (deepholm, aerie, coalmine), 2 knights each; 3d (Stage 2) the full build
//    drawing its whole frame after every tick ends where the stripped copy (no drawing) ends, there and on the overworld.
// 4. The stand-in: parked dead on a solid tile, never respawns, never leaves its instance, keeper of its map.
// 5. Each instance's worldGen:false copy matches its full build (tiles, monsters, 300 ticks with two knights); the
//    ones that match are printed as the list SimHost may build without the overworld.
// 1b (Stage 2). The same self-test suite through a --test-ui build: the server's strip with the drawing given back (six
//    files and every drawing registration, build-sim TEST_UI_FILES): the full build's count, less the stripped files' own
//    checks and the listed UI-only ones. NOT the shipped copy: that is 1c.
// 1c (Stage 2). The same suite through the copy exactly as shipped (--strip --keep-tests): every check that fails there must
//    pass in 1b (it fails only because it presses the drawing); --list-ui prints each one. With 0, 3c and 3d (the drawing
//    holds no rule the copy needs), this closes the stripped-suite gap of the 3 Oct addendum.
// 6 (Stage 2). The monsters' look fields: read from 78-monsterlook when the copy is built, carried by the rows, and each one
//    reaches a puppet in a real game.
// Exit 1 on any FAIL. Takes one of the machine's test slots, like tools/headless.js.
// ============================================================================
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { loadGame, takeSlot, plainCopy, mapHash, stateHash, Bots, ROOT, makeWindow, mulberry32 } from './sim-lib.mjs';
import { SimHost } from '../online/src/sim/host.js';
import { createRequire } from 'node:module';
import { checkStrippedReads, TEST_UI_FILES } from './build-sim.mjs';

// every name a module reads or writes without declaring it, with how often (acorn + eslint-scope, as build-sim parses)
function freeNames(code) {
  const req = createRequire(path.join(ROOT, 'online', 'package.json'));
  const ast = req('acorn').parse(code, { ecmaVersion: 2023, sourceType: 'module', ranges: true });
  const sm = req('eslint-scope').analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
  const out = {};
  for (const s of [sm.globalScope, ...sm.globalScope.childScopes.filter(c => c.type === 'module')]) for (const r of s.through) out[r.identifier.name] = (out[r.identifier.name] || 0) + 1;
  return out;
}

const htmlFile = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(ROOT, 'index.html');
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = k => !only.length || only.includes(k);
let fails = 0, passes = 0;
const check = (name, ok, info) => { if (ok) passes++; else fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '   ' + JSON.stringify(info) : '')); };
const t0 = Date.now();
takeSlot();

const html = fs.readFileSync(htmlFile, 'utf8');
const full = await loadGame({ strip: false, html: htmlFile });
const strip = await loadGame({ strip: true, html: htmlFile });
const NOW = Date.parse('2026-10-03T12:00:00Z');
const noTimer = { set: () => 0, clear: () => { } };

// ---------------------------------------------------------------------------
// 0. what the kept files read from the stripped ones (tools/build-sim.mjs STRIP_READS)
// ---------------------------------------------------------------------------
if (want('reads')) {
  const r = checkStrippedReads(fs.readFileSync(strip.file, 'utf8'));
  for (const x of r.unlisted.slice(0, 20)) console.log(`  not on the list: ${x.name} in ${x.file} (line ${x.line}): ${x.text}`);
  if (r.stale.length) console.log(`  (on the list but no read left, can come off: ${r.stale.join(', ')})`);
  check(`0. the stripped copy: every read of a stripped name from a kept file is on the list with its reason (${r.reads} reads of ${r.names} names; ${r.unreachable} of ${r.functions} named functions unreachable without the drawing)`,
    !r.unlisted.length, { unlisted: r.unlisted.length, stale: r.stale.length });
}

// ---------------------------------------------------------------------------
// 1. the self-tests through the factory, against the same suite run the way tools/headless.js runs it
// ---------------------------------------------------------------------------
function headlessWindow() {
  // tools/headless.js's window, word for word, plus the two names the factory reads from window (Math, Date)
  const noop = () => { };
  const ctx2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined, set: () => true });
  const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
  const store = {};
  const quiet = Object.assign(Object.create(console), { table: () => { }, log: noop, info: noop, warn: noop, error: noop });
  const g = {
    innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, setTimeout, clearTimeout,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: i => { const k = Object.keys(store)[i]; return k === undefined ? null : k; }, get length() { return Object.keys(store).length; } },
    performance: { now: () => Date.now() }, console: quiet, navigator: { maxTouchPoints: 0 },
    document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null },
  };
  g.window = g; g.__fullPlaythrough = false;
  // as tools/headless.js does: the script as text, for the self-tests that read the source itself (79-strikes: no regex lookbehind)
  g.__gameSource = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  return g;
}
function runSuite(how, makeGame = full.makeGame) {
  const g = headlessWindow();
  const byFile = {};
  if (how === 'vm') { vm.createContext(g); const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>')); vm.runInContext(script, g, { filename: 'index.html' }); }
  else {
    g.Math = Math; g.Date = Date;
    const api = makeGame(g);
    // each file's chapter on its own: the check names it made, and a chapter that throws is one FAIL named for its file
    // (the rest of the suite still runs). The checks themselves are untouched.
    const H = api.peek('HOOKS');
    H.selfTest = H.selfTest.map(f => {
      const file = f.__file || '?';
      const w = function (check, F, h) {
        const mine = (n, ok, info) => { (byFile[file] = byFile[file] || []).push(n); return check(n, ok, info); };
        try { return f(mine, F, h); } catch (e) { mine('THREW ' + file + ': ' + String(e && e.message).slice(0, 160), false); }
      };
      w.__file = file; return w;
    });
  }
  const r = g.FANGLANDS.selfTest();
  const names = Object.keys(r).filter(k => k !== 'summary');
  const fileOf = {}; for (const [f, list] of Object.entries(byFile)) for (const n of list) fileOf[n] = f;
  return { summary: r.summary, total: names.length, pass: names.filter(k => !String(r[k]).startsWith('FAIL')).length, fails: names.filter(k => String(r[k]).startsWith('FAIL')).map(k => k + ': ' + String(r[k]).slice(0, 200)), failNames: names.filter(k => String(r[k]).startsWith('FAIL')), names, byFile, fileOf, report: r };
}
let f1 = null;
if (want('selftest')) {
  const timed = how => { const a = Date.now(); let r = runSuite(how); if (r.fails.length) { console.log(`  (${how}: ${r.fails.length} failed, running once more: ${r.fails.slice(0, 3).join(' / ')})`); r = runSuite(how); } r.ms = Date.now() - a; return r; };
  const v = timed('vm'), f = timed('factory'); f1 = f;
  for (const x of f.fails) console.log('  factory: ' + x);
  for (const x of v.fails) console.log('  headless: ' + x);
  const onlyF = f.names.filter(n => !v.names.includes(n)), onlyV = v.names.filter(n => !f.names.includes(n));
  check(`1. the whole self-test suite through makeGame (full build) passes with the same count as tools/headless.js: ${f.summary} vs ${v.summary}`,
    !f.fails.length && !v.fails.length && f.pass === v.pass && f.total === v.total, { factory: { pass: f.pass, total: f.total, ms: f.ms }, headless: { pass: v.pass, total: v.total, ms: v.ms }, namesOnlyInOne: onlyF.length + onlyV.length });
  if (onlyF.length) console.log(`  (${onlyF.length} check names differ between the two runs: they carry random numbers, e.g. "${onlyF[0].slice(0, 90)}")`);
}

// ---------------------------------------------------------------------------
// 1b. the same suite through the STRIPPED build (decided 2026-10-03, before any copy runs monsters for players): the self-tests
// kept, and the pieces the checks press given back (tools/build-sim.mjs TEST_UI_FILES: the drawing that lays out a panel's
// buttons, the title, the playthrough bot, with every drawing registration kept). Every other stripped file stays the
// server's stand-in. It must pass with the full build's count, less exactly: the stripped files' own checks, and the checks
// below, each of which reads one of those stand-ins (the book, the music, the icons) and none of which is about monsters,
// combat, drops, instances or night. A listed check that passes is fine; a check that fails and is not listed fails the gate.
// ---------------------------------------------------------------------------
export const UI_ONLY = [
  { file: '10-hud', re: /^THREW 10-hud: .*not valid JSON/, why: 'the panel layout audit keeps the book\'s state with JSON.parse(JSON.stringify(WIKI.state)); the book (44-wiki) is a stand-in, so its three panel-layout checks never run' },
  { file: '17-tap', re: /^tap: the long-press tag on a monster carries a wiki mark/, why: 'the mark opens the book (44-wiki), a stand-in' },
  { file: '43-settings', re: /^settings: music row drives 15-music/, why: 'the music (15-music) is a stand-in' },
  { file: '43-settings', re: /^settings: persist as JSON under fanglands\.settings/, why: 'the legacy music key migrates through MUSIC.enabled() (15-music), a stand-in' },
  { file: '43-settings', re: /^settings: the Controls line is built from the real key handlers/, why: 'the K (book) and N (music) handlers live in the stripped 44-wiki and 15-music' },
  { file: '43-settings', re: /^settings: the key table lists every key the game answers/, why: 'the K (book) and N (music) handlers live in the stripped 44-wiki and 15-music' },
  { file: '46-cinderwight', re: /^cinderwight: the wiki page names it/, why: 'the book (44-wiki) is a stand-in' },
  { file: '46-scales', re: /^scales: the wiki ash drake page/, why: 'the book (44-wiki) is a stand-in' },
  { file: '47-outliers', re: /^outliers: the first blow taken while wearing a shield teaches the block, once a game, and the book carries a Blocking page/, why: 'the Blocking page is the book\'s (44-wiki), a stand-in (the lesson itself is checked: taught and once pass)' },
  { file: '62-ores', re: /^ores: each new rock is solid, tappable on the iPad, mined through the core GATHER table, and the book has a page/, why: 'the page is the book\'s (44-wiki), a stand-in (solid, tappable and gathered are checked and pass)' },
  { file: '69-retaliate', re: /^fight back: Settings mirrors the switch, O flips it \(not while typing in the wiki\)/, why: 'typing in the book (44-wiki, a stand-in) and settings persistence through MUSIC.enabled() (15-music); every fight back check itself passes' },
  { file: '81-partyhats', re: /^party hats: six icons of their own/, why: 'the icons (80-icons, 81-icons-art) are stand-ins' },
  { file: '91-cloudkingdom', re: /^kingdom: K13b the gold stones are explained the same way everywhere a child reads about them/, why: 'one of the places is the book (44-wiki), a stand-in' },
  { file: '91-cloudkingdom', re: /^kingdom: K20 the wiki/, why: 'the book (44-wiki) is a stand-in' },
  { file: '91-royalmine', re: /^royalmine: audits: every new XP source is declared; progression has no dead gate; the book has pages/, why: 'the book\'s pages (44-wiki) and the item icons (80-icons) are stand-ins' },
];
if (want('selftest') || want('strippedtests')) {
  const fullRun = typeof f1 !== 'undefined' && f1 ? f1 : (() => { const r = runSuite('factory'); return r; })();
  const ui = await loadGame({ strip: true, keepTests: true, testUi: true, html: htmlFile });
  const a = Date.now();
  let st = runSuite('factory', ui.makeGame);
  const listedFail = n => { const f = st.fileOf[n]; return UI_ONLY.find(u => u.file === f && u.re.test(n)) || UI_ONLY.find(u => u.re.test(n) && n.startsWith('THREW ' + u.file)); };
  let stray = st.failNames.filter(n => !listedFail(n));
  if (stray.length) { console.log(`  (stripped: ${stray.length} unlisted failures, running once more: ${stray.slice(0, 3).map(x => x.slice(0, 100)).join(' / ')})`); st = runSuite('factory', ui.makeGame); stray = st.failNames.filter(n => !listedFail(n)); }
  st.ms = Date.now() - a;
  const stripped = new Set(ui.report.strippedFiles.map(x => x.file));
  const count = r => { const c = { core: 0 }; for (const n of r.names) { const f = r.fileOf[n] || 'core'; c[f] = (c[f] || 0) + 1; } return c; };
  const cf = count(fullRun), cs = count(st);
  let own = 0, lost = 0; const odd = [];
  const threw = new Set(st.failNames.filter(n => n.startsWith('THREW ')).map(n => st.fileOf[n]));
  for (const f of new Set([...Object.keys(cf), ...Object.keys(cs)])) {
    const nf = cf[f] || 0, ns = cs[f] || 0;
    if (stripped.has(f)) { own += nf; if (ns) odd.push(f + ' (stripped, yet ' + ns + ' checks ran)'); continue; }
    if (threw.has(f)) { lost += Math.max(0, nf - (ns - 1)); continue; }
    if (nf !== ns) odd.push(`${f}: ${nf} checks in the full build, ${ns} stripped`);
  }
  const listed = st.failNames.filter(n => listedFail(n));
  const listedChecks = listed.filter(n => !n.startsWith('THREW '));
  const expected = fullRun.pass - own - lost - listedChecks.length;
  for (const n of stray) console.log('  stripped, not listed: ' + n.slice(0, 220) + '   ' + String(st.report[n]).slice(0, 200));
  for (const n of listed) { const u = listedFail(n); console.log(`  UI-only (${u.file}): ${n.slice(0, 110)}... (${u.why})`); }
  for (const u of UI_ONLY) if (!listed.some(n => listedFail(n) === u)) console.log(`  (listed, passed this run: ${u.file} ${u.re})`);
  for (const o of odd) console.log('  count differs: ' + o);
  check(`1b. the self-test suite through the STRIPPED build (the buttons' drawing given back: ${TEST_UI_FILES.join(', ')}): ${st.pass} of ${st.total} pass; the full build's ${fullRun.pass}, less the ${own} checks of the stripped files themselves${lost ? ', the ' + lost + ' a listed chapter could not run' : ''} and the ${listedChecks.length} listed UI-only checks, is ${expected}`,
    !stray.length && !odd.length && st.pass === expected, { strip: { pass: st.pass, total: st.total, ms: st.ms }, full: { pass: fullRun.pass, total: fullRun.total }, ownChecksOfStrippedFiles: own, lostInListedThrow: lost, uiOnlyFailed: listedChecks.length, stray: stray.length, countsDiffer: odd.length });

  // 1c. the same suite through the copy exactly as the server ships it (--strip --keep-tests: every presentation file a
  // stand-in, every drawing registration gone). Many checks fail there, because a check opens a panel, presses E at a person
  // or a rock, or reads what the frame drew, and none of that exists in the shipped copy. Each such check is UI-only by one
  // mechanical reason the gate checks for every one of them: it passes in 1b, where the drawing is given back and nothing
  // else differs. That the drawing itself holds no rule the copy needs is checks 0 (what kept files read from stripped
  // ones), 3c (stripped equals full on the Stage 2 maps) and 3d (the full build drawing every frame changes nothing).
  // A check failing here that 1b does not pass (or list) fails the gate. --list-ui prints every one of them by name.
  const ship = await loadGame({ strip: true, keepTests: true, html: htmlFile });
  const a2 = Date.now();
  const sh = runSuite('factory', ship.makeGame);
  sh.ms = Date.now() - a2;
  const norm = n => n.replace(/-?\d+(\.\d+)?/g, '#');
  const uPass = new Set(st.names.filter(n => !st.failNames.includes(n) || listedFail(n)).map(norm));
  const uFiles = new Set(Object.values(st.fileOf));
  const unexplained = [], byFile = {};
  for (const n of sh.failNames) {
    const f = sh.fileOf[n] || 'core';
    // a chapter that stopped (the harness's THREW, or the chapter's own "ran to the end without throwing" check, which it
    // only makes when it stopped): explained when that chapter runs to the end in 1b with nothing unlisted failing
    const stopped = n.startsWith('THREW ') || / ran to the end without (throwing|an exception)/.test(n);
    const ok = stopped ? uFiles.has(f) && !st.failNames.some(x => (st.fileOf[x] || 'core') === f && !listedFail(x)) : uPass.has(norm(n));
    if (!ok) unexplained.push(n); else (byFile[f] = byFile[f] || []).push(n);
  }
  const notRun = st.names.length - sh.names.length;
  const uiOnly = Object.values(byFile).reduce((x, l) => x + l.length, 0);
  console.log(`  1c, the shipped copy: ${sh.pass} of ${sh.total} pass; ${uiOnly} fail only because they press the drawing (each passes in 1b), by chapter: ` + Object.entries(byFile).sort((x, y) => y[1].length - x[1].length).map(([f, l]) => f + ' ' + l.length).join(', ') + (notRun > 0 ? `; and ${notRun} checks of chapters that stopped at a pressed button did not run (they all pass in 1b)` : ''));
  if (process.argv.includes('--list-ui')) for (const [f, l] of Object.entries(byFile)) for (const n of l) console.log(`  UI-only in the shipped copy (${f}): ${n.slice(0, 200)}   (passes in 1b, with the drawing given back)`);
  for (const n of unexplained.slice(0, 20)) console.log('  shipped copy, NOT explained by the drawing: ' + n.slice(0, 220) + '   ' + String(sh.report[n]).slice(0, 200));
  check(`1c. the self-test suite through the copy exactly as shipped (no drawing at all): ${sh.pass} of ${sh.total} pass, and every one of the ${sh.failNames.length} that fail passes in 1b, where only the drawing is given back (its six files and its registrations)`,
    !unexplained.length && sh.pass > 0, { ship: { pass: sh.pass, total: sh.total, ms: sh.ms }, uiOnly, notRun, unexplained: unexplained.length });
}

// ---------------------------------------------------------------------------
// 2. two copies share nothing
// ---------------------------------------------------------------------------
if (want('isolation')) {
  const A = plainCopy(strip.makeGame, 1), B = plainCopy(strip.makeGame, 1);
  const nB = B.g('monsters').length, mapB = mapHash(B.api);
  const differ = A.w.INSTANCES !== B.w.INSTANCES && A.w.COOP !== B.w.COOP && A.w.NIGHT !== B.w.NIGHT && A.g('monsters') !== B.g('monsters') && A.g('map') !== B.g('map') && A.g('HOOKS') !== B.g('HOOKS') && A.g('player') !== B.g('player');
  const entered = A.w.INSTANCES.enter('spider_den');
  A.w.COOP.state.keeper = 'Somebody'; A.w.COOP.state.restAt.x = 1;
  A.w.NIGHT.resetTimer(); const nightA = A.w.NIGHT.timer(), nightB = B.w.NIGHT.timer();
  check('2. two copies share nothing: their own INSTANCES, COOP, NIGHT, monsters, map, HOOKS and knight; one entering the Spider Den and changing its keeper leaves the other as it was',
    differ && entered && A.w.INSTANCES.active() === 'spider_den' && B.w.INSTANCES.active() === null && A.g('monsters').length === 13 && B.g('monsters').length === nB && mapHash(B.api) === mapB && B.w.COOP.state.keeper === null && !B.w.COOP.state.restAt.x,
    { differ, entered, aInst: A.w.INSTANCES.active(), bInst: B.w.INSTANCES.active(), aMon: A.g('monsters').length, bMon: B.g('monsters').length, nightA, nightB });
  // the dice and the clock, read through each copy's OWN code: the game's rint() (00-core), the game's nowMs()
  // (13-ux: performance.now), the Royal Mine's vein clock (91: Date.now), and the build's probe (Date.now, new Date,
  // performance.now, Math.random written as the game writes them). Reading the harness's window would prove nothing:
  // if the build stopped giving a copy its own Date or Math, the window's would still look right.
  for (let i = 0; i < 1000; i++) A.g('rint')(0, 9);
  const C = plainCopy(strip.makeGame, 1), D = plainCopy(strip.makeGame, 2);
  const roll = X => [X.g('rint')(0, 1e9), X.g('__simProbe')().dice];
  const rB = roll(B), rC = roll(C), rD = roll(D);
  const diceOwn = rB[0] === rC[0] && rB[1] === rC[1] && rD[0] !== rB[0] && rD[1] !== rB[1];
  A.w.__now += 3600e3;
  const clockOf = X => { const p = X.g('__simProbe')(); return { now: p.now, date: p.date, perf: p.perf, ux: X.g('nowMs')(), vein: X.w.ROYALMINE.clock() }; };
  const cA = clockOf(A), cB = clockOf(B);
  const clockOwn = cA.now === NOW + 3600e3 && cA.date === NOW + 3600e3 && cA.vein === NOW + 3600e3 && cA.perf === 3600e3 && cA.ux === 3600e3
    && cB.now === NOW && cB.date === NOW && cB.vein === NOW && cB.perf === 0 && cB.ux === 0;
  check('2a. each copy has its own dice and clock, read through the game\'s own code: 1,000 rolls of rint() in one copy leave another copy with the same seed rolling what a fresh one rolls, another seed rolls differently; one copy an hour on reads that hour in Date.now, new Date, performance.now, nowMs() and the vein clock, the other does not',
    diceOwn && clockOwn, { dice: { B: rB, C: rC, D: rD }, A: cA, B: cB });
  // and statically: the module never reaches the real clock, dice or timers. Every name it does not declare must be a
  // plain ECMAScript built-in from this list (not the build's own list, so a change there cannot pass itself).
  const PURE = new Set(['Array', 'Boolean', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'Float32Array', 'Float64Array', 'Int32Array', 'Int16Array', 'Int8Array', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Uint8ClampedArray', 'Infinity', 'NaN', 'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Number', 'Object', 'Proxy', 'Reflect', 'RegExp', 'String', 'Symbol', 'Promise', 'undefined', 'parseFloat', 'parseInt', 'isFinite', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'BigInt', 'ArrayBuffer', 'DataView']);
  for (const [label, file] of [['stripped', strip.file], ['full', full.file]]) {
    const free = freeNames(fs.readFileSync(file, 'utf8'));
    const host = Object.keys(free).filter(n => !PURE.has(n));
    check(`2b. the ${label} module reads no clock, dice, timer or global of the machine it runs on: every free name is a plain built-in`,
      !host.length, { notPlain: Object.fromEntries(host.map(n => [n, free[n]])), free: Object.keys(free).length });
  }
}

// ---------------------------------------------------------------------------
// 3. stripped equals full
// ---------------------------------------------------------------------------
function plainRun(makeGame) {
  const C = plainCopy(makeGame, 7);
  const before = mapHash(C.api);
  const update = () => C.g('update');
  let thrown = 0, first = null;
  for (let i = 0; i < 600; i++) { C.w.__now += 100; C.w.__runTimers(); for (let s = 0; s < 3; s++) { try { update()(1 / 30); } catch (e) { thrown++; first = first || String(e.stack).split('\n').slice(0, 2).join(' | '); } } }
  return { map: before, monsters: C.g('monsters').length, state: stateHash(C.api), alive: C.g('monsters').filter(m => !m.dead).length, thrown, first, errors: C.w.__errors.length };
}
// the maps Stage 2 lets the world run (online/src/sim/worlds.js WORLD_READY), read from the server's own list
const { WORLD_READY: STAGE2_MAPS } = await import('../online/src/sim/worlds.js');
// drawn: after every tick the full build's whole frame is drawn (render(): the world, every HOOKS.draw, each monster's
// drawMonster, the night's lights and every HOOKS.hud), once centred on each knight so the monsters near him are on screen,
// with dice of its own (the drawing's sparkle must not move the game's dice). The stand-in is put back where it was parked.
function hostRun(makeGame, map = 'over', knights = 5, ticks = 600, { drawn = false } = {}) {
  const sent = { hurt: 0, kill: 0, mon: 0, other: 0 };
  const host = new SimHost({ makeGame, now: () => NOW, clock: () => performance.now(), timer: noTimer, seed: 9, onSend: (m, list) => { for (const x of list) sent[x.t in sent ? x.t : 'other']++; } });
  const c = host.boot(map);
  if (!c) return { error: JSON.stringify(host.fallbacks) };
  const bots = new Bots(host, map, { seed: 4 }).postOnHomes(knights);
  const g = c.api.peek, w = c.w, T = g('TILE');
  let at = NOW, standIn = { dead: true, parked: true, inst: true }, frames = 0, drawThrew = null, drawCalls = 0, monsterDraws = 0;
  const drawDice = mulberry32(0xd4a3);
  // each drawing registration counts its calls, so the check can say the drawing really ran
  if (drawn) {
    const H = g('HOOKS'), counted = f => { const w2 = function () { drawCalls++; return f.apply(this, arguments); }; w2.__file = f.__file; return w2; };
    for (const k of ['draw', 'hud', 'nightLights']) if (Array.isArray(H[k])) H[k] = H[k].map(counted);
    for (const k of Object.keys(H.drawMonster || {})) if (typeof H.drawMonster[k] === 'function') H.drawMonster[k] = counted(H.drawMonster[k]);
    // and every monster the frame draws (drawCharacter, which 78-monsterlook's look and drawMonster both go through)
    const dc = g('drawCharacter');
    c.api.poke('drawCharacter', function (gg, m, kind) { if (kind !== 'player' && kind !== 'playermech') monsterDraws++; return dc.apply(this, arguments); });
  }
  for (let i = 0; i < ticks; i++) {
    bots.step(0.1); at += 100; host.tick(at);
    if (drawn) {
      const p = g('player'), px = p.x, py = p.y, rnd = w.Math.random, render = g('render');
      w.Math.random = drawDice;
      try { for (const k of bots.list) { p.x = k.x; p.y = k.y; render(); frames++; } } catch (e) { drawThrew = drawThrew || String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
      finally { p.x = px; p.y = py; w.Math.random = rnd; }
    }
    const p = g('player');
    if (!p.dead) standIn.dead = false;
    if (p.x !== T / 2 || p.y !== T / 2) standIn.parked = false;
    if (map !== 'over' && w.INSTANCES.active() !== map) standIn.inst = false;
  }
  const mons = g('monsters');
  return { frames, drawThrew, drawCalls, monsterDraws, map: mapHash(c.api), state: stateHash(c.api, [sent.hurt, sent.kill, bots.hits]), sent, hits: bots.hits, monsters: mons.length, dead: mons.filter(m => m.dead).length, chasing: mons.filter(m => !m.dead && m.state === 'chase').length,
    keeper: w.COOP.isKeeper(), me: w.NET.me, standIn, solid: g('SOLID').has(g('tileAt')(0, 0)), errors: w.__errors.slice(0, 3), fallbacks: host.fallbacks.map(f => f.reason), host };
}
if (want('parity')) {
  const a = plainRun(full.makeGame), b = plainRun(strip.makeGame);
  check('3a. stripped equals full, alone: the same map, and after 600 ticks of the game\'s own update the same monster and knight state, no throws',
    a.map === b.map && a.state === b.state && a.monsters === b.monsters && !a.thrown && !b.thrown, { full: a, strip: b });
  const fa = hostRun(full.makeGame), fb = hostRun(strip.makeGame);
  const brief = r => ({ state: r.state, sent: r.sent, hits: r.hits, dead: r.dead, chasing: r.chasing, errors: r.errors, fallbacks: r.fallbacks });
  check('3b. stripped equals full through SimHost: 5 scripted knights fighting on the overworld for 600 ticks give the same monsters, the same hurts and kills',
    fa.state === fb.state && fa.map === fb.map && fa.sent.hurt > 0 && fa.sent.kill > 0 && !fa.fallbacks.length && !fb.fallbacks.length, { full: brief(fa), strip: brief(fb) });
  check('4a. the stand-in on the overworld: keeper \'@world:over\', parked dead on a solid tile for all 600 ticks, never respawned',
    fb.keeper && fb.me === '@world:over' && fb.standIn.dead && fb.standIn.parked && fb.solid, { keeper: fb.keeper, me: fb.me, standIn: fb.standIn, solid: fb.solid });
  const st = fb.host.stats();
  console.log(`  (node, stripped: boot ${st.boot.over} ms, tick p50 ${st.tick.p50} ms, p99 ${st.tick.p99} ms with 5 knights)`);
  // 3c (Stage 2): the maps the world runs in this stage, the same way. These are the copies players will meet first, so the
  // stripped build that ships must run each exactly as the full build does: the same monsters, the same blows and kills.
  for (const map of STAGE2_MAPS) {
    const ra = hostRun(full.makeGame, map, 2, 600), rb = hostRun(strip.makeGame, map, 2, 600);
    if (ra.error || rb.error) { check(`3c. stripped equals full through SimHost in ${map}`, false, { full: ra.error, strip: rb.error }); continue; }
    const fights = ra.monsters > 0;
    check(`3c. stripped equals full through SimHost in ${map} (a Stage 2 map): 2 scripted knights for 600 ticks give the same monsters, the same hurts and kills${fights ? '' : ' (it has no monsters: the same empty map)'}`,
      ra.state === rb.state && ra.map === rb.map && ra.sent.hurt === rb.sent.hurt && ra.sent.kill === rb.sent.kill && ra.hits === rb.hits && (!fights || (ra.hits > 0 && ra.sent.hurt + ra.sent.kill > 0)) && !ra.fallbacks.length && !rb.fallbacks.length && ra.standIn.inst && rb.standIn.inst,
      { full: brief(ra), strip: brief(rb), monsters: ra.monsters });
  }
  // 3d (Stage 2, the review of 3 Oct): the shipped copy strips every drawing registration (HOOKS.draw, hud, nightLights,
  // drawMonster, panel, keyHelp, pauseMenu), so a game rule hidden in one would be lost on the server without any check
  // failing. Here the FULL build draws its whole frame after every tick, on the overworld and on each Stage 2 map, and must
  // still end exactly where the stripped copy (which draws nothing) ends: the drawing changes no monster and no knight.
  for (const [map, n, ticks] of [['over', 5, 300], ...STAGE2_MAPS.map(m => [m, 2, 300])]) {
    const ra = hostRun(full.makeGame, map, n, ticks, { drawn: true }), rb = hostRun(strip.makeGame, map, n, ticks);
    if (ra.error || rb.error) { check(`3d. drawing changes nothing in ${map}`, false, { full: ra.error, strip: rb.error }); continue; }
    check(`3d. the full build drawing its whole frame after every tick (${ra.frames} frames: ${ra.drawCalls} calls of its drawing registrations, ${ra.monsterDraws} monsters drawn) in ${map} ends exactly where the stripped copy ends: the same monsters, hurts and kills`,
      ra.state === rb.state && ra.sent.hurt === rb.sent.hurt && ra.sent.kill === rb.sent.kill && !ra.drawThrew && ra.frames === n * ticks && ra.drawCalls > 0 && (ra.monsters === 0 || ra.monsterDraws > 0),
      { drawn: brief(ra), strip: brief(rb), frames: ra.frames, drawCalls: ra.drawCalls, monsterDraws: ra.monsterDraws, threw: ra.drawThrew });
  }
}

// ---------------------------------------------------------------------------
// 4b / 5. every instance: the stand-in stays inside; worldGen:false against the full build
// ---------------------------------------------------------------------------
if (want('instances')) {
  const list = plainCopy(strip.makeGame, 1).w.INSTANCES.list().filter(id => id !== 'house');
  const free = [], kept = [], broken = [], boots = {};
  for (const id of list) {
    const run = worldGen => {
      const sent = { hurt: 0, kill: 0 };
      const host = new SimHost({ makeGame: strip.makeGame, now: () => NOW, clock: () => performance.now(), timer: noTimer, seed: 21, worldGenFree: worldGen ? [] : [id], onSend: (m, l) => { for (const x of l) if (x.t in sent) sent[x.t]++; } });
      const c = host.boot(id);
      if (!c) return { error: (host.fallbacks[0] || {}).info };
      const g = c.api.peek, inst = c.w.INSTANCES.get(id), T = g('TILE');
      const tiles = []; for (let y = 0; y < inst.h; y++) for (let x = 0; x < inst.w; x++) tiles.push(g('tileAt')(x, y));
      const spawn = g('monsters').map(m => m.type + '@' + Math.round(m.x) + ',' + Math.round(m.y)).join(';');
      const bots = new Bots(host, id, { seed: 5, leash: 40 });
      const e = inst.entry; bots.add('Ann', (e[0] + 0.5) * T, (e[1] + 0.5) * T); bots.add('Ben', (e[0] + 0.5) * T + 20, (e[1] + 0.5) * T);
      // a boss that waits for a call (the Barrelbeast's shed, the Gnasher's lab, the storm) is called by Ann at tick 10
      const calls = Object.keys(g('HOOKS').bossCall || {}).filter(k => g('HOOKS').bossCall[k].map === id);
      let at = NOW, inside = true, dead = true, most = 0;
      for (let i = 0; i < 300; i++) {
        if (i === 10) for (const k of calls) host.deliver(id, { t: 'boss_call', n: 'Ann', id: k, first: true });
        bots.step(0.1); at += 100; host.tick(at);
        if (c.w.INSTANCES.active() !== id) inside = false; if (!g('player').dead) dead = false;
        most = Math.max(most, g('monsters').filter(m => !m.dead).length);
      }
      return { tiles: tiles.join(','), spawn, state: stateHash(c.api, [sent.hurt, sent.kill]), sent, inside, dead, solid: g('SOLID').has(g('tileAt')(0, 0)), fell: host.fallbacks.map(f => f.reason), errors: c.w.__errors.slice(0, 2), monsters: g('monsters').length, most, calls, bootMs: Math.round(c.bootMs) };
    };
    const a = run(true), b = run(false);
    if (a.error) { broken.push({ id, error: a.error }); continue; }
    // free only on real evidence: the same tiles, spawns and 300 ticks, AND monsters that fought the two knights
    const same = !b.error && a.tiles === b.tiles && a.spawn === b.spawn && a.state === b.state;
    const fought = a.most > 0 && a.sent.hurt > 0;
    (same && fought ? free : kept).push(id);
    boots[id] = { full: a.bootMs, worldGenFalse: b.bootMs };
    check(`4b. ${id}: the stand-in keeps the copy inside for 300 ticks with two knights, dead on a solid tile, no fallback`, a.inside && a.dead && a.solid && !a.fell.length, { inside: a.inside, dead: a.dead, solid: a.solid, fell: a.fell, monsters: a.monsters, sent: a.sent, errors: a.errors });
    if (!same) console.log(`  ${id}: worldGen:false differs from the full build (it keeps the full build)`, JSON.stringify({ tiles: a.tiles === b.tiles, spawn: a.spawn === b.spawn, state: [a.state, b.state], error: b.error }));
    else if (!fought) console.log(`  ${id}: worldGen:false matched, but no monster fought in 300 ticks (calls ${JSON.stringify(a.calls)}): not enough to trust it, it keeps the full build`);
  }
  check(`5. every instance boots as a copy; worldGen:false matches the full build for: ${free.join(', ') || 'none'}` + (kept.length ? `; full build kept for: ${kept.join(', ')}` : ''), !broken.length, { broken });
  console.log('  WORLDGEN_FREE = ' + JSON.stringify(free));
  console.log('  boot ms in node (full / worldGen:false): ' + JSON.stringify(boots));
}

// ---------------------------------------------------------------------------
// 6. the monsters' look fields (docs/ONLINE.md, Stage 2; the monster-look addendum): every field 78-monsterlook's LOOK_FIELDS
// names is carried by the copy's rows, read from the look file when the copy is built (window.__LOOK_FIELDS), and each one,
// set on a monster in a real copy, reaches a puppet in a real game with that field
// ---------------------------------------------------------------------------
if (want('looks')) {
  const host = new SimHost({ makeGame: strip.makeGame, now: () => NOW, clock: () => performance.now(), timer: noTimer, seed: 3 });
  const c = host.boot('coalmine');
  const g = c.api.peek, w = c.w, T = g('TILE');
  const fullLook = plainCopy(full.makeGame, 1).w.MONSTER_LOOK.LOOK_FIELDS;
  const want6 = Object.fromEntries(Object.entries(fullLook).map(([t, v]) => [t, v.field]));
  const built = w.__LOOK_FIELDS, carried = w.WORLDKEEPER.carries();
  const missing = Object.keys(built).filter(t => built[t] !== 'state' && !(carried[t] === built[t] || (built[t] === 'element' && carried[t] === 'phase')));
  check(`6a. the copy reads 78-monsterlook's LOOK_FIELDS when it is built (${Object.keys(built).length} types) and its rows carry every field that is not a row column already`, JSON.stringify(built) === JSON.stringify(want6) && !missing.length, { built: Object.keys(built).length, full: Object.keys(want6).length, missing });
  // one monster of each type beside a knight, in the state its field shows
  const e0 = c.w.INSTANCES.get('coalmine').entry, kx = (e0[0] + 0.5) * T, ky = (e0[1] + 0.5) * T;
  host.setKnights('coalmine', [{ n: 'Ann', x: kx, y: ky, dead: false, def: 576, lv: 99, hp: 99, mhp: 99, spd: 175 }]);
  host.tick(NOW + 100);
  const SET = {
    thunderbird: [m => { m.phase = 'perch'; }, 'phase', 'perch'], the_fang: [m => { m.element = 'ice'; }, 'phase', 'ice'],
    zombie_brute: [m => { m.windT = 0.5; }, 'phase', 'wind'], cinderwight: [m => { m.coldT = 1; }, 'phase', 'cold'],
    barrelbeast: [m => { m.rodGlow = 0.5; }, 'phase', 'volley'], gnasher: [m => { m.armT = 0.2; }, 'phase', 'arm'],
    bulldozer: [m => { m.chargeT = 1; }, 'phase', 'charge'], yard_dozer: [m => { m.chargeT = 1; }, 'phase', 'charge'],
    ally_knight: [m => { m.ally = 'garrick'; }, 'ally', 'garrick'], cinder_heart: [m => { m.emberT = 3.5; }, 'emberT', 3.5],
    ginormous_golem: [() => { w.ROYALMINE.run.mendFlash = g('time'); }, 'phase', 'mend'],
    giant_mithril: [m => { m.state = 'stir'; }, 'state', 'stir'], giant_stormstone: [m => { m.state = 'waking'; }, 'state', 'waking'], golemling: [m => { m.state = 'emerge'; }, 'state', 'emerge'],
    zombie_calm: [m => { m.state = 'chase'; }, 'state', 'chase'], grave_zombie_calm: [m => { m.state = 'chase'; }, 'state', 'chase'],
  };
  const D = g('MONSTER_DEFS'), mons = g('monsters');
  const types = Object.keys(built), notSet = types.filter(t => !SET[t]);
  types.forEach((type, i) => {
    const d = D[type]; if (!d || !SET[type]) return;
    const x = kx + 20 + (i % 6) * 30, y = ky + 20 + Math.floor(i / 6) * 30;
    const m = { type, nid: 'look' + i, x, y, home: { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: false, state: 'idle', wanderT: 99, wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0 };
    SET[type][0](m); mons.push(m);
  });
  const rows = c.wk.rows();
  // a real game (the full build) that is not the keeper: the rows land on its puppets
  const G = plainCopy(full.makeGame, 2);
  let sock = null;
  G.w.NET.enabled = true; G.w.NET.token = 'look';
  G.w.NET.useFake({ call: async () => ({}), open: () => (sock = { readyState: 1, send(str) { const m = JSON.parse(str); if (m.t === 'hello') sock.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cy', at: NOW, keeper: '@world:coalmine' }) }); }, close() { } }) });
  G.w.NET.connect();
  G.w.COOP.apply({ t: 'mon', n: '@world:coalmine', list: rows, k: 1, at: NOW });
  const got = {}, bad = [];
  types.forEach((type, i) => {
    if (!SET[type]) return;
    const p = G.w.COOP.find('look' + i), [, field, value] = SET[type];
    got[type] = p ? p[field] : '(no puppet)';
    if (!p || p[field] !== value) bad.push(type);
    else { try { G.w.MONSTER_LOOK.viewOf(p, type); } catch (e) { bad.push(type + ' (the look threw: ' + e.message + ')'); } }
  });
  check(`6b. each of the ${types.length} look fields, set on a monster in a real copy, reaches a puppet in a real game with that field (the golem's mend as phase 'mend'), and the look reads it`, !bad.length && !notSet.length && G.w.COOP.puppets() && rows.length >= types.length, { bad, notSet, rows: rows.length, got });
}

console.log(fails ? `sim-suite: ${fails} FAIL, ${passes} PASS (${Math.round((Date.now() - t0) / 1000)} s)` : `sim-suite: ALL ${passes} PASS (${Math.round((Date.now() - t0) / 1000)} s)`);
process.exit(fails ? 1 : 0);
