// The movement check, watching only (online/src/move.js; docs/ONLINE.md, "The shared world", Stage 1). The real Atlas
// (online/src/atlas.json), knights as the Room keeps them, a clock we drive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { readAtlas } from '../src/atlas.js';
import { MoveCheck, MoveBook, MIN_GAP, LOG_PER_DAY, MOVE_DAY_SCHEMA, MOVE_LOG_SCHEMA, CROSS_MAX } from '../src/move.js';
import { Room } from '../src/room.js';
import { ATLAS_FILE } from '../../tools/atlas.mjs';

const atlas = readAtlas(JSON.parse(fs.readFileSync(ATLAS_FILE, 'utf8')));
const TILE = 48, mid = t => t * TILE + TILE / 2;

// a knight on the overworld with this world's Atlas, and a check whose counts stay in memory
function rig(opts = {}) {
  const r = { t: Date.parse('2026-10-03T15:00:00Z'), j: 0 };
  r.book = new MoveBook(null, () => r.t);
  r.check = new MoveCheck({ atlas, book: r.book, mode: opts.mode || 'observe' });
  r.k = { name: 'Ann', lc: 'ann', map: opts.map || 'over', atlas: opts.atlas === undefined ? atlas.hash : opts.atlas };
  // one presence at (x, y) px, `ms` after the last; extra fields ride along
  r.at = (x, y, ms = 125, extra = {}) => { r.t += ms; return r.check.judge(r.k, Object.assign({ x, y, j: r.j, spd: 175, dead: false }, extra), r.t); };
  r.counts = () => { r.book.flush(); return r.book.view().today; };
  return r;
}
// open ground: a tile with no FIXED_SOLID within `pad` tiles
function openTile(fromX, fromY, pad = 3) {
  for (let ty = fromY; ty < 170; ty++) for (let tx = fromX; tx < 250; tx++) {
    let ok = true; for (let dy = -pad; dy <= pad && ok; dy++) for (let dx = -pad; dx <= pad && ok; dx++) if (atlas.solidAt('over', tx + dx, ty + dy)) ok = false;
    if (ok) return [tx, ty];
  }
  throw new Error('no open ground');
}
// a FIXED_SOLID tile one thick between open tiles above and below (a wall to walk through)
function thinWall() {
  for (let ty = 2; ty < 170; ty++) for (let tx = 2; tx < 250; tx++) if (atlas.solidAt('over', tx, ty) && !atlas.solidAt('over', tx, ty - 1) && !atlas.solidAt('over', tx, ty + 1) && !atlas.solidAt('over', tx - 1, ty - 1) && !atlas.solidAt('over', tx + 1, ty + 1)) return [tx, ty];
  throw new Error('no thin wall');
}
// a FIXED_SOLID tile with all eight neighbours open (a corner to walk round)
function loneWall() {
  for (let ty = 2; ty < 170; ty++) for (let tx = 2; tx < 250; tx++) {
    if (!atlas.solidAt('over', tx, ty)) continue;
    let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && atlas.solidAt('over', tx + dx, ty + dy)) n++;
    if (!n) return [tx, ty];
  }
  return null;
}

test('walking at 175 px/s, 8 presences a second, for 20 seconds: nothing counted; every step checked', () => {
  const r = rig(); const [tx, ty] = openTile(40, 20, 4);
  let x = mid(tx) - 60, out = [];
  r.at(x, mid(ty));
  for (let i = 0; i < 160; i++) { x += i % 40 < 20 ? 175 / 8 : -175 / 8; out.push(r.at(x, mid(ty))); }
  assert.ok(out.every(o => o.ok), JSON.stringify(out.find(o => !o.ok)));
  const c = r.counts();
  assert.equal(c.checked, 160); assert.equal(c.speed, 0); assert.equal(c.wall, 0); assert.equal(c.skipped, 1);
});

