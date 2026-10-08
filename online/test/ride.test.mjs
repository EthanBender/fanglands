// Riding together (docs/ONLINE.md, "Riding together"): the world checks every ride a presence names (the same map, a driver
// driving a machine with that seat, the seat nobody else's, within reach), relays a real one as its own { d, s } and takes
// anything else off with a ride_no to the rider; a driver who stops driving, falls, goes into a place or leaves sets every
// rider down with ride_end; the movement check judges a rider at the machine's speed. The Room with in-memory sockets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../src/room.js';
import { MemoryStore } from '../src/store.js';
import { RIDE_SEATS, HOP_REACH, RIDE_REACH, RIDE_NO_EVERY, RIDE_ENDS, DRIVE_TOP, machineOf } from '../src/ride.js';
import { MoveBook } from '../src/move.js';
import { readAtlas } from '../src/atlas.js';
import fs from 'node:fs';

function world(opts = {}) {
  const w = { t: 1000 };
  w.store = new MemoryStore();
  w.book = new MoveBook(null, () => w.t);
  w.room = new Room(Object.assign({ now: () => w.t, wake: () => { }, store: w.store, moveBook: w.book }, opts));
  w.sock = () => {
    const s = { got: [], closed: null, send(str) { s.got.push(JSON.parse(str)); }, close(code) { s.closed = code; }, attach() { } };
    s.of = t => s.got.filter(m => m.t === t);
    s.last = t => { const l = s.of(t); return l[l.length - 1]; };
    s.clear = () => { s.got.length = 0; };
    return s;
  };
  w.say = (s, m) => w.room.message(s, JSON.stringify(m));
  w.knight = (name, x = 500, y = 500, extra) => {
    const s = w.sock(); w.room.join(s, name); w.say(s, { t: 'hello', v: 1, atlas: opts.atlas ? opts.atlas.hash : undefined });
    w.say(s, Object.assign({ t: 'p', map: 'over', x, y, lv: 3, dead: false, mech: null }, extra || {}));
    return s;
  };
  w.p = (s, extra) => { w.t += 130; w.say(s, Object.assign({ t: 'p', map: 'over', lv: 3, dead: false, mech: null }, extra)); };
  return w;
}
const DOZER = { kind: 'dozer', hp: 110, maxHp: 110 }, WALKER = { hp: 130, maxHp: 130 }, BEAST = { kind: 'beast', hp: 300, maxHp: 300 }, HORSE = { kind: 'horse', hp: 60, maxHp: 60 };
// the rider's presence as the others hear it
const heard = (s, n) => { const l = s.of('p').filter(m => m.n === n); return l[l.length - 1]; };

test('the seats: the walker 1, the bulldozer 2, the Barrelbeast 2, the mare none; a mech with no kind is the walker', () => {
  assert.deepEqual({ ...RIDE_SEATS }, { walker: 1, dozer: 2, beast: 2 });
  assert.equal(machineOf(WALKER), 'walker'); assert.equal(machineOf(DOZER), 'dozer'); assert.equal(machineOf(BEAST), 'beast');
  assert.equal(machineOf(HORSE), 'other'); assert.equal(machineOf({ kind: 'zeppelin' }), 'other'); assert.equal(machineOf(null), null);
});

test('a real ride is relayed as the world spells it, and a third knight sees it; the driver hears it too', () => {
  const w = world();
  const mud = w.knight('Mudtech', 500, 500, { mech: DOZER }), ben = w.knight('Ben', 560, 500), ann = w.knight('Ann', 700, 500);
  ann.clear(); mud.clear();
  w.p(ben, { x: 470, y: 480, ride: { d: 'mudtech', s: 1 } });
  assert.deepEqual(heard(ann, 'Ben').ride, { d: 'Mudtech', s: 1 });
  assert.deepEqual(heard(mud, 'Ben').ride, { d: 'Mudtech', s: 1 });
  assert.equal(ben.of('ride_no').length, 0);
  assert.deepEqual(w.room.rides.ridersOf(w.room.byName.get('mudtech')), [{ s: 1, n: 'Ben' }]);
  // he hops off: the seat is free again and nothing more is said
  w.p(ben, { x: 560, y: 500 });
  assert.equal(heard(ann, 'Ben').ride, undefined);
  assert.deepEqual(w.room.rides.ridersOf(w.room.byName.get('mudtech')), []);
});

