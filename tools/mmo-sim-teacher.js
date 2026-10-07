#!/usr/bin/env node
// tools/mmo-sim-teacher.js — the teacher view against the REAL World (docs/ONLINE.md, "The teacher view"): two whole games in
// one Node process (Sam, a player; Ava, an admin) and a teacher's screen on the same World (online/src/world.js on node's
// SQLite, as online/test/teacher-kit.mjs builds it), so the teacher signs in exactly as the card does: POST /api/login with
// teacherOk: 1, a ticket, the socket.
//
//   node tools/mmo-sim-teacher.js
//
// What it proves, one PASS/FAIL line each:
//   1. the teacher's frame puts both knights at their real tiles and places
//   2. Ava's game says "A teacher is watching Fanglands right now." once, and the Friends header says "A teacher is watching."
//   3. a teacher mutes Sam: his game says the teacher's sentence and his next line is refused; Undo gives his chat back
//   4. a pause blocks Sam's line and not Ava's (an admin); "Chat is back on." on both games when it is turned back on
//   5. Watch (round 2): Sam alone in the Spider Den, watched: at most 2 snapshots a second reach the teacher (his game's alone
//      stream); Ava joins him: 8 a second, with no message from his game but the ones it always sends; the requests an hour
//   6. a teacher sends Sam off: his game goes back to the card with the sentence; his last push lands first (one more version,
//      byte for byte his slot); an open trade with Ava ends with nothing moved; the teacher's view of him ends in plain words;
//      Play is refused until the world's midnight, then works
// Exit 0 only when every line passes. The plumbing (the fake wire, the game contexts) is tools/mmo-sim.js's.
'use strict';
const vm = require('vm');
const path = require('path');
const fs = require('fs');
const { Wire, makeContext, FRAME_MS, ROOT } = require('./mmo-sim.js');

