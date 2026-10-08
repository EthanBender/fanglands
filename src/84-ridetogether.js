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
// or water). A rider whose own line drops (or goes quiet) just goes from the seat.
// Set down only on open ground in HIS OWN world: each kid's world keeps its own tiles (a bulldozer's lane through a forest
// is cleared only in the driver's), so a spot must be clear and open onto at least OPEN_REACH tiles he can walk, and when
// no spot beside the machine is, he is set down on the newest such spot the seat passed (the trail), or where he hopped on.
// E is Hop on only when the knight faces the machine or his own E has nothing in front of him (a station, a chest, his own
// parked machine, a person, water, a tree: those keep their E). A driver whose presence jumps or goes faster than any
// machine (a cheat) sets his riders down at once, where the seat last was on open ground, on the rider's screen and by the
// world's word; his riders are never carried.
// Nothing of one kid's game is changed by another's: the rider's game moves his own knight (where it is saved is where his
// knight is), no item, coin or quest is touched, and the machine stays the driver's.
// The wire: presence carries ride: { d, s } (the driver's name, the seat from 1); the world checks every one and answers a
// ride it will not have with ride_no, and a driver who stops driving with ride_end (online/src/ride.js; docs/ONLINE.md,
// "Riding together"). A page that does not know seats shows the rider standing where his presence says he is.
// Feature file: wraps useAction, exitMech, wreckMech, playerAttack, placeAction, goHome, inputVector, tapVector, frontTile,
// npcInFront and NET.send by reassignment (each passes straight through unless this knight is riding along); its own draw and hud
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
  // getting down safely, in the rider's own world
  const OPEN_REACH = 32;     // tiles: a set-down spot must open onto at least this many tiles a knight on foot can walk to
  const TRAIL_MAX = 16;      // seat spots on open ground kept while riding (the oldest, where he hopped on, always kept)
  // a quiet line: a rider who has heard nothing at all from the world this long is not connected (he pings while quiet)
  const QUIET_MS = 3000, PING_MS = 1000;
  // a driver's path the rider's game will believe (online/src/ride.js keeps the same numbers): never a jump (j), never
  // faster than the fastest machine (Full Steam, 55-riding) with a quarter to spare, over any stretch of 0.4 s to 3 s
  const DRIVE_TOP = 430, DRIVE_K = 1.25, DRIVE_LONG = 0.4, DRIVE_SLACK = 200, JUMP_SLACK = 480, DRIVE_WINDOW = 3000, BUNCH_MS = 30;
  const WRECK_SAY = 2;       // s: a driver's presences say his machine broke (wk) for this long after a wreck
  const SAY_AFTER = 0.15;    // s: a friend has sat this long before the driver hears "Ben hopped on."

  const st = { ride: null, last: null, nagAt: -1e9, riders: [], seen: {}, said: 0, trail: [], track: [], heardAt: 0, pingAt: 0, wreckAt: null };
  // the clock the line is judged by: real ms (a hidden tab still hears its socket); a test may set RIDE.clock
  const clock = () => api.clock();
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

  // what the knight's own E would do right now, and how far in front of him it is (a person, a tile his E uses, anything
  // that is not open ground, his hoe on grass), or null: his own E then has nothing to do
  let inOwn = false;
  function ownUse() {
    const npc = npcInFront(); if (npc) return { d: dist(player.x, player.y, npc.px, npc.py) };
    const ft = frontTile(player), t = tileAt(ft.tx, ft.ty), d = dist(player.x, player.y, tc(ft.tx), tc(ft.ty));
    let pv = null; inOwn = true; try { pv = typeof HK !== 'undefined' && typeof HK.usePreview === 'function' ? HK.usePreview() : null; } finally { inOwn = false; }
    if (pv) return { d: pv.at && pv.at.npc ? dist(player.x, player.y, pv.at.x, pv.at.y) : d };
    if (!PLACEABLE_ON.has(t) || t === T.SOIL) return { d };
    if ((t === T.GRASS || t === T.DIRT) && typeof hasTool === 'function' && hasTool('hoe')) return { d };
    return null;
  }
  // does he face the machine: its body is on the line he looks along, in front of him (or he is half under it)
  function faces(M) {
    const f = unit(player.facing), vx = M.x - player.x, vy = M.y - player.y, along = vx * f.x + vy * f.y, across = Math.abs(vx * f.y - vy * f.x);
    if (Math.hypot(vx, vy) <= BODY_R[M.kind]) return { d: 0 };
    return along > 0 && across <= BODY_R[M.kind] + 12 ? { d: Math.max(0, along - BODY_R[M.kind]) } : null;
  }
  // the friend's machine E would hop him on now, or null: one in reach that he faces, or any in reach when his own E has
  // nothing in front of him. The HOP ON seat, the "E: Hop on" tag and E itself all ask this.
  let offerMemo = { t: -1, v: null };
  function offer() {
    if (offerMemo.t === time) return offerMemo.v;
    let v = null; const t = hopTarget();
    if (t) { const own = ownUse(), f = faces(t.M); v = !own || (f && f.d <= own.d + 4) ? t : null; }
    offerMemo = { t: time, v };
    return v;
  }

  // ---------- hopping on and off ----------
  const fullText = (n, kind) => `${n}'s ${WHAT[kind] || 'machine'} is full.`;
  const offText = () => (touchMode() ? 'Tap HOP OFF to get down.' : 'Press E to hop off.');
  function hopOn() {
    const t = offer(); if (!t) return false;
    if (!t.seat) { notify(fullText(t.n, t.kind)); sfx('ui'); return true; }
    if (typeof tapCancel === 'function') tapCancel('ride');
    player.action = null; player.moving = false;
    // where he stood on foot is the trail's first spot (the last resort for getting down); the driver's path starts here
    const now = clock(), e = REMOTE()[t.n];
    st.trail = [{ x: player.x, y: player.y, t: now, base: true }];
    st.track = e ? [{ t: now, x: e.x, y: e.y, j: Number.isFinite(e.j) ? e.j : null }] : [];
    st.heardAt = now; st.pingAt = now;
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
      case 'wreck': return `${d}'s ${what} broke. You hop down.`;
      case 'jump': return `${d}'s ${what} went too fast for you. You hop down.`;
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
  // since: the driver's path is not believed after this time (a jump): only the trail from before it is used
  function setDown(why, quiet, since) {
    const r = st.ride; if (!r) return false;
    st.ride = null;
    // his own game moved him to another place (a portal, a respawn): he is where it put him, and nothing more is done
    if (r.map !== myMap()) { st.trail = []; st.track = []; return true; }
    const spot = landing(st.last, r.s, why === 'jump' ? since : null);
    st.trail = []; st.track = [];
    if (spot) { player.x = spot.x; player.y = spot.y; }
    player.moving = false;
    if (!quiet) { notify(downText(why, r.d, r.kind)); sfx('ui'); burst(player.x, player.y, '#9fc7ff', 8, 50); }
    return true;
  }
  const clearAt = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return inMap(tx, ty) && !collides(x, y, KNIGHT_R, 'beast') && !collides(x, y, KNIGHT_R, 'player'); };
  // how many tiles a knight on foot could walk to from (x, y) in this game's own world (straight steps over tiles that are not
  // solid for him), counted up to `cap`: a one-tile gap among trees is 1, open ground is cap
  function openFrom(x, y, cap) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!inMap(tx, ty) || solidFor(map[idx(tx, ty)], 'player')) return 0;
    const seen = new Set([idx(tx, ty)]), todo = [[tx, ty]];
    while (todo.length && seen.size < cap) {
      const [cx, cy] = todo.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy; if (!inMap(nx, ny)) continue;
        const i = idx(nx, ny); if (seen.has(i) || solidFor(map[i], 'player')) continue;
        seen.add(i); todo.push([nx, ny]); if (seen.size >= cap) break;
      }
    }
    return seen.size;
  }
  // a spot a rider may be set down on: clear for his body, and open onto the rest of his own world
  const freeAt = (x, y) => clearAt(x, y) && openFrom(x, y, OPEN_REACH) >= OPEN_REACH;
  // where to set him down: beside the machine (L: where it last was on this screen), on the seat's side first; else the
  // newest spot on the trail (from before `since`, when the driver's path is not believed) that is still open ground; else
  // where he hopped on (he stood there on foot). Never a spot that only passes the body test (a pocket among his trees).
  function landing(L, s, since) {
    if (L && since == null) {
      const o = seatOffset(L.kind, L.facing, s);
      // the seat's side of the machine (left or right of it as drawn; a seat straight over the middle: its right)
      const a0 = o.x < -2 ? Math.PI : o.x > 2 ? 0 : Math.atan2(o.y, o.x || 1);
      const R = BODY_R[L.kind] + KNIGHT_R + 8;
      for (const rr of [R, R + 24, R + 48]) for (const da of [0, 1, -1, 2, -2, 3, -3, 4]) {
        const a = a0 + da * Math.PI / 4, x = L.x + Math.cos(a) * rr, y = L.y + Math.sin(a) * rr;
        if (freeAt(x, y)) return { x, y };
      }
    }
    for (let i = st.trail.length - 1; i >= 0; i--) { const p = st.trail[i]; if (since != null && p.t > since) continue; if (freeAt(p.x, p.y)) return { x: p.x, y: p.y }; }
    const b = st.trail[0];
    if (b && b.base) { if (clearAt(b.x, b.y)) return { x: b.x, y: b.y }; const sp = safeSpot(b.x, b.y, KNIGHT_R, 'player'); if (sp && freeAt(sp.x, sp.y)) return sp; return { x: b.x, y: b.y }; }
    if (L) { const sp = safeSpot(L.x, L.y, KNIGHT_R, 'beast'); if (sp && freeAt(sp.x, sp.y)) return sp; }
    return null;
  }
  // while he rides: the seat's spot goes on the trail each time it reaches a new tile that is open ground in his own world
  function trailStep() {
    const x = player.x, y = player.y, i = idx(Math.floor(x / TILE), Math.floor(y / TILE)), last = st.trail[st.trail.length - 1];
    if (last && idx(Math.floor(last.x / TILE), Math.floor(last.y / TILE)) === i) return;
    if (!freeAt(x, y)) return;
    st.trail.push({ x, y, t: clock() });
    if (st.trail.length > TRAIL_MAX) st.trail.splice(st.trail[0].base ? 1 : 0, 1);
  }
  // the driver's path as his presences arrive: the sample it fails against (a jump, or faster than any machine), or null.
  // Samples that arrive bunched (a stalled line letting go) keep only the newest, so a late one never stands as a baseline.
  function dragged(tr, t, x, y, j) {
    const last = tr[tr.length - 1];
    if (last && j !== null && last.j !== null && j !== last.j) return last;
    for (const p of tr) {
      const dt = Math.max(0, t - p.t) / 1000;
      if (Math.hypot(x - p.x, y - p.y) > DRIVE_TOP * DRIVE_K * dt + (dt < DRIVE_LONG ? JUMP_SLACK : DRIVE_SLACK)) return p;
    }
    if (last && t - last.t < BUNCH_MS) tr.pop();
    tr.push({ t, x, y, j }); while (tr.length > 1 && t - tr[0].t > DRIVE_WINDOW) tr.shift();
    return null;
  }
  // why the ride is over on this screen, or null
  function stopWhy() {
    // his own line: closed, or nothing at all heard from the world for QUIET_MS (he pings while it is quiet)
    if (!online() || clock() - st.heardAt > QUIET_MS) return 'offline';
    const e = REMOTE()[st.ride.d];
    if (!e) return 'left';
    if (e.map !== myMap()) return 'inside';
    if (e.dead) return 'fell';
    const kind = kindOf(e.mech);
    if (!kind && e.wk) return 'wreck';
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
    NET.on('p', m => {
      if (!m || typeof m.n !== 'string') return; const e = REMOTE()[m.n]; if (!e) return;
      e.ride = cleanRide(m.ride); if (typeof m.spd === 'number') e.spd = m.spd; e.j = Number.isFinite(m.j) ? m.j : null; e.wk = m.wk === 1;
      // the driver we ride with: a jump, or faster than any machine, sets us down at once (never carried to the new place)
      // (only while he still drives a machine with our seat: getting out or a wreck moves him a tile, and says itself)
      const kind = kindOf(e.mech);
      if (st.ride && same(m.n, st.ride.d) && e.map === myMap() && !e.dead && kind && st.ride.s <= SEATS[kind] && Number.isFinite(m.x) && Number.isFinite(m.y)) {
        const bad = dragged(st.track, clock(), m.x, m.y, e.j);
        if (bad) setDown('jump', false, bad.t);
      }
    });
    // anything at all from the world: the line is alive
    NET.on('*', () => { st.heardAt = clock(); });
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
      // a driver whose machine just broke says so for a moment (wk), so his riders read the right words
      if (msg && msg.t === 'p' && !st.ride && st.wreckAt !== null && time - st.wreckAt >= 0 && time - st.wreckAt < WRECK_SAY) msg.wk = 1;
      return _send.apply(this, arguments);
    };
  }
  { const _wreck = wreckMech; wreckMech = function () { const had = kindOf(player.mech); const r = _wreck.apply(this, arguments); if (had && !player.mech) st.wreckAt = time; return r; }; }

  // ---------- the controls: what a rider cannot do, and E ----------
  { const _use = useAction; useAction = function () { if (st.ride) { setDown('self'); return; } if (offer()) { hopOn(); return; } return _use.apply(this, arguments); }; }
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
  // first of every update hook, so the presence 73-players sends this frame already has him in his seat (after a pause or a
  // sleeping tab the machine may have gone on: the world must never read his old place against the driver's new one)
  HOOKS.update.unshift(() => {
    if (!st.ride) return;
    if (player.dead) { st.ride = null; st.trail = []; st.track = []; }
    else {
      // a quiet line: one ping a second (the world answers pong, without waking) tells a quiet world from a dead line
      const now = clock(); if (now - st.heardAt > PING_MS && now - st.pingAt > PING_MS && online()) { st.pingAt = now; NET.send({ t: 'ping' }); }
      const why = stopWhy(); if (why) setDown(why); else place();
    }
  });
  HOOKS.update.push(() => {
    if (st.ride && !player.dead) { place(); trailStep(); }   // and again after 73-players has slid the machine this frame: the seat as drawn
    glue();
    // the driver: who hopped on and off (only while he still drives: getting out sets everyone down, and that says itself).
    // A friend is said to have hopped on once he has sat SAY_AFTER s (a late presence from a line that was down names its old
    // seat for a moment: no "hopped on" and "hopped off" in one breath)
    const kind = online() ? kindOf(player.mech) : null;
    const now = kind && !player.dead ? ridersOf(me()).map(r => r.n) : [];
    if (!kind) { st.riders = []; st.seen = {}; }
    else {
      for (const n of Object.keys(st.seen)) if (!now.includes(n)) delete st.seen[n];
      for (const n of st.riders.slice()) if (!now.includes(n)) { notify(`${n} hopped off.`); st.riders.splice(st.riders.indexOf(n), 1); }
      for (const n of now) if (!st.riders.includes(n)) { if (st.seen[n] === undefined) st.seen[n] = time; if (time - st.seen[n] >= SAY_AFTER) { delete st.seen[n]; st.riders.push(n); notify(`${n} hopped on.`); } }
    }
  });
  // the teacher's Watch (79-view) steps only PLAYERS: the riders stay in their seats there too
  if (window.PLAYERS && typeof PLAYERS.step === 'function') { const _step = PLAYERS.step; PLAYERS.step = function () { const r = _step.apply(this, arguments); glue(); return r; }; }
  HOOKS.newGame.push(() => { st.ride = null; st.last = null; st.riders = []; st.seen = {}; st.trail = []; st.track = []; st.wreckAt = null; });

  // ---------- the seats on the HUD ----------
  hudSeatFace('use', {
    id: 'hopon', prio: 60, when: () => !!offer(), emblem: 'friends', ribbon: 'HOP ON', key: 'E',
    name: () => { const t = offer(); return t ? (t.seat ? `Hop on ${t.n}'s ${WHAT[t.kind]}` : fullText(t.n, t.kind)) : 'Hop on'; },
    lit: () => { const t = offer(); return !!(t && t.seat); }, disabled: () => { const t = offer(); return !!t && !t.seat; },
    action: () => touch.taps.push('use'),
  });
  hudSeatFace('use', { id: 'hopoff', prio: 60, when: () => !!st.ride, emblem: 'getdown', ribbon: 'HOP OFF', key: 'E', name: 'Hop off', lit: true, action: () => touch.taps.push('use') });
  hudSeatFace('swing', { id: 'riding', prio: 20, when: () => !!st.ride, emblem: 'swing', ribbon: 'SWING', key: 'Space', name: 'No swinging while you ride along', disabled: true, action: () => nagFight() });
  // the USE preview (the verb tag 09-render puts by a tile, 24's TALK): none while a friend's machine is the thing to use
  if (typeof HK !== 'undefined' && typeof HK.usePreview === 'function') {
    const _pv = HK.usePreview;
    HK.usePreview = function () { if (!inOwn && (st.ride || offer())) return null; return _pv.apply(this, arguments); };
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
    const t = offer();
    if (!t || panel || (dialog && dialog.cur)) return;
    const sx = Math.round(t.M.x + BODY_R[t.kind] + 10 - cam.x), sy = Math.round(t.M.y - 8 - cam.y), tm = touchMode();
    if (!t.seat) { HK.tag(g, sx, sy, fullText(t.n, t.kind).slice(0, -1), { side: 'right' }); return; }
    const coached = HK.teach('hopon', tm ? null : 'E', `Hop on with ${t.n}`, { sx, sy }, { emblem: 'friends' });
    if (!coached) HK.tag(g, sx, sy, 'Hop on', { side: 'right', key: tm ? null : 'E', emblem: tm ? 'friends' : null });
  });

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
        F.sim(12, []);
        const rs = ridersOf('Cohen'), said = notice && notice.text, ann = REMOTE().Ann, seat2 = seatWorld(machineOf('Cohen'), 2);
        const glued = !!ann && Math.hypot(ann.shown.x - seat2.x, ann.shown.y - seat2.y) < 0.01;
        player.mech = null; player.r = KNIGHT_R; F.step([]);
        check(P + 'RT6 a friend riding our bulldozer is in seat 2 where it is drawn, the driver reads "Ann hopped on." and the plaque lists him', rs.length === 1 && rs[0].n === 'Ann' && rs[0].s === 2 && said === 'Ann hopped on.' && glued, { rs: rs.map(r => r.n + ':' + r.s), said, glued }); }
      // the ground for RT7-RT11: open grass round o, the friend's bulldozer one tile east of the knight, facing east (px: a
      // distance in tiles, never a place)
      const px = n => n * TILE;
      // (boarding a walker and a wreck write the save's map diffs: those are put back as they were too)
      const diffs0 = new Map(mapDiffs), changed = [], set = (x, y, t) => { changed.push([x, y, tileAt(x, y)]); setTile(x, y, t); };
      const restore = () => { for (const [x, y, t] of changed.splice(0).reverse()) setTile(x, y, t); for (const k of Array.from(mapDiffs.keys())) if (!diffs0.has(k)) mapDiffs.delete(k); for (const [k, v] of diffs0) mapDiffs.set(k, v); };
      const fresh = () => { st.ride = null; st.trail = []; st.track = []; delete REMOTE().Mudtech; player.mech = null; player.r = KNIGHT_R; player.speed = 175; closePanel(); notice = null; F.tp(o.x, o.y); player.facing = { x: 1, y: 0 }; };
      const at = (dx, extra) => mud(Object.assign({ x: Math.round(tc(o.x) + dx), y: Math.round(tc(o.y)) }, extra || {}));
      const board = () => { at(48); F.step([]); settle(); F.step([]); F.press('KeyE'); F.sim(2, []); settle(); F.step([]); return !!st.ride; };
      for (let y = o.y - 4; y <= o.y + 4; y++) for (let x = o.x - 4; x <= o.x + 16; x++) set(x, y, T.GRASS);
      // RT7. E is Hop on only when nothing of his own is in front of him or he faces the machine: facing his own parked walker
      // (beside a friend's bulldozer) E climbs into his own; facing a workbench E opens it; facing the bulldozer E hops on
      { fresh(); at(48); F.step([]); settle();
        set(o.x, o.y + 1, T.MECH); player.facing = { x: 0, y: 1 }; F.step([]);
        const offWalker = offer(), seatW = hudSeatFace.list.filter(f => f.seat === 'use' && f.when()).sort((a, b) => b.prio - a.prio)[0];
        F.press('KeyE'); F.step([]); const intoOwn = !!player.mech && kindOf(player.mech) === 'walker' && !st.ride; setTile(o.x, o.y + 1, T.GRASS);
        fresh(); at(48); set(o.x, o.y + 1, T.WORKBENCH); player.facing = { x: 0, y: 1 }; F.step([]); settle();
        const offBench = offer(); F.press('KeyE'); F.step([]); const benchOpen = !!panel && !st.ride; closePanel();
        player.facing = { x: 1, y: 0 }; F.step([]); const offFacing = offer(); F.press('KeyE'); F.sim(2, []); const hopped = !!st.ride;
        // and on open ground with nothing in front, E hops on even facing away (the kid-friendly case)
        fresh(); set(o.x, o.y + 1, T.GRASS); at(48); player.facing = { x: -1, y: 0 }; F.step([]); settle(); const offOpen = offer();
        check(P + 'RT7 beside a friend\'s bulldozer, E keeps the knight\'s own use: facing his own walker he climbs in, facing a workbench it opens; facing the bulldozer, or with nothing in front, he hops on',
          offWalker === null && !!seatW && seatW.id !== 'hopon' && intoOwn && offBench === null && benchOpen && !!offFacing && hopped && !!offOpen,
          { offWalker: !!offWalker, seatW: seatW && seatW.id, intoOwn, offBench: !!offBench, benchOpen, offFacing: !!offFacing, hopped, offOpen: !!offOpen }); }
      // RT8. trees the driver plowed are still in the rider's own world: he is never set down in a pocket among them. A
      // forest east of the knight (one free tile in it beside the machine), the bulldozer drives 7 tiles in; climbing out
      // and hopping off (E) both set him on the open ground he rode over, where he can walk away.
      { const forest = () => { for (let y = o.y - 4; y <= o.y + 4; y++) for (let x = o.x + 4; x <= o.x + 16; x++) set(x, y, T.TREE); set(o.x + 8, o.y + 1, T.GRASS); };
        const driveIn = () => { for (let dx = px(1); dx <= px(8); dx += 12) { at(dx); F.step([]); settle(); F.step([]); } };
        const results = {};
        for (const how of ['climb out', 'hop off']) {
          fresh(); forest(); board(); driveIn();
          const pocket = clearAt(tc(o.x + 8), tc(o.y + 1)) && openFrom(tc(o.x + 8), tc(o.y + 1), OPEN_REACH) === 1;
          if (how === 'climb out') at(px(8), { mech: null }); else F.press('KeyE');
          F.step([]);
          results[how] = { on: st.ride !== null, free: freeAt(player.x, player.y), reach: openFrom(player.x, player.y, 400), out: player.x < tc(o.x + 4) - TILE / 2, pocket, said: notice && notice.text };
          restore(); for (let y = o.y - 4; y <= o.y + 4; y++) for (let x = o.x - 4; x <= o.x + 16; x++) set(x, y, T.GRASS);
        }
        const ok = Object.values(results).every(r => !r.on && r.free && r.reach >= 100 && r.out && r.pocket);
        check(P + 'RT8 a rider is never set down in a pocket among his own trees (the driver plowed them): climbing out and hopping off mid-lane both set him on the open ground he rode over', ok, results); }
      // RT9. his own line goes quiet (no word from the world): he pings once a second and, after 3 s of nothing, reads "You are
      // not connected, so you hop down." A pong keeps him on.
      { fresh(); const c0 = api.clock; let fakeNow = 5e6; api.clock = () => fakeNow;
        try {
          board(); const pings0 = sock.sent.filter(m => m.t === 'ping').length;
          for (let i = 0; i < 6; i++) { fakeNow += 1100; F.step([]); feed({ t: 'pong' }); }
          const kept = !!st.ride, pinged = sock.sent.filter(m => m.t === 'ping').length - pings0;
          fakeNow += 1200; F.step([]); fakeNow += 2000; F.step([]);
          check(P + 'RT9 a quiet line: he pings while nothing comes, a pong keeps him on, and 3 s of nothing sets him down with "You are not connected, so you hop down."',
            kept && pinged >= 3 && st.ride === null && !!notice && notice.text === 'You are not connected, so you hop down.' && clearAt(player.x, player.y), { kept, pinged, ride: st.ride, said: notice && notice.text });
        } finally { api.clock = c0; } }
      // RT10. the machine breaks under the driver: his presences say wk for a moment, and the riders read the right words
      { fresh(); board(); at(48, { mech: null, wk: 1 }); F.step([]);
        const riderSaid = notice && notice.text;
        fresh(); player.mech = { kind: 'dozer', hp: 1, maxHp: 110 }; player.r = 22; F.step([]); wreckMech(); dialog.cur = null; dialog.queue.length = 0; F.sim(30, []);
        { const wx = Math.floor(player.x / TILE), wy = Math.floor(player.y / TILE); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (tileAt(wx + dx, wy + dy) === T.DOZER_WRECK) setTile(wx + dx, wy + dy, T.GRASS); }
        const wk = ps().slice(-30).some(m => m.wk === 1 && m.mech === null); F.sim(3 * 60, []); const later = lastP();
        check(P + 'RT10 a wreck: the rider reads "Mudtech\'s bulldozer broke. You hop down."; the driver\'s presences say wk just after it, and not 3 s later',
          riderSaid === "Mudtech's bulldozer broke. You hop down." && wk && !!later && later.wk === undefined, { riderSaid, wk, later: later && later.wk }); }
      // RT11. a driver whose presence jumps (a cheat): the rider is set down at once where his seat last was on open ground,
      // never carried to the new place
      { fresh(); board(); for (let dx = px(1); dx <= px(3); dx += 12) { at(dx); F.step([]); settle(); F.step([]); }
        const before = { x: player.x, y: player.y };
        at(px(3) + 5000); const off = st.ride === null; F.step([]);
        check(P + 'RT11 a driver who jumps 5000 px: his rider is set down at once on open ground near where he was ("Mudtech\'s bulldozer went too fast for you. You hop down."), never carried',
          off && freeAt(player.x, player.y) && Math.hypot(player.x - before.x, player.y - before.y) < px(3) && !!notice && notice.text === "Mudtech's bulldozer went too fast for you. You hop down.",
          { off, moved: Math.round(Math.hypot(player.x - before.x, player.y - before.y)), said: notice && notice.text }); }
      // RT12. the driver's screen: a late presence that names a seat for a moment (a line that was down) says nothing
      { fresh(); delete REMOTE().Ann; player.mech = { kind: 'dozer', hp: 110, maxHp: 110 }; player.r = 22; F.step([]); notice = null;
        const ann = ride => feed(Object.assign({ t: 'p', n: 'Ann', role: 'player', map: 'over', x: Math.round(player.x), y: Math.round(player.y - 6), fx: 1, fy: 0, mv: false, wt: 0, hp: 20, mhp: 20, lv: 4, look: null, mech: null, dead: false }, ride ? { ride } : {}));
        ann({ d: 'Cohen', s: 2 }); F.step([]); ann(null); F.sim(20, []);
        const blink = notice && notice.text;
        ann({ d: 'Cohen', s: 2 }); F.sim(20, []); const on = notice && notice.text;
        player.mech = null; player.r = KNIGHT_R; delete REMOTE().Ann; F.step([]);
        check(P + 'RT12 a seat named for one presence (a late one) says nothing on the driver\'s screen; a friend who sits says "Ann hopped on."', blink === null && on === 'Ann hopped on.', { blink, on }); }
      restore();
    } finally {
      st.ride = null; st.last = null; st.riders = []; st.seen = {}; st.trail = []; st.track = [];
      for (const n of ['Mudtech', 'Ann']) delete REMOTE()[n];
      NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
      Object.assign(player, { x: keep.x, y: keep.y, mech: keep.mech, r: keep.r, speed: keep.speed, facing: keep.facing, dead: keep.dead });
      player.inv = JSON.parse(keep.inv);
      dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq); notice = null; closePanel(); h.peace(false); render();
    }
  });

  const api = { SEATS, WHAT, SEAT_AT, BODY_R, HOP_REACH, OPEN_REACH, STATS, state: st, kindOf, machineOf, seatOffset, seatWorld, ridersOf, freeSeat, hopTarget, offer, ownUse, faces, hopOn, setDown, landing, openFrom, freeAt, dragged, downText,
    clock: () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) };
  window.RIDE = api;
  return api;
})();
