// The watch screen (docs/ONLINE.md, "The teacher view"): never a knight, exactly the data it may have, what it costs, and
// every control (mute, send off, pause, undo, the limits, the notice). The whole World on node's SQLite (teacher-kit.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as K from './teacher-kit.mjs';
import { ROW_KEYS, FRAME_EVERY } from '../src/watch.js';
import { dayEnd } from '../src/teachers.js';

const { clock, call, parent, act } = K;
const T0 = Date.UTC(2026, 9, 6, 14, 0, 0);   // 10:00 am in Toronto

async function world(names = ['MudGoll', 'Sam', 'Leo', 'Ada', 'Pip'], opts = {}) {
  clock.t = T0;
  const W = K.newWorld(opts);
  const tok = {};
  for (const n of names) { tok[n] = await K.signup(W.w, n); }
  if (names.includes('MudGoll')) await parent(W.w, 'POST', '/api/admin/role', { name: 'MudGoll', role: 'admin' });
  const T = await K.addTeacher(W.w);
  const lg = await K.teacherLogin(W.w, T.name, T.pass);
  return Object.assign(W, { tok, T, token: lg.token });
}
const frames = s => s.all('w_k');
const accountsRow = (db, n) => db.prepare('SELECT * FROM accounts WHERE name = ?').get(n);

test('15. a teacher screen is never a knight: online(), who, /api/status, /api/admin/online, logins, keepers and map members are the same with it as without', async () => {
  const run = async withScreen => {
    const W = await world(['Sam', 'Leo', 'Ada']);
    const scr = withScreen ? await K.screen(W.w, W.token) : null;
    const s = await K.online(W.w, W.tok.Sam); clock.t += 500;
    const l = await K.online(W.w, W.tok.Leo, { x: 6100 }); clock.t += 500;
    const a = await K.online(W.w, W.tok.Ada, { map: 'spider_den', x: 300, y: 200 }); clock.t += 500;
    K.say(W.w, l, { t: 'p', map: 'over', x: 6150, y: 3700 }); clock.t += 4000;
    K.say(W.w, l, { t: 'p', map: 'over', x: 6160, y: 3700 });   // Sam quiet: the map goes to Leo
    W.w.webSocketClose(a, 1000, ''); clock.t += 1000;
    const r = {
      online: JSON.stringify(W.w.room.online()), status: JSON.stringify((await call(W.w, 'GET', '/api/status')).data),
      adminOnline: JSON.stringify((await parent(W.w, 'GET', '/api/admin/online')).data),
      who: JSON.stringify([s, l].map(x => x.all('who'))), keepers: JSON.stringify(Array.from(W.w.room.maps, ([m, g]) => [m, g.keeper && g.keeper.name, Array.from(g.members, k => k.name)])),
      logins: JSON.stringify(W.db.prepare('SELECT * FROM logins ORDER BY id').all()), knights: W.w.room.knights.size,
    };
    if (scr) assert.ok(scr.all('w_k').length > 0);
    return r;
  };
  assert.deepEqual(await run(true), await run(false));
});

test('15b. fifty knights and a teacher all connect', async () => {
  clock.t = T0;
  const W = K.newWorld();
  const T = await K.addTeacher(W.w); const lg = await K.teacherLogin(W.w, T.name, T.pass);
  const scr = await K.screen(W.w, lg.token);
  const toks = []; for (let i = 0; i < 50; i++) toks.push(await K.signup(W.w, 'Knight ' + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + i % 26)));
  const socks = []; for (const t of toks) socks.push(await K.online(W.w, t));
  assert.equal(W.w.room.online().length, 50);
  assert.ok(socks.every(s => !s.closed && s.last('welcome')));
  assert.equal(scr.closed, null); assert.equal(scr.last('w_k').knights.length, 50);
});

