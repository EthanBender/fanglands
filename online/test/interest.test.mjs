// Interest (docs/ONLINE.md, "The shared world", Stage 2): which of a world-run map's monsters each knight is sent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Interest, ENTER, LEAVE, TILE, MAX_ROWS } from '../src/sim/interest.js';

const row = (nid, x, y, tgt) => { const r = [nid, 'goblin', x, y, 12, 12, 'idle', 1, 0, 0, 0, 0, 0, 0]; if (tgt !== undefined) r.push(tgt); return r; };
const ids = list => list.map(r => r[0]);

test('a knight is sent the monsters within 24 tiles of him, and nothing past that he has not seen', () => {
  const v = new Interest();
  assert.equal(ENTER, 24 * TILE); assert.equal(LEAVE, 27 * TILE);
  const rows = [row('a', 100 + ENTER - 1, 100), row('b', 100 + ENTER + 1, 100), row('c', 100, 100 + 26 * TILE), row('d', 100, 100)];
  assert.deepEqual(ids(v.filter('Ben', 100, 100, rows)), ['a', 'd']);
});

test('one he was sent stays until it is past 27 tiles (no blinking on the edge), and comes back only inside 24 again', () => {
  const v = new Interest();
  assert.deepEqual(ids(v.filter('Ben', 0, 0, [row('g', 23 * TILE, 0)])), ['g']);
  assert.deepEqual(ids(v.filter('Ben', 0, 0, [row('g', 25 * TILE, 0)])), ['g'], 'kept at 25 tiles');
  assert.deepEqual(ids(v.filter('Ben', 0, 0, [row('g', 27 * TILE, 0)])), ['g'], 'kept at exactly 27 tiles');
  assert.deepEqual(ids(v.filter('Ben', 0, 0, [row('g', 27 * TILE + 1, 0)])), [], 'gone past 27');
  assert.deepEqual(ids(v.filter('Ben', 0, 0, [row('g', 25 * TILE, 0)])), [], 'and not back at 25: it must come inside 24');
  assert.deepEqual(ids(v.filter('Ben', 0, 0, [row('g', 24 * TILE, 0)])), ['g']);
  // a monster that was not in the last list starts from 24 again (one left out of a tick, e.g. dead and gone)
  v.filter('Ben', 0, 0, []);
  assert.deepEqual(ids(v.filter('Ben', 0, 0, [row('g', 25 * TILE, 0)])), []);
});

test('a monster whose target is him is always sent, however far; another knight\'s target is not', () => {
  const v = new Interest();
  assert.deepEqual(ids(v.filter('Ben', 0, 0, [row('x', 60 * TILE, 0, 'Ben'), row('y', 60 * TILE, 0, 'Ann'), row('z', 60 * TILE, 0, null)])), ['x']);
});

test('two knights have their own views; a knight with no position is sent only his targets; a reset forgets', () => {
  const a = new Interest(), b = new Interest();
  const rows = [row('near-a', 0, 0), row('near-b', 100 * TILE, 0)];
  assert.deepEqual(ids(a.filter('Ann', 0, 0, rows)), ['near-a']);
  assert.deepEqual(ids(b.filter('Ben', 100 * TILE, 0, rows)), ['near-b']);
  assert.deepEqual(ids(new Interest().filter('Cy', null, null, [row('t', 5, 5, 'Cy'), row('u', 5, 5)])), ['t']);
  a.filter('Ann', 0, 0, [row('g', 23 * TILE, 0)]); a.reset();
  assert.deepEqual(ids(a.filter('Ann', 0, 0, [row('g', 25 * TILE, 0)])), []);
});

test('at most 400 rows in one list, and junk rows are skipped', () => {
  const v = new Interest();
  const rows = Array.from({ length: 500 }, (_, i) => row('m' + i, i % 10, 0));
  assert.equal(v.filter('Ben', 0, 0, [null, 'x', ...rows]).length, MAX_ROWS);
});
