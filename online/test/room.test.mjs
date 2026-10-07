// The Room: joins, relays, keepers, hits, gifts, caps, roster cadence. In-memory sockets, a fake clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, CAPS, GIFT_WAIT, ROSTER_EVERY, KEEPER_STALE, PRESENCE_STALE } from '../src/room.js';

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
  assert.deepEqual(welcome, { t: 'welcome', me: 'Cohen', at: 1000, keeper: 'Cohen', role: 'player' });
  assert.equal(a.of('who').length, 1);
  assert.deepEqual(a.last('who').list, [{ n: 'Cohen', map: 'over', region: '', lv: 0, role: 'player' }]);
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
  assert.deepEqual(b.last('p'), { t: 'p', n: 'Cohen', map: 'over', x: 10, y: 20, lv: 5, role: 'player' });
  assert.equal(a.of('p').length, 0);
  assert.equal(c.of('p').length, 0);
});

test('a full knight look (the six worn item ids, a girl) is relayed exactly; only a presence over 4096 characters is refused', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Jack', 'over');
  a.clear(); b.clear();
  // the longest ids the game has in each slot, as src/73-players.js lookOf() sends them
  const look = {
    tunic: '#3b6fb6', hair: '#8a4f24', shoulder: '#9a86e0', helm: '#9a86e0', body: '#9a86e0', shield: '#9a86e0',
    weapon: { shape: 'sword', color: '#9a86e0' }, tool: null, toolColor: null, rod: false, fists: false, hat: null, girl: true,
    gear: { helm: 'stormstone_helm', body: 'stormstone_body', legs: 'stormstone_legs', shield: 'stormstone_shield', cape: 'cape_woodcutting', weapon: 'fang_of_the_fang' },
  };
  const p = { t: 'p', map: 'over', region: 'Thistledown', x: 1234, y: 5678, fx: -0.71, fy: 0.71, mv: true, wt: 12.3, hp: 99, mhp: 123, lv: 126, look, mech: null, dead: false, def: 9999, act: null };
  const str = JSON.stringify(p);
  assert.ok(str.length < 1000, 'a full presence is about 600 characters: ' + str.length);
  w.say(a, p);
  assert.deepEqual(b.last('p'), Object.assign({}, p, { n: 'Cohen', role: 'player' }));
  // the server checks nothing inside look: only the size of the whole message (MAX_P) and the rate (CAPS.p)
  b.clear();
  const big = Object.assign({}, p, { look: Object.assign({}, look, { tunic: 'x'.repeat(4096 - str.length + 40) }) });
  assert.ok(JSON.stringify(big).length > 4096);
  // a second later, well inside the rate cap: what is refused is the size
  w.t += 1000; w.say(a, p); assert.equal(b.of('p').length, 1); assert.equal(a.of('error').length, 0); b.clear();
  w.say(a, big);
  assert.equal(b.of('p').length, 0);
  assert.equal(a.last('error').code, 'bad');
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
  assert.deepEqual(a.last('chat'), { t: 'chat', n: 'Cohen', text: 'what the ****', at: 1000, role: 'player' });
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
  assert.deepEqual(b.last('who').list, [{ n: 'Cohen', map: 'cave1', region: '', lv: 9, role: 'player' }, { n: 'Jack', map: 'over', region: '', lv: 3, role: 'player' }]);
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
  // admins and drop parties (docs/ONLINE.md, "Caps and validation, all new messages"): rate per second / burst
  const want = { mute: [1, 3], unmute: [1, 3], kick: [1, 3], ban: [1, 3], unban: [1, 3], modlist: [1, 2], spawn: [1, 3], spawn_clear: [1, 2], party: [0.2, 2], party_end: [1, 2], light: [4, 8], claim: [10, 50] };
  for (const [t, [rate, burst]] of Object.entries(want)) { assert.equal(CAPS[t].rate, rate, t + ' rate'); assert.equal(CAPS[t].burst, burst, t + ' burst'); }
});

