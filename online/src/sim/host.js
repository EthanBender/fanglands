// ============================================================================
// SIMHOST — the world server's game copies: their lifecycle, the tick, the watchdog (docs/ONLINE.md, "The shared world")
// Stage 0: built and tested, not wired to the Room. Stage 2 wires it: the Room names the virtual knight '@world:<map>'
// keeper of each map switched to `world`, feeds it the accepted presence of the knights on that map, and relays what
// the copy sends.
//
// One copy per map (the overworld, or one instance), each a makeGame() world in its own window (window.js) with the
// stand-in knight of src/79-worldkeeper.js. A tick every TICK_MS (a setTimeout chain, never alarms: alarms are a request
// and a row written each):
//   1. set window.__now;  2. run the copy's due timers;  3. hand it the messages queued since the last tick;
//   4. hand it every knight on its map as a `p` (the accepted presence);  5. SUBSTEPS x update(1/30);
//   6. pass on what the copy sent (onSend), with its monsters' rows as { t: 'mon', list, k, at, world: true } (Stage 2).
//   Then drop the copies whose map has been empty DROP_EMPTY_MS.
// The loop catches up at most MAX_CATCHUP ticks; beyond that the time is skipped and counted. It stops IDLE_STOP_MS after
// the last knight leaves, so the Durable Object naps exactly as it does today.
// A copy can be parked (park(map), Stage 2 review round 2): the Room parks a map whose knights' games have all gone silent (a
// paused game, a tab left in the background, an iPad that keeps its socket). A parked copy keeps its monsters exactly as they
// stand but is not ticked, counts as no knight for the loop, and with only parked copies left the loop stops at once: no timer
// stays armed, so the object hibernates exactly as it does today. unpark(map) ticks it again from where it stood.
//
// The watchdog hands a map back to the keeper path (onFallback(map, reason, info); the map is then refused until
// allow(map)) on: a boot throw ('boot'), WATCH.throws tick throws inside WATCH.throwWindowMs ('throws'), WATCH.slowRun ticks
// in a row over WATCH.slowMs ('slow'), the heap over WATCH.heapBytes ('heap': the newest instance copy goes first), or one
// copy more than the cap ('cap': the overworld plus 3 instances). The heap reason needs a heap probe: node has one (the sims),
// workerd has none (no process, no performance.memory), so on the World the cap is what holds memory and 'heap' never fires.
// Inside workerd the clock only moves on I/O, so with timing: 'lag' a tick's cost is read by two zero-delay timers set one
// after the other right after it: the first lands after the ticks' own work plus however long the machine took to get to
// a timer; the second, with no work before it, lands after only the machine's own delay. The ticks' own cost is the
// first gap less the second, so a busy machine (or a busy object) never reads as a slow copy; a reading taken while the
// machine itself is over WATCH.slowMs late is not counted either way. A slow trip then falls back the copy with the most
// monsters near knights. With timing: 'inline' (node) each copy is timed directly.
// Pure JavaScript: no Cloudflare APIs, so node runs it in the tests and the sims.
// ============================================================================
import { makeWindow, mulberry32 } from './window.js';

export const TICK_MS = 100;           // 10 ticks a second
export const SUBSTEPS = 3;            // update(1/30) three times a tick: the game's own step size
export const MAX_CATCHUP = 3;         // extra ticks one late timer may run; beyond that the time is skipped
export const IDLE_STOP_MS = 60000;    // the loop stops this long after the last knight leaves
export const DROP_EMPTY_MS = 60000;   // a copy is dropped this long after its map empties
export const CAP = 4;                 // copies at once: the overworld plus 3 instances
export const WATCH = { throws: 3, throwWindowMs: 10000, slowMs: 25, slowRun: 3, heapBytes: 100 * 1048576, heapEveryTicks: 100 };
export const NEVER = new Set(['house']);   // never simulated (each knight's own house is his alone)
// the instances that build the same without the overworld (tools/sim-suite.mjs check 5, 3 Oct 2026): Stage 2 passes these
// as worldGenFree, and each boots in about 25 ms instead of about 900 ms in workerd
export const WORLDGEN_FREE = ['war_shed', 'tinker_lab', 'stormfront'];
export const NO_HEAP = () => null;   // the heap probe of a host that has none
const KEPT_TICKS = 3000;              // tick times kept for p50 / p99 (5 minutes)

