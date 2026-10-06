// ============================================================================
// THE WORLD — the one Durable Object that holds the accounts, the saves, the chat log and the live room
// SQLite-backed (this.ctx.storage.sql). Every /api call and every /ws socket lands here, so the invite
// code, the sessions and the roster all live in one place with no races. The WebSockets use the
// Hibernation API: an idle world is put to sleep for free, and its knights are rebuilt from the state
// each socket carries (serializeAttachment) when a message wakes it. The routing itself is room.js.
//
// Error codes the title screen turns into one sentence (HTTP status is its fallback):
//   login   pass (wrong secret word, 401)  unknown (no such knight, 404)  wait (too many tries, 429)  banned (403)
//   signup  invite (401/403)  taken (409)  name (the filter refused it, 400)  pass (secret word under 4 chars, 400)
//           words (403, with until: a knight kept out for bad words last came from this place, so no new knight from it)
//   any     auth (dead or missing token, 401)  full (a cap hit: too big, or the world is full)
//           words (kept out for bad words, 403, with until = ms when they may come back: login, every /api call and /ws;
//           PUT /api/save alone still goes through, so the last push before the kick is never lost)
//   admins  admin (only an admin may, 403)  nopin (no pinned backup, 404)
// Finished trades are rows of the trades table (store.js), listed for the parent page at GET /api/admin/trades.
//   accounts (an admin's game, docs/ONLINE.md "Accounts")  unknown (no such knight, 404)  self (your own secret word:
//           the parent page does that, 403)  isadmin (another admin's, 403)  pass (under 4 or over 200, 400)
//           wait (too many resets in a minute, 429, with wait = seconds)
//   strikes and renames (docs/ONLINE.md, "Word strikes", "Renaming a knight"): the same unknown / self / isadmin / wait,
//           plus name (the new name will not do, 400) and taken (another knight has it, 409)
//
// The tables and the one migration live in store.js (SCHEMA, migrate): every wake runs the old CREATE TABLE
// statements unchanged, creates the new tables if they are missing, and adds the new accounts columns only when
// they are not there yet. Nothing is dropped, renamed or retyped. The Room reads and writes roles, mutes, bans,
// the mod log and drop parties through a SqlStore over the same SQLite.
// ============================================================================

import { Room, MUTE_SPANS, wordsText } from './room.js';
import { SCHEMA, migrate, SqlStore, ALWAYS, norm } from './store.js';
import { accountList, RESETS_PER_MINUTE, RESET_TEXT } from './accounts.js';
import { cryptoRandom } from './party.js';
import { cleanName } from './filter.js';
import { makeHash, checkPassword, randomHex, sameString } from './auth.js';
import { json, oops, failFrom, readJson, bearer } from './http.js';
import { backupCall } from './backup.js';
import { handoffCall, addressOf } from './handoff.js';
import { Meter, isAdminPath } from './meter.js';
import { readAtlas } from './atlas.js';
import { MoveBook, MOVE_MODES } from './move.js';
import { SimBook } from './sim/book.js';
import { SimHost, WORLDGEN_FREE } from './sim/host.js';
import { cleanSwitches, WORLD_MAPS, WORLD_READY, WORLD_EMPTY, MODES } from './sim/worlds.js';
import ATLAS_JSON from './atlas.json' with { type: 'json' };
import { migrateTeachers, TeacherBook, teacherCall, teacherAdminCall, teacherLogin } from './teachers.js';
import { Watch } from './watch.js';

// the Atlas the world judges by (docs/ONLINE.md, "The shared world", Stage 1): made by tools/atlas.mjs from the game it ships with
const ATLAS = readAtlas(ATLAS_JSON);

const SESSION_MS = 90 * 24 * 3600 * 1000;   // a token is good for 90 days
const SAVE_MAX = 512 * 1024;                // bytes; a slot is well under 100 KB
const SAVES_KEPT = 3;                       // versions per knight, so a broken save can be rolled back
const WRONG_TRIES = 5, LOCK_MS = 60000;     // five wrong secret words -> a minute's wait
const CHAT_KEPT = 20000;                    // lines; older ones are dropped now and then
const PASS_MIN = 4, PASS_MAX = 200;
// new accounts from one address (an IPv6 address by its /48) in an hour: a family or a party is under it; anyone
// with the invite code making dozens (each account brings its own hand-over and save budgets) is not. 429 `signups`
export const SIGNUPS_PER_HOUR = 10;
const PARENT = 'parent page';               // mod_log's "by" for everything done from /admin

