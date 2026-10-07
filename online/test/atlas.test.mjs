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
// positions are read from atlas.json (its anchors and ports, the Stage 4a spread's export), never written as literals
const W = json.MAP_W, H = json.MAP_H, port = id => { const q = json.ports[id]; assert.ok(q, 'port ' + id); return q; };
const centre = id => { const r = json.places.find(p => p.id === id).rects[0]; return [Math.round((r[0] + r[2]) / 2), Math.round((r[1] + r[3]) / 2)]; };

test('the Atlas reads: a 16-digit hash, every region and instance a place, plain ids, one grid cell per overworld tile', () => {
  assert.ok(atlas);
  assert.match(atlas.hash, /^[0-9a-f]{16}$/);
  assert.deepEqual([atlas.MAP_W, atlas.MAP_H], [W, H]);   // the size is the file's own (the game's, checked below); the grid holds W x H
  assert.equal(json.v, 2);
  for (const id of ['thistledown', 'hollowford', 'old_bridge', 'alchemy', 'necromancy']) assert.ok(json.anchors[id] && json.anchors[id].box.length === 4, 'anchor ' + id);
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
  const [fx, fy] = json.anchors.drill_field.box;                   // the open fields south of the road (the bulldozer's lane)
  assert.equal(atlas.zoneAt('over', fx, fy), 'goblin_fields');
  assert.equal(atlas.combatAt('over', fx, fy), 'single');
  const [sx, sy] = port('thistledown.square');
  assert.equal(atlas.combatAt('over', sx, sy), 'single');          // Thistledown's square (its safe option is off)
  assert.equal(atlas.zoneAt('over', sx, sy), 'thistledown');
  const [wx, wy] = port('camp.walker');
  assert.equal(atlas.combatAt('over', wx, wy), 'multi');           // inside the palisade
  const [gx, gy] = port('camp.west_gap');
  assert.equal(atlas.zoneAt('over', gx - 4, gy), 'goblin_camp');   // the camp spawns' rect reaches past the region's edge
  assert.equal(atlas.zoneAt('over', ...port('hollowford.square')), 'hollowford_square');
  const [nx, ny] = port('hollowford.north');
  assert.equal(atlas.combatAt('over', nx - 15, ny), 'single');     // Hollowford outside its square
  const [hx, hy] = port('ironclad_isle.hull');
  assert.equal(atlas.zoneAt('over', hx, hy + 4), 'iron_isle_wreck');
  assert.equal(atlas.zoneAt('over', ...centre('ashfields_dragons')), 'ashfields_dragons');
  assert.equal(atlas.zoneAt('over', W - 1, H - 1), 'wilds');
  assert.equal(atlas.zoneAt('over', ...port('alchemy.door')), 'alchemy');   // a reserved place is a place of its own
  for (const id of ['spider_den', 'war_shed', 'tinker_lab', 'stormfront', 'afterlands', 'royalmine']) assert.equal(atlas.combatAt(id, 2, 2), 'multi', id);
  for (const id of ['deepholm', 'aerie', 'coalmine']) assert.equal(atlas.combatAt(id, 2, 2), 'single', id);
  assert.equal(atlas.place('over', -1, 0), null);
  assert.equal(atlas.place('over', W, 0), null);
  assert.equal(atlas.place('spider_den', 40, 0), null);
  assert.equal(atlas.place('nowhere', 1, 1), null);
  // every camp spawn is in the camp
  for (const [type, tx, ty, camp] of json.spawns) if (camp) assert.equal(atlas.zoneAt('over', tx, ty), 'goblin_camp', type + ' ' + tx + ',' + ty);
});

test('FIXED_SOLID: walls and cliffs are, water and grass are not, the edge always is; the island and unknown maps are never judged', () => {
  assert.ok(atlas.fixedCount > 1000);
  assert.equal(atlas.solidAt('over', -1, 5), true);
  assert.equal(atlas.solidAt('over', 5, H), true);
  assert.equal(atlas.solidAt('over', 0, 0), true);       // the Cave's rock border
  assert.equal(atlas.solidAt('over', ...port('cave.spawn')), false);      // the Cave's floor, where you wake
  assert.equal(atlas.solidAt('over', ...port('pond.centre')), false);    // Miller's Pond: water is never fixed
  assert.equal(atlas.solidAt('spider_den', -1, 3), true);
  assert.equal(atlas.knows('over'), true);
  assert.equal(atlas.knows('spider_den'), true);
  assert.equal(atlas.knows('house'), false);
  assert.equal(atlas.knows('house:ben'), false);
  assert.equal(atlas.knows('nowhere'), false);
  assert.equal(isHouse('house:ben'), true);
  assert.equal(isHouse('housey'), false);
  assert.equal(atlas.speedMax, 430);   // a machine's FULL STEAM run
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
  assert.equal(vm.runInContext('MAP_W + "x" + MAP_H', g), W + 'x' + H);   // atlas.json's size is the game's
  let zones = 0, solids = 0;
  for (let ty = -1; ty <= H; ty++) for (let tx = -1; tx <= W; tx++) {
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
  const [wx, wy] = port('camp.walker');
  assert.equal(A.inside('goblin_camp', { x: wx * TILE + 5, y: wy * TILE + 5 }), true);
  const [qx, qy] = port('hollowford.square');
  assert.equal(A.inside('hollowford', { x: qx * TILE, y: qy * TILE }), true);   // the square is an area of Hollowford
  assert.equal(A.inside('fang_lair', { x: wx * TILE, y: wy * TILE }), false);
});
