// ============================================================================
// FEATURE: THE GOBLIN BULLDOZER — Colin's second machine
// A wide, low goblin engine: a wooden deck bound in iron, four iron-shod wheels, a boiler on the
// back and a plow blade as wide as a door on the front. It charges, and it flattens what it hits.
// Kill it → a wreck. Repair the wreck (4 iron bars + 6 goblin scrap) → drive it. Everything here
// registers through HOOKS; no core file is edited.
// ============================================================================

// ---------- tiles ----------
// The walker owns T.WRECK / T.MECH (repairMech / enterMech / exitMech in the core), so the bulldozer
// gets its own pair of tiles.
const T_DOZER_WRECK = addTile('DOZER_WRECK', { solid: true, tex: 'dirt', mini: '#6b6b7a' });
const T_DOZER = addTile('DOZER', { solid: true, tex: 'dirt', mini: '#6b6b7a' });

// ---------- monster ----------
// NOTE: deliberately NOT `mech: true` — the core's killMonster would place a walker T.WRECK, speak the
// walker's line and tick the walker quest flag. The bulldozer's wreck is placed in HOOKS.kill instead.
MONSTER_DEFS.bulldozer = {
  name: 'Goblin bulldozer', level: 14, r: 22, hp: 110, att: 15, maxHit: 10, def: 14, speed: 60, aggro: true, sight: 5 * TILE, respawn: 300,
  drops: { always: [['goblin_scrap', 3, 6], ['iron_ore', 1, 3]], table: [['iron_bar', 1, 2, 10], ['blast_powder', 1, 2, 8], ['coal', 1, 2, 6]], rare: { chance: 8, table: [['iron_warhammer', 1, 1, 1]] } },
};
const DOZER_CHARGE_EVERY = 5, DOZER_CHARGE_TIME = 1, DOZER_CHARGE_SPEED = 220;
const DOZER_HP = 110, DOZER_REPAIR = [['iron_bar', 4], ['goblin_scrap', 6]];

// two of them: one in the Goblin Camp, one roaming the fields (the thicket north of the road)
HOOKS.world.push((rnd, api) => { api.spawnList('bulldozer', [[146, 38], [70, 8]]); });

// ---------- flattening ----------
// What the blade flattens, and what falls out of it. Everything becomes grass.
const DOZER_FLATTENS = new Map([[T.PLANK, 'plank'], [T.FENCE, null], [T.GATE, null], [T.TREE, 'wood'], [T.OAK, 'oak_log'], [T.CROP, null]]);
// Probe a few points in front of the blade (two distances × three across, the blade is wide) and flatten
// what is there. byPlayer: loot goes to the pack (giveOrDrop) instead of the ground. Returns tiles flattened.
function dozerPlow(e, dir, byPlayer) {
  let n = 0;
  const sx = -dir.y, sy = dir.x; // across the blade
  for (const ahead of [e.r + 6, e.r + 22]) for (const side of [-14, 0, 14]) {
    const tx = Math.floor((e.x + dir.x * ahead + sx * side) / TILE), ty = Math.floor((e.y + dir.y * ahead + sy * side) / TILE);
    const t = tileAt(tx, ty);
    if (!DOZER_FLATTENS.has(t)) continue;
    if ((t === T.FENCE || t === T.GATE) && inVillageBounds(tc(tx), tc(ty))) continue; // Thistledown's fence holds; the guards would not like that
    changeTile(tx, ty, T.GRASS);
    burst(tc(tx), tc(ty), t === T.TREE || t === T.OAK ? '#3d8a38' : t === T.CROP ? '#5aa33e' : '#8b5a2b', 12, 90);
    if (t === T.CROP) crops = crops.filter(c => c.i !== idx(tx, ty));
    if (t === T.TREE || t === T.OAK) regrow.push({ i: idx(tx, ty), t, timer: 120 }); // the wood grows back, slowly
    const item = DOZER_FLATTENS.get(t);
    if (item) { if (byPlayer) giveOrDrop(item, 1, player.x, player.y); else drops.push({ x: tc(tx), y: tc(ty), id: item, qty: 1, t: 0 }); }
    n++;
  }
  return n;
}

