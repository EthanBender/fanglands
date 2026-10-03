// ============================================================================
// THE STORE — the World's tables, the one migration, and the two stores the Room can be given
// room.js never touches SQLite itself: it asks a store. The World hands it new SqlStore(ctx.storage.sql); the
// unit tests and tools/mmo-sim*.js hand it new MemoryStore() (also the Room's default). Both answer exactly the
// same way (online/test/store.test.mjs runs one script of calls against both). Every method is synchronous.
// Pure JavaScript: no Cloudflare APIs, so plain Node can load it.
//
// Migrations keep everything: the old CREATE TABLE statements run unchanged, the new tables are only ever
// created if missing, and migrate() adds the new accounts columns only when they are not there yet. Nothing
// is dropped, renamed or retyped, and running it again changes nothing. docs/ONLINE.md, "The database".
//
// Logins (docs/ONLINE.md, "Accounts"): one row per socket a knight opens, from join to close, the newest LOGINS_KEPT
// per knight. Every closed row adds its length to accounts.online_ms, so the total never shrinks when old rows go.
// ============================================================================

import { PRIZE_KEEP, crackerId } from './party.js';

export const ALWAYS = 8640000000000000;   // the last date JavaScript knows: muted "until an admin unmutes"
const MOD_LOG_KEPT = 5000;                 // the newest rows of mod_log that are kept
const PRUNE_EVERY = 200;                   // mod_log writes between two trims (and the first write after a wake)
const TRADES_KEPT = 5000;                  // the newest rows of trades that are kept (the same trim rhythm)
export const LOGINS_KEPT = 50;             // login rows kept per knight (the totals live in accounts.online_ms)
// Word strikes (docs/ONLINE.md, "Word strikes"): a knight's count goes back to 0 after this long with no new strike, and the
// third strike (and every one after it) keeps the knight out for WORD_LOCK_MS.
export const WORD_STRIKE_FADE = 30 * 24 * 3600 * 1000;
export const WORD_LOCK_MS = 24 * 3600 * 1000;
// The count as it stands now: a count whose last strike is WORD_STRIKE_FADE or more ago has faded to 0.
export const strikesNow = (strikes, at, now) => (Number(at) > 0 && now - Number(at) >= WORD_STRIKE_FADE) ? 0 : Math.max(0, Math.floor(Number(strikes) || 0));

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
CREATE INDEX IF NOT EXISTS crackers_by_lighter ON crackers (lit_by, claimed);
CREATE TABLE IF NOT EXISTS trades (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, a TEXT NOT NULL, a_lc TEXT NOT NULL, b TEXT NOT NULL, b_lc TEXT NOT NULL, a_gave TEXT NOT NULL, b_gave TEXT NOT NULL, a_ack INTEGER NOT NULL DEFAULT 0, b_ack INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS trades_by_a ON trades (a_lc, a_ack);
CREATE INDEX IF NOT EXISTS trades_by_b ON trades (b_lc, b_ack);
CREATE TABLE IF NOT EXISTS logins (id INTEGER PRIMARY KEY AUTOINCREMENT, name_lc TEXT NOT NULL, started INTEGER NOT NULL, seen INTEGER NOT NULL, ended INTEGER);
CREATE INDEX IF NOT EXISTS logins_by_name ON logins (name_lc, id)
`;

// The columns accounts gained for admins. Added with ALTER TABLE ... ADD COLUMN, which never rewrites a row:
// every existing knight simply reads the default ('player', not muted).
const ACCOUNT_COLUMNS = [
  ['role', "TEXT NOT NULL DEFAULT 'player'"],
  ['muted_until', 'INTEGER NOT NULL DEFAULT 0'],
  ['online_ms', 'INTEGER NOT NULL DEFAULT 0'],   // the length of every closed login, added up (the accounts list's "Time online")
  // word strikes: their own columns, never the wrong-secret-word tries / locked_until
  ['word_strikes', 'INTEGER NOT NULL DEFAULT 0'],        // bad lines counted (read through strikesNow: it fades)
  ['word_strike_at', 'INTEGER NOT NULL DEFAULT 0'],      // when the last one was counted (0: never)
  ['words_locked_until', 'INTEGER NOT NULL DEFAULT 0'],  // kept out for bad words until then (0: not kept out)
  // the place (CF-Connecting-IP) a knight kept out for bad words was sent out from: only so it cannot make a new knight from
  // there (world.signup). Written with the lockout and nowhere else, emptied when the lockout is cleared or over (the World
  // empties lapsed ones on every wake); '' the rest of the time. Never shown on any list.
  ['last_ip', "TEXT NOT NULL DEFAULT ''"],
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
  // txn(fn): runs fn as one transaction (the World passes ctx.storage.transactionSync), so a write that fails part-way leaves
  // nothing half done. Without one, fn just runs.
  constructor(sql, txn) { this.sql = sql; this.txn = typeof txn === 'function' ? txn : (fn => fn()); this.logWrites = 0; this.tradeWrites = 0; }
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
    // keep the newest MOD_LOG_KEPT: on the first write after a wake and every PRUNE_EVERY writes after that. A rename row is
    // always kept: a login with the old name finds the knight through it (renamedFrom), however many strikes came after.
    if (++this.logWrites % PRUNE_EVERY === 1) this.sql.exec("DELETE FROM mod_log WHERE act != 'rename' AND id <= (SELECT id FROM mod_log ORDER BY id DESC LIMIT 1 OFFSET ?)", MOD_LOG_KEPT);
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

  // ---------- finished trades (docs/ONLINE.md, "Trading") ----------
  // One row per trade that happened: who, what each gave, and whether each side's game has said it is in its save.
  addTrade({ at, a, b, aGave, bGave }) {
    const id = this.row('INSERT INTO trades (at, a, a_lc, b, b_lc, a_gave, b_gave) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      at, String(a), norm(a), String(b), norm(b), JSON.stringify(aGave || []), JSON.stringify(bGave || [])).id;
    if (++this.tradeWrites % PRUNE_EVERY === 1) this.sql.exec('DELETE FROM trades WHERE id <= (SELECT id FROM trades ORDER BY id DESC LIMIT 1 OFFSET ?)', TRADES_KEPT);
    return id;
  }
  // the trades this knight's game has not acked since `since`, oldest first, as that knight sees them
  unackedTrades(lc, since) {
    const l = norm(lc);
    return this.rows('SELECT id, a, a_lc, b, b_lc, a_gave, b_gave FROM trades WHERE at >= ? AND ((a_lc = ? AND a_ack = 0) OR (b_lc = ? AND b_ack = 0)) ORDER BY id', since, l, l)
      .map(r => r.a_lc === l ? { tid: r.id, with: r.b, gave: parse(r.a_gave) || [], got: parse(r.b_gave) || [] } : { tid: r.id, with: r.a, gave: parse(r.b_gave) || [], got: parse(r.a_gave) || [] });
  }
  // only one of the two knights in it can ack a trade; acking twice is harmless
  ackTrade(tid, lc) {
    const l = norm(lc);
    const a = this.rows('UPDATE trades SET a_ack = 1 WHERE id = ? AND a_lc = ? RETURNING id', tid, l).length;
    const b = this.rows('UPDATE trades SET b_ack = 1 WHERE id = ? AND b_lc = ? RETURNING id', tid, l).length;
    return a + b > 0;
  }
  // the parent page's list, newest first
  tradeLog(limit = 200) {
    return this.rows('SELECT id, at, a, b, a_gave, b_gave, a_ack, b_ack FROM trades ORDER BY id DESC LIMIT ?', limit)
      .map(r => ({ tid: r.id, at: r.at, a: r.a, b: r.b, aGave: parse(r.a_gave) || [], bGave: parse(r.b_gave) || [], aAck: !!r.a_ack, bAck: !!r.b_ack }));
  }
  // ---------- logins: one row per socket, join to close ----------
  // When the counting began: written the first time it is asked for (the first wake of this code), never changed.
  trackingSince(now) {
    this.sql.exec("INSERT INTO settings (key, value) VALUES ('logins_since', ?) ON CONFLICT(key) DO NOTHING", String(Math.floor(now)));
    return Number(this.row("SELECT value FROM settings WHERE key = 'logins_since'").value) || Math.floor(now);
  }
  // a new open row; the oldest closed rows past LOGINS_KEPT for that knight go (the total is already in online_ms)
  loginStart(lc, at) {
    const l = norm(lc);
    const id = this.row('INSERT INTO logins (name_lc, started, seen) VALUES (?, ?, ?) RETURNING id', l, at, at).id;
    this.sql.exec('DELETE FROM logins WHERE name_lc = ? AND ended IS NOT NULL AND id NOT IN (SELECT id FROM logins WHERE name_lc = ? ORDER BY id DESC LIMIT ?)', l, l, LOGINS_KEPT);
    return id;
  }
  // the last time the world heard from that socket: where a login the world lost track of is said to have ended
  loginSeen(id, at) { this.sql.exec('UPDATE logins SET seen = ? WHERE id = ? AND ended IS NULL AND seen < ?', at, id, at); }
  // closes an open row and adds its length to the knight's total; true only for the call that closed it
  loginEnd(id, at) {
    const r = this.row('UPDATE logins SET ended = MAX(started, ?) WHERE id = ? AND ended IS NULL RETURNING name_lc, started, ended', at, id);
    if (!r) return false;
    this.sql.exec('UPDATE accounts SET online_ms = online_ms + ? WHERE name_lc = ?', r.ended - r.started, r.name_lc);
    return true;
  }
  // every open row whose socket is not in keep (a Set of ids) ends at the last time it was heard from; answers how many
  closeStaleLogins(keep, now) {
    let n = 0;
    for (const r of this.rows('SELECT id, started, seen FROM logins WHERE ended IS NULL ORDER BY id')) {
      if (keep.has(r.id)) continue;
      if (this.loginEnd(r.id, Math.min(now, Math.max(r.started, r.seen)))) n++;
    }
    return n;
  }
  // newest first: [{id, started, seen, ended}], ended null while it is still open
  logins(lc, limit = 10) {
    return this.rows('SELECT id, started, seen, ended FROM logins WHERE name_lc = ? ORDER BY id DESC LIMIT ?', norm(lc), limit)
      .map(r => ({ id: r.id, started: r.started, seen: r.seen, ended: r.ended == null ? null : r.ended }));
  }
  // the closed logins added up, in ms (an open one is the caller's to add: it knows the time)
  onlineMs(lc) { const r = this.row('SELECT online_ms FROM accounts WHERE name_lc = ?', norm(lc)); return r ? Number(r.online_ms) || 0 : 0; }
  // a new secret word: the hash and salt, the wrong-tries count cleared, every session gone
  setSecret(lc, salt, hash) {
    const l = norm(lc);
    this.sql.exec('UPDATE accounts SET salt = ?, hash = ?, tries = 0, locked_until = 0 WHERE name_lc = ?', salt, hash, l);
    this.sql.exec('DELETE FROM sessions WHERE name_lc = ?', l);
  }
  // how many rows of that act this knight wrote to mod_log since then (the reset's rate limit)
  actsSince(by, act, since) { return Number(this.row('SELECT COUNT(*) AS n FROM mod_log WHERE by = ? AND act = ? AND at > ?', String(by), String(act), since).n) || 0; }

  // ---------- word strikes (docs/ONLINE.md, "Word strikes") ----------
  // {strikes (faded), at, lockedUntil}, or null for no such knight
  wordStrikes(lc, now) {
    const r = this.row('SELECT word_strikes, word_strike_at, words_locked_until FROM accounts WHERE name_lc = ?', norm(lc));
    return r ? { strikes: strikesNow(r.word_strikes, r.word_strike_at, now), at: Number(r.word_strike_at) || 0, lockedUntil: Number(r.words_locked_until) || 0 } : null;
  }
  // one more strike on top of the count as it stands now (a faded count starts again at 1); answers the new count
  addWordStrike(lc, now) {
    const cur = this.wordStrikes(lc, now);
    if (!cur) return null;
    this.sql.exec('UPDATE accounts SET word_strikes = ?, word_strike_at = ? WHERE name_lc = ?', cur.strikes + 1, Math.floor(now), norm(lc));
    return cur.strikes + 1;
  }
  // ip: the place the knight was sent out from ('' when the socket did not say), kept only as long as the lockout
  setWordLock(lc, until, ip) { this.sql.exec('UPDATE accounts SET words_locked_until = ?, last_ip = ? WHERE name_lc = ?', clampUntil(until), String(ip || '').slice(0, 64), norm(lc)); }
  clearWordStrikes(lc) { this.sql.exec("UPDATE accounts SET word_strikes = 0, word_strike_at = 0, words_locked_until = 0, last_ip = '' WHERE name_lc = ?", norm(lc)); }
  // the places of lockouts that are over are forgotten (the World, on every wake)
  forgetPlaces(now) { this.sql.exec("UPDATE accounts SET last_ip = '' WHERE last_ip != '' AND words_locked_until <= ?", now); }

  // ---------- a new name (docs/ONLINE.md, "Renaming a knight") ----------
  // Rewrites the name everywhere it is kept: the account, its sessions, saves, pinned backup, logins and the crackers it lit
  // (by lower-case name), both sides of its trades, and the display copies in chat, mod_log and drop parties. The caller
  // has already checked the new name (the filter, and nobody else has it). Answers {from, to}, or null for no such knight.
  rename(lc, name) {
    const o = norm(lc), to = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40), n = norm(to);
    const a = o && this.row('SELECT name FROM accounts WHERE name_lc = ?', o);
    if (!a || !n) return null;
    // a dozen UPDATEs: all of them or none (a failure part-way would leave the name changed in some tables only)
    this.txn(() => this.renameRows(o, to, n));
    return { from: a.name, to };
  }
  renameRows(o, to, n) {
    this.sql.exec('UPDATE accounts SET name = ?, name_lc = ? WHERE name_lc = ?', to, n, o);
    if (n !== o) for (const [table, col] of [['sessions', 'name_lc'], ['saves', 'name_lc'], ['save_pins', 'name_lc'], ['logins', 'name_lc'], ['crackers', 'lit_by']]) this.sql.exec(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`, n, o);
    this.sql.exec('UPDATE trades SET a = ?, a_lc = ? WHERE a_lc = ?', to, n, o);
    this.sql.exec('UPDATE trades SET b = ?, b_lc = ? WHERE b_lc = ?', to, n, o);
    this.sql.exec('UPDATE chat SET name = ? WHERE lower(name) = ?', to, o);
    this.sql.exec('UPDATE mod_log SET target = ? WHERE lower(target) = ?', to, o);
    this.sql.exec('UPDATE mod_log SET by = ? WHERE lower(by) = ?', to, o);
    this.sql.exec('UPDATE parties SET by = ? WHERE lower(by) = ?', to, o);
  }
  // the name a rename gave the knight once called this (the newest), or null: a knight logging in with the old name
  renamedFrom(name) {
    const r = this.row("SELECT target FROM mod_log WHERE act = 'rename' AND lower(detail) = ? ORDER BY id DESC LIMIT 1", norm(name));
    return r ? r.target : null;
  }
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
    this.tradeRows = [];         // {id, at, a, a_lc, b, b_lc, a_gave, b_gave (JSON), a_ack, b_ack}, oldest first
    this.nextTradeId = 1;
    this.tradeWrites = 0;
    this.loginRows = [];         // {id, lc, started, seen, ended}
    this.nextLoginId = 1;
    this.since = null;           // trackingSince: set the first time it is asked for
  }
  addAccount(name, role = 'player') {
    const lc = norm(name);
    if (!lc) return;
    const a = this.accounts.get(lc);
    if (a) { a.role = roleWord(role); return; }
    this.accounts.set(lc, { name: String(name).replace(/\s+/g, ' ').trim().slice(0, 40), lc, role: roleWord(role), mutedUntil: 0, banned: false, onlineMs: 0, wordStrikes: 0, wordStrikeAt: 0, wordsLockedUntil: 0 });
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
    if (++this.logWrites % PRUNE_EVERY === 1 && this.modRows.length > MOD_LOG_KEPT) {
      const cut = this.modRows[this.modRows.length - MOD_LOG_KEPT - 1].id;   // as SqlStore: rows up to that id go, a rename row stays
      this.modRows = this.modRows.filter(r => r.act === 'rename' || r.id > cut);
    }
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

  addTrade({ at, a, b, aGave, bGave }) {
    const id = this.nextTradeId++;
    this.tradeRows.push({ id, at, a: String(a), a_lc: norm(a), b: String(b), b_lc: norm(b), a_gave: JSON.stringify(aGave || []), b_gave: JSON.stringify(bGave || []), a_ack: false, b_ack: false });
    if (++this.tradeWrites % PRUNE_EVERY === 1 && this.tradeRows.length > TRADES_KEPT) this.tradeRows.splice(0, this.tradeRows.length - TRADES_KEPT);
    return id;
  }
  unackedTrades(lc, since) {
    const l = norm(lc);
    return this.tradeRows.filter(r => r.at >= since && ((r.a_lc === l && !r.a_ack) || (r.b_lc === l && !r.b_ack)))
      .map(r => r.a_lc === l ? { tid: r.id, with: r.b, gave: parse(r.a_gave) || [], got: parse(r.b_gave) || [] } : { tid: r.id, with: r.a, gave: parse(r.b_gave) || [], got: parse(r.a_gave) || [] });
  }
  ackTrade(tid, lc) {
    const l = norm(lc), r = this.tradeRows.find(x => x.id === tid);
    if (!r) return false;
    let hit = false;
    if (r.a_lc === l) { r.a_ack = true; hit = true; }
    if (r.b_lc === l) { r.b_ack = true; hit = true; }
    return hit;
  }
  tradeLog(limit = 200) {
    return this.tradeRows.slice(-Math.max(0, limit)).reverse()
      .map(r => ({ tid: r.id, at: r.at, a: r.a, b: r.b, aGave: parse(r.a_gave) || [], bGave: parse(r.b_gave) || [], aAck: r.a_ack, bAck: r.b_ack }));
  }
  // ---------- logins: the same answers as SqlStore's ----------
  trackingSince(now) { if (this.since == null) this.since = Math.floor(now); return this.since; }
  loginStart(lc, at) {
    const l = norm(lc), id = this.nextLoginId++;
    this.loginRows.push({ id, lc: l, started: at, seen: at, ended: null });
    const mine = this.loginRows.filter(r => r.lc === l).sort((a, b) => b.id - a.id), keep = new Set(mine.slice(0, LOGINS_KEPT).map(r => r.id));
    this.loginRows = this.loginRows.filter(r => r.lc !== l || r.ended == null || keep.has(r.id));
    return id;
  }
  loginSeen(id, at) { const r = this.loginRows.find(x => x.id === id); if (r && r.ended == null && r.seen < at) r.seen = at; }
  loginEnd(id, at) {
    const r = this.loginRows.find(x => x.id === id);
    if (!r || r.ended != null) return false;
    r.ended = Math.max(r.started, at);
    const a = this.accounts.get(r.lc); if (a) a.onlineMs = (a.onlineMs || 0) + (r.ended - r.started);
    return true;
  }
  closeStaleLogins(keep, now) {
    let n = 0;
    for (const r of this.loginRows.slice().sort((a, b) => a.id - b.id)) if (r.ended == null && !keep.has(r.id) && this.loginEnd(r.id, Math.min(now, Math.max(r.started, r.seen)))) n++;
    return n;
  }
  logins(lc, limit = 10) {
    const l = norm(lc);
    return this.loginRows.filter(r => r.lc === l).sort((a, b) => b.id - a.id).slice(0, limit).map(r => ({ id: r.id, started: r.started, seen: r.seen, ended: r.ended }));
  }
  onlineMs(lc) { const a = this.accounts.get(norm(lc)); return a ? a.onlineMs || 0 : 0; }
  setSecret(lc, salt, hash) { const a = this.accounts.get(norm(lc)); if (a) { a.salt = salt; a.hash = hash; } }
  actsSince(by, act, since) { return this.modRows.filter(r => r.by === String(by) && r.act === String(act) && r.at > since).length; }

  // ---------- word strikes and renames: the same answers as SqlStore's ----------
  wordStrikes(lc, now) {
    const a = this.accounts.get(norm(lc));
    return a ? { strikes: strikesNow(a.wordStrikes, a.wordStrikeAt, now), at: a.wordStrikeAt || 0, lockedUntil: a.wordsLockedUntil || 0 } : null;
  }
  addWordStrike(lc, now) {
    const a = this.accounts.get(norm(lc)), cur = this.wordStrikes(lc, now);
    if (!a || !cur) return null;
    a.wordStrikes = cur.strikes + 1; a.wordStrikeAt = Math.floor(now);
    return a.wordStrikes;
  }
  setWordLock(lc, until, ip) { const a = this.accounts.get(norm(lc)); if (a) { a.wordsLockedUntil = clampUntil(until); a.lastIp = String(ip || '').slice(0, 64); } }
  clearWordStrikes(lc) { const a = this.accounts.get(norm(lc)); if (a) { a.wordStrikes = 0; a.wordStrikeAt = 0; a.wordsLockedUntil = 0; a.lastIp = ''; } }
  forgetPlaces(now) { for (const a of this.accounts.values()) if (a.wordsLockedUntil <= now) a.lastIp = ''; }
  rename(lc, name) {
    const o = norm(lc), to = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40), n = norm(to), a = this.accounts.get(o);
    if (!a || !n) return null;
    const from = a.name;
    this.accounts.delete(o); a.name = to; a.lc = n; this.accounts.set(n, a);
    for (const r of this.loginRows) if (r.lc === o) r.lc = n;
    for (const r of this.tradeRows) { if (r.a_lc === o) { r.a = to; r.a_lc = n; } if (r.b_lc === o) { r.b = to; r.b_lc = n; } }
    for (const r of this.modRows) { if (r.target.toLowerCase() === o) r.target = to; if (r.by.toLowerCase() === o) r.by = to; }
    for (const p of this.partyRows.values()) { if (p.by.toLowerCase() === o) p.by = to; for (const c of p.crackers) if (c.litBy === o) c.litBy = n; }
    return { from, to };
  }
  renamedFrom(name) {
    const l = norm(name);
    for (let i = this.modRows.length - 1; i >= 0; i--) { const r = this.modRows[i]; if (r.act === 'rename' && r.detail.toLowerCase() === l) return r.target; }
    return null;
  }
}
