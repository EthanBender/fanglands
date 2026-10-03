// ============================================================================
// THE ROOM — who is on which map, who keeps its monsters, and where every message goes
// This is the whole routing logic of Fanglands Online as a plain class: no Cloudflare APIs, no timers of
// its own. The World (world.js) drives it with real WebSockets and a SqlStore; tools/mmo-sim*.js and the unit
// tests drive it with in-memory sockets, a fake clock and a MemoryStore. docs/ONLINE.md is the contract it keeps to.
//
//   const room = new Room({ now: () => ms, log: (name, text, at) => {}, wake: ms => {}, store, random });
//   room.join(sock, name)      sock is { send(str), close(code, reason), attach?(state) }
//   room.message(sock, str)    one JSON text frame from that socket
//   room.leave(sock)           the socket is gone
//   room.online()              [{n, map, region, lv, since, role}]
//   room.tick()                fire whatever is due: gift timeouts, a held-back roster, a party running out
//   room.setRole(name)         the parent page changed a role: re-read it, tell that knight and the roster
//   room.muteChanged(name)     the parent page changed a mute: re-read it, tell that knight
//   room.settleLogins()        after a wake's restores: every login row no socket carries any more is closed
//   room.loginOf(name)         the open login row of a knight on line: {id, started} or null
//   room.store                 where roles, mutes, bans, parties, prizes, logins and finished trades live (store.js)
//
// Timers: the room never calls setTimeout itself. When something becomes due it calls wake(ms) once, and
// the host calls tick() at that time (the World uses a Durable Object alarm, which survives hibernation).
// With no wake option it falls back to setTimeout so a quick script works out of the box.
//
// Hibernation: a knight's state is handed to sock.attach(state) whenever it changes, and restore(sock,
// state) rebuilds the knight from it when the World wakes up. Roles, mutes, bans, parties, crackers and prizes
// are in the store, never in memory alone: every wake builds a new Room, which loads the live parties from the
// store and reads each knight's role from it again.
//
// Logins (docs/ONLINE.md, "Accounts"): every socket a knight opens is one row in the store's logins, opened at join and
// closed in remove(), which every way out goes through: the socket closing, the same knight logging in elsewhere, a
// kick, a ban, a new secret word, the world full of strikes. The row's id rides the attachment, so a nap keeps it open;
// a row that no socket carries after a wake (the world was restarted under it) ends at the last time it was heard from.
//
// Admins (docs/ONLINE.md, "Admins and drop parties"): only the parent page makes one. Every admin message reads
// the sender's role from the store, fresh, before it does anything; the socket's memory is never the lock.
//
// Trades (docs/ONLINE.md, "Trading"): the Room holds both offers and is the only truth about them. It opens a trade
// only between two knights on one map within a few tiles, un-accepts both on any change, and moves nothing until both
// knights accepted and then confirmed the very same offers. A finished trade is a row in the store, re-sent after every
// welcome until each side's game says it is in its save, so nothing is lost or doubled. An open trade lives in memory
// only: a disconnect, a map change, a walk away, a fall or a nap ends it, and then nothing moves.
// ============================================================================

import { cleanChat } from './filter.js';
import { MemoryStore, ALWAYS } from './store.js';
import {
  TILE, HAT_CHOICES, PARTY_LIFE, PRIZE_KEEP, LIGHT_RANGE, MAX_LIVE_CRACKERS, FUSE_MIN, FUSE_MAX, ID_RE,
  rollCracker, crackerId, parseCrackerId, checkTable, checkSpots, cryptoRandom, commas,
} from './party.js';

export { MemoryStore, ALWAYS };
export { TILE, HAT_CHOICES, PARTY_LIFE, PRIZE_KEEP, LIGHT_RANGE, MAX_LIVE_CRACKERS, FUSE_MIN, FUSE_MAX } from './party.js';

// The caps from the contract tables. rate is messages per second; a burst of twice that is allowed so a
// jittery connection sending at exactly the cap is not punished. hello is allowed once and never refills.
// The cap runs before anything else, the admin check included, so a knight hammering admin messages is dropped
// like any other.
export const CAPS = {
  hello: { rate: 0, burst: 1 },
  p: { rate: 8 },
  chat: { rate: 1 / 1.5 },
  mon: { rate: 8 },
  hit: { rate: 20 },
  gift: { rate: 1 },
  mute: { rate: 1, burst: 3 },
  unmute: { rate: 1, burst: 3 },
  kick: { rate: 1, burst: 3 },
  ban: { rate: 1, burst: 3 },
  unban: { rate: 1, burst: 3 },
  modlist: { rate: 1, burst: 2 },
  spawn: { rate: 1, burst: 3 },
  spawn_clear: { rate: 1, burst: 2 },
  party: { rate: 0.2, burst: 2 },
  party_end: { rate: 1, burst: 2 },
  light: { rate: 4, burst: 8 },
  claim: { rate: 10, burst: 50 },
  trade_ask: { rate: 0.5, burst: 3 },
  trade_answer: { rate: 2, burst: 4 },
  trade_offer: { rate: 5, burst: 10 },
  trade_accept: { rate: 4, burst: 8 },
  trade_confirm: { rate: 4, burst: 8 },
  trade_full: { rate: 2, burst: 4 },
  trade_close: { rate: 2, burst: 4 },
  trade_ack: { rate: 10, burst: 50 },
  boss_call: { rate: 0.5, burst: 2 },
};
for (const c of Object.values(CAPS)) if (!c.burst) c.burst = Math.max(2, Math.round(c.rate * 2));

export const ROSTER_EVERY = 2000;      // a changed roster goes out at most this often (join/leave go at once)
// A keeper that streams no monsters for this long while others share its map (paused, on the title screen, a
// sleeping tab) hands the map to the next knight; it is eligible again once that knight leaves.
export const KEEPER_STALE = 3000;
// A knight whose game sends no presence for this long (a locked phone, a tab in the background: a playing game sends at
// least one a second) is never chosen to keep a map while someone who is playing is there.
export const PRESENCE_STALE = 3500;
export const GIFT_WAIT = 10000;        // no answer to a gift within this: it comes back to the sender
// How long each mute lasts; 'always' means until an admin (or the parent page) turns chat back on.
export const MUTE_SPANS = { '5m': 5 * 60 * 1000, '1h': 3600 * 1000, '1d': 24 * 3600 * 1000, always: ALWAYS };
export const SPAWN_MAX = 20;           // monsters in one spawn message
export const KICK_TEXT = 'An admin sent you out of the world. You can come back in.';
// Trading (docs/ONLINE.md, "Trading")
export const TRADE_NEAR = 5 * TILE;           // px: ask, and say yes, within five tiles of each other
export const TRADE_LEAVE = 8 * TILE;          // px: a knight who walks more than eight tiles away ends the trade
export const TRADE_ASK_LIFE = 30000;          // an ask nobody answers is over after this
export const TRADE_ITEMS = 12;                // different things in one offer
export const TRADE_QTY_MAX = 1000000000;      // of one thing in one offer
export const TRADE_KEEP = PRIZE_KEEP;         // a finished trade is re-sent after welcome for 7 days until each side acks it
const STRIKES_FORGIVEN_AFTER = 10000;  // a socket that behaves for this long gets its warning back
export const SEEN_EVERY = 60000;       // a login's "last heard from" is written at most this often
const MAX_FRAME = 64 * 1024;           // bigger than any honest message (a mon list is a few KB)
const MAX_P = 4096;                    // presence is small; anything bigger is junk
const OVERWORLD = 'over';
const MOD_ACTS = ['mute', 'unmute', 'kick', 'ban', 'unban'];