export class World {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    for (const stmt of SCHEMA.split(';')) if (stmt.trim()) this.sql.exec(stmt);
    const migrated = migrate(this.sql);
    if (migrated.added.length) console.log('accounts gained ' + migrated.added.join(', ') + ' (columns read with ' + migrated.via + ')');
    this.store = new SqlStore(this.sql, typeof ctx.storage.transactionSync === 'function' ? (fn => ctx.storage.transactionSync(fn)) : null);
    // the place of a lockout that is over is not kept (docs/ONLINE.md, "Kept out")
    try { this.store.forgetPlaces(this.now()); } catch (e) { console.error('places', e); }
    this.meter = new Meter(this.sql, () => this.now());   // what the free plan counts, per UTC day (meter.js)
    this.moveBook = new MoveBook(this.sql, () => this.now());   // the movement check's counts and violations (move.js)
    this.simBook = new SimBook(this.sql, () => this.now());     // the shared world's map changes and boss rests (sim/book.js)
    this.chatWrites = 0;
    this.wraps = new WeakMap();
    // the teacher view (docs/ONLINE.md, "The teacher view"): its tables, and the Watch that keeps the teachers' screens
    migrateTeachers(this.sql);
    this.teachers = new TeacherBook(this.sql, () => this.now());
    this.watch = new Watch({ book: this.teachers, store: this.store, sql: this.sql, now: () => this.now(), atlas: ATLAS });
    this.room = new Room({
      hooks: this.watch.hooks,
      now: () => this.now(),
      log: (name, text, at, masked) => this.logChat(name, text, at, masked),
      wake: ms => this.ctx.storage.setAlarm(Date.now() + ms).catch(e => console.error('alarm', e)),
      store: this.store,
      random: cryptoRandom,
      atlas: ATLAS,
      moveBook: this.moveBook,
      simBook: this.simBook,
      simSave: sw => this.saveSim({ held: sw.held }),   // a map the watchdog handed back is held there (sim/worlds.js)
    });
    this.watch.room = this.room;
    this.room.setSim(this.simSettings());
    this.loadCopy();
    // pings are answered by the runtime without waking the world (the client sends exactly this text)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    // waking up: every socket that survived the nap carries its knight's state
    for (const ws of ctx.getWebSockets()) {
      let state = null;
      try { state = ws.deserializeAttachment(); } catch (e) { }
      if (state && state.w) this.watch.restore(this.wrap(ws), state);   // a teacher's screen: never a knight
      else if (state && state.name) this.room.restore(this.wrap(ws), state);
      else { try { ws.close(4001, 'lost'); } catch (e) { } }
    }
    // a login still open with no socket carrying it (the world was restarted under it) ends when it was last heard from
    try { this.room.settleLogins(); } catch (e) { console.error('logins', e); }
    // a teacher screen that was watching a kid's view before the nap: tapped again by name now that the knights are back,
    // or told the view ended (watch.js settle)
    try { this.watch.settle(); } catch (e) { console.error('watch', e); }
    // when the logins began to be counted: written once, on the first wake of this code
    this.loginsSince = this.store.trackingSince(this.now());
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
  // a teacher's screen goes to the Watch first: its frames never reach the Room
  webSocketMessage(ws, msg) { this.meter.ws(); const w = this.wrap(ws); if (this.watch.has(w)) return this.watch.message(w, msg); if (typeof msg === 'string') this.room.message(w, msg); }
  webSocketClose(ws, code, reason) { const w = this.wrap(ws); if (this.watch.has(w)) this.watch.leave(w); else this.room.leave(w); try { ws.close(1000, 'bye'); } catch (e) { } this.meter.flush(); this.moveBook.flush(); }
  webSocketError(ws) { const w = this.wrap(ws); if (this.watch.has(w)) this.watch.leave(w); else this.room.leave(w); this.meter.flush(); this.moveBook.flush(); }
  // Cloudflare bills every alarm invocation as a Durable Object request, so the meter counts it as one
  alarm() { this.meter.http(false); try { this.room.tick(); } catch (e) { console.error('tick', e); } this.meter.flush(); this.moveBook.flush(); }

  // ---------- the shared world's game copy (docs/ONLINE.md "The shared world", Stage 2) ----------
  // online/src/sim/game.mjs (built by build.sh, bundled by wrangler) is loaded on every wake; until it is there, or if it cannot
  // be, every map stays on the keeper path. The SimHost ticks with setTimeout (never alarms), timed by the lag of the next timer.
  // It gets no heap probe: workerd has none (no process, no performance.memory; checked 3 Oct 2026 on wrangler 4.92 local), so
  // the copy cap (the overworld plus 3 instances, measured at 59.4 MB of the 128 MB isolate) is what holds memory there.
  loadCopy() {
    import('./sim/game.mjs').then(mod => {
      if (!mod || typeof mod.makeGame !== 'function') throw new Error('the game copy has no makeGame');
      const host = new SimHost({
        makeGame: mod.makeGame, now: () => Date.now(), clock: () => Date.now(), timing: 'lag', worldGenFree: WORLDGEN_FREE,
        timer: { set: (f, ms) => setTimeout(f, ms), clear: h => clearTimeout(h) }, seed: (Math.random() * 4294967295) >>> 0,
        onFallback: (map, reason, row) => this.room.worlds.fell(map, reason, row),
        onSend: (map, list) => this.room.worlds.fromCopy(map, list),
        log: (name, info) => { if (name !== 'start' && name !== 'stop') console.log('sim ' + name + ' ' + JSON.stringify(info).slice(0, 400)); },
      });
      this.room.worlds.useHost(host);
    }).catch(e => {
      console.error('sim copy', e);
      this.room.worlds.noCopy();   // every map stays with a knight's game, and a keeper the wake picked silently is told
      for (const m of WORLD_READY) if (this.room.worlds.sw.maps[m] === 'world') this.simBook.log({ at: this.now(), map: m, from: 'world', to: 'keeper', reason: 'nocopy', tickP99: null });
    });
  }

