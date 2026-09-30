// Accounts (docs/ONLINE.md, "Accounts"): every login recorded and closed in every way, the totals, the admin's own
// routes (GET /api/accounts, POST /api/accounts/reset) with their refusals, the parent page's rows, and the migration
// from the live (admin-era) schema. The Room with a MemoryStore for the login rules; the whole World on node's SQLite
// (standing in for the Durable Object's) for the routes, with fake sockets and a clock the test moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Room, ROSTER_EVERY, SEEN_EVERY, KICK_TEXT } from '../src/room.js';
import { MemoryStore, SqlStore, SCHEMA, migrate, LOGINS_KEPT } from '../src/store.js';
import { makeHash, checkPassword } from '../src/auth.js';
import { LOGINS_SHOWN, RESETS_PER_MINUTE, RESET_TEXT, playSecondsOf } from '../src/accounts.js';

// ---------------------------------------------------------------------------
// the Room, a MemoryStore and a fake clock (the shape of admin.test.mjs's world)
// ---------------------------------------------------------------------------
function world(store, t0 = 1000) {
  const w = { t: t0 };
  w.store = store || new MemoryStore();
  w.room = new Room({ now: () => w.t, wake: () => { }, store: w.store });
  w.sock = () => {
    const s = { got: [], closed: null, state: null, send(str) { s.got.push(JSON.parse(str)); }, close(code, reason) { s.closed = { code, reason }; }, attach(st) { s.state = JSON.parse(JSON.stringify(st)); } };
    s.last = t => s.got.filter(m => m.t === t).pop();
    return s;
  };
  w.knight = name => { const s = w.sock(); w.room.join(s, name); w.room.message(s, JSON.stringify({ t: 'hello', v: 1 })); return s; };
  w.say = (s, m) => w.room.message(s, JSON.stringify(m));
  return w;
}
const rowsOf = (store, name) => store.logins(name, 100).map(r => [r.started, r.ended]);

test('a login is a row from join to close: a plain close, then the total is its length', () => {
  const w = world(); w.store.addAccount('Sam');
  const s = w.knight('Sam');
  assert.deepEqual(rowsOf(w.store, 'Sam'), [[1000, null]]);
  assert.equal(typeof s.state.loginId, 'number');   // the id rides the attachment
  w.t += 90000; w.room.leave(s);
  assert.deepEqual(rowsOf(w.store, 'Sam'), [[1000, 91000]]);
  assert.equal(w.store.onlineMs('Sam'), 90000);
  w.room.leave(s);   // a second close changes nothing
  assert.equal(w.store.onlineMs('Sam'), 90000);
  const s2 = w.knight('Sam'); w.t += 5000; w.room.leave(s2);
  assert.deepEqual(rowsOf(w.store, 'Sam'), [[91000, 96000], [1000, 91000]]);
  assert.equal(w.store.onlineMs('Sam'), 95000);
});

test('every other way out closes the login too: elsewhere, kick, ban, a new secret word, too fast', () => {
  const w = world(); for (const n of ['MudGoll', 'Sam', 'Ada', 'Bo', 'Cy']) w.store.addAccount(n, n === 'MudGoll' ? 'admin' : 'player');
  const mud = w.knight('MudGoll');
  // the same knight logs in on another device: the old socket's row ends, a new one starts
  const sam1 = w.knight('Sam'); w.t += 1000;
  const sam2 = w.knight('Sam');
  assert.equal(sam1.closed.code, 4000);
  assert.deepEqual(rowsOf(w.store, 'Sam'), [[2000, null], [1000, 2000]]);
  // kicked and banned from the game by the admin
  const ada = w.knight('Ada'), bo = w.knight('Bo'); w.t += 3000;
  w.say(mud, { t: 'kick', n: 'Ada' }); w.t += 1100; w.say(mud, { t: 'ban', n: 'Bo' });
  assert.equal(ada.closed.code, 4005); assert.equal(bo.closed.code, 4003);
  assert.deepEqual(rowsOf(w.store, 'Ada'), [[2000, 5000]]);
  assert.deepEqual(rowsOf(w.store, 'Bo'), [[2000, 6100]]);
  // a new secret word (the World kicks with code auth)
  w.t += 900; w.room.kick('Sam', 'auth', RESET_TEXT, { why: 'reset' });
  assert.deepEqual(sam2.last('error'), { t: 'error', code: 'auth', text: RESET_TEXT, why: 'reset' });
  assert.equal(sam2.closed.code, 4000);
  assert.deepEqual(rowsOf(w.store, 'Sam'), [[2000, 7000], [1000, 2000]]);
  // over the rate cap, dropped for it
  const cy = w.knight('Cy'); w.t += 500;
  for (let i = 0; i < 80 && !cy.closed; i++) w.say(cy, { t: 'chat', text: 'hi' + i });
  assert.equal(cy.closed.code, 4008);
  assert.deepEqual(rowsOf(w.store, 'Cy'), [[7000, 7500]]);
  // a refused join (banned, full) never opens a row
  const bo2 = w.sock(); w.room.join(bo2, 'Bo');
  assert.equal(bo2.closed.code, 4003);
  assert.equal(rowsOf(w.store, 'Bo').length, 1);
});

