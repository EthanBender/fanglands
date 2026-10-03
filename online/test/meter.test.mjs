// The meter (docs/ONLINE.md, "The shared world", Stage 0): socket messages and World requests counted per UTC day,
// written in batches, read by GET /api/admin/sim. node's built-in SQLite stands in for the Durable Object's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Meter, METER_SCHEMA, METER_ADMIN_SCHEMA, WRITE_AT, WRITE_EVERY, KEEP_DAYS, FREE_REQUESTS, dayOf, estimate, isAdminPath } from '../src/meter.js';
import { SCHEMA, migrate } from '../src/store.js';

// node's SQLite with the Durable Object SQL API's shape (as in store.test.mjs)
function sqlOf(db, { failWrites = () => false } = {}) {
  return {
    exec(q, ...args) {
      if (/^\s*INSERT INTO req_meter/i.test(q) && failWrites()) throw new Error('disk full');
      const stmt = db.prepare(q);
      const columnNames = stmt.columns().map(c => c.name);
      let rows = [], rowsWritten = 0;
      if (columnNames.length) rows = stmt.all(...args).map(r => Object.assign({}, r));
      else rowsWritten = stmt.run(...args).changes;
      return { toArray: () => rows.slice(), one: () => rows[0], rowsWritten, columnNames, [Symbol.iterator]: () => rows[Symbol.iterator]() };
    },
  };
}
const rowsOf = sql => sql.exec('SELECT day, ws_in, http, est_requests FROM req_meter ORDER BY day').toArray();
const adminOf = sql => sql.exec('SELECT day, http FROM req_meter_admin ORDER BY day').toArray();
const at = iso => Date.parse(iso);

test('estimate: 20 socket messages are one request, every World request is one', () => {
  assert.equal(estimate(0, 0), 0);
  assert.equal(estimate(1, 0), 1);
  assert.equal(estimate(20, 0), 1);
  assert.equal(estimate(21, 3), 5);
  assert.equal(estimate(100000, 1234), 6234);
  assert.equal(dayOf(at('2026-10-03T23:59:59.999Z')), '2026-10-03');
  assert.equal(dayOf(at('2026-10-04T00:00:00.000Z')), '2026-10-04');
  assert.equal(FREE_REQUESTS, 100000);
});

test('counts wait in memory and are written in one upsert: at 200 waiting, or 10 s after the last write', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  let T = at('2026-10-03T15:00:00Z');
  const m = new Meter(sql, () => T);
  for (let i = 0; i < WRITE_AT - 2; i++) m.ws();
  m.http();
  assert.deepEqual(rowsOf(sql), [], 'nothing written below the batch size inside 10 s');
  assert.equal(m.view().today.wsIn, WRITE_AT - 2, 'the view counts what is still waiting');
  assert.equal(m.view().waiting, WRITE_AT - 1);
  m.ws();
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-03', ws_in: WRITE_AT - 1, http: 1, est_requests: estimate(WRITE_AT - 1, 1) }]);
  assert.equal(m.view().waiting, 0);
  // a quiet World: one message after 10 s goes straight out with everything before it
  m.ws(); T += 3000; m.http();
  assert.equal(rowsOf(sql)[0].ws_in, WRITE_AT - 1, 'held under 10 s');
  T += WRITE_EVERY; m.ws();
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-03', ws_in: WRITE_AT + 1, http: 2, est_requests: estimate(WRITE_AT + 1, 2) }]);
  // the estimate is the whole day's, never a sum of rounded batches
  for (let i = 0; i < 19; i++) m.ws();
  m.flush();
  assert.equal(rowsOf(sql)[0].est_requests, estimate(WRITE_AT + 20, 2));
});

test('flush (socket close, alarm) writes what waits; nothing waiting writes nothing', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  let T = at('2026-10-03T15:00:00Z');
  const m = new Meter(sql, () => T);
  assert.equal(m.flush(), 0);
  assert.deepEqual(rowsOf(sql), []);
  m.ws(); m.ws(); m.http();
  assert.equal(m.flush(), 1);
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-03', ws_in: 2, http: 1, est_requests: 2 }]);
  assert.equal(m.flush(), 0);
});

