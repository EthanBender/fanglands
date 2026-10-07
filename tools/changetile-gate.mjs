#!/usr/bin/env node
// ============================================================================
// CHANGETILE-GATE — the changeTile classification gate (the Great Spread spec, section 10; Stage 4c)
// Every changeTile call in src/[0-9]*.js must be counted, per file, in docs/spread/changetile.json, with what it writes
// and how the save migration (src/97-spread.js) treats that tile in an old save. A file whose calls make story tiles
// names the file whose HOOKS.remake makes them again from quest state, and that file must register one.
// So a future quest that changes the world adds a call, the count no longer matches, and the build stops until the call
// is classified: a story tile gets a remake, or the migration would leave that quest's change behind on an old save.
//   node tools/changetile-gate.mjs [--counts]      (--counts prints each file's count)
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src'), TABLE = path.join(ROOT, 'docs', 'spread', 'changetile.json');
const table = JSON.parse(fs.readFileSync(TABLE, 'utf8')).files;
const calls = src => (src.match(/\bchangeTile\s*\(/g) || []).length - (src.match(/function\s+changeTile\s*\(/g) || []).length;
const files = fs.readdirSync(SRC).filter(f => /^[0-9].*\.js$/.test(f)).sort();
const faults = [], counts = {};
for (const f of files) {
  const n = calls(fs.readFileSync(path.join(SRC, f), 'utf8'));
  if (n) counts[f] = n;
  const row = table[f];
  if (n && !row) faults.push(`src/${f}: ${n} changeTile call${n === 1 ? '' : 's'}, not in docs/spread/changetile.json. Classify each: what it writes, and a HOOKS.remake if the story makes it.`);
  else if (row && row.calls !== n) faults.push(`src/${f}: ${n} changeTile call${n === 1 ? '' : 's'}, the table says ${row.calls}. Classify the new call (a story tile needs a HOOKS.remake) and set the count.`);
}
for (const f of Object.keys(table)) {
  const row = table[f];
  if (!files.includes(f)) faults.push(`docs/spread/changetile.json names src/${f}, which is not there`);
  for (const r of [].concat(row.remake || [])) {
    const rp = path.join(SRC, r);
    if (!fs.existsSync(rp) || !/HOOKS\.remake\.push\(/.test(fs.readFileSync(rp, 'utf8'))) faults.push(`src/${f} makes story tiles; src/${r} must register a HOOKS.remake that makes them again from quest state`);
  }
  if (typeof row.what !== 'string' || !row.what) faults.push(`docs/spread/changetile.json: src/${f} says nothing about what it writes`);
}
if (process.argv.includes('--counts')) for (const f of Object.keys(counts)) console.log(String(counts[f]).padStart(4) + '  src/' + f);
for (const m of faults) console.log('changetile gate: ' + m);
const total = Object.values(counts).reduce((a, b) => a + b, 0), story = Object.keys(table).filter(f => table[f].remake).length;
if (faults.length) { console.log(`changetile gate: ${faults.length} fault${faults.length === 1 ? '' : 's'}`); process.exit(1); }
console.log(`changetile gate: ${total} changeTile calls in ${Object.keys(counts).length} files, all classified; ${story} files make story tiles, each with a HOOKS.remake`);