const low = s => String(s).toLowerCase();
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
// Whole seconds of mute left, rounded up, or -1 for "until an admin unmutes" (the contract's muted.left).
export const leftOf = (until, now) => until >= ALWAYS ? -1 : Math.max(0, Math.ceil((until - now) / 1000));
const byN = (a, b) => { const x = a.n.toLowerCase(), y = b.n.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; };

export class Room {
  constructor(opts = {}) {
    this.now = opts.now || (() => Date.now());
    this.log = opts.log || (() => {});
    this.filter = opts.filter || cleanChat;
    this.max = opts.max || 50;
    this.wake = opts.wake || (ms => { const t = setTimeout(() => this.tick(), ms); if (t && t.unref) t.unref(); });
    this.store = opts.store || new MemoryStore();
    this.random = typeof opts.random === 'function' ? opts.random : cryptoRandom;
    this.knights = new Map();   // sock -> knight
    this.byName = new Map();    // lower-case name -> knight
    this.maps = new Map();      // map name -> { members: Set<knight>, keeper: knight|null }
    this.gifts = new Map();     // gid -> { gid, from, to (lower-case names), id, qty, due }
    this.parties = new Map();   // pid -> { id, at, by, map, region, hat, table, expires, crackers: Map k -> {k, tx, ty, litBy} }
    this.trades = new Map();    // id -> an open trade (see openTrade)
    this.nextGid = 1;
    this.nextTradeId = 1;
    this.spawnSeq = 0;
    this.rosterAt = -Infinity;
    this.rosterDirty = false;
    this.wakeAt = null;
    this.loadParties();
    this.arm();
  }

  // Every wake builds a new Room: the parties that were running when the world fell asleep come back from the store.
  loadParties() {
    for (const p of this.store.liveParties(this.now())) {
      const crackers = new Map(p.crackers.map(c => [c.k, { k: c.k, tx: c.tx, ty: c.ty, litBy: c.litBy || null }]));
      // every cracker lit but the party never marked over (the world stopped in between), or a prize list that no
      // longer reads as one: the party is over now
      const table = checkTable(p.table);
      if (!table || !HAT_CHOICES.includes(p.hat) || !Array.from(crackers.values()).some(c => !c.litBy)) { this.store.endParty(p.id); continue; }
      this.parties.set(p.id, { id: p.id, at: p.at, by: p.by, map: p.map, region: p.region || '', hat: p.hat, table, expires: p.expires, crackers });
    }
  }

  // ---------- joining and leaving ----------
  join(sock, name) {
    if (this.knights.has(sock)) return;
    // the World already refuses a banned knight's login; this is the lock behind it (and the simulations' only one)
    const acc = this.store.account(name);
    if (acc && acc.banned) return this.refuseBanned(sock);
    const lc = low(name);
    const old = this.byName.get(lc);
    // one socket per knight: the newest login wins, the old screen is told why (an error it can act on,
    // then a plain close, so the wire does not treat it as a dropped line and fight the new device for the knight)
    if (old) { this.send(old.sock, { t: 'error', code: 'elsewhere', text: 'this knight logged in somewhere else' }); this.drop(old, 4000, 'logged in elsewhere'); }
    if (this.byName.size >= this.max) {
      this.send(sock, { t: 'error', code: 'full', text: 'the world is full right now, try again in a bit' });
      try { sock.close(4004, 'full'); } catch (e) { }
      return;
    }
    const k = this.makeKnight(sock, { name: String(name), since: this.now() });
    k.role = acc ? acc.role : 'player';   // a name with no account (tests, simulations) is a plain player
    k.loginId = this.loginStart(k.lc, k.since);
    this.attach(k);
  }

  refuseBanned(sock) {
    this.send(sock, { t: 'error', code: 'banned', text: 'this knight is banned' });
    try { sock.close(4003, 'banned'); } catch (e) { }
  }

  // Rebuilds a knight from the state attach() handed out, without telling anyone: the others already know.
  // The role comes from the store again, never from the attachment.
  restore(sock, state) {
    if (!state || !state.name || this.knights.has(sock)) return;
    const acc = this.store.account(state.name);
    if (acc && acc.banned) return this.refuseBanned(sock);
    const lc = low(state.name);
    const old = this.byName.get(lc);
    if (old) { if (old.since <= state.since) { try { sock.close(4000, 'logged in elsewhere'); } catch (e) { } return; } this.drop(old, 4000, 'logged in elsewhere'); }
    const k = this.makeKnight(sock, state);
    k.role = acc ? acc.role : 'player';
    // the login this socket has carried since it joined; a socket from before logins were kept starts one at its join time
    k.loginId = Number.isInteger(state.loginId) ? state.loginId : this.loginStart(k.lc, k.since);
    if (k.hello && k.map) this.enterMap(k, k.map, { quiet: true, silent: true, at: k.mapAt });
    for (const g of state.gifts || []) {
      if (!g || g.gid == null) continue;
      this.gifts.set(g.gid, { gid: g.gid, from: lc, to: low(g.to), id: g.id, qty: g.qty, due: g.due });
      k.gifts.add(g.gid);
      if (typeof g.gid === 'number' && g.gid >= this.nextGid) this.nextGid = g.gid + 1;
    }
    this.arm();
  }

  makeKnight(sock, s) {
    const k = {
      sock, name: s.name, lc: low(s.name), since: s.since || this.now(),
      hello: !!s.hello, map: s.map || null, mapAt: s.mapAt || s.since || this.now(), region: s.region || '', lv: s.lv || 0,
      role: 'player', x: null, y: null,   // x, y: the last presence, for party and cracker range checks (not kept over a nap)
      loginId: null, seenAt: 0,           // the store's logins row for this socket, and when its "last heard from" was written
      last: null, buckets: {}, strikes: 0, strikeAt: 0, gifts: new Set(),
      dead: false, trade: null, ask: null,   // trading: the open trade, and this knight's own unanswered ask { to (lower case), due }
    };
    this.knights.set(sock, k);
    this.byName.set(k.lc, k);
    return k;
  }

  leave(sock) {
    const k = this.knights.get(sock);
    if (k) this.remove(k);
  }

