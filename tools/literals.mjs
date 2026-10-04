#!/usr/bin/env node
// ============================================================================
// LITERALS — bare map coordinates in the source (the spread spec, §9.2 and §9.3)
// Finds every coordinate-shaped literal in src/[0-9]*.js with a real parser (acorn, online/'s devDependency):
//   pair       [x, y]                         two non-negative numbers in the map (not a direction like [0, 1])
//   point      { x: N, y: N } / { tx, ty }    an object whose x and y (or tx and ty) are numbers
//   rect       { x0, y0, x1, y1 }             any of the four as a number
//   call       setTile / tileAt / changeTile / tp / openSpot / bfs / walkTo / goAdjacent / face / idx / inMap (N, N, ...)
//   gcall      any OTHER call whose first two arguments are map numbers (pen, rect, regionAt, useAt, near ...), bar canvas,
//              Math, colour, sound, timer, dice and string helpers (NOT_MAP)
//   tc         tc(N)
//   tile       N * TILE, TILE * N
//   decl       const X = 112 where X is later a tile argument (setTile(X, Y), tc(X), X * TILE, any call's first two)
//   compare    x >= 142, ty <= 40 ... a number of 10 or more in the map, against a coordinate-named side; also against a
//              pixel turned to tiles (m.x / TILE > 143, Math.floor(p.y / TILE) <= 40)
//   rel        a centre after a coordinate pair: near(x, y, 66, 57, 13, 7), dist(x, y, 140, 76), segDist(px, py, 61, 70 ...)
//              — a number of 10 or more in the 3rd or 4th argument of a call whose first two are coordinate names
//   minus      x - 140, px - 142 ... a number of 10 or more in the map taken from a coordinate name (Math.hypot's
//              arguments included: Math helpers are excepted only from gcall)
// A literal inside a frame call (F.x(112), F.p(..), ATLAS.world.tx(..), ATLAS.port(..)) is wrapped, so it is not counted.
// The tools (tools/*.js, tools/*.mjs, named 'tools/<file>'; ADDENDUM A.2) are read the same way, plus three things only
// they do: game code handed to a game as text (R(A, `FANGLANDS.tp(24, 37)`), scanned where it sits), a tile call on a
// game handle (openSpot(A, 60, 30)), and a named spot (['dock landing', 164, 14]). In src/ the last two are drop tables
// and recipe rows far more often than places, so the game's files are not read for them.
//
//   node tools/literals.mjs [files...]       counts per file (all of src/ and tools/ when no file is named)
//   node tools/literals.mjs --inventory      writes docs/spread/inventory.json: { file, line, col, literal, kind, guess }
//   node tools/literals.mjs --gate           the build's gate, REPO-WIDE: every file of src/ and tools/ must have 0
//                                            literals outside docs/spread/literals-allow.json, bar a file an open peer
//                                            branch holds (docs/spread/held.json); exit 1 otherwise
// literals-allow.json: [{ file, literal?, line?, decl?, reason }] — no literal/line/decl allows the whole file (an
// instance's own map); `decl` alone allows everything inside that named declaration (01-atlas's own ANCHORS table);
// `literal` matches the source text (spaces ignored) and MUST be pinned by `decl` (the declaration it sits in: the
// sturdy pin, it survives edits above it) or `line`, so one exemption never covers a new position written elsewhere in
// the same file. An unpinned `literal` entry matches nothing, and the gate names it.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SPREAD = path.join(ROOT, 'docs', 'spread');
const SRC = path.join(ROOT, 'src');
const TOOLS = path.join(ROOT, 'tools');   // ADDENDUM A.2: the tools stand knights and read tiles on the overworld too
const MAP_W = 260, MAP_H = 180;   // the map the literals were written for (read from 00-core below when it parses)

let acorn = null;
export function parser() {
  if (acorn) return acorn;
  try { acorn = createRequire(path.join(ROOT, 'online', 'package.json'))('acorn'); }
  catch (e) { throw new Error('literals: acorn is missing: run (cd online && npm ci)'); }
  return acorn;
}
export const parse = (src, sourceType = 'script') => parser().parse(src, { ecmaVersion: 'latest', sourceType, allowReturnOutsideFunction: true, allowHashBang: true, locations: true, ranges: true });
// a file of the repo: 'NN-name.js' is src/'s (as converted.json and the allow list name it), 'tools/name.js' a tool's
export const isTool = f => /^tools\//.test(f);
export const fileOf = f => isTool(f) ? path.join(ROOT, f) : path.join(SRC, f);
// a tool may be a module (.mjs, or a .js with import/export); the game's files are scripts
export const parseFile = (f, src) => { if (/\.mjs$/.test(f)) return parse(src, 'module'); try { return parse(src); } catch (e) { return parse(src, 'module'); } };

