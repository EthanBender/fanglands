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

  // ---------- first run: Colin's existing progress (legacy key) becomes Slot 1 ----------
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

  // ---------- drawing ----------
  const KNIGHT = { tunic: '#3b6fb6', hair: '#5a3a1e', helm: '#8f96a3', shoulder: '#9aa3b2', shield: '#8a6a3a', weapon: ITEMS.iron_sword || ITEMS.wooden_sword };
  function drawTitle(g) {
    const narrow = VW < 640, short = VH < 520;
    const grad = g.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, 'rgba(6,8,14,0.88)'); grad.addColorStop(0.45, 'rgba(6,8,14,0.66)'); grad.addColorStop(1, 'rgba(6,8,14,0.92)');
    g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
    // layout: title, then a centred column of three cards; the knight and walker fill the side margins
    const cw = Math.min(narrow ? VW - 28 : 440, VW - 28), ch = short ? 54 : 66, gap = 10;
    const cx = Math.round(VW / 2 - cw / 2);
    const ty = short ? 44 : Math.round(VH * 0.19);
    const y0 = Math.round(Math.max(ty + (narrow ? 44 : 52), Math.min(narrow ? ty + 52 : VH * 0.36, VH - (3 * (ch + gap) + 60))));
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.font = `800 ${narrow ? 44 : short ? 48 : 72}px ${DISPLAY}`; g.strokeText('FANGLANDS', VW / 2, ty); g.fillStyle = '#f5c542'; g.fillText('FANGLANDS', VW / 2, ty);
    g.font = `600 ${narrow ? 14 : 18}px ${DISPLAY}`; g.lineWidth = 4; g.strokeText('A game by Colin', VW / 2, ty + (narrow ? 24 : 30)); g.fillStyle = '#c9a36a'; g.fillText('A game by Colin', VW / 2, ty + (narrow ? 24 : 30));
    // knight (left margin) and walker (right margin), bobbing slowly; scaled to the room beside the cards
    const bob = Math.sin(title.t * 1.6) * 4, bob2 = Math.sin(title.t * 1.6 + 1.3) * 4;
    const margin = cx, midY = y0 + (3 * (ch + gap) - gap) / 2, below = y0 + 3 * (ch + gap) + 60 + 70; // narrow screens: sprites sit under the cards
    const kx = narrow ? VW * 0.28 : margin / 2, ky = narrow ? below : midY, ks = narrow ? 2.6 : clamp(margin / 48, 1.6, 4);
    const wx = narrow ? VW * 0.72 : VW - margin / 2, wy = narrow ? below : midY, ws = narrow ? 2 : clamp(margin / 78, 1.3, 3.4);
    g.save(); g.translate(kx, ky); g.scale(ks, ks); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 12, 12, 5, 0, 0, 7); g.fill(); g.translate(0, bob / ks); drawHuman(g, { facing: { x: 1, y: 0 }, hurtT: 0, attackT: 0 }, KNIGHT); g.restore();
    g.save(); g.translate(wx, wy); g.scale(ws, ws); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 22, 26, 9, 0, 0, 7); g.fill(); g.translate(0, bob2 / ws); drawMech(g, { facing: { x: -1, y: 0 }, moving: true, walkT: title.t * 2.2, attackT: 0, hurtT: 0 }, false, null); g.restore();
    // slot cards
    let y = y0;
    const recent = title.recent();
    for (let n = 1; n <= 3; n++) {
      const c = title.cards[n - 1], isRecent = n === recent, armed = title.deleteArmed === n;
      roundRect(g, cx, y, cw, ch, 10); g.fillStyle = c ? 'rgba(14,20,30,0.9)' : 'rgba(10,14,22,0.7)'; g.fill(); g.strokeStyle = isRecent ? '#f5c542' : '#30363d'; g.lineWidth = isRecent ? 2 : 1; g.stroke();
      g.textAlign = 'left'; g.fillStyle = c ? '#e6edf3' : '#8b949e'; g.font = `700 ${short ? 14 : 16}px ${DISPLAY}`; g.fillText(`Slot ${n}`, cx + 16, y + (short ? 22 : 26));
      g.font = `${narrow ? 11 : 12}px sans-serif`; g.fillStyle = c ? '#c9d1d9' : '#6e7681';
      const line = c ? (c.broken ? 'Save could not be read' : narrow ? `Level ${c.level} · Ch. ${c.chapter} · ${c.region} · ${fmtTime(c.playSeconds)}` : `Combat level ${c.level} · Chapter ${c.chapter}: ${CHAPTERS[c.chapter - 1]} · ${c.region} · ${fmtTime(c.playSeconds)}`) : 'Empty · tap to start a new game';
      let shown = line; while (shown.length > 8 && g.measureText(shown + '…').width > cw - (c ? 110 : 30)) shown = shown.slice(0, -1); g.fillText(shown === line ? line : shown + '…', cx + 16, y + (short ? 40 : 48));
      if (isRecent) { g.textAlign = 'right'; g.fillStyle = '#f5c542'; g.font = 'bold 10px sans-serif'; g.fillText('LATEST', cx + cw - 92, y + 16); }
      // Delete goes in first: the first hit rect wins, and it sits on top of the card
      if (c) button(g, cx + cw - 82, y + Math.round(ch / 2 - 14), 70, 28, armed ? 'Sure?' : 'Delete', () => title.deleteTap(n), armed ? '#b33a3a' : '#5a2323');
      buttons.push({ x: cx, y, w: cw, h: ch, label: `Slot ${n}`, action: () => title.startSlot(n) });
      y += ch + gap;
    }
    if (title.hasSaves()) button(g, cx, y + 2, cw, short ? 34 : 42, 'Continue', title.continue, '#238636');
    else { g.textAlign = 'center'; g.fillStyle = '#8b949e'; g.font = '13px sans-serif'; g.fillText('Tap a slot to begin', VW / 2, y + 22); }
    button(g, VW - 124, VH - 42, 110, 30, audioMuted ? 'Sound: off' : 'Sound: on', toggleMute, '#21262d');
    g.textAlign = 'left'; g.fillStyle = 'rgba(230,237,243,0.55)'; g.font = '11px sans-serif'; g.fillText('Progress saves to this browser.', 14, VH - 22);
  }
  const _drawHud = drawHud;
  drawHud = function (g) {
    if (!title.active) return _drawHud(g);
    buttons.length = 0; minimapRect = null; // the title owns every tap
    g.textBaseline = 'alphabetic';
    drawTitle(g);
  };

  // ---------- in-game bits: play time, 'Saved' flash, TITLE from the pause menu ----------
  HOOKS.update.push(dt => { if (!title.active && !player.dead) player.playSeconds = (player.playSeconds || 0) + dt; });
  HOOKS.hud.push((g, narrow) => {
    const el = (performance.now() - title.savedAt) / 1000;
    if (el >= 0 && el < 1.2) {
      const a = el < 0.2 ? el / 0.2 : 1 - (el - 0.2) / 1;
      g.globalAlpha = clamp(a, 0, 1); g.textAlign = 'right'; g.fillStyle = '#3fb950'; g.font = 'bold 12px sans-serif'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.strokeText('Saved', VW - 16, VH - 36); g.fillText('Saved', VW - 16, VH - 36); g.globalAlpha = 1;
    }
    if (paused) {
      // sits just under the core pause box (300×250, centred); unshift so it beats any hotbar rect under it
      const pw = 300, px = VW / 2 - pw / 2, by = Math.min(VH - 46, VH / 2 + 125 + 10);
      button(g, px + 24, by, pw - 48, 36, isTouch ? 'Title screen' : 'Title screen (T)', title.toTitle, '#3a4150');
      buttons.unshift(buttons.pop());
    }
  });

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
  });
}
