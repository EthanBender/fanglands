// ============================================================================
// THE WORLD — the one Durable Object that holds the accounts, the saves, the chat log and the live room
// SQLite-backed (this.ctx.storage.sql). Every /api call and every /ws socket lands here, so the invite
// code, the sessions and the roster all live in one place with no races. The WebSockets use the
// Hibernation API: an idle world is put to sleep for free, and its knights are rebuilt from the state
// each socket carries (serializeAttachment) when a message wakes it. The routing itself is room.js.
// ============================================================================

import { Room } from './room.js';
import { cleanName } from './filter.js';
import { makeHash, checkPassword, randomHex, sameString } from './auth.js';
import { json, oops, failFrom, readJson, bearer } from './http.js';

const SESSION_MS = 90 * 24 * 3600 * 1000;   // a token is good for 90 days
const SAVE_MAX = 512 * 1024;                // bytes; a slot is well under 100 KB
const SAVES_KEPT = 3;                       // versions per knight, so a broken save can be rolled back
const WRONG_TRIES = 5, LOCK_MS = 60000;     // five wrong secret words -> a minute's wait
const CHAT_KEPT = 20000;                    // lines; older ones are dropped now and then
const PASS_MIN = 4, PASS_MAX = 200;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  name_lc TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
  created INTEGER NOT NULL, last_seen INTEGER NOT NULL, banned INTEGER NOT NULL DEFAULT 0,
  tries INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, name_lc TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_by_name ON sessions (name_lc);
