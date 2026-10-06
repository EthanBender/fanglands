// ============================================================================
// TEACHERS — the teacher view's tables, its sign-in, and the owner's calls that make, reset and turn off a teacher
// Owner (2026-10-06): "We also need to add an admin view that we can give to Cohen's teachers so that he can monitor the kids
// when they play it at school." docs/ONLINE.md, "The teacher view", is the contract.
//
// A teacher is NOT a knight: a row of `teachers`, never of `accounts`, so no knight route, no /ws and no /api/admin/* call
// ever takes a teacher's token. A teacher signs in on the teacher address only (worker.js adds the door header there and
// strips it everywhere else), gets a session token (only its SHA-256 is kept), trades it for a one-use ticket and opens one
// socket: the watch screen (watch.js), which is never a knight in the Room.
//
//   migrateTeachers(sql)                 the three tables and the two accounts columns, only when missing (every wake)
//   new TeacherBook(sql, now)            every read and write the teacher view makes, plus the tickets and the address window
//   teacherCall(world, req, url, path)   /api/teacher/login | logout | ticket | ws (the World checks the door first)
//   teacherAdminCall(world, req, url, call, method)   /api/admin/teachers* and /api/admin/teacher-acts (ADMIN_KEY, checked
//                                        by world.admin before it gets here); null for any other call
//   dayStart(now, tz), dayEnd(now, tz)   the first and last millisecond of today in that zone (Intl.DateTimeFormat)
// Pure JavaScript over sql.exec and crypto.subtle (both in the Worker and in Node 22+).
// ============================================================================

import { json, oops, readJson, bearer } from './http.js';
import { makeHash, checkPassword, hashPassword, randomHex } from './auth.js';
import { addressOf } from './handoff.js';