test('a nap keeps the open login; a socket that is gone after the wake ends when it was last heard from', () => {
  const store = new MemoryStore(); store.addAccount('Sam'); store.addAccount('Ada'); store.addAccount('Old');
  const w = world(store);
  const sam = w.knight('Sam'), ada = w.knight('Ada');
  w.t += SEEN_EVERY + 1; w.say(sam, { t: 'p', map: 'over', x: 1, y: 1 }); w.say(ada, { t: 'p', map: 'over', x: 2, y: 2 });
  const heard = w.t;
  w.t += 20000; w.say(sam, { t: 'p', map: 'over', x: 3, y: 3 });   // under a minute since the last write: not written again
  assert.equal(store.logins('Sam', 1)[0].seen, heard);
  // the world sleeps; it wakes with Sam's socket still there and Ada's gone (the runtime lost it), plus a socket from
  // before logins were kept (no loginId in its state)
  w.t += 100000;
  const w2 = world(store, w.t);
  const sam2 = w2.sock(); w2.room.restore(sam2, sam.state);
  const old = w2.sock(); w2.room.restore(old, { name: 'Old', since: w.t - 30000, hello: true, map: 'over', mapAt: w.t - 30000 });
  assert.equal(w2.room.settleLogins(), 1);
  assert.deepEqual(rowsOf(store, 'Sam'), [[1000, null]]);
  assert.deepEqual(rowsOf(store, 'Ada'), [[1000, heard]]);   // ended at the last time it was heard from
  assert.equal(store.onlineMs('Ada'), heard - 1000);
  assert.deepEqual(rowsOf(store, 'Old'), [[w.t - 30000, null]]);
  assert.equal(w2.room.settleLogins(), 0);   // settling twice changes nothing
  // Sam's open row closes normally on the new Room
  w2.t += 1000; w2.room.leave(sam2);
  assert.deepEqual(rowsOf(store, 'Sam'), [[1000, w2.t]]);
  assert.equal(store.onlineMs('Sam'), w2.t - 1000);
  assert.deepEqual(w2.room.loginOf('Old').started, w.t - 30000);
  assert.equal(w2.room.loginOf('Sam'), null);
});

test('only the newest 50 logins are kept per knight, and the total still counts every one', () => {
  const w = world(); w.store.addAccount('Sam'); w.store.addAccount('Ada');
  let total = 0;
  for (let i = 0; i < LOGINS_KEPT + 7; i++) { const s = w.knight('Sam'); w.t += 1000 + i; total += 1000 + i; w.room.leave(s); w.t += 10; }
  const a = w.knight('Ada'); w.room.leave(a);
  assert.equal(w.store.logins('Sam', 1000).length, LOGINS_KEPT);
  assert.equal(w.store.logins('Ada', 1000).length, 1);
  assert.equal(w.store.onlineMs('Sam'), total);
});

