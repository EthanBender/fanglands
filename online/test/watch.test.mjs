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
  // Sam stands on Hollowford's square (a port of the world's own Atlas: the Great Spread moved it)
  const [hx, hy] = K.ATLAS_JSON.ports['hollowford.square'], HX = hx * 48 + 10, HY = hy * 48 + 10;
  await K.online(W.w, W.tok.Sam, { x: HX, y: HY, region: 'stupid butt land' });
  await K.online(W.w, W.tok.Leo, { map: 'spider_den', x: 300, y: 200, region: 'poopy pants' });
  await K.online(W.w, W.tok.Ada, { map: 'house', x: 300, y: 200, region: 'my secret base' });
  await K.online(W.w, W.tok.Pip, { x: -5000, y: -5000, region: 'nowhere' });
  const rows = Object.fromEntries(scr.last('w_k').knights.map(r => [r.n, r]));
  for (const r of Object.values(rows)) assert.deepEqual(Object.keys(r), ROW_KEYS);
  assert.equal(rows.Sam.place, 'Hollowford'); assert.equal(rows.Sam.x, HX);
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
  // a screen opened afterwards still flags the starred lines (chat_masked), and only those
  clock.t += 2000;
  const scr2 = await K.screen(W.w, W.token);
  const back = scr2.last('w_all').chat.slice(-2);
  assert.deepEqual(back.map(c => [c.n, c.masked]), [['Sam', true], ['Sam', true]]);
  assert.ok(back.every(c => !c.text.includes('dumb') && !c.text.includes('fuck')));
  assert.ok(scr2.last('w_all').chat.slice(0, -2).every(c => c.masked === false));
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
  // the socket is let through to the Room, which says the send-off and closes 4005 (a refused upgrade reaches a game only as
  // 1006, and the game would try again every 15 s until midnight); no login is started, no knight joins
  const logins0 = W.db.prepare('SELECT COUNT(*) AS n FROM logins').get().n, knights0 = W.w.room.knights.size;
  const ws = await W.w.fetch(new Request('http://world/ws?token=' + W.tok.Sam, { headers: { upgrade: 'websocket' } })); assert.equal(ws.status, 101);
  const s3 = W.w.ctx.sockets[W.w.ctx.sockets.length - 1];
  assert.deepEqual([s3.got.length, s3.got[0].t, s3.got[0].code, s3.got[0].why, s3.got[0].until, s3.closed.code], [1, 'error', 'kicked', 'sentoff', until, 4005]);
  assert.equal(W.db.prepare('SELECT COUNT(*) AS n FROM logins').get().n, logins0); assert.equal(W.w.room.knights.size, knights0);
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

test('a screen whose session ran out is closed 4011 the next time the world has something to tell it (no timer)', async () => {
  const W = await world(['Sam']);
  const scr = await K.screen(W.w, W.token);
  const sam = await K.online(W.w, W.tok.Sam);
  clock.t = W.db.prepare('SELECT expires FROM teacher_sessions').get().expires + 1;
  K.say(W.w, sam, { t: 'p', map: 'over', x: 6100, y: 3700 });
  assert.equal(scr.closed.code, 4011); assert.equal(scr.last('w_bye').code, 4011);
});

test('a second db stays independent (the kit makes a fresh world each time)', () => { assert.ok(new DatabaseSync(':memory:')); });