export const TEACHER_PASS_MIN = 10, TEACHER_PASS_MAX = 200;
export const TEACHER_TRIES = 5;                  // wrong passwords in a row on one teacher before the wait
export const TEACHER_LOCK_MS = 900000;           // the wait: 15 minutes
export const ADDRESS_FAILS = 20;                 // failed sign-ins from one address in an hour before it waits
export const ADDRESS_WINDOW_MS = 3600000;
export const SESSION_MAX_MS = 36000000;          // 10 hours, or midnight Toronto time if that comes first (D5)
export const SESSIONS_PER_TEACHER = 3;
export const TICKET_MS = 30000;
export const ACTS_PER_WINDOW = 10, ACT_WINDOW_MS = 600000;   // knight actions per teacher in any 10 minutes
export const SENDOFF_PER_DAY = 20;
export const RECENT_LEFT_MS = 1800000;           // a knight who left this recently can still be muted or sent off (D7)
export const TEACHER_TZ = 'America/Toronto';
// "Rest of today" ends at this hour, Toronto time (D4): 24 is midnight; 16 would be 4:00 pm
export const SENDOFF_END = 24;
export const CHAT_BACK_MS = 3600000, CHAT_BACK_LINES = 100;   // the chat a screen opens with
export const SCREENS_MAX = 6, SCREENS_PER_TEACHER = 2;
export const ACTS_KEPT = 2000;
export const NAME_RE = /^[A-Za-z][A-Za-z .'-]{1,39}$/;
export const DOOR = 'x-fanglands-door';
const PARENT = 'parent page';
// an unknown name still costs one PBKDF2, against this salt, so a wrong name and a wrong password take the same time
const DUMMY_SALT = '5f1e0c7d2b9a4e6f8a3c1d0b7e2f9a46';

export const TEACHER_SCHEMA = `
CREATE TABLE IF NOT EXISTS teachers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_lc TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL, off INTEGER NOT NULL DEFAULT 0, tries INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, last_login INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS teacher_sessions (hash TEXT PRIMARY KEY, teacher_id INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS teacher_sessions_by_teacher ON teacher_sessions (teacher_id);
CREATE TABLE IF NOT EXISTS teacher_acts (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, teacher_id INTEGER NOT NULL, teacher TEXT NOT NULL, act TEXT NOT NULL, target TEXT, target_lc TEXT, until INTEGER NOT NULL DEFAULT 0, prev INTEGER NOT NULL DEFAULT 0, undone_at INTEGER NOT NULL DEFAULT 0, undone_by TEXT);
CREATE INDEX IF NOT EXISTS teacher_acts_by_teacher ON teacher_acts (teacher_id, at)
`;
const ACCOUNT_COLUMNS = [['sent_off_until', 'INTEGER NOT NULL DEFAULT 0'], ['sent_off_by', "TEXT NOT NULL DEFAULT ''"]];

// The tables (CREATE TABLE IF NOT EXISTS) and the two accounts columns, added only when missing. Nothing is dropped or
// rewritten; running it again changes nothing. Answers the columns it added.
export function migrateTeachers(sql) {
  for (const stmt of TEACHER_SCHEMA.split(';')) if (stmt.trim()) sql.exec(stmt);
  let cols = [];
  try { cols = sql.exec('PRAGMA table_info(accounts)').toArray().map(r => r.name); } catch (e) { cols = []; }
  if (!cols.length) cols = sql.exec('SELECT * FROM accounts LIMIT 0').columnNames;
  const added = [];
  for (const [name, type] of ACCOUNT_COLUMNS) {
    if (cols.includes(name)) continue;
    sql.exec('ALTER TABLE accounts ADD COLUMN ' + name + ' ' + type);
    added.push(name);
  }
  return added;
}

// ---------- the day, in Toronto time ----------
const fmts = new Map();
function partsAt(ms, tz) {
  let f = fmts.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); fmts.set(tz, f); }
  const p = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: (+p.hour) % 24, mi: +p.minute, s: +p.second };
}
// how far the zone's wall clock is ahead of UTC at that moment (ms)
function offsetAt(ms, tz) { const p = partsAt(ms, tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000; }
// the UTC moment the zone's wall clock reads y-m-d h:00
function wallToUtc(y, m, d, h, tz) {
  const wall = Date.UTC(y, m - 1, d, h);
  let t = wall - offsetAt(wall, tz);
  for (let i = 0; i < 3; i++) { const next = wall - offsetAt(t, tz); if (next === t) break; t = next; }
  return t;
}
export function dayStart(now, tz = TEACHER_TZ) { const p = partsAt(now, tz); return wallToUtc(p.y, p.m, p.d, 0, tz); }
export function dayEnd(now, tz = TEACHER_TZ) {
  const p = partsAt(now, tz), n = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
  return wallToUtc(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate(), 0, tz) - 1;
}
// when a send-off ends (D4): midnight, or SENDOFF_END o'clock today when that is still to come
export function sendOffEnd(now, tz = TEACHER_TZ) {
  if (SENDOFF_END >= 24) return dayEnd(now, tz);
  const p = partsAt(now, tz), t = wallToUtc(p.y, p.m, p.d, SENDOFF_END, tz) - 1;
  return t > now ? t : dayEnd(now, tz);
}

const enc = new TextEncoder();
export async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}
const nameLc = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40);
export const teacherTag = name => String(name) + ' (teacher)';

// ---------------------------------------------------------------------------
// TeacherBook: every read and write of the teacher view (the World keeps one; watch.js and the calls below use it)
// ---------------------------------------------------------------------------
export class TeacherBook {
  constructor(sql, now = () => Date.now()) {
    this.sql = sql; this.now = now;
    this.tickets = new Map();   // ticket -> {sh, exp}: World memory only (a nap forgets them; a page asks again)
    this.fails = new Map();     // address -> {start, n}: failed sign-ins this hour (a nap forgets it, which only lets more through)
    this.actWrites = 0;
  }
  rows(q, ...a) { return this.sql.exec(q, ...a).toArray(); }
  row(q, ...a) { return this.rows(q, ...a)[0] || null; }

