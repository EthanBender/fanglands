// ============================================================================
// WRECKS AND MONEY — three things a player hit in a real session
//  1. A wrecked machine pinned the knight. "I just killed a wrecked walker but it blew up on me and the
//     wrecked walker has me pinned, I can't move. The wrecked machines should not impede pathing."
//     Every wreck tile (walker, bulldozer, Barrelbeast) is now walk-over for the knight, and pressing E
//     while standing on one repairs it, so nothing can ever fence you in. Monsters still treat it as solid.
//  2. Death's fee was unpayable early. "The early game death's coffer fees are too cumbersome, I can't
//     easily make 300-1000 gold in the early game." Death now takes a share that grows with the knight:
//     a twelfth early, a quarter once you are a real fighter, and never more than a cap he names out loud.
//  3. There was nowhere to earn coins by skilling. "There should be avenues to make gp skilling too."
//     Every shopkeeper now pays full price for the trade they actually deal in, and Fennick posts a
//     standing order that refreshes: bring him what he is short of, take coins and a bonus.
// Feature file: registers through HOOKS only, edits no core file. window.ECONOMY exposes the tables.
// ============================================================================
{
  // ---------- 1. wrecks never block ----------
  // The knight walks over a wreck; a monster or a companion still walks around it. That is exactly what
  // WALK_OVER means in 00-core (`solidFor(t, 'player')` consults it), so the pathing fix is one line per tile.
  const WRECK_NAMES = ['WRECK', 'DOZER_WRECK', 'BEAST_WRECK'];
  const wreckIds = () => WRECK_NAMES.filter(n => n in T).map(n => T[n]);
  for (const id of wreckIds()) WALK_OVER.add(id);
  // A feature that registers its wreck tile after this file loads still gets the fix on the first tick.
  let wreckWatch = 0;
  HOOKS.update.push(dt => { if ((wreckWatch -= dt) > 0) return; wreckWatch = 2; for (const id of wreckIds()) WALK_OVER.add(id); });

  // Standing on a wreck, E repairs the one under your feet: the core looks at the tile you face, and while
  // you are standing on the wreck that tile is the ground beyond it.
  const _useAction = useAction;
  useAction = function () {
    if (!player.dead && !player.mech) {
      const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE), here = tileAt(tx, ty);
      const front = frontTile(player), facing = tileAt(front.tx, front.ty);
      if (wreckIds().includes(here) && !wreckIds().includes(facing) && !npcInFront()) {
        for (const h of HOOKS.use) if (h(here, tx, ty, buildingAt(tx, ty))) return; // the dozer and the beast own their own wrecks
        if (here === T.WRECK) { repairMech(tx, ty); return; }
      }
    }
    return _useAction.apply(this, arguments);
  };

  // ---------- 2. Death's fee grows with the knight ----------
  // The core charges a quarter of the value of everything worth 20 or more. At combat level 3 with a steel
  // helm in the chest that is hundreds of coins the knight has no way to earn. The share now ramps, and a
  // cap keeps the first deaths survivable: 60 coins at combat 1, 260 at combat 10, 1,060 at combat 50.
  const FEE_BANDS = [[10, 1 / 12], [20, 1 / 6], [Infinity, 1 / 4]]; // combat level below → share of value
  const feeShare = () => { const cb = combatLevel(); for (const [lv, share] of FEE_BANDS) if (cb < lv) return share; return 0.25; };
  const feeCap = () => 40 + combatLevel() * 20;
  // The chest's headline price and the per-item prices must agree exactly, or "Reclaim everything for N coins"
  // takes N and still leaves an item behind. So the total is DEFINED as the sum of the per-item fees, and the
  // cap is applied as a share the whole chest shares, never per item (three capped items would each pay the cap).
  const chestValue = () => {
    if (!deathKeep) return 0;
    let v = 0;
    for (const s of deathKeep.items) { if (s.id === 'coins' || !ITEMS[s.id]) continue; const val = ITEMS[s.id].value * s.qty; if (val >= 20) v += val; }
    return v;
  };
  const effShare = () => { const raw = chestValue(); const base = feeShare(); return raw > 0 ? Math.min(base, feeCap() / raw) : base; };
  itemFee = function (id, qty) {
    if (window.__kidmode || id === 'coins' || !ITEMS[id]) return 0;
    const v = ITEMS[id].value * qty;
    return v >= 20 ? Math.ceil(v * effShare()) : 0;
  };
  coffinFee = function () {
    if (window.__kidmode || !deathKeep) return 0;
    let f = 0; for (const s of deathKeep.items) f += itemFee(s.id, s.qty);
    return f;
  };

  // Death says what he is doing, so the ramp is visible rather than mysterious.
  const _talkTo = talkTo;
  talkTo = function (npc) {
    const r = _talkTo.apply(this, arguments);
    if (npc && npc.role === 'death' && deathKeep && combatLevel() < 20) {
      say(`You are young yet, so I take a smaller share: ${Math.round(feeShare() * 100)} in the hundred, and never more than ${feeCap()} coins at once. Grow, and my price grows with you.`, 'Death');
    }
    return r;
  };

  // ---------- 3. coins from skilling ----------
  // (a) Fennick pays full price for what a skill produces, not just for what a fighter loots.
  // 06-systems opens his stall as openPanel('shop', 'trader') and 10-hud falls back to an inline stall
  // because SHOPS.trader does not exist. Registering it here supersedes that fallback with the same shape
  // (buys + rate 1 = full price for everything on the list), on a list that now includes gathered goods.
  SHOPS.trader = {
    name: "Fennick's Stall",
    stock: [['bronze_axe', 25], ['bronze_pickaxe', 30], ['fishing_rod', 60]],
    rate: 1,
    buys: ['wolf_pelt', 'boar_tusk', 'wool', 'spider_silk', 'goblin_scrap', 'coal', 'wood', 'oak_log', 'iron_ore', 'stone', 'raw_shrimp', 'potato'].filter(id => ITEMS[id]),
  };

  // (b) Fennick's standing order: a repeatable delivery that refreshes, so skilling always has a buyer.
  // Six orders rotate. Each asks for something a skill produces, pays the goods' value plus a flat bonus,
  // and cannot be handed in twice without a new order. This is the reliable early-game coin tap.
  const ORDERS = [
    { id: 'logs', item: 'wood', n: 15, bonus: 40, line: 'The sawmill wants logs and I want the middleman fee. Fifteen.' },
    { id: 'ore', item: 'iron_ore', n: 10, bonus: 60, line: 'Brakka is short of iron again. Ten lumps and I will see you right.' },
    { id: 'fish', item: 'raw_shrimp', n: 12, bonus: 35, line: 'Salt Pete pays for shrimp by the dozen. Bring me twelve.' },
    { id: 'coal', item: 'coal', n: 8, bonus: 70, line: 'Coal. Eight loads. The forge eats it faster than I can carry it.' },
    { id: 'spuds', item: 'potato', n: 20, bonus: 45, line: 'Twenty potatoes. Do not ask what for. The inn asked, that is all.' },
    { id: 'silk', item: 'spider_silk', n: 6, bonus: 90, line: 'Six lengths of spider silk. Thessaly pays, and I take my cut.' },
  ];
  const orderState = () => { if (!quest.orders) quest.orders = { i: 0, done: 0, taken: false }; return quest.orders; };
  const currentOrder = () => ORDERS[orderState().i % ORDERS.length];
  const orderPay = o => Math.max(1, ITEMS[o.item] ? ITEMS[o.item].value * o.n + o.bonus : o.bonus);
  HOOKS.newGame.push(() => { quest.orders = { i: 0, done: 0, taken: false }; });

  // Spoken before the stall opens, never instead of it: the core's trader branch still runs, so Fennick
  // sells and buys exactly as before. Returning false is what keeps the shop panel reachable.
  HOOKS.talkBefore.trader = npc => {
    if (npc.id !== 'fennick') return false;
    const s = orderState(), o = currentOrder();
    if (countItem(o.item) >= o.n) {
      removeItem(o.item, o.n); const pay = orderPay(o);
      addItem('coins', pay); s.i++; s.done++; s.taken = true;
      floatText(player.x, player.y - 34, `+${pay} coins`, '#ffd166', 15);
      say(`That is the lot. ${pay} coins, and my thanks. ${currentOrder().line}`, npc.name); save();
    } else if (!s.taken) { s.taken = true; say(`${o.line} ${orderPay(o)} coins when you bring them, and there is always another order after.`, npc.name); save(); }
    else say(`${o.line} You have ${countItem(o.item)} of ${o.n}.`, npc.name);
    return false; // let the core open the stall
  };

  HOOKS.questText.orders = () => { const o = currentOrder(), s = orderState(); return `Fennick's order: ${o.n} ${ITEMS[o.item] ? ITEMS[o.item].name : o.item} for ${orderPay(o)} coins. You have ${countItem(o.item)}. Orders filled: ${s.done}.`; };
  HOOKS.activeQuests.push(() => (quest.orders && quest.orders.taken ? ['orders'] : []));
  QUEST_DEFS.orders = { name: "Fennick's order" };
  HOOKS.mapTarget.push(() => (quest.orders && quest.orders.taken ? { x: 116, y: 27, label: 'Fennick', id: 'orders' } : null));

  window.ECONOMY = { feeShare, feeCap, FEE_BANDS, ORDERS, currentOrder, orderPay, orderState, wreckIds };

  // ---------- self-test ----------
  const P = 'economy: ';
  HOOKS.selfTest.push((check, F, h) => {
    // wrecks never pin the knight
    { const o = h.openSpot(60, 24); F.tp(o.x, o.y);
      const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
      const ring = [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]];
      const was = ring.map(([x, y]) => tileAt(x, y));
      for (const [x, y] of ring) changeTile(x, y, T.WRECK);
      const boxedIn = ring.every(([x, y]) => solidFor(tileAt(x, y), 'player'));
      const canLeave = !collides(tc(tx + 1), tc(ty), 13, 'player');
      const monsterBlocked = collides(tc(tx + 1), tc(ty), 13, 'beast');
      ring.forEach(([x, y], i) => changeTile(x, y, was[i]));
      check(P + 'a ring of wrecks never pins the knight (walk-over for the player, still solid for monsters)', !boxedIn && canLeave && monsterBlocked, { boxedIn, canLeave, monsterBlocked }); }
    // standing on a wreck, E repairs it
    { const o = h.openSpot(62, 26); F.tp(o.x, o.y);
      const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE), was = tileAt(tx, ty);
      changeTile(tx, ty, T.WRECK); h.give('iron_bar', 3); h.give('goblin_scrap', 4);
      player.facing = { x: 0, y: -1 }; const n0 = notice && notice.text;
      useAction(); if (panel === 'salvage') { render(); F.clickButton('Repair it and drive it'); F.sim(2, []); }
      const acted = (notice && notice.text) !== n0 || tileAt(tx, ty) !== T.WRECK || !!player.mech;
      if (player.mech) { player.mech = null; player.r = 13; player.speed = 175; }
      changeTile(tx, ty, was);
      check(P + 'E while standing on a wreck repairs the wreck under your feet', acted, { acted, notice: notice && notice.text }); }
    // Death's fee ramps with the knight and is capped
    { const kid = window.__kidmode; window.__kidmode = false;
      const keep = deathKeep, m0 = { ...player.skills.melee }, d0 = { ...player.skills.defence }, h0 = player.skills.hitpoints ? { ...player.skills.hitpoints } : null;
      deathKeep = { items: [{ id: 'steel_helm', qty: 1 }, { id: 'iron_body', qty: 1 }] };
      const raw = deathKeep.items.reduce((s, it) => s + (ITEMS[it.id] ? Math.ceil(ITEMS[it.id].value * it.qty * 0.25) : 0), 0);
      player.skills.melee.xp = 0; player.skills.defence.xp = 0; if (player.skills.hitpoints) player.skills.hitpoints.xp = 0;
      const lowCb = combatLevel(), low = coffinFee(), lowCap = ECONOMY.feeCap();
      player.skills.melee.xp = XP_TABLE[60]; player.skills.defence.xp = XP_TABLE[60];
      const highCb = combatLevel(), high = coffinFee();
      player.skills.melee = m0; player.skills.defence = d0; if (h0) player.skills.hitpoints = h0;
      deathKeep = keep; window.__kidmode = kid;
      check(P + "Death's fee is a twelfth early and a quarter later, and never over the cap he names", low < raw && low <= lowCap && high > low && lowCb < highCb, { raw, low, lowCap, lowCb, high, highCb }); }
    // kid mode: the coffin button says free, so reclaim must actually be free and give everything back
    { const kid = window.__kidmode, keep = deathKeep;
      window.__kidmode = true;
      deathKeep = { items: [{ id: 'steel_helm', qty: 1 }, { id: 'iron_body', qty: 1 }] };
      const total = coffinFee(), per = deathKeep.items.map(s2 => itemFee(s2.id, s2.qty));
      const bag = player.inv.slice(); player.inv = player.inv.map(() => null);
      const c0 = coins(); reclaimFromDeath();
      const gotAll = countItem('steel_helm') === 1 && countItem('iron_body') === 1, chestEmpty = !deathKeep, paid = c0 - coins();
      player.inv = bag; deathKeep = keep; window.__kidmode = kid;
      check(P + 'kid mode: the chest really is free — everything comes back and nothing is charged', total === 0 && per.every(x => x === 0) && gotAll && chestEmpty && paid === 0, { total, per, gotAll, chestEmpty, paid }); }
    // the headline price and the per-item prices can never disagree, or "reclaim everything" leaves something behind
    { const kid = window.__kidmode, keep = deathKeep, m0 = { ...player.skills.melee }, d0 = { ...player.skills.defence };
      window.__kidmode = false;
      let worst = null;
      for (const lv of [1, 12, 25, 60]) {
        player.skills.melee.xp = XP_TABLE[lv]; player.skills.defence.xp = XP_TABLE[lv];
        deathKeep = { items: [{ id: 'steel_helm', qty: 1 }, { id: 'iron_body', qty: 1 }, { id: 'iron_dagger', qty: 1 }, { id: 'mithril_bar', qty: 3 }].filter(s2 => ITEMS[s2.id]) };
        const total = coffinFee(), sum = deathKeep.items.reduce((a, s2) => a + itemFee(s2.id, s2.qty), 0);
        if (total !== sum && !worst) worst = { lv, total, sum };
        if (total > ECONOMY.feeCap() && !worst) worst = { lv, total, cap: ECONOMY.feeCap() };
      }
      player.skills.melee = m0; player.skills.defence = d0; deathKeep = keep; window.__kidmode = kid;
      check(P + 'the coffin total is exactly the sum of the per-item fees, and never over the cap, at every combat level', !worst, { worst }); }
    // Fennick pays full price, and his list now covers gathered goods too
    { const sh = SHOPS.trader;
      const gathered = ['wood', 'iron_ore', 'raw_shrimp', 'potato', 'stone'].filter(id => ITEMS[id]);
      const covered = gathered.filter(id => sh && sh.buys.includes(id));
      const kept = ['wolf_pelt', 'boar_tusk', 'wool', 'spider_silk', 'goblin_scrap', 'coal'].filter(id => ITEMS[id] && sh.buys.includes(id));
      check(P + 'Fennick pays full price and his list covers gathered goods as well as loot', !!sh && sh.rate === 1 && covered.length === gathered.length && kept.length === 6, { rate: sh && sh.rate, covered, kept: kept.length, list: sh && sh.buys.length }); }
    // Fennick's standing order pays and rolls on
    { const fennick = NPCS.find(n => n.id === 'fennick');
      if (!fennick) { check(P + "Fennick's standing order pays for gathered goods and rolls on to the next", false, { fennick: null }); }
      else {
        quest.orders = { i: 0, done: 0, taken: false };
        const o = ECONOMY.currentOrder();
        HOOKS.talkBefore.trader(fennick); const took = quest.orders.taken;
        const bag = player.inv.slice(); player.inv = player.inv.map(() => null); // an empty pack: give() needs free slots, and a full one must never spin the suite
        for (let i = 0; i < 12 && countItem(o.item) < o.n; i++) h.give(o.item, o.n);
        const c0 = coins(), have0 = countItem(o.item);
        HOOKS.talkBefore.trader(fennick);
        const paid = coins() - c0, gone = have0 - countItem(o.item), rolled = ECONOMY.currentOrder().id !== o.id;
        player.inv = bag;
        check(P + "Fennick's standing order pays for gathered goods and rolls on to the next", took && paid === ECONOMY.orderPay(o) && gone === o.n && rolled && quest.orders.done === 1, { took, paid, want: ECONOMY.orderPay(o), gone, need: o.n, rolled, done: quest.orders.done });
        quest.orders = { i: 0, done: 0, taken: false };
      } }
  });
}
