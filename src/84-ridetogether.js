// ============================================================================
// RIDE TOGETHER — a friend hops on a knight's machine and rides along with him
// Owner (7 Oct 2026): "Can you also make it so that if a player has repaired a goblin bulldozer or other mech that other
// players if they see them walking by and hop on and ride as well so they can ride together?"
// Online only. A machine a friend drives has seats: the walker 1, the bulldozer 2, the Barrelbeast 2 (never the mare).
// Standing by it, a knight sees "E: Hop on" (the USE seat reads HOP ON on a touch screen) and his knight sits on the
// machine, drawn in a seat, and goes wherever it goes on every screen. He cannot steer, swing or shoot from the seat (he
// holds on; that is what the seat is for), he can chat, and E (or the same seat, now HOP OFF, or X) sets him down on a
// free tile beside the machine. The driver reads who rides with him on a plaque. When the driver gets out, parks, loses
// the machine, falls, goes into a place, logs out or his line drops, every rider is set down the same way (never in a wall
// or water). A rider whose own line drops just goes from the seat.
// Nothing of one kid's game is changed by another's: the rider's game moves his own knight (where it is saved is where his
// knight is), no item, coin or quest is touched, and the machine stays the driver's.
// The wire: presence carries ride: { d, s } (the driver's name, the seat from 1); the world checks every one and answers a
// ride it will not have with ride_no, and a driver who stops driving with ride_end (online/src/ride.js; docs/ONLINE.md,
// "Riding together"). A page that does not know seats shows the rider standing where his presence says he is.
// Feature file: wraps useAction, exitMech, playerAttack, placeAction, goHome, inputVector, tapVector, frontTile, npcInFront
// and NET.send by reassignment (each passes straight through unless this knight is riding along); its own draw and hud
// hooks. window.RIDE is the handle (and the test handle).
// ============================================================================
const RIDE = (() => {
  // the seats each machine has, and what a kid calls it
  const SEATS = { walker: 1, dozer: 2, beast: 2 };
  const WHAT = { walker: 'walker', dozer: 'bulldozer', beast: 'Barrelbeast' };
  // the machines' own radius (06-systems' walker, 22-bulldozer, 32-beast): how far a friend stands from its middle
  const BODY_R = { walker: 20, dozer: 22, beast: 26 };
  const HOP_REACH = 52;      // px past the machine's own radius: a friend on any tile touching it, corners too (the world allows 3 tiles)
  const SEAT_K = 0.86;       // a rider is drawn the size the driver is drawn in his own seat
  const NAG_EVERY = 3;       // s: "Mudtech is driving" at most this often
  const KNIGHT_R = 13;       // the knight on foot
  // Where each seat is, in px from the machine's middle as it is drawn (84-mountlook, the monster refit's machines), for the
  // machine seen from the side facing right (left is the mirror), from the front (facing us) and from behind. Measured
  // on the drawings: the walker's one seat is on the barrel behind the driver; the bulldozer's two stand on each end of
  // the blade's frame (from the side: on its hood and on its back deck); the Barrelbeast's two sit on the barrel's lid.
  const SEAT_AT = {
    walker: { side: [[-16, -15]], down: [[16, -14]], up: [[-16, -12]] },
    dozer: { side: [[16, -6], [-14, -6]], down: [[-25, -4], [25, -4]], up: [[-24, -2], [24, -2]] },
    beast: { side: [[-17, -30], [15, -30]], down: [[-19, -30], [19, -30]], up: [[-19, -26], [19, -26]] },
  };
  const DEFAULT_LOOK = { tunic: '#3b6fb6', hair: '#5a3a1e', shoulder: '#9aa3b2', fists: true, gear: {} };

  const st = { ride: null, last: null, nagAt: -1e9, riders: [], said: 0 };
  const online = () => !!(window.NET && NET.online && NET.online());
  const REMOTE = () => (window.PLAYERS && PLAYERS.remote) || {};
  const myMap = () => (window.PLAYERS && PLAYERS.mapId ? PLAYERS.mapId() : 'over');
  const me = () => (window.NET ? NET.me : null);
  const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
  // a mech off the wire or the knight's own: its machine kind when it has seats, else null (the mare, an unknown kind, none)
  const kindOf = mech => { if (!mech || typeof mech !== 'object') return null; const k = mech.kind; const kind = (k === undefined || k === null || k === 'walker') ? 'walker' : k; return SEATS[kind] ? kind : null; };
  const cleanRide = r => r && typeof r === 'object' && typeof r.d === 'string' && r.d && Number.isInteger(r.s) && r.s >= 1 && r.s <= 2 ? { d: r.d.slice(0, 40), s: r.s } : null;
  const unit = f => { const fx = f ? +f.x || 0 : 0, fy = f ? +f.y || 0 : 1, L = Math.hypot(fx, fy); return L < 1e-6 ? { x: 0, y: 1 } : { x: fx / L, y: fy / L }; };
  const viewOf = f => { const u = unit(f); return u.y < -0.55 ? 'up' : u.y > 0.55 ? 'down' : u.x < 0 ? 'left' : 'right'; };

  // ---------- the machines and their seats ----------
  // a machine driven on this map with seats: its driver's name, kind, middle, facing, and where it sorts in the draw list
  function machineOf(n) {
    if (!n) return null;
    if (same(n, me())) {
      if (player.dead) return null;
      const kind = kindOf(player.mech);
      return kind ? { n: me(), kind, x: player.x, y: player.y, facing: player.facing, sortY: player.y + player.r, mine: true } : null;
    }
    const e = REMOTE()[n];
    if (!e || e.map !== myMap() || e.dead || e.ride) return null;
    const kind = kindOf(e.mech); if (!kind) return null;
    return { n, kind, x: e.shown.x, y: e.shown.y, facing: e.facing, sortY: e.shown.y + 13, e };
  }
  // seat s of a machine of this kind facing f: px from its middle, and which way the rider faces
  function seatOffset(kind, f, s) {
    const v = viewOf(f), T = SEAT_AT[kind]; if (!T) return { x: 0, y: 0, face: { x: 0, y: 1 } };
    const list = v === 'up' ? T.up : v === 'down' ? T.down : T.side, p = list[Math.max(0, Math.min(list.length - 1, s - 1))];
    const flip = v === 'left' ? -1 : 1;
    return { x: p[0] * flip, y: p[1], face: v === 'up' ? { x: 0, y: -1 } : v === 'down' ? { x: 0, y: 1 } : { x: flip, y: 0 } };
  }
  function seatWorld(M, s) { const o = seatOffset(M.kind, M.facing, s); return { x: M.x + o.x, y: M.y + o.y, face: o.face }; }
  // who rides a machine (its driver's name) on this map: the friends the world says do, and this knight
  function ridersOf(n) {
    const out = [], my = myMap(), R = REMOTE();
    for (const k in R) { const e = R[k]; if (e.ride && same(e.ride.d, n) && e.map === my && !e.dead) out.push({ n: k, s: e.ride.s, e }); }
    if (st.ride && same(st.ride.d, n)) out.push({ n: me(), s: st.ride.s, me: true });
    return out.sort((a, b) => a.s - b.s);
  }
  function freeSeat(n, kind) {
    const taken = new Set(ridersOf(n).filter(r => !r.me).map(r => r.s));
    for (let s = 1; s <= SEATS[kind]; s++) if (!taken.has(s)) return s;
    return 0;
  }
  // the friend's machine this knight could hop on now (the nearest within reach), with its first free seat (0: full)
  let hopMemo = { t: -1, v: null };
  function hopTarget() {
    if (hopMemo.t === time) return hopMemo.v;
    let v = null;
    if (online() && !st.ride && !player.dead && !player.mech && !(typeof title !== 'undefined' && title.active)) {
      let best = null; const R = REMOTE();
      for (const k in R) {
        const M = machineOf(k); if (!M || M.mine) continue;
        const d = dist(player.x, player.y, M.x, M.y);
        if (d <= BODY_R[M.kind] + HOP_REACH && (!best || d < best.d)) best = { M, d };
      }
      if (best) v = { n: best.M.n, kind: best.M.kind, seat: freeSeat(best.M.n, best.M.kind), M: best.M };
    }
    hopMemo = { t: time, v };
    return v;
  }

  // ---------- hopping on and off ----------
  const fullText = (n, kind) => `${n}'s ${WHAT[kind] || 'machine'} is full.`;
  const offText = () => (touchMode() ? 'Tap HOP OFF to get down.' : 'Press E to hop off.');
  function hopOn() {
    const t = hopTarget(); if (!t) return false;
    if (!t.seat) { notify(fullText(t.n, t.kind)); sfx('ui'); return true; }
    if (typeof tapCancel === 'function') tapCancel('ride');
    player.action = null; player.moving = false;
    st.ride = { d: t.n, s: t.seat, kind: t.kind, map: myMap(), at: time };
    place();
    burst(player.x, player.y, '#9fc7ff', 10, 60); sfx('open');
    notify(`Riding with ${t.n}. ${offText()}`);
    return true;
  }
  // the words a rider reads as he is set down
  function downText(why, d, kind) {
    const what = WHAT[kind] || 'machine';
    switch (why) {
      case 'self': return 'You hop off.';
      case 'off': return `${d} got out of the ${what}. You hop down.`;
      case 'fell': return `${d} fell. You hop down.`;
      case 'inside': return `${d} went inside. You hop down.`;
      case 'left': return `${d} left. You hop down.`;
      case 'offline': return 'You are not connected, so you hop down.';
      case 'full': case 'taken': return fullText(d, kind);
      case 'gone': return `${d} is not here.`;
      case 'far': return `Walk up to ${d}'s ${what} first.`;
      default: return 'You hop down.';
    }
  }
  // set the rider down beside the machine (where it last was on this screen), on the seat's side first; never in a wall,
  // water or a doorway. quiet: say nothing (a fall, going home)
  function setDown(why, quiet) {
    const r = st.ride; if (!r) return false;
    st.ride = null;
    // his own game moved him to another place (a portal, a respawn): he is where it put him, and nothing more is done
    if (r.map !== myMap()) return true;
    const spot = landing(st.last, r.s);
    if (spot) { player.x = spot.x; player.y = spot.y; }
    player.moving = false;
    if (!quiet) { notify(downText(why, r.d, r.kind)); sfx('ui'); burst(player.x, player.y, '#9fc7ff', 8, 50); }
    return true;
  }
  const clearAt = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return inMap(tx, ty) && !collides(x, y, KNIGHT_R, 'beast') && !collides(x, y, KNIGHT_R, 'player'); };
  function landing(L, s) {
    if (!L) { const sp = safeSpot(player.x, player.y, KNIGHT_R, 'beast'); return sp && clearAt(sp.x, sp.y) ? sp : null; }
    const o = seatOffset(L.kind, L.facing, s);
    // the seat's side of the machine (left or right of it as drawn; a seat straight over the middle: its right)
    const a0 = o.x < -2 ? Math.PI : o.x > 2 ? 0 : Math.atan2(o.y, o.x || 1);
    const R = BODY_R[L.kind] + KNIGHT_R + 8;
    for (const rr of [R, R + 24, R + 48]) for (const da of [0, 1, -1, 2, -2, 3, -3, 4]) {
      const a = a0 + da * Math.PI / 4, x = L.x + Math.cos(a) * rr, y = L.y + Math.sin(a) * rr;
      if (clearAt(x, y)) return { x, y };
    }
    const sp = safeSpot(L.x, L.y, KNIGHT_R, 'beast');
    return sp && clearAt(sp.x, sp.y) ? sp : null;
  }
  // why the ride is over on this screen, or null
  function stopWhy() {
    if (!online()) return 'offline';
    const e = REMOTE()[st.ride.d];
    if (!e) return 'left';
    if (e.map !== myMap()) return 'inside';
    if (e.dead) return 'fell';
    const kind = kindOf(e.mech);
    if (!kind || e.ride || st.ride.s > SEATS[kind]) return 'off';
    return null;
  }
  // the rider sits in his seat: his own knight is where the seat is, facing the way the machine does
  function place() {
    const M = machineOf(st.ride.d); if (!M) return false;
    const p = seatWorld(M, st.ride.s);
    player.x = p.x; player.y = p.y; player.facing = { x: p.face.x, y: p.face.y }; player.moving = false; player.action = null;
    st.ride.kind = M.kind;
    st.last = { x: M.x, y: M.y, kind: M.kind, facing: unit(M.facing) };
    return true;
  }
  function nag() { if (time - st.nagAt < NAG_EVERY) return; st.nagAt = time; notify(`${st.ride.d} is driving. ${offText()}`); }
  function nagFight() { if (time - st.nagAt < NAG_EVERY) return; st.nagAt = time; notify('No swinging while you ride along. Hop off to fight.'); }

  // ---------- the wire ----------
  if (window.NET) {
    // what a friend's presence says about riding (73-players has made his entry already); the driver's speed, for our own
    NET.on('p', m => { if (!m || typeof m.n !== 'string') return; const e = REMOTE()[m.n]; if (!e) return; e.ride = cleanRide(m.ride); if (typeof m.spd === 'number') e.spd = m.spd; });
    // the world will not have this ride: another seat if only ours was taken, else down with the reason
    NET.on('ride_no', m => {
      if (!st.ride || !m || !same(m.d, st.ride.d)) return;
      if (m.code === 'taken') { const s = freeSeat(st.ride.d, st.ride.kind); if (s && s !== st.ride.s) { st.ride.s = s; place(); return; } }
      setDown(m.code === 'taken' ? 'full' : m.code);
    });
    NET.on('ride_end', m => { if (st.ride && m && same(m.d, st.ride.d)) setDown(m.why); });
    // our presence names the ride, and is judged at the machine's speed (the driver's own, from his presence)
    const _send = NET.send;
    NET.send = function (msg) {
      if (msg && msg.t === 'p' && st.ride) {
        msg.ride = { d: st.ride.d, s: st.ride.s }; msg.mv = false;
        const e = REMOTE()[st.ride.d]; if (e && typeof e.spd === 'number' && !(msg.spd >= e.spd)) msg.spd = Math.round(e.spd);
      }
      return _send.apply(this, arguments);
    };
  }

  // ---------- the controls: what a rider cannot do, and E ----------
  { const _use = useAction; useAction = function () { if (st.ride) { setDown('self'); return; } if (hopTarget() && !npcInFront()) { hopOn(); return; } return _use.apply(this, arguments); }; }
  { const _exit = exitMech; exitMech = function () { if (st.ride) { setDown('self'); return; } return _exit.apply(this, arguments); }; }
  { const _atk = playerAttack; playerAttack = function () { if (st.ride) { nagFight(); return; } return _atk.apply(this, arguments); }; }
  { const _place = placeAction; placeAction = function () { if (st.ride) { notify('Hop off first.'); return; } return _place.apply(this, arguments); }; }
  { const _home = goHome; goHome = function () { if (st.ride) setDown('self', true); return _home.apply(this, arguments); }; }
  // (43-settings reads the walking keys from inputVector's own words: the wrapper answers with the core's)
  { const _iv = inputVector; inputVector = function () { const v = _iv.apply(this, arguments); if (!st.ride) return v; if (v && v.m > 0) nag(); return { x: 0, y: 0, m: 0 }; }; inputVector.toString = () => String(_iv); }
  { const _tv = tapVector; tapVector = function () { if (st.ride) { if (tapActive()) tapCancel('ride'); return null; } return _tv.apply(this, arguments); }; }
  // nothing in front of a rider to use or talk to (the gold brackets and the verb tag stay off; E is Hop off)
  { const _ft = frontTile; frontTile = function (e) { if (st.ride && e === player) return { tx: -1, ty: -1 }; return _ft.apply(this, arguments); }; }
  { const _npc = npcInFront; npcInFront = function () { if (st.ride) return null; return _npc.apply(this, arguments); }; }

  // ---------- every frame: the rider in his seat, friends glued to theirs, the driver told who comes and goes ----------
  // a friend riding a machine on this map is shown in his seat on it (where this screen draws the machine), so 74-chat's
  // bubbles, 78-trade's taps and the draw below all find him there
  function glue() {
    const my = myMap(), R = REMOTE();
    for (const n in R) { const e = R[n]; if (!e.ride || e.map !== my || e.dead) continue; const M = machineOf(e.ride.d); if (!M) continue; const p = seatWorld(M, e.ride.s); e.shown.x = p.x; e.shown.y = p.y; }
  }
  HOOKS.update.push(() => {
    if (st.ride) {
      if (player.dead) st.ride = null;
      else { const why = stopWhy(); if (why) setDown(why); else place(); }
    }
    glue();
    // the driver: who hopped on and off (only while he still drives: getting out sets everyone down, and that says itself)
    const kind = online() ? kindOf(player.mech) : null;
    const now = kind && !player.dead ? ridersOf(me()).map(r => r.n) : [];
    if (kind) { for (const n of now) if (!st.riders.includes(n)) notify(`${n} hopped on.`); for (const n of st.riders) if (!now.includes(n)) notify(`${n} hopped off.`); }
    st.riders = now;
  });
  // the teacher's Watch (79-view) steps only PLAYERS: the riders stay in their seats there too
  if (window.PLAYERS && typeof PLAYERS.step === 'function') { const _step = PLAYERS.step; PLAYERS.step = function () { const r = _step.apply(this, arguments); glue(); return r; }; }
  HOOKS.newGame.push(() => { st.ride = null; st.last = null; st.riders = []; });

  // ---------- the seats on the HUD ----------
  hudSeatFace('use', {
    id: 'hopon', prio: 60, when: () => !!hopTarget() && !npcInFront(), emblem: 'friends', ribbon: 'HOP ON', key: 'E',
    name: () => { const t = hopTarget(); return t ? (t.seat ? `Hop on ${t.n}'s ${WHAT[t.kind]}` : fullText(t.n, t.kind)) : 'Hop on'; },
    lit: () => { const t = hopTarget(); return !!(t && t.seat); }, disabled: () => { const t = hopTarget(); return !!t && !t.seat; },
    action: () => touch.taps.push('use'),
  });
  hudSeatFace('use', { id: 'hopoff', prio: 60, when: () => !!st.ride, emblem: 'getdown', ribbon: 'HOP OFF', key: 'E', name: 'Hop off', lit: true, action: () => touch.taps.push('use') });
  hudSeatFace('swing', { id: 'riding', prio: 20, when: () => !!st.ride, emblem: 'swing', ribbon: 'SWING', key: 'Space', name: 'No swinging while you ride along', disabled: true, action: () => nagFight() });
  // the USE preview (the verb tag 09-render puts by a tile, 24's TALK): none while a friend's machine is the thing to use
  if (typeof HK !== 'undefined' && typeof HK.usePreview === 'function') {
    const _pv = HK.usePreview;
    HK.usePreview = function () { if (st.ride || hopTarget()) return null; return _pv.apply(this, arguments); };
  }
  HOOKS.hud.push(g => {
    if (paused || !online()) return;
    if (st.ride) { HK.addPlaque(g, { id: 'ride', emblem: 'friends', name: 'Riding with ' + st.ride.d, sub: touchMode() ? 'Tap HOP OFF to get down' : 'Press E to hop off' }); return; }
    const kind = kindOf(player.mech);
    if (kind && !player.dead) {
      const rs = ridersOf(me());
      if (rs.length) HK.addPlaque(g, { id: 'ride', emblem: 'friends', name: 'Riding with you', right: rs.length + ' / ' + SEATS[kind], sub: rs.map(r => r.n).join(' and ') });
    }
    // "E: Hop on" beside a friend's machine (on touch, the seat's emblem: the USE seat reads HOP ON)
    const t = hopTarget();
    if (!t || panel || (dialog && dialog.cur) || npcInFront()) return;
    const sx = Math.round(t.M.x + BODY_R[t.kind] + 10 - cam.x), sy = Math.round(t.M.y - 8 - cam.y), tm = touchMode();
    if (!t.seat) { HK.tag(g, sx, sy, fullText(t.n, t.kind).slice(0, -1), { side: 'right' }); return; }
    const coached = HK.teach('hopon', tm ? null : 'E', `Hop on with ${t.n}`, { sx, sy }, { emblem: 'friends' });
    if (!coached) HK.tag(g, sx, sy, 'Hop on', { side: 'right', key: tm ? null : 'E', emblem: tm ? 'friends' : null });
  });
  HOOKS.keyHelp.push({ action: 'Hop on or off a friend\'s machine', codes: ['KeyE'] });

  // ---------- drawing: riders in their seats ----------
  // A rider is drawn seated (82-knightgear: no legs) at his seat, the size the driver is drawn, just after the machine in the
  // draw list so he sits on it; a friend's name and level go over his head as 73-players writes them.
  function drawSeated(g, x, y, face, look, hurtT) {
    g.save(); g.translate(x, y); g.scale(SEAT_K, SEAT_K);
    try { drawHuman(g, { facing: face, hurtT: hurtT || 0, attackT: 0, moving: false, walkT: 0, seated: true }, look); } finally { g.restore(); }
  }
  // align: 'center', or 'right' (the tag ends at x) and 'left' (it starts at x), so two riders' names sit side by side
  function drawTag(g, e, x, top, align) {
    const ts = window.PLAYERS && PLAYERS.tagScale > 1 ? PLAYERS.tagScale : 1, px = n => (ts === 1 ? n : (n * ts).toFixed(1)) + 'px';
    const admin = e.role === 'admin', lv = 'lv ' + e.lv;
    g.font = 'bold ' + px(8) + ' sans-serif'; const pw = admin ? Math.ceil(g.measureText('ADMIN').width) + 12 * ts : 0;
    g.font = 'bold ' + px(11) + ' sans-serif'; const nw = g.measureText(e.n).width;
    g.font = px(9) + ' sans-serif'; const lw = g.measureText(lv).width;
    const w = pw + nw + 4 * ts + lw, x0 = Math.round(align === 'right' ? x - w : align === 'left' ? x : x - w / 2), nx = x0 + pw;
    if (admin && window.PLAYERS && PLAYERS.adminPill) PLAYERS.adminPill(g, x0, top - 4 * ts, 8 * ts);
    g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.font = 'bold ' + px(11) + ' sans-serif'; g.strokeText(e.n, nx, top); g.fillStyle = admin ? (PLAYERS.GOLD || '#f5c542') : '#ffffff'; g.fillText(e.n, nx, top);
    g.font = px(9) + ' sans-serif'; g.strokeText(lv, nx + nw + 4 * ts, top); g.fillStyle = '#9aa3b2'; g.fillText(lv, nx + nw + 4 * ts, top);
    return { x: x0, w };
  }
  const STATS = { drawn: 0, tags: 0, lastTags: {} };
  HOOKS.draw.push((g, items) => {
    const my = myMap(), R = REMOTE(), byMachine = new Map();
    for (const n in R) {
      const e = R[n]; if (!e.ride || e.map !== my || e.dead) continue;
      const M = machineOf(e.ride.d); if (!M) continue;
      const key = M.n.toLowerCase(); if (!byMachine.has(key)) byMachine.set(key, { M, list: [] });
      byMachine.get(key).list.push({ n, e, p: seatWorld(M, e.ride.s) });
    }
    for (const { M, list } of byMachine.values()) {
      // two friends on one machine: the left one's name ends over the middle between them, the right one's starts there
      const mid = list.length === 2 ? (list[0].p.x + list[1].p.x) / 2 : null;
      for (const r of list) {
        const { n, e, p } = r, y = M.sortY + 0.2 + e.ride.s * 0.01;
        const align = mid === null || Math.abs(list[0].p.x - list[1].p.x) < 1 ? 'center' : p.x < mid ? 'right' : 'left';
        const tx = align === 'center' ? p.x : align === 'right' ? mid - 3 : mid + 3;
        const draw = () => {
          drawSeated(g, p.x, p.y, p.face, e.look || DEFAULT_LOOK, e.hurtT); STATS.drawn++;
          const top = Math.round(p.y) - 34; e.tagTop = top; const t = drawTag(g, e, tx, top, align); STATS.tags++; STATS.lastTags[n] = { x: t.x, w: t.w, top };
        };
        const it = items.find(i => i.who === n);
        if (it) { it.y = y; it.draw = draw; } else items.push({ y, who: n, draw });
      }
    }
    if (st.ride && !player.dead) {
      const M = machineOf(st.ride.d); if (!M) return;
      const p = seatWorld(M, st.ride.s), y = M.sortY + 0.2 + st.ride.s * 0.01;
      const draw = () => { drawSeated(g, p.x, p.y, p.face, playerLook(), player.hurtT); STATS.drawn++; };
      const it = items.find(i => i.who === undefined && i.y === player.y + player.r);
      if (it) { it.y = y; it.draw = draw; } else items.push({ y, draw });
    }
  });

  // ---------- self-test (a fake wire, as 73-players' own: one game, its friends fed in as presences) ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'ride together: ';
    // RT1. every seat of every machine at every facing sits on the machine as drawn (inside its own box, over its middle
    // row), the two seats of one machine apart, and a rider faces the way it does
    { const bad = [];
      for (const kind in SEATS) for (const f of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
        const ps = []; for (let s = 1; s <= SEATS[kind]; s++) ps.push(seatOffset(kind, f, s));
        for (const p of ps) if (!(Math.abs(p.x) <= 30 && p.y < 0 && p.y >= -32) || Math.abs(p.face.x - Math.round(unit(f).x)) > 0.01 && viewOf(f) !== 'up' && viewOf(f) !== 'down') bad.push({ kind, f, p });
        if (ps.length === 2 && Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) < 24) bad.push({ kind, f, close: ps });
      }
      check(P + 'RT1 the walker has 1 seat, the bulldozer and the Barrelbeast 2, the mare none; every seat sits on its machine as drawn at all four facings, two seats apart', !bad.length && SEATS.walker === 1 && SEATS.dozer === 2 && SEATS.beast === 2 && !SEATS.horse && kindOf({ kind: 'horse' }) === null && kindOf({ hp: 1 }) === 'walker', { bad: bad.slice(0, 4) }); }

    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake };
    const keep = { x: player.x, y: player.y, mech: player.mech, r: player.r, speed: player.speed, facing: player.facing, dead: player.dead, inv: JSON.stringify(player.inv), quest: JSON.stringify(quest) };
    const dc = dialog.cur, dq = dialog.queue.slice(); dialog.cur = null; dialog.queue.length = 0;
    const made = [];
    const fake = { call: async () => ({}), open: () => { const s = { readyState: 1, sent: [], send(str) { const m = JSON.parse(str); s.sent.push(m); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen' }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; made.push(s); return s; } };
    try {
      // RT2. offline: no friend's machine is ever offered, and E, X, Space and walking are the game's own
      { closePanel(); h.peace(true); player.mech = null; player.r = KNIGHT_R; player.dead = false;
        const o = h.openSpot(ATLAS.world.tx(40), ATLAS.world.ty(24)); F.tp(o.x, o.y); F.step([]);
        NET.emit('p', { t: 'p', n: 'Mudtech', map: 'over', x: player.x + 48, y: player.y, fx: 1, fy: 0, mech: { kind: 'dozer', hp: 110, maxHp: 110 }, dead: false, lv: 5 });
        const tgt = hopTarget(), x0 = player.x; F.sim(10, ['KeyD']); const walked = player.x > x0 + 20;
        delete REMOTE().Mudtech;
        check(P + 'RT2 offline nothing is offered and the knight walks as ever (single-player play is unchanged)', tgt === null && st.ride === null && walked, { tgt, walked }); }

      NET.disconnect(); NET.enabled = true; NET.token = 'ride-test'; NET.useFake(fake); NET.connect();
      const sock = made[0], feed = m => sock.onmessage({ data: JSON.stringify(m) });
      const ps = () => sock.sent.filter(m => m.t === 'p'), lastP = () => { const l = ps(); return l[l.length - 1]; };
      const o = h.openSpot(ATLAS.world.tx(40), ATLAS.world.ty(24)); F.tp(o.x, o.y); F.step([]);
      const mud = (extra) => feed(Object.assign({ t: 'p', n: 'Mudtech', role: 'player', map: 'over', x: Math.round(o.x * TILE + TILE / 2 + 48), y: Math.round(o.y * TILE + TILE / 2), fx: 1, fy: 0, mv: false, wt: 0, hp: 20, mhp: 20, lv: 9, look: null, mech: { kind: 'dozer', hp: 110, maxHp: 110 }, dead: false, spd: 205 }, extra || {}));
      const settle = () => { const e = REMOTE().Mudtech; if (e) { e.shown.x = e.x; e.shown.y = e.y; } };
      // RT3. by a friend's bulldozer: HOP ON; E seats the knight in seat 1, his presence says so (at the machine's speed),
      // he is drawn seated just after the machine, and he cannot walk or swing
      { mud(); F.step([]); settle(); notice = null;
        const t = hopTarget(), face = hudSeatFace.list.filter(f => f.seat === 'use' && f.when()).sort((a, b) => b.prio - a.prio)[0];
        F.press('KeyE'); F.sim(12, []); settle(); F.step([]);
        const p = lastP(), seat = seatWorld(machineOf('Mudtech'), 1);
        const items = [{ y: player.y + player.r, draw: () => { } }]; items.push({ y: REMOTE().Mudtech.shown.y + 13, who: 'Mudtech', draw: () => { } });
        for (const hk of HOOKS.draw) { try { hk(ctx, items, cam); } catch (e) { } }
        const mine = items.find(i => i.who === undefined && i.y > REMOTE().Mudtech.shown.y + 13 && i.y < REMOTE().Mudtech.shown.y + 14), d0 = STATS.drawn; if (mine) mine.draw(); const drew = STATS.drawn - d0;
        const sx = player.x; F.sim(20, ['KeyA']); const stayed = Math.abs(player.x - sx) < 0.01;
        player.attackCd = 0; F.press('Space'); const noSwing = !(player.attackT > 0);
        check(P + 'RT3 by a friend\'s bulldozer the USE seat reads HOP ON; E seats the knight in seat 1 (his presence carries ride and the machine\'s speed), he is drawn seated on it, and he cannot walk or swing',
          !!t && t.seat === 1 && !!face && face.id === 'hopon' && !!st.ride && st.ride.s === 1 && !!p && p.ride && p.ride.d === 'Mudtech' && p.ride.s === 1 && p.spd >= 205 && Math.hypot(player.x - seat.x, player.y - seat.y) < 0.01 && !!mine && drew === 1 && stayed && noSwing,
          { t: t && { n: t.n, seat: t.seat }, face: face && face.id, ride: p && p.ride, spd: p && p.spd, off: Math.round(Math.hypot(player.x - seat.x, player.y - seat.y) * 100) / 100, drew, mine: !!mine, stayed, noSwing }); }
      // RT4. the world will not have it ('full'): he is set down, told so, on free ground beside the machine
      { feed({ t: 'ride_no', d: 'Mudtech', code: 'full' }); F.step([]);
        const ok = st.ride === null && !!notice && notice.text === "Mudtech's bulldozer is full." && clearAt(player.x, player.y);
        check(P + 'RT4 a ride the world refuses (full) sets the knight down on free ground with "Mudtech\'s bulldozer is full."', ok, { ride: st.ride, notice: notice && notice.text }); }
      // RT5. he hops on again; the driver climbs out: he is set down beside the machine, never in water or a wall (his seat's
      // side is water and the other side a wall here), and told why
      { F.tp(o.x, o.y); mud(); F.step([]); settle(); F.press('KeyE'); F.sim(4, []); settle(); F.step([]);
        const on = !!st.ride, M = machineOf('Mudtech'), tx = Math.floor(M.x / TILE), ty = Math.floor(M.y / TILE), changed = [];
        const set = (x, y, t) => { changed.push([x, y, tileAt(x, y)]); setTile(x, y, t); };
        // seat 1 of a bulldozer facing right is on its right: water there, a wall on its left
        for (let y = ty - 1; y <= ty + 1; y++) { set(tx + 1, y, T.WATER); set(tx + 2, y, T.WATER); set(tx - 1, y, T.WALL); }
        mud({ mech: null }); F.step([]);
        const down = st.ride === null && clearAt(player.x, player.y) && tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE)) !== T.WATER && !!notice && notice.text === 'Mudtech got out of the bulldozer. You hop down.';
        const near = Math.hypot(player.x - M.x, player.y - M.y) < BODY_R.dozer + KNIGHT_R + 60;
        for (const [x, y, t] of changed.reverse()) setTile(x, y, t);
        check(P + 'RT5 the driver climbs out: the rider is set down beside the machine on dry, open ground (his seat\'s side water, the other side wall) and reads "Mudtech got out of the bulldozer. You hop down."', on && down && near, { on, down, near, notice: notice && notice.text }); }
      // RT6. the driver's side: a friend riding seat 2 of our bulldozer is drawn there, and the driver reads "Ann hopped on." 
      { delete REMOTE().Mudtech; F.tp(o.x, o.y); player.mech = { kind: 'dozer', hp: 110, maxHp: 110 }; player.r = 22; player.facing = { x: 1, y: 0 }; notice = null; F.step([]);
        feed({ t: 'p', n: 'Ann', role: 'player', map: 'over', x: Math.round(player.x), y: Math.round(player.y - 6), fx: 1, fy: 0, mv: false, wt: 0, hp: 20, mhp: 20, lv: 4, look: null, mech: null, dead: false, ride: { d: 'Cohen', s: 2 } });
        F.step([]);
        const rs = ridersOf('Cohen'), said = notice && notice.text, ann = REMOTE().Ann, seat2 = seatWorld(machineOf('Cohen'), 2);
        const glued = !!ann && Math.hypot(ann.shown.x - seat2.x, ann.shown.y - seat2.y) < 0.01;
        player.mech = null; player.r = KNIGHT_R; F.step([]);
        check(P + 'RT6 a friend riding our bulldozer is in seat 2 where it is drawn, the driver reads "Ann hopped on." and the plaque lists him', rs.length === 1 && rs[0].n === 'Ann' && rs[0].s === 2 && said === 'Ann hopped on.' && glued, { rs: rs.map(r => r.n + ':' + r.s), said, glued }); }
    } finally {
      st.ride = null; st.last = null; st.riders = [];
      for (const n of ['Mudtech', 'Ann']) delete REMOTE()[n];
      NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
      Object.assign(player, { x: keep.x, y: keep.y, mech: keep.mech, r: keep.r, speed: keep.speed, facing: keep.facing, dead: keep.dead });
      player.inv = JSON.parse(keep.inv);
      dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq); notice = null; closePanel(); h.peace(false); render();
    }
  });

  const api = { SEATS, WHAT, SEAT_AT, BODY_R, HOP_REACH, STATS, state: st, kindOf, machineOf, seatOffset, seatWorld, ridersOf, freeSeat, hopTarget, hopOn, setDown, landing, downText };
  window.RIDE = api;
  return api;
})();