// ---------- wreck, repair, enter ----------
HOOKS.kill.push(m => {
  if (m.type !== 'bulldozer') return;
  const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE);
  if (PLACEABLE_ON.has(tileAt(tx, ty))) changeTile(tx, ty, T_DOZER_WRECK);
  burst(m.x, m.y, '#8f96a3', 20, 140);
  say('The bulldozer shudders to a halt, boiler hissing. The goblin driver leaps off and runs. The wreck stays. Four iron bars and six scrap could set it rolling again.', 'The Voice');
});
function repairDozer(tx, ty) {
  const short = DOZER_REPAIR.filter(([id, q]) => countItem(id) < q);
  if (short.length) { notify(`A wrecked goblin bulldozer. Repair needs ${DOZER_REPAIR.map(([id, q]) => `${q} ${ITEMS[id].name.toLowerCase()}`).join(' and ')} (you have ${DOZER_REPAIR.map(([id]) => countItem(id)).join(' and ')}).`); return; }
  for (const [id, q] of DOZER_REPAIR) removeItem(id, q);
  changeTile(tx, ty, T_DOZER); burst(tc(tx), tc(ty), '#ffb347', 24, 110); gainXp('crafting', 100);
  say('Wooden deck, iron bands, a boiler, and a plow blade as wide as a door. Goblin-built, knight-sized. Press E to climb on.', 'The Voice'); save();
}
function enterDozer(tx, ty) {
  changeTile(tx, ty, T.DIRT); player.mech = { hp: DOZER_HP, maxHp: DOZER_HP, kind: 'dozer' }; player.x = tc(tx); player.y = tc(ty); player.r = 22; player.speed = 130; player.action = null;
  notify('You are on the bulldozer. Drive into trees, fences and planks to flatten them. Space shoves. X climbs down.'); save();
}
HOOKS.use.push((t, tx, ty) => {
  if (t === T_DOZER_WRECK) { repairDozer(tx, ty); return true; }
  if (t === T_DOZER) { enterDozer(tx, ty); return true; }
  return false;
});