  // ---------- the shared world's switches (settings key 'sim', JSON; docs/ONLINE.md "The shared world") ----------
  saveSim(part) {
    const s = Object.assign(this.simSettings(), part);
    this.sql.exec("INSERT INTO settings (key, value) VALUES ('sim', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", JSON.stringify(s));
    return s;
  }
  simSettings() {
    let s = {};
    try { const r = this.row("SELECT value FROM settings WHERE key = 'sim'"); if (r) s = JSON.parse(r.value) || {}; } catch (e) { s = {}; }
    if (!s || typeof s !== 'object' || Array.isArray(s)) s = {};
    return Object.assign({}, s, { move: MOVE_MODES.includes(s.move) ? s.move : 'observe' });
  }
  simView() {
    const ks = this.room.knightsView ? this.room.knightsView() : [];
    const sw = this.room.worlds.sw;
    return {
      meter: this.meter.view(),
      sim: { move: this.room.sim.move, master: sw.master, maps: Object.fromEntries(WORLD_READY.map(m => [m, sw.maps[m]])), held: sw.held },
      world: this.room.worlds.view(),
      atlas: ATLAS ? { hash: ATLAS.hash, places: ATLAS.places.length, fixed: ATLAS.fixedCount } : null,
      move: Object.assign({ mode: this.room.sim.move }, this.moveBook.view(), { knights: ks }),
    };
  }

