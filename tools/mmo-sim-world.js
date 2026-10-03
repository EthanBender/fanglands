#!/usr/bin/env node
// tools/mmo-sim-world.js — the shared world's Stage 2 sims (docs/ONLINE.md, "The shared world", Stage 2): two whole games in one
// Node process, the REAL Room (online/src/room.js) and the REAL game copy (tools/build-sim.mjs --strip, built from this
// index.html) in a real SimHost, all on one fake clock. Deepholm is switched to 'world'; the games speak the v1 wire.
//
//   node tools/mmo-sim-world.js
//
// What it proves, one PASS/FAIL line each:
//   1. both games see the same rows at the same tick (the same k), and their puppets stand where the copy's monsters stand
//   2. the kill goes to the top damager: Ann does 60 of a dwarf guard's 90, Ben lands the last 30; Ann gets the kill, Ben not
//   3. an injected throw (three in a row) hands deepholm back to Ann's game: every nid, hp and position the copy had is
//      what her game now runs (her handoff), nothing vanished or doubled on Ben's screen, and sim_log says 'throws'
//   4. a keeper-to-world flip mid-fight (the parent page): Ann's game keeps it with a guard chasing Ben; the copy reads her
//      stream and takes it over with the same nids, hp and positions; Ben's puppets never vanish or double
//   5. a game with no caps (an older page: hello is only {t, v}) plays as before: it is told the world keeps the map and
//      shows its monsters
//   6. an admin's spawn reaches the copy: Ann (an admin) spawns 2 goblins; the copy makes them, both games show them
// Exit 0 only when every line passes. The plumbing is tools/mmo-sim.js's (the fake wire, the game contexts, the Room loader).
'use strict';
const vm = require('vm');
const path = require('path');
const { pathToFileURL } = require('url');
const { Wire, makeContext, loadRoom, FRAME_MS, ROOT } = require('./mmo-sim.js');

