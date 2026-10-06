#!/usr/bin/env node
// tools/mmo-sim.js — two whole game contexts in one Node process, wired to an in-memory world.
//
//   node tools/mmo-sim.js            the FakeWorld below routes messages by docs/ONLINE.md's rules
//   node tools/mmo-sim.js --room     online/src/room.js (the real routing class) does it instead (MMO_ROOM=path overrides the file)
//   node tools/mmo-sim.js --sim      the real Room with the world's own game copy wired in (docs/ONLINE.md, "The shared world",
//                                    Stage 2): every scenario below with every map on 'keeper' (nothing may change), then
//                                    Deepholm switched to 'world': both games are shown the copy's monsters and a hit reaches it
//
// What it proves, in order: two knights log in with fake tokens; the first one in is the keeper of the
// overworld; the second sees the first's presence (and her girl knight's look, 79-boygirl); standing by the same goblin, the second knight's hit
// reaches the keeper's monster, the keeper's hp shows on the puppet after the next snapshot, and the last
// hit gives the kill to the second knight and not the keeper; a goblin chases the second knight while the
// keeper stands far away; a chat line crosses; and when the keeper disconnects the other becomes keeper
// with no duplicate monsters.
// Then the admins and drop parties (docs/ONLINE.md, "Admins and drop parties"), with Ann an admin in the world's store
// and Ben a player: the roles on welcome, the roster, presence and the ADMIN tag, and the parent page turning a role on
// and off; Ann mutes Ben from her panel (his lines go nowhere, the mute holds over a reconnect, unmute); Ann kicks Ben
// (close 4005, no reconnect, back by hand); Ann spawns goblins that Ben sees, fights and gets the kill for, and that
// never come back; a drop party of 50 crackers where both knights light the SAME cracker in the SAME tick, 50 times:
// exactly one boom each time, the prize exactly the contract's roll from the world's dice, and it lands once, in the
// winner's game only; a party hat handed over with the ordinary gift; Ann bans Ben (close 4003, every join refused
// until she unbans), and so does the parent page (the store, then the world's kick by name); and Ben sending every admin
// message is refused with nothing changed.
// Then trading (docs/ONLINE.md, "Trading"), through the games' own buttons: Ann taps Ben and trades 5 bread for 20 coins,
// exactly once; Ben changes his offer after Ann accepted and nothing moves until both accept again; closing the window,
// walking away and a disconnect each end a trade with nothing moved.
// Exit 0 only when every line passes.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const FRAME_MS = 1000 / 60;

// ---------------------------------------------------------------------------
// The contract's numbers (docs/ONLINE.md), for the FakeWorld and for the scenarios' own checks.
// ---------------------------------------------------------------------------
const TILE_PX = 48;                                    // the game's tile; the world measures parties in it
const ALWAYS = 8640000000000000;                       // muted "until an admin unmutes"
const MUTE_MS = { '5m': 5 * 60 * 1000, '1h': 3600 * 1000, '1d': 24 * 3600 * 1000, always: ALWAYS };
const KICK_TEXT = 'An admin sent you out of the world. You can come back in.';
const HAT_COLOURS = ['red', 'yellow', 'blue', 'green', 'purple', 'white'];
const HAT_CHOICES = [10, 100, 1000, 10000];
const PARTY_LIFE = 15 * 60 * 1000, PRIZE_KEEP = 7 * 24 * 3600 * 1000;
const LIGHT_RANGE = 168, SPOT_RANGE = 11, MAX_LIVE_CRACKERS = 150;
const KEEPER_STALE = 4000, ROSTER_EVERY = 2000, GIFT_WAIT = 10000, MAX_KNIGHTS = 50;
const ID_RE = /^[a-z0-9_]{1,40}$/;
// [rate per second, burst] from the socket table and the admins' caps table; hello is allowed once
const CAPS = {
  hello: [0, 1], p: [8, 16], chat: [1 / 1.5, 2], mon: [8, 16], hit: [20, 40], gift: [1, 2],
  mute: [1, 3], unmute: [1, 3], kick: [1, 3], ban: [1, 3], unban: [1, 3], modlist: [1, 2], spawn: [1, 3], spawn_clear: [1, 2],
  party: [0.2, 2], party_end: [1, 2], light: [4, 8], claim: [10, 50],
  trade_ask: [0.5, 3], trade_answer: [2, 4], trade_offer: [5, 10], trade_accept: [4, 8], trade_confirm: [4, 8], trade_full: [2, 4], trade_close: [2, 4], trade_ack: [10, 50],
  boss_call: [0.5, 2], boss_wait: [1, 3], hand: [1, 3],
};
// Trading (docs/ONLINE.md, "Trading"): the ranges in px, the ask's life, an offer's limits, how long a finished trade is re-sent
const TRADE_NEAR = 5 * TILE_PX, TRADE_LEAVE = 8 * TILE_PX, TRADE_ASK_LIFE = 30000, TRADE_ITEMS = 12, TRADE_QTY_MAX = 1000000000, TRADE_KEEP = PRIZE_KEEP;
const lcOf = name => String(name == null ? '' : name).replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40);
const leftOf = (until, now) => until >= ALWAYS ? -1 : Math.max(0, Math.ceil((until - now) / 1000));
const commas = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const crackerOf = id => { if (typeof id !== 'string' || id.length > 30) return null; const m = /^p(\d+)\.(\d+)$/.exec(id); return m ? { pid: Number(m[1]), k: Number(m[2]) } : null; };
// The contract's roll, as docs/ONLINE.md writes it: the party hat first (then its colour), else a row by weight and a
// quantity even across min..max. The FakeWorld rolls with it; the scenarios recompute every prize with it from the
// world's own dice, so the real Room is held to the same words.
function contractRoll(table, hatOneIn, random) {
  if (random() * hatOneIn < 1) { const colour = HAT_COLOURS[Math.min(HAT_COLOURS.length - 1, Math.floor(random() * HAT_COLOURS.length))]; return { id: 'party_hat_' + colour, qty: 1, hat: colour }; }
  let total = 0; for (const row of table) total += row.w;
  let r = random() * total, pick = table[table.length - 1];
  for (const row of table) { r -= row.w; if (r < 0) { pick = row; break; } }
  return { id: pick.id, qty: pick.min + Math.floor(random() * (pick.max - pick.min + 1)) };
}
// the party's ground and prize table, checked the way the contract says the server checks them (null = refused)
function checkSpots(spots, ax, ay) {
  if (!Array.isArray(spots) || spots.length < 5 || spots.length > 50) return null;
  const seen = new Set(), out = [];
  for (const s of spots) {
    if (!Array.isArray(s) || s.length !== 2 || !isInt(s[0], 0, 1023) || !isInt(s[1], 0, 1023)) return null;
    if (Math.hypot(s[0] - ax, s[1] - ay) > SPOT_RANGE || seen.has(s[0] + ',' + s[1])) return null;
    seen.add(s[0] + ',' + s[1]); out.push([s[0], s[1]]);
  }
  return out;
}
function checkTable(table) {
  if (!Array.isArray(table) || table.length < 1 || table.length > 20) return null;
  const out = [];
  for (const row of table) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !ID_RE.test(row.id)) return null;
    if (!isInt(row.min, 1, 100000) || !isInt(row.max, row.min, 100000) || !isInt(row.w, 1, 1000)) return null;
    out.push({ id: row.id, min: row.min, max: row.max, w: row.w });
  }
  return out;
}

// ---------------------------------------------------------------------------
// FakeStore: the FakeWorld's accounts, mod log and parties. Its reading calls answer the way online/src/store.js's
// MemoryStore does (addAccount, account, modLog, liveParties, cracker, unclaimed), so a scenario reads either world's
// store with the same code.
// ---------------------------------------------------------------------------
class FakeStore {
  constructor() { this.accounts = new Map(); this.modRows = []; this.partyRows = new Map(); this.nextPid = 1; }
  addAccount(name, role = 'player') {
    const lc = lcOf(name); if (!lc) return;
    const r = role === 'admin' ? 'admin' : 'player', a = this.accounts.get(lc);
    if (a) a.role = r; else this.accounts.set(lc, { name: String(name).replace(/\s+/g, ' ').trim().slice(0, 40), lc, role: r, mutedUntil: 0, banned: false });
  }
  account(name) { const a = this.accounts.get(lcOf(name)); return a ? Object.assign({}, a) : null; }
  setRole(name, role) { const a = this.accounts.get(lcOf(name)); if (a) a.role = role === 'admin' ? 'admin' : 'player'; }
  setMute(name, until) { const a = this.accounts.get(lcOf(name)); if (a) a.mutedUntil = Math.max(0, Math.min(ALWAYS, Math.floor(until))); }
  setBanned(name, banned) { const a = this.accounts.get(lcOf(name)); if (a) a.banned = !!banned; }
  sorted() { return Array.from(this.accounts.values()).sort((a, b) => a.lc < b.lc ? -1 : a.lc > b.lc ? 1 : 0); }
  mutedList(now) { return this.sorted().filter(a => a.mutedUntil > now).map(a => ({ name: a.name, until: a.mutedUntil })); }
  bannedList() { return this.sorted().filter(a => a.banned).map(a => ({ name: a.name })); }
  log(row) { this.modRows.push({ at: row.at, by: String(row.by), act: String(row.act), target: String(row.target), detail: String(row.detail || '') }); }
  modLog(limit = 200) { return this.modRows.slice(-Math.max(0, limit)).reverse(); }
  addParty(p) {
    for (const [id, q] of this.partyRows) if (q.expires < p.at - PRIZE_KEEP) this.partyRows.delete(id);
    const id = this.nextPid++;
    this.partyRows.set(id, { id, at: p.at, by: p.by, map: p.map, region: p.region, hat: p.hat, table: p.table, expires: p.expires, ended: false,
      crackers: p.spots.map(([tx, ty], k) => ({ k, tx, ty, litBy: null, litAt: null, reward: null, claimed: false })) });
    return id;
  }
  open() { return Array.from(this.partyRows.values()).filter(p => !p.ended); }   // not ended, whether or not its time is up
  liveParties(now) {
    return this.open().filter(p => p.expires > now).map(p => ({ id: p.id, at: p.at, by: p.by, map: p.map, region: p.region, hat: p.hat, table: p.table, expires: p.expires,
      crackers: p.crackers.map(c => ({ k: c.k, tx: c.tx, ty: c.ty, litBy: c.litBy })) }));
  }
  cracker(pid, k) { const p = this.partyRows.get(pid); return p && p.crackers[k] ? Object.assign({}, p.crackers[k]) : null; }
  light(pid, k, lc, at, reward) { const p = this.partyRows.get(pid), c = p && p.crackers[k]; if (!c || c.litBy != null) return false; c.litBy = lc; c.litAt = at; c.reward = reward; return true; }
  endParty(pid) { const p = this.partyRows.get(pid); if (p) p.ended = true; }
  unclaimed(lc, since) {
    const out = [];
    for (const p of this.partyRows.values()) for (const c of p.crackers) if (c.litBy === lc && !c.claimed && c.litAt >= since) out.push({ id: 'p' + p.id + '.' + c.k, reward: c.reward, at: c.litAt, pid: p.id, k: c.k });
    return out.sort((a, b) => (a.at - b.at) || (a.pid - b.pid) || (a.k - b.k)).map(({ id, reward }) => ({ id, reward }));
  }
  claim(pid, k, lc) { const p = this.partyRows.get(pid), c = p && p.crackers[k]; if (!c || c.litBy !== lc) return false; c.claimed = true; return true; }
  // finished trades: one row each, with an ack per side (the store's addTrade / unackedTrades / ackTrade / tradeLog)
  addTrade(r) { this.trades = this.trades || []; const tid = this.trades.length + 1; this.trades.push({ tid, at: r.at, a: r.a, b: r.b, aGave: JSON.parse(JSON.stringify(r.aGave)), bGave: JSON.parse(JSON.stringify(r.bGave)), aAck: false, bAck: false }); return tid; }
  unackedTrades(lc, since) {
    return (this.trades || []).filter(r => r.at >= since && ((lcOf(r.a) === lc && !r.aAck) || (lcOf(r.b) === lc && !r.bAck)))
      .map(r => lcOf(r.a) === lc ? { tid: r.tid, with: r.b, gave: r.aGave, got: r.bGave } : { tid: r.tid, with: r.a, gave: r.bGave, got: r.aGave });
  }
  ackTrade(tid, lc) { const r = (this.trades || []).find(x => x.tid === tid); if (!r) return false; let hit = false; if (lcOf(r.a) === lc) { r.aAck = true; hit = true; } if (lcOf(r.b) === lc) { r.bAck = true; hit = true; } return hit; }
  tradeLog(limit = 200) { return (this.trades || []).slice(-limit).reverse().map(r => Object.assign({}, r)); }
}

// ---------------------------------------------------------------------------
// FakeWorld: docs/ONLINE.md's rules, written out again from the contract (not from room.js), so every scenario proves
// the games against the contract twice: here, and against the real Room (--room). Server-side sockets are
// { send(str), close(code) }.
//   The socket: one socket per knight (a new login sends the old one 'elsewhere' and closes it 4000); a banned knight is
//   refused at join ('banned', 4003). welcome on hello carries the keeper and the role; the roster (who, with roles) on
//   hello, leave and role changes, and at most every 2 s for anything else. Presence goes to the same map with the
//   server's role on it; a knight arriving on a map hears its keeper and sees whoever stands there. The keeper is the
//   knight longest on the map (then longest online, then by name); a keeper that streams nothing for 4 s while others
//   share its map goes to the back of the line. mon from the keeper to its map; hit to the keeper; kill and hurt from the
//   keeper to one knight on its map; gifts to one knight, answered or back after 10 s; chat to everyone, except from a
//   muted knight, who hears 'muted' instead and is not logged. Every type has its cap (over it: 'error bad', and a socket
//   that keeps going is dropped with 4008), and the cap runs before anything else.
//   Admins: the role is read from the store at hello and fresh for every admin message; anyone else is answered
//   'error admin' and nothing happens. mute / unmute / kick / ban / unban / modlist with the contract's answers; nobody
//   touches an admin, or themselves; spawn and spawn_clear go to the keeper of the admin's map with a new sid.
//   setRole(name), muteChanged(name), kick(name, code, text) and isOnline(name) are the World's calls (the parent page,
//   /api/me), answered as the Room answers them.
//   Drop parties: party with the server's checks (bad / where / busy), crackers to the map, the announcement to everyone;
//   light (gone / map / taken / far; the roll, then the fuse; the first light wins; a hat is announced; the last one lit
//   ends the party); claim (the lighter only); party_end; crackers after welcome and on arriving on a map; a prize after
//   welcome for every unclaimed one of the last 7 days; parties end when their 15 minutes are up.
//   Trading: an ask to a knight on your map within five tiles (self / offline / map / busy / dead / far / wait refused,
//   two asks to each other open it at once, 30 s to answer, trade_ask_off when an ask goes unanswered); both offers held
//   here, a change un-accepting both, accept then confirm of the same version, trade_done to both, a store row re-sent
//   after welcome until acked; closed / left / far / dead end it with nothing moved.
// ---------------------------------------------------------------------------
class FakeWorld {
  constructor({ now, log, store, random } = {}) {
    this.now = now || (() => Date.now()); this.log = log || (() => { });
    this.store = store || new FakeStore(); this.random = typeof random === 'function' ? random : Math.random;
    this.k = new Map();          // sock -> knight
    this.keepers = new Map();    // map -> knight
    this.gifts = new Map();      // gid -> { gid, from, to (lower case), id, qty, due }
    this.nextGid = 1; this.spawnSeq = 0; this.rosterAt = -Infinity; this.rosterDirty = false;
  }
  send(k, msg) { this.raw(k, JSON.stringify(msg)); }
  raw(k, str) { try { k.sock.send(str); } catch (e) { } }
  named(name) { const lc = lcOf(name); for (const k of this.k.values()) if (k.lc === lc) return k; return null; }
  onMap(map) { const out = []; for (const k of this.k.values()) if (k.hello && k.map === map) out.push(k); return out; }
  everyone(msg) { const out = JSON.stringify(msg); for (const k of this.k.values()) if (k.hello) this.raw(k, out); }

  // ---------- joining and leaving ----------
  join(sock, name) {
    if (this.k.has(sock)) return;
    const acc = this.store.account(name), bare = { sock };
    if (acc && acc.banned) { this.send(bare, { t: 'error', code: 'banned', text: 'this knight is banned' }); try { sock.close(4003, 'banned'); } catch (e) { } return; }
    const old = this.named(name);
    if (old) { this.send(old, { t: 'error', code: 'elsewhere', text: 'this knight logged in somewhere else' }); this.drop(old, 4000); }
    if (this.k.size >= MAX_KNIGHTS) { this.send(bare, { t: 'error', code: 'full', text: 'the world is full right now, try again in a bit' }); try { sock.close(4004, 'full'); } catch (e) { } return; }
    const now = this.now();
    this.k.set(sock, { sock, name: String(name), lc: lcOf(name), since: now, hello: false, map: null, mapAt: now, region: '', lv: 0, role: 'player', x: null, y: null, last: null, buckets: {}, strikes: 0, strikeAt: 0, monAt: 0, keeperAt: 0, dead: false, trade: null, ask: null });
  }
  leave(sock) { const k = this.k.get(sock); if (k) this.remove(k); }
  remove(k) {
    if (this.k.get(k.sock) !== k) return;
    this.k.delete(k.sock);
    if (k.trade) this.tradeEnd(k.trade, 'left', k);
    this.unask(k, false);
    for (const o of this.k.values()) if (o.ask && o.ask.to === k.lc) { o.ask = null; this.send(o, { t: 'trade_no', code: 'offline', n: k.name }); }
    if (k.hello && k.map) this.leaveMap(k);
    for (const g of Array.from(this.gifts.values())) { if (g.to === k.lc) this.settle(g, 'gift_back'); else if (g.from === k.lc) this.gifts.delete(g.gid); }
    if (k.hello) this.who();
  }
  drop(k, code) { this.remove(k); try { k.sock.close(code); } catch (e) { } }
  // out of the world: the error first so the screen can say why, then the close (4005 kicked, 4003 banned, else 4000)
  sendOff(k, code, text) { this.send(k, { t: 'error', code, text }); this.drop(k, code === 'kicked' ? 4005 : code === 'banned' ? 4003 : 4000); }
  // the World's calls from the parent page, by name, as the Room answers them
  kick(name, code, text) { const k = this.named(name); if (!k) return false; this.sendOff(k, code, text); return true; }
  isOnline(name) { const k = this.named(name); return !!(k && k.hello); }