  // ---------- HTTP ----------
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname, method = req.method;
    this.meter.http(isAdminPath(path));   // an /api/admin/* call is counted as the admin's too (meter.js)
    let res;
    try { res = await this.route(req, url, path, method); } catch (e) {
      if (!(e && e.status)) console.error(path, e);
      res = failFrom(e);
    }
    if (path !== '/ws') await drain(req);
    return res;
  }

  // Every /api call and the socket, by path and method.
  async route(req, url, path, method) {
    if (path === '/ws') return this.openSocket(req, url);
    // the teacher view's socket calls (round 2: on every game address, no door; the sign-in is /api/login, teachers.js)
    if (path.startsWith('/api/teacher/')) return await teacherCall(this, req, url, path, method);
    { const r = await handoffCall(this, req, url, path, method); if (r) return r; }   // two addresses: handoff.js
    if (path === '/api/status' && method === 'GET') return this.status();
    if (path.startsWith('/api/admin/')) return await this.admin(req, url, path.slice('/api/admin/'.length), method);
    if (path === '/api/signup' && method === 'POST') return await this.signup(req);
    if (path === '/api/login' && method === 'POST') return await this.login(req);
    if (path === '/api/logout' && method === 'POST') return this.logout(req);
    if (path === '/api/me' && method === 'GET') return this.me(req);
    if (path === '/api/save' && method === 'GET') return this.getSave(req);
    if (path === '/api/save' && method === 'PUT') return await this.putSave(req);
    if (path === '/api/save/pin' && method === 'GET') return this.getPin(req);
    if (path === '/api/save/pin' && method === 'POST') return await this.pinSave(req, url);
    if (path === '/api/save/restore' && method === 'POST') return this.restorePin(req);
    if (path === '/api/accounts' && method === 'GET') return this.accountsForAdmin(req);
    if (path === '/api/accounts/reset' && method === 'POST') return await this.resetForAdmin(req);
    if (path === '/api/accounts/strikes' && method === 'POST') return await this.clearStrikesForAdmin(req);
    if (path === '/api/accounts/rename' && method === 'POST') return await this.renameForAdmin(req);
    throw oops(404, 'no such call', 'nope');
  }

  now() { return Date.now(); }
  rows(q, ...args) { return this.sql.exec(q, ...args).toArray(); }
  row(q, ...args) { return this.rows(q, ...args)[0] || null; }

  // ---------- sessions ----------
  // opts.ip: where the call came from (kept on the account, so a knight kept out for bad words cannot make a new knight from
  // the same place: signup). opts.saving: PUT /api/save, which goes through while kept out (saving is not playing: the last
  // push before the third strike's kick must land, or the next login would load an older save).
  session(token, opts) {
    if (!token) throw oops(401, 'please log in', 'auth');
    const s = this.row('SELECT s.token, s.expires, a.name_lc, a.name, a.banned, a.created, a.role, a.words_locked_until, a.sent_off_until FROM sessions s JOIN accounts a ON a.name_lc = s.name_lc WHERE s.token = ?', token);
    if (!s) throw oops(401, 'that login has run out, please log in again', 'auth');
    const now = this.now();
    if (s.expires < now) { this.sql.exec('DELETE FROM sessions WHERE token = ?', token); throw oops(401, 'that login has run out, please log in again', 'auth'); }
    if (s.banned) { this.sql.exec('DELETE FROM sessions WHERE name_lc = ?', s.name_lc); throw oops(403, 'this knight is banned', 'banned'); }
    // kept out for bad words: the session is kept (it works again when the time is up), but nothing goes through until then
    // except a save. No address is written here: only the third strike notes one (Room.wordStrike, from the socket).
    // opts.socket (/ws): a send-off is said by the Room after the upgrade (kicked, why sentoff, close 4005), because a refused
    // upgrade reaches a game only as close 1006, and the game would try again every 15 s until midnight
    if (!(opts && opts.saving)) { this.refuseIfKeptOut(s.words_locked_until, now); if (!(opts && opts.socket)) this.refuseIfSentOff(s.sent_off_until, now); }
    this.sql.exec('UPDATE accounts SET last_seen = ? WHERE name_lc = ?', now, s.name_lc);
    return s;
  }
  auth(req, opts) { return this.session(bearer(req), opts); }
  refuseIfKeptOut(until, now) {
    until = Number(until) || 0;
    if (until > now) throw oops(403, wordsText(until, now), 'words', { until });
  }
  // sent off for the rest of the day by a teacher: 423 (not 403, so a game already open keeps its token), saving still works
  refuseIfSentOff(until, now) {
    until = Number(until) || 0;
    if (until > now) throw oops(423, 'a teacher sent this knight off for the rest of today', 'sentoff', { until });
  }
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
    // per address, counted only for accounts made, and only behind Cloudflare (which always says the address): a
    // window of an hour kept in memory (a restart forgets it, which only ever lets more through)
    const cfip = req.headers.get('cf-connecting-ip');
    const where = cfip ? addressOf(cfip) : null, now0 = this.now();
    const made = this.signups || (this.signups = new Map());
    if (where) {
      if (made.size > 5000) for (const [k, v] of made) if (now0 - v.start >= 3600000) made.delete(k);
      const r = made.get(where);
      if (r && now0 - r.start < 3600000 && r.n >= SIGNUPS_PER_HOUR) throw oops(429, 'too many new knights from here: wait a while', 'signups', { wait: Math.ceil((r.start + 3600000 - now0) / 1000) });
    }
    const b = await readJson(req);
    const name = cleanName(b.name);
    if (!name) throw oops(400, 'that name will not do: 2 to 16 letters, digits or spaces, and nothing rude', 'name');
    // a teacher's name (the teacher view): a knight called that would read as the teacher in chat
    if (this.teachers.nameClash(name)) throw oops(409, 'that name is taken', 'taken');
    const pass = typeof b.pass === 'string' ? b.pass : '';
    if (pass.length < PASS_MIN || pass.length > PASS_MAX) throw oops(400, 'the secret word needs at least 4 letters', 'pass');
    const invite = this.invite();
    if (!invite) throw oops(403, 'no invite code is set on the world yet', 'invite');
    // typed by a ten-year-old: spaces around it and capital letters do not count against them
    if (String(b.invite || '').trim().toLowerCase() !== invite.toLowerCase()) throw oops(403, 'that invite code is wrong', 'invite');
    // a knight kept out for bad words cannot skip the 24 hours with a new knight: not from the place it was sent out from
    const ip = ipOf(req), now = this.now();
    if (ip) {
      const k = this.row('SELECT MAX(words_locked_until) AS until FROM accounts WHERE last_ip = ? AND words_locked_until > ?', ip, now);
      if (k && k.until) throw oops(403, wordsText(k.until, now), 'words', { until: k.until });
    }
    const lc = name.toLowerCase();
    // a name an admin changed still logs in as the knight it became (login, renamedFrom), so it is never free for a new one
    if (this.row('SELECT 1 FROM accounts WHERE name_lc = ?', lc) || this.store.renamedFrom(lc)) throw oops(409, 'that name is taken', 'taken');
    if (where) {
      // counted here, with nothing waiting since the check, so signups at the same moment cannot all slip past it
      let r = made.get(where);
      if (!r || now0 - r.start >= 3600000) { r = { start: now0, n: 0 }; made.set(where, r); }
      if (r.n >= SIGNUPS_PER_HOUR) throw oops(429, 'too many new knights from here: wait a while', 'signups', { wait: Math.ceil((r.start + 3600000 - now0) / 1000) });
      r.n++;
    }
    const { salt, hash } = await makeHash(pass);
    this.sql.exec('INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen) VALUES (?, ?, ?, ?, ?, ?)', lc, name, salt, hash, now, now);
    return json({ token: this.newSession(lc), name });
  }

  async login(req) {
    const b = await readJson(req);
    let lc = String(b.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const pass = typeof b.pass === 'string' ? b.pass : '';
    let a = lc && this.row('SELECT * FROM accounts WHERE name_lc = ?', lc);
    // a knight an admin renamed may still type the old name: it logs in as the new one (the answer carries the new name)
    if (!a && lc) { const moved = this.store.renamedFrom(lc); if (moved) { lc = norm(moved); a = this.row('SELECT * FROM accounts WHERE name_lc = ?', lc); } }
    // no knight by that name (and none had it before a rename): a teacher's sign-in, but only for a card that can take a
    // teacher's answer (teacherOk: 1). An older cached card never sends it, so it is never handed a teacher token to keep.
    // Knight and teacher names never clash (nameClash / knightClash), so this order cannot be fooled.
    if (!a && b && b.teacherOk === 1) return json(await teacherLogin(this, { name: b.name, pass: b.pass, addr: addressOf(req.headers.get('cf-connecting-ip')) }));
    if (!a) throw oops(404, 'no knight by that name', 'unknown');
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
      throw oops(401, 'wrong secret word', 'pass', { left: WRONG_TRIES - tries });
    }
    this.sql.exec('UPDATE accounts SET tries = 0, locked_until = 0, last_seen = ? WHERE name_lc = ?', now, lc);
    // the right secret word, but kept out for bad words: said with the time it ends, and no session is made
    this.refuseIfKeptOut(a.words_locked_until, now);
    this.refuseIfSentOff(a.sent_off_until, now);
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
    return json({ name: s.name, created: s.created, saveAt: save ? save.at : null, online: this.room.isOnline(s.name), role: roleWord(s.role) });
  }

  // ---------- saves: the slot JSON string, verbatim, three versions deep ----------
  getSave(req) {
    const s = this.auth(req);
    const r = this.row('SELECT json, at FROM saves WHERE name_lc = ? ORDER BY ver DESC LIMIT 1', s.name_lc);
    return json({ save: r ? r.json : null, at: r ? r.at : null });
  }

  async putSave(req) {
    // goes through while kept out for bad words (session, opts.saving)
    const s = this.auth(req, { saving: true });
    const text = await this.saveBody(req);
    const ver = this.storeSave(s.name_lc, text);
    return json({ at: ver.at, ver: ver.ver });
  }

  // A save's body: at most SAVE_MAX bytes of JSON, kept as the exact string that came in.
  async saveBody(req) {
    const text = await req.text();
    if (new TextEncoder().encode(text).length > SAVE_MAX) throw oops(413, 'that save is too big', 'full');
    let v = null;
    try { v = JSON.parse(text); } catch (e) { }
    if (!v || typeof v !== 'object') throw oops(400, 'that save is not JSON', 'bad');
    return text;
  }

  storeSave(lc, text) {
    const last = this.row('SELECT MAX(ver) AS v FROM saves WHERE name_lc = ?', lc);
    const ver = ((last && last.v) || 0) + 1, at = this.now();
    this.sql.exec('INSERT INTO saves (name_lc, ver, json, at) VALUES (?, ?, ?, ?)', lc, ver, text, at);
    this.sql.exec('DELETE FROM saves WHERE name_lc = ? AND ver <= ?', lc, ver - SAVES_KEPT);
    return { ver, at };
  }

  // ---------- the pinned backup: an admin's own knight from before "Unlock everything" ----------
  // Not one of the three kept versions, so no amount of saving pushes it out. Only an admin may keep one (the
  // server reads accounts.role; anyone else gets 403 admin), and only of the session's own knight.
  adminSession(req) {
    const s = this.auth(req);
    if (roleWord(s.role) !== 'admin') throw oops(403, 'only an admin can do that', 'admin');
    return s;
  }
  getPin(req) {
    const s = this.adminSession(req);
    const r = this.row('SELECT at, LENGTH(json) AS bytes FROM save_pins WHERE name_lc = ?', s.name_lc);
    return json(r ? { at: r.at, bytes: r.bytes } : { at: null, bytes: 0 });
  }
  // A pin already there is kept (it is the knight from before the first unlock) unless ?replace=1.
  async pinSave(req, url) {
    const s = this.adminSession(req);
    const text = await this.saveBody(req);
    const old = this.row('SELECT at FROM save_pins WHERE name_lc = ?', s.name_lc);
    if (old && url.searchParams.get('replace') !== '1') return json({ at: old.at, pinned: false });
    const at = this.now();
    this.sql.exec('INSERT INTO save_pins (name_lc, json, at) VALUES (?, ?, ?) ON CONFLICT(name_lc) DO UPDATE SET json = excluded.json, at = excluded.at', s.name_lc, text, at);
    return json({ at, pinned: true });
  }
  // The pin becomes the current save (a new version, like a rollback) and is then removed.
  restorePin(req) {
    const s = this.adminSession(req);
    const pin = this.row('SELECT json FROM save_pins WHERE name_lc = ?', s.name_lc);
    if (!pin) throw oops(404, 'there is no backup to go back to', 'nopin');
    const ver = this.storeSave(s.name_lc, pin.json);
    this.sql.exec('DELETE FROM save_pins WHERE name_lc = ?', s.name_lc);
    return json({ save: pin.json, at: ver.at, ver: ver.ver });
  }

  // ---------- Accounts: every knight, on line or not, for an admin's game (docs/ONLINE.md, "Accounts") ----------
  // The caller's session must belong to a knight whose role is 'admin' in the database, checked on every call.
  accountsForAdmin(req) {
    this.adminSession(req);
    return json(this.accountsView());
  }
  accountsView() { return accountList({ sql: this.sql, store: this.store, room: this.room, now: this.now(), since: this.loginsSince }); }
  // A new secret word for a knight, from an admin's game: never your own (the parent page does that), never another
  // admin's; at most RESETS_PER_MINUTE a minute per admin. The word itself is never logged.
  async resetForAdmin(req) {
    const s = this.adminSession(req);
    const b = await readJson(req);
    const pass = typeof b.pass === 'string' ? b.pass : '';
    const target = this.store.account(typeof b.name === 'string' ? b.name : '');
    if (!target) throw oops(404, 'no knight by that name', 'unknown');
    if (target.lc === s.name_lc) throw oops(403, 'change your own secret word on the parent page', 'self');
    if (target.role === 'admin') throw oops(403, "you can't change another admin's secret word", 'isadmin');
    if (pass.length < PASS_MIN || pass.length > PASS_MAX) throw oops(400, 'the secret word needs at least 4 letters', 'pass');
    const now = this.now();
    if (this.store.actsSince(s.name, 'reset', now - 60000) >= RESETS_PER_MINUTE) throw oops(429, 'too many at once: wait a minute', 'wait', { wait: 60 });
    await this.newSecret(target, pass, s.name, now);
    return json({ ok: true, name: target.name });
  }
  // Clears a knight's word strikes and any lockout, from an admin's game: never your own, at most RESETS_PER_MINUTE a minute.
  async clearStrikesForAdmin(req) {
    const s = this.adminSession(req);
    const b = await readJson(req);
    const target = this.store.account(typeof b.name === 'string' ? b.name : '');
    if (!target) throw oops(404, 'no knight by that name', 'unknown');
    if (target.lc === s.name_lc) throw oops(403, 'ask the parent page to clear your own', 'self');
    const now = this.now();
    if (this.store.actsSince(s.name, 'strikes_clear', now - 60000) >= RESETS_PER_MINUTE) throw oops(429, 'too many at once: wait a minute', 'wait', { wait: 60 });
    this.clearStrikes(target, s.name, now);
    return json({ ok: true, name: target.name });
  }
  clearStrikes(target, by, now) {
    const was = this.store.wordStrikes(target.lc, now);
    this.store.clearWordStrikes(target.lc);
    this.store.log({ at: now, by, act: 'strikes_clear', target: target.name, detail: was ? String(was.strikes) + (was.lockedUntil > now ? ', was kept out' : '') : '' });
  }
  // A new name for a knight, from an admin's game: never your own, never another admin's; the filter's rules for a name.
  async renameForAdmin(req) {
    const s = this.adminSession(req);
    const b = await readJson(req);
    const target = this.store.account(typeof b.name === 'string' ? b.name : '');
    if (!target) throw oops(404, 'no knight by that name', 'unknown');
    if (target.lc === s.name_lc) throw oops(403, 'change your own name on the parent page', 'self');
    if (target.role === 'admin') throw oops(403, "you can't change another admin's name", 'isadmin');
    const now = this.now();
    if (this.store.actsSince(s.name, 'rename', now - 60000) >= RESETS_PER_MINUTE) throw oops(429, 'too many at once: wait a minute', 'wait', { wait: 60 });
    const to = this.renameKnight(target, b.to, s.name, now);
    return json({ ok: true, from: target.name, name: to });
  }
  // The one way a name changes (the parent page and an admin's game both come here): checked like a new knight's name,
  // rewritten everywhere it is kept (store.js rename), the knight sent out to come straight back as the new name if on line,
  // one line in mod_log with the old name in its detail (so a login with the old name finds the knight). Answers the new name.
  renameKnight(target, wanted, by, now) {
    const to = cleanName(typeof wanted === 'string' ? wanted : '');
    if (!to) throw oops(400, 'that name will not do: 2 to 16 letters, digits or spaces, and nothing rude', 'name');
    const lc = to.toLowerCase();
    if (lc !== target.lc && this.row('SELECT 1 FROM accounts WHERE name_lc = ?', lc)) throw oops(409, 'that name is taken', 'taken');
    if (this.teachers.nameClash(to)) throw oops(409, 'that name is taken', 'taken');   // a teacher's name (the teacher view)
    // another knight's old name is taken too (it logs in as that knight); a knight may go back to one of its own
    const was = lc !== target.lc && this.store.renamedFrom(lc);
    if (was && norm(was) !== target.lc) throw oops(409, 'that name is taken', 'taken');
    if (to === target.name) return to;
    this.store.rename(target.lc, to);
    this.store.log({ at: now, by, act: 'rename', target: to, detail: target.name });
    this.room.renamed(target.name, to);
    return to;
  }

  // The one way a secret word changes (the parent page and an admin's game both come here): hashed with a new salt,
  // every session of that knight deleted, the knight sent back to the login card if on line, one line in mod_log.
  async newSecret(target, pass, by, now) {
    const { salt, hash } = await makeHash(pass);
    this.store.setSecret(target.lc, salt, hash);
    this.room.kick(target.name, 'auth', RESET_TEXT, { why: 'reset' });
    this.store.log({ at: now, by, act: 'reset', target: target.name, detail: '' });
  }

  // ---------- who is on (no login needed: the title screen shows it) ----------
  status() {
    const list = this.room.online();
    return json({ ok: true, online: list.length, names: list.map(k => k.n) });
  }

  // ---------- the chat log ----------
  // masked: the word filter starred something in it; its id goes in chat_masked (teachers.js) so the teacher view flags it
  logChat(name, text, at, masked) {
    this.sql.exec('INSERT INTO chat (at, name, text) VALUES (?, ?, ?)', at, name, text);
    if (masked) this.sql.exec('INSERT OR IGNORE INTO chat_masked (id) SELECT MAX(id) FROM chat');
    if (++this.chatWrites % 500 === 0) { this.sql.exec('DELETE FROM chat WHERE id NOT IN (SELECT id FROM chat ORDER BY id DESC LIMIT ?)', CHAT_KEPT); this.sql.exec('DELETE FROM chat_masked WHERE id < (SELECT MIN(id) FROM chat)'); }
  }

  // ---------- the socket ----------
  openSocket(req, url) {
    if ((req.headers.get('upgrade') || '').toLowerCase() !== 'websocket') throw oops(426, 'this address is the game socket', 'ws');
    // a bad token is a 401 before any upgrade; a knight sent off for the day is let through to the Room, which says so and closes 4005
    const s = this.session(url.searchParams.get('token') || '', { socket: true });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    // the socket's place rides with the knight (never written down) so a third strike can note where it was sent out from
    this.room.join(this.wrap(server), s.name, { ip: ipOf(req) });
    return this.upgraded(client);
  }
  // the 101 that hands the socket over (a seam for the Node tests, whose Response cannot carry a 101)
  upgraded(client) { return new Response(null, { status: 101, webSocket: client }); }

  // ---------- admin: Authorization: Bearer <ADMIN_KEY> ----------
  async admin(req, url, call, method) {
    const key = this.env.ADMIN_KEY;
    if (!key) throw oops(503, 'no admin key is set on the world', 'admin');
    if (!sameString(bearer(req), key)) throw oops(401, 'wrong admin key', 'admin');
    const post = method === 'POST';
    { const r = await backupCall(this, req, url, call, method); if (r) return r; }
    { const r = await teacherAdminCall(this, req, url, call, method); if (r) return r; }   // Teachers (teachers.js)
    if (call === 'accounts' && method === 'GET') return json(this.accountsView());
    if (call === 'sim' && method === 'GET') return json(this.simView());   // the shared world: the meter, the Atlas, the movement check
    if (call === 'sim' && post) {
      // any of {move, master, maps}: the movement check (Stage 1), and which maps the world runs itself (Stage 2)
      const b = await readJson(req);
      const bad = () => oops(400, "send any of {move: 'observe' | 'off', master: 'on' | 'off', maps: {deepholm | aerie: 'keeper' | 'world'}}", 'bad');
      if (!b || typeof b !== 'object' || Array.isArray(b) || !Object.keys(b).length || Object.keys(b).some(k => !['move', 'master', 'maps'].includes(k))) throw bad();
      if ('move' in b && !MOVE_MODES.includes(b.move)) throw bad();
      if ('master' in b && b.master !== 'on' && b.master !== 'off') throw bad();
      if ('maps' in b) {
        if (!b.maps || typeof b.maps !== 'object' || Array.isArray(b.maps) || !Object.keys(b.maps).length) throw bad();
        for (const [m, v] of Object.entries(b.maps)) {
          if (!WORLD_MAPS.includes(m) || !MODES.includes(v)) throw bad();
          if (v === 'world' && WORLD_EMPTY.includes(m)) throw oops(400, 'no monsters live in ' + m + ', so the world has nothing to run there', 'empty');
          if (v === 'world' && !WORLD_READY.includes(m)) throw oops(400, "the world runs only deepholm and aerie in this stage; that map's monsters move later", 'later');
        }
      }
      const s = this.simSettings(), sw = cleanSwitches(s);
      const maps = Object.fromEntries(WORLD_READY.map(m => [m, (b.maps && b.maps[m]) || sw.maps[m]]));
      const next = Object.assign({}, s, { master: 'master' in b ? b.master : sw.master, maps, held: Object.assign({}, sw.held) });
      if ('move' in b) next.move = b.move;
      for (const m of Object.keys(b.maps || {})) delete next.held[m];   // a flip clears that map's hold
      this.sql.exec("INSERT INTO settings (key, value) VALUES ('sim', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", JSON.stringify(next));
      this.room.setSim(next, 'parent page');
      return json(this.simView());
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
      // the parent page may change anyone's secret word, an admin's and its own knight's too
      const b = await readJson(req);
      const a = this.account(b.name);
      const pass = typeof b.pass === 'string' ? b.pass : '';
      if (pass.length < PASS_MIN || pass.length > PASS_MAX) throw oops(400, 'the secret word needs at least 4 letters', 'pass');
      await this.newSecret({ lc: a.name_lc, name: a.name }, pass, PARENT, this.now());
      return json({ ok: true });
    }
    if (call === 'ban' && post) {
      const b = await readJson(req);
      const a = this.account(b.name);
      const banned = !!b.banned;
      this.store.setBanned(a.name_lc, banned);   // banning drops every session of theirs too
      this.store.log({ at: this.now(), by: PARENT, act: banned ? 'ban' : 'unban', target: a.name, detail: '' });
      if (banned) this.room.kick(a.name, 'banned', 'this knight is banned');
      return json({ ok: true });
    }
    if (call === 'strikes' && post) {
      // clear a knight's word strikes and any lockout (an admin's too, its own knight's too)
      const b = await readJson(req);
      const a = this.store.account(typeof b.name === 'string' ? b.name : '');
      if (!a) throw oops(404, 'no knight by that name', 'nope');
      this.clearStrikes(a, PARENT, this.now());
      return json({ ok: true, name: a.name });
    }
    if (call === 'rename' && post) {
      // a new name for any knight, an admin's too
      const b = await readJson(req);
      const a = this.store.account(typeof b.name === 'string' ? b.name : '');
      if (!a) throw oops(404, 'no knight by that name', 'nope');
      const to = this.renameKnight(a, b.to, PARENT, this.now());
      return json({ ok: true, from: a.name, name: to });
    }
    if (call === 'role' && post) {
      const b = await readJson(req);
      if (b.role !== 'player' && b.role !== 'admin') throw oops(400, 'the role must be player or admin', 'bad');
      const a = this.account(b.name);
      this.store.setRole(a.name_lc, b.role);
      this.store.log({ at: this.now(), by: PARENT, act: 'role', target: a.name, detail: b.role });
      this.room.setRole(a.name);   // an online knight hears it at once, and so does everyone's roster
      return json({ ok: true, role: b.role });
    }
    if (call === 'mute' && post) {
      // works on admins too: the parent page can do what nobody in the game can
      const b = await readJson(req);
      const span = b.span;
      if (span !== 'off' && !Object.prototype.hasOwnProperty.call(MUTE_SPANS, span)) throw oops(400, 'the span must be 5m, 1h, 1d, always or off', 'bad');
      const a = this.account(b.name);
      const now = this.now();
      const until = span === 'off' ? 0 : span === 'always' ? ALWAYS : now + MUTE_SPANS[span];
      this.store.setMute(a.name_lc, until);
      this.store.log({ at: now, by: PARENT, act: span === 'off' ? 'unmute' : 'mute', target: a.name, detail: span === 'off' ? '' : span });
      this.room.muteChanged(a.name);
      return json({ ok: true, mutedUntil: until });
    }
    if (call === 'modlog' && method === 'GET') {
      const limit = Math.max(1, Math.min(2000, parseInt(url.searchParams.get('limit'), 10) || 200));
      return json(this.store.modLog(limit).map(r => ({ at: r.at, by: r.by, act: r.act, n: r.target, detail: r.detail })));
    }
    if (call === 'trades' && method === 'GET') {
      // every finished trade, newest first: who, and exactly what each knight gave (docs/ONLINE.md, "Trading")
      const limit = Math.max(1, Math.min(2000, parseInt(url.searchParams.get('limit'), 10) || 200));
      return json(this.store.tradeLog(limit).map(r => ({ at: r.at, a: r.a, b: r.b, aGave: r.aGave, bGave: r.bGave })));
    }
    if (call === 'saves' && method === 'GET') {
      const a = this.account(url.searchParams.get('name'));
      const rows = this.rows('SELECT ver, at, LENGTH(json) AS bytes FROM saves WHERE name_lc = ? ORDER BY ver DESC', a.name_lc);
      const list = rows.map(r => ({ ver: r.ver, at: r.at, bytes: r.bytes }));
      // an admin's pinned backup (from before Unlock everything) comes first
      const pin = this.row('SELECT at, LENGTH(json) AS bytes FROM save_pins WHERE name_lc = ?', a.name_lc);
      if (pin) list.unshift({ ver: 'pin', at: pin.at, bytes: pin.bytes });
      return json(list);
    }
    if (call === 'rollback' && post) {
      // the old version (or the pinned backup) is copied forward as a new one, so the history stays whole;
      // a pin rolled back to is kept, so it can be used again
      const b = await readJson(req);
      const a = this.account(b.name);
      const pinned = b.ver === 'pin';
      const r = pinned ? this.row('SELECT json FROM save_pins WHERE name_lc = ?', a.name_lc) : this.row('SELECT json FROM saves WHERE name_lc = ? AND ver = ?', a.name_lc, parseInt(b.ver, 10) || 0);
      if (!r) throw pinned ? oops(404, 'there is no pinned backup', 'nopin') : oops(404, 'no save with that version', 'nope');
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

const roleWord = role => role === 'admin' ? 'admin' : 'player';
// where a call came from, as Cloudflare says it ('' when it does not: a local test world)
const ipOf = req => String((req && req.headers && req.headers.get('cf-connecting-ip')) || '').trim().slice(0, 64);

// A body nobody read (a refused token, a wrong admin key, a player asking for an admin's pin) is read to the end, and
// thrown away as it comes, before the answer goes back. Otherwise the runtime is still pumping it in from the Worker
// after the answer and logs an uncaught "Can't read from request stream after response has been sent" (seen under
// wrangler dev, 2026-09-25: reading it stops that, cancelling the stream does not). Chunks are not kept, so a huge
// body costs no memory; past DRAIN_MAX (far bigger than any honest request) the rest is cancelled.
const DRAIN_MAX = 1024 * 1024;
async function drain(req) {
  if (!req.body || req.bodyUsed) return;
  try {
    const reader = req.body.getReader();
    for (let n = 0; ;) {
      const { done, value } = await reader.read();
      if (done) return;
      n += value ? value.byteLength : 0;
      if (n > DRAIN_MAX) { await reader.cancel(); return; }
    }
  } catch (e) { }
}
