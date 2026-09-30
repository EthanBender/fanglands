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
// The HUD kit reads window.__stickRight to mirror the stick and the seats, and SETTINGS.textScale / get('words') / get('minimap').
// SETTINGS.keyMap() is the one key table: Settings › Controls, the book's Keys card and the key coverage check read it.
// Debug/test handle: window.SETTINGS.
// ============================================================================
// ---------- panel helpers for the book-and-online panels (Settings, Friends, Give, Chat log, the title screen) ----------
// Function declarations, so they are hoisted: 14-title (before this file) and 71 / 73 / 74 (after it) call them too.
// They stand in for three things the kit (src/59-hudkit.js) and 10-hud do not offer yet; the integrator may lift them:
//   panelRoom(w, h)   the largest panelBox() that keeps its close seal and its bottom edge out of the notch / Dynamic Island /
//                     home-indicator bands (panelBox centres the box at VH/2 - h/2 - 20, never above y 10);
//   platePush(...)    an iron plate button whose TAP LABEL (what the harness clicks, e.g. 'set:sound') differs from the WORD
//                     drawn on it ('On'), with the kit's press / hover look read from that label; fires on pointer-up;
//   rowPager(...)     Prev / Next plates one kit row tall (HK.row(): 44 px on touch), labelled 'Prev' / 'Next' like pager().
function panelRoom(wantW, wantH) {
  const t = touchMode(), fam = HK.family(VW, VH, t), S = HK.insets(VW, VH, fam, t);
  const w = Math.round(Math.max(200, Math.min(wantW, VW - 20, VW - 2 * Math.max(S.l, S.r) - 16)));
  let h = Math.round(Math.min(wantH, VH - 20));
  const ok = hh => { const py = Math.max(10, Math.round(VH / 2 - hh / 2 - 20)); return py >= S.t + 4 && py + hh <= VH - S.b - 4; };
  while (h > 140 && !ok(h)) h -= 2;
  return { w, h, S };
}
function platePush(g, x, y, w, h, label, word, action, tone, o = {}) {
  const live = o.enabled !== false, st = live ? HK.stateOf(label) : {};
  HK.plateButton(g, { x, y, w, h }, o.emblem || null, word, live ? tone : null, { pressed: !!st.pressed, hover: !!st.hover, disabled: !live, key: o.key || null, cinzel: !!o.cinzel, size: o.size, on: !!o.on });
  const b = live ? { x, y, w, h, label, action, up: true, name: o.name || word, keys: o.keys || [] } : { x, y, w, h, label: 'disabled:' + label, action: () => { }, disabled: true, inert: true };
  buttons.push(b);
  return b;
}
function rowPager(g, x, y, w, page, pages, setPage) {
  const p = clamp(page, 0, Math.max(0, pages - 1)), h = HK.row(), bw = Math.min(Math.floor((w - 16) / 3), touchMode() ? 104 : 92);
  const one = (bx, label, em, live, fn) => {
    platePush(g, bx, y, bw, h, label, label, fn, null, { enabled: live, name: label === 'Prev' ? 'The page before' : 'The next page' });
    g.fillStyle = g.strokeStyle = live ? HK.T.goldHi : HK.T.inkMute; HK.EM[em](g, label === 'Prev' ? bx + 14 : bx + bw - 14, y + h / 2 + (HK.stateOf(label).pressed ? 1.5 : 0), 12);
  };
  one(x, 'Prev', 'chevronL', p > 0, () => setPage(p - 1));
  HK.text(g, `Page ${p + 1} of ${pages}`, x + w / 2, y + h / 2 + 5, { font: HK.FS(600, 13), align: 'center', color: HK.T.inkDim, box: { x: x + bw + 4, y, w: w - 2 * bw - 8, h }, fitId: 'pager' });
  one(x + w - bw, 'Next', 'chevronR', p < pages - 1, () => setPage(p + 1));
  return p;
}
// The panel audit the online-book checks share: the rects from the close seal (or `from`) onward must be at least 44 px on
// touch (26 with a mouse), 8 px apart on touch (4), on screen, out of the notch / home-indicator bands, and every string the
// kit logged must fit its box. Call it right after a frame drawn with HK.FIT on.
function panelAudit(where, opt = {}) {
  const t = touchMode(), out = [], floor = t ? 44 : 26, clear = t ? 8 : 4;
  const all = buttons.filter(b => !b.offscreen && b.w > 0 && b.h > 0);
  const from = opt.from != null ? opt.from : all.findIndex(b => b.label === '×');
  if (from < 0) { out.push(`${where}: no close seal`); return out; }
  const L = { VW, VH, S: HK.insets(VW, VH, HK.family(VW, VH, t), t) };
  const taps = all.slice(from).map(b => b.r ? { id: b.label, k: 'c', x: b.cx != null ? b.cx : b.x + b.w / 2, y: b.cy != null ? b.cy : b.y + b.h / 2, r: b.r } : { id: b.label, k: 'r', x: b.x, y: b.y, w: b.w, h: b.h });
  const box = q => q.k === 'c' ? { x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 } : q;
  const small = opt.small || /^(slot|bank|hot|eq)\d*/;
  for (const q of taps) {
    const b = box(q);
    if (!small.test(q.id) && (b.w < floor - 0.5 || b.h < floor - 0.5)) out.push(`${where}: ${q.id} is ${Math.round(b.w)}x${Math.round(b.h)}, under ${floor}`);
    if (b.x < -0.5 || b.y < -0.5 || b.x + b.w > VW + 0.5 || b.y + b.h > VH + 0.5) out.push(`${where}: ${q.id} off screen`);
    if (t) for (const z of HK.bands(L)) if (HK.gapBetween(z, q) < 0) out.push(`${where}: ${q.id} in the ${z.name}`);
  }
  for (let i = 0; i < taps.length; i++) for (let j = i + 1; j < taps.length; j++) { const g0 = HK.gapBetween(taps[i], taps[j]); if (g0 < clear) out.push(`${where}: ${taps[i].id} ~ ${taps[j].id} gap ${g0.toFixed(1)}`); }
  if (panelRect && opt.panel !== false) { const P = panelRect; if (P.x < -0.5 || P.y < -0.5 || P.x + P.w > VW + 0.5 || P.y + P.h > VH + 0.5) out.push(`${where}: the panel is off screen`); }
  for (const f of HK.audit.fitIssues(where)) out.push(f);
  return out;
}
// Draws one frame at a size with the kit's measuring context and the fit log on, and returns panelAudit's issues.
// setSize(w, h) and the restore are the caller's (see the self-tests below).
function panelFrame(where, opt = {}) {
  const fc = HK.audit.fitCtx();
  HK.FIT.on = true; HK.FIT.log.length = 0;
  try { drawHud(fc); } finally { HK.FIT.on = false; }
  const out = panelAudit(where, opt);
  HK.FIT.log.length = 0;
  return out;
}
// Set the window to a size (tests only), the way the kit's check 11 does; returns true when the game took it.
function panelSetSize(w, h) { try { window.innerWidth = w; window.innerHeight = h; } catch (e) { } if (VW !== w || VH !== h) resize(); return VW === w && VH === h; }
function panelSizeSaver() {
  const own = k => Object.getOwnPropertyDescriptor(window, k), saved = { w: own('innerWidth'), h: own('innerHeight') };
  return () => { if (saved.w) { Object.defineProperty(window, 'innerWidth', saved.w); Object.defineProperty(window, 'innerHeight', saved.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } } resize(); };
}

