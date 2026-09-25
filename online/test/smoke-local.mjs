// Smoke test against a local world. It starts nothing itself: run, in online/,
//   CI=1 wrangler dev --port 8790
// with online/.dev.vars holding ADMIN_KEY=test-admin and INVITE_CODE=TEST-1234, then
//   node --test online/test/smoke-local.mjs            (SMOKE_BASE=http://127.0.0.1:<port> for another port)
// When nothing answers on 8790 every check is skipped, so `node --test online/test/` still passes without it.
// The last four tests are the admins and drop parties: roles, the pinned backup, moderation over real sockets,
// spawning through the keeper, and a party where two sockets light the same cracker.
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

// ---------------------------------------------------------------------------
// Admins and drop parties (docs/ONLINE.md, "Admins and drop parties")
// ---------------------------------------------------------------------------
const NAME_M = 'Smoke M ' + suffix.slice(0, 5), NAME_P = 'Smoke P ' + suffix.slice(0, 5);
let tokenM = null, tokenP = null;
const ALWAYS = 8640000000000000;
// nothing of type t arrives on s within ms
const none = async (s, t, ms = 500) => { await wait(ms); return !s.got.some(m => m.t === t); };
const hello = async token => { const s = open(token); await s.opened; s.send({ t: 'hello', v: 1 }); await s.next('welcome'); return s; };

test('roles: only the parent page makes an admin; me and the accounts say so; the log has it', { skip }, async () => {
  let r = await call('POST', '/api/signup', { name: NAME_M, pass: 'crown', invite: INVITE });
  assert.equal(r.status, 200); tokenM = r.data.token;
  r = await call('POST', '/api/signup', { name: NAME_P, pass: 'shield', invite: INVITE });
  assert.equal(r.status, 200); tokenP = r.data.token;
  r = await call('GET', '/api/me', undefined, tokenM);
  assert.equal(r.data.role, 'player');
  r = await admin('POST', '/api/admin/role', { name: NAME_M, role: 'boss' });
  assert.equal(r.status, 400); assert.equal(r.data.code, 'bad');
  r = await admin('POST', '/api/admin/role', { name: 'Nobody Here At All', role: 'admin' });
  assert.equal(r.status, 404);
  r = await call('POST', '/api/admin/role', { name: NAME_M, role: 'admin' }, tokenM);   // a knight's own token is not the admin key
  assert.equal(r.status, 401);
  r = await admin('POST', '/api/admin/role', { name: NAME_M.toLowerCase(), role: 'admin' });
  assert.deepEqual(r.data, { ok: true, role: 'admin' });
  r = await call('GET', '/api/me', undefined, tokenM);
  assert.equal(r.data.role, 'admin');
  r = await admin('GET', '/api/admin/accounts');
  const m = r.data.find(a => a.name === NAME_M), p = r.data.find(a => a.name === NAME_P);
  assert.equal(m.role, 'admin'); assert.equal(m.mutedUntil, 0); assert.equal(p.role, 'player'); assert.equal(p.mutedUntil, 0);
  r = await admin('GET', '/api/admin/modlog?limit=1');
  assert.deepEqual(r.data.map(x => [x.by, x.act, x.n, x.detail]), [['parent page', 'role', NAME_M, 'admin']]);
  assert.ok(r.data[0].at > 0);
});

