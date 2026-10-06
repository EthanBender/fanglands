// ============================================================================
// THE WATCH — the teacher view's screens and controls (docs/ONLINE.md, "The teacher view")
// A teacher's socket is a WATCH SCREEN, never a knight: it is kept here (screens), never in room.join, so it is in no map, no
// keeper election, no roster, no logins, no presence relay, no trade, no party and no 50-knight cap. The World hands every
// frame from a socket this Watch has to the Watch first; a teacher frame never reaches the Room.
//
//   const watch = new Watch({ room, book, store, sql, now, atlas })   book: teachers.js's TeacherBook; store: the Room's store
//   watch.open(sock, att) / restore(sock, att) / has(sock) / message(sock, str) / leave(sock)
//   watch.closeTeacher(id, code) / closeSession(sh, code) / countFor(id) / setNotice(on) / undo(actId, teacher|null) / actsView(now)
//   watch.hooks                       what the Room calls (room.js opts.hooks): welcomed(k, acc), presence(k, m), left(k),
//                                     chatGate(k, acc, now), chat(line), event(e), sentOff(lc), changed()
//
// Cost (the free plan): nothing here sets a timer or an alarm. A frame of who is where (w_k) is built only on the back of
// something the World is already doing (a knight's presence, a join, a leave, a mute), at most once a second, from memory,
// and only while a screen is open; it is skipped when it says what the last one said (unless that went out 8 s ago).
// Pure JavaScript, no Cloudflare APIs.
// ============================================================================

import { isHouse } from './atlas.js';
import { wireMap } from './move.js';
import { ALWAYS, norm } from './store.js';
import {
  TEACHER_TZ, ACTS_PER_WINDOW, ACT_WINDOW_MS, SENDOFF_PER_DAY, RECENT_LEFT_MS, CHAT_BACK_MS, CHAT_BACK_LINES,
  SCREENS_MAX, SCREENS_PER_TEACHER, dayStart, dayEnd, sendOffEnd, teacherTag,
} from './teachers.js';

export const FRAME_EVERY = 1000;     // ms: at most one w_k a second
export const FRAME_AWAKE = 8000;     // ms: an unchanged w_k still goes out after this (on the back of a presence), so a still world reads as live
export const AWAY_MS = 30000;        // no presence for this long: "Away from the game"
export const FIGHT_MS = 3000;        // a swing this recent: "Fighting"
export const SOCK_RATE = 1, SOCK_BURST = 5, SOCK_DROP = 30;   // a teacher socket's messages a second, its burst, and how many over before 4008
export const PING = '{"t":"ping"}', PONG = '{"t":"pong"}';
export const MUTE_SPANS = { '10m': 600000, '1h': 3600000, today: null };
export const PAUSE_SPANS = { '5m': 300000, '15m': 900000, '1h': 3600000 };
const TILE = 48;
const SPAN_WORDS = { '10m': 'for 10 minutes', '1h': 'for 1 hour', today: 'for the rest of today', '5m': 'for 5 minutes', '15m': 'for 15 minutes' };
export const SENDOFF_TEXT = 'A teacher sent you off Fanglands for the rest of today. Your knight is safe. You can play again tomorrow.';
export const BYE = {
  4010: 'You signed out.',
  4011: 'Your sign-in ran out for today. Sign in again to keep watching.',
  4012: 'Ethan turned this sign-in off.',
  4013: 'Your password was changed. Sign in with the new one.',
  4014: 'Too many teacher screens are open. Close one and try again.',
  4008: 'That was too many taps at once. Sign in again.',
};
// what a knight is doing, in plain words, from the action his game is running (the first that fits)
export const DOING_ACTS = [
  [a => a.startsWith('chop'), 'Chopping trees'],
  [a => a.startsWith('mine') || a === 'coalface' || a === 'rm_vein' || a === 'rm_giant', 'Mining'],
  [a => a === 'fish' || a === 'lobster', 'Fishing'],
  [a => a === 'cook', 'Cooking'],
  [a => a === 'light', 'Lighting a fire'],
  [a => a === 'till', 'Farming'],
  [a => a === 'rm_heat' || a === 'rm_warm' || a === 'rm_watch', 'Working in the Royal Mine'],
];
export const DOING_MOUNTS = { walker: 'In a walker', dozer: 'Driving a bulldozer', beast: 'Riding a beast', horse: 'Riding a horse' };
export const ROW_KEYS = ['n', 'role', 'map', 'place', 'x', 'y', 'doing', 'since', 'away', 'muted', 'sentOff'];

