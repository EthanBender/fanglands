// ============================================================================
// CHAT — talking to your friends.
// Owner: "make it an online MMORPG so Cohen and his friends can log in and play together."
// A real text box (a DOM <input>, so the iPad keyboard works and nothing is zoomed) opens with Enter or Y on a keyboard
// and with the CHAT button on touch; a row of quick phrases sits above it, one tap each. What comes back from the world
// (docs/ONLINE.md: `chat`, already filtered and logged server-side) shows as a bubble over that knight's head for four
// seconds, as a fading strip of the last few lines at the bottom-left, and in a Chat log panel with the last thirty.
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
  const GOLD = '#f5c542';       // an admin's name and bubble (docs/ONLINE.md, "Roles"); also CHAT.system's default colour
  const MUTE_RED = '#ff9b8f';   // the lines about being muted
  const REPLY_MS = 5000;        // a 'muted' this soon after a line went out is the world refusing that line

  const log = [];               // [{ n, text, at, t, role }] oldest first, t = seconds left on the strip; a system line has n null and a colour
  const bubbles = {};           // name → { text, t, role }
  let isOpen = false, lastSentAt = -1e9, dom = null, prevDialog = false;
  // muted: nowMs() when the chat comes back on, Infinity until an admin turns it back on, 0 when it is on
  let mutedUntil = 0, lastLineAt = -1e9;
  const clean = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, MAX);
  const me = () => NET.me;
  const remote = n => window.PLAYERS ? PLAYERS.remote[n] : null;
  const mapId = () => window.PLAYERS ? PLAYERS.mapId() : 'over';
  const roleOf = m => (m && m.role === 'admin' ? 'admin' : 'player');
  // an admin's name in gold; your own in white; everyone else's blue
  const nameColour = l => l.role === 'admin' ? GOLD : l.n === me() ? '#e6edf3' : BLUE;

  // ---------- muted (docs/ONLINE.md, "Moderation from inside the game") ----------
  const isMuted = () => mutedUntil === Infinity || nowMs() < mutedUntil;
  // seconds under a minute, minutes under an hour, hours under a day, then days; always rounded up
  const amount = secs => {
    const s = Math.max(1, Math.ceil(secs));
    const [n, unit] = s < 60 ? [s, 'second'] : s < 3600 ? [Math.ceil(s / 60), 'minute'] : s < 86400 ? [Math.ceil(s / 3600), 'hour'] : [Math.ceil(s / 86400), 'day'];
    return { n, unit: unit + (n === 1 ? '' : 's') };
  };
  const mutedSentence = left => { if (left === -1) return 'An admin muted you. Your chat is off until an admin turns it back on.'; const a = amount(left); return `An admin muted you for ${a.n} ${a.unit}. You can still play; your chat is off until then.`; };
  const cantChatSentence = () => { if (mutedUntil === Infinity) return "You can't chat until an admin turns it back on."; const a = amount((mutedUntil - nowMs()) / 1000); return `You can't chat for ${a.n} more ${a.unit}.`; };
  // a line with no name, in its own colour, on the strip and in the log; no bubble (the party file says "Sam found a purple party hat!" with it)
  function system(text, color = GOLD) {
    const t = clean(text); if (!t) return false;
    log.push({ n: null, text: t, at: Date.now(), t: STRIP_S, color: typeof color === 'string' ? color : GOLD, role: null }); while (log.length > LOG_MAX) log.shift();
    return true;
  }

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
    // muted: nothing goes out at all (the quick phrases come through here too)
    if (isMuted()) { notify(cantChatSentence()); return false; }
    if (time - lastSentAt < SEND_EVERY) { notify('Slow down a little.'); return false; }
    if (!NET.send({ t: 'chat', text: t })) { notify('That did not go through. Try again.'); return false; }
    lastSentAt = time; lastLineAt = nowMs();
    if (dom) dom.input.value = '';
    close();
    return true;
  }

  // ---------- in ----------
  NET.on('chat', m => {
    if (!m || typeof m.text !== 'string') return;
    const text = clean(m.text); if (!text) return;
    const n = typeof m.n === 'string' ? m.n : '?', role = roleOf(m);
    bubbles[n] = { text, t: BUBBLE_S, role };
    log.push({ n, text, at: typeof m.at === 'number' ? m.at : Date.now(), t: STRIP_S, role }); while (log.length > LOG_MAX) log.shift();
    if (n !== me()) sfx('ui');
    // our own line came back: the world took it, so a muted after this is news, not a refusal
    else lastLineAt = -1e9;
  });
  NET.on('offline', () => { for (const n in bubbles) delete bubbles[n]; });
  // muted: `left` whole seconds, or -1 until an admin unmutes. Right after a line went out it is the world refusing that line;
  // otherwise it is news (a fresh mute, or the reminder after a welcome) and is said once.
  NET.on('muted', m => {
    if (!m || typeof m.left !== 'number' || !(m.left === -1 || m.left >= 0)) return;
    const reply = nowMs() - lastLineAt < REPLY_MS; lastLineAt = -1e9;
    mutedUntil = m.left === -1 ? Infinity : nowMs() + m.left * 1000;
    const text = reply ? cantChatSentence() : mutedSentence(m.left);
    // the strip is one short line an entry: the news goes in as its two sentences, the notice carries it whole
    if (!reply) { const cut = text.indexOf('. '); for (const part of cut > 0 ? [text.slice(0, cut + 1), text.slice(cut + 2)] : [text]) system(part, MUTE_RED); }
    notify(text);
  });
  NET.on('unmuted', () => { mutedUntil = 0; system('An admin turned your chat back on.', MUTE_RED); notify('An admin turned your chat back on.'); });
  // a new session starts unmuted; the world follows its welcome with a muted if the knight still is
  NET.on('welcome', () => { mutedUntil = 0; lastLineAt = -1e9; });

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
    // an admin's bubble has a gold outline
    const edge = b.role === 'admin' ? GOLD : BLUE;
    roundRect(g, bx, by, bw, bh, 8); g.fillStyle = 'rgba(10,14,22,0.92)'; g.fill(); g.strokeStyle = edge; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = 'rgba(10,14,22,0.92)'; g.beginPath(); g.moveTo(x - 5, by + bh - 1); g.lineTo(x, by + bh + 6); g.lineTo(x + 5, by + bh - 1); g.closePath(); g.fill();
    g.strokeStyle = edge; g.beginPath(); g.moveTo(x - 5, by + bh); g.lineTo(x, by + bh + 6); g.lineTo(x + 5, by + bh); g.stroke();
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

  // ---------- the strip at the bottom-left, and the CHAT touch button ----------
  function stripBox() {
    const lay = HUD_LAYOUT, lh = 16;
    let bottom, top = 84;
    if (!isTouch) bottom = VH - 44;
    else if (lay.short) { bottom = VH - 186; top = lay.questH ? lay.questY + lay.questH + 6 : 84; }
    else bottom = window.__stickRight === true ? VH - 300 : VH - 190;
    const w = !isTouch ? Math.min(360, Math.floor(VW / 2 - (5 * 50 + 60) / 2) - 20 - 14) : Math.min(360, VW - 28);
    const n = Math.max(0, Math.min(STRIP_LINES, Math.floor((bottom - top) / lh)));
    return { x: 14, w, bottom, lh, n };
  }
  // the strip: the last few lines, fading out; a tap on it opens the log. A system line has no name and its own colour.
  function drawStrip(g) {
    const live = []; for (let i = log.length - 1; i >= 0 && live.length < STRIP_LINES; i--) if (log[i].t > 0) live.unshift(log[i]);
    const sb = stripBox();
    if (!(live.length && sb.w >= 120 && sb.n > 0 && !panel)) return;
    const lines = live.slice(-sb.n); const y0 = sb.bottom - lines.length * sb.lh;
    g.font = '12px sans-serif'; g.textAlign = 'left';
    lines.forEach((l, i) => {
      const y = y0 + i * sb.lh, a = clamp(l.t / 1.5, 0, 1);
      g.globalAlpha = a; roundRect(g, sb.x, y, sb.w, sb.lh - 1, 4); g.fillStyle = 'rgba(10,14,22,0.7)'; g.fill();
      let nw = -5;
      if (l.n !== null) { g.font = 'bold 12px sans-serif'; g.fillStyle = nameColour(l); const name = l.n + ':'; g.fillText(name, sb.x + 6, y + 12); nw = g.measureText(name).width; }
      g.font = l.n === null ? 'bold 12px sans-serif' : '12px sans-serif'; g.fillStyle = l.n === null ? l.color : '#e6edf3';
      let t = l.text; const maxW = sb.w - 12 - nw - 6; while (g.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -2) + '…';
      g.fillText(t, sb.x + 6 + nw + 5, y + 12);
    });
    g.globalAlpha = 1;
    buttons.push({ x: sb.x, y: y0, w: sb.w, h: lines.length * sb.lh, label: 'chat:log', action: () => openPanel('chatlog') });
  }
  HOOKS.hud.push(g => {
    if (paused) return;
    drawStrip(g);
    // the CHAT button on touch: a third column left of QUESTS, in the same round style as the core's buttons (10-hud)
    if (!touchMode() || !NET.enabled) return;
    const mx = x => window.__stickRight === true ? VW - x : x;
    const r = 52, x = mx(VW - 250), y = VH - 200;
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.arc(x, y, r / 2 + 8, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText('CHAT', x, y + 4);
    buttons.push({ x: x - r / 2 - 8, y: y - r / 2 - 8, w: r + 16, h: r + 16, label: 'CHAT', action: () => { if (isOpen) close(); else open(); } });
  });

  // ---------- the log panel ----------
  HOOKS.panel.chatlog = (g, narrow) => {
    const lh = 22, per = Math.max(3, Math.min(LOG_MAX, Math.floor((VH - 20 - 160) / lh)));
    const lines = log.slice(-per);
    const w = narrow ? Math.min(VW - 20, 400) : 520, h = Math.min(VH - 20, 150 + Math.max(1, lines.length) * lh);
    const { px, py } = panelBox(g, w, h, 'Chat', lines.length ? 'The last things your friends said, newest at the bottom.' : 'Nothing said yet.');
    let y = py + 76;
    g.font = '12px sans-serif';
    for (const l of lines) {
      g.textAlign = 'left';
      // a system line runs the whole width in its own colour; a knight's line has the name first (gold for an admin)
      if (l.n === null) { g.font = 'bold 12px sans-serif'; g.fillStyle = l.color; let t = l.text; const maxW = w - 36; while (g.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -2) + '…'; g.fillText(t, px + 18, y + 8); y += lh; continue; }
      g.font = 'bold 12px sans-serif'; g.fillStyle = nameColour(l); g.fillText(l.n, px + 18, y + 8);
      const nw = Math.max(g.measureText(l.n).width, narrow ? 60 : 90);
      g.font = '12px sans-serif'; g.fillStyle = '#c9d1d9'; let t = l.text; const maxW = w - 36 - nw - 10; while (g.measureText(t).width > maxW && t.length > 4) t = t.slice(0, -2) + '…'; g.fillText(t, px + 18 + nw + 10, y + 8);
      y += lh;
    }
    button(g, px + 18, py + h - 46, 140, 32, touchMode() ? 'Say something' : 'Say something (Enter)', () => { closePanel(); open(); });
    if (window.PLAYERS) button(g, px + 18 + 148, py + h - 46, 90, 32, 'Friends', () => openPanel('friends'), '#21262d');
  };

  window.CHAT = {
    open, close, send, system, isOpen: () => isOpen, bubbles, log, PHRASES, MAX,
    // seconds of mute left: 0 when the chat is on, -1 until an admin turns it back on
    muted: () => mutedUntil === Infinity ? -1 : isMuted() ? Math.ceil((mutedUntil - nowMs()) / 1000) : 0,
  };

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
    // touch: a CHAT button beside the others
    { window.__forceTouch = true; closePanel(); render(); const btn = buttons.find(b => b.label === 'CHAT'); const has = !!btn;
      if (btn) btn.action(); const opened = isOpen; if (btn) btn.action(); const closed = !isOpen; window.__forceTouch = was.touch; render();
      check(P + 'in touch mode a CHAT button sits with the other round buttons and toggles the box', has && opened && closed, { has, opened, closed }); }
    // fading: bubbles go after 4 s, strip lines after 8, the log keeps 30
    { feed({ t: 'chat', n: 'Ava', text: 'still here' }); F.sim(60 * 4.2, []); const bubbleGone = !bubbles.Ava; F.sim(60 * 4.2, []); const stripGone = !log.some(l => l.t > 0);
      for (let i = 0; i < 40; i++) feed({ t: 'chat', n: 'Ava', text: 'line ' + i }); const kept = log.length === LOG_MAX && log[LOG_MAX - 1].text === 'line 39';
      check(P + 'a bubble lasts 4 s, a strip line 8 s, and the log keeps the last 30', bubbleGone && stripGone && kept, { bubbleGone, stripGone, kept, log: log.length }); }
    // a canvas that remembers what was written and in which colour, and what colour each outline was
    const rec = [], strokes = [], st = {};
    const g2 = new Proxy(st, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : k === 'fillText' ? ((s) => { rec.push({ text: String(s), fill: st.fillStyle }); }) : k === 'stroke' ? () => { strokes.push(st.strokeStyle); } : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in st ? st[k] : () => { }), set: (t, k, v) => { st[k] = v; return true; } });
    // roles on lines: an admin's name is gold on the strip and in the log and their bubble outline is gold; anything else is a player
    { close(); closePanel(); log.length = 0; for (const n in bubbles) delete bubbles[n];
      feed({ t: 'chat', n: 'Mud', text: 'hello all', at: 7, role: 'admin' }); feed({ t: 'chat', n: 'Ava', text: 'hi Mud', at: 8, role: 'bogus' });
      const roles = log.length === 2 && log[0].role === 'admin' && log[1].role === 'player' && bubbles.Mud.role === 'admin' && bubbles.Ava.role === 'player';
      drawStrip(g2); const strip = rec.splice(0);
      const goldStrip = strip.some(t => t.text === 'Mud:' && t.fill === GOLD) && strip.some(t => t.text === 'Ava:' && t.fill === BLUE);
      openPanel('chatlog'); HOOKS.panel.chatlog(g2, false); const inLog = rec.splice(0); closePanel();
      const goldLog = inLog.some(t => t.text === 'Mud' && t.fill === GOLD) && inLog.some(t => t.text === 'Ava' && t.fill === BLUE);
      strokes.length = 0; drawBubble(g2, bubbles.Mud, 100, 100); const mudEdge = strokes.slice(); strokes.length = 0; drawBubble(g2, bubbles.Ava, 100, 100); const avaEdge = strokes.slice();
      const goldBubble = mudEdge.length > 0 && mudEdge.every(c => c === GOLD) && avaEdge.length > 0 && avaEdge.every(c => c === BLUE);
      check(P + "roles: an admin's chat name is gold on the strip and in the log and their bubble outline is gold; a line whose role is not 'admin' reads as a player's", roles && goldStrip && goldLog && goldBubble, { roles, goldStrip, goldLog, goldBubble, strip: strip.map(t => t.text + '=' + t.fill) }); rec.length = 0; }
    // muted: said once, nothing goes out while muted (the quick phrases neither), the time left in plain words, unmuted, a refusal, a new session
    { close(); closePanel(); log.length = 0; for (const n in bubbles) delete bubbles[n]; lastSentAt = -1e9; lastLineAt = -1e9; mutedUntil = 0; notice = null;
      const chats = () => sock.sent.filter(m => m.t === 'chat').length, c0 = chats();
      feed({ t: 'muted', left: 300 });
      const told = !!notice && notice.text === 'An admin muted you for 5 minutes. You can still play; your chat is off until then.' && log.length === 2 && log.every(l => l.n === null) && log.map(l => l.text).join(' ') === notice.text && CHAT.muted() === 300;
      const r1 = send('hello'), said1 = notice && notice.text, r2 = send(PHRASES[0]);
      const nothing = r1 === false && r2 === false && chats() === c0 && said1 === "You can't chat for 5 more minutes." && log.length === 2;
      const words = [];
      for (const secs of [1, 45, 60, 61, 3599, 3600, 3601, 86400, 90000]) { mutedUntil = nowMs() + secs * 1000 - 50; words.push(cantChatSentence()); }
      const plain = words.join('|') === ["You can't chat for 1 more second.", "You can't chat for 45 more seconds.", "You can't chat for 1 more minute.", "You can't chat for 2 more minutes.", "You can't chat for 60 more minutes.", "You can't chat for 1 more hour.", "You can't chat for 2 more hours.", "You can't chat for 1 more day.", "You can't chat for 2 more days."].join('|');
      feed({ t: 'muted', left: -1 }); const always = notice.text === 'An admin muted you. Your chat is off until an admin turns it back on.' && CHAT.muted() === -1;
      send('still?'); const until = notice.text === "You can't chat until an admin turns it back on." && chats() === c0;
      feed({ t: 'unmuted' }); const back = notice.text === 'An admin turned your chat back on.' && log[log.length - 1].text === 'An admin turned your chat back on.' && CHAT.muted() === 0;
      lastSentAt = -1e9; const r3 = send('I am back'); const flows = r3 === true && chats() === c0 + 1;
      // a line the world refused (no echo came back) is answered with muted: that is a refusal, said as the time left, not news
      lastSentAt = -1e9; lastLineAt = nowMs(); const n0 = log.length; feed({ t: 'muted', left: 240 });
      const refused = notice.text === "You can't chat for 4 more minutes." && log.length === n0;
      mutedUntil = Infinity; feed({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen' }); const fresh = CHAT.muted() === 0;
      check(P + 'muted: the sentence once (strip, log and notice), nothing sent while muted (quick phrases too), time left in plain words, until-unmuted, unmuted, a refused line, and a new session starts unmuted', told && nothing && plain && always && until && back && flows && refused && fresh, { told, nothing, said1, plain, words, always, until, back, flows, refused, fresh }); }
    // CHAT.system: a line with no name, in its colour (gold unless told), on the strip and in the log, and never a bubble
    { log.length = 0; for (const n in bubbles) delete bubbles[n]; closePanel();
      const ok = CHAT.system('Sam found a purple party hat!'), ok2 = CHAT.system('A quiet line', '#8b949e'), empty = CHAT.system('   ');
      const a = log[0], b = log[1];
      drawStrip(g2); const drawn = rec.splice(0);
      const onStrip = drawn.some(t => t.text === 'Sam found a purple party hat!' && t.fill === GOLD) && !drawn.some(t => /:$/.test(t.text));
      check(P + 'CHAT.system writes a line with no name in its colour (gold by default) on the strip and in the log, with no bubble', ok && ok2 && empty === false && log.length === 2 && a.n === null && a.text === 'Sam found a purple party hat!' && a.color === GOLD && a.t > 0 && b.color === '#8b949e' && Object.keys(bubbles).length === 0 && onStrip, { ok, ok2, empty, a, b, onStrip }); }
    // put the world back
    close(); log.length = 0; for (const n in bubbles) delete bubbles[n]; lastSentAt = -1e9; prevDialog = false; mutedUntil = 0; lastLineAt = -1e9;
    NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
    player.dead = dead0; dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq); closePanel(); h.peace(false); render();
  });
}
