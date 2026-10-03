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
  T.advance = (ms, extra = () => 0) => {
    const to = T.now + ms;
    for (;;) {
      T.timers.sort((a, b) => a.at - b.at);
      const t = T.timers[0]; if (!t || t.at > to) break;
      T.timers.shift(); T.now = Math.max(T.now, t.at); t.f(); T.now += extra();
    }
    T.now = to;
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

test('lag timing (workerd): a tick\'s cost is read by a zero-delay timer set right after it', () => {
  const W = stubWorld(), T = fakeTime();
  const { h, fell } = host(W, T, { timing: 'lag' });
  h.boot('over'); h.setKnights('over', [ben]);
  // each timer callback "takes" 8 ms of wall time (the clock moves after the work, as in workerd)
  T.advance(1000, () => 8);
  const st = h.stats().tick;
  assert.ok(st.n >= 8, String(st.n));
  assert.ok(st.p50 >= 7.9 && st.p50 <= 8.1, JSON.stringify(st));
  assert.deepEqual(fell, []);
  T.advance(1000, () => 40);   // three slow ones in a row
  assert.deepEqual(fell, [['over', 'slow']]);
  assert.equal(h.fallbacks[0].info.timing, 'lag');
});

test('quantiles', () => {
  assert.deepEqual(quantiles([]), { n: 0, p50: null, p99: null, max: null });
  assert.deepEqual(quantiles(Array.from({ length: 100 }, (_, i) => i + 1)), { n: 100, p50: 51, p99: 100, max: 100 });
});
