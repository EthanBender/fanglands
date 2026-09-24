// Smoke test against a local world. It starts nothing itself: run, in online/,
//   CI=1 wrangler dev --port 8790
// with online/.dev.vars holding ADMIN_KEY=test-admin and INVITE_CODE=TEST-1234, then
//   node --test online/test/smoke-local.mjs
// When nothing answers on 8790 every check is skipped, so `node --test online/test/` still passes without it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:8790';
const WS = BASE.replace(/^http/, 'ws');
const ADMIN = process.env.SMOKE_ADMIN_KEY || 'test-admin';
const INVITE = process.env.SMOKE_INVITE || 'TEST-1234';

let up = false;
try { const r = await fetch(BASE + '/api/status'); up = r.ok && (await r.json()).ok === true; } catch (e) { }
const skip = up ? false : 'no world on ' + BASE + ' (start wrangler dev --port 8790 in online/)';

// a fresh pair of names each run: the local world keeps its state between runs
const suffix = Math.random().toString(16).slice(2, 8);
const NAME_A = 'Smoke A ' + suffix.slice(0, 5), NAME_B = 'Smoke B ' + suffix.slice(0, 5);

async function call(method, path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  let data = null; try { data = await r.json(); } catch (e) { }
  return { status: r.status, data };
}
const admin = (method, path, body) => call(method, path, body, ADMIN);

// A socket that collects messages and lets a test wait for one of a type.
function open(token) {
  const ws = new WebSocket(WS + '/ws?token=' + encodeURIComponent(token));
  const s = { ws, got: [], closed: null, errored: false, waiters: [] };
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); s.got.push(m); for (const w of s.waiters.slice()) if (w.t === m.t) { s.waiters.splice(s.waiters.indexOf(w), 1); w.ok(m); } });
  ws.addEventListener('close', ev => { s.closed = { code: ev.code, reason: ev.reason }; });
  ws.addEventListener('error', () => { s.errored = true; });
  s.opened = new Promise((ok, no) => { ws.addEventListener('open', ok); ws.addEventListener('error', () => no(new Error('socket error'))); });
  s.send = m => ws.send(JSON.stringify(m));
  s.next = (t, ms = 3000) => { const had = s.got.find(m => m.t === t); if (had) return Promise.resolve(had); return new Promise((ok, no) => { const w = { t, ok }; s.waiters.push(w); setTimeout(() => { s.waiters.splice(s.waiters.indexOf(w), 1); no(new Error('no ' + t + ' within ' + ms + ' ms; got ' + JSON.stringify(s.got.map(m => m.t)))); }, ms); }); };
  s.forget = t => { s.got = s.got.filter(m => m.t !== t); };
  s.close = () => ws.close(1000, 'done');
  return s;
}
const wait = ms => new Promise(ok => setTimeout(ok, ms));

let tokenA = null, tokenB = null;

test('status answers without a login', { skip }, async () => {
  const r = await call('GET', '/api/status');
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.ok(Array.isArray(r.data.names));
});