// A kid whose socket dropped (Wi-Fi, a closed lid) and who is then sent off (D7: left in the last 30 minutes): his game's tab
// is still open. The REAL src/70-net.js, wired to this World, opens /ws once, hears kicked why sentoff and close 4005, and
// never tries again: one request, not one every 15 s until midnight.
test('a kid sent off while his socket was down: the real game wire opens /ws once, hears the send-off, and never tries again', async () => {
  const fs = await import('node:fs'), vm = await import('node:vm');
  const W = await world(['Sam', 'Ada']);
  const sam = await K.online(W.w, W.tok.Sam);
  W.w.webSocketClose(sam, 1006, ''); clock.t += 60000;   // the line dropped; Sam left a minute ago
  const scr = await K.screen(W.w, W.token);
  assert.equal(act(W.w, scr, { t: 'w_off', n: 'Sam' }).t, 'w_ok');
  // the game's wire, with a transport that goes to this World exactly as a browser's WebSocket would
  let opens = 0; const codes = [], heard = [], timers = [];
  const fake = {
    call: async () => ({}),
    open(token) {
      opens++;
      const c = { readyState: 0, send() { }, close() { c.readyState = 3; } };
      W.w.fetch(new Request('http://world/ws?token=' + encodeURIComponent(token), { headers: { upgrade: 'websocket' } })).then(r => {
        if (r.status !== 101) { c.readyState = 3; codes.push(1006); return c.onclose && c.onclose({ code: 1006 }); }   // a refused upgrade: the browser sees 1006
        const srv = W.w.ctx.sockets[W.w.ctx.sockets.length - 1];
        c.readyState = 1; if (c.onopen) c.onopen();
        for (const m of srv.got) { heard.push(m); if (c.onmessage) c.onmessage({ data: JSON.stringify(m) }); }
        if (srv.closed) { c.readyState = 3; codes.push(srv.closed.code); if (c.onclose) c.onclose({ code: srv.closed.code }); }
      });
      return c;
    },
  };
  const ctx = { window: { __online: true }, HOOKS: { update: [], selfTest: [] }, localStorage: { getItem: () => null, setItem() { }, removeItem() { } }, console, JSON, Math, Date, Error, Object, Array, String, Number, Promise,
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: () => { } };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext('var window = this.window; ' + fs.readFileSync(new URL('../../src/70-net.js', import.meta.url), 'utf8'), ctx);
  const NET = ctx.window.NET;
  NET.useFake(fake); NET.setToken(W.tok.Sam); NET.connect();
  // ten minutes of the wire's own timers, run as they come due
  for (let i = 0; i < 200; i++) { await new Promise(r => setImmediate(r)); const t = timers.shift(); if (!t) break; clock.t += t.ms; t.f(); }
  await new Promise(r => setImmediate(r));
  assert.equal(opens, 1, 'the wire tried ' + opens + ' times');
  assert.deepEqual(codes, [4005]);
  assert.deepEqual(heard.map(m => [m.t, m.code, m.why]), [['error', 'kicked', 'sentoff']]);
  assert.equal(NET.timer, null); assert.equal(NET.closedByUs, true);
  assert.equal(W.w.room.knights.size, 0);
});

// ============================================================================
// Watch (round 2): one kid's point of view (docs/ONLINE.md, "The teacher view", Watch)
// ============================================================================
import fs0 from 'node:fs';
import { VIEW_FORWARD, VIEW_STATUS, VIEW_DROP, VIEW_STREAMS_MAX, VIEW_DAY_MSGS, WATCH_LOG_MS, frameType } from '../src/watch.js';
const VIEW_CAPS = ['tick', 'die', 'roll', 'loot', 'zone', 'fix', 'day', 'snap', 'view'];
const srcOf = f => fs0.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const DOC0 = fs0.readFileSync(new URL('../../docs/ONLINE.md', import.meta.url), 'utf8');
const viewMsgs = s => s.all('view').map(m => m.on);

// The Great Spread (docs/ONLINE.md, "The Great Spread on the server"): a kid still on an older world's page stands on the old
// map, so his row never puts him on this map (no x, y; no place read from this Atlas), an instance is still named, and Watch
// says his game is older
test('the Great Spread: a kid on an older world\'s page has no x, y on the map and no overworld place; his instance is named; Watch says old', async () => {
  const W = await world(['Sam', 'Leo']);
  const scr = await K.screen(W.w, W.token);
  const [hx, hy] = K.ATLAS_JSON.ports['hollowford.square'];
  await K.online(W.w, W.tok.Sam, { x: hx * 48 + 10, y: hy * 48 + 10 }, VIEW_CAPS, '0000000000000000');
  const leo = await K.online(W.w, W.tok.Leo, { map: 'spider_den', x: 300, y: 200 }, null, '0000000000000000');
  clock.t += 1100; K.say(W.w, leo, { t: 'p', map: 'spider_den', x: 301, y: 200 });   // the next frame (one a second at most)
  const rows = Object.fromEntries(scr.last('w_k').knights.map(r => [r.n, r]));
  assert.deepEqual([rows.Sam.map, rows.Sam.place, rows.Sam.x, rows.Sam.y], ['over', 'Somewhere in the world', null, null]);
  assert.deepEqual([rows.Leo.map, rows.Leo.place], ['spider_den', 'The Spider Den']);
  const v = K.view(W.w, scr, 'Sam');
  assert.deepEqual([v.t, v.map, v.old, v.keeper.map, v.keeper.n], ['w_vstart', 'over', true, 'over', 'Sam']);
});