// ---------------------------------------------------------------------------
// SqlStore answers the login calls exactly as MemoryStore does
// ---------------------------------------------------------------------------
function sqlOf(db) {
  return {
    exec(q, ...args) {
      const stmt = db.prepare(q);
      const columnNames = stmt.columns().map(c => c.name);
      let rows = [], rowsWritten = 0;
      if (columnNames.length) rows = stmt.all(...args).map(r => Object.assign({}, r));
      else rowsWritten = stmt.run(...args).changes;
      return { toArray: () => rows.slice(), one: () => rows[0], rowsWritten, columnNames, [Symbol.iterator]: () => rows[Symbol.iterator]() };
    },
  };
}
const wake = sql => { for (const stmt of SCHEMA.split(';')) if (stmt.trim()) sql.exec(stmt); return migrate(sql); };

test('SqlStore and MemoryStore give the same logins, totals and tracking date for the same calls', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db); wake(sql);
  for (const n of ['sam', 'ada']) sql.exec('INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen) VALUES (?, ?, ?, ?, ?, ?)', n, n, 's', 'h', 1, 1);
  const mem = new MemoryStore(); mem.addAccount('sam'); mem.addAccount('ada');
  const script = st => {
    const out = [st.trackingSince(500), st.trackingSince(900)];
    const ids = [];
    for (let i = 0; i < 55; i++) { const id = st.loginStart(i % 3 ? 'sam' : 'ada', 1000 + i * 100); ids.push(id); st.loginSeen(id, 1050 + i * 100); if (i % 5) out.push(st.loginEnd(id, 1080 + i * 100)); }
    out.push(st.loginEnd(ids[1], 99999));   // already closed
    out.push(st.closeStaleLogins(new Set([ids[5]]), 1e6));
    out.push(st.logins('sam', 100), st.logins('ada', 3), st.onlineMs('sam'), st.onlineMs('ADA'), st.onlineMs('nobody'));
    out.push(st.actsSince('MudGoll', 'reset', 0));
    return out;
  };
  const a = script(new SqlStore(sql)), b = script(mem);
  assert.deepEqual(a, b);
  assert.equal(a[0], 500); assert.equal(a[1], 500);
  assert.equal(new SqlStore(sql).logins('sam', 100).length, 36);   // i % 3 of 0..54: under the 50 kept
});

// ---------------------------------------------------------------------------
// The World on node's SQLite
// ---------------------------------------------------------------------------
// the Cloudflare globals the World touches, as small fakes
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const fakeWs = () => {
  const s = { got: [], closed: null, att: null, send(str) { s.got.push(JSON.parse(str)); }, close(code, reason) { if (!s.closed) s.closed = { code, reason }; }, serializeAttachment(st) { s.att = JSON.parse(JSON.stringify(st)); }, deserializeAttachment() { return s.att; } };
  s.last = t => s.got.filter(m => m.t === t).pop();
  return s;
};
globalThis.WebSocketPair = class { constructor() { this[0] = fakeWs(); this[1] = fakeWs(); } };
const { World } = await import('../src/world.js');