test('signup needs the invite code, a clean name and a secret word', { skip }, async () => {
  let r = await call('POST', '/api/signup', { name: NAME_A, pass: 'sword', invite: 'WRONG' });
  assert.equal(r.status, 403); assert.equal(r.data.code, 'invite');
  r = await call('POST', '/api/signup', { name: 'Sh1thead', pass: 'sword', invite: INVITE });
  assert.equal(r.status, 400); assert.equal(r.data.code, 'name');
  r = await call('POST', '/api/signup', { name: NAME_A, pass: 'abc', invite: INVITE });
  assert.equal(r.status, 400); assert.equal(r.data.code, 'pass');
  r = await call('POST', '/api/signup', { name: NAME_A, pass: 'sword', invite: ' ' + INVITE.toLowerCase() + ' ' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.name, NAME_A);
  assert.match(r.data.token, /^[0-9a-f]{64}$/);
  tokenA = r.data.token;
  r = await call('POST', '/api/signup', { name: NAME_A.toUpperCase(), pass: 'sword', invite: INVITE });
  assert.equal(r.status, 409); assert.equal(r.data.code, 'taken');
  r = await call('POST', '/api/signup', { name: NAME_B, pass: 'shield', invite: INVITE });
  assert.equal(r.status, 200);
  tokenB = r.data.token;
});

test('login: wrong secret word, right secret word, case does not matter', { skip }, async () => {
  let r = await call('POST', '/api/login', { name: NAME_A, pass: 'nope' });
  assert.equal(r.status, 401); assert.equal(r.data.code, 'pass'); assert.equal(r.data.left, 4);
  r = await call('POST', '/api/login', { name: NAME_A.toLowerCase(), pass: 'sword' });
  assert.equal(r.status, 200); assert.equal(r.data.name, NAME_A);
  tokenA = r.data.token;
  r = await call('POST', '/api/login', { name: 'Nobody Here', pass: 'sword' });
  assert.equal(r.status, 404); assert.equal(r.data.code, 'unknown');
});

test('me and the save: three versions kept, the newest comes back verbatim', { skip }, async () => {
  let r = await call('GET', '/api/me', undefined, tokenA);
  assert.equal(r.status, 200); assert.equal(r.data.name, NAME_A); assert.equal(r.data.saveAt, null); assert.equal(r.data.online, false);
  r = await call('GET', '/api/save', undefined, tokenA);
  assert.deepEqual(r.data, { save: null, at: null });
  for (let v = 1; v <= 4; v++) { r = await call('PUT', '/api/save', JSON.stringify({ v, knight: NAME_A }), tokenA); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.ok(r.data.at > 0); }
  r = await call('GET', '/api/save', undefined, tokenA);
  assert.equal(r.data.save, JSON.stringify({ v: 4, knight: NAME_A }));
  r = await call('PUT', '/api/save', 'not json at all', tokenA);
  assert.equal(r.status, 400);
  r = await call('PUT', '/api/save', JSON.stringify({ pad: 'x'.repeat(600 * 1024) }), tokenA);
  assert.equal(r.status, 413); assert.equal(r.data.code, 'full');
  r = await call('GET', '/api/save', undefined, 'deadbeef');
  assert.equal(r.status, 401); assert.equal(r.data.code, 'auth');
  r = await admin('GET', '/api/admin/saves?name=' + encodeURIComponent(NAME_A));
  assert.deepEqual(r.data.map(s => s.ver), [4, 3, 2]);
  r = await admin('POST', '/api/admin/rollback', { name: NAME_A, ver: 2 });
  assert.equal(r.status, 200); assert.equal(r.data.ver, 5);
  r = await call('GET', '/api/save', undefined, tokenA);
  assert.equal(r.data.save, JSON.stringify({ v: 2, knight: NAME_A }));
});

test('the socket: a bad token is refused, a good one gets welcome; two knights see each other; chat is filtered and logged', { skip }, async () => {
  const bad = open('0000');
  await Promise.race([bad.opened.catch(() => { }), wait(2000)]);
  await wait(200);
  assert.ok(bad.errored || bad.closed, 'a bad token should not open');

  const a = open(tokenA), b = open(tokenB);
  await a.opened; await b.opened;
  a.send({ t: 'hello', v: 1 }); b.send({ t: 'hello', v: 1 });
  const wa = await a.next('welcome'), wb = await b.next('welcome');
  assert.equal(wa.me, NAME_A); assert.equal(wb.me, NAME_B);
  assert.equal(wa.keeper, NAME_A); assert.equal(wb.keeper, NAME_A);   // the first in keeps the overworld

  let r = await call('GET', '/api/status');
  assert.ok(r.data.names.includes(NAME_A) && r.data.names.includes(NAME_B), JSON.stringify(r.data));
  r = await call('GET', '/api/me', undefined, tokenA);
  assert.equal(r.data.online, true);

  a.send({ t: 'p', map: 'over', x: 640, y: 480, lv: 7, region: 'Hollowford' });
  const p = await b.next('p');
  assert.equal(p.n, NAME_A); assert.equal(p.x, 640); assert.equal(p.lv, 7);
  await a.next('who');

  b.send({ t: 'chat', text: 'hello   friend, what the fuck' });
  const ca = await a.next('chat'), cb = await b.next('chat');
  assert.equal(ca.n, NAME_B); assert.equal(ca.text, 'hello friend, what the ****'); assert.equal(cb.text, ca.text);
  r = await admin('GET', '/api/admin/chat?limit=50');
  assert.equal(r.status, 200);
  const line = r.data[r.data.length - 1];
  assert.equal(line.n, NAME_B); assert.equal(line.text, 'hello friend, what the ****');

  // hit from the non-keeper reaches the keeper with the name on it
  b.send({ t: 'hit', nid: 's1', dmg: 3, knock: 1, bomb: false });
  const h = await a.next('hit');
  assert.equal(h.n, NAME_B); assert.equal(h.nid, 's1');

  // ping is answered without waking the world
  a.forget('pong'); a.send({ t: 'ping' });
  await a.next('pong');

  // the roster from the admin side
  r = await admin('GET', '/api/admin/online');
  const me = r.data.find(k => k.n === NAME_A);
  assert.ok(me); assert.equal(me.map, 'over'); assert.equal(me.region, 'Hollowford'); assert.equal(me.lv, 7);

  // a second login for A closes the first socket
  const a2 = open(tokenA);
  await a2.opened;
  await wait(300);
  assert.ok(a.closed, 'the first socket should be closed');
  assert.equal(a.closed.code, 4000);
  a2.send({ t: 'hello', v: 1 });
  await a2.next('welcome');
  const left = await b.next('left').catch(() => null);   // A leaves and comes back; B may or may not see the gap
  void left;
  a2.close(); b.close();
  await wait(300);
  r = await call('GET', '/api/status');
  assert.ok(!r.data.names.includes(NAME_A) && !r.data.names.includes(NAME_B), JSON.stringify(r.data));
});

test('admin routes: key required; accounts, invite, ban and unban, reset', { skip }, async () => {
  let r = await call('GET', '/api/admin/accounts');
  assert.equal(r.status, 401);
  r = await call('GET', '/api/admin/accounts', undefined, 'wrong-key');
  assert.equal(r.status, 401);
  r = await admin('GET', '/api/admin/accounts');
  assert.equal(r.status, 200);
  const acc = r.data.find(a => a.name === NAME_A);
  assert.ok(acc); assert.equal(acc.banned, false); assert.ok(acc.saveAt > 0); assert.ok(acc.created > 0);

  r = await admin('GET', '/api/admin/invite');
  assert.equal(r.data.invite, INVITE);
  r = await admin('POST', '/api/admin/invite', { invite: INVITE + '-X' });
  assert.equal(r.status, 200);
  r = await call('POST', '/api/signup', { name: 'Smoke C ' + suffix.slice(0, 5), pass: 'sword', invite: INVITE });
  assert.equal(r.status, 403);
  r = await admin('POST', '/api/admin/invite', { invite: INVITE });
  assert.equal(r.status, 200);

  r = await admin('POST', '/api/admin/ban', { name: NAME_B, banned: true });
  assert.equal(r.status, 200);
  r = await call('POST', '/api/login', { name: NAME_B, pass: 'shield' });
  assert.equal(r.status, 403); assert.equal(r.data.code, 'banned');
  r = await call('GET', '/api/me', undefined, tokenB);
  assert.equal(r.status, 401);   // the banned knight's sessions were dropped
  r = await admin('POST', '/api/admin/ban', { name: NAME_B, banned: false });
  r = await call('POST', '/api/login', { name: NAME_B, pass: 'shield' });
  assert.equal(r.status, 200);

  r = await admin('POST', '/api/admin/reset', { name: NAME_A, pass: 'newword' });
  assert.equal(r.status, 200);
  r = await call('POST', '/api/login', { name: NAME_A, pass: 'sword' });
  assert.equal(r.status, 401);
  r = await call('POST', '/api/login', { name: NAME_A, pass: 'newword' });
  assert.equal(r.status, 200);
  tokenA = r.data.token;
  r = await call('POST', '/api/logout', undefined, tokenA);
  assert.equal(r.status, 200);
  r = await call('GET', '/api/me', undefined, tokenA);
  assert.equal(r.status, 401);
});

test('five wrong secret words lock the name for a minute', { skip }, async () => {
  const name = 'Smoke L ' + suffix.slice(0, 5);
  let r = await call('POST', '/api/signup', { name, pass: 'sword', invite: INVITE });
  assert.equal(r.status, 200);
  for (let i = 1; i <= 4; i++) { r = await call('POST', '/api/login', { name, pass: 'x' + i }); assert.equal(r.status, 401); }
  r = await call('POST', '/api/login', { name, pass: 'x5' });
  assert.equal(r.status, 429); assert.equal(r.data.code, 'wait');
  r = await call('POST', '/api/login', { name, pass: 'sword' });
  assert.equal(r.status, 429); assert.equal(r.data.code, 'wait'); assert.ok(r.data.wait <= 60);
});

test('the admin page and the game are served as assets; CORS is open to the old address only', { skip }, async () => {
  let r = await fetch(BASE + '/admin');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Fanglands — the world/);
  r = await fetch(BASE + '/api/status', { headers: { origin: 'https://ethanbender.github.io' } });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://ethanbender.github.io');
  r = await fetch(BASE + '/api/status', { method: 'OPTIONS', headers: { origin: 'https://ethanbender.github.io', 'access-control-request-method': 'PUT' } });
  assert.equal(r.status, 204);
  assert.match(r.headers.get('access-control-allow-headers') || '', /authorization/);
  r = await fetch(BASE + '/api/status', { headers: { origin: 'https://evil.example' } });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  r = await fetch(BASE + '/api/nothing');
  assert.equal(r.status, 404);
});
