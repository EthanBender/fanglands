// Trading (docs/ONLINE.md, "Trading"): the ask, the answer, the two offers the Room holds as the only truth, the two
// screens (accept, then confirm), completion exactly once, every refusal, every way a trade ends with nothing moved,
// the finished-trade rows and their acks, and the caps. The Room with a MemoryStore, in-memory sockets, a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, CAPS, ROSTER_EVERY, TRADE_NEAR, TRADE_LEAVE, TRADE_ASK_LIFE, TRADE_ITEMS, TRADE_QTY_MAX, TRADE_KEEP } from '../src/room.js';
import { MemoryStore } from '../src/store.js';

function world(store) {
  const w = { t: 1000, woke: [] };
  w.store = store || new MemoryStore();
  w.room = new Room({ now: () => w.t, wake: ms => w.woke.push(ms), store: w.store });
  w.sock = () => {
    const s = { got: [], closed: null, send(str) { s.got.push(JSON.parse(str)); }, close(code) { s.closed = code; }, attach() { } };
    s.of = t => s.got.filter(m => m.t === t);
    s.last = t => { const l = s.of(t); return l[l.length - 1]; };
    s.clear = () => { s.got.length = 0; };
    return s;
  };
  w.say = (s, m) => w.room.message(s, JSON.stringify(m));
  // a knight on a map, standing at (x, y) px
  w.knight = (name, x = 500, y = 500, map = 'over') => {
    const s = w.sock(); w.room.join(s, name); w.say(s, { t: 'hello', v: 1 });
    w.say(s, { t: 'p', map, x, y, lv: 3, dead: false });
    return s;
  };
  w.at = (s, x, y, extra) => w.say(s, Object.assign({ t: 'p', map: 'over', x, y, dead: false }, extra || {}));
  // let every bucket refill and the roster settle, then listen fresh
  w.later = (ms = 5000, ...socks) => { w.t += ms; w.room.tick(); for (const s of socks) s.clear(); };
  // Sam asks Ada, Ada says yes: an open trade. Answers its id.
  w.open = (a, b, an = 'Ada', as = 'Sam') => { w.say(a, { t: 'trade_ask', to: an }); w.say(b, { t: 'trade_answer', from: as, yes: true }); return a.last('trade_open').id; };
  return w;
}
const offer = (w, s, id, items) => w.say(s, { t: 'trade_offer', id, items });
const state = s => s.last('trade_state');

test('the ask: it reaches the knight with the asker\'s name and role, the asker hears it went, and No tells the asker', () => {
  const w = world(); w.store.addAccount('Sam', 'admin'); w.store.addAccount('Ada');
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  sam.clear(); ada.clear();
  w.say(sam, { t: 'trade_ask', to: 'ada' });
  assert.deepEqual(ada.last('trade_ask'), { t: 'trade_ask', from: 'Sam', role: 'admin' });
  assert.deepEqual(sam.last('trade_asked'), { t: 'trade_asked', to: 'Ada' });
  w.say(ada, { t: 'trade_answer', from: 'Sam', yes: false });
  assert.deepEqual(sam.last('trade_no'), { t: 'trade_no', code: 'declined', n: 'Ada' });
  assert.equal(sam.of('trade_open').length + ada.of('trade_open').length, 0);
  // the ask is used up: a late yes finds nothing
  w.say(ada, { t: 'trade_answer', from: 'Sam', yes: true });
  assert.deepEqual(ada.last('trade_no'), { t: 'trade_no', code: 'gone', n: 'Sam' });
  assert.equal(ada.of('trade_open').length, 0);
});

