#!/usr/bin/env node
// ============================================================================
// SIM-SUITE — the deploy gate for the server's game copy (docs/ONLINE.md, "The shared world", Stage 0)
//   node tools/sim-suite.mjs [index.html]
// 1. The whole HOOKS.selfTest suite through makeGame (the full build), with the same pass count as tools/headless.js
//    (which this runs too, in the same way headless.js does, for the count). A run with a failure is run once more:
//    the suite has a few known random flakes.
// 2. Two copies share nothing: INSTANCES, COOP, NIGHT, monsters, dice, clocks.
// 3. Stripped equals full: the same seed gives the same map and, after 600 ticks, the same monster and knight state;
//    alone, and through SimHost with 5 scripted knights fighting on the overworld.
// 4. The stand-in: parked dead on a solid tile, never respawns, never leaves its instance, keeper of its map.
// 5. Each instance's worldGen:false copy matches its full build (tiles, monsters, 300 ticks with two knights); the
//    ones that match are printed as the list SimHost may build without the overworld.
// Exit 1 on any FAIL. Takes one of the machine's test slots, like tools/headless.js.
// ============================================================================
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { loadGame, takeSlot, plainCopy, mapHash, stateHash, Bots, ROOT, makeWindow, mulberry32 } from './sim-lib.mjs';
import { SimHost } from '../online/src/sim/host.js';

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
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    performance: { now: () => Date.now() }, console: quiet, navigator: { maxTouchPoints: 0 },
    document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null },
  };
  g.window = g; g.__fullPlaythrough = false;
  return g;
}
function runSuite(how) {
  const g = headlessWindow();
  if (how === 'vm') { vm.createContext(g); const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>')); vm.runInContext(script, g, { filename: 'index.html' }); }
  else { g.Math = Math; g.Date = Date; full.makeGame(g); }
  const r = g.FANGLANDS.selfTest();
  const names = Object.keys(r).filter(k => k !== 'summary');
  return { summary: r.summary, total: names.length, pass: names.filter(k => !String(r[k]).startsWith('FAIL')).length, fails: names.filter(k => String(r[k]).startsWith('FAIL')).map(k => k + ': ' + String(r[k]).slice(0, 200)), names };
}
if (want('selftest')) {
  const timed = how => { const a = Date.now(); let r = runSuite(how); if (r.fails.length) { console.log(`  (${how}: ${r.fails.length} failed, running once more: ${r.fails.slice(0, 3).join(' / ')})`); r = runSuite(how); } r.ms = Date.now() - a; return r; };
  const v = timed('vm'), f = timed('factory');
  for (const x of f.fails) console.log('  factory: ' + x);
  for (const x of v.fails) console.log('  headless: ' + x);
  const onlyF = f.names.filter(n => !v.names.includes(n)), onlyV = v.names.filter(n => !f.names.includes(n));
  check(`1. the whole self-test suite through makeGame (full build) passes with the same count as tools/headless.js: ${f.summary} vs ${v.summary}`,
    !f.fails.length && !v.fails.length && f.pass === v.pass && f.total === v.total, { factory: { pass: f.pass, total: f.total, ms: f.ms }, headless: { pass: v.pass, total: v.total, ms: v.ms }, namesOnlyInOne: onlyF.length + onlyV.length });
  if (onlyF.length) console.log(`  (${onlyF.length} check names differ between the two runs: they carry random numbers, e.g. "${onlyF[0].slice(0, 90)}")`);
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
  for (let i = 0; i < 1000; i++) A.w.Math.random();
  const C = plainCopy(strip.makeGame, 1);
  const diceOwn = B.w.Math.random() === C.w.Math.random();
  A.w.__now += 3600e3;
  const clockOwn = B.w.Date.now() === NOW && A.w.Date.now() === NOW + 3600e3 && new B.w.Date().getTime() === NOW;
  check('2. two copies share nothing: their own INSTANCES, COOP, NIGHT, monsters, map, HOOKS and knight; one entering the Spider Den, changing its keeper and rolling 1,000 dice leaves the other as it was; each has its own dice and clock',
    differ && entered && A.w.INSTANCES.active() === 'spider_den' && B.w.INSTANCES.active() === null && A.g('monsters').length === 13 && B.g('monsters').length === nB && mapHash(B.api) === mapB && B.w.COOP.state.keeper === null && !B.w.COOP.state.restAt.x && diceOwn && clockOwn,
    { differ, entered, aInst: A.w.INSTANCES.active(), bInst: B.w.INSTANCES.active(), aMon: A.g('monsters').length, bMon: B.g('monsters').length, diceOwn, clockOwn, nightA, nightB });
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
function hostRun(makeGame, map = 'over', knights = 5, ticks = 600) {
  const sent = { hurt: 0, kill: 0, mon: 0, other: 0 };
  const host = new SimHost({ makeGame, now: () => NOW, clock: () => performance.now(), timer: noTimer, seed: 9, onSend: (m, list) => { for (const x of list) sent[x.t in sent ? x.t : 'other']++; } });
  const c = host.boot(map);
  if (!c) return { error: JSON.stringify(host.fallbacks) };
  const bots = new Bots(host, map, { seed: 4 }).postOnHomes(knights);
  const g = c.api.peek, w = c.w, T = g('TILE');
  let at = NOW, standIn = { dead: true, parked: true, inst: true };
  for (let i = 0; i < ticks; i++) {
    bots.step(0.1); at += 100; host.tick(at);
    const p = g('player');
    if (!p.dead) standIn.dead = false;
    if (p.x !== T / 2 || p.y !== T / 2) standIn.parked = false;
    if (map !== 'over' && w.INSTANCES.active() !== map) standIn.inst = false;
  }
  const mons = g('monsters');
  return { map: mapHash(c.api), state: stateHash(c.api, [sent.hurt, sent.kill, bots.hits]), sent, hits: bots.hits, monsters: mons.length, dead: mons.filter(m => m.dead).length, chasing: mons.filter(m => !m.dead && m.state === 'chase').length,
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

console.log(fails ? `sim-suite: ${fails} FAIL, ${passes} PASS (${Math.round((Date.now() - t0) / 1000)} s)` : `sim-suite: ALL ${passes} PASS (${Math.round((Date.now() - t0) / 1000)} s)`);
process.exit(fails ? 1 : 0);