test('every ride the world refuses: taken off the relayed presence, and the rider is told why (at most once a second)', () => {
  const w = world();
  const mud = w.knight('Mudtech', 500, 500, { mech: WALKER }), ben = w.knight('Ben', 540, 500), ann = w.knight('Ann', 560, 500);
  const zed = w.knight('Zed', 520, 500, { map: 'cave1' }), cid = w.knight('Cid', 530, 500, { mech: HORSE }), far = w.knight('Far', 500 + HOP_REACH + 10, 500);
  const no = s => s.last('ride_no');
  const tryRide = (s, ride, x = 540, y = 500, extra) => { w.t += RIDE_NO_EVERY; s.clear(); ann.clear(); w.say(s, Object.assign({ t: 'p', map: 'over', x, y, dead: false, mech: null, ride }, extra || {})); };
  tryRide(ben, { d: 'Nobody', s: 1 }); assert.deepEqual(no(ben), { t: 'ride_no', d: 'Nobody', code: 'gone' }); assert.equal(heard(ann, 'Ben').ride, undefined);
  tryRide(ben, { d: 'Zed', s: 1 }); assert.equal(no(ben).code, 'gone');
  tryRide(ben, { d: 'Ben', s: 1 }); assert.equal(no(ben).code, 'self');
  tryRide(ben, { d: 'Cid', s: 1 }); assert.deepEqual(no(ben), { t: 'ride_no', d: 'Cid', code: 'off' });            // the mare has no seats
  tryRide(ben, { d: 'Mudtech', s: 2 }); assert.equal(no(ben).code, 'seat');                                         // the walker has one
  tryRide(ben, { d: 'Mudtech', s: 0 }); assert.equal(no(ben).code, 'seat');
  tryRide(ben, { d: 'Mudtech', s: '1' }); assert.equal(no(ben).code, 'seat');
  tryRide(far, { d: 'Mudtech', s: 1 }, 500 + HOP_REACH + 10, 500); assert.equal(no(far).code, 'far');
  tryRide(cid, { d: 'Mudtech', s: 1 }, 530, 500, { mech: HORSE }); assert.equal(no(cid).code, 'self');              // a knight on a mount drives his own
  // Ben takes the walker's one seat; Ann's ask for it is 'full'
  tryRide(ben, { d: 'Mudtech', s: 1 }); assert.equal(ben.of('ride_no').length, 0);
  tryRide(ann, { d: 'Mudtech', s: 1 }, 560, 500); assert.deepEqual(no(ann), { t: 'ride_no', d: 'Mudtech', code: 'full' });
  // twice in one second: said once
  ann.clear(); w.say(ann, { t: 'p', map: 'over', x: 560, y: 500, mech: null, ride: { d: 'Mudtech', s: 1 } }); w.say(ann, { t: 'p', map: 'over', x: 560, y: 500, mech: null, ride: { d: 'Mudtech', s: 1 } });
  assert.equal(ann.of('ride_no').length, 0);
  // junk in the field is no ride at all (nothing said, nothing relayed)
  w.t += RIDE_NO_EVERY; ann.clear(); mud.clear(); w.say(ann, { t: 'p', map: 'over', x: 560, y: 500, ride: 'Mudtech seat 1' });
  assert.equal(ann.of('ride_no').length, 0); assert.equal(heard(mud, 'Ann').ride, undefined);
  void zed;
});

