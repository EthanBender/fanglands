// ============================================================================
// FEATURE: THE BARRELBEAST, DRIVEN — Cohen's design
// Bring the Barrelbeast down in Hollowford (20-hollowford.js) and it leaves its own wreck. Six iron bars, ten goblin
// scrap and two blast powder put it back together, and the knight takes the goblins' seat: "an absolute beast".
// Driving it: Space rams (the core stomp, plus a 60 px shove along the spikes), B or the BOMB button lobs a bomb
// (every 4 s), X climbs down. No goblin crew rides it once the knight does; the wild boss keeps its crew.
// Follows 22-bulldozer.js exactly: own tiles, own exit fix-up, own sprite cover. Registers through HOOKS only.
// window.BEAST = { giveTile(tx, ty), lost() } is for Tinkerton's re-supply (another feature file).
// ============================================================================
{
  // ---------- tiles ----------
  // The walker owns T.WRECK / T.MECH in the core, the bulldozer has DOZER_WRECK / DOZER; the beast gets its own pair.
  const T_BEAST_WRECK = addTile('BEAST_WRECK', { solid: true, tex: 'dirt', mini: '#6a4022' });
  const T_BEAST = addTile('BEAST', { solid: true, tex: 'dirt', mini: '#6a4022' });
  const BEAST_HP = 300, BEAST_R = 26, BEAST_SPEED = 100, BOMB_CD = 4, BOMB_SPEED = 300, BOMB_LIFE = 0.7, RAM_SHOVE = 60;
  const BEAST_REPAIR = [['iron_bar', 6], ['goblin_scrap', 10], ['blast_powder', 2]];
  const HF = () => quest.hollowford || (quest.hollowford = { rewarded: false, beastKilled: false, wreck: null });
  const driving = () => !!(player.mech && player.mech.kind === 'beast');
  // runtime only (none of it needs saving: a reload puts the knight back on foot or in the mech with a cold chute)
  let bombCd = 0, beastWas = false, beastSnap = null, rams = 0, bombsLobbed = 0;

  // ---------- repair, enter ----------
  function repairBeast(tx, ty) {
    const short = BEAST_REPAIR.filter(([id, q]) => countItem(id) < q);
    if (short.length) { notify(`The wrecked Barrelbeast. Repair needs ${BEAST_REPAIR.map(([id, q]) => `${q} ${ITEMS[id].name.toLowerCase()}`).join(', ')} (you have ${BEAST_REPAIR.map(([id]) => countItem(id)).join(', ')}).`); return; }
    for (const [id, q] of BEAST_REPAIR) removeItem(id, q);
    changeTile(tx, ty, T_BEAST); burst(tc(tx), tc(ty), '#ffb347', 30, 130); burst(tc(tx), tc(ty), '#d8c8ff', 12, 90); gainXp('crafting', 200);
    say('Barrel, boiler, four iron legs, a bomb chute and a lightning rod. The goblins built it to flatten towns. Now it is yours. Press E to climb up.', 'The Voice'); save();
  }
  function enterBeast(tx, ty) {
    changeTile(tx, ty, T.DIRT);
    const spot = safeSpot(tc(tx), tc(ty), BEAST_R, 'beast') || { x: tc(tx), y: tc(ty) }; // it is wider than a tile: never embed it in the wall it was parked against
    player.mech = { hp: BEAST_HP, maxHp: BEAST_HP, kind: 'beast' }; player.x = spot.x; player.y = spot.y; player.r = BEAST_R; player.speed = BEAST_SPEED; player.action = null; bombCd = 0;
    notify('You are in the Barrelbeast. Space rams. B lobs a bomb. X climbs down.'); save();
  }
  HOOKS.use.push((t, tx, ty) => {
    if (t === T_BEAST_WRECK) { repairBeast(tx, ty); return true; }
    if (t === T_BEAST) { enterBeast(tx, ty); return true; }
    return false;
  });

  // ---------- ram and bomb ----------
  // The core stomp already rolled damage (+8 max hit for any mech) and knocked the target 46 px away from the knight.
  // The spiked front then shoves everything in front of it 60 px along the facing, sliding until something stops it, and leaves it reeling.
  function ram() {
    const fx = player.facing.x, fy = player.facing.y; let n = 0;
    for (const m of monsters) {
      if (m.dead) continue;
      const d = dist(player.x, player.y, m.x, m.y); if (d > 70 + 46 + m.r + 6) continue;
      const dot = ((m.x - player.x) * fx + (m.y - player.y) * fy) / (d || 1); if (dot < 0.3) continue;
      for (let k = 0; k < RAM_SHOVE / 10; k++) moveEntity(m, fx * 10, fy * 10, 'beast');
      m.stunT = Math.max(m.stunT || 0, 0.4); floatText(m.x, m.y - m.r - 18, 'RAMMED', '#ffb347', 12); burst(m.x, m.y, '#8f96a3', 10, 110); n++;
    }
    if (n) { rams += n; burst(player.x + fx * 44, player.y + fy * 44, '#8f96a3', 8, 90); }
    return n;
  }
  function lobBomb() {
    if (bombCd > 0) { notify(`The chute is reloading. ${bombCd.toFixed(1)}s.`); return false; }
    bombCd = BOMB_CD; bombsLobbed++;
    const fx = player.facing.x, fy = player.facing.y;
    projectiles.push({ kind: 'bomb', x: player.x + fx * 24, y: player.y + fy * 24, vx: fx * BOMB_SPEED, vy: fy * BOMB_SPEED, t: 0, life: BOMB_LIFE, owner: 'player' });
    burst(player.x + 14, player.y - 26, '#3a3a3a', 8, 70); sfx('swing');
    return true;
  }

  // ---------- update: the driven beast and the exit fix-up ----------
  // Exit fix-up, exactly as the bulldozer's. The core handles X (exitMech) and mech death (wreckMech) before HOOKS.update
  // runs, and both place WALKER tiles (T.MECH / T.WRECK) because they do not know about the beast. So each tick while
  // driving we remember where the player was (`beastSnap`); the tick the mech goes away we work out which tile the core
  // just placed and swap it for the beast's own tile:
  //   - exitMech places T.MECH on the player's own tile (then steps the player back one tile) or, if that tile is
  //     placeable, on frontTile(player, 44). Own tile is checked first: the player was standing on it.
  //   - wreckMech places T.WRECK on the player's own tile and steps the player back one tile along facing, so the
  //     wreck sits at (player + facing * TILE); it also queues the walker's "gives out" line, which is our tell.
  // Dying in the beast loses it, exactly like the walker (die() clears player.mech, no tile) — BEAST.lost() then reports it.
  function afterBeastLeft(snap) {
    if (player.dead) return;
    const wx = Math.floor((player.x + player.facing.x * TILE) / TILE), wy = Math.floor((player.y + player.facing.y * TILE) / TILE);
    if (tileAt(wx, wy) === T.WRECK && dialog.queue.some(d => /walker gives out/.test(d.text))) {
      changeTile(wx, wy, T_BEAST_WRECK);
      dialog.queue = dialog.queue.filter(d => !/walker gives out/.test(d.text));
      say('The Barrelbeast gives out under you. It can be repaired again: iron bars, scrap and blast powder.', 'The Voice');
      return;
    }
    const own = { tx: Math.floor(snap.x / TILE), ty: Math.floor(snap.y / TILE) };
    const ft = frontTile(snap, 44);
    const spot = tileAt(own.tx, own.ty) === T.MECH ? own : tileAt(ft.tx, ft.ty) === T.MECH ? ft : null;
    if (!spot) return;
    changeTile(spot.tx, spot.ty, T_BEAST);
    notify('You climb down. The Barrelbeast waits.'); save();
  }
  HOOKS.update.push(dt => {
    const inBeast = driving();
    if (beastWas && !inBeast && beastSnap) afterBeastLeft(beastSnap);
    bombCd = Math.max(0, bombCd - dt);
    const bombTap = tapped('bomb'); // consumed even on foot so a stray tap never waits around for the next drive
    if (inBeast && !player.dead) {
      // the core stomp fired this tick: attackT was just set to its full 0.22 (it is decremented before the attack on every other tick)
      if (player.attackT === 0.22) ram();
      const blocked = panel && !['skills', 'quests', 'map'].includes(panel);
      if (!blocked && (pressed.has('KeyB') || bombTap)) lobBomb();
      // the core's messages say "walker"; fix the ones it shows while the beast is driven
      if (notice && /walker/i.test(notice.text)) notice.text = notice.text.replace(/walker/gi, 'Barrelbeast');
      for (const f of floaters) if (/\(walker\)$/.test(f.text)) f.text = f.text.replace('(walker)', '(beast)');
    }
    beastWas = inBeast; beastSnap = inBeast ? { x: player.x, y: player.y, r: player.r, facing: { x: player.facing.x, y: player.facing.y } } : null;
  });
  HOOKS.newGame.push(() => { beastWas = false; beastSnap = null; bombCd = 0; rams = 0; bombsLobbed = 0; });

  // ---------- HUD: re-badge the core's "Walker hp/max", show the chute, and a BOMB touch button ----------
  HOOKS.hud.push(g => {
    if (!driving()) return;
    g.font = '13px sans-serif'; g.textAlign = 'left';
    const label = `Barrelbeast ${player.mech.hp}/${player.mech.maxHp}`;
    const w = Math.max(g.measureText(`Walker ${player.mech.hp}/${player.mech.maxHp}`).width, g.measureText(label).width);
    g.fillStyle = 'rgba(10,14,22,0.95)'; roundRect(g, 186, 47, w + 10, 19, 5); g.fill(); g.strokeStyle = 'rgba(255,179,71,0.35)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#ffb347'; g.fillText(label, 190, 60);
    const ready = bombCd <= 0, chute = ready ? (isTouch ? 'BOMB ready' : 'B: bomb ready') : `${isTouch ? 'BOMB' : 'B: bomb'} ${bombCd.toFixed(1)}s`;
    g.font = 'bold 11px sans-serif'; const cw = g.measureText(chute).width;
    g.fillStyle = 'rgba(10,14,22,0.95)'; roundRect(g, 186 + w + 16, 47, cw + 12, 19, 5); g.fill(); g.strokeStyle = ready ? 'rgba(216,200,255,0.6)' : 'rgba(255,255,255,0.15)'; g.stroke();
    g.fillStyle = ready ? '#d8c8ff' : '#8b949e'; g.fillText(chute, 192 + w + 16, 60);
    if (isTouch) { // the HOME button's spot: it is hidden while in any mech
      const r = 52, x = VW - 160, y = VH - 254;
      g.fillStyle = ready ? 'rgba(216,200,255,0.22)' : 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(x, y, r / 2 + 8, 0, 7); g.fill();
      g.fillStyle = ready ? '#fff' : 'rgba(255,255,255,0.45)'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText(ready ? 'BOMB' : bombCd.toFixed(1), x, y + 4);
      buttons.push({ x: x - r / 2 - 8, y: y - r / 2 - 8, w: r + 16, h: r + 16, label: 'BOMB', action: () => touch.taps.push('bomb') });
    }
  });

  // ---------- art ----------
  // The sprite lives in 20-hollowford.js (HOOKS.drawMonster.barrelbeast); its fourth argument is the pilot look and
  // `e.parked` means nobody aboard. Cracks follow e.hp / e.maxHp, so the driven beast shows the mech's damage.
  const drawBeast = (g, e, hurt, pilot) => HOOKS.drawMonster.barrelbeast(g, e, hurt, pilot);
  const parkedEnt = (x, y, hp) => ({ x, y, r: BEAST_R, facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, moving: false, walkT: 0, hp, maxHp: BEAST_HP, rodGlow: 0, parked: true });
  function drawBeastTile(g, tx, ty, t) {
    const cx = tc(tx), cy = tc(ty), wreck = t === T_BEAST_WRECK;
    g.save(); g.translate(cx, cy + 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 22, 48, 16, 0, 0, 7); g.fill();
    g.scale(0.85, 0.85); if (wreck) { g.rotate(0.3); g.globalAlpha = 0.85; }
    drawBeast(g, parkedEnt(cx, cy, wreck ? 0 : BEAST_HP), false, null);
    if (wreck) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(-6, 4, 10, 0, 7); g.fill(); g.strokeStyle = '#2e2e36'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-30, 26); g.lineTo(-14, 40); g.moveTo(24, -2); g.lineTo(40, 14); g.stroke(); }
    g.restore();
    if (wreck) { g.fillStyle = 'rgba(80,80,90,0.5)'; g.beginPath(); g.arc(cx - 12 + Math.sin(time * 2) * 3, cy - 34 - (time * 12 % 10), 5, 0, 7); g.fill(); }
  }
  // Registered with unshift so this runs before other features' draw hooks: at that moment the last item in `items`
  // is the core's player sprite (pushed just before HOOKS.draw runs). While driving, the core would draw the WALKER
  // for the player (drawCharacter 'playermech'), so that item's draw is swapped for the beast. Tile items are spliced
  // in BEFORE the last item so the bulldozer's hook (which runs after this one) still finds the player entry last.
  HOOKS.draw.unshift((g, items, cam) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 2), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 2);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 2), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const t = tileAt(tx, ty); if (t === T_BEAST || t === T_BEAST_WRECK) items.splice(Math.max(0, items.length - 1), 0, { y: ty * TILE + TILE - 4, draw: () => drawBeastTile(g, tx, ty, t) }); }
    if (!player.dead && driving()) {
      const draw = () => {
        const e = { x: player.x, y: player.y, r: player.r, facing: player.facing, moving: player.moving, walkT: player.walkT, attackT: player.attackT, hurtT: player.hurtT, hp: player.mech.hp, maxHp: player.mech.maxHp, rodGlow: bombCd > 0 ? 0 : 0.35 };
        g.save(); g.translate(player.x, player.y);
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 22, 48, 16, 0, 0, 7); g.fill();
        g.scale(0.9, 0.9); drawBeast(g, e, player.hurtT > 0, playerLook()); g.restore();
      };
      const last = items[items.length - 1];
      if (last && last.y === player.y + player.r) last.draw = draw;
      else items.push({ y: player.y + player.r + 1, draw });
    }
    if (!player.dead && !player.mech) { // use-highlight for the beast tiles (the core only highlights its own INTERESTING tiles)
      const { tx, ty } = frontTile(player); const t = tileAt(tx, ty);
      if (t === T_BEAST || t === T_BEAST_WRECK) items.push({ y: 1e9, draw: () => { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); } });
    }
  });

  // ---------- re-supply API (Tinkerton, another feature file) ----------
  window.BEAST = {
    tiles: { BEAST: T_BEAST, BEAST_WRECK: T_BEAST_WRECK },
    // places a repaired BEAST tile at (tx, ty) if the ground allows it (or on a wreck); returns true when placed
    giveTile(tx, ty) {
      if (!inMap(tx, ty)) return false;
      const t = tileAt(tx, ty); if (!(PLACEABLE_ON.has(t) || t === T_BEAST_WRECK) || insideBuilding(tx, ty)) return false;
      changeTile(tx, ty, T_BEAST); burst(tc(tx), tc(ty), '#ffb347', 24, 110); save(); return true;
    },
    // true when the beast was killed, no BEAST / BEAST_WRECK tile exists anywhere, and the knight is not driving it
    lost() {
      if (driving() || !HF().beastKilled) return false;
      for (let i = 0; i < MAP_W * MAP_H; i++) { const t = map[i]; if (t === T_BEAST || t === T_BEAST_WRECK) return false; }
      return true;
    },
    get stats() { return { rams, bombsLobbed, bombCd }; },
  };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const hf = HF(), bb = monsters.find(m => m.type === 'barrelbeast'), def = MONSTER_DEFS.barrelbeast;
    check('beast: the Barrelbeast exists and its tiles registered', !!bb && T.BEAST === T_BEAST && T.BEAST_WRECK === T_BEAST_WRECK && typeof window.BEAST.lost === 'function', { found: !!bb });
    if (!bb) return;
    h.peace(true); projectiles = [];
    // a clear grass lane in the open fields: o.x-1 .. o.x+9, o.y-2 .. o.y+2
    const o = h.openSpot(66, 52);
    const natural = [T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.DIRT, T.STUMP, T.RUBBLE, T.SAND, T.SOIL];
    for (let yy = o.y - 2; yy <= o.y + 2; yy++) for (let xx = o.x - 1; xx <= o.x + 9; xx++) if (natural.includes(tileAt(xx, yy))) changeTile(xx, yy, T.GRASS);
    const wake = hp => { hf.beastKilled = false; bb.dead = false; bb.hp = hp; bb.x = tc(o.x + 5); bb.y = tc(o.y); bb.home = { x: bb.x, y: bb.y }; bb.state = 'idle'; bb.stunT = 0; bb.attackCd = 0; bb.angry = true; bb.facing = { x: -1, y: 0 }; bb.phase2 = false; bb.phase3 = false; bb.strikes = []; bb.enrage = 0; bb.volleys = 0; bb.strikeHits = 0; };
    const hp0 = player.hp;
    // 1. enrage: +1 max hit / +5% speed per 10% lost, capped +6 / +50%
    F.tp(o.x, o.y); player.hp = 5000; wake(bb.maxHp); F.sim(2, []); const mh0 = def.maxHit, sp0 = bb.speed;
    bb.hp = Math.floor(bb.maxHp * 0.85); F.sim(2, []); const mh1 = def.maxHit, sp1 = bb.speed, st1 = bb.enrage;
    bb.hp = 1; F.sim(2, []); const mh9 = def.maxHit, sp9 = bb.speed, st9 = bb.enrage;
    check('beast: enrage — +1 max hit and +5% speed per 10% hp lost, capped at +6 / +50%', mh0 === 16 && sp0 === 55 && st1 === 1 && mh1 === 17 && sp1 === Math.round(55 * 1.05) && st9 === 9 && mh9 === 22 && sp9 === Math.round(55 * 1.45), { mh0, sp0, mh1, sp1, st1, mh9, sp9, st9 });
    // 2. lightning: under 35% the rod charges (glows before a volley); a volley = 3 marks for 1.5 s, then bolts, 14–24 if you stand there
    wake(Math.floor(bb.maxHp * 0.3)); F.tp(o.x + 1, o.y); player.hp = 5000; player.hurtT = 0; F.sim(2, []);
    const humming = bb.phase3 === true; bb.voltCd = 0.5; F.sim(1, []); const glowBefore = bb.rodGlow > 0.5;
    bb.voltCd = 0.05; h.peace(false); F.sim(6, []); h.peace(true);
    const marks = bb.strikes.length, marked = marks === 3 && bb.strikes.every(s => !s.hit && s.t < 1.5), s0 = bb.strikes[0] && { x: bb.strikes[0].x, y: bb.strikes[0].y };
    if (s0) { player.x = s0.x; player.y = s0.y; }
    const hpBefore = player.hp; F.sim(100, []); const dmg = hpBefore - player.hp;
    check('beast: under 35% hp the rod glows, then 3 ground marks for 1.5 s, then bolts (14–24 if you stand on one)', humming && glowBefore && bb.volleys === 1 && marked && bb.strikeHits === 1 && dmg >= 14 && dmg <= 24 && bb.strikes.length === 0, { humming, glowBefore, volleys: bb.volleys, marks, marked, hits: bb.strikeHits, dmg });
    player.hurtT = 0; projectiles = [];
    // 3. kill → its own BEAST_WRECK tile (not the walker's T.WRECK); the earlier wreck is cleared so the kill places a fresh one here
    if (hf.wreck && [T_BEAST_WRECK, T.WRECK].includes(tileAt(hf.wreck[0], hf.wreck[1]))) changeTile(hf.wreck[0], hf.wreck[1], T.ASHES);
    hf.wreck = null; wake(1); F.tp(o.x + 2, o.y); player.facing = { x: 1, y: 0 };
    for (let i = 0; i < 80 && !bb.dead; i++) { bb.x = player.x + 60; bb.y = player.y; bb.stunT = 0; bb.state = 'idle'; player.attackCd = 0; F.press('Space'); F.sim(3, []); }
    const wt = hf.wreck && { x: hf.wreck[0], y: hf.wreck[1] };
    drops = drops.filter(d => dist(d.x, d.y, tc(o.x + 3), tc(o.y)) > 8 * TILE); // its loot pile lies where it fell; the bot must not pick up scrap on the way to the wreck
    const walkerWreckNear = !!nearestTileOfType(o.x + 3, o.y, T.WRECK, 3);
    check('beast: dies into a BEAST_WRECK tile (no walker T.WRECK), once', bb.dead && hf.beastKilled && !!wt && tileAt(wt.x, wt.y) === T_BEAST_WRECK && !walkerWreckNear && Math.abs(wt.x - (o.x + 3)) <= 2 && Math.abs(wt.y - o.y) <= 2 && def.maxHit === 16 && bb.speed === 55, { dead: bb.dead, wreck: wt, walkerWreckNear, maxHit: def.maxHit, speed: bb.speed });
    if (wt) {
      // 4. repair: 6 iron bars + 10 goblin scrap + 2 blast powder → BEAST tile
      h.clearJunk(); { let free = player.inv.filter(s => !s).length; for (let i = player.inv.length - 1; i >= 0 && free < 4; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour) { player.inv[i] = null; free++; } } }
      const g1 = h.give('iron_bar', 6), g2 = h.give('goblin_scrap', 10), g3 = h.give('blast_powder', 2); const b0 = countItem('iron_bar'), s0c = countItem('goblin_scrap'), p0 = countItem('blast_powder');
      const ga = F.goAdjacent(wt.x, wt.y, 800); F.press('KeyE'); F.sim(2, []); if (panel === 'salvage') { render(); F.clickButton('Repair it and drive it'); F.sim(2, []); }
      const repaired = tileAt(wt.x, wt.y) === T_BEAST;
      check('beast: repair the wreck with 6 bars + 10 scrap + 2 blast powder → BEAST tile', g1 === 0 && g2 === 0 && g3 === 0 && typeof ga === 'number' && repaired && countItem('iron_bar') === b0 - 6 && countItem('goblin_scrap') === s0c - 10 && countItem('blast_powder') === p0 - 2, { ga, repaired, bars: countItem('iron_bar'), scrap: countItem('goblin_scrap'), powder: countItem('blast_powder') });
      // 5. climb up
      F.face(wt.x, wt.y); F.press('KeyE'); F.sim(2, []);
      const piloting = driving() && player.mech.hp === BEAST_HP && player.mech.maxHp === BEAST_HP && player.r === BEAST_R && player.speed === BEAST_SPEED && tileAt(wt.x, wt.y) === T.DIRT;
      check('beast: climb up → player.mech.kind === "beast" (300 hp, r 26, speed 100)', piloting, { mech: player.mech, r: player.r, speed: player.speed, tile: tileAt(wt.x, wt.y) });
      // 6. ram: a goblin in front is shoved 60 px along the spikes (on top of the core's knockback) and left reeling
      const gob = monsters.find(m => m.type === 'goblin'); const gs = { x: gob.x, y: gob.y, dead: gob.dead, hp: gob.hp, state: gob.state };
      gob.dead = false; gob.hp = 999; gob.x = player.x + 44; gob.y = player.y; gob.stunT = 0; player.facing = { x: 1, y: 0 }; player.attackCd = 0; const gx0 = gob.x, r0 = rams;
      F.press('Space'); const shove = gob.x - gx0, reeling = gob.stunT > 0.3;
      check('beast: Space rams — a goblin in front is shoved 60 px (plus the stomp knockback) and reels', rams >= r0 + 1 && shove >= 60 && reeling && Math.abs(gob.y - player.y) < 2, { shove: +shove.toFixed(1), rams, reeling });
      gob.x = gs.x; gob.y = gs.y; gob.dead = gs.dead; gob.hp = gs.hp; gob.state = gs.state; gob.stunT = 0; gob.angry = MONSTER_DEFS.goblin.aggro;
      // 7. bomb lob: B lobs one bomb projectile (owner player, speed 300, life 0.7); a second press inside 4 s does nothing
      projectiles = []; const bl0 = bombsLobbed; F.press('KeyB'); const b1 = projectiles.filter(p => p.kind === 'bomb' && p.owner === 'player'); const cd1 = bombCd;
      F.press('KeyB'); const b2 = projectiles.filter(p => p.kind === 'bomb' && p.owner === 'player').length, lobbed1 = bombsLobbed - bl0;
      const good = b1.length === 1 && Math.abs(Math.hypot(b1[0].vx, b1[0].vy) - BOMB_SPEED) < 1 && b1[0].life === BOMB_LIFE;
      F.sim(60, []); bombCd = 0; F.press('KeyB'); const b3 = projectiles.filter(p => p.kind === 'bomb' && p.owner === 'player').length;
      check('beast: B lobs a bomb (speed 300, life 0.7, owner player) with a 4 s cooldown', good && cd1 > 3.9 && b2 === 1 && lobbed1 === 1 && b3 === 1 && bombsLobbed === bl0 + 2, { b1: b1.length, cd1, b2, b3, lobbed1, lobbed: bombsLobbed - bl0 });
      F.sim(60, []); projectiles = [];
      // 8. climb down with X: the core parks a walker tile, the fix-up turns it into a BEAST tile
      F.press('KeyX'); F.sim(2, []);
      const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
      const parked = nearestTileOfType(ptx, pty, T_BEAST, 2), walkerNear = nearestTileOfType(ptx, pty, T.MECH, 2);
      check('beast: X climbs down → a BEAST tile (no walker tile), mech cleared', !player.mech && !!parked && !walkerNear && player.r === 13 && player.speed === 175 && !!notice && /Barrelbeast/.test(notice.text), { parked: parked && [parked.tx, parked.ty], walkerNear, r: player.r, notice: notice && notice.text });
      // 9. BEAST.lost(): false while a BEAST tile stands, true once it is gone, false again after giveTile
      if (parked) {
        const lost0 = window.BEAST.lost(); changeTile(parked.tx, parked.ty, T.GRASS); const lost1 = window.BEAST.lost();
        const gave = window.BEAST.giveTile(parked.tx, parked.ty); const lost2 = window.BEAST.lost();
        check('beast: BEAST.lost() is true only when no BEAST / BEAST_WRECK tile exists; giveTile places one back', lost0 === false && lost1 === true && gave === true && tileAt(parked.tx, parked.ty) === T_BEAST && lost2 === false, { lost0, lost1, gave, lost2 });
      }
    }
    player.hp = Math.min(hp0, player.maxHp); player.hurtT = 0; h.peace(false); projectiles = [];
  });
}
