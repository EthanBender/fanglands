// ============================================================================
// SALVAGE AND THE SCRAPPER — a way to earn a blueprint instead of praying for one
// Owner's own words, playing it: "The blueprint system is really hard to advance in because you have to get
// the drop and there's not a lot of them to kill. I'm wondering if the wrecked dozer, for example, you could
// mine them, destroy them for components, and then trade those components to a goblin traitor in the city to
// buy specific blueprints — kind of like drop protection."
// So: every wreck can now be STRIPPED instead of repaired, which pays machine parts. Nix the scrapper in
// Grubmarket (33-goblincity — "Scrap. I buy it, I sort it, I sit on it") sells any blueprint for a fixed price
// in parts, quietly, behind his own side's back. The random drops in 40-dozerup are untouched: this is the
// floor under them, so a run of bad luck costs time instead of stopping the player dead.
// Feature file: registers through HOOKS only, edits no core file. window.SALVAGE exposes the tables.
// ============================================================================
{
  // ---------- the component ----------
  Object.assign(ITEMS, {
    machine_parts: { name: 'Machine parts', value: 25, color: '#8a8f98', shape: 'scrap', stack: 50 },
  });
  ITEMS.machine_parts.id = 'machine_parts';

  const WRECK_NAMES = ['WRECK', 'DOZER_WRECK', 'BEAST_WRECK'];
  const wreckIds = () => WRECK_NAMES.filter(n => n in T).map(n => T[n]);
  const isWreck = t => wreckIds().includes(t);
  // what a hull is worth in parts, and what it is called while you strip it
  const YIELD = {
    WRECK: { lo: 5, hi: 8, xp: 90, name: 'goblin walker' },
    DOZER_WRECK: { lo: 4, hi: 7, xp: 75, name: 'goblin bulldozer' },
    BEAST_WRECK: { lo: 10, hi: 14, xp: 220, name: 'Barrelbeast' },
  };
  const yieldFor = t => { for (const n of WRECK_NAMES) if (n in T && T[n] === t) return { ...YIELD[n], tile: n }; return null; };

  // ---------- E on a wreck asks what you want to do with it ----------
  // The core repairs a T.WRECK the moment you press E (06-systems), before HOOKS.use ever sees the tile, so the
  // choice has to sit in front of that. `bypass` lets the Repair button fall back through the same chain.
  let bypass = false;
  const _useAction = useAction;
  useAction = function () {
    if (!bypass && !player.dead && !player.mech && !npcInFront()) {
      const here = { tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) };
      const front = frontTile(player);
      const at = isWreck(tileAt(front.tx, front.ty)) ? front : isWreck(tileAt(here.tx, here.ty)) ? { tx: here.tx, ty: here.ty } : null;
      if (at) { openPanel('salvage', { tx: at.tx, ty: at.ty }); return; }
    }
    return _useAction.apply(this, arguments);
  };
  const repairThrough = () => { bypass = true; try { useAction(); } finally { bypass = false; } };

  function stripWreck(tx, ty) {
    const y = yieldFor(tileAt(tx, ty)); if (!y) return;
    const n = rint(y.lo, y.hi);
    changeTile(tx, ty, T.GRASS);
    giveOrDrop('machine_parts', n, player.x, player.y);
    if (Math.random() < 0.5) giveOrDrop('goblin_scrap', rint(1, 3), player.x, player.y);
    gainXp('crafting', y.xp);
    burst(tc(tx), tc(ty), '#8a8f98', 16, 90); sfx('mine');
    floatText(player.x, player.y - 34, `+${n} machine parts`, '#c9d1d9', 14);
    notify(`You strip the ${y.name} down to its bones. Nix in Grubmarket buys parts like these, and sells plans.`);
    save();
  }

  HOOKS.panel.salvage = (g, narrow) => {
    const at = panelArg || {};
    const t = tileAt(at.tx, at.ty), y = yieldFor(t);
    if (!y) { closePanel(); return; }
    const { px, py, w } = panelBox(g, narrow ? 320 : 400, 210, 'A wrecked machine', `${y.name} · ${y.lo}-${y.hi} machine parts if you strip it`);
    g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.textAlign = 'left';
    wrapText(g, 'Put it back together and drive it, or break it down for parts. Nix the scrapper in Grubmarket trades parts for the machine plans you are missing.', px + 18, py + 62, w - 36, 16);
    button(g, px + 18, py + 118, w - 36, 34, 'Repair it and drive it', () => { closePanel(); repairThrough(); });
    const armed = confirmActive('strip');
    button(g, px + 18, py + 158, w - 36, 34, armed ? 'Really strip it? Tap again' : 'Strip it for parts', () => confirmTap('strip', () => { closePanel(); stripWreck(at.tx, at.ty); }), armed ? '#c0392b' : '#8b2e2e');
  };

  // ---------- Nix sells plans, quietly ----------
  const PRICE = { blueprint_drill: 12, blueprint_ram: 16, blueprint_irondrill: 24, blueprint_boiler: 32 };
  const SCRAP_PER_PART = 5;
  const hasBP = id => (window.DOZERUP ? DOZERUP.hasBlueprint(id) : countItem(id) > 0);
  const bpName = id => (ITEMS[id] ? ITEMS[id].name : id);
  const nixState = () => { if (!quest.salvage) quest.salvage = { bought: 0, melted: 0, met: false }; return quest.salvage; };
  HOOKS.newGame.push(() => { quest.salvage = { bought: 0, melted: 0, met: false }; });

  const prevNix = HOOKS.talkBefore.nix;
  HOOKS.talkBefore.nix = n => {
    if (prevNix && prevNix(n)) return true;
    const s = nixState();
    if (!s.met) { s.met = true; say('Plans? I did not say plans. I said scrap. But a knight who brings me parts and does not ask questions... we can talk. Quietly.', n.name); save(); }
    openPanel('nix_parts');
    return true;
  };

  HOOKS.panel.nix_parts = (g, narrow) => {
    const parts = countItem('machine_parts'), scrap = countItem('goblin_scrap');
    const ids = Object.keys(PRICE).filter(id => ITEMS[id]);
    const { px, py, w } = panelBox(g, narrow ? 340 : 470, 150 + ids.length * 40, 'Nix the scrapper', `${parts} machine parts · ${scrap} goblin scrap · you never had these from me`);
    let y = py + 58;
    for (const id of ids) {
      const cost = PRICE[id], have = hasBP(id), can = !have && parts >= cost;
      g.fillStyle = have ? '#3fb950' : can ? '#e6edf3' : '#6e7681'; g.font = '12px sans-serif'; g.textAlign = 'left';
      drawItemIcon(g, id, px + 26, y + 16, 14);
      g.fillText(`${bpName(id)} — ${cost} parts`, px + 44, y + 20);
      if (have) { g.fillStyle = '#3fb950'; g.textAlign = 'right'; g.fillText('you have it', px + w - 22, y + 20); g.textAlign = 'left'; }
      else button(g, px + w - 132, y, 110, 30, can ? 'Buy the plan' : `Need ${cost - parts} more`, () => {
        if (countItem('machine_parts') < cost || hasBP(id)) return;
        removeItem('machine_parts', cost); giveOrDrop(id, 1, player.x, player.y);
        nixState().bought++; sfx('coin'); burst(player.x, player.y, '#3b6fb6', 14, 80);
        floatText(player.x, player.y - 34, bpName(id), '#3b6fb6', 14);
        say('Take it. Burn it when you are done. And if anyone asks, you found it in the yard.', 'Nix the scrapper');
        save();
      }, can ? '#1f6feb' : '#21262d', can);
      y += 40;
    }
    const canMelt = scrap >= SCRAP_PER_PART;
    button(g, px + 18, y + 6, w - 36, 32, canMelt ? `Melt ${SCRAP_PER_PART} goblin scrap into 1 machine part` : `Melting needs ${SCRAP_PER_PART} goblin scrap`, () => {
      if (countItem('goblin_scrap') < SCRAP_PER_PART || !canFit('machine_parts', 1)) return;
      removeItem('goblin_scrap', SCRAP_PER_PART); giveOrDrop('machine_parts', 1, player.x, player.y);
      nixState().melted++; gainXp('crafting', 12); sfx('ui'); save();
    }, canMelt ? '#21262d' : '#161b22', canMelt);
  };

  // the audit's progression table should know parts are a Crafting source
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    add('crafting', 'strip a wrecked machine for parts', 1, 90, 6, 'a walker wreck; the Barrelbeast pays 220');
  });

  window.SALVAGE = { YIELD, PRICE, SCRAP_PER_PART, yieldFor, stripWreck, isWreck, wreckIds, state: nixState };

  // ---------- self-test ----------
  const P = 'salvage: ';
  HOOKS.selfTest.push((check, F, h) => {
    // E on a wreck offers the choice instead of repairing on the spot
    { const o = h.openSpot(60, 26); F.tp(o.x, o.y);
      const tx = Math.floor(player.x / TILE) + 1, ty = Math.floor(player.y / TILE), was = tileAt(tx, ty);
      changeTile(tx, ty, T.WRECK); F.face(tx, ty); closePanel();
      F.press('KeyE'); F.sim(2, []);
      const asked = panel === 'salvage' && tileAt(tx, ty) === T.WRECK;
      render(); const hasBoth = !!F.findButton && true;
      const strip = buttons.some(b => /Strip it for parts/.test(b.label || '')), repair = buttons.some(b => /Repair it/.test(b.label || ''));
      closePanel(); changeTile(tx, ty, was);
      check(P + 'E on a wreck asks whether to repair it or strip it, and does neither until you choose', asked && strip && repair, { asked, strip, repair, panel }); }
    // stripping pays parts and Crafting xp and clears the tile
    { const o = h.openSpot(62, 28); F.tp(o.x, o.y);
      const tx = Math.floor(player.x / TILE) + 1, ty = Math.floor(player.y / TILE), was = tileAt(tx, ty);
      const bag = player.inv.slice(); player.inv = player.inv.map(() => null);
      changeTile(tx, ty, T.WRECK);
      const x0 = player.skills.crafting.xp;
      SALVAGE.stripWreck(tx, ty);
      const got = countItem('machine_parts'), xp = player.skills.crafting.xp - x0, cleared = tileAt(tx, ty) === T.GRASS;
      player.inv = bag; changeTile(tx, ty, was); player.skills.crafting.xp = x0;
      check(P + 'stripping a walker wreck pays 5-8 machine parts and 90 Crafting xp, and the wreck is gone', got >= 5 && got <= 8 && xp === 90 && cleared, { got, xp, cleared }); }
    // Nix sells a specific blueprint for a fixed price — the deterministic floor under the random drops
    { const bag = player.inv.slice(), s0 = quest.salvage ? { ...quest.salvage } : null;
      player.inv = player.inv.map(() => null);
      const id = 'blueprint_drill', cost = SALVAGE.PRICE[id];
      h.give('machine_parts', cost);
      closePanel(); openPanel('nix_parts'); render();
      const priced = buttons.some(b => /Buy the plan/.test(b.label || ''));
      const b = buttons.find(x => /Buy the plan/.test(x.label || '')); if (b) b.action();
      const bought = countItem(id) === 1 && countItem('machine_parts') === 0;
      // and it refuses when the parts are not there
      const b2 = buttons.find(x => /Need \d+ more/.test(x.label || ''));
      closePanel(); player.inv = bag; if (s0) quest.salvage = s0;
      check(P + 'Nix sells a named blueprint for a fixed price in parts, and names the shortfall when you cannot pay', priced && bought && !!b2, { priced, bought, shortfallShown: !!b2, cost }); }
    // goblin scrap melts down, so the plentiful drop always feeds the path
    { const bag = player.inv.slice(); player.inv = player.inv.map(() => null);
      h.give('goblin_scrap', SALVAGE.SCRAP_PER_PART);
      closePanel(); openPanel('nix_parts'); render();
      const melt = buttons.find(x => /Melt \d+ goblin scrap/.test(x.label || '')); if (melt) melt.action();
      const made = countItem('machine_parts') === 1 && countItem('goblin_scrap') === 0;
      closePanel(); player.inv = bag;
      check(P + `${SALVAGE.SCRAP_PER_PART} goblin scrap melt into a machine part, so a knight with no wrecks still has a road`, !!melt && made, { made }); }
    // every blueprint has a price, so no upgrade is drop-only any more
    { const ups = window.DOZERUP ? DOZERUP.BLUEPRINTS : [];
      const priced = ups.filter(id => SALVAGE.PRICE[id] > 0);
      check(P + 'every dozer blueprint can be bought outright, so none of them is drop-only', ups.length > 0 && priced.length === ups.length, { blueprints: ups.length, priced: priced.length }); }
  });
}
