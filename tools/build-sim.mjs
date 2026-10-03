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
// Usage: node tools/build-sim.mjs [--strip] [--keep-tests] [--reads] [--html index.html] [--out online/src/sim/game.mjs]
// (--reads, with --strip: list every read of a stripped name from a kept file against STRIP_READS; exit 1 on one not listed)
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
  // the monsters' look (the approved art and the file that draws every monster with it): pictures only, no rules
  '78-monsterart', '78-monsterlook',
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

const PROBE_SRC = `function __simProbe() { return { now: Date.now(), date: new Date().getTime(), perf: performance.now(), dice: Math.random() }; }`;

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
  // the clock-and-dice probe goes through the same rewrite as the game (step 4), so it reads exactly what the game's
  // own Date.now(), new Date(), performance.now() and Math.random() read in this copy (tools/sim-suite.mjs check 2)
  script = PROBE_SRC + '\n' + script;
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

// ============================================================================
// WHAT THE KEPT FILES READ FROM THE STRIPPED ONES (the stripped-reads gate, tools/sim-suite.mjs check 0)
// A stripped name is a stand-in that reads as itself (a truthy proxy), 0 as a number and nothing when iterated. A game
// rule that reads one gets that on the server and the real value in a browser, so the copies would quietly disagree.
// The gate: in the stripped module, every place a kept src/ file READS the value of a stripped name (or of one of the
// window.NAME stand-ins) must be on this list, by name and by file, with the reason it is safe. These never count:
//   - typeof NAME;
//   - a call whose result is thrown away (`sfx('hit');`, `HK.button(...);`): the stand-in does nothing, which is what a
//     server wants of a sound or a drawing;
//   - a write (`title.active = false`, `render = function () {...}`): the stand-in keeps what is written to it;
//   - code nobody can reach once the drawing registrations are gone: a named function whose only callers were removed
//     HOOKS.draw/hud/... entries (or other such functions), found by scope analysis, never by name.
// A new read in a listed file is not caught by name alone, so each reason names what that file's reads are for; a
// read from a file not listed for that name, or of a name not listed, fails the gate. Run
//   node tools/build-sim.mjs --strip --reads
// to see every read with its line.
// ============================================================================
export const STRIP_READS = {
  drawCharacter: {
    files: ['79-deaths', '82-knightgear'],
    why: '79-deaths wraps it at load to draw a falling body, 82-knightgear to draw the player as the new knight; the wrappers only run when something draws, which a copy never does',
  },
  drawMech: {
    files: ['82-knightgear'],
    why: '82-knightgear wraps it at load so a pilot is drawn seated (no legs); the wrapper only runs when something draws, which a copy never does',
  },
  drawDrop: {
    files: ['79-deaths'],
    why: '79-deaths wraps it at load to draw loot popping out of a body; the wrapper only runs when something draws, which a copy never does',
  },
  HK: {
    files: ['05-input', '17-tap', '21-companion', '23-law', '24-dwarves', '29-quests', '43-settings', '47-outliers', '53-coalmine', '54-graves', '55-riding', '61-markers', '66-storm', '71-login', '73-players', '74-chat', '78-trade', '79-boygirl', '79-deaths'],
    why: 'the HUD kit (59-hudkit): fonts, colours, text widths, panel rows, plaques, seats and safe insets, read by panel, plaque, chat-wrap and tap code (79-boygirl: its "Boy or girl?" card on the title, drawn only while the title is up); the two update-time reads are a held BLOCK seat, used only for the copy\'s own knight on a machine (55-riding returns first: the parked stand-in has no machine) and a pointer release (05-input, a copy has no pointer)',
  },
  title: {
    files: ['17-tap', '54-graves', '71-login', '72-cloudsave', '72-deviceknights', '75-coop', '76-admin', '77-dropparty', '78-trade', '79-boygirl', '82-knightgear', '91-royalmine', '99-boot'],
    why: 'title.active reads false in a copy (STUB_SEED and the stand-in\'s start(), as for a knight past the title); 79-boygirl wraps the title\'s door, slot start, open and knight sprite at load and reads a slot\'s save before it is loaded, none of which a copy ever calls (it starts with newGame(), never from the title); 82-knightgear gives the title\'s knight figure (title.KNIGHT) its gear at load, which only the title\'s drawing reads; the rest are the title\'s save slots (slotKey, slot) for login, cloud saves, device knights (72-deviceknights names and offers them on the login card) and admin, which a copy never uses (save() does nothing, NET.call throws), the title frame for drawing, and 99-boot\'s frame(), which a copy never runs',
  },
  cam: {
    files: ['17-tap', '24-dwarves', '78-trade', '88-aerie', '91-cloudkingdom', '91-royalmine', '95-thistledown', '79-deaths'],
    why: 'the camera: screen-to-world for a tap, where a name tag, a sky or a bark is drawn, and the drawing passes\' default view',
  },
  playerLook: {
    files: ['22-bulldozer', '32-beast', '73-players', '77-dropparty', '79-boygirl', '82-knightgear', '95-thistledown'],
    why: 'the copy\'s own knight\'s look: drawn in a machine or a beast (22, 32), the party hat wrapper (77), the girl knight wrapper (79-boygirl, which only adds `girl` from player.gender), the knight gear wrapper (82-knightgear, which only adds the six worn item ids, the tool held at work and the raised shield, and reads it for the player on foot inside its drawCharacter wrapper), the stone statue (95), and 73-players\' lookOf() for its own presence, which is the parked stand-in\'s and drawn by nobody',
  },
  render: {
    files: ['43-settings', '61-markers', '88-aerie', '91-cloudkingdom'],
    why: 'wrappers that keep the original to call it. What they add runs only when render() runs, which a copy never does: 43 syncs the sound flags into settings (save() does nothing), 61 records the dialog box for taps, 88 its sky, 91-cloudkingdom re-mounts its buildings, which INSTANCES.enter/leave, load() and respawnPoint() already do',
  },
  drawPanels: { files: ['61-markers', '73-players', '76-admin', '78-accounts'], why: 'wrappers that keep the panel drawing to call it, then draw their own panel' },
  drawMinimap: { files: ['43-settings', '61-markers'], why: 'wrappers that keep the minimap drawing to call it' },
  drawCompass: { files: ['43-settings'], why: 'a wrapper that keeps the compass drawing to call it' },
  drawHud: { files: ['71-login', '79-boygirl'], why: 'wrappers that keep the HUD drawing to call it: the login card\'s title (71) and the "Boy or girl?" card on the title (79); a copy never draws' },
  drawBossBars: { files: ['91-royalmine'], why: 'a wrapper that keeps the boss bars\' drawing to call it' },
  drawHuman: { files: ['77-dropparty', '79-boygirl', '79-deaths', '82-knightgear'], why: 'wrappers that keep the drawing to call it: the party hat (77), a girl knight\'s braid and ribbon (79-boygirl), a falling person (79-deaths) and the new knight for a look with gear (82-knightgear); they only run when something draws, which a copy never does' },
  drawItemIcon: { files: ['38-agility'], why: 'a wrapper that keeps the item icon drawing to call it' },
  drawFenceProp: { files: ['95-thistledown'], why: 'a wrapper that keeps the fence drawing to call it' },
  drawFireProp: { files: ['95-thistledown'], why: 'a wrapper that keeps the fire drawing to call it' },
  drawTower: { files: ['95-thistledown'], why: 'a wrapper that keeps the tower drawing to call it' },
  drawBuilding: { files: ['91-cloudkingdom', '95-thistledown'], why: 'wrappers that keep the building drawing to call it, and 91-cloudkingdom\'s own drawing pass' },
  panelBox: { files: ['24-dwarves', '38-agility'], why: 'the panel frame: where a panel\'s text goes (24) and a wrapper that keeps it (38)' },
  PANEL_KIT: { files: ['60-bank', '69-retaliate'], why: 'panel sizes and button widths' },
  itemBlurb: { files: ['26-boats', '90-canyon'], why: 'wrappers that keep the pack\'s item sentence to call it, for their own items\' sentences' },
  darkLayer: { files: ['88-aerie'], why: 'the night canvas, cleared and borrowed by the Aerie\'s lighting' },
  miniWindow: { files: ['61-markers'], why: 'where the minimap shows the markers' },
  audioMuted: { files: ['43-settings'], why: 'the sound flag, read back into settings inside the render wrapper (see render)' },
  MUSIC: { files: ['43-settings'], why: 'the music flag, read back into settings inside the render wrapper (see render)' },
  SFX: { files: ['95-thistledown'], why: 'the sound bank: two sounds added if missing' },
  noise: { files: ['95-thistledown'], why: 'a sound, inside the splash sound 95 adds' },
  'window.WIKI': {
    files: ['17-tap', '46-cinderwight', '46-scales', '47-outliers', '54-graves', '58-underground', '62-ores', '77-dropparty', '88-aerie', '90-canyon', '91-cloudkingdom', '91-royalmine', '95-thistledown'],
    why: 'the book: pages added at load, and a tap that opens a monster\'s page',
  },
  'window.ICONS': { files: ['54-graves', '81-partyhats', '88-aerie', '90-canyon', '91-cloudkingdom', '91-royalmine'], why: 'item icons registered at load' },
  'window.LIGHTS': { files: ['88-aerie', '91-royalmine'], why: 'the lighting: lights registered at load, and whether a lit scene owns the night canvas' },
  MONSTER_LOOK: { files: ['79-deaths'], why: '79-deaths asks the monsters\' new looks (78-monsterlook, stripped) how far a falling body reaches and how tall it stands, for the clips that split or crumble it, and for a person\'s own weapon to throw clear; all of it drawing, which a copy never does' },
  'window.MONSTER_LOOK': { files: ['79-deaths'], why: 'the same reads as MONSTER_LOOK, guarded by whether the look is loaded' },
  'window.PLAYTHROUGH': { files: ['91-royalmine'], why: 'the playthrough audit\'s gather times, in an HOOKS.xpSource row only that audit reads' },
};

