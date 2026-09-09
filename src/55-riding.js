// ============================================================================
// RIDING ALONG — three things the owner asked for while playing
//  A. "When you get on a dozer, your companion should hang off the back and ride on it with you — so if it's
//     Sera she rides with you and shoots arrows off of it." She keeps her own bow, her own rolls and her own
//     hurt; she just stops walking and holds on, which also means she stops being left behind by a machine.
//  B. "Add the chargeability to the dozer — it should have its regular attack and then a special attack."
//     Space is still the stomp. FULL STEAM (V, or the STEAM button) winds the boiler up and then barrels the
//     machine forward, flattening what the blade flattens and throwing anything alive out of the way.
//  C. "In the goblin outpost right beside the city, instead of a tree it should be an agility shortcut."
//     A crumbling stretch of the camp's west palisade — the side facing Thistledown — can be vaulted at
//     Agility 15, so the way in from the town is over the wall instead of the long walk round to the gate.
// Feature file: registers through HOOKS only, edits no core file. window.RIDING exposes the tables.
// ============================================================================
{
  // ---------- A. the companion rides ----------
  const comp = () => (player.companion && typeof player.companion === 'object' ? player.companion : null);
  const onMachine = () => !!player.mech;
  // She hangs off the SIDE, not the back. Behind the machine put her at a lower y when it faced north (so the
  // draw sort painted her on top of the roof) and a higher y when it faced south (so the machine painted over
  // her and she vanished underneath). Side-mounted, with a small downward bias, she is beside the hull at every
  // facing and always painted just after it — clinging to the rail, leaning out, rather than sitting on it.
  const RIDE_SIDE = 21, RIDE_BACK = 5, RIDE_DEPTH = 6;
  const riderOffset = () => {
    const f = player.facing || { x: 1, y: 0 };
    const d = Math.hypot(f.x, f.y) || 1;
    const fx = f.x / d, fy = f.y / d;
    const sx = -fy, sy = fx;                                  // ninety degrees off the line of travel
    const bob = player.moving ? Math.sin(time * 11) * 1.6 : 0; // she swings a little while it rolls
    return { x: player.x + sx * RIDE_SIDE - fx * RIDE_BACK, y: player.y + sy * RIDE_SIDE - fy * RIDE_BACK + RIDE_DEPTH + bob };
  };
  // 21-companion moves the hero in its own update; this file loads later, so its hook runs after and has the
  // last word on where she ends up. Nothing about her bow, her rolls or her hurt changes — she just holds on.
  HOOKS.update.push(() => {
    const c = comp();
    if (!c || !c.id) return;
    if (!onMachine() || c.mode === 'stay' || c.downT > 0) { if (c.riding) c.riding = false; return; }
    const p = riderOffset();
    c.x = p.x; c.y = p.y;
    if (!c.riding) { c.riding = true; burst(c.x, c.y, '#9fe0b0', 8, 50); }
  });
  // a step plate and a grab rail on the back of the machine, so she is standing on something
  HOOKS.draw.push((g, items) => {
    const c = comp();
    if (!c || !c.id || !c.riding || !onMachine()) return;
    const p = riderOffset();
    // a running board under her boots and a grab rail from the hull to her hands, so she reads as hanging on
    items.push({ y: p.y - 2, draw: () => {
      const f = player.facing || { x: 1, y: 0 }, d = Math.hypot(f.x, f.y) || 1;
      const fx = f.x / d, fy = f.y / d, sx = -fy, sy = fx;
      const bx = player.x + sx * 13, by = player.y + sy * 13 + 4;      // where the board meets the hull
      g.strokeStyle = '#4a4a52'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx, by + 4); g.lineTo(p.x, p.y + 5); g.stroke();          // the running board
      g.strokeStyle = '#9aa0a8'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(bx - fx * 4, by - 8); g.lineTo(p.x - fx * 2, p.y - 9); g.stroke();  // the rail she grips
      g.lineCap = 'butt';
    } });
  });

  // ---------- B. FULL STEAM: the dozer's special ----------
  const WIND = 1.0;              // seconds winding the boiler up before it goes
  const RUN = 1.15;              // seconds barrelling forward
  const SPEED = 430;             // pixels a second while it runs (the machine drives at 130-170)
  const COOL = 18, COOL_BOILER = 12;
  const HIT_DMG = [14, 22], HIT_KNOCK = 90;
  const drivingDozer = () => !!player.mech && player.mech.kind === 'dozer';
  const upg = () => (player.dozerUp || {});

  let sp = null, cool = 0;
  const ready = () => drivingDozer() && !sp && cool <= 0;
  HOOKS.newGame.push(() => { sp = null; cool = 0; });

  function startSteam() {
    if (!drivingDozer()) { notify('Full steam is a machine trick. Climb onto the bulldozer first.'); return; }
    if (sp) return;
    if (cool > 0) { notify(`The boiler is still building. ${Math.ceil(cool)}s.`); return; }
    const f = player.facing || { x: 1, y: 0 }, d = Math.hypot(f.x, f.y) || 1;
    sp = { phase: 'wind', t: 0, dir: { x: f.x / d, y: f.y / d }, hit: new Set(), moved: 0 };
    notify('Full steam. Hold on.');
    sfx('open');
  }
  HOOKS.keyHelp.push({ action: 'Full steam (on a bulldozer)', codes: ['KeyV'] });

  HOOKS.update.push(dt => {
    if (cool > 0) cool = Math.max(0, cool - dt);
    if (!sp) {
      if (drivingDozer() && (pressed.has('KeyV') || tapped('steam'))) { pressed.delete('KeyV'); startSteam(); }
      return;
    }
    if (!drivingDozer() || player.dead) { sp = null; return; }
    sp.t += dt;
    if (sp.phase === 'wind') {
      // it shakes and smokes, and it will not steer: the commitment is the point
      if (Math.random() < 0.6) burst(player.x - sp.dir.x * 18, player.y - sp.dir.y * 18, '#8a8f98', 3, 40);
      if (sp.t >= WIND) { sp.phase = 'run'; sp.t = 0; sfx('hurt'); }
      return;
    }
    // running: shove the machine along its line, flatten what the blade flattens, throw anything alive aside
    const step = SPEED * dt;
    const before = { x: player.x, y: player.y };
    moveEntity(player, sp.dir.x * step, sp.dir.y * step, 'player');
    sp.moved += Math.hypot(player.x - before.x, player.y - before.y);
    if (typeof dozerPlow === 'function') dozerPlow(player, sp.dir, true); // the blade clears its own path, upgrades and all
    for (const m of monsters) {
      if (m.dead || sp.hit.has(m)) continue;
      if (dist(m.x, m.y, player.x, player.y) > m.r + 30) continue;
      sp.hit.add(m);
      const dmg = rint(HIT_DMG[0], HIT_DMG[1]) + (upg().ram ? 8 : 0);
      hitMonster(m, dmg, HIT_KNOCK, false, 'player');
      burst(m.x, m.y, '#d29922', 12, 90);
    }
    if (Math.random() < 0.8) burst(player.x - sp.dir.x * 20, player.y - sp.dir.y * 20, '#6e7178', 2, 50);
    // it stops when the run is out, or when it has been stopped dead by something solid
    const stalled = sp.moved > 4 && Math.hypot(player.x - before.x, player.y - before.y) < step * 0.15;
    if (sp.t >= RUN || stalled) {
      for (const m of monsters) { // the slam at the end rattles everything close
        if (m.dead || dist(m.x, m.y, player.x, player.y) > 70) continue;
        m.stunT = Math.max(m.stunT || 0, 1.2);
      }
      burst(player.x, player.y, '#f5c542', 22, 130); sfx('mine');
      floatText(player.x, player.y - 40, stalled ? 'Dead stop' : 'Full steam', '#f5c542', 15);
      cool = upg().boiler ? COOL_BOILER : COOL;
      sp = null;
    }
  });

  // the on-screen button, so it works on an iPad, and a small state chip while it is live
  HOOKS.hud.push((g, narrow) => {
    if (!drivingDozer()) return;
    const w = 66, h = 30, x = narrow ? 12 : 12, y = Math.max(HUD_LAYOUT.hotbarY - 42, 120);
    const label = sp ? (sp.phase === 'wind' ? 'WIND' : 'GO') : cool > 0 ? `${Math.ceil(cool)}s` : 'STEAM';
    button(g, x, y, w, h, label, () => { touch.taps.push('steam'); }, sp ? '#d29922' : cool > 0 ? '#21262d' : '#8b2e2e', !sp && cool <= 0);
    if (sp) {
      const f = sp.phase === 'wind' ? sp.t / WIND : 1 - sp.t / RUN;
      g.fillStyle = '#21262d'; g.fillRect(x, y + h + 4, w, 5);
      g.fillStyle = sp.phase === 'wind' ? '#d29922' : '#f5c542';
      g.fillRect(x, y + h + 4, w * Math.max(0, Math.min(1, f)), 5);
    }
  });

  // ---------- C. over the palisade, on the town side ----------
  const VAULT_LV = 15, VAULT_XP = 70;
  const T_VAULT = addTile('PALISADE_VAULT', { solid: true, tex: 'grass', mini: '#8a6a3a' });
  INTERESTING_TILES.add(T_VAULT);
  const vault = { x: 0, y: 0, ok: false };

  HOOKS.world.push((rnd, api) => {
    // the camp's west wall is the side that faces Thistledown; pick a stretch of it clear of the gate
    const camp = REGIONS.find(r => r.name === 'Goblin Camp');
    if (!camp) return;
    let wx = -1;
    for (let x = camp.x0; x <= camp.x1 && wx < 0; x++) for (let y = camp.y0; y <= camp.y1; y++) if (api.tileAt(x, y) === T.FENCE) { wx = x; break; }
    if (wx < 0) return;
    for (const y of [26, 25, 27, 24, 35, 36]) {                     // clear of the gate lane at y 29-31
      if (api.tileAt(wx, y) !== T.FENCE) continue;
      const outside = api.tileAt(wx - 1, y), inside = api.tileAt(wx + 1, y);
      const open = t => t === T.GRASS || t === T.DIRT || t === T.SAND;
      if (!open(outside) || !open(inside)) continue;
      api.setTile(wx, y, T_VAULT);
      vault.x = wx; vault.y = y; vault.ok = true;
      return;
    }
  });

  HOOKS.use.push((t, tx, ty) => {
    if (t !== T_VAULT) return false;
    const lv = skillLv('agility');
    if (lv < VAULT_LV) { notify(`The palisade is split here, but it is a climb. Agility ${VAULT_LV} to vault it. You are ${lv}.`); return true; }
    // land on the far side of the wall, on the side you were not standing on
    const from = Math.floor(player.x / TILE) <= tx ? 1 : -1;
    const lx = tx + from, ly = ty;
    if (SOLID.has(tileAt(lx, ly))) { notify('There is no room to land on the other side.'); return true; }
    player.x = tc(lx); player.y = tc(ly);
    gainXp('agility', VAULT_XP); sfx('ui');
    floatText(player.x, player.y - 34, `Over! +${VAULT_XP} Agility xp`, '#7ee787', 15);
    burst(player.x, player.y, '#c9a36a', 12, 70); save();
    return true;
  });

  HOOKS.draw.push((g, items) => {
    if (!vault.ok || tileAt(vault.x, vault.y) !== T_VAULT) return;
    if (vault.x < cam.x / TILE - 2 || vault.x > (cam.x + VW) / TILE + 2) return;
    items.push({ y: tc(vault.y), draw: () => {
      const x = tc(vault.x), y = tc(vault.y);
      g.fillStyle = '#6b4f2a';
      for (const [ox, hgt] of [[-7, 16], [0, 11], [7, 15]]) g.fillRect(x + ox - 2, y + 8 - hgt, 4, hgt); // broken stakes, low in the middle
      g.strokeStyle = 'rgba(201,163,106,0.65)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x - 9, y - 4); g.lineTo(x + 9, y - 7); g.stroke();
    } });
  });

  if (HOOKS.xpSource) HOOKS.xpSource.push(add => add('agility', 'vault the goblin camp palisade (town side)', VAULT_LV, VAULT_XP, 5, 'a shortcut in from Thistledown instead of the walk to the gate'));

  window.RIDING = { riderOffset, WIND, RUN, SPEED, COOL, COOL_BOILER, HIT_DMG, VAULT_LV, VAULT_XP, vault, tile: T_VAULT, startSteam, get special() { return sp; }, get cooldown() { return cool; }, resetCool: () => { cool = 0; sp = null; } };

  // ---------- self-test ----------
  const P = 'riding: ';
  HOOKS.selfTest.push((check, F, h) => {
    // A. the companion holds on instead of being left behind
    { const c0 = player.companion ? JSON.parse(JSON.stringify(player.companion)) : null, m0 = player.mech, s0 = player.speed, r0 = player.r;
      player.companion = { id: 'sera', hp: 30, mode: 'follow', x: player.x - 300, y: player.y - 300, freed: { sera: true }, downT: 0 };
      player.mech = { kind: 'dozer', hp: 110, maxHp: 110 }; player.facing = { x: 1, y: 0 };
      for (const u of HOOKS.update) u(0.016);
      const c = player.companion, want = RIDING.riderOffset();
      const rides = c.riding === true && Math.abs(c.x - want.x) < 1 && Math.abs(c.y - want.y) < 1;
      const beside = Math.abs(c.y - player.y) > 12 && Math.abs(c.x - player.x) < 12; // facing east, so she is off one flank, not out the back
      const paintedAfter = c.y > player.y;                  // a greater sort y means the machine is painted first and never covers her
      player.mech = null;
      for (const u of HOOKS.update) u(0.016);
      const dismounts = player.companion.riding === false;
      player.companion = c0; player.mech = m0; player.speed = s0; player.r = r0;
      check(P + 'your companion hangs off the flank of the machine, painted over the hull rather than under it, and lets go when you climb down', rides && beside && paintedAfter && dismounts, { rides, beside, paintedAfter, dismounts, dx: Math.round(c.x - player.x), dy: Math.round(c.y - player.y) }); }
    // B. full steam winds up, runs, hurts what it hits, and goes on cooldown
    { const m0 = player.mech, s0 = player.speed, r0 = player.r, up0 = player.dozerUp;
      RIDING.resetCool();
      const o = h.openSpot(58, 36); F.tp(o.x, o.y);
      player.mech = { kind: 'dozer', hp: 110, maxHp: 110 }; player.r = 20; player.speed = 130; player.dozerUp = {};
      player.facing = { x: 1, y: 0 };
      // it refuses off a machine
      player.mech = null; notice = null; RIDING.startSteam();
      const refusedOnFoot = !RIDING.special && !!notice && /machine trick/i.test(notice.text);
      player.mech = { kind: 'dozer', hp: 110, maxHp: 110 };
      // a target squarely in the path
      const target = { type: 'goblin', dead: false, hp: 200, maxHp: 200, x: player.x + 90, y: player.y, r: 12, stunT: 0, def: 0, state: 'idle', home: { x: player.x + 90, y: player.y } };
      monsters.push(target);
      const x0 = player.x, hp0 = target.hp;
      RIDING.startSteam();
      const winding = !!RIDING.special && RIDING.special.phase === 'wind';
      for (let i = 0; i < 200 && RIDING.special; i++) for (const u of HOOKS.update) u(0.016);
      const ran = player.x - x0, hurt = hp0 - target.hp, cd = RIDING.cooldown > 0;
      // and it will not fire again until the boiler builds
      notice = null; RIDING.startSteam();
      const onCooldown = !RIDING.special && !!notice && /boiler is still building/i.test(notice.text);
      monsters.splice(monsters.indexOf(target), 1);
      RIDING.resetCool(); player.mech = m0; player.speed = s0; player.r = r0; player.dozerUp = up0;
      check(P + 'full steam winds the boiler up, barrels the machine forward, hurts what it runs into and then has to build again', refusedOnFoot && winding && ran > 60 && hurt >= 14 && cd && onCooldown, { refusedOnFoot, winding, ran: Math.round(ran), hurt, cd, onCooldown }); }
    // C. the palisade vault: refused below the level, and it puts you over the wall
    { const v = RIDING.vault;
      if (!v.ok) { check(P + 'a split in the camp palisade on the town side can be vaulted at Agility 15', false, { placed: false }); }
      else {
        const a0 = { ...player.skills.agility };
        const outside = v.x - 1, inside = v.x + 1;
        player.skills.agility.xp = 0;
        F.tp(outside, v.y); F.face(v.x, v.y);
        notice = null; for (const hk of HOOKS.use) if (hk(RIDING.tile, v.x, v.y)) break;
        const refused = Math.floor(player.x / TILE) === outside && !!notice && new RegExp('Agility ' + RIDING.VAULT_LV).test(notice.text);
        player.skills.agility.xp = XP_TABLE[RIDING.VAULT_LV];
        const xp0 = player.skills.agility.xp;
        for (const hk of HOOKS.use) if (hk(RIDING.tile, v.x, v.y)) break;
        const over = Math.floor(player.x / TILE) === inside, paid = player.skills.agility.xp - xp0 === RIDING.VAULT_XP;
        const tappable = INTERESTING_TILES.has(RIDING.tile), solid = SOLID.has(RIDING.tile);
        player.skills.agility = a0;
        check(P + 'a split in the camp palisade on the town side is refused below Agility 15 and vaults you inside at 15', refused && over && paid && tappable && solid, { at: [v.x, v.y], refused, over, paid, tappable, solid });
      } }
  });
}