  // ---------- maps and keepers ----------
  elect(map, except) {
    const here = this.onMap(map), cur = this.keepers.get(map) || null, now = this.now();
    if (!here.length) { this.keepers.delete(map); return null; }
    const stale = o => o === cur && here.length > 1 && now - Math.max(o.monAt || 0, o.keeperAt || 0) > KEEPER_STALE;
    const first = (a, b) => (stale(a) - stale(b)) || (a.mapAt - b.mapAt) || (a.since - b.since) || (a.lc < b.lc ? -1 : a.lc > b.lc ? 1 : 0);
    const best = here.slice().sort(first)[0];
    if (best === cur) return best;
    if (cur && here.includes(cur) && stale(cur)) cur.mapAt = now;   // the quiet keeper goes to the back of the line
    this.keepers.set(map, best); best.keeperAt = now;
    for (const o of here) if (o !== except) this.send(o, { t: 'keeper', map, n: best.name });
    return best;
  }
  enter(k, map, quiet) {
    k.map = map; k.mapAt = this.now();
    this.elect(map, quiet ? k : null);
    if (!quiet) { const kp = this.keepers.get(map); this.send(k, { t: 'keeper', map, n: kp ? kp.name : null }); }
    for (const o of this.onMap(map)) if (o !== k && o.last) this.raw(k, o.last);   // whoever stands here shows up at once
  }
  leaveMap(k) {
    const map = k.map; k.map = null;
    const out = JSON.stringify({ t: 'left', n: k.name, map });
    for (const o of this.onMap(map)) this.raw(o, out);
    this.elect(map, null);
  }
  who() {
    this.rosterAt = this.now(); this.rosterDirty = false;
    const list = []; for (const k of this.k.values()) if (k.hello) list.push({ n: k.name, map: k.map, region: k.region, lv: k.lv, role: k.role });
    this.everyone({ t: 'who', list });
  }