test('a keeper that goes quiet while someone shares its map hands the map on, and is eligible again once that knight leaves', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Sam', 'over');
  w.settle(a, b);
  w.say(a, { t: 'mon', list: [] });                       // Cohen is streaming
  // Sam is playing: a playing game sends presence at least once a second (the room only hands a map to someone playing)
  const samPlays = () => w.say(b, { t: 'p', map: 'over', x: 1, y: 2, lv: 3 });
  w.t += KEEPER_STALE - 500; samPlays(); w.room.tick();
  assert.equal(w.room.keeperOf('over').name, 'Cohen');    // not quiet for long enough yet
  assert.equal(a.of('keeper').length, 0);
  w.t += 1000; samPlays(); w.room.tick();                 // now it is
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

test('a keeper whose game froze is replaced by one who is playing, and the frozen knight is not chosen again while it stays silent', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Sam', 'over');
  w.settle(a, b);
  assert.equal(w.room.keeperOf('over').name, 'Cohen');
  // Cohen's phone locks: no more mon, no more presence. Sam keeps playing: presence every second, and once he keeps, a heartbeat
  for (let i = 0; i < 12; i++) {
    w.t += 1000;
    w.say(b, { t: 'p', map: 'over', x: 5, y: 5, lv: 3 });
    if (w.room.keeperOf('over').name === 'Sam') w.say(b, { t: 'mon', list: [] });
    w.room.tick();
  }
  assert.equal(w.room.keeperOf('over').name, 'Sam');
  assert.ok(b.of('keeper').some(m => m.n === 'Sam'));
  // and the map never went back to the silent knight in those 12 seconds
  assert.ok(!b.of('keeper').some(m => m.n === 'Cohen'));
});

test('a playing knight is chosen over a silent one when the keeper leaves', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Sam', 'over'), c = w.knight('Ava', 'over');
  w.settle(a, b, c);
  // Sam goes silent; Ava keeps playing; Cohen (keeper) leaves
  w.t += PRESENCE_STALE + 500;
  w.say(c, { t: 'p', map: 'over', x: 1, y: 1, lv: 2 }); w.say(a, { t: 'mon', list: [] });
  w.room.leave(a);
  assert.equal(w.room.keeperOf('over').name, 'Ava');
});

// ---------- named bosses: boss_call (docs/ONLINE.md, "Named bosses: boss_call and helper credit") ----------
test('boss_call from a non-keeper reaches only the keeper of the sender\'s map, with the sender named', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over'); w.t += 10;
  const c = w.knight('Zed', 'over');
  w.settle(a, b, c);
  w.say(b, { t: 'boss_call', id: 'the_fang' });
  assert.deepEqual(a.of('boss_call'), [{ t: 'boss_call', n: 'Jack', id: 'the_fang' }]);
  assert.equal(b.of('boss_call').length, 0);
  assert.equal(c.of('boss_call').length, 0);
});

test('boss_call from the keeper is not relayed anywhere', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over');
  w.settle(a, b);
  w.say(a, { t: 'boss_call', id: 'gnasher' });
  assert.equal(a.of('boss_call').length, 0);
  assert.equal(b.of('boss_call').length, 0);
});

test('boss_call with a bad id (capitals, longer than 24, not a string, missing) is dropped', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over');
  w.settle(a, b);
  for (const id of ['The_Fang', 'a'.repeat(25), 42, null, undefined, '', 'war-shed', 'fang 1']) { w.t += 5000; w.say(b, { t: 'boss_call', id }); }
  assert.equal(a.of('boss_call').length, 0);
  w.t += 5000; w.say(b, { t: 'boss_call', id: 'a'.repeat(24) });
  assert.equal(a.of('boss_call').length, 1);
});

test('boss_call is capped at 0.5 a second with a burst of 2', () => {
  assert.equal(CAPS.boss_call.rate, 0.5); assert.equal(CAPS.boss_call.burst, 2);
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over');
  w.settle(a, b);
  for (let i = 0; i < 4; i++) w.say(b, { t: 'boss_call', id: 'war_shed' });
  assert.equal(a.of('boss_call').length, 2);
  assert.equal(b.last('error').code, 'bad');
  b.clear(); a.clear();
  // two seconds later one more token has come back, and sending at the cap is never punished
  for (let i = 0; i < 10; i++) { w.t += 2000; w.say(b, { t: 'boss_call', id: 'war_shed' }); }
  assert.equal(a.of('boss_call').length, 10);
  assert.equal(b.of('error').length, 0);
});

test('a keeper on another map does not receive boss_call', () => {
  const w = world();
  const a = w.knight('Cohen', 'tinker_lab'); w.t += 10;
  const b = w.knight('Jack', 'over'); w.t += 10;
  const c = w.knight('Zed', 'over');
  w.settle(a, b, c);
  // Jack keeps the overworld; Cohen keeps the lab. Zed asks from the overworld: only Jack hears it
  w.say(c, { t: 'boss_call', id: 'gnasher' });
  assert.equal(a.of('boss_call').length, 0);
  assert.deepEqual(b.of('boss_call'), [{ t: 'boss_call', n: 'Zed', id: 'gnasher' }]);
});

