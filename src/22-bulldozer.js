// ============================================================================
// FEATURE: THE GOBLIN BULLDOZER — Colin's second machine
// A wide, low goblin engine: a wooden deck bound in iron, four iron-shod wheels, a boiler on the
// back and a plow blade as wide as a door on the front. It charges, and it flattens what it hits.
// Kill it → a wreck. Repair the wreck (4 iron bars + 6 goblin scrap) → drive it. Everything here
// registers through HOOKS. The core's exitMech / wreckMech (06) read player.mech.kind === 'dozer' and
// park T.DOZER / T.DOZER_WRECK themselves (addTile registers both names on T).
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
  name: 'Goblin bulldozer', level: 14, r: 22, hp: 110, att: 15, maxHit: 10, def: 14, speed: 60, aggro: true, sight: 5 * TILE, respawn: 3600,
  drops: { always: [['goblin_scrap', 3, 6], ['iron_ore', 1, 3]], table: [['iron_bar', 1, 2, 10], ['blast_powder', 1, 2, 8], ['coal', 1, 2, 6]], rare: { chance: 8, table: [['iron_warhammer', 1, 1, 1]] } },
};
const DOZER_CHARGE_EVERY = 5, DOZER_CHARGE_TIME = 1, DOZER_CHARGE_SPEED = 220;
const DOZER_HP = 110, DOZER_REPAIR = [['iron_bar', 4], ['goblin_scrap', 6]];
const DOZER_RAM_MIN = 3, DOZER_RAM_MAX = 6; // a goblin-driven charge on another monster: half of what the knight takes (6–12)

// two of them: one in the Goblin Camp, one roaming the fields (the thicket north of the road)
HOOKS.world.push((rnd, api) => { api.spawnList('bulldozer', [[146, 38], [70, 8]]); });

