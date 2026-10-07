// ============================================================================
// THE MOVEMENT CHECK — watching only (docs/ONLINE.md, "The shared world", Stage 1)
// The world keeps, per knight, where he last said he was, and judges each new presence against it with the Atlas
// (atlas.js): too fast for his mover, or into or through a wall no honest knight can cross (FIXED_SOLID). In Stage 1 it
// only COUNTS. It never sends anything, never moves a knight, never changes what the Room relays. Stage 9 builds the
// soft and correct modes on these same counts, after weeks of them reading zero for honest play.
//
//   const check = new MoveCheck({ atlas, book, mode })     atlas: readAtlas(...) or null (then nothing is judged or counted)
//   check.mode = 'observe' | 'off'                          off: nothing is judged or counted, from the next presence
//   check.judge(k, m, now)                                  k: the Room's knight ({name, map, atlas}), m: his presence;
//                                                           answers what it found (for the tests): null, {skip}, {ok}, {kind}
//   const book = new MoveBook(sql | null, now)              where the counts and the violations go (sql: the Durable Object
//   book.flush(); book.view(days)                           SQL API, or node:sqlite in the tests; null: memory only)
//
// The rules, in short (the contract has them in full):
//   time    each presence is stamped on arrival, but never closer than MIN_GAP after the one before: the game sends at most
//           one every 1/8 s of its own time, which never runs ahead of real time, so a stalled line that delivers a second
//           of presences at once is spread back out, and a hitch in the game only ever slows him down
//   jump    j went up: that one step is never too fast (a teleport, a respawn, a portal, a shove), but must not land in a wall;
//           more than JUMPS_MAX jumps in JUMP_WINDOW is logged as 'jumps' (not a violation)
//   speed   over the last WINDOW ms, the reported path is longer than OVER x max(spd, FOOT) x seconds + SLACK px
//   wall    the new spot is in a FIXED_SOLID tile (or off the map), or the straight line from the last spot crosses a
//           FIXED_SOLID tile's middle (the tile shrunk by CORE px on each side)
// Pure JavaScript; no Cloudflare APIs.
// ============================================================================

import { isHouse } from './atlas.js';

export const MOVE_DAY_SCHEMA = 'CREATE TABLE IF NOT EXISTS move_day (day TEXT PRIMARY KEY, checked INTEGER NOT NULL DEFAULT 0, speed INTEGER NOT NULL DEFAULT 0, wall INTEGER NOT NULL DEFAULT 0, jumps INTEGER NOT NULL DEFAULT 0, waived INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0, old INTEGER NOT NULL DEFAULT 0)';
export const MOVE_LOG_SCHEMA = "CREATE TABLE IF NOT EXISTS move_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, n TEXT NOT NULL, map TEXT NOT NULL, kind TEXT NOT NULL, x INTEGER, y INTEGER, px INTEGER, py INTEGER, ms INTEGER, spd INTEGER, detail TEXT NOT NULL DEFAULT '')";
export const MOVE_MODES = ['observe', 'off'];
export const MIN_GAP = 125;          // ms: the game's own presence cap (1/8 s)
export const WINDOW = 1000;          // ms: the speed window
export const OVER = 1.25;            // how much faster than his speed a path may read before it counts
export const SLACK = 48;             // px on top: rounding, a step's worth of jitter
export const FOOT = 175;             // px/s: no speed is ever judged as slower than walking
export const CORE = 12;              // px: a FIXED_SOLID tile's middle is the tile shrunk by this on each side
export const STEP = 4;               // px: how finely a line is walked for the crossing check
export const CROSS_MAX = 40 * 48;    // px: a longer line is never walked (the speed check catches it): one message can never cost the World more than ~480 steps
export const JUMP_WINDOW = 10000, JUMPS_MAX = 6;
export const LOG_PER_DAY = 200;      // violation rows kept a day; past that only the counts grow
export const KEEP_DAYS = 60;         // rows older than this go on the first write of a day
export const WRITE_AT = 2000, WRITE_EVERY = 60000;   // counts waiting that force a write, and the longest they wait (each write is
// a row written, a free-plan limit of its own: at 10 s this was 360 rows an hour while anyone played; a nap can lose the last minute)
const COUNTS = ['checked', 'speed', 'wall', 'jumps', 'waived', 'skipped', 'old'];

