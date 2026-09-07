// ============================================================================
// FEATURE: BULLDOZER UPGRADES — Cohen's design
// "Since you can rebuild the bulldozers and claim one for yourself, you should be able to upgrade them: a drill
// attachment on the front so you can get stone, then upgrade it so you can get iron, so it makes resource collecting
// easier. You have to work for and build all the upgrades. Also upgrades so you can ram harder. Unlock them by getting
// blueprints as rare drops from the machines' owners."
// Four blueprints drop from the goblins who own the machines. Each one, plus materials and a Crafting level, is fitted at
// the bulldozer bay: a mechanic's pit in the smithy yard behind Brakka's. Upgrades live on the knight (player.dozerUp)
// and ride with him onto any bulldozer he drives; 22-bulldozer.js reads them (plow, Space, climb-on, sprite).
// Registers through HOOKS only; touches no core file. window.DOZERUP exposes the tables for other features and the self-test.
// ============================================================================
{
  // ---------- blueprints ----------
  const BLUE = '#3b6fb6';
  Object.assign(ITEMS, {
    blueprint_drill: { name: 'Blueprint: drill', value: 200, color: BLUE, shape: 'plank', stack: 1 },
    blueprint_irondrill: { name: 'Blueprint: iron drill', value: 400, color: BLUE, shape: 'plank', stack: 1 },
    blueprint_ram: { name: 'Blueprint: ram plate', value: 300, color: BLUE, shape: 'plank', stack: 1 },
    blueprint_boiler: { name: 'Blueprint: big boiler', value: 500, color: BLUE, shape: 'plank', stack: 1 },
  });
  const BLUEPRINTS = ['blueprint_drill', 'blueprint_irondrill', 'blueprint_ram', 'blueprint_boiler'];
  for (const k of BLUEPRINTS) { ITEMS[k].id = k; ITEMS[k].stack = 1; }

  // ---------- the upgrades ----------
  // requires: another upgrade that must be fitted first (the iron drill bolts onto the drill).
  const UPGRADES = [
    { id: 'drill', name: 'Drill', blueprint: 'blueprint_drill', needs: [['iron_bar', 4], ['goblin_scrap', 6]], lv: 10, xp: 150,
      blurb: 'A spinning iron cone on the blade. Rocks you drive into are mined: stone into the pack, Mining xp.',
      line: 'An iron cone on the nose of the blade, geared to the front axle. It turns when the wheels turn. Rocks will not like it.' },
    { id: 'irondrill', name: 'Iron drill', blueprint: 'blueprint_irondrill', needs: [['steel_bar', 6], ['coal', 4]], lv: 20, xp: 300, requires: 'drill',
      blurb: 'Steel teeth on the drill. Iron rocks and coal rocks too, straight into the pack.',
      line: 'Steel teeth set into the cone, hardened in coal. Iron and coal rock give up their ore to it.' },
    { id: 'ram', name: 'Ram plate', blueprint: 'blueprint_ram', needs: [['iron_bar', 4], ['blast_powder', 2]], lv: 15, xp: 200,
      blurb: 'A riveted iron slab over the blade. Space hits twice as hard and shoves half again as far. Stumps and rubble go flat in one pass.',
      line: 'Four bars of iron beaten into a slab, blast-riveted over the blade. Whatever it meets goes the other way, quickly.' },
    { id: 'boiler', name: 'Big boiler', blueprint: 'blueprint_boiler', needs: [['mithril_bar', 2], ['coal', 4]], lv: 25, xp: 400,
      blurb: 'A mithril-banded drum with twice the pressure. Speed 130 → 170. Hull 110 → 180.',
      line: 'A wider drum, banded in mithril so it can hold twice the steam. The wheels have never turned this fast. The hull is thicker to match.' },
  ];
  const upgradeById = id => UPGRADES.find(u => u.id === id);
  const DU = () => player.dozerUp || (player.dozerUp = { drill: false, irondrill: false, ram: false, boiler: false });
  // "missing" = the knight neither carries the blueprint (pack or bank) nor has fitted the upgrade
  const hasBlueprint = id => countItem(id) > 0 || player.bank.some(b => b.id === id) || !!(player.dozerUp && player.dozerUp[UPGRADES.find(u => u.blueprint === id).id]);
  const missingBlueprints = () => BLUEPRINTS.filter(id => !hasBlueprint(id));

  // ---------- drops: the machines' owners ----------
  // chance: 1 in N per kill. pool: which blueprints. Missing ones are preferred; missingOnly pools drop nothing when the knight has them all.
  // The bosses (Barrelbeast, Gnasher) hand over the boiler blueprint every time it is missing — the first kill is guaranteed, and a lost one can be earned back.
  const BLUEPRINT_DROPS = {
    sapper: { chance: 25, pool: ['blueprint_drill'] },
    brute: { chance: 30, pool: ['blueprint_ram'] },
    bulldozer: { chance: 6, pool: BLUEPRINTS, missingOnly: true },
    walker: { chance: 8, pool: ['blueprint_irondrill', 'blueprint_boiler'] },
    barrelbeast: { chance: 1, pool: ['blueprint_boiler'], missingOnly: true },
    gnasher: { chance: 1, pool: ['blueprint_boiler'], missingOnly: true },
  };
  let blueprintsDropped = 0, pendingBanner = null;
  HOOKS.update.push(() => { if (pendingBanner && !levelBanner) { levelBanner = pendingBanner; pendingBanner = null; } });
  // Rolls a blueprint for a killed monster; returns the item id dropped, or null. Split from the hook so the self-test can force it.
  function rollBlueprint(m) {
    const d = BLUEPRINT_DROPS[m.type]; if (!d) return null;
    if (d.chance > 1 && Math.random() >= 1 / d.chance) return null;
    const missing = d.pool.filter(id => !hasBlueprint(id));
    const from = missing.length ? missing : d.missingOnly ? [] : d.pool;
    if (!from.length) return null;
    const id = pick(from);
    drops.push({ x: m.x + rint(-14, 14), y: m.y + rint(-14, 14), id, qty: 1, t: 0, rare: true });
    // RARE DROP banner — unless another banner is up (a boss kill's CHAPTER COMPLETE): then it waits its turn (HOOKS.update below)
    const banner = { text: 'RARE DROP', sub: ITEMS[id].name, t: 3 };
    if (levelBanner && levelBanner.t > 0 && levelBanner.text !== 'RARE DROP') pendingBanner = banner; else levelBanner = banner;
    burst(m.x, m.y, '#f5c542', 30, 160); burst(m.x, m.y, BLUE, 16, 120);
    blueprintsDropped++;
    return id;
  }
  HOOKS.kill.push(m => { rollBlueprint(m); });

  // ---------- the bay ----------
  // A mechanic's pit in the smithy yard: the two-row grass strip between Brakka's south wall and the road. (96, 43) keeps the
  // smithy door lane (x 93) clear; if another feature has built there, the nearest free grass tile in the strip is used instead.
  const T_BAY = addTile('DOZER_BAY', { solid: true, tex: 'cobble', mini: '#5a5a62' });
  const BAY_WANT = [96, 43];
  let bayPos = null;
  HOOKS.world.push((rnd, api) => {
    const free = (x, y) => inMap(x, y) && api.tileAt(x, y) === T.GRASS && !insideBuilding(x, y);
    const spots = [BAY_WANT, [97, 43], [95, 43], [98, 43], [96, 42], [97, 42], [95, 42], [98, 42], [94, 43], [94, 42]];
    const s = spots.find(([x, y]) => free(x, y));
    if (!s) { bayPos = null; return; }
    api.setTile(s[0], s[1], T_BAY); bayPos = { x: s[0], y: s[1] };
  });
  HOOKS.use.push((t, tx, ty) => { if (t !== T_BAY) return false; openPanel('dozerup'); return true; });

  // ---------- fitting ----------
  // Returns { ok, why } without touching anything; fitUpgrade() does the work and reports through notify/say.
  function canFitUpgrade(u) {
    const up = DU();
    if (up[u.id]) return { ok: false, why: `The ${u.name.toLowerCase()} is already fitted.` };
    if (u.requires && !up[u.requires]) return { ok: false, why: `Fit the ${upgradeById(u.requires).name.toLowerCase()} first.` };
    if (countItem(u.blueprint) < 1) return { ok: false, why: `You need the blueprint for the ${u.name.toLowerCase()}. The goblins who own the machines carry them.` };
    if (skillLv('crafting') < u.lv) return { ok: false, why: `You need Crafting level ${u.lv} to fit the ${u.name.toLowerCase()}.` };
    const short = u.needs.filter(([id, q]) => countItem(id) < q);
    if (short.length) return { ok: false, why: `The ${u.name.toLowerCase()} needs ${u.needs.map(([id, q]) => `${q} ${ITEMS[id].name.toLowerCase()}`).join(' and ')} (you have ${u.needs.map(([id]) => countItem(id)).join(' and ')}).` };
    return { ok: true, why: '' };
  }
  function fitUpgrade(u) {
    const c = canFitUpgrade(u);
    if (!c.ok) { notify(c.why); return false; }
    removeItem(u.blueprint, 1);
    for (const [id, q] of u.needs) removeItem(id, q);
    DU()[u.id] = true;
    gainXp('crafting', u.xp);
    burst(player.x, player.y, '#ffb347', 24, 120); burst(player.x, player.y, BLUE, 12, 90); sfx('levelup');
    levelBanner = { text: 'UPGRADE FITTED', sub: u.name, t: 3 };
    say(u.line + (player.mech && player.mech.kind === 'dozer' ? '' : ' It goes on the next bulldozer you climb onto.'), 'The Voice');
    save();
    return true;
  }

  // ---------- panel ----------
  HOOKS.panel.dozerup = (g, narrow) => {
    const up = DU();
    const rowH = clamp(Math.floor((VH - 20 - 150) / UPGRADES.length), 60, 78);
    const fitted = UPGRADES.filter(u => up[u.id]).length;
    const { px, py, w, h } = panelBox(g, narrow ? VW - 20 : 620, 96 + UPGRADES.length * rowH + 52, 'Bulldozer bay', `Fit upgrades onto the bulldozer · ${fitted} of ${UPGRADES.length} fitted · they ride with you onto any bulldozer`);
    const fit = (text, maxW) => { let s = text; while (s.length > 8 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s === text ? text : s + '…'; };
    const bw = narrow ? 92 : 118, textW = w - 36 - bw - 24;
    UPGRADES.forEach((u, i) => {
      const y = py + 66 + i * rowH, isDone = !!up[u.id], c = isDone ? { ok: false } : canFitUpgrade(u), hasBp = countItem(u.blueprint) > 0;
      roundRect(g, px + 18, y, w - 36, rowH - 6, 8); g.fillStyle = isDone ? 'rgba(59,111,182,0.14)' : c.ok ? 'rgba(126,231,135,0.10)' : 'rgba(255,255,255,0.05)'; g.fill();
      if (c.ok) { g.strokeStyle = 'rgba(126,231,135,0.45)'; g.lineWidth = 1; g.stroke(); }
      if (isDone) { g.strokeStyle = 'rgba(59,111,182,0.6)'; g.lineWidth = 1; g.stroke(); }
      drawItemIcon(g, u.blueprint, px + 36, y + rowH / 2 - 3, 16);
      g.textAlign = 'left'; g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif'; g.fillText(fit(`${u.name}${isDone ? '  · fitted' : ''}`, textW - 30), px + 56, y + 18);
      g.fillStyle = isDone ? '#8b949e' : '#c9d1d9'; g.font = '12px sans-serif'; g.fillText(fit(u.blurb, textW - 30), px + 56, y + 35);
      const needs = `${hasBp ? 'Blueprint ✓' : 'Blueprint ✗'} · ${u.needs.map(([id, q]) => `${q} ${ITEMS[id].name.toLowerCase()} (${countItem(id)})`).join(' · ')} · Crafting ${u.lv}${u.requires ? ` · needs ${upgradeById(u.requires).name.toLowerCase()}` : ''}`;
      g.font = '11px sans-serif'; g.fillStyle = isDone ? '#4b535d' : c.ok ? '#7ee787' : '#8b949e'; g.fillText(fit(isDone ? 'Fitted. It stays with you.' : needs, textW - 30), px + 56, y + 51);
      const bx = px + w - 18 - bw, by = y + Math.floor(rowH / 2) - 18;
      if (isDone) button(g, bx, by, bw, 30, 'Fitted', () => { }, '#2a2f3a', false);
      else button(g, bx, by, bw, 30, `Fit: ${u.name}`, () => { fitUpgrade(u); }, c.ok ? '#238636' : '#2a2f3a', c.ok);
    });
    const fy = py + h - 44;
    button(g, px + w - 18 - 100, fy, 100, 30, 'Close', closePanel, '#21262d');
    g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText(fit('Blueprints drop from the goblins who own the machines: sappers, brutes, walkers, bulldozers, the Barrelbeast.', w - 36 - 110), px + 18, fy + 20);
  };

  // ---------- drawing: the pit ----------
  function drawBay(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    // the pit: a dark rectangular hole edged with iron, planks over one end
    g.fillStyle = '#5a5a62'; roundRect(g, cx - 22, cy - 18, 44, 36, 4); g.fill();
    g.fillStyle = '#15161c'; roundRect(g, cx - 18, cy - 14, 36, 28, 3); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 18, cy - 8); g.lineTo(cx + 18, cy - 8); g.moveTo(cx - 18, cy + 4); g.lineTo(cx + 18, cy + 4); g.stroke();
    g.fillStyle = '#7a4a2a'; for (const ox of [-16, -10]) g.fillRect(cx + ox, cy - 14, 5, 28);
    // tool rack along the top edge: a spanner, a hammer, an oil can, a coil of chain
    g.strokeStyle = '#c9ccd3'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 4, cy - 12); g.lineTo(cx + 4, cy - 2); g.stroke(); g.beginPath(); g.arc(cx - 5, cy - 13, 2.6, 0, 7); g.stroke();
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 9, cy - 12); g.lineTo(cx + 13, cy + 0); g.stroke(); g.fillStyle = '#3a3a42'; g.fillRect(cx + 6, cy - 15, 7, 4);
    g.fillStyle = '#4a7a3a'; roundRect(g, cx + 8, cy + 5, 7, 8, 2); g.fill(); g.fillRect(cx + 10, cy + 2, 3, 3);
    g.strokeStyle = '#8f96a3'; g.lineWidth = 1.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx - 6 + k * 4, cy + 9, 2.2, 0, 7); g.stroke(); }
    // a spare wheel leaning on the corner and a smear of grease
    g.fillStyle = '#2f2a26'; g.beginPath(); g.arc(cx - 20, cy + 16, 6, 0, 7); g.fill(); g.fillStyle = '#5a4a3a'; g.beginPath(); g.arc(cx - 20, cy + 16, 3.5, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx + 16, cy + 18, 7, 3, 0, 0, 7); g.fill();
    // blue blueprint pinned to a post when something can be fitted right now
    if (!player.mech && UPGRADES.some(u => !DU()[u.id] && canFitUpgrade(u).ok)) { const bob = Math.sin(time * 4) * 2; g.fillStyle = BLUE; g.fillRect(cx - 5, cy - 34 + bob, 10, 7); g.fillStyle = '#e6edf3'; g.fillRect(cx - 3, cy - 32 + bob, 6, 1); g.fillRect(cx - 3, cy - 30 + bob, 4, 1); }
  }
  HOOKS.draw.push((g, items, cam) => {
    if (!bayPos || tileAt(bayPos.x, bayPos.y) !== T_BAY) return;
    const { x: tx, y: ty } = bayPos;
    if (tx * TILE < cam.x - 80 || tx * TILE > cam.x + VW + 80 || ty * TILE < cam.y - 80 || ty * TILE > cam.y + VH + 80) return;
    items.push({ y: ty * TILE + TILE - 10, draw: () => drawBay(g, tx, ty) });
    if (!player.dead && !player.mech) { // use-highlight (the core only highlights its own INTERESTING tiles)
      const ft = frontTile(player);
      if (ft.tx === tx && ft.ty === ty) items.push({ y: 1e9, draw: () => { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); } });
    }
  });
  HOOKS.newGame.push(() => { blueprintsDropped = 0; pendingBanner = null; });

  window.DOZERUP = { UPGRADES, BLUEPRINTS, BLUEPRINT_DROPS, tile: T_BAY, get bay() { return bayPos; }, rollBlueprint, fitUpgrade, canFitUpgrade, hasBlueprint, missingBlueprints, get dropped() { return blueprintsDropped; } };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'dozerup: ';
    // 1. items + drop table
    check(P + 'four blueprints (plank shape, blue, stack 1, values 200/400/300/500) and the drop chance table',
      BLUEPRINTS.every(id => ITEMS[id] && ITEMS[id].id === id && ITEMS[id].stack === 1 && ITEMS[id].shape === 'plank' && ITEMS[id].color === BLUE)
      && ITEMS.blueprint_drill.value === 200 && ITEMS.blueprint_irondrill.value === 400 && ITEMS.blueprint_ram.value === 300 && ITEMS.blueprint_boiler.value === 500
      && BLUEPRINT_DROPS.sapper.chance === 25 && BLUEPRINT_DROPS.sapper.pool.join() === 'blueprint_drill'
      && BLUEPRINT_DROPS.brute.chance === 30 && BLUEPRINT_DROPS.brute.pool.join() === 'blueprint_ram'
      && BLUEPRINT_DROPS.bulldozer.chance === 6 && BLUEPRINT_DROPS.bulldozer.pool.length === 4 && BLUEPRINT_DROPS.bulldozer.missingOnly === true
      && BLUEPRINT_DROPS.walker.chance === 8 && BLUEPRINT_DROPS.walker.pool.join() === 'blueprint_irondrill,blueprint_boiler'
      && BLUEPRINT_DROPS.barrelbeast.chance === 1 && BLUEPRINT_DROPS.barrelbeast.pool.join() === 'blueprint_boiler' && BLUEPRINT_DROPS.gnasher.chance === 1
      && HOOKS.kill.length > 0,
      { drops: Object.fromEntries(Object.entries(BLUEPRINT_DROPS).map(([k, v]) => [k, v.chance])) });
    // 2. forced drops: Math.random stubbed low → a blueprint drops with the RARE DROP banner; stubbed high → nothing; bulldozer with none missing → nothing
    {
      const rnd = Math.random; const bank0 = player.bank.map(s => ({ ...s })); const inv0 = player.inv.map(s => s ? { ...s } : null); const up0 = player.dozerUp;
      player.bank = []; player.inv = player.inv.map(s => s && BLUEPRINTS.includes(s.id) ? null : s); player.dozerUp = { drill: false, irondrill: false, ram: false, boiler: false };
      const at = { x: -900, y: -900 }; drops = drops.filter(d => d.x > -500);
      const d0 = drops.length;
      Math.random = () => 0; levelBanner = null;
      const r1 = rollBlueprint({ type: 'sapper', ...at }), r2 = rollBlueprint({ type: 'brute', ...at }), r3 = rollBlueprint({ type: 'walker', ...at }), r4 = rollBlueprint({ type: 'barrelbeast', ...at });
      const banner = levelBanner && levelBanner.text === 'RARE DROP';
      const rareAll = drops.slice(d0).every(d => d.rare && BLUEPRINTS.includes(d.id));
      Math.random = () => 0.999;
      const n1 = rollBlueprint({ type: 'sapper', ...at }), n2 = rollBlueprint({ type: 'bulldozer', ...at }), n3 = rollBlueprint({ type: 'goblin', ...at });
      Math.random = () => 0;
      const w1 = rollBlueprint({ type: 'bulldozer', ...at }); // all four missing → any one
      player.dozerUp = { drill: true, irondrill: true, ram: true, boiler: true };
      const full = rollBlueprint({ type: 'bulldozer', ...at }), fullBoss = rollBlueprint({ type: 'barrelbeast', ...at }), fullSapper = rollBlueprint({ type: 'sapper', ...at }); // fitted = not missing: nothing from the machines, still a spare from the sapper
      Math.random = rnd;
      check(P + 'forced drops (Math.random stubbed): sapper → drill, brute → ram, walker → iron drill or boiler, Barrelbeast → boiler; high roll → nothing; bulldozer/boss drop nothing when none is missing',
        r1 === 'blueprint_drill' && r2 === 'blueprint_ram' && ['blueprint_irondrill', 'blueprint_boiler'].includes(r3) && r4 === 'blueprint_boiler' && banner && rareAll
        && n1 === null && n2 === null && n3 === null && BLUEPRINTS.includes(w1) && full === null && fullBoss === null && fullSapper === 'blueprint_drill',
        { r1, r2, r3, r4, banner, n1, n2, n3, w1, full, fullBoss, fullSapper });
      drops = drops.filter(d => d.x > -500); levelBanner = null; player.bank = bank0; player.inv = inv0; player.dozerUp = up0;
    }
    // 3. the bay tile exists in the smithy yard and E opens the panel
    const bay = bayPos;
    check(P + 'DOZER_BAY tile registered (solid, cobble) and carved in the smithy yard by (96, 43)', T.DOZER_BAY === T_BAY && SOLID.has(T_BAY) && !!bay && tileAt(bay.x, bay.y) === T_BAY && Math.abs(bay.x - 96) <= 2 && Math.abs(bay.y - 43) <= 1 && !insideBuilding(bay.x, bay.y), { bay });
    if (!bay) return;
    h.peace(true); closePanel();
    const inv0 = player.inv.map(s => s ? { ...s } : null), craft0 = player.skills.crafting.xp, up0 = player.dozerUp;
    player.dozerUp = { drill: false, irondrill: false, ram: false, boiler: false };
    h.clearJunk(); { let free = player.inv.filter(s => !s).length; for (let i = player.inv.length - 1; i >= 0 && free < 8; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour) { player.inv[i] = null; free++; } } }
    for (const id of BLUEPRINTS) removeItem(id, 99);
    F.tp(bay.x, bay.y + 1); F.face(bay.x, bay.y); player.mech = null; player.r = 13; player.speed = 175;
    F.press('KeyE'); const opened = panel === 'dozerup';
    render();
    const rows = buttons.filter(b => /^(disabled:)?Fit: /.test(b.label)).length;
    check(P + 'E at the bay opens the Bulldozer bay panel with a row per upgrade', opened && rows === 4 && !!panelRect, { opened, rows, panel });
    // 4. fitting: each upgrade refuses without the blueprint / level / materials, and fits with them (blueprint + materials consumed, crafting xp)
    const fitOne = (u, mats) => {
      player.skills.crafting.xp = XP_TABLE[Math.max(1, u.lv - 1)];
      for (const [id] of u.needs) removeItem(id, 99); removeItem(u.blueprint, 99);
      const noBp = canFitUpgrade(u); const nb = fitUpgrade(u); const nbNotice = notice && notice.text;
      h.give(u.blueprint, 1); const noLv = canFitUpgrade(u); const nl = fitUpgrade(u); const nlNotice = notice && notice.text;
      player.skills.crafting.xp = XP_TABLE[u.lv]; const noMat = canFitUpgrade(u); const nm = fitUpgrade(u); const nmNotice = notice && notice.text;
      render(); const greyed = buttons.some(b => b.label === 'disabled:Fit: ' + u.name) && !F.clickButton('Fit: ' + u.name);
      for (const [id, q] of u.needs) h.give(id, q);
      const before = Object.fromEntries(u.needs.map(([id]) => [id, countItem(id)])), x0 = player.skills.crafting.xp;
      render(); const clicked = F.clickButton('Fit: ' + u.name);
      const consumed = u.needs.every(([id, q]) => countItem(id) === before[id] - q) && countItem(u.blueprint) === 0;
      const ok = !noBp.ok && /blueprint/i.test(nbNotice || '') && nb === false && !noLv.ok && new RegExp(`Crafting level ${u.lv}`).test(nlNotice || '') && nl === false
        && !noMat.ok && /needs/.test(nmNotice || '') && nm === false && greyed && clicked && !!player.dozerUp[u.id] && consumed && player.skills.crafting.xp === x0 + u.xp;
      check(P + `fit the ${u.name.toLowerCase()} — refused without blueprint, level ${u.lv}, materials; fitted with them (${u.needs.map(([id, q]) => q + ' ' + id).join(' + ')})`, ok,
        { nb, nbNotice, nl, nlNotice, nm, nmNotice, greyed, clicked, fitted: player.dozerUp[u.id], consumed, xp: player.skills.crafting.xp - x0 });
    };
    for (const u of UPGRADES) fitOne(u);
    // the iron drill needs the drill first
    { player.dozerUp.irondrill = false; player.dozerUp.drill = false; h.give('blueprint_irondrill', 1); h.give('steel_bar', 6); h.give('coal', 4); player.skills.crafting.xp = XP_TABLE[20];
      const c = canFitUpgrade(upgradeById('irondrill')); const r = fitUpgrade(upgradeById('irondrill'));
      check(P + 'the iron drill refuses until the drill is fitted', !c.ok && /drill first/.test(c.why) && r === false && !player.dozerUp.irondrill, { why: c.why, r });
      removeItem('blueprint_irondrill', 99); removeItem('steel_bar', 6); removeItem('coal', 4); player.dozerUp.drill = true; player.dozerUp.irondrill = true; }
    closePanel();
    // 5. driving with the upgrades: a parked bulldozer on a clear grass lane in the open fields
    const o = h.openSpot(58, 50);
    const natural = [T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.DIRT, T.STUMP, T.RUBBLE, T.SAND, T.SOIL];
    for (let yy = o.y - 1; yy <= o.y + 1; yy++) for (let xx = o.x - 2; xx <= o.x + 12; xx++) if (natural.includes(tileAt(xx, yy))) changeTile(xx, yy, T.GRASS);
    regrow = regrow.filter(r => { const tx = r.i % MAP_W, ty = Math.floor(r.i / MAP_W); return !(ty >= o.y - 1 && ty <= o.y + 1 && tx >= o.x - 2 && tx <= o.x + 12); });
    for (const m of monsters) if (!m.dead && Math.abs(m.x - tc(o.x + 5)) < 9 * TILE && Math.abs(m.y - tc(o.y)) < 3 * TILE) { m.x = m.home.x; m.y = m.home.y; if (Math.abs(m.x - tc(o.x + 5)) < 9 * TILE && Math.abs(m.y - tc(o.y)) < 3 * TILE) { m.x = tc(o.x - 30); m.y = tc(o.y + 30); } }
    changeTile(o.x, o.y, T.DOZER);
    player.dozerUp = { drill: true, irondrill: false, ram: false, boiler: false };
    F.tp(o.x - 1, o.y); F.face(o.x, o.y); player.facing = { x: 1, y: 0 }; F.press('KeyE'); F.sim(2, []);
    const driving = () => !!(player.mech && player.mech.kind === 'dozer');
    const drive = (max, done) => { let n = 0; while (n < max && !done()) { F.step(['KeyD']); n++; } render(); return n < max ? n : 'timeout'; }; // drive east until done() (F.untilAction holds no keys)
    check(P + 'climb onto a bulldozer without the boiler: speed 130, hull 110', driving() && player.speed === 130 && player.mech.hp === 110 && player.mech.maxHp === 110, { mech: player.mech, speed: player.speed });
    if (driving()) {
      // drill: a rock two tiles ahead → stone in the pack, Mining xp 17, rubble left (it regrows into rock)
      const rx = o.x + 2; changeTile(rx, o.y, T.ROCK); const s0 = countItem('stone'), mx0 = player.skills.mining.xp;
      const r1 = drive(240, () => tileAt(rx, o.y) !== T.ROCK);
      const rubble = tileAt(rx, o.y) === T.RUBBLE, gotStone = countItem('stone') === s0 + 1, xp17 = player.skills.mining.xp === mx0 + 17, willRegrow = regrow.some(r => r.i === idx(rx, o.y) && r.t === T.ROCK);
      check(P + 'drill: driving into a rock gives +1 stone, +17 Mining xp, leaves rubble that regrows', typeof r1 === 'number' && rubble && gotStone && xp17 && willRegrow, { r1, tile: tileName(tileAt(rx, o.y)), stone: countItem('stone') - s0, xp: player.skills.mining.xp - mx0, willRegrow, px: +(player.x / TILE).toFixed(1) });
      // no iron drill yet: an iron rock stops the machine (solid, untouched); the iron drill mines it (+1 iron ore, +35 Mining xp)
      F.sim(40, ['KeyD']); // grind the rubble flat and roll on
      const ix = Math.floor(player.x / TILE) + 2; changeTile(ix, o.y, T.IRON); const px0 = player.x; dozerHintT = -1e9; // the hint throttles to one per 4 s; an earlier rock hint may still be inside that window
      F.sim(60, ['KeyD']); const stopped = tileAt(ix, o.y) === T.IRON && player.x < tc(ix) - TILE / 2 && !!notice && /iron drill/i.test(notice.text);
      player.dozerUp.irondrill = true; const io0 = countItem('iron_ore'), mx1 = player.skills.mining.xp;
      const r2 = drive(240, () => tileAt(ix, o.y) !== T.IRON);
      check(P + 'iron drill: an iron rock stops the plain drill (hint), then is mined (+1 iron ore, +35 Mining xp, rubble)', stopped && typeof r2 === 'number' && tileAt(ix, o.y) === T.RUBBLE && countItem('iron_ore') === io0 + 1 && player.skills.mining.xp === mx1 + 35, { stopped, r2, tile: tileName(tileAt(ix, o.y)), ore: countItem('iron_ore') - io0, xp: player.skills.mining.xp - mx1, moved: +(player.x - px0).toFixed(0), notice: notice && notice.text });
      F.sim(40, ['KeyD']);
      // coal too
      const cx = Math.floor(player.x / TILE) + 2; changeTile(cx, o.y, T.COAL); const c0 = countItem('coal'), mx2 = player.skills.mining.xp;
      const r3 = drive(240, () => tileAt(cx, o.y) !== T.COAL);
      check(P + 'iron drill: a coal rock is mined too (+1 coal, +50 Mining xp)', typeof r3 === 'number' && countItem('coal') === c0 + 1 && player.skills.mining.xp === mx2 + 50, { r3, coal: countItem('coal') - c0, xp: player.skills.mining.xp - mx2 });
      F.sim(40, ['KeyD']);
      // ram: with Math.random pinned, Space on a goblin hits X without the plate and exactly 2X with it, and shoves it 46 → ≥ 60 px; a rock goes rock → grass in one pass
      const gob = monsters.find(m => m.type === 'goblin'); const gs = { x: gob.x, y: gob.y, dead: gob.dead, hp: gob.hp, state: gob.state };
      const rnd = Math.random; Math.random = () => 0.5;
      const swing = () => { gob.dead = false; gob.hp = 999; gob.x = player.x + 44; gob.y = player.y; gob.stunT = 0; player.facing = { x: 1, y: 0 }; player.attackCd = 0; player.attackT = 0; const gx0 = gob.x; F.press('Space'); return { dmg: 999 - gob.hp, shove: gob.x - gx0 }; };
      player.dozerUp.ram = false; const a = swing(); F.sim(60, []);
      player.dozerUp.ram = true; const b = swing(); F.sim(60, []);
      Math.random = rnd;
      gob.x = gs.x; gob.y = gs.y; gob.dead = gs.dead; gob.hp = gs.hp; gob.state = gs.state; gob.stunT = 0; gob.angry = MONSTER_DEFS.goblin.aggro;
      check(P + 'ram plate: Space hits a goblin for exactly double and shoves it half again as far', a.dmg > 0 && b.dmg === a.dmg * 2 && a.shove >= 44 && a.shove < 60 && b.shove >= 60, { without: a, with: b });
      const qx = Math.floor(player.x / TILE) + 2; changeTile(qx, o.y, T.ROCK); const s1 = countItem('stone');
      const r4 = drive(240, () => tileAt(qx, o.y) !== T.ROCK);
      check(P + 'ram plate: rubble is ground flat in the same pass (rock → grass, stone still mined, still regrows)', typeof r4 === 'number' && tileAt(qx, o.y) === T.GRASS && countItem('stone') === s1 + 1 && regrow.some(r => r.i === idx(qx, o.y) && r.t === T.ROCK), { r4, tile: tileName(tileAt(qx, o.y)), stone: countItem('stone') - s1 });
      // boiler: climb down, fit, climb back on → speed 170, hull 180
      F.sim(20, []); F.press('KeyX'); F.sim(2, []);
      const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE); const parked = nearestTileOfType(ptx, pty, T.DOZER, 2);
      player.dozerUp.boiler = true;
      if (parked) { F.face(parked.tx, parked.ty); F.press('KeyE'); F.sim(2, []); }
      check(P + 'big boiler: climbing on gives speed 170 and hull 180/180 (HUD lists the fitted parts)', !!parked && driving() && player.speed === 170 && player.mech.hp === 180 && player.mech.maxHp === 180 && /bulldozer/i.test(notice ? notice.text : ''), { parked: parked && [parked.tx, parked.ty], mech: player.mech, speed: player.speed, notice: notice && notice.text });
      // saved with the knight: player.dozerUp round-trips through save/load
      { save(); const raw = JSON.parse(localStorage.getItem(SAVE_KEY)); check(P + 'upgrades are saved on the player (player.dozerUp)', !!raw.player.dozerUp && raw.player.dozerUp.drill === true && raw.player.dozerUp.boiler === true, { saved: raw.player.dozerUp }); }
      F.press('KeyX'); F.sim(2, []);
    }
    if (player.mech) { player.mech = null; player.r = 13; player.speed = 175; }
    player.inv = inv0; player.skills.crafting.xp = craft0; player.dozerUp = up0; h.peace(false);
  });
}
