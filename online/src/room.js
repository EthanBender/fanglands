// ============================================================================
// THE ROOM — who is on which map, who keeps its monsters, and where every message goes
// This is the whole routing logic of Fanglands Online as a plain class: no Cloudflare APIs, no timers of
// its own, no storage. The World (world.js) drives it with real WebSockets; tools/mmo-sim.js and the unit
// tests drive it with in-memory sockets and a fake clock. docs/ONLINE.md is the contract it keeps to.
//
//   const room = new Room({ now: () => ms, log: (name, text, at) => {}, wake: ms => {} });
//   room.join(sock, name)      sock is { send(str), close(code, reason), attach?(state) }
//   room.message(sock, str)    one JSON text frame from that socket
//   room.leave(sock)           the socket is gone
//   room.online()              [{n, map, region, lv, since}]
//   room.tick()                fire whatever is due: gift timeouts, a held-back roster
//
// Timers: the room never calls setTimeout itself. When something becomes due it calls wake(ms) once, and
// the host calls tick() at that time (the World uses a Durable Object alarm, which survives hibernation).
// With no wake option it falls back to setTimeout so a quick script works out of the box.
//
// Hibernation: a knight's state is handed to sock.attach(state) whenever it changes, and restore(sock,
// state) rebuilds the knight from it when the World wakes up. Nothing that matters lives only in memory.
// ============================================================================

import { cleanChat } from './filter.js';

// The caps from the contract table. rate is messages per second; a burst of twice that is allowed so a
// jittery connection sending at exactly the cap is not punished. hello is allowed once and never refills.
export const CAPS = {
  hello: { rate: 0, burst: 1 },
  p: { rate: 8 },
  chat: { rate: 1 / 1.5 },
  mon: { rate: 8 },
  hit: { rate: 20 },
  gift: { rate: 1 },
};
for (const c of Object.values(CAPS)) if (!c.burst) c.burst = Math.max(2, Math.round(c.rate * 2));

export const ROSTER_EVERY = 2000;      // a changed roster goes out at most this often (join/leave go at once)
export const GIFT_WAIT = 10000;        // no answer to a gift within this: it comes back to the sender
const STRIKES_FORGIVEN_AFTER = 10000;  // a socket that behaves for this long gets its warning back
const MAX_FRAME = 64 * 1024;           // bigger than any honest message (a mon list is a few KB)
const MAX_P = 4096;                    // presence is small; anything bigger is junk
const OVERWORLD = 'over';

const low = s => String(s).toLowerCase();

export class Room {
  constructor(opts = {}) {
    this.now = opts.now || (() => Date.now());
    this.log = opts.log || (() => {});
    this.filter = opts.filter || cleanChat;
    this.max = opts.max || 50;
    this.wake = opts.wake || (ms => { const t = setTimeout(() => this.tick(), ms); if (t && t.unref) t.unref(); });
    this.knights = new Map();   // sock -> knight
    this.byName = new Map();    // lower-case name -> knight
    this.maps = new Map();      // map name -> { members: Set<knight>, keeper: knight|null }
    this.gifts = new Map();     // gid -> { gid, from, to (lower-case names), id, qty, due }
    this.nextGid = 1;
    this.rosterAt = -Infinity;
    this.rosterDirty = false;
    this.wakeAt = null;
  }

  // ---------- joining and leaving ----------
  join(sock, name) {
    if (this.knights.has(sock)) return;
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
    this.attach(k);
  }

  // Rebuilds a knight from the state attach() handed out, without telling anyone: the others already know.
  restore(sock, state) {
    if (!state || !state.name || this.knights.has(sock)) return;
    const lc = low(state.name);
    const old = this.byName.get(lc);
    if (old) { if (old.since <= state.since) { try { sock.close(4000, 'logged in elsewhere'); } catch (e) { } return; } this.drop(old, 4000, 'logged in elsewhere'); }
    const k = this.makeKnight(sock, state);
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

  // Throws a knight out: an error first so the screen can say why, then the close.
  kick(name, code, text) {
    const k = this.byName.get(low(name));
    if (!k) return false;
    this.send(k.sock, { t: 'error', code, text });
    this.drop(k, code === 'banned' ? 4003 : 4000, text || code);
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
      case 'ping': return this.send(sock, { t: 'pong' });   // the real server answers this without waking; the sim lands here
      default: return;                                       // unknown t: ignored, as the contract says
    }
  }