test('UTC midnight starts a new row; counts from both days in one batch land on their own days', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  let T = at('2026-10-03T23:59:58Z');
  const m = new Meter(sql, () => T);
  m.ws(); m.ws(); m.http();
  T = at('2026-10-04T00:00:01Z');   // 7 pm in Ontario on 3 Oct (EDT): already the 4th for the free plan
  m.ws();
  T += 1; m.flush();
  assert.deepEqual(rowsOf(sql), [
    { day: '2026-10-03', ws_in: 2, http: 1, est_requests: 2 },
    { day: '2026-10-04', ws_in: 1, http: 0, est_requests: 1 },
  ]);
  const v = m.view();
  assert.equal(v.today.day, '2026-10-04');
  assert.deepEqual(v.days.map(d => d.day), ['2026-10-04', '2026-10-03'], 'newest first');
});

test('a nap: a new World on the same database adds to the same day', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  let T = at('2026-10-03T12:00:00Z');
  const a = new Meter(sql, () => T);
  for (let i = 0; i < 40; i++) a.ws();
  a.http(); a.flush();
  const b = new Meter(sql, () => T);   // the constructor's CREATE TABLE IF NOT EXISTS changes nothing
  for (let i = 0; i < 40; i++) b.ws();
  b.flush();
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-03', ws_in: 80, http: 1, est_requests: 5 }]);
});

test('a failed write keeps the counts for the next try', () => {
  const db = new DatabaseSync(':memory:');
  let fail = true;
  const sql = sqlOf(db, { failWrites: () => fail });
  const T = at('2026-10-03T12:00:00Z');
  const m = new Meter(sql, () => T);
  const err = console.error; console.error = () => { };
  try { m.ws(); m.http(); assert.equal(m.flush(), 0); } finally { console.error = err; }
  assert.equal(m.view().waiting, 2);
  fail = false;
  assert.equal(m.flush(), 1);
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-03', ws_in: 1, http: 1, est_requests: 2 }]);
});

test('rows older than 400 days go on the first write of a day; the view shows 14 days', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  sql.exec(METER_SCHEMA);
  const old = at('2026-10-03T00:00:00Z') - (KEEP_DAYS + 1) * 86400000, kept = at('2026-10-03T00:00:00Z') - KEEP_DAYS * 86400000;
  sql.exec('INSERT INTO req_meter (day, ws_in, http, est_requests) VALUES (?, 1, 1, 2)', dayOf(old));
  sql.exec('INSERT INTO req_meter (day, ws_in, http, est_requests) VALUES (?, 1, 1, 2)', dayOf(kept));
  for (let d = 1; d <= 20; d++) sql.exec('INSERT INTO req_meter (day, ws_in, http, est_requests) VALUES (?, ?, 0, ?)', dayOf(at('2026-10-03T00:00:00Z') - d * 86400000), d * 20, d);
  const m = new Meter(sql, () => at('2026-10-03T09:00:00Z'));
  m.http(); m.flush();
  const days = rowsOf(sql).map(r => r.day);
  assert.ok(!days.includes(dayOf(old)), 'the 401-day-old row is gone');
  assert.ok(days.includes(dayOf(kept)), 'the 400-day-old row stays');
  const v = m.view();
  assert.equal(v.days.length, 14);
  assert.equal(v.days[0].day, '2026-10-03');
  assert.deepEqual(v.days[1], { day: '2026-10-02', wsIn: 20, http: 0, admin: 0, gameHttp: 0, est: 1, gameEst: 1 });
  assert.equal(v.freeLimit, 100000);
});

