// ============================================================================
// A TEACHER IS WATCHING — what a kid's game says about the teacher view (docs/ONLINE.md, "The teacher view")
// Owner (2026-10-06): an admin view for Cohen's teachers, to watch the kids when they play at school. The teachers' page is
// src/79-teacherscreen.js (opened from the game's own card) and the world does every check (online/src/watch.js); this file only says it, in the game:
//   - {t:'watching', on}: a grey "A teacher is watching." at the top of the Friends list while it is on, and one grey chat line
//     "A teacher is watching Fanglands right now." at most once every 30 minutes on this device. No names, no count.
//   - {t:'chat_pause', left}: "A teacher paused chat for 15 minutes." in the chat; the box refuses a line here while it runs
//     (an admin's goes out: the world lets admins talk), counted down on this device; "Chat is back on." when it ends or
//     a teacher turns it back on. The world sends nothing when a pause runs out, and books no alarm for it.
//   - a teacher's mute and a send-off are said by 74-chat (by: 'teacher', 'pause') and 71-login (423 sentoff, kicked why
//     'sentoff'); their self-tests are here.
// Feature file: registers through NET.on, CHAT.gate, HOOKS and a wrap of panelBox only. window.TEACHER is the register.
// ============================================================================
{
  const GREY = '#8b949e';
  const SEEN_KEY = 'fanglands.teacherSeen';   // when this device last said "A teacher is watching Fanglands right now." (ms)
  const SAY_EVERY = 30 * 60 * 1000;
  const T = { on: false, pauseUntil: 0 };
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } };
  const line = text => { if (window.CHAT && CHAT.system) CHAT.system(text, GREY); };
  const amount = secs => {
    const s = Math.max(1, Math.ceil(secs));
    const [n, unit] = s < 60 ? [s, 'second'] : s < 3600 ? [Math.ceil(s / 60), 'minute'] : [Math.ceil(s / 3600), 'hour'];
    return n + ' ' + unit + (n === 1 ? '' : 's');
  };
  const pausedLeft = () => T.pauseUntil > Date.now() ? Math.ceil((T.pauseUntil - Date.now()) / 1000) : 0;

  // ---------- "A teacher is watching." ----------
  NET.on('watching', m => {
    T.on = !!(m && m.on === true);
    if (!T.on) return;
    const last = Number(lsGet(SEEN_KEY)) || 0, now = Date.now();
    if (now - last >= SAY_EVERY || last > now) { lsSet(SEEN_KEY, now); line('A teacher is watching Fanglands right now.'); }
  });
  // a lost line forgets it (the world says it again after the next welcome)
  NET.on('offline', () => { T.on = false; });
  NET.on('welcome', () => { T.on = false; });
  // the Friends list's header carries it first, in the header's own grey
  { const _panelBox = panelBox; panelBox = (g, w, h, title, subtitle) => _panelBox(g, w, h, title, (title === 'Friends online' && T.on && NET.online()) ? 'A teacher is watching. ' + (subtitle || '') : subtitle); }

  // ---------- a teacher's pause ----------
  function startPause(left) {
    if (!(left > 0)) return;
    T.pauseUntil = Date.now() + left * 1000;
  }
  NET.on('chat_pause', m => {
    if (!m || typeof m.left !== 'number' || !(m.left >= 0)) return;
    if (m.left > 0) { startPause(m.left); const t = 'A teacher paused chat for ' + amount(m.left) + '.'; line(t); notify(t); return; }
    if (T.pauseUntil) { T.pauseUntil = 0; line('Chat is back on.'); notify('Chat is back on.'); }
  });
  if (window.CHAT && CHAT.gate) CHAT.gate(() => (pausedLeft() && NET.role !== 'admin') ? CHAT.pausedSentence(pausedLeft()) : null);
  HOOKS.update.push(() => { if (T.pauseUntil && Date.now() >= T.pauseUntil) { T.pauseUntil = 0; line('Chat is back on.'); } });

  window.TEACHER = { watching: () => T.on, pausedLeft, paused: left => startPause(left), SEEN_KEY };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'teacher: ';
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, notice, seen: lsGet(SEEN_KEY), on: T.on, pause: T.pauseUntil };
    let sock = null, role = 'player';
    const world = {
      call(method, path) { if (path === '/api/save' && method === 'PUT') return { at: 1, ver: 1 }; if (path === '/api/status') return { ok: true, online: 0, names: [] }; return {}; },
      open() { const s = { readyState: 1, sent: [], send(str) { const m = JSON.parse(str); s.sent.push(m); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen', role }) }); }, close() { s.readyState = 3; } }; sock = s; return s; },
    };
    const feed = m => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(m) }); };
    const drop = code => { if (sock && sock.onclose) sock.onclose(code === undefined ? undefined : { code }); };
    const connect = r => { role = r || 'player'; NET.disconnect(); NET.token = 'teacher-test'; NET.connect(); };
    const sys = () => window.CHAT ? CHAT.log.filter(l => l.n === null).map(l => l.text) : [];
    try {
      NET.enabled = true; NET.useFake(world); closePanel(); paused = false; h.peace(true);
      try { localStorage.removeItem(SEEN_KEY); } catch (e) { }

      // ---- 71: the send-off, said; the session kept; the wire stays down ----
      { const S = 'A teacher sent you off Fanglands for the rest of today. Your knight is safe. You can play again tomorrow.';
        const said = [LOGIN.sentence({ code: 'sentoff', status: 423, until: 1 }, 'login'), LOGIN.sentence({ status: 423 }, 'save'), LOGIN.sentence({ code: 'kicked', why: 'sentoff' }, 'login'), LOGIN.sentence({ code: 'kicked' }, 'login')];
        connect('player'); feed({ t: 'error', code: 'kicked', why: 'sentoff', until: Date.now() + 3600000, text: S }); drop(4005);
        const wire = NET.timer === null && NET.token === 'teacher-test';
        NET.disconnect();
        check(P + 'a send-off reads "' + S + '" from a 423 and from kicked why sentoff (kicked alone is still the admin sentence); the token is kept and the wire does not reconnect', said[0] === S && said[1] === S && said[2] === S && said[3] === 'An admin sent you out of the world. You can come back in.' && LOGIN.SENT_OFF === S && wire, { said, wire }); }

      // ---- 74: a teacher's mute, said as a teacher's; a pause is not a mute ----
      { connect('player'); CHAT.log.length = 0; notice = null;
        feed({ t: 'muted', left: 600, by: 'teacher', span: '10m' }); const ten = notice && notice.text;
        feed({ t: 'muted', left: 3600, by: 'teacher', span: '1h' }); const hour = notice && notice.text;
        feed({ t: 'muted', left: 50000, by: 'teacher', span: 'today' }); const today = notice && notice.text;
        const muted = CHAT.muted() > 0;
        feed({ t: 'unmuted', by: 'teacher' }); const back = notice && notice.text;
        feed({ t: 'unmuted' }); const adminBack = notice && notice.text;
        feed({ t: 'muted', left: 300 }); const admin = notice && notice.text; feed({ t: 'unmuted' });
        feed({ t: 'muted', left: 720, by: 'pause' }); const pause = notice && notice.text, notMuted = CHAT.muted() === 0, counting = pausedLeft() >= 719;
        T.pauseUntil = 0; CHAT.log.length = 0;
        check(P + 'a teacher\'s mute is said as a teacher\'s (10 minutes, 1 hour, the rest of today; never a name), "A teacher turned your chat back on."; an admin\'s is unchanged; a pause refusal is not a mute', ten === 'A teacher muted your chat for 10 minutes. You can still play.' && hour === 'A teacher muted your chat for 1 hour. You can still play.' && today === 'A teacher muted your chat for the rest of today. You can still play.' && muted && back === 'A teacher turned your chat back on.' && adminBack === 'An admin turned your chat back on.' && admin === 'An admin muted you for 5 minutes. You can still play; your chat is off until then.' && pause === 'Chat is paused by a teacher for 12 more minutes.' && notMuted && counting, { ten, hour, today, muted, back, adminBack, admin, pause, notMuted, counting });
        NET.disconnect(); }

      // ---- a pause: said, the box refuses here (an admin's line goes), counted down, "Chat is back on." ----
      { connect('player'); CHAT.log.length = 0; notice = null;
        feed({ t: 'chat_pause', left: 900 });
        const started = sys().includes('A teacher paused chat for 15 minutes.');
        const sent0 = sock.sent.filter(m => m.t === 'chat').length;
        const refused = CHAT.send('hello') === false && sock.sent.filter(m => m.t === 'chat').length === sent0 && /^Chat is paused by a teacher for 15 more minutes\.$/.test(notice && notice.text);
        feed({ t: 'chat_pause', left: 0 }); const backOn = sys().slice(-1)[0] === 'Chat is back on.' && pausedLeft() === 0;
        feed({ t: 'chat_pause', left: 300 }); T.pauseUntil = Date.now() - 1; F.step([]);
        const ranOut = sys().slice(-1)[0] === 'Chat is back on.' && pausedLeft() === 0;
        const free = CHAT.send('free') === true || sock.sent.some(m => m.t === 'chat' && m.text === 'free');
        NET.disconnect();
        connect('admin'); feed({ t: 'chat_pause', left: 300 }); const s1 = sock.sent.filter(m => m.t === 'chat').length;
        F.sim(100, []); CHAT.send('admins can talk'); const adminSends = sock.sent.filter(m => m.t === 'chat').length === s1 + 1;
        T.pauseUntil = 0; NET.disconnect(); CHAT.log.length = 0;
        check(P + 'a pause: "A teacher paused chat for 15 minutes.", the box refuses here while it runs (nothing on the wire), an admin\'s line still goes, and "Chat is back on." when a teacher ends it or the time runs out here', started && refused && backOn && ranOut && free && adminSends, { started, refused, notice: notice && notice.text, backOn, ranOut, free, adminSends, log: sys() }); }

      // ---- "A teacher is watching." ----
      { connect('player'); CHAT.log.length = 0;
        feed({ t: 'watching', on: true }); const once = sys().filter(t => t === 'A teacher is watching Fanglands right now.').length === 1;
        feed({ t: 'watching', on: false }); feed({ t: 'watching', on: true }); const notAgain = sys().filter(t => t === 'A teacher is watching Fanglands right now.').length === 1;
        const rec = [], st = {};
        const g2 = new Proxy(st, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : k === 'fillText' ? (s => { rec.push(String(s)); }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in st ? st[k] : () => { }), set: (t, k, v) => { st[k] = v; return true; } });
        openPanel('friends'); HOOKS.panel.friends(g2, false); const shown = rec.join(' ').includes('A teacher is watching.'); rec.length = 0;
        feed({ t: 'watching', on: false }); HOOKS.panel.friends(g2, false); const gone = !rec.join(' ').includes('A teacher is watching.'); closePanel(); render();
        try { localStorage.setItem(SEEN_KEY, String(Date.now() - SAY_EVERY - 1)); } catch (e) { }
        feed({ t: 'watching', on: true }); const later = sys().filter(t => t === 'A teacher is watching Fanglands right now.').length === 2;
        const noName = !CHAT.log.some(l => /Smith|Lee|\(teacher\)/.test(l.text));
        NET.disconnect(); CHAT.log.length = 0;
        check(P + '"A teacher is watching." tops the Friends list while it is on, and "A teacher is watching Fanglands right now." is said at most once every 30 minutes on a device; never a name', once && notAgain && shown && gone && later && noName, { once, notAgain, shown, gone, later, noName, log: sys() }); }
    } finally {
      NET.disconnect(); NET.useFake(was.fake); NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; NET.role = 'player';
      T.on = was.on; T.pauseUntil = was.pause; notice = was.notice;
      try { if (was.seen == null) localStorage.removeItem(SEEN_KEY); else localStorage.setItem(SEEN_KEY, was.seen); } catch (e) { }
      if (window.CHAT) CHAT.log.length = 0;
      closePanel();
    }
  });
}
