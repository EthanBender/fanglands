// The teacher view's door, sign-in, tickets and the owner's calls (docs/ONLINE.md, "The teacher view"). The whole World on
// node's SQLite (teacher-kit.mjs). The first five tests are the NEGATIVE ones: a teacher's credentials reach nothing but the
// teacher view, and a teacher socket is never a knight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as K from './teacher-kit.mjs';
import { dayEnd, dayStart, TEACHER_LOCK_MS, TICKET_MS, SESSION_MAX_MS } from '../src/teachers.js';

const { clock, call, parent } = K;
const T0 = Date.UTC(2026, 9, 6, 14, 0, 0);
const src = f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const DOC = fs.readFileSync(new URL('../../docs/ONLINE.md', import.meta.url), 'utf8');

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
  const routes = [['GET', '/api/me'], ['GET', '/api/save'], ['PUT', '/api/save', '{"player":{}}'], ['GET', '/api/save/pin'], ['POST', '/api/save/pin', '{"player":{}}'], ['POST', '/api/save/restore'],
    ['GET', '/api/accounts'], ['POST', '/api/accounts/reset', { name: 'Sam', pass: 'abcdef' }], ['POST', '/api/accounts/strikes', { name: 'Sam' }], ['POST', '/api/accounts/rename', { name: 'Sam', to: 'Sammy' }], ['POST', '/api/logout']];
  for (const [m, p, b] of routes) {
    if (p === '/api/logout') continue;
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
    const r = await call(W.w, 'POST', '/api/teacher/ticket', undefined, { door: true, token });
    assert.deepEqual([r.status, r.data.code], [401, 'auth']);
    const ws = await W.w.fetch(new Request('http://world/api/teacher/ws?ticket=' + token, { headers: Object.assign({ upgrade: 'websocket' }, K.DOOR) }));
    assert.equal(ws.status, 401);
  }
});

test('4. no door, no teacher view: 404 from the World; the Worker strips a door a browser sends, serves the teacher address, and sends /teacher there', async () => {
  const W = await world();
  for (const p of ['/api/teacher/login', '/api/teacher/ticket', '/api/teacher/logout']) {
    const r = await call(W.w, 'POST', p, { name: W.T.name, pass: W.T.pass }, { token: W.token });
    assert.deepEqual([r.status, r.data.code], [404, 'nope'], p);
  }
  const worker = (await import('../src/worker.js')).default;
  const seen = [];
  const env = {
    TEACHER_HOST: 'teacher.fanglands.com', HANDOVER: 'off',
    WORLD: { idFromName: () => 'id', get: () => ({ fetch: async r => { seen.push(r.headers.get('x-fanglands-door')); return W.w.fetch(r); } }) },
    ASSETS: { fetch: async r => new Response('<html>' + new URL(r.url).pathname, { headers: { 'content-type': 'text/html' } }) },
  };
  const go = (url, init) => worker.fetch(new Request(url, init), env);
  // a door sent by a browser to fanglands.com never arrives
  let r = await go('https://fanglands.com/api/teacher/login', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, K.DOOR), body: JSON.stringify({ name: W.T.name, pass: W.T.pass }) });
  assert.equal(r.status, 404); assert.equal(seen.pop(), null);
  // the teacher address adds it
  r = await go('https://teacher.fanglands.com/api/teacher/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: W.T.name, pass: W.T.pass }) });
  assert.equal(r.status, 200); assert.equal(seen.pop(), 'teacher');
  // a knight call on the teacher address is nothing
  r = await go('https://teacher.fanglands.com/api/me', { headers: { authorization: 'Bearer ' + W.tok.Sam } });
  assert.equal(r.status, 404); assert.equal(seen.length, 0);
  for (const p of ['/ws', '/admin', '/api/status', '/api/admin/accounts', '/index.html?x=1', '/teacher']) { const x = await go('https://teacher.fanglands.com' + p); assert.ok(x.status === 404 || p === '/index.html?x=1', p + ' ' + x.status); }
  // the page, with its headers
  r = await go('https://teacher.fanglands.com/');
  assert.equal(r.status, 200); assert.equal(await r.text(), '<html>/teacher');
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY'); assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(r.headers.get('x-robots-tag'), 'noindex');
  r = await go('https://teacher.fanglands.com/teacher-map.json');
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'public, max-age=300'); assert.ok((await r.json()).hash);
  // /teacher anywhere else is a 302 there
  for (const host of ['fanglands.com', 'www.fanglands.com', 'gorkscape.ca']) for (const p of ['/teacher', '/teacher.html']) {
    r = await go('https://' + host + p, { redirect: 'manual' });
    assert.equal(r.status, 302); assert.equal(r.headers.get('location'), 'https://teacher.fanglands.com/');
  }
  // a local world keeps its scheme and port
  r = await go('http://127.0.0.1:8811/teacher', { redirect: 'manual' }).catch(() => null);
  const local = await worker.fetch(new Request('http://127.0.0.1:8811/teacher'), Object.assign({}, env, { TEACHER_HOST: 'localhost' }));
  assert.equal(local.headers.get('location'), 'http://localhost:8811/');
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

