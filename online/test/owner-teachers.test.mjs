// Teachers in the game (docs/ONLINE.md, "The teacher view", "Teachers in the game"). Owner (7 Oct 2026): "My understanding
// was that under my mud goal profile I could create the teacher in game in the settings ... Can you not put them in my admin
// tab in game?" The same calls as /admin's Teachers section, from an OWNER knight's game at /api/owner/teachers*: only a knight
// whose role is 'admin' AND whose name is in OWNER_KNIGHTS, checked on every call. The whole World on node's SQLite
// (teacher-kit.mjs). The NEGATIVE tests come first: a kid, another admin, a teacher and nobody change nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from './teacher-kit.mjs';

const { clock, call, parent } = K;
const T0 = Date.UTC(2026, 9, 7, 14, 0, 0);   // 10:00 am in Toronto, Wed 7 Oct 2026
const ENV = Object.assign({}, K.ENV, { OWNER_KNIGHTS: 'MudGoll' });
const CALLS = [
  ['GET', '/api/owner/teachers'], ['POST', '/api/owner/teachers', { name: 'Mr Lee', pass: 'quiet-harbour-oak-17' }],
  ['POST', '/api/owner/teachers/pass', { id: 1, pass: 'new-password-here-1' }], ['POST', '/api/owner/teachers/off', { id: 1 }],
  ['POST', '/api/owner/teachers/on', { id: 1, pass: 'fresh-start-word-9' }], ['POST', '/api/owner/teachers/lift', { id: 1 }],
  ['POST', '/api/owner/teachers/notice', { on: false }], ['POST', '/api/owner/teachers/undo', { act: 1 }],
];

async function world(env = ENV) {
  clock.t = T0;
  const W = K.newWorld({ env });
  const tok = {};
  for (const n of ['MudGoll', 'Ada', 'Cohen', 'Sam']) { tok[n] = await K.signup(W.w, n); clock.t += 1000; }
  for (const n of ['MudGoll', 'Ada']) assert.equal((await parent(W.w, 'POST', '/api/admin/role', { name: n, role: 'admin' })).status, 200);
  return Object.assign(W, { tok });
}
const as = (W, who, method, path, body) => call(W.w, method, path, body, { token: W.tok[who] });
const modlog = W => W.db.prepare('SELECT by, act, target, detail FROM mod_log ORDER BY id').all();
const teacherRows = W => W.db.prepare('SELECT * FROM teachers').all();

test('1. NEGATIVE: a kid gets the knight\'s 403 admin, another admin (not in OWNER_KNIGHTS) 403 owner, no token 401 auth, a teacher token 401: on every call, and no row anywhere changes', async () => {
  const W = await world();
  const T = await K.addTeacher(W.w);
  const lg = await K.teacherLogin(W.w, T.name, T.pass);
  const before = K.snapshot(W.db);
  for (const [method, path, body] of CALLS) {
    const kid = await as(W, 'Cohen', method, path, body), ada = await as(W, 'Ada', method, path, body);
    const none = await call(W.w, method, path, body), teach = await call(W.w, method, path, body, { token: lg.token });
    const key = await call(W.w, method, path, body, { token: K.ENV.ADMIN_KEY });   // the parent page's key is no knight token
    assert.deepEqual([kid.status, kid.data.code], [403, 'admin'], method + ' ' + path + ' kid');
    assert.deepEqual([ada.status, ada.data.code], [403, 'owner'], method + ' ' + path + ' Ada');
    assert.deepEqual([none.status, none.data.code], [401, 'auth'], method + ' ' + path + ' nobody');
    assert.deepEqual([teach.status, teach.data.code], [401, 'auth'], method + ' ' + path + ' teacher');
    assert.deepEqual([key.status, key.data.code], [401, 'auth'], method + ' ' + path + ' admin key as a knight token');
    // nothing about any teacher in a refusal
    for (const r of [kid, ada, none, teach, key]) assert.ok(!JSON.stringify(r.data).includes('Smith'), JSON.stringify(r.data));
  }
  assert.equal(K.snapshot(W.db), before, 'a refused call changed a row');
});

