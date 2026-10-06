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
// upsert of up to three rows (req_meter, and req_meter_admin and req_meter_alarm when admin calls or alarms wait), rows written
// are a free-plan limit of their own (100,000 a day; a miss stops every save), and a write per call would cost the admin page's
// 4-call refresh 8 rows every 10 s. So the meter writes at most once per WRITE_SOON for requests and alarms (720 writes an hour,
// at most 2,160 rows) plus once per WRITE_AT socket messages and once per socket close. A nap can lose only the requests and
// alarms of the WRITE_SOON before it and the socket messages of the WRITE_EVERY before it.
// The admin page polls the World too, and it should not be read as the game's traffic: every /api/admin/* call is also
// counted in req_meter_admin (a second table, so the schema only ever gains CREATE TABLE IF NOT EXISTS). req_meter.http
// stays every call (what Cloudflare bills); the game's calls are http - admin, and the cost gate reads the game's share.
// Of the game's calls, the World's own alarms are counted apart in req_meter_alarm (a third table, the same way): an alarm
// is billed like a call, but no page made it, and on the night of 3-4 Oct 2026 the meter could not tell alarms from the
// pages' saves (two idle knights on one map cost about 1,200 alarms an hour, measured under wrangler dev). Each row's
// `since` is when it was first written; the earliest is when alarms began to be counted apart, so a day before that one
// reads "not counted apart" rather than a false 0.
// Pure JavaScript over sql.exec (the Durable Object API, or node:sqlite in the tests): no other Cloudflare APIs.
// ============================================================================

export const METER_SCHEMA = 'CREATE TABLE IF NOT EXISTS req_meter (day TEXT PRIMARY KEY, ws_in INTEGER NOT NULL DEFAULT 0, http INTEGER NOT NULL DEFAULT 0, est_requests INTEGER NOT NULL DEFAULT 0)';
export const METER_ADMIN_SCHEMA = 'CREATE TABLE IF NOT EXISTS req_meter_admin (day TEXT PRIMARY KEY, http INTEGER NOT NULL DEFAULT 0)';
export const METER_ALARM_SCHEMA = 'CREATE TABLE IF NOT EXISTS req_meter_alarm (day TEXT PRIMARY KEY, http INTEGER NOT NULL DEFAULT 0, since INTEGER NOT NULL DEFAULT 0)';
export const isAdminPath = path => typeof path === 'string' && path.startsWith('/api/admin/');
export const WS_PER_REQUEST = 20;        // incoming WebSocket messages billed as one request
export const FREE_REQUESTS = 100000;     // Durable Object requests a day on the free plan
export const WRITE_AT = 200;             // counts waiting that force a write
export const WRITE_EVERY = 10000;        // ms: the longest counts wait while the World is busy
export const WRITE_SOON = 5000;          // ms: a request or an alarm is written at once unless the meter wrote this recently
export const KEEP_DAYS = 400;            // rows older than this are deleted on the first write of a new day

// '2026-10-03': the UTC day a time (ms) falls on
export const dayOf = ms => new Date(ms).toISOString().slice(0, 10);
export const estimate = (wsIn, http) => Math.ceil(wsIn / WS_PER_REQUEST) + http;

