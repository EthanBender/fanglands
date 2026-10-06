// ============================================================================
// TEACHERS — the teacher view's tables, its sign-in, and the owner's calls that make, reset and turn off a teacher
// Owner (2026-10-06): "We also need to add an admin view that we can give to Cohen's teachers so that he can monitor the kids
// when they play it at school." docs/ONLINE.md, "The teacher view", is the contract.
//
// A teacher is NOT a knight: a row of `teachers`, never of `accounts`, so no knight route, no /ws and no /api/admin/* call
// ever takes a teacher's token. A teacher signs in on the game's own card at POST /api/login (round 2: one sign-in, no
// separate address): the World tries the knight first and only when no knight has that name, and the card said it can take a
// teacher's answer (teacherOk: 1), comes here (teacherLogin). She gets a session token (only its SHA-256 is kept), trades it
// for a one-use ticket and opens one socket: the teacher screen (watch.js), which is never a knight in the Room.
//
//   migrateTeachers(sql)                 the three tables and the two accounts columns, only when missing (every wake)
//   new TeacherBook(sql, now)            every read and write the teacher view makes, plus the tickets and the address window
//   teacherLogin(world, {name, pass, addr})   the teacher half of POST /api/login (world.login falls through to it)
//   teacherCall(world, req, url, path)   /api/teacher/logout | ticket | ws (on every game address; no door)
//   teacherAdminCall(world, req, url, call, method)   /api/admin/teachers* and /api/admin/teacher-acts (ADMIN_KEY, checked
//                                        by world.admin before it gets here); null for any other call
//   dayStart(now, tz), dayEnd(now, tz)   the first and last millisecond of today in that zone (Intl.DateTimeFormat)
// Pure JavaScript over sql.exec and crypto.subtle (both in the Worker and in Node 22+).
// ============================================================================

import { json, oops, readJson, bearer } from './http.js';
import { makeHash, checkPassword, hashPassword, randomHex } from './auth.js';

export const TEACHER_PASS_MIN = 10, TEACHER_PASS_MAX = 200;
// The sign-in locks are kept per ADDRESS AND NAME, in World memory (a nap forgets them, which only lets more through), so a
// guess from one place never refuses the right password from another (a kid at home cannot lock a teacher out at school),
// and an unknown name is counted exactly like a real one (the answers never tell which names exist).
export const TEACHER_TRIES = 5;                  // wrong passwords in a row from one address on one name before the wait
export const TEACHER_LOCK_MS = 900000;           // the wait: 15 minutes (that address, that name)
export const ADDRESS_FAILS = 20;                 // failed sign-ins from one address in an hour: then it waits, on the names it failed
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
const PARENT = 'parent page';
// an unknown name still costs one PBKDF2, against this salt, so a wrong name and a wrong password take the same time
const DUMMY_SALT = '5f1e0c7d2b9a4e6f8a3c1d0b7e2f9a46';

export const TEACHER_SCHEMA = `
CREATE TABLE IF NOT EXISTS teachers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_lc TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL, off INTEGER NOT NULL DEFAULT 0, tries INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, last_login INTEGER NOT NULL DEFAULT 0, tried_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS teacher_sessions (hash TEXT PRIMARY KEY, teacher_id INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS teacher_sessions_by_teacher ON teacher_sessions (teacher_id);
CREATE TABLE IF NOT EXISTS teacher_acts (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, teacher_id INTEGER NOT NULL, teacher TEXT NOT NULL, act TEXT NOT NULL, target TEXT, target_lc TEXT, until INTEGER NOT NULL DEFAULT 0, prev INTEGER NOT NULL DEFAULT 0, undone_at INTEGER NOT NULL DEFAULT 0, undone_by TEXT);
CREATE INDEX IF NOT EXISTS teacher_acts_by_teacher ON teacher_acts (teacher_id, at);
CREATE TABLE IF NOT EXISTS chat_masked (id INTEGER PRIMARY KEY)
`;
// chat_masked: the ids of chat rows the word filter starred something in (one row per such line, none for the rest), so a
// screen opened later still flags them. A table of its own: the chat table itself is never altered.
// Columns added to tables that already exist, only when missing:
//   accounts: the send-off;  teachers: tried_at, when `tries` (wrong passwords today, for the owner's list; never a lock) was last counted.
const ADDED_COLUMNS = [
  ['accounts', 'sent_off_until', 'INTEGER NOT NULL DEFAULT 0'], ['accounts', 'sent_off_by', "TEXT NOT NULL DEFAULT ''"],
  ['teachers', 'tried_at', 'INTEGER NOT NULL DEFAULT 0'],
];
function columnsOf(sql, table) {
  let cols = [];
  try { cols = sql.exec('PRAGMA table_info(' + table + ')').toArray().map(r => r.name); } catch (e) { cols = []; }
  if (!cols.length) { try { cols = sql.exec('SELECT * FROM ' + table + ' LIMIT 0').columnNames || []; } catch (e) { cols = []; } }
  return cols;
}