CREATE TABLE IF NOT EXISTS saves (name_lc TEXT NOT NULL, ver INTEGER NOT NULL, json TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (name_lc, ver));
CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export class World {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    for (const stmt of SCHEMA.split(';')) if (stmt.trim()) this.sql.exec(stmt);
    this.chatWrites = 0;
    this.wraps = new WeakMap();
    this.room = new Room({
      log: (name, text, at) => this.logChat(name, text, at),
      wake: ms => this.ctx.storage.setAlarm(Date.now() + ms).catch(e => console.error('alarm', e)),
    });
    // pings are answered by the runtime without waking the world (the client sends exactly this text)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    // waking up: every socket that survived the nap carries its knight's state
    for (const ws of ctx.getWebSockets()) {
      let state = null;
      try { state = ws.deserializeAttachment(); } catch (e) { }
      if (state && state.name) this.room.restore(this.wrap(ws), state);
      else { try { ws.close(4001, 'lost'); } catch (e) { } }
    }
  }

  // ---------- the socket, as the room sees it ----------
  wrap(ws) {
    let w = this.wraps.get(ws);
    if (!w) {
      w = {
        send: s => { try { ws.send(s); } catch (e) { } },
        close: (code, reason) => { try { ws.close(code, reason); } catch (e) { } },
        attach: state => { try { ws.serializeAttachment(state); } catch (e) { } },
      };
      this.wraps.set(ws, w);
    }
    return w;
  }
  webSocketMessage(ws, msg) { if (typeof msg === 'string') this.room.message(this.wrap(ws), msg); }
  webSocketClose(ws, code, reason) { this.room.leave(this.wrap(ws)); try { ws.close(1000, 'bye'); } catch (e) { } }
  webSocketError(ws) { this.room.leave(this.wrap(ws)); }
  alarm() { try { this.room.tick(); } catch (e) { console.error('tick', e); } }

  // ---------- HTTP ----------
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname, method = req.method;
    try {
      if (path === '/ws') return this.openSocket(req, url);
      if (path === '/api/status' && method === 'GET') return this.status();
      if (path.startsWith('/api/admin/')) return await this.admin(req, url, path.slice('/api/admin/'.length), method);
      if (path === '/api/signup' && method === 'POST') return await this.signup(req);
      if (path === '/api/login' && method === 'POST') return await this.login(req);
      if (path === '/api/logout' && method === 'POST') return this.logout(req);
      if (path === '/api/me' && method === 'GET') return this.me(req);
      if (path === '/api/save' && method === 'GET') return this.getSave(req);
      if (path === '/api/save' && method === 'PUT') return await this.putSave(req);
      throw oops(404, 'no such call', 'nope');
    } catch (e) {
      if (!(e && e.status)) console.error(path, e);
      return failFrom(e);
    }
  }

  now() { return Date.now(); }
  rows(q, ...args) { return this.sql.exec(q, ...args).toArray(); }
  row(q, ...args) { return this.rows(q, ...args)[0] || null; }

  // ---------- sessions ----------
  session(token) {
    if (!token) throw oops(401, 'please log in', 'auth');
    const s = this.row('SELECT s.token, s.expires, a.name_lc, a.name, a.banned, a.created FROM sessions s JOIN accounts a ON a.name_lc = s.name_lc WHERE s.token = ?', token);
    if (!s) throw oops(401, 'that login has run out, please log in again', 'auth');
    const now = this.now();
    if (s.expires < now) { this.sql.exec('DELETE FROM sessions WHERE token = ?', token); throw oops(401, 'that login has run out, please log in again', 'auth'); }
    if (s.banned) { this.sql.exec('DELETE FROM sessions WHERE name_lc = ?', s.name_lc); throw oops(403, 'this knight is banned', 'banned'); }
    this.sql.exec('UPDATE accounts SET last_seen = ? WHERE name_lc = ?', now, s.name_lc);
    return s;
  }
  auth(req) { return this.session(bearer(req)); }
  newSession(lc) {
    const token = randomHex(32);
    const now = this.now();
    this.sql.exec('DELETE FROM sessions WHERE name_lc = ? AND expires < ?', lc, now);
    this.sql.exec('INSERT INTO sessions (token, name_lc, expires) VALUES (?, ?, ?)', token, lc, now + SESSION_MS);
    return token;
  }

  // ---------- the invite code: seeded from the secret the first time, then kept in settings ----------
  invite() {
    const r = this.row("SELECT value FROM settings WHERE key = 'invite'");
    if (r) return r.value;
    const seed = (this.env.INVITE_CODE || '').trim();
    if (!seed) return null;
    this.sql.exec("INSERT INTO settings (key, value) VALUES ('invite', ?)", seed);
    return seed;
  }

  // ---------- accounts ----------
  async signup(req) {
    const b = await readJson(req);
    const name = cleanName(b.name);
    if (!name) throw oops(400, 'that name will not do: 2 to 16 letters, digits or spaces, and nothing rude', 'name');
    const pass = typeof b.pass === 'string' ? b.pass : '';
    if (pass.length < PASS_MIN || pass.length > PASS_MAX) throw oops(400, 'the secret word needs at least 4 letters', 'pass');
    const invite = this.invite();
    if (!invite) throw oops(403, 'no invite code is set on the world yet', 'invite');
    // typed by a ten-year-old: spaces around it and capital letters do not count against them
    if (String(b.invite || '').trim().toLowerCase() !== invite.toLowerCase()) throw oops(403, 'that invite code is wrong', 'invite');
    const lc = name.toLowerCase();
    if (this.row('SELECT 1 FROM accounts WHERE name_lc = ?', lc)) throw oops(409, 'that name is taken', 'taken');
    const { salt, hash } = await makeHash(pass);
    const now = this.now();
    this.sql.exec('INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen) VALUES (?, ?, ?, ?, ?, ?)', lc, name, salt, hash, now, now);
    return json({ token: this.newSession(lc), name });
  }

  async login(req) {
    const b = await readJson(req);
    const lc = String(b.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const pass = typeof b.pass === 'string' ? b.pass : '';
    const a = lc && this.row('SELECT * FROM accounts WHERE name_lc = ?', lc);
    if (!a) throw oops(401, 'no knight by that name', 'login');
    if (a.banned) throw oops(403, 'this knight is banned', 'banned');
    const now = this.now();
    if (a.locked_until > now) throw oops(429, 'too many tries: wait a minute and try again', 'wait', { wait: Math.ceil((a.locked_until - now) / 1000) });
    if (!(await checkPassword(pass, a.salt, a.hash))) {
      // a lock that has run out starts the count again
      const tries = (a.locked_until > 0 ? 0 : a.tries) + 1;
      if (tries >= WRONG_TRIES) {
        this.sql.exec('UPDATE accounts SET tries = 0, locked_until = ? WHERE name_lc = ?', now + LOCK_MS, lc);
        throw oops(429, 'too many tries: wait a minute and try again', 'wait', { wait: LOCK_MS / 1000 });
      }
      this.sql.exec('UPDATE accounts SET tries = ?, locked_until = 0 WHERE name_lc = ?', tries, lc);
      throw oops(401, 'wrong secret word', 'login', { left: WRONG_TRIES - tries });
    }
    this.sql.exec('UPDATE accounts SET tries = 0, locked_until = 0, last_seen = ? WHERE name_lc = ?', now, lc);
    return json({ token: this.newSession(lc), name: a.name });
  }

  logout(req) {
    const token = bearer(req);
    if (token) this.sql.exec('DELETE FROM sessions WHERE token = ?', token);
    return json({ ok: true });
  }

  me(req) {
    const s = this.auth(req);
    const save = this.row('SELECT at FROM saves WHERE name_lc = ? ORDER BY ver DESC LIMIT 1', s.name_lc);
    return json({ name: s.name, created: s.created, saveAt: save ? save.at : null, online: this.room.isOnline(s.name) });
  }

  // ---------- saves: the slot JSON string, verbatim, three versions deep ----------
  getSave(req) {
    const s = this.auth(req);
    const r = this.row('SELECT json, at FROM saves WHERE name_lc = ? ORDER BY ver DESC LIMIT 1', s.name_lc);
    return json({ save: r ? r.json : null, at: r ? r.at : null });
  }

  async putSave(req) {
    const s = this.auth(req);
    const text = await req.text();
    if (new TextEncoder().encode(text).length > SAVE_MAX) throw oops(413, 'that save is too big', 'big');
    let v = null;
    try { v = JSON.parse(text); } catch (e) { }
    if (!v || typeof v !== 'object') throw oops(400, 'that save is not JSON', 'bad');
    const ver = this.storeSave(s.name_lc, text);
    return json({ at: ver.at, ver: ver.ver });
  }

  storeSave(lc, text) {
    const last = this.row('SELECT MAX(ver) AS v FROM saves WHERE name_lc = ?', lc);
    const ver = ((last && last.v) || 0) + 1, at = this.now();
    this.sql.exec('INSERT INTO saves (name_lc, ver, json, at) VALUES (?, ?, ?, ?)', lc, ver, text, at);
    this.sql.exec('DELETE FROM saves WHERE name_lc = ? AND ver <= ?', lc, ver - SAVES_KEPT);
    return { ver, at };
  }

  // ---------- who is on (no login needed: the title screen shows it) ----------
  status() {
    const list = this.room.online();
    return json({ ok: true, online: list.length, names: list.map(k => k.n) });
  }

  // ---------- the chat log ----------
  logChat(name, text, at) {
    this.sql.exec('INSERT INTO chat (at, name, text) VALUES (?, ?, ?)', at, name, text);
    if (++this.chatWrites % 500 === 0) this.sql.exec('DELETE FROM chat WHERE id NOT IN (SELECT id FROM chat ORDER BY id DESC LIMIT ?)', CHAT_KEPT);
  }

  // ---------- the socket ----------
  openSocket(req, url) {
    if ((req.headers.get('upgrade') || '').toLowerCase() !== 'websocket') throw oops(426, 'this address is the game socket', 'ws');
    const s = this.session(url.searchParams.get('token') || '');   // a bad token is a 401 before any upgrade
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.room.join(this.wrap(server), s.name);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---------- admin: Authorization: Bearer <ADMIN_KEY> ----------
  async admin(req, url, call, method) {
    const key = this.env.ADMIN_KEY;
    if (!key) throw oops(503, 'no admin key is set on the world', 'admin');
    if (!sameString(bearer(req), key)) throw oops(401, 'wrong admin key', 'admin');
    const post = method === 'POST';
    if (call === 'accounts' && method === 'GET') {
      const list = this.rows('SELECT a.name, a.created, a.last_seen, a.banned, (SELECT MAX(at) FROM saves s WHERE s.name_lc = a.name_lc) AS save_at FROM accounts a ORDER BY a.name_lc');
      return json(list.map(a => ({ name: a.name, created: a.created, lastSeen: a.last_seen, banned: !!a.banned, saveAt: a.save_at })));
    }
    if (call === 'online' && method === 'GET') return json(this.room.online());
    if (call === 'chat' && method === 'GET') {
      const limit = Math.max(1, Math.min(5000, parseInt(url.searchParams.get('limit'), 10) || 500));
      const rows = this.rows('SELECT at, name, text FROM chat ORDER BY id DESC LIMIT ?', limit).reverse();
      return json(rows.map(r => ({ at: r.at, n: r.name, text: r.text })));
    }
    if (call === 'invite' && method === 'GET') return json({ invite: this.invite() });
    if (call === 'invite' && post) {
      const b = await readJson(req);
      const invite = String(b.invite || '').trim();
      if (invite.length < 4 || invite.length > 40) throw oops(400, 'the invite code needs 4 to 40 characters', 'bad');
      this.sql.exec("INSERT INTO settings (key, value) VALUES ('invite', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", invite);
      return json({ ok: true });
    }
    if (call === 'reset' && post) {
      const b = await readJson(req);
      const a = this.account(b.name);
      const pass = typeof b.pass === 'string' ? b.pass : '';
      if (pass.length < PASS_MIN || pass.length > PASS_MAX) throw oops(400, 'the secret word needs at least 4 letters', 'pass');
      const { salt, hash } = await makeHash(pass);
      this.sql.exec('UPDATE accounts SET salt = ?, hash = ?, tries = 0, locked_until = 0 WHERE name_lc = ?', salt, hash, a.name_lc);
      this.sql.exec('DELETE FROM sessions WHERE name_lc = ?', a.name_lc);
      this.room.kick(a.name, 'auth', 'your secret word was changed: log in again');
      return json({ ok: true });
    }
    if (call === 'ban' && post) {
      const b = await readJson(req);
      const a = this.account(b.name);
      const banned = b.banned ? 1 : 0;
      this.sql.exec('UPDATE accounts SET banned = ? WHERE name_lc = ?', banned, a.name_lc);
      if (banned) { this.sql.exec('DELETE FROM sessions WHERE name_lc = ?', a.name_lc); this.room.kick(a.name, 'banned', 'this knight is banned'); }
      return json({ ok: true });
    }
    if (call === 'saves' && method === 'GET') {
      const a = this.account(url.searchParams.get('name'));
      const rows = this.rows('SELECT ver, at, LENGTH(json) AS bytes FROM saves WHERE name_lc = ? ORDER BY ver DESC', a.name_lc);
      return json(rows.map(r => ({ ver: r.ver, at: r.at, bytes: r.bytes })));
    }
    if (call === 'rollback' && post) {
      // the old version is copied forward as a new one, so the history stays whole
      const b = await readJson(req);
      const a = this.account(b.name);
      const r = this.row('SELECT json FROM saves WHERE name_lc = ? AND ver = ?', a.name_lc, parseInt(b.ver, 10) || 0);
      if (!r) throw oops(404, 'no save with that version', 'nope');
      const ver = this.storeSave(a.name_lc, r.json);
      return json({ ok: true, ver: ver.ver, at: ver.at });
    }
    throw oops(404, 'no such admin call', 'nope');
  }

  account(name) {
    const a = this.row('SELECT name_lc, name FROM accounts WHERE name_lc = ?', String(name || '').replace(/\s+/g, ' ').trim().toLowerCase());
    if (!a) throw oops(404, 'no knight by that name', 'nope');
    return a;
  }
}