test('the pinned backup: admins only; kept unless replaced; rolled back to and kept; restored and gone', { skip }, async () => {
  for (const [method, path] of [['GET', '/api/save/pin'], ['POST', '/api/save/pin'], ['POST', '/api/save/restore']]) {
    const r = await call(method, path, method === 'POST' && path.endsWith('pin') ? JSON.stringify({ v: 1 }) : undefined, tokenP);
    assert.equal(r.status, 403, method + ' ' + path); assert.equal(r.data.code, 'admin');
  }
  let r = await call('GET', '/api/save/pin', undefined, tokenM);
  assert.deepEqual(r.data, { at: null, bytes: 0 });
  r = await call('POST', '/api/save/restore', undefined, tokenM);
  assert.equal(r.status, 404); assert.equal(r.data.code, 'nopin');
  for (let v = 1; v <= 2; v++) await call('PUT', '/api/save', JSON.stringify({ v, knight: NAME_M }), tokenM);
  const before = JSON.stringify({ v: 'before unlock', knight: NAME_M });
  r = await call('POST', '/api/save/pin', before, tokenM);
  assert.equal(r.status, 200); assert.equal(r.data.pinned, true); const at1 = r.data.at;
  r = await call('POST', '/api/save/pin', JSON.stringify({ v: 'after unlock' }), tokenM);
  assert.deepEqual(r.data, { at: at1, pinned: false });   // the first pin is kept
  r = await call('POST', '/api/save/pin', 'not json', tokenM);
  assert.equal(r.status, 400);
  r = await call('POST', '/api/save/pin', JSON.stringify({ pad: 'x'.repeat(600 * 1024) }), tokenM);
  assert.equal(r.status, 413); assert.equal(r.data.code, 'full');
  r = await call('GET', '/api/save/pin', undefined, tokenM);
  assert.deepEqual(r.data, { at: at1, bytes: before.length });
  r = await call('POST', '/api/save/pin?replace=1', before, tokenM);
  assert.equal(r.data.pinned, true); assert.ok(r.data.at >= at1); const at2 = r.data.at;
  // three versions and the pin, never pushed out by saving
  for (let v = 3; v <= 6; v++) await call('PUT', '/api/save', JSON.stringify({ v, knight: NAME_M }), tokenM);
  r = await admin('GET', '/api/admin/saves?name=' + encodeURIComponent(NAME_M));
  assert.deepEqual(r.data.map(s => s.ver), ['pin', 6, 5, 4]);
  assert.deepEqual(r.data[0], { ver: 'pin', at: at2, bytes: before.length });
  // the parent page goes back to the pin: it is copied forward and kept
  r = await admin('POST', '/api/admin/rollback', { name: NAME_M, ver: 'pin' });
  assert.equal(r.status, 200); assert.equal(r.data.ver, 7);
  r = await call('GET', '/api/save', undefined, tokenM);
  assert.equal(r.data.save, before);
  r = await call('GET', '/api/save/pin', undefined, tokenM);
  assert.equal(r.data.at, at2);
  // the admin's own restore: a new version, and the pin is gone
  await call('PUT', '/api/save', JSON.stringify({ v: 'unlocked again' }), tokenM);
  r = await call('POST', '/api/save/restore', undefined, tokenM);
  assert.equal(r.status, 200); assert.equal(r.data.save, before); assert.equal(r.data.ver, 9); assert.ok(r.data.at > 0);
  r = await call('GET', '/api/save', undefined, tokenM);
  assert.equal(r.data.save, before);
  r = await call('GET', '/api/save/pin', undefined, tokenM);
  assert.deepEqual(r.data, { at: null, bytes: 0 });
  r = await admin('POST', '/api/admin/rollback', { name: NAME_M, ver: 'pin' });
  assert.equal(r.status, 404); assert.equal(r.data.code, 'nopin');
});