test('the speed window with mounts: the horse at 350 (spd 350) passes; the same path with spd 175 is too fast once a second; a claimed spd over the fastest mover is cut to it', () => {
  const [tx, ty] = openTile(40, 60, 6);
  const run = (spd, step, n) => { const r = rig(); let x = mid(tx) - 200; r.at(x, mid(ty), 125, { spd }); const out = []; for (let i = 0; i < n; i++) { x += i % 16 < 8 ? step : -step; out.push(r.at(x, mid(ty), 125, { spd })); } return { out, c: r.counts(), r }; };
  const horse = run(350, 350 / 8, 32);
  assert.equal(horse.c.speed, 0);
  const lie = run(175, 350 / 8, 32);
  assert.ok(lie.c.speed >= 3 && lie.c.speed <= 5, 'about once a second for 4 s: ' + lie.c.speed);
  assert.equal(lie.r.book.view().recent[0].kind, 'speed');
  assert.match(lie.r.book.view().recent[0].detail, /px in .* s, \d+ allowed/);
  const big = run(100000, 1000 / 8, 16);     // 1,000 px/s claiming any speed it likes: judged at FULL STEAM's 430 at most
  assert.ok(big.c.speed >= 1);
  // the dozer at 250 (spd 250) and hover armour at 200 (spd 200)
  assert.equal(run(250, 250 / 8, 32).c.speed, 0);
  assert.equal(run(200, 200 / 8, 32).c.speed, 0);
});

test('FIXED_SOLID: a step straight through a wall counts, a step into one counts, walking round a lone wall at horse speed never does', () => {
  const [wx, wy] = thinWall();
  const r = rig();
  r.at(mid(wx), mid(wy - 1), 125, { spd: 350 });
  const through = r.at(mid(wx), mid(wy + 1), 125, { spd: 350 });
  assert.deepEqual([through.kind, r.book.view().recent[0].detail], ['wall', 'through']);
  const r2 = rig();
  r2.at(mid(wx), mid(wy - 1));
  const into = r2.at(mid(wx), mid(wy) - 4);
  assert.deepEqual([into.kind, r2.book.view().recent[0].detail], ['wall', 'in']);
  // off the map's edge is a wall too
  const r3 = rig(); r3.at(10, mid(30)); assert.equal(r3.at(-12, mid(30)).kind, 'wall');
  // round a lone wall tile, 14 px off its sides (the knight is 13 px), in 44 px steps: chords cut its corners, never its middle
  const lone = loneWall();
  assert.ok(lone, "a lone wall tile to walk round"); {
    const [lx, ly] = lone, x0 = lx * TILE - 14, y0 = ly * TILE - 14, x1 = (lx + 1) * TILE + 14, y1 = (ly + 1) * TILE + 14;
    const pts = []; const per = 2 * (x1 - x0) + 2 * (y1 - y0);
    for (let d = 0; d <= per * 2; d += 44) { const q = d % per; pts.push(q < x1 - x0 ? [x0 + q, y0] : q < x1 - x0 + y1 - y0 ? [x1, y0 + q - (x1 - x0)] : q < 2 * (x1 - x0) + y1 - y0 ? [x1 - (q - (x1 - x0) - (y1 - y0)), y1] : [x0, y1 - (q - 2 * (x1 - x0) - (y1 - y0))]); }
    const r4 = rig(); r4.at(pts[0][0], pts[0][1], 125, { spd: 350 });
    for (const [x, y] of pts.slice(1)) r4.at(x, y, 125, { spd: 350 });
    assert.equal(r4.counts().wall, 0);
  }
});

test('a jump (j went up) waives that step, wherever it goes, but not a landing in a wall; more than 6 jumps in 10 s is logged once', () => {
  const [tx, ty] = openTile(40, 20, 4), [fx, fy] = openTile(150, 100, 4), [wx, wy] = thinWall();
  const r = rig();
  r.at(mid(tx), mid(ty));
  r.j++; assert.ok(r.at(mid(fx), mid(fy)).ok);                         // across the world in one step
  r.j++; assert.equal(r.at(mid(wx), mid(wy)).kind, 'wall');            // a jump into a wall still counts
  let c = r.counts(); assert.equal(c.waived, 2); assert.equal(c.speed, 0); assert.equal(c.wall, 1);
  r.at(mid(tx), mid(ty));
  for (let i = 0; i < 7; i++) { r.j++; r.at(mid(i % 2 ? tx : fx), mid(i % 2 ? ty : fy), 1000); }
  c = r.counts();
  assert.equal(c.jumps, 1); assert.equal(c.speed, 0);
  assert.equal(r.book.view().recent[0].kind, 'jumps');
});