test('every ask the server refuses, with its code and whose it is', () => {
  const w = world();
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500), zed = w.knight('Zed', 520, 500, 'cave1'), bo = w.knight('Bo', 500 + TRADE_NEAR + 1, 500);
  const no = () => sam.last('trade_no');
  w.say(sam, { t: 'trade_ask', to: 'Sam' }); assert.deepEqual(no(), { t: 'trade_no', code: 'self', n: 'Sam' });
  w.say(sam, { t: 'trade_ask', to: 'Nobody' }); assert.deepEqual(no(), { t: 'trade_no', code: 'offline', n: 'Nobody' });
  w.say(sam, { t: 'trade_ask', to: 'Zed' }); assert.deepEqual(no(), { t: 'trade_no', code: 'map', n: 'Zed' });
  w.later(5000);
  w.say(sam, { t: 'trade_ask', to: 'Bo' }); assert.deepEqual(no(), { t: 'trade_no', code: 'far', n: 'Bo' });
  w.say(sam, { t: 'trade_ask', to: 42 }); assert.deepEqual(no(), { t: 'trade_no', code: 'bad', n: '' });
  w.later(5000);
  // a fallen knight cannot trade, nor be traded with
  w.at(ada, 560, 500, { dead: true }); w.say(sam, { t: 'trade_ask', to: 'Ada' }); assert.deepEqual(no(), { t: 'trade_no', code: 'dead', n: 'Ada' });
  w.at(ada, 560, 500);
  // already trading: the asker, then the asked
  w.later(5000);
  const id = w.open(sam, ada);
  assert.ok(Number.isInteger(id));
  w.later(5000);
  w.at(bo, 540, 540);
  w.say(bo, { t: 'trade_ask', to: 'Sam' }); assert.deepEqual(bo.last('trade_no'), { t: 'trade_no', code: 'busy', n: 'Sam' });
  w.say(sam, { t: 'trade_ask', to: 'Bo' }); assert.deepEqual(no(), { t: 'trade_no', code: 'busy', n: 'Sam' });
  assert.equal(zed.of('trade_ask').length + bo.of('trade_ask').length, 0);
});

test('asking twice is "wait"; an ask nobody answers runs out after 30 s (the asker hears timeout, the other the ask go)', () => {
  const w = world();
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  w.say(sam, { t: 'trade_ask', to: 'Ada' });
  w.later(3000);
  w.say(sam, { t: 'trade_ask', to: 'Ada' });
  assert.deepEqual(sam.last('trade_no'), { t: 'trade_no', code: 'wait', n: 'Ada' });
  assert.equal(ada.of('trade_ask').length, 1);
  assert.ok(w.woke.length > 0);   // the Room asked to be woken for the ask's end
  w.t += TRADE_ASK_LIFE; w.room.tick();
  assert.deepEqual(sam.last('trade_no'), { t: 'trade_no', code: 'timeout', n: 'Ada' });
  assert.deepEqual(ada.last('trade_ask_off'), { t: 'trade_ask_off', from: 'Sam' });
  w.say(ada, { t: 'trade_answer', from: 'Sam', yes: true });
  assert.equal(ada.last('trade_no').code, 'gone');
  // asking someone else withdraws the first ask
  const bo = w.knight('Bo', 520, 520);
  w.later(5000, ada, bo, sam);
  w.say(sam, { t: 'trade_ask', to: 'Ada' }); w.later(3000); w.say(sam, { t: 'trade_ask', to: 'Bo' });
  assert.deepEqual(ada.last('trade_ask_off'), { t: 'trade_ask_off', from: 'Sam' });
  assert.equal(bo.of('trade_ask').length, 1);
});

test('two knights who ask each other open the trade at once', () => {
  const w = world();
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  w.say(sam, { t: 'trade_ask', to: 'Ada' });
  w.say(ada, { t: 'trade_ask', to: 'Sam' });
  assert.deepEqual(sam.last('trade_open'), { t: 'trade_open', id: 1, with: 'Ada', ver: 1 });
  assert.deepEqual(ada.last('trade_open'), { t: 'trade_open', id: 1, with: 'Sam', ver: 1 });
});