test('W1. w_vstart is built from memory: 0 SQL beyond the lock (the second watch in 10 minutes, whose mod_log row is throttled)', async () => {
  const counter = { writes: 0, all: 0 };
  const W = await world(['Sam', 'Leo'], { counter });
  // Sam is on the map first, so he keeps it (on master two knights arriving at one moment are ordered by name: Leo first)
  const sam = await K.online(W.w, W.tok.Sam, { x: 6000 }, VIEW_CAPS); clock.t += 10;
  const leo = await K.online(W.w, W.tok.Leo, { x: 6100 }, VIEW_CAPS);
  const scr = await K.screen(W.w, W.token);
  const first = K.view(W.w, scr, 'Sam');
  assert.equal(first.t, 'w_vstart'); assert.equal(first.n, 'Sam'); assert.equal(first.map, 'over'); assert.equal(first.keeper.n, 'Sam');
  assert.equal(first.me.n, 'Sam'); assert.deepEqual(first.others.map(o => o.n), ['Leo']); assert.equal(first.monsters, 'live'); assert.equal(first.old, false);   // his game names this world's Atlas (teacher-kit)
  const ws = W.w.wrap(scr), all0 = counter.all;
  clock.t += 2000;
  W.w.watch.message(ws, JSON.stringify({ t: 'w_view', req: 77, n: 'Sam' }));
  const again = scr.last('w_vstart');
  assert.equal(again.req, 77);
  assert.equal(counter.all - all0, 1, 'SQL statements for a w_view beyond the lock: ' + (counter.all - all0 - 1));
  assert.ok(sam && leo);
});