test('the bulldozer\'s two seats: one each; a seat already taken while the other is free is "taken", both taken is "full"', () => {
  const w = world();
  const mud = w.knight('Mudtech', 500, 500, { mech: DOZER }), ben = w.knight('Ben', 540, 500), ann = w.knight('Ann', 460, 500), cy = w.knight('Cy', 500, 540);
  w.p(ben, { x: 540, y: 500, ride: { d: 'Mudtech', s: 1 } });
  w.p(ann, { x: 460, y: 500, ride: { d: 'Mudtech', s: 1 } });
  assert.equal(ann.last('ride_no').code, 'taken');
  w.t += RIDE_NO_EVERY; w.p(ann, { x: 460, y: 500, ride: { d: 'Mudtech', s: 2 } });
  assert.deepEqual(heard(mud, 'Ann').ride, { d: 'Mudtech', s: 2 });
  w.p(cy, { x: 500, y: 540, ride: { d: 'Mudtech', s: 2 } });
  assert.equal(cy.last('ride_no').code, 'full');
  assert.deepEqual(w.room.rides.ridersOf(w.room.byName.get('mudtech')), [{ s: 1, n: 'Ben' }, { s: 2, n: 'Ann' }]);
});

test('riders stay on within the riding reach as the machine moves, and are refused past it', () => {
  const w = world();
  const mud = w.knight('Mudtech', 500, 500, { mech: BEAST }), ben = w.knight('Ben', 520, 500);
  w.p(ben, { x: 520, y: 500, ride: { d: 'Mudtech', s: 2 } });
  // the machine runs on; the rider's place lags a little behind it
  w.p(mud, { x: 500 + HOP_REACH + 40, y: 500, mech: BEAST });
  w.p(ben, { x: 520 + HOP_REACH, y: 500, ride: { d: 'Mudtech', s: 2 } });
  assert.equal(ben.of('ride_no').length, 0);
  w.p(mud, { x: 500 + RIDE_REACH + 300, y: 500, mech: BEAST });
  w.p(ben, { x: 520 + HOP_REACH, y: 500, ride: { d: 'Mudtech', s: 2 } });
  assert.equal(ben.last('ride_no').code, 'far');
  void mud;
});

test('the driver stops driving: every rider is set down with ride_end (out of the machine, a fall, into a place, leaving)', () => {
  const cases = [
    ['off', (w, mud) => w.p(mud, { x: 500, y: 500, mech: null })],
    ['off', (w, mud) => w.p(mud, { x: 500, y: 500, mech: HORSE })],
    ['fell', (w, mud) => w.p(mud, { x: 500, y: 500, mech: null, dead: true })],
    ['inside', (w, mud) => w.p(mud, { map: 'deepholm', x: 500, y: 500, mech: DOZER })],
    ['left', (w, mud) => w.room.leave(mud)],
  ];
  for (const [why, act] of cases) {
    const w = world();
    const mud = w.knight('Mudtech', 500, 500, { mech: DOZER }), ben = w.knight('Ben', 540, 500), ann = w.knight('Ann', 460, 500);
    w.p(ben, { x: 540, y: 500, ride: { d: 'Mudtech', s: 1 } }); w.p(ann, { x: 460, y: 500, ride: { d: 'Mudtech', s: 2 } });
    ben.clear(); ann.clear();
    act(w, mud);
    assert.deepEqual(ben.last('ride_end'), { t: 'ride_end', d: 'Mudtech', why }, why);
    assert.deepEqual(ann.last('ride_end'), { t: 'ride_end', d: 'Mudtech', why }, why);
    assert.equal(w.room.byName.get('ben').ride, null);
    // the riders hear why before the map's 'left' (their games say "went inside", not "left")
    if (why === 'inside') { const i = ben.got.findIndex(m => m.t === 'ride_end'), j = ben.got.findIndex(m => m.t === 'left' && m.n === 'Mudtech'); assert.ok(i >= 0 && j > i, 'ride_end before left'); }
    // a late presence still naming the ride is refused, and seen standing
    w.t += RIDE_NO_EVERY; ann.clear(); w.p(ben, { x: 540, y: 500, ride: { d: 'Mudtech', s: 1 } });
    assert.ok(ben.last('ride_no'), why);
    assert.equal(heard(ann, 'Ben').ride, undefined);
  }
});