test('boss_call passes the first flag on only when it is exactly true', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over');
  w.settle(a, b);
  w.say(b, { t: 'boss_call', id: 'the_fang', first: true }); w.t += 3000;
  w.say(b, { t: 'boss_call', id: 'the_fang', first: 'yes' }); w.t += 3000;
  w.say(b, { t: 'boss_call', id: 'the_fang', first: 1 });
  assert.deepEqual(a.of('boss_call'), [{ t: 'boss_call', n: 'Jack', id: 'the_fang', first: true }, { t: 'boss_call', n: 'Jack', id: 'the_fang' }, { t: 'boss_call', n: 'Jack', id: 'the_fang' }]);
});

test('boss_wait from the keeper reaches only the named knight on its map, with id and left', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'); w.t += 10;
  const b = w.knight('Jack', 'over'); w.t += 10;
  const c = w.knight('Zed', 'over'); w.t += 10;
  const d = w.knight('Pip', 'tinker_lab');
  w.settle(a, b, c, d);
  w.say(a, { t: 'boss_wait', to: 'Jack', id: 'the_fang', left: 125, extra: 'x' });
  assert.deepEqual(b.of('boss_wait'), [{ t: 'boss_wait', id: 'the_fang', left: 125 }]);
  assert.equal(c.of('boss_wait').length, 0);
  // a knight on another map, and a boss_wait from a knight who does not keep the map, go nowhere
  w.t += 2000; w.say(a, { t: 'boss_wait', to: 'Pip', id: 'gnasher', left: 5 });
  w.t += 2000; w.say(c, { t: 'boss_wait', to: 'Jack', id: 'the_fang', left: 5 });
  assert.equal(d.of('boss_wait').length, 0);
  assert.equal(b.of('boss_wait').length, 1);
  assert.equal(CAPS.boss_wait.rate, 1); assert.equal(CAPS.boss_wait.burst, 3);
});

// ---------- the shared world, Stage 1 (docs/ONLINE.md, "The shared world") ----------
test('each knight\'s island is his own: two knights on their islands never see each other, each keeps his own, and every message names the map house', () => {
  const w = world();
  const a = w.knight('Cohen', 'over'), b = w.knight('Jack', 'over'), c = w.knight('Zed', 'over');
  w.settle(a, b, c);
  w.say(a, { t: 'p', map: 'house', x: 100, y: 100, lv: 3 });
  w.say(b, { t: 'p', map: 'house', x: 120, y: 100, lv: 3 });
  // each heard he keeps his own island, named house
  assert.deepEqual(a.last('keeper'), { t: 'keeper', map: 'house', n: 'Cohen' });
  assert.deepEqual(b.last('keeper'), { t: 'keeper', map: 'house', n: 'Jack' });
  // the knight left behind on the overworld hears each go, as house never
  assert.deepEqual(c.of('left').map(m => [m.n, m.map]), [['Cohen', 'over'], ['Jack', 'over']]);
  a.clear(); b.clear(); c.clear();
  w.say(a, { t: 'p', map: 'house', x: 110, y: 100, lv: 3 });
  w.say(b, { t: 'p', map: 'house', x: 130, y: 100, lv: 3 });
  assert.equal(a.of('p').length, 0); assert.equal(b.of('p').length, 0); assert.equal(c.of('p').length, 0);
  // a game naming another knight's island key still lands on its own
  w.say(b, { t: 'p', map: 'house:cohen', x: 130, y: 100, lv: 3 });
  assert.equal(a.of('p').length, 0);
  assert.equal(w.room.keeperOf('house:cohen').name, 'Cohen');
  assert.equal(w.room.keeperOf('house:jack').name, 'Jack');
  // the roster and the parent page say house; the attachment keeps the key, so a nap puts him back on his own island
  assert.deepEqual(w.room.online().map(k => [k.n, k.map]), [['Cohen', 'house'], ['Jack', 'house'], ['Zed', 'over']]);
  assert.equal(a.state.map, 'house:cohen');
  // a trade ask between the two islands is refused as another map
  w.say(a, { t: 'trade_ask', to: 'Jack' });
  assert.equal(a.last('trade_no').code, 'map');
  // back to the overworld: seen again
  w.say(a, { t: 'p', map: 'over', x: 5, y: 5, lv: 3 });
  assert.deepEqual(c.last('p'), { t: 'p', n: 'Cohen', map: 'over', x: 5, y: 5, lv: 3, role: 'player' });
});