test('1b. NEGATIVE: no OWNER_KNIGHTS on the world = nobody, MudGoll included; a demoted owner is a player again; a name that only looks like the owner\'s is not his', async () => {
  let W = await world(K.ENV);
  let r = await as(W, 'MudGoll', 'GET', '/api/owner/teachers');
  assert.deepEqual([r.status, r.data.code], [403, 'owner']);
  W = await world(Object.assign({}, K.ENV, { OWNER_KNIGHTS: '' }));
  assert.equal((await as(W, 'MudGoll', 'POST', '/api/owner/teachers', { name: 'Mr Lee', pass: 'quiet-harbour-oak-17' })).status, 403);
  assert.equal(teacherRows(W).length, 0);
  W = await world();
  await parent(W.w, 'POST', '/api/admin/role', { name: 'MudGoll', role: 'player' });
  r = await as(W, 'MudGoll', 'GET', '/api/owner/teachers');
  assert.deepEqual([r.status, r.data.code], [403, 'admin']);
  // "Mud Goll" and "MudGoll2" are other knights: never the owner
  W = await world(Object.assign({}, K.ENV, { OWNER_KNIGHTS: 'MudGoll' }));
  for (const n of ['Mud Goll', 'MudGoll2']) { W.tok[n] = await K.signup(W.w, n); await parent(W.w, 'POST', '/api/admin/role', { name: n, role: 'admin' }); }
  for (const n of ['Mud Goll', 'MudGoll2']) assert.equal((await as(W, n, 'GET', '/api/owner/teachers')).data.code, 'owner', n);
});

test('1c. OWNER_KNIGHTS is a comma-separated list in any case (the test world names "mudgoll")', async () => {
  const W = await world(Object.assign({}, K.ENV, { OWNER_KNIGHTS: ' mudgoll ,  ADA ' }));
  for (const n of ['MudGoll', 'Ada']) assert.equal((await as(W, n, 'GET', '/api/owner/teachers')).status, 200, n);
  assert.equal((await as(W, 'Cohen', 'GET', '/api/owner/teachers')).data.code, 'admin');
});

test('2. the owner\'s knight does everything /admin\'s Teachers does, each logged as "MudGoll (in game)": add, the list, New password, Turn off, Turn on, Lift the wait, the notice switch', async () => {
  const W = await world();
  let r = await as(W, 'MudGoll', 'GET', '/api/owner/teachers');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { teachers: [], acts: [], notice: true });
  r = await as(W, 'MudGoll', 'POST', '/api/owner/teachers', { name: 'Mrs O’Brien', pass: 'maple-river-lantern-42' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.name, "Mrs O'Brien");   // the name as the world keeps it: the one the teacher types
  const id = r.data.id;
  // the teacher made in the game signs in on the card like any other
  const lg = await K.teacherLogin(W.w, "Mrs O'Brien", 'maple-river-lantern-42');
  assert.equal(lg.teacher, true);
  const scr = await K.screen(W.w, lg.token);
  r = await as(W, 'MudGoll', 'GET', '/api/owner/teachers');
  const row = r.data.teachers[0];
  assert.deepEqual(Object.keys(row).sort(), ['actsToday', 'created', 'id', 'lastLogin', 'name', 'off', 'waiting', 'watching', 'wrongToday']);
  assert.deepEqual([row.name, row.created, row.lastLogin, row.watching, row.off], ["Mrs O'Brien", T0 + 4000, T0 + 4000, 1, false]);
  // New password: her screen closes (4013), the old one stops, the new one works
  r = await as(W, 'MudGoll', 'POST', '/api/owner/teachers/pass', { id, pass: 'new-password-here-1' });
  assert.equal(r.status, 200); assert.equal(scr.closed.code, 4013);
  assert.equal((await call(W.w, 'POST', '/api/login', { name: "Mrs O'Brien", pass: 'maple-river-lantern-42', teacherOk: 1 })).status, 401);
  // Turn off, then Turn on (with a new password, as on /admin)
  assert.equal((await as(W, 'MudGoll', 'POST', '/api/owner/teachers/off', { id })).status, 200);
  assert.equal((await call(W.w, 'POST', '/api/login', { name: "Mrs O'Brien", pass: 'new-password-here-1', teacherOk: 1 })).data.code, 'off');
  assert.equal((await as(W, 'MudGoll', 'POST', '/api/owner/teachers/on', { id })).status, 400);
  assert.equal((await as(W, 'MudGoll', 'POST', '/api/owner/teachers/on', { id, pass: 'fresh-start-word-9' })).status, 200);
  assert.equal((await call(W.w, 'POST', '/api/login', { name: "Mrs O'Brien", pass: 'fresh-start-word-9', teacherOk: 1 })).status, 200);
  // Lift the wait: 5 wrong from one tab make it wait; lifted, the right password goes in from that tab
  const tab = 'ab12ab12ab12ab12', at = { ip: '203.0.113.9' };
  for (let i = 0; i < 5; i++) await call(W.w, 'POST', '/api/login', { name: "Mrs O'Brien", pass: 'wrong-' + i, teacherOk: 1, tab }, at);
  assert.equal((await call(W.w, 'POST', '/api/login', { name: "Mrs O'Brien", pass: 'fresh-start-word-9', teacherOk: 1, tab }, at)).status, 429);
  r = await as(W, 'MudGoll', 'GET', '/api/owner/teachers');
  assert.deepEqual([r.data.teachers[0].waiting, r.data.teachers[0].wrongToday], [1, 6]);   // 6: the old password after New password counted too
  assert.equal((await as(W, 'MudGoll', 'POST', '/api/owner/teachers/lift', { id })).status, 200);
  assert.equal((await call(W.w, 'POST', '/api/login', { name: "Mrs O'Brien", pass: 'fresh-start-word-9', teacherOk: 1, tab }, at)).status, 200);
  // the notice switch
  assert.equal((await as(W, 'MudGoll', 'POST', '/api/owner/teachers/notice', { on: false })).status, 200);
  assert.equal((await as(W, 'MudGoll', 'GET', '/api/owner/teachers')).data.notice, false);
  assert.equal((await parent(W.w, 'GET', '/api/admin/teachers')).data.notice, false);   // one switch: /admin sees it too
  assert.equal((await as(W, 'MudGoll', 'POST', '/api/owner/teachers/notice', { on: true })).status, 200);
  const mine = modlog(W).filter(l => l.by === 'MudGoll (in game)').map(l => l.act + ' ' + l.target + (l.detail ? ' ' + l.detail : ''));
  assert.deepEqual(mine, ["teacher_add Mrs O'Brien (teacher)", "teacher_pass Mrs O'Brien (teacher)", "teacher_off Mrs O'Brien (teacher)", "teacher_on Mrs O'Brien (teacher)", "teacher_lift Mrs O'Brien (teacher)", 'teacher_notice everyone off', 'teacher_notice everyone on']);
  assert.equal(modlog(W).filter(l => l.by === 'parent page' && /^teacher_/.test(l.act)).length, 0);
  // /admin's "What admins did" reads them with the knight's name
  const seen = (await parent(W.w, 'GET', '/api/admin/modlog')).data.filter(x => x.by === 'MudGoll (in game)').length;
  assert.equal(seen, 7);
});