test('W2. the allowlist is complete: every type the world sends a game (the contract, room.js, sim/worlds.js) is forwarded, header-only or dropped, never two of those', () => {
  const types = new Set();
  // (watch.js's own w_* go to teachers only; what it sends the games, chat_pause, muted and watching, counts)
  for (const f of ['room.js', 'sim/worlds.js', 'watch.js']) for (const m of srcOf(f).matchAll(/(?:^|[^A-Za-z_])t: '([a-z_]+)'/g)) if (!m[1].startsWith('w_')) types.add(m[1]);
  // the contract's Server -> client tables (the game's, not the teacher's)
  const parts = DOC0.split(/\n(?=#{2,3} )/), fromDoc = new Set();
  for (const p of parts) if (/^#{2,3} Server → client/.test(p)) for (const line of p.split('\n')) { if (!line.startsWith('| `')) continue; const first = line.split('|')[1]; for (const m of first.matchAll(/`([a-z_]+)`/g)) if (m[1] !== 't') { types.add(m[1]); fromDoc.add(m[1]); } }
  types.add('view');   // the Watch's own signal to a kid's game
  assert.ok(fromDoc.size >= 40 && fromDoc.has('trade_done') && fromDoc.has('boss_wait') && fromDoc.has('spawn_clear'), JSON.stringify([...fromDoc]));
  assert.ok(types.size >= 45 && types.has('sim') && types.has('chat_pause') && types.has('watching'), JSON.stringify([...types]));
  const sets = [VIEW_FORWARD, VIEW_STATUS, VIEW_DROP];
  const none = [...types].filter(t => !sets.some(s => s.has(t))), twice = [...types].filter(t => sets.filter(s => s.has(t)).length > 1);
  assert.deepEqual(none, [], 'types in no list: ' + none.join(', '));
  assert.deepEqual(twice, []);
  // the forwarded ones are exactly the contract's
  assert.deepEqual([...VIEW_FORWARD].sort(), ['announce', 'boom', 'chat', 'crackers', 'keeper', 'left', 'mon', 'p', 'party_end']);
  assert.deepEqual([...VIEW_STATUS].sort(), ['chat_pause', 'muted', 'strike', 'unmuted']);
});

test('W3. NEGATIVE: gift, prize, trade_*, mod, modlist, role, welcome, who, hit, snap and the rest never reach a teacher; a p with t not first is still read (J2)', async () => {
  const W = await world(['MudGoll', 'Sam', 'Leo']);
  const sam = await K.online(W.w, W.tok.Sam, { x: 6000 }, VIEW_CAPS), leo = await K.online(W.w, W.tok.Leo, { x: 6040 }, VIEW_CAPS);
  const scr = await K.screen(W.w, W.token);
  const st = K.view(W.w, scr, 'Sam'); assert.equal(st.t, 'w_vstart');
  const room = W.w.room, ss = W.w.wrap(sam);
  // the real flows: a gift, a trade, a role change, a hit routed to Sam (he keeps the map), a roster
  K.say(W.w, leo, { t: 'gift', to: 'Sam', id: 'bread', qty: 1 });
  K.say(W.w, leo, { t: 'trade_ask', to: 'Sam' }); K.say(W.w, sam, { t: 'trade_answer', from: 'Leo', yes: true });
  K.say(W.w, leo, { t: 'hit', nid: 's1', dmg: 3 });
  await parent(W.w, 'POST', '/api/admin/role', { name: 'Sam', role: 'admin' });
  await K.online(W.w, W.tok.MudGoll, { x: 7000 });
  // and every dropped type, as the world would send it
  for (const t of VIEW_DROP) if (t !== 'error') room.raw(ss, JSON.stringify({ t, n: 'Leo', secret: 'x' }));
  room.raw(ss, '{"x":1,"t":"gift","id":"sword"}');
  const got = K.viewed(scr, st.v).map(m => m.t);
  for (const t of ['gift', 'gift_ok', 'gift_back', 'prize', 'trade_ask', 'trade_open', 'trade_state', 'mod', 'modlist', 'role', 'welcome', 'who', 'hit', 'snap', 'sim', 'watching', 'view', 'pong', 'kill', 'hurt']) assert.ok(!got.includes(t), t + ' reached the teacher');
  assert.ok(got.every(t => VIEW_FORWARD.has(t) || VIEW_STATUS.has(t)), JSON.stringify(got));
  // J2: a p whose t is not first is classified by parsing it
  const n0 = K.viewed(scr, st.v).length;
  room.raw(ss, '{"n":"Leo","map":"over","x":5,"y":6,"t":"p"}');
  const last = K.viewed(scr, st.v).slice(n0);
  assert.equal(last.length, 1); assert.equal(last[0].t, 'p'); assert.equal(last[0].n, 'Leo');
  assert.equal(frameType('{"t":"mon","n":"x"}'), 'mon'); assert.equal(frameType('{"n":"x","t":"chat"}'), 'chat'); assert.equal(frameType('junk'), null);
  // the frame goes byte for byte
  const raw = '{"t":"chat","n":"Leo","text":"hi \\"there\\"","at":1,"role":"player"}';
  room.raw(ss, raw);
  assert.ok(scr.raw.some(x => x === '{"t":"w_v","v":' + st.v + ',"m":' + raw + '}'));
});

test('W4. {view: on} goes to the kid once for two screens watching him, and {view: off} at the last; only to a game that can stream (the view capability)', async () => {
  const W = await world(['Sam', 'Leo']);
  const B = await K.addTeacher(W.w, 'Mr Lee', 'quiet-harbour-oak-17'); const bl = await K.teacherLogin(W.w, B.name, B.pass);
  const sam = await K.online(W.w, W.tok.Sam, { x: 6000 }, VIEW_CAPS), leo = await K.online(W.w, W.tok.Leo, { x: 6100 });
  const a = await K.screen(W.w, W.token), b = await K.screen(W.w, bl.token);
  K.view(W.w, a, 'Sam'); K.view(W.w, b, 'Sam');
  assert.deepEqual(viewMsgs(sam), [true]);
  K.unview(W.w, a); assert.deepEqual(viewMsgs(sam), [true]);
  K.unview(W.w, b); assert.deepEqual(viewMsgs(sam), [true, false]);
  assert.equal(W.w.room.taps.size, 0);
  // Leo's game names no view capability: watched, it is never told (it would not stream), and the screen says so
  const st = K.view(W.w, a, 'Leo');
  assert.equal(st.monsters, 'friends'); assert.deepEqual(viewMsgs(leo), []);
  // a welcome while still watched: told again (a new game never remembers it)
  K.unview(W.w, a); K.view(W.w, a, 'Sam');
  const sam2 = await K.online(W.w, W.tok.Sam, { x: 6000 }, VIEW_CAPS);
  assert.deepEqual(viewMsgs(sam2), [true]);
  assert.equal(a.last('w_vstart').n, 'Sam');
});

test('W5. the view ends with the exact words: he left, was sent off, was sent out by an admin, by the word filter, or got a new name', async () => {
  const end = async (how) => {
    const W = await world(['MudGoll', 'Sam', 'Leo']);
    const sam = await K.online(W.w, W.tok.Sam, { x: 6000 }, VIEW_CAPS);
    const scr = await K.screen(W.w, W.token);
    const st = K.view(W.w, scr, 'Sam');
    if (how === 'left') W.w.webSocketClose(sam, 1000, '');
    if (how === 'sentoff') { const b2 = await K.teacherLogin(W.w, W.T.name, W.T.pass); const s2 = await K.screen(W.w, b2.token); K.act(W.w, s2, { t: 'w_off', n: 'Sam' }); }
    if (how === 'kick') { const mud = await K.online(W.w, W.tok.MudGoll, { x: 7000 }); K.say(W.w, mud, { t: 'kick', n: 'Sam' }); }
    if (how === 'words') for (let i = 0; i < 3; i++) { K.say(W.w, sam, { t: 'chat', text: 'what the fuck ' + i }); clock.t += 2000; }
    if (how === 'renamed') await parent(W.w, 'POST', '/api/admin/rename', { name: 'Sam', to: 'Samuel' });
    const e = scr.last('w_vend');
    return { e, v: st.v, taps: W.w.room.taps.size };
  };
  const want = { left: 'Sam left the game at 10:00 am.', sentoff: 'Sam was sent off until tomorrow.', kick: 'An admin sent Sam out of the world.', words: 'The word filter sent Sam out for 24 hours.', renamed: 'An admin gave Sam a new name, so this view ended.' };
  for (const how of Object.keys(want)) {
    const r = await end(how);
    assert.ok(r.e, how + ': no w_vend');
    assert.equal(r.e.text, want[how], how); assert.equal(r.e.v, r.v); assert.equal(r.taps, 0, how + ': the tap stayed');
  }
});

test('W6. room.taps is empty after the screen closes, after w_unview and after signing out; settle after a nap taps the kid again, or says he left', async () => {
  const W = await world(['Sam', 'Leo']);
  const sam = await K.online(W.w, W.tok.Sam, { x: 6000 }, VIEW_CAPS);
  let scr = await K.screen(W.w, W.token);
  K.view(W.w, scr, 'Sam'); assert.equal(W.w.room.taps.size, 1);
  K.unview(W.w, scr); assert.equal(W.w.room.taps.size, 0);
  K.view(W.w, scr, 'Sam'); W.w.webSocketClose(scr, 1000, ''); assert.equal(W.w.room.taps.size, 0);
  scr = await K.screen(W.w, W.token); K.view(W.w, scr, 'Sam');
  assert.equal((await call(W.w, 'POST', '/api/teacher/logout', { token: W.token })).status, 200);
  assert.equal(W.w.room.taps.size, 0); assert.equal(scr.closed.code, 4010);
  // a nap with a screen watching Sam: the new World taps Sam again from the attachment and starts the view afresh
  const lg = await K.teacherLogin(W.w, W.T.name, W.T.pass);
  const s2 = await K.screen(W.w, lg.token); const st = K.view(W.w, s2, 'Sam');
  assert.equal(s2.att.view, 'sam');
  clock.t += 1000;
  const W2 = new K.TestWorld(W.ctx, K.ENV);
  assert.equal(W2.room.taps.size, 1);
  const fresh = s2.last('w_vstart');
  assert.ok(fresh.v !== undefined && fresh.n === 'Sam' && fresh !== st);
  W2.webSocketMessage(sam, JSON.stringify({ t: 'p', map: 'over', x: 6020, y: 3700 }));
  assert.equal(K.viewed(s2, fresh.v).pop().x, 6020);
  // the same nap with Sam gone during it: the view says he left
  const s3w = W2;
  s3w.webSocketClose(sam, 1000, '');
  clock.t += 1000;
  const W3 = new K.TestWorld(W.ctx, K.ENV);
  assert.equal(W3.room.taps.size, 0);
  assert.match(s2.last('w_vend').text, /^Sam left the game at \d+:\d\d (am|pm)\.$/);
});

test('W7. NEGATIVE: a watching teacher is never a knight: knights, byName, members, who, online(), the keeper election and the 50 cap are the same', async () => {
  const run = async watching => {
    const W = await world(['Sam', 'Leo', 'Ada']);
    const scr = await K.screen(W.w, W.token);
    const s = await K.online(W.w, W.tok.Sam, {}, VIEW_CAPS); clock.t += 500;
    const l = await K.online(W.w, W.tok.Leo, { x: 6100 }, VIEW_CAPS); clock.t += 500;
    if (watching) K.view(W.w, scr, 'Sam');
    K.say(W.w, l, { t: 'p', map: 'over', x: 6150, y: 3700 }); clock.t += 4000;
    K.say(W.w, l, { t: 'p', map: 'over', x: 6160, y: 3700 });
    const a = await K.online(W.w, W.tok.Ada, { map: 'spider_den', x: 300, y: 200 }, VIEW_CAPS);
    const room = W.w.room;
    return JSON.stringify({ knights: room.knights.size, byName: [...room.byName.keys()].sort(), maps: Array.from(room.maps, ([m, g]) => [m, g.keeper && g.keeper.name, Array.from(g.members, k => k.name)]), online: room.online(), who: [s, l, a].map(x => x.all('who').length) });
  };
  assert.equal(await run(true), await run(false));
  // fifty knights and a teacher watching one of them: all fifty connect
  clock.t = T0;
  const W = K.newWorld(); const T = await K.addTeacher(W.w); const lg = await K.teacherLogin(W.w, T.name, T.pass);
  const scr = await K.screen(W.w, lg.token);
  const toks = []; for (let i = 0; i < 50; i++) toks.push(await K.signup(W.w, 'Knight ' + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + i % 26)));
  const socks = []; for (const t of toks) { socks.push(await K.online(W.w, t, {}, VIEW_CAPS)); if (socks.length === 1) K.view(W.w, scr, 'Knight AA'); }
  assert.equal(W.w.room.online().length, 50); assert.ok(socks.every(s => !s.closed));
});

test('W8. NEGATIVE fuzz: every message a game may send, and junk, on a watching teacher\'s socket: no Room handler runs and the kid gets nothing new', async () => {
  const W = await world(['Sam', 'Leo']);
  const sam = await K.online(W.w, W.tok.Sam, { x: 6000 }, VIEW_CAPS), leo = await K.online(W.w, W.tok.Leo, { x: 6040 }, VIEW_CAPS);
  const scr = await K.screen(W.w, W.token); K.view(W.w, scr, 'Sam');
  const types = Array.from(srcOf('room.js').slice(srcOf('room.js').indexOf('switch (m.t) {')).split('default:')[0].matchAll(/case '([a-z_]+)'/g), m => m[1]);
  const room = W.w.room;
  const state = () => JSON.stringify({ k: Array.from(room.knights.values()).map(k => [k.name, k.map, k.x, k.y, k.role]), maps: Array.from(room.maps, ([m, g]) => [m, g.keeper && g.keeper.name]), trades: room.trades.size, gifts: room.gifts.size, parties: room.parties.size });
  const s0 = state(), sam0 = sam.got.length, leo0 = leo.got.length, db0 = K.snapshot(W.db);
  const junk = { n: 'Sam', to: 'Sam', text: 'hi', span: '1h', map: 'over', x: 1, y: 1, list: [['s1', 'goblin', 1, 1, 1, 1, 'idle', 1, 0, 0, 0, 0, 0, 0]], nid: 's1', id: 'p1.0', type: 'goblin', count: 3, yes: true, role: 'admin', v: 1, req: 5 };
  for (const t of types.concat(['bogus', 'w_bogus', 'w_v', 'w_vstart', 'view', 'welcome'])) { W.w.webSocketMessage(scr, JSON.stringify(Object.assign({ t }, junk))); clock.t += 1100; }
  for (const j of ['', 'null', '[]', '{"t":5}', '{'.repeat(50), 'x'.repeat(5000)]) { W.w.webSocketMessage(scr, j); clock.t += 1100; }
  assert.equal(state(), s0); assert.equal(sam.got.length, sam0); assert.equal(leo.got.length, leo0);
  assert.equal(K.snapshot(W.db).replace(/"last_seen":\d+/g, ''), db0.replace(/"last_seen":\d+/g, ''));
});

test('W9 (J4). golden: over a scripted 60 s every kid gets byte for byte the same frames with and without a teacher watching (the view signal and the tod, vw and vh fields set aside)', async () => {
  const run = async watching => {
    const W = await world(['Sam', 'Leo', 'Ada']);
    const kids = {};
    kids.Sam = await K.online(W.w, W.tok.Sam, { x: 6000 }, VIEW_CAPS); clock.t += 100;
    kids.Leo = await K.online(W.w, W.tok.Leo, { x: 6060 }, VIEW_CAPS); clock.t += 100;
    kids.Ada = await K.online(W.w, W.tok.Ada, { map: 'deepholm', x: 900, y: 900 }, VIEW_CAPS); clock.t += 100;
    const B = await K.addTeacher(W.w, 'Mr Lee', 'quiet-harbour-oak-17'); const bl = await K.teacherLogin(W.w, B.name, B.pass);
    const a = await K.screen(W.w, W.token), b = await K.screen(W.w, bl.token);
    let teacherSent = 0;
    const tsay = (s, m) => { teacherSent++; W.w.webSocketMessage(s, JSON.stringify(m)); };
    const viewed = n => (kids[n].all('view').pop() || {}).on === true;
    for (let step = 0; step < 480; step++) {
      clock.t += 125;
      if (watching && step === 8) { tsay(a, { t: 'w_view', req: 1, n: 'Sam' }); tsay(b, { t: 'w_view', req: 2, n: 'Ada' }); }
      if (watching && step === 400) { tsay(a, { t: 'w_unview', req: 3 }); tsay(b, { t: 'w_unview', req: 4 }); }
      // each kid's game: its presence 8 a second (the time of day on it while watched), Sam keeps the overworld with Leo near
      // (8 snapshots a second), Ada keeps Deepholm alone (snapshots only while watched: 2 a second)
      for (const n of ['Sam', 'Leo', 'Ada']) { const p = { t: 'p', map: n === 'Ada' ? 'deepholm' : 'over', x: (n === 'Leo' ? 6060 : n === 'Ada' ? 900 : 6000) + (step % 40), y: 3700, mv: true, sw: Math.floor(step / 30) }; if (viewed(n)) { p.tod = (step * 0.125) % 600; p.vw = 1366; p.vh = 768; } K.say(W.w, kids[n], p); }
      K.say(W.w, kids.Sam, { t: 'mon', list: [['s1', 'goblin', 6100 + step % 9, 3700, 10, 10, 'chase', 1, 0, 1, 0, 0, 0, 0]] });
      if (viewed('Ada') && step % 4 === 0) K.say(W.w, kids.Ada, { t: 'mon', list: [['i0', 'cave_bat', 950, 950, 5, 5, 'idle', 1, 0, 0, 0, 0, 0, 0]] });
      if (step % 64 === 5) K.say(W.w, kids.Leo, { t: 'chat', text: 'line ' + step });
    }
    const norm = s => s.raw.map(x => JSON.parse(x)).filter(m => m.t !== 'view').map(m => { if (m.t === 'p') { delete m.tod; delete m.vw; delete m.vh; } return JSON.stringify(m); });
    return { frames: Object.fromEntries(Object.entries(kids).map(([n, s]) => [n, norm(s)])), teacherSent, forwarded: K.viewed(a).length + K.viewed(b).length, taps: W.w.room.taps.size };
  };
  const yes = await run(true), no = await run(false);
  for (const n of ['Sam', 'Leo', 'Ada']) assert.deepEqual(yes.frames[n], no.frames[n], n + ' got different frames with a watcher');
  // the cost: two teacher messages a watch (w_view, w_unview), every frame out free
  assert.equal(yes.teacherSent, 4); assert.ok(yes.forwarded > 1000, String(yes.forwarded)); assert.equal(yes.taps, 0);
});

test('W10. the alone streams: at most 3 kids told at once (the 4th when one stops), and 40,000 alone messages a Toronto day, then every one told off until the next day', async () => {
  const W = await world(['Sam', 'Leo', 'Ada', 'Pip', 'Max']);
  const T2 = await K.addTeacher(W.w, 'Mr Lee', 'quiet-harbour-oak-17'); const l2 = await K.teacherLogin(W.w, T2.name, T2.pass);
  const T3 = await K.addTeacher(W.w, 'Ms Day', 'quiet-harbour-oak-18'); const l3 = await K.teacherLogin(W.w, T3.name, T3.pass);
  const kids = {}; let x = 1000;
  for (const n of ['Sam', 'Leo', 'Ada', 'Pip']) { kids[n] = await K.online(W.w, W.tok[n], { map: ['over', 'deepholm', 'aerie', 'spider_den'][Object.keys(kids).length], x: x += 500, y: 900 }, VIEW_CAPS); }
  const scr = [await K.screen(W.w, W.token), await K.screen(W.w, W.token), await K.screen(W.w, l2.token), await K.screen(W.w, l2.token)];
  const st = ['Sam', 'Leo', 'Ada', 'Pip'].map((n, i) => K.view(W.w, scr[i], n));
  assert.deepEqual(['Sam', 'Leo', 'Ada', 'Pip'].map(n => viewMsgs(kids[n]).join()), ['true', 'true', 'true', '']);
  assert.equal(st[3].limit, 'streams');
  // Leo's view stops: Pip is told, and his screen hears the limit is gone
  K.unview(W.w, scr[1]);
  assert.deepEqual(viewMsgs(kids.Leo), [true, false]); assert.deepEqual(viewMsgs(kids.Pip), [true]);
  assert.equal(scr[3].last('w_vinfo').limit, null);
  // the day's alone messages: the 40,000th tells every streaming kid off; the screens hear why
  W.w.watch.day.msgs = VIEW_DAY_MSGS - 2;
  K.say(W.w, kids.Sam, { t: 'mon', list: [] }); K.say(W.w, kids.Sam, { t: 'mon', list: [] });
  for (const n of ['Sam', 'Ada', 'Pip']) assert.equal(viewMsgs(kids[n]).pop(), false, n);
  assert.equal(scr[0].last('w_vinfo').limit, 'day');
  // a new screen on a new kid the same day is not told either
  kids.Max = await K.online(W.w, W.tok.Max, { map: 'coalmine', x: 500, y: 500 }, VIEW_CAPS);
  const s5 = await K.screen(W.w, l3.token);
  assert.equal(K.view(W.w, s5, 'Max').limit, 'day'); assert.deepEqual(viewMsgs(kids.Max), []);
  // the next Toronto day (every session ended at midnight: Ms Day signs in again): a new watch is told again
  clock.t = dayEnd(clock.t) + 1;
  const l4 = await K.teacherLogin(W.w, T3.name, T3.pass); const s6 = await K.screen(W.w, l4.token);
  assert.equal(K.view(W.w, s6, 'Max').limit, null);
  assert.deepEqual(viewMsgs(kids.Max), [true]);
  assert.equal(VIEW_STREAMS_MAX, 3); assert.equal(VIEW_DAY_MSGS, 40000);
});

test('W10b. the day\'s ceiling counts every snapshot his game sends only because he is watched: a friend on his map whose game is paused (socket open, no presence for 15 s) does not make it free; a friend who is playing does', async () => {
  const W = await world(['Sam', 'Ava']);
  const sam = await K.online(W.w, W.tok.Sam, { map: 'spider_den', x: 300, y: 200 }, VIEW_CAPS); clock.t += 500;
  const ava = await K.online(W.w, W.tok.Ava, { map: 'spider_den', x: 340, y: 200 }, VIEW_CAPS); clock.t += 500;
  assert.equal(W.w.room.maps.get('spider_den').keeper.name, 'Sam');
  const scr = await K.screen(W.w, W.token);
  assert.equal(K.view(W.w, scr, 'Sam').t, 'w_vstart');
  assert.deepEqual(viewMsgs(sam), [true]);
  const day0 = W.w.watch.day.msgs;
  // Ava is playing (a presence every second): Sam's 8 a second is the stream it always was, not counted
  for (let i = 0; i < 40; i++) { clock.t += 125; K.say(W.w, sam, { t: 'p', map: 'spider_den', x: 300, y: 200 }); if (i % 8 === 0) K.say(W.w, ava, { t: 'p', map: 'spider_den', x: 340, y: 200 }); K.say(W.w, sam, { t: 'mon', list: [] }); }
  assert.equal(W.w.watch.day.msgs, day0);
  // Ava pauses (her socket stays on the map, she says nothing): after 15 s Sam's game streams alone for the teacher, and every
  // one of those snapshots is counted
  clock.t += 15100;
  for (let i = 0; i < 20; i++) { clock.t += 500; K.say(W.w, sam, { t: 'p', map: 'spider_den', x: 300, y: 200 }); K.say(W.w, sam, { t: 'mon', list: [] }); }
  assert.equal(W.w.room.maps.get('spider_den').members.size, 2);
  assert.equal(W.w.watch.day.msgs, day0 + 20);
  // Ava plays again: free again
  K.say(W.w, ava, { t: 'p', map: 'spider_den', x: 340, y: 200 });
  K.say(W.w, sam, { t: 'mon', list: [] });
  assert.equal(W.w.watch.day.msgs, day0 + 20);
});

test('W11. one mod_log row per teacher per knight per 10 minutes ("Mrs Smith (teacher) watched Sam"), not one of the 10 knight actions', async () => {
  const W = await world(['Sam', 'Leo']);
  const B = await K.addTeacher(W.w, 'Mr Lee', 'quiet-harbour-oak-17'); const bl = await K.teacherLogin(W.w, B.name, B.pass);
  await K.online(W.w, W.tok.Sam, { x: 6000 }, VIEW_CAPS); await K.online(W.w, W.tok.Leo, { x: 6100 }, VIEW_CAPS);
  const a = await K.screen(W.w, W.token), b = await K.screen(W.w, bl.token);
  const rows = () => W.db.prepare("SELECT by, act, target FROM mod_log WHERE act = 'watch' ORDER BY id").all().map(r => r.by + ' ' + r.target);
  for (let i = 0; i < 12; i++) { K.view(W.w, a, i % 2 ? 'Sam' : 'Leo'); clock.t += 30000; }
  assert.deepEqual(rows(), ['Mrs Smith (teacher) Leo', 'Mrs Smith (teacher) Sam']);
  K.view(W.w, b, 'Sam');
  assert.deepEqual(rows().slice(-1), ['Mr Lee (teacher) Sam']);
  clock.t += WATCH_LOG_MS;
  K.view(W.w, a, 'Leo');
  assert.equal(rows().length, 4);
  // watching is not a knight action: ten mutes still go through after all that watching
  for (let i = 0; i < 10; i++) { const r = K.act(W.w, a, { t: 'w_mute', n: i % 2 ? 'Sam' : 'Leo', span: i < 5 ? '10m' : '1h' }); assert.notEqual(r && r.code, 'slow', 'mute ' + i); clock.t += 1100; }
});

test('W12. an admin\'s knight may be watched (R2-1, read-only); NEGATIVE: a teacher\'s mute and send-off on him are still refused (D2)', async () => {
  const W = await world(['MudGoll', 'Sam']);
  await K.online(W.w, W.tok.MudGoll, { x: 6000 }, VIEW_CAPS);
  const scr = await K.screen(W.w, W.token);
  const st = K.view(W.w, scr, 'MudGoll');
  assert.equal(st.t, 'w_vstart'); assert.equal(st.role, 'admin');
  assert.deepEqual([K.act(W.w, scr, { t: 'w_mute', n: 'MudGoll', span: '10m' }).code, K.act(W.w, scr, { t: 'w_off', n: 'MudGoll' }).code], ['admin', 'admin']);
  // a knight not on (or not there at all) cannot be watched
  assert.deepEqual([K.view(W.w, scr, 'Sam').code, K.view(W.w, scr, 'Nobody').code], ['gone', 'gone']);
  assert.equal(scr.last('w_no').text, 'Nobody is not on now.');
});