test('a rider who disconnects just leaves his seat: the driver keeps driving, and the seat is free for the next friend', () => {
  const w = world();
  const mud = w.knight('Mudtech', 500, 500, { mech: WALKER }), ben = w.knight('Ben', 540, 500), ann = w.knight('Ann', 460, 500);
  w.p(ben, { x: 540, y: 500, ride: { d: 'Mudtech', s: 1 } });
  mud.clear();
  w.room.leave(ben);
  assert.equal(mud.of('ride_end').length, 0);
  assert.deepEqual(mud.last('left'), { t: 'left', n: 'Ben', map: 'over' });
  w.p(ann, { x: 460, y: 500, ride: { d: 'Mudtech', s: 1 } });
  assert.equal(ann.of('ride_no').length, 0);
});

test('after a wake the world has not heard the driver yet: his riders are not tipped off; the seats still hold', () => {
  const w = world();
  const mud = w.sock(), ben = w.sock();
  w.room.restore(mud, { name: 'Mudtech', since: 900, hello: true, map: 'over', mapAt: 900 });
  w.room.restore(ben, { name: 'Ben', since: 950, hello: true, map: 'over', mapAt: 950 });
  w.p(ben, { x: 540, y: 500, ride: { d: 'Mudtech', s: 1 } });
  assert.equal(ben.of('ride_no').length, 0);
  w.p(mud, { x: 500, y: 500, mech: DOZER });
  assert.equal(ben.of('ride_end').length, 0);
});

test('the movement check judges a rider at the machine\'s speed (Full Steam), and an honest rider counts nothing', () => {
  const json = JSON.parse(fs.readFileSync(new URL('../src/atlas.json', import.meta.url), 'utf8'));
  const atlas = readAtlas(json);
  const w = world({ atlas });
  // open ground the Atlas knows: a row with no FIXED_SOLID tile for 40 tiles
  let row = null;
  for (let ty = 20; ty < atlas.MAP_H - 20 && !row; ty++) for (let tx = 20; tx < atlas.MAP_W - 60 && !row; tx++) { let ok = true; for (let i = 0; i < 40 && ok; i++) if (atlas.solidAt('over', tx + i, ty)) ok = false; if (ok) row = [tx, ty]; }
  const T = atlas.TILE, x0 = row[0] * T + 24, y = row[1] * T + 24;
  const mud = w.knight('Mudtech', x0, y, { mech: DOZER, spd: 430 }), ben = w.knight('Ben', x0 + 30, y, { spd: 175 });
  w.p(ben, { x: x0 + 30, y, spd: 175, ride: { d: 'Mudtech', s: 1 } });
  const before = Object.assign({}, w.book.view().today);
  // the machine barrels on at 430 px/s; the rider says his own speed is a walker's (an older game would)
  for (let i = 1; i <= 20; i++) { w.p(mud, { x: x0 + i * 54, y, mech: DOZER, spd: 430 }); w.say(ben, { t: 'p', map: 'over', x: x0 + 30 + i * 54, y, mech: null, dead: false, spd: 175, ride: { d: 'Mudtech', s: 1 } }); }
  const after = w.book.view().today;
  assert.equal(after.speed - before.speed, 0);
  assert.ok(after.checked - before.checked >= 20);
  // the same path walked by a knight who rides nobody's machine is counted as too fast (the check is awake)
  const cy = w.knight('Cy', x0, y + T, { spd: 175 });
  for (let i = 1; i <= 20; i++) w.p(cy, { x: x0 + i * 54, y: y + T, spd: 175 });
  assert.ok(w.book.view().today.speed - after.speed >= 1);
});

test('a machine that breaks under its driver: his presence says wk, and his riders hear why "wreck" (no wk: "off")', () => {
  assert.ok(RIDE_ENDS.includes('wreck') && RIDE_ENDS.includes('jump'));
  for (const [wk, why] of [[1, 'wreck'], [undefined, 'off']]) {
    const w = world();
    const mud = w.knight('Mudtech', 500, 500, { mech: DOZER, j: 3 }), ben = w.knight('Ben', 540, 500);
    w.p(ben, { x: 540, y: 500, ride: { d: 'Mudtech', s: 1 } });
    w.p(mud, { x: 500, y: 500, mech: DOZER, j: 3 });
    ben.clear();
    // the wreck steps him back a tile (his j goes up): still "wreck", never "jump"
    w.p(mud, { x: 452, y: 500, mech: null, j: 4, wk });
    assert.deepEqual(ben.last('ride_end'), { t: 'ride_end', d: 'Mudtech', why }, String(wk));
    assert.equal(ben.of('ride_end').length, 1);
  }
});