test('hello caps and atlas are kept with the knight (known caps only, in order), ride the attachment over a nap, and welcome names the world\'s Atlas', () => {
  const atlas = { hash: 'ab12cd34ef56ab78', knows: () => false, speedMax: 350 };
  let t = 1000;
  const room = new Room({ now: () => t, wake: () => { }, atlas });
  const s = { got: [], state: null, send(str) { s.got.push(JSON.parse(str)); }, close() { }, attach(st) { s.state = st; } };
  room.join(s, 'Cohen');
  room.message(s, JSON.stringify({ t: 'hello', v: 1, caps: ['zone', 'bogus', 'tick', 'tick', 7], atlas: 'ab12cd34ef56ab78' }));
  assert.equal(s.got[0].t, 'welcome'); assert.equal(s.got[0].atlas, 'ab12cd34ef56ab78');
  assert.deepEqual(s.state.caps, ['tick', 'zone']); assert.equal(s.state.atlas, 'ab12cd34ef56ab78');
  assert.deepEqual(room.knightsView(), [{ n: 'Cohen', map: 'over', atlas: 'same', caps: ['tick', 'zone'] }]);
  // a nap: a new Room rebuilt from the attachment keeps both
  const again = new Room({ now: () => t, wake: () => { }, atlas });
  const s2 = { got: [], send(str) { s2.got.push(JSON.parse(str)); }, close() { }, attach() { } };
  again.restore(s2, s.state);
  assert.deepEqual(again.knightsView(), [{ n: 'Cohen', map: 'over', atlas: 'same', caps: ['tick', 'zone'] }]);
  // an old page: no caps, no atlas; junk is dropped
  const o = { got: [], send(str) { o.got.push(JSON.parse(str)); }, close() { }, attach() { } };
  room.join(o, 'Old'); room.message(o, JSON.stringify({ t: 'hello', v: 1, caps: 'tick', atlas: 'NOT A HASH!' }));
  assert.deepEqual(room.knightsView().find(k => k.n === 'Old'), { n: 'Old', map: 'over', atlas: 'none', caps: [] });
  const n = { got: [], send(str) { n.got.push(JSON.parse(str)); }, close() { }, attach() { } };
  room.join(n, 'Newer'); room.message(n, JSON.stringify({ t: 'hello', v: 1, caps: [], atlas: '0000000000000000' }));
  assert.equal(room.knightsView().find(k => k.n === 'Newer').atlas, 'old');
  // a world with no Atlas says none in welcome
  const w = world(); const a = w.knight('Cohen');
  assert.equal('atlas' in a.last('welcome'), false);
});