test('3. the same plain refusals as /admin, and nothing made: a short password, a bad name, a name taken by a teacher or a knight', async () => {
  const W = await world();
  const add = (name, pass) => as(W, 'MudGoll', 'POST', '/api/owner/teachers', { name, pass });
  const viaAdmin = (name, pass) => parent(W.w, 'POST', '/api/admin/teachers', { name, pass });
  const cases = [['Mrs Smith', 'cohen 123'], ['Mrs Smith', ''], ['Mrs Smith', 'x'.repeat(201)], ['M', 'long-enough-pass'], ['Mrs Smith 2', 'long-enough-pass'],
    ['Mrsthompsonsclass', 'long-enough-pass'], ['Cohen', 'long-enough-pass'], ['', 'long-enough-pass']];
  for (const [name, pass] of cases) {
    const a = await add(name, pass), b = await viaAdmin(name, pass);
    assert.ok(a.status >= 400, name + ' ' + a.status);
    assert.deepEqual([a.status, a.data.code, a.data.error], [b.status, b.data.code, b.data.error], name);
  }
  assert.equal(teacherRows(W).length, 0);
  assert.equal((await add('Mrs Smith', 'long-enough-pass')).status, 200);
  const again = await add('mrs. smith', 'another-long-one');
  assert.deepEqual([again.status, again.data.code, again.data.error], [409, 'taken', 'There is already a teacher called Mrs Smith. Pick another name, or press New password on Mrs Smith\'s row below to give them a new password.']);
  assert.equal((await as(W, 'MudGoll', 'POST', '/api/owner/teachers/pass', { id: 999, pass: 'long-enough-pass' })).status, 404);
  assert.equal((await as(W, 'MudGoll', 'PUT', '/api/owner/teachers', {})).status, 404);
  assert.equal((await as(W, 'MudGoll', 'GET', '/api/owner/teacher-acts')).status, 404);   // only the Teachers calls answer here
});

