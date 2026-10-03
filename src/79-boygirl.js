// ============================================================================
// BOY OR GIRL — Cohen: "at the beginning of the game, you can choose your gender, and if you haven't already, you can
// choose it, and once you do, you have a girl or a boy's skin."
//
// player.gender is 'boy' or 'girl' (missing = not chosen yet, drawn as the boy). It lives on the player, so it is in
// every save, every slot and every cloud save with no extra work.
//
// When it is asked: every way into a game goes through title.startSlot (a slot from the title screen, Continue, the
// online login with a cloud knight or a fresh one, Put my knight back). After it, a knight with no choice gets the
// "Boy or girl?" page once on that load. The page is answered, not tapped away: a press off it (the move stick, the
// grass, BAG, the map) and every key but Esc do nothing while it is up (walking, SWING and the belt too). Its X (or Esc)
// is the child's "not now": the knight stays a boy and it asks again on the next load. It is only asked when it is safe:
// no other page, no place name across the screen, no talk, not fallen, and no fight (not hurt in the last 4 s, no
// monster chasing him, none near that would, no boss bar). A hit, or a monster coming for him, while it is up takes it
// down so he can fight or run. If the game takes the page away (a fight, a fall, another page over it), inside a tick or
// between two, it comes back the next time it is safe to ask. The pause menu's New game asks too (a fresh knight in the
// same visit). Nothing is asked while the self-test runs, nor in the tools that call newGame() directly (the sims,
// dom-keys).
//
// How she looks: playerLook() gains `girl: true` (and drawHuman's own `woman: true`: the skirt and the long hair) and her
// own hair colour. drawHuman draws, for any look with `girl`, a braid over the shoulder with a ribbon (it hangs out of
// any helm, so she still reads as a girl in full armour), locks of hair under a helm's rim, a bow in the hair when the
// head is bare, and rosy cheeks. Everything that draws the knight goes through playerLook + drawHuman (on foot, the
// mare, the walker / dozer / beast seats, the bank, the boat, Thistledown's statue), so all of it follows.
//
// Online: 73-players' lookOf sends `girl` (a boolean) in presence; a remote knight's look with `girl` is drawn the same
// way. The server relays presence unchanged. docs/ONLINE.md (`look`) lists the field.
//
// Settings: a "Your knight" row (Boy / Girl) changes it later. The row mirrors the knight being played (the settings
// file keeps one value per browser; this keeps it equal to the knight's own), and "put every setting back" never
// changes a knight.
//
// Wraps by reassignment with explicit arguments: playerLook, drawHuman, title.startSlot, title.sprites, update (the story
// waits while the page is up), HOOKS.panel.settings, FANGLANDS.selfTest.
// ============================================================================
const BOYGIRL = (() => {
  const GIRL_HAIR = '#8a4f24', RIBBON = '#d0567f';
  const DEVICE_KEY = 'fanglands.knight';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } };
  const isGirl = () => player.gender === 'girl';
  // the last knight played on this device (for the title screen's knight, before any slot is loaded)
  let device = lsGet(DEVICE_KEY) === 'girl' ? 'girl' : 'boy';
  const remember = gnd => { if (gnd !== 'girl' && gnd !== 'boy') return; if (device !== gnd) { device = gnd; lsSet(DEVICE_KEY, gnd); } };

  // ---------- the look ----------
  // dress(l) makes any look a girl's: the skirt and long hair of drawHuman's `woman`, and her hair colour unless the look
  // brings its own (Thistledown's stone statue does)
  const dress = (l, hair) => { l.girl = true; l.woman = true; if (hair !== false) l.hair = GIRL_HAIR; return l; };
  const _playerLook = playerLook;
  playerLook = function () {
    const l = _playerLook();
    if (isGirl()) dress(l);
    return l;
  };
  // a look for the choice page: the knight as she or he would be, in the armour worn right now
  const lookAs = gnd => { const l = _playerLook(); return gnd === 'girl' ? dress(l) : l; };

  // ---------- drawing her ----------
  // The head is the circle at (0,-8) r 8, the body the ellipse at (0,3) 12x11, a helm the half disc at (0,-9) r 9 and
  // the band down to y -6. The braid starts under the helm's back edge, over the shoulder away from where she faces
  // (down her back when she faces away), and ends in a ribbon.
  function braid(g, look, fx, fy) {
    const back = fy < -0.55, side = back ? 0 : (fx > 0.35 ? -1 : 1);
    const x0 = back ? 0 : side * 7.2, y0 = -4.5;
    g.fillStyle = look.hair;
    for (let k = 0; k < 4; k++) {
      const x = x0 + side * k * 0.9, y = y0 + 1.6 + k * 3.3;
      g.beginPath(); g.ellipse(x, y, 2.7 - k * 0.15, 2.1, side * 0.35, 0, 7); g.fill();
    }
    // the weave: a darker line between the plaits
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 0.8;
    for (let k = 0; k < 3; k++) { const x = x0 + side * (k + 0.5) * 0.9, y = y0 + 3.25 + k * 3.3; g.beginPath(); g.moveTo(x - 2, y - 0.6); g.lineTo(x + 2, y + 0.6); g.stroke(); }
    // the ribbon: two loops and a knot
    const rx = x0 + side * 3.4, ry = y0 + 14.4;
    g.fillStyle = look.ribbon || RIBBON;
    g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 3.6, ry - 2.2); g.lineTo(rx - 3.6, ry + 2.2); g.closePath();
    g.moveTo(rx, ry); g.lineTo(rx + 3.6, ry - 2.2); g.lineTo(rx + 3.6, ry + 2.2); g.closePath(); g.fill();
    g.beginPath(); g.arc(rx, ry, 1.3, 0, 7); g.fill();
    // the tuft below the ribbon
    g.fillStyle = look.hair; g.beginPath(); g.moveTo(rx - 1.8, ry + 1.2); g.lineTo(rx + 1.8, ry + 1.2); g.lineTo(rx + side * 0.6, ry + 4.6); g.closePath(); g.fill();
  }
  function bow(g, look) {
    g.fillStyle = look.ribbon || RIBBON;
    const bx = 4.6, by = -16.4;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 3.4, by - 2.4); g.lineTo(bx - 3.4, by + 2.2); g.closePath();
    g.moveTo(bx, by); g.lineTo(bx + 3.4, by - 2.4); g.lineTo(bx + 3.4, by + 2.2); g.closePath(); g.fill();
    g.beginPath(); g.arc(bx, by, 1.2, 0, 7); g.fill();
  }
  const _drawHuman = drawHuman;
  drawHuman = function (g, e, look) {
    if (!look || !look.girl) return _drawHuman(g, e, look);
    // a look off the wire carries only `girl`: the skirt and long hair come from drawHuman's own `woman`
    if (!look.woman) look.woman = true;
    _drawHuman(g, e, look);
    const fx = e.facing ? e.facing.x : 0, fy = e.facing ? e.facing.y : 1;
    // locks of hair under a helm's rim (a party hat or a bare head already shows the long hair)
    if (look.helm) { g.fillStyle = look.hair; g.beginPath(); g.ellipse(-8.3, -3.6, 2.3, 3.8, 0.15, 0, 7); g.ellipse(8.3, -3.6, 2.3, 3.8, -0.15, 0, 7); g.fill(); }
    braid(g, look, fx, fy);
    if (!look.helm && !look.hat && !look.crown) bow(g, look);
    // rosy cheeks and lashes, on the face (not when she faces away)
    if (fy > -0.55) {
      const ex = fx * 2, ey = fy * 2;
      g.fillStyle = 'rgba(232,108,120,0.5)'; g.beginPath(); g.arc(-5.3 + ex, -4.4 + ey, 1.7, 0, 7); g.arc(5.3 + ex, -4.4 + ey, 1.7, 0, 7); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = 0.9; g.beginPath();
      g.moveTo(-4.1 + ex, -7.9 + ey); g.lineTo(-5.4 + ex, -9 + ey); g.moveTo(4.1 + ex, -7.9 + ey); g.lineTo(5.4 + ex, -9 + ey); g.stroke();
    }
  };

  // ---------- the title screen's knight follows the last knight played here ----------
  const _sprites = title.sprites;
  title.sprites = function (g, kx, ky, ks, wx, wy, ws) {
    const K = title.KNIGHT;
    if (K) { if (device === 'girl') { if (!K.girl) { K.boyHair = K.hair; dress(K); } } else if (K.girl) { delete K.girl; delete K.woman; K.hair = K.boyHair || K.hair; } }
    return _sprites(g, kx, ky, ks, wx, wy, ws);
  };

  // ---------- when to ask ----------
  // pending: the page is waiting to come up. dismissed: the child closed it with its X (or Esc) without choosing; the
  // knight stays a boy and it asks again on the next load. Anything else that takes the page away (a fall, another
  // page the game opens over it, a cutscene) is not the child's answer: the page comes back the next time it is safe.
  let quiet = 0, armed = false, pending = false, dismissed = false, wasOpen = false, openedNow = false, heldNotice = null;
  const chosen = () => player.gender === 'girl' || player.gender === 'boy';
  // a fight: hurt in the last 4 s (the core's own heal-up wait), a boss bar up, a monster chasing him, or one near that
  // would (the core's own rule for who attacks: an angry one, or an aggressive one he is not too strong for)
  const NEAR = 8 * TILE;
  function inDanger() {
    if (player.sinceHurt < 4) return true;
    if (typeof bossBarList === 'function' && bossBarList().length) return true;
    let cb = null;
    for (const m of monsters) {
      if (m.dead) continue;
      const def = MONSTER_DEFS[m.type]; if (!def || def.harmless) continue;
      if (m.state === 'chase') return true;
      if (dist(m.x, m.y, player.x, player.y) > Math.max(NEAR, (def.sight || 0) + 2 * TILE)) continue;
      if (m.angry && !def.aggro) return true;
      if (def.aggro && !window.__peace) { if (cb === null) cb = combatLevel(); if (cb <= def.level * 2 + 1) return true; }
    }
    return false;
  }
  const _startSlot = title.startSlot;
  title.startSlot = function (n) {
    heldNotice = null;
    const r = _startSlot(n);
    armed = true; dismissed = false; wasOpen = false;
    if (chosen()) { remember(player.gender); pending = false; }
    else pending = !quiet;
    return r;
  };
  // the pause menu's New game: a fresh knight in the same visit (a load right after it is handled by startSlot above)
  HOOKS.newGame.push(() => { heldNotice = null; dismissed = false; wasOpen = false; if (armed && !quiet) pending = true; });
  HOOKS.update.push(() => {
    if (!pending || quiet || title.active) return;
    if (chosen()) { pending = false; return; }
    // another page is open, a place's name is across the middle of the screen, someone is talking, the knight has
    // fallen, or he is in a fight: ask when it has gone
    if (panel || areaBanner || dialog.cur || dialog.queue.length || player.dead || inDanger()) return;
    pending = false; dismissed = false; openedNow = true; openPanel('boygirl');
  });
  // The story waits for the choice. While the page is up (or about to come up) the wake-up timer stays at 0, so The
  // Voice's "You're finally awake." starts 1.4 s after the knight is chosen, not on top of the page. A line said while
  // the page is open stays in the queue (no talk box over the cards, no timer running it out unread) and plays from its
  // start when the page closes. The queue itself is never emptied, so say()'s own rules still hold while the page is
  // up: the same line twice in a row is dropped, and no more than 8 wait.
  const asking = () => !quiet && !chosen() && (panel === 'boygirl' || pending);
  const holdLine = () => { if (panel === 'boygirl' && dialog.cur) { dialog.queue.unshift(dialog.cur); dialog.cur = null; dialog.shown = 0; dialog.t = 0; } };
  const _update = update;
  update = function (dt) {
    // the page went away since the last tick, and not by the child's X or a choice: ask again when it is safe
    if (wasOpen && panel !== 'boygirl' && !chosen() && !dismissed && !quiet) pending = true;
    // While the page is up no key starts anything else (the bag, the map, a talk with E, a swing): only Esc, its X.
    if (panel === 'boygirl') { const esc = pressed.has('Escape'); pressed.clear(); if (esc) { pressed.add('Escape'); dismissed = true; } }
    if (asking()) introT = Math.min(introT, 0);
    holdLine();
    const d0 = dialog, before = panel === 'boygirl';
    openedNow = false;
    _update(dt);
    // a fight while the page is up (a hit, a monster coming for him): the page steps aside so he can fight or run
    if (panel === 'boygirl' && !quiet && inDanger()) closePanel();
    // taken away inside this tick (a fall, a fight, a page a hook or a trade opened over it): ask again when it is safe
    if ((before || openedNow) && panel !== 'boygirl' && !chosen() && !dismissed && !quiet) pending = true;
    openedNow = false;
    // the core takes the next line off the queue each tick; while the page is up it goes back, unread
    if (dialog === d0) holdLine();
    if (asking()) introT = Math.min(introT, 0);
    // a notice ("Welcome to the world, Cohen.") waits under the page and shows, for its whole time, after the choice's
    // own notice; nothing is drawn over the cards
    if (panel === 'boygirl') { if (notice) { heldNotice = notice; notice = null; } }
    else if (heldNotice && !notice) { notice = heldNotice; heldNotice = null; }
    wasOpen = panel === 'boygirl';
  };
  // the key table (43-settings) reads the core's own handler through __inner
  update.__inner = _update;
  // the self-test drives startSlot and newGame for its own reasons: it never gets the page unless a check asks for it
  { const F = window.FANGLANDS, _selfTest = F.selfTest;
    F.selfTest = function () { quiet++; try { return _selfTest.call(this); } finally { quiet--; wasOpen = false; } }; }

  // from the page it closes the page; from Settings the Settings page stays open
  function choose(gnd, keepOpen) {
    player.gender = gnd === 'girl' ? 'girl' : 'boy';
    remember(player.gender); syncSetting();
    if (!keepOpen) closePanel();
    save();
    notify(player.gender === 'girl' ? 'You are a girl knight.' : 'You are a boy knight.');
    burst(player.x, player.y - 10, '#f5c542', 14, 90);
  }

  // ---------- the page: two knights side by side, each card one big tap ----------
  HOOKS.panel.boygirl = (g, narrow) => {
    // The page is answered, not tapped away: one press anywhere off it (the move stick, the grass, BAG, the map) does
    // nothing. Drawn first, so the page's own cards and its X still win over it. `offscreen` keeps it out of the HUD's
    // list of rects (tooltips would find no clear place and land on the wrong card) and out of the layout audits;
    // pointerDown still hits it.
    buttons.push({ x: 0, y: 0, w: VW, h: VH, label: 'boygirl:stay', action: () => { }, inert: true, offscreen: true });
    const t = touchMode(), R = HK.row(), T = HK.T;
    const room = panelRoom(t ? 460 : 440, VH), w = room.w;
    const top = 62, foot = 16, gap = t ? 14 : 12;
    const cardW = Math.floor((w - 36 - gap) / 2);
    // the page ends above the belt (panelBox centres it 20 px above the middle): on an upright phone a full-height page
    // would sit on the belt's lock and first pouch
    const beltY = HUD_LAYOUT.hotbarY, fitH = beltY > VH / 2 ? 2 * (beltY - 8 - (VH / 2 - 20)) : Infinity;
    const artH = clamp(Math.round(Math.min(room.h, fitH) - top - foot - R - 24), 64, 170);
    const cardH = artH + R + 18;
    const h = top + cardH + foot;
    const { px, py } = panelBox(g, w, h, 'Boy or girl?', 'Choose your knight. Settings can change it later.');
    // its X is the child saying "not now": the knight stays a boy and the page asks again on the next load
    { const x = buttons[buttons.length - 1]; if (x && x.label === '×') x.action = () => { dismissed = true; closePanel(); }; }
    const cur = player.gender;
    [['boy', 'Boy'], ['girl', 'Girl']].forEach(([gnd, word], i) => {
      const cx = px + 18 + i * (cardW + gap), cy = py + top;
      const label = 'choose:' + gnd, st = HK.stateOf(label), on = cur === gnd;
      HK.vellumPlate(g, cx, cy + (st.pressed ? 1.5 : 0), cardW, cardH, { edge: on || st.hover ? 'rgba(247,220,143,0.95)' : null });
      // the knight, big and facing out of the page, on a soft shadow
      const s = clamp(Math.min(cardW / 46, artH / 44), 1.4, 3.4), fx = cx + cardW / 2, fy = cy + 8 + artH * 0.56 + (st.pressed ? 1.5 : 0);
      g.save(); g.translate(fx, fy); g.scale(s, s);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 12, 12, 5, 0, 0, 7); g.fill();
      drawHuman(g, { facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, walkT: 0, moving: false }, lookAs(gnd));
      g.restore();
      // the word on an iron plate along the card's foot (drawn only: the whole card is the tap)
      HK.plateButton(g, { x: cx + 10, y: cy + cardH - R - 10 + (st.pressed ? 1.5 : 0), w: cardW - 20, h: R }, null, word, on ? 'primary' : null, { cinzel: true, hover: st.hover });
      buttons.push({ x: cx, y: cy, w: cardW, h: cardH, label, action: () => choose(gnd), up: true, name: word === 'Boy' ? 'A boy knight' : 'A girl knight' });
    });
    // The talk box is drawn over the page. The story waits while the page is up, so none should show; if one ever does,
    // a tap on it goes to the talk box the child can see, never to a card hidden under it.
    if (dialog.cur && dialogRect) { const D = dialogRect; buttons.push({ x: D.x, y: D.y, w: D.w, h: D.h, label: 'dialog', action: advanceDialog, up: true, name: 'Next line', keys: ['Enter'] }); }
  };

  // ---------- Settings: "Your knight" ----------
  const word = () => isGirl() ? 'Girl' : 'Boy';
  let syncing = false;
  // the row shows the knight being played; its default follows too, so "put every setting back" leaves the knight alone
  function syncSetting() {
    if (!window.SETTINGS || !SETTINGS.addRow) return;
    const w0 = word(); SETTINGS.DEFAULTS.knight = w0;
    if (SETTINGS.get('knight') !== w0) { syncing = true; try { SETTINGS.set('knight', w0); } finally { syncing = false; } }
  }
  if (window.SETTINGS && SETTINGS.addRow) {
    SETTINGS.addRow({ key: 'knight', name: 'Your knight', hint: () => 'A boy or a girl knight. Friends online see it too.' }, 'Boy', ['Boy', 'Girl'], 'kid', v => {
      if (syncing || v === word()) return;
      choose(v === 'Girl' ? 'girl' : 'boy', true);
    });
    const _settings = HOOKS.panel.settings;
    if (_settings) HOOKS.panel.settings = (g, narrow) => { syncSetting(); return _settings(g, narrow); };
  }

  // ---------- self-test ----------
  // A drawing context that writes down every fill colour and every ellipse, so a check can say what was painted.
  const recorder = () => {
    const rec = { fills: [], ellipses: 0 };
    rec.g = new Proxy({}, {
      get: (o, k) => k === 'measureText' ? () => ({ width: 10 }) : k === 'ellipse' ? () => { rec.ellipses++; } : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : k in o ? o[k] : () => { },
      set: (o, k, v) => { if (k === 'fillStyle') rec.fills.push(v); o[k] = v; return true; },
    });
    return rec;
  };
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'boy or girl: ';
    const g0 = player.gender, slot0 = title.slot, dc = dialog.cur, dq = dialog.queue.slice(), log0 = dialogLog.slice();
    const q0 = quiet; quiet = 0;
    const SK = n => title.slotKey(n), AK = n => title.slotKey(n) + '.at';
    const keep3 = [lsGet(SK(3)), lsGet(AK(3))], dev0 = lsGet(DEVICE_KEY);
    // the page waits for a place's name banner to go: step until it is up (or 5 s)
    const untilAsked = () => { for (let i = 0; i < 300 && panel !== 'boygirl'; i++) F.step([]); };
    try {
      // 1. the look
      { player.gender = 'girl'; const gl = playerLook(); player.gender = 'boy'; const bl = playerLook(); delete player.gender; const nl = playerLook();
        check(P + 'a girl knight\'s look has girl, the skirt and long hair (woman) and her own hair; a boy\'s and an unchosen knight\'s have none of it', gl.girl === true && gl.woman === true && gl.hair === GIRL_HAIR && !bl.girl && !bl.woman && !nl.girl && bl.hair !== GIRL_HAIR, { gl: { girl: gl.girl, woman: gl.woman, hair: gl.hair }, bl: { girl: bl.girl, woman: bl.woman } }); }
      // 2. the drawing: under a helm a boy's hair never shows; a girl's braid and locks do, and her ribbon
      { const e = { facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0 }, base = { tunic: '#3b6fb6', hair: '#123456', shoulder: '#9aa3b2', helm: '#8f96a3', body: '#c9ccd3', fists: true };
        const b = recorder(); drawHuman(b.g, e, Object.assign({}, base));
        const gr = recorder(); drawHuman(gr.g, e, Object.assign({}, base, { girl: true }));
        const bare = recorder(); drawHuman(bare.g, { facing: { x: 1, y: 0 }, hurtT: 0, attackT: 0 }, { tunic: '#3b6fb6', hair: '#123456', shoulder: '#9aa3b2', girl: true });
        const back = recorder(); let threw = false; try { drawHuman(back.g, { facing: { x: 0, y: -1 }, hurtT: 0, attackT: 0 }, Object.assign({}, base, { girl: true })); } catch (err) { threw = String(err && err.message); }
        check(P + 'drawHuman: under a helm a boy\'s hair is hidden, a girl\'s braid and locks show with the ribbon; bare-headed she has the long hair and a bow; facing away the braid is down her back', !b.fills.includes('#123456') && gr.fills.filter(f => f === '#123456').length >= 3 && gr.fills.includes(RIBBON) && gr.ellipses > b.ellipses + 4 && bare.fills.filter(f => f === RIBBON).length >= 2 && threw === false && back.fills.includes('#123456'), { boyHair: b.fills.includes('#123456'), girlHair: gr.fills.filter(f => f === '#123456').length, ribbon: gr.fills.includes(RIBBON), ellipses: [b.ellipses, gr.ellipses], bow: bare.fills.filter(f => f === RIBBON).length, threw }); }
      // 3. every way the knight is drawn takes her look: the mare, the walker / dozer / beast seats, the bank, the boat
      { player.gender = 'girl'; const rec = recorder(), e = { x: 0, y: 0, r: 13, facing: { x: 0, y: 1 }, walkT: 0, moving: false, attackT: 0, hurtT: 0, parked: false };
        const seats = {};
        const one = (name, fn) => { const n0 = rec.fills.filter(f => f === RIBBON).length; try { fn(); seats[name] = rec.fills.filter(f => f === RIBBON).length > n0; } catch (err) { seats[name] = String(err && err.message); } };
        one('walker', () => drawMech(rec.g, e, false, playerLook()));
        if (typeof drawDozer === 'function') one('dozer', () => drawDozer(rec.g, e, false, playerLook(), false));
        if (HOOKS.drawMonster.barrelbeast) one('beast', () => HOOKS.drawMonster.barrelbeast(rec.g, e, false, playerLook()));
        delete player.gender;
        check(P + 'in the walker, the dozer and the beast the rider is the girl knight (her ribbon is drawn)', Object.values(seats).every(v => v === true) && 'walker' in seats && 'dozer' in seats, seats); }
      // 4. a real new game on an iPad held upright, the story left to run: the page comes up and stays up, and The Voice
      // waits (no talk box over the cards, the story still at its start) for 5 s. A talk box forced up over the page takes
      // its own tap (the card under it is not chosen). Tapping Girl makes a girl knight, saves it and closes the page, and
      // then "You're finally awake." plays from its start.
      { const restore = panelSizeSaver(), t0 = window.__forceTouch; let r = {};
        try {
          panelSetSize(768, 1024); window.__forceTouch = true;
          save(); localStorage.removeItem(SK(3)); localStorage.removeItem(AK(3));
          title.open(); title.startSlot(3);
          let open = 0, talk = 0, box = 0;
          for (let i = 0; i < 300; i++) { F.step([]); if (i % 10 === 9) { render(); if (panel === 'boygirl' && dialogRect) box++; } if (panel === 'boygirl') open++; if (dialog.cur) talk++; }
          r.wait = { open, talk, box, stage: quest.stage };
          render();
          const cards = ['choose:boy', 'choose:girl'].map(l => buttons.find(b => b.label === l)).filter(Boolean);
          r.big = cards.length === 2 && cards.every(b => b.w >= 44 && b.h >= 44);
          // stray presses off the page: the move stick (dragged), the grass beside the page, BAG, the map glass; then the
          // keys I, E, Tab, M, Space. None of them closes the page, opens anything, chooses, walks or starts the story.
          { const L = HK.cur(), P = { ...panelRect }, x0 = player.x, y0 = player.y, stray = {};
            const at = { stick: L.stick ? [L.stick.x, L.stick.y] : [VW * 0.18, VH - 110], grass: [VW * 0.75, Math.min(VH - 10, P.y + P.h + 24)], bag: L.bag ? [L.bag.x + L.bag.w / 2, L.bag.y + L.bag.h / 2] : null, map: L.mm ? [L.mm.x, L.mm.y] : null };
            for (const [k, p] of Object.entries(at)) {
              if (!p) { stray[k] = 'none'; continue; }
              // the page must be up at every moment, not only at the end (it would come back by itself after a close)
              let gone = 0; const look = () => { if (panel !== 'boygirl') gone++; };
              // the stick is dragged; the rest are plain taps (a tap that slides off a button is no tap)
              const dx = k === 'stick' ? 40 : 0;
              render(); pointerDown(p[0], p[1], 'boygirl-stray'); look(); pointerMove(p[0] + dx, p[1], 'boygirl-stray');
              for (let i = 0; i < 20; i++) { F.step([]); look(); }
              pointerUp('boygirl-stray', p[0] + dx, p[1]); look(); for (let i = 0; i < 20; i++) { F.step([]); look(); }
              stray[k] = gone ? `gone ${gone}` : panel;
            }
            for (const code of ['KeyI', 'KeyE', 'Tab', 'KeyM', 'Space']) { F.press(code); const now = panel; F.step([]); stray[code] = now === 'boygirl' ? panel : now; }
            notify('Welcome to the world, Cohen.'); F.step([]); render(); r.noticeHidden = !notice;
            r.stray = { stray, offPage: Object.values(at).filter(Boolean).every(p => !inRect(p[0], p[1], P)), gender: player.gender || null, talk: !!dialog.cur, stage: quest.stage, moved: Math.round(Math.hypot(player.x - x0, player.y - y0)) };
            render(); }
          // a talk box over the page: the tap goes to it where it covers a card
          dialog.cur = { who: 'The Voice', text: "You're finally awake.", t: 0 }; dialog.shown = dialog.cur.text.length; dialog.t = 0; render();
          const D = dialogRect && { ...dialogRect }, B = cards[0];
          let tx = D ? D.x + D.w / 2 : -1, ty = D ? D.y + D.h / 2 : -1, overCard = false;
          if (D && B) { const x0 = Math.max(D.x, B.x), x1 = Math.min(D.x + D.w, B.x + B.w), y0 = Math.max(D.y, B.y), y1 = Math.min(D.y + D.h, B.y + B.h); if (x1 > x0 && y1 > y0) { tx = (x0 + x1) / 2; ty = (y0 + y1) / 2; overCard = true; } }
          if (D) { pointerDown(tx, ty, 'boygirl-test'); pointerUp('boygirl-test', tx, ty); }
          r.forced = { box: !!D, overCard, gender: player.gender || null, panel, line: dialog.cur ? dialog.cur.text : null };
          dialog.cur = null; render();
          r.tapped = F.clickButton('choose:girl');
          r.saved = (JSON.parse(lsGet(SK(3)) || '{}').player || {}).gender || null;
          r.after = { gender: player.gender, panel, look: playerLook().girl === true };
          r.choiceNotice = notice && notice.text;
          let n = 0; for (; n < 240 && !dialog.cur; n++) F.step([]);
          r.voice = { frames: n, line: dialog.cur ? dialog.cur.text : null, t: dialog.cur ? +dialog.t.toFixed(3) : null, stage: quest.stage };
          // the welcome waited under the page: it comes after the choice's own notice, with its whole time
          let m = 0; for (; m < 400 && !(notice && notice.text === 'Welcome to the world, Cohen.'); m++) { if (dialog.cur) advanceDialog(); F.step([]); }
          r.notice = { hidden: r.noticeHidden, choiceSaid: r.choiceNotice, frames: m, text: notice && notice.text, t: notice ? +notice.t.toFixed(2) : null };
        } finally { window.__forceTouch = t0; restore(); }
        const W = r.wait || {}, Fd = r.forced || {}, A = r.after || {}, V = r.voice || {};
        check(P + 'a real new game (iPad upright, the story left to run): the page stays up 5 s with no talk box over it and the story waits at its start', W.open === 300 && W.talk === 0 && W.box === 0 && W.stage === 0 && r.big, r.wait);
        const Sy = r.stray || {};
        check(P + 'stray presses never throw the choice away: the move stick, the grass beside the page, BAG, the map and the keys I, E, Tab, M, Space leave the page up, nothing chosen, the knight still and the story waiting', !!Sy.stray && Object.values(Sy.stray).every(v => v === 'boygirl' || v === 'none') && Sy.stray.stick === 'boygirl' && Sy.stray.bag === 'boygirl' && Sy.stray.grass === 'boygirl' && Sy.offPage && Sy.gender === null && !Sy.talk && Sy.stage === 0 && Sy.moved === 0, r.stray);
        check(P + 'a talk box drawn over the page takes the tap where it covers the Boy card: no knight is chosen and the page stays up', Fd.box && Fd.gender === null && Fd.panel === 'boygirl' && Fd.line === null, r.forced);
        check(P + 'tapping Girl makes a girl knight, saves it and closes the page; then "You\'re finally awake." plays from its start, 1.4 s later', r.tapped && A.gender === 'girl' && r.saved === 'girl' && A.panel === null && A.look && V.line === "You're finally awake." && V.t < 0.05 && V.frames >= 80 && V.stage === 1, { tapped: r.tapped, saved: r.saved, after: r.after, voice: r.voice });
        const N = r.notice || {};
        check(P + 'a notice that comes while the page is up ("Welcome to the world, Cohen.") is not drawn over the cards: it waits and shows, with its whole time, after "You are a girl knight."', N.hidden === true && N.choiceSaid === 'You are a girl knight.' && N.text === 'Welcome to the world, Cohen.' && N.t > 2.5, r.notice);
        dialog.cur = null; dialog.queue.length = 0;
        // the choice is kept: loading it again asks nothing
        title.open(); title.startSlot(3); F.step([]); F.step([]);
        check(P + 'a knight who has chosen is not asked again when the slot is loaded', panel !== 'boygirl' && player.gender === 'girl', { panel, gender: player.gender }); }
      // 5. an old save with no choice: asked once on this load, after the line that was playing; a line said while the
      // page is up waits and plays from its start when it closes; closed, the page stays closed (and the knight is a boy)
      { const d = JSON.parse(lsGet(SK(3))); delete d.player.gender; lsSet(SK(3), JSON.stringify(d));
        title.open(); title.startSlot(3); dialog.cur = null; dialog.queue.length = 0;
        say('A line that was playing when the knight came in.', 'The Voice');
        for (let i = 0; i < 30; i++) F.step([]);
        const waitedTalk = panel !== 'boygirl' && !!dialog.cur;
        advanceDialog(); untilAsked();
        const asked = panel === 'boygirl';
        say('A line said while the page is up.', 'The Voice');
        for (let i = 0; i < 60; i++) F.step([]);
        const held = panel === 'boygirl' && !dialog.cur && dialog.queue.length === 1;
        // say()'s own rules hold while the page is up: a hook saying the same line every tick queues it once, and a hook
        // saying a new line every tick stops at 9 in all, as in play (the one that would be speaking and 8 waiting)
        let k = 0; const same = () => say('The same line, every tick.', 'The Voice'), many = () => say('Line ' + (k++), 'The Voice');
        HOOKS.update.push(same); for (let i = 0; i < 60; i++) F.step([]); HOOKS.update.splice(HOOKS.update.indexOf(same), 1);
        const once = dialog.queue.length === 2 && dialog.queue[1].text === 'The same line, every tick.';
        HOOKS.update.push(many); for (let i = 0; i < 60; i++) F.step([]); HOOKS.update.splice(HOOKS.update.indexOf(many), 1);
        const capped = dialog.queue.length === 9 && !dialog.cur && panel === 'boygirl';
        const queued = dialog.queue.length;
        // the child closes it with its X
        render(); const xed = F.clickButton('×'); F.step([]);
        const played = !!dialog.cur && dialog.cur.text === 'A line said while the page is up.' && dialog.t < 0.05;
        dialog.cur = null; dialog.queue.length = 0; F.sim(30, []);
        check(P + 'an existing knight who never chose is asked once on the next load, after the line that was playing; a line said while the page is up waits and then plays from its start; say() still drops a repeat and stops at 9 lines in all; the page\'s X keeps the boy look and it does not pop back up', waitedTalk && asked && held && once && capped && xed && played && panel === null && !player.gender && !playerLook().girl, { waitedTalk, asked, held, once, capped, queued, xed, played, panel, gender: player.gender }); }
      // 5b. taken away by the game, not by the child, from inside the game's own tick (as play does it): the page comes
      // back the next time it is safe to ask, and the story still waits
      { const once = fn => { const hk = () => { HOOKS.update.splice(HOOKS.update.indexOf(hk), 1); fn(); }; HOOKS.update.push(hk); };
        title.open(); title.startSlot(3); dialog.cur = null; dialog.queue.length = 0; untilAsked();
        const up = panel === 'boygirl', stage0 = quest.stage;
        // another page put over it from inside a tick (as an NPC, a trade or the town watch would): it waits for that
        // page, then comes back when the child closes it
        once(() => openPanel('inventory')); for (let i = 0; i < 30; i++) F.step([]); const waitedPage = panel === 'inventory';
        closePanel(); for (let i = 0; i < 5; i++) F.step([]); const back1 = panel === 'boygirl';
        // a real fall from inside a tick (a monster's killing blow goes through hurtPlayer and die): it comes back after
        // the knight is up again and the fight is 4 s behind him, after the fall's own line
        once(() => hurtPlayer(999, player.x + 20, player.y)); F.step([]);
        const fell = player.dead && panel !== 'boygirl';
        let away = 0, n = 0; for (; n < 1200 && panel !== 'boygirl'; n++) { F.step([]); if (player.dead) away++; }
        const back2 = panel === 'boygirl' && !player.dead && !player.gender, stage = quest.stage === stage0;
        // put up and taken down in one tick (a blow in the same tick the page comes up): still asked again later
        closePanel();
        { const hk = () => { if (panel !== 'boygirl') return; HOOKS.update.splice(HOOKS.update.indexOf(hk), 1); hurtPlayer(999, player.x + 20, player.y); }; HOOKS.update.push(hk); }
        F.step([]); const sameTick = player.dead && panel !== 'boygirl';
        for (let i = 0; i < 1200 && panel !== 'boygirl'; i++) F.step([]);
        const back3 = panel === 'boygirl' && !player.dead && !player.gender;
        // Esc is the X on a computer: not now
        F.press('Escape'); for (let i = 0; i < 60; i++) F.step([]); const esc = panel === null && !player.gender;
        check(P + 'when the game takes the page away from inside its own tick (another page opened over it, a real fall, a fall in the very tick it came up) it comes back the next time it is safe and the story waits; Esc, like its X, means not now', up && waitedPage && back1 && fell && away > 100 && back2 && stage && sameTick && back3 && esc, { up, waitedPage, back1, fell, away, frames: n, back2, stage, sameTick, back3, esc, panel }); }
      // 5c. never in a fight: an old save loaded beside a monster who attacks him gets no page (he can fight or run)
      // until it is dealt with; a monster that comes for him while the page is up takes the page down before it lands a
      // blow (no X: it is not the child's answer), and the page comes back when the fight is over
      { title.open(); title.startSlot(3); dialog.cur = null; dialog.queue.length = 0; closePanel();
        // the load makes the monster list, and the falls above raised his Defence: find one that still attacks this knight
        // (the core's rule: an aggressive monster he is not too strong for), the weakest
        const cb = combatLevel(), defOf = m => MONSTER_DEFS[m.type] || {};
        const foe = monsters.filter(m => { const d = defOf(m); return !m.dead && d.aggro && !d.harmless && !d.mech && !d.thrower && d.level * 2 + 1 >= cb && d.level < 25; }).sort((x, y) => defOf(x).level - defOf(y).level)[0];
        const spot = (m, dx) => { m.x = player.x + dx; m.y = player.y; m.home = { x: m.x, y: m.y }; m.state = 'idle'; m.attackCd = 0; m.stunT = 0; };
        const r = { foe: foe ? foe.type : null };
        if (foe) {
          const keep = { x: foe.x, y: foe.y, home: foe.home, hp: foe.hp, dead: foe.dead, angry: foe.angry, respawnT: foe.respawnT, deadT: foe.deadT };
          try {
            r.asking = pending; r.stage0 = quest.stage; player.sinceHurt = 99; player.hp = player.maxHp; spot(foe, 40);
            // count every time the page is put up, even one taken down again in the same tick
            const _open = openPanel; let opened = 0; openPanel = function (name, arg) { if (name === 'boygirl') opened++; return _open(name, arg); };
            try { for (let i = 0; i < 60; i++) F.step([]); } finally { openPanel = _open; }
            r.near = { opened, chase: foe.state, pending, dead: player.dead };
            killMonster(foe); dialog.cur = null; dialog.queue.length = 0;
            let n = 0; for (; n < 600 && panel !== 'boygirl'; n++) F.step([]);
            r.after = { back: panel === 'boygirl', frames: n };
            // the page is up: the monster comes back to life a few steps off and comes for him
            foe.dead = false; foe.hp = foe.maxHp; player.hp = player.maxHp; spot(foe, Math.min(3 * TILE, (defOf(foe).sight || 3 * TILE) - TILE / 2));
            const hp0 = player.hp; F.step([]);
            r.came = { panel, pending, dismissed, hp: player.hp === hp0 };
            for (let i = 0; i < 60; i++) F.step([]);
            r.stays = panel !== 'boygirl';
            killMonster(foe); dialog.cur = null; dialog.queue.length = 0;
            let m = 0; for (; m < 600 && panel !== 'boygirl'; m++) F.step([]);
            r.again = { back: panel === 'boygirl', frames: m, gender: player.gender || null, stage: quest.stage === r.stage0 };
          } finally { Object.assign(foe, keep); foe.state = 'idle'; closePanel(); pending = false; }
        }
        const Nr = r.near || {}, Af = r.after || {}, Ca = r.came || {}, Ag = r.again || {};
        check(P + 'never in a fight: an old save beside a monster who attacks him gets no page (he can fight or run) until it is dealt with; one coming for him while the page is up takes it down before a blow, and it comes back after', !!foe && r.asking === true && Nr.opened === 0 && Nr.chase === 'chase' && Nr.pending === true && Af.back && Ca.panel === null && Ca.pending === true && Ca.dismissed === false && Ca.hp && r.stays && Ag.back && Ag.gender === null && Ag.stage === true, r); }
      // 6. the pause menu's New game in the same visit asks again
      { newGame(); untilAsked(); const asked = panel === 'boygirl'; render(); F.clickButton('choose:boy');
        check(P + 'the pause menu\'s New game asks too; tapping Boy makes a boy knight', asked && player.gender === 'boy' && panel === null && !playerLook().girl, { asked, gender: player.gender, panel }); }
      // 6b. a place's name across the screen goes first; the page comes up after it
      { newGame(); areaBanner = { name: 'Thistledown', sub: 'The city that still stands', t: 0.5 }; F.step([]); const waited = panel !== 'boygirl';
        untilAsked(); const after = panel === 'boygirl' && !areaBanner; closePanel(); player.gender = 'boy';
        check(P + 'the page waits for a place\'s name banner to go, then comes up', waited && after, { waited, after }); }
      // 7. Settings: the "Your knight" row shows the knight and changes it and the Settings page stays open; "put every setting back" leaves the knight alone
      { closePanel();
        // the settings file keeps one value per browser: a girl knight played last in another slot leaves it at Girl.
        // Drawing Settings brings the row back to the knight being played (a boy here).
        syncing = true; try { SETTINGS.set('knight', 'Girl'); } finally { syncing = false; }
        const stale = SETTINGS.get('knight') === 'Girl' && player.gender === 'boy';
        openPanel('settings'); let found = false;
        for (let p = 0; p < 12 && !found; p++) { render(); found = buttons.some(b => b.label === 'set:knight'); if (!found && !F.clickButton('Next')) break; }
        const shown = stale && SETTINGS.get('knight');
        const tapped = F.clickButton('set:knight');
        const girl = player.gender === 'girl' && SETTINGS.get('knight') === 'Girl' && playerLook().girl === true;
        render(); SETTINGS.reset();
        const kept = player.gender === 'girl' && SETTINGS.get('knight') === 'Girl';
        const open = panel === 'settings';
        F.clickButton('set:knight') || SETTINGS.cycle('knight');
        closePanel();
        check(P + 'Settings has "Your knight" (Boy for a boy, even when the browser\'s setting was left at Girl by another slot); a tap makes her a girl; putting every setting back does not change the knight', found && shown === 'Boy' && tapped && girl && kept && open && player.gender === 'boy', { found, shown, tapped, girl, kept, open, now: player.gender }); }
      // 8. the page at every device size, touch and mouse, Large text: both cards 44 px or more, apart, on screen, words fit
      { const restore = panelSizeSaver(), t0 = window.__forceTouch, text0 = SETTINGS.get('text'), problems = []; let tried = 0;
        try {
          for (const [w, hh] of HK.audit.SIZES) {
            if (!panelSetSize(w, hh)) continue; tried++;
            for (const tch of [true, false]) {
              window.__forceTouch = tch; SETTINGS.set('text', 'large'); closePanel(); openPanel('boygirl');
              const where = `boygirl ${w}x${hh} ${tch ? 'touch' : 'mouse'}`;
              problems.push(...panelFrame(where));
              const cards = buttons.filter(b => /^choose:/.test(b.label));
              // the page ends above the belt where the belt is below it (an upright phone: its lock and first pouch)
              const Bt = HUD_LAYOUT.belt, Pg = panelRect;
              if (Bt && Pg && Bt.y > VH / 2 && Pg.x < Bt.x + Bt.w && Bt.x < Pg.x + Pg.w && Pg.y + Pg.h > Bt.y - 4) problems.push(`${where}: the page ends at ${Math.round(Pg.y + Pg.h)}, on the belt at ${Math.round(Bt.y)}`);
              if (cards.length !== 2 || cards.some(b => b.w < (tch ? 120 : 90) || b.h < 110)) problems.push(`${where}: cards ${cards.map(b => Math.round(b.w) + 'x' + Math.round(b.h)).join(' ')}`);
            }
          }
        } finally { closePanel(); window.__forceTouch = t0; SETTINGS.set('text', text0); restore(); }
        check(P + 'the page at all 8 device sizes, touch and mouse, Large text: two big cards (120 px wide or more on touch, 110 tall), 44 px controls, nothing overlapping or off screen, every word fits, the page clear of the belt', tried === 8 && problems.length === 0, { tried, problems: problems.slice(0, 6) }); }
      // 8b. on a computer, hovering a card or the X puts its tooltip clear of every other control on the page (the
      // full-screen press-catcher behind the page is not a place a tooltip must avoid, or it lands on the other card)
      { const restore = panelSizeSaver(), t0 = window.__forceTouch, out = {};
        try {
          for (const [w, hh] of [[1280, 800], [1024, 768]]) {
            if (!panelSetSize(w, hh)) { out[w] = 'size'; continue; }
            window.__forceTouch = false; closePanel(); openPanel('boygirl'); render();
            for (const label of ['choose:boy', 'choose:girl', '×']) {
              const b = buttons.find(q => q.label === label && !q.offscreen); if (!b || !b.name) { out[w + ' ' + label] = 'no button'; continue; }
              pointerMove(-1e4, -1e4, 'mouse'); pointerMove(b.x + b.w / 2, b.y + b.h / 2, 'mouse');
              if (HK.hover) HK.hover.t0 -= 1000;
              const said = [], g = new Proxy({}, { get: (o, k) => k === 'measureText' ? s => ({ width: String(s).length * 7 }) : k === 'fillText' ? (s, x, y) => said.push({ s, x, y }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : k in o ? o[k] : () => { }, set: (o, k, v) => { o[k] = v; return true; } });
              HK.drawOverlays(g, HK.cur());
              const t = said.find(q => q.s === b.name);
              if (!t) { out[w + ' ' + label] = 'no tooltip'; continue; }
              // the tooltip's box: its title is written 12 px in and 21 px down; it is 32 px tall
              const box = { x: t.x - 12, y: t.y - 21, w: 24 + String(b.name).length * 7, h: 32 };
              const on = buttons.filter(q => q !== b && !q.offscreen && q.w > 0 && q.h > 0 && q.x < box.x + box.w && box.x < q.x + q.w && q.y < box.y + box.h && box.y < q.y + q.h).map(q => q.label);
              out[w + ' ' + label] = on.length ? 'on ' + on.join(',') : 'clear';
            }
            pointerMove(-1e4, -1e4, 'mouse');
          }
        } finally { closePanel(); window.__forceTouch = t0; restore(); }
        check(P + 'on a computer the Boy card\'s, the Girl card\'s and the X\'s tooltips sit clear of every other control on the page (never on the other knight)', Object.keys(out).length === 6 && Object.values(out).every(v => v === 'clear'), out); }
      // 9. online: presence carries girl, a change goes out at once, and a remote girl knight is drawn as one
      { const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake }, made = [];
        const fake = { call: async () => ({}), open: () => { const s = { readyState: 1, sent: [], send(str) { const m = JSON.parse(str); s.sent.push(m); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen' }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; made.push(s); return s; } };
        let res = {};
        try {
          NET.disconnect(); NET.enabled = true; NET.token = 'boygirl-test'; NET.useFake(fake); NET.connect();
          const sock = made[0], ps = () => sock.sent.filter(m => m.t === 'p');
          // wait for the idle send (about once a second), then change: the next one must come well before the next idle send
          player.gender = 'boy'; F.sim(20, []); const c0 = ps().length; for (let i = 0; i < 90 && ps().length === c0; i++) F.step([]);
          const n0 = ps().length; player.gender = 'girl'; F.sim(12, []); const after = ps().slice(n0);
          const sent = after.length > 0 && after[after.length - 1].look.girl === true;
          const boyWire = PLAYERS.lookOf; player.gender = 'boy'; const bw = boyWire().girl;
          const look = { tunic: '#a33', hair: '#654321', shoulder: '#999', helm: '#888', body: null, shield: null, weapon: { shape: 'sword', color: '#ccc' }, tool: null, toolColor: null, rod: false, fists: false, hat: null, girl: true };
          sock.onmessage({ data: JSON.stringify({ t: 'p', n: 'Mia', map: 'over', x: player.x + 40, y: player.y, fx: -1, fy: 0, mv: false, wt: 0, hp: 20, mhp: 20, lv: 5, look, mech: null, dead: false, def: 100, act: null }) });
          F.step([]); const rec = recorder(), items = []; for (const hk of HOOKS.draw) { try { hk(rec.g, items, cam); } catch (err) { } }
          const mia = items.find(it => it.who === 'Mia'); rec.fills.length = 0; if (mia) mia.draw();
          // the wire carries only `girl`: her skirt (drawHuman's `woman`, a second fill in her tunic colour) must come from it
          const tunics = l => { const r2 = recorder(); _drawHuman(r2.g, { facing: { x: -1, y: 0 }, hurtT: 0, attackT: 0 }, l); return r2.fills.filter(f => f === '#a33').length; };
          const plain = tunics(Object.assign({}, look, { girl: false })), skirted = tunics(Object.assign({}, look, { girl: false, woman: true }));
          res = { sent, bw, drawn: !!mia, hair: rec.fills.filter(f => f === '#654321').length, ribbon: rec.fills.includes(RIBBON), tunic: rec.fills.filter(f => f === '#a33').length, plain, skirted };
        } finally { NET.disconnect(); NET.enabled = was.enabled; NET.token = was.token; NET.useFake(was.fake); if (PLAYERS.remote.Mia) delete PLAYERS.remote.Mia; }
        check(P + 'online: presence carries look.girl (false for a boy), a change goes out at once, and a remote girl knight in a helm is drawn with her braid, ribbon and skirt', res.sent === true && res.bw === false && res.drawn && res.hair >= 3 && res.ribbon && res.skirted > res.plain && res.tunic >= res.skirted, res); }
      // 10. the title screen's knight is the last knight played here
      { remember('girl'); const K = title.KNIGHT; title.sprites(recorder().g, 0, 0, 1, 0, 0, 1); const girl = !!(K && K.girl);
        remember('boy'); title.sprites(recorder().g, 0, 0, 1, 0, 0, 1); const boy = !!(K && !K.girl && K.hair === '#5a3a1e');
        check(P + 'the title screen\'s knight matches the last knight played on this device', girl && boy, { girl, boy }); }
      // 11. nothing is asked while the self-test itself runs (quiet), so no other check meets the page
      { quiet = 1; title.open(); localStorage.removeItem(SK(3)); title.startSlot(3); F.step([]); const none = panel !== 'boygirl'; quiet = 0;
        check(P + 'while quiet (the self-test) a new slot opens no page', none, { panel }); }
    } finally {
      quiet = q0; pending = false; closePanel();
      if (keep3[0] == null) { localStorage.removeItem(SK(3)); localStorage.removeItem(AK(3)); } else { lsSet(SK(3), keep3[0]); lsSet(AK(3), keep3[1] || Date.now()); }
      if (dev0 == null) localStorage.removeItem(DEVICE_KEY); else lsSet(DEVICE_KEY, dev0); device = dev0 === 'girl' ? 'girl' : 'boy';
      title.open(); quiet++; try { title.startSlot(slot0); } finally { quiet--; }
      pending = false; closePanel();
      if (g0 === undefined) delete player.gender; else player.gender = g0;
      dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq);
      dialogLog.length = 0; dialogLog.push(...log0);
    }
  });

  return { choose, lookAs, dress, remember, get device() { return device; }, get pending() { return pending; }, GIRL_HAIR, RIBBON };
})();
window.BOYGIRL = BOYGIRL;
