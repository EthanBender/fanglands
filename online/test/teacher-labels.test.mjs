// The map's names on the teacher screen (docs/ONLINE.md, "The teacher view", the map): one label per place, laid out by
// priority, never over another or over a knight, inside the pane, centred on the place's own ground, dropped at a zoom where
// it does not fit. layoutLabels is read from src/79-teacherscreen.js as it is written there (between LABELS:BEGIN and
// LABELS:END) and run over the real map file (online/src/teacher-map.js on the very atlas.json the World bundles).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTeacherMap, cellsOf } from '../src/teacher-map.js';

const SRC = fs.readFileSync(new URL('../../src/79-teacherscreen.js', import.meta.url), 'utf8');
const body = SRC.slice(SRC.indexOf('// LABELS:BEGIN'), SRC.indexOf('// LABELS:END'));
assert.ok(body.includes('function layoutLabels('), 'layoutLabels not found between the markers');
const layoutLabels = new Function('cl', body + '\nreturn layoutLabels;')((v, a, b) => Math.max(a, Math.min(b, v)));
const ATLAS = JSON.parse(fs.readFileSync(new URL('../src/atlas.json', import.meta.url), 'utf8'));
const M = buildTeacherMap(ATLAS), cells = cellsOf(ATLAS);
const places = M.labels.map(p => { const own = new Set(p.idx); return Object.assign({}, p, { owns: (tx, ty) => tx >= 0 && ty >= 0 && tx < M.W && ty < M.H && own.has(cells[ty * M.W + tx]) }); });
// a sans-serif's widths, near enough (the browser's measureText is what the page uses)
const measure = (text, font) => { const px = +(/(\d+(?:\.\d+)?)px/.exec(font) || [0, 14])[1], bold = /^7/.test(font) ? 0.6 : 0.56; return String(text).length * px * bold; };
const fitOf = (w, h) => { const s = Math.min(w / M.W, h / M.H); return { s, x: (w - M.W * s) / 2, y: (h - M.H * s) / 2 }; };
const viewAt = (w, h, rel, cx, cy) => { const f = fitOf(w, h), s = f.s * rel; return rel === 1 ? Object.assign({ w, h, fit: f.s, font: 13.2 }, f) : { s, x: w / 2 - cx * s, y: h / 2 - cy * s, w, h, fit: f.s, font: 13.2 }; };
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const overlap = (a, b, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const touchesDot = (b, c, pad) => { const nx = Math.max(b.x, Math.min(c.x, b.x + b.w)), ny = Math.max(b.y, Math.min(c.y, b.y + b.h)); return Math.hypot(c.x - nx, c.y - ny) < c.r + pad; };
// the map pane at each window size (the bar 48, the pane's header 52, the inside-places line 56; narrow: 55% of the panes)
const PANES = [[1280, 800], [1024, 768], [1366, 1024], [1920, 1080], [768, 1024], [834, 1194], [1180, 820], [390, 844]].map(([W, H]) => {
  const d = 12, chat = Math.max(260, Math.round(0.24 * W)), who = Math.max(280, Math.round(0.26 * W)), wide = W >= 900 && W >= 260 + 380 + 280 + 2 * d;
  const mw = wide ? W - chat - who - 2 * d : W, mh = wide ? H - 48 - 52 - 56 : Math.round(0.55 * (H - 48 - 44)) - 52 - 56;
  return { name: W + 'x' + H, w: Math.round(mw), h: Math.round(mh) };
});

function invariants(where, view, res, dots) {
  const all = res.labels.map(l => ({ x: l.x, y: l.y, w: l.w, h: l.h, n: l.name })).concat(res.tags.map(t => ({ x: t.x, y: t.y, w: t.w, h: t.h, n: 'tag ' + t.n })));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!overlap(all[i], all[j]), where + ': ' + all[i].n + ' overlaps ' + all[j].n);
  const circles = res.dots.concat(res.clusters);
  for (const l of res.labels) for (const c of circles) assert.ok(!touchesDot(l, c, 0), where + ': ' + l.name + ' touches a dot');
  for (const b of all) assert.ok(b.x >= 6 && b.y >= 6 && b.x + b.w <= view.w - 6 && b.y + b.h <= view.h - 6, where + ': ' + b.n + ' leaves the pane');
  const names = res.labels.map(l => l.name);
  assert.equal(new Set(names).size, names.length, where + ': a name drawn twice');
  for (const l of res.labels) { const p = places.find(q => q.name === l.name); assert.ok(p.owns(Math.floor((l.cx - view.x) / view.s), Math.floor((l.cy - view.y) / view.s)), where + ': ' + l.name + ' is not centred on its own ground'); }
  // every knight is a dot or in a count circle
  assert.equal(res.dots.length + res.clusters.reduce((n, c) => n + c.ks.length, 0), dots.length, where + ': a knight lost');
}

