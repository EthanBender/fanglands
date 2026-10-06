// The meter (docs/ONLINE.md, "The shared world", Stage 0): socket messages and World requests counted per UTC day,
// written in batches, read by GET /api/admin/sim. node's built-in SQLite stands in for the Durable Object's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Meter, METER_SCHEMA, METER_ADMIN_SCHEMA, METER_ALARM_SCHEMA, METER_ROWS_SCHEMA, WRITE_AT, WRITE_EVERY, WRITE_SOON, ROWS_EVERY, KEEP_DAYS, FREE_REQUESTS, FREE_ROWS, dayOf, estimate, isAdminPath, countRows } from '../src/meter.js';
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
// a view row without its rows-written count (in the World tests that is node's SQLite's own count: asserted on its own)
const noRows = ({ rows, rowsSince, ...r }) => r;
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

test('socket messages wait in memory and go out in one upsert (at 200 waiting, or 10 s after the last write); the first count after a wake is written at once, and a request when nothing was written for WRITE_SOON', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  let T = at('2026-10-03T15:00:00Z');
  const m = new Meter(sql, () => T);
  // a World that naps between requests is a new object each time: its first count is written before it can nap again
  m.ws();
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-03', ws_in: 1, http: 0, est_requests: 1 }], 'the first count after a wake');
  for (let i = 0; i < WRITE_AT - 2; i++) m.ws();
  assert.equal(rowsOf(sql)[0].ws_in, 1, 'nothing more written below the batch size inside 10 s');
  assert.equal(m.view().today.wsIn, WRITE_AT - 1, 'the view counts what is still waiting');
  assert.equal(m.view().waiting, WRITE_AT - 2);
  m.http();
  assert.equal(rowsOf(sql)[0].http, 0, 'a request inside WRITE_SOON of the last write waits too');
  T += WRITE_SOON; m.http();
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-03', ws_in: WRITE_AT - 1, http: 2, est_requests: estimate(WRITE_AT - 1, 2) }], 'a request after WRITE_SOON writes at once, with everything waiting');
  assert.equal(m.view().waiting, 0);
  for (let i = 0; i < WRITE_AT - 1; i++) m.ws();
  assert.equal(rowsOf(sql)[0].ws_in, WRITE_AT - 1, 'held below the batch size');
  m.ws();
  assert.equal(rowsOf(sql)[0].ws_in, 2 * WRITE_AT - 1, 'written at the batch size');
  // a quiet World: one message 10 s after the last write goes straight out with everything before it
  m.ws(); T += 3000; m.ws();
  assert.equal(rowsOf(sql)[0].ws_in, 2 * WRITE_AT - 1, 'held under 10 s');
  T += WRITE_EVERY; m.ws();
  assert.equal(rowsOf(sql)[0].ws_in, 2 * WRITE_AT + 2);
  // the estimate is the whole day's, never a sum of rounded batches
  for (let i = 0; i < 19; i++) m.ws();
  m.flush();
  assert.equal(rowsOf(sql)[0].est_requests, estimate(2 * WRITE_AT + 21, 2));
});

test('a World that naps between sparse requests still counts every one (a paused page saving every 15 s)', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  let T = at('2026-10-04T01:00:00Z');
  for (let i = 0; i < 240; i++) { const m = new Meter(sql, () => T); T += 1; m.http(); T += 15000; }
  for (let i = 0; i < 30; i++) { const m = new Meter(sql, () => T); T += 1; m.ws(); T += 60000; }
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-04', ws_in: 30, http: 240, est_requests: estimate(30, 240) }]);
});

