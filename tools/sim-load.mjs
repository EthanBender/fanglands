#!/usr/bin/env node
// ============================================================================
// SIM-LOAD — the Stage 2 load hour (docs/ONLINE.md, "The shared world", Stage 2): bot knights against a LOCAL `wrangler dev`
// of this tree's Worker (the real World, the real Room, the real SimHost and game copies), never a deployed world.
//   ./build.sh && node tools/sim-load.mjs [--minutes 30] [--bots 20] [--port 8795] [--out <dir>]
// online/.dev.vars must hold the local ADMIN_KEY and INVITE_CODE (git-ignored). The local runtime (wrangler 4.92's workerd) knows
// compatibility dates up to 2026-05-22, so the local run says that date; the deployed Worker keeps its own. The bots sign up on a fresh local store, the
// three plain instances are switched to 'world', and the bots split across them (8 Deepholm, 8 Aerie, 4 the coal mine). Each
// bot talks like a game: hello with the world's Atlas, presence 8 a second while it walks (about 60% of the time) and 1 a
// second while it stands, a ping every 25 s, and now and then a hit on a monster the world's mon showed it. Every 30 s the
// parent page's GET /api/admin/sim is read for the tick times, the copies and sim_log. The isolate heap is read last,
// through the inspector, as Stage 0 did.
// The pass bar (the spec): tick p99 under 10 ms; no fallback; heap under 64 MB; the requests a knight-hour costs not above
// the keeper path's (the same knights, plus the keeper's own mon stream at 8 a second on each map with two or more on it).
// Writes <out>/sim-load.json. Exit 1 on a miss.
// ============================================================================
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MINUTES = +opt('--minutes', 30), BOTS = +opt('--bots', 20), PORT = +opt('--port', 8795), INSPECT = PORT + 1000;
const OUT = opt('--out', path.join(os.homedir(), '.fanglands', 'work', 'phase1', 'sw-2'));
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const vars = fs.readFileSync(path.join(ROOT, 'online', '.dev.vars'), 'utf8');
const KEY = (vars.match(/ADMIN_KEY=(\S+)/) || [])[1], INVITE = (vars.match(/INVITE_CODE=(\S+)/) || [])[1];
if (!KEY || !INVITE) { console.error('online/.dev.vars needs ADMIN_KEY and INVITE_CODE (local values)'); process.exit(1); }
if (!fs.existsSync(path.join(ROOT, 'online', 'src', 'sim', 'game.mjs'))) { console.error('run ./build.sh first'); process.exit(1); }
const ATLAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'online', 'src', 'atlas.json'), 'utf8'));
const TILE = 48;
const MAPS = [['deepholm', 8], ['aerie', 8], ['coalmine', 4]];

async function startWrangler() {
  const log = path.join(OUT, 'sim-load-wrangler.log');
  fs.mkdirSync(OUT, { recursive: true });
  const fd = fs.openSync(log, 'w');
  const persist = fs.mkdtempSync(path.join(os.tmpdir(), 'fanglands-sim-load-'));
  const p = spawn('wrangler', ['dev', '--local', '--port', String(PORT), '--ip', '127.0.0.1', '--inspector-port', String(INSPECT), '--compatibility-date', '2026-05-22', '--persist-to', persist], { cwd: path.join(ROOT, 'online'), env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', fd, fd], detached: true });
  for (let i = 0; i < 240; i++) { await sleep(500); if (/Ready on/.test(fs.readFileSync(log, 'utf8'))) break; }
  await sleep(800);
  return { log, stop: async () => { try { process.kill(-p.pid, 'SIGTERM'); } catch (e) { } await sleep(1500); try { process.kill(-p.pid, 'SIGKILL'); } catch (e) { } fs.rmSync(persist, { recursive: true, force: true }); } };
}
const api = async (method, p, body, tok, ip) => { const h = { 'content-type': 'application/json' }; if (tok) h.authorization = 'Bearer ' + tok; if (ip) h['cf-connecting-ip'] = ip; const r = await fetch(BASE + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined }); let d = null; try { d = await r.json(); } catch (e) { } return { status: r.status, data: d }; };
async function heap() {
  const WS = createRequire('/opt/homebrew/lib/node_modules/wrangler/package.json')('ws');
  const ws = new WS(`ws://127.0.0.1:${INSPECT}/ws`, { headers: { Origin: 'https://devtools.devprod.cloudflare.dev' } });
  let id = 0; const pend = new Map();
  const call = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 20000); });
  ws.onmessage = e => { const m = JSON.parse(String(e.data)); if (m.id && pend.has(m.id)) { const q = pend.get(m.id); pend.delete(m.id); m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); } };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  try { await call('HeapProfiler.enable'); await call('HeapProfiler.collectGarbage'); } catch (e) { }
  const h = await call('Runtime.getHeapUsage');
  ws.close();
  return { usedMB: +(h.usedSize / 1048576).toFixed(1), totalMB: +(h.totalSize / 1048576).toFixed(1) };
}
// a seeded walk, so a run can be told again
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

