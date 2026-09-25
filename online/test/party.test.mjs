// Drop parties: the prize roll's odds, the server's checks on a party, crackers, first-light-wins, range, maps,
// the end of a party, naps, expiry, prizes and claims, announcements and the mod log. The Room with a MemoryStore,
// in-memory sockets, a fake clock and a seeded (or scripted) random.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Room, ROSTER_EVERY } from '../src/room.js';
import { MemoryStore } from '../src/store.js';
import {
  TILE, HAT_COLOURS, PARTY_LIFE, PRIZE_KEEP, LIGHT_RANGE, FUSE_MIN, FUSE_MAX,
  rollCracker, crackerId, parseCrackerId, checkTable, checkSpots, commas,
} from '../src/party.js';

// A small, well-known seeded PRNG: the same seed gives the same million rolls every run.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const within5sd = (got, n, p) => { const mean = n * p, sd = Math.sqrt(n * p * (1 - p)); return { ok: Math.abs(got - mean) <= 5 * sd, got, mean, sd }; };

// ---------------------------------------------------------------------------
// The roll
// ---------------------------------------------------------------------------
test('rollCracker: a party hat 1 in 1,000 over 1,000,000 rolls, within five standard deviations; the colours even', () => {
  const rnd = mulberry32(20260925);
  const table = [{ id: 'coins', min: 25, max: 250, w: 1 }];
  const colours = {};
  let hats = 0;
  for (let i = 0; i < 1000000; i++) {
    const r = rollCracker(table, 1000, rnd);
    if (r.hat) { hats++; colours[r.hat] = (colours[r.hat] || 0) + 1; assert.equal(r.id, 'party_hat_' + r.hat); assert.equal(r.qty, 1); }
  }
  const c = within5sd(hats, 1000000, 1 / 1000);
  assert.ok(c.ok, JSON.stringify(c));
  for (const colour of HAT_COLOURS) { const e = within5sd(colours[colour] || 0, hats, 1 / 6); assert.ok(e.ok, colour + ' ' + JSON.stringify(e)); }
  assert.deepEqual(Object.keys(colours).sort(), HAT_COLOURS.slice().sort());
});

test('rollCracker: 1 in 10 over 100,000 rolls; the six colours even over its ten thousand hats', () => {
  const rnd = mulberry32(7);
  const colours = {};
  let hats = 0;
  for (let i = 0; i < 100000; i++) { const r = rollCracker([{ id: 'bread', min: 1, max: 1, w: 1 }], 10, rnd); if (r.hat) { hats++; colours[r.hat] = (colours[r.hat] || 0) + 1; } }
  const c = within5sd(hats, 100000, 1 / 10);
  assert.ok(c.ok, JSON.stringify(c));
  for (const colour of HAT_COLOURS) { const e = within5sd(colours[colour] || 0, hats, 1 / 6); assert.ok(e.ok, colour + ' ' + JSON.stringify(e)); }
});

test('rollCracker: row weights hold, quantities stay inside min..max and reach both ends', () => {
  const rnd = mulberry32(99);
  const table = [{ id: 'coins', min: 25, max: 250, w: 1 }, { id: 'iron_bar', min: 1, max: 5, w: 3 }, { id: 'meat_pie', min: 2, max: 2, w: 6 }];
  const count = { coins: 0, iron_bar: 0, meat_pie: 0 }, qty = { coins: new Set(), iron_bar: new Set(), meat_pie: new Set() };
  let n = 0;
  for (let i = 0; i < 200000; i++) {
    const r = rollCracker(table, 10000, rnd);
    if (r.hat) continue;
    n++; count[r.id]++; qty[r.id].add(r.qty);
    const row = table.find(x => x.id === r.id);
    assert.ok(Number.isInteger(r.qty) && r.qty >= row.min && r.qty <= row.max, JSON.stringify(r));
  }
  for (const row of table) { const e = within5sd(count[row.id], n, row.w / 10); assert.ok(e.ok, row.id + ' ' + JSON.stringify(e)); }
  assert.ok(qty.coins.has(25) && qty.coins.has(250), 'coins reach 25 and 250');
  assert.deepEqual(Array.from(qty.iron_bar).sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(qty.meat_pie), [2]);
});