// a driver carrying Ben, driven by `path` (one presence per step); returns what Ben heard
function drive(path, opts = {}) {
  const w = world();
  if (opts.move) w.room.setSim({ move: opts.move });
  const mud = w.knight('Mudtech', 500, 500, { mech: DOZER, j: 7 }), ben = w.knight('Ben', 540, 500);
  w.p(ben, { x: 540, y: 500, ride: { d: 'Mudtech', s: 1 } });
  w.p(mud, { x: 500, y: 500, mech: DOZER, j: 7 });
  ben.clear();
  let n = 0;
  for (const st of path) {
    w.t += st.dt === undefined ? 125 : st.dt;
    w.say(mud, { t: 'p', map: 'over', lv: 3, dead: false, mech: DOZER, x: st.x, y: st.y, j: st.j === undefined ? 7 : st.j, spd: 205 });
    n++;
    if (ben.of('ride_end').length) break;
  }
  return { end: ben.last('ride_end'), steps: n, seats: w.room.rides.ridersOf(w.room.byName.get('mudtech')).length };
}
test('a driver who jumps carries nobody: a teleport, a j that changes, a path faster than any machine; whatever the move check says', () => {
  for (const move of ['observe', 'off']) {
    // one big jump (player.x set by hand): at once
    let r = drive([{ x: 5781, y: 500 }], { move });
    assert.deepEqual(r.end, { t: 'ride_end', d: 'Mudtech', why: 'jump' }, move + ' teleport');
    assert.equal(r.seats, 0);
    // a jump the driver's game counted (j), however short
    r = drive([{ x: 510, y: 500 }, { x: 560, y: 500, j: 8 }], { move });
    assert.equal(r.end && r.end.why, 'jump', move + ' j');
    // 1200 px/s in a straight line (through anything): set down within half a second
    const fast = []; for (let i = 1; i <= 40; i++) fast.push({ x: 500 + i * 150, y: 500 });
    r = drive(fast, { move });
    assert.equal(r.end && r.end.why, 'jump', move + ' fast');
    assert.ok(r.steps <= 4, 'within 4 presences (0.5 s): ' + r.steps);
  }
});
test('an honest driver keeps his riders: Full Steam for 3 s, a stalled line that lets go in one burst, a lagging line', () => {
  // Full Steam: DRIVE_TOP px/s at 8 presences a second for 3 s
  const steam = []; for (let i = 1; i <= 24; i++) steam.push({ x: 500 + i * DRIVE_TOP / 8, y: 500 });
  let r = drive(steam);
  assert.equal(r.end, undefined, 'steam'); assert.equal(r.seats, 1);
  // 250 px/s; the line stalls 2 s, then 16 presences arrive at once, then on as before
  const stall = []; let x = 500;
  for (let i = 0; i < 8; i++) stall.push({ x: x += 31.25, y: 500 });
  stall.push({ x: x += 31.25, y: 500, dt: 2000 });
  for (let i = 0; i < 15; i++) stall.push({ x: x += 31.25, y: 500, dt: 0 });
  for (let i = 0; i < 24; i++) stall.push({ x: x += 31.25, y: 500 });
  r = drive(stall);
  assert.equal(r.end, undefined, 'stall'); assert.equal(r.seats, 1);
  // presences that come uneven (75 ms, 175 ms, ...) at 250 px/s
  const uneven = []; x = 500; let t = 0;
  for (let i = 0; i < 40; i++) { const dt = i % 2 ? 175 : 75; t += dt; uneven.push({ x: 500 + t * 0.25, y: 500, dt }); }
  r = drive(uneven);
  assert.equal(r.end, undefined, 'uneven'); assert.equal(r.seats, 1);
});
