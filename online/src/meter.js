// ============================================================================
// THE METER — what the free plan counts, one row per UTC day (docs/ONLINE.md, "The shared world", Stage 0)
// Cloudflare bills a Durable Object for every HTTP request that reaches it and for every 20 incoming WebSocket
// messages; the free plan allows 100,000 of those a day, and the day starts at 00:00 UTC. The World counts both here
// so the cost gates before the shared-world stages read real numbers. Every alarm the World runs is billed as a request
// too, so world.js counts each one as an HTTP request (alarm()). Pings the runtime answers by itself never reach
// the World, so they are not counted (and are not billed as messages the World handled).
//
// Writing a row per message would cost more than it measures, so the counts wait in memory and go out as one upsert
// per day touched: when WRITE_AT counts are waiting, when the last write was WRITE_EVERY ms ago (checked on every count),
// and on every socket close (flush()). The first count after a wake is written at once: a World that naps between requests
// (a paused page's save every 15 s, a status poll) is a new object for each one, and a count left waiting there is lost with
// the nap (measured 4 Oct 2026 under wrangler dev: a whole idle page's saves and polls never reached the table). After that an
// HTTP request or an alarm is written at once unless the meter wrote in the last WRITE_SOON ms (soon()): each write is an
// upsert of up to four rows (req_meter, and req_meter_admin, req_meter_alarm and req_meter_rows when admin calls, alarms or
// rows written wait), rows written are a free-plan limit of their own (100,000 a day; a miss stops every save), and a write per
// call would cost the admin page's 4-call refresh 8 rows every 10 s. So the meter writes at most once per WRITE_SOON for
// requests and alarms (720 writes an hour) plus once per WRITE_AT socket messages, once per WRITE_EVERY while messages keep
// coming (a knight playing alone: 120 an hour, where 10 s cost 360) and once per socket close; the rows written ride along at
// most once per ROWS_EVERY. A nap can lose only the requests and alarms of the WRITE_SOON before it, the socket messages of the
// WRITE_EVERY before it and the rows written of the ROWS_EVERY before it.
// The admin page polls the World too, and it should not be read as the game's traffic: every /api/admin/* call is also
// counted in req_meter_admin (a second table, so the schema only ever gains CREATE TABLE IF NOT EXISTS). req_meter.http
// stays every call (what Cloudflare bills); the game's calls are http - admin, and the cost gate reads the game's share.
// Of the game's calls, the World's own alarms are counted apart in req_meter_alarm (a third table, the same way): an alarm
// is billed like a call, but no page made it, and on the night of 3-4 Oct 2026 the meter could not tell alarms from the
// pages' saves (two idle knights on one map cost about 1,200 alarms an hour, measured under wrangler dev).
// Rows written are the other daily limit, and the one a playing game reaches first: 100,000 a day, and a miss stops every save
// until 00:00 UTC. A playing knight writes about 1,680 rows an hour against about 420 billed requests (6 Oct 2026, wrangler
// dev), so the World hands every statement's rowsWritten to rows() (countRows wraps its sql.exec) and the meter keeps them per
// day in req_meter_rows (a fourth table, the same way), written at most once per ROWS_EVERY with the rest.
// Each wake marks the days it counts (mark()): the day's req_meter_alarm and req_meter_rows rows are made if missing, with
// `since` the start of the day when nothing of that day was counted before (this code counted all of it), or the moment it
// was made when older code had already counted that day (a deploy, or a rollback and back: the day is partial from `since`).
// A day with no such row was counted only by older code: its alarms and rows read "not counted" (null), never a false 0.
// Pure JavaScript over sql.exec (the Durable Object API, or node:sqlite in the tests): no other Cloudflare APIs.
// ============================================================================