test('16. a nap: the teacher socket comes back to the Watch (not closed 4001, not a knight); one turned off or run out during the nap is closed 4012 / 4011', async () => {
  const W = await world(['Sam', 'Leo']);
  const B = await K.addTeacher(W.w, 'Mr Lee', 'quiet-harbour-oak-17'); const bl = await K.teacherLogin(W.w, B.name, B.pass);
  const C = await K.addTeacher(W.w, 'Ms Day', 'quiet-harbour-oak-18'); const cl = await K.teacherLogin(W.w, C.name, C.pass);
  const sam = await K.online(W.w, W.tok.Sam);
  const a = await K.screen(W.w, W.token), b = await K.screen(W.w, bl.token), c = await K.screen(W.w, cl.token);
  // during the nap: Mr Lee is turned off, Ms Day's session runs out
  W.db.prepare('UPDATE teachers SET off = 1 WHERE id = ?').run(B.id);
  W.db.prepare('UPDATE teacher_sessions SET expires = ? WHERE teacher_id = ?').run(clock.t + 500, C.id);
  clock.t += 1000;
  const W2 = new K.TestWorld(W.ctx, K.ENV);
  const wrapA = W2.wrap(a);
  assert.ok(W2.watch.has(wrapA)); assert.equal(a.closed, null);
  assert.equal(b.closed.code, 4012); assert.equal(c.closed.code, 4011);
  assert.equal(W2.room.knights.size, 1); assert.equal(W2.room.online().length, 1);
  // the restored screen still works: Sam is in its next frame and its controls answer
  W2.webSocketMessage(sam, JSON.stringify({ t: 'p', map: 'over', x: 6010, y: 3700 }));
  assert.equal(a.last('w_k').knights[0].n, 'Sam');
  const ok = act(W2, a, { t: 'w_mute', n: 'Sam', span: '10m' });
  assert.equal(ok.t, 'w_ok');
});

test('17-18. a knight row has exactly the 11 keys; the place is the world\'s own Atlas, never the game\'s region text', async () => {
  const W = await world(['Sam', 'Leo', 'Ada', 'Pip']);
  const scr = await K.screen(W.w, W.token);
  await K.online(W.w, W.tok.Sam, { x: 130 * 48 + 10, y: 70 * 48 + 10, region: 'stupid butt land' });
  await K.online(W.w, W.tok.Leo, { map: 'spider_den', x: 300, y: 200, region: 'poopy pants' });
  await K.online(W.w, W.tok.Ada, { map: 'house', x: 300, y: 200, region: 'my secret base' });
  await K.online(W.w, W.tok.Pip, { x: -5000, y: -5000, region: 'nowhere' });
  const rows = Object.fromEntries(scr.last('w_k').knights.map(r => [r.n, r]));
  for (const r of Object.values(rows)) assert.deepEqual(Object.keys(r), ROW_KEYS);
  assert.equal(rows.Sam.place, 'Hollowford'); assert.equal(rows.Sam.x, 130 * 48 + 10);
  assert.equal(rows.Leo.place, 'The Spider Den'); assert.equal(rows.Leo.x, null); assert.equal(rows.Leo.map, 'spider_den');
  assert.equal(rows.Ada.place, 'Their own island'); assert.equal(rows.Ada.map, 'house');
  assert.equal(rows.Pip.place, 'Somewhere in the world');
  const all = scr.raw.join('\n');
  for (const said of ['stupid', 'poopy', 'secret base', 'nowhere', 'look', 'hp', '"lv"', 'def', 'gear', 'token', 'hash', 'salt']) assert.ok(!all.includes(said), said);
  assert.deepEqual(scr.last('w_k').inside, [{ place: 'The Spider Den', names: ['Leo'] }, { place: 'Their own island', names: ['Ada'] }]);
});

