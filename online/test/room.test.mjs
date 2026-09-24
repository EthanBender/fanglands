// The Room: joins, relays, keepers, hits, gifts, caps, roster cadence. In-memory sockets, a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, CAPS, GIFT_WAIT, ROSTER_EVERY, KEEPER_STALE } from '../src/room.js';

// A pretend world with a clock we control and a log we can read.
function world() {
  const w = { t: 1000, log: [], woke: [] };
  w.room = new Room({ now: () => w.t, log: (n, text, at) => w.log.push({ n, text, at }), wake: ms => w.woke.push(ms) });
  w.sock = () => {
    const s = { got: [], closed: null, state: null, send(str) { s.got.push(JSON.parse(str)); }, close(code, reason) { s.closed = { code, reason }; }, attach(st) { s.state = st; } };
    s.of = t => s.got.filter(m => m.t === t);
    s.last = t => { const l = s.of(t); return l[l.length - 1]; };
    s.clear = () => { s.got.length = 0; };
    return s;
  };
  // join + hello + (optionally) a first presence on a map
  w.knight = (name, map) => {
    const s = w.sock(); w.room.join(s, name); w.room.message(s, JSON.stringify({ t: 'hello', v: 1 }));
    if (map) w.room.message(s, JSON.stringify({ t: 'p', map, x: 1, y: 2, lv: 3 }));
    return s;
  };
  w.say = (s, m) => w.room.message(s, JSON.stringify(m));
  // let the held-back roster from the first presence go out, then start listening fresh
  w.settle = (...socks) => { w.t += ROSTER_EVERY; w.room.tick(); w.woke.length = 0; for (const s of socks) s.clear(); };
  return w;
}

test('join and hello: welcome names the knight, the time and the keeper (the first one is the keeper)', () => {
  const w = world();
  const a = w.knight('Cohen');
  const welcome = a.last('welcome');
  assert.deepEqual(welcome, { t: 'welcome', me: 'Cohen', at: 1000, keeper: 'Cohen' });
  assert.equal(a.of('who').length, 1);
  assert.deepEqual(a.last('who').list, [{ n: 'Cohen', map: 'over', region: '', lv: 0 }]);
  assert.deepEqual(w.room.online().map(k => k.n), ['Cohen']);
  assert.equal(a.state.name, 'Cohen');
  assert.equal(a.state.hello, true);
  assert.equal(a.state.map, 'over');
});

test('nothing but hello is heard before hello', () => {
  const w = world();
  const a = w.sock(); w.room.join(a, 'Cohen');
  w.say(a, { t: 'chat', text: 'hi' });
  w.say(a, { t: 'p', map: 'over' });
  assert.equal(a.got.length, 0);
  assert.equal(w.room.online().length, 0);
});

test('presence is relayed to the same map only, with the name on it', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Jack', 'over'), c = w.knight('Zed', 'cave1');
  a.clear(); b.clear(); c.clear();
  w.say(a, { t: 'p', map: 'over', x: 10, y: 20, lv: 5 });
  assert.deepEqual(b.last('p'), { t: 'p', n: 'Cohen', map: 'over', x: 10, y: 20, lv: 5 });
  assert.equal(a.of('p').length, 0);
  assert.equal(c.of('p').length, 0);
});

test('a knight who arrives sees the standing-still knights already on the map', () => {
  const w = world();
  const a = w.knight('Cohen', 'over');
  w.say(a, { t: 'p', map: 'over', x: 99, y: 98 });
  const b = w.knight('Jack');
  assert.equal(b.last('p').n, 'Cohen');
  assert.equal(b.last('p').x, 99);
});

test('keeper election: earliest on the map keeps it; a map change hands it on and announces it', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over'); w.t += 10;
  assert.equal(b.last('welcome').keeper, 'Cohen');
  assert.equal(w.room.keeperOf('over').name, 'Cohen');
  a.clear(); b.clear();
  // Cohen walks into a cave: Jack becomes keeper of the overworld, Cohen keeper of the cave
  w.say(a, { t: 'p', map: 'cave1', x: 0, y: 0 });
  assert.deepEqual(b.last('left'), { t: 'left', n: 'Cohen', map: 'over' });
  assert.deepEqual(b.last('keeper'), { t: 'keeper', map: 'over', n: 'Jack' });
  assert.deepEqual(a.last('keeper'), { t: 'keeper', map: 'cave1', n: 'Cohen' });
  assert.equal(w.room.keeperOf('cave1').name, 'Cohen');
  // and back again: the map already has a keeper, so Cohen is only told who it is
  a.clear(); b.clear();
  w.say(a, { t: 'p', map: 'over', x: 0, y: 0 });
  assert.deepEqual(a.last('keeper'), { t: 'keeper', map: 'over', n: 'Jack' });
  assert.equal(b.of('keeper').length, 0);
  assert.equal(w.room.keeperOf('cave1'), null);
});

