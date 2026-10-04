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
//   compare    x >= 142, ty <= 40 ... a number of 10 or more in the map, against a coordinate-named side
// A literal inside a frame call (F.x(112), F.p(..), ATLAS.world.tx(..), ATLAS.port(..)) is wrapped, so it is not counted.
//
//   node tools/literals.mjs [files...]       counts per file (all of src/ when no file is named)
//   node tools/literals.mjs --inventory      writes docs/spread/inventory.json: { file, line, col, literal, kind, guess }
//   node tools/literals.mjs --gate           the build's gate: every file in docs/spread/converted.json must have 0
//                                            literals outside docs/spread/literals-allow.json; exit 1 otherwise
// literals-allow.json: [{ file, literal?, line?, decl?, reason }] — no literal/line/decl allows the whole file (an
// instance's own map); `literal` matches the source text (spaces ignored), `line` pins it, `decl` allows everything
// inside that named declaration (01-atlas's own ANCHORS table).
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SPREAD = path.join(ROOT, 'docs', 'spread');
const SRC = path.join(ROOT, 'src');
const MAP_W = 260, MAP_H = 180;   // the map the literals were written for (read from 00-core below when it parses)

let acorn = null;
export function parser() {
  if (acorn) return acorn;
  try { acorn = createRequire(path.join(ROOT, 'online', 'package.json'))('acorn'); }
  catch (e) { throw new Error('literals: acorn is missing: run (cd online && npm ci)'); }
  return acorn;
}
export const parse = src => parser().parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, locations: true, ranges: true });

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
const num = n => n && n.type === 'Literal' && typeof n.value === 'number';
const neg = n => n && n.type === 'UnaryExpression' && n.operator === '-' && num(n.argument);
const nameOf = n => n.type === 'Identifier' ? n.name : n.type === 'MemberExpression' && !n.computed ? n.property.name : null;
const COORD_NAME = /^(t|p|c|s|n|o|a|b|g|d|m|k|q|w|h|e|f|i|j|r|z|u|v)?[xy][0-9]?$|^[xy](0|1|a|b)$|^t[xy][0-9]?$/;
const propName = p => p && p.type === 'Property' && !p.computed ? (p.key.type === 'Identifier' ? p.key.name : p.key.value) : null;

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
  const ast = parse(src);
  // a tile is a whole number (a centre may be a half: the fountain's 35.5); 6.4 is a drawing's, not a map's
  const tileish = v => Number.isInteger(v * 2);
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
    if (n.type === 'ObjectExpression') {
      const props = {}; for (const p of n.properties) { const k = propName(p); if (k) props[k] = p.value; }
      for (const [kx, ky] of [['x', 'y'], ['tx', 'ty']]) if (num(props[kx]) && num(props[ky]) && inMapX(props[kx].value) && inMapY(props[ky].value) && Math.max(props[kx].value, props[ky].value) >= 2) add(n, 'point', props[kx].value, props[ky].value, [props[kx], props[ky]]);
      const rk = ['x0', 'y0', 'x1', 'y1'].filter(k => num(props[k]));
      if (rk.length && ['x0', 'y0', 'x1', 'y1'].every(k => k in props)) add(n, 'rect', num(props.x0) ? props.x0.value : null, num(props.y0) ? props.y0.value : null, rk.map(k => props[k]));
    }
    if (n.type === 'CallExpression') {
      const c = n.callee, name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : null;
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

export function sourceFiles(names) {
  const all = fs.readdirSync(SRC).filter(f => /^[0-9].*\.js$/.test(f)).sort();
  if (!names || !names.length) return all;
  return names.map(n => path.basename(n)).filter(n => all.includes(n));
}

// ---------- the allow list ----------
export function allowList() {
  const f = path.join(SPREAD, 'literals-allow.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
}
const squash = s => String(s).replace(/\s+/g, '');
export function allowed(file, hit, src, allow, declRanges) {
  for (const a of allow) {
    if (a.file !== file) continue;
    if (a.decl) { const r = declRanges(a.decl); if (r.some(([s, e]) => hit.start >= s && hit.end <= e)) return a; continue; }
    if (a.literal === undefined && a.line === undefined) return a;
    if (a.line !== undefined && a.line !== hit.line) continue;
    if (a.literal !== undefined && squash(a.literal) !== squash(hit.literal)) continue;
    return a;
  }
  return null;
}
export function scanFile(file, allow = allowList(), T = null) {
  const src = fs.readFileSync(path.join(SRC, file), 'utf8');
  const hits = scanSource(src);
  let ast = null;
  const declRanges = name => { ast = ast || parse(src); const out = []; walk(ast, n => { if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === name && n.init) out.push([n.init.start, n.init.end]); }); return out; };
  const bare = [], ok = [];
  for (const h of hits) { const a = allowed(file, h, src, allow, declRanges); (a ? ok : bare).push(a ? Object.assign({}, h, { allowedBy: a.reason }) : h); }
  if (T) for (const h of bare) h.guess = h.x !== null && h.x !== undefined && h.y !== null && h.y !== undefined ? anchorOf(T, h.x, h.y).id : null;
  return { file, src, bare, allowed: ok };
}

// ---------- the command line ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), files = argv.filter(a => !a.startsWith('--'));
  if (argv.includes('--gate')) {
    const cf = path.join(SPREAD, 'converted.json');
    const converted = fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')) : [];
    const list = (Array.isArray(converted) ? converted : converted.files || []).map(f => path.basename(f));
    if (!list.length) process.exit(0);   // nothing converted yet: the gate has nothing to hold
    const allow = allowList(), T = atlasTables(); let bad = 0;
    for (const f of list) {
      if (!fs.existsSync(path.join(SRC, f))) { console.error(`literals gate: docs/spread/converted.json names ${f}, which is not in src/`); bad++; continue; }
      const r = scanFile(f, allow, T);
      for (const h of r.bare) { bad++; console.error(`src/${f}:${h.line}:${h.col}: bare ${h.kind} ${h.literal} — wrap it: ATLAS.frame('${h.guess && h.guess !== 'world' ? h.guess : '<place>'}') or ATLAS.world`); }
    }
    if (bad) { console.error(`literals gate: ${bad} bare map coordinate${bad > 1 ? 's' : ''} in converted files (docs/spread/converted.json). Wrap each in its place's frame, or add it to docs/spread/literals-allow.json with a reason.`); process.exit(1); }
    console.log(`literals gate: ${list.length} converted file${list.length > 1 ? 's' : ''}, 0 bare coordinates`);
    process.exit(0);
  }
  const allow = allowList(), T = atlasTables(), rows = [];
  let total = 0;
  for (const f of sourceFiles(files)) {
    const r = scanFile(f, allow, T); total += r.bare.length;
    rows.push({ file: f, bare: r.bare, allowed: r.allowed.length });
  }
  if (argv.includes('--inventory')) {
    const inv = [];
    for (const r of rows) for (const h of r.bare) inv.push({ file: r.file, line: h.line, col: h.col, literal: h.literal, kind: h.kind, guess: h.guess });
    fs.mkdirSync(SPREAD, { recursive: true });
    const byKind = {}; for (const h of inv) byKind[h.kind] = (byKind[h.kind] || 0) + 1;
    fs.writeFileSync(path.join(SPREAD, 'inventory.json'), JSON.stringify({ about: 'bare coordinate-shaped literals in src/ (tools/literals.mjs --inventory); guess = the anchor tools/anchor-of.mjs names for a pair or point, world when no place box holds it, null for one axis alone', total: inv.length, byKind, files: rows.filter(r => r.bare.length).length, literals: inv }, null, 0).replace(/\},\{"file"/g, '},\n{"file"') + '\n');
    console.log(`inventory: ${inv.length} literals in ${rows.filter(r => r.bare.length).length} files written to docs/spread/inventory.json (${Object.entries(byKind).map(([k, v]) => k + ' ' + v).join(', ')})`);
  } else {
    for (const r of rows) if (r.bare.length || files.length) console.log(`${String(r.bare.length).padStart(5)}  ${r.file}${r.allowed ? `  (+${r.allowed} allowed)` : ''}`);
    console.log(`${String(total).padStart(5)}  total`);
  }
}