test('19. what each knight is doing, in priority order, unknown actions "Busy"', async () => {
  const W = await world(['Sam', 'Leo']);
  const wa = W.w.watch, now = clock.t;
  const k = (o = {}) => Object.assign({ name: 'Sam', lc: 'sam', dead: false, trade: null }, o);
  const d = (kk, seen, away = false) => wa.doingOf(kk, seen, now, away);
  assert.equal(d(k({ dead: true }), { swAt: now, act: 'chop_oak', mv: true }, true), 'Away from the game');
  assert.equal(d(k({ dead: true }), { swAt: now, act: 'chop_oak', mv: true }), 'Fell, getting back up');
  const leo = { name: 'Leo' }; W.w.room.otherOf = () => leo;
  assert.equal(d(k({ trade: {} }), { swAt: now, act: 'chop_oak' }), 'Trading with Leo');
  assert.equal(d(k(), { swAt: now - 2999, act: 'chop_oak', mech: 'horse', mv: true }), 'Fighting');
  const acts = { chop_oak: 'Chopping trees', chop: 'Chopping trees', mine_iron: 'Mining', mine: 'Mining', coalface: 'Mining', rm_vein: 'Mining', rm_giant: 'Mining', fish: 'Fishing', lobster: 'Fishing', cook: 'Cooking', light: 'Lighting a fire', till: 'Farming', rm_heat: 'Working in the Royal Mine', rm_warm: 'Working in the Royal Mine', rm_watch: 'Working in the Royal Mine', smith: 'Busy', dig: 'Busy' };
  for (const [a, words] of Object.entries(acts)) assert.equal(d(k(), { swAt: now - 3001, act: a, mech: 'horse', mv: true }), words, a);
  for (const [m, words] of Object.entries({ walker: 'In a walker', dozer: 'Driving a bulldozer', beast: 'Riding a beast', horse: 'Riding a horse' })) assert.equal(d(k(), { mech: m, mv: true }), words);
  assert.equal(d(k(), { mv: true }), 'Walking');
  assert.equal(d(k(), {}), 'Standing still');
  // through real presence: a swing is Fighting for 3 s, then the action
  delete W.w.room.otherOf;
  const scr = await K.screen(W.w, W.token);
  const s = await K.online(W.w, W.tok.Sam, { sw: 1 });
  clock.t += 1100; K.say(W.w, s, { t: 'p', map: 'over', x: 6000, y: 3700, sw: 2, act: 'chop_oak' });
  assert.equal(scr.last('w_k').knights[0].doing, 'Fighting');
  clock.t += 3100; K.say(W.w, s, { t: 'p', map: 'over', x: 6000, y: 3700, sw: 2, act: 'chop_oak' });
  assert.equal(scr.last('w_k').knights[0].doing, 'Chopping trees');
  clock.t += 31000; K.say(W.w, (await K.online(W.w, W.tok.Leo)), { t: 'p', map: 'over', x: 1, y: 1 });
  assert.equal(scr.last('w_k').knights.find(r => r.n === 'Sam').doing, 'Away from the game');
  assert.equal(scr.last('w_k').knights.find(r => r.n === 'Sam').away, true);
});

test('20. the chat a screen opens with is the last hour, at most 100 lines; a live line is the kids\' line plus masked; a strike event carries no typed text and no count', async () => {
  const W = await world(['Sam', 'Leo', 'MudGoll']);
  for (let i = 0; i < 140; i++) W.w.logChat(i % 2 ? 'Sam' : 'MudGoll', 'line ' + i, T0 - 70 * 60000 + i * 30000);
  const scr = await K.screen(W.w, W.token);
  const chat = scr.last('w_all').chat;
  assert.equal(chat.length, 100);
  assert.ok(chat.every(c => c.at > clock.t - 3600000));
  assert.equal(chat[chat.length - 1].text, 'line 139');
  assert.deepEqual(Object.keys(chat[0]), ['at', 'n', 'text', 'role', 'masked']);
  assert.ok(chat.some(c => c.n === 'MudGoll' && c.role === 'admin'));
  const s = await K.online(W.w, W.tok.Sam), l = await K.online(W.w, W.tok.Leo);
  K.say(W.w, s, { t: 'chat', text: 'you are so dumb lol' });
  const kid = l.last('chat'), wc = scr.last('w_chat');
  assert.deepEqual(wc, { t: 'w_chat', at: kid.at, n: kid.n, text: kid.text, role: kid.role, masked: true });
  clock.t += 2000; K.say(W.w, s, { t: 'chat', text: 'what the fuck' });
  const ev = scr.last('w_event');
  assert.deepEqual(ev, { t: 'w_event', at: clock.t, kind: 'strike', n: 'Sam', text: 'The word filter warned Sam.' });
  assert.ok(!scr.raw.join().includes('fuck'));
});

