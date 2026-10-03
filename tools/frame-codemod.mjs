#!/usr/bin/env node
// ============================================================================
// FRAME-CODEMOD — the mechanical part of a file's conversion (the spread spec, §9.1 and §9.2)
//   node tools/frame-codemod.mjs src/NN-file.js [--write] [--as <anchor>] [--file-out PATH]
// Rewrites the bare coordinate literals tools/literals.mjs finds in one file as reads of their place's frame, and prints
// the unified diff. Only these patterns are mechanical:
//   pair   [x, y]                    -> ATLAS.frame('a').p(x, y)                  (world: [ATLAS.world.tx(x), ATLAS.world.ty(y)])
//   point  { x: N, y: N }            -> { x: ATLAS.frame('a').x(N), y: ATLAS.frame('a').y(N) }   (tx/ty the same)
//   rect   { x0, y0, x1, y1 }        -> each number through .x / .y               (both corners must name the same place)
//   call   setTile(N, N, ...) etc.   -> the two numbers through .x / .y
//   compare  x >= 142                -> x >= ATLAS.frame('a').x(142), ONLY with --as <anchor> (one axis names no place)
// The place is tools/anchor-of.mjs's answer for the point (the smallest old box; "world" when none holds it).
// It REFUSES, and changes nothing there, every literal it cannot classify: a tie between two boxes, a call with one number,
// tc(N) and N * TILE (one axis, no place: convert by hand), a comparison without --as, a rect whose corners disagree.
// Each refusal is listed with its line; the exit code is 1 when anything was refused.
// --write writes the converted file (refused literals are left as they were, for the hand pass). Without it nothing is written.
// Loops and comparisons are converted by hand (§9.1); then run the fingerprint, and add the file to converted.json.
// READ THE DIFF. The tool knows positions, not meaning: an instance's own map (any map but 'over') overlays the top-left,
// so its coordinates come out as 'cave' points, and they must never be wrapped (§9.1): put them in literals-allow.json
// with a reason first. The same for a size or a count that happens to look like a pair.
// ============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { atlasTables, anchorOf, scanSource, allowList, allowed, parse, walk } from './literals.mjs';

const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const target = argv.find((a, i) => !a.startsWith('--') && (i === 0 || !['--as', '--file-out'].includes(argv[i - 1])));
if (!target || !fs.existsSync(target)) { console.error('usage: node tools/frame-codemod.mjs src/NN-file.js [--write] [--as <anchor>] [--file-out PATH]'); process.exit(2); }
const file = path.basename(target), src = fs.readFileSync(target, 'utf8');
const T = atlasTables(), as = opt('--as');
if (as && !(T.ANCHORS[as] && T.ANCHORS[as].kind === 'place') && as !== 'world') { console.error('frame-codemod: --as names no place anchor: ' + as); process.exit(2); }

const F = id => id === 'world' ? 'ATLAS.world' : `ATLAS.frame('${id}')`;
const ax = (id, axis) => id === 'world' ? (axis === 'x' ? 'tx' : 'ty') : axis;   // world tiles are rounded
const wrap = (id, axis, node) => `${F(id)}.${ax(id, axis)}(${src.slice(node.start, node.end)})`;
const place = (x, y) => { const h = anchorOf(T, x, y); return h.ties.length ? { tie: [h.id, ...h.ties] } : { id: h.id }; };

// the literals, minus the allowed ones
const allow = allowList();
let ast = null;
const declRanges = name => { ast = ast || parse(src); const out = []; walk(ast, n => { if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === name && n.init) out.push([n.init.start, n.init.end]); }); return out; };
const hits = scanSource(src).filter(h => !allowed(file, h, src, allow, declRanges));