test('rollCracker: the hat is rolled first (a first random() of 0 is always a hat) and rounding falls to the last row', () => {
  const seq = list => () => list.shift();
  assert.deepEqual(rollCracker([{ id: 'coins', min: 1, max: 9, w: 1 }], 10000, seq([0, 0.5])), { id: 'party_hat_green', qty: 1, hat: 'green' });
  assert.deepEqual(rollCracker([{ id: 'coins', min: 1, max: 9, w: 1 }], 10, seq([0.0999, 0.99])), { id: 'party_hat_white', qty: 1, hat: 'white' });
  assert.deepEqual(rollCracker([{ id: 'coins', min: 1, max: 9, w: 1 }], 10, seq([0.1, 0.5, 0])), { id: 'coins', qty: 1 });
  // r lands exactly on a row's edge: that row is not it, the next one is
  const t = [{ id: 'a', min: 1, max: 1, w: 1 }, { id: 'b', min: 1, max: 1, w: 1 }];
  assert.equal(rollCracker(t, 10, seq([0.5, 0.5, 0])).id, 'b');
  assert.equal(rollCracker(t, 10, seq([0.5, 0.4999, 0])).id, 'a');
  assert.equal(rollCracker(t, 10, seq([0.5, 1, 0])).id, 'b');   // a random() of 1 (never, but) still lands on a row
});

test('the checks: tables, spots and cracker ids', () => {
  assert.deepEqual(checkTable([{ id: 'coins', min: 1, max: 100000, w: 1000, extra: 'x' }]), [{ id: 'coins', min: 1, max: 100000, w: 1000 }]);
  for (const bad of [null, [], {}, Array(21).fill({ id: 'a', min: 1, max: 1, w: 1 }), [null], [{ id: 'Coins', min: 1, max: 1, w: 1 }], [{ id: 'co ins', min: 1, max: 1, w: 1 }],
    [{ id: 'x'.repeat(41), min: 1, max: 1, w: 1 }], [{ id: 'a', min: 0, max: 1, w: 1 }], [{ id: 'a', min: 2, max: 1, w: 1 }], [{ id: 'a', min: 1, max: 100001, w: 1 }],
    [{ id: 'a', min: 1, max: 1, w: 0 }], [{ id: 'a', min: 1, max: 1, w: 1001 }], [{ id: 'a', min: 1, max: 1, w: 1.5 }], [{ id: 'a', min: '1', max: 1, w: 1 }], [{ min: 1, max: 1, w: 1 }]]) {
    assert.equal(checkTable(bad), null, JSON.stringify(bad));
  }
  const five = [[10, 10], [11, 10], [12, 10], [10, 11], [11, 11]];
  assert.deepEqual(checkSpots(five, 10, 10), five);
  assert.deepEqual(checkSpots([[21, 10], [10, 21], [0, 10], [10, 0], [10, 10]], 10, 10), [[21, 10], [10, 21], [0, 10], [10, 0], [10, 10]]);   // exactly 11 tiles is in
  for (const bad of [null, five.slice(0, 4), Array.from({ length: 51 }, (_, i) => [i % 10 + 5, Math.floor(i / 10) + 5]), [...five.slice(0, 4), [10, 10]], [...five.slice(0, 4), [22, 10]],
    [...five.slice(0, 4), [18, 18]], [...five.slice(0, 4), [10.5, 10]], [...five.slice(0, 4), [-1, 10]], [...five.slice(0, 4), [1024, 10]], [...five.slice(0, 4), [10, 10, 1]], [...five.slice(0, 4), '10,10']]) {
    assert.equal(checkSpots(bad, 10, 10), null, JSON.stringify(bad));
  }
  assert.equal(crackerId(12, 3), 'p12.3');
  assert.deepEqual(parseCrackerId('p12.3'), { pid: 12, k: 3 });
  for (const bad of ['p12', 'x12.3', 'p-1.0', 'p1.0.1', 'p1.a', '', 42, null, 'p' + '9'.repeat(30) + '.0']) assert.equal(parseCrackerId(bad), null, String(bad));
  assert.equal(commas(10000), '10,000'); assert.equal(commas(1000), '1,000'); assert.equal(commas(100), '100');
});

test('the Room\'s TILE is the game\'s', () => {
  const core = readFileSync(new URL('../../src/00-core.js', import.meta.url), 'utf8');
  assert.equal(Number(/const TILE = (\d+)/.exec(core)[1]), TILE);
});

