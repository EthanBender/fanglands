// ============================================================================
// ADMIN: SUMMON A RIDE — the owner's knight calls any mount or machine to his side
// Owner (7 Oct 2026): "can you add to the admin powers that I can summon any mountable thing to my location to use"
// docs/ONLINE.md, "Admins and drop parties" (Summoning a ride), is the contract this file keeps to.
//
// One more row in the Admin panel's Powers tab (76-admin, ADMIN.addPower): Summon a ride. It opens a view with one button
// per ride the game has:
//   Cinder the mare (51-mounts)    the T_HORSE tile and player.horse: if he owns her she comes to him wherever she is
//                                  standing; if he does not, the summoned mare is his to ride (owned, like a bought one)
//   the goblin walker (06-systems) T.MECH
//   the bulldozer (22-bulldozer)   T.DOZER
//   the Barrelbeast (32-beast)     BEAST.tiles.BEAST
// The scrap yard's twins (33-goblincity: the yard walker and the yard dozer) are not rides of their own: their wrecks repair
// into the plain walker and bulldozer tiles, so the walker and bulldozer buttons are theirs too.
//
// A ride comes whole and ready to the nearest free tile round the admin that he can walk to (never past a wall, rocks or
// water; walled in all round, there is no room and it says so): never on a knight (his own or a friend's), a
// villager, a monster or something lying on the ground, never in water, a wall or a building, never beside a door, and never
// where it would close a gate to a mount that could ride through it before (94-mountgates' routes, as 51-mounts' dismount
// checks). A summoned machine is a parked machine like a repaired one: it is a map tile (changeTile, saved in mapDiffs), it is
// boarded with E, parks and wrecks the core's way. At most one of each machine he summoned stands unused: summoning that kind
// again takes the old one away first (player.summoned remembers it by map index until he climbs on it; a visit to a place
// forgets nothing, as the overworld map is put back when he comes out).
//
// The world decides: the admin's game asks ({t: 'summon', kind, req}), the world checks the role in its database and that he is
// out in the world (not in a place), writes "MudGoll summoned a bulldozer" to What admins did (mod_log), and answers
// {t: 'summon', ok, kind, req, code?}. The ride is put down only on that answer, so a kid's game can never summon one: the world
// answers him error admin, and a summon answer nobody asked for is ignored. Out in the world only: inside a place (an instance)
// the buttons say "Only out in the world." and do nothing.
// Feature file: no core edits; ADMIN.addPower is the only way in. window.SUMMON is the register.
// ============================================================================
{
  const REACH = 4;                    // tiles out from the admin that a ride may be put down
  const CAP_RATE = 1, CAP_BURST = 3;  // the world's cap on summon (per second, and the burst): never sent faster
  const PENDING_FOR = 10;             // game seconds an unanswered ask is kept
  const ONLY_OUT = 'Only out in the world.';
  const NO_ROOM = 'No room for it here. Stand somewhere more open.';
  const isAdmin = () => !!(window.ADMIN && ADMIN.is());
  const inPlace = () => !!(window.INSTANCES && INSTANCES.active && INSTANCES.active());
  const stamp = () => WORLD_V + '.' + WORLD_REV + '.' + MAP_W;

  // ---------- the rides ----------
  // tile(): the tile it stands on; said: the words in "Summoned ___ beside you."; present(): this build has it
  const KINDS = [
    { id: 'horse', name: 'Cinder the mare', said: 'Cinder', tile: () => window.MOUNTS ? MOUNTS.tiles.HORSE : undefined, present: () => !!window.MOUNTS,
      line: () => !window.MOUNTS ? '' : MOUNTS.riding() ? 'You are on her now.' : MOUNTS.state.owned ? 'She comes to you, wherever she is.' : 'She will be yours to ride.' },
    { id: 'walker', name: 'Goblin Walker', said: 'a goblin walker', tile: () => T.MECH, present: () => T.MECH !== undefined, line: () => 'Slow, and stomps.' },
    { id: 'dozer', name: 'Bulldozer', said: 'a bulldozer', tile: () => T.DOZER, present: () => T.DOZER !== undefined, line: () => 'Flattens trees and rocks.' },
    { id: 'beast', name: 'Barrelbeast', said: 'a Barrelbeast', tile: () => window.BEAST ? BEAST.tiles.BEAST : undefined, present: () => !!window.BEAST, line: () => 'Rams and lobs bombs.' },
  ];
  const kindOf = id => KINDS.find(k => k.id === id && k.present()) || null;
  const S = { pending: new Map(), req: 0, bucket: { tokens: CAP_BURST, at: 0 }, stats: { asked: 0, placed: 0, replaced: 0, refused: 0, ignored: 0 } };

  // ---------- what he summoned and has not used: player.summoned[kind] = { i, under, w } ----------
  // i: the map index it stands on; under: the tile NAME it was put down on (given back when it goes); w: the world it was put
  // down in (a new world or a moved map makes the index mean nothing, so it is forgotten). Machines only: the mare is one mare.
  const groundOf = name => { const t = tileId(name); return (t === null || t === undefined || SOLID.has(t)) ? T.DIRT : t; };
  const xyOf = i => ({ tx: i % MAP_W, ty: Math.floor(i / MAP_W) });
  function standing(kind) {
    const r = player.summoned && player.summoned[kind.id];
    if (!r || typeof r.i !== 'number' || r.w !== stamp()) return null;
    const { tx, ty } = xyOf(r.i);
    return inMap(tx, ty) && tileAt(tx, ty) === kind.tile() ? Object.assign({ tx, ty }, r) : null;
  }
  // where the ride he would replace stands now (the mare wherever she is; a machine he summoned and never climbed on)
  function oldSpot(kind) {
    if (kind.id !== 'horse') return standing(kind);
    const h = MOUNTS.state, a = h.at;
    return a && inMap(a[0], a[1]) && tileAt(a[0], a[1]) === kind.tile() ? { tx: a[0], ty: a[1], under: h.under } : null;
  }

  // ---------- the nearest free tile round him ----------
  function knightOn(tx, ty) {
    if (!player.dead && circleHitsTile(player.x, player.y, player.r || 13, tx, ty)) return true;
    const P = window.PLAYERS, here = P && typeof P.mapId === 'function' ? P.mapId() : 'over';
    if (P && P.remote) for (const k of Object.values(P.remote)) if (k && !k.dead && (k.map || 'over') === here && typeof k.x === 'number' && circleHitsTile(k.x, k.y, Math.max(14, k.r || 0), tx, ty)) return true;
    return false;
  }
  const DOORS = () => [T.DOOR, T.COFFINDOOR].filter(t => t !== undefined);
  function nearGate(tx, ty) { for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) if (inMap(x, y) && RIDE_THROUGH.has(tileAt(x, y))) return [x, y]; return null; }
  // every way a mount could cross the gates near (tx, ty) right now (94-mountgates loads after this file)
  const routes = at => window.MOUNTGATES && MOUNTGATES.routes ? MOUNTGATES.routes(at[0], at[1]) : [];
  // why (tx, ty) will not take the ride, or null when it will
  function blocked(tx, ty, park) {
    if (!inMap(tx, ty)) return 'edge';
    const t = tileAt(tx, ty);
    if (!PLACEABLE_ON.has(t)) return t === T.WATER ? 'water' : 'solid';
    if (insideBuilding(tx, ty)) return 'building';
    if (knightOn(tx, ty)) return 'knight';
    for (const n of NPCS) if (circleHitsTile(n.px, n.py, 14, tx, ty)) return 'villager';
    for (const m of monsters) if (!m.dead && circleHitsTile(m.x, m.y, m.r || 13, tx, ty)) return 'monster';
    for (const d of drops) if (Math.floor(d.x / TILE) === tx && Math.floor(d.y / TILE) === ty) return 'drop';
    const doors = DOORS();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(tx + dx, ty + dy) && doors.includes(tileAt(tx + dx, ty + dy))) return 'door';
    const g0 = nearGate(tx, ty);
    if (g0) {
      const i = idx(tx, ty), was = map[i], before = routes(g0);
      map[i] = park; const after = routes(g0); map[i] = was;
      if (!before.every(r => after.includes(r))) return 'gate';
    }
    return null;
  }
  // nearest first (straight-line distance from his middle to the tile's), then north to south, then west to east: the same
  // answer every time for the same ground
  function ring() {
    const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE), out = [];
    for (let dy = -REACH; dy <= REACH; dy++) for (let dx = -REACH; dx <= REACH; dx++) {
      if (!dx && !dy) continue;
      const tx = ptx + dx, ty = pty + dy;
      out.push({ tx, ty, d: dist(player.x, player.y, tc(tx), tc(ty)) });
    }
    return out.sort((a, b) => a.d - b.d || a.ty - b.ty || a.tx - b.tx);
  }
  // the tiles he can walk to on foot without leaving the square REACH round him (straight steps only, as a knight cannot
  // squeeze between two corners): a ride is put down only where he can get to it, never past a wall, rocks or water
  function walkable() {
    const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE), seen = new Set([idx(ptx, pty)]), todo = [[ptx, pty]];
    while (todo.length) {
      const [x, y] = todo.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (Math.abs(nx - ptx) > REACH || Math.abs(ny - pty) > REACH || !inMap(nx, ny)) continue;
        const i = idx(nx, ny);
        if (seen.has(i) || solidFor(map[i], 'player')) continue;
        seen.add(i); todo.push([nx, ny]);
      }
    }
    return seen;
  }
  // the spot for this kind, with the ride it would replace counted as gone (its tile as the ground under it)
  function spotFor(kind) {
    const park = kind.tile(), old = oldSpot(kind), oi = old ? idx(old.tx, old.ty) : -1, was = oi >= 0 ? map[oi] : 0;
    if (oi >= 0) map[oi] = groundOf(old.under);
    try { const can = walkable(); for (const c of ring()) if (can.has(idx(c.tx, c.ty)) && !blocked(c.tx, c.ty, park)) return { tx: c.tx, ty: c.ty }; return null; }
    finally { if (oi >= 0) map[oi] = was; }
  }

  // ---------- asking the world ----------
  function allowed() {
    const b = S.bucket, now = time, dt = now - b.at;
    b.tokens = dt < 0 ? CAP_BURST : Math.min(CAP_BURST, b.tokens + dt * CAP_RATE); b.at = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1; return true;
  }
  // why he cannot summon this kind right now, or null
  function refusal(kind) {
    if (!isAdmin()) return 'Only an admin can do that.';
    if (!kind) return 'That ride is not in this game.';
    if (inPlace()) return ONLY_OUT;
    if (player.dead) return 'Not now.';
    if (kind.id === 'horse' && MOUNTS.riding()) return 'You are on Cinder already.';
    if (!spotFor(kind)) return NO_ROOM;
    return null;
  }
  function summon(id) {
    const kind = kindOf(id), why = refusal(kind);
    if (why) { S.stats.refused++; notify(why); return false; }
    if (!allowed()) { S.stats.refused++; notify('One thing at a time. Try again in a moment.'); return false; }
    const req = ++S.req;
    S.pending.set(req, { kind: kind.id, at: time });   // before the send: a world on this page (the tests) answers at once
    if (!NET.send({ t: 'summon', kind: kind.id, req })) { S.pending.delete(req); notify('That did not go through. Try again.'); return false; }
    S.stats.asked++;
    return true;
  }

  // ---------- the world's answer: only now is the ride put down ----------
  function putDown(kind) {
    const old = oldSpot(kind);
    if (old) changeTile(old.tx, old.ty, groundOf(old.under));   // the one he would have piled up goes (the mare: from wherever she was)
    const at = spotFor(kind);
    if (!at) { if (old) changeTile(old.tx, old.ty, kind.tile()); notify(NO_ROOM); return false; }
    const under = tileName(tileAt(at.tx, at.ty));
    changeTile(at.tx, at.ty, kind.tile());
    if (kind.id === 'horse') {
      const h = MOUNTS.state;
      h.owned = true; h.hp = MOUNTS.HP; h.at = [at.tx, at.ty]; h.under = under;   // his to ride, as a bought one is, rested
    } else {
      if (!player.summoned || typeof player.summoned !== 'object') player.summoned = {};
      player.summoned[kind.id] = { i: idx(at.tx, at.ty), under, w: stamp() };
    }
    if (old) S.stats.replaced++;
    S.stats.placed++;
    burst(tc(at.tx), tc(at.ty), '#f5c542', 22, 110); sfx('ui');
    notify(`Summoned ${kind.said} beside you. Press E to ride.`);
    save();
    return true;
  }
  NET.on('summon', m => {
    const req = m && Number.isInteger(m.req) ? m.req : null, ask = req !== null ? S.pending.get(req) : null;
    if (!ask || !isAdmin() || m.kind !== ask.kind) { S.stats.ignored++; return; }   // nobody here asked for it: nothing happens
    S.pending.delete(req);
    if (!m.ok) { S.stats.refused++; notify(m.code === 'place' ? ONLY_OUT : 'The world said no to that.'); return; }
    const kind = kindOf(ask.kind);
    const why = !kind ? 'That ride is not in this game.' : inPlace() ? ONLY_OUT : player.dead ? 'Not now.' : (kind.id === 'horse' && MOUNTS.riding()) ? 'You are on Cinder already.' : null;
    if (why) { S.stats.refused++; notify(why); return; }
    putDown(kind);
  });
  const forgetAsks = () => S.pending.clear();
  NET.on('offline', forgetAsks); NET.on('welcome', forgetAsks); NET.on('role', forgetAsks);

  // a machine he climbed on (or that wrecked, or was stripped) is not a summoned one any more: forget it. Never inside a place:
  // there the shared map holds the place's own tiles (16-instances), so the overworld index means nothing until he comes out,
  // and forgetting it there would let the next summon pile a second machine beside the unused first one.
  HOOKS.update.push(() => {
    const r = player.summoned;
    if (r && typeof r === 'object' && !inPlace()) {
      for (const id of Object.keys(r)) { const kind = kindOf(id); if (!kind || !standing(kind)) delete r[id]; }
      if (!Object.keys(r).length) delete player.summoned;
    }
    if (S.pending.size) for (const [req, a] of S.pending) if (time - a.at > PENDING_FOR || time < a.at) S.pending.delete(req);
  });

  // ---------- the Powers row and its view ----------
  const VIEW = 'summon';
  function drawView(g, x, y, w, h, T) {
    const K = ADMIN.kit, out = inPlace();
    K.row(g, x, y, w, T, [
      { text: 'Back', w: 70, action: () => { ADMIN.state.view = null; }, color: '#21262d', key: 'admin:summon:back' },
      { w: 'fill', draw: (bx, bw) => { g.font = 'bold 15px sans-serif'; g.textAlign = 'left'; g.fillStyle = ADMIN.GOLD; g.fillText(K.fit(g, 'Summon a ride', bw - 4), bx + 4, y + T / 2 + 5); } },
    ]);
    const kinds = KINDS.filter(k => k.present()), wide = w >= 520, cols = wide ? Math.min(4, kinds.length) : Math.min(2, kinds.length);
    const cellW = (w - (cols - 1) * 8) / cols, top = y + T + 14, cellH = T + 26;
    kinds.forEach((k, i) => {
      const cx = x + (i % cols) * (cellW + 8), cy = top + Math.floor(i / cols) * cellH;
      const mine = k.id === 'horse' && MOUNTS.riding();
      K.btn(g, cx, cy, cellW, T, out ? ONLY_OUT : k.name, () => summon(k.id), out ? '#21262d' : ADMIN.SEL, !out && !mine, 'admin:summon:' + k.id);
      K.note(g, out ? '' : k.line(), cx + 2, cy + T + 16, cellW - 4);
    });
    const by = top + Math.ceil(kinds.length / cols) * cellH + 6;
    if (by + 12 <= y + h) K.note(g, out ? ONLY_OUT : 'It comes whole and ready to the nearest free spot beside you.', x, by + 12, w, out ? '#e3b341' : '#8b949e');
  }
  if (window.ADMIN && ADMIN.addPower) ADMIN.addPower({
    key: 'admin:summon', view: VIEW, draw: drawView,
    entry: () => ({ key: 'admin:summon', text: 'Summon a ride', color: '#21262d', enabled: !inPlace(), action: () => { ADMIN.state.view = { kind: VIEW }; },
      line: inPlace() ? ONLY_OUT : 'Cinder, a walker, a bulldozer or a Barrelbeast, beside you.' }),
  });

  window.SUMMON = { KINDS, REACH, summon, spotFor: id => spotFor(kindOf(id)), blocked, standing: id => standing(kindOf(id)), state: S, ONLY_OUT, NO_ROOM };

  // ---------- self-test ----------
  // Every kind: summoned (the world asked once, the ride on the nearest free tile, the plain words, saved in mapDiffs),
  // ridden (E), parked (X) and forgotten as summoned, wrecked (machines) the core's way, summoned again from somewhere else
  // (the unused one goes: never two); the mare when he owns her and when he does not; a crowded spot (rocks, a friend, a
  // monster); beside the city gate (never closes it); by water and in the middle of it; inside a place (refused, nothing
  // sent); a world that says no; a player's game (nothing sent, a forged answer does nothing); the view's buttons on every
  // screen size. The world is a fake that answers on the spot; online/test/admin.test.mjs and tools/mmo-sim-admin.js prove
  // the real one. Everything it changes is put back.
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'summon: ';
    if (inPlace()) INSTANCES.leave();
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, touch: window.__forceTouch, peace: window.__peace, notice, paused, vw: window.innerWidth, vh: window.innerHeight,
      cur: dialog.cur, queue: dialog.queue.slice(), banner: levelBanner, playing: window.LOGIN ? LOGIN.playing : false,
      x: player.x, y: player.y, r: player.r, speed: player.speed, facing: { ...player.facing }, mech: player.mech, mechHp: player.mechHp,
      horse: JSON.parse(JSON.stringify(player.horse || null)), summoned: player.summoned ? JSON.parse(JSON.stringify(player.summoned)) : undefined,
      map: map.slice(), diffs: new Map(mapDiffs), remote: Object.assign({}, (window.PLAYERS && PLAYERS.remote) || {}), monsters: monsters.length };
    const _reset = window.CLOUD ? CLOUD.reset : null;
    // a world that answers on the spot, as the Room does: the role from the test, a place refused, every summon logged
    let sock = null, role = 'admin', inAPlace = false;
    const sent = [], logged = [];
    const world = {
      call() { return {}; },
      open() {
        const s = { readyState: 1, close() { s.readyState = 3; },
          send(str) {
            const m = JSON.parse(str); sent.push(m);
            if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'MudGoll', at: 1, keeper: 'MudGoll', role }) });
            if (m.t === 'summon') {
              if (role !== 'admin') return s.onmessage({ data: JSON.stringify({ t: 'error', code: 'admin', text: 'only an admin can do that' }) });
              if (inAPlace) return s.onmessage({ data: JSON.stringify({ t: 'summon', ok: false, kind: m.kind, req: m.req, code: 'place' }) });
              logged.push('MudGoll summoned ' + m.kind);
              s.onmessage({ data: JSON.stringify({ t: 'summon', ok: true, kind: m.kind, req: m.req }) });
            }
          } };
        sock = s; return s;
      },
    };
    const feed = m => { if (sock && sock.onmessage) sock.onmessage({ data: JSON.stringify(m) }); };
    const connect = r => { role = r; NET.disconnect(); NET.token = 'summon-test'; NET.connect(); };
    const refill = () => { S.bucket.tokens = CAP_BURST; S.bucket.at = time; };
    const of = t => sent.filter(m => m.t === t);
    const own = () => ({ tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) });
    const count = t => { let n = 0; for (let i = 0; i < map.length; i++) if (map[i] === t) n++; return n; };
    const near = (t, reach) => { const o = own(); const out = []; for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) if (inMap(o.tx + dx, o.ty + dy) && tileAt(o.tx + dx, o.ty + dy) === t) out.push({ tx: o.tx + dx, ty: o.ty + dy }); return out; };
    const cheb = (a, b) => Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty));
    const onFoot = () => { player.mech = null; player.r = 13; player.speed = 175; };
    const at = (o) => { onFoot(); F.tp(o.x, o.y); player.facing = { x: 0, y: 1 }; refill(); notice = null; dialog.cur = null; dialog.queue.length = 0; };
    const open = () => { const o = h.openSpot(ATLAS.world.tx(58), ATLAS.world.ty(32)); return o; };
    const RIDDEN = { horse: 'horse', walker: undefined, dozer: 'dozer', beast: 'beast' };
    const WRECK = { walker: () => T.WRECK, dozer: () => T.DOZER_WRECK, beast: () => BEAST.tiles.BEAST_WRECK };
    try {
      NET.enabled = true; NET.useFake(world); dialog.cur = null; dialog.queue.length = 0; closePanel(); paused = false; h.peace(true);
      if (window.CLOUD) CLOUD.reset = function () { };
      connect('admin');
      const home = open();
      // two more open spots well away from it, for summoning again from somewhere else
      const east = h.openSpot(home.x + 8, home.y, x => x >= home.x + 6), west = h.openSpot(home.x - 8, home.y, x => x <= home.x - 6);

      // ---- every kind: summoned, ridden, parked, wrecked, summoned again from elsewhere ----
      for (const kind of KINDS.filter(k => k.present())) {
        const K = kind.id, park = kind.tile();
        at(home);
        if (K === 'horse') { const hs = MOUNTS.state; hs.owned = true; hs.hp = 3; MOUNTS.whistle(); hs.hp = 3; }   // she is at Fennick's rail, tired
        const before = count(park), s0 = sent.length, l0 = logged.length;
        const expect = spotFor(kind);
        const asked = summon(K);
        const msg = sent.slice(s0);
        const put = near(park, REACH), spot = put[0];
        const plain = !!notice && notice.text === `Summoned ${kind.said} beside you. Press E to ride.`;
        const one = msg.length === 1 && msg[0].t === 'summon' && msg[0].kind === K && Number.isInteger(msg[0].req) && logged.length === l0 + 1;
        const nearest = !!spot && !!expect && spot.tx === expect.tx && spot.ty === expect.ty && cheb(spot, own()) === 1;
        const counted = K === 'horse' ? count(park) === before : count(park) === before + 1;
        const saved = !!spot && mapDiffs.get(idx(spot.tx, spot.ty)) === park;
        const recorded = K === 'horse' ? (MOUNTS.state.owned && MOUNTS.state.hp === MOUNTS.HP && MOUNTS.state.at && MOUNTS.state.at[0] === spot.tx) : (!!standing(kind) && JSON.parse(JSON.stringify(player)).summoned[K].i === idx(spot.tx, spot.ty));
        check(P + K + ': summoned: the world is asked once and logs it, the ride stands on the nearest free tile beside him, "Summoned ' + kind.said + ' beside you. Press E to ride.", saved with the map' + (K === 'horse' ? ', rested, from the rail (she came, there is still only one)' : ' and remembered as summoned'),
          asked && one && put.length === 1 && nearest && plain && counted && saved && !!recorded, { asked, msg, put, expect, own: own(), notice: notice && notice.text, counted, saved, recorded: !!recorded });
        // ridden: E on it
        F.face(spot.tx, spot.ty); notice = null; F.press('KeyE'); F.sim(2, []);
        const rode = !!player.mech && player.mech.kind === RIDDEN[K] && tileAt(spot.tx, spot.ty) !== park;
        const forgot = K === 'horse' ? !MOUNTS.state.at : !standing(kind) && !(player.summoned && player.summoned[K]);
        // parked: X climbs down; the ride stands on the ground beside him, his like any other
        player.facing = { x: 1, y: 0 }; F.sim(1, []); F.press('KeyX'); F.sim(3, []);   // a tick facing east first, as turning takes one
        const parked = !player.mech && near(park, 2).length === 1;
        check(P + K + ': ridden with E (' + (RIDDEN[K] || 'walker') + '), forgotten as summoned once he is on it, and parked with X beside him like any other', rode && forgot && parked, { rode, mech: player.mech, forgot, parked, near: near(park, 2) });
        // wrecked: the core's way, the kind's own wreck (machines; the mare never wrecks, she bolts)
        if (WRECK[K]) {
          const p2 = near(park, 2)[0]; F.face(p2.tx, p2.ty); F.press('KeyE'); F.sim(2, []);
          const w0 = count(WRECK[K]()); const on = player.mech && player.mech.kind === RIDDEN[K];
          dialog.queue.length = 0; dialog.cur = null; wreckMech(); F.sim(3, []);
          const wrecked = on && !player.mech && count(WRECK[K]()) === w0 + 1;
          dialog.queue.length = 0; dialog.cur = null;
          check(P + K + ': a summoned ' + K + ' wrecks the core\'s way (its own wreck tile)', wrecked, { on, wrecks: [w0, count(WRECK[K]())] });
        }
        // summoned again from somewhere else, twice: the unused one goes each time, never two
        at(east);
        const b2 = count(park); summon(K);
        const first = near(park, REACH)[0];
        at(west);
        summon(K);
        const second = near(park, REACH)[0];
        const firstGone = !!first && tileAt(first.tx, first.ty) !== park && PLACEABLE_ON.has(tileAt(first.tx, first.ty));
        const replaced = K === 'horse' ? count(park) === b2 : count(park) === b2 + 1;
        check(P + K + ': summoned again somewhere else, the unused one goes back to the ground it stood on and the new one comes: one, never two', !!first && !!second && firstGone && replaced && cheb(second, own()) === 1, { first, second, firstGone, counts: [b2, count(park)] });
        // tidy: the last one goes too, so the next kind's ground is clear
        const last = oldSpot(kind); if (last) changeTile(last.tx, last.ty, groundOf(last.under));
        for (const q of near(park, 8)) changeTile(q.tx, q.ty, T.GRASS);
        if (WRECK[K]) for (const q of near(WRECK[K](), 8)) changeTile(q.tx, q.ty, T.GRASS);
      }

      // ---- the mare he does not own: summoned, she is his ----
      if (kindOf('horse')) {
        at(home); const hs = MOUNTS.state; hs.owned = false; hs.at = null; hs.under = null;
        summon('horse');
        const put = near(MOUNTS.tiles.HORSE, REACH)[0];
        const ownsHer = hs.owned === true && !!put && hs.at && hs.at[0] === put.tx;
        F.face(put.tx, put.ty); F.press('KeyE'); F.sim(2, []);
        const rides = MOUNTS.riding();
        notice = null; const again = summon('horse') === false && !!notice && notice.text === 'You are on Cinder already.';
        F.press('KeyX'); F.sim(2, []);
        check(P + 'a mare he did not own: summoned, she is his (owned, like a bought one), he rides her; summoning her while on her is refused', ownsHer && rides && again, { ownsHer, rides, again, notice: notice && notice.text });
        const q = oldSpot(kindOf('horse')); if (q) changeTile(q.tx, q.ty, groundOf(q.under)); hs.at = null; hs.under = null;
      }

      // ---- a crowded spot: rocks all round, a friend on the one open side, a goblin on the nearest tile out ----
      { at(home); const o = own(), set = [];
        const put = (tx, ty, t) => { set.push([tx, ty, tileAt(tx, ty)]); changeTile(tx, ty, t); };
        for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]]) put(o.tx + dx, o.ty + dy, T.ROCK);
        PLAYERS.remote.Sam = { n: 'Sam', map: 'over', x: tc(o.tx + 1), y: tc(o.ty), shown: { x: tc(o.tx + 1), y: tc(o.ty) }, dead: false, r: 13 };
        const gob = { type: 'goblin', x: tc(o.tx), y: tc(o.ty - 2), r: 13, dead: false, hp: 5, maxHp: 5, home: { x: tc(o.tx), y: tc(o.ty - 2) } };
        monsters.push(gob);
        const ok = summon('dozer');
        const d = near(T.DOZER, REACH);
        monsters.splice(monsters.indexOf(gob), 1); delete PLAYERS.remote.Sam;
        const spot = d[0], d2 = !!spot && cheb(spot, o) === 2 && (spot.tx === o.tx || spot.ty === o.ty);   // a straight tile two out: the nearest left
        const clear = !!spot && !(spot.tx === o.tx + 1 && spot.ty === o.ty) && !(spot.tx === o.tx && spot.ty === o.ty - 2) && d.length === 1;
        check(P + 'a crowded spot: rocks round him and Sam on the one open side, a goblin on the nearest tile beyond: the bulldozer takes the nearest tile left, two out, on nobody', ok && clear && d2, { ok, d, o, d2 });
        for (const q of d) changeTile(q.tx, q.ty, T.GRASS);
        for (let i = set.length - 1; i >= 0; i--) changeTile(set[i][0], set[i][1], set[i][2]);
        delete player.summoned; }

      // ---- walled in: rocks on all eight sides, open ground beyond them: no room (never past the rocks), nothing sent;
      //      in a pocket with one open tile, the ride goes on that tile ----
      { at(home); const o = own(), set = [];
        const put = (tx, ty, t) => { set.push([tx, ty, tileAt(tx, ty)]); changeTile(tx, ty, t); };
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) put(o.tx + dx, o.ty + dy, T.ROCK);
        const c0 = count(T.DOZER), s0 = sent.length; notice = null;
        const no = summon('dozer') === false && !!notice && notice.text === NO_ROOM;
        const quiet = !sent.slice(s0).some(m => m.t === 'summon') && count(T.DOZER) === c0 && !player.summoned;
        for (let i = set.length - 1; i >= 0; i--) changeTile(set[i][0], set[i][1], set[i][2]);
        set.length = 0;
        // a pocket: rocks round him and round the one open tile north of him, so he can walk to that tile and nowhere else:
        // the ride goes there
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [-1, -2], [0, -2], [1, -2]]) put(o.tx + dx, o.ty + dy, T.ROCK);
        const s1 = sent.length; notice = null;
        const ok = summon('dozer'); const d = near(T.DOZER, REACH);
        const pocket = ok && d.length === 1 && d[0].tx === o.tx && d[0].ty === o.ty - 1;
        for (const q of d) changeTile(q.tx, q.ty, T.GRASS);
        for (let i = set.length - 1; i >= 0; i--) changeTile(set[i][0], set[i][1], set[i][2]);
        delete player.summoned;
        check(P + 'walled in: rocks on all eight sides (open ground just past them): "' + NO_ROOM + '", nothing sent, nothing put down; in a pocket with one open tile, the ride goes there and never past the rocks', no && quiet && pocket, { no, quiet, notice: notice && notice.text, d, o, sent: sent.slice(s1).filter(m => m.t === 'summon').length }); }

      // ---- a place visited in between: he summons a bulldozer, goes into the Spider Den and out, and summons one again from
      //      another spot: the unused one still goes (one, never two), and player.summoned points at the new one ----
      { at(home); const c0 = count(T.DOZER);
        summon('dozer'); const first = near(T.DOZER, REACH)[0];
        const into = INSTANCES.enter('spider_den'); F.sim(2, []);
        const kept = !!(player.summoned && player.summoned.dozer);
        INSTANCES.leave(); F.sim(2, []);
        at(east); summon('dozer'); const second = near(T.DOZER, REACH)[0];
        const one = count(T.DOZER) === c0 + 1, firstGone = !!first && tileAt(first.tx, first.ty) !== T.DOZER;
        const points = !!second && !!player.summoned && !!player.summoned.dozer && player.summoned.dozer.i === idx(second.tx, second.ty) && !!standing(kindOf('dozer'));
        check(P + 'a place visited in between (the Spider Den): the summoned bulldozer is still remembered inside and after, and summoning again from another spot replaces it: one bulldozer, never two', into && kept && one && firstGone && points, { into, kept, counts: [c0, count(T.DOZER)], first, second, firstGone, points, summoned: player.summoned });
        const q = oldSpot(kindOf('dozer')); if (q) changeTile(q.tx, q.ty, groundOf(q.under)); delete player.summoned; }

      // ---- beside the city gate: never closes it to a mount that could ride through ----
      { const gates = window.MOUNTGATES ? MOUNTGATES.cityGates() : [];
        const res = [];
        for (const gate of gates.slice(0, 1)) for (const stand of [{ tx: gate.x - gate.dir, ty: gate.mid }, { tx: gate.x, ty: gate.mid }, { tx: gate.x - gate.dir, ty: gate.rows[0] - 1 }]) {
          for (const K of ['beast', 'dozer', 'walker', 'horse']) {
            const kind = kindOf(K); if (!kind) continue;
            at({ x: stand.tx, y: stand.ty });
            if (K === 'horse') { MOUNTS.state.owned = true; }
            const before = MOUNTGATES.routes(gate.x, gate.mid);
            const ok = summon(K);
            const p = near(kind.tile(), REACH)[0];
            const after = MOUNTGATES.routes(gate.x, gate.mid);
            res.push({ K, stand, ok, p, keeps: before.every(r => after.includes(r)), onGate: !!p && RIDE_THROUGH.has(tileAt(p.tx, p.ty)) });
            const q = oldSpot(kind); if (q) changeTile(q.tx, q.ty, groundOf(q.under));
            if (K === 'horse') { MOUNTS.state.at = null; MOUNTS.state.under = null; }
          }
        }
        check(P + 'beside the city gate (outside it, in the gateway, at its corner): every ride is put down and the gate still lets through every mount that could cross it before', res.length >= 8 && res.every(r => r.ok && r.p && r.keeps && !r.onGate), { res: res.filter(r => !(r.ok && r.p && r.keeps && !r.onGate)), n: res.length });
        delete player.summoned; }

      // ---- by water: never in it; in the middle of a lake, no room ----
      { const pond = F.nearestTile([T.WATER], { x: tc(ATLAS.frame('pond').p(40, 30)[0]), y: tc(ATLAS.frame('pond').p(40, 30)[1]) });
        let shore = null;
        if (pond) for (let r = 0; r <= 6 && !shore; r++) for (let dy = -r; dy <= r && !shore; dy++) for (let dx = -r; dx <= r && !shore; dx++) {
          const x = pond.x + dx, y = pond.y + dy;
          if (inMap(x, y) && PLACEABLE_ON.has(tileAt(x, y)) && !insideBuilding(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => tileAt(x + a, y + b) === T.WATER)) shore = { x, y };
        }
        let ok = false, p = null, under = null, onMech = false;
        if (shore) { at(shore); ok = summon('walker'); p = near(T.MECH, REACH)[0]; onMech = !!p && tileAt(p.tx, p.ty) === T.MECH; under = p && player.summoned && player.summoned.walker ? player.summoned.walker.under : null; const q = oldSpot(kindOf('walker')); if (q) changeTile(q.tx, q.ty, groundOf(q.under)); delete player.summoned; }
        // the middle of the widest water: every tile within reach is water
        let lake = null;
        for (let y = REACH; y < MAP_H - REACH && !lake; y += 3) for (let x = REACH; x < MAP_W - REACH && !lake; x += 3) {
          if (tileAt(x, y) !== T.WATER) continue;
          let all = true; for (let dy = -REACH; dy <= REACH && all; dy++) for (let dx = -REACH; dx <= REACH && all; dx++) if (tileAt(x + dx, y + dy) !== T.WATER) all = false;
          if (all) lake = { x, y };
        }
        let lakeNo = true, lakeSent = 0;
        if (lake) { at(lake); const s0 = sent.length; lakeNo = summon('beast') === false && !!notice && notice.text === NO_ROOM; lakeSent = sent.slice(s0).filter(m => m.t === 'summon').length; }
        check(P + 'by water: on the shore the walker goes on dry land, never in the water; in the middle of a lake there is no room, it says so and nothing is sent', !!shore && ok && onMech && PLACEABLE_ON.has(tileId(under)) && lakeNo && lakeSent === 0, { shore, ok, p, under, lake, lakeNo, lakeSent }); }

      // ---- inside a place: refused, nothing sent; the buttons say so ----
      { at(home); const s0 = sent.length;
        const into = INSTANCES.enter('spider_den'); F.sim(2, []);
        const words = [], dead = [];
        for (const K of ['horse', 'walker', 'dozer', 'beast']) { notice = null; refill(); words.push(summon(K) === false && !!notice && notice.text === ONLY_OUT); }
        closePanel(); ADMIN.open('powers'); render();
        const entry = buttons.find(b => /admin:summon$/.test(b.label));
        ADMIN.state.view = { kind: VIEW }; render();
        for (const k of KINDS.filter(k => k.present())) { const b = buttons.find(b => b.label.endsWith('admin:summon:' + k.id)); dead.push(!!b && !!b.disabled); }
        closePanel(); ADMIN.state.view = null;
        INSTANCES.leave(); F.sim(2, []);
        check(P + 'inside a place (the Spider Den): every summon says "Only out in the world." and sends nothing; the Powers row and every ride button are shown dead', into && words.every(Boolean) && !sent.slice(s0).some(m => m.t === 'summon') && !!entry && !!entry.disabled && dead.length && dead.every(Boolean), { into, words, sent: sent.slice(s0).filter(m => m.t === 'summon'), entry: entry && entry.label, dead }); }

      // ---- a world that says no (it finds him in a place): nothing is put down ----
      { at(home); inAPlace = true; const c0 = count(T.DOZER); notice = null;
        const asked = summon('dozer'); inAPlace = false;
        check(P + 'the world says no (it has him in a place): "Only out in the world." and nothing is put down', asked && count(T.DOZER) === c0 && !!notice && notice.text === ONLY_OUT && !player.summoned, { asked, notice: notice && notice.text }); }

      // ---- a player: nothing sent, nothing put down; a forged answer does nothing ----
      { connect('player'); at(home); const s0 = sent.length, c0 = count(T.DOZER), i0 = S.stats.ignored;
        notice = null; const no = summon('dozer') === false && !!notice && notice.text === 'Only an admin can do that.';
        feed({ t: 'summon', ok: true, kind: 'dozer', req: S.req }); feed({ t: 'summon', ok: true, kind: 'dozer', req: S.req + 1 }); feed({ t: 'summon', ok: true, kind: 'dozer' });
        const raw = NET.send({ t: 'summon', kind: 'dozer', req: 77 }); F.sim(2, []);
        const nothing = count(T.DOZER) === c0 && !player.summoned && S.stats.ignored === i0 + 3;
        const shut = !ADMIN.open('powers') && panel !== 'admin';
        check(P + 'a player: Summon refuses ("Only an admin can do that.", nothing sent); answers the world never sent do nothing; a raw summon he sends is refused by the world; no Admin panel', no && nothing && shut && sent.slice(s0).filter(m => m.t === 'summon').length === (raw ? 1 : 0), { no, nothing, shut, sent: sent.slice(s0) });
        connect('admin'); }

      // ---- the Powers row and the view, at every size; 44 px on touch ----
      { at(home); const sizes = [[390, 844, 'phone'], [844, 390, 'landscape phone'], [768, 1024, 'iPad'], [1024, 768, 'iPad landscape'], [1280, 800, 'laptop']];
        const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        const setSize = (w, hh) => { try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { } render(); return VW === w && VH === hh; };
        const hits = [], small = [], done = []; let row = false, view = false, back = false;
        for (const touchOn of [false, true]) {
          window.__forceTouch = touchOn;
          for (const [w, hh, name] of sizes) {
            closePanel(); if (!setSize(w, hh)) continue; const tag = name + (touchOn ? ' touch' : '');
            for (const v of [null, VIEW]) {
              ADMIN.open('powers'); ADMIN.state.view = v ? { kind: v } : null; render();
              const r = panelRect, mine = buttons.slice(ADMIN.state.panelFrom || 0).filter(b => b.w > 0 && b.h > 0 && /^(disabled:)?admin:/.test(b.label));
              if (!v) row = row || mine.some(b => b.label === 'admin:summon');
              else { view = view || KINDS.filter(k => k.present()).every(k => mine.some(b => b.label === 'admin:summon:' + k.id)); }
              for (const b of mine) if (!r || b.x < r.x - 1 || b.y < r.y - 1 || b.x + b.w > r.x + r.w + 1 || b.y + b.h > r.y + r.h + 1) hits.push(`${tag} ${v || 'powers'}: ${b.label} leaves the panel`);
              for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) if (overlap(mine[i], mine[j])) hits.push(`${tag} ${v || 'powers'}: ${mine[i].label} × ${mine[j].label}`);
              if (touchOn) for (const b of mine) if (b.h < 44 || b.w < 44) small.push(`${tag} ${v || 'powers'}: ${b.label} ${Math.round(b.w)}x${Math.round(b.h)}`);
              done.push(tag + ' ' + (v || 'powers'));
            }
            F.clickButton('admin:summon:back'); back = back || ADMIN.state.view === null;
            closePanel(); ADMIN.state.view = null;
          }
        }
        setSize(was.vw, was.vh); window.__forceTouch = was.touch;
        // the row opens the view, and the view's button summons
        closePanel(); ADMIN.open('powers'); render(); const opened = F.clickButton('admin:summon') && ADMIN.state.view && ADMIN.state.view.kind === VIEW; render();
        refill(); const c0 = count(T.DOZER); const tapped = F.clickButton('admin:summon:dozer') && count(T.DOZER) === c0 + 1;
        const q = oldSpot(kindOf('dozer')); if (q) changeTile(q.tx, q.ty, groundOf(q.under)); delete player.summoned;
        closePanel(); ADMIN.state.view = null;
        check(P + 'the Powers tab has a Summon a ride row; it opens a view with one button per ride (and Back), each inside the panel and clear of the others at phone, landscape phone, iPad (both ways) and laptop sizes, touch on and off, at least 44 px on touch; a tap on Bulldozer summons one', row && view && back && opened && tapped && hits.length === 0 && small.length === 0 && done.length === 20, { row, view, back, opened, tapped, hits: hits.slice(0, 10), small: small.slice(0, 10), done: done.length }); }
    } catch (e) {
      check(P + 'the summon self-test ran to the end without an exception', false, { error: String((e && e.stack) || e).slice(0, 800) });
    } finally {
      if (inPlace()) INSTANCES.leave();
      closePanel(); if (window.ADMIN) ADMIN.state.view = null;
      NET.disconnect(); NET.emit('offline', { t: 'offline' }); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null; NET.role = 'player';
      if (window.COOP) COOP.reset();
      S.pending.clear();
      // the ground, exactly as it was
      for (let i = 0; i < map.length; i++) if (map[i] !== was.map[i]) { map[i] = was.map[i]; miniDirtyTiles.add(i); }
      mapDiffs = was.diffs;
      if (window.PLAYERS) { for (const k of Object.keys(PLAYERS.remote)) if (!(k in was.remote)) delete PLAYERS.remote[k]; }
      player.horse = was.horse; if (was.summoned === undefined) delete player.summoned; else player.summoned = was.summoned;
      player.mech = was.mech; player.mechHp = was.mechHp; player.r = was.r; player.speed = was.speed; player.facing = was.facing; player.x = was.x; player.y = was.y;
      if (window.CLOUD && _reset) { CLOUD.reset = _reset; CLOUD.reset(); }
      if (window.LOGIN) LOGIN.playing = was.playing;
      window.__forceTouch = was.touch; try { window.innerWidth = was.vw; window.innerHeight = was.vh; } catch (e) { }
      h.peace(was.peace); paused = was.paused; notice = was.notice; dialog.cur = was.cur; dialog.queue.length = 0; dialog.queue.push(...was.queue); levelBanner = was.banner;
      save(); render();
    }
  });
}