// ---------- update: charging bulldozers, the driven bulldozer, and the exit fix-up ----------
// Exit fix-up. The core handles X (exitMech) and mech death (wreckMech) before HOOKS.update runs, and both
// place WALKER tiles (T.MECH / T.WRECK) because they do not know about the bulldozer. So each tick while
// driving we remember where the player was (`dozerSnap`); the tick the mech goes away we work out which
// tile the core just placed and swap it for the bulldozer's own tile:
//   - exitMech places T.MECH on the player's own tile (then steps the player back one tile) or, if that
//     tile is placeable, on frontTile(player, 44). Own tile is checked first: the player was standing on
//     it, so it cannot have been a parked walker already.
//   - wreckMech places T.WRECK on the player's own tile and steps the player back one tile along facing,
//     so the wreck sits at (player + facing * TILE).
// Dying in the bulldozer loses it, exactly like the walker (die() clears player.mech, no tile).
let dozerWas = false, dozerSnap = null;
function afterDozerLeft(snap) {
  if (player.dead) return;
  const wx = Math.floor((player.x + player.facing.x * TILE) / TILE), wy = Math.floor((player.y + player.facing.y * TILE) / TILE);
  if (tileAt(wx, wy) === T.WRECK && dialog.queue.some(d => /walker gives out/.test(d.text))) {
    changeTile(wx, wy, T_DOZER_WRECK);
    dialog.queue = dialog.queue.filter(d => !/walker gives out/.test(d.text));
    say('The bulldozer gives out under you. It can be repaired again: iron bars and scrap.', 'The Voice');
    return;
  }
  const own = { tx: Math.floor(snap.x / TILE), ty: Math.floor(snap.y / TILE) };
  const ft = frontTile(snap, 44);
  const spot = tileAt(own.tx, own.ty) === T.MECH ? own : tileAt(ft.tx, ft.ty) === T.MECH ? ft : null;
  if (!spot) return;
  changeTile(spot.tx, spot.ty, T_DOZER);
  notify('You climb down. The bulldozer waits.'); save();
}
HOOKS.update.push(dt => {
  const inDozer = !!(player.mech && player.mech.kind === 'dozer');
  if (dozerWas && !inDozer && dozerSnap) afterDozerLeft(dozerSnap);
  if (inDozer && !player.dead) {
    if (player.moving) dozerPlow(player, player.facing, true); // a slow lumber machine: trees go into the pack as logs
    // the core's messages say "walker"; fix the ones it shows while the bulldozer is driven
    if (notice && /walker/i.test(notice.text)) notice.text = notice.text.replace(/walker/gi, 'bulldozer');
    for (const f of floaters) if (/\(walker\)$/.test(f.text)) f.text = f.text.replace('(walker)', '(bulldozer)');
  }
  dozerWas = inDozer; dozerSnap = inDozer ? { x: player.x, y: player.y, r: player.r, facing: { x: player.facing.x, y: player.facing.y } } : null;

  // bulldozer monsters: every 5 s of chasing, a 1 s straight-line charge that flattens what it touches
  for (const m of monsters) {
    if (m.type !== 'bulldozer' || m.dead) continue;
    if (m.chargeT > 0) {
      m.chargeT -= dt;
      const d = m.chargeDir;
      m.facing = { x: d.x, y: d.y };
      moveEntity(m, d.x * DOZER_CHARGE_SPEED * dt, d.y * DOZER_CHARGE_SPEED * dt, 'beast');
      dozerPlow(m, d, false);
      m.moving = true; m.walkT += dt * 20;
      if (!m.chargeHit && !player.dead && dist(m.x, m.y, player.x, player.y) < m.r + player.r + 4) {
        m.chargeHit = true;
        hurtPlayer(rint(6, 12), m.x, m.y, true);
        for (let k = 0; k < 6; k++) moveEntity(player, d.x * 10, d.y * 10, playerWho()); // shoved 60px, sliding until something stops it
        burst(player.x, player.y, '#8f96a3', 14, 130); floatText(player.x, player.y - 40, 'RAMMED', '#ffb347', 14);
      }
      // friendly fire: anything else on the blade's line is rammed once per charge — 6–12 through hitMonster (so a kill drops loot, source
      // 'monster' = no XP for the knight), then shoved 60px along the charge, not away from the knight, and left reeling for a moment
      m.rammed = m.rammed || [];
      for (const o of monsters) {
        if (o === m || o.dead || m.rammed.includes(o) || dist(m.x, m.y, o.x, o.y) >= m.r + o.r + 4) continue;
        m.rammed.push(o); hitMonster(o, rint(6, 12), 0, true, 'monster');
        if (!o.dead) { for (let k = 0; k < 6; k++) moveEntity(o, d.x * 10, d.y * 10, 'beast'); o.stunT = Math.max(o.stunT || 0, 0.4); floatText(o.x, o.y - o.r - 18, 'RAMMED', '#ffb347', 12); }
        burst(o.x, o.y, '#8f96a3', 10, 110);
      }
      if (m.chargeT <= 0) m.chargeT = 0;
      continue;
    }
    if (m.state === 'chase' && !(m.stunT > 0)) {
      m.chargeCd = (m.chargeCd === undefined ? DOZER_CHARGE_EVERY : m.chargeCd) - dt;
      if (m.chargeCd <= 0) {
        const dx = player.x - m.x, dy = player.y - m.y, d = Math.hypot(dx, dy) || 1;
        m.chargeCd = DOZER_CHARGE_EVERY; m.chargeT = DOZER_CHARGE_TIME; m.chargeDir = { x: dx / d, y: dy / d }; m.chargeHit = false; m.rammed = []; m.charges = (m.charges || 0) + 1;
        floatText(m.x, m.y - m.r - 30, 'CHARGE!', '#ff8a1a', 15); burst(m.x - dx / d * 24, m.y - dy / d * 24, '#a8875a', 12, 70);
      }
    } else m.chargeCd = DOZER_CHARGE_EVERY;
  }
});
HOOKS.newGame.push(() => { dozerWas = false; dozerSnap = null; });

// ---------- HUD: the core writes "Walker hp/max" for any mech; re-badge it while driving the bulldozer ----------
HOOKS.hud.push(g => {
  if (!player.mech || player.mech.kind !== 'dozer') return;
  g.font = '13px sans-serif'; g.textAlign = 'left';
  const label = `Bulldozer ${player.mech.hp}/${player.mech.maxHp}`;
  const w = Math.max(g.measureText(`Walker ${player.mech.hp}/${player.mech.maxHp}`).width, g.measureText(label).width);
  g.fillStyle = 'rgba(10,14,22,0.95)'; roundRect(g, 186, 47, w + 10, 19, 5); g.fill(); g.strokeStyle = 'rgba(255,179,71,0.35)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#ffb347'; g.fillText(label, 190, 60);
});

