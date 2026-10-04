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
//   7. a knight ALONE on a map that is switched to 'world' mid-fight, on an OLDER page (no 'snap' capability: Dee in the Aerie,
//      a sentinel chasing her): her game sends only its empty heartbeat, so the copy keeps its own monsters standing: nothing
//      vanishes on her screen, nothing near her is laid down in the copy, and the world keeps the Aerie
//   8. a world-run map rebuilt with no stream (a wake, a deploy or an eviction: the Room comes back from its sockets before the
//      game copy has loaded): the knight the Room picks is TOLD he keeps the map, so his game runs it (his own hits land) until
//      the new copy takes over; nothing vanishes on his screen, nothing near him lies down in the copy; Deepholm (two knights)
//      comes back to the world from its keeper's stream
//   9. a knight whose game stops (an iPad locked, a game paused) with a sentinel after her: after SILENT (3 s) the copy takes her
//      for fallen (alone there, it parks), so no blow lands on her socket while she cannot play (30 s); when her game sends
//      presence again the copy fights her again
//  10. every game stops with its socket open (tabs left in the background): once every knight on a map is silent its copy
//      parks; with both copies parked no timer stays armed and nothing ticks for 10 minutes; each copy's monsters stand
//      exactly as they were; when the games go on, the same copies tick again and every screen shows the same monsters at the
//      copy's places, none vanished, none twice
//  11. the lone keeper's full snapshot (the 'snap' capability): Eve walks ALONE into the world-run Deepholm and hurts and moves a
//      guard while the copy is being built; the copy asks her game for every monster and takes the map over with the guard at
//      her hp and place (it never jumps home at full health on her screen); then the same mid-fight, the parent page giving
//      Deepholm to her game and back. MMO_SIM_NO_SNAP=1 runs it with her page's capability taken away: it then fails
//  0b. the places the world refuses because no monster lives there (WORLD_EMPTY: the coal mine) have no monster in their copy,
//      and each place it can run (WORLD_READY) has some
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
  let room = await loadRoom(now, { simBook: book });
  room.store.addAccount('Ann', 'admin'); room.store.addAccount('Ben'); room.store.addAccount('Cy');
  let inject = null;
  let host = new SimHost({ makeGame: strip.makeGame, now, clock: () => performance.now(), timer, seed: 77,
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
  const parkedOf = m => typeof host.isParked === 'function' ? host.isParked(m) : false;   // (false on a host older than parking)
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

  // ---- 7. a knight alone, switched to the world mid-fight ----
  ev(A, 'window.__peace = true'); ev(B, 'window.__peace = true');   // Deepholm's goblins leave Ann and Ben be from here
  const D = makeContext(wire); D.FANGLANDS.newGame();
  ev(D, 'NET.caps.length = 0');   // Dee's page is older than the 'snap' capability (checks 7 to 9 are the older pages' path)
  room.store.addAccount('Dee');
  both = [A, B, D];
  await login(D, 'Dee'); tick(10);
  const aerieOf = () => host.copies.get('aerie');
  // what Dee's screen shows near her: every monster standing within 18 tiles (nid list), counted every frame
  const nearD = () => ev(D, 'monsters.filter(m => !m.gone && !m.dead && Math.hypot(m.x - player.x, m.y - player.y) <= 18 * TILE).map(m => m.nid)');
  const watch = (frames, ids0, each) => { let vanished = 0, doubled = 0; const gone = new Set(); for (let i = 0; i < frames; i++) { tick(1); heal(); const ids = ev(D, 'monsters.filter(m => !m.gone && !m.dead).map(m => m.nid)'); if (new Set(ids).size !== ids.length) doubled++; for (const n of ids0) if (!ids.includes(n)) { vanished++; gone.add(n); } if (each) each(i); } return { vanished, doubled, gone: [...gone] }; };
  const deadNearIn = (c, g) => { if (!c) return null; const p = ev(g, '({ x: player.x, y: player.y })'); return c.api.peek('monsters').filter(m => m.dead && Math.hypot(m.x - p.x, m.y - p.y) <= 24 * 48).map(m => m.nid + ' respawnT ' + Math.round(m.respawnT)); };
  {
    ev(D, "(() => { INSTANCES.enter('aerie'); const m = monsters.find(o => o.nid === 'i0'); player.x = m.home.x + 60; player.y = m.home.y; window.__peace = false; })()");
    tick(40); heal();
    const keeps = ev(D, 'COOP.isKeeper()') && room.keeperOf('aerie') && room.keeperOf('aerie').name === 'Dee';
    // mid-fight: the sentinel is after her and she has hurt it
    ev(D, "(() => { const m = monsters.find(o => o.nid === 'i0'); m.angry = true; m.state = 'chase'; hitMonster(m, 2, 0); })()");
    tick(10); heal();
    // switched just after her game's heartbeat, so the next one lands while the copy is waiting (the copy has ticked by then)
    for (let i = 0; i < 90 && !(ev(D, 'COOP.state.beatAcc || 0') < 0.05); i++) { tick(1); heal(); }
    const ids0 = nearD(), hurt = ev(D, "(() => { const m = monsters.find(o => o.nid === 'i0'); return m.hp < m.maxHp; })()");
    room.setMode('aerie', 'world', 'parent page');
    const w = watch(300, ids0);
    const dead = deadNearIn(aerieOf(), D);
    line('7. Dee alone in the Aerie on an older page (no snap), a sentinel after her, is switched to the world mid-fight: her game sends only its heartbeat, so the copy keeps its own monsters standing; none of the ' + ids0.length + ' near her vanish or double on her screen in the 5 s after (the take-over waits 1.5 s for a stream that never comes), none near her lies down in the copy, and her game says @world:aerie',
      keeps && hurt && ids0.length >= 2 && !w.vanished && !w.doubled && !!aerieOf() && Array.isArray(dead) && dead.length === 0 && ev(D, 'COOP.keeper()') === '@world:aerie' && room.keeperOf('aerie').name === '@world:aerie',
      { keeps, hurt, near: ids0, vanished: w.vanished, gone: w.gone, doubled: w.doubled, copy: !!aerieOf(), deadInCopy: dead, keeper: ev(D, 'COOP.keeper()') });
  }

  // ---- 8. a world-run map rebuilt with no stream (the Room comes back from its sockets before the copy has loaded) ----
  {
    tick(20); heal();
    const ids0 = nearD(), bIds0 = ev(B, 'monsters.filter(m => m.remote && !m.gone && !m.dead).map(m => m.nid)');
    // the old object is gone: its loop stops, and a new Room is rebuilt from what each socket carried (silently, as a wake does)
    host.stop(); for (const m of [...host.copies.keys()]) host.drop(m);
    const room2 = await loadRoom(now, { simBook: book, store: room.store });
    room2.setSim({ move: 'observe', master: room.worlds.sw.master, maps: room.worlds.sw.maps, held: room.worlds.sw.held });
    for (const [sock, k] of room.knights) room2.restore(sock, { name: k.name, since: k.since, hello: k.hello, map: k.map, mapAt: k.mapAt, region: k.region, lv: k.lv, caps: k.caps, atlas: k.atlas });
    room = room2; wire.room = room2;
    const picked = room2.keeperOf('aerie') && room2.keeperOf('aerie').name;
    tick(2); heal();   // the copy's code is still loading
    let toldAt = -1, hitLanded = null;
    host = new SimHost({ makeGame: strip.makeGame, now, clock: () => performance.now(), timer, seed: 78,
      onFallback: (m, r, row) => room2.worlds.fell(m, r, row), onSend: (m, l) => room2.worlds.fromCopy(m, l) });
    room2.worlds.useHost(host);
    const bSeen = [];
    const w = watch(180, ids0, i => {
      bSeen.push(ev(B, 'monsters.filter(m => m.remote && !m.gone && !m.dead).map(m => m.nid)'));
      if (toldAt < 0 && ev(D, 'COOP.isKeeper()')) {
        toldAt = i;
        // his own swing while his game keeps the map lands in his game (it is not sent to a Room that would drop it)
        hitLanded = ev(D, "(() => { const m = monsters.find(o => !o.dead && !o.remote && o.nid === 'i0'); if (!m) return null; const hp = m.hp; hitMonster(m, 1, 0); return m.hp < hp; })()");
      }
    });
    tick(30); heal();
    const dead = deadNearIn(aerieOf(), D);
    const bIds = ev(B, 'monsters.filter(m => m.remote && !m.gone && !m.dead).map(m => m.nid)');
    // on Ben's screen: every monster he showed before that is still standing in the new copy is there in every frame
    // (the copy's monsters standing within Ben's view: the world sends a knight the ones within 24 tiles; a goblin that wandered
    // further off goes from his screen as the contract says)
    const bAt = ev(B, '({ x: player.x, y: player.y })');
    const dc = copyOf(), standing = dc ? dc.api.peek('monsters').filter(m => !m.dead && Math.hypot(m.x - bAt.x, m.y - bAt.y) <= 24 * 48).map(m => m.nid) : [];
    const bLost = bIds0.filter(n => standing.includes(n) && bSeen.some(f => !f.includes(n)));
    // (what each side holds of any monster standing near Ben in the copy that his screen does not show)
    const missing = standing.filter(n => !bIds.includes(n)).map(n => { const m = dc.api.peek('monsters').find(o => o.nid === n), kb = room.byName.get('ben'); return { nid: n, copy: m && { x: Math.round(m.x), y: Math.round(m.y), hp: m.hp, born: m.respawnT }, ben: ev(B, `(() => { const p = monsters.find(o => o.nid === '${n}'); return p ? { x: Math.round(p.x), y: Math.round(p.y), dead: !!p.dead, gone: !!p.gone, deadT: p.deadT } : null; })()`), roomAt: kb && [Math.round(kb.x), Math.round(kb.y)] }; });
    line('8. the Room rebuilt with Dee in the world-run Aerie and no copy loaded: she (picked: ' + picked + ') is told she keeps it and her own hit lands; the new copy then takes it over with nothing vanishing on her screen and nothing near her laid down in it; Deepholm comes back to the world from Ann and Ben\'s stream',
      picked === 'Dee' && toldAt >= 0 && hitLanded === true && !w.vanished && !w.doubled && Array.isArray(dead) && dead.length === 0 && ev(D, 'COOP.keeper()') === '@world:aerie' && room2.keeperOf('aerie').name === '@world:aerie'
        && ev(A, 'COOP.keeper()') === '@world:deepholm' && ev(B, 'COOP.keeper()') === '@world:deepholm' && bIds0.length >= 1 && !bLost.length && standing.every(n => bIds.includes(n)),
      { picked, toldAt, hitLanded, vanished: w.vanished, gone: w.gone, doubled: w.doubled, deadInCopy: dead, keeper: ev(D, 'COOP.keeper()'), deepholm: [ev(A, 'COOP.keeper()'), ev(B, 'COOP.keeper()')], bIds0, bIds, standing, bLost, missing, benAt: bAt });
  }

  // ---- 9. a knight whose game stops is not beaten while it is stopped ----
  {
    const { SILENT } = await import(pathToFileURL(path.join(ROOT, 'online', 'src', 'sim', 'worlds.js')).href);
    const hurts = []; D.NET.on('hurt', m => hurts.push({ at: vnow, dmg: m.dmg }));
    const angry = () => { const c = aerieOf(), p = ev(D, '({ x: player.x, y: player.y })'); const m = c.api.peek('monsters').find(o => o.nid === 'i0'); m.dead = false; m.hp = m.maxHp; m.angry = true; m.state = 'chase'; m.x = p.x + 50; m.y = p.y; return m; };
    angry(); tick(60); heal();
    const fought = hurts.length;
    // her game stops: no step, no presence, the socket left open
    both = [A, B]; const stopAt = vnow; hurts.length = 0;
    tick(30 * 60);
    const late = hurts.filter(h => h.at - stopAt > SILENT + 500), early = hurts.length;
    // the copy holds her fallen: told so, or (she is alone in the Aerie) parked at the same moment, so it never steps again
    const told = host.copies.get('aerie').knights.get('Dee'), parked = parkedOf('aerie');
    const copyKnows = { dead: !!(told && told.dead), parked };
    // her game goes on: its presence brings her back, and the sentinel comes for her again
    both = [A, B, D]; hurts.length = 0;
    for (let i = 0; i < 20; i++) { tick(1); heal(); } angry(); for (let i = 0; i < 120; i++) { tick(1); heal(); }
    const back = aerieOf().w.COOP.knightsHere().find(k => k.n === 'Dee');
    line('9. Dee\'s game stops for 30 s with a sentinel after her (socket open): after ' + SILENT + ' ms the copy takes her for fallen (alone in the Aerie, it parks), so no blow reaches her while she cannot play; when her game goes on the copy fights her again',
      fought >= 1 && late.length === 0 && copyKnows.dead === true && copyKnows.parked && !parkedOf('aerie') && !!back && back.dead === false && hurts.length >= 1,
      { foughtBefore: fought, inFirst: early - late.length, late: late.length, copyKnows, back, hurtsAfter: hurts.length });
  }

  // ---- 10. every game stops with its socket open: the copies park, nothing is armed, nothing ticks; then all goes on ----
  {
    const { SILENT } = await import(pathToFileURL(path.join(ROOT, 'online', 'src', 'sim', 'worlds.js')).href);
    // Ann and Ben in Deepholm, Dee in the Aerie, all standing (a knight felled in the checks above woke on the overworld)
    heal();
    for (const [g, dx] of [[A, -30], [B, 30]]) if (ev(g, 'COOP.map()') !== 'deepholm') { enter(g, dx); tick(2); }
    for (let i = 0; i < 120; i++) { tick(1); heal(); }
    const games = [['Ann', A], ['Ben', B], ['Dee', D]];
    const where = games.map(([n, g]) => n + ' ' + ev(g, 'COOP.map()') + ' ' + ev(g, 'COOP.keeper()'));
    const stateOf = c => JSON.stringify(c.api.peek('monsters').map(m => [m.nid, m.type, m.x, m.y, m.hp, !!m.dead]));
    const cs = { deepholm: copyOf(), aerie: aerieOf() };
    both = [];   // no game steps: no presence, no heartbeat; every socket stays open
    let frames = 0; while (!(parkedOf('deepholm') && parkedOf('aerie')) && frames < 600) { tick(1); frames++; }
    const parkedMs = Math.round(frames * FRAME_MS), armed = timers.length, running = host.running;
    const s0 = { deepholm: stateOf(cs.deepholm), aerie: stateOf(cs.aerie) }, t0 = host.ticks, k0 = cs.deepholm.ticks + cs.aerie.ticks;
    tick(10 * 60 * 60);   // ten minutes of frames: only the Room's own tick runs
    const ticked = host.ticks - t0, stepped = cs.deepholm.ticks + cs.aerie.ticks - k0, armed10 = timers.length;
    const same = stateOf(cs.deepholm) === s0.deepholm && stateOf(cs.aerie) === s0.aerie;
    const shown = g => ev(g, 'monsters.filter(m => m.remote && !m.gone && !m.dead).map(m => m.nid)');
    const before = {}; for (const [n, g] of games) before[n] = shown(g);
    // the games go on
    both = [A, B, D]; let vanished = 0, doubled = 0;
    for (let i = 0; i < 90; i++) { tick(1); heal(); for (const [n, g] of games) { const ids = shown(g); if (new Set(ids).size !== ids.length) doubled++; for (const nid of before[n]) if (!ids.includes(nid)) vanished++; } }
    const resumed = !parkedOf('deepholm') && !parkedOf('aerie') && host.running && copyOf() === cs.deepholm && aerieOf() === cs.aerie && cs.deepholm.ticks + cs.aerie.ticks > k0;
    // every screen's puppets stand where its copy's monsters stand (the last row, within a tile: the copy moves on each tick)
    const far = [];
    for (const [n, g] of games) {
      const c = ev(g, 'COOP.map()') === 'aerie' ? cs.aerie : cs.deepholm, real = new Map(c.api.peek('monsters').filter(m => !m.dead).map(m => [m.nid, m]));
      for (const p of ev(g, 'monsters.filter(m => m.remote && !m.gone && !m.dead).map(m => [m.nid, m.to.x, m.to.y])')) { const m = real.get(p[0]); if (!m || Math.hypot(m.x - p[1], m.y - p[2]) > 48) far.push(n + ' ' + p[0]); }
    }
    line('10. every game stops with its socket open (tabs in the background): each copy parks once all its knights are silent (' + parkedMs + ' ms); then no timer is armed and in 10 minutes nothing ticks and no monster moves; when the games go on, the same copies tick again and every screen keeps the same monsters at the copy\'s places, none vanished, none twice',
      parkedMs <= SILENT + 300 && armed === 0 && !running && ticked === 0 && stepped === 0 && armed10 === 0 && same && resumed && !vanished && !doubled && !far.length && games.filter(([n]) => before[n].length >= 1).length >= 2,
      { where, parkedMs, armed, running, ticked, stepped, armed10, same, resumed, vanished, doubled, far, before });
  }

  // ---- 11. the lone keeper's full snapshot (the 'snap' capability) ----
  {
    const noSnap = process.env.MMO_SIM_NO_SNAP === '1';
    const E = makeContext(wire); E.FANGLANDS.newGame();
    if (noSnap) ev(E, 'NET.caps.length = 0');
    room.store.addAccount('Eve');
    await login(E, 'Eve');
    // Ann and Ben walk out of Deepholm: it empties, and a minute later its copy is gone (the frames run with every game still)
    for (const g of [A, B]) ev(g, 'INSTANCES.leave()');
    both = [A, B, D, E]; tick(10); both = [];
    tick(61 * 60);
    const gone = !host.copies.has('deepholm');
    both = [A, B, D, E];
    // Eve's full answer, as her game sends it
    ev(E, "(() => { const s = NET.send; window.__full = []; NET.send = (m, x) => { if (m && m.t === 'mon' && m.full === true) __full.push(JSON.parse(JSON.stringify(m.list))); return s(m, x); }; })()");
    const guard = () => ev(E, "(() => { const m = monsters.find(o => o.nid === 'i0'); return m ? { hp: m.hp, x: m.remote ? m.to.x : m.x, y: m.remote ? m.to.y : m.y, remote: !!m.remote, dead: !!m.dead } : null; })()");
    const watchE = frames => { const track = []; for (let i = 0; i < frames; i++) { tick(1); heal(); track.push(guard()); } return track; };
    // frame by frame on her screen: a jump is a move of over a tile in one frame; a heal is hp up by more than 2 in one frame or
    // back to full (a monster's own slow mending is neither)
    const MAXHP = ev(E, "MONSTER_DEFS.dwarf_guard.hp");
    const judge = track => {
      let jumps = 0, healed = 0, vanished = 0; for (let i = 1; i < track.length; i++) { const a = track[i - 1], b = track[i]; if (!b || b.dead) { vanished++; continue; } if (a && Math.hypot(b.x - a.x, b.y - a.y) > 48) jumps++; if ((a && b.hp > a.hp + 2) || b.hp >= MAXHP) healed++; }
      return { jumps, healed, vanished };
    };
    const copyGuard = () => { const c = copyOf(); const m = c && c.api.peek('monsters').find(o => o.nid === 'i0'); return m ? { hp: m.hp, x: Math.round(m.x), y: Math.round(m.y), dead: !!m.dead } : null; };
    // (a) she walks in alone and, in the second before the world has its copy (in workerd the build takes about that), hurts the
    // guard and it comes at her
    const hp0 = ev(E, "(() => { INSTANCES.enter('deepholm'); const m = monsters.find(o => o.nid === 'i0'); player.x = m.home.x + 200; player.y = m.home.y; window.__peace = true; m.angry = true; m.state = 'chase'; m.x = m.home.x + 120; hitMonster(m, 30, 0); return m.hp; })()");
    const ta = watchE(150);
    const fullA = ev(E, '__full.length'), ka = ev(E, 'COOP.keeper()'), ca = copyGuard(), ja = judge(ta);
    // (b) mid-fight: the parent page gives Deepholm to her game, she hurts the guard again and it chases her; then back to the world
    room.setMode('deepholm', 'keeper', 'parent page'); tick(30); heal();
    const kb0 = ev(E, 'COOP.isKeeper()');
    const hp1 = ev(E, "(() => { const m = monsters.find(o => o.nid === 'i0'); m.angry = true; m.state = 'chase'; hitMonster(m, 20, 0); return m.hp; })()");
    tick(20); heal();
    const pos1 = guard();
    room.setMode('deepholm', 'world', 'parent page');
    const tb = watchE(150);
    const fullB = ev(E, '__full.length'), kb = ev(E, 'COOP.keeper()'), cb = copyGuard(), jb = judge(tb);
    const okA = gone && fullA === (noSnap ? 0 : 1) && ka === '@world:deepholm' && !!ca && !ca.dead && ca.hp <= hp0 + 3 && !ja.jumps && !ja.healed && !ja.vanished;
    const okB = kb0 && hp1 < hp0 && kb === '@world:deepholm' && !!cb && !cb.dead && cb.hp <= hp1 + 3 && !jb.jumps && !jb.healed && !jb.vanished;
    line('11. the lone keeper\'s full snapshot' + (noSnap ? ' (MMO_SIM_NO_SNAP: her page without the capability)' : '') + ': Eve walks alone into the world-run Deepholm and hurts a guard (' + Math.round(hp0) + ' hp) while the copy is built; the world asks her game for every monster and takes over with the guard at her hp and place (it never jumps home or heals on her screen); the same when the parent page gives the place to her game mid-fight and back (' + Math.round(hp1) + ' hp)',
      okA && okB, { maxHp: MAXHP, gone, a: { full: fullA, keeper: ka, copy: ca, hp0, ...ja }, b: { keeperFirst: kb0, full: fullB, keeper: kb, copy: cb, hp1, at: pos1, ...jb } });
  }

  // ---- 0b. the places the world refuses for want of monsters really have none ----
  {
    const { WORLD_EMPTY, WORLD_READY } = await import(pathToFileURL(path.join(ROOT, 'online', 'src', 'sim', 'worlds.js')).href);
    const h2 = new SimHost({ makeGame: strip.makeGame, now, timer: { set: () => 0, clear() { } }, seed: 5 }), count = {};
    for (const m of [...WORLD_EMPTY, ...WORLD_READY]) { const c = h2.boot(m); count[m] = c ? c.api.peek('monsters').length : null; h2.drop(m); }
    line('0b. every place the world refuses for want of monsters (' + WORLD_EMPTY.join(', ') + ') has none in its copy, and every place it can run has some', WORLD_EMPTY.every(m => count[m] === 0) && WORLD_READY.every(m => count[m] > 0), count);
  }

  const errors = copyOf() ? copyOf().w.__errors.slice(0, 3) : [];
  if (errors.length) console.log('  the copy\'s console errors: ' + JSON.stringify(errors));
  const failed = results.filter(r => !r).length;
  console.log((failed ? `${failed} FAILED of ${results.length}` : `ALL ${results.length} PASS`) + ` (the real Room and a real copy, ${Math.round((Date.now() - t0) / 1000)} s; copy boots ${JSON.stringify(host.bootTimes)} ms)`);
  process.exit(failed ? 1 : 0);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