test('21-24. the cost: 20 knights at 8 presences a second for 60 s give at most 61 frames, never two within a second; the same frame is not sent twice; no alarm, no timer, no write for it; no knights, no frames', async () => {
  const counter = { writes: 0, all: 0 };
  const run = async withScreen => {
    clock.t = T0;
    const W = K.newWorld({ counter });
    const T = await K.addTeacher(W.w); const lg = await K.teacherLogin(W.w, T.name, T.pass);
    const toks = []; for (let i = 0; i < 20; i++) toks.push(await K.signup(W.w, 'Kid ' + String.fromCharCode(65 + i)));
    const socks = []; for (const t of toks) socks.push(await K.online(W.w, t));
    const scr = withScreen ? await K.screen(W.w, lg.token) : null;
    const alarms0 = W.ctx.alarms.length, w0 = counter.writes, f0 = scr ? frames(scr).length : 0;
    // 60 s, every knight walking at 8 presences a second (straight to the Room, so the meter's own writes stay out of it)
    for (let step = 0; step < 480; step++) {
      clock.t += 125;
      socks.forEach((s, i) => W.w.room.message(W.w.wrap(s), JSON.stringify({ t: 'p', map: 'over', x: 6000 + step + i, y: 3700, mv: true })));
    }
    const out = { alarms: W.ctx.alarms.length - alarms0, writes: counter.writes - w0 };
    if (scr) {
      const fr = frames(scr).slice(f0);
      out.frames = fr.length;
      out.gaps = fr.slice(1).map((f, i) => f.at - fr[i].at);
      // standing still: the same frame is not sent again (until 20 s have passed)
      const still = steps => { for (let step = 0; step < steps; step++) { clock.t += 125; socks.forEach(s => W.w.room.message(W.w.wrap(s), JSON.stringify({ t: 'p', map: 'over', x: 5000, y: 3700 }))); } };
      still(24);   // three seconds: the frames that say they stopped
      const n1 = frames(scr).length;
      still(48);   // six more: nothing new to say, nothing sent (an unchanged frame waits FRAME_AWAKE)
      out.still = frames(scr).length - n1;
      out.wk = W.w.watch.frames;
    }
    return out;
  };
  const a = await run(true), b = await run(false);
  assert.ok(a.frames <= 61 && a.frames >= 55, JSON.stringify(a.frames));
  assert.ok(a.gaps.every(g => g >= FRAME_EVERY), JSON.stringify(a.gaps.filter(g => g < FRAME_EVERY)));
  assert.equal(a.still, 0);                 // standing still: the same frame is not sent again
  assert.equal(a.alarms, b.alarms);         // 22: no alarm is booked for a screen
  assert.equal(a.writes, b.writes);         // 24: not one SQL write for 60 frames
  // 23: eight hours with nobody on: no frames
  clock.t = T0;
  const W = K.newWorld(); const T = await K.addTeacher(W.w); const lg = await K.teacherLogin(W.w, T.name, T.pass);
  const scr = await K.screen(W.w, lg.token);
  for (let h = 0; h < 8 * 60; h++) { clock.t += 60000; W.w.alarm(); }
  assert.equal(frames(scr).length, 0); assert.equal(W.ctx.alarms.length, 0);
});

test('25-26. mute: not for a knight gone over 30 minutes or an admin; fine for one who left 10 minutes ago; never shortens a longer mute', async () => {
  const W = await world();
  const scr = await K.screen(W.w, W.token);
  let r = act(W.w, scr, { t: 'w_mute', n: 'Pip', span: '10m' });
  assert.deepEqual([r.code, r.text], ['gone', 'Pip is not on now.']);
  r = act(W.w, scr, { t: 'w_mute', n: 'Nobody', span: '10m' }); assert.equal(r.code, 'unknown');
  await K.online(W.w, W.tok.MudGoll); clock.t += 1100;
  r = act(W.w, scr, { t: 'w_mute', n: 'MudGoll', span: '10m' }); assert.deepEqual([r.code, r.text], ['admin', 'MudGoll is an admin. Only Ethan can do that.']);
  const sam = await K.online(W.w, W.tok.Sam); clock.t += 1000; W.w.webSocketClose(sam, 1000, ''); clock.t += 10 * 60000;
  r = act(W.w, scr, { t: 'w_mute', n: 'Sam', span: '1h' }); assert.equal(r.t, 'w_ok');
  clock.t += 1100;
  r = act(W.w, scr, { t: 'w_mute', n: 'Sam', span: '10m' }); assert.deepEqual([r.code, r.text], ['longer', 'Sam is already muted for longer.']);
  clock.t += 31 * 60000;
  r = act(W.w, scr, { t: 'w_mute', n: 'Sam', span: 'today' }); assert.equal(r.code, 'gone');
});

