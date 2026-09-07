// ============================================================================
// ASH DRAKES + progression helpers (balance wave, audit 2026-09-07 §2)
// 1. The ash drake: a level-30 wingless, fire-less drake that lives round Dunstan's dung farm and
//    drops dragon dung every time, so the main quest's "five dung" no longer needs a level-45 kill.
// 2. Kill bonus XP: every monster of level 10 and up pays level × 10 XP on death (melee, or Range
//    if a bow killed it), on top of the 4 XP per point of damage the core already gives. Bosses now
//    pay in progress as well as loot. Companion kills are skipped when the companion file marks them
//    (window.__companionHit).
// 3. Kid mode: while `window.__kidmode` is true the knight gets a quarter of every hit back at once.
//    Semantics: it is a global flag, off by default, nothing in the core reads it; set it from the
//    console (`__kidmode = true`) or from a future settings toggle. It does not change monsters,
//    drops, or XP, only how much a hit costs. Because HOOKS.hurt runs after the damage is applied
//    but BEFORE the core's death check, a barely-lethal hit becomes a survived one. Direct hp writes
//    that bypass hurtPlayer (lava burn) are caught by an update-tick tracker instead.
// Feature file: registers everything through HOOKS, edits no core file. One block, no leaked names.
// ============================================================================
{
  const AD_SPAWNS = [[52, 100], [56, 110], [74, 110], [80, 100]];   // round Dunstan's farm (58–79 × 96–107), on the ash
  const AD_KILL_BONUS_MIN_LEVEL = 10, AD_KILL_BONUS_PER_LEVEL = 10;
  const AD_KID_HEAL = 0.25;
  const AD = { stats: { bonuses: 0, last: null, kidHeals: 0 }, lastHp: null };

  // ---------- the monster ----------
  // dung every time (the on-ramp), coins, and a scale one kill in four or so; no fire, no wings
  const dungOrCoins = ITEMS.dragon_dung ? ['dragon_dung', 1, 1] : ['coins', 5, 10];
  MONSTER_DEFS.ash_drake = {
    name: 'Ash drake', level: 30, r: 22, hp: 120, att: 26, maxHit: 12, def: 20, speed: 100, aggro: true, sight: 5 * TILE, respawn: 120,
    drops: { always: [dungOrCoins, ['coins', 30, 60]], table: [['dragon_scale', 1, 1, 3], ['coal', 1, 2, 4], ['nothing', 0, 0, 6]].filter(r => r[0] === 'nothing' || ITEMS[r[0]]) },
  };

  // A stocky four-legged drake seen from above: low wide body, short thick neck, blunt head, a short
  // tail, small back spines, no wings. Grey-green hide dusted with ash, red eyes.
  HOOKS.drawMonster.ash_drake = (g, e, hurt) => {
    const ang = Math.atan2(e.facing.y, e.facing.x), t = e.walkT || 0, moving = !!e.moving, biting = e.attackT > 0;
    const body = hurt ? '#ffb0b0' : '#5f7a5a', dark = hurt ? '#d98080' : '#38493a', belly = hurt ? '#f0c0c0' : '#7d907a';
    const ash = hurt ? '#f8dada' : '#b8bdb5', spine = hurt ? '#c07070' : '#2c3a2e', claw = '#d9d0c0';
    const tw = Math.sin(time * 3 + (moving ? t * 0.5 : 0)) * 4;   // tail sway
    g.save(); g.rotate(ang);
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(-2, 0, 26, 17, 0, 0, 7); g.fill();
    // tail: short and thick, tapering
    g.strokeStyle = body; g.lineCap = 'round'; g.lineWidth = 9; g.beginPath(); g.moveTo(-16, 0); g.quadraticCurveTo(-26, tw, -34, tw * 0.6); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(-34, tw * 0.6); g.lineTo(-42, tw); g.stroke();
    // legs: four, splayed wide, stepping
    g.strokeStyle = dark; g.lineWidth = 6;
    for (let k = 0; k < 4; k++) {
      const side = k % 2 ? 1 : -1, front = k < 2, bx = front ? 9 : -9;
      const ph = moving ? Math.sin(t + (front ? 0 : Math.PI) + (side > 0 ? Math.PI : 0)) * 5 : 0;
      g.beginPath(); g.moveTo(bx, side * 8); g.lineTo(bx + ph, side * 17); g.lineTo(bx + ph + 2, side * 22); g.stroke();
      g.fillStyle = claw; for (let c = -1; c <= 1; c++) { g.beginPath(); g.arc(bx + ph + 2 + c * 3, side * 24, 1.3, 0, 7); g.fill(); }
    }
    // body: low and wide, a lighter belly stripe along the flank
    g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 21, 15, 0, 0, 7); g.fill();
    g.fillStyle = belly; g.beginPath(); g.ellipse(-2, 0, 15, 8, 0, 0, 7); g.fill();
    // ash dust: pale flecks settled on the back
    g.fillStyle = ash; for (const [ox, oy, r] of [[-12, -6, 2], [-6, 8, 1.6], [3, -9, 1.8], [9, 6, 1.4], [-15, 4, 1.2], [12, -3, 1.2], [-3, 2, 1]]) { g.beginPath(); g.arc(ox, oy, r, 0, 7); g.fill(); }
    // small back spines along the ridge
    g.fillStyle = spine; for (let s = -14; s <= 10; s += 6) { g.beginPath(); g.moveTo(s - 2, -1); g.lineTo(s, -6); g.lineTo(s + 2, -1); g.closePath(); g.fill(); }
    // neck + blunt head
    g.strokeStyle = body; g.lineWidth = 11; g.beginPath(); g.moveTo(16, 0); g.lineTo(24, 0); g.stroke();
    g.fillStyle = body; g.beginPath(); g.ellipse(30, 0, 9, 7.5, 0, 0, 7); g.fill();
    g.fillStyle = dark; g.beginPath(); g.ellipse(36, 0, 5, 4.5, 0, 0, 7); g.fill(); // snout
    if (biting) { g.fillStyle = '#2a1a1a'; g.beginPath(); g.moveTo(38, -3); g.lineTo(43, 0); g.lineTo(38, 3); g.closePath(); g.fill(); } // open jaw
    g.strokeStyle = spine; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(27, -5); g.lineTo(23, -10); g.moveTo(27, 5); g.lineTo(23, 10); g.stroke(); // stub horns
    g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(32, -3.5, 1.7, 0, 7); g.arc(32, 3.5, 1.7, 0, 7); g.fill(); // red eyes
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(39, -1.4, 0.7, 0, 7); g.arc(39, 1.4, 0.7, 0, 7); g.fill(); // nostrils
    g.restore();
  };

  // ---------- world ----------
  // The dragons file (27) carves the Ashfields before this runs; clear a 3x3 of open ash under each
  // drake so none wakes inside a dead tree, obsidian or a lava pool. Without that file they sit on grass.
  HOOKS.world.push((rnd, api) => {
    const ours = ['ASH', 'LAVA', 'OBSIDIAN', 'DEADTREE', 'DRAGONBONES'].filter(n => n in T).map(n => T[n]);
    if ('ASH' in T) for (const [x, y] of AD_SPAWNS) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ours.includes(api.tileAt(x + dx, y + dy))) api.setTile(x + dx, y + dy, T.ASH);
    api.spawnList('ash_drake', AD_SPAWNS);
  });

  // ---------- kill bonus XP ----------
  HOOKS.kill.push(m => {
    const def = MONSTER_DEFS[m.type]; if (!def || (def.level | 0) < AD_KILL_BONUS_MIN_LEVEL || window.__companionHit) return;
    const xp = def.level * AD_KILL_BONUS_PER_LEVEL;
    const skill = weaponDef() && weaponDef().weapon && weaponDef().weapon.ranged && !player.mech ? 'range' : 'melee';
    // a boss kill's own banner (CHAPTER 4 COMPLETE, THE FANG IS SLAIN) was set by an earlier kill hook; a level-up
    // in the same tick must not overwrite it, so the level is announced beside the knight instead
    const banner = levelBanner;
    gainXp(skill, xp);
    if (banner && banner.t > 0 && banner.sub !== 'Level up' && levelBanner !== banner) { levelBanner = banner; floatText(player.x, player.y - 58, `${skill === 'range' ? 'Range' : 'Melee'} level ${skillLv(skill)}!`, '#ffd166', 14); }
    AD.stats.bonuses++; AD.stats.last = { type: m.type, xp, skill };
    floatText(m.x, m.y - m.r - 22, `+${xp} ${skill === 'range' ? 'Range' : 'Melee'} xp`, '#58a6ff', 13);
  });

  // ---------- kid mode ----------
  const kidHeal = lost => {
    const heal = Math.min(Math.ceil(lost * AD_KID_HEAL), player.maxHp - player.hp); if (heal <= 0) return 0;
    player.hp += heal; AD.stats.kidHeals++; floatText(player.x, player.y - 40, `+${heal} kid mode`, '#7ee787', 12); return heal;
  };
  HOOKS.hurt.push(dmg => { if (!window.__kidmode || player.dead) return; kidHeal(dmg); AD.lastHp = player.hp; });
  HOOKS.update.push(() => {
    if (!window.__kidmode || player.dead) { AD.lastHp = player.hp; return; }
    const drop = AD.lastHp === null ? 0 : AD.lastHp - player.hp;
    if (drop >= 1) kidHeal(drop);   // hp written directly (lava burn); hits through hurtPlayer were already healed above
    AD.lastHp = player.hp;
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const meleeWeapon = () => { const w = weaponDef(); if (w && w.weapon && !w.weapon.ranged) return; if (countItem('iron_dagger') < 1) h.give('iron_dagger', 1); equipItem(player.inv.findIndex(s => s && s.id === 'iron_dagger')); };
    const killByHand = m => { m.hp = 1; m.stunT = 0; for (let i = 0; i < 80 && !m.dead; i++) { m.x = player.x + 40; m.y = player.y; m.stunT = 0; m.state = 'idle'; player.attackCd = 0; F.press('Space'); F.sim(3, []); } return m.dead; };
    h.peace(true); window.__kidmode = false;
    // 1. drakes spawn round the farm with the def
    const drakes = monsters.filter(m => m.type === 'ash_drake'), d = MONSTER_DEFS.ash_drake;
    check('ashdrake: four wingless level-30 drakes wake round Dunstan\'s farm on open ground (hp 120, no fire, aggressive, dung every kill)',
      drakes.length === 4 && d.level === 30 && d.hp === 120 && d.maxHit === 12 && d.def === 20 && drakes.every(m => m.angry && !SOLID.has(tileAt(Math.floor(m.home.x / TILE), Math.floor(m.home.y / TILE))) && Math.abs(m.home.x / TILE - 66) < 20 && m.home.y / TILE > 96)
        && d.drops.always.some(r => r[0] === 'dragon_dung' && r[1] === 1 && r[2] === 1) && d.drops.table.some(r => r[0] === 'dragon_scale'),
      { drakes: drakes.length, homes: drakes.map(m => [Math.floor(m.home.x / TILE), Math.floor(m.home.y / TILE), tileAt(Math.floor(m.home.x / TILE), Math.floor(m.home.y / TILE))]) });
    // 2. kill one: dung on the ground, and the kill bonus (300 melee xp for level 30)
    { const m = drakes[0]; const hx = Math.floor(m.home.x / TILE), hy = Math.floor(m.home.y / TILE); F.tp(hx, hy); player.facing = { x: 1, y: 0 }; meleeWeapon();
      const d0 = countItem('dragon_dung'), mx0 = player.skills.melee.xp, b0 = AD.stats.bonuses; const dead = killByHand(m);
      const dung = drops.some(x => x.id === 'dragon_dung' && dist(x.x, x.y, player.x, player.y) < 120) || countItem('dragon_dung') > d0;
      check('ashdrake: a slain drake always drops dragon dung', dead && dung, { dead, dung, near: drops.filter(x => dist(x.x, x.y, player.x, player.y) < 120).map(x => x.id) });
      check('ashdrake: kill bonus — a level-30 kill pays +300 Melee xp on top of damage xp', dead && AD.stats.bonuses === b0 + 1 && AD.stats.last && AD.stats.last.type === 'ash_drake' && AD.stats.last.xp === 300 && player.skills.melee.xp >= mx0 + 300 + 4, { bonuses: AD.stats.bonuses - b0, last: AD.stats.last, gained: player.skills.melee.xp - mx0 });
      m.x = m.home.x; m.y = m.home.y; }
    { const gob = monsters.find(m => m.type === 'goblin' && !m.dead); const o = h.openSpot(40, 20); F.tp(o.x, o.y); player.facing = { x: 1, y: 0 };
      const b0 = AD.stats.bonuses, mx0 = player.skills.melee.xp; const dead = killByHand(gob);
      check('ashdrake: kill bonus — a level-2 goblin pays no bonus (only the 4 xp per damage)', dead && AD.stats.bonuses === b0 && player.skills.melee.xp - mx0 <= 4 * playerMaxHit() * 3, { dead, bonuses: AD.stats.bonuses - b0, gained: player.skills.melee.xp - mx0 }); gob.x = gob.home.x; gob.y = gob.home.y; }
    // 3. kid mode: a quarter of each hit back, a barely-lethal hit survived, direct hp writes caught by the tracker
    { F.tp(60, 100); F.sim(2, []); window.__kidmode = true; player.hp = Math.min(player.maxHp, 40); const hp0 = player.hp;
      hurtPlayer(20, player.x + 10, player.y, true); const afterHit = player.hp;
      F.sim(1, []); player.hp -= 8; F.sim(1, []); const afterBurn = player.hp;
      player.hp = 10; hurtPlayer(12, player.x + 10, player.y, true); const survived = !player.dead && player.hp === 1;
      window.__kidmode = false; player.hp = player.maxHp; AD.lastHp = null;
      check('ashdrake: kid mode (window.__kidmode) heals 25% of every hit at once, catches direct hp burns, and turns a barely-lethal hit into 1 hp', afterHit === hp0 - 15 && afterBurn >= hp0 - 15 - 8 + 2 && afterBurn < hp0 - 15 - 8 + 3 && survived, { hp0, afterHit, afterBurn, survived, heals: AD.stats.kidHeals }); }
    // 4. Dunstan pays 3 a potato, 20 a visit
    { const dun = NPCS.find(n => n.id === 'dunstan'); const q = quest.dragons || (quest.dragons = {}); if ((q.stage | 0) < 2) { q.stage = 2; q.salve = true; }
      while (countItem('potato') > 0) removeItem('potato', countItem('potato')); h.clearJunk(); h.give('potato', 25); const c0 = coins();
      F.tp(dun.x, dun.y + 1); F.face(dun.x, dun.y); drain(); F.press('KeyE'); F.sim(2, []); const first = coins() - c0, left1 = countItem('potato'); closePanel();
      F.face(dun.x, dun.y); drain(); F.press('KeyE'); F.sim(2, []); const second = coins() - c0 - first, left2 = countItem('potato'); closePanel(); drain();
      check('ashdrake: Dunstan buys potatoes at 3 coins (their value), at most 20 per hand-in', dun && first === 60 && left1 === 5 && second === 15 && left2 === 0 && ITEMS.potato.value === 3, { first, left1, second, left2 }); }
    // 5. the Godly gate is 32–40 now
    { const lv = RECIPES.filter(r => r.out.startsWith('godly_')).map(r => r.lv).sort((a, b) => a - b);
      check('ashdrake: Godly recipes sit at Smithing 32 / 34 / 36 / 40 (was 40–48)', lv.join(',') === '32,34,36,40' && lv.every(x => x >= 32 && x <= 40), { lv }); }
    // 6. the 28–40 filler: 3 scales smelt into a plate at Brakka's forge (Smithing 28), a plate smiths into a scale helm (29)
    { h.clearJunk(); while (countItem('dragon_scale') < 3) h.give('dragon_scale', 1); if (!hasTool('hammer')) h.give('hammer', 1);
      if (player.skills.smithing.xp < XP_TABLE[29]) player.skills.smithing.xp = XP_TABLE[29];
      const sc0 = countItem('dragon_scale'), p0 = countItem('scale_plate'), h0 = countItem('scale_helm'), sx0 = player.skills.smithing.xp;
      F.tp(93, 39); F.walkTo(92, 38, 500); F.face(92, 37); F.press('KeyE'); const forge = panel === 'station' && panelArg === 'forge';
      const c1 = F.clickButton('3 Dragon scales → Scale plate'); const s1 = F.untilAction(300, () => countItem('scale_plate') > p0); closePanel();
      const sx1 = player.skills.smithing.xp;
      F.walkTo(94, 39, 500); F.face(94, 38); F.press('KeyE'); const anvil = panel === 'station' && panelArg === 'anvil';
      let viaButton = F.clickButton('1 Scale plate → Scale helm'); if (!viaButton) craft(RECIPES.find(r => r.out === 'scale_helm')); // the anvil list is cut short on small screens
      const s2 = F.untilAction(300, () => countItem('scale_helm') > h0); closePanel();
      const smelt = SMELT.find(r => r.out === 'scale_plate'), helm = RECIPES.find(r => r.out === 'scale_helm'), shield = RECIPES.find(r => r.out === 'scale_shield');
      check('ashdrake: 3 dragon scales smelt into a scale plate (Smithing 28, 60 xp); a plate smiths into a scale helm (29, def 12); 2 plates → scale shield (30, def 16)',
        forge && c1 && typeof s1 === 'number' && anvil && typeof s2 === 'number' && countItem('dragon_scale') === sc0 - 3 && countItem('scale_plate') === p0 && countItem('scale_helm') === h0 + 1
          && sx1 === sx0 + 60 && player.skills.smithing.xp === sx1 + 90 && smelt.lv === 28 && helm.lv === 29 && shield.lv === 30 && shield.needs[0][1] === 2 && ITEMS.scale_helm.armour.def === 12 && ITEMS.scale_shield.armour.def === 16 && ITEMS.scale_plate.value === 90,
        { forge, c1, s1, anvil, viaButton, s2, plates: countItem('scale_plate'), helms: countItem('scale_helm'), xp: [sx1 - sx0, player.skills.smithing.xp - sx1] });
      removeItem('scale_helm', 1); }
    // 7. the walker on-ramp and the Chapter 5 dragons carry the audit's numbers
    check('ashdrake: walker 110 hp / def 12 / max hit 11, brute def 7, green dragon 220 hp, red dragon max hit 24',
      MONSTER_DEFS.walker.hp === 110 && MONSTER_DEFS.walker.def === 12 && MONSTER_DEFS.walker.maxHit === 11 && MONSTER_DEFS.brute.def === 7 && MONSTER_DEFS.green_dragon.hp === 220 && MONSTER_DEFS.red_dragon.maxHit === 24,
      { walker: [MONSTER_DEFS.walker.hp, MONSTER_DEFS.walker.def, MONSTER_DEFS.walker.maxHit], brute: MONSTER_DEFS.brute.def });
    h.peace(false);
  });
}
