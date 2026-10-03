// ============================================================================
// THE SIM BOOK — what the shared world writes down (docs/ONLINE.md, "The shared world", Stage 2)
//   sim_log      one row each time a map's monsters change hands: the parent page's flip, the master switch, the watchdog
//   realm_state  what must outlive a game copy: each map's boss rests ('rest:<map>' -> {bossId: ms when the rest is over})
// Both tables are only ever created if missing (the phase-1 schema rule). With no sql (the tests, the simulations) it all
// stays in memory. Pure JavaScript; no Cloudflare APIs.
//
//   const book = new SimBook(sql | null, now)
//   book.log({map, from, to, reason, tickP99})      one sim_log row (the newest LOG_KEEP are kept)
//   book.recent(n)                                  the newest n rows, newest first: [{at, map, from, to, reason, tickP99}]
//   book.realmGet(key) / book.realmPut(key, obj)    one realm_state row (written only when it changed)
// ============================================================================

export const SIM_LOG_SCHEMA = 'CREATE TABLE IF NOT EXISTS sim_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, map TEXT NOT NULL, from_mode TEXT NOT NULL, to_mode TEXT NOT NULL, reason TEXT NOT NULL, tick_p99 REAL)';
export const REALM_SCHEMA = 'CREATE TABLE IF NOT EXISTS realm_state (key TEXT PRIMARY KEY, json TEXT NOT NULL, at INTEGER NOT NULL)';
export const LOG_KEEP = 1000;        // sim_log rows kept; older ones go now and then
const TRIM_EVERY = 50;               // rows written between trims

const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;

export class SimBook {
  constructor(sql, now = () => Date.now()) {
    this.sql = sql || null;
    this.now = now;
    if (this.sql) { this.sql.exec(SIM_LOG_SCHEMA); this.sql.exec(REALM_SCHEMA); }
    this.mem = { log: [], realm: new Map() };
    this.written = 0;
    this.last = new Map();   // key -> the json last written (so an unchanged realm row is never written again)
  }
  log(row) {
    const r = { at: num(row.at) ?? this.now(), map: str(row.map, 64), from: str(row.from, 16), to: str(row.to, 16), reason: str(row.reason, 40), tickP99: num(row.tickP99) };
    if (this.sql) {
      try {
        this.sql.exec('INSERT INTO sim_log (at, map, from_mode, to_mode, reason, tick_p99) VALUES (?, ?, ?, ?, ?, ?)', r.at, r.map, r.from, r.to, r.reason, r.tickP99);
        if (++this.written % TRIM_EVERY === 0) this.sql.exec('DELETE FROM sim_log WHERE id NOT IN (SELECT id FROM sim_log ORDER BY id DESC LIMIT ?)', LOG_KEEP);
      } catch (e) { }
    } else {
      this.mem.log.push(r);
      if (this.mem.log.length > LOG_KEEP) this.mem.log.splice(0, this.mem.log.length - LOG_KEEP);
    }
    return r;
  }
  recent(n = 30) {
    if (this.sql) {
      try { return this.sql.exec('SELECT at, map, from_mode, to_mode, reason, tick_p99 FROM sim_log ORDER BY id DESC LIMIT ?', n).toArray().map(x => ({ at: x.at, map: x.map, from: x.from_mode, to: x.to_mode, reason: x.reason, tickP99: x.tick_p99 })); } catch (e) { return []; }
    }
    return this.mem.log.slice(-n).reverse().map(r => ({ ...r }));
  }
  realmGet(key) {
    let json = null;
    if (this.sql) { try { const r = this.sql.exec('SELECT json FROM realm_state WHERE key = ?', key).toArray()[0]; json = r ? r.json : null; } catch (e) { json = null; } }
    else json = this.mem.realm.has(key) ? this.mem.realm.get(key) : null;
    if (json === null) return null;
    this.last.set(key, json);
    try { return JSON.parse(json); } catch (e) { return null; }
  }
  // answers whether a row was written
  realmPut(key, obj) {
    const json = JSON.stringify(obj);
    if (this.last.get(key) === json) return false;
    this.last.set(key, json);
    if (this.sql) { try { this.sql.exec('INSERT INTO realm_state (key, json, at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json, at = excluded.at', key, json, this.now()); } catch (e) { return false; } }
    else this.mem.realm.set(key, json);
    return true;
  }
}