// ---------------------------------------------------------------------------
// The Room
// ---------------------------------------------------------------------------
// A pretend world: a clock we control, a store we can look into, and a random we can script (a queue drained first).
function world(store, t0 = 1000) {
  const w = { t: t0, log: [], woke: [], queue: [] };
  const seeded = mulberry32(1);
  w.store = store || new MemoryStore();
  w.room = new Room({ now: () => w.t, log: (n, text, at) => w.log.push({ n, text, at }), wake: ms => w.woke.push(ms), store: w.store, random: () => (w.queue.length ? w.queue.shift() : seeded()) });
  w.sock = () => {
    const s = { got: [], closed: null, state: null, send(str) { s.got.push(JSON.parse(str)); }, close(code, reason) { s.closed = { code, reason }; }, attach(st) { s.state = st; } };
    s.of = t => s.got.filter(m => m.t === t);
    s.last = t => { const l = s.of(t); return l[l.length - 1]; };
    s.clear = () => { s.got.length = 0; };
    return s;
  };
  // join + hello + a first presence at pixel (x, y) on a map
  w.knight = (name, map, x = 480, y = 480, region = 'Thistledown') => {
    const s = w.sock(); w.room.join(s, name); w.room.message(s, JSON.stringify({ t: 'hello', v: 1 }));
    if (map) w.room.message(s, JSON.stringify({ t: 'p', map, x, y, lv: 3, region }));
    return s;
  };
  w.say = (s, m) => w.room.message(s, JSON.stringify(m));
  w.at = (s, x, y, map = 'over') => w.say(s, { t: 'p', map, x, y, region: 'Thistledown' });
  w.settle = (...socks) => { w.t += ROSTER_EVERY; w.room.tick(); w.woke.length = 0; for (const s of socks) s.clear(); };
  return w;
}

// MudGoll (admin) stands on tile (10, 10) of the overworld, Sam and Ada beside him, Zed down in a cave.
function scene() {
  const w = world();
  for (const n of ['Sam', 'Ada', 'Zed']) w.store.addAccount(n);
  w.store.addAccount('MudGoll', 'admin');
  const mud = w.knight('MudGoll', 'over', 10 * TILE + 24, 10 * TILE + 24); w.t += 10;
  const sam = w.knight('Sam', 'over', 10 * TILE + 24, 12 * TILE + 24); w.t += 10;
  const ada = w.knight('Ada', 'over', 11 * TILE + 24, 12 * TILE + 24); w.t += 10;
  const zed = w.knight('Zed', 'cave1', 100, 100, 'Old Cave');
  w.settle(mud, sam, ada, zed);
  return { w, mud, sam, ada, zed, all: [mud, sam, ada, zed] };
}

const SPOTS5 = [[10, 12], [11, 12], [12, 12], [10, 13], [11, 13]];
const COINS = [{ id: 'coins', min: 5, max: 5, w: 1 }];
// n distinct tiles within 11 of (10, 10), skipping the ones in `skip`
const spotsAround = (n, skip = []) => {
  const out = [];
  for (let r = 0; r <= 11 && out.length < n; r++) for (let dx = -r; dx <= r && out.length < n; dx++) for (let dy = -r; dy <= r && out.length < n; dy++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || Math.hypot(dx, dy) > 11) continue;
    const s = [10 + dx, 10 + dy];
    if (!skip.some(q => q[0] === s[0] && q[1] === s[1]) && !out.some(q => q[0] === s[0] && q[1] === s[1])) out.push(s);
  }
  return out;
};
// throws a party five seconds after the last one (the party cap is one per five seconds)
const party = (w, mud, extra) => { w.t += 5000; w.say(mud, Object.assign({ t: 'party', spots: SPOTS5, table: COINS, hat: 1000 }, extra || {})); };

