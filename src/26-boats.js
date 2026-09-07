// ============================================================================
// THE GREY SEA — Old Harl's ferry, Gull Isle and Ironclad Isle
// "people that offer to take you to islands, all sorts of places" — Cohen
// Feature file. Registers everything through HOOKS; edits no core file.
// Everything lives in one block so no name leaks into the shared script scope.
// ============================================================================
{
  // ---------- tiles (ids captured locally) ----------
  const B_SEAROCK = addTile('SEAROCK', { solid: true, tex: 'water', mini: '#6e7178' });
  const B_DOCK = addTile('DOCK', { solid: false, tex: 'plank', mini: '#a5763f' });
  const B_BOAT = addTile('BOAT', { solid: true, tex: 'water', mini: '#8a5a2b' });
  const B_PALM = addTile('PALM', { solid: true, tex: 'sand', mini: '#2f8a3a' });
  const B_LOBSTER = addTile('LOBSTER_WATER', { solid: true, tex: 'water', mini: '#3d86c6' });
  const B_BOTTLE = addTile('BOTTLE', { solid: true, tex: 'sand', mini: '#7ec8ff' });
  const B_HULL = addTile('HULL', { solid: true, tex: 'dirt', mini: '#4a3a2a' });
  const B_STRONGBOX = addTile('STRONGBOX', { solid: true, tex: 'dirt', mini: '#8f96a3' });
  const WET = new Set([T.WATER, B_BOAT, B_LOBSTER, B_SEAROCK]);

  // ---------- geometry ----------
  const SEA = { x0: 162, y0: 0, x1: 199, y1: 95 };
  const SAIL_T = 2; // seconds on the water
  const rect = (x0, y0, x1, y1) => { const out = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]); return out; };
  // every place Harl moors: the planks, his boat at the end, where he stands, where you step off, the lantern post
  const LOC = {
    dock: { name: 'the dock', blurb: 'The mainland, and the road back to Thistledown.', dock: rect(162, 13, 166, 15), boat: { x: 167, y: 14 }, harl: { x: 165, y: 14 }, land: { x: 164, y: 14 }, lantern: { x: 166, y: 13 }, face: { x: -1, y: 0 } },
    gull: { name: 'Gull Isle', price: 10, blurb: 'Palms, lobster, and a hermit who hates company.', dock: rect(171, 12, 172, 14), boat: { x: 170, y: 13 }, harl: { x: 172, y: 13 }, land: { x: 173, y: 13 }, lantern: { x: 171, y: 12 }, face: { x: 1, y: 0 } },
    ironclad: { name: 'Ironclad Isle', price: 25, combat: 8, blurb: 'A goblin wreck. Five of them still guard it.', dock: rect(178, 49, 179, 51), boat: { x: 177, y: 50 }, harl: { x: 179, y: 50 }, land: { x: 180, y: 50 }, lantern: { x: 178, y: 49 }, face: { x: 1, y: 0 },
      refuse: "Ironclad's crawling with goblins, knight. Come back when you can hold your own. Combat level eight." },
    // the far side of the sea: Grubmarket and Castle Gnash (src/33-goblincity.js carves the land and owns everything east of the strait).
    // stay: Harl waits while the knight is anywhere in this rect (its towns are their own regions, so the region-name check alone would row him home)
    farshore: { name: 'The Far Shore', price: 40, combat: 10, blurb: 'Goblin country. A market, a castle, and a tinker with ideas.', dock: rect(204, 29, 205, 31), boat: { x: 203, y: 30 }, harl: { x: 205, y: 30 }, land: { x: 206, y: 30 }, lantern: { x: 204, y: 29 }, face: { x: 1, y: 0 },
      stay: { x0: 200, y0: 1, x1: 258, y1: 96 }, refuse: "The Far Shore is goblin country, knight. All of it. Combat level ten, or I row you straight back." },
  };
  const GULL = { cx: 178.5, cy: 13, rx: 6, ry: 6.5, region: { name: 'Gull Isle', sub: 'Palms, lobster and a hermit', x0: 169, y0: 5, x1: 186, y1: 21 } };
  const IRON = { cx: 187.5, cy: 50, rx: 8.5, ry: 9, dirt: true, region: { name: 'Ironclad Isle', sub: 'A goblin wreck, and what it guards', x0: 176, y0: 39, x1: 197, y1: 61 } };
  const HUT = { id: 'pete_hut', x: 180, y: 9, w: 4, h: 4, name: "Salt Pete's Shack", roof: '#5a6a4a', door: 2, f: [[T.BED, 1, 1], [T.SHELF, 2, 1]] };
  const PALMS = [[175, 10], [178, 8], [174, 13], [176, 16], [180, 17], [183, 14], [177, 18]];
  const FIRE_T = { x: 178, y: 15 }, PETE_T = { x: 181, y: 14 }, BOTTLE_T = { x: 175, y: 17 };
  const LOBSTER_ROWS = [[14, 1], [16, 1], [16, -1], [9, -1]]; // [row, direction from the island centre] → first water off the shore
  const HULL_T = { x: 188, y: 46 }, STRONGBOX_T = { x: 188, y: 49 };
  const WRECK_PLANKS = [[186, 46], [190, 45], [185, 48], [191, 48], [187, 52]];
  const WRECK_WALLS = [[184, 53], [185, 53], [184, 54], [191, 54], [192, 54], [192, 53]];
  const WRECK_BRUTES = [[185, 47], [191, 47], [188, 53]], WRECK_SAPPERS = [[184, 50], [192, 50]];
  const SEAROCKS = [[168, 6], [170, 24], [176, 27], [186, 25], [194, 9], [196, 31], [170, 44], [173, 57], [190, 67], [180, 73], [196, 81], [168, 87], [186, 91], [178, 36], [166, 60], [193, 39], [167, 30]];
  const inSea = (tx, ty) => tx >= SEA.x0 && tx <= SEA.x1 && ty >= SEA.y0 && ty <= SEA.y1;
  const inRegion = (r, tx, ty) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;

  // ahead of every core region (so the sea beats 'The Wilds'), but behind the feature regions already at the front:
  // the dwarves' self-test asserts REGIONS[0] is Deepholm, and nothing here overlaps another feature's region
  { const at = Math.max(0, REGIONS.findIndex(r => r.name === 'The Cave')); REGIONS.splice(at, 0, IRON.region, GULL.region, { name: 'The Grey Sea', sub: 'Salt and gulls', x0: SEA.x0, y0: SEA.y0, x1: SEA.x1, y1: SEA.y1 }); }
  BUILDINGS.push(HUT);

  // ---------- items ----------
  Object.assign(ITEMS, {
    lobster_pot: { name: 'Lobster pot', value: 60, color: '#8a6a3a', shape: 'trap', stack: 1, tool: 'pot', tier: 1 },
    raw_lobster: { name: 'Raw lobster', value: 30, color: '#c0504d', shape: 'fish', cook: 'lobster' },
    lobster: { name: 'Lobster', value: 60, color: '#e63946', shape: 'fish', heal: 12 },
  });
  for (const k of ['lobster_pot', 'raw_lobster', 'lobster']) { ITEMS[k].id = k; if (!ITEMS[k].stack) ITEMS[k].stack = 50; }
  // the core's item blurb table does not know a 'pot' tool and would print "undefined" in the pack panel; wrap it
  { const coreBlurb = itemBlurb; itemBlurb = def => def.tool === 'pot' ? 'Lower it at a lobster buoy (E). Fishing 25.' : coreBlurb(def); }
  const PETE_SHOP = { name: "Salt Pete's Shack", stock: [['lobster_pot', 60], ['fishing_rod', 70], ['bread', 10]], buys: ['raw_shrimp', 'shrimp', 'raw_trout', 'trout', 'raw_lobster', 'lobster'] };
  SHOPS.saltpete = PETE_SHOP;

  // ---------- state ----------
  const fresh = () => ({ sailing: null, where: 'dock', visited: {}, bottle: false, strongbox: false });
  const bq = () => quest.boats || (quest.boats = fresh());
  HOOKS.newGame.push(() => { quest.boats = fresh(); });

  // ---------- the sea folk (own list: never wander, talked to through HOOKS.use) ----------
  const HARL = { id: 'harl', name: 'Old Harl', facing: { x: 0, y: 1 }, lines: [
    "Where to, knight? Gull Isle's ten coins. Ironclad is twenty-five, and I don't row anyone there who can't hold a sword.",
    "Sea's calm today. It won't stay that way. Pick an island.",
    'Old Pete on Gull Isle owes me a lobster. Tell him Harl said so.',
    'Goblins built a ship once. Built it badly. Ironclad Isle is where it ended up.',
    'Forty coins gets you the Far Shore. Goblins with shops, goblins with a castle. Mind your purse and your neck.',
  ] };
  const PETE = { id: 'pete', name: 'Salt Pete', x: PETE_T.x, y: PETE_T.y, px: tc(PETE_T.x), py: tc(PETE_T.y), facing: { x: 0, y: 1 }, lines: [
    'Lobster pots. Sixty coins. Drop one at a buoy and wait. Fishing twenty-five, or the lobsters laugh at you.',
    "I'll buy fish. Full price. Shrimp, trout, lobster. Not your potatoes.",
    'Harl brought you? Then you paid too much.',
    'Cook a lobster on my fire and I might forgive the company.',
  ] };
  const harlPos = () => { const L = LOC[bq().where] || LOC.dock; return { x: tc(L.harl.x), y: tc(L.harl.y) }; };
  function seaFolkInFront() {
    const cands = [];
    if (!bq().sailing) { const p = harlPos(); cands.push({ who: HARL, px: p.x, py: p.y }); }
    cands.push({ who: PETE, px: PETE.px, py: PETE.py });
    let best = null;
    for (const c of cands) {
      const dd = dist(player.x, player.y, c.px, c.py); if (dd > 80) continue;
      const dot = ((c.px - player.x) * player.facing.x + (c.py - player.y) * player.facing.y) / (dd || 1);
      if (dot < 0.2 && dd > 30) continue;
      if (!best || dd < best.dd) best = { ...c, dd };
    }
    return best;
  }
  function talkSeaFolk(c) {
    { const dx = c.px - player.x, dy = c.py - player.y, dd = Math.hypot(dx, dy) || 1; player.facing = { x: dx / dd, y: dy / dd }; }
    say(pick(c.who.lines), c.who.name);
    openPanel(c.who === HARL ? 'ferry' : 'pete');
  }

  // ---------- sailing ----------
  function sail(to) {
    const q = bq(); const L = LOC[to]; const price = to === 'dock' ? 0 : L.price;
    if (L.combat && combatLevel() < L.combat) {
      notify(`Harl won't row you to ${L.name} below combat level ${L.combat} (you are ${combatLevel()}).`);
      say(L.refuse || `Come back when you can hold your own. Combat level ${L.combat}.`, HARL.name); return;
    }
    if (!payCoins(price)) { notify(`Harl wants ${price} coins for ${L.name}. You have ${coins()}.`); return; }
    closePanel(); dialog.queue.length = 0; dialog.cur = null;
    q.sailing = { to, t: 0, from: q.where, fx: player.x, fy: player.y };
    player.action = null; openPanel('sailing'); save();
  }
  function arrive() {
    const q = bq(); const s = q.sailing; const L = LOC[s.to] || LOC.dock;
    q.sailing = null; q.where = LOC[s.to] ? s.to : 'dock'; closePanel();
    player.x = tc(L.land.x); player.y = tc(L.land.y); player.facing = { ...L.face }; player.action = null;
    burst(player.x, player.y, '#bfe3ff', 14, 80); notify(`You step off Harl's boat at ${L.name}.`);
    if (!q.visited[q.where]) {
      q.visited[q.where] = true;
      if (q.where === 'gull') say('Gull Isle. Sand, palms and a man who came here to be left alone. He sells lobster pots, if you ask nicely.', 'The Voice');
      if (q.where === 'ironclad') say('Ironclad Isle. A goblin ship came apart on these rocks with something heavy in its hold. They left five to guard it. Five is a number, not a wall.', 'The Voice');
    }
    save();
  }
  // still "at" a moored place: in its region, on the grey water, inside a dungeon (16-instances), or anywhere inside its stay rect (the Far Shore has towns with their own regions)
  const atMoor = L => { if (window.__instance || player.region === L.name || player.region === 'The Grey Sea') return true; if (!L.stay) return false; const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE); return tx >= L.stay.x0 && tx <= L.stay.x1 && ty >= L.stay.y0 && ty <= L.stay.y1; };
  const wreckGoblins = () => monsters.filter(m => (m.type === 'brute' || m.type === 'sapper') && inRegion(IRON.region, Math.floor(m.home.x / TILE), Math.floor(m.home.y / TILE)));

  // ---------- world ----------
  HOOKS.world.push((rnd, api) => {
    const isHut = (x, y) => buildingAt(x, y) === HUT;
    // the sea, with a sandy shore against the mainland
    for (let y = SEA.y0; y <= SEA.y1; y++) for (let x = SEA.x0; x <= SEA.x1; x++) { if (isHut(x, y)) continue; api.setTile(x, y, x <= SEA.x0 + 1 ? T.SAND : T.WATER); }
    // the islands: an ellipse with a wobbly edge; Ironclad has a dirt heart
    const isle = (I, x, y) => { const dx = (x - I.cx) / I.rx, dy = (y - I.cy) / I.ry; return dx * dx + dy * dy + Math.sin(x * 1.7 + y * 0.9) * 0.12; };
    for (const I of [GULL, IRON]) for (let y = I.region.y0; y <= I.region.y1; y++) for (let x = I.region.x0; x <= I.region.x1; x++) {
      if (isHut(x, y)) continue; const d = isle(I, x, y);
      if (d < 1) api.setTile(x, y, I.dirt && d < 0.5 ? T.DIRT : T.SAND);
    }
    for (let y = HUT.y - 1; y <= HUT.y + HUT.h; y++) for (let x = HUT.x - 1; x <= HUT.x + HUT.w; x++) if (!isHut(x, y)) api.setTile(x, y, T.SAND); // dry ground all round the shack
    const ensureLand = (x, y, t = T.SAND) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (api.tileAt(x + dx, y + dy) === T.WATER) api.setTile(x + dx, y + dy, t); };
    // the road from Thistledown's east gate: north along the village fence, then east along y 14 to the shore
    const clearable = new Set([T.GRASS, T.DIRT, T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.STUMP, T.RUBBLE]);
    const lane = []; for (let y = 14; y <= 32; y++) lane.push([141, y]); for (let x = 141; x <= 161; x++) lane.push([x, 14]);
    for (const [x, y] of lane) if (clearable.has(api.tileAt(x, y))) api.setTile(x, y, T.DIRT);
    const verge = []; for (let x = 141; x <= 161; x++) verge.push([x, 13], [x, 15]); for (let y = 14; y <= 19; y++) verge.push([142, y]);
    for (const [x, y] of verge) if ([T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL].includes(api.tileAt(x, y))) api.setTile(x, y, T.GRASS);
    // docks and boats
    for (const k in LOC) { const L = LOC[k]; for (const [x, y] of L.dock) api.setTile(x, y, B_DOCK); api.setTile(L.boat.x, L.boat.y, B_BOAT); api.setTile(L.land.x, L.land.y, k === 'dock' ? B_DOCK : T.SAND); }
    // Gull Isle: palms, Pete's fire, the bottle, lobster grounds off the shore
    for (const [x, y] of PALMS) { ensureLand(x, y); api.setTile(x, y, B_PALM); }
    ensureLand(FIRE_T.x, FIRE_T.y); api.setTile(FIRE_T.x, FIRE_T.y, T.FIRE);
    ensureLand(PETE_T.x, PETE_T.y); api.setTile(PETE_T.x, PETE_T.y, T.SAND);
    ensureLand(BOTTLE_T.x, BOTTLE_T.y); api.setTile(BOTTLE_T.x, BOTTLE_T.y, B_BOTTLE);
    for (const [row, dir] of LOBSTER_ROWS) {
      let x = Math.floor(GULL.cx); while (inMap(x + dir, row) && api.tileAt(x, row) !== T.WATER) x += dir;
      if (api.tileAt(x, row) !== T.WATER) continue;
      api.setTile(x - dir, row, T.SAND); api.setTile(x, row, B_LOBSTER); if (api.tileAt(x + dir, row) === T.WATER) api.setTile(x + dir, row, B_LOBSTER); // two deep, so the buoy is what you face, not the sea behind it
    }
    // Ironclad Isle: the wreck, its guards, the strongbox
    ensureLand(HULL_T.x, HULL_T.y, T.DIRT); api.setTile(HULL_T.x, HULL_T.y, B_HULL);
    ensureLand(STRONGBOX_T.x, STRONGBOX_T.y, T.DIRT); api.setTile(STRONGBOX_T.x, STRONGBOX_T.y, B_STRONGBOX);
    for (const [x, y] of WRECK_PLANKS) { ensureLand(x, y, T.DIRT); api.setTile(x, y, T.PLANK); }
    for (const [x, y] of WRECK_WALLS) { ensureLand(x, y, T.DIRT); api.setTile(x, y, T.CWALL); }
    for (const [x, y] of [...WRECK_BRUTES, ...WRECK_SAPPERS]) { ensureLand(x, y, T.DIRT); api.setTile(x, y, T.DIRT); }
    for (let i = MONSTER_SPAWNS.length - 1; i >= 0; i--) { const s = MONSTER_SPAWNS[i]; if (inSea(s.tx, s.ty)) MONSTER_SPAWNS.splice(i, 1); }
    api.spawnList('brute', WRECK_BRUTES); api.spawnList('sapper', WRECK_SAPPERS);
    // rocks and foam out in the grey water
    for (const [x, y] of SEAROCKS) if (api.tileAt(x, y) === T.WATER) api.setTile(x, y, B_SEAROCK);
  });

  // ---------- use: Harl, Pete, lobster grounds, the bottle, the strongbox ----------
  HOOKS.use.push((t, tx, ty) => {
    if (bq().sailing) return true;
    const c = seaFolkInFront();
    if (c) { talkSeaFolk(c); return true; }
    if (t === B_LOBSTER) {
      if (!hasTool('pot')) { notify('A lobster ground. You need a lobster pot to work it (Salt Pete sells them).'); return true; }
      if (skillLv('fishing') < 25) { notify('You need Fishing level 25 for lobster.'); return true; }
      if (!canFit('raw_lobster', 1)) { notify('Your pack is full.'); return true; }
      player.action = { type: 'lobster', tx, ty, t: 0, need: 2.2 };
      return true;
    }
    if (t === B_BOTTLE) {
      const q = bq();
      if (q.bottle) { notify('An empty bottle. The song is yours now.'); return true; }
      q.bottle = true; giveOrDrop('coins', 40, player.x, player.y); burst(tc(tx), tc(ty), '#7ec8ff', 16, 80);
      say("A bottle in the sand, corked with wax. Inside: forty coins and a scrap of a sea shanty. 'Oh the gulls they cry and the salt runs dry, and old Harl rows till the day I die...'", 'The Voice'); save();
      return true;
    }
    if (t === B_STRONGBOX) {
      const q = bq();
      if (q.strongbox) { notify('The strongbox is empty. Iron-banded, and iron-empty.'); return true; }
      const alive = wreckGoblins().filter(m => !m.dead).length;
      if (alive > 0) { notify(`The strongbox is chained shut. ${alive} wreck goblin${alive === 1 ? '' : 's'} still guard${alive === 1 ? 's' : ''} it.`); return true; }
      q.strongbox = true;
      for (const [id, n] of [['iron_battleaxe', 1], ['coins', 120], ['steel_bar', 3]]) giveOrDrop(id, n, player.x, player.y);
      burst(tc(tx), tc(ty), '#f5c542', 24, 110); levelBanner = { text: 'STRONGBOX OPENED', sub: 'Ironclad Isle', t: 3 };
      say('The chain falls away. Inside: an iron battleaxe wrapped in oilcloth, three steel bars, and a purse of goblin coin.', 'The Voice'); save();
      return true;
    }
    if (t === B_HULL) { notify('A goblin hull, banded in iron. It sailed exactly once.'); return true; }
    if (t === B_BOAT) { notify("Harl's boat. Talk to Harl to sail."); return true; }
    if (t === B_PALM) { notify('A palm. The coconuts are out of reach.'); return true; }
    if (t === B_SEAROCK) { notify('A rock in the sea. The gulls own it.'); return true; }
    return false;
  });

  // ---------- update: the crossing, and the lobster pot ----------
  HOOKS.update.push(dt => {
    const q = bq();
    // Harl rows home if the knight leaves an island without him (died there, hovered off, an old save): nobody is stranded at an empty dock
    if (!q.sailing && !player.dead && q.where !== 'dock' && LOC[q.where] && !atMoor(LOC[q.where])) { q.where = 'dock'; save(); }
    if (q.sailing) {
      const s = q.sailing;
      if (typeof s.fx !== 'number') { arrive(); return; }
      player.x = s.fx; player.y = s.fy; player.action = null; player.moving = false;
      if (panel !== 'sailing') openPanel('sailing');
      s.t += dt;
      if (s.t >= SAIL_T) arrive();
      return;
    }
    const a = player.action;
    if (!a || a.type !== 'lobster' || a.t < a.need) return;
    if (tileAt(a.tx, a.ty) !== B_LOBSTER) { player.action = null; return; }
    const lv = skillLv('fishing'); const chance = Math.min(0.9, 0.55 + (lv - 25) * 0.02);
    player.action = { ...a, t: 0 };
    burst(tc(a.tx), tc(a.ty), '#bfe3ff', 8, 50);
    if (Math.random() > chance) return;
    giveOrDrop('raw_lobster', 1, player.x, player.y); gainXp('fishing', 90);
    if (!canFit('raw_lobster', 1)) player.action = null;
    save();
  });

  // ---------- panels ----------
  HOOKS.panel.sailing = () => { }; // blocks movement and use while the crossing overlay (HOOKS.hud) plays
  HOOKS.panel.ferry = (g, narrow) => {
    const q = bq(); const here = q.where;
    const { px, py, w, h } = panelBox(g, 460, 400, "Old Harl's Ferry", `${coins()} coins · you are at ${LOC[here].name}`);
    const dests = ['gull', 'ironclad', 'farshore', 'dock'].filter(k => k !== here);
    let y = py + 64;
    for (const k of dests) {
      const L = LOC[k]; const price = k === 'dock' ? 0 : L.price; const gated = L.combat && combatLevel() < L.combat;
      roundRect(g, px + 18, y, w - 36, 60, 8); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill();
      g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(k === 'dock' ? 'Back to the dock' : L.name, px + 30, y + 22);
      g.fillStyle = gated ? '#ff9a9a' : '#8b949e'; g.font = '11px sans-serif';
      let sub = gated ? `Needs combat level ${L.combat}. You are ${combatLevel()}.` : L.blurb; while (g.measureText(sub).width > w - 66 - (narrow ? 0 : 190) && sub.length > 8) sub = sub.slice(0, -2) + '…'; g.fillText(sub, px + 30, y + 44);
      const label = k === 'dock' ? 'Back to the dock · free' : `${L.name} · ${price} coins`;
      button(g, narrow ? px + 18 : px + w - 208, narrow ? y + 30 : y + 15, narrow ? w - 36 : 190, 30, label, () => sail(k), gated ? '#5a3a3a' : coins() >= price ? '#238636' : '#2a2f3a');
      y += 68;
    }
    button(g, px + 18, py + h - 50, w - 36, 34, 'Stay', closePanel, '#21262d');
  };
  HOOKS.panel.pete = (g, narrow) => {
    const shop = PETE_SHOP; const cols = narrow ? 5 : 10, size = 40, gap = 5;
    const { px, py, w } = panelBox(g, cols * (size + gap) + 30, 200 + shop.stock.length * 38 + Math.ceil(INV_SLOTS / cols) * (size + gap), shop.name, `${coins()} coins · buy on the left, tap your pack to sell`);
    shop.stock.forEach(([id, price], i) => {
      const y = py + 62 + i * 38; const def = ITEMS[id]; const can = coins() >= price;
      roundRect(g, px + 18, y, w - 36, 32, 8); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill();
      drawItemIcon(g, id, px + 38, y + 16, 18);
      g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(def.name, px + 58, y + 20);
      if (!narrow) { g.fillStyle = '#8b949e'; g.font = '11px sans-serif'; g.fillText(itemBlurb(def), px + 190, y + 20); }
      button(g, px + w - 120, y + 3, 96, 26, `Buy ${price}`, () => { if (!payCoins(price)) { notify('Not enough coins.'); return; } if (addItem(id, 1) > 0) { addItem('coins', price); notify('Your pack is full.'); return; } floatText(player.x, player.y - 30, `Bought ${def.name}`, def.color); save(); }, can ? '#238636' : '#2a2f3a', can);
    });
    const gy = py + 62 + shop.stock.length * 38 + 12;
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText('PETE BUYS FISH AT FULL PRICE: shrimp, trout, lobster (raw or cooked)', px + 18, gy);
    drawInvGrid(g, px + 18, gy + 8, cols, size, gap, i => {
      const s = player.inv[i]; if (!s || s.id === 'coins') return;
      if (!shop.buys.includes(s.id)) { notify('Pete only buys fish. Shrimp, trout, lobster. Raw or cooked.'); return; }
      const price = Math.max(1, ITEMS[s.id].value); s.qty -= 1; if (s.qty <= 0) player.inv[i] = null; addItem('coins', price); floatText(player.x, player.y - 30, `+${price} coins`, '#ffd166'); save();
    });
  };

  // ---------- drawing ----------
  function drawGull(g, x, y, s = 1, flap = 0) {
    g.strokeStyle = '#e6edf3'; g.lineWidth = 1.6 * s; g.lineCap = 'round'; g.beginPath();
    g.moveTo(x - 8 * s, y + 2 * s); g.quadraticCurveTo(x - 4 * s, y - 4 * s - flap, x, y); g.quadraticCurveTo(x + 4 * s, y - 4 * s - flap, x + 8 * s, y + 2 * s); g.stroke();
  }
  function drawBoatSide(g, s, dir) { // the crossing: seen from the side
    g.save(); g.scale(s * dir, s);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 22, 46, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#6b4a2a'; g.beginPath(); g.moveTo(-44, -2); g.quadraticCurveTo(-30, 20, 0, 20); g.quadraticCurveTo(30, 20, 46, -6); g.lineTo(40, -2); g.lineTo(-40, -2); g.closePath(); g.fill();
    g.strokeStyle = '#4a3218'; g.lineWidth = 1.2; for (const oy of [4, 10, 15]) { g.beginPath(); g.moveTo(-36 + (oy - 4) * 1.2, oy); g.lineTo(36 - (oy - 4) * 0.9, oy); g.stroke(); }
    g.fillStyle = '#8a5a2b'; g.fillRect(-42, -5, 84, 4);
    g.fillStyle = '#5a3a1e'; g.fillRect(-3, -60, 4, 58); // mast
    g.fillStyle = '#efe6d4'; g.beginPath(); g.moveTo(2, -58); g.quadraticCurveTo(34 + Math.sin(time * 4) * 3, -36, 30, -8); g.lineTo(2, -8); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1; g.beginPath(); g.moveTo(2, -40); g.lineTo(22, -22); g.stroke();
    g.fillStyle = '#c0504d'; g.beginPath(); g.moveTo(-1, -60); g.lineTo(-12, -56); g.lineTo(-1, -52); g.closePath(); g.fill();
    // Harl at the oars
    g.save(); g.translate(-14, -12); g.scale(0.9, 0.9); drawHuman(g, { facing: { x: dir, y: 0 }, hurtT: 0, attackT: 0 }, { tunic: '#3f4f3a', hair: '#d9d0c0', beard: true, helm: '#7a3b2e', shoulder: '#2f3a2c' }); g.restore();
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -6); g.lineTo(-30 - Math.sin(time * 3) * 6, 18); g.stroke();
    // the knight, sitting in the bow
    g.save(); g.translate(20, -12); g.scale(0.9, 0.9); drawHuman(g, { facing: { x: dir, y: 0 }, hurtT: 0, attackT: 0 }, playerLook()); g.restore();
    g.restore();
  }
  function drawBoatProp(g, tx, ty, L) { // moored at a dock: seen from above, bobbing
    const cx = tc(tx), cy = tc(ty), bob = Math.sin(time * 2 + tx) * 2, dir = L && L.face.x < 0 ? 1 : -1; // bow points away from the pier
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(cx, cy + 3, 27, 14, 0, 0, 7); g.fill();
    g.save(); g.translate(cx, cy + bob); g.scale(dir, 1);
    g.fillStyle = '#5a3a1e'; g.beginPath(); g.moveTo(-22, -9); g.quadraticCurveTo(6, -13, 24, 0); g.quadraticCurveTo(6, 13, -22, 9); g.quadraticCurveTo(-27, 0, -22, -9); g.closePath(); g.fill();
    g.fillStyle = '#a5763f'; g.beginPath(); g.moveTo(-19, -6); g.quadraticCurveTo(6, -9, 18, 0); g.quadraticCurveTo(6, 9, -19, 6); g.quadraticCurveTo(-23, 0, -19, -6); g.closePath(); g.fill();
    g.fillStyle = '#6b4a2a'; g.fillRect(-14, -6, 4, 12); g.fillRect(-2, -7, 4, 14); g.fillRect(9, -5, 3, 10); // thwarts
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-4, -8); g.lineTo(-12, -18); g.moveTo(-4, 8); g.lineTo(-12, 18); g.stroke(); // shipped oars
    g.fillStyle = '#4a3218'; g.beginPath(); g.arc(-2, 0, 2.5, 0, 7); g.fill();
    g.fillStyle = '#efe6d4'; g.beginPath(); g.moveTo(-2, -2); g.lineTo(-2, -34); g.quadraticCurveTo(12 + Math.sin(time * 3 + tx) * 2, -22, 8, -4); g.closePath(); g.fill(); // sail, furled loose
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2, -34); g.lineTo(-2, -2); g.stroke();
    g.fillStyle = '#c0504d'; g.beginPath(); g.moveTo(-2, -36); g.lineTo(-10, -33); g.lineTo(-2, -30); g.closePath(); g.fill();
    g.restore();
    // mooring rope back to the pier
    if (L) { const px = tc(L.harl.x) + (tx > L.harl.x ? 24 : -24), py = tc(ty) + 4; g.strokeStyle = '#c9b676'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - dir * 22, cy + bob + 4); g.quadraticCurveTo((cx + px) / 2, py + 10, px, py); g.stroke(); }
    if (dist(player.x, player.y, cx, cy) < 260) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText("Harl's boat", cx, cy - 42); g.fillStyle = '#ffe9a8'; g.fillText("Harl's boat", cx, cy - 42); }
  }
  function drawDock(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    const N = WET.has(tileAt(tx, ty - 1)), S = WET.has(tileAt(tx, ty + 1)), W = WET.has(tileAt(tx - 1, ty)), E = WET.has(tileAt(tx + 1, ty));
    g.fillStyle = 'rgba(0,0,0,0.28)'; if (S) g.fillRect(x, y + TILE - 2, TILE, 6); if (E) g.fillRect(x + TILE - 2, y, 6, TILE); if (N) g.fillRect(x, y - 3, TILE, 4); if (W) g.fillRect(x - 3, y, 4, TILE);
    const rope = (ax, ay, bx, by) => { g.strokeStyle = '#c9b676'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 6, bx, by); g.stroke(); };
    if (N) rope(x + 5, y + 4, x + TILE - 5, y + 4); if (S) rope(x + 5, y + TILE - 4, x + TILE - 5, y + TILE - 4);
    if (W) rope(x + 4, y + 5, x + 4, y + TILE - 5); if (E) rope(x + TILE - 4, y + 5, x + TILE - 4, y + TILE - 5);
    const post = (px, py) => { g.fillStyle = '#4a3218'; g.fillRect(px - 4, py - 16, 8, 20); g.fillStyle = '#8a5a2b'; g.fillRect(px - 4, py - 16, 3, 20); g.fillStyle = '#3a2612'; g.beginPath(); g.ellipse(px, py - 16, 4, 2, 0, 0, 7); g.fill(); };
    if (N || W) post(x + 5, y + 6); if (N || E) post(x + TILE - 5, y + 6); if (S || W) post(x + 5, y + TILE - 2); if (S || E) post(x + TILE - 5, y + TILE - 2);
  }
  function drawLantern(g, tx, ty) {
    const x = tx * TILE + TILE - 5, y = ty * TILE + 6, gl = 0.75 + Math.sin(time * 5 + tx) * 0.15;
    g.fillStyle = '#3a2612'; g.fillRect(x - 3, y - 40, 6, 26); g.fillRect(x - 3, y - 42, 12, 3);
    g.fillStyle = '#2a2a30'; g.fillRect(x + 5, y - 40, 9, 12);
    g.fillStyle = `rgba(255,190,80,${gl})`; g.fillRect(x + 6.5, y - 38.5, 6, 9); g.fillStyle = `rgba(255,240,180,${gl})`; g.fillRect(x + 8, y - 36, 3, 4);
    const gr = g.createRadialGradient(x + 9, y - 34, 3, x + 9, y - 34, 50); gr.addColorStop(0, 'rgba(255,190,80,0.28)'); gr.addColorStop(1, 'rgba(255,190,80,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x + 9, y - 34, 50, 0, 7); g.fill();
  }
  function drawSeaRock(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)];
    for (let k = 0; k < 3; k++) { const ph = (time * 0.8 + k * 0.33 + v * 0.1) % 1; g.strokeStyle = `rgba(230,245,255,${0.55 * (1 - ph)})`; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, cy + 4, 16 + ph * 12, 9 + ph * 7, 0, 0, 7); g.stroke(); }
    const pts = [[-16, 6], [-13, -6], [-4, -12], [7, -11], [15, -3], [13, 8], [2, 12], [-9, 11]];
    g.fillStyle = ['#4a4d55', '#525560', '#454850'][v]; g.beginPath(); for (const [x, y] of pts) g.lineTo(cx + x * 0.9, cy + y * 0.8); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.moveTo(cx - 9, cy - 5); g.lineTo(cx - 2, cy - 10); g.lineTo(cx + 5, cy - 8); g.lineTo(cx - 3, cy - 3); g.closePath(); g.fill();
    g.fillStyle = 'rgba(240,250,255,0.7)'; for (const [ox, oy] of [[-14, 8], [12, 9], [-2, 13]]) { g.beginPath(); g.ellipse(cx + ox, cy + oy, 4, 1.8, 0, 0, 7); g.fill(); }
    if (v === 1) drawGull(g, cx + 2, cy - 14, 0.8);
  }
  function drawPalm(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)], lean = (v - 1) * 8, sway = Math.sin(time * 1.5 + tx) * 2;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx + 4, cy + 14, 16, 6, 0, 0, 7); g.fill();
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy + 12); g.quadraticCurveTo(cx + 14 + lean, cy - 12, cx + lean + sway, cy - 34); g.stroke();
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 1.5; for (let k = 1; k < 6; k++) { const t = k / 6, px = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * (cx + 14 + lean) + t * t * (cx + lean + sway), py = (1 - t) * (1 - t) * (cy + 12) + 2 * (1 - t) * t * (cy - 12) + t * t * (cy - 34); g.beginPath(); g.moveTo(px - 4, py); g.lineTo(px + 4, py); g.stroke(); }
    const top = { x: cx + lean + sway, y: cy - 36 };
    g.lineWidth = 4.5; g.lineCap = 'round';
    for (let k = 0; k < 7; k++) { const a = -Math.PI + k * (Math.PI / 6) + Math.sin(time * 1.5 + k) * 0.05; g.strokeStyle = k % 2 ? '#2f8a3a' : '#3ea54a'; g.beginPath(); g.moveTo(top.x, top.y); g.quadraticCurveTo(top.x + Math.cos(a) * 16, top.y + Math.sin(a) * 16 - 6, top.x + Math.cos(a) * 26, top.y + Math.sin(a) * 14 + 10); g.stroke(); }
    g.fillStyle = '#6b4a2a'; for (const [ox, oy] of [[-4, 2], [3, 3], [0, -3]]) { g.beginPath(); g.arc(top.x + ox, top.y + oy, 3, 0, 7); g.fill(); }
  }
  function drawBuoy(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), bob = Math.sin(time * 2.2 + tx * 0.7 + ty) * 2;
    const ph = (time * 0.6 + tx * 0.2) % 1; g.strokeStyle = `rgba(230,245,255,${0.5 * (1 - ph)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy + 6, 10 + ph * 14, 5 + ph * 7, 0, 0, 7); g.stroke();
    g.strokeStyle = '#c9b676'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy + bob + 4); g.quadraticCurveTo(cx + 8, cy + 12, cx + 4, cy + 18); g.stroke();
    g.fillStyle = '#c0504d'; g.beginPath(); g.arc(cx, cy + bob, 9, 0, 7); g.fill();
    g.fillStyle = '#f2f2ec'; g.beginPath(); g.ellipse(cx, cy + bob - 1, 9, 3, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + bob + 5, 9, 3.5, 0, 0, 7); g.fill();
    g.fillStyle = '#3a2612'; g.fillRect(cx - 1, cy + bob - 20, 2, 12); g.fillStyle = '#ffe066'; g.beginPath(); g.moveTo(cx + 1, cy + bob - 20); g.lineTo(cx + 9, cy + bob - 17); g.lineTo(cx + 1, cy + bob - 14); g.closePath(); g.fill();
  }
  function drawBottle(g, tx, ty, taken) {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(cx, cy + 10, 14, 5, 0, 0, 7); g.fill();
    g.save(); g.translate(cx, cy + 4); g.rotate(-0.9);
    g.fillStyle = 'rgba(126,200,255,0.75)'; roundRect(g, -7, -14, 14, 26, 5); g.fill(); g.fillRect(-3.5, -20, 7, 8);
    g.fillStyle = '#c9a36a'; g.fillRect(-3, -23, 6, 5);
    if (!taken) { g.fillStyle = '#efe6d4'; g.fillRect(-4, -8, 8, 14); g.strokeStyle = '#8a6a3a'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2, -4); g.lineTo(2, -4); g.moveTo(-2, 0); g.lineTo(2, 0); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-5, -12, 2, 20);
    g.restore();
    if (!taken) { g.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(time * 4) * 0.4})`; g.beginPath(); g.arc(cx + 10, cy - 12, 2, 0, 7); g.fill(); }
  }
  function drawHull(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty) + 10;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx + 6, cy + 12, 50, 12, 0, 0, 7); g.fill();
    g.save(); g.translate(cx, cy); g.rotate(-0.12);
    g.fillStyle = '#4a3a2a'; g.beginPath(); g.moveTo(-50, -30); g.quadraticCurveTo(-40, 14, 0, 14); g.quadraticCurveTo(40, 14, 52, -22); g.lineTo(46, -28); g.lineTo(-44, -26); g.closePath(); g.fill();
    g.strokeStyle = '#2f2418'; g.lineWidth = 1.5; for (const oy of [-18, -8, 2]) { g.beginPath(); g.moveTo(-42 + (oy + 18) * 0.7, oy); g.lineTo(44 - (oy + 18) * 0.6, oy); g.stroke(); }
    g.fillStyle = '#6e7178'; for (const ox of [-28, -4, 22]) { g.beginPath(); g.moveTo(ox - 4, -30); g.lineTo(ox + 4, -30); g.lineTo(ox + 6, 12); g.lineTo(ox - 2, 12); g.closePath(); g.fill(); g.fillStyle = '#3a3a42'; for (const oy of [-24, -12, 0]) { g.beginPath(); g.arc(ox + 1, oy, 1.6, 0, 7); g.fill(); } g.fillStyle = '#6e7178'; }
    g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(30, -12); g.lineTo(48, -6); g.lineTo(40, 6); g.closePath(); g.fill(); // the hole that sank it
    g.fillStyle = '#5a3a1e'; g.save(); g.translate(-10, -30); g.rotate(0.55); g.fillRect(-3, -52, 6, 54); g.restore();
    g.fillStyle = '#5a9a33'; g.save(); g.translate(-10, -30); g.rotate(0.55); g.beginPath(); g.moveTo(3, -50); g.lineTo(26 + Math.sin(time * 5) * 3, -44); g.lineTo(3, -36); g.closePath(); g.fill(); g.restore();
    g.restore();
  }
  function drawStrongbox(g, tx, ty, opened) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 8, y + 38, 34, 6);
    g.fillStyle = '#5a5d64'; g.fillRect(x + 8, y + 14, 32, 24); g.fillStyle = opened ? '#1e1e24' : '#6e7178'; g.fillRect(x + 8, y + 10, 32, 12);
    g.fillStyle = '#3a3a42'; g.fillRect(x + 8, y + 10, 32, 3); g.fillRect(x + 8, y + 22, 32, 3); g.fillRect(x + 12, y + 10, 4, 28); g.fillRect(x + 32, y + 10, 4, 28);
    if (!opened) { g.strokeStyle = '#8f96a3'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 6, y + 18); g.lineTo(x + 42, y + 30); g.moveTo(x + 6, y + 30); g.lineTo(x + 42, y + 18); g.stroke(); g.fillStyle = '#f5c542'; roundRect(g, x + 20, y + 20, 8, 9, 2); g.fill(); g.strokeStyle = '#f5c542'; g.lineWidth = 2; g.beginPath(); g.arc(x + 24, y + 19, 3, Math.PI, 0); g.stroke(); }
    else { g.fillStyle = '#6e7178'; g.fillRect(x + 8, y + 2, 32, 8); g.fillStyle = '#3a3a42'; g.fillRect(x + 8, y + 2, 32, 2); }
    g.strokeStyle = '#2a2a30'; g.lineWidth = 1; g.strokeRect(x + 8, y + 10, 32, 28);
  }
  function drawSeaFolk(g, who, px, py, look, hat) {
    const e = { x: px, y: py, r: 13, facing: who.facing, hurtT: 0, attackT: 0, moving: false, walkT: 0 };
    const near = dist(player.x, player.y, e.x, e.y) < 110;
    if (near) e.facing = { x: Math.sign(player.x - e.x) || 0, y: Math.sign(player.y - e.y) || 1 };
    g.save(); g.translate(e.x, e.y);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 11, 12, 6, 0, 0, 7); g.fill();
    drawHuman(g, e, look);
    if (hat === 'wool') { g.fillStyle = '#d9d0c0'; g.beginPath(); g.ellipse(0, 0, 5.5, 6, 0, 0, Math.PI); g.fill(); g.fillStyle = '#c9a36a'; g.beginPath(); g.arc(0, -19, 2.6, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 2; g.beginPath(); g.arc(-3, 3, 9, 2.6, 4.2); g.stroke(); }
    if (hat === 'straw') { g.fillStyle = '#d9c88a'; g.beginPath(); g.ellipse(0, -12, 14, 4.5, 0, 0, 7); g.fill(); g.beginPath(); g.arc(0, -13, 8, Math.PI, 0); g.fill(); g.fillStyle = '#8a6a3a'; g.fillRect(-8, -14, 16, 2); }
    g.restore();
    if (near) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(who.name, e.x, e.y - 28); g.fillStyle = '#ffe9a8'; g.fillText(who.name, e.x, e.y - 28); }
  }
  const HARL_LOOK = { tunic: '#3f4f3a', hair: '#d9d0c0', beard: true, helm: '#7a3b2e', shoulder: '#2f3a2c' };
  const PETE_LOOK = { tunic: '#8a7a5a', hair: '#e0d8c0', beard: true, shoulder: '#6a5a4a' };
  const B_USABLE = [B_LOBSTER, B_BOTTLE, B_STRONGBOX, B_HULL, B_BOAT, B_PALM, B_SEAROCK];
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE));
    if (x1 < SEA.x0 - 2 && x1 < HUT.x) return; // nothing of ours is on screen west of the shore
    const q = bq();
    for (let ty = y0; ty <= y1 + 2; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === B_DOCK) items.push({ y: ty * TILE + TILE - 2, draw: () => drawDock(g, tx, ty) });
      else if (t === B_BOAT) { const L = Object.values(LOC).find(l => l.boat.x === tx && l.boat.y === ty); items.push({ y: ty * TILE + TILE - 6, draw: () => drawBoatProp(g, tx, ty, L) }); }
      else if (t === B_SEAROCK) items.push({ y: ty * TILE + TILE - 6, draw: () => drawSeaRock(g, tx, ty) });
      else if (t === B_PALM) items.push({ y: ty * TILE + TILE - 4, draw: () => drawPalm(g, tx, ty) });
      else if (t === B_LOBSTER) items.push({ y: ty * TILE + TILE - 6, draw: () => drawBuoy(g, tx, ty) });
      else if (t === B_BOTTLE) items.push({ y: ty * TILE + TILE - 6, draw: () => drawBottle(g, tx, ty, q.bottle) });
      else if (t === B_HULL) items.push({ y: ty * TILE + TILE + 6, draw: () => drawHull(g, tx, ty) });
      else if (t === B_STRONGBOX) items.push({ y: ty * TILE + TILE - 6, draw: () => drawStrongbox(g, tx, ty, q.strongbox) });
    }
    for (const k in LOC) { const L = LOC[k]; if (L.lantern.x >= x0 && L.lantern.x <= x1 && L.lantern.y >= y0 - 1 && L.lantern.y <= y1 + 1) items.push({ y: L.lantern.y * TILE + TILE - 1, draw: () => drawLantern(g, L.lantern.x, L.lantern.y) }); }
    if (!q.sailing) { const p = harlPos(); if (p.x > cam.x - 60 && p.x < cam.x + VW + 60 && p.y > cam.y - 60 && p.y < cam.y + VH + 60) items.push({ y: p.y + 13, draw: () => drawSeaFolk(g, HARL, p.x, p.y, HARL_LOOK, 'wool') }); }
    if (PETE.px > cam.x - 60 && PETE.px < cam.x + VW + 60 && PETE.py > cam.y - 60 && PETE.py < cam.y + VH + 60) items.push({ y: PETE.py + 13, draw: () => drawSeaFolk(g, PETE, PETE.px, PETE.py, PETE_LOOK, 'straw') });
    // the pot on its rope while lobstering (the core only animates its own actions)
    const a = player.action;
    if (a && a.type === 'lobster' && !player.dead) items.push({ y: player.y + player.r + 0.01, draw: () => {
      const ex = tc(a.tx), ey = tc(a.ty), bob = Math.sin(time * 3) * 2;
      g.strokeStyle = '#c9b676'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(player.x + player.facing.x * 10, player.y - 4); g.quadraticCurveTo((player.x + ex) / 2, (player.y + ey) / 2 + 8, ex, ey + 6 + bob); g.stroke();
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.ellipse(ex, ey + 8 + bob, 8, 4, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(ex - 8, ey + 8 + bob); g.lineTo(ex - 6, ey + 14 + bob); g.lineTo(ex + 6, ey + 14 + bob); g.lineTo(ex + 8, ey + 8 + bob); g.stroke();
    } });
    // gulls over the grey water
    if (cam.x + VW > SEA.x0 * TILE) for (let k = 0; k < 3; k++) {
      const gx = tc(170 + k * 9) + Math.cos(time * 0.35 + k * 2.1) * 160, gy = tc(20 + k * 26) + Math.sin(time * 0.5 + k) * 70;
      if (gx < cam.x - 20 || gx > cam.x + VW + 20 || gy < cam.y - 20 || gy > cam.y + VH + 20) continue;
      items.push({ y: 1e9 - 5, draw: () => drawGull(g, gx, gy, 1.2, Math.sin(time * 6 + k) * 3) });
    }
    // interaction highlight for our own folk and tiles (the core only highlights what it knows)
    if (!player.dead && !player.mech && !q.sailing) items.push({ y: 1e9 + 1, draw: () => {
      const c = seaFolkInFront();
      if (c) { g.strokeStyle = 'rgba(255,233,168,0.7)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(c.px, c.py, 20, 0, 7); g.stroke(); g.setLineDash([]); return; }
      const { tx, ty } = frontTile(player);
      if (B_USABLE.includes(tileAt(tx, ty))) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });
  // the crossing: a full-screen overlay while Harl rows
  HOOKS.hud.push((g, narrow) => {
    const s = bq().sailing; if (!s) return;
    const p = clamp(s.t / SAIL_T, 0, 1), dir = s.to === 'dock' ? -1 : 1;
    const fade = clamp(Math.min(p * 10, (1 - p) * 10), 0, 1);
    g.save(); g.globalAlpha = fade;
    const hz = VH * 0.42;
    const sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#070c18'); sky.addColorStop(1, '#16304f'); g.fillStyle = sky; g.fillRect(0, 0, VW, hz);
    const sea = g.createLinearGradient(0, hz, 0, VH); sea.addColorStop(0, '#123b66'); sea.addColorStop(1, '#0a2242'); g.fillStyle = sea; g.fillRect(0, hz, VW, VH - hz);
    g.fillStyle = '#e8e6d8'; g.beginPath(); g.arc(VW * 0.78, hz * 0.4, 18, 0, 7); g.fill(); g.fillStyle = '#16304f'; g.beginPath(); g.arc(VW * 0.78 + 8, hz * 0.4 - 5, 15, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 24; k++) { g.beginPath(); g.arc(((k * 137) % VW), (k * 53) % (hz * 0.8), 1 + (k % 3) * 0.4, 0, 7); g.fill(); }
    g.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const y = hz + 14 + k * (VH - hz) / 9; g.strokeStyle = `rgba(200,230,255,${0.12 + k * 0.03})`; g.lineWidth = 1.5 + k * 0.2; g.beginPath();
      for (let x = -20; x <= VW + 20; x += 12) { const yy = y + Math.sin(x * 0.03 + time * 2 + k) * (3 + k) ; if (x === -20) g.moveTo(x, yy); else g.lineTo(x, yy); } g.stroke();
    }
    const bx = dir > 0 ? lerp(-140, VW + 140, p) : lerp(VW + 140, -140, p), by = VH * 0.62 + Math.sin(time * 2.5) * 5;
    g.save(); g.translate(bx, by); g.rotate(Math.sin(time * 2.5 + 1) * 0.05); drawBoatSide(g, narrow ? 1.4 : 2, dir); g.restore();
    g.strokeStyle = 'rgba(230,245,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx - dir * 90, by + 40); g.quadraticCurveTo(bx - dir * 200, by + 44 + Math.sin(time * 3) * 4, bx - dir * 320, by + 36); g.stroke();
    for (let k = 0; k < 4; k++) { const gx = ((VW * 0.15 + k * VW * 0.23 + time * 28 * (k % 2 ? 1 : -1)) % (VW + 60) + VW + 60) % (VW + 60) - 30, gy = hz * 0.55 + Math.sin(time * 2.2 + k * 1.7) * 14 + k * 9; drawGull(g, gx, gy, 1.3, Math.sin(time * 7 + k) * 3); }
    g.fillStyle = '#e6edf3'; g.font = `800 ${narrow ? 22 : 30}px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.7)';
    const title = `SAILING TO ${(s.to === 'dock' ? 'THE DOCK' : LOC[s.to].name).toUpperCase()}`; g.strokeText(title, VW / 2, VH * 0.2); g.fillText(title, VW / 2, VH * 0.2);
    g.font = '13px sans-serif'; g.fillStyle = '#c9a36a'; g.strokeText('Old Harl rows. The gulls follow.', VW / 2, VH * 0.2 + 22); g.fillText('Old Harl rows. The gulls follow.', VW / 2, VH * 0.2 + 22);
    g.restore();
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    h.peace(true);
    const q = bq();
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const makeRoom = n => { for (let i = INV_SLOTS - 1; i >= 0 && player.inv.filter(s => !s).length < n; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && bankAdd(s.id, s.qty)) player.inv[i] = null; } };
    const talkHarl = () => { const L = LOC[q.where]; const a = F.goAdjacent(L.harl.x, L.harl.y, 2500); F.face(L.harl.x, L.harl.y); closePanel(); drain(); F.press('KeyE'); F.sim(2, []); return a; };
    // the sea
    { let water = 0, total = 0; for (let y = SEA.y0; y <= SEA.y1; y++) for (let x = SEA.x0; x <= SEA.x1; x++) { total++; if (tileAt(x, y) === T.WATER) water++; }
      check('boats: the Grey Sea fills the east strip (water, a sandy shore, two islands)', regionAt(190, 30).name === 'The Grey Sea' && tileAt(190, 30) === T.WATER && water / total > 0.6 && tileAt(162, 40) === T.SAND && regionAt(178, 13).name === 'Gull Isle' && tileAt(178, 13) === T.SAND && regionAt(187, 50).name === 'Ironclad Isle' && tileAt(187, 50) === T.DIRT, { water, total, shore: tileAt(162, 40) }); }
    { const path = F.bfs(141, 32, LOC.dock.land.x, LOC.dock.land.y); check("boats: the road from Thistledown's east gate to the dock is walkable", !!path && path.length > 30, { len: path && path.length }); }
    { q.sailing = null; q.where = 'dock'; const p = harlPos(); check('boats: Old Harl waits on the dock, his boat moored at the end', p.x === tc(165) && p.y === tc(14) && tileAt(165, 14) === B_DOCK && tileAt(167, 14) === B_BOAT && tileAt(164, 14) === B_DOCK, { tx: p.x / TILE, ty: p.y / TILE }); }
    // walk the road, talk to Harl
    { F.tp(141, 32); const w = F.walkTo(LOC.dock.land.x, LOC.dock.land.y, 3000); const a = talkHarl();
      check('boats: walk the road to the dock; E on Harl opens the ferry panel', typeof w === 'number' && typeof a === 'number' && panel === 'ferry' && dialog.queue.concat(dialog.cur || []).some(d => d.who === 'Old Harl'), { w, a, panel, region: player.region }); }
    // Gull Isle, ten coins
    { makeRoom(4); h.give('coins', 100); const c0 = coins(); render(); const sx = player.x, sy = player.y; const c = F.clickButton('Gull'); const sailing = !!q.sailing && q.sailing.to === 'gull' && panel === 'sailing'; F.sim(20, ['KeyD']); const pinned = player.x === sx && player.y === sy && !!q.sailing; F.sim(130, []);
      check('boats: Gull Isle costs 10 coins; input is ignored during the crossing; you land on Gull Isle', c && sailing && pinned && coins() === c0 - 10 && !q.sailing && q.where === 'gull' && q.visited.gull && player.region === 'Gull Isle' && Math.floor(player.x / TILE) === LOC.gull.land.x && Math.floor(player.y / TILE) === LOC.gull.land.y && panel === null, { c, sailing, pinned, paid: c0 - coins(), where: q.where, region: player.region, panel }); }
    // lobster: pot, then Fishing 25
    const lob = F.nearestTile([B_LOBSTER]);
    { const stash = []; for (let i = 0; i < INV_SLOTS; i++) { const s = player.inv[i]; if (s && ITEMS[s.id].tool === 'pot') { stash.push(s); player.inv[i] = null; } }
      const a = F.goAdjacent(lob.x, lob.y, 1500); F.face(lob.x, lob.y); F.press('KeyE'); F.sim(2, []); const noPot = !player.action && notice && /pot/.test(notice.text);
      check('boats: lobster grounds need a lobster pot', typeof a === 'number' && noPot, { a, notice: notice && notice.text, lob }); for (const s of stash) addItem(s.id, s.qty); }
    // Salt Pete sells the pot and buys fish at full price
    { makeRoom(3); h.give('coins', 100); const cp = coins(); const a = F.goAdjacent(PETE_T.x, PETE_T.y, 1500); F.face(PETE_T.x, PETE_T.y); drain(); F.press('KeyE'); F.sim(2, []); const open = panel === 'pete'; const bought = F.clickButton('Buy 60');
      h.give('raw_shrimp', 1); render(); const slot = player.inv.findIndex(s => s && s.id === 'raw_shrimp'); const sold = slot >= 0 && F.clickButton('slot' + slot); closePanel();
      check('boats: Salt Pete sells a lobster pot for 60 and buys fish at full price', typeof a === 'number' && open && bought && sold && countItem('lobster_pot') >= 1 && hasTool('pot') === 1 && coins() === cp - 60 + ITEMS.raw_shrimp.value && countItem('raw_shrimp') === 0, { a, open, bought, sold, coins: coins() - cp, pots: countItem('lobster_pot') }); }
    { const fx0 = player.skills.fishing.xp; player.skills.fishing.xp = XP_TABLE[24]; const a = F.goAdjacent(lob.x, lob.y, 1500); F.face(lob.x, lob.y); F.press('KeyE'); F.sim(2, []); const lowLv = !player.action && notice && /Fishing level 25/.test(notice.text);
      check('boats: lobster needs Fishing 25', typeof a === 'number' && lowLv, { a, notice: notice && notice.text });
      player.skills.fishing.xp = XP_TABLE[25]; makeRoom(2); const n0 = countItem('raw_lobster'), x0 = player.skills.fishing.xp; F.face(lob.x, lob.y); F.press('KeyE'); const started = player.action && player.action.type === 'lobster';
      const steps = F.untilAction(1500, () => countItem('raw_lobster') > n0); player.action = null;
      check('boats: a pot at Fishing 25 catches raw lobster (90 xp); it cooks into lobster (heal 12, 60 coins)', started && typeof steps === 'number' && countItem('raw_lobster') === n0 + 1 && player.skills.fishing.xp === x0 + 90 && ITEMS.raw_lobster.cook === 'lobster' && ITEMS.lobster.heal === 12 && ITEMS.lobster.value === 60, { started, steps, lobsters: countItem('raw_lobster'), xp: player.skills.fishing.xp - x0 });
      player.skills.fishing.xp = Math.max(fx0, player.skills.fishing.xp); }
    // message in a bottle
    { q.bottle = false; const a = F.goAdjacent(BOTTLE_T.x, BOTTLE_T.y, 1500); F.face(BOTTLE_T.x, BOTTLE_T.y); const c0 = coins(); drain(); F.press('KeyE'); F.sim(2, []); const got = coins() === c0 + 40 && q.bottle && dialog.cur && /shanty/.test(dialog.cur.text);
      F.face(BOTTLE_T.x, BOTTLE_T.y); F.press('KeyE'); F.sim(2, []);
      check('boats: the message in a bottle pays 40 coins and a sea shanty, once', typeof a === 'number' && got && coins() === c0 + 40, { a, got, coins: coins() - c0 }); }
    // Ironclad Isle: refused below combat 8, 25 coins above
    const m0 = player.skills.melee.xp, d0 = player.skills.defence.xp, r0 = player.skills.range.xp;
    { player.skills.melee.xp = XP_TABLE[5]; player.skills.defence.xp = XP_TABLE[5]; player.skills.range.xp = 0; recomputeMaxHp(); player.hp = Math.min(player.hp, player.maxHp);
      const a = talkHarl(); const open = panel === 'ferry'; const cbLow = combatLevel(); const c1 = F.clickButton('Ironclad'); F.sim(3, []); const refused = q.where === 'gull' && !q.sailing && notice && /combat level 8/.test(notice.text);
      check('boats: Harl refuses Ironclad Isle below combat level 8', typeof a === 'number' && open && cbLow < 8 && c1 && refused, { a, open, cbLow, c1, notice: notice && notice.text });
      player.skills.melee.xp = XP_TABLE[8]; player.skills.defence.xp = XP_TABLE[8]; recomputeMaxHp(); h.give('coins', 50); const c0 = coins();
      if (panel !== 'ferry') talkHarl(); render(); const c2 = F.clickButton('Ironclad'); const s = !!q.sailing && q.sailing.to === 'ironclad'; F.sim(150, []);
      check('boats: at combat level 8 Ironclad Isle costs 25 coins; first landing gets a Voice line', combatLevel() >= 8 && c2 && s && coins() === c0 - 25 && q.where === 'ironclad' && player.region === 'Ironclad Isle' && q.visited.ironclad && dialog.cur && dialog.cur.who === 'The Voice' && /Ironclad/.test(dialog.cur.text), { cb: combatLevel(), c2, s, paid: c0 - coins(), where: q.where, region: player.region, who: dialog.cur && dialog.cur.who }); }
    // the strongbox and the five wreck goblins
    { const wreck = wreckGoblins(); const alive0 = wreck.filter(m => !m.dead).length; q.strongbox = false; makeRoom(4);
      const a = F.goAdjacent(STRONGBOX_T.x, STRONGBOX_T.y, 2500); F.face(STRONGBOX_T.x, STRONGBOX_T.y); F.press('KeyE'); F.sim(2, []); const refused = !q.strongbox && notice && /goblin/.test(notice.text);
      for (const m of wreck) { m.dead = true; m.deadT = 5; m.respawnT = 9999; }
      const c0 = coins(), sb0 = countItem('steel_bar'), ax0 = countItem('iron_battleaxe'); F.face(STRONGBOX_T.x, STRONGBOX_T.y); F.press('KeyE'); F.sim(2, []);
      const opened = q.strongbox && coins() === c0 + 120 && countItem('steel_bar') === sb0 + 3 && countItem('iron_battleaxe') === ax0 + 1;
      F.face(STRONGBOX_T.x, STRONGBOX_T.y); F.press('KeyE'); F.sim(2, []);
      check('boats: the strongbox refuses while the five wreck goblins live, then gives an iron battleaxe, 120 coins and 3 steel bars, once', wreck.length === 5 && alive0 === 5 && typeof a === 'number' && refused && opened && coins() === c0 + 120 && countItem('steel_bar') === sb0 + 3, { goblins: wreck.length, alive0, a, refused, opened, coins: coins() - c0 }); }
    // home again, for free
    { const a = talkHarl(); const open = panel === 'ferry'; const c0 = coins(); const c = F.clickButton('Back'); F.sim(150, []);
      check("boats: 'Back to the dock' is free and returns you to the mainland dock", typeof a === 'number' && open && c && coins() === c0 && q.where === 'dock' && Math.floor(player.x / TILE) === LOC.dock.land.x && Math.floor(player.y / TILE) === LOC.dock.land.y && harlPos().x === tc(LOC.dock.harl.x), { a, open, c, where: q.where, tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) }); }
    player.skills.melee.xp = m0; player.skills.defence.xp = d0; player.skills.range.xp = r0; recomputeMaxHp(); player.hp = Math.min(player.hp, player.maxHp);
    h.peace(false);
  });
}
