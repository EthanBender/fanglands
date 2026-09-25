// ============================================================================
// THE STORE — the World's tables, the one migration, and the two stores the Room can be given
// room.js never touches SQLite itself: it asks a store. The World hands it new SqlStore(ctx.storage.sql); the
// unit tests and tools/mmo-sim*.js hand it new MemoryStore() (also the Room's default). Both answer exactly the
// same way (online/test/store.test.mjs runs one script of calls against both). Every method is synchronous.
// Pure JavaScript: no Cloudflare APIs, so plain Node can load it.
//
// Migrations keep everything: the old CREATE TABLE statements run unchanged, the new tables are only ever
// created if missing, and migrate() adds the two new accounts columns only when they are not there yet. Nothing
// is dropped, renamed or retyped, and running it again changes nothing. docs/ONLINE.md, "The database".
// ============================================================================

import { PRIZE_KEEP, crackerId } from './party.js';

export const ALWAYS = 8640000000000000;   // the last date JavaScript knows: muted "until an admin unmutes"
const MOD_LOG_KEPT = 5000;                 // the newest rows of mod_log that are kept
const PRUNE_EVERY = 200;                   // mod_log writes between two trims (and the first write after a wake)

// The first six statements are world.js's schema from before admins, verbatim. Split on ';' to run.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  name_lc TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
  created INTEGER NOT NULL, last_seen INTEGER NOT NULL, banned INTEGER NOT NULL DEFAULT 0,
  tries INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, name_lc TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_by_name ON sessions (name_lc);