test('a party: crackers to the map, the announcement to everyone on line, a mod_log row', () => {
  const { w, mud, sam, ada, zed } = scene();
  party(w, mud, { hat: 10000 });
  const c = sam.last('crackers');
  assert.deepEqual(c, { t: 'crackers', pid: 1, map: 'over', by: 'MudGoll', list: [['p1.0', 10, 12], ['p1.1', 11, 12], ['p1.2', 12, 12], ['p1.3', 10, 13], ['p1.4', 11, 13]], left: PARTY_LIFE });
  assert.deepEqual(mud.last('crackers'), c); assert.deepEqual(ada.last('crackers'), c);
  assert.equal(zed.of('crackers').length, 0);   // Zed is in a cave
  const ann = { t: 'announce', kind: 'party', n: 'MudGoll', region: 'Thistledown', map: 'over', count: 5 };
  for (const s of [mud, sam, ada, zed]) assert.deepEqual(s.last('announce'), ann);
  assert.deepEqual(w.store.modLog(1), [{ at: w.t, by: 'MudGoll', act: 'party', target: 'over', detail: '5 crackers in Thistledown, party hats 1 in 10,000' }]);
  assert.equal(mud.of('party_no').length, 0);
  const live = w.store.liveParties(w.t);
  assert.equal(live.length, 1);
  assert.deepEqual(live[0].table, COINS); assert.equal(live[0].hat, 10000); assert.equal(live[0].expires, w.t + PARTY_LIFE);
});

test('the party checks: a bad hat, spots or table is party_no bad, and nothing is made', () => {
  const { w, mud, sam } = scene();
  const bad = [
    { hat: 5 }, { hat: '1000' }, { hat: null }, { hat: 1001 },
    { spots: SPOTS5.slice(0, 4) }, { spots: spotsAround(51) }, { spots: [...SPOTS5.slice(0, 4), [10, 12]] }, { spots: [...SPOTS5.slice(0, 4), [22, 10]] },
    { spots: [...SPOTS5.slice(0, 4), [1.5, 2]] }, { spots: 'here' }, { spots: [...SPOTS5.slice(0, 4), [10, 13, 0]] },
    { table: [] }, { table: Array(21).fill(COINS[0]) }, { table: [{ id: 'Coins', min: 1, max: 1, w: 1 }] }, { table: [{ id: 'coins', min: 0, max: 1, w: 1 }] },
    { table: [{ id: 'coins', min: 5, max: 4, w: 1 }] }, { table: [{ id: 'coins', min: 1, max: 100001, w: 1 }] }, { table: [{ id: 'coins', min: 1, max: 1, w: 1001 }] }, { table: null },
  ];
  for (const b of bad) {
    mud.clear();
    party(w, mud, b);
    assert.deepEqual(mud.got, [{ t: 'party_no', code: 'bad' }], JSON.stringify(b));
  }
  assert.equal(sam.of('crackers').length + sam.of('announce').length, 0);
  assert.deepEqual(w.store.liveParties(w.t), []);
  assert.deepEqual(w.store.modLog(5), []);
  // the edges are allowed: 50 spots, 20 rows, 1 in 10
  party(w, mud, { spots: spotsAround(50), table: Array.from({ length: 20 }, (_, i) => ({ id: 'item_' + i, min: 1, max: 100000, w: 1000 })), hat: 10 });
  assert.equal(mud.last('crackers').list.length, 50);
});

test('the party checks: no position known is party_no where; the message\'s x, y is used when no presence came', () => {
  const w = world();
  w.store.addAccount('MudGoll', 'admin');
  const mud = w.sock(); w.room.join(mud, 'MudGoll'); w.say(mud, { t: 'hello', v: 1 });   // hello, and not one presence
  w.t += 5000;
  w.say(mud, { t: 'party', spots: SPOTS5, table: COINS, hat: 1000 });
  assert.deepEqual(mud.last('party_no'), { t: 'party_no', code: 'where' });
  w.t += 5000;
  w.say(mud, { t: 'party', x: 'here', y: 1, spots: SPOTS5, table: COINS, hat: 1000 });
  assert.deepEqual(mud.last('party_no'), { t: 'party_no', code: 'where' });
  w.t += 5000;
  w.say(mud, { t: 'party', x: 10 * TILE + 5, y: 10 * TILE + 40, spots: SPOTS5, table: COINS, hat: 1000 });
  assert.equal(mud.last('crackers').list.length, 5);
  // once a presence has come, the server's own position wins over what the message says
  w.say(mud, { t: 'p', map: 'over', x: 40 * TILE, y: 40 * TILE });
  w.t += 5000;
  w.say(mud, { t: 'party', x: 10 * TILE, y: 10 * TILE, spots: [[10, 20], [11, 20], [12, 20], [13, 20], [14, 20]], table: COINS, hat: 1000 });
  assert.deepEqual(mud.last('party_no'), { t: 'party_no', code: 'bad' });   // 20+ tiles from where the server knows he stands
});