test('the whole trade: offers, any change un-accepts both, accept, "are you sure", confirm, done once for each, a row for the parent page', () => {
  const w = world();
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  const id = w.open(sam, ada);
  assert.deepEqual(state(sam), { t: 'trade_state', id, ver: 1, stage: 'offer', mine: [], theirs: [], acc: [false, false], conf: [false, false] });
  // two empty offers cannot be accepted
  w.say(sam, { t: 'trade_accept', id, ver: 1 });
  assert.deepEqual(state(sam).acc, [false, false]);
  offer(w, sam, id, [{ id: 'bread', qty: 5 }]);
  assert.deepEqual(state(ada), { t: 'trade_state', id, ver: 2, stage: 'offer', mine: [], theirs: [{ id: 'bread', qty: 5 }], acc: [false, false], conf: [false, false] });
  offer(w, ada, id, [{ id: 'coins', qty: 20 }]);
  assert.equal(state(sam).ver, 3);
  // Sam accepts version 3; Ada changes her offer: both un-accepted, version 4
  w.say(sam, { t: 'trade_accept', id, ver: 3 });
  assert.deepEqual(state(ada).acc, [false, true]);
  offer(w, ada, id, [{ id: 'coins', qty: 19 }]);
  assert.deepEqual([state(sam).ver, state(sam).acc], [4, [false, false]]);
  // an accept of the old version is refused: it changes nothing, and Sam hears the truth again
  sam.clear(); ada.clear();
  w.say(sam, { t: 'trade_accept', id, ver: 3 });
  assert.deepEqual(state(sam).acc, [false, false]); assert.equal(ada.of('trade_state').length, 0);
  // the same offer again is no change at all
  offer(w, ada, id, [{ id: 'coins', qty: 19 }]); assert.equal(ada.of('trade_state').length, 0);
  offer(w, ada, id, [{ id: 'coins', qty: 20 }]);
  w.say(sam, { t: 'trade_accept', id, ver: 5 }); w.say(ada, { t: 'trade_accept', id, ver: 5 });
  assert.equal(state(sam).stage, 'confirm'); assert.equal(state(ada).stage, 'confirm');
  // confirm before the second screen, or of an old version: refused
  w.say(sam, { t: 'trade_confirm', id, ver: 4 }); assert.deepEqual(state(sam).conf, [false, false]);
  // a change on the second screen goes back to the first, both un-accepted
  offer(w, sam, id, [{ id: 'bread', qty: 4 }]);
  assert.deepEqual([state(ada).stage, state(ada).ver, state(ada).acc], ['offer', 6, [false, false]]);
  offer(w, sam, id, [{ id: 'bread', qty: 5 }]);
  w.say(sam, { t: 'trade_accept', id, ver: 7 }); w.say(ada, { t: 'trade_accept', id, ver: 7 });
  w.say(sam, { t: 'trade_accept', id, ver: 7 });   // accepting on the second screen does nothing
  w.say(ada, { t: 'trade_confirm', id, ver: 7 });
  assert.deepEqual(state(sam).conf, [false, true]);
  assert.equal(sam.of('trade_done').length, 0);
  w.say(sam, { t: 'trade_confirm', id, ver: 7 });
  const ds = sam.of('trade_done'), da = ada.of('trade_done');
  assert.equal(ds.length, 1); assert.equal(da.length, 1);
  assert.deepEqual(ds[0], { t: 'trade_done', tid: 1, id, with: 'Ada', gave: [{ id: 'bread', qty: 5 }], got: [{ id: 'coins', qty: 20 }] });
  assert.deepEqual(da[0], { t: 'trade_done', tid: 1, id, with: 'Sam', gave: [{ id: 'coins', qty: 20 }], got: [{ id: 'bread', qty: 5 }] });
  assert.deepEqual(w.store.tradeLog(5), [{ tid: 1, at: w.t, a: 'Sam', b: 'Ada', aGave: [{ id: 'bread', qty: 5 }], bGave: [{ id: 'coins', qty: 20 }], aAck: false, bAck: false }]);
  // it is over: a second confirm is answered gone and moves nothing more; both are free to trade again
  w.say(sam, { t: 'trade_confirm', id, ver: 7 });
  assert.deepEqual(sam.last('trade_end'), { t: 'trade_end', id, code: 'gone', n: 'Sam' });
  assert.equal(sam.of('trade_done').length, 1); assert.equal(w.store.tradeLog(5).length, 1);
  w.later(5000);
  const id2 = w.open(sam, ada);
  assert.equal(id2, id + 1);
});