test('keeper handoff when the keeper leaves the game', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over'); w.t += 10;
  const c = w.knight('Zed', 'over');
  b.clear(); c.clear();
  w.room.leave(a);
  assert.deepEqual(b.last('keeper'), { t: 'keeper', map: 'over', n: 'Jack' });
  assert.deepEqual(c.last('keeper'), { t: 'keeper', map: 'over', n: 'Jack' });
  assert.deepEqual(c.last('left'), { t: 'left', n: 'Cohen', map: 'over' });
  assert.deepEqual(c.last('who').list.map(k => k.n), ['Jack', 'Zed']);
});

test('mon goes from the keeper to the non-keepers on that map; a non-keeper cannot send one', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over'); w.t += 10;
  const c = w.knight('Zed', 'cave1');
  a.clear(); b.clear(); c.clear();
  w.say(a, { t: 'mon', list: [['s0', 'goblin', 1, 2, 3, 4, 'idle', 0, 1, false, 0, false, 0, 0]] });
  assert.equal(b.last('mon').n, 'Cohen');
  assert.equal(b.last('mon').list[0][0], 's0');
  assert.equal(a.of('mon').length, 0);
  assert.equal(c.of('mon').length, 0);
  w.say(b, { t: 'mon', list: [] });
  assert.equal(a.of('mon').length, 0);
});

test('hit goes to the keeper with the hitter named; the keeper\'s own hit goes nowhere', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over');
  a.clear(); b.clear();
  w.say(b, { t: 'hit', nid: 's3', dmg: 7, knock: 2, bomb: false });
  assert.deepEqual(a.last('hit'), { t: 'hit', n: 'Jack', nid: 's3', dmg: 7, knock: 2, bomb: false });
  w.say(a, { t: 'hit', nid: 's3', dmg: 7 });
  assert.equal(b.of('hit').length, 0);
  assert.equal(a.of('hit').length, 1);
});

test('kill and hurt go from the keeper to the named knight', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over');
  a.clear(); b.clear();
  w.say(a, { t: 'kill', nid: 's3', type: 'goblin', x: 5, y: 6, to: 'jack' });
  assert.deepEqual(b.last('kill'), { t: 'kill', nid: 's3', type: 'goblin', x: 5, y: 6 });
  w.say(a, { t: 'hurt', to: 'Jack', dmg: 4, x: 1, y: 1 });
  assert.deepEqual(b.last('hurt'), { t: 'hurt', dmg: 4, x: 1, y: 1 });
  // a non-keeper's kill is ignored
  w.say(b, { t: 'kill', nid: 's3', type: 'goblin', x: 5, y: 6, to: 'Cohen' });
  assert.equal(a.of('kill').length, 0);
});

test('chat is filtered, logged and sent to everyone on every map', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Jack', 'cave1');
  a.clear(); b.clear();
  w.say(a, { t: 'chat', text: '  what the fuck  ' });
  assert.deepEqual(a.last('chat'), { t: 'chat', n: 'Cohen', text: 'what the ****', at: 1000 });
  assert.deepEqual(b.last('chat'), a.last('chat'));
  assert.deepEqual(w.log, [{ n: 'Cohen', text: 'what the ****', at: 1000 }]);
  w.say(a, { t: 'chat', text: '   ' });
  assert.equal(w.log.length, 1);
});

test('gift: the receiver gets it with a server gid; gift_ok comes back to the sender', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Jack', 'over');
  a.clear(); b.clear();
  w.say(a, { t: 'gift', to: 'Jack', id: 'bread', qty: 3 });
  const g = b.last('gift');
  assert.equal(g.from, 'Cohen'); assert.equal(g.id, 'bread'); assert.equal(g.qty, 3); assert.ok(g.gid != null);
  assert.deepEqual(a.state.gifts.map(x => x.gid), [g.gid]);   // it survives a nap
  w.say(a, { t: 'gift_ok', gid: g.gid });                        // only the receiver may answer
  assert.equal(a.of('gift_ok').length, 0);
  w.say(b, { t: 'gift_ok', gid: g.gid });
  assert.deepEqual(a.last('gift_ok'), { t: 'gift_ok', gid: g.gid, id: 'bread', qty: 3 });
  assert.deepEqual(a.state.gifts, []);
});