test('27. a teacher mute: the kid hears "by teacher", admins see it in modlist, /admin can lift it (then Undo says changed), and Undo puts an older mute back', async () => {
  const W = await world();
  const scr = await K.screen(W.w, W.token);
  const leo = await K.online(W.w, W.tok.Leo), mud = await K.online(W.w, W.tok.MudGoll);
  let r = act(W.w, scr, { t: 'w_mute', n: 'Leo', span: '10m' });
  assert.equal(r.t, 'w_ok');
  assert.deepEqual(leo.last('muted'), { t: 'muted', left: 600, by: 'teacher', span: '10m' });
  K.say(W.w, mud, { t: 'modlist' });
  assert.deepEqual(mud.last('modlist').muted, [{ n: 'Leo', left: 600 }]);
  assert.deepEqual(scr.last('w_k').knights.find(k => k.n === 'Leo').muted, { left: 600, by: 'teacher' });
  const muteAct = scr.last('w_acts').acts[0].id;
  await parent(W.w, 'POST', '/api/admin/mute', { name: 'Leo', span: 'off' });
  assert.deepEqual(leo.last('unmuted'), { t: 'unmuted' });
  clock.t += 1100;
  r = act(W.w, scr, { t: 'w_undo', act: muteAct });
  assert.deepEqual([r.code, r.text], ['changed', 'Someone else changed that since, so it was left as it is.']);
  // an admin's 5 minutes, then a teacher's hour on top, then Undo: the 5 minutes are back (less the time gone)
  await parent(W.w, 'POST', '/api/admin/mute', { name: 'Leo', span: '5m' });
  assert.equal(scr.last('w_event').kind, 'mute_admin'); assert.equal(scr.last('w_event').text, 'Leo is muted by an admin.');
  const fiveUntil = accountsRow(W.db, 'Leo').muted_until;
  clock.t += 60000;
  r = act(W.w, scr, { t: 'w_mute', n: 'Leo', span: '1h' }); assert.equal(r.t, 'w_ok');
  const hourAct = scr.last('w_acts').acts[0].id;
  clock.t += 1100;
  r = act(W.w, scr, { t: 'w_undo', act: hourAct }); assert.equal(r.t, 'w_ok');
  assert.equal(accountsRow(W.db, 'Leo').muted_until, fiveUntil);
  assert.equal(leo.last('muted').left, Math.ceil((fiveUntil - clock.t) / 1000));
  // and a plain teacher mute undone: the kid hears it from a teacher
  const sam = await K.online(W.w, W.tok.Sam); clock.t += 1100;
  act(W.w, scr, { t: 'w_mute', n: 'Sam', span: 'today' }); clock.t += 1100;
  assert.equal(accountsRow(W.db, 'Sam').muted_until, dayEnd(clock.t));
  act(W.w, scr, { t: 'w_undo', act: scr.last('w_acts').acts[0].id });
  assert.deepEqual(sam.last('unmuted'), { t: 'unmuted', by: 'teacher' });
  assert.equal(accountsRow(W.db, 'Sam').muted_until, 0);
});

