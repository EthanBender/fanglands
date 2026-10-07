// The teacher view's sign-in, tickets and the owner's calls (docs/ONLINE.md, "The teacher view"). The whole World on node's
// SQLite (teacher-kit.mjs). Round 2: ONE sign-in. A teacher signs in at POST /api/login (the game's own card) with teacherOk: 1;
// there is no teacher address and no door. The first five tests are the NEGATIVE ones: a teacher's credentials reach nothing
// but the teacher view, and a teacher socket is never a knight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as K from './teacher-kit.mjs';
import { dayEnd, dayStart, TEACHER_LOCK_MS, TICKET_MS, SESSION_MAX_MS, NAME_FAILS, ADDRESS_WINDOW_MS } from '../src/teachers.js';

const { clock, call, parent } = K;
const T0 = Date.UTC(2026, 9, 6, 14, 0, 0);
const src = f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const DOC = fs.readFileSync(new URL('../../docs/ONLINE.md', import.meta.url), 'utf8');
// a sign-in on the game's card: the teacher half answers only for a card that sent teacherOk: 1
// (tab: the random id the card makes once per page; every test page here is its own tab unless it says otherwise)
const tlogin = (W, name, pass, ip, ok = true, tab = 'a1b2c3d4e5f60718') => call(W.w, 'POST', '/api/login', ok ? { name, pass, teacherOk: 1, tab } : { name, pass }, { ip });

async function world() {
  clock.t = T0;
  const W = K.newWorld();
  const tok = {};
  for (const n of ['MudGoll', 'Sam', 'Leo']) { tok[n] = await K.signup(W.w, n); clock.t += 1000; }
  await parent(W.w, 'POST', '/api/admin/role', { name: 'MudGoll', role: 'admin' });
  const T = await K.addTeacher(W.w);
  const lg = await K.teacherLogin(W.w, T.name, T.pass);
  return Object.assign(W, { tok, T, token: lg.token, lg });
}