test('gift: no answer within 10 s brings it back; gift_no brings it straight back', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Jack', 'over');
  w.settle(a, b);
  w.say(a, { t: 'gift', to: 'Jack', id: 'bread', qty: 1 });
  assert.ok(w.room.wakeAt != null && w.room.wakeAt <= w.t + GIFT_WAIT);   // a wake is booked no later than the gift is due (the keeper's silence check may already be earlier)
  w.t += GIFT_WAIT - 1; w.room.tick();
  assert.equal(a.of('gift_back').length, 0);
  w.t += 1; w.room.tick();
  assert.deepEqual(a.last('gift_back'), { t: 'gift_back', gid: b.last('gift').gid, id: 'bread', qty: 1 });
  a.clear();
  w.t += 2000;
  w.say(a, { t: 'gift', to: 'Jack', id: 'pie', qty: 2 });
  w.say(b, { t: 'gift_no', gid: b.last('gift').gid });
  assert.deepEqual(a.last('gift_back'), { t: 'gift_back', gid: b.last('gift').gid, id: 'pie', qty: 2 });
});

test('gift: to nobody, or to a knight who leaves before answering, comes back at once', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Jack', 'over');
  a.clear();
  w.say(a, { t: 'gift', to: 'Nobody', id: 'bread', qty: 1 });
  assert.equal(a.last('gift_back').id, 'bread');
  a.clear(); w.t += 2000;
  w.say(a, { t: 'gift', to: 'Jack', id: 'pie', qty: 1 });
  w.room.leave(b);
  assert.equal(a.last('gift_back').id, 'pie');
});

test('rate cap: one warning, then the socket is dropped if it keeps going', () => {
  const w = world();
  const a = w.knight('Cohen', 'over');
  a.clear();
  for (let i = 0; i < 200 && !a.closed; i++) w.say(a, { t: 'p', map: 'over', x: i, y: 0 });
  assert.equal(a.of('error').length, 1);
  assert.equal(a.last('error').code, 'bad');
  assert.deepEqual(a.closed, { code: 4008, reason: 'too fast' });
  assert.equal(w.room.online().length, 0);
});

test('rate cap: sending at exactly the cap is never punished', () => {
  const w = world();
  const a = w.knight('Cohen', 'over');
  a.clear();
  for (let i = 0; i < 8 * 30; i++) { w.t += 125; w.say(a, { t: 'p', map: 'over', x: i, y: 0 }); }   // 8/s for 30 s
  for (let i = 0; i < 20; i++) { w.t += 1500; w.say(a, { t: 'chat', text: 'hi ' + i }); }              // 1 per 1.5 s
  assert.equal(a.of('error').length, 0);
  assert.equal(a.closed, null);
});

test('hello twice is over its cap', () => {
  const w = world();
  const a = w.knight('Cohen');
  a.clear();
  w.say(a, { t: 'hello', v: 1 });
  assert.equal(a.last('error').code, 'bad');
  assert.equal(a.of('welcome').length, 0);
});

test('roster cadence: join and leave go at once; a map change waits up to 2 s, then one roster', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Jack', 'over');
  w.settle(a, b);
  w.t += 500;
  w.say(a, { t: 'p', map: 'cave1', x: 0, y: 0 });
  w.say(a, { t: 'p', map: 'cave1', x: 1, y: 0, lv: 9 });
  assert.equal(b.of('who').length, 0);
  assert.equal(w.woke.length, 1);                 // one wake for the held-back roster
  w.room.tick();                                  // too early: nothing
  assert.equal(b.of('who').length, 0);
  w.t += ROSTER_EVERY; w.room.tick();
  assert.equal(b.of('who').length, 1);
  assert.deepEqual(b.last('who').list, [{ n: 'Cohen', map: 'cave1', region: '', lv: 9 }, { n: 'Jack', map: 'over', region: '', lv: 3 }]);
  assert.equal(w.room.due(), null);
  const c = w.knight('Zed');
  assert.equal(b.of('who').length, 2);            // a join goes at once
  w.room.leave(c);
  assert.equal(b.of('who').length, 3);            // so does a leave
});

test('one socket per knight: a second login closes the first and takes its place', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over'); w.t += 10;
  const a2 = w.sock(); w.room.join(a2, 'cohen');
  assert.equal(a.last('error').code, 'elsewhere');
  assert.deepEqual(a.closed, { code: 4000, reason: 'logged in elsewhere' });
  w.say(a2, { t: 'hello', v: 1 });
  assert.equal(a2.last('welcome').me, 'cohen');
  assert.deepEqual(w.room.online().map(k => k.n).sort(), ['Jack', 'cohen']);
  assert.equal(w.room.keeperOf('over').name, 'Jack');   // Jack has been on the map longer now
});