let T = 1758800000000;   // the test's clock (ms), shared by the World and its Room
class TestWorld extends World {
  now() { return T; }
  upgraded(client) { return { status: 101, client }; }
}
function makeCtx(db) {
  const sockets = [];
  return {
    storage: { sql: sqlOf(db || new DatabaseSync(':memory:')), setAlarm: async () => { } },
    setWebSocketAutoResponse() { }, acceptWebSocket(ws) { sockets.push(ws); }, getWebSockets: () => sockets.filter(s => !s.closed), sockets,
  };
}
const ENV = { ADMIN_KEY: 'test-admin', INVITE_CODE: 'TEST-1234' };
async function call(w, method, path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await w.fetch(new Request('http://world' + path, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }));
  let data = null; try { data = await res.json(); } catch (e) { }
  return { status: res.status, data };
}
const parent = (w, method, path, body) => call(w, method, path, body, ENV.ADMIN_KEY);
async function signup(w, name, pass = 'sword') { const r = await call(w, 'POST', '/api/signup', { name, pass, invite: 'TEST-1234' }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.token; }
// the socket the way /ws opens it, then hello
async function online(w, token, map = 'over') {
  const r = await w.fetch(new Request('http://world/ws?token=' + token, { headers: { upgrade: 'websocket' } }));
  assert.equal(r.status, 101);
  const server = w.ctx.sockets[w.ctx.sockets.length - 1];
  w.webSocketMessage(server, JSON.stringify({ t: 'hello', v: 1 }));
  if (map) w.webSocketMessage(server, JSON.stringify({ t: 'p', map, region: map === 'over' ? 'Thistledown' : 'Spider Den', x: 480, y: 480, lv: 12 }));
  return server;
}
const saveOf = seconds => JSON.stringify({ player: { playSeconds: seconds, skills: {} }, quest: { stage: 3 } });

async function fourKnights() {
  const ctx = makeCtx(); T = 1758800000000;
  const w = new TestWorld(ctx, ENV);
  const tok = {};
  for (const n of ['MudGoll', 'Ada', 'Sam', 'Pip']) { tok[n] = await signup(w, n); T += 1000; }
  for (const n of ['MudGoll', 'Ada']) assert.equal((await parent(w, 'POST', '/api/admin/role', { name: n, role: 'admin' })).status, 200);
  return { ctx, w, tok };
}

test('GET /api/accounts: refused without a session, with a dead one, and for a player; an admin gets every account', async () => {
  const { w, tok } = await fourKnights();
  let r = await call(w, 'GET', '/api/accounts');
  assert.deepEqual([r.status, r.data.code], [401, 'auth']);
  r = await call(w, 'GET', '/api/accounts', undefined, 'f'.repeat(64));
  assert.deepEqual([r.status, r.data.code], [401, 'auth']);
  r = await call(w, 'GET', '/api/accounts', undefined, tok.Sam);
  assert.deepEqual([r.status, r.data.code], [403, 'admin']);
  r = await call(w, 'POST', '/api/accounts/reset', { name: 'Pip', pass: 'newword' }, tok.Sam);
  assert.deepEqual([r.status, r.data.code], [403, 'admin']);
  // the role is read from the database on every call: demoted, refused at once
  await parent(w, 'POST', '/api/admin/role', { name: 'Ada', role: 'player' });
  r = await call(w, 'GET', '/api/accounts', undefined, tok.Ada);
  assert.deepEqual([r.status, r.data.code], [403, 'admin']);
  r = await call(w, 'GET', '/api/accounts', undefined, tok.MudGoll);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.map(a => a.name), ['Ada', 'MudGoll', 'Pip', 'Sam']);
  // the parent page's rows are the same list
  const p = await parent(w, 'GET', '/api/admin/accounts');
  assert.deepEqual(p.data, r.data);
});

test('the list: logged-out knights too, who is on and where, last login, time online, knight play time, the last 10 logins', async () => {
  const { w, tok } = await fourKnights();
  const t0 = T;
  // Sam: three sessions (60 s, 30 s, then on now in the Spider Den for 45 s); a save with 3,723.9 seconds of play
  let s = await online(w, tok.Sam); T += 60000; w.webSocketClose(s, 1000, '');
  T += 5000; s = await online(w, tok.Sam); T += 30000; w.webSocketClose(s, 1000, '');
  T += 5000; assert.equal((await call(w, 'PUT', '/api/save', saveOf(3723.9), tok.Sam)).status, 200);
  const samOn = T; s = await online(w, tok.Sam, 'spider_den'); T += 45000;
  // Pip: one save that is not JSON the way the game writes it (the world stores it anyway if it parses) and none newer
  assert.equal((await call(w, 'PUT', '/api/save', JSON.stringify({ player: { playSeconds: 'lots' } }), tok.Pip)).status, 200);
  // Ada: saves, newest has play time; never online since logins began
  await call(w, 'PUT', '/api/save', saveOf(10), tok.Ada); await call(w, 'PUT', '/api/save', saveOf(50400.5), tok.Ada);
  const r = await call(w, 'GET', '/api/accounts', undefined, tok.MudGoll);
  const by = Object.fromEntries(r.data.map(a => [a.name, a]));
  const sam = by.Sam;
  assert.equal(sam.online, true); assert.equal(sam.map, 'spider_den'); assert.equal(sam.region, 'Spider Den'); assert.equal(sam.lv, 12);
  assert.equal(sam.lastLogin, samOn);
  assert.equal(sam.onlineMs, 60000 + 30000 + 45000);
  assert.equal(sam.playSeconds, 3723);
  assert.equal(sam.countedSince, Math.max(t0 - 4000, sam.created));   // the World woke before any knight was made
  assert.deepEqual(sam.logins, [{ at: samOn, ms: 45000, open: true }, { at: samOn - 35000, ms: 30000, open: false }, { at: samOn - 100000, ms: 60000, open: false }]);
  assert.equal(by.Pip.playSeconds, null);
  assert.equal(by.Ada.playSeconds, 50400);
  assert.equal(by.Ada.online, false); assert.equal(by.Ada.map, null); assert.equal(by.Ada.lastLogin, null); assert.deepEqual(by.Ada.logins, []); assert.equal(by.Ada.onlineMs, 0);
  assert.equal(by.Ada.lastOn, by.Ada.lastSeen);
  assert.equal(by.MudGoll.role, 'admin'); assert.equal(by.Sam.role, 'player');
  // Sam leaves: last on is when the socket closed, the total keeps all three
  T += 1000; w.webSocketClose(s, 1000, ''); T += 60000;
  const after = (await call(w, 'GET', '/api/accounts', undefined, tok.MudGoll)).data.find(a => a.name === 'Sam');
  assert.equal(after.online, false); assert.equal(after.lastOn, T - 60000); assert.equal(after.onlineMs, 60000 + 30000 + 46000);
  assert.deepEqual(after.logins[0], { at: samOn, ms: 46000, open: false });
  // twelve more short visits: the list carries the newest 10
  for (let i = 0; i < 12; i++) { const x = await online(w, tok.Sam, null); T += 1000; w.webSocketClose(x, 1000, ''); T += 10; }
  const many = (await parent(w, 'GET', '/api/admin/accounts')).data.find(a => a.name === 'Sam');
  assert.equal(many.logins.length, LOGINS_SHOWN);
  assert.ok(many.logins.every((l, i) => i === 0 || l.at < many.logins[i - 1].at));
  assert.equal(many.onlineMs, 136000 + 12000);
});