// every admin call: each /api/admin/... row of the contract, and every `call === '...'` branch the World's admin() reaches
// (world.js, backup.js, teachers.js), each tried as GET and as POST, so a new admin call is covered by itself
function adminRoutes() {
  const names = new Set();
  for (const line of DOC.split('\n')) { if (!line.startsWith('|')) continue; for (const m of line.matchAll(/`(?:GET|POST|PUT) \/api\/admin\/([a-z0-9/_-]+)/g)) names.add(m[1]); }
  const fromDoc = names.size;
  const body = src('world.js'); const adm = body.slice(body.indexOf('async admin('), body.indexOf('\n  account(name)'));
  for (const f of [adm, src('backup.js'), src('teachers.js')]) for (const m of f.matchAll(/call === '([a-z0-9/_-]+)'/g)) names.add(m[1]);
  return { list: Array.from(names).sort(), fromDoc };
}

test('1. every admin route refuses a teacher token, a teacher ticket and a token in the query, and changes no row', async () => {
  const W = await world();
  const tk = await K.ticket(W.w, W.token);
  const { list, fromDoc } = adminRoutes();
  assert.ok(fromDoc >= 24 && list.length >= 25 && list.includes('teachers/undo') && list.includes('sim') && list.includes('export'), JSON.stringify(list));
  const before = K.snapshot(W.db);
  let tried = 0;
  for (const name of list) for (const method of ['GET', 'POST']) {
    const body = method === 'POST' ? { name: 'Sam', pass: 'newpassword1', id: 1, on: false, act: 1, invite: 'HACKED', role: 'admin', span: '1h', banned: true, bookmark: 'x', ver: 1, to: 'Sammy', move: 'off' } : undefined;
    for (const [how, o] of [['token', { token: W.token }], ['ticket', { token: tk }], ['query', {}]]) {
      const path = '/api/admin/' + name + (how === 'query' ? '?token=' + W.token + '&key=' + W.token : '');
      const r = await call(W.w, method, path, body, Object.assign({ door: true }, o));
      assert.equal(r.status, 401, method + ' ' + path + ' with a teacher ' + how + ': ' + r.status);
      tried++;
    }
  }
  assert.equal(K.snapshot(W.db), before);
  assert.ok(tried >= 150, String(tried));
});

test('2. a teacher token is 401 on every knight route and on /ws; a teacher is no knight at /api/login; /api/status says only who is on', async () => {
  const W = await world();
  const before = K.snapshot(W.db);
  // every knight route the World's route() answers (read from its source, so a new one is covered by itself), but the four
  // that take no token (signup, login, logout, status)
  const body0 = src('world.js'), rt = body0.slice(body0.indexOf('async route('), body0.indexOf('\n  now() {'));
  const BODIES = { '/api/save': '{"player":{}}', '/api/save/pin': '{"player":{}}', '/api/accounts/reset': { name: 'Sam', pass: 'abcdef' }, '/api/accounts/strikes': { name: 'Sam' }, '/api/accounts/rename': { name: 'Sam', to: 'Sammy' } };
  const routes = Array.from(rt.matchAll(/path === '(\/api\/[a-z/_-]+)' && method === '([A-Z]+)'/g), m => [m[2], m[1], m[2] === 'GET' ? undefined : BODIES[m[1]]]).filter(([, p]) => !['/api/signup', '/api/login', '/api/logout', '/api/status'].includes(p));
  assert.ok(routes.length >= 10 && routes.some(r => r[1] === '/api/save/restore') && routes.some(r => r[1] === '/api/accounts/rename'), JSON.stringify(routes));
  for (const [m, p, b] of routes) {
    const r = await call(W.w, m, p, b, { token: W.token });
    assert.deepEqual([r.status, r.data && r.data.code], [401, 'auth'], m + ' ' + p);
  }
  const st = await call(W.w, 'GET', '/api/status', undefined, { token: W.token });
  assert.equal(st.status, 200); assert.deepEqual(Object.keys(st.data).sort(), ['names', 'ok', 'online']);
  const ws = await W.w.fetch(new Request('http://world/ws?token=' + W.token, { headers: { upgrade: 'websocket' } }));
  assert.equal(ws.status, 401);
  const lg = await call(W.w, 'POST', '/api/login', { name: W.T.name, pass: W.T.pass });
  assert.equal(lg.status, 404); assert.equal(lg.data.code, 'unknown');
  assert.equal(K.snapshot(W.db).replace(/"last_seen":\d+/g, ''), before.replace(/"last_seen":\d+/g, ''));
  // and a teacher name is no account the knight routes can find
  assert.equal(W.db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE name_lc LIKE '%smith%'").get().n, 0);
});

test('3. knight tokens and ADMIN_KEY are refused by the teacher calls: no ticket, no teacher socket', async () => {
  const W = await world();
  for (const token of [W.tok.Sam, W.tok.MudGoll, K.ENV.ADMIN_KEY]) {
    const r = await call(W.w, 'POST', '/api/teacher/ticket', undefined, { token });
    assert.deepEqual([r.status, r.data.code], [401, 'auth']);
    const ws = await W.w.fetch(new Request('http://world/api/teacher/ws?ticket=' + token, { headers: Object.assign({ upgrade: 'websocket' }, K.DOOR) }));
    assert.equal(ws.status, 401);
  }
});

test('4. one sign-in: /api/teacher/login is gone; the teacher calls answer on every address with no door (a door header changes nothing); the Worker sends /teacher and the old teacher hosts to the game, answers /teacher-map.json itself, and hands the teacher socket back untouched', async () => {
  const W = await world();
  // NEGATIVE: the round-1 sign-in call is gone, with or without a door
  for (const o of [{}, { door: true }]) {
    const r = await call(W.w, 'POST', '/api/teacher/login', { name: W.T.name, pass: W.T.pass }, o);
    assert.deepEqual([r.status, r.data.code], [404, 'nope']);
  }
  // NEGATIVE: a door header, no token, a knight token: 401 on the teacher calls
  for (const o of [{ door: true }, {}, { token: W.tok.Sam }, { token: W.tok.Sam, door: true }]) {
    const r = await call(W.w, 'POST', '/api/teacher/ticket', undefined, o);
    assert.deepEqual([r.status, r.data.code], [401, 'auth'], JSON.stringify(o));
  }
  const ws0 = await W.w.fetch(new Request('http://world/api/teacher/ws?ticket=', { headers: Object.assign({ upgrade: 'websocket' }, K.DOOR) }));
  assert.equal(ws0.status, 401);
  // the teacher's own token gets a ticket with no door at all
  assert.equal((await call(W.w, 'POST', '/api/teacher/ticket', undefined, { token: W.token })).status, 200);
  const worker = (await import('../src/worker.js')).default;
  let reached = 0;
  const env = {
    HANDOVER: 'off',
    WORLD: { idFromName: () => 'id', get: () => ({ fetch: async r => { reached++; if (new URL(r.url).pathname === '/api/teacher/ws') return { status: 101, webSocket: 'the client end', headers: new Headers() }; return W.w.fetch(r); } }) },
    ASSETS: { fetch: async r => new Response('<html>' + new URL(r.url).pathname, { headers: { 'content-type': 'text/html' } }) },
  };
  const go = (url, init) => worker.fetch(new Request(url, init), env);
  // a teacher signs in on the game's own address: /api/login with teacherOk
  let r = await go('https://fanglands.com/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: W.T.name, pass: W.T.pass, teacherOk: 1 }) });
  assert.equal(r.status, 200); const j = await r.json(); assert.equal(j.teacher, true);
  // /teacher and /teacher.html open the game, on every address; a local world keeps its scheme and port
  for (const host of ['fanglands.com', 'www.fanglands.com', 'gorkscape.ca', 'test.fanglands.com']) for (const p of ['/teacher', '/teacher.html']) {
    r = await go('https://' + host + p, { redirect: 'manual' });
    assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/', host + p);
  }
  r = await go('http://127.0.0.1:8787/teacher'); assert.equal(r.headers.get('location'), 'http://127.0.0.1:8787/');
  // the old teacher addresses forward to their world's game, whatever the path
  for (const [host, to] of [['teacher.fanglands.com', 'https://fanglands.com/'], ['test-teacher.fanglands.com', 'https://test.fanglands.com/']]) for (const p of ['/', '/index.html', '/api/teacher/ticket', '/teacher-map.json']) {
    r = await go('https://' + host + p, { method: 'GET', redirect: 'manual' });
    assert.equal(r.status, 302, host + p); assert.equal(r.headers.get('location'), to);
  }
  // the map is the Worker's own answer on every game address: never a Durable Object request
  const before = reached;
  for (const host of ['fanglands.com', 'gorkscape.ca', 'test.fanglands.com', '127.0.0.1:8787']) {
    r = await go((host.startsWith('127') ? 'http://' : 'https://') + host + '/teacher-map.json');
    assert.equal(r.status, 200, host); assert.equal(r.headers.get('cache-control'), 'public, max-age=300'); const m = await r.json(); assert.ok(m.hash && Array.isArray(m.labels));
  }
  assert.equal(reached, before);
  // the teacher socket's 101 goes back exactly as the World answered it (no CORS copy of a socket)
  r = await go('https://fanglands.com/api/teacher/ws?ticket=x', { headers: { upgrade: 'websocket', origin: 'https://ethanbender.github.io' } });
  assert.equal(r.status, 101); assert.equal(r.webSocket, 'the client end');
  // nothing on the worker still knows an address or a door
  assert.ok(!/TEACHER_HOST|x-fanglands-door/.test(src('worker.js') + src('world.js') + src('teachers.js')), 'a teacher address or a door is still in the code');
});

test('4b. the teacher half of /api/login: {teacher, token, name, expires} with teacherOk; NEGATIVE: without it the knight\'s 404 unknown and no session row; a knight\'s name always takes the knight path', async () => {
  const W = await world();
  clock.t += 60000;
  const r = await tlogin(W, W.T.name, W.T.pass, '10.9.9.9');
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.data).sort(), ['expires', 'name', 'teacher', 'token']);
  assert.equal(r.data.teacher, true); assert.equal(r.data.name, 'Mrs Smith'); assert.match(r.data.token, /^[0-9a-f]{64}$/);
  assert.equal(r.data.expires, Math.min(clock.t + SESSION_MAX_MS, dayEnd(clock.t)));
  const rows = () => W.db.prepare('SELECT COUNT(*) AS n FROM teacher_sessions').get().n;
  const n0 = rows();
  // an old cached card (no teacherOk): the knight's answer, and no session written for anyone
  const old = await tlogin(W, W.T.name, W.T.pass, '10.9.9.9', false);
  assert.deepEqual([old.status, old.data.code], [404, 'unknown']);
  assert.equal(rows(), n0);
  // a knight's name is a knight's, teacherOk or not: his own answers (a wrong word is 'pass', never 'nomatch')
  const k1 = await tlogin(W, 'Sam', 'not-his-word', '10.9.9.10');
  assert.deepEqual([k1.status, k1.data.code], [401, 'pass']);
  const k2 = await tlogin(W, 'Sam', 'sword', '10.9.9.10');
  assert.equal(k2.status, 200); assert.ok(!('teacher' in k2.data)); assert.equal(k2.data.name, 'Sam');
  assert.equal(rows(), n0);
});

test('5. a teacher socket sending every message the Room knows changes nothing anywhere, and no knight hears a thing', async () => {
  const W = await world();
  const sam = await K.online(W.w, W.tok.Sam), leo = await K.online(W.w, W.tok.Leo, { x: 6100, y: 3700 }), mud = await K.online(W.w, W.tok.MudGoll, { x: 6050 });
  const scr = await K.screen(W.w, W.token);
  const types = Array.from(src('room.js').slice(src('room.js').indexOf('switch (m.t) {')).split('default:')[0].matchAll(/case '([a-z_]+)'/g), m => m[1]);
  assert.ok(types.length >= 30 && types.includes('trade_ask') && types.includes('boss_call') && types.includes('hello'), JSON.stringify(types));
  const room = W.w.room;
  const state = () => JSON.stringify({ knights: Array.from(room.knights.values()).map(k => [k.name, k.map, k.x, k.y, k.role, k.hello]).sort(), maps: Array.from(room.maps, ([m, g]) => [m, Array.from(g.members, k => k.name).sort(), g.keeper && g.keeper.name]), online: room.online(), parties: room.parties.size, gifts: room.gifts.size, trades: room.trades.size });
  const before = K.snapshot(W.db), st0 = state(), heard = [sam, leo, mud].map(s => s.got.length);
  const junk = { n: 'Sam', to: 'Sam', text: 'hi everyone', span: '1h', map: 'over', x: 1, y: 1, list: [], nid: 's1', id: 'p1.0', type: 'goblin', count: 3, spots: [[1, 1]], table: [{ id: 'coins', min: 1, max: 2, w: 1 }], hat: 10, items: [], yes: true, role: 'admin', v: 1 };
  for (const t of types.concat(['bogus', 'w_bogus', 'role', 'welcome'])) { W.w.webSocketMessage(scr, JSON.stringify(Object.assign({ t }, junk))); clock.t += 1100; }
  assert.equal(state(), st0);
  assert.equal(K.snapshot(W.db), before);
  assert.deepEqual([sam, leo, mud].map(s => s.got.length), heard);
  assert.equal(room.knights.size, 3); assert.equal(scr.closed, null);
});

test('6-8. sign-in: a wrong password is nomatch; 5 wrong from one tab make THAT tab at that place wait 15 minutes on that name, while the teacher\'s own tab at the same school address goes straight in; 30 wrong from one address in an hour make that address wait on that name; off is said only to the right password', async () => {
  const W = await world();
  const login = (name, pass, ip, tab) => tlogin(W, name, pass, ip, true, tab);
  const kid = 'aaaa1111bbbb2222', her = 'cccc3333dddd4444';
  const b = await login(W.T.name, 'not-the-password', '10.0.0.1', kid);
  assert.deepEqual([b.status, b.data.code], [401, 'nomatch']);
  // NEGATIVE (the finding): a kid at the school types the teacher's name with 5 wrong passwords; the fifth is the wait, on HIS tab
  for (let i = 0; i < 4; i++) assert.equal((await login(W.T.name, 'nope-nope-nope', '203.0.113.7', kid)).status, 401);
  const lock = await login(W.T.name, 'nope-nope-nope', '203.0.113.7', kid);
  assert.deepEqual([lock.status, lock.data.code, lock.data.wait], [429, 'wait', 900]);
  let r = await login(W.T.name, W.T.pass, '203.0.113.7', kid);
  assert.deepEqual([r.status, r.data.code], [429, 'wait']);
  // ... the teacher at the next desk, the same school address, her own page: the right password goes straight in
  r = await login(W.T.name, W.T.pass, '203.0.113.7', her);
  assert.equal(r.status, 200);
  // ... and from anywhere else too
  assert.equal((await login(W.T.name, W.T.pass, '10.0.0.3', kid)).status, 200);
  clock.t += TEACHER_LOCK_MS + 1;
  assert.equal((await login(W.T.name, W.T.pass, '203.0.113.7', kid)).status, 200);
  // the ceiling: a guesser making new tabs gets 30 wrong in an hour on one name from one address, then that address waits on
  // that name (the right password too) until the hour is up; another address is untouched
  for (let i = 0; i < NAME_FAILS - 1; i++) assert.notEqual((await login(W.T.name, 'guess-' + i, '198.51.100.20', (1e15 + i).toString(16))).status, 200);
  const ceil = await login(W.T.name, 'guess-last', '198.51.100.20', 'ffff0000ffff0000');
  assert.deepEqual([ceil.status, ceil.data.code], [429, 'wait']);
  assert.ok(ceil.data.wait > 0 && ceil.data.wait <= ADDRESS_WINDOW_MS / 1000, String(ceil.data.wait));
  r = await login(W.T.name, W.T.pass, '198.51.100.20', 'eeee0000eeee0000');
  assert.deepEqual([r.status, r.data.code], [429, 'wait']);
  assert.equal((await login(W.T.name, W.T.pass, '198.51.100.21', kid)).status, 200);
  // turned off: the right password hears "off", a wrong one still hears nomatch
  await parent(W.w, 'POST', '/api/admin/teachers/off', { id: W.T.id });
  r = await login(W.T.name, W.T.pass, '10.1.1.1');
  assert.deepEqual([r.status, r.data.code], [403, 'off']);
  r = await login(W.T.name, 'wrong-wrong-wrong', '10.1.1.1');
  assert.deepEqual([r.status, r.data.code], [401, 'nomatch']);
});

test('6b. NEGATIVE: a name no teacher has is the knight\'s 404 unknown on the new card too (the kid hears "No knight by that name yet. Tap New knight."), costs no password hash and counts no wait: 20 mistyped knight names from a school plus one teacher typo still let the right password in', async () => {
  const W = await world();
  const login = (name, pass, ip, tab) => tlogin(W, name, pass, ip, true, tab);
  const book = W.w.teachers;
  // a kid's typo and a new kid who forgot New knight: the knight's answer, never the teacher's
  for (const n of ['Leoo', 'Newkid', 'Cohenn']) {
    for (let i = 0; i < 6; i++) { const r = await login(n, 'dragon1', '203.0.113.9', 'abcdabcdabcdabcd'); assert.deepEqual([r.status, r.data.code], [404, 'unknown'], n + ' try ' + i); }
  }
  // the same answer an older card (no teacherOk) gets
  assert.deepEqual((await tlogin(W, 'Leoo', 'dragon1', '203.0.113.9', false)).data, (await login('Leoo', 'dragon1', '203.0.113.9')).data);
  assert.equal(book.tries.size + book.fails.size, 0);
  // the judge's case: 20 mistyped knight names from one address, then one teacher typo, then the right password: in
  for (let i = 0; i < 20; i++) await login('Kidtypo' + i, 'pass' + i, '203.0.113.7', (0x10000000 + i).toString(16));
  assert.equal(book.tries.size + book.fails.size, 0);
  assert.deepEqual((await login(W.T.name, 'oops-a-typo', '203.0.113.7', 'cccc3333dddd4444')).data.code, 'nomatch');
  const r = await login(W.T.name, W.T.pass, '203.0.113.7', 'cccc3333dddd4444');
  assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.teacher, true);
  // a teacher name typed the way it reads ("mrs smith" for "Mrs Smith", "Mr Lee" for "Mr. Lee") is still that teacher
  await K.addTeacher(W.w, 'Mr. Lee', 'quiet-harbour-oak-17');
  for (const n of ['mrs smith', 'MRS SMITH']) assert.equal((await login(n, W.T.pass, '10.4.4.4')).data.name, 'Mrs Smith', n);
  assert.equal((await login('Mr Lee', 'quiet-harbour-oak-17', '10.4.4.4')).data.name, 'Mr. Lee');
});

test('6b2. Lift the wait on /admin: every wait on that teacher\'s name ends at once, with the same password; logged as the parent page\'s', async () => {
  const W = await world();
  const login = (name, pass, ip, tab) => tlogin(W, name, pass, ip, true, tab);
  for (let i = 0; i < NAME_FAILS; i++) await login(W.T.name, 'guess-' + i, '203.0.113.50', (0x20000000 + i).toString(16));
  assert.equal((await login(W.T.name, W.T.pass, '203.0.113.50', 'aaaa0000aaaa0000')).status, 429);
  let list = (await parent(W.w, 'GET', '/api/admin/teachers')).data.teachers;
  assert.ok(list.find(t => t.name === W.T.name).waiting >= 1);
  const lift = await parent(W.w, 'POST', '/api/admin/teachers/lift', { id: W.T.id });
  assert.equal(lift.status, 200);
  assert.equal((await login(W.T.name, W.T.pass, '203.0.113.50', 'aaaa0000aaaa0000')).status, 200);
  list = (await parent(W.w, 'GET', '/api/admin/teachers')).data.teachers;
  assert.equal(list.find(t => t.name === W.T.name).waiting, 0);
  const row = W.db.prepare("SELECT by, target FROM mod_log WHERE act = 'teacher_lift'").get();
  assert.deepEqual([row.by, row.target], ['parent page', 'Mrs Smith (teacher)']);
  // a teacher token cannot lift anything
  assert.equal((await call(W.w, 'POST', '/api/admin/teachers/lift', { id: W.T.id }, { token: W.token })).status, 401);
});

test('6c. a kid hammering a teacher\'s name: the owner sees the wrong tries today, and a new password lifts the wait at once', async () => {
  const W = await world();
  const login = (name, pass, ip) => tlogin(W, name, pass, ip);
  for (let i = 0; i < 5; i++) await login(W.T.name, 'guess-' + i, '192.0.2.200');
  for (let i = 0; i < 2; i++) await login(W.T.name, 'guess-' + i, '192.0.2.201');
  let list = (await parent(W.w, 'GET', '/api/admin/teachers')).data.teachers;
  assert.equal(list.find(t => t.name === W.T.name).wrongToday, 7);
  assert.equal((await login(W.T.name, W.T.pass, '192.0.2.200')).status, 429);
  await parent(W.w, 'POST', '/api/admin/teachers/pass', { id: W.T.id, pass: 'brand-new-words-12' });
  assert.equal((await login(W.T.name, 'brand-new-words-12', '192.0.2.200')).status, 200);
  // a new day starts the count again
  clock.t = dayEnd(clock.t) + 1;
  list = (await parent(W.w, 'GET', '/api/admin/teachers')).data.teachers;
  assert.equal(list.find(t => t.name === W.T.name).wrongToday, 0);
});

test('6d. no knight may take a teacher\'s name (signup and rename, any case, spaces or dots), and no teacher a knight\'s', async () => {
  const W = await world();
  await K.addTeacher(W.w, 'Mr. Lee', 'quiet-harbour-oak-17');
  for (const n of ['Mrs Smith', 'mrs smith', 'MrsSmith', 'MRS  SMITH', 'Mr Lee', 'MrLee']) {
    const r = await call(W.w, 'POST', '/api/signup', { name: n, pass: 'sword', invite: 'TEST-1234' });
    assert.deepEqual([r.status, r.data.code], [409, 'taken'], n);
  }
  assert.equal((await call(W.w, 'POST', '/api/signup', { name: 'Mrs Smithy', pass: 'sword', invite: 'TEST-1234' })).status, 200);
  const ren = await parent(W.w, 'POST', '/api/admin/rename', { name: 'Leo', to: 'Mrs Smith' });
  assert.deepEqual([ren.status, ren.data.code], [409, 'taken']);
  // the owner cannot make a teacher with a knight's name (it would read as that knight, and the other way round)
  for (const n of ['Sam', 'SAM', 'Mrs. Smithy', 'Mrs Smith', 'Mrs.Smith']) {
    const r = await parent(W.w, 'POST', '/api/admin/teachers', { name: n, pass: 'long-enough-pass' });
    assert.deepEqual([r.status, r.data.code], [409, 'taken'], n);
  }
});

test('9. a sign-in writes teacher_in to mod_log and no address anywhere', async () => {
  const W = await world();
  await K.teacherLogin(W.w, W.T.name, W.T.pass, '203.0.113.77');
  await tlogin(W, W.T.name, 'wrong-wrong-wrong', '203.0.113.78');
  const log = (await parent(W.w, 'GET', '/api/admin/modlog')).data;
  assert.equal(log[0].act, 'teacher_in'); assert.equal(log[0].by, 'Mrs Smith (teacher)');
  const all = K.snapshot(W.db, []);
  assert.ok(!all.includes('203.0.113'), 'an address was written');
});

test('10. a session ends at the earlier of 10 hours and midnight in Toronto, on an ordinary day and on both changes of the clocks', () => {
  const at = (iso, tz) => Date.parse(iso);
  // 10:00 am EDT on 6 Oct: 10 hours is 8 pm, before midnight
  let now = Date.UTC(2026, 9, 6, 14, 0); assert.equal(Math.min(now + SESSION_MAX_MS, dayEnd(now)), now + SESSION_MAX_MS);
  // 4 pm EDT: midnight comes first (04:00 UTC next day, less a millisecond)
  now = Date.UTC(2026, 9, 6, 20, 0); assert.equal(dayEnd(now), Date.UTC(2026, 9, 7, 4, 0) - 1); assert.equal(Math.min(now + SESSION_MAX_MS, dayEnd(now)), Date.UTC(2026, 9, 7, 4, 0) - 1);
  assert.equal(dayStart(now), Date.UTC(2026, 9, 6, 4, 0));
  // 8 Mar 2026 (clocks go forward at 2 am): the day is 23 hours, midnight is EDT
  now = Date.UTC(2026, 2, 8, 6, 30);   // 1:30 am EST
  assert.equal(dayStart(now), Date.UTC(2026, 2, 8, 5, 0)); assert.equal(dayEnd(now), Date.UTC(2026, 2, 9, 4, 0) - 1);
  assert.equal(dayEnd(now) + 1 - dayStart(now), 23 * 3600000);
  now = Date.UTC(2026, 2, 8, 19, 0); assert.equal(dayEnd(now), Date.UTC(2026, 2, 9, 4, 0) - 1);
  // 1 Nov 2026 (clocks go back at 2 am): the day is 25 hours, midnight is EST
  now = Date.UTC(2026, 10, 1, 5, 30);  // 1:30 am EDT
  assert.equal(dayStart(now), Date.UTC(2026, 10, 1, 4, 0)); assert.equal(dayEnd(now), Date.UTC(2026, 10, 2, 5, 0) - 1);
  assert.equal(dayEnd(now) + 1 - dayStart(now), 25 * 3600000);
  assert.ok(at);
});

test('10b. the login answer carries that expiry', async () => {
  clock.t = Date.UTC(2026, 9, 6, 22, 0);   // 6 pm in Toronto
  const W = K.newWorld(); const T = await K.addTeacher(W.w);
  const lg = await K.teacherLogin(W.w, T.name, T.pass);
  assert.equal(lg.expires, Date.UTC(2026, 9, 7, 4, 0) - 1);
  assert.equal(W.db.prepare('SELECT expires FROM teacher_sessions').get().expires, lg.expires);
  // the token is never stored: only its SHA-256
  assert.equal(W.db.prepare('SELECT hash FROM teacher_sessions').get().hash, createHash('sha256').update(lg.token).digest('hex'));
  assert.ok(!K.snapshot(W.db, []).includes(lg.token));
});

test('11. tickets: one use, 30 seconds, dead after logout; no upgrade without one', async () => {
  const W = await world();
  const up = t => W.w.fetch(new Request('http://world/api/teacher/ws?ticket=' + t, { headers: { upgrade: 'websocket' } }));
  let t = await K.ticket(W.w, W.token);
  assert.equal((await up(t)).status, 101);
  assert.equal((await up(t)).status, 401);       // used
  t = await K.ticket(W.w, W.token); clock.t += TICKET_MS + 1;
  assert.equal((await up(t)).status, 401);       // too old
  assert.equal((await up('')).status, 401);
  assert.equal((await W.w.fetch(new Request('http://world/api/teacher/ws', { headers: { upgrade: 'websocket' } }))).status, 401);
  t = await K.ticket(W.w, W.token);
  const scr = W.ctx.sockets.find(s => s.att && s.att.w);
  assert.equal((await call(W.w, 'POST', '/api/teacher/logout', { token: W.token })).status, 200);
  assert.equal(scr.closed.code, 4010); assert.equal(scr.last('w_bye').code, 4010);
  assert.equal((await up(t)).status, 401);       // its session is gone
  assert.equal((await call(W.w, 'POST', '/api/teacher/ticket', undefined, { token: W.token })).status, 401);
});

test('12. the owner makes teachers: the name and password rules, and taken', async () => {
  const W = await world();
  const add = (name, pass) => parent(W.w, 'POST', '/api/admin/teachers', { name, pass });
  for (const n of ['', 'A', '1Smith', 'Mrs <b>', 'x'.repeat(41), 'Mrs Smith (teacher)']) assert.deepEqual([(await add(n, 'long-enough-pass')).status, (await add(n, 'long-enough-pass')).data.code], [400, 'name'], n);
  assert.deepEqual([(await add('Mr Lee', 'short')).status, (await add('Mr Lee', 'short')).data.code], [400, 'pass']);
  assert.deepEqual([(await add('MRS SMITH', 'long-enough-pass')).status, (await add('mrs  smith', 'long-enough-pass')).data.code], [409, 'taken']);
  const ok = await add("Ms O'Neil-Brown", 'long-enough-pass');
  assert.equal(ok.status, 200); assert.equal(ok.data.name, "Ms O'Neil-Brown");
  const all = (await parent(W.w, 'GET', '/api/admin/teachers')).data;
  // one call for the whole Teachers section: the list, today's actions and the notice switch
  assert.deepEqual(Object.keys(all).sort(), ['acts', 'notice', 'teachers']);
  assert.equal(all.notice, true); assert.deepEqual(all.acts, []);
  const list = all.teachers;
  assert.deepEqual(list.map(t => t.name), ['Mrs Smith', "Ms O'Neil-Brown"]);
  assert.deepEqual(Object.keys(list[0]).sort(), ['actsToday', 'created', 'id', 'lastLogin', 'name', 'off', 'waiting', 'watching', 'wrongToday']);
});

test('13. New password closes that teacher\'s screens with 4013 and ends its sessions; Turn off closes with 4012; Turn on needs a password; each is in mod_log', async () => {
  const W = await world();
  const B = await K.addTeacher(W.w, 'Mr Lee', 'quiet-harbour-oak-17');
  const bl = await K.teacherLogin(W.w, B.name, B.pass);
  const a1 = await K.screen(W.w, W.token), b1 = await K.screen(W.w, bl.token);
  let r = await parent(W.w, 'POST', '/api/admin/teachers/pass', { id: W.T.id, pass: 'new-password-here-1' });
  assert.equal(r.status, 200);
  assert.equal(a1.closed.code, 4013); assert.equal(a1.last('w_bye').code, 4013); assert.equal(b1.closed, null);
  assert.equal((await call(W.w, 'POST', '/api/teacher/ticket', undefined, { token: W.token })).status, 401);
  assert.equal((await tlogin(W, W.T.name, W.T.pass)).status, 401);
  assert.equal((await tlogin(W, W.T.name, 'new-password-here-1')).status, 200);
  r = await parent(W.w, 'POST', '/api/admin/teachers/off', { id: B.id });
  assert.equal(b1.closed.code, 4012); assert.equal(b1.last('w_bye').code, 4012);
  assert.equal(W.db.prepare('SELECT COUNT(*) AS n FROM teacher_sessions WHERE teacher_id = ?').get(B.id).n, 0);
  assert.deepEqual([(await parent(W.w, 'POST', '/api/admin/teachers/on', { id: B.id })).status], [400]);
  assert.equal((await parent(W.w, 'POST', '/api/admin/teachers/on', { id: B.id, pass: 'fresh-start-word-9' })).status, 200);
  assert.equal((await tlogin(W, B.name, B.pass)).status, 401);
  assert.equal((await tlogin(W, B.name, 'fresh-start-word-9')).status, 200);
  const acts = (await parent(W.w, 'GET', '/api/admin/modlog')).data.filter(x => x.by === 'parent page').map(x => x.act + ' ' + x.n);
  assert.deepEqual(acts.slice(0, 4), ['teacher_on Mr Lee (teacher)', 'teacher_off Mr Lee (teacher)', 'teacher_pass Mrs Smith (teacher)', 'teacher_add Mr Lee (teacher)']);
  // the row stays forever
  assert.equal((await parent(W.w, 'GET', '/api/admin/teachers')).data.teachers.length, 2);
});

test('14. the export holds teachers and teacher_acts and never teacher_sessions; no password text is anywhere', async () => {
  const W = await world();
  const scr = await K.screen(W.w, W.token);
  await K.online(W.w, W.tok.Sam);
  K.act(W.w, scr, { t: 'w_mute', n: 'Sam', span: '10m' });
  const ex = (await parent(W.w, 'GET', '/api/admin/export')).data;
  assert.ok(Array.isArray(ex.teachers) && ex.teachers.length === 1 && ex.teachers[0].hash && ex.teachers[0].salt);
  assert.ok(Array.isArray(ex.teacher_acts) && ex.teacher_acts.length === 1);
  assert.ok(!('teacher_sessions' in ex));
  const all = JSON.stringify(ex) + K.snapshot(W.db, []);
  assert.ok(!all.includes(W.T.pass), 'the password is stored somewhere');
  assert.ok(!all.includes(W.token), 'the token is stored somewhere');
});

test('migrateTeachers on a live-schema world adds the two columns once and keeps every row', async () => {
  clock.t = T0;
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const W1 = K.newWorld({ db }); await K.signup(W1.w, 'Sam');
  const before = db.prepare('SELECT name, hash, salt FROM accounts').all();
  const W2 = K.newWorld({ db }); const W3 = K.newWorld({ db });
  assert.ok(W2 && W3);
  const cols = db.prepare('PRAGMA table_info(accounts)').all().map(c => c.name);
  assert.equal(cols.filter(c => c === 'sent_off_until').length, 1); assert.equal(cols.filter(c => c === 'sent_off_by').length, 1);
  assert.deepEqual(db.prepare('SELECT name, hash, salt FROM accounts').all(), before);
});
