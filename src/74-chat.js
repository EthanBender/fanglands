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

  // ---------- the strip on the HUD kit's left column, and the CHAT control on the rail ----------
  // The strip is a readout, so it lives where every other readout lives: HK.slot() gives it the next rows of the left
  // column at the column's width, under the ONLINE chip. That is what keeps it off the rail (on a landscape phone the
  // column wraps into the second one BELOW the rail), off the thumb cluster and out of the joystick's circle — it used
  // to be placed by hand at the bottom-left, 360 px wide, and ran across MUSIC, QUESTS and CRAFT. A tap on it opens
  // the log, so its tap area is at least one kit row tall (44 px on touch) even when only one line is showing.
  const LINE_H = 16;
  HOOKS.hud.push(g => {
    if (paused || panel) return;
    const live = []; for (let i = log.length - 1; i >= 0 && live.length < STRIP_LINES; i--) if (log[i].t > 0) live.unshift(log[i]);
    if (!live.length) return;
    const was = { y: HUD.leftY, col: HUD.leftCol };
    const s = HK.slot(Math.max(live.length * LINE_H, HK.row()));
    // the column can hold fewer lines than there are (a boss bar and a machine above it on a landscape phone):
    // show the newest that fit, and nothing at all if not even one tap-sized row fits
    const room = HK.colLimit(HUD.leftCol || 0) - s.y, n = Math.min(live.length, Math.floor(room / LINE_H)), h = Math.max(n * LINE_H, HK.row());
    // With the stick moved to the right on a landscape phone, the second column runs down beside it: the strip stops
    // short of the joystick's circle rather than lying across it
    let w = s.w;
    const st = HK.stickRect();
    if (HK.touch() && s.y < st.y + st.h && st.y < s.y + h && s.x < st.x + st.w && st.x < s.x + w) w = st.x - HK.GUT - s.x;
    if (n < 1 || h > room || w < 160) { HUD.leftY = was.y; HUD.leftCol = was.col; return; }
    HUD.leftY = s.y + h + HK.gutV();
    const lines = live.slice(-n);
    g.textAlign = 'left';
    lines.forEach((l, i) => {
      const y = s.y + i * LINE_H;
      g.globalAlpha = clamp(l.t / 1.5, 0, 1);
      HK.plate(g, s.x, y, w, LINE_H - 1, { r: 4 });
      // names in the kit's INK, what they said in its DIM: text is never a colour of its own
      g.font = 'bold 12px sans-serif'; g.fillStyle = HK.C.INK; const name = l.n + ':'; g.fillText(name, s.x + 6, y + 12);
      const nw = g.measureText(name).width; g.font = '12px sans-serif'; g.fillStyle = HK.C.DIM;
      let t = l.text; const maxW = w - 12 - nw - 6; while (g.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -2) + '…';
      g.fillText(t, s.x + 6 + nw + 5, y + 12);
    });
    g.globalAlpha = 1;
    buttons.push({ x: s.x, y: s.y, w, h, label: 'chat:log', action: () => openPanel('chatlog') });
  });
  // CHAT on touch is an entry on the kit's control rail (under the minimap; the second column on a landscape phone), not
  // a disc of its own: the thumb cluster's six seats are all taken (HK.thumbSeat), and the last hand-placed disc at
  // (VW-250, VH-200) sat on top of WIKI on a landscape phone and inside the joystick on a tall one. The rail lays
  // it out with the others, draws it in the kit's control style and lights it while the box is open.
  hudControl({ id: 'chat', sort: 45, label: () => 'CHAT', show: () => touchMode() && NET.enabled && !paused, on: () => isOpen, action: () => { if (isOpen) close(); else open(); } });

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

  window.CHAT = { open, close, send, isOpen: () => isOpen, bubbles, log, PHRASES, MAX };

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
    { window.__forceTouch = true; closePanel(); render(); const btn = buttons.find(b => b.label === 'CHAT'); const has = !!btn;
      const rail = HK.railCells(), cell = rail && rail.cells.find(c => c.def.id === 'chat');
      const onRail = !!cell && !!btn && btn.x === cell.x && btn.y === cell.y && btn.w === cell.w && btn.h === cell.h;
      if (btn) btn.action(); const opened = isOpen; render(); const lit = !!cell && cell.def.on(); if (btn) btn.action(); const closed = !isOpen;
      window.__forceTouch = false; render(); const deskHidden = !buttons.some(b => b.label === 'CHAT');
      window.__forceTouch = was.touch; render();
      check(P + 'in touch mode a CHAT control sits on the control rail with the other rarely-used controls and toggles the box (lit while it is open)', has && onRail && opened && lit && closed && deskHidden, { has, onRail, cell: cell && [cell.x, cell.y, cell.w, cell.h], btn: btn && [btn.x, btn.y, btn.w, btn.h], opened, lit, closed, deskHidden }); }
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