test('play time from a save is read safely: broken, huge, negative, missing and nested values are not shown as a time', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db); wake(sql);
  const put = (lc, json) => sql.exec('INSERT INTO saves (name_lc, ver, json, at) VALUES (?, (SELECT COALESCE(MAX(ver), 0) + 1 FROM saves WHERE name_lc = ?), ?, 1)', lc, lc, json);
  const cases = [['a', saveOf(12.7), 12], ['b', '{"player": {"playSeconds": 1e300}}', null], ['c', '{"player": {"playSeconds": -5}}', null], ['d', '{"player": {}}', null],
    ['e', '{"player": {"playSeconds": {"n": 3}}}', null], ['f', 'not json {', null], ['g', '[1, 2]', null], ['h', '{"player": {"playSeconds": "600"}}', null]];
  for (const [lc, json] of cases) put(lc, json);
  put('i', saveOf(99)); put('i', saveOf(120));   // the newest save counts
  for (const [lc, , want] of cases) assert.equal(playSecondsOf(sql, lc), want, lc);
  assert.equal(playSecondsOf(sql, 'i'), 120);
  assert.equal(playSecondsOf(sql, 'nobody'), null);
  // a runtime without SQLite's JSON functions: the save is parsed in a try instead, with the same answers
  const noJson = { exec: (q, ...a) => { if (/json_valid/.test(q)) throw new Error('no such function: json_valid'); return sql.exec(q, ...a); } };
  for (const [lc, , want] of cases) assert.equal(playSecondsOf(noJson, lc), want, 'fallback ' + lc);
  assert.equal(playSecondsOf(noJson, 'i'), 120);
});

