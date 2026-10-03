#!/usr/bin/env node
// ============================================================================
// SIM-BENCH — the Stage 0 measurements inside workerd, under a LOCAL `wrangler dev --local` (docs/ONLINE.md, "The shared world")
//   ./build.sh && node tools/sim-bench.mjs [--port 8797] [--out <dir>]
// Starts tools/sim-bench/ (a local-only Worker: no routes, never deployed) and measures:
//   - the overworld copy's boot (from outside: one request minus an empty round trip; inside: a zero-delay timer after it)
//   - tick p50 / p99 with 1, 5 and 20 scripted knights (each tick timed inside by a zero-delay timer after it; the mean
//     of 600 ticks back to back timed from outside to check it)
//   - SimHost's own 10 Hz loop for 10 s with 20 knights (ticks run, skipped, its lag-timed p50 / p99)
//   - each instance's boot, full build and worldGen:false
//   - the isolate heap with the overworld plus 3 instance copies, read last on a fresh start through the inspector
//     (attaching the inspector broke later heavy requests in the spike, so nothing runs after it)
// Writes <out>/bench.json and prints it.
// ============================================================================
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './sim-lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = +opt('--port', 8797), INSPECT = PORT + 1000;
const OUT = opt('--out', path.join(os.homedir(), '.fanglands', 'work', 'phase1', 'sw-0'));
const DIR = path.join(ROOT, 'tools', 'sim-bench');
const BASE = `http://127.0.0.1:${PORT}`;
if (!fs.existsSync(path.join(ROOT, 'online', 'src', 'sim', 'game.mjs'))) { console.error('run ./build.sh first (online/src/sim/game.mjs is missing)'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startWrangler(tag) {
  const log = path.join(OUT, `bench-wrangler-${tag}.log`);
  fs.mkdirSync(OUT, { recursive: true });
  const fd = fs.openSync(log, 'w');
  const p = spawn('wrangler', ['dev', '--local', '--port', String(PORT), '--ip', '127.0.0.1', '--inspector-port', String(INSPECT), '--persist-to', path.join(os.tmpdir(), 'fanglands-sim-bench-' + process.pid)], { cwd: DIR, env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', fd, fd], detached: true });
  for (let i = 0; i < 120; i++) { await sleep(500); if (/Ready on/.test(fs.readFileSync(log, 'utf8'))) break; }
  await sleep(500);
  return { stop: async () => { try { process.kill(-p.pid, 'SIGTERM'); } catch (e) { } await sleep(1500); try { process.kill(-p.pid, 'SIGKILL'); } catch (e) { } await sleep(500); }, log };
}
async function get(p) { const t = performance.now(); const r = await fetch(BASE + p); const j = await r.json(); return { ms: performance.now() - t, j }; }
async function heap(label) {
  const WS = createRequire('/opt/homebrew/lib/node_modules/wrangler/package.json')('ws');
  const ws = new WS(`ws://127.0.0.1:${INSPECT}/ws`, { headers: { Origin: 'https://devtools.devprod.cloudflare.dev' } });
  let id = 0; const pend = new Map();
  const call = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 20000); });
  ws.onmessage = e => { const m = JSON.parse(String(e.data)); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  try { await call('HeapProfiler.enable'); await call('HeapProfiler.collectGarbage'); } catch (e) { }
  const h = await call('Runtime.getHeapUsage');
  ws.close();
  return { label, usedMB: +(h.usedSize / 1048576).toFixed(1), totalMB: +(h.totalSize / 1048576).toFixed(1) };
}

const out = { at: new Date().toISOString(), wrangler: null, runs: [] };
// ---------- part 1: boots and ticks ----------
{
  const W = await startWrangler('ticks');
  out.wrangler = (fs.readFileSync(W.log, 'utf8').match(/wrangler ([0-9.]+)/) || [])[1] || null;
  try {
    const noop = []; for (let i = 0; i < 8; i++) noop.push((await get('/noop?do=a')).ms);
    const rt = Math.min(...noop); out.roundTripMs = +rt.toFixed(2);
    // the overworld copy's boot, three times on fresh hosts
    out.overworldBoot = [];
    for (let i = 0; i < 3; i++) { await get('/reset?do=a'); const b = await get('/boot?do=a&map=over'); out.overworldBoot.push({ outsideMs: +(b.ms - rt).toFixed(1), insideMs: b.j.insideMs, monsters: b.j.monsters }); }
    for (const k of [1, 5, 20]) {
      const s = await get(`/setup?do=a&map=over&knights=${k}&warm=50`); if (s.j.error) { out.runs.push({ knights: k, error: s.j.error }); continue; }
      const z = await get('/run?do=a&ticks=0'), a = await get('/run?do=a&ticks=600');
      const batchMean = (a.ms - z.ms) / 600;
      const t = await get('/ticks?do=a&n=600');
      out.runs.push({ knights: k, monsters: s.j.monsters, tick: t.j.tick, insideMean: +t.j.mean.toFixed(3), batchMeanFromOutside: +batchMean.toFixed(3), emptyTimer: t.j.emptyTimer });
    }
    const loop = await get('/loop?do=b&seconds=10&knights=20');
    out.loop10s20knights = loop.j;
    // every instance: full build, then worldGen:false
    out.instanceBoot = {};
    for (const id of ['spider_den', 'war_shed', 'deepholm', 'tinker_lab', 'afterlands', 'aerie', 'coalmine', 'stormfront', 'royalmine']) {
      const r = {};
      for (const wg of ['1', '0']) { await get('/reset?do=c'); const b = await get(`/boot?do=c&map=${id}&worldgen=${wg}`); r[wg === '1' ? 'full' : 'worldGenFalse'] = { outsideMs: +(b.ms - rt).toFixed(1), insideMs: b.j.insideMs, ok: b.j.ok, monsters: b.j.monsters }; }
      out.instanceBoot[id] = r;
    }
  } finally { await W.stop(); }
}
// ---------- part 2: the heap, last, each step on a fresh start ----------
out.heap = [];
for (const step of [
  { label: 'module only', boots: [] },
  { label: 'overworld', boots: ['over'] },
  { label: 'overworld + 3 instances (deepholm, aerie, spider_den)', boots: ['over', 'deepholm', 'aerie', 'spider_den'] },
]) {
  const W = await startWrangler('heap');
  try {
    await get('/noop?do=h');
    for (const m of step.boots) { const b = await get(`/boot?do=h&map=${m}`); if (!b.j.ok) throw new Error('boot ' + m + ' ' + JSON.stringify(b.j)); }
    out.heap.push(await heap(step.label));
  } catch (e) { out.heap.push({ label: step.label, error: String(e.message || e) }); }
  finally { await W.stop(); }
}
fs.writeFileSync(path.join(OUT, 'bench.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
