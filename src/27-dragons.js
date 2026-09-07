// ============================================================================
// THE ASHFIELDS — dragon country in the south-west. Dunstan the dragon dung farmer,
// green and red dragons that breathe fire, lava, obsidian, and the Godly Plated armour
// (a winged helm). Feature file: registers everything through HOOKS, edits no core file.
// Everything lives in one block so no name leaks into the shared script scope.
// ============================================================================
{
  // ---------- tiles (ids captured locally) ----------
  const DR_ASH = addTile('ASH', { solid: false, tex: 'cave', mini: '#5d5f66', placeableOn: true });
  const DR_LAVA = addTile('LAVA', { solid: true, tex: 'dirt', mini: '#ff6a1a' });
  const DR_OBSIDIAN = addTile('OBSIDIAN', { solid: true, tex: 'cave', mini: '#2a2433' });
  const DR_DEADTREE = addTile('DEADTREE', { solid: true, tex: 'cave', mini: '#3a3330' });
  const DR_BONES = addTile('DRAGONBONES', { solid: true, tex: 'cave', mini: '#d9d0c0' });
  const DR_SHRINE = addTile('SHRINE', { solid: true, tex: 'cave', mini: '#8d9098' });

  // ---------- geometry ----------
  const AF = { x0: 0, y0: 96, x1: 99, y1: 139 };                 // the whole south-west
  const FANG = { x0: 2, y0: 108, x1: 34, y1: 138 };               // The Fang's lair: another feature carves this; never touched here
  const APPROACH = { x0: 1, y0: 103, x1: 40, y1: 107 };           // kept as clear ash so the lair can always be reached from the east
  const FARM = { x0: 58, y0: 96, x1: 79, y1: 107 };               // no lava, rocks or dead trees on Dunstan's land
  const HUT = { x: 64, y: 98, w: 5, h: 4 };                       // door at (66,101), step at (66,102)
  const FIELD = { x0: 70, y0: 98, x1: 76, y1: 103, gx: 70, gy: 101 };
  const DUNSTAN_T = { x: 67, y: 104 };
  const FIRE_T = { x: 62, y: 104 };
  const SHRINE_T = { x: 87, y: 103 };
  const ENTRANCE_OBSIDIAN = [[56, 98], [63, 108], [72, 108]];
  const LAVA_POOLS = [[50, 116, 2.4], [63, 123, 3.1], [79, 114, 2.0], [88, 129, 3.4], [45, 131, 2.6], [70, 134, 2.2], [58, 111, 1.5], [93, 118, 1.8]];
  const BONES = [[55, 113], [84, 121], [66, 128], [44, 123], [92, 111], [38, 118], [52, 136]];
  const GREEN_SPAWNS = [[52, 120], [76, 118], [60, 131], [91, 124]];
  const RED_SPAWNS = [[81, 135], [47, 136]];
  const PATH = [[60, 94], [60, 100], [56, 104], [48, 105], [36, 105]];      // Wolfwood → the Ashfields → toward the lair
  const FARM_PATH = [[60, 100], [63, 103], [69, 103]];
  const DRAGONS = new Set(['green_dragon', 'red_dragon']);
  const GOLD = '#f5e6a8';

  // Inserted right after the first region (Deepholm, whose self-test wants to stay REGIONS[0]) rather than unshifted:
  // it still beats Wolfwood and The Wilds, and The Fang's lair file loads later and unshifts, so it wins inside its rectangle.
  REGIONS.splice(Math.min(1, REGIONS.length), 0, { name: 'The Ashfields', sub: 'Where the dragons sleep', x0: AF.x0, y0: AF.y0, x1: AF.x1, y1: AF.y1 });
  const inAshfields = (tx, ty) => tx >= AF.x0 && tx <= AF.x1 && ty >= AF.y0 && ty <= AF.y1;
  const inFang = (tx, ty) => tx >= FANG.x0 && tx <= FANG.x1 && ty >= FANG.y0 && ty <= FANG.y1;
  const inRect = (r, tx, ty) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;

  // ---------- items ----------
  Object.assign(ITEMS, {
    dragon_dung: { name: 'Dragon dung', value: 5, color: '#5a4a2a', shape: 'rock' },
    dragon_scale: { name: 'Dragon scale', value: 80, color: '#3f8a4a', shape: 'shield' },
    dragon_bone: { name: 'Dragon bone', value: 40, color: '#e8dcc0', shape: 'tusk' },
    obsidian: { name: 'Obsidian', value: 60, color: '#2a2433', shape: 'rock' },
    fireproof_salve: { name: 'Fireproof salve', value: 200, color: '#ff9a4a', shape: 'powder', stack: 1 },
    godly_helm: { name: 'Godly winged helm', value: 3200, color: GOLD, shape: 'helm', stack: 1, armour: { slot: 'helm', def: 30 }, wings: true },
    godly_body: { name: 'Godly platebody', value: 5200, color: GOLD, shape: 'body', stack: 1, armour: { slot: 'body', def: 55 } },
    godly_legs: { name: 'Godly platelegs', value: 3800, color: GOLD, shape: 'legs', stack: 1, armour: { slot: 'legs', def: 38 } },
    godly_shield: { name: 'Godly shield', value: 3000, color: GOLD, shape: 'shield', stack: 1, armour: { slot: 'shield', def: 28 } },
  });
  if (!ITEMS.mithril_bar) ITEMS.mithril_bar = { name: 'Mithril bar', value: 120, color: '#7aa0d0', shape: 'bar' }; // the dwarves file normally defines it
  for (const k of ['dragon_dung', 'dragon_scale', 'dragon_bone', 'obsidian', 'fireproof_salve', 'godly_helm', 'godly_body', 'godly_legs', 'godly_shield', 'mithril_bar']) {
    ITEMS[k].id = k; if (!ITEMS[k].stack) ITEMS[k].stack = ITEMS[k].armour ? 1 : 50;
  }
  RECIPES.push(
    { out: 'godly_helm', qty: 1, needs: [['dragon_scale', 6], ['mithril_bar', 2], ['obsidian', 1]], station: 'anvil', skill: 'smithing', lv: 40, xp: 500, label: '6 Dragon scales + 2 Mithril bars + Obsidian → Godly winged helm' },
    { out: 'godly_shield', qty: 1, needs: [['dragon_scale', 6], ['mithril_bar', 2], ['obsidian', 1]], station: 'anvil', skill: 'smithing', lv: 42, xp: 500, label: '6 Dragon scales + 2 Mithril bars + Obsidian → Godly shield' },
    { out: 'godly_legs', qty: 1, needs: [['dragon_scale', 7], ['mithril_bar', 3], ['obsidian', 1]], station: 'anvil', skill: 'smithing', lv: 44, xp: 500, label: '7 Dragon scales + 3 Mithril bars + Obsidian → Godly platelegs' },
    { out: 'godly_body', qty: 1, needs: [['dragon_scale', 8], ['mithril_bar', 3], ['obsidian', 1]], station: 'anvil', skill: 'smithing', lv: 48, xp: 500, label: '8 Dragon scales + 3 Mithril bars + Obsidian → Godly platebody' },
  );
  SHOPS.dung = { name: "Dunstan's Dung Farm", stock: [['baked_potato', 8], ['potato_seed', 2]], buys: ['dragon_dung'], rate: 1 };

  // ---------- dragons ----------
  const dragonDrops = (cA, cB, sA, sB) => ({
    always: [['dragon_dung', 1, 2], ['dragon_scale', sA, sB], ['coins', cA, cB]],
    table: [['nothing', 0, 0, 5], ['dragon_bone', 1, 2, 6], ['coal', 1, 3, 5]],
    rare: { chance: 6, table: [['mithril_bar', 2, 2, 1]] },
  });
  MONSTER_DEFS.green_dragon = { name: 'Green dragon', level: 45, r: 26, hp: 260, att: 40, maxHit: 20, def: 36, speed: 95, aggro: true, sight: 7 * TILE, respawn: 300, drops: dragonDrops(60, 140, 1, 3) };
  MONSTER_DEFS.red_dragon = { name: 'Red dragon', level: 60, r: 28, hp: 420, att: 55, maxHit: 28, def: 50, speed: 100, aggro: true, sight: 7 * TILE, respawn: 360, drops: dragonDrops(100, 200, 2, 4) };

  // A four-legged dragon seen from above: long neck and head forward, tail behind, wings on the back
  // (folded at rest, beating when it walks), horns, red eyes, an open jaw while it breathes fire.
  function drDrawDragon(g, e, hurt, red) {
    const ang = Math.atan2(e.facing.y, e.facing.x), t = e.walkT || 0, moving = !!e.moving, breathing = e.attackT > 0;
    const body = hurt ? '#ffb0b0' : red ? '#b23a30' : '#3f8a4a', dark = hurt ? '#d98080' : red ? '#6e1f18' : '#24552b';
    const wing = hurt ? '#e8a0a0' : red ? '#8a2a22' : '#2f6e3a', horn = '#e8dcc0', spine = hurt ? '#c07070' : red ? '#ffb347' : '#d6e07a';
    const beat = moving ? Math.sin(t * 0.9) : Math.sin(time * 1.3) * 0.15;   // wing beat while walking, a slow breath at rest
    const open = 0.22 + Math.max(0, beat) * 0.9;                             // how far the wings are spread
    const tw = Math.sin(time * 3.5 + (moving ? t * 0.4 : 0)) * 6;            // tail sway
    g.save(); g.rotate(ang);
    // tail
    g.strokeStyle = body; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(-18, 0); g.quadraticCurveTo(-32, tw, -44, -tw * 0.5); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(-44, -tw * 0.5); g.lineTo(-54, -tw); g.stroke();
    g.fillStyle = dark; g.beginPath(); g.moveTo(-52, -tw - 6); g.lineTo(-61, -tw); g.lineTo(-52, -tw + 6); g.closePath(); g.fill();
    // legs (four, stepping)
    g.strokeStyle = dark; g.lineWidth = 5;
    for (let k = 0; k < 4; k++) {
      const side = k % 2 ? 1 : -1, front = k < 2, bx = front ? 11 : -9;
      const ph = moving ? Math.sin(t + (front ? 0 : Math.PI) + (side > 0 ? Math.PI : 0)) * 6 : 0;
      g.beginPath(); g.moveTo(bx, side * 9); g.lineTo(bx + ph, side * 19); g.lineTo(bx + ph + 3, side * 24); g.stroke();
      g.fillStyle = horn; for (let c = -1; c <= 1; c++) { g.beginPath(); g.arc(bx + ph + 3 + c * 3, side * 26, 1.4, 0, 7); g.fill(); }
    }
    // body
    g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 23, 14, 0, 0, 7); g.fill();
    // wings
    for (const side of [-1, 1]) {
      g.fillStyle = wing; g.beginPath(); g.moveTo(6, side * 7);
      g.quadraticCurveTo(-6, side * (14 + 24 * open), -22, side * (22 + 30 * open));
      g.quadraticCurveTo(-24, side * (14 + 12 * open), -30, side * (10 + 4 * open));
      g.quadraticCurveTo(-18, side * (8 + 4 * open), 6, side * 7); g.closePath(); g.fill();
      g.strokeStyle = dark; g.lineWidth = 1.5; g.beginPath();
      for (const f of [0.35, 0.7, 1]) { g.moveTo(6, side * 7); g.lineTo(-22 + (1 - f) * 16, side * (10 + (12 + 30 * open) * f)); }
      g.stroke();
      g.fillStyle = horn; g.beginPath(); g.arc(-22, side * (22 + 30 * open), 2, 0, 7); g.fill(); // wing claw
    }
    // back plates + spines
    g.fillStyle = dark; g.beginPath(); g.ellipse(2, 0, 16, 6, 0, 0, 7); g.fill();
    g.fillStyle = spine; for (let s = -12; s <= 12; s += 6) { g.beginPath(); g.moveTo(s - 2, -2); g.lineTo(s, -8); g.lineTo(s + 2, -2); g.closePath(); g.fill(); }
    // neck + head
    g.strokeStyle = body; g.lineWidth = 9; g.beginPath(); g.moveTo(18, 0); g.quadraticCurveTo(26, breathing ? -2 : 0, 33, 0); g.stroke();
    g.fillStyle = body; g.beginPath(); g.ellipse(38, 0, 10, 7, 0, 0, 7); g.fill();
    g.fillStyle = dark; g.beginPath(); g.ellipse(44, 0, 6, 4.5, 0, 0, 7); g.fill(); // snout
    if (breathing) { g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(46, -3); g.lineTo(56, 0); g.lineTo(46, 3); g.closePath(); g.fill(); }
    g.strokeStyle = horn; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(34, -5); g.lineTo(26, -12); g.moveTo(34, 5); g.lineTo(26, 12); g.stroke(); // horns
    g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(41, -3.5, 1.8, 0, 7); g.arc(41, 3.5, 1.8, 0, 7); g.fill(); // red eyes
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(48, -1.5, 0.8, 0, 7); g.arc(48, 1.5, 0.8, 0, 7); g.fill(); // nostrils
    g.restore();
  }
  HOOKS.drawMonster.green_dragon = (g, e, hurt) => drDrawDragon(g, e, hurt, false);
  HOOKS.drawMonster.red_dragon = (g, e, hurt) => drDrawDragon(g, e, hurt, true);

  // ---------- quest state ----------
  QUEST_DEFS.dragons = { name: 'Dragon Dung' };
  const freshQ = () => ({ stage: 0, dung: 0, salve: false, potatoes: 0, firstKill: false, shrine: false });
  const dq = () => quest.dragons || (quest.dragons = freshQ());
  HOOKS.newGame.push(() => { quest.dragons = freshQ(); DR.fire = []; DR.lavaT = 0; DR.warnT = 0; });
  HOOKS.questText.dragons = () => dq().stage >= 2 ? 'Done.' : `Bring Dunstan 5 dragon dung (${Math.min(5, countItem('dragon_dung'))}/5). Dragons drop it.`;
  HOOKS.activeQuests.push(() => dq().stage === 1 ? ['dragons'] : []);

  // ---------- main quest, stages 11–14 (The Fang's lair owns 15+) ----------
  // (replaces the Hollowford file's stage-11 placeholder; keeps its 'Chapter 4 complete' lead so that file's quest-log check still reads)
  HOOKS.mainQuest[11] = { text: () => 'Chapter 4 complete. Hollowford is avenged. The Voice speaks of dragons in the south-west.', onEnter: () => {
    levelBanner = { text: 'HOLLOWFORD BREATHES', sub: 'The survivors are safe', t: 3.5 };
    say('Hollowford breathes again. But listen, knight. Something older than goblins stirs in the south-west, past Wolfwood. The sky there is grey with ash.', 'The Voice');
    say('Dragons. And under them, something worse. Take the path south from the old stone circle in Wolfwood.', 'The Voice');
  } };
  HOOKS.mainQuest[12] = { text: () => 'Find the dragon dung farmer in the Ashfields.', onEnter: () => {
    say('The Ashfields. Everything here has burned at least once. Someone farms out here, mad as it sounds. Find them before the dragons find you.', 'The Voice');
  } };
  HOOKS.mainQuest[13] = { text: () => `Bring Dunstan 5 dragon dung (${Math.min(5, countItem('dragon_dung'))}/5). Dragons drop it.`, onEnter: () => {
    say('Dragon dung. Of all the things a knight is asked for. The dragons sleep south of the farm, in the ash. Fight them from the side, not the front.', 'The Voice');
  } };
  HOOKS.mainQuest[14] = { text: () => 'Salved against fire. The Fang sleeps in the far south-west. Find the lair.', onEnter: () => {
    levelBanner = { text: 'CHAPTER 5', sub: 'The Ashfields', t: 4 }; burst(player.x, player.y, '#ff9a4a', 30, 160);
    say('The salve will hold against dragon fire, and against the heat of the lair. What sleeps in the far south-west is called The Fang. Its lair is west, past the lava. Go when you are ready, knight.', 'The Voice');
  } };

  // ---------- Dunstan the dragon dung farmer ----------
  // He is a core NPC (so talking, the use-highlight and the bot's talk() all work) with his own look drawn on top:
  // a straw hat over the core's hair, and a pitchfork in hand.
  BUILDINGS.push({ id: 'dunstan_hut', x: HUT.x, y: HUT.y, w: HUT.w, h: HUT.h, name: "Dunstan's Hut", roof: '#6a5a3a', sign: 'DUNG', door: 2, f: [[T.BED, 1, 1], [T.TABLE, 3, 1], [T.SHELF, 3, 2]] });
  NPCS.push(initNpc({ id: 'dunstan', name: 'Dunstan the dung farmer', x: DUNSTAN_T.x, y: DUNSTAN_T.y, tunic: '#6a5a3a', hair: '#8a6a3a', apron: true, beard: true, role: 'dungfarmer' }));
  HOOKS.talk.dungfarmer = n => {
    const q = dq();
    if (q.stage === 0) {
      q.stage = 1;
      say("A knight! Out here! Mind the dragons, they're the whole point. Dragon dung: best fertiliser in the Fanglands. Potatoes the size of your head.", n.name);
      say("Bring me five dragon dung and I'll pay you a hundred and fifty coins, and brew you something for the heat. The dragons drop it. You'll know it when you see it.", n.name);
      if (quest.stage === 12) advanceQuest(13); else save();
    } else if (q.stage === 1) {
      if (countItem('dragon_dung') >= 5) {
        removeItem('dragon_dung', 5); q.stage = 2; q.dung += 5;
        giveOrDrop('coins', 150, player.x, player.y); gainXp('farming', 150);
        say("Five! Oh, that's the good stuff. A hundred and fifty coins, as promised.", n.name);
        say('Now hold still.', n.name);
        q.salve = true; burst(player.x, player.y, '#ff9a4a', 26, 130); floatText(player.x, player.y - 34, 'Fireproof salve', '#ff9a4a', 15);
        say("Fireproof salve. Ash, dung, and a thing I don't tell people. Dragon fire will only half-bite you now, and the heat in the far south-west won't cook you. Go carefully.", n.name);
        levelBanner = { text: 'QUEST COMPLETE', sub: 'Dragon Dung', t: 3 };
        if (quest.stage === 12 || quest.stage === 13) advanceQuest(14); else save();
      } else say(`Five dragon dung. You've got ${countItem('dragon_dung')}. They're south of here, in the ash. Big, green, and they breathe fire, so mind yourself.`, n.name);
    } else {
      if (q.salve && (quest.stage === 12 || quest.stage === 13)) advanceQuest(14);
      const pot = countItem('potato');
      if (pot > 0) { removeItem('potato', pot); q.potatoes += pot; giveOrDrop('coins', pot * 10, player.x, player.y); say(`Potatoes! ${pot} of them. Ten coins each, that's ${pot * 10}. Baked ones are eight, if you're hungry. And I'll buy dung at the counter.`, n.name); }
      else say("Potatoes? I pay ten coins a potato, grown anywhere. Dung I buy at the counter. Baked potato's eight, and seed if you want to farm the field.", n.name);
      openPanel('shop', 'dung');
    }
  };
  function drDrawDunstanLook(g, n) {
    const e = { x: n.px, y: n.py, facing: n.facing };
    if (dist(player.x, player.y, e.x, e.y) < 110 && !n.moving) e.facing = { x: Math.sign(player.x - e.x) || 0, y: Math.sign(player.y - e.y) || 1 };
    const ang = Math.atan2(e.facing.y, e.facing.x);
    g.save(); g.translate(e.x, e.y + (n.moving ? Math.sin(n.walkT) * 2 : 0));
    // pitchfork
    g.save(); g.rotate(ang + 0.85); g.fillStyle = '#8a6a3a'; g.fillRect(-8, -1.5, 34, 3); g.fillStyle = '#a9adb5'; g.fillRect(24, -6, 3, 12); for (const oy of [-6, 0, 6]) g.fillRect(26, oy - 1, 8, 2); g.restore();
    // straw hat
    g.fillStyle = '#d9b86a'; g.beginPath(); g.ellipse(0, -13, 13, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#c9a45a'; g.beginPath(); g.arc(0, -15, 7, Math.PI, 0); g.fill(); g.fillRect(-7, -15, 14, 2);
    g.fillStyle = '#6a3a2a'; g.fillRect(-7, -15, 14, 1.5);
    g.restore();
  }

  // ---------- world ----------
  const NATURAL = [T.GRASS, T.DIRT, T.TREE, T.OAK, T.STUMP, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.RUBBLE];
  const OURS = () => [DR_ASH, DR_LAVA, DR_OBSIDIAN, DR_DEADTREE, DR_BONES];
  HOOKS.world.push((rnd, api) => {
    const ours = OURS();
    // ash ground everywhere in the south-west except the lair rectangle (and the map's tree border)
    for (let y = AF.y0; y <= AF.y1 - 1; y++) for (let x = Math.max(1, AF.x0); x <= AF.x1; x++) {
      if (inFang(x, y)) continue;
      if (NATURAL.includes(api.tileAt(x, y))) api.setTile(x, y, DR_ASH);
    }
    // scorched dead trees and obsidian, scattered; never on the farm or the approach to the lair
    for (let y = AF.y0; y <= AF.y1 - 1; y++) for (let x = 1; x <= AF.x1; x++) {
      if (inFang(x, y) || inRect(APPROACH, x, y) || inRect(FARM, x, y) || api.tileAt(x, y) !== DR_ASH) continue;
      if (Math.abs(x - SHRINE_T.x) <= 3 && Math.abs(y - SHRINE_T.y) <= 3) continue;
      const r = rnd();
      if (r < 0.05) api.setTile(x, y, DR_DEADTREE);
      else if (r < 0.075) api.setTile(x, y, DR_OBSIDIAN);
    }
    // lava pools
    for (const [px, py, pr] of LAVA_POOLS) for (let y = py - 5; y <= py + 5; y++) for (let x = px - 5; x <= px + 5; x++) {
      if (inFang(x, y) || inRect(APPROACH, x, y) || inRect(FARM, x, y) || !inAshfields(x, y) || x < 1 || y > AF.y1 - 1) continue;
      const d = dist(x, y, px, py);
      if (d < pr + Math.sin(x * 1.7 + y * 0.9) * 0.9 && ours.includes(api.tileAt(x, y))) api.setTile(x, y, DR_LAVA);
      else if (d < pr + 1.6 && api.tileAt(x, y) === DR_ASH && rnd() < 0.35) api.setTile(x, y, DR_OBSIDIAN);
    }
    // dragon bones, the ruined shrine, obsidian by the entrance
    for (const [x, y] of BONES) if (api.tileAt(x, y) !== T.CAVE) api.setTile(x, y, DR_BONES);
    for (const [x, y] of ENTRANCE_OBSIDIAN) api.setTile(x, y, DR_OBSIDIAN);
    { const sx = SHRINE_T.x, sy = SHRINE_T.y;
      for (let y = sy - 3; y <= sy + 3; y++) for (let x = sx - 3; x <= sx + 3; x++) if (ours.includes(api.tileAt(x, y))) api.setTile(x, y, DR_ASH);
      for (const [dx, dy] of [[-3, -3], [-2, -3], [2, -3], [3, -3], [-3, -2], [3, -2], [-3, 1], [3, 0], [3, 2], [-3, 3], [3, 3], [-1, -3]]) api.setTile(sx + dx, sy + dy, T.CWALL);
      for (const [dx, dy] of [[-2, 2], [1, -2], [2, 3]]) api.setTile(sx + dx, sy + dy, T.RUBBLE);
      api.setTile(sx, sy, DR_SHRINE); }
    // Dunstan's dung field (fenced soil) and his fire
    api.pen(FIELD.x0, FIELD.y0, FIELD.x1, FIELD.y1, FIELD.gx, FIELD.gy);
    for (let y = FIELD.y0 + 1; y < FIELD.y1; y++) for (let x = FIELD.x0 + 1; x < FIELD.x1; x++) api.setTile(x, y, T.SOIL);
    api.setTile(FIRE_T.x, FIRE_T.y, T.FIRE);
    // the path in from Wolfwood (starts at the stone circle's south side) and the farm track: cleared, trodden
    const track = (pts, w) => { for (let s = 0; s < pts.length - 1; s++) { const [ax, ay] = pts[s], [bx, by] = pts[s + 1]; const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = 0; k <= steps; k++) { const x = Math.round(ax + (bx - ax) * k / steps), y = Math.round(ay + (by - ay) * k / steps);
        for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) { const t = api.tileAt(x + dx, y + dy); if ((NATURAL.includes(t) || ours.includes(t)) && Math.abs(dx) + Math.abs(dy) <= w) api.setTile(x + dx, y + dy, T.DIRT); } } } };
    track(PATH, 1); track(FARM_PATH, 0);
    // the approach to the lair stays open ash
    for (let y = APPROACH.y0; y <= APPROACH.y1; y++) for (let x = APPROACH.x0; x <= APPROACH.x1; x++) { if (inFang(x, y)) continue; const t = api.tileAt(x, y); if (ours.includes(t) && t !== DR_ASH) api.setTile(x, y, DR_ASH); }
    // dragons: nothing from the forest spawns in dragon country; clear a 3x3 of ash under each dragon
    for (let i = MONSTER_SPAWNS.length - 1; i >= 0; i--) { const s = MONSTER_SPAWNS[i]; if (inAshfields(s.tx, s.ty) && !inFang(s.tx, s.ty)) MONSTER_SPAWNS.splice(i, 1); }
    for (const [x, y] of [...GREEN_SPAWNS, ...RED_SPAWNS]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ours.includes(api.tileAt(x + dx, y + dy))) api.setTile(x + dx, y + dy, DR_ASH);
    api.spawnList('green_dragon', GREEN_SPAWNS);
    api.spawnList('red_dragon', RED_SPAWNS);
  });

  // ---------- runtime state: fireballs, lava burn, stats for the self-test ----------
  const DR = { fire: [], lavaT: 0, warnT: 0, stats: { hits: 0, lastDmg: 0, lastSalved: false, lavaWarn: 0 } };

  // ---------- use: obsidian, shrine, bones, lava ----------
  HOOKS.use.push((t, tx, ty) => {
    if (t === DR_OBSIDIAN) {
      const tier = hasTool('pickaxe');
      if (!tier) { notify('Obsidian. Black glass from the lava. You need a pickaxe to work it.'); return true; }
      if (skillLv('mining') < 35) { notify('You need Mining level 35 for obsidian.'); return true; }
      if (!canFit('obsidian', 1)) { notify('Your pack is full.'); return true; }
      player.action = { type: 'mine_obsidian', tx, ty, t: 0, need: Math.max(1.0, 2.6 - tier * 0.4), tier };
      return true;
    }
    if (t === DR_SHRINE) {
      const q = dq();
      say('An altar older than Thistledown. A dragon carved in the stone, one great fang in its jaw worn smooth by a thousand hands. Someone worshipped here.', 'Ruined shrine');
      if (!q.shrine) { q.shrine = true; say('They called it The Fang. It is not a carving. It sleeps in the far south-west, under the lava, and the dragons here are its children.', 'The Voice'); save(); }
      return true;
    }
    if (t === DR_BONES) { notify('Dragon bones, picked clean. Something bigger than a dragon killed this dragon.'); return true; }
    if (t === DR_DEADTREE) { notify('A scorched tree. Nothing left to cut.'); return true; }
    if (t === DR_LAVA) { notify('Lava. It would take the sword and the arm with it.'); return true; }
    return false;
  });

  // ---------- update: fire breath, fireballs, lava, obsidian swings, main quest triggers ----------
  HOOKS.update.push(dt => {
    const q = dq();
    // dragons breathe fire while chasing and within 5 tiles, every 2.5 s
    for (const m of monsters) {
      if (!DRAGONS.has(m.type) || m.dead) continue;
      m.fireCd = Math.max(0, (m.fireCd ?? 0) - dt);
      if (m.state !== 'chase' || m.stunT > 0 || window.__peace || player.dead) continue;
      const dp = dist(m.x, m.y, player.x, player.y);
      if (dp > 5 * TILE || m.fireCd > 0) continue;
      m.fireCd = 2.5; m.attackT = 0.3;
      const dx = player.x - m.x, dy = player.y - m.y, d = dp || 1, sp = 320;
      const sx = m.x + dx / d * (m.r + 10), sy = m.y + dy / d * (m.r + 10);
      DR.fire.push({ kind: 'fire', x: sx, y: sy, vx: dx / d * sp, vy: dy / d * sp, t: 0, life: 0.7, owner: 'monster', dmg: [8, 16], red: m.type === 'red_dragon' });
      burst(sx, sy, '#ff8a1a', 8, 90);
    }
    // fireballs: fly, die on solid ground (they cross lava and water), burn the knight
    for (const p of DR.fire) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) { p.done = true; burst(p.x, p.y, '#ff8a1a', 5, 50); continue; }
      const t = tileAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
      if (SOLID.has(t) && t !== T.WATER && t !== DR_LAVA) { p.done = true; burst(p.x, p.y, '#ff8a1a', 8, 70); continue; }
      if (!player.dead && dist(p.x, p.y, player.x, player.y) < player.r + 10) {
        let dmg = rint(p.dmg[0], p.dmg[1]); const salved = !!q.salve; if (salved) dmg = Math.ceil(dmg / 2);
        DR.stats.hits++; DR.stats.lastDmg = dmg; DR.stats.lastSalved = salved;
        hurtPlayer(dmg, p.x, p.y, true);
        if (salved) floatText(player.x, player.y - 40, 'the salve holds', '#ffb347', 12);
        burst(player.x, player.y, '#ff8a1a', 12, 100); p.done = true;
      }
    }
    if (DR.fire.some(p => p.done)) DR.fire = DR.fire.filter(p => !p.done);
    // lava: standing within a tile of it burns 1 hp a second (every 2 s with the salve)
    if (!player.dead) {
      const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE); let near = null;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) if (tileAt(ptx + dx, pty + dy) === DR_LAVA) near = { x: tc(ptx + dx), y: tc(pty + dy) };
      if (near) {
        DR.lavaT += dt; DR.warnT -= dt;
        if (DR.warnT <= 0) { DR.warnT = 3; DR.stats.lavaWarn++; notify(q.salve ? 'Lava. The salve takes the worst of it, but step back.' : 'The lava scorches you. Step back.'); }
        const every = q.salve ? 2 : 1;
        if (DR.lavaT >= every) {
          DR.lavaT -= every;
          if (player.mech) hurtPlayer(1, near.x, near.y, true);
          else { player.hp -= 1; player.sinceHurt = 0; floatText(player.x, player.y - 24, '-1 burn', '#ff8a1a', 13); burst(player.x, player.y + 8, '#ff8a1a', 4, 40); if (player.hp <= 0) die(); }
        }
      } else { DR.lavaT = 0; DR.warnT = 0; }
    }
    // obsidian swings finish here (the core leaves unknown action types alone)
    const a = player.action;
    if (a && a.type === 'mine_obsidian' && a.t >= a.need) {
      player.action = null;
      if (tileAt(a.tx, a.ty) === DR_OBSIDIAN) {
        burst(tc(a.tx), tc(a.ty), '#6a5a8a', 8, 70);
        giveOrDrop('obsidian', 1, player.x, player.y); gainXp('mining', 120);
        if (Math.random() < 1 / 3) { changeTile(a.tx, a.ty, T.RUBBLE); regrow.push({ i: idx(a.tx, a.ty), t: DR_OBSIDIAN, timer: 120 }); }
        else player.action = { ...a, t: 0 };
        save();
      }
    }
    // the main quest notices dragon country
    if (quest.stage === 11 && player.region === 'The Ashfields' && !player.dead) advanceQuest(12);
  });
  HOOKS.kill.push(m => {
    if (!DRAGONS.has(m.type)) return;
    const q = dq();
    if (!q.firstKill) { q.firstKill = true; say('A dragon. Down. Take what it leaves; the scales are worth more than the coins, and Dunstan wants the rest.', 'The Voice'); save(); }
    burst(m.x, m.y, '#ff8a1a', 30, 180);
  });

  // ---------- drawing ----------
  function drDrawLava(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, ph = time * 2 + tx * 0.9 + ty * 1.3;
    const gr = g.createRadialGradient(x + 24, y + 24, 14, x + 24, y + 24, 48); gr.addColorStop(0, `rgba(255,120,30,${0.3 + Math.sin(ph) * 0.08})`); gr.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = gr; g.fillRect(x - 24, y - 24, TILE + 48, TILE + 48);
    g.fillStyle = '#c8361a'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = `rgba(255,150,40,${0.5 + Math.sin(ph) * 0.2})`; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = 'rgba(60,20,10,0.6)';
    for (const [ox, oy, r] of [[10, 12, 7], [34, 30, 8], [30, 8, 4], [12, 36, 5], [40, 14, 3]]) { g.beginPath(); g.ellipse(x + ox + Math.sin(ph + ox) * 1.5, y + oy + Math.cos(ph + oy) * 1.2, r, r * 0.7, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,235,140,0.85)';
    for (let k = 0; k < 3; k++) { const bt = (time * 0.7 + k * 0.33 + tx * 0.1 + ty * 0.17) % 1; const bx = x + 8 + ((k * 17 + tx * 7) % 32), by = y + 8 + ((k * 23 + ty * 11) % 32); g.beginPath(); g.arc(bx, by, 1 + bt * 3, 0, 7); g.fill(); }
  }
  function drDrawObsidian(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)];
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + 12, 17, 7, 0, 0, 7); g.fill();
    const pts = [[-16, 8], [-14, -6], [-6, -15], [6, -13], [16, -4], [14, 9], [2, 13], [-9, 12]];
    g.fillStyle = ['#1e1a26', '#241e30', '#1a1622'][v]; g.beginPath(); for (const [x, y] of pts) g.lineTo(cx + x, cy + y); g.closePath(); g.fill();
    g.fillStyle = 'rgba(150,120,200,0.22)'; g.beginPath(); g.moveTo(cx - 10, cy - 4); g.lineTo(cx - 3, cy - 13); g.lineTo(cx + 5, cy - 11); g.lineTo(cx - 3, cy - 2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 8, cy - 8); g.lineTo(cx - 2, cy - 11); g.moveTo(cx + 4, cy + 2); g.lineTo(cx + 10, cy - 3); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 6, cy + 3); g.lineTo(cx + 2, cy + 7); g.lineTo(cx + 9, cy + 1); g.stroke();
    g.fillStyle = `rgba(255,120,60,${0.25 + Math.sin(time * 2 + tx) * 0.15})`; g.beginPath(); g.arc(cx + 6, cy + 6, 1.6, 0, 7); g.fill(); // an ember caught in the glass
  }
  function drDrawDeadTree(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty) + 8, v = variant[idx(tx, ty)];
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 6, 12, 5, 0, 0, 7); g.fill();
    g.strokeStyle = '#2a2420'; g.lineCap = 'round'; g.lineWidth = 7; g.beginPath(); g.moveTo(cx, cy + 6); g.lineTo(cx + (v - 1) * 2, cy - 22); g.stroke();
    g.lineWidth = 3.5; g.beginPath();
    g.moveTo(cx + (v - 1), cy - 12); g.lineTo(cx - 14, cy - 26); g.lineTo(cx - 18, cy - 24);
    g.moveTo(cx + (v - 1) * 2, cy - 22); g.lineTo(cx + 12, cy - 36); g.lineTo(cx + 10, cy - 42);
    g.moveTo(cx + (v - 1) * 2, cy - 22); g.lineTo(cx - 6, cy - 38);
    g.moveTo(cx + (v - 1), cy - 6); g.lineTo(cx + 13, cy - 14); g.stroke();
    g.fillStyle = `rgba(255,120,40,${0.3 + Math.sin(time * 3 + tx * 2) * 0.2})`; g.beginPath(); g.arc(cx + 4, cy - 30, 1.5, 0, 7); g.fill(); // an ember still glowing
  }
  function drDrawBones(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx, cy + 10, 20, 7, 0, 0, 7); g.fill();
    g.strokeStyle = '#e8dcc0'; g.lineWidth = 3; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const rx = cx - 14 + k * 7; g.beginPath(); g.arc(rx, cy + 2, 10 - k, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
    g.beginPath(); g.moveTo(cx - 20, cy + 3); g.lineTo(cx + 8, cy + 3); g.stroke();
    g.fillStyle = '#e8dcc0'; g.beginPath(); g.ellipse(cx + 14, cy - 2, 9, 7, -0.3, 0, 7); g.fill(); g.beginPath(); g.moveTo(cx + 20, cy + 2); g.lineTo(cx + 28, cy + 6); g.lineTo(cx + 18, cy + 5); g.closePath(); g.fill();
    g.fillStyle = '#2a2420'; g.beginPath(); g.ellipse(cx + 12, cy - 3, 2.5, 3, 0, 0, 7); g.fill();
    g.strokeStyle = '#d9d0c0'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx + 8, cy - 8); g.lineTo(cx + 2, cy - 15); g.moveTo(cx + 16, cy - 9); g.lineTo(cx + 14, cy - 16); g.stroke(); // horns
  }
  function drDrawShrine(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 20, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#6e7178'; g.fillRect(cx - 18, cy - 2, 36, 18); g.fillStyle = '#8d9098'; g.fillRect(cx - 20, cy - 6, 40, 6);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 12, cy + 2); g.lineTo(cx - 4, cy + 10); g.moveTo(cx + 6, cy); g.lineTo(cx + 12, cy + 14); g.stroke(); // cracks
    // the carved dragon head, one fang
    g.fillStyle = '#5a5d64'; g.beginPath(); g.ellipse(cx, cy - 16, 11, 8, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx + 9, cy - 14, 6, 4.5, 0, 0, 7); g.fill();
    g.strokeStyle = '#5a5d64'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 6, cy - 22); g.lineTo(cx - 12, cy - 30); g.moveTo(cx + 2, cy - 23); g.lineTo(cx + 4, cy - 31); g.stroke();
    g.fillStyle = '#e8dcc0'; g.beginPath(); g.moveTo(cx + 10, cy - 11); g.lineTo(cx + 12, cy - 4); g.lineTo(cx + 14, cy - 11); g.closePath(); g.fill();
    g.fillStyle = `rgba(255,60,40,${0.5 + Math.sin(time * 2) * 0.3})`; g.beginPath(); g.arc(cx - 3, cy - 17, 1.6, 0, 7); g.fill();
    for (const ox of [-15, 15]) { g.fillStyle = '#d9c88a'; g.fillRect(cx + ox - 2, cy - 12, 4, 8); g.fillStyle = `rgba(255,190,80,${0.6 + Math.sin(time * 9 + ox) * 0.3})`; g.beginPath(); g.ellipse(cx + ox, cy - 15, 2, 3.5, 0, 0, 7); g.fill(); }
  }
  function drDrawFire(g, p) {
    const ang = Math.atan2(p.vy, p.vx), r = p.red ? 11 : 9;
    g.save(); g.translate(p.x, p.y); g.rotate(ang);
    const gr = g.createRadialGradient(0, 0, 2, 0, 0, r * 2.6); gr.addColorStop(0, 'rgba(255,170,60,0.45)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 2.6, 0, 7); g.fill();
    for (let k = 3; k >= 1; k--) { const f = k / 3; g.fillStyle = `rgba(255,${200 - k * 30},${60 + k * 10},${0.55 - k * 0.12})`; g.beginPath(); g.ellipse(-r * 0.9 * k - Math.sin(time * 40 + k) * 2, Math.sin(time * 30 + k * 2) * 2, r * (1 - f * 0.5), r * (0.8 - f * 0.4), 0, 0, 7); g.fill(); } // yellow tail
    g.fillStyle = '#ff7a1a'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); // orange core
    g.fillStyle = '#ffd166'; g.beginPath(); g.arc(2, 0, r * 0.5, 0, 7); g.fill();
    g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(3, 0, r * 0.22, 0, 7); g.fill();
    g.restore();
  }
  function drDrawAsh(g, cam) {
    g.fillStyle = 'rgba(200,204,210,0.4)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137.5 + time * (8 + (i % 5) * 3)) % (VW + 40) - 20, sy = (i * 89.3 + time * (14 + (i % 3) * 5)) % (VH + 40) - 20;
      g.beginPath(); g.arc(cam.x + sx + Math.sin(time * 1.4 + i) * 8, cam.y + sy, 1.2 + (i % 3) * 0.7, 0, 7); g.fill();
    }
  }
  const drFullGodly = () => ['helm', 'body', 'legs', 'shield'].every(s => player.equip[s] && player.equip[s].startsWith('godly_'));
  function drDrawWings(g) {
    const bob = player.moving ? Math.sin(player.walkT) * 2 : 0;
    const flap = Math.sin(time * 3) * 0.1 + (player.moving ? Math.sin(player.walkT * 0.5) * 0.28 : 0);
    g.save(); g.translate(player.x, player.y + bob - 12);
    for (const s of [-1, 1]) {
      g.save(); g.scale(s, 1); g.rotate(-flap);
      g.fillStyle = '#fff6dc'; g.strokeStyle = '#d9b64a'; g.lineWidth = 1;
      for (let f = 0; f < 3; f++) { const a = -0.3 - f * 0.34, L = 18 - f * 3; const ex = 8 + Math.cos(a) * L, ey = Math.sin(a) * L;
        g.beginPath(); g.moveTo(8, 0); g.quadraticCurveTo(8 + Math.cos(a) * L * 0.55, Math.sin(a) * L * 0.55 - 4, ex, ey); g.quadraticCurveTo(8 + Math.cos(a) * L * 0.55 + 2, Math.sin(a) * L * 0.55 + 2, 8, 3); g.closePath(); g.fill(); g.stroke(); }
      g.fillStyle = '#f5c542'; g.beginPath(); g.arc(8, 1, 2.2, 0, 7); g.fill();
      g.restore();
    }
    g.restore();
  }
  function drDrawAura(g) {
    const cx = player.x, cy = player.y + player.r * 0.85, pulse = 0.22 + Math.sin(time * 2.5) * 0.06;
    const gr = g.createRadialGradient(cx, cy, 4, cx, cy, 34); gr.addColorStop(0, `rgba(255,225,120,${pulse + 0.15})`); gr.addColorStop(1, 'rgba(255,225,120,0)');
    g.save(); g.translate(cx, cy); g.scale(1, 0.5); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill(); g.restore();
    g.fillStyle = 'rgba(255,240,180,0.8)'; for (let k = 0; k < 4; k++) { const a = time * 1.6 + k * Math.PI / 2; g.beginPath(); g.arc(cx + Math.cos(a) * 22, cy + Math.sin(a) * 9 - 2, 1.4, 0, 7); g.fill(); }
  }
  const DR_USABLE = () => [DR_OBSIDIAN, DR_SHRINE, DR_BONES, DR_DEADTREE, DR_LAVA];
  HOOKS.draw.push((g, items, cam) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === DR_LAVA) items.push({ y: ty * TILE - 20, draw: () => drDrawLava(g, tx, ty) });
      else if (t === DR_OBSIDIAN) items.push({ y: ty * TILE + TILE - 4, draw: () => drDrawObsidian(g, tx, ty) });
      else if (t === DR_DEADTREE) items.push({ y: ty * TILE + TILE - 4, draw: () => drDrawDeadTree(g, tx, ty) });
      else if (t === DR_BONES) items.push({ y: ty * TILE + TILE - 6, draw: () => drDrawBones(g, tx, ty) });
      else if (t === DR_SHRINE) items.push({ y: ty * TILE + TILE - 6, draw: () => drDrawShrine(g, tx, ty) });
    }
    // Dunstan's hat and pitchfork over the core's sprite
    const dun = NPCS.find(n => n.id === 'dunstan');
    if (dun && dun.px > cam.x - 60 && dun.px < cam.x + VW + 60 && dun.py > cam.y - 60 && dun.py < cam.y + VH + 60) items.push({ y: dun.py + 13.5, draw: () => drDrawDunstanLook(g, dun) });
    // the knight: pickaxe while mining obsidian, wings on the godly helm, an aura under the full set
    const a = player.action;
    if (!player.dead && !player.mech) {
      if (a && a.type === 'mine_obsidian') items.push({ y: player.y + player.r + 0.01, draw: () => {
        const ang = Math.atan2(player.facing.y, player.facing.x), sw = Math.sin(time * 14) * 0.6;
        g.save(); g.translate(player.x, player.y); g.rotate(ang - 0.7 + sw); g.fillStyle = '#8a6a3a'; g.fillRect(2, -1.5, 26, 3);
        g.fillStyle = a.tier >= 3 ? '#7aa0d0' : a.tier === 2 ? '#a9adb5' : '#b8863a'; g.beginPath(); g.moveTo(24, -2); g.quadraticCurveTo(30, -8, 34, -6); g.lineTo(30, 0); g.lineTo(34, 6); g.quadraticCurveTo(30, 8, 24, 2); g.closePath(); g.fill(); g.restore();
      } });
      if (drFullGodly()) items.push({ y: player.y + player.r - 0.5, draw: () => drDrawAura(g) });
      if (player.equip.helm && ITEMS[player.equip.helm].wings) items.push({ y: player.y + player.r + 0.5, draw: () => drDrawWings(g) });
    }
    // fireballs above the world, ash drifting over dragon country
    for (const p of DR.fire) items.push({ y: 1e8, draw: () => drDrawFire(g, p) });
    if (cam.x < (AF.x1 + 1) * TILE && cam.x + VW > AF.x0 * TILE && cam.y + VH > AF.y0 * TILE && cam.y < (AF.y1 + 1) * TILE) items.push({ y: 1e8 + 1, draw: () => drDrawAsh(g, cam) });
    // use-highlight for our tiles (the core only highlights what it knows)
    if (!player.dead && !player.mech && !npcInFront()) items.push({ y: 1e9 + 2, draw: () => {
      const { tx, ty } = frontTile(player);
      if (DR_USABLE().includes(tileAt(tx, ty))) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const isDragon = m => DRAGONS.has(m.type);
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    // a 7x3 patch of open ash inside dragon country, off the lair rectangle
    const ashSpot = (cx, cy) => { for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, y = cy + dy; if (inFang(x, y) || !inAshfields(x, y)) continue; let ok = true; for (let yy = y - 1; yy <= y + 1 && ok; yy++) for (let xx = x - 3; xx <= x + 3 && ok; xx++) if (tileAt(xx, yy) !== DR_ASH) ok = false; if (ok) return { x, y }; } return { x: cx, y: cy }; };
    const besideTile = (tx, ty) => { for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) if (inMap(tx + dx, ty + dy) && !SOLID.has(tileAt(tx + dx, ty + dy))) return { x: tx + dx, y: ty + dy }; return null; };
    h.peace(true);
    // region + path
    { let ash = 0, lava = 0, obs = 0; for (let y = AF.y0; y <= AF.y1; y++) for (let x = AF.x0; x <= AF.x1; x++) { if (inFang(x, y)) continue; const t = tileAt(x, y); if (t === DR_ASH) ash++; else if (t === DR_LAVA) lava++; else if (t === DR_OBSIDIAN) obs++; }
      check('dragons: The Ashfields region fills the south-west (ash, lava, obsidian), Wolfwood ends at y 95', REGIONS.some(r => r.name === 'The Ashfields') && regionAt(60, 110).name === 'The Ashfields' && regionAt(60, 94).name === 'Wolfwood' && ash > 1500 && lava >= 40 && obs >= 30, { at60_110: regionAt(60, 110).name, at60_94: regionAt(60, 94).name, ash, lava, obs }); }
    { const toFarm = F.bfs(60, 94, DUNSTAN_T.x, DUNSTAN_T.y + 1), toLair = F.bfs(60, 94, 36, 105);
      check('dragons: the path from Wolfwood (60,94) reaches the farm and the approach to the lair', !!toFarm && !!toLair && tileAt(60, 96) === T.DIRT, { farm: toFarm && toFarm.length, lair: toLair && toLair.length }); }
    // lava burns
    { let lava = null, side = null; for (let y = AF.y0; y <= AF.y1 && !side; y++) for (let x = 36; x <= AF.x1 && !side; x++) if (tileAt(x, y) === DR_LAVA) { const b = besideTile(x, y); if (b) { lava = { x, y }; side = b; } }
      let hp0 = 0, warn0 = DR.stats.lavaWarn; if (side) { F.tp(side.x, side.y); player.hp = player.maxHp; hp0 = player.hp; F.sim(150); }
      check('dragons: standing beside lava burns 1 hp a second, with a warning', !!side && player.hp <= hp0 - 2 && DR.stats.lavaWarn > warn0, { lava, side, hp0, hp: player.hp }); F.tp(60, 100); }
    // dragons live here
    { const ds = monsters.filter(isDragon), gr = ds.filter(m => m.type === 'green_dragon'), rd = ds.filter(m => m.type === 'red_dragon');
      check('dragons: four green and two red dragons sleep in the Ashfields (lv 45 / lv 60, fire-breathing, aggressive)', gr.length === 4 && rd.length === 2 && ds.every(m => inAshfields(Math.floor(m.home.x / TILE), Math.floor(m.home.y / TILE)) && !inFang(Math.floor(m.home.x / TILE), Math.floor(m.home.y / TILE)) && m.angry) && MONSTER_DEFS.green_dragon.hp === 260 && MONSTER_DEFS.red_dragon.hp === 420 && MONSTER_DEFS.green_dragon.level === 45 && MONSTER_DEFS.red_dragon.level === 60, { green: gr.length, red: rd.length }); }
    // fire breath, then half damage with the salve
    { const q = dq(); const spot = ashSpot(72, 124); F.tp(spot.x, spot.y); player.facing = { x: 1, y: 0 };
      const others = monsters.filter(m => !m.dead && m !== monsters.find(isDragon)); for (const m of others) { m.stunT = 999; }
      const g = monsters.find(m => isDragon(m) && !m.dead); const oldSpeed = g.speed, oldSalve = q.salve; q.salve = false;
      const arm = () => { g.x = player.x + 3 * TILE; g.y = player.y; g.home = { x: g.x, y: g.y }; g.state = 'chase'; g.angry = true; g.hp = g.maxHp; g.stunT = 0; g.speed = 0; g.fireCd = 0; g.attackCd = 99; DR.fire = []; player.hp = 150; };
      h.peace(false); arm(); const hits0 = DR.stats.hits; F.sim(240); const hit1 = DR.stats.hits > hits0, dmg1 = DR.stats.lastDmg, hp1 = player.hp, salved1 = DR.stats.lastSalved;
      F.tp(spot.x, spot.y); q.salve = true; arm(); const hits1 = DR.stats.hits; F.sim(240); const hit2 = DR.stats.hits > hits1, dmg2 = DR.stats.lastDmg, salved2 = DR.stats.lastSalved;
      check('dragons: a chasing dragon 3 tiles away breathes fire that burns the knight', hit1 && hp1 < 150 && dmg1 >= 8 && dmg1 <= 16 && !salved1 && !player.dead, { hit1, dmg1, hp1, fire: DR.fire.length, state: g.state });
      check('dragons: with the fireproof salve the fire only half-bites', hit2 && dmg2 >= 4 && dmg2 <= 8 && salved2, { hit2, dmg2 });
      q.salve = oldSalve; g.speed = oldSpeed; g.fireCd = 0; g.attackCd = 0; for (const m of others) m.stunT = 0; h.peace(true); DR.fire = []; player.hp = player.maxHp; }
    // kill a green dragon: dung drops
    { const spot = ashSpot(72, 124); F.tp(spot.x, spot.y); player.facing = { x: 1, y: 0 };
      const g = monsters.find(m => m.type === 'green_dragon' && !m.dead); const d0 = countItem('dragon_dung'); g.hp = 1;
      for (let i = 0; i < 80 && !g.dead; i++) { g.x = player.x + 40; g.y = player.y; g.stunT = 0; g.state = 'idle'; player.attackCd = 0; F.press('Space'); F.sim(3, []); }
      const dung = drops.some(d => d.id === 'dragon_dung') || countItem('dragon_dung') > d0, scale = drops.some(d => d.id === 'dragon_scale') || countItem('dragon_scale') > 0;
      check('dragons: a slain green dragon drops dragon dung and scales', g.dead && dung && scale, { dead: g.dead, dung, scale, dropped: drops.filter(d => dist(d.x, d.y, player.x, player.y) < 120).map(d => d.id) }); g.x = g.home.x; g.y = g.home.y; }
    // Dunstan: the main quest 11 → 12 → 13 → 14, and the dung quest
    { const q = dq(); q.stage = 0; q.salve = false; quest.stage = 11; while (countItem('dragon_dung') > 0) removeItem('dragon_dung', countItem('dragon_dung'));
      drain(); F.tp(60, 100); F.sim(3); const s12 = quest.stage === 12;
      const stand = { x: DUNSTAN_T.x, y: DUNSTAN_T.y + 1 }; F.tp(stand.x, stand.y); F.face(DUNSTAN_T.x, DUNSTAN_T.y); drain(); F.press('KeyE'); F.sim(3, []);
      const asked = q.stage === 1 && quest.stage === 13 && dialog.cur && /Dunstan/.test(dialog.cur.who) && activeQuests().includes('dragons') && /dung/.test(questText('dragons')) && /Dunstan/.test(questText('main'));
      drain(); F.press('KeyE'); F.sim(3, []); const notYet = q.stage === 1 && dialog.cur && /got 0/.test(dialog.cur.text);
      check('dragons: entering the Ashfields at stage 11 moves the story to 12; Dunstan asks for 5 dragon dung (13)', s12 && asked && notYet, { s12, asked, notYet, stage: quest.stage, who: dialog.cur && dialog.cur.who, text: dialog.cur && dialog.cur.text });
      h.give('dragon_dung', 5); const c0 = coins(), fx0 = player.skills.farming.xp; drain(); F.face(DUNSTAN_T.x, DUNSTAN_T.y); F.press('KeyE'); F.sim(3, []);
      check('dragons: five dung → 150 coins, the fireproof salve is applied ("Hold still"), story at 14', q.stage === 2 && q.salve === true && coins() === c0 + 150 && countItem('dragon_dung') === 0 && player.skills.farming.xp === fx0 + 150 && quest.stage === 14 && /Fang/.test(questText('main')) && !activeQuests().includes('dragons'), { stage: q.stage, salve: q.salve, coins: coins() - c0, main: quest.stage });
      while (countItem('potato') > 0) removeItem('potato', countItem('potato')); h.give('potato', 3); const c1 = coins(); drain(); F.face(DUNSTAN_T.x, DUNSTAN_T.y); F.press('KeyE'); F.sim(2, []);
      const shopOpen = panel === 'shop' && panelArg === 'dung'; closePanel();
      check('dragons: Dunstan buys potatoes at 10 coins each and opens his stall (baked potato 8)', coins() === c1 + 30 && countItem('potato') === 0 && shopOpen && SHOPS.dung.stock.some(([id, p]) => id === 'baked_potato' && p === 8), { coins: coins() - c1, shopOpen, panel, panelArg }); }
    // obsidian: pickaxe + Mining 35
    { const r = F.nearestTile([DR_OBSIDIAN], { x: tc(60), y: tc(100) }); const side = r && besideTile(r.x, r.y); let noPick = false, lowLv = false, started = false, steps = 'skipped', o0 = 0, mx0 = 0;
      if (side) { F.tp(side.x, side.y); F.face(r.x, r.y);
        const stash = []; for (let i = 0; i < INV_SLOTS; i++) { const s = player.inv[i]; if (s && ITEMS[s.id].tool === 'pickaxe') { stash.push([i, s]); player.inv[i] = null; } } const eqw = player.equip.weapon; if (eqw && ITEMS[eqw].tool === 'pickaxe') player.equip.weapon = null;
        F.press('KeyE'); F.sim(2, []); noPick = !player.action && notice && /pickaxe/.test(notice.text);
        for (const [i, s] of stash) player.inv[i] = s; if (eqw && ITEMS[eqw].tool === 'pickaxe') player.equip.weapon = eqw; if (!hasTool('pickaxe')) h.give('bronze_pickaxe', 1);
        const mxSaved = player.skills.mining.xp; player.skills.mining.xp = XP_TABLE[34]; F.face(r.x, r.y); F.press('KeyE'); F.sim(2, []); lowLv = !player.action && notice && /Mining level 35/.test(notice.text);
        player.skills.mining.xp = Math.max(mxSaved, XP_TABLE[35]); o0 = countItem('obsidian'); mx0 = player.skills.mining.xp; F.face(r.x, r.y); F.press('KeyE'); started = player.action && player.action.type === 'mine_obsidian';
        steps = F.untilAction(600, () => countItem('obsidian') > o0); player.action = null; }
      check('dragons: obsidian needs a pickaxe, then Mining 35; mining it gives obsidian and 120 xp', !!side && noPick && lowLv && started && typeof steps === 'number' && countItem('obsidian') === o0 + 1 && player.skills.mining.xp === mx0 + 120, { r, side, noPick, lowLv, started, steps, obsidian: countItem('obsidian') }); }
    // the godly platebody at Brakka's anvil
    { h.clearJunk(); for (let n = 0; n < 5 && player.inv.filter(s => !s).length < 5; n++) { const i = player.inv.findIndex(s => s && !ITEMS[s.id].armour && !ITEMS[s.id].weapon && !ITEMS[s.id].tool && s.id !== 'coins' && !s.id.startsWith('dragon') && s.id !== 'obsidian'); if (i < 0) break; player.inv[i] = null; }
      while (countItem('dragon_scale') < 8) h.give('dragon_scale', 1); while (countItem('mithril_bar') < 3) h.give('mithril_bar', 1); while (countItem('obsidian') < 1) h.give('obsidian', 1); if (!hasTool('hammer')) h.give('hammer', 1);
      if (player.skills.smithing.xp < XP_TABLE[48]) player.skills.smithing.xp = XP_TABLE[48];
      const sc0 = countItem('dragon_scale'), mb0 = countItem('mithril_bar'), ob0 = countItem('obsidian'), b0 = countItem('godly_body'), sx0 = player.skills.smithing.xp;
      F.tp(93, 39); F.walkTo(94, 39, 500); F.face(94, 38); F.press('KeyE'); const open = panel === 'station' && panelArg === 'anvil';
      let viaButton = F.clickButton('8 Dragon scales + 3 Mithril bars + Obsidian → Godly platebody'); if (!viaButton) craft(RECIPES.find(r => r.out === 'godly_body')); // the anvil list is cut short on small screens
      const steps = F.untilAction(300, () => countItem('godly_body') > b0); closePanel();
      check('dragons: 8 dragon scales + 3 mithril bars + obsidian smith a Godly platebody at the anvil (Smithing 48, 500 xp)', open && typeof steps === 'number' && countItem('godly_body') === b0 + 1 && countItem('dragon_scale') === sc0 - 8 && countItem('mithril_bar') === mb0 - 3 && countItem('obsidian') === ob0 - 1 && player.skills.smithing.xp === sx0 + 500 && ITEMS.godly_body.armour.def === 55, { open, viaButton, steps, body: countItem('godly_body'), xp: player.skills.smithing.xp - sx0 }); }
    // the winged helm equips (the wings are drawn by HOOKS.draw when player.equip.helm has wings: true)
    { const prev = player.equip.helm; if (prev) { player.equip.helm = null; } h.give('godly_helm', 1); const slot = player.inv.findIndex(s => s && s.id === 'godly_helm'); if (slot >= 0) equipItem(slot);
      check('dragons: the Godly winged helm equips (def 30, wings drawn on the knight)', player.equip.helm === 'godly_helm' && ITEMS.godly_helm.wings === true && ITEMS.godly_helm.armour.def === 30 && gearBonus('def') >= 30, { helm: player.equip.helm, slot });
      player.equip.helm = prev; removeItem('godly_helm', 1); removeItem('godly_body', 1); }
    h.peace(false);
  });
}
