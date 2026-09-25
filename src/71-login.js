// ============================================================================
// LOGIN — the online title screen at gorkscape.ca
// Owner: "make it an online MMORPG so Cohen and his friends can log in and play together."
// When the wire says we are online (NET.enabled) the three slot cards give way to one card: a real HTML form
// (so the iPad keyboard works) for the knight's name and secret word, a New knight switch that asks for the
// invite code, and a line saying who is on. Online there are no slots: the account is the knight. A login
// pulls the cloud save into slot 1 and starts it exactly the way 14-title starts a slot; a knight with no cloud
// save yet is offered the one on the old GitHub Pages address (bridge.html, in a hidden iframe) or starts fresh.
// Play alone falls back to the ordinary three-slot title with no network at all.
// Feature file: registers through HOOKS and wraps title.open / title.tick / drawHud by reassignment. Nothing in
// here touches the DOM without checking there is one (tools/headless.js has no document.body).
// window.LOGIN is the register; docs/ONLINE.md is the contract.
// ============================================================================
{
  const BRIDGE_ORIGIN = 'https://ethanbender.github.io';
  const BRIDGE_URL = BRIDGE_ORIGIN + '/fanglands/bridge.html';
  const BRIDGE_WAIT = 3000;
  const NAME_KEY = 'fanglands.lastname';
  const MARK_KEY = 'fanglands.slot.1.online';
  const CHAPTERS = ['The Cave', 'Thistledown', 'Goblin Tech', 'Hollowford', 'The Fang'];
  const NAME_RE = /^[A-Za-z0-9 ]{2,16}$/;
  const SLOT = n => title.slotKey(n), AT = n => title.slotKey(n) + '.at';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };
  const hasDom = () => typeof document !== 'undefined' && !!document.body && !!document.head && typeof document.createElement === 'function';
  const canListen = typeof document !== 'undefined' && typeof document.addEventListener === 'function' && typeof window.addEventListener === 'function';
  const noop = () => { };

  const LOGIN = {
    showing: false,   // the online card is up over the title backdrop
    playing: false,   // a knight started through this flow is in the game (72-cloudsave pushes saves while true)
    alone: false,     // Play alone was chosen: the ordinary three-slot title, no network
    name: null,       // the knight's name once the world said yes
    mode: 'form',     // form | checking | me | busy | offer
    newKnight: false, error: '', status: '', asleep: false, offer: null, busy: false,
    stats: { login: 0, signup: 0 },
    MARK_KEY, BRIDGE_ORIGIN,
  };
  window.LOGIN = LOGIN;

  // ---------- calls: a fake transport may answer on the spot (no promise), so the flow runs on plain callbacks ----------
  // NET.call is async and a promise never settles inside the synchronous self-test, so with a fake in place the
  // fake is asked directly (with the same arguments NET.call would hand it) and its answer is used as it comes.
  const api = (method, path, body) => {
    try { return NET.fake ? NET.fake.call(method, path, body, NET.token) : NET.call(method, path, body); }
    catch (e) { return { __threw: e || new Error('failed') }; }
  };
  const when = (v, ok, bad) => {
    if (v && typeof v.then === 'function') { v.then(ok, bad).catch(e => console.error('login', e)); return; }
    if (v && v.__threw) bad(v.__threw); else ok(v);
  };

  // ---------- the world's answers in plain words ----------
  LOGIN.sentence = (err, kind) => {
    const code = err && err.code, st = err && err.status;
    if (code === 'wait' || st === 429) return 'Too many tries. Wait a minute.';
    if (code === 'kicked') return 'An admin sent you out of the world. You can come back in.';
    if (code === 'banned') return 'This knight is not allowed in. Ask Ethan.';
    if (code === 'invite' || code === 'bad_invite') return 'That invite code is not right.';
    if (code === 'pass' || code === 'password' || code === 'wrong' || code === 'secret') return 'That secret word is wrong.';
    if (code === 'unknown' || code === 'noname' || code === 'nosuch') return 'No knight by that name yet. Tap New knight.';
    if (code === 'taken' || code === 'exists') return 'That name is already taken. Pick another.';
    if (code === 'name' || code === 'bad_name' || code === 'filtered') return kind === 'login' ? 'No knight by that name yet. Tap New knight.' : 'That name will not do here. Try another.';
    if (code === 'full') return 'The world is full right now. Try again soon.';
    // an admin (or the parent page) gave the knight a new secret word: the world says why on the error (why: 'reset')
    if (code === 'auth' && err.why === 'reset') return 'An admin changed your secret word. Ask them for the new one, then log in again.';
    if (code === 'auth') return 'You were logged out. Log in again.';
    if (kind === 'login' && st === 401) return 'That secret word is wrong.';
    if (kind === 'login' && st === 404) return 'No knight by that name yet. Tap New knight.';
    if (kind === 'login' && st === 403) return 'This knight is not allowed in. Ask Ethan.';
    if (kind === 'signup' && (st === 403 || st === 401)) return 'That invite code is not right.';
    if (kind === 'signup' && st === 409) return 'That name is already taken. Pick another.';
    if (!st) return 'The world is asleep right now. Try again in a bit.';
    return 'Something went wrong. Try again.';
  };
  const statusWords = r => {
    const names = (r && Array.isArray(r.names)) ? r.names.filter(n => typeof n === 'string') : [];
    const n = (r && typeof r.online === 'number') ? r.online : names.length;
    if (!n) return 'Nobody online right now';
    const shown = names.slice(0, 8).join(', ') + (names.length > 8 ? ' and ' + (names.length - 8) + ' more' : '');
    return `${n} knight${n === 1 ? '' : 's'} online${shown ? ': ' + shown : ''}`;
  };

  // ---------- a slot string, summarised the way the title cards do it ----------
  const summarizeRaw = raw => {
    try {
      const d = JSON.parse(raw); const p = d.player || {}; const skills = p.skills || {};
      const lv = k => levelForXp((skills[k] && skills[k].xp) || 0);
      const level = Math.max(1, Math.floor((lv('melee') + lv('defence')) / 2 + lv('range') / 4));
      const stage = (d.quest && d.quest.stage) || 0;
      return { level, chapter: title.chapterFor(stage), region: p.region || 'Unknown', playSeconds: p.playSeconds || 0 };
    } catch (e) { return { level: 1, chapter: 1, region: 'Unknown', playSeconds: 0, broken: true }; }
  };
  LOGIN.summarizeRaw = summarizeRaw;

  // ---------- slot 1 is the online knight's slot ----------
  // A save that Play alone left in slot 1 is moved to an empty slot before the cloud knight takes the slot over,
  // so nothing a kid played is thrown away. The mark says slot 1 currently holds a cloud knight; 72-cloudsave
  // clears it when a local save lands there.
  const park = () => {
    const cur = lsGet(SLOT(1)); if (!cur || lsGet(MARK_KEY) != null) return false;
    for (let n = 2; n <= 3; n++) if (!lsGet(SLOT(n))) { lsSet(SLOT(n), cur); lsSet(AT(n), lsGet(AT(1)) || Date.now()); return true; }
    return false;
  };
  const claim = (raw, at) => { if (lsGet(SLOT(1)) !== raw) park(); lsSet(SLOT(1), raw); lsSet(AT(1), at || Date.now()); lsSet(MARK_KEY, '1'); if (window.CLOUD) window.CLOUD.known = raw; };
  const fresh = () => { park(); lsDel(SLOT(1)); lsDel(AT(1)); lsSet(MARK_KEY, '1'); if (window.CLOUD) window.CLOUD.known = null; };

  // ---------- the bridge: the knight saved on the old address ----------
  const bridge = {
    waiting: null, timer: null, frame: null, last: null,
    pick(slots) {
      let best = null;
      for (const k in (slots || {})) {
        const s = slots[k]; if (!s || typeof s.save !== 'string' || !s.save) continue;
        const at = +s.at || 0;
        if (!best || at > best.at) best = Object.assign({ slot: +k || k, save: s.save, at }, summarizeRaw(s.save));
      }
      return best;
    },
    onMessage(ev) {
      if (!ev || ev.origin !== BRIDGE_ORIGIN) return;
      const d = ev.data; if (!d || d.fanglands !== 'save') return;
      const c = bridge.pick(d.slots); bridge.last = c;
      const cb = bridge.waiting; if (cb) { bridge.done(); cb(c); }
    },
    done() {
      bridge.waiting = null;
      if (bridge.timer) { clearTimeout(bridge.timer); bridge.timer = null; }
      if (bridge.frame) { try { bridge.frame.remove(); } catch (e) { } bridge.frame = null; }
    },
    ask(cb) {
      const real = hasDom() && typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && location.origin !== BRIDGE_ORIGIN;
      if (!real) { cb(null); return; }
      bridge.done(); bridge.waiting = cb;
      const f = document.createElement('iframe');
      f.style.display = 'none'; f.setAttribute('aria-hidden', 'true'); f.setAttribute('title', 'Fanglands bridge');
      f.onload = () => { try { f.contentWindow.postMessage({ fanglands: 'give-save' }, BRIDGE_ORIGIN); } catch (e) { } };
      f.src = BRIDGE_URL; bridge.frame = f; document.body.appendChild(f);
      bridge.timer = setTimeout(() => { const w = bridge.waiting; bridge.done(); if (w) w(null); }, BRIDGE_WAIT);
    },
  };
  LOGIN.bridge = bridge;
  if (canListen) window.addEventListener('message', bridge.onMessage);

  // ---------- the flow ----------
  const oops = text => { LOGIN.busy = false; LOGIN.mode = 'form'; LOGIN.error = text; refresh(); return false; };
  LOGIN.submit = (name, pass, invite, isNew) => {
    name = String(name || '').trim(); pass = String(pass || ''); invite = String(invite || '').trim();
    if (LOGIN.busy) return false;
    if (!NAME_RE.test(name)) return oops("A knight's name is 2 to 16 letters or numbers.");
    if (pass.length < 4) return oops('The secret word needs at least 4 letters.');
    if (isNew && !invite) return oops('Type the invite code. Ask Ethan for it.');
    LOGIN.error = ''; LOGIN.busy = true; LOGIN.mode = 'busy'; refresh();
    const kind = isNew ? 'signup' : 'login';
    when(api('POST', '/api/' + kind, isNew ? { name, pass, invite } : { name, pass }),
      r => {
        LOGIN.busy = false;
        if (!r || typeof r.token !== 'string' || !r.token) return oops('The world gave a strange answer. Try again.');
        NET.setToken(r.token); LOGIN.name = (typeof r.name === 'string' && r.name) || name; lsSet(NAME_KEY, name); LOGIN.stats[kind]++;
        afterLogin();
      },
      e => { LOGIN.busy = false; LOGIN.mode = 'form'; LOGIN.error = LOGIN.sentence(e, kind); refresh(); });
    return true;
  };
  function afterLogin() {
    LOGIN.mode = 'busy'; LOGIN.error = ''; refresh();
    when(api('GET', '/api/save'),
      r => {
        if (r && typeof r.save === 'string' && r.save) { claim(r.save, +r.at || Date.now()); start(false, true); return; }
        bridge.ask(c => { if (c) { LOGIN.offer = c; LOGIN.mode = 'offer'; refresh(); } else { fresh(); start(true, false); } });
      },
      e => {
        if (e && (e.code === 'auth' || e.status === 401)) { NET.setToken(null); LOGIN.mode = 'form'; }
        else LOGIN.mode = NET.token ? 'me' : 'form';
        LOGIN.error = LOGIN.sentence(e, 'save'); refresh();
      });
  }
  LOGIN.bring = yes => {
    const c = LOGIN.offer; LOGIN.offer = null;
    if (yes && c) { claim(c.save, c.at || Date.now()); start(true, true); }
    else { fresh(); start(true, false); }
  };
  function start(push, had) {
    LOGIN.playing = true; LOGIN.alone = false; hide();
    title.startSlot(1);
    notify(had ? `Welcome back, ${LOGIN.name}.` : `Welcome to the world, ${LOGIN.name}.`);
    NET.connect();
    if (push && window.CLOUD) window.CLOUD.push(true);
  }
  const askStatus = () => when(api('GET', '/api/status'),
    r => { LOGIN.asleep = false; LOGIN.status = statusWords(r); refresh(); },
    () => { LOGIN.asleep = true; LOGIN.status = 'The world is asleep right now.'; refresh(); });
  const checkMe = () => when(api('GET', '/api/me'),
    r => { if (LOGIN.mode !== 'checking') return; LOGIN.name = (r && typeof r.name === 'string' && r.name) || LOGIN.name || lsGet(NAME_KEY) || 'knight'; LOGIN.mode = 'me'; refresh(); },
    e => {
      if (LOGIN.mode !== 'checking') return;
      if (e && (e.code === 'auth' || e.status === 401 || e.code === 'banned' || e.status === 403)) { NET.setToken(null); LOGIN.error = e.code === 'banned' ? LOGIN.sentence(e, 'login') : ''; }
      LOGIN.mode = 'form'; refresh();
    });
  LOGIN.show = () => {
    LOGIN.showing = true; LOGIN.alone = false; LOGIN.playing = false; LOGIN.error = ''; LOGIN.offer = null; LOGIN.busy = false; LOGIN.asleep = false;
    LOGIN.status = 'Looking for the world...'; LOGIN.mode = NET.token ? 'checking' : 'form';
    build(); if (ui) { if (!ui.name.value) ui.name.value = lsGet(NAME_KEY) || ''; place(); } refresh();
    askStatus(); if (NET.token) checkMe();
    if (ui && !touchMode()) { try { (ui.name.value ? ui.pass : ui.name).focus(); } catch (e) { } }
  };
  const hide = () => { LOGIN.showing = false; if (ui) { ui.root.hidden = true; try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) { } } };
  // the error line the card is showing right now: under the form, or under "Playing as <name>" (and "Looking for your knight...")
  LOGIN.shownError = () => (LOGIN.mode === 'form' || LOGIN.mode === 'me' || LOGIN.mode === 'checking') ? LOGIN.error : '';
  LOGIN.hide = hide;
  LOGIN.playAs = () => { if (LOGIN.mode !== 'me') return false; afterLogin(); return true; };
  LOGIN.notMe = () => { when(api('POST', '/api/logout'), noop, noop); NET.setToken(null); LOGIN.name = null; LOGIN.mode = 'form'; LOGIN.error = ''; refresh(); };
  LOGIN.playAlone = () => { LOGIN.alone = true; hide(); title.refresh(); };
  LOGIN.backOnline = () => { LOGIN.alone = false; LOGIN.show(); };
  LOGIN.logout = () => {
    if (!LOGIN.playing) return false;
    save();
    const finish = () => {
      when(api('POST', '/api/logout'), noop, noop);
      NET.disconnect(); NET.setToken(null); LOGIN.name = null; LOGIN.playing = false;
      title.open();
    };
    // the last push goes first, but a hung PUT must not hold the knight on the pause menu
    let done = false; const once = () => { if (done) return; done = true; finish(); };
    if (window.CLOUD) { when(window.CLOUD.flush(), once, once); setTimeout(once, 2000); } else once();
    return true;
  };
  // the world can end a session from its side (token dead, knight banned, an admin sent the knight out): back to the
  // title, in plain words. Kicked keeps the session: the card says "Playing as <name>" and Play goes straight back in,
  // and because the session still works, the last few seconds of play go up to the cloud first.
  NET.on('error', m => {
    if (!LOGIN.playing || !m || (m.code !== 'auth' && m.code !== 'banned' && m.code !== 'kicked')) return;
    const text = LOGIN.sentence(m, 'login');
    if (m.code === 'kicked' && window.CLOUD) { save(); window.CLOUD.flush(); }
    LOGIN.playing = false; NET.disconnect(); if (m.code === 'banned') NET.setToken(null);
    title.open(); LOGIN.error = text; refresh();
  });
  // Put my knight back (76-admin): the world hands back the pinned backup as a slot string. It goes into slot 1 exactly the way
  // a login's cloud save does (a Play alone save there is parked first, the mark is set, the cloud knows it) and the game
  // starts on it. The socket is left alone: the knight never left the world. Any push of the knight being replaced is
  // dropped first, so it can never land on top of the one coming back.
  LOGIN.reload = (raw, at) => {
    if (typeof raw !== 'string' || !raw) return false;
    try { JSON.parse(raw); } catch (e) { return false; }
    if (window.CLOUD) window.CLOUD.reset();
    claim(raw, +at || Date.now());
    title.startSlot(1);
    return true;
  };

  // ---------- the title screen, wrapped ----------
  const _open = title.open;
  title.open = () => {
    const wasPlaying = LOGIN.playing;
    _open();
    if (!NET.enabled) return;
    if (wasPlaying && window.CLOUD) window.CLOUD.flush();
    LOGIN.playing = false;
    if (!LOGIN.alone) LOGIN.show();
  };
  const _tick = title.tick;
  title.tick = dt => {
    if (!LOGIN.showing) return _tick(dt);
    title.t += dt; time += dt;
    pressed.clear(); keys.clear(); touch.taps.length = 0;
  };

  // ---------- the HTML card (real inputs: the iPad keyboard needs them; 16 px so Safari does not zoom) ----------
  let ui = null;
  const CSS = `
#fl-login{position:fixed;inset:0;z-index:10;display:flex;justify-content:center;align-items:flex-start;pointer-events:none;font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif;color:#e6edf3}
#fl-login[hidden]{display:none}
#fl-login .fl-card{pointer-events:auto;box-sizing:border-box;width:min(440px,calc(100vw - 28px));overflow-y:auto;-webkit-overflow-scrolling:touch;background:#161b22;border:1px solid #f5c542;border-radius:10px;padding:16px 18px 14px;box-shadow:0 10px 40px rgba(0,0,0,.55)}
#fl-login h2{margin:0 0 6px;font:700 18px "Cinzel","Trajan Pro",Georgia,serif;color:#f5c542}
#fl-login label{display:block;font:bold 12px sans-serif;color:#c9d1d9;margin:10px 0 4px}
#fl-login input[type=text],#fl-login input[type=password]{box-sizing:border-box;width:100%;font-size:16px;line-height:20px;padding:10px 12px;color:#e6edf3;background:#0b0f14;border:1px solid #30363d;border-radius:8px;outline:none;-webkit-appearance:none;appearance:none}
#fl-login input:focus{border-color:#f5c542}
#fl-login .fl-row{display:flex;gap:8px;margin-top:12px}
#fl-login button{flex:1;font:bold 15px sans-serif;color:#fff;background:#238636;border:0;border-radius:8px;padding:11px 12px;cursor:pointer;-webkit-appearance:none;appearance:none}
#fl-login button.fl-dim{background:#21262d;color:#e6edf3}
#fl-login button:disabled{background:#2a2f3a;color:#6e7681}
#fl-login .fl-check{display:flex;align-items:center;gap:8px;margin-top:12px;font:bold 13px sans-serif;color:#e6edf3;cursor:pointer}
#fl-login .fl-check input{width:20px;height:20px;margin:0;accent-color:#f5c542}
#fl-login .fl-hint{font:12px sans-serif;color:#8b949e;margin-top:4px}
#fl-login .fl-err{font:bold 13px sans-serif;color:#f85149;min-height:16px;margin-top:10px}
#fl-login .fl-err:empty{margin-top:0;min-height:0}
#fl-login .fl-line{font:15px sans-serif;margin:6px 0 4px}
#fl-login .fl-status{font:12px sans-serif;color:#8b949e;margin-top:12px;padding-top:10px;border-top:1px solid #30363d;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#fl-login .fl-status button{flex:0 0 auto;padding:7px 12px;font-size:13px}
#fl-login [hidden]{display:none!important}`;
  function build() {
    if (ui || !hasDom()) return;
    const el = (tag, attrs, ...kids) => {
      const e = document.createElement(tag);
      for (const k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'cls') e.className = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); }
      for (const c of kids) if (c) e.appendChild(c);
      return e;
    };
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const u = {};
    u.name = el('input', { type: 'text', id: 'fl-name', autocomplete: 'username', autocapitalize: 'words', autocorrect: 'off', spellcheck: 'false', maxlength: '16', enterkeyhint: 'next' });
    u.pass = el('input', { type: 'password', id: 'fl-pass', autocomplete: 'current-password', enterkeyhint: 'go' });
    u.invite = el('input', { type: 'text', id: 'fl-invite', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'go' });
    u.newBox = el('input', { type: 'checkbox', id: 'fl-new', onchange: () => { LOGIN.newKnight = u.newBox.checked; refresh(); if (LOGIN.newKnight) { try { u.invite.focus(); } catch (e) { } } } });
    u.submit = el('button', { type: 'submit', text: 'Play' });
    u.err = el('div', { cls: 'fl-err' });
    u.inviteBox = el('div', {}, el('label', { for: 'fl-invite', text: 'Invite code' }), u.invite, el('div', { cls: 'fl-hint', text: 'Ask Ethan for the invite code' }));
    u.form = el('form', { onsubmit: e => { e.preventDefault(); LOGIN.submit(u.name.value, u.pass.value, u.invite.value, u.newBox.checked); } },
      el('label', { for: 'fl-name', text: "Knight's name" }), u.name,
      el('label', { for: 'fl-pass', text: 'Secret word' }), u.pass,
      el('label', { cls: 'fl-check', for: 'fl-new' }, u.newBox, el('span', { text: 'New knight' })),
      u.inviteBox, u.err, el('div', { cls: 'fl-row' }, u.submit));
    u.whoName = el('b', {});
    u.who = el('div', {}, el('div', { cls: 'fl-line' }, el('span', { text: 'Playing as ' }), u.whoName),
      el('div', { cls: 'fl-row' }, el('button', { type: 'button', text: 'Play', onclick: LOGIN.playAs }), el('button', { type: 'button', cls: 'fl-dim', text: 'Not me', onclick: LOGIN.notMe })));
    u.offerText = el('div', { cls: 'fl-line' });
    u.offer = el('div', {}, u.offerText, el('div', { cls: 'fl-row' }, el('button', { type: 'button', text: 'Yes, bring my knight', onclick: () => LOGIN.bring(true) }), el('button', { type: 'button', cls: 'fl-dim', text: 'No, start fresh', onclick: () => LOGIN.bring(false) })));
    u.busy = el('div', { cls: 'fl-line', text: 'One moment...' });
    u.busyErr = el('div', { cls: 'fl-err' });
    u.statusText = el('span', {});
    u.alone = el('button', { type: 'button', cls: 'fl-dim', text: 'Play alone', onclick: LOGIN.playAlone });
    u.status = el('div', { cls: 'fl-status' }, u.statusText, u.alone);
    u.card = el('div', { cls: 'fl-card' }, el('h2', { text: 'Play online at gorkscape.ca' }), u.form, u.who, u.offer, u.busy, u.busyErr, u.status);
    u.root = el('div', { id: 'fl-login' }, u.card);
    document.body.appendChild(u.root);
    ui = u;
    if (canListen) window.addEventListener('resize', place);
  }
  // the card sits where the slot cards would, under the FANGLANDS heading the canvas draws
  function place() {
    if (!ui) return;
    const short = VH < 520, ty = short ? 44 : Math.round(VH * 0.19);
    const top = Math.round(Math.max(ty + 56, Math.min(VH * 0.34, VH - 380)));
    ui.card.style.marginTop = top + 'px'; ui.card.style.maxHeight = Math.max(160, VH - top - 10) + 'px';
  }
  function refresh() {
    if (!ui) return;
    ui.root.hidden = !LOGIN.showing;
    const m = LOGIN.mode;
    ui.form.hidden = m !== 'form'; ui.who.hidden = m !== 'me'; ui.offer.hidden = m !== 'offer'; ui.busy.hidden = m !== 'busy' && m !== 'checking';
    ui.busy.textContent = m === 'checking' ? 'Looking for your knight...' : 'One moment...';
    ui.inviteBox.hidden = !LOGIN.newKnight; ui.newBox.checked = LOGIN.newKnight;
    ui.submit.textContent = LOGIN.newKnight ? 'Make my knight' : 'Play'; ui.submit.disabled = LOGIN.busy;
    ui.pass.setAttribute('autocomplete', LOGIN.newKnight ? 'new-password' : 'current-password');
    ui.err.textContent = m === 'form' ? LOGIN.shownError() : ''; ui.busyErr.textContent = m === 'me' || m === 'checking' ? LOGIN.shownError() : '';
    ui.whoName.textContent = LOGIN.name || '';
    const o = LOGIN.offer;
    ui.offerText.textContent = o ? `Bring your knight from the old address? Level ${o.level} · Chapter ${o.chapter}: ${CHAPTERS[o.chapter - 1] || ''}` : '';
    ui.statusText.textContent = LOGIN.status; ui.alone.hidden = !LOGIN.asleep;
  }
  // while a knight is typing, the game's key listeners must not hear it (they sit on window, bubble phase; this
  // capturing listener runs first and stops the event there — the input still gets its default action). Escape blurs.
  if (canListen) {
    const typing = () => { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
    for (const type of ['keydown', 'keyup', 'keypress']) window.addEventListener(type, e => {
      if (!typing()) return;
      if (type === 'keydown' && e.key === 'Escape') { try { document.activeElement.blur(); } catch (err) { } }
      e.stopImmediatePropagation(); keys.clear();
    }, true);
  }

  // ---------- the canvas behind the card: backdrop, heading, sprites, sound button ----------
  const KNIGHT = { tunic: '#3b6fb6', hair: '#5a3a1e', helm: '#8f96a3', shoulder: '#9aa3b2', shield: '#8a6a3a', weapon: ITEMS.iron_sword || ITEMS.wooden_sword };
  function drawOnlineTitle(g) {
    const narrow = VW < 640, short = VH < 520;
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, 'rgba(6,8,14,0.88)'); grad.addColorStop(0.45, 'rgba(6,8,14,0.66)'); grad.addColorStop(1, 'rgba(6,8,14,0.92)');
    g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
    const ty = short ? 44 : Math.round(VH * 0.19);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.font = `800 ${narrow ? 44 : short ? 48 : 72}px ${DISPLAY}`; g.strokeText('FANGLANDS', VW / 2, ty); g.fillStyle = '#f5c542'; g.fillText('FANGLANDS', VW / 2, ty);
    g.font = `600 ${narrow ? 14 : 18}px ${DISPLAY}`; g.lineWidth = 4; g.strokeText('A game by Cohen', VW / 2, ty + (narrow ? 24 : 30)); g.fillStyle = '#c9a36a'; g.fillText('A game by Cohen', VW / 2, ty + (narrow ? 24 : 30));
    if (!narrow) {
      const cw = Math.min(440, VW - 28), margin = Math.round(VW / 2 - cw / 2), midY = Math.round(VH * 0.55);
      const bob = Math.sin(title.t * 1.6) * 4, bob2 = Math.sin(title.t * 1.6 + 1.3) * 4;
      const ks = clamp(margin / 48, 1.6, 4), ws = clamp(margin / 78, 1.3, 3.4);
      g.save(); g.translate(margin / 2, midY); g.scale(ks, ks); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 12, 12, 5, 0, 0, 7); g.fill(); g.translate(0, bob / ks); drawHuman(g, { facing: { x: 1, y: 0 }, hurtT: 0, attackT: 0 }, KNIGHT); g.restore();
      g.save(); g.translate(VW - margin / 2, midY); g.scale(ws, ws); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 22, 26, 9, 0, 0, 7); g.fill(); g.translate(0, bob2 / ws); drawMech(g, { facing: { x: -1, y: 0 }, moving: true, walkT: title.t * 2.2, attackT: 0, hurtT: 0 }, false, null); g.restore();
    }
    if (!ui) {
      // no HTML to hold the card (should never happen in a browser): say so on the canvas rather than show nothing
      g.textAlign = 'center'; g.fillStyle = '#e6edf3'; g.font = `700 18px ${DISPLAY}`; g.fillText('Play online at gorkscape.ca', VW / 2, ty + 90);
      g.font = '13px sans-serif'; g.fillStyle = '#8b949e'; g.fillText(LOGIN.status || '', VW / 2, ty + 114);
    }
    button(g, VW - 124, VH - 42, 110, 30, audioMuted ? 'Sound: off' : 'Sound: on', toggleMute, '#21262d');
    g.textAlign = 'left'; g.fillStyle = 'rgba(230,237,243,0.55)'; g.font = '11px sans-serif'; g.fillText('Your knight is saved in the cloud at gorkscape.ca.', 14, VH - 22);
  }
  const _drawHud = drawHud;
  drawHud = function (g) {
    if (!title.active || !LOGIN.showing) {
      _drawHud(g);
      if (title.active && NET.enabled && LOGIN.alone) button(g, 14, VH - 76, 120, 30, 'Play online', LOGIN.backOnline, '#21262d');
      return;
    }
    buttons.length = 0; minimapRect = null;
    g.textBaseline = 'alphabetic';
    drawOnlineTitle(g);
  };

  // ---------- Log out in the pause menu ----------
  // The pause menu is a fixed 310 px box with one hook row; a second row would land on the stats line. So the
  // Title screen row from 14-title is split in two while a knight is online: Title screen on the left, Log out on the right.
  { const first = HOOKS.pauseMenu[0];
    if (first) HOOKS.pauseMenu[0] = (g, x, y, w, h) => {
      if (!NET.enabled || !LOGIN.playing) return first(g, x, y, w, h);
      const half = Math.floor(w / 2) - 4;
      first(g, x, y, half, h);
      button(g, x + half + 8, y, w - half - 8, h, 'Log out', LOGIN.logout, '#3a4150');
    }; }

  // ---------- self-test ----------
  const P = 'login: ';
  HOOKS.selfTest.push((check, F, h) => {
    if (!title.active) save();
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, status: NET.status, slot: title.slot, titleActive: title.active, showing: LOGIN.showing, playing: LOGIN.playing, alone: LOGIN.alone, name: LOGIN.name,
      slots: [1, 2, 3].map(n => [lsGet(SLOT(n)), lsGet(AT(n))]), cur: lsGet('fanglands.slot.current'), mark: lsGet(MARK_KEY), lastName: lsGet(NAME_KEY), paused, notice };
    // a small world that answers on the spot: one knight (Cohen / sword) with a cloud save, invite code 'dragon'
    const base = JSON.parse(lsGet(SLOT(title.slot)) || lsGet(SAVE_KEY) || '{"player":{},"quest":{}}'); base.player = base.player || {}; base.player.kills = 42; const cloud = JSON.stringify(base);
    const world = {
      accounts: { cohen: 'sword' }, names: { cohen: 'Cohen' }, saves: { cohen: cloud }, invite: 'dragon', puts: [], calls: [], statusFails: false,
      call(method, path, body, token) {
        world.calls.push(method + ' ' + path);
        const fail = (code, status) => { const e = new Error(code); e.code = code; e.status = status; throw e; };
        const key = token && token.startsWith('tok-') ? token.slice(4) : null;
        if (path === '/api/status') { if (world.statusFails) throw new Error('no answer'); return { ok: true, online: 2, names: ['Cohen', 'Sam'] }; }
        if (path === '/api/login') { const k = String(body.name).toLowerCase(); if (!(k in world.accounts)) fail('unknown', 404); if (world.accounts[k] !== body.pass) fail('pass', 401); return { token: 'tok-' + k, name: world.names[k] }; }
        if (path === '/api/signup') { const k = String(body.name).toLowerCase(); if (body.invite !== world.invite) fail('invite', 403); if (k in world.accounts) fail('taken', 409); world.accounts[k] = body.pass; world.names[k] = body.name; return { token: 'tok-' + k, name: body.name }; }
        if (!key) fail('auth', 401);
        if (path === '/api/me') return { name: world.names[key], created: 1, saveAt: 1, online: false };
        if (path === '/api/save' && method === 'GET') return { save: world.saves[key] || null, at: 5 };
        if (path === '/api/save' && method === 'PUT') { world.puts.push([key, body]); world.saves[key] = body; return { at: 6 }; }
        if (path === '/api/logout') return { ok: true };
        fail('bad', 400);
      },
      open: () => { const s = { readyState: 1, send(str) { const m = JSON.parse(str); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: LOGIN.name, at: 1, keeper: LOGIN.name }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; return s; },
    };
    try {
      NET.enabled = true; NET.useFake(world); NET.setToken(null); LOGIN.alone = false; LOGIN.playing = false; if (window.CLOUD) window.CLOUD.reset();
      title.open();
      check(P + 'on the online address the title puts up the card and asks the world who is on', LOGIN.showing && title.active && LOGIN.mode === 'form' && LOGIN.status === '2 knights online: Cohen, Sam' && !LOGIN.asleep, { status: LOGIN.status, mode: LOGIN.mode });
      render();
      check(P + 'while the card is up the canvas keeps only the sound button and Enter does not start a slot', !buttons.some(b => b.label === 'Slot 1') && buttons.some(b => /^Sound/.test(b.label)) && (pressed.add('Enter'), title.tick(1 / 60), title.active && pressed.size === 0), { labels: buttons.map(b => b.label) });
      LOGIN.submit('Cohen', 'shield', '', false);
      check(P + 'a wrong secret word says so', LOGIN.error === 'That secret word is wrong.' && !NET.token && !LOGIN.playing && LOGIN.mode === 'form', { error: LOGIN.error });
      LOGIN.submit('Nobody', 'sword', '', false);
      check(P + 'a name the world does not know points at New knight', LOGIN.error === 'No knight by that name yet. Tap New knight.', { error: LOGIN.error });
      const calls0 = world.calls.length; LOGIN.submit('C', 'sword', '', false); const shortName = LOGIN.error; LOGIN.submit('Cohen', 'abc', '', false); const shortPass = LOGIN.error;
      check(P + 'a name or secret word that is too short is caught before the world is asked', /2 to 16/.test(shortName) && /at least 4/.test(shortPass) && world.calls.length === calls0, { shortName, shortPass });
      const wrongs = ['wait', 'banned', 'invite', 'pass', 'unknown'].map(code => LOGIN.sentence({ code }, 'login'));
      check(P + 'the contract codes read as plain sentences', wrongs.join('|') === 'Too many tries. Wait a minute.|This knight is not allowed in. Ask Ethan.|That invite code is not right.|That secret word is wrong.|No knight by that name yet. Tap New knight.', { wrongs });
      LOGIN.submit('Cohen', 'sword', '', false);
      check(P + 'the right secret word logs in: token kept, the cloud save lands in slot 1 and is the game now, the socket opens', NET.token === 'tok-cohen' && lsGet(SLOT(1)) === cloud && player.kills === 42 && title.slot === 1 && LOGIN.playing && !LOGIN.showing && !title.active && NET.status === 'on' && NET.me === 'Cohen' && lsGet(NAME_KEY) === 'Cohen' && lsGet(MARK_KEY) === '1', { token: NET.token, kills: player.kills, status: NET.status, me: NET.me, showing: LOGIN.showing });
      paused = true; render(); const menu = buttons.some(b => b.label === 'Log out') && buttons.some(b => b.label.startsWith('Title screen')); paused = false;
      const out = LOGIN.logout();
      check(P + 'Log out sits beside Title screen in the pause menu; it drops the token, closes the socket and shows the card again', menu && out && !NET.token && NET.sock === null && NET.status === 'off' && LOGIN.showing && title.active && !LOGIN.playing && LOGIN.mode === 'form' && world.calls.includes('POST /api/logout'), { menu, token: NET.token, mode: LOGIN.mode });
      LOGIN.submit('Sam', 'castle', 'wrong', true);
      check(P + 'a wrong invite code says so', LOGIN.error === 'That invite code is not right.' && !NET.token, { error: LOGIN.error });
      LOGIN.submit('Sam', 'castle', 'dragon', true);
      const samRaw = lsGet(SLOT(1));
      check(P + 'a new knight with no cloud save starts a new game (no browser, so the bridge is skipped) and is pushed to the cloud at once', NET.token === 'tok-sam' && LOGIN.playing && player.kills === 0 && quest.stage === 0 && !!samRaw && samRaw !== cloud && world.saves.sam === samRaw && !title.active && NET.me === 'Sam', { kills: player.kills, stage: quest.stage, puts: world.puts.length });
      player.kills = 7; title.toTitle();
      check(P + 'back on the title with a session in the browser: the card says who is playing and offers Play / Not me', LOGIN.showing && LOGIN.mode === 'me' && LOGIN.name === 'Sam' && !LOGIN.playing && world.saves.sam !== samRaw && JSON.parse(world.saves.sam).player.kills === 7, { mode: LOGIN.mode, name: LOGIN.name });
      const played = LOGIN.playAs();
      check(P + 'Play on that card loads the cloud knight without asking for the secret word again', played && LOGIN.playing && !title.active && player.kills === 7 && lsGet(SLOT(1)) === world.saves.sam, { kills: player.kills });
      title.toTitle(); LOGIN.notMe();
      check(P + 'Not me forgets the session and shows the form', !NET.token && LOGIN.mode === 'form' && LOGIN.showing && world.calls.filter(c => c === 'POST /api/logout').length === 2, { mode: LOGIN.mode });
      world.statusFails = true; LOGIN.show();
      check(P + 'when the world does not answer, the card says it is asleep and offers Play alone', LOGIN.asleep && LOGIN.status === 'The world is asleep right now.', { status: LOGIN.status });
      LOGIN.playAlone(); render();
      check(P + 'Play alone falls back to the three local slots, with a way back online', !LOGIN.showing && LOGIN.alone && title.active && buttons.some(b => b.label === 'Slot 1') && buttons.some(b => b.label === 'Play online'), { labels: buttons.map(b => b.label) });
      world.statusFails = false; LOGIN.backOnline(); const back = LOGIN.showing && !LOGIN.alone;
      // the bridge: only the old address is believed, and the newest slot wins
      const older = { save: cloud, at: 100 }, newerSave = JSON.parse(cloud); newerSave.player.kills = 3; const newer = { save: JSON.stringify(newerSave), at: 200 };
      let got = 'none'; bridge.waiting = c => { got = c; };
      bridge.onMessage({ origin: 'https://evil.example', data: { fanglands: 'save', slots: { 1: newer } } }); const ignored = got === 'none' && bridge.waiting !== null;
      bridge.onMessage({ origin: BRIDGE_ORIGIN, data: { fanglands: 'save', slots: { 1: older, 2: null, 3: newer } } });
      check(P + 'the bridge answer is believed only from the old address and the newest slot wins, summarised for the offer', back && ignored && got && got.slot === 3 && got.at === 200 && got.save === newer.save && got.level >= 1 && got.chapter >= 1 && bridge.waiting === null, { ignored, slot: got && got.slot, at: got && got.at, level: got && got.level });
      // a Play alone save in slot 1 is parked in an empty slot before a cloud knight takes slot 1
      lsDel(MARK_KEY); lsSet(SLOT(1), '{"player":{"kills":1},"quest":{}}'); lsSet(AT(1), '77'); lsDel(SLOT(2)); lsDel(AT(2));
      claim(cloud, 9);
      check(P + 'a knight played alone in slot 1 is moved to an empty slot, never thrown away, when the cloud knight takes slot 1', lsGet(SLOT(2)) === '{"player":{"kills":1},"quest":{}}' && lsGet(AT(2)) === '77' && lsGet(SLOT(1)) === cloud && lsGet(MARK_KEY) === '1', { slot2: lsGet(SLOT(2)) });
      // kicked by an admin: back to the title with the session kept, the sentence on the card, the last seconds pushed, and Play goes straight back in
      { LOGIN.submit('Cohen', 'sword', '', false);
        const inGame = LOGIN.playing && NET.status === 'on'; const puts0 = world.puts.length; player.kills = 5;
        NET.sock.onmessage({ data: JSON.stringify({ t: 'error', code: 'kicked', text: 'an admin sent you out' }) });
        const said = LOGIN.sentence({ code: 'kicked' }, 'login');
        const back = title.active && LOGIN.showing && !LOGIN.playing && NET.token === 'tok-cohen' && NET.sock === null && NET.timer === null && LOGIN.mode === 'me' && LOGIN.shownError() === said;
        const pushed = world.puts.length === puts0 + 1 && JSON.parse(world.puts[puts0][1]).player.kills === 5;
        const again = LOGIN.playAs() && LOGIN.playing && NET.status === 'on' && player.kills === 5;
        check(P + 'kicked: the title card comes back with the sentence under "Playing as", the session is kept, the last seconds were pushed first, and Play goes straight back in', said === 'An admin sent you out of the world. You can come back in.' && inGame && back && pushed && again, { said, inGame, back, mode: LOGIN.mode, shown: LOGIN.shownError(), pushed, puts: world.puts.length - puts0, again }); }
      // Put my knight back (76-admin) ends here: a cloud save string becomes slot 1 and the game, any pending push of the old knight is dropped, the socket is untouched
      { const sock = NET.sock; const d = JSON.parse(cloud); d.player.kills = 77; const raw = JSON.stringify(d);
        if (window.CLOUD) window.CLOUD.pending = '{"stale":true}';
        const ok = LOGIN.reload(raw, 1234);
        const clean = !window.CLOUD || (window.CLOUD.known === raw && window.CLOUD.pending === null);
        check(P + 'LOGIN.reload puts a cloud save into slot 1 the way a login does and starts it, drops any pending push, leaves the socket alone, and refuses a broken string', ok && lsGet(SLOT(1)) === raw && lsGet(AT(1)) === '1234' && lsGet(MARK_KEY) === '1' && player.kills === 77 && title.slot === 1 && !title.active && NET.sock === sock && NET.status === 'on' && clean && LOGIN.reload('not json', 1) === false, { ok, kills: player.kills, slot: title.slot, same: NET.sock === sock, status: NET.status, clean }); }
    } finally {
      hide(); bridge.done(); NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.setToken(was.token); NET.status = 'off'; NET.me = null;
      LOGIN.playing = was.playing; LOGIN.alone = was.alone; LOGIN.name = was.name; LOGIN.error = ''; LOGIN.offer = null; LOGIN.busy = false; LOGIN.mode = 'form';
      for (let n = 1; n <= 3; n++) { const [s, a] = was.slots[n - 1]; if (s == null) { lsDel(SLOT(n)); lsDel(AT(n)); } else { lsSet(SLOT(n), s); lsSet(AT(n), a || Date.now()); } }
      if (was.cur == null) lsDel('fanglands.slot.current'); else lsSet('fanglands.slot.current', was.cur);
      if (was.mark == null) lsDel(MARK_KEY); else lsSet(MARK_KEY, was.mark);
      if (was.lastName == null) lsDel(NAME_KEY); else lsSet(NAME_KEY, was.lastName);
      if (window.CLOUD) window.CLOUD.reset();
      if (was.titleActive) { title.open(); if (was.showing) LOGIN.show(); } else title.startSlot(was.slot);
      paused = was.paused; notice = was.notice;
      if (was.status === 'on' && NET.token) NET.connect();
    }
  });
}
