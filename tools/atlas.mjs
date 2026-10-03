#!/usr/bin/env node
// ============================================================================
// tools/atlas.mjs — writes online/src/atlas.json from the built game (docs/ONLINE.md, "The shared world", Stage 1)
// The Room has no game of its own, so it reads the Atlas from this file. It is made by booting the built index.html headless
// (the same stubbed browser tools/headless.js uses) and asking the game: ATLAS.export() is the table src/01-atlas.js and
// src/96-atlas.js build from the generated world, with the very hash the game itself sends in hello. This tool only adds
// which src/ file holds each boss call (the realm files whose rests Stage 2 keeps).
//
//   node tools/atlas.mjs                 write online/src/atlas.json from index.html (build.sh runs this)
//   node tools/atlas.mjs --print         print it instead
//   import { makeAtlas } from './atlas.mjs'; makeAtlas('index.html', { touch, w, h }) -> the file's text
// online/test/atlas-drift.mjs makes it again (on a computer and on an iPad-sized touch screen) and fails a deploy unless both
// match the committed file byte for byte.
// ============================================================================
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ATLAS_FILE = path.join(ROOT, 'online', 'src', 'atlas.json');

// the built game in a screen-less sandbox (as tools/headless.js and ~/.fanglands/tools/load.js make it)
function boot(html, opts = {}) {
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const noop = () => { };
  const ctx2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined, set: () => true });
  const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
  const store = {};
  const g = {
    innerWidth: opts.w || 1000, innerHeight: opts.h || 700, devicePixelRatio: opts.touch ? 2 : 1, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, setTimeout: noop, clearTimeout: noop,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    performance: { now: () => Date.now() }, console: Object.assign(Object.create(console), { table: noop, log: noop, info: noop, warn: noop }), navigator: { maxTouchPoints: opts.touch ? 5 : 0 },
    document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null },
  };
  g.window = g;
  vm.createContext(g);
  vm.runInContext(script, g, { filename: 'index.html' });
  return { g, script };
}

// which src/ file each boss call is registered in, read from the build's own file markers ("// ---- src/NN-name.js ----")
function callFiles(script) {
  const out = {}; let file = null;
  for (const line of script.split('\n')) {
    const m = /^\/\/ ---- src\/([0-9A-Za-z_.-]+)\.js ----$/.exec(line); if (m) { file = m[1]; continue; }
    const re = /HOOKS\.bossCall\.([a-z_]{1,24})\s*=/g; let c;
    while ((c = re.exec(line))) if (file && !out[c[1]]) out[c[1]] = file;
  }
  return out;
}

// the file's text: one line per top-level key, one per place and per instance mask, so a change reads in a diff
export function format(a) {
  const lines = [];
  for (const k of Object.keys(a)) {
    const v = a[k];
    if (k === 'places') lines.push(JSON.stringify(k) + ': [\n' + v.map(p => '  ' + JSON.stringify(p)).join(',\n') + '\n]');
    else if (k === 'fixed' || k === 'doors' || k === 'calls') lines.push(JSON.stringify(k) + ': {\n' + Object.keys(v).map(id => '  ' + JSON.stringify(id) + ': ' + JSON.stringify(v[id])).join(',\n') + '\n}');
    else lines.push(JSON.stringify(k) + ': ' + JSON.stringify(v));
  }
  return '{\n' + lines.join(',\n') + '\n}\n';
}

export function makeAtlas(htmlFile = path.join(ROOT, 'index.html'), opts = {}) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const { g, script } = boot(html, opts);
  const A = g.ATLAS;
  if (!A || !A.built()) throw new Error('atlas: the game built no Atlas (is src/96-atlas.js in the build?)');
  if (A.problems().length) throw new Error('atlas: ' + A.problems().join('; '));
  const a = A.export();
  const files = callFiles(script);
  for (const id of Object.keys(a.calls)) a.calls[id].file = files[id] || null;
  a.realm = [...new Set(Object.values(a.calls).map(c => c.file).filter(Boolean))].sort();
  return format(a);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = makeAtlas();
  if (process.argv.includes('--print')) process.stdout.write(text);
  else {
    const old = fs.existsSync(ATLAS_FILE) ? fs.readFileSync(ATLAS_FILE, 'utf8') : null;
    if (old !== text) fs.writeFileSync(ATLAS_FILE, text);
    const a = JSON.parse(text);
    if (!process.argv.includes('--quiet') || old !== text) console.log(`atlas: ${old === text ? 'unchanged' : 'wrote'} online/src/atlas.json (${(text.length / 1024).toFixed(1)} KB, ${a.places.length} places, hash ${a.hash})`);
  }
}
