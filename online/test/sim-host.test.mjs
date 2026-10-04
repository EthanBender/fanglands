// SimHost (docs/ONLINE.md, "The shared world", Stage 0): the copies' lifecycle, the tick and the watchdog, with a stub
// makeGame so every rule is checked exactly and fast. The real game copy runs through SimHost in tools/sim-suite.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimHost, TICK_MS, SUBSTEPS, MAX_CATCHUP, IDLE_STOP_MS, DROP_EMPTY_MS, CAP, WATCH, presenceOf, quantiles } from '../src/sim/host.js';

// A stub game: what the stand-in's API looks like from SimHost's side, with knobs for throws and slowness.
function stubWorld() {
  const W = { made: [], cfg: { bootThrow: new Set(), stepThrow: new Set(), stepMs: {} } };
  W.makeGame = w => {
    const me = { map: w.__worldKeeper.map, w, steps: [], got: [], nows: [], timersRan: 0, monsters: Array.from({ length: 5 }, (_, i) => ({ i })) };
    W.made.push(me);
    if (W.cfg.bootThrow.has(me.map)) throw new Error('boom at boot');
    w.WORLDKEEPER = {
      start() { me.started = true; },
      deliver(m) { me.got.push(m); },
      step(dt) {
        me.steps.push(dt); me.nows.push(w.__now);
        if (W.cfg.stepThrow.has(me.map)) throw new Error('boom in a step');
        const ms = W.cfg.stepMs[me.map]; if (ms) W.clockNow += ms / SUBSTEPS;
        if (dt && me.steps.length % SUBSTEPS === 0) w.__worldKeeper.send({ t: 'mon', k: me.steps.length / SUBSTEPS });
      },
    };
    return { peek: n => n === 'monsters' ? me.monsters : null, poke() { }, window: w };
  };
  W.clockNow = 0;
  return W;
}
// a fake clock and timer queue the test drives
function fakeTime(start = 1_000_000) {
  const T = { now: start, timers: [], seq: 0 };
  T.set = (f, ms) => { const id = ++T.seq; T.timers.push({ id, at: T.now + ms, f }); return id; };
  T.clear = id => { T.timers = T.timers.filter(t => t.id !== id); };
  // run every timer due up to `to`, in order, moving the clock to each
  // extra(): wall time a callback's own work takes (the clock moves after it); delay(): how late the machine lands each timer
  T.advance = (ms, extra = () => 0, delay = () => 0) => {
    const to = T.now + ms;
    for (;;) {
      T.timers.sort((a, b) => a.at - b.at);
      const t = T.timers[0]; if (!t || t.at > to) break;
      T.timers.shift(); T.now = Math.max(T.now, t.at) + delay(); t.f(); T.now += extra();
    }
    T.now = Math.max(T.now, to);
  };
  return T;
}
function host(W, T, opts = {}) {
  const fell = [], sent = [];
  const h = new SimHost({ makeGame: W.makeGame, now: () => T.now, clock: () => W.clockNow, timer: T, onFallback: (map, reason) => fell.push([map, reason]), onSend: (map, list) => sent.push([map, list]), ...opts });
  return { h, fell, sent };
}
const ben = { n: 'Ben', x: 480, y: 480, fx: 1, fy: 0, dead: false, def: 576, lv: 4, att: 300, mh: 3, law: 0, spd: 175 };

test('a tick: the clock, then due timers, then queued messages, then every knight as p, then 3 substeps of 1/30, then what the copy sent', () => {
  const W = stubWorld(), T = fakeTime();
  const { h, sent } = host(W, T);
  const c = h.boot('over');
  assert.ok(c && W.made[0].started, 'booted and started');
  assert.equal(c.w.__worldKeeper.map, 'over');
  let timerAt = null;
  c.w.setTimeout(() => { timerAt = c.w.__now; W.made[0].got.push('timer'); }, 50);
  h.setKnights('over', [ben, { n: 'Ann', x: 600, y: 480 }]);
  h.deliver('over', { t: 'hit', nid: 's3', n: 'Ben', dmg: 4 });
  h.stop();   // drive ticks by hand here
  h.tick(T.now + 100);
  const me = W.made[0];
  assert.equal(timerAt, T.now + 100, 'the timer ran with the tick\'s clock');
  assert.deepEqual(me.got.map(m => typeof m === 'string' ? m : m.t + ':' + (m.n || '')), ['timer', 'hit:Ben', 'p:Ben', 'p:Ann']);
  assert.deepEqual(me.got[2], { t: 'p', n: 'Ben', map: 'over', x: 480, y: 480, dead: false, fx: 1, fy: 0, def: 576, lv: 4, att: 300, mh: 3, law: 0, spd: 175 });
  assert.deepEqual(me.steps, [1 / 30, 1 / 30, 1 / 30]);
  assert.ok(me.nows.every(n => n === T.now + 100));
  assert.deepEqual(sent, [['over', [{ t: 'mon', k: 1 }]]]);
  // a knight who goes is told as left, once
  h.setKnights('over', [ben]);
  h.tick(T.now + 200);
  assert.deepEqual(me.got.slice(4).map(m => m.t + ':' + m.n), ['left:Ann', 'p:Ben']);
  assert.equal(presenceOf({ n: 'X', x: 1, y: 2, lv: NaN }, 'aerie').lv, undefined, 'junk numbers are left out');
});

test('watchdog: a boot throw falls back at once, and the map stays on the keeper path until allowed again', () => {
  const W = stubWorld(), T = fakeTime();
  const { h, fell } = host(W, T);
  W.cfg.bootThrow.add('aerie');
  assert.equal(h.boot('aerie'), null);
  assert.deepEqual(fell, [['aerie', 'boot']]);
  assert.equal(h.fallbacks[0].info.error, 'boom at boot');
  W.cfg.bootThrow.delete('aerie');
  assert.equal(h.boot('aerie'), null, 'refused while on the keeper path');
  assert.equal(h.refusedReason('aerie'), 'boot');
  assert.ok(h.allow('aerie'));
  assert.ok(h.boot('aerie'));
  assert.equal(h.boot('house'), null, 'the house is never simulated');
});

