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
//   teacherLogin(world, {teacher, name, pass, addr, tab})   the teacher half of POST /api/login: world.login calls it only
//                                        when no knight has the name and a teacher does (book.find), for a card that sent
//                                        teacherOk: 1. Any other name is the knight's 404 unknown, with nothing counted.
//   teacherCall(world, req, url, path)   /api/teacher/logout | ticket | ws (on every game address; no door)
//   teacherAdminCall(world, req, url, call, method)   /api/admin/teachers* and /api/admin/teacher-acts (ADMIN_KEY, checked
//                                        by world.admin before it gets here); null for any other call
//   dayStart(now, tz), dayEnd(now, tz)   the first and last millisecond of today in that zone (Intl.DateTimeFormat)
// Pure JavaScript over sql.exec and crypto.subtle (both in the Worker and in Node 22+).
// ============================================================================

import { json, oops, readJson, bearer } from './http.js';
import { makeHash, checkPassword, randomHex } from './auth.js';

export const TEACHER_PASS_MIN = 10, TEACHER_PASS_MAX = 200;
// The sign-in waits are kept in World memory (a nap forgets them, which only lets more through) and only ever for a TEACHER'S
// name: a name no teacher has never reaches this file (world.login answers it as the knight's 404 unknown), so a classroom
// of kids mistyping their knights' names counts for nothing here. A whole school sits behind one address, so the 5-try wait
// is per address, name AND TAB (a random id the card makes once per page, sent with teacherOk): a kid typing the teacher's
// name with wrong passwords makes HIS page wait, never the teacher's page at the next desk. A looser ceiling per address and
// name is the limit on guessing (a guesser can make new tabs): 30 wrong in an hour, then that address waits on that name
// until the hour is up. The owner's Lift the wait on /admin (and a new password) ends every wait on that name at once.
export const TEACHER_TRIES = 5;                  // wrong passwords in a row from one address, name and tab before the wait
export const TEACHER_LOCK_MS = 900000;           // the wait: 15 minutes (that address, that name, that tab)
export const NAME_FAILS = 30;                    // wrong passwords on one name from one address in an hour: then that address waits on it
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
// A name as the owner (or the teacher) typed it, made plain: an iPad's or a Mac's curly apostrophe (’) and long dash are
// the plain ' and -, and runs of spaces are one. Used on the add and on every sign-in, so "Mrs O’Brien" typed on an iPad
// is the "Mrs O'Brien" the owner made (the card does the same, src/71-login.js).
export const plainName = s => String(s || '').replace(/[\u2018\u2019\u201A\u201B\u02BC\u02B9\u0060\u00B4\u2032]/g, "'").replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ').trim();
// The game's card takes a name over 16 letters only with a space, dot, apostrophe or hyphen in it (a knight's name is 2 to
// 16 letters or numbers: src/71-login.js teacherName), so the owner can never make a teacher the card would refuse.
export const teacherNameOk = n => NAME_RE.test(n) && (n.length <= 16 || /[ .'-]/.test(n));
// Why a name will not do, in the owner's words, with what to type instead (null: it will do). Shown on /admin as it is.
export function nameRefusal(n) {
  if (teacherNameOk(n)) return null;
  if (n.length < 2) return "Type the teacher's name, at least 2 letters, like Mrs Smith.";
  if (n.length > 40) return "That name is too long: 40 letters at most. Type a shorter one, like Mrs Smith.";
  if (/[0-9]/.test(n)) return "A teacher's name cannot have numbers in it. Use letters only, like Mrs Smith or Room Twelve.";
  if (!/^[A-Za-z]/.test(n)) return "A teacher's name has to start with a letter, like Mrs Smith.";
  if (/[^A-Za-z .'-]/.test(n)) return "A teacher's name can only have letters, spaces, dots, hyphens and apostrophes, like Mrs. O'Brien.";
  return 'A name over 16 letters needs a space in it, or the game\'s sign-in card will not take it. Type it with a space, like Mrs Thompson.';
}
const PARENT = 'parent page';

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
    this.fails = new Map();     // address + name -> {start, n}: wrong passwords on that name from that address this hour (the ceiling)
    this.tries = new Map();     // address + name + tab -> {n, until, last}: wrong passwords in a row there, and the 15-minute wait
    this.actWrites = 0;
  }
  rows(q, ...a) { return this.sql.exec(q, ...a).toArray(); }
  row(q, ...a) { return this.rows(q, ...a)[0] || null; }

  // ---------- teachers ----------
  list() { return this.rows('SELECT id, name, name_lc, created, off, last_login, tries, tried_at FROM teachers ORDER BY name_lc'); }
  byId(id) { return Number.isInteger(id) ? this.row('SELECT * FROM teachers WHERE id = ?', id) : null; }
  byName(name) { const lc = nameLc(name); return lc ? this.row('SELECT * FROM teachers WHERE name_lc = ?', lc) : null; }
  // the teacher a name on the card means: exactly, else the one whose name reads the same without case, spaces, dots,
  // apostrophes and hyphens ("mrs smith" for "Mrs. Smith"; nameClash keeps that unique). null: no teacher (a knight's typo)
  find(name) {
    name = plainName(name);
    const t = this.byName(name); if (t) return t;
    const sq = squash(name);
    return sq ? this.row("SELECT * FROM teachers WHERE replace(replace(replace(replace(name_lc, ' ', ''), '.', ''), '''', ''), '-', '') = ? LIMIT 1", sq) : null;
  }
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

  // ---------- the sign-in waits: only ever on a teacher's name; per address, name and tab, with a ceiling per address and name ----------
  // The seconds this tab at this address must wait before trying this teacher's name again, or 0. A wait on one tab never
  // touches another tab at the same address (the teacher at the next desk), and one address's never touches another's.
  signinWait(where, lc, tab, at) {
    const t = this.tries.get(where + '\n' + lc + '\n' + tab);
    if (t && t.until > at) return Math.ceil((t.until - at) / 1000);
    const r = this.fails.get(where + '\n' + lc);
    if (r && at - r.start < ADDRESS_WINDOW_MS && r.n >= NAME_FAILS) return Math.ceil((r.start + ADDRESS_WINDOW_MS - at) / 1000);
    return 0;
  }
  // a wrong password from this tab at this address on this teacher's name: answers the wait it starts (seconds), or 0
  signinFailed(where, lc, tab, at) {
    if (this.fails.size > 5000) for (const [k, v] of this.fails) if (at - v.start >= ADDRESS_WINDOW_MS) this.fails.delete(k);
    if (this.tries.size > 5000) for (const [k, v] of this.tries) if (at - v.last >= ADDRESS_WINDOW_MS && v.until <= at) this.tries.delete(k);
    const nk = where + '\n' + lc;
    let r = this.fails.get(nk);
    if (!r || at - r.start >= ADDRESS_WINDOW_MS) { r = { start: at, n: 0 }; this.fails.set(nk, r); }
    r.n++;
    if (r.n >= NAME_FAILS) return Math.ceil((r.start + ADDRESS_WINDOW_MS - at) / 1000);
    const key = nk + '\n' + tab;
    let t = this.tries.get(key);
    if (!t || (t.until && t.until <= at)) { t = { n: 0, until: 0, last: at }; this.tries.set(key, t); }
    t.n++; t.last = at;
    if (t.n >= TEACHER_TRIES) { t.n = 0; t.until = at + TEACHER_LOCK_MS; return TEACHER_LOCK_MS / 1000; }
    return 0;
  }
  // the right password from this tab: its count on that name starts again (the address's hour of wrong tries stays)
  signinRight(where, lc, tab) { this.tries.delete(where + '\n' + lc + '\n' + tab); }
  // every wait on this name, everywhere (Lift the wait on /admin, a new password)
  forgetTries(lc) {
    for (const k of Array.from(this.tries.keys())) if (k.split('\n')[1] === lc) this.tries.delete(k);
    for (const k of Array.from(this.fails.keys())) if (k.split('\n')[1] === lc) this.fails.delete(k);
  }
  // how many places (address and tab, or a whole address at the ceiling) wait on this name right now (for /admin)
  waitingOn(lc, at) {
    let n = 0;
    for (const [k, v] of this.tries) if (v.until > at && k.split('\n')[1] === lc) n++;
    for (const [k, v] of this.fails) if (v.n >= NAME_FAILS && at - v.start < ADDRESS_WINDOW_MS && k.split('\n')[1] === lc) n++;
    return n;
  }
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
// rename), a teacher does (book.find), and the card sent teacherOk: 1, with the body it already read. A name no teacher has
// never gets here: it is the knight's 404 unknown ("No knight by that name yet. Tap New knight."), with no PBKDF2 and nothing
// counted (teacher names can be found out this way: an accepted risk, docs/ONLINE.md; the password and the waits protect
// them). The rules: the waits (per address, name and tab, and the ceiling per address and name) in memory, off checked only
// after the right password, the wrong tries counted for the owner, last_login, one mod_log row, at most 3 sessions, and only
// the SHA-256 of the token kept. Answers {teacher: true, token, name, expires}.
export const TAB_RE = /^[0-9a-f]{8,64}$/;
export async function teacherLogin(world, { teacher, name, pass, addr, tab }) {
  const book = world.teachers, now = world.now();
  const t = teacher || book.find(typeof name === 'string' ? name.slice(0, 80) : '');
  if (!t) throw oops(404, 'no knight by that name', 'unknown');
  const where = addr || 'unknown', lc = t.name_lc, tb = typeof tab === 'string' && TAB_RE.test(tab) ? tab : '-';
  pass = typeof pass === 'string' ? pass.slice(0, TEACHER_PASS_MAX + 1) : '';
  // the wait is this tab's (or, past the ceiling, this address's) on this name: the right password from another tab or
  // another place still goes in
  const wait = book.signinWait(where, lc, tb, now);
  if (wait) throw oops(429, 'too many tries: wait and try again', 'wait', { wait });
  if (!(await checkPassword(pass, t.salt, t.hash))) {
    const w = book.signinFailed(where, lc, tb, now);
    book.wrongTry(t.id, now);
    if (w) throw oops(429, 'too many tries: wait and try again', 'wait', { wait: w });
    throw oops(401, "that name and password don't match", 'nomatch');
  }
  book.signinRight(where, lc, tb);
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
  // the refusals are shown on /admin as they are: plain words that say what to do (the owner is not a developer)
  const passOf = b => {
    const p = typeof b.pass === 'string' ? b.pass : '';
    if (p.length < TEACHER_PASS_MIN) throw oops(400, 'The password needs at least ' + TEACHER_PASS_MIN + ' letters (spaces count). Type a longer one, or press Make one up.', 'pass');
    if (p.length > TEACHER_PASS_MAX) throw oops(400, 'The password is too long: ' + TEACHER_PASS_MAX + ' letters at most. Press Make one up for a good one.', 'pass');
    return p;
  };
  const teacherOf = b => { const t = book.byId(b.id); if (!t) throw oops(404, 'no teacher with that id', 'nope'); return t; };
  const log = (act, target, detail) => world.store.log({ at: now, by: PARENT, act, target, detail: detail || '' });
  // one call for the whole Teachers section (the list, today's actions, the notice switch): /admin opens with +1 request
  if (call === 'teachers' && method === 'GET') {
    const acts = book.actsTodayBy(dayStart(now));
    const teachers = book.list().map(t => ({ id: t.id, name: t.name, created: t.created, lastLogin: t.last_login || null, off: !!t.off, watching: world.watch.countFor(t.id), actsToday: acts[t.id] || 0, wrongToday: book.wrongToday(t, now), waiting: book.waitingOn(t.name_lc, now) }));
    return json({ teachers, acts: world.watch.actsView(now), notice: world.watch.notice });
  }
  if (call === 'teachers' && post) {
    const b = await readJson(req);
    const name = typeof b.name === 'string' ? plainName(b.name) : '';
    const why = nameRefusal(name);
    if (why) throw oops(400, why, 'name');
    const pass = passOf(b);
    const same = book.byName(name) || book.find(name);
    if (same) throw oops(409, 'There is already a teacher called ' + same.name + '. Pick another name, or press New password on ' + same.name + "'s row below to give them a new password.", 'taken');
    // a knight already called that would read as the teacher in chat: the owner picks another name ("Mrs J Smith")
    if (book.knightClash(name)) throw oops(409, 'A knight in the game is already called ' + name + ', so a teacher cannot be. Add a first name or a first letter, like Mrs J Smith.', 'taken');
    // a knight's name from before a rename logs in as that knight (world.login), so a teacher can never have it either
    if (typeof world.store.renamedFrom === 'function' && world.store.renamedFrom(nameLc(name))) throw oops(409, 'A knight in the game used to be called ' + name + ', so a teacher cannot be. Add a first name or a first letter, like Mrs J Smith.', 'taken');
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
  // Lift the wait: every sign-in wait on this teacher's name ends now (a kid kept her out at school); the password stays
  if (call === 'teachers/lift' && post) {
    const b = await readJson(req); const t = teacherOf(b);
    book.forgetTries(t.name_lc);
    log('teacher_lift', teacherTag(t.name));
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