test('moderation over real sockets: roles on the wire, mute, kick (4005), ban (4003), unban, the parent page, the log', { skip }, async () => {
  const m = await hello(tokenM), p = await hello(tokenP);
  assert.equal(m.got.find(x => x.t === 'welcome').role, 'admin');
  assert.equal(p.got.find(x => x.t === 'welcome').role, 'player');
  const who = (await p.next('who')).list;
  assert.equal(who.find(k => k.n === NAME_M).role, 'admin');
  m.send({ t: 'p', map: 'over', x: 480, y: 480, lv: 9, region: 'Thistledown', role: 'player' });
  assert.equal((await p.next('p')).role, 'admin');   // the server's word, not the sender's
  // a player's admin message changes nothing
  p.send({ t: 'mute', n: NAME_M, span: '5m' });
  assert.equal((await p.next('error')).code, 'admin');
  // mute: the admin gets mod and a fresh modlist; the knight is told; its chat goes nowhere and is not logged
  m.send({ t: 'mute', n: NAME_P, span: '5m' });
  assert.deepEqual(await m.next('mod'), { t: 'mod', ok: true, act: 'mute', n: NAME_P, left: 300 });
  assert.deepEqual((await m.next('modlist')).muted.find(x => x.n === NAME_P), { n: NAME_P, left: 300 });
  assert.deepEqual(await p.next('muted'), { t: 'muted', left: 300 });
  p.forget('muted');
  p.send({ t: 'chat', text: 'can you hear me' });
  assert.ok((await p.next('muted')).left > 0);
  assert.ok(await none(m, 'chat'));
  let r = await admin('GET', '/api/admin/chat?limit=20');
  assert.ok(!r.data.some(c => c.n === NAME_P && c.text === 'can you hear me'));
  // unmute: chat flows again, with the role on it
  m.forget('mod'); m.send({ t: 'unmute', n: NAME_P });
  assert.equal((await m.next('mod')).act, 'unmute');
  await p.next('unmuted');
  await wait(1600);
  p.send({ t: 'chat', text: 'thanks' });
  const heard = await m.next('chat');
  assert.equal(heard.text, 'thanks'); assert.equal(heard.role, 'player');
  await p.next('chat');   // a knight hears its own line too: wait for it, then listen for MudGoll's
  p.forget('chat');
  m.send({ t: 'chat', text: 'welcome back' });
  const said = await p.next('chat');
  assert.equal(said.n, NAME_M); assert.equal(said.role, 'admin');
  // admins are untouchable, and so is yourself
  m.forget('mod'); m.send({ t: 'kick', n: NAME_M });
  assert.deepEqual(await m.next('mod'), { t: 'mod', ok: false, act: 'kick', n: NAME_M, code: 'self' });
  // the parent page mutes and unmutes: the knight hears it at once
  p.forget('muted'); p.forget('unmuted');
  r = await admin('POST', '/api/admin/mute', { name: NAME_P, span: 'always' });
  assert.deepEqual(r.data, { ok: true, mutedUntil: ALWAYS });
  assert.deepEqual(await p.next('muted'), { t: 'muted', left: -1 });
  r = await admin('GET', '/api/admin/accounts');
  assert.equal(r.data.find(a => a.name === NAME_P).mutedUntil, ALWAYS);
  r = await admin('POST', '/api/admin/mute', { name: NAME_P, span: 'off' });
  assert.deepEqual(r.data, { ok: true, mutedUntil: 0 });
  await p.next('unmuted');
  r = await admin('POST', '/api/admin/mute', { name: NAME_P, span: '2h' });
  assert.equal(r.status, 400);
  // kick: error kicked, close 4005; the session stays good
  p.forget('error'); m.forget('mod'); m.send({ t: 'kick', n: NAME_P });
  const kicked = await p.next('error');
  assert.equal(kicked.code, 'kicked'); assert.equal(kicked.text, 'An admin sent you out of the world. You can come back in.');
  await wait(300);
  assert.equal(p.closed && p.closed.code, 4005);
  assert.deepEqual(await m.next('mod'), { t: 'mod', ok: true, act: 'kick', n: NAME_P });
  const p2 = await hello(tokenP);
  // ban: error banned, close 4003, the login refused, every session gone
  m.forget('mod'); m.forget('modlist'); m.send({ t: 'ban', n: NAME_P });
  assert.equal((await p2.next('error')).code, 'banned');
  await wait(300);
  assert.equal(p2.closed && p2.closed.code, 4003);
  assert.deepEqual((await m.next('modlist')).banned.filter(b => b.n === NAME_P), [{ n: NAME_P }]);
  r = await call('POST', '/api/login', { name: NAME_P, pass: 'shield' });
  assert.equal(r.status, 403); assert.equal(r.data.code, 'banned');
  r = await call('GET', '/api/me', undefined, tokenP);
  assert.equal(r.status, 401);
  // unban: the knight logs in again
  m.forget('mod'); m.send({ t: 'unban', n: NAME_P });
  assert.equal((await m.next('mod')).ok, true);
  r = await call('POST', '/api/login', { name: NAME_P, pass: 'shield' });
  assert.equal(r.status, 200); tokenP = r.data.token;
  // spawning goes to the keeper of the admin's map (the admin was first on the overworld)
  m.send({ t: 'spawn', type: 'goblin', count: 3, x: 480, y: 480 });
  const sp = await m.next('spawn');
  assert.equal(sp.by, NAME_M); assert.equal(sp.count, 3); assert.match(sp.sid, /^[0-9a-z]+$/);
  // every action is in the log, newest first
  r = await admin('GET', '/api/admin/modlog?limit=8');
  assert.deepEqual(r.data.map(x => [x.by, x.act, x.n, x.detail]), [
    [NAME_M, 'unban', NAME_P, ''], [NAME_M, 'ban', NAME_P, ''], [NAME_M, 'kick', NAME_P, ''],
    ['parent page', 'unmute', NAME_P, ''], ['parent page', 'mute', NAME_P, 'always'],
    [NAME_M, 'unmute', NAME_P, ''], [NAME_M, 'mute', NAME_P, '5m'], ['parent page', 'role', NAME_M, 'admin'],
  ]);
  m.close();
  await wait(300);
});

