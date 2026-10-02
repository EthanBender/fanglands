// ============================================================================
// RIDING THROUGH GATES — owner: "mounts should be able to pass through the gates at the main city"
// The rule itself is one line in the core (00-core solidFor): the knight on anything he rides collides as 'rider',
// which is a beast in every way but one — a GATE or a PORTCULLIS lets him through. 06-systems playerWho() hands
// out 'rider', so keys, tap-to-ride (17-tap paths with playerWho), Full Steam, the load-time safeSpot and the mount-up
// spot all follow it. Monsters stay 'beast' and stay out; a DOOR still stops a mount at every building.
//
// Why the PORTCULLIS rides too: both of them (Castle Thistledown's and Castle Gnash's) stand in a castle's curtain
// wall and open onto a cobbled yard, not into a room. They are gates in a wall. Each keep inside has its own DOOR,
// and that door still stops a mount.
//
// This file adds the one piece of movement a big body needs to use a gate the way a knight on foot does: a rider
// that catches the corner of a wall by a few pixels is eased round it. Measured at Thistledown: the gates are 3
// tiles (144 px) wide and the portcullis 2 tiles (96 px), so every mount fits (the widest, the Barrelbeast, is 52 px
// across). But the house just inside the west gate has its corner 24 px above the middle of the main street, and
// the castle's walls sit 24 px from the middle of each portcullis tile — the Barrelbeast (radius 26) rode straight
// down the street and stopped dead on that corner, 2 px short. Easing is at most EASE px, and every spot it moves
// the rider to is checked with the same collides() as any other step, so it can never take him past a wall.
// It also keeps a machine from being parked in a gateway (X while standing in a gate): see exitMech below.
// It also keeps a machine wrecked in a gateway from vanishing: see wreckMech below.
// Feature file: wraps moveEntity, exitMech and wreckMech by reassignment with explicit args; the moveEntity wrapper returns at
// once for anyone who is not a rider.
// Not changed, on purpose: the Barrelbeast (52 px across) is wider than any one-tile gap, so the one-tile pen gates
// do not take it, exactly as no one-tile gap between two fences does. The town's gates are three tiles and take it.
// ============================================================================
{
  const EASE = 8; // px: the furthest a rider is eased sideways round a corner he would otherwise catch on

  const move0 = moveEntity;
  // the blocked axis is the one he is mostly moving along; find the smallest sideways nudge (either way, up to EASE)
  // that frees it, take as much of it as one step allows, and finish the step when the nudge is done
  function ease(e, dx, dy, who) {
    const alongX = dx !== 0, d = alongX ? dx : dy, step = Math.max(1, Math.abs(d));
    for (let s = 1; s <= EASE; s++) for (const sg of [1, -1]) {
      const ox = alongX ? 0 : sg * s, oy = alongX ? sg * s : 0;
      if (collides(e.x + ox, e.y + oy, e.r, who)) continue;
      if (collides(e.x + ox + (alongX ? d : 0), e.y + oy + (alongX ? 0 : d), e.r, who)) continue;
      const k = Math.min(s, step);
      if (alongX) e.y += sg * k; else e.x += sg * k;
      if (k === s) { if (alongX) e.x += d; else e.y += d; }
      return true;
    }
    return false;
  }
  moveEntity = function (e, dx, dy, who) {
    if (who !== 'rider') { move0(e, dx, dy, who); return; }
    const x0 = e.x, y0 = e.y;
    move0(e, dx, dy, who);
    if (dx && e.x === x0 && Math.abs(dx) >= Math.abs(dy)) ease(e, dx, 0, who);
    else if (dy && e.y === y0 && Math.abs(dy) > Math.abs(dx)) ease(e, 0, dy, who);
  };

  // No getting down in a gateway. Climbing out parks the machine on a tile (06-systems exitMech: the tile ahead, or the
  // tile he is on when the one ahead will not take it). Parked on a gate it would replace the gate, and getting back in
  // turns that tile to plain dirt (enterMech): a hole in the town wall that any monster could walk through. So while
  // the knight's middle is on a gate tile, X / EXIT says to ride clear first and nothing changes. The mare needs no
  // guard: 51-mounts dismount only ever stands her on ground she can be put down on (PLACEABLE_ON), never on a gate.
  const inGateway = () => RIDE_THROUGH.has(tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE)));
  const exit0 = exitMech;
  exitMech = function () {
    if (player.mech && player.mech.kind !== 'horse' && inGateway()) { notify('You are in a gateway. Ride clear of it, then climb down.'); return; }
    exit0();
  };

  // A machine wrecked in a gateway. The core (06-systems wreckMech) leaves the wreck on the tile under the knight, but
  // only when that tile is plain ground (PLACEABLE_ON), and a gate is not: so in a gateway the machine just vanished,
  // while the Voice still promised it could be repaired (and 32-beast, finding no wreck, left the Barrelbeast called
  // "the walker"). So before the core runs, the knight is moved onto the plain tile beside the gate (the one behind
  // him first, then the nearer one) and turned to face it from the gate. The core then puts the wreck on that tile and
  // steps him back one tile, which is the gate itself (open to a knight on foot), so the wreck is right in front of
  // him: exactly where 32-beast looks to swap in the Barrelbeast's own wreck. The gate stays a gate.
  // The mare never wrecks (51-mounts: she bolts), so she is passed straight through.
  function wreckSpot() {
    const gx = Math.floor(player.x / TILE), gy = Math.floor(player.y / TILE);
    const fx = player.facing.x, fy = player.facing.y;
    const out = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const tx = gx + dx, ty = gy + dy;
      if (!inMap(tx, ty) || !PLACEABLE_ON.has(tileAt(tx, ty)) || insideBuilding(tx, ty)) continue;
      const far = Math.abs(dx) + Math.abs(dy) > 1 ? 1 : 0, behind = -(Math.sign(dx) * fx + Math.sign(dy) * fy);
      out.push({ tx, ty, ux: Math.sign(dx), uy: Math.sign(dy), far, behind, d: dist(player.x, player.y, tc(tx), tc(ty)) });
    }
    out.sort((a, b) => a.far - b.far || b.behind - a.behind || a.d - b.d);
    return out[0] || null;
  }
  const wreck0 = wreckMech;
  wreckMech = function () {
    if (player.mech && player.mech.kind !== 'horse' && inGateway()) {
      const s = wreckSpot();
      if (s) { player.x = tc(s.tx); player.y = tc(s.ty); player.facing = { x: s.ux, y: s.uy }; }
    }
    wreck0();
  };

  // the gates this file promises, read off the map (57-townwall keeps them as T.GATE on the town's west and east lines)
  function cityGates() {
    const out = [];
    for (const [side, x, dir] of [['west', VILLAGE.x0, 1], ['east', VILLAGE.x1, -1]]) {
      const rows = []; for (let y = VILLAGE.y0; y <= VILLAGE.y1; y++) if (tileAt(x, y) === T.GATE) rows.push(y);
      if (rows.length) out.push({ side, x, dir, rows, mid: rows[Math.floor(rows.length / 2)] });
    }
    return out;
  }
  window.MOUNTGATES = { EASE, cityGates, ride: RIDE_THROUGH, wreckSpot };

  // ---------- self-test ----------
  const P = 'mountgates: ';
  HOOKS.selfTest.push((check, F, h) => {
    const wasTouch = window.__forceTouch; window.__forceTouch = false;
    const dc = dialog.cur, dq = dialog.queue.slice(); dialog.cur = null; dialog.queue.length = 0; closePanel();
    if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
    h.peace(true); player.dead = false; player.deadT = 0; player.hp = player.maxHp;
    const keep = { mech: player.mech, r: player.r, speed: player.speed, x: player.x, y: player.y, body: player.equip.body, horse: player.horse ? JSON.parse(JSON.stringify(player.horse)) : player.horse, dozerUp: player.dozerUp ? { ...player.dozerUp } : player.dozerUp };
    const onFoot = () => { player.mech = null; player.r = 13; player.speed = 175; player.action = null; };
    onFoot(); player.equip.body = null;
    if (typeof tapCancel === 'function') tapCancel('manual');
    const drain = () => { dialog.cur = null; dialog.queue.length = 0; closePanel(); notice = null; };
    // a tile the checks borrow goes back exactly as it was, save diff and all
    const borrowed = [];
    const borrow = (tx, ty) => { const i = idx(tx, ty); borrowed.push({ tx, ty, t: tileAt(tx, ty), had: mapDiffs.has(i), d: mapDiffs.get(i) }); };
    const giveBack = () => { while (borrowed.length) { const b = borrowed.pop(); setTile(b.tx, b.ty, b.t); if (b.had) mapDiffs.set(idx(b.tx, b.ty), b.d); else mapDiffs.delete(idx(b.tx, b.ty)); } };

    // every mount there is, boarded the real way: its tile goes down where the knight stands and he gets on
    const KINDS = [
      { kind: 'walker', name: 'walker', board: (tx, ty) => { changeTile(tx, ty, T.MECH); enterMech(tx, ty); } },
      { kind: 'dozer', name: 'bulldozer', board: (tx, ty) => { changeTile(tx, ty, T.DOZER); enterDozer(tx, ty); } },
      { kind: 'beast', name: 'Barrelbeast', board: (tx, ty) => { changeTile(tx, ty, BEAST.tiles.BEAST); for (const f of HOOKS.use) if (f(BEAST.tiles.BEAST, tx, ty)) break; } },
      { kind: 'horse', name: 'mare', board: (tx, ty) => { changeTile(tx, ty, MOUNTS.tiles.HORSE); F.tp(tx - 1, ty); MOUNTS.mount(tx, ty); } },
    ];
    const kindNow = () => player.mech ? (player.mech.kind || 'walker') : null;
    const board = (K, tx, ty) => {
      onFoot(); borrow(tx, ty); F.tp(tx, ty); K.board(tx, ty); giveBack(); drain();
      F.tp(tx, ty); F.step([]);
      return kindNow() === K.kind;
    };
    const ride = (key, done, max = 1500) => { let s = 0; while (s < max && !done()) { F.sim(5, [key]); s += 5; } return done() ? s : 'stuck'; };
    const at = () => [+(player.x / TILE).toFixed(2), +(player.y / TILE).toFixed(2)];
    const gates = cityGates();

    // 0. the measure: every mount's body against every opening it has to use, and the wall tiles beside it
    { const rows = [];
      let fits = true;
      for (const g of gates) {
        const top = g.rows[0] * TILE, bot = (g.rows[g.rows.length - 1] + 1) * TILE;
        const solidAbove = solidFor(tileAt(g.x, g.rows[0] - 1), 'rider'), solidBelow = solidFor(tileAt(g.x, g.rows[g.rows.length - 1] + 1), 'rider');
        rows.push({ gate: g.side, rows: g.rows, widthPx: bot - top, walled: solidAbove && solidBelow });
        if (!(solidAbove && solidBelow)) fits = false;
      }
      const port = []; for (let x = CASTLE.x; x < CASTLE.x + CASTLE.w; x++) if (tileAt(x, CASTLE.y) === T.PORTCULLIS) port.push(x);
      rows.push({ gate: 'castle portcullis', cols: port, widthPx: port.length * TILE });
      const radii = { walker: 20, dozer: 22, beast: 26, horse: MOUNTS.R };
      for (const k in radii) for (const r of rows) if (2 * radii[k] >= r.widthPx) fits = false;
      check(P + 'every mount fits every Thistledown gate: the two town gates are 3 tiles (144 px) between stone, the castle portcullis 2 tiles (96 px); the widest mount is 52 px',
        gates.length === 2 && gates.every(g => g.rows.length === 3) && port.length === 2 && fits, { rows, radii }); }

    // 1. each mount, with keys: in through each town gate to the far side of the wall, and back out
    for (const K of KINDS) {
      const log = {};
      let ok = gates.length === 2;
      for (const g of gates) {
        const out = g.x - g.dir * 4, far = g.x + g.dir * 5;
        const up = board(K, out, g.mid);
        const inKey = g.dir > 0 ? 'KeyD' : 'KeyA', outKey = g.dir > 0 ? 'KeyA' : 'KeyD';
        const went = up ? ride(inKey, () => g.dir > 0 ? player.x >= tc(far) : player.x <= tc(far)) : 'no mount';
        const inside = at(), still = kindNow() === K.kind;
        const back = up ? ride(outKey, () => g.dir > 0 ? player.x <= tc(out) : player.x >= tc(out)) : 'no mount';
        log[g.side] = { up, went, inside, back, outside: at(), still, r: player.r };
        if (!(up && typeof went === 'number' && typeof back === 'number' && still && kindNow() === K.kind)) ok = false;
      }
      onFoot();
      check(P + `on the ${K.name}, the knight rides with the keys through the town's west and east gates to the far side of the wall, and back out`, ok, log);
    }

    // 2. and through the castle portcullis into the yard and back (the keep's own door is checked in 5)
    { const log = {}; let ok = true;
      const px = (() => { for (let x = CASTLE.x; x < CASTLE.x + CASTLE.w; x++) if (tileAt(x, CASTLE.y) === T.PORTCULLIS) return x; return -1; })();
      for (const K of KINDS) {
        const up = px >= 0 && board(K, px, CASTLE.y - 4);
        const went = up ? ride('KeyS', () => player.y >= tc(CASTLE.y + 2)) : 'no mount';
        const inside = at();
        const back = up ? ride('KeyW', () => player.y <= tc(CASTLE.y - 3)) : 'no mount';
        log[K.kind] = { up, went, inside, back };
        if (!(up && typeof went === 'number' && typeof back === 'number' && kindNow() === K.kind)) ok = false;
      }
      onFoot();
      check(P + 'every mount rides in under the castle portcullis to the yard and back out', ok, { portcullis: [px, CASTLE.y], ...log }); }

    // 3. tap-to-ride: a tap inside the town from outside a gate paths the mount through the gate (17-tap), and back out
    { const log = {}; let ok = gates.length === 2;
      // a tap on a person or a monster would talk or fight instead: take the first plain tile of a few
      const tapTo = (cands) => {
        tapCancel('manual'); tap.lastTap = null; render();
        for (const [tx, ty] of cands) {
          const sx = tc(tx) - cam.x, sy = tc(ty) - cam.y, pk = tapPick(sx, sy);
          if (!pk || pk.kind !== 'walk' || pk.tx !== tx || pk.ty !== ty) continue;
          pointerDown(sx, sy, 'mouse'); pointerUp('mouse');
          const started = tap.kind === 'walk' && !!player.walkPath && player.walkPath.length >= 3;
          let s = 0; while (s < 1500 && tap.path && tap.path.length) { F.step([]); s++; }
          F.step([]);
          const arrived = dist(player.x, player.y, tc(tx), tc(ty)) <= 14;
          tapCancel('manual');
          return { goal: [tx, ty], started, steps: s, arrived, at: at() };
        }
        return { goal: null };
      };
      for (const K of KINDS) {
        const r = {};
        for (const g of gates) {
          const out = g.x - g.dir * 4, inX = g.x + g.dir * 4;
          const up = board(K, out, g.mid);
          const tin = up ? tapTo([[inX, g.mid + 1], [inX + g.dir, g.mid + 1], [inX, g.mid], [inX + g.dir, g.mid]]) : { goal: null };
          const tout = up ? tapTo([[out, g.mid], [out, g.mid + 1], [out - g.dir, g.mid]]) : { goal: null };
          r[g.side] = { up, in: tin, out: tout };
          if (!(up && tin.started && tin.arrived && tout.started && tout.arrived && kindNow() === K.kind)) ok = false;
        }
        log[K.kind] = r;
      }
      onFoot();
      check(P + 'tap-to-ride: every mount taps through each town gate into Thistledown and back out again', ok, log); }

    // 4. a monster is still stopped by the same gate, and so is a knight-sized one pretending (no mount = no ride)
    { const log = {}; let ok = gates.length === 2;
      for (const g of gates) for (const type of ['goblin', 'boar', 'wolf']) {
        const def = MONSTER_DEFS[type]; if (!def) continue;
        const e = { x: tc(g.x - g.dir * 3), y: tc(g.mid), r: def.r };
        for (let k = 0; k < 200; k++) moveEntity(e, g.dir * 3, 0, 'beast');
        const edge = g.dir > 0 ? e.x + e.r <= g.x * TILE + 0.01 : e.x - e.r >= (g.x + 1) * TILE - 0.01;
        log[g.side + ' ' + type] = { stoppedAt: +(e.x / TILE).toFixed(2), r: def.r, edge };
        if (!edge) ok = false;
      }
      const gateSolid = solidFor(T.GATE, 'beast') && !solidFor(T.GATE, 'rider') && !solidFor(T.GATE, 'player') && solidFor(T.PORTCULLIS, 'beast') && !solidFor(T.PORTCULLIS, 'rider');
      check(P + 'a monster walking at a town gate is still stopped by it (goblin, boar, wolf); a gate is solid for beasts and open for riders', ok && gateSolid, { gateSolid, ...log }); }

    // 5. a mount still cannot enter a house: the house just inside the west gate, and the castle keep, for every mount
    { const log = {}; let ok = true;
      const house = BUILDINGS.find(b => b.door !== undefined && !b.coffin && tileAt(b.x + b.door, b.y + b.h - 1) === T.DOOR && tileAt(b.x + b.door, b.y + b.h) !== undefined && !solidFor(tileAt(b.x + b.door, b.y + b.h), 'rider') && !solidFor(tileAt(b.x + b.door, b.y + b.h + 1), 'rider') && inVillageBounds(tc(b.x), tc(b.y)));
      const keepB = BUILDINGS.find(b => b.id === 'keep' && b.doorTop !== undefined);
      const doors = [];
      if (house) doors.push({ name: house.name || house.id, door: [house.x + house.door, house.y + house.h - 1], from: [house.x + house.door, house.y + house.h + 1], key: 'KeyW', b: house });
      if (keepB) doors.push({ name: 'The Keep', door: [keepB.x + keepB.doorTop, keepB.y], from: [keepB.x + keepB.doorTop, keepB.y - 2], key: 'KeyS', b: keepB });
      for (const K of KINDS) for (const d of doors) {
        const up = board(K, d.from[0], d.from[1]);
        if (up) F.sim(150, [d.key]);
        const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
        const outside = !insideBuilding(tx, ty) && !collides(player.x, player.y, player.r, 'rider');
        const reachDoor = d.key === 'KeyW' ? player.y - player.r >= (d.door[1] + 1) * TILE - 0.01 : player.y + player.r <= d.door[1] * TILE + 0.01;
        log[K.kind + ' at ' + d.name] = { up, at: at(), outside, reachDoor };
        if (!(up && outside && reachDoor)) ok = false;
      }
      // Full Steam is the bulldozer's own run: it obeys the same rider rule, so it cannot barge in through a door either
      let steam = null;
      if (house && window.RIDING && RIDING.startSteam) {
        const up = board(KINDS[1], house.x + house.door, house.y + house.h + 1);
        player.facing = { x: 0, y: -1 }; RIDING.resetCool(); RIDING.startSteam(); F.sim(240, []); RIDING.resetCool();
        const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
        steam = { up, at: at(), inside: insideBuilding(tx, ty), door: tileAt(house.x + house.door, house.y + house.h - 1) === T.DOOR };
        if (!(up && !steam.inside && steam.door)) ok = false;
      }
      onFoot();
      check(P + 'a mount still cannot go in at a door: every mount is stopped at the house by the west gate and at the castle keep, and Full Steam stops there too',
        ok && doors.length === 2 && !!steam, { doors: doors.map(d => [d.name, d.door]), steam, ...log }); }

    // 6. a knight saved in the saddle standing in a gate loads in the gate, on his mount, not in a wall and not moved off it
    { const g = gates[0]; let r = { g: !!g };
      if (g) {
        const K = KINDS[2]; const up = board(K, g.x - g.dir * 3, g.mid);
        if (up) ride(g.dir > 0 ? 'KeyD' : 'KeyA', () => Math.floor(player.x / TILE) === g.x);
        const before = { x: player.x, y: player.y }, inGate = tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE)) === T.GATE;
        save(); const loaded = load(); F.step([]);
        const stayed = loaded && kindNow() === K.kind && Math.abs(player.x - before.x) < 1 && Math.abs(player.y - before.y) < 1;
        const clear = !collides(player.x, player.y, player.r, 'rider');
        r = { up, inGate, loaded, stayed, clear, before: [+(before.x / TILE).toFixed(2), +(before.y / TILE).toFixed(2)], after: at(), r: player.r };
      }
      onFoot();
      check(P + 'saved on the Barrelbeast in the middle of a gate, the knight loads right there, still riding and clear of the wall', !!r.up && r.inGate && r.stayed && r.clear, r); }

    // 7. online: our presence while we ride through, fed back as another knight, draws him passing through the gate
    { const g = gates[0]; let r = { g: !!g };
      if (g && window.PLAYERS && window.NET) {
        const K = KINDS[3]; const up = board(K, g.x - g.dir * 4, g.mid);
        const sent = []; let s = 0;
        while (up && s < 900 && !(g.dir > 0 ? player.x >= tc(g.x + g.dir * 5) : player.x <= tc(g.x + g.dir * 5))) { F.sim(8, [g.dir > 0 ? 'KeyD' : 'KeyA']); s += 8; sent.push(PLAYERS.presence()); }
        const name = 'MountGateTest';
        let crossed = false, beyond = false, drew = true, mech = null;
        for (const p of sent) {
          NET.emit('p', { ...p, n: name, role: 'player' }); F.step([]);
          const e = PLAYERS.remote[name]; if (!e) continue;
          mech = e.mech && e.mech.kind;
          if (Math.floor(e.shown.x / TILE) === g.x) crossed = true;
        }
        for (let k = 0; k < 30; k++) F.step([]);
        const e = PLAYERS.remote[name];
        beyond = !!e && (g.dir > 0 ? e.shown.x > (g.x + 1) * TILE : e.shown.x < g.x * TILE);
        try { render(); const items = []; for (const hk of HOOKS.draw) hk(ctx, items, cam); for (const it of items) if (it.who === name) it.draw(); } catch (err) { drew = String(err && err.message); }
        delete PLAYERS.remote[name];
        r = { up, sent: sent.length, crossed, beyond, drew, mech, at: e && [+(e.shown.x / TILE).toFixed(2), +(e.shown.y / TILE).toFixed(2)] };
      }
      onFoot();
      check(P + 'online: a friend sees a knight on the mare ride through the gate (the puppet crosses the wall line and is drawn)', !!r.up && r.sent >= 3 && r.crossed && r.beyond && r.drew === true && r.mech === 'horse', r); }

    // 8. no climbing out in a gateway: X in the middle of a gate keeps him riding and leaves the gate a gate (a machine
    // parked there would turn it to dirt when he got back in); one tile further in, X works as it always has
    { const g = gates[0]; const log = {}; let ok = !!g;
      const gateTiles = () => g.rows.every(y => tileAt(g.x, y) === T.GATE);
      for (const K of (g ? KINDS : [])) {
        const up = board(K, g.x - g.dir * 3, g.mid);
        if (up) ride(g.dir > 0 ? 'KeyD' : 'KeyA', () => Math.floor(player.x / TILE) === g.x);
        const inGate = Math.floor(player.x / TILE) === g.x;
        // everything round the gate is borrowed, so wherever a machine parks it goes back afterwards
        for (let y = g.mid - 4; y <= g.mid + 4; y++) for (let x = g.x - 4; x <= g.x + 4; x++) borrow(x, y);
        player.facing = { x: 0, y: -1 }; notice = null; F.press('KeyX'); F.step([]); F.step([]);
        const stayed = kindNow() === K.kind, said = !!notice && /gateway|No room/.test(notice.text), whole = gateTiles();
        let out = false;
        if (up && stayed) { ride(g.dir > 0 ? 'KeyD' : 'KeyA', () => Math.floor(player.x / TILE) === g.x + g.dir * 2); player.facing = { x: g.dir, y: 0 }; F.press('KeyX'); F.step([]); F.step([]); out = !player.mech; }
        const whole2 = gateTiles();
        giveBack(); drain();
        log[K.kind] = { up, inGate, stayed, said, whole, out, whole2 };
        if (!(up && inGate && stayed && said && whole && out && whole2)) ok = false;
        onFoot();
      }
      check(P + 'X in the middle of a town gate keeps the knight on every mount and the gate stays a gate; one tile into the town, X gets him down', ok, log); }

    // 9. a gate is a gate: every gate in the world (pens, the Grubmarket wall, the town) lets a rider through and stops a monster.
    // The mare (r 16), the walker (r 20) and the bulldozer (r 22) fit a one-tile gate (48 px); the Barrelbeast (r 26, 52 px
    // across) is wider than any one-tile gap, so only the town's three-tile gates take it (checked in 1).
    { const all = []; const seen = new Set();
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (map[idx(x, y)] === T.GATE && !seen.has(idx(x, y))) {
        const cells = []; const q = [[x, y]]; seen.add(idx(x, y));
        while (q.length) { const [cx, cy] = q.pop(); cells.push([cx, cy]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (inMap(nx, ny) && map[idx(nx, ny)] === T.GATE && !seen.has(idx(nx, ny))) { seen.add(idx(nx, ny)); q.push([nx, ny]); } } }
        all.push(cells);
      }
      const bad = [];
      for (const cells of all) {
        const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
        const across = Math.min(...xs) === Math.max(...xs) && cells.length > 1 ? 'x' : (cells.length > 1 ? 'y' : (solidFor(tileAt(xs[0], ys[0] - 1), 'rider') ? 'x' : 'y'));
        const mid = cells[Math.floor(cells.length / 2)];
        for (const r of [16, 20, 22, 13]) for (const sg of [1, -1]) {
          const who = r === 13 ? 'beast' : 'rider';
          // start two tiles out, or nearer where the ground before the gate is narrow (the agility course's gate has a fence a tile behind it)
          const back = [2, 1.5, 1].find(b => !collides(tc(mid[0]) - (across === 'x' ? sg * b * TILE : 0), tc(mid[1]) - (across === 'y' ? sg * b * TILE : 0), r, who));
          if (back === undefined) { bad.push({ at: mid, r, sg, why: 'no room to start' }); continue; }
          const e = { x: tc(mid[0]) - (across === 'x' ? sg * back * TILE : 0), y: tc(mid[1]) - (across === 'y' ? sg * back * TILE : 0), r };
          for (let k = 0; k < 64; k++) moveEntity(e, across === 'x' ? sg * 3 : 0, across === 'y' ? sg * 3 : 0, who);
          const pastLine = across === 'x' ? (sg > 0 ? e.x > (mid[0] + 1) * TILE : e.x < mid[0] * TILE) : (sg > 0 ? e.y > (mid[1] + 1) * TILE : e.y < mid[1] * TILE);
          if (pastLine !== (who === 'rider')) bad.push({ at: mid, r, who, sg, across, end: [+(e.x / TILE).toFixed(2), +(e.y / TILE).toFixed(2)] });
        }
      }
      check(P + 'every gate in the world lets the knight ride through it both ways on the mare, the walker and the bulldozer, and stops a monster',
        all.length >= 9 && !bad.length, { gates: all.length, bad: bad.slice(0, 8) }); }

    // 10. a machine wrecked in a gateway leaves its own wreck beside the gate (it can be repaired, as the Voice says), the gate
    // stays a gate, the knight is on his feet clear of the wall, and the Voice names the right machine. In each town gate
    // (the middle row, and the top row against the wall for the Barrelbeast) and under the castle portcullis.
    { const log = {}; let ok = gates.length === 2;
      const px = (() => { for (let x = CASTLE.x; x < CASTLE.x + CASTLE.w; x++) if (tileAt(x, CASTLE.y) === T.PORTCULLIS) return x; return -1; })();
      const spots = gates.map(g => ({ name: g.side + ' gate', tx: g.x, ty: g.mid, from: [g.x - g.dir * 3, g.mid], key: g.dir > 0 ? 'KeyD' : 'KeyA', hitFrom: [-g.dir, 0], cells: g.rows.map(y => [g.x, y]), t: T.GATE }));
      if (px >= 0) spots.push({ name: 'castle portcullis', tx: px, ty: CASTLE.y, from: [px, CASTLE.y - 3], key: 'KeyS', hitFrom: [0, -1], cells: [[px, CASTLE.y], [px + 1, CASTLE.y]], t: T.PORTCULLIS });
      else ok = false;
      if (gates[0]) spots.push({ ...spots[0], name: 'west gate, top row', ty: gates[0].rows[0], from: [gates[0].x - 3, gates[0].rows[0]], only: 'beast' });
      // and once with the blow landing between ticks, after 32-beast's hook has run (its line is then already showing)
      if (gates[1]) spots.push({ ...spots[1], name: 'east gate, blow between ticks', only: 'beast', between: true });
      const MACH = [{ K: KINDS[0], wreck: T.WRECK, line: /The walker gives out/ }, { K: KINDS[1], wreck: T.DOZER_WRECK, line: /The bulldozer gives out/ }, { K: KINDS[2], wreck: BEAST.tiles.BEAST_WRECK, line: /The Barrelbeast gives out/ }];
      const WRECKS = [T.WRECK, T.DOZER_WRECK, BEAST.tiles.BEAST_WRECK];
      for (const sp of spots) for (const M of MACH) {
        if (sp.only && sp.only !== M.K.kind) continue;
        const up = board(M.K, sp.from[0], sp.from[1]);
        // borrowed after boarding (board hands back everything borrowed so far), so the wreck goes away again afterwards
        for (let y = sp.ty - 4; y <= sp.ty + 4; y++) for (let x = sp.tx - 4; x <= sp.tx + 4; x++) borrow(x, y);
        if (up) ride(sp.key, () => Math.floor(player.x / TILE) === sp.tx && Math.floor(player.y / TILE) === sp.ty);
        const inGate = tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE)) === sp.t;
        drain();
        // a monster on the outside lands the last blow, inside a tick as a real one does
        const blow = () => { HOOKS.update.splice(HOOKS.update.indexOf(blow), 1); if (player.mech) { player.mech.hp = 1; hurtPlayer(30, player.x + sp.hitFrom[0] * 30, player.y + sp.hitFrom[1] * 30); } };
        if (up && inGate && sp.between) { HOOKS.update.unshift(blow); blow(); F.step([]); }
        else if (up && inGate) { HOOKS.update.unshift(blow); F.step([]); if (HOOKS.update.includes(blow)) HOOKS.update.splice(HOOKS.update.indexOf(blow), 1); }
        F.step([]);
        const said = [dialog.cur, ...dialog.queue].filter(Boolean).map(d => d.text).join(' | ');
        const found = [];
        for (let y = sp.ty - 4; y <= sp.ty + 4; y++) for (let x = sp.tx - 4; x <= sp.tx + 4; x++) if (WRECKS.includes(tileAt(x, y))) found.push({ at: [x, y], own: tileAt(x, y) === M.wreck, d: Math.max(Math.abs(x - sp.tx), Math.abs(y - sp.ty)) });
        const own = found.length === 1 && found[0].own && found[0].d <= 2;
        const whole = sp.cells.every(([x, y]) => tileAt(x, y) === sp.t);
        const clear = !player.mech && !player.dead && !collides(player.x, player.y, player.r, 'player');
        const named = M.line.test(said) && !(M.K.kind === 'beast' && /walker/.test(said));
        log[M.K.kind + ' in ' + sp.name] = { up, inGate, found, whole, clear, at: at(), said: said.slice(0, 90) };
        if (!(up && inGate && own && whole && clear && named)) ok = false;
        onFoot(); giveBack(); drain();
      }
      // and every gate and portcullis tile anywhere in the world has plain ground beside it for a wreck to land on
      const noSpot = []; let gateTiles = 0;
      { const sx = player.x, sy = player.y;
        for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (RIDE_THROUGH.has(map[idx(x, y)])) { gateTiles++; player.x = tc(x); player.y = tc(y); if (!wreckSpot()) noSpot.push([x, y]); }
        player.x = sx; player.y = sy; }
      log.world = { gateTiles, noSpot };
      if (noSpot.length || gateTiles < 9) ok = false;
      check(P + 'a walker, bulldozer or Barrelbeast wrecked in a town gate or under the portcullis leaves its own wreck beside the gate, the gate stays whole, and the Voice names the right machine; every gate tile in the world has ground beside it for a wreck', ok, log); }

    // put everything back
    giveBack(); onFoot(); if (typeof tapCancel === 'function') tapCancel('manual');
    player.mech = keep.mech; player.r = keep.r; player.speed = keep.speed; player.equip.body = keep.body;
    if (keep.horse === undefined) delete player.horse; else player.horse = keep.horse;
    if (keep.dozerUp !== undefined) player.dozerUp = keep.dozerUp;
    { const sp = safeSpot(keep.x, keep.y, player.r, playerWho()) || { x: keep.x, y: keep.y }; player.x = sp.x; player.y = sp.y; }
    dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq); window.__forceTouch = wasTouch; h.peace(false); notice = null; save();
  });
}