// ---------- the Atlas tables, read from src/01-atlas.js without running the game ----------
// ANCHORS and PORTS are plain data literals: each is evaluated alone, in an empty context.
export function atlasTables(srcFile = path.join(SRC, '01-atlas.js')) {
  const src = fs.readFileSync(srcFile, 'utf8'), ast = parse(src), found = {};
  walk(ast, n => { if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && ['ANCHORS', 'PORTS', 'NESTED', 'PORT_REL', 'OWNERS'].includes(n.id.name) && n.init && !found[n.id.name]) found[n.id.name] = src.slice(n.init.start, n.init.end); });
  const ev = t => t ? vm.runInNewContext('(' + t + ')', Object.create(null)) : null;
  const ANCHORS = ev(found.ANCHORS) || {}, PORTS = ev(found.PORTS) || {};
  for (const id in ANCHORS) { const a = ANCHORS[id]; a.kind = a.box ? 'place' : 'reserved'; if (a.box) a.at = a.at || [a.box[0], a.box[1]]; }
  return { ANCHORS, PORTS, NESTED: ev(found.NESTED) || [], PORT_REL: ev(found.PORT_REL) || {}, OWNERS: ev(found.OWNERS) || [] };
}
const area = b => (b[2] - b[0] + 1) * (b[3] - b[1] + 1);
const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
// the same rule as ATLAS.anchorOf: one place box holding the point names its place; inside more than one, an OWNERS rect
// or a port at that exact point decides (decided: 'owner' | 'port'), and otherwise it is an overlap a human decides
// (overlap: true; id is the smallest box, for display only). ties: other boxes of the same smallest area.
export function anchorOf(T, x, y) {
  let best = null, ties = [];
  const holders = [];
  for (const id in T.ANCHORS) {
    const a = T.ANCHORS[id]; if (a.kind !== 'place') continue;
    const b = a.box; if (!inB(b, x, y)) continue;
    holders.push(id);
    if (!best || area(b) < area(T.ANCHORS[best].box)) { best = id; ties = []; } else if (area(b) === area(T.ANCHORS[best].box)) ties.push(id);
  }
  if (!best) return { id: 'world', ties: [], holders, overlap: false, decided: null };
  if (holders.length < 2) return { id: best, ties, holders, overlap: false, decided: null };
  const own = (T.OWNERS || []).find(o => inB(o.box, x, y) && holders.includes(o.id));
  if (own) return { id: own.id, ties: [], holders, overlap: false, decided: 'owner', why: own.why };
  const pid = Object.keys(T.PORTS).find(k => T.PORTS[k][0] !== 'new' && T.PORTS[k][1] === x && T.PORTS[k][2] === y && holders.includes(T.PORTS[k][0]));
  if (pid) return { id: T.PORTS[pid][0], ties: [], holders, overlap: false, decided: 'port', port: pid };
  return { id: best, ties, holders, overlap: true, decided: null };
}

