// The teacher view's test kit (docs/ONLINE.md, "The teacher view"): the whole World on node's SQLite standing in for the
// Durable Object's, fake sockets, a clock the test moves, and the calls a teacher's page, a kid's game and the parent page
// make. No tests in here: teachers.test.mjs and watch.test.mjs use it.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

export function sqlOf(db, counter) {
  return {
    exec(q, ...args) {
      const stmt = db.prepare(q);
      const columnNames = stmt.columns().map(c => c.name);
      let rows = [], rowsWritten = 0;
      if (columnNames.length) rows = stmt.all(...args).map(r => Object.assign({}, r));
      else rowsWritten = stmt.run(...args).changes;
      // a write is any statement that is not a plain read (RETURNING writes too)
      if (counter && !/^\s*(SELECT|PRAGMA)\b/i.test(q)) counter.writes++;
      if (counter) counter.all++;
      return { toArray: () => rows.slice(), one: () => rows[0], rowsWritten, columnNames, [Symbol.iterator]: () => rows[Symbol.iterator]() };
    },
  };
}

// the Cloudflare globals the World touches, as small fakes
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
export const fakeWs = () => {
  const s = { got: [], raw: [], closed: null, att: null, send(str) { s.raw.push(str); s.got.push(JSON.parse(str)); }, close(code, reason) { if (!s.closed) s.closed = { code, reason }; }, serializeAttachment(st) { s.att = JSON.parse(JSON.stringify(st)); }, deserializeAttachment() { return s.att; } };
  s.last = t => s.got.filter(m => m.t === t).pop();
  s.all = t => s.got.filter(m => m.t === t);
  return s;
};
globalThis.WebSocketPair = class { constructor() { this[0] = fakeWs(); this[1] = fakeWs(); } };
const { World } = await import('../src/world.js');
export { World };

export const clock = { t: Date.UTC(2026, 9, 6, 14, 0, 0) };   // 10:00 am in Toronto on Tue 6 Oct 2026
export class TestWorld extends World {
  now() { return clock.t; }
  upgraded(client) { return { status: 101, client }; }
}
export function makeCtx(db, opts = {}) {
  const sockets = [], alarms = [];
  return {
    db: db || new DatabaseSync(':memory:'),
    get storage() { return this._st || (this._st = { sql: sqlOf(this.db, opts.counter), setAlarm: async ms => { alarms.push(ms); } }); },
    setWebSocketAutoResponse() { }, acceptWebSocket(ws) { sockets.push(ws); }, getWebSockets: () => sockets.filter(s => !s.closed), sockets, alarms,
  };
}
export const ENV = { ADMIN_KEY: 'test-admin', INVITE_CODE: 'TEST-1234' };
export const DOOR = { 'x-fanglands-door': 'teacher' };

export async function call(w, method, path, body, o = {}) {
  const headers = Object.assign({ 'content-type': 'application/json' }, o.headers || {});
  if (o.token) headers.authorization = 'Bearer ' + o.token;
  if (o.door) Object.assign(headers, DOOR);
  if (o.ip) headers['cf-connecting-ip'] = o.ip;
  const res = await w.fetch(new Request('http://world' + path, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }));
  let data = null; try { data = res.status === 101 ? null : await res.json(); } catch (e) { }
  return { status: res.status, data, res };
}
export const parent = (w, method, path, body) => call(w, method, path, body, { token: ENV.ADMIN_KEY });
export async function signup(w, name, pass = 'sword') { const r = await call(w, 'POST', '/api/signup', { name, pass, invite: 'TEST-1234' }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.token; }
// a kid's game: the socket the way /ws opens it, then hello and one presence
export async function online(w, token, p = {}) {
  const r = await w.fetch(new Request('http://world/ws?token=' + token, { headers: { upgrade: 'websocket' } }));
  assert.equal(r.status, 101, 'ws ' + r.status);
  const server = w.ctx.sockets[w.ctx.sockets.length - 1];
  w.webSocketMessage(server, JSON.stringify({ t: 'hello', v: 1 }));
  if (p !== null) w.webSocketMessage(server, JSON.stringify(Object.assign({ t: 'p', map: 'over', region: 'Thistledown', x: 6000, y: 3700, lv: 12 }, p)));
  return server;
}
export const say = (w, s, m) => w.webSocketMessage(s, typeof m === 'string' ? m : JSON.stringify(m));
// the parent page makes a teacher
export async function addTeacher(w, name = 'Mrs Smith', pass = 'maple-river-lantern-42') {
  const r = await parent(w, 'POST', '/api/admin/teachers', { name, pass });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return { id: r.data.id, name, pass };
}
export async function teacherLogin(w, name, pass, ip) {
  const r = await call(w, 'POST', '/api/teacher/login', { name, pass }, { door: true, ip });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}
export async function ticket(w, token) { const r = await call(w, 'POST', '/api/teacher/ticket', undefined, { door: true, token }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.ticket; }
// the watch screen: sign in (or a token), a ticket, the upgrade
export async function screen(w, token) {
  const t = await ticket(w, token);
  const r = await w.fetch(new Request('http://world/api/teacher/ws?ticket=' + t, { headers: Object.assign({ upgrade: 'websocket' }, DOOR) }));
  assert.equal(r.status, 101, 'teacher ws ' + r.status);
  return w.ctx.sockets[w.ctx.sockets.length - 1];
}
let reqN = 0;
export const act = (w, s, m) => { const req = ++reqN; w.webSocketMessage(s, JSON.stringify(Object.assign({ req }, m))); return s.got.filter(x => (x.t === 'w_ok' || x.t === 'w_no') && x.req === req).pop() || null; };

// every row of every table (the meter's counters aside: they count requests, which is their job), as one string
export function snapshot(db, skip = ['req_meter', 'req_meter_admin', 'req_meter_alarm']) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name).filter(n => !skip.includes(n));
  const out = {};
  for (const t of tables) out[t] = db.prepare('SELECT * FROM ' + t).all();
  return JSON.stringify(out);
}
export function newWorld(opts = {}) {
  const ctx = makeCtx(opts.db, opts);
  const w = new TestWorld(ctx, opts.env || ENV);
  return { ctx, w, db: ctx.db };
}