// The Great Spread (spec §11): a page from an older world (its hello names another Atlas, or none) is keyed apart on every
// map ('over' is 'over@stale' in the Room), so it never shares presence, keepers or trades with the new world; two old
// pages still see each other, every message to a game names the map as it knows it ('over'), and a nap keeps the keying.
test('an older world\'s page is keyed onto over@stale: no presence, keeper or trade with the new world; old pages share with each other; a nap keeps it', () => {
  const atlas = { hash: 'ab12cd34ef56ab78', knows: () => false, speedMax: 350 };
  let t = 1000;
  const room = new Room({ now: () => t, wake: () => { }, atlas });
  const sock = () => { const s = { got: [], state: null, send(str) { s.got.push(JSON.parse(str)); }, close() { }, attach(st) { s.state = st; } }; s.of = k => s.got.filter(m => m.t === k); return s; };
  const knight = (name, a) => { const s = sock(); room.join(s, name); room.message(s, JSON.stringify(Object.assign({ t: 'hello', v: 1, caps: [] }, a === undefined ? {} : { atlas: a }))); return s; };
  const nu = knight('New', atlas.hash), old = knight('Old', '0000000000000000'), none = knight('Older');
  // each side keeps its own monsters: the first on each map is its keeper
  assert.equal(nu.of('welcome')[0].keeper, 'New');
  assert.equal(old.of('welcome')[0].keeper, 'Old');
  assert.equal(none.of('welcome')[0].keeper, 'Old', 'two old pages share one stale overworld');
  assert.equal(old.of('welcome')[0].atlas, atlas.hash, 'the old page hears the new Atlas (96-atlas shows its reload plaque)');
  assert.equal(old.state.map, 'over@stale'); assert.equal(nu.state.map, 'over');
  for (const s of [nu, old, none]) s.got.length = 0;
  room.message(nu, JSON.stringify({ t: 'p', map: 'over', x: 100, y: 100 }));
  room.message(old, JSON.stringify({ t: 'p', map: 'over', x: 110, y: 100 }));
  assert.deepEqual(old.of('p'), [], 'the old page never sees the new knight');
  assert.deepEqual(nu.of('p'), [], 'the new page never sees the old knight');
  assert.deepEqual(none.of('p').map(m => [m.n, m.map]), [['Old', 'over']], 'old pages see each other, on the map their game knows');
  // an instance is keyed apart too, and a trade between the two worlds is refused as another map
  room.message(nu, JSON.stringify({ t: 'p', map: 'deepholm', x: 100, y: 100 }));
  room.message(old, JSON.stringify({ t: 'p', map: 'deepholm', x: 110, y: 100 }));
  assert.equal(old.state.map, 'deepholm@stale');
  room.message(old, JSON.stringify({ t: 'trade_ask', to: 'New' }));
  assert.equal(old.of('trade_no').pop().code, 'map');
  assert.deepEqual(room.knightsView().map(k => [k.n, k.map, k.atlas]), [['New', 'deepholm', 'same'], ['Old', 'deepholm', 'old'], ['Older', 'over', 'none']]);
  // a nap: rebuilt from the attachments, the keying holds (and is worked out again from this world's Atlas)
  const again = new Room({ now: () => t, wake: () => { }, atlas });
  for (const s of [nu, old]) { const s2 = sock(); again.restore(s2, s.state); }
  assert.deepEqual(Array.from(again.maps.keys()).sort(), ['deepholm', 'deepholm@stale']);
  // the same attachment in a world with no Atlas (nothing judged): not keyed apart
  const bare = new Room({ now: () => t, wake: () => { }, atlas: null });
  bare.restore(sock(), old.state);
  assert.deepEqual(Array.from(bare.maps.keys()), ['deepholm']);
});

// Review round 3 (4 Oct 2026): two knights whose games have stopped (sockets open) on one map, the Room rebuilt from their
// sockets after a nap in either order. Before the fix, when the knight restored first had also come first, his stale moment
// stayed in the past and every alarm asked for the next one at that same moment (thousands in one instant; in workerd the loop
// ends with no alarm ever set again on that wake). Now a stale keeper still the best starts a new grace, and a tick's own
// re-arm is never at or before the moment it handled.
test('two silent knights restored after a nap, in either order: the alarm never asks again for a moment already handled', () => {
  for (const first of ['Ann', 'Ben']) for (const arrived of ['Ann', 'Ben']) {
    let now = 1_000_000, at = null, asked = 0;
    const mk = name => { const s = { name, got: [], att: null, send(str) { s.got.push(JSON.parse(str)); }, close() { }, attach(a) { s.att = a; } }; return s; };
    const R1 = new Room({ now: () => now, wake: () => { } });
    const a = mk('Ann'), b = mk('Ben');
    for (const s of arrived === 'Ann' ? [a, b] : [b, a]) { R1.join(s, s.name); R1.message(s, JSON.stringify({ t: 'hello', v: 1, caps: [] })); R1.message(s, JSON.stringify({ t: 'p', map: 'deepholm', x: 600, y: 1032 })); now += 1000; }
    now += 60000;
    const R2 = new Room({ now: () => now, wake: ms => { asked++; at = now + ms; } });
    for (const s of first === 'Ann' ? [a, b] : [b, a]) R2.restore(s, s.att);
    const end = now + 60000, handled = [];
    let alarms = 0;
    while (at != null && at <= end && alarms < 200) { const t = at; at = null; now = t; alarms++; handled.push(t); R2.tick(); if (at != null) assert.ok(at > t, `restored ${first} first, ${arrived} came first: alarm ${alarms} at ${t - 1_000_000} asks for ${at - 1_000_000}`); }
    assert.ok(alarms <= 60000 / KEEPER_STALE + 1, `restored ${first} first, ${arrived} came first: ${alarms} alarms in 60 s`);
    assert.equal(new Set(handled).size, handled.length, 'never the same moment twice');
  }
});