test('the party checks: more than 150 unlit crackers on one map is busy; another map has its own 150', () => {
  const { w, mud, sam } = scene();
  const a = spotsAround(50), b = spotsAround(50, a), c = spotsAround(46, [...a, ...b]);
  party(w, mud, { spots: a }); party(w, mud, { spots: b }); party(w, mud, { spots: c });
  assert.equal(mud.of('crackers').length, 3);
  mud.clear();
  party(w, mud, { spots: spotsAround(5, [...a, ...b, ...c]) });   // 146 + 5 = 151
  assert.deepEqual(mud.got, [{ t: 'party_no', code: 'busy' }]);
  // light one of them: 145 + 5 = 150 is allowed
  const id = crackerId(1, 0);
  w.at(sam, a[0][0] * TILE + 24, a[0][1] * TILE + 24);
  w.say(sam, { t: 'light', id });
  assert.equal(sam.last('boom').id, id);
  party(w, mud, { spots: spotsAround(5, [...a, ...b, ...c]) });
  assert.equal(mud.last('crackers').list.length, 5);
  mud.clear();
  party(w, mud, { spots: spotsAround(5, [...a, ...b, ...c, ...spotsAround(5, [...a, ...b, ...c])]) });
  assert.deepEqual(mud.got, [{ t: 'party_no', code: 'busy' }]);
  // in the cave there is room
  w.at(mud, 10 * TILE, 10 * TILE, 'cave1');
  mud.clear();
  party(w, mud, {});
  assert.equal(mud.last('crackers').map, 'cave1');
});

test('two lights on the same cracker in the same tick: one boom to the whole map, one taken, the store says the first', () => {
  const { w, mud, sam, ada, zed } = scene();
  party(w, mud);
  for (const s of [mud, sam, ada, zed]) s.clear();
  w.say(sam, { t: 'light', id: 'p1.0', x: 504, y: 600 });
  w.say(ada, { t: 'light', id: 'p1.0', x: 504, y: 600 });
  for (const s of [mud, sam, ada]) {
    const booms = s.of('boom');
    assert.equal(booms.length, 1);
    assert.equal(booms[0].id, 'p1.0'); assert.equal(booms[0].n, 'Sam');
    assert.deepEqual(booms[0].reward, { id: 'coins', qty: 5 });
    assert.ok(booms[0].fuse >= FUSE_MIN && booms[0].fuse <= FUSE_MAX && Number.isInteger(booms[0].fuse));
  }
  assert.equal(zed.of('boom').length, 0);
  assert.deepEqual(ada.of('light_no'), [{ t: 'light_no', id: 'p1.0', code: 'taken' }]);
  assert.equal(sam.of('light_no').length, 0);
  assert.equal(w.store.partyRows.get(1).crackers[0].litBy, 'sam');
  assert.deepEqual(w.store.unclaimed('sam', 0), [{ id: 'p1.0', reward: { id: 'coins', qty: 5 } }]);
  assert.deepEqual(w.store.unclaimed('ada', 0), []);
  // and the other way round on the next cracker: Ada first wins
  w.say(ada, { t: 'light', id: 'p1.1' });
  w.say(sam, { t: 'light', id: 'p1.1' });
  assert.equal(mud.last('boom').n, 'Ada');
  assert.deepEqual(sam.last('light_no'), { t: 'light_no', id: 'p1.1', code: 'taken' });
});

