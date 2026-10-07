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
//   room.renamed(from, to)     the World gave a knight a new name: an online one is sent out to come straight back as it
//   room.store                 where roles, mutes, bans, parties, prizes, logins and finished trades live (store.js)
//   room.setSim(sim)           the parent page's shared-world switches ({move: 'observe' | 'off'}, docs/ONLINE.md "The shared world")
//   room.atlas, room.move      the Atlas the world judges by (atlas.js, from opts.atlas) and the movement check (move.js)
//   room.worlds                the maps the world runs itself (sim/worlds.js: the virtual knight '@world:<map>' as their keeper,
//                              Stage 2); room.modeOf(map), room.setMode(map, mode, reason), room.joinVirtual(sock, name, map)
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
// Word strikes (docs/ONLINE.md, "Word strikes"): a chat line with a word of the filter's STRIKE_WORDS in it (a swear word or a
// slur, whole or in a common disguise; never a number, a word hidden in another, an insult or a mild word; starring out
// alone is no strike) is one on the knight's account
// (the store keeps the count, which fades after 30 clean days). The first two are warnings said to the knight alone; the
// third and every one after it sends the knight out (close 4006) and keeps it out for 24 hours, which join and restore
// check here and the World checks on every login, /api call and socket.
//
// Admins (docs/ONLINE.md, "Admins and drop parties"): only the parent page makes one. Every admin message reads
// the sender's role from the store, fresh, before it does anything; the socket's memory is never the lock.
//
// Trades (docs/ONLINE.md, "Trading"): the Room holds both offers and is the only truth about them. It opens a trade
// only between two knights on one map within a few tiles, un-accepts both on any change, and moves nothing until both
// knights accepted and then confirmed the very same offers. A finished trade is a row in the store, re-sent after every
// welcome until each side's game says it is in its save, so nothing is lost or doubled. An open trade lives in memory and
// rides both knights' attachments (when it fits, ATTACH_MAX): a disconnect, a map change, a walk away or a fall ends it, and
// then nothing moves; a nap does not (restore puts it back once both knights are back, exactly as it stood).
// ============================================================================

import { checkChat } from './filter.js';
import { MoveCheck, MoveBook, wireMap } from './move.js';
import { isHouse } from './atlas.js';
import { MemoryStore, ALWAYS, WORD_LOCK_MS } from './store.js';
import { Worlds } from './sim/worlds.js';
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
  boss_wait: { rate: 1, burst: 3 },
};
for (const c of Object.values(CAPS)) if (!c.burst) c.burst = Math.max(2, Math.round(c.rate * 2));