test('offers the server refuses: too many things, a thing twice, bad ids and amounts, and messages for a trade you are not in', () => {
  const w = world();
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500), bo = w.knight('Bo', 540, 540);
  const id = w.open(sam, ada);
  const many = Array.from({ length: TRADE_ITEMS + 1 }, (_, i) => ({ id: 'thing_' + i, qty: 1 }));
  const bad = [
    many, [{ id: 'bread', qty: 1 }, { id: 'bread', qty: 2 }], [{ id: 'Bread!', qty: 1 }], [{ id: 'bread', qty: 0 }], [{ id: 'bread', qty: 1.5 }],
    [{ id: 'bread', qty: TRADE_QTY_MAX + 1 }], [{ id: 'bread' }], 'bread', null, [null],
  ];
  for (const items of bad) { w.later(1000); ada.clear(); offer(w, sam, id, items); assert.equal(ada.of('trade_state').length, 0, JSON.stringify(items)); assert.deepEqual(state(sam).mine, []); }
  // the most the contract allows goes through
  w.later(1000);
  const most = Array.from({ length: TRADE_ITEMS }, (_, i) => ({ id: 'thing_' + i, qty: TRADE_QTY_MAX }));
  offer(w, sam, id, most); assert.deepEqual(state(ada).theirs, most);
  // Bo is not in this trade: every message naming it is answered gone and changes nothing
  w.later(1000); sam.clear(); ada.clear();
  for (const t of ['trade_offer', 'trade_accept', 'trade_confirm', 'trade_full']) w.say(bo, { t, id, ver: 2, items: [{ id: 'bread', qty: 1 }] });
  w.say(bo, { t: 'trade_close', id });
  assert.equal(bo.of('trade_end').filter(m => m.code === 'gone').length, 4);
  assert.equal(sam.got.length + ada.got.length, 0);
  // a message with the wrong id from someone in the trade is answered gone too
  offer(w, sam, id + 7, [{ id: 'bread', qty: 1 }]);
  assert.deepEqual(sam.last('trade_end'), { t: 'trade_end', id: id + 7, code: 'gone', n: 'Sam' });
});

test('a full pack: both are un-accepted and told whose pack it is; the window stays open and the trade can still finish', () => {
  const w = world();
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  const id = w.open(sam, ada);
  offer(w, sam, id, [{ id: 'bread', qty: 5 }]); offer(w, ada, id, [{ id: 'coins', qty: 20 }]);
  w.say(sam, { t: 'trade_accept', id, ver: 3 }); w.say(ada, { t: 'trade_accept', id, ver: 3 });
  w.say(ada, { t: 'trade_full', id });
  assert.deepEqual(sam.last('trade_note'), { t: 'trade_note', id, code: 'full', n: 'Ada' });
  assert.deepEqual(ada.last('trade_note'), { t: 'trade_note', id, code: 'full', n: 'Ada' });
  assert.deepEqual([state(sam).stage, state(sam).acc, state(sam).conf], ['offer', [false, false], [false, false]]);
  w.say(sam, { t: 'trade_full', id, why: 'new' });
  assert.equal(ada.last('trade_note').code, 'new');
  w.say(sam, { t: 'trade_accept', id, ver: 3 }); w.say(ada, { t: 'trade_accept', id, ver: 3 });
  w.say(sam, { t: 'trade_confirm', id, ver: 3 }); w.say(ada, { t: 'trade_confirm', id, ver: 3 });
  assert.equal(sam.of('trade_done').length, 1);
});

test('every way a trade ends with nothing moved: closed, disconnected mid-trade, a new map, walking away, falling', () => {
  const ends = {};
  const cases = {
    closed: (w, sam, ada, id) => w.say(ada, { t: 'trade_close', id }),
    left: (w, sam, ada) => w.room.leave(ada),
    map: (w, sam, ada) => w.say(ada, { t: 'p', map: 'cave1', x: 560, y: 500 }),
    far: (w, sam, ada) => w.at(ada, 500 + TRADE_LEAVE + 1, 500),
    dead: (w, sam, ada) => w.at(ada, 560, 500, { dead: true }),
  };
  for (const [name, end] of Object.entries(cases)) {
    const w = world();
    const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
    const id = w.open(sam, ada);
    offer(w, sam, id, [{ id: 'bread', qty: 5 }]); offer(w, ada, id, [{ id: 'coins', qty: 20 }]);
    w.say(sam, { t: 'trade_accept', id, ver: 3 }); w.say(ada, { t: 'trade_accept', id, ver: 3 });
    w.say(sam, { t: 'trade_confirm', id, ver: 3 });   // one confirm in: the very last moment
    w.at(ada, 540, 500);                               // a step inside the eight tiles changes nothing
    assert.equal(sam.of('trade_end').length, 0, name);
    end(w, sam, ada, id);
    ends[name] = sam.last('trade_end');
    // the other confirm now finds no trade; nothing is done and no row is written
    w.say(ada, { t: 'trade_confirm', id, ver: 3 });
    assert.equal(sam.of('trade_done').length + ada.of('trade_done').length, 0, name);
    assert.equal(w.store.tradeLog(5).length, 0, name);
    assert.equal(w.room.trades.size, 0, name);
    // and Sam can trade again at once
    const bo = w.knight('Bo', 530, 500); w.later(5000);
    assert.ok(Number.isInteger(w.open(sam, bo, 'Bo')), name);
  }
  assert.deepEqual(ends, {
    closed: { t: 'trade_end', id: 1, code: 'closed', n: 'Ada' }, left: { t: 'trade_end', id: 1, code: 'left', n: 'Ada' },
    map: { t: 'trade_end', id: 1, code: 'left', n: 'Ada' }, far: { t: 'trade_end', id: 1, code: 'far', n: 'Ada' },
    dead: { t: 'trade_end', id: 1, code: 'dead', n: 'Ada' },
  });
});

