#!/usr/bin/env node
// ============================================================================
// tools/move-audit.mjs — the movement check against the game's own play (docs/ONLINE.md, "The shared world", Stage 1)
// Runs the whole headless self-test suite (and with --play the bot's playthrough of the main quest) with the knight's
// presence sampled exactly as src/73-players.js sends it (at most one every 1/8 s of game time: x, y, j, spd, dead, map)
// and fed to the world's own movement check (online/src/move.js) with the world's own Atlas (online/src/atlas.json).
// Every violation is printed with the self-test check that ran just before it, so each one can be explained: a test
// moving the knight by hand faster than he can walk, or a real FIXED_SOLID or speed problem to fix before Stage 9.
//
//   node tools/move-audit.mjs [index.html] [--play] [--json out.json]
// Uses tools/headless.js's slot lock (the suite is heavy); takes about as long as one headless run.
// ============================================================================
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { readAtlas } from '../online/src/atlas.js';
import { MoveCheck, MoveBook } from '../online/src/move.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const play = args.includes('--play');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const file = args.find(a => a.endsWith('.html')) || path.join(ROOT, 'index.html');

// the same slot lock as tools/headless.js, so a dozen runs at once never starve the machine
const SLOTS = process.env.FANGLANDS_TEST_SLOTS !== undefined ? +process.env.FANGLANDS_TEST_SLOTS : Math.max(2, Math.floor((os.cpus().length || 4) / 3));
const LOCKDIR = path.join(os.tmpdir(), 'fanglands-test-slots');
let myLock = null;
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
if (SLOTS) {
  fs.mkdirSync(LOCKDIR, { recursive: true });
  const started = Date.now();
  outer: for (;;) {
    for (let i = 0; i < SLOTS; i++) {
      const f = path.join(LOCKDIR, 'slot-' + i);
      try { fs.writeFileSync(f, String(process.pid), { flag: 'wx' }); myLock = f; break outer; } catch (e) { }
      try { const owner = +fs.readFileSync(f, 'utf8'); if (!owner || !alive(owner)) { fs.unlinkSync(f); i--; } } catch (e) { }
    }
    if (Date.now() - started > 15 * 60 * 1000) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
}
process.on('exit', () => { if (myLock) try { fs.unlinkSync(myLock); } catch (e) { } });

const html = fs.readFileSync(file, 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const noop = () => { };
const ctx2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined, set: () => true });
const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
const store = {};
const g = {
  innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, setTimeout, clearTimeout,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  performance: { now: () => Date.now() }, console: Object.assign(Object.create(console), { table: noop }), navigator: { maxTouchPoints: 0 },
  document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null },
};
g.window = g; g.__fullPlaythrough = play; g.__gameSource = script;
vm.createContext(g);
vm.runInContext(script, g, { filename: 'index.html' });

// the world's Atlas, read the way the Room reads it, from the game's own export (the same as atlas.json for this build)
const atlas = readAtlas(JSON.parse(JSON.stringify(g.ATLAS.export())));
const T0 = Date.parse('2026-10-03T12:00:00Z');
let clock = 0;   // ms of game time, summed from every update's dt (the suite moves `time` around; this only goes forward)
const book = new MoveBook(null, () => T0 + clock);
const check = new MoveCheck({ atlas, book });
const knight = { name: 'Audit', lc: 'audit', map: 'over', atlas: atlas.hash };
let label = '(core checks)', sinceLabel = 0, samples = 0, lastAt = -1e9;
const found = [];
// presence, as 73-players makes it, at most every 1/8 s of game time
const HOOKS = vm.runInContext('HOOKS', g), mechOf = () => vm.runInContext('player.mech ? (player.mech.kind || "walker") : null', g);
HOOKS.update.push(dt => {
  clock += Math.max(0, dt) * 1000;
  if (clock - lastAt < 125) return;
  lastAt = clock;
  const p = g.PLAYERS.presence();
  knight.map = (g.INSTANCES.active && g.INSTANCES.active()) || 'over';
  samples++;
  const r = check.judge(knight, { x: p.x, y: p.y, j: p.j, spd: p.spd, dead: p.dead }, T0 + clock);
  if (r && r.kind) found.push({ kind: r.kind, detail: r.detail, label, map: knight.map, from: prev && [prev.x, prev.y], to: [p.x, p.y], j: [prev && prev.j, p.j], spd: p.spd, mech: mechOf(), at: Math.round(clock) });
  prev = { x: p.x, y: p.y, j: p.j };
});
let prev = null;
// the label: the last self-test check reported before a sample (wrapping every hook's check)
const hooks = HOOKS.selfTest.slice();
HOOKS.selfTest.length = 0;
for (const h of hooks) HOOKS.selfTest.push((c, F, x) => h((name, ok, info) => { label = name; return c(name, ok, info); }, F, x));
const t0 = Date.now();
const report = g.FANGLANDS.selfTest();
book.flush();
const today = book.view().today;
const byLabel = {};
for (const f of found) { const k = f.kind + (f.kind === 'wall' ? ' ' + f.detail : '') + ' | ' + f.label; byLabel[k] = (byLabel[k] || 0) + 1; }
console.log(`move-audit: ${report.summary} (${Math.round((Date.now() - t0) / 1000)} s)${play ? ' with the playthrough' : ''}; ${samples} presences sampled over ${(clock / 1000).toFixed(0)} s of game time`);
console.log(`  checked ${today.checked}, too fast ${today.speed}, wall ${today.wall}, jump bursts ${today.jumps}, jumps waived ${today.waived}, not judged ${today.skipped}`);
for (const [k, n] of Object.entries(byLabel).sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + k.slice(0, 260));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ summary: report.summary, play, samples, gameSeconds: clock / 1000, today, found }, null, 1));