test('a drop party over real sockets: two knights light the same cracker, one boom and one taken; a prize after reconnect', { skip }, async () => {
  const m = await hello(tokenM), p = await hello(tokenP);
  // MudGoll's knight on tile (10, 10); the other two tiles south, beside the first cracker (tile 10, 12)
  m.send({ t: 'p', map: 'over', x: 10 * 48 + 24, y: 10 * 48 + 24, region: 'Thistledown' });
  p.send({ t: 'p', map: 'over', x: 10 * 48 + 24, y: 12 * 48 + 24, region: 'Thistledown' });
  await m.next('p'); await p.next('p');
  p.send({ t: 'party', spots: [[10, 12], [11, 12], [12, 12], [10, 13], [11, 13]], table: [{ id: 'coins', min: 5, max: 5, w: 1 }], hat: 10000 });
  assert.equal((await p.next('error')).code, 'admin');
  m.send({ t: 'party', spots: [[10, 12], [11, 12], [12, 12], [10, 13], [11, 13]], table: [{ id: 'coins', min: 5, max: 5, w: 1 }], hat: 5 });
  assert.deepEqual(await m.next('party_no'), { t: 'party_no', code: 'bad' });
  m.send({ t: 'party', spots: [[10, 12], [11, 12], [12, 12], [10, 13], [11, 13]], table: [{ id: 'coins', min: 5, max: 5, w: 1 }], hat: 10000 });
  const cm = await m.next('crackers'), cp = await p.next('crackers');
  assert.deepEqual(cp, cm);
  assert.equal(cm.by, NAME_M); assert.equal(cm.map, 'over'); assert.equal(cm.list.length, 5); assert.ok(cm.left > 890000 && cm.left <= 900000);
  const pid = cm.pid, id = 'p' + pid + '.0';
  assert.deepEqual(cm.list[0], [id, 10, 12]);
  assert.deepEqual(await p.next('announce'), { t: 'announce', kind: 'party', n: NAME_M, region: 'Thistledown', map: 'over', count: 5 });
  // both light cracker 0 at the same moment: exactly one boom reaches each knight, the other lighter hears taken
  m.send({ t: 'light', id }); p.send({ t: 'light', id });
  const bm = await m.next('boom'), bp = await p.next('boom');
  assert.deepEqual(bm, bp);
  assert.equal(bm.id, id); assert.deepEqual(bm.reward, { id: 'coins', qty: 5 }); assert.ok(bm.fuse >= 1000 && bm.fuse <= 2500);
  const winner = bm.n === NAME_M ? m : p, loser = bm.n === NAME_M ? p : m, winnerToken = bm.n === NAME_M ? tokenM : tokenP;
  assert.deepEqual(await loser.next('light_no'), { t: 'light_no', id, code: 'taken' });
  await wait(300);
  assert.equal(m.got.filter(x => x.t === 'boom').length, 1); assert.equal(p.got.filter(x => x.t === 'boom').length, 1);
  assert.ok(!winner.got.some(x => x.t === 'light_no'));
  // too far: cracker 4 is tile (11, 13); MudGoll stands 3+ tiles away
  m.send({ t: 'p', map: 'over', x: 10 * 48 + 24, y: 9 * 48 + 24 });   // the light below comes after it on the same socket
  m.forget('light_no');
  m.send({ t: 'light', id: 'p' + pid + '.4', x: 11 * 48 + 24, y: 13 * 48 + 24 });
  assert.deepEqual(await m.next('light_no'), { t: 'light_no', id: 'p' + pid + '.4', code: 'far' });
  // the winner's game drops before the fuse ends: no claim was sent, so the prize comes after the next welcome
  winner.close();
  await wait(300);
  const again = open(winnerToken); await again.opened; again.send({ t: 'hello', v: 1 });
  await again.next('welcome');
  assert.deepEqual(await again.next('prize'), { t: 'prize', id, reward: { id: 'coins', qty: 5 } });
  assert.equal((await again.next('crackers')).list.length, 4);
  const order = again.got.map(x => x.t).filter(t => ['welcome', 'crackers', 'prize'].includes(t));
  assert.deepEqual(order, ['welcome', 'crackers', 'prize']);
  // claimed: never offered again
  again.send({ t: 'claim', id });
  await wait(300);
  again.close();
  await wait(300);
  const third = open(winnerToken); await third.opened; third.send({ t: 'hello', v: 1 });
  await third.next('welcome');
  assert.ok(await none(third, 'prize'));
  // the party is in the log; the admin ends it and everyone on the map hears
  let r = await admin('GET', '/api/admin/modlog?limit=20');
  const row = r.data.find(x => x.act === 'party' && x.by === NAME_M);
  assert.ok(row); assert.equal(row.n, 'over'); assert.equal(row.detail, '5 crackers in Thistledown, party hats 1 in 10,000');
  // MudGoll's socket now is m, or third when m was the winner; the other knight is p, or third when p was
  const mud = winner === m ? third : m, other = winner === m ? p : third;
  mud.send({ t: 'party_end' });
  assert.deepEqual(await other.next('party_end'), { t: 'party_end', pid, map: 'over' });
  for (const s of [m, p, third]) try { s.close(); } catch (e) { }
  await wait(300);
});