// ---------- the walk ----------
export function walk(n, f, parent = null, anc = []) {
  if (!n || typeof n.type !== 'string') return;
  if (f(n, parent, anc) === false) return;
  const next = anc.concat([n]);
  for (const k in n) { if (k === 'loc' || k === 'range') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(c => walk(c, f, n, next)); else if (v && typeof v.type === 'string') walk(v, f, n, next); }
}
const FRAME_METHODS = new Set(['x', 'y', 'tx', 'ty', 'p', 'pt', 'pts', 'rect', 'box', 'ix', 'iy', 'pin', 'port', 'frame', 'track', 'inOld']);
const CALLS = new Set(['setTile', 'tileAt', 'changeTile', 'tp', 'openSpot', 'bfs', 'walkTo', 'goAdjacent', 'face', 'idx', 'inMap', 'safeSpot']);
// Any OTHER call whose first two arguments are both numbers in the map is counted too (kind 'gcall': pen(72, 14, ...),
// rect(171, 12, 172, 14), regionAt(150, 160), useAt(62, 6), near(152, 30, 2) ...), except these, which never take a map
// tile: canvas drawing, Math, colours, sound, timers, dice, strings and arrays.
const NOT_MAP = new Set(['fillRect', 'strokeRect', 'clearRect', 'arc', 'arcTo', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'ellipse',
  'fillText', 'strokeText', 'drawImage', 'translate', 'scale', 'rotate', 'setTransform', 'transform', 'createLinearGradient', 'createRadialGradient',
  'createConicGradient', 'getImageData', 'putImageData', 'createImageData', 'isPointInPath', 'addColorStop', 'setLineDash',
  'rgba', 'rgb', 'hsl', 'hsla', 'shade', 'mix', 'lerp', 'clamp', 'tone', 'noise', 'sfx', 'beep', 'setTimeout', 'setInterval',
  'rnd', 'rand', 'randInt', 'rint', 'mulberry32', 'waitStage', 'fromCharCode',
  'max', 'min', 'pow', 'atan2', 'hypot', 'round', 'floor', 'ceil', 'abs', 'sqrt', 'parseInt', 'Number', 'String', 'Array']);
// array and string methods: never a tile as a method (a.fill(0, 4)), but a bare helper of the same name may be (fill(139, 66, ...))
const NOT_MAP_METHOD = new Set(['slice', 'substr', 'substring', 'splice', 'padStart', 'padEnd', 'toFixed', 'repeat', 'fill', 'includes', 'indexOf', 'at', 'set', 'get']);
const CANVAS_OBJ = /^(g|ctx|dg|sg|c|cx|gg|g2|pg|mg|tg|octx|mctx|tctx|nctx|ctx2|ctx2d)$/;
// pixels, not tiles: the knight, the camera, the pointer
const PIXEL_OBJ = /^(player|cam|camera|mouse|pointer|ptr|touch|view|screen)$/;
// a drawing call (canvas or HUD): numbers inside are pixels (Math.hypot and the other Math helpers are NOT drawing)
const DRAW_NAMES = new Set(['fillRect', 'strokeRect', 'clearRect', 'arc', 'arcTo', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'ellipse',
  'fillText', 'strokeText', 'drawImage', 'translate', 'scale', 'rotate', 'setTransform', 'transform', 'createLinearGradient', 'createRadialGradient',
  'createConicGradient', 'getImageData', 'putImageData', 'rect', 'roundRect', 'floatText', 'burst', 'particles']);
function drawCall(a) {
  if (!a || a.type !== 'CallExpression') return false;
  const c = a.callee, name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : null;
  if (c.type === 'MemberExpression' && c.object.type === 'Identifier' && (CANVAS_OBJ.test(c.object.name) || c.object.name === 'HK')) return true;
  return !!name && DRAW_NAMES.has(name) && !(c.type === 'Identifier' && name === 'rect');   // a bare rect(x0, y0 ...) helper may be a map rect
}
const num = n => n && n.type === 'Literal' && typeof n.value === 'number';
const neg = n => n && n.type === 'UnaryExpression' && n.operator === '-' && num(n.argument);
const nameOf = n => n.type === 'Identifier' ? n.name : n.type === 'MemberExpression' && !n.computed ? n.property.name : null;
const COORD_NAME = /^(t|p|c|s|n|o|a|b|g|d|m|k|q|w|h|e|f|i|j|r|z|u|v)?[xy][0-9]?$|^[xy](0|1|a|b)$|^t[xy][0-9]?$/;
const propName = p => p && (p.type === 'Property' || p.type === 'MethodDefinition') && !p.computed ? (p.key.type === 'Identifier' ? p.key.name : p.key.value) : null;

// is this node inside a frame call (F.x(...), W.tx(...), ATLAS.port(...), ATLAS.frame('a').p(...))?
function wrapped(anc) {
  for (const a of anc) {
    if (a.type !== 'CallExpression') continue;
    const c = a.callee;
    if (c.type === 'MemberExpression' && !c.computed && FRAME_METHODS.has(c.property.name) && !(c.object.type === 'Identifier' && c.object.name === 'Math')) return true;
  }
  return false;
}