test('POST /api/accounts/reset: refused for another admin, for yourself, for nobody, for a short word; too many in a minute waits', async () => {
  const { w, tok } = await fourKnights();
  const reset = (name, pass) => call(w, 'POST', '/api/accounts/reset', { name, pass }, tok.MudGoll);
  let r = await reset('Ada', 'newword'); assert.deepEqual([r.status, r.data.code], [403, 'isadmin']);
  r = await reset('mudgoll', 'newword'); assert.deepEqual([r.status, r.data.code], [403, 'self']);
  r = await reset('Nobody', 'newword'); assert.deepEqual([r.status, r.data.code], [404, 'unknown']);
  r = await reset('Sam', 'abc'); assert.deepEqual([r.status, r.data.code], [400, 'pass']);
  r = await reset('Sam', 7); assert.deepEqual([r.status, r.data.code], [400, 'pass']);
  // nothing changed: every knight still logs in with the old word, and nothing was logged
  for (const n of ['Ada', 'MudGoll', 'Sam']) assert.equal((await call(w, 'POST', '/api/login', { name: n, pass: 'sword' })).status, 200, n);
  assert.equal((await parent(w, 'GET', '/api/admin/modlog')).data.filter(m => m.act === 'reset').length, 0);
  // three a minute, then wait
  for (let i = 0; i < RESETS_PER_MINUTE; i++) { r = await reset(i % 2 ? 'Pip' : 'Sam', 'word' + i); assert.equal(r.status, 200, JSON.stringify(r.data)); T += 1000; }
  r = await reset('Sam', 'another'); assert.deepEqual([r.status, r.data.code, r.data.wait], [429, 'wait', 60]);
  T += 60000;
  r = await reset('Sam', 'another'); assert.equal(r.status, 200);
});

test('a reset hashes the new word, ends every session, sends the knight out with a plain message and logs who did it', async () => {
  const { w, tok } = await fourKnights();
  const second = (await call(w, 'POST', '/api/login', { name: 'Sam', pass: 'sword' })).data.token;   // Sam on a second device too
  const sock = await online(w, tok.Sam);
  T += 30000;
  const r = await call(w, 'POST', '/api/accounts/reset', { name: 'sam', pass: 'dragon fire' }, tok.MudGoll);
  assert.deepEqual([r.status, r.data], [200, { ok: true, name: 'Sam' }]);
  // hashed with a new salt, the word itself nowhere
  const row = w.sql.exec("SELECT salt, hash FROM accounts WHERE name_lc = 'sam'").toArray()[0];
  assert.match(row.salt, /^[0-9a-f]{32}$/); assert.match(row.hash, /^[0-9a-f]{64}$/);
  assert.equal(await checkPassword('dragon fire', row.salt, row.hash), true);
  assert.equal(JSON.stringify(w.sql.exec('SELECT * FROM accounts').toArray()).includes('dragon'), false);
  // the socket: the error, then the close; the login row ended
  assert.deepEqual(sock.last('error'), { t: 'error', code: 'auth', text: RESET_TEXT, why: 'reset' });
  assert.equal(sock.closed.code, 4000);
  assert.deepEqual(w.store.logins('Sam', 5).map(l => [l.ended !== null, l.ended - l.started]), [[true, 30000]]);
  // both old tokens are dead; the old word fails; the new one works
  for (const t of [tok.Sam, second]) assert.equal((await call(w, 'GET', '/api/me', undefined, t)).status, 401);
  assert.equal((await call(w, 'POST', '/api/login', { name: 'Sam', pass: 'sword' })).status, 401);
  assert.equal((await call(w, 'POST', '/api/login', { name: 'Sam', pass: 'dragon fire' })).status, 200);
  // one mod_log row: who, whom, never the word
  const log = (await parent(w, 'GET', '/api/admin/modlog')).data.filter(m => m.act === 'reset');
  assert.deepEqual(log, [{ at: T, by: 'MudGoll', act: 'reset', n: 'Sam', detail: '' }]);
  // an offline knight: just the hash and the log
  const p = await call(w, 'POST', '/api/accounts/reset', { name: 'Pip', pass: 'shield' }, tok.MudGoll);
  assert.equal(p.status, 200);
  assert.equal((await call(w, 'POST', '/api/login', { name: 'Pip', pass: 'shield' })).status, 200);
  // the parent page's reset goes the same way (and may change an admin's own word)
  assert.equal((await parent(w, 'POST', '/api/admin/reset', { name: 'MudGoll', pass: 'gold crown' })).status, 200);
  assert.equal((await call(w, 'POST', '/api/login', { name: 'MudGoll', pass: 'gold crown' })).status, 200);
  assert.deepEqual((await parent(w, 'GET', '/api/admin/modlog')).data.filter(m => m.act === 'reset').map(m => [m.by, m.n]), [['parent page', 'MudGoll'], ['MudGoll', 'Pip'], ['MudGoll', 'Sam']]);
});