const SETTINGS = (() => {
  const KEY = 'fanglands.settings';
  const LEGACY = { sound: ['fanglands.muted', v => v !== '1', on => on ? '0' : '1'], music: ['fanglands.music', v => v !== '0', on => on ? '1' : '0'], kid: ['fanglands.kidmode', v => v === '1', on => on ? '1' : '0'] };
  const DEFAULTS = { sound: true, music: true, kid: false, tap: true, stick: 'left', text: 'normal', speech: 'normal', damage: true, shake: true, levels: true, minimap: true, words: 'learning' };
  const OPTIONS = { sound: [true, false], music: [true, false], kid: [true, false], tap: [true, false], stick: ['left', 'right'], text: ['small', 'normal', 'large'], speech: ['slow', 'normal', 'fast'], damage: [true, false], shake: [true, false], levels: [true, false], minimap: [true, false], words: ['learning', 'always', 'off'] };
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
    for (const k in EXTRA) if (all || key === k) EXTRA[k](S[k]);
  }
  // the core toggles (title-screen Sound button, N for music, toggleKidMode) write only the legacy flags: read them back
  function syncFromLive() {
    let changed = false;
    const live = { sound: !audioMuted, music: MUSIC.enabled(), kid: !!window.__kidmode };
    for (const k in live) if (live[k] !== S[k]) { S[k] = live[k]; changed = true; }
    if (changed) save();
  }
  // a row another file owns (69-retaliate: Fight back when hit). It sits in this panel, persists under fanglands.settings,
  // goes back to its default on reset and is in the layout audit below; onApply(value) hands every change to that file.
  const EXTRA = {};
  function addRow(row, def, options, after, onApply) {
    DEFAULTS[row.key] = def; OPTIONS[row.key] = options; EXTRA[row.key] = onApply;
    let v = def; const raw = lsGet(KEY);
    if (raw) { try { const j = JSON.parse(raw); if (j && options.includes(j[row.key])) v = j[row.key]; } catch (e) { } }
    S[row.key] = v;
    const i = ROWS.findIndex(r => r.key === after); ROWS.splice(i < 0 ? ROWS.length : i + 1, 0, row);
  }
  function set(key, value) { if (!OPTIONS[key] || !OPTIONS[key].includes(value)) return false; S[key] = value; apply(key); save(); return true; }
  function cycle(key) { const o = OPTIONS[key]; return set(key, o[(o.indexOf(S[key]) + 1) % o.length]); }
  function reset() { Object.assign(S, DEFAULTS); apply(); save(); notify('Settings put back to normal.'); }

  // ---------- text size: every font set on the game canvas goes through this ----------
  // Small 0.9 / Normal 1 / Large 1.15 (the HUD kit's type tokens). The kit keeps its plates, names and numbers at their
  // own size and lets only sentences grow (src/59-hudkit.js); panels and talk boxes scale through this.
  const textScale = () => S.text === 'large' ? 1.15 : S.text === 'small' ? 0.9 : 1;
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
  // With the minimap off the kit leaves a 48 px iron map stud where the ring was (src/59-hudkit.js, label 'MAP'), and the
  // seals do not move. This registration gives the book's MAP tile its toggle. No tap opens the map where the glass was.
  HOOKS.hud.push(() => { if (!S.minimap) minimapRect = null; });
  hudControl({ id: 'map', sort: 50, label: () => 'MAP', show: () => !S.minimap && !paused, on: () => panel === 'map', action: () => panel === 'map' ? closePanel() : openPanel('map') });

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

  // ---------- the key map, read from the real handlers (07-update, 05-input, every HOOKS.update, 99-boot, HOOKS.keyHelp) ----------
  // One table feeds Settings › Controls, the book's Keys card (src/59-hudkit.js drawKeys) and the key coverage self-test.
  // KEY_TABLE gives each key its plain words and its order; a row is kept only while a real handler still reads one of its
  // codes (so a removed key drops out, and the coverage check says so), and any key a handler reads that the table does not
  // know is added at the end in the words its handler or its HOOKS.keyHelp entry gives. Words are short enough for one line
  // of the Keys card's two columns at 1280x800 (the self-test measures them).
  const KEY_TABLE = [
    { codes: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], keys: ['WASD'], action: 'Walk (or arrows)', move: true },
    { codes: ['Space'], keys: ['Space'], action: 'Swing, shoot, stomp' },
    { codes: ['KeyE'], action: 'Use or talk' },
    { codes: ['KeyQ'], action: 'Place a thing' },
    { codes: ['Digit'], keys: ['1-5'], action: 'Use a belt pouch' },
    { codes: ['KeyI'], action: 'Your pack' },
    { codes: ['KeyC'], action: 'Crafting' },
    { codes: ['Tab'], keys: ['Tab'], action: 'Skills' },
    { codes: ['KeyJ'], action: 'Quests' },
    { codes: ['KeyM'], action: 'World map' },
    { codes: ['Slash', 'F1'], keys: ['?', 'F1'], action: 'How to play' },
    { codes: ['KeyH'], action: 'Go home' },
    { codes: ['KeyX'], action: 'Climb out' },
    { codes: ['Enter'], keys: ['Enter'], action: 'Next line, or chat' },
    { codes: ['Escape'], keys: ['Esc'], action: 'Close, or the book' },
    { codes: ['KeyT'], action: 'Title screen, paused' },
    { codes: ['Comma'], keys: [','], action: 'Settings' },
    { codes: ['KeyK'], action: 'Wiki' },
    { codes: ['KeyN'], action: 'Music on or off' },
    { codes: ['KeyR'], action: 'Raise your shield' },
    // G rides the mare and gets down; X gets down too (51-mounts)
    { codes: ['KeyG'], keys: ['G', 'X'], action: 'Ride or get down' },
    { codes: ['KeyV'], action: 'Machine special' },
    { codes: ['KeyB'], action: 'Bomb (Barrelbeast)' },
    { codes: ['KeyL'], action: 'Leave a dungeon' },
    // P does two jobs (61-markers and 63-house): both are listed, neither is renamed (an open question for the owner)
    { codes: ['KeyP'], action: 'Markers, or Build' },
    { codes: ['KeyF'], action: 'Friends' },
    { codes: ['KeyY'], action: 'Chat' },
  ];
  const ACTION_WORDS = { 'toggle:skills': 'Skills', 'toggle:inventory': 'Your pack', 'toggle:craft': 'Crafting', 'toggle:quests': 'Quests', 'toggle:map': 'World map', 'toggle:help': 'How to play', 'toggle:': 'Music on or off', goHome: 'Go home', exitMech: 'Climb out', advanceDialog: 'Next line of talk', useItem: 'Use a belt pouch', playerAttack: 'Swing', useAction: 'Use or talk', placeAction: 'Place a thing', closePanel: 'Close, or the book', toTitle: 'Title screen', toggleSettings: 'Settings', lobBomb: 'Bomb (Barrelbeast)', leaveInstance: 'Leave a dungeon' };
  const KEY_LABELS = { Space: 'Space', Tab: 'Tab', Escape: 'Esc', Enter: 'Enter', Slash: '?', Comma: ',', Digit: '1-5', F1: 'F1' };
  const keyLabel = code => KEY_LABELS[code] || code.replace(/^Key/, '').replace(/^Arrow/, '');
  // every code a real handler reads, with the words its handler suggests: { code: word }
  function handlerCodes() {
    const found = {};
    // movement: 05-input reads keys.has(...) for WASD / arrows
    { const src = String(inputVector); const re = /keys\.has\('(\w+)'\)/g; let m; while ((m = re.exec(src))) found[m[1]] = found[m[1]] || 'Walk'; }
    // wrappers (44-wiki) hand back the wrapped function as __inner; only the core handler is parsed — features declare their keys in HOOKS.keyHelp
    const sources = []; { let u = update; while (typeof u === 'function' && u.__inner) u = u.__inner; sources.push(String(u)); } for (const h of HOOKS.update) sources.push(String(h)); if (typeof frame === 'function') sources.push(String(frame));
    const re = /pressed\.has\('([A-Za-z0-9]+)'(?:\s*\+\s*k)?\)/g;
    for (const src of sources) {
      let m; while ((m = re.exec(src))) {
        const end = src.indexOf(';', m.index); const seg = src.slice(m.index + m[0].length, end < 0 ? m.index + 160 : end);
        let fn = null, arg = ''; const cre = /([A-Za-z_]\w*)\((?:'(\w+)')?/g; let c; while ((c = cre.exec(seg))) { if (c[1] === 'has' || c[1] === 'tapped') continue; fn = c[1]; arg = c[2] || ''; }
        if (!fn || found[m[1]]) continue;
        found[m[1]] = ACTION_WORDS[fn + ':' + arg] || ACTION_WORDS[fn] || fn;
      }
    }
    for (const k of HOOKS.keyHelp) for (const c of k.codes) if (!found[c]) found[c] = k.action;
    return found;
  }
  // The rows: [{ action, codes, label, keys, jobs }]. `keys` are the keycaps to draw, `label` the same joined with ' or '
  // (the older readers split it), `jobs` every HOOKS.keyHelp word for a key two features share (P).
  let keyMemo = null;
  function keyMap() {
    // the handlers only change at load time: parse them once per set of hooks, hand out copies
    const sig = HOOKS.update.length + '|' + HOOKS.keyHelp.length;
    if (keyMemo && keyMemo.sig === sig) return keyMemo.rows.map(r => Object.assign({}, r, { codes: r.codes.slice(), keys: r.keys.slice(), jobs: r.jobs.slice() }));
    const found = handlerCodes(), out = [], used = new Set();
    for (const t of KEY_TABLE) {
      const codes = t.codes.filter(c => found[c]); if (!codes.length) continue;
      const keys = t.keys ? t.keys.slice() : [keyLabel(codes[0])];
      const jobs = []; for (const k of HOOKS.keyHelp) if (k.codes.some(c => codes.includes(c)) && !jobs.includes(k.action)) jobs.push(k.action);
      out.push({ action: t.action, codes, keys, label: keys.join(' or '), jobs });
      codes.forEach(c => used.add(c));
    }
    // a key the table does not know yet (a new feature's): grouped by its words
    for (const c in found) {
      if (used.has(c)) continue;
      const row = out.find(r => r.extra && r.action === found[c]);
      if (row) { row.codes.push(c); row.keys.push(keyLabel(c)); row.label = row.keys.join(' or '); }
      else out.push({ action: found[c], codes: [c], keys: [keyLabel(c)], label: keyLabel(c), jobs: [], extra: true });
    }
    keyMemo = { sig, rows: out };
    return keyMap();
  }
  function controlsText() {
    const map = keyMap();
    if (!touchMode()) return map.map(r => `${r.action}: ${r.label}`).join(' · ');
    return `Move with the stick on the ${S.stick} side. SWING, USE and BLOCK are the round buttons by your thumb, and a fourth one shows up when there is something extra to do. Tap the belt to eat or use things, your shield for skills, the scroll for your quest, and the round map for the big one. MENU opens the book with everything else.`;
  }

  // ---------- the panel: one row per setting, then the reset, then the controls; paged when the screen is short ----------
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
    { key: 'minimap', name: 'Minimap', hint: () => 'The round map in the corner. A map stud stands in for it.' },
    { key: 'words', name: 'Button words', hint: () => 'The words under SWING, BLOCK, HOME, FRIENDS and MENU.' },
  ];
  const VALUE_WORDS = { true: 'On', false: 'Off', left: 'Left', right: 'Right', normal: 'Normal', large: 'Large', small: 'Small', slow: 'Slow', fast: 'Fast', learning: 'While learning', always: 'Always', off: 'Off' };
  const text = v => typeof v === 'function' ? v() : v;
  // The page plan: every item with its height, packed onto pages that fit the panel. Measured with the context it draws on.
  function plan(g, w) {
    const T = HK.T, t = touchMode(), ctrlH = HK.row(), iw = w - 36;
    const bw = VW < 400 ? 112 : t ? 124 : 112, textW = iw - bw - 12;
    const hintF = HK.FS(600, 12), lh = Math.round(15 * HK.k() * 10) / 10;
    const items = [];
    for (const row of ROWS) {
      const hint = HK.wrap(g, text(row.hint), textW, 3, hintF);
      const textH = 18 + hint.lines.length * lh + 4, rowH = Math.max(ctrlH, textH);
      items.push({ kind: 'row', row, hint: hint.lines, h: rowH + 10, rowH, textH });
    }
    items.push({ kind: 'reset', h: ctrlH + 14 });
    items.push({ kind: 'head', h: 24 });
    if (t) {
      const f = HK.FS(600, 13), lines = HK.wrap(g, controlsText(), iw, 12, f).lines, clh = Math.round(17 * HK.k() * 10) / 10;
      // the paragraph goes in chunks of up to four lines, so a short screen can carry it over a page break
      for (let i = 0; i < lines.length; i += 4) { const part = lines.slice(i, i + 4); items.push({ kind: 'para', lines: part, lh: clh, h: part.length * clh + 4 }); }
    } else {
      const rows = keyMap(), cols = iw >= 380 ? 2 : 1, per = Math.ceil(rows.length / cols);
      const capW = Math.max(62, ...rows.map(r => r.keys.reduce((a, k) => a + HK.keycapW(g, k, 10) + 4, 0) + 6));
      for (let i = 0; i < per; i++) items.push({ kind: 'keys', cells: Array.from({ length: cols }, (_, c) => rows[c * per + i]).filter(Boolean), cols, capW, h: 22 });
    }
    return { items, bw, textW, hintF, lh, iw, T };
  }
  function paginate(items, avail) {
    const pages = [[]]; let used = 0;
    for (const it of items) {
      // a heading never ends a page on its own
      const need = it.kind === 'head' ? it.h + 22 : it.h;
      if (used + need > avail && pages[pages.length - 1].length) { pages.push([]); used = 0; }
      pages[pages.length - 1].push(it); used += it.h;
    }
    return pages;
  }
  HOOKS.panel.settings = (g, narrow) => {
    const room = panelRoom(460, VH), w = room.w, top = 62, foot = 12, pagerH = HK.row() + 16;
    const P = plan(g, w);
    const total = P.items.reduce((a, it) => a + it.h, 0);
    const one = top + total + foot <= room.h;
    const pages = one ? [P.items] : paginate(P.items, room.h - top - foot - pagerH);
    // the box is as tall as its fullest page (the pager keeps one place on every page), never taller than the room
    const h = one ? top + total + foot : Math.min(room.h, top + Math.max(...pages.map(pg => pg.reduce((a, it) => a + it.h, 0))) + pagerH + foot);
    settingsPage = clamp(settingsPage, 0, pages.length - 1);
    const { px, py } = panelBox(g, w, h, 'Settings', touchMode() ? 'Tap a button to change it. Tap outside to close.' : 'Click a button to change it. Esc or , closes.');
    const T = HK.T, x0 = px + 18, iw = P.iw, ctrlH = HK.row();
    let y = py + top;
    for (const it of pages[settingsPage]) {
      if (it.kind === 'row') {
        const row = it.row, ty = y + Math.max(0, (it.rowH - it.textH) / 2);
        HK.text(g, text(row.name), x0, ty + 15, { font: HK.FC(800, 13), color: T.ink, box: { x: x0, y, w: P.textW, h: it.rowH }, fitId: 'settings:name' });
        it.hint.forEach((l, i) => HK.text(g, l, x0, ty + 18 + (i + 1) * P.lh - 2, { font: P.hintF, color: T.inkDim, box: { x: x0, y, w: P.textW, h: it.rowH }, fitId: 'settings:hint' }));
        const v = S[row.key], isToggle = typeof v === 'boolean';
        platePush(g, x0 + iw - P.bw, y + (it.rowH - ctrlH) / 2, P.bw, ctrlH, 'set:' + row.key, VALUE_WORDS[String(v)] || String(v), () => cycle(row.key), isToggle && v ? 'primary' : null, { name: text(row.name), on: false });
        // a gold hairline between rows
        g.fillStyle = 'rgba(217,178,92,0.22)'; g.fillRect(x0, y + it.h - 5, iw, 1);
      } else if (it.kind === 'reset') {
        const armed = confirmActive('settings-reset');
        platePush(g, x0, y + 4, iw, ctrlH, 'set:reset', armed ? 'Really reset? Tap again' : 'Put every setting back to normal', () => confirmTap('settings-reset', reset), 'danger', { emblem: 'erase', name: 'Put every setting back to normal' });
      } else if (it.kind === 'head') {
        HK.text(g, 'CONTROLS', x0, y + 17, { font: HK.FC(800, 12), color: T.gold, box: { x: x0, y, w: iw, h: 24 }, fitId: 'settings:head' });
        g.fillStyle = 'rgba(217,178,92,0.35)'; g.fillRect(x0 + 84, y + 12, iw - 84, 1);
      } else if (it.kind === 'para') {
        it.lines.forEach((l, i) => HK.text(g, l, x0, y + 13 + i * it.lh, { font: HK.FS(600, 13), color: T.inkDim, box: { x: x0, y, w: iw, h: it.h }, fitId: 'settings:controls' }));
      } else if (it.kind === 'keys') {
        const cw = iw / it.cols;
        it.cells.forEach((r, c) => {
          const cx0 = x0 + c * cw; let kx = cx0;
          for (const k of r.keys) kx += HK.keycap(g, kx, y + 2, k, 10) + 4;
          const capW = it.capW, room2 = cw - capW - 10;
          let f = HK.FS(600, 12); if (HK.tw(g, r.action, f) > room2) f = HK.FS(600, 10.5);
          const words = HK.tw(g, r.action, f) > room2 ? (HK.wrap(g, r.action, room2, 1, f).lines[0] || r.action) : r.action;
          HK.text(g, words, cx0 + capW, y + 15, { font: f, color: T.ink, box: { x: cx0 + capW, y, w: room2, h: 22 }, fitId: 'settings:key' });
        });
      }
      y += it.h;
    }
    if (pages.length > 1) rowPager(g, x0, py + h - foot - HK.row() - 4, iw, settingsPage, pages.length, p => { settingsPage = p; });
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
    // turn to the page that holds a control (the panel pages on short screens)
    const seek = lab => { for (let p = 0; p < 12; p++) { settingsPage = p; render(); if (buttons.some(b => b.label === lab)) return true; if (!buttons.some(b => b.label === 'Next')) break; } return false; };
    try {
      // opens from the pause menu and with ,
      { paused = true; render(); const c = F.clickButton('Settings'); const fromMenu = c && !paused && panel === 'settings'; closePanel();
        F.press('Comma'); const byKey = panel === 'settings'; const rows = [];
        // the rows may run over more than one page on a short screen: walk every page
        for (let p = 0; p < 12; p++) { settingsPage = p; render(); for (const b of rectsOf()) if (b.label.startsWith('set:') && !rows.includes(b.label.slice(4))) rows.push(b.label.slice(4)); if (!buttons.some(b => b.label === 'Next')) break; }
        settingsPage = 0; F.press('Comma'); const closed = panel === null;
        check('settings: opens from the pause menu Settings button and with the , key; one control per row plus reset (over every page)', fromMenu && byKey && closed && rows.join() === ROWS.map(r => r.key).join() + ',reset', { fromMenu, byKey, closed, rows }); }
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
        // The question here is which half of the screen starts the stick, so each tap is made against a freshly
        // drawn frame with the on-screen buttons cleared: at these coordinates the touch layout's thumb cluster
        // (SWING, BLOCK) is sitting right where the test taps, and a button would swallow the press and hide
        // whatever pointerDown actually did with it. Clearing them tests the stick-side rule and nothing else.
        const tapAtStick = (x, id) => { render(); buttons.length = 0; pointerDown(x, sy, id); };
        set('stick', 'right'); tapAtStick(VW * 0.75, 7); const rOn = touch.stickId === 7 && touch.active; touch.press = null; pointerUp(7); tapAtStick(VW * 0.25, 8); const lOff = touch.stickId === null; touch.press = null; pointerUp(8);
        const zoneR = joystickZone(VW - 100, VH - 60) && !joystickZone(100, VH - 60) && window.__stickRight === true;
        set('stick', 'left'); tapAtStick(VW * 0.25, 9); const lOn = touch.stickId === 9; touch.press = null; pointerUp(9); tapAtStick(VW * 0.75, 10); const rOff = touch.stickId === null; touch.press = null; pointerUp(10);
        const zoneL = joystickZone(100, VH - 60) && !joystickZone(VW - 100, VH - 60) && window.__stickRight === false;
        window.__forceTouch = prevTouch;
        check('settings: stick side right starts the stick on the right half only (and the dialogue-safe zone moves); left is the core behaviour', rOn && lOff && zoneR && lOn && rOff && zoneL, { rOn, lOff, zoneR, lOn, rOff, zoneL }); }
      // text size
      { const P = { get font() { return this._f; }, set font(v) { this._f = v; } }; const fake = Object.create(P); fake._f = '10px x'; const ok = installFontScale(fake);
        set('text', 'large'); fake.font = '16px sans-serif'; const big = fake._f === '18.4px sans-serif' && fake.font === '16px sans-serif' && scaleFont('bold 13px sans-serif') === 'bold 15px sans-serif';
        set('text', 'small'); fake.font = '16px sans-serif'; const small = fake._f === '14.4px sans-serif' && fake.font === '16px sans-serif' && scaleFont('bold 13px sans-serif') === 'bold 11.7px sans-serif';
        set('text', 'normal'); fake.font = '16px sans-serif'; const same = fake._f === '16px sans-serif' && scaleFont('16px sans-serif') === '16px sans-serif';
        check('settings: text size large scales every font set on the canvas by 1.15 and small by 0.9 (reads give back the unscaled font)', ok && big && small && same, { ok, big, small, same, live: typeof ctx.font }); }
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
      { set('text', 'large'); set('damage', false); set('stick', 'right'); openPanel('settings'); seek('set:reset'); const c1 = F.clickButton('set:reset'); const still = S.text === 'large' && S.damage === false && buttons.some(b => b.label === 'set:reset'); render();
        const c2 = F.clickButton('set:reset'); const done = S.text === 'normal' && S.damage === true && S.stick === 'left' && JSON.parse(lsGet(KEY)).text === 'normal'; closePanel(); uxConfirm = null;
        check('settings: reset needs two taps and puts every setting back to normal', c1 && still && c2 && done, { c1, still, c2, done }); }
      // controls line reads the real handlers
      { const map = keyMap(); const by = code => map.find(r => r.codes.includes(code)); const e = by('KeyE'), sp = by('Space'), st = by('Comma'), mu = by('KeyN'), mv = by('KeyW');
        const codes = []; const re = /pressed\.has\('([A-Za-z0-9]+)'/g; let m; while ((m = re.exec(String(update)))) codes.push(m[1]); const all = codes.every(c => map.some(r => r.codes.includes(c)));
        window.__forceTouch = true; const t = controlsText(); window.__forceTouch = false; const d = controlsText(); window.__forceTouch = prevTouch;
        check('settings: the Controls line is built from the real key handlers (E use, Space swing, comma settings, N music, WASD walk) and every key 07-update reads is listed; touch names the buttons instead', !!e && e.action === 'Use or talk' && !!sp && /^Swing/.test(sp.action) && !!st && st.action === 'Settings' && !!mu && /Music/.test(mu.action) && !!mv && /WASD/.test(mv.label) && mv.codes.includes('ArrowUp') && all && /SWING/.test(t) && /USE/.test(t) && /Swing, shoot, stomp: Space/.test(d), { e: e && e.codes, sp: sp && sp.codes, st: st && st.codes, mu: mu && mu.codes, mv: mv && mv.label, all, t, d }); }
      // key coverage: every key the game answers (INVENTORY.json's 'keys' paragraph) is in the one table, each read from a real
      // handler, P listed with both of its jobs, G with X beside it, T while paused
      { const map = keyMap();
        const need = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyQ', 'Digit', 'KeyI', 'KeyC', 'Tab', 'KeyJ', 'KeyM', 'Slash', 'F1', 'KeyH', 'KeyX', 'Enter', 'Escape', 'KeyT', 'Comma', 'KeyK', 'KeyN', 'KeyR', 'KeyG', 'KeyV', 'KeyB', 'KeyL', 'KeyP', 'KeyF', 'KeyY'];
        const srcs = []; { let u = update; while (typeof u === 'function' && u.__inner) u = u.__inner; srcs.push(String(u)); } for (const hk of HOOKS.update) srcs.push(String(hk)); if (typeof frame === 'function') srcs.push(String(frame)); srcs.push(String(inputVector));
        const src = srcs.join('\n'), helped = new Set(); for (const k of HOOKS.keyHelp) for (const c of k.codes) helped.add(c);
        const heard = c => c === 'Digit' ? /pressed\.has\('Digit'\s*\+/.test(src) : src.includes(`pressed.has('${c}'`) || src.includes(`keys.has('${c}'`) || helped.has(c);
        const missing = need.filter(c => !map.some(r => r.codes.includes(c))), deaf = need.filter(c => !heard(c));
        const p = map.find(r => r.codes.includes('KeyP')), gRow = map.find(r => r.codes.includes('KeyG')), tRow = map.find(r => r.codes.includes('KeyT'));
        const pJobs = !!p && p.jobs.length >= 2 && HOOKS.keyHelp.filter(k => k.codes.includes('KeyP')).every(k => p.jobs.includes(k.action));
        const shape = map.every(r => typeof r.action === 'string' && r.action && Array.isArray(r.codes) && r.codes.length && Array.isArray(r.keys) && r.keys.length && r.label === r.keys.join(' or '));
        check('settings: the key table lists every key the game answers (W A S D / arrows, Space, E, Q, 1-5, I, C, Tab, J, M, / or F1, H, X, Enter, Esc, T, comma, K, N, R, G or X, V, B, L, P with both its jobs, F, Y), each one read from a real handler', !missing.length && !deaf.length && pJobs && !!gRow && gRow.keys.includes('X') && !!tRow && shape, { missing, deaf, p: p && p.jobs, g: gRow && gRow.keys, t: !!tRow, rows: map.length, shape }); }
      // the book's Keys card (src/59-hudkit.js drawKeys) fits every row at 1280x800: the rows fit its columns, each row's keycaps
      // fit the key column, and its words fit one line (12 px, or the card's 10.5 px step at Large text)
      { const B = HK.bookLayoutFor(1280, 800, { touch: false, online: true, page: 'keys', tiles: HK.bookTiles().length, extraRows: Math.max(1, HOOKS.pauseMenu.length) });
        const kb = B.keysBox, fc = HK.audit.fitCtx(), rows = keyMap(), bad = [];
        const lh = 20, per = kb ? Math.max(1, Math.floor((kb.h - 30) / lh)) : 0, cols = rows.length > per ? 2 : 1, cw = kb ? kb.w / cols : 0, capW = cols > 1 ? 58 : Math.min(150, kb ? kb.w * 0.42 : 0), room = cw - capW - 8;
        const t0 = S.text;
        for (const big of ['normal', 'large']) {
          S.text = big;
          for (const r of rows) {
            const capsW = r.keys.reduce((a, k) => a + HK.keycapW(fc, k, 9) + 4, 0) - 4;
            if (capsW > capW - 4) bad.push(`${big}: keys ${r.label} are ${Math.round(capsW)} px, the key column ${capW - 4}`);
            const w12 = HK.tw(fc, r.action, HK.FS(600, 12)), w10 = HK.tw(fc, r.action, HK.FS(600, 10.5));
            if (big === 'normal' ? w12 > room : w10 > room) bad.push(`${big}: "${r.action}" is ${Math.round(big === 'normal' ? w12 : w10)} px, the words column ${Math.round(room)}`);
          }
        }
        S.text = t0;
        check('settings: the book\'s Keys card fits the whole key table at 1280x800 (rows in its two columns, keycaps in the key column, the words on one line)', !!kb && rows.length <= per * cols && bad.length === 0, { rows: rows.length, room: per * cols, cols, bad: bad.slice(0, 8) }); }
      // layout at all 8 device sizes, touch and mouse, every page, normal and Large text: from the close seal on, controls are
      // 44 px on touch (26 with a mouse), 8 px apart on touch (4), on screen and out of the notch / home bands; every string fits
      // its plate at Large. The book (pause menu) passes the kit's frame audit and the talk box fits.
      { const restore = panelSizeSaver(), problems = []; let tried = 0, pagesSeen = 0;
        try {
          for (const [w, hh] of HK.audit.SIZES) {
            if (!panelSetSize(w, hh)) continue; tried++;
            for (const tch of [true, false]) {
              window.__forceTouch = tch;
              for (const big of ['normal', 'large']) {
                set('text', big);
                const where = `${w}x${hh} ${tch ? 'touch' : 'mouse'} ${big}`;
                closePanel(); openPanel('settings');
                for (let p = 0; p < 12; p++) { settingsPage = p; problems.push(...panelFrame(`settings ${where} page ${p + 1}`)); pagesSeen++; if (!buttons.some(b => b.label === 'Next')) break; if (p === 11) problems.push(`settings ${where}: too many pages`); }
                closePanel(); paused = true; HK.BOOK.page = 'game'; panelFrame('book', { from: 0, panel: false }); problems.push(...HK.audit.frameIssues(`book ${where}`, { book: true })); paused = false; HK.BOOK.page = 'kit';
                say('A'.repeat(180) + ' ' + 'word '.repeat(30), 'The Voice'); F.step([]); render(); if (!dialogRect || dialogRect.x < 0 || dialogRect.y < 0 || dialogRect.x + dialogRect.w > VW || dialogRect.y + dialogRect.h > VH) problems.push(`dialogue ${where}: ${JSON.stringify(dialogRect)}`); dialog.cur = null; dialog.queue.length = 0;
              }
            }
          }
        } finally { set('text', 'normal'); settingsPage = 0; window.__forceTouch = prevTouch; paused = false; closePanel(); restore(); render(); }
        check('settings: the panel at all 8 device sizes, touch and mouse, every page, normal and Large text: controls 44 px on touch (26 with a mouse) and 8 px apart (4), on screen, clear of the notch and home bands, every word inside its plate; the book and the talk box fit too', tried === 8 && problems.length === 0, { tried, pagesSeen, problems: problems.slice(0, 10), total: problems.length }); }
    } finally {
      Object.assign(S, snap); apply(); save(); settingsPage = 0; uxConfirm = null; clearShake();
      window.__forceTouch = prevTouch; paused = false; closePanel(); h.peace(false); touch.press = null; touch.stickId = null; touch.active = false;
      dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq);
    }
  });

  return { get: k => S[k], set, cycle, reset, load, save, apply, addRow, state: () => ({ ...S }), DEFAULTS, OPTIONS, scaleFont, textScale, installFontScale, levelText, installTextFilter, shakeOffset, startShake, keyMap, controlsText, page: () => settingsPage };
})();
window.SETTINGS = SETTINGS;
