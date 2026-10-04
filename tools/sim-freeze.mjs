#!/usr/bin/env node
// ============================================================================
// SIM-FREEZE — how long the whole World stands still while it builds a cold game copy (docs/ONLINE.md, "The shared world",
// Stage 2, "the cold copy"), measured against a LOCAL `wrangler dev` of this tree (the real World), never a deployed world.
//   ./build.sh && node tools/sim-freeze.mjs [--runs 6] [--port 8796] [--out <dir>]
// Three watcher bots stand together on the overworld, each sending its presence 8 times a second (the cap), a third of a
// beat apart; a fourth bot keeps watching what the Room relays and times each presence from the moment it was sent to the
// moment it came back relayed (the World handles every message one at a time, so while it builds a copy nothing is relayed).
// A walker stands in Deepholm. Each run turns Deepholm on at the parent page (a cold build: its copy was dropped when the run
// before turned it off), and reads the longest relay delay in the 6 s after, the same in the 6 s before (the quiet line), and
// the build time the World itself measured (GET /api/admin/sim world.boot). Writes <out>/sim-freeze.json. Always exit 0: it
// measures, it does not judge.
// ============================================================================
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const RUNS = +opt('--runs', 6), PORT = +opt('--port', 8796);
const OUT = opt('--out', path.join(os.homedir(), '.fanglands', 'work', 'phase1', 'sw-2'));
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const vars = fs.readFileSync(path.join(ROOT, 'online', '.dev.vars'), 'utf8');
const KEY = (vars.match(/ADMIN_KEY=(\S+)/) || [])[1], INVITE = (vars.match(/INVITE_CODE=(\S+)/) || [])[1];
if (!KEY || !INVITE) { console.error('online/.dev.vars needs ADMIN_KEY and INVITE_CODE (local values)'); process.exit(1); }
const ATLAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'online', 'src', 'atlas.json'), 'utf8'));
const TILE = 48;