test('the World: a ban from the parent page and a login elsewhere close the login; a wake keeps live ones and ends lost ones', async () => {
  const { ctx, w, tok } = await fourKnights();
  const sam = await online(w, tok.Sam), pip = await online(w, tok.Pip), ada = await online(w, tok.Ada);
  T += SEEN_EVERY + 5; w.webSocketMessage(ada, JSON.stringify({ t: 'p', map: 'over', x: 5, y: 5 }));
  const adaHeard = T;
  T += 10000; await parent(w, 'POST', '/api/admin/ban', { name: 'Pip', banned: true });
  assert.equal(pip.closed.code, 4003);
  assert.equal(w.store.logins('Pip', 1)[0].ended, T);
  // Sam opens a second socket: the first is sent away and its row closed
  T += 1000; const sam2 = await online(w, (await call(w, 'POST', '/api/login', { name: 'Sam', pass: 'sword' })).data.token);
  assert.equal(sam.closed.code, 4000);
  assert.deepEqual(w.store.logins('Sam', 5).map(l => l.ended === null), [true, false]);
  // the world is restarted: Ada's socket is lost with it (no close ever arrives), Sam's second one survives the nap
  ada.closed = { code: 1006, reason: 'lost in the restart' };
  T += 120000;
  const w2 = new TestWorld(ctx, ENV);
  assert.equal(w2.room.isOnline('Sam'), true);
  assert.equal(w2.store.logins('Ada', 1)[0].ended, adaHeard);
  assert.equal(w2.store.logins('Sam', 1)[0].ended, null);
  const list = (await call(w2, 'GET', '/api/accounts', undefined, tok.MudGoll)).data;
  const s = list.find(a => a.name === 'Sam');
  assert.equal(s.online, true); assert.equal(s.logins[0].open, true); assert.equal(s.logins[0].ms, 120000);
  T += 5000; w2.webSocketClose(sam2, 1000, '');
  assert.equal(w2.store.logins('Sam', 1)[0].ended, T);
});

// ---------------------------------------------------------------------------
// the migration: a database the live server (master, admin era) made, then this code waking on it
// ---------------------------------------------------------------------------
const LIVE_SCHEMA = `
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
ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'player';
ALTER TABLE accounts ADD COLUMN muted_until INTEGER NOT NULL DEFAULT 0
`;
const TABLES = { accounts: 'name_lc', sessions: 'token', saves: 'name_lc, ver', chat: 'id', settings: 'key', mod_log: 'id', save_pins: 'name_lc', parties: 'id', crackers: 'party, k' };
const LIVE_COLUMNS = t => t === 'accounts' ? ['name_lc', 'name', 'salt', 'hash', 'created', 'last_seen', 'banned', 'tries', 'locked_until', 'role', 'muted_until'] : null;
const dumpLive = sql => {
  const out = {};
  // every old row with its old columns; the one new settings row (logins_since) is checked on its own
  for (const [t, order] of Object.entries(TABLES)) { const cols = LIVE_COLUMNS(t); out[t] = sql.exec(`SELECT ${cols ? cols.join(', ') : '*'} FROM ${t} ${t === 'settings' ? "WHERE key != 'logins_since'" : ''} ORDER BY ${order}`).toArray(); }
  return out;
};