// The shared world (docs/ONLINE.md, "The shared world"): the capabilities a game may name in hello, in this order. 'snap'
// (Stage 2): asked by the world taking over a map it keeps, the game answers once with every monster (sim/worlds.js snap)
export const KNOWN_CAPS = ['tick', 'die', 'roll', 'loot', 'zone', 'fix', 'day', 'snap'];
export const capsOf = c => Array.isArray(c) ? KNOWN_CAPS.filter(n => c.includes(n)) : [];
export const atlasOf = a => typeof a === 'string' && /^[0-9a-z]{1,32}$/.test(a) ? a : null;
// a knight's own island is his alone: the Room keys it by his name, and every message out names it 'house' again.
// A page from an older world (the Great Spread, spec §11: its hello names another Atlas than the world's, or none) is
// keyed apart on every map: 'over' becomes 'over@stale' (STALE), so it never shares presence, monsters, keepers, crackers or
// trades with the new world. Its game still hears its own map's name (move.js wireMap), and the welcome's Atlas hash
// shows it 96-atlas's reload plaque. A world with no Atlas (the tests' bare Rooms) judges nothing and keys nothing apart.
export const STALE = '@stale';
export const mapKey = (k, map) => isHouse(map) ? 'house:' + k.lc : (k.stale ? map + STALE : map);
export const ROSTER_EVERY = 2000;      // a changed roster goes out at most this often (join/leave go at once)
// A keeper whose game has sent neither monsters nor presence for this long while others share its map (a locked phone, a
// sleeping tab; a paused game or one on the title screen with nobody near it: with a knight near, a paused keeper streams its
// frozen monsters and keeps the map) hands the map to the next knight that is playing; it is eligible again once that knight
// leaves. Nothing watches the clock for it while nobody plays (an alarm is a billed request, and two idle knights on one map
// cost about 1,200 an hour when one watched every keeper): the hand-over happens when a knight who is playing there says where
// he is (onPresence, keeperCheck), and a map where nobody is playing has nobody to hand it to. So that it comes as soon as it
// always did (3.05 s after the keeper's last word) even when the one playing stands still (one presence a second), a presence
// that finds the keeper quiet for more than KEEPER_STALE - KEEPER_WATCH asks for one alarm at that moment, for that map only.
export const KEEPER_STALE = 3000;
export const KEEPER_WATCH = 1000;      // ms before KEEPER_STALE that a playing knight's presence books the hand-over's alarm
// A knight whose game sends no presence for this long (a locked phone, a tab in the background: a playing game sends at
// least one a second) is never chosen to keep a map while someone who is playing is there.
export const PRESENCE_STALE = 3500;
// The soonest the Room asks for its next alarm after a tick, when something it could not move on is still due (arm)
export const REARM_MIN = 1000;
export const GIFT_WAIT = 10000;        // no answer to a gift within this: it comes back to the sender
export const ATTACH_MAX = 1800;        // bytes of JSON a socket's attachment may take with an open trade in it (workerd's cap is 2,048)
// How long each mute lasts; 'always' means until an admin (or the parent page) turns chat back on.
export const MUTE_SPANS = { '5m': 5 * 60 * 1000, '1h': 3600 * 1000, '1d': 24 * 3600 * 1000, always: ALWAYS };
export const SPAWN_MAX = 20;           // monsters in one spawn message
export const KICK_TEXT = 'An admin sent you out of the world. You can come back in.';
// Word strikes: what the knight is told (the game says the lockout with the real time it ends, from `until`)
export const WORD_WARN_1 = "That word isn't allowed here. This is your warning.";
export const WORD_WARN_2 = "Last warning. Do it again and you'll be kept out for 24 hours.";
export const WORDS_CODE = 4006;      // the close for a knight kept out for bad words (the wire does not reconnect)
export const RENAMED_CODE = 4007;    // the close for a knight given a new name (the wire reconnects, as the new name)
// The words the world itself says about a lockout (the game builds its own sentence from `until`, in local time).
export function wordsText(until, now) {
  const mins = Math.max(1, Math.ceil((until - now) / 60000)), h = Math.floor(mins / 60), m = mins % 60;
  const left = (h ? h + (h === 1 ? ' hour' : ' hours') : '') + (h && m ? ' ' : '') + (m ? m + (m === 1 ? ' minute' : ' minutes') : '');
  return "You're kept out for " + left + ' more for bad words.';
}
export const renamedText = to => "An admin changed your knight's name to " + to + '.';
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
    // the word filter: {text, masked, strike}. An old-style opts.filter (a string back) still works; it counts no strikes.
    this.check = opts.check || (opts.filter ? (s => ({ text: opts.filter(s), masked: false, strike: false })) : checkChat);
    this.max = opts.max || 50;
    this.wake = opts.wake || (ms => { const t = setTimeout(() => this.tick(), ms); if (t && t.unref) t.unref(); });
    this.store = opts.store || new MemoryStore();
    this.random = typeof opts.random === 'function' ? opts.random : cryptoRandom;
    // the shared world: the Atlas (atlas.js, or null: then nothing is judged) and the watching movement check (move.js)
    this.atlas = opts.atlas || null;
    this.move = new MoveCheck({ atlas: this.atlas, book: opts.moveBook || new MoveBook(null, this.now), now: this.now });
    this.sim = { move: this.move.mode };
    // the shared world, Stage 2: maps whose monsters the world's own game copy runs (the World gives it its SimHost)
    this.worlds = new Worlds(this, { book: opts.simBook || null, save: opts.simSave || (() => { }) });
    this.knights = new Map();   // sock -> knight
    this.byName = new Map();    // lower-case name -> knight
    this.maps = new Map();      // map name -> { members: Set<knight>, keeper: knight|null }
    this.gifts = new Map();     // gid -> { gid, from, to (lower-case names), id, qty, due }
    this.parties = new Map();   // pid -> { id, at, by, map, region, hat, table, expires, crackers: Map k -> {k, tx, ty, litBy} }
    this.trades = new Map();    // id -> an open trade (see openTrade)
    this.nextGid = 1;
    this.nextTradeId = 1;
    this.halfTrades = new Map(); // id -> { k, s }: one side of an open trade restored after a nap, waiting for the other
    this.spawnSeq = 0;
    this.rosterAt = -Infinity;
    this.rosterDirty = false;
    this.wakeAt = null;
    this.loadParties();
    this.arm();
  }

  // The parent page's shared-world switches (the World reads them from settings 'sim'). Stage 1 has one: move.
  setSim(sim, why) {
    const move = sim && (sim.move === 'off' || sim.move === 'observe') ? sim.move : 'observe';
    this.sim = { move };
    this.move.mode = move;
    this.worlds.setSwitches(sim, why || null);
  }
  modeOf(map) { return this.worlds.modeOf(map); }
  setMode(map, mode, reason) { const sw = this.worlds.sw; return this.worlds.setSwitches({ ...sw, maps: { ...sw.maps, [map]: mode }, held: Object.fromEntries(Object.entries(sw.held).filter(([m]) => m !== map)) }, reason || 'parent page'); }
  joinVirtual(sock, name, map) { return this.worlds.joinVirtual(sock, name, map); }

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
  // opts.ip: the place the socket came from (CF-Connecting-IP), kept with the knight only so a third word strike can note
  // where it was sent out from (store.setWordLock); never sent to anyone.
  join(sock, name, opts) {
    if (this.knights.has(sock)) return;
    // the World already refuses a banned knight's login; this is the lock behind it (and the simulations' only one)
    const acc = this.store.account(name);
    if (acc && acc.banned) return this.refuseBanned(sock);
    // kept out for bad words: the World refuses the socket first; this is the lock behind it
    const until = acc ? this.wordLock(acc.lc) : 0;
    if (until) return this.refuseWords(sock, until);
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
    const k = this.makeKnight(sock, { name: String(name), since: this.now(), ip: opts && opts.ip });
    k.role = acc ? acc.role : 'player';   // a name with no account (tests, simulations) is a plain player
    k.loginId = this.loginStart(k.lc, k.since);
    this.attach(k);
  }

  refuseBanned(sock) {
    this.send(sock, { t: 'error', code: 'banned', text: 'this knight is banned' });
    try { sock.close(4003, 'banned'); } catch (e) { }
  }
  refuseWords(sock, until) {
    this.send(sock, { t: 'error', code: 'words', text: wordsText(until, this.now()), until });
    try { sock.close(WORDS_CODE, 'bad words'); } catch (e) { }
  }
  // when a knight kept out for bad words may come back (ms), or 0 when it is not kept out
  wordLock(lc) {
    if (typeof this.store.wordStrikes !== 'function') return 0;
    const w = this.store.wordStrikes(lc, this.now());
    return w && w.lockedUntil > this.now() ? w.lockedUntil : 0;
  }

  // Rebuilds a knight from the state attach() handed out, without telling anyone: the others already know.
  // The role comes from the store again, never from the attachment.
  restore(sock, state) {
    if (!state || !state.name || this.knights.has(sock)) return;
    const acc = this.store.account(state.name);
    if (acc && acc.banned) return this.refuseBanned(sock);
    const until = acc ? this.wordLock(acc.lc) : 0;
    if (until) return this.refuseWords(sock, until);
    const lc = low(state.name);
    const old = this.byName.get(lc);
    if (old) { if (old.since <= state.since) { try { sock.close(4000, 'logged in elsewhere'); } catch (e) { } return; } this.drop(old, 4000, 'logged in elsewhere'); }
    const k = this.makeKnight(sock, state);
    k.restored = true;   // rebuilt by a wake: he has said nothing in this Room yet (retell)
    // keyed again by this world's Atlas: the map name the attachment carried, without any older keying
    k.stale = this.staleAtlas(k.atlas);
    if (k.map && !isHouse(k.map)) k.map = mapKey(k, k.map.endsWith(STALE) ? k.map.slice(0, -STALE.length) : k.map);
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
    if (state.trade) this.restoreTrade(k, state.trade);
    this.arm();
  }

  // An open trade from a knight's attachment (tradeAttach): the first side back waits, the second puts it back as it stood,
  // when both sides carried the very same trade and neither is in another. Anything else stays ended (each game's window
  // hears trade_end gone on its next step, as before).
  restoreTrade(k, s) {
    if (!s || !Number.isInteger(s.id) || s.id < 1 || (s.a !== k.lc && s.b !== k.lc) || s.a === s.b) return;
    if (s.id >= this.nextTradeId) this.nextTradeId = s.id + 1;
    const half = this.halfTrades.get(s.id);
    if (!half) { this.halfTrades.set(s.id, { k, s }); return; }
    this.halfTrades.delete(s.id);
    const o = half.k;
    if (o === k || o.lc !== (s.a === k.lc ? s.b : s.a) || this.knights.get(o.sock) !== o || o.trade || k.trade) return;
    if (JSON.stringify(half.s) !== JSON.stringify(s)) return;
    const offer = { a: Room.cleanOffer(s.offer && s.offer.a), b: Room.cleanOffer(s.offer && s.offer.b) };
    if (!offer.a || !offer.b || (s.stage !== 'offer' && s.stage !== 'confirm') || !Number.isInteger(s.ver)) return;
    const flag = (f, side) => !!(f && f[side] === true);
    const a = s.a === k.lc ? k : o, b = a === k ? o : k;
    const t = { id: s.id, a, b, offer, acc: { a: flag(s.acc, 'a'), b: flag(s.acc, 'b') }, conf: { a: flag(s.conf, 'a'), b: flag(s.conf, 'b') }, stage: s.stage, ver: s.ver };
    this.trades.set(t.id, t);
    a.trade = t; b.trade = t;
  }
  // the open trade as an attachment carries it (both sides carry the same)
  tradeAttach(k) {
    const t = k.trade;
    if (!t || this.trades.get(t.id) !== t) return null;
    return { id: t.id, a: t.a.lc, b: t.b.lc, offer: { a: t.offer.a, b: t.offer.b }, acc: { a: t.acc.a, b: t.acc.b }, conf: { a: t.conf.a, b: t.conf.b }, stage: t.stage, ver: t.ver };
  }

  makeKnight(sock, s) {
    const k = {
      sock, name: s.name, lc: low(s.name), since: s.since || this.now(), ip: typeof s.ip === 'string' ? s.ip.slice(0, 64) : '',
      hello: !!s.hello, map: s.map || null, mapAt: s.mapAt || s.since || this.now(), region: s.region || '', lv: s.lv || 0,
      caps: capsOf(s.caps), atlas: atlasOf(s.atlas),   // what this knight's game can do of the shared world, and its Atlas hash
      stale: false,                       // its Atlas is not the world's: every map it is on is keyed apart (mapKey, STALE)
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

  // Throws a knight out: an error first so the screen can say why, then the close. kicked closes with 4005, banned with
  // 4003 and words (kept out for bad words) with 4006 (the wire reconnects after none of them); renamed with 4007 (the wire
  // comes straight back, as the new name); anything else with 4000.
  kick(name, code, text, extra) {
    const k = this.byName.get(low(name));
    if (!k) return false;
    this.send(k.sock, Object.assign({ t: 'error', code, text }, extra || {}));
    const close = code === 'kicked' ? 4005 : code === 'banned' ? 4003 : code === 'words' ? WORDS_CODE : code === 'renamed' ? RENAMED_CODE : 4000;
    this.drop(k, close, String(text || code).slice(0, 120));
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
      case 'boss_wait': return this.onToKnight(k, m, 'boss_wait', ['id', 'left']);
      case 'ping': return this.send(sock, { t: 'pong' });   // the real server answers this without waking; the sim lands here
      default: return;                                       // unknown t: ignored, as the contract says
    }
  }

  // a page whose Atlas is not this world's (another hash, or none) while this world has one: keyed apart (mapKey)
  staleAtlas(a) { return !!(this.atlas && a !== this.atlas.hash); }

  onHello(k, m) {
    k.hello = true;
    // a save always records the overworld, so a fresh login stands on it until the first presence says otherwise
    k.caps = capsOf(m.caps); k.atlas = atlasOf(m.atlas); k.stale = this.staleAtlas(k.atlas);
    k.map = mapKey(k, (typeof m.map === 'string' && m.map) ? m.map.slice(0, 64) : OVERWORLD);
    const acc = this.store.account(k.name);
    k.role = acc ? acc.role : 'player';
    this.enterMap(k, k.map, { quiet: true });
    const keeper = this.keeperOf(k.map);
    const welcome = { t: 'welcome', me: k.name, at: this.now(), keeper: keeper ? keeper.name : null, role: k.role };
    if (this.atlas) welcome.atlas = this.atlas.hash;
    if (this.worlds.host) welcome.sim = this.worlds.welcomeSim();   // a world that can run maps itself says which
    this.send(k.sock, welcome);
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
    const was = Math.max(k.pAt || 0, k.monAt || 0);   // his last word before this one (keeperCheck)
    k.pAt = this.now();
    if (str.length > MAX_P) return this.strike(k, CAPS.p);
    const map = (typeof m.map === 'string' && m.map) ? mapKey(k, m.map.slice(0, 64)) : k.map;
    let changed = false;
    if (map !== k.map) { this.moveMap(k, map); changed = true; }
    if (typeof m.region === 'string' && m.region.slice(0, 40) !== k.region) { k.region = m.region.slice(0, 40); changed = true; }
    if (typeof m.lv === 'number' && m.lv !== k.lv) { k.lv = m.lv; changed = true; }
    // where the knight stands, for the party, cracker and trade range checks
    if (Number.isFinite(m.x) && Number.isFinite(m.y)) { k.x = m.x; k.y = m.y; }
    k.dead = !!m.dead;
    this.worlds.presence(k, m);   // a world-run map's copy is told where its knights are
    // the movement check only watches (move.js): it never sends, and nothing it finds changes what is relayed
    try { this.move.judge(k, m, this.now()); } catch (e) { }
    // an open trade ends when either knight falls or walks away
    if (k.trade) { const o = this.otherOf(k.trade, k); if (k.dead) this.cancelTrade(k.trade, 'dead', k); else if (!this.within(k, o, TRADE_LEAVE, true)) this.cancelTrade(k.trade, 'far', k); }
    if (changed) { this.attach(k); this.rosterLater(); }
    this.keeperCheck(k, was);   // a quiet keeper on his map hands it to this knight, who is playing (KEEPER_STALE)
    this.retell(k);        // a map a wake rebuilt: everyone on it hears who keeps it, once
    // the role on a relayed p is always the server's word: whatever the sender put there is overwritten
    const out = JSON.stringify(Object.assign({}, m, { t: 'p', n: k.name, map: wireMap(k.map), role: k.role }));
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
    // the line alone: who is on line, who said it and who it was about never change what counts (filter.js, STRIKE_WORDS)
    const { text, strike } = this.check(typeof m.text === 'string' ? m.text : '');
    if (!text) return;
    const at = now;
    this.log(k.name, text, at);
    const out = JSON.stringify({ t: 'chat', n: k.name, text, at, role: k.role });
    for (const o of this.knights.values()) if (o.hello) this.raw(o.sock, out);
    // a swear word or a slur: a strike (after the masked line went out, so the knight sees what was hidden). A line that was
    // only starred out (an insult, a mild word, a word hidden in another) counts nothing.
    if (strike === true && acc) this.wordStrike(k, acc, now, typeof m.text === 'string' ? m.text : '');
  }

  // One more word strike on this knight's account: a warning, a last warning, then out for 24 hours. One mod_log row each,
  // with the line as it was typed after the count ("2: what the shit"), so the parent page can tell whether it was fair (only
  // the parent page reads mod_log; the chat log keeps the starred line).
  wordStrike(k, acc, now, said) {
    const typed = ': ' + String(said || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (typeof this.store.addWordStrike !== 'function') return;
    const n = this.store.addWordStrike(acc.lc, now);
    if (!n) return;
    if (n < 3) {
      this.store.log({ at: now, by: 'word filter', act: 'strike', target: acc.name, detail: String(n) + typed });
      return this.send(k.sock, { t: 'strike', n, text: n === 1 ? WORD_WARN_1 : WORD_WARN_2 });
    }
    const until = now + WORD_LOCK_MS;
    // the place it was sent out from goes with the lockout (no new knight from there until it ends), and with it only
    this.store.setWordLock(acc.lc, until, k.ip || '');
    this.store.log({ at: now, by: 'word filter', act: 'strike', target: acc.name, detail: n + ', kept out 24 hours' + typed });
    this.kick(k.name, 'words', wordsText(until, now), { until, n });
  }

  // The World renamed a knight (the store is already rewritten). An online one is told its new name and sent out; the wire
  // comes straight back with the same session, which now belongs to the new name.
  renamed(from, to) { return this.kick(from, 'renamed', renamedText(to), { name: to }); }

  onMon(k, m) {
    if (!k.hello || !Array.isArray(m.list)) return;
    const g = this.maps.get(k.map);
    const was = Math.max(k.pAt || 0, k.monAt || 0);
    k.monAt = this.now();   // his game is running: alive, whoever keeps the map
    // a game that thinks it keeps a map a wake gave to a knight still silent takes it (keeperCheck); one a wake gave to a knight
    // who has spoken since hears who keeps it (retell)
    if (g && g.keeper !== k) { this.keeperCheck(k, was); this.retell(k); }
    if (!g || g.keeper !== k) return;   // only the keeper's monsters are real; a late snapshot after handoff is dropped
    this.worlds.keeperMon(k, m);        // a copy taking this map over reads the keeper's stream first
    if (g.keeper !== k) return;
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
  // shape and who keeps the map; the keeper's game decides whether the boss may come (on its map, near, not up already,
  // not resting there unless it is the asker's first fight: first is passed on only when it is exactly true). The keeper's
  // answer for a resting boss, boss_wait, goes back to the asker alone through onToKnight, like kill and hurt.
  onBossCall(k, m) {
    if (!k.hello) return;
    const g = this.maps.get(k.map);
    if (!g || !g.keeper || g.keeper === k) return;
    if (typeof m.id !== 'string' || !/^[a-z_]{1,24}$/.test(m.id)) return;
    const out = { t: 'boss_call', n: k.name, id: m.id };
    if (m.first === true) out.first = true;
    this.send(g.keeper.sock, out);
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
    return JSON.stringify({ t: 'crackers', pid: p.id, map: wireMap(p.map), by: p.by, list, left: Math.max(0, p.expires - this.now()) });
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
    this.everyone({ t: 'announce', kind: 'party', n: k.name, region: p.region, map: wireMap(p.map), count: spots.length });
    this.store.log({ at: now, by: k.name, act: 'party', target: p.map, detail: spots.length + ' crackers in ' + (p.region || p.map) + ', party hats 1 in ' + commas(p.hat) });
    this.arm();
  }

  onPartyEnd(k) {
    if (!this.asAdmin(k)) return;
    for (const p of Array.from(this.parties.values())) if (p.map === k.map) this.endParty(p);
  }

  // The Great Spread's deploy step (tools/spread-deploy-step.mjs, spec §11; run only inside the owner-approved deploy): the
  // live parties on a map, and ending them all. Their unlit crackers lie where the old world's places were, so they go; a
  // cracker already lit keeps its prize, claimable as ever (prizes are the store's rows, re-sent after every welcome).
  partiesOn(map) {
    this.expire();
    const out = [];
    for (const p of this.parties.values()) if (p.map === map) {
      const cs = Array.from(p.crackers.values());
      out.push({ id: p.id, by: p.by, region: p.region, at: p.at, expires: p.expires, unlit: cs.filter(c => !c.litBy).length, lit: cs.filter(c => c.litBy).length });
    }
    return out;
  }
  endPartiesOn(map) {
    const list = this.partiesOn(map);
    for (const r of list) { const p = this.parties.get(r.id); if (p) this.endParty(p); }
    return list;
  }

  // A party is over (time up, every cracker lit, or an admin ended it): its unlit crackers are gone for good.
  endParty(p) {
    if (this.parties.get(p.id) !== p) return;
    this.parties.delete(p.id);
    this.store.endParty(p.id);
    const out = JSON.stringify({ t: 'party_end', pid: p.id, map: wireMap(p.map) });
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
    if (!only) { this.attach(t.a); this.attach(t.b); }   // a nap keeps it as it now stands
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
    for (const k of [t.a, t.b]) if (this.knights.get(k.sock) === k) { this.send(k.sock, out); this.attach(k); }
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
    this.attach(a); this.attach(b);
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
    this.worlds.entering(k, map, g);   // a world-run map whose copy is still running: the world keeps it at once
    // the newcomer is the youngest on the map so the keeper only changes when the map was empty
    this.elect(map, quiet ? k : null, silent);
    this.worlds.entered(k, map);
    this.arm();   // with two on a map the keeper's silence is now something to watch for
    if (!quiet) this.send(k.sock, this.worlds.keeperMsg(map, g.keeper));
    // whoever is already here shows up at once, even if they are standing still
    for (const o of g.members) if (o !== k && o.last) this.raw(k.sock, o.last);
  }

  leaveMap(k) {
    const map = k.map;
    const g = this.maps.get(map);
    k.map = null;
    if (!g) return;
    g.members.delete(k);
    const out = JSON.stringify({ t: 'left', n: k.name, map: wireMap(map) });
    for (const o of g.members) this.raw(o.sock, out);
    this.worlds.leaving(k, map, g);
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
    if (this.worlds.holds(map, g)) return;   // a world-run map: the virtual knight is its keeper (sim/worlds.js)
    const now = this.now();
    if (g.keeper && g.keeper.keeperAt == null) g.keeper.keeperAt = now;   // a keeper with no moment yet starts its grace now
    const first = (a, b) => a.mapAt !== b.mapAt ? a.mapAt < b.mapAt : (a.since !== b.since ? a.since < b.since : a.lc < b.lc);
    // A wake (restore, silent) names the knight longest on the map, whatever order the sockets come back in. His grace starts
    // now and holds 3 s against everyone, as on master (a paused keeper's page may still answer). Who the pages were told is not
    // in the sockets; his first word, or elect when his grace runs out, settles it (retell). One restored before him and named
    // for a moment keeps no grace: it would read as a sign of life (silentKnight).
    if (silent) { let best = null; for (const o of g.members) if (!best || first(o, best)) best = o; if (g.keeper && g.keeper !== best) g.keeper.keeperAt = undefined; g.keeper = best; best.keeperAt = now; return; }
    // a keeper that has gone quiet while others are here goes to the back of the line (see KEEPER_STALE)
    const stale = o => o === g.keeper && g.members.size > 1 && now - Math.max(o.monAt || 0, o.pAt || 0, o.keeperAt || 0) > KEEPER_STALE;
    // and a knight whose game has gone silent (see PRESENCE_STALE) is never picked over one who is playing
    // (alive = its presence, its monster stream, or its arrival on the map is recent)
    const silentKnight = o => g.members.size > 1 && now - Math.max(o.pAt || 0, o.monAt || 0, o.keeperAt || 0, o.mapAt || 0) > PRESENCE_STALE;
    const back = o => stale(o) || silentKnight(o);
    const before = (a, b) => { const sa = back(a), sb = back(b); if (sa !== sb) return !sa; return first(a, b); };
    let best = null;
    for (const o of g.members) if (!best || before(o, best)) best = o;
    // The keeper keeps the map while he is playing, and while nobody else there is either: a hand-over is the costly part, and
    // handing a map from one silent knight to another only turns the monsters on a silent page into puppets nobody streams.
    // Nothing watches his quiet moment (due() reads only g.watch); a knight who comes back to his game gives him one
    // KEEPER_STALE to answer (keeperCheck).
    if (g.keeper && g.members.has(g.keeper) && (g.keeper === best || !back(g.keeper) || back(best))) return;
    // a quiet keeper goes to the back of the line for good, not just this once: otherwise it would win the very
    // next election (it is still the longest on the map) and the map would thrash between the two
    const old = g.keeper;
    if (old && stale(old)) old.mapAt = now;
    g.keeper = best; best.keeperAt = now;
    g.told = best;
    const out = JSON.stringify(this.worlds.keeperMsg(map, best));
    for (const o of g.members) if (o !== except) this.raw(o.sock, out);
  }

  // g.told is the keeper everyone on the map was last told of (elect). A wake rebuilds each map from its sockets and names its
  // keeper without a word (restore is silent): the knight longest on the map, and that need not be the knight the pages were
  // told before the nap (the pages kept their own idea through it). Nobody hears anything while he has not spoken since the
  // wake; when his grace runs out unanswered, elect hands the map on and everyone hears it. When
  // he speaks, everyone there hears, once, that he keeps it: his game takes the map (75-coop
  // setKeeper hands its puppets over), the other's turns its monsters to puppets. A name a page already holds changes nothing on
  // it. A world-run map's virtual keeper is told by the world (sim/worlds.js).
  retell(k) {
    const g = k.map && this.maps.get(k.map);
    if (!g || !g.keeper || g.keeper.virtual || g.told === g.keeper) return;
    // a restored keeper who has said nothing since the wake is not named to anyone (as on master, where a wake told nobody): his
    // grace runs out and elect tells everyone who keeps it, or he speaks first and this tells them
    if (g.keeper.restored && !g.keeper.pAt && !g.keeper.monAt) return;
    g.told = g.keeper;
    const out = JSON.stringify(this.worlds.keeperMsg(k.map, g.keeper));
    for (const o of g.members) if (o.hello && !o.virtual) this.raw(o.sock, out);
  }

  // A knight who is playing (his presence or his snapshot just came in) on a map whose keeper has gone quiet: elect again, so the
  // map comes to him. Cheap: one subtraction unless the keeper really is quiet.
  // A keeper quiet for nearly that long books one alarm for the moment it will be (KEEPER_WATCH), so a knight playing but
  // standing still (one presence a second) gets the map as soon as the old alarm gave it; only while someone plays there.
  // `was` is this knight's last word before this one. When he had gone quiet too (a knight coming back to his game, or one a wake
  // restored), a keeper already quiet gets one KEEPER_STALE to answer before the map is his: master's alarm gave a quiet keeper a
  // new grace every 3 s while nobody there played, so a paused keeper's page heard the knight come back, streamed again and kept
  // the map, with every hit on the boss still counted on it. No alarm watches that quiet keeper now; this is the same grace,
  // given when it is needed, with one alarm booked for its end.
  keeperCheck(k, was) {
    const g = k.map && this.maps.get(k.map);
    if (!g || !g.keeper || g.keeper === k || g.keeper.virtual || g.members.size < 2) return;
    const o = g.keeper, now = this.now();
    const heard = Math.max(o.monAt || 0, o.pAt || 0, o.keeperAt || 0);
    if (now - heard > KEEPER_STALE && now - (was || 0) > PRESENCE_STALE) { o.keeperAt = now; g.watch = now + KEEPER_STALE + 50; this.arm(); return; }
    if (now - heard > KEEPER_STALE) { g.watch = null; this.elect(k.map, null); return; }
    if (now - heard > KEEPER_STALE - KEEPER_WATCH && !(g.watch > now)) { g.watch = heard + KEEPER_STALE + 50; this.arm(); }
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
    for (const k of this.knights.values()) if (k.hello) list.push({ n: k.name, map: wireMap(k.map), region: k.region, lv: k.lv, since: k.since, role: k.role });
    return list;
  }
  // the parent page's view of each knight's game for the shared world: his map, his Atlas against the world's, his caps
  knightsView() {
    const out = [];
    for (const k of this.knights.values()) if (k.hello) out.push({ n: k.name, map: wireMap(k.map), atlas: !k.atlas ? 'none' : (this.atlas && k.atlas === this.atlas.hash ? 'same' : 'old'), caps: k.caps.slice() });
    return out;
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
    // (a quiet keeper is an alarm only once a knight playing there has found him nearly stale: keeperCheck, KEEPER_WATCH)
    for (const g of this.maps.values()) if (g.watch != null && (d == null || g.watch < d)) d = g.watch;
    { const w = this.worlds.due(); if (w != null && (d == null || w < d)) d = w; }
    for (const p of this.parties.values()) if (d == null || p.expires < d) d = p.expires;
    for (const k of this.knights.values()) if (k.ask && (d == null || k.ask.due < d)) d = k.ask.due;
    return d;
  }
  arm(after) {
    let d = this.due();
    if (d == null) { this.wakeAt = null; return; }
    // a tick's own re-arm is never at or before the moment it handled: a due that tick could not move on would otherwise ask
    // for wake(0) again and again (and in workerd a re-arm onto the running alarm's own time is dropped, leaving wakeAt stuck
    // in the past, so no alarm would ever be set again on this wake)
    if (after != null && d <= after) d = after + REARM_MIN;
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
    for (const g of this.maps.values()) if (g.watch != null && g.watch <= now) g.watch = null;   // a booked hand-over: one alarm
    for (const map of Array.from(this.maps.keys())) this.elect(map, null);   // a quiet keeper steps down
    this.worlds.tick();   // world-run maps: copies to build, take-overs to finish, a copy gone silent
    this.arm(now);
  }

  // ---------- plumbing ----------
  send(sock, obj) { this.raw(sock, JSON.stringify(obj)); }
  raw(sock, str) { try { sock.send(str); } catch (e) { } }
  attach(k) {
    if (!k.sock.attach) return;
    const gifts = [];
    for (const gid of k.gifts) { const g = this.gifts.get(gid); if (g) gifts.push({ gid: g.gid, to: g.to, id: g.id, qty: g.qty, due: g.due }); }
    const state = { name: k.name, since: k.since, hello: k.hello, map: k.map, mapAt: k.mapAt, region: k.region, lv: k.lv, gifts, loginId: k.loginId, ip: k.ip || '', caps: k.caps, atlas: k.atlas };
    // an open trade goes with it when it fits (a socket's attachment is at most 2,048 bytes; one that does not fit is ended by a
    // nap, as every open trade was before)
    const trade = this.tradeAttach(k);
    if (trade) { state.trade = trade; if (JSON.stringify(state).length > ATTACH_MAX) delete state.trade; }
    try { k.sock.attach(state); } catch (e) { }
  }
}