test('the map file: one label per place name (Hollowford, The Ashfields and Ironclad Isle merged), no reserved place, every anchor on its own ground', () => {
  const names = M.labels.map(l => l.name);
  assert.equal(new Set(names).size, names.length);
  for (const n of ['Hollowford', 'The Ashfields', 'Ironclad Isle']) assert.equal(names.filter(x => x === n).length, 1, n);
  for (const n of ['Hollowford', 'The Ashfields', 'Ironclad Isle']) assert.ok(M.labels.find(l => l.name === n).idx.length >= 2, n + ' merges two Atlas places');
  assert.ok(!M.labels.some(l => l.kind === 'reserved' || /wilderlands/i.test(l.name)));
  for (const l of places) assert.ok(l.owns(l.anchor[0], l.anchor[1]), l.name + ' anchor ' + l.anchor);
  for (const l of M.labels) assert.deepEqual(Object.keys(l), ['name', 'kind', 'idx', 'area', 'box', 'anchor', 'depth']);
});

test('property: at 8 panes, 6 zooms, 0 to 50 knights and 3 pans each: no overlap, nothing on a dot, inside the pane, on its own ground, each name once; a 1 px pan changes nothing', () => {
  let runs = 0;
  for (const pane of PANES) for (const rel of [1, 1.5, 2, 3, 4, 6]) for (let trial = 0; trial < 3; trial++) {
    const n = Math.floor(rnd() * 51);
    const cx = 20 + rnd() * (M.W - 40), cy = 20 + rnd() * (M.H - 40);
    const view = viewAt(pane.w, pane.h, rel, cx, cy);
    const knights = []; for (let i = 0; i < n; i++) knights.push({ n: 'Kid ' + i, tx: rnd() * M.W, ty: rnd() * M.H, sel: i === 0, flag: i === 1 });
    const dotsOf = v => knights.map(k => ({ n: k.n, x: v.x + k.tx * v.s, y: v.y + k.ty * v.s, sel: k.sel, flag: k.flag })).filter(d => d.x > -40 && d.y > -40 && d.x < v.w + 40 && d.y < v.h + 40);
    const where = pane.name + ' zoom ' + rel + ' knights ' + n + ' trial ' + trial;
    const d0 = dotsOf(view), r0 = layoutLabels(view, places, d0, measure, null);
    invariants(where, view, r0, d0);
    // a 1 px pan, from where the names sat (prev): the same names, each moved by exactly 1 px
    const prev = {}; for (const l of r0.labels) prev[l.name] = [l.tx, l.ty];
    const v1 = Object.assign({}, view, { x: view.x + 1 });
    const r1 = layoutLabels(v1, places, dotsOf(v1), measure, prev);
    invariants(where + ' panned', v1, r1, dotsOf(v1));
    const moved = r1.labels.map(l => l.name + '@' + (l.x - 1) + ',' + l.y).sort(), stay = r0.labels.map(l => l.name + '@' + l.x + ',' + l.y).sort();
    // (a name at the pane's very edge may step out of it with the pan; with 0 knights and the map away from the edges, none does)
    if (n === 0) assert.deepEqual(moved, stay, where + ': a 1 px pan changed the names');
    runs++;
  }
  assert.equal(runs, 8 * 6 * 3);
});

test('at the whole map in a 586 x 405 pane (round 1\'s map at 1280 wide) Thistledown, The Jungle and The Redcut are drawn, and none of the eight names in the owner\'s screenshot overlaps another', () => {
  const view = viewAt(586, 405, 1);
  const res = layoutLabels(view, places, [], measure, null);
  const names = res.labels.map(l => l.name);
  for (const n of ['Thistledown', 'The Jungle', 'The Redcut']) assert.ok(names.includes(n), n + ' missing: ' + names.join(', '));
  const eight = ['The Cave', 'Grey Quarry', 'Goblin Fields', 'Thistledown', 'The Grey Sea', 'Castle Thistledown', 'The Far Shore', 'Castle Gnash'];
  const drawn = res.labels.filter(l => eight.includes(l.name));
  for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) assert.ok(!overlap(drawn[i], drawn[j]), drawn[i].name + ' / ' + drawn[j].name);
  // closer in, the small places come back (each one where it fits)
  const near = layoutLabels(viewAt(586, 405, 4, 30, 12), places, [], measure, null).labels.map(l => l.name);
  assert.ok(near.includes('The Cave') && near.includes('Grey Quarry'), near.join(', '));
});