  // Throws a knight out: an error first so the screen can say why, then the close. kicked closes with 4005 and
  // banned with 4003 (the wire reconnects after neither); anything else with 4000.
  kick(name, code, text, extra) {
    const k = this.byName.get(low(name));
    if (!k) return false;
    this.send(k.sock, Object.assign({ t: 'error', code, text }, extra || {}));
    this.drop(k, code === 'kicked' ? 4005 : code === 'banned' ? 4003 : 4000, String(text || code).slice(0, 120));
    return true;
  }

  drop(k, code, reason) {
    this.remove(k);
    try { k.sock.close(code, reason); } catch (e) { }
  }

  remove(k) {
    if (this.knights.get(k.sock) !== k) return;
    this.knights.delete(k.sock);
    this.loginEnd(k);
    if (this.byName.get(k.lc) === k) this.byName.delete(k.lc);
    // an open trade ends with nothing moved; this knight's own ask is withdrawn, and asks put to it are answered 'offline'
    if (k.trade) this.cancelTrade(k.trade, 'left', k);
    this.dropAsk(k);
    for (const o of this.knights.values()) if (o.ask && o.ask.to === k.lc) { o.ask = null; this.send(o.sock, { t: 'trade_no', code: 'offline', n: k.name }); }
    if (k.hello && k.map) this.leaveMap(k);
    // gifts on their way to this knight go straight back; gifts this knight sent have nowhere to go
    for (const g of Array.from(this.gifts.values())) {
      if (g.to === k.lc) this.settleGift(g, 'gift_back');
      else if (g.from === k.lc) this.gifts.delete(g.gid);
    }
    if (k.hello) this.rosterNow();
    this.arm();
  }