export const METER_SCHEMA = 'CREATE TABLE IF NOT EXISTS req_meter (day TEXT PRIMARY KEY, ws_in INTEGER NOT NULL DEFAULT 0, http INTEGER NOT NULL DEFAULT 0, est_requests INTEGER NOT NULL DEFAULT 0)';
export const METER_ADMIN_SCHEMA = 'CREATE TABLE IF NOT EXISTS req_meter_admin (day TEXT PRIMARY KEY, http INTEGER NOT NULL DEFAULT 0)';
export const METER_ALARM_SCHEMA = 'CREATE TABLE IF NOT EXISTS req_meter_alarm (day TEXT PRIMARY KEY, http INTEGER NOT NULL DEFAULT 0, since INTEGER NOT NULL DEFAULT 0)';
export const METER_ROWS_SCHEMA = 'CREATE TABLE IF NOT EXISTS req_meter_rows (day TEXT PRIMARY KEY, rows INTEGER NOT NULL DEFAULT 0, since INTEGER NOT NULL DEFAULT 0)';
// (an owner knight's teacher calls from the game, /api/owner/*, are the admin's too)
export const isAdminPath = path => typeof path === 'string' && (path.startsWith('/api/admin/') || path.startsWith('/api/owner/'));
export const WS_PER_REQUEST = 20;        // incoming WebSocket messages billed as one request
export const FREE_REQUESTS = 100000;     // Durable Object requests a day on the free plan
export const FREE_ROWS = 100000;         // rows written a day on the free plan
export const WRITE_AT = 2000;            // counts waiting that force a write
export const WRITE_EVERY = 30000;        // ms: the longest counts wait while the World is busy
export const WRITE_SOON = 5000;          // ms: a request or an alarm is written at once unless the meter wrote this recently
export const ROWS_EVERY = 60000;         // ms: the rows written are written (req_meter_rows) at most this often, with a write
export const KEEP_DAYS = 400;            // rows older than this are deleted on the first write of a new day

// '2026-10-03': the UTC day a time (ms) falls on
export const dayOf = ms => new Date(ms).toISOString().slice(0, 10);
export const dayStart = day => Date.parse(day + 'T00:00:00Z');
export const estimate = (wsIn, http) => Math.ceil(wsIn / WS_PER_REQUEST) + http;

// The same sql.exec, and every statement's rowsWritten handed to onRows (n). A write's cursor has its count as soon as exec
// returns; one with RETURNING only once it is read, so it is read here and handed back as an array cursor.
export function countRows(sql, onRows) {
  const tell = c => { const n = Number(c && c.rowsWritten) || 0; if (n > 0) { try { onRows(n); } catch (e) { } } };
  return {
    exec(q, ...args) {
      const c = sql.exec(q, ...args);
      if (/^\s*SELECT\b/i.test(q)) return c;
      if (!/\bRETURNING\b/i.test(q)) { tell(c); return c; }
      const rows = c.toArray();
      tell(c);
      return { toArray: () => rows.slice(), one: () => rows[0], [Symbol.iterator]: () => rows[Symbol.iterator](), columnNames: c.columnNames, rowsRead: c.rowsRead, rowsWritten: c.rowsWritten };
    },
    get databaseSize() { return sql.databaseSize; },
  };
}