  // ---------- messages ----------
  message(sock, str) {
    const k = this.k.get(sock);
    if (!k || typeof str !== 'string') return;
    if (str.length > 64 * 1024) return this.strike(k, CAPS.p[1]);
    let m = null; try { m = JSON.parse(str); } catch (e) { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    const cap = CAPS[m.t];
    if (cap && !this.allow(k, m.t, cap)) return;
    const t = m.t;
    if (t === 'hello') return this.hello(k, m);
    if (t === 'ping') return this.send(k, { t: 'pong' });
    if (!k.hello) return;
    if (t === 'p') return this.presence(k, m, str);
    if (t === 'chat') return this.chat(k, m);
    if (t === 'mon') return this.mon(k, m);
    if (t === 'hit') return this.hit(k, m);
    if (t === 'boss_call') return this.bossCall(k, m);
    if (t === 'boss_wait') return this.toKnight(k, m, ['id', 'left']);
    if (t === 'hand') return this.hand(k, m);
    if (t === 'kill') return this.toKnight(k, m, ['nid', 'type', 'x', 'y']);
    if (t === 'hurt') return this.toKnight(k, m, ['dmg', 'x', 'y']);
    if (t === 'gift') return this.gift(k, m);
    if (t === 'gift_ok' || t === 'gift_no') { const g = this.gifts.get(m.gid); if (g && g.to === k.lc) this.settle(g, t === 'gift_ok' ? 'gift_ok' : 'gift_back'); return; }
    if (t === 'mute' || t === 'unmute' || t === 'kick' || t === 'ban' || t === 'unban') return this.mod(k, m);
    if (t === 'modlist') { if (this.asAdmin(k)) this.modlist(k); return; }
    if (t === 'spawn') return this.spawn(k, m);
    if (t === 'spawn_clear') { if (!this.asAdmin(k)) return; const kp = this.keepers.get(k.map); if (kp) this.send(kp, { t: 'spawn_clear', by: k.name }); return; }
    if (t === 'party') return this.party(k, m);
    if (t === 'party_end') { if (!this.asAdmin(k)) return; for (const p of this.store.open()) if (p.map === k.map) this.endParty(p); return; }
    if (t === 'light') return this.light(k, m);
    if (t === 'claim') { const c = crackerOf(m.id); if (c) this.store.claim(c.pid, c.k, k.lc); return; }
    if (t === 'trade_ask') return this.tradeAsk(k, m);
    if (t === 'trade_answer') return this.tradeAnswer(k, m);
    if (t === 'trade_offer' || t === 'trade_accept' || t === 'trade_confirm' || t === 'trade_full') return this.tradeStep(k, m);
    if (t === 'trade_close') { if (k.trade && m.id === k.trade.id) this.tradeEnd(k.trade, 'closed', k); return; }
    if (t === 'trade_ack') { if (Number.isInteger(m.tid)) this.store.ackTrade(m.tid, k.lc); return; }
  }
  hello(k, m) {
    k.hello = true;
    const acc = this.store.account(k.name); k.role = acc ? acc.role : 'player';
    this.enter(k, typeof m.map === 'string' && m.map ? m.map.slice(0, 64) : 'over', true);
    const kp = this.keepers.get(k.map);
    this.send(k, { t: 'welcome', me: k.name, at: this.now(), keeper: kp ? kp.name : null, role: k.role });
    this.who();
    // then, in this order: a mute still running, the crackers on this map, every prize never claimed
    const now = this.now();
    if (acc && acc.mutedUntil > now) this.send(k, { t: 'muted', left: leftOf(acc.mutedUntil, now) });
    this.crackersTo(k);
    for (const w of this.store.unclaimed(k.lc, now - PRIZE_KEEP)) this.send(k, { t: 'prize', id: w.id, reward: w.reward });
    for (const r of this.store.unackedTrades(k.lc, now - TRADE_KEEP)) this.send(k, { t: 'trade_done', tid: r.tid, id: null, with: r.with, gave: r.gave, got: r.got });
  }
  presence(k, m, str) {
    if (str.length > 4096) return this.strike(k, CAPS.p[1]);
    const map = typeof m.map === 'string' && m.map ? m.map.slice(0, 64) : k.map;
    if (map !== k.map) { if (k.trade) this.tradeEnd(k.trade, 'left', k); this.leaveMap(k); this.enter(k, map, false); this.crackersTo(k); this.rosterDirty = true; }
    if (typeof m.region === 'string' && m.region.slice(0, 40) !== k.region) { k.region = m.region.slice(0, 40); this.rosterDirty = true; }
    if (typeof m.lv === 'number' && m.lv !== k.lv) { k.lv = m.lv; this.rosterDirty = true; }
    if (Number.isFinite(m.x) && Number.isFinite(m.y)) { k.x = m.x; k.y = m.y; }
    k.dead = !!m.dead;
    if (k.trade) { const o = k.trade.a === k ? k.trade.b : k.trade.a; if (k.dead) this.tradeEnd(k.trade, 'dead', k); else if (!this.near(k, o, TRADE_LEAVE, true)) this.tradeEnd(k.trade, 'far', k); }
    const out = JSON.stringify(Object.assign({}, m, { t: 'p', n: k.name, map: k.map, role: k.role }));   // the server's role, always
    k.last = out;
    for (const o of this.onMap(k.map)) if (o !== k) this.raw(o, out);
  }
  chat(k, m) {
    const acc = this.store.account(k.name), now = this.now();
    if (acc && acc.mutedUntil > now) return this.send(k, { t: 'muted', left: leftOf(acc.mutedUntil, now) });
    if (acc) this.syncRole(k, acc.role);
    const text = String(typeof m.text === 'string' ? m.text : '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!text) return;
    this.log(k.name, text, now);
    this.everyone({ t: 'chat', n: k.name, text, at: now, role: k.role });
  }
  mon(k, m) {
    if (!Array.isArray(m.list) || this.keepers.get(k.map) !== k) return;   // a late snapshot after a handoff is dropped
    k.monAt = this.now();
    const out = JSON.stringify({ t: 'mon', n: k.name, list: m.list });
    for (const o of this.onMap(k.map)) if (o !== k) this.raw(o, out);
  }
  hit(k, m) {
    const kp = this.keepers.get(k.map);
    if (!kp || kp === k || typeof m.nid !== 'string') return;
    this.send(kp, { t: 'hit', n: k.name, nid: m.nid, dmg: m.dmg, knock: m.knock, bomb: m.bomb });
  }
  // a named boss: from a knight to the keeper of its map, with the knight's name (docs/ONLINE.md, "Named bosses")
  bossCall(k, m) {
    const kp = this.keepers.get(k.map);
    if (!kp || kp === k || typeof m.id !== 'string' || !/^[a-z_]{1,24}$/.test(m.id)) return;
    const out = { t: 'boss_call', n: k.name, id: m.id }; if (m.first === true) out.first = true;
    this.send(kp, out);
  }
  // the game that kept the map until a moment ago hands the keeper what it knew of each named boss: [nid, hp, {name: [n, age]}]
  hand(k, m) {
    const kp = this.keepers.get(k.map);
    if (!kp || kp === k || !Array.isArray(m.list)) return;
    const list = [];
    for (const e of m.list.slice(0, 8)) {
      if (!Array.isArray(e) || typeof e[0] !== 'string' || !e[0] || e[0].length > 64 || !inRange(e[1], 0, 1e7)) continue;
      const hs = {}, from = e[2] && typeof e[2] === 'object' && !Array.isArray(e[2]) ? e[2] : {};
      for (const name of Object.keys(from).slice(0, 8)) { const v = from[name]; if (name && name.length <= 24 && !(name in Object.prototype) && Array.isArray(v) && isInt(v[0], 1, 10000) && inRange(v[1], 0, 60)) hs[name] = [v[0], v[1]]; }
      list.push([e[0], e[1], hs]);
    }
    if (list.length) this.send(kp, { t: 'hand', n: k.name, list });
  }
  toKnight(k, m, fields) {
    if (this.keepers.get(k.map) !== k) return;
    const to = this.named(m.to || '');
    if (!to || !to.hello || to === k || to.map !== k.map) return;
    const out = { t: m.t }; for (const f of fields) out[f] = m[f];
    this.send(to, out);
  }
  gift(k, m) {
    const id = typeof m.id === 'string' && m.id ? m.id.slice(0, 40) : null;
    const qty = Number.isInteger(m.qty) && m.qty > 0 ? Math.min(m.qty, 1000000) : 1;
    if (!id) return;
    const gid = this.nextGid++, to = this.named(m.to || '');
    if (!to || !to.hello || to === k) return this.send(k, { t: 'gift_back', gid, id, qty });
    this.gifts.set(gid, { gid, from: k.lc, to: to.lc, id, qty, due: this.now() + GIFT_WAIT });
    this.send(to, { t: 'gift', gid, from: k.name, id, qty });
  }
  settle(g, outcome) { this.gifts.delete(g.gid); const from = this.named(g.from); if (from) this.send(from, { t: outcome, gid: g.gid, id: g.id, qty: g.qty }); }

  // ---------- roles and moderation ----------
  syncRole(k, role) { if (k.role === role) return; k.role = role; if (k.hello) { this.send(k, { t: 'role', role }); this.who(); } }
  asAdmin(k) {
    const acc = this.store.account(k.name), role = acc ? acc.role : 'player';
    this.syncRole(k, role);
    if (role === 'admin') return acc;
    this.send(k, { t: 'error', code: 'admin', text: 'only an admin can do that' });
    return null;
  }
  setRole(name) { const acc = this.store.account(name), k = this.named(name); if (!k) return; k.role = acc ? acc.role : 'player'; if (k.hello) { this.send(k, { t: 'role', role: k.role }); this.who(); } }
  muteChanged(name) {
    const acc = this.store.account(name), k = acc && this.named(acc.lc); if (!k || !k.hello) return;
    const now = this.now();
    this.send(k, acc.mutedUntil > now ? { t: 'muted', left: leftOf(acc.mutedUntil, now) } : { t: 'unmuted' });
  }
  mod(k, m) {
    const admin = this.asAdmin(k); if (!admin) return;
    const act = m.t, now = this.now(), raw = typeof m.n === 'string' ? m.n : '', asked = raw.replace(/\s+/g, ' ').trim().slice(0, 40);
    const no = (code, n) => this.send(k, { t: 'mod', ok: false, act, n: n || asked, code });
    if (!asked || raw.length > 40) return no('bad');
    if (act === 'mute' && !Object.prototype.hasOwnProperty.call(MUTE_MS, m.span)) return no('bad');
    const target = this.store.account(asked);
    if (!target) return no('unknown');
    if (target.lc === admin.lc) return no('self', target.name);
    if (target.role === 'admin') return no('admin', target.name);
    const there = this.named(target.lc);
    if (act === 'kick' && !there) return no('offline', target.name);
    const answer = { t: 'mod', ok: true, act, n: target.name };
    let detail = '';
    if (act === 'mute') {
      const until = m.span === 'always' ? ALWAYS : now + MUTE_MS[m.span];
      this.store.setMute(target.lc, until); answer.left = leftOf(until, now); detail = m.span;
      if (there && there.hello) this.send(there, { t: 'muted', left: answer.left });
    } else if (act === 'unmute') { this.store.setMute(target.lc, 0); if (there && there.hello) this.send(there, { t: 'unmuted' }); }
    else if (act === 'kick') this.sendOff(there, 'kicked', KICK_TEXT);
    else if (act === 'ban') { this.store.setBanned(target.lc, true); if (there) this.sendOff(there, 'banned', 'this knight is banned'); }
    else this.store.setBanned(target.lc, false);
    this.store.log({ at: now, by: admin.name, act, target: target.name, detail });
    this.send(k, answer);
    this.modlist(k);
  }
  modlist(k) {
    const now = this.now(), byN = (a, b) => { const x = a.n.toLowerCase(), y = b.n.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; };
    this.send(k, { t: 'modlist', muted: this.store.mutedList(now).map(r => ({ n: r.name, left: leftOf(r.until, now) })).sort(byN), banned: this.store.bannedList().map(r => ({ n: r.name })).sort(byN) });
  }
  spawn(k, m) {
    if (!this.asAdmin(k)) return;
    const { type, count, x, y } = m;
    if (typeof type !== 'string' || !ID_RE.test(type) || !isInt(count, 1, 20) || !inRange(x, 0, 100000) || !inRange(y, 0, 100000)) return this.send(k, { t: 'error', code: 'bad', text: 'that spawn did not pass the checks' });
    const kp = this.keepers.get(k.map); if (!kp) return;
    this.send(kp, { t: 'spawn', by: k.name, type, count, x, y, sid: Math.floor(this.now()).toString(36) + (this.spawnSeq++).toString(36) });
  }

  // ---------- drop parties ----------
  posOf(k, m) { if (k.x != null && k.y != null) return { x: k.x, y: k.y }; if (m && Number.isFinite(m.x) && Number.isFinite(m.y)) return { x: m.x, y: m.y }; return null; }
  live() { this.expire(); return this.store.open(); }
  crackersMsg(p) {
    const list = []; for (const c of p.crackers) if (!c.litBy) list.push(['p' + p.id + '.' + c.k, c.tx, c.ty]);
    return JSON.stringify({ t: 'crackers', pid: p.id, map: p.map, by: p.by, list, left: Math.max(0, p.expires - this.now()) });
  }
  crackersTo(k) { for (const p of this.live()) if (p.map === k.map) this.raw(k, this.crackersMsg(p)); }
  endParty(p) {
    if (p.ended) return;
    this.store.endParty(p.id);
    const out = JSON.stringify({ t: 'party_end', pid: p.id, map: p.map });
    for (const o of this.onMap(p.map)) this.raw(o, out);
  }
  expire() { const now = this.now(); for (const p of this.store.open()) if (p.expires <= now) this.endParty(p); }
  party(k, m) {
    if (!this.asAdmin(k)) return;
    const no = code => this.send(k, { t: 'party_no', code });
    if (!HAT_CHOICES.includes(m.hat)) return no('bad');
    const pos = this.posOf(k, m);
    if (!pos) return no('where');
    const spots = checkSpots(m.spots, Math.floor(pos.x / TILE_PX), Math.floor(pos.y / TILE_PX)), table = checkTable(m.table);
    if (!spots || !table) return no('bad');
    let unlit = 0; for (const p of this.live()) if (p.map === k.map) for (const c of p.crackers) if (!c.litBy) unlit++;
    if (unlit + spots.length > MAX_LIVE_CRACKERS) return no('busy');
    const now = this.now(), region = k.region || '';
    const pid = this.store.addParty({ at: now, by: k.name, map: k.map, region, hat: m.hat, table, spots, expires: now + PARTY_LIFE });
    const out = this.crackersMsg(this.store.partyRows.get(pid));
    for (const o of this.onMap(k.map)) this.raw(o, out);
    this.everyone({ t: 'announce', kind: 'party', n: k.name, region, map: k.map, count: spots.length });
    this.store.log({ at: now, by: k.name, act: 'party', target: k.map, detail: spots.length + ' crackers in ' + (region || k.map) + ', party hats 1 in ' + commas(m.hat) });
  }
  light(k, m) {
    const c = crackerOf(m.id); if (!c) return;
    if ((m.x != null && !Number.isFinite(m.x)) || (m.y != null && !Number.isFinite(m.y))) return;
    const id = 'p' + c.pid + '.' + c.k, no = code => this.send(k, { t: 'light_no', id, code });
    const p = this.live().find(q => q.id === c.pid), cr = p ? p.crackers[c.k] : null;
    if (!cr) return no('gone');
    if (k.map !== p.map) return no('map');
    if (cr.litBy) return no('taken');
    const pos = this.posOf(k, m);
    if (!pos || Math.hypot(pos.x - (cr.tx * TILE_PX + TILE_PX / 2), pos.y - (cr.ty * TILE_PX + TILE_PX / 2)) > LIGHT_RANGE) return no('far');
    const now = this.now(), reward = contractRoll(p.table, p.hat, this.random);
    if (!this.store.light(p.id, cr.k, k.lc, now, reward)) no('taken');
    else {
      const fuse = 1000 + Math.floor(this.random() * 1501);
      const out = JSON.stringify({ t: 'boom', id, n: k.name, fuse, reward });
      for (const o of this.onMap(p.map)) this.raw(o, out);
      if (reward.hat) { this.everyone({ t: 'announce', kind: 'hat', n: k.name, colour: reward.hat }); this.store.log({ at: now, by: p.by, act: 'hat', target: k.name, detail: reward.hat }); }
    }
    if (!p.crackers.some(x => !x.litBy)) this.endParty(p);   // the last one lit ends the party
  }

  // ---------- trading ----------
  near(a, b, r, unknownOk) { if (a.x == null || b.x == null) return !!unknownOk; return Math.hypot(a.x - b.x, a.y - b.y) <= r; }
  unask(k, timedOut) {
    if (!k.ask) return; const to = this.named(k.ask.to); k.ask = null;
    if (to && to.hello) this.send(to, { t: 'trade_ask_off', from: k.name });
    if (timedOut) this.send(k, { t: 'trade_no', code: 'timeout', n: to ? to.name : '' });
  }
  cannot(k, o) {
    if (!o || !o.hello) return ['offline', null];
    if (o === k) return ['self', k];
    if (o.map !== k.map) return ['map', o];
    if (k.trade) return ['busy', k];
    if (o.trade) return ['busy', o];
    if (k.dead) return ['dead', k];
    if (o.dead) return ['dead', o];
    if (!this.near(k, o, TRADE_NEAR)) return ['far', o];
    return null;
  }
  tradeAsk(k, m) {
    const name = typeof m.to === 'string' ? m.to.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    const o = name ? this.named(name) : null, now = this.now();
    if (!name) return this.send(k, { t: 'trade_no', code: 'bad', n: '' });
    const why = this.cannot(k, o);
    if (why) return this.send(k, { t: 'trade_no', code: why[0], n: why[1] ? why[1].name : name });
    if (o.ask && o.ask.to === k.lc && o.ask.due > now) { o.ask = null; this.unask(k, false); return this.tradeOpen(o, k); }
    if (k.ask && k.ask.to === o.lc && k.ask.due > now) return this.send(k, { t: 'trade_no', code: 'wait', n: o.name });
    this.unask(k, false);
    k.ask = { to: o.lc, due: now + TRADE_ASK_LIFE };
    this.send(o, { t: 'trade_ask', from: k.name, role: k.role });
    this.send(k, { t: 'trade_asked', to: o.name });
  }
  tradeAnswer(k, m) {
    const from = typeof m.from === 'string' ? this.named(m.from) : null;
    if (!from || !from.ask || from.ask.to !== k.lc || from.ask.due <= this.now()) return this.send(k, { t: 'trade_no', code: 'gone', n: from ? from.name : String(m.from || '').slice(0, 40) });
    from.ask = null;
    if (m.yes !== true) return this.send(from, { t: 'trade_no', code: 'declined', n: k.name });
    const why = this.cannot(from, k);
    if (why) { const out = { t: 'trade_no', code: why[0], n: why[1] ? why[1].name : k.name }; this.send(from, out); this.send(k, out); return; }
    this.tradeOpen(from, k);
  }
  tradeOpen(a, b) {
    this.unask(a, false); this.unask(b, false);
    this.nextTrade = (this.nextTrade || 0) + 1;
    const tr = { id: this.nextTrade, a, b, offers: new Map([[a, []], [b, []]]), acc: new Set(), conf: new Set(), stage: 'offer', ver: 1 };
    a.trade = tr; b.trade = tr;
    this.send(a, { t: 'trade_open', id: tr.id, with: b.name, ver: 1 }); this.send(b, { t: 'trade_open', id: tr.id, with: a.name, ver: 1 });
    this.tradeTell(tr);
  }
  tradeTell(tr, only) {
    for (const k of only ? [only] : [tr.a, tr.b]) {
      const o = k === tr.a ? tr.b : tr.a;
      this.send(k, { t: 'trade_state', id: tr.id, ver: tr.ver, stage: tr.stage, mine: tr.offers.get(k), theirs: tr.offers.get(o), acc: [tr.acc.has(k), tr.acc.has(o)], conf: [tr.conf.has(k), tr.conf.has(o)] });
    }
  }
  tradeEnd(tr, code, who) {
    if (tr.a.trade !== tr && tr.b.trade !== tr) return;
    tr.a.trade = null; tr.b.trade = null;
    for (const k of [tr.a, tr.b]) if (this.k.get(k.sock) === k) this.send(k, { t: 'trade_end', id: tr.id, code, n: who.name });
  }
  tradeStep(k, m) {
    const tr = k.trade;
    if (!tr || m.id !== tr.id) { if (Number.isInteger(m.id)) this.send(k, { t: 'trade_end', id: m.id, code: 'gone', n: k.name }); return; }
    const reset = () => { tr.stage = 'offer'; tr.acc.clear(); tr.conf.clear(); };
    if (m.t === 'trade_offer') {
      const list = m.items, seen = new Set(), clean = [];
      const ok = Array.isArray(list) && list.length <= TRADE_ITEMS && list.every(it => { if (!it || typeof it.id !== 'string' || !ID_RE.test(it.id) || seen.has(it.id) || !isInt(it.qty, 1, TRADE_QTY_MAX)) return false; seen.add(it.id); clean.push({ id: it.id, qty: it.qty }); return true; });
      if (!ok) return this.tradeTell(tr, k);
      if (JSON.stringify(clean) === JSON.stringify(tr.offers.get(k))) return;
      tr.offers.set(k, clean); tr.ver++; reset(); return this.tradeTell(tr);
    }
    if (m.t === 'trade_full') {
      reset(); this.tradeTell(tr);
      const out = { t: 'trade_note', id: tr.id, code: m.why === 'new' ? 'new' : 'full', n: k.name };
      this.send(tr.a, out); this.send(tr.b, out); return;
    }
    const empty = !tr.offers.get(tr.a).length && !tr.offers.get(tr.b).length;
    if (m.t === 'trade_accept') {
      if (tr.stage !== 'offer' || m.ver !== tr.ver || empty) return this.tradeTell(tr, k);
      tr.acc.add(k); if (tr.acc.size === 2) { tr.stage = 'confirm'; tr.conf.clear(); }
      return this.tradeTell(tr);
    }
    if (tr.stage !== 'confirm' || m.ver !== tr.ver) return this.tradeTell(tr, k);
    tr.conf.add(k);
    if (tr.conf.size < 2) return this.tradeTell(tr);
    const { a, b } = tr;
    if (a.map !== b.map) return this.tradeEnd(tr, 'left', b);
    if (a.dead || b.dead) return this.tradeEnd(tr, 'dead', a.dead ? a : b);
    if (!this.near(a, b, TRADE_LEAVE, true)) return this.tradeEnd(tr, 'far', b);
    a.trade = null; b.trade = null;
    const ga = tr.offers.get(a), gb = tr.offers.get(b);
    const tid = this.store.addTrade({ at: this.now(), a: a.name, b: b.name, aGave: ga, bGave: gb });
    this.send(a, { t: 'trade_done', tid, id: tr.id, with: b.name, gave: ga, got: gb });
    this.send(b, { t: 'trade_done', tid, id: tr.id, with: a.name, gave: gb, got: ga });
  }

  // ---------- caps and timers ----------
  allow(k, t, [rate, burst]) {
    const now = this.now(); let b = k.buckets[t];
    if (!b) b = k.buckets[t] = { tokens: burst, at: now };
    b.tokens = Math.min(burst, b.tokens + Math.max(0, now - b.at) / 1000 * rate); b.at = now;
    if (b.tokens >= 1) { b.tokens -= 1; return true; }
    this.strike(k, burst); return false;
  }
  strike(k, burst) {
    const now = this.now();
    if (now - k.strikeAt > 10000) k.strikes = 0;
    k.strikeAt = now; k.strikes++;
    if (k.strikes === 1) this.send(k, { t: 'error', code: 'bad', text: 'too fast: slow down or you will be dropped' });
    else if (k.strikes > burst * 3) this.drop(k, 4008);
  }
  tick() {
    const now = this.now();
    this.expire();
    for (const g of Array.from(this.gifts.values())) if (g.due <= now) this.settle(g, 'gift_back');
    for (const k of Array.from(this.k.values())) if (k.ask && k.ask.due <= now) this.unask(k, true);
    if (this.rosterDirty && now - this.rosterAt >= ROSTER_EVERY) this.who();
    for (const map of Array.from(this.keepers.keys())) this.elect(map, null);   // a quiet keeper steps down
  }
  online() { const list = []; for (const k of this.k.values()) if (k.hello) list.push({ n: k.name, map: k.map, region: k.region, lv: k.lv, since: k.since, role: k.role }); return list; }
}

// ---------------------------------------------------------------------------
// The wire: fake WebSocket + fake fetch for a context, an inbox and an outbox the sim pumps between frames,
// so every message crosses "the network" at a frame boundary and never inside somebody's update().
// A close the world makes carries its code (4005 kicked, 4003 banned, 4000 elsewhere) to the page and arrives after
// whatever the world sent just before it, the way a real socket delivers them. `made` lists every socket opened.
// ---------------------------------------------------------------------------
class Wire {
  constructor(room) { this.room = room; this.accounts = new Map(); this.opening = []; this.inbound = []; this.outbound = []; this.closing = []; this.srvOf = new Map(); this.made = []; }
  login(name) { const token = 'tok-' + name.toLowerCase().replace(/[^a-z0-9]/g, ''); this.accounts.set(token, name); return token; }
  socketClass() {
    const wire = this;
    return class FakeWebSocket {
      constructor(url) { this.url = String(url); this.readyState = 0; this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null; this.closeCode = null; wire.opening.push(this); wire.made.push(this); }
      send(str) { if (this.readyState !== 1) throw new Error('socket not open'); wire.inbound.push({ client: this, str: String(str) }); }
      close(code) { if (this.readyState === 3) return; this.readyState = 3; if (this.closeCode === null) this.closeCode = typeof code === 'number' ? code : 1000; wire.closing.push(this); }
    };
  }
  fetch() {
    const wire = this;
    const ok = data => ({ ok: true, status: 200, json: async () => data });
    const bad = (status, error, code) => ({ ok: false, status, json: async () => ({ error, code }) });
    return async (url, opts = {}) => {
      const p = String(url).replace(/^https?:\/\/[^/]+/, '');
      let body = null; try { body = opts.body ? JSON.parse(opts.body) : null; } catch (e) { }
      const auth = ((opts.headers && opts.headers.authorization) || '').replace(/^Bearer /, '');
      if (p === '/api/login' || p === '/api/signup') { if (!body || typeof body.name !== 'string' || typeof body.pass !== 'string' || body.pass.length < 4) return bad(400, 'bad', 'bad'); return ok({ token: wire.login(body.name), name: body.name }); }
      if (p === '/api/me') { const n = wire.accounts.get(auth); return n ? ok({ name: n, created: 0, saveAt: null, online: true }) : bad(401, 'auth', 'auth'); }
      if (p === '/api/status') return ok({ ok: true, online: wire.srvOf.size, names: [] });
      if (p === '/api/save') return opts.method === 'PUT' ? ok({ at: Date.now() }) : ok({ save: null, at: null });
      if (p === '/api/logout') return ok({ ok: true });
      return bad(404, 'not found', 'bad');
    };
  }
  flush() {
    let guard = 0;
    while ((this.opening.length || this.inbound.length || this.outbound.length || this.closing.length) && guard++ < 10000) {
      for (const c of this.opening.splice(0)) {
        const token = decodeURIComponent((c.url.split('token=')[1] || '').split('&')[0]);
        const name = this.accounts.get(token);
        if (!name) { c.readyState = 3; c.closeCode = 4001; if (c.onclose) c.onclose({ code: 4001 }); continue; }
        // the world's close goes into the same queue as its messages, so an error sent first is read first
        const srv = { send: str => this.outbound.push({ client: c, str: String(str) }), close: code => this.outbound.push({ client: c, close: typeof code === 'number' ? code : 1000 }) };
        this.srvOf.set(c, srv); c.readyState = 1; this.room.join(srv, name);
        if (c.onopen && c.readyState === 1) c.onopen();
      }
      for (const { client, str } of this.inbound.splice(0)) { const srv = this.srvOf.get(client); if (srv) this.room.message(srv, str); }
      for (const o of this.outbound.splice(0)) {
        const c = o.client;
        if (o.close !== undefined) { if (c.readyState !== 3) { c.readyState = 3; c.closeCode = o.close; this.closing.push(c); } continue; }
        if (c.readyState === 1 && c.onmessage) c.onmessage({ data: o.str });
      }
      for (const c of this.closing.splice(0)) { const srv = this.srvOf.get(c); if (srv) { this.srvOf.delete(c); this.room.leave(srv); } if (c.onclose) c.onclose({ code: c.closeCode }); }
    }
  }
}

// ---------------------------------------------------------------------------
// A fresh game context: the sandbox from tools/headless.js, plus the online switches and the fake wire.
// ---------------------------------------------------------------------------
function makeContext(wire) {
  const noop = () => { };
  const ctx2d = new Proxy({}, {
    get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? noop : undefined,
    set: () => true,
  });
  const mkCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
  const store = {};
  const g = {
    innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, addEventListener: noop, requestAnimationFrame: noop, setInterval: noop, setTimeout, clearTimeout,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    performance: { now: () => Date.now() }, console: Object.assign(Object.create(console), { table: () => { } }), navigator: { maxTouchPoints: 0 },
    document: { getElementById: () => mkCanvas(), createElement: () => mkCanvas(), fonts: null },
  };
  g.window = g; g.__online = true; g.__onlineBase = 'http://fake'; g.WebSocket = wire.socketClass(); g.fetch = wire.fetch();
  vm.createContext(g);
  vm.runInContext(script, g, { filename: 'index.html' });
  return g;
}

// opts are handed to the Room as well (a later room.js takes { store, random }); a Room that does not know them ignores them
async function loadRoom(now, opts) {
  const file = process.env.MMO_ROOM ? path.resolve(process.env.MMO_ROOM) : path.join(ROOT, 'online', 'src', 'room.js');   // MMO_ROOM=path points at another checkout's room.js
  if (!fs.existsSync(file)) { console.error('--room: ' + file + ' does not exist on this branch'); process.exit(1); }
  let mod;
  try { mod = require(file); } catch (e) { mod = await import(require('url').pathToFileURL(file).href); }
  const Room = mod.Room || (mod.default && mod.default.Room) || mod.default;
  if (typeof Room !== 'function') { console.error('--room: no Room class exported by ' + file); process.exit(1); }
  return new Room(Object.assign({ now, log: () => { }, wake: () => { } }, opts || {}));
}

// a small seeded PRNG: the world's dice in the scenarios, so a run can be told again
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
  const useSim = process.argv.includes('--sim');
  const useRoom = process.argv.includes('--room') || useSim;
  let vnow = Date.now(); const now = () => vnow;
  // the world's dice: seeded, and every draw written down, so each prize can be recomputed from the contract
  const worldDice = mulberry32(20260925), draws = [];
  const random = () => { const v = worldDice(); draws.push(v); return v; };
  const chatLog = [];
  const logChat = (n, text, at) => chatLog.push({ n, text, at });
  const room = useRoom ? await loadRoom(now, { random, log: logChat }) : new FakeWorld({ now, random, log: logChat });
  if (!room.store || typeof room.store.addAccount !== 'function') { console.error('this world has no store with addAccount (the admins build of room.js has one): point MMO_ROOM at it'); process.exit(1); }
  // --sim: the world's game copy (tools/build-sim.mjs --strip, from this index.html) in a real SimHost on the same fake clock
  let simPump = null, simHost = null, simBook = null;
  if (useSim) {
    const { pathToFileURL } = require('url');
    const lib = await import(pathToFileURL(path.join(ROOT, 'tools', 'sim-lib.mjs')).href);
    const { SimHost } = await import(pathToFileURL(path.join(ROOT, 'online', 'src', 'sim', 'host.js')).href);
    const { SimBook } = await import(pathToFileURL(path.join(ROOT, 'online', 'src', 'sim', 'book.js')).href);
    const strip = await lib.loadGame({ strip: true });
    const timers = []; let seq = 0;
    const timer = { set: (f, ms) => { const id = ++seq; timers.push({ id, at: vnow + Math.max(0, ms), f }); return id; }, clear: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); } };
    simPump = () => { for (let guard = 0; guard < 100; guard++) { timers.sort((a, b) => a.at - b.at || a.id - b.id); if (!timers.length || timers[0].at > vnow) break; timers.shift().f(); } };
    simBook = new SimBook(null, now);
    room.worlds.book = simBook;
    simHost = new SimHost({ makeGame: strip.makeGame, now, clock: () => performance.now(), timer, seed: 5, onFallback: (m, r, row) => room.worlds.fell(m, r, row), onSend: (m, l) => room.worlds.fromCopy(m, l) });
    room.worlds.useHost(simHost);
  }
  // the parent page's work, done before anyone logs in: Ann is an admin, Ben a player
  room.store.addAccount('Ann', 'admin'); room.store.addAccount('Ben');
  const wire = new Wire(room);
  const A = makeContext(wire), B = makeContext(wire);
  const both = [A, B];
  const results = [];
  const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '   ' + JSON.stringify(info) : '')); };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const g of both) g.FANGLANDS.newGame();

  // presence, as the players file will send it once it is merged (a context that has one sends its own)
  const presence = g => {
    if (g.PLAYERS || !g.NET.online()) return;
    const p = g.FANGLANDS.player;
    g.NET.send({ t: 'p', map: g.COOP.map(), x: Math.round(p.x), y: Math.round(p.y), fx: p.facing.x, fy: p.facing.y, mv: p.moving ? 1 : 0, wt: 0, hp: p.hp, mhp: p.maxHp, lv: g.FANGLANDS.combatLevel(), look: null, mech: null, dead: p.dead, def: g.playerDefRoll(), act: null });
  };
  let frames = 0;
  const tick = (n, each) => {
    for (let i = 0; i < n; i++) {
      for (const g of both) g.FANGLANDS.step([]);
      if (frames % 8 === 0) for (const g of both) presence(g);
      vnow += FRAME_MS; frames++;
      if (typeof room.tick === 'function') room.tick();
      if (simPump) simPump();
      wire.flush();
      if (each) each();
    }
  };
  const heal = () => { for (const g of both) { const p = g.FANGLANDS.player; if (p.hp < 10) p.hp = p.maxHp; } };

  // ---- 1. log in ----
  const login = async (g, name) => { const r = await g.NET.post('/api/login', { name, pass: 'secret' }); g.NET.setToken(r.token); g.NET.connect(); wire.flush(); return r; };
  await login(A, 'Ann');
  await login(B, 'Ben');
  line('A and B log in with fake tokens and reach the world', A.NET.online() && B.NET.online() && A.NET.me === 'Ann' && B.NET.me === 'Ben', { a: A.NET.status, b: B.NET.status, me: [A.NET.me, B.NET.me] });
  tick(2);
  line('A is keeper of the overworld on both sides; B shows puppets', A.COOP.isKeeper() && A.COOP.map() === 'over' && B.COOP.keeper() === 'Ann' && !B.COOP.isKeeper() && Array.isArray(B.COOP.puppets()), { aKeeper: A.COOP.keeper(), bKeeper: B.COOP.keeper(), bPuppets: !!B.COOP.puppets() });

  // ---- 2. presence ----
  tick(10);
  const seen = B.COOP.remotes().find(r => r.n === 'Ann');
  line('B sees A\'s presence on the same map', !!seen && seen.map === 'over' && Math.abs(seen.x - Math.round(A.FANGLANDS.player.x)) <= 1, seen && { x: seen.x, ax: Math.round(A.FANGLANDS.player.x), map: seen.map });

  // ---- 2b. boy or girl (79-boygirl): A's choice reaches B's game, and B draws her as a girl knight ----
  {
    const lookOnB = () => { const r = B.PLAYERS && B.PLAYERS.remote && B.PLAYERS.remote.Ann; return r && r.look; };
    // a recording canvas: every fill colour B's drawHuman paints for Ann's look
    const fillsOf = look => { const fills = []; const g2 = new Proxy({}, { get: (o, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : k in o ? o[k] : () => { }, set: (o, k, v) => { if (k === 'fillStyle') fills.push(v); o[k] = v; return true; } }); B.drawHuman(g2, { facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, walkT: 0, moving: false }, Object.assign({}, look)); return fills; };
    const ribbon = B.BOYGIRL && B.BOYGIRL.RIBBON;
    const g0 = A.FANGLANDS.player.gender;
    A.FANGLANDS.player.gender = 'girl'; tick(12);
    const asGirl = lookOnB(), girlDrawn = !!asGirl && fillsOf(asGirl).includes(ribbon);
    A.FANGLANDS.player.gender = 'boy'; tick(12);
    const asBoy = lookOnB(), boyDrawn = !!asBoy && !fillsOf(asBoy).includes(ribbon);
    if (g0 === undefined) delete A.FANGLANDS.player.gender; else A.FANGLANDS.player.gender = g0;
    line('A chooses a girl knight: B\'s copy of her look says girl and B draws her ribbon; back to a boy, neither', !!ribbon && !!asGirl && asGirl.girl === true && girlDrawn && !!asBoy && asBoy.girl === false && boyDrawn, { girl: asGirl && asGirl.girl, girlDrawn, boy: asBoy && asBoy.girl, boyDrawn });
  }

  // ---- 3. the same goblin ----
  const AM = A.FANGLANDS.monsters, T = A.FANGLANDS.TILE;
  // a goblin standing alone: nothing else within three tiles of its home, so B's swing can only ever hit this one
  const alone = m => !AM.some(o => o !== m && !o.dead && dist(o, m.home) < 3 * T);
  const g1 = AM.find(m => m.type === 'goblin' && !m.dead && m.nid && !A.isCampMonster(m) && alone(m)) || AM.find(m => m.type === 'goblin' && !m.dead && m.nid && !A.isCampMonster(m));
  const gx = Math.floor(g1.home.x / T), gy = Math.floor(g1.home.y / T);
  g1.x = g1.home.x; g1.y = g1.home.y; g1.state = 'idle'; g1.hp = g1.maxHp; g1.dead = false; g1.lastHitBy = null;
  g1.wanderT = 99; g1.wander = { x: 0, y: 0 };   // stand still: the position check below compares the puppet with the keeper's monster
  A.__peace = true; B.__peace = true;   // held still for the position check
  A.FANGLANDS.tp(gx + 3, gy); B.FANGLANDS.tp(gx - 1, gy); A.FANGLANDS.face(gx, gy); B.FANGLANDS.face(gx, gy);
  tick(12);
  const pb = B.COOP.find(g1.nid);
  line('B has a puppet for A\'s goblin after the first snapshot, at the keeper\'s position', !!pb && pb.remote && pb.type === 'goblin' && Math.abs(pb.x - g1.x) <= 2 && Math.abs(pb.y - g1.y) <= 2, { nid: g1.nid, puppet: pb && [Math.round(pb.x), Math.round(pb.y)], keeper: [Math.round(g1.x), Math.round(g1.y)] });
  // peace off for the fight: a goblin left alone walks home and heals a point on arrival (07-update), so a fists-only
  // knight could lose the race; chasing B it never goes home. A stands three tiles east so B is its nearest knight.
  A.__peace = false; B.__peace = false;

  // B swings until a hit lands on A's goblin (a swing can miss; fists reach one tile)
  const standByPuppet = () => { const p = B.COOP.find(g1.nid); if (!p) return; const bp = B.FANGLANDS.player; bp.x = p.x - 40; bp.y = p.y; bp.facing = { x: 1, y: 0 }; };   // one fist-reach west of wherever the puppet stands
  g1.hp = 5;
  const kA0 = A.FANGLANDS.player.kills, kB0 = B.FANGLANDS.player.kills;
  let hitsSeen = 0; const hitNids = {}; A.NET.on('hit', m => { hitsSeen++; hitNids[m.nid] = (hitNids[m.nid] || 0) + 1; });
  let landed = null, swings = 0;
  while (!landed && swings < 60) { standByPuppet(); B.FANGLANDS.press('Space'); swings++; wire.flush(); if (g1.hp < 5) landed = { swings, hp: g1.hp, hitMessages: hitsSeen }; tick(40, heal); }
  const pbNow = B.COOP.find(g1.nid);
  line('B\'s hit reaches A\'s monster (the hit is routed to the keeper)', !!landed && hitsSeen >= 1 && g1.lastHitBy === 'Ben', landed || { swings, hitMessages: hitsSeen, hitNids, g1: [g1.nid, g1.dead, g1.hp, g1.state], puppet: pbNow && [pbNow.dead, pbNow.gone, Math.round(pbNow.x), Math.round(pbNow.y)], aOnline: A.NET.online(), aKeeper: A.COOP.isKeeper(), bKeeper: B.COOP.keeper(), bHere: A.COOP.knightsHere().length });
  tick(10);
  const pb2 = B.COOP.find(g1.nid);
  line('A\'s monster hp shows on B\'s puppet after the next snapshot', !!pb2 && pb2.hp === g1.hp && g1.hp < g1.maxHp, { keeper: g1.hp, puppet: pb2 && pb2.hp });

  // B lands the last hit
  let killMsgs = 0; B.NET.on('kill', () => killMsgs++);
  swings = 0;
  while (!g1.dead && swings < 80) { standByPuppet(); B.FANGLANDS.press('Space'); swings++; wire.flush(); tick(40, heal); }
  line('B lands the last hit: B\'s kills go up by exactly one and A\'s do not', g1.dead && killMsgs === 1 && B.FANGLANDS.player.kills === kB0 + 1 && A.FANGLANDS.player.kills === kA0, { dead: g1.dead, killMessages: killMsgs, bKills: B.FANGLANDS.player.kills - kB0, aKills: A.FANGLANDS.player.kills - kA0, swings });
  const pb3 = B.COOP.find(g1.nid);
  line('the puppet lies down on B\'s side too', !pb3 || pb3.dead, { puppetDead: pb3 ? pb3.dead : 'gone' });

  // ---- 4. the goblin chases B when A is far ----
  const g2 = AM.find(m => m.type === 'goblin' && !m.dead && m !== g1 && m.nid && !A.isCampMonster(m) && alone(m)) || AM.find(m => m.type === 'goblin' && !m.dead && m !== g1 && m.nid && !A.isCampMonster(m));
  g2.x = g2.home.x; g2.y = g2.home.y; g2.state = 'idle'; g2.hp = g2.maxHp; g2.attackCd = 0; g2.stunT = 0; g2.lastHitBy = null;
  const g2x = Math.floor(g2.home.x / T), g2y = Math.floor(g2.home.y / T);
  A.__peace = false; B.__peace = false;
  A.FANGLANDS.tp(Math.min(g2x + 16, A.FANGLANDS.MAP_W - 2), g2y); B.FANGLANDS.tp(g2x - 1, g2y); B.FANGLANDS.face(g2x, g2y);
  let hurts = 0; B.NET.on('hurt', () => hurts++);
  const bp = B.FANGLANDS.player;
  const dStart = dist(g2, bp);
  tick(150, heal);
  line('A\'s goblin chases B while A stands far away, and B takes its hits', dist(A.FANGLANDS.player, g2.home) > 10 * T && g2.state === 'chase' && dist(g2, bp) < Math.min(dStart, 60) && hurts >= 1, { keeperTiles: Math.round(dist(A.FANGLANDS.player, g2.home) / T), state: g2.state, gap: Math.round(dist(g2, bp)), hurtMessages: hurts });

  // ---- 5. chat ----
  const chatHeard = []; B.NET.on('chat', m => chatHeard.push(m.n + ': ' + m.text));
  A.NET.send({ t: 'chat', text: 'hello Ben' }); wire.flush();
  line('a chat line from A appears in B\'s log', chatHeard.includes('Ann: hello Ben'), chatHeard);

  // ---- 6. handoff ----
  const spawnCount = A.FANGLANDS.monsters.filter(m => /^s\d+$/.test(m.nid)).length;
  A.NET.disconnect(); wire.flush(); tick(3);
  const BM = B.FANGLANDS.monsters, nids = BM.map(m => m.nid).filter(Boolean);
  line('A disconnects: B becomes keeper with no duplicate monsters', B.COOP.isKeeper() && B.COOP.puppets() === null && BM.every(m => !m.remote) && new Set(nids).size === nids.length && BM.filter(m => /^s\d+$/.test(m.nid)).length === spawnCount, { keeper: B.COOP.keeper(), monsters: BM.length, spawnNids: BM.filter(m => /^s\d+$/.test(m.nid)).length, expected: spawnCount, uniq: new Set(nids).size === nids.length });
  const g2b = B.COOP.find(g2.nid); const g2bPos = g2b && { x: g2b.x, y: g2b.y };
  tick(20, heal);
  line('B keeps running its monsters alone afterwards (the goblin it stands by is real and chases it)', !!g2b && !g2b.remote && !g2b.dead && (g2b.state === 'chase' || dist(g2b, g2bPos) > 1), { state: g2b && g2b.state, moved: g2b && Math.round(dist(g2b, g2bPos)) });

  // =====================================================================================================================
  // Admins and drop parties (docs/ONLINE.md). Ann is an admin in the world's store, Ben a player.
  // =====================================================================================================================
  const ev = (g, code) => vm.runInContext(code, g);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const heard = new Map(both.map(g => [g, []]));
  for (const g of both) g.NET.on('*', m => heard.get(g).push(m));
  const mark = g => heard.get(g).length;
  const got = (g, t, since, f) => heard.get(g).slice(since || 0).filter(m => m.t === t && (!f || f(m)));
  const click = (g, key) => { g.render(); return g.FANGLANDS.clickButton(key); };
  const chip = g => { g.render(); return ev(g, "buttons.some(b => b.label === 'ADMIN')"); };
  const isSpawn = m => typeof m.nid === 'string' && m.nid.charAt(0) === '!';
  const calm = () => { for (const g of both) { g.__peace = true; const p = g.FANGLANDS.player; p.hp = p.maxHp; p.dead = false; } };
  // what B's screen writes over a knight's head: 'tagged' (the gold ADMIN pill and a gold name), 'plain', or why not
  const tagOf = (g, n) => ev(g, `(() => {
    const rec = [], st = {};
    const g2 = new Proxy(st, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : k === 'fillText' ? (s => { rec.push({ text: String(s), fill: st.fillStyle }); }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in st ? st[k] : () => { }), set: (t, k, v) => { st[k] = v; return true; } });
    const items = []; for (const hk of HOOKS.draw) hk(g2, items, cam);
    const it = items.find(x => x.who === ${JSON.stringify(n)}); if (!it) return 'not drawn';
    try { it.draw(); } catch (e) { return 'threw: ' + e.message; }
    const pill = rec.some(t => t.text === 'ADMIN'), gold = rec.some(t => t.text === ${JSON.stringify(n)} && t.fill === '#f5c542');
    return pill && gold ? 'tagged' : !pill && !gold ? 'plain' : 'half';
  })()`);
  // a patch of open grass out of the villages, near (cx, cy), with room around it
  const openSpot = (g, cx, cy, half) => ev(g, `(() => { for (let r = 0; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = ${cx} + dx, y = ${cy} + dy; let ok = inMap(x - ${half} - 1, y - ${half} - 1) && inMap(x + ${half} + 1, y + ${half} + 1); for (let yy = y - ${half}; yy <= y + ${half} && ok; yy++) for (let xx = x - ${half}; xx <= x + ${half} && ok; xx++) if (tileAt(xx, yy) !== T.GRASS) ok = false; if (ok && !inVillageBounds(tc(x), tc(y))) return { x, y }; } return null; })()`);

  // ---- 7. roles ----
  calm();
  { const meet = openSpot(B, 60, 30, 3); A.FANGLANDS.tp(meet.x, meet.y); B.FANGLANDS.tp(meet.x + 2, meet.y); }
  A.NET.connect(); wire.flush(); tick(16);
  {
    const roster = B.PLAYERS.online.find(o => o.n === 'Ann'), remote = B.PLAYERS.remote.Ann, mine = A.PLAYERS.online.find(o => o.n === 'Ben');
    const tag = tagOf(B, 'Ann'), benTag = tagOf(A, 'Ben');
    line('7. Ann comes back: her welcome says admin and Ben\'s player; Ben\'s roster and her presence carry admin and his screen draws her gold ADMIN tag; Ben is a plain player on Ann\'s; only Ann gets the ADMIN chip',
      A.NET.role === 'admin' && B.NET.role === 'player' && !!roster && roster.role === 'admin' && !!remote && remote.role === 'admin' && tag === 'tagged' && !!mine && mine.role === 'player' && benTag === 'plain' && chip(A) && !chip(B) && A.ADMIN.is() && !B.ADMIN.is(),
      { roles: [A.NET.role, B.NET.role], roster: roster && roster.role, presence: remote && remote.role, tag, benTag, chips: [chip(A), chip(B)] });
    // the parent page's Make admin / Make player: the World writes the store, then tells the world (setRole)
    const b0 = mark(B);
    room.store.setRole('Ben', 'admin'); room.setRole('Ben'); tick(3);
    const up = B.NET.role === 'admin' && chip(B) && (A.PLAYERS.online.find(o => o.n === 'Ben') || {}).role === 'admin' && got(B, 'role', b0).length === 1;
    room.store.setRole('Ben', 'player'); room.setRole('Ben'); tick(3);
    const down = B.NET.role === 'player' && !chip(B) && (A.PLAYERS.online.find(o => o.n === 'Ben') || {}).role === 'player' && got(B, 'role', b0).length === 2;
    line('7. the parent page makes Ben an admin and a player again: Ben hears role each time, his ADMIN chip comes and goes, and Ann\'s roster follows', up && down, { up, down, roleMessages: got(B, 'role', b0).map(m => m.role) });
  }

  // ---- 8. mute, from Ann's panel; it holds over a reconnect ----
  {
    const a0 = mark(A), b0 = mark(B), logged0 = chatLog.length;
    A.ADMIN.open('knights'); tick(2);
    const muteBtn = click(A, 'admin:mute:Ben'), chosen = click(A, 'admin:span:5m'); tick(3);
    const muted = got(B, 'muted', b0).pop(), mod = got(A, 'mod', a0).pop();
    const told = !!muted && muted.left === 300 && B.CHAT.muted() > 290 && B.CHAT.muted() <= 300 && !!mod && mod.ok && mod.act === 'mute' && mod.n === 'Ben' && mod.left === 300;
    const localNo = B.CHAT.send('hello?') === false;
    tick(100);
    const b1 = mark(B); B.NET.send({ t: 'chat', text: 'sneaky' }); tick(3);
    const worldNo = got(A, 'chat', a0).length === 0 && got(B, 'muted', b1).length === 1 && !chatLog.slice(logged0).some(l => l.text === 'sneaky');
    const listed = !!A.ADMIN.modlist && A.ADMIN.modlist.muted.some(o => o.n === 'Ben' && o.left > 0 && o.left <= 300);
    // Ben drops and comes back: the world says it again, right after welcome
    const b2 = mark(B);
    B.NET.disconnect(); wire.flush(); B.NET.connect(); wire.flush(); tick(3);
    const after = heard.get(B).slice(b2).map(m => m.t), wi = after.indexOf('welcome'), mi = after.indexOf('muted');
    const holds = wi >= 0 && mi > wi && B.CHAT.muted() > 0 && B.CHAT.muted() <= 300;
    tick(100);
    A.ADMIN.open('knights'); tick(2);
    const b3 = mark(B), unmuteBtn = click(A, 'admin:unmute:Ben'); tick(3);
    const unmuted = got(B, 'unmuted', b3).length === 1 && B.CHAT.muted() === 0;
    tick(100);
    const back = B.CHAT.send('back again'); tick(3);
    const heardBack = got(A, 'chat', a0).some(m => m.n === 'Ben' && m.text === 'back again' && m.role === 'player');
    A.FANGLANDS.closePanel();
    line('8. Ann mutes Ben for 5 minutes from her panel: he hears muted 300 and Ann mod ok; his line never leaves his game, a raw one is refused by the world (muted again, not relayed, not logged); the modlist shows him',
      muteBtn && chosen && told && localNo && worldNo && listed, { muteBtn, chosen, muted, mod, localNo, worldNo, listed });
    line('8. the mute holds over a reconnect (muted right after welcome); Unmute on Ann\'s panel lifts it and Ben talks again',
      holds && unmuteBtn && unmuted && back && heardBack, { after: after.slice(0, 8), holds, unmuteBtn, unmuted, back, heardBack });
  }

  // ---- 9. kick ----
  {
    const b0 = mark(B), sock = B.NET.sock;
    A.ADMIN.open('knights'); tick(2);
    const first = click(A, 'admin:kick:Ben'), still = B.NET.online(), second = click(A, 'admin:kick:Ben'); wire.flush();
    const err = got(B, 'error', b0).find(m => m.code === 'kicked');
    const closed = !!sock && sock.readyState === 3 && sock.closeCode === 4005 && !B.NET.online();
    const opens0 = wire.made.length;
    tick(30 * 60);
    const stayed = B.NET.timer === null && wire.made.length === opens0 && !B.NET.online() && !!B.NET.token;
    B.NET.connect(); wire.flush(); tick(12);
    const again = B.NET.online() && got(B, 'welcome', b0).length === 1;
    A.FANGLANDS.closePanel();
    line('9. Ann kicks Ben (two taps): error kicked, then the socket closes 4005; his wire books no reconnect over 30 s and keeps the session; he comes back by hand and is welcomed',
      first && still && second && !!err && err.text === KICK_TEXT && closed && stayed && again, { first, still, second, err: err && err.text, code: sock && sock.closeCode, stayed, again });
  }

  // ---- 10. spawn: Ann keeps the map; Ben sees the goblins, fights one and gets the kill ----
  {
    calm(); tick(20);
    const spot = openSpot(A, 60, 30, 3);
    A.FANGLANDS.tp(spot.x, spot.y); B.FANGLANDS.tp(spot.x + 2, spot.y); A.FANGLANDS.face(spot.x + 2, spot.y); tick(16);
    const keeper = A.COOP.isKeeper() && B.COOP.keeper() === 'Ann';
    const kA0 = A.FANGLANDS.player.kills, kB0 = B.FANGLANDS.player.kills;
    let kills = 0; const onKill = B.NET.on('kill', m => { if (isSpawn(m)) kills++; });
    const asked = A.ADMIN.spawn('goblin', 3); tick(16);
    const real = A.FANGLANDS.monsters.filter(m => isSpawn(m) && m.type === 'goblin' && !m.dead);
    const puppets = B.FANGLANDS.monsters.filter(m => isSpawn(m) && m.remote && m.type === 'goblin' && !m.dead);
    const sid = real.length ? real[0].nid.slice(1).split('.')[0] : null;
    const made = real.length === 3 && puppets.length === 3 && /^[0-9a-z]+$/.test(sid || '') && real.every(m => puppets.some(p => p.nid === m.nid) && Math.hypot(m.x - A.FANGLANDS.player.x, m.y - A.FANGLANDS.player.y) <= 3 * T + 1);
    line('10. Ann keeps the map and spawns 3 goblins: her game makes them (nids !<sid>.0-2, within 3 tiles of her) and Ben\'s game shows the same 3 as puppets', keeper && asked && made,
      { keeper, asked, real: real.map(m => m.nid), puppets: puppets.map(m => m.nid), sid });
    const target = A.FANGLANDS.monsters.find(m => m.nid === '!' + sid + '.0');
    let credit = false, goneA = false, downB = false, goneB = false, never = false, cleared = false, swings = 0;
    if (target) {
      // Ben fights '!<sid>.0'; the other two wait, stunned, well away; the world's own monsters near it sit this one out
      for (const m of real) if (m !== target) { m.x = target.x + 10 * T; m.stunT = 999; }
      for (const m of A.FANGLANDS.monsters) if (!isSpawn(m) && !m.dead && Math.hypot(m.x - target.x, m.y - target.y) < 12 * T) { m.dead = true; m.deadT = 9; m.respawnT = 1e9; }
      A.FANGLANDS.tp(spot.x + 5, spot.y + 3); target.hp = 5; tick(12);
      A.__peace = false; B.__peace = false;
      const standBy = () => { const p = B.COOP.find(target.nid); if (!p) return; const q = B.FANGLANDS.player; q.x = p.x - 40; q.y = p.y; q.facing = { x: 1, y: 0 }; };
      while (!target.dead && swings < 120) { standBy(); B.FANGLANDS.press('Space'); swings++; wire.flush(); tick(30, heal); }
      credit = target.dead && kills === 1 && B.FANGLANDS.player.kills === kB0 + 1 && A.FANGLANDS.player.kills === kA0;
      calm();
      tick(125);
      goneA = !A.FANGLANDS.monsters.some(m => m.nid === target.nid);
      const pb4 = B.FANGLANDS.monsters.find(m => m.nid === target.nid); downB = !pb4 || pb4.dead;
      tick(300);
      goneB = !B.FANGLANDS.monsters.some(m => m.nid === target.nid);
      tick(600);
      never = !A.FANGLANDS.monsters.some(m => m.nid === target.nid) && !B.FANGLANDS.monsters.some(m => m.nid === target.nid);
      A.ADMIN.clearSpawns(); tick(300);
      cleared = !A.FANGLANDS.monsters.some(isSpawn) && !B.FANGLANDS.monsters.some(isSpawn);
    }
    B.NET.off('kill', onKill);
    line('10. Ben fights one and gets the kill (one kill message, his kills +1, Ann\'s +0); 2 s later it is gone from the keeper, then from Ben\'s screen, and it never comes back; Clear spawns takes the rest from both',
      credit && goneA && downB && goneB && never && cleared, { swings, kills, kinds: [A.FANGLANDS.player.kills - kA0, B.FANGLANDS.player.kills - kB0], goneA, downB, goneB, never, cleared });
  }

  // ---- 11. a drop party: both knights light the SAME cracker in the SAME tick, 50 times ----
  {
    calm(); tick(10);
    for (const g of both) g.FANGLANDS.closePanel();
    // open country with room for 50 crackers in 10 tiles (the admin's client picks them; the world checks them)
    let spot = null;
    for (const [cx, cy] of [[60, 30], [40, 24], [80, 40], [100, 20], [30, 60], [120, 60]]) {
      const s = openSpot(A, cx, cy, 5);
      if (!s) continue;
      A.FANGLANDS.tp(s.x, s.y);
      const n = ev(A, 'Array.from({ length: 5 }, () => (PARTY.pickSpots(50, 10) || []).length).reduce((a, b) => Math.min(a, b), 99)');
      if (n === 50) { spot = s; break; }
    }
    const IDS = ['coins', 'bread'].concat(HAT_COLOURS.map(c => 'party_hat_' + c));
    const holding = g => ev(g, `(() => { const out = {}; for (const id of ${JSON.stringify(IDS)}) { let n = countItem(id); for (const b of player.bank) if (b && b.id === id) n += b.qty; for (const d of drops) if (d.id === id) n += d.qty; out[id] = n; } return out; })()`);
    const delta = (a, b) => { const d = {}; for (const id of IDS) if (b[id] !== a[id]) d[id] = b[id] - a[id]; return d; };
    const table = [{ id: 'coins', min: 1, max: 100, w: 5 }, { id: 'bread', min: 1, max: 3, w: 3 }];
    // stand on the cracker (dx px off its middle) facing a way whose front tile holds nothing else E would use first
    const standOn = (g, c, dx) => ev(g, `(() => {
      player.x = ${c.tx} * TILE + TILE / 2 + (${dx}); player.y = ${c.ty} * TILE + TILE / 2; player.action = null; player.moving = false;
      for (const [fx, fy] of [[${dx < 0 ? 1 : -1}, 0], [0, 1], [0, -1], [${dx < 0 ? -1 : 1}, 0]]) { player.facing = { x: fx, y: fy }; const f = frontTile(player); if (!INTERESTING(tileAt(f.tx, f.ty)) && !npcInFront()) return true; }
      return false;
    })()`);
    let pid = null, threw = false, both50 = false;
    if (spot) {
      A.FANGLANDS.tp(spot.x, spot.y); B.FANGLANDS.tp(spot.x + 1, spot.y + 1); tick(20);
      Object.assign(A.PARTY.UI, { count: 50, scatter: 10, hat: 10, table: table.map(r => Object.assign({}, r)) });
      ev(A, 'PARTY.S.lastThrow = -1e9');
      threw = !!A.PARTY.throwParty(); tick(6);
      const live = room.store.liveParties(vnow), p = live[live.length - 1];
      pid = p ? p.id : null;
      both50 = !!p && p.by === 'Ann' && p.hat === 10 && same(p.table, table) && p.crackers.length === 50 && A.PARTY.live().length === 50 && same(A.PARTY.live().map(c => c.id), B.PARTY.live().map(c => c.id));
    }
    line('11. Ann throws a party of 50 crackers (spread 10, party hats 1 in 10, coins 1 to 100 or bread 1 to 3): the world keeps exactly that and both games hold the same 50', !!spot && threw && both50,
      { spot, threw, pid, a: A.PARTY.live().length, b: B.PARTY.live().length });
    const order = mulberry32(7);   // who presses first, race by race (the sim's own dice, never the world's)
    const bad = { booms: [], rolls: [], lands: [], store: [], face: [] };
    const wins = { Ann: 0, Ben: 0 }, won = {}, hats = [];
    let races = 0, lastRace = null;
    const digest = [];
    for (let i = 0; i < 50 && pid !== null; i++) {
      const c = A.PARTY.live()[0];
      if (!c || !B.PARTY.live().some(x => x.id === c.id)) { bad.booms.push({ race: i, missing: c && c.id }); break; }
      for (const g of both) ev(g, 'drops.length = 0');
      const faced = [standOn(A, c, -8), standOn(B, c, 8)];
      if (!faced[0] || !faced[1]) bad.face.push({ race: i, id: c.id, faced });
      tick(16);   // both presences reach the world: it measures each light from the knight's last p
      const first = order() < 0.5 ? A : B, second = first === A ? B : A, fn = first === A ? 'Ann' : 'Ben';
      // the party's last cracker: the first light ends the party, so the second finds it over ('gone'); either way its
      // boom is already out and the second knight's game says nothing
      const last = A.PARTY.live().length === 1;
      const h0 = { A: holding(A), B: holding(B) }, a0 = mark(A), b0 = mark(B), d0 = draws.length;
      for (const g of both) ev(g, 'notice = null');
      first.FANGLANDS.press('KeyE'); second.FANGLANDS.press('KeyE');   // both lights leave in the same frame, first's ahead
      wire.flush();
      races++;
      const booms = [got(A, 'boom', a0, m => m.id === c.id), got(B, 'boom', b0, m => m.id === c.id)];
      const nos = [got(first, 'light_no', first === A ? a0 : b0, m => m.id === c.id), got(second, 'light_no', second === A ? a0 : b0, m => m.id === c.id)];
      const said = ev(second, 'notice && notice.text');
      if (!(booms[0].length === 1 && booms[1].length === 1 && booms[0][0].n === fn && booms[1][0].n === fn && same(booms[0][0], booms[1][0]) && nos[0].length === 0 && nos[1].length === 1
        && (nos[1][0].code === 'taken' || (last && nos[1][0].code === 'gone')) && said !== 'That cracker is gone.'))
        bad.booms.push({ race: i, id: c.id, first: fn, last, booms: booms.map(b => b.map(m => m.n)), lightNo: nos.map(l => l.map(m => m.code)), said });
      if (last) lastRace = { id: c.id, lightNo: nos[1].map(m => m.code), said };
      const boom = booms[0][0] || booms[1][0];
      if (!boom) continue;
      // the prize and the fuse are exactly the contract's roll from the dice the world threw for this light (and only this one)
      const used = draws.slice(d0); let u = 0; const replay = () => used[u++];
      const want = contractRoll(table, 10, replay), fuse = 1000 + Math.floor(replay() * 1501);
      if (!(same(boom.reward, want) && boom.fuse === fuse && u === used.length)) bad.rolls.push({ race: i, reward: boom.reward, want, fuse: [boom.fuse, fuse], draws: [used.length, u] });
      digest.push(boom.reward.id.replace('party_hat_', 'hat:') + 'x' + boom.reward.qty);
      tick(Math.ceil(boom.fuse / FRAME_MS) + 6);   // past the fuse on both screens
      const h1 = { A: holding(A), B: holding(B) };
      const dW = delta(h0[first === A ? 'A' : 'B'], h1[first === A ? 'A' : 'B']), dL = delta(h0[second === A ? 'A' : 'B'], h1[second === A ? 'A' : 'B']);
      if (!(same(dW, { [boom.reward.id]: boom.reward.qty }) && same(dL, {}))) bad.lands.push({ race: i, id: c.id, reward: boom.reward, winner: dW, loser: dL });
      const cr = room.store.cracker(pid, c.k);
      if (!(cr && cr.litBy === fn.toLowerCase() && cr.claimed === true)) bad.store.push({ race: i, id: c.id, litBy: cr && cr.litBy, claimed: cr && cr.claimed });
      wins[fn]++; won[boom.reward.id] = (won[boom.reward.id] || 0) + boom.reward.qty;
      if (boom.reward.hat) hats.push({ race: i, n: fn, colour: boom.reward.hat });
    }
    const info = { races, wins, won, hats: hats.length, face: bad.face.slice(0, 3) };
    line('11. the SAME cracker, the SAME tick, 50 times: every time exactly one boom reaches each game, naming the knight whose light the world read first, and the other knight hears taken (gone for the last one: that light ended the party) and his game says nothing',
      races === 50 && bad.booms.length === 0 && bad.face.length === 0 && wins.Ann > 0 && wins.Ben > 0, Object.assign({ bad: bad.booms.slice(0, 3), lastRace }, info));
    line('11. every prize and fuse is exactly the contract\'s roll (the party hat first, then the colour, or the row and the quantity; then the fuse) from the dice the world threw for that one light',
      races === 50 && bad.rolls.length === 0 && hats.length > 0 && (won.coins || 0) > 0 && (won.bread || 0) > 0, { bad: bad.rolls.slice(0, 3), digest: digest.join(' ') });
    line('11. every prize lands once, in the winner\'s game only (pack, bank or feet), and the world\'s store has each cracker lit by the winner and claimed',
      races === 50 && bad.lands.length === 0 && bad.store.length === 0, { lands: bad.lands.slice(0, 3), store: bad.store.slice(0, 3) });
    const hatAnnA = got(A, 'announce', 0, m => m.kind === 'hat').length, hatAnnB = got(B, 'announce', 0, m => m.kind === 'hat').length;
    const ends = [got(A, 'party_end', 0, m => m.pid === pid).length, got(B, 'party_end', 0, m => m.pid === pid).length];
    const hatRows = room.store.modLog(500).filter(r => r.act === 'hat').length;
    line('11. each party hat is announced to both games and written to the mod log; the last cracker lit ends the party on both screens and in the world',
      hats.length > 0 && hatAnnA === hats.length && hatAnnB === hats.length && hatRows === hats.length && ends[0] === 1 && ends[1] === 1 && A.PARTY.live().length === 0 && B.PARTY.live().length === 0 && pid !== null && !room.store.liveParties(vnow).some(p => p.id === pid),
      { hats: hats.map(h => h.n + ':' + h.colour), announced: [hatAnnA, hatAnnB], modLog: hatRows, ends });
    // a party hat goes to the other knight with the ordinary gift
    const giver = hats.length ? (hats[0].n === 'Ann' ? A : B) : null, taker = giver === A ? B : A, hatId = hats.length ? 'party_hat_' + hats[0].colour : null;
    let gave = false, gift = {};
    if (giver) {
      calm(); taker.FANGLANDS.tp(spot.x, spot.y); giver.FANGLANDS.tp(spot.x + 1, spot.y); tick(20);
      const h0 = { g: holding(giver), t: holding(taker) }, g0 = mark(giver);
      gave = giver.PLAYERS.give(taker === A ? 'Ann' : 'Ben', hatId, 1); tick(6);
      const h1 = { g: holding(giver), t: holding(taker) };
      gift = { giver: delta(h0.g, h1.g), taker: delta(h0.t, h1.t), ok: got(giver, 'gift_ok', g0).length };
    }
    line('11. a party hat is handed over with the ordinary gift: it leaves the winner\'s pack, lands in the other knight\'s, and the giver hears gift_ok',
      !!giver && gave && same(gift.giver, { [hatId]: -1 }) && same(gift.taker, { [hatId]: 1 }) && gift.ok === 1, Object.assign({ hat: hatId, gave }, gift));
  }

  // ---- 12. ban ----
  {
    calm();
    const b0 = mark(B), sock = B.NET.sock, log0 = room.store.modLog(500).length;
    A.ADMIN.open('knights'); tick(2);
    click(A, 'admin:ban:Ben'); click(A, 'admin:ban:Ben'); wire.flush();
    const err = got(B, 'error', b0).find(m => m.code === 'banned');
    const closed = !!sock && sock.readyState === 3 && sock.closeCode === 4003 && !B.NET.online() && B.NET.token === null;
    tick(120);
    const noRetry = B.NET.timer === null && !B.NET.online();
    const tries = [];
    for (let i = 0; i < 2; i++) { B.NET.setToken(wire.login('Ben')); B.NET.connect(); wire.flush(); tick(3); tries.push({ online: B.NET.online(), code: wire.made[wire.made.length - 1].closeCode }); }
    const refused = tries.every(t => !t.online && t.code === 4003) && !A.PLAYERS.online.some(o => o.n === 'Ben');
    tick(60);
    A.ADMIN.open('knights'); tick(2);
    const unbanBtn = click(A, 'admin:unban:Ben'); tick(3);
    B.NET.setToken(wire.login('Ben')); B.NET.connect(); wire.flush(); tick(6);
    const back = B.NET.online() && B.NET.me === 'Ben' && A.PLAYERS.online.some(o => o.n === 'Ben');
    const rows = room.store.modLog(500).slice(0, room.store.modLog(500).length - log0).map(r => r.act).reverse();
    A.FANGLANDS.closePanel();
    line('12. Ann bans Ben (two taps): error banned, then close 4003; his wire drops the session and books no reconnect; every new join is refused (4003) until Ann taps Unban, then he is welcomed; ban and unban are in the mod log',
      !!err && closed && noRetry && refused && unbanBtn && back && same(rows, ['ban', 'unban']), { err: !!err, code: sock && sock.closeCode, closed, noRetry, tries, unbanBtn, back, rows });
    // the parent page's Ban and Unban: the World writes the store, then sends him out by name (room.kick), as it does for real
    const b1 = mark(B), s1 = B.NET.sock, onBefore = room.isOnline('Ben');
    room.store.setBanned('Ben', true); const sent = room.kick('Ben', 'banned', 'this knight is banned'); wire.flush(); tick(3);
    const out = sent === true && got(B, 'error', b1).some(m => m.code === 'banned') && !!s1 && s1.closeCode === 4003 && !B.NET.online() && !room.isOnline('Ben');
    B.NET.setToken(wire.login('Ben')); B.NET.connect(); wire.flush(); tick(3);
    const held = !B.NET.online() && wire.made[wire.made.length - 1].closeCode === 4003;
    room.store.setBanned('Ben', false); B.NET.setToken(wire.login('Ben')); B.NET.connect(); wire.flush(); tick(6);
    const again = B.NET.online() && room.isOnline('Ben') && room.kick('Nobody', 'banned', 'x') === false;
    line('12. the parent page\'s Ban (the store written, then kick by name) sends Ben out with 4003 and keeps him out; its Unban lets him straight back in',
      onBefore && out && held && again, { onBefore, out, held, again });
  }

  // ---- 13. a player sends every admin message ----
  {
    calm(); tick(120);
    const a0 = mark(A), b0 = mark(B), log0 = room.store.modLog(500).length, parties0 = room.store.liveParties(vnow).length;
    const p = B.FANGLANDS.player, tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
    const msgs = [
      { t: 'mute', n: 'Ann', span: 'always' }, { t: 'unmute', n: 'Ann' }, { t: 'kick', n: 'Ann' }, { t: 'ban', n: 'Ann' }, { t: 'unban', n: 'Ben' }, { t: 'modlist' },
      { t: 'spawn', type: 'goblin', count: 5, x: Math.round(p.x), y: Math.round(p.y) }, { t: 'spawn_clear' },
      { t: 'party', x: Math.round(p.x), y: Math.round(p.y), spots: [[tx + 2, ty], [tx - 2, ty], [tx, ty + 2], [tx, ty - 2], [tx + 3, ty + 1]], table: [{ id: 'coins', min: 1, max: 10, w: 1 }], hat: 10 },
      { t: 'party_end' },
    ];
    for (const m of msgs) B.NET.send(m);
    tick(30);
    const refusals = got(B, 'error', b0).filter(m => m.code === 'admin').length;
    const annFine = A.NET.online() && A.NET.role === 'admin' && A.CHAT.muted() === 0 && got(A, 'muted', a0).length === 0 && got(A, 'error', a0).length === 0 && !room.store.account('Ann').banned && room.store.account('Ann').mutedUntil === 0;
    const nothing = !A.FANGLANDS.monsters.some(isSpawn) && !B.FANGLANDS.monsters.some(isSpawn) && room.store.liveParties(vnow).length === parties0 && got(B, 'crackers', b0).length === 0 && room.store.modLog(500).length === log0 && got(B, 'modlist', b0).length === 0 && got(B, 'mod', b0).length === 0;
    const benOn = B.NET.online() && B.NET.me === 'Ben' && B.NET.role === 'player';
    line('13. Ben (a player) sends mute, unmute, kick, ban, unban, modlist, spawn, spawn_clear, party and party_end: each is answered error admin; Ann is untouched, nothing is spawned or thrown, the mod log is unchanged, and Ben stays on',
      refusals === msgs.length && annFine && nothing && benOn, { refusals, of: msgs.length, annFine, nothing, benOn });
  }

  // =====================================================================================================================
  // Trading (docs/ONLINE.md, "Trading"), through the games' own buttons: Ann taps Ben, Trade; Ben's Accept; the pack's
  // pouches and the amounts; Accept on both; "Are you sure?"; Confirm on both.
  // =====================================================================================================================
  const holdingOf = (g, id) => ev(g, `countItem(${JSON.stringify(id)})`);
  const setPack = (g, list) => ev(g, `player.inv = new Array(INV_SLOTS).fill(null); ${JSON.stringify(list)}.forEach(([id, q]) => addItem(id, q)); player.trades = { done: [] };`);
  const tapKnight = (g, n) => ev(g, `(() => { render(); const e = PLAYERS.remote[${JSON.stringify(n)}]; if (!e) return false; tap.lastTap = null; const sx = e.shown.x - cam.x, sy = e.shown.y - 8 - cam.y; pointerDown(sx, sy, 'mouse'); pointerUp('mouse', sx, sy); render(); return !!TRADE.menu && TRADE.menu.n === ${JSON.stringify(n)}; })()`);
  const tradeRows0 = () => room.store.tradeLog(1000).length;
  {
    calm(); tick(60);
    const meet = openSpot(A, 70, 40, 3); A.FANGLANDS.tp(meet.x, meet.y); B.FANGLANDS.tp(meet.x + 2, meet.y); tick(20);
    setPack(A, [['bread', 5], ['iron_dagger', 1]]); setPack(B, [['coins', 100]]);
    const a0 = mark(A), b0 = mark(B), rows0 = tradeRows0();
    const menu = tapKnight(A, 'Ben');
    const noSwing = ev(A, '!(player.attackT > 0) && !player.walkPath');
    const asked = click(A, 'knight:trade'); tick(3);
    const askCard = !!B.TRADE.asks.find(q => q.from === 'Ann');
    const yes = click(B, 'ask:yes'); tick(3);
    const open = !!A.TRADE.cur && !!B.TRADE.cur && A.TRADE.cur.id === B.TRADE.cur.id && ev(A, "panel") === 'trade' && ev(B, "panel") === 'trade';
    // Ann offers her 5 bread (the pouch, then Add all); Ben 20 coins (the pouch, then Add 10 twice)
    const aPick = click(A, 'trade:pack:bread:') && click(A, 'trade:add:all'); tick(2);
    const bPick = click(B, 'trade:pack:coins:') && click(B, 'trade:add:ten'); tick(2); const bTen2 = click(B, 'trade:add:ten'); tick(2); click(B, 'trade:back');
    const offers = same(A.TRADE.cur.mine, [{ id: 'bread', qty: 5 }]) && same(A.TRADE.cur.theirs, [{ id: 'coins', qty: 20 }]) && same(B.TRADE.cur.theirs, [{ id: 'bread', qty: 5 }]);
    const accA = click(A, 'trade:accept'); tick(2); const accB = click(B, 'trade:accept'); tick(2);
    const sure = A.TRADE.cur && A.TRADE.cur.stage === 'confirm' && B.TRADE.cur && B.TRADE.cur.stage === 'confirm';
    const before = { aBread: holdingOf(A, 'bread'), aCoins: holdingOf(A, 'coins'), bBread: holdingOf(B, 'bread'), bCoins: holdingOf(B, 'coins') };
    const cfA = click(A, 'trade:confirm'); tick(2);
    const stillBefore = holdingOf(A, 'bread') === 5 && holdingOf(B, 'coins') === 100;   // one confirm moves nothing
    const cfB = click(B, 'trade:confirm'); tick(4);
    const after = { aBread: holdingOf(A, 'bread'), aCoins: holdingOf(A, 'coins'), bBread: holdingOf(B, 'bread'), bCoins: holdingOf(B, 'coins') };
    const doneA = got(A, 'trade_done', a0).length, doneB = got(B, 'trade_done', b0).length;
    const rows = room.store.tradeLog(1000).slice(0, tradeRows0() - rows0);
    const row = rows[0] || {};
    const logged = rows.length === 1 && row.a === 'Ann' && row.b === 'Ben' && same(row.aGave, [{ id: 'bread', qty: 5 }]) && same(row.bGave, [{ id: 'coins', qty: 20 }]) && row.aAck === true && row.bAck === true;
    // the same trade told again (a reconnect) moves nothing more; and a real reconnect hears nothing (both acked)
    const tid = got(A, 'trade_done', a0)[0] && got(A, 'trade_done', a0)[0].tid;
    A.NET.emit('trade_done', { t: 'trade_done', tid, id: null, with: 'Ben', gave: [{ id: 'bread', qty: 5 }], got: [{ id: 'coins', qty: 20 }] }); tick(2);
    const a1 = mark(A); A.NET.disconnect(); wire.flush(); A.NET.connect(); wire.flush(); tick(80);   // a second: Ben's presence comes round again
    const again = holdingOf(A, 'bread') === 0 && holdingOf(A, 'coins') === 20 && got(A, 'trade_done', a1).length === 0;
    const closed = A.TRADE.cur === null && B.TRADE.cur === null && ev(A, 'panel') !== 'trade' && ev(B, 'panel') !== 'trade';
    line('14. Ann taps Ben (a card, no swing, no walk) and trades 5 bread for 20 coins through the buttons: Ben accepts the ask, both offer from their packs, both accept, "Are you sure?", both confirm; it happens exactly once on both sides, one row in the trade log with both acks, and nothing more on a repeat or a reconnect',
      menu && noSwing && asked && askCard && yes && open && aPick && bPick && bTen2 && offers && accA && accB && sure && cfA && stillBefore && cfB && same(before, { aBread: 5, aCoins: 0, bBread: 0, bCoins: 100 }) && same(after, { aBread: 0, aCoins: 20, bBread: 5, bCoins: 80 }) && doneA === 1 && doneB === 1 && logged && again && closed,
      { menu, noSwing, asked, askCard, yes, open, offers, sure, stillBefore, before, after, doneA, doneB, logged, rows: rows.length, again, closed });
  }
  {
    calm();
    setPack(A, [['bread', 3]]); setPack(B, [['coins', 50]]);
    const a0 = mark(A), b0 = mark(B), rows0 = tradeRows0();
    const askedOk = A.TRADE.ask('Ben'); tick(3); const yesOk = click(B, 'ask:yes'); tick(3);
    const id = A.TRADE.cur && A.TRADE.cur.id;
    A.TRADE.add('bread', 3); B.TRADE.add('coins', 20); tick(3);
    click(A, 'trade:accept'); tick(3);
    const verA = A.TRADE.cur.ver, accepted = B.TRADE.cur.acc[1] === true;
    // Ben changes his offer after Ann accepted: 15 coins, not 20
    click(B, 'trade:mine:coins:'); click(B, 'trade:take:one'); for (let i = 0; i < 4; i++) B.TRADE.take('coins', 1); tick(4); click(B, 'trade:back');
    const c = A.TRADE.cur;
    const unaccepted = !!c && c.stage === 'offer' && c.ver > verA && same(c.acc, [false, false]) && same(c.theirs, [{ id: 'coins', qty: 15 }]);
    // Ann's old accept, sent again, and Ben's accept: still nothing moves (Ann has not accepted the new offer)
    A.NET.send({ t: 'trade_accept', id, ver: verA }); tick(2); click(B, 'trade:accept'); tick(3);
    const confirmNow = A.TRADE.confirm(); tick(2);
    const heldBack = A.TRADE.cur && A.TRADE.cur.stage === 'offer' && same(A.TRADE.cur.acc, [false, true]) && confirmNow === false && holdingOf(A, 'bread') === 3 && holdingOf(B, 'coins') === 50 && tradeRows0() === rows0 && got(A, 'trade_done', a0).length === 0;
    // both accept the new offer, then both confirm: it moves once, with the new amounts
    click(A, 'trade:accept'); tick(3); click(A, 'trade:confirm'); click(B, 'trade:confirm'); tick(4);
    const moved = holdingOf(A, 'bread') === 0 && holdingOf(A, 'coins') === 15 && holdingOf(B, 'bread') === 3 && holdingOf(B, 'coins') === 35 && got(A, 'trade_done', a0).length === 1 && got(B, 'trade_done', b0).length === 1 && tradeRows0() === rows0 + 1;
    const row = room.store.tradeLog(1)[0];
    line('15. Ben changes his offer after Ann accepted: both are un-accepted at once (a new version), Ann\'s old accept and a confirm move nothing, and only when both accept again and both confirm does it happen, once, with the new amounts',
      !!id && accepted && unaccepted && heldBack && moved && same(row.bGave, [{ id: 'coins', qty: 15 }]), { id, accepted, unaccepted, heldBack, moved, row: row && [row.aGave, row.bGave] });
  }
  {
    // closing the window, walking away and a disconnect all end a trade with nothing moved
    calm();
    setPack(A, [['bread', 4]]); setPack(B, [['coins', 10]]);
    const rows0 = tradeRows0(), ends = [];
    // an ask every two seconds at most (the cap: 0.5 a second, a burst of 3), so each one waits its turn
    const openOne = () => { tick(130); A.TRADE.ask('Ben'); tick(3); click(B, 'ask:yes'); tick(3); A.TRADE.add('bread', 4); B.TRADE.add('coins', 10); tick(3); click(A, 'trade:accept'); click(B, 'trade:accept'); tick(3); return !!A.TRADE.cur && A.TRADE.cur.stage === 'confirm'; };
    const b0 = mark(B);
    const o1 = openOne(); click(A, '×'); tick(4); ends.push(got(B, 'trade_end', b0).map(m => m.code).join());
    const b1 = mark(B), o2 = openOne(); const p = A.FANGLANDS.player; A.FANGLANDS.tp(Math.floor(p.x / T) + 12, Math.floor(p.y / T)); tick(16); ends.push(got(B, 'trade_end', b1).map(m => m.code).join());
    A.FANGLANDS.tp(Math.floor(B.FANGLANDS.player.x / T) - 2, Math.floor(B.FANGLANDS.player.y / T)); tick(16);
    const b2 = mark(B), o3 = openOne(); A.NET.disconnect(); wire.flush(); tick(4); ends.push(got(B, 'trade_end', b2).map(m => m.code).join());
    A.NET.connect(); wire.flush(); tick(80);
    const nothing = holdingOf(A, 'bread') === 4 && holdingOf(B, 'coins') === 10 && holdingOf(A, 'coins') === 0 && tradeRows0() === rows0 && A.TRADE.cur === null && B.TRADE.cur === null;
    line('16. a trade on its last screen ends with nothing moved when Ann closes the window, walks twelve tiles away, or disconnects; Ben hears why each time',
      o1 && o2 && o3 && same(ends, ['closed', 'far', 'left']) && nothing, { o1, o2, o3, ends, nothing });
  }

  // =====================================================================================================================
  // Named bosses (docs/ONLINE.md, "Named bosses: boss_call and helper credit"): every boss can be beaten again, friends fight
  // it together, the keeper makes it, and each knight's first kill is his own.
  // =====================================================================================================================
  const keepOver = () => {
    // Ann keeps the overworld: Ben steps into a cave and out again, so she is the one who has been there longest
    if (A.COOP.isKeeper() && A.COOP.map() === 'over' && B.COOP.map() === 'over') return true;
    ev(A, "if (INSTANCES.active()) INSTANCES.leave()"); ev(B, "if (INSTANCES.active()) INSTANCES.leave()"); tick(20);
    ev(B, "INSTANCES.enter('spider_den')"); tick(20); ev(B, "INSTANCES.leave()"); tick(30);
    return A.COOP.isKeeper() && B.COOP.keeper() === 'Ann';
  };
  const sumNear = (g, id, qty) => ev(g, `drops.filter(d => d.id === ${JSON.stringify(id)}${qty ? ' && d.qty === ' + qty : ''}).reduce((n, d) => n + d.qty, 0)`);
  const hitBoss = (g, type, dmg) => ev(g, `(() => { const m = monsters.find(o => o.type === ${JSON.stringify(type)} && !o.dead); if (!m) return false; hitMonster(m, ${dmg}, 0); return true; })()`);
  // ---- M1. the Fang: Ann has slain it (stage 16); Ben, at stage 14, sounds the horn; both fight; Ben lands the last blow ----
  {
    calm(); const kept = keepOver();
    const fangOf = g => ev(g, "(() => { const m = monsters.find(o => o.type === 'the_fang'); return m ? { dead: m.dead, remote: !!m.remote, hp: m.hp } : null; })()");
    ev(A, "quest.stage = 16; quest.dragons = Object.assign(quest.dragons || {}, { salve: true }); quest.fang = { gateOpen: true, warned: true, slain: true, seen: true, looted: [], chest: false, summoned: true, echoUp: false, restUntil: 0, echoes: 0 }; drops = [];");
    ev(B, "quest.stage = 14; quest.dragons = Object.assign(quest.dragons || {}, { salve: true }); quest.fang = { gateOpen: true, warned: true, slain: false, seen: true, looted: [], chest: false, summoned: false, echoUp: false, restUntil: 0, echoes: 0 }; drops = []; if (!countItem('dragon_horn')) addItem('dragon_horn', 1);");
    for (const g of both) ev(g, "for (let x = 17; x <= 19; x++) if (tileAt(x, 108) !== T.CAVE) changeTile(x, 108, T.CAVE)");
    A.FANGLANDS.tp(20, 116); B.FANGLANDS.tp(18, 116); tick(30);
    const calls0 = []; const offCall = A.NET.on('boss_call', m => calls0.push(m));
    B.FANGLANDS.face(18, 117); B.FANGLANDS.press('KeyE'); tick(30);
    A.NET.off('boss_call', offCall);
    const up = fangOf(A), pup = fangOf(B);
    const bothSee = !!up && !up.dead && !up.remote && !!pup && !pup.dead && pup.remote;
    // three hits each (Ann on her own dragon, Ben on his puppet: routed to Ann), then Ben's last
    ev(A, "(() => { const m = monsters.find(o => o.type === 'the_fang'); m.hp = 100; m.element = 'fire'; m.elemT = 0; })()"); tick(10);
    for (let i = 0; i < 3; i++) { hitBoss(A, 'the_fang', 10); tick(3); hitBoss(B, 'the_fang', 10); tick(6); }
    hitBoss(B, 'the_fang', 60); tick(20);
    const ben = ev(B, "({ slain: quest.fang.slain, stage: quest.stage, fang: drops.filter(d => d.id === 'fang_of_the_fang').length + countItem('fang_of_the_fang') })");
    const ann = ev(A, "({ slain: quest.fang.slain, stage: quest.stage, fang: drops.filter(d => d.id === 'fang_of_the_fang').length + countItem('fang_of_the_fang'), echoes: quest.fang.echoes })");
    const annPurse = { coins: sumNear(A, 'coins', 300), scales: sumNear(A, 'dragon_scale', 3), mithril: sumNear(A, 'mithril_bar', 1) };
    const benFirst = { coins: sumNear(B, 'coins', 1000), scales: sumNear(B, 'dragon_scale', 10), mithril: sumNear(B, 'mithril_bar', 4) };
    const down = fangOf(A);
    line('M1. Ann keeps the lair (she slew the Fang, stage 16); Ben (stage 14) sounds the horn: his boss_call wakes the one Fang on both screens; both land 3+ hits and Ben the last: Ben gets the first kill (slain, stage 15, the Fang of the Fang, 1000 coins), Ann the Echo purse (300 coins + 3 scales + 1 mithril, still stage 16, no second tooth)',
      kept && calls0.length === 1 && calls0[0].n === 'Ben' && calls0[0].id === 'the_fang' && bothSee && ben.slain && ben.stage === 15 && ben.fang === 1 && benFirst.coins === 1000 && benFirst.scales === 10 && benFirst.mithril === 4
        && ann.slain && ann.stage === 16 && ann.fang === 0 && ann.echoes === 1 && annPurse.coins === 300 && annPurse.scales === 3 && annPurse.mithril === 1 && !!down && down.dead,
      { kept, calls: calls0.map(m => m.n + ':' + m.id), up, pup, ben, benFirst, ann, annPurse, down });
  }
  // ---- M3. the keeper leaves mid-Echo: the Echo stays up on the new keeper ----
  {
    calm(); const kept = keepOver();
    ev(A, "quest.fang.restUntil = 0; quest.fang.echoUp = false; if (!countItem('dragon_horn')) addItem('dragon_horn', 1);");
    A.FANGLANDS.tp(18, 116); B.FANGLANDS.tp(21, 118); tick(20);
    A.FANGLANDS.face(18, 117); A.FANGLANDS.press('KeyE'); tick(30);
    const echoA = ev(A, "(() => { const m = monsters.find(o => o.type === 'the_fang'); return !!m && !m.dead && m.awake === true && quest.fang.echoUp === true; })()");
    const seenB = ev(B, "(() => { const m = monsters.find(o => o.type === 'the_fang'); return !!m && !m.dead && !!m.remote; })()");
    A.NET.disconnect(); wire.flush(); tick(60);
    const onB = ev(B, "(() => { const m = monsters.find(o => o.type === 'the_fang'); return { keeper: COOP.isKeeper(), alive: !!m && !m.dead, real: !!m && !m.remote, awake: !!m && m.awake === true, mine: quest.fang.slain }; })()");
    line('M3. Ann (keeper) raises the Echo and Ben sees it; Ann leaves: Ben becomes keeper and the Echo stays up on his game (awake), though his own flags say his Fang is slain',
      kept && echoA && seenB && onB.keeper && onB.alive && onB.real && onB.awake && onB.mine, { kept, echoA, seenB, onB });
    // put it back to sleep, and Ann back in
    ev(B, "(() => { const m = monsters.find(o => o.type === 'the_fang'); if (m) { m.dead = true; m.awake = false; m.respawnT = Infinity; } })()");
    A.NET.connect(); wire.flush(); tick(40);
  }
  // ---- H2. the keeper opens the menu mid-Echo (the real Room only: the world hands a quiet keeper's map to a knight who plays) ----
  // Ann keeps the lair and lands her hits; she opens the menu for 5 s while Ben swings on, and one more blow lands on her game that
  // Ben's screen never showed (a third knight's, sent as a bare hit); the world gives Ben the map; Ann comes back and never swings
  // again; Ben fells it. Ann's count came over with the map (her row's column 20, and her game's 'hand'), so she is credited, and
  // the Echo on Ben's game has lost every blow that landed on Ann's (it never heals at the hand-over).
  if (useRoom) {
    calm(); const kept = keepOver();
    ev(A, "quest.fang.restUntil = 0; quest.fang.echoUp = false; if (!countItem('dragon_horn')) addItem('dragon_horn', 1);");
    A.FANGLANDS.tp(18, 116); B.FANGLANDS.tp(21, 118); tick(20);
    A.FANGLANDS.face(18, 117); A.FANGLANDS.press('KeyE'); tick(30);
    const nid = ev(A, "(() => { const m = monsters.find(o => o.type === 'the_fang' && !o.dead && !o.remote); if (!m) return null; m.hp = 300; m.element = 'fire'; m.elemT = 0; return m.nid; })()");
    tick(10);
    for (let i = 0; i < 3; i++) { hitBoss(A, 'the_fang', 10); tick(3); hitBoss(B, 'the_fang', 10); tick(6); }
    tick(10);
    const k0 = ev(A, 'player.kills'), e0 = ev(A, 'quest.fang.echoes || 0');
    // Ben's Echo the moment Ann's hand lands (after that it is Ben's to run: a boss walking home heals as ever)
    let atHand = null; const onHandB = B.NET.on('hand', () => { atHand = ev(B, `(() => { const m = COOP.find(${JSON.stringify(nid)}); return m && !m.remote ? m.hp : null; })()`); });
    ev(A, 'paused = true');
    let unseen = false, benKeeps = null;
    for (let f = 0; f < 300; f++) {
      tick(1);
      if (f === 30) hitBoss(B, 'the_fang', 10);
      if (f === 60) { B.NET.send({ t: 'hit', nid, dmg: 7, knock: 0, bomb: false }); wire.flush(); unseen = true; }
      if (benKeeps === null && B.COOP.isKeeper()) benKeeps = f;
    }
    const annFang = ev(A, `(() => { const m = (COOP.parked || []).find(o => o.nid === ${JSON.stringify(nid)}); return m ? m.hp : null; })()`);
    const benFang = ev(B, `(() => { const m = COOP.find(${JSON.stringify(nid)}); return m && !m.remote ? { annHits: m.hitters && m.hitters.Ann ? m.hitters.Ann.n : 0 } : null; })()`);
    B.NET.off('hand', onHandB);
    ev(A, 'paused = false'); tick(20);
    hitBoss(B, 'the_fang', 500); tick(30);
    const ann = { kills: ev(A, 'player.kills') - k0, echoes: ev(A, 'quest.fang.echoes || 0') - e0 };
    const down = ev(B, `(() => { const m = COOP.find(${JSON.stringify(nid)}); return !!m && m.dead; })()`);
    line('H2. Ann keeps the lair, raises the Echo and lands 3 hits; she opens the menu for 5 s while Ben swings on: the world gives Ben the map, his Echo has her count (3) and every blow that landed on her game (one his screen never showed); Ann never swings again and Ben fells it: Ann is credited (one kill, one Echo)',
      kept && !!nid && unseen && benKeeps !== null && !!benFang && annFang !== null && atHand !== null && Math.abs(atHand - annFang) < 0.02 && benFang.annHits >= 3 && down && ann.kills === 1 && ann.echoes === 1,
      { kept, nid, benKeeps, annFang, atHand, benFang, down, ann });
    ev(B, `(() => { const m = monsters.find(o => o.type === 'the_fang'); if (m) { m.dead = true; m.awake = false; m.respawnT = Infinity; } })()`);
    tick(10);
  }
  // ---- M2. Tinkerton's lab: Ben (not the keeper) pulls the lever; both see exactly one Gnasher ----
  {
    calm();
    for (const g of both) ev(g, "if (INSTANCES.active()) INSTANCES.leave(); quest.tinker = Object.assign(quest.tinker || {}, { stage: 3, rematch: false, kills: 1, parts: {}, visited: true, friends: 4, bundle: true });");
    tick(10); ev(A, "INSTANCES.enter('tinker_lab')"); tick(30); ev(B, "INSTANCES.enter('tinker_lab')"); tick(30);
    const keeperA = A.COOP.isKeeper() && A.COOP.map() === 'tinker_lab' && B.COOP.keeper() === 'Ann';
    B.FANGLANDS.tp(21, 14); B.FANGLANDS.face(21, 15); B.FANGLANDS.press('KeyE'); tick(40);
    const nA = ev(A, "monsters.filter(m => m.type === 'gnasher' && !m.dead).length"), nB = ev(B, "monsters.filter(m => m.type === 'gnasher' && !m.dead && m.remote).length"), localB = ev(B, "monsters.filter(m => m.type === 'gnasher' && !m.remote).length");
    tick(120);
    const nA2 = ev(A, "monsters.filter(m => m.type === 'gnasher' && !m.dead).length"), nB2 = ev(B, "monsters.filter(m => m.type === 'gnasher' && !m.dead).length");
    line('M2. In the lab Ann keeps the map; Ben pulls the Arena lever: his call wakes one Gnasher on Ann\'s game, Ben sees it as a puppet, and two seconds later there is still exactly one on each side',
      keeperA && nA === 1 && nB === 1 && localB === 0 && nA2 === 1 && nB2 === 1 && ev(B, 'quest.tinker.rematch') === true, { keeperA, nA, nB, localB, nA2, nB2 });
    // R4. Ann brings it down alone (Ben's rematch purse goes nowhere without three hits): Ben's call is spent once he has
    // seen it fall, and nothing stands a new Gnasher up by itself. Ten seconds later neither game has one, and Ben's
    // rematch is false, though nobody touched the lever
    { const annKills0 = ev(A, 'quest.tinker.kills'), calls = []; const offCall = A.NET.on('boss_call', m => calls.push(m));
      ev(A, "(() => { const m = monsters.find(o => o.type === 'gnasher' && !o.dead); if (m) { m.hp = 1; hitMonster(m, 5, 0); } })()"); tick(600);
      A.NET.off('boss_call', offCall);
      const after = { upA: ev(A, "monsters.filter(m => m.type === 'gnasher' && !m.dead).length"), upB: ev(B, "monsters.filter(m => m.type === 'gnasher' && !m.dead).length"), benRematch: ev(B, 'quest.tinker.rematch'), annKills: ev(A, 'quest.tinker.kills') - annKills0, calls: calls.length };
      line('R4. Ann (keeper) brings Ben\'s lever Gnasher down alone: ten seconds later there is no Gnasher on either game, Ben\'s rematch is spent (false), no new call went out, and Ann was paid once',
        after.upA === 0 && after.upB === 0 && after.benRematch === false && after.calls === 0 && after.annKills === 1, after); }
    for (const g of both) ev(g, "if (INSTANCES.active()) INSTANCES.leave();"); tick(30);
  }
  // ---- M4. the storm: Ann has broken it and is resting; Ben has not. Ben goes in; Ann may follow; both fight ----
  {
    calm();
    ev(A, "quest.storm = { beaten: true, taught: true, bolts: 0, dodged: 0, hits: 0, kills: 1, birdHp: null, restUntil: (player.dayTime || 0) + 200 }; drops = [];");
    ev(B, "quest.storm = { beaten: false, taught: true, bolts: 0, dodged: 0, hits: 0, kills: 0, birdHp: null, restUntil: 0 }; drops = [];");
    // (the roster, who is on which map, goes out at most every 2 s)
    ev(B, "INSTANCES.enter('stormfront')"); tick(150);
    const shutAlone = ev(A, "(() => { if (INSTANCES.active()) INSTANCES.leave(); return true; })()") && ev(B, "COOP.map()") === 'stormfront';
    tick(10);
    const openForFriend = ev(A, "STORM.stormOpen()");
    ev(A, "STORM.tryIntoStorm()"); tick(40);
    const inBoth = ev(A, "INSTANCES.active()") === 'stormfront' && ev(B, "INSTANCES.active()") === 'stormfront' && B.COOP.isKeeper();
    ev(B, "(() => { const m = STORM.bird(); if (m) { STORM.setPhase(m, 'hunt'); m.phaseT = -1e5; m.boltCd = 1e5; m.hp = 100; } })()"); tick(10);
    for (let i = 0; i < 3; i++) { hitBoss(A, 'thunderbird', 10); tick(6); hitBoss(B, 'thunderbird', 10); tick(3); }
    hitBoss(B, 'thunderbird', 60); tick(30);
    const ben = { coins: sumNear(B, 'coins', 400), feather: sumNear(B, 'storm_feather'), essence: sumNear(B, 'cloud_essence', 3), beaten: ev(B, 'quest.storm.beaten') };
    const ann = { coins: sumNear(A, 'coins'), feather: sumNear(A, 'storm_feather'), essence: sumNear(A, 'cloud_essence'), kills: ev(A, 'quest.storm.kills'), helped: ev(A, "[dialog.cur, ...dialog.queue].some(l => l && /You helped bring it down\\. Your own reward is ready in/.test(l.text))") };
    line('M4. The storm: Ben (never beaten it) goes in and keeps it; Ann (beaten, still resting) may follow because a friend is fighting; both land 3+ hits, Ben the last: Ben gets 400 coins + the feather + 3 cloud essence; Ann, still resting, is told she helped and is paid nothing',
      shutAlone && openForFriend && inBoth && ben.coins === 400 && ben.feather === 1 && ben.essence === 3 && ben.beaten && ann.coins === 0 && ann.feather === 0 && ann.essence === 0 && ann.kills === 1 && ann.helped,
      { shutAlone, openForFriend, inBoth, ben, ann });
    // R1. Ben stays in the storm (its keeper, resting now); Ann steps out and straight back in three times inside her rest:
    // no bird is ever there again, and nobody is paid
    { const loops = [];
      for (let k = 0; k < 3; k++) {
        ev(A, "drops = [];"); ev(B, "drops = [];");
        ev(A, "INSTANCES.leave()"); tick(150);
        const open = ev(A, "STORM.stormOpen()"); ev(A, "STORM.tryIntoStorm()"); tick(240);
        loops.push({ open, inA: ev(A, "INSTANCES.active()"), birdA: ev(A, "!!STORM.bird()"), birdB: ev(B, "!!STORM.bird()"), annCoins: sumNear(A, 'coins'), benCoins: sumNear(B, 'coins'), annKills: ev(A, 'quest.storm.kills'), benKills: ev(B, 'quest.storm.kills') });
      }
      line('R1. Ann (resting) steps out of the storm and back in three times while Ben keeps it: the fallen bird never comes back on either game, and nobody is paid again',
        loops.every(l => l.inA === 'stormfront' && !l.birdA && !l.birdB && l.annCoins === 0 && l.benCoins === 0 && l.annKills === 1 && l.benKills === 1), loops); }
    // M4b. Ann's own rest runs out while the storm Ben keeps is still gathering from its last fall: walking in, she is told
    // how long (boss_wait); once the storm has gathered (the keeper's 300 s pass), walking in raises a bird and she is paid
    { ev(A, "quest.storm.restUntil = player.dayTime - 1; notice = null; INSTANCES.leave();"); tick(60);
      ev(A, "STORM.tryIntoStorm()"); tick(240);
      const waited = { bird: ev(B, "!!STORM.bird()"), notice: ev(A, "notice && notice.text") };
      ev(B, "COOP.state.restAt.stormfront -= 301"); ev(A, "INSTANCES.leave()"); tick(60); ev(A, "STORM.tryIntoStorm()"); tick(240);
      const up = { a: ev(A, "!!STORM.bird()"), b: ev(B, "!!STORM.bird()") };
      ev(B, "(() => { const m = STORM.bird(); if (m) { STORM.setPhase(m, 'hunt'); m.phaseT = -1e5; m.boltCd = 1e5; m.hp = 40; } })()"); tick(10);
      // (a bird left alone a moment heals a point, and Ann's own last blow lays her puppet down for a moment before Ben's
      // game agrees: so she swings until the keeper's bird, not her puppet, is down)
      for (let i = 0; i < 60 && ev(B, "!!STORM.bird()"); i++) { hitBoss(A, 'thunderbird', 10); tick(6); }
      tick(30);
      const annPaid = { coins: sumNear(A, 'coins', 200), essence: sumNear(A, 'cloud_essence', 1), kills: ev(A, 'quest.storm.kills') };
      line('M4b. Ann, rested, walks into the storm Ben keeps while it still gathers from its last fall: no bird, and she reads Ready in m:ss; once it has gathered, walking in raises one bird on both games and her kill pays 200 coins + 1 essence',
        !waited.bird && /The storm is gathering\. Ready in \d+:\d\d\./.test(waited.notice || '') && up.a && up.b && annPaid.coins === 200 && annPaid.essence === 1 && annPaid.kills === 2,
        { waited, up, annPaid }); }
    for (const g of both) ev(g, "if (INSTANCES.active()) INSTANCES.leave();"); tick(30);
  }
  // ---- M5. the War Shed: Ann (keeper) broke the square's beast; Ben (stage 9, sent to the shed) fights his first there ----
  {
    calm();
    ev(A, "quest.hollowford = Object.assign(quest.hollowford || {}, { beastKilled: true, rewarded: true, freed: true, shedUp: false, shedRestUntil: 0, shedKills: 0, wreckDue: false, toldShed: false }); quest.stage = Math.max(quest.stage, 11); drops = [];");
    ev(B, "quest.hollowford = Object.assign(quest.hollowford || {}, { beastKilled: false, rewarded: false, freed: false, wreck: null, shedUp: false, shedRestUntil: 0, shedKills: 0, wreckDue: false, toldShed: true }); quest.stage = 9; drops = [];");
    const wrecksA0 = ev(A, "(() => { let n = 0; for (let i = 0; i < map.length; i++) if (map[i] === T.BEAST_WRECK) n++; return n; })()");
    ev(A, "INSTANCES.enter('war_shed')"); tick(30); ev(B, "INSTANCES.enter('war_shed')"); tick(30);
    const keeperA = A.COOP.isKeeper() && A.COOP.map() === 'war_shed';
    B.FANGLANDS.tp(14, 8); B.FANGLANDS.face(14, 7); B.FANGLANDS.press('KeyE'); tick(40);
    const upA = ev(A, "monsters.filter(m => m.type === 'barrelbeast' && !m.dead).length"), upB = ev(B, "monsters.filter(m => m.type === 'barrelbeast' && !m.dead && m.remote).length");
    ev(A, "(() => { const m = monsters.find(o => o.type === 'barrelbeast' && !o.dead); if (m) m.hp = 100; })()"); tick(10);
    for (let i = 0; i < 3; i++) { hitBoss(B, 'barrelbeast', 10); tick(6); hitBoss(A, 'barrelbeast', 10); tick(3); }
    hitBoss(A, 'barrelbeast', 60); tick(30);
    const ben = ev(B, "({ stage: quest.stage, killed: quest.hollowford.beastKilled, due: quest.hollowford.wreckDue })");
    const annIn = ev(A, "({ due: quest.hollowford.wreckDue, kills: quest.hollowford.shedKills })");
    for (const g of both) ev(g, "if (INSTANCES.active()) INSTANCES.leave();"); tick(20);
    const wrecksA = ev(A, "(() => { let n = 0; for (let i = 0; i < map.length; i++) if (map[i] === T.BEAST_WRECK) n++; return n; })()");
    const benWreck = ev(B, "(() => { const w = quest.hollowford.wreck; return !!w && map[idx(w[0], w[1])] === T.BEAST_WRECK && !quest.hollowford.wreckDue; })()");
    line('M5. The War Shed: Ann keeps it; Ben (stage 9, told about the shed) spins the valve and his call wakes one beast on both screens; both land 3+ hits, Ann the last: Ben\'s first kill moves him to stage 10 with his wreck due and rolled out on leaving; Ann\'s kill is a rematch with no wreck',
      keeperA && upA === 1 && upB === 1 && ben.stage >= 10 && ben.killed && ben.due && !annIn.due && annIn.kills === 1 && wrecksA === wrecksA0 && benWreck,
      { keeperA, upA, upB, ben, annIn, wrecks: [wrecksA0, wrecksA], benWreck });
  }
  // ---- X2/R3. the War Shed's rest holds online: Ann (keeper) still rests; Ben (rested) spins the valve and never swings ----
  {
    calm();
    for (const g of both) ev(g, "if (INSTANCES.active()) INSTANCES.leave();"); tick(30);
    ev(A, "INSTANCES.enter('war_shed')"); tick(30); ev(B, "INSTANCES.enter('war_shed')"); tick(30);
    const keeperA = A.COOP.isKeeper() && A.COOP.map() === 'war_shed' && B.COOP.keeper() === 'Ann';
    // (the shed's own rest from M5's beast is over: the keeper's memory of that fall is cleared)
    ev(A, "Object.assign(quest.hollowford, { beastKilled: true, shedUp: false, shedKills: 0, shedRestUntil: player.dayTime + 290 }); drops = []; COOP.state.restAt = {};");
    ev(B, "Object.assign(quest.hollowford, { beastKilled: true, shedUp: false, shedRestUntil: 0, toldShed: false }); quest.stage = Math.max(quest.stage, 11); drops = [];");
    const loops = []; let risen = 0;
    const watch = () => { const n = ev(A, "monsters.filter(m => m.type === 'barrelbeast' && !m.dead).length"); if (n && !watch.up) risen++; watch.up = n > 0; };
    for (let k = 0; k < 3; k++) {
      B.FANGLANDS.tp(14, 8); B.FANGLANDS.face(14, 7); ev(B, "dialog.queue.length = 0; dialog.cur = null;"); B.FANGLANDS.press('KeyE'); tick(60, watch);
      const upA = ev(A, "monsters.filter(m => m.type === 'barrelbeast' && !m.dead).length"), valve = ev(B, "[dialog.cur, ...dialog.queue].filter(Boolean).map(l => l.text).join(' | ')");
      for (let i = 0; i < 4; i++) { hitBoss(A, 'barrelbeast', 120); tick(6, watch); }
      tick(240, watch);
      loops.push({ upA, annDrops: ev(A, "drops.length"), annKills: ev(A, "quest.hollowford.shedKills"), benUp: ev(B, "quest.hollowford.shedUp"), benRest: ev(B, "Math.round(quest.hollowford.shedRestUntil - player.dayTime)"), valve });
    }
    tick(60 * 20, watch);
    line('X2/R3. In the War Shed Ann (keeper) still rests; Ben (rested) spins the valve and never swings, three times: one beast rises in all, Ann is paid nothing for it, Ben\'s call is spent when it falls (his own rest starts), his next spins are refused with Ready in m:ss, and nothing rises in the next 20 s',
      keeperA && risen === 1 && loops[0].upA === 1 && loops.every(l => l.annDrops === 0 && l.annKills === 0 && !l.benUp && l.benRest >= 280) && /Ready in \d+:\d\d\./.test(loops[1].valve || '') && /Ready in \d+:\d\d\./.test(loops[2].valve || ''),
      { keeperA, risen, loops });
    for (const g of both) ev(g, "if (INSTANCES.active()) INSTANCES.leave();"); tick(30);
  }
  // ---- X1. the Echo's rest holds online: Ann (keeper) still rests; Ben (rested) sounds the horn once and never swings ----
  {
    calm(); const kept = keepOver();
    ev(A, "Object.assign(quest.fang, { slain: true, echoUp: false, restUntil: player.dayTime + 590 }); quest.stage = 16; drops = []; COOP.state.restAt = {}; COOP.state.calls = {};");
    ev(B, "Object.assign(quest.fang, { slain: true, summoned: true, echoUp: false, restUntil: 0 }); quest.stage = 16; drops = []; if (!countItem('dragon_horn')) addItem('dragon_horn', 1);");
    for (const g of both) ev(g, "{ const m = monsters.find(o => o.type === 'the_fang' && !o.remote); if (m) { m.dead = true; m.awake = false; m.respawnT = Infinity; } }");
    A.FANGLANDS.tp(20, 116); B.FANGLANDS.tp(18, 116); tick(30);
    let risen = 0; const watch = () => { const up = ev(A, "monsters.some(o => o.type === 'the_fang' && !o.dead)"); if (up && !watch.up) risen++; watch.up = up; };
    B.FANGLANDS.face(18, 117); ev(B, "dialog.queue.length = 0; dialog.cur = null;"); B.FANGLANDS.press('KeyE'); tick(30, watch);
    const upA = ev(A, "monsters.some(o => o.type === 'the_fang' && !o.dead)");
    ev(A, "(() => { const m = monsters.find(o => o.type === 'the_fang' && !o.dead); if (m) m.hp = 60; })()"); tick(5, watch);
    for (let i = 0; i < 3; i++) { hitBoss(A, 'the_fang', 25); tick(6, watch); }
    tick(240, watch);
    const ann = ev(A, "({ coins: drops.filter(d => d.id === 'coins').length, scales: drops.filter(d => d.id === 'dragon_scale').length, echoes: quest.fang.echoes, rest: Math.round(quest.fang.restUntil - player.dayTime) })");
    const ben = ev(B, "({ echoUp: quest.fang.echoUp, rest: Math.round(quest.fang.restUntil - player.dayTime), coins: drops.filter(d => d.id === 'coins').length })");
    tick(60 * 45, watch);
    // and Ben, his own rest over, sounds it again while the dragon still rests on Ann's map: told how long, nothing rises
    ev(B, "quest.fang.restUntil = 0; dialog.queue.length = 0; dialog.cur = null;"); B.FANGLANDS.face(18, 117); B.FANGLANDS.press('KeyE'); tick(60, watch);
    const told = ev(B, "[dialog.cur, ...dialog.queue].some(l => l && /still cooling.*Ready in \\d+:\\d\\d\\./.test(l.text)) && !quest.fang.echoUp");
    line('X1. Ann (keeper) still rests from her last Echo; Ben (rested) sounds the horn once and never swings; Ann kills it alone: one Echo rises in 46 s, Ann is paid nothing, Ben\'s Echo call is spent and his circle rests 600 s; his horn while the dragon still rests on Ann\'s map is told Ready in m:ss',
      kept && upA && risen === 1 && ann.coins === 0 && ann.scales === 0 && ann.rest >= 580 && !ben.echoUp && ben.rest >= 590 && ben.coins === 0 && told,
      { kept, upA, risen, ann, ben, told });
    ev(B, "quest.fang.restUntil = 0;");
  }
  // ---- H1. a handoff hands the square's Barrelbeast to a knight who broke his own: once down it stays down ----
  {
    calm(); const kept = keepOver();
    ev(A, "quest.hollowford = Object.assign(quest.hollowford || {}, { beastKilled: false }); quest.stage = Math.max(quest.stage, 11);");
    ev(B, "quest.hollowford = Object.assign(quest.hollowford || {}, { beastKilled: true, shedRestUntil: 0 }); quest.stage = Math.max(quest.stage, 11); drops = [];");
    ev(A, "(() => { const m = monsters.find(o => o.type === 'barrelbeast' && !o.shed); if (m) { m.dead = false; m.hp = m.maxHp; m.x = m.home.x; m.y = m.home.y; m.respawnT = 0; } })()");
    A.FANGLANDS.tp(138, 84); B.FANGLANDS.tp(142, 84); tick(40);
    const seenB = ev(B, "monsters.some(o => o.type === 'barrelbeast' && o.remote && !o.dead)");
    A.NET.disconnect(); wire.flush(); tick(60);
    const adopted = ev(B, "(() => { const m = monsters.find(o => o.type === 'barrelbeast' && !o.shed); return { keeper: COOP.isKeeper(), alive: !!m && !m.dead, awake: !!m && m.awake === true }; })()");
    ev(B, "(() => { const m = monsters.find(o => o.type === 'barrelbeast' && !o.dead); if (m) { m.hp = 1; m.stunT = 0; hitMonster(m, 5, 0); } })()"); tick(30);
    const after = ev(B, "(() => { const m = monsters.find(o => o.type === 'barrelbeast' && !o.shed); return { dead: !!m && m.dead, awake: m && m.awake, respawnT: m && m.respawnT }; })()");
    ev(B, "(() => { const m = monsters.find(o => o.type === 'barrelbeast' && !o.shed); if (m) m.respawnT = Math.min(m.respawnT, 0.05); })()"); tick(120);
    const later = ev(B, "(() => { const m = monsters.find(o => o.type === 'barrelbeast' && !o.shed); return { dead: !!m && m.dead, respawnT: m && m.respawnT }; })()");
    line('H1. Ann keeps the overworld with her square Barrelbeast standing; Ben (who broke his own) sees it; Ann leaves: Ben adopts it awake, kills it, and it stays down for good (awake false, respawnT Infinity, still down after the timer would have run)',
      kept && seenB && adopted.keeper && adopted.alive && adopted.awake && after.dead && after.awake === false && after.respawnT === Infinity && later.dead && later.respawnT === Infinity,
      { kept, seenB, adopted, after, later });
    A.NET.connect(); wire.flush(); tick(40);
  }

  // ---- --sim: Deepholm switched to 'world' (docs/ONLINE.md, "The shared world", Stage 2) ----
  if (useSim) {
    line('S0. with the world\'s copy wired in and every map on keeper, no copy was ever built and nothing went to sim_log', Object.keys(simHost.bootTimes).length === 0 && simBook.recent(5).length === 0, { boots: simHost.bootTimes, log: simBook.recent(5) });
    room.setSim({ move: 'observe', maps: { deepholm: 'world' } }, 'parent page');
    for (const g of both) if (!g.NET.online()) { g.NET.connect(); wire.flush(); }
    const ev = (g, code) => vm.runInContext(code, g);
    ev(A, "(() => { INSTANCES.enter('deepholm'); const m = monsters.find(o => o.type === 'dwarf_guard'); player.x = m.home.x - 30; player.y = m.home.y + 60; window.__peace = true; })()"); tick(4);
    ev(B, "(() => { INSTANCES.enter('deepholm'); const m = monsters.find(o => o.type === 'dwarf_guard'); player.x = m.home.x + 30; player.y = m.home.y + 60; window.__peace = true; })()");
    tick(150);
    const copy = simHost.copies.get('deepholm'), g = copy && copy.api.peek;
    const kA = ev(A, 'COOP.keeper()'), kB = ev(B, 'COOP.keeper()');
    const real = g ? JSON.stringify(g('monsters').filter(m => !m.dead).map(m => m.nid).sort()) : null;
    const pA = JSON.stringify(ev(A, 'monsters.filter(m => m.remote && !m.dead).map(m => m.nid).sort()')), pB = JSON.stringify(ev(B, 'monsters.filter(m => m.remote && !m.dead).map(m => m.nid).sort()'));
    line('S1. Deepholm switched to world: both games are told @world:deepholm keeps it and show exactly the copy\'s monsters', kA === '@world:deepholm' && kB === '@world:deepholm' && !!real && pA === real && pB === real, { kA, kB, real, pA, pB });
    const m = g && g('monsters').find(o => o.type === 'dwarf_guard' && !o.dead), hp0 = m && m.hp;
    if (m) { B.NET.send({ t: 'hit', nid: m.nid, dmg: 7, knock: 0, bomb: false }); wire.flush(); tick(12); }
    line('S2. Ben\'s hit on a puppet goes to the world\'s copy', !!m && m.hp === hp0 - 7, { nid: m && m.nid, hp0, hp: m && m.hp });
    room.setSim({ move: 'observe', maps: { deepholm: 'keeper' } }, 'parent page'); tick(20);
    const back = room.keeperOf('deepholm') && room.keeperOf('deepholm').name;
    line('S3. switched back: a knight\'s game keeps Deepholm again (Ann, longest there), both games agree, and sim_log has both changes', back === 'Ann' && ev(A, 'COOP.isKeeper()') && ev(B, 'COOP.keeper()') === 'Ann' && simBook.recent(2).map(r => r.to).join() === 'keeper,world', { back, log: simBook.recent(2) });
  }

  const failed = results.filter(r => !r).length;
  console.log((failed ? `${failed} FAILED of ${results.length}` : `ALL ${results.length} PASS`) + ` (${useRoom ? (process.env.MMO_ROOM || 'online/src/room.js') + (useSim ? ' with the world\'s copy' : '') : 'FakeWorld'}, ${frames} frames, ${Date.now() - t0} ms)`);
  process.exit(failed ? 1 : 0);
}
// Run as a script: the scenarios above. Required as a module (tools/mmo-sim-admin.js, tools/mmo-sim-party.js): the
// plumbing only, so every scenario file drives the same fake wire, the same game contexts and the same Room loader.
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { FakeWorld, FakeStore, Wire, makeContext, loadRoom, mulberry32, contractRoll, FRAME_MS, ROOT };