test('a slow frame or a stalled line never counts: a second of presences arriving at once, a 2 s hitch, a 50 ms frame', () => {
  const [tx, ty] = openTile(40, 20, 6);
  const r = rig(); let x = mid(tx) - 150;
  r.at(x, mid(ty));
  for (let i = 0; i < 4; i++) { x += 175 / 8; r.at(x, mid(ty)); }
  for (let i = 0; i < 16; i++) { x += 175 / 8; r.at(x, mid(ty), 0); }   // two seconds of walking, handed over in the same instant
  r.at(x + 3 * 175 * 0.05, mid(ty), 2000);                                // a hitch, then the longest step a 50 ms frame allows
  for (let i = 0; i < 8; i++) { x -= 175 / 8; r.at(x, mid(ty), 125); }
  const c = r.counts(); assert.equal(c.speed, 0); assert.equal(c.wall, 0);
  assert.ok(MIN_GAP === 125);
});

test('not judged: another Atlas or none (counted old), the island, an unknown map, a death and the respawn after it, the first step; off judges and counts nothing', () => {
  const [tx, ty] = openTile(40, 20, 4), [fx, fy] = openTile(150, 100, 4);
  const old = rig({ atlas: 'f00' }); old.at(mid(tx), mid(ty)); old.at(mid(fx), mid(fy));
  let c = old.counts(); assert.deepEqual([c.checked, c.skipped, c.old], [0, 2, 2]);
  const none = rig({ atlas: null }); none.at(1, 1); assert.equal(none.counts().old, 1);
  const house = rig({ map: 'house:ann' }); house.at(5, 5); house.at(5000, 5); assert.deepEqual([house.counts().checked, house.counts().skipped], [0, 2]);
  const nowhere = rig({ map: 'nowhere' }); nowhere.at(5, 5); assert.equal(nowhere.counts().checked, 0);
  const r = rig(); r.at(mid(tx), mid(ty)); r.at(mid(tx), mid(ty), 125, { dead: true }); r.at(mid(fx), mid(fy)); r.at(mid(fx) + 10, mid(fy));
  c = r.counts(); assert.deepEqual([c.checked, c.speed, c.skipped], [1, 0, 3]);
  const off = rig({ mode: 'off' }); off.at(mid(tx), mid(ty)); assert.equal(off.at(-500, -500), null);
  c = off.counts(); assert.deepEqual([c.checked, c.skipped, c.wall], [0, 0, 0]);
  // a map change starts again
  const m = rig(); m.at(mid(tx), mid(ty)); m.k.map = 'spider_den'; assert.ok(m.at(mid(3), mid(3)).skip);
});

test('the counts and the violations go to the tables: one upsert per day, at most 200 rows a day, the view newest first', () => {
  const db = new DatabaseSync(':memory:');
  const sql = { exec(q, ...a) { const st = db.prepare(q); const cols = st.columns().map(c => c.name); const rows = cols.length ? st.all(...a).map(r => Object.assign({}, r)) : (st.run(...a), []); return { toArray: () => rows }; } };
  let t = Date.parse('2026-10-03T15:00:00Z');
  const book = new MoveBook(sql, () => t);
  for (let i = 0; i < 250; i++) { book.count('wall'); book.log({ at: t, n: 'Ann', map: 'over', kind: 'wall', x: i, y: 2, px: 1, py: 2, ms: 125, spd: 175, detail: 'through' }); }
  book.count('checked', 3); book.flush();
  const v = book.view();
  assert.equal(v.today.wall, 250); assert.equal(v.today.checked, 3);
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS c FROM move_log').get().c), LOG_PER_DAY);
  assert.equal(v.recent.length, 30); assert.equal(v.recent[0].x, LOG_PER_DAY - 1);
  // a new book on the same table (a nap) still keeps the day's cap
  const again = new MoveBook(sql, () => t); assert.equal(again.log({ at: t, n: 'Ann', map: 'over', kind: 'wall', x: 0, y: 0, detail: '' }), false);
  // the next day: rows older than 60 days go on its first write
  db.prepare('INSERT INTO move_day (day, checked) VALUES (?, 1)').run('2026-07-01');
  t += 86400000; again.count('checked'); again.flush();
  assert.equal(Number(db.prepare("SELECT COUNT(*) AS c FROM move_day WHERE day = '2026-07-01'").get().c), 0);
  assert.ok(MOVE_DAY_SCHEMA.startsWith('CREATE TABLE IF NOT EXISTS') && MOVE_LOG_SCHEMA.startsWith('CREATE TABLE IF NOT EXISTS'));
});