test('a knight who disconnects mid-ask: the asker hears offline, and the other knight hears the ask go', () => {
  const w = world();
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  w.say(sam, { t: 'trade_ask', to: 'Ada' });
  w.room.leave(ada);
  assert.deepEqual(sam.last('trade_no'), { t: 'trade_no', code: 'offline', n: 'Ada' });
  const ada2 = w.knight('Ada', 560, 500), bo = w.knight('Bo', 520, 520);
  w.later(5000);
  w.say(sam, { t: 'trade_ask', to: 'Ada' });
  w.room.leave(sam);
  assert.deepEqual(ada2.last('trade_ask_off'), { t: 'trade_ask_off', from: 'Sam' });
  assert.equal(bo.of('trade_ask_off').length, 0);
});

test('the same knight logging in elsewhere mid-trade ends the trade (nothing moved)', () => {
  const w = world();
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  const id = w.open(sam, ada);
  const ada2 = w.knight('Ada', 560, 500);
  assert.deepEqual(sam.last('trade_end'), { t: 'trade_end', id, code: 'left', n: 'Ada' });
  offer(w, ada2, id, [{ id: 'bread', qty: 1 }]);
  assert.equal(ada2.last('trade_end').code, 'gone');
});

test('a nap whose attachments carry no trade (an older world\'s): the open trade is gone, its messages are answered gone, nothing moved', () => {
  const store = new MemoryStore();
  const w = world(store);
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  const id = w.open(sam, ada);
  offer(w, sam, id, [{ id: 'bread', qty: 5 }]);
  const w2 = world(store);
  w2.room.restore(sam, { name: 'Sam', since: 1000, hello: true, map: 'over' });
  w2.room.restore(ada, { name: 'Ada', since: 1000, hello: true, map: 'over' });
  sam.clear();
  w2.say(sam, { t: 'trade_accept', id, ver: 2 });
  assert.deepEqual(sam.last('trade_end'), { t: 'trade_end', id, code: 'gone', n: 'Sam' });
  assert.equal(store.tradeLog(5).length, 0);
});

