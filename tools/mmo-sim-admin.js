#!/usr/bin/env node
// tools/mmo-sim-admin.js — the admin scenarios of docs/ONLINE.md ("Admins and drop parties", Testing): two whole games
// in one Node process against the REAL Room (online/src/room.js, or MMO_ROOM=<path to a room.js>).
//
//   MMO_ROOM=/path/to/online/src/room.js node tools/mmo-sim-admin.js
//
// MudGoll (an admin in the Room's store) and Sam (a player) log in. What it proves, one PASS/FAIL line each:
//   1. roles ride welcome, the roster and presence, and Sam's screen draws MudGoll's ADMIN tag
//   2. MudGoll mutes Sam through the panel's buttons: Sam is told, sends nothing, a raw line is refused by the world, unmute works
//   3. a kick: error kicked, close 4005, no reconnect over 30 s, and Sam can come straight back by hand
//   4. a ban: error banned, close 4003, no reconnect, every new join refused (4003) until MudGoll unbans
//   5. nobody touches an admin: Ada (admin) -> admin, himself -> self, "Nobody" -> unknown, kicking Pip (offline) -> offline
//   6. MudGoll keeps the map and spawns 3 goblins beside Sam: Sam sees them, kills one (Sam's kill), it is gone 2 s later for good
//   7. Sam keeps the map: MudGoll's 2 wolves are made in Sam's game, MudGoll sees puppets, spawn_clear takes them from both
//   8. Sam (a player) sends every admin message: each is answered error admin, nothing changes, Sam is not dropped
// Exit 0 only when every line passes. The plumbing (the fake wire, the game contexts, the Room loader) is tools/mmo-sim.js's.
'use strict';
const vm = require('vm');
const { Wire, makeContext, loadRoom, FRAME_MS } = require('./mmo-sim.js');

// ---------------------------------------------------------------------------
// The wire is mmo-sim.js's: a close the world makes carries its code (4005 kicked, 4003 banned) to the page and arrives
// after whatever the world sent just before it, the way a real socket delivers them. (This file built that first, as
// CodeWire; it moved into the shared Wire, and the name stays for anything that required it.)
// ---------------------------------------------------------------------------
class CodeWire extends Wire { }

