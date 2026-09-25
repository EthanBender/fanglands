// ============================================================================
// CHAT — talking to your friends.
// Owner: "make it an online MMORPG so Cohen and his friends can log in and play together."
// A real text box (a DOM <input>, so the iPad keyboard works and nothing is zoomed) opens with Enter or Y on a keyboard
// and with CHAT on the control rail on touch; a row of quick phrases sits above it, one tap each. What comes back from the world
// (docs/ONLINE.md: `chat`, already filtered and logged server-side) shows as a bubble over that knight's head for four
// seconds, as a fading strip of the last few lines on the left column of the HUD, and in a Chat log panel with the last thirty.
// While the box has the keyboard the game does not see a single key: a capturing listener on window stops them.
// Feature file: HOOKS only. Reads window.PLAYERS (73) for where the other knights are. window.CHAT is the handle.
// ============================================================================
{
  const MAX = 120;              // chars: the contract's cap (also trimmed client-side)
  const BUBBLE_S = 4;           // s: a bubble over a head
  const STRIP_S = 8;            // s: a line on the strip
  const STRIP_LINES = 4;
  const LOG_MAX = 30;
  const SEND_EVERY = 1.5;       // s: the contract's cap on chat
  const PHRASES = ['Hi!', 'Follow me', 'Help!', 'Look at this', 'Nice!', 'Where are you?', "Let's fight the boss", 'Bye!'];

  const log = [];               // [{ n, text, at, t }] oldest first, t = seconds left on the strip
  const bubbles = {};           // name → { text, t }
  let isOpen = false, lastSentAt = -1e9, dom = null, prevDialog = false;
  const clean = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, MAX);
  const me = () => NET.me;
  const remote = n => window.PLAYERS ? PLAYERS.remote[n] : null;
  const mapId = () => window.PLAYERS ? PLAYERS.mapId() : 'over';

  // ---------- the box: built once, on the first open; nothing is made where there is no document (headless) ----------
  // A DOM overlay (so the iPad keyboard works), dressed in the kit's materials in CSS: dark vellum with a gold hairline
  // 2.5 px inside its edge, a Cinzel label, the quick phrases as small leather tabs with a dashed stitch, a 16 px input
  // (iOS Safari zooms on anything smaller) and an iron Send plate. Every button and the input are at least 44 px tall.
  const SANS_CSS = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', CINZEL_CSS = '"Cinzel","Trajan Pro",Georgia,serif';
  const CSS = `
#chatbox{position:fixed;left:50%;bottom:max(16px,calc(env(safe-area-inset-bottom) + 8px));transform:translateX(-50%);width:min(560px,calc(100vw - 32px - env(safe-area-inset-left) - env(safe-area-inset-right)));box-sizing:border-box;display:none;flex-direction:column;gap:10px;z-index:20;padding:12px 14px 14px;background:linear-gradient(180deg,#31281e,#1d1712);border:1px solid rgba(0,0,0,.9);border-radius:5px;box-shadow:0 8px 30px rgba(0,0,0,.6);font-family:${SANS_CSS};color:#f4ead3}
#chatbox::before{content:"";position:absolute;inset:2.5px;border:1px solid rgba(217,178,92,.5);border-radius:3px;pointer-events:none}
#chatbox .fl-chat-head{font:800 12px ${CINZEL_CSS};letter-spacing:.06em;color:#d9b25c;text-shadow:0 1px 0 rgba(0,0,0,.9)}
#chatbox .fl-chat-tabs{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
#chatbox .fl-chat-tab{min-height:44px;padding:0 14px;font:700 15px ${SANS_CSS};color:#f4ead3;background:linear-gradient(180deg,#6d4a30,#48301e 55%,#24160c);border:1px solid rgba(0,0,0,.9);border-radius:6px;outline:1px dashed rgba(226,186,124,.6);outline-offset:-5px;box-shadow:0 3px 6px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12);text-shadow:0 1px 0 rgba(0,0,0,.9);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;appearance:none}
#chatbox .fl-chat-tab:hover{color:#f7dc8f}
#chatbox .fl-chat-tab:active{transform:translateY(1.5px);box-shadow:0 0 1px rgba(0,0,0,.6);background:linear-gradient(180deg,#48301e,#6d4a30)}
#chatbox .fl-chat-row{display:flex;gap:8px}
#chatbox .fl-chat-input{flex:1;min-width:0;min-height:44px;box-sizing:border-box;font-family:${SANS_CSS};font-size:16px;font-weight:600;line-height:20px;padding:10px 12px;color:#f4ead3;background:#14100c;border:1px solid rgba(217,178,92,.45);border-radius:4px;outline:none;-webkit-appearance:none;appearance:none}
#chatbox .fl-chat-input::placeholder{color:#8c8170}
#chatbox .fl-chat-input:focus{border-color:#d9b25c;box-shadow:0 0 0 2px rgba(217,178,92,.25)}
#chatbox .fl-chat-send{min-height:44px;min-width:84px;padding:0 16px;font:700 15px ${SANS_CSS};color:#f4ead3;background:linear-gradient(180deg,#2d3138,#16181c);border:1px solid rgba(0,0,0,.9);border-radius:6px;box-shadow:inset 0 0 0 1.5px rgba(217,178,92,.95),inset 0 2px 0 rgba(255,255,255,.08),0 3px 8px rgba(0,0,0,.6);text-shadow:0 1px 0 rgba(0,0,0,.9);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;appearance:none}
#chatbox .fl-chat-send:active{transform:translateY(1.5px);background:linear-gradient(180deg,#16181c,#2d3138);box-shadow:inset 0 0 0 1.5px rgba(217,178,92,.6)}`;
  function ensureDom() {
    if (dom !== null) return dom;
    if (typeof document === 'undefined' || !document.body || !document.head || typeof document.body.appendChild !== 'function' || typeof document.createElement !== 'function') { dom = false; return dom; }
    try {
      const style = document.createElement('style'); style.id = 'fl-chat-css'; style.textContent = CSS; document.head.appendChild(style);
      const box = document.createElement('div');
      box.id = 'chatbox';
      const head = document.createElement('div'); head.className = 'fl-chat-head'; head.textContent = 'SAY SOMETHING';
      const chips = document.createElement('div'); chips.className = 'fl-chat-tabs';
      let chipAt = -1e9;   // when a chip was last pressed: a blur right after one is the chip taking the tap, not the box being left
      // a tab or Send keeps the keyboard up: the press is swallowed, the click still comes
      const keepFocus = b => {
        b.addEventListener('pointerdown', ev => { chipAt = nowMs(); ev.preventDefault(); });
        b.addEventListener('mousedown', ev => ev.preventDefault());
        b.addEventListener('touchstart', () => { chipAt = nowMs(); }, { passive: true });
      };
      for (const p of PHRASES) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'fl-chat-tab'; b.textContent = p;
        keepFocus(b);
        b.addEventListener('click', ev => { ev.preventDefault(); send(p); });
        chips.appendChild(b);
      }
      const input = document.createElement('input');
      input.type = 'text'; input.className = 'fl-chat-input'; input.maxLength = MAX; input.autocomplete = 'off'; input.spellcheck = false;
      input.setAttribute('autocapitalize', 'sentences'); input.setAttribute('enterkeyhint', 'send'); input.setAttribute('aria-label', 'Chat');
      input.placeholder = 'Say something to your friends';
      const sendBtn = document.createElement('button'); sendBtn.type = 'button'; sendBtn.className = 'fl-chat-send'; sendBtn.textContent = 'Send';
      keepFocus(sendBtn);
      sendBtn.addEventListener('click', ev => { ev.preventDefault(); send(input.value); });
      const row = document.createElement('div'); row.className = 'fl-chat-row'; row.appendChild(input); row.appendChild(sendBtn);
      box.appendChild(head); box.appendChild(chips); box.appendChild(row); document.body.appendChild(box);
      dom = { box, chips, input, send: sendBtn };
      // focus leaving the box (Done on the iPad keyboard, a click on the world) closes it; a chip's tap does not
      input.addEventListener('blur', () => { setTimeout(() => { if (isOpen && dom && document.activeElement !== dom.input && nowMs() - chipAt > 600) close(); }, 150); });
      // the on-screen keyboard covers the bottom of the layout viewport: keep the box just above it
      const vv = window.visualViewport;
      if (vv && vv.addEventListener) { const place = () => { const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); box.style.bottom = covered > 0 ? (16 + covered) + 'px' : ''; }; vv.addEventListener('resize', place); vv.addEventListener('scroll', place); }
      // the guard: while the box has the keyboard, Enter sends, Escape closes, and no key reaches the game (05-input listens on window in the bubble phase; this runs first, in the capture phase, and stops the event there)
      const guard = e => {
        if (!dom || document.activeElement !== dom.input) return;
        if (e.type === 'keydown') { if (e.key === 'Enter') { e.preventDefault(); send(dom.input.value); } else if (e.key === 'Escape') { e.preventDefault(); close(); } }
        e.stopPropagation();
      };
      for (const t of ['keydown', 'keyup', 'keypress']) window.addEventListener(t, guard, true);
    } catch (e) { dom = false; }
    return dom;
  }
  function open() {
    if (isOpen) return;
    isOpen = true; keys.clear(); touch.taps.length = 0;
    const d = ensureDom();
    if (d) { d.box.style.display = 'flex'; try { d.input.focus(); } catch (e) { } }
    sfx('open');
  }
  function close() {
    isOpen = false;
    const d = ensureDom();
    if (d) { d.box.style.display = 'none'; try { d.input.blur(); } catch (e) { } }
  }
  // sends what was typed (or a quick phrase). The world echoes it back to everyone, us included: that echo is what makes our own bubble.
  function send(text) {
    const t = clean(text);
    if (!t) { close(); return false; }
    if (!NET.online()) { notify('You are not connected.'); return false; }
    if (time - lastSentAt < SEND_EVERY) { notify('Slow down a little.'); return false; }
    if (!NET.send({ t: 'chat', text: t })) { notify('That did not go through. Try again.'); return false; }
    lastSentAt = time;
    if (dom) dom.input.value = '';
    close();
    return true;
  }

  // ---------- in ----------
  NET.on('chat', m => {
    if (!m || typeof m.text !== 'string') return;
    const text = clean(m.text); if (!text) return;
    const n = typeof m.n === 'string' ? m.n : '?';
    bubbles[n] = { text, t: BUBBLE_S };
    log.push({ n, text, at: typeof m.at === 'number' ? m.at : Date.now(), t: STRIP_S }); while (log.length > LOG_MAX) log.shift();
    if (n !== me()) sfx('ui');
  });
  NET.on('offline', () => { for (const n in bubbles) delete bubbles[n]; });

  // ---------- keys, timers ----------
  HOOKS.update.push(dt => {
    for (const n in bubbles) { const b = bubbles[n]; b.t -= dt; if (b.t <= 0) delete bubbles[n]; }
    for (const l of log) if (l.t > 0) l.t -= dt;
    // Enter opens the box only when it would not be advancing a line of talk (the core handles that first, in the same tick, so remember whether a line was up last tick)
    if (NET.enabled && !paused && !player.dead && !panel && !isOpen && (pressed.has('KeyY') || (pressed.has('Enter') && !dialog.cur && !prevDialog))) open();
    prevDialog = !!dialog.cur;
  });
  HOOKS.keyHelp.push({ action: 'Chat', codes: ['KeyY', 'Enter'] }); // 43-settings lists it on the Controls line

  // ---------- bubbles over heads (world items, sorted last so they sit over everything) ----------
  // A small vellum plate with the kit's gold hairline and a pointer tooth, the words in the system sans (12 px, bold), up to
  // three lines of whole words; a word too long for a line (a run of letters with no space) is broken across lines.
  function bubbleLines(g, text, maxW, f, maxLines = 3) {
    const parts = [];
    for (const w of String(text).split(' ').filter(Boolean)) {
      if (HK.tw(g, w, f) <= maxW) { parts.push(w); continue; }
      let cur = ''; for (const ch of w) { if (cur && HK.tw(g, cur + ch, f) > maxW) { parts.push(cur); cur = ch; } else cur += ch; } if (cur) parts.push(cur);
    }
    const lines = []; let line = '';
    for (const p of parts) { const t = line ? line + ' ' + p : p; if (line && HK.tw(g, t, f) > maxW) { lines.push(line); line = p; if (lines.length === maxLines) break; } else line = t; }
    if (line && lines.length < maxLines) lines.push(line);
    return lines;
  }
  function drawBubble(g, b, x, y) {
    const a = clamp(b.t * 2, 0, 1), f = HK.FS(700, 12), lh = Math.round(15 * HK.k());
    g.save(); g.globalAlpha *= a;
    const lines = bubbleLines(g, b.text, 180, f); let w = 0; for (const l of lines) w = Math.max(w, HK.tw(g, l, f));
    const bw = Math.ceil(w) + 22, bh = 12 + lines.length * lh, bx = Math.round(x - bw / 2), by = Math.round(y - bh - 8);
    HK.vellumPlate(g, bx, by, bw, bh);
    // the tooth: vellum, its two outer edges in the plate's near-black outline and the gold hairline inside
    g.beginPath(); g.moveTo(x - 6, by + bh - 1); g.lineTo(x, by + bh + 7); g.lineTo(x + 6, by + bh - 1); g.closePath(); g.fillStyle = '#1d1712'; g.fill();
    g.beginPath(); g.moveTo(x - 6, by + bh); g.lineTo(x, by + bh + 7); g.lineTo(x + 6, by + bh); g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.moveTo(x - 3.5, by + bh - 2.5); g.lineTo(x, by + bh + 3); g.lineTo(x + 3.5, by + bh - 2.5); g.strokeStyle = 'rgba(217,178,92,0.5)'; g.stroke();
    lines.forEach((l, i) => HK.text(g, l, x, by + 6 + (i + 1) * lh - 3, { font: f, align: 'center', color: HK.T.ink, shadow: 'rgba(0,0,0,0.9)' }));
    g.restore();
    return { x: bx, y: by, w: bw, h: bh, lines };
  }
  HOOKS.draw.push((g, items) => {
    const my = mapId(), meN = me();
    for (const n in bubbles) {
      const b = bubbles[n]; let x, y;
      if (n === meN) { x = player.x; y = player.y - (player.mech ? 50 : 36); }
      else { const e = remote(n); if (!e || e.map !== my) continue; x = e.shown.x; y = e.shown.y - (e.mech ? 62 : 48); }
      if (x < cam.x - 120 || x > cam.x + VW + 120 || y < cam.y - 80 || y > cam.y + VH + 80) continue;
      items.push({ y: 1e9, bubble: n, draw: () => drawBubble(g, b, x, y) });
    }
  });

  // ---------- the strip, in the kit's chat lane, and the CHAT tile in the book ----------
  // The strip has its own lane (src/59-hudkit.js HK.lane('chat', n)): bottom-left on a computer, above the belt on an iPad
  // and a phone held sideways, full width above the belt on a phone held upright. Up to 4 / 2 / 1 thin sable lines,
  // "Name: text" with the name in friend blue, each fading 8 s after it was said; the lane hides while someone talks.
  // The whole strip is one tap (padded to 44 px) that opens the Chat log. CHAT itself is a tile in the Knight's Book.
  const LINE_H = 20;
  const liveLines = () => { const out = []; for (let i = log.length - 1; i >= 0 && out.length < STRIP_LINES; i--) if (log[i].t > 0) out.unshift(log[i]); return out; };
  // how many lines the strip wants this frame (the kit reserves the lane from it), capped by the lane's own maximum
  const stripLines = () => { if (!NET.enabled || paused || panel || (dialog && dialog.cur)) return 0; const L = HK.cur(); return Math.min(liveLines().length, L && L.chatMax || STRIP_LINES); };
  HOOKS.hud.push(g => {
    const n = stripLines(); if (!n) return;
    const lane = HK.lane('chat', n); if (!lane) return;
    const lines = liveLines().slice(-n);
    const top = lane.y + lane.h - n * LINE_H;
    lines.forEach((l, i) => {
      const y = top + i * LINE_H;
      g.save(); g.globalAlpha *= clamp(l.t / 1.5, 0, 1);
      const nf = HK.FS(700, 13), tf = HK.FS(600, 13), name = l.n + ':';
      const nw = HK.tw(g, name, nf), maxT = lane.w - 20 - nw - 6;
      let t = l.text; if (HK.tw(g, t, tf) > maxT) { const w = HK.wrap(g, t, maxT, 1, tf); t = w.lines[0] || ''; if (w.more) t += '…'; }
      const w = Math.min(lane.w, 20 + nw + 6 + HK.tw(g, t, tf));
      HK.rr(g, lane.x, y, w, LINE_H - 2, 4); g.fillStyle = 'rgba(20,15,13,0.78)'; g.fill(); g.strokeStyle = 'rgba(217,178,92,0.35)'; g.lineWidth = 1; g.stroke();
      HK.text(g, name, lane.x + 8, y + 14, { font: nf, color: l.n === me() ? HK.T.ink : HK.T.friend });
      HK.text(g, t, lane.x + 8 + nw + 6, y + 14, { font: tf, color: HK.T.ink });
      g.restore();
    });
    buttons.push({ x: lane.x, y: lane.y, w: lane.w, h: lane.h, label: 'chat:log', action: () => openPanel('chatlog'), up: true, name: 'The chat log', keys: ['Y'] });
  });
  // CHAT is a tile in the Knight's Book (the kit's twelve): it opens and closes the box, and it is lit while the box is open
  hudControl({ id: 'chat', sort: 45, label: () => 'CHAT', emblem: 'chat', key: 'Y', asleep: () => !NET.enabled, on: () => isOpen, action: () => { if (!NET.enabled) { notify('Chat is for the online game.'); return; } if (isOpen) close(); else open(); } });

  // ---------- the log panel ----------
  // The newest lines that fit, in one vellum plate with a gold hairline between lines: the name in friend blue (yours in
  // ink), the words in the system sans, wrapped whole (never cut). Say something and Friends are plates one kit row tall.
  HOOKS.panel.chatlog = (g, narrow) => {
    const room = panelRoom(narrow ? 400 : 520, VH), w = room.w, iw = w - 36, bh = HK.row();
    const nf = HK.FC(800, 12), tf = HK.FS(600, 13), lh = Math.round(17 * HK.k() * 10) / 10;
    const nameCol = Math.min(narrow ? 84 : 110, Math.max(60, iw * 0.28)), textW = iw - 24 - nameCol - 10;
    const top = 62, foot = bh + 26, pad = 8;
    const avail = room.h - top - foot - 2 * pad;
    // newest first, as many as fit; a name wider than its column takes a line of its own
    const rows = []; let used = 0;
    for (let i = log.length - 1; i >= 0; i--) {
      const l = log[i], own = HK.tw(g, l.n, nf) > nameCol, lines = bubbleLines(g, l.text, own ? iw - 24 : textW, tf, 4);
      const h = (own ? lh : 0) + lines.length * lh + 8;
      if (used + h > avail && rows.length) break;
      rows.unshift({ l, own, lines, h }); used += h;
    }
    const listH = Math.max(rows.length ? 40 : 2 * lh + 8, used) + 2 * pad, h = Math.min(room.h, top + listH + foot);
    const { px, py } = panelBox(g, w, h, 'Chat', log.length ? 'The last things your friends said, newest at the bottom.' : 'Nothing said yet.');
    const x0 = px + 18, T = HK.T;
    HK.vellumPlate(g, x0, py + top, iw, listH);
    if (!rows.length) HK.wrap(g, 'When a friend says something, it shows up here.', iw - 24, 2, tf).lines.forEach((l, i) => HK.text(g, l, x0 + 12, py + top + pad + 16 + i * lh, { font: tf, color: T.inkDim, box: { x: x0 + 12, y: py + top, w: iw - 24, h: listH }, fitId: 'chatlog:none' }));
    let y = py + top + pad;
    rows.forEach((r, k) => {
      const mine = r.l.n === me(), tx = r.own ? x0 + 12 : x0 + 12 + nameCol + 10;
      HK.text(g, r.l.n, x0 + 12, y + lh - 3, { font: nf, color: mine ? T.ink : T.friend, shadow: 'rgba(0,0,0,0.9)', box: r.own ? { x: x0 + 12, y, w: iw - 24, h: r.h } : { x: x0 + 12, y, w: nameCol, h: r.h }, fitId: 'chatlog:name' });
      r.lines.forEach((l, i) => HK.text(g, l, tx, y + (r.own ? lh : 0) + (i + 1) * lh - 3, { font: tf, color: T.ink, box: { x: tx, y, w: r.own ? iw - 24 : textW, h: r.h }, fitId: 'chatlog:text' }));
      if (k < rows.length - 1) { g.fillStyle = 'rgba(217,178,92,0.22)'; g.fillRect(x0 + 10, y + r.h - 1, iw - 20, 1); }
      y += r.h;
    });
    const by = py + h - bh - 14, sayL = touchMode() ? 'Say something' : 'Say something (Enter)';
    const fw = window.PLAYERS ? Math.min(140, Math.round(iw * 0.4)) : 0, sw = Math.min(iw - (fw ? fw + 10 : 0), touchMode() ? 190 : 200);
    platePush(g, x0, by, sw, bh, sayL, sayL, () => { closePanel(); open(); }, 'primary', { emblem: 'talk', name: 'Say something to your friends', keys: touchMode() ? [] : ['Enter'] });
    if (window.PLAYERS) platePush(g, x0 + sw + 10, by, fw, bh, 'Friends', 'Friends', () => openPanel('friends'), null, { emblem: 'friends', name: 'Friends online', keys: touchMode() ? [] : ['F'] });
  };

  window.CHAT = { open, close, send, isOpen: () => isOpen, bubbles, log, PHRASES, MAX, stripLines, CSS, drawBubble, bubbleLines };

  // ---------- self-test ----------
  const P = 'chat: ';
  HOOKS.selfTest.push((check, F, h) => {
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, touch: window.__forceTouch };
    const made = [];
    const fake = {
      call: async () => ({}),
      open: () => { const s = { readyState: 1, sent: [], send(str) { const m = JSON.parse(str); s.sent.push(m); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen' }) }); if (m.t === 'chat') s.onmessage({ data: JSON.stringify({ t: 'chat', n: 'Cohen', text: m.text, at: 5 }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; made.push(s); return s; },
    };
    NET.disconnect(); NET.enabled = true; NET.token = 'chat-test'; NET.useFake(fake); NET.connect();
    const sock = made[0], feed = m => sock.onmessage({ data: JSON.stringify(m) });
    const dc = dialog.cur, dq = dialog.queue.slice(); dialog.cur = null; dialog.queue.length = 0;
    closePanel(); close(); log.length = 0; for (const n in bubbles) delete bubbles[n]; lastSentAt = -1e9;
    const dead0 = player.dead; player.dead = false; h.peace(true); player.hp = player.maxHp;
    // a line from a friend: a bubble over their head, a line on the strip and in the log; trimmed and capped at 120
    { feed({ t: 'p', n: 'Ava', map: 'over', x: player.x + 40, y: player.y, fx: -1, fy: 0, mv: false, wt: 0, hp: 25, mhp: 25, lv: 7, look: null, mech: null, dead: false, def: 100, act: null });
      feed({ t: 'chat', n: 'Ava', text: '   hello   there  ', at: 3 }); feed({ t: 'chat', n: 'Ben', text: 'x'.repeat(200), at: 4 });
      F.step([]); render();
      const items = []; for (const hk of HOOKS.draw) hk(ctx, items, cam);
      const bub = items.find(it => it.bubble === 'Ava'); let drew = false; try { if (bub) { bub.draw(); drew = true; } } catch (e) { drew = String(e && e.message); }
      const hasStrip = buttons.some(b => b.label === 'chat:log');
      check(P + "a friend's line makes a bubble over their head (drawn) and a log line; text is trimmed and capped at 120", !!bubbles.Ava && bubbles.Ava.text === 'hello there' && !!bub && drew === true && log.length === 2 && log[0].text === 'hello there' && log[1].text.length === 120 && hasStrip, { bubble: bubbles.Ava && bubbles.Ava.text, drew, log: log.length, capped: log[1] && log[1].text.length, hasStrip }); }
    // sending: out on the wire, echoed back as our own bubble, no faster than one per 1.5 s; the log panel opens from the strip
    { const ok1 = send('  Hi there  '); const out = sock.sent.filter(m => m.t === 'chat'); const echoed = !!bubbles.Cohen && bubbles.Cohen.text === 'Hi there';
      const ok2 = send('again'); F.sim(100, []); const ok3 = send('again');
      render(); const strip = buttons.find(b => b.label === 'chat:log'); if (strip) strip.action(); const logOpen = panel === 'chatlog'; render(); const say = buttons.find(b => /^Say something/.test(b.label)); closePanel();
      check(P + 'a sent line goes out trimmed and comes back as our own bubble; a second within 1.5 s waits; the strip opens the log panel', ok1 && out.length === 1 && out[0].text === 'Hi there' && echoed && ok2 === false && ok3 && logOpen && !!say, { ok1, out: out.length, echoed, ok2, ok3, logOpen, say: !!say }); }
    // keys: Y opens the box, Enter opens it only when no line of talk is up, Escape (or send) closes
    { closePanel(); close(); F.press('KeyY'); const byY = isOpen; close();
      F.press('Enter'); const byEnter = isOpen; close();
      say('A test line, knight.', 'The Voice'); F.step([]); const up = !!dialog.cur; F.press('Enter'); const stayed = !isOpen; dialog.cur = null; dialog.queue.length = 0; F.step([]); F.step([]);
      check(P + 'Y opens the chat box; Enter opens it only when no line of talk is showing', byY && byEnter && up && stayed, { byY, byEnter, up, stayed }); }
    // touch: CHAT is an entry on the kit's control rail (drawn by the rail, where the rail says), and toggles the box
    { window.__forceTouch = true; closePanel(); paused = true; render(); const btn = buttons.find(b => b.label === 'CHAT'); const has = !!btn;
      const book = HK.FRAME.lastBook, tile = book && btn && book.tiles.find(c => Math.abs(c.x - btn.cx) < 0.5 && Math.abs(c.y - btn.cy) < 0.5);
      const inBook = !!tile && btn.r >= 22 && !buttons.some(b => b.label === 'chat:log');
      if (btn) btn.action(); const opened = isOpen && !paused; paused = true; render(); const lit = !!HK.bookTiles().find(t => t.id === 'chat' && t.on); if (btn) btn.action(); const closed = !isOpen;
      window.__forceTouch = false; paused = true; render(); const deskKey = HK.bookTiles().find(t => t.id === 'chat').key === 'Y' && buttons.some(b => b.label === 'CHAT' && (b.keys || []).includes('Y'));
      paused = false; window.__forceTouch = was.touch; render();
      check(P + 'CHAT is a tile in the Knight\'s Book with the other rarely-used controls: it toggles the box (lit while open), and on a computer it wears its key Y', has && inBook && opened && lit && closed && deskKey, { has, inBook, btn: btn && [btn.cx, btn.cy, btn.r], opened, lit, closed, deskKey }); }
    // fading: bubbles go after 4 s, strip lines after 8, the log keeps 30
    { feed({ t: 'chat', n: 'Ava', text: 'still here' }); F.sim(60 * 4.2, []); const bubbleGone = !bubbles.Ava; F.sim(60 * 4.2, []); const stripGone = !log.some(l => l.t > 0);
      for (let i = 0; i < 40; i++) feed({ t: 'chat', n: 'Ava', text: 'line ' + i }); const kept = log.length === LOG_MAX && log[LOG_MAX - 1].text === 'line 39';
      check(P + 'a bubble lasts 4 s, a strip line 8 s, and the log keeps the last 30', bubbleGone && stripGone && kept, { bubbleGone, stripGone, kept, log: log.length }); }
    // the Chat log at all 8 device sizes, touch and mouse, normal and Large text, empty and full of long lines: from the close
    // seal on, controls 44 px on touch (26 with a mouse), 8 px apart (4), on screen, out of the bands; every word in its plate
    { const restore = panelSizeSaver(), t0 = window.__forceTouch, text0 = SETTINGS.get('text'), problems = []; let tried = 0;
      const lines = [['Ava', 'Come and help me fight the boss'], ['Maximilian', 'It is by the old mill near the big oak tree past the river, hurry up everyone, it has lots of hit points'], ['Cohen', 'On my way'], ['Isabella', 'Supercalifragilisticexpialidocious and more words'], ['Ben', 'Nice!']];
      try {
        for (const [w, hh] of HK.audit.SIZES) {
          if (!panelSetSize(w, hh)) continue; tried++;
          for (const tch of [true, false]) for (const big of ['normal', 'large']) for (const full of [false, true]) {
            window.__forceTouch = tch; SETTINGS.set('text', big); log.length = 0;
            if (full) for (let i = 0; i < 30; i++) { const [n, text] = lines[i % lines.length]; log.push({ n, text, at: i, t: 0 }); }
            closePanel(); openPanel('chatlog');
            const where = `chatlog ${w}x${hh} ${tch ? 'touch' : 'mouse'} ${big} ${full ? 'full' : 'empty'}`;
            problems.push(...panelFrame(where));
            if (!buttons.some(b => /^Say something/.test(b.label)) || !buttons.some(b => b.label === 'Friends')) problems.push(`${where}: Say something or Friends is missing`);
          }
        }
      } finally { closePanel(); log.length = 0; window.__forceTouch = t0; SETTINGS.set('text', text0); restore(); render(); }
      const src = String(HOOKS.panel.chatlog), dots = !/\u2026|…/.test(src);
      check(P + "the Chat log at all 8 device sizes, touch and mouse, normal and Large text, empty and full: Say something and Friends 44 px on touch (26 with a mouse) and 8 px apart (4), on screen, out of the bands; names and words whole inside the vellum (no '...')", tried === 8 && problems.length === 0 && dots, { tried, dots, problems: problems.slice(0, 10), total: problems.length }); }
    // a bubble: vellum (#31281e to #1d1712) with the gold hairline, no blue outline, the system sans, at most three lines,
    // the pointer tooth under it; a run of letters longer than a line is broken, never cut or dotted
    { const sets = [], stops = [], texts = [];
      const rec = new Proxy({}, {
        get: (tg, k) => k === 'measureText' ? (str => ({ width: String(str).length * 6.5 })) : (k === 'fillText' || k === 'strokeText') ? (str => { if (k === 'fillText') texts.push(String(str)); })
          : (k === 'createLinearGradient' || k === 'createRadialGradient') ? (() => ({ addColorStop: (o, c) => stops.push(String(c)) })) : k === 'createPattern' ? (() => null) : typeof k === 'string' ? (() => { }) : undefined,
        set: (tg, k, v) => { sets.push([k, String(v)]); return true; },
      });
      HK.setCacheOff(true);
      let r1, r2;
      try { r1 = drawBubble(rec, { text: 'word '.repeat(80).trim(), t: 3 }, 200, 200); const n1 = texts.length; r2 = drawBubble(rec, { text: 'x'.repeat(60), t: 3 }, 200, 200); r2.n = texts.length - n1; } finally { HK.setCacheOff(false); }
      const vellum = stops.includes('#31281e') && stops.includes('#1d1712'), hair = sets.some(([k, v]) => k === 'strokeStyle' && /217,\s*178,\s*92/.test(v));
      const blue = sets.some(([k, v]) => k === 'strokeStyle' && /#7ec8ff|#6fb1ff|126,\s*200,\s*255/i.test(v)), sans = sets.some(([k, v]) => k === 'font' && /-apple-system/.test(v) && /12/.test(v));
      const three = r1.lines.length === 3 && r2.n >= 1 && r2.lines.join('') === 'x'.repeat(60).slice(0, r2.lines.join('').length) && r2.lines.every(l => l.length * 6.5 <= 180) && !texts.some(t => /…/.test(t));
      check(P + 'a chat bubble is a vellum plate with the gold hairline (no blue outline), in the system sans, three lines at most, with its pointer tooth; an over-long word breaks across lines instead of being cut', vellum && hair && !blue && sans && three, { vellum, hair, blue, sans, lines1: r1.lines.length, lines2: r2.lines }); }
    // the chat box (HTML): its phrases, Send and the input are at least 44 px tall and the input is 16 px (so iOS does not zoom);
    // read from its stylesheet (headless has no DOM), and measured live where there is a document
    { const rule = sel => { const m = CSS.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}')); return m ? m[1] : ''; };
      const px = (r, prop) => { const m = new RegExp('(?:^|;)' + prop + ':(\\d+(?:\\.\\d+)?)px').exec(r); return m ? +m[1] : 0; };
      const tab = rule('#chatbox .fl-chat-tab'), inp = rule('#chatbox .fl-chat-input'), snd = rule('#chatbox .fl-chat-send'), box = rule('#chatbox');
      const css = px(tab, 'min-height') >= 44 && px(inp, 'min-height') >= 44 && px(inp, 'font-size') >= 16 && px(snd, 'min-height') >= 44 && /#31281e/.test(box) && /217,178,92,\.5/.test(rule('#chatbox::before')) && /dashed rgba\(226,186,124,\.6\)/.test(tab) && /#6d4a30/.test(tab);
      let live = 'no DOM';
      const d = ensureDom();
      if (d) { const was0 = d.box.style.display; d.box.style.display = 'flex'; try { const hs = [...d.box.querySelectorAll('button,input')].map(e => e.getBoundingClientRect().height); live = hs.length === PHRASES.length + 2 && hs.every(v => v >= 44) && parseFloat(getComputedStyle(d.input).fontSize) >= 16; } finally { d.box.style.display = was0; } }
      check(P + 'the chat box: vellum with a gold hairline, leather phrase tabs with a dashed stitch; every phrase, Send and the input at least 44 px tall and the input 16 px', css && live !== false, { css, live, tab: tab.slice(0, 50), inp: inp.slice(0, 50) }); }
    // put the world back
    close(); log.length = 0; for (const n in bubbles) delete bubbles[n]; lastSentAt = -1e9; prevDialog = false;
    NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
    player.dead = dead0; dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq); closePanel(); h.peace(false); render();
  });
}