export const dayOf = ms => new Date(ms).toISOString().slice(0, 10);
const num = v => typeof v === 'number' && Number.isFinite(v);

export class MoveCheck {
  constructor({ atlas = null, book = null, mode = 'observe', now = () => Date.now() } = {}) {
    this.atlas = atlas;
    this.book = book || new MoveBook(null, now);
    this.mode = MOVE_MODES.includes(mode) ? mode : 'observe';
  }
  skip(st, k, old) { this.book.count('skipped'); if (old) this.book.count('old'); return { skip: true, old: !!old }; }
  judge(k, m, now) {
    if (this.mode === 'off' || !this.atlas) return null;
    const A = this.atlas;
    const st = k.mv || (k.mv = { map: null, x: null, y: null, t: 0, j: null, spd: FOOT, dead: false, segs: [], jumps: [], burst: false, speedAt: -Infinity });
    const map = k.map, dead = !!m.dead;
    const restart = () => { st.map = map; st.x = num(m.x) ? m.x : null; st.y = num(m.y) ? m.y : null; st.t = now; st.j = num(m.j) ? m.j : null; st.spd = this.spdOf(m); st.dead = dead; st.segs = []; };
    // not judged: another Atlas or none, the island, a map the Atlas does not know, no position, a death, a first step
    if (k.atlas !== A.hash) { restart(); return this.skip(st, k, true); }
    if (isHouse(map) || !A.knows(map) || !num(m.x) || !num(m.y)) { restart(); return this.skip(st, k); }
    // off the map (or absurdly far off it): never judged and never remembered, so the next presence starts afresh
    if (!this.onMap(m.x, m.y)) { restart(); st.x = null; st.y = null; return this.skip(st, k); }
    if (dead || st.dead || st.map !== map || st.x === null) { restart(); return this.skip(st, k); }
    const t = Math.max(now, st.t + MIN_GAP);
    const x = m.x, y = m.y, px = st.x, py = st.y, ms = t - st.t;
    const jumped = num(m.j) && st.j !== null && m.j !== st.j;
    const spd = Math.max(this.spdOf(m), st.spd);
    let found = null;
    this.book.count('checked');
    // a wall: in one now, or straight through the middle of one (a jump is judged only by where it lands)
    const into = A.solidAt(map, Math.floor(x / A.TILE), Math.floor(y / A.TILE));
    if (into || (!jumped && this.crosses(map, px, py, x, y))) found = { kind: 'wall', detail: into ? 'in' : 'through' };
    if (jumped) {
      this.book.count('waived');
      st.segs = [];
      st.jumps.push(t); while (st.jumps.length && st.jumps[0] <= t - JUMP_WINDOW) st.jumps.shift();
      if (st.jumps.length > JUMPS_MAX && !st.burst) { st.burst = true; this.book.count('jumps'); this.book.log({ at: now, n: k.name, map: wireMap(map), kind: 'jumps', x, y, px, py, ms, spd, detail: st.jumps.length + ' jumps in ' + (JUMP_WINDOW / 1000) + ' s' }); }
      if (st.jumps.length <= JUMPS_MAX) st.burst = false;
    } else {
      st.segs.push({ t0: st.t, t1: t, d: Math.hypot(x - px, y - py), spd });
      while (st.segs.length && st.segs[0].t1 <= t - WINDOW) st.segs.shift();
      if (!found && st.segs.length) {
        const span = (t - st.segs[0].t0) / 1000;
        let d = 0, top = FOOT; for (const s of st.segs) { d += s.d; if (s.spd > top) top = s.spd; }
        const allow = OVER * Math.max(top, FOOT) * span + SLACK;
        // one counted a second at most: the window starts again, and a second must pass before the next can count
        if (d > allow) { if (!(t - st.speedAt < WINDOW)) { found = { kind: 'speed', detail: Math.round(d) + ' px in ' + span.toFixed(2) + ' s, ' + Math.round(allow) + ' allowed' }; st.speedAt = t; } st.segs = []; }
      }
    }
    if (found) {
      this.book.count(found.kind);
      this.book.log({ at: now, n: k.name, map: wireMap(map), kind: found.kind, x, y, px, py, ms, spd, detail: found.detail });
    }
    st.x = x; st.y = y; st.t = t; st.j = num(m.j) ? m.j : st.j; st.spd = this.spdOf(m); st.dead = false;
    return found || { ok: true };
  }
  // his reported speed, never under walking and never over the fastest mover the Atlas knows
  spdOf(m) { return Math.min(num(m.spd) ? Math.max(m.spd, FOOT) : FOOT, this.atlas ? this.atlas.speedMax : 350); }
  // the straight line from (x0, y0) to (x1, y1) passes through the middle of a FIXED_SOLID tile
  // on the overworld's area, give or take two tiles (every instance fits inside it; a step just past the edge is still
  // judged, as walking into a wall): anything further out is a forged or broken position
  onMap(x, y) { const A = this.atlas, M = 2 * A.TILE; return x >= -M && y >= -M && x < A.MAP_W * A.TILE + M && y < A.MAP_H * A.TILE + M; }
  crosses(map, x0, y0, x1, y1) {
    const A = this.atlas, W = A.TILE, len = Math.hypot(x1 - x0, y1 - y0);
    if (!(len <= CROSS_MAX)) return false;
    const n = Math.max(1, Math.ceil(len / STEP));
    for (let i = 1; i < n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      const tx = Math.floor(x / W), ty = Math.floor(y / W);
      if (!A.solidAt(map, tx, ty)) continue;
      const lx = x - tx * W, ly = y - ty * W;
      if (lx >= CORE && lx <= W - CORE && ly >= CORE && ly <= W - CORE) return true;
    }
    return false;
  }
}

