// ============================================================================
// SIM-LIB — what tools/sim-suite.mjs, tools/sim-audit.mjs and tools/sim-bench share (docs/ONLINE.md, "The shared world")
//   loadGame({strip, keepTests})  builds index.html into a module in a temp folder and imports it: {makeGame, FILES, file}
//   takeSlot()                    the same machine-wide test-slot lock tools/headless.js takes
//   plainCopy(makeGame, seed)     a copy with no stand-in, started the way the title starts a new knight
//   stateHash(api), mapHash(api)  what "the same simulation" is checked on
//   Bots                          scripted knights: presence that walks to the nearest monster and swings at it
// ============================================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSim } from './build-sim.mjs';
import { makeWindow, mulberry32, hashBytes } from '../online/src/sim/window.js';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export { makeWindow, mulberry32, hashBytes };

let tmp = null;
export async function loadGame({ strip = true, keepTests = false, testUi = false, html = path.join(ROOT, 'index.html') } = {}) {
  if (!tmp) { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fanglands-sim-')); process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { } }); }
  const { code, report } = buildSim({ html: fs.readFileSync(html, 'utf8'), strip, keepTests, testUi });
  const file = path.join(tmp, `game.${strip ? 'strip' : 'full'}${keepTests ? '.tests' : ''}${testUi ? '.ui' : ''}.mjs`);
  fs.writeFileSync(file, code);
  const mod = await import(pathToFileURL(file).href);
  return { makeGame: mod.makeGame, FILES: mod.FILES, file, report };
}

// ---------------------------------------------------------------------------
// The slot lock (tools/headless.js): a run waits for one of a few machine-wide slots rather than piling on.
// ---------------------------------------------------------------------------
const SLOTS = process.env.FANGLANDS_TEST_SLOTS !== undefined ? +process.env.FANGLANDS_TEST_SLOTS : Math.max(2, Math.floor((os.cpus().length || 4) / 3));
const LOCKDIR = path.join(os.tmpdir(), 'fanglands-test-slots');
let myLock = null;
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
export function takeSlot() {
  if (!SLOTS || myLock) return;
  try { fs.mkdirSync(LOCKDIR, { recursive: true }); } catch (e) { return; }
  const started = Date.now();
  for (;;) {
    for (let i = 0; i < SLOTS; i++) {
      const f = path.join(LOCKDIR, 'slot-' + i);
      try { fs.writeFileSync(f, String(process.pid), { flag: 'wx' }); myLock = f; return; } catch (e) { }
      try { const owner = +fs.readFileSync(f, 'utf8'); if (!owner || !alive(owner)) { fs.unlinkSync(f); i--; } } catch (e) { }
    }
    if (Date.now() - started > 15 * 60 * 1000) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
}
export function freeSlot() { if (myLock) { try { fs.unlinkSync(myLock); } catch (e) { } myLock = null; } }
process.on('exit', freeSlot);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { freeSlot(); process.exit(1); });

// ---------------------------------------------------------------------------
// Copies and hashes
// ---------------------------------------------------------------------------
// a copy with no stand-in: the game booted (99-boot), then a new knight exactly as the title starts one
export function plainCopy(makeGame, seed = 7, now = Date.parse('2026-10-03T12:00:00Z')) {
  const w = makeWindow({ seed, now });
  const api = makeGame(w);
  api.peek('newGame')();
  try { api.peek('title').active = false; } catch (e) { }
  w.Math.random = mulberry32(seed ^ 0x5eed);
  return { w, api, g: api.peek };
}
export function mapHash(api) { return hashBytes(api.peek('map')); }
export function stateHash(api, extra = []) {
  let h = 0x811c9dc5;
  const mix = v => { h = Math.imul(h ^ (v | 0), 0x01000193) >>> 0; };
  for (const m of api.peek('monsters')) { mix(Math.round(m.x * 4)); mix(Math.round(m.y * 4)); mix(Math.round((m.hp || 0) * 100)); mix(m.dead ? 1 : 2); mix((m.type || '').length); }
  const p = api.peek('player'); mix(Math.round(p.x)); mix(Math.round(p.y)); mix(Math.round((p.hp || 0) * 100)); mix(p.dead ? 1 : 2);
  for (const v of extra) mix(v);
  return h.toString(16);
}

export { Bots } from './sim-bots.mjs';