// ---------- art ----------
// Medieval goblin tech only: wood, iron bands, rivets, a boiler. Drawn around 0,0; the machine rotates to
// e.facing, the driver stays upright like every other rider. Wheels are seen from above as treads whose
// iron shoes scroll with e.walkT. pilot = a playerLook() for the knight; e.parked = nobody aboard.
function drawDozer(g, e, hurt, pilot) {
  const ang = Math.atan2(e.facing.y, e.facing.x), c = Math.cos(ang), s = Math.sin(ang);
  const rolling = e.moving || e.chargeT > 0, charging = e.chargeT > 0;
  const shudder = rolling ? Math.sin(e.walkT * 2.1) * 0.8 : 0;
  const lunge = e.attackT > 0 ? (1 - e.attackT / 0.22) * 10 : 0;
  g.save(); g.rotate(ang);
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(6, 6, 42, 30, 0, 0, 7); g.fill();
  if (charging) { g.fillStyle = 'rgba(168,135,90,0.45)'; for (let k = 0; k < 4; k++) { const ph = (time * 9 + k * 1.7) % 4; g.beginPath(); g.arc(-36 - ph * 6, (k - 1.5) * 12 + Math.sin(time * 7 + k) * 3, 4 + ph * 1.6, 0, 7); g.fill(); } }
  // axles + four wheels
  g.strokeStyle = '#3a3a42'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-14, -27); g.lineTo(-14, 27); g.moveTo(14, -27); g.lineTo(14, 27); g.stroke();
  const bandOff = (e.walkT * 4) % 7;
  for (const [wx, wy] of [[-14, -27], [14, -27], [-14, 27], [14, 27]]) {
    g.fillStyle = '#2f2a26'; roundRect(g, wx - 10, wy - 5, 20, 10, 4); g.fill();
    g.fillStyle = '#5a4a3a'; roundRect(g, wx - 9, wy - 3.5, 18, 7, 3); g.fill();
    g.strokeStyle = '#8f96a3'; g.lineWidth = 1.6;
    for (let b = 0; b < 3; b++) { const bx = wx - 10 + (b * 7 + bandOff) % 21; if (bx > wx - 9 && bx < wx + 9) { g.beginPath(); g.moveTo(bx, wy - 5); g.lineTo(bx, wy + 5); g.stroke(); } }
  }
  g.translate(shudder, 0);
  // hull: a low wooden deck bound with iron
  g.fillStyle = hurt ? '#ffb0b0' : '#7a4a2a'; roundRect(g, -30, -21, 52, 42, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.2; for (const oy of [-14, -7, 0, 7, 14]) { g.beginPath(); g.moveTo(-28, oy); g.lineTo(20, oy); g.stroke(); }
  g.strokeStyle = '#3a3a42'; g.lineWidth = 3; for (const ox of [-8, 12]) { g.beginPath(); g.moveTo(ox, -21); g.lineTo(ox, 21); g.stroke(); }
  g.fillStyle = '#c9ccd3'; for (const [rx, ry] of [[-8, -17], [-8, 17], [12, -17], [12, 17]]) { g.beginPath(); g.arc(rx, ry, 1.5, 0, 7); g.fill(); }
  // boiler on the back: riveted iron drum, firebox glow, smokestack
  g.fillStyle = '#5a5a62'; roundRect(g, -31, -13, 18, 26, 6); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(g, -29, -11, 5, 22, 3); g.fill();
  g.strokeStyle = '#3a3a42'; g.lineWidth = 2; g.beginPath(); g.moveTo(-31, -4); g.lineTo(-13, -4); g.moveTo(-31, 4); g.lineTo(-13, 4); g.stroke();
  g.fillStyle = `rgba(255,140,40,${0.5 + Math.sin(time * 6) * 0.2})`; g.fillRect(-16, -3, 4, 6);
  g.fillStyle = '#3a3a42'; g.beginPath(); g.arc(-22, -9, 4, 0, 7); g.fill(); g.fillStyle = '#1e1e24'; g.beginPath(); g.arc(-22, -9, 2, 0, 7); g.fill();
  // driver's bench
  g.fillStyle = '#5a3a1e'; roundRect(g, -6, -9, 12, 18, 3); g.fill();
  // push arms + the blade: a big angled iron plow, curved forward, riveted, worn bright at the edge
  g.strokeStyle = '#3a3a42'; g.lineWidth = 4; g.beginPath(); g.moveTo(10, -15); g.lineTo(27 + lunge, -22); g.moveTo(10, 15); g.lineTo(27 + lunge, 22); g.stroke();
  g.save(); g.translate(lunge, 0);
  g.fillStyle = '#4a4a52'; g.beginPath(); g.moveTo(24, -30); g.quadraticCurveTo(46, -18, 46, 0); g.quadraticCurveTo(46, 18, 24, 30); g.lineTo(28, 20); g.quadraticCurveTo(36, 10, 36, 0); g.quadraticCurveTo(36, -10, 28, -20); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(29, -23); g.quadraticCurveTo(41, -12, 41, 0); g.quadraticCurveTo(41, 12, 29, 23); g.stroke();
  g.strokeStyle = '#8f96a3'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(25, -29); g.quadraticCurveTo(46, -18, 46, 0); g.quadraticCurveTo(46, 18, 25, 29); g.stroke();
  g.fillStyle = '#c9ccd3'; for (const [rx, ry] of [[32, -18], [37, -7], [37, 7], [32, 18]]) { g.beginPath(); g.arc(rx, ry, 1.6, 0, 7); g.fill(); }
  g.restore();
  g.restore();
  // driver (screen space, upright): the knight, or a goblin in a leather cap with one goggle
  if (pilot) { g.save(); g.translate(0, -6); g.scale(0.7, 0.7); drawHuman(g, { facing: e.facing, hurtT: 0, attackT: 0 }, pilot); g.restore(); }
  else if (!e.parked) {
    const fx = e.facing.x, fy = e.facing.y;
    g.fillStyle = '#6fbf3f'; g.beginPath(); g.ellipse(0, -1, 7, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#8ad35a'; g.beginPath(); g.arc(0, -9, 6, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-5, -10); g.lineTo(-12, -14); g.lineTo(-5, -6); g.closePath(); g.moveTo(5, -10); g.lineTo(12, -14); g.lineTo(5, -6); g.closePath(); g.fill();
    g.fillStyle = '#4a3a2a'; g.beginPath(); g.arc(0, -11, 6.5, Math.PI, 0); g.fill();
    g.fillStyle = '#d62828'; g.beginPath(); g.arc(-2.2 + fx * 1.5, -9 + fy * 1.5, 1.3, 0, 7); g.arc(2.2 + fx * 1.5, -9 + fy * 1.5, 1.3, 0, 7); g.fill();
    g.fillStyle = '#c9ccd3'; g.beginPath(); g.arc(3, -12, 2.2, 0, 7); g.fill(); g.fillStyle = '#5a7aa0'; g.beginPath(); g.arc(3, -12, 1.2, 0, 7); g.fill();
  }
  // steam from the stack (stack sits at (-22,-9) in the rotated frame; steam rises in screen space)
  const stx = -22 * c + 9 * s, sty = -22 * s - 9 * c;
  for (let k = 0; k < (charging ? 4 : 2); k++) { const ph = (time * (charging ? 34 : 20) + k * 5) % 10; g.fillStyle = `rgba(220,220,230,${0.55 - ph * 0.045})`; g.beginPath(); g.arc(stx + Math.sin(time * 5 + k * 2) * 2.5, sty - 8 - ph, 3.2 + ph * 0.35, 0, 7); g.fill(); }
}
HOOKS.drawMonster.bulldozer = (g, e, hurt) => drawDozer(g, e, hurt, null);

function drawDozerTile(g, tx, ty, t) {
  const cx = tc(tx), cy = tc(ty);
  const e = { x: cx, y: cy, r: 22, facing: { x: 0, y: -1 }, hurtT: 0, attackT: 0, moving: false, walkT: 0, parked: true };
  g.save(); g.translate(cx, cy);
  if (t === T_DOZER_WRECK) { g.rotate(0.35); g.globalAlpha = 0.85; }
  drawDozer(g, e, false, null);
  if (t === T_DOZER_WRECK) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(-4, 6, 8, 0, 7); g.fill(); g.strokeStyle = '#2f2a26'; g.lineWidth = 3; g.beginPath(); g.moveTo(-18, 14); g.lineTo(-6, 26); g.moveTo(10, -4); g.lineTo(22, 10); g.stroke(); }
  g.restore();
  if (t === T_DOZER_WRECK) { g.fillStyle = 'rgba(80,80,90,0.5)'; g.beginPath(); g.arc(cx - 6 + Math.sin(time * 2) * 3, cy - 26 - (time * 12 % 10), 5, 0, 7); g.fill(); }
}
// Registered with unshift so this runs before other features' draw hooks: at that moment the last item
// in `items` is the core's player sprite (pushed just before HOOKS.draw runs). While driving the
// bulldozer the core would draw the WALKER sprite for the player (drawCharacter 'playermech'), so that
// item's draw is swapped for the bulldozer. If the last item is not the player's (another feature got
// in first), fall back to drawing the bulldozer just above it (y + 1) so it covers the walker underneath.
HOOKS.draw.unshift((g, items, cam) => {
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
  const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const t = tileAt(tx, ty); if (t === T_DOZER || t === T_DOZER_WRECK) items.push({ y: ty * TILE + TILE - 6, draw: () => drawDozerTile(g, tx, ty, t) }); }
  if (!player.dead && player.mech && player.mech.kind === 'dozer') {
    const draw = () => { g.save(); g.translate(player.x, player.y); drawDozer(g, player, player.hurtT > 0, playerLook()); g.restore(); };
    const last = items[items.length - 1];
    if (last && last.y === player.y + player.r) last.draw = draw;
    else items.push({ y: player.y + player.r + 1, draw });
  }
  if (!player.dead && !player.mech) { // use-highlight for the bulldozer tiles (the core only highlights its own INTERESTING tiles)
    const { tx, ty } = frontTile(player); const t = tileAt(tx, ty);
    if (t === T_DOZER || t === T_DOZER_WRECK) items.push({ y: 1e9, draw: () => { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); } });
  }
});