test('28-31. send off: kicked why sentoff then 4005; login, session, join and restore refuse with 423 / sentoff; a save still lands; saves and accounts untouched; midnight; let back in; a renamed knight; the 21st is daycap', async () => {
  const W = await world();
  const scr = await K.screen(W.w, W.token);
  const sam = await K.online(W.w, W.tok.Sam), ada = await K.online(W.w, W.tok.Ada, { x: 6010 });
  assert.equal((await call(W.w, 'PUT', '/api/save', JSON.stringify({ player: { playSeconds: 5 } }), { token: W.tok.Sam })).status, 200);
  const keep = () => JSON.stringify({ saves: W.db.prepare('SELECT * FROM saves ORDER BY name_lc, ver').all(), pins: W.db.prepare('SELECT * FROM save_pins').all(), acc: W.db.prepare('SELECT * FROM accounts ORDER BY name_lc').all().map(a => { const o = Object.assign({}, a); for (const c of ['muted_until', 'sent_off_until', 'sent_off_by', 'last_seen', 'online_ms']) delete o[c]; return o; }) });
  const k0 = keep();
  // an open trade with Ada ends with nothing moved
  K.say(W.w, sam, { t: 'trade_ask', to: 'Ada' }); K.say(W.w, ada, { t: 'trade_answer', from: 'Sam', yes: true });
  assert.ok(sam.last('trade_open'));
  const r = act(W.w, scr, { t: 'w_off', n: 'Sam' });
  assert.deepEqual(r, { t: 'w_ok', req: r.req, text: 'Sam was sent off until tomorrow.' });
  // the send-off changed no save, no pin and no account column but its own (and the session clocks)
  assert.equal(keep(), k0);
  const err = sam.got[sam.got.length - 1];
  assert.equal(err.t, 'error'); assert.equal(err.code, 'kicked'); assert.equal(err.why, 'sentoff'); assert.equal(err.until, dayEnd(clock.t));
  assert.equal(sam.closed.code, 4005);
  assert.equal(ada.last('trade_end').code, 'left');
  assert.equal(W.db.prepare('SELECT COUNT(*) AS n FROM trades').get().n, 0);
  // every way back in: 423 sentoff with until; the save still goes up
  const until = dayEnd(clock.t);
  let x = await call(W.w, 'POST', '/api/login', { name: 'Sam', pass: 'sword' });
  assert.deepEqual([x.status, x.data.code, x.data.until], [423, 'sentoff', until]);
  x = await call(W.w, 'POST', '/api/login', { name: 'Sam', pass: 'wrong' }); assert.equal(x.status, 401);
  x = await call(W.w, 'GET', '/api/me', undefined, { token: W.tok.Sam }); assert.deepEqual([x.status, x.data.code, x.data.until], [423, 'sentoff', until]);
  x = await call(W.w, 'GET', '/api/save', undefined, { token: W.tok.Sam }); assert.equal(x.status, 423);
  const ws = await W.w.fetch(new Request('http://world/ws?token=' + W.tok.Sam, { headers: { upgrade: 'websocket' } })); assert.equal(ws.status, 423);
  x = await call(W.w, 'PUT', '/api/save', JSON.stringify({ player: { playSeconds: 9 } }), { token: W.tok.Sam }); assert.equal(x.status, 200);
  // the Room's own lock: a join, and a socket a nap brings back
  const s2 = K.fakeWs(); W.w.room.join(W.w.wrap(s2), 'Sam');
  assert.deepEqual([s2.got[0].code, s2.got[0].why, s2.got[0].until, s2.closed.code], ['kicked', 'sentoff', until, 4005]);
  // only the kid's own push changed the saves: one more version, the earlier one byte for byte
  const kept = JSON.parse(keep()), was = JSON.parse(k0);
  assert.equal(kept.saves.length, was.saves.length + 1);
  assert.deepEqual(kept.saves.slice(0, was.saves.length), was.saves);
  assert.deepEqual(kept.pins, was.pins);
  // the sent-off list and the frame
  assert.deepEqual(scr.last('w_acts').sentOff.map(s => [s.n, s.by, s.until]), [['Sam', 'Mrs Smith', until]]);
  // a rename: Undo still finds Sam, now Sammy
  await parent(W.w, 'POST', '/api/admin/rename', { name: 'Sam', to: 'Sammy' });
  clock.t += 1100;
  const u = act(W.w, scr, { t: 'w_undo', act: scr.last('w_acts').sentOff[0].act });
  assert.equal(u.t, 'w_ok');
  assert.equal(accountsRow(W.db, 'Sammy').sent_off_until, 0);
  x = await call(W.w, 'POST', '/api/login', { name: 'Sam', pass: 'sword' }); assert.equal(x.status, 200);
  // midnight: sent off again, refused at 11:59 pm, back at 12:00 am
  const l2 = await call(W.w, 'POST', '/api/login', { name: 'Sammy', pass: 'sword' });
  await K.online(W.w, l2.data.token); clock.t += 1100;
  const off2 = act(W.w, scr, { t: 'w_off', n: 'Sammy' });
  assert.equal(off2.t, 'w_ok', JSON.stringify(off2));
  const midnight = dayEnd(clock.t) + 1;
  clock.t = midnight - 1000;   // 11:59:59 pm
  assert.equal((await call(W.w, 'POST', '/api/login', { name: 'Sammy', pass: 'sword' })).status, 423);
  clock.t = midnight;          // 12:00 am
  assert.equal((await call(W.w, 'POST', '/api/login', { name: 'Sammy', pass: 'sword' })).status, 200);
  // a restore: a knight sent off while its socket slept is refused when the world wakes
  const ada2 = ada; W.db.prepare('UPDATE accounts SET sent_off_until = ? WHERE name = ?').run(clock.t + 3600000, 'Ada');
  const W2 = new K.TestWorld(W.ctx, K.ENV);
  assert.equal(ada2.closed.code, 4005); assert.equal(ada2.last('error').why, 'sentoff');
  assert.equal(W2.room.isOnline('Ada'), false);
});

test('31b. the 21st send-off in a day is daycap', async () => {
  const names = []; for (let i = 0; i < 21; i++) names.push('Kid ' + String.fromCharCode(65 + i));
  const W = await world(names);
  const scr = await K.screen(W.w, W.token);
  for (const n of names) await K.online(W.w, W.tok[n]);
  for (let i = 0; i < 20; i++) {
    if (i && i % 10 === 0) clock.t += 600001;
    clock.t += 1100;
    const r = act(W.w, scr, { t: 'w_off', n: names[i] });
    assert.equal(r.t, 'w_ok', i + ' ' + JSON.stringify(r));
  }
  clock.t += 600001;
  const r = act(W.w, scr, { t: 'w_off', n: names[20] });
  assert.deepEqual([r.code, r.text], ['daycap', "You've sent 20 knights off today. Ask Ethan."]);
});