// the map as every message out names it: a knight's own island is 'house' (room.js keys it 'house:<name>')
export const wireMap = map => isHouse(map) ? 'house' : map;

// ---------- where the counts and the violations go ----------
export class MoveBook {
  constructor(sql, now = () => Date.now()) {
    this.sql = sql || null;
    this.now = now;
    if (this.sql) { this.sql.exec(MOVE_DAY_SCHEMA); this.sql.exec(MOVE_LOG_SCHEMA); }
    this.waiting = new Map();   // day -> counts not yet written
    this.n = 0;
    this.lastWrite = now();
    this.lastDay = null;
    this.logged = new Map();    // day -> rows written today (read from the table on the first row of a day per wake)
    this.mem = { days: new Map(), rows: [] };   // memory only (no sql): everything stays here
  }
  count(kind, by = 1) {
    if (!COUNTS.includes(kind)) return;
    const day = dayOf(this.now());
    let w = this.waiting.get(day); if (!w) { w = {}; for (const c of COUNTS) w[c] = 0; this.waiting.set(day, w); }
    w[kind] += by; this.n += by;
    if (this.n >= WRITE_AT || this.now() - this.lastWrite >= WRITE_EVERY) this.flush();
  }
  log(row) {
    const day = dayOf(row.at);
    let n = this.logged.get(day);
    if (n === undefined) {
      n = 0;
      if (this.sql) { try { const start = Date.parse(day + 'T00:00:00Z'); n = Number(this.sql.exec('SELECT COUNT(*) AS c FROM move_log WHERE at >= ? AND at < ?', start, start + 86400000).toArray()[0].c) || 0; } catch (e) { } }
      else n = this.mem.rows.filter(r => dayOf(r.at) === day).length;
    }
    if (n >= LOG_PER_DAY) { this.logged.set(day, n); return false; }
    this.logged.set(day, n + 1);
    const r = { at: Math.round(row.at), n: String(row.n).slice(0, 40), map: String(row.map).slice(0, 64), kind: row.kind, x: rnd(row.x), y: rnd(row.y), px: rnd(row.px), py: rnd(row.py), ms: rnd(row.ms), spd: rnd(row.spd), detail: String(row.detail || '').slice(0, 200) };
    if (!this.sql) { this.mem.rows.push(r); return true; }
    try { this.sql.exec('INSERT INTO move_log (at, n, map, kind, x, y, px, py, ms, spd, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', r.at, r.n, r.map, r.kind, r.x, r.y, r.px, r.py, r.ms, r.spd, r.detail); } catch (e) { console.error('move log', e); return false; }
    return true;
  }
  flush() {
    this.lastWrite = this.now();
    if (!this.n) return 0;
    let rows = 0;
    for (const [day, w] of this.waiting) {
      if (!this.sql) {
        const d = this.mem.days.get(day) || {}; for (const c of COUNTS) d[c] = (d[c] || 0) + w[c]; this.mem.days.set(day, d);
      } else {
        try {
          this.sql.exec(`INSERT INTO move_day (day, ${COUNTS.join(', ')}) VALUES (?, ${COUNTS.map(() => '?').join(', ')}) ON CONFLICT(day) DO UPDATE SET ${COUNTS.map(c => c + ' = ' + c + ' + excluded.' + c).join(', ')}`, day, ...COUNTS.map(c => w[c]));
        } catch (e) { console.error('move counts', e); continue; }
      }
      for (const c of COUNTS) this.n -= w[c];
      this.waiting.delete(day); rows++;
      if (day !== this.lastDay) { this.prune(day); this.lastDay = day; }
    }
    return rows;
  }
  prune(day) {
    const cutMs = Date.parse(day + 'T00:00:00Z') - KEEP_DAYS * 86400000, cut = dayOf(cutMs);
    if (!this.sql) { this.mem.rows = this.mem.rows.filter(r => r.at >= cutMs); for (const d of Array.from(this.mem.days.keys())) if (d < cut) this.mem.days.delete(d); return; }
    try { this.sql.exec('DELETE FROM move_day WHERE day < ?', cut); this.sql.exec('DELETE FROM move_log WHERE at < ?', cutMs); } catch (e) { console.error('move prune', e); }
  }
  // the parent page's view: today with what is still waiting, the newest `days` rows, the newest 30 violations
  view(days = 14, recent = 30) {
    const today = dayOf(this.now());
    let list;
    if (this.sql) list = this.sql.exec(`SELECT day, ${COUNTS.join(', ')} FROM move_day ORDER BY day DESC LIMIT ?`, days).toArray().map(r => { const o = { day: r.day }; for (const c of COUNTS) o[c] = Number(r[c]) || 0; return o; });
    else list = Array.from(this.mem.days.entries()).map(([day, d]) => Object.assign({ day }, d));
    for (const [day, w] of this.waiting) {
      let r = list.find(x => x.day === day); if (!r) { r = { day }; for (const c of COUNTS) r[c] = 0; list.push(r); }
      for (const c of COUNTS) r[c] += w[c];
    }
    list.sort((a, b) => a.day < b.day ? 1 : a.day > b.day ? -1 : 0);
    const blank = { day: today }; for (const c of COUNTS) blank[c] = 0;
    const rows = this.sql ? this.sql.exec('SELECT at, n, map, kind, x, y, px, py, ms, spd, detail FROM move_log ORDER BY id DESC LIMIT ?', recent).toArray().map(r => Object.assign({}, r)) : this.mem.rows.slice(-recent).reverse();
    return { today: list.find(r => r.day === today) || blank, days: list.slice(0, days), recent: rows, waiting: this.n };
  }
}
const rnd = v => (typeof v === 'number' && Number.isFinite(v)) ? Math.round(v) : null;