test('watchdog: 3 tick throws inside 10 s fall back; throws spread wider than that do not', () => {
  const W = stubWorld(), T = fakeTime();
  const { h, fell } = host(W, T);
  h.boot('over'); h.boot('coalmine');
  h.setKnights('over', [ben]); h.setKnights('coalmine', [{ ...ben, n: 'Ann' }]); h.stop();
  W.cfg.stepThrow.add('coalmine');
  let t = T.now;
  h.tick(t += 100); h.tick(t += 6000);
  W.cfg.stepThrow.delete('coalmine'); h.tick(t += 3000); W.cfg.stepThrow.add('coalmine');
  h.tick(t += 4100);   // 3 throws, but the first is 10.1 s old
  assert.deepEqual(fell, []);
  assert.equal(h.copies.get('coalmine').errors, 3);
  h.tick(t += 100);
  assert.deepEqual(fell, [['coalmine', 'throws']]);
  assert.ok(!h.copies.has('coalmine') && h.copies.has('over'), 'only the broken map falls back');
});

test('watchdog: 3 ticks in a row over 25 ms fall back; a quick tick between resets the count', () => {
  const W = stubWorld(), T = fakeTime();
  const { h, fell } = host(W, T);
  h.boot('over'); h.setKnights('over', [ben]); h.stop();
  let t = T.now;
  const tickAt = ms => { W.cfg.stepMs.over = ms; h.tick(t += 100); };
  tickAt(30); tickAt(30); tickAt(5); tickAt(30); tickAt(30);
  assert.deepEqual(fell, []);
  tickAt(25.5);
  assert.deepEqual(fell, [['over', 'slow']]);
  assert.equal(h.stats().tick.n, 6);
  assert.equal(h.stats().tick.max, 30);
});

test('watchdog: the cap is the overworld plus 3 instances; one more stays on the keeper path', () => {
  const W = stubWorld(), T = fakeTime();
  const { h, fell } = host(W, T);
  assert.equal(CAP, 4);
  for (const m of ['over', 'deepholm', 'aerie', 'coalmine']) assert.ok(h.boot(m), m);
  assert.equal(h.boot('spider_den'), null);
  assert.deepEqual(fell, [['spider_den', 'cap']]);
  assert.equal(h.copies.size, 4);
});

test('watchdog: the heap over budget drops the newest instance copy first, never the overworld before an instance', () => {
  const W = stubWorld(), T = fakeTime();
  let heap = 10 * 1048576;
  const { h, fell } = host(W, T, { heap: () => heap });
  h.boot('over'); T.now += 1; h.boot('deepholm'); T.now += 1; h.boot('aerie');
  assert.deepEqual(fell, []);
  heap = WATCH.heapBytes + 1;
  h.checkHeap();
  assert.deepEqual(fell, [['aerie', 'heap']]);
  assert.equal(h.stats().heap, WATCH.heapBytes + 1);
});

test('the loop: a setTimeout chain at 10 Hz, at most 3 catch-up ticks, then time is skipped and counted', () => {
  const W = stubWorld(), T = fakeTime();
  const { h } = host(W, T);
  h.boot('over');
  h.setKnights('over', [ben]);   // a knight arriving starts the loop
  assert.ok(h.running);
  T.advance(1000);
  assert.equal(h.ticks, 10);
  // a stall: the next timer fires 1,000 ms late -> 1 + 3 ticks run, the rest of the time is skipped
  const due = T.timers[0].at;
  T.timers[0].at = due + 1000;
  T.advance(1150);
  const first = 10 + 1 + MAX_CATCHUP;
  assert.equal(h.skipped, 7, 'the 11 ticks owed less the 4 run');
  assert.ok(h.ticks >= first && h.ticks <= first + 1, String(h.ticks));
  assert.equal(TICK_MS, 100);
});

test('the loop stops 60 s after the last knight leaves; a copy is dropped 60 s after its own map empties', () => {
  const W = stubWorld(), T = fakeTime();
  const { h } = host(W, T);
  h.boot('over'); h.boot('aerie');
  h.setKnights('over', [ben]); h.setKnights('aerie', [{ ...ben, n: 'Ann' }]);
  T.advance(5000);
  h.setKnights('aerie', []);           // Ann leaves the aerie; Ben plays on
  T.advance(DROP_EMPTY_MS - 200);
  assert.ok(h.copies.has('aerie'), 'still there just under 60 s');
  T.advance(400);
  assert.ok(!h.copies.has('aerie') && h.copies.has('over'), 'dropped at 60 s');
  h.setKnights('over', []);            // Ben leaves too
  T.advance(IDLE_STOP_MS - 200);
  assert.ok(h.running);
  T.advance(400);
  assert.ok(!h.running, 'the loop stops at 60 s');
  assert.equal(T.timers.length, 0, 'no timer left, so the object can nap');
  assert.ok(!h.copies.has('over'), 'and the empty overworld copy is gone with it');
  // a knight coming back starts it again
  h.boot('over'); h.setKnights('over', [ben]);
  assert.ok(h.running && T.timers.length === 1);
});

test('lag timing (workerd): a tick\'s own cost is the gap to a zero-delay timer after it less the gap to a second one after that, so a busy machine never reads as a slow copy', () => {
  const W = stubWorld(), T = fakeTime();
  const { h, fell } = host(W, T, { timing: 'lag' });
  h.boot('over'); h.setKnights('over', [ben]);
  // the ticks "take" `work` ms each of wall time (the clock moves after the work, as in workerd); the machine lands every timer
  // `busy` ms late (load from anything else: other processes, other events on the object)
  let work = 8, busy = 0, seen = h.ticks;
  const cost = () => { const n = h.ticks - seen; seen = h.ticks; return n * work; }, late = () => busy;
  T.advance(1000, cost, late);
  const st = h.stats().tick;
  assert.ok(st.n >= 8, String(st.n));
  assert.ok(st.p50 >= 7.9 && st.p50 <= 8.1, JSON.stringify(st));
  assert.deepEqual(fell, []);
  // a synthetic busy machine: every timer 20 ms late (the single-timer reading of the round before was 21 ms a tick) and then
  // 40 ms late (it read 41: three of those in a row handed the map back), while the ticks' own work is 1 ms: never slow
  work = 1; busy = 20; T.advance(5000, cost, late);
  { const q = quantiles(h.tickTimes.slice(-20)); assert.ok(q.p50 >= 0.9 && q.p50 <= 1.1, JSON.stringify(q)); }
  busy = 40; T.advance(5000, cost, late);
  assert.deepEqual(fell, [], 'machine load alone never hands the map back');
  assert.ok(h.noisy > 0, 'readings with the machine itself over the bar are set aside: ' + h.noisy);
  // one 2 s stall of the machine between the ticks and the first timer: one slow reading, never three in a row
  busy = 0; let once = 2000; T.advance(1000, cost, () => { const d = once; once = 0; return d; });
  T.advance(2000, cost, late);
  assert.deepEqual(fell, []);
  // the copy itself slow (30 ms a tick) on a mildly busy machine (10 ms): three in a row, handed back
  work = 30; busy = 10; T.advance(1000, cost, late);
  assert.deepEqual(fell, [['over', 'slow']]);
  assert.equal(h.fallbacks[0].info.timing, 'lag');
  assert.ok(h.fallbacks[0].info.ms >= 29 && h.fallbacks[0].info.ms <= 31 && h.fallbacks[0].info.idle === 10, JSON.stringify(h.fallbacks[0].info));
});

