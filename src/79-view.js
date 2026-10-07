// ============================================================================
// WATCH A KID'S POINT OF VIEW — the teacher view, round 2 (docs/ONLINE.md, "The teacher view", Watch)
// Owner (6 Oct 2026): "being able to click a player and monitor their POV would be nice". A teacher taps a knight and Watch:
// her own page draws that kid's screen with the game's own renderer, live, from the frames the world forwards to her
// (online/src/watch.js: his presence, the knights and monsters his game shows, who keeps the map, the chat, the crackers).
// Read-only: the page never plays (update() never runs, nothing is saved or sent), no key or tap reaches the game.
//
//   VIEW.install()          wraps title.tick, render, drawHud, drawCharacter and resize, once, when the teacher screen opens
//                           (79-teacherscreen): they are the outermost wraps then, and change nothing unless it is open
//   VIEW.start(v, frame, host)   frame is the world's w_vstart; host = {box (where the canvas goes), zoom}
//   VIEW.feed(m)            one forwarded frame (the inner m of w_v)
//   VIEW.stop()             back to the map: the canvas hidden, the puppets and knights forgotten, an instance left
//   VIEW.setPane(w, h) / setZoom(z) / knightAt(px, py) / watching() / state
//
// What it draws is the STARTING world (the page never loads a save: R2-5): the ground, the townsfolk standing still, the
// knights his game shows (73-players, from their presences, him included as a knight among them), the monsters as puppets
// (75-coop's view mode), the chat bubbles and strip (74-chat), the crackers (77-dropparty). Not his HUD, panels, inventory,
// dialogs, damage numbers, projectiles or drops, and nothing held only in his save (his island's builds, trees he chopped).
// Every feature that draws must not assume update() ran (docs/EXTENDING.md).
// Feature file: wraps by reassignment at run time (install), registers a self-test. window.VIEW is the register.
// ============================================================================
{
  const MIN_W = 760, MAX_W = 1024;          // an older game (no vw on its presence): the logical width his screen is drawn at
  const NAME_PX = 14.5, LV_PX = 13;         // the CSS px a knight's name and level are drawn at, at the least, in this view
  const V = {
    on: false, installed: false, n: null, v: 0, map: 'over', house: false, unknown: false, frozen: false,
    lastP: null, lastPAt: 0, lastFrameAt: 0, startedAt: 0, zoom: 1, box: null, paneW: 0, paneH: 0, girl: false,
    kidW: 0, kidH: 0, scale: 1, offX: 0, offY: 0, cssW: 0, cssH: 0,
    stats: { frames: 0, p: 0, mon: 0, chat: 0 },
  };
  const tsOn = () => !!(window.TEACHERSCREEN && TEACHERSCREEN.active);
  const nowMs0 = () => (typeof nowMs === 'function' ? nowMs() : Date.now());

  // ---------- the wraps (installed once the teacher screen opens) ----------
  function install() {
    if (V.installed) return;
    V.installed = true;
    const _tick = title.tick;
    // while a teacher's page is up: only the clocks a drawn kid's screen needs (never update(): nothing plays, nothing saves)
    title.tick = function (dt) {
      if (!tsOn()) return _tick(dt);
      title.t += dt; time += dt;
      if (V.on && !V.frozen) step(dt);
      pressed.clear(); keys.clear(); touch.taps.length = 0;
    };
    const _render = render;
    // (drawn as if paused: no verb tag beside what he faces, whose coach would write to this device's storage)
    render = function () {
      if (!tsOn()) return _render();
      if (!V.on || V.house || V.unknown || !V.box) return;
      sizeToPane();   // every frame: render() asks resize() only when the window's size differs from VW, VH
      follow();
      const p0 = paused; paused = true;
      try { return _render(); } finally { paused = p0; }
    };
    const _drawHud = drawHud;
    // his HUD is not shown: only his chat strip (his own game draws it in the same lane)
    drawHud = function (g) {
      if (!tsOn()) return _drawHud(g);
      buttons.length = 0;
      if (!V.on) return;
      try { if (typeof HK !== 'undefined' && HK.layout) HK.layout(); } catch (e) { }
      try { if (window.CHAT && CHAT.drawStrip) CHAT.drawStrip(g); } catch (e) { }
      buttons.length = 0;   // nothing on this canvas is a control: the glass over it takes every tap
    };
    V.dcInner = drawCharacter;
    // the page's own knight stands where the kid is (so the camera, the night and the cave's dark follow him) but is never
    // drawn: the kid is drawn by 73-players as a knight among the others, from his own presence
    drawCharacter = function (g, e, kind) { if (tsOn() && V.on && e === player) { V.skipped = (V.skipped || 0) + 1; return; } return V.dcInner(g, e, kind); };
    const _resize = resize;
    resize = function () { if (!tsOn() || !V.on || !V.box) return _resize(); sizeToPane(); };
  }
  // his screen's logical size. Fit (zoom 1) is exactly his own screen, VW x VH as his game has it (the vw, vh on his presence
  // while he is watched), letterboxed into the pane, so the teacher sees exactly the world his camera shows; Closer and Wider
  // zoom from there. An older game sends no size: the pane's width held between 760 and 1024, the pane's proportion. The
  // canvas's pixels are its CSS size's (at most 2 per CSS pixel). Names and levels are drawn at NAME_PX / LV_PX CSS px at the
  // least (PLAYERS.tagScale), however small his screen is drawn here.
  function sizeToPane() {
    const pw = Math.max(1, V.paneW || 1), ph = Math.max(1, V.paneH || 1);
    let lw, lh;
    if (V.kidW >= 200 && V.kidH >= 150) { lw = V.kidW / V.zoom; lh = V.kidH / V.zoom; }
    else { lw = clamp(pw, MIN_W, MAX_W) / V.zoom; lh = lw * ph / pw; }
    const k = Math.min(pw / lw, ph / lh), cssW = lw * k, cssH = lh * k;
    const offX = Math.round((pw - cssW) / 2), offY = Math.round((ph - cssH) / 2);
    VW = lw; VH = lh;
    const dpr = Math.min((window.devicePixelRatio || 1), 2);
    const cw = Math.max(1, Math.round(cssW * dpr)), ch = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    DPR = cw / VW;
    V.scale = k; V.offX = offX; V.offY = offY; V.cssW = cssW; V.cssH = cssH;
    if (V.box) {
      const st = canvas.style, want = [offX + 'px', offY + 'px', cssW.toFixed(2) + 'px', cssH.toFixed(2) + 'px'];
      if (st.left !== want[0]) st.left = want[0]; if (st.top !== want[1]) st.top = want[1];
      if (st.width !== want[2]) st.width = want[2]; if (st.height !== want[3]) st.height = want[3];
    }
    if (window.PLAYERS) PLAYERS.tagScale = Math.max(1, NAME_PX / (11 * k), LV_PX / (9 * k));
  }
  // the page's knight in the kid's place: his drawn position, facing and time of day; never dead, never on a machine (his
  // own knight, drawn by 73-players, shows those)
  function follow() {
    const e = window.PLAYERS && PLAYERS.remote ? PLAYERS.remote[V.n] : null;
    if (e) { player.x = e.shown.x; player.y = e.shown.y; player.facing = { x: e.facing.x, y: e.facing.y }; }
    else if (V.lastP && Number.isFinite(V.lastP.x)) { player.x = V.lastP.x; player.y = V.lastP.y; }
    player.dead = false; player.deadT = 0; player.mech = null; player.hurtT = 0; player.action = null; player.moving = false;
  }
  function step(dt) {
    // his own knight is never forgotten for being quiet: a paused game shows the last thing it showed
    const e = window.PLAYERS && PLAYERS.remote ? PLAYERS.remote[V.n] : null;
    if (e) e.lastAt = nowMs0();
    else if (V.lastP) emit(V.lastP);
    if (typeof player.dayTime === 'number') player.dayTime += dt;
    if (window.PLAYERS && PLAYERS.step) PLAYERS.step(dt);
    if (window.CHAT && CHAT.step) CHAT.step(dt);
    if (window.COOP && COOP.viewStep) COOP.viewStep(dt);
  }
  const emit = m => { if (typeof NET !== 'undefined' && NET.emit) NET.emit(m.t, m); };

  // ---------- his map ----------
  // a new map: the instance is built here exactly as his game built it (the same INSTANCES.define, the same seed), its own
  // monsters go (only his frames' puppets show); his island ('house') is his save alone, so it is not drawn
  function goMap(map) {
    V.map = map; V.house = map === 'house'; V.unknown = false;
    const I = window.INSTANCES;
    if (I && I.active && I.active()) I.leave();
    if (map !== 'over' && map !== 'house') {
      if (!I || !I.get || !I.get(map)) V.unknown = true;
      else { player.dead = false; player.mech = null; if (!I.enter(map)) V.unknown = true; }
    }
    if (window.COOP && COOP.viewStep) COOP.viewStep(0);
    quiet();
  }
  // what an instance's door says to a knight walking in (a voice, a banner) is his game's, not this page's
  function quiet() { dialog.cur = null; dialog.queue.length = 0; areaBanner = null; notice = null; if (typeof clearBanners === 'function') clearBanners(); }

  // ---------- start, feed, stop ----------
  function start(v, frame, host) {
    install();
    if (V.on) stop();
    V.on = true; V.frozen = false; V.v = v; V.n = frame && typeof frame.n === 'string' ? frame.n : null;
    V.map = 'over'; V.house = false; V.unknown = false; V.lastP = null; V.lastPAt = 0; V.lastFrameAt = 0; V.startedAt = nowMs0(); V.kidW = 0; V.kidH = 0;
    V.box = host && host.box || null; if (host && host.zoom) V.zoom = clamp(+host.zoom || 1, 0.6, 2);
    V.css = canvas.style.cssText || '';
    V.stats = { frames: 0, p: 0, mon: 0, chat: 0 };
    emit({ t: 'offline' });             // whatever an earlier view left: knights, bubbles
    if (window.COOP && COOP.viewMode) COOP.viewMode(true);
    if (V.box) { try { V.box.appendChild(canvas); } catch (e) { } canvas.style.display = 'block'; canvas.style.position = 'absolute'; canvas.style.left = '0'; canvas.style.top = '0'; canvas.style.width = '100%'; canvas.style.height = '100%'; }
    // (his screen's size and the frame's place in the pane come with his first presence: sizeToPane)
    if (!frame) return;
    const map = typeof frame.map === 'string' ? frame.map : 'over';
    if (frame.keeper && typeof frame.keeper.map === 'string' && window.COOP) COOP.viewKeeper(frame.keeper.map, frame.keeper.n);
    if (map !== 'over') goMap(map); else quiet();
    for (const o of Array.isArray(frame.others) ? frame.others : []) if (o && o.t === 'p') emit(o);
    if (frame.me && frame.me.t === 'p') feed(frame.me);
    for (const c of Array.isArray(frame.parties) ? frame.parties : []) if (c && c.t === 'crackers') emit(c);
  }
  function feed(m) {
    if (!V.on || V.frozen || !m || typeof m.t !== 'string') return;
    V.lastFrameAt = nowMs0(); V.stats.frames++;
    if (m.t === 'p' && m.n === V.n) {
      V.lastP = m; V.lastPAt = nowMs0(); V.stats.p++;
      if (m.look && typeof m.look === 'object') V.girl = !!m.look.girl;
      if (typeof m.tod === 'number' && Number.isFinite(m.tod)) player.dayTime = m.tod;
      // his screen's size (sent while he is watched): Fit draws exactly what his camera shows
      if (Number.isFinite(m.vw) && Number.isFinite(m.vh) && m.vw >= 200 && m.vh >= 150 && m.vw <= 8000 && m.vh <= 8000) { V.kidW = Math.round(m.vw); V.kidH = Math.round(m.vh); }
      const map = typeof m.map === 'string' && m.map ? m.map : 'over';
      if (map !== V.map) goMap(map);
    }
    if (m.t === 'mon') V.stats.mon++;
    if (m.t === 'chat') V.stats.chat++;
    emit(m);
  }
  function freeze() { V.frozen = true; }
  function stop() {
    if (!V.on) return;
    V.on = false; V.frozen = false;
    const I = window.INSTANCES;
    if (I && I.active && I.active()) I.leave();
    quiet();
    if (window.COOP && COOP.viewMode) COOP.viewMode(false);
    emit({ t: 'offline' });
    // the canvas as it was (79-teacherscreen hides it again on its page)
    try { canvas.style.cssText = V.css || ''; } catch (e) { }
    if (window.PLAYERS) PLAYERS.tagScale = 1;
    V.box = null; V.n = null; V.lastP = null; V.kidW = 0; V.kidH = 0;
  }
  // a tap on the glass over his screen, in the pane's CSS pixels: the knight under it (within 28 px of his feet), or null
  function knightAt(px, py) {
    if (!V.on || !window.PLAYERS || !PLAYERS.remote) return null;
    const sx = 1 / Math.max(1e-6, V.scale), wx = cam.x + (px - V.offX) * sx, wy = cam.y + (py - V.offY) * sx, my = PLAYERS.mapId();
    let best = null, bd = 28;
    for (const n in PLAYERS.remote) { const e = PLAYERS.remote[n]; if (e.map !== my) continue; const d = Math.hypot(e.shown.x - wx, e.shown.y - 6 - wy); if (d <= bd) { bd = d; best = n; } }
    return best;
  }

  window.VIEW = {
    install, start, feed, stop, freeze, knightAt, state: V, MIN_W, MAX_W,
    watching: () => V.on ? V.n : null, on: () => V.on,
    setPane: (w, h) => { V.paneW = Math.max(0, +w || 0); V.paneH = Math.max(0, +h || 0); },
    setZoom: z => { V.zoom = clamp(+z || 1, 0.6, 2); return V.zoom; },
  };

  // ---------- self-test: 60 s of a kid's frames (walk, the Spider Den, fighting, chat, leaving) drawn on this page ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'view: ';
    if (typeof NET === 'undefined' || !window.COOP || !window.PLAYERS || !window.INSTANCES) return;
    const TS = window.TEACHERSCREEN;
    const den = INSTANCES.get('spider_den') ? 'spider_den' : INSTANCES.list()[0];
    const was = { active: TS ? TS.active : false, title: title.active, lock: SAVE_LOCK, send: NET.send, enabled: NET.enabled, ws: window.WebSocket, muted: audioMuted, ctx: audioCtx, AC: window.AudioContext, slot: title.slot, x: player.x, y: player.y, day: player.dayTime, keys: keys.size };
    const titleWasActive = title.active;
    if (!titleWasActive) save();
    // spies: storage, the wire, a socket, saving, the audio and the drawn knights
    // (a browser's Storage methods live on its prototype: an own property set on localStorage would be stored as an item)
    const ls = window.localStorage, writes = [];
    const st = (typeof Storage !== 'undefined' && ls instanceof Storage) ? Storage.prototype : ls;
    const sw = { set: st.setItem, del: st.removeItem };
    let sent = 0, sockets = 0, saves = 0, loads = 0, games = 0, tones = 0;
    const meDrawn = [], drawn = new Set();
    const _save = save, _load = load, _newGame = newGame;
    try {
      st.setItem = function (k, v) { writes.push('set ' + k); return sw.set.call(this, k, v); };
      st.removeItem = function (k) { writes.push('del ' + k); return sw.del.call(this, k); };
    } catch (e) { }
    try {
      if (TS) TS.active = true;
      install();
      title.active = true; SAVE_LOCK = true; NET.enabled = false;
      NET.send = () => { sent++; return false; };
      window.WebSocket = function () { sockets++; throw new Error('no socket'); };
      // teacher mode's sound: no audio context at all (79-teacherscreen closes it and takes away the taps that make one);
      // the device's own sound setting (audioMuted, saved by 43-settings) is never touched
      audioCtx = null; window.AudioContext = function () { tones++; throw new Error('audio'); };
      save = function () { saves++; }; load = function () { loads++; return false; }; newGame = function () { games++; };
      const box = { appendChild() { }, getBoundingClientRect: () => ({ width: 800, height: 500 }) };
      VIEW.setPane(800, 500);
      // the kid: Sam, on the grass west of Thistledown's square, then into the Spider Den, fighting, then gone
      const sq = { x: player.x, y: player.y };
      const pOf = (x, y, map, extra) => Object.assign({ t: 'p', n: 'Sam', map, region: 'x', x, y, fx: 1, fy: 0, mv: true, wt: 1, hp: 30, mhp: 30, lv: 9, look: { tunic: '#3b6fb6', hair: '#5a3a1e', shoulder: '#9aa3b2', fists: true, gear: {} }, mech: null, dead: false, def: 100, act: null, sw: 0, role: 'player', tod: 100 }, extra || {});
      start(1, { t: 'w_vstart', v: 1, n: 'Sam', map: 'over', keeper: { t: 'keeper', map: 'over', n: 'Sam' }, me: pOf(sq.x, sq.y, 'over'), others: [pOf(sq.x + 60, sq.y, 'over', { n: 'Ava', role: 'admin' })], parties: [], old: false, monsters: 'live' }, { box, zoom: 1 });
      const started = V.on && !!PLAYERS.remote.Sam && !!PLAYERS.remote.Ava && monsters.length === 0 && COOP.state.view === true;
      // spy on what is drawn
      const _dc = V.dcInner;
      V.dcInner = function (g, e, kind) { if (e === player) meDrawn.push(kind); if (e && e.nid) drawn.add(e.nid); return _dc(g, e, kind); };
      let near = true, maxGap = 0;
      const frame = dt => { title.tick(dt); render(); const e = PLAYERS.remote.Sam; if (e) { const d = Math.hypot(player.x - e.shown.x, player.y - e.shown.y); maxGap = Math.max(maxGap, d); if (d > 1) near = false; } };
      const gob = MONSTER_SPAWNS.findIndex(s => s && s.type === 'goblin');
      const row = (nid, type, x, y, dead) => [nid, type, Math.round(x), Math.round(y), 10, 10, 'chase', 1, 0, 1, 0, dead ? 1 : 0, 0, 0];
      // 20 s walking east on the overworld with a goblin near, chat twice
      for (let i = 0; i < 20 * 8; i++) {
        const x = sq.x + i * 4;
        feed(pOf(x, sq.y, 'over'));
        if (i % 4 === 0) feed({ t: 'mon', n: 'Sam', list: [row('s' + Math.max(0, gob), 'goblin', x + 90, sq.y + 20, false)] });
        if (i === 40) feed({ t: 'chat', n: 'Ava', text: 'follow me', at: Date.now(), role: 'admin' });
        if (i === 80) feed({ t: 'chat', n: 'Sam', text: 'ok', at: Date.now(), role: 'player' });
        frame(1 / 8);
      }
      const overOk = near && INSTANCES.active() === null && COOP.puppets().length === 1 && COOP.puppets()[0].nid === 's' + Math.max(0, gob) && CHAT.log.some(l => l.n === 'Ava' && l.text === 'follow me');
      // an older game (no vw / vh): the pane's width held between 760 and 1024, the pane's proportion, filling the pane
      const oldSize = VW === 800 && Math.abs(VH - 500) < 1e-6 && V.offX === 0 && V.offY === 0;
      // his screen's size on his presence (a kid at 1366 x 768): Fit draws exactly his VW x VH, letterboxed into the 800 x 500
      // pane, so the world the teacher sees is the world his camera shows (the same cam rectangle to within 1 px)
      const kx = sq.x + 159 * 4;
      for (let i = 0; i < 16; i++) { feed(pOf(kx, sq.y, 'over', { vw: 1366, vh: 768, mv: false })); frame(1 / 8); }
      const kidCam = { x: clamp(kx - 1366 / 2, 0, MAP_W * TILE - 1366), y: clamp(sq.y - 768 / 2, 0, MAP_H * TILE - 768) };
      const k = Math.min(800 / 1366, 500 / 768);
      const sameRect = VW === 1366 && VH === 768 && Math.abs(cam.x - kidCam.x) <= 1 && Math.abs(cam.y - kidCam.y) <= 1;
      const boxed = Math.abs(V.scale - k) < 1e-9 && V.offX === 0 && V.offY === Math.round((500 - 768 * k) / 2) && canvas.style.width === (1366 * k).toFixed(2) + 'px' && canvas.style.height === (768 * k).toFixed(2) + 'px' && canvas.style.top === V.offY + 'px';
      // the names stay readable however small his screen is drawn: 14.5 CSS px at the least, his level 13
      const names = PLAYERS.tagScale * 11 * V.scale >= 14.5 - 1e-9 && PLAYERS.tagScale * 9 * V.scale >= 13 - 1e-9;
      // Closer from Fit shows less of the world (the same middle); Fit again is his screen
      VIEW.setZoom(1.25); frame(1 / 8); const closer = Math.abs(VW - 1366 / 1.25) < 1e-6; VIEW.setZoom(1); frame(1 / 8);
      check(P + 'Fit draws exactly the kid\'s own screen: his presence\'s vw x vh (1366 x 768) becomes this view\'s VW x VH, letterboxed into the pane, the camera rectangle his game has to within 1 px; names at 14.5 CSS px and levels at 13 at the least (here ' + (PLAYERS.tagScale * 11 * V.scale).toFixed(1) + ' px); Closer zooms in from there; an older game without vw fills the pane as before',
        oldSize && sameRect && boxed && names && closer && VW === 1366, { oldSize, sameRect, cam: { x: cam.x, y: cam.y }, kidCam, VW, VH, boxed, scale: V.scale, offY: V.offY, style: [canvas.style.width, canvas.style.height, canvas.style.top], names, tagScale: PLAYERS.tagScale, closer });
      // into the Spider Den: the world says who keeps it first (as enterMap does), then his presence there
      const inst = INSTANCES.get(den), ent = inst.entry;
      feed({ t: 'keeper', map: den, n: 'Sam' });
      feed(pOf(tc(ent[0]), tc(ent[1]), den));
      frame(1 / 8);
      const inDen = INSTANCES.active() === den && monsters.length === 0 && dialog.cur === null;
      // 20 s fighting spiders in there (his own stream, twice a second), one falls
      for (let i = 0; i < 20 * 8; i++) {
        feed(pOf(tc(ent[0]) + (i % 10), tc(ent[1]), den, { sw: Math.floor(i / 3), mv: false }));
        if (i % 4 === 0) feed({ t: 'mon', n: 'Sam', list: [row('i0', inst.spawns[0][0], tc(ent[0]) + 50, tc(ent[1]), i > 120), row('i1', inst.spawns[1] ? inst.spawns[1][0] : inst.spawns[0][0], tc(ent[0]) + 90, tc(ent[1]) + 10, false)] });
        frame(1 / 8);
      }
      const nids = COOP.puppets().map(p => p.nid).sort().join(',');
      const denOk = near && INSTANCES.active() === den && nids === 'i0,i1' && COOP.puppets().every(p => p.remote);
      // out and over to his island: the card shows (nothing drawn)
      feed(pOf(sq.x, sq.y, 'over')); frame(1 / 8);
      const out = INSTANCES.active() === null;
      feed(pOf(sq.x, sq.y, 'house')); frame(1 / 8);
      const house = V.house === true && INSTANCES.active() === null;
      feed(pOf(sq.x, sq.y, 'over')); frame(1 / 8);
      // 20 s more, then he leaves: his knight goes, the frame freezes
      for (let i = 0; i < 20 * 8; i++) { if (i % 8 === 0) feed(pOf(sq.x, sq.y, 'over', { mv: false })); frame(1 / 8); }
      feed({ t: 'left', n: 'Ava', map: 'over' }); frame(1 / 8);
      const avaGone = !PLAYERS.remote.Ava && !!PLAYERS.remote.Sam;
      freeze(); const frozenAt = V.lastFrameAt; feed(pOf(sq.x + 500, sq.y, 'over')); frame(1 / 8);
      const frozen = V.lastFrameAt === frozenAt;
      // no key reaches the game while watching (79-teacherscreen's guard swallows them; here: keys stay empty after a tick)
      keys.add('KeyW'); pressed.add('KeyW'); title.tick(1 / 60);
      const noKeys = keys.size === 0 && pressed.size === 0;
      V.dcInner = _dc;
      stop();
      const stopped = !V.on && !COOP.state.view && !PLAYERS.remote.Sam && INSTANCES.active() === null;
      check(P + 'a 60 s stream (walking, the Spider Den, fighting, chat, his island, a friend leaving) is drawn on this page: the page\'s knight stays within 1 px of his drawn knight and is never drawn itself; the puppets are exactly the stream\'s nids; INSTANCES follows his map; his island shows the card; chat reaches the strip; the frame freezes at the end',
        started && overOk && inDen && denOk && out && house && avaGone && frozen && near && meDrawn.length === 0 && stopped, { started, overOk, inDen, denOk, nids, out, house, avaGone, frozen, near, maxGap, meDrawn: meDrawn.length, stopped });
      check(P + 'NEGATIVE: over the whole stream nothing is written to storage, nothing is sent, no socket is made, save / load / newGame are never called, title.active and SAVE_LOCK stay true, the audio is never reached, and no key reaches the game',
        writes.length === 0 && sent === 0 && sockets === 0 && saves === 0 && loads === 0 && games === 0 && title.active === true && SAVE_LOCK === true && tones === 0 && audioCtx === null && audioMuted === was.muted && noKeys, { writes: writes.slice(0, 6), sent, sockets, saves, loads, games, title: title.active, lock: SAVE_LOCK, tones, noKeys });
    } finally {
      try { stop(); } catch (e) { }
      save = _save; load = _load; newGame = _newGame;
      try { st.setItem = sw.set; st.removeItem = sw.del; } catch (e) { }
      if (TS) TS.active = was.active;
      NET.send = was.send; NET.enabled = was.enabled; window.WebSocket = was.ws; audioMuted = was.muted; audioCtx = was.ctx; window.AudioContext = was.AC;
      SAVE_LOCK = was.lock; player.x = was.x; player.y = was.y; player.dayTime = was.day; keys.clear(); pressed.clear();
      if (!titleWasActive) title.startSlot(was.slot); else title.active = was.title;
      resize();
    }
  });
}
