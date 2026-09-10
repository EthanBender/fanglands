#!/usr/bin/env node
// Headless self-test: node tools/headless.js [index.html] [runs] [--play]
// Loads the built game with a stubbed DOM/canvas and runs FANGLANDS.selfTest(). Drawing is a no-op.
// --play sets window.__fullPlaythrough so src/42-playthrough.js also runs the bot through the main quest 0→16 (minutes, not seconds).
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const args = process.argv.slice(2).filter(a => a !== '--play'), play = process.argv.includes('--play');

// ---------------------------------------------------------------------------
// A SLOT LOCK, so a dozen agents testing at once do not destroy each other's runs.
// One run is single-threaded but loads the whole built game into a fresh V8 heap. A wave of agents each
// running the suite three times put this machine at load average 73 and killed runs outright — one to a JS
// heap OOM, one to a signal. Queueing is strictly better than losing the work, so a run waits for a slot
// rather than piling on. Slots default to a third of the cores; FANGLANDS_TEST_SLOTS overrides, and 0 disables.
// A slot whose owner died is reclaimed, so a killed run never wedges the queue.
// ---------------------------------------------------------------------------
const SLOTS = process.env.FANGLANDS_TEST_SLOTS !== undefined ? +process.env.FANGLANDS_TEST_SLOTS : Math.max(2, Math.floor((os.cpus().length || 4) / 3));
const LOCKDIR = path.join(os.tmpdir(), 'fanglands-test-slots');
let myLock = null;
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
function takeSlot() {
  if (!SLOTS) return;
  try { fs.mkdirSync(LOCKDIR, { recursive: true }); } catch (e) { return; }
  const started = Date.now();
  for (;;) {
    for (let i = 0; i < SLOTS; i++) {
      const f = path.join(LOCKDIR, 'slot-' + i);
      try { fs.writeFileSync(f, String(process.pid), { flag: 'wx' }); myLock = f; return; } catch (e) { }
      try { const owner = +fs.readFileSync(f, 'utf8'); if (!owner || !alive(owner)) { fs.unlinkSync(f); i--; } } catch (e) { }
    }
    if (Date.now() - started > 15 * 60 * 1000) return;   // never block forever: after 15 minutes, just run
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);   // a real sleep with no child process: spawning `sleep` is blocked in some sandboxes
  }
}
function freeSlot() { if (myLock) { try { fs.unlinkSync(myLock); } catch (e) { } myLock = null; } }
process.on('exit', freeSlot);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { freeSlot(); process.exit(1); });
takeSlot();
const file = args[0] || path.join(__dirname, '..', 'index.html');
const runs = +(args[1] || 1);
const html = fs.readFileSync(file, 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const noop = () => { };
const ctx2d = new Proxy({}, {
  get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined,
  set: () => true,
});
const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
const store = {};
const g = {
  innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, setTimeout,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  performance: { now: () => Date.now() }, console: Object.assign(Object.create(console), { table: () => { } }), navigator: { maxTouchPoints: 0 },
  document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null },
};
g.window = g; g.__fullPlaythrough = play;
vm.createContext(g);
vm.runInContext(script, g, { filename: 'index.html' });
let bad = 0;
for (let n = 0; n < runs; n++) {
  const t0 = Date.now();
  const r = g.FANGLANDS.selfTest();
  const fails = Object.entries(r).filter(([k, v]) => String(v).startsWith('FAIL'));
  if (process.env.DUMP_NAMES) require('fs').writeFileSync(process.env.DUMP_NAMES + '.' + (n + 1), Object.keys(r).join('\n')); // DUMP_NAMES=path → one file per run listing every check name (spot conditional or duplicate names)
  console.log(`run ${n + 1}: ${r.summary} (${Date.now() - t0} ms)`);
  for (const [k, v] of fails) console.log('  ' + k + ': ' + v);
  if (play) { const k = Object.keys(r).find(k => /full bot playthrough/.test(k)); if (k) console.log('  playthrough: ' + r[k]); const log = g.PLAYTHROUGH && g.PLAYTHROUGH.PLAY.log; if (log) console.log('  ' + log.join('\n  ')); }
  if (fails.length) bad++;
}
process.exit(bad ? 1 : 0);