async function main() {
  const t0 = Date.now();
  const url = f => require('url').pathToFileURL(path.join(ROOT, f)).href;
  const K = await import(url('online/test/teacher-kit.mjs'));
  const { dayEnd } = await import(url('online/src/teachers.js'));
  const { readAtlas } = await import(url('online/src/atlas.js'));
  const ATLAS = readAtlas(JSON.parse(fs.readFileSync(path.join(ROOT, 'online', 'src', 'atlas.json'), 'utf8')));
  // the World, 10:00 am in Toronto (its clock is the kit's; the games keep their own)
  K.clock.t = Date.UTC(2026, 9, 6, 14, 0, 0);
  const now = () => Math.floor(K.clock.t);
  const W = K.newWorld(), world = W.w, db = W.db;
  await K.signup(world, 'Sam'); await K.signup(world, 'Ava');
  await K.parent(world, 'POST', '/api/admin/role', { name: 'Ava', role: 'admin' });
  const room = world.room, watch = world.watch, book = world.teachers;
  const T = await K.addTeacher(world);

  // the wire: mmo-sim's, with the world's saves and its send-off answers (423 sentoff) behind it
  const saves = new Map();   // lc -> [{ver, json}]
  class TeacherWire extends Wire {
    fetch() {
      const wire = this, base = super.fetch();
      const reply = (status, data) => ({ ok: status < 300, status, json: async () => data });
      const offUntil = n => { const r = book.sentOff(String(n).toLowerCase()); return r && r.until > now() ? r.until : 0; };
      return async (url, opts = {}) => {
        const p = String(url).replace(/^https?:\/\/[^/]+/, ''), method = opts.method || 'GET';
        const auth = ((opts.headers && (opts.headers.authorization || opts.headers.Authorization)) || '').replace(/^Bearer /, '');
        const who = wire.accounts.get(auth);
        if (p === '/api/login') { const b = JSON.parse(opts.body || '{}'); const u = offUntil(b.name || ''); if (u) return reply(423, { error: 'sent off', code: 'sentoff', until: u }); return base(url, opts); }
        if (p === '/api/save' && method === 'PUT') { if (!who) return reply(401, { code: 'auth' }); const l = saves.get(who.toLowerCase()) || []; l.push({ ver: l.length + 1, json: String(opts.body) }); saves.set(who.toLowerCase(), l); return reply(200, { at: now(), ver: l.length }); }
        if ((p === '/api/save' || p === '/api/me') && who) { const u = offUntil(who); if (u) return reply(423, { error: 'sent off', code: 'sentoff', until: u }); }
        if (p === '/api/save' && who) { const l = saves.get(who.toLowerCase()) || []; const last = l[l.length - 1]; return reply(200, { save: last ? last.json : null, at: last ? now() : null }); }
        return base(url, opts);
      };
    }
  }
  const wire = new TeacherWire(room);
  const A = makeContext(wire), B = makeContext(wire);   // A plays Sam, B plays Ava
  const both = [A, B];
  const ev = (g, code) => vm.runInContext(code, g);
  const results = [];
  const line = (name, ok, info) => { results.push(!!ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined && !ok ? '   ' + JSON.stringify(info) : '')); };
  const heard = { A: [], B: [] };
  A.NET.on('*', m => heard.A.push(m)); B.NET.on('*', m => heard.B.push(m));
  const got = (who, t, since) => heard[who].slice(since || 0).filter(m => m.t === t);
  const sys = g => g.CHAT.log.filter(l => l.n === null).map(l => l.text);
  const tick = n => { for (let i = 0; i < n; i++) { for (const g of both) g.FANGLANDS.step([]); K.clock.t += FRAME_MS; wire.flush(); } };

  // ---- the teacher signs in as the card does: /api/login with teacherOk, a ticket, the socket ----
  const lg = await K.call(world, 'POST', '/api/login', { name: T.name, pass: T.pass, teacherOk: 1 });
  if (lg.status !== 200 || lg.data.teacher !== true) { console.error('the teacher could not sign in: ' + JSON.stringify(lg)); process.exit(1); }
  let screen = null;
  const openScreen = async () => { screen = await K.screen(world, lg.data.token); };
  const last = t => screen.got.filter(m => m.t === t).pop();
  const act = m => K.act(world, screen, m);

  // ---- the two games log in and play (Sam's knight near Ava's, on open grass in Thistledown) ----
  for (const g of both) g.FANGLANDS.newGame();
  for (const g of both) { ev(g, 'player.gender = "boy"; save()'); }
  const login = async (g, name) => { const r = await g.NET.post('/api/login', { name, pass: 'secret' }); g.NET.setToken(r.token); g.LOGIN.name = name; g.LOGIN.playing = true; g.NET.connect(); wire.flush(); };
  await login(A, 'Sam'); await login(B, 'Ava');
  tick(20);
  ev(B, 'player.x = 0; player.y = 0'); ev(B, `player.x = ${ev(A, 'player.x')} + 40; player.y = ${ev(A, 'player.y')}`);
  await openScreen();
  tick(90);

  // ---- 1. the frame ----
  {
    const k = last('w_k') || last('w_all');
    const rows = Object.fromEntries((k ? k.knights : []).map(r => [r.n, r]));
    const at = g => ({ x: Math.round(ev(g, 'player.x')), y: Math.round(ev(g, 'player.y')) });
    const s = at(A), a = at(B);
    const place = p => { const pl = ATLAS.place('over', Math.floor(p.x / 48), Math.floor(p.y / 48)); return pl ? pl.name : null; };
    const near = (r, p) => r && Math.abs(r.x - p.x) <= 48 && Math.abs(r.y - p.y) <= 48;
    line('the frame puts Sam and Ava at their real tiles and places (' + (rows.Sam && rows.Sam.place) + ')', near(rows.Sam, s) && near(rows.Ava, a) && rows.Sam.place === place(s) && rows.Ava.place === place(a) && rows.Ava.role === 'admin' && Object.keys(rows.Sam).length === 11, { rows, s, a, places: [place(s), place(a)] });
  }

  // ---- 2. a teacher is watching ----
  {
    const said = sys(B).filter(t => t === 'A teacher is watching Fanglands right now.').length;
    const on = B.TEACHER.watching() && A.TEACHER.watching();
    const rec = [], st = {};
    const g2 = new Proxy(st, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : k === 'fillText' ? (s => { rec.push(String(s)); }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in st ? st[k] : () => { }), set: (t, k, v) => { st[k] = v; return true; } });
    B.__g2 = g2; ev(B, 'openPanel("friends"); HOOKS.panel.friends(window.__g2, false); closePanel()');
    world.webSocketClose(screen, 1000, ''); await openScreen(); tick(10);
    const again = sys(B).filter(t => t === 'A teacher is watching Fanglands right now.').length;
    line('Ava\'s game says "A teacher is watching Fanglands right now." once (not again when the screen comes back) and her Friends header says "A teacher is watching."', said === 1 && again === 1 && on && rec.join(' ').includes('A teacher is watching.'), { said, again, on, rec: rec.slice(0, 6) });
  }

  // ---- 3. mute Sam, then Undo ----
  {
    const a0 = heard.A.length, b0 = heard.B.length;
    const r = act({ t: 'w_mute', n: 'Sam', span: '10m' }); tick(3);
    const told = A.CHAT.log.some(l => l.n === null && l.text === 'A teacher muted your chat for 10 minutes.');
    const refused = A.CHAT.send('can anyone hear me') === false; tick(3);
    A.NET.send({ t: 'chat', text: 'sneaky' }); tick(3);
    const nothing = !got('B', 'chat', b0).some(m => m.n === 'Sam');
    const id = last('w_acts').acts[0].id;
    tick(100);
    const u = act({ t: 'w_undo', act: id }); tick(3);
    const back = A.CHAT.muted() === 0 && A.CHAT.log.some(l => l.n === null && l.text === 'A teacher turned your chat back on.');
    tick(100); const sent = A.CHAT.send('i am back'); tick(3);
    const heardBack = got('B', 'chat', b0).some(m => m.n === 'Sam' && m.text === 'i am back');
    line('a teacher mutes Sam: his game says "A teacher muted your chat for 10 minutes.", his next line goes nowhere; Undo: "A teacher turned your chat back on." and Ava hears him again', r && r.t === 'w_ok' && told && refused && nothing && u && u.t === 'w_ok' && back && sent && heardBack, { r, told, refused, nothing, u, back, sent, heardBack, a0 });
  }

  // ---- 4. pause ----
  {
    const a0 = heard.A.length, b0 = heard.B.length;
    tick(100);
    const r = act({ t: 'w_pause', span: '5m' }); tick(3);
    const said = sys(A).includes('A teacher paused chat for 5 minutes.') && sys(B).includes('A teacher paused chat for 5 minutes.');
    const samLocal = A.CHAT.send('hello') === false;
    A.NET.send({ t: 'chat', text: 'raw hello' }); tick(3);
    const samRefused = !got('B', 'chat', b0).some(m => m.n === 'Sam') && got('A', 'muted', a0).some(m => m.by === 'pause');
    tick(100); const avaSent = B.CHAT.send('admins can talk'); tick(3);
    const avaHeard = got('A', 'chat', a0).some(m => m.n === 'Ava' && m.text === 'admins can talk');
    tick(100);
    const on = act({ t: 'w_chaton' }); tick(3);
    const backOn = sys(A).slice(-3).includes('Chat is back on.') && sys(B).slice(-3).includes('Chat is back on.');
    line('a pause: both games say it; Sam\'s line is refused (on his device and by the world), Ava\'s (an admin) goes through; "Chat is back on." on both when it is turned back on', r && r.t === 'w_ok' && said && samLocal && samRefused && avaSent && avaHeard && on && on.t === 'w_ok' && backOn, { r, said, samLocal, samRefused, avaSent, avaHeard, on, backOn, a: sys(A).slice(-4), b: sys(B).slice(-4) });
  }

  // ---- 5. Watch: Sam alone in the Spider Den, then Ava with him ----
  let view = null;
  {
    tick(100);
    ev(A, 'INSTANCES.enter("spider_den")'); tick(30);
    const st = K.view(world, screen, 'Sam');
    view = st;
    tick(60);   // his game hears view on, and starts its alone stream
    const fromSam = () => wire.made.length;   // (kept for the count below)
    const monIn = { n: 0 };
    const inbound = wire.inbound;
    const origPush = inbound.push.bind(inbound);
    inbound.push = (...xs) => { for (const x of xs) if (x.client === A.NET.sock && /"t":"mon"/.test(x.str)) monIn.n++; return origPush(...xs); };
    const vFrames = () => K.viewed(screen, st && st.v).filter(m => m.t === 'mon').length;
    const f0 = vFrames(); monIn.n = 0;
    tick(60 * 10);
    const alone = { toTeacher: vFrames() - f0, fromGame: monIn.n };
    const told = got('A', 'view').some(m => m.on === true) && A.COOP.viewed();
    const inDen = (K.viewed(screen, st && st.v).filter(m => m.t === 'p' && m.n === 'Sam').pop() || {}).map === 'spider_den';
    line('Watch: the teacher watches Sam alone in the Spider Den; his game is told and streams its monsters about twice a second: ' + alone.toTeacher + ' snapshots reached the teacher in 10 s (' + alone.fromGame + ' messages from his game)', st && st.t === 'w_vstart' && told && inDen && alone.toTeacher >= 15 && alone.toTeacher <= 21 && alone.fromGame === alone.toTeacher, { st: st && st.t, told, inDen, alone });
    // Ava comes in beside him: his game's own stream for her, 8 a second, and nothing more from it for the teacher
    ev(B, 'INSTANCES.enter("spider_den")'); ev(B, `player.x = ${ev(A, 'player.x')} + 40; player.y = ${ev(A, 'player.y')}`); tick(60);
    const f1 = vFrames(); monIn.n = 0;
    tick(60 * 5);
    const withAva = { toTeacher: vFrames() - f1, fromGame: monIn.n };
    line('Ava joins him: the teacher gets his game\'s usual 8 a second (' + withAva.toTeacher + ' in 5 s) and his game sends nothing extra for it (' + withAva.fromGame + ' messages, all of them its stream for Ava)', withAva.toTeacher >= 36 && withAva.toTeacher <= 41 && withAva.fromGame === withAva.toTeacher, withAva);
    const perHour = Math.round(alone.fromGame / 10 * 3600), req = Math.round(perHour / 20);
    console.log('      Watch alone: ' + perHour + ' incoming messages an hour from his game = ' + req + ' Durable Object requests an hour (the cap is 7,200 = 360; unwatched, his keeper heartbeat sends 3,600 of them = 180 anyway); with a friend near it costs 0 extra');
    line('the alone stream is under its cap: ' + req + ' requests an hour of the 360 allowed', req <= 360 && fromSam() >= 0, { perHour, req });
    inbound.push = origPush;
    ev(B, 'INSTANCES.leave()'); ev(A, 'INSTANCES.leave()'); tick(30);
    ev(B, `player.x = ${ev(A, 'player.x')} + 40; player.y = ${ev(A, 'player.y')}`); tick(30);
  }

  // ---- 6. send Sam off ----
  {
    const b0 = heard.B.length;
    // an open trade between them first
    A.NET.send({ t: 'trade_ask', to: 'Ava' }); tick(2); B.NET.send({ t: 'trade_answer', from: 'Sam', yes: true }); tick(2);
    const tid2 = (got('B', 'trade_open', b0).pop() || {}).id;
    A.NET.send({ t: 'trade_offer', id: tid2, items: [{ id: 'coins', qty: 5 }] }); tick(2);
    const opened = !!tid2 && room.trades.size === 1;
    ev(A, 'player.coins = (player.coins || 0) + 17; save()');   // something new on Sam's knight, not yet pushed
    const slot = ev(A, 'localStorage.getItem(title.slotKey(title.slot))');
    const before = (saves.get('sam') || []).length;
    const r = act({ t: 'w_off', n: 'Sam' });
    await new Promise(res => setImmediate(res)); tick(3); await new Promise(res => setImmediate(res));
    const l = saves.get('sam') || [];
    // the push is the slot as the game saved it on the way out (that save carries the coins too)
    const after = ev(A, 'localStorage.getItem(title.slotKey(1))');
    const pushed = l.length === before + 1 && l[l.length - 1].json === after && JSON.parse(after).player.coins === JSON.parse(slot).player.coins;
    const card = !A.LOGIN.playing && A.LOGIN.error === 'A teacher sent you off Fanglands for the rest of today. Your knight is safe. You can play again tomorrow.' && A.LOGIN.mode === 'me';
    const err = got('A', 'error').pop() || {};
    const closed = err.code === 'kicked' && err.why === 'sentoff' && !room.isOnline('Sam') && !A.NET.online() && A.NET.timer === null && !!A.NET.token;
    const tradeEnded = room.trades.size === 0 && got('B', 'trade_end', b0).some(m => m.id === tid2) && !got('B', 'trade_done', b0).length && db.prepare('SELECT COUNT(*) AS n FROM trades').get().n === 0;
    const vend = screen.got.filter(m => m.t === 'w_vend').pop();
    const viewEnded = !!vend && vend.text === 'Sam was sent off until tomorrow.' && room.taps.size === 0;
    line('a teacher sends Sam off: his game goes back to the card with the sentence, the world sends kicked why sentoff with no reconnect and the token kept, his last push landed first (one more version, his slot byte for byte), the open trade with Ava ended with nothing moved, and the teacher\'s view of him ends ("' + (vend && vend.text) + '")', r && r.t === 'w_ok' && opened && pushed && card && closed && tradeEnded && viewEnded, { r, opened, pushed, versions: [before, l.length], card, error: A.LOGIN.error, mode: A.LOGIN.mode, closed, tradeEnded, vend });
    // Play: refused until the world's midnight, then in
    A.LOGIN.playAs(); await new Promise(res => setTimeout(res, 20)); tick(2);
    const refused = !A.LOGIN.playing && A.LOGIN.error === 'A teacher sent you off Fanglands for the rest of today. Your knight is safe. You can play again tomorrow.' && !room.isOnline('Sam');
    const midnight = dayEnd(now()) + 1;
    K.clock.t = midnight;
    A.LOGIN.playAs(); for (let i = 0; i < 20 && !A.LOGIN.playing; i++) { await new Promise(res => setTimeout(res, 10)); tick(1); }
    if (A.BOYGIRL && A.BOYGIRL.asking) A.BOYGIRL.answer('boy');
    for (let i = 0; i < 20 && !room.isOnline('Sam'); i++) { await new Promise(res => setTimeout(res, 10)); tick(2); }
    const inAgain = A.LOGIN.playing && room.isOnline('Sam');
    line('Play is refused while sent off (the same sentence, no socket), and works at the world\'s midnight', refused && inAgain, { refused, inAgain, playing: A.LOGIN.playing, error: A.LOGIN.error, online: room.isOnline('Sam') });
  }

  const bad = results.filter(r => !r).length;
  console.log(`mmo-sim-teacher: ${results.length - bad}/${results.length} PASS (${Date.now() - t0} ms)`);
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