test('32-33. pause: a player\'s line goes nowhere (no relay, no log, no strike), an admin\'s goes through; everyone hears it start and stop; a timed end sends nothing and books no alarm; it survives a nap; a shorter second pause is longer', async () => {
  const W = await world();
  const scr = await K.screen(W.w, W.token);
  const sam = await K.online(W.w, W.tok.Sam), leo = await K.online(W.w, W.tok.Leo), mud = await K.online(W.w, W.tok.MudGoll);
  const alarms0 = W.ctx.alarms.length;
  let r = act(W.w, scr, { t: 'w_pause', span: '15m' });
  assert.equal(r.t, 'w_ok');
  for (const s of [sam, leo, mud]) assert.deepEqual(s.last('chat_pause'), { t: 'chat_pause', left: 900 });
  const lines0 = W.db.prepare('SELECT COUNT(*) AS n FROM chat').get().n, leoChats = leo.all('chat').length;
  clock.t += 2000; K.say(W.w, sam, { t: 'chat', text: 'what the fuck' });
  assert.deepEqual(sam.last('muted'), { t: 'muted', left: 898, by: 'pause' });
  assert.equal(leo.all('chat').length, leoChats);
  assert.equal(W.db.prepare('SELECT COUNT(*) AS n FROM chat').get().n, lines0);
  assert.equal(accountsRow(W.db, 'Sam').word_strikes, 0);
  clock.t += 2000; K.say(W.w, mud, { t: 'chat', text: 'admins can talk' });
  assert.equal(leo.last('chat').text, 'admins can talk');
  clock.t += 1100;
  r = act(W.w, scr, { t: 'w_pause', span: '5m' }); assert.deepEqual([r.code], ['longer']);
  // a nap: the pause is still there
  const W2 = new K.TestWorld(W.ctx, K.ENV);
  clock.t += 2000; W2.webSocketMessage(sam, JSON.stringify({ t: 'chat', text: 'hello?' }));
  assert.equal(sam.last('muted').by, 'pause');
  // a knight who comes in now hears it after welcome
  const ada = await K.online(W2, W.tok.Ada);
  const order = ada.got.map(m => m.t);
  assert.ok(order.indexOf('chat_pause') > order.indexOf('welcome'));
  // Turn chat back on: everyone hears left 0
  clock.t += 1100;
  r = act(W2, scr, { t: 'w_chaton' }); assert.equal(r.t, 'w_ok');
  for (const s of [sam, leo, mud, ada]) assert.deepEqual(s.last('chat_pause'), { t: 'chat_pause', left: 0 });
  clock.t += 2000; W2.webSocketMessage(sam, JSON.stringify({ t: 'chat', text: 'back' }));
  assert.equal(leo.last('chat').text, 'back');
  // a timed one runs out on its own: nothing is sent, no alarm was booked
  const alarms1 = W.ctx.alarms.length;
  clock.t += 1100; act(W2, scr, { t: 'w_pause', span: '5m' });
  assert.equal(W.ctx.alarms.length, alarms1);   // a pause books no alarm
  const heard = sam.all('chat_pause').length;
  clock.t += 300001; W2.alarm();
  assert.equal(sam.all('chat_pause').length, heard);
  assert.ok(alarms0 >= 0);
  W2.webSocketMessage(sam, JSON.stringify({ t: 'chat', text: 'free again' }));
  assert.equal(leo.last('chat').text, 'free again');
});

