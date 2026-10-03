// ============================================================================
// BOY OR GIRL — Cohen: "at the beginning of the game, you can choose your gender, and if you haven't already, you can
// choose it, and once you do, you have a girl or a boy's skin."
//
// player.gender is 'boy' or 'girl' (missing = not chosen yet, drawn as the boy). It lives on the player, so it is in
// every save, every slot and every cloud save with no extra work.
//
// When it is asked: never in the world. It is asked on the title, before the knight is put in the world, where nothing
// can happen to him. Every way from the title into the world goes through title.ask (14-title): a slot's card,
// Continue, Enter, and 71-login's start (a new knight after sign-up, a fresh knight, the old address's knight, and Play
// on the "Playing as <name>" card). For a knight with no choice in his save (a new game, or a knight from before this)
// the "Boy or girl?" card takes the place of the slot cards or the login card: both knights side by side, each card one
// big tap. Nothing behind it is drawn as a control, no key does anything, and a tap off it does nothing: the child
// picks. A small "Decide later" goes in as a boy and asks again next time. The knight goes in only once it is answered,
// so a new knight online is the girl in his first presence and in his first cloud save. title.open() drops an unanswered
// card (the login card comes back). Nothing is asked while the self-test runs (it starts slots for its own reasons).
// The pause menu's New game makes a fresh knight in the world; he is asked on the title the next time he comes in.
//
// How she looks: playerLook() gains `girl: true` (and drawHuman's own `woman: true`: the skirt and the long hair) and her
// own hair colour. drawHuman draws, for any look with `girl`, a braid over the shoulder with a ribbon (it hangs out of
// any helm, so she still reads as a girl in full armour), locks of hair under a helm's rim, a bow in the hair when the
// head is bare, and rosy cheeks. That is the old look (a look with no gear). A KNIGHT look (with gear) is drawn by
// 82-knightgear, which draws her skirt, long hair, locks, braid, ribbon, bow, cheeks and lashes in the new style. Everything that draws the knight goes through playerLook + drawHuman (on foot, the
// mare, the walker / dozer / beast seats, the bank, the boat, Thistledown's statue), so all of it follows.
//
// Online: 73-players' lookOf sends `girl` (a boolean) in presence; a remote knight's look with `girl` is drawn the same
// way. The server relays presence unchanged. docs/ONLINE.md (`look`) lists the field.
//
// Settings: a "Your knight" row (Boy / Girl) changes it later. The row mirrors the knight being played (the settings
// file keeps one value per browser; this keeps it equal to the knight's own), and "put every setting back" never
// changes a knight.
//
// Wraps by reassignment with explicit arguments: playerLook, drawHuman, drawHud (the card, only while it is asked on
// the title), title.sprites, title.ask, title.startSlot, title.open, HOOKS.panel.settings, FANGLANDS.selfTest.
// ============================================================================
const BOYGIRL = (() => {
  const GIRL_HAIR = '#8a4f24', RIBBON = '#d0567f';
  const DEVICE_KEY = 'fanglands.knight';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };
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
  // a look for the choice page: the knight as she or he would be, in the armour worn right now. It goes through the
  // whole playerLook chain (77's party hat, this file's dress, 82-knightgear's gear), with the gender set for the moment.
  const lookAs = gnd => {
    const g0 = player.gender; player.gender = gnd === 'girl' ? 'girl' : 'boy';
    try { const l = playerLook(); if (gnd !== 'girl') { delete l.girl; delete l.woman; } return l; }
    finally { if (g0 === undefined) delete player.gender; else player.gender = g0; }
  };

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

  // ---------- when to ask: on the title, before the knight is in the world ----------
  // ask: the card is up ({ n: the slot, go: what goes into the world, fresh: a new game }). want: the answer, laid on the
  // knight the moment title.startSlot has loaded him (inside go, before the socket opens or the cloud is pushed).
  let quiet = 0, ask = null, want = null;
  const chosen = () => player.gender === 'girl' || player.gender === 'boy';
  // the choice in a slot's save, read before it is loaded (null: an empty slot, one that cannot be read, or no choice)
  const savedChoice = n => {
    const raw = lsGet(title.slotKey(n)); if (!raw) return null;
    try { const p = JSON.parse(raw).player || {}; return p.gender === 'girl' || p.gender === 'boy' ? p.gender : null; } catch (e) { return null; }
  };
  const _ask = title.ask;
  title.ask = function (n, go) {
    // the card is up: Enter or Space on the title (Continue) or any other way in waits for the answer, and never
    // takes the card's place (online, it would put a Play alone slot in the world instead of the knight who logged in)
    if (ask) return false;
    if (quiet || savedChoice(n)) return _ask(n, go);
    ask = { n, go, fresh: !lsGet(title.slotKey(n)) };
    keys.clear(); pressed.clear(); touch.taps.length = 0;
    return true;
  };
  // the child's answer: 'boy', 'girl', or null for "Decide later" (a boy for now, asked again next time)
  function answer(gnd) {
    const a = ask; if (!a) return false;
    ask = null; want = gnd === 'girl' || gnd === 'boy' ? gnd : null;
    try { a.go(); } finally { want = null; }
    return true;
  }
  const _startSlot = title.startSlot;
  title.startSlot = function (n) {
    const r = _startSlot(n);
    if (want) { player.gender = want; want = null; save(); }
    if (chosen()) remember(player.gender);
    return r;
  };
  const _open = title.open;
  title.open = function () { ask = null; return _open(); };
  // the self-test drives startSlot, Continue and the login for its own reasons: it never meets the card unless a check
  // asks for it
  { const F = window.FANGLANDS, _selfTest = F.selfTest;
    F.selfTest = function () { quiet++; try { return _selfTest.call(this); } finally { quiet--; } }; }

  // from Settings (the Settings page stays open)
  function choose(gnd) {
    player.gender = gnd === 'girl' ? 'girl' : 'boy';
    remember(player.gender); syncSetting();
    save();
    notify(player.gender === 'girl' ? 'You are a girl knight.' : 'You are a boy knight.');
  }

  // ---------- the card: the title's backdrop and heading, then two knights side by side, each card one big tap ----------
  // The knights are bare-headed in the title knight's blue tunic, with nothing in their hands (a sword would reach out of
  // the card on a phone), so the hair, the bow and the braid show plainly. Only its own three controls are on the
  // screen: the two cards and "Decide later".
  const BASE = { tunic: '#3b6fb6', hair: '#5a3a1e', shoulder: '#9aa3b2', fists: true };
  const cardLook = gnd => { const l = Object.assign({}, BASE); return gnd === 'girl' ? dress(l) : l; };
  let askRect = null;   // where the card was last drawn (the self-test reads it)
  function drawAsk(g) {
    const F = title.frame(), T = HK.T, t = F.t, R = HK.row();
    title.backdrop(g);
    title.heading(g, F);
    const top = Math.round(F.headBottom + (F.short ? 8 : 18)), bottom = VH - F.S.b - F.M;
    const w = Math.round(Math.min(t ? 560 : 520, F.right - F.left - 4)), x = Math.round(VW / 2 - w / 2);
    const pad = 16, gap = t ? 14 : 12, headH = F.short ? 52 : 66, laterW = Math.min(w - 2 * pad, t ? 200 : 180);
    // the heading, a card's word plate and its margins, the gap, "Decide later" and the foot
    const artH = clamp(Math.round(bottom - top - (headH + R + 18 + 12 + R + pad)), 56, 190);
    const cardW = Math.floor((w - 2 * pad - gap) / 2), cardH = artH + R + 18;
    const h = headH + cardH + 12 + R + pad;
    const y = Math.round(top + clamp((bottom - top - h) / 2, 0, 40));
    askRect = { x, y, w, h };
    HK.vellumPlate(g, x, y, w, h, { edge: 'rgba(247,220,143,0.95)' });
    const hf = HK.FC(800, F.short ? 19 : 23), sf = HK.FS(600, F.short ? 13 : 15), box = { x: x + pad, y, w: w - 2 * pad, h: headH };
    HK.text(g, 'Boy or girl?', VW / 2, y + (F.short ? 25 : 31), { font: hf, align: 'center', color: T.goldHi, shadow: 'rgba(0,0,0,0.9)', box, fitId: 'boygirl:head' });
    const subs = ask.fresh ? ['Pick your new knight. Settings can change it later.', 'Pick your new knight.'] : ['Pick your knight. Settings can change it later.', 'Pick your knight.'];
    const sub = subs.find(s => HK.tw(g, s, sf) <= box.w) || subs[subs.length - 1];
    HK.text(g, sub, VW / 2, y + (F.short ? 43 : 54), { font: sf, align: 'center', color: T.inkDim, box, fitId: 'boygirl:sub' });
    [['boy', 'Boy'], ['girl', 'Girl']].forEach(([gnd, word], i) => {
      const cx = x + pad + i * (cardW + gap), cy = y + headH;
      const label = 'choose:' + gnd, st = HK.stateOf(label), dy = st.pressed ? 1.5 : 0;
      HK.vellumPlate(g, cx, cy + dy, cardW, cardH, { edge: st.hover || st.pressed ? 'rgba(247,220,143,0.95)' : null });
      // the knight, big and facing out of the card, on a soft shadow
      const s = clamp(Math.min(cardW / 46, artH / 44), 1.4, 3.4), fx = cx + cardW / 2, fy = cy + 8 + artH * 0.56 + dy;
      g.save(); g.translate(fx, fy); g.scale(s, s);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 12, 12, 5, 0, 0, 7); g.fill();
      drawHuman(g, { facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, walkT: 0, moving: false }, cardLook(gnd));
      g.restore();
      // the word on an iron plate along the card's foot (drawn only: the whole card is the tap)
      HK.plateButton(g, { x: cx + 10, y: cy + cardH - R - 10 + dy, w: cardW - 20, h: R }, null, word, 'primary', { cinzel: true, hover: st.hover });
      buttons.push({ x: cx, y: cy, w: cardW, h: cardH, label, action: () => answer(gnd), up: true, name: word === 'Boy' ? 'A boy knight' : 'A girl knight' });
    });
    platePush(g, Math.round(VW / 2 - laterW / 2), y + headH + cardH + 12, laterW, R, 'boygirl:later', 'Decide later', () => answer(null), null, { name: 'Play as a boy for now; it asks again next time' });
  }
  const _drawHud = drawHud;
  drawHud = function (g) {
    if (!title.active || !ask) return _drawHud(g);
    buttons.length = 0; minimapRect = null;   // the card owns every tap
    g.textBaseline = 'alphabetic';
    drawAsk(g);
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
      choose(v === 'Girl' ? 'girl' : 'boy');
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
    if (!title.active) save();
    const g0 = player.gender, slot0 = title.slot, wasTitle = title.active, dc = dialog.cur, dq = dialog.queue.slice(), log0 = dialogLog.slice();
    const q0 = quiet; quiet = 0;
    const SK = n => title.slotKey(n), AK = n => title.slotKey(n) + '.at';
    const CUR = 'fanglands.slot.current', L = window.LOGIN, MARK = L && L.MARK_KEY, NAME = 'fanglands.lastname';
    const keep = [1, 2, 3].map(n => [lsGet(SK(n)), lsGet(AK(n))]), cur0 = lsGet(CUR), mark0 = MARK ? lsGet(MARK) : null, name0 = lsGet(NAME), dev0 = lsGet(DEVICE_KEY);
    const net0 = { enabled: NET.enabled, token: NET.token, fake: NET.fake }, login0 = L && { playing: L.playing, alone: L.alone, name: L.name };
    const restore = panelSizeSaver(), t0 = window.__forceTouch, text0 = SETTINGS.get('text');
    // the slot's save as the title would read it, and one with the choice taken out (a knight from before this)
    const savedOf = n => { try { return (JSON.parse(lsGet(SK(n)) || '{}').player || {}).gender || null; } catch (e) { return 'unreadable'; } };
    const unchoose = n => { const d = JSON.parse(lsGet(SK(n))); delete d.player.gender; lsSet(SK(n), JSON.stringify(d)); };
    const labels = () => buttons.filter(b => !b.offscreen).map(b => b.label).sort().join(',');
    const CARD = 'boygirl:later,choose:boy,choose:girl';
    // a real tap: down and up in the middle of the button
    const tap = label => { render(); const b = buttons.find(q => q.label === label); if (!b) return false; const x = b.x + b.w / 2, y = b.y + b.h / 2; pointerDown(x, y, 'boygirl-test'); pointerUp('boygirl-test', x, y); render(); return true; };
    // every time a 'boygirl' page is opened in the world
    let opened = 0; const _openPanel = openPanel; openPanel = function (name, arg) { if (name === 'boygirl') opened++; return _openPanel(name, arg); };
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
      // 4. a new game on an iPad held upright: tapping an empty slot puts up the card on the title, and the knight is not
      // in the world (the title is up, the slot not even saved yet). Only the card's three controls are on the screen.
      // Taps off it and the keys Enter, Space, Esc do nothing. Tapping Girl starts the game as a girl knight, saved.
      { NET.enabled = false; panelSetSize(768, 1024); window.__forceTouch = true;
        lsDel(SK(3)); lsDel(AK(3)); title.open(); render();
        const tapped = F.clickButton('Slot 3');
        const a0 = ask, r = { tapped, asking: !!ask, n: ask && ask.n, fresh: ask && ask.fresh, title: title.active, saved: lsGet(SK(3)) !== null, labels: labels() };
        const cards = buttons.filter(b => /^choose:/.test(b.label)); r.big = cards.length === 2 && cards.every(b => b.w >= 120 && b.h >= 110);
        // stray presses: the four corners of the screen and the space under the card, then Enter, Space and Esc on the title's tick
        const R0 = askRect || { x: 0, y: 0, w: 0, h: 0 }, spots = [[6, 6], [VW - 6, 6], [6, VH - 6], [VW - 6, VH - 6], [VW / 2, Math.min(VH - 4, R0.y + R0.h + 20)]];
        r.offCard = spots.every(([x, y]) => !buttons.some(b => hitButton(b, x, y)));
        for (const [x, y] of spots) { pointerDown(x, y, 'boygirl-stray'); pointerUp('boygirl-stray', x, y); title.tick(1 / 60); render(); }
        for (const code of ['Enter', 'Space', 'Escape']) { pressed.add(code); keys.add(code); title.tick(1 / 60); render(); }
        r.stray = { same: ask === a0, title: title.active, saved: lsGet(SK(3)) !== null, slotButton: F.clickButton('Slot 1') };
        r.girl = tap('choose:girl');
        r.after = { title: title.active, asking: !!ask, gender: player.gender, saved: savedOf(3), slot: title.slot, device, look: playerLook().girl === true };
        // in the world nothing asks again: no page, no panel for it at all, and the story starts as it always did
        let voice = false; for (let i = 0; i < 300; i++) { F.step([]); if (dialog.cur && dialog.cur.text === "You're finally awake.") voice = true; }
        r.world = { opened, panel: 'boygirl' in HOOKS.panel, voice };
        window.__forceTouch = t0; restore();
        check(P + 'a new game: tapping an empty slot puts up "Boy or girl?" on the title before the knight is in the world (title up, slot not saved), with only its two cards (120 x 110 or more) and "Decide later" to tap', r.tapped && r.asking && r.n === 3 && r.fresh === true && r.title && !r.saved && r.labels === CARD && r.big, r);
        check(P + 'the card cannot be tapped away: taps off it (the corners, under it) and Enter, Space, Esc leave the same card up, the knight still out of the world, and nothing behind it can be tapped', r.offCard && r.stray.same && r.stray.title && !r.stray.saved && r.stray.slotButton === false, r.stray);
        check(P + 'tapping Girl starts the game as a girl knight: in the world, saved in the slot, remembered for the title knight', r.girl && !r.after.title && !r.after.asking && r.after.gender === 'girl' && r.after.saved === 'girl' && r.after.slot === 3 && r.after.device === 'girl' && r.after.look, r.after);
        check(P + 'never in the world: no "Boy or girl?" page exists or opens there, and The Voice starts the story as before', r.world.opened === 0 && r.world.panel === false && r.world.voice, r.world); }
      // 5. a knight who has chosen goes straight in from his slot
      { title.open(); render(); const tapped = F.clickButton('Slot 3');
        check(P + 'a knight who has chosen is not asked: his slot goes straight into the world', tapped && !ask && !title.active && player.gender === 'girl', { tapped, asking: !!ask, title: title.active, gender: player.gender }); }
      // 6. a knight from before this (no choice in his save): Enter on the title (Continue) asks first; Boy starts him as a boy
      { unchoose(3); title.open(); pressed.add('Enter'); title.tick(1 / 60);
        const r = { asking: !!ask, n: ask && ask.n, fresh: ask && ask.fresh, title: title.active };
        render(); r.labels = labels(); r.boy = F.clickButton('choose:boy');
        r.after = { title: title.active, gender: player.gender, saved: savedOf(3), look: !playerLook().girl };
        check(P + 'a knight who never chose is asked on the title before Continue (Enter) puts him in the world; Boy starts him as a boy, saved', r.asking && r.n === 3 && r.fresh === false && r.title && r.labels === CARD && r.boy && !r.after.title && r.after.gender === 'boy' && r.after.saved === 'boy' && r.after.look, r); }
      // 7. "Decide later": he goes in as a boy with no choice saved, nothing asks in the world, and the title asks again
      // next time; title.open() drops an unanswered card
      { unchoose(3); title.open(); render(); const r = { cont: F.clickButton('Continue'), asking: !!ask };
        render(); r.later = F.clickButton('boygirl:later');
        r.after = { title: title.active, gender: player.gender || null, saved: savedOf(3), look: !playerLook().girl };
        const o0 = opened; for (let i = 0; i < 120; i++) F.step([]); r.quiet = opened === o0 && panel !== 'boygirl';
        title.open(); render(); F.clickButton('Slot 3'); r.again = !!ask && title.active;
        title.open(); render(); r.dropped = !ask && buttons.some(b => b.label === 'Slot 1');
        check(P + '"Decide later" goes in as a boy with nothing saved, nothing asks in the world, and the card comes back on the next way in; going to the title drops it', r.cont && r.asking && r.later && !r.after.title && r.after.gender === null && r.after.saved === null && r.after.look && r.quiet && r.again && r.dropped, r); }
      // back in the world (a boy) for the checks that need the game: Settings and the wire
      quiet++; try { title.startSlot(3); } finally { quiet--; } player.gender = 'boy';
      // 9. Settings: the "Your knight" row shows the knight and changes it and the Settings page stays open; "put every setting back" leaves the knight alone
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
      // 10. online: presence carries girl, a change goes out at once, and a remote girl knight is drawn as one
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
      // 10b. the title screen's knight is the last knight played here
      { remember('girl'); const K = title.KNIGHT; title.sprites(recorder().g, 0, 0, 1, 0, 0, 1); const girl = !!(K && K.girl);
        remember('boy'); title.sprites(recorder().g, 0, 0, 1, 0, 0, 1); const boy = !!(K && !K.girl && K.hair === '#5a3a1e');
        check(P + 'the title screen\'s knight matches the last knight played on this device', girl && boy, { girl, boy }); }
      // 11. the card at every device size, touch and mouse, Large text, a new game and a knight from before: the cards big,
      // every control 44 px on touch and apart, on screen, out of the bands, every word inside its box, the card under the
      // FANGLANDS heading and above the bottom of the screen
      { const problems = []; let tried = 0;
        try {
          for (const [w, hh] of HK.audit.SIZES) {
            if (!panelSetSize(w, hh)) continue; tried++;
            for (const tch of [true, false]) for (const fresh of [true, false]) {
              window.__forceTouch = tch; SETTINGS.set('text', 'large'); title.open(); ask = { n: 3, go: () => { }, fresh };
              const where = `boygirl ${w}x${hh} ${tch ? 'touch' : 'mouse'}${fresh ? ' new' : ''}`;
              problems.push(...panelFrame(where, { from: 0, panel: false }));
              const cards = buttons.filter(b => /^choose:/.test(b.label)), Fr = title.frame(), A = askRect;
              if (labels() !== CARD) problems.push(`${where}: controls ${labels()}`);
              if (cards.length !== 2 || cards.some(b => b.w < (tch ? 120 : 90) || b.h < 110)) problems.push(`${where}: cards ${cards.map(b => Math.round(b.w) + 'x' + Math.round(b.h)).join(' ')}`);
              if (!A || A.y < Fr.headBottom || A.y + A.h > VH - Fr.S.b || A.x < 0 || A.x + A.w > VW) problems.push(`${where}: the card is at ${A && [A.x, A.y, A.w, A.h].map(Math.round).join(',')}`);
            }
          }
        } finally { ask = null; window.__forceTouch = t0; SETTINGS.set('text', text0); restore(); }
        check(P + 'the card at all 8 device sizes, touch and mouse, Large text: two big cards (120 px wide or more on touch, 110 tall), 44 px controls apart, on screen and out of the bands, every word fits, under the heading', tried === 8 && problems.length === 0, { tried, problems: problems.slice(0, 6), total: problems.length }); }
      // 12. online (71-login with a small world that answers on the spot): every way in asks on the title first
      if (L) {
        const socks = [];
        const world = {
          names: {}, saves: {}, puts: 0,
          call(method, path, body, token) {
            const fail = (code, status) => { const e = new Error(code); e.code = code; e.status = status; throw e; };
            const key = token && token.startsWith('tok-') ? token.slice(4) : null;
            if (path === '/api/status') return { ok: true, online: 0, names: [] };
            if (path === '/api/signup' || path === '/api/login') { const k = String(body.name).toLowerCase(); world.names[k] = body.name; return { token: 'tok-' + k, name: body.name }; }
            if (!key) fail('auth', 401);
            if (path === '/api/me') return { name: world.names[key] };
            if (path === '/api/save' && method === 'GET') return { save: world.saves[key] || null, at: 5 };
            if (path === '/api/save' && method === 'PUT') { world.puts++; world.saves[key] = body; return { at: 6 }; }
            if (path === '/api/logout') return { ok: true };
            fail('bad', 400);
          },
          open: () => { const s = { readyState: 1, sent: [], send(str) { const m = JSON.parse(str); s.sent.push(m); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: L.name, at: 1, keeper: L.name }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; socks.push(s); return s; },
        };
        const cloudOf = () => { try { return (JSON.parse(world.saves.mia || '{}').player || {}).gender || null; } catch (e) { return 'unreadable'; } };
        const stripCloud = () => { const d = JSON.parse(world.saves.mia); delete d.player.gender; world.saves.mia = JSON.stringify(d); };
        try {
          NET.enabled = true; NET.useFake(world); NET.setToken(null); L.alone = false; L.playing = false; if (window.CLOUD) CLOUD.reset();
          // a new knight: after sign-up the card is on the title; the login card is put away, no socket, nothing pushed
          title.open(); const shown = L.showing;
          L.submit('Mia', 'castle', 'dragon', true); render();
          const a = { shown, asking: !!ask, fresh: ask && ask.fresh, title: title.active, playing: L.playing, showing: L.showing, socks: socks.length, puts: world.puts, labels: labels() };
          const a0 = ask; pressed.add('Enter'); title.tick(1 / 60); a.enter = ask === a0 && title.active && !L.playing;
          a.girl = tap('choose:girl');
          F.sim(20, []);
          const ps = socks[0] ? socks[0].sent.filter(m => m.t === 'p') : [];
          a.after = { playing: L.playing, title: title.active, gender: player.gender, status: NET.status, cloud: cloudOf(), firstPresence: ps.length ? ps[0].look.girl : null };
          check(P + 'online, a new knight: after sign-up "Boy or girl?" is on the title (the login card put away, no socket, nothing pushed, Enter does nothing); Girl puts her in the world, her first cloud save and her first presence say girl', a.shown && a.asking && a.fresh === true && a.title && !a.playing && !a.showing && a.socks === 0 && a.puts === 0 && a.labels === CARD && a.enter && a.girl && a.after.playing && !a.after.title && a.after.gender === 'girl' && a.after.status === 'on' && a.after.cloud === 'girl' && a.after.firstPresence === true, a);
          // a knight from before this, on the "Playing as Mia" card: Play asks first; Boy puts him in and the cloud keeps it
          title.toTitle(); const me = L.mode === 'me' && L.showing; stripCloud(); const socks0 = socks.length;
          const b = { me, play: L.playAs(), asking: !!ask, fresh: ask && ask.fresh, title: title.active, playing: L.playing, showing: L.showing, socks: socks.length === socks0 };
          render(); b.boy = F.clickButton('choose:boy'); if (window.CLOUD) CLOUD.flush();
          b.after = { playing: L.playing, title: title.active, gender: player.gender, cloud: cloudOf() };
          check(P + 'online, a knight who never chose: Play on the "Playing as" card asks on the title before he is in the world; Boy puts him in as a boy and the cloud save keeps it', b.me && b.play && b.asking && b.fresh === false && b.title && !b.playing && !b.showing && b.socks && b.boy && b.after.playing && !b.after.title && b.after.gender === 'boy' && b.after.cloud === 'boy', b);
          // a knight who has chosen goes straight in
          title.toTitle(); const c = { play: L.playAs(), asking: !!ask, playing: L.playing, title: title.active, gender: player.gender };
          check(P + 'online, a knight who has chosen: Play goes straight into the world', c.play && !c.asking && c.playing && !c.title && c.gender === 'boy', c);
          // the knight from the old address with no choice: asked first; "Decide later" puts him in as a boy with no choice
          // saved; the next Play asks again; going to the title drops the card and brings the login card back
          title.toTitle(); stripCloud(); const old = world.saves.mia; L.offer = Object.assign({ save: old, at: 7 }, L.summarizeRaw(old)); L.mode = 'offer';
          L.bring(true); const d = { asking: !!ask, title: title.active, playing: L.playing };
          render(); d.later = F.clickButton('boygirl:later'); if (window.CLOUD) CLOUD.flush();
          d.after = { playing: L.playing, gender: player.gender || null, cloud: cloudOf(), look: !playerLook().girl };
          title.toTitle(); L.playAs(); d.again = !!ask && title.active && !L.playing;
          title.open(); d.dropped = !ask && L.showing && title.active;
          check(P + 'online, the old address\'s knight with no choice is asked first; "Decide later" goes in as a boy with nothing saved; the next Play asks again; going to the title drops the card and shows the login card', d.asking && d.title && !d.playing && d.later && d.after.playing && d.after.gender === null && d.after.cloud === null && d.after.look && d.again && d.dropped, d);
        } finally {
          ask = null; L.hide(); NET.disconnect(); NET.useFake(net0.fake); NET.enabled = net0.enabled; NET.setToken(net0.token); NET.status = 'off'; NET.me = null;
          Object.assign(L, login0, { error: '', offer: null, busy: false, mode: 'form' }); if (window.CLOUD) CLOUD.reset();
        }
      }
      // 13. while the self-test runs (quiet) the title's door asks nothing, so no other check meets the card
      { quiet = 1; title.open(); lsDel(SK(3)); lsDel(AK(3)); title.enter(3); const none = !ask && !title.active; quiet = 0;
        check(P + 'while quiet (the self-test) a new slot goes straight in', none, { asking: !!ask, title: title.active }); }
    } finally {
      openPanel = _openPanel; quiet = q0; ask = null; window.__forceTouch = t0; NET.enabled = net0.enabled;
      for (let n = 1; n <= 3; n++) { const [s, a] = keep[n - 1]; if (s == null) { lsDel(SK(n)); lsDel(AK(n)); } else { lsSet(SK(n), s); lsSet(AK(n), a || Date.now()); } }
      if (cur0 == null) lsDel(CUR); else lsSet(CUR, cur0);
      if (MARK) { if (mark0 == null) lsDel(MARK); else lsSet(MARK, mark0); }
      if (name0 == null) lsDel(NAME); else lsSet(NAME, name0);
      if (dev0 == null) lsDel(DEVICE_KEY); else lsSet(DEVICE_KEY, dev0); device = dev0 === 'girl' ? 'girl' : 'boy';
      title.open(); if (!wasTitle) { quiet++; try { title.startSlot(slot0); } finally { quiet--; } }
      closePanel();
      if (g0 === undefined) delete player.gender; else player.gender = g0;
      dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq);
      dialogLog.length = 0; dialogLog.push(...log0);
    }
  });

  return { choose, answer, lookAs, dress, remember, get device() { return device; }, get asking() { return ask ? { n: ask.n, fresh: ask.fresh } : null; }, GIRL_HAIR, RIBBON };
})();
window.BOYGIRL = BOYGIRL;