test('lighting: too far (the server\'s own position counts), another map, gone, and junk ids', () => {
  const { w, mud, sam, zed } = scene();
  party(w, mud);
  // cracker p1.0 is tile (10, 12): its centre is (504, 600)
  w.at(sam, 504, 600 + LIGHT_RANGE + 1);
  w.say(sam, { t: 'light', id: 'p1.0', x: 504, y: 600 });   // the message says "right beside it"; the server knows better
  assert.deepEqual(sam.last('light_no'), { t: 'light_no', id: 'p1.0', code: 'far' });
  w.at(sam, 504, 600 + LIGHT_RANGE);
  w.say(sam, { t: 'light', id: 'p1.0' });
  assert.equal(sam.last('boom').id, 'p1.0');
  w.say(zed, { t: 'light', id: 'p1.1', x: 552, y: 600 });
  assert.deepEqual(zed.last('light_no'), { t: 'light_no', id: 'p1.1', code: 'map' });
  w.t += 1000;
  w.say(sam, { t: 'light', id: 'p9.0' });
  assert.deepEqual(sam.last('light_no'), { t: 'light_no', id: 'p9.0', code: 'gone' });
  w.say(sam, { t: 'light', id: 'p1.7' });
  assert.deepEqual(sam.last('light_no'), { t: 'light_no', id: 'p1.7', code: 'gone' });
  w.at(sam, 552, 600);   // p1.1 is tile (11, 12)
  w.say(sam, { t: 'light', id: 'p01.1' });
  assert.deepEqual(sam.last('boom').id, 'p1.1');   // answered with the cracker's own id
  sam.clear(); w.t += 3000;
  for (const id of ['x1.0', 'p1', 'p-1.0', 42, null]) w.say(sam, { t: 'light', id });
  w.say(sam, { t: 'light', id: 'p1.2', x: 'near' });
  assert.equal(sam.got.length, 0);   // junk is ignored without an answer
  // with no presence at all, the message's x, y is used
  const w2 = world(w.store, w.t);
  const sam2 = w2.sock(); w2.room.join(sam2, 'Sam'); w2.say(sam2, { t: 'hello', v: 1 });
  w2.say(sam2, { t: 'light', id: 'p1.2' });
  assert.deepEqual(sam2.last('light_no'), { t: 'light_no', id: 'p1.2', code: 'far' });   // no position known at all
  w2.say(sam2, { t: 'light', id: 'p1.2', x: 12 * TILE + 24, y: 12 * TILE + 24 });
  assert.equal(sam2.last('boom').id, 'p1.2');
});

test('the last cracker lit ends the party: party_end to the map, and the party is over in the store', () => {
  const { w, mud, sam, zed } = scene();
  party(w, mud);
  w.at(sam, 11 * TILE, 12 * TILE + 24);
  for (let k = 0; k < 5; k++) { w.t += 300; w.say(sam, { t: 'light', id: 'p1.' + k }); }
  assert.equal(sam.of('boom').length, 5);
  assert.deepEqual(mud.last('party_end'), { t: 'party_end', pid: 1, map: 'over' });
  assert.deepEqual(sam.last('party_end'), { t: 'party_end', pid: 1, map: 'over' });
  assert.equal(zed.of('party_end').length, 0);
  assert.deepEqual(w.store.liveParties(w.t), []);
  assert.equal(w.store.partyRows.get(1).ended, true);
  w.t += 300;
  w.say(sam, { t: 'light', id: 'p1.4' });
  assert.deepEqual(sam.last('light_no'), { t: 'light_no', id: 'p1.4', code: 'gone' });
  // the prizes are still there to claim after the party is over
  assert.equal(w.store.unclaimed('sam', 0).length, 5);
});

test('an admin ends the party on its own map; a party on another map stays', () => {
  const { w, mud, sam, zed } = scene();
  party(w, mud);
  w.at(mud, 10 * TILE, 10 * TILE, 'cave1');
  party(w, mud);   // pid 2, in the cave
  w.at(mud, 10 * TILE, 10 * TILE, 'over');
  sam.clear(); zed.clear();
  w.t += 1000;
  w.say(mud, { t: 'party_end' });
  assert.deepEqual(sam.of('party_end'), [{ t: 'party_end', pid: 1, map: 'over' }]);
  assert.equal(zed.of('party_end').length, 0);
  assert.deepEqual(w.store.liveParties(w.t).map(p => p.id), [2]);
});

