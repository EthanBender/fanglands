// ============================================================================
// THE FAR SHORE — Grubmarket, Castle Gnash and Tinkerton's lab (the goblin city over the Grey Sea)
// Reached by Old Harl's ferry (26-boats: destination 'farshore', 40 coins, combat 10). Goblins here are
// townsfolk, not soldiers: they sell, they cook, they want favours. Two quests:
//   'A Tinker Gone Wrong' (quest.tinker) — four parts from four goblins, then the Gnasher wakes and you fight it
//   'Gold for Gnash'      (quest.gnash)  — 500 coins of tribute opens the king's treasury, once
// The lab interior is an instance (16-instances: 'tinker_lab', 24×18, boss 'gnasher') behind the hut's door; the
// Gnasher wakes and fights in there, and the rematch lever is in there too. Should the instance system ever be
// missing, the same lab runs as a walled yard on the overworld (every position below has both forms).
// Feature file: registers through HOOKS only; the only other file touched is 26-boats.js (the destination entry).
// Everything lives in one block so no name leaks into the shared script scope.
// ============================================================================
{
  // ---------- tiles (ids captured locally) ----------
  const GC_THRONE = addTile('GNASH_THRONE', { solid: true, tex: 'floor', mini: '#f5c542' });
  const GC_GOLD = addTile('GNASH_GOLD', { solid: true, tex: 'floor', mini: '#f5c542' });
  const GC_CHEST = addTile('GNASH_CHEST', { solid: true, tex: 'floor', mini: '#8a5a2b' });
  const GC_LEVER = addTile('ARENA_LEVER', { solid: true, tex: 'floor', mini: '#c0504d' });
  const KEEP_TILES = new Set([T.DOCK, T.BOAT, T.SEAROCK, T.DUNGEON_DOOR].filter(v => v !== undefined)); // the ferry's dock/boat and the lab door are placed by earlier feature files
  const HAS_INST = !!(window.INSTANCES && typeof window.INSTANCES.define === 'function');
  const INST_ID = 'tinker_lab';

  // ---------- geometry ----------
  const FS = { x0: 202, y0: 4, x1: 258, y1: 96 };     // The Far Shore (the whole territory)
  const GM = { x0: 208, y0: 16, x1: 257, y1: 50 };    // Grubmarket: the market, the scrap yard, the lab
  const CG = { x0: 212, y0: 52, x1: 238, y1: 76 };    // Castle Gnash
  const STRAIT = { x0: 200, y0: 1, x1: 203, y1: 96 }; // water between the Grey Sea and the shore
  const SHORE = { x0: 204, x1: 206 };                 // sand, rocks
  const LANDING = { x: 206, y: 30 };                  // where Harl's boat puts you down (26-boats LOC.farshore.land)
  const RING = { x0: 214, y0: 54, x1: 236, y1: 74 };  // the castle wall
  const PORTCULLIS = [[224, 54], [225, 54]];
  const YARD = { x0: 241, y0: 20, x1: 253, y1: 32, gate: [241, 26] };   // the scrap yard (fence)
  const LAB = { x0: 240, y0: 36, x1: 256, y1: 50, gate: [240, 44] };    // Tinkerton's compound (stone wall) on the overworld
  const LAB_DOOR = { x: 247, y: 41 }, LAB_STEP = { x: 247, y: 42 };     // the hut door (a DUNGEON_DOOR when the instance system is present) and the step outside it
  const BEAST_T = { x: 253, y: 47 };                  // where a re-supplied Barrelbeast is handed over (window.BEAST.giveTile)
  const THRONE_T = { x: 224, y: 67 }, CHEST_T = { x: 228, y: 68 };
  const TINK_GATE = { x: 226, y: 52 };
  // the lab interior: instance coordinates (24×18) — or, without instances, the overworld hut and yard
  const LAB_W = 24, LAB_H = 18, LAB_ENTRY = [12, 16], LAB_EXIT = [12, 17];
  const TINK_LAB = HAS_INST ? { x: 4, y: 3 } : { x: 247, y: 39 };
  const GN_HOME = HAS_INST ? { x: 12, y: 9 } : { x: 249, y: 46 };
  const LEVER_T = HAS_INST ? { x: 21, y: 15 } : { x: 241, y: 41 };
  const KEEP_GUARDS = [[221, 66], [227, 66]], GATE_GUARDS = [[222, 56], [227, 56]];
  const YARD_WALKERS = [[244, 23], [249, 29]], YARD_DOZER = [[246, 27]];
  const STALLS = [[219, 28], [220, 28], [229, 28], [230, 28]];
  const FIRE_T = { x: 220, y: 34 };
  const inRect = (r, tx, ty) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;
  const inLab = () => HAS_INST ? window.__instance === INST_ID : true;   // where the Gnasher lives: inside the instance, or (fallback) the overworld yard
  const hidden = () => !!window.__instance;                              // the knight is inside some dungeon: the overworld folk are out of reach

  // regions: the castle and the market sit in front of the shore; all three go in front of the core regions
  // (spliced before 'The Cave' — never unshift: the dwarves' self-test wants Deepholm first)
  { const at = Math.max(0, REGIONS.findIndex(r => r.name === 'The Cave'));
    REGIONS.splice(at, 0,
      { name: 'Castle Gnash', sub: 'King Gnash sits on his gold', x0: CG.x0, y0: CG.y0, x1: CG.x1, y1: CG.y1 },
      { name: 'Grubmarket', sub: 'Crooked huts and scrap-metal roofs', x0: GM.x0, y0: GM.y0, x1: GM.x1, y1: GM.y1 },
      { name: 'The Far Shore', sub: 'Goblin country, over the water', x0: FS.x0, y0: FS.y0, x1: FS.x1, y1: FS.y1 }); }

  // ---------- buildings (pushed at load: 02-world carves them before HOOKS.world runs) ----------
  const KEEP = { id: 'gc_keep', x: 219, y: 62, w: 12, h: 9, name: "King Gnash's Keep", roof: '#3a3f4a', sign: 'GNASH', doorTop: 5, stone: true,
    f: [[GC_THRONE, 5, 5], [T.RUG, 5, 1], [T.RUG, 5, 2], [T.RUG, 5, 3], [T.RUG, 5, 4], [GC_GOLD, 1, 1], [GC_GOLD, 2, 1], [GC_GOLD, 9, 1], [GC_GOLD, 10, 1], [GC_GOLD, 1, 7], [GC_GOLD, 10, 7], [GC_GOLD, 9, 7],
      [GC_CHEST, 9, 6], [T.TABLE, 1, 4], [T.TABLE, 10, 4], [T.SHELF, 2, 7], [T.SHELF, 3, 7]] };
  const LAB_HUT = { id: 'gc_lab', x: 243, y: 37, w: 9, h: 5, name: "Tinkerton's Lab", roof: '#5a4a3a', sign: 'TINKER', door: 4, scrap: true,
    f: [[T.WORKBENCH, 1, 1], [T.WORKSHOP, 3, 1], [T.ALCHEMY, 5, 1], [T.SHELF, 7, 1], [T.TABLE, 1, 3], [T.SHELF, 7, 3]] };
  const HUTS = [
    { id: 'gc_cook', x: 214, y: 22, w: 5, h: 4, name: "Grubb's Cookhouse", roof: '#6a3a2a', sign: 'GRUB', door: 2, scrap: true, f: [[T.OVEN, 1, 1], [T.TABLE, 3, 1]] },
    { id: 'gc_h2', x: 220, y: 22, w: 4, h: 4, name: 'Hut', roof: '#3a4a3a', door: 1, scrap: true, f: [[T.TABLE, 1, 1]] },
    { id: 'gc_nix', x: 228, y: 22, w: 5, h: 4, name: "Nix's Scrap", roof: '#4a4a52', sign: 'SCRAP', door: 2, scrap: true, f: [[T.WORKBENCH, 1, 1], [T.SHELF, 3, 1]] },
    { id: 'gc_h3', x: 235, y: 22, w: 4, h: 4, name: 'Hut', roof: '#6a4a3a', door: 1, scrap: true, f: [[T.BED, 1, 1]] },
    { id: 'gc_snaggle', x: 214, y: 35, w: 5, h: 4, name: "Old Snaggle's", roof: '#4a5a3a', doorTop: 2, scrap: true, f: [[T.BED, 1, 2], [T.SHELF, 3, 1]] },
    { id: 'gc_h4', x: 227, y: 36, w: 5, h: 4, name: 'Hut', roof: '#5a5a3a', doorTop: 2, scrap: true, f: [[T.TABLE, 1, 2], [T.SHELF, 3, 2]] },
    { id: 'gc_h1', x: 232, y: 35, w: 4, h: 4, name: 'Hut', roof: '#5a4a5a', doorTop: 1, scrap: true, f: [[T.BED, 1, 2]] },
    KEEP, LAB_HUT,
  ];
  BUILDINGS.push(...HUTS);
  const mine = b => !!b && typeof b.id === 'string' && b.id.startsWith('gc_');

  // ---------- items ----------
  const PART_IDS = ['boiler', 'gear_wheel', 'bomb_chute', 'lightning_coil'];
  Object.assign(ITEMS, {
    boiler: { name: 'Boiler', value: 50, color: '#8f96a3', shape: 'bar', stack: 1 },
    gear_wheel: { name: 'Gear wheel', value: 50, color: '#c9a36a', shape: 'scrap', stack: 1 },
    bomb_chute: { name: 'Bomb chute', value: 50, color: '#4a4a52', shape: 'bar', stack: 1 },
    lightning_coil: { name: 'Lightning coil', value: 50, color: '#7ec8ff', shape: 'scrap', stack: 1 },
    tinker_goggles: { name: "Tinker's goggles", value: 300, color: '#c9a36a', shape: 'helm', stack: 1, armour: { slot: 'helm', def: 8 } },
    gnash_crown: { name: "Gnash's crown", value: 800, color: '#f5c542', shape: 'helm', stack: 1 },
  });
  for (const k of [...PART_IDS, 'tinker_goggles', 'gnash_crown']) ITEMS[k].id = k;
  SHOPS.tinkerton = { name: "Tinkerton's Lab", stock: [['blast_powder', 15], ['goblin_scrap', 8], ['hammer', 5]] };

  // ---------- monsters ----------
  // goblin castle guards: neutral, walk like people (through doors); hostile only while you stand in the keep before the tribute
  MONSTER_DEFS.castle_guard = { name: 'Castle guard', level: 20, r: 12, hp: 80, att: 22, maxHit: 10, def: 18, speed: 130, aggro: false, sight: 6 * TILE, respawn: 90, human: true,
    drops: { always: [['coins', 10, 25]], table: [['nothing', 0, 0, 10], ['goblin_scrap', 1, 2, 6], ['iron_bar', 1, 1, 2]] } };
  // the scrap yard's machines: the walker's own def (mech: a wreck when it dies), neutral; the dozer likewise (its charge AI is keyed to type 'bulldozer', so this one only shoves)
  MONSTER_DEFS.yard_walker = { ...MONSTER_DEFS.walker, name: 'Yard walker', level: 18, aggro: false };
  MONSTER_DEFS.yard_dozer = MONSTER_DEFS.bulldozer ? { ...MONSTER_DEFS.bulldozer, name: 'Yard dozer', aggro: false }
    : { name: 'Yard dozer', level: 14, r: 22, hp: 110, att: 15, maxHit: 10, def: 14, speed: 60, aggro: false, sight: 5 * TILE, respawn: 300, drops: { always: [['goblin_scrap', 3, 6], ['iron_ore', 1, 3]] } };
  // the Gnasher: not `mech` (the core would leave a walker wreck and speak the walker's line); arms and bombs are in HOOKS.update below
  MONSTER_DEFS.gnasher = { name: 'The Gnasher', level: 22, r: 30, hp: 320, att: 22, maxHit: 14, def: 18, speed: 75, aggro: true, sight: 7 * TILE, respawn: 1e9,
    drops: { always: [['iron_ore', 1, 2]], table: [['nothing', 0, 0, 6], ['goblin_scrap', 1, 3, 6], ['blast_powder', 1, 2, 4]] } };
  const GN_ARM_EVERY = 2, GN_ARM_REACH = 1.5 * TILE, GN_BOMB_EVERY = 5;

  // ---------- state ----------
  const freshT = () => ({ stage: 0, parts: {}, visited: false, rematch: false, kills: 0 });
  const freshG = () => ({ stage: 0, tribute: false, treasury: false });
  const TQ = () => { const q = quest.tinker || (quest.tinker = freshT()); if (!q.parts) q.parts = {}; return q; };
  const GQ = () => quest.gnash || (quest.gnash = freshG());
  HOOKS.newGame.push(() => { quest.tinker = freshT(); quest.gnash = freshG(); });
  QUEST_DEFS.tinker = { name: 'A Tinker Gone Wrong' };
  QUEST_DEFS.gnash = { name: 'Gold for Gnash' };
  const partsHeld = () => PART_IDS.filter(id => countItem(id) > 0).length;
  HOOKS.questText.tinker = () => {
    const q = TQ();
    if (q.stage >= 3) return "Done. The lever in Tinkerton's lab (the Arena now) wakes the Gnasher again: 150 coins a rematch.";
    if (q.stage === 2) return "The Gnasher is loose inside Tinkerton's lab, east of Grubmarket. Bring it down.";
    if (q.stage === 1) { const got = PART_IDS.filter(id => q.parts[id]).length; return `Parts for the Gnasher (${got}/4): Grubb (5 cooked beef), Nix (10 goblin scrap), Old Snaggle (3 spider silk), Pip-squeak (bread). Carry them (${partsHeld()}/4) to Tinkerton's lab, east of the market.`; }
    return 'Tinkerton, outside the gate of Castle Gnash, wants help building a machine.';
  };
  HOOKS.questText.gnash = () => GQ().tribute ? 'Done.' : `Bring King Gnash 500 coins of tribute (you carry ${coins()}). His guards do not like visitors who have not paid.`;
  HOOKS.activeQuests.push(() => { const out = []; const t = TQ().stage; if (t === 1 || t === 2) out.push('tinker'); const g = GQ(); if (g.stage === 1 && !g.tribute) out.push('gnash'); return out; });
  if (HOOKS.mapTarget) {
    HOOKS.mapTarget.push(() => { const q = TQ(); if (q.stage === 1 || q.stage === 2) return { x: LAB_STEP.x, y: LAB_STEP.y, label: q.stage === 1 ? "Tinkerton's lab" : 'The Gnasher', id: 'tinker' }; return null; });
    HOOKS.mapTarget.push(() => activeQuests().includes('gnash') ? { x: THRONE_T.x, y: THRONE_T.y, label: 'King Gnash', id: 'gnash' } : null);
  }

  // ---------- the goblin townsfolk (own list: never wander, drawn as goblins, talked to through HOOKS.use) ----------
  const FAVOURS = {
    grubb: { item: 'cooked_beef', n: 5, part: 'boiler', ask: "Five cooked beef and the boiler's yours. It's the one I boil the soup in. I'll boil it in something else.", thanks: 'Five! Beef! Cooked! Take the boiler, take it, and tell Tinkerton it had better not explode.' },
    nix: { item: 'goblin_scrap', n: 10, part: 'gear_wheel', ask: "Ten goblin scrap. Ten. I know a gear wheel when I've got one, and I've got one, and it's under ten scrap somewhere.", thanks: 'Ten scrap. Lovely. Heavy. Here, the gear wheel. Mind the teeth.' },
    snaggle: { item: 'spider_silk', n: 3, part: 'bomb_chute', ask: 'Three spider silk, for my pillow. Then the chute. It was a drainpipe once. Tinkerton says it is a bomb chute now.', thanks: 'Silk. Soft. Three of them. The chute is behind the bed. Take it before I fall asleep on it.' },
    pip: { item: 'bread', n: 1, part: 'lightning_coil', ask: "I found a shiny coil. It BUZZES. I'll swap it for bread. Real bread. Not goblin bread.", thanks: 'BREAD! Here, take the buzzy thing. It made my hair stand up. Look at my hair.' },
  };
  const FOLK = [
    { id: 'tinkerton', name: 'Tinkerton', role: 'tinker', look: { tunic: '#6a5a8a', apron: true, hat: 'goggles' } },
    { id: 'grubb', name: 'Grubb the cook', x: 216, y: 23, role: 'grubb', look: { tunic: '#8a3a2a', apron: true, hat: 'chef', fat: true },
      lines: ['Soup. Goblin soup. Do not ask what is in it.', 'Tinkerton keeps asking for my boiler. My BOILER.', 'Cooked beef. Bring me cooked beef and we will talk.'], after: ['The soup tastes wrong without the boiler. Better, but wrong.', 'Did it explode yet? The boiler. Did it?'] },
    { id: 'nix', name: 'Nix the scrapper', x: 230, y: 23, role: 'nix', look: { tunic: '#4a4a52', apron: true, hat: 'cap' },
      lines: ['Scrap. I buy it, I sort it, I sit on it.', 'The yard out east has two walkers and a dozer. Ours. Do not poke them.', 'Tinkerton wants my best gear wheel. Everyone wants my best gear wheel.'], after: ['That gear wheel came off a walker. A good one.', 'More scrap? Always more scrap.'] },
    { id: 'snaggle', name: 'Old Snaggle', x: 216, y: 37, role: 'snaggle', look: { tunic: '#4a5a3a', hat: 'hood', beard: true },
      lines: ['I was on the ship that hit Ironclad Isle. I do not talk about it.', 'The king sits on his gold and the gold sits on the floor. Somebody should sit on the king.', 'My pillow is straw. Straw! Spider silk, now, that is a pillow.'], after: ['Silk pillow. Best sleep in forty years.', 'Tell Tinkerton the chute leaks. It always leaked.'] },
    { id: 'pip', name: 'Pip-squeak', x: 222, y: 33, role: 'pip', look: { tunic: '#c89a4a', hat: 'cap', small: true },
      lines: ["Are you a KNIGHT? A real one? Do you have a HORSE?", 'I found a shiny thing in the scrap yard. It buzzes.', 'Grubb says the sea is full of lobsters. I have never seen a lobster.'], after: ['My hair is still up. Look. LOOK.', 'When I am big I will build a machine too. A small one. A nice one.'] },
    { id: 'gnash', name: 'King Gnash', x: THRONE_T.x, y: THRONE_T.y, role: 'gnash', look: { tunic: '#7a2e2e', hat: 'crown', fat: true, cape: true }, sortY: 10 },
    { id: 'mudge', name: 'Mudge', x: 234, y: 32, role: 'folk', look: { tunic: '#5a6a4a', hat: 'cap' },
      lines: ['Forty coins Harl charges. FORTY. For a rowing boat.', 'The castle guards are only rude if you go inside without paying.', 'Grubmarket. Best market on the Far Shore. Only market on the Far Shore.'] },
    { id: 'skritch', name: 'Skritch', x: 219, y: 27, role: 'folk', look: { tunic: '#7a4a6a', apron: true, hat: 'hood' },
      lines: ['Trinkets, buttons, teeth. No, not for sale. Just looking at them.', 'The Duke over the water pays for scrap, they say. Nix pays better.', 'Tinkerton? Lives out past the scrap yard. Big wall. He built the wall after the last machine.'] },
    { id: 'ratchet', name: 'Ratchet', x: 230, y: 27, role: 'folk', look: { tunic: '#4a5a7a', hat: 'cap', beard: true },
      lines: ['I sell rope. Nobody buys rope. I have a lot of rope.', 'King Gnash counted his gold last week. It took a week.', 'The walkers in the yard are ours. The ones on your side of the sea were ours too, once.'] },
  ];
  // where a goblin stands right now, or null when out of reach (Tinkerton moves from the castle gate to his lab; nobody outside is reachable from inside a dungeon)
  const folkTile = n => {
    if (n.role === 'tinker') return TQ().stage === 0 ? (hidden() ? null : TINK_GATE) : (inLab() ? TINK_LAB : null);
    return hidden() ? null : { x: n.x, y: n.y };
  };
  const folkPx = n => { const t = folkTile(n); return t ? { px: tc(t.x), py: tc(t.y) } : null; };
  if (typeof TAP_PEOPLE !== 'undefined') TAP_PEOPLE.push(() => FOLK.map(n => { const p = folkPx(n); return p && { x: p.px, y: p.py, r: 13, id: n.id, name: n.name, talk: () => gcTalk(n) }; }).filter(Boolean)); // 17-tap: a tap on a townsgoblin walks up and talks
  function folkInFront() {
    let best = null;
    for (const n of FOLK) {
      const p = folkPx(n); if (!p) continue;
      const dd = dist(player.x, player.y, p.px, p.py); if (dd > 100) continue;
      const dot = ((p.px - player.x) * player.facing.x + (p.py - player.y) * player.facing.y) / (dd || 1);
      if (dot < 0.2 && dd > 30) continue;
      if (!best || dd < best.dd) best = { n, dd };
    }
    return best ? best.n : null;
  }
  const liveGnasher = () => monsters.find(m => m.type === 'gnasher' && !m.dead) || null;
  const guards = () => monsters.filter(m => m.type === 'castle_guard');
  const calmGuards = () => { for (const m of guards()) if (!m.dead) { m.angry = false; if (m.state === 'chase') m.state = 'return'; } };
  function gcTalk(n) {
    { const p = folkPx(n); if (p) { const dx = p.px - player.x, dy = p.py - player.y, dd = Math.hypot(dx, dy) || 1; player.facing = { x: dx / dd, y: dy / dd }; } }
    const tq = TQ();
    if (n.role === 'tinker') {
      if (tq.stage === 0) {
        tq.stage = 1; sfx('quest');
        say('A knight! From over the water! Perfect. PERFECT. I am Tinkerton, and I am building a machine.', n.name);
        say('The Gnasher. Iron body on treads, a boiler, two arms, and a chute that drops bombs. King Gnash says it is a waste of scrap. King Gnash is wrong.', n.name);
        say('I need four parts, and four goblins in Grubmarket have them. Grubb the cook wants cooked beef. Nix the scrapper wants scrap. Old Snaggle wants spider silk. Pip-squeak wants bread.', n.name);
        say('Bring all four to my lab. East of the market, past the scrap yard, inside the big wall. You cannot miss the wall. I built it after the last machine.', n.name);
        levelBanner = { text: 'NEW QUEST', sub: 'A Tinker Gone Wrong', t: 3 }; save();
      } else if (tq.stage === 1) {
        if (PART_IDS.every(id => countItem(id) > 0)) buildGnasher(n);
        else { const missing = PART_IDS.filter(id => countItem(id) === 0).map(id => ITEMS[id].name.toLowerCase()); say(`Not yet. I still need the ${missing.join(', the ')}. ${missing.length === 4 ? 'Grubb, Nix, Old Snaggle and Pip-squeak, in the market.' : 'Bring everything at once; I do not build in halves.'}`, n.name); }
      } else if (tq.stage === 2) say(liveGnasher() ? 'It is ALIVE. It is right there. It is not listening to me. Hit it, knight. Hit the boiler. Hit anything!' : 'Where did it go? It was right there. Give it a moment, it will be back.', n.name);
      else { say(tq.kills ? 'Back for another round? The lever wakes it. I keep the coins in the boiler.' : 'You broke it. Good. I mean, bad, but good. Powder, scrap, hammers. Buy something. And pull the lever if you ever miss it.', n.name); openPanel('tinkerton'); }
    } else if (FAVOURS[n.role]) {
      const f = FAVOURS[n.role];
      if (tq.stage === 0) say(pick(n.lines), n.name);
      else if (!tq.parts[f.part]) {
        if (countItem(f.item) >= f.n) {
          if (!canFit(f.part, 1)) { notify('Your pack is full.'); return; }
          removeItem(f.item, f.n); tq.parts[f.part] = true; addItem(f.part, 1);
          floatText(player.x, player.y - 30, `+${ITEMS[f.part].name}`, ITEMS[f.part].color); burst(player.x, player.y, '#ffe066', 12, 90); sfx('pickup');
          say(f.thanks, n.name);
          if (PART_IDS.every(id => tq.parts[id])) say("That is all four parts. Tinkerton's lab is east of the market, past the scrap yard, inside the wall. Go in through the door.", 'The Voice');
          save();
        } else say(`${f.ask} (${countItem(f.item)}/${f.n})`, n.name);
      } else say(pick(n.after), n.name);
    } else if (n.role === 'gnash') {
      const gq = GQ();
      if (gq.stage === 0) {
        gq.stage = 1; sfx('quest');
        say('A KNIGHT. In MY keep. Standing on MY rug. Guards! No. Wait. Knights have coins.', n.name);
        say('Tribute. Five hundred coins, and my guards forget your face for good. Pay it and my treasury opens to you. Once. Refuse, and they do not forget.', n.name);
        levelBanner = { text: 'NEW QUEST', sub: 'Gold for Gnash', t: 3 }; save();
      } else if (!gq.tribute) {
        if (coins() >= 500 && payCoins(500)) {
          gq.tribute = true; calmGuards(); burst(player.x, player.y, '#f5c542', 24, 120); sfx('coins');
          say('Five hundred. Counted. Counted again. Good. Guards, this one is a friend of the crown. The chest behind me, knight. Once.', n.name);
          levelBanner = { text: 'QUEST COMPLETE', sub: 'Gold for Gnash', t: 3 }; save();
        } else say(`Five hundred coins, knight. You carry ${coins()}. Guards. Watch that one.`, n.name);
      } else say(gq.treasury ? 'The treasury was open. Was. Go and buy something in Grubmarket; it all comes back to me anyway.' : 'The chest behind me. Once. Then we never speak of it.', n.name);
    } else say(pick(n.lines), n.name);
  }

  // ---------- the Gnasher ----------
  function spawnGnasher() {
    const d = MONSTER_DEFS.gnasher; const sp = safeSpot(tc(GN_HOME.x), tc(GN_HOME.y), d.r, 'beast') || { x: tc(GN_HOME.x), y: tc(GN_HOME.y) };
    const m = { type: 'gnasher', x: sp.x, y: sp.y, home: { x: sp.x, y: sp.y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: true, state: 'idle', wanderT: 1,
      wander: { x: 0, y: 0 }, attackCd: 1, hurtT: 0, dead: false, deadT: 0, respawnT: Infinity, facing: { x: 0, y: 1 }, walkT: 0, moving: false, stunT: 0, armT: 0, armCd: GN_ARM_EVERY, bombCd: GN_BOMB_EVERY, armSide: 1, bombs: 0, swings: 0 };
    monsters.push(m); burst(m.x, m.y, '#ff8a1a', 30, 160); burst(m.x, m.y, '#8f96a3', 20, 120); sfx('boom');
    return m;
  }
  function buildGnasher(n) {
    const tq = TQ();
    for (const id of PART_IDS) removeItem(id, 1);
    tq.stage = 2; tq.parts = { boiler: true, gear_wheel: true, bomb_chute: true, lightning_coil: true };
    say('The boiler. The wheel. The chute. The coil! Give them here, give them, hold that, no, THAT...', n.name);
    say('Boiler in the body. Wheel on the axle. Chute on top. And the coil goes... here.', n.name);
    say('A thump. A hiss. The thing on the floor sits up on its treads and turns its lamps on you.', 'The Voice');
    say("It's ALIVE. It's alive! It's... it's not stopping. Why is it not stopping? Knight! Away from my shelves!", n.name);
    if (inLab()) spawnGnasher(); levelBanner = { text: 'THE GNASHER WAKES', sub: 'Bring it down', t: 4 }; save();
  }
  HOOKS.hit.push(m => { if (m.type === 'gnasher') burst(m.x, m.y - 8, '#8f96a3', 5, 70); });
  HOOKS.kill.push(m => {
    if (m.type !== 'gnasher') return;
    const tq = TQ();
    burst(m.x, m.y, '#ff8a1a', 40, 220); burst(m.x, m.y, '#3a3a3a', 24, 140);
    if (tq.stage === 2) {
      tq.stage = 3; giveOrDrop('coins', 400, player.x, player.y); giveOrDrop('tinker_goggles', 1, player.x, player.y);
      if (!HAS_INST && tileAt(LEVER_T.x, LEVER_T.y) !== GC_LEVER) changeTile(LEVER_T.x, LEVER_T.y, GC_LEVER);
      say('The Gnasher stops. Its arms drop. The boiler sighs once and goes quiet.', 'The Voice');
      say('It worked! It WORKED. For a bit. Four hundred coins, knight, and my spare goggles. And the lever in the corner: when you miss it, pull it. I can always build it again.', 'Tinkerton');
      levelBanner = { text: 'QUEST COMPLETE', sub: 'A Tinker Gone Wrong', t: 3.5 }; sfx('quest');
    } else if (tq.rematch) {
      tq.rematch = false; tq.kills = (tq.kills || 0) + 1;
      giveOrDrop('coins', 150, player.x, player.y); giveOrDrop('goblin_scrap', 5, player.x, player.y);
      levelBanner = { text: 'REMATCH WON', sub: `The Gnasher, ${tq.kills + 1} times`, t: 3 };
      say(pick(['Down again. Tinkerton pays out of the boiler: 150 coins and a handful of scrap.', 'The Gnasher folds. Coins and scrap, as promised. The lever waits.']), 'The Voice');
    }
    save();
  });
  function pullLever() {
    const tq = TQ();
    if (tq.stage < 3) { notify(tq.stage === 2 ? 'The lever is already down. The Gnasher is awake.' : 'A lever, not yet connected to anything. Tinkerton is still building.'); return; }
    if (liveGnasher()) { notify('The Gnasher is already awake. Deal with that one first.'); return; }
    tq.rematch = true; const m = spawnGnasher(); floatText(m.x, m.y - m.r - 30, 'REMATCH', '#ff8a1a', 16);
    say('The lever clanks down. The boiler catches, the lamps come on, and the Gnasher sits up.', 'The Voice'); save();
  }

  // ---------- the lab interior (an instance behind the hut door) ----------
  if (HAS_INST) {
    window.INSTANCES.define(INST_ID, {
      name: "Tinkerton's Lab", sub: 'Every shelf a machine that did not work', w: LAB_W, h: LAB_H, dark: false, boss: 'gnasher', spawns: [],
      entry: LAB_ENTRY, exit: LAB_EXIT, door: [LAB_DOOR.x, LAB_DOOR.y], step: [LAB_STEP.x, LAB_STEP.y],
      voice: "Tinkerton's lab. Every shelf is a machine that did not work. The floor is where he builds the next one.",
      build: (set, rnd, at) => {
        for (let y = 0; y < LAB_H; y++) for (let x = 0; x < LAB_W; x++) set(x, y, (x === 0 || y === 0 || x === LAB_W - 1 || y === LAB_H - 1) ? T.HWALL : T.FLOOR);
        // the stations along the north wall, shelves of failures, a bench, a rug where the machine is built
        for (const [x, t] of [[3, T.WORKBENCH], [5, T.WORKSHOP], [7, T.ALCHEMY], [9, T.SHELF], [10, T.SHELF], [14, T.SHELF], [15, T.SHELF], [17, T.FORGE], [19, T.ANVIL]]) set(x, 1, t);
        for (const [x, y, t] of [[1, 5, T.TABLE], [1, 6, T.TABLE], [22, 5, T.SHELF], [22, 6, T.SHELF], [22, 11, T.TABLE], [1, 12, T.SHELF], [1, 13, T.SHELF], [20, 2, T.RUBBLE], [21, 3, T.PLANK], [2, 9, T.RUBBLE], [21, 8, T.RUBBLE], [3, 15, T.PLANK], [2, 15, T.PLANK], [21, 14, T.TABLE]]) set(x, y, t);
        for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) set(GN_HOME.x + dx, GN_HOME.y + dy, T.RUG);
        set(LEVER_T.x, LEVER_T.y, GC_LEVER);
      },
    });
  }

  // ---------- world ----------
  HOOKS.world.push((rnd, api) => {
    const set = (x, y, t) => { if (KEEP_TILES.has(api.tileAt(x, y)) || buildingAt(x, y)) return; api.setTile(x, y, t); };
    const fill = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
    const ring = (x0, y0, x1, y1, t) => { for (let x = x0; x <= x1; x++) { set(x, y0, t); set(x, y1, t); } for (let y = y0; y <= y1; y++) { set(x0, y, t); set(x1, y, t); } };
    // the land: clear it, then a strait of water on the west, a rocky shore, scrub on the outskirts
    fill(FS.x0, FS.y0, FS.x1, FS.y1, T.GRASS);
    fill(STRAIT.x0, STRAIT.y0, STRAIT.x1, STRAIT.y1, T.WATER);
    fill(SHORE.x0, FS.y0, SHORE.x1, FS.y1, T.SAND);
    for (let y = FS.y0; y <= FS.y1; y++) for (let x = SHORE.x0 + 1; x <= SHORE.x1 + 2; x++) { if (Math.abs(y - LANDING.y) <= 3) continue; if (rnd() < 0.3) set(x, y, T.ROCK); }
    for (let y = FS.y0; y <= FS.y1; y++) for (let x = SHORE.x1 + 3; x <= FS.x1; x++) {
      if (inRect(GM, x, y) || inRect(CG, x, y) || (Math.abs(y - LANDING.y) <= 3 && x <= GM.x0 + 4)) continue;
      const r = rnd(); if (r < 0.10) set(x, y, rnd() < 0.3 ? T.OAK : T.TREE); else if (r < 0.15) set(x, y, T.ROCK); else if (r < 0.17) set(x, y, T.FLOWERS);
    }
    if (T.SEAROCK !== undefined) for (const [x, y] of [[201, 10], [202, 50], [200, 70], [201, 88], [202, 22]]) if (api.tileAt(x, y) === T.WATER) api.setTile(x, y, T.SEAROCK);
    // roads: the landing to the market lane; the lane; the street south to the castle; east to the scrap yard and the lab
    fill(LANDING.x + 1, LANDING.y - 1, GM.x0 + 3, LANDING.y + 1, T.DIRT);
    fill(GM.x0 + 4, 29, 239, 31, T.COBBLE);
    fill(224, 18, 225, RING.y0 - 1, T.COBBLE);
    fill(226, 25, YARD.x0 - 1, 27, T.DIRT);
    fill(226, 43, LAB.x0 - 1, 45, T.DIRT);
    // the market square: dirt, a fire, stalls; every hut gets a clear doorstep
    fill(217, 32, 223, 35, T.DIRT); set(FIRE_T.x, FIRE_T.y, T.FIRE);
    for (const [x, y] of STALLS) set(x, y, T.STALL);
    for (const b of HUTS) { if (b.door !== undefined) set(b.x + b.door, b.y + b.h, T.DIRT); if (b.doorTop !== undefined) set(b.x + b.doorTop, b.y - 1, T.DIRT); }
    // the scrap yard: a fence, a gate on the market side, dirt and junk, three machines that mind their own business
    fill(YARD.x0, YARD.y0, YARD.x1, YARD.y1, T.DIRT); ring(YARD.x0, YARD.y0, YARD.x1, YARD.y1, T.FENCE); set(YARD.gate[0], YARD.gate[1], T.GATE);
    for (let y = YARD.y0 + 1; y < YARD.y1; y++) for (let x = YARD.x0 + 1; x < YARD.x1; x++) { const r = rnd(); if (r < 0.06) set(x, y, T.RUBBLE); else if (r < 0.09) set(x, y, T.PLANK); }
    for (const [x, y] of [...YARD_WALKERS, ...YARD_DOZER]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(x + dx, y + dy, T.DIRT);
    // Castle Gnash: a stone ring with a portcullis facing the town, a cobbled yard, the keep (a building), a fire
    fill(RING.x0, RING.y0, RING.x1, RING.y1, T.COBBLE); ring(RING.x0, RING.y0, RING.x1, RING.y1, T.CWALL);
    for (const [x, y] of PORTCULLIS) set(x, y, T.PORTCULLIS);
    set(231, 58, T.FIRE); set(216, 58, T.DUMMY); set(216, 60, T.DUMMY);
    // Tinkerton's compound: the stone wall he built after the last machine, a gate on the town side, dirt inside; the hut door leads into the lab
    fill(LAB.x0, LAB.y0, LAB.x1, LAB.y1, T.DIRT); ring(LAB.x0, LAB.y0, LAB.x1, LAB.y1, T.CWALL); set(LAB.gate[0], LAB.gate[1], T.GATE);
    for (const [x, y] of [[254, 38], [255, 39], [242, 49], [254, 49]]) set(x, y, T.RUBBLE);
    if (!HAS_INST && TQ().stage >= 3) set(LEVER_T.x, LEVER_T.y, GC_LEVER);
    // nothing from the mainland spawns here; the guards and the yard machines do
    for (let i = MONSTER_SPAWNS.length - 1; i >= 0; i--) { const s = MONSTER_SPAWNS[i]; if (s.tx >= STRAIT.x0 && inRect({ x0: STRAIT.x0, y0: FS.y0, x1: FS.x1, y1: FS.y1 }, s.tx, s.ty)) MONSTER_SPAWNS.splice(i, 1); }
    api.spawnList('castle_guard', [...KEEP_GUARDS, ...GATE_GUARDS]);
    api.spawnList('yard_walker', YARD_WALKERS); api.spawnList('yard_dozer', YARD_DOZER);
  });

  // ---------- use: townsfolk, the treasury, the throne, the gold, the lever ----------
  HOOKS.use.push((t, tx, ty) => {
    const n = folkInFront();
    if (n) { gcTalk(n); return true; }
    if (t === GC_CHEST) {
      const gq = GQ();
      if (!gq.tribute) { notify("King Gnash's treasury. His guards would have your hands off. Pay the tribute first."); return true; }
      if (gq.treasury) { notify('The treasury chest. Empty. The king said once, and he meant it.'); return true; }
      gq.treasury = true;
      for (const [id, q] of [['steel_bar', 3], ['mithril_bar', 2], ['gnash_crown', 1]]) if (ITEMS[id]) giveOrDrop(id, q, player.x, player.y);
      burst(tc(tx), tc(ty), '#f5c542', 24, 110); levelBanner = { text: 'TREASURY OPENED', sub: 'Castle Gnash', t: 3 }; sfx('coins');
      say('Three steel bars, two bars of blue mithril, and a crown that has never fitted any goblin head. King Gnash watches you take every piece.', 'The Voice'); save();
      return true;
    }
    if (t === GC_LEVER) { pullLever(); return true; }
    if (t === GC_THRONE) { notify("King Gnash's throne. He is on it. Speak to him."); return true; }
    if (t === GC_GOLD) { notify("King Gnash's gold. He is counting it. He is always counting it."); return true; }
    return false;
  });

  // ---------- update: arrival, the guards, the Gnasher's arms and bombs, the arena sign ----------
  HOOKS.update.push(dt => {
    const tq = TQ(), gq = GQ(), bq = quest.boats;
    if (bq && bq.where === 'farshore' && !bq.sailing && !tq.visited) { tq.visited = true; say('The Far Shore. Goblin country, all of it. But look: shops. A market. A castle with a king in it. Not every goblin carries a spear, knight. Some carry ledgers.', 'The Voice'); save(); }
    // the sign over the lab changes once it is an arena
    if (tq.stage >= 3 && LAB_HUT.sign !== 'ARENA') { LAB_HUT.sign = 'ARENA'; LAB_HUT.name = 'The Arena'; }
    else if (tq.stage < 3 && LAB_HUT.sign !== 'TINKER') { LAB_HUT.sign = 'TINKER'; LAB_HUT.name = "Tinkerton's Lab"; }
    // the king's guards: hostile while you stand in the keep before the tribute; friends of the crown after it
    if (!player.dead && !window.__peace && !hidden()) {
      const b = insideBuilding(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
      const trespass = !gq.tribute && b === KEEP;
      if (trespass) {
        for (const m of guards()) if (!m.dead && !m.angry) { m.angry = true; m.state = 'chase'; floatText(m.x, m.y - m.r - 22, 'INTRUDER', '#ff6b6b', 12); }
        if (!gq.warned) { gq.warned = true; say(gq.stage === 0 ? 'Who let a knight in here? GUARDS. Bring it to me. Alive, it might have coins.' : 'Still no tribute? Guards!', 'King Gnash'); }
      } else if (gq.warned && !b) gq.warned = false;
      if (gq.tribute && guards().some(m => m.angry && m.hurtT <= 0 && !m.dead && m.state !== 'chase')) calmGuards();
    }
    // the Gnasher: spawn on demand in the lab (a loaded save mid-fight, a rematch, a second visit), arms every 2 s within 1.5 tiles, a bomb every 5 s, and its corpse leaves the list
    if ((tq.stage === 2 || tq.rematch) && inLab() && !liveGnasher()) spawnGnasher();
    let gone = false;
    for (const m of monsters) {
      if (m.type !== 'gnasher') continue;
      if (m.dead) { if (m.deadT > 1.2) { m.gone = true; gone = true; } continue; }
      m.armT = Math.max(0, (m.armT || 0) - dt); m.armCd = (m.armCd ?? GN_ARM_EVERY) - dt; m.bombCd = (m.bombCd ?? GN_BOMB_EVERY) - dt;
      const dp = dist(m.x, m.y, player.x, player.y), chasing = m.state === 'chase' && !window.__peace && !player.dead;
      if (!chasing) continue;
      const dx = player.x - m.x, dy = player.y - m.y, d = dp || 1;
      const dot = (dx * m.facing.x + dy * m.facing.y) / d;
      if (m.armCd <= 0 && dp <= m.r + GN_ARM_REACH && dot > 0.2) {
        m.armCd = GN_ARM_EVERY; m.armT = 0.35; m.armSide = -(m.armSide || 1); m.swings = (m.swings || 0) + 1;
        const dmg = rollHit((MONSTER_DEFS.gnasher.att + 8) * 64, playerDefRoll(), MONSTER_DEFS.gnasher.maxHit);
        hurtPlayer(dmg, m.x, m.y); burst(m.x + m.facing.x * 40, m.y + m.facing.y * 40, '#8f96a3', 8, 80); sfx('swing');
      }
      if (m.bombCd <= 0 && dp <= 6 * TILE && dp > 0.75 * TILE) {
        m.bombCd = GN_BOMB_EVERY; m.attackT = 0.2; m.bombs = (m.bombs || 0) + 1; const sp = 240;
        projectiles.push({ kind: 'sticky', x: m.x + m.facing.x * 10, y: m.y - 22, vx: dx / d * sp, vy: dy / d * sp, t: 0, life: dp / sp, fuse: 1.3, owner: 'monster' });
        burst(m.x, m.y - 26, '#3a3a3a', 6, 60);
      }
    }
    if (gone) monsters = monsters.filter(m => !m.gone);
  });

  // ---------- panel: Tinkerton's shop, and the Barrelbeast re-supply when another feature provides window.BEAST ----------
  const beastLost = () => { try { return !!(window.BEAST && typeof window.BEAST.lost === 'function' && window.BEAST.lost()); } catch (e) { return false; } };
  HOOKS.panel.tinkerton = (g, narrow) => {
    const shop = SHOPS.tinkerton; const lost = beastLost(); const rows = shop.stock.length + (lost ? 1 : 0);
    const { px, py, w, h } = panelBox(g, 460, 150 + rows * 38, shop.name, `${coins()} coins · powder, scrap and hammers${lost ? ' · and a Barrelbeast' : ''}`);
    shop.stock.forEach(([id, price], i) => {
      const y = py + 62 + i * 38; const def = ITEMS[id]; const can = coins() >= price;
      roundRect(g, px + 18, y, w - 36, 32, 8); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill();
      drawItemIcon(g, id, px + 38, y + 16, 18);
      g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(def.name, px + 58, y + 20);
      if (!narrow) { g.fillStyle = '#8b949e'; g.font = '11px sans-serif'; let bl = itemBlurb(def) || ''; while (g.measureText(bl).width > w - 330 && bl.length > 8) bl = bl.slice(0, -2) + '…'; g.fillText(bl, px + 190, y + 20); }
      button(g, px + w - 120, y + 3, 96, 26, `Buy ${price}`, () => { if (!payCoins(price)) { notify('Not enough coins.'); return; } if (addItem(id, 1) > 0) { addItem('coins', price); notify('Your pack is full.'); return; } floatText(player.x, player.y - 30, `Bought ${def.name}`, def.color); sfx('coins'); save(); }, can ? '#238636' : '#2a2f3a', can);
    });
    if (lost) {
      const y = py + 62 + shop.stock.length * 38; const can = coins() >= 200;
      roundRect(g, px + 18, y, w - 36, 32, 8); g.fillStyle = 'rgba(255,179,71,0.10)'; g.fill();
      g.fillStyle = '#ffb347'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText('Bring back the Barrelbeast (200 coins)', px + 30, y + 20);
      button(g, px + w - 120, y + 3, 96, 26, 'Rebuild 200', () => {
        if (!beastLost()) { notify('The Barrelbeast is not lost.'); return; }
        if (hidden()) { notify('Tinkerton builds it outside, in the yard. Come back out and ask again.'); return; } // the yard tile is on the overworld, not in the lab's map
        if (!payCoins(200)) { notify('Tinkerton wants 200 coins for that. You have ' + coins() + '.'); return; }
        let ok = false; try { ok = window.BEAST.giveTile(BEAST_T.x, BEAST_T.y) !== false; } catch (e) { ok = false; }
        if (!ok) { addItem('coins', 200); notify('Tinkerton could not rebuild it. Your coins are returned.'); return; }
        burst(tc(BEAST_T.x), tc(BEAST_T.y), '#ffb347', 30, 140); sfx('boom');
        say('Two hundred coins and a night with a hammer. It is in the yard by my wall, knight. Try not to lose it in the sea this time.', 'Tinkerton'); closePanel(); save();
      }, can ? '#b8641a' : '#2a2f3a', can);
    }
    button(g, px + 18, py + h - 46, w - 36, 32, 'Close', closePanel, '#21262d');
  };

  // ---------- drawing ----------
  // a townsfolk goblin: the soldier's green body and pointed ears, but aprons, hats, a beard, a crown — nobody here carries a sword
  function drawGob(g, e, look, hurt) {
    const fx = e.facing.x, fy = e.facing.y, s = look.small ? 0.72 : look.fat ? 1.2 : 1;
    g.save(); g.scale(s, s);
    if (look.cape) { g.fillStyle = '#4a1e1e'; g.beginPath(); g.moveTo(-12, -4); g.quadraticCurveTo(-16, 10, -10, 16); g.lineTo(10, 16); g.quadraticCurveTo(16, 10, 12, -4); g.closePath(); g.fill(); }
    g.fillStyle = hurt ? '#ffb0b0' : look.tunic; g.beginPath(); g.ellipse(0, 3, look.fat ? 13 : 11, 10, 0, 0, 7); g.fill();
    if (look.apron) { g.fillStyle = look.apronColor || '#d9d0c0'; g.beginPath(); g.ellipse(0, 6, 6.5, 6.5, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-4, 4); g.lineTo(4, 4); g.stroke(); }
    if (look.spear) { g.save(); g.rotate(Math.atan2(fy, fx) + (e.attackT > 0 ? -0.2 : 0.75)); g.fillStyle = '#8a6a3a'; g.fillRect(-12, -1.5, 36, 3); g.fillStyle = '#c9ccd3'; g.beginPath(); g.moveTo(24, -4); g.lineTo(33, 0); g.lineTo(24, 4); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle = hurt ? '#ffc0c0' : (look.skin || '#8ad35a'); g.beginPath(); g.arc(0, -7, 8, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-7, -9); g.lineTo(-16, -14); g.lineTo(-6, -4); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(7, -9); g.lineTo(16, -14); g.lineTo(6, -4); g.closePath(); g.fill();
    if (look.beard) { g.fillStyle = '#d9d0c0'; g.beginPath(); g.ellipse(0, -1, 6, 4.5, 0, 0, Math.PI); g.fill(); }
    g.fillStyle = look.eyes || '#d62828'; g.beginPath(); g.arc(-3 + fx * 2, -7 + fy * 2, 1.7, 0, 7); g.arc(3 + fx * 2, -7 + fy * 2, 1.7, 0, 7); g.fill();
    const hat = look.hat;
    if (hat === 'chef') { g.fillStyle = '#f2f2ec'; g.fillRect(-7, -16, 14, 5); g.beginPath(); g.ellipse(0, -18, 9, 6, 0, 0, 7); g.fill(); }
    else if (hat === 'cap') { g.fillStyle = '#5a3a1e'; g.beginPath(); g.arc(0, -10, 8.5, Math.PI, 0); g.fill(); g.fillRect(-2, -12, 12, 3); }
    else if (hat === 'hood') { g.fillStyle = '#3a3a2a'; g.beginPath(); g.arc(0, -9, 9.5, Math.PI * 0.95, Math.PI * 2.05); g.fill(); g.fillRect(-9.5, -10, 19, 4); }
    else if (hat === 'goggles') { g.fillStyle = '#8a6a3a'; g.beginPath(); g.arc(0, -10, 9, Math.PI, 0); g.fill(); g.fillStyle = '#3a2a1a'; g.fillRect(-9, -11, 18, 3); g.fillStyle = '#7ec8ff'; g.beginPath(); g.arc(-3.5, -10, 2.6, 0, 7); g.arc(3.5, -10, 2.6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(-4.5, -11, 0.9, 0, 7); g.arc(2.5, -11, 0.9, 0, 7); g.fill(); }
    else if (hat === 'crown') { g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(-8, -12); g.lineTo(-8, -20); g.lineTo(-4, -15); g.lineTo(0, -22); g.lineTo(4, -15); g.lineTo(8, -20); g.lineTo(8, -12); g.closePath(); g.fill(); g.fillStyle = '#c0504d'; g.beginPath(); g.arc(0, -15, 1.6, 0, 7); g.fill(); }
    else if (hat === 'helm') { g.fillStyle = '#5a5a62'; g.beginPath(); g.arc(0, -9, 9, Math.PI, 0); g.fill(); g.fillRect(-9, -9, 18, 3); g.fillStyle = '#8f96a3'; g.fillRect(-1, -20, 2, 11); }
    else { g.strokeStyle = '#4a3a2a'; g.lineWidth = 2; g.beginPath(); g.arc(0, -8, 8.5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    g.restore();
  }
  function drawFolk(g, n, p) {
    const e = { x: p.px, y: p.py, r: 12, facing: n.facing || { x: 0, y: 1 }, hurtT: 0, attackT: 0 };
    const near = dist(player.x, player.y, e.x, e.y) < 110;
    if (near) e.facing = { x: Math.sign(player.x - e.x) || 0, y: Math.sign(player.y - e.y) || 1 };
    g.save(); g.translate(e.x, e.y + (n.role === 'gnash' ? -6 : 0));
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 10, n.look.small ? 8 : 12, 5, 0, 0, 7); g.fill();
    drawGob(g, e, n.look, false);
    if (n.role === 'tinker' && TQ().stage === 1) { const bob = Math.sin(time * 4) * 2; g.font = `800 14px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText('?', 0, -28 + bob); g.fillStyle = '#f5c542'; g.fillText('?', 0, -28 + bob); }
    g.restore();
    if (near) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(n.name, e.x, e.y - 26); g.fillStyle = '#ffe9a8'; g.fillText(n.name, e.x, e.y - 26); }
  }
  HOOKS.drawMonster.castle_guard = (g, e, hurt) => drawGob(g, e, { tunic: '#7a2e2e', hat: 'helm', spear: true, apron: false }, hurt);
  HOOKS.drawMonster.yard_walker = (g, e, hurt) => drawMech(g, e, hurt, null);
  HOOKS.drawMonster.yard_dozer = HOOKS.drawMonster.bulldozer || ((g, e, hurt) => drawMech(g, e, hurt, null));
  // the Gnasher: a boxy riveted iron body on two treads, a boiler on the back, a bomb chute on top, two piston arms that swing, and two red lamps
  HOOKS.drawMonster.gnasher = (g, e, hurt) => {
    const ang = Math.atan2(e.facing.y, e.facing.x), c = Math.cos(ang), s = Math.sin(ang), t = time;
    g.save(); g.rotate(ang);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(4, 8, 44, 34, 0, 0, 7); g.fill();
    // treads: iron shoes scroll with walkT
    const off = (e.walkT * 3) % 8;
    for (const ty of [-26, 26]) {
      g.fillStyle = '#26262c'; roundRect(g, -32, ty - 7, 64, 14, 5); g.fill();
      g.fillStyle = '#3d3d46'; roundRect(g, -30, ty - 5, 60, 10, 4); g.fill();
      g.strokeStyle = '#8f96a3'; g.lineWidth = 1.5; for (let k = 0; k < 8; k++) { const x = -30 + (k * 8 + off) % 60; g.beginPath(); g.moveTo(x, ty - 6); g.lineTo(x, ty + 6); g.stroke(); }
      g.fillStyle = '#5a5a62'; for (const x of [-20, 0, 20]) { g.beginPath(); g.arc(x, ty, 3, 0, 7); g.fill(); }
    }
    // body: a box of riveted plates
    g.fillStyle = hurt ? '#ffb0b0' : '#5a5d64'; roundRect(g, -26, -20, 52, 40, 6); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(g, -24, -18, 48, 10, 4); g.fill();
    g.strokeStyle = '#2e2e36'; g.lineWidth = 2; for (const x of [-9, 9]) { g.beginPath(); g.moveTo(x, -20); g.lineTo(x, 20); g.stroke(); } g.beginPath(); g.moveTo(-26, 0); g.lineTo(26, 0); g.stroke();
    g.fillStyle = '#c9ccd3'; for (const [rx, ry] of [[-22, -16], [-22, 16], [22, -16], [22, 16], [-4, -16], [4, 16], [-4, 16], [4, -16]]) { g.beginPath(); g.arc(rx, ry, 1.6, 0, 7); g.fill(); }
    if (e.hp <= e.maxHp * 0.5) { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, -12); g.lineTo(-6, -2); g.lineTo(-12, 8); g.lineTo(-4, 16); g.stroke(); }
    // boiler on the back: a riveted drum with a brass ring and a firebox glow
    g.fillStyle = '#4a4a52'; g.beginPath(); g.arc(-20, 0, 11, 0, 7); g.fill();
    g.strokeStyle = '#c9a02a'; g.lineWidth = 2; g.beginPath(); g.arc(-20, 0, 8, 0, 7); g.stroke();
    g.fillStyle = `rgba(255,140,40,${0.35 + Math.sin(t * 6) * 0.2})`; g.beginPath(); g.arc(-20, 0, 4, 0, 7); g.fill();
    // bomb chute on top, a bomb showing when one is nearly due
    g.fillStyle = '#2e2e36'; g.fillRect(4, -9, 14, 18); g.fillStyle = '#1b1b20'; g.beginPath(); g.ellipse(11, 0, 5, 7, 0, 0, 7); g.fill();
    if ((e.bombCd ?? 9) < 1.2) { g.fillStyle = '#2f2f35'; g.beginPath(); g.arc(11, 0, 4, 0, 7); g.fill(); g.fillStyle = '#ffb347'; g.beginPath(); g.arc(13, -4, 1.5 + Math.sin(t * 30) * 0.8, 0, 7); g.fill(); }
    // the arms: pistons on either side; the swinging one extends and sweeps across the front
    for (const side of [-1, 1]) {
      const swinging = e.armT > 0 && e.armSide === side, ext = swinging ? Math.sin((1 - e.armT / 0.35) * Math.PI) : 0;
      g.save(); g.translate(10, side * 20); g.rotate(side * (0.55 - ext * 1.15));
      g.fillStyle = '#3a3a42'; roundRect(g, 0, -4.5, 24 + ext * 16, 9, 3); g.fill();
      g.fillStyle = '#8f96a3'; g.fillRect(4, -2, 12 + ext * 16, 4);
      g.fillStyle = '#2e2e36'; g.fillRect(22 + ext * 16, -8, 9, 16); g.fillStyle = '#c9ccd3'; g.fillRect(29 + ext * 16, -6, 3, 4); g.fillRect(29 + ext * 16, 2, 3, 4);
      g.restore();
    }
    // lamps on the front
    const lit = 0.6 + Math.sin(t * 8) * 0.3; g.fillStyle = `rgba(255,60,40,${lit})`; for (const y of [-9, 9]) { g.beginPath(); g.arc(24, y, 3, 0, 7); g.fill(); }
    g.restore();
    // steam from the boiler, rising in screen space
    const bx = -20 * c, by = -20 * s;
    for (let k = 0; k < 3; k++) { const ph = (t * 0.7 + k * 0.33) % 1; g.fillStyle = `rgba(220,220,230,${0.45 * (1 - ph)})`; g.beginPath(); g.arc(bx + Math.sin(t * 3 + k) * 4, by - 12 - ph * 30, 4 + ph * 6, 0, 7); g.fill(); }
  };
  // the half-built Gnasher on the lab floor while the parts are still being gathered
  function drawFrame(g) {
    const cx = tc(GN_HOME.x), cy = tc(GN_HOME.y);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(cx + 4, cy + 10, 40, 26, 0, 0, 7); g.fill();
    g.strokeStyle = '#3a3a42'; g.lineWidth = 4; g.strokeRect(cx - 26, cy - 20, 52, 40); g.beginPath(); g.moveTo(cx - 26, cy); g.lineTo(cx + 26, cy); g.moveTo(cx, cy - 20); g.lineTo(cx, cy + 20); g.stroke();
    g.fillStyle = '#26262c'; roundRect(g, cx - 32, cy - 33, 64, 12, 4); g.fill(); roundRect(g, cx - 32, cy + 21, 64, 12, 4); g.fill();
    g.fillStyle = '#8a6a3a'; g.fillRect(cx - 40, cy + 24, 18, 4); g.fillRect(cx + 26, cy - 30, 16, 4);
    g.fillStyle = '#c9ccd3'; for (const [ox, oy] of [[-18, -8], [12, 6], [-6, 12]]) { g.beginPath(); g.arc(cx + ox, cy + oy, 2, 0, 7); g.fill(); }
  }
  // scrap-metal roofs: a corrugated tin sheet over the hut's roof, rust, rivets, a stovepipe
  function drawScrapRoof(g, b) {
    const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE - 16, v = (b.x * 7 + b.y * 3) % 5;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = 'rgba(110,113,120,0.9)'; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1; for (let cx = x + 3; cx < x + w; cx += 7) { g.beginPath(); g.moveTo(cx, y); g.lineTo(cx, y + h); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.10)'; for (let cx = x + 6; cx < x + w; cx += 7) { g.beginPath(); g.moveTo(cx, y); g.lineTo(cx, y + h); g.stroke(); }
    g.fillStyle = 'rgba(150,80,40,0.55)'; for (let k = 0; k < 3 + v; k++) { const rx = x + ((k * 53 + v * 17) % (w - 20)) + 10, ry = y + ((k * 31 + v * 11) % (h - 14)) + 7; g.beginPath(); g.ellipse(rx, ry, 8 + (k % 3) * 3, 5 + (k % 2) * 3, k, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
    g.fillStyle = '#c9ccd3'; for (let cx = x + 8; cx < x + w; cx += 16) { g.beginPath(); g.arc(cx, y + 6, 1.5, 0, 7); g.arc(cx, y + h - 6, 1.5, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + h - 6, w, 6);
    g.restore();
    // stovepipe and a wisp of smoke
    const sx = x + w - 22, sy = y + 10;
    g.fillStyle = '#3a3a42'; g.fillRect(sx - 4, sy - 12, 8, 20); g.fillStyle = '#2a2a30'; g.fillRect(sx - 6, sy - 14, 12, 4);
    for (let k = 0; k < 2; k++) { const ph = (time * 0.4 + b.x * 0.1 + k * 0.5) % 1; g.fillStyle = `rgba(160,160,170,${0.3 * (1 - ph)})`; g.beginPath(); g.arc(sx + Math.sin(time + k) * 3, sy - 18 - ph * 26, 3 + ph * 6, 0, 7); g.fill(); }
  }
  function drawGnashThrone(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, cx = tc(tx);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, y + TILE - 4, 18, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3a1e'; g.fillRect(x + 7, y + 2, TILE - 14, TILE - 6);
    g.fillStyle = '#7a2e2e'; g.fillRect(x + 11, y + 6, TILE - 22, TILE - 14);
    g.fillStyle = '#f5c542'; g.fillRect(x + 7, y + 2, TILE - 14, 4); g.fillRect(x + 7, y + 2, 3, TILE - 6); g.fillRect(x + TILE - 10, y + 2, 3, TILE - 6);
    g.beginPath(); g.moveTo(x + 10, y + 2); g.lineTo(x + 14, y - 6); g.lineTo(x + 18, y + 2); g.moveTo(x + TILE - 18, y + 2); g.lineTo(x + TILE - 14, y - 6); g.lineTo(x + TILE - 10, y + 2); g.fill();
    g.fillStyle = '#8f96a3'; for (const [ox, oy] of [[12, 12], [TILE - 12, 12], [12, TILE - 12], [TILE - 12, TILE - 12]]) { g.beginPath(); g.arc(x + ox, y + oy, 1.6, 0, 7); g.fill(); }
  }
  function drawGnashGold(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), v = (tx * 3 + ty * 5) % 3;
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(cx, cy + 12, 18, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#d4a017'; g.beginPath(); g.moveTo(cx - 19, cy + 12); g.quadraticCurveTo(cx - 12, cy - 6 - v * 2, cx, cy - 12 - v * 3); g.quadraticCurveTo(cx + 12, cy - 6, cx + 19, cy + 12); g.closePath(); g.fill();
    g.fillStyle = '#f5c542'; for (const [ox, oy] of [[-10, 4], [-3, -3], [6, 2], [1, 8], [10, 7], [-6, 9]]) { g.beginPath(); g.ellipse(cx + ox, cy + oy, 4, 2.5, 0.3, 0, 7); g.fill(); }
    g.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(time * 3 + tx) * 0.4})`; g.beginPath(); g.arc(cx - 4 + v * 3, cy - 6, 1.6, 0, 7); g.fill();
    if (v === 1) { g.fillStyle = '#c0504d'; g.beginPath(); g.arc(cx + 8, cy - 2, 2.5, 0, 7); g.fill(); }
  }
  function drawGnashChest(g, tx, ty, opened) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 8, y + 36, 32, 6);
    g.fillStyle = '#5a3a1e'; g.fillRect(x + 8, y + 12, 32, 26); g.fillStyle = opened ? '#2a2a30' : '#7a2e2e'; g.fillRect(x + 8, y + 10, 32, 10);
    g.fillStyle = '#f5c542'; g.fillRect(x + 12, y + 10, 4, 28); g.fillRect(x + 32, y + 10, 4, 28); g.fillRect(x + 8, y + 19, 32, 3);
    g.fillStyle = opened ? '#6e7178' : '#f5c542'; g.fillRect(x + 21, y + 17, 6, 7);
    if (!opened) { g.fillStyle = `rgba(255,230,120,${0.4 + Math.sin(time * 4) * 0.3})`; g.beginPath(); g.arc(x + 24, y + 8, 2, 0, 7); g.fill(); }
    g.strokeStyle = '#2a2a30'; g.lineWidth = 1; g.strokeRect(x + 8, y + 10, 32, 28);
  }
  function drawLever(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), live = !!liveGnasher(), a = live ? 0.9 : -0.9;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 14, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#3a3a42'; g.fillRect(cx - 12, cy + 2, 24, 12); g.fillStyle = '#5a5a62'; g.fillRect(cx - 12, cy, 24, 4);
    g.fillStyle = '#c9ccd3'; for (const ox of [-8, 8]) { g.beginPath(); g.arc(cx + ox, cy + 9, 1.6, 0, 7); g.fill(); }
    g.save(); g.translate(cx, cy + 2); g.rotate(a); g.fillStyle = '#8f96a3'; g.fillRect(-2, -26, 4, 26); g.fillStyle = '#c0504d'; g.beginPath(); g.arc(0, -27, 4.5, 0, 7); g.fill(); g.restore();
    g.fillStyle = live ? '#7ee787' : '#c0504d'; g.beginPath(); g.arc(cx + 8, cy + 4, 2, 0, 7); g.fill();
    if (TQ().stage >= 3 && !live && dist(player.x, player.y, cx, cy) < 200) { g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText('REMATCH', cx, cy - 30); g.fillStyle = '#ffe9a8'; g.fillText('REMATCH', cx, cy - 30); }
  }
  const GC_USABLE = [GC_CHEST, GC_LEVER, GC_THRONE, GC_GOLD];
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
    if (!hidden() && x1 < STRAIT.x0 - 1) return; // on the overworld nothing of ours is west of the strait
    if (hidden() && !inLab()) return;             // some other dungeon: none of ours is in it
    const gq = GQ(), tq = TQ();
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === GC_THRONE) items.push({ y: ty * TILE + TILE - 6, draw: () => drawGnashThrone(g, tx, ty) });
      else if (t === GC_GOLD) items.push({ y: ty * TILE + TILE - 6, draw: () => drawGnashGold(g, tx, ty) });
      else if (t === GC_CHEST) items.push({ y: ty * TILE + TILE - 6, draw: () => drawGnashChest(g, tx, ty, gq.treasury) });
      else if (t === GC_LEVER) items.push({ y: ty * TILE + TILE - 6, draw: () => drawLever(g, tx, ty) });
    }
    // scrap roofs go on just after the hut itself (the core draws a building at (y+h)*TILE-1 and skips the one the knight is in)
    const inside = insideBuilding(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
    if (!hidden()) for (const b of HUTS) if (b.scrap && b !== inside && (b.x + b.w) * TILE > cam.x && b.x * TILE < cam.x + VW && (b.y + b.h) * TILE > cam.y && b.y * TILE < cam.y + VH) items.push({ y: (b.y + b.h) * TILE - 0.5, draw: () => drawScrapRoof(g, b) });
    if (tq.stage === 1 && inLab() && GN_HOME.x >= x0 - 2 && GN_HOME.x <= x1 + 2 && GN_HOME.y >= y0 - 2 && GN_HOME.y <= y1 + 2) items.push({ y: GN_HOME.y * TILE + TILE - 6, draw: () => drawFrame(g) });
    for (const n of FOLK) { const p = folkPx(n); if (!p) continue; if (p.px > cam.x - 60 && p.px < cam.x + VW + 60 && p.py > cam.y - 60 && p.py < cam.y + VH + 60) { const b = insideBuilding(Math.floor(p.px / TILE), Math.floor(p.py / TILE)); if (b && b !== inside) continue; items.push({ y: p.py + 12 + (n.sortY || 0), draw: () => drawFolk(g, n, p) }); } }
    // interaction highlight for our own folk and tiles (the core only highlights what it knows)
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 1, draw: () => {
      const n = folkInFront();
      if (n) { const p = folkPx(n); if (p) { g.strokeStyle = 'rgba(255,233,168,0.7)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(p.px, p.py, 18, 0, 7); g.stroke(); g.setLineDash([]); } return; }
      const { tx, ty } = frontTile(player);
      if (GC_USABLE.includes(tileAt(tx, ty))) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    h.peace(true); closePanel(); player.action = null;
    if (HAS_INST && window.__instance) window.INSTANCES.leave();
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const makeRoom = n => { for (let i = INV_SLOTS - 1; i >= 0 && player.inv.filter(s => !s).length < n; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && bankAdd(s.id, s.qty)) player.inv[i] = null; } };
    const said = re => (dialog.cur && re.test(dialog.cur.text)) || dialog.queue.some(d => re.test(d.text));
    const bq = quest.boats; const m0 = player.skills.melee.xp, d0 = player.skills.defence.xp, r0 = player.skills.range.xp;
    const setCombat = lv => { player.skills.melee.xp = XP_TABLE[lv]; player.skills.defence.xp = XP_TABLE[lv]; player.skills.range.xp = 0; recomputeMaxHp(); player.hp = Math.min(player.hp, player.maxHp); };
    const tileOf = () => [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
    // into the lab (through the hut door), and back out
    const enterLab = () => { if (!HAS_INST) return true; if (window.__instance === INST_ID) return true; if (window.__instance) window.INSTANCES.leave(); closePanel(); F.tp(LAB_STEP.x, LAB_STEP.y); F.face(LAB_DOOR.x, LAB_DOOR.y); F.press('KeyE'); F.sim(2, []); return window.__instance === INST_ID; };
    const leaveLab = () => { if (!HAS_INST) return true; if (window.__instance) { F.press('KeyL'); F.sim(2, []); } return window.__instance === null; };
    // the land
    { let walls = 0, cw = 0, water = 0; for (let y = FS.y0; y <= FS.y1; y++) for (let x = FS.x0; x <= FS.x1; x++) { const t = tileAt(x, y); if (t === T.HWALL) walls++; else if (t === T.CWALL) cw++; } for (let y = STRAIT.y0; y <= STRAIT.y1; y++) for (let x = STRAIT.x0; x <= STRAIT.x1; x++) if (tileAt(x, y) === T.WATER) water++;
      const lab = [T.WORKBENCH, T.WORKSHOP, T.ALCHEMY].every(t => { for (let y = LAB_HUT.y; y < LAB_HUT.y + LAB_HUT.h; y++) for (let x = LAB_HUT.x; x < LAB_HUT.x + LAB_HUT.w; x++) if (tileAt(x, y) === t) return true; return false; });
      const door = HAS_INST ? tileAt(LAB_DOOR.x, LAB_DOOR.y) === T.DUNGEON_DOOR && tileAt(LAB_STEP.x, LAB_STEP.y) === T.DIRT : tileAt(LAB_DOOR.x, LAB_DOOR.y) === T.DOOR;
      check('goblincity: The Far Shore, Grubmarket and Castle Gnash are regions east of the strait; huts, a stone castle with a portcullis, a keep with a throne and gold, a lab with stations and a door', REGIONS.some(r => r.name === 'The Far Shore') && regionAt(250, 80).name === 'The Far Shore' && regionAt(216, 30).name === 'Grubmarket' && regionAt(224, 66).name === 'Castle Gnash' && regionAt(LANDING.x, LANDING.y).name === 'The Far Shore' && walls >= 60 && cw >= 100 && water > 300 && tileAt(224, 54) === T.PORTCULLIS && tileAt(THRONE_T.x, THRONE_T.y) === GC_THRONE && tileAt(CHEST_T.x, CHEST_T.y) === GC_CHEST && tileAt(220, 63) === GC_GOLD && lab && door && BUILDINGS.filter(mine).length === HUTS.length && tileAt(LAB.gate[0], LAB.gate[1]) === T.GATE && tileAt(YARD.gate[0], YARD.gate[1]) === T.GATE, { walls, cw, water, lab, door, huts: BUILDINGS.filter(mine).length, at216_30: regionAt(216, 30).name, at224_66: regionAt(224, 66).name, inst: HAS_INST }); }
    { const a = F.bfs(LANDING.x, LANDING.y, 224, 40), b = F.bfs(LANDING.x, LANDING.y, 224, 61), c = F.bfs(LANDING.x, LANDING.y, LAB_STEP.x, LAB_STEP.y), d = F.bfs(LANDING.x, LANDING.y, 246, 26);
      check('goblincity: the landing reaches the market, the keep door, the lab door and the scrap yard on foot', !!a && !!b && !!c && !!d, { a: a && a.length, b: b && b.length, c: c && c.length, d: d && d.length }); }
    // the ferry: refused below combat 10, then 40 coins to the Far Shore; Harl waits at the far dock with 'Back to the dock'
    if (bq) {
      bq.sailing = null; bq.where = 'dock'; makeRoom(4); h.give('coins', 200);
      const talkHarl = (hx, hy) => { const a = F.goAdjacent(hx, hy, 3000); F.face(hx, hy); closePanel(); drain(); F.press('KeyE'); F.sim(2, []); return a; };
      F.tp(164, 14); setCombat(5); const a = talkHarl(165, 14); const open = panel === 'ferry'; const listed = buttons.some(b => /The Far Shore/.test(b.label)); const cbLow = combatLevel();
      const c1 = F.clickButton('The Far Shore'); F.sim(3, []); const refused = !bq.sailing && bq.where === 'dock' && notice && /combat level 10/.test(notice.text);
      check('goblincity: the ferry panel lists The Far Shore and Harl refuses it below combat level 10', typeof a === 'number' && open && listed && cbLow < 10 && c1 && refused, { a, open, listed, cbLow, c1, notice: notice && notice.text });
      setCombat(12); const c0 = coins(); if (panel !== 'ferry') talkHarl(165, 14); render(); const c2 = F.clickButton('The Far Shore'); const sailing = !!bq.sailing && bq.sailing.to === 'farshore' && panel === 'sailing'; F.sim(150, []);
      const landed = bq.where === 'farshore' && !bq.sailing && Math.floor(player.x / TILE) === LANDING.x && Math.floor(player.y / TILE) === LANDING.y && player.region === 'The Far Shore' && panel === null;
      check('goblincity: at combat 12 the Far Shore costs 40 coins and lands you on the far dock; the Voice speaks once', combatLevel() >= 10 && c2 && sailing && landed && coins() === c0 - 40 && TQ().visited && said(/Far Shore/), { c2, sailing, landed, paid: c0 - coins(), where: bq.where, region: player.region, at: tileOf() });
      const a2 = talkHarl(205, 30); const open2 = panel === 'ferry'; const back = buttons.some(b => /Back to the dock/.test(b.label)); closePanel();
      F.tp(216, 30); F.sim(3, []); const stays = bq.where === 'farshore';
      check("goblincity: Harl waits at the far dock with 'Back to the dock', and does not row home while you are in Grubmarket", typeof a2 === 'number' && open2 && back && stays, { a2, open2, back, stays, region: player.region });
    } else check('goblincity: the ferry (26-boats) is loaded', false, {});
    // Tinkerton starts the quest at the castle gate
    quest.tinker = freshT(); for (const id of PART_IDS) removeItem(id, countItem(id)); removeItem('tinker_goggles', countItem('tinker_goggles'));
    { F.tp(225, 52); F.face(TINK_GATE.x, TINK_GATE.y); drain(); F.press('KeyE'); F.sim(2, []);
      check("goblincity: Tinkerton outside Castle Gnash's gate starts 'A Tinker Gone Wrong' (four parts from four goblins)", TQ().stage === 1 && dialog.cur && dialog.cur.who === 'Tinkerton' && activeQuests().includes('tinker') && /Grubb/.test(questText('tinker')) && !!levelBanner && levelBanner.sub === 'A Tinker Gone Wrong', { stage: TQ().stage, who: dialog.cur && dialog.cur.who, text: questText('tinker') }); }
    // the four favours
    const handIn = (id, sx, sy) => { const n = FOLK.find(n => n.id === id), f = FAVOURS[id]; makeRoom(3); F.tp(sx, sy); F.face(n.x, n.y); drain(); F.press('KeyE'); F.sim(2, []); return f; };
    { const f = handIn('grubb', 216, 24); const refused = !TQ().parts.boiler && said(/beef/) && countItem('boiler') === 0;
      removeItem('cooked_beef', countItem('cooked_beef')); h.give('cooked_beef', 5); handIn('grubb', 216, 24);
      check('goblincity: Grubb refuses without 5 cooked beef, then trades them for the boiler', refused && TQ().parts.boiler && countItem('boiler') === 1 && countItem('cooked_beef') === 0 && dialog.cur && dialog.cur.who === 'Grubb the cook', { refused, boiler: countItem('boiler'), beef: countItem('cooked_beef'), item: f.item }); }
    { while (countItem('goblin_scrap') < 10) h.give('goblin_scrap', 1); const s0 = countItem('goblin_scrap'); handIn('nix', 230, 24);
      check('goblincity: Nix trades 10 goblin scrap for the gear wheel', TQ().parts.gear_wheel && countItem('gear_wheel') === 1 && countItem('goblin_scrap') === s0 - 10, { wheel: countItem('gear_wheel'), scrap: countItem('goblin_scrap') - s0 }); }
    { while (countItem('spider_silk') < 3) h.give('spider_silk', 1); const s0 = countItem('spider_silk'); handIn('snaggle', 216, 36);
      check('goblincity: Old Snaggle trades 3 spider silk for the bomb chute', TQ().parts.bomb_chute && countItem('bomb_chute') === 1 && countItem('spider_silk') === s0 - 3, { chute: countItem('bomb_chute'), silk: countItem('spider_silk') - s0 }); }
    { if (countItem('bread') < 1) h.give('bread', 1); const b0 = countItem('bread'); handIn('pip', 222, 34);
      check('goblincity: Pip-squeak trades a bread for the lightning coil; the Voice points to the lab', TQ().parts.lightning_coil && countItem('lightning_coil') === 1 && countItem('bread') === b0 - 1 && said(/all four parts/), { coil: countItem('lightning_coil'), bread: countItem('bread') - b0, held: partsHeld() }); }
    // through the hut door into the lab
    { const ok = enterLab(); const stations = !HAS_INST || [T.WORKBENCH, T.WORKSHOP, T.ALCHEMY].every(t => { for (let y = 0; y < LAB_H; y++) for (let x = 0; x < LAB_W; x++) if (tileAt(x, y) === t) return true; return false; });
      const grubbHidden = !HAS_INST || folkTile(FOLK.find(n => n.id === 'grubb')) === null; const tk = folkTile(FOLK[0]);
      check("goblincity: E on the hut door enters Tinkerton's Lab (an instance, 24×18, stations, the lever, Tinkerton inside; the townsfolk are out of reach)", ok && (!HAS_INST || (window.__instance === INST_ID && player.region === "Tinkerton's Lab" && INSTANCES.list().includes(INST_ID) && tileAt(LEVER_T.x, LEVER_T.y) === GC_LEVER && tileAt(0, 0) === T.HWALL && tileAt(LAB_EXIT[0], LAB_EXIT[1]) === T.DUNGEON_EXIT)) && stations && grubbHidden && !!tk && tk.x === TINK_LAB.x && tk.y === TINK_LAB.y, { ok, inst: window.__instance, region: player.region, stations, grubbHidden, tk }); }
    // all four to Tinkerton: the Gnasher wakes
    { F.tp(TINK_LAB.x, TINK_LAB.y + 1); F.face(TINK_LAB.x, TINK_LAB.y); drain(); F.press('KeyE'); F.sim(3, []); const gn = liveGnasher(); const d = MONSTER_DEFS.gnasher;
      check('goblincity: delivering all four parts spawns the Gnasher on the lab floor (lv 22, r 30, 320 hp, att 22, max hit 14, def 18, speed 75, aggro, not a walker)', TQ().stage === 2 && !!gn && gn.maxHp === 320 && gn.r === 30 && d.level === 22 && d.att === 22 && d.maxHit === 14 && d.def === 18 && d.speed === 75 && d.aggro && !d.mech && PART_IDS.every(id => countItem(id) === 0) && dist(gn.x, gn.y, tc(GN_HOME.x), tc(GN_HOME.y)) < 3 * TILE && !!levelBanner && levelBanner.text === 'THE GNASHER WAKES' && typeof HOOKS.drawMonster.gnasher === 'function', { stage: TQ().stage, gn: !!gn, hp: gn && gn.maxHp, banner: levelBanner && levelBanner.text }); }
    // arms and bombs: chase for a while at full hp
    { const gn = liveGnasher(); if (gn) { F.tp(GN_HOME.x - 3, GN_HOME.y); gn.x = player.x + 2 * TILE; gn.y = player.y; gn.home = { x: gn.x, y: gn.y }; gn.state = 'idle'; gn.stunT = 0; gn.armCd = 0.2; gn.bombCd = 0.5; gn.swings = 0; gn.bombs = 0; const hp0 = player.hp; player.hp = 5000; projectiles = [];
        h.peace(false); F.sim(200, []); const swings = gn.swings, bombs = gn.bombs, sticky = projectiles.some(p => p.kind === 'sticky' && p.owner === 'monster'); h.peace(true); projectiles = []; player.hp = Math.min(hp0, player.maxHp); player.hurtT = 0; gn.state = 'idle';
        check('goblincity: the Gnasher swings its arms at a knight within reach and lobs a sticky bomb (friendly fire, owner monster)', swings >= 1 && bombs >= 1, { swings, bombs, sticky, state: gn.state }); } else check('goblincity: the Gnasher swings its arms at a knight within reach and lobs a sticky bomb (friendly fire, owner monster)', false, {}); }
    // kill it: the quest completes, 400 coins + goggles once, the lever works
    const slay = () => { const gn = liveGnasher(); if (!gn) return null; F.tp(GN_HOME.x - 3, GN_HOME.y); player.facing = { x: 1, y: 0 }; gn.hp = 1; gn.stunT = 0; gn.state = 'idle';
      for (let i = 0; i < 80 && !gn.dead; i++) { gn.x = player.x + 60; gn.y = player.y; gn.stunT = 0; player.attackCd = 0; F.press('Space'); F.sim(3, []); } F.sim(90, []); return gn; };
    { makeRoom(4); const c0 = coins(); const gn = slay(); const wreck = nearestTileOfType(Math.floor(player.x / TILE), Math.floor(player.y / TILE), T.WRECK, 5);
      check("goblincity: killing the Gnasher completes the quest: 400 coins, Tinker's goggles (helm, def 8), no second Gnasher, no walker wreck", !!gn && gn.dead && TQ().stage === 3 && coins() === c0 + 400 && countItem('tinker_goggles') === 1 && ITEMS.tinker_goggles.armour.def === 8 && ITEMS.tinker_goggles.armour.slot === 'helm' && tileAt(LEVER_T.x, LEVER_T.y) === GC_LEVER && !activeQuests().includes('tinker') && !monsters.some(m => m.type === 'gnasher') && !wreck, { dead: gn && gn.dead, stage: TQ().stage, coins: coins() - c0, goggles: countItem('tinker_goggles'), lever: tileAt(LEVER_T.x, LEVER_T.y) === GC_LEVER, left: monsters.filter(m => m.type === 'gnasher').length, wreck }); }
    { makeRoom(4); F.tp(LEVER_T.x, LEVER_T.y - 1); F.face(LEVER_T.x, LEVER_T.y); drain(); F.press('KeyE'); F.sim(2, []); const woke = TQ().rematch && !!liveGnasher();
      const c0 = coins(), s0 = countItem('goblin_scrap'); const gn = slay();
      check('goblincity: the Arena lever wakes the Gnasher again; the rematch pays 150 coins + 5 scrap and no second pair of goggles', woke && !!gn && gn.dead && !TQ().rematch && TQ().kills === 1 && coins() === c0 + 150 && countItem('goblin_scrap') === s0 + 5 && countItem('tinker_goggles') === 1 && LAB_HUT.sign === 'ARENA', { woke, dead: gn && gn.dead, coins: coins() - c0, scrap: countItem('goblin_scrap') - s0, goggles: countItem('tinker_goggles'), sign: LAB_HUT.sign }); }
    { makeRoom(2); F.tp(TINK_LAB.x, TINK_LAB.y + 1); F.face(TINK_LAB.x, TINK_LAB.y); drain(); F.press('KeyE'); F.sim(2, []); const open = panel === 'tinkerton'; render(); const p0 = countItem('blast_powder'); h.give('coins', 50); const bought = F.clickButton('Buy 15'); closePanel();
      check("goblincity: after the quest Tinkerton's lab is a shop: blast powder 15, goblin scrap 8, hammer 5", open && bought && countItem('blast_powder') === p0 + 1 && SHOPS.tinkerton.stock.some(([i, p]) => i === 'goblin_scrap' && p === 8) && SHOPS.tinkerton.stock.some(([i, p]) => i === 'hammer' && p === 5), { open, bought, powder: countItem('blast_powder') - p0 }); }
    // leaving the lab for a second visit brings a live rematch back; nothing waits when it is over
    { const left = leaveLab(); const back = !HAS_INST || (window.__instance === null && Math.floor(player.x / TILE) === LAB_STEP.x && Math.floor(player.y / TILE) === LAB_STEP.y && folkTile(FOLK.find(n => n.id === 'grubb')) !== null);
      const yard = monsters.filter(m => m.type === 'yard_walker' || m.type === 'yard_dozer').length === 3;
      TQ().rematch = true; const again = enterLab(); F.sim(3, []); const revived = !!liveGnasher(); TQ().rematch = false; for (const m of monsters) if (m.type === 'gnasher') { m.dead = true; m.deadT = 9; m.respawnT = Infinity; } F.sim(3, []); const quiet = !monsters.some(m => m.type === 'gnasher'); leaveLab();
      check('goblincity: L leaves the lab onto the step with the townsfolk and the yard machines back; a rematch left unfinished is waiting on the next visit', left && back && yard && again && revived && quiet && (!HAS_INST || window.__instance === null), { left, back, yard, again, revived, quiet, at: tileOf() }); }
    // King Gnash: guards neutral outside, hostile in the keep before the tribute; 500 coins opens the treasury once
    quest.gnash = freshG();
    { const gs = guards(); const neutral0 = gs.length === 4 && gs.every(m => !m.angry) && !MONSTER_DEFS.castle_guard.aggro && MONSTER_DEFS.castle_guard.level === 20;
      for (const m of gs) { m.dead = false; m.hp = m.maxHp; m.angry = false; m.state = 'idle'; m.x = m.home.x; m.y = m.home.y; }
      F.tp(224, 65); const hp0 = player.hp; player.hp = 5000; h.peace(false); F.sim(6, []); const hostile = gs.some(m => m.angry && m.state === 'chase') && said(/GUARDS/); h.peace(true); for (const m of gs) { m.state = 'return'; } player.hp = Math.min(hp0, player.maxHp); player.hurtT = 0;
      check('goblincity: four neutral goblin castle guards; they turn hostile when you enter the keep before paying tribute', neutral0 && hostile, { guards: gs.length, neutral0, hostile, angry: gs.filter(m => m.angry).length }); }
    { makeRoom(5); F.tp(228, 67); F.face(CHEST_T.x, CHEST_T.y); F.press('KeyE'); F.sim(2, []); const locked = !GQ().treasury && notice && /tribute/.test(notice.text);
      F.tp(224, 66); F.face(THRONE_T.x, THRONE_T.y); drain(); F.press('KeyE'); F.sim(2, []); const asked = GQ().stage === 1 && !GQ().tribute && activeQuests().includes('gnash') && said(/Five hundred/);
      const stash = coins(); removeItem('coins', stash); drain(); F.press('KeyE'); F.sim(2, []); const poor = !GQ().tribute && said(/500|Five hundred/); addItem('coins', stash);
      check('goblincity: the treasury is locked before tribute; King Gnash asks 500 coins and refuses an empty purse', locked && asked && poor, { locked, asked, poor, stage: GQ().stage, notice: notice && notice.text });
      while (coins() < 500) h.give('coins', 100); const c0 = coins(); drain(); F.press('KeyE'); F.sim(2, []);
      const paid = GQ().tribute && coins() === c0 - 500 && !activeQuests().includes('gnash') && guards().every(m => !m.angry) && !!levelBanner && levelBanner.sub === 'Gold for Gnash';
      const sb0 = countItem('steel_bar'), mb0 = countItem('mithril_bar'); F.tp(228, 67); F.face(CHEST_T.x, CHEST_T.y); drain(); F.press('KeyE'); F.sim(2, []);
      const opened = GQ().treasury && countItem('steel_bar') === sb0 + 3 && (!ITEMS.mithril_bar || countItem('mithril_bar') === mb0 + 2) && countItem('gnash_crown') === 1 && ITEMS.gnash_crown.value === 800;
      F.face(CHEST_T.x, CHEST_T.y); F.press('KeyE'); F.sim(2, []);
      check("goblincity: 500 coins of tribute calms the guards and opens the treasury once: 3 steel bars, 2 mithril bars, Gnash's crown", paid && opened && countItem('gnash_crown') === 1 && countItem('steel_bar') === sb0 + 3, { paid, opened, coins: coins() - c0, steel: countItem('steel_bar') - sb0, mithril: countItem('mithril_bar') - mb0, crown: countItem('gnash_crown') }); }
    // the scrap yard's machines mind their own business
    { const ms = monsters.filter(m => m.type === 'yard_walker' || m.type === 'yard_dozer');
      check('goblincity: two yard walkers (lv 18) and a yard dozer stand in the scrap yard, neutral unless attacked', ms.length === 3 && ms.filter(m => m.type === 'yard_walker').length === 2 && ms.every(m => !m.angry && inRect(YARD, Math.floor(m.home.x / TILE), Math.floor(m.home.y / TILE))) && !MONSTER_DEFS.yard_walker.aggro && MONSTER_DEFS.yard_walker.level === 18 && !MONSTER_DEFS.yard_dozer.aggro && typeof HOOKS.drawMonster.yard_walker === 'function' && typeof HOOKS.drawMonster.yard_dozer === 'function', { n: ms.length, types: ms.map(m => m.type) }); }
    player.skills.melee.xp = m0; player.skills.defence.xp = d0; player.skills.range.xp = r0; recomputeMaxHp(); player.hp = Math.min(player.hp, player.maxHp);
    closePanel(); drain(); h.peace(false);
  });
}
