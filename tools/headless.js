#!/usr/bin/env node
// Headless self-test: node tools/headless.js [index.html] [runs]
// Loads the built game with a stubbed DOM/canvas and runs FANGLANDS.selfTest(). Drawing is a no-op.
const fs = require('fs'), vm = require('vm'), path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
const runs = +(process.argv[3] || 1);
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
g.window = g;
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
  if (fails.length) bad++;
}
process.exit(bad ? 1 : 0);