const edits = [], refused = [], done = [];
const refuse = (h, why) => refused.push({ line: h.line, col: h.col, kind: h.kind, literal: h.literal, why });
for (const h of hits) {
  const lit = h.nodes;
  if (h.kind === 'pair') {
    const p = place(h.x, h.y); if (p.tie) { refuse(h, 'a tie between ' + p.tie.join(' and ')); continue; }
    const [a, b] = lit;
    edits.push({ s: h.start, e: h.end, text: p.id === 'world' ? `[${wrap('world', 'x', a)}, ${wrap('world', 'y', b)}]` : `${F(p.id)}.p(${src.slice(a.start, a.end)}, ${src.slice(b.start, b.end)})`, h, id: p.id });
  } else if (h.kind === 'point' || h.kind === 'call') {
    if (lit.length !== 2) { refuse(h, 'only one of the two numbers is a literal: convert by hand'); continue; }
    const p = place(h.x, h.y); if (p.tie) { refuse(h, 'a tie between ' + p.tie.join(' and ')); continue; }
    edits.push({ s: lit[0].start, e: lit[0].end, text: wrap(p.id, 'x', lit[0]), h, id: p.id }, { s: lit[1].start, e: lit[1].end, text: wrap(p.id, 'y', lit[1]), h, id: p.id, second: true });
  } else if (h.kind === 'rect') {
    // the rect's numbers, by key: both corners must name one place
    const obj = (() => { let o = null; walk(ast || (ast = parse(src)), n => { if (!o && n.type === 'ObjectExpression' && n.start === h.start && n.end === h.end) o = n; }); return o; })();
    const val = k => { const p = obj.properties.find(q => q.type === 'Property' && !q.computed && (q.key.name || q.key.value) === k); return p && p.value.type === 'Literal' && typeof p.value.value === 'number' ? p.value : null; };
    const [x0, y0, x1, y1] = ['x0', 'y0', 'x1', 'y1'].map(val);
    const corners = [[x0, y0], [x1, y1]].filter(([a, b]) => a && b).map(([a, b]) => place(a.value, b.value));
    if (!corners.length) { refuse(h, 'no corner of the rect is two literals: one axis names no place'); continue; }
    if (corners.some(c => c.tie)) { refuse(h, 'a corner is a tie between ' + corners.find(c => c.tie).tie.join(' and ')); continue; }
    if (corners.length === 2 && corners[0].id !== corners[1].id) { refuse(h, `its corners name two places (${corners[0].id}, ${corners[1].id}): decide by hand`); continue; }
    const id = corners[0].id;
    for (const [k, node] of [['x', x0], ['y', y0], ['x', x1], ['y', y1]]) if (node) edits.push({ s: node.start, e: node.end, text: wrap(id, k, node), h, id });
  } else if (h.kind === 'compare') {
    if (!as) { refuse(h, 'a comparison names one axis and no place: convert by hand, or pass --as <anchor>'); continue; }
    const node = lit[0], cmp = (() => { let c = null; walk(ast || (ast = parse(src)), n => { if (!c && n.type === 'BinaryExpression' && n.start === h.start && n.end === h.end) c = n; }); return c; })();
    const other = cmp.left === node || (cmp.left.start === node.start) ? cmp.right : cmp.left;
    const nm = other.type === 'Identifier' ? other.name : other.property && other.property.name;
    const axis = /x/.test(nm) && !/y/.test(nm) ? 'x' : /y/.test(nm) && !/x/.test(nm) ? 'y' : null;
    if (!axis) { refuse(h, 'cannot tell the axis of ' + nm); continue; }
    edits.push({ s: node.start, e: node.end, text: wrap(as, axis, node), h, id: as });
  } else {
    refuse(h, h.kind === 'tc' ? 'tc(N) is one axis and names no place: convert by hand' : 'N * TILE is one axis and names no place: convert by hand');
  }
}
// overlapping edits (a pair inside a call already wrapped): keep the outer, refuse the inner
edits.sort((a, b) => a.s - b.s || b.e - a.e);
const kept = [];
for (const e of edits) { const last = kept[kept.length - 1]; if (last && e.s < last.e) { if (!e.second) refuse(e.h, 'inside another literal already converted'); continue; } kept.push(e); }
let out = src;
for (const e of kept.slice().sort((a, b) => b.s - a.s)) out = out.slice(0, e.s) + e.text + out.slice(e.e);
for (const e of kept) if (!e.second) done.push(e);

// the diff
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codemod-'));
const after = path.join(tmp, file);
fs.writeFileSync(after, out);
const d = spawnSync('diff', ['-u', '--label', 'a/src/' + file, '--label', 'b/src/' + file, target, after], { encoding: 'utf8' });
process.stdout.write(d.stdout || '');
fs.rmSync(tmp, { recursive: true, force: true });
const byPlace = {}; for (const e of kept) byPlace[e.id] = (byPlace[e.id] || 0) + 1;
console.log(`\nframe-codemod ${file}: ${hits.length} bare literals; converted ${new Set(kept.map(e => e.h)).size} (${Object.entries(byPlace).map(([k, v]) => k + ' ' + v).join(', ') || 'none'}); refused ${refused.length}`);
if (byPlace.cave) console.log(`  note: ${byPlace.cave} cave-frame edits. Instances overlay the top-left: an instance's own coordinates are never wrapped (allow-list them).`);
for (const r of refused) console.log(`  refused ${file}:${r.line}:${r.col} ${r.kind} ${r.literal.slice(0, 80)} — ${r.why}`);
if (argv.includes('--write')) { const dest = opt('--file-out') || target; fs.writeFileSync(dest, out); console.log(`written: ${dest}`); }
process.exit(refused.length ? 1 : 0);
