// ============================================================================
// UPDATE LOOP
// ============================================================================
function update(dt) {
  time += dt;
  if (pressed.has('Escape')) { if (panel) closePanel(); else paused = !paused; }
  if (!paused) {
    const toggle = name => panel === name ? closePanel() : openPanel(name);
    if (pressed.has('Tab')) toggle('skills');
    if (pressed.has('KeyI')) toggle('inventory');
    if (pressed.has('KeyC')) toggle('craft');
    if (pressed.has('KeyJ')) toggle('quests');
    if (pressed.has('KeyM')) toggle('map');
    if (pressed.has('Slash') || pressed.has('F1')) toggle('help');
    if (pressed.has('KeyH')) goHome();
    if (pressed.has('KeyX')) exitMech();
    if (pressed.has('Enter') && dialog.cur) advanceDialog();
    for (let k = 1; k <= 5; k++) if (pressed.has('Digit' + k)) useItem(k - 1);
  }
  if (paused) { pressed.clear(); return; }

  if (!dialog.cur && dialog.queue.length) { dialog.cur = dialog.queue.shift(); dialog.shown = 0; dialog.t = 0; }
  if (dialog.cur) { dialog.t += dt; dialog.shown = Math.min(dialog.cur.text.length, Math.floor(dialog.t * 34)); if (dialog.t > 2.4 + dialog.cur.text.length / 18) advanceDialog(); }
  if (notice) { notice.t -= dt; if (notice.t <= 0) notice = null; }
  if (levelBanner) { levelBanner.t -= dt; if (levelBanner.t <= 0) levelBanner = null; }
  if (areaBanner) { areaBanner.t -= dt; if (areaBanner.t <= 0) areaBanner = null; }
  introT += dt;
  if (quest.stage === 0 && introT > 1.4) advanceQuest(1);

  // world timers: regrowth, crops, fires
  let dirty = false;
  for (const r of regrow) { r.timer -= dt; if (r.timer <= 0) { const tx = r.i % MAP_W, ty = Math.floor(r.i / MAP_W); if (dist(player.x, player.y, tc(tx), tc(ty)) > 2.5 * TILE) { changeTile(tx, ty, r.t); r.done = true; dirty = true; } else r.timer = 5; } }
  if (dirty) regrow = regrow.filter(r => !r.done);
  for (const c of crops) { c.t += dt; if (c.stage < 3 && c.t > 40) { c.t = 0; c.stage += 1; } }
  for (const f of fires) { f.timer -= dt; if (f.timer <= 0 && !f.done) { const tx = f.i % MAP_W, ty = Math.floor(f.i / MAP_W); if (tileAt(tx, ty) === T.FIRE) changeTile(tx, ty, T.ASHES); regrow.push({ i: f.i, t: f.under === T.FLOOR ? T.DIRT : (f.under ?? T.DIRT), timer: 30 }); f.done = true; } }
  if (fires.some(f => f.done)) fires = fires.filter(f => !f.done);

  // region banner
  { const r = regionAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE)); if (r.name !== player.region) { const first = player.region !== null; player.region = r.name; if (first || r.name !== 'The Cave') areaBanner = { name: r.name, sub: r.sub, t: 3.2 }; } }

  // player
  if (player.dead) {
    player.deadT += dt;
    if (player.deadT > 2.6) {
      player.dead = false; player.hp = player.maxHp; player.facing = { x: 1, y: 0 }; player.r = 13; player.speed = 175;
      const sp = respawnPoint(); player.x = sp.x; player.y = sp.y;
      for (const m of monsters) { m.state = 'idle'; if (!MONSTER_DEFS[m.type].aggro) m.angry = false; }
      save();
    }
  } else {
    const iv = inputVector();
    const blocked = panel && !['skills', 'quests', 'map'].includes(panel);
    player.moving = iv.m > 0 && !blocked;
    if (player.moving) {
      player.facing = { x: iv.x, y: iv.y }; player.action = null;
      moveEntity(player, iv.x * player.speed * iv.m * dt, iv.y * player.speed * iv.m * dt, playerWho());
      player.walkT += dt * 9;
    }
    player.attackT = Math.max(0, player.attackT - dt); player.attackCd = Math.max(0, player.attackCd - dt); player.hurtT = Math.max(0, player.hurtT - dt);
    player.sinceHurt += dt;
    if (player.sinceHurt > 4 && player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + dt * 0.7);
    const a = player.action;
    if (a) {
      a.t += dt;
      if (a.t >= a.need) {
        if (a.type === 'fish') finishFishing();
        else if (a.type === 'chop' || a.type === 'mine') finishGather();
        else if (a.type === 'cook') finishCook();
        else if (a.type === 'light') finishLightFire();
        else if (a.type === 'till') finishTill();
        else if (a.type === 'smith' || a.type === 'smelt') { player.action = null; finishCraft(a.recipe); }
      }
    }
    if (!blocked) {
      if (pressed.has('Space') || tapped('attack')) playerAttack();
      if (pressed.has('KeyE') || tapped('use')) useAction();
      if (pressed.has('KeyQ')) placeAction();
    }
    if (!swordTaken && dist(player.x, player.y, SWORD_POS.x, SWORD_POS.y) < 30) {
      swordTaken = true; player.equip.weapon = 'wooden_sword'; burst(SWORD_POS.x, SWORD_POS.y, '#fff2a8', 20, 120);
      floatText(player.x, player.y - 30, 'Wooden sword!', '#fff2a8', 18); advanceQuest(2);
    }
    if (quest.stage === 2 && player.x > (CAVE_EXIT_X + 1.5) * TILE) advanceQuest(3);
    if (!player.visitedVillage && inVillageBounds(player.x, player.y)) { player.visitedVillage = true; say("Thistledown. You will wake here now if you fall. The castle is at the south end of the street.", 'The Voice'); save(); }
    for (const d of drops) {
      d.t += dt;
      if (dist(d.x, d.y, player.x, player.y) < player.r + 12) {
        const left = addItem(d.id, d.qty);
        if (left < d.qty) { floatText(player.x, player.y - 30, `+${d.qty - left} ${ITEMS[d.id].name}`, ITEMS[d.id].color); sfx(d.id === 'coins' ? 'coins' : 'pickup'); }
        if (left > 0) { d.qty = left; if (!d.warned) { notify('Your pack is full.'); d.warned = true; } } else d.taken = true;
      }
    }
    drops = drops.filter(d => !d.taken);
  }

  // monsters
  const cb = combatLevel();
  for (const m of monsters) {
    const def = MONSTER_DEFS[m.type];
    if (m.dead) { m.deadT += dt; m.respawnT -= dt; if (m.respawnT <= 0 && dist(player.x, player.y, m.home.x, m.home.y) > 4 * TILE) { m.dead = false; m.hp = m.maxHp; m.x = m.home.x; m.y = m.home.y; m.angry = def.aggro; m.state = 'idle'; burst(m.x, m.y, 'rgba(255,255,255,0.6)', 10, 60); } continue; }
    m.attackCd = Math.max(0, m.attackCd - dt); m.hurtT = Math.max(0, m.hurtT - dt); m.stunT = Math.max(0, (m.stunT || 0) - dt);
    // traps
    { const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE); if (tileAt(tx, ty) === T.TRAP && !def.human) { changeTile(tx, ty, T.GRASS); m.hp -= 12; m.stunT = 2; m.hurtT = 0.3; floatText(m.x, m.y - m.r - 6, '-12 trap', '#ffd166'); burst(m.x, m.y, '#8f96a3', 12, 90); if (m.hp <= 0) { killMonster(m); continue; } } }
    if (m.stunT > 0) { m.moving = false; continue; }
    const dp = dist(m.x, m.y, player.x, player.y);
    const dHome = dist(m.x, m.y, m.home.x, m.home.y);
    const aggressive = def.aggro && cb <= def.level * 2 + 1 && !window.__peace; // high-level knights are left alone
    if (window.__peace && m.state === 'chase') m.state = 'return';
    if (!def.harmless && m.state !== 'return' && (m.angry && !def.aggro || aggressive) && dp < def.sight && !player.dead) m.state = 'chase';
    if (m.state === 'chase' && (dp > def.sight * 1.6 || dHome > 14 * TILE || player.dead)) m.state = 'return';
    let vx = 0, vy = 0;
    if (m.state === 'chase') {
      const dx = player.x - m.x, dy = player.y - m.y, d = dp || 1;
      const stop = m.r + player.r + 4;
      if (def.thrower && dp < 5 * TILE && dp > 1.5 * TILE) {
        if (dp < 2.5 * TILE) { vx = -dx / d; vy = -dy / d; }
        m.facing = { x: dx / d, y: dy / d };
        if (m.attackCd <= 0) { m.attackCd = 2.4; m.attackT = 0.2; const sp = 260; projectiles.push({ kind: 'sticky', x: m.x, y: m.y, vx: dx / d * sp, vy: dy / d * sp, t: 0, life: dp / sp, fuse: 1.3, owner: 'monster' }); }
      } else {
        if (dp > stop) { vx = dx / d; vy = dy / d; }
        m.facing = { x: dx / d, y: dy / d };
        if (dp <= stop + 10 && m.attackCd <= 0) { m.attackCd = def.mech ? 1.6 : 1.1; m.attackT = 0.2; const dmg = rollHit((def.att + 8) * 64, playerDefRoll(), def.maxHit); hurtPlayer(dmg, m.x, m.y); }
      }
    } else if (m.state === 'return') {
      if (dHome < 8) { m.state = 'idle'; if (!def.aggro) m.angry = false; m.hp = Math.min(m.maxHp, m.hp + 1); }
      else { vx = (m.home.x - m.x) / dHome; vy = (m.home.y - m.y) / dHome; m.facing = { x: vx, y: vy }; }
    } else {
      m.wanderT -= dt;
      const roam = def.human ? 6 * TILE : 4 * TILE;
      if (m.wanderT <= 0) { m.wanderT = 1 + Math.random() * 2.5; if (Math.random() < 0.55 && dHome < roam) { const a = Math.random() * Math.PI * 2; m.wander = { x: Math.cos(a), y: Math.sin(a) }; } else if (dHome >= roam) { m.wander = { x: (m.home.x - m.x) / dHome, y: (m.home.y - m.y) / dHome }; } else m.wander = { x: 0, y: 0 }; }
      vx = m.wander.x * 0.45; vy = m.wander.y * 0.45;
      if (vx || vy) m.facing = { x: vx, y: vy };
    }
    m.moving = !!(vx || vy);
    if (m.moving) {
      const before = { x: m.x, y: m.y };
      moveEntity(m, vx * m.speed * dt, vy * m.speed * dt, def.human ? 'person' : 'beast');
      if (Math.abs(m.x - before.x) < 0.01 && Math.abs(m.y - before.y) < 0.01) { m.wanderT = 0.2; if (m.state === 'chase') moveEntity(m, -vy * m.speed * dt, vx * m.speed * dt, 'beast'); }
      m.walkT += dt * 8;
    }
    m.attackT = Math.max(0, (m.attackT || 0) - dt);
    for (const o of monsters) { if (o === m || o.dead) continue; const d = dist(m.x, m.y, o.x, o.y); if (d < m.r + o.r && d > 0) moveEntity(m, (m.x - o.x) / d * 1.5, (m.y - o.y) / d * 1.5, 'beast'); }
  }

  // villagers wander the streets
  for (const n of NPCS) {
    if (!n.wander) continue;
    n.wanderT -= dt; const dHome = dist(n.px, n.py, n.home.x, n.home.y);
    if (n.wanderT <= 0) { n.wanderT = 2 + Math.random() * 4; if (dHome > 9 * TILE || Math.random() < 0.3) { n.dir = { x: (n.home.x - n.px) / (dHome || 1), y: (n.home.y - n.py) / (dHome || 1) }; } else if (Math.random() < 0.7) { const a = Math.random() * Math.PI * 2; n.dir = { x: Math.cos(a), y: Math.sin(a) }; } else n.dir = null; }
    if (n.dir && dist(n.px, n.py, player.x, player.y) > 40) {
      const e = { x: n.px, y: n.py, r: 12 }; const before = { x: e.x, y: e.y };
      moveEntity(e, n.dir.x * 55 * dt, n.dir.y * 55 * dt, 'person');
      const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
      if ([T.COBBLE, T.DIRT, T.GRASS, T.SAND].includes(tileAt(tx, ty)) && !insideBuilding(tx, ty) && inVillageBounds(e.x, e.y)) { n.px = e.x; n.py = e.y; n.facing = n.dir; n.moving = true; n.walkT += dt * 8; }
      else { n.wanderT = 0; n.moving = false; }
      if (Math.abs(e.x - before.x) < 0.01 && Math.abs(e.y - before.y) < 0.01) n.wanderT = 0;
    } else n.moving = false;
  }

  // projectiles
  for (const p of projectiles) {
    p.t += dt;
    if (p.kind === 'sticky' && p.t >= p.life) { p.vx = p.vy = 0; if (p.t >= p.life + p.fuse) { explode(p.x, p.y, 56, 3, 8, 'monster'); p.done = true; } continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    if (SOLID.has(tileAt(tx, ty)) && tileAt(tx, ty) !== T.WATER) { if (p.kind === 'bomb') explode(p.x, p.y, 64, 6, 14, 'player'); else if (p.kind === 'arrow' && Math.random() < 0.5) drops.push({ x: p.x - p.vx * 0.02, y: p.y - p.vy * 0.02, id: p.str > 5 ? 'iron_arrow' : 'stone_arrow', qty: 1, t: 0 }); p.done = true; continue; }
    if (p.kind === 'bomb') { for (const m of monsters) { if (!m.dead && dist(p.x, p.y, m.x, m.y) < m.r + 6) { explode(p.x, p.y, 64, 6, 14, 'player'); p.done = true; break; } } if (p.done) continue; }
    if (p.kind === 'arrow') { for (const m of monsters) { if (m.dead) continue; if (dist(p.x, p.y, m.x, m.y) < m.r + 7 || dist(p.x - p.vx * dt * 0.5, p.y - p.vy * dt * 0.5, m.x, m.y) < m.r + 7) { const dmg = rollHit(playerAttackRoll(true), (MONSTER_DEFS[m.type].def + 8) * 64, playerMaxHit(true)); hitMonster(m, dmg, 8); p.done = true; break; } } }
    if (p.kind === 'bomb' && p.t >= p.life) { explode(p.x, p.y, 64, 6, 14, 'player'); p.done = true; }
    if (p.kind === 'arrow' && p.t >= p.life) { if (Math.random() < 0.5) drops.push({ x: p.x, y: p.y, id: p.str > 5 ? 'iron_arrow' : 'stone_arrow', qty: 1, t: 0 }); p.done = true; }
  }
  projectiles = projectiles.filter(p => !p.done);

  for (const p of particles) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
  particles = particles.filter(p => p.t > 0);
  for (const f of floaters) { f.t -= dt; f.y += f.vy * dt; }
  floaters = floaters.filter(f => f.t > 0);
  for (const h of HOOKS.update) h(dt);
  pressed.clear();
}
