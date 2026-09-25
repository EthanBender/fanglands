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

  // The wreck's panel: what the choice is in plain words, what stripping pays (the parts in a pouch, the exact range
  // and the Crafting xp), a primary Repair plate and the Strip plate, which asks twice and turns red when armed.
  const WRECK_TEXT = 'Put it back together and drive it, or break it down for parts. Nix the scrapper in Grubmarket trades parts for the machine plans you are missing.';
  function wreckGeom(g) {
    const K = PANEL_KIT, R = K.R(), G = K.GAP(), S = K.POUCH();
    const w = Math.min(VW - 20, 440), inner = w - 36, f = K.SENT(13), lh = K.lineH(f);
    const textH = K.linesOf(g, WRECK_TEXT, inner, f) * lh;
    return { K, R, G, S, w, inner, f, lh, textH, h: 62 + textH + 8 + 18 + S + 16 + 10 + R + G + R + 12 };
  }
  HOOKS.panel.salvage = (g, narrow) => {
    const at = panelArg || {};
    const t = tileAt(at.tx, at.ty), y0 = yieldFor(t);
    if (!y0) { closePanel(); return; }
    const Q = wreckGeom(g), { K, R, G, S } = Q;
    const { px, py, h } = panelBox(g, Q.w, Q.h, 'A wrecked machine', `A wrecked ${y0.name}.`);
    const x0 = px + 18; let y = py + 62;
    y += K.para(g, WRECK_TEXT, x0, y + 13, Q.inner, 99, { font: Q.f, color: HK.T.inkDim, id: 'wreck:text' }) + 8;
    y += K.head(g, x0, y, Q.inner, 'If you strip it');
    K.pouch(g, x0, y, S, 'machine_parts', y0.hi);
    const tx = x0 + S + 12, tw0 = Q.inner - S - 12;
    K.say(g, `${y0.lo} to ${y0.hi} machine parts`, tx, y + 17, tw0, { font: K.NAME(13), color: HK.T.ink, id: 'wreck:parts' });
    K.say(g, `and ${y0.xp} Crafting xp. Sometimes some goblin scrap too.`, tx, y + 36, tw0, { font: Q.f, color: HK.T.inkDim, id: 'wreck:xp' });
    const armed = confirmActive('strip');
    const by = py + h - 12 - R - G - R;
    K.plate(g, x0, by, Q.inner, R, 'Repair it and drive it', 'Repair it and drive it', () => { closePanel(); repairThrough(); }, 'primary', true);
    K.plate(g, x0, by + R + G, Q.inner, R, armed ? 'Really strip it? Tap again' : 'Strip it for parts', armed ? 'Really strip it? Tap again' : 'Strip it for parts', () => confirmTap('strip', () => { closePanel(); stripWreck(at.tx, at.ty); }), armed ? 'danger' : null, true);
  };
  // the panel audit's scene (PANEL_KIT, run from 63-house): a walker wreck, then with the Strip plate armed
  {
    let spot = null, was = null;
    const wreckAt = () => { for (let i = 0; i < map.length; i++) if (isWreck(map[i])) return { tx: i % MAP_W, ty: (i / MAP_W) | 0, made: false }; return null; };
    PANEL_KIT.scene({
      id: 'salvage', panel: 'salvage', name: 'A wrecked machine (as it opens, and with Strip armed)',
      setup() {
        spot = wreckAt();
        if (!spot) { spot = { tx: 60, ty: 26, made: true }; was = tileAt(60, 26); changeTile(60, 26, T.WRECK); }
        return () => { if (spot && spot.made) changeTile(spot.tx, spot.ty, was); spot = null; uxConfirm = null; };
      },
      variants: [
        { name: '', open: () => { uxConfirm = null; openPanel('salvage', { tx: spot.tx, ty: spot.ty }); } },
        { name: 'armed', open: () => { openPanel('salvage', { tx: spot.tx, ty: spot.ty }); uxConfirm = { label: 'strip', until: nowMs() + 60000 }; } },
      ],
    });
  }

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

  // Nix's panel: what the knight carries (parts and scrap, in pouches with exact counts), then one card per plan —
  // the blueprint in a pouch, its name, its exact price in parts, and Buy the plan (green), "Need n more" (greyed) or a
  // drawn tick and "You have it". Melting scrap into parts is the plate at the bottom.
  function nixGeom(g) {
    const K = PANEL_KIT, R = K.R(), G = K.GAP(), S = K.POUCH();
    const ids = Object.keys(PRICE).filter(id => ITEMS[id]);
    const bw = touchMode() ? 124 : 112, rowH = Math.max(S, R) + 16;
    // the plans stand in one column, or two side by side when the screen is too short for one (a phone on its side)
    const hOf = cols => 62 + 18 + S + 18 + 6 + 18 + Math.ceil(ids.length / cols) * (rowH + G) + R + 12;
    const cols = hOf(1) > VH - 20 && VW - 20 >= 720 ? 2 : 1;
    const w = Math.min(VW - 20, cols === 2 ? 760 : 500), inner = w - 36, colW = (inner - (cols - 1) * 16) / cols;
    return { K, R, G, S, ids, w, inner, bw, rowH, cols, colW, h: hOf(cols) };
  }
  HOOKS.panel.nix_parts = (g, narrow) => {
    const parts = countItem('machine_parts'), scrap = countItem('goblin_scrap');
    const Q = nixGeom(g), { K, R, G, S } = Q;
    const { px, py, h } = panelBox(g, Q.w, Q.h, 'Nix the scrapper', 'Plans for machine parts. You never had these from me.');
    const x0 = px + 18; let y = py + 62;
    y += K.head(g, x0, y, Q.inner, 'You carry');
    const half = (Q.inner - G) / 2;
    K.pouch(g, x0, y, S, 'machine_parts', parts || 0);
    K.say(g, `${parts} machine parts`, x0 + S + 8, y + S / 2 + 5, half - S - 8, { font: K.NAME(12), color: HK.T.ink, id: 'nix:have' });
    K.pouch(g, x0 + half + G, y, S, 'goblin_scrap', scrap || 0);
    K.say(g, `${scrap} goblin scrap`, x0 + half + G + S + 8, y + S / 2 + 5, half - S - 8, { font: K.NAME(12), color: HK.T.ink, id: 'nix:have' });
    y += S + 18 + 6;
    y += K.head(g, x0, y, Q.inner, 'Plans');
    const top = y;
    Q.ids.forEach((id, n) => {
      const cost = PRICE[id], have = hasBP(id), can = !have && parts >= cost;
      const cx = x0 + (n % Q.cols) * (Q.colW + 16), y = top + Math.floor(n / Q.cols) * (Q.rowH + G);
      K.card(g, cx, y, Q.colW, Q.rowH, can ? HK.T.gold : null);
      K.pouch(g, cx + 10, y + 8, S, id, 1);
      const tx = cx + 10 + S + 12, tw0 = Q.colW - 10 - S - 12 - Q.bw - 22;
      K.say(g, bpName(id).replace(/^Blueprint: /, ''), tx, y + Q.rowH / 2 - 3, tw0, { font: K.NAME(13), color: have ? HK.T.good : HK.T.ink, id: 'nix:name' });
      K.say(g, `${cost} machine parts`, tx, y + Q.rowH / 2 + 15, tw0, { font: K.NAME(11), color: can ? HK.T.goldHi : HK.T.inkDim, id: 'nix:price' });
      const bx = cx + Q.colW - 10 - Q.bw, by = y + (Q.rowH - R) / 2;
      if (have) K.mark(g, true, bx + 8, by + R / 2 + 5, 'You have it', { w: Q.bw - 26 });
      else K.plate(g, bx, by, Q.bw, R, can ? 'Buy the plan' : `Need ${cost - parts} more`, can ? 'Buy the plan' : `Need ${cost - parts} more`, () => {
        if (countItem('machine_parts') < cost || hasBP(id)) return;
        removeItem('machine_parts', cost); giveOrDrop(id, 1, player.x, player.y);
        nixState().bought++; sfx('coin'); burst(player.x, player.y, '#3b6fb6', 14, 80);
        floatText(player.x, player.y - 34, bpName(id), '#3b6fb6', 14);
        say('Take it. Burn it when you are done. And if anyone asks, you found it in the yard.', 'Nix the scrapper');
        save();
      }, can ? 'primary' : null, can, { name: 'Buy the ' + bpName(id).toLowerCase() });
    });
    const canMelt = scrap >= SCRAP_PER_PART;
    const melt = canMelt ? `Melt ${SCRAP_PER_PART} goblin scrap into 1 machine part` : `Melting needs ${SCRAP_PER_PART} goblin scrap`;
    K.plate(g, x0, py + h - 12 - R, Q.inner, R, melt, melt, () => {
      if (countItem('goblin_scrap') < SCRAP_PER_PART || !canFit('machine_parts', 1)) return;
      removeItem('goblin_scrap', SCRAP_PER_PART); giveOrDrop('machine_parts', 1, player.x, player.y);
      nixState().melted++; gainXp('crafting', 12); sfx('ui'); save();
    }, null, canMelt);
  };
  // the panel audit's scene (PANEL_KIT, run from 63-house): 20 parts and 7 scrap, the drill plan already held
  PANEL_KIT.scene({
    id: 'nix', panel: 'nix_parts', name: 'Nix the scrapper (20 parts, 7 scrap, one plan held, one affordable)',
    setup() {
      const inv = player.inv.map(s => (s ? { ...s } : null)), bank = player.bank.map(s => ({ ...s })), up0 = player.dozerUp ? { ...player.dozerUp } : null;
      player.inv = new Array(INV_SLOTS).fill(null); addItem('machine_parts', 20); addItem('goblin_scrap', 7); addItem('blueprint_drill', 1);
      player.dozerUp = { drill: false, irondrill: false, ram: false, boiler: false };
      return () => { player.inv = inv; player.bank = bank; player.dozerUp = up0; };
    },
    variants: [{ name: '', open: () => openPanel('nix_parts') }],
  });

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
