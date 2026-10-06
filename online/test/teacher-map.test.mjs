// The teacher's map file (docs/ONLINE.md, "The teacher view", "The map file"): made from the very atlas.json the World
// bundles, the grid decodes to W x H, and it carries nothing but the listed keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTeacherMap, teacherMap, MAP_KEYS } from '../src/teacher-map.js';

const ATLAS = JSON.parse(fs.readFileSync(new URL('../src/atlas.json', import.meta.url), 'utf8'));

test('43. teacherMap(): the Atlas hash, a grid of W x H cells, the overworld places only, doors on the overworld, and no other key', async () => {
  const res = teacherMap();
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  assert.match(res.headers.get('content-type'), /application\/json/);
  const m = await res.json();
  assert.deepEqual(Object.keys(m).sort(), MAP_KEYS.slice().sort());
  assert.equal(m.hash, ATLAS.hash);
  assert.deepEqual(m, JSON.parse(JSON.stringify(buildTeacherMap(ATLAS))));
  let cells = 0; for (let i = 1; i < m.grid.length; i += 2) cells += m.grid[i];
  assert.equal(cells, m.W * m.H);
  let bits = 0; for (const c of m.fixed) bits += c;
  assert.equal(bits, m.W * m.H);
  for (let i = 0; i < m.grid.length; i += 2) assert.ok(m.places[m.grid[i]], 'grid value ' + m.grid[i] + ' names an overworld place');
  for (const p of m.places) if (p) { assert.deepEqual(Object.keys(p), ['id', 'name', 'kind', 'rects']); assert.notEqual(p.kind, 'instance'); }
  assert.equal(m.doors.spider_den.name, 'The Spider Den');
  for (const d of Object.values(m.doors)) { assert.deepEqual(Object.keys(d), ['name', 'x', 'y']); assert.ok(d.x >= 0 && d.x < m.W && d.y >= 0 && d.y < m.H); }
  // nothing a teacher has no use for: spawns, calls, speeds, the instances' own masks
  const text = JSON.stringify(m);
  for (const k of ['spawns', 'calls', 'speed', 'realm', '"sub"', '"combat"']) assert.ok(!text.includes(k), k);
});
