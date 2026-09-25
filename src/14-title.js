// ============================================================================
// TITLE SCREEN + SAVE SLOTS — boot lands on a title screen drawn over the village
// square; three save slots live in localStorage under fanglands.slot.N (the legacy
// SAVE_KEY keeps a mirror of whichever slot was saved last). Wraps save / load /
// newGame / drawHud by reassignment; 99-boot drives the frame loop through `title`.
// ============================================================================
const title = {
  active: false,        // true while the title screen is up: update() is skipped, input is swallowed
  slot: 1,              // the slot every save() writes to
  t: 0,                 // seconds on the title screen (sprite bob, delete arm timeout)
  bootActive: false,    // set by 99-boot right after the first open(): was the title up before any input?
  deleteArmed: 0,       // slot number whose Delete was tapped once (0 = none)
  deleteAt: 0,
  cards: [null, null, null], // per-slot summaries ({ level, chapter, region, playSeconds, at }) or null when empty
  savedAt: -1e9,        // performance.now() of the last save, for the 'Saved' flash
  lastAt: 0,
};
window.FANGLANDS.title = title;
{
  const SLOT_KEY = n => 'fanglands.slot.' + n;
  const AT_KEY = n => 'fanglands.slot.' + n + '.at';
  const CUR_KEY = 'fanglands.slot.current';
  const SQUARE = { x: 112, y: 32 }; // Thistledown's cobbled square, the title backdrop
  const CHAPTERS = ['The Cave', 'Thistledown', 'Goblin Tech', 'Hollowford', 'The Fang'];
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };
  const chapterFor = stage => stage < 5 ? 1 : stage < 7 ? 2 : stage < 9 ? 3 : stage < 14 ? 4 : 5;
  const fmtTime = s => { s = Math.floor(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}h ${m}m` : m ? `${m}m` : `${s}s`; };
  const stamp = () => { const at = Math.max(Date.now(), title.lastAt + 1); title.lastAt = at; return at; };
  title.chapterFor = chapterFor; title.slotKey = SLOT_KEY;

  // ---------- first run: Cohen's existing progress (legacy key) becomes Slot 1 ----------
  // only on a true first run (no slot has ever been saved): otherwise a deleted Slot 1 would come back from the legacy mirror
  { const legacy = lsGet(SAVE_KEY); if (legacy && !lsGet(SLOT_KEY(1)) && lsGet(CUR_KEY) == null) { lsSet(SLOT_KEY(1), legacy); lsSet(AT_KEY(1), stamp()); } }
  { const cur = +lsGet(CUR_KEY); title.slot = cur >= 1 && cur <= 3 ? cur : 1; }

  // ---------- slot summaries (parsed once per refresh, not per frame) ----------
  function summarize(n) {
    const raw = lsGet(SLOT_KEY(n)); if (!raw) return null;
    try {
      const d = JSON.parse(raw); const p = d.player || {}; const skills = p.skills || {};
      const lv = k => levelForXp((skills[k] && skills[k].xp) || 0);
      const level = Math.max(1, Math.floor((lv('melee') + lv('defence')) / 2 + lv('range') / 4));
      const stage = (d.quest && d.quest.stage) || 0;
      const region = p.region || regionAt(Math.floor((p.x || 0) / TILE), Math.floor((p.y || 0) / TILE)).name;
      return { level, chapter: chapterFor(stage), region, playSeconds: p.playSeconds || 0, at: +lsGet(AT_KEY(n)) || 0 };
    } catch (e) { return { level: 1, chapter: 1, region: 'Unknown', playSeconds: 0, at: +lsGet(AT_KEY(n)) || 0, broken: true }; }
  }
  title.refresh = () => { for (let n = 1; n <= 3; n++) title.cards[n - 1] = summarize(n); };
  title.recent = () => { let best = 0, bestAt = -1; for (let n = 1; n <= 3; n++) { const c = title.cards[n - 1]; if (c && c.at > bestAt) { best = n; bestAt = c.at; } } return best; };
  title.hasSaves = () => title.cards.some(Boolean);

  // ---------- wraps: save writes the current slot, load reads it, newGame clears it ----------
  const _save = save;
  save = function () {
    if (title.active) return; // the title backdrop is never a save
    _save();
    const raw = lsGet(SAVE_KEY); if (raw == null) return; // storage unavailable
    lsSet(SLOT_KEY(title.slot), raw); lsSet(AT_KEY(title.slot), stamp()); lsSet(CUR_KEY, title.slot);
    title.savedAt = performance.now();
  };
  const _load = load;
  load = function () {
    const raw = lsGet(SLOT_KEY(title.slot)); if (raw == null) return false;
    lsSet(SAVE_KEY, raw); // the core reads the legacy key; keep it as a mirror of the slot
    return _load();
  };
  const _newGame = newGame;
  newGame = function () {
    _newGame();
    lsDel(SLOT_KEY(title.slot)); lsDel(AT_KEY(title.slot));
    title.active = false;
  };
  window.FANGLANDS.newGame = newGame; // the harness captured the core function by value; point it at the wrapper

  // ---------- open / start / delete ----------
  title.open = () => {
    title.active = true; title.t = 0; title.deleteArmed = 0;
    paused = false; closePanel(); dialog.cur = null; dialog.queue.length = 0; notice = null; levelBanner = null; areaBanner = null;
    player.x = tc(SQUARE.x); player.y = tc(SQUARE.y); player.action = null; player.moving = false; player.dead = false; player.hurtT = 0;
    keys.clear(); pressed.clear(); touch.taps.length = 0;
    title.refresh();
  };
  title.toTitle = () => { save(); title.open(); };
  title.startSlot = n => {
    title.slot = n; lsSet(CUR_KEY, n);
    const has = !!lsGet(SLOT_KEY(n));
    _newGame(); // fresh world + feature state, exactly like a cold boot; load() lays the slot over it
    title.active = false;
    if (has && load()) { notify('Welcome back, knight.'); introT = 5; }
    else save(); // a brand-new slot claims its key straight away
    keys.clear(); pressed.clear(); touch.taps.length = 0;
  };
  title.continue = () => { const n = title.recent(); title.startSlot(n || 1); };
  title.deleteTap = n => {
    if (title.deleteArmed !== n) { title.deleteArmed = n; title.deleteAt = title.t; return false; }
    lsDel(SLOT_KEY(n)); lsDel(AT_KEY(n)); title.deleteArmed = 0; title.refresh(); return true;
  };
  // called by 99-boot every frame while the title is up, instead of update()
  title.tick = dt => {
    title.t += dt; time += dt; // water keeps rippling behind the title
    if (title.deleteArmed && title.t - title.deleteAt > 4) title.deleteArmed = 0;
    if (pressed.has('Enter') || pressed.has('Space')) title.continue();
    pressed.clear(); keys.clear(); touch.taps.length = 0;
  };

  // ---------- drawing: the kit's materials (src/59-hudkit.js) over the village square ----------
  // FANGLANDS in gold Cinzel with the flourish, the three slots as vellum cards (the latest one gold-edged), plate buttons
  // for Continue / Delete / Sound, and nothing tappable in the notch or home-indicator bands. 71-login draws the online
  // title with the same heading, sprites and bottom row (title.heading / title.sprites / title.chrome).
  const KNIGHT = { tunic: '#3b6fb6', hair: '#5a3a1e', helm: '#8f96a3', shoulder: '#9aa3b2', shield: '#8a6a3a', weapon: ITEMS.iron_sword || ITEMS.wooden_sword };
  // the frame every title screen shares: safe insets, the heading's place, the bottom row's place
  title.frame = () => {
    const t = touchMode(), fam = HK.family(VW, VH, t), S = HK.insets(VW, VH, fam, t), M = 12;
    const narrow = VW < 640, short = VH < 520;
    const size = narrow ? 44 : short ? 40 : 64;
    const ty = Math.round(short ? S.t + 44 : Math.max(S.t + 58, VH * 0.17));
    const headBottom = ty + (short ? 26 : narrow ? 44 : 52);
    const rowH = t ? 44 : 36, bottomY = VH - S.b - M - rowH;
    return { t, fam, S, M, narrow, short, size, ty, headBottom, rowH, bottomY, left: S.l + M, right: VW - S.r - M };
  };
  title.backdrop = g => {
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, 'rgba(8,6,4,0.88)'); grad.addColorStop(0.45, 'rgba(8,6,4,0.62)'); grad.addColorStop(1, 'rgba(8,6,4,0.92)');
    g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
  };
  title.heading = (g, F) => {
    const T = HK.T;
    HK.text(g, 'FANGLANDS', VW / 2, F.ty, { font: HK.FC(800, F.size), align: 'center', color: T.goldHi, halo: 6, haloColor: 'rgba(0,0,0,0.8)', shadow: 'rgba(0,0,0,0.9)' });
    const sy = F.ty + (F.short ? 20 : F.narrow ? 24 : 30);
    HK.text(g, 'A game by Cohen', VW / 2, sy, { font: HK.FS(600, F.short ? 13 : F.narrow ? 14 : 16), align: 'center', color: T.inkDim, halo: 3 });
    if (!F.short) HK.flourish(g, VW / 2, sy + 14, Math.min(260, VW - 80));
  };
  title.sprites = (g, kx, ky, ks, wx, wy, ws) => {
    const bob = Math.sin(title.t * 1.6) * 4, bob2 = Math.sin(title.t * 1.6 + 1.3) * 4;
    g.save(); g.translate(kx, ky); g.scale(ks, ks); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 12, 12, 5, 0, 0, 7); g.fill(); g.translate(0, bob / ks); drawHuman(g, { facing: { x: 1, y: 0 }, hurtT: 0, attackT: 0 }, KNIGHT); g.restore();
    g.save(); g.translate(wx, wy); g.scale(ws, ws); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 22, 26, 9, 0, 0, 7); g.fill(); g.translate(0, bob2 / ws); drawMech(g, { facing: { x: -1, y: 0 }, moving: true, walkT: title.t * 2.2, attackT: 0, hurtT: 0 }, false, null); g.restore();
  };
  // the bottom row: Sound on the right (a plate, gold-edged while on), an optional plate on the left (71's Play online),
  // and one line about saving above the left end
  // title.leftButton: () => null | { label, action, emblem } — a plate at the left end of the bottom row (71-login's Play online)
  title.leftButton = () => null;
  title.chromeGeom = F => {
    const sw = F.t ? 136 : 124, sx = F.right - sw, lb = title.leftButton(), lw = lb ? Math.min(150, sx - 12 - F.left) : 0;
    return { sw, sx, lb, lw, lr: lb ? F.left + lw : F.left - 10 };
  };
  // avoid: a rect the footer words must stay beside (the card stack, when it comes down to the bottom row)
  title.chrome = (g, F, footer, avoid) => {
    const T = HK.T, C = title.chromeGeom(F), { sw, sx, lb, lw } = C, on = !audioMuted;
    platePush(g, sx, F.bottomY, sw, F.rowH, on ? 'Sound: on' : 'Sound: off', on ? 'Sound: on' : 'Sound: off', toggleMute, on ? 'primary' : null, { emblem: 'music', name: 'Sound effects' });
    let lx = F.left;
    if (lb) { platePush(g, F.left, F.bottomY, lw, F.rowH, lb.label, lb.label, lb.action, null, { emblem: lb.emblem || null }); lx = F.left + lw + 12; }
    const beside = avoid && avoid.y + avoid.h > F.bottomY - 4 && avoid.x > lx;
    // footer: a sentence, or a list of them longest first: the first that fits two lines beside the plates is drawn
    const room = (beside ? Math.min(sx, avoid.x) : sx) - 12 - lx, f = HK.FS(600, 12);
    const pick = [].concat(footer).find(o => !HK.wrap(g, o, room, 2, f).more && HK.wrap(g, o, room, 2, f).lines.every(l => HK.tw(g, l, f) <= room));
    const lines = pick ? HK.wrap(g, pick, room, 2, f).lines : [];
    const lh = Math.round(15 * HK.k()), y0 = F.bottomY + F.rowH / 2 - (lines.length - 1) * lh / 2 + 4;
    lines.forEach((l, i) => HK.text(g, l, lx, y0 + i * lh, { font: f, color: T.inkDim, halo: 3, box: { x: lx, y: F.bottomY, w: room, h: F.rowH }, fitId: 'title:footer' }));
  };
  // each line of a card, longest first: the first that fits its room is drawn (whole words, never cut)
  const cardLines = (c, short) => {
    const tap = touchMode() ? 'Tap' : 'Click';
    if (!c) return [[`Empty. ${tap} to start a new game.`, `Empty. ${tap} to start.`, 'Empty']];
    if (c.broken) return [['This save could not be read.', 'Cannot be read']];
    const lv = [`Combat level ${c.level}, Chapter ${c.chapter}: ${CHAPTERS[c.chapter - 1]}`, `Level ${c.level}, Chapter ${c.chapter}: ${CHAPTERS[c.chapter - 1]}`, `Level ${c.level}, Chapter ${c.chapter}`];
    const at = [`${c.region}, played ${fmtTime(c.playSeconds)}`, `${c.region}`, `Played ${fmtTime(c.playSeconds)}`];
    if (short) return [[`Level ${c.level}, Chapter ${c.chapter}, ${c.region}`, `Level ${c.level}, Chapter ${c.chapter}`]];
    return [lv, at];
  };
  function drawTitle(g) {
    const F = title.frame(), T = HK.T;
    title.backdrop(g);
    title.heading(g, F);
    const ch = F.short ? 60 : 74, gap = 10, contH = F.t ? 48 : 40, stackH = 3 * ch + 2 * gap + 12 + contH;
    const y0 = Math.round(Math.max(F.headBottom + 14, Math.min(F.headBottom + 40, F.bottomY - 12 - stackH)));
    let cw = Math.min(F.narrow ? F.right - F.left - 4 : 440, F.right - F.left - 4);
    // when the cards reach down to the bottom row (a phone held sideways), they narrow to stay clear of its plates
    if (y0 + stackH > F.bottomY - 8) { const C = title.chromeGeom(F); cw = Math.min(cw, 2 * Math.min(C.sx - 10 - VW / 2, VW / 2 - C.lr - 10)); }
    const cx = Math.round(VW / 2 - cw / 2);
    // the knight and the walker: in the side margins, or under the cards on a narrow screen when there is room
    const midY = y0 + (3 * (ch + gap) - gap) / 2;
    if (!F.narrow) { const margin = cx - F.left; if (margin > 70) title.sprites(g, F.left + margin / 2, midY, clamp(margin / 48, 1.6, 4), F.right - margin / 2, midY, clamp(margin / 78, 1.3, 3.4)); }
    else { const free = F.bottomY - 12 - (y0 + stackH); if (free > 110) { const sy = y0 + stackH + free / 2 + 10; title.sprites(g, VW * 0.28, sy, 2.4, VW * 0.72, sy, 1.9); } }
    // the slot cards
    let y = y0;
    const recent = title.recent(), delW = F.t ? 92 : 80, delH = HK.row();
    for (let n = 1; n <= 3; n++) {
      const c = title.cards[n - 1], isRecent = n === recent, armed = title.deleteArmed === n;
      g.save(); if (!c) g.globalAlpha *= 0.82;
      HK.vellumPlate(g, cx, y, cw, ch, { edge: isRecent ? 'rgba(247,220,143,0.95)' : null });
      g.restore();
      const textW = cw - 32 - (c ? delW + 12 : 0), tf = HK.FC(800, F.short ? 14 : 16);
      const nameY = y + (F.short ? 22 : 25);
      HK.text(g, `SLOT ${n}`, cx + 16, nameY, { font: tf, color: c ? T.ink : T.inkDim, shadow: 'rgba(0,0,0,0.9)', box: { x: cx + 16, y, w: textW, h: ch }, fitId: 'title:slot' });
      if (isRecent) HK.text(g, 'LATEST', cx + 16 + HK.tw(g, `SLOT ${n}`, tf) + 10, nameY - 1, { font: HK.FC(800, 10), color: T.gold, box: { x: cx + 16, y, w: textW, h: ch }, fitId: 'title:latest' });
      const lf = HK.FS(600, F.short ? 12 : 13), lh = Math.round((F.short ? 15 : 16) * HK.k());
      const lines = cardLines(c, F.short).map(opts => opts.find(o => HK.tw(g, o, lf) <= textW) || HK.wrap(g, opts[opts.length - 1], textW, 1, lf).lines[0] || '');
      lines.forEach((l, i) => HK.text(g, l, cx + 16, nameY + 19 + i * lh, { font: lf, color: c ? T.inkDim : T.inkMute, box: { x: cx + 16, y, w: textW, h: ch }, fitId: 'title:line' }));
      // the card is its own button (Delete sits beside its tap area, never under it)
      const dx = cx + cw - 12 - delW;
      buttons.push({ x: cx, y, w: c ? dx - 8 - cx : cw, h: ch, label: `Slot ${n}`, action: () => title.startSlot(n), up: true, name: c ? `Play slot ${n}` : `Start a new game in slot ${n}` });
      if (c) platePush(g, dx, y + Math.round((ch - delH) / 2), delW, delH, armed ? 'Sure?' : 'Delete', armed ? 'Sure?' : 'Delete', () => title.deleteTap(n), 'danger', { name: armed ? 'Tap again to delete this slot' : 'Delete this slot' });
      y += ch + gap;
    }
    if (title.hasSaves()) platePush(g, cx, y + 2, cw, contH, 'Continue', 'Continue', title.continue, 'primary', { emblem: 'play', cinzel: true, name: 'Continue the latest game', keys: touchMode() ? [] : ['Enter'] });
    else HK.text(g, touchMode() ? 'Tap a slot to begin' : 'Click a slot to begin', VW / 2, y + 26, { font: HK.FS(600, 14), align: 'center', color: T.inkDim, halo: 3 });
    title.chrome(g, F, ['Progress saves to this browser.', 'Saves to this browser.'], { x: cx, y: y0, w: cw, h: stackH });
  }
  const _drawHud = drawHud;
  drawHud = function (g) {
    if (!title.active) return _drawHud(g);
    buttons.length = 0; minimapRect = null; // the title owns every tap
    g.textBaseline = 'alphabetic';
    drawTitle(g);
  };

  // ---------- in-game bits: play time, the 'Saved' tick, TITLE from the book (the pause menu) ----------
  HOOKS.update.push(dt => { if (!title.active && !player.dead) player.playSeconds = (player.playSeconds || 0) + dt; });
  // the 'Saved' flash is a green tick on the crest's banner for 1.2 s (src/59-hudkit.js reads title.savedAt)
  // The book's Title screen row (a slot in HOOKS.pauseMenu, drawn after the book resets `buttons`, so it is tappable). Its tap
  // label stays 'Title screen (T)' on a computer and 'Title screen' on touch; the plate shows the words and, on a computer,
  // the T keycap, the castle emblem the kit gives every Title screen row.
  title.row = (g, x, y, w, h) => {
    const label = isTouch ? 'Title screen' : 'Title screen (T)', key = touchMode() ? null : 'T';
    platePush(g, x, y, w, h, label, 'Title screen', title.toTitle, null, { emblem: 'castle', cinzel: true, key: w >= 110 && key ? key : null, name: 'Save and go to the title screen', keys: key ? [key] : [] });
  };
  HOOKS.pauseMenu.push((g, x, y, w, h) => title.row(g, x, y, w, h));

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    check('title: up on a fresh boot, dismissed by new game', title.bootActive === true && title.active === false, { bootActive: title.bootActive, active: title.active });
    check('title: chapter from quest stage (0,6,9,14,16 → 1,2,4,5,5)', [0, 6, 9, 14, 16].map(chapterFor).join() === '1,2,4,5,5' && chapterFor(4) === 1 && chapterFor(5) === 2 && chapterFor(7) === 3 && chapterFor(8) === 3 && chapterFor(13) === 4, { got: [0, 6, 9, 14, 16].map(chapterFor) });
    title.startSlot(1); player.kills = 11; save(); const raw1 = lsGet(SLOT_KEY(1));
    title.startSlot(2);
    check('title: starting slot 2 makes its own key', title.slot === 2 && !!lsGet(SLOT_KEY(2)) && lsGet(SLOT_KEY(2)) !== raw1 && player.kills === 0 && quest.stage === 0 && lsGet(CUR_KEY) === '2', { slot: title.slot, kills: player.kills });
    player.kills = 3; save();
    check('title: saving in slot 2 leaves slot 1 alone', lsGet(SLOT_KEY(1)) === raw1 && JSON.parse(lsGet(SLOT_KEY(2))).player.kills === 3, { k1: JSON.parse(raw1).player.kills });
    title.open(); const up = title.active && paused === false; render();
    check('title: while up it owns the buttons and swallows keys', up && buttons.some(b => b.label === 'Slot 1') && buttons.some(b => b.label === 'Continue') && buttons.some(b => b.label === 'Delete') && (pressed.add('KeyE'), keys.add('KeyD'), title.tick(1 / 60), pressed.size === 0 && keys.size === 0), { labels: buttons.map(b => b.label) });
    title.continue();
    check('title: continue loads the most recent slot (2)', !title.active && title.slot === 2 && player.kills === 3, { slot: title.slot, kills: player.kills });
    title.startSlot(1); save(); title.open(); title.continue();
    check('title: continue follows the latest save (1)', !title.active && title.slot === 1 && player.kills === 11, { slot: title.slot, kills: player.kills });
    title.open();
    const card = title.cards[0];
    check('title: slot card shows level, chapter, region, play time', !!card && card.level === combatLevel() && card.chapter === chapterFor(quest.stage) && card.region === player.region && typeof card.playSeconds === 'number', card);
    title.deleteTap(2); const still = !!lsGet(SLOT_KEY(2)) && title.deleteArmed === 2 && !!title.cards[1]; render(); const sure = buttons.some(b => b.label === 'Sure?');
    title.deleteTap(2); const gone = !lsGet(SLOT_KEY(2)) && title.cards[1] === null && title.deleteArmed === 0;
    check('title: delete needs two taps', still && sure && gone, { still, sure, gone });
    const tapOnce = title.deleteTap(3) === false && title.deleteArmed === 3; const second = title.deleteTap(1);
    check('title: arming one slot then tapping another re-arms, never deletes', tapOnce && second === false && title.deleteArmed === 1 && !!lsGet(SLOT_KEY(1)), { armed: title.deleteArmed });
    title.startSlot(1);
    const ps0 = player.playSeconds || 0; F.sim(60);
    check('title: play time accumulates in the slot', player.playSeconds > ps0 && !title.active, { playSeconds: +player.playSeconds.toFixed(2) });
    save(); check('title: save leaves a mirror in the legacy key and flashes Saved', lsGet(SAVE_KEY) === lsGet(SLOT_KEY(1)) && performance.now() - title.savedAt < 1000, {});
    // the title screen at all 8 device sizes, touch and mouse, with saves and without, normal and Large text: every control
    // 44 px on touch (26 with a mouse), 8 px apart (4), on screen and out of the notch / home bands, the slot card's tap area
    // clear of its Delete, and every word inside its card or plate
    { const restore = panelSizeSaver(), t0 = window.__forceTouch, text0 = window.SETTINGS ? SETTINGS.get('text') : 'normal', problems = []; let tried = 0;
      const keep = [1, 2, 3].map(n => [lsGet(SLOT_KEY(n)), lsGet(AT_KEY(n))]);
      try {
        title.open();
        for (const [w, hh] of HK.audit.SIZES) {
          if (!panelSetSize(w, hh)) continue; tried++;
          for (const tch of [true, false]) for (const big of ['normal', 'large']) for (const saves of [true, false]) {
            window.__forceTouch = tch; if (window.SETTINGS) SETTINGS.set('text', big);
            if (saves) { for (let n = 1; n <= 3; n++) { const [sv, at] = keep[n - 1]; if (sv != null) { lsSet(SLOT_KEY(n), sv); lsSet(AT_KEY(n), at || 1); } } title.deleteArmed = 2; } else { for (let n = 1; n <= 3; n++) { lsDel(SLOT_KEY(n)); lsDel(AT_KEY(n)); } title.deleteArmed = 0; }
            title.refresh();
            const where = `title ${w}x${hh} ${tch ? 'touch' : 'mouse'} ${big} ${saves ? 'saves' : 'empty'}`;
            problems.push(...panelFrame(where, { from: 0, panel: false }));
            if (!buttons.some(b => b.label === 'Slot 1') || !buttons.some(b => /^Sound/.test(b.label)) || (saves && !buttons.some(b => b.label === 'Continue'))) problems.push(`${where}: missing controls ${buttons.map(b => b.label).join(',')}`);
          }
        }
      } finally {
        for (let n = 1; n <= 3; n++) { const [sv, at] = keep[n - 1]; if (sv == null) { lsDel(SLOT_KEY(n)); lsDel(AT_KEY(n)); } else { lsSet(SLOT_KEY(n), sv); lsSet(AT_KEY(n), at || Date.now()); } }
        title.deleteArmed = 0; window.__forceTouch = t0; if (window.SETTINGS) SETTINGS.set('text', text0); restore(); title.startSlot(1);
      }
      check('title: the title screen at all 8 device sizes, touch and mouse, with saves and without, normal and Large text: controls 44 px on touch (26 with a mouse), 8 px apart (4), on screen, out of the notch and home bands, and every word inside its card', tried === 8 && problems.length === 0 && !title.active, { tried, problems: problems.slice(0, 10), total: problems.length }); }
  });
}
