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
    while (i < path.length && s < max) { if (player.hp < 7 && !window.__peace) { this.heals = (this.heals || 0) + 1; player.hp = player.maxHp; } const [wx, wy] = path[i]; // same heal rule as fight(): a road goblin must not kill the bot mid-walk (a death cascades through every later check) const dx = tc(wx) - player.x, dy = tc(wy) - player.y; const last = i === path.length - 1; if (Math.hypot(dx, dy) < (last ? (SOLID.has(map[idx(wx, wy)]) ? 44 : 14) : 8)) { i++; continue; } this.step(this.held(dx, dy)); if (player.dead) return 'died'; s++; }
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
    F.fight(3000); peace(true); // no goblin may interrupt the timed swings (a hit cancels player.action); the blend pass opened the copse at (40,8)
    { const tree = F.nearestTile([T.TREE]); F.goAdjacent(tree.x, tree.y); F.fight(3000); F.goAdjacent(tree.x, tree.y);
      const axe = player.inv.findIndex(s => s && s.id === 'bronze_axe'); const saved = player.inv[axe]; player.inv[axe] = null; F.press('KeyE'); F.sim(2, []);
      check('woodcutting needs an axe', !player.action && notice && /axe/.test(notice.text), { notice: notice && notice.text });
      player.inv[axe] = saved; F.face(tree.x, tree.y); const near0 = monsters.filter(m => !m.dead && dist(m.x, m.y, player.x, player.y) < 160).map(m => m.type + ':' + m.state); F.press('KeyE'); const a0 = player.action && player.action.kind, n0 = notice && notice.text; const r = F.untilAction(900, () => countItem('wood') >= 1);
      check('chop: timed swings, one log, stump left, regrows', typeof r === 'number' && countItem('wood') === 1 && tileAt(tree.x, tree.y) === T.STUMP && regrow.some(x => x.i === idx(tree.x, tree.y)) && player.skills.woodcutting.xp === 25, { steps: r, wood: countItem('wood'), tile: tileName(tileAt(tree.x, tree.y)), tree: [tree.x, tree.y], at: [+(player.x / TILE).toFixed(2), +(player.y / TILE).toFixed(2)], a0, n0, near0, hp: player.hp, action: player.action && player.action.kind, n1: notice && notice.text }); }
    { const oak = F.nearestTile([T.OAK]); F.goAdjacent(oak.x, oak.y); F.fight(3000); F.goAdjacent(oak.x, oak.y); F.press('KeyE'); F.sim(3, []); check('oak needs Woodcutting 5', !player.action && notice && /Woodcutting level 5/.test(notice.text), { notice: notice && notice.text }); } peace(false);
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
      F.walkTo(94, 39, 500); F.face(94, 38); F.press('KeyE'); const open2 = panel === 'station' && panelArg === 'anvil'; const d0 = countItem('iron_dagger'), b0 = countItem('iron_bar'); const c2 = F.clickButton('1 bar → Iron dagger'); const r2 = F.untilAction(200, () => countItem('iron_dagger') >= d0 + 1 && countItem('iron_bar') === b0 - 1); closePanel(); check('anvil + hammer smiths an iron dagger (hammer animation)', open2 && c2 && typeof r2 === 'number' && countItem('iron_dagger') === d0 + 1 && countItem('iron_bar') === b0 - 1, { open2, c2, r2, dagger: countItem('iron_dagger'), bars: countItem('iron_bar'), notice: notice && notice.text }); }
    { const slot = player.inv.findIndex(s => s && s.id === 'iron_dagger'); openPanel('inventory'); render(); F.clickButton('slot' + slot); F.clickButton('Equip'); const eq = player.equip.weapon === 'iron_dagger' && countItem('wooden_sword') === 1; F.clickButton('eqweapon'); closePanel(); check('equipment slots: equip swaps the old weapon back to the pack, unequip works', eq && player.equip.weapon === null && countItem('iron_dagger') === 1, { weapon: player.equip.weapon }); const s2 = player.inv.findIndex(s => s && s.id === 'iron_dagger'); equipItem(s2); }
    // ---------- workbench: bow + arrows; alchemy: bomb; workshop: trap ----------
    clearJunk(); give('wood', 6); give('spider_silk', 1); give('stone', 1); give('blast_powder', 1); give('goblin_scrap', 1); player.skills.crafting.xp = XP_TABLE[3]; const cx0 = player.skills.crafting.xp;
    { F.tp(103, 39); F.walkTo(100, 38, 500); F.face(100, 37); F.press('KeyE'); const ok1 = panel === 'station' && panelArg === 'workbench' && F.clickButton('2 Logs + Spider silk → Shortbow') && F.clickButton('Logs + Stone → 5 Stone arrows'); closePanel();
      F.walkTo(104, 38, 500); F.face(104, 37); F.press('KeyE'); const ok2 = panel === 'station' && panelArg === 'alchemy' && F.clickButton('Blast powder + Goblin scrap → Goblin bomb'); closePanel();
      check('workbench makes a bow and arrows; alchemy makes a bomb', ok1 && ok2 && countItem('shortbow') === 1 && countItem('stone_arrow') === 5 && countItem('bomb') === 1 && player.skills.crafting.xp === cx0 + 78, { bow: countItem('shortbow'), arrows: countItem('stone_arrow'), bomb: countItem('bomb'), cxp: player.skills.crafting.xp }); }
    { F.walkTo(102, 38, 500); F.face(102, 37); F.press('KeyE'); const ok = panel === 'station' && panelArg === 'workshop'; render(); const c = F.clickButton('Iron bar + 2 Planks → Goblin trap'); closePanel(); check('workshop makes a goblin trap (Crafting 3)', ok && c && countItem('goblin_trap') === 1, { ok, trap: countItem('goblin_trap') }); }
    { const o = openSpot(40, 20); F.tp(o.x, o.y); const gob = monsters.find(m => m.type === 'goblin' && !m.dead); gob.x = player.x + 120; gob.y = player.y; gob.home = { x: gob.x, y: gob.y }; gob.state = 'idle'; gob.hp = gob.maxHp; gob.stunT = 0; gob.wanderT = 99; gob.wander = { x: 0, y: 0 }; player.facing = { x: 1, y: 0 };
      const bs = player.inv.findIndex(s => s && s.id === 'shortbow'); equipItem(bs); give('stone_arrow', 30); const a0 = countItem('stone_arrow'); const rx0 = player.skills.range.xp; let hit = false; for (let i = 0; i < 14 && !hit; i++) { gob.x = player.x + 120; gob.y = player.y; gob.stunT = 0; player.attackCd = 0; F.press('Space'); F.sim(40, []); if (gob.hp < gob.maxHp) hit = true; }
      check('range: bow shoots arrows, consumes them, Range xp', hit && countItem('stone_arrow') < a0 && player.skills.range.xp > rx0, { arrows: countItem('stone_arrow'), rxp: player.skills.range.xp });
      const hp0 = gob.hp; gob.x = player.x + 90; gob.y = player.y; gob.home = { x: gob.x, y: gob.y }; gob.state = 'idle'; gob.wanderT = 99; gob.wander = { x: 0, y: 0 }; gob.stunT = 0; const bslot = player.inv.findIndex(s => s && s.id === 'bomb'); player.attackCd = 0; useItem(bslot); F.sim(60, []); check('bomb: throw, explode, area damage', countItem('bomb') === 0 && gob.hp < hp0, { hp0, hp: gob.hp });
      gob.dead = false; gob.hp = gob.maxHp; gob.state = 'idle'; gob.stunT = 0; gob.x = player.x + 200; gob.y = player.y; player.facing = { x: 1, y: 0 }; const ft = frontTile(player, 40); drops = drops.filter(d => !circleHitsTile(d.x, d.y, 8, ft.tx, ft.ty)); placeAction('goblin_trap'); // a loot drop from the fight may sit on the tile ("Pick that up first.") const placed = tileAt(ft.tx, ft.ty) === T.TRAP; gob.x = tc(ft.tx); gob.y = tc(ft.ty); F.sim(3, []); check('goblin trap: placed, springs on a goblin, stuns it', placed && gob.hp === gob.maxHp - 12 && gob.stunT > 0 && tileAt(ft.tx, ft.ty) !== T.TRAP, { placed, hp: gob.hp, stun: gob.stunT });
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
    // ---------- core fix pass (audit 2026-09-07): safe spots, smithing refunds, load safety, coins, regrow, tile-name saves ----------
    peace(true);
    const invSnap = () => player.inv.map(s => s ? { ...s } : null);
    { // a bed against a wall: you wake beside it, never inside the wall
      const o = openSpot(30, 30); const bx = o.x, by = o.y; const t0 = tileAt(bx, by), t1 = tileAt(bx, by + 1), t2 = tileAt(bx, by - 1);
      changeTile(bx, by, T.BED); changeTile(bx, by + 1, T.WALL); changeTile(bx, by - 1, T.WALL);
      player.bedSpawn = { x: tc(bx), y: tc(by) }; const p = respawnPoint();
      const inv0 = invSnap(), dk0 = deathKeep; deathKeep = null;
      hurtPlayer(player.hp + 999, player.x + 10, player.y, true); F.sim(200, []);
      check('safeSpot: a bed against a wall respawns you on the nearest free tile', !collides(p.x, p.y, 13, 'person') && dist(p.x, p.y, tc(bx), tc(by)) <= 1.5 * TILE && !player.dead && !collides(player.x, player.y, 13, 'person') && dist(player.x, player.y, tc(bx), tc(by)) <= 1.5 * TILE, { bed: [bx, by], p: [p.x / TILE - 0.5, p.y / TILE - 0.5], at: [+(player.x / TILE).toFixed(1), +(player.y / TILE).toFixed(1)] });
      player.inv = inv0; deathKeep = dk0; player.bedSpawn = null; changeTile(bx, by, t0); changeTile(bx, by + 1, t1); changeTile(bx, by - 1, t2); }
    { // smithing: a second tap is refused, cancelling refunds (the bar never left), the bar goes when the dagger lands
      const inv0 = invSnap(); const rec = RECIPES.find(r => r.out === 'iron_dagger');
      player.inv = player.inv.map(s => s && (s.id === 'iron_bar' || s.id === 'iron_dagger') ? null : s); if (!hasTool('hammer')) give('hammer', 1); give('iron_bar', 1);
      const c1 = craft(rec), c2 = craft(rec); const pending = !!player.action && player.action.type === 'smith'; const barsAfterTwo = countItem('iron_bar');
      F.sim(5, ['KeyA']); const cancelled = !player.action, barsAfterCancel = countItem('iron_bar');
      const c3 = craft(rec); const r = F.untilAction(200, () => countItem('iron_dagger') >= 1);
      check('smithing: double-tap refused, cancelled swing keeps the bar, bar spent only when the dagger lands', c1 && !c2 && pending && barsAfterTwo === 1 && cancelled && barsAfterCancel === 1 && c3 && typeof r === 'number' && countItem('iron_dagger') === 1 && countItem('iron_bar') === 0, { c1, c2, pending, barsAfterTwo, cancelled, barsAfterCancel, r, dagger: countItem('iron_dagger'), bars: countItem('iron_bar') });
      player.inv = inv0; }
    { // coins never vanish: a full pack drops them at your feet, and the pickup loop does not thrash on them
      const inv0 = invSnap(), c0 = coins(); for (let i = 0; i < INV_SLOTS; i++) if (!player.inv[i] || player.inv[i].id === 'coins') player.inv[i] = { id: 'stone', qty: 50 };
      const n0 = drops.length; const left = addItem('coins', 7); const d = drops.slice(n0).find(x => x.id === 'coins' && x.qty === 7);
      F.sim(3, []); const stays = !!d && drops.includes(d) && coins() === 0;
      player.inv = inv0; F.sim(3, []); const picked = !!d && !drops.includes(d) && coins() === c0 + 7;
      check('coins: addItem with a full pack drops them at your feet, they wait, then come back when there is room', left === 0 && !!d && dist(d.x, d.y, player.x, player.y) < 20 && stays && picked, { left, dropped: !!d, stays, picked, coins: coins(), c0 });
      removeItem('coins', 7); drops = drops.filter(x => x !== d); }
    { // regrow: a door placed on ashes stays a door; a stump under a goblin waits; a monster whose home is now solid respawns beside it
      const o = openSpot(50, 30); const x = o.x, y = o.y; const gob = monsters.find(m => m.type === 'goblin'); const gs = { x: gob.x, y: gob.y, dead: gob.dead, home: { ...gob.home }, respawnT: gob.respawnT };
      changeTile(x, y, T.ASHES); regrow.push({ i: idx(x, y), t: T.GRASS, timer: 0.05 }); changeTile(x, y, T.DOOR);
      changeTile(x + 1, y, T.STUMP); regrow.push({ i: idx(x + 1, y), t: T.TREE, timer: 0.05 }); gob.dead = false; gob.x = tc(x + 1); gob.y = tc(y); gob.stunT = 5; gob.home = { x: tc(x + 1), y: tc(y) };
      F.tp(x, y - 1); F.sim(10, []);
      const door = tileAt(x, y) === T.DOOR, gone = !regrow.some(r => r.i === idx(x, y)), waits = tileAt(x + 1, y) === T.STUMP && regrow.some(r => r.i === idx(x + 1, y) && r.timer > 3);
      regrow = regrow.filter(r => r.i !== idx(x + 1, y)); gob.stunT = 0; gob.dead = true; gob.respawnT = 0.1; gob.home = { x: tc(x - 1), y: tc(y) }; changeTile(x - 1, y, T.PLANK); F.tp(x + 8, y); F.sim(30, []);
      const beside = !gob.dead && !collides(gob.x, gob.y, gob.r, 'beast') && dist(gob.x, gob.y, tc(x - 1), tc(y)) <= 1.5 * TILE;
      check('regrow: a placed door survives, an occupied stump waits, a monster respawns beside a blocked home', door && gone && waits && beside, { door, gone, waits, beside, at: [x, y] });
      gob.x = gs.x; gob.y = gs.y; gob.dead = gs.dead; gob.home = gs.home; gob.respawnT = gs.respawnT; gob.state = 'idle'; changeTile(x, y, T.GRASS); changeTile(x + 1, y, T.GRASS); changeTile(x - 1, y, T.GRASS); }
    { // load(): a save taken mid-death wakes you alive on a safe tile; unknown item ids are dropped, not crashed on
      const inv0 = invSnap(), eq0 = { ...player.equip }, dk0 = deathKeep; player.bedSpawn = null; deathKeep = null; save();
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY)); raw.player.hp = 0; raw.player.dead = true; raw.player.x = tc(0); raw.player.y = tc(0); localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
      const ok = load();
      check('load: a save taken mid-death wakes you at full hp on a free tile', ok && player.hp === player.maxHp && !player.dead && !collides(player.x, player.y, 13, 'person'), { ok, hp: player.hp, at: [+(player.x / TILE).toFixed(1), +(player.y / TILE).toFixed(1)] });
      raw.player.hp = player.maxHp; raw.player.dead = false; raw.player.x = player.x; raw.player.y = player.y;
      raw.player.inv[0] = { id: 'ghost_item', qty: 1 }; raw.player.bank.push({ id: 'nope', qty: 2 }); raw.player.equip.shield = 'ghost_shield'; raw.deathKeep = { items: [{ id: 'gone', qty: 1 }, { id: 'wood', qty: 1 }] }; localStorage.setItem(SAVE_KEY, JSON.stringify(raw)); try { const cur = localStorage.getItem('fanglands.slot.current'); if (cur) localStorage.setItem('fanglands.slot.' + cur, JSON.stringify(raw)); } catch (e) { } // the save-slot layer (14-title) reads its own key first
      notice = null; const ok2 = load();
      const clean = player.inv.every(s => !s || ITEMS[s.id]) && player.bank.every(s => ITEMS[s.id]) && player.equip.shield === null && !!deathKeep && deathKeep.items.length === 1 && deathKeep.items[0].id === 'wood';
      check("load: unknown item ids are dropped from pack, bank, equipment and Death's chest, with one notice", ok2 && clean && !!notice && /unknown item/.test(notice.text), { ok2, clean, notice: notice && notice.text });
      player.inv = inv0; player.equip = eq0; deathKeep = dk0; recomputeMaxHp(); save(); }
    { // save: tiles by name; numeric (older) saves and unknown names still load
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY)); const named = raw.mapDiffs.length > 0 && raw.mapDiffs.every(([, t]) => typeof t === 'string' && t in T) && raw.regrow.every(r => typeof r.t === 'string' && r.t in T);
      const before = JSON.stringify([...mapDiffs.entries()]), rg = JSON.stringify(regrow.map(r => [r.i, r.t]));
      const ok1 = load(); const same = JSON.stringify([...mapDiffs.entries()]) === before && JSON.stringify(regrow.map(r => [r.i, r.t])) === rg;
      raw.mapDiffs = raw.mapDiffs.map(([i, t]) => [i, T[t]]); raw.regrow = raw.regrow.map(r => ({ ...r, t: T[r.t] })); raw.mapDiffs.push([idx(1, 1), 'NO_SUCH_TILE']); localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
      const ok2 = load(); const same2 = JSON.stringify([...mapDiffs.entries()]) === before;
      check('save: tiles are stored by name and resolved back; numeric saves and unknown names still load', named && ok1 && same && ok2 && same2, { named, diffs: raw.mapDiffs.length, sample: raw.mapDiffs[0], same, same2 }); save(); }
    // ---------- player feedback pass (2026-09-07): friendly fire, camp respawns, doorsteps, the signpost, gear tiers ----------
    peace(true);
    { // a sapper's sticky bomb hurts the goblin standing beside the blast, and the knight earns nothing for it
      const o = openSpot(40, 20); F.tp(o.x, o.y); const gob = monsters.find(m => m.type === 'goblin' && !m.dead); const gs = { x: gob.x, y: gob.y, home: gob.home, hp: gob.hp, state: gob.state };
      gob.x = player.x + 300; gob.y = player.y; gob.home = { x: gob.x, y: gob.y }; gob.hp = gob.maxHp; gob.stunT = 5; gob.state = 'idle';
      const mx0 = player.skills.melee.xp, rx0 = player.skills.range.xp, hp0 = player.hp;
      projectiles.push({ kind: 'sticky', x: gob.x + 20, y: gob.y, vx: 0, vy: 0, t: 0, life: 0, fuse: 0.05, owner: 'monster' }); F.sim(10, []);
      check('friendly fire: a sapper sticky bomb hurts the goblin beside the blast (3–8), no xp to the knight', gob.hp < gob.maxHp && gob.hp >= gob.maxHp - 8 && player.skills.melee.xp === mx0 && player.skills.range.xp === rx0 && player.hp === hp0 && !projectiles.some(p => p.kind === 'sticky'), { hp: gob.hp, max: gob.maxHp });
      Object.assign(gob, { x: gs.x, y: gs.y, home: gs.home, hp: gs.hp, state: gs.state, stunT: 0 }); }
    { // the bulldozer's charge runs down an hp-1 goblin in its path; it dies through killMonster (kills counted, drops rolled)
      const o = openSpot(60, 40); F.tp(o.x - 12, o.y + 12); const dz = monsters.find(m => m.type === 'bulldozer'); const gob = monsters.find(m => m.type === 'goblin' && !m.dead);
      const ds = dz && { x: dz.x, y: dz.y, home: dz.home, dead: dz.dead, hp: dz.hp, state: dz.state, respawnT: dz.respawnT, deadT: dz.deadT }; const gs = { x: gob.x, y: gob.y, home: gob.home, hp: gob.hp, state: gob.state, dead: gob.dead, respawnT: gob.respawnT };
      let ok = false, info = { dozer: !!dz };
      if (dz) {
        dz.dead = false; dz.hp = dz.maxHp; dz.x = tc(o.x) - 40; dz.y = tc(o.y); dz.home = { x: dz.x, y: dz.y }; dz.state = 'idle'; dz.stunT = 0; dz.chargeT = 1; dz.chargeDir = { x: 1, y: 0 }; dz.chargeHit = false; dz.rammed = [];
        gob.dead = false; gob.hp = 1; gob.x = tc(o.x) + 30; gob.y = tc(o.y); gob.home = { x: gob.x, y: gob.y }; gob.stunT = 5; gob.state = 'idle';
        const k0 = player.kills, d0 = drops.length; F.sim(20, []); ok = gob.dead && player.kills === k0 + 1 && drops.length > d0; info = { dead: gob.dead, kills: player.kills - k0, drops: drops.length - d0 };
        dz.chargeT = 0; Object.assign(dz, ds);
      }
      check('friendly fire: the bulldozer charge kills an hp-1 goblin in its path (drops roll)', ok, info);
      Object.assign(gob, gs); gob.stunT = 0; drops = drops.filter(d => dist(d.x, d.y, tc(o.x), tc(o.y)) > 3 * TILE); }
    { // the Goblin Camp: flagged spawns, 30-minute respawn that waits for the knight to be 40+ tiles off, one CLEARED banner per clear
      const inCamp = s => s.tx >= 142 && s.tx <= 158 && s.ty >= 20 && s.ty <= 40; const camp = MONSTER_SPAWNS.filter(s => s.camp); const cm = monsters.filter(isCampMonster);
      const flagged = camp.length >= 12 && camp.every(inCamp) && MONSTER_SPAWNS.every(s => !!s.camp === inCamp(s)) && cm.length === camp.length;
      const snap = cm.map(m => ({ m, dead: m.dead, hp: m.hp, respawnT: m.respawnT, deadT: m.deadT, state: m.state, x: m.x, y: m.y }));
      F.tp(60, 40); quest.campCleared = false; levelBanner = null; const last = cm.find(m => m.type === 'goblin');
      for (const m of cm) { m.dead = true; m.deadT = 0; m.respawnT = 999; }
      last.dead = false; last.hp = 1; last.x = last.home.x; last.y = last.home.y; killMonster(last);
      const banner = !!levelBanner && levelBanner.text === 'GOBLIN CAMP CLEARED' && levelBanner.sub === 'They will not be back for a while' && quest.campCleared === true, slow = last.respawnT === 1800;
      levelBanner = null; last.respawnT = 0; F.tp(120, 30); F.sim(5, []); const waits = last.dead; // 30 tiles away: still too close
      F.tp(60, 40); F.sim(5, []); const back = !last.dead && quest.campCleared === false;
      for (const m of cm) { m.dead = true; m.deadT = 0; } last.dead = false; last.hp = 1; killMonster(last); const again = !!levelBanner && levelBanner.text === 'GOBLIN CAMP CLEARED';
      check('goblin camp: spawns flagged camp, 1800 s respawn only while 40+ tiles away, CAMP CLEARED banner once per clear', flagged && banner && slow && waits && back && again, { camp: camp.length, flagged, banner, slow, waits, back, again });
      for (const s of snap) Object.assign(s.m, { dead: s.dead, hp: s.hp, respawnT: s.respawnT, deadT: s.deadT, state: s.state, x: s.x, y: s.y }); quest.campCleared = false; levelBanner = null; drops = drops.filter(d => dist(d.x, d.y, last.home.x, last.home.y) > 3 * TILE); }
    { // no monster wakes on a doorstep (posted guards excepted); the goblin that sat on Death's House door at (27,14) moved off it
      const doors = []; for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const t = map[idx(x, y)]; if ((t === T.DOOR || t === T.COFFINDOOR || t === T.PORTCULLIS) && !mapDiffs.has(idx(x, y))) doors.push([x, y]); }
      for (const b of BUILDINGS) { if (b.door !== undefined) doors.push([b.x + b.door, b.y + b.h - 1]); if (b.doorTop !== undefined) doors.push([b.x + b.doorTop, b.y]); }
      const bad = MONSTER_SPAWNS.filter(s => !MONSTER_DEFS[s.type].human && doors.some(([x, y]) => Math.hypot(x - s.tx, y - s.ty) <= 3));
      const moved = MONSTER_SPAWNS.find(s => s.movedFrom && s.movedFrom[0] === 27 && s.movedFrom[1] === 14); const dh = BUILDINGS.find(b => b.id === 'death1');
      const far = !!moved && Math.hypot(Math.max(dh.x - moved.tx, 0, moved.tx - (dh.x + dh.w - 1)), Math.max(dh.y - moved.ty, 0, moved.ty - (dh.y + dh.h - 1))) >= 4 && !SOLID.has(tileAt(moved.tx, moved.ty)) && !buildingAt(moved.tx, moved.ty);
      check("no spawn within 3 tiles of a door; the goblin on Death's doorstep (27,14) moved 4+ tiles from the house onto open ground", bad.length === 0 && far, { bad: bad.map(s => [s.type, s.tx, s.ty]), moved: moved && [moved.tx, moved.ty] }); }
    { // the signpost shows the struck-out name, not a note saying it was crossed out
      dialog.queue.length = 0; dialog.cur = null; F.tp(SIGN_TILE.x - 1, SIGN_TILE.y); F.face(SIGN_TILE.x, SIGN_TILE.y); F.press('KeyE'); F.sim(2, []);
      const txt = (dialog.cur && dialog.cur.text) || ''; const struck = 'HOLLOWFORD'.split('').map(c => c + '̶').join('');
      check('signpost: HOLLOWFORD is struck through (U+0336 after every letter) and scorched, never "crossed out"', txt.includes('̶') && txt.includes(struck) && /scorched/.test(txt) && !/crossed out/.test(txt) && /THISTLEDOWN, 1 mile/.test(txt), { txt });
      dialog.queue.length = 0; dialog.cur = null; }
    { // gear tiers: every new item exists with the stated stats, colour, shape, stack 1, id; recipes at the stated level; bronze in the shops; sappers can drop bombs
      const A = { bronze_helm: ['helm', 3, '#b8863a'], bronze_body: ['body', 7, '#b8863a'], bronze_legs: ['legs', 5, '#b8863a'], bronze_shield: ['shield', 4, '#b8863a'], steel_legs: ['legs', 14, '#d5d9e0'], steel_shield: ['shield', 12, '#d5d9e0'] };
      const armour = Object.entries(A).every(([id, [slot, def, col]]) => { const it = ITEMS[id]; return it && it.id === id && it.stack === 1 && it.shape === slot && it.color === col && it.armour && it.armour.slot === slot && it.armour.def === def; });
      const W = { steel_dagger: [9, 12, 0.3, 'swift', 'dagger', '#d5d9e0'], steel_axe: [14, 8, 0.6, undefined, 'axe', '#d5d9e0'], steel_warhammer: [20, 9, 0.7, 'knockback', 'warhammer', '#d5d9e0'], mithril_dagger: [15, 22, 0.3, 'swift', 'dagger', '#7aa0d0'], mithril_warhammer: [32, 18, 0.7, 'knockback', 'warhammer', '#7aa0d0'] };
      const weapons = Object.entries(W).every(([id, [str, att, cd, perk, shape, col]]) => { const it = ITEMS[id], w = it && it.weapon; return w && it.id === id && it.stack === 1 && it.shape === shape && it.color === col && w.str === str && w.att === att && w.cd === cd && w.perk === perk; });
      const tools = ITEMS.steel_axe.tool === 'axe' && ITEMS.steel_axe.tier === 2 && ITEMS.steel_pickaxe && ITEMS.steel_pickaxe.id === 'steel_pickaxe' && ITEMS.steel_pickaxe.tool === 'pickaxe' && ITEMS.steel_pickaxe.tier === 2 && ITEMS.steel_pickaxe.shape === 'pickaxe' && ITEMS.steel_pickaxe.stack === 1 && ITEMS.steel_pickaxe.color === '#d5d9e0';
      const ob = ITEMS.oak_bow; const bow = !!ob && ob.id === 'oak_bow' && ob.weapon.ranged === true && ob.weapon.att === 10 && ob.weapon.cd === 0.58 && ob.value === 120 && ob.shape === 'bow' && ob.stack === 1;
      const R = { steel_legs: [15, 2, 'steel_bar'], steel_shield: [13, 2, 'steel_bar'], steel_dagger: [11, 1, 'steel_bar'], steel_axe: [12, 1, 'steel_bar'], steel_warhammer: [17, 3, 'steel_bar'], steel_pickaxe: [14, 2, 'steel_bar'], mithril_dagger: [23, 1, 'mithril_bar'], mithril_warhammer: [27, 3, 'mithril_bar'] };
      const recipes = Object.entries(R).every(([id, [lv, n, bar]]) => RECIPES.some(r => r.out === id && r.qty === 1 && r.station === 'anvil' && r.skill === 'smithing' && r.lv === lv && r.needs.length === 1 && r.needs[0][0] === bar && r.needs[0][1] === n));
      const br = RECIPES.find(r => r.out === 'oak_bow'); const bowRecipe = !!br && br.station === 'workbench' && br.skill === 'crafting' && br.lv === 8 && br.xp === 40 && JSON.stringify(br.needs) === '[["oak_log",2],["spider_silk",1]]';
      const has = (shop, id, price) => SHOPS[shop].stock.some(([i, p]) => i === id && p === price);
      const shops = has('general', 'bronze_helm', 30) && has('general', 'bronze_shield', 40) && has('smith', 'bronze_body', 60) && has('smith', 'bronze_legs', 45);
      const sapper = MONSTER_DEFS.sapper.drops.table.some(([id, a, b, w]) => id === 'bomb' && a === 1 && b === 1 && w >= 4);
      check('gear tiers: bronze set (shops), steel legs/shield/dagger/axe/warhammer/pickaxe, mithril dagger/warhammer, oak bow — stats, colours, recipes; sappers drop bombs', armour && weapons && tools && bow && recipes && bowRecipe && shops && sapper, { armour, weapons, tools, bow, recipes, bowRecipe, shops, sapper }); }
    { // the oak bow crafts at the Tinker's workbench
      clearJunk(); const inv0 = invSnap(), cxp = player.skills.crafting.xp; player.inv = player.inv.map(s => s && ['oak_log', 'spider_silk', 'oak_bow'].includes(s.id) ? null : s); give('oak_log', 2); give('spider_silk', 1); player.skills.crafting.xp = XP_TABLE[8];
      F.tp(103, 39); F.walkTo(100, 38, 500); F.face(100, 37); F.press('KeyE'); const open = panel === 'station' && panelArg === 'workbench'; const c = F.clickButton('2 Oak logs + Spider silk → Oak bow'); closePanel();
      check('oak bow crafts at a workbench (Crafting 8: 2 oak logs + silk, 40 xp)', open && c && countItem('oak_bow') === 1 && countItem('oak_log') === 0 && countItem('spider_silk') === 0 && player.skills.crafting.xp === XP_TABLE[8] + 40, { open, c, bow: countItem('oak_bow'), cxp: player.skills.crafting.xp - XP_TABLE[8] });
      player.inv = inv0; player.skills.crafting.xp = cxp; }
    // ---------- Cohen's batch (2026-09-07): crafting xp, food, icons, machines, ash, jungle ----------
    { // planks are the first Crafting xp: 2 logs → 4 planks, +6 xp from the pack
      const inv0 = invSnap(); player.inv = player.inv.map(s => s && (s.id === 'wood' || s.id === 'plank') ? null : s); give('wood', 2);
      const cx0 = player.skills.crafting.xp; const rec = RECIPES.find(r => r.out === 'plank'); const ok = craft(rec);
      check('crafting: planks give Crafting xp (2 logs → 4 planks, +6 xp, from the pack)', ok && rec.station === null && rec.skill === 'crafting' && rec.xp === 6 && countItem('plank') === 4 && player.skills.crafting.xp === cx0 + 6, { ok, planks: countItem('plank'), gained: player.skills.crafting.xp - cx0 });
      player.inv = inv0; }
    { // berry bushes: about 60 on the grass, E picks 1–3 berries, the bush goes bare, and it is ripe again after the regrow timer
      const B = T.BERRY_BUSH; let n = 0, bad = 0; for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (map[idx(x, y)] === B) { n++; if (inVillageBounds(tc(x), tc(y)) || (x >= 142 && x <= 158 && y >= 20 && y <= 40) || buildingAt(x, y)) bad++; }
      const inv0 = invSnap(); player.inv = player.inv.map(s => s && s.id === 'berries' ? null : s);
      const bush = F.nearestTile([B], { x: tc(60), y: tc(30) }); let side = null;
      if (bush) for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) if (!side && inMap(bush.x + dx, bush.y + dy) && !SOLID.has(tileAt(bush.x + dx, bush.y + dy))) side = { x: bush.x + dx, y: bush.y + dy };
      let picked = 0, bare = false, again = 0;
      if (side) { F.tp(side.x, side.y); F.face(bush.x, bush.y); F.press('KeyE'); F.sim(2, []); picked = countItem('berries'); notice = null; F.press('KeyE'); F.sim(2, []); bare = countItem('berries') === picked && !!notice && /bare/.test(notice.text) && FOOD.bushes.has(idx(bush.x, bush.y));
        FOOD.bushes.get(idx(bush.x, bush.y)).timer = 0.01; F.sim(2, []); F.press('KeyE'); F.sim(2, []); again = countItem('berries') - picked; }
      check('food: ~60 berry bushes on open grass (none in Thistledown, the camp or a building); E picks 1–3 berries, the bush goes bare, then regrows and picks again', n >= 50 && n <= 60 && bad === 0 && !!side && picked >= 1 && picked <= 3 && bare && again >= 1 && again <= 3 && ITEMS.berries.heal === 2 && ITEMS.berries.value === 2 && FOOD.BUSH_REGROW === 120, { n, bad, bush: bush && [bush.x, bush.y], picked, bare, again });
      player.inv = inv0; }
    { // wheat: Greta sells the seed, it plants on soil like a potato, the crop remembers what it is, harvest gives wheat
      const inv0 = invSnap(); clearJunk(); player.inv = player.inv.map(s => s && (s.id === 'wheat' || s.id === 'wheat_seed') ? null : s); if (!hasTool('hoe')) give('bronze_hoe', 1); give('wheat_seed', 1);
      const o = openSpot(70, 30); F.tp(o.x, o.y); const gt = { x: o.x + 1, y: o.y }; if (tileAt(gt.x, gt.y) !== T.SOIL) changeTile(gt.x, gt.y, T.SOIL);
      F.face(gt.x, gt.y); F.press('KeyE'); F.sim(2, []); const c = crops.find(c => c.i === idx(gt.x, gt.y)); const planted = tileAt(gt.x, gt.y) === T.CROP && !!c && c.crop === 'wheat' && countItem('wheat_seed') === 0;
      if (c) c.stage = 3; F.press('KeyE'); F.sim(2, []);
      check('food: wheat seed (Greta, 2c) plants like a potato, the crop entry says wheat, harvest gives 2–4 wheat', SHOPS.seeds.stock.some(([id, p]) => id === 'wheat_seed' && p === 2) && ITEMS.wheat_seed.seed === 'wheat' && planted && countItem('wheat') >= 2 && countItem('wheat') <= 4 && tileAt(gt.x, gt.y) === T.SOIL, { planted, wheat: countItem('wheat'), crop: c && c.crop });
      changeTile(gt.x, gt.y, T.GRASS); player.inv = inv0; }
    { // flour at a workbench: 2 wheat → 1 flour, Crafting 1, 4 xp
      const inv0 = invSnap(); player.inv = player.inv.map(s => s && (s.id === 'wheat' || s.id === 'flour') ? null : s); give('wheat', 2); const cx0 = player.skills.crafting.xp;
      const rec = RECIPES.find(r => r.out === 'flour'); const ok = !!rec && rec.station === 'workbench' && craft(rec);
      check('food: 2 wheat → flour at a workbench (Crafting 1, 4 xp)', ok && countItem('flour') === 1 && countItem('wheat') === 0 && player.skills.crafting.xp === cx0 + 4, { ok, flour: countItem('flour'), gained: player.skills.crafting.xp - cx0 });
      player.inv = inv0; }
    { // pies at the bakery oven: E with flour + berries opens the oven panel; the pie lands with Cooking xp; without flour E just cooks
      const inv0 = invSnap(); clearJunk(); player.inv = player.inv.map(s => s && ['berries', 'flour', 'berry_pie', 'raw_beef', 'raw_trout'].includes(s.id) ? null : s);
      const bakery = BUILDINGS.find(b => b.id === 'bakery'); const ov = bakery.f.find(f => f[0] === T.OVEN); const ox = bakery.x + ov[1], oy = bakery.y + ov[2];
      F.tp(ox, oy + 1); F.face(ox, oy); closePanel(); player.action = null;
      F.press('KeyE'); F.sim(1, []); const plain = panel !== 'oven'; closePanel(); player.action = null;
      give('berries', 4); give('flour', 1); const cook0 = player.skills.cooking.xp;
      F.press('KeyE'); const opened = panel === 'oven' && !!insideBuilding(ox, oy + 1); const clicked = F.clickButton('4 Berries + Flour → Berry pie'); closePanel();
      const pie = RECIPES.find(r => r.out === 'berry_pie'), meat = RECIPES.find(r => r.out === 'meat_pie'), fish = RECIPES.find(r => r.out === 'fish_pie');
      const defs = !!pie && pie.station === 'oven' && pie.skill === 'cooking' && !!meat && meat.station === 'oven' && meat.lv === 8 && meat.xp === 60 && !!fish && fish.station === 'oven' && fish.lv === 12 && ITEMS.fish_pie.heal === 14 && ITEMS.berry_pie.heal === 10 && ITEMS.berry_pie.value === 30;
      check('food: the bakery oven bakes a berry pie (4 berries + flour) with Cooking xp; meat and fish pies are oven recipes; no flour = the plain cook', plain && opened && clicked && countItem('berry_pie') === 1 && countItem('berries') === 0 && countItem('flour') === 0 && player.skills.cooking.xp === cook0 + pie.xp && defs, { plain, opened, clicked, pie: countItem('berry_pie'), gained: player.skills.cooking.xp - cook0, defs });
      player.inv = inv0; }
    { // draw paths: the pickaxe icon, a parked walker tile (empty seat) and the wreck all draw without throwing (the harness canvas is a stub)
      let icon = true, mech = true; try { drawItemIcon(ctx, 'bronze_pickaxe', 0, 0, 18); drawItemIcon(ctx, 'berries', 0, 0, 18); drawItemIcon(ctx, 'wheat', 0, 0, 18); drawItemIcon(ctx, 'flour', 0, 0, 18); } catch (e) { icon = false; }
      const o = openSpot(50, 30); try { drawFurniture(ctx, o.x + 1, o.y, T.MECH); drawFurniture(ctx, o.x + 1, o.y, T.WRECK); changeTile(o.x + 1, o.y, T.MECH); F.tp(o.x, o.y); render(); } catch (e) { mech = false; }
      changeTile(o.x + 1, o.y, T.GRASS);
      check('draw: pickaxe/berry/wheat/flour icons and the parked walker (MECH) + wreck tiles draw without error', icon && mech, { icon, mech }); }
    { // the bulldozer blade: tree → stump (regrow, a log), rock → rubble (regrow, stone), the next pass grinds them flat; fences and gates hold
      const o = openSpot(56, 40); const e = { x: tc(o.x), y: tc(o.y), r: 22 }; const dir = { x: 1, y: 0 }; const d0 = drops.length;
      changeTile(o.x + 1, o.y, T.TREE); dozerPlow(e, dir, false); const stump = tileAt(o.x + 1, o.y) === T.STUMP && regrow.some(r => r.i === idx(o.x + 1, o.y) && r.t === T.TREE) && drops.slice(d0).some(d => d.id === 'wood');
      dozerPlow(e, dir, false); const ground = tileAt(o.x + 1, o.y) === T.GRASS;
      changeTile(o.x + 1, o.y, T.ROCK); dozerPlow(e, dir, false); const rubble = tileAt(o.x + 1, o.y) === T.RUBBLE && regrow.some(r => r.i === idx(o.x + 1, o.y) && r.t === T.ROCK) && drops.slice(d0).some(d => d.id === 'stone');
      dozerPlow(e, dir, false); const ground2 = tileAt(o.x + 1, o.y) === T.GRASS;
      changeTile(o.x + 1, o.y, T.FENCE); dozerPlow(e, dir, false); const fence = tileAt(o.x + 1, o.y) === T.FENCE; changeTile(o.x + 1, o.y, T.GATE); dozerPlow(e, dir, false); const gate = tileAt(o.x + 1, o.y) === T.GATE;
      check('bulldozer: tree → stump (regrow + log), rock → rubble (regrow + stone), the next pass grinds them flat; fences and gates are never flattened', stump && ground && rubble && ground2 && fence && gate, { stump, ground, rubble, ground2, fence, gate });
      changeTile(o.x + 1, o.y, T.GRASS); regrow = regrow.filter(r => r.i !== idx(o.x + 1, o.y)); drops = drops.filter((d, i) => i < d0); }
    { // a goblin-driven bulldozer still rams goblins in its way, at half the knight's damage (3–6)
      const o = openSpot(60, 40); F.tp(o.x - 12, o.y + 12); const dz = monsters.find(m => m.type === 'bulldozer'); const gob = monsters.find(m => m.type === 'goblin' && !m.dead);
      const ds = dz && { x: dz.x, y: dz.y, home: dz.home, dead: dz.dead, hp: dz.hp, state: dz.state, respawnT: dz.respawnT, deadT: dz.deadT }; const gs = { x: gob.x, y: gob.y, home: gob.home, hp: gob.hp, state: gob.state, dead: gob.dead, respawnT: gob.respawnT };
      let ok = false, info = { dozer: !!dz };
      if (dz) {
        dz.dead = false; dz.hp = dz.maxHp; dz.x = tc(o.x) - 40; dz.y = tc(o.y); dz.home = { x: dz.x, y: dz.y }; dz.state = 'idle'; dz.stunT = 0; dz.chargeT = 1; dz.chargeDir = { x: 1, y: 0 }; dz.chargeHit = false; dz.rammed = [];
        gob.dead = false; gob.hp = 30; gob.maxHp = 30; gob.x = tc(o.x) + 30; gob.y = tc(o.y); gob.home = { x: gob.x, y: gob.y }; gob.stunT = 5; gob.state = 'idle';
        F.sim(20, []); ok = !gob.dead && gob.hp >= 24 && gob.hp <= 27; info = { dead: gob.dead, took: 30 - gob.hp };
        dz.chargeT = 0; Object.assign(dz, ds); gob.maxHp = MONSTER_DEFS.goblin.hp;
      }
      check('friendly fire: a goblin-driven bulldozer rams a goblin in its path for half damage (3–6)', ok, info);
      Object.assign(gob, gs); gob.stunT = 0; }
    { // the core parks the machine you are in: X from the bulldozer leaves T.DOZER, a wrecked bulldozer leaves T.DOZER_WRECK; the walker keeps T.MECH / T.WRECK
      const o = openSpot(44, 24); F.tp(o.x, o.y); player.facing = { x: 1, y: 0 }; player.action = null; const r0 = player.r, s0 = player.speed;
      player.mech = { hp: 110, maxHp: 110, kind: 'dozer' }; player.r = 22; player.speed = 130; notice = null; exitMech();
      const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
      const dozer = !player.mech && !!nearestTileOfType(ptx, pty, T.DOZER, 2) && !nearestTileOfType(ptx, pty, T.MECH, 2) && !!notice && /bulldozer/.test(notice.text); const dn = notice && notice.text;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (tileAt(ptx + dx, pty + dy) === T.DOZER) changeTile(ptx + dx, pty + dy, T.GRASS);
      F.tp(o.x, o.y); player.mech = { hp: 110, maxHp: 110, kind: 'dozer' }; player.r = 22; dialog.queue.length = 0; dialog.cur = null; wreckMech();
      const wtx = Math.floor(player.x / TILE), wty = Math.floor(player.y / TILE); const wreck = !player.mech && !!nearestTileOfType(wtx, wty, T.DOZER_WRECK, 2) && !nearestTileOfType(wtx, wty, T.WRECK, 2) && (dialog.cur && /bulldozer gives out/.test(dialog.cur.text) || dialog.queue.some(d => /bulldozer gives out/.test(d.text)));
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (tileAt(wtx + dx, wty + dy) === T.DOZER_WRECK) changeTile(wtx + dx, wty + dy, T.GRASS);
      F.tp(o.x, o.y); player.mech = { hp: 130, maxHp: 130 }; player.r = 20; notice = null; exitMech(); const mtx = Math.floor(player.x / TILE), mty = Math.floor(player.y / TILE);
      const walker = !player.mech && !!nearestTileOfType(mtx, mty, T.MECH, 2) && !nearestTileOfType(mtx, mty, T.DOZER, 2) && !!notice && /walker/.test(notice.text);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (tileAt(mtx + dx, mty + dy) === T.MECH) changeTile(mtx + dx, mty + dy, T.GRASS);
      dialog.queue.length = 0; dialog.cur = null; player.r = r0; player.speed = s0; player.mech = null;
      check('machines: X from the bulldozer parks T.DOZER and a wrecked bulldozer leaves T.DOZER_WRECK (never walker tiles); the walker still parks T.MECH', dozer && wreck && walker, { dozer, wreck, walker, dn }); }
    { // walker and bulldozer come back after an hour, even inside the camp (the camp's 1800 s never shortens it)
      const wk = monsters.find(m => m.type === 'walker'); const ws = { x: wk.x, y: wk.y, dead: wk.dead, hp: wk.hp, respawnT: wk.respawnT, deadT: wk.deadT, state: wk.state }; const k0 = player.kills, wq = quest.walkerKilled;
      wk.dead = false; wk.hp = 1; wk.x = tc(VILLAGE.x0); wk.y = tc(20); dialog.queue.length = 0; dialog.cur = null; const d0 = drops.length; killMonster(wk); const rt = wk.respawnT; const noWreck = tileAt(VILLAGE.x0, 20) === T.FENCE;
      check('machines: walker and bulldozer respawn 3600 s (a killed camp walker waits at least an hour)', MONSTER_DEFS.walker.respawn === 3600 && MONSTER_DEFS.bulldozer.respawn === 3600 && rt >= 3600 && noWreck, { rt, noWreck });
      Object.assign(wk, ws); player.kills = k0; quest.walkerKilled = wq; drops = drops.filter((d, i) => i < d0); dialog.queue.length = 0; dialog.cur = null; }
    { // the Ashfields: ash in patches (25–60% of dragon country outside the lair), grass and dirt between; lava and obsidian still there
      let ash = 0, area = 0, lava = 0, obs = 0, green = 0; const inFang = (x, y) => x >= 2 && x <= 34 && y >= 108 && y <= 138;
      for (let y = 96; y <= 138; y++) for (let x = 1; x <= 99; x++) { if (inFang(x, y)) continue; area++; const t = tileAt(x, y); if (t === T.ASH) ash++; else if (t === T.LAVA) lava++; else if (t === T.OBSIDIAN) obs++; else if (t === T.GRASS || t === T.DIRT) green++; }
      const cover = ash / area;
      check('ashfields: ash lies in patches — 25–60% of dragon country, grass and dirt between, lava and obsidian kept', cover >= 0.25 && cover <= 0.6 && green > 500 && lava >= 40 && obs >= 30, { cover: +cover.toFixed(2), ash, area, green, lava, obs }); }
    { // the jungle runs south to the map edge: giant trees and ferns in the band y 140–178 at the old density
      let trees = 0, ferns = 0, band = 0, row150 = 0; for (let y = 140; y <= 178; y++) for (let x = 100; x <= 198; x++) { band++; const t = tileAt(x, y); if (t === T.JUNGLE) { trees++; if (y === 150) row150++; } else if (t === T.FERN) ferns++; }
      check('jungle: the biome continues south (y 140–178, x 100–198) at the same density; jungle trees stand at y 150', row150 >= 20 && trees / band > 0.3 && trees / band < 0.5 && ferns / band > 0.06 && regionAt(150, 160).name === 'The Jungle' && regionAt(133, 120).name === 'Sylvaris', { row150, trees: +(trees / band).toFixed(2), ferns: +(ferns / band).toFixed(2), region: regionAt(150, 160).name }); }
    peace(false);
    for (const h of HOOKS.selfTest) h(check, F, { give, peace, openSpot, clearJunk });
    const fails = Object.values(report).filter(v => v.startsWith('FAIL')).length;
    report.summary = fails ? `${fails} FAILED of ${Object.keys(report).length}` : `ALL ${Object.keys(report).length} PASS`;
    console.table(report);
    return report;
  },
};