const leftOf = (until, now) => until >= ALWAYS ? -1 : Math.max(0, Math.ceil((until - now) / 1000));
const NO = (req, code, text) => ({ t: 'w_no', req, code, text });

export class Watch {
  constructor({ room, book, store, sql, now, atlas } = {}) {
    this.room = room || null; this.book = book; this.store = store || null; this.sql = sql || (book && book.sql);
    this.now = now || (() => Date.now());
    this.atlasGiven = atlas || null;
    this.screens = new Map();   // sock -> {sock, w, sh, since, name, b: {tokens, at}, over}
    this.seen = new Map();      // lc -> what the last presence said that the Room does not keep: {sw, swAt, act, mech, mv}
    this.mutes = new Map();     // lc -> {until, by: 'teacher' | 'admin'}: the frame is built from memory
    this.gone = new Map();      // lc -> {n, at}: left in the last RECENT_LEFT_MS
    this.offs = new Map();      // lc -> until: sent off for the day
    const st = book ? book.settings() : { pause: null, notice: true };   // one read a wake
    this.pause = st.pause; this.notice = st.notice;
    this.lastKey = null; this.lastSentAt = -Infinity; this.lastBuildAt = -Infinity;
    this.frames = 0;            // w_k frames sent (the tests read it)
    this.hooks = {
      welcomed: (k, acc) => this.welcomed(k, acc),
      presence: (k, m) => this.presence(k, m),
      left: k => this.left(k),
      chatGate: (k, acc, now) => this.chatGate(k, acc, now),
      chat: line => this.chat(line),
      event: e => this.event(e),
      sentOff: lc => this.sentOff(lc),
      changed: () => this.frame(true),
    };
  }
  get atlas() { return this.atlasGiven || (this.room && this.room.atlas) || null; }

  // ---------- screens ----------
  has(sock) { return this.screens.has(sock); }
  countFor(id) { let n = 0; for (const s of this.screens.values()) if (s.w === id) n++; return n; }
  send(sock, obj) { try { sock.send(JSON.stringify(obj)); } catch (e) { } }
  toAll(obj) { const s = JSON.stringify(obj); for (const sc of this.screens.values()) { try { sc.sock.send(s); } catch (e) { } } }
  // the lock: the session row is there, the teacher is on, the time is not up. {L} or {code: 4011 | 4012}
  check(sh) {
    const L = this.book.lock(sh), now = this.now();
    if (!L) return { code: 4011 };
    if (L.off) return { code: 4012 };
    if (!(L.expires > now)) return { code: 4011 };
    return { L };
  }
  bye(sock, code) {
    this.send(sock, { t: 'w_bye', code, text: BYE[code] || '' });
    this.leave(sock);
    try { sock.close(code, 'teacher'); } catch (e) { }
  }

  open(sock, att) {
    const c = this.check(att && att.sh);
    if (!c.L) return this.bye(sock, c.code);
    if (this.screens.size >= SCREENS_MAX || this.countFor(c.L.id) >= SCREENS_PER_TEACHER) return this.bye(sock, 4014);
    const now = this.now();
    this.screens.set(sock, { sock, w: c.L.id, sh: att.sh, since: att.since || now, name: c.L.name, b: { tokens: SOCK_BURST, at: now }, over: 0 });
    this.send(sock, { t: 'w_hello', me: c.L.name, expires: c.L.expires, now, tz: TEACHER_TZ, notice: this.notice });
    this.send(sock, this.allFrame(now));
    if (this.screens.size === 1 && this.notice) this.tellKnights({ t: 'watching', on: true });
  }
  // a wake: the socket comes back as the screen it was, silently, if its session still holds; a dead one is closed
  restore(sock, att) {
    if (!att || !Number.isInteger(att.w) || this.screens.has(sock)) return;
    const c = this.check(att.sh);
    if (!c.L || c.L.id !== att.w) return this.bye(sock, c.code || 4011);
    const now = this.now();
    this.screens.set(sock, { sock, w: c.L.id, sh: att.sh, since: att.since || now, name: c.L.name, b: { tokens: SOCK_BURST, at: now }, over: 0 });
  }
  leave(sock) {
    if (!this.screens.delete(sock)) return;
    if (this.screens.size === 0 && this.notice) this.tellKnights({ t: 'watching', on: false });
  }
  closeTeacher(id, code) { for (const s of Array.from(this.screens.values())) if (s.w === id) this.bye(s.sock, code); }
  closeSession(sh, code) { for (const s of Array.from(this.screens.values())) if (s.sh === sh) this.bye(s.sock, code); }
  setNotice(on) {
    const was = this.notice; this.notice = !!on;
    if (was !== this.notice && this.screens.size) this.tellKnights({ t: 'watching', on: this.notice });
  }
  tellKnights(obj) { if (this.room) this.room.everyone(obj); }

