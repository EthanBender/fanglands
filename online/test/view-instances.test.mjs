// The teacher view's Watch draws a kid's instance on the teacher's own page (src/79-view.js): the page builds it with the
// same INSTANCES.define as the kid's game. That is only the kid's screen if every instance is the same in every engine: two
// independent loads of the built game (two V8 contexts, two Math.random) give identical tiles, variants and spawn lists
// (so identical nids, i<k>) for every INSTANCES id. docs/ONLINE.md, "The teacher view", Watch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
function engine(seed) {
  const noop = () => { };
  const ctx2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined, set: () => true });
  const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
  const store = {};
  // each engine its own dice: Math.random differs between the two loads
  let s = seed >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const M = Object.create(Math); M.random = rnd;
  const g = {
    innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, setTimeout, clearTimeout, Math: M,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i] ?? null, get length() { return Object.keys(store).length; } },
    performance: { now: () => Date.now() }, console: Object.assign(Object.create(console), { table: noop, log: noop }), navigator: { maxTouchPoints: 0 },
    document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null },
  };
  g.window = g;
  vm.createContext(g);
  vm.runInContext(script, g, { filename: 'index.html' });
  return g;
}
const digest = a => createHash('sha256').update(Buffer.from(Uint8Array.from(a))).digest('hex').slice(0, 16);

test('every instance is built the same in two engines with different dice: tiles, variants, spawns (nids)', () => {
  const A = engine(1), B = engine(987654321);
  const ids = JSON.parse(vm.runInContext('JSON.stringify(INSTANCES.list())', A));
  assert.ok(ids.length >= 8, JSON.stringify(ids));
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(INSTANCES.list())', B)), ids);
  const of = (g, id) => JSON.parse(vm.runInContext(`(() => { const i = INSTANCES.get(${JSON.stringify(id)}); return JSON.stringify({ w: i.w, h: i.h, tiles: Array.from(i.tiles), vars: Array.from(i.vars), spawns: JSON.stringify(i.spawns), entry: JSON.stringify(i.entry) }); })()`, g));
  const diff = [];
  for (const id of ids) {
    const a = of(A, id), b = of(B, id);
    if (a.w !== b.w || a.h !== b.h || digest(a.tiles) !== digest(b.tiles) || digest(a.vars) !== digest(b.vars) || a.spawns !== b.spawns || a.entry !== b.entry) diff.push(id);
  }
  assert.deepEqual(diff, [], 'instances that differ between two engines: ' + diff.join(', '));
  // entering builds the same monsters, in the same order, so the stream's i<k> names the same monster on both pages
  const enter = (g, id) => vm.runInContext(`(() => { title.startSlot(1); const ok = INSTANCES.enter(${JSON.stringify(id)}); const out = ok ? monsters.map((m, k) => m.type + '@' + Math.round(m.x) + ',' + Math.round(m.y)).join(';') : 'refused'; if (ok) INSTANCES.leave(); return out; })()`, g);
  for (const id of ids.filter(i => i !== 'house')) assert.equal(enter(A, id), enter(B, id), id);
});