async function main() {
  const t0 = Date.now();
  const lib = await import(pathToFileURL(path.join(ROOT, 'tools', 'sim-lib.mjs')).href);
  const { SimHost } = await import(pathToFileURL(path.join(ROOT, 'online', 'src', 'sim', 'host.js')).href);
  const { SimBook } = await import(pathToFileURL(path.join(ROOT, 'online', 'src', 'sim', 'book.js')).href);
  lib.takeSlot();
  const strip = await lib.loadGame({ strip: true });
  let vnow = Date.parse('2026-10-03T18:00:00Z'); const now = () => Math.floor(vnow);
  // the host's timers on the same fake clock, run between frames
  const timers = []; let seq = 0;
  const timer = { set: (f, ms) => { const id = ++seq; timers.push({ id, at: vnow + Math.max(0, ms), f }); return id; }, clear: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); } };
  const pump = () => { for (let guard = 0; guard < 100; guard++) { timers.sort((a, b) => a.at - b.at || a.id - b.id); if (!timers.length || timers[0].at > vnow) break; timers.shift().f(); } };
  const book = new SimBook(null, now);
  const room = await loadRoom(now, { simBook: book });
  room.store.addAccount('Ann', 'admin'); room.store.addAccount('Ben'); room.store.addAccount('Cy');
  let inject = null;
  const host = new SimHost({ makeGame: strip.makeGame, now, clock: () => performance.now(), timer, seed: 77,
    onFallback: (m, r, row) => room.worlds.fell(m, r, row), onSend: (m, l) => room.worlds.fromCopy(m, l) });
  room.setSim({ move: 'observe', maps: { deepholm: 'world' } });
  room.worlds.useHost(host);
  const wire = new Wire(room);
  const A = makeContext(wire), B = makeContext(wire);
  let both = [A, B];
  const ev = (g, code) => vm.runInContext(code, g);
  const results = [];
  const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '   ' + JSON.stringify(info) : '')); };
  const tick = n => { for (let i = 0; i < n; i++) { for (const g of both) g.FANGLANDS.step([]); vnow += FRAME_MS; room.tick(); pump(); wire.flush(); } };
  const login = async (g, name) => { const r = await g.NET.post('/api/login', { name, pass: 'secret' }); g.NET.setToken(r.token); g.NET.connect(); wire.flush(); return r; };
  const heal = () => { for (const g of both) ev(g, 'player.hp = player.maxHp; player.dead = false;'); };
  // every mon each game receives, with its k
  const got = new Map();
  const listen = (g, name) => { got.set(name, []); g.NET.on('mon', m => { const l = got.get(name); l.push(m); if (l.length > 200) l.shift(); }); };
  for (const g of both) g.FANGLANDS.newGame();
  await login(A, 'Ann'); await login(B, 'Ben');
  listen(A, 'Ann'); listen(B, 'Ben');
  tick(10);
  // both walk into Deepholm and stand near its first guard (Ann first: she keeps it until the copy takes over)
  const copyOf = () => host.copies.get('deepholm');
  const enter = (g, dx) => ev(g, `(() => { INSTANCES.enter('deepholm'); const m = monsters.find(o => o.type === 'dwarf_guard'); player.x = m.home.x + ${dx}; player.y = m.home.y + 60; window.__peace = true; })()`);
  enter(A, -30); tick(4); enter(B, 30);
  tick(120);
  const keeperA = ev(A, 'COOP.keeper()'), keeperB = ev(B, 'COOP.keeper()');
  line('0. both games walk into Deepholm; the copy built after Ann arrived takes it over: both games say the keeper is @world:deepholm', keeperA === '@world:deepholm' && keeperB === '@world:deepholm' && room.keeperOf('deepholm').name === '@world:deepholm' && !!copyOf(), { keeperA, keeperB, room: room.keeperOf('deepholm') && room.keeperOf('deepholm').name, copy: !!copyOf(), boot: host.bootTimes });

  // ---- 1. the same rows at the same tick ----
  tick(30);
  {
    const a = got.get('Ann'), b = got.get('Ben');
    const ka = new Map(a.filter(m => m.n === '@world:deepholm').map(m => [m.k, m])), shared = b.filter(m => m.n === '@world:deepholm' && ka.has(m.k));
    const same = shared.length >= 10 && shared.every(m => JSON.stringify(m.list) === JSON.stringify(ka.get(m.k).list) && m.at === ka.get(m.k).at);
    const lastK = shared.length ? shared[shared.length - 1].k : null;
    const rate = a.filter(m => m.k > lastK - 10).length;
    const g = copyOf().api.peek, real = g('monsters').filter(m => !m.dead).map(m => [m.nid, Math.round(m.x), Math.round(m.y)]);
    const puppets = g2 => JSON.stringify(ev(g2, 'monsters.filter(m => m.remote && !m.dead).map(m => [m.nid, Math.round(m.to.x), Math.round(m.to.y)]).sort()'));
    const pa = puppets(A), pb = puppets(B);
    line('1. both games get the world\'s mon once a tick (10 a second) with the same rows and the same at for each k, and their puppets stand where the copy\'s monsters stand', same && rate >= 9 && rate <= 11 && pa === pb && pa === JSON.stringify(real.sort()), { shared: shared.length, same, rate, ann: pa, ben: pb, copy: real });
  }

  // ---- 2. the kill goes to the top damager ----
  {
    const g = copyOf().api.peek, m = g('monsters').find(o => o.type === 'dwarf_guard' && !o.dead);
    const kA = ev(A, 'player.kills'), kB = ev(B, 'player.kills');
    let kills = { Ann: 0, Ben: 0 }; A.NET.on('kill', () => kills.Ann++); B.NET.on('kill', () => kills.Ben++);
    const hit = (G, dmg) => { G.NET.send({ t: 'hit', nid: m.nid, dmg, knock: 0, bomb: false }); wire.flush(); tick(8); heal(); };
    hit(A, 30); hit(A, 30); hit(B, 20); hit(B, 20);
    tick(20);
    const deadA = ev(A, `(() => { const p = monsters.find(o => o.nid === '${m.nid}'); return !p || p.dead; })()`);
    line('2. the kill goes to the top damager: Ann 60 of the guard\'s 90, Ben the last 30 (40 sent): Ann gets the kill message and the kill, Ben neither; the puppet lies down on both screens', m.dead && kills.Ann === 1 && kills.Ben === 0 && ev(A, 'player.kills') === kA + 1 && ev(B, 'player.kills') === kB && deadA, { dead: m.dead, kills, annKills: ev(A, 'player.kills') - kA, benKills: ev(B, 'player.kills') - kB, deadA });
  }

  // ---- 3. an injected throw hands the map back to a knight, keeping every nid, hp and position ----
  {
    tick(30);
    const c = copyOf(), g = c.api.peek;
    const before = g('monsters').map(m => ({ nid: m.nid, hp: m.hp, dead: !!m.dead, x: Math.round(m.x), y: Math.round(m.y) }));
    const puppetsB0 = ev(B, 'monsters.filter(m => m.remote).length');
    // the copy throws on every step from now: three in 10 s and the watchdog falls back
    const step = c.wk.step; c.wk.step = () => { throw new Error('injected'); };
    // frame by frame until Ann's game has the map: what her handoff made is read that very frame (her game moves them after)
    let frames = 0; while (!ev(A, 'COOP.isKeeper()') && frames < 120) { tick(1); frames++; }
    const back = room.keeperOf('deepholm') && room.keeperOf('deepholm').name;
    const annReal = ev(A, "JSON.stringify(monsters.filter(m => !m.remote).map(m => ({ nid: m.nid, hp: m.hp, dead: !!m.dead, x: Math.round(m.x), y: Math.round(m.y) })))");
    const after = JSON.parse(annReal);
    tick(30);
    const kept = before.filter(b => !b.dead).every(b => { const a = after.find(x => x.nid === b.nid); return a && !a.dead && Math.abs(a.hp - b.hp) < 1e-6 && Math.hypot(a.x - b.x, a.y - b.y) <= 6; });
    const nidsOnce = new Set(after.map(x => x.nid)).size === after.length;
    const bPuppets = ev(B, "monsters.filter(m => m.remote && !m.dead).map(m => m.nid).sort().join(',')"), aAlive = after.filter(x => !x.dead).map(x => x.nid).sort().join(',');
    c.wk.step = step;
    line('3. three injected throws: the watchdog hands Deepholm back to Ann\'s game (longest there); her game runs every nid with the copy\'s hp and position (within a step); Ben shows the same monsters, none vanished, none twice; sim_log says throws and the map is held',
      back === 'Ann' && ev(A, 'COOP.isKeeper()') && ev(B, 'COOP.keeper()') === 'Ann' && kept && nidsOnce && bPuppets === aAlive && puppetsB0 >= 1 && book.recent(1)[0].reason === 'throws' && room.worlds.sw.held.deepholm && !host.copies.has('deepholm'),
      { back, frames, kept, nidsOnce, bPuppets, aAlive, before, after: after.slice(0, 4), log: book.recent(1)[0], held: room.worlds.sw.held.deepholm });
  }

  // ---- 4. keeper -> world mid-fight (the parent page flips it again) ----
  {
    ev(A, 'window.__peace = false'); ev(B, 'window.__peace = false');
    // Ben angers the living guard in Ann's game (her game keeps the map now): it chases him
    const nid = ev(A, "(() => { const m = monsters.find(o => o.type === 'dwarf_guard' && !o.dead && !o.remote); m.angry = true; m.state = 'chase'; return m.nid; })()");
    ev(B, `(() => { const m = monsters.find(o => o.nid === '${nid}'); if (m) { player.x = m.x + 40; player.y = m.y; } })()`);
    tick(40); heal();
    const fighting = ev(A, `(() => { const m = monsters.find(o => o.nid === '${nid}'); return m && m.state; })()`);
    const ann0 = JSON.parse(ev(A, "JSON.stringify(monsters.filter(m => !m.remote).map(m => ({ nid: m.nid, hp: m.hp, dead: !!m.dead, x: Math.round(m.x), y: Math.round(m.y) })))"));
    const seenB = new Map(); let doubled = 0, vanished = 0, annBlank = 0;
    room.setMode('deepholm', 'world', 'parent page');
    for (let i = 0; i < 90; i++) {
      tick(1); heal();
      const ids = ev(B, 'monsters.filter(m => m.remote && !m.gone).map(m => m.nid)');
      if (new Set(ids).size !== ids.length) doubled++;
      for (const x of ann0) if (!x.dead && !ids.includes(x.nid)) vanished++;
      // and on Ann's own screen (her game kept the map until now): never a frame without them while the world takes over
      const own = ev(A, 'monsters.filter(m => !m.gone && !m.dead).map(m => m.nid)');
      for (const x of ann0) if (!x.dead && !own.includes(x.nid)) annBlank++;
    }
    const c = copyOf(), g = c && c.api.peek;
    const copy = g ? g('monsters').map(m => ({ nid: m.nid, hp: m.hp, x: Math.round(m.x), y: Math.round(m.y), dead: !!m.dead })) : [];
    const same = ann0.filter(a => !a.dead).every(a => { const m = copy.find(x => x.nid === a.nid); return m && Math.abs(m.hp - a.hp) < 1e-6 && Math.hypot(m.x - a.x, m.y - a.y) <= 3 * 48; });
    // and one that was down in her game is down in the copy too: nothing comes back to life in the hand-over
    const stayedDown = ann0.filter(a => a.dead).every(a => { const m = copy.find(x => x.nid === a.nid); return !m || m.dead; });
    line('4. a keeper-to-world flip mid-fight: the guard chasing Ben in Ann\'s game is taken over by the copy with the same nid and hp (and where it was, give or take the 1.5 s it kept walking), the one she had felled stays down; Ben\'s puppets never vanish or double, and on Ann\'s own screen her monsters never blink out while the world takes over; both games say @world:deepholm; sim_log says parent page',
      fighting === 'chase' && !!c && same && stayedDown && !doubled && !vanished && !annBlank && ev(A, 'COOP.keeper()') === '@world:deepholm' && ev(B, 'COOP.keeper()') === '@world:deepholm' && book.recent(1)[0].reason === 'parent page' && book.recent(1)[0].to === 'world',
      { fighting, copy: !!c, same, stayedDown, doubled, vanished, annBlank, ann0, copyNow: copy, log: book.recent(1)[0] });
  }

  // ---- 5. a game with no caps (an older page) ----
  {
    const C = makeContext(wire); C.FANGLANDS.newGame();
    ev(C, "NET.hello = () => ({ t: 'hello', v: 1 })");
    both = [A, B, C];
    await login(C, 'Cy'); tick(10);
    ev(C, "(() => { INSTANCES.enter('deepholm'); const m = monsters.find(o => o.type === 'dwarf_guard'); player.x = m.home.x; player.y = m.home.y + 80; window.__peace = true; })()");
    tick(60);
    const k = ev(C, 'COOP.keeper()'), pup = ev(C, 'monsters.filter(m => m.remote && !m.dead).length'), caps = room.knightsView().find(x => x.n === 'Cy').caps;
    line('5. a game whose hello has no caps and no Atlas (an older page) is told the world keeps Deepholm and shows the copy\'s monsters, as any non-keeper always did', k === '@world:deepholm' && pup >= 1 && Array.isArray(caps) && caps.length === 0, { keeper: k, puppets: pup, caps });
    C.NET.disconnect(); wire.flush(); both = [A, B]; tick(5);
  }

  // ---- 6. an admin's spawn reaches the copy ----
  {
    const at = ev(A, '({ x: player.x + 60, y: player.y })');
    A.NET.send({ t: 'spawn', type: 'goblin', count: 2, x: Math.round(at.x), y: Math.round(at.y) }); wire.flush();
    tick(30);
    const inCopy = copyOf().api.peek('monsters').filter(m => typeof m.nid === 'string' && m.nid.startsWith('!')).map(m => m.nid);
    const onA = ev(A, "monsters.filter(m => m.remote && typeof m.nid === 'string' && m.nid[0] === '!').map(m => m.nid).sort().join(',')"), onB = ev(B, "monsters.filter(m => m.remote && typeof m.nid === 'string' && m.nid[0] === '!').map(m => m.nid).sort().join(',')");
    line('6. Ann (an admin) spawns 2 goblins in Deepholm: the copy makes them (nids !<sid>.0 and .1) and both games show them as the world\'s', inCopy.length === 2 && onA === inCopy.slice().sort().join(',') && onB === onA, { inCopy, onA, onB });
  }

  const errors = copyOf() ? copyOf().w.__errors.slice(0, 3) : [];
  if (errors.length) console.log('  the copy\'s console errors: ' + JSON.stringify(errors));
  const failed = results.filter(r => !r).length;
  console.log((failed ? `${failed} FAILED of ${results.length}` : `ALL ${results.length} PASS`) + ` (the real Room and a real copy, ${Math.round((Date.now() - t0) / 1000)} s; copy boots ${JSON.stringify(host.bootTimes)} ms)`);
  process.exit(failed ? 1 : 0);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
