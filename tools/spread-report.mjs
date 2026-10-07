#!/usr/bin/env node
// ============================================================================
// THE SPREAD'S MAP REPORT (the Great Spread, Stage 4b): boots the build, starts a new game and prints the tables behind
// src/97-spreadchecks.js's self-tests, for the owner and the stage report:
//   the walk-clock (spec §1: each trip on foot, the shortest 8-connected walk with root-2 diagonals, the story gates open),
//   the seam transects (§6), the beat-gap report (§6, report-only in Stage 4), spacing, ports, the story gates, the
//   scarp seal, ADDENDUM C's edge ring, and the spawns moved off the main roads.
//   node tools/spread-report.mjs [index.html] [--json out.json]
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { boot } from './fingerprint.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const html = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--json') || path.join(ROOT, 'index.html');
const g = boot(html);
const r = JSON.parse(vm.runInContext(`(() => { newGame(); const S = SPREAD_CHECKS;
  return JSON.stringify({ map: [MAP_W, MAP_H], walk: S.walkClock(), seams: S.transects(), beats: S.beatGaps(), spacing: S.spacing(), ports: S.ports(), gates: S.gateFloods(),
    seal: S.scarpSeal(), edge: S.edgeRing(), roads: S.roadsClear(), spawns: S.spawnsOffRoads(), moved: (window.SPREAD_GROUND && SPREAD_GROUND.stats.offRoad) || [], exempt: S.SEAM_EXEMPT }); })()`, g));
const pad = (s, n) => String(s).padEnd(n);
console.log(`THE WALK-CLOCK (spec section 1; map ${r.map.join(' x ')}; on foot, ${'175 px/s'})`);
console.log(pad('Trip', 44) + pad('Tiles', 7) + pad('Seconds', 9) + pad('Window', 10) + 'Result');
for (const w of r.walk) console.log(pad(w.trip, 44) + pad(w.tiles, 7) + pad(w.s, 9) + pad(w.lo + '-' + w.hi, 10) + (w.inside ? 'inside' : w.held ? 'short, held for the owner: ' + w.held.why : 'OUTSIDE'));
console.log('\nSEAM TRANSECTS (spec section 6: 20 lines across each land seam; a line\'s mixed run in tiles)');
for (const s of r.seams) console.log(pad(s.id, 18) + `median ${pad(s.median, 4)} min ${pad(s.min, 4)} nearly ruled (under 3) ${pad(s.runs.filter(v => v < 3).length, 3)} runs ${s.runs.join(' ')}`);
for (const [k, v] of Object.entries(r.exempt)) console.log('  exempt ' + pad(k, 22) + v);
console.log('\nBEAT GAPS (spec section 6, report-only in Stage 4; Stage 5 brings the Cave, Long and Sea Roads under 73 / 36)');
for (const b of r.beats) console.log(pad(b.road, 14) + `length ${pad(b.length, 5)} longest gap between stops ${pad(b.stopGap, 5)} between glances ${b.glanceGap}`);
console.log(`\nSPACING: ${r.spacing.places} named places; under 25 tiles apart: ${r.spacing.near.length ? r.spacing.near.join(', ') : 'none'}; exempt: ${r.spacing.exempt.join(', ')}`);
console.log(`PORTS: ${r.ports.of} ports; not reached: ${r.ports.missed.length ? r.ports.missed.join(', ') : 'none'}; listed: ${r.ports.held.join(', ')}`);
console.log(`STORY GATES SHUT: warden ${JSON.stringify(r.gates.warden)}, lair ${JSON.stringify(r.gates.lair)}, palisade ${JSON.stringify(r.gates.palisade)}, ferry: ${r.gates.ferry.east} tiles east of x ${r.gates.ferry.x0}`);
console.log(`SCARP SEAL: all shut reaches ${JSON.stringify(r.seal.none)}; each alone reaches ${JSON.stringify(r.seal.each)} of 5`);
console.log(`EDGE RING (ADDENDUM C, ${r.edge.ring} tiles): ${r.edge.bad.length ? r.edge.bad.join('; ') : 'clear'}; the east sea dry tiles ${r.edge.dry}`);
console.log(`MAIN ROADS: ${r.roads.length ? r.roads.join('; ') : 'clear'}`);
console.log(`AGGRESSIVE SPAWNS within 6 of a main road: ${r.spawns.near.length ? r.spawns.near.join('; ') : 'none'}; the road's own fights: ${r.spawns.chosen.length}`);
console.log(`MOVED OFF THE ROADS (93-spread): ${r.moved.map(m => `${m[0]} ${m[1]},${m[2]} -> ${m[3]},${m[4]}`).join('; ') || 'none'}`);
const out = opt('--json', null); if (out) fs.writeFileSync(out, JSON.stringify(r, null, 1));