test('quantiles', () => {
  assert.deepEqual(quantiles([]), { n: 0, p50: null, p99: null, max: null });
  assert.deepEqual(quantiles(Array.from({ length: 100 }, (_, i) => i + 1)), { n: 100, p50: 51, p99: 100, max: 100 });
});

// ============================================================================
// Stage 2: the real Room with a SimHost wired in (docs/ONLINE.md, "The shared world", Stage 2). The copy is a stub that
// answers like the stand-in: it takes 'keeper' messages, says its rows each tick only while it keeps the map, and keeps rests.
// ============================================================================
import { Room } from '../src/room.js';
import { SimBook } from '../src/sim/book.js';
import { WORLD_READY, JOIN_WAIT, STALE, SILENT, REALM_EVERY } from '../src/sim/worlds.js';

function stubCopies() {
  const W = { made: [], cfg: { bootThrow: new Set(), stepThrow: new Set(), stepMs: {} }, clockNow: 0 };
  W.makeGame = w => {
    const map = w.__worldKeeper.map, me = { map, w, got: [], keeper: '@world:' + map, rests: {}, restsSet: null, steps: 0 };
    me.rows = [['i0', 'dwarf_guard', 600, 1032, 90, 90, 'idle', 1, 0, 0, 0, 0, 0, 0], ['i9', 'dwarf_guard', 600 + 30 * 48, 1032, 90, 90, 'idle', 1, 0, 0, 0, 0, 0, 0]];
    W.made.push(me);
    if (W.cfg.bootThrow.has(map)) throw new Error('boom at boot');
    w.WORLDKEEPER = {
      start() { },
      deliver(m) { me.got.push(m); if (m.t === 'keeper') me.keeper = m.n; },
      step() { me.steps++; if (W.cfg.stepThrow.has(map)) throw new Error('boom in a step'); const ms = W.cfg.stepMs[map]; if (ms) W.clockNow += ms / SUBSTEPS; },
      rows() { return me.keeper === '@world:' + map ? me.rows : []; },
      rests() { return me.rests; },
      setRests(l) { me.restsSet = l; },
    };
    return { peek: n => n === 'monsters' ? [] : null, poke() { }, window: w };
  };
  return W;
}
// a Room over a fake clock, with a SimHost on the same clock; the alarm (wake) is the fake timer too
function shared({ book = null, cap, maps = { deepholm: 'world' } } = {}) {
  const W = stubCopies(), T = fakeTime(), S = { W, T, socks: [] };
  S.book = book || new SimBook(null, () => T.now);
  // S.alarms: how many times the Room's alarm went off (each is a billed Durable Object request)
  S.alarms = 0;
  S.room = new Room({ now: () => T.now, wake: ms => T.set(() => { S.alarms++; S.room.tick(); }, ms), simBook: S.book, simSave: sw => { S.saved = sw; } });
  S.host = new SimHost({ makeGame: W.makeGame, now: () => T.now, clock: () => W.clockNow, timer: T, cap, onFallback: (m, r, row) => S.room.worlds.fell(m, r, row), onSend: (m, l) => S.room.worlds.fromCopy(m, l) });
  S.room.setSim({ move: 'observe', maps });
  S.room.worlds.useHost(S.host);
  S.sock = name => { const s = { name, got: [], send(str) { s.got.push(JSON.parse(str)); }, close() { }, attach() { } }; s.of = t => s.got.filter(m => m.t === t); s.last = t => { const l = s.of(t); return l[l.length - 1]; }; S.socks.push(s); return s; };
  S.say = (s, m) => S.room.message(s, JSON.stringify(m));
  S.knight = (name, map, x = 600, y = 1032) => { const s = S.sock(name); S.room.join(s, name); S.say(s, { t: 'hello', v: 1 }); if (map) S.say(s, { t: 'p', map, x, y, lv: 30, def: 576, hp: 99, mhp: 99, spd: 175 }); return s; };
  S.p = (s, map, x = 600, y = 1032) => S.say(s, { t: 'p', map, x, y, lv: 30, def: 576, hp: 99, mhp: 99, spd: 175 });
  // a whole take-over: the first knight keeps the map, the alarm builds the copy, his snapshot hands it over
  S.takeOver = (s, map = 'deepholm') => { T.advance(0); S.say(s, { t: 'mon', list: [['i0', 'dwarf_guard', 600, 1032, 80, 90, 'idle', 1, 0, 0, 0, 0, 0, 0]] }); };
  return S;
}

