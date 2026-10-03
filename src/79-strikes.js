// ============================================================================
// WORD STRIKES — the warnings, the 24 hours out, and an admin's tools for them
// Cohen (2026-10-03): bad words and bad names should get warnings and then a kick-out. The owner's decisions: the first
// strike is a warning, the second a last warning, the third and every one after it sends the knight out of the world and
// keeps it out for 24 hours; strikes fade after 30 clean days; the owner and MudGoll (admins) can see and clear strikes;
// insults count as well as swear words. docs/ONLINE.md, "Word strikes" and "Renaming a knight", is the contract. The world
// does the counting and the keeping out (online/src/room.js, world.js), so no game can skip it; this file only says it and
// draws the admins' tools. 70-net keeps the wire from reconnecting while kept out; 71-login says until when on the card.
//   A. the knight: a strike's warning in red in the chat log and as a notice; a new name from an admin is remembered for
//      the login card (the wire comes straight back as the new name).
//   B. the Accounts tab (78, through ACCOUNTS.extend): each row tags its strikes, "Kept out" and "Bad name"; a knight's page
//      says them in words, with Clear strikes (two taps) and Rename (a text box, a check, one call). Clear is offered on any
//      knight's page but your own (the world allows it on another admin); Rename never on an admin's.
// Feature file: registers through HOOKS and ACCOUNTS.extend only. window.STRIKES is the register.
// ============================================================================
{
  const RED = '#ff9b8f', ORANGE = '#ffb86b', DIM = '#8b949e', INK = '#e6edf3', GREEN = '#3fb950', GOLD = '#f5c542';
  const NAME_KEY = 'fanglands.lastname';
  const NAME_RE = /^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/;
  const FADE_DAYS = 30;
  const WARN = {
    1: "That word isn't allowed here. This is your warning.",
    2: "Last warning. Do it again and you'll be kept out for 24 hours.",
  };
  const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } };
  const tidy = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const S = { msg: null };   // msg: { n, text, color } the last thing an admin's tap here came to, said on that knight's page

  // ---------- A. the knight ----------
  // A warning stays up a little longer than an ordinary notice: it is the one a kid has to read.
  let said = null;   // the notice say() put up last: a different knight on this device must not read it
  function say(text, color) {
    // the chat strip cuts a long line, so each sentence is a line of its own (74-chat does the same for being muted).
    // A lookahead only: iPadOS 16.3 and older refuse a regex that looks behind, and with it the whole game script.
    if (window.CHAT && CHAT.system) for (const part of text.replace(/\. (?=[A-Z])/g, '.\n').split('\n')) CHAT.system(part, color);
    notify(text); if (notice) notice.t = 6;
    said = notice;
  }
  // The last warning is the one message between a kid and 24 hours out, so it is also the big centre banner (the size a
  // level-up is said in), not only the small ribbon a kid misses mid-fight on an iPad.
  const LAST = { text: 'LAST WARNING', sub: "Do it again: kept out 24 hours", t: 6 };
  NET.on('strike', m => {
    if (!m) return;
    const text = WARN[m.n] || (typeof m.text === 'string' && m.text ? m.text.slice(0, 160) : WARN[1]);
    say(text, RED); sfx('open');
    if (m.n >= 2) levelBanner = Object.assign({}, LAST);
  });
  // Not me, Log out, or a welcome as a different knight (74-chat): this knight's warning notice and LAST WARNING banner go
  // with its chat, on screen and waiting in the banner queue alike
  if (window.CHAT && CHAT.onForget) CHAT.onForget(() => {
    if (notice && notice === said) notice = null;
    said = null;
    if (levelBanner && levelBanner.text === LAST.text) levelBanner = null;
    bannerQueue = bannerQueue.filter(b => !b || b.text !== LAST.text);
    S.msg = null;
  });
  NET.on('error', m => {
    if (!m || m.code !== 'renamed' || typeof m.name !== 'string' || !NAME_RE.test(tidy(m.name)) || tidy(m.name).length > 16) return;
    const name = tidy(m.name);
    lsSet(NAME_KEY, name);
    if (window.LOGIN) LOGIN.name = name;
    // the same knight comes back under its new name: its chat stays
    if (window.CHAT && CHAT.sameKnight) CHAT.sameKnight(name);
    say(`An admin changed your knight's name to ${name}.`, GOLD);
  });

  // ---------- B. the Accounts tab ----------
  // 78-accounts is built in just before this file: its tab is the one these rows go on
  const A = window.ACCOUNTS;
  const keptOut = a => a.wordsLockedUntil > Date.now();
  const strikeWord = n => n === 1 ? '1 strike' : n + ' strikes';
  const fadeDay = a => A.dayWords(a.strikeAt + FADE_DAYS * 86400000);
  const me = () => String(NET.me || '').toLowerCase();
  const api = (method, path, body) => {
    try { return NET.fake ? NET.fake.call(method, path, body, NET.token) : NET.call(method, path, body); }
    catch (e) { return { __threw: e || new Error('failed') }; }
  };
  const when = (v, ok, bad) => {
    if (v && typeof v.then === 'function') { v.then(ok, bad).catch(e => console.error('strikes', e)); return; }
    if (v && v.__threw) bad(v.__threw); else ok(v);
  };

  function tags(a) {
    const out = [];
    if (keptOut(a)) out.push(['Kept out', RED]); else if (a.strikes > 0) out.push([strikeWord(a.strikes), ORANGE]);
    if (a.badName) out.push(['Bad name', RED]);
    return out;
  }
  function lines(a) {
    const out = [];
    if (keptOut(a)) out.push([`Kept out for bad words until ${A.whenWords(a.wordsLockedUntil)}`, RED]);
    if (a.strikes > 0) out.push([`Word strikes: ${a.strikes}. The last was ${A.whenWords(a.strikeAt)}. They are wiped on ${fadeDay(a)} if there are no new ones.`, ORANGE]);
    else out.push(['Word strikes: none', DIM]);
    if (a.badName) out.push(['This name has a bad word in it. Tap Rename to give a new one.', RED]);
    if (S.msg && S.msg.n.toLowerCase() === a.name.toLowerCase()) out.push([S.msg.text, S.msg.color]);
    return out;
  }
  function actions(a) {
    const specs = [];
    if (a.strikes > 0 || keptOut(a)) {
      const armed = confirmActive('acct:clear:' + a.name);
      specs.push({ text: armed ? 'Tap again' : 'Clear strikes', w: 'fill', action: () => confirmTap('acct:clear:' + a.name, () => clear(a.name)), color: armed ? '#c0392b' : '#1f6f4a', key: 'acct:clear' });
    }
    if (a.role !== 'admin') specs.push({ text: 'Rename', w: 'fill', action: () => startRename(a.name), color: a.badName ? '#8b2e2e' : '#4a3d6b', key: 'acct:rename' });
    return specs;
  }

  // Clear strikes: one call, the answer in words on the knight's page
  const CLEAR_WORDS = {
    self: 'Ask the parent page to clear your own strikes.', unknown: 'No knight by that name.', admin: 'Only an admin can do that.',
    wait: 'That is a lot at once. Wait a minute, then try again.', auth: 'You are logged out. Log in again.',
  };
  function clear(n) {
    if (!(window.ADMIN && ADMIN.is())) return false;
    when(api('POST', '/api/accounts/strikes', { name: n }), r => {
      if (!r || r.ok !== true) { S.msg = { n, text: 'That did not work. Try again.', color: ORANGE }; return; }
      S.msg = { n, text: `Done. ${r.name || n}'s strikes are cleared.`, color: GREEN }; sfx('ui'); A.refresh(true);
    }, e => { S.msg = { n, text: CLEAR_WORDS[e && e.code] || 'That did not work. Try again.', color: ORANGE }; });
    return true;
  }

  // Rename: type it, check it, one call
  const RENAME_WORDS = {
    name: 'That name will not do. Use 2 to 16 letters or numbers, and nothing rude.', taken: 'Another knight already has that name.',
    isadmin: "You can't change another admin's name.", self: 'Change your own name on the parent page.', unknown: 'No knight by that name.',
    admin: 'Only an admin can do that.', wait: 'That is a lot of changes at once. Wait a minute, then try again.', auth: 'You are logged out. Log in again.',
  };
  function startRename(n) {
    const a = A.find(n);
    if (!a || a.role === 'admin' || a.name.toLowerCase() === me()) return false;
    A.setWord(''); A.state.view = { kind: 'rename', n: a.name, step: 'type', text: '' }; S.msg = null;
    return true;
  }
  const NAME_MAX = 16;
  const shapeOk = t => t.length >= 2 && t.length <= NAME_MAX && NAME_RE.test(t);
  // what is wrong with a name, in one sentence that says which part (the box takes 16 at most, so too long is a paste)
  const shapeWords = t => t.length < 2 ? 'A name needs at least 2 letters or numbers.' : t.length > NAME_MAX ? `That is ${t.length} letters. A name is at most ${NAME_MAX}.` : 'Only letters, numbers and spaces.';
  function renameNext() {
    const v = A.state.view; if (!v || v.kind !== 'rename' || v.step !== 'type') return false;
    const to = tidy(A.state.word);
    if (!shapeOk(to)) { v.text = shapeWords(to); return false; }
    if (to === v.n) { v.text = `That is already ${v.n}'s name.`; return false; }
    v.to = to; v.step = 'confirm'; v.text = ''; A.blurBox(); return true;
  }
  function renameSend() {
    const v = A.state.view; if (!v || v.kind !== 'rename' || v.step !== 'confirm' || !(window.ADMIN && ADMIN.is())) return false;
    v.step = 'busy';
    when(api('POST', '/api/accounts/rename', { name: v.n, to: v.to }), r => {
      if (A.state.view !== v) return;
      if (!r || r.ok !== true) { v.step = 'failed'; v.text = 'That did not work. Try again.'; return; }
      v.step = 'done'; v.to = r.name || v.to; v.text = `Done. ${v.n} is now called ${v.to}.`; A.setWord(''); sfx('ui'); A.refresh(true);
    }, e => {
      if (A.state.view !== v) return;
      v.text = RENAME_WORDS[e && e.code] || 'That did not work. Try again.';
      v.step = (e && (e.code === 'name' || e.code === 'taken')) ? 'type' : 'failed';
    });
    return true;
  }
  function drawRename(g, x, y, w, h, T, v) {
    const n = v.n, a = A.find(n);
    A.btn(g, x, y, 90, T, 'Back', A.leaveView, '#21262d', v.step !== 'busy', 'acct:rename:back');
    A.text(g, v.step === 'done' ? `${n} has a new name` : `A new name for ${n}`, x + 100, y + T / 2 + 5, w - 100, INK, 'bold 15px sans-serif');
    let yy = y + T + 14;
    const say2 = (s, color, font) => { for (const l of A.wrap(g, s, w, font || '13px sans-serif')) { A.text(g, l, x, yy + 14, w, color, font || '13px sans-serif'); yy += 20; } };
    if (v.step === 'type') {
      A.textBox(g, x, yy, w, T, 'New name', renameNext, NAME_MAX);
      yy += T + 8;
      // the rule once: what is wrong in orange when something is, the rule in grey when nothing is yet
      if (v.text) say2(v.text, ORANGE); else say2('2 to 16 letters or numbers, and nothing rude.', DIM);
      say2('Their knight, save and secret word stay the same.', DIM);
      yy += 6;
      A.btn(g, x, yy, Math.min(w, 220), T, 'Next', renameNext, '#238636', shapeOk(tidy(A.state.word)), 'acct:rename:next');
    } else if (v.step === 'confirm') {
      say2(`Change ${n}'s name to ${v.to}?`, INK, 'bold 15px sans-serif');
      say2(a && a.online ? `${n} is sent out of the world for a moment and comes straight back as ${v.to}.` : `${n} logs in as ${v.to} from now on. The old name still works with the same secret word.`, DIM);
      yy += 6;
      A.row(g, x, yy, Math.min(w, 460), T, [
        { text: 'No, go back', w: 'fill', action: () => { v.step = 'type'; v.text = ''; }, color: '#21262d', key: 'acct:rename:no' },
        { text: 'Yes, rename', w: 'fill', action: renameSend, color: '#c0392b', key: 'acct:rename:yes' }]);
    } else if (v.step === 'busy') {
      say2('Renaming…', DIM);
    } else {
      say2(v.text, v.step === 'done' ? GREEN : ORANGE, v.step === 'done' ? 'bold 14px sans-serif' : '13px sans-serif');
      yy += 6;
      const back = v.step === 'done' ? v.to : n;
      A.btn(g, x, yy, Math.min(w, 220), T, `Back to ${back}`, () => { A.setWord(''); A.state.view = { kind: 'acct', n: back }; }, '#21262d', true, 'acct:rename:done');
    }
  }
  A.extend({ tags, lines, actions, views: { rename: drawRename } });
  NET.on('welcome', () => { S.msg = null; });

  window.STRIKES = { WARN, clear, startRename, renameNext, renameSend, tags, lines, actions, state: S };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'strikes: ';
    if (window.INSTANCES && INSTANCES.active && INSTANCES.active()) INSTANCES.leave();
    // the title card test sends the game to the title screen: the game is saved first and started again from its slot after
    if (!title.active) save();
    const game = { slot: title.slot, active: title.active };
    const keptWas = (() => { try { return localStorage.getItem(LOGIN.KEPT_KEY); } catch (e) { return null; } })();
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, touch: window.__forceTouch, peace: window.__peace, notice, paused, vw: window.innerWidth, vh: window.innerHeight, tab: ADMIN.state.tab, last: (() => { try { return localStorage.getItem(NAME_KEY); } catch (e) { return null; } })(), loginName: window.LOGIN ? LOGIN.name : null, playing: window.LOGIN ? LOGIN.playing : false };
    let sock = null, role = 'admin', me0 = 'MudGoll';
    const calls = [], socks = [];
    const world = {
      list: [], fail: {}, meFail: null,
      call(method, path, body) {
        calls.push({ method, path, body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)) });
        const no = (code, status, extra) => { const e = new Error(code); e.code = code; e.status = status; Object.assign(e, extra || {}); throw e; };
        if (world.fail[path]) no(world.fail[path].code, world.fail[path].status || 403, world.fail[path].extra);
        if (path === '/api/accounts' && method === 'GET') return JSON.parse(JSON.stringify(world.list));
        if (path === '/api/accounts/strikes') return { ok: true, name: body.name };
        if (path === '/api/accounts/rename') return { ok: true, from: body.name, name: body.to };
        // kept out: every call with the session is refused but a save, as the world does
        if (world.meFail && (path === '/api/me' || (path === '/api/save' && method !== 'PUT'))) no(world.meFail.code, 403, world.meFail.extra);
        if (path === '/api/save' && method === 'PUT') return { at: 1, ver: 1 };
        if (path === '/api/me') return { name: me0 };
        if (path === '/api/save/pin') return { at: null, bytes: 0 };
        if (path === '/api/status') return { ok: true, online: 0, names: [] };
        return {};
      },
      open() { const s = { readyState: 1, sent: [], send(str) { const m = JSON.parse(str); s.sent.push(m); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: me0, at: 1, keeper: me0, role }) }); }, close() { s.readyState = 3; } }; sock = s; socks.push(s); return s; },
    };
    const feed = m => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(m) }); };
    const drop = code => { if (sock && sock.onclose) sock.onclose(code === undefined ? undefined : { code }); };
    const connect = (r, name) => { role = r; me0 = name || 'MudGoll'; NET.disconnect(); NET.token = 'strikes-test'; NET.connect(); };
    const has = label => buttons.some(b => b.label === label);
    const posts = path => calls.filter(c => c.path === path && c.method === 'POST');
    const rec = [], st = {};
    const g2 = new Proxy(st, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : k === 'fillText' ? ((s) => { rec.push(String(s)); }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in st ? st[k] : () => { }), set: (t, k, v) => { st[k] = v; return true; } });
    const drawn = () => { rec.length = 0; HOOKS.panel.admin(g2, false); const out = rec.splice(0); render(); return out; };
    const lsName = () => { try { return localStorage.getItem(NAME_KEY); } catch (e) { return null; } };
    const now = Date.now(), HR = 3600000, DAY = 24 * HR;
    const base = { role: 'player', online: false, map: null, region: null, lv: null, created: now - 20 * DAY, lastOn: now - DAY, lastLogin: null, onlineMs: 0, countedSince: now - 9 * DAY, playSeconds: 600, saveAt: now - DAY, banned: false, mutedUntil: 0, logins: [] };
    const acct = o => Object.assign({}, base, o);
    world.list = [
      acct({ name: 'Ada', role: 'admin', strikes: 1, strikeAt: now - 2 * DAY }),
      acct({ name: 'Cohen', online: true, map: 'over', region: 'Wolfwood', lastOn: now }),
      acct({ name: 'MudGoll', role: 'admin', online: true, map: 'over', region: 'Thistledown', lastOn: now }),
      acct({ name: 'Pip', strikes: 2, strikeAt: now - 3 * HR }),
      acct({ name: 'Sam', strikes: 3, strikeAt: now - HR, wordsLockedUntil: now + 23 * HR }),
      acct({ name: 'Stupid Sam', badName: true }),
    ];
    try {
      NET.enabled = true; NET.useFake(world); dialog.cur = null; dialog.queue.length = 0; closePanel(); paused = false; h.peace(true); window.__forceTouch = false;
      try { window.innerWidth = 1000; window.innerHeight = 700; } catch (e) { } render();

      // ---- the script itself: no regex lookbehind anywhere (Safari learned it in 16.4; older iPads refuse the whole game) ----
      { const src = String(window.__gameSource || (typeof document !== 'undefined' && document.querySelectorAll ? Array.from(document.querySelectorAll('script'), q => q.textContent).join('\n') : ''));
        const look = new RegExp('\\(\\?<[=!]'), m = look.exec(src);
        check(P + 'the game script has no regex lookbehind, which iPadOS 16.3 and older refuse (and with it the whole game, leaving the page blank)', src.length > 100000 && !m, { len: src.length, at: m ? src.slice(Math.max(0, m.index - 80), m.index + 40) : null }); }

      // ---- A. the warnings, as the knight hears them ----
      { connect('player', 'Cohen'); if (window.CHAT) CHAT.log.length = 0; notice = null;
        clearBanners(); feed({ t: 'strike', n: 1, text: WARN[1] }); const one = notice && notice.text === WARN[1] && notice.t >= 6 && !levelBanner;
        const l1 = window.CHAT ? CHAT.log.slice(-2) : []; const red1 = l1.length === 2 && l1.every(l => l.n === null && l.color === RED) && l1.map(l => l.text).join(' ') === WARN[1] && l1[0].text === "That word isn't allowed here.";
        clearBanners(); const noBig = !levelBanner;
        feed({ t: 'strike', n: 2, text: 'anything' }); const two = notice.text === WARN[2] && CHAT.log.slice(-2).map(l => l.text).join(' ') === WARN[2];
        // the last warning is the big centre banner as well
        const big = noBig && !!levelBanner && levelBanner.text === 'LAST WARNING' && levelBanner.sub === 'Do it again: kept out 24 hours' && levelBanner.t >= 6; clearBanners();
        check(P + 'a strike is said to the knight in plain words, in red in the chat log (a line a sentence, so the strip never cuts it) and as a notice that stays up: the first "' + WARN[1] + '", the second "' + WARN[2] + '", which is also the big centre banner LAST WARNING', one && red1 && two && big && WARN[1] === "That word isn't allowed here. This is your warning." && WARN[2] === "Last warning. Do it again and you'll be kept out for 24 hours.", { one, red1, two, big, notice, last: CHAT.log.slice(-2) }); }

      // ---- a different knight on this device: nothing of the last one's warnings or lines is shown to it ----
      { const warned = () => CHAT.log.filter(l => l.n === 'Cohen' || /warning|kept out|isn't allowed/i.test(l.text)).length;
        const noneLeft = () => warned() === 0 && !(notice && /warning/i.test(notice.text)) && !bannerAhead(LAST.text) && !CHAT.bubbles.Cohen;
        const strike2 = () => { feed({ t: 'chat', n: 'Cohen', text: 'die *** **** goblin', at: 5 }); feed({ t: 'strike', n: 1, text: WARN[1] }); feed({ t: 'chat', n: 'Cohen', text: '*** **** goblin', at: 6 }); feed({ t: 'strike', n: 2, text: WARN[2] }); };
        // Not me, then Ada logs in on the same iPad
        connect('player', 'Cohen'); CHAT.log.length = 0; clearBanners(); notice = null; strike2();
        const before = warned() >= 4 && bannerAhead(LAST.text) && notice && notice.text === WARN[2] && !!CHAT.bubbles.Cohen;
        LOGIN.notMe(); const atCard = noneLeft();
        connect('player', 'Ada'); feed({ t: 'chat', n: 'Leo', text: 'hi ada', at: 7 });
        const ada = noneLeft() && CHAT.log.length === 1 && CHAT.log[0].text === 'hi ada' && NET.me === 'Ada';
        // no Not me: a welcome as a different name forgets too (a kept-out session that ends, a second login)
        connect('player', 'Cohen'); CHAT.log.length = 0; clearBanners(); notice = null; strike2();
        connect('player', 'Ada'); const welcomeOnly = noneLeft();
        // a rename by an admin is the same knight: its warning stays with it
        connect('player', 'Cohen'); CHAT.log.length = 0; clearBanners(); notice = null; feed({ t: 'strike', n: 1, text: WARN[1] });
        feed({ t: 'error', code: 'renamed', name: 'Brave Cohen' }); connect('player', 'Brave Cohen');
        const renamedKeeps = CHAT.log.some(l => l.text === "That word isn't allowed here.");
        clearBanners(); notice = null; CHAT.log.length = 0;
        check(P + "a different knight on this device: after a strike for Cohen, Not me (or a welcome as another name) empties the chat log and bubbles and takes down the warning notice and LAST WARNING, so Ada never reads Cohen's \"Last warning.\" or his starred lines; a rename keeps them (same knight)", before && atCard && ada && welcomeOnly && renamedKeeps, { before, atCard, ada, welcomeOnly, renamedKeeps, log: CHAT.log.map(l => (l.n || '-') + ': ' + l.text), notice }); }

      // ---- the lockout sentence: the real time it ends, in this device's clock ----
      { const Y = new Date().getFullYear(), t0 = new Date(Y, 9, 3, 19, 42).getTime(), dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const later = new Date(Y, 9, 6, 9, 5);
        const got = [LOGIN.keptOut(t0 + DAY, t0), LOGIN.keptOut(t0 + 2 * HR, t0), LOGIN.keptOut(new Date(Y, 9, 4, 0, 30).getTime(), t0), LOGIN.keptOut(later.getTime(), t0), LOGIN.keptOut(null, t0),
          LOGIN.sentence({ code: 'words', until: t0 + DAY }, 'login').startsWith("You're kept out until "), LOGIN.sentence({ code: 'renamed', name: 'Brave Sam' })];
        const want = ["You're kept out until 7:42 pm tomorrow for bad words.", "You're kept out until 9:42 pm today for bad words.", "You're kept out until 12:30 am tomorrow for bad words.",
          `You're kept out until 9:05 am on ${dow[later.getDay()]} 6 Oct for bad words.`, "You're kept out for 24 hours for bad words.", true, "An admin changed your knight's name to Brave Sam."];
        check(P + 'kept out is said with the real time it ends: "You\'re kept out until 7:42 pm tomorrow for bad words." (today, tomorrow, or the day), never "wrong secret word"', JSON.stringify(got) === JSON.stringify(want), { got, want }); }

      // ---- the wire: kept out stops reconnecting and keeps the session; a new name reconnects ----
      { const ends = {};
        for (const code of [4006, 4007]) { connect('player', 'Cohen'); drop(code); ends[code] = NET.timer === null ? 'stays' : 'reconnects'; NET.disconnect(); }
        connect('player', 'Cohen'); feed({ t: 'error', code: 'words', text: "You're kept out for 24 hours more for bad words.", until: now + DAY }); drop(1006);
        const words = NET.timer === null && NET.token === 'strikes-test';
        NET.disconnect();
        check(P + 'the wire: closed 4006 (kept out for bad words) books no reconnect, and an error words keeps the session for when the time is up; closed 4007 (a new name) comes straight back', ends[4006] === 'stays' && ends[4007] === 'reconnects' && words, { ends, words, token: NET.token }); }

      // ---- the title card: kicked while playing, and the card when the world says kept out ----
      { connect('player', 'Cohen'); LOGIN.playing = true; const until = now + 23 * HR;
        world.meFail = { code: 'words', extra: { until } };
        // a push is waiting (saves are held 12 s): the kick sends it at once, so the next login never loads an older save
        if (window.CLOUD) CLOUD.reset(); try { localStorage.removeItem(LOGIN.KEPT_KEY); } catch (e) { } calls.length = 0;
        const slotKey = title.active ? null : title.slotKey(title.slot);
        if (window.CHAT) CHAT.open(); const chatWas = !window.CHAT || CHAT.isOpen();
        feed({ t: 'error', code: 'words', text: 'out', until });
        // an open chat box is shut: it would sit over the title card (the third strike always comes from chat)
        const chatShut = chatWas && (!window.CHAT || !CHAT.isOpen());
        const slotRaw = slotKey && (() => { try { return localStorage.getItem(slotKey); } catch (e) { return null; } })();
        const puts = calls.filter(c => c.method === 'PUT' && c.path === '/api/save');
        const pushed = !!slotRaw && puts.length === 1 && puts[0].body === slotRaw && CLOUD.pending === null && CLOUD.fails === 0;
        check(P + "kept out while playing: the game is saved and the waiting push goes up at once (the world takes a save while kept out), as it does for an admin's kick, and an open chat box is shut", pushed && chatShut, { chatWas, chatShut, puts: puts.length, slot: !!slotRaw, pending: !!(window.CLOUD && CLOUD.pending), fails: window.CLOUD && CLOUD.fails });
        const sentence = LOGIN.keptOut(until);
        const card = !LOGIN.playing && LOGIN.showing && NET.token === 'strikes-test' && LOGIN.mode === 'me' && LOGIN.shownError() === sentence;
        // Play: the world still says kept out, and the card says it again (never "wrong secret word")
        // Play is greyed while kept out, and does nothing (no "One moment...", no call)
        calls.length = 0; const playBtn = typeof document !== 'undefined' && document.querySelector ? Array.from(document.querySelectorAll('#fl-login button')).find(b => b.textContent === 'Play' && !b.closest('form')) : null;
        const greyed = LOGIN.playAs() === false && calls.length === 0 && (!playBtn || playBtn.disabled === true);
        const again = greyed && LOGIN.mode === 'me' && LOGIN.shownError() === sentence && NET.token === 'strikes-test';
        // the world is asked again on its own now and then: an admin who cleared it gets Play back without a reload
        world.meFail = null; LOGIN.recheck(); const back = LOGIN.mode === 'me' && LOGIN.keptOutUntil() === 0 && LOGIN.shownError() === '' && (!playBtn || playBtn.disabled === false);
        world.meFail = { code: 'words', extra: { until } }; LOGIN.noteKeptOut(until); LOGIN.recheck(); const still = LOGIN.shownError() === sentence && LOGIN.keptOutUntil() === until;
        // a fresh login: the right word, kept out
        NET.setToken(null); LOGIN.mode = 'form'; world.fail['/api/login'] = { code: 'words', status: 403, extra: { until } };
        LOGIN.submit('Cohen', 'sword', '', false); const login = LOGIN.mode === 'form' && LOGIN.shownError() === sentence && NET.token === null;
        delete world.fail['/api/login'];
        check(P + 'kept out while playing: back to the title with "Playing as" and the sentence (the session kept), Play greyed and doing nothing, the world asked again quietly (cleared: Play comes back; still out: the sentence stays), and a login with the right secret word says it too', card && again && back && still && login, { card, greyed, again, back, still, login, mode: LOGIN.mode, shown: LOGIN.shownError(), sentence });
        // no way round it with a new knight: the device remembers until when, Not me still says it, New knight is refused on
        // the spot (no call), and a new knight the world refuses (kept out from this place) says the sentence too
        { const kept = LOGIN.keptOutUntil() === until;
          // after Not me the card speaks about this device, not a knight: a brother or sister reads it, and their knight still logs in
          const off = LOGIN.newKnightOff(until);
          NET.setToken('strikes-test'); LOGIN.mode = 'me'; LOGIN.notMe(); const notMe = LOGIN.mode === 'form' && LOGIN.shownError() === off && off.startsWith('New knight is off here until ') && off.endsWith('. Your own knight can still log in.') && !/kept out/.test(off);
          calls.length = 0; LOGIN.submit('Cohen Two', 'sword', 'TEST-1234', true);
          const refused = LOGIN.shownError() === off && !calls.some(c => c.path === '/api/signup') && !NET.token && !LOGIN.newKnight;
          try { localStorage.removeItem(LOGIN.KEPT_KEY); } catch (e) { }
          world.fail['/api/signup'] = { code: 'words', status: 403, extra: { until } }; LOGIN.error = '';
          LOGIN.submit('Cohen Two', 'sword', 'TEST-1234', true); delete world.fail['/api/signup'];
          const place = calls.some(c => c.path === '/api/signup') && LOGIN.shownError() === off && LOGIN.keptOutUntil() === until;
          const gone = LOGIN.keptOutUntil(until + 1) === 0 && (() => { try { return localStorage.getItem(LOGIN.KEPT_KEY) === null; } catch (e) { return true; } })();
          check(P + 'kept out on this device: after Not me the card says "New knight is off here until ..." (about the device, not a knight), a New knight is refused before the world is asked, a new knight the world refuses (this place is kept out) says the sentence too, and the device forgets it once the time is up', kept && notMe && refused && place && gone, { kept, notMe, refused, place, gone, shown: LOGIN.shownError() }); }
        world.meFail = null; NET.token = 'strikes-test';
        // back to the game the suite was playing
        LOGIN.hide(); LOGIN.playing = false; NET.disconnect(); title.startSlot(game.slot); }

      // ---- a new name from an admin: remembered for the login card, said in words ----
      { connect('player', 'Stupid Sam'); notice = null; try { localStorage.setItem(NAME_KEY, 'Stupid Sam'); } catch (e) { }
        feed({ t: 'error', code: 'renamed', text: 'x', name: 'Brave Sam' }); drop(4007);
        const kept = lsName() === 'Brave Sam' && LOGIN.name === 'Brave Sam' && notice && notice.text === "An admin changed your knight's name to Brave Sam." && NET.timer !== null;
        NET.disconnect(); try { localStorage.setItem(NAME_KEY, 'Pip'); } catch (e) { }
        connect('player', 'Pip'); feed({ t: 'error', code: 'renamed', name: 'Bad Name!!' }); const junk = lsName() === 'Pip';
        // the login card learns a new name from the world's answer too (/api/me after a rename while logged out)
        NET.disconnect(); me0 = 'Brave Sam'; NET.token = 'strikes-test'; LOGIN.noteKeptOut(now + HR); LOGIN.show();
        const fromMe = lsName() === 'Brave Sam' && LOGIN.name === 'Brave Sam' && LOGIN.keptOutUntil() === 0; LOGIN.hide();
        check(P + 'a new name from an admin: remembered as the last name for the login card, said in words, and the wire comes back; a junk name is ignored; the login card takes the name the world answers (and a good answer forgets an old lockout: an admin may have cleared it)', kept && junk && fromMe, { kept, junk, fromMe, last: lsName(), notice }); }

      // ---- B. the Accounts tab: tags on the list, words on a knight's page ----
      { connect('admin'); closePanel(); ADMIN.open('accounts'); render();
        const text = drawn();
        const tagsOk = ['Kept out', '2 strikes', 'Bad name'].every(t => text.includes(t)) && !text.includes('3 strikes');
        A.openAccount('Sam'); const sam = drawn().join(' ');
        const samOk = sam.includes('Kept out for bad words until ' + A.whenWords(now + 23 * HR)) && sam.includes('Word strikes: 3. The last was ' + A.whenWords(now - HR) + '. They are wiped on ' + A.dayWords(now - HR + 30 * DAY) + ' if there are no new ones.') && !/go on/.test(sam) && has('acct:clear') && has('acct:rename');
        A.openAccount('Cohen'); const cohen = drawn().join(' '); const cohenOk = cohen.includes('Word strikes: none') && !has('acct:clear') && has('acct:rename');
        A.openAccount('Stupid Sam'); const bad = drawn().join(' '); const badOk = bad.includes('This name has a bad word in it. Tap Rename to give a new one.') && has('acct:rename');
        A.openAccount('Ada'); drawn(); const adaOk = has('acct:clear') && !has('acct:rename');
        A.openAccount('MudGoll'); drawn(); const meOk = !has('acct:clear') && !has('acct:rename');
        check(P + "Accounts: rows tag Kept out, the strikes and Bad name; a knight's page says until when, how many strikes, when the last was and the day they are wiped, and flags a bad name; Clear strikes only when there is something to clear, Rename never for an admin, neither on your own page", tagsOk && samOk && cohenOk && badOk && adaOk && meOk, { tagsOk, samOk, cohenOk, badOk, adaOk, meOk, sam, title: title.active, panel }); }

      // ---- Clear strikes: two taps, one call, the answer in words, the list asked again ----
      { closePanel(); ADMIN.open('accounts'); render(); A.openAccount('Sam'); render(); calls.length = 0;
        F.clickButton('acct:clear'); const armed = posts('/api/accounts/strikes').length === 0;
        render(); F.clickButton('acct:clear'); const sent = JSON.stringify(posts('/api/accounts/strikes').map(c => c.body)) === JSON.stringify([{ name: 'Sam' }]);
        const asked = calls.filter(c => c.path === '/api/accounts').length === 1;
        const said = drawn().join(' ').includes("Done. Sam's strikes are cleared.");
        world.fail['/api/accounts/strikes'] = { code: 'wait', status: 429 }; STRIKES.clear('Pip'); A.openAccount('Pip');
        const waitSaid = drawn().join(' ').includes('That is a lot at once. Wait a minute, then try again.');
        delete world.fail['/api/accounts/strikes'];
        check(P + 'Clear strikes: the first tap only arms it; the second sends POST /api/accounts/strikes {name}, says it is done and asks for the list again; a refusal is a sentence', armed && sent && asked && said && waitSaid, { armed, sent, asked, said, waitSaid }); }

      // ---- Rename: type, check, one call ----
      { closePanel(); ADMIN.open('accounts'); render(); A.openAccount('Stupid Sam'); render(); calls.length = 0;
        F.clickButton('acct:rename'); render(); const typing = A.state.view.kind === 'rename' && has('acct:wordbox') && has('disabled:acct:rename:next') && A.boxMax() === 16;
        A.setWord('x'); const short = STRIKES.renameNext() === false && A.state.view.text === 'A name needs at least 2 letters or numbers.';
        // the rule is said once: the orange sentence replaces the grey one
        const once = (() => { const t = drawn().join(' '); return !t.includes('2 to 16 letters or numbers, and nothing rude.') && t.split('letters or numbers').length === 2; })();
        A.setWord('Seventeen letters'); const long = STRIKES.renameNext() === false && A.state.view.text === 'That is 17 letters. A name is at most 16.';
        A.setWord('Sir-Sam'); const odd = STRIKES.renameNext() === false && A.state.view.text === 'Only letters, numbers and spaces.';
        A.setWord('  Brave   Sam '); render(); F.clickButton('acct:rename:next'); const confirmText = drawn().join(' ');
        const asks = A.state.view.step === 'confirm' && confirmText.includes("Change Stupid Sam's name to Brave Sam?") && posts('/api/accounts/rename').length === 0;
        F.clickButton('acct:rename:no'); const back = A.state.view.step === 'type';
        render(); F.clickButton('acct:rename:next'); render(); F.clickButton('acct:rename:yes');
        const one = JSON.stringify(posts('/api/accounts/rename').map(c => c.body)) === JSON.stringify([{ name: 'Stupid Sam', to: 'Brave Sam' }]);
        const done = A.state.view.step === 'done' && drawn().join(' ').includes('Done. Stupid Sam is now called Brave Sam.') && has('acct:rename:done');
        // refusals: a name the world will not take, or one that is taken, go back to typing; others end the view
        const said = {};
        for (const code of ['name', 'taken', 'isadmin', 'wait', 'boom']) { world.fail['/api/accounts/rename'] = { code, status: 400 }; STRIKES.startRename('Pip'); A.setWord('Pip Two'); STRIKES.renameNext(); STRIKES.renameSend(); said[code] = A.state.view.step + ': ' + A.state.view.text; }
        delete world.fail['/api/accounts/rename'];
        const wantSaid = { name: 'type: That name will not do. Use 2 to 16 letters or numbers, and nothing rude.', taken: 'type: Another knight already has that name.', isadmin: "failed: You can't change another admin's name.", wait: 'failed: That is a lot of changes at once. Wait a minute, then try again.', boom: 'failed: That did not work. Try again.' };
        const noAdmin = STRIKES.startRename('Ada') === false && STRIKES.startRename('MudGoll') === false;
        STRIKES.startRename('Pip'); A.setWord('typed'); closePanel(); F.step([]); const forgot = A.state.word === '' && (!A.state.view || A.state.view.kind === 'acct');
        check(P + 'Rename: the box takes 16 letters at most; Next stays off until the name is 2 to 16 letters or numbers; a refusal says which part is wrong (too short, how many letters too long, a character), once, in place of the grey rule; the page asks "Change Stupid Sam\'s name to Brave Sam?" first; No goes back; Yes sends exactly POST /api/accounts/rename {name, to} (spaces tidied) and says it is done; each refusal is a sentence; never for an admin; the word is forgotten when the panel closes',
          typing && short && once && long && odd && asks && back && one && done && JSON.stringify(said) === JSON.stringify(wantSaid) && noAdmin && forgot, { typing, short, once, long, odd, asks, back, one, done, said, noAdmin, forgot }); }

      // ---- layout: the knight's page with the new rows and every step of Rename, at every size, 44 px on touch ----
      { closePanel(); connect('admin');
        const sizes = [[390, 844, 'phone'], [844, 390, 'landscape phone'], [768, 1024, 'iPad'], [1024, 768, 'iPad landscape'], [1280, 800, 'laptop']];
        const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        const hits = [], small = []; let done = 0;
        for (const touchOn of [false, true]) {
          window.__forceTouch = touchOn;
          for (const [w, hh, name] of sizes) {
            try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { }
            closePanel(); render(); if (VW !== w || VH !== hh) continue;
            const tag = name + (touchOn ? ' touch' : '');
            for (const view of ['sam', 'type', 'confirm', 'done']) {
              ADMIN.open('accounts'); render(); A.openAccount('Sam'); S.msg = { n: 'Sam', text: "Done. Sam's strikes are cleared.", color: GREEN };
              if (view !== 'sam') { STRIKES.startRename('Sam'); A.setWord('Brave Sam'); if (view !== 'type') STRIKES.renameNext(); if (view === 'done') STRIKES.renameSend(); }
              render(); render();
              const r = panelRect, mine = buttons.slice(ADMIN.state.panelFrom || 0).filter(b => b.w > 0 && b.h > 0 && !/^acct:area:/.test(b.label));
              for (const b of mine) if (!r || b.x < r.x - 1 || b.y < r.y - 1 || b.x + b.w > r.x + r.w + 1 || b.y + b.h > r.y + r.h + 1) hits.push(`${tag} ${view}: ${b.label} leaves the panel`);
              for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) if (overlap(mine[i], mine[j])) hits.push(`${tag} ${view}: ${mine[i].label} x ${mine[j].label}`);
              if (touchOn) for (const b of mine) if (b.h < 44 || b.w < 44) small.push(`${tag} ${view}: ${b.label} ${Math.round(b.w)}x${Math.round(b.h)}`);
              // the page scrolls far enough to reach Clear strikes and Rename
              if (view === 'sam') { A.state.scroll.acct = 1e6; render(); render(); if (!has('acct:clear') || !has('acct:rename')) hits.push(`${tag}: Clear strikes or Rename out of reach`); }
              done++; S.msg = null; closePanel(); F.step([]);
            }
          }
        }
        try { window.innerWidth = was.vw; window.innerHeight = was.vh; } catch (e) { } window.__forceTouch = was.touch;
        check(P + "layout: a knight's page with its strike rows and every step of Rename keep their buttons inside the panel and clear of each other at phone, landscape phone, iPad (both ways) and laptop sizes, touch on and off; Clear strikes and Rename can be scrolled to; on touch every button is at least 44 px", hits.length === 0 && small.length === 0 && done === 40, { hits: hits.slice(0, 12), small: small.slice(0, 12), done }); }
    } catch (e) {
      check(P + 'the strikes self-test ran to the end without an exception', false, { error: String((e && e.stack) || e).slice(0, 800) });
    } finally {
      S.msg = null; A.setWord('');
      NET.disconnect(); NET.emit('offline', { t: 'offline' }); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; NET.role = 'player';
      if (window.COOP) COOP.reset();
      if (window.LOGIN) { LOGIN.name = was.loginName; LOGIN.playing = was.playing; LOGIN.showing = false; LOGIN.error = ''; LOGIN.mode = 'form'; }
      try { if (was.last == null) localStorage.removeItem(NAME_KEY); else localStorage.setItem(NAME_KEY, was.last); } catch (e) { }
      try { if (keptWas == null) localStorage.removeItem(LOGIN.KEPT_KEY); else localStorage.setItem(LOGIN.KEPT_KEY, keptWas); } catch (e) { }
      if (window.CLOUD) CLOUD.reset();
      if (window.CHAT) CHAT.log.length = 0;
      window.__forceTouch = was.touch; try { window.innerWidth = was.vw; window.innerHeight = was.vh; } catch (e) { }
      ADMIN.state.tab = 'knights'; ADMIN.state.view = null; A.state.view = null;
      closePanel(); h.peace(was.peace); paused = was.paused; notice = was.notice;
      if (game.active) title.open(); else title.startSlot(game.slot);
      paused = was.paused; notice = was.notice;
      render();
    }
  });
}
