// ============================================================================
// MAIN LOOP + HARNESS + SELF-TEST
// ============================================================================
window.FANGLANDS = {
  get player() { return player; }, get monsters() { return monsters; }, get quest() { return quest; }, get dialog() { return dialog; }, get panel() { return panel; }, get deathKeep() { return deathKeep; }, get notice() { return notice; }, get regrow() { return regrow; }, get crops() { return crops; }, get areaBanner() { return areaBanner; },
  map, T, TILE, MAP_W, MAP_H, ITEMS, NPCS, BUILDINGS, REGIONS, tileAt, isCaveTile, SPAWN, SWORD_POS, SIGN_TILE, newGame, addItem, removeItem, countItem, levelForXp, XP_TABLE, skillLv, combatLevel, playerMaxHit, rollDrops, openPanel, closePanel, changeTile,
  sim(steps, held = [], dt = 1 / 60) { keys.clear(); for (const k of held) keys.add(k); for (let i = 0; i < steps; i++) update(dt); keys.clear(); render(); },
  step(held = []) { keys.clear(); for (const k of held) keys.add(k); update(1 / 60); keys.clear(); },
  press(code) { pressed.add(code); keys.add(code); update(1 / 60); keys.delete(code); render(); },
  clickButton(label) { const b = buttons.find(b => b.label === label || b.label.startsWith(label)); if (!b) return false; b.action(); render(); return true; },
  tp(tx, ty) { player.x = tc(tx); player.y = tc(ty); player.action = null; render(); },
  // ---- bot helpers ----
  bfs(sx, sy, tx, ty) {
    const W = MAP_W, H = MAP_H;
    const prev = new Int32Array(W * H).fill(-1); const q = [sy * W + sx]; prev[sy * W + sx] = sy * W + sx; let qi = 0;
    while (qi < q.length) { const c = q[qi++]; const cx = c % W, cy = (c / W) | 0; if (cx === tx && cy === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (!inMap(nx, ny)) continue; const n = ny * W + nx; if (prev[n] !== -1) continue; if (SOLID.has(map[n]) && !(nx === tx && ny === ty)) continue; prev[n] = c; q.push(n); } }
    if (prev[ty * W + tx] === -1) return null; const path = []; let c = ty * W + tx; while (c !== sy * W + sx) { path.push([c % W, (c / W) | 0]); c = prev[c]; } return path.reverse();
  },
  held(dx, dy) { const h = []; if (Math.abs(dx) > 2) h.push(dx > 0 ? 'KeyD' : 'KeyA'); if (Math.abs(dy) > 2) h.push(dy > 0 ? 'KeyS' : 'KeyW'); return h; },
  walkTo(tx, ty, max = 4000) {
    closePanel(); const path = this.bfs(Math.floor(player.x / TILE), Math.floor(player.y / TILE), tx, ty); if (!path) return 'nopath'; let i = 0, s = 0;
    while (i < path.length && s < max) { const [wx, wy] = path[i]; const dx = tc(wx) - player.x, dy = tc(wy) - player.y; const last = i === path.length - 1; if (Math.hypot(dx, dy) < (last ? (SOLID.has(map[idx(wx, wy)]) ? 44 : 14) : 8)) { i++; continue; } this.step(this.held(dx, dy)); if (player.dead) return 'died'; s++; }
    render(); return i >= path.length ? s : 'timeout';
  },
  face(tx, ty) { const dx = tc(tx) - player.x, dy = tc(ty) - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; },
  fight(max, types = ['goblin']) {
    let s = 0, lastX = 0, lastY = 0, stuck = 0;
    while (s < max) {
      if (player.hp < 7 && !window.__peace) { this.heals = (this.heals || 0) + 1; player.hp = player.maxHp; }
      const gs = monsters.filter(m => types.includes(m.type) && !m.dead && dist(m.x, m.y, player.x, player.y) < 260); if (!gs.length) return s;
      gs.sort((a, b) => dist(a.x, a.y, player.x, player.y) - dist(b.x, b.y, player.x, player.y)); const g = gs[0]; const dx = g.x - player.x, dy = g.y - player.y, d = Math.hypot(dx, dy); player.facing = { x: dx / d, y: dy / d };
      if (d < 56) { pressed.add('Space'); this.step([]); for (let k = 0; k < 8; k++) this.step([]); s += 9; }
      else {
        if (Math.abs(player.x - lastX) < 0.5 && Math.abs(player.y - lastY) < 0.5) stuck++; else stuck = 0; lastX = player.x; lastY = player.y;
        if (stuck > 30) { stuck = 0; const r = this.walkTo(Math.floor(g.x / TILE), Math.floor(g.y / TILE), 400); s += 400; if (r === 'nopath') { g.x = player.x + 60; g.y = player.y; } }
        else { this.step(this.held(dx, dy)); s++; }
      }
      if (player.dead) return 'died';
    }
    return 'timeout';
  },
  nearestTile(types, from = player) { let best = null; for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (types.includes(map[idx(x, y)])) { const d = dist(tc(x), tc(y), from.x, from.y); if (!best || d < best.d) best = { x, y, d }; } return best; },
  goAdjacent(tx, ty, max = 3000) { for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) { const ax = tx + dx, ay = ty + dy; if (inMap(ax, ay) && !SOLID.has(map[idx(ax, ay)])) { const r = this.walkTo(ax, ay, max); if (typeof r === 'number') { this.face(tx, ty); return r; } } } return 'nopath'; },
  calm() { for (const m of monsters) { if (!MONSTER_DEFS[m.type].aggro) { m.angry = false; m.state = 'idle'; m.x = m.home.x; m.y = m.home.y; m.hp = m.maxHp; } } },
  talk(id) { const n = NPCS.find(n => n.id === id); const cands = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = n.x + dx, y = n.y + dy; if ((dx || dy) && inMap(x, y) && !SOLID.has(tileAt(x, y))) cands.push({ x, y, d: Math.hypot(dx, dy) + (insideBuilding(x, y) === insideBuilding(n.x, n.y) ? 0 : 10) }); } cands.sort((a, b) => a.d - b.d); let r = 'nopath'; for (const c of cands) { r = this.walkTo(c.x, c.y, 4000); if (typeof r === 'number') break; }
    // wandering villagers can stand between the bot and its target: move them aside first
    for (const v of NPCS) if (v.wander && v !== n && dist(v.px, v.py, player.x, player.y) < 4 * TILE) { v.px = v.home.x + 6 * TILE; v.py = v.home.y; v.wanderT = 8; v.dir = null; }
    this.face(n.x, n.y); this.press('KeyE'); this.sim(2, []); return r; },
  untilAction(max, done) { let s = 0; while (s < max && !done()) { this.step([]); s++; } render(); return s < max ? s : 'timeout'; },
  selfTest() {
    const F = this; const report = {};
    const check = (name, ok, info) => { report[name] = (ok ? 'PASS' : 'FAIL') + (info !== undefined ? ' ' + JSON.stringify(info) : '') + (!ok && notice ? ' notice=' + JSON.stringify(notice.text) : ''); };
    const peace = on => { window.__peace = on; if (on) for (const m of monsters) if (m.state === 'chase') m.state = 'return'; };
    const openSpot = (cx, cy) => { for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, y = cy + dy; let ok = inMap(x - 2, y - 2) && inMap(x + 2, y + 2); for (let yy = y - 1; yy <= y + 1 && ok; yy++) for (let xx = x - 2; xx <= x + 2 && ok; xx++) if (tileAt(xx, yy) !== T.GRASS) ok = false; if (ok && !inVillageBounds(tc(x), tc(y))) return { x, y }; } return { x: cx, y: cy }; };
    const clearJunk = () => { player.inv = player.inv.map(s => s && ['stone', 'burnt_food', 'potato', 'raw_shrimp', 'shrimp', 'cooked_beef', 'raw_beef', 'wool', 'raw_trout', 'trout', 'spider_silk'].includes(s.id) ? null : s); };
    const give = (id, q) => addItem(id, q);
    // ---------- Chapter 1 ----------
    F.newGame(); F.sim(120);
    check('voice speaks on wake', dialog.cur && dialog.cur.text === "You're finally awake.", dialog.cur && dialog.cur.text);
    { const g = monsters.filter(m => m.type.startsWith('guard')); const a = monsters.filter(m => ['sheep', 'cow'].includes(m.type)); check('guards (men and women) + animals neutral', g.length === 6 && g.some(x => x.type === 'guard_f') && g.every(x => !x.angry) && a.length === 7, { guards: g.length, animals: a.length }); }
    { const ghosts = NPCS.filter(n => n.ghost); check("Death waits inside his stone houses (coffin doors)", ghosts.length === 2 && ghosts.every(n => insideBuilding(n.x, n.y) && insideBuilding(n.x, n.y).coffin) && BUILDINGS.filter(b => b.coffin).every(b => tileAt(b.x + b.door, b.y + b.h - 1) === T.COFFINDOOR), { ghosts: ghosts.length }); }
    const sp = monsters.filter(m => m.type === 'spider');
    check('spiders roam the cave, harmless', sp.length === 5 && sp.every(m => MONSTER_DEFS[m.type].harmless), { spiders: sp.length });
    F.sim(200, ['KeyD']);
    check('sword pickup goes to the weapon slot', player.equip.weapon === 'wooden_sword' && countItem('wooden_sword') === 0 && quest.stage === 2, { stage: quest.stage });
    check('RNG combat: max hit 4 at level 1 with the wooden sword', playerMaxHit() === 4, { maxHit: playerMaxHit() });
    { const k0 = player.kills; F.goAdjacent(Math.floor(sp[0].home.x / TILE), Math.floor(sp[0].home.y / TILE), 2000); F.fight(900, ['spider']); check('kill a spider', player.kills > k0, { kills: player.kills }); }
    F.walkTo(CAVE_EXIT_X + 3, 7, 3000);
    check('left the cave', quest.stage === 3, { x: +(player.x / TILE).toFixed(1) });
    F.goAdjacent(23, 9); F.press('KeyE'); F.sim(3, []);
    check('bronze axe from the stump outside the cave', countItem('bronze_axe') === 1 && tileAt(23, 9) === T.STUMP && player.tookAxe, {});
    { const log = []; for (let n = 0; n < 6 && quest.stage === 3; n++) { const gs = monsters.filter(m => m.type === 'goblin' && !m.dead).sort((a, b) => dist(a.x, a.y, player.x, player.y) - dist(b.x, b.y, player.x, player.y)); const g = gs[0]; const w = F.walkTo(Math.floor(g.x / TILE), Math.floor(g.y / TILE), 2500); const f = F.fight(3000); log.push([w, f]); }
      check('first blood (3 goblins)', quest.stage === 4, { log, kills: player.kills, deaths: player.deaths, melee: skillLv('melee'), coins: coins() }); }
    check('levelling pace: melee ≤ 5 after the first goblins', skillLv('melee') <= 5, { melee: skillLv('melee'), xp: player.skills.melee.xp });
    check('coins are an item in the pack', countItem('coins') === coins() && (coins() === 0 || player.inv.some(s => s && s.id === 'coins')), { coins: coins() });
    { const w3 = F.walkTo(SIGN_TILE.x - 1, SIGN_TILE.y, 6000); F.fight(3000); F.walkTo(SIGN_TILE.x - 1, SIGN_TILE.y, 3000); F.face(SIGN_TILE.x, SIGN_TILE.y); F.press('KeyE'); F.sim(3, []); check('read the signpost', quest.stage === 5, { w3 }); }
    // ---------- gathering: axe required, timed, stumps regrow, oak gated ----------
    F.fight(3000);
    { const tree = F.nearestTile([T.TREE]); F.goAdjacent(tree.x, tree.y); F.fight(3000); F.goAdjacent(tree.x, tree.y);
      const axe = player.inv.findIndex(s => s && s.id === 'bronze_axe'); const saved = player.inv[axe]; player.inv[axe] = null; F.press('KeyE'); F.sim(2, []);
      check('woodcutting needs an axe', !player.action && notice && /axe/.test(notice.text), { notice: notice && notice.text });
      player.inv[axe] = saved; F.face(tree.x, tree.y); F.press('KeyE'); const r = F.untilAction(900, () => countItem('wood') >= 1);
      check('chop: timed swings, one log, stump left, regrows', typeof r === 'number' && countItem('wood') === 1 && tileAt(tree.x, tree.y) === T.STUMP && regrow.some(x => x.i === idx(tree.x, tree.y)) && player.skills.woodcutting.xp === 25, { steps: r, wood: countItem('wood'), tile: tileAt(tree.x, tree.y) }); }
    { const oak = F.nearestTile([T.OAK]); F.goAdjacent(oak.x, oak.y); F.fight(3000); F.goAdjacent(oak.x, oak.y); F.press('KeyE'); F.sim(3, []); check('oak needs Woodcutting 5', !player.action && notice && /Woodcutting level 5/.test(notice.text), { notice: notice && notice.text }); }
    { const tree = F.nearestTile([T.TREE]); F.goAdjacent(tree.x, tree.y); F.fight(3000); F.goAdjacent(tree.x, tree.y); F.press('KeyE'); F.untilAction(900, () => countItem('wood') >= 2); }
    openPanel('craft'); render(); const crafted = F.clickButton('2 Logs → 4 Planks'); closePanel();
    check('craft planks from the pack', crafted && countItem('plank') === 4 && countItem('wood') === 0, { plank: countItem('plank') });
    F.fight(3000); { const o = openSpot(Math.floor(player.x / TILE), Math.floor(player.y / TILE)); F.tp(o.x, o.y); } player.facing = { x: 1, y: 0 }; { const ft = frontTile(player, 40); F.press('KeyQ'); F.sim(3, []); check('place a plank', countItem('plank') === 3 && tileAt(ft.tx, ft.ty) === T.PLANK, { after: tileAt(ft.tx, ft.ty) }); F.press('KeyE'); F.sim(2, []); check('pick a placed plank back up', countItem('plank') === 4 && tileAt(ft.tx, ft.ty) === T.GRASS, { tile: tileAt(ft.tx, ft.ty) }); }
    { const a = player.inv[0], b = player.inv[2]; openPanel('inventory'); render(); F.clickButton('slot0'); F.clickButton('slot2'); closePanel(); check('rearrange the pack (tap, tap = swap)', JSON.stringify(player.inv[2]) === JSON.stringify(a) && JSON.stringify(player.inv[0]) === JSON.stringify(b), {}); }
    { const inv0 = player.inv.map(s => s ? { ...s } : null); for (let i = 0; i < INV_SLOTS; i++) if (!player.inv[i]) player.inv[i] = { id: 'stone', qty: 50 }; const left = addItem('wool', 3); check('pack has limited slots', left === 3, { left }); player.inv = inv0; }
    // ---------- drop tables ----------
    { let coinsN = 0, scrap = 0, ok = true; for (let i = 0; i < 300; i++) { const before = drops.length; rollDrops(MONSTER_DEFS.goblin, -999, -999); const got = drops.slice(before); if (got.some(d => d.id === 'coins')) coinsN++; if (got.some(d => d.id === 'goblin_scrap')) scrap++; if (got.some(d => !ITEMS[d.id])) ok = false; } drops = drops.filter(d => d.x > 0); check('drop tables: coins always, scrap sometimes, rare ~1/40', ok && coinsN === 300 && scrap > 30 && scrap < 200, { coinsN, scrap }); }
    // ---------- village ----------
    { const w6 = F.walkTo(86, 32, 9000); check('reached Thistledown (area banner)', player.visitedVillage && player.region === 'Thistledown' && typeof w6 === 'number', { w6, region: player.region }); }
    give('coins', 300);
    { const wm = F.talk('marta'); const open = panel === 'shop'; const inside = !!insideBuilding(Math.floor(player.x / TILE), Math.floor(player.y / TILE)); const b1 = F.clickButton('Buy 60'), b2 = F.clickButton('Buy 5'), b3 = F.clickButton('Buy 10'); closePanel(); check('walk in through the door, buy rod, hammer, bread', open && inside && b1 && b2 && b3 && countItem('fishing_rod') === 1 && countItem('hammer') === 1 && countItem('bread') >= 1, { wm, open, inside, coins: coins() }); }
    { const wa = F.talk('aldous'); const open = panel === 'bank'; const slot = player.inv.findIndex(s => s && s.id === 'plank'); const dep = F.clickButton('slot' + slot); const inBank = player.bank.some(b => b.id === 'plank' && b.qty === 4); const wd = F.clickButton('bank0'); closePanel(); check('bank deposit + withdraw', open && dep && inBank && wd && countItem('plank') === 4 && player.bank.length === 0, { wa, open, inBank, planks: countItem('plank') }); }
    { F.calm(); const d = DUMMIES[0]; F.goAdjacent(d[0], d[1]); const x0 = player.skills.melee.xp; for (let i = 0; i < 6; i++) { F.press('Space'); F.sim(30, []); } check('training dummies: small xp, misses possible, records best hit', player.skills.melee.xp > x0 && player.skills.melee.xp - x0 <= 24 && player.highestHit >= 1, { gained: player.skills.melee.xp - x0, best: player.highestHit }); }
    { const wt = F.talk('tobin'); const q1 = quest.bread; const c0 = coins(); F.press('KeyE'); F.sim(2, []); check("Tobin's bread quest", q1 === 'active' && quest.bread === 'done' && coins() === c0 + 30, { wt, bread: quest.bread }); }
    { quest.tracked = null; openPanel('quests'); render(); const t = F.clickButton('Track'); closePanel(); check('quests are tracked on demand, not by default', t && quest.tracked === 'main', { tracked: quest.tracked }); }
    { const wd = F.walkTo(112, 48, 6000); F.face(112, 49); F.press('KeyE'); F.sim(2, []); const st = quest.stage; player.skills.melee.xp = XP_TABLE[5]; player.skills.woodcutting.xp = XP_TABLE[3]; F.press('KeyE'); F.sim(2, []); check('Duke inside the castle keep gates Chapter 2', typeof wd === 'number' && st === 6 && quest.stage === 7 && player.region === 'Castle Thistledown', { wd, st, stage: quest.stage, region: player.region }); }
    // ---------- fire, cooking, eating ----------
    give('wood', 3); peace(true); { const o = openSpot(60, 24); F.tp(o.x, o.y); } player.facing = { x: 0, y: -1 };
    { const ft = frontTile(player, 40); const slot = player.inv.findIndex(s => s && s.id === 'wood'); useItem(slot); const r = F.untilAction(200, () => tileAt(ft.tx, ft.ty) === T.FIRE); check('firemaking: light logs into a fire that burns out', typeof r === 'number' && player.skills.firemaking.xp === 40 && fires.length === 1, { r, fmxp: player.skills.firemaking.xp });
      give('raw_beef', 1); F.face(ft.tx, ft.ty); F.press('KeyE'); const r2 = F.untilAction(200, () => countItem('raw_beef') === 0); check('cook at your own fire (burn chance)', typeof r2 === 'number' && (countItem('cooked_beef') === 1 || countItem('burnt_food') === 1), { cooked: countItem('cooked_beef'), burnt: countItem('burnt_food') }); }
    { give('bread', 1); player.hp = 5; const slot = player.inv.findIndex(s => s && s.id === 'bread'); useItem(slot); check('eat food to heal', player.hp === 10, { hp: player.hp }); }
    // ---------- fishing ----------
    { peace(true); const w = F.nearestTile([T.WATER]); const r = F.goAdjacent(w.x, w.y, 8000); F.calm(); F.goAdjacent(w.x, w.y, 3000); F.press('KeyE'); const r2 = F.untilAction(1500, () => countItem('raw_shrimp') >= 1); check('fishing: rod, timed, shrimp', typeof r === 'number' && typeof r2 === 'number' && player.skills.fishing.xp >= 10, { r, r2, fxp: player.skills.fishing.xp }); }
    // ---------- farming ----------
    give('bronze_hoe', 1); give('potato_seed', 1);
    { const o = openSpot(70, 30); F.tp(o.x, o.y); const gt = { x: o.x + 1, y: o.y }; F.goAdjacent(gt.x, gt.y); F.press('KeyE'); const r = F.untilAction(200, () => tileAt(gt.x, gt.y) === T.SOIL); F.face(gt.x, gt.y); F.press('KeyE'); F.sim(2, []); const planted = tileAt(gt.x, gt.y) === T.CROP; const c = crops.find(c => c.i === idx(gt.x, gt.y)); if (c) c.stage = 3; F.press('KeyE'); F.sim(2, []); check('farming: till, plant, grow, harvest potatoes', typeof r === 'number' && planted && countItem('potato') >= 2 && tileAt(gt.x, gt.y) === T.SOIL && player.skills.farming.xp >= 40, { r, planted, potato: countItem('potato'), farmxp: player.skills.farming.xp }); }
    // ---------- smithing at forge + anvil ----------
    clearJunk(); give('iron_ore', 2);
    { F.tp(93, 39); F.face(92, 37); F.walkTo(92, 38, 500); F.face(92, 37); F.press('KeyE'); const open = panel === 'station' && panelArg === 'forge'; const c1 = F.clickButton('Iron ore → Iron bar'); const r = F.untilAction(200, () => countItem('iron_bar') >= 1); closePanel(); F.face(92, 37); F.press('KeyE'); F.clickButton('Iron ore → Iron bar'); F.untilAction(200, () => countItem('iron_bar') >= 2); closePanel(); check('forge smelts ore into bars (timed)', open && c1 && typeof r === 'number' && countItem('iron_bar') === 2 && player.skills.smithing.xp === 24, { open, bars: countItem('iron_bar') });
      F.walkTo(94, 39, 500); F.face(94, 38); F.press('KeyE'); const open2 = panel === 'station' && panelArg === 'anvil'; const c2 = F.clickButton('1 bar → Iron dagger'); const r2 = F.untilAction(200, () => countItem('iron_dagger') >= 1); closePanel(); check('anvil + hammer smiths an iron dagger (hammer animation)', open2 && c2 && typeof r2 === 'number' && countItem('iron_dagger') === 1 && countItem('iron_bar') === 1, { open2, dagger: countItem('iron_dagger') }); }
    { const slot = player.inv.findIndex(s => s && s.id === 'iron_dagger'); openPanel('inventory'); render(); F.clickButton('slot' + slot); F.clickButton('Equip'); const eq = player.equip.weapon === 'iron_dagger' && countItem('wooden_sword') === 1; F.clickButton('eqweapon'); closePanel(); check('equipment slots: equip swaps the old weapon back to the pack, unequip works', eq && player.equip.weapon === null && countItem('iron_dagger') === 1, { weapon: player.equip.weapon }); const s2 = player.inv.findIndex(s => s && s.id === 'iron_dagger'); equipItem(s2); }
    // ---------- workbench: bow + arrows; alchemy: bomb; workshop: trap ----------
    clearJunk(); give('wood', 6); give('spider_silk', 1); give('stone', 1); give('blast_powder', 1); give('goblin_scrap', 1); player.skills.crafting.xp = XP_TABLE[3]; const cx0 = player.skills.crafting.xp;
    { F.tp(103, 39); F.walkTo(100, 38, 500); F.face(100, 37); F.press('KeyE'); const ok1 = panel === 'station' && panelArg === 'workbench' && F.clickButton('2 Logs + Spider silk → Shortbow') && F.clickButton('Logs + Stone → 5 Stone arrows'); closePanel();
      F.walkTo(104, 38, 500); F.face(104, 37); F.press('KeyE'); const ok2 = panel === 'station' && panelArg === 'alchemy' && F.clickButton('Blast powder + Goblin scrap → Goblin bomb'); closePanel();
      check('workbench makes a bow and arrows; alchemy makes a bomb', ok1 && ok2 && countItem('shortbow') === 1 && countItem('stone_arrow') === 5 && countItem('bomb') === 1 && player.skills.crafting.xp === cx0 + 63, { bow: countItem('shortbow'), arrows: countItem('stone_arrow'), bomb: countItem('bomb'), cxp: player.skills.crafting.xp }); }
    { F.walkTo(102, 38, 500); F.face(102, 37); F.press('KeyE'); const ok = panel === 'station' && panelArg === 'workshop'; render(); const c = F.clickButton('Iron bar + 2 Planks → Goblin trap'); closePanel(); check('workshop makes a goblin trap (Crafting 3)', ok && c && countItem('goblin_trap') === 1, { ok, trap: countItem('goblin_trap') }); }
    { const o = openSpot(40, 20); F.tp(o.x, o.y); const gob = monsters.find(m => m.type === 'goblin' && !m.dead); gob.x = player.x + 120; gob.y = player.y; gob.home = { x: gob.x, y: gob.y }; gob.state = 'idle'; gob.hp = gob.maxHp; gob.stunT = 0; gob.wanderT = 99; gob.wander = { x: 0, y: 0 }; player.facing = { x: 1, y: 0 };
      const bs = player.inv.findIndex(s => s && s.id === 'shortbow'); equipItem(bs); give('stone_arrow', 30); const a0 = countItem('stone_arrow'); const rx0 = player.skills.range.xp; let hit = false; for (let i = 0; i < 14 && !hit; i++) { gob.x = player.x + 120; gob.y = player.y; gob.stunT = 0; player.attackCd = 0; F.press('Space'); F.sim(40, []); if (gob.hp < gob.maxHp) hit = true; }
      check('range: bow shoots arrows, consumes them, Range xp', hit && countItem('stone_arrow') < a0 && player.skills.range.xp > rx0, { arrows: countItem('stone_arrow'), rxp: player.skills.range.xp });
      const hp0 = gob.hp; gob.x = player.x + 90; gob.y = player.y; gob.home = { x: gob.x, y: gob.y }; gob.state = 'idle'; gob.wanderT = 99; gob.wander = { x: 0, y: 0 }; gob.stunT = 0; const bslot = player.inv.findIndex(s => s && s.id === 'bomb'); player.attackCd = 0; useItem(bslot); F.sim(60, []); check('bomb: throw, explode, area damage', countItem('bomb') === 0 && gob.hp < hp0, { hp0, hp: gob.hp });
      gob.dead = false; gob.hp = gob.maxHp; gob.state = 'idle'; gob.stunT = 0; gob.x = player.x + 200; gob.y = player.y; player.facing = { x: 1, y: 0 }; const ft = frontTile(player, 40); placeAction('goblin_trap'); const placed = tileAt(ft.tx, ft.ty) === T.TRAP; gob.x = tc(ft.tx); gob.y = tc(ft.ty); F.sim(3, []); check('goblin trap: placed, springs on a goblin, stuns it', placed && gob.hp === gob.maxHp - 12 && gob.stunT > 0 && tileAt(ft.tx, ft.ty) !== T.TRAP, { placed, hp: gob.hp, stun: gob.stunT });
      const ws = player.inv.findIndex(s => s && s.id === 'wooden_sword'); if (ws >= 0) equipItem(ws); }
    // ---------- aggression stops at higher combat level ----------
    peace(false); { const o = openSpot(40, 20); F.tp(o.x, o.y); const gob = monsters.find(m => m.type === 'goblin' && !m.dead); gob.x = player.x + 100; gob.y = player.y; gob.home = { x: gob.x, y: gob.y }; gob.state = 'idle'; gob.angry = true; gob.hp = gob.maxHp; gob.stunT = 0; gob.wanderT = 99; gob.wander = { x: 0, y: 0 }; const m0 = player.skills.melee.xp, d0 = player.skills.defence.xp; player.skills.melee.xp = XP_TABLE[8]; player.skills.defence.xp = XP_TABLE[8]; F.sim(60, []); const calmHigh = gob.state === 'idle'; player.skills.melee.xp = m0; player.skills.defence.xp = d0; gob.x = player.x + 100; gob.y = player.y; gob.state = 'idle'; F.sim(60, []); const chaseLow = gob.state === 'chase'; check('goblins ignore a combat-level 8 knight, chase a low one (sight 4.5 tiles)', calmHigh && chaseLow, { cbHigh: 8, cbLow: combatLevel(), calmHigh, chaseLow }); F.fight(2000); }
    // ---------- base: lodestone, home teleport, bed ----------
    give('lodestone', 1); give('bed', 1); give('door', 1);
    peace(true); { const o = openSpot(36, 22); F.tp(o.x, o.y); player.facing = { x: 1, y: 0 }; placeAction('lodestone'); const home = player.home && { ...player.home }; player.facing = { x: 0, y: 1 }; placeAction('bed'); const bt = frontTile(player, 40); F.face(bt.tx, bt.ty); F.press('KeyE'); F.sim(2, []); const bed = !!player.bedSpawn; player.facing = { x: 0, y: -1 }; placeAction('door'); const dt = frontTile(player, 40); const door = tileAt(dt.tx, dt.ty) === T.DOOR; F.tp(40, 30); goHome(); check('lodestone sets home, bed sets respawn, doors push through, H teleports home', !!home && bed && door && dist(player.x, player.y, home.x, home.y) < 2 && !collides(tc(dt.tx), tc(dt.ty), 13, 'person') && collides(tc(dt.tx), tc(dt.ty), 13, 'beast'), { home, bed, door }); }
    // ---------- death: Death's chest in his house ----------
    { player.inv = new Array(INV_SLOTS).fill(null); give('coins', 100); give('goblin_scrap', 2); give('wood', 3); player.bedSpawn = null;
      hurtPlayer(player.hp + 999, player.x + 10, player.y, true); F.sim(200, []);
      const kept = deathKeep && deathKeep.items.map(s => s.id).sort().join(',');
      check('death: pack to Death, gear stays on, respawn in the village', !player.dead && dist(player.x, player.y, VILLAGE_SPAWN.x, VILLAGE_SPAWN.y) < 5 && kept === 'coins,goblin_scrap,wood' && player.equip.weapon !== null, { kept });
      const w = F.walkTo(134, 51, 4000); const inside = !!insideBuilding(Math.floor(player.x / TILE), Math.floor(player.y / TILE)); F.face(134, 50); F.press('KeyE'); const open = panel === 'coffin'; const fee = coffinFee(); const rec = F.clickButton('Reclaim everything');
      check("Death's chest: cheap free, valuables 25%, fee from the dropped purse first", typeof w === 'number' && inside && open && fee === 8 && rec && coins() === 92 && countItem('goblin_scrap') === 2 && countItem('wood') === 3 && !deathKeep, { w, inside, open, fee, coins: coins() }); closePanel(); }
    // ---------- the goblin walker: kill, wreck, repair, pilot ----------
    peace(true); { const wk = monsters.find(m => m.type === 'walker'); F.tp(150, 28); wk.hp = 1; wk.x = player.x + 40; wk.y = player.y; player.facing = { x: 1, y: 0 }; for (let i = 0; i < 60 && !wk.dead; i++) { wk.x = player.x + 40; wk.y = player.y; wk.stunT = 0; player.attackCd = 0; F.press('Space'); F.sim(3, []); } const wt = F.nearestTile([T.WRECK]) || { x: 150, y: 28 }; check('walker dies into a wreck, quest notes it', wk.dead && tileAt(wt.x, wt.y) === T.WRECK && quest.walkerKilled, { wreck: tileAt(wt.x, wt.y) === T.WRECK, dead: wk.dead });
      give('iron_bar', 3); give('goblin_scrap', 4); F.goAdjacent(wt.x, wt.y, 800); F.press('KeyE'); F.sim(2, []); const repaired = tileAt(wt.x, wt.y) === T.MECH; F.press('KeyE'); F.sim(2, []); const piloting = !!player.mech; F.sim(30, ['KeyA']); const moved = Math.abs(player.x - tc(wt.x)) > 20; F.press('KeyX'); F.sim(2, []); const parked = !player.mech && !!F.nearestTile([T.MECH]);
      check('repair the wreck (3 bars + 4 scrap), climb in, drive, climb out', repaired && piloting && moved && parked, { repaired, piloting, moved, parked }); }
    { F.tp(112, 48); F.face(112, 49); F.press('KeyE'); F.sim(2, []); check('Duke closes Chapter 3', quest.stage === 8, { stage: quest.stage }); }
    peace(false);
    // ---------- villagers walk; monsters respawn without walking away ----------
    { F.tp(112, 33); const v = NPCS.filter(n => n.wander); F.sim(900, []); const moved = v.filter(n => dist(n.px, n.py, n.home.x, n.home.y) > 20).length; check('villagers wander the streets', moved >= 2, { moved, of: v.length }); }
    { const gob = monsters.find(m => m.type === 'goblin'); gob.dead = true; gob.respawnT = 0.1; F.tp(Math.floor(gob.home.x / TILE) + 6, Math.floor(gob.home.y / TILE)); F.sim(30, []); check('monsters respawn while you are nearby (4+ tiles)', !gob.dead, {}); }
    // ---------- save / load ----------
    save(); const snap = JSON.stringify({ q: quest, inv: player.inv, eq: player.equip, bank: player.bank, hh: player.highestHit, diffs: mapDiffs.size, home: player.home, crops: crops.length });
    { const lv = skillLv('melee'); player = newPlayer(); quest = { stage: 0, kills: 0, bread: 'none', wren: 'none', walkerKilled: false, tracked: null }; const ok = load(); check('save/load round-trip', ok && skillLv('melee') === lv && JSON.stringify({ q: quest, inv: player.inv, eq: player.equip, bank: player.bank, hh: player.highestHit, diffs: mapDiffs.size, home: player.home, crops: crops.length }) === snap, { loaded: ok }); }
    for (const h of HOOKS.selfTest) h(check, F, { give, peace, openSpot, clearJunk });
    const fails = Object.values(report).filter(v => v.startsWith('FAIL')).length;
    report.summary = fails ? `${fails} FAILED of ${Object.keys(report).length}` : `ALL ${Object.keys(report).length} PASS`;
    console.table(report);
    return report;
  },
};