test('Stage 2: the first knight keeps a world map in his own game; the copy built right after reads his stream, then the virtual knight keeps it', () => {
  const S = shared();
  const ann = S.knight('Ann', 'deepholm');
  assert.equal(S.room.keeperOf('deepholm').name, 'Ann', 'nobody waits for a copy: Ann keeps it first');
  assert.equal(S.W.made.length, 0, 'not built inside her presence');
  S.T.advance(0);   // the Room's alarm
  const c = S.W.made[0];
  assert.ok(c && c.map === 'deepholm', 'built at the next alarm');
  S.T.advance(100);
  assert.deepEqual(c.got[0], { t: 'keeper', map: 'deepholm', n: 'Ann' }, 'the copy starts as a non-keeper fed by Ann');
  assert.equal(S.room.keeperOf('deepholm').name, 'Ann');
  S.say(ann, { t: 'mon', list: [['i0', 'dwarf_guard', 600, 1032, 80, 90, 'idle', 1, 0, 0, 0, 0, 0, 0]] });
  S.T.advance(100);
  assert.deepEqual(c.got.filter(m => m.t !== 'p').map(m => m.t + ':' + m.n), ['keeper:Ann', 'mon:Ann', 'keeper:@world:deepholm'], 'her snapshot, then the copy becomes keeper (its handoff)');
  assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm');
  assert.deepEqual(ann.last('keeper'), { t: 'keeper', map: 'deepholm', n: '@world:deepholm', server: true });
  // the world's mon reaches her once a tick, named for the virtual knight, with k and at
  ann.got.length = 0; S.T.advance(1000);
  const mons = ann.of('mon');
  assert.ok(mons.length >= 9 && mons.length <= 11, String(mons.length));
  assert.ok(mons.every(m => m.n === '@world:deepholm' && Number.isInteger(m.k) && m.at > 0 && Array.isArray(m.list)));
  assert.deepEqual(mons[mons.length - 1].list.map(r => r[0]), ['i0'], 'only the monster within 24 tiles of her');
});

test('Stage 2: the virtual knight is always keeper and never stale; it is never in who, never sent presence, never gifted, traded with or logged in, and its keeper message says server', () => {
  const S = shared();
  const ann = S.knight('Ann', 'deepholm'); S.takeOver(ann);
  const ben = S.knight('Ben', 'deepholm', 640, 1032);
  assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm', 'a newcomer never takes it');
  assert.deepEqual(ben.last('keeper'), { t: 'keeper', map: 'deepholm', n: '@world:deepholm', server: true }, 'told on arrival');
  for (let i = 0; i < 30; i++) { S.T.advance(1000); S.p(ben, 'deepholm', 640 + i, 1032); }   // Ann's game sends nothing at all for 30 s
  assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm', 'never taken for a silent keeper while the copy ticks');
  assert.ok(!S.room.online().some(k => k.n.startsWith('@world')), 'not in who');
  assert.ok(!ben.last('who').list.some(k => k.n.startsWith('@world')));
  assert.ok(!S.socks.some(s => s.of('p').some(p => p.n.startsWith('@world'))), 'no presence from it');
  assert.ok(S.room.worlds.view().modes.deepholm === 'world');
  // never gifted, traded with or logged in: it is not one of the Room's knights at all
  S.say(ben, { t: 'gift', to: '@world:deepholm', id: 'coins', qty: 5 });
  assert.equal(ben.last('gift_back').id, 'coins', 'a gift to it comes straight back');
  S.say(ben, { t: 'trade_ask', to: '@world:deepholm' });
  assert.equal(ben.last('trade_no').code, 'offline', 'a trade with it is refused');
  assert.equal(S.room.isOnline('@world:deepholm'), false);
  assert.equal(S.room.loginOf('@world:deepholm'), null, 'no login row');
  // a hit and a boss call go to the copy, as to any keeper
  S.say(ben, { t: 'hit', nid: 'i0', dmg: 4, knock: 14, bomb: false });
  S.T.advance(100);
  assert.ok(S.W.made[0].got.some(m => m.t === 'hit' && m.n === 'Ben' && m.nid === 'i0' && m.dmg === 4));
  // what the copy sends: kill and hurt to one knight on the map; its own presence and snapshots go nowhere
  ben.got.length = 0; ann.got.length = 0;
  S.room.worlds.fromCopy('deepholm', [{ t: 'kill', nid: 'i0', type: 'dwarf_guard', x: 1, y: 2, to: 'Ben' }, { t: 'hurt', to: 'Ann', dmg: 3, x: 1, y: 2 }, { t: 'p', n: '@world:deepholm', x: 0, y: 0 }, { t: 'mon', list: [] }, { t: 'chat', text: 'hi' }]);
  assert.deepEqual(ben.got, [{ t: 'kill', nid: 'i0', type: 'dwarf_guard', x: 1, y: 2 }]);
  assert.deepEqual(ann.got, [{ t: 'hurt', dmg: 3, x: 1, y: 2 }]);
});

test('Stage 2: flips send keeper both ways; nothing is built for an empty map; a map nobody switched stays as it was', () => {
  const S = shared({ maps: {} });
  const ann = S.knight('Ann', 'deepholm'), ben = S.knight('Ben', 'deepholm', 640, 1032);
  for (let i = 0; i < 5; i++) { S.T.advance(1000); S.p(ann, 'deepholm'); S.p(ben, 'deepholm', 640, 1032); S.say(ann, { t: 'mon', list: [] }); }
  assert.equal(S.W.made.length, 0, 'keeper maps never build a copy');
  assert.equal(S.room.keeperOf('deepholm').name, 'Ann');
  S.room.setSim({ move: 'observe', maps: { deepholm: 'world' } }, 'parent page');
  S.T.advance(0);
  S.say(ann, { t: 'mon', list: [] });
  assert.equal(S.room.keeperOf('deepholm').name, 'Ann', 'her empty heartbeat is not read as her monsters');
  S.T.advance(JOIN_WAIT + 50);
  assert.deepEqual(ben.last('keeper'), { t: 'keeper', map: 'deepholm', n: '@world:deepholm', server: true });
  assert.deepEqual(ann.last('keeper'), { t: 'keeper', map: 'deepholm', n: '@world:deepholm', server: true });
  S.T.advance(500);
  S.room.setSim({ move: 'observe', maps: { deepholm: 'keeper' } }, 'parent page');
  assert.deepEqual(ann.last('keeper'), { t: 'keeper', map: 'deepholm', n: 'Ann' }, 'back to the knight longest on the map');
  assert.deepEqual(ben.last('keeper'), { t: 'keeper', map: 'deepholm', n: 'Ann' });
  assert.ok(!S.host.copies.has('deepholm'), 'the copy is gone');
  assert.deepEqual(S.book.recent(5).map(r => [r.map, r.from, r.to, r.reason]), [['deepholm', 'world', 'keeper', 'parent page'], ['deepholm', 'keeper', 'world', 'parent page']]);
  // the master switch sends every world map back at once and keeps maps as they were
  S.room.setSim({ move: 'observe', maps: { deepholm: 'world', aerie: 'world' } }, 'parent page');
  S.T.advance(0); S.T.advance(JOIN_WAIT + 50);
  assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm');
  S.room.setSim({ move: 'observe', master: 'off', maps: { deepholm: 'world', aerie: 'world' } }, 'parent page');
  assert.equal(S.room.keeperOf('deepholm').name, 'Ann');
  assert.equal(S.book.recent(1)[0].reason, 'master');
  assert.equal(S.room.worlds.sw.maps.deepholm, 'world');
  // only the three plain instances can be world-run in this stage
  S.room.setSim({ move: 'observe', maps: { over: 'world', spider_den: 'world' } }, 'parent page');
  assert.equal(S.room.modeOf('over'), 'keeper'); assert.equal(S.room.modeOf('spider_den'), 'keeper');
  assert.deepEqual(WORLD_READY, ['deepholm', 'aerie']);
  S.room.setSim({ move: 'observe', maps: { coalmine: 'world' } }, 'parent page');
  assert.equal(S.room.modeOf('coalmine'), 'keeper', 'the coal mine has no monsters: never world-run');
});

