#!/usr/bin/env node
// ============================================================================
// SIM-AUDIT — what in the game touches monsters outside the 75-coop path (docs/ONLINE.md, "The shared world", Stage 0)
//   node tools/sim-audit.mjs [--minutes 30] [--instance-minutes 5] [--out <dir>] [--apply-off]
// A simulated run in server copies (the stripped build, the stand-in, SimHost), with scripted remote knights touring
// every place: every overworld region (REGIONS) for --minutes of game time, then every instance for --instance-minutes,
// each boss there called. Every monster CREATED, REMOVED or HURT (hp down, or killed) is logged with who did it:
//   hook    a HOOKS entry (its file and hook name, from the tags tools/build-sim.mjs puts on every copy's hooks)
//   msg     a message the world handed the copy: `hit` is the 75-coop path (a knight's hit, routed to the keeper);
//           `boss_call` is 75-coop waking a named boss; anything else is listed as it is
//   update  the game's update outside every hook: the core loop (07-update) and 75-coop's keeper half, or a file's own
//           wrapper of update(); the file is read from the call stack of hitMonster / killMonster / the array's push
//   timer   a setTimeout the game set
// The hooks in the log are the first serverOff list (src/79-worldkeeper.js SERVER_OFF): the code that would act on the
// dead stand-in or on its own, outside what the server means to run. --apply-off keeps SERVER_OFF on (the default
// audits with it off, so the log shows everything).
// Writes <out>/audit.json (every event, counted) and prints the summary.
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadGame, takeSlot, Bots, ROOT } from './sim-lib.mjs';
import { fileOfLine } from './build-sim.mjs';
import { SimHost } from '../online/src/sim/host.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MINUTES = +opt('--minutes', 30), INST_MINUTES = +opt('--instance-minutes', 5);
const OUT = opt('--out', path.join(os.homedir(), '.fanglands', 'work', 'phase1', 'sw-0'));
const APPLY_OFF = args.includes('--apply-off');
takeSlot();
const t0 = Date.now();
const { makeGame, FILES, file: modFile } = await loadGame({ strip: true });
const modName = path.basename(modFile);
const NOW = Date.parse('2026-10-03T12:00:00Z');
const PLUMBING = new Set(['00-core', '04-state', '06-systems', '07-update', '75-coop', '79-worldkeeper', '70-net']);
const SKIP_FN = /^(hitMonster|killMonster|spawnMonsters|_hitMonster|_killMonster|Array\.|push|unshift|splice|rec|audit)/;

