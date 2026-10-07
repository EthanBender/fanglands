#!/usr/bin/env node
// ============================================================================
// THE COMPASS TEST (the Great Spread, Stage 4b; spec §13 4b): every line the game says that names a direction or a
// distance ("north", "south-west", "a mile", "thirty paces") is a row in docs/spread/compass.json, and every row that
// points across the overworld is checked against the Atlas: the direction from its `from` to its `to` on the map as it
// is now must be the word the line says (within 67.5 degrees, so "east" holds for anything from east-north-east to
// east-south-east). A line about a place's own inside (a street in Thistledown, a hall in Sylvaris, a cloud in the
// Aerie) is a row too, marked `local` with its reason: the spread moved places rigidly, so their insides kept their
// directions. A line with no row, or a row that matches no line, fails.
//
//   node tools/compass.mjs [index.html] [--quiet] [--list]
//
// Lines are found in src/[0-9]*.js by their call or property: say(), notify(), talk(), voice(), banner(), announce(),
// hint(), and the properties text, line, lines, talk, say, hint, desc, blurb, body, greet, bye, chat, barks, tip.
// A row: { file, match (text on the line), from, to, dir }   or   { file, match, local: "why" }
//   from / to: an Atlas port ("thistledown.square"), a place's anchor ("camp": its box's centre) or an Atlas place
//   ("wolfwood", "ashfields_dragons": its first rect's centre). dir: the direction word as the line says it.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { boot } from './fingerprint.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), quiet = args.includes('--quiet'), list = args.includes('--list');
const html = args.find(a => !a.startsWith('--')) || path.join(ROOT, 'index.html');
const require = createRequire(path.join(ROOT, 'online', 'package.json'));
let acorn; try { acorn = require('acorn'); } catch (e) { console.error('compass: acorn is missing (cd online && npm ci)'); process.exit(quiet ? 0 : 1); }

// ---------- the lines ----------
const WORD = /\b(north|south|east|west)(?:-?(?:east|west))?(?:ward|ern|erly)?\b|\b(miles?|leagues?|paces)\b/i;
const CALLS = new Set(['say', 'notify', 'talk', 'voice', 'banner', 'announce', 'hint']);
const PROPS = new Set(['text', 'line', 'lines', 'talk', 'say', 'hint', 'desc', 'blurb', 'body', 'greet', 'bye', 'chat', 'barks', 'tip']);
const lines = [];
for (const f of fs.readdirSync(path.join(ROOT, 'src')).filter(f => /^\d.*\.js$/.test(f)).sort()) {
  const src = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
  let ast; try { ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true, allowReturnOutsideFunction: true }); } catch (e) { console.error('compass: ' + f + ' does not parse: ' + e.message); process.exit(1); }
  const strOf = n => n.type === 'Literal' && typeof n.value === 'string' ? n.value : n.type === 'TemplateLiteral' ? n.quasis.map(q => q.value.cooked).join('…') : null;
  const kids = n => { const out = []; for (const k in n) if (k !== 'loc' && n[k] && typeof n[k] === 'object') { if (Array.isArray(n[k])) out.push(...n[k]); else if (n[k].type) out.push(n[k]); } return out; };
  const harvest = n => { if (!n || typeof n !== 'object') return; const s = strOf(n); if (s !== null) { if (WORD.test(s)) lines.push({ file: f, line: n.loc.start.line, text: s }); return; } kids(n).forEach(harvest); };
  const visit = n => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'CallExpression') { const c = n.callee, name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && c.property.type === 'Identifier' ? c.property.name : null; if (CALLS.has(name) && n.arguments[0]) harvest(n.arguments[0]); }
    if (n.type === 'Property' && n.key && PROPS.has(n.key.name || n.key.value)) harvest(n.value);
    kids(n).forEach(visit);
  };
  visit(ast);
}
{ const seen = new Set(); for (let i = lines.length - 1; i >= 0; i--) { const k = lines[i].file + '|' + lines[i].line + '|' + lines[i].text; if (seen.has(k)) lines.splice(i, 1); else seen.add(k); } }