// The tables (CREATE TABLE IF NOT EXISTS) and the added columns, added only when missing. Nothing is dropped or
// rewritten; running it again changes nothing. Answers the columns it added ("table.column").
export function migrateTeachers(sql) {
  for (const stmt of TEACHER_SCHEMA.split(';')) if (stmt.trim()) sql.exec(stmt);
  const added = [], seen = {};
  for (const [table, name, type] of ADDED_COLUMNS) {
    const cols = seen[table] || (seen[table] = columnsOf(sql, table));
    if (!cols.length || cols.includes(name)) continue;   // no such table here (a bare test schema): nothing to add to
    sql.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + name + ' ' + type);
    cols.push(name);
    added.push(table + '.' + name);
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
// "10:52 am", the wall clock in that zone (the Watch's plain words: "Cohen left the game at 10:52 am.")
export function clockAt(ms, tz = TEACHER_TZ) { const p = partsAt(ms, tz); return (p.h % 12 || 12) + ':' + String(p.mi).padStart(2, '0') + ' ' + (p.h < 12 ? 'am' : 'pm'); }
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
// a name with case, spaces, dots, apostrophes and hyphens taken out: "Mrs. Smith", "mrs smith" and "MrsSmith" are one name
export const squash = s => String(s || '').toLowerCase().replace(/[\s.'-]+/g, '');
export const teacherTag = name => String(name) + ' (teacher)';

// ---------------------------------------------------------------------------
// TeacherBook: every read and write of the teacher view (the World keeps one; watch.js and the calls below use it)
// ---------------------------------------------------------------------------
export class TeacherBook {
  constructor(sql, now = () => Date.now()) {
    this.sql = sql; this.now = now;
    this.tickets = new Map();   // ticket -> {sh, exp}: World memory only (a nap forgets them; a page asks again)
    this.fails = new Map();     // address -> {start, n}: failed sign-ins this hour (a nap forgets it, which only lets more through)
    this.tries = new Map();     // address + name -> {n, until, last}: wrong passwords in a row there, and the wait
    this.actWrites = 0;
  }
  rows(q, ...a) { return this.sql.exec(q, ...a).toArray(); }
  row(q, ...a) { return this.rows(q, ...a)[0] || null; }

  // ---------- teachers ----------
  list() { return this.rows('SELECT id, name, created, off, last_login, tries, tried_at FROM teachers ORDER BY name_lc'); }
  byId(id) { return Number.isInteger(id) ? this.row('SELECT * FROM teachers WHERE id = ?', id) : null; }
  byName(name) { const lc = nameLc(name); return lc ? this.row('SELECT * FROM teachers WHERE name_lc = ?', lc) : null; }
  add(name, salt, hash, at) { return this.row('INSERT INTO teachers (name, name_lc, salt, hash, created) VALUES (?, ?, ?, ?, ?) RETURNING id', name, nameLc(name), salt, hash, at).id; }
  // a new password also lifts every sign-in wait on that name (the remedy the owner has for a teacher a kid kept out)
  setSecret(id, salt, hash) {
    this.sql.exec('UPDATE teachers SET salt = ?, hash = ?, locked_until = 0 WHERE id = ?', salt, hash, id); this.dropSessions(id);
    const t = this.byId(id); if (t) this.forgetTries(t.name_lc);
  }
  // wrong passwords on this teacher today, from anywhere (shown to the owner; never a lock): one write per wrong try
  wrongTry(id, at) { this.sql.exec('UPDATE teachers SET tries = CASE WHEN tried_at >= ? THEN tries + 1 ELSE 1 END, tried_at = ? WHERE id = ?', dayStart(at), at, id); }
  wrongToday(t, at) { return t && Number(t.tried_at) >= dayStart(at) ? Number(t.tries) || 0 : 0; }
  // a knight's name that reads as a teacher's ("Mrs Smith" when the owner made the teacher "Mrs. Smith"), turned off ones too
  nameClash(name) {
    const sq = squash(name);
    return !!sq && !!this.row("SELECT 1 AS y FROM teachers WHERE replace(replace(replace(replace(name_lc, ' ', ''), '.', ''), '''', ''), '-', '') = ? LIMIT 1", sq);
  }
  // a teacher's name that reads as a knight's already playing (knight names are letters, digits and spaces)
  knightClash(name) { const sq = squash(name); return !!sq && !!this.row("SELECT 1 AS y FROM accounts WHERE replace(name_lc, ' ', '') = ? LIMIT 1", sq); }
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
  chatSince(since, limit) { return this.rows('SELECT c.at, c.name, c.text, (m.id IS NOT NULL) AS masked FROM chat c LEFT JOIN chat_masked m ON m.id = c.id WHERE c.at > ? ORDER BY c.id DESC LIMIT ?', since, limit).reverse(); }

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

  // ---------- the sign-in waits: per address AND name, the same for a name that exists and one that does not ----------
  // The seconds this address must wait before trying this name again, or 0. A wait on one address never touches another,
  // and a busy address (a school full of guessing kids) waits only on the names it got wrong, never on a teacher's own.
  signinWait(where, lc, at) {
    const t = this.tries.get(where + '\n' + lc);
    if (t && t.until > at) return Math.ceil((t.until - at) / 1000);
    const r = this.fails.get(where);
    if (t && r && at - r.start < ADDRESS_WINDOW_MS && r.n >= ADDRESS_FAILS && at - t.last < ADDRESS_WINDOW_MS) return Math.ceil((r.start + ADDRESS_WINDOW_MS - at) / 1000);
    return 0;
  }
  // a wrong password from this address on this name: answers the wait it starts (seconds), or 0
  signinFailed(where, lc, at) {
    if (this.fails.size > 5000) for (const [k, v] of this.fails) if (at - v.start >= ADDRESS_WINDOW_MS) this.fails.delete(k);
    if (this.tries.size > 5000) for (const [k, v] of this.tries) if (at - v.last >= ADDRESS_WINDOW_MS && v.until <= at) this.tries.delete(k);
    let r = this.fails.get(where);
    if (!r || at - r.start >= ADDRESS_WINDOW_MS) { r = { start: at, n: 0 }; this.fails.set(where, r); }
    r.n++;
    const key = where + '\n' + lc;
    let t = this.tries.get(key);
    if (!t || (t.until && t.until <= at)) { t = { n: 0, until: 0, last: at }; this.tries.set(key, t); }
    t.n++; t.last = at;
    if (t.n >= TEACHER_TRIES) { t.n = 0; t.until = at + TEACHER_LOCK_MS; return TEACHER_LOCK_MS / 1000; }
    return 0;
  }
  // the right password from this address: its count on that name starts again
  signinRight(where, lc) { this.tries.delete(where + '\n' + lc); }
  forgetTries(lc) { for (const k of Array.from(this.tries.keys())) if (k.endsWith('\n' + lc)) this.tries.delete(k); }
}

// ---------------------------------------------------------------------------
// /api/teacher/* — on every game address (round 2: no teacher address, no door). The sign-in itself is POST /api/login
// (teacherLogin, below); POST /api/teacher/login is gone (404 nope).
// ---------------------------------------------------------------------------
export async function teacherCall(world, req, url, path, method) {
  const book = world.teachers;
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

// The teacher half of POST /api/login. world.login calls it only when no knight has the name (and none had it before a
// rename) and the card sent teacherOk: 1, with the body it already read. Round 1's rules, unchanged: the same answer for an
// unknown name and a wrong password (one PBKDF2 either way), the waits per address and name in memory, off checked only after
// the right password, the wrong tries counted for the owner, last_login, one mod_log row, at most 3 sessions, and only the
// SHA-256 of the token kept. Answers {teacher: true, token, name, expires}.
export async function teacherLogin(world, { name, pass, addr }) {
  const book = world.teachers, now = world.now();
  const where = addr || 'unknown';
  name = typeof name === 'string' ? name.slice(0, 80) : '';
  const lc = nameLc(name);
  pass = typeof pass === 'string' ? pass.slice(0, TEACHER_PASS_MAX + 1) : '';
  // the wait is this address's on this name, never the teacher's: a guess from anywhere else cannot refuse the right password
  const wait = book.signinWait(where, lc, now);
  if (wait) throw oops(429, 'too many tries: wait and try again', 'wait', { wait });
  const t = book.byName(name);
  let ok = false;
  if (t) ok = await checkPassword(pass, t.salt, t.hash);
  else await hashPassword(pass, DUMMY_SALT);
  if (!ok) {
    const w = book.signinFailed(where, lc, now);   // an unknown name is counted the same way, so the answers match
    if (t) book.wrongTry(t.id, now);
    if (w) throw oops(429, 'too many tries: wait and try again', 'wait', { wait: w });
    throw oops(401, "that name and password don't match", 'nomatch');
  }
  book.signinRight(where, lc);
  // only after the password is right, so a wrong guess learns nothing
  if (t.off) throw oops(403, 'this sign-in was turned off', 'off');
  const token = randomHex(32), sh = await sha256(token);
  const expires = Math.min(now + SESSION_MAX_MS, dayEnd(now));
  world.sql.exec('UPDATE teachers SET last_login = ? WHERE id = ?', now, t.id);
  book.addSession(t.id, sh, now, expires);
  world.store.log({ at: now, by: teacherTag(t.name), act: 'teacher_in', target: 'teacher view', detail: '' });
  return { teacher: true, token, name: t.name, expires };
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
  // one call for the whole Teachers section (the list, today's actions, the notice switch): /admin opens with +1 request
  if (call === 'teachers' && method === 'GET') {
    const acts = book.actsTodayBy(dayStart(now));
    const teachers = book.list().map(t => ({ id: t.id, name: t.name, created: t.created, lastLogin: t.last_login || null, off: !!t.off, watching: world.watch.countFor(t.id), actsToday: acts[t.id] || 0, wrongToday: book.wrongToday(t, now) }));
    return json({ teachers, acts: world.watch.actsView(now), notice: world.watch.notice });
  }
  if (call === 'teachers' && post) {
    const b = await readJson(req);
    const name = typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim() : '';
    if (!NAME_RE.test(name)) throw oops(400, "a teacher's name is 2 to 40 letters, spaces, dots, hyphens or apostrophes, starting with a letter", 'name');
    const pass = passOf(b);
    if (book.byName(name) || book.nameClash(name)) throw oops(409, 'there is already a teacher with that name', 'taken');
    // a knight already called that would read as the teacher in chat: the owner picks another name ("Mrs J Smith")
    if (book.knightClash(name)) throw oops(409, 'a knight already has that name: add a first letter or a first name', 'taken');
    // a knight's name from before a rename logs in as that knight (world.login), so a teacher can never have it either
    if (typeof world.store.renamedFrom === 'function' && world.store.renamedFrom(nameLc(name))) throw oops(409, 'a knight had that name: add a first letter or a first name', 'taken');
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