// ---------- self-test ----------
HOOKS.selfTest.push((check, F, h) => {
  const dz = monsters.filter(m => m.type === 'bulldozer');
  check('bulldozer: two spawn (camp + fields) with the right def', dz.length === 2 && dz.every(m => m.maxHp === 110 && m.r === 22 && m.speed === 60) && MONSTER_DEFS.bulldozer.level === 14 && MONSTER_DEFS.bulldozer.maxHit === 10 && MONSTER_DEFS.bulldozer.def === 14 && MONSTER_DEFS.bulldozer.sight === 5 * TILE && MONSTER_DEFS.bulldozer.respawn === 300 && !MONSTER_DEFS.bulldozer.mech,
    { n: dz.length, homes: dz.map(m => [Math.floor(m.home.x / TILE), Math.floor(m.home.y / TILE)]) });
  { let scrap = 0, ore = 0; for (let i = 0; i < 40; i++) { const b = drops.length; rollDrops(MONSTER_DEFS.bulldozer, -999, -999); const got = drops.slice(b); if (got.some(d => d.id === 'goblin_scrap' && d.qty >= 3 && d.qty <= 6)) scrap++; if (got.some(d => d.id === 'iron_ore')) ore++; } drops = drops.filter(d => d.x > 0); check('bulldozer: always drops 3-6 scrap + iron ore', scrap === 40 && ore === 40, { scrap, ore }); }
  // a flat grass lane (o.x-1 .. o.x+9, o.y-1 .. o.y+1) in the open fields south of the road, west of the animal pens
  const o = h.openSpot(56, 46);
  const natural = [T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.DIRT, T.STUMP, T.RUBBLE, T.SAND, T.SOIL];
  for (let yy = o.y - 1; yy <= o.y + 1; yy++) for (let xx = o.x - 1; xx <= o.x + 9; xx++) if (natural.includes(tileAt(xx, yy))) changeTile(xx, yy, T.GRASS);
  const laneClear = (() => { for (let yy = o.y - 1; yy <= o.y + 1; yy++) for (let xx = o.x - 1; xx <= o.x + 9; xx++) if (tileAt(xx, yy) !== T.GRASS) return false; return true; })();
  check('bulldozer: test lane is clear grass', laneClear, { o });
  const m = dz[0];
  // charge: plank two tiles ahead, knight five tiles ahead
  h.peace(true); F.tp(o.x + 5, o.y); player.facing = { x: -1, y: 0 }; player.action = null; player.hp = 200;
  m.dead = false; m.hp = m.maxHp; m.x = tc(o.x); m.y = tc(o.y); m.home = { x: m.x, y: m.y }; m.stunT = 0; m.chargeT = 0; m.chargeCd = 0.3; m.charges = 0; m.facing = { x: 1, y: 0 }; m.angry = true; m.attackCd = 0;
  changeTile(o.x + 2, o.y, T.PLANK); const planked = tileAt(o.x + 2, o.y) === T.PLANK;
  h.peace(false); m.state = 'chase'; F.sim(120, []);
  check('bulldozer: charge flattens a plank and rams the knight (sure hit + shove)', planked && tileAt(o.x + 2, o.y) === T.GRASS && m.charges >= 1 && player.hp < 200 && drops.some(d => d.id === 'plank'),
    { planked, tile: tileAt(o.x + 2, o.y), charges: m.charges, hp: player.hp, state: m.state, mx: +(m.x / TILE).toFixed(1), px: +(player.x / TILE).toFixed(1) });
  h.peace(true); player.hp = player.maxHp; m.chargeT = 0; drops = drops.filter(d => d.id !== 'plank');
  // kill → its own wreck tile
  F.tp(o.x + 3, o.y); player.facing = { x: 1, y: 0 }; m.hp = 1;
  for (let i = 0; i < 80 && !m.dead; i++) { m.x = player.x + 40; m.y = player.y; m.stunT = 0; m.chargeT = 0; m.state = 'idle'; player.attackCd = 0; F.press('Space'); F.sim(3, []); }
  const wt = F.nearestTile([T_DOZER_WRECK]);
  check('bulldozer: dies into a DOZER_WRECK tile (not a walker wreck)', m.dead && !!wt && wt.d < 2 * TILE && tileAt(wt.x, wt.y) === T_DOZER_WRECK && tileAt(wt.x, wt.y) !== T.WRECK, { dead: m.dead, wreck: wt && [wt.x, wt.y], expect: [o.x + 4, o.y] });
  if (wt) {
    // repair: 4 iron bars + 6 goblin scrap
    h.clearJunk(); const g1 = h.give('iron_bar', 4), g2 = h.give('goblin_scrap', 6); const b0 = countItem('iron_bar'), s0 = countItem('goblin_scrap');
    const ga = F.goAdjacent(wt.x, wt.y, 800); F.press('KeyE'); F.sim(2, []);
    const repaired = tileAt(wt.x, wt.y) === T_DOZER;
    check('bulldozer: repair the wreck with 4 bars + 6 scrap → DOZER tile', g1 === 0 && g2 === 0 && typeof ga === 'number' && repaired && countItem('iron_bar') === b0 - 4 && countItem('goblin_scrap') === s0 - 6, { ga, repaired, bars: countItem('iron_bar'), scrap: countItem('goblin_scrap') });
    // climb on
    F.face(wt.x, wt.y); F.press('KeyE'); F.sim(2, []);
    const piloting = !!player.mech && player.mech.kind === 'dozer' && player.mech.hp === 110 && player.r === 22 && player.speed === 130 && tileAt(wt.x, wt.y) === T.DIRT;
    check('bulldozer: climb on → player.mech.kind === "dozer"', piloting, { mech: player.mech, r: player.r, speed: player.speed });
    // drive into a tree: flattened to grass, one log in the pack
    changeTile(wt.x + 1, wt.y, T.TREE); const w0 = countItem('wood'); F.sim(60, ['KeyD']);
    check('bulldozer: driving flattens a tree → grass, +1 logs, regrows later', tileAt(wt.x + 1, wt.y) === T.GRASS && countItem('wood') === w0 + 1 && regrow.some(r => r.i === idx(wt.x + 1, wt.y) && r.t === T.TREE), { tile: tileAt(wt.x + 1, wt.y), wood: countItem('wood'), w0, px: +(player.x / TILE).toFixed(1) });
    // climb down with X: the core parks a walker tile, the fix-up turns it into a DOZER tile
    F.press('KeyX'); F.sim(2, []);
    const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
    const parked = nearestTileOfType(ptx, pty, T_DOZER, 2), walkerNear = nearestTileOfType(ptx, pty, T.MECH, 2);
    check('bulldozer: X climbs down → a DOZER tile (no walker tile), mech cleared', !player.mech && !!parked && !walkerNear && player.r === 13 && player.speed === 175 && !!notice && /bulldozer/.test(notice.text), { parked: parked && [parked.tx, parked.ty], walkerNear, r: player.r, notice: notice && notice.text });
  }
  h.peace(false);
});
