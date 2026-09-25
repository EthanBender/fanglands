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
//   room.store                 where roles, mutes, bans, parties and prizes live (store.js)
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
// Admins (docs/ONLINE.md, "Admins and drop parties"): only the parent page makes one. Every admin message reads
// the sender's role from the store, fresh, before it does anything; the socket's memory is never the lock.
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
};
for (const c of Object.values(CAPS)) if (!c.burst) c.burst = Math.max(2, Math.round(c.rate * 2));

export const ROSTER_EVERY = 2000;      // a changed roster goes out at most this often (join/leave go at once)
// A keeper that streams no monsters for this long while others share its map (paused, on the title screen, a
// sleeping tab) hands the map to the next knight; it is eligible again once that knight leaves.
export const KEEPER_STALE = 4000;
export const GIFT_WAIT = 10000;        // no answer to a gift within this: it comes back to the sender
// How long each mute lasts; 'always' means until an admin (or the parent page) turns chat back on.
export const MUTE_SPANS = { '5m': 5 * 60 * 1000, '1h': 3600 * 1000, '1d': 24 * 3600 * 1000, always: ALWAYS };
export const SPAWN_MAX = 20;           // monsters in one spawn message
export const KICK_TEXT = 'An admin sent you out of the world. You can come back in.';
const STRIKES_FORGIVEN_AFTER = 10000;  // a socket that behaves for this long gets its warning back
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
    this.nextGid = 1;
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
      last: null, buckets: {}, strikes: 0, strikeAt: 0, gifts: new Set(),
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
  kick(name, code, text) {
    const k = this.byName.get(low(name));
    if (!k) return false;
    this.send(k.sock, { t: 'error', code, text });
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
    if (this.byName.get(k.lc) === k) this.byName.delete(k.lc);
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
    this.arm();
  }

  onPresence(k, m, str) {
    if (!k.hello) return;
    if (str.length > MAX_P) return this.strike(k, CAPS.p);
    const map = (typeof m.map === 'string' && m.map) ? m.map.slice(0, 64) : k.map;
    let changed = false;
    if (map !== k.map) { this.moveMap(k, map); changed = true; }
    if (typeof m.region === 'string' && m.region.slice(0, 40) !== k.region) { k.region = m.region.slice(0, 40); changed = true; }
    if (typeof m.lv === 'number' && m.lv !== k.lv) { k.lv = m.lv; changed = true; }
    // where the knight stands, for the party and cracker range checks
    if (Number.isFinite(m.x) && Number.isFinite(m.y)) { k.x = m.x; k.y = m.y; }
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

  // ---------- maps and keepers ----------
  members(map) { const g = this.maps.get(map); return g ? g.members : []; }
  keeperOf(map) { const g = this.maps.get(map); return g ? g.keeper : null; }

  moveMap(k, map) {
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
    const before = (a, b) => { const sa = stale(a), sb = stale(b); if (sa !== sb) return !sa; return a.mapAt !== b.mapAt ? a.mapAt < b.mapAt : (a.since !== b.since ? a.since < b.since : a.lc < b.lc); };
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
    try { k.sock.attach({ name: k.name, since: k.since, hello: k.hello, map: k.map, mapAt: k.mapAt, region: k.region, lv: k.lv, gifts }); } catch (e) { }
  }
}