  onHello(k, m) {
    k.hello = true;
    // a save always records the overworld, so a fresh login stands on it until the first presence says otherwise
    k.map = (typeof m.map === 'string' && m.map) ? m.map.slice(0, 64) : OVERWORLD;
    this.enterMap(k, k.map, { quiet: true });
    const keeper = this.keeperOf(k.map);
    this.send(k.sock, { t: 'welcome', me: k.name, at: this.now(), keeper: keeper ? keeper.name : null });
    this.attach(k);
    this.rosterNow();
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
    if (changed) { this.attach(k); this.rosterLater(); }
    const out = JSON.stringify(Object.assign({}, m, { t: 'p', n: k.name, map: k.map }));
    k.last = out;
    for (const o of this.members(k.map)) if (o !== k) this.raw(o.sock, out);
  }

  onChat(k, m) {
    if (!k.hello) return;
    const text = this.filter(typeof m.text === 'string' ? m.text : '');
    if (!text) return;
    const at = this.now();
    this.log(k.name, text, at);
    const out = JSON.stringify({ t: 'chat', n: k.name, text, at });
    for (const o of this.knights.values()) if (o.hello) this.raw(o.sock, out);
  }

  onMon(k, m) {
    if (!k.hello || !Array.isArray(m.list)) return;
    const g = this.maps.get(k.map);
    if (!g || g.keeper !== k) return;   // only the keeper's monsters are real; a late snapshot after handoff is dropped
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

  // ---------- maps and keepers ----------
  members(map) { const g = this.maps.get(map); return g ? g.members : []; }
  keeperOf(map) { const g = this.maps.get(map); return g ? g.keeper : null; }

  moveMap(k, map) {
    this.leaveMap(k);
    this.enterMap(k, map, { quiet: false });
  }

  enterMap(k, map, { quiet, silent, at }) {
    k.map = map;
    k.mapAt = at != null ? at : this.now();
    let g = this.maps.get(map);
    if (!g) { g = { members: new Set(), keeper: null }; this.maps.set(map, g); }
    g.members.add(k);
    // the newcomer is the youngest on the map so the keeper only changes when the map was empty
    this.elect(map, quiet ? k : null, silent);
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
    const before = (a, b) => a.mapAt !== b.mapAt ? a.mapAt < b.mapAt : (a.since !== b.since ? a.since < b.since : a.lc < b.lc);
    let best = null;
    for (const o of g.members) if (!best || before(o, best)) best = o;
    if (g.keeper === best) return;
    g.keeper = best;
    if (silent) return;
    const out = JSON.stringify({ t: 'keeper', map, n: best.name });
    for (const o of g.members) if (o !== except) this.raw(o.sock, out);
  }

  // ---------- the roster ----------
  online() {
    const list = [];
    for (const k of this.knights.values()) if (k.hello) list.push({ n: k.name, map: k.map, region: k.region, lv: k.lv, since: k.since });
    return list;
  }
  isOnline(name) { const k = this.byName.get(low(name)); return !!(k && k.hello); }

  rosterNow() { this.sendRoster(this.now()); }
  rosterLater() { this.rosterDirty = true; this.arm(); }
  sendRoster(now) {
    this.rosterAt = now;
    this.rosterDirty = false;
    const out = JSON.stringify({ t: 'who', list: this.online().map(({ n, map, region, lv }) => ({ n, map, region, lv })) });
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
    for (const g of Array.from(this.gifts.values())) if (g.due <= now) this.settleGift(g, 'gift_back');
    if (this.rosterDirty && now - this.rosterAt >= ROSTER_EVERY) this.sendRoster(now);
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