CREATE TABLE IF NOT EXISTS saves (name_lc TEXT NOT NULL, ver INTEGER NOT NULL, json TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (name_lc, ver));
CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mod_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, by TEXT NOT NULL, act TEXT NOT NULL, target TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS save_pins (name_lc TEXT PRIMARY KEY, json TEXT NOT NULL, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS parties (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, by TEXT NOT NULL, map TEXT NOT NULL, region TEXT NOT NULL DEFAULT '', hat INTEGER NOT NULL, table_json TEXT NOT NULL, count INTEGER NOT NULL, expires INTEGER NOT NULL, ended INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS crackers (party INTEGER NOT NULL, k INTEGER NOT NULL, tx INTEGER NOT NULL, ty INTEGER NOT NULL, lit_by TEXT, lit_at INTEGER, reward TEXT, claimed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (party, k));
CREATE INDEX IF NOT EXISTS crackers_by_lighter ON crackers (lit_by, claimed)
`;

// The columns accounts gained for admins. Added with ALTER TABLE ... ADD COLUMN, which never rewrites a row:
// every existing knight simply reads the default ('player', not muted).
const ACCOUNT_COLUMNS = [
  ['role', "TEXT NOT NULL DEFAULT 'player'"],
  ['muted_until', 'INTEGER NOT NULL DEFAULT 0'],
];

// Adds whatever accounts column is missing, and nothing else. Answers {via, added} so the World can say what it did.
// It reads the columns with PRAGMA table_info(accounts): the Durable Object SQL API allows it (tried under wrangler
// dev, 2026-09-25). Should a runtime ever refuse it, SELECT * FROM accounts LIMIT 0's columnNames is the same list.
export function migrate(sql) {
  let via = 'pragma', cols = [];
  try { cols = sql.exec('PRAGMA table_info(accounts)').toArray().map(r => r.name); } catch (e) { cols = []; }
  if (!cols.length) { via = 'columnNames'; cols = sql.exec('SELECT * FROM accounts LIMIT 0').columnNames; }
  const added = [];
  for (const [name, type] of ACCOUNT_COLUMNS) {
    if (cols.includes(name)) continue;
    sql.exec('ALTER TABLE accounts ADD COLUMN ' + name + ' ' + type);
    added.push(name);
  }
  return { via, added };
}

// A knight's name the way login matches it: spaces squeezed, trimmed, lower case (at most 40 characters).
export const norm = name => String(name || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40);
const clampUntil = until => Math.max(0, Math.min(ALWAYS, Math.floor(Number(until) || 0)));
const roleWord = role => role === 'admin' ? 'admin' : 'player';
const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };

// ---------------------------------------------------------------------------
// SqlStore: over ctx.storage.sql (sql.exec(query, ...args) -> a cursor with toArray()).
// ---------------------------------------------------------------------------
export class SqlStore {
  constructor(sql) { this.sql = sql; this.logWrites = 0; }
  rows(q, ...args) { return this.sql.exec(q, ...args).toArray(); }
  row(q, ...args) { return this.rows(q, ...args)[0] || null; }

  account(name) {
    const lc = norm(name);
    if (!lc) return null;
    const r = this.row('SELECT name, name_lc, role, muted_until, banned FROM accounts WHERE name_lc = ?', lc);
    return r ? { name: r.name, lc: r.name_lc, role: roleWord(r.role), mutedUntil: Number(r.muted_until) || 0, banned: !!r.banned } : null;
  }
  setRole(lc, role) { this.sql.exec('UPDATE accounts SET role = ? WHERE name_lc = ?', roleWord(role), norm(lc)); }
  setMute(lc, until) { this.sql.exec('UPDATE accounts SET muted_until = ? WHERE name_lc = ?', clampUntil(until), norm(lc)); }
  setBanned(lc, banned) {
    const l = norm(lc);
    this.sql.exec('UPDATE accounts SET banned = ? WHERE name_lc = ?', banned ? 1 : 0, l);
    if (banned) this.sql.exec('DELETE FROM sessions WHERE name_lc = ?', l);   // a banned knight is logged out everywhere
  }

  log({ at, by, act, target, detail }) {
    this.sql.exec('INSERT INTO mod_log (at, by, act, target, detail) VALUES (?, ?, ?, ?, ?)', at, String(by), String(act), String(target), String(detail || ''));
    // keep the newest MOD_LOG_KEPT: on the first write after a wake and every PRUNE_EVERY writes after that
    if (++this.logWrites % PRUNE_EVERY === 1) this.sql.exec('DELETE FROM mod_log WHERE id <= (SELECT id FROM mod_log ORDER BY id DESC LIMIT 1 OFFSET ?)', MOD_LOG_KEPT);
  }
  modLog(limit = 200) {
    return this.rows('SELECT at, by, act, target, detail FROM mod_log ORDER BY id DESC LIMIT ?', limit)
      .map(r => ({ at: r.at, by: r.by, act: r.act, target: r.target, detail: r.detail }));
  }
  mutedList(now) { return this.rows('SELECT name, muted_until FROM accounts WHERE muted_until > ? ORDER BY name_lc', now).map(r => ({ name: r.name, until: r.muted_until })); }
  bannedList() { return this.rows('SELECT name FROM accounts WHERE banned != 0 ORDER BY name_lc').map(r => ({ name: r.name })); }

  addParty({ at, by, map, region, hat, table, spots, expires }) {
    // a party whose last moment is more than PRIZE_KEEP ago has no prize left to offer: it goes, crackers and all
    const old = at - PRIZE_KEEP;
    this.sql.exec('DELETE FROM crackers WHERE party IN (SELECT id FROM parties WHERE expires < ?)', old);
    this.sql.exec('DELETE FROM parties WHERE expires < ?', old);
    const id = this.row('INSERT INTO parties (at, by, map, region, hat, table_json, count, expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      at, String(by), String(map), String(region || ''), hat, JSON.stringify(table), spots.length, expires).id;
    // one row at a time: a Durable Object query takes at most 100 bound values, and a party has up to 50 crackers
    for (let k = 0; k < spots.length; k++) this.sql.exec('INSERT INTO crackers (party, k, tx, ty) VALUES (?, ?, ?, ?)', id, k, spots[k][0], spots[k][1]);
    return id;
  }
  liveParties(now) {
    return this.rows('SELECT id, at, by, map, region, hat, table_json, expires FROM parties WHERE ended = 0 AND expires > ? ORDER BY id', now).map(p => ({
      id: p.id, at: p.at, by: p.by, map: p.map, region: p.region, hat: p.hat, table: parse(p.table_json) || [], expires: p.expires,
      crackers: this.rows('SELECT k, tx, ty, lit_by FROM crackers WHERE party = ? ORDER BY k', p.id).map(c => ({ k: c.k, tx: c.tx, ty: c.ty, litBy: c.lit_by })),
    }));
  }
  // true only for the one call that found the cracker unlit. RETURNING, not the cursor's rowsWritten: workerd counts
  // the crackers_by_lighter index entry as a second row written (under wrangler dev this UPDATE answers rowsWritten 2),
  // so "exactly one row came back" is the test that means "this knight lit it first".
  light(pid, k, lc, at, reward) {
    return this.rows('UPDATE crackers SET lit_by = ?, lit_at = ?, reward = ? WHERE party = ? AND k = ? AND lit_by IS NULL RETURNING k',
      lc, at, JSON.stringify(reward), pid, k).length === 1;
  }
  endParty(pid) { this.sql.exec('UPDATE parties SET ended = 1 WHERE id = ?', pid); }
  unclaimed(lc, since) {
    return this.rows('SELECT party, k, reward FROM crackers WHERE lit_by = ? AND claimed = 0 AND lit_at >= ? ORDER BY lit_at, party, k', lc, since)
      .map(r => ({ id: crackerId(r.party, r.k), reward: parse(r.reward) })).filter(w => w.reward);
  }
  // only the knight who lit it can claim it; claiming twice is harmless (the second answers true again)
  claim(pid, k, lc) { return this.rows('UPDATE crackers SET claimed = 1 WHERE party = ? AND k = ? AND lit_by = ? RETURNING k', pid, k, lc).length === 1; }
}

// ---------------------------------------------------------------------------
// MemoryStore: the same answers from plain objects. addAccount makes a knight (tests and simulations only).
// ---------------------------------------------------------------------------
export class MemoryStore {
  constructor() {
    this.accounts = new Map();   // lc -> {name, lc, role, mutedUntil, banned}
    this.modRows = [];           // {id, at, by, act, target, detail}, oldest first
    this.nextLogId = 1;
    this.logWrites = 0;
    this.partyRows = new Map();  // id -> {id, at, by, map, region, hat, table, count, expires, ended, crackers: [...]}
    this.nextPartyId = 1;
  }
  addAccount(name, role = 'player') {
    const lc = norm(name);
    if (!lc) return;
    const a = this.accounts.get(lc);
    if (a) { a.role = roleWord(role); return; }
    this.accounts.set(lc, { name: String(name).replace(/\s+/g, ' ').trim().slice(0, 40), lc, role: roleWord(role), mutedUntil: 0, banned: false });
  }

  account(name) {
    const a = this.accounts.get(norm(name));
    return a ? { name: a.name, lc: a.lc, role: a.role, mutedUntil: a.mutedUntil, banned: a.banned } : null;
  }
  setRole(lc, role) { const a = this.accounts.get(norm(lc)); if (a) a.role = roleWord(role); }
  setMute(lc, until) { const a = this.accounts.get(norm(lc)); if (a) a.mutedUntil = clampUntil(until); }
  setBanned(lc, banned) { const a = this.accounts.get(norm(lc)); if (a) a.banned = !!banned; }

  log({ at, by, act, target, detail }) {
    this.modRows.push({ id: this.nextLogId++, at, by: String(by), act: String(act), target: String(target), detail: String(detail || '') });
    if (++this.logWrites % PRUNE_EVERY === 1 && this.modRows.length > MOD_LOG_KEPT) this.modRows.splice(0, this.modRows.length - MOD_LOG_KEPT);
  }
  modLog(limit = 200) {
    return this.modRows.slice(-Math.max(0, limit)).reverse().map(r => ({ at: r.at, by: r.by, act: r.act, target: r.target, detail: r.detail }));
  }
  mutedList(now) { return this.sorted().filter(a => a.mutedUntil > now).map(a => ({ name: a.name, until: a.mutedUntil })); }
  bannedList() { return this.sorted().filter(a => a.banned).map(a => ({ name: a.name })); }
  sorted() { return Array.from(this.accounts.values()).sort((a, b) => a.lc < b.lc ? -1 : a.lc > b.lc ? 1 : 0); }

  addParty({ at, by, map, region, hat, table, spots, expires }) {
    for (const [id, p] of this.partyRows) if (p.expires < at - PRIZE_KEEP) this.partyRows.delete(id);
    const id = this.nextPartyId++;
    this.partyRows.set(id, {
      id, at, by: String(by), map: String(map), region: String(region || ''), hat, table: JSON.stringify(table), count: spots.length, expires, ended: false,
      crackers: spots.map(([tx, ty], k) => ({ k, tx, ty, litBy: null, litAt: null, reward: null, claimed: false })),
    });
    return id;
  }
  liveParties(now) {
    return Array.from(this.partyRows.values()).filter(p => !p.ended && p.expires > now).sort((a, b) => a.id - b.id).map(p => ({
      id: p.id, at: p.at, by: p.by, map: p.map, region: p.region, hat: p.hat, table: parse(p.table) || [], expires: p.expires,
      crackers: p.crackers.map(c => ({ k: c.k, tx: c.tx, ty: c.ty, litBy: c.litBy })),
    }));
  }
  cracker(pid, k) { const p = this.partyRows.get(pid); return p ? p.crackers[k] || null : null; }
  light(pid, k, lc, at, reward) {
    const c = this.cracker(pid, k);
    if (!c || c.litBy != null) return false;
    c.litBy = lc; c.litAt = at; c.reward = JSON.stringify(reward);
    return true;
  }
  endParty(pid) { const p = this.partyRows.get(pid); if (p) p.ended = true; }
  unclaimed(lc, since) {
    const out = [];
    for (const p of this.partyRows.values()) for (const c of p.crackers) if (c.litBy === lc && !c.claimed && c.litAt >= since) out.push({ pid: p.id, c });
    out.sort((a, b) => (a.c.litAt - b.c.litAt) || (a.pid - b.pid) || (a.c.k - b.c.k));
    return out.map(({ pid, c }) => ({ id: crackerId(pid, c.k), reward: parse(c.reward) })).filter(w => w.reward);
  }
  claim(pid, k, lc) {
    const c = this.cracker(pid, k);
    if (!c || c.litBy !== lc) return false;
    c.claimed = true;
    return true;
  }
}