// ---------- the rows ----------
const rowsFile = path.join(ROOT, 'docs', 'spread', 'compass.json');
const rows = fs.existsSync(rowsFile) ? JSON.parse(fs.readFileSync(rowsFile, 'utf8')).rows : [];
const fails = [];
const used = new Set();
for (const L of lines) {
  const mine = rows.map((r, i) => [r, i]).filter(([r]) => r.file === L.file && L.text.includes(r.match));
  if (!mine.length) { fails.push(`${L.file}:${L.line} has no row in docs/spread/compass.json: ${JSON.stringify(L.text.slice(0, 140))}`); continue; }
  for (const [, i] of mine) used.add(i);
}
rows.forEach((r, i) => { if (!used.has(i)) fails.push(`the row ${JSON.stringify(r.match)} (${r.file}) matches no line`); if (!r.local && !(r.from && r.to && r.dir)) fails.push(`the row ${JSON.stringify(r.match)} (${r.file}) needs from, to and dir, or local`); });

// ---------- the map: each direction row against the Atlas ----------
const g = boot(html);
const at = q => vm.runInContext(`(() => { if (!ATLAS.built()) newGame(); const q = ${JSON.stringify(q)};
  if (ATLAS.PORTS[q]) return ATLAS.port(q);
  const b = ATLAS.box(q); if (b) return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const p = ATLAS.get(q); if (p && p.map === 'over' && p.rects.length) { const r = p.rects[0]; return [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; }
  return null; })()`, g);
const ANGLE = { east: 0, 'south-east': 45, south: 90, 'south-west': 135, west: 180, 'north-west': -135, north: -90, 'north-east': -45 };
const norm = w => String(w).toLowerCase().replace(/(ward|ern|erly)$/, '').replace(/^(north|south)(east|west)$/, '$1-$2');
const table = [];
for (const r of rows) {
  if (r.local) { table.push([r.file, r.match.slice(0, 48), 'local', r.local.slice(0, 60)]); continue; }
  const a = at(r.from), b = at(r.to), want = ANGLE[norm(r.dir)];
  if (!a || !b) { fails.push(`the row ${JSON.stringify(r.match)} names ${!a ? r.from : r.to}, which the Atlas does not know`); continue; }
  if (want === undefined) { fails.push(`the row ${JSON.stringify(r.match)} says ${r.dir}, which is no compass word`); continue; }
  const line = lines.find(L => L.file === r.file && L.text.includes(r.match));
  if (line && !new RegExp('\\b' + r.dir.replace(/-/g, '-?') + '\\b', 'i').test(line.text)) fails.push(`the row ${JSON.stringify(r.match)} says ${r.dir}, but its line does not`);
  const got = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, diff = Math.abs(((got - want + 540) % 360) - 180);
  const ok = diff <= 67.5;
  table.push([r.file, r.match.slice(0, 48), `${r.from} -> ${r.to}`, `${r.dir}: ${Math.round(got)} deg, ${Math.round(diff)} off${ok ? '' : ' WRONG'}`]);
  if (!ok) fails.push(`${r.file}: ${JSON.stringify(r.match)} says ${r.dir}, but ${r.to} is ${Math.round(diff)} degrees off that from ${r.from} (bearing ${Math.round(got)})`);
}
if (list) for (const L of lines) console.log(`${L.file}:${L.line} ${JSON.stringify(L.text.slice(0, 160))}`);
if (!quiet) for (const t of table) console.log(t.join(' | '));
for (const f of fails) console.log('compass: ' + f);
console.log(`compass: ${lines.length} lines with a direction or distance word, ${rows.length} rows (${rows.filter(r => !r.local).length} on the map), ${fails.length ? fails.length + ' FAILED' : 'all hold'}`);
process.exit(fails.length ? 1 : 0);