  // ---------- teachers ----------
  list() { return this.rows('SELECT id, name, created, off, last_login FROM teachers ORDER BY name_lc'); }
  byId(id) { return Number.isInteger(id) ? this.row('SELECT * FROM teachers WHERE id = ?', id) : null; }
  byName(name) { const lc = nameLc(name); return lc ? this.row('SELECT * FROM teachers WHERE name_lc = ?', lc) : null; }
  add(name, salt, hash, at) { return this.row('INSERT INTO teachers (name, name_lc, salt, hash, created) VALUES (?, ?, ?, ?, ?) RETURNING id', name, nameLc(name), salt, hash, at).id; }
  setSecret(id, salt, hash) { this.sql.exec('UPDATE teachers SET salt = ?, hash = ?, tries = 0, locked_until = 0 WHERE id = ?', salt, hash, id); this.dropSessions(id); }
  setOff(id, off) { this.sql.exec('UPDATE teachers SET off = ? WHERE id = ?', off ? 1 : 0, id); if (off) this.dropSessions(id); }

  // ---------- sessions: the SHA-256 of the token, never the token ----------
  addSession(id, sh, at, expires) {
    this.sql.exec('DELETE FROM teacher_sessions WHERE expires <= ?', at);
    this.sql.exec('INSERT INTO teacher_sessions (hash, teacher_id, created, expires) VALUES (?, ?, ?, ?)', sh, id, at, expires);
    this.sql.exec('DELETE FROM teacher_sessions WHERE teacher_id = ? AND hash NOT IN (SELECT hash FROM teacher_sessions WHERE teacher_id = ? ORDER BY created DESC, rowid DESC LIMIT ?)', id, id, SESSIONS_PER_TEACHER);
  }
  // THE LOCK: one read. {id, name, off, expires} or null; the caller checks off and expires
  lock(sh) {
    if (typeof sh !== 'string' || !sh) return null;
    return this.row('SELECT t.id, t.name, t.off, s.expires FROM teacher_sessions s JOIN teachers t ON t.id = s.teacher_id WHERE s.hash = ?', sh);
  }
  dropSession(sh) { this.sql.exec('DELETE FROM teacher_sessions WHERE hash = ?', sh); }
  dropSessions(id) { this.sql.exec('DELETE FROM teacher_sessions WHERE teacher_id = ?', id); }

  // ---------- tickets: one use, 30 s, memory only ----------
  newTicket(sh, at) {
    if (this.tickets.size > 200) for (const [k, v] of this.tickets) if (v.exp <= at) this.tickets.delete(k);
    const t = randomHex(24);
    this.tickets.set(t, { sh, exp: at + TICKET_MS });
    return t;
  }
  useTicket(t, at) {
    if (typeof t !== 'string' || !t) return null;
    const v = this.tickets.get(t);
    this.tickets.delete(t);
    return v && v.exp > at ? v : null;
  }