test('a party survives a nap: a new Room on the same store has it, sends it after welcome, and a light still works', () => {
  const { w, mud, sam } = scene();
  party(w, mud);
  w.at(sam, 504, 600);
  w.say(sam, { t: 'light', id: 'p1.0' });
  // the world naps; the knights come back from their attachments (no crackers: they already have them)
  const w2 = world(w.store, w.t + 60000);
  assert.deepEqual(Array.from(w2.room.parties.keys()), [1]);
  assert.ok(w2.woke.length >= 1 && w2.woke[0] <= PARTY_LIFE, JSON.stringify(w2.woke));   // the expiry alarm is booked again
  const mud2 = w2.sock(), sam2 = w2.sock();
  w2.room.restore(mud2, mud.state); w2.room.restore(sam2, sam.state);
  assert.equal(mud2.got.length + sam2.got.length, 0);
  // a knight that says hello in the new Room gets the unlit ones, with the time left
  w2.store.addAccount('Ada');
  const ada2 = w2.knight('Ada', 'over', 11 * TILE + 24, 12 * TILE + 24);
  const c = ada2.last('crackers');
  assert.deepEqual(c.list.map(x => x[0]), ['p1.1', 'p1.2', 'p1.3', 'p1.4']);
  assert.equal(c.left, w.store.partyRows.get(1).at + PARTY_LIFE - w2.t);
  assert.deepEqual(ada2.got.map(m => m.t).filter(t => t === 'welcome' || t === 'who' || t === 'crackers'), ['welcome', 'who', 'crackers']);
  w2.say(ada2, { t: 'light', id: 'p1.1' });
  assert.equal(ada2.last('boom').n, 'Ada');
  assert.equal(sam2.last('boom').n, 'Ada');   // restored knights on the map see it too
  w2.say(ada2, { t: 'light', id: 'p1.0' });
  assert.deepEqual(ada2.last('light_no'), { t: 'light_no', id: 'p1.0', code: 'taken' });   // lit before the nap stays lit
});

test('expiry: 15 minutes after the start the party ends on the fake clock, and later lights find it gone', () => {
  const { w, mud, sam } = scene();
  party(w, mud);
  const start = w.t;
  assert.ok(w.room.due() <= start + PARTY_LIFE);
  // a Room with nobody in it books its alarm for exactly the expiry
  const q2 = world(w.store, start + 1000);
  assert.equal(q2.room.due(), start + PARTY_LIFE);
  assert.deepEqual(q2.woke, [PARTY_LIFE - 1000]);
  sam.clear();
  w.t = start + PARTY_LIFE - 1; w.room.tick();
  assert.equal(sam.of('party_end').length, 0);
  w.t = start + PARTY_LIFE; w.room.tick();
  assert.deepEqual(sam.of('party_end'), [{ t: 'party_end', pid: 1, map: 'over' }]);
  assert.deepEqual(w.store.liveParties(w.t), []);
  w.at(sam, 504, 600);
  w.say(sam, { t: 'light', id: 'p1.0' });
  assert.deepEqual(sam.last('light_no'), { t: 'light_no', id: 'p1.0', code: 'gone' });
  // and a Room built after the expiry never loads it
  const w2 = world(w.store, w.t);
  assert.equal(w2.room.parties.size, 0);
});

test('crackers go to a knight who walks onto the map, not to a restored one; time left counts down', () => {
  const { w, mud, zed } = scene();
  party(w, mud);
  zed.clear();
  w.t += 60000;
  w.at(zed, 11 * TILE, 11 * TILE, 'over');
  const c = zed.last('crackers');
  assert.equal(c.pid, 1); assert.equal(c.list.length, 5); assert.equal(c.left, PARTY_LIFE - 60000);
  zed.clear();
  w.at(zed, 11 * TILE + 5, 11 * TILE, 'over');   // moving about on the same map sends nothing again
  assert.equal(zed.of('crackers').length, 0);
  const w2 = world(w.store, w.t);
  const z2 = w2.sock(); w2.room.restore(z2, zed.state);
  assert.equal(z2.got.length, 0);
});