test('4. Undo, from the game: a teacher\'s mute is lifted, logged as "MudGoll (in game)"; nothing about the kid\'s knight but the mute changes', async () => {
  const W = await world();
  const T = await K.addTeacher(W.w);
  const lg = await K.teacherLogin(W.w, T.name, T.pass);
  const scr = await K.screen(W.w, lg.token);
  await K.online(W.w, W.tok.Sam); clock.t += 1100;
  const save = { v: 1, lv: 12, gold: 345 };
  assert.equal((await call(W.w, 'PUT', '/api/save', JSON.stringify(save), { token: W.tok.Sam })).status, 200);
  const r0 = K.act(W.w, scr, { t: 'w_mute', n: 'Sam', span: '1h' }); assert.equal(r0.t, 'w_ok');
  const acct = () => W.db.prepare("SELECT * FROM accounts WHERE name_lc = 'sam'").get();
  const saves = () => JSON.stringify(W.db.prepare("SELECT * FROM saves WHERE name_lc = 'sam' ORDER BY ver").all());
  const was = acct(), wasSaves = saves();
  assert.ok(was.muted_until > clock.t);
  let list = await as(W, 'MudGoll', 'GET', '/api/owner/teachers');
  const a = list.data.acts.find(x => x.act === 'mute' && x.inForce);
  assert.ok(a, JSON.stringify(list.data.acts));
  assert.deepEqual([a.teacher, a.target], ['Mrs Smith', 'Sam']);
  // another admin cannot undo it; the owner can
  assert.equal((await as(W, 'Ada', 'POST', '/api/owner/teachers/undo', { act: a.id })).status, 403);
  const r = await as(W, 'MudGoll', 'POST', '/api/owner/teachers/undo', { act: a.id });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const now = acct();
  assert.equal(now.muted_until, 0);
  for (const k of Object.keys(was)) if (k !== 'muted_until' && k !== 'last_seen') assert.deepEqual(now[k], was[k], k);
  assert.equal(saves(), wasSaves);
  const line = modlog(W).filter(l => l.act === 'unmute').pop();
  assert.deepEqual([line.by, line.target, line.detail], ['MudGoll (in game)', 'Sam', 'undo']);
  // the teacher's screen hears it in the owner's plain words
  assert.ok(scr.got.some(m => m.t === 'w_event' && m.text === "Ethan turned Sam's chat back on."));
  list = await as(W, 'MudGoll', 'GET', '/api/owner/teachers');
  assert.equal(list.data.acts.find(x => x.id === a.id).inForce, false);
  // twice: the same plain refusal as /admin
  const twice = await as(W, 'MudGoll', 'POST', '/api/owner/teachers/undo', { act: a.id });
  assert.deepEqual([twice.status, twice.data.code], [409, 'changed']);
});

test('5. no password, hash or salt ever reaches a knight\'s page: the list and every answer carry none, and mod_log holds none', async () => {
  const W = await world();
  const PASS = 'maple-river-lantern-42';
  const r = await as(W, 'MudGoll', 'POST', '/api/owner/teachers', { name: 'Mrs Smith', pass: PASS });
  const t = teacherRows(W)[0];
  const answers = [r, await as(W, 'MudGoll', 'GET', '/api/owner/teachers'), await as(W, 'MudGoll', 'POST', '/api/owner/teachers/pass', { id: t.id, pass: 'new-password-here-1' }),
    await as(W, 'MudGoll', 'POST', '/api/owner/teachers/on', { id: t.id, pass: 'fresh-start-word-9' }), await as(W, 'MudGoll', 'GET', '/api/owner/teachers')];
  const t2 = teacherRows(W)[0];
  for (const a of answers) {
    const s = JSON.stringify(a.data);
    for (const bad of [PASS, 'new-password-here-1', 'fresh-start-word-9', t.hash, t.salt, t2.hash, t2.salt, '"hash"', '"salt"']) assert.ok(!s.includes(bad), 'an answer carries ' + bad);
  }
  const log = JSON.stringify(modlog(W));
  for (const bad of [PASS, 'new-password-here-1', 'fresh-start-word-9', t.hash, t2.hash]) assert.ok(!log.includes(bad));
});

test('6. the contract: OWNER_KNIGHTS in wrangler.toml names MudGoll, deploy.sh refuses a tree without it, and the docs describe the section', () => {
  const toml = fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.match(toml, /^OWNER_KNIGHTS = "MudGoll"$/m);
  const deploy = fs.readFileSync(new URL('../deploy.sh', import.meta.url), 'utf8');
  assert.match(deploy, /OWNER_KNIGHTS/);
  const doc = fs.readFileSync(new URL('../../docs/ONLINE.md', import.meta.url), 'utf8');
  assert.match(doc, /### Teachers in the game/);
  assert.match(doc, /\/api\/owner\/teachers/);
});