class Bot {
  constructor(i, name, token, map) {
    const d = ATLAS.doors[map], f = ATLAS.fixed[map];
    this.i = i; this.name = name; this.token = token; this.map = map; this.r = rng(1000 + i);
    this.w = f.w; this.h = f.h; this.x = (d.entry[0] + 0.5) * TILE; this.y = (d.entry[1] + 0.5) * TILE; this.home = { x: this.x, y: this.y };
    this.sent = 0; this.got = 0; this.mons = 0; this.lastMon = null; this.keeper = null; this.s = 0; this.j = 0; this.moving = false; this.vx = 0; this.vy = 0; this.hits = 0; this.hurts = 0; this.kills = 0; this.gaps = [];
  }
  open() {
    return new Promise((res, rej) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${encodeURIComponent(this.token)}`);
      this.ws = ws;
      ws.onopen = () => { this.send({ t: 'hello', v: 1, caps: [], atlas: ATLAS.hash }); res(); };
      ws.onerror = e => rej(e);
      ws.onmessage = e => {
        this.got++;
        let m = null; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m.t === 'mon') { this.mons++; if (this.lastMonAt) this.gaps.push(Date.now() - this.lastMonAt); this.lastMonAt = Date.now(); this.lastMon = m; }
        else if (m.t === 'keeper') this.keeper = m.n;
        else if (m.t === 'welcome') this.keeper = m.keeper;
        else if (m.t === 'hurt') this.hurts++;
        else if (m.t === 'kill') this.kills++;
      };
      ws.onclose = () => { this.closed = true; };
    });
  }
  send(m) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(m)); this.sent++; } }
  presence() { this.s++; this.send({ t: 'p', map: this.map, region: this.map, x: Math.round(this.x), y: Math.round(this.y), fx: 1, fy: 0, mv: this.moving ? 1 : 0, wt: 0, hp: 50, mhp: 50, lv: 40, look: null, mech: null, dead: false, def: 2000, act: null, j: this.j, spd: 175, s: this.s }); }
  // one tenth of a second of the bot's life
  step(t) {
    const r = this.r;
    if (!this.until || t >= this.until) { this.moving = r() < 0.6; this.until = t + 2000 + r() * 4000; const a = r() * Math.PI * 2; this.vx = Math.cos(a) * 175; this.vy = Math.sin(a) * 175; }
    if (this.moving) {
      this.x += this.vx * 0.1; this.y += this.vy * 0.1;
      // stay near home inside the map
      if (Math.hypot(this.x - this.home.x, this.y - this.home.y) > 8 * TILE || this.x < TILE || this.y < TILE || this.x > (this.w - 1) * TILE || this.y > (this.h - 1) * TILE) { this.vx = -this.vx; this.vy = -this.vy; this.x += this.vx * 0.2; this.y += this.vy * 0.2; }
    }
    // presence: 8 a second while walking, 1 a second standing (the game's own rates)
    this.acc = (this.acc || 0) + 0.1;
    if (this.moving ? this.acc >= 0.125 : this.acc >= 1) { this.acc = 0; this.presence(); }
    if (this.moving && (this.tick = (this.tick || 0) + 1) % 4 === 0) this.presence();   // the 8th of a second the 10 Hz step misses
    // a hit now and then on a monster the world showed this bot (about one every 4 s)
    if (this.lastMon && this.lastMon.list.length && r() < 0.025) { const row = this.lastMon.list[Math.floor(r() * this.lastMon.list.length)]; if (row && !row[11]) { this.send({ t: 'hit', nid: row[0], dmg: 1 + Math.floor(r() * 8), knock: 0, bomb: false }); this.hits++; } }
    if (!this.pingAt || t - this.pingAt >= 25000) { this.pingAt = t; this.send({ t: 'ping' }); }
  }
}
const q = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

const out = { at: new Date().toISOString(), minutes: MINUTES, bots: BOTS, maps: MAPS, samples: [], pass: {} };
const W = await startWrangler();
let code = 0;
try {
  out.wrangler = (fs.readFileSync(W.log, 'utf8').match(/wrangler ([0-9.]+)/) || [])[1] || null;
  const st = await api('GET', '/api/status'); if (st.status !== 200) throw new Error('the local world did not answer: ' + JSON.stringify(st));
  let r = await api('POST', '/api/admin/sim', { maps: { deepholm: 'world', aerie: 'world', coalmine: 'world' } }, KEY);
  if (r.status !== 200) throw new Error('the switch: ' + JSON.stringify(r.data));
  const bots = [];
  let k = 0;
  for (const [map, n] of MAPS) for (let i = 0; i < n && bots.length < BOTS; i++, k++) {
    const name = 'Load ' + String.fromCharCode(65 + Math.floor(k / 26)) + String.fromCharCode(65 + k % 26);
    // each bot signs up from its own made-up address: the world lets 10 new knights a hour from one (world.js SIGNUPS_PER_HOUR)
    const s = await api('POST', '/api/signup', { name, pass: 'load-' + k + '-word', invite: INVITE }, null, '10.9.0.' + (k + 1));
    if (s.status !== 200) throw new Error('signup ' + name + ': ' + JSON.stringify(s.data));
    bots.push(new Bot(k, name, s.data.token, map));
  }
  const m0 = (await api('GET', '/api/admin/sim', null, KEY)).data.meter.today;
  for (const b of bots) { await b.open(); await sleep(150); }
  const t0 = Date.now(), end = t0 + MINUTES * 60000;
  let next = t0, sampleAt = t0 + 30000;
  // the driver's own stalls: this process (not the World) late on its 100 ms step by 250 ms or more means the machine itself
  // stood still (another program's run), which the World's tick times feel too; a fallback next to one is the machine's
  const stalls = [];
  while (Date.now() < end) {
    const t = Date.now();
    if (t - next >= 250) stalls.push({ at: t, lateMs: t - next });
    for (const b of bots) b.step(t);
    if (t >= sampleAt) {
      sampleAt += 30000;
      const v = (await api('GET', '/api/admin/sim', null, KEY)).data, w = v.world;
      const s = { t: Math.round((t - t0) / 1000), tick: w.tick, running: w.running, copies: (w.copies || []).map(c => [c.map, c.knights, c.monsters, c.errors]), skipped: w.skipped, modes: w.modes, held: v.sim.held, log: (w.log || []).length, wsIn: v.meter.today.wsIn };
      out.samples.push(s);
      console.log(`${s.t} s: tick p50 ${s.tick.p50} p99 ${s.tick.p99} max ${s.tick.max} (n ${s.tick.n}), copies ${JSON.stringify(s.copies)}, skipped ${s.skipped}, modes ${JSON.stringify(s.modes)}, held ${JSON.stringify(s.held)}, sim_log ${s.log}`);
    }
    next += 100; const wait = next - Date.now(); if (wait > 0) await sleep(wait); else next = Date.now();
  }
  const secs = (Date.now() - t0) / 1000, hours = secs / 3600 * bots.length;
  const v = (await api('GET', '/api/admin/sim', null, KEY)).data;
  const sent = bots.reduce((a, b) => a + b.sent, 0), gaps = bots.flatMap(b => b.gaps);
  // what the same knights cost on the keeper path: everything they sent, plus the keeper's own mon at 8 a second on each map
  // with two or more knights (its heartbeat once a second otherwise), all incoming socket messages at 20 to 1
  const keeperMon = MAPS.reduce((a, [, n]) => a + (n >= 2 ? 8 : 1), 0) * secs;
  out.result = {
    seconds: Math.round(secs), knightHours: +hours.toFixed(2), sentByBots: sent, hits: bots.reduce((a, b) => a + b.hits, 0), hurts: bots.reduce((a, b) => a + b.hurts, 0), kills: bots.reduce((a, b) => a + b.kills, 0),
    monPerBotPerSecond: +(bots.reduce((a, b) => a + b.mons, 0) / bots.length / secs).toFixed(2), monGap: { p50: q(gaps, 0.5), p99: q(gaps, 0.99), max: q(gaps, 1) },
    keepers: [...new Set(bots.map(b => b.keeper))],
    meterWsIn: v.meter.today.wsIn - m0.wsIn, meterHttp: v.meter.today.http - m0.http,
    requestsPerKnightHour: { world: +((sent / 20) / hours).toFixed(1), keeperPath: +(((sent + keeperMon) / 20) / hours).toFixed(1) },
    tick: v.world.tick, skipped: v.world.skipped, log: v.world.log, held: v.sim.held, copies: v.world.copies, boot: v.world.boot,
  };
  for (const b of bots) try { b.ws.close(); } catch (e) { }
  await sleep(1500);
  out.result.heap = await heap().catch(e => ({ error: String(e.message || e) }));
  const R = out.result, fell = (R.log || []).filter(x => x.to === 'keeper' && x.reason !== 'parent page' && x.reason !== 'master');
  // the tick p99 judged over every 30 s window of the run (each window reads the newest 3,000 ticks), not only the last
  R.tickP99Worst = Math.max(...out.samples.map(x => x.tick && x.tick.p99 != null ? x.tick.p99 : 0), R.tick && R.tick.p99 != null ? R.tick.p99 : 0);
  R.driverStalls = stalls;
  R.fallbacks = fell.map(f => ({ ...f, machineStall: stalls.filter(x => Math.abs(x.at - f.at) <= 5000) }));
  out.pass = {
    tickP99: R.tickP99Worst < 10,
    noFallback: !fell.length && !Object.keys(R.held || {}).length && R.keepers.every(n => typeof n === 'string' && n.startsWith('@world:')),
    heap: typeof R.heap.usedMB === 'number' && R.heap.usedMB < 64,
    requests: R.requestsPerKnightHour.world <= R.requestsPerKnightHour.keeperPath,
  };
  console.log(JSON.stringify(R, null, 1));
  console.log(Object.entries(out.pass).map(([k, ok]) => (ok ? 'PASS  ' : 'FAIL  ') + k).join('\n'));
  if (Object.values(out.pass).some(x => !x)) code = 1;
} catch (e) { console.error(e); out.error = String(e.stack || e); code = 1; }
finally { fs.writeFileSync(path.join(OUT, 'sim-load.json'), JSON.stringify(out, null, 1)); await W.stop(); }
process.exit(code);