// Every read of a stripped name's value from a kept file: [{name, file, line, text}] (see STRIP_READS).
export function strippedReads(code) {
  const FILES = JSON.parse(code.slice(code.lastIndexOf('export const FILES = ') + 21).trim().replace(/;$/, ''));
  const lines = code.split('\n');
  const first = FILES.length ? FILES[0][0] : 0, end = lines.findIndex(l => l.startsWith(';__simTag(null);')) + 1;
  const inScript = n => n.loc.start.line > first && n.loc.start.line < end;
  const ast = acorn.parse(code, { ecmaVersion: 2023, sourceType: 'module', ranges: true, locations: true });
  const parents = new Map();
  (function link(n, p) { if (!n || typeof n.type !== 'string') return; parents.set(n, p); for (const k in n) { if (k === 'range' || k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(c => link(c, n)); else if (v && typeof v.type === 'string') link(v, n); } })(ast, null);
  const sm = es.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
  const factory = sm.scopes.find(s => s.type === 'function' && s.block.id && s.block.id.name === 'makeGame');
  const isStub = d => d.node && d.node.init && d.node.init.type === 'CallExpression' && d.node.init.callee.type === 'Identifier' && d.node.init.callee.name === '__stubOf';
  const stubVars = factory.variables.filter(v => v.defs.some(isStub));
  const winStubs = new Set(lines.filter(l => /^window\.[A-Za-z_$][\w$]* = window\.[\w$]+ \|\| __stubOf\(null\);$/.test(l)).map(l => l.split(' ')[0].slice(7)));
  // unreachable code: a named function (a declaration, or a const bound to a function) with no caller left in the
  // script, other than itself or another unreachable function. A top-level one also counts the peek() switch, which a
  // host may call it through.
  const within = (n, o) => n.range[0] >= o.range[0] && n.range[1] <= o.range[1];
  const fnOf = v => { for (const d of v.defs) { if (d.type === 'FunctionName') return d.node; if (d.type === 'Variable' && d.parent.kind === 'const' && d.node.init && /Function/.test(d.node.init.type)) return d.node.init; } return null; };
  const cands = [];
  for (const s of sm.scopes) { if (!within(s.block, factory.block)) continue; for (const v of s.variables) { const f = fnOf(v); if (f && inScript(f)) cands.push({ v, f, top: s === factory }); } }
  const dead = [];
  const insideDead = n => dead.some(f => within(n, f));
  for (let changed = true; changed;) {
    changed = false;
    for (const c of cands) {
      if (c.dead) continue;
      const live = c.v.references.some(r => !r.init && !within(r.identifier, c.f) && !insideDead(r.identifier) && (inScript(r.identifier) || c.top));
      if (!live) { c.dead = true; dead.push(c.f); changed = true; }
    }
  }
  const isRead = node0 => {
    let node = node0, p = parents.get(node);
    if (p.type === 'UnaryExpression' && p.operator === 'typeof') return false;
    while (p.type === 'MemberExpression' && p.object === node) { node = p; p = parents.get(p); }
    if (p.type === 'CallExpression' && p.callee === node && parents.get(p).type === 'ExpressionStatement') return false;
    if (p.type === 'AssignmentExpression' && p.operator === '=' && p.left === node) return false;
    return true;
  };
  const reads = [];
  const note = (name, n) => { if (inScript(n) && !insideDead(n) && isRead(n)) reads.push({ name, file: fileOfLine(FILES, n.loc.start.line), line: n.loc.start.line, text: lines[n.loc.start.line - 1].trim().slice(0, 160) }); };
  for (const v of stubVars) for (const r of v.references) if (!r.init && r.isRead()) note(v.name, r.identifier);
  (function scan(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'MemberExpression' && !n.computed && n.object.type === 'Identifier' && n.object.name === 'window' && winStubs.has(n.property.name)) note('window.' + n.property.name, n);
    for (const k in n) { if (k === 'range' || k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v.type === 'string') scan(v); }
  })(ast);
  return { reads, unreachable: dead.length, functions: cands.length };
}
// The gate: the reads that are not on STRIP_READS, and the listed name/file pairs that no longer read anything
export function checkStrippedReads(code) {
  const { reads, unreachable, functions } = strippedReads(code);
  const unlisted = reads.filter(r => !(STRIP_READS[r.name] && STRIP_READS[r.name].files.includes(r.file)));
  const seen = new Set(reads.map(r => r.name + ' ' + r.file));
  const stale = Object.entries(STRIP_READS).flatMap(([n, e]) => e.files.filter(f => !seen.has(n + ' ' + f)).map(f => n + ' ' + f));
  return { reads: reads.length, names: new Set(reads.map(r => r.name)).size, unlisted, stale, unreachable, functions, all: reads };
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
  if (strip && args.includes('--reads')) {
    const r = checkStrippedReads(code);
    for (const x of r.all) console.log(`${STRIP_READS[x.name] && STRIP_READS[x.name].files.includes(x.file) ? 'listed  ' : 'UNLISTED'} ${x.name.padEnd(18)} ${x.file.padEnd(16)} line ${x.line}: ${x.text}`);
    for (const s of r.stale) console.log(`stale    ${s} (on the list, no read left)`);
    console.log(`${r.reads} reads of ${r.names} stripped names from kept files, ${r.unlisted.length} not on the list; ${r.unreachable} of ${r.functions} named functions unreachable without the drawing`);
    if (r.unlisted.length) process.exitCode = 1;
  }
}