// every coordinate-shaped literal of one file: [{ line, col, literal, kind, x, y, start, end, nodes }]
export function scanSource(src, opts = {}) {
  const W = opts.W || MAP_W, H = opts.H || MAP_H, out = [], seen = new Set();
  const ast = opts.ast || parse(src, opts.sourceType);
  // a tile is a whole number (a centre may be a half: the fountain's 35.5); 6.4 is a drawing's, not a map's
  const tileish = v => Number.isInteger(v * 2);
  const lineCol = off => { let line = 1, last = -1; for (let i = src.indexOf('\n'); i >= 0 && i < off; i = src.indexOf('\n', i + 1)) { line++; last = i; } return { line, col: off - last }; };
  const inMapX = v => tileish(v) && v >= 0 && v <= W - 1, inMapY = v => tileish(v) && v >= 0 && v <= H - 1;
  const add = (node, kind, x, y, nodes) => {
    const key = node.start + ':' + kind; if (seen.has(key)) return; seen.add(key);
    out.push({ line: node.loc.start.line, col: node.loc.start.column + 1, literal: src.slice(node.start, node.end).replace(/\s+/g, ' ').slice(0, 160), kind, x, y, start: node.start, end: node.end, nodes: nodes || [] });
  };
  walk(ast, (n, parent, anc) => {
    if (n.type === 'CallExpression' && wrapped([n])) return false;   // nothing under a frame call is bare
    if (n.type === 'ArrayExpression' && n.elements.length === 2 && num(n.elements[0]) && num(n.elements[1])) {
      const [a, b] = n.elements.map(e => e.value);
      // a pair in a list of pairs where another is off the map or not a tile ([[-8, -3], [4, -7], [9, 4]]) is an offset, not a place
      if (parent && parent.type === 'ArrayExpression' && parent.elements.some(e => e && e !== n && e.type === 'ArrayExpression' && e.elements.length === 2 && e.elements.every(v => num(v) || neg(v)) && e.elements.some(v => neg(v) || !Number.isInteger(v.value * 2)))) return;
      if (inMapX(a) && inMapY(b) && Math.max(a, b) >= 2) add(n, 'pair', a, b, [n.elements[0], n.elements[1]]);
    }
    // a named spot: ['Grubb', 216, 23] / ["Tinkerton's lab", 247, 42, id] (a string, then a map tile)
    if (opts.tools && n.type === 'ArrayExpression' && n.elements.length >= 3 && n.elements[0] && (n.elements[0].type === 'Literal' && typeof n.elements[0].value === 'string' || n.elements[0].type === 'TemplateLiteral') && num(n.elements[1]) && num(n.elements[2])) {
      const a = n.elements[1].value, b = n.elements[2].value;
      if (inMapX(a) && inMapY(b) && Math.max(a, b) >= 2) add(n, 'named', a, b, [n.elements[1], n.elements[2]]);
    }
    if (n.type === 'ObjectExpression') {
      const props = {}; for (const p of n.properties) { const k = propName(p); if (k) props[k] = p.value; }
      for (const [kx, ky] of [['x', 'y'], ['tx', 'ty']]) if (num(props[kx]) && num(props[ky]) && inMapX(props[kx].value) && inMapY(props[ky].value) && Math.max(props[kx].value, props[ky].value) >= 2) add(n, 'point', props[kx].value, props[ky].value, [props[kx], props[ky]]);
      const rk = ['x0', 'y0', 'x1', 'y1'].filter(k => num(props[k]));
      if (rk.length && ['x0', 'y0', 'x1', 'y1'].every(k => k in props)) add(n, 'rect', num(props.x0) ? props.x0.value : null, num(props.y0) ? props.y0.value : null, rk.map(k => props[k]));
    }
    if (n.type === 'CallExpression') {
      const c = n.callee, name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : null;
      // a tile call on a game handle: openSpot(A, 60, 30), tp(g, 140, 80) (the tools drive two games at once)
      if (opts.tools && name && CALLS.has(name) && n.arguments.length >= 3 && !num(n.arguments[0]) && !(nameOf(n.arguments[0]) && COORD_NAME.test(nameOf(n.arguments[0]))) && n.arguments[0].type !== 'SpreadElement' && num(n.arguments[1]) && num(n.arguments[2])) {
        const a = n.arguments[1], b = n.arguments[2];
        if (inMapX(a.value) && inMapY(b.value) && Math.max(a.value, b.value) >= 2) add(n, 'call', a.value, b.value, [a, b]);
      }
      if (name && CALLS.has(name) && n.arguments.length >= 2 && (num(n.arguments[0]) || num(n.arguments[1]))) {
        const a = n.arguments[0], b = n.arguments[1];
        if ((!num(a) || inMapX(a.value)) && (!num(b) || inMapY(b.value)) && (num(a) ? a.value : 0) + (num(b) ? b.value : 0) >= 2) add(n, 'call', num(a) ? a.value : null, num(b) ? b.value : null, [a, b].filter(num));
      }
      if (name === 'tc' && c.type === 'Identifier' && n.arguments.length === 1 && num(n.arguments[0]) && inMapX(n.arguments[0].value)) add(n, 'tc', null, null, [n.arguments[0]]);
      // any other call with a map tile as its first two arguments (a helper the list above does not know)
      const canvas = c.type === 'MemberExpression' && ((c.object.type === 'Identifier' && (CANVAS_OBJ.test(c.object.name) || c.object.name === 'Math' || c.object.name === 'HK')) || NOT_MAP_METHOD.has(name));
      if (name && !CALLS.has(name) && name !== 'tc' && !NOT_MAP.has(name) && !canvas && n.arguments.length >= 2 && num(n.arguments[0]) && num(n.arguments[1])) {
        const a = n.arguments[0], b = n.arguments[1];
        if (inMapX(a.value) && inMapY(b.value) && Math.max(a.value, b.value) >= 2 && a.value + b.value >= 4) add(n, 'gcall', a.value, b.value, [a, b]);
      }
    }
    if (n.type === 'BinaryExpression' && n.operator === '*') {
      const isT = e => e.type === 'Identifier' && e.name === 'TILE';
      if ((isT(n.right) && num(n.left) && inMapX(n.left.value) && n.left.value >= 2) || (isT(n.left) && num(n.right) && inMapX(n.right.value) && n.right.value >= 2)) add(n, 'tile', null, null, [num(n.left) ? n.left : n.right]);
    }
    if (n.type === 'BinaryExpression' && ['<', '<=', '>', '>=', '===', '!==', '==', '!='].includes(n.operator)) {
      for (const [lit, other] of [[n.right, n.left], [n.left, n.right]]) {
        if (!num(lit) || lit.value < 10 || lit.value > W - 1 || !Number.isInteger(lit.value)) continue;
        const nm = nameOf(other); if (!nm || !COORD_NAME.test(nm)) continue;
        add(n, 'compare', null, null, [lit]);
      }
      // a pixel turned to tiles on the other side (m.x / TILE > 143, Math.floor(p.y / TILE) <= 40)
      const perTile = e => e && ((e.type === 'BinaryExpression' && e.operator === '/' && e.right.type === 'Identifier' && e.right.name === 'TILE') ||
        (e.type === 'CallExpression' && e.callee.type === 'MemberExpression' && e.callee.object.type === 'Identifier' && e.callee.object.name === 'Math' && ['floor', 'round', 'ceil', 'trunc'].includes(nameOf(e.callee)) && perTile(e.arguments[0])));
      for (const [lit, other] of [[n.right, n.left], [n.left, n.right]]) {
        if (!num(lit) || lit.value < 10 || lit.value > W - 1 || !Number.isInteger(lit.value) || !perTile(other)) continue;
        add(n, 'compare', null, null, [lit]);
      }
    }
    // a coordinate name less a map number: x - 140 (Math.hypot(x - 140, y - 76), dx = px - 142): a distance to a place.
    // Not: an OLD coordinate (ox, oy: already read back through W.ix / F.ix, so old numbers are what it means), a box
    // edge less a size (b.x1 - 21), a pixel (player.y - 30, cam.x - 80) or anything inside a drawing call (g.moveTo(cx - 9 ..)).
    if (n.type === 'BinaryExpression' && n.operator === '-' && num(n.right) && Number.isInteger(n.right.value) && n.right.value >= 10 && n.right.value <= W - 1) {
      const nm = nameOf(n.left), obj = n.left.type === 'MemberExpression' && n.left.object.type === 'Identifier' ? n.left.object.name : null;
      if (nm && COORD_NAME.test(nm) && !/^o[xy]/.test(nm) && !/^[xy][01]$/.test(nm) && !PIXEL_OBJ.test(obj || '') && !anc.some(drawCall)) add(n, 'minus', null, null, [n.right]);
    }
    // a centre after a coordinate pair: near(x, y, 66, 57, ...), dist(x, y, 140, 76), segDist(px, py, 61, 70, ...)
    // (both the 3rd and 4th a map number, one of them 10 or more: burst(player.x, player.y, '#fff', 16) is not a centre)
    if (n.type === 'CallExpression' && n.arguments.length >= 4 && !drawCall(n)) {
      const [a0, a1, a2, a3] = n.arguments, cn = e => { const nm = e && nameOf(e); return !!nm && COORD_NAME.test(nm); };
      if (cn(a0) && cn(a1) && num(a2) && num(a3) && inMapX(a2.value) && inMapY(a3.value) && Math.max(a2.value, a3.value) >= 10)
        for (const a of [a2, a3]) if (a.value >= 10) add(a, 'rel', null, null, [a]);
    }
  });
  // Game code inside a string (tools only): a tool hands a game handle its code as text (R(A, `FANGLANDS.tp(24, 37)`),
  // ev(g, '...'), page.evaluate(`...`)). A string or template argument that parses as JavaScript is scanned like code;
  // each `${...}` stands as a name, and every hit is reported at its place in the tool's own source.
  if (opts.tools && !opts.inner) walk(ast, n => {
    if (n.type !== 'CallExpression') return;
    for (const a of n.arguments) {
      if (!a || !((a.type === 'Literal' && typeof a.value === 'string') || a.type === 'TemplateLiteral')) continue;
      const segs = [];   // [innerStart, outerStart, length]: the raw text of each piece, at its outer offset
      let code = '';
      if (a.type === 'Literal') { segs.push([0, a.start + 1, a.end - a.start - 2]); code = src.slice(a.start + 1, a.end - 1); }
      else a.quasis.forEach((q, i) => { segs.push([code.length, q.start, q.end - q.start]); code += src.slice(q.start, q.end); if (i < a.expressions.length) { segs.push([code.length, a.expressions[i].start, 0]); code += '__e' + i; } });
      if (code.length < 6 || !/\(/.test(code)) continue;
      let inner; try { inner = scanSource(code, Object.assign({}, opts, { inner: true, ast: undefined, sourceType: 'script' })); } catch (e) { continue; }
      const outer = off => { let s = segs[0]; for (const g of segs) if (g[0] <= off) s = g; return s[1] + Math.min(off - s[0], s[2]); };
      for (const h of inner) {
        const start = outer(h.start), end = Math.max(start + 1, outer(h.end)), pos = lineCol(start);
        const key = start + ':' + h.kind; if (seen.has(key)) continue; seen.add(key);
        out.push(Object.assign({}, h, { line: pos.line, col: pos.col, start, end, inString: true }));
      }
    }
  });
  // A named coordinate: `const X = 112, Y = 49; setTile(X, Y)`. A declaration of a whole map number (10 or more) whose name
  // is then a tile argument (setTile and the other CALLS, any call's first two arguments, tc(NAME), NAME * TILE) is counted
  // as kind 'decl' at the declaration, for the hand pass (names are matched without scopes: an over-count, never a miss).
  { const decls = new Map();
    walk(ast, n => { if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && num(n.init) && Number.isInteger(n.init.value * 2) && n.init.value >= 10 && n.init.value <= W - 1) { if (!decls.has(n.id.name)) decls.set(n.id.name, []); decls.get(n.id.name).push(n.init); } });
    if (decls.size) {
      const used = new Set();
      const isT = e => e && e.type === 'Identifier' && e.name === 'TILE';
      walk(ast, (n, parent, anc) => {
        if (n.type === 'CallExpression' && wrapped([n])) return false;
        if (n.type === 'CallExpression') {
          const c = n.callee, name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : null;
          const canvas = c.type === 'MemberExpression' && ((c.object.type === 'Identifier' && (CANVAS_OBJ.test(c.object.name) || c.object.name === 'Math' || c.object.name === 'HK')) || NOT_MAP_METHOD.has(name));
          if (!name || canvas || NOT_MAP.has(name)) return;
          const args = name === 'tc' ? n.arguments.slice(0, 1) : n.arguments.slice(0, 2);
          for (const a of args) if (a.type === 'Identifier' && decls.has(a.name)) used.add(a.name);
        }
        if (n.type === 'BinaryExpression' && n.operator === '*') for (const [a, b] of [[n.left, n.right], [n.right, n.left]]) if (isT(b) && a.type === 'Identifier' && decls.has(a.name)) used.add(a.name);
      });
      for (const nm of used) for (const init of decls.get(nm)) add(init, 'decl', null, null, [init]);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export const srcFiles = () => fs.readdirSync(SRC).filter(f => /^[0-9].*\.js$/.test(f)).sort();
export const toolFiles = () => fs.readdirSync(TOOLS).filter(f => /\.m?js$/.test(f) && fs.statSync(path.join(TOOLS, f)).isFile()).sort().map(f => 'tools/' + f);
// the files named on the command line (src/NN.js, NN.js or tools/x.js), or every one of src/ and tools/
export function sourceFiles(names) {
  const all = srcFiles().concat(toolFiles());
  if (!names || !names.length) return all;
  return names.map(n => n.replace(/^\.\//, '')).map(n => /^tools\//.test(n) ? n : path.basename(n)).filter(n => all.includes(n));
}

// ---------- the allow list ----------
export function allowList() {
  const f = path.join(SPREAD, 'literals-allow.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
}
const squash = s => String(s).replace(/\s+/g, '');
// an entry with a `literal` but neither `decl` nor `line` is unpinned: it matches nothing (the gate names it)
export const unpinned = a => a.literal !== undefined && a.decl === undefined && a.line === undefined;
export function allowed(file, hit, src, allow, declRanges) {
  for (const a of allow) {
    if (a.file !== file || unpinned(a)) continue;
    if (a.decl !== undefined) { const r = declRanges(a.decl); if (!r.some(([s, e]) => hit.start >= s && hit.end <= e)) continue; }
    if (a.line !== undefined && a.line !== hit.line) continue;
    if (a.literal !== undefined && squash(a.literal) !== squash(hit.literal)) continue;
    return a;
  }
  return null;
}
export function scanFile(file, allow = allowList(), T = null) {
  const src = fs.readFileSync(fileOf(file), 'utf8');
  const tool = isTool(file), ast = parseFile(file, src);
  const hits = scanSource(src, { ast, tools: tool });
  // a `decl` pin: a declaration by name (const NAME = ..., function NAME () {...}, or a property NAME: ... / NAME () {...}).
  // Every named declaration's ranges are gathered in one walk, the first time a pin asks (one walk per file, not per pin).
  let byName = null;
  const declRanges = name => {
    if (!byName) {
      byName = new Map(); const put = (k, r) => { if (!byName.has(k)) byName.set(k, []); byName.get(k).push(r); };
      walk(ast, n => {
        if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init) put(n.id.name, [n.init.start, n.init.end]);
        else if (n.type === 'FunctionDeclaration' && n.id) put(n.id.name, [n.start, n.end]);
        else if ((n.type === 'Property' || n.type === 'MethodDefinition') && n.value) { const k = propName(n); if (k !== null && k !== undefined) put(k, [n.value.start, n.value.end]); }
      });
    }
    return byName.get(name) || [];
  };
  const bare = [], ok = [];
  for (const h of hits) { const a = allowed(file, h, src, allow, declRanges); (a ? ok : bare).push(a ? Object.assign({}, h, { allowedBy: a.reason }) : h); }
  if (T) for (const h of bare) h.guess = h.x !== null && h.x !== undefined && h.y !== null && h.y !== undefined ? anchorOf(T, h.x, h.y).id : null;
  return { file, src, bare, allowed: ok };
}

// ---------- the command line ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), files = argv.filter(a => !a.startsWith('--'));
  if (argv.includes('--gate')) {
    // REPO-WIDE (Stage 3): every file of src/ and tools/ is held to 0 bare coordinates outside the allow list, whether
    // converted.json names it or not. The one way out is docs/spread/held.json: a file an open peer branch is editing
    // ([{ file, branch, reason }]), converted after that branch merges; the gate lists each one it lets wait, and names
    // a held file that has no bare literal left (it can leave the list) or that no longer exists.
    const rd = f => { const p = path.join(SPREAD, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []; };
    const norm = f => /^tools\//.test(f) ? f : path.basename(f);
    const converted = rd('converted.json'), list = (Array.isArray(converted) ? converted : converted.files || []).map(norm);
    const held = new Map(rd('held.json').map(h => [norm(h.file), h]));
    const allow = allowList(), T = atlasTables(); let bad = 0, waiting = 0;
    for (const a of allow) if (unpinned(a)) { bad++; console.error(`literals gate: docs/spread/literals-allow.json: the ${a.file} entry for ${JSON.stringify(a.literal)} has no decl or line: pin it to the declaration (or line) it allows`); }
    for (const f of list) if (!fs.existsSync(fileOf(f))) { console.error(`literals gate: docs/spread/converted.json names ${f}, which is not in ${isTool(f) ? 'tools/' : 'src/'}`); bad++; }
    for (const [f, h] of held) {
      if (!fs.existsSync(fileOf(f))) { console.error(`literals gate: docs/spread/held.json names ${f}, which does not exist`); bad++; }
      else if (list.includes(f)) { console.error(`literals gate: ${f} is both converted (converted.json) and held (held.json): take it off held.json`); bad++; }
      else if (!h.branch || !h.reason) { console.error(`literals gate: docs/spread/held.json's entry for ${f} needs its branch and a reason`); bad++; }
    }
    const all = sourceFiles();
    for (const f of all) {
      const r = scanFile(f, allow, T), name = isTool(f) ? f : 'src/' + f;
      if (held.has(f)) { if (r.bare.length) { waiting += r.bare.length; console.log(`literals gate: ${name} waits for ${held.get(f).branch} (${r.bare.length} bare, docs/spread/held.json)`); } else console.log(`literals gate: ${name} is held (docs/spread/held.json) but has no bare coordinate left: it can leave held.json`); continue; }
      for (const h of r.bare) { bad++; console.error(`${name}:${h.line}:${h.col}: bare ${h.kind} ${h.literal} — wrap it: ATLAS.frame('${h.guess && h.guess !== 'world' ? h.guess : '<place>'}') or ATLAS.world`); }
    }
    if (bad) { console.error(`literals gate: ${bad} bare map coordinate${bad > 1 ? 's' : ''} or list fault${bad > 1 ? 's' : ''} in src/ and tools/. Wrap each in its place's frame, or add it to docs/spread/literals-allow.json with a reason.`); process.exit(1); }
    console.log(`literals gate (repo-wide): ${all.length} files of src/ and tools/ (${list.length} in converted.json), 0 bare coordinates${held.size ? `; ${held.size} held for a peer branch (${waiting} bare, docs/spread/held.json)` : ''}`);
    process.exit(0);
  }
  const allow = allowList(), T = atlasTables(), rows = [];
  let total = 0;
  for (const f of sourceFiles(files)) {
    const r = scanFile(f, allow, T); total += r.bare.length;
    rows.push({ file: f, bare: r.bare, allowed: r.allowed.length });
  }
  if (argv.includes('--inventory')) {
    const inv = [], hf = path.join(SPREAD, 'held.json'), held = new Map((fs.existsSync(hf) ? JSON.parse(fs.readFileSync(hf, 'utf8')) : []).map(h => [/^tools\//.test(h.file) ? h.file : path.basename(h.file), h.branch]));
    for (const r of rows) for (const h of r.bare) inv.push(Object.assign({ file: r.file, line: h.line, col: h.col, literal: h.literal, kind: h.kind, guess: h.guess }, held.has(r.file) ? { held: held.get(r.file) } : {}));
    fs.mkdirSync(SPREAD, { recursive: true });
    const byKind = {}; for (const h of inv) byKind[h.kind] = (byKind[h.kind] || 0) + 1;
    fs.writeFileSync(path.join(SPREAD, 'inventory.json'), JSON.stringify({ about: 'bare coordinate-shaped literals in src/ and tools/ (tools/literals.mjs --inventory; a tool file is named tools/<name>); guess = the anchor tools/anchor-of.mjs names for a pair or point, world when no place box holds it, null for one axis alone', total: inv.length, outsideHeld: inv.filter(h => !h.held).length, byKind, files: rows.filter(r => r.bare.length).length, literals: inv }, null, 0).replace(/\},\{"file"/g, '},\n{"file"') + '\n');
    console.log(`inventory: ${inv.length} literals in ${rows.filter(r => r.bare.length).length} files written to docs/spread/inventory.json (${Object.entries(byKind).map(([k, v]) => k + ' ' + v).join(', ')}); ${inv.filter(h => !h.held).length} outside the files held for a peer branch (docs/spread/held.json)`);
  } else {
    for (const r of rows) if (r.bare.length || files.length) console.log(`${String(r.bare.length).padStart(5)}  ${r.file}${r.allowed ? `  (+${r.allowed} allowed)` : ''}`);
    console.log(`${String(total).padStart(5)}  total`);
  }
}