const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
const seedOf = (seed, map) => { let h = seed >>> 0 || 1; for (let i = 0; i < map.length; i++) h = Math.imul(h ^ map.charCodeAt(i), 0x01000193) >>> 0; return h || 1; };
export function quantiles(xs) {
  if (!xs.length) return { n: 0, p50: null, p99: null, max: null };
  const s = [...xs].sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const r = v => Math.round(v * 1000) / 1000;
  return { n: s.length, p50: r(q(0.5)), p99: r(q(0.99)), max: r(s[s.length - 1]) };
}
// a knight's accepted presence, as the `p` the copy's 73-players and 75-coop read
export function presenceOf(k, map) {
  const p = { t: 'p', n: k.n, map, x: num(k.x), y: num(k.y), dead: !!k.dead };
  for (const f of ['fx', 'fy', 'def', 'lv', 'hp', 'mhp', 'att', 'mh', 'law', 'spd']) if (num(k[f]) !== null) p[f] = k[f];
  return p;
}

export class SimHost {
  constructor({ makeGame, now = () => Date.now(), clock = null, timer = null, heap = NO_HEAP, seed = 1, cap = CAP, watch = {},
    worldGenFree = [], serverOff = true, timing = 'inline', onFallback = () => { }, onSend = () => { }, log = () => { } } = {}) {
    if (typeof makeGame !== 'function') throw new Error('SimHost needs makeGame');
    this.makeGame = makeGame;
    this.now = now;
    this.clock = clock || now;
    this.timer = timer || { set: (f, ms) => setTimeout(f, ms), clear: h => clearTimeout(h) };
    this.heap = heap;
    this.seed = seed;
    this.cap = cap;
    this.watch = { ...WATCH, ...watch };
    this.worldGenFree = new Set(worldGenFree);
    this.serverOff = serverOff !== false;   // false only for tools/sim-audit.mjs, which audits with nothing switched off
    this.timing = timing;
    this.onFallback = onFallback; this.onSend = onSend; this.log = log;
    this.copies = new Map();      // map -> copy
    this.refused = new Map();     // map -> {reason, at}: on the keeper path until allow(map)
    this.fallbacks = [];          // {at, map, reason, tickP99, info}, the newest 50
    this.tickTimes = [];          // ms, the newest KEPT_TICKS
    this.bootTimes = {};          // map -> ms of its last boot
    this.skipped = 0;             // ticks skipped because the loop fell too far behind
    this.ticks = 0;
    this.running = false; this.handle = null; this.nextAt = 0; this.simNow = 0; this.idleSince = null;
    this.lastBatch = 1;
    this.heapNow = null;
    this.heapProbe = heap !== NO_HEAP;   // false: this host has no way to read the heap (workerd), so 'heap' never fires
  }

