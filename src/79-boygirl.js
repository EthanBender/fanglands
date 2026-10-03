// ============================================================================
// BOY OR GIRL — Cohen: "at the beginning of the game, you can choose your gender, and if you haven't already, you can
// choose it, and once you do, you have a girl or a boy's skin."
//
// player.gender is 'boy' or 'girl' (missing = not chosen yet, drawn as the boy). It lives on the player, so it is in
// every save, every slot and every cloud save with no extra work.
//
// When it is asked: every way into a game goes through title.startSlot (a slot from the title screen, Continue, the
// online login with a cloud knight or a fresh one, Put my knight back). After it, a knight with no choice gets the
// "Boy or girl?" page once on that load; closing it keeps the boy look and it asks again on the next load until a
// choice is made. The pause menu's New game asks too (a fresh knight in the same visit). Nothing is asked while the
// self-test runs, nor in the tools that call newGame() directly (the sims, dom-keys).
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
// Wraps by reassignment with explicit arguments: playerLook, drawHuman, title.startSlot, title.sprites,
// HOOKS.panel.settings, FANGLANDS.selfTest.
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
  let quiet = 0, armed = false, pending = false;
  const _startSlot = title.startSlot;
  title.startSlot = function (n) {
    const r = _startSlot(n);
    armed = true;
    if (player.gender === 'girl' || player.gender === 'boy') { remember(player.gender); pending = false; }
    else pending = !quiet;
    return r;
  };
  // the pause menu's New game: a fresh knight in the same visit (a load right after it is handled by startSlot above)
  HOOKS.newGame.push(() => { if (armed && !quiet) pending = true; });
  HOOKS.update.push(() => {
    if (!pending || quiet || title.active) return;
    if (player.gender === 'girl' || player.gender === 'boy') { pending = false; return; }
    // another page is open, or a place's name is across the middle of the screen: ask when it has gone
    if (panel || areaBanner) return;
    pending = false; openPanel('boygirl');
  });
  // the self-test drives startSlot and newGame for its own reasons: it never gets the page unless a check asks for it
  { const F = window.FANGLANDS, _selfTest = F.selfTest;
    F.selfTest = function () { quiet++; try { return _selfTest.call(this); } finally { quiet--; } }; }

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
    const t = touchMode(), R = HK.row(), T = HK.T;
    const room = panelRoom(t ? 460 : 440, VH), w = room.w;
    const top = 62, foot = 16, gap = t ? 14 : 12;
    const cardW = Math.floor((w - 36 - gap) / 2);
    const artH = clamp(Math.round(room.h - top - foot - R - 24), 72, 170);
    const cardH = artH + R + 18;
    const h = top + cardH + foot;
    const { px, py } = panelBox(g, w, h, 'Boy or girl?', 'Choose your knight. Settings can change it later.');
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
    const g0 = player.gender, slot0 = title.slot, dc = dialog.cur, dq = dialog.queue.slice();
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
      // 4. a new game asks: the page comes up, a tap on the girl card chooses, saves and closes it
      { save(); localStorage.removeItem(SK(3)); localStorage.removeItem(AK(3));
        title.open(); title.startSlot(3); dialog.cur = null; dialog.queue.length = 0; untilAsked();
        const asked = panel === 'boygirl'; render();
        const cards = ['choose:boy', 'choose:girl'].map(l => buttons.find(b => b.label === l)).filter(Boolean);
        const big = cards.length === 2 && cards.every(b => b.w >= 44 && b.h >= 44);
        const tapped = F.clickButton('choose:girl');
        const saved = JSON.parse(lsGet(SK(3)) || '{}').player || {};
        check(P + 'a new game (an empty slot) puts up "Boy or girl?" with both knights as big cards; tapping Girl makes a girl knight, saves it and closes the page', asked && big && tapped && player.gender === 'girl' && saved.gender === 'girl' && panel === null && playerLook().girl === true, { asked, big, tapped, gender: player.gender, saved: saved.gender, panel });
        // the choice is kept: loading it again asks nothing
        title.open(); title.startSlot(3); F.step([]); F.step([]);
        check(P + 'a knight who has chosen is not asked again when the slot is loaded', panel !== 'boygirl' && player.gender === 'girl', { panel, gender: player.gender }); }
      // 5. an old save with no choice: asked once on this load; closed, it stays closed (and the knight looks like a boy)
      { const d = JSON.parse(lsGet(SK(3))); delete d.player.gender; lsSet(SK(3), JSON.stringify(d));
        title.open(); title.startSlot(3); dialog.cur = null; dialog.queue.length = 0; untilAsked();
        const asked = panel === 'boygirl'; closePanel(); F.sim(30, []);
        check(P + 'an existing knight who never chose is asked once on the next load; closing the page keeps the boy look and it does not pop back up', asked && panel === null && !player.gender && !playerLook().girl, { asked, panel, gender: player.gender }); }
      // 6. the pause menu's New game in the same visit asks again
      { newGame(); untilAsked(); const asked = panel === 'boygirl'; render(); F.clickButton('choose:boy');
        check(P + 'the pause menu\'s New game asks too; tapping Boy makes a boy knight', asked && player.gender === 'boy' && panel === null && !playerLook().girl, { asked, gender: player.gender, panel }); }
      // 6b. a place's name across the screen goes first; the page comes up after it
      { newGame(); areaBanner = { name: 'Thistledown', sub: 'The city that still stands', t: 0.5 }; F.step([]); const waited = panel !== 'boygirl';
        untilAsked(); const after = panel === 'boygirl' && !areaBanner; closePanel(); player.gender = 'boy';
        check(P + 'the page waits for a place\'s name banner to go, then comes up', waited && after, { waited, after }); }
      // 7. Settings: the "Your knight" row shows the knight and changes it and the Settings page stays open; "put every setting back" leaves the knight alone
      { closePanel(); openPanel('settings'); let found = false;
        for (let p = 0; p < 12 && !found; p++) { render(); found = buttons.some(b => b.label === 'set:knight'); if (!found && !F.clickButton('Next')) break; }
        const shown = SETTINGS.get('knight');
        const tapped = F.clickButton('set:knight');
        const girl = player.gender === 'girl' && SETTINGS.get('knight') === 'Girl' && playerLook().girl === true;
        render(); SETTINGS.reset();
        const kept = player.gender === 'girl' && SETTINGS.get('knight') === 'Girl';
        const open = panel === 'settings';
        F.clickButton('set:knight') || SETTINGS.cycle('knight');
        closePanel();
        check(P + 'Settings has "Your knight" (Boy for a boy); a tap makes her a girl; putting every setting back does not change the knight', found && shown === 'Boy' && tapped && girl && kept && open && player.gender === 'boy', { found, shown, tapped, girl, kept, open, now: player.gender }); }
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
              if (cards.length !== 2 || cards.some(b => b.w < (tch ? 120 : 90) || b.h < 110)) problems.push(`${where}: cards ${cards.map(b => Math.round(b.w) + 'x' + Math.round(b.h)).join(' ')}`);
            }
          }
        } finally { closePanel(); window.__forceTouch = t0; SETTINGS.set('text', text0); restore(); }
        check(P + 'the page at all 8 device sizes, touch and mouse, Large text: two big cards (120 px wide or more on touch, 110 tall), 44 px controls, nothing overlapping or off screen, every word fits', tried === 8 && problems.length === 0, { tried, problems: problems.slice(0, 6) }); }
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
          res = { sent, bw, drawn: !!mia, hair: rec.fills.filter(f => f === '#654321').length, ribbon: rec.fills.includes(RIBBON) };
        } finally { NET.disconnect(); NET.enabled = was.enabled; NET.token = was.token; NET.useFake(was.fake); if (PLAYERS.remote.Mia) delete PLAYERS.remote.Mia; }
        check(P + 'online: presence carries look.girl (false for a boy), a change goes out at once, and a remote girl knight in a helm is drawn with her braid and ribbon', res.sent === true && res.bw === false && res.drawn && res.hair >= 3 && res.ribbon, res); }
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
    }
  });

  return { choose, lookAs, dress, remember, get device() { return device; }, get pending() { return pending; }, GIRL_HAIR, RIBBON };
})();
window.BOYGIRL = BOYGIRL;