test('flush (socket close, alarm) writes what waits; nothing waiting writes nothing', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  let T = at('2026-10-03T15:00:00Z');
  const m = new Meter(sql, () => T);
  assert.equal(m.flush(), 0);
  assert.deepEqual(rowsOf(sql), []);
  m.ws();   // the first count after a wake: written at once
  m.ws(); m.ws();
  assert.equal(m.flush(), 1);
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-03', ws_in: 3, http: 0, est_requests: 1 }]);
  assert.equal(m.flush(), 0);
  T += WRITE_SOON; m.http();
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-03', ws_in: 3, http: 1, est_requests: 2 }]);
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
  // the day before alarms were counted apart (this Meter's first wake is 3 Oct): its alarms and page calls are not known
  assert.deepEqual(v.days[1], { day: '2026-10-02', wsIn: 20, http: 0, admin: 0, gameHttp: 0, alarms: null, pageHttp: null, alarmsSince: null, est: 1, gameEst: 1, rows: null, rowsSince: null });
  // 3 Oct: nothing of it was counted before this Meter's first wake, so it counts the whole day apart (no "since")
  assert.deepEqual([v.days[0].alarms, v.days[0].pageHttp, v.days[0].alarmsSince, v.days[0].rows, v.days[0].rowsSince], [0, 1, null, 0, null]);
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
  // (each request WRITE_SOON after the one before: a request is written at once unless the meter wrote that recently)
  let r = await call(w, 'GET', '/api/admin/sim');
  assert.deepEqual([r.status, r.data.code], [401, 'admin'], 'admin key only');
  T += WRITE_SOON; r = await call(w, 'POST', '/api/signup', { name: 'Cohen', pass: 'sword', invite: 'TEST-1234' });
  const tok = r.data.token;
  T += WRITE_SOON; await call(w, 'GET', '/api/status');
  T += WRITE_SOON; const up = await w.fetch(new Request('http://world/ws?token=' + tok, { headers: { upgrade: 'websocket' } }));
  assert.equal(up.status, 101);
  const sock = ctx.sockets[ctx.sockets.length - 1];
  w.webSocketMessage(sock, JSON.stringify({ t: 'hello', v: 1 }));
  for (let i = 0; i < 24; i++) w.webSocketMessage(sock, JSON.stringify({ t: 'p', map: 'over', region: 'Thistledown', x: 480 + i, y: 480, lv: 3 }));
  // every request was written as it came (the first after a wake, and each one since); the messages wait
  assert.deepEqual(rowsOf(ctx.storage.sql), [{ day: '2026-10-03', ws_in: 0, http: 4, est_requests: 4 }], 'the requests written, the messages waiting');
  T += WRITE_SOON; r = await call(w, 'GET', '/api/admin/sim', undefined, ENV.ADMIN_KEY);
  assert.equal(r.status, 200);
  // 5 World requests so far: the refused sim call, signup, status, the /ws upgrade, and this sim call; 25 messages.
  // The two sim calls are the admin's (refused or not, Cloudflare bills them): the game made 3, about 2 + 3 = 5 requests
  assert.deepEqual(noRows(r.data.meter.today), { day: '2026-10-03', wsIn: 25, http: 5, admin: 2, gameHttp: 3, alarms: 0, pageHttp: 3, alarmsSince: null, est: 7, gameEst: 5 });
  assert.ok(r.data.meter.today.rows > 0 && r.data.meter.today.rowsSince === null, 'the rows written, counted from the first wake: ' + r.data.meter.today.rows);
  assert.equal(r.data.meter.freeLimit, 100000);
  assert.equal(r.data.meter.freeRows, 100000);
  assert.equal(r.data.meter.waiting, 0, 'this request wrote everything that waited');
  assert.deepEqual(Object.keys(r.data), ['meter', 'sim', 'world', 'atlas', 'move'], 'the meter, and from Stage 1 the switch, the Atlas and the movement check, and from Stage 2 the world-run maps');
  w.webSocketClose(sock, 1000, 'bye');
  assert.deepEqual(rowsOf(ctx.storage.sql), [{ day: '2026-10-03', ws_in: 25, http: 5, est_requests: 7 }], 'a socket close writes');
  assert.deepEqual(adminOf(ctx.storage.sql), [{ day: '2026-10-03', http: 2 }], 'and the admin calls with it');
  T += WRITE_SOON; await call(w, 'GET', '/api/status');
  w.alarm();
  assert.equal(rowsOf(ctx.storage.sql)[0].http, 6, 'an alarm right after a write waits');
  T += WRITE_SOON; w.alarm();
  assert.equal(rowsOf(ctx.storage.sql)[0].http, 8, 'an alarm writes, and is itself a billed request (the status call 6, the alarms 7 and 8)');
  // the export carries the table; a nap (a new World on the same storage) keeps counting the same day
  T += WRITE_SOON; r = await call(w, 'GET', '/api/admin/export', undefined, ENV.ADMIN_KEY);
  assert.deepEqual(r.data.req_meter, [{ day: '2026-10-03', ws_in: 25, http: 9, est_requests: 11 }]);
  assert.deepEqual(r.data.req_meter_admin, [{ day: '2026-10-03', http: 3 }]);
  assert.deepEqual(r.data.req_meter_alarm, [{ day: '2026-10-03', http: 2, since: at('2026-10-03T00:00:00Z') }], 'and the alarm column (the whole day: nothing of it was counted before)');
  assert.deepEqual(r.data.req_meter_rows.map(x => [x.day, x.since, x.rows > 0]), [['2026-10-03', at('2026-10-03T00:00:00Z'), true]], 'and the rows written');
  // the export call itself was written as it came: a nap right now loses nothing
  const w2 = new TestWorld(ctx, ENV);
  r = await call(w2, 'GET', '/api/admin/sim', undefined, ENV.ADMIN_KEY);
  assert.deepEqual(noRows(r.data.meter.today), { day: '2026-10-03', wsIn: 25, http: 10, admin: 4, gameHttp: 6, alarms: 2, pageHttp: 4, alarmsSince: null, est: 12, gameEst: 8 });
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
  assert.deepEqual(noRows(r.data.meter.today), { day: '2026-10-04', wsIn: 0, http: 34, admin: 32, gameHttp: 2, alarms: 0, pageHttp: 2, alarmsSince: null, est: 34, gameEst: 2 });
  T += WRITE_SOON; w.alarm();
  assert.deepEqual(rowsOf(ctx.storage.sql), [{ day: '2026-10-04', ws_in: 0, http: 35, est_requests: 35 }], 'req_meter still counts every call (what is billed), and the alarm is one more');
  assert.deepEqual(adminOf(ctx.storage.sql), [{ day: '2026-10-04', http: 32 }]);
  // a Meter on its own: http(true) is the admin's, http() the game's
  const sql = sqlOf(new DatabaseSync(':memory:')), m = new Meter(sql, () => at('2026-10-04T10:00:00Z'));
  m.http(true); m.http(); m.ws(); m.flush();
  assert.deepEqual(adminOf(sql), [{ day: '2026-10-04', http: 1 }]);
  assert.deepEqual(noRows(m.view().today), { day: '2026-10-04', wsIn: 1, http: 2, admin: 1, gameHttp: 1, alarms: 0, pageHttp: 1, alarmsSince: null, est: 3, gameEst: 2 });
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
  assert.deepEqual(noRows(m.view().today), { day: '2026-10-04', wsIn: 0, http: 3, admin: 3, gameHttp: 0, alarms: 0, pageHttp: 0, alarmsSince: null, est: 3, gameEst: 0 });
});

