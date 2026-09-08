// ============================================================================
// SETTINGS — one panel for every switch: sound, music, kid mode, tap-to-walk, stick side, text size, talk speed,
// damage numbers, screen shake, monster levels, minimap, and a two-tap reset. Opens from the pause menu (Settings)
// or with , on a keyboard. Saved as JSON under 'fanglands.settings'; the legacy keys 'fanglands.muted',
// 'fanglands.music' and 'fanglands.kidmode' are migrated on the first load and kept in sync, so 12-audio, 15-music
// and 13-ux keep working exactly as before (they stay the source of truth for those three: the title screen's Sound
// button and the N key write them, and the render wrapper below reads them back every frame).
// Registers through HOOKS plus a handful of wrapped core functions (function declarations are reassignable in the
// shared scope, the same trick 13-ux uses for say/notify): pointerDown + joystickZone (stick side), tapRelease
// (tap-to-walk), floatText (damage numbers), explode + HOOKS.hurt (screen shake), drawMinimap + drawCompass (minimap),
// render (shake offset + legacy sync). Text size scales every font set on the game canvas through an accessor on
// ctx.font; monster levels are stripped from the "Name · lv N" label 09-render draws through a wrapper on ctx.fillText.
// 10-hud reads window.__stickRight to mirror the touch buttons (the only core edit, beside the pause menu button).
// Debug/test handle: window.SETTINGS.
// ============================================================================
const SETTINGS = (() => {
  const KEY = 'fanglands.settings';
  const LEGACY = { sound: ['fanglands.muted', v => v !== '1', on => on ? '0' : '1'], music: ['fanglands.music', v => v !== '0', on => on ? '1' : '0'], kid: ['fanglands.kidmode', v => v === '1', on => on ? '1' : '0'] };
  const DEFAULTS = { sound: true, music: true, kid: false, tap: true, stick: 'left', text: 'normal', speech: 'normal', damage: true, shake: true, levels: true, minimap: true };
  const OPTIONS = { sound: [true, false], music: [true, false], kid: [true, false], tap: [true, false], stick: ['left', 'right'], text: ['normal', 'large'], speech: ['slow', 'normal', 'fast'], damage: [true, false], shake: [true, false], levels: [true, false], minimap: [true, false] };
  const S = { ...DEFAULTS };
  let settingsPage = 0;
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };

  // ---------- persistence ----------
  function save() {
    lsSet(KEY, JSON.stringify(S));
    for (const k in LEGACY) lsSet(LEGACY[k][0], LEGACY[k][2](S[k]));
  }
  // JSON first, then the legacy keys win for sound / music / kid (the core toggles write only those)
  function load() {
    Object.assign(S, DEFAULTS);
    const raw = lsGet(KEY);
    if (raw) { try { const j = JSON.parse(raw); for (const k in OPTIONS) if (j && OPTIONS[k].includes(j[k])) S[k] = j[k]; } catch (e) { } }
    for (const k in LEGACY) { const v = lsGet(LEGACY[k][0]); if (v !== null) S[k] = LEGACY[k][1](v); }
    apply(); save();
  }
  // push the settings into the live flags the rest of the game reads
  function apply(key) {
    const all = !key;
    if (all || key === 'sound') { audioMuted = !S.sound; lsSet('fanglands.muted', S.sound ? '0' : '1'); }
    if (all || key === 'music') { if (MUSIC.enabled() !== S.music) MUSIC.setEnabled(S.music); }
    if (all || key === 'kid') { window.__kidmode = S.kid; lsSet('fanglands.kidmode', S.kid ? '1' : '0'); }
    if ((all || key === 'tap') && !S.tap && typeof tapCancel === 'function') tapCancel('settings');
    if (all || key === 'stick') { window.__stickRight = S.stick === 'right'; if (!all) { touch.stickId = null; touch.active = false; touch.dx = touch.dy = 0; } }
    if ((all || key === 'shake') && !S.shake) clearShake();
  }
  // the core toggles (title-screen Sound button, N for music, toggleKidMode) write only the legacy flags: read them back
  function syncFromLive() {
    let changed = false;
    const live = { sound: !audioMuted, music: MUSIC.enabled(), kid: !!window.__kidmode };
    for (const k in live) if (live[k] !== S[k]) { S[k] = live[k]; changed = true; }
    if (changed) save();
  }
  function set(key, value) { if (!OPTIONS[key] || !OPTIONS[key].includes(value)) return false; S[key] = value; apply(key); save(); return true; }
  function cycle(key) { const o = OPTIONS[key]; return set(key, o[(o.indexOf(S[key]) + 1) % o.length]); }
  function reset() { Object.assign(S, DEFAULTS); apply(); save(); notify('Settings put back to normal.'); }

  // ---------- text size: every font set on the game canvas goes through this ----------
  const textScale = () => S.text === 'large' ? 1.2 : 1;
  function scaleFont(f) { const k = textScale(); if (k === 1 || typeof f !== 'string') return f; return f.replace(/(\d+(?:\.\d+)?)px/, (m, n) => (Math.round(n * k * 10) / 10) + 'px'); }
  // shadows the prototype's font accessor on one context: reads give back what was set, writes land scaled
  function installFontScale(g) {
    let proto = Object.getPrototypeOf(g), d = null;
    while (proto && !d) { d = Object.getOwnPropertyDescriptor(proto, 'font'); proto = Object.getPrototypeOf(proto); }
    if (!d || !d.set || !d.get) return false;
    let raw = d.get.call(g);
    Object.defineProperty(g, 'font', { configurable: true, get() { return raw; }, set(v) { raw = v; d.set.call(g, scaleFont(v)); } });
    return true;
  }

  // ---------- monster levels: 09-render draws `${def.name} · lv ${def.level}`; off strips the level and keeps the name ----------
  const LV_RE = / · lv \d+$/;
  const levelText = t => (S.levels || typeof t !== 'string') ? t : t.replace(LV_RE, '');
  function installTextFilter(g) {
    let n = 0;
    for (const k of ['fillText', 'strokeText']) {
      const o = g[k]; if (typeof o !== 'function') continue;
      g[k] = function (t, ...rest) { return o.call(this, S.levels ? t : levelText(t), ...rest); }; n++;
    }
    return n === 2;
  }

  // ---------- screen shake: a CSS translate on the canvas (shakes the HUD too, never touches the camera maths) ----------
  const shake = { until: 0, dur: 1, amp: 0, x: 0, y: 0 };
  function startShake(amp, dur) { if (!S.shake) return; const now = nowMs(); shake.amp = Math.max(amp, now < shake.until ? shake.amp : 0); shake.dur = dur * 1000; shake.until = now + shake.dur; }
  function clearShake() { shake.until = 0; shake.x = shake.y = 0; try { if (canvas.style.transform) canvas.style.transform = ''; } catch (e) { } }
  function applyShake() {
    const now = nowMs();
    if (!S.shake || now >= shake.until) { if (shake.x || shake.y) clearShake(); return; }
    const k = (shake.until - now) / shake.dur, a = shake.amp * k;
    const x = Math.round(Math.sin(now * 0.11) * a) || 1, y = Math.round(Math.cos(now * 0.083) * a) || 1;
    if (x !== shake.x || y !== shake.y) { shake.x = x; shake.y = y; try { canvas.style.transform = `translate(${x}px, ${y}px)`; } catch (e) { } }
  }
  const shakeOffset = () => ({ x: shake.x, y: shake.y });
  HOOKS.hurt.push(dmg => startShake(Math.min(7, 2 + dmg * 0.35), 0.25));
  { const _explode = explode; explode = function (x, y, radius) { const d = dist(x, y, player.x, player.y); if (d < 640) startShake(3 + 6 * (1 - d / 640), 0.3); return _explode.apply(this, arguments); }; }

  // ---------- damage numbers: the -5 / miss floaters on hits (pickups, BOOM and "New highest hit" stay) ----------
  { const _floatText = floatText; floatText = function (x, y, text) { if (!S.damage && typeof text === 'string' && /^(-\d+|miss)\b/.test(text)) return; return _floatText.apply(this, arguments); }; }

  // ---------- tap-to-walk: 05-input hands every finished press to tapRelease; off means it never walks, uses or fights ----------
  { const _tapRelease = tapRelease; tapRelease = function (p) { if (S.tap) return _tapRelease.apply(this, arguments); tap.label = null; return false; }; }

  // ---------- stick side: the core starts the stick on the left half only; a right-handed player gets the right half ----------
  { const _pointerDown = pointerDown;
    pointerDown = function (x, y, id) {
      const right = S.stick === 'right' && touchMode();
      if (!right) return _pointerDown.apply(this, arguments);
      let blocked = false;
      if (x < VW * 0.5 && touch.stickId === null) { touch.stickId = '__settings-block'; blocked = true; } // the core would start the stick here; the stick lives on the right now
      const before = touch.press;
      _pointerDown.apply(this, arguments);
      if (blocked && touch.stickId === '__settings-block') touch.stickId = null;
      if (x >= VW * 0.5 && touch.press && touch.press !== before && touch.press.id === id && touch.stickId === null) { touch.stickId = id; touch.ox = x; touch.oy = y; touch.dx = 0; touch.dy = 0; touch.active = true; }
    };
    joystickZone = function (x, y) { return touchMode() && (S.stick === 'right' ? x > VW - 230 : x < 230) && y > VH - 180; };
  }

  // ---------- minimap ----------
  { const _drawMinimap = drawMinimap, _drawCompass = drawCompass;
    drawMinimap = function () { if (S.minimap) return _drawMinimap.apply(this, arguments); };
    drawCompass = function () { if (S.minimap) return _drawCompass.apply(this, arguments); }; }
  HOOKS.hud.push(g => {
    if (S.minimap) return;
    minimapRect = null; // no tap opens the map by accident where the minimap used to be
    const mmSize = VW < 640 ? 96 : 150, mmx = VW - mmSize - 14;
    button(g, mmx + mmSize - 64, 14, 64, 28, 'MAP', () => panel === 'map' ? closePanel() : openPanel('map'), '#21262d');
  });

  // ---------- talk speed: 07-update reveals 34 characters a second; this hook runs right after it every tick ----------
  const SPEECH_RATE = { slow: 18, normal: 34, fast: 90 };
  HOOKS.update.push(() => {
    if (dialog.cur && S.speech !== 'normal') dialog.shown = Math.min(dialog.cur.text.length, Math.floor(dialog.t * SPEECH_RATE[S.speech]));
    if (pressed.has('Comma')) toggleSettings();
  });
  function toggleSettings() { if (panel === 'settings') closePanel(); else openPanel('settings'); }

  // ---------- render wrapper: shake offset + read back the legacy flags (runs on the title screen too) ----------
  const coreRender = render;
  { const _render = render; render = function () { _render.apply(this, arguments); syncFromLive(); applyShake(); }; }
  { const _openPanel = openPanel; openPanel = function (name, arg) { if (name === 'settings') settingsPage = 0; return _openPanel(name, arg); }; }

  // ---------- the key map, read from the real handlers (07-update, 05-input, every HOOKS.update, 99-boot) ----------
  const ACTION_WORDS = { 'toggle:skills': 'Skills', 'toggle:inventory': 'Bag', 'toggle:craft': 'Craft', 'toggle:quests': 'Quests', 'toggle:map': 'Map', 'toggle:help': 'Help', 'toggle:': 'Music', goHome: 'Home', exitMech: 'Climb out', advanceDialog: 'Next line of talk', useItem: 'Eat or use pack slots', playerAttack: 'Swing', useAction: 'Use / talk', placeAction: 'Place', closePanel: 'Menu / close', toTitle: 'Title screen', toggleSettings: 'Settings', lobBomb: 'Throw a bomb (walker)', leaveInstance: 'Leave a dungeon' };
  const KEY_LABELS = { Space: 'Space', Tab: 'Tab', Escape: 'Esc', Enter: 'Enter', Slash: '?', Comma: ',', Digit: '1–5', F1: 'F1' };
  const keyLabel = code => KEY_LABELS[code] || code.replace(/^Key/, '');
  function keyMap() {
    const out = []; const seen = new Set();
    const add = (code, action) => { if (seen.has(code)) return; seen.add(code); const row = out.find(r => r.action === action); if (row) row.codes.push(code); else out.push({ action, codes: [code] }); };
    // movement: 05-input reads keys.has(...) for WASD / arrows
    { const src = String(inputVector); const codes = []; const re = /keys\.has\('(\w+)'\)/g; let m; while ((m = re.exec(src))) codes.push(m[1]);
      const ls = codes.filter(c => c.startsWith('Key')).map(keyLabel); const letters = 'WASD'.split('').filter(l => ls.includes(l)).concat(ls.filter(l => !'WASD'.includes(l))).join(''), arrows = codes.some(c => c.startsWith('Arrow'));
      if (letters || arrows) { out.push({ action: 'Move', codes: [], label: letters + (letters && arrows ? ' or arrows' : arrows ? 'arrows' : '') }); codes.forEach(c => seen.add(c)); } }
    const sources = [String(update)]; for (const h of HOOKS.update) sources.push(String(h)); if (typeof frame === 'function') sources.push(String(frame));
    const re = /pressed\.has\('([A-Za-z0-9]+)'(?:\s*\+\s*k)?\)/g;
    for (const src of sources) {
      let m; while ((m = re.exec(src))) {
        const end = src.indexOf(';', m.index); const seg = src.slice(m.index + m[0].length, end < 0 ? m.index + 160 : end);
        let fn = null, arg = ''; const cre = /([A-Za-z_]\w*)\((?:'(\w+)')?/g; let c; while ((c = cre.exec(seg))) { if (c[1] === 'has' || c[1] === 'tapped') continue; fn = c[1]; arg = c[2] || ''; }
        if (!fn) continue;
        const word = ACTION_WORDS[fn + ':' + arg] || ACTION_WORDS[fn] || fn;
        add(m[1], word);
      }
    }
    for (const r of out) if (!r.label) r.label = r.codes.map(keyLabel).join(' or ');
    return out;
  }
  function controlsText() {
    const map = keyMap();
    if (!touchMode()) return map.map(r => `${r.action}: ${r.label}`).join(' · ');
    const names = []; for (const r of map) for (const c of r.codes) { const k = keyName(c.replace(/^Key/, '')); if (/^[A-Z]+$/.test(k) && TOUCH_KEY_NAMES[c.replace(/^Key/, '').toUpperCase()] && !names.includes(k)) names.push(k); }
    return `Move: the stick on the ${S.stick} side. Buttons: ${names.join(', ')}, MENU, HELP, MUSIC. Tap the minimap for the big map.`;
  }

  // ---------- the panel ----------
  const ROWS = [
    { key: 'sound', name: 'Sound effects', hint: () => 'Swings, hits, coins and clicks.' },
    { key: 'music', name: 'Music', hint: () => 'A tune for every place.' + (touchMode() ? '' : ' N flips it while you play.') },
    { key: 'kid', name: 'Kid mode', hint: () => 'A quarter of every hit comes back. Death charges nothing.' },
    { key: 'tap', name: () => touchMode() ? 'Tap to walk' : 'Click to walk', hint: () => touchMode() ? 'Tap the ground to walk there, tap things to use them.' : 'Click the ground to walk there, click things to use them.' },
    { key: 'stick', name: 'Move stick side', hint: () => touchMode() ? 'Which side the stick lives on. The buttons swap over.' : 'Touch screens only. The buttons swap over too.' },
    { key: 'text', name: 'Text size', hint: () => 'Bigger words in talk boxes, notes and panels.' },
    { key: 'speech', name: 'Talk speed', hint: () => 'How fast the words appear in talk boxes.' },
    { key: 'damage', name: 'Damage numbers', hint: () => 'The -5 and miss that pop up on hits.' },
    { key: 'shake', name: 'Screen shake', hint: () => 'A small shake when you get hit or a bomb goes off.' },
    { key: 'levels', name: 'Monster levels', hint: () => 'Show "lv 3" beside a monster\'s name.' },
    { key: 'minimap', name: 'Minimap', hint: () => 'The little map in the corner. A MAP button stands in for it.' },
  ];
  const VALUE_WORDS = { true: 'On', false: 'Off', left: 'Left', right: 'Right', normal: 'Normal', large: 'Large', slow: 'Slow', fast: 'Fast' };
  const ROW_H = 36;
  const text = v => typeof v === 'function' ? v() : v;
  HOOKS.panel.settings = (g, narrow) => {
    const items = ROWS.length + 1; // + reset
    const wMax = Math.min(460, VW - 20);
    g.font = '11px sans-serif'; const ctrl = controlsText(); const ctrlLines = dialogLines(g, ctrl, wMax - 36); const ctrlH = 18 + ctrlLines * 14;
    const top = 66, wantH = top + items * ROW_H + 10 + ctrlH + 10;
    const h = Math.min(VH - 20, wantH); const paged = h < wantH;
    const per = paged ? Math.max(1, Math.floor((h - top - 10 - ctrlH - 10 - 36) / ROW_H)) : items;
    const pages = Math.max(1, Math.ceil(items / per)); settingsPage = clamp(settingsPage, 0, pages - 1);
    const { px, py, w } = panelBox(g, 460, h, 'Settings', touchMode() ? 'Tap a button to change it. Tap outside to close.' : 'Click a button to change it. Esc or , closes.');
    const bw = narrow ? 84 : 96, labelW = w - 36 - bw - 10;
    const fit = t => { while (g.measureText(t).width > labelW && t.length > 6) t = t.slice(0, -2) + '…'; return t; };
    const list = [...ROWS, { reset: true }].slice(settingsPage * per, settingsPage * per + per);
    list.forEach((row, i) => {
      const y = py + top + i * ROW_H;
      if (row.reset) {
        const armed = confirmActive('settings-reset');
        button(g, px + 18, y + 3, w - 36, 30, armed ? 'Really reset? Tap again' : 'Put every setting back to normal', () => confirmTap('settings-reset', reset), armed ? '#c0392b' : '#8b2e2e');
        buttons[buttons.length - 1].label = 'set:reset';
        return;
      }
      g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(fit(text(row.name)), px + 18, y + 15);
      g.fillStyle = '#8b949e'; g.font = '10px sans-serif'; g.fillText(fit(text(row.hint)), px + 18, y + 29);
      const v = S[row.key], on = v === true || (typeof v === 'string' && v !== DEFAULTS[row.key]);
      button(g, px + w - 18 - bw, y + 3, bw, 30, VALUE_WORDS[String(v)] || String(v), () => cycle(row.key), on ? '#238636' : '#21262d');
      buttons[buttons.length - 1].label = 'set:' + row.key; // the harness finds rows by key; the drawn word stays On / Off / Left / ...
    });
    if (paged) pager(g, px + 18, py + h - ctrlH - 10 - 36, w - 36, settingsPage, pages, p => { settingsPage = p; });
    const y0 = py + h - ctrlH - 8;
    g.fillStyle = '#8b949e'; g.font = 'bold 10px sans-serif'; g.textAlign = 'left'; g.fillText('CONTROLS', px + 18, y0 + 10);
    g.fillStyle = '#c9d1d9'; g.font = '11px sans-serif'; wrapText(g, ctrl, px + 18, y0 + 24, w - 36, 14);
  };

  // ---------- boot ----------
  load();
  installFontScale(ctx);
  installTextFilter(ctx);

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const snap = { ...S }, prevTouch = window.__forceTouch, dc = dialog.cur, dq = dialog.queue.slice();
    dialog.cur = null; dialog.queue.length = 0; paused = false; closePanel(); h.peace(true); uxConfirm = null;
    const rectsOf = () => buttons.filter(b => !b.offscreen);
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    try {
      // opens from the pause menu and with ,
      { paused = true; render(); const c = F.clickButton('Settings'); const fromMenu = c && !paused && panel === 'settings'; closePanel();
        F.press('Comma'); const byKey = panel === 'settings'; render(); const rows = rectsOf().filter(b => b.label.startsWith('set:')).map(b => b.label.slice(4));
        F.press('Comma'); const closed = panel === null;
        check('settings: opens from the pause menu Settings button and with the , key; one control per row plus reset', fromMenu && byKey && closed && rows.join() === ROWS.map(r => r.key).join() + ',reset', { fromMenu, byKey, closed, rows }); }
      // sound / music / kid drive the real flags and the legacy keys
      { const a0 = audioMuted; set('sound', true); const on = !audioMuted && lsGet('fanglands.muted') === '0'; set('sound', false); const off = audioMuted && lsGet('fanglands.muted') === '1';
        set('sound', !a0); check('settings: sound row drives audioMuted and fanglands.muted', on && off, { on, off }); }
      { const m0 = MUSIC.enabled(); set('music', false); const off = !MUSIC.enabled() && lsGet('fanglands.music') === '0'; set('music', true); const on = MUSIC.enabled() && lsGet('fanglands.music') === '1';
        set('music', m0); check("settings: music row drives 15-music's switch and fanglands.music", on && off, { on, off }); }
      { const k0 = !!window.__kidmode; set('kid', true); const on = window.__kidmode === true && lsGet('fanglands.kidmode') === '1'; set('kid', false); const off = window.__kidmode === false && lsGet('fanglands.kidmode') === '0';
        toggleKidMode(); render(); const readBack = S.kid === true && JSON.parse(lsGet(KEY)).kid === true; // the core toggle is read back on the next frame
        set('kid', k0); check('settings: kid mode row drives window.__kidmode; a core toggle is read back into the settings', on && off && readBack, { on, off, readBack }); }
      // tap-to-walk gate
      { window.__forceTouch = false; const o = h.openSpot(40, 24); F.tp(o.x, o.y); F.step([]); tapCancel('test'); render();
        const tapAt = (dx) => { render(); const sx = player.x + dx - cam.x, sy = player.y - cam.y; pointerDown(sx, sy, 'mouse'); pointerUp('mouse'); };
        set('tap', false); tapAt(2 * TILE); const x0 = player.x; const noPath = !tap.path && !tap.kind; F.sim(30, []); const still = Math.abs(player.x - x0) < 1;
        set('tap', true); tapAt(2 * TILE); const path = !!tap.path || !!tap.kind; tapCancel('test');
        check('settings: tap to walk off means a tap never walks or uses; on brings it back', noPath && still && path, { noPath, still, path }); }
      // stick side
      { window.__forceTouch = true; touch.stickId = null; touch.active = false; touch.press = null; const sy = VH - 100;
        set('stick', 'right'); render(); pointerDown(VW * 0.75, sy, 7); const rOn = touch.stickId === 7 && touch.active; touch.press = null; pointerUp(7); pointerDown(VW * 0.25, sy, 8); const lOff = touch.stickId === null; touch.press = null; pointerUp(8);
        const zoneR = joystickZone(VW - 100, VH - 60) && !joystickZone(100, VH - 60) && window.__stickRight === true;
        set('stick', 'left'); pointerDown(VW * 0.25, sy, 9); const lOn = touch.stickId === 9; touch.press = null; pointerUp(9); pointerDown(VW * 0.75, sy, 10); const rOff = touch.stickId === null; touch.press = null; pointerUp(10);
        const zoneL = joystickZone(100, VH - 60) && !joystickZone(VW - 100, VH - 60) && window.__stickRight === false;
        window.__forceTouch = prevTouch;
        check('settings: stick side right starts the stick on the right half only (and the dialogue-safe zone moves); left is the core behaviour', rOn && lOff && zoneR && lOn && rOff && zoneL, { rOn, lOff, zoneR, lOn, rOff, zoneL }); }
      // text size
      { const P = { get font() { return this._f; }, set font(v) { this._f = v; } }; const fake = Object.create(P); fake._f = '10px x'; const ok = installFontScale(fake);
        set('text', 'large'); fake.font = '16px sans-serif'; const big = fake._f === '19.2px sans-serif' && fake.font === '16px sans-serif' && scaleFont('bold 13px sans-serif') === 'bold 15.6px sans-serif';
        set('text', 'normal'); fake.font = '16px sans-serif'; const same = fake._f === '16px sans-serif' && scaleFont('16px sans-serif') === '16px sans-serif';
        check('settings: text size large scales every font set on the canvas by 1.2 (reads give back the unscaled font)', ok && big && same, { ok, big, same, live: typeof ctx.font }); }
      // talk speed
      { const shownAfter = sp => { set('speech', sp); dialog.cur = null; dialog.queue.length = 0; say('B'.repeat(200), 'The Voice'); F.step([]); F.sim(29, []); const n = dialog.shown; dialog.cur = null; dialog.queue.length = 0; return n; };
        const slow = shownAfter('slow'), normal = shownAfter('normal'), fast = shownAfter('fast'); set('speech', 'normal');
        check('settings: talk speed slow / normal / fast changes how many letters show after half a second (about 9 / 17 / 45)', Math.abs(slow - 9) <= 1 && Math.abs(normal - 17) <= 1 && Math.abs(fast - 45) <= 1 && slow < normal && normal < fast, { slow, normal, fast }); }
      // damage numbers
      { const gob = monsters.find(m => m.type === 'goblin'); const gs = { x: gob.x, y: gob.y, hp: gob.hp, dead: gob.dead, state: gob.state, angry: gob.angry }; gob.dead = false; gob.hp = 999; gob.x = player.x + 200; gob.y = player.y;
        const k0 = S.kid, hh0 = player.highestHit; set('kid', false); player.highestHit = 999; player.hp = player.maxHp;
        set('damage', false); const n0 = floaters.length; hitMonster(gob, 3, 0); const hp0 = player.hp; hurtPlayer(1, player.x + 10, player.y); const none = floaters.length === n0 && gob.hp === 996 && player.hp === hp0 - 1;
        set('damage', true); hitMonster(gob, 3, 0); const one = floaters.length === n0 + 1 && /^-3$/.test(floaters[floaters.length - 1].text);
        player.hp = hp0; player.highestHit = hh0; set('kid', k0); Object.assign(gob, gs); floaters.length = n0;
        check('settings: damage numbers off spawns no -n / miss floaters on hits (the hit still lands); on brings them back', none && one, { none, one }); }
      // screen shake
      { set('shake', false); clearShake(); const hp0 = player.hp; hurtPlayer(4, player.x + 10, player.y); render(); const noneOff = shakeOffset().x === 0 && shakeOffset().y === 0 && !canvas.style.transform;
        set('shake', true); hurtPlayer(4, player.x + 10, player.y); render(); const o = shakeOffset(); const on = (o.x !== 0 || o.y !== 0) && /translate/.test(canvas.style.transform || '');
        set('shake', false); render(); const cleared = shakeOffset().x === 0 && !canvas.style.transform; set('shake', true); player.hp = hp0;
        check('settings: screen shake on nudges the canvas after a hit; off never moves it and clears a running shake', noneOff && on && cleared, { noneOff, on, cleared, o }); }
      // monster levels
      { const seen = []; const fake = { fillText(t) { seen.push(t); }, strokeText() { } }; const ok = installTextFilter(fake);
        set('levels', false); fake.fillText('Goblin · lv 3', 0, 0); const stripped = seen[0] === 'Goblin' && levelText('Grave zombie · lv 24') === 'Grave zombie';
        set('levels', true); fake.fillText('Goblin · lv 3', 0, 0); const kept = seen[1] === 'Goblin · lv 3';
        const drawsIt = String(coreRender).includes(' · lv ${def.level}`'); // the label format 09-render builds (so the filter cannot drift from it silently)
        check('settings: monster levels off strips " · lv N" from the label over a monster and keeps its name', ok && stripped && kept && drawsIt, { ok, stripped, kept, drawsIt }); }
      // minimap
      { set('minimap', false); render(); const off = minimapRect === null && buttons.some(b => b.label === 'MAP'); const mapBtn = F.clickButton('MAP'); const opened = panel === 'map'; closePanel();
        set('minimap', true); render(); const on = !!minimapRect && !buttons.some(b => b.label === 'MAP');
        check('settings: minimap off hides it and a MAP button opens the big map; on brings the minimap back', off && mapBtn && opened && on, { off, mapBtn, opened, on }); }
      // persistence + legacy migration
      { set('text', 'large'); set('speech', 'fast'); const j = JSON.parse(lsGet(KEY)); const saved = j.text === 'large' && j.speech === 'fast';
        S.text = 'normal'; S.speech = 'normal'; load(); const back = S.text === 'large' && S.speech === 'fast';
        const keep = { j: lsGet(KEY), m: lsGet('fanglands.muted'), u: lsGet('fanglands.music'), k: lsGet('fanglands.kidmode') };
        try { localStorage.removeItem(KEY); } catch (e) { } lsSet('fanglands.muted', '1'); lsSet('fanglands.music', '0'); lsSet('fanglands.kidmode', '1'); load();
        const migrated = S.sound === false && S.music === false && S.kid === true && audioMuted === true && MUSIC.enabled() === false && window.__kidmode === true && !!lsGet(KEY) && S.text === 'normal';
        lsSet(KEY, keep.j); lsSet('fanglands.muted', keep.m); lsSet('fanglands.music', keep.u); lsSet('fanglands.kidmode', keep.k); load();
        check('settings: persist as JSON under fanglands.settings and round-trip; the legacy muted / music / kidmode keys migrate on a first load', saved && back && migrated, { saved, back, migrated }); }
      // reset: two taps
      { set('text', 'large'); set('damage', false); set('stick', 'right'); openPanel('settings'); render(); const c1 = F.clickButton('set:reset'); const still = S.text === 'large' && S.damage === false && buttons.some(b => b.label === 'set:reset'); render();
        const c2 = F.clickButton('set:reset'); const done = S.text === 'normal' && S.damage === true && S.stick === 'left' && JSON.parse(lsGet(KEY)).text === 'normal'; closePanel(); uxConfirm = null;
        check('settings: reset needs two taps and puts every setting back to normal', c1 && still && c2 && done, { c1, still, c2, done }); }
      // controls line reads the real handlers
      { const map = keyMap(); const find = a => map.find(r => r.action === a); const e = find('Use / talk'), sp = find('Swing'), st = find('Settings'), mu = find('Music'), mv = find('Move');
        const codes = []; const re = /pressed\.has\('([A-Za-z0-9]+)'/g; let m; while ((m = re.exec(String(update)))) codes.push(m[1]); const all = codes.every(c => map.some(r => r.codes.includes(c)));
        window.__forceTouch = true; const t = controlsText(); window.__forceTouch = false; const d = controlsText(); window.__forceTouch = prevTouch;
        check('settings: the Controls line is built from the real key handlers (E use, Space swing, comma settings, N music, WASD move) and every key 07-update reads is listed; touch shows button names', !!e && e.codes.includes('KeyE') && !!sp && sp.codes.includes('Space') && !!st && st.codes.includes('Comma') && !!mu && mu.codes.includes('KeyN') && !!mv && /WASD/.test(mv.label) && all && /SWING/.test(t) && /USE/.test(t) && /Swing: Space/.test(d), { e: e && e.codes, sp: sp && sp.codes, st: st && st.codes, mu: mu && mu.codes, mv: mv && mv.label, all, t }); }
      // layout at four viewports: panel (every page) and pause menu — no two buttons overlap, everything inside the screen
      { const own = k => Object.getOwnPropertyDescriptor(window, k); const saved = { w: own('innerWidth'), h: own('innerHeight') }; const problems = [];
        const setSize = (w, hh) => { try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { } render(); return VW === w && VH === hh; };
        const inside = r => r.x >= 0 && r.y >= 0 && r.x + r.w <= VW && r.y + r.h <= VH;
        const audit = (where, rects) => { for (const r of rects) if (!inside(r)) problems.push(`${where}: ${r.label} off-screen ${JSON.stringify([r.x, r.y, r.w, r.h])}`); for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (hit(rects[i], rects[j])) problems.push(`${where}: ${rects[i].label} × ${rects[j].label}`); };
        let tried = 0;
        for (const [w, hh] of [[390, 844], [844, 390], [768, 1024], [1280, 800]]) {
          if (!setSize(w, hh)) continue; tried++;
          for (const big of ['normal', 'large']) {
            set('text', big);
            openPanel('settings'); let p = 0;
            while (true) { settingsPage = p; render(); const pr = { ...panelRect }; if (!inside(pr)) problems.push(`panel ${w}x${hh} ${big} p${p}: box off-screen ${JSON.stringify(pr)}`);
              const ci = buttons.findIndex(b => b.label === '×' && hit(b, pr)); audit(`panel ${w}x${hh} ${big} p${p}`, ci < 0 ? [{ x: -1, y: -1, w: 0, h: 0, label: 'no close button' }] : rectsOf().filter(b => buttons.indexOf(b) >= ci)); /* the panel's own controls; HUD rects under the box are shadowed by design (last registered wins) */ if (!buttons.some(b => b.label === 'Next')) break; if (++p > 8) { problems.push('too many pages'); break; } }
            closePanel(); paused = true; render(); audit(`pause ${w}x${hh} ${big}`, rectsOf()); paused = false;
            say('A'.repeat(180) + ' ' + 'word '.repeat(30), 'The Voice'); F.step([]); render(); if (!dialogRect || !inside(dialogRect)) problems.push(`dialogue ${w}x${hh} ${big}: ${JSON.stringify(dialogRect)}`); dialog.cur = null; dialog.queue.length = 0;
          }
        }
        set('text', 'normal'); settingsPage = 0;
        if (saved.w) { Object.defineProperty(window, 'innerWidth', saved.w); Object.defineProperty(window, 'innerHeight', saved.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } }
        render();
        check('settings: no overlapping or off-screen buttons in the panel (every page, normal + large text) and the pause menu at 390x844, 844x390, 768x1024, 1280x800; the dialogue box fits', tried === 4 && problems.length === 0, { tried, problems: problems.slice(0, 8), VW, VH }); }
    } finally {
      Object.assign(S, snap); apply(); save(); settingsPage = 0; uxConfirm = null; clearShake();
      window.__forceTouch = prevTouch; paused = false; closePanel(); h.peace(false); touch.press = null; touch.stickId = null; touch.active = false;
      dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq);
    }
  });

  return { get: k => S[k], set, cycle, reset, load, save, apply, state: () => ({ ...S }), DEFAULTS, OPTIONS, scaleFont, textScale, installFontScale, levelText, installTextFilter, shakeOffset, startShake, keyMap, controlsText, page: () => settingsPage };
})();
window.SETTINGS = SETTINGS;
