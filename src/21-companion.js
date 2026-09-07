// ============================================================================
// COMPANION — one hero walks with you. Sera the ranger (caged in the Goblin Camp),
// Garrick the retired guard (for hire at The Barrel & Boar). Everything registers
// through HOOKS; state lives in player.companion and is saved with the player.
// ============================================================================
{
  const CAGE = addTile('CAGE', { solid: true, tex: 'dirt', mini: '#8f96a3' });
  const CAGE_POS = { x: 148, y: 34 };
  const INN_WAIT = { sera: { x: 123, y: 48 }, garrick: { x: 127, y: 47 } }; // where a dismissed hero waits (inside the inn; interior is x 123–128, y 45–48)
  const GOBLIN_TYPES = ['goblin', 'sapper', 'brute', 'walker'];
  const FOLLOW_SPEED = 180, STOP_DIST = 60, SNAP_DIST = 12 * TILE, DOWN_TIME = 30, COMP_LEVEL = 12;

  const HEROES = {
    sera: {
      name: 'Sera', title: 'Ranger of Hollowford', hp: 60, cost: 0, kind: 'ranged', r: 13,
      look: { tunic: '#3a6a4a', hair: '#c9843a', woman: true, weapon: ITEMS.shortbow, shoulder: '#5a4a3a' },
      blurb: 'Shoots arrows from a distance and keeps her head down. She hides when she is hurt and comes back when she can.',
      defBonus: 4,
    },
    garrick: {
      name: 'Garrick', title: 'Retired guard', hp: 90, cost: 150, kind: 'melee', r: 13,
      look: { tunic: '#7a2e2e', hair: '#8a7a6a', helm: '#8f96a3', beard: true, weapon: ITEMS.iron_sword, shoulder: '#8f96a3' },
      blurb: 'Fights up close with an iron sword. Slow to anger, hard to knock down.',
      defBonus: 16,
    },
  };

  // ---------- state ----------
  function newCompanionState() { return { id: null, hp: 0, mode: 'follow', x: 0, y: 0, freed: { sera: false }, downT: 0 }; }
  function comp() {
    let c = player.companion;
    if (!c || typeof c !== 'object') c = player.companion = newCompanionState();
    if (!c.freed || typeof c.freed !== 'object') c.freed = { sera: false };
    if (c.id && !HEROES[c.id]) c.id = null;
    if (typeof c.downT !== 'number') c.downT = 0;
    if (c.mode !== 'stay') c.mode = 'follow';
    return c;
  }
  // transient (not saved): animation, cooldowns, facing
  const live = { id: null, facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, attackCd: 0, walkT: 0, moving: false, sinceHurt: 99, stuckT: 0 };
  function resetLive(id) { live.id = id; live.facing = { x: 0, y: 1 }; live.hurtT = 0; live.attackT = 0; live.attackCd = 0.3; live.walkT = 0; live.moving = false; live.sinceHurt = 99; live.stuckT = 0; }

  // ---------- hero NPCs (a hero who is not with you waits in the inn) ----------
  const HERO_NPC = {
    sera: initNpc({ id: 'sera', name: 'Sera', x: INN_WAIT.sera.x, y: INN_WAIT.sera.y, tunic: '#3a6a4a', hair: '#c9843a', woman: true, role: 'hero_sera' }),
    garrick: initNpc({ id: 'garrick', name: 'Garrick', x: INN_WAIT.garrick.x, y: INN_WAIT.garrick.y, tunic: '#7a2e2e', hair: '#8a7a6a', beard: true, role: 'hero_garrick' }),
  };
  NPCS.push(HERO_NPC.garrick);
  function syncHeroNpcs() {
    const c = comp();
    const want = { garrick: c.id !== 'garrick', sera: !!c.freed.sera && c.id !== 'sera' };
    for (const id in HERO_NPC) {
      const n = HERO_NPC[id]; const i = NPCS.indexOf(n);
      if (want[id] && i < 0) { n.px = n.home.x; n.py = n.home.y; NPCS.push(n); }
      else if (!want[id] && i >= 0) NPCS.splice(i, 1);
    }
  }

  function freeSpotNear(x, y) {
    if (!collides(x, y, 13, 'person')) return { x, y };
    for (let r = 1; r < 8; r++) for (let a = 0; a < 12; a++) { const ang = a / 12 * Math.PI * 2; const nx = x + Math.cos(ang) * r * 18, ny = y + Math.sin(ang) * r * 18; if (!collides(nx, ny, 13, 'person')) return { x: nx, y: ny }; }
    return { x, y };
  }
  function besidePlayer() { return freeSpotNear(player.x - player.facing.x * 44, player.y - player.facing.y * 44); }

  function recruit(id) {
    const c = comp(); const def = HEROES[id];
    if (c.id === id) return;
    if (c.id) { const old = HEROES[c.id]; notify(`${old.name} heads back to the Barrel & Boar.`); }
    c.id = id; c.hp = def.hp; c.mode = 'follow'; c.downT = 0;
    const p = besidePlayer(); c.x = p.x; c.y = p.y;
    resetLive(id); syncHeroNpcs();
    burst(c.x, c.y, '#9fe0b0', 16, 90);
    levelBanner = { text: `${def.name.toUpperCase()} JOINS YOU`, sub: def.title, t: 3 };
    save();
  }
  function dismiss() {
    const c = comp(); if (!c.id) return;
    const def = HEROES[c.id];
    say(c.id === 'sera' ? "Alright. I'll be at the Barrel & Boar when you want me. Mind the wolves." : "Suit yourself. I'll be on my stool at the inn if the goblins get bold.", def.name);
    burst(c.x, c.y, '#9fe0b0', 10, 60);
    c.id = null; c.downT = 0; resetLive(null); syncHeroNpcs(); save();
  }
  function setMode(mode) { const c = comp(); if (!c.id) return; c.mode = mode; const def = HEROES[c.id]; notify(mode === 'stay' ? `${def.name} waits here.` : `${def.name} follows you.`); save(); }

  // ---------- world: the cage in the goblin camp ----------
  HOOKS.world.push((rnd, api) => { api.setTile(CAGE_POS.x, CAGE_POS.y, CAGE); });

  function guardsNearCage() {
    const cx = tc(CAGE_POS.x), cy = tc(CAGE_POS.y);
    return monsters.filter(m => !m.dead && GOBLIN_TYPES.includes(m.type) && dist(m.x, m.y, cx, cy) <= 6 * TILE);
  }
  function freeSera() {
    const c = comp();
    c.freed.sera = true;
    burst(tc(CAGE_POS.x), tc(CAGE_POS.y), '#c9ccd3', 16, 80);
    say("You cleared the whole camp? Then I owe you my neck. I'm Sera, ranger of Hollowford. What's left of it.", 'Sera');
    say("I kept my bow hidden in the straw. Lead on, knight. I'll watch your back and put arrows in whatever bites you.", 'Sera');
    say("Press E on me if you want me to wait somewhere, follow, or go. One hero at a time is company enough.", 'Sera');
    recruit('sera');
  }

  // ---------- use: the cage, and talking to your hero ----------
  HOOKS.use.push((t, tx, ty, building) => {
    const c = comp();
    if (t === CAGE) {
      if (c.freed.sera) { notify('An empty goblin cage. Sera is free.'); return true; }
      if (guardsNearCage().length) { notify('The guards would hear. Clear the camp first.'); return true; }
      freeSera(); return true;
    }
    if (c.id && c.downT <= 0) {
      const d = dist(player.x, player.y, c.x, c.y);
      const dot = d > 0 ? ((c.x - player.x) * player.facing.x + (c.y - player.y) * player.facing.y) / d : 1;
      if (d < 72 && dot > 0.5) { live.facing = { x: -player.facing.x, y: -player.facing.y }; openPanel('companion'); return true; }
    }
    return false;
  });

  // ---------- talk: heroes waiting in the inn ----------
  HOOKS.talk.hero_garrick = npc => {
    const c = comp();
    if (c.id === 'garrick') return;
    if (combatLevel() < 6) { say(`Retired. And I'm not walking out that door behind someone who can't swing a sword yet. Combat level 6, then we talk. You're ${combatLevel()}.`, 'Garrick'); return; }
    if (coins() < HEROES.garrick.cost) { say(`A hundred and fifty coins gets me off this stool. You have ${coins()}. The Duke pays for goblin scrap, I hear.`, 'Garrick'); return; }
    say("Ha. Combat level six and coin in your purse. My sword's rusty but my arm isn't.", 'Garrick');
    openPanel('companion', { hire: 'garrick' });
  };
  HOOKS.talk.hero_sera = npc => {
    const c = comp();
    if (c.id === 'sera') return;
    say("Ready when you are, knight. Say the word.", 'Sera');
    openPanel('companion', { hire: 'sera' });
  };

  // ---------- panel ----------
  HOOKS.panel.companion = (g, narrow) => {
    const c = comp(); const arg = panelArg;
    if (arg && arg.hire && HEROES[arg.hire]) {
      const def = HEROES[arg.hire]; const cost = def.cost || 0;
      const { px, py, w, h } = panelBox(g, 400, 220, def.name, def.title);
      g.fillStyle = '#c9d1d9'; g.font = '13px sans-serif'; g.textAlign = 'left';
      wrapText(g, def.blurb + (c.id && c.id !== arg.hire ? ` ${HEROES[c.id].name} will wait at the Barrel & Boar.` : ''), px + 18, py + 78, w - 36, 18);
      const can = coins() >= cost;
      button(g, px + 18, py + h - 54, 210, 36, cost ? `Hire for ${cost} coins` : 'Come with me', () => { if (cost && !payCoins(cost)) { notify('Not enough coins.'); return; } if (cost) floatText(player.x, player.y - 30, `-${cost} coins`, '#ffd166'); closePanel(); recruit(arg.hire); }, can ? '#238636' : '#2a2f3a', can);
      button(g, px + w - 18 - 120, py + h - 54, 120, 36, 'Not now', closePanel, '#21262d');
      return;
    }
    if (!c.id) { closePanel(); return; }
    const def = HEROES[c.id];
    const { px, py, w, h } = panelBox(g, 400, 236, def.name, `${def.title} · ${c.mode === 'stay' ? 'waiting here' : 'following you'}`);
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText('HP', px + 18, py + 78);
    g.fillStyle = '#2a2f3a'; roundRect(g, px + 44, py + 68, w - 62, 12, 5); g.fill();
    const f = clamp(c.hp / def.hp, 0, 1); g.fillStyle = f > 0.5 ? '#3fb950' : f > 0.25 ? '#d29922' : '#f85149'; roundRect(g, px + 44, py + 68, (w - 62) * f, 12, 5); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText(`${Math.ceil(c.hp)} / ${def.hp}`, px + 44 + (w - 62) / 2, py + 78);
    g.fillStyle = '#c9d1d9'; g.font = '13px sans-serif'; g.textAlign = 'left';
    wrapText(g, def.blurb, px + 18, py + 104, w - 36, 18);
    const by = py + h - 54, bw = (w - 36 - 16) / 3;
    button(g, px + 18, by, bw, 36, 'Follow me', () => { setMode('follow'); closePanel(); }, '#238636', c.mode !== 'follow');
    button(g, px + 18 + bw + 8, by, bw, 36, 'Stay here', () => { setMode('stay'); closePanel(); }, '#1f6feb', c.mode !== 'stay');
    button(g, px + 18 + (bw + 8) * 2, by, bw, 36, 'Dismiss', () => { closePanel(); dismiss(); }, '#8b2e2e');
  };

  // ---------- combat helpers ----------
  HOOKS.hit.push(m => { m.compTag = time; });
  function pickTarget(c) {
    let best = null;
    for (const m of monsters) {
      if (m.dead) continue; const mdef = MONSTER_DEFS[m.type]; if (mdef.harmless) continue;
      const chasing = m.state === 'chase', tagged = typeof m.compTag === 'number' && time - m.compTag < 3;
      if (!chasing && !tagged) continue;
      const dp = dist(m.x, m.y, player.x, player.y), dc = dist(m.x, m.y, c.x, c.y);
      if (dp > 5 * TILE && dc > 5 * TILE) continue;
      if (!best || dc < best.dc) best = { m, dc };
    }
    return best;
  }
  function hurtCompanion(c, def, dmg, fromX, fromY) {
    if (dmg <= 0) { floatText(c.x, c.y - 24, 'miss', '#8fb4ff', 13); return; }
    c.hp -= dmg; live.hurtT = 0.25; live.sinceHurt = 0;
    floatText(c.x, c.y - 24, `-${dmg}`, '#ff9a9a');
    const kx = c.x - fromX, ky = c.y - fromY, kd = Math.hypot(kx, ky) || 1;
    const e = { x: c.x, y: c.y, r: 13 }; moveEntity(e, kx / kd * 10, ky / kd * 10, 'person'); c.x = e.x; c.y = e.y;
    if (c.hp <= 0) {
      c.hp = 0; c.downT = DOWN_TIME;
      burst(c.x, c.y, '#9fe0b0', 20, 120);
      levelBanner = { text: `${def.name} falls back!`, sub: `Back at your side in ${DOWN_TIME} seconds`, t: 3 };
    }
  }
  function stepToward(c, tx, ty, dt, stopAt) {
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    if (d <= stopAt) { live.moving = false; return; }
    const ux = dx / d, uy = dy / d, step = Math.min(FOLLOW_SPEED * dt, d - stopAt);
    const e = { x: c.x, y: c.y, r: 13 };
    moveEntity(e, ux * step, uy * step, 'person');
    let moved = Math.abs(e.x - c.x) > 0.01 || Math.abs(e.y - c.y) > 0.01;
    if (!moved) { const s = Math.floor(time * 0.7) % 2 ? 1 : -1; moveEntity(e, -uy * step * s, ux * step * s, 'person'); moved = Math.abs(e.x - c.x) > 0.01 || Math.abs(e.y - c.y) > 0.01; live.stuckT += dt; }
    else live.stuckT = 0;
    c.x = e.x; c.y = e.y; live.facing = { x: ux, y: uy }; live.moving = true; live.walkT += dt * 9;
  }

  // ---------- update ----------
  HOOKS.update.push(dt => {
    const c = comp();
    if (live.id !== c.id) { resetLive(c.id); syncHeroNpcs(); }
    if (!c.id) return;
    const def = HEROES[c.id];
    live.hurtT = Math.max(0, live.hurtT - dt); live.attackT = Math.max(0, live.attackT - dt); live.attackCd = Math.max(0, live.attackCd - dt); live.sinceHurt += dt;
    if (c.downT > 0) {
      c.downT -= dt; live.moving = false;
      if (c.downT <= 0) { c.downT = 0; c.hp = Math.ceil(def.hp / 2); const p = besidePlayer(); c.x = p.x; c.y = p.y; c.mode = 'follow'; live.sinceHurt = 0; burst(c.x, c.y, '#9fe0b0', 16, 90); notify(`${def.name} is back at your side.`); }
      return;
    }
    if (player.dead) { live.moving = false; return; }
    if (live.sinceHurt > 4 && c.hp < def.hp) c.hp = Math.min(def.hp, c.hp + dt);
    const dp = dist(c.x, c.y, player.x, player.y);
    // teleport when left far behind (lodestone, respawn, stuck behind a wall)
    if (c.mode === 'follow' && (dp > SNAP_DIST || (live.stuckT > 2.5 && dp > 4 * TILE))) { const p = besidePlayer(); c.x = p.x; c.y = p.y; live.stuckT = 0; burst(c.x, c.y, '#9fe0b0', 10, 60); }
    // fight
    const target = pickTarget(c);
    let busy = false;
    if (target && !(c.mode === 'follow' && dp > 8 * TILE)) {
      const m = target.m, dc = target.dc, mdef = MONSTER_DEFS[m.type];
      const ux = (m.x - c.x) / (dc || 1), uy = (m.y - c.y) / (dc || 1);
      busy = true; live.facing = { x: ux, y: uy };
      if (def.kind === 'ranged') {
        if (c.mode === 'follow') { if (dc < 1.5 * TILE && dp < 4 * TILE) stepToward(c, c.x - ux * TILE, c.y - uy * TILE, dt, 4); else if (dc > 5 * TILE) stepToward(c, m.x, m.y, dt, 4 * TILE); else live.moving = false; }
        else live.moving = false;
        if (live.attackCd <= 0 && dc <= 5.5 * TILE) {
          live.attackCd = 0.8; live.attackT = 0.22;
          const dx = m.x - c.x, dy = m.y - c.y, d = Math.hypot(dx, dy) || 1;
          projectiles.push({ kind: 'arrow', x: c.x + dx / d * 16, y: c.y + dy / d * 16, vx: dx / d * 420, vy: dy / d * 420, t: 0, life: 0.9, str: 5, owner: 'player' });
        }
      } else {
        const reach = m.r + 13 + 6;
        if (dc > reach) { if (c.mode === 'follow') stepToward(c, m.x, m.y, dt, reach - 4); else live.moving = false; }
        else {
          live.moving = false;
          if (live.attackCd <= 0) {
            live.attackCd = 0.9; live.attackT = 0.22;
            const attRoll = (COMP_LEVEL + 8) * (64 + def.look.weapon.weapon.att), maxHit = 2 + Math.floor((COMP_LEVEL + 8) * (def.look.weapon.weapon.str + 64) / 300);
            hitMonster(m, rollHit(attRoll, (mdef.def + 8) * 64, maxHit), 14);
          }
        }
      }
    }
    // follow
    if (!busy) {
      if (c.mode === 'follow' && dp > STOP_DIST) stepToward(c, player.x - player.facing.x * 44, player.y - player.facing.y * 44, dt, 6);
      else { live.moving = false; if (dp > 1) live.facing = { x: (player.x - c.x) / dp, y: (player.y - c.y) / dp }; }
    }
    // do not stand on the knight
    if (dp < 22 && dp > 0) { const e = { x: c.x, y: c.y, r: 13 }; moveEntity(e, (c.x - player.x) / dp * 40 * dt, (c.y - player.y) / dp * 40 * dt, 'person'); c.x = e.x; c.y = e.y; }
    // monsters next to the hero (and not next to the knight) hit the hero instead
    const defRoll = (COMP_LEVEL + 8) * (64 + def.defBonus);
    for (const m of monsters) {
      if (m.dead || m.state !== 'chase' || (m.stunT || 0) > 0) continue; const mdef = MONSTER_DEFS[m.type]; if (mdef.harmless) continue;
      const dc = dist(m.x, m.y, c.x, c.y), dpm = dist(m.x, m.y, player.x, player.y);
      const stopC = m.r + 13 + 4, stopP = m.r + player.r + 4;
      if (dc <= stopC + 10 && dpm > stopP + 10 && m.attackCd <= 0) {
        m.attackCd = mdef.mech ? 1.6 : 1.1; m.attackT = 0.2;
        hurtCompanion(c, def, rollHit((mdef.att + 8) * 64, defRoll, mdef.maxHit), m.x, m.y);
        if (c.downT > 0) break;
      }
    }
  });

  // ---------- draw ----------
  function drawCage(g, tx, ty, open) {
    const x = tx * TILE, y = ty * TILE, cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, cy + 18, 22, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#6b4a2a'; g.fillRect(x + 3, y + 8, TILE - 6, TILE - 12);
    g.fillStyle = '#8a5a2b'; for (let k = 0; k < 4; k++) g.fillRect(x + 5, y + 11 + k * 9, TILE - 10, 6);
    g.fillStyle = '#c9b676'; for (const [ox, oy] of [[-10, 8], [6, 12], [-2, 4], [12, 2]]) { g.beginPath(); g.ellipse(cx + ox, cy + oy, 5, 2, 0.3, 0, 7); g.fill(); }
    if (!open) { g.save(); g.translate(cx, cy + 2); g.scale(0.85, 0.85); drawHuman(g, { facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0 }, { tunic: HEROES.sera.look.tunic, hair: HEROES.sera.look.hair, woman: true, shoulder: '#5a4a3a' }); g.restore(); }
    g.strokeStyle = '#8f96a3'; g.lineWidth = 3; g.lineCap = 'round';
    for (let k = 0; k < 5; k++) { const bx = x + 8 + k * 8; if (open && k >= 3) continue; g.beginPath(); g.moveTo(bx, y + 4); g.lineTo(bx, y + TILE - 6); g.stroke(); }
    g.beginPath(); g.moveTo(x + 5, y + 4); g.lineTo(x + TILE - 5, y + 4); g.moveTo(x + 5, y + TILE - 6); g.lineTo(x + TILE - 5, y + TILE - 6); g.stroke();
    if (open) { g.save(); g.translate(x + 30, y + TILE - 6); g.rotate(-0.9); for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(k * 8, 0); g.lineTo(k * 8, -38); g.stroke(); } g.restore(); }
    g.fillStyle = '#5a5d64'; for (const [ox, oy] of [[x + 6, y + 4], [x + TILE - 6, y + 4], [x + 6, y + TILE - 6], [x + TILE - 6, y + TILE - 6]]) { g.beginPath(); g.arc(ox, oy, 2.5, 0, 7); g.fill(); }
    if (!open && dist(player.x, player.y, cx, cy) < 160) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText('Sera · E', cx, y - 6); g.fillStyle = '#ffe9a8'; g.fillText('Sera · E', cx, y - 6); }
  }
  function drawCompanion(g, c, def) {
    const e = { x: c.x, y: c.y, r: 13, facing: live.facing, hurtT: live.hurtT, attackT: live.attackT, moving: live.moving, walkT: live.walkT };
    g.save(); g.translate(e.x, e.y + (e.moving ? Math.sin(e.walkT) * 2 : 0));
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 11, 12, 6, 0, 0, 7); g.fill();
    drawHuman(g, e, def.look);
    g.restore();
    const near = dist(player.x, player.y, e.x, e.y) < 140, hurt = c.hp < def.hp;
    if (near || hurt) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(def.name, e.x, e.y - 26); g.fillStyle = '#9fe0b0'; g.fillText(def.name, e.x, e.y - 26); }
    if (hurt) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(e.x - 14, e.y - 22, 28, 4); g.fillStyle = '#3fb950'; g.fillRect(e.x - 14, e.y - 22, 28 * clamp(c.hp / def.hp, 0, 1), 4); }
    if (c.mode === 'stay' && near) { g.fillStyle = '#8b949e'; g.font = '9px sans-serif'; g.fillText('waiting', e.x, e.y - 36); }
  }
  HOOKS.draw.push((g, items, cam) => {
    const c = comp();
    { const cx = tc(CAGE_POS.x), cy = tc(CAGE_POS.y); if (tileAt(CAGE_POS.x, CAGE_POS.y) === CAGE && cx > cam.x - 60 && cx < cam.x + VW + 60 && cy > cam.y - 60 && cy < cam.y + VH + 60) items.push({ y: CAGE_POS.y * TILE + TILE - 6, draw: () => drawCage(g, CAGE_POS.x, CAGE_POS.y, !!c.freed.sera) }); }
    if (c.id && c.downT <= 0 && c.x > cam.x - 60 && c.x < cam.x + VW + 60 && c.y > cam.y - 60 && c.y < cam.y + VH + 60) { const def = HEROES[c.id]; items.push({ y: c.y + 13, draw: () => drawCompanion(g, c, def) }); }
  });

  // ---------- hud ----------
  HOOKS.hud.push((g, narrow) => {
    const c = comp(); if (!c.id) return;
    const def = HEROES[c.id];
    const qh = quest.tracked && activeQuests().includes(quest.tracked) ? 54 : 0;
    const short = isTouch && VH < 500;
    let y = 82;
    if (narrow && qh) y = 84 + qh + 8;
    if (isTouch && !short) { const hy = narrow ? 84 + qh + 8 : 90; y = Math.max(y, hy + 44 + 12); }
    const label = c.downT > 0 ? `${def.name} · back in ${Math.ceil(c.downT)}s` : c.mode === 'stay' ? `${def.name} · waiting` : `${def.name} ${Math.ceil(c.hp)}/${def.hp}`;
    g.font = 'bold 12px sans-serif'; g.textAlign = 'left';
    const w = Math.ceil(g.measureText(label).width) + 44;
    roundRect(g, 14, y, w, 24, 8); g.fillStyle = 'rgba(10,14,22,0.78)'; g.fill();
    g.fillStyle = c.downT > 0 ? '#4b535d' : def.look.tunic; g.beginPath(); g.arc(28, y + 12, 7, 0, 7); g.fill();
    g.fillStyle = c.downT > 0 ? '#6e7681' : (def.look.helm || def.look.hair); g.beginPath(); g.arc(28, y + 11, 6, Math.PI, 0); g.fill();
    const f = clamp(c.hp / def.hp, 0, 1);
    g.fillStyle = c.downT > 0 ? '#8b949e' : f > 0.5 ? '#e6edf3' : f > 0.25 ? '#d29922' : '#f85149'; g.fillText(label, 42, y + 16);
    // hero on the minimap
    if (minimapRect && c.downT <= 0) {
      const { x: mx, y: my, w: ms } = minimapRect; const ta = 44, sc = ms / ta;
      const sx = clamp(player.x / TILE - ta / 2, 0, MAP_W - ta), sy = clamp(player.y / TILE - ta / 2, 0, MAP_H - ta);
      const dx = mx + (c.x / TILE - sx) * sc, dy = my + (c.y / TILE - sy) * sc;
      if (dx > mx + 2 && dx < mx + ms - 2 && dy > my + 2 && dy < my + ms - 2) { g.fillStyle = '#9fe0b0'; g.beginPath(); g.arc(dx, dy, 2.5, 0, 7); g.fill(); }
    }
  });

  // ---------- new game ----------
  HOOKS.newGame.push(() => { player.companion = newCompanionState(); resetLive(null); syncHeroNpcs(); });

  // ---------- debug handle ----------
  if (window.FANGLANDS) window.FANGLANDS.companion = { CAGE, CAGE_POS, HEROES, comp, recruit, dismiss, setMode, syncHeroNpcs, guardsNearCage };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const c = comp();
    const openStrip = (cx, cy, half) => { for (let r = 0; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, y = cy + dy; let ok = inMap(x - half, y - 1) && inMap(x + half, y + 1); for (let yy = y - 1; yy <= y + 1 && ok; yy++) for (let xx = x - half; xx <= x + half && ok; xx++) if (tileAt(xx, yy) !== T.GRASS) ok = false; if (ok && !inVillageBounds(tc(x), tc(y))) return { x, y }; } return h.openSpot(cx, cy); };
    const cageX = tc(CAGE_POS.x), cageY = tc(CAGE_POS.y);
    const xp0 = { melee: player.skills.melee.xp, defence: player.skills.defence.xp };
    const killed = [];
    // cage exists in the camp
    check('companion: goblin cage stands in the Goblin Camp', tileAt(CAGE_POS.x, CAGE_POS.y) === CAGE && regionAt(CAGE_POS.x, CAGE_POS.y).name === 'Goblin Camp' && !c.id && !c.freed.sera, { tile: tileAt(CAGE_POS.x, CAGE_POS.y), CAGE });
    { const inn = BUILDINGS.find(b => b.id === 'inn'); const spots = Object.values(INN_WAIT); const ok = spots.every(s => insideBuilding(s.x, s.y) === inn && !SOLID.has(tileAt(s.x, s.y)));
      check('companion: heroes wait on open floor inside the Barrel & Boar; Garrick sits there now', ok && NPCS.some(n => n.id === 'garrick') && !NPCS.some(n => n.id === 'sera'), { spots, tiles: spots.map(s => tileAt(s.x, s.y)) }); }
    // E on the cage with a guard nearby refuses
    h.peace(true); F.tp(CAGE_POS.x, CAGE_POS.y + 1); F.face(CAGE_POS.x, CAGE_POS.y);
    { const brute = monsters.find(m => m.type === 'brute' && dist(m.home.x, m.home.y, cageX, cageY) < 6 * TILE) || monsters.find(m => m.type === 'goblin');
      brute.dead = false; brute.hp = brute.maxHp; brute.x = brute.home.x; brute.y = brute.home.y; brute.state = 'idle'; brute.stunT = 0;
      if (dist(brute.x, brute.y, cageX, cageY) > 5 * TILE) { brute.x = cageX + 3 * TILE; brute.y = cageY; }
      F.press('KeyE'); F.sim(2, []);
      check('companion: cage refuses while goblins are near', !c.id && !c.freed.sera && notice && /guards would hear/i.test(notice.text), { guards: guardsNearCage().length, notice: notice && notice.text }); }
    // clear the camp, then E frees Sera
    { for (const m of monsters) if (!m.dead && GOBLIN_TYPES.includes(m.type) && dist(m.x, m.y, cageX, cageY) <= 8 * TILE) { m.dead = true; m.deadT = 0; m.respawnT = 90; killed.push(m); }
      F.tp(CAGE_POS.x, CAGE_POS.y + 1); F.face(CAGE_POS.x, CAGE_POS.y); F.press('KeyE'); F.sim(2, []);
      check('companion: E on the cage frees Sera, she joins', c.id === 'sera' && c.freed.sera && c.hp === 60 && c.mode === 'follow' && killed.length > 0, { id: c.id, hp: c.hp, cleared: killed.length, notice: notice && notice.text }); }
    // follows: snaps when far, walks when near
    { const s = openStrip(40, 20, 5); F.tp(s.x - 3, s.y); F.sim(3, []); const snapped = dist(c.x, c.y, player.x, player.y) < 3 * TILE;
      F.tp(s.x + 3, s.y); F.sim(120, []); const d = dist(c.x, c.y, player.x, player.y);
      check('companion: Sera teleports when far, walks up when near', snapped && d < 3 * TILE && d >= 20, { snapped, tiles: +(d / TILE).toFixed(2), strip: s }); }
    // fights: a goblin on the knight, Sera shoots it
    { h.peace(false); player.hp = player.maxHp; player.facing = { x: 1, y: 0 };
      const gob = monsters.find(m => m.type === 'goblin' && m.home.x < 100 * TILE) || monsters.find(m => m.type === 'goblin');
      const gh = { ...gob.home }; gob.dead = false; gob.hp = gob.maxHp; gob.stunT = 0; gob.attackCd = 0; gob.x = player.x + 70; gob.y = player.y; gob.home = { x: gob.x, y: gob.y }; gob.state = 'chase'; gob.angry = true; gob.wanderT = 99;
      c.x = player.x - 50; c.y = player.y; c.hp = 60; live.attackCd = 0;
      const r = F.untilAction(600, () => gob.hp < gob.maxHp || gob.dead);
      check('companion: Sera shoots a goblin that attacks you', typeof r === 'number' && (gob.hp < gob.maxHp || gob.dead), { steps: r, hp: gob.hp, dead: gob.dead, arrows: projectiles.filter(p => p.kind === 'arrow').length });
      gob.home = gh; gob.x = gh.x; gob.y = gh.y; gob.state = 'idle'; gob.hp = gob.maxHp; gob.dead = false; h.peace(true); }
    // Garrick: refuses below combat level 6, hires for 150 coins, replaces Sera
    { F.tp(125, 48); F.sim(3, []);
      player.skills.melee.xp = XP_TABLE[3]; player.skills.defence.xp = XP_TABLE[3]; recomputeMaxHp();
      const w1 = F.talk('garrick'); const cbLow = combatLevel();
      const refused = panel !== 'companion' && c.id === 'sera' && cbLow < 6;
      check('companion: Garrick refuses under combat level 6', refused, { w1, cb: cbLow, panel, dialog: dialog.cur && dialog.cur.text });
      closePanel(); player.skills.melee.xp = XP_TABLE[6]; player.skills.defence.xp = XP_TABLE[6]; recomputeMaxHp(); h.give('coins', 200); const c0 = coins();
      const w2 = F.talk('garrick'); const opened = panel === 'companion' && panelArg && panelArg.hire === 'garrick';
      const hired = F.clickButton('Hire');
      check('companion: Garrick hires for 150 coins at combat level 6 and replaces Sera', opened && hired && c.id === 'garrick' && c.hp === 90 && coins() === c0 - 150 && NPCS.some(n => n.id === 'sera') && !NPCS.some(n => n.id === 'garrick'), { w2, cb: combatLevel(), opened, hired, id: c.id, coins: coins(), c0 }); }
    // Garrick fights up close
    { closePanel(); const s = openStrip(40, 24, 5); F.tp(s.x, s.y); F.sim(3, []); h.peace(false); player.hp = player.maxHp; player.facing = { x: 1, y: 0 };
      const gob = monsters.find(m => m.type === 'goblin' && m.home.x < 100 * TILE) || monsters.find(m => m.type === 'goblin');
      const gh = { ...gob.home }; gob.dead = false; gob.hp = gob.maxHp; gob.stunT = 0; gob.attackCd = 0; gob.x = player.x + 60; gob.y = player.y; gob.home = { x: gob.x, y: gob.y }; gob.state = 'chase'; gob.angry = true; gob.wanderT = 99;
      c.x = player.x - 40; c.y = player.y; live.attackCd = 0;
      const r = F.untilAction(600, () => gob.hp < gob.maxHp || gob.dead);
      check('companion: Garrick swings his sword at a goblin that attacks you', typeof r === 'number' && (gob.hp < gob.maxHp || gob.dead), { steps: r, hp: gob.hp, dead: gob.dead });
      gob.home = gh; gob.x = gh.x; gob.y = gh.y; gob.state = 'idle'; gob.hp = gob.maxHp; gob.dead = false; h.peace(true); }
    // falls back, returns at half hp
    { c.hp = 1; hurtCompanion(c, HEROES.garrick, 5, c.x + 10, c.y); const down = c.downT > 0 && levelBanner && /falls back/.test(levelBanner.text);
      c.downT = 0.05; F.sim(6, []); check('companion: a downed hero falls back and returns at half hp', down && c.downT === 0 && c.hp === 45 && c.id === 'garrick', { down, hp: c.hp, downT: c.downT }); }
    // panel: stay / follow / dismiss
    { const s = openStrip(40, 24, 5); F.tp(s.x, s.y); F.sim(3, []); player.facing = { x: 1, y: 0 }; c.x = player.x + 40; c.y = player.y;
      F.press('KeyE'); const opened = panel === 'companion' && !panelArg; const stay = F.clickButton('Stay here'); const stayed = c.mode === 'stay';
      c.x = player.x + 40; c.y = player.y; F.press('KeyE'); const follow = F.clickButton('Follow me'); const following = c.mode === 'follow';
      c.x = player.x + 40; c.y = player.y; F.press('KeyE'); const dismissed = F.clickButton('Dismiss');
      check('companion: E on your hero opens Stay / Follow / Dismiss; Dismiss sends Garrick back to the inn', opened && stay && stayed && follow && following && dismissed && c.id === null && NPCS.some(n => n.id === 'garrick') && NPCS.some(n => n.id === 'sera') && panel !== 'companion', { opened, stay, stayed, follow, following, dismissed, id: c.id }); }
    // tidy up for whoever tests next
    for (const m of killed) { m.dead = false; m.hp = m.maxHp; m.x = m.home.x; m.y = m.home.y; m.state = 'idle'; }
    player.skills.melee.xp = xp0.melee; player.skills.defence.xp = xp0.defence; recomputeMaxHp();
    closePanel(); h.peace(false); save();
  });
}