test('the meter on a world made by the live schema: four new tables, nothing else touched', () => {
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
  const ours = ['req_meter', 'req_meter_admin', 'req_meter_alarm', 'req_meter_rows'];
  assert.deepEqual(after.filter(o => !ours.includes(o.name)), before, 'every other table and index exactly as it was');
  assert.deepEqual(after.filter(o => ours.includes(o.name) && o.type === 'table').map(o => o.sql), [METER_SCHEMA, METER_ADMIN_SCHEMA, METER_ALARM_SCHEMA, METER_ROWS_SCHEMA].map(q => q.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TABLE')));
  // the test world already has the first table from before the admin column: the Meter adds only the others
  const db2 = new DatabaseSync(':memory:'), sql2 = sqlOf(db2);
  sql2.exec(METER_SCHEMA); sql2.exec("INSERT INTO req_meter (day, ws_in, http, est_requests) VALUES ('2026-10-03', 40, 10, 12)");
  const m2 = new Meter(sql2, () => at('2026-10-03T12:00:00Z'));
  // older code had counted 3 Oct already: alarms and rows are counted apart only from this wake (12:00)
  assert.deepEqual(m2.view().today, { day: '2026-10-03', wsIn: 40, http: 10, admin: 0, gameHttp: 10, alarms: 0, pageHttp: 10, alarmsSince: at('2026-10-03T12:00:00Z'), est: 12, gameEst: 12, rows: 0, rowsSince: at('2026-10-03T12:00:00Z') });
  assert.equal(rows(), rowsBefore);
});

test('every alarm is counted as a billed request, and an alarm that throws still counts', async () => {
  const db = new DatabaseSync(':memory:'), ctx = makeCtx(db);
  T = at('2026-10-05T10:00:00Z');
  const w = new TestWorld(ctx, ENV);
  for (let i = 0; i < 3; i++) { w.alarm(); T += WRITE_SOON; }
  assert.deepEqual(rowsOf(ctx.storage.sql), [{ day: '2026-10-05', ws_in: 0, http: 3, est_requests: 3 }]);
  const tick = w.room.tick; w.room.tick = () => { throw new Error('boom'); };
  const err = console.error; console.error = () => { };
  try { w.alarm(); } finally { console.error = err; w.room.tick = tick; }
  assert.equal(rowsOf(ctx.storage.sql)[0].http, 4);
  assert.deepEqual(adminOf(ctx.storage.sql), [], 'an alarm is the game\'s, not the admin page\'s');
  assert.deepEqual(alarmOf(ctx.storage.sql), [{ day: '2026-10-05', http: 4 }], 'and every one is counted apart in req_meter_alarm');
});

// The night of 3-4 Oct 2026 read 17,266 game calls and the meter could not say how many were the World's own alarms
// (measured afterwards: two idle knights on one map, 1,198 an hour). Alarms now have their own column.
const alarmOf = sql => sql.exec('SELECT day, http FROM req_meter_alarm ORDER BY day').toArray();
test('alarms in their own column: the pages\' calls and the World\'s alarms apart, a day before the column says so, a failed write waits', async () => {
  const db = new DatabaseSync(':memory:'), ctx = makeCtx(db);
  // a world from before the alarm column: yesterday's row has only the old columns
  ctx.storage.sql.exec(METER_SCHEMA); ctx.storage.sql.exec(METER_ADMIN_SCHEMA);
  ctx.storage.sql.exec("INSERT INTO req_meter (day, ws_in, http, est_requests) VALUES ('2026-10-04', 29118, 17270, 18726)");
  ctx.storage.sql.exec("INSERT INTO req_meter_admin (day, http) VALUES ('2026-10-04', 4)");
  T = at('2026-10-05T14:05:00Z');
  const w = new TestWorld(ctx, ENV);
  // (WRITE_SOON apart, so each is written before the nap below)
  await call(w, 'GET', '/api/status'); T += WRITE_SOON; await call(w, 'GET', '/api/status');
  for (let i = 0; i < 5; i++) { T += WRITE_SOON; w.alarm(); }
  T += WRITE_SOON; await call(w, 'GET', '/api/admin/online', undefined, ENV.ADMIN_KEY);
  T += 3600000;
  const w2 = new TestWorld(ctx, ENV);   // a nap: a second wake the same day does not move when the counting began
  w2.alarm();
  T += WRITE_SOON; const r = await call(w2, 'GET', '/api/admin/sim', undefined, ENV.ADMIN_KEY);
  const m = r.data.meter;
  // nothing of 5 Oct was counted before this code's first wake (14:05), so all of 5 Oct is counted apart
  assert.deepEqual(noRows(m.today), { day: '2026-10-05', wsIn: 0, http: 10, admin: 2, gameHttp: 8, alarms: 6, pageHttp: 2, alarmsSince: null, est: 10, gameEst: 8 });
  assert.deepEqual(m.days[1], { day: '2026-10-04', wsIn: 29118, http: 17270, admin: 4, gameHttp: 17266, alarms: null, pageHttp: null, alarmsSince: null, est: 18726, gameEst: 18722, rows: null, rowsSince: null }, 'the night before: alarms and rows not counted, never a false 0');
  // req_meter is unchanged in meaning: every call, alarms included (what Cloudflare bills)
  assert.deepEqual(rowsOf(ctx.storage.sql).find(x => x.day === '2026-10-05'), { day: '2026-10-05', ws_in: 0, http: 10, est_requests: 10 });
  // a failed alarm write keeps the alarm count for the next try; the call itself is written
  const base = sqlOf(new DatabaseSync(':memory:'));
  let fail = true;
  const sql = { exec(q, ...a) { if (fail && /INSERT INTO req_meter_alarm \(day, http, since\) VALUES \(\?, \?, \?\)/.test(q)) throw new Error('disk full'); return base.exec(q, ...a); } };
  let t6 = at('2026-10-06T01:00:00Z');
  const mm = new Meter(sql, () => t6);
  const err = console.error; console.error = () => { };
  try { mm.alarm(); t6 += WRITE_SOON; mm.alarm(); } finally { console.error = err; }
  assert.equal(rowsOf(base)[0].http, 2);
  assert.equal(mm.view().today.alarms, 2, 'still waiting');
  fail = false; t6 += WRITE_SOON; mm.alarm();
  assert.deepEqual(alarmOf(base), [{ day: '2026-10-06', http: 3 }]);
  assert.deepEqual(mm.view().today, { day: '2026-10-06', wsIn: 0, http: 3, admin: 0, gameHttp: 3, alarms: 3, pageHttp: 0, alarmsSince: null, est: 3, gameEst: 3, rows: 0, rowsSince: null });
  // old alarm rows go with the old days
  base.exec("INSERT INTO req_meter_alarm (day, http, since) VALUES (?, 7, 1)", dayOf(at('2026-10-06T00:00:00Z') - (KEEP_DAYS + 1) * 86400000));
  const m3 = new Meter(base, () => at('2026-10-07T01:00:00Z')); m3.alarm();
  assert.deepEqual(alarmOf(base).map(x => x.day), ['2026-10-06', '2026-10-07']);
});

// the shared world, Stage 1: the switch, the Atlas in welcome, the movement check's tables, all through the World
test('the World: welcome names the Atlas, the movement check counts into move_day and move_log, POST /api/admin/sim switches it and a nap keeps the switch', async () => {
  const db = new DatabaseSync(':memory:'), ctx = makeCtx(db);
  T = at('2026-10-03T15:00:00Z');
  const w = new TestWorld(ctx, ENV);
  let r = await call(w, 'POST', '/api/signup', { name: 'Cohen', pass: 'sword', invite: 'TEST-1234' });
  const tok = r.data.token;
  await w.fetch(new Request('http://world/ws?token=' + tok, { headers: { upgrade: 'websocket' } }));
  const sock = ctx.sockets[ctx.sockets.length - 1];
  r = await call(w, 'GET', '/api/admin/sim', undefined, ENV.ADMIN_KEY);
  const hash = r.data.atlas.hash;
  assert.match(hash, /^[0-9a-f]{16}$/);
  assert.ok(r.data.atlas.places > 30 && r.data.atlas.fixed > 1000);
  const KEEPERS = { deepholm: 'keeper', aerie: 'keeper' };
  assert.deepEqual(r.data.sim, { move: 'observe', master: 'on', maps: KEEPERS, held: {} });
  w.webSocketMessage(sock, JSON.stringify({ t: 'hello', v: 1, caps: [], atlas: hash }));
  assert.equal(sock.got.find(m => m.t === 'welcome').atlas, hash);
  // the Cave: a knight steps from its floor (5, 7) through its rock border at y 0 to off the map: one wall
  w.webSocketMessage(sock, JSON.stringify({ t: 'p', map: 'over', x: 5 * 48 + 24, y: 7 * 48 + 24, j: 0, spd: 175 }));
  T += 125; w.webSocketMessage(sock, JSON.stringify({ t: 'p', map: 'over', x: 5 * 48 + 24 + 20, y: 7 * 48 + 24, j: 0, spd: 175 }));
  T += 125; w.webSocketMessage(sock, JSON.stringify({ t: 'p', map: 'over', x: 5 * 48 + 24 + 20, y: 10, j: 0, spd: 175 }));
  r = await call(w, 'GET', '/api/admin/sim', undefined, ENV.ADMIN_KEY);
  assert.equal(r.data.move.mode, 'observe');
  assert.equal(r.data.move.today.checked, 2); assert.equal(r.data.move.today.wall, 1);
  assert.equal(r.data.move.recent[0].n, 'Cohen'); assert.equal(r.data.move.recent[0].kind, 'wall');
  assert.deepEqual(r.data.move.knights, [{ n: 'Cohen', map: 'over', atlas: 'same', caps: [] }]);
  // the switch: only {move: 'observe' | 'off'}
  for (const bad of [{}, { move: 'correct' }, { move: 'off', maps: {} }, { combat: 'on' }]) assert.equal((await call(w, 'POST', '/api/admin/sim', bad, ENV.ADMIN_KEY)).status, 400, JSON.stringify(bad));
  assert.equal((await call(w, 'POST', '/api/admin/sim', { move: 'off' })).status, 401);
  r = await call(w, 'POST', '/api/admin/sim', { move: 'off' }, ENV.ADMIN_KEY);
  assert.equal(r.status, 200); assert.equal(r.data.move.mode, 'off'); assert.deepEqual(r.data.sim, { move: 'off', master: 'on', maps: KEEPERS, held: {} });
  T += 125; w.webSocketMessage(sock, JSON.stringify({ t: 'p', map: 'over', x: -500, y: -500, j: 0, spd: 175 }));
  w.webSocketClose(sock, 1000, 'bye');
  const day = ctx.storage.sql.exec('SELECT checked, wall FROM move_day').toArray();
  assert.deepEqual(day.map(x => [x.checked, x.wall]), [[2, 1]], 'off: nothing more counted; a close writes');
  // a nap keeps the switch (settings 'sim'), keeping any key a later stage put beside it
  ctx.storage.sql.exec("UPDATE settings SET value = ? WHERE key = 'sim'", JSON.stringify({ move: 'off', later: 1 }));
  const w2 = new TestWorld(ctx, ENV);
  assert.equal(w2.room.sim.move, 'off');
  r = await call(w2, 'POST', '/api/admin/sim', { move: 'observe' }, ENV.ADMIN_KEY);
  assert.deepEqual(JSON.parse(ctx.storage.sql.exec("SELECT value FROM settings WHERE key = 'sim'").toArray()[0].value), { move: 'observe', later: 1, master: 'on', maps: KEEPERS, held: {} });
  r = await call(w2, 'GET', '/api/admin/export', undefined, ENV.ADMIN_KEY);
  assert.equal(r.data.move_day.length, 1); assert.equal(r.data.move_log.length, 1);
  // Stage 2: which maps the world runs itself. Only the plain instances with monsters (deepholm, aerie) may be 'world'; a flip is a sim_log row
  for (const bad of [{ maps: { nowhere: 'world' } }, { maps: { deepholm: 'yes' } }, { master: 'maybe' }, { maps: [] }]) assert.equal((await call(w2, 'POST', '/api/admin/sim', bad, ENV.ADMIN_KEY)).status, 400, JSON.stringify(bad));
  for (const later of ['over', 'spider_den', 'royalmine']) { const x = await call(w2, 'POST', '/api/admin/sim', { maps: { [later]: 'world' } }, ENV.ADMIN_KEY); assert.equal(x.status, 400); assert.equal(x.data.code, 'later'); }
  // the coal mine has no monsters: it cannot be switched to the world (the parent page lists it greyed, with the reason)
  { const x = await call(w2, 'POST', '/api/admin/sim', { maps: { coalmine: 'world' } }, ENV.ADMIN_KEY); assert.equal(x.status, 400); assert.equal(x.data.code, 'empty'); }
  r = await call(w2, 'POST', '/api/admin/sim', { maps: { deepholm: 'world' } }, ENV.ADMIN_KEY);
  assert.equal(r.status, 200); assert.deepEqual(r.data.sim.maps, { deepholm: 'world', aerie: 'keeper' });
  assert.deepEqual(r.data.world.empty, ['coalmine']); assert.equal(r.data.world.modes.coalmine, 'keeper');
  assert.equal(r.data.world.heapProbe, false, 'the World has no heap probe (workerd has none)');
  assert.equal(r.data.sim.move, 'observe', 'the movement check is left as it was');
  r = await call(w2, 'POST', '/api/admin/sim', { master: 'off' }, ENV.ADMIN_KEY);
  assert.equal(r.data.sim.master, 'off'); assert.equal(r.data.sim.maps.deepholm, 'world', 'master off keeps the maps as they were');
  r = await call(w2, 'GET', '/api/admin/export', undefined, ENV.ADMIN_KEY);
  assert.ok(Array.isArray(r.data.sim_log) && Array.isArray(r.data.realm_state), 'the backup has the two new tables');
});

// Rows written are a free-plan limit of their own (100,000 a day; a miss stops every save until 00:00 UTC), and each meter
// write is an upsert of up to three rows (req_meter, req_meter_admin, req_meter_alarm). Counted here as SQLite counts them
// (changes on every INSERT, UPDATE and DELETE the Meter runs), for an hour of each case.
test('rows written: the admin page in view, alarms twice a second, a call every 2 s, and everything at once, each an hour', () => {
  // as the World runs it: every statement through countRows, the meter counting its own rows too
  const hour = (label, step, each) => {
    const db = new DatabaseSync(':memory:'), base = sqlOf(db);
    let rows = 0, m = null;
    const sql = countRows({ exec(q, ...a) { const r = base.exec(q, ...a); if (/^\s*(INSERT|UPDATE|DELETE)/i.test(q)) rows += r.rowsWritten; return r; } }, n => m && m.rows(n));
    let T = at('2026-10-04T01:00:00Z');
    m = new Meter(sql, () => T);
    for (let t = 0; t < 3600000; t += step) { T = at('2026-10-04T01:00:00Z') + t; each(m, t); }
    T += step; m.flush();
    return rows;
  };
  const marks = 2, rowsLine = 2 + 3600000 / ROWS_EVERY;   // the day's two marks; the rows written, once a minute (and the last flush)
  // the admin page's 10 s refresh: online, chat, modlog, trades, one after the other (about 100 ms each): one write a refresh
  const admin = hour('admin', 100, (m, t) => { if (t % 10000 < 400) m.http(true); });
  assert.ok(admin <= marks + rowsLine + 2 * 361, 'the admin page in view: ' + admin + ' rows an hour (2 per refresh)');
  // an alarm every 500 ms (the 3-4 Oct worst case): one write per WRITE_SOON, two rows each
  const alarms = hour('alarms', 500, m => m.alarm());
  assert.ok(alarms <= marks + rowsLine + 2 * (1 + 3600000 / WRITE_SOON), 'alarms twice a second: ' + alarms + ' rows an hour');
  // the night of 3-4 Oct: a game call every 2 s
  const night = hour('night', 2000, m => m.http());
  assert.ok(night <= marks + rowsLine + 1 + 3600000 / WRITE_SOON, 'a call every 2 s: ' + night + ' rows an hour');
  // a knight playing alone: 9 socket messages a second (a presence and 8 snapshots) and nothing else: one write per WRITE_EVERY
  const play = hour('play', 1000, m => { for (let i = 0; i < 9; i++) m.ws(); });
  assert.ok(play <= marks + rowsLine + 1 + 3600000 / WRITE_EVERY, 'one knight playing: ' + play + ' rows an hour');
  // the ceiling: a game call, an admin call and an alarm every 100 ms, and 5 socket messages: 3 rows a write at most
  const all = hour('all', 100, m => { m.http(); m.http(true); m.alarm(); for (let i = 0; i < 5; i++) m.ws(); });
  assert.ok(all <= marks + rowsLine + 3 * (1 + 3600000 / WRITE_SOON + 36000 * 8 / WRITE_AT), 'everything at once: ' + all + ' rows an hour');
  // and the admin page open and in view all day (the contract's 34,560 calls): about 18,840 meter rows of the 100,000 (the rows-written line once a minute: 1,488 of them)
  assert.ok(admin * 24 <= 18900, 'the admin page all day: ' + admin * 24 + ' rows');
  if (process.env.METER_ROWS) console.log(JSON.stringify({ admin, alarms, night, play, all }));
});

// Rows written are the free-plan limit a playing game reaches first (100,000 a day; a miss stops every save): review round 2
// of the idle work measured about 1,680 rows an hour for one knight playing against about 420 billed requests, and nothing
// counted them. countRows hands every statement's rowsWritten to the meter, RETURNING ones included, and the view and the
// export carry them per day.
test('rows written: every statement the World runs is counted, its own meter writes included, and the view and the export carry them', async () => {
  const db = new DatabaseSync(':memory:');
  let truth = 0;
  // node's SQLite: `changes` of each write is what this stand-in calls rowsWritten (workerd also counts index entries)
  const base = sqlOf(db), ctx = makeCtx(db);
  ctx.storage.sql = { exec(q, ...a) { const r = base.exec(q, ...a); truth += r.rowsWritten || 0; if (/RETURNING/i.test(q)) truth += r.toArray().length; return r; } };
  T = at('2026-10-06T10:00:00Z');
  const w = new TestWorld(ctx, ENV);
  let r = await call(w, 'POST', '/api/signup', { name: 'Cohen', pass: 'sword', invite: 'TEST-1234' });
  const tok = r.data.token;
  for (let i = 0; i < 20; i++) { T += 15000; await call(w, 'PUT', '/api/save', { slot: { v: 2, n: i } }, tok); }
  T += WRITE_SOON; const up = await w.fetch(new Request('http://world/ws?token=' + tok, { headers: { upgrade: 'websocket' } }));
  const sock = ctx.sockets[ctx.sockets.length - 1];
  w.webSocketMessage(sock, JSON.stringify({ t: 'hello', v: 1 }));
  for (let i = 0; i < 100; i++) { T += 1000; w.webSocketMessage(sock, JSON.stringify({ t: 'p', map: 'over', region: 'Thistledown', x: 480 + i, y: 480, lv: 3 })); }
  w.webSocketClose(sock, 1000, 'bye');
  T += ROWS_EVERY; r = await call(w, 'GET', '/api/admin/sim', undefined, ENV.ADMIN_KEY);
  const t = r.data.meter.today;
  // the view: every row written so far but those of the meter's last write (they wait for the next), a few at most
  assert.ok(t.rows <= truth && t.rows >= truth - 4, `rows counted ${t.rows}, written ${truth}`);
  assert.equal(t.rowsSince, null, 'counted all day: nothing of 6 Oct was counted before');
  assert.equal(r.data.meter.freeRows, FREE_ROWS);
  // the export carries them (written once a minute at most, with a write)
  T += ROWS_EVERY; r = await call(w, 'GET', '/api/admin/export', undefined, ENV.ADMIN_KEY);
  const row = r.data.req_meter_rows.find(x => x.day === '2026-10-06');
  assert.ok(row.rows >= t.rows, 'written: ' + row.rows);
  // accounts.last_seen: at most once per SEEN_EVERY, not on every save (the 20 saves above were 15 s apart)
  const seenWrites = [];
  const ctx2 = makeCtx(new DatabaseSync(':memory:')), b2 = ctx2.storage.sql;
  ctx2.storage.sql = { exec(q, ...a) { if (/UPDATE accounts SET last_seen/.test(q)) seenWrites.push(T); return b2.exec(q, ...a); } };
  T = at('2026-10-06T12:00:00Z');
  const w2 = new TestWorld(ctx2, ENV);
  r = await call(w2, 'POST', '/api/signup', { name: 'Sam', pass: 'sword', invite: 'TEST-1234' });
  for (let i = 0; i < 40; i++) { T += 15000; await call(w2, 'PUT', '/api/save', { slot: { v: 2, n: i } }, r.data.token); }
  assert.ok(seenWrites.length <= 2, 'last_seen written ' + seenWrites.length + ' times in 10 minutes of saves');
  const acc = (await call(w2, 'GET', '/api/me', undefined, r.data.token)).data;
  assert.ok(acc, 'the session still works');
});

// A rollback, or a peer's deploy from a tree without the alarm and rows columns, then this code again: a day only older code
// counted has no mark, so it reads "not counted" (null), never a false 0; the day this code comes back is partial from then.
test('a day counted only by older code reads not counted, and the day this code comes back is partial from that moment', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  // older code counted the morning of 7 Oct (5 calls); this code from 15:00, its first wake ever
  sql.exec(METER_SCHEMA); db.prepare("INSERT INTO req_meter (day, ws_in, http, est_requests) VALUES ('2026-10-07', 0, 5, 5)").run();
  let T = at('2026-10-07T15:00:00Z');
  const m1 = new Meter(sql, () => T);
  for (let i = 0; i < 10; i++) { T += WRITE_SOON; m1.alarm(); }
  m1.flush();
  // older code all of 8 Oct and the morning of 9 Oct: req_meter only
  db.prepare("INSERT INTO req_meter (day, ws_in, http, est_requests) VALUES ('2026-10-08', 0, 1050, 1050)").run();
  db.prepare("INSERT INTO req_meter (day, ws_in, http, est_requests) VALUES ('2026-10-09', 0, 400, 400)").run();
  // this code again from 12:00 on 9 Oct
  T = at('2026-10-09T12:00:00Z');
  const m2 = new Meter(sql, () => T);
  for (let i = 0; i < 4; i++) { T += WRITE_SOON; m2.alarm(); }
  T += WRITE_SOON; m2.http(); T += WRITE_SOON; m2.http(); m2.flush();
  T = at('2026-10-10T08:00:00Z');
  const v = new Meter(sql, () => T).view();
  const d = day => v.days.find(x => x.day === day);
  assert.deepEqual([d('2026-10-09').alarms, d('2026-10-09').pageHttp, d('2026-10-09').alarmsSince], [4, 402, at('2026-10-09T12:00:00Z')], '9 Oct: alarms only since 12:00');
  assert.deepEqual([d('2026-10-08').alarms, d('2026-10-08').pageHttp, d('2026-10-08').alarmsSince, d('2026-10-08').rows], [null, null, null, null], '8 Oct: not counted, never a false 0');
  assert.deepEqual([d('2026-10-07').alarms, d('2026-10-07').alarmsSince], [10, at('2026-10-07T15:00:00Z')], '7 Oct: partial from 15:00');
  assert.deepEqual([v.today.day, v.today.alarms, v.today.alarmsSince, v.today.rows, v.today.rowsSince], ['2026-10-10', 0, null, 0, null], '10 Oct, before its first write: counted whole');
  void m1;
});

test('a nap after a burst of requests loses only the ones inside WRITE_SOON of the last write; the next count takes the rest', () => {
  const db = new DatabaseSync(':memory:'), sql = sqlOf(db);
  let T = at('2026-10-04T10:00:00Z');
  const m = new Meter(sql, () => T);
  m.http(true);                                   // the first count after a wake: written at once
  for (let i = 0; i < 3; i++) { T += 100; m.http(true); }   // the rest of the refresh waits
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-04', ws_in: 0, http: 1, est_requests: 1 }]);
  assert.equal(m.view().today.http, 4, 'the view counts what waits');
  T += 10000 - 300; m.http(true);                 // the next refresh writes all of the last one with its first call
  assert.deepEqual(rowsOf(sql), [{ day: '2026-10-04', ws_in: 0, http: 5, est_requests: 5 }]);
  assert.deepEqual(adminOf(sql), [{ day: '2026-10-04', http: 5 }]);
  T += WRITE_SOON; m.alarm();                     // nothing written for WRITE_SOON: at once
  assert.equal(rowsOf(sql)[0].http, 6);
});
