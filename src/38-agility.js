// ============================================================================
// AGILITY, HITPOINTS AND SKILL CAPES — src/38-agility.js
// Cohen's design: "agility courses where you level up by doing laps, and shortcuts"; "when you level up you get more
// health, one per level, max level 100, end with 100"; "when you get a level 100 you get a skill cape that has abilities".
//
// Two new skills (Hitpoints, Agility), two courses (Thistledown yard, Grey Quarry cliff), two shortcuts (Miller's Pond
// stepping stones at Agility 10, the Goblin Camp's crumbling palisade at Agility 25), and the Master of Skills in the
// castle courtyard who sells a cape for any level-99 skill (999 coins, 'cape' slot, an ability each).
//
// Wrappers by reassignment (each captures the previous binding; all are documented here):
//   gainXp          — Melee/Range xp also grants Hitpoints xp at 1/3 (RuneScape style); the Crafting cape adds 10% Crafting xp
//   recomputeMaxHp  — REPLACED: maxHp = 24 + Hitpoints level (+10% with the Hitpoints cape). Level 1 = 25 as before, 76 = 100, 99 = 123.
//                     The original defence/melee/range formula is not called afterwards (it would overwrite the value). The
//                     level-up heal lives in the core gainXp, which still calls recomputeMaxHp after every level.
//   playerMaxHit    — Melee cape: +5% melee max hit (at least +1); Range cape: the same for arrows
//   useItem         — Cooking cape: eaten food heals +2 more
//   finishLightFire — Firemaking cape: a fire you light burns 3x as long
//   load            — makes sure every skill has a cape item before the loader drops "unknown" items
//   panelBox        — the 'Your pack' panel grows to fit the sixth worn slot (cape)
//   drawItemIcon    — draws the 'cape' item shape (the core draws a disc for unknown shapes)
// Save state: quest.agility = { laps: { yard, cliff }, next: { yard, cliff } } (reset in HOOKS.newGame); player.hpSeeded
// marks a save whose Hitpoints xp was seeded once from its Melee + Range xp (older saves predate the skill).
//
// window.AGILITY (the bottom of this file) lets a later feature file register its own course on this machinery —
// the same flags, laps, xp, obstacle tiles, slip/fall messages and drawing. 48-agility2 adds two courses through it.
// A course may carry `bonus` and `bonusEvery`; without them it gets the default LAP_BONUS every LAP_BONUS_EVERY laps.
// ============================================================================
{
  // ---------- skills ----------
  SKILL_DEFS.push({ key: 'hitpoints', name: 'Hitpoints' }, { key: 'agility', name: 'Agility' });
  for (const s of SKILL_DEFS) if (!player.skills[s.key]) player.skills[s.key] = { xp: 0 }; // the boot player was made before this file loaded
  const agLv = () => player.skills.agility ? skillLv('agility') : 1;
  const capeOf = () => { const c = player.equip.cape; return (c && ITEMS[c] && ITEMS[c].capeSkill) || null; };
  const hasCape = k => capeOf() === k;

  const _gainXp = gainXp;
  gainXp = (key, amount) => {
    if (key === 'crafting' && hasCape('crafting')) amount = Math.ceil(amount * 1.1);
    _gainXp(key, amount);
    if ((key === 'melee' || key === 'range') && amount >= 3 && player.skills.hitpoints) _gainXp('hitpoints', Math.floor(amount / 3));
  };
  recomputeMaxHp = () => {
    let max = 24 + (player.skills.hitpoints ? skillLv('hitpoints') : 1);
    if (hasCape('hitpoints')) max = Math.floor(max * 1.1);
    player.maxHp = max; if (player.hp > max) player.hp = max;
  };

  // ---------- capes ----------
  const CAPE_COLOR = { melee: '#d9822b', defence: '#4c7dd0', range: '#3f9a4f', woodcutting: '#7a5230', mining: '#7d8088', fishing: '#4aa3df', cooking: '#8b3a62', firemaking: '#ff8a1a', farming: '#6ab04c', smithing: '#c0c4cc', crafting: '#c9a36a', hitpoints: '#e63946', agility: '#2b8c8c' };
  const CAPE_ABILITY = { melee: '+5% max hit', defence: '10% less damage taken', range: '+5% arrow max hit', woodcutting: 'Chop 25% faster', mining: 'Mine 25% faster', fishing: 'Fish 25% faster', cooking: 'Food heals +2', firemaking: 'Fires last 3x longer', farming: 'Crops grow 2x faster', smithing: 'Smith and smelt 30% faster', crafting: '+10% crafting xp', hitpoints: '+10% max health', agility: 'Never slip on a log' };
  const CAPE_PRICE = 999;
  EQUIP_SLOTS.push('cape');
  const capeId = key => 'cape_' + key;
  function ensureCapes() {
    for (const s of SKILL_DEFS) {
      const id = capeId(s.key); if (ITEMS[id]) continue;
      ITEMS[id] = { id, name: `${s.name} cape`, value: CAPE_PRICE, color: CAPE_COLOR[s.key] || '#c9a36a', shape: 'cape', stack: 1, armour: { slot: 'cape', def: 5 }, capeSkill: s.key };
    }
  }
  ensureCapes();
  const _load = load;
  load = () => { ensureCapes(); return _load(); };
  // buy a cape: level 99 and 999 coins. Returns true when the cape is in the pack.
  function buyCape(key) {
    ensureCapes(); const def = SKILL_DEFS.find(s => s.key === key); if (!def) return false;
    if (skillLv(key) < 99) { notify(`${def.name} 99 first. You are ${skillLv(key)}.`); return false; }
    if (coins() < CAPE_PRICE) { notify(`A cape is ${CAPE_PRICE} coins. You have ${coins()}.`); return false; }
    if (!canFit(capeId(key), 1)) { notify('Your pack is full.'); return false; }
    payCoins(CAPE_PRICE); addItem(capeId(key), 1);
    levelBanner = { text: `${def.name.toUpperCase()} CAPE`, sub: CAPE_ABILITY[key] || 'Worn with pride', t: 3.5 }; sfx('levelup'); burst(player.x, player.y, CAPE_COLOR[key] || '#f5c542', 30, 160); save();
    return true;
  }
  NPCS.push(initNpc({ id: 'skillmaster', name: 'Master of Skills', x: 108, y: 44, tunic: '#2b2b40', hair: '#d9d0c0', beard: true, role: 'skillmaster' }));
  HOOKS.talk.skillmaster = n => {
    const ready = SKILL_DEFS.filter(s => skillLv(s.key) >= 99).length;
    say(ready ? `A master. I can see it in how you stand. ${CAPE_PRICE} coins for the cape, and every one of them earned.` : `Ninety-nine in a skill, and I will sell you its cape. Not before. Every cape has a trick to it. Agility is trained on the yard course south of Hale's yard, and the cliff ledge at Grey Quarry.`, n.name);
    openPanel('capes');
  };
  HOOKS.panel.capes = (g, narrow) => {
    ensureCapes(); const n = SKILL_DEFS.length;
    const rowH = clamp(Math.floor((VH - 120) / n), 20, 30);
    const { px, py, w } = panelBox(g, 470, 84 + n * rowH, 'Master of Skills', `${coins()} coins · a cape costs ${CAPE_PRICE} and needs level 99`);
    SKILL_DEFS.forEach((s, i) => {
      const y = py + 66 + i * rowH, lv = skillLv(s.key), can = lv >= 99 && coins() >= CAPE_PRICE, owned = countItem(capeId(s.key)) > 0 || player.equip.cape === capeId(s.key);
      drawItemIcon(g, capeId(s.key), px + 28, y + rowH / 2, Math.min(18, rowH - 4));
      g.fillStyle = lv >= 99 ? '#e6edf3' : '#8b949e'; g.font = `bold ${narrow ? 11 : 12}px sans-serif`; g.textAlign = 'left'; g.fillText(`${s.name}${owned ? ' ✓' : ''}`, px + 44, y + rowH / 2 + 4);
      g.fillStyle = lv >= 99 ? '#f5c542' : '#6e7681'; g.textAlign = 'right'; g.fillText(`Lv ${lv}`, px + (narrow ? 170 : 186), y + rowH / 2 + 4); g.textAlign = 'left';
      if (!narrow) { g.fillStyle = '#8b949e'; g.font = '11px sans-serif'; g.fillText(CAPE_ABILITY[s.key] || 'Worn with pride', px + 196, y + rowH / 2 + 4); }
      button(g, px + w - 100, y + 1, 84, rowH - 2, `Buy ${CAPE_PRICE}`, () => { buyCape(s.key); }, can ? '#238636' : '#2a2f3a', can);
    });
  };
  const _panelBox = panelBox;
  panelBox = (g, w, h, title, subtitle) => { if (title === 'Your pack') h = Math.max(h, 66 + EQUIP_SLOTS.length * 52 + 14); return _panelBox(g, w, h, title, subtitle); };
  const _drawItemIcon = drawItemIcon;
  drawItemIcon = (g, id, x, y, size = 18) => {
    const def = ITEMS[id]; if (!def || def.shape !== 'cape') return _drawItemIcon(g, id, x, y, size);
    const s = size / 18; g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = def.color; g.beginPath(); g.moveTo(-6, -9); g.lineTo(6, -9); g.lineTo(10, 8); g.quadraticCurveTo(5, 5, 0, 9); g.quadraticCurveTo(-5, 5, -10, 8); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(-4, -8, 1.8, 0, 7); g.arc(4, -8, 1.8, 0, 7); g.fill();
    g.restore();
  };
  // cape abilities that live in wrappers
  const _playerMaxHit = playerMaxHit;
  playerMaxHit = (ranged = false) => { const base = _playerMaxHit(ranged); return hasCape(ranged ? 'range' : 'melee') ? base + Math.max(1, Math.floor(base * 0.05)) : base; };
  const _useItem = useItem;
  useItem = slot => {
    const s = player.inv[slot]; const def = s && ITEMS[s.id]; const id = def && def.heal ? s.id : null; const n0 = id ? countItem(id) : 0;
    _useItem(slot);
    if (id && hasCape('cooking') && countItem(id) < n0 && !player.dead) { player.hp = Math.min(player.maxHp, player.hp + 2); floatText(player.x, player.y - 44, '+2 cape', '#7ee787'); }
  };
  const _finishLightFire = finishLightFire;
  finishLightFire = () => { const n = fires.length; _finishLightFire(); if (hasCape('firemaking') && fires.length > n) fires[fires.length - 1].timer *= 3; };
  HOOKS.hurt.push(dmg => { if (hasCape('defence') && !player.mech && !player.dead) { const back = Math.round(dmg * 0.1); if (back > 0) player.hp = Math.min(player.maxHp, player.hp + back); } });

  // ---------- tiles ----------
  const AG_LOG = addTile('LOG_BALANCE', { tex: 'grass', mini: '#8a5a2b' });          // balance log: slip below the required Agility (1 damage, pushed back)
  const AG_NET = addTile('NET', { tex: 'grass', mini: '#c9a36a' });                  // climbing net: speed 60 while on it
  const AG_GAP = addTile('JUMP_GAP', { tex: 'wall', mini: '#1c2230' });              // a gap: fall below the required Agility (2 damage, back to the start)
  const AG_MARK = addTile('COURSE_MARK', { tex: 'grass', mini: '#f5c542' });         // checkpoint flag
  const AG_STONE = addTile('STEPPING_STONE', { solid: true, tex: 'water', mini: '#8d9098' }); // solid until Agility 10 (WALK_OVER)
  const AG_CLIMB = addTile('CLIMB', { solid: true, tex: 'grass', mini: '#8a6a3a' }); // crumbling palisade: solid until Agility 25 (WALK_OVER)
  const STONE_LV = 10, CLIMB_LV = 25;

  // ---------- courses ----------
  // marks[0] is the start/finish; a lap = marks 1..N in order, then the start again
  const COURSES = {
    yard: { name: 'Thistledown yard course', xp: 60, marks: [[86, 51], [93, 51], [98, 51], [99, 53], [92, 53]] },
    cliff: { name: 'Grey Quarry cliff course', xp: 200, marks: [[47, 1], [53, 1], [57, 1], [60, 3], [52, 3]] },
  };
  const LAP_BONUS_EVERY = 5, LAP_BONUS = 10;
  const OBST = new Map(); // "tx,ty" → { t, lv, course }
  const MARKS = new Map(); // "tx,ty" → { course, i }
  const key = (x, y) => x + ',' + y;
  const obst = (course, t, lv, cells) => { for (const [x, y] of cells) OBST.set(key(x, y), { t, lv, course }); };
  for (const c in COURSES) COURSES[c].marks.forEach(([x, y], i) => MARKS.set(key(x, y), { course: c, i }));
  const isCliff = (tx, ty) => tx >= 46 && tx <= 62 && ty >= 1 && ty <= 4;
  // yard: a fenced one-tile track (gate at 93,54) south of the houses under Hale's yard
  obst('yard', AG_LOG, 1, [[88, 51], [89, 51], [90, 51], [91, 51], [89, 53], [88, 53]]);
  obst('yard', AG_NET, 1, [[95, 51], [96, 51]]);
  obst('yard', AG_GAP, 1, [[101, 52], [96, 53]]);
  // cliff: a ledge loop cut into the rock along the quarry's north edge (exit west at 46,2; entrance south at 54,4)
  obst('cliff', AG_LOG, 20, [[49, 1], [50, 1], [51, 1], [52, 1], [50, 3], [49, 3]]);
  obst('cliff', AG_GAP, 20, [[55, 1]]);
  obst('cliff', AG_NET, 1, [[59, 1], [60, 1]]);
  obst('cliff', AG_GAP, 30, [[57, 3]]);
  const STONES = []; for (let y = 31; y <= 40; y++) STONES.push([43, y]); // Miller's Pond, north shore (43,30) to south shore (43,41)
  const CLIMB_AT = [158, 30]; // Goblin Camp palisade, east side

  HOOKS.world.push((rnd, api) => {
    const set = api.setTile;
    // yard
    for (let y = 50; y <= 55; y++) for (let x = 86; x <= 102; x++) set(x, y, T.GRASS);
    for (let x = 86; x <= 102; x++) { set(x, 50, T.FENCE); set(x, 54, T.FENCE); }
    for (let y = 50; y <= 54; y++) set(102, y, T.FENCE);
    for (let x = 87; x <= 100; x++) set(x, 52, T.FENCE);
    for (let x = 86; x <= 101; x++) { set(x, 51, T.DIRT); set(x, 53, T.DIRT); }
    set(86, 52, T.DIRT); set(101, 52, T.DIRT); set(93, 54, T.GATE);
    // cliff
    for (let y = 1; y <= 4; y++) for (let x = 46; x <= 62; x++) set(x, y, T.WALL);
    for (let x = 47; x <= 61; x++) { set(x, 1, T.CAVE); set(x, 3, T.CAVE); }
    set(47, 2, T.CAVE); set(61, 2, T.CAVE); set(46, 2, T.DIRT); set(54, 4, T.DIRT);
    if (SOLID.has(api.tileAt(54, 5))) set(54, 5, T.DIRT); if (SOLID.has(api.tileAt(45, 2))) set(45, 2, T.DIRT);
    // obstacles and flags
    for (const [k, o] of OBST) { const [x, y] = k.split(',').map(Number); set(x, y, o.t); }
    for (const [k] of MARKS) { const [x, y] = k.split(',').map(Number); set(x, y, AG_MARK); }
    // shortcuts
    for (const [x, y] of STONES) set(x, y, AG_STONE);
    set(CLIMB_AT[0], CLIMB_AT[1], AG_CLIMB);
  });

  // ---------- state ----------
  const fresh = () => ({ laps: { yard: 0, cliff: 0 }, next: { yard: 0, cliff: 0 } });
  const AG = () => { if (!quest.agility) quest.agility = fresh(); for (const c in COURSES) { if (quest.agility.laps[c] === undefined) quest.agility.laps[c] = 0; if (quest.agility.next[c] === undefined) quest.agility.next[c] = 0; } return quest.agility; };
  HOOKS.newGame.push(() => { quest.agility = fresh(); lastTile = null; hintT = 0; lastCape = null; });
  let lastTile = null; // { tx, ty } the knight stood on last tick (slips push back to it)
  let hintT = 0, lastCape = null;

  function courseStart(c) { const [x, y] = COURSES[c].marks[0]; return { x: tc(x), y: tc(y) }; }
  function touchMark(m) {
    const a = AG(), c = COURSES[m.course], N = c.marks.length - 1, nx = a.next[m.course];
    if (m.i === 0) {
      if (nx === N + 1) {
        a.laps[m.course] += 1; a.next[m.course] = 1;
        gainXp('agility', c.xp); floatText(player.x, player.y - 34, `Lap ${a.laps[m.course]}! +${c.xp} Agility xp`, '#7ee787', 16); burst(player.x, player.y, '#7ee787', 16, 100); sfx('quest');
        const every = c.bonusEvery || LAP_BONUS_EVERY, bonus = c.bonus || LAP_BONUS;   // a registered course may set its own purse
        if (a.laps[m.course] % every === 0) { giveOrDrop('coins', bonus, player.x, player.y); notify(`${every} laps of the ${c.name}: ${bonus} coins.`); }
        save();
      } else { a.next[m.course] = 1; floatText(player.x, player.y - 34, nx === 0 ? `${c.name}: touch the flags in order` : 'Go!', '#f5c542', 14); }
    } else if (m.i === nx) { a.next[m.course] = nx + 1; floatText(player.x, player.y - 34, `Flag ${m.i} of ${N}`, '#f5c542', 14); sfx('pickup'); }
    else if (nx >= 1) floatText(player.x, player.y - 34, 'Wrong way', '#8b949e', 13);
  }
  function enterObstacle(o, tx, ty) {
    const lv = agLv();
    if (o.t === AG_LOG) {
      if (lv >= o.lv || hasCape('agility')) return;
      const back = lastTile && !(lastTile.tx === tx && lastTile.ty === ty) ? lastTile : null;
      hurtPlayer(1, tc(tx), tc(ty), true); floatText(player.x, player.y - 40, `Slipped! Agility ${o.lv} for this log`, '#ff6b6b', 13); burst(player.x, player.y, '#8a5a2b', 8, 60);
      if (back && !player.dead) { const bx = tc(back.tx), by = tc(back.ty); if (!collides(bx, by, player.r, playerWho())) { player.x = bx; player.y = by; } }
    } else if (o.t === AG_GAP) {
      if (lv >= o.lv) { floatText(player.x, player.y - 36, 'Jump!', '#8fb4ff', 13); return; }
      hurtPlayer(2, tc(tx), tc(ty) + 1, true); floatText(player.x, player.y - 40, `You fell! Agility ${o.lv} for this gap`, '#ff6b6b', 13); burst(player.x, player.y, '#1c2230', 12, 80);
      const a = AG(); a.next[o.course] = 0;
      if (!player.dead) { const s = courseStart(o.course); const spot = safeSpot(s.x, s.y, player.r, playerWho()) || s; player.x = spot.x; player.y = spot.y; player.action = null; }
    }
  }
  HOOKS.update.push(dt => {
    // hitpoints for older saves: seed once from the melee + range xp that would have fed it
    if (!player.hpSeeded) { const m = player.skills.melee.xp + player.skills.range.xp; if (m > 0 && player.skills.hitpoints.xp === 0) player.skills.hitpoints.xp = Math.floor(m / 3); player.hpSeeded = true; recomputeMaxHp(); }
    // the cape slot changed: max hp follows the Hitpoints cape
    const cape = player.equip.cape || null; if (cape !== lastCape) { lastCape = cape; recomputeMaxHp(); }
    // shortcuts open with the level
    if (agLv() >= STONE_LV) WALK_OVER.add(AG_STONE); else WALK_OVER.delete(AG_STONE);
    if (agLv() >= CLIMB_LV) WALK_OVER.add(AG_CLIMB); else WALK_OVER.delete(AG_CLIMB);
    // cape abilities on timed actions and crops
    const a = player.action;
    if (a && !a.agCape) {
      a.agCape = true;
      const k = a.type === 'chop' ? 'woodcutting' : a.type === 'mine' ? 'mining' : a.type === 'fish' ? 'fishing' : (a.type === 'smith' || a.type === 'smelt') ? 'smithing' : null;
      if (k && hasCape(k)) a.need *= k === 'smithing' ? 0.7 : 0.75;
    }
    if (hasCape('farming')) for (const c of crops) c.t += dt;
    if (player.dead || player.mech) { lastTile = null; if (player.speed === 60) player.speed = 175; return; }
    const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE), t = tileAt(tx, ty);
    // climbing net: slow while on it
    if (t === AG_NET && player.speed === 175) player.speed = 60; else if (t !== AG_NET && player.speed === 60) player.speed = 175;
    const changed = !lastTile || lastTile.tx !== tx || lastTile.ty !== ty;
    if (changed) {
      const m = MARKS.get(key(tx, ty)), o = OBST.get(key(tx, ty));
      if (m && t === AG_MARK) touchMark(m);
      else if (o && t === o.t) enterObstacle(o, tx, ty);
    }
    // a hint when a locked shortcut is right there
    hintT = Math.max(0, hintT - dt);
    if (hintT <= 0) {
      const near = (cells, r) => cells.some(([x, y]) => dist(player.x, player.y, tc(x), tc(y)) < r);
      if (agLv() < STONE_LV && near(STONES, 1.6 * TILE)) { notify(`Stepping stones. Agility ${STONE_LV} to cross the pond here.`); hintT = 12; }
      else if (agLv() < CLIMB_LV && near([CLIMB_AT], 1.6 * TILE)) { notify(`A crumbling stretch of palisade. Agility ${CLIMB_LV} to climb it.`); hintT = 12; }
    }
    lastTile = { tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) };
  });

  // ---------- drawing ----------
  const flat = (tx, ty) => -1e8 + ty * TILE + tx * 0.01;
  function drawLog(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE; const horiz = tileAt(tx - 1, ty) === AG_LOG || tileAt(tx + 1, ty) === AG_LOG || !(tileAt(tx, ty - 1) === AG_LOG || tileAt(tx, ty + 1) === AG_LOG);
    g.save(); g.translate(x + TILE / 2, y + TILE / 2); if (!horiz) g.rotate(Math.PI / 2);
    const endL = horiz ? tileAt(tx - 1, ty) !== AG_LOG : tileAt(tx, ty - 1) !== AG_LOG, endR = horiz ? tileAt(tx + 1, ty) !== AG_LOG : tileAt(tx, ty + 1) !== AG_LOG;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-TILE / 2, -4, TILE, 20);
    g.fillStyle = '#8a5a2b'; g.fillRect(-TILE / 2, -9, TILE, 18);
    g.strokeStyle = 'rgba(60,35,10,0.5)'; g.lineWidth = 1.5; for (const yy of [-4, 1, 6]) { g.beginPath(); g.moveTo(-TILE / 2, yy); g.quadraticCurveTo(0, yy + 2, TILE / 2, yy); g.stroke(); }
    g.fillStyle = '#e8d3a8'; if (endL) { g.beginPath(); g.ellipse(-TILE / 2 + 3, 0, 4, 9, 0, 0, 7); g.fill(); g.strokeStyle = '#a07a4a'; g.beginPath(); g.ellipse(-TILE / 2 + 3, 0, 2, 5, 0, 0, 7); g.stroke(); }
    if (endR) { g.beginPath(); g.ellipse(TILE / 2 - 3, 0, 4, 9, 0, 0, 7); g.fill(); g.strokeStyle = '#a07a4a'; g.beginPath(); g.ellipse(TILE / 2 - 3, 0, 2, 5, 0, 0, 7); g.stroke(); }
    g.restore();
  }
  function drawNet(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    g.strokeStyle = '#c9a36a'; g.lineWidth = 2;
    for (let k = 6; k < TILE; k += 9) { g.beginPath(); g.moveTo(x + k, y + 2); g.lineTo(x + k, y + TILE - 2); g.stroke(); g.beginPath(); g.moveTo(x + 2, y + k); g.lineTo(x + TILE - 2, y + k); g.stroke(); }
    g.fillStyle = '#6a4a2a'; g.fillRect(x + 1, y + 1, 5, TILE - 2); g.fillRect(x + TILE - 6, y + 1, 5, TILE - 2);
  }
  function drawGap(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#0d1420'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = 'rgba(20,40,70,0.9)'; g.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
    g.strokeStyle = 'rgba(120,160,220,0.35)'; g.lineWidth = 1.5; for (let k = 0; k < 3; k++) { const yy = y + 14 + k * 10 + Math.sin(time * 2 + k + tx) * 2; g.beginPath(); g.moveTo(x + 10, yy); g.quadraticCurveTo(x + 24, yy - 3, x + 38, yy); g.stroke(); }
    g.fillStyle = '#7a5230'; g.fillRect(x, y, TILE, 4); g.fillRect(x, y + TILE - 4, TILE, 4); g.fillRect(x, y, 4, TILE); g.fillRect(x + TILE - 4, y, 4, TILE);
  }
  function drawMark(g, tx, ty, m) {
    const x = tx * TILE, y = ty * TILE; const a = AG(); const N = COURSES[m.course].marks.length - 1;
    const next = a.next[m.course] === m.i || (m.i === 0 && a.next[m.course] === N + 1);
    const pulse = next ? 1 + Math.sin(time * 6) * 0.12 : 1;
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.arc(x + TILE / 2, y + TILE / 2, 14, 0, 7); g.fill();
    g.fillStyle = '#5a4a3a'; g.fillRect(x + 18, y + 8, 3, 34);
    g.fillStyle = m.i === 0 ? '#3fb950' : next ? '#ffd166' : '#f5c542'; g.beginPath(); g.moveTo(x + 21, y + 8); g.lineTo(x + 21 + 20 * pulse, y + 14); g.lineTo(x + 21, y + 20); g.closePath(); g.fill();
    g.fillStyle = '#1b1f27'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText(m.i === 0 ? 'S' : String(m.i), x + 27, y + 17);
  }
  function drawStone(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.strokeStyle = 'rgba(210,235,255,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x + TILE / 2, y + TILE / 2 + 2, 19 + Math.sin(time * 2 + ty) * 1.5, 12, 0, 0, 7); g.stroke();
    g.fillStyle = '#6e7178'; g.beginPath(); g.ellipse(x + TILE / 2 + 1, y + TILE / 2 + 3, 15, 10, 0, 0, 7); g.fill();
    g.fillStyle = '#9a9da5'; g.beginPath(); g.ellipse(x + TILE / 2, y + TILE / 2, 15, 10, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(x + TILE / 2 - 4, y + TILE / 2 - 3, 6, 3, 0, 0, 7); g.fill();
  }
  function drawClimb(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#5a4a3a'; g.fillRect(x + 4, y + 30, TILE - 8, 8);
    g.fillStyle = '#8a6a3a'; for (const [dx, h, tilt] of [[8, 26, -0.15], [20, 14, 0.1], [32, 20, 0.25]]) { g.save(); g.translate(x + dx, y + TILE - 6); g.rotate(tilt); g.fillRect(-3, -h, 6, h); g.fillStyle = '#a5763f'; g.beginPath(); g.moveTo(-3, -h); g.lineTo(0, -h - 5); g.lineTo(3, -h); g.closePath(); g.fill(); g.fillStyle = '#8a6a3a'; g.restore(); }
    g.fillStyle = '#7a6a5a'; g.beginPath(); g.arc(x + 14, y + 42, 3, 0, 7); g.arc(x + 38, y + 40, 2.5, 0, 7); g.arc(x + 26, y + 44, 2, 0, 7); g.fill();
  }
  const COURSE_TILES = new Set([AG_LOG, AG_NET, AG_GAP, AG_MARK]);
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 1);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (COURSE_TILES.has(t)) {
        items.push({ y: flat(tx, ty), draw: () => {
          if (isCliff(tx, ty) && t !== AG_GAP) { const img = tex['cave' + (variant[idx(tx, ty)] % 3)]; if (img) g.drawImage(img, tx * TILE, ty * TILE, TILE, TILE); }
          if (t === AG_LOG) drawLog(g, tx, ty); else if (t === AG_NET) drawNet(g, tx, ty); else if (t === AG_GAP) drawGap(g, tx, ty);
          else { const m = MARKS.get(key(tx, ty)); if (m) drawMark(g, tx, ty, m); }
        } });
      } else if (t === AG_STONE) items.push({ y: flat(tx, ty), draw: () => drawStone(g, tx, ty) });
      else if (t === AG_CLIMB) items.push({ y: ty * TILE + TILE - 4, draw: () => drawClimb(g, tx, ty) });
    }
    // the cape on the knight's back: drawn just under the player entry, trailing opposite the facing
    const k = capeOf();
    if (k && !player.dead && !player.mech) items.push({ y: player.y + player.r - 0.01, draw: () => drawCape(g, player, CAPE_COLOR[k] || '#c9a36a') });
  });
  function drawCape(g, e, color) {
    const bx = -e.facing.x, by = -e.facing.y, px = -by, py = bx; // trail direction and its perpendicular
    const wave = Math.sin(time * 7) * (e.moving ? 3 : 1.2), L = 18 + (e.moving ? 5 : 0);
    g.save(); g.translate(e.x, e.y + (e.moving ? Math.sin(e.walkT) * 2 : 0));
    const s1 = { x: px * 10, y: py * 10 - 2 }, s2 = { x: -px * 10, y: -py * 10 - 2 };
    const t1 = { x: s1.x + bx * L + px * 2, y: s1.y + by * L + py * 2 + 4 }, t2 = { x: s2.x + bx * L - px * 2, y: s2.y + by * L - py * 2 + 4 };
    const mid = { x: (t1.x + t2.x) / 2 + bx * (5 + wave), y: (t1.y + t2.y) / 2 + by * (5 + wave) + 3 };
    g.fillStyle = color; g.beginPath(); g.moveTo(s1.x, s1.y); g.lineTo(t1.x, t1.y); g.quadraticCurveTo(mid.x, mid.y, t2.x, t2.y); g.lineTo(s2.x, s2.y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(245,197,66,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(t1.x, t1.y); g.quadraticCurveTo(mid.x, mid.y, t2.x, t2.y); g.stroke();
    g.restore();
  }

  // ---------- courses registered by other feature files ----------
  // Everything a new course needs from this file. Register at load time (before the world is generated) and the
  // HOOKS.world pass above lays the flags and obstacles down with the yard's and the cliff's.
  window.AGILITY = {
    TILES: { LOG: AG_LOG, NET: AG_NET, GAP: AG_GAP, MARK: AG_MARK, STONE: AG_STONE, CLIMB: AG_CLIMB },
    COURSES, LAP_BONUS_EVERY, LAP_BONUS, level: agLv, state: AG,
    // def = { name, xp, marks: [[x, y], ...], bonus?, bonusEvery? }; marks[0] is the start/finish flag
    addCourse(id, def) { COURSES[id] = def; def.marks.forEach(([x, y], i) => MARKS.set(key(x, y), { course: id, i })); return def; },
    addObstacles(id, t, lv, cells) { obst(id, t, lv, cells); },
  };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const snap = () => ({ x: player.x, y: player.y, hp: player.hp, inv: player.inv.map(s => s ? { ...s } : null), equip: { ...player.equip }, skills: JSON.parse(JSON.stringify(player.skills)), speed: player.speed, agility: JSON.parse(JSON.stringify(AG())) });
    const restore = s => { player.x = s.x; player.y = s.y; player.inv = s.inv; player.equip = s.equip; player.skills = s.skills; player.speed = s.speed; quest.agility = s.agility; player.action = null; recomputeMaxHp(); player.hp = Math.min(s.hp, player.maxHp); F.step([]); };
    const tileOf = () => ({ tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) });
    const s0 = snap(); h.peace(true); closePanel(); dialog.cur = null; dialog.queue.length = 0;
    // hitpoints
    { const hp0 = { ...player.skills.hitpoints }; player.skills.hitpoints.xp = 0; player.hpSeeded = true; recomputeMaxHp(); const m0 = player.maxHp; const lv0 = skillLv('hitpoints');
      const m1 = XP_TABLE[10] * 3 + 3; gainXp('melee', m1); const lv1 = skillLv('hitpoints'), got = player.skills.hitpoints.xp; const follows = player.maxHp === 24 + lv1 && m0 === 24 + lv0 && lv0 === 1 && m0 === 25;
      player.skills.hitpoints.xp = XP_TABLE[76]; recomputeMaxHp(); const at76 = player.maxHp; player.skills.hitpoints.xp = XP_TABLE[99]; recomputeMaxHp(); const at99 = player.maxHp;
      check('agility: hitpoints skill exists, melee xp feeds it at 1/3, max hp = 24 + level (25 at 1, 100 at 76, 123 at 99)', SKILL_DEFS.some(s => s.key === 'hitpoints') && got === Math.floor(m1 / 3) && lv1 >= 10 && follows && at76 === 100 && at99 === 123, { got, want: Math.floor(m1 / 3), lv0, lv1, m0, m1: player.maxHp, at76, at99 });
      player.skills.hitpoints = hp0; recomputeMaxHp(); }
    // yard course: a lap in order gives 60 xp, out of order does not
    { const a = AG(); const yard = COURSES.yard.marks.every(([x, y]) => tileAt(x, y) === AG_MARK) && tileAt(88, 51) === AG_LOG && tileAt(95, 51) === AG_NET && tileAt(101, 52) === AG_GAP && tileAt(93, 54) === T.GATE;
      const xp0 = player.skills.agility.xp; a.next.yard = 0; const laps0 = a.laps.yard; lastTile = null;
      const go = i => { const [x, y] = COURSES.yard.marks[i]; F.tp(x, y); F.step([]); };
      go(0); go(1); go(2); go(3); go(4); go(0); const lapXp = player.skills.agility.xp - xp0, laps1 = a.laps.yard;
      const xp1 = player.skills.agility.xp; go(0); go(2); go(1); go(3); go(4); go(0); const badXp = player.skills.agility.xp - xp1;
      check('agility: yard course exists (logs, net, gaps, flags, gate); flags in order + start = 60 xp and a lap; out of order = nothing', yard && lapXp === 60 && laps1 === laps0 + 1 && badXp === 0 && a.laps.yard === laps0 + 1, { yard, lapXp, badXp, laps: a.laps.yard }); }
    // cliff log slips at Agility 1
    { const xp0 = player.skills.agility.xp; player.skills.agility.xp = 0; player.equip.cape = null; const cliff = tileAt(49, 1) === AG_LOG && tileAt(47, 1) === AG_MARK && tileAt(55, 1) === AG_GAP && tileAt(57, 3) === AG_GAP && tileAt(48, 2) === T.WALL && tileAt(46, 2) === T.DIRT;
      F.tp(48, 1); player.hp = player.maxHp; F.step([]); const hp0 = player.hp; for (let i = 0; i < 60 && player.hp === hp0; i++) F.step(['KeyD']); const hp1 = player.hp; const { tx } = tileOf();
      check('agility: cliff course carved; stepping onto its log at Agility 1 slips you (1 damage, pushed back off the log)', cliff && hp1 === hp0 - 1 && tx <= 48 && player.x < tc(49) - 12, { cliff, hp0, hp1, tx, x: +(player.x / TILE).toFixed(2) });
      player.skills.agility.xp = xp0; }
    // pond stepping stones: solid below 10, a bridge at 10
    { const xp0 = player.skills.agility.xp; player.skills.agility.xp = 0; F.tp(43, 30); F.step([]); const stones = STONES.every(([x, y]) => tileAt(x, y) === AG_STONE);
      F.sim(90, ['KeyS']); const blockedY = tileOf().ty; const blocked = blockedY <= 30 && !WALK_OVER.has(AG_STONE);
      player.skills.agility.xp = XP_TABLE[10]; F.step([]); const open = WALK_OVER.has(AG_STONE); F.sim(320, ['KeyS']); const acrossY = tileOf().ty; const across = acrossY >= 41;
      F.tp(43, 42); player.skills.agility.xp = xp0; F.step([]);
      check('agility: Miller\'s Pond stepping stones block below Agility 10 and carry you across at 10', stones && blocked && open && across, { stones, blockedY, open, acrossY }); }
    // palisade climb: solid below 25
    { const xp0 = player.skills.agility.xp; player.skills.agility.xp = 0; F.tp(159, 30); F.step([]); const climb = tileAt(158, 30) === AG_CLIMB;
      F.sim(60, ['KeyA']); const blockedX = tileOf().tx; const blocked = blockedX >= 159;
      player.skills.agility.xp = XP_TABLE[25]; F.step([]); F.sim(60, ['KeyA']); const inX = tileOf().tx; const inside = inX <= 158 && WALK_OVER.has(AG_CLIMB); // 158 = the palisade tile itself: the centre is inside what was a wall
      F.tp(160, 30); player.skills.agility.xp = xp0; F.step([]);
      check('agility: the crumbling palisade at the Goblin Camp is solid below Agility 25 and climbable at 25', climb && blocked && inside, { climb, blockedX, inX }); }
    // capes: refused below 99, sold at 99, worn in the cape slot
    { const inv0 = player.inv.map(s => s ? { ...s } : null); player.inv = player.inv.map(s => s && s.id !== 'coins' ? null : s); h.give('coins', 2000); const c0 = coins();
      const wc = { ...player.skills.woodcutting }; player.skills.woodcutting.xp = XP_TABLE[50]; const refused = !buyCape('woodcutting') && coins() === c0 && countItem('cape_woodcutting') === 0;
      for (const m of monsters) if (!m.dead && dist(m.x, m.y, tc(108), tc(44)) < 4 * TILE) { m.x = tc(119); m.y = tc(53); m.wanderT = 9; m.wander = { x: 0, y: 0 }; } // a wandering guard must not stand between the bot and the Master
      F.tp(107, 45); F.talk('skillmaster'); const opened = panel === 'capes'; render(); const noButton = !F.clickButton('Buy 999'); closePanel();
      player.skills.woodcutting.xp = XP_TABLE[99]; F.talk('skillmaster'); render(); const clicked = F.clickButton('Buy 999'); closePanel(); const bought = clicked && countItem('cape_woodcutting') === 1 && coins() === c0 - 999;
      const slot = player.inv.findIndex(s => s && s.id === 'cape_woodcutting'); equipItem(slot); const worn = player.equip.cape === 'cape_woodcutting' && EQUIP_SLOTS.includes('cape') && countItem('cape_woodcutting') === 0 && gearBonus('def') >= 5;
      check('agility: Master of Skills refuses a cape below 99, sells it at 99 for 999 coins, and it equips to the cape slot', refused && opened && noButton && bought && worn, { refused, opened, noButton, clicked, bought, worn, coins: coins(), c0 });
      // woodcutting cape: chopping is 25% faster
      let need0 = 0, need1 = 0; { if (!hasTool('axe')) h.give('bronze_axe', 1); const tree = F.nearestTile([T.TREE]); const spot = h.openSpot(tree.x, tree.y); F.tp(spot.x, spot.y); const t2 = F.nearestTile([T.TREE]); const o = { x: t2.x, y: t2.y };
        let adj = null; for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) if (!SOLID.has(tileAt(o.x + dx, o.y + dy))) { adj = { x: o.x + dx, y: o.y + dy }; break; }
        if (adj) { unequip('cape'); F.tp(adj.x, adj.y); F.face(o.x, o.y); F.press('KeyE'); need0 = player.action ? player.action.need : 0; player.action = null; const cs = player.inv.findIndex(s => s && s.id === 'cape_woodcutting'); equipItem(cs); F.tp(adj.x, adj.y); F.face(o.x, o.y); F.press('KeyE'); need1 = player.action ? player.action.need : 0; player.action = null; } }
      check('agility: the Woodcutting cape chops 25% faster', need0 > 0 && Math.abs(need1 - need0 * 0.75) < 1e-6, { need0, need1 });
      // melee cape: +5% max hit (at least +1)
      unequip('cape'); player.inv = player.inv.map(s => s && s.id !== 'coins' ? null : s); const mc = { ...player.skills.melee }; player.skills.melee.xp = XP_TABLE[99]; const w0 = player.equip.weapon; player.equip.weapon = 'steel_sword';
      const base = playerMaxHit(); h.give('cape_melee', 1); equipItem(player.inv.findIndex(s => s && s.id === 'cape_melee')); const boosted = playerMaxHit(); player.equip.weapon = w0;
      check('agility: the Melee cape adds 5% to the max hit (at least +1)', base >= 20 && boosted === base + Math.max(1, Math.floor(base * 0.05)), { base, boosted });
      // hitpoints cape: +10% max hp
      unequip('cape'); player.inv = player.inv.map(s => s && s.id !== 'coins' ? null : s); const hpx = { ...player.skills.hitpoints }; player.skills.hitpoints.xp = XP_TABLE[99]; recomputeMaxHp(); const mh0 = player.maxHp; h.give('cape_hitpoints', 1); equipItem(player.inv.findIndex(s => s && s.id === 'cape_hitpoints')); F.step([]); const mh1 = player.maxHp;
      check('agility: the Hitpoints cape adds 10% max health', mh0 === 123 && mh1 === 135, { mh0, mh1 });
      unequip('cape'); player.skills.hitpoints = hpx; player.skills.melee = mc; player.skills.woodcutting = wc; player.inv = inv0; }
    restore(s0); h.peace(false);
  });
}