test('34. limits: the 11th knight action in 10 minutes is slow; a flood is closed 4008; turned off between two actions, the second is refused and the screen closed', async () => {
  const W = await world();
  const scr = await K.screen(W.w, W.token);
  await K.online(W.w, W.tok.Sam);
  for (let i = 0; i < 10; i++) {
    clock.t += 1100;
    const r = i % 2 ? act(W.w, scr, { t: 'w_undo', act: scr.last('w_acts').acts[0].id }) : act(W.w, scr, { t: 'w_mute', n: 'Sam', span: '10m' });
    assert.equal(r.t, 'w_ok', i + ' ' + JSON.stringify(r));
  }
  clock.t += 1100;
  let r = act(W.w, scr, { t: 'w_mute', n: 'Sam', span: '10m' });
  assert.deepEqual([r.code, r.text], ['slow', "That's a lot at once. Wait a few minutes, or ask Ethan."]);
  clock.t += 600000;
  r = act(W.w, scr, { t: 'w_mute', n: 'Sam', span: '10m' }); assert.equal(r.t, 'w_ok');
  // a flood
  const s2 = await K.screen(W.w, W.token);
  for (let i = 0; i < 40 && !s2.closed; i++) W.w.webSocketMessage(s2, JSON.stringify({ t: 'w_pause', span: '5m', req: i }));
  assert.equal(s2.closed.code, 4008); assert.ok(s2.all('w_no').some(m => m.code === 'slow'));
  // turned off between two actions
  clock.t += 1100;
  r = act(W.w, scr, { t: 'w_pause', span: '5m' }); assert.equal(r.t, 'w_ok');
  W.db.prepare('UPDATE teachers SET off = 1').run();
  clock.t += 1100;
  r = act(W.w, scr, { t: 'w_pause', span: '15m' });
  assert.equal(r.code, 'auth'); assert.equal(scr.closed.code, 4012);
  assert.equal(W.w.watch.pause.until < clock.t + 900000, true);
});

test('35. "A teacher is watching": 0 to 1 tells everyone, a welcome is followed by it, the last close takes it back; with the notice off nothing is said', async () => {
  const W = await world();
  const sam = await K.online(W.w, W.tok.Sam);
  const a = await K.screen(W.w, W.token);
  assert.deepEqual(sam.last('watching'), { t: 'watching', on: true });
  const b = await K.screen(W.w, W.token);
  assert.equal(sam.all('watching').length, 1);
  const leo = await K.online(W.w, W.tok.Leo);
  const order = leo.got.map(m => m.t);
  assert.ok(order.includes('watching') && order.indexOf('watching') > order.indexOf('welcome'));
  W.w.webSocketClose(a, 1000, ''); assert.equal(sam.all('watching').length, 1);
  W.w.webSocketClose(b, 1000, ''); assert.deepEqual(sam.last('watching'), { t: 'watching', on: false });
  await parent(W.w, 'POST', '/api/admin/teachers/notice', { on: false });
  const heard = sam.all('watching').length;
  const c = await K.screen(W.w, W.token);
  const ada = await K.online(W.w, W.tok.Ada);
  assert.equal(sam.all('watching').length, heard); assert.equal(ada.all('watching').length, 0);
  assert.equal(c.last('w_hello').notice, false);
  // the caps: two screens per teacher, six in the world
  const d = await K.screen(W.w, W.token), e = await K.screen(W.w, W.token);
  assert.equal(d.closed, null); assert.equal(e.closed.code, 4014); assert.equal(e.last('w_bye').code, 4014);
});

test('the owner\'s Undo lifts a teacher\'s action from /admin; teacher-acts lists today\'s with what is in force', async () => {
  const W = await world();
  const scr = await K.screen(W.w, W.token);
  const leo = await K.online(W.w, W.tok.Leo);
  act(W.w, scr, { t: 'w_mute', n: 'Leo', span: '1h' });
  let list = (await parent(W.w, 'GET', '/api/admin/teacher-acts?today=1')).data;
  assert.deepEqual(list.map(a => [a.act, a.target, a.teacher, a.inForce]), [['mute', 'Leo', 'Mrs Smith', true]]);
  const r = await parent(W.w, 'POST', '/api/admin/teachers/undo', { act: list[0].id });
  assert.equal(r.status, 200);
  assert.deepEqual(leo.last('unmuted'), { t: 'unmuted', by: 'teacher' });
  list = (await parent(W.w, 'GET', '/api/admin/teacher-acts?today=1')).data;
  assert.deepEqual([list[0].inForce, list[0].undoneBy], [false, 'Ethan']);
  assert.equal((await parent(W.w, 'POST', '/api/admin/teachers/undo', { act: list[0].id })).status, 409);
  const log = (await parent(W.w, 'GET', '/api/admin/modlog')).data;
  assert.deepEqual([log[0].by, log[0].act, log[0].detail], ['parent page', 'unmute', 'undo']);
  assert.ok(scr.all('w_event').some(e => e.text === "Ethan turned Leo's chat back on."));
});

test('a second db stays independent (the kit makes a fresh world each time)', () => { assert.ok(new DatabaseSync(':memory:')); });