// 5 Oct 2026: two knights on one map at "Are you sure?" who both stop playing for 10 s let the world nap (nothing watches a
// quiet keeper any more), and the trade was gone: both read "That trade is over. Nothing was swapped." It rides both
// attachments now, and the second socket restored puts it back as it stood.
for (const order of ['Sam first', 'Ada first']) test(`a nap keeps an open trade at "Are you sure?": restored ${order}, both confirm, and it is done once`, () => {
  const store = new MemoryStore();
  const w = world(store);
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  for (const s of [sam, ada]) s.attach = st => { s.state = JSON.parse(JSON.stringify(st)); };
  const id = w.open(sam, ada);
  offer(w, sam, id, [{ id: 'bread', qty: 3 }]); offer(w, ada, id, [{ id: 'coins', qty: 20 }]);
  w.say(sam, { t: 'trade_accept', id, ver: 3 }); w.say(ada, { t: 'trade_accept', id, ver: 3 });
  w.say(sam, { t: 'trade_confirm', id, ver: 3 });
  assert.equal(state(sam).stage, 'confirm');
  assert.deepEqual(sam.state.trade, ada.state.trade);
  assert.deepEqual(sam.state.trade, { id, a: 'sam', b: 'ada', offer: { a: [{ id: 'bread', qty: 3 }], b: [{ id: 'coins', qty: 20 }] }, acc: { a: true, b: true }, conf: { a: true, b: false }, stage: 'confirm', ver: 3 });
  // the nap: a new Room over the same store, the sockets restored from their attachments in either order
  const w2 = world(store);
  const both = order === 'Sam first' ? [sam, ada] : [ada, sam];
  for (const s of both) w2.room.restore(s, s.state);
  sam.clear(); ada.clear();
  // Sam had confirmed before the nap; Ada confirms now
  w2.say(ada, { t: 'trade_confirm', id, ver: 3 });
  assert.deepEqual(sam.of('trade_end').concat(ada.of('trade_end')), []);
  assert.deepEqual(sam.last('trade_done'), { t: 'trade_done', tid: sam.last('trade_done').tid, id, with: 'Ada', gave: [{ id: 'bread', qty: 3 }], got: [{ id: 'coins', qty: 20 }] });
  assert.deepEqual(ada.last('trade_done').got, [{ id: 'bread', qty: 3 }]);
  assert.equal(store.tradeLog(5).length, 1);
  // over: neither attachment carries it, a late confirm is answered gone, and a new trade gets a new id
  assert.equal(sam.state.trade, undefined); assert.equal(ada.state.trade, undefined);
  w2.say(sam, { t: 'trade_confirm', id, ver: 3 });
  assert.equal(sam.last('trade_end').code, 'gone');
  assert.equal(store.tradeLog(5).length, 1);
  w2.later(5000, sam, ada);
  w2.at(sam, 500, 500); w2.at(ada, 560, 500);
  w2.say(sam, { t: 'trade_ask', to: 'Ada' }); w2.say(ada, { t: 'trade_answer', from: 'Sam', yes: true });
  assert.ok(sam.last('trade_open').id > id);
});

test('a nap with only one side of an open trade back (the other socket closed in it): the trade stays over, nothing moved', () => {
  const store = new MemoryStore();
  const w = world(store);
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500), bo = w.knight('Bo', 540, 500);
  for (const s of [sam, ada, bo]) s.attach = st => { s.state = JSON.parse(JSON.stringify(st)); };
  const id = w.open(sam, ada);
  offer(w, sam, id, [{ id: 'bread', qty: 3 }]);
  const w2 = world(store);
  w2.room.restore(sam, sam.state);
  // a knight who carries a trade with Sam's id but is not the other side of it does not complete it
  w2.room.restore(bo, Object.assign({}, bo.state, { trade: Object.assign({}, sam.state.trade, { a: 'bo' }) }));
  sam.clear();
  w2.say(sam, { t: 'trade_accept', id, ver: 2 });
  assert.equal(sam.last('trade_end').code, 'gone');
  assert.equal(store.tradeLog(5).length, 0);
});

test('an open trade too big for a socket\'s attachment beside its gifts is left out of it (the attachment is still written)', () => {
  const w = world();
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  for (const s of [sam, ada]) s.attach = st => { s.state = st; s.size = JSON.stringify(st).length; };
  // four gifts on their way from Sam, never answered
  for (let i = 0; i < 4; i++) w.say(sam, { t: 'gift', to: 'Ada', id: 'g'.repeat(39) + i, qty: 999999 }), w.t += 1500;
  const id = w.open(sam, ada);
  const many = n => Array.from({ length: TRADE_ITEMS }, (_, i) => ({ id: n.repeat(38) + String(i).padStart(2, '0'), qty: TRADE_QTY_MAX }));
  offer(w, sam, id, many('a')); offer(w, ada, id, many('b'));
  assert.equal(state(sam).mine.length, TRADE_ITEMS);
  assert.equal(sam.state.trade, undefined);
  assert.equal(sam.state.gifts.length, 4);
  assert.ok(sam.size <= 2048, String(sam.size));
  assert.ok(ada.size <= 2048, String(ada.size));
});