test('a keeper keeps the map until it leaves: coming back later does not take it from the newer keeper', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over'); w.t += 10;
  w.say(a, { t: 'p', map: 'cave1', x: 0, y: 0 }); w.t += 10;
  assert.equal(w.room.keeperOf('over').name, 'Jack');
  w.say(a, { t: 'p', map: 'over', x: 0, y: 0 });
  assert.equal(w.room.keeperOf('over').name, 'Jack');
  assert.equal(a.state.mapAt, w.t);
});

test('junk is ignored: bad JSON, no t, unknown t', () => {
  const w = world();
  const a = w.knight('Cohen', 'over');
  a.clear();
  w.room.message(a, '{not json');
  w.room.message(a, '[1,2]');
  w.room.message(a, '{"x":1}');
  w.room.message(a, '{"t":"teleport"}');
  w.room.message(a, 42);
  assert.equal(a.got.length, 0);
  assert.equal(a.closed, null);
});

test('restore rebuilds knights from their attachments without telling anyone', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over');
  w.say(a, { t: 'gift', to: 'Jack', id: 'bread', qty: 1 });
  // the world naps: a new Room, sockets come back in the wrong order
  const w2 = world(); w2.t = w.t;
  const a2 = w2.sock(), b2 = w2.sock();
  w2.room.restore(b2, b.state);
  w2.room.restore(a2, a.state);
  assert.equal(a2.got.length + b2.got.length, 0);
  assert.equal(w2.room.keeperOf('over').name, 'Cohen');
  assert.deepEqual(w2.room.online().map(k => k.n).sort(), ['Cohen', 'Jack']);
  w2.t += GIFT_WAIT; w2.room.tick();
  assert.equal(a2.last('gift_back').id, 'bread');   // the pending gift came back through the nap
});

test('the room fills up: error full and a close', () => {
  const w = world(); w.room.max = 2;
  w.knight('A1'); w.knight('B2');
  const c = w.sock(); w.room.join(c, 'C3');
  assert.equal(c.last('error').code, 'full');
  assert.equal(c.closed.code, 4004);
});

test('caps match the contract table', () => {
  assert.equal(CAPS.p.rate, 8); assert.equal(CAPS.mon.rate, 8); assert.equal(CAPS.hit.rate, 20); assert.equal(CAPS.gift.rate, 1);
  assert.equal(CAPS.chat.rate, 1 / 1.5); assert.equal(CAPS.hello.burst, 1);
});

test('a keeper that goes quiet while someone shares its map hands the map on, and is eligible again once that knight leaves', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Sam', 'over');
  w.settle(a, b);
  w.say(a, { t: 'mon', list: [] });                       // Cohen is streaming
  w.t += KEEPER_STALE - 500; w.room.tick();
  assert.equal(w.room.keeperOf('over').name, 'Cohen');    // not quiet for long enough yet
  assert.equal(a.of('keeper').length, 0);
  w.t += 1000; w.room.tick();                             // now it is
  assert.equal(w.room.keeperOf('over').name, 'Sam');
  assert.deepEqual(a.last('keeper'), { t: 'keeper', map: 'over', n: 'Sam' });
  assert.deepEqual(b.last('keeper'), { t: 'keeper', map: 'over', n: 'Sam' });
  b.clear(); w.say(a, { t: 'mon', list: [] });            // a late snapshot from the old keeper is dropped
  assert.equal(b.of('mon').length, 0);
  // Sam keeps streaming, so the map stays his for as long as he likes
  for (let i = 0; i < 5; i++) { w.t += 2000; w.say(b, { t: 'mon', list: [] }); w.room.tick(); }
  assert.equal(w.room.keeperOf('over').name, 'Sam');
  // the timer was booked for the silence check, not left to chance
  assert.ok(w.woke.length > 0);
  // Sam leaves: Cohen is longest on the map and no longer the quiet keeper, so it comes back to him
  a.clear(); w.room.leave(b);
  assert.equal(w.room.keeperOf('over').name, 'Cohen');
  assert.deepEqual(a.last('keeper'), { t: 'keeper', map: 'over', n: 'Cohen' });
});

test('a keeper alone on its map is never stepped down for being quiet', () => {
  const w = world();
  const a = w.knight('Cohen', 'over');
  w.t += KEEPER_STALE * 3; w.room.tick();
  assert.equal(w.room.keeperOf('over').name, 'Cohen');
  assert.equal(a.of('keeper').length, 0);
});