test('Stage 2: the watchdog hands the map back to a knight (a throw, three slow ticks, a boot failure, the cap, a copy gone silent), each with a sim_log row and a hold', () => {
  // three tick throws
  { const S = shared(); const ann = S.knight('Ann', 'deepholm'); S.takeOver(ann);
    S.W.cfg.stepThrow.add('deepholm'); S.T.advance(400);
    assert.equal(S.room.keeperOf('deepholm').name, 'Ann'); assert.deepEqual(ann.last('keeper'), { t: 'keeper', map: 'deepholm', n: 'Ann' });
    assert.equal(S.book.recent(1)[0].reason, 'throws'); assert.equal(S.room.worlds.sw.held.deepholm.reason, 'throws'); assert.equal(S.saved.held.deepholm.reason, 'throws');
    assert.equal(S.room.modeOf('deepholm'), 'keeper', 'held: it stays on the keeper path');
    S.T.advance(10000); assert.equal(S.W.made.length, 1, 'and is not built again by itself'); }
  // three slow ticks
  { const S = shared(); const ann = S.knight('Ann', 'deepholm'); S.takeOver(ann);
    S.W.cfg.stepMs.deepholm = 30; S.T.advance(400);
    assert.equal(S.room.keeperOf('deepholm').name, 'Ann'); assert.equal(S.book.recent(1)[0].reason, 'slow'); assert.ok(S.book.recent(1)[0].tickP99 >= 25); }
  // a boot failure: the knight keeps the map, nobody saw anything
  { const S = shared(); S.W.cfg.bootThrow.add('deepholm'); const ann = S.knight('Ann', 'deepholm'); S.T.advance(0);
    assert.equal(S.room.keeperOf('deepholm').name, 'Ann'); assert.equal(S.book.recent(1)[0].reason, 'boot'); assert.ok(!ann.of('keeper').some(k => k.server)); }
  // the cap (one copy here): a second world map stays with its knight
  { const S = shared({ cap: 1, maps: { deepholm: 'world', aerie: 'world' } }); const ann = S.knight('Ann', 'deepholm'); S.takeOver(ann);
    const ben = S.knight('Ben', 'aerie'); S.T.advance(0);
    assert.equal(S.room.keeperOf('aerie').name, 'Ben'); assert.equal(S.book.recent(1)[0].reason, 'cap'); assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm'); }
  // the copy stops ticking (the loop died: its timers never fire again): KEEPER_STALE later the map goes back to a knight,
  // noticed on her next presence (no alarm of its own)
  const dead = S => { S.host.stop(); S.host.timer = { set: () => 0, clear() { } }; };
  { const S = shared(); const ann = S.knight('Ann', 'deepholm'); S.takeOver(ann);
    dead(S); S.T.advance(STALE - 200); S.p(ann, 'deepholm');
    assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm', 'not yet');
    S.T.advance(400); S.p(ann, 'deepholm');
    assert.equal(S.room.keeperOf('deepholm').name, 'Ann'); assert.equal(S.book.recent(1)[0].reason, 'stale'); }
  // the parent page flipping it again clears the hold and it is taken over again
  { const S = shared(); const ann = S.knight('Ann', 'deepholm'); S.takeOver(ann); S.W.cfg.stepThrow.add('deepholm'); S.T.advance(400);
    S.W.cfg.stepThrow.delete('deepholm');
    S.room.setMode('deepholm', 'world', 'parent page'); S.T.advance(0); S.T.advance(JOIN_WAIT + 50);
    assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm'); assert.ok(!S.room.worlds.sw.held.deepholm); }
});

test('Stage 2: a take-over with no stream finishes after JOIN_WAIT; a keeper leaving mid-join finishes it at once; an emptied map keeps its copy 60 s', () => {
  { const S = shared(); const ann = S.knight('Ann', 'deepholm'); S.T.advance(0);
    S.T.advance(JOIN_WAIT - 100); assert.equal(S.room.keeperOf('deepholm').name, 'Ann');
    S.T.advance(200); assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm'); }
  { const S = shared(); const ann = S.knight('Ann', 'deepholm'); const ben = S.knight('Ben', 'deepholm', 640, 1032); S.T.advance(0);
    S.p(ann, 'over', 100, 100);   // Ann walks out mid-join
    assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm'); assert.deepEqual(ben.last('keeper'), { t: 'keeper', map: 'deepholm', n: '@world:deepholm', server: true }); }
  { const S = shared(); const ann = S.knight('Ann', 'deepholm'); S.takeOver(ann);
    S.p(ann, 'over', 100, 100); S.T.advance(30000);
    assert.ok(S.host.copies.has('deepholm'), 'still running 30 s after the map emptied');
    S.p(ann, 'deepholm'); assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm', 'back inside 60 s: the same copy keeps it at once');
    assert.equal(S.W.made.length, 1);
    S.p(ann, 'over', 100, 100); S.T.advance(61000);
    assert.ok(!S.host.copies.has('deepholm'), 'dropped 60 s after it emptied'); }
});

test('Stage 2: realm_state, the boss rests, survives a rebuilt SimHost (a new Room and host over the same book)', () => {
  const book = new SimBook(null, () => 0);
  const S1 = shared({ book }); const ann = S1.knight('Ann', 'deepholm'); S1.takeOver(ann);
  S1.W.made[0].rests = { war_shed: 240 };
  for (let i = 0; i < REALM_EVERY / 10 + 2; i++) { S1.p(ann, 'deepholm'); S1.T.advance(1000); }   // she plays on (a silent map parks)
  const row = book.realmGet('rest:deepholm');
  assert.ok(row && Math.abs(row.war_shed - (S1.T.now + 240000)) < 6000, JSON.stringify(row));
  const S2 = shared({ book }); S2.T.now = S1.T.now + 100000;
  const ann2 = S2.knight('Ann', 'deepholm'); S2.T.advance(0);
  const left = S2.W.made[0].restsSet;
  assert.ok(left && Math.abs(left.war_shed - (row.war_shed - S2.T.now) / 1000) < 1e-6 && left.war_shed > 130 && left.war_shed < 150, JSON.stringify(left));
  void ann2;
});

// ---- the review fixes (round 1) ----
test('Stage 2: a keeper alone sends only an empty heartbeat: it is never handed to the copy as his monsters; the take-over waits JOIN_WAIT and the copy keeps its own', () => {
  const S = shared();
  const ann = S.knight('Ann', 'deepholm'); S.T.advance(0);
  const c = S.W.made[0];
  for (let i = 0; i < 3; i++) { S.say(ann, { t: 'mon', list: [] }); S.T.advance(400); }
  assert.equal(S.room.keeperOf('deepholm').name, 'Ann', 'three heartbeats in 1.2 s: still joining');
  S.T.advance(JOIN_WAIT);
  assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm', 'JOIN_WAIT finished it');
  assert.ok(!c.got.some(m => m.t === 'mon'), 'the copy was never handed an empty list: ' + JSON.stringify(c.got.filter(m => m.t === 'mon')));
  assert.deepEqual(c.got.filter(m => m.t === 'keeper').map(m => m.n), ['Ann', '@world:deepholm']);
  // a snapshot with monsters in it still hands the map over at once
  const S2 = shared(); const bea = S2.knight('Bea', 'deepholm'); S2.takeOver(bea); S2.T.advance(100);
  assert.equal(S2.room.keeperOf('deepholm').name, '@world:deepholm');
  assert.deepEqual(S2.W.made[0].got.filter(m => m.t === 'mon').map(m => m.list.length), [1]);
});

test('Stage 2: one knight on a world-run map for 10 minutes arms no alarm after the take-over (the keeper path arms none either); a copy gone quiet is still caught on his presence', () => {
  const run = maps => {
    const S = shared({ maps });
    const ann = S.knight('Ann', 'deepholm');
    if (maps.deepholm === 'world') S.takeOver(ann); else S.T.advance(0);
    // past the take-over and the roster's first send (2 s after a knight arrives, on both paths)
    for (let i = 0; i < 3; i++) { S.p(ann, 'deepholm'); S.T.advance(1000); }
    const keeper = S.room.keeperOf('deepholm').name, at = S.alarms;
    for (let i = 0; i < 600; i++) { S.p(ann, 'deepholm', 600 + (i % 2), 1032); if (maps.deepholm !== 'world') S.say(ann, { t: 'mon', list: [] }); S.T.advance(1000); }
    return { S, ann, keeper, alarms: S.alarms - at, ticks: S.host.ticks };
  };
  const kp = run({}), w = run({ deepholm: 'world' });
  assert.equal(kp.keeper, 'Ann'); assert.equal(w.keeper, '@world:deepholm');
  assert.ok(w.ticks >= 5900, 'the copy ticked all along (its own setTimeout loop): ' + w.ticks);
  assert.equal(kp.alarms, 0, 'the keeper path: no alarm for a knight alone');
  assert.equal(w.alarms, 0, 'world-run: no alarm either, in 10 minutes');
  // and the copy dying is still noticed, on his next presence, with no alarm
  w.S.host.stop(); w.S.host.timer = { set: () => 0, clear() { } }; w.S.T.advance(STALE + 100); w.S.p(w.ann, 'deepholm');
  assert.equal(w.S.room.keeperOf('deepholm').name, 'Ann'); assert.equal(w.S.book.recent(1)[0].reason, 'stale');
});

test('Stage 2: a knight whose game has gone silent for SILENT ms is told to the copy as fallen (no monster fights him); his next presence brings him back', () => {
  const S = shared();
  const ann = S.knight('Ann', 'deepholm'), ben = S.knight('Ben', 'deepholm', 640, 1032); S.takeOver(ann);
  const c = S.W.made[0];
  const lastP = n => { const l = c.got.filter(m => m.t === 'p' && m.n === n); return l[l.length - 1]; };
  for (let i = 0; i < 6; i++) { S.p(ann, 'deepholm'); S.p(ben, 'deepholm', 640, 1032); S.T.advance(500); }
  assert.equal(lastP('Ann').dead, false); assert.equal(lastP('Ben').dead, false);
  // Ann's iPad locks: Ben goes on playing
  for (let i = 0; i < 4; i++) { S.p(ben, 'deepholm', 640, 1032); S.T.advance(500); }
  assert.equal(lastP('Ann').dead, false, '2 s quiet: still fought');
  for (let i = 0; i < 4; i++) { S.p(ben, 'deepholm', 640, 1032); S.T.advance(500); }
  assert.equal(lastP('Ann').dead, true, 'past ' + SILENT + ' ms quiet: the copy takes her for fallen');
  assert.equal(lastP('Ben').dead, false, 'Ben, still playing, is fought as before');
  // with nobody else sending anything at all, his silence is still noticed (every tick checks): the copy holds him fallen
  // and, as nobody there is playing, parks (nothing on the map moves until he does)
  const S2 = shared(); const cy = S2.knight('Cy', 'deepholm'); S2.takeOver(cy);
  S2.T.advance(SILENT + 500);
  assert.equal(S2.host.copies.get('deepholm').knights.get('Cy').dead, true, 'a knight alone who locks his iPad is not fought either');
  assert.ok(S2.host.isParked('deepholm'), 'and the copy rests');
  // she unlocks: her first presence brings her back
  S.p(ann, 'deepholm'); S.T.advance(100);
  assert.equal(lastP('Ann').dead, false);
});

test('Stage 2: a world-run map rebuilt with no copy loaded (a wake, a deploy, an eviction): the knight the Room picks is told he keeps it; then the copy reads his stream and takes it back', () => {
  const S = shared();
  const ann = S.knight('Ann', 'deepholm'), ben = S.knight('Ben', 'deepholm', 640, 1032); S.takeOver(ann);
  assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm');
  // the object goes: a new Room comes back from what each socket carried, before the game copy has loaded
  const T = S.T, W = stubCopies(), book = S.book;
  const room = new Room({ now: () => T.now, wake: ms => T.set(() => room.tick(), ms), simBook: book });
  room.setSim({ move: 'observe', maps: { deepholm: 'world' } });
  for (const s of [ann, ben]) { s.got.length = 0; room.restore(s, { name: s.name, since: 1, hello: true, map: 'deepholm', mapAt: s.name === 'Ann' ? 10 : 20 }); }
  assert.equal(room.keeperOf('deepholm').name, 'Ann', 'the Room picks Ann (longest on the map)');
  assert.equal(ann.of('keeper').length, 0, 'a restore says nothing');
  // a hit from her game now would be dropped (the Room thinks she keeps it): so the copy loading names her keeper out loud
  const host = new SimHost({ makeGame: W.makeGame, now: () => T.now, clock: () => W.clockNow, timer: T, onFallback: (m, r, row) => room.worlds.fell(m, r, row), onSend: (m, l) => room.worlds.fromCopy(m, l) });
  room.worlds.useHost(host);
  assert.deepEqual(ann.last('keeper'), { t: 'keeper', map: 'deepholm', n: 'Ann' }, 'Ann is told she keeps it');
  assert.deepEqual(ben.last('keeper'), { t: 'keeper', map: 'deepholm', n: 'Ann' }, 'and Ben');
  // their games go on: each sends its presence (a restore keeps no position)
  room.message(ann, JSON.stringify({ t: 'p', map: 'deepholm', x: 600, y: 1032, lv: 30, def: 576 })); room.message(ben, JSON.stringify({ t: 'p', map: 'deepholm', x: 640, y: 1032, lv: 30, def: 576 }));
  T.advance(0);
  const c = W.made[0];
  assert.ok(c, 'the copy is built at the next alarm');
  room.message(ann, JSON.stringify({ t: 'mon', list: [['i0', 'dwarf_guard', 600, 1032, 70, 90, 'idle', 1, 0, 0, 0, 0, 0, 0]] }));
  assert.equal(room.keeperOf('deepholm').name, '@world:deepholm', 'her stream hands it to the copy');
  T.advance(100);
  assert.deepEqual(c.got.filter(m => m.t === 'mon').map(m => m.n), ['Ann']);
  assert.deepEqual(ben.last('keeper'), { t: 'keeper', map: 'deepholm', n: '@world:deepholm', server: true });
  // a world that cannot load the copy says so the same way: the knight it picked keeps the map, and knows it
  const room2 = new Room({ now: () => T.now, wake: () => { }, simBook: book });
  room2.setSim({ move: 'observe', maps: { deepholm: 'world' } });
  for (const s of [ann, ben]) { s.got.length = 0; room2.restore(s, { name: s.name, since: 1, hello: true, map: 'deepholm', mapAt: s.name === 'Ann' ? 10 : 20 }); }
  room2.worlds.noCopy();
  assert.deepEqual(ann.last('keeper'), { t: 'keeper', map: 'deepholm', n: 'Ann' });
  assert.equal(room2.worlds.loaded, false);
});

// ---- the review fixes (round 2) ----
test('Stage 2: a knight whose game stops with his socket open (a background tab): once every knight there is silent the copy parks, no timer stays armed and nothing ticks for 10 minutes; his next presence ticks the same copy again from where it stood', () => {
  const S = shared();
  const ann = S.knight('Ann', 'deepholm'); S.takeOver(ann);
  for (let i = 0; i < 3; i++) { S.p(ann, 'deepholm'); S.T.advance(1000); }   // past the take-over and the roster's first send
  const c = S.W.made[0], logBefore = S.book.recent(50).length;
  assert.ok(S.host.running);
  // her game stops; the socket stays open and says nothing (the Room's ping is answered without waking the object)
  S.T.advance(SILENT + 300);
  assert.equal(S.host.running, false, 'every knight there silent: the loop stopped');
  assert.equal(S.T.timers.length, 0, 'no timer armed at all (the host\'s or the Room\'s): the object hibernates as today');
  assert.ok(S.host.isParked('deepholm'), 'the copy parked');
  const ticks = S.host.ticks, steps = c.steps, alarms = S.alarms;
  ann.got.length = 0;
  S.T.advance(10 * 60000);
  assert.equal(S.host.ticks, ticks, '0 ticks in 10 minutes');
  assert.equal(c.steps, steps, 'the copy never stepped');
  assert.equal(S.alarms, alarms, 'no alarm');
  assert.equal(S.T.timers.length, 0);
  assert.equal(ann.of('mon').length, 0, 'nothing sent to her meanwhile');
  assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm', 'the world still keeps it (no stale hand-back)');
  // she moves again: the same copy ticks on from where it stood; nothing rebuilt, no keeper change, every monster once
  S.p(ann, 'deepholm', 610, 1032);
  assert.ok(!S.host.isParked('deepholm') && S.host.running, 'her presence ticks it again');
  S.T.advance(1000);
  assert.equal(S.W.made.length, 1, 'the same copy (nothing rebuilt)');
  assert.ok(c.steps > steps);
  assert.equal(ann.of('keeper').length, 0, 'no keeper message: her game keeps its puppets as they were');
  const mons = ann.of('mon');
  assert.ok(mons.length >= 9 && mons.length <= 11, String(mons.length));
  for (const m of mons) assert.deepEqual(m.list.map(r => r[0]), ['i0'], 'the same monster in every list, once (none vanished, none doubled)');
  assert.equal(S.book.recent(50).length, logBefore, 'no sim_log row: parking is not a hand-back');
  const lastP = c.got.filter(m => m.t === 'p' && m.n === 'Ann').pop();
  assert.equal(lastP.dead, false, 'and the copy fights her again');
});

test('Stage 2: parking needs every knight there silent; a knight arriving, a parent-page flip or the map emptying all end it cleanly', () => {
  // two knights: one silent is not enough; both silent parks
  { const S = shared(); const ann = S.knight('Ann', 'deepholm'), ben = S.knight('Ben', 'deepholm', 640, 1032); S.takeOver(ann);
    for (let i = 0; i < 8; i++) { S.p(ben, 'deepholm', 640, 1032); S.T.advance(500); }
    assert.ok(!S.host.isParked('deepholm') && S.host.running, 'Ben still plays');
    S.T.advance(SILENT + 300);
    assert.ok(S.host.isParked('deepholm') && S.T.timers.length === 0, 'both silent: parked');
    // a third knight walks in: the copy ticks again at once, and he is told the world keeps it
    const cy = S.knight('Cy', 'deepholm', 700, 1032);
    assert.ok(!S.host.isParked('deepholm') && S.host.running);
    assert.deepEqual(cy.last('keeper'), { t: 'keeper', map: 'deepholm', n: '@world:deepholm', server: true });
    S.T.advance(300); assert.ok(cy.of('mon').length >= 2); }
  // the parent page gives a parked map back: a knight's game keeps it and no timer is left
  { const S = shared(); const ann = S.knight('Ann', 'deepholm'); S.takeOver(ann); S.T.advance(SILENT + 300);
    assert.ok(S.host.isParked('deepholm'));
    S.room.setMode('deepholm', 'keeper', 'parent page');
    assert.equal(S.room.keeperOf('deepholm').name, 'Ann'); assert.deepEqual(ann.last('keeper'), { t: 'keeper', map: 'deepholm', n: 'Ann' });
    assert.ok(!S.host.copies.has('deepholm') && !S.host.running && S.T.timers.length === 0); }
  // a parked map emptied (her socket closed at last): the copy goes 60 s later, like any emptied copy, with no timer of its own
  { const S = shared(); const ann = S.knight('Ann', 'deepholm'); S.takeOver(ann); S.T.advance(SILENT + 300);
    S.room.leave(ann);
    assert.ok(S.host.copies.has('deepholm') && S.T.timers.length === 0);
    S.T.advance(61000);
    const bea = S.knight('Bea', 'deepholm');   // a knight walking in later finds it gone: a fresh take-over, as after any 60 s
    assert.equal(S.room.keeperOf('deepholm').name, 'Bea', 'not the stale parked copy');
    S.T.advance(0);
    assert.equal(S.W.made.length, 2, 'a new copy is built'); void bea; }
});

test('Stage 2: after a hand-back with no copy left the loop stops at once (no idle minute, nothing armed)', () => {
  const S = shared(); const ann = S.knight('Ann', 'deepholm'); S.takeOver(ann);
  for (let i = 0; i < 3; i++) { S.p(ann, 'deepholm'); S.T.advance(1000); }
  S.room.setMode('deepholm', 'keeper', 'parent page');
  S.T.advance(200);
  assert.equal(S.host.running, false, 'stopped');
  assert.equal(S.T.timers.length, 0);
  const v = S.room.worlds.view();
  assert.equal(v.running, false); assert.deepEqual(v.copies, []);
  assert.equal(v.knights.deepholm, 1, 'Knights there: the Room\'s own count on the keeper path');
  assert.deepEqual(v.modes, { deepholm: 'keeper', aerie: 'keeper', coalmine: 'keeper' });
  assert.deepEqual(v.empty, ['coalmine']);
});

test('Stage 2: a lone keeper whose page has the snap capability is asked once for every monster; his full answer (not his heartbeat) hands the copy the map at once; an older page is never asked', () => {
  const capKnight = (S, name, caps) => { const s = S.sock(name); S.room.join(s, name); S.say(s, { t: 'hello', v: 1, caps }); S.p(s, 'deepholm'); return s; };
  // a page with the capability
  { const S = shared(); const ann = capKnight(S, 'Ann', ['snap']);
    S.T.advance(0);   // the copy is built
    const c = S.W.made[0];
    assert.deepEqual(ann.of('snap'), [{ t: 'snap', map: 'deepholm' }], 'asked once');
    S.say(ann, { t: 'mon', list: [] });   // a heartbeat that crosses the ask: not his answer
    S.say(ann, { t: 'mon', list: [['i0', 'dwarf_guard', 700, 1032, 20, 90, 'chase', 1, 0, 1, 0, 0, 0, 0]] });   // his ordinary stream: read, not the answer
    assert.equal(S.room.keeperOf('deepholm').name, 'Ann', 'still joining: the full answer decides');
    S.say(ann, { t: 'mon', full: true, list: [['i0', 'dwarf_guard', 700, 1032, 20, 90, 'chase', 1, 0, 1, 0, 0, 0, 0], ['i9', 'dwarf_guard', 2040, 1032, 0, 90, 'idle', 1, 0, 0, 0, 1, 0, 0]] });
    assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm', 'his full answer hands it over at once (no JOIN_WAIT)');
    S.T.advance(100);
    const mons = c.got.filter(m => m.t === 'mon');
    assert.deepEqual(mons.map(m => m.list.length), [1, 2], 'the copy read his stream, then his full answer, with the far guard felled');
    assert.deepEqual(mons[1].list[1].slice(0, 5).concat(mons[1].list[1][11]), ['i9', 'dwarf_guard', 2040, 1032, 0, 1]); }
  // a full answer that is empty (he has no monsters at all) still hands it over at once
  { const S = shared(); const ann = capKnight(S, 'Ann', ['snap']); S.T.advance(0);
    S.say(ann, { t: 'mon', full: true, list: [] });
    assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm'); }
  // a full answer from a knight who was never asked is an ordinary snapshot
  { const S = shared(); const ann = capKnight(S, 'Ann', []); S.T.advance(0);
    assert.equal(ann.of('snap').length, 0, 'an older page is never asked');
    S.say(ann, { t: 'mon', full: true, list: [] });
    assert.equal(S.room.keeperOf('deepholm').name, 'Ann', 'an empty list from a page never asked is a heartbeat');
    S.T.advance(JOIN_WAIT + 50);
    assert.equal(S.room.keeperOf('deepholm').name, '@world:deepholm', 'JOIN_WAIT, as before'); }
  // the parent page switching a map on mid-fight asks the same way, as does a wake that named him keeper
  { const S = shared({ maps: {} }); const ann = capKnight(S, 'Ann', ['snap']); S.T.advance(0);
    assert.equal(S.W.made.length, 0);
    S.room.setMode('deepholm', 'world', 'parent page'); S.T.advance(0);
    assert.equal(ann.of('snap').length, 1); }
});