  // ---------- actions ----------
  addAct({ at, teacherId, teacher, act, target, targetLc, until, prev }) {
    const id = this.row('INSERT INTO teacher_acts (at, teacher_id, teacher, act, target, target_lc, until, prev) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      at, teacherId, String(teacher), String(act), target == null ? null : String(target), targetLc == null ? null : String(targetLc), Math.floor(until || 0), Math.floor(prev || 0)).id;
    if (++this.actWrites % 50 === 1) this.sql.exec('DELETE FROM teacher_acts WHERE id <= (SELECT id FROM teacher_acts ORDER BY id DESC LIMIT 1 OFFSET ?)', ACTS_KEPT);
    return id;
  }
  act(id) { return Number.isInteger(id) ? this.row('SELECT * FROM teacher_acts WHERE id = ?', id) : null; }
  undo(id, at, by) { this.sql.exec('UPDATE teacher_acts SET undone_at = ?, undone_by = ? WHERE id = ? AND undone_at = 0', at, String(by), id); }
  actsSince(since) { return this.rows('SELECT * FROM teacher_acts WHERE at >= ? ORDER BY id DESC', since); }
  // knight actions by this teacher in the window: mutes and send-offs made, and ones this teacher undid
  knightActs(teacherId, name, since) {
    const r = this.row("SELECT (SELECT COUNT(*) FROM teacher_acts WHERE teacher_id = ? AND act IN ('mute', 'sendoff') AND at > ?) + (SELECT COUNT(*) FROM teacher_acts WHERE undone_by = ? AND act IN ('mute', 'sendoff') AND undone_at > ?) AS n", teacherId, since, String(name), since);
    return Number(r && r.n) || 0;
  }
  sendoffsSince(teacherId, since) { const r = this.row("SELECT COUNT(*) AS n FROM teacher_acts WHERE teacher_id = ? AND act = 'sendoff' AND at >= ?", teacherId, since); return Number(r && r.n) || 0; }
  actsTodayBy(since) { const out = {}; for (const r of this.rows('SELECT teacher_id, COUNT(*) AS n FROM teacher_acts WHERE at >= ? GROUP BY teacher_id', since)) out[r.teacher_id] = Number(r.n) || 0; return out; }
  // the teacher mute in force that set exactly this muted_until on that knight, or null
  muteAct(lc, until) { return until > 0 ? this.row("SELECT * FROM teacher_acts WHERE act = 'mute' AND target_lc = ? AND until = ? AND undone_at = 0 ORDER BY id DESC LIMIT 1", lc, until) : null; }

  // ---------- sent off for the day (accounts columns) ----------
  sentOff(lc) { const r = this.row('SELECT sent_off_until, sent_off_by FROM accounts WHERE name_lc = ?', lc); return r ? { until: Number(r.sent_off_until) || 0, by: r.sent_off_by || '' } : null; }
  setSentOff(lc, until, by) { this.sql.exec('UPDATE accounts SET sent_off_until = ?, sent_off_by = ? WHERE name_lc = ?', Math.floor(until), String(by || ''), lc); }
  // the knights muted or sent off right now: {lc: {name, mutedUntil, sentOffUntil, sentOffBy}}
  inForce(now) {
    const out = {};
    for (const r of this.rows('SELECT name_lc, name, muted_until, sent_off_until, sent_off_by FROM accounts WHERE muted_until > ? OR sent_off_until > ?', now, now)) out[r.name_lc] = { name: r.name, mutedUntil: Number(r.muted_until) || 0, sentOffUntil: Number(r.sent_off_until) || 0, sentOffBy: r.sent_off_by || '' };
    return out;
  }
  recentlyLeft(lc, since) { return !!this.row('SELECT 1 AS y FROM logins WHERE name_lc = ? AND ended > ? LIMIT 1', lc, since); }
  // logins that ended since then, by knight (the newest end): [{n, at}]
  goneSince(since) { return this.rows('SELECT a.name AS n, MAX(l.ended) AS at FROM logins l JOIN accounts a ON a.name_lc = l.name_lc WHERE l.ended > ? GROUP BY l.name_lc', since).map(r => ({ n: r.n, at: Number(r.at) })); }
  admins() { return new Set(this.rows("SELECT name FROM accounts WHERE role = 'admin'").map(r => r.name)); }
  chatSince(since, limit) { return this.rows('SELECT at, name, text FROM chat WHERE at > ? ORDER BY id DESC LIMIT ?', since, limit).reverse(); }

  // ---------- settings: the pause and the notice (one read a wake) ----------
  settings() {
    let pause = null, notice = true;
    for (const r of this.rows("SELECT key, value FROM settings WHERE key IN ('chat_pause', 'teacher_notice')")) {
      if (r.key === 'teacher_notice') notice = r.value !== 'off';
      else { try { const p = JSON.parse(r.value); if (p && Number.isFinite(p.until) && Number.isInteger(p.act)) pause = { until: p.until, by: String(p.by || ''), act: p.act }; } catch (e) { } }
    }
    return { pause, notice };
  }
  setPause(p) {
    if (!p) this.sql.exec("DELETE FROM settings WHERE key = 'chat_pause'");
    else this.sql.exec("INSERT INTO settings (key, value) VALUES ('chat_pause', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", JSON.stringify({ until: p.until, by: p.by, act: p.act }));
  }
  setNotice(on) { this.sql.exec("INSERT INTO settings (key, value) VALUES ('teacher_notice', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", on ? 'on' : 'off'); }

  // ---------- the address window for sign-ins ----------
  addressWait(where, at) {
    const r = this.fails.get(where);
    if (!r || at - r.start >= ADDRESS_WINDOW_MS || r.n < ADDRESS_FAILS) return 0;
    return Math.ceil((r.start + ADDRESS_WINDOW_MS - at) / 1000);
  }
  addressFailed(where, at) {
    if (this.fails.size > 5000) for (const [k, v] of this.fails) if (at - v.start >= ADDRESS_WINDOW_MS) this.fails.delete(k);
    let r = this.fails.get(where);
    if (!r || at - r.start >= ADDRESS_WINDOW_MS) { r = { start: at, n: 0 }; this.fails.set(where, r); }
    r.n++;
  }
}

// ---------------------------------------------------------------------------
// /api/teacher/* — the World calls this only with the door header (else 404 nope)
// ---------------------------------------------------------------------------
export async function teacherCall(world, req, url, path, method) {
  const book = world.teachers;
  if (path === '/api/teacher/login' && method === 'POST') return await login(world, book, req);
  if (path === '/api/teacher/logout' && method === 'POST') {
    const b = await readJson(req).catch(() => ({}));
    const token = typeof b.token === 'string' ? b.token.slice(0, 200) : '';
    if (token) { const sh = await sha256(token); book.dropSession(sh); world.watch.closeSession(sh, 4010); }
    return json({ ok: true });
  }
  if (path === '/api/teacher/ticket' && method === 'POST') {
    const token = bearer(req);
    const sh = token ? await sha256(token.slice(0, 200)) : '';
    const L = book.lock(sh), now = world.now();
    if (!L || L.off || !(L.expires > now)) throw oops(401, 'please sign in again', 'auth');
    return json({ ticket: book.newTicket(sh, now) });
  }
  if (path === '/api/teacher/ws' && method === 'GET') {
    if ((req.headers.get('upgrade') || '').toLowerCase() !== 'websocket') throw oops(426, 'this address is the teacher socket', 'ws');
    const now = world.now();
    const t = book.useTicket(url.searchParams.get('ticket') || '', now);
    const L = t && book.lock(t.sh);
    if (!L || L.off || !(L.expires > now)) throw oops(401, 'please sign in again', 'auth');
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    world.ctx.acceptWebSocket(server);
    // NO name key: the wake loop can never take this socket for a knight
    const att = { w: L.id, sh: t.sh, since: now };
    try { server.serializeAttachment(att); } catch (e) { }
    world.watch.open(world.wrap(server), att);
    return world.upgraded(client);
  }
  throw oops(404, 'no such call', 'nope');
}

async function login(world, book, req) {
  const now = world.now();
  const where = addressOf(req.headers.get('cf-connecting-ip'));
  const wait = book.addressWait(where, now);
  if (wait) throw oops(429, 'too many tries: wait and try again', 'wait', { wait });
  const b = await readJson(req);
  const pass = typeof b.pass === 'string' ? b.pass.slice(0, TEACHER_PASS_MAX + 1) : '';
  const t = book.byName(typeof b.name === 'string' ? b.name : '');
  if (t && t.locked_until > now) throw oops(429, 'too many tries: wait and try again', 'wait', { wait: Math.ceil((t.locked_until - now) / 1000) });
  let ok = false;
  if (t) ok = await checkPassword(pass, t.salt, t.hash);
  else await hashPassword(pass, DUMMY_SALT);
  if (!ok) {
    book.addressFailed(where, now);
    if (t) {
      const tries = (t.locked_until > 0 ? 0 : t.tries) + 1;
      if (tries >= TEACHER_TRIES) {
        world.sql.exec('UPDATE teachers SET tries = 0, locked_until = ? WHERE id = ?', now + TEACHER_LOCK_MS, t.id);
        throw oops(429, 'too many tries: wait and try again', 'wait', { wait: TEACHER_LOCK_MS / 1000 });
      }
      world.sql.exec('UPDATE teachers SET tries = ?, locked_until = 0 WHERE id = ?', tries, t.id);
    }
    throw oops(401, "that name and password don't match", 'nomatch');
  }
  // only after the password is right, so a wrong guess learns nothing
  if (t.off) throw oops(403, 'this sign-in was turned off', 'off');
  const token = randomHex(32), sh = await sha256(token);
  const expires = Math.min(now + SESSION_MAX_MS, dayEnd(now));
  world.sql.exec('UPDATE teachers SET tries = 0, locked_until = 0, last_login = ? WHERE id = ?', now, t.id);
  book.addSession(t.id, sh, now, expires);
  world.store.log({ at: now, by: teacherTag(t.name), act: 'teacher_in', target: 'teacher view', detail: '' });
  return json({ token, name: t.name, expires });
}

// ---------------------------------------------------------------------------
// The owner's calls (world.admin has checked ADMIN_KEY). null: not a teacher call.
// ---------------------------------------------------------------------------
export async function teacherAdminCall(world, req, url, call, method) {
  if (call !== 'teachers' && !call.startsWith('teachers/') && call !== 'teacher-acts') return null;
  const book = world.teachers, now = world.now(), post = method === 'POST';
  const passOf = b => { const p = typeof b.pass === 'string' ? b.pass : ''; if (p.length < TEACHER_PASS_MIN || p.length > TEACHER_PASS_MAX) throw oops(400, 'the password needs 10 to 200 characters', 'pass'); return p; };
  const teacherOf = b => { const t = book.byId(b.id); if (!t) throw oops(404, 'no teacher with that id', 'nope'); return t; };
  const log = (act, target, detail) => world.store.log({ at: now, by: PARENT, act, target, detail: detail || '' });
  if (call === 'teachers' && method === 'GET') {
    const acts = book.actsTodayBy(dayStart(now));
    return json(book.list().map(t => ({ id: t.id, name: t.name, created: t.created, lastLogin: t.last_login || null, off: !!t.off, watching: world.watch.countFor(t.id), actsToday: acts[t.id] || 0 })));
  }
  if (call === 'teachers' && post) {
    const b = await readJson(req);
    const name = typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim() : '';
    if (!NAME_RE.test(name)) throw oops(400, "a teacher's name is 2 to 40 letters, spaces, dots, hyphens or apostrophes, starting with a letter", 'name');
    const pass = passOf(b);
    if (book.byName(name)) throw oops(409, 'there is already a teacher with that name', 'taken');
    const { salt, hash } = await makeHash(pass);
    const id = book.add(name, salt, hash, now);
    log('teacher_add', teacherTag(name));
    return json({ ok: true, id, name });
  }
  if (call === 'teachers/pass' && post) {
    const b = await readJson(req); const t = teacherOf(b); const pass = passOf(b);
    const { salt, hash } = await makeHash(pass);
    book.setSecret(t.id, salt, hash);
    world.watch.closeTeacher(t.id, 4013);
    log('teacher_pass', teacherTag(t.name));
    return json({ ok: true });
  }
  if (call === 'teachers/off' && post) {
    const b = await readJson(req); const t = teacherOf(b);
    book.setOff(t.id, true);
    world.watch.closeTeacher(t.id, 4012);
    log('teacher_off', teacherTag(t.name));
    return json({ ok: true });
  }
  if (call === 'teachers/on' && post) {
    const b = await readJson(req); const t = teacherOf(b); const pass = passOf(b);
    const { salt, hash } = await makeHash(pass);
    book.setSecret(t.id, salt, hash);
    book.setOff(t.id, false);
    log('teacher_on', teacherTag(t.name));
    return json({ ok: true });
  }
  if (call === 'teachers/undo' && post) {
    const b = await readJson(req);
    const r = world.watch.undo(Number.isInteger(b.act) ? b.act : parseInt(b.act, 10), null);
    if (!r.ok) throw r.code === 'unknown' ? oops(404, r.text, 'nope') : oops(409, r.text, r.code);
    return json({ ok: true });
  }
  if (call === 'teachers/notice' && post) {
    const b = await readJson(req);
    const on = b.on === true || b.on === 'on';
    book.setNotice(on);
    world.watch.setNotice(on);
    log('teacher_notice', 'everyone', on ? 'on' : 'off');
    return json({ ok: true });
  }
  if (call === 'teacher-acts' && method === 'GET') return json(world.watch.actsView(now));
  throw oops(404, 'no such admin call', 'nope');
}
