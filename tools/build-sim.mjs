#!/usr/bin/env node
// ============================================================================
// BUILD-SIM — the game as a module the world server can run (docs/ONLINE.md, "The shared world")
// Ported from the spike (branch spike/server-sim, spike/build-server.mjs). Turns the one big browser script in
// index.html into an ES module:
//
//   export function makeGame(window) { ...the whole game...; return { peek, poke, window } }
//   export const FILES = [[firstLine, 'NN-name'], ...]   // where each src/ file starts in this module (stack traces)
//
// Every call makes an independent world with its own globals: the game's top-level let/const/function become
// locals of the factory, so one Durable Object can hold the overworld and each instance side by side and no two
// copies ever share a monster. No eval and no new Function anywhere: the game is plain code.
//
// How the browser globals are handled (an AST pass, acorn + eslint-scope, never a regex):
//   - every name the script reads or writes without declaring it (document, localStorage, performance, the feature
//     registers like INSTANCES / COOP / NIGHT, levelBanner's accessor ...) becomes window.NAME; `{ NAME }` shorthand
//     becomes `{ NAME: window.NAME }`; typeof stays safe;
//   - Math and Date are rewritten too, so each copy has its own seeded dice and its own clock (online/src/sim/window.js);
//   - the other ECMAScript built-ins (Object, JSON, Set ...) stay as they are.
// The module is strict (ES modules always are); the script already runs strict.
//
// --strip removes what a server never needs:
//   - the 12 presentation files become stand-ins: each top-level name they declare is bound to its own no-op proxy
//     that can be called, read, written and iterated, and that remembers what is written to it (so the stand-in's
//     `title.active = false` reads back false, as the real title's does);
//   - inside every other file, the statements that only register drawing, HUD, panels, key help or self-tests
//     (HOOKS.draw/hud/selfTest/keyHelp/pauseMenu/nightLights.push(...), HOOKS.drawMonster.X = ..., HOOKS.panel.X = ...)
//     are removed (--keep-tests keeps the self-tests).
// Every copy tags each function in HOOKS with the file that registered it (fn.__file = '35-night'), so the stand-in
// (src/79-worldkeeper.js) can switch off a file's hooks and the audit can say whose code did what.
//
// Usage: node tools/build-sim.mjs [--strip] [--keep-tests] [--html index.html] [--out online/src/sim/game.mjs]
// build.sh runs `node tools/build-sim.mjs --strip` after it builds index.html. acorn and eslint-scope are online/'s
// devDependencies (build.sh installs them with npm ci when they are missing).
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(path.join(ROOT, 'online', 'package.json'));
const acorn = req('acorn');
const es = req('eslint-scope');

// Presentation-only files: never needed by a server simulation.
export const STRIP_FILES = [
  '08-draw', '09-render', '10-hud', '12-audio', '14-title', '15-music', '44-wiki', '59-hudkit',
  '80-icons', '81-icons-art', '42-playthrough', '89-lighting',
];
// What a stripped name reads before anything is written to it (the rest reads as the no-op stand-in).
const STUB_SEED = { title: { active: false, bootActive: false } };
const DRAWY_HOOKS = new Set(['draw', 'hud', 'selfTest', 'keyHelp', 'pauseMenu', 'nightLights']);
const DRAWY_MAPS = new Set(['drawMonster', 'panel']);
const ECMA = new Set(['Array', 'Boolean', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'Float32Array', 'Float64Array', 'Int32Array', 'Int16Array', 'Int8Array', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Uint8ClampedArray', 'Infinity', 'NaN', 'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Number', 'Object', 'Proxy', 'Reflect', 'RegExp', 'String', 'Symbol', 'Promise', 'undefined', 'parseFloat', 'parseInt', 'isFinite', 'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'globalThis', 'BigInt', 'ArrayBuffer', 'DataView', 'structuredClone', 'window', '__STUB', '__stubOf', '__simTag']);
const MARK = /^\/\/ ---- src\/([0-9]+-[a-z0-9-]+)\.js ----/;