test('a finished trade is re-sent after every welcome until that knight acks it; only the two knights in it can ack', () => {
  const w = world();
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  const id = w.open(sam, ada);
  offer(w, sam, id, [{ id: 'bread', qty: 5 }]); offer(w, ada, id, [{ id: 'coins', qty: 20 }]);
  for (const t of ['trade_accept', 'trade_confirm']) { w.say(sam, { t, id, ver: 3 }); w.say(ada, { t, id, ver: 3 }); }
  const tid = sam.last('trade_done').tid;
  // Sam's game puts it in its save and acks; Ada's socket drops before she can
  w.say(sam, { t: 'trade_ack', tid });
  w.room.leave(ada); w.room.leave(sam);
  w.later(5000);
  const sam2 = w.knight('Sam'), ada2 = w.knight('Ada', 560, 500);
  assert.equal(sam2.of('trade_done').length, 0);
  assert.deepEqual(ada2.of('trade_done'), [{ t: 'trade_done', tid, id: null, with: 'Sam', gave: [{ id: 'coins', qty: 20 }], got: [{ id: 'bread', qty: 5 }] }]);
  // after welcome and the roster, in the contract's order
  const order = ada2.got.map(m => m.t).filter(t => ['welcome', 'who', 'trade_done'].includes(t));
  assert.deepEqual(order.slice(0, 3), ['welcome', 'who', 'trade_done']);
  // someone else acking it changes nothing; Ada's own ack ends it
  const bo = w.knight('Bo', 520, 520); w.say(bo, { t: 'trade_ack', tid });
  w.room.leave(ada2); const ada3 = w.knight('Ada', 560, 500);
  assert.equal(ada3.of('trade_done').length, 1);
  w.say(ada3, { t: 'trade_ack', tid }); w.say(ada3, { t: 'trade_ack', tid: 'x' });
  w.room.leave(ada3); const ada4 = w.knight('Ada', 560, 500);
  assert.equal(ada4.of('trade_done').length, 0);
  // and after seven days it is not re-sent at all
  const w2 = world(); w2.store.addTrade({ at: 1000, a: 'Sam', b: 'Ada', aGave: [{ id: 'bread', qty: 1 }], bGave: [] });
  w2.t = 1000 + TRADE_KEEP + 1;
  assert.equal(w2.knight('Sam').of('trade_done').length, 0);
});

test('caps: a knight hammering trade asks is dropped like any other, and each trade message has a cap', () => {
  for (const t of ['trade_ask', 'trade_answer', 'trade_offer', 'trade_accept', 'trade_confirm', 'trade_full', 'trade_close', 'trade_ack']) assert.ok(CAPS[t] && CAPS[t].rate > 0 && CAPS[t].burst >= 2, t);
  assert.equal(CAPS.trade_ask.rate, 0.5); assert.equal(CAPS.trade_ask.burst, 3);
  const w = world();
  const sam = w.knight('Sam'), ada = w.knight('Ada', 560, 500);
  sam.clear(); ada.clear();
  for (let i = 0; i < 3; i++) w.say(sam, { t: 'trade_ask', to: 'Ada' });
  assert.equal(ada.of('trade_ask').length, 1);   // the first one; the next two are "wait"
  w.say(sam, { t: 'trade_ask', to: 'Ada' });
  assert.deepEqual(sam.last('error'), { t: 'error', code: 'bad', text: 'too fast: slow down or you will be dropped' });
  for (let i = 0; i < 20 && sam.closed === null; i++) w.say(sam, { t: 'trade_ask', to: 'Ada' });
  assert.equal(sam.closed, 4008);
  assert.equal(ada.of('trade_ask').length, 1);
  // an honest knight at the cap's rate is never refused
  const w2 = world();
  const a = w2.knight('Sam'), b = w2.knight('Ada', 560, 500);
  const id = w2.open(a, b);
  for (let i = 1; i <= 40; i++) { w2.t += 250; offer(w2, a, id, [{ id: 'bread', qty: i }]); }
  assert.equal(state(b).theirs[0].qty, 40);
  assert.equal(a.of('error').length, 0);
});

test('a trade needs positions: before either knight has sent presence, an ask is "far"', () => {
  const w = world();
  const s = w.sock(); w.room.join(s, 'Sam'); w.say(s, { t: 'hello', v: 1 });
  const ada = w.knight('Ada', 560, 500);
  w.say(s, { t: 'trade_ask', to: 'Ada' });
  assert.equal(s.last('trade_no').code, 'far');
  w.at(s, 500, 500); w.later(5000);
  w.say(s, { t: 'trade_ask', to: 'Ada' });
  assert.equal(ada.of('trade_ask').length, 1);
  void ROSTER_EVERY;
});