export class Meter {
  constructor(sql, now = () => Date.now()) {
    this.sql = sql;
    this.now = now;
    this.sql.exec(METER_SCHEMA);
    this.sql.exec(METER_ADMIN_SCHEMA);
    this.sql.exec(METER_ALARM_SCHEMA);
    // today's alarm row, empty, stamped with this wake: the earliest stamp is when alarms began to be counted apart. A row
    // already there is left as it is, so this writes at most one row a day.
    try { const t = this.now(); this.sql.exec('INSERT OR IGNORE INTO req_meter_alarm (day, http, since) VALUES (?, 0, ?)', dayOf(t), t); } catch (e) { console.error('meter alarm', e); }
    this.waiting = new Map();   // day -> {ws, http, admin, alarm} (admin, alarm: how many of http were /api/admin/* calls, alarms)
    this.count = 0;             // counts waiting (ws + http), every day together
    this.lastWrite = -Infinity;   // the first count after a wake is written at once (see above)
    this.lastDay = null;        // the last day this World wrote (the prune runs when it changes, so once a day per wake)
  }
  ws() { this.add('ws'); }
  // one HTTP request; admin: it was an /api/admin/* call (the admin page, a backup), counted in its own column as well
  http(admin = false) { this.add('http', !!admin); this.soon(); }
  // one alarm the World ran: billed as a request, the game's, and counted apart in req_meter_alarm as well
  alarm() { this.add('http', false, true); this.soon(); }
  // what waits goes out now unless the meter wrote in the last WRITE_SOON ms (then the next count, close or write takes it)
  soon() { if (this.count && this.now() - this.lastWrite >= WRITE_SOON) this.flush(); }
  add(kind, admin = false, alarm = false) {
    const now = this.now(), day = dayOf(now);
    let w = this.waiting.get(day);
    if (!w) { w = { ws: 0, http: 0, admin: 0, alarm: 0 }; this.waiting.set(day, w); }
    w[kind]++;
    if (admin) w.admin++;
    if (alarm) w.alarm++;
    this.count++;
    if (this.count >= WRITE_AT || now - this.lastWrite >= WRITE_EVERY) this.flush();
  }
  // writes what is waiting, one upsert per day; a failed write keeps the counts for the next try
  flush() {
    this.lastWrite = this.now();
    if (!this.count) return 0;
    let rows = 0;
    for (const [day, w] of this.waiting) {
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
          this.sql.exec('INSERT INTO req_meter_alarm (day, http, since) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET http = http + excluded.http', day, w.alarm, this.now());
          w.alarm = 0;
        } catch (e) { console.error('meter alarm', e); continue; }
      }
      this.waiting.delete(day);
      rows++;
      if (day !== this.lastDay) { this.prune(day); this.lastDay = day; }   // the first write of each day, per wake
    }
    return rows;
  }
  prune(day) {
    const cut = dayOf(Date.parse(day + 'T00:00:00Z') - KEEP_DAYS * 86400000);
    try { for (const t of ['req_meter', 'req_meter_admin', 'req_meter_alarm']) this.sql.exec(`DELETE FROM ${t} WHERE day < ?`, cut); } catch (e) { console.error('meter prune', e); }
  }
  // the parent page's view: today (with what is still waiting) and the newest `days` rows, newest first. Each row:
  // wsIn, http (every call), admin (of those, /api/admin/* calls), est (every request, what Cloudflare bills),
  // gameHttp = http - admin and gameEst (the game's own requests: what the cost gate reads), and, of gameHttp,
  // alarms (the World's own) and pageHttp = gameHttp - alarms (what the game's pages called: saves, logins, status, the
  // socket's opening). Both are null on a day before alarmsFrom (the ms alarms began to be counted apart; null: not yet).
  view(days = 14) {
    const today = dayOf(this.now());
    const rows = this.sql.exec('SELECT m.day AS day, m.ws_in AS ws_in, m.http AS http, COALESCE(a.http, 0) AS admin, COALESCE(l.http, 0) AS alarms FROM req_meter m LEFT JOIN req_meter_admin a ON a.day = m.day LEFT JOIN req_meter_alarm l ON l.day = m.day ORDER BY m.day DESC LIMIT ?', days).toArray()
      .map(r => ({ day: r.day, wsIn: Number(r.ws_in) || 0, http: Number(r.http) || 0, admin: Number(r.admin) || 0, alarms: Number(r.alarms) || 0 }));
    let from = null;
    try { const r = this.sql.exec('SELECT MIN(since) AS since FROM req_meter_alarm WHERE since > 0').toArray()[0]; if (r && r.since != null) from = Number(r.since); } catch (e) { }
    for (const [day, w] of this.waiting) {
      let r = rows.find(x => x.day === day);
      if (!r) { r = { day, wsIn: 0, http: 0, admin: 0, alarms: 0 }; rows.push(r); }
      r.wsIn += w.ws; r.http += w.http; r.admin += w.admin; r.alarms += w.alarm;
    }
    rows.sort((a, b) => a.day < b.day ? 1 : a.day > b.day ? -1 : 0);
    const fromDay = from == null ? null : dayOf(from);
    const shape = r => {
      const admin = Math.min(r.admin, r.http), gameHttp = r.http - admin, apart = fromDay != null && r.day >= fromDay;
      const alarms = apart ? Math.min(r.alarms, gameHttp) : null;
      return { day: r.day, wsIn: r.wsIn, http: r.http, admin, gameHttp, alarms, pageHttp: apart ? gameHttp - alarms : null, est: estimate(r.wsIn, r.http), gameEst: estimate(r.wsIn, gameHttp) };
    };
    const out = rows.map(shape);
    const t = out.find(r => r.day === today) || shape({ day: today, wsIn: 0, http: 0, admin: 0, alarms: 0 });
    return { today: t, days: out.slice(0, days), freeLimit: FREE_REQUESTS, waiting: this.count, alarmsFrom: from };
  }
}
