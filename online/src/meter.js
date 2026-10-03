// ============================================================================
// THE METER — what the free plan counts, one row per UTC day (docs/ONLINE.md, "The shared world", Stage 0)
// Cloudflare bills a Durable Object for every HTTP request that reaches it and for every 20 incoming WebSocket
// messages; the free plan allows 100,000 of those a day, and the day starts at 00:00 UTC. The World counts both here
// so the cost gates before the shared-world stages read real numbers. Pings the runtime answers by itself never reach
// the World, so they are not counted (and are not billed as messages the World handled).
//
// Writing a row per message would cost more than it measures, so the counts wait in memory and go out as one upsert
// per day touched: when WRITE_AT counts are waiting, when the last write was WRITE_EVERY ms ago (checked on every count),
// and whenever the World calls flush() (every socket close, every alarm). A nap can only lose the last few seconds.
// Pure JavaScript over sql.exec (the Durable Object API, or node:sqlite in the tests): no other Cloudflare APIs.
// ============================================================================

export const METER_SCHEMA = 'CREATE TABLE IF NOT EXISTS req_meter (day TEXT PRIMARY KEY, ws_in INTEGER NOT NULL DEFAULT 0, http INTEGER NOT NULL DEFAULT 0, est_requests INTEGER NOT NULL DEFAULT 0)';
export const WS_PER_REQUEST = 20;        // incoming WebSocket messages billed as one request
export const FREE_REQUESTS = 100000;     // Durable Object requests a day on the free plan
export const WRITE_AT = 200;             // counts waiting that force a write
export const WRITE_EVERY = 10000;        // ms: the longest counts wait while the World is busy
export const KEEP_DAYS = 400;            // rows older than this are deleted on the first write of a new day

// '2026-10-03': the UTC day a time (ms) falls on
export const dayOf = ms => new Date(ms).toISOString().slice(0, 10);
export const estimate = (wsIn, http) => Math.ceil(wsIn / WS_PER_REQUEST) + http;

export class Meter {
  constructor(sql, now = () => Date.now()) {
    this.sql = sql;
    this.now = now;
    this.sql.exec(METER_SCHEMA);
    this.waiting = new Map();   // day -> {ws, http}
    this.count = 0;             // counts waiting, every day together
    this.lastWrite = now();
    this.lastDay = null;        // the last day this World wrote (the prune runs when it changes, so once a day per wake)
  }
  ws() { this.add('ws'); }
  http() { this.add('http'); }
  add(kind) {
    const now = this.now(), day = dayOf(now);
    let w = this.waiting.get(day);
    if (!w) { w = { ws: 0, http: 0 }; this.waiting.set(day, w); }
    w[kind]++;
    this.count++;
    if (this.count >= WRITE_AT || now - this.lastWrite >= WRITE_EVERY) this.flush();
  }
  // writes what is waiting, one upsert per day; a failed write keeps the counts for the next try
  flush() {
    this.lastWrite = this.now();
    if (!this.count) return 0;
    let rows = 0;
    for (const [day, w] of this.waiting) {
      try {
        this.sql.exec(`INSERT INTO req_meter (day, ws_in, http, est_requests) VALUES (?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET ws_in = ws_in + excluded.ws_in, http = http + excluded.http, est_requests = CAST((ws_in + excluded.ws_in + ${WS_PER_REQUEST - 1}) / ${WS_PER_REQUEST} AS INTEGER) + http + excluded.http`,
          day, w.ws, w.http, estimate(w.ws, w.http));
      } catch (e) { console.error('meter', e); continue; }
      this.count -= w.ws + w.http;
      this.waiting.delete(day);
      rows++;
      if (day !== this.lastDay) { this.prune(day); this.lastDay = day; }   // the first write of each day, per wake
    }
    return rows;
  }
  prune(day) {
    const cut = dayOf(Date.parse(day + 'T00:00:00Z') - KEEP_DAYS * 86400000);
    try { this.sql.exec('DELETE FROM req_meter WHERE day < ?', cut); } catch (e) { console.error('meter prune', e); }
  }
  // the parent page's view: today (with what is still waiting) and the newest `days` rows, newest first
  view(days = 14) {
    const today = dayOf(this.now());
    const rows = this.sql.exec('SELECT day, ws_in, http FROM req_meter ORDER BY day DESC LIMIT ?', days).toArray()
      .map(r => ({ day: r.day, wsIn: Number(r.ws_in) || 0, http: Number(r.http) || 0 }));
    for (const [day, w] of this.waiting) {
      let r = rows.find(x => x.day === day);
      if (!r) { r = { day, wsIn: 0, http: 0 }; rows.push(r); }
      r.wsIn += w.ws; r.http += w.http;
    }
    rows.sort((a, b) => a.day < b.day ? 1 : a.day > b.day ? -1 : 0);
    for (const r of rows) r.est = estimate(r.wsIn, r.http);
    const t = rows.find(r => r.day === today) || { day: today, wsIn: 0, http: 0, est: 0 };
    return { today: t, days: rows.slice(0, days), freeLimit: FREE_REQUESTS, waiting: this.count };
  }
}
