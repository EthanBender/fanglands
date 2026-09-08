// ============================================================================
// PROGRESSION — the dead bands the playthrough audit found, closed with real things to do
// src/42-playthrough.js measured every skill gate against the best XP source below it. Four skills came out wrong:
//   Farming   7,491 h to level 99 (one crop, potatoes, for the whole game)
//   Defence   1,328 h (the only source is being hit)
//   Crafting    573 h (Cohen's own complaint: "Crafting XP is hard to get")
//   Fishing   nothing new between level 5 and level 25; Agility nothing between 1 and 30
// Nothing here multiplies an existing number. Every line is a new thing in the world: crops that need a
// higher Farming level and feed better food, fish that live in the river and the deep sea, poultices and a
// scale cloak to craft, and the knowledge a knight picks up from a hard kill (Defence).
// Feature file: registers through HOOKS only, edits no core file. window.PROGRESSION exposes the tables.
// ============================================================================
{
  // ---------- items ----------
  Object.assign(ITEMS, {
    // crops. `seed` is read by the core's plantSeed; `seedLv` is this file's gate; `farmXp` is per unit harvested
    herb_seed: { name: 'Herb seed', value: 8, color: '#6fae5a', shape: 'seed', seed: 'herbs', seedLv: 15 },
    herbs: { name: 'Herbs', value: 22, color: '#5ea55a', shape: 'seed', farmXp: 45, heal: 3 },
    goldenwheat_seed: { name: 'Golden wheat seed', value: 30, color: '#e8c85a', shape: 'seed', seed: 'golden_wheat', seedLv: 35 },
    golden_wheat: { name: 'Golden wheat', value: 70, color: '#f0d060', shape: 'seed', farmXp: 120 },
    dragonfruit_seed: { name: 'Dragonfruit seed', value: 90, color: '#d4553a', shape: 'seed', seed: 'dragonfruit', seedLv: 55 },
    dragonfruit: { name: 'Dragonfruit', value: 180, color: '#e05a3a', shape: 'potato', farmXp: 300, heal: 22 },
    // fish. `cookXp` is this file's per-fish Cooking xp (the core pays a flat 30 for everything)
    raw_pike: { name: 'Raw pike', value: 16, color: '#7f9a6a', shape: 'fish', cook: 'pike' },
    pike: { name: 'Pike', value: 34, color: '#8fae7a', shape: 'fish', heal: 10, cookXp: 55 },
    raw_salmon: { name: 'Raw salmon', value: 26, color: '#d98a6a', shape: 'fish', cook: 'salmon' },
    salmon: { name: 'Salmon', value: 55, color: '#e89a7a', shape: 'fish', heal: 13, cookXp: 80 },
    raw_swordfish: { name: 'Raw swordfish', value: 60, color: '#8aa8c0', shape: 'fish', cook: 'swordfish' },
    swordfish: { name: 'Swordfish', value: 120, color: '#9ab8d0', shape: 'fish', heal: 19, cookXp: 170 },
    raw_shark: { name: 'Raw shark', value: 140, color: '#6a7a8a', shape: 'fish', cook: 'shark' },
    shark: { name: 'Shark', value: 280, color: '#7a8a9a', shape: 'fish', heal: 28, cookXp: 320 },
    // crafted
    herb_poultice: { name: 'Herb poultice', value: 60, color: '#7ec97a', shape: 'powder', heal: 16 },
    greater_poultice: { name: 'Greater poultice', value: 260, color: '#4fbf6a', shape: 'powder', heal: 45 },
    scale_cloak: { name: 'Scale cloak', value: 900, color: '#4a7a5a', shape: 'cape', stack: 1, armour: { slot: EQUIP_SLOTS.includes('cape') ? 'cape' : 'body', def: 12 } },
    golden_bread: { name: 'Golden loaf', value: 90, color: '#f0d878', shape: 'bread', heal: 24 },
    obsidian_blade: { name: 'Obsidian blade', value: 1400, color: '#2f2a3a', shape: 'sword', stack: 1, weapon: { att: 30, maxHit: 17 } },
    obsidian_helm: { name: 'Obsidian helm', value: 800, color: '#332d3f', shape: 'helm', stack: 1, armour: { slot: 'head', def: 26 } },
  });
  for (const id of ['herb_seed', 'herbs', 'goldenwheat_seed', 'golden_wheat', 'dragonfruit_seed', 'dragonfruit', 'raw_pike', 'pike', 'raw_salmon', 'salmon',
    'raw_swordfish', 'swordfish', 'raw_shark', 'shark', 'herb_poultice', 'greater_poultice', 'scale_cloak', 'golden_bread', 'obsidian_blade', 'obsidian_helm']) {
    ITEMS[id].id = id; if (ITEMS[id].stack === undefined) ITEMS[id].stack = 50;
  }

  // ---------- Greta sells the seeds; Salt Pete sells the deep-sea bait ----------
  if (SHOPS.seeds) SHOPS.seeds.stock.push(['herb_seed', 8], ['goldenwheat_seed', 30], ['dragonfruit_seed', 90]);

  // ---------- farming: a seed needs its level; a crop pays its own xp ----------
  const seedLv = id => (ITEMS[id] && ITEMS[id].seedLv) || 1;
  const _plantSeed = plantSeed;
  plantSeed = function (tx, ty) {
    // the core plants the first seed in the pack; refuse the ones the knight is not farmer enough for, and say so
    const slots = player.inv.map((s, i) => (s && ITEMS[s.id].seed ? i : -1)).filter(i => i >= 0);
    if (!slots.length) return _plantSeed(tx, ty);
    const lv = skillLv('farming'), ok = slots.filter(i => seedLv(player.inv[i].id) <= lv);
    if (!ok.length) { const best = slots.map(i => ITEMS[player.inv[i].id]).sort((a, b) => a.seedLv - b.seedLv)[0]; notify(`${best.name} needs Farming ${best.seedLv}. You are ${lv}.`); return; }
    // put the best seed the knight can plant in the first seed slot, plant it, then put the pack back as it was
    const first = slots[0], pick = ok.sort((a, b) => seedLv(player.inv[b].id) - seedLv(player.inv[a].id))[0];
    const a = player.inv[first], b = player.inv[pick]; player.inv[first] = b; player.inv[pick] = a;
    _plantSeed(tx, ty);
    const na = player.inv[first], nb = player.inv[pick]; player.inv[first] = nb; player.inv[pick] = na;
  };
  const _harvest = harvest;
  harvest = function (tx, ty) {
    const c = crops.find(c => c.i === idx(tx, ty)); const grown = c && c.stage >= 3;
    const cropId = grown ? (c.crop && ITEMS[c.crop] ? c.crop : 'potato') : null;
    const before = grown ? countItem(cropId) : 0, xp0 = player.skills.farming.xp;
    _harvest(tx, ty);
    if (!grown) return;
    const extra = ITEMS[cropId] && ITEMS[cropId].farmXp; if (!extra) return;
    const n = Math.max(1, Math.round((player.skills.farming.xp - xp0) / 15)); // the core paid 15 a unit: top it up to the crop's own rate
    gainXp('farming', (extra - 15) * n);
    floatText(player.x, player.y - 46, `${ITEMS[cropId].name} +${(extra - 15) * n + 15 * n} Farming`, '#7ee787', 12);
  };

  // ---------- fishing: what swims where ----------
  // the pond is Miller's Pond, the deep is the Grey Sea, everything else the river the world blend cut from the pond to the sea
  const waterKind = (tx, ty) => { const r = regionAt(tx, ty); return r && /Grey Sea|Gull|Ironclad/.test(r.name) ? 'sea' : r && /Miller/.test(r.name) ? 'pond' : 'river'; };
  const CATCH = [ // best first: the first one the knight is high enough for and that lives here
    { id: 'raw_shark', lv: 60, xp: 350, where: 'sea', name: 'shark' },
    { id: 'raw_swordfish', lv: 40, xp: 180, where: 'sea', name: 'swordfish' },
    { id: 'raw_salmon', lv: 20, xp: 75, where: 'river', name: 'salmon' },
    { id: 'raw_pike', lv: 12, xp: 55, where: 'river', name: 'pike' },
  ];
  const _finishFishing = finishFishing;
  finishFishing = function () {
    const a = player.action; if (!a || a.type !== 'fish') return _finishFishing();
    const lv = skillLv('fishing'), kind = waterKind(a.tx, a.ty);
    const big = CATCH.find(c => lv >= c.lv && c.where === kind && Math.random() < 0.55);
    if (!big) return _finishFishing();
    const chance = Math.min(0.9, 0.45 + lv * 0.02);
    player.action = { ...a, t: 0 };
    if (Math.random() > chance) return;
    giveOrDrop(big.id, 1, player.x, player.y); gainXp('fishing', big.xp); sfx('fish'); // as the core does: a full pack drops the fish at your feet, the xp still counts
    burst(tc(a.tx), tc(a.ty), '#bfe3ff', 10, 60);
  };
  // cooking pays what the fish is worth, not a flat 30
  const _finishCook = finishCook;
  finishCook = function () {
    const raw = player.action && player.action.raw; const out = raw && ITEMS[raw] && ITEMS[raw].cook;
    const xp0 = player.skills.cooking.xp, had = out ? countItem(out) : 0;
    _finishCook();
    if (!out || !ITEMS[out].cookXp) return;
    if (countItem(out) > had && player.skills.cooking.xp > xp0) gainXp('cooking', ITEMS[out].cookXp - 30); // it cooked (not burnt): top the flat 30 up to this fish's rate
  };

  // ---------- defence: what a hard kill teaches ----------
  // 30-ashdrake pays melee/range a level x 10 bonus on a level-10+ kill. Defence had nothing but being hit.
  const DEF_KILL_MIN = 10, DEF_KILL_PER = 4;
  HOOKS.kill.push(m => {
    const def = MONSTER_DEFS[m.type]; if (!def || (def.level | 0) < DEF_KILL_MIN || window.__companionHit) return;
    const xp = def.level * DEF_KILL_PER;
    // same rule as 30-ashdrake's melee bonus: a boss kill's own banner (DUNGEON CLEARED, THE FANG IS SLAIN) was set
    // by an earlier kill hook, so a Defence level-up in the same tick is announced beside the knight instead
    const banner = levelBanner;
    gainXp('defence', xp);
    if (banner && banner.t > 0 && banner.sub !== 'Level up' && levelBanner !== banner) { levelBanner = banner; floatText(player.x, player.y - 72, `Defence level ${skillLv('defence')}!`, '#ffd166', 14); }
    floatText(m.x, m.y - m.r - 36, `+${xp} Defence xp`, '#58a6ff', 13);
  });

  // ---------- crafting and cooking: things worth making ----------
  RECIPES.push(
    { out: 'herb_poultice', qty: 1, needs: [['herbs', 3], ['spider_silk', 1]], station: 'workbench', skill: 'crafting', lv: 12, xp: 90, label: '3 Herbs + Spider silk → Herb poultice' },
    { out: 'scale_cloak', qty: 1, needs: [['dragon_scale', 2], ['spider_silk', 4]], station: 'workbench', skill: 'crafting', lv: 30, xp: 320, label: '2 Dragon scales + 4 Spider silk → Scale cloak' },
    { out: 'greater_poultice', qty: 1, needs: [['dragonfruit', 1], ['herbs', 4], ['spider_silk', 2]], station: 'workbench', skill: 'crafting', lv: 45, xp: 600, label: 'Dragonfruit + 4 Herbs + 2 Silk → Greater poultice' },
  );
  if (ITEMS.obsidian && ITEMS.mithril_bar) RECIPES.push(
    { out: 'obsidian_blade', qty: 1, needs: [['obsidian', 2], ['mithril_bar', 2]], station: 'anvil', skill: 'smithing', lv: 45, xp: 900, label: '2 Obsidian + 2 Mithril bars → Obsidian blade' },
    { out: 'obsidian_helm', qty: 1, needs: [['obsidian', 2], ['mithril_bar', 1]], station: 'anvil', skill: 'smithing', lv: 42, xp: 620, label: '2 Obsidian + Mithril bar → Obsidian helm' },
  );
  if (RECIPES.some(r => r.station === 'oven')) RECIPES.push({ out: 'golden_bread', qty: 1, needs: [['golden_wheat', 2], ['flour', 1]], station: 'oven', skill: 'cooking', lv: 20, xp: 200, label: '2 Golden wheat + Flour → Golden loaf' });

  // ---------- tell the audit what was added (42-playthrough reads HOOKS.xpSource) ----------
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    add('farming', 'a herb crop (till, plant, 3 stages, harvest 2-4)', 15, 5 + 8 + 45 * 3, 120, 'per plot; plots run in parallel');
    add('farming', 'a golden wheat crop', 35, 5 + 8 + 120 * 3, 120, 'per plot; Greta sells the seed at 30');
    add('farming', 'a dragonfruit crop', 55, 5 + 8 + 300 * 3, 120, 'per plot; Greta sells the seed at 90');
    add('fishing', 'pike (river)', 12, 55, 4.0, 'the river the world blend cut from the pond to the sea');
    add('fishing', 'salmon (river)', 20, 75, 4.0, 'the river');
    add('fishing', 'swordfish (deep sea)', 40, 180, 4.0, 'the Grey Sea, from the dock or an island');
    add('fishing', 'shark (deep sea)', 60, 350, 4.0, 'the Grey Sea');
    add('cooking', 'cook a pike', 12, 55, 1.2, 'a fire or a range'); add('cooking', 'cook a salmon', 20, 80, 1.2, '');
    add('cooking', 'cook a swordfish', 40, 170, 1.2, ''); add('cooking', 'cook a shark', 60, 320, 1.2, '');
    for (const c of CROSSINGS) add('agility', `river crossing (${c.width === 1 ? 'narrow' : c.width + ' tiles'}) at ${c.a.x},${c.a.y}`, c.lv, c.xp, 6, 'a shortcut across the river; the post on either bank');
    add('smithing', '2 Obsidian + 2 Mithril bars → Obsidian blade', 45, 900, 24, 'anvil; obsidian at gather rates');
    add('defence', 'a level 10+ kill (level x 4)', 1, 10 * DEF_KILL_PER, 12, 'a brute at the level it opens; scales with the monster');
    add('defence', 'a dragon kill (level x 4)', 1, 45 * DEF_KILL_PER, 30, 'a green dragon');
  });

  // ---------- agility: crossings on the river (nothing between level 1 and the cliff course at 30) ----------
  // A post on each bank, never a water tile: the world blend's river and its bridges are untouched. E on a post
  // with the Agility it asks for leaps the knight to the far post — a real shortcut across the river, and a lap's xp.
  const CROSS = addTile('RIVER_POST', { solid: true, tex: 'grass', mini: '#9a7a4a' });
  const CROSSINGS = []; // { a: {x,y}, b: {x,y}, lv, xp, width }
  const CROSS_TIERS = [{ lv: 12, xp: 90 }, { lv: 22, xp: 160 }, { lv: 35, xp: 260 }];
  HOOKS.world.push((rnd, api) => {
    CROSSINGS.length = 0;
    const water = t => t === T.WATER, land = t => t === T.GRASS || t === T.DIRT || t === T.SAND;
    const near = (x, y, r, pred) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (pred(api.tileAt(x + dx, y + dy))) return true; return false; };
    const cands = [], BRIDGE = ('BRIDGE' in T ? T.BRIDGE : -1), DOCK = ('DOCK' in T ? T.DOCK : -1);
    // scan the river band (the sea starts about x 150) for a west-to-east span of water 1-3 wide with dry land on both banks
    for (let y = 20; y < 140; y++) {
      for (let x = 20; x < 148; x++) {
        if (!water(api.tileAt(x, y)) || !land(api.tileAt(x - 1, y)) || water(api.tileAt(x - 2, y))) continue;
        let w = 0; while (w < 4 && water(api.tileAt(x + w, y))) w++;
        if (w < 1 || w > 3 || !land(api.tileAt(x + w, y)) || water(api.tileAt(x + w + 1, y))) continue;
        if (near(x, y, 6, t => t === BRIDGE || t === DOCK || t === T.COBBLE)) continue;   // clear of a bridge, a dock and any road
        if (near(x - 1, y, 1, t => SOLID.has(t) && t !== T.WATER) || near(x + w, y, 1, t => SOLID.has(t) && t !== T.WATER)) continue; // both banks stay walkable
        cands.push({ x, y, w });
      }
    }
    // three crossings, narrowest first, each at least 12 tiles from the ones already taken
    cands.sort((p, q) => p.w - q.w || p.x - q.x);
    const taken = [];
    for (const c of cands) { if (taken.length >= CROSS_TIERS.length) break; if (taken.some(t => Math.hypot(t.x - c.x, t.y - c.y) < 12)) continue; taken.push(c); }
    taken.sort((p, q) => p.w - q.w);
    for (let i = 0; i < CROSS_TIERS.length && i < taken.length; i++) {
      const c = taken[i], t = CROSS_TIERS[i];
      const a = { x: c.x - 1, y: c.y }, b = { x: c.x + c.w, y: c.y };
      api.setTile(a.x, a.y, CROSS); api.setTile(b.x, b.y, CROSS);
      CROSSINGS.push({ a, b, lv: t.lv, xp: t.xp, width: c.w });
    }
  });
  const crossingAt = (tx, ty) => { for (const c of CROSSINGS) { if (c.a.x === tx && c.a.y === ty) return { c, from: 'a' }; if (c.b.x === tx && c.b.y === ty) return { c, from: 'b' }; } return null; };
  if (typeof INTERESTING_TILES !== 'undefined') INTERESTING_TILES.add(CROSS); // so a tap on the iPad walks to it and uses it
  HOOKS.use.push((t, tx, ty) => {
    if (t !== CROSS) return false;
    const hit = crossingAt(tx, ty); if (!hit) return false;
    const { c, from } = hit, lv = skillLv('agility');
    if (lv < c.lv) { notify(`A crossing post. Leaping the river here needs Agility ${c.lv}. You are ${lv}.`); return true; }
    const to = from === 'a' ? c.b : c.a;
    player.x = tc(to.x + (from === 'a' ? 1 : -1)); player.y = tc(to.y); // land on the dry tile beyond the far post
    gainXp('agility', c.xp); sfx('ui');
    floatText(player.x, player.y - 34, `Across! +${c.xp} Agility xp`, '#7ee787', 15);
    burst(player.x, player.y, '#bfe3ff', 12, 70); save();
    return true;
  });
  // 09-render calls every draw hook as h(g, items, cam) and later runs each item's draw() with NO arguments,
  // so the handler takes (g, items) and each item closes over g. Taking one parameter made `list` the canvas
  // context and the posts never drew at all.
  HOOKS.draw.push((g, items) => { // two posts and a rope, drawn on the bank
    for (const c of CROSSINGS) for (const p of [c.a, c.b]) {
      if (p.x < cam.x / TILE - 2 || p.x > (cam.x + VW) / TILE + 2 || p.y < cam.y / TILE - 2 || p.y > (cam.y + VH) / TILE + 2) continue;
      items.push({ y: tc(p.y), draw: () => {
        const x = tc(p.x), y = tc(p.y);
        g.fillStyle = '#6b4f2a'; g.fillRect(x - 3, y - 14, 6, 22);
        g.fillStyle = '#8a6a3a'; g.fillRect(x - 5, y - 16, 10, 4);
        g.strokeStyle = 'rgba(200,180,140,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + (p === c.a ? 10 : -10), y - 8); g.stroke();
      } });
    }
  });

  window.PROGRESSION = { CATCH, waterKind, seedLv, DEF_KILL_MIN, DEF_KILL_PER, CROSSINGS, CROSS, CROSS_TIERS };

  // ---------- self-test ----------
  const P = 'progression: ';
  HOOKS.selfTest.push((check, F, h) => {
    const give = h.give, clearJunk = h.clearJunk;
    const s0 = { ...player.skills.farming }, f0 = { ...player.skills.fishing }, d0 = { ...player.skills.defence }, c0 = { ...player.skills.cooking };
    // seeds are level-gated, and the best one the knight can plant is the one that goes in
    { const o = h.openSpot(70, 30); F.tp(o.x, o.y); const gt = { x: o.x + 1, y: o.y };
      const bag = player.inv.slice(); player.inv = player.inv.map(() => null); // an empty pack: under --play the bot arrives with 20 full slots and the seed never lands
      changeTile(gt.x, gt.y, T.SOIL); crops = crops.filter(c => c.i !== idx(gt.x, gt.y));
      for (const id of ['potato_seed', 'herb_seed']) { while (countItem(id)) removeItem(id, 1); }
      give('herb_seed', 2); player.skills.farming.xp = 0;
      F.face(gt.x, gt.y); F.press('KeyE'); F.sim(3, []);
      const refused = tileAt(gt.x, gt.y) === T.SOIL && !!notice && /Farming 15/.test(notice.text);
      player.skills.farming.xp = XP_TABLE[15]; give('potato_seed', 1);
      F.face(gt.x, gt.y); F.press('KeyE'); F.sim(3, []);
      const c = crops.find(x => x.i === idx(gt.x, gt.y));
      check(P + 'a herb seed needs Farming 15, and at 15 it is planted before the potato seed in the pack', refused && !!c && c.crop === 'herbs' && countItem('potato_seed') === 1, { refused, crop: c && c.crop, potatoLeft: countItem('potato_seed'), notice: notice && notice.text });
      // harvest pays the crop's own rate, not the potato's 15
      if (c) { c.stage = 3; const x0 = player.skills.farming.xp, h0 = countItem('herbs'); F.face(gt.x, gt.y); F.press('KeyE'); F.sim(3, []);
        const got = countItem('herbs') - h0, gained = player.skills.farming.xp - x0;
        check(P + 'a herb harvest pays 45 Farming xp a unit (a potato pays 15)', got >= 2 && gained === 45 * got, { got, gained, perUnit: got ? gained / got : 0 }); }
      player.inv = bag; }
    clearJunk && clearJunk();
    // fishing: the river holds pike from level 12, the sea swordfish from 40; the pond still gives shrimp
    { const w = F.nearestTile([T.WATER]); const river = PROGRESSION.waterKind(w.x, w.y);
      const spots = { pond: null, river: null, sea: null };
      for (let y = 0; y < MAP_H && (!spots.river || !spots.sea); y += 2) for (let x = 0; x < MAP_W; x += 2) {
        if (tileAt(x, y) !== T.WATER) continue; const k = PROGRESSION.waterKind(x, y); if (!spots[k]) spots[k] = { x, y };
      }
      const at = spots.river || { x: w.x, y: w.y };
      // count the catch by the xp it pays (a full pack drops the fish on the ground, so counting items is unreliable)
      const cast = (spot, lv, xp) => { player.skills.fishing.xp = XP_TABLE[lv]; let hits = 0;
        const drop = () => { player.inv = player.inv.map(sl => sl && /^raw_|^(pike|salmon|swordfish|shark)$/.test(sl.id) ? null : sl); };
        for (let i = 0; i < 80; i++) { drop(); const x0 = player.skills.fishing.xp; player.action = { type: 'fish', t: 0, need: 1.8, tx: spot.x, ty: spot.y }; finishFishing(); if (player.skills.fishing.xp - x0 === xp) hits++; }
        return hits; };
      const pike = cast(at, 12, 55) > 0;
      const sword = spots.sea ? cast(spots.sea, 40, 180) > 0 : false;
      player.action = null;
      check(P + 'pike swim in the river from Fishing 12, swordfish in the deep sea from 40', pike && (!spots.sea || sword) && !!spots.river, { pike, sword, river: spots.river, sea: spots.sea, kinds: Object.keys(spots).filter(k => spots[k]) }); }
    // cooking pays the fish's own rate
    { const bag = player.inv.slice(); player.inv = player.inv.map(() => null); // an empty pack: addItem needs a free slot or the fish never lands
      player.skills.cooking.xp = 0; let cooked = false, gained = 0, burnt = 0;
      for (let i = 0; i < 60 && !cooked; i++) { if (!countItem('raw_pike')) give('raw_pike', 1); const h0 = countItem('pike'), x0 = player.skills.cooking.xp;
        player.action = { type: 'cook', raw: 'raw_pike' }; finishCook(); if (countItem('pike') > h0) { cooked = true; gained = player.skills.cooking.xp - x0; } else burnt++; }
      player.inv = bag;
      check(P + 'cooking a pike pays 55 Cooking xp, not the flat 30', cooked && gained === 55, { cooked, gained, burnt }); }
    // defence learns from a hard kill
    { const hardType = Object.keys(MONSTER_DEFS).find(t => (MONSTER_DEFS[t].level | 0) >= DEF_KILL_MIN);
      const hard = MONSTER_DEFS[hardType]; const at = { type: hardType, dead: true, x: player.x, y: player.y, r: 12 };
      player.skills.defence.xp = XP_TABLE[20]; const x0 = player.skills.defence.xp;
      for (const f of HOOKS.kill) f(at);
      const got = player.skills.defence.xp - x0;
      const y0 = player.skills.defence.xp; for (const f of HOOKS.kill) f({ type: 'goblin', dead: true, x: player.x, y: player.y, r: 10 });
      const small = player.skills.defence.xp - y0;
      check(P + 'a level 10+ kill teaches Defence (level x 4); a goblin (level 3) does not', got === hard.level * 4 && small === 0, { hardType, level: hard.level, got, small }); }
    // the river crossings: three posts, level-gated, and the leap actually lands you on the far bank
    { const cs = PROGRESSION.CROSSINGS;
      let gated = false, leapt = false, landed = null, xpGot = 0, farSide = false;
      if (cs.length) { const c = cs[0]; const a0 = { ...player.skills.agility };
        player.skills.agility.xp = 0; F.tp(c.a.x - 1, c.a.y); F.face(c.a.x, c.a.y); F.press('KeyE'); F.sim(2, []);
        gated = Math.floor(player.x / TILE) === c.a.x - 1 && !!notice && new RegExp('Agility ' + c.lv).test(notice.text);
        player.skills.agility.xp = XP_TABLE[c.lv]; const x0 = player.skills.agility.xp;
        F.face(c.a.x, c.a.y); F.press('KeyE'); F.sim(2, []);
        landed = [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
        xpGot = player.skills.agility.xp - x0; leapt = landed[0] > c.b.x - 1; farSide = !SOLID.has(tileAt(landed[0], landed[1]));
        player.skills.agility = a0; }
      check(P + 'three river crossings: a post on each bank, the leap is refused below its Agility level and lands you on the far bank', cs.length === 3 && cs.every(c => tileAt(c.a.x, c.a.y) === PROGRESSION.CROSS && tileAt(c.b.x, c.b.y) === PROGRESSION.CROSS) && gated && leapt && farSide && xpGot === cs[0].xp,
        { n: cs.length, levels: cs.map(c => c.lv), widths: cs.map(c => c.width), gated, leapt, landed, farSide, xpGot }); }
    // the new recipes are real and reachable
    { const ids = ['herb_poultice', 'scale_cloak', 'greater_poultice'];
      const rs = ids.map(id => RECIPES.find(r => r.out === id));
      const oven = RECIPES.find(r => r.out === 'golden_bread');
      check(P + 'the new crafting recipes exist at a station with a level and xp, and the loaf is baked at an oven', rs.every(r => r && r.station && r.lv > 0 && r.xp > 0) && (!oven || oven.station === 'oven'), { rs: rs.map(r => r && [r.lv, r.xp, r.station]), oven: oven && [oven.lv, oven.xp] }); }
    player.skills.farming = s0; player.skills.fishing = f0; player.skills.defence = d0; player.skills.cooking = c0;
  });
}