async function startWrangler() {
  const log = path.join(OUT, 'sim-freeze-wrangler.log');
  fs.mkdirSync(OUT, { recursive: true });
  const fd = fs.openSync(log, 'w');
  const persist = fs.mkdtempSync(path.join(os.tmpdir(), 'fanglands-sim-freeze-'));
  const p = spawn('wrangler', ['dev', '--local', '--port', String(PORT), '--ip', '127.0.0.1', '--compatibility-date', '2026-05-22', '--persist-to', persist], { cwd: path.join(ROOT, 'online'), env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', fd, fd], detached: true });
  for (let i = 0; i < 240; i++) { await sleep(500); if (/Ready on/.test(fs.readFileSync(log, 'utf8'))) break; }
  await sleep(800);
  return { log, stop: async () => { try { process.kill(-p.pid, 'SIGTERM'); } catch (e) { } await sleep(1500); try { process.kill(-p.pid, 'SIGKILL'); } catch (e) { } fs.rmSync(persist, { recursive: true, force: true }); } };
}
const api = async (method, p, body, tok, ip) => { const h = { 'content-type': 'application/json' }; if (tok) h.authorization = 'Bearer ' + tok; if (ip) h['cf-connecting-ip'] = ip; const r = await fetch(BASE + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined }); let d = null; try { d = await r.json(); } catch (e) { } return { status: r.status, data: d }; };
const open = (token, onmsg) => new Promise((res, rej) => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${encodeURIComponent(token)}`);
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', v: 1, caps: [], atlas: ATLAS.hash })); res(ws); };
  ws.onerror = rej; ws.onmessage = e => { let m = null; try { m = JSON.parse(e.data); } catch (x) { return; } onmsg(m); };
});

const out = { at: new Date().toISOString(), host: os.hostname(), cpus: os.cpus().length, runs: [] };
const W = await startWrangler();
try {
  out.wrangler = (fs.readFileSync(W.log, 'utf8').match(/wrangler ([0-9.]+)/) || [])[1] || null;
  const sign = async (name, k) => { const s = await api('POST', '/api/signup', { name, pass: 'freeze-' + k + '-word', invite: INVITE }, null, '10.8.0.' + (k + 1)); if (s.status !== 200) throw new Error('signup ' + name + ': ' + JSON.stringify(s.data)); return s.data.token; };
  const names = ['Watch One', 'Watch Two', 'Watch Three', 'Watch Four', 'Walker'];
  const toks = []; for (let i = 0; i < names.length; i++) toks.push(await sign(names[i], i));
  const sentAt = new Map(), delays = [];   // [arrivedAt, delayMs]
  const socks = [];
  for (let i = 0; i < 4; i++) socks.push(await open(toks[i], m => { if (i === 3 && m.t === 'p' && typeof m.q === 'string' && sentAt.has(m.q)) { const t = Date.now(); delays.push([t, t - sentAt.get(m.q)]); sentAt.delete(m.q); } }));
  const walker = await open(toks[4], () => { });
  const ox = 30 * TILE, oy = 30 * TILE;
  const d = ATLAS.doors.deepholm, wx = (d.entry[0] + 0.5) * TILE, wy = (d.entry[1] + 0.5) * TILE;
  await sleep(300);
  const pres = (ws, map, x, y, q) => ws.send(JSON.stringify({ t: 'p', map, region: map, x, y, fx: 1, fy: 0, mv: 0, hp: 50, mhp: 50, lv: 40, dead: false, def: 2000, j: 0, spd: 175, q }));
  for (let i = 0; i < 4; i++) pres(socks[i], 'over', ox + i * 10, oy);
  pres(walker, 'deepholm', wx, wy);
  // the three watchers, a third of a beat apart, 8 a second each; the walker 1 a second (he stands)
  let n = 0, stop = false;
  const beat = i => { if (stop) return; const q = i + ':' + (++n); sentAt.set(q, Date.now()); pres(socks[i], 'over', ox + i * 10, oy, q); setTimeout(() => beat(i), 125); };
  for (let i = 0; i < 3; i++) setTimeout(() => beat(i), 42 * i);
  const walk = () => { if (stop) return; pres(walker, 'deepholm', wx, wy); setTimeout(walk, 1000); }; walk();
  await sleep(3000);
  const maxIn = (a, b) => { let m = 0, c = 0; for (const [t, dl] of delays) if (t >= a && t < b) { c++; if (dl > m) m = dl; } return { max: m, n: c }; };
  for (let r = 0; r < RUNS; r++) {
    const t0 = Date.now();
    await sleep(6000);
    const quiet = maxIn(t0, t0 + 6000);
    const on = Date.now();
    const res = await api('POST', '/api/admin/sim', { maps: { deepholm: 'world' } }, KEY);
    await sleep(6000);
    const busy = maxIn(on, on + 6000);
    const sim = (await api('GET', '/api/admin/sim', null, KEY)).data;
    const row = { run: r + 1, posted: res.status, quietMaxMs: quiet.max, freezeMaxMs: busy.max, samples: busy.n, bootMs: sim.world.boot.deepholm, mode: sim.world.modes.deepholm };
    out.runs.push(row); console.log(JSON.stringify(row));
    await api('POST', '/api/admin/sim', { maps: { deepholm: 'keeper' } }, KEY);   // the copy is dropped: the next run is cold
    await sleep(1500);
  }
  stop = true;
  for (const s of socks) s.close(); walker.close();
  const xs = k => out.runs.map(r => r[k]).sort((a, b) => a - b);
  const med = a => a[Math.floor(a.length / 2)];
  out.summary = { freezeMs: { min: xs('freezeMaxMs')[0], median: med(xs('freezeMaxMs')), max: xs('freezeMaxMs').at(-1) }, bootMs: { min: xs('bootMs')[0], median: med(xs('bootMs')), max: xs('bootMs').at(-1) }, quietMs: { median: med(xs('quietMaxMs')), max: xs('quietMaxMs').at(-1) } };
  console.log('summary ' + JSON.stringify(out.summary));
} catch (e) { console.error(e); out.error = String(e && e.stack || e); }
finally { await W.stop(); fs.writeFileSync(path.join(OUT, 'sim-freeze.json'), JSON.stringify(out, null, 1)); }
