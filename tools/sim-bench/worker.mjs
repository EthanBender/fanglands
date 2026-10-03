// LOCAL ONLY (wrangler dev --local, tools/sim-bench/run.sh): SimHost and the real stripped game copy inside a Durable
// Object, for the Stage 0 measurements (docs/ONLINE.md, "The shared world"). Never deployed.
// Inside workerd the clock only moves on I/O, so a batch of ticks is timed from outside (the driver subtracts an empty
// round trip), and one tick at a time is timed inside by awaiting a zero-delay timer after it (the clock moves then).
//   /noop                                   the round trip alone
//   /reset                                  a fresh SimHost (its copies dropped)
//   /boot?map=over&worldgen=1               boot one more copy into the current SimHost (kept: the heap step uses it)
//   /setup?map=over&knights=5&warm=50       reset, boot the map, post the knights on monster homes, warm up
//   /run?ticks=600                          ticks back to back (time it from outside)
//   /ticks?n=300                            one tick at a time, each timed inside: p50, p99, mean
//   /loop?seconds=10                        SimHost's own 10 Hz setTimeout loop (timing 'lag'): ticks run, skipped, p50/p99
//   /stats                                  host.stats()
import { makeGame } from '../../online/src/sim/game.mjs';
import { SimHost, quantiles } from '../../online/src/sim/host.js';
import { Bots } from '../sim-bots.mjs';

const zero = () => new Promise(r => setTimeout(r, 0));
const WORLDGEN_FREE = ['war_shed', 'tinker_lab', 'stormfront'];

export class Bench {
  constructor(ctx, env) { this.ctx = ctx; this.host = null; this.bots = null; this.map = null; this.at = Date.now(); }
  newHost(opts = {}) { this.host = new SimHost({ makeGame, now: () => this.at, timer: { set: () => 0, clear() { } }, seed: 11, cap: 8, ...opts }); this.bots = null; }
  async fetch(req) {
    const u = new URL(req.url), q = (k, d) => u.searchParams.get(k) ?? d;
    const json = o => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
    try {
      if (u.pathname === '/noop') return json({ ok: true });
      if (u.pathname === '/reset') { this.newHost(); return json({ ok: true }); }
      if (u.pathname === '/boot') {
        if (!this.host) this.newHost();
        const map = q('map', 'over'), free = q('worldgen', '1') === '0';
        if (free) this.host.worldGenFree.add(map); else this.host.worldGenFree.delete(map);
        const t0 = Date.now(); const c = this.host.boot(map); await zero(); const inside = Date.now() - t0;
        return json({ ok: !!c, map, worldGenFalse: free, insideMs: inside, copies: this.host.copies.size, monsters: c ? c.api.peek('monsters').length : null, fallbacks: this.host.fallbacks });
      }
      if (u.pathname === '/setup') {
        this.newHost();
        const map = q('map', 'over'), n = +q('knights', '1'), warm = +q('warm', '50');
        const c = this.host.boot(map); if (!c) return json({ error: this.host.fallbacks });
        this.map = map;
        this.bots = new Bots(this.host, map, { seed: 4 }).postOnHomes(n);
        for (let i = 0; i < warm; i++) this.step();
        return json({ ok: true, map, knights: n, monsters: c.api.peek('monsters').length });
      }
      if (u.pathname === '/run') {
        const n = +q('ticks', '600'); for (let i = 0; i < n; i++) this.step();
        return json({ ticks: n, monsters: this.host.copies.get(this.map).api.peek('monsters').length });
      }
      if (u.pathname === '/ticks') {
        const n = +q('n', '300'), xs = [];
        await zero();
        for (let i = 0; i < n; i++) { const t0 = Date.now(); this.step(); await zero(); xs.push(Date.now() - t0); }
        const empty = []; for (let i = 0; i < 50; i++) { const t0 = Date.now(); await zero(); empty.push(Date.now() - t0); }
        return json({ n, tick: quantiles(xs), mean: xs.reduce((a, b) => a + b, 0) / n, emptyTimer: quantiles(empty) });
      }
      if (u.pathname === '/loop') {
        const seconds = +q('seconds', '10'), map = q('map', 'over'), n = +q('knights', '20');
        const host = new SimHost({ makeGame, now: () => Date.now(), seed: 11, timing: 'lag' });
        const c = host.boot(map); if (!c) return json({ error: host.fallbacks });
        const bots = new Bots(host, map, { seed: 4 }).postOnHomes(n);
        const tick = host.tick.bind(host); host.tick = at => { bots.step(0.1); return tick(at); };
        const t0 = Date.now(); bots.step(0.1);   // presence starts the loop
        await new Promise(r => setTimeout(r, seconds * 1000));
        const wall = Date.now() - t0, st = host.stats();
        host.stop();
        return json({ seconds, wallMs: wall, ticks: st.ticks, expected: Math.floor(wall / 100), skipped: st.skipped, tick: st.tick, fallbacks: st.fallbacks, running: st.running });
      }
      if (u.pathname === '/stats') return json(this.host ? this.host.stats() : {});
      return json({ error: 'unknown' });
    } catch (e) { return json({ error: String(e && e.stack || e).slice(0, 1500) }); }
  }
  step() { this.at += 100; if (this.bots) this.bots.step(0.1); this.host.tick(this.at); }
}

export default { fetch(req, env) { const u = new URL(req.url); return env.BENCH.get(env.BENCH.idFromName(u.searchParams.get('do') || 'bench')).fetch(req); } };