// ---------- flattening ----------
// "Only stone and wood": the blade takes planks, trees and rocks. Fences and gates (village, pens, Dunstan's field) hold everywhere.
// A tree leaves a stump and a rock leaves rubble, each with a regrow entry; the next pass of the blade grinds a stump or rubble flat
// (they are solid, so the machine could not drive on otherwise). What falls out: { item, leaves, regrow seconds }.
const DOZER_FLATTENS = new Map([
  [T.PLANK, { item: 'plank', leaves: T.GRASS }], [T.CROP, { item: null, leaves: T.GRASS }],
  [T.TREE, { item: 'wood', leaves: T.STUMP, regrow: 120 }], [T.OAK, { item: 'oak_log', leaves: T.STUMP, regrow: 120 }],
  [T.ROCK, { item: 'stone', leaves: T.RUBBLE, regrow: 120 }], // a goblin charge leaves the stone lying; the knight's blade pulverises it unless a drill is fitted (below)
  [T.STUMP, { item: null, leaves: T.GRASS }], [T.RUBBLE, { item: null, leaves: T.GRASS }],
]);
// ---------- upgrades (Cohen's design, fitted at the bay in 40-dozerup.js) ----------
// player.dozerUp = { drill, irondrill, ram, boiler } rides with the knight and applies to any bulldozer he drives.
//   drill:     rocks the blade touches are mined — stone into the pack + Mining xp, tile → rubble (regrows)
//   irondrill: iron and coal rocks too (the base blade cannot pass them at all)
//   ram:       Space hits twice as hard and shoves half again as far; a stump or rubble left by the blade is ground flat in the same pass
//   boiler:    speed 130 → 170, hp 110 → 180 on climbing on
const dozerUp = () => (player.dozerUp || {});
const DOZER_BOILER_HP = 180, DOZER_BOILER_SPEED = 170, DOZER_RAM_EXTRA_KNOCK = 23; // the core stomp knocks 46; ×1.5 = 69
const DOZER_DRILL = { [T.ROCK]: { item: 'stone', xp: 17, need: 'drill', label: 'A drill' }, [T.IRON]: { item: 'iron_ore', xp: 35, need: 'irondrill', label: 'An iron drill' }, [T.COAL]: { item: 'coal', xp: 50, need: 'irondrill', label: 'An iron drill' } };
let dozerHintT = -1e9;
function dozerHint(text) { if (time - dozerHintT < 4) return; dozerHintT = time; notify(text); }
// Probe a few points in front of the blade (two distances × three across, the blade is wide) and flatten
// what is there; each tile is touched once per call, so a tree becomes a stump on this pass and grass on the
// next. byPlayer: loot goes to the pack (giveOrDrop) instead of the ground. Returns tiles flattened.
function dozerPlow(e, dir, byPlayer) {
  let n = 0; const done = new Set();
  const up = byPlayer ? dozerUp() : {}; // the goblins' machines carry no upgrades
  const sx = -dir.y, sy = dir.x; // across the blade
  for (const ahead of [e.r + 6, e.r + 22]) for (const side of [-14, 0, 14]) {
    const tx = Math.floor((e.x + dir.x * ahead + sx * side) / TILE), ty = Math.floor((e.y + dir.y * ahead + sy * side) / TILE);
    const t = tileAt(tx, ty), key = idx(tx, ty), drill = byPlayer ? DOZER_DRILL[t] : null;
    let f = DOZER_FLATTENS.get(t);
    if (drill) {
      if (up[drill.need]) f = { item: drill.item, leaves: T.RUBBLE, regrow: 120, xp: drill.xp }; // the drill bites in: the ore goes into the pack, with Mining xp
      else { if (f) f = { ...f, item: null }; if (!done.has(key)) dozerHint(f ? 'The blade pulverises the rock. A drill would save the stone.' : `${drill.label} would bite into that ${GATHER[t] ? GATHER[t].label : 'rock'}.`); } // no drill: rock is smashed to rubble, the stone lost
    }
    if (!f || done.has(key)) continue;
    done.add(key);
    changeTile(tx, ty, f.leaves);
    if (up.ram && (f.leaves === T.STUMP || f.leaves === T.RUBBLE)) changeTile(tx, ty, T.GRASS); // ram plate: the stump or rubble is ground flat in the same pass
    burst(tc(tx), tc(ty), t === T.TREE || t === T.OAK ? '#3d8a38' : t === T.CROP ? '#5aa33e' : t === T.ROCK || t === T.RUBBLE || t === T.IRON || t === T.COAL ? '#9a9da5' : '#8b5a2b', 12, 90);
    if (t === T.CROP) crops = crops.filter(c => c.i !== idx(tx, ty));
    if (f.regrow) regrow.push({ i: key, t, timer: f.regrow }); // the wood and the rock come back, slowly (a regrow fires onto grass too)
    if (f.item) {
      if (byPlayer) { giveOrDrop(f.item, 1, player.x, player.y); if (f.xp) gainXp('mining', f.xp); }
      else drops.push({ x: tc(tx), y: tc(ty), id: f.item, qty: 1, t: 0 });
    }
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
  const up = dozerUp(), hp = up.boiler ? DOZER_BOILER_HP : DOZER_HP;
  changeTile(tx, ty, T.DIRT); player.mech = { hp, maxHp: hp, kind: 'dozer' }; player.x = tc(tx); player.y = tc(ty); player.r = 22; player.speed = up.boiler ? DOZER_BOILER_SPEED : 130; player.action = null;
  const fitted = ['drill', 'irondrill', 'ram', 'boiler'].filter(k => up[k]);
  notify(fitted.length ? `You are on the bulldozer (${fitted.map(k => ({ drill: 'drill', irondrill: 'iron drill', ram: 'ram plate', boiler: 'big boiler' })[k]).join(', ')}). Space shoves. X climbs down.` : 'You are on the bulldozer. Drive into trees, rocks and planks to flatten them. Space shoves. X climbs down.'); save();
}
// ram plate: the core stomp (Space, playerAttack) rolled its damage and knocked the target 46 px; the plate lands the same again and
// shoves half again as far. Runs inside hitMonster (HOOKS.hit fires before its kill check, so a doubled hit that drops the target
// to 0 is killed by the core once — never here). Only the stomp: attackT is exactly 0.22 on the tick Space fires, and the target is in reach.
HOOKS.hit.push((m, dmg, source) => {
  if (source !== 'player' || dmg <= 0 || m.dead || !player.mech || player.mech.kind !== 'dozer' || !dozerUp().ram || player.attackT !== 0.22) return;
  if (dist(player.x, player.y, m.x, m.y) > 70 + 46 + m.r + 8) return;
  m.hp -= dmg;
  const kx = m.x - player.x, ky = m.y - player.y, kd = Math.hypot(kx, ky) || 1;
  moveEntity(m, kx / kd * DOZER_RAM_EXTRA_KNOCK, ky / kd * DOZER_RAM_EXTRA_KNOCK, 'beast');
  floatText(m.x, m.y - m.r - 22, `-${dmg} RAM`, '#ffb347', 13); burst(m.x, m.y, '#8f96a3', 8, 100);
});
HOOKS.use.push((t, tx, ty) => {
  if (t === T_DOZER_WRECK) { repairDozer(tx, ty); return true; }
  if (t === T_DOZER) { enterDozer(tx, ty); return true; }
  return false;
});

// ---------- update: charging bulldozers and the driven bulldozer ----------
// Climbing down (X → exitMech) and a wreck (wreckMech) are the core's: both read player.mech.kind and park
// T.DOZER / T.DOZER_WRECK for the bulldozer, with their own "bulldozer" lines. Dying in the bulldozer loses it,
// exactly like the walker (die() clears player.mech, no tile).
HOOKS.update.push(dt => {
  const inDozer = !!(player.mech && player.mech.kind === 'dozer');
  if (inDozer && !player.dead) {
    if (player.moving) dozerPlow(player, player.facing, true); // a slow lumber machine: trees go into the pack as logs
    // the core's messages say "walker"; fix the ones it shows while the bulldozer is driven
    if (notice && /walker/i.test(notice.text)) notice.text = notice.text.replace(/walker/gi, 'bulldozer');
    for (const f of floaters) if (/\(walker\)$/.test(f.text)) f.text = f.text.replace('(walker)', '(bulldozer)');
  }

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
      // friendly fire: anything else on the blade's line is rammed once per charge — at HALF the knight's 6–12 (3–6: the goblin driver
      // pulls up for his own kind, a little) through hitMonster (so a kill drops loot, source 'monster' = no XP for the knight), then
      // shoved 60px along the charge, not away from the knight, and left reeling for a moment
      m.rammed = m.rammed || [];
      for (const o of monsters) {
        if (o === m || o.dead || m.rammed.includes(o) || dist(m.x, m.y, o.x, o.y) >= m.r + o.r + 4) continue;
        m.rammed.push(o); hitMonster(o, rint(DOZER_RAM_MIN, DOZER_RAM_MAX), 0, true, 'monster');
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
// ---------- HUD: the core writes "Walker hp/max" for any mech; re-badge it while driving the bulldozer ----------
HOOKS.hud.push(g => {
  if (!player.mech || player.mech.kind !== 'dozer') return;
  g.font = '13px sans-serif'; g.textAlign = 'left';
  const label = `Bulldozer ${player.mech.hp}/${player.mech.maxHp}`;
  const w = Math.max(g.measureText(`Walker ${player.mech.hp}/${player.mech.maxHp}`).width, g.measureText(label).width);
  g.fillStyle = 'rgba(10,14,22,0.95)'; roundRect(g, 186, 47, w + 10, 19, 5); g.fill(); g.strokeStyle = 'rgba(255,179,71,0.35)'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#ffb347'; g.fillText(label, 190, 60);
  const up = dozerUp(), parts = [up.drill && (up.irondrill ? 'iron drill' : 'drill'), up.ram && 'ram', up.boiler && 'boiler'].filter(Boolean);
  if (parts.length) { const t = parts.join(' · '); g.font = 'bold 11px sans-serif'; const cw = g.measureText(t).width; g.fillStyle = 'rgba(10,14,22,0.95)'; roundRect(g, 186 + w + 16, 47, cw + 12, 19, 5); g.fill(); g.strokeStyle = 'rgba(59,111,182,0.7)'; g.stroke(); g.fillStyle = '#9cc4ff'; g.fillText(t, 192 + w + 16, 60); }
});

// ---------- art ----------
// Medieval goblin tech only: wood, iron bands, rivets, a boiler. Drawn around 0,0; the machine rotates to
// e.facing, the driver stays upright like every other rider. Wheels are seen from above as treads whose
// iron shoes scroll with e.walkT. pilot = a playerLook() for the knight; e.parked = nobody aboard.
// up = the fitted upgrades to show ({ drill, irondrill, ram, boiler }); only the driven machine carries them (they are the knight's, not the machine's).
function drawDozer(g, e, hurt, pilot, up = null) {
  const ang = Math.atan2(e.facing.y, e.facing.x), c = Math.cos(ang), s = Math.sin(ang);
  const bigBoiler = !!(up && up.boiler);
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
  // boiler on the back: riveted iron drum, firebox glow, smokestack (the big boiler upgrade: a fatter drum, three bands, a wider stack, a pressure dial)
  if (bigBoiler) {
    g.fillStyle = '#4e4e58'; roundRect(g, -35, -17, 24, 34, 8); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(g, -33, -15, 6, 30, 3); g.fill();
    g.strokeStyle = '#2e2e36'; g.lineWidth = 2.4; g.beginPath(); for (const oy of [-8, 0, 8]) { g.moveTo(-35, oy); g.lineTo(-11, oy); } g.stroke();
    g.fillStyle = '#c9ccd3'; for (const [rx, ry] of [[-31, -12], [-15, -12], [-31, 12], [-15, 12]]) { g.beginPath(); g.arc(rx, ry, 1.4, 0, 7); g.fill(); }
    g.fillStyle = `rgba(255,140,40,${0.6 + Math.sin(time * 8) * 0.25})`; g.fillRect(-16, -4, 5, 8);
    g.fillStyle = '#3a3a42'; g.beginPath(); g.arc(-24, -11, 5.5, 0, 7); g.fill(); g.fillStyle = '#1e1e24'; g.beginPath(); g.arc(-24, -11, 3, 0, 7); g.fill();
    g.fillStyle = '#e8e2c8'; g.beginPath(); g.arc(-24, 10, 3.2, 0, 7); g.fill(); g.strokeStyle = '#c0392b'; g.lineWidth = 1; g.beginPath(); g.moveTo(-24, 10); g.lineTo(-24 + Math.cos(time * 3) * 2.4, 10 + Math.sin(time * 3) * 2.4); g.stroke();
  } else {
    g.fillStyle = '#5a5a62'; roundRect(g, -31, -13, 18, 26, 6); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(g, -29, -11, 5, 22, 3); g.fill();
    g.strokeStyle = '#3a3a42'; g.lineWidth = 2; g.beginPath(); g.moveTo(-31, -4); g.lineTo(-13, -4); g.moveTo(-31, 4); g.lineTo(-13, 4); g.stroke();
    g.fillStyle = `rgba(255,140,40,${0.5 + Math.sin(time * 6) * 0.2})`; g.fillRect(-16, -3, 4, 6);
    g.fillStyle = '#3a3a42'; g.beginPath(); g.arc(-22, -9, 4, 0, 7); g.fill(); g.fillStyle = '#1e1e24'; g.beginPath(); g.arc(-22, -9, 2, 0, 7); g.fill();
  }
  // driver's bench
  g.fillStyle = '#5a3a1e'; roundRect(g, -6, -9, 12, 18, 3); g.fill();
  // push arms + the blade: a big angled iron plow, curved forward, riveted, worn bright at the edge
  g.strokeStyle = '#3a3a42'; g.lineWidth = 4; g.beginPath(); g.moveTo(10, -15); g.lineTo(27 + lunge, -22); g.moveTo(10, 15); g.lineTo(27 + lunge, 22); g.stroke();
  g.save(); g.translate(lunge, 0);
  g.fillStyle = '#4a4a52'; g.beginPath(); g.moveTo(24, -30); g.quadraticCurveTo(46, -18, 46, 0); g.quadraticCurveTo(46, 18, 24, 30); g.lineTo(28, 20); g.quadraticCurveTo(36, 10, 36, 0); g.quadraticCurveTo(36, -10, 28, -20); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(29, -23); g.quadraticCurveTo(41, -12, 41, 0); g.quadraticCurveTo(41, 12, 29, 23); g.stroke();
  g.strokeStyle = '#8f96a3'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(25, -29); g.quadraticCurveTo(46, -18, 46, 0); g.quadraticCurveTo(46, 18, 25, 29); g.stroke();
  g.fillStyle = '#c9ccd3'; for (const [rx, ry] of [[32, -18], [37, -7], [37, 7], [32, 18]]) { g.beginPath(); g.arc(rx, ry, 1.6, 0, 7); g.fill(); }
  if (up && up.ram) { // ram plate: a thick riveted iron slab bolted over the blade's face, two spikes at the corners
    g.fillStyle = '#2f2f38'; g.beginPath(); g.moveTo(30, -26); g.quadraticCurveTo(49, -16, 49, 0); g.quadraticCurveTo(49, 16, 30, 26); g.lineTo(33, 18); g.quadraticCurveTo(42, 9, 42, 0); g.quadraticCurveTo(42, -9, 33, -18); g.closePath(); g.fill();
    g.strokeStyle = '#8f96a3'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(31, -25); g.quadraticCurveTo(49, -16, 49, 0); g.quadraticCurveTo(49, 16, 31, 25); g.stroke();
    g.fillStyle = '#c9ccd3'; for (const [rx, ry] of [[36, -14], [42, -5], [42, 5], [36, 14]]) { g.beginPath(); g.arc(rx, ry, 1.8, 0, 7); g.fill(); }
    g.fillStyle = '#8f96a3'; g.beginPath(); g.moveTo(38, -22); g.lineTo(52, -26); g.lineTo(43, -15); g.closePath(); g.moveTo(38, 22); g.lineTo(52, 26); g.lineTo(43, 15); g.closePath(); g.fill();
  }
  if (up && up.drill) { // drill cone on the blade's nose: spinning stripes while rolling; the iron drill is steel-bright with teeth
    const iron = !!up.irondrill, spin = rolling ? (e.walkT * 6) % 8 : 0;
    g.fillStyle = iron ? '#d5d9e0' : '#6e6e78'; g.beginPath(); g.moveTo(44, -9); g.lineTo(66 + lunge * 0.5, 0); g.lineTo(44, 9); g.closePath(); g.fill();
    g.strokeStyle = iron ? '#5a5a62' : '#2e2e36'; g.lineWidth = 1.4; for (let k = 0; k < 3; k++) { const px = 46 + ((k * 8 + spin) % 20); const hw = 9 * (1 - (px - 44) / 22); g.beginPath(); g.moveTo(px, -hw); g.lineTo(px + 3, hw); g.stroke(); }
    if (iron) { g.fillStyle = '#3a3a42'; for (const [tx, ty] of [[50, -7], [56, -4], [50, 7], [56, 4]]) { g.beginPath(); g.arc(tx, ty, 1.3, 0, 7); g.fill(); } }
    g.fillStyle = '#3a3a42'; roundRect(g, 41, -5, 5, 10, 2); g.fill(); // the collar the cone turns in
  }
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
  for (let k = 0; k < (charging ? 4 : 2) + (bigBoiler ? 1 : 0); k++) { const ph = (time * (charging ? 34 : 20) + k * 5) % 10; g.fillStyle = `rgba(220,220,230,${0.55 - ph * 0.045})`; g.beginPath(); g.arc(stx + Math.sin(time * 5 + k * 2) * 2.5, sty - 8 - ph, 3.2 + ph * 0.35, 0, 7); g.fill(); }
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
    const draw = () => { g.save(); g.translate(player.x, player.y); drawDozer(g, player, player.hurtT > 0, playerLook(), dozerUp()); g.restore(); };
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
  check('bulldozer: two spawn (camp + fields) with the right def', dz.length === 2 && dz.every(m => m.maxHp === 110 && m.r === 22 && m.speed === 60) && MONSTER_DEFS.bulldozer.level === 14 && MONSTER_DEFS.bulldozer.maxHit === 10 && MONSTER_DEFS.bulldozer.def === 14 && MONSTER_DEFS.bulldozer.sight === 5 * TILE && MONSTER_DEFS.bulldozer.respawn === 3600 && !MONSTER_DEFS.bulldozer.mech,
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
    // climb on (no upgrades fitted here: 40-dozerup tests its own)
    const upSaved = player.dozerUp; player.dozerUp = null;
    F.face(wt.x, wt.y); F.press('KeyE'); F.sim(2, []);
    const piloting = !!player.mech && player.mech.kind === 'dozer' && player.mech.hp === 110 && player.r === 22 && player.speed === 130 && tileAt(wt.x, wt.y) === T.DIRT;
    check('bulldozer: climb on → player.mech.kind === "dozer"', piloting, { mech: player.mech, r: player.r, speed: player.speed });
    // drive into a tree: stump first, ground flat on the next pass, one log in the pack
    changeTile(wt.x + 1, wt.y, T.TREE); const w0 = countItem('wood'); F.sim(60, ['KeyD']);
    check('bulldozer: driving flattens a tree → stump → grass, +1 logs, regrows later', tileAt(wt.x + 1, wt.y) === T.GRASS && countItem('wood') === w0 + 1 && regrow.some(r => r.i === idx(wt.x + 1, wt.y) && r.t === T.TREE), { tile: tileAt(wt.x + 1, wt.y), wood: countItem('wood'), w0, px: +(player.x / TILE).toFixed(1) });
    // climb down with X: the core reads player.mech.kind and parks a DOZER tile
    F.press('KeyX'); F.sim(2, []);
    const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
    const parked = nearestTileOfType(ptx, pty, T_DOZER, 2), walkerNear = nearestTileOfType(ptx, pty, T.MECH, 2);
    check('bulldozer: X climbs down → a DOZER tile (no walker tile), mech cleared', !player.mech && !!parked && !walkerNear && player.r === 13 && player.speed === 175 && !!notice && /bulldozer/.test(notice.text), { parked: parked && [parked.tx, parked.ty], walkerNear, r: player.r, notice: notice && notice.text });
    player.dozerUp = upSaved;
  }
  h.peace(false);
});