test('6-8. sign-in: an unknown name and a wrong password answer the same; 5 wrong from one place make THAT place wait 15 minutes on THAT name; 20 from one place make it wait on the names it got wrong; off is said only to the right password', async () => {
  const W = await world();
  const login = (name, pass, ip) => call(W.w, 'POST', '/api/teacher/login', { name, pass }, { door: true, ip });
  const a = await login('Nobody Here', 'whatever-it-is', '10.0.0.1');
  const b = await login(W.T.name, 'not-the-password', '10.0.0.1');
  assert.deepEqual([a.status, a.data], [b.status, b.data]);
  assert.deepEqual([a.status, a.data.code], [401, 'nomatch']);
  // five wrong in a row from one place: the fifth is the wait, and that place waits on that name
  for (let i = 0; i < 4; i++) assert.equal((await login(W.T.name, 'nope-nope-nope', '10.0.0.2')).status, 401);
  const lock = await login(W.T.name, 'nope-nope-nope', '10.0.0.2');
  assert.deepEqual([lock.status, lock.data.code, lock.data.wait], [429, 'wait', 900]);
  let r = await login(W.T.name, W.T.pass, '10.0.0.2');
  assert.deepEqual([r.status, r.data.code], [429, 'wait']);
  // ... but the right password from anywhere else goes straight in (a kid at home cannot keep the teacher out at school)
  r = await login(W.T.name, W.T.pass, '10.0.0.3');
  assert.equal(r.status, 200);
  clock.t += TEACHER_LOCK_MS + 1;
  r = await login(W.T.name, W.T.pass, '10.0.0.2');
  assert.equal(r.status, 200);
  // twenty failures from one place in an hour (a school): it waits on the names it got wrong, never on a teacher's own
  for (let i = 0; i < 20; i++) await login('Guess ' + 'abcdefghijklmnopqrst'[i], 'x'.repeat(12), '2001:db8:1:' + i + '::7');
  r = await login('Guess a', 'x'.repeat(12), '2001:db8:1:ff::9');
  assert.deepEqual([r.status, r.data.code], [429, 'wait']);
  r = await login(W.T.name, W.T.pass, '2001:db8:1:ff::9');
  assert.equal(r.status, 200);
  // turned off: the right password hears "off", a wrong one still hears nomatch
  await parent(W.w, 'POST', '/api/admin/teachers/off', { id: W.T.id });
  r = await login(W.T.name, W.T.pass, '10.1.1.1');
  assert.deepEqual([r.status, r.data.code], [403, 'off']);
  r = await login(W.T.name, 'wrong-wrong-wrong', '10.1.1.1');
  assert.deepEqual([r.status, r.data.code], [401, 'nomatch']);
});

test('6b. the 1st to 7th wrong try answer exactly the same for a real teacher and a name nobody has (no list of names to learn)', async () => {
  const W = await world();
  const login = (name, pass, ip) => call(W.w, 'POST', '/api/teacher/login', { name, pass }, { door: true, ip });
  const known = [], unknown = [];
  for (let i = 0; i < 7; i++) { known.push(await login(W.T.name, 'wrong-guess-' + i, '198.51.100.7')); unknown.push(await login('Mrs Nobody', 'wrong-guess-' + i, '198.51.100.8')); }
  assert.deepEqual(known.map(r => [r.status, r.data]), unknown.map(r => [r.status, r.data]));
  assert.deepEqual(known.map(r => r.status), [401, 401, 401, 401, 429, 429, 429]);
});

