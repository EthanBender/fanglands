// The Atlas as the Room reads it (online/src/atlas.js over online/src/atlas.json): docs/ONLINE.md, "The shared world", Stage 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { readAtlas, isHouse } from '../src/atlas.js';
import { ATLAS_FILE } from '../../tools/atlas.mjs';

const json = JSON.parse(fs.readFileSync(ATLAS_FILE, 'utf8'));
const atlas = readAtlas(json);
const TILE = 48;

test('the Atlas reads: a 16-digit hash, every region and instance a place, plain ids, one grid cell per overworld tile', () => {
  assert.ok(atlas);
  assert.match(atlas.hash, /^[0-9a-f]{16}$/);
  assert.equal(atlas.MAP_W * atlas.MAP_H, 260 * 180);
  for (const p of atlas.places) assert.match(p.id, /^[a-z0-9_]{1,40}$/);
  for (const id of ['fang_lair', 'goblin_camp', 'goblin_fields', 'thistledown', 'hollowford', 'hollowford_square', 'ashfields_dragons', 'iron_isle_wreck', 'deep_wilderlands', 'wilds',
    'spider_den', 'war_shed', 'deepholm', 'tinker_lab', 'afterlands', 'aerie', 'coalmine', 'house', 'stormfront', 'royalmine']) assert.ok(atlas.get(id), id);
  assert.equal(readAtlas(null), null);
  assert.equal(readAtlas({}), null);
});

test('zone lookups: the Fang circle is multi, the Thistledown fields are single, the camp and the boss instances are multi', () => {
  const [cx, cy] = json.calls.the_fang.near;
  assert.equal(atlas.zoneAt('over', cx, cy), 'fang_lair');
  assert.equal(atlas.combatAt('over', cx, cy), 'multi');
  assert.equal(atlas.zoneAt('over', 70, 40), 'goblin_fields');      // the fields between the road and Thistledown
  assert.equal(atlas.combatAt('over', 70, 40), 'single');
  assert.equal(atlas.combatAt('over', 112, 33), 'single');          // Thistledown's square (its safe option is off)
  assert.equal(atlas.zoneAt('over', 112, 33), 'thistledown');
  assert.equal(atlas.combatAt('over', 150, 30), 'multi');           // inside the palisade
  assert.equal(atlas.zoneAt('over', 143, 30), 'goblin_camp');       // the camp spawns' rect reaches past the region's edge
  assert.equal(atlas.zoneAt('over', 140, 80), 'hollowford_square');
  assert.equal(atlas.combatAt('over', 125, 68), 'single');          // Hollowford outside its square
  assert.equal(atlas.zoneAt('over', 188, 50), 'iron_isle_wreck');
  assert.equal(atlas.zoneAt('over', 60, 131), 'ashfields_dragons');
  assert.equal(atlas.zoneAt('over', 259, 179), 'wilds');
  for (const id of ['spider_den', 'war_shed', 'tinker_lab', 'stormfront', 'afterlands', 'royalmine']) assert.equal(atlas.combatAt(id, 2, 2), 'multi', id);
  for (const id of ['deepholm', 'aerie', 'coalmine']) assert.equal(atlas.combatAt(id, 2, 2), 'single', id);
  assert.equal(atlas.place('over', -1, 0), null);
  assert.equal(atlas.place('over', 260, 0), null);
  assert.equal(atlas.place('spider_den', 40, 0), null);
  assert.equal(atlas.place('nowhere', 1, 1), null);
  // every camp spawn is in the camp
  for (const [type, tx, ty, camp] of json.spawns) if (camp) assert.equal(atlas.zoneAt('over', tx, ty), 'goblin_camp', type + ' ' + tx + ',' + ty);
});

test('FIXED_SOLID: walls and cliffs are, water and grass are not, the edge always is; the island and unknown maps are never judged', () => {
  assert.ok(atlas.fixedCount > 1000);
  assert.equal(atlas.solidAt('over', -1, 5), true);
  assert.equal(atlas.solidAt('over', 5, 180), true);
  assert.equal(atlas.solidAt('over', 0, 0), true);       // the Cave's rock border
  assert.equal(atlas.solidAt('over', 5, 7), false);      // the Cave's floor, where you wake
  assert.equal(atlas.solidAt('over', 43, 36), false);    // Miller's Pond: water is never fixed
  assert.equal(atlas.solidAt('spider_den', -1, 3), true);
  assert.equal(atlas.knows('over'), true);
  assert.equal(atlas.knows('spider_den'), true);
  assert.equal(atlas.knows('house'), false);
  assert.equal(atlas.knows('house:ben'), false);
  assert.equal(atlas.knows('nowhere'), false);
  assert.equal(isHouse('house:ben'), true);
  assert.equal(isHouse('housey'), false);
  assert.equal(atlas.speedMax, 350);
});

test('the Room\'s reading matches the game\'s own Atlas on every overworld tile and every instance tile', () => {
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const noop = () => { };
  const ctx2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined, set: () => true });
  const mk = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
  const store = {};
  const g = { innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, setTimeout: noop, clearTimeout: noop,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    performance: { now: () => Date.now() }, console: Object.assign(Object.create(console), { table: noop, log: noop }), navigator: { maxTouchPoints: 0 },
    document: { getElementById: mk, createElement: mk, fonts: null } };
  g.window = g; vm.createContext(g); vm.runInContext(script, g);
  const A = g.ATLAS;
  assert.equal(A.hash(), atlas.hash);
  let zones = 0, solids = 0;
  for (let ty = -1; ty <= 180; ty++) for (let tx = -1; tx <= 260; tx++) {
    if (A.zoneAt('over', tx, ty) !== atlas.zoneAt('over', tx, ty)) zones++;
    if (A.solidAt('over', tx, ty) !== atlas.solidAt('over', tx, ty)) solids++;
  }
  for (const id of g.INSTANCES.list()) {
    const d = g.INSTANCES.get(id);
    for (let ty = -1; ty <= d.h; ty++) for (let tx = -1; tx <= d.w; tx++) {
      if (A.zoneAt(id, tx, ty) !== atlas.zoneAt(id, tx, ty)) zones++;
      if (id !== 'house' && A.solidAt(id, tx, ty) !== atlas.solidAt(id, tx, ty)) solids++;
    }
  }
  assert.equal(zones, 0);
  assert.equal(solids, 0);
  // a knight's pixels: inside() in the game agrees with the zone under him
  assert.equal(A.inside('goblin_camp', { x: 150 * TILE + 5, y: 30 * TILE + 5 }), true);
  assert.equal(A.inside('hollowford', { x: 140 * TILE, y: 80 * TILE }), true);   // the square is an area of Hollowford
  assert.equal(A.inside('fang_lair', { x: 150 * TILE, y: 30 * TILE }), false);
});