function parse(src) { return acorn.parse(src, { ecmaVersion: 2023, sourceType: 'script', ranges: true }); }
function walk(n, f, parent) {
  if (!n || typeof n.type !== 'string') return;
  if (f(n, parent) === false) return;
  for (const k in n) { const v = n[k]; if (k === 'range') continue; if (Array.isArray(v)) v.forEach(c => walk(c, f, n)); else if (v && typeof v.type === 'string') walk(v, f, n); }
}
function splice(src, edits) { // edits: [{s, e, text}], non-overlapping
  edits.sort((a, b) => b.s - a.s);
  for (const { s, e, text } of edits) src = src.slice(0, s) + text + src.slice(e);
  return src;
}
function declaredNames(stmt) {
  const out = [];
  const pat = p => { if (!p) return; if (p.type === 'Identifier') out.push(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(q => pat(q.type === 'RestElement' ? q.argument : q.value)); else if (p.type === 'ArrayPattern') p.elements.forEach(pat); else if (p.type === 'AssignmentPattern') pat(p.left); else if (p.type === 'RestElement') pat(p.argument); };
  if (stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') out.push(stmt.id.name);
  if (stmt.type === 'VariableDeclaration') stmt.declarations.forEach(d => pat(d.id));
  return out;
}

// The stand-in a stripped name is bound to: callable, readable, writable and iterable, never a thenable, and it
// remembers what is written to it (a read of something never written is the stand-in itself).
const STUB_SRC = `
const __STUB = __stubOf(null);
function __stubOf(seed) {
  const own = Object.assign(Object.create(null), seed || {});
  const f = function () { return p; };
  const p = new Proxy(f, {
    get: (t, k) => k in own ? own[k] : k === Symbol.toPrimitive ? (() => 0) : k === Symbol.iterator ? function* () { } : k === 'length' ? 0 : k === 'then' ? undefined : p,
    set: (t, k, v) => { own[k] = v; return true; }, apply: () => p, construct: () => p, has: (t, k) => k in own, deleteProperty: (t, k) => { delete own[k]; return true; },
  });
  return p;
}`;
// Tags every untagged function in HOOKS with the file whose code just ran (called at each file's first line).
const TAG_SRC = `
let __simCur = null;
function __simTag(next) {
  let H = null; try { H = HOOKS; } catch (e) { }
  if (H && __simCur) for (const k of Object.keys(H)) {
    const v = H[k];
    if (Array.isArray(v)) { for (const f of v) if (typeof f === 'function' && !Object.prototype.hasOwnProperty.call(f, '__file')) f.__file = __simCur; }
    else if (v && typeof v === 'object') { for (const n of Object.keys(v)) { const f = v[n]; if (typeof f === 'function' && !Object.prototype.hasOwnProperty.call(f, '__file')) f.__file = __simCur; } }
  }
  __simCur = next;
}`;

export function buildSim({ html, strip = false, keepTests = false } = {}) {
  let script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const report = { strippedFiles: [], removedHookStatements: 0 };
  const stubLines = []; // bound at the very top of the factory, so hoisting never sees an unset stand-in
  if (strip) {
    // 1. whole files -> stand-ins
    const parts = script.split(/(?=^\/\/ ---- src\/[^\n]+ ----$)/m);
    script = parts.map(part => {
      const m = MARK.exec(part);
      if (!m || !STRIP_FILES.includes(m[1])) return part;
      const ast = parse(part);
      const names = ast.body.flatMap(declaredNames);
      // window.FOO = ... anywhere in the stripped file -> window.FOO = a stand-in (unless something else set it first)
      const winSets = new Set();
      walk(ast, n => { if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && !n.left.computed && n.left.object.name === 'window') winSets.add(n.left.property.name); });
      report.strippedFiles.push({ file: m[1], bytes: part.length, names: names.length });
      stubLines.push(...names.map(n => `var ${n} = __stubOf(${JSON.stringify(STUB_SEED[n] || null)});`), ...[...winSets].filter(n => /^[A-Z][A-Z0-9_]*$/.test(n)).map(n => `window.${n} = window.${n} || __stubOf(null);`));
      return `// ---- src/${m[1]}.js ---- STRIPPED for the server: ${names.length} names bound to stand-ins at the top\n`;
    }).join('');
    // 2. drawing / HUD / self-test registrations inside the files that stay
    const drawy = new Set(DRAWY_HOOKS); if (keepTests) drawy.delete('selfTest');
    const ast = parse(script);
    const edits = [];
    walk(ast, n => {
      if (n.type !== 'ExpressionStatement') return;
      const e = n.expression;
      const isHooks = o => o && o.type === 'MemberExpression' && o.object.type === 'Identifier' && o.object.name === 'HOOKS';
      if (e.type === 'CallExpression' && e.callee.type === 'MemberExpression' && e.callee.property.name === 'push' && isHooks(e.callee.object) && drawy.has(e.callee.object.property.name)) {
        edits.push({ s: n.range[0], e: n.range[1], text: ';' }); return false;
      }
      if (e.type === 'AssignmentExpression' && e.left.type === 'MemberExpression' && isHooks(e.left.object) && DRAWY_MAPS.has(e.left.object.property.name)) {
        edits.push({ s: n.range[0], e: n.range[1], text: ';' }); return false;
      }
    });
    report.removedHookStatements = edits.length;
    script = splice(script, edits);
  }
  // 3. a hook tag at the start of every file (and one at the end for the last file)
  script = script.replace(/^(\/\/ ---- src\/([0-9]+-[a-z0-9-]+)\.js ----[^\n]*)$/gm, (all, line, id) => `${line}\n;__simTag(${JSON.stringify(id)});`) + '\n;__simTag(null);\n';
  if (strip) script = stubLines.join('\n') + '\n' + script;

  // 4. free names -> window.NAME
  const ast = parse(script);
  const sm = es.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
  const top = new Set(sm.globalScope.variables.map(v => v.name));
  const shorthand = new Set();
  walk(ast, n => { if (n.type === 'Property' && n.shorthand && n.value.type === 'Identifier') shorthand.add(n.value); });
  const free = new Map(), edits = [];
  for (const r of sm.globalScope.through) {
    const id = r.identifier, name = id.name;
    if (top.has(name) || ECMA.has(name)) continue;
    free.set(name, (free.get(name) || 0) + 1);
    edits.push({ s: id.range[0], e: id.range[1], text: shorthand.has(id) ? `${name}: window.${name}` : `window.${name}` });
  }
  script = splice(script, edits);

  // 5. the factory. peek/poke reach any top-level binding by name (player, monsters, update ...) at call time, so a
  // feature file that re-assigns update() to wrap it is seen wrapped.
  const topNames = [...top].filter(n => /^[A-Za-z_$][\w$]*$/.test(n));
  // only let / var / function bindings can be re-assigned (a bundler refuses `CONST = v`)
  const pokeable = new Set(sm.globalScope.variables.filter(v => v.defs.every(d => d.type === 'FunctionName' || (d.type === 'Variable' && d.parent.kind !== 'const'))).map(v => v.name));
  const head = `// GENERATED by tools/build-sim.mjs from index.html${strip ? ' (--strip' + (keepTests ? ' --keep-tests' : '') + ')' : ''}. Do not edit: run ./build.sh.
export function makeGame(window) {
${STUB_SRC}
${TAG_SRC}
`;
  const body = `${head}${script}
function __peek(n) { switch (n) { ${topNames.map(n => `case ${JSON.stringify(n)}: return ${n};`).join(' ')} default: throw new Error('no top-level ' + n); } }
function __poke(n, v) { switch (n) { ${topNames.filter(n => pokeable.has(n)).map(n => `case ${JSON.stringify(n)}: ${n} = v; return;`).join(' ')} default: throw new Error('no top-level ' + n); } }
return { peek: __peek, poke: (n, v) => { try { __poke(n, v); } catch (e) { throw new Error('cannot set ' + n + ': ' + e.message); } }, window };
}
`;
  // where each file starts in the module (1-based lines), for reading stack traces
  const files = [];
  body.split('\n').forEach((l, i) => { const m = MARK.exec(l); if (m) files.push([i + 1, m[1]]); });
  const code = body + `export const FILES = ${JSON.stringify(files)};\n`;
  return { code, report: { strip, keepTests, rawBytes: Buffer.byteLength(code), freeNames: free.size, freeRefs: edits.length, topLevel: topNames.length, files: files.length, ...report } };
}

// which src/ file a line of the generated module belongs to
export function fileOfLine(files, line) {
  let lo = 0, hi = files.length - 1, at = null;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (files[mid][0] <= line) { at = files[mid][1]; lo = mid + 1; } else hi = mid - 1; }
  return at;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const strip = args.includes('--strip'), keepTests = args.includes('--keep-tests');
  const htmlFile = opt('--html', path.join(ROOT, 'index.html'));
  const outFile = opt('--out', path.join(ROOT, 'online', 'src', 'sim', strip && !keepTests ? 'game.mjs' : strip ? 'game.tests.mjs' : 'game.full.mjs'));
  const { code, report } = buildSim({ html: fs.readFileSync(htmlFile, 'utf8'), strip, keepTests });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, code);
  const gz = zlib.gzipSync(code, { level: 9 }).length;
  const quiet = args.includes('--quiet');
  if (quiet) console.log(`built ${path.relative(process.cwd(), outFile)} (${(report.rawBytes / 1048576).toFixed(2)} MB, ${(gz / 1024).toFixed(0)} KB gzip, ${report.freeNames} free names${strip ? ', ' + report.strippedFiles.length + ' files stripped, ' + report.removedHookStatements + ' hook registrations removed' : ''})`);
  else console.log(JSON.stringify({ out: path.relative(process.cwd(), outFile), gzipBytes: gz, ...report }, null, 1));
}