test('in the Room: the check only watches. A presence through a wall is relayed unchanged and nothing at all goes back to the knight', () => {
  let now = 1000;
  const room = new Room({ now: () => now, wake: () => { }, atlas });
  const sock = () => { const s = { got: [], send(str) { s.got.push(JSON.parse(str)); }, close() { }, attach() { } }; return s; };
  const a = sock(), b = sock();
  room.join(a, 'Ann'); room.message(a, JSON.stringify({ t: 'hello', v: 1, caps: [], atlas: atlas.hash }));
  room.join(b, 'Ben'); room.message(b, JSON.stringify({ t: 'hello', v: 1 }));
  const [wx, wy] = thinWall();
  room.message(a, JSON.stringify({ t: 'p', map: 'over', x: mid(wx), y: mid(wy - 1), j: 0, spd: 175 }));
  room.message(b, JSON.stringify({ t: 'p', map: 'over', x: 5, y: 5 }));
  a.got.length = 0; b.got.length = 0; now += 125;
  const through = { t: 'p', map: 'over', x: mid(wx), y: mid(wy + 1), j: 0, spd: 175, s: 3 };
  room.message(a, JSON.stringify(through));
  assert.deepEqual(a.got, []);
  assert.deepEqual(b.got, [Object.assign({}, through, { n: 'Ann', role: 'player' })]);
  room.move.book.flush();
  assert.equal(room.move.book.view().today.wall, 1);
  // switched off from the parent page: nothing more is judged
  room.setSim({ move: 'off' }); now += 125;
  room.message(a, JSON.stringify(Object.assign({}, through, { y: mid(wy - 1) })));
  room.move.book.flush();
  assert.equal(room.move.book.view().today.wall, 1);
  assert.equal(room.sim.move, 'off');
  room.setSim({ move: 'nonsense' }); assert.equal(room.sim.move, 'observe');
});

test('a forged position far off the map is never judged or remembered, and two messages can never make the World walk a long line', () => {
  const [tx, ty] = openTile(40, 20, 4);
  // count every tile the check looks at
  let calls = 0; const spy = Object.create(atlas); spy.solidAt = (...a) => { calls++; return atlas.solidAt(...a); };
  const book = new MoveBook(null, () => Date.parse('2026-10-03T15:00:00Z'));
  const check = new MoveCheck({ atlas: spy, book, mode: 'observe' });
  const k = { name: 'Eve', lc: 'eve', map: 'over', atlas: atlas.hash };
  let t = Date.parse('2026-10-03T15:00:00Z');
  const send = (x, y, extra = {}) => { t += 125; return check.judge(k, Object.assign({ x, y, j: 0, spd: 175, dead: false }, extra), t); };
  send(mid(tx), mid(ty));
  for (const far of [[1e12, 1e12], [-1e12, mid(ty)], [mid(tx), 9e15], [1e9, -1e9]]) {
    const off = send(far[0], far[1]);
    assert.ok(off.skip, 'far off the map is not judged: ' + far);
    calls = 0; const t0 = Date.now();
    const back = send(mid(tx), mid(ty));
    assert.ok(back.skip, 'the step back is a fresh start, not a line from the forged spot');
    assert.ok(calls < 10 && Date.now() - t0 < 50, `looked at ${calls} tiles in ${Date.now() - t0} ms`);
  }
  // a real but huge step on the map (not a jump): the line is never walked past CROSS_MAX; the speed check catches it
  const [fx, fy] = openTile(200, 140, 4);
  assert.ok(Math.hypot(mid(fx) - mid(tx), mid(fy) - mid(ty)) > CROSS_MAX);
  send(mid(tx), mid(ty)); calls = 0;
  const leap = send(mid(fx), mid(fy));
  assert.ok(calls < 10, 'looked at ' + calls + ' tiles');
  assert.equal(leap.kind, 'speed');
});