  // ---------- copies ----------
  refusedReason(map) { const r = this.refused.get(map); return r ? r.reason : null; }
  boot(map) {
    if (typeof map !== 'string' || !map) return null;
    const have = this.copies.get(map); if (have) return have;
    if (NEVER.has(map) || this.refused.has(map)) return null;
    if (this.copies.size >= this.cap) { this.fallback(map, 'cap', { copies: this.copies.size }); return null; }
    const at = this.now();
    const seed = seedOf(this.seed, map);
    const w = makeWindow({ seed, now: at });
    const out = [];
    // reseed: the stand-in calls it once the new game is set up, before it enters an instance
    w.__worldKeeper = { map, worldGen: this.worldGenFree.has(map) ? false : true, serverOff: this.serverOff, send: m => out.push(m), reseed: () => { w.Math.random = mulberry32(seed ^ 0x5eed); } };
    const c0 = this.clock();
    let api = null;
    try {
      api = this.makeGame(w);
      if (!w.WORLDKEEPER) throw new Error('the copy has no stand-in (src/79-worldkeeper.js)');
      w.WORLDKEEPER.start();
    } catch (e) {
      this.fallback(map, 'boot', { error: String(e && e.message || e).slice(0, 300) });
      return null;
    }
    const bootMs = this.clock() - c0;
    const copy = { map, w, api, wk: w.WORLDKEEPER, out, knights: new Map(), queue: [], bootMs, bootedAt: at, emptySince: at, ticks: 0, throws: [], slow: 0, lastMs: 0, errors: 0, parked: false };
    this.copies.set(map, copy);
    this.bootTimes[map] = Math.round(bootMs);
    this.log('boot', { map, ms: Math.round(bootMs) });
    this.checkHeap();
    return copy;
  }
  drop(map) {
    const c = this.copies.get(map); if (!c) return false;
    this.copies.delete(map);
    this.log('drop', { map });
    return true;
  }
  // the map goes back to the keeper path, and stays there until allow(map)
  fallback(map, reason, info = {}) {
    this.drop(map);
    const at = this.now();
    this.refused.set(map, { reason, at });
    const row = { at, map, reason, tickP99: quantiles(this.tickTimes.slice(-100)).p99, info };
    this.fallbacks.push(row); if (this.fallbacks.length > 50) this.fallbacks.shift();
    this.log('fallback', row);
    try { this.onFallback(map, reason, row); } catch (e) { this.log('onFallback threw', { error: String(e) }); }
  }
  allow(map) { return this.refused.delete(map); }

  // ---------- what the Room tells it ----------
  // the knights on a map now: [{n, x, y, fx, fy, dead, def, lv, att, mh, law, spd}]; a knight missing from the list left
  setKnights(map, list) {
    const c = this.copies.get(map); if (!c) return false;
    const next = new Map();
    for (const k of Array.isArray(list) ? list : []) if (k && typeof k.n === 'string' && num(k.x) !== null && num(k.y) !== null) next.set(k.n, k);
    for (const n of c.knights.keys()) if (!next.has(n)) c.queue.push({ t: 'left', n, map });
    c.knights = next;
    c.emptySince = next.size ? null : (c.emptySince == null ? this.now() : c.emptySince);
    if (c.parked) { this.sweep(); return true; }   // a parked copy waits, untouched, for unpark (its knights are kept for then)
    if (next.size) this.idleSince = null;   // a knight back on any copy: the 60 s before the loop stops start again when he goes
    if (next.size && !this.running) this.start();
    return true;
  }
  // ---------- parking (every knight on the map has gone silent: see the head of this file) ----------
  park(map) {
    const c = this.copies.get(map); if (!c || c.parked) return false;
    c.parked = true; c.parkedAt = this.now();
    this.log('park', { map });
    // nothing left to tick: stop now (no timer stays armed); a loop already inside a tick stops itself when the tick ends
    if (!this.live().length && this.running && this.handle != null) this.stop();
    return true;
  }
  unpark(map) {
    const c = this.copies.get(map); if (!c || !c.parked) return false;
    c.parked = false; c.parkedAt = null;
    this.log('unpark', { map });
    if (c.knights.size) { this.idleSince = null; if (!this.running) this.start(); }
    return true;
  }
  isParked(map) { const c = this.copies.get(map); return !!(c && c.parked); }
  live() { return [...this.copies.values()].filter(c => !c.parked); }
  // a parked copy whose map emptied is dropped DROP_EMPTY_MS later like any other (looked at whenever the host is called, as no
  // timer runs for it)
  sweep(at = this.now()) { for (const c of [...this.copies.values()]) if (c.parked && !c.knights.size && c.emptySince != null && at - c.emptySince >= DROP_EMPTY_MS) this.drop(c.map); }
  // a message for the copy (an intent, a boss call, an admin spawn), run at the start of the next tick
  deliver(map, msg) { const c = this.copies.get(map); if (!c || !msg) return false; c.queue.push(msg); return true; }
  knightCount() { let n = 0; for (const c of this.copies.values()) if (!c.parked) n += c.knights.size; return n; }