export class Meter {
  constructor(sql, now = () => Date.now()) {
    this.sql = sql;
    this.now = now;
    this.sql.exec(METER_SCHEMA);
    this.sql.exec(METER_ADMIN_SCHEMA);
    this.sql.exec(METER_ALARM_SCHEMA);
    this.sql.exec(METER_ROWS_SCHEMA);
    this.waiting = new Map();   // day -> {ws, http, admin, alarm, rows} (admin, alarm: how many of http were /api/admin/* calls, alarms)
    this.count = 0;             // counts waiting (ws + http), every day together (rows written wait, but never force a write)
    this.lastWrite = -Infinity;   // the first count after a wake is written at once (see above)
    this.rowsAt = -Infinity;    // when the rows written were last written
    this.lastDay = null;        // the last day this World wrote (the prune runs when it changes, so once a day per wake)
    this.marked = new Set();    // the days this wake has marked (mark)
    this.mark(dayOf(this.now()));
  }
  // The first time a wake counts a day: that day's alarm and rows rows, empty, if missing. `since` is the start of the day when
  // no count of that day was written before (this code counted all of it), else this moment (older code counted the day's
  // start: the day is partial from here). A row already there is left as it is: at most two rows a day.
  mark(day) {
    if (this.marked.has(day)) return;
    const t = this.now(), since = 'CASE WHEN EXISTS (SELECT 1 FROM req_meter WHERE day = ?) THEN ? ELSE ? END';
    try {
      this.sql.exec(`INSERT OR IGNORE INTO req_meter_alarm (day, http, since) VALUES (?, 0, ${since})`, day, day, t, dayStart(day));
      this.sql.exec(`INSERT OR IGNORE INTO req_meter_rows (day, rows, since) VALUES (?, 0, ${since})`, day, day, t, dayStart(day));
      this.marked.add(day);
    } catch (e) { console.error('meter mark', e); }
  }
  ws() { this.add('ws'); }
  // one HTTP request; admin: it was an /api/admin/* call (the admin page, a backup), counted in its own column as well
  http(admin = false) { this.add('http', !!admin); this.soon(); }
  // one alarm the World ran: billed as a request, the game's, and counted apart in req_meter_alarm as well
  alarm() { this.add('http', false, true); this.soon(); }
  // n rows written to the database (countRows): they wait for the next write, and never force one
  rows(n) {
    if (!(n > 0)) return;
    const w = this.day(dayOf(this.now()));
    w.rows += n;
  }
  day(day) {
    let w = this.waiting.get(day);
    if (!w) { w = { ws: 0, http: 0, admin: 0, alarm: 0, rows: 0 }; this.waiting.set(day, w); }
    return w;
  }
  // what waits goes out now unless the meter wrote in the last WRITE_SOON ms (then the next count, close or write takes it)
  soon() { if (this.count && this.now() - this.lastWrite >= WRITE_SOON) this.flush(); }
  add(kind, admin = false, alarm = false) {
    const now = this.now();
    const w = this.day(dayOf(now));
    w[kind]++;
    if (admin) w.admin++;
    if (alarm) w.alarm++;
    this.count++;
    if (this.count >= WRITE_AT || now - this.lastWrite >= WRITE_EVERY) this.flush();
  }
  // writes what is waiting, one upsert per table and day; a failed write keeps the counts for the next try. The rows written
  // go out with it at most once per ROWS_EVERY (and a past day's at once); this write's own rows wait for the next one.
  flush() {
    const now = this.now(), today = dayOf(now);
    this.lastWrite = now;
    if (!this.count) return 0;
    let rows = 0, rowsDue = now - this.rowsAt >= ROWS_EVERY;
    for (const [day, w] of Array.from(this.waiting)) {
      this.mark(day);
      if (w.ws || w.http) {
        try {
          this.sql.exec(`INSERT INTO req_meter (day, ws_in, http, est_requests) VALUES (?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET ws_in = ws_in + excluded.ws_in, http = http + excluded.http, est_requests = CAST((ws_in + excluded.ws_in + ${WS_PER_REQUEST - 1}) / ${WS_PER_REQUEST} AS INTEGER) + http + excluded.http`,
            day, w.ws, w.http, estimate(w.ws, w.http));
          this.count -= w.ws + w.http; w.ws = 0; w.http = 0;
        } catch (e) { console.error('meter', e); continue; }
      }
      if (w.admin) {
        try {
          this.sql.exec('INSERT INTO req_meter_admin (day, http) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET http = http + excluded.http', day, w.admin);
          w.admin = 0;
        } catch (e) { console.error('meter admin', e); continue; }
      }
      if (w.alarm) {
        try {
          this.sql.exec('INSERT INTO req_meter_alarm (day, http, since) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET http = http + excluded.http', day, w.alarm, now);
          w.alarm = 0;
        } catch (e) { console.error('meter alarm', e); continue; }
      }
      if (w.rows && (rowsDue || day !== today)) {
        const n = w.rows; w.rows = 0;
        try {
          this.sql.exec('INSERT INTO req_meter_rows (day, rows, since) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET rows = rows + excluded.rows', day, n, now);
          if (day === today) this.rowsAt = now;
        } catch (e) { w.rows += n; console.error('meter rows', e); continue; }
      }
      if (!w.ws && !w.http && !w.admin && !w.alarm && !w.rows && this.waiting.get(day) === w) this.waiting.delete(day);
      rows++;
      if (day !== this.lastDay) { this.prune(day); this.lastDay = day; }   // the first write of each day, per wake
    }
    return rows;
  }
  prune(day) {
    const cut = dayOf(dayStart(day) - KEEP_DAYS * 86400000);
    try { for (const t of ['req_meter', 'req_meter_admin', 'req_meter_alarm', 'req_meter_rows']) this.sql.exec(`DELETE FROM ${t} WHERE day < ?`, cut); } catch (e) { console.error('meter prune', e); }
  }
  // the parent page's view: today (with what is still waiting) and the newest `days` rows, newest first. Each row:
  // wsIn, http (every call), admin (of those, /api/admin/* calls), est (every request, what Cloudflare bills),
  // gameHttp = http - admin and gameEst (the game's own requests), and, of gameHttp, alarms (the World's own) and
  // pageHttp = gameHttp - alarms (what the game's pages called: saves, logins, status, the socket's opening), and rows (rows
  // written to the database). alarms, pageHttp and rows are null on a day this code did not count (no mark); alarmsSince and
  // rowsSince are null on a day it counted whole, else the moment it began to (the ones before are inside the calls, or
  // uncounted). The cost gate reads the larger of the game's two shares: gameEst of freeLimit, rows of freeRows.
  view(days = 14) {
    const today = dayOf(this.now());
    const rows = this.sql.exec('SELECT m.day AS day, m.ws_in AS ws_in, m.http AS http, COALESCE(a.http, 0) AS admin, l.http AS alarms, l.since AS asince, r.rows AS rows, r.since AS rsince FROM req_meter m LEFT JOIN req_meter_admin a ON a.day = m.day LEFT JOIN req_meter_alarm l ON l.day = m.day LEFT JOIN req_meter_rows r ON r.day = m.day ORDER BY m.day DESC LIMIT ?', days).toArray()
      .map(r => ({ day: r.day, wsIn: Number(r.ws_in) || 0, http: Number(r.http) || 0, admin: Number(r.admin) || 0, alarms: Number(r.alarms) || 0, rows: Number(r.rows) || 0,
        asince: r.asince == null ? null : Number(r.asince), rsince: r.rsince == null ? null : Number(r.rsince) }));
    for (const [day, w] of this.waiting) {
      let r = rows.find(x => x.day === day);
      // a day only in memory is this code's from its first count (the World stayed awake into it: nothing else counted it)
      if (!r) { r = { day, wsIn: 0, http: 0, admin: 0, alarms: 0, rows: 0, asince: dayStart(day), rsince: dayStart(day) }; rows.push(r); }
      r.wsIn += w.ws; r.http += w.http; r.admin += w.admin; r.alarms += w.alarm; r.rows += w.rows;
    }
    rows.sort((a, b) => a.day < b.day ? 1 : a.day > b.day ? -1 : 0);
    const part = (since, day) => since != null && since > dayStart(day) ? since : null;
    const shape = r => {
      const admin = Math.min(r.admin, r.http), gameHttp = r.http - admin, apart = r.asince != null;
      const alarms = apart ? Math.min(r.alarms, gameHttp) : null;
      return { day: r.day, wsIn: r.wsIn, http: r.http, admin, gameHttp, alarms, pageHttp: apart ? gameHttp - alarms : null, alarmsSince: apart ? part(r.asince, r.day) : null,
        est: estimate(r.wsIn, r.http), gameEst: estimate(r.wsIn, gameHttp), rows: r.rsince != null ? r.rows : null, rowsSince: r.rsince != null ? part(r.rsince, r.day) : null };
    };
    const out = rows.map(shape);
    // today before its first write: its marks say whether this code counts it, and from when
    const sinceOf = tab => { try { const r = this.sql.exec(`SELECT since FROM ${tab} WHERE day = ?`, today).toArray()[0]; return r ? Number(r.since) : null; } catch (e) { return null; } };
    const t = out.find(r => r.day === today) || shape({ day: today, wsIn: 0, http: 0, admin: 0, alarms: 0, rows: 0, asince: sinceOf('req_meter_alarm'), rsince: sinceOf('req_meter_rows') });
    return { today: t, days: out.slice(0, days), freeLimit: FREE_REQUESTS, freeRows: FREE_ROWS, waiting: this.count };
  }
}