test('the backup export (taken before every schema-changing deploy) needs the key and carries every table but sessions, the admins\' four too', { skip }, async () => {
  let r = await call('GET', '/api/admin/export');
  assert.equal(r.status, 401);
  r = await admin('GET', '/api/admin/export');
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.data).filter(k => k !== 'at'), ['accounts', 'saves', 'chat', 'settings', 'mod_log', 'save_pins', 'parties', 'crackers']);
  const mud = r.data.accounts.find(a => a.name === NAME_M);
  assert.ok(mud); assert.equal(mud.role, 'admin'); assert.equal(typeof mud.muted_until, 'number');
  assert.ok(r.data.mod_log.some(x => x.act === 'party' && x.by === NAME_M));
  const party = r.data.parties.find(p => p.by === NAME_M);
  assert.ok(party); assert.equal(party.count, 5); assert.equal(party.ended, 1);
  const crackers = r.data.crackers.filter(c => c.party === party.id);
  assert.equal(crackers.length, 5);
  assert.equal(crackers.filter(c => c.lit_by !== null).length, 1);
  assert.equal(crackers.find(c => c.k === 0).claimed, 1);
  assert.deepEqual(JSON.parse(crackers.find(c => c.k === 0).reward), { id: 'coins', qty: 5 });
});
