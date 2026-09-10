// ============================================================================
// THE GOBLINS DO NOT BUILD FENCES — owner: "the goblin thing — I think you have like a wall because they
// are against humans. More like a spiky wooden fence, like where they are sticking out of the ground almost."
// The camp east of Thistledown was ringed in the same paddock fencing as Dunstan's sheep. Goblins do not
// plane rails and hang gates. They fell trees, sharpen one end, drive the other into the ground at whatever
// angle the ground allows, lash the row together with rope and let the points lean out at whoever is coming.
// So the camp ring gets its own tile: stakes, not rails. Nothing else in the world changes — Thistledown's
// curtain wall (57-townwall) is stone and stays stone, and the Duke's paddocks stay paddocks.
// What the tile does follows from what it is made of:
//   * it is wood, so the bulldozer blade goes through it (22-bulldozer's DOZER_FLATTENS), drops a log and
//     leaves splintered stubs you can walk over — until the goblins drive fresh stakes back in.
//   * it is spikes, so shoving into it on foot costs a little health and says so in words a ten-year-old
//     reads. It never takes your last point of health: a fence is a warning, not an execution.
// The three ways in that other files already cut — the west gate lane (02-world), the vaultable split
// (55-riding) and the Agility-25 climb (38-agility) — are not fence tiles, so converting fence leaves every
// one of them exactly as it was. The south road gap is not fence either.
// Feature file: registers through HOOKS only, edits no core file. window.PALISADE exposes the tally.
// ============================================================================
{
  // ---------- the tiles ----------
  // Sharpened stakes driven into churned earth: solid, wooden, and unpleasant to walk into.
  const T_PAL = addTile('PALISADE', { solid: true, tex: 'dirt', mini: '#7a3f24' });
  // What the blade leaves behind: snapped stubs and splinters. NOT solid — the machine drives on through the
  // hole it just made, and so can the knight, until the wall is re-staked.
  const T_BROKEN = addTile('PALISADE_BROKEN', { tex: 'dirt', mini: '#5a4530' });
  const PAL_REGROW = 180;       // seconds before the goblins drive fresh stakes into the gap
  const PRICK_DMG = 2, PRICK_EVERY = 1.5, HINT_EVERY = 14;

  // the iPad: a tap on a wall walks you up beside it instead of trying to use it, and the label is plain words
  if (typeof TAP_WALLS !== 'undefined') TAP_WALLS.add(T_PAL);
  if (typeof TAP_NAMES !== 'undefined') { TAP_NAMES.PALISADE = 'Spiked fence'; TAP_NAMES.PALISADE_BROKEN = 'Smashed spikes'; }

  // ---------- world-gen: the camp ring becomes stakes ----------
  // Runs after 38-agility, 55-riding and the world blend, so it converts what is actually standing rather
  // than re-deriving the rectangle. Only T.FENCE is taken: every opening those files cut is left alone.
  const ring = { laid: 0, x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0 };
  HOOKS.world.push((rnd, api) => {
    ring.laid = 0;
    const camp = REGIONS.find(r => r.name === 'Goblin Camp');
    if (!camp) return;
    const cells = [];
    for (let y = camp.y0; y <= camp.y1; y++) for (let x = camp.x0; x <= camp.x1; x++) if (api.tileAt(x, y) === T.FENCE) cells.push([x, y]);
    if (!cells.length) return;
    ring.x0 = ring.x1 = cells[0][0]; ring.y0 = ring.y1 = cells[0][1];
    for (const [x, y] of cells) { if (x < ring.x0) ring.x0 = x; if (x > ring.x1) ring.x1 = x; if (y < ring.y0) ring.y0 = y; if (y > ring.y1) ring.y1 = y; }
    ring.cx = (ring.x0 + ring.x1) / 2; ring.cy = (ring.y0 + ring.y1) / 2;
    for (const [x, y] of cells) { api.setTile(x, y, T_PAL); ring.laid++; }
  });

  // ---------- the picture ----------
  // Which way the points lean: away from the middle of the camp, so every stretch of wall leans at whoever
  // is standing outside it. The dominant axis wins, so a wall leans out, not sideways along itself.
  const lean = (x, y) => {
    const hw = Math.max(1, (ring.x1 - ring.x0) / 2), hh = Math.max(1, (ring.y1 - ring.y0) / 2);
    const dx = (x - ring.cx) / hw, dy = (y - ring.cy) / hh;
    return Math.abs(dx) >= Math.abs(dy) ? { x: dx >= 0 ? 1 : -1, y: 0 } : { x: 0, y: dy >= 0 ? 1 : -1 };
  };
  // one fixed number per tile per slot, so a stake does not jitter between frames
  const hash = (x, y, k) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k, 1274126177)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1540483477) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const STAKES = 5;
  const drawPalisade = (g, x, y) => {
    const bx = x * TILE, by = y * TILE, L = lean(x, y);
    // the earth heaped round the feet, where each stake was hammered in
    g.fillStyle = '#3b2a17';
    g.beginPath(); g.ellipse(bx + TILE / 2, by + TILE - 8, 24, 9, 0, 0, 7); g.fill();
    const st = [];
    for (let i = 0; i < STAKES; i++) {
      const a = hash(x, y, i), b = hash(x, y, i + 17), c = hash(x, y, i + 33);
      const fx = bx + 6 + i * 9 + a * 4;                    // spread across the tile, never in a tidy row
      const fy = by + TILE - 8 + (b - 0.5) * 7;
      const hgt = 30 + a * 13;                              // 30-43 px of stake standing above the ground
      // the lean: hard outward across the wall, gentler along it (a stake leaning away is foreshortened, not
      // twice as tall), plus a couple of pixels of cant per stake so not one of them stands straight
      st.push({ fx, fy, tx: fx + L.x * (8 + b * 5) + (c - 0.5) * 5, ty: fy - hgt + L.y * (4 + a * 2), w: 3 + b * 1.6 });
    }
    const back = st.slice().sort((p, q) => p.fy - q.fy);    // the ones driven further back get painted first
    for (const s of back) {
      // the shaft: a wedge, thick where it enters the ground, pinched to nothing at the point
      g.fillStyle = '#4e3719';
      g.beginPath(); g.moveTo(s.fx - s.w, s.fy); g.lineTo(s.fx + s.w, s.fy); g.lineTo(s.tx + 1, s.ty); g.lineTo(s.tx - 1, s.ty); g.closePath(); g.fill();
      // a lit edge down one side, so it reads as a round pole and not a plank
      g.fillStyle = '#6f5027';
      g.beginPath(); g.moveTo(s.fx - s.w, s.fy); g.lineTo(s.fx - s.w * 0.3, s.fy); g.lineTo(s.tx + 0.2, s.ty); g.lineTo(s.tx - 1, s.ty); g.closePath(); g.fill();
      // the sharpened point, pale where the axe took the bark off
      g.fillStyle = '#c8a874';
      g.beginPath(); g.moveTo(s.tx - 2.4, s.ty + 8); g.lineTo(s.tx + 2.4, s.ty + 8); g.lineTo(s.tx, s.ty); g.closePath(); g.fill();
    }
    // two lashings of rope, binding a row of sticks into a wall
    g.strokeStyle = '#7d6a45'; g.lineWidth = 2; g.lineCap = 'round';
    for (const f of [0.3, 0.62]) {
      g.beginPath();
      for (let i = 0; i < st.length; i++) {
        const s = st[i], px = s.fx + (s.tx - s.fx) * f, py = s.fy + (s.ty - s.fy) * f;
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.stroke();
    }
    g.lineCap = 'butt';                                      // put the context back the way the render loop handed it over
  };
  const drawBroken = (g, x, y) => {
    const bx = x * TILE, by = y * TILE;
    g.fillStyle = '#3b2a17';
    g.beginPath(); g.ellipse(bx + TILE / 2, by + TILE - 12, 22, 10, 0, 0, 7); g.fill();
    for (let i = 0; i < 3; i++) {                            // three stubs, snapped off short
      const a = hash(x, y, i + 41), b = hash(x, y, i + 59);
      const sx = bx + 10 + i * 14 + a * 5, sy = by + TILE - 12 + (b - 0.5) * 8, hgt = 5 + a * 6;
      g.fillStyle = '#4e3719'; g.fillRect(sx - 2.5, sy - hgt, 5, hgt);
      g.fillStyle = '#c8a874'; g.fillRect(sx - 2.5, sy - hgt - 1.5, 5, 2);   // the raw splintered break
    }
    g.strokeStyle = '#5c421f'; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {                            // splinters thrown flat by the blade
      const a = hash(x, y, i + 71), b = hash(x, y, i + 89);
      const px = bx + 6 + a * 34, py = by + 12 + b * 28, ang = a * 6.283;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(ang) * 9, py + Math.sin(ang) * 4); g.stroke();
    }
    g.lineCap = 'butt';
  };
  // HOOKS.draw is (g, items, cam) and every pushed item's draw() takes no arguments.
  HOOKS.draw.push((g, items) => {
    if (!ring.laid) return;
    const x0 = Math.max(ring.x0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(ring.x1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(ring.y0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(ring.y1, Math.ceil((cam.y + VH) / TILE) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = tileAt(x, y);
      if (t !== T_PAL && t !== T_BROKEN) continue;
      // sorted on the foot of the stakes: a knight south of the wall walks in front of it, one north stands behind it
      const yy = y * TILE + TILE - 6;
      if (t === T_PAL) items.push({ y: yy, draw: () => drawPalisade(g, x, y) });
      else items.push({ y: yy, draw: () => drawBroken(g, x, y) });
    }
  });

  // ---------- the blade goes through it ----------
  // 22-bulldozer holds the rule that fences and gates are never flattened, and that rule stays: this is not a
  // fence. A plank falls to grass, a tree to a stump; sharpened stakes fall to splintered stubs, and the log
  // the goblins cut them from comes out. The gap closes again after PAL_REGROW seconds — the camp re-stakes
  // it — which needs the debris tile declared as ground a regrow may fire onto.
  if (typeof DOZER_FLATTENS !== 'undefined') DOZER_FLATTENS.set(T_PAL, { item: 'wood', leaves: T_BROKEN, regrow: PAL_REGROW });
  if (typeof REGROW_FROM !== 'undefined') REGROW_FROM.add(T_BROKEN);

  // ---------- the spikes bite ----------
  let prickT = 0, hintT = -1e9;
  HOOKS.newGame.push(() => { prickT = 0; hintT = -1e9; });
  HOOKS.update.push(dt => {
    if (prickT > 0) prickT = Math.max(0, prickT - dt);
    if (player.dead || paused || player.mech || !player.moving || prickT > 0) return;   // on foot, walking, and not already pricked
    const f = player.facing || { x: 1, y: 0 }, d = Math.hypot(f.x, f.y) || 1;
    const reach = player.r + 5;
    let hit = null;
    const x0 = Math.floor((player.x - reach) / TILE), x1 = Math.floor((player.x + reach) / TILE);
    const y0 = Math.floor((player.y - reach) / TILE), y1 = Math.floor((player.y + reach) / TILE);
    for (let ty = y0; ty <= y1 && !hit; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!inMap(tx, ty) || tileAt(tx, ty) !== T_PAL) continue;
      if (!circleHitsTile(player.x, player.y, reach, tx, ty)) continue;
      if ((tc(tx) - player.x) * (f.x / d) + (tc(ty) - player.y) * (f.y / d) <= 0) continue;  // only the wall you are walking INTO
      hit = { tx, ty }; break;
    }
    if (!hit) return;
    prickT = PRICK_EVERY;
    // a fence is a warning, not an execution: the last points of health are never taken by walking into wood
    if (player.hp > PRICK_DMG) hurtPlayer(PRICK_DMG, tc(hit.tx), tc(hit.ty), true);
    else { const kx = player.x - tc(hit.tx), ky = player.y - tc(hit.ty), kd = Math.hypot(kx, ky) || 1; moveEntity(player, kx / kd * 12, ky / kd * 12, playerWho()); }
    floatText(player.x, player.y - 34, 'Ouch! Sharp', '#ff9d6b', 14);
    burst(player.x, player.y, '#8b5a2b', 8, 60);
    if (time - hintT > HINT_EVERY) { hintT = time; notify('Those stakes are sharp. Go round to the gate, or drive the bulldozer straight through.'); }
  });

  window.PALISADE = {
    tile: T_PAL, broken: T_BROKEN, ring, STAKES, PRICK_DMG, PRICK_EVERY, REGROW: PAL_REGROW, lean, hash,
    resetPrick: () => { prickT = 0; hintT = -1e9; }, get prickCooldown() { return prickT; },
  };

  // ---------- self-test ----------
  const P = 'palisade: ';
  HOOKS.selfTest.push((check, F, h) => {
    const camp = REGIONS.find(r => r.name === 'Goblin Camp');
    // 1. the camp ring is stakes, no paddock fencing is left in it, and every way in is still a way in
    {
      let pal = 0, fence = 0;
      for (let y = camp.y0; y <= camp.y1; y++) for (let x = camp.x0; x <= camp.x1; x++) { const t = tileAt(x, y); if (t === T_PAL) pal++; else if (t === T.FENCE) fence++; }
      // the gate lane the world cut in the west wall: a run of tiles nobody has to climb
      let gate = 0;
      for (let y = ring.y0; y <= ring.y1; y++) if (!SOLID.has(tileAt(ring.x0, y))) gate++;
      // 55-riding's vaultable split and 38-agility's climb are still their own tiles, not stakes
      const vault = window.RIDING && RIDING.vault.ok ? tileAt(RIDING.vault.x, RIDING.vault.y) === RIDING.tile : false;
      const climb = tileAt(158, 30) !== T_PAL && SOLID.has(tileAt(158, 30));
      // and the camp is not sealed: you can still walk from the field outside to the middle of it
      let out = null, inside = null;
      for (let x = ring.x0 - 1; x >= ring.x0 - 6 && !out; x--) if (!SOLID.has(tileAt(x, Math.round(ring.cy)))) out = [x, Math.round(ring.cy)];
      for (let y = ring.y0 + 3; y <= ring.y1 - 3 && !inside; y++) for (let x = ring.x0 + 2; x <= ring.x1 - 2; x++) if (!SOLID.has(tileAt(x, y))) { inside = [x, y]; break; }
      const path = out && inside ? F.bfs(out[0], out[1], inside[0], inside[1]) : null;
      check(P + 'the goblin camp is ringed in sharpened stakes, not paddock fencing, and the gate, the vault split and the climb are all still open',
        pal >= 50 && fence === 0 && gate >= 3 && vault && climb && !!path && path.length > 0 && SOLID.has(T_PAL),
        { stakes: pal, fence, gateTiles: gate, vault, climb, ringSteps: path ? path.length : 'nopath', ring: [ring.x0, ring.y0, ring.x1, ring.y1] });
    }
    // 2. it stops you on foot, and shoving into it costs a little health
    let spot = null;
    for (let y = ring.y0 + 1; y <= ring.y1 - 1 && !spot; y++) {
      if (tileAt(ring.x0, y) !== T_PAL) continue;
      if (SOLID.has(tileAt(ring.x0 - 1, y)) || SOLID.has(tileAt(ring.x0 - 2, y))) continue;
      spot = { x: ring.x0, y };
    }
    {
      if (!spot) check(P + 'the stakes stop a knight on foot and shoving into them costs health', false, { spot: null });
      else {
        h.peace(true);
        const hp0 = player.hp, mech0 = player.mech; player.mech = null; player.hp = player.maxHp; PALISADE.resetPrick();
        F.tp(spot.x - 2, spot.y);
        F.sim(200, ['KeyD']);                                  // hold east straight into the wall for 3.3 s
        const stoppedAt = Math.floor(player.x / TILE), bled = player.maxHp - player.hp;
        const blocked = stoppedAt < spot.x && tileAt(spot.x, spot.y) === T_PAL;
        player.hp = hp0; player.mech = mech0; PALISADE.resetPrick(); h.peace(false);
        check(P + 'the stakes are solid: walking into them stops the knight outside the camp and takes a couple of hitpoints',
          blocked && bled >= PRICK_DMG && bled <= 10, { wall: [spot.x, spot.y], stoppedAt, bled, dmgPerPrick: PRICK_DMG });
      }
    }
    // 3. the message, the once-per-shove cooldown, and the floor that stops a fence killing anyone
    {
      if (!spot) check(P + 'the spikes say what they are in plain words and never take your last hitpoints', false, { spot: null });
      else {
        const hp0 = player.hp, mech0 = player.mech, moving0 = player.moving, face0 = player.facing;
        player.mech = null; player.hp = player.maxHp; PALISADE.resetPrick(); h.peace(true);
        const press = () => { player.facing = { x: 1, y: 0 }; player.moving = true; player.y = tc(spot.y); player.x = tc(spot.x) - TILE / 2 - player.r; };
        F.tp(spot.x - 1, spot.y); press(); notice = null;
        for (const u of HOOKS.update) u(1 / 60);
        const took = player.maxHp - player.hp;
        const told = !!notice && /sharp/i.test(notice.text) && /gate/i.test(notice.text);
        const hpAfter = player.hp; press();
        for (const u of HOOKS.update) u(1 / 60);
        const oncePerShove = player.hp === hpAfter;            // the same shove does not bleed you every frame
        PALISADE.resetPrick(); player.hp = PRICK_DMG; press();
        for (const u of HOOKS.update) u(1 / 60);
        const survives = player.hp === PRICK_DMG && !player.dead;
        player.hp = hp0; player.mech = mech0; player.moving = moving0; player.facing = face0; PALISADE.resetPrick(); h.peace(false);
        check(P + `walking onto the stakes costs ${PRICK_DMG} hitpoints, says so in plain words, only bites once per shove, and never takes your last two`,
          took === PRICK_DMG && told && oncePerShove && survives, { took, told, oncePerShove, survives, notice: notice && notice.text });
      }
    }
    // 4. the bulldozer smashes through, drops the log and leaves splinters you can drive over
    {
      const o = h.openSpot(56, 40), e = { x: tc(o.x), y: tc(o.y), r: 22 }, dir = { x: 1, y: 0 };
      const tx = o.x + 1, ty = o.y, was = tileAt(tx, ty), d0 = drops.length;
      changeTile(tx, ty, T_PAL);
      dozerPlow(e, dir, false);
      const smashed = tileAt(tx, ty) === T_BROKEN;
      const log = drops.slice(d0).some(dd => dd.id === 'wood');
      const restakes = regrow.some(r => r.i === idx(tx, ty) && r.t === T_PAL) && REGROW_FROM.has(T_BROKEN);
      const driveOn = !SOLID.has(T_BROKEN);
      // and the Duke's paddock fencing still holds, exactly as it did before: the blade takes stakes, not rails
      changeTile(tx, ty, T.FENCE); dozerPlow(e, dir, false); const fenceHolds = tileAt(tx, ty) === T.FENCE;
      changeTile(tx, ty, was); regrow = regrow.filter(r => r.i !== idx(tx, ty)); drops = drops.filter((dd, i) => i < d0);
      check(P + `the bulldozer blade smashes the stakes into splinters you can drive over, drops the log, and the camp re-stakes the gap after ${PAL_REGROW}s; paddock fencing still holds`,
        smashed && log && restakes && driveOn && fenceHolds, { smashed, log, restakes, driveOn, fenceHolds, at: [tx, ty] });
    }
    // 5. nothing outside the goblin camp was touched — Thistledown's curtain wall is still stone
    {
      let townStakes = 0, stone = 0;
      if (typeof VILLAGE !== 'undefined') for (let y = VILLAGE.y0; y <= VILLAGE.y1; y++) for (let x = VILLAGE.x0; x <= VILLAGE.x1; x++) {
        if (!(x === VILLAGE.x0 || x === VILLAGE.x1 || y === VILLAGE.y0 || y === VILLAGE.y1)) continue;
        const t = tileAt(x, y);
        if (t === T_PAL) townStakes++; else if (window.TOWNWALL && t === TOWNWALL.tile) stone++;
      }
      // not one stake outside the Goblin Camp region, and every other fence in the world still standing:
      // the paddocks, Dunstan's field, the agility yard and the goblins' own scrap yard over the water
      let stray = 0, fenceElsewhere = 0;
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
        const t = map[idx(x, y)], inCamp = x >= camp.x0 && x <= camp.x1 && y >= camp.y0 && y <= camp.y1;
        if (t === T_PAL && !inCamp) stray++;
        else if (t === T.FENCE && !inCamp) fenceElsewhere++;
      }
      const different = !window.TOWNWALL || TOWNWALL.tile !== T_PAL;
      check(P + "Thistledown's wall is untouched stone, no stake stands outside the goblin camp, and every other fence in the world is still a fence",
        townStakes === 0 && stone > 100 && stray === 0 && fenceElsewhere > 150 && different, { townStakes, townStone: stone, strayStakes: stray, fenceElsewhere, different });
    }
    { const o = h.openSpot(60, 30); F.tp(o.x, o.y); }   // do not leave the knight leaning on the camp wall for whatever runs next
  });
}