test('prizes: sent after welcome for a win never claimed, not after the claim; only the lighter can claim; 7 days only', () => {
  const { w, mud, sam, ada } = scene();
  party(w, mud);
  w.at(sam, 504, 600);
  w.say(sam, { t: 'light', id: 'p1.0' });
  const reward = sam.last('boom').reward;
  // Sam's game drops before the fuse ends: no claim was sent
  w.room.leave(sam);
  w.t += 5000;
  let back = w.knight('Sam');
  const order = back.got.map(m => m.t).filter(t => ['welcome', 'who', 'crackers', 'prize'].includes(t));
  assert.deepEqual(order, ['welcome', 'who', 'crackers', 'prize']);
  assert.deepEqual(back.last('prize'), { t: 'prize', id: 'p1.0', reward });
  // somebody else's claim does nothing
  ada.clear();
  w.say(ada, { t: 'claim', id: 'p1.0' });
  assert.equal(ada.got.length, 0);   // a claim has no answer
  assert.equal(w.store.partyRows.get(1).crackers[0].claimed, false);
  w.room.leave(back); back = w.knight('Sam');
  assert.equal(back.of('prize').length, 1);
  // Sam's game claims it: never offered again, and claiming twice is harmless
  w.say(back, { t: 'claim', id: 'p1.0' });
  w.say(back, { t: 'claim', id: 'p1.0' });
  assert.equal(w.store.partyRows.get(1).crackers[0].claimed, true);
  w.room.leave(back); back = w.knight('Sam');
  assert.equal(back.of('prize').length, 0);
  // a win left unclaimed for more than 7 days is not offered any more
  w.at(back, 11 * TILE + 24, 12 * TILE + 24);
  w.say(back, { t: 'light', id: 'p1.1' });
  const litAt = w.t;
  w.room.leave(back);
  w.t = litAt + PRIZE_KEEP;
  back = w.knight('Sam');
  assert.deepEqual(back.of('prize').map(m => m.id), ['p1.1']);   // exactly 7 days: still offered
  w.room.leave(back);
  w.t = litAt + PRIZE_KEEP + 1;
  back = w.knight('Sam');
  assert.equal(back.of('prize').length, 0);
});

test('a party hat: the boom says so, everyone on line hears it, and it is written to mod_log', () => {
  const { w, mud, sam, ada, zed } = scene();
  party(w, mud, { hat: 1000 });
  w.at(sam, 504, 600);
  for (const s of [mud, sam, ada, zed]) s.clear();
  w.queue.push(0, 4 / 6 + 0.01, 0);   // hat roll: 0 * 1000 < 1; colour: floor((4/6 + 0.01) * 6) = 4 -> purple; fuse: 1000
  w.say(sam, { t: 'light', id: 'p1.0' });
  const boom = { t: 'boom', id: 'p1.0', n: 'Sam', fuse: 1000, reward: { id: 'party_hat_purple', qty: 1, hat: 'purple' } };
  for (const s of [mud, sam, ada]) assert.deepEqual(s.last('boom'), boom);
  const ann = { t: 'announce', kind: 'hat', n: 'Sam', colour: 'purple' };
  for (const s of [mud, sam, ada, zed]) assert.deepEqual(s.last('announce'), ann);
  assert.equal(zed.of('boom').length, 0);
  const log = w.store.modLog(2);
  assert.deepEqual(log[0], { at: w.t, by: 'MudGoll', act: 'hat', target: 'Sam', detail: 'purple' });   // by = the party's admin
  assert.equal(log[1].act, 'party');
  assert.deepEqual(w.store.unclaimed('sam', 0), [{ id: 'p1.0', reward: boom.reward }]);
  // an ordinary prize writes nothing to the log
  w.queue.push(0.5, 0, 0, 0.9999);   // no hat; the first row; the lowest quantity; the longest fuse
  w.say(sam, { t: 'light', id: 'p1.1' });
  assert.deepEqual(sam.last('boom').reward, { id: 'coins', qty: 5 });
  assert.equal(sam.last('boom').fuse, FUSE_MAX);
  assert.equal(w.store.modLog(10).length, 2);
});

test('a party from an admin with no region names the map in the log', () => {
  const w = world();
  w.store.addAccount('MudGoll', 'admin');
  const mud = w.sock(); w.room.join(mud, 'MudGoll'); w.say(mud, { t: 'hello', v: 1 }); w.say(mud, { t: 'p', map: 'inst_spider', x: 480, y: 480 });
  w.t += 5000;
  w.say(mud, { t: 'party', spots: SPOTS5, table: COINS, hat: 100 });
  assert.deepEqual(mud.last('announce'), { t: 'announce', kind: 'party', n: 'MudGoll', region: '', map: 'inst_spider', count: 5 });
  assert.equal(w.store.modLog(1)[0].detail, '5 crackers in inst_spider, party hats 1 in 100');
});