async function main() {
  const t0 = Date.now();
  // the world's clock in whole milliseconds, as Date.now() is on the real server (a spawn's sid is that time in base 36)
  let vnow = Date.now(); const now = () => Math.floor(vnow);
  const room = await loadRoom(now);
  if (!room.store || typeof room.store.addAccount !== 'function') { console.error('this room.js has no store with addAccount: point MMO_ROOM at the admin server build'); process.exit(1); }
  room.store.addAccount('MudGoll', 'admin'); room.store.addAccount('Sam'); room.store.addAccount('Ada', 'admin'); room.store.addAccount('Pip');
  const wire = new CodeWire(room);
  const A = makeContext(wire), B = makeContext(wire);   // A plays MudGoll, B plays Sam
  const both = [A, B];
  const ev = (g, code) => vm.runInContext(code, g);
  const results = [];
  const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '   ' + JSON.stringify(info) : '')); };
  for (const g of both) g.FANGLANDS.newGame();

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
  const heal = () => { for (const g of both) { const p = g.FANGLANDS.player; if (p.hp < 10) p.hp = p.maxHp; if (p.dead) { p.dead = false; p.hp = p.maxHp; } } };
  // what each game heard, by type
  const heard = { A: [], B: [] };
  A.NET.on('*', m => heard.A.push(m)); B.NET.on('*', m => heard.B.push(m));
  const got = (who, t, since) => heard[who].slice(since || 0).filter(m => m.t === t);
  // the admin's panel, driven by its buttons the way a finger does it
  const click = (g, key) => { g.render(); return g.FANGLANDS.clickButton(key); };
  const openSpot = (g, cx, cy) => ev(g, `(() => { for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = ${cx} + dx, y = ${cy} + dy; let ok = inMap(x - 3, y - 3) && inMap(x + 3, y + 3); for (let yy = y - 2; yy <= y + 2 && ok; yy++) for (let xx = x - 3; xx <= x + 5 && ok; xx++) if (tileAt(xx, yy) !== T.GRASS) ok = false; if (ok && !inVillageBounds(tc(x), tc(y))) return { x, y }; } return { x: ${cx}, y: ${cy} }; })()`);
  const isSpawn = m => typeof m.nid === 'string' && m.nid.charAt(0) === '!';

  // ---- log in ----
  const login = async (g, name) => { const r = await g.NET.post('/api/login', { name, pass: 'secret' }); g.NET.setToken(r.token); g.NET.connect(); wire.flush(); return r; };
  await login(A, 'MudGoll');
  await login(B, 'Sam');
  tick(12);

  // ---- 1. roles ----
  {
    const aRole = A.NET.role, bRole = B.NET.role;
    const roster = B.PLAYERS.online.find(o => o.n === 'MudGoll'), seen = B.PLAYERS.remote.MudGoll;
    const tagged = ev(B, `(() => {
      const rec = [], st = {};
      const g2 = new Proxy(st, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : k === 'fillText' ? (s => { rec.push({ text: String(s), fill: st.fillStyle }); }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in st ? st[k] : () => { }), set: (t, k, v) => { st[k] = v; return true; } });
      const items = []; for (const hk of HOOKS.draw) hk(g2, items, cam);
      const it = items.find(x => x.who === 'MudGoll'); if (!it) return 'not drawn';
      try { it.draw(); } catch (e) { return 'threw: ' + e.message; }
      return rec.some(t => t.text === 'ADMIN') && rec.some(t => t.text === 'MudGoll' && t.fill === '#f5c542') ? 'tagged' : 'no tag';
    })()`);
    line("roles: MudGoll's welcome says admin and Sam's says player; Sam's roster and presence show MudGoll as admin, and Sam's screen draws MudGoll's gold ADMIN tag", aRole === 'admin' && bRole === 'player' && !!roster && roster.role === 'admin' && !!seen && seen.role === 'admin' && tagged === 'tagged' && A.ADMIN.is() && !B.ADMIN.is(), { aRole, bRole, roster: roster && roster.role, presence: seen && seen.role, tagged });
  }

  // ---- 2. mute through the panel ----
  {
    const b0 = heard.B.length, a0 = heard.A.length;
    A.ADMIN.open('knights'); tick(2);
    const muteBtn = click(A, 'admin:mute:Sam'); const chooser = click(A, 'admin:span:5m'); tick(3);
    const muted = got('B', 'muted', b0).pop();
    const told = !!muted && muted.left === 300 && B.CHAT.muted() > 290 && B.CHAT.muted() <= 300;
    const aChats0 = got('A', 'chat', a0).length;
    const refusedHere = B.CHAT.send('hello?') === false; tick(3);
    const nothing = got('A', 'chat', a0).length === aChats0;
    const b1 = heard.B.length; B.NET.send({ t: 'chat', text: 'sneaky' }); tick(3);
    const refusedThere = got('A', 'chat', a0).length === aChats0 && got('B', 'muted', b1).length === 1;
    const list = A.ADMIN.modlist, listed = !!list && list.muted.some(o => o.n === 'Sam');
    tick(90);
    const unmuteBtn = click(A, 'admin:unmute:Sam'); tick(3);
    const unmuted = got('B', 'unmuted', b1).length === 1 && B.CHAT.muted() === 0;
    tick(120);
    const back = B.CHAT.send('back again'); tick(3);
    const heardBack = got('A', 'chat', a0).some(m => m.n === 'Sam' && m.text === 'back again');
    A.FANGLANDS.closePanel();
    line('mute: MudGoll mutes Sam for 5 minutes with the panel buttons; Sam hears muted left 300 and his line goes nowhere, a raw line is refused by the world (muted again), the modlist shows Sam; unmute and Sam talks again', muteBtn && chooser && told && refusedHere && nothing && refusedThere && listed && unmuteBtn && unmuted && back && heardBack, { muteBtn, chooser, muted, refusedHere, nothing, refusedThere, listed, unmuteBtn, unmuted, back, heardBack });
  }

  // ---- 3. kick ----
  {
    const b0 = heard.B.length, sock = B.NET.sock;
    A.ADMIN.open('knights'); tick(2);
    const first = click(A, 'admin:kick:Sam'); const still = B.NET.online(); const second = click(A, 'admin:kick:Sam'); wire.flush();
    const err = got('B', 'error', b0).find(m => m.code === 'kicked');
    const closed = !!sock && sock.readyState === 3 && sock.closeCode === 4005 && !B.NET.online();
    const opens0 = wire.made.length;
    tick(30 * 60, heal);
    const stayed = B.NET.timer === null && wire.made.length === opens0 && !B.NET.online() && !!B.NET.token;
    B.NET.connect(); wire.flush(); tick(3);
    const again = B.NET.online() && got('B', 'welcome', b0).length === 1;
    A.FANGLANDS.closePanel();
    line('kick: two taps on Kick; Sam gets error kicked and the socket closes 4005; his wire books no reconnect over 30 s of simulated time; he connects again by hand and is welcomed', first && still && second && !!err && closed && stayed && again, { first, still, second, err: !!err, code: sock && sock.closeCode, stayed, timer: B.NET.timer !== null, again });
  }

  // ---- 4. ban ----
  {
    const b0 = heard.B.length, sock = B.NET.sock;
    A.ADMIN.open('knights'); tick(2);
    click(A, 'admin:ban:Sam'); click(A, 'admin:ban:Sam'); wire.flush();
    const err = got('B', 'error', b0).find(m => m.code === 'banned');
    const closed = !!sock && sock.readyState === 3 && sock.closeCode === 4003 && !B.NET.online() && B.NET.token === null;
    tick(120, heal);
    const noRetry = B.NET.timer === null && !B.NET.online();
    // a new join while banned: the world refuses it with 4003
    const tries = [];
    for (let i = 0; i < 2; i++) { B.NET.setToken(wire.login('Sam')); B.NET.connect(); wire.flush(); const s = B.NET.sock || wire.made[wire.made.length - 1]; tick(3); tries.push({ online: B.NET.online(), code: wire.made[wire.made.length - 1].closeCode }); }
    const refused = tries.every(t => !t.online && t.code === 4003);
    tick(60);
    A.render(); const unbanBtn = click(A, 'admin:unban:Sam'); tick(3);
    B.NET.setToken(wire.login('Sam')); B.NET.connect(); wire.flush(); tick(3);
    const back = B.NET.online() && B.NET.me === 'Sam';
    A.FANGLANDS.closePanel();
    line('ban: two taps on Ban; Sam gets error banned and close 4003, his wire drops the session and books no reconnect; every new join is refused (4003) until MudGoll taps Unban, then Sam is welcomed', !!err && closed && noRetry && refused && unbanBtn && back, { err: !!err, code: sock && sock.closeCode, closed, noRetry, tries, unbanBtn, back });
  }

  // ---- 5. admins are untouchable ----
  {
    tick(240);
    const a0 = heard.A.length;
    A.ADMIN.mute('Ada', '5m'); A.ADMIN.mute('MudGoll', '1h'); A.ADMIN.mute('Nobody', '1d'); A.ADMIN.kick('Pip'); tick(3);
    const codes = got('A', 'mod', a0).map(m => m.code || (m.ok ? 'ok' : '?'));
    const words = got('A', 'mod', a0).map(m => A.ADMIN.modSentence(m));
    const adaFine = !(A.ADMIN.modlist && A.ADMIN.modlist.muted.some(o => o.n === 'Ada'));
    line('untouchable: muting Ada (an admin) answers admin, muting himself answers self, "Nobody" answers unknown, kicking Pip who is offline answers offline, in plain words', codes.join(',') === 'admin,self,unknown,offline' && adaFine, { codes, words, adaFine });
  }

  // ---- 6. spawn while MudGoll keeps the map ----
  {
    A.__peace = true; B.__peace = true; tick(120);
    const spot = openSpot(A, 60, 30);
    A.FANGLANDS.tp(spot.x, spot.y); B.FANGLANDS.tp(spot.x + 2, spot.y); A.FANGLANDS.face(spot.x + 2, spot.y); tick(12);
    const keeper = A.COOP.isKeeper() && B.COOP.keeper() === 'MudGoll';
    const kA0 = A.FANGLANDS.player.kills, kB0 = B.FANGLANDS.player.kills;
    const asked = A.ADMIN.spawn('goblin', 3); tick(12);
    const real = A.FANGLANDS.monsters.filter(m => isSpawn(m) && m.type === 'goblin' && !m.dead);
    const puppets = B.FANGLANDS.monsters.filter(m => isSpawn(m) && m.remote && m.type === 'goblin');
    const sid = real.length ? real[0].nid.slice(1).split('.')[0] : null;
    const made = real.length === 3 && puppets.length === 3 && real.every(m => Math.hypot(m.x - A.FANGLANDS.player.x, m.y - A.FANGLANDS.player.y) <= 3 * 48 + 1);
    // Sam fights '!sid.0'; the other two wait, stunned, well away; MudGoll stands three tiles off so Sam is nearest
    const target = A.FANGLANDS.monsters.find(m => m.nid === '!' + sid + '.0');
    if (!target) { line('spawn, MudGoll keeps the map: the keeper made the goblins it was asked for', false, { keeper, asked, real: real.length, puppets: puppets.length, spawnsHeard: got('A', 'spawn').length, keeperIs: A.COOP.keeper() }); console.log('stopped: nothing to fight'); process.exit(1); }
    for (const m of real) if (m !== target) { m.x = target.x + 10 * 48; m.stunT = 999; }
    // the world's own monsters near the spot sit this one out, so Sam's swings can only ever find the admin's goblin
    for (const m of A.FANGLANDS.monsters) if (!isSpawn(m) && !m.dead && Math.hypot(m.x - target.x, m.y - target.y) < 12 * 48) { m.dead = true; m.deadT = 9; m.respawnT = 1e9; }
    A.FANGLANDS.tp(spot.x + 5, spot.y + 3); target.hp = 5; tick(12);
    A.__peace = false; B.__peace = false;
    const standBy = () => { const p = B.COOP.find(target.nid); if (!p) return; const bp = B.FANGLANDS.player; bp.x = p.x - 40; bp.y = p.y; bp.facing = { x: 1, y: 0 }; };
    let swings = 0;
    while (!target.dead && swings < 120) { standBy(); B.FANGLANDS.press('Space'); swings++; wire.flush(); tick(30, heal); }
    const credit = target.dead && B.FANGLANDS.player.kills === kB0 + 1 && A.FANGLANDS.player.kills === kA0;
    A.__peace = true; B.__peace = true;
    tick(125, heal);
    const goneA = !A.FANGLANDS.monsters.some(m => m.nid === target.nid);
    const pb = B.FANGLANDS.monsters.find(m => m.nid === target.nid), downB = !pb || pb.dead;
    tick(300, heal);
    const goneB = !B.FANGLANDS.monsters.some(m => m.nid === target.nid);
    tick(600, heal);
    const never = !A.FANGLANDS.monsters.some(m => m.nid === target.nid) && !B.FANGLANDS.monsters.some(m => m.nid === target.nid);
    A.ADMIN.clearSpawns(); tick(300, heal);
    line("spawn, MudGoll keeps the map: 3 goblins made in his game beside Sam, Sam sees 3 '!' puppets, kills one and gets the kill (MudGoll does not); 2 s later it is gone from the keeper and down on Sam's side, then gone there too, and it never comes back", keeper && asked && made && credit && goneA && downB && goneB && never, { keeper, asked, real: real.length, puppets: puppets.length, sid, swings, credit, kills: [A.FANGLANDS.player.kills - kA0, B.FANGLANDS.player.kills - kB0], goneA, downB, goneB, never });
  }

  // ---- 7. spawn while Sam keeps the map ----
  {
    const into = A.INSTANCES.enter('spider_den'); tick(20);
    const out = A.INSTANCES.leave(); tick(20);
    const spot = openSpot(A, 64, 30); A.FANGLANDS.tp(spot.x, spot.y); B.FANGLANDS.tp(spot.x + 3, spot.y); tick(20);
    const samKeeps = B.COOP.isKeeper() && A.COOP.keeper() === 'Sam' && !A.COOP.isKeeper();
    const asked = A.ADMIN.spawn('wolf', 2); tick(12);
    const inSam = B.FANGLANDS.monsters.filter(m => isSpawn(m) && m.type === 'wolf' && !m.remote && !m.dead);
    const inMud = A.FANGLANDS.monsters.filter(m => isSpawn(m) && m.type === 'wolf' && m.remote);
    const made = inSam.length === 2 && inMud.length === 2 && inSam.every(m => inMud.some(p => p.nid === m.nid));
    const cleared = A.ADMIN.clearSpawns(); tick(6);
    const goneSam = !B.FANGLANDS.monsters.some(isSpawn);
    tick(240);
    const goneMud = !A.FANGLANDS.monsters.some(isSpawn);
    line("spawn, Sam keeps the map (MudGoll went into the Spider Den and back): MudGoll's 2 wolves are made in Sam's game and MudGoll sees them as puppets; Clear spawns takes them from both", into && out && samKeeps && asked && made && cleared && goneSam && goneMud, { into, out, samKeeps, keeper: A.COOP.keeper(), asked, inSam: inSam.length, inMud: inMud.length, goneSam, goneMud });
  }

  // ---- 8. a player's admin messages are refused ----
  {
    tick(120);
    const b0 = heard.B.length, a0 = heard.A.length;
    const p = B.FANGLANDS.player, tx = Math.floor(p.x / 48), ty = Math.floor(p.y / 48);
    const spots = [[tx + 2, ty], [tx - 2, ty], [tx, ty + 2], [tx, ty - 2], [tx + 3, ty + 1]];
    const msgs = [
      { t: 'mute', n: 'MudGoll', span: 'always' }, { t: 'unmute', n: 'MudGoll' }, { t: 'kick', n: 'MudGoll' }, { t: 'ban', n: 'MudGoll' }, { t: 'unban', n: 'Sam' }, { t: 'modlist' },
      { t: 'spawn', type: 'goblin', count: 5, x: Math.round(p.x), y: Math.round(p.y) }, { t: 'spawn_clear' },
      { t: 'party', x: Math.round(p.x), y: Math.round(p.y), spots, table: [{ id: 'coins', min: 1, max: 10, w: 1 }], hat: 1000 }, { t: 'party_end' },
    ];
    for (const m of msgs) B.NET.send(m);
    tick(20);
    const refusals = got('B', 'error', b0).filter(m => m.code === 'admin').length;
    const aFine = A.NET.online() && A.CHAT.muted() === 0 && got('A', 'muted', a0).length === 0 && got('A', 'error', a0).length === 0;
    const noSpawns = !A.FANGLANDS.monsters.some(isSpawn) && !B.FANGLANDS.monsters.some(isSpawn);
    const parties = typeof room.store.liveParties === 'function' ? room.store.liveParties(vnow) : [];
    const samOn = B.NET.online() && B.NET.me === 'Sam';
    line('a player is refused: Sam sends mute, unmute, kick, ban, unban, modlist, spawn, spawn_clear, party and party_end; each is answered error admin, MudGoll is not muted or kicked, nothing is spawned, no party exists, and Sam is not dropped for speed', refusals === msgs.length && aFine && noSpawns && parties.length === 0 && samOn, { refusals, of: msgs.length, aFine, noSpawns, parties: parties.length, samOn });
  }

  const bad = results.filter(r => !r).length;
  console.log((bad ? `${bad} FAILED of ${results.length}` : `ALL ${results.length} PASS`) + ` (${process.env.MMO_ROOM || 'online/src/room.js'}, ${frames} frames, ${Date.now() - t0} ms)`);
  process.exit(bad ? 1 : 0);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { CodeWire };