const events = new Map();   // key -> {kind, by, file, hook, map, count, types: {}, first}
const knightEvents = new Map();   // file|hook|field|map -> {count, sample}
function bumpKnight(r) {
  const key = [r.file, r.hook, r.field, r.map].join('|');
  let e = knightEvents.get(key); if (!e) { e = { file: r.file, hook: r.hook, field: r.field, map: r.map, count: 0, sample: [r.from, r.to].map(v => typeof v === 'number' ? Math.round(v * 100) / 100 : v && typeof v === 'object' ? 'object' : v) }; knightEvents.set(key, e); }
  e.count++;
}
function bump(rec) {
  const key = [rec.change, rec.by, rec.file || '', rec.hook || '', rec.map].join('|');
  let e = events.get(key);
  if (!e) { e = { change: rec.change, by: rec.by, file: rec.file || null, hook: rec.hook || null, map: rec.map, count: 0, types: {}, first: rec.note || null }; events.set(key, e); }
  e.count++; e.types[rec.type] = (e.types[rec.type] || 0) + 1;
}
// the file of the innermost game frame that is not plumbing (the core, 75-coop, the stand-in, the wrappers of hitMonster ...)
function culprit(stack) {
  const files = [];
  for (const line of String(stack).split('\n').slice(1)) {
    const m = /at (?:(\S+) \()?.*?([^/\s(]+\.mjs):(\d+):\d+\)?$/.exec(line.trim());
    if (!m || m[2] !== modName) continue;
    if (m[1] && SKIP_FN.test(m[1])) continue;
    files.push(fileOfLine(FILES, +m[3]));
  }
  return files.find(f => f && !PLUMBING.has(f)) || files[0] || null;
}

function instrument(host, map) {
  const c = host.copies.get(map), g = c.api.peek, api = c.api, wk = c.wk;
  const ctx = [];                 // what is running now, innermost last
  const blame = new WeakMap();    // monster -> culprit file from the last stack seen on it
  let explained = new Set();      // "change|monster" already logged in this pass
  const snap = () => { const m = new Map(); for (const x of g('monsters')) m.set(x, [x.hp, !!x.dead]); return m; };
  const diff = (before, why) => {
    const after = g('monsters'), seen = new Set();
    const rec = (change, x, note) => {
      const k = change + '|' + (ids.get(x) || ids.set(x, ++idn).get(x));
      if (explained.has(k)) return; explained.add(k);
      const by = why.by, file = why.file || (by === 'update' || by === 'msg' || by === 'timer' ? blame.get(x) || null : null);
      bump({ change, by, file, hook: why.hook, map, type: x.type, note });
    };
    for (const x of after) {
      seen.add(x);
      const b = before.get(x);
      if (!b) rec('created', x);
      else { if (x.hp < b[0] - 1e-9) rec('hurt', x); if (x.dead && !b[1]) rec('killed', x); }
    }
    for (const x of before.keys()) if (!seen.has(x)) rec('removed', x);
  };
  const ids = new WeakMap(); let idn = 0;
  // the stand-in: what a hook changes on the parked, dead knight (the host parks it again before every step)
  const KNIGHT = ['x', 'y', 'hp', 'dead', 'deadT', 'mech', 'speed', 'region'];
  const knight = () => { const p = g('player'); return KNIGHT.map(k => p[k]); };
  const around = (why, f) => {
    const before = snap(), kb = why.by === 'hook' ? knight() : null;
    ctx.push(why);
    try { return f(); } finally {
      ctx.pop(); diff(before, why);
      if (kb) { const ka = knight(); KNIGHT.forEach((k, i) => { if (ka[i] !== kb[i] && !(Number.isNaN(ka[i]) && Number.isNaN(kb[i]))) bumpKnight({ field: k, file: why.file, hook: why.hook, map, from: kb[i], to: ka[i] }); }); }
    }
  };
  // every HOOKS entry but the world passes (they ran at build) runs inside its own context
  const H = g('HOOKS');
  for (const hook of Object.keys(H)) {
    const list = H[hook]; if (!Array.isArray(list) || hook === 'world') continue;
    for (let i = 0; i < list.length; i++) {
      const f = list[i]; if (typeof f !== 'function' || f.__audited) continue;
      const wrapped = function (...a) { return around({ by: 'hook', file: f.__file || '?', hook }, () => f.apply(this, a)); };
      wrapped.__file = f.__file; wrapped.__audited = true; list[i] = wrapped;
    }
  }
  // stacks: who called hitMonster / killMonster, and who pushed onto the monster list
  for (const name of ['hitMonster', 'killMonster']) {
    const inner = g(name);
    api.poke(name, function (m, ...a) { if (m && typeof m === 'object') { const f = culprit(new Error().stack); if (f) blame.set(m, f); } return inner.call(this, m, ...a); });
  }
  const watchArray = () => {
    const arr = g('monsters'); if (arr.__audited) return;
    for (const meth of ['push', 'unshift', 'splice']) Object.defineProperty(arr, meth, { enumerable: false, configurable: true, writable: true, value: function (...a) { const f = culprit(new Error().stack); for (const x of meth === 'splice' ? a.slice(2) : a) if (x && typeof x === 'object' && f) blame.set(x, f); return Array.prototype[meth].apply(this, a); } });
    Object.defineProperty(arr, '__audited', { value: true, enumerable: false });
  };
  // the host's three ways in: messages, the update, timers
  const deliver = wk.deliver;
  wk.deliver = msg => { watchArray(); return around({ by: 'msg', hook: msg && msg.t }, () => deliver(msg)); };
  const step = wk.step;
  wk.step = dt => { watchArray(); explained = new Set(); return around({ by: 'update' }, () => step(dt)); };
  const run = c.w.__runTimers;
  c.w.__runTimers = () => around({ by: 'timer' }, () => run());
  watchArray();
}

function runMap(map, minutes, bots, tour) {
  const host = new SimHost({ makeGame, now: () => NOW, clock: () => performance.now(), timer: { set: () => 0, clear() { } }, seed: 11, serverOff: APPLY_OFF });
  const c = host.boot(map);
  if (!c) return { map, error: host.fallbacks[0] };
  instrument(host, map);
  const B = new Bots(host, map, { seed: 13, leash: 12 });
  tour(B, c);
  const ticks = Math.round(minutes * 600);
  let at = NOW;
  for (let i = 0; i < ticks; i++) {
    if (B.onTick) B.onTick(i, ticks);
    B.step(0.1); at += 100; host.tick(at);
  }
  const st = host.stats();
  return { map, ticks, bootMs: st.boot[map], tick: st.tick, fallbacks: st.fallbacks.map(f => f.reason), errors: c.w.__errors.slice(0, 5), hits: B.hits, off: c.wk.off.length };
}

const runs = [];
// the overworld: 4 knights touring every region, each region's middle (the nearest open spot), in turn
{
  const probe = await (async () => { const host = new SimHost({ makeGame, now: () => NOW, timer: { set: () => 0, clear() { } } }); const c = host.boot('over'); const g = c.api.peek; return { regions: g('REGIONS').map(r => ({ name: r.name, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 })), calls: Object.entries(g('HOOKS').bossCall || {}).filter(([k, h]) => h.map === 'over').map(([k, h]) => ({ id: k, near: h.near })) }; })();
  const places = probe.regions.filter(r => r.x1 > r.x0 && r.y1 > r.y0);
  runs.push(runMap('over', MINUTES, null, (B, c) => {
    const g = c.api.peek, T = g('TILE');
    const spot = r => { const cx = Math.floor((r.x0 + r.x1) / 2), cy = Math.floor((r.y0 + r.y1) / 2); return g('safeSpot')((cx + 0.5) * T, (cy + 0.5) * T, 13, 'player') || { x: (cx + 0.5) * T, y: (cy + 0.5) * T }; };
    const n = 4; for (let i = 0; i < n; i++) { const s = spot(places[i % places.length]); B.add('Bot' + i, s.x, s.y); }
    const per = Math.max(1, Math.floor(MINUTES * 600 / Math.ceil(places.length / n)));
    B.visited = new Set();
    B.onTick = (i) => {
      if (i % per === 0) B.list.forEach((k, j) => { const r = places[(Math.floor(i / per) * n + j) % places.length]; const s = spot(r); B.moveTo(k, s.x, s.y); B.visited.add(r.name); });
      // a named boss on the overworld is called whenever a knight stands near it
      if (i % 600 === 300) for (const call of probe.calls) {
        if (call.near) { const k = B.list[0]; const s = { x: (call.near[0] + 0.5) * T, y: (call.near[1] + 0.5) * T }; B.moveTo(k, s.x, s.y); }
        B.host.deliver('over', { t: 'boss_call', n: B.list[0].n, id: call.id, first: true });
      }
    };
  }));
  runs[0].places = places.length;
}
// every instance: two knights at the entry, the bosses called
{
  const host = new SimHost({ makeGame, now: () => NOW, timer: { set: () => 0, clear() { } } }); const c0 = host.boot('over');
  const list = c0.w.INSTANCES.list().filter(id => id !== 'house');
  for (const id of list) runs.push(runMap(id, INST_MINUTES, null, (B, c) => {
    const g = c.api.peek, T = g('TILE'), inst = c.w.INSTANCES.get(id), e = inst.entry;
    B.leash = 60;
    B.add('Ann', (e[0] + 0.5) * T, (e[1] + 0.5) * T); B.add('Ben', (e[0] + 0.5) * T + 20, (e[1] + 0.5) * T);
    const calls = Object.keys(g('HOOKS').bossCall || {}).filter(k => g('HOOKS').bossCall[k].map === id);
    B.onTick = i => { if (i % 600 === 10) for (const k of calls) B.host.deliver(id, { t: 'boss_call', n: 'Ann', id: k, first: true }); };
  }));
}

const list = [...events.values()].sort((a, b) => (a.by === 'msg' && a.hook === 'hit') - (b.by === 'msg' && b.hook === 'hit') || b.count - a.count);
const coopPath = e => (e.by === 'msg' && e.hook === 'hit') || (e.by === 'update' && (!e.file || PLUMBING.has(e.file)));
const outside = list.filter(e => !coopPath(e));
// the first serverOff list: every HOOKS entry (file, hook) that touched a monster on its own
const off = {};
for (const e of outside) if (e.by === 'hook' && e.file && e.file !== '?') { (off[e.file] = off[e.file] || new Set()).add(e.hook); }
const serverOff = Object.fromEntries(Object.entries(off).sort().map(([f, s]) => [f, [...s].sort()]));
const knightList = [...knightEvents.values()].sort((a, b) => b.count - a.count);
const result = { at: new Date().toISOString(), minutes: MINUTES, instanceMinutes: INST_MINUTES, applyOff: APPLY_OFF, ms: Date.now() - t0, runs, events: list, outside, serverOff, standIn: knightList };
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(result, null, 1));
for (const r of runs) console.log(`${r.map}: ${r.ticks} ticks${r.places ? ' through ' + r.places + ' regions' : ''}, boot ${r.bootMs} ms, tick p50 ${r.tick && r.tick.p50} ms p99 ${r.tick && r.tick.p99} ms, ${r.hits} knight hits, fallbacks ${JSON.stringify(r.fallbacks)}, errors ${r.errors.length}${r.errors.length ? ' ' + JSON.stringify(r.errors.slice(0, 2)) : ''}`);
console.log('\nThe 75-coop path (expected):');
for (const e of list.filter(coopPath)) console.log(`  ${e.change.padEnd(8)} ${String(e.count).padStart(6)}  ${e.by}${e.hook ? ':' + e.hook : ''}${e.file ? ' (' + e.file + ')' : ''} on ${e.map}  ${JSON.stringify(e.types)}`);
console.log('\nOutside the 75-coop path:');
for (const e of outside) console.log(`  ${e.change.padEnd(8)} ${String(e.count).padStart(6)}  ${e.by}${e.hook ? ':' + e.hook : ''}${e.file ? ' (' + e.file + ')' : ''} on ${e.map}  ${JSON.stringify(e.types)}`);
console.log('\nHooks that changed the parked stand-in (it is parked again before every step):');
for (const e of knightList) console.log(`  ${String(e.count).padStart(6)}  ${e.file} ${e.hook} -> player.${e.field} on ${e.map}  e.g. ${JSON.stringify(e.sample)}`);
console.log('\nserverOff (hooks that touched monsters on their own): ' + JSON.stringify(serverOff));
console.log(`\nwritten ${path.join(OUT, 'audit.json')} in ${Math.round((Date.now() - t0) / 1000)} s`);