  // ---------- a frame from a teacher socket ----------
  message(sock, str) {
    const s = this.screens.get(sock);
    if (!s || typeof str !== 'string') return;
    if (str === PING) return this.send(sock, JSON.parse(PONG));   // the runtime answers this itself; a simulation lands here
    if (str.length > 2000) return;
    let m = null; try { m = JSON.parse(str); } catch (e) { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string' || !/^w_[a-z]+$/.test(m.t)) return;
    const req = Number.isInteger(m.req) ? m.req : null;
    // 1. the lock
    const c = this.check(s.sh);
    if (!c.L || c.L.id !== s.w) { this.send(sock, NO(req, 'auth', 'Sign in again.')); return this.bye(sock, c.code || 4011); }
    s.name = c.L.name;
    // 2. the socket's own rate
    const now = this.now();
    s.b.tokens = Math.min(SOCK_BURST, s.b.tokens + Math.max(0, now - s.b.at) / 1000 * SOCK_RATE); s.b.at = now;
    if (s.b.tokens < 1) {
      if (++s.over >= SOCK_DROP) return this.bye(sock, 4008);
      return this.send(sock, NO(req, 'slow', "That's a lot at once. Wait a moment."));
    }
    s.b.tokens -= 1;
    const me = { id: c.L.id, name: c.L.name };
    let out = null;
    switch (m.t) {
      case 'w_mute': out = this.doMute(me, m, now); break;
      case 'w_off': out = this.doOff(me, m, now); break;
      case 'w_pause': out = this.doPause(me, m, now); break;
      case 'w_chaton': out = this.doChatOn(me, now); break;
      case 'w_undo': out = this.undo(Number.isInteger(m.act) ? m.act : -1, me); break;
      default: return;   // anything else is ignored
    }
    this.send(sock, out.ok ? { t: 'w_ok', req, text: out.text } : NO(req, out.code, out.text));
  }

  // 3-5: the teacher's rate, the day's send-offs, and the knight (online or just left, an account, not an admin)
  knight(me, raw, now, sendoff) {
    if (this.book.knightActs(me.id, me.name, now - ACT_WINDOW_MS) >= ACTS_PER_WINDOW) return { code: 'slow', text: "That's a lot at once. Wait a few minutes, or ask Ethan." };
    if (sendoff && this.book.sendoffsSince(me.id, dayStart(now)) >= SENDOFF_PER_DAY) return { code: 'daycap', text: "You've sent " + SENDOFF_PER_DAY + ' knights off today. Ask Ethan.' };
    const asked = typeof raw === 'string' && raw.length <= 40 ? raw : '';
    const acc = asked && this.store.account(asked);
    if (!acc) return { code: 'unknown', text: 'No knight by that name.' };
    if (acc.role === 'admin') return { code: 'admin', text: acc.name + ' is an admin. Only Ethan can do that.' };
    const on = this.room && this.room.isOnline(acc.name);
    if (!on && !this.book.recentlyLeft(acc.lc, now - RECENT_LEFT_MS)) return { code: 'gone', text: acc.name + ' is not on now.' };
    return { acc };
  }

  doMute(me, m, now) {
    if (!Object.prototype.hasOwnProperty.call(MUTE_SPANS, m.span)) return { code: 'bad', text: 'Pick how long.' };
    const k = this.knight(me, m.n, now, false); if (!k.acc) return k;
    const acc = k.acc, until = m.span === 'today' ? dayEnd(now) : now + MUTE_SPANS[m.span], prev = acc.mutedUntil;
    if (prev >= until) return { code: 'longer', text: acc.name + ' is already muted for longer.' };
    this.store.setMute(acc.lc, until);
    const id = this.book.addAct({ at: now, teacherId: me.id, teacher: me.name, act: 'mute', target: acc.name, targetLc: acc.lc, until, prev });
    this.store.log({ at: now, by: teacherTag(me.name), act: 'mute', target: acc.name, detail: m.span });
    this.mutes.set(acc.lc, { until, by: 'teacher' });
    if (this.room) this.room.muteChanged(acc.name, 'teacher', { span: m.span });
    this.afterAct(now, me.name + ' muted ' + acc.name + ' ' + SPAN_WORDS[m.span] + '.', acc.name, id);
    return { ok: true, text: acc.name + ' is muted ' + SPAN_WORDS[m.span] + '.' };
  }

  doOff(me, m, now) {
    const k = this.knight(me, m.n, now, true); if (!k.acc) return k;
    const acc = k.acc, until = sendOffEnd(now), cur = this.book.sentOff(acc.lc) || { until: 0 };
    if (cur.until >= until) return { code: 'longer', text: acc.name + ' is already sent off for today.' };
    this.book.setSentOff(acc.lc, until, me.name);
    const id = this.book.addAct({ at: now, teacherId: me.id, teacher: me.name, act: 'sendoff', target: acc.name, targetLc: acc.lc, until, prev: cur.until });
    this.store.log({ at: now, by: teacherTag(me.name), act: 'sendoff', target: acc.name, detail: 'until ' + new Date(until).toISOString() });
    this.offs.set(acc.lc, until);
    // the kid's game saves and pushes on `kicked` and never reconnects after 4005; the knight and its save are untouched
    if (this.room) this.room.kick(acc.name, 'kicked', SENDOFF_TEXT, { why: 'sentoff', until });
    this.afterAct(now, me.name + ' sent ' + acc.name + ' off for the rest of the day.', acc.name, id);
    return { ok: true, text: acc.name + ' was sent off until tomorrow.' };
  }

  doPause(me, m, now) {
    if (!Object.prototype.hasOwnProperty.call(PAUSE_SPANS, m.span)) return { code: 'bad', text: 'Pick how long.' };
    const until = now + PAUSE_SPANS[m.span], cur = this.pauseNow(now);
    if (cur && cur.until >= until) return { code: 'longer', text: 'Chat is already paused for longer.' };
    const id = this.book.addAct({ at: now, teacherId: me.id, teacher: me.name, act: 'pause', target: 'everyone', targetLc: null, until, prev: cur ? cur.until : 0 });
    this.pause = { until, by: me.name, act: id };
    this.book.setPause(this.pause);
    this.store.log({ at: now, by: teacherTag(me.name), act: 'chat_pause', target: 'everyone', detail: m.span });
    this.tellKnights({ t: 'chat_pause', left: leftOf(until, now) });
    this.afterAct(now, me.name + ' paused chat for everyone ' + SPAN_WORDS[m.span] + '.', null, id);
    return { ok: true, text: 'Chat is paused ' + SPAN_WORDS[m.span] + '.' };
  }

  doChatOn(me, now) {
    const cur = this.pauseNow(now);
    if (!cur) return { code: 'none', text: 'Chat is already on.' };
    return this.undo(cur.act, me, 'chaton');
  }
  pauseNow(now) { return this.pause && this.pause.until > now ? this.pause : null; }

  // Undo one teacher action: by a teacher (me) or the owner (me null). Only when what it set is still what is there.
  undo(actId, me, how) {
    const now = this.now();
    const a = this.book.act(actId);
    if (!a) return { code: 'unknown', text: 'That is not on the list.' };
    const who = me ? me.name : 'Ethan', by = me ? teacherTag(me.name) : 'parent page', undoneBy = me ? me.name : 'Ethan';
    const changed = { code: 'changed', text: 'Someone else changed that since, so it was left as it is.' };
    if (a.undone_at) return changed;
    if (a.act === 'mute' || a.act === 'sendoff') {
      const acc = this.targetOf(a); if (!acc) return changed;
      if (a.act === 'mute') {
        if (acc.mutedUntil !== a.until) return changed;
        if (a.until <= now) return { code: 'over', text: 'That is already over.' };
        if (me) { const k = this.knight(me, acc.name, now, false); if (k.code === 'slow') return k; }
        const back = a.prev > now ? a.prev : 0;
        this.store.setMute(acc.lc, back);
        this.book.undo(a.id, now, undoneBy);
        this.store.log({ at: now, by, act: 'unmute', target: acc.name, detail: 'undo' });
        const prevBy = back && this.book.muteAct(acc.lc, back) ? 'teacher' : undefined;
        this.mutes.set(acc.lc, { until: back, by: prevBy || 'admin' });
        if (this.room) this.room.muteChanged(acc.name, back ? prevBy : 'teacher');
        this.afterAct(now, who + " turned " + acc.name + "'s chat back on.", acc.name, a.id);
        return { ok: true, text: acc.name + ' can chat again.' };
      }
      const cur = this.book.sentOff(acc.lc) || { until: 0 };
      if (cur.until !== a.until) return changed;
      if (a.until <= now) return { code: 'over', text: 'That is already over.' };
      if (me) { const k = this.knight(me, acc.name, now, false); if (k.code === 'slow') return k; }
      this.book.setSentOff(acc.lc, 0, '');
      this.book.undo(a.id, now, undoneBy);
      this.store.log({ at: now, by, act: 'letback', target: acc.name, detail: 'undo' });
      this.offs.delete(acc.lc);
      this.afterAct(now, who + ' let ' + acc.name + ' back in.', acc.name, a.id);
      return { ok: true, text: acc.name + ' can play again.' };
    }
    if (a.act === 'pause') {
      const cur = this.pauseNow(now);
      if (!cur || cur.act !== a.id) return a.until <= now ? { code: 'over', text: 'That is already over.' } : changed;
      this.pause = null;
      this.book.setPause(null);
      this.book.undo(a.id, now, undoneBy);
      this.store.log({ at: now, by, act: 'chat_on', target: 'everyone', detail: how === 'chaton' ? '' : 'undo' });
      this.tellKnights({ t: 'chat_pause', left: 0 });
      this.afterAct(now, who + ' turned chat back on.', null, a.id);
      return { ok: true, text: 'Chat is back on.' };
    }
    return changed;
  }
  // the knight an act was about: by its lower-case name, else the name a rename gave it since
  targetOf(a) {
    let acc = a.target_lc ? this.store.account(a.target_lc) : null;
    if (!acc && a.target_lc && typeof this.store.renamedFrom === 'function') { const to = this.store.renamedFrom(a.target_lc); if (to) acc = this.store.account(to); }
    return acc || null;
  }
  // after every action: every screen hears the new list and one line for its chat, and a fresh frame
  afterAct(now, text, n, actId) {
    this.toAll(Object.assign({ t: 'w_acts' }, this.actsPart(now)));
    this.toAll({ t: 'w_event', at: now, kind: 'teacher', n: n || null, text, act: actId });
    this.frame(true);
  }

  // ---------- what the screens see ----------
  // today's teacher actions (every teacher), newest first, with whether each is still in force
  actsView(now) {
    const live = this.book.inForce(now), pause = this.pauseNow(now);
    return this.book.actsSince(dayStart(now)).map(a => {
      let inForce = false;
      if (!a.undone_at && a.until > now) {
        if (a.act === 'pause') inForce = !!pause && pause.act === a.id;
        else {
          let r = live[a.target_lc];
          if (!r && typeof this.store.renamedFrom === 'function') { const to = this.store.renamedFrom(a.target_lc); if (to) r = live[norm(to)]; }
          inForce = !!r && (a.act === 'mute' ? r.mutedUntil === a.until : r.sentOffUntil === a.until);
        }
      }
      return { id: a.id, at: a.at, teacher: a.teacher, act: a.act, target: a.target, until: a.until, prev: a.prev, undoneAt: a.undone_at || 0, undoneBy: a.undone_by || null, inForce };
    });
  }
  actsPart(now) {
    const acts = this.actsView(now), live = this.book.inForce(now), sentOff = [];
    this.offs.clear();
    for (const [lc, r] of Object.entries(live)) {
      if (!(r.sentOffUntil > now)) continue;
      this.offs.set(lc, r.sentOffUntil);
      const a = acts.find(x => x.act === 'sendoff' && x.inForce && x.until === r.sentOffUntil && norm(x.target) === lc) || acts.find(x => x.act === 'sendoff' && x.inForce && x.until === r.sentOffUntil);
      sentOff.push({ n: r.name, until: r.sentOffUntil, by: r.sentOffBy, act: a ? a.id : null });
    }
    sentOff.sort((x, y) => x.n.localeCompare(y.n));
    const p = this.pauseNow(now);
    return { acts, sentOff, chatPause: p ? { until: p.until, by: p.by, act: p.act } : null };
  }
  allFrame(now) {
    const part = this.actsPart(now);
    for (const g of this.book.goneSince(now - RECENT_LEFT_MS)) { const lc = norm(g.n), had = this.gone.get(lc); if (!had || had.at < g.at) this.gone.set(lc, g); }
    const admins = this.book.admins();
    const chat = this.book.chatSince(now - CHAT_BACK_MS, CHAT_BACK_LINES).map(r => ({ at: r.at, n: r.name, text: r.text, role: admins.has(r.name) ? 'admin' : 'player', masked: false }));
    const body = this.knightsBody(now);
    return Object.assign({ t: 'w_all', at: now }, body, part, { chat });
  }

  // One knight, exactly ROW_KEYS, from memory
  rowOf(k, now) {
    const map = wireMap(k.map) || 'over';
    const over = map === 'over';
    const seen = this.seen.get(k.lc) || {};
    const heard = k.pAt || k.mapAt || k.since || 0;
    const away = now - heard > AWAY_MS;
    let mu = this.mutes.get(k.lc);
    if (!mu) { const acc = this.store.account(k.name); mu = this.muteOf(k.lc, acc ? acc.mutedUntil : 0); this.mutes.set(k.lc, mu); }
    return {
      n: k.name, role: k.role === 'admin' ? 'admin' : 'player', map, place: this.placeOf(k, map),
      x: over && Number.isFinite(k.x) ? Math.round(k.x) : null, y: over && Number.isFinite(k.y) ? Math.round(k.y) : null,
      doing: this.doingOf(k, seen, now, away), since: k.since, away,
      muted: mu.until > now ? { left: leftOf(mu.until, now), by: mu.by } : null,
      sentOff: this.offs.get(k.lc) || 0,
    };
  }
  muteOf(lc, until) {
    if (!(until > this.now())) return { until: 0, by: 'admin' };
    return { until, by: this.book.muteAct(lc, until) ? 'teacher' : 'admin' };
  }
  placeOf(k, map) {
    const A = this.atlas;
    if (map === 'house' || isHouse(k.map)) return 'Their own island';
    if (A && map === 'over' && Number.isFinite(k.x) && Number.isFinite(k.y)) { const p = A.place('over', Math.floor(k.x / TILE), Math.floor(k.y / TILE)); if (p && p.name) return p.name; }
    if (A && map !== 'over') { const p = A.get(map); if (p && p.name) return p.name; }
    return 'Somewhere in the world';
  }
  doingOf(k, seen, now, away) {
    if (away) return 'Away from the game';
    if (k.dead) return 'Fell, getting back up';
    if (k.trade && this.room) { const o = this.room.otherOf(k.trade, k); if (o) return 'Trading with ' + o.name; }
    if (seen.swAt && now - seen.swAt <= FIGHT_MS) return 'Fighting';
    if (typeof seen.act === 'string' && seen.act) { for (const [test, words] of DOING_ACTS) if (test(seen.act)) return words; return 'Busy'; }
    if (seen.mech && DOING_MOUNTS[seen.mech]) return DOING_MOUNTS[seen.mech];
    if (seen.mv) return 'Walking';
    return 'Standing still';
  }
  knightsBody(now) {
    const knights = [];
    if (this.room) for (const k of this.room.knights.values()) if (k.hello && !k.virtual) knights.push(this.rowOf(k, now));
    knights.sort((a, b) => a.n.toLowerCase() < b.n.toLowerCase() ? -1 : a.n.toLowerCase() > b.n.toLowerCase() ? 1 : 0);
    const groups = new Map();
    for (const r of knights) if (r.map !== 'over') { if (!groups.has(r.place)) groups.set(r.place, []); groups.get(r.place).push(r.n); }
    const inside = Array.from(groups, ([place, names]) => ({ place, names })).sort((a, b) => a.place.localeCompare(b.place));
    const on = new Set(knights.map(r => r.n.toLowerCase())), gone = [];
    for (const [lc, g] of this.gone) { if (now - g.at > RECENT_LEFT_MS) { this.gone.delete(lc); continue; } if (!on.has(lc)) gone.push({ n: g.n, at: g.at }); }
    gone.sort((a, b) => b.at - a.at);
    return { knights, inside, gone };
  }
  // w_k: at most once a second (force: a join, a leave, a mute, an action: at once), never the same twice running unless
  // FRAME_AWAKE has passed, and only while a screen is open. No timer: the next presence carries what waits.
  frame(force) {
    if (!this.screens.size) return;
    const now = this.now();
    if (!force && now - this.lastBuildAt < FRAME_EVERY) return;
    this.lastBuildAt = now;
    const body = this.knightsBody(now), key = JSON.stringify(body);
    if (key === this.lastKey && now - this.lastSentAt < FRAME_AWAKE) return;
    this.lastKey = key; this.lastSentAt = now; this.frames++;
    this.toAll(Object.assign({ t: 'w_k', at: now }, body));
  }

  // ---------- the Room's hooks ----------
  welcomed(k, acc) {
    const now = this.now();
    this.gone.delete(k.lc);
    if (acc) this.mutes.set(k.lc, this.muteOf(k.lc, acc.mutedUntil));
    const p = this.pauseNow(now);
    if (p) this.room.send(k.sock, { t: 'chat_pause', left: leftOf(p.until, now) });
    if (this.screens.size && this.notice) this.room.send(k.sock, { t: 'watching', on: true });
    this.frame(true);
  }
  presence(k, m) {
    if (!this.screens.size) return;
    const now = this.now();
    let s = this.seen.get(k.lc);
    if (!s) { s = {}; this.seen.set(k.lc, s); }
    if (typeof m.sw === 'number') { if (s.sw != null && m.sw !== s.sw) s.swAt = now; s.sw = m.sw; }
    s.act = typeof m.act === 'string' ? m.act.slice(0, 24) : null;
    s.mech = m.mech && typeof m.mech === 'object' && typeof m.mech.kind === 'string' ? m.mech.kind : (m.look && typeof m.look === 'object' && m.look.mount ? 'horse' : null);
    s.mv = !!m.mv;
    this.frame(false);
  }
  left(k) {
    const now = this.now();
    this.gone.set(k.lc, { n: k.name, at: now });
    this.seen.delete(k.lc);
    this.frame(true);
  }
  // a player's line while a teacher's pause runs: not relayed, not logged, never a strike; admins talk on
  chatGate(k, acc, now) {
    const p = this.pauseNow(now);
    if (!p) return false;
    const role = acc ? acc.role : 'player';
    if (role === 'admin') return false;
    this.room.send(k.sock, { t: 'muted', left: leftOf(p.until, now), by: 'pause' });
    return true;
  }
  chat(line) {
    if (!this.screens.size) return;
    this.toAll({ t: 'w_chat', at: line.at, n: line.n, text: line.text, role: line.role === 'admin' ? 'admin' : 'player', masked: !!line.masked });
  }
  // what the world did that a teacher should see: the word filter, an admin sending a knight out, an admin's mute
  event(e) {
    if (!e || typeof e.kind !== 'string') return;
    const now = this.now(), lc = e.lc || norm(e.n);
    if (e.kind === 'mute' || e.kind === 'unmute') {
      this.mutes.set(lc, e.kind === 'mute' ? { until: e.until, by: e.by === 'teacher' ? 'teacher' : 'admin' } : { until: 0, by: 'admin' });
      if (e.kind === 'mute' && e.by !== 'teacher' && this.screens.size) this.toAll({ t: 'w_event', at: now, kind: 'mute_admin', n: e.n, text: e.n + ' is muted by an admin.' });
      return this.frame(true);
    }
    if (!this.screens.size) return;
    const text = e.kind === 'strike' ? 'The word filter warned ' + e.n + '.'
      : e.kind === 'words' ? 'The word filter sent ' + e.n + ' out for 24 hours.'
        : (e.kind === 'kick' || e.kind === 'ban') ? 'An admin sent ' + e.n + ' out of the world.' : null;
    if (text) this.toAll({ t: 'w_event', at: now, kind: e.kind, n: e.n, text });
  }
  // the Room asks at join and restore: sent off for the day until when (0: not)
  sentOff(lc) {
    const r = this.book.sentOff(lc), now = this.now();
    return r && r.until > now ? r.until : 0;
  }
}