  // ---------- the tick ----------
  tick(at = this.now()) {
    this.simNow = at; this.ticks++;
    let whole = 0;
    for (const c of [...this.copies.values()]) {
      if (c.parked) continue;
      const w = c.w, c0 = this.clock();
      try {
        w.__now = at;
        w.__runTimers();
        const q = c.queue; c.queue = [];
        for (const m of q) c.wk.deliver(m);
        for (const k of c.knights.values()) c.wk.deliver(presenceOf(k, c.map));
        for (let s = 0; s < SUBSTEPS; s++) c.wk.step(1 / 30);
        c.ticks++;
        // Stage 2: the copy's monsters as the world sends them, once a tick (the Room filters them for each knight)
        if (typeof c.wk.rows === 'function') c.out.push({ t: 'mon', list: c.wk.rows(), k: c.ticks, at, world: true });
      } catch (e) {
        c.errors++;
        c.throws = c.throws.filter(t => at - t < this.watch.throwWindowMs); c.throws.push(at);
        this.log('tick threw', { map: c.map, error: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') });
        if (c.throws.length >= this.watch.throws) { this.fallback(c.map, 'throws', { error: String(e && e.message || e).slice(0, 300) }); continue; }
      }
      const ms = this.clock() - c0; c.lastMs = ms; whole += ms;
      if (this.timing === 'inline') {
        c.slow = ms > this.watch.slowMs ? c.slow + 1 : 0;
        if (c.slow >= this.watch.slowRun) { this.fallback(c.map, 'slow', { ms: Math.round(ms * 10) / 10 }); continue; }
      }
      if (c.out.length) { const sent = c.out.splice(0); try { this.onSend(c.map, sent); } catch (e) { this.log('onSend threw', { error: String(e) }); } }
    }
    if (this.timing === 'inline') this.record(whole);
    for (const c of [...this.copies.values()]) if (!c.knights.size && c.emptySince != null && at - c.emptySince >= DROP_EMPTY_MS) this.drop(c.map);
    if (this.ticks % this.watch.heapEveryTicks === 0) this.checkHeap();
    return whole;
  }
  record(ms) { this.tickTimes.push(ms); if (this.tickTimes.length > KEPT_TICKS) this.tickTimes.splice(0, this.tickTimes.length - KEPT_TICKS); }
  // 'lag' timing: the cost of the last batch of ticks. gap: from the end of the ticks to the first zero-delay timer after
  // them; idle: from that timer to a second one, with no work between (the machine's own delay). Answers the cost per tick.
  lagged(gap, idle = 0) {
    const noise = Math.max(0, idle);
    const per = Math.max(0, gap - noise) / Math.max(1, this.lastBatch);
    for (let i = 0; i < this.lastBatch; i++) this.record(per);
    // the machine itself was late by more than the bar: this reading says nothing about the copy, so it neither counts
    // toward a slow run nor ends one
    if (noise > this.watch.slowMs) { this.noisy = (this.noisy || 0) + 1; return per; }
    this.slowWhole = per > this.watch.slowMs ? (this.slowWhole || 0) + 1 : 0;
    if (this.slowWhole >= this.watch.slowRun && this.copies.size) {
      this.slowWhole = 0;
      let worst = null, load = -1;
      for (const c of this.live()) { let l = 0; try { l = c.api.peek('monsters').length * (1 + c.knights.size); } catch (e) { } if (l > load) { load = l; worst = c; } }
      if (worst) this.fallback(worst.map, 'slow', { ms: Math.round(per * 10) / 10, timing: 'lag', idle: Math.round(noise * 10) / 10 });
    }
    return per;
  }
  checkHeap() {
    let h = null; try { h = this.heap(); } catch (e) { h = null; }
    this.heapNow = typeof h === 'number' && Number.isFinite(h) ? h : null;
    if (this.heapNow === null || this.heapNow <= this.watch.heapBytes || !this.copies.size) return;
    const list = [...this.copies.values()].sort((a, b) => (a.map === 'over') - (b.map === 'over') || b.bootedAt - a.bootedAt);
    this.fallback(list[0].map, 'heap', { bytes: this.heapNow });
  }

  // ---------- the loop: a setTimeout chain while any knight is on a copy's map ----------
  start() {
    if (this.running) return false;
    this.running = true; this.idleSince = null; this.lastBatch = 1;
    this.nextAt = this.now() + TICK_MS;
    this.schedule(TICK_MS);
    this.log('start', {});
    return true;
  }
  stop() {
    if (!this.running) return false;
    this.running = false;
    if (this.handle != null) { try { this.timer.clear(this.handle); } catch (e) { } this.handle = null; }
    this.log('stop', {});
    return true;
  }
  schedule(ms) { this.handle = this.timer.set(() => this.loop(), Math.max(0, ms)); }
  loop() {
    this.handle = null;
    if (!this.running) return;
    const t = this.now();
    let n = 0;
    while (this.nextAt <= t && n < 1 + MAX_CATCHUP) { this.tick(this.nextAt); this.nextAt += TICK_MS; n++; }
    if (this.nextAt <= t) {
      const behind = Math.floor((t - this.nextAt) / TICK_MS) + 1;
      this.skipped += behind; this.nextAt += behind * TICK_MS;
      this.log('skipped', { ticks: behind });
    }
    this.lastBatch = Math.max(1, n);
    // workerd: the clock stood still while the ticks ran; a zero-delay timer reads it again once they are done, and a second
    // one right after it reads how late the machine alone makes a timer (see lagged)
    if (this.timing === 'lag') { this.handle = this.timer.set(() => this.measured(t), 0); return; }
    this.after(null);
  }
  measured(t0) {
    this.handle = null;
    if (!this.running) return;
    const t1 = this.now();
    this.handle = this.timer.set(() => { this.handle = null; if (!this.running) return; this.lagged(t1 - t0, this.now() - t1); this.after(null); }, 0);
  }
  after() {
    this.handle = null;
    if (!this.running) return;
    const t = this.now();
    this.sweep(t);
    const live = this.live();
    // only parked copies (or none at all, after a hand-back): nothing to tick, so the loop stops now and no timer stays armed
    if (!live.length) { this.stop(); return; }
    if (!this.knightCount()) {
      if (this.idleSince === null) this.idleSince = t;
      // every copy has been empty at least this long (none had a knight since idleSince), so each goes with the loop
      if (t - this.idleSince >= IDLE_STOP_MS) { for (const c of live) if (!c.knights.size) this.drop(c.map); this.stop(); return; }
    } else this.idleSince = null;
    this.schedule(this.nextAt - t);
  }

  // ---------- what /api/admin/sim will show ----------
  stats() {
    const copies = [...this.copies.values()].map(c => {
      let monsters = null; try { monsters = c.api.peek('monsters').length; } catch (e) { }
      return { map: c.map, bootMs: Math.round(c.bootMs), knights: c.knights.size, monsters, ticks: c.ticks, errors: c.errors, parked: c.parked };
    });
    const refused = {}; for (const [m, r] of this.refused) refused[m] = r;
    return { running: this.running, ticks: this.ticks, tick: quantiles(this.tickTimes), boot: { ...this.bootTimes }, heap: this.heapNow, heapProbe: this.heapProbe, copies, cap: this.cap, skipped: this.skipped, refused, fallbacks: this.fallbacks.slice() };
  }
}