test('the migration on a database the live server made: every row kept, every knight still logs in, then counting starts', async () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  for (const stmt of LIVE_SCHEMA.split(';')) if (stmt.trim()) sql.exec(stmt);
  const words = { cohen: 'sword', mudgoll: 'gold crown', sam: 'shield' };
  for (const [lc, name, role, banned] of [['cohen', 'Cohen', 'player', 0], ['mudgoll', 'MudGoll', 'admin', 0], ['sam', 'Sam', 'player', 1]]) {
    const { salt, hash } = await makeHash(words[lc]);
    sql.exec('INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen, banned, role, muted_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', lc, name, salt, hash, 1758000000000, 1758700000000, banned, role, lc === 'cohen' ? 1758900000000 : 0);
    sql.exec('INSERT INTO sessions (token, name_lc, expires) VALUES (?, ?, ?)', lc.padEnd(64, '0'), lc, 1766600000000);
    for (let v = 1; v <= 3; v++) sql.exec('INSERT INTO saves (name_lc, ver, json, at) VALUES (?, ?, ?, ?)', lc, v, saveOf(1000 * v + lc.length), 1758000000000 + v);
  }
  sql.exec("INSERT INTO settings (key, value) VALUES ('invite', 'GORK-2026')");
  sql.exec("INSERT INTO mod_log (at, by, act, target, detail) VALUES (1758100000000, 'parent page', 'role', 'MudGoll', 'admin')");
  sql.exec("INSERT INTO save_pins (name_lc, json, at) VALUES ('mudgoll', ?, 1758100000001)", saveOf(1));
  sql.exec("INSERT INTO parties (at, by, map, region, hat, table_json, count, expires) VALUES (1758100000000, 'MudGoll', 'over', 'Thistledown', 1000, '[]', 1, 1758100900000)");
  sql.exec("INSERT INTO crackers (party, k, tx, ty, lit_by, lit_at, reward, claimed) VALUES (1, 0, 60, 30, 'cohen', 1758100000500, '{\"id\":\"coins\",\"qty\":5}', 1)");
  for (let i = 0; i < 5; i++) sql.exec('INSERT INTO chat (at, name, text) VALUES (?, ?, ?)', 1758000000000 + i, 'Cohen', 'hi ' + i);
  const before = dumpLive(sql);
  T = 1759000000000;
  const w = new TestWorld(makeCtx(db), ENV);
  assert.deepEqual(dumpLive(sql), before);
  assert.deepEqual(sql.exec('SELECT name_lc, online_ms FROM accounts ORDER BY name_lc').toArray(), [{ name_lc: 'cohen', online_ms: 0 }, { name_lc: 'mudgoll', online_ms: 0 }, { name_lc: 'sam', online_ms: 0 }]);
  assert.equal(sql.exec("SELECT value FROM settings WHERE key = 'logins_since'").toArray()[0].value, String(T));
  // the old tokens and words still work; the banned knight is still banned; the admin is still one
  assert.equal((await call(w, 'GET', '/api/me', undefined, 'cohen'.padEnd(64, '0'))).data.name, 'Cohen');
  assert.equal((await call(w, 'POST', '/api/login', { name: 'MudGoll', pass: 'gold crown' })).status, 200);
  assert.equal((await call(w, 'POST', '/api/login', { name: 'Sam', pass: 'shield' })).data.code, 'banned');
  const list = (await call(w, 'GET', '/api/accounts', undefined, 'mudgoll'.padEnd(64, '0'))).data;
  assert.deepEqual(list.map(a => [a.name, a.role, a.banned, a.playSeconds, a.onlineMs, a.lastLogin, a.countedSince]),
    [['Cohen', 'player', false, 3005, 0, null, T], ['MudGoll', 'admin', false, 3007, 0, null, T], ['Sam', 'player', true, 3003, 0, null, T]]);
  // a second wake changes nothing, the counting date included
  const mid = dumpLive(sql); T += 3600000;
  new TestWorld(makeCtx(db), ENV);
  assert.deepEqual(dumpLive(sql), mid);
  assert.equal(sql.exec("SELECT value FROM settings WHERE key = 'logins_since'").toArray()[0].value, String(T - 3600000));
});

test('the backup export carries the logins', async () => {
  const { w, tok } = await fourKnights();
  const s = await online(w, tok.Sam); T += 1000; w.webSocketClose(s, 1000, '');
  const r = await parent(w, 'GET', '/api/admin/export');
  assert.equal(r.status, 200);
  assert.equal(r.data.logins.length, 1);
  assert.equal(r.data.logins[0].name_lc, 'sam');
  assert.equal(r.data.logins[0].ended - r.data.logins[0].started, 1000);
});

test('the kick text and the Room constants the game reads stay what the contract says', () => {
  assert.equal(RESET_TEXT, 'An admin changed your secret word. Ask them for the new one, then log in again.');
  assert.equal(KICK_TEXT, 'An admin sent you out of the world. You can come back in.');
  assert.equal(SEEN_EVERY, 60000); assert.equal(LOGINS_KEPT, 50); assert.equal(LOGINS_SHOWN, 10); assert.equal(RESETS_PER_MINUTE, 3);
  assert.ok(ROSTER_EVERY > 0);
});