// ---------------------------------------------------------------------------
// The World: every request and socket message counted, flushed on close and alarm, read by GET /api/admin/sim
// ---------------------------------------------------------------------------
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const fakeWs = () => {
  const s = { got: [], closed: null, att: null, send(str) { s.got.push(JSON.parse(str)); }, close(code, reason) { if (!s.closed) s.closed = { code, reason }; }, serializeAttachment(st) { s.att = JSON.parse(JSON.stringify(st)); }, deserializeAttachment() { return s.att; } };
  return s;
};
globalThis.WebSocketPair = class { constructor() { this[0] = fakeWs(); this[1] = fakeWs(); } };
const { World } = await import('../src/world.js');
let T = at('2026-10-03T15:00:00Z');
class TestWorld extends World { now() { return T; } upgraded(client) { return { status: 101, client }; } }
function makeCtx(db) {
  const sockets = [];
  return { storage: { sql: sqlOf(db || new DatabaseSync(':memory:')), setAlarm: async () => { } }, setWebSocketAutoResponse() { }, acceptWebSocket(ws) { sockets.push(ws); }, getWebSockets: () => sockets.filter(s => !s.closed), sockets };
}
const ENV = { ADMIN_KEY: 'test-admin', INVITE_CODE: 'TEST-1234' };
async function call(w, method, path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await w.fetch(new Request('http://world' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  let data = null; try { data = await res.json(); } catch (e) { }
  return { status: res.status, data };
}

test('the World counts every request and socket message, writes on close and alarm, and GET /api/admin/sim reads it', async () => {
  const db = new DatabaseSync(':memory:'), ctx = makeCtx(db);
  T = at('2026-10-03T15:00:00Z');
  const w = new TestWorld(ctx, ENV);
  let r = await call(w, 'GET', '/api/admin/sim');
  assert.deepEqual([r.status, r.data.code], [401, 'admin'], 'admin key only');
  r = await call(w, 'POST', '/api/signup', { name: 'Cohen', pass: 'sword', invite: 'TEST-1234' });
  const tok = r.data.token;
  await call(w, 'GET', '/api/status');
  const up = await w.fetch(new Request('http://world/ws?token=' + tok, { headers: { upgrade: 'websocket' } }));
  assert.equal(up.status, 101);
  const sock = ctx.sockets[ctx.sockets.length - 1];
  w.webSocketMessage(sock, JSON.stringify({ t: 'hello', v: 1 }));
  for (let i = 0; i < 24; i++) w.webSocketMessage(sock, JSON.stringify({ t: 'p', map: 'over', region: 'Thistledown', x: 480 + i, y: 480, lv: 3 }));
  assert.deepEqual(rowsOf(ctx.storage.sql), [], 'all of it still waiting');
  r = await call(w, 'GET', '/api/admin/sim', undefined, ENV.ADMIN_KEY);
  assert.equal(r.status, 200);
  // 5 World requests so far: the refused sim call, signup, status, the /ws upgrade, and this sim call; 25 messages.
  // The two sim calls are the admin's (refused or not, Cloudflare bills them): the game made 3, about 2 + 3 = 5 requests
  assert.deepEqual(r.data.meter.today, { day: '2026-10-03', wsIn: 25, http: 5, admin: 2, gameHttp: 3, est: 7, gameEst: 5 });
  assert.equal(r.data.meter.freeLimit, 100000);
  assert.equal(r.data.meter.waiting, 30);
  assert.deepEqual(Object.keys(r.data), ['meter'], 'only the meter in Stage 0');
  w.webSocketClose(sock, 1000, 'bye');
  assert.deepEqual(rowsOf(ctx.storage.sql), [{ day: '2026-10-03', ws_in: 25, http: 5, est_requests: 7 }], 'a socket close writes');
  assert.deepEqual(adminOf(ctx.storage.sql), [{ day: '2026-10-03', http: 2 }], 'and the admin calls with it');
  await call(w, 'GET', '/api/status');
  w.alarm();
  assert.equal(rowsOf(ctx.storage.sql)[0].http, 6, 'an alarm writes');
  // the export carries the table; a nap (a new World on the same storage) keeps counting the same day
  r = await call(w, 'GET', '/api/admin/export', undefined, ENV.ADMIN_KEY);
  assert.deepEqual(r.data.req_meter, [{ day: '2026-10-03', ws_in: 25, http: 6, est_requests: 8 }]);
  assert.deepEqual(r.data.req_meter_admin, [{ day: '2026-10-03', http: 2 }]);
  // the export call itself still waits in this World's memory: a nap right now loses it (at most 10 s of counts)
  const w2 = new TestWorld(ctx, ENV);
  r = await call(w2, 'GET', '/api/admin/sim', undefined, ENV.ADMIN_KEY);
  assert.deepEqual(r.data.meter.today, { day: '2026-10-03', wsIn: 25, http: 7, admin: 3, gameHttp: 4, est: 9, gameEst: 6 });
});

test('admin calls land in their own column: every /api/admin/* call, refused or not; nothing else', async () => {
  assert.ok(isAdminPath('/api/admin/sim') && isAdminPath('/api/admin/export') && !isAdminPath('/api/status') && !isAdminPath('/ws') && !isAdminPath('/api/adminx') && !isAdminPath('/admin'));
  const db = new DatabaseSync(':memory:'), ctx = makeCtx(db);
  T = at('2026-10-04T10:00:00Z');
  const w = new TestWorld(ctx, ENV);
  // one minute of the admin page as it polled before (online, chat, modlog, trades, sim every 10 s): 30 admin calls
  for (let i = 0; i < 6; i++) for (const c of ['online', 'chat?limit=500', 'modlog?limit=200', 'trades?limit=200', 'sim']) await call(w, 'GET', '/api/admin/' + c, undefined, ENV.ADMIN_KEY);
  await call(w, 'GET', '/api/admin/sim');   // no key: refused, still billed, still the admin page's
  await call(w, 'GET', '/api/status'); await call(w, 'GET', '/api/status');
  let r = await call(w, 'GET', '/api/admin/sim', undefined, ENV.ADMIN_KEY);
  assert.deepEqual(r.data.meter.today, { day: '2026-10-04', wsIn: 0, http: 34, admin: 32, gameHttp: 2, est: 34, gameEst: 2 });
  w.alarm();
  assert.deepEqual(rowsOf(ctx.storage.sql), [{ day: '2026-10-04', ws_in: 0, http: 34, est_requests: 34 }], 'req_meter still counts every call (what is billed)');
  assert.deepEqual(adminOf(ctx.storage.sql), [{ day: '2026-10-04', http: 32 }]);
  // a Meter on its own: http(true) is the admin's, http() the game's
  const sql = sqlOf(new DatabaseSync(':memory:')), m = new Meter(sql, () => at('2026-10-04T10:00:00Z'));
  m.http(true); m.http(); m.ws(); m.flush();
  assert.deepEqual(adminOf(sql), [{ day: '2026-10-04', http: 1 }]);
  assert.deepEqual(m.view().today, { day: '2026-10-04', wsIn: 1, http: 2, admin: 1, gameHttp: 1, est: 3, gameEst: 2 });
});

test('a failed admin write keeps the admin counts for the next try; old admin rows go with the old days', () => {
  const db = new DatabaseSync(':memory:');
  let fail = false;
  const base = sqlOf(db);
  const sql = { exec(q, ...a) { if (fail && /INSERT INTO req_meter_admin/.test(q)) throw new Error('disk full'); return base.exec(q, ...a); } };
  const T0 = at('2026-10-04T10:00:00Z');
  sql.exec(METER_ADMIN_SCHEMA);
  const old = T0 - (KEEP_DAYS + 1) * 86400000;
  sql.exec('INSERT INTO req_meter_admin (day, http) VALUES (?, 5)', dayOf(old));
  const m = new Meter(sql, () => T0);
  fail = true;
  const err = console.error; console.error = () => { };
  try { m.http(true); m.http(true); m.flush(); } finally { console.error = err; }
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-04', ws_in: 0, http: 2, est_requests: 2 }], 'the calls themselves are written');
  assert.deepEqual(m.view().today.admin, 2, 'the admin share still waits');
  fail = false;
  m.http(true); m.flush();
  assert.deepEqual(adminOf(sql), [{ day: '2026-10-04', http: 3 }], 'none lost, the 401-day-old admin row is gone');
  assert.deepEqual(m.view().today, { day: '2026-10-04', wsIn: 0, http: 3, admin: 3, gameHttp: 0, est: 3, gameEst: 0 });
});

test('the meter on a world made by the live schema: two new tables, nothing else touched', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  for (const s of SCHEMA.split(';')) if (s.trim()) sql.exec(s);
  migrate(sql);
  sql.exec("INSERT INTO accounts (name_lc, name, salt, hash, created, last_seen) VALUES ('cohen', 'Cohen', 's', 'h', 1, 2)");
  sql.exec("INSERT INTO settings (key, value) VALUES ('invite', 'GORK-2026')");
  const objects = () => sql.exec("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").toArray();
  const before = objects();
  const rows = () => JSON.stringify([sql.exec('SELECT * FROM accounts').toArray(), sql.exec('SELECT * FROM settings').toArray()]);
  const rowsBefore = rows();
  new Meter(sql, () => at('2026-10-03T12:00:00Z'));
  new Meter(sql, () => at('2026-10-03T12:00:00Z'));
  const after = objects();
  const ours = ['req_meter', 'req_meter_admin'];
  assert.deepEqual(after.filter(o => !ours.includes(o.name)), before, 'every other table and index exactly as it was');
  assert.deepEqual(after.filter(o => ours.includes(o.name) && o.type === 'table').map(o => o.sql), [METER_SCHEMA, METER_ADMIN_SCHEMA].map(q => q.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TABLE')));
  // the test world already has the first table from before the admin column: the Meter adds only the second
  const db2 = new DatabaseSync(':memory:'), sql2 = sqlOf(db2);
  sql2.exec(METER_SCHEMA); sql2.exec("INSERT INTO req_meter (day, ws_in, http, est_requests) VALUES ('2026-10-03', 40, 10, 12)");
  const m2 = new Meter(sql2, () => at('2026-10-03T12:00:00Z'));
  assert.deepEqual(m2.view().today, { day: '2026-10-03', wsIn: 40, http: 10, admin: 0, gameHttp: 10, est: 12, gameEst: 12 });
  assert.equal(rows(), rowsBefore);
});
