#!/usr/bin/env node
// ============================================================================
// SPREAD-FOOTPRINT — the Great Spread's FOOTPRINT proof for a Stage 5 or 6 build (spec §13: "the world diff against the
// previous build stays inside its boxes plus a 6-tile ring, and nothing else moved")
// Boots the previous build and this one headless (tools/fingerprint.mjs), and compares the new game's world tile by tile
// (the map and its variants), then the regions, buildings, people and monster spawns. Every changed tile must lie inside
// a footprint box this build declares for the revs it adds (ATLAS.REVS[n] for the old WORLD_REV < n <= the new one);
// every changed person, building, region and spawn likewise. It prints what changed and where, and exits 1 on anything
// outside. Each place's REVS box already holds its 6-tile dressing ring, and only what lies inside a REVS box is swept from
// an older save, so the gate is the boxes themselves (--ring 0, the default since the review of bcb559f: the old default
// of 6 more on top let a change 12 tiles out pass, which no sweep would clean). The changes within 6 tiles of a box are
// counted for information.
//   --from-rev N   the boxes of every rev after N (default: the previous build's WORLD_REV). A fix that keeps WORLD_REV
//                  (no new boxes) is held to the places' own boxes with --from-rev of the stage's start; a tile changed
//                  there is still not swept from a save of the same rev, so such a fix should change people, not tiles.
//
//   node tools/spread-footprint.mjs <previous index.html> [this index.html] [--ring 0] [--from-rev N] [--json FILE]
//
// The previous build is any built index.html (e.g. `git show <ref>:index.html > /tmp/prev.html`).
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { fingerprint, boot } from './fingerprint.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const val = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const files = argv.filter((a, i) => a.endsWith('.html') && (i === 0 || !argv[i - 1].startsWith('--')));
if (!files.length) { console.error('usage: spread-footprint.mjs <previous index.html> [this index.html] [--ring 6] [--json FILE]'); process.exit(2); }
const prevFile = files[0], nowFile = files[1] || path.join(ROOT, 'index.html'), RING = +val('--ring', 0), INFO = 6;

// the revs and their boxes, read from each build
const revsOf = f => JSON.parse(vm.runInContext('JSON.stringify({ rev: WORLD_REV, W: MAP_W, REVS: ATLAS.REVS || {} })', boot(f)));
const P = revsOf(prevFile), N = revsOf(nowFile);
const boxes = [];
const FROM = val('--from-rev', null) === null ? P.rev : +val('--from-rev', null);
for (let r = FROM + 1; r <= N.rev; r++) { const R = N.REVS[r]; if (R && Array.isArray(R.boxes)) boxes.push(...R.boxes); }
const nearBy = d => (x, y) => boxes.some(b => x >= b[0] - d && x <= b[2] + d && y >= b[1] - d && y <= b[3] + d);
const near = nearBy(RING), nearInfo = nearBy(INFO);

const A = fingerprint(prevFile).tables, B = fingerprint(nowFile).tables, W = N.W;
const out = { prevRev: P.rev, rev: N.rev, fromRev: FROM, boxes: boxes.length, ring: RING, tiles: [], outside: [], rows: {} };
// the world, tile by tile
for (const k of ['map', 'variant']) {
  const a = A[k], b = B[k];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (JSON.stringify(a[i]) === JSON.stringify(b[i])) continue;
    const x = i % W, y = Math.floor(i / W), e = [k, x, y, a[i], b[i]];
    out.tiles.push(e); if (!near(x, y)) out.outside.push(e);
  }
}
// the tables that hold positions: each row is [id/name/type, x, y, ...]; a row added, gone or changed must be near a box
const xyOf = (k, r) => k === 'regions' ? [r[2], r[3], r[4], r[5]] : [r[1], r[2]];
for (const k of ['regions', 'buildings', 'npcs', 'spawns']) {
  const ka = new Set((A[k] || []).map(r => JSON.stringify(r))), kb = new Set((B[k] || []).map(r => JSON.stringify(r)));
  const gone = [...ka].filter(s => !kb.has(s)).map(s => JSON.parse(s)), added = [...kb].filter(s => !ka.has(s)).map(s => JSON.parse(s));
  out.rows[k] = { gone: gone.length, added: added.length };
  for (const [how, list] of [['gone', gone], ['added', added]]) for (const r of list) {
    const p = xyOf(k, r), inside = k === 'regions' ? near(p[0], p[1]) && near(p[2], p[3]) : near(p[0], p[1]);
    if (!inside) out.outside.push([k, how, r]);
  }
  out.rows[k].sample = [...gone.slice(0, 3).map(r => ['gone', r]), ...added.slice(0, 20).map(r => ['added', r])];
}
console.log(`footprint: WORLD_REV ${P.rev} -> ${N.rev}, ${boxes.length} footprint boxes (the revs after ${FROM}${RING ? `, +${RING} ring` : ''})`);
console.log(`  world: ${out.tiles.length} tiles changed (map and variants), ${out.tiles.filter(e => !near(e[1], e[2])).length} outside the footprint${RING ? '' : ` (${out.tiles.filter(e => !near(e[1], e[2]) && nearInfo(e[1], e[2])).length} of them within ${INFO} of a box)`}`);
for (const k of Object.keys(out.rows)) console.log(`  ${k}: ${out.rows[k].added} added, ${out.rows[k].gone} gone`);
for (const k of Object.keys(out.rows)) for (const [how, r] of out.rows[k].sample) console.log(`    ${k} ${how} ${JSON.stringify(r)}`);
if (out.outside.length) { console.log(`FOOTPRINT: ${out.outside.length} changes outside the footprint:`); for (const e of out.outside.slice(0, 40)) console.log('  ' + JSON.stringify(e)); }
else console.log(`FOOTPRINT: every change lies inside the footprint boxes${RING ? ' and their ring' : ''}`);
if (val('--json', null)) fs.writeFileSync(val('--json', null), JSON.stringify(out, null, 1));
process.exit(out.outside.length ? 1 : 0);
