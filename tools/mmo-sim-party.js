#!/usr/bin/env node
// tools/mmo-sim-party.js — drop parties, with two whole games in one Node process against the REAL Room.
//
//   MMO_ROOM=<path to room.js> node tools/mmo-sim-party.js     (without MMO_ROOM: this checkout's online/src/room.js)
//
// MudGoll (an admin in the Room's store) and Sam (a player) log in through the same fake wire as tools/mmo-sim.js.
// What it proves, in order (docs/ONLINE.md, "Admins and drop parties", Testing):
//   1. MudGoll throws a party from the party panel's own buttons; both games hold the same crackers, Sam's draws them,
//      and both hear the announcement.
//   2. Both knights light the SAME cracker in the SAME frame: exactly one boom, the Room's first light wins, only the
//      winner's coins go up, the other hears "taken"; the Room's store has it lit, then claimed. Then the other way round.
//   3. A scripted roll gives a party hat: the lighter gets it once, both games announce it, the lighter wears it
//      (and, once 73-players passes `hat` in presence, the other game draws it: SKIP until then).
//   4. A prize that survives a disconnect mid-fuse: it arrives after the next welcome, lands once, is claimed, and a
//      second reconnect brings nothing.
//   5. A rebuilt Room on the same store (the World's nap): both games get the unlit crackers back, lit ones stay lit,
//      and lighting still works.
//   6. Fifteen minutes on the Room's clock end the party on both screens; End the party on the panel does it too.
// The Room's random() is a seeded PRNG with a queue a scenario can script (the roll is hat first, then the row,
// then the quantity, then the fuse). Exit 0 only when every line passes; SKIP lines need a later merge.
'use strict';
const vm = require('vm');
const { Wire, makeContext, loadRoom, FRAME_MS } = require('./mmo-sim.js');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const t0 = Date.now();
  let vnow = Date.now(); const now = () => vnow;
  // the Room's dice: a seeded stream, and a queue a scenario fills to force the next roll
  const rng = mulberry32(20260925), queue = [];
  const random = () => (queue.length ? queue.shift() : rng());
  const COINS = [0.99, 0.5, 0.5, 0.5];            // not a hat (0.99 × 10 ≥ 1), the one row, the quantity, a 1,750 ms fuse
  const HAT_PURPLE = [0.05, 4.5 / 6, 0.5];        // a hat (0.05 × 10 < 1), colour 4 of 6 = purple, a 1,750 ms fuse
  let room = await loadRoom(now, { random });
  const where = process.env.MMO_ROOM || 'online/src/room.js';
  if (!room.store || typeof room.store.addAccount !== 'function') {
    console.log('NOT READY  ' + where + ' has no store (the drop party Room is on the server branch): run with MMO_ROOM=<its room.js>');
    process.exit(2);
  }
  room.store.addAccount('MudGoll', 'admin');
  room.store.addAccount('Sam');
  const wire = new Wire(room);
  const A = makeContext(wire), B = makeContext(wire);   // A is MudGoll, the admin; B is Sam
  const both = [A, B], name = g => (g === A ? 'MudGoll' : 'Sam');
  const results = [];
  const line = (text, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + text + (info !== undefined ? '   ' + JSON.stringify(info) : '')); };
  const skip = (text, info) => console.log('SKIP  ' + text + (info !== undefined ? '   ' + JSON.stringify(info) : ''));
  const run = (g, code) => vm.runInContext(code, g);
  for (const g of both) { g.FANGLANDS.newGame(); g.__peace = true; }

  let frames = 0;
  const tick = (n, each) => {
    for (let i = 0; i < n; i++) {
      for (const g of both) g.FANGLANDS.step([]);
      vnow += FRAME_MS; frames++;
      if (typeof room.tick === 'function') room.tick();
      wire.flush();
      if (each) each();
    }
  };
  // what each game heard, by message type
  const heard = new Map(both.map(g => [g, {}]));
  for (const g of both) g.NET.on('*', m => { const h = heard.get(g); (h[m.t] = h[m.t] || []).push(m); });
  const got = (g, t, f) => (heard.get(g)[t] || []).filter(m => !f || f(m));
  const forget = () => { for (const g of both) heard.set(g, {}); };
  const coins = g => g.FANGLANDS.countItem('coins');
  const click = (g, key) => { run(g, 'render()'); return g.FANGLANDS.clickButton(key); };
  const drawnCrackers = g => run(g, '(() => { render(); const items = []; for (const hk of HOOKS.draw) hk(ctx, items, cam); const cr = items.filter(it => it.cracker); for (const it of cr) it.draw(); return cr.map(it => it.cracker).sort(); })()');
  const ids = g => g.PARTY.live().map(c => c.id).sort();
  // a 9 x 9 patch of grass, out of the village, so a spread of 4 always finds its ten tiles
  const openSpot = (cx, cy) => run(A, `(() => { for (let r = 0; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = ${cx} + dx, y = ${cy} + dy; let ok = inMap(x - 5, y - 5) && inMap(x + 5, y + 5); for (let yy = y - 4; yy <= y + 4 && ok; yy++) for (let xx = x - 4; xx <= x + 4 && ok; xx++) if (tileAt(xx, yy) !== T.GRASS) ok = false; if (ok && !inVillageBounds(tc(x), tc(y))) return { x, y }; } return null; })()`);
  // stand a knight on a cracker (a few px off its centre, so it is the nearest one by far) and face it
  const standOn = (g, c, dx) => { const p = g.FANGLANDS.player; p.x = c.tx * 48 + 24 + dx; p.y = c.ty * 48 + 24; p.facing = { x: dx < 0 ? 1 : -1, y: 0 }; p.action = null; };

  // ---- log in ----
  const login = async (g, n) => { const r = await g.NET.post('/api/login', { name: n, pass: 'secret' }); g.NET.setToken(r.token); g.NET.connect(); wire.flush(); return r; };
  await login(A, 'MudGoll');
  await login(B, 'Sam');
  tick(4);
  const spot = openSpot(40, 24);
  A.FANGLANDS.tp(spot.x, spot.y); B.FANGLANDS.tp(spot.x + 2, spot.y + 2);
  tick(20);   // presence reaches the Room: it measures the party's ground from the admin's last p
  line('MudGoll (an admin) and Sam (a player) are in the world, and the Room says who is the admin', A.NET.online() && B.NET.online() && A.PARTY.isAdmin() && !B.PARTY.isAdmin(), { a: A.NET.me, b: B.NET.me, aAdmin: A.PARTY.isAdmin(), bAdmin: B.PARTY.isAdmin() });

  // ---- 1. a party both knights see ----
  forget();
  A.PARTY.open();
  click(A, 'party:count:-5|'); click(A, 'party:count:-5|');               // 20 -> 10 crackers
  click(A, 'party:spread:-1|');                                           // 5 -> 4 tiles
  click(A, 'party:hat:10|');                                              // party hats 1 in 10
  click(A, 'party:tab:prizes|'); click(A, 'party:row:coins|');
  for (let i = 0; i < 20 && A.PARTY.UI.table[0].min > 5; i++) click(A, 'party:min:down|');
  for (let i = 0; i < 20 && A.PARTY.UI.table[0].max > 5; i++) click(A, 'party:max:down|');
  for (let i = 0; i < 30 && A.PARTY.UI.table[0].w > 1; i++) click(A, 'party:w:down|');
  click(A, 'party:tab:party|');
  const threw = click(A, 'party:throw|');
  tick(6);
  const live = room.store.liveParties(vnow);
  const party = live[live.length - 1];
  const pid = party && party.id;
  const aIds = ids(A), bIds = ids(B), drawn = drawnCrackers(B);
  const annA = got(A, 'announce', m => m.kind === 'party'), annB = got(B, 'announce', m => m.kind === 'party');
  line('1. MudGoll throws from the panel\'s buttons (10 crackers, spread 4, coins 5 to 5, 1 in 10): the Room keeps exactly that party',
    threw && !!party && party.by === 'MudGoll' && party.hat === 10 && JSON.stringify(party.table) === JSON.stringify([{ id: 'coins', min: 5, max: 5, w: 1 }]) && party.crackers.length === 10
    && party.crackers.every(c => Math.hypot(c.tx - spot.x, c.ty - spot.y) <= 4),
    party && { pid, by: party.by, hat: party.hat, table: party.table, crackers: party.crackers.length, panel: run(A, 'panel') });
  line('1. both games hold the same party with the same 10 crackers, and Sam\'s game draws them',
    aIds.length === 10 && JSON.stringify(aIds) === JSON.stringify(bIds) && aIds.every(id => id.startsWith('p' + pid + '.')) && JSON.stringify(drawn) === JSON.stringify(bIds),
    { a: aIds.length, b: bIds.length, same: JSON.stringify(aIds) === JSON.stringify(bIds), drawn: drawn.length });
  line('1. both games heard the announcement and show the gold banner',
    annA.length === 1 && annB.length === 1 && /^MudGoll started a drop party in .+!$/.test(A.PARTY.S.banner && A.PARTY.S.banner.text) && B.PARTY.S.banner && B.PARTY.S.banner.text === A.PARTY.S.banner.text,
    { a: A.PARTY.S.banner && A.PARTY.S.banner.text, b: B.PARTY.S.banner && B.PARTY.S.banner.text });

  // ---- 2. the same cracker, the same frame ----
  const race = (first, second, crk, label) => {
    forget();
    standOn(first, crk, -8); standOn(second, crk, 8);
    tick(20);   // both presences reach the Room: it measures the distance from each knight's last p
    const c0 = { a: coins(A), b: coins(B) };
    queue.length = 0; queue.push(...COINS);
    first.FANGLANDS.press('KeyE'); second.FANGLANDS.press('KeyE');   // both lights leave in the same frame, first's ahead
    wire.flush();
    const boomsA = got(A, 'boom', m => m.id === crk.id), boomsB = got(B, 'boom', m => m.id === crk.id);
    const lights = [got(first, 'light_no', m => m.id === crk.id), got(second, 'light_no', m => m.id === crk.id)];
    const lcWin = name(first).toLowerCase();
    const litBy = room.store.cracker ? (room.store.cracker(pid, crk.k) || {}).litBy : null;
    const pending = room.store.unclaimed(lcWin, 0).some(w => w.id === crk.id);
    tick(130);   // past the 1,750 ms fuse
    const d = { a: coins(A) - c0.a, b: coins(B) - c0.b };
    const claimed = room.store.cracker ? !!(room.store.cracker(pid, crk.k) || {}).claimed : !room.store.unclaimed(lcWin, 0).some(w => w.id === crk.id);
    const winnerGot = first === A ? d.a === 5 && d.b === 0 : d.b === 5 && d.a === 0;
    line('2. ' + label + ': exactly one boom for the cracker reaches each game, naming ' + name(first) + ' (the Room took that light first); ' + name(second) + ' hears "taken"',
      boomsA.length === 1 && boomsB.length === 1 && boomsA[0].n === name(first) && boomsB[0].n === name(first) && lights[0].length === 0 && lights[1].length === 1 && lights[1][0].code === 'taken',
      { boomsA: boomsA.map(m => m.n), boomsB: boomsB.map(m => m.n), lightNo: lights.map(l => l.map(m => m.code)) });
    line('2. ' + label + ': after the fuse only ' + name(first) + '\'s coins went up by 5; the Room\'s store had it lit by ' + name(first) + ', then claimed',
      winnerGot && (litBy === null || litBy === lcWin) && pending && claimed && !room.store.unclaimed(name(second).toLowerCase(), 0).some(w => w.id === crk.id),
      { coins: d, litBy, pending, claimed });
  };
  const cr = () => A.PARTY.live();
  race(A, B, cr()[0], 'cracker ' + cr()[0].id);
  race(B, A, cr()[0], 'cracker ' + cr()[0].id + ', Sam first');

  // ---- 3. a party hat ----
  forget();
  { const c = cr()[0];
    standOn(B, c, 6); A.FANGLANDS.tp(spot.x - 3, spot.y); tick(20);
    queue.length = 0; queue.push(...HAT_PURPLE);
    B.FANGLANDS.press('KeyE'); wire.flush();
    const boom = got(B, 'boom', m => m.id === c.id)[0];
    tick(130);
    const hats = B.FANGLANDS.countItem('party_hat_purple');
    const annA = got(A, 'announce', m => m.kind === 'hat'), annB = got(B, 'announce', m => m.kind === 'hat');
    line('3. a scripted roll gives a party hat: the boom says party_hat_purple, Sam gets exactly one, MudGoll gets none',
      !!boom && boom.n === 'Sam' && boom.reward && boom.reward.id === 'party_hat_purple' && boom.reward.hat === 'purple' && boom.reward.qty === 1 && hats === 1 && A.FANGLANDS.countItem('party_hat_purple') === 0,
      { reward: boom && boom.reward, sam: hats });
    line('3. both games show "Sam found a purple party hat!"',
      annA.length === 1 && annB.length === 1 && A.PARTY.S.banner.text === 'Sam found a purple party hat!' && B.PARTY.S.banner.text === 'Sam found a purple party hat!',
      { a: A.PARTY.S.banner && A.PARTY.S.banner.text, b: B.PARTY.S.banner && B.PARTY.S.banner.text });
    const slot = B.FANGLANDS.player.inv.findIndex(s => s && s.id === 'party_hat_purple');
    run(B, 'equipItem(' + slot + ')'); tick(12);
    const look = run(B, 'playerLook()');
    line('3. Sam wears it: his look has hat purple and no helm', look.hat === 'purple' && !look.helm && B.FANGLANDS.player.equip.helm === 'party_hat_purple', { hat: look.hat, helm: look.helm || null });
    if (run(B, "'hat' in PLAYERS.lookOf()")) {
      const r = A.PLAYERS.remote.Sam;
      line('3. MudGoll\'s game draws Sam in the purple hat (presence carries it)', !!r && !!r.look && r.look.hat === 'purple', { look: r && r.look });
    } else skip('3. MudGoll\'s game draws Sam in the purple hat: 73-players\' lookOf() does not pass `hat` on this branch (the admin branch adds it; integration)', { lookOf: Object.keys(run(B, 'PLAYERS.lookOf()')) });
  }

  // ---- 4. a prize that survives a disconnect ----
  forget();
  { const c = cr()[0];
    standOn(B, c, 6); tick(20);
    const c0 = coins(B);
    queue.length = 0; queue.push(...COINS);
    B.FANGLANDS.press('KeyE'); wire.flush();
    const boom = got(B, 'boom', m => m.id === c.id)[0];
    B.NET.disconnect(); wire.flush();          // gone before the fuse ends: no claim can have gone out
    const claimsBefore = got(B, 'prize').length;
    const unclaimed = room.store.unclaimed('sam', 0).some(w => w.id === c.id);
    tick(130);                                  // the fuse ends on Sam's screen while he is away
    const whileAway = coins(B) - c0;
    B.NET.connect(); wire.flush(); tick(4);
    const prizes = got(B, 'prize', m => m.id === c.id);
    const d = coins(B) - c0;
    const claimed = !room.store.unclaimed('sam', 0).some(w => w.id === c.id);
    line('4. Sam lights a cracker and drops off before the fuse ends: the Room keeps it unclaimed; back again, the prize arrives, lands once (5 coins) and is claimed',
      !!boom && boom.n === 'Sam' && claimsBefore === 0 && unclaimed && prizes.length === 1 && d === 5 && claimed,
      { boom: !!boom, unclaimed, whileAway, prizes: prizes.length, coins: d, claimed });
    forget();
    B.NET.disconnect(); wire.flush(); B.NET.connect(); wire.flush(); tick(4);
    line('4. a second reconnect brings no prize and changes nothing', got(B, 'prize').length === 0 && coins(B) - c0 === 5 && B.NET.online(), { prizes: got(B, 'prize').length, coins: coins(B) - c0 });
  }

  // ---- 5. a rebuilt Room on the same store ----
  forget();
  { const before = { a: ids(A), b: ids(B) };
    const lit = run(A, 'Array.from(PARTY.S.banged)').filter(id => id.startsWith('p' + pid + '.'));
    const room2 = await loadRoom(now, { random, store: room.store });
    wire.room = room2; room = room2;
    for (const g of both) g.NET.disconnect();
    wire.flush();
    for (const g of both) g.NET.connect();
    wire.flush(); tick(20);
    const after = { a: ids(A), b: ids(B) };
    const storeUnlit = (room2.store.liveParties(vnow).find(p => p.id === pid) || { crackers: [] }).crackers.filter(c => !c.litBy).map(c => 'p' + pid + '.' + c.k).sort();
    line('5. a new Room on the same store (the World\'s nap): both games get the unlit crackers back, the same ones as before, and none already lit',
      after.a.length > 0 && JSON.stringify(after.a) === JSON.stringify(before.a) && JSON.stringify(after.b) === JSON.stringify(before.a) && JSON.stringify(after.a) === JSON.stringify(storeUnlit) && lit.length >= 4 && !lit.some(id => after.a.includes(id)),
      { before: before.a.length, a: after.a.length, b: after.b.length, store: storeUnlit.length, litStayLit: lit });
    const c = cr()[0];
    standOn(B, c, 6); tick(20);
    const c0 = coins(B);
    queue.length = 0; queue.push(...COINS);
    B.FANGLANDS.press('KeyE'); wire.flush();
    const boom = got(B, 'boom', m => m.id === c.id);
    tick(130);
    // an id lit before the nap is still lit: lighting it answers gone or taken, never a boom
    B.FANGLANDS.player.x += 0;
    run(B, 'PARTY.S.lastLight.clear()');
    B.NET.send({ t: 'light', id: lit[0], x: Math.round(B.FANGLANDS.player.x), y: Math.round(B.FANGLANDS.player.y) }); wire.flush();
    const relight = got(B, 'light_no', m => m.id === lit[0]);
    line('5. lighting still works after the nap (a boom, 5 coins), and a cracker lit before it stays lit',
      boom.length === 1 && boom[0].n === 'Sam' && coins(B) - c0 === 5 && relight.length === 1 && (relight[0].code === 'taken' || relight[0].code === 'gone') && !got(B, 'boom', m => m.id === lit[0]).length,
      { boom: boom.length, coins: coins(B) - c0, relight: relight.map(m => m.code) });
  }

  // ---- 6. expiry, and End the party ----
  forget();
  { const left = ids(A).length;
    vnow += 15 * 60 * 1000 + 1000; room.tick(); wire.flush(); tick(2);
    const ends = [got(A, 'party_end', m => m.pid === pid), got(B, 'party_end', m => m.pid === pid)];
    line('6. fifteen minutes on the Room\'s clock: party_end reaches both games and their unlit crackers are gone',
      left > 0 && ends[0].length === 1 && ends[1].length === 1 && ids(A).length === 0 && ids(B).length === 0 && !A.PARTY.parties.has(pid) && !B.PARTY.parties.has(pid) && !room.store.liveParties(vnow).some(p => p.id === pid),
      { left, ends: ends.map(e => e.length), a: ids(A).length, b: ids(B).length });
    forget();
    A.FANGLANDS.tp(spot.x, spot.y); tick(20);
    run(A, 'PARTY.S.lastThrow = -1e9');   // the panel's own 5 s hold works on the wall clock; this run is faster than that
    A.PARTY.open(); click(A, 'party:tab:party|');
    const threw2 = click(A, 'party:throw|'); tick(6);
    const pid2 = (room.store.liveParties(vnow).slice(-1)[0] || {}).id;
    const n2 = { a: ids(A).length, b: ids(B).length };
    A.PARTY.open(); click(A, 'party:tab:party|');
    const armed = click(A, 'party:end|'); const ended = click(A, 'party:end|');
    tick(4);
    const ends2 = [got(A, 'party_end', m => m.pid === pid2), got(B, 'party_end', m => m.pid === pid2)];
    line('6. a new party, then End the party on MudGoll\'s panel (two taps): party_end reaches both games and the crackers are gone',
      threw2 && !!pid2 && pid2 !== pid && n2.a === 10 && n2.b === 10 && armed && ended && ends2[0].length === 1 && ends2[1].length === 1 && ids(A).length === 0 && ids(B).length === 0 && !room.store.liveParties(vnow).some(p => p.id === pid2),
      { threw2, pid2, before: n2, armed, ended, ends: ends2.map(e => e.length), after: [ids(A).length, ids(B).length] });
  }

  const bad = results.filter(r => !r).length;
  console.log((bad ? `${bad} FAILED of ${results.length}` : `ALL ${results.length} PASS`) + ` (${where}, ${frames} frames, ${Date.now() - t0} ms)`);
  process.exit(bad ? 1 : 0);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
