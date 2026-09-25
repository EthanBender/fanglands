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
  const BLUE = '#7ec8ff';

  const log = [];               // [{ n, text, at, t }] oldest first, t = seconds left on the strip
  const bubbles = {};           // name → { text, t }
  let isOpen = false, lastSentAt = -1e9, dom = null, prevDialog = false;
  const clean = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, MAX);
  const me = () => NET.me;
  const remote = n => window.PLAYERS ? PLAYERS.remote[n] : null;
  const mapId = () => window.PLAYERS ? PLAYERS.mapId() : 'over';

  // ---------- the box: built once, on the first open; nothing is made where there is no document (headless) ----------
  function ensureDom() {
    if (dom !== null) return dom;
    if (typeof document === 'undefined' || !document.body || typeof document.body.appendChild !== 'function' || typeof document.createElement !== 'function') { dom = false; return dom; }
    try {
      const box = document.createElement('div');
      box.id = 'chatbox';
      box.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);width:min(560px,calc(100vw - 32px));display:none;flex-direction:column;gap:8px;z-index:20;font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif;';
      const chips = document.createElement('div');
      chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;';
      let chipAt = -1e9;   // when a chip was last pressed: a blur right after one is the chip taking the tap, not the box being left
      for (const p of PHRASES) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = p;
        b.style.cssText = 'font:600 14px "Trebuchet MS","Segoe UI",system-ui,sans-serif;color:#e6edf3;background:rgba(10,14,22,0.92);border:1px solid #30363d;border-radius:16px;padding:7px 12px;cursor:pointer;touch-action:manipulation;';
        b.addEventListener('pointerdown', ev => { chipAt = nowMs(); ev.preventDefault(); });   // the input keeps the keyboard; the click still comes
        b.addEventListener('mousedown', ev => ev.preventDefault());
        b.addEventListener('touchstart', () => { chipAt = nowMs(); }, { passive: true });
        b.addEventListener('click', ev => { ev.preventDefault(); send(p); });
        chips.appendChild(b);
      }
      const input = document.createElement('input');
      input.type = 'text'; input.maxLength = MAX; input.autocomplete = 'off'; input.spellcheck = false;
      input.setAttribute('autocapitalize', 'sentences'); input.setAttribute('enterkeyhint', 'send'); input.setAttribute('aria-label', 'Chat');
      input.placeholder = 'Say something to your friends';
      input.style.cssText = 'font:16px "Trebuchet MS","Segoe UI",system-ui,sans-serif;color:#e6edf3;background:rgba(10,14,22,0.95);border:1px solid #58a6ff;border-radius:10px;padding:10px 12px;outline:none;width:100%;box-sizing:border-box;';
      box.appendChild(chips); box.appendChild(input); document.body.appendChild(box);
      dom = { box, chips, input };
      // focus leaving the box (Done on the iPad keyboard, a click on the world) closes it; a chip's tap does not
      input.addEventListener('blur', () => { setTimeout(() => { if (isOpen && dom && document.activeElement !== dom.input && nowMs() - chipAt > 600) close(); }, 150); });
      // the on-screen keyboard covers the bottom of the layout viewport: keep the box just above it
      const vv = window.visualViewport;
      if (vv && vv.addEventListener) { const place = () => { const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); box.style.bottom = (16 + covered) + 'px'; }; vv.addEventListener('resize', place); vv.addEventListener('scroll', place); }
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
  function wrapLines(g, text, maxW) {
    const words = text.split(' '), lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; if (lines.length === 3) break; }
    if (line && lines.length < 3) lines.push(line);
    return lines;
  }
  function drawBubble(g, b, x, y) {
    const a = clamp(b.t * 2, 0, 1);
    g.save(); g.globalAlpha = a; g.font = 'bold 12px sans-serif'; g.textAlign = 'center';
    const lines = wrapLines(g, b.text, 180); let w = 0; for (const l of lines) w = Math.max(w, g.measureText(l).width);
    const bw = Math.ceil(w) + 18, bh = 10 + lines.length * 15, bx = Math.round(x - bw / 2), by = Math.round(y - bh - 8);
    roundRect(g, bx, by, bw, bh, 8); g.fillStyle = 'rgba(10,14,22,0.92)'; g.fill(); g.strokeStyle = BLUE; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = 'rgba(10,14,22,0.92)'; g.beginPath(); g.moveTo(x - 5, by + bh - 1); g.lineTo(x, by + bh + 6); g.lineTo(x + 5, by + bh - 1); g.closePath(); g.fill();
    g.strokeStyle = BLUE; g.beginPath(); g.moveTo(x - 5, by + bh); g.lineTo(x, by + bh + 6); g.lineTo(x + 5, by + bh); g.stroke();
    g.fillStyle = '#e6edf3'; lines.forEach((l, i) => g.fillText(l, x, by + 17 + i * 15));
    g.restore();
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
  HOOKS.panel.chatlog = (g, narrow) => {
    const lh = 22, per = Math.max(3, Math.min(LOG_MAX, Math.floor((VH - 20 - 128 - HK.row()) / lh)));
    const lines = log.slice(-per);
    const w = narrow ? Math.min(VW - 20, 400) : 520, h = Math.min(VH - 20, 118 + HK.row() + Math.max(1, lines.length) * lh);
    const { px, py } = panelBox(g, w, h, 'Chat', lines.length ? 'The last things your friends said, newest at the bottom.' : 'Nothing said yet.');
    let y = py + 76;
    g.font = '12px sans-serif';
    for (const l of lines) {
      const mine = l.n === me();
      g.textAlign = 'left'; g.font = 'bold 12px sans-serif'; g.fillStyle = mine ? '#e6edf3' : BLUE; g.fillText(l.n, px + 18, y + 8);
      const nw = Math.max(g.measureText(l.n).width, narrow ? 60 : 90);
      g.font = '12px sans-serif'; g.fillStyle = '#c9d1d9'; let t = l.text; const maxW = w - 36 - nw - 10; while (g.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -2) + '…'; g.fillText(t, px + 18 + nw + 10, y + 8);
      y += lh;
    }
    // one kit row tall (HK.row(): 44 px on touch), like every control
    const bh = HK.row(), by = py + h - bh - 14;
    button(g, px + 18, by, 140, bh, touchMode() ? 'Say something' : 'Say something (Enter)', () => { closePanel(); open(); });
    if (window.PLAYERS) button(g, px + 18 + 148, by, 90, bh, 'Friends', () => openPanel('friends'), '#21262d');
  };

  window.CHAT = { open, close, send, isOpen: () => isOpen, bubbles, log, PHRASES, MAX, stripLines };

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
    // put the world back
    close(); log.length = 0; for (const n in bubbles) delete bubbles[n]; lastSentAt = -1e9; prevDialog = false;
    NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
    player.dead = dead0; dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq); closePanel(); h.peace(false); render();
  });
}