test('6c. a kid hammering a teacher\'s name: the owner sees the wrong tries today, and a new password lifts the wait at once', async () => {
  const W = await world();
  const login = (name, pass, ip) => call(W.w, 'POST', '/api/teacher/login', { name, pass }, { door: true, ip });
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
  await call(W.w, 'POST', '/api/teacher/login', { name: W.T.name, pass: 'wrong-wrong-wrong' }, { door: true, ip: '203.0.113.78' });
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
  const up = t => W.w.fetch(new Request('http://world/api/teacher/ws?ticket=' + t, { headers: Object.assign({ upgrade: 'websocket' }, K.DOOR) }));
  let t = await K.ticket(W.w, W.token);
  assert.equal((await up(t)).status, 101);
  assert.equal((await up(t)).status, 401);       // used
  t = await K.ticket(W.w, W.token); clock.t += TICKET_MS + 1;
  assert.equal((await up(t)).status, 401);       // too old
  assert.equal((await up('')).status, 401);
  assert.equal((await W.w.fetch(new Request('http://world/api/teacher/ws', { headers: Object.assign({ upgrade: 'websocket' }, K.DOOR) }))).status, 401);
  t = await K.ticket(W.w, W.token);
  const scr = W.ctx.sockets.find(s => s.att && s.att.w);
  assert.equal((await call(W.w, 'POST', '/api/teacher/logout', { token: W.token }, { door: true })).status, 200);
  assert.equal(scr.closed.code, 4010); assert.equal(scr.last('w_bye').code, 4010);
  assert.equal((await up(t)).status, 401);       // its session is gone
  assert.equal((await call(W.w, 'POST', '/api/teacher/ticket', undefined, { door: true, token: W.token })).status, 401);
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
  assert.deepEqual(Object.keys(list[0]).sort(), ['actsToday', 'created', 'id', 'lastLogin', 'name', 'off', 'watching', 'wrongToday']);
});

test('13. New password closes that teacher\'s screens with 4013 and ends its sessions; Turn off closes with 4012; Turn on needs a password; each is in mod_log', async () => {
  const W = await world();
  const B = await K.addTeacher(W.w, 'Mr Lee', 'quiet-harbour-oak-17');
  const bl = await K.teacherLogin(W.w, B.name, B.pass);
  const a1 = await K.screen(W.w, W.token), b1 = await K.screen(W.w, bl.token);
  let r = await parent(W.w, 'POST', '/api/admin/teachers/pass', { id: W.T.id, pass: 'new-password-here-1' });
  assert.equal(r.status, 200);
  assert.equal(a1.closed.code, 4013); assert.equal(a1.last('w_bye').code, 4013); assert.equal(b1.closed, null);
  assert.equal((await call(W.w, 'POST', '/api/teacher/ticket', undefined, { door: true, token: W.token })).status, 401);
  assert.equal((await call(W.w, 'POST', '/api/teacher/login', { name: W.T.name, pass: W.T.pass }, { door: true })).status, 401);
  assert.equal((await call(W.w, 'POST', '/api/teacher/login', { name: W.T.name, pass: 'new-password-here-1' }, { door: true })).status, 200);
  r = await parent(W.w, 'POST', '/api/admin/teachers/off', { id: B.id });
  assert.equal(b1.closed.code, 4012); assert.equal(b1.last('w_bye').code, 4012);
  assert.equal(W.db.prepare('SELECT COUNT(*) AS n FROM teacher_sessions WHERE teacher_id = ?').get(B.id).n, 0);
  assert.deepEqual([(await parent(W.w, 'POST', '/api/admin/teachers/on', { id: B.id })).status], [400]);
  assert.equal((await parent(W.w, 'POST', '/api/admin/teachers/on', { id: B.id, pass: 'fresh-start-word-9' })).status, 200);
  assert.equal((await call(W.w, 'POST', '/api/teacher/login', { name: B.name, pass: B.pass }, { door: true })).status, 401);
  assert.equal((await call(W.w, 'POST', '/api/teacher/login', { name: B.name, pass: 'fresh-start-word-9' }, { door: true })).status, 200);
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
