// ============================================================================
// SYLVARIS — the secret elf city hidden in the vast jungle of the south-east,
// Range training at Lira's range, and Thessaly's loom (hover armour).
// Feature file. Registers everything through HOOKS; edits no core file.
// Everything lives in one block so no name leaks into the shared script scope.
// ============================================================================
{
  // ---------- tiles (ids captured locally so a later addTile of the same name cannot move them) ----------
  const EL_JUNGLE = addTile('JUNGLE', { solid: true, tex: 'grass', mini: '#1f5a2a' });      // giant jungle tree (choppable, Woodcutting 15)
  const EL_FERN = addTile('FERN', { tex: 'grass', mini: '#3f8a3a' });                          // ground fern, walk through it
  const EL_TOTEM = addTile('TOTEM', { solid: true, tex: 'dirt', mini: '#6b4a2a' });            // carved-face totem marking the gap
  const EL_PLATFORM = addTile('PLATFORM', { solid: false, tex: 'plank', mini: '#a5763f' });   // hut floor on stilts
  const EL_LEAFWALL = addTile('LEAFWALL', { solid: true, tex: 'grass', mini: '#2f8a3a' });     // woven leaf hut wall
  const EL_BRIDGE = addTile('BRIDGE', { solid: false, tex: 'plank', mini: '#8a6a3a' });       // rope bridge / boardwalk
  const EL_TARGET = addTile('TARGET', { solid: true, tex: 'dirt', mini: '#d9c88a' });          // straw archery target
  const EL_LOOM = addTile('LOOM', { solid: true, tex: 'plank', mini: '#c9a36a' });             // Thessaly's loom
  const EL_LANTERN = addTile('LANTERN', { solid: true, tex: 'grass', mini: '#f5c542' });       // hanging lantern on a pole

  // ---------- geometry ----------
  // Territory: the south-east, x 100–199, y 96–139. Nothing here carves outside it.
  const JR = { x0: 100, y0: 96, x1: 199, y1: 139 };            // The Jungle
  const CR = { x0: 127, y0: 115, x1: 165, y1: 134 };            // Sylvaris (inside the ring wall)
  const RING = { x0: 126, y0: 114, x1: 166, y1: 135 };          // the wall of jungle around the city
  const GAP = { x: 137, y: 114 };                               // the one way in
  const TOTEM_T = { x: 136, y: 114 };                           // the face in the trees, beside the gap
  const PATH = [[141, 96], [141, 101], [136, 105], [132, 109], [133, 112]]; // the dirt path down from Hollowford's south edge
  const RIVER_N = [[177, 97], [170, 101], [163, 106], [157, 110], [152, 113]];
  const RIVER_S = [[141, 136], [130, 137], [116, 137], [103, 136]];
  const riverX0 = ty => 151 - Math.floor((ty - CR.y0) / 2);     // the river inside the city: two tiles wide, drifting west as it goes south
  const QUEEN_HALL = { x0: 129, y0: 117, x1: 136, y1: 122, door: [133, 122] };
  const WEAVER_HUT = { x0: 129, y0: 127, x1: 134, y1: 131, door: [131, 127] };
  const LIRA_LODGE = { x0: 156, y0: 117, x1: 161, y1: 121, door: [158, 121] };
  const ROOST = { x0: 148, y0: 131, x1: 152, y1: 133 };         // sentinels' lookout platform
  const LOOM_T = { x: 130, y: 128 };
  const WALK_Y = 124;                                            // the long boardwalk across the city
  const RANGE = { x0: 154, y0: 126, x1: 162, y1: 130, tx: 163 }; // shooting lane, targets on its east end
  const TARGETS = [[163, 126], [163, 127], [163, 128], [163, 129], [163, 130]];
  const LANTERNS = [[128, 123], [136, 123], [128, 132], [135, 132], [155, 122], [162, 122], [147, 130], [153, 130], [135, 115], [139, 115], [154, 125], [154, 131]];
  const SENTINELS = [[135, 116], [139, 116]];
  const BOARS = [[112, 104], [172, 118], [110, 128]];

  const inRect = (r, tx, ty) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;
  const inJungle = (tx, ty) => inRect(JR, tx, ty);
  const inCity = (tx, ty) => inRect(CR, tx, ty);
  // Inserted just ahead of the catch-all 'The Wilds' rather than at index 0: regionAt still finds them first for
  // these tiles (nothing else covers the south-east) and the dwarves' self-test keeps Deepholm at REGIONS[0].
  {
    const wild = Math.max(0, REGIONS.findIndex(r => r.name === 'The Wilds'));
    REGIONS.splice(wild, 0, { name: 'Sylvaris', sub: 'The city in the trees', x0: CR.x0, y0: CR.y0, x1: CR.x1, y1: CR.y1 },
      { name: 'The Jungle', sub: 'Vast, green, watching', x0: JR.x0, y0: JR.y0, x1: JR.x1, y1: JR.y1 });
  }

  // ---------- items, recipes, shops ----------
  Object.assign(ITEMS, {
    jungle_log: { name: 'Jungle logs', value: 20, color: '#5a3a1e', shape: 'log', burn: 90 },
    elven_arrow: { name: 'Elven arrows', value: 8, color: '#9fe0b0', shape: 'arrow', arrow: { str: 14 } },
    yew_bow: { name: 'Yew bow', value: 260, color: '#7a5a2a', shape: 'bow', weapon: { str: 0, att: 14, cd: 0.55, ranged: true } },
    hover_armour: { name: 'Hover armour', value: 900, color: '#7ec8ff', shape: 'body', armour: { slot: 'body', def: 18 } },
  });
  for (const k of ['jungle_log', 'elven_arrow', 'yew_bow', 'hover_armour']) { ITEMS[k].id = k; ITEMS[k].stack = ITEMS[k].arrow ? 1000 : (ITEMS[k].weapon || ITEMS[k].armour) ? 1 : 50; }
  RECIPES.push({ out: 'hover_armour', qty: 1, needs: [['spider_silk', 10], ['wool', 5], ['mithril_bar', 1]], station: 'loom', skill: 'crafting', lv: 25, xp: 400, label: '10 Silk + 5 Wool + Mithril bar → Hover armour' });
  SHOPS.elf_range = { name: "Lira's Range", stock: [['shortbow', 50], ['yew_bow', 400], ['stone_arrow', 1], ['iron_arrow', 3], ['elven_arrow', 8]] };
  SHOPS.elf_weaver = { name: "Thessaly's Loom", stock: [['spider_silk', 6], ['wool', 8]] };

  // ---------- elf sentinels (monsters: neutral, human-moving, slender, pointed ears) ----------
  MONSTER_DEFS.elf_sentinel = { name: 'Elf sentinel', level: 25, r: 12, hp: 110, att: 26, maxHit: 12, def: 22, speed: 160, aggro: false, sight: 6 * TILE, respawn: 90, human: true,
    drops: { always: [['coins', 10, 26]], table: [['nothing', 0, 0, 8], ['elven_arrow', 2, 5, 6], ['spider_silk', 1, 2, 4]], rare: { chance: 40, table: [['yew_bow', 1, 1, 1]] } } };
  function elEars(g, skin) { g.fillStyle = skin; g.beginPath(); g.moveTo(-7, -9); g.lineTo(-14, -14); g.lineTo(-7, -5); g.closePath(); g.moveTo(7, -9); g.lineTo(14, -14); g.lineTo(7, -5); g.closePath(); g.fill(); }
  function elLongHair(g, hair) { g.fillStyle = hair; g.beginPath(); g.ellipse(0, -1, 9, 13, 0, 0, 7); g.fill(); }
  HOOKS.drawMonster.elf_sentinel = (g, e, hurt) => {
    g.save(); g.scale(0.95, 1.1);
    elLongHair(g, '#e8d9a0');
    drawHuman(g, e, { tunic: '#3f7a3a', hair: '#e8d9a0', shoulder: '#6b4a2a', skin: '#f0d0b0', weapon: { shape: 'bow', color: '#7a5a2a' } });
    elEars(g, hurt ? '#ffc7b0' : '#f0d0b0');
    g.restore();
  };

  // ---------- quest state ----------
  QUEST_DEFS.elf_queen = { name: 'Leaves and Bridges' };
  QUEST_DEFS.elf_range = { name: "Lira's Twenty" };
  const fresh = () => ({ stage: 0, hinted: false, targets: 0, liraDone: false, liraAsked: false });
  const eq = () => quest.elves || (quest.elves = fresh());
  let hoverWas = false;
  HOOKS.newGame.push(() => { quest.elves = fresh(); hoverWas = false; WALK_OVER.delete(T.WATER); });
  HOOKS.questText.elf_queen = () => eq().stage >= 2 ? 'Done.' : `Bring Queen Aelith 8 jungle logs (${Math.min(8, countItem('jungle_log'))}/8) and 10 spider silk (${Math.min(10, countItem('spider_silk'))}/10). Jungle trees need Woodcutting 15.`;
  HOOKS.questText.elf_range = () => eq().liraDone ? 'Done.' : `Hit the straw targets at Lira's range with a bow (${Math.min(20, eq().targets)}/20).`;
  HOOKS.activeQuests.push(() => { const q = eq(), out = []; if (q.stage === 1) out.push('elf_queen'); if (q.liraAsked && !q.liraDone) out.push('elf_range'); return out; });

  // ---------- the elves (own list: drawn slender, never wander, talked to through HOOKS.use) ----------
  const ELVES = [
    { id: 'aelith', name: 'Queen Aelith', x: 133, y: 119, tunic: '#2f6a3a', hair: '#f2e6b8', crown: true, role: 'elf_queen', sortY: 6 },
    { id: 'lira', name: 'Lira the archery master', x: 158, y: 119, tunic: '#4a6a2a', hair: '#b04a2a', role: 'elf_range', bow: true },
    { id: 'thessaly', name: 'Thessaly the weaver', x: 133, y: 129, tunic: '#6a5a3a', hair: '#3a2a1a', apron: true, woman: true, role: 'elf_weaver' },
    { id: 'faelan', name: 'Faelan', x: 150, y: 132, tunic: '#3a5a2a', hair: '#d9c88a', role: 'elf_villager', lines: ['The river is the second door. Only the light-footed use it.', 'Lira can teach any pair of hands to hold a bow straight. Twenty hits and she owes you.', "Thessaly's loom weaves silk into cloth that forgets it has weight. The Queen decides who wears it."] },
  ];
  for (const e of ELVES) { e.px = tc(e.x); e.py = tc(e.y); e.facing = { x: 0, y: 1 }; }
  function elInFront() {
    let best = null;
    for (const e of ELVES) {
      const d = dist(player.x, player.y, e.px, e.py); if (d > 96) continue;
      const dot = ((e.px - player.x) * player.facing.x + (e.py - player.y) * player.facing.y) / (d || 1);
      if (dot < 0.2 && d > 30) continue;
      if (!best || d < best.d) best = { e, d };
    }
    return best ? best.e : null;
  }
  function elTalk(e) {
    { const dx = e.px - player.x, dy = e.py - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
    const q = eq();
    if (e.role === 'elf_queen') {
      if (q.stage === 0) { q.stage = 1; say("A knight, past the totem. The jungle let you through, so I will not send you back.", e.name); say("Sylvaris is built of leaves and bridges, and the bridges are rotting. Bring me 8 jungle logs and 10 spider silk to bind them. Then Thessaly's loom is yours.", e.name); save(); }
      else if (q.stage === 1) {
        if (countItem('jungle_log') >= 8 && countItem('spider_silk') >= 10) {
          removeItem('jungle_log', 8); removeItem('spider_silk', 10); q.stage = 2;
          giveOrDrop('coins', 300, player.x, player.y); gainXp('crafting', 150);
          say("Good wood, good silk. The bridges will hold another hundred years. Three hundred coins, and my word to Thessaly: the loom is open to you.", e.name);
          levelBanner = { text: 'QUEST COMPLETE', sub: 'Leaves and Bridges', t: 3 }; save();
        } else say(`Eight jungle logs and ten spider silk. You carry ${countItem('jungle_log')} logs and ${countItem('spider_silk')} silk. The big trees fall to an axe and a strong arm — Woodcutting fifteen. Cave spiders spin the silk.`, e.name);
      } else say("Walk the bridges, knight. They hold because of you. Thessaly weaves for you now: silk, wool and a bar of the dwarves' blue metal make armour that floats.", e.name);
    } else if (e.role === 'elf_range') {
      if (!q.liraAsked) { q.liraAsked = true; say("A bow is a conversation with the wind. Put twenty arrows into my straw targets and I'll give you elven arrows to keep the conversation going.", e.name); save(); }
      else if (!q.liraDone && q.targets >= 20) {
        q.liraDone = true; giveOrDrop('elven_arrow', 30, player.x, player.y); gainXp('range', 500);
        say("Twenty. You listen well. Thirty elven arrows, and the Range knows your name now.", e.name);
        levelBanner = { text: 'QUEST COMPLETE', sub: "Lira's Twenty", t: 3 }; save();
      } else if (!q.liraDone) say(`${q.targets} of twenty. The targets are east of the boardwalk. Bows, arrows, and a yew bow if you have the coin.`, e.name);
      else say("Bows and arrows. The yew bow pulls harder than anything Thistledown strings.", e.name);
      openPanel('shop', 'elf_range');
    } else if (e.role === 'elf_weaver') {
      if (q.stage < 2) say("The loom is the Queen's, not mine. She sits in the great hall, north. Bring her what she asks and I weave for you.", e.name);
      else { say("Silk and wool by the bundle. The loom is behind me: ten silk, five wool and a mithril bar make armour that never touches the ground.", e.name); openPanel('shop', 'elf_weaver'); }
    } else say(pick(e.lines), e.name);
  }

  // ---------- world ----------
  HOOKS.world.push((rnd0, api) => {
    const rnd = mulberry32(2609);  // own stream: the layout does not depend on how many features carved before this one
    const set = api.setTile, at = api.tileAt;
    const SOFT = [T.GRASS, T.DIRT, T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.STUMP, T.SAND, EL_JUNGLE, EL_FERN];
    const soft = (x, y) => SOFT.includes(at(x, y));
    const fill = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inJungle(x, y)) set(x, y, t); };
    const line = (pts, w, f) => { for (let s = 0; s < pts.length - 1; s++) { const [ax, ay] = pts[s], [bx, by] = pts[s + 1], steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); for (let k = 0; k <= steps; k++) { const x = Math.round(ax + (bx - ax) * k / steps), y = Math.round(ay + (by - ay) * k / steps); for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) if (Math.abs(dx) + Math.abs(dy) <= w) f(x + dx, y + dy); } } };
    // 1. the jungle: dense giant trees, ferns, a dark floor (the core's map border at x 199 / y 139 stays)
    for (let y = JR.y0; y <= JR.y1 - 1; y++) for (let x = JR.x0; x <= JR.x1 - 1; x++) {
      if (!soft(x, y)) continue;
      const r = rnd();
      set(x, y, r < 0.40 ? EL_JUNGLE : r < 0.52 ? EL_FERN : r < 0.62 ? T.DIRT : T.GRASS);
    }
    // 2. the river: winds down from the north-east, through the city, and away west along the south
    line(RIVER_N, 0, (x, y) => { if (inJungle(x, y) && soft(x, y)) { set(x, y, T.WATER); if (inJungle(x + 1, y) && soft(x + 1, y)) set(x + 1, y, T.WATER); } });
    line(RIVER_S, 0, (x, y) => { if (inJungle(x, y) && soft(x, y)) { set(x, y, T.WATER); if (inJungle(x, y + 1) && soft(x, y + 1) && y + 1 < JR.y1) set(x, y + 1, T.WATER); } });
    // 3. the path from Hollowford: it ends at the wall of jungle, and the ground along the wall is open enough to wander
    line(PATH, 1, (x, y) => { if (inJungle(x, y) && soft(x, y)) set(x, y, T.DIRT); });
    for (let y = 112; y <= 113; y++) for (let x = 128; x <= 146; x++) if (soft(x, y)) set(x, y, rnd() < 0.3 ? EL_FERN : rnd() < 0.5 ? T.DIRT : T.GRASS);
    // 4. the ring wall, the gap and the totem
    for (let y = RING.y0; y <= RING.y1; y++) for (let x = RING.x0; x <= RING.x1; x++) { const edge = x === RING.x0 || x === RING.x1 || y === RING.y0 || y === RING.y1; if (edge) set(x, y, EL_JUNGLE); }
    set(GAP.x, GAP.y, T.DIRT); set(TOTEM_T.x, TOTEM_T.y, EL_TOTEM);
    // 5. the city floor, then the river through it with open banks
    for (let y = CR.y0; y <= CR.y1; y++) for (let x = CR.x0; x <= CR.x1; x++) { const r = rnd(); set(x, y, r < 0.10 ? EL_JUNGLE : r < 0.26 ? EL_FERN : r < 0.36 ? T.DIRT : T.GRASS); }
    for (let y = CR.y0; y <= CR.y1; y++) { const x0 = riverX0(y); set(x0 - 1, y, T.DIRT); set(x0, y, T.WATER); set(x0 + 1, y, T.WATER); set(x0 + 2, y, T.DIRT); }
    set(riverX0(CR.y0), RING.y0, T.WATER); set(riverX0(CR.y0) + 1, RING.y0, T.WATER);          // the river passes the wall
    set(riverX0(CR.y1) - 1, RING.y1, T.WATER); set(riverX0(CR.y1), RING.y1, T.WATER);          // and leaves it heading west
    // 6. huts on stilts: leaf walls, plank floors, an open doorway
    const hut = h => { for (let y = h.y0; y <= h.y1; y++) for (let x = h.x0; x <= h.x1; x++) { const edge = x === h.x0 || x === h.x1 || y === h.y0 || y === h.y1; set(x, y, edge ? EL_LEAFWALL : EL_PLATFORM); } set(h.door[0], h.door[1], EL_PLATFORM); };
    hut(QUEEN_HALL); hut(WEAVER_HUT); hut(LIRA_LODGE);
    set(LOOM_T.x, LOOM_T.y, EL_LOOM);
    fill(ROOST.x0, ROOST.y0, ROOST.x1, ROOST.y1, EL_PLATFORM);
    // 7. bridges and boardwalks: the long walk across the city, over the river, and up to every door
    const bridge = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, EL_BRIDGE); };
    bridge(131, WALK_Y, 158, WALK_Y);                                     // the boardwalk, crossing the river at (147–148, 124)
    bridge(GAP.x, CR.y0, GAP.x, WALK_Y - 1); set(GAP.x, CR.y0, T.DIRT); set(GAP.x, CR.y0 + 1, T.DIRT); // in from the gap
    bridge(QUEEN_HALL.door[0], QUEEN_HALL.y1 + 1, QUEEN_HALL.door[0], WALK_Y - 1);   // queen's hall step
    bridge(WEAVER_HUT.door[0], WALK_Y + 1, WEAVER_HUT.door[0], WEAVER_HUT.y0 - 1);   // down to the weaver
    bridge(LIRA_LODGE.door[0], LIRA_LODGE.y1 + 1, LIRA_LODGE.door[0], WALK_Y - 1);   // up to Lira
    bridge(158, WALK_Y + 1, 158, RANGE.y0 - 1);                                      // down to the range
    bridge(140, WALK_Y + 1, 140, 130); bridge(140, 131, ROOST.x0 - 1, 131);           // south from the boardwalk, over the river again, to the roost
    // 8. the archery range: a dirt lane with straw targets at its east end
    fill(RANGE.x0, RANGE.y0, RANGE.x1, RANGE.y1, T.DIRT);
    for (const [x, y] of TARGETS) set(x, y, EL_TARGET);
    for (const [x, y] of LANTERNS) set(x, y, EL_LANTERN);
    // 9. who lives here: nothing from elsewhere spawns in the jungle; the sentinels and a few boars do
    for (let i = MONSTER_SPAWNS.length - 1; i >= 0; i--) { const s = MONSTER_SPAWNS[i]; if (inJungle(s.tx, s.ty)) MONSTER_SPAWNS.splice(i, 1); }
    const clear3 = (cx, cy) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ([EL_JUNGLE, EL_FERN, T.WATER].includes(at(cx + dx, cy + dy)) && !(at(cx + dx, cy + dy) === T.WATER && inCity(cx + dx, cy + dy))) set(cx + dx, cy + dy, T.GRASS); };
    for (const [x, y] of SENTINELS) clear3(x, y);
    for (const [x, y] of BOARS) clear3(x, y);
    api.spawnList('elf_sentinel', SENTINELS); api.spawnList('boar', BOARS);
    for (const e of ELVES) if (SOLID.has(at(e.x, e.y))) set(e.x, e.y, EL_PLATFORM);
  });

  // ---------- use: elves, the totem, jungle trees, the loom, the targets ----------
  HOOKS.use.push((t, tx, ty) => {
    const e = elInFront();
    if (e) { elTalk(e); return true; }
    if (t === EL_TOTEM) { say("A face carved into the living trunk, older than the goblins, older than the road. Its eyes look east, at the gap beside it.", 'The totem'); return true; }
    if (t === EL_JUNGLE) {
      const tier = hasTool('axe');
      if (!tier) { notify('A jungle giant. You need an axe for that.'); return true; }
      if (skillLv('woodcutting') < 15) { notify('You need Woodcutting level 15 for this jungle tree.'); return true; }
      if (!canFit('jungle_log', 1)) { notify('Your pack is full.'); return true; }
      player.action = { type: 'chop_jungle', tx, ty, t: 0, need: Math.max(1.0, 2.6 - tier * 0.4), tier };
      return true;
    }
    if (t === EL_LOOM) {
      if (eq().stage < 2) { notify("Thessaly's loom. She will not let you near it until the Queen says so."); return true; }
      openPanel('loom'); return true;
    }
    if (t === EL_TARGET) { notify(`A straw target. Equip a bow and shoot it (Space). Hits so far: ${eq().targets}.`); return true; }
    if (t === EL_LANTERN) { notify('An elven lantern. Fireflies, mostly.'); return true; }
    if (t === EL_LEAFWALL) { notify('A wall of woven leaves. Cooler than stone, and it hums when the wind blows.'); return true; }
    return false;
  });

  // ---------- the loom panel (the core's station panel has no title for a loom, so the recipe list is drawn here) ----------
  HOOKS.panel.loom = (g, narrow) => {
    const list = RECIPES.filter(r => r.station === 'loom');
    const { px, py, w, h } = panelBox(g, 420, Math.min(VH - 20, 90 + list.length * 40), "Thessaly's loom — weaving", `Crafting level ${skillLv('crafting')}`);
    const maxRows = Math.floor((h - 80) / 40);
    list.slice(0, maxRows).forEach((rec, i) => {
      const y = py + 62 + i * 40;
      const has = rec.needs.every(([id, q]) => countItem(id) >= q); const lvOk = !rec.skill || skillLv(rec.skill) >= rec.lv; const can = has && lvOk;
      button(g, px + 18, y, w - 36, 34, rec.label + (rec.lv > 1 ? `  (lv ${rec.lv})` : ''), () => craft(rec), can ? '#238636' : '#2a2f3a', can);
    });
  };

  // ---------- update: chopping, the Voice's hint, hover armour, target practice ----------
  function nudgeOffWater() {
    if (!collides(player.x, player.y, player.r, 'person')) return;
    const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
    for (let r = 1; r <= 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = ptx + dx, y = pty + dy; if (!inMap(x, y) || SOLID.has(tileAt(x, y)) || PUSH_THROUGH.has(tileAt(x, y))) continue;
      if (collides(tc(x), tc(y), player.r, 'person')) continue;
      player.x = tc(x); player.y = tc(y); burst(player.x, player.y, '#7ec8ff', 10, 60); notify('Without the armour, the water is water again. You wade to the bank.'); return;
    }
  }
  HOOKS.update.push(dt => {
    const q = eq();
    // jungle chopping: the core leaves unknown action types alone, so the swing finishes here
    const a = player.action;
    if (a && a.type === 'chop_jungle' && a.t >= a.need) {
      player.action = null;
      if (tileAt(a.tx, a.ty) === EL_JUNGLE) {
        burst(tc(a.tx), tc(a.ty), '#5a3a1e', 8, 70); burst(tc(a.tx), tc(a.ty) - 20, '#2a6e34', 6, 50);
        giveOrDrop('jungle_log', 1, player.x, player.y); gainXp('woodcutting', 60);
        if (Math.random() < 0.5) { changeTile(a.tx, a.ty, T.STUMP); regrow.push({ i: idx(a.tx, a.ty), t: EL_JUNGLE, timer: 120 }); }
        else player.action = { ...a, t: 0 };
        save();
      }
    }
    // the Voice, once, when the jungle closes in
    if (!q.hinted && !player.dead && (player.region === 'The Jungle' || player.region === 'Sylvaris')) { q.hinted = true; say("The elves do not want to be found. Look for a face in the trees.", 'The Voice'); save(); }
    // hover armour: float over water, faster than walking; the core resets speed on respawn and mech exit, so re-apply every tick
    const worn = player.equip.body === 'hover_armour' && !player.dead;
    if (worn) { WALK_OVER.add(T.WATER); if (!player.mech) player.speed = 200; hoverWas = true; }
    else if (hoverWas) { hoverWas = false; WALK_OVER.delete(T.WATER); if (!player.mech && player.speed === 200) player.speed = 175; if (!player.dead) nudgeOffWater(); }
    // target practice: an arrow about to strike a straw target is scored here, before the core drops it against the solid tile
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]; if (p.kind !== 'arrow' || p.owner !== 'player') continue;
      const tx = Math.floor((p.x + p.vx * 0.06) / TILE), ty = Math.floor((p.y + p.vy * 0.06) / TILE);
      const ctx = Math.floor(p.x / TILE), cty = Math.floor(p.y / TILE);
      const hitT = tileAt(tx, ty) === EL_TARGET ? { tx, ty } : tileAt(ctx, cty) === EL_TARGET ? { tx: ctx, ty: cty } : null;
      if (!hitT) continue;
      projectiles.splice(i, 1);
      const cx = tc(hitT.tx), cy = tc(hitT.ty);
      const dmg = rollHit(playerAttackRoll(true), 9 * 64, playerMaxHit(true));
      floatText(cx, cy - 30, dmg ? `-${dmg}` : 'miss', dmg ? '#ffd166' : '#8fb4ff'); burst(cx, cy - 6, '#d9c88a', 6, 50);
      q.targets += 1; recordHit(dmg);
      if (dmg > 0) gainXp('range', Math.ceil(dmg / 2));
      if (q.targets === 20 && q.liraAsked && !q.liraDone) notify('Twenty strikes. Lira owes you.');
    }
  });

  // ---------- drawing ----------
  const GREENS = [['#1f5a2a', '#2a6e34', '#17451f'], ['#235f2c', '#2f7a3a', '#1a4a22'], ['#1b5226', '#27693a', '#143d1c']];
  function drawJungleTree(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)], tone = GREENS[v], sway = Math.sin(time * 0.8 + tx * 0.9 + ty * 0.4) * 1.5;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + 16, 24, 9, 0, 0, 7); g.fill();
    // buttress roots and a tall dark trunk
    g.fillStyle = '#3a2614'; g.beginPath(); g.moveTo(cx - 14, cy + 18); g.lineTo(cx - 6, cy - 6); g.lineTo(cx + 6, cy - 6); g.lineTo(cx + 14, cy + 18); g.closePath(); g.fill();
    g.fillStyle = '#4a3118'; g.fillRect(cx - 6, cy - 30, 12, 40);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(cx - 5, cy - 30, 3, 40);
    // broad dark canopy, layered
    const canopy = [[0, -36, 30], [-22, -26, 22], [22, -26, 22], [-12, -46, 18], [12, -46, 18], [0, -20, 20], [-30, -14, 14], [30, -14, 14]];
    for (let i = 0; i < canopy.length; i++) { const [ox, oy, r] = canopy[i]; g.fillStyle = tone[i % 3]; g.beginPath(); g.arc(cx + ox + sway * (oy < -30 ? 1 : 0.4), cy + oy, r, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.arc(cx - 10 + sway, cy - 48, 10, 0, 7); g.fill();
    // hanging vines with a few leaves
    g.strokeStyle = '#2f6a2a'; g.lineWidth = 1.6; g.lineCap = 'round';
    const vines = v === 0 ? [[-20, -16, 26], [16, -12, 34]] : v === 1 ? [[-8, -10, 40], [24, -18, 22]] : [[-26, -8, 20], [4, -12, 30], [26, -10, 18]];
    for (const [ox, oy, len] of vines) {
      const x0 = cx + ox, y0 = cy + oy, x1 = x0 + sway * 2, y1 = y0 + len;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + sway * 3, y0 + len * 0.5, x1, y1); g.stroke();
      g.fillStyle = '#3ea54a'; g.beginPath(); g.ellipse(x1, y1, 3, 1.6, 0.6, 0, 7); g.fill(); g.beginPath(); g.ellipse(x0 + sway * 1.5, y0 + len * 0.5, 2.6, 1.4, -0.6, 0, 7); g.fill();
    }
  }
  function drawFern(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty) + 6, v = variant[idx(tx, ty)];
    g.strokeStyle = v === 1 ? '#3f8a3a' : '#4a9a44'; g.lineWidth = 2; g.lineCap = 'round';
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.5 + (v - 1) * 0.15, len = 16 + (k % 2) * 6; const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len; g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a) * len * 0.5 - Math.sin(a) * 4, cy + Math.sin(a) * len * 0.5 + Math.cos(a) * 4, ex, ey); g.stroke();
      g.fillStyle = 'rgba(126,200,90,0.55)'; for (let j = 1; j <= 3; j++) { const t = j / 4; g.beginPath(); g.ellipse(cx + Math.cos(a) * len * t, cy + Math.sin(a) * len * t, 3.5 * (1 - t * 0.5), 1.5, a, 0, 7); g.fill(); } }
  }
  const raised = t => t === EL_PLATFORM || t === EL_BRIDGE || t === EL_LEAFWALL || t === EL_LOOM;
  function drawPlatform(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    // rim on open edges, a shadow and stilts below the south edge when nothing raised continues there
    g.fillStyle = '#6b4a2a';
    if (!raised(tileAt(tx, ty - 1))) g.fillRect(x, y, TILE, 3); if (!raised(tileAt(tx - 1, ty))) g.fillRect(x, y, 3, TILE); if (!raised(tileAt(tx + 1, ty))) g.fillRect(x + TILE - 3, y, 3, TILE);
    if (!raised(tileAt(tx, ty + 1))) {
      g.fillStyle = '#5a3a1e'; g.fillRect(x, y + TILE - 5, TILE, 5);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y + TILE, TILE, 10);
      g.fillStyle = '#4a3118'; g.fillRect(x + 6, y + TILE, 5, 12); g.fillRect(x + TILE - 11, y + TILE, 5, 12);
      g.strokeStyle = '#3a2614'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 8, y + TILE + 2); g.lineTo(x + TILE - 8, y + TILE + 10); g.stroke();
    }
  }
  function drawBridge(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    const horiz = raised(tileAt(tx - 1, ty)) || raised(tileAt(tx + 1, ty));
    const over = tileAt(tx, ty + 1) === T.WATER || tileAt(tx, ty - 1) === T.WATER || tileAt(tx - 1, ty) === T.WATER || tileAt(tx + 1, ty) === T.WATER;
    g.fillStyle = 'rgba(0,0,0,0.22)'; if (horiz) g.fillRect(x, y + 6, TILE, TILE - 6); else g.fillRect(x + 6, y, TILE - 6, TILE);
    g.fillStyle = '#7a5a34'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#5a3a1e';
    if (horiz) { for (let k = 0; k < 6; k++) g.fillRect(x + k * 8, y + 5, 2, TILE - 10); g.fillRect(x, y + 4, TILE, 1); g.fillRect(x, y + TILE - 5, TILE, 1); }
    else { for (let k = 0; k < 6; k++) g.fillRect(x + 5, y + k * 8, TILE - 10, 2); g.fillRect(x + 4, y, 1, TILE); g.fillRect(x + TILE - 5, y, 1, TILE); }
    // side ropes with posts
    g.strokeStyle = '#d9c88a'; g.lineWidth = 2;
    if (horiz) { g.beginPath(); g.moveTo(x, y + 2); g.quadraticCurveTo(x + TILE / 2, y + 5, x + TILE, y + 2); g.moveTo(x, y + TILE - 2); g.quadraticCurveTo(x + TILE / 2, y + TILE + 1, x + TILE, y + TILE - 2); g.stroke(); }
    else { g.beginPath(); g.moveTo(x + 2, y); g.quadraticCurveTo(x + 5, y + TILE / 2, x + 2, y + TILE); g.moveTo(x + TILE - 2, y); g.quadraticCurveTo(x + TILE + 1, y + TILE / 2, x + TILE - 2, y + TILE); g.stroke(); }
    g.fillStyle = '#4a3118'; if (horiz) { g.fillRect(x + 21, y - 2, 6, 7); g.fillRect(x + 21, y + TILE - 5, 6, 7); } else { g.fillRect(x - 2, y + 21, 7, 6); g.fillRect(x + TILE - 5, y + 21, 7, 6); }
    if (over) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + TILE, TILE, 6); }
  }
  function drawLeafWall(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, v = variant[idx(tx, ty)];
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + TILE - 4, TILE, 8);
    g.fillStyle = '#4a3118'; g.fillRect(x + 2, y - 10, TILE - 4, TILE + 8);
    const rows = ['#2f8a3a', '#256f2e', '#3a9a46', '#1f5a2a'];
    for (let r = 0; r < 6; r++) {
      const ly = y + TILE - 4 - r * 9; g.fillStyle = rows[(r + v) % 4];
      for (let k = 0; k < 5; k++) { const lx = x + 5 + k * 10 + (r % 2) * 5; g.beginPath(); g.ellipse(lx, ly, 6.5, 5, 0, 0, 7); g.fill(); }
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let r = 0; r < 6; r++) { const ly = y + TILE - 2 - r * 9; g.beginPath(); g.moveTo(x + 2, ly); g.lineTo(x + TILE - 2, ly); g.stroke(); }
    g.fillStyle = '#6b4a2a'; g.fillRect(x + 2, y - 12, TILE - 4, 3);
  }
  function drawTotem(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + 16, 16, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#4a3118'; g.fillRect(cx - 12, cy - 40, 24, 58);
    g.fillStyle = '#5a3a1e'; g.fillRect(cx - 9, cy - 38, 18, 54);
    // the face: heavy brow, eyes looking east, a long nose and a grim mouth
    g.fillStyle = '#2a1a0a'; g.fillRect(cx - 9, cy - 30, 18, 4);
    g.fillStyle = '#3a2614'; g.beginPath(); g.ellipse(cx - 4, cy - 22, 3.5, 3, 0, 0, 7); g.ellipse(cx + 5, cy - 22, 3.5, 3, 0, 0, 7); g.fill();
    g.fillStyle = '#e8d9a0'; g.beginPath(); g.arc(cx - 2.5, cy - 22, 1.4, 0, 7); g.arc(cx + 6.5, cy - 22, 1.4, 0, 7); g.fill();
    g.fillStyle = '#3a2614'; g.beginPath(); g.moveTo(cx, cy - 20); g.lineTo(cx - 4, cy - 8); g.lineTo(cx + 4, cy - 8); g.closePath(); g.fill();
    g.fillStyle = '#2a1a0a'; g.fillRect(cx - 7, cy - 4, 14, 3); for (let k = 0; k < 4; k++) g.fillRect(cx - 6 + k * 4, cy - 1, 2, 3);
    g.strokeStyle = '#2a1a0a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 9, cy + 6); g.lineTo(cx + 9, cy + 6); g.moveTo(cx - 9, cy + 11); g.lineTo(cx + 9, cy + 11); g.stroke();
    g.fillStyle = '#3ea54a'; g.beginPath(); g.ellipse(cx - 10, cy - 36, 4, 2, 0.5, 0, 7); g.ellipse(cx + 9, cy + 2, 4, 2, -0.5, 0, 7); g.fill(); // moss
  }
  function drawTarget(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 16, 16, 6, 0, 0, 7); g.fill();
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 12, cy + 18); g.lineTo(cx, cy - 4); g.lineTo(cx + 12, cy + 18); g.stroke();
    for (const [r, c] of [[17, '#d9c88a'], [13, '#c9b070'], [9, '#d9c88a'], [5, '#8a5a2b'], [2, '#2a1a0a']]) { g.fillStyle = c; g.beginPath(); g.arc(cx, cy - 6, r, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 6, cy - 6 + Math.sin(a) * 6); g.lineTo(cx + Math.cos(a) * 17, cy - 6 + Math.sin(a) * 17); g.stroke(); }
  }
  function drawLoom(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, cx = tc(tx);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 6, y + 38, TILE - 12, 6);
    g.fillStyle = '#6b4a2a'; g.fillRect(x + 6, y + 4, 4, 38); g.fillRect(x + TILE - 10, y + 4, 4, 38); g.fillRect(x + 6, y + 4, TILE - 12, 4); g.fillRect(x + 6, y + 36, TILE - 12, 4);
    g.strokeStyle = '#e9eef5'; g.lineWidth = 1; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(x + 12 + k * 3, y + 8); g.lineTo(x + 12 + k * 3, y + 36); g.stroke(); }
    g.fillStyle = '#7ec8ff'; g.fillRect(x + 11, y + 22, TILE - 22, 14); g.fillStyle = '#e9eef5'; g.fillRect(x + 11, y + 26, TILE - 22, 2); g.fillRect(x + 11, y + 32, TILE - 22, 2);
    g.fillStyle = '#a5763f'; g.fillRect(x + 8, y + 20 + Math.sin(time * 2) * 2, TILE - 16, 3); // the shuttle bar
    g.fillStyle = '#f2f2ec'; g.beginPath(); g.arc(cx + 14, y + 12, 4, 0, 7); g.fill(); // a ball of wool
  }
  function drawLantern(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), gl = 0.7 + Math.sin(time * 3 + tx * 1.3 + ty) * 0.2;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 8, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#4a3118'; g.fillRect(cx - 2, cy - 26, 4, 40); g.fillRect(cx - 2, cy - 28, 14, 3);
    g.strokeStyle = '#d9c88a'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + 10, cy - 25); g.lineTo(cx + 10, cy - 19); g.stroke();
    g.fillStyle = '#2a1a0a'; g.fillRect(cx + 5, cy - 19, 10, 13);
    g.fillStyle = `rgba(255,220,120,${gl})`; g.fillRect(cx + 6.5, cy - 17.5, 7, 10);
    const gr = g.createRadialGradient(cx + 10, cy - 12, 3, cx + 10, cy - 12, 44); gr.addColorStop(0, 'rgba(255,220,120,0.28)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx + 10, cy - 12, 44, 0, 7); g.fill();
  }
  function drawElf(g, e) {
    const ent = { x: e.px, y: e.py, r: 12, facing: e.facing, hurtT: 0, attackT: 0, moving: false, walkT: 0 };
    const near = dist(player.x, player.y, ent.x, ent.y) < 110;
    if (near) ent.facing = { x: Math.sign(player.x - ent.x) || 0, y: Math.sign(player.y - ent.y) || 1 };
    g.save(); g.translate(ent.x, ent.y);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 11, 11, 5, 0, 0, 7); g.fill();
    g.scale(0.95, 1.1);
    elLongHair(g, e.hair);
    drawHuman(g, ent, { tunic: e.tunic, hair: e.hair, apron: e.apron, crown: e.crown, woman: e.woman, skin: '#f0d0b0', shoulder: e.crown ? '#c9a36a' : '#6b4a2a', weapon: e.bow ? { shape: 'bow', color: '#7a5a2a' } : null });
    elEars(g, '#f0d0b0');
    g.restore();
    if (near) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(e.name, ent.x, ent.y - 28); g.fillStyle = '#c8f0c0'; g.fillText(e.name, ent.x, ent.y - 28); }
  }
  function drawHoverGlow(g) {
    const bob = Math.sin(time * 2.2) * 2, onWater = tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE)) === T.WATER;
    const gr = g.createRadialGradient(player.x, player.y + 12, 2, player.x, player.y + 12, 26 + bob); gr.addColorStop(0, 'rgba(126,200,255,0.55)'); gr.addColorStop(0.6, 'rgba(126,200,255,0.22)'); gr.addColorStop(1, 'rgba(126,200,255,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(player.x, player.y + 12, 26 + bob, 11 + bob * 0.4, 0, 0, 7); g.fill();
    g.strokeStyle = `rgba(200,235,255,${0.35 + Math.sin(time * 2.2) * 0.15})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(player.x, player.y + 12, 16 + bob, 6, 0, 0, 7); g.stroke();
    if (onWater) { g.strokeStyle = 'rgba(220,240,255,0.4)'; g.lineWidth = 1; const ph = (time * 0.8) % 1; g.beginPath(); g.ellipse(player.x, player.y + 14, 12 + ph * 24, 5 + ph * 10, 0, 0, 7); g.stroke(); }
    for (let k = 0; k < 3; k++) { const a = time * 1.5 + k * 2.1; g.fillStyle = `rgba(200,235,255,${0.5 + Math.sin(a * 2) * 0.3})`; g.beginPath(); g.arc(player.x + Math.cos(a) * 16, player.y + 6 + Math.sin(a) * 6 + bob, 1.6, 0, 7); g.fill(); }
  }
  const EL_USABLE = [EL_JUNGLE, EL_TOTEM, EL_LOOM, EL_TARGET, EL_LANTERN, EL_LEAFWALL];
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE));
    for (let ty = y0; ty <= y1 + 3; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === EL_JUNGLE) items.push({ y: ty * TILE + TILE - 3, draw: () => drawJungleTree(g, tx, ty) });
      else if (t === EL_FERN) items.push({ y: -1e8 + ty * TILE + tx * 0.01, draw: () => drawFern(g, tx, ty) });          // flat: under everything that walks
      else if (t === EL_PLATFORM) items.push({ y: -1e8 + ty * TILE + tx * 0.01, draw: () => drawPlatform(g, tx, ty) });
      else if (t === EL_BRIDGE) items.push({ y: -1e8 + ty * TILE + tx * 0.01, draw: () => drawBridge(g, tx, ty) });
      else if (t === EL_LEAFWALL) items.push({ y: ty * TILE + TILE - 2, draw: () => drawLeafWall(g, tx, ty) });
      else if (t === EL_TOTEM) items.push({ y: ty * TILE + TILE - 4, draw: () => drawTotem(g, tx, ty) });
      else if (t === EL_TARGET) items.push({ y: ty * TILE + TILE - 6, draw: () => drawTarget(g, tx, ty) });
      else if (t === EL_LOOM) items.push({ y: ty * TILE + TILE - 6, draw: () => drawLoom(g, tx, ty) });
      else if (t === EL_LANTERN) items.push({ y: ty * TILE + TILE - 6, draw: () => drawLantern(g, tx, ty) });
    }
    for (const e of ELVES) if (e.px > cam.x - 60 && e.px < cam.x + VW + 60 && e.py > cam.y - 60 && e.py < cam.y + VH + 60) items.push({ y: e.py + 13 + (e.sortY || 0), draw: () => drawElf(g, e) });
    // the axe in hand while chopping a jungle tree (the core only animates its own 'chop' action)
    const a = player.action;
    if (a && a.type === 'chop_jungle' && !player.dead) items.push({ y: player.y + player.r + 0.01, draw: () => {
      const ang = Math.atan2(player.facing.y, player.facing.x), sw = Math.sin(time * 14) * 0.6;
      g.save(); g.translate(player.x, player.y); g.rotate(ang - 0.7 + sw); g.fillStyle = '#8a6a3a'; g.fillRect(2, -1.5, 26, 3);
      g.fillStyle = a.tier >= 3 ? '#7aa0d0' : a.tier === 2 ? '#a9adb5' : '#b8863a'; g.beginPath(); g.moveTo(20, -3); g.quadraticCurveTo(30, -10, 30, 0); g.quadraticCurveTo(30, 10, 20, 3); g.closePath(); g.fill(); g.restore();
    } });
    // hover armour: a soft blue glow under the knight, drawn just before the player sprite
    if (!player.dead && player.equip.body === 'hover_armour') items.push({ y: player.y + player.r - 0.5, draw: () => drawHoverGlow(g) });
    // interaction highlight for our own tiles and elves (the core only highlights what it knows)
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 2, draw: () => {
      const e = elInFront();
      if (e) { g.strokeStyle = 'rgba(200,240,192,0.7)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(e.px, e.py, 18, 0, 7); g.stroke(); g.setLineDash([]); return; }
      const { tx, ty } = frontTile(player);
      if (EL_USABLE.includes(tileAt(tx, ty))) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    h.peace(true); closePanel();
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const tileOf = () => tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
    const KEEP = ['coins', 'shortbow', 'yew_bow', 'bronze_axe', 'iron_axe', 'mithril_axe', 'hammer', 'hover_armour', 'mithril_bar', 'jungle_log', 'spider_silk', 'wool', 'elven_arrow', 'stone_arrow', 'iron_arrow', 'wooden_sword', 'iron_dagger', 'iron_sword'];
    const freeSlots = n => { for (let i = 0; i < INV_SLOTS && player.inv.filter(s => !s).length < n; i++) { const s = player.inv[i]; if (s && !KEEP.includes(s.id)) player.inv[i] = null; } };
    const need = (id, n) => { freeSlots(2); if (countItem(id) < n) h.give(id, n - countItem(id)); };
    // regions
    check('elves: The Jungle fills the south-east and Sylvaris sits inside it', regionAt(150, 100).name === 'The Jungle' && regionAt(133, 120).name === 'Sylvaris' && regionAt(141, 92).name !== 'The Jungle' && REGIONS.some(r => r.name === 'The Jungle' && r.sub === 'Vast, green, watching'), { at150_100: regionAt(150, 100).name, at133_120: regionAt(133, 120).name });
    // the path in, the hidden gap, and every door reachable through it
    { const toGap = F.bfs(140, 92, GAP.x, GAP.y); const inside = F.bfs(140, 92, GAP.x, CR.y0 + 1);
      let gaps = 0; for (let y = RING.y0; y <= RING.y1; y++) for (let x = RING.x0; x <= RING.x1; x++) { const edge = x === RING.x0 || x === RING.x1 || y === RING.y0 || y === RING.y1; if (edge && !SOLID.has(tileAt(x, y))) gaps++; }
      check('elves: the path from Hollowford reaches the totem gap, the only way through the wall of jungle', !!toGap && !!inside && gaps === 1 && tileAt(TOTEM_T.x, TOTEM_T.y) === EL_TOTEM && tileAt(GAP.x, GAP.y) === T.DIRT, { toGap: toGap && toGap.length, inside: inside && inside.length, gaps });
      const from = [GAP.x, CR.y0 + 1];
      const queen = F.bfs(from[0], from[1], QUEEN_HALL.door[0], QUEEN_HALL.y1 - 1), lira = F.bfs(from[0], from[1], LIRA_LODGE.door[0], LIRA_LODGE.y1 - 1), loom = F.bfs(from[0], from[1], LOOM_T.x + 1, LOOM_T.y), range = F.bfs(from[0], from[1], RANGE.x1 - 2, RANGE.y0 + 2), roost = F.bfs(from[0], from[1], ROOST.x0 + 1, ROOST.y0 + 1);
      let bridges = 0, platforms = 0, walls = 0, overWater = 0; for (let y = CR.y0; y <= CR.y1; y++) for (let x = CR.x0; x <= CR.x1; x++) { const t = tileAt(x, y); if (t === EL_BRIDGE) { bridges++; if (tileAt(x, y + 1) === T.WATER || tileAt(x, y - 1) === T.WATER) overWater++; } else if (t === EL_PLATFORM) platforms++; else if (t === EL_LEAFWALL) walls++; }
      check("elves: Sylvaris is walkable: gap → Queen's hall, Lira's lodge, the loom, the range and the roost (huts, bridges over the river)", !!queen && !!lira && !!loom && !!range && !!roost && bridges >= 40 && platforms >= 40 && walls >= 40 && overWater >= 2, { queen: !!queen, lira: !!lira, loom: !!loom, range: !!range, roost: !!roost, bridges, platforms, walls, overWater }); }
    // the Voice hints once
    { eq().hinted = false; drain(); F.tp(141, 97); F.sim(3, []); const first = eq().hinted && dialog.cur && /face in the trees/.test(dialog.cur.text); drain(); F.tp(141, 98); F.sim(3, []);
      check('elves: the Voice hints once on entering the jungle', first && !dialog.cur, { first, hinted: eq().hinted, region: player.region }); }
    // jungle trees: axe, then Woodcutting 15, then logs
    { const tree = { x: 135, y: 114 }; F.tp(135, 113); F.face(tree.x, tree.y); const ok = tileAt(tree.x, tree.y) === EL_JUNGLE;
      const stash = []; for (let i = 0; i < INV_SLOTS; i++) { const s = player.inv[i]; if (s && ITEMS[s.id].tool === 'axe') { stash.push([i, s]); player.inv[i] = null; } } const eqw = player.equip.weapon; if (eqw && ITEMS[eqw].tool === 'axe') player.equip.weapon = null;
      F.press('KeyE'); F.sim(2, []); const noAxe = !player.action && notice && /axe/.test(notice.text);
      for (const [i, s] of stash) player.inv[i] = s; if (eqw && ITEMS[eqw].tool === 'axe') player.equip.weapon = eqw; if (!hasTool('axe')) h.give('bronze_axe', 1);
      const wc0 = player.skills.woodcutting.xp; player.skills.woodcutting.xp = XP_TABLE[14]; F.face(tree.x, tree.y); F.press('KeyE'); F.sim(2, []); const lowLv = !player.action && notice && /Woodcutting level 15/.test(notice.text);
      check('elves: jungle trees need an axe, then Woodcutting 15', ok && noAxe && lowLv, { ok, noAxe, lowLv, notice: notice && notice.text });
      player.skills.woodcutting.xp = XP_TABLE[15]; const logs0 = countItem('jungle_log'), x0 = player.skills.woodcutting.xp; F.face(tree.x, tree.y); F.press('KeyE'); const started = player.action && player.action.type === 'chop_jungle';
      const steps = F.untilAction(600, () => countItem('jungle_log') > logs0); player.action = null;
      const left = tileAt(tree.x, tree.y) === EL_JUNGLE || (tileAt(tree.x, tree.y) === T.STUMP && regrow.some(r => r.i === idx(tree.x, tree.y) && r.t === EL_JUNGLE && r.timer > 0));
      check('elves: chop a jungle tree at Woodcutting 15 (jungle log worth 20, burn 90, 60 xp, stump regrows)', started && typeof steps === 'number' && countItem('jungle_log') === logs0 + 1 && player.skills.woodcutting.xp === x0 + 60 && left && ITEMS.jungle_log.value === 20 && ITEMS.jungle_log.burn === 90, { started, steps, logs: countItem('jungle_log'), tile: tileAt(tree.x, tree.y) });
      player.skills.woodcutting.xp = Math.max(wc0, player.skills.woodcutting.xp); }
    // the totem speaks; the Queen's quest before and after; Thessaly refuses before
    { drain(); F.tp(TOTEM_T.x, TOTEM_T.y - 1); F.face(TOTEM_T.x, TOTEM_T.y); F.press('KeyE'); F.sim(2, []); const totem = dialog.cur && dialog.cur.who === 'The totem';
      eq().stage = 0; drain(); F.tp(133, 120); F.face(133, 119); F.press('KeyE'); F.sim(3, []);
      const asked = eq().stage === 1 && dialog.cur && dialog.cur.who === 'Queen Aelith' && activeQuests().includes('elf_queen') && /jungle logs/.test(questText('elf_queen'));
      drain(); closePanel(); F.tp(132, 129); F.face(133, 129); F.press('KeyE'); F.sim(3, []); const refused = panel !== 'shop' && dialog.cur && /Queen/.test(dialog.cur.text);
      drain(); F.tp(131, 128); F.face(LOOM_T.x, LOOM_T.y); F.press('KeyE'); F.sim(2, []); const loomShut = panel !== 'loom' && notice && /loom/.test(notice.text);
      check('elves: the totem speaks; Queen Aelith asks for 8 jungle logs + 10 spider silk; Thessaly and the loom refuse before', totem && asked && refused && loomShut, { totem, asked, refused, loomShut, stage: eq().stage });
      need('jungle_log', 8); need('spider_silk', 10); const l0 = countItem('jungle_log'), s0 = countItem('spider_silk'), c0 = coins();
      drain(); F.tp(133, 120); F.face(133, 119); F.press('KeyE'); F.sim(3, []);
      check('elves: the Queen takes the logs and silk, pays 300 coins and opens the loom', eq().stage === 2 && coins() === c0 + 300 && countItem('jungle_log') === l0 - 8 && countItem('spider_silk') === s0 - 10 && !activeQuests().includes('elf_queen') && questText('elf_queen') === 'Done.', { stage: eq().stage, coins: coins() - c0 }); }
    // the loom weaves hover armour
    { need('spider_silk', 10); need('wool', 5); need('mithril_bar', 1); freeSlots(2);
      if (player.skills.crafting.xp < XP_TABLE[25]) player.skills.crafting.xp = XP_TABLE[25]; const cx0 = player.skills.crafting.xp, ha0 = countItem('hover_armour');
      drain(); F.tp(131, 128); F.face(LOOM_T.x, LOOM_T.y); F.press('KeyE'); F.sim(1, []); const open = panel === 'loom';
      const c = F.clickButton('10 Silk + 5 Wool + Mithril bar → Hover armour'); closePanel();
      check('elves: the loom weaves 10 silk + 5 wool + a mithril bar into hover armour (Crafting 25, 400 xp)', open && c && countItem('hover_armour') === ha0 + 1 && player.skills.crafting.xp === cx0 + 400 && ITEMS.hover_armour.armour.def === 18 && ITEMS.hover_armour.armour.slot === 'body', { open, c, armour: countItem('hover_armour'), xp: player.skills.crafting.xp - cx0 }); }
    // hover armour: walk on water, faster; take it off and you are put back on the bank
    { closePanel(); freeSlots(3); const prevBody = player.equip.body; const slot = player.inv.findIndex(s => s && s.id === 'hover_armour'); equipItem(slot);
      const y = 118, bank = riverX0(y) - 1; F.tp(bank, y); F.sim(2, []); const fast = player.speed === 200 && WALK_OVER.has(T.WATER);
      let onWater = false, steps = 0; for (; steps < 60 && !onWater; steps++) { F.step(['KeyD']); if (tileOf() === T.WATER) onWater = true; }
      check('elves: hover armour floats you over the river (speed 200)', fast && onWater, { fast, onWater, steps, tile: tileOf(), speed: player.speed });
      freeSlots(2); unequip('body'); F.sim(2, []);
      const off = !WALK_OVER.has(T.WATER) && player.speed === 175 && tileOf() !== T.WATER && !collides(player.x, player.y, player.r, 'person') && countItem('hover_armour') === 1;
      check('elves: taking the armour off nudges you to the bank and the water is solid again', off, { off, tile: tileOf(), speed: player.speed, walkOver: WALK_OVER.has(T.WATER) });
      if (prevBody) { const s = player.inv.findIndex(x => x && x.id === prevBody); if (s >= 0) equipItem(s); } }
    // Lira: the shop, the targets, the quest
    { drain(); closePanel(); eq().liraAsked = false; eq().liraDone = false; eq().targets = 0; need('coins', 20); F.tp(158, 120); F.face(158, 119); F.press('KeyE'); F.sim(2, []);
      const open = panel === 'shop' && panelArg === 'elf_range' && eq().liraAsked && activeQuests().includes('elf_range'); const ea0 = countItem('elven_arrow'); const bought = F.clickButton('Buy 8'); closePanel();
      check("elves: Lira's range shop opens (shortbow, yew bow 400, arrows) and sells elven arrows at 8", open && bought && countItem('elven_arrow') === ea0 + 1 && ITEMS.elven_arrow.arrow.str === 14 && SHOPS.elf_range.stock.some(([id, p]) => id === 'yew_bow' && p === 400) && ITEMS.yew_bow.weapon.ranged, { open, bought, arrows: countItem('elven_arrow') });
      const prevW = player.equip.weapon; need('shortbow', 1); equipItem(player.inv.findIndex(s => s && s.id === 'shortbow')); need('stone_arrow', 60);
      F.tp(159, 128); player.facing = { x: 1, y: 0 }; const rx0 = player.skills.range.xp; let strikes = 0, shots = 0;
      for (; shots < 30 && (strikes < 3 || player.skills.range.xp === rx0); shots++) { player.attackCd = 0; F.press('Space'); F.sim(40, []); strikes = eq().targets; }
      check('elves: arrows into the straw targets count as strikes and give (half) Range xp', strikes >= 3 && player.skills.range.xp > rx0 && tileAt(163, 128) === EL_TARGET, { strikes, shots, rxp: player.skills.range.xp - rx0 });
      eq().targets = 19; player.attackCd = 0; F.press('Space'); F.sim(40, []); const twenty = eq().targets === 20;
      drain(); const ea1 = countItem('elven_arrow'), rx1 = player.skills.range.xp; F.tp(158, 120); F.face(158, 119); F.press('KeyE'); F.sim(2, []); closePanel();
      check("elves: twenty strikes complete Lira's Twenty: 500 Range xp + 30 elven arrows", twenty && eq().liraDone && countItem('elven_arrow') === ea1 + 30 && player.skills.range.xp === rx1 + 500 && !activeQuests().includes('elf_range'), { twenty, done: eq().liraDone, arrows: countItem('elven_arrow') - ea1, xp: player.skills.range.xp - rx1 });
      if (prevW) { const s = player.inv.findIndex(x => x && x.id === prevW); if (s >= 0) equipItem(s); } }
    { const s = monsters.filter(m => m.type === 'elf_sentinel'); check('elves: two neutral elf sentinels watch the gap', s.length === 2 && s.every(m => !m.angry && inCity(Math.floor(m.home.x / TILE), Math.floor(m.home.y / TILE))) && MONSTER_DEFS.elf_sentinel.level === 25 && MONSTER_DEFS.elf_sentinel.human, { sentinels: s.length }); }
    h.peace(false); closePanel();
  });
}