  // ---------- messages ----------
  message(sock, str) {
    const k = this.knights.get(sock);
    if (!k || typeof str !== 'string') return;
    this.heard(k);
    if (str.length > MAX_FRAME) return this.strike(k, CAPS.p);
    let m;
    try { m = JSON.parse(str); } catch (e) { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    const cap = CAPS[m.t];
    if (cap && !this.allow(k, m.t, cap)) return;
    switch (m.t) {
      case 'hello': return this.onHello(k, m);
      case 'p': return this.onPresence(k, m, str);
      case 'chat': return this.onChat(k, m);
      case 'mon': return this.onMon(k, m);
      case 'hit': return this.onHit(k, m);
      case 'kill': return this.onToKnight(k, m, 'kill', ['nid', 'type', 'x', 'y']);
      case 'hurt': return this.onToKnight(k, m, 'hurt', ['dmg', 'x', 'y']);
      case 'gift': return this.onGift(k, m);
      case 'gift_ok': return this.onGiftAnswer(k, m, 'gift_ok');
      case 'gift_no': return this.onGiftAnswer(k, m, 'gift_back');
      case 'mute': case 'unmute': case 'kick': case 'ban': case 'unban': return this.onMod(k, m);
      case 'modlist': return this.onModlist(k);
      case 'spawn': return this.onSpawn(k, m);
      case 'spawn_clear': return this.onSpawnClear(k);
      case 'party': return this.onParty(k, m);
      case 'party_end': return this.onPartyEnd(k);
      case 'light': return this.onLight(k, m);
      case 'claim': return this.onClaim(k, m);
      case 'trade_ask': return this.onTradeAsk(k, m);
      case 'trade_answer': return this.onTradeAnswer(k, m);
      case 'trade_offer': return this.onTradeOffer(k, m);
      case 'trade_accept': return this.onTradeAccept(k, m);
      case 'trade_confirm': return this.onTradeConfirm(k, m);
      case 'trade_full': return this.onTradeFull(k, m);
      case 'trade_close': return this.onTradeClose(k, m);
      case 'trade_ack': return this.onTradeAck(k, m);
      case 'boss_call': return this.onBossCall(k, m);
      case 'ping': return this.send(sock, { t: 'pong' });   // the real server answers this without waking; the sim lands here
      default: return;                                       // unknown t: ignored, as the contract says
    }
  }

  onHello(k, m) {
    k.hello = true;
    // a save always records the overworld, so a fresh login stands on it until the first presence says otherwise
    k.map = (typeof m.map === 'string' && m.map) ? m.map.slice(0, 64) : OVERWORLD;
    const acc = this.store.account(k.name);
    k.role = acc ? acc.role : 'player';
    this.enterMap(k, k.map, { quiet: true });
    const keeper = this.keeperOf(k.map);
    this.send(k.sock, { t: 'welcome', me: k.name, at: this.now(), keeper: keeper ? keeper.name : null, role: k.role });
    this.attach(k);
    this.rosterNow();
    // after welcome and the roster, in this order: a mute still running, the live parties on this map, and every
    // prize this knight won in the last 7 days that its game never said it has
    const now = this.now();
    if (acc && acc.mutedUntil > now) this.send(k.sock, { t: 'muted', left: leftOf(acc.mutedUntil, now) });
    this.sendPartiesOn(k, k.map);
    for (const w of this.store.unclaimed(k.lc, now - PRIZE_KEEP)) this.send(k.sock, { t: 'prize', id: w.id, reward: w.reward });
    // and every finished trade this knight's game never said it has (id null: the window is long gone)
    for (const r of this.store.unackedTrades(k.lc, now - TRADE_KEEP)) this.send(k.sock, { t: 'trade_done', tid: r.tid, id: null, with: r.with, gave: r.gave, got: r.got });
    this.arm();
  }

  onPresence(k, m, str) {
    if (!k.hello) return;
    k.pAt = this.now();
    if (str.length > MAX_P) return this.strike(k, CAPS.p);
    const map = (typeof m.map === 'string' && m.map) ? m.map.slice(0, 64) : k.map;
    let changed = false;
    if (map !== k.map) { this.moveMap(k, map); changed = true; }
    if (typeof m.region === 'string' && m.region.slice(0, 40) !== k.region) { k.region = m.region.slice(0, 40); changed = true; }
    if (typeof m.lv === 'number' && m.lv !== k.lv) { k.lv = m.lv; changed = true; }
    // where the knight stands, for the party, cracker and trade range checks
    if (Number.isFinite(m.x) && Number.isFinite(m.y)) { k.x = m.x; k.y = m.y; }
    k.dead = !!m.dead;
    // an open trade ends when either knight falls or walks away
    if (k.trade) { const o = this.otherOf(k.trade, k); if (k.dead) this.cancelTrade(k.trade, 'dead', k); else if (!this.within(k, o, TRADE_LEAVE, true)) this.cancelTrade(k.trade, 'far', k); }
    if (changed) { this.attach(k); this.rosterLater(); }
    // the role on a relayed p is always the server's word: whatever the sender put there is overwritten
    const out = JSON.stringify(Object.assign({}, m, { t: 'p', n: k.name, map: k.map, role: k.role }));
    k.last = out;
    for (const o of this.members(k.map)) if (o !== k) this.raw(o.sock, out);
  }

  onChat(k, m) {
    if (!k.hello) return;
    // a muted knight's line goes nowhere and is not logged; the knight hears how long is left
    const acc = this.store.account(k.name);
    const now = this.now();
    if (acc && acc.mutedUntil > now) return this.send(k.sock, { t: 'muted', left: leftOf(acc.mutedUntil, now) });
    if (acc) this.syncRole(k, acc.role);
    const text = this.filter(typeof m.text === 'string' ? m.text : '');
    if (!text) return;
    const at = now;
    this.log(k.name, text, at);
    const out = JSON.stringify({ t: 'chat', n: k.name, text, at, role: k.role });
    for (const o of this.knights.values()) if (o.hello) this.raw(o.sock, out);
  }

  onMon(k, m) {
    if (!k.hello || !Array.isArray(m.list)) return;
    const g = this.maps.get(k.map);
    if (!g || g.keeper !== k) return;   // only the keeper's monsters are real; a late snapshot after handoff is dropped
    k.monAt = this.now();
    const out = JSON.stringify({ t: 'mon', n: k.name, list: m.list });
    for (const o of g.members) if (o !== k) this.raw(o.sock, out);
  }

  onHit(k, m) {
    if (!k.hello) return;
    const g = this.maps.get(k.map);
    if (!g || !g.keeper || g.keeper === k) return;   // the keeper applies its own hits locally
    if (typeof m.nid !== 'string') return;
    this.send(g.keeper.sock, { t: 'hit', n: k.name, nid: m.nid, dmg: m.dmg, knock: m.knock, bomb: m.bomb });
  }

  // kill and hurt: from the keeper, to one named knight on the same map
  onToKnight(k, m, t, fields) {
    if (!k.hello) return;
    const g = this.maps.get(k.map);
    if (!g || g.keeper !== k) return;
    const to = this.byName.get(low(m.to || ''));
    if (!to || !to.hello || to === k || to.map !== k.map) return;
    const out = { t };
    for (const f of fields) out[f] = m[f];
    this.send(to.sock, out);
  }

  // a knight asks the keeper of its map to wake a named boss (docs/ONLINE.md, "Named bosses"). The world only checks the
  // shape and who keeps the map; the keeper's game decides whether the boss may come (on its map, near, not up already).
  onBossCall(k, m) {
    if (!k.hello) return;
    const g = this.maps.get(k.map);
    if (!g || !g.keeper || g.keeper === k) return;
    if (typeof m.id !== 'string' || !/^[a-z_]{1,24}$/.test(m.id)) return;
    this.send(g.keeper.sock, { t: 'boss_call', n: k.name, id: m.id });
  }

  onGift(k, m) {
    if (!k.hello) return;
    const id = typeof m.id === 'string' && m.id ? m.id.slice(0, 40) : null;
    const qty = (Number.isInteger(m.qty) && m.qty > 0) ? Math.min(m.qty, 1000000) : 1;
    if (!id) return;
    const gid = this.nextGid++;
    const to = this.byName.get(low(m.to || ''));
    // the sender has already taken the item out of the pack, so a gift with nowhere to go comes straight back
    if (!to || !to.hello || to === k) return this.send(k.sock, { t: 'gift_back', gid, id, qty });
    this.gifts.set(gid, { gid, from: k.lc, to: to.lc, id, qty, due: this.now() + GIFT_WAIT });
    k.gifts.add(gid);
    this.attach(k);
    this.send(to.sock, { t: 'gift', gid, from: k.name, id, qty });
    this.arm();
  }

  onGiftAnswer(k, m, outcome) {
    const g = this.gifts.get(m.gid);
    if (!g || g.to !== k.lc) return;   // only the knight it was sent to may answer
    this.settleGift(g, outcome);
    this.arm();
  }

  // Ends a gift: gift_ok (they took it) or gift_back (they could not, left, or never answered).
  settleGift(g, outcome) {
    this.gifts.delete(g.gid);
    const from = this.byName.get(g.from);
    if (!from) return;
    from.gifts.delete(g.gid);
    this.attach(from);
    this.send(from.sock, { t: outcome, gid: g.gid, id: g.id, qty: g.qty });
  }

  // ---------- roles ----------
  // The store is the truth; k.role is the Room's copy for presence, chat and the roster. When they differ the
  // knight and the roster hear at once.
  syncRole(k, role) {
    if (k.role === role) return;
    k.role = role;
    if (k.hello) { this.send(k.sock, { t: 'role', role }); this.rosterNow(); }
  }

  // Every admin message starts here: the sender's role is read from the store, fresh, every time (never k.role,
  // never the socket's attachment). Answers the admin's account, or null after telling a non-admin so.
  asAdmin(k) {
    if (!k.hello) return null;
    const acc = this.store.account(k.name);
    const role = acc ? acc.role : 'player';
    this.syncRole(k, role);
    if (role === 'admin') return acc;
    this.send(k.sock, { t: 'error', code: 'admin', text: 'only an admin can do that' });
    return null;
  }

  // The parent page made a knight an admin or a player (the World has already written the store).
  setRole(name) {
    const acc = this.store.account(name);
    const k = this.byName.get(acc ? acc.lc : low(name));
    if (!k) return;
    k.role = acc ? acc.role : 'player';
    if (k.hello) { this.send(k.sock, { t: 'role', role: k.role }); this.rosterNow(); }
  }

  // The parent page muted or unmuted a knight (the World has already written the store).
  muteChanged(name) {
    const acc = this.store.account(name);
    const k = acc && this.byName.get(acc.lc);
    if (!k || !k.hello) return;
    const now = this.now();
    if (acc.mutedUntil > now) this.send(k.sock, { t: 'muted', left: leftOf(acc.mutedUntil, now) });
    else this.send(k.sock, { t: 'unmuted' });
  }

  // ---------- moderation from inside the game (admins only) ----------
  // mute {n, span}, unmute {n}, kick {n}, ban {n}, unban {n}. The admin always gets a mod answer; a successful
  // action is written to mod_log and followed by a fresh modlist. Nobody can do any of it to an admin.
  onMod(k, m) {
    const admin = this.asAdmin(k);
    if (!admin) return;
    const act = m.t, now = this.now();
    const raw = typeof m.n === 'string' ? m.n : '';
    const asked = raw.replace(/\s+/g, ' ').trim().slice(0, 40);
    const no = (code, n) => this.send(k.sock, { t: 'mod', ok: false, act, n: n || asked, code });
    if (!MOD_ACTS.includes(act)) return;
    if (!asked || raw.length > 40) return no('bad');
    if (act === 'mute' && !Object.prototype.hasOwnProperty.call(MUTE_SPANS, m.span)) return no('bad');
    const target = this.store.account(asked);
    if (!target) return no('unknown');
    if (target.lc === admin.lc) return no('self', target.name);
    if (target.role === 'admin') return no('admin', target.name);
    const there = this.byName.get(target.lc) || null;
    if (act === 'kick' && !there) return no('offline', target.name);
    const answer = { t: 'mod', ok: true, act, n: target.name };
    let detail = '';
    if (act === 'mute') {
      const until = m.span === 'always' ? ALWAYS : now + MUTE_SPANS[m.span];
      this.store.setMute(target.lc, until);   // a new mute replaces an old one
      answer.left = leftOf(until, now);
      detail = m.span;
      if (there && there.hello) this.send(there.sock, { t: 'muted', left: answer.left });
    } else if (act === 'unmute') {
      this.store.setMute(target.lc, 0);
      if (there && there.hello) this.send(there.sock, { t: 'unmuted' });
    } else if (act === 'kick') {
      this.kick(target.name, 'kicked', KICK_TEXT);
    } else if (act === 'ban') {
      this.store.setBanned(target.lc, true);   // the SqlStore drops every session of theirs with it
      if (there) this.kick(target.name, 'banned', 'this knight is banned');
    } else {
      this.store.setBanned(target.lc, false);
    }
    this.store.log({ at: now, by: admin.name, act, target: target.name, detail });
    this.send(k.sock, answer);
    this.sendModlist(k);
  }

  onModlist(k) { if (this.asAdmin(k)) this.sendModlist(k); }

  sendModlist(k) {
    const now = this.now();
    const muted = this.store.mutedList(now).map(r => ({ n: r.name, left: leftOf(r.until, now) })).sort(byN);
    const banned = this.store.bannedList().map(r => ({ n: r.name })).sort(byN);
    this.send(k.sock, { t: 'modlist', muted, banned });
  }

  // ---------- spawning monsters (admins only): relayed to the keeper of the admin's map, who makes them ----------
  onSpawn(k, m) {
    if (!this.asAdmin(k)) return;
    const { type, count, x, y } = m;
    if (typeof type !== 'string' || !ID_RE.test(type) || !Number.isInteger(count) || count < 1 || count > SPAWN_MAX || !inRange(x, 0, 100000) || !inRange(y, 0, 100000)) {
      return this.send(k.sock, { t: 'error', code: 'bad', text: 'that spawn did not pass the checks' });
    }
    const keeper = this.keeperOf(k.map);
    if (!keeper) return;
    // new for every spawn and never used again: the time in base 36, then a counter (only 0-9 and a-z)
    const sid = Math.floor(this.now()).toString(36) + (this.spawnSeq++).toString(36);
    this.send(keeper.sock, { t: 'spawn', by: k.name, type, count, x, y, sid });
  }

  onSpawnClear(k) {
    if (!this.asAdmin(k)) return;
    const keeper = this.keeperOf(k.map);
    if (keeper) this.send(keeper.sock, { t: 'spawn_clear', by: k.name });
  }

  // ---------- drop parties ----------
  // Where a knight stands in pixels: the server's last presence, else what this message says, else null.
  posOf(k, m) {
    if (k.x != null && k.y != null) return { x: k.x, y: k.y };
    if (m && Number.isFinite(m.x) && Number.isFinite(m.y)) return { x: m.x, y: m.y };
    return null;
  }

  unlitOn(map) {
    let n = 0;
    for (const p of this.parties.values()) if (p.map === map) for (const c of p.crackers.values()) if (!c.litBy) n++;
    return n;
  }

  crackersMsg(p) {
    const list = [];
    for (const c of p.crackers.values()) if (!c.litBy) list.push([crackerId(p.id, c.k), c.tx, c.ty]);
    return JSON.stringify({ t: 'crackers', pid: p.id, map: p.map, by: p.by, list, left: Math.max(0, p.expires - this.now()) });
  }

  // The live parties on a map, to one knight that has just arrived there (hello, or a map change; never a restore).
  sendPartiesOn(k, map) {
    this.expire();
    for (const p of this.parties.values()) if (p.map === map) this.raw(k.sock, this.crackersMsg(p));
  }

  // Ends every party whose 15 minutes are up. The alarm does this on time; this also covers the moment between the
  // expiry and the alarm's tick, so a party past its time is never sent, counted or lit.
  expire() {
    const now = this.now();
    for (const p of Array.from(this.parties.values())) if (p.expires <= now) this.endParty(p);
  }

  everyone(obj) {
    const out = JSON.stringify(obj);
    for (const o of this.knights.values()) if (o.hello) this.raw(o.sock, out);
  }

  onParty(k, m) {
    if (!this.asAdmin(k)) return;
    const no = code => this.send(k.sock, { t: 'party_no', code });
    if (!HAT_CHOICES.includes(m.hat)) return no('bad');
    const pos = this.posOf(k, m);
    if (!pos) return no('where');
    const spots = checkSpots(m.spots, Math.floor(pos.x / TILE), Math.floor(pos.y / TILE));
    const table = checkTable(m.table);
    if (!spots || !table) return no('bad');
    this.expire();
    if (this.unlitOn(k.map) + spots.length > MAX_LIVE_CRACKERS) return no('busy');
    const now = this.now();
    const p = { at: now, by: k.name, map: k.map, region: k.region || '', hat: m.hat, table, expires: now + PARTY_LIFE };
    p.id = this.store.addParty(Object.assign({ spots }, p));
    p.crackers = new Map(spots.map(([tx, ty], i) => [i, { k: i, tx, ty, litBy: null }]));
    this.parties.set(p.id, p);
    const out = this.crackersMsg(p);
    for (const o of this.members(p.map)) this.raw(o.sock, out);
    this.everyone({ t: 'announce', kind: 'party', n: k.name, region: p.region, map: p.map, count: spots.length });
    this.store.log({ at: now, by: k.name, act: 'party', target: p.map, detail: spots.length + ' crackers in ' + (p.region || p.map) + ', party hats 1 in ' + commas(p.hat) });
    this.arm();
  }

  onPartyEnd(k) {
    if (!this.asAdmin(k)) return;
    for (const p of Array.from(this.parties.values())) if (p.map === k.map) this.endParty(p);
  }

  // A party is over (time up, every cracker lit, or an admin ended it): its unlit crackers are gone for good.
  endParty(p) {
    if (this.parties.get(p.id) !== p) return;
    this.parties.delete(p.id);
    this.store.endParty(p.id);
    const out = JSON.stringify({ t: 'party_end', pid: p.id, map: p.map });
    for (const o of this.members(p.map)) this.raw(o.sock, out);
  }

  // light {id, x, y}: anyone. The first knight to light a cracker gets its prize; the store decides who that is.
  onLight(k, m) {
    if (!k.hello) return;
    const c = parseCrackerId(m.id);
    if (!c) return;
    if ((m.x != null && !Number.isFinite(m.x)) || (m.y != null && !Number.isFinite(m.y))) return;
    const id = crackerId(c.pid, c.k);
    const no = code => this.send(k.sock, { t: 'light_no', id, code });
    this.expire();
    const p = this.parties.get(c.pid);
    const cr = p ? p.crackers.get(c.k) : null;
    if (!cr) return no('gone');
    if (k.map !== p.map) return no('map');
    if (cr.litBy) return no('taken');
    const pos = this.posOf(k, m);
    if (!pos || Math.hypot(pos.x - (cr.tx * TILE + TILE / 2), pos.y - (cr.ty * TILE + TILE / 2)) > LIGHT_RANGE) return no('far');
    const now = this.now();
    const reward = rollCracker(p.table, p.hat, this.random);
    if (!this.store.light(p.id, cr.k, k.lc, now, reward)) {
      cr.litBy = cr.litBy || '?';   // the store knows better: somebody lit it first
      no('taken');
    } else {
      cr.litBy = k.lc;
      const fuse = FUSE_MIN + Math.floor(this.random() * (FUSE_MAX - FUSE_MIN + 1));
      const out = JSON.stringify({ t: 'boom', id, n: k.name, fuse, reward });
      for (const o of this.members(p.map)) this.raw(o.sock, out);
      if (reward.hat) {
        this.everyone({ t: 'announce', kind: 'hat', n: k.name, colour: reward.hat });
        this.store.log({ at: now, by: p.by, act: 'hat', target: k.name, detail: reward.hat });
      }
    }
    // the last cracker lit ends the party
    if (!Array.from(p.crackers.values()).some(x => !x.litBy)) this.endParty(p);
  }

  // claim {id}: the lighter's game has the prize in its save. No answer.
  onClaim(k, m) {
    if (!k.hello) return;
    const c = parseCrackerId(m.id);
    if (c) this.store.claim(c.pid, c.k, k.lc);
  }

  // ---------- trading (docs/ONLINE.md, "Trading") ----------
  // Two knights within `r` px of each other by their last presence. With a position missing: `unknown` (true only where
  // "not heard yet" must not end anything, as in a presence check; an ask always needs both positions).
  within(a, b, r, unknown) {
    if (!a || !b || a.x == null || a.y == null || b.x == null || b.y == null) return !!unknown;
    return Math.hypot(a.x - b.x, a.y - b.y) <= r;
  }
  otherOf(t, k) { return t.a === k ? t.b : t.a; }
  sideOf(t, k) { return t.a === k ? 'a' : 'b'; }

  // An offer as the game sends it, checked: at most TRADE_ITEMS different ids, each an item id and a whole number
  // 1..TRADE_QTY_MAX, no id twice. Answers the clean list, or null (then nothing changes).
  static cleanOffer(items) {
    if (!Array.isArray(items) || items.length > TRADE_ITEMS) return null;
    const seen = new Set(), out = [];
    for (const it of items) {
      if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !ID_RE.test(it.id) || seen.has(it.id)) return null;
      if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > TRADE_QTY_MAX) return null;
      seen.add(it.id); out.push({ id: it.id, qty: it.qty });
    }
    return out;
  }
  static sameOffer(x, y) { return x.length === y.length && x.every((it, i) => it.id === y[i].id && it.qty === y[i].qty); }

  // Why these two cannot open a trade right now, as the code trade_no carries (and whose fault, for its n), or null.
  tradeBlock(k, o) {
    if (!o || !o.hello) return ['offline', o];
    if (o === k) return ['self', k];
    if (o.map !== k.map) return ['map', o];
    if (k.trade) return ['busy', k];
    if (o.trade) return ['busy', o];
    if (k.dead) return ['dead', k];
    if (o.dead) return ['dead', o];
    if (!this.within(k, o, TRADE_NEAR)) return ['far', o];
    return null;
  }
  // An ask that ends unanswered (it ran out, or the asker left, asked someone else or started another trade): the
  // knight it was put to hears trade_ask_off, so the question goes away.
  dropAsk(k, why) {
    const a = k.ask; if (!a) return;
    k.ask = null;
    const to = this.byName.get(a.to);
    if (to && to.hello) this.send(to.sock, { t: 'trade_ask_off', from: k.name });
    if (why === 'timeout') this.send(k.sock, { t: 'trade_no', code: 'timeout', n: to ? to.name : a.to });
  }

  // trade_ask {to}: put the question to a knight on your map within five tiles. If they already asked you, the trade
  // opens at once (the RuneScape way: you both chose each other).
  onTradeAsk(k, m) {
    if (!k.hello) return;
    const asked = typeof m.to === 'string' ? m.to.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    const o = asked ? this.byName.get(low(asked)) : null;
    const no = (code, who) => this.send(k.sock, { t: 'trade_no', code, n: who ? who.name : asked });
    if (!asked) return no('bad');
    const block = this.tradeBlock(k, o);
    if (block) return no(block[0], block[1]);
    const now = this.now();
    if (o.ask && o.ask.to === k.lc && o.ask.due > now) { o.ask = null; this.dropAsk(k); return this.openTrade(o, k); }
    if (k.ask && k.ask.to === o.lc && k.ask.due > now) return no('wait', o);   // asked already: they have the question
    this.dropAsk(k);
    k.ask = { to: o.lc, due: now + TRADE_ASK_LIFE };
    this.send(o.sock, { t: 'trade_ask', from: k.name, role: k.role });
    this.send(k.sock, { t: 'trade_asked', to: o.name });
    this.arm();
  }

  // trade_answer {from, yes}: yes opens the trade when the two can still trade; no tells the asker.
  onTradeAnswer(k, m) {
    if (!k.hello) return;
    const from = typeof m.from === 'string' ? this.byName.get(low(m.from.replace(/\s+/g, ' ').trim())) : null;
    const now = this.now();
    if (!from || !from.ask || from.ask.to !== k.lc || from.ask.due <= now) return this.send(k.sock, { t: 'trade_no', code: 'gone', n: from ? from.name : String(m.from || '').slice(0, 40) });
    from.ask = null;
    if (m.yes !== true) return this.send(from.sock, { t: 'trade_no', code: 'declined', n: k.name });
    const block = this.tradeBlock(from, k);
    if (block) { const out = { t: 'trade_no', code: block[0], n: block[1].name }; this.send(from.sock, out); this.send(k.sock, out); return; }
    this.openTrade(from, k);
  }

  openTrade(a, b) {
    this.dropAsk(a); this.dropAsk(b);
    const t = { id: this.nextTradeId++, a, b, offer: { a: [], b: [] }, acc: { a: false, b: false }, conf: { a: false, b: false }, stage: 'offer', ver: 1 };
    this.trades.set(t.id, t);
    a.trade = t; b.trade = t;
    this.send(a.sock, { t: 'trade_open', id: t.id, with: b.name, ver: t.ver });
    this.send(b.sock, { t: 'trade_open', id: t.id, with: a.name, ver: t.ver });
    this.sendTrade(t);
  }

  // The whole truth about a trade, as each side sees it: its own offer, the other's, and who has accepted / confirmed.
  tradeStateFor(t, k) {
    const s = this.sideOf(t, k), o = s === 'a' ? 'b' : 'a';
    return { t: 'trade_state', id: t.id, ver: t.ver, stage: t.stage, mine: t.offer[s], theirs: t.offer[o], acc: [t.acc[s], t.acc[o]], conf: [t.conf[s], t.conf[o]] };
  }
  sendTrade(t, only) {
    for (const k of only ? [only] : [t.a, t.b]) this.send(k.sock, this.tradeStateFor(t, k));
  }
  // Every trade message names its trade; one this knight is not in (a trade that ended, or one lost in a nap) is
  // answered trade_end gone, so its window closes and nothing moves.
  tradeOf(k, m) {
    if (!k.hello) return null;
    if (k.trade && m.id === k.trade.id) return k.trade;
    if (Number.isInteger(m.id)) this.send(k.sock, { t: 'trade_end', id: m.id, code: 'gone', n: k.name });
    return null;
  }
  unaccept(t) { t.stage = 'offer'; t.acc.a = t.acc.b = false; t.conf.a = t.conf.b = false; }

  // trade_offer {id, items}: this side's whole offer. Any change un-accepts both and goes back to the first screen.
  onTradeOffer(k, m) {
    const t = this.tradeOf(k, m); if (!t) return;
    const items = Room.cleanOffer(m.items);
    if (!items) return this.sendTrade(t, k);   // refused: the knight hears the truth again
    const s = this.sideOf(t, k);
    if (Room.sameOffer(items, t.offer[s])) return;
    t.offer[s] = items; t.ver++;
    this.unaccept(t);
    this.sendTrade(t);
  }

  // trade_accept {id, ver}: the first screen. Only for the offers of version ver, and never for two empty offers.
  onTradeAccept(k, m) {
    const t = this.tradeOf(k, m); if (!t) return;
    if (t.stage !== 'offer' || m.ver !== t.ver || (!t.offer.a.length && !t.offer.b.length)) return this.sendTrade(t, k);
    t.acc[this.sideOf(t, k)] = true;
    if (t.acc.a && t.acc.b) { t.stage = 'confirm'; t.conf.a = t.conf.b = false; }
    this.sendTrade(t);
  }

  // trade_confirm {id, ver}: "Are you sure?". When both have confirmed version ver, the trade happens.
  onTradeConfirm(k, m) {
    const t = this.tradeOf(k, m); if (!t) return;
    if (t.stage !== 'confirm' || m.ver !== t.ver) return this.sendTrade(t, k);
    t.conf[this.sideOf(t, k)] = true;
    if (t.conf.a && t.conf.b) return this.completeTrade(t);
    this.sendTrade(t);
  }

  // trade_full {id, why}: this knight's pack cannot hold what it would get ('full'), or its game does not know an item
  // ('new'). Both are un-accepted and told whose pack it is; the window stays open so the offers can change.
  onTradeFull(k, m) {
    const t = this.tradeOf(k, m); if (!t) return;
    this.unaccept(t);
    this.sendTrade(t);
    const out = { t: 'trade_note', id: t.id, code: m.why === 'new' ? 'new' : 'full', n: k.name };
    this.send(t.a.sock, out); this.send(t.b.sock, out);
  }

  // trade_close {id}: the window was closed (or No pressed): the trade is off and nothing moves.
  onTradeClose(k, m) {
    if (!k.hello || !k.trade || m.id !== k.trade.id) return;
    this.cancelTrade(k.trade, 'closed', k);
  }

  // trade_ack {tid}: this knight's game has the finished trade in its save. No answer.
  onTradeAck(k, m) {
    if (!k.hello || !Number.isInteger(m.tid)) return;
    this.store.ackTrade(m.tid, k.lc);
  }

  // Ends an open trade with nothing moved. code: closed | left | far | dead; n = the knight it was about.
  cancelTrade(t, code, who) {
    if (this.trades.get(t.id) !== t) return;
    this.trades.delete(t.id);
    if (t.a.trade === t) t.a.trade = null;
    if (t.b.trade === t) t.b.trade = null;
    const out = { t: 'trade_end', id: t.id, code, n: who ? who.name : '' };
    for (const k of [t.a, t.b]) if (this.knights.get(k.sock) === k) this.send(k.sock, out);
  }

  // Both confirmed the same offers. Checked once more (one map, in reach, neither fallen), written to the store, and
  // both games told in the same moment: each takes out what it gave and puts in what it got, once (the tid).
  completeTrade(t) {
    const { a, b } = t;
    if (a.map !== b.map) return this.cancelTrade(t, 'left', a.map == null ? a : b);
    if (a.dead || b.dead) return this.cancelTrade(t, 'dead', a.dead ? a : b);
    if (!this.within(a, b, TRADE_LEAVE, true)) return this.cancelTrade(t, 'far', b);
    this.trades.delete(t.id);
    a.trade = null; b.trade = null;
    const tid = this.store.addTrade({ at: this.now(), a: a.name, b: b.name, aGave: t.offer.a, bGave: t.offer.b });
    this.send(a.sock, { t: 'trade_done', tid, id: t.id, with: b.name, gave: t.offer.a, got: t.offer.b });
    this.send(b.sock, { t: 'trade_done', tid, id: t.id, with: a.name, gave: t.offer.b, got: t.offer.a });
  }

  // ---------- maps and keepers ----------
  members(map) { const g = this.maps.get(map); return g ? g.members : []; }
  keeperOf(map) { const g = this.maps.get(map); return g ? g.keeper : null; }

  moveMap(k, map) {
    if (k.trade) this.cancelTrade(k.trade, 'left', k);   // a trade is only ever between two knights on one map
    this.leaveMap(k);
    this.enterMap(k, map, { quiet: false });
    this.sendPartiesOn(k, map);   // crackers already lying on the new map
  }

  enterMap(k, map, { quiet, silent, at }) {
    k.map = map;
    k.mapAt = at != null ? at : this.now();
    let g = this.maps.get(map);
    if (!g) { g = { members: new Set(), keeper: null }; this.maps.set(map, g); }
    g.members.add(k);
    // the newcomer is the youngest on the map so the keeper only changes when the map was empty
    this.elect(map, quiet ? k : null, silent);
    this.arm();   // with two on a map the keeper's silence is now something to watch for
    if (!quiet) this.send(k.sock, { t: 'keeper', map, n: g.keeper ? g.keeper.name : null });
    // whoever is already here shows up at once, even if they are standing still
    for (const o of g.members) if (o !== k && o.last) this.raw(k.sock, o.last);
  }

  leaveMap(k) {
    const map = k.map;
    const g = this.maps.get(map);
    k.map = null;
    if (!g) return;
    g.members.delete(k);
    const out = JSON.stringify({ t: 'left', n: k.name, map });
    for (const o of g.members) this.raw(o.sock, out);
    this.elect(map, null);
  }

  // The keeper of a map is the knight who has been on that map longest (then on line longest, then by
  // name, so it is the same answer after a restore). Counting time on the map rather than time in the game
  // means the keeper only ever changes when it leaves: a handoff is the costly part, so there are as few as
  // possible. Everyone on the map hears when it changes, except `except` (welcome carries it).
  // silent is for restore: the knights come back in any order and were all told before the nap.
  elect(map, except, silent) {
    const g = this.maps.get(map);
    if (!g) return;
    if (g.members.size === 0) { this.maps.delete(map); return; }
    const now = this.now();
    if (g.keeper && g.keeper.keeperAt == null) g.keeper.keeperAt = now;   // a restored keeper starts its grace now
    // a keeper that has gone quiet while others are here goes to the back of the line (see KEEPER_STALE)
    const stale = o => o === g.keeper && g.members.size > 1 && now - Math.max(o.monAt || 0, o.keeperAt || 0) > KEEPER_STALE;
    // and a knight whose game has gone silent (see PRESENCE_STALE) is never picked over one who is playing
    // (alive = its presence, its monster stream, or its arrival on the map is recent)
    const silentKnight = o => g.members.size > 1 && now - Math.max(o.pAt || 0, o.monAt || 0, o.keeperAt || 0, o.mapAt || 0) > PRESENCE_STALE;
    const back = o => stale(o) || silentKnight(o);
    const before = (a, b) => { const sa = back(a), sb = back(b); if (sa !== sb) return !sa; return a.mapAt !== b.mapAt ? a.mapAt < b.mapAt : (a.since !== b.since ? a.since < b.since : a.lc < b.lc); };
    let best = null;
    for (const o of g.members) if (!best || before(o, best)) best = o;
    if (g.keeper === best) return;
    // a quiet keeper goes to the back of the line for good, not just this once: otherwise it would win the very
    // next election (it is still the longest on the map) and the map would thrash between the two
    const old = g.keeper;
    if (old && stale(old)) old.mapAt = now;
    g.keeper = best; best.keeperAt = now;
    if (silent) return;
    const out = JSON.stringify({ t: 'keeper', map, n: best.name });
    for (const o of g.members) if (o !== except) this.raw(o.sock, out);
  }

  // ---------- logins (the store keeps them; a store without them, as an older simulation's, is simply not asked) ----------
  hasLogins() { return typeof this.store.loginStart === 'function'; }
  loginStart(lc, at) { if (!this.hasLogins()) return null; try { return this.store.loginStart(lc, at); } catch (e) { return null; } }
  loginEnd(k) {
    if (k.loginId == null || !this.hasLogins()) return;
    const id = k.loginId; k.loginId = null;
    try { this.store.loginEnd(id, this.now()); } catch (e) { }
  }
  // any message at all: the login was alive now (written at most every SEEN_EVERY, so a busy knight costs one row a minute)
  heard(k) {
    if (k.loginId == null || !this.hasLogins()) return;
    const now = this.now();
    if (now - k.seenAt < SEEN_EVERY) return;
    k.seenAt = now;
    try { this.store.loginSeen(k.loginId, now); } catch (e) { }
  }
  // After a wake has restored every socket: an open row no knight here carries belongs to a socket that is gone.
  settleLogins() {
    if (!this.hasLogins() || typeof this.store.closeStaleLogins !== 'function') return 0;
    const keep = new Set();
    for (const k of this.knights.values()) if (k.loginId != null) keep.add(k.loginId);
    return this.store.closeStaleLogins(keep, this.now());
  }
  loginOf(name) { const k = this.byName.get(low(name)); return k && k.loginId != null ? { id: k.loginId, started: k.since } : null; }

  // ---------- the roster ----------
  online() {
    const list = [];
    for (const k of this.knights.values()) if (k.hello) list.push({ n: k.name, map: k.map, region: k.region, lv: k.lv, since: k.since, role: k.role });
    return list;
  }
  isOnline(name) { const k = this.byName.get(low(name)); return !!(k && k.hello); }

  rosterNow() { this.sendRoster(this.now()); }
  rosterLater() { this.rosterDirty = true; this.arm(); }
  sendRoster(now) {
    this.rosterAt = now;
    this.rosterDirty = false;
    const out = JSON.stringify({ t: 'who', list: this.online().map(({ n, map, region, lv, role }) => ({ n, map, region, lv, role })) });
    for (const o of this.knights.values()) if (o.hello) this.raw(o.sock, out);
  }

  // ---------- rate caps ----------
  // A token bucket per message type: burst tokens to start, refilled at rate per second.
  allow(k, type, cap) {
    const now = this.now();
    let b = k.buckets[type];
    if (!b) b = k.buckets[type] = { tokens: cap.burst, at: now };
    b.tokens = Math.min(cap.burst, b.tokens + Math.max(0, now - b.at) / 1000 * cap.rate);
    b.at = now;
    if (b.tokens >= 1) { b.tokens -= 1; return true; }
    this.strike(k, cap);
    return false;
  }

  // Over a cap: one warning, then the socket is dropped if it keeps going. Silence for a while forgives.
  strike(k, cap) {
    const now = this.now();
    if (now - k.strikeAt > STRIKES_FORGIVEN_AFTER) k.strikes = 0;
    k.strikeAt = now;
    k.strikes++;
    if (k.strikes === 1) this.send(k.sock, { t: 'error', code: 'bad', text: 'too fast: slow down or you will be dropped' });
    else if (k.strikes > cap.burst * 3) this.drop(k, 4008, 'too fast');
  }

  // ---------- timers ----------
  // The earliest moment something needs doing, or null.
  due() {
    let d = this.rosterDirty ? this.rosterAt + ROSTER_EVERY : null;
    for (const g of this.gifts.values()) if (d == null || g.due < d) d = g.due;
    for (const g of this.maps.values()) if (g.keeper && g.members.size > 1) { const t = Math.max(g.keeper.monAt || 0, g.keeper.keeperAt || 0) + KEEPER_STALE + 50; if (d == null || t < d) d = t; }
    for (const p of this.parties.values()) if (d == null || p.expires < d) d = p.expires;
    for (const k of this.knights.values()) if (k.ask && (d == null || k.ask.due < d)) d = k.ask.due;
    return d;
  }
  arm() {
    const d = this.due();
    if (d == null) { this.wakeAt = null; return; }
    if (this.wakeAt != null && d >= this.wakeAt) return;
    this.wakeAt = d;
    this.wake(Math.max(0, d - this.now()));
  }
  tick() {
    this.wakeAt = null;
    const now = this.now();
    this.expire();   // parties whose 15 minutes are up
    for (const g of Array.from(this.gifts.values())) if (g.due <= now) this.settleGift(g, 'gift_back');
    for (const k of Array.from(this.knights.values())) if (k.ask && k.ask.due <= now) this.dropAsk(k, 'timeout');
    if (this.rosterDirty && now - this.rosterAt >= ROSTER_EVERY) this.sendRoster(now);
    for (const map of Array.from(this.maps.keys())) this.elect(map, null);   // a quiet keeper steps down
    this.arm();
  }

  // ---------- plumbing ----------
  send(sock, obj) { this.raw(sock, JSON.stringify(obj)); }
  raw(sock, str) { try { sock.send(str); } catch (e) { } }
  attach(k) {
    if (!k.sock.attach) return;
    const gifts = [];
    for (const gid of k.gifts) { const g = this.gifts.get(gid); if (g) gifts.push({ gid: g.gid, to: g.to, id: g.id, qty: g.qty, due: g.due }); }
    try { k.sock.attach({ name: k.name, since: k.since, hello: k.hello, map: k.map, mapAt: k.mapAt, region: k.region, lv: k.lv, gifts, loginId: k.loginId }); } catch (e) { }
  }
}
