// ============================================================================
// ACCOUNTS — every knight the world knows, in the Admin panel, logged in or not
// Owner (2026-09-25): "can you add to the admin consol to see all the active accounts even if they are looged out with
// the ability to reset their passwords and see how much time they have logged playing and when they have logged in"
// docs/ONLINE.md, "Accounts", is the contract. The world answers GET /api/accounts only for a session whose knight is an
// admin in its database, and checks the same on every POST /api/accounts/reset: this tab hiding itself from a player is
// a convenience, never the lock.
//
// What is here, all inside 76-admin's panel as one more tab (ADMIN.addTab, after Knights), so the HUD work on 76 and this
// file never touch the same lines:
//   A. the list: every account, the ones on line first (a green dot and where they are), then the rest by when they
//      were last on; each row says when they were last on, their time on line, their knight's play time and when the
//      knight was made. It scrolls by drag, by the mouse wheel and by the Up / Down buttons. Refresh, and every 30 s by
//      itself while the tab is open.
//   B. a knight's page (a still tap on a row): the last 10 logins with how long each lasted, mute and ban (76's own
//      calls, the same messages the Knights tab sends), and Reset secret word
//   C. Reset secret word: a real text box over the canvas (guarded the way 71-login and 74-chat guard theirs, so no key
//      reaches the game), a confirm step drawn in the panel (no confirm()), and the world's answer in plain words
// Wraps by reassignment, with explicit arguments: pointerDown / pointerMove / pointerUp (a drag scrolls, a still tap
// opens a row) and drawPanels (the text box shows only while its view is up). window.ACCOUNTS is the register.
// ============================================================================
{
  const GOLD = '#f5c542', GREEN = '#3fb950', RED = '#f85149', ORANGE = '#ffb86b', DIM = '#8b949e', INK = '#e6edf3';
  const REFRESH_EVERY = 30000;         // ms between automatic refreshes while the tab is open
  const DRAG_SLOP = 8;                 // px a finger may wander and still be a tap
  const ALWAYS = 8640000000000000;     // muted "until an admin unmutes" (online/src/store.js)
  const WORD_MIN = 4, WORD_MAX = 40;   // the world takes 4 to 200; nobody types 40 on an iPad for a ten-year-old
  const SPANS = [['5m', '5 minutes'], ['1h', '1 hour'], ['1d', '1 day'], ['always', 'Until I unmute']];

  const S = {
    list: null,           // the world's answer, cleaned: [{name, role, online, map, region, lastOn, ...}]
    at: 0,                // nowMs() when it arrived: open logins and time on line keep counting from here
    loading: false, error: null, askedAt: -1e9, asks: 0,
    view: null,           // null = the list | { kind: 'acct', n } | { kind: 'mute', n } | { kind: 'reset', n, step, text }
    scroll: { list: 0, acct: 0 }, areas: {},
    drag: null,           // { key, id, x0, y0, s0, moved } while a finger or the mouse is down on a scroll area
    down: null, mouse: null,
    word: '',             // the new secret word being typed (never kept once the view closes)
  };
  const isAdmin = () => !!(window.ADMIN && ADMIN.is());
  const tabOpen = () => isAdmin() && panel === 'admin' && ADMIN.state.tab === 'accounts';
  const me = () => String(NET.me || '').toLowerCase();

  // ---------- calls to /api, the way 76-admin makes them: a fake may answer on the spot ----------
  const api = (method, path, body) => {
    try { return NET.fake ? NET.fake.call(method, path, body, NET.token) : NET.call(method, path, body); }
    catch (e) { return { __threw: e || new Error('failed') }; }
  };
  const when = (v, ok, bad) => {
    if (v && typeof v.then === 'function') { v.then(ok, bad).catch(e => console.error('accounts', e)); return; }
    if (v && v.__threw) bad(v.__threw); else ok(v);
  };

  // ---------- plain words: real dates in local time, exact lengths ----------
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // "Fri 25 Sep" (with the year when it is not this one)
  const dayWords = ms => { const d = new Date(ms); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}` + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); };
  // "7:42 pm"
  const clockWords = ms => { const d = new Date(ms), h = d.getHours(); return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
  // "Fri 25 Sep, 7:42 pm"
  const whenWords = ms => dayWords(ms) + ', ' + clockWords(ms);
  // "3h 12m", "12m", "under a minute"
  const spanWords = ms => { const s = Math.floor(Math.max(0, ms) / 1000); if (s < 60) return 'under a minute'; const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}h ${m}m` : `${m}m`; };
  const fit = (g, text, maxW) => { let s = String(text); if (maxW <= 0) return ''; if (g.measureText(s).width <= maxW) return s; while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s + '…'; };
  const whereOf = a => (!a.map || a.map === 'over') ? (a.region || 'the Fanglands') : (((window.INSTANCES && INSTANCES.get && INSTANCES.get(a.map)) || {}).name || a.region || String(a.map));
  const onlineMsOf = a => a.onlineMs + (a.online ? Math.max(0, nowMs() - S.at) : 0);
  const loginMsOf = l => l.ms + (l.open ? Math.max(0, nowMs() - S.at) : 0);
  const playWords = a => a.playSeconds != null ? spanWords(a.playSeconds * 1000) : a.saveAt ? 'unknown' : 'no save yet';
  const timeOnLine = a => `Time online: ${a.onlineMs > 0 || a.online ? spanWords(onlineMsOf(a)) : 'none yet'} (since ${dayWords(a.countedSince)})`;
  const muteWords = a => { const left = a.mutedUntil - Date.now(); if (!(left > 0)) return null; return a.mutedUntil >= ALWAYS ? 'Muted until an admin turns chat back on' : `Muted for ${ADMIN.amount(left / 1000)} more`; };

  // ---------- the world's list, cleaned (a field of the wrong kind is dropped, never drawn) ----------
  const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
  function clean(a) {
    if (!a || typeof a.name !== 'string' || !a.name) return null;
    const logins = (Array.isArray(a.logins) ? a.logins : []).filter(l => l && num(l.at) !== null && num(l.ms) !== null).slice(0, 10).map(l => ({ at: l.at, ms: Math.max(0, l.ms), open: !!l.open }));
    return {
      name: a.name.slice(0, 40), role: a.role === 'admin' ? 'admin' : 'player', online: !!a.online, map: typeof a.map === 'string' ? a.map : null,
      region: typeof a.region === 'string' ? a.region : null, created: num(a.created) || 0, lastOn: num(a.lastOn) || num(a.lastSeen) || 0,
      lastLogin: num(a.lastLogin), onlineMs: Math.max(0, num(a.onlineMs) || 0), countedSince: num(a.countedSince) || num(a.created) || 0,
      playSeconds: num(a.playSeconds), saveAt: num(a.saveAt), banned: !!a.banned, mutedUntil: num(a.mutedUntil) || 0, logins,
    };
  }
  // the ones on line first (by name), then everyone else, the most recently on first
  const byName = (a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0;
  const order = list => list.slice().sort((a, b) => (a.online !== b.online) ? (a.online ? -1 : 1) : a.online ? byName(a, b) : (b.lastOn - a.lastOn) || byName(a, b));
  const find = n => (S.list || []).find(a => a.name.toLowerCase() === String(n).toLowerCase()) || null;

  // force: ask again even while an answer is still on its way (the newest answer wins; a call that never answers stops
  // blocking after 20 s)
  function refresh(force) {
    if (!isAdmin() || (S.loading && !force && nowMs() - S.askedAt < 20000)) return false;
    S.loading = true; S.askedAt = nowMs();
    const seq = ++S.asks;
    when(api('GET', '/api/accounts'), r => {
      if (seq !== S.asks) return;
      S.loading = false;
      if (!Array.isArray(r)) { S.error = 'bad'; return; }
      S.list = order(r.map(clean).filter(Boolean)); S.at = nowMs(); S.error = null;
    }, e => { if (seq !== S.asks) return; S.loading = false; S.error = (e && e.code) || (e && e.status ? 'http' : 'down'); });
    return true;
  }
  const errorWords = code => code === 'admin' ? 'Only an admin can see this.' : code === 'auth' ? 'You are logged out. Log in again.' : 'Could not get the list. Tap Refresh to try again.';

  // ---------- B. moderation from a knight's page: 76's own calls, so the world hears exactly what Knights sends ----------
  // the world's answer (76 says it in words); a change that worked shows in the list at once
  NET.on('mod', m => { if (m && m.ok && tabOpen()) refresh(true); });

  // ---------- C. Reset secret word ----------
  const RESET_WORDS = {
    isadmin: "You can't change another admin's secret word.", self: 'Change your own secret word on the parent page.',
    unknown: 'No knight by that name.', pass: 'The secret word needs at least 4 letters.', admin: 'Only an admin can do that.',
    wait: 'That is a lot of changes at once. Wait a minute, then try again.', auth: 'You are logged out. Log in again.',
  };
  const cleanWord = w => String(w || '').replace(/\s+/g, ' ').trim().slice(0, WORD_MAX);
  function setWord(text) { S.word = String(text == null ? '' : text).slice(0, WORD_MAX); if (box && box.input.value !== S.word) box.input.value = S.word; }
  function startReset(n) { const a = find(n); if (!a || a.role === 'admin' || a.name.toLowerCase() === me()) return false; setWord(''); S.view = { kind: 'reset', n: a.name, step: 'type', text: '' }; return true; }
  // Next: a word long enough goes to the confirm step; nothing is sent yet
  function resetNext() {
    const v = S.view; if (!v || v.kind !== 'reset' || v.step !== 'type') return false;
    const w = cleanWord(S.word);
    if (w.length < WORD_MIN) { v.text = 'That is too short. Use at least 4 letters.'; return false; }
    v.word = w; v.step = 'confirm'; v.text = ''; blurBox(); return true;
  }
  // Yes: the one call; the answer in plain words
  function resetSend() {
    const v = S.view; if (!v || v.kind !== 'reset' || v.step !== 'confirm' || !isAdmin()) return false;
    v.step = 'busy';
    const n = v.n, word = v.word;
    when(api('POST', '/api/accounts/reset', { name: n, pass: word }), r => {
      if (S.view !== v) return;
      if (!r || r.ok !== true) { v.step = 'failed'; v.text = 'That did not work. Try again.'; return; }
      v.step = 'done'; v.text = `Done. ${r.name || n}'s secret word is now "${word}". Tell ${r.name || n}, then they log in with it.`;
      v.word = ''; setWord(''); sfx('ui'); refresh(true);
    }, e => {
      if (S.view !== v) return;
      v.step = 'failed'; v.text = RESET_WORDS[e && e.code] || 'That did not work. Try again.';
      if (v.text === RESET_WORDS.pass) v.step = 'type';
    });
    return true;
  }
  function leaveReset() { const v = S.view; setWord(''); blurBox(); S.view = v && v.n ? { kind: 'acct', n: v.n } : null; }

  // ---------- the text box: a real <input> over the canvas (16 px so Safari does not zoom), guarded ----------
  // Built on first use, only where there is a document body (tools/headless.js has none). While it has the keyboard no
  // key reaches the game: 05-input listens on window in the bubble phase, this listens in the capture phase and stops
  // the event there (74-chat's guard). Enter is Next, Escape lets go of the keyboard.
  let box = null, want = null;
  function ensureBox() {
    if (box !== null) return box;
    if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function' || typeof document.body.appendChild !== 'function') { box = false; return box; }
    try {
      const input = document.createElement('input');
      input.type = 'text'; input.id = 'admin-secret'; input.autocomplete = 'off'; input.spellcheck = false; input.maxLength = WORD_MAX;
      input.setAttribute('autocapitalize', 'none'); input.setAttribute('autocorrect', 'off'); input.setAttribute('enterkeyhint', 'next'); input.setAttribute('aria-label', 'New secret word');
      input.placeholder = 'New secret word';
      input.style.cssText = 'position:fixed;display:none;z-index:15;box-sizing:border-box;margin:0;padding:0 12px;font:16px "Trebuchet MS","Segoe UI",system-ui,sans-serif;color:#e6edf3;background:#0b0f14;border:1px solid #f5c542;border-radius:8px;outline:none;-webkit-appearance:none;appearance:none;';
      input.addEventListener('input', () => { S.word = String(input.value).slice(0, WORD_MAX); });
      const guard = e => {
        if (!box || document.activeElement !== box.input) return;
        if (e.type === 'keydown') { if (e.key === 'Enter') { e.preventDefault(); resetNext(); } else if (e.key === 'Escape') { e.preventDefault(); blurBox(); } }
        e.stopPropagation(); keys.clear();
      };
      for (const t of ['keydown', 'keyup', 'keypress']) window.addEventListener(t, guard, true);
      document.body.appendChild(input);
      box = { input, shown: false, key: '' };
    } catch (e) { box = false; }
    return box;
  }
  function showBox(w) {
    const d = ensureBox(); if (!d) return;
    // while it has the keyboard it rides just above the iPad's on-screen keyboard, never under it
    let top = w.y;
    const vv = window.visualViewport;
    if (vv && typeof vv.height === 'number' && document.activeElement === d.input) { const bottom = (vv.offsetTop || 0) + vv.height - 8; if (top + w.h > bottom) top = Math.max(8, bottom - w.h); }
    const k = [w.x, top, w.w, w.h].join(',');
    if (d.key !== k) { d.key = k; const s = d.input.style; s.left = Math.round(w.x) + 'px'; s.top = Math.round(top) + 'px'; s.width = Math.round(w.w) + 'px'; s.height = Math.round(w.h) + 'px'; }
    if (d.input.value !== S.word) d.input.value = S.word;
    if (!d.shown) { d.shown = true; d.input.style.display = 'block'; }
  }
  function blurBox() { if (box && box.input) { try { box.input.blur(); } catch (e) { } } }
  function hideBox() { if (!box || !box.shown) return; box.shown = false; box.key = ''; blurBox(); box.input.value = ''; box.input.style.display = 'none'; }
  function focusBox() { const d = ensureBox(); if (!d) return; d.input.value = S.word; try { d.input.focus(); } catch (e) { } }

  // ---------- drawing helpers ----------
  function btn(g, x, y, w, h, text, action, color, enabled, key) {
    g.font = 'bold 13px sans-serif'; button(g, x, y, w, h, fit(g, text, w - 10), action, color || '#238636', enabled !== false);
    const b = buttons[buttons.length - 1]; if (key) b.label = (b.disabled ? 'disabled:' : '') + key; return b;
  }
  // a row of buttons: fixed widths first, then 'fill' ones share what is left
  function row(g, x, y, w, h, specs) {
    const gap = 6, fixed = specs.reduce((a, s) => a + (s.w === 'fill' ? 0 : s.w), 0), fills = specs.filter(s => s.w === 'fill').length;
    const fillW = fills ? Math.max(44, (w - fixed - gap * (specs.length - 1)) / fills) : 0;
    let cx = x;
    for (const s of specs) { const bw = s.w === 'fill' ? fillW : s.w; btn(g, cx, y, bw, h, s.text, s.action, s.color, s.enabled, s.key); cx += bw + gap; }
  }
  function text(g, str, x, y, maxW, color, font) { g.font = font || '12px sans-serif'; g.textAlign = 'left'; g.fillStyle = color || DIM; g.fillText(fit(g, str, maxW), x, y); }
  function pill(g, x, y) {
    if (window.PLAYERS && PLAYERS.adminPill) return PLAYERS.adminPill(g, x, y, 9);
    g.font = 'bold 9px sans-serif'; const w = g.measureText('ADMIN').width + 10;
    roundRect(g, x, y - 7, w, 13, 6); g.fillStyle = GOLD; g.fill(); g.fillStyle = '#1a1300'; g.textAlign = 'center'; g.fillText('ADMIN', x + w / 2, y + 3); g.textAlign = 'left';
    return w;
  }
  function dot(g, x, y, on) {
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2);
    if (on) { g.fillStyle = GREEN; g.fill(); } else { g.strokeStyle = '#484f58'; g.lineWidth = 1.5; g.stroke(); }
  }
  // the name, gold with the ADMIN tag for an admin; answers the x after it
  function nameLine(g, a, x, y, maxW) {
    g.font = 'bold 14px sans-serif'; g.textAlign = 'left'; g.fillStyle = a.role === 'admin' ? GOLD : INK;
    const nm = fit(g, a.name, Math.max(30, maxW - (a.role === 'admin' ? 58 : 0))); g.fillText(nm, x, y);
    let cx = x + g.measureText(nm).width + 6;
    if (a.role === 'admin') cx += pill(g, cx, y - 4) + 6;
    return cx;
  }

  // ---------- scrolling: one area per view, dragged, wheeled or stepped ----------
  // The area's own hit rect goes in first, so every button drawn inside it (on top) still wins its tap; a button scrolled
  // even partly out of sight is taken back out of `buttons`, so nothing hidden can be pressed.
  function scrollArea(g, key, x, y, w, h, contentH, draw) {
    const max = Math.max(0, Math.ceil(contentH - h));
    S.scroll[key] = clamp(S.scroll[key] || 0, 0, max);
    S.areas[key] = { x, y, w, h, max };
    buttons.push({ x, y, w, h, label: 'acct:area:' + key, action: () => startDrag(key) });
    const from = buttons.length;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    draw(y - S.scroll[key]);
    g.restore();
    for (let i = buttons.length - 1; i >= from; i--) { const b = buttons[i]; if (b.y < y - 0.5 || b.y + b.h > y + h + 0.5) buttons.splice(i, 1); }
    if (max > 0) {   // where in the list this is: a thin bar on the right edge
      const th = Math.max(24, h * h / contentH), ty = y + (h - th) * (S.scroll[key] / max);
      roundRect(g, x + w - 4, ty, 3, th, 1.5); g.fillStyle = 'rgba(230,237,243,0.35)'; g.fill();
    }
    return max;
  }
  const scrollBy = (key, dy) => { const a = S.areas[key]; if (!a) return; S.scroll[key] = clamp((S.scroll[key] || 0) + dy, 0, a.max); };
  function startDrag(key) {
    const d = S.down; if (!d) return;
    S.drag = { key, id: d.id, x0: d.x, y0: d.y, s0: S.scroll[key] || 0, moved: 0 };
  }
  // a still tap on the list opens that knight's page
  function tapList(y) {
    const a = S.areas.list, L = S.rows; if (!a || !L) return false;
    const i = Math.floor((y - a.y + S.scroll.list) / S.rowH);
    if (i < 0 || i >= L.length || y < a.y || y > a.y + a.h) return false;
    openAccount(L[i].name); return true;
  }
  function openAccount(n) { const a = find(n); if (!a) return false; S.view = { kind: 'acct', n: a.name }; S.scroll.acct = 0; sfx('open'); return true; }
  { const _pointerDown = pointerDown; pointerDown = function (x, y, id) { S.down = { x, y, id }; S.drag = null; return _pointerDown(x, y, id); }; }
  { const _pointerMove = pointerMove;
    pointerMove = function (x, y, id) {
      if (id === 'mouse') S.mouse = { x, y };
      const d = S.drag;
      if (d && d.id === id) { d.moved = Math.max(d.moved, Math.hypot(x - d.x0, y - d.y0)); if (d.moved > DRAG_SLOP) { const a = S.areas[d.key]; S.scroll[d.key] = clamp(d.s0 - (y - d.y0), 0, a ? a.max : 0); } }
      return _pointerMove(x, y, id);
    }; }
  { const _pointerUp = pointerUp;
    pointerUp = function (id) {
      const d = S.drag;
      if (d && d.id === id) { S.drag = null; if (d.moved <= DRAG_SLOP && d.key === 'list' && tabOpen() && !S.view) tapList(d.y0); }
      return _pointerUp(id);
    }; }
  // the mouse wheel over a scroll area (a laptop)
  try {
    if (typeof canvas !== 'undefined' && canvas && typeof canvas.addEventListener === 'function') canvas.addEventListener('wheel', e => {
      if (!tabOpen() || !S.mouse) return;
      for (const key of ['list', 'acct']) { const a = S.areas[key]; if (a && (key === 'list' ? !S.view : S.view && S.view.kind === 'acct') && inRect(S.mouse.x, S.mouse.y, a)) { e.preventDefault(); scrollBy(key, e.deltaY); return; } }
    }, { passive: false });
  } catch (e) { }

  // ---------- A. the list ----------
  function drawList(g, x, y, w, h, T) {
    const wide = w >= 560;
    const L = S.list || [];
    const on = L.filter(a => a.online).length;
    const summary = S.list ? `${L.length} knight${L.length === 1 ? '' : 's'}, ${on} online now · updated ${clockWords(Date.now() - (nowMs() - S.at))}` : S.loading ? 'Looking up every knight…' : errorWords(S.error);
    // the bar: Refresh, what this is, Up / Down
    const upDown = [
      { text: 'Up', w: 64, action: () => scrollBy('list', -Math.max(S.rowH, (S.areas.list ? S.areas.list.h : 200) - S.rowH)), color: '#21262d', enabled: (S.scroll.list || 0) > 0, key: 'acct:up' },
      { text: 'Down', w: 64, action: () => scrollBy('list', Math.max(S.rowH, (S.areas.list ? S.areas.list.h : 200) - S.rowH)), color: '#21262d', enabled: !!S.areas.list && (S.scroll.list || 0) < S.areas.list.max, key: 'acct:down' },
    ];
    const refreshBtn = { text: S.loading ? 'Looking…' : 'Refresh', w: wide ? 110 : 'fill', action: () => { refresh(); }, color: '#1f4e78', enabled: !S.loading, key: 'acct:refresh' };
    let top;
    if (wide) { row(g, x, y, 110, T, [refreshBtn]); row(g, x + w - 134, y, 134, T, upDown); text(g, summary, x + 120, y + T / 2 + 4, w - 120 - 142, S.error && !S.list ? ORANGE : DIM); top = y + T + 8; }
    else { row(g, x, y, w, T, [refreshBtn].concat(upDown)); text(g, summary, x, y + T + 16, w, S.error && !S.list ? ORANGE : DIM); top = y + T + 24; }
    if (!S.list) return;
    if (!L.length) { text(g, 'No knights yet.', x, top + 18, w, DIM); return; }
    S.rowH = wide ? 70 : 90; S.rows = L;
    scrollArea(g, 'list', x, top, w, y + h - top, L.length * S.rowH, oy => {
      L.forEach((a, i) => { const ry = oy + i * S.rowH; if (ry + S.rowH < top || ry > y + h) return; listRow(g, a, x, ry, w - 8, S.rowH - 6, wide); });
    });
  }
  function listRow(g, a, x, y, w, h, wide) {
    roundRect(g, x, y, w, h, 8); g.fillStyle = a.role === 'admin' ? 'rgba(245,197,66,0.08)' : 'rgba(255,255,255,0.05)'; g.fill();
    dot(g, x + 14, y + 17, a.online);
    const tags = [a.banned ? ['Banned', RED] : null, muteWords(a) ? ['Muted', ORANGE] : null].filter(Boolean);
    g.font = 'bold 12px sans-serif'; const tagW = tags.reduce((s, t) => s + g.measureText(t[0]).width + 10, 0);
    nameLine(g, a, x + 26, y + 22, w - 40 - tagW);
    let tx = x + w - 10; g.textAlign = 'right';
    for (const [t, c] of tags) { g.font = 'bold 12px sans-serif'; g.fillStyle = c; g.fillText(t, tx, y + 22); tx -= g.measureText(t).width + 10; }
    g.textAlign = 'left';
    const status = a.online ? `Online now in ${whereOf(a)}` : `Last on ${whenWords(a.lastOn)}`, made = `Made ${dayWords(a.created)}`, play = `Knight play time: ${playWords(a)}`;
    const tw = w - 38;
    if (wide) {
      text(g, status, x + 26, y + 41, tw * 0.62, a.online ? GREEN : '#c9d1d9', '13px sans-serif');
      text(g, made, x + 26 + tw * 0.64, y + 41, tw * 0.36, DIM);
      text(g, timeOnLine(a), x + 26, y + 58, tw * 0.62, DIM);
      text(g, play, x + 26 + tw * 0.64, y + 58, tw * 0.36, DIM);
    } else {
      text(g, status, x + 26, y + 41, tw, a.online ? GREEN : '#c9d1d9', '13px sans-serif');
      text(g, timeOnLine(a), x + 26, y + 58, tw, DIM);
      text(g, play + '  ·  ' + made, x + 26, y + 75, tw, DIM);
    }
  }

  // ---------- B. a knight's page ----------
  function drawAccount(g, x, y, w, h, T) {
    const a = find(S.view.n);
    const isMe = !!a && a.name.toLowerCase() === me();
    // the bar: Back, the name, Up / Down when the page is taller than the panel
    const over = S.areas.acct && S.areas.acct.max > 0;
    btn(g, x, y, 90, T, 'Back', () => { S.view = null; }, '#21262d', true, 'acct:back');
    if (over) row(g, x + w - 134, y, 134, T, [
      { text: 'Up', w: 64, action: () => scrollBy('acct', -(S.areas.acct.h - 40)), color: '#21262d', enabled: (S.scroll.acct || 0) > 0, key: 'acct:page:up' },
      { text: 'Down', w: 64, action: () => scrollBy('acct', S.areas.acct.h - 40), color: '#21262d', enabled: (S.scroll.acct || 0) < S.areas.acct.max, key: 'acct:page:down' }]);
    if (!a) { text(g, S.loading ? 'Looking…' : 'That knight is not in the list any more.', x + 100, y + T / 2 + 5, w - 100, DIM, '13px sans-serif'); return; }
    dot(g, x + 106, y + T / 2, a.online);
    nameLine(g, a, x + 118, y + T / 2 + 5, w - 118 - (over ? 140 : 0));
    const top = y + T + 10, wide = w >= 560;
    // what the page holds, laid out once, then drawn at the scroll offset
    const lines = [
      [a.online ? `Online now in ${whereOf(a)}` : `Last on ${whenWords(a.lastOn)}`, a.online ? GREEN : INK],
      [a.lastLogin ? `Last login: ${whenWords(a.lastLogin)}` : `Last login: none since ${dayWords(a.countedSince)}`, INK],
      [timeOnLine(a), INK],
      [`Knight play time: ${playWords(a)}`, INK],
      [`Made ${whenWords(a.created)}`, DIM],
      [muteWords(a) || 'Chat: on', muteWords(a) ? ORANGE : DIM],
    ];
    if (a.banned) lines.push(["Banned: can't log in", RED]);
    if (isMe) lines.push(['This is you. Change your own secret word on the parent page.', GOLD]);
    else if (a.role === 'admin') lines.push(['An admin. Only the parent page can change an admin.', GOLD]);
    const LH = 20, colW = wide ? Math.floor(w * 0.5) - 8 : w - 8;
    // a sentence too long for the column goes onto a second line rather than losing its end
    for (let i = lines.length - 1; i >= 0; i--) { const parts = wrap(g, lines[i][0], colW, '13px sans-serif'); if (parts.length > 1) lines.splice(i, 1, ...parts.map(p => [p, lines[i][1]])); }
    const acts = !isMe && a.role !== 'admin';
    const leftH = lines.length * LH + 6 + (acts ? 2 * (T + 8) : 0);
    const L = a.logins, logH = 24 + Math.max(1, L.length) * LH;
    const contentH = wide ? Math.max(leftH, logH) : leftH + 12 + logH;
    scrollArea(g, 'acct', x, top, w, y + h - top, contentH + 4, oy => {
      lines.forEach(([s, c], i) => text(g, s, x, oy + 15 + i * LH, colW, c, '13px sans-serif'));
      let by = oy + lines.length * LH + 6;
      if (acts) {
        const armB = confirmActive('acct:ban:' + a.name), armK = confirmActive('acct:kick:' + a.name), muted = !!muteWords(a);
        const specs = [
          muted ? { text: 'Unmute', w: 'fill', action: () => ADMIN.unmute(a.name), color: '#1f4e78', key: 'acct:unmute' }
            : { text: 'Mute', w: 'fill', action: () => { S.view = { kind: 'mute', n: a.name }; }, color: '#1f4e78', key: 'acct:mute' },
          a.banned ? { text: 'Unban', w: 'fill', action: () => ADMIN.unban(a.name), color: '#238636', key: 'acct:unban' }
            : { text: armB ? 'Tap again' : 'Ban', w: 'fill', action: () => confirmTap('acct:ban:' + a.name, () => ADMIN.ban(a.name)), color: armB ? '#c0392b' : '#8b2e2e', key: 'acct:ban' },
        ];
        if (a.online) specs.push({ text: armK ? 'Tap again' : 'Kick', w: 'fill', action: () => confirmTap('acct:kick:' + a.name, () => ADMIN.kick(a.name)), color: armK ? '#c0392b' : '#6b4f2a', key: 'acct:kick' });
        row(g, x, by, colW, T, specs); by += T + 8;
        row(g, x, by, colW, T, [{ text: 'Reset secret word', w: 'fill', action: () => startReset(a.name), color: '#7a5a12', key: 'acct:reset' }]);
      }
      // the logins: beside the rest on a wide panel, under it on a narrow one
      const lx = wide ? x + colW + 16 : x, ly = wide ? oy : oy + leftH + 12, lw = wide ? w - colW - 24 : w - 8;
      text(g, L.length ? `LAST ${L.length === 1 ? 'LOGIN' : L.length + ' LOGINS'}` : 'LOGINS', lx, ly + 14, lw, GOLD, 'bold 12px sans-serif');
      if (!L.length) text(g, `None since ${dayWords(a.countedSince)}, when counting began.`, lx, ly + 24 + 15, lw, DIM, '13px sans-serif');
      L.forEach((l, i) => {
        const yy = ly + 24 + i * LH + 15, len = l.open ? `on now, ${spanWords(loginMsOf(l))} so far` : spanWords(l.ms);
        g.font = '13px sans-serif'; const lenW = g.measureText(len).width;
        text(g, whenWords(l.at), lx, yy, lw - lenW - 12, INK, '13px sans-serif');
        g.textAlign = 'right'; g.fillStyle = l.open ? GREEN : DIM; g.fillText(len, lx + lw, yy); g.textAlign = 'left';
      });
    });
  }
  // mute, from a knight's page: the four lengths, then back to that page
  function drawMute(g, x, y, w, h, T) {
    const n = S.view.n;
    btn(g, x, y, 90, T, 'Back', () => { S.view = { kind: 'acct', n }; }, '#21262d', true, 'acct:mute:back');
    text(g, `Mute ${n} for how long?`, x + 100, y + T / 2 + 5, w - 100, INK, 'bold 15px sans-serif');
    text(g, 'They can still play. Only their chat is off.', x, y + T + 22, w, DIM);
    const cols = w >= 420 ? 2 : 1, bw = (w - (cols - 1) * 8) / cols;
    SPANS.forEach(([span, words], i) => btn(g, x + (i % cols) * (bw + 8), y + T + 36 + Math.floor(i / cols) * (T + 8), bw, T, words, () => { if (ADMIN.mute(n, span)) S.view = { kind: 'acct', n }; }, '#1f4e78', true, 'acct:span:' + span));
  }
  // C. the new secret word: type it, check it, change it
  function drawReset(g, x, y, w, h, T) {
    const v = S.view, n = v.n;
    btn(g, x, y, 90, T, 'Back', leaveReset, '#21262d', v.step !== 'busy', 'acct:reset:back');
    text(g, v.step === 'done' ? `${n} has a new secret word` : `New secret word for ${n}`, x + 100, y + T / 2 + 5, w - 100, INK, 'bold 15px sans-serif');
    let yy = y + T + 14;
    const lines = (s, color, font) => { for (const l of wrap(g, s, w, font || '13px sans-serif')) { text(g, l, x, yy + 14, w, color, font || '13px sans-serif'); yy += 20; } };
    if (v.step === 'type') {
      // the box: drawn here, the real <input> laid over it by the drawPanels wrap below
      roundRect(g, x, yy, w, T, 8); g.fillStyle = '#0b0f14'; g.fill(); g.strokeStyle = GOLD; g.lineWidth = 1; g.stroke();
      g.font = '15px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = S.word ? INK : '#6e7681'; g.fillText(fit(g, S.word || 'Tap here and type it', w - 24), x + 12, yy + T / 2); g.textBaseline = 'alphabetic';
      buttons.push({ x, y: yy, w, h: T, label: 'acct:wordbox', action: focusBox });
      want = { x, y: yy, w, h: T };
      yy += T + 8;
      if (v.text) lines(v.text, ORANGE);
      lines(`At least 4 letters. ${n} is sent out of the world and logs in again with the new word.`, DIM);
      yy += 6;
      btn(g, x, yy, Math.min(w, 220), T, 'Next', resetNext, '#238636', cleanWord(S.word).length >= WORD_MIN, 'acct:reset:next');
    } else if (v.step === 'confirm') {
      lines(`Change ${n}'s secret word to "${v.word}"?`, INK, 'bold 15px sans-serif');
      lines(`${n} is sent out of the world straight away and needs this word to log in again.`, DIM);
      yy += 6;
      row(g, x, yy, Math.min(w, 460), T, [
        { text: 'No, go back', w: 'fill', action: () => { v.step = 'type'; v.text = ''; }, color: '#21262d', key: 'acct:reset:no' },
        { text: 'Yes, change it', w: 'fill', action: resetSend, color: '#c0392b', key: 'acct:reset:yes' }]);
    } else if (v.step === 'busy') {
      lines('Changing it…', DIM);
    } else {
      lines(v.text, v.step === 'done' ? GREEN : ORANGE, v.step === 'done' ? 'bold 14px sans-serif' : '13px sans-serif');
      yy += 6;
      btn(g, x, yy, Math.min(w, 220), T, `Back to ${n}`, leaveReset, '#21262d', true, 'acct:reset:done');
    }
  }
  // words onto lines no wider than w
  function wrap(g, s, w, font) {
    g.font = font; const out = []; let cur = '';
    for (const word of String(s).split(' ')) { const t = cur ? cur + ' ' + word : word; if (cur && g.measureText(t).width > w) { out.push(cur); cur = word; } else cur = t; }
    if (cur) out.push(cur); return out;
  }

  function draw(g, x, y, w, h, T) {
    if (!isAdmin()) return;
    const v = S.view;
    if (v && v.kind === 'acct') drawAccount(g, x, y, w, h, T);
    else if (v && v.kind === 'mute') drawMute(g, x, y, w, h, T);
    else if (v && v.kind === 'reset') drawReset(g, x, y, w, h, T);
    else drawList(g, x, y, w, h, T);
  }

  // one more tab in the Admin panel, after Knights
  if (window.ADMIN && ADMIN.addTab) ADMIN.addTab({
    id: 'accounts', name: 'Accounts', after: 'knights', draw,
    subtitle: 'Every knight, online or not: when they were on, for how long, and a new secret word.',
    short: 'Every knight, online or not.',
    open: () => { S.view = null; S.scroll.list = 0; refresh(); },
  });

  // the text box shows only while its view is drawn (and never under the pause menu)
  { const _drawPanels = drawPanels;
    drawPanels = function (g, narrow, short, qh, hb) {
      want = null;
      const r = _drawPanels(g, narrow, short, qh, hb);
      const v = S.view;
      if (want && tabOpen() && !paused && v && v.kind === 'reset' && v.step === 'type') showBox(want); else hideBox();
      return r;
    }; }

  // ---------- every frame: the 30 s refresh; everything forgotten when the role or the line goes ----------
  function forget() { S.asks++; S.list = null; S.view = null; S.error = null; S.loading = false; S.askedAt = -1e9; S.drag = null; S.scroll = { list: 0, acct: 0 }; S.areas = {}; setWord(''); hideBox(); }
  NET.on('welcome', forget);
  NET.on('offline', forget);
  NET.on('role', () => { if (NET.role !== 'admin') forget(); });
  HOOKS.update.push(() => {
    if (!tabOpen()) { if (S.view && S.view.kind === 'reset') leaveReset(); if (S.drag) S.drag = null; return; }
    if (!S.loading && nowMs() - S.askedAt >= REFRESH_EVERY) refresh();
  });

  const ACCOUNTS = {
    refresh, openAccount, startReset, resetNext, resetSend, setWord, scrollBy, tapList,
    whenWords, dayWords, spanWords, order, clean, REFRESH_EVERY, state: S,
  };
  window.ACCOUNTS = ACCOUNTS;

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'accounts: ';
    if (window.INSTANCES && INSTANCES.active && INSTANCES.active()) INSTANCES.leave();
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, touch: window.__forceTouch, peace: window.__peace, notice, paused, vw: window.innerWidth, vh: window.innerHeight, tab: ADMIN.state.tab };
    // a small world: welcomes MudGoll with whatever role the test says, answers the two account calls, records everything
    let sock = null, role = 'admin';
    const sent = [], calls = [];
    const world = {
      list: [], resetFail: null,
      call(method, path, body) {
        calls.push({ method, path, body });
        const fail = (code, status) => { const e = new Error(code); e.code = code; e.status = status; throw e; };
        if (path === '/api/accounts' && method === 'GET') return JSON.parse(JSON.stringify(world.list));
        if (path === '/api/accounts/reset' && method === 'POST') { if (world.resetFail) fail(world.resetFail, 403); return { ok: true, name: body.name }; }
        if (path === '/api/save/pin') return { at: null, bytes: 0 };
        return {};
      },
      open() { const s = { readyState: 1, send(str) { const m = JSON.parse(str); sent.push(m); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'MudGoll', at: 1, keeper: 'MudGoll', role }) }); }, close() { s.readyState = 3; } }; sock = s; return s; },
    };
    const feed = m => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(m) }); };
    const connect = r => { role = r; NET.disconnect(); NET.token = 'accounts-test'; NET.connect(); };
    const gets = () => calls.filter(c => c.path === '/api/accounts').length;
    const resets = () => calls.filter(c => c.path === '/api/accounts/reset');
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const has = label => buttons.some(b => b.label === label);
    // a canvas that remembers what was written
    const rec = [], st = {};
    const g2 = new Proxy(st, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : k === 'fillText' ? ((s) => { rec.push(String(s)); }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in st ? st[k] : () => { }), set: (t, k, v) => { st[k] = v; return true; } });
    const drawn = () => { rec.length = 0; HOOKS.panel.admin(g2, false); const out = rec.splice(0); render(); return out; };
    // the list the world answers: three on line (one of them the admin himself), an admin, a banned knight with no save,
    // a muted one whose save has no play time, and twenty more
    const now = Date.now(), M = 60000, HR = 60 * M, DAY = 24 * HR, since = now - 2 * DAY;
    const lg = (ago, ms, open) => ({ at: now - ago, ms, open: !!open });
    const base = { role: 'player', online: false, map: null, region: null, lv: null, created: now - 20 * DAY, lastLogin: null, onlineMs: 0, countedSince: since, playSeconds: 600, saveAt: now - DAY, banned: false, mutedUntil: 0, logins: [] };
    const acct = o => Object.assign({}, base, o);
    const cohenLogins = [lg(71 * M, 71 * M, true), lg(20 * HR, 48 * M), lg(22 * HR, 12 * M), lg(DAY + 3 * HR, 64 * M), lg(DAY + 6 * HR, 20 * M), lg(DAY + 9 * HR, 30000), lg(2 * DAY, 9 * M), lg(2 * DAY + HR, 17 * M), lg(2 * DAY + 2 * HR, 41 * M), lg(2 * DAY + 3 * HR, 25 * M)];
    const denName = ((window.INSTANCES && INSTANCES.get('spider_den')) || {}).name || 'Spider Den';
    world.list = [
      acct({ name: 'Ada', role: 'admin', lastOn: now - 3 * HR, lastLogin: now - 5 * HR, onlineMs: 6 * HR, playSeconds: 30 * 3600, logins: [lg(5 * HR, 2 * HR)] }),
      acct({ name: 'Bo', banned: true, lastOn: now - 4 * DAY, playSeconds: null, saveAt: null }),
      acct({ name: 'Cohen', online: true, map: 'over', region: 'Wolfwood', lv: 34, created: now - 28 * DAY, lastOn: now, lastLogin: now - 71 * M, onlineMs: 3 * HR + 12 * M, playSeconds: 14 * 3600 + 5 * 60, logins: cohenLogins }),
      acct({ name: 'MudGoll', role: 'admin', online: true, map: 'over', region: 'Thistledown', lv: 99, lastOn: now, lastLogin: now - 40 * M, onlineMs: 9 * HR, logins: [lg(40 * M, 40 * M, true)] }),
      acct({ name: 'Pip', mutedUntil: now + 10 * M, lastOn: now - 30 * HR, lastLogin: now - 31 * HR, onlineMs: 58 * M, playSeconds: null, logins: [lg(31 * HR, 58 * M)] }),
      acct({ name: 'Sam', online: true, map: 'spider_den', region: 'Spider Den', lv: 21, lastOn: now, lastLogin: now - 18 * M, onlineMs: 18 * M, logins: [lg(18 * M, 18 * M, true)] }),
    ];
    for (let i = 1; i <= 20; i++) world.list.push(acct({ name: 'Knight ' + String(i).padStart(2, '0'), lastOn: now - (40 + i) * HR, lastLogin: now - (41 + i) * HR, onlineMs: i * M, logins: [lg((41 + i) * HR, i * M)] }));
    try {
      NET.enabled = true; NET.useFake(world); dialog.cur = null; dialog.queue.length = 0; closePanel(); paused = false; h.peace(true); window.__forceTouch = false;
      try { window.innerWidth = 1000; window.innerHeight = 700; } catch (e) { } render();

      // ---- the words: real dates in local time, exact lengths ----
      { const Y = new Date().getFullYear(), d = new Date(Y, 8, 25, 19, 42), old = new Date(Y - 1, 0, 3, 9, 5);
        const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const words = [whenWords(d.getTime()), whenWords(old.getTime()), spanWords((3 * 3600 + 12 * 60) * 1000), spanWords(12 * 60000 + 59000), spanWords(59999), spanWords((14 * 3600 + 5 * 60) * 1000), dayWords(d.getTime())];
        const want = [dow[d.getDay()] + ' 25 Sep, 7:42 pm', dow[old.getDay()] + ' 3 Jan ' + (Y - 1) + ', 9:05 am', '3h 12m', '12m', 'under a minute', '14h 5m', dow[d.getDay()] + ' 25 Sep'];
        check(P + 'dates read like "Fri 25 Sep, 7:42 pm" in local time (the year only when it is not this one); lengths like "3h 12m", "12m", "under a minute"', same(words, want), { words, want }); }

      // ---- a player never sees the tab, never asks for the list ----
      { connect('player'); closePanel(); const noOpen = ADMIN.open('accounts') === false; openPanel('admin'); render(); const shut = panel !== 'admin';
        const noRefresh = refresh() === false, noTab = !has('admin:tab:accounts'), none = gets() === 0;
        // the world refusing a player (a stale admin screen) reads in plain words and draws no list
        connect('admin'); closePanel(); const w0 = world.call; world.call = (m, p, b) => { if (p === '/api/accounts') { calls.push({ path: p }); const e = new Error('admin'); e.code = 'admin'; e.status = 403; throw e; } return w0(m, p, b); };
        ADMIN.open('accounts'); render(); const refusedText = drawn(); world.call = w0;
        const refused = S.list === null && S.error === 'admin' && refusedText.includes('Only an admin can see this.');
        check(P + "a player never sees Accounts: no tab, the panel will not open, and nothing is asked of the world; the world's own refusal reads in plain words", noOpen && shut && noRefresh && noTab && none && refused, { noOpen, shut, noRefresh, noTab, none, refused, error: S.error }); }

      // ---- an admin: the tab after Knights, one ask, every account in order ----
      { closePanel(); calls.length = 0; ADMIN.open('knights'); render(); F.clickButton('admin:tab:accounts'); render();
        const tabs = ADMIN.tabs().join(','), asked = gets() === 1, tabHere = has('admin:tab:accounts');
        const names = (S.list || []).map(a => a.name);
        const wantOrder = ['Cohen', 'MudGoll', 'Sam', 'Ada', 'Pip', 'Bo'].concat(world.list.filter(a => /^Knight/.test(a.name)).map(a => a.name));
        wantOrder.splice(5, 0, ...wantOrder.splice(6, 20));   // the twenty (41 h and more ago) come before Bo (4 days ago)
        // walk the whole list with Down, collecting what was drawn on every page
        const seen = new Set(drawn()); let downs = 0;
        while (has('acct:down') && downs < 40) { F.clickButton('acct:down'); downs++; for (const t of drawn()) seen.add(t); }
        const upAgain = F.clickButton('acct:up') && S.scroll.list < S.areas.list.max;
        const text = Array.from(seen), onlyNames = names.every(n => text.includes(n));
        const a = n => world.list.find(x => x.name === n);
        const lines = [
          'Online now in Wolfwood', 'Online now in ' + denName, 'Online now in Thistledown',
          'Time online: 3h 12m (since ' + dayWords(since) + ')', 'Knight play time: 14h 5m', 'Made ' + dayWords(a('Cohen').created),
          'Last on ' + whenWords(a('Ada').lastOn), 'Last on ' + whenWords(a('Knight 20').lastOn), 'Time online: 20m (since ' + dayWords(since) + ')',
          'Time online: none yet (since ' + dayWords(since) + ')', 'Banned', 'Muted', 'ADMIN',
        ];
        const missing = lines.filter(l => !text.some(t => t === l || t.startsWith(l)));
        const phoneLines = ['Knight play time: no save yet  ·  Made ' + dayWords(a('Bo').created), 'Knight play time: unknown  ·  Made ' + dayWords(a('Pip').created)];
        try { window.innerWidth = 390; window.innerHeight = 844; } catch (e) { } render();
        const phone = new Set(); S.scroll.list = 0; for (let i = 0; i < 40; i++) { for (const t of drawn()) phone.add(t); if (!has('acct:down')) break; F.clickButton('acct:down'); }
        const phoneMissing = phoneLines.filter(l => !phone.has(l));
        try { window.innerWidth = 1000; window.innerHeight = 700; } catch (e) { } S.scroll.list = 0; render();
        check(P + 'an admin gets the Accounts tab after Knights; opening it asks the world once; every account is drawn, the ones on line first with where they are, then by when they were last on, each with its time on line, knight play time and the day it was made; Down walks the whole list and Up comes back', tabs === 'knights,accounts,powers,monsters,party' && asked && tabHere && same(names, wantOrder) && onlyNames && downs > 0 && upAgain && missing.length === 0 && phoneMissing.length === 0,
          { tabs, asked, tabHere, order: same(names, wantOrder) ? 'ok' : names, onlyNames, downs, upAgain, missing, phoneMissing }); }

      // ---- scrolling by drag, and a still tap that opens a knight's page ----
      { closePanel(); ADMIN.open('accounts'); render(); drawn();
        const A = S.areas.list, rh = S.rowH, s0 = S.scroll.list;
        const cx = A.x + A.w / 2, cy = A.y + A.h - 20;
        pointerDown(cx, cy, 'mouse'); pointerMove(cx, cy - 60, 'mouse'); pointerMove(cx, cy - 150, 'mouse'); pointerUp('mouse');
        const dragged = S.scroll.list === s0 + 150 && S.view === null;
        render();
        const i = Math.floor((A.y + 30 - A.y + S.scroll.list) / rh), who = S.rows[i].name;
        pointerDown(cx, A.y + 30, 'mouse'); pointerMove(cx + 3, A.y + 33, 'mouse'); pointerUp('mouse');
        const opened = !!S.view && S.view.kind === 'acct' && S.view.n === who;
        render(); F.clickButton('acct:back'); const back = S.view === null;
        // a drag that starts on a row and ends far away is a scroll, never a tap
        render(); pointerDown(cx, A.y + 100, 'mouse'); pointerMove(cx, A.y + 20, 'mouse'); pointerUp('mouse'); const noTap = S.view === null;
        check(P + 'the list scrolls by drag (150 px of finger is 150 px of list) and a still tap on a row opens that knight; a drag that starts on a row never opens it', dragged && opened && back && noTap, { dragged, scroll: [s0, S.scroll.list], who, opened, back, noTap }); }

      // ---- a knight's page: the last 10 logins, and mute / ban / kick through the same messages Knights sends ----
      { closePanel(); ADMIN.open('accounts'); render(); calls.length = 0; sent.length = 0; openAccount('Cohen'); render();
        const text = drawn();
        const logins = cohenLogins.every(l => text.includes(whenWords(l.at))) && text.includes('48m') && text.includes('1h 4m') && text.includes('under a minute') && text.some(t => /^on now, 1h 11m so far$/.test(t)) && text.includes('LAST 10 LOGINS');
        const info = ['Online now in Wolfwood', 'Last login: ' + whenWords(now - 71 * M), 'Knight play time: 14h 5m', 'Chat: on'].every(l => text.includes(l));
        const btns = ['acct:mute', 'acct:ban', 'acct:kick', 'acct:reset'].every(has);
        F.clickButton('acct:mute'); render(); const chooser = S.view.kind === 'mute' && has('acct:span:1h');
        F.clickButton('acct:span:1h'); const muted = same(sent.filter(m => m.t === 'mute').pop(), { t: 'mute', n: 'Cohen', span: '1h' }) && S.view.kind === 'acct';
        render(); F.clickButton('acct:ban'); const armed = !sent.some(m => m.t === 'ban'); render(); F.clickButton('acct:ban'); const banned = same(sent.filter(m => m.t === 'ban').pop(), { t: 'ban', n: 'Cohen' });
        const g0 = gets(); feed({ t: 'mod', ok: true, act: 'ban', n: 'Cohen' }); const again = gets() === g0 + 1;
        openAccount('Ada'); const adaText = drawn(); const adaBare = !['acct:mute', 'acct:ban', 'acct:kick', 'acct:reset', 'acct:unmute'].some(has) && adaText.join(' ').includes('An admin. Only the parent page can change an admin.');
        openAccount('MudGoll'); const meText = drawn(); const meBare = !['acct:mute', 'acct:ban', 'acct:reset'].some(has) && meText.join(' ').includes('This is you. Change your own secret word on the parent page.');
        openAccount('Pip'); const pipText = drawn(); const pip = has('acct:unmute') && !has('acct:kick') && pipText.some(t => /^Muted for 10 minutes more$/.test(t)) && pipText.includes('LAST LOGIN');
        openAccount('Bo'); const boText = drawn(); const bo = has('acct:unban') && boText.includes("Banned: can't log in") && boText.includes('Last login: none since ' + dayWords(since)) && boText.includes('None since ' + dayWords(since) + ', when counting began.');
        check(P + "a knight's page: the last 10 logins with the day, time and length (the open one still counting), where they are, their times; Mute (by the chooser), Ban (two taps) and Kick send the Knights tab's messages and the list refreshes after; an admin and yourself get no buttons; Unmute and Unban when muted or banned", logins && info && btns && chooser && muted && armed && banned && again && adaBare && meBare && pip && bo,
          { logins, info, btns, chooser, muted, armed, banned, again, adaBare, meBare, pip, bo }); }

      // ---- Reset secret word: type, a check in the page, one call, the answer in plain words ----
      { closePanel(); ADMIN.open('accounts'); render(); calls.length = 0; openAccount('Cohen'); render();
        F.clickButton('acct:reset'); render();
        const typing = S.view.kind === 'reset' && S.view.step === 'type' && has('acct:wordbox');
        setWord('ab'); render(); const off = has('disabled:acct:reset:next') && resetNext() === false && S.view.text === 'That is too short. Use at least 4 letters.' && resets().length === 0;
        setWord('  dragon   fire '); render(); F.clickButton('acct:reset:next'); const text = drawn();
        const asks = S.view.step === 'confirm' && resets().length === 0 && text.includes('Change Cohen\'s secret word to "dragon fire"?') && has('acct:reset:yes') && has('acct:reset:no');
        F.clickButton('acct:reset:no'); const backToType = S.view.step === 'type' && S.word === '  dragon   fire ';
        render(); F.clickButton('acct:reset:next'); render(); const g0 = gets(); F.clickButton('acct:reset:yes');
        const r = resets(); const one = r.length === 1 && same(r[0].body, { name: 'Cohen', pass: 'dragon fire' }) && r[0].method === 'POST';
        const doneText = drawn();
        const done = S.view.step === 'done' && doneText.includes('Cohen has a new secret word') && S.view.text === 'Done. Cohen\'s secret word is now "dragon fire". Tell Cohen, then they log in with it.' && S.word === '' && gets() === g0 + 1;
        F.clickButton('acct:reset:done'); const home = S.view.kind === 'acct' && S.view.n === 'Cohen';
        // the world says no: each code in plain words, nothing else changes
        const said = {};
        for (const code of ['isadmin', 'self', 'wait', 'unknown', 'boom']) { world.resetFail = code; startReset('Cohen'); setWord('shield'); resetNext(); resetSend(); said[code] = S.view.step + ': ' + S.view.text; }
        world.resetFail = 'pass'; startReset('Cohen'); setWord('shield'); resetNext(); resetSend(); const passBack = S.view.step === 'type' && S.view.text === 'The secret word needs at least 4 letters.';
        world.resetFail = null;
        const wantSaid = { isadmin: "failed: You can't change another admin's secret word.", self: 'failed: Change your own secret word on the parent page.', wait: 'failed: That is a lot of changes at once. Wait a minute, then try again.', unknown: 'failed: No knight by that name.', boom: 'failed: That did not work. Try again.' };
        // closing the panel with a word typed forgets the word
        startReset('Cohen'); setWord('secret'); closePanel(); F.step([]); const forgot = S.word === '' && S.view && S.view.kind === 'acct';
        const noAdmin = startReset('Ada') === false && startReset('MudGoll') === false;
        check(P + 'Reset secret word: Next stays off under 4 letters; the page asks "Change Cohen\'s secret word to ...?" before anything is sent; No goes back with the word kept; Yes sends exactly POST /api/accounts/reset {name, pass} (spaces tidied), says it is done in plain words and refreshes the list; each refusal reads as a sentence; the word is forgotten once done or when the panel closes; never offered for an admin or yourself',
          typing && off && asks && backToType && one && done && home && same(said, wantSaid) && passBack && forgot && noAdmin, { typing, off, asks, backToType, one, body: r[0] && r[0].body, done, view: S.view && S.view.text, home, said, passBack, forgot, noAdmin }); }

      // ---- every 30 s while open, never while shut; a demotion forgets everything ----
      { closePanel(); ADMIN.open('accounts'); render(); const g0 = gets();
        S.askedAt = nowMs() - REFRESH_EVERY - 1; F.step([]); const ticked = gets() === g0 + 1;
        F.step([]); const once = gets() === g0 + 1;
        closePanel(); S.askedAt = nowMs() - REFRESH_EVERY - 1; F.step([]); const quiet = gets() === g0 + 1;
        ADMIN.open('accounts'); openAccount('Cohen'); startReset('Cohen'); setWord('sneaky');
        feed({ t: 'role', role: 'player' }); const gone = panel !== 'admin' && S.list === null && S.view === null && S.word === '';
        connect('admin');
        check(P + 'the list refreshes itself every 30 s while the tab is open and never while it is shut; a demotion closes it and forgets the list, the page and any word typed', ticked && once && quiet && gone, { ticked, once, quiet, gone }); }

      // ---- layout: every view keeps its buttons inside the panel, clear of each other, 44 px on touch ----
      { closePanel(); connect('admin');
        const sizes = [[390, 844, 'phone'], [844, 390, 'landscape phone'], [768, 1024, 'iPad'], [1024, 768, 'iPad landscape'], [1280, 800, 'laptop']];
        const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        const hits = [], small = [], done = [];
        for (const touchOn of [false, true]) {
          window.__forceTouch = touchOn;
          for (const [w, hh, name] of sizes) {
            try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { }
            closePanel(); render(); if (VW !== w || VH !== hh) continue;
            const tag = name + (touchOn ? ' touch' : '');
            for (const view of ['list', 'acct', 'acct-admin', 'mute', 'type', 'confirm', 'done']) {
              ADMIN.open('accounts'); render();
              if (view !== 'list') openAccount(view === 'acct-admin' ? 'Ada' : 'Cohen');
              if (view === 'mute') S.view = { kind: 'mute', n: 'Cohen' };
              if (view === 'type' || view === 'confirm' || view === 'done') { startReset('Cohen'); setWord('dragon'); if (view !== 'type') resetNext(); if (view === 'done') resetSend(); }
              render(); render();
              const r = panelRect, mine = buttons.slice(ADMIN.state.panelFrom || 0).filter(b => b.w > 0 && b.h > 0 && !/^acct:area:/.test(b.label));
              for (const b of mine) if (!r || b.x < r.x - 1 || b.y < r.y - 1 || b.x + b.w > r.x + r.w + 1 || b.y + b.h > r.y + r.h + 1) hits.push(`${tag} ${view}: ${b.label} leaves the panel`);
              for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) if (overlap(mine[i], mine[j])) hits.push(`${tag} ${view}: ${mine[i].label} × ${mine[j].label}`);
              const area = S.areas[view === 'list' ? 'list' : 'acct'];
              if (area && (view === 'list' || /^acct/.test(view)) && (area.h < 88 || area.y + area.h > r.y + r.h)) hits.push(`${tag} ${view}: the scroll area is ${Math.round(area.h)} px tall`);
              if (touchOn) for (const b of mine) if (b.h < 44 || b.w < 44) small.push(`${tag} ${view}: ${b.label} ${Math.round(b.w)}x${Math.round(b.h)}`);
              done.push(tag + ' ' + view); closePanel(); F.step([]);
            }
          }
        }
        try { window.innerWidth = was.vw; window.innerHeight = was.vh; } catch (e) { } window.__forceTouch = was.touch;
        check(P + 'layout: the list, a knight\'s page (a player\'s and an admin\'s), the mute chooser and every step of Reset secret word keep their buttons inside the panel and clear of each other at phone, landscape phone, iPad (both ways) and laptop sizes, touch on and off, with room to scroll; on touch every button is at least 44 px', hits.length === 0 && small.length === 0 && done.length === 70, { hits: hits.slice(0, 12), small: small.slice(0, 12), done: done.length }); }
    } catch (e) {
      check(P + 'the accounts self-test ran to the end without an exception', false, { error: String((e && e.stack) || e).slice(0, 800) });
    } finally {
      forget(); world.resetFail = null;
      NET.disconnect(); NET.emit('offline', { t: 'offline' }); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; NET.role = 'player';
      if (window.COOP) COOP.reset();
      window.__forceTouch = was.touch; try { window.innerWidth = was.vw; window.innerHeight = was.vh; } catch (e) { }
      ADMIN.state.tab = 'knights'; ADMIN.state.view = null;
      closePanel(); h.peace(was.peace); paused = was.paused; notice = was.notice;
      render();
    }
  });
}
