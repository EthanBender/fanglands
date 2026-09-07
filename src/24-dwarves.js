// ============================================================================
// DEEPHOLM — the dwarven undercity under Grey Quarry, and the mithril tier
// Feature file. Registers everything through HOOKS; edits no core file.
// Everything lives in one block so no name leaks into the shared script scope.
// ============================================================================
{
  // ---------- tiles (ids captured locally so a later addTile of the same name cannot move them) ----------
  const DW_LAMP = addTile('LAMP', { solid: true, tex: 'cave', mini: '#f5c542' });
  const DW_SHAFT = addTile('SHAFT', { solid: true, tex: 'dirt', mini: '#3a3a42' });
  const DW_LADDER = addTile('LADDER_UP', { solid: true, tex: 'cave', mini: '#a5763f' });
  const DW_MITHRIL = addTile('MITHRIL', { solid: true, tex: 'cave', mini: '#5a7aa8' });
  const DW_THRONE = addTile('DWARF_THRONE', { solid: true, tex: 'cave', mini: '#6e7178' });
  const DW_CHEST = addTile('DWARF_CHEST', { solid: true, tex: 'cave', mini: '#8a5a2b' });

  // ---------- geometry ----------
  // The undercity fills the far south-west. It starts at y 72 so the last knight's grave (12, 70) stays in Wolfwood.
  const DH = { x0: 2, y0: 72, x1: 26, y1: 94 };
  const SHAFT_T = { x: 56, y: 6 };   // Grey Quarry mine shaft; you stand on (56, 7) to use it
  const LADDER_T = { x: 14, y: 74 }; // Deepholm entrance hall; you land on (14, 75)
  const THRONE_T = { x: 14, y: 93 };
  const FORGES = [[10, 80], [18, 80]], ANVILS = [[11, 82], [17, 82]];
  const PILLARS = [[9, 81], [19, 81], [9, 85], [19, 85]];
  const LAMPS = [[11, 73], [17, 73], [5, 76], [23, 76], [6, 82], [22, 82], [6, 84], [22, 84], [9, 88], [19, 88], [9, 93], [19, 93]];
  const MITHRIL_ROCKS = [[3, 73], [5, 73], [8, 74], [3, 76], [8, 77], [4, 78], [20, 73], [23, 73], [25, 74], [20, 76], [25, 77], [24, 78]];
  const CHESTS = [[6, 86], [22, 86]];
  const MITHRIL = '#7aa0d0';

  REGIONS.unshift({ name: 'Deepholm', sub: 'The dwarven undercity', x0: DH.x0, y0: DH.y0, x1: DH.x1, y1: DH.y1 });
  const inDeepholm = (tx, ty) => tx >= DH.x0 && tx <= DH.x1 && ty >= DH.y0 && ty <= DH.y1;

  // ---------- items ----------
  Object.assign(ITEMS, {
    mithril_ore: { name: 'Mithril ore', value: 40, color: '#5a7aa8', shape: 'rock' },
    mithril_bar: { name: 'Mithril bar', value: 120, color: MITHRIL, shape: 'bar' },
    mithril_sword: { name: 'Mithril sword', value: 900, color: MITHRIL, shape: 'sword', weapon: { str: 24, att: 20, cd: 0.45 } },
    mithril_battleaxe: { name: 'Mithril battleaxe', value: 1200, color: MITHRIL, shape: 'battleaxe', weapon: { str: 30, att: 15, cd: 0.75, perk: 'cleave' } },
    mithril_helm: { name: 'Mithril helm', value: 700, color: MITHRIL, shape: 'helm', armour: { slot: 'helm', def: 14 } },
    mithril_body: { name: 'Mithril platebody', value: 1600, color: MITHRIL, shape: 'body', armour: { slot: 'body', def: 30 } },
    mithril_legs: { name: 'Mithril platelegs', value: 1100, color: MITHRIL, shape: 'legs', armour: { slot: 'legs', def: 20 } },
    mithril_shield: { name: 'Mithril shield', value: 800, color: MITHRIL, shape: 'shield', armour: { slot: 'shield', def: 12 } },
    mithril_pickaxe: { name: 'Mithril pickaxe', value: 900, color: MITHRIL, shape: 'pickaxe', tool: 'pickaxe', tier: 3 },
    mithril_axe: { name: 'Mithril axe', value: 700, color: MITHRIL, shape: 'axe', tool: 'axe', tier: 3, weapon: { str: 12, att: 8, cd: 0.6 } },
  });
  for (const k of ['mithril_ore', 'mithril_bar', 'mithril_sword', 'mithril_battleaxe', 'mithril_helm', 'mithril_body', 'mithril_legs', 'mithril_shield', 'mithril_pickaxe', 'mithril_axe']) {
    ITEMS[k].id = k; ITEMS[k].stack = (ITEMS[k].weapon || ITEMS[k].armour || ITEMS[k].tool) ? 1 : 50;
  }
  SMELT.push({ out: 'mithril_bar', needs: [['mithril_ore', 1], ['coal', 2]], lv: 20, xp: 30, label: 'Mithril ore + 2 Coal → Mithril bar' });
  // the sword is first so it stays inside the anvil panel's visible rows on small screens
  RECIPES.push(
    { out: 'mithril_sword', qty: 1, needs: [['mithril_bar', 2]], station: 'anvil', skill: 'smithing', lv: 22, xp: 100, label: '2 mithril bars → Mithril sword' },
    { out: 'mithril_helm', qty: 1, needs: [['mithril_bar', 1]], station: 'anvil', skill: 'smithing', lv: 22, xp: 50, label: '1 mithril bar → Mithril helm' },
    { out: 'mithril_dagger', qty: 1, needs: [['mithril_bar', 1]], station: 'anvil', skill: 'smithing', lv: 23, xp: 50, label: '1 mithril bar → Mithril dagger' },
    { out: 'mithril_pickaxe', qty: 1, needs: [['mithril_bar', 2]], station: 'anvil', skill: 'smithing', lv: 24, xp: 100, label: '2 mithril bars → Mithril pickaxe' },
    { out: 'mithril_axe', qty: 1, needs: [['mithril_bar', 2]], station: 'anvil', skill: 'smithing', lv: 24, xp: 100, label: '2 mithril bars → Mithril axe' },
    { out: 'mithril_shield', qty: 1, needs: [['mithril_bar', 2]], station: 'anvil', skill: 'smithing', lv: 25, xp: 100, label: '2 mithril bars → Mithril shield' },
    { out: 'mithril_legs', qty: 1, needs: [['mithril_bar', 2]], station: 'anvil', skill: 'smithing', lv: 26, xp: 100, label: '2 mithril bars → Mithril platelegs' },
    { out: 'mithril_warhammer', qty: 1, needs: [['mithril_bar', 3]], station: 'anvil', skill: 'smithing', lv: 27, xp: 150, label: '3 mithril bars → Mithril warhammer (knockback)' },
    { out: 'mithril_battleaxe', qty: 1, needs: [['mithril_bar', 3]], station: 'anvil', skill: 'smithing', lv: 28, xp: 150, label: '3 mithril bars → Mithril battleaxe (cleave)' },
    { out: 'mithril_body', qty: 1, needs: [['mithril_bar', 3]], station: 'anvil', skill: 'smithing', lv: 30, xp: 150, label: '3 mithril bars → Mithril platebody' },
  );
  SHOPS.dwarf = { name: "Brunhild's Forge", stock: [['mithril_pickaxe', 900], ['coal', 25], ['hammer', 5], ['iron_bar', 40]] };

  // ---------- dwarf guards (monsters: neutral, human-moving, bearded) ----------
  MONSTER_DEFS.dwarf_guard = { name: 'Dwarf guard', level: 20, r: 12, hp: 90, att: 22, maxHit: 11, def: 20, speed: 140, aggro: false, sight: 6 * TILE, respawn: 90, human: true,
    drops: { always: [['coins', 12, 30]], table: [['nothing', 0, 0, 10], ['coal', 1, 2, 5], ['iron_bar', 1, 1, 3]], rare: { chance: 40, table: [['mithril_ore', 1, 1, 1]] } } };
  function dwBigBeard(g, hair) { g.fillStyle = hair; g.beginPath(); g.ellipse(0, -1, 7, 6, 0, 0, Math.PI); g.fill(); g.beginPath(); g.ellipse(-3, 4, 2.2, 3.5, 0, 0, 7); g.ellipse(3, 4, 2.2, 3.5, 0, 0, 7); g.fill(); }
  HOOKS.drawMonster.dwarf_guard = (g, e, hurt) => {
    g.save(); g.scale(0.85, 0.85);
    drawHuman(g, e, { tunic: '#7a2e2e', hair: '#c9843a', helm: '#8f96a3', beard: true, shoulder: '#8f96a3', weapon: { shape: 'battleaxe', color: '#a9adb5' } });
    dwBigBeard(g, hurt ? '#e0a070' : '#c9843a');
    g.restore();
  };

  // ---------- quest state ----------
  QUEST_DEFS.dwarf = { name: 'The King Under the Quarry' };
  const dq = () => quest.dwarf || (quest.dwarf = { stage: 0, chests: [], visited: false });
  HOOKS.newGame.push(() => { quest.dwarf = { stage: 0, chests: [], visited: false }; });
  HOOKS.questText.dwarf = () => dq().stage >= 2 ? 'Done.' : `Bring King Thrain 5 coal (${Math.min(5, countItem('coal'))}/5) and 3 iron bars (${Math.min(3, countItem('iron_bar'))}/3) to relight the great forge of Deepholm.`;
  HOOKS.activeQuests.push(() => dq().stage === 1 ? ['dwarf'] : []);

  // ---------- the dwarves (own list: drawn short, never wander, talked to through HOOKS.use) ----------
  const DWARVES = [
    { id: 'thrain', name: 'King Thrain', x: THRONE_T.x, y: THRONE_T.y, tunic: '#7a2e2e', hair: '#d9d0c0', crown: true, shoulder: '#c9a36a', role: 'dwarf_king', sortY: 10 },
    { id: 'brunhild', name: 'Brunhild the smith', x: 12, y: 81, tunic: '#5a4a3a', hair: '#c9843a', apron: true, helm: '#8f96a3', role: 'dwarf_shop', shop: 'dwarf' },
    { id: 'dagny', name: 'Dagny', x: 16, y: 76, tunic: '#8a5a2a', hair: '#3a2a1a', helm: '#8f96a3', role: 'dwarf_villager', lines: ["Mind the ladder. It's older than the king.", 'Coal from the quarry above keeps our lamps lit. Bring some down if you are passing.', 'The blue rock in the galleries is mithril. Any pick will work it, if your arm is strong enough. Mining twenty.'] },
    { id: 'orik', name: 'Orik', x: 16, y: 85, tunic: '#6a3a2a', hair: '#7a3a1a', role: 'dwarf_villager', lines: ['Mithril bars need two coal each. Two. Not one.', "Brunhild won't trade while the great forge is cold. Talk to the king, south past the guards.", 'Steel bends. Mithril does not.'] },
    { id: 'hilde', name: 'Hilde', x: 10, y: 90, tunic: '#7a4a3a', hair: '#e0c080', woman: true, role: 'dwarf_villager', lines: ['King Thrain has sat that throne since before the goblins came.', 'The guards are for show. Mostly.', 'A mithril platebody takes three bars and a Smithing of thirty. Then nothing in the Fanglands touches you.'] },
  ];
  for (const d of DWARVES) { d.px = tc(d.x); d.py = tc(d.y); d.facing = { x: 0, y: 1 }; }
  function dwInFront() {
    let best = null;
    for (const d of DWARVES) {
      const dd = dist(player.x, player.y, d.px, d.py); if (dd > 80) continue;
      const dot = ((d.px - player.x) * player.facing.x + (d.py - player.y) * player.facing.y) / (dd || 1);
      if (dot < 0.2 && dd > 30) continue;
      if (!best || dd < best.dd) best = { d, dd };
    }
    return best ? best.d : null;
  }
  function dwTalk(d) {
    { const dx = d.px - player.x, dy = d.py - player.y, dd = Math.hypot(dx, dy) || 1; player.facing = { x: dx / dd, y: dy / dd }; }
    const q = dq();
    if (d.role === 'dwarf_king') {
      if (q.stage === 0) { q.stage = 1; say("A knight of the surface, in Deepholm? Then you came down the old shaft. Good. Few remember it.", d.name); say("Our great forge went cold when the goblins cut the coal road. Bring me 5 coal and 3 iron bars and we relight it. Then Brunhild trades with you.", d.name); save(); }
      else if (q.stage === 1) {
        if (countItem('coal') >= 5 && countItem('iron_bar') >= 3) {
          removeItem('coal', 5); removeItem('iron_bar', 3); q.stage = 2;
          giveOrDrop('coins', 300, player.x, player.y); gainXp('smithing', 200);
          for (const [fx, fy] of FORGES) burst(tc(fx), tc(fy), '#ffb347', 20, 100);
          say("Coal and iron. The forge breathes again! Three hundred coins, and my smith's ear. The mithril in our galleries is yours to shape, knight.", d.name);
          levelBanner = { text: 'QUEST COMPLETE', sub: 'The King Under the Quarry', t: 3 }; save();
        } else say(`Five coal and three iron bars. You carry ${countItem('coal')} coal and ${countItem('iron_bar')} bars. The quarry above has coal if you can dig it, and Brakka's forge in Thistledown makes bars.`, d.name);
      } else say("The forge burns hot. Brunhild sells a mithril pick now. The blue rock needs Mining twenty and any pick; the bars need coal, and plenty of it.", d.name);
    } else if (d.role === 'dwarf_shop') {
      if (q.stage < 2) say("The great forge is cold and I do not trade by a cold forge. Speak to King Thrain, south past the guards.", d.name);
      else { say("Mithril pick, coal, hammers, bars. Dwarf prices. Don't haggle.", d.name); openPanel('shop', d.shop); }
    } else say(pick(d.lines), d.name);
  }

  // ---------- world ----------
  const carve = (api, x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) api.setTile(x, y, t); };
  HOOKS.world.push((rnd, api) => {
    carve(api, DH.x0, DH.y0, DH.x1, DH.y1, T.WALL);
    carve(api, 11, 73, 17, 77, T.CAVE);                                   // entrance hall (ladder)
    carve(api, 13, 78, 15, 87, T.CAVE);                                   // the avenue, north to south
    carve(api, 6, 80, 22, 86, T.CAVE);                                    // the great forge hall
    carve(api, 3, 73, 8, 78, T.CAVE); carve(api, 6, 79, 7, 79, T.CAVE);   // west mithril gallery + passage
    carve(api, 20, 73, 25, 78, T.CAVE); carve(api, 21, 79, 22, 79, T.CAVE); // east mithril gallery + passage
    carve(api, 8, 88, 20, 93, T.CAVE);                                    // throne hall
    carve(api, 13, 90, 15, 92, T.RUG);
    for (const [x, y] of PILLARS) api.setTile(x, y, T.WALL);
    for (const [x, y] of FORGES) api.setTile(x, y, T.FORGE);
    for (const [x, y] of ANVILS) api.setTile(x, y, T.ANVIL);
    for (const [x, y] of LAMPS) api.setTile(x, y, DW_LAMP);
    for (const [x, y] of MITHRIL_ROCKS) api.setTile(x, y, DW_MITHRIL);
    for (const [x, y] of CHESTS) api.setTile(x, y, DW_CHEST);
    api.setTile(THRONE_T.x, THRONE_T.y, DW_THRONE);
    api.setTile(LADDER_T.x, LADDER_T.y, DW_LADDER);
    // the shaft at Grey Quarry, with a clear lane up from the miners' cart so it can always be reached
    const clearable = [T.ROCK, T.IRON, T.COAL, T.GRASS, T.TREE, T.OAK, T.FLOWERS, T.MUSHROOM];
    const lane = [[53, 13], [55, 13]];
    for (let y = 8; y <= 12; y++) lane.push([54, y], [55, y]);
    for (let y = 5; y <= 7; y++) for (let x = 55; x <= 57; x++) lane.push([x, y]);
    for (const [x, y] of lane) if (clearable.includes(api.tileAt(x, y))) api.setTile(x, y, T.DIRT);
    api.setTile(SHAFT_T.x, SHAFT_T.y, DW_SHAFT);
    // nothing from the forest spawns inside the undercity; the king's guards do
    for (let i = MONSTER_SPAWNS.length - 1; i >= 0; i--) { const s = MONSTER_SPAWNS[i]; if (inDeepholm(s.tx, s.ty)) MONSTER_SPAWNS.splice(i, 1); }
    api.spawnList('dwarf_guard', [[12, 91], [16, 91]]);
  });

  // ---------- use: dwarves, shaft, ladder, mithril, chests ----------
  const dwTeleport = (tx, ty, facingY, text) => {
    player.action = null; burst(player.x, player.y, '#c9a36a', 16, 90);
    player.x = tc(tx); player.y = tc(ty); player.facing = { x: 0, y: facingY };
    burst(player.x, player.y, '#c9a36a', 16, 90); notify(text); save();
  };
  HOOKS.use.push((t, tx, ty) => {
    const d = dwInFront();
    if (d) { dwTalk(d); return true; }
    if (t === DW_SHAFT) {
      dwTeleport(LADDER_T.x, LADDER_T.y + 1, -1, 'You climb down the shaft into Deepholm.');
      const q = dq(); if (!q.visited) { q.visited = true; say("Deepholm. The dwarves went under the quarry when the goblins came. Their king still holds court, and their great forge has been cold since.", 'The Voice'); save(); }
      return true;
    }
    if (t === DW_LADDER) { dwTeleport(SHAFT_T.x, SHAFT_T.y + 1, -1, 'You climb the ladder up into Grey Quarry.'); return true; }
    if (t === DW_MITHRIL) {
      const tier = hasTool('pickaxe');
      if (!tier) { notify('Mithril. You need a pickaxe to work it.'); return true; }
      if (skillLv('mining') < 20) { notify('You need Mining level 20 for mithril.'); return true; }
      if (!canFit('mithril_ore', 1)) { notify('Your pack is full.'); return true; }
      player.action = { type: 'mine_mithril', tx, ty, t: 0, need: Math.max(1.0, 2.4 - tier * 0.4), tier };
      return true;
    }
    if (t === DW_CHEST) {
      const q = dq(); const key = tx + ',' + ty;
      if (q.chests.includes(key)) { notify('An empty dwarven chest. Iron-banded, and iron-empty.'); return true; }
      q.chests.push(key);
      for (const [id, n] of [['coins', 120], ['mithril_ore', 2], ['coal', 3]]) giveOrDrop(id, n, player.x, player.y);
      say('A dwarven chest, banded in iron. Coins, two lumps of blue ore, and coal wrapped in cloth.', 'The Voice'); burst(tc(tx), tc(ty), '#f5c542', 20, 100); save();
      return true;
    }
    if (t === DW_THRONE) { notify("King Thrain's seat. He is on it. Speak to him."); return true; }
    if (t === DW_LAMP) { notify('A dwarven lamp. It has burned for a hundred years.'); return true; }
    return false;
  });
  // the core leaves unknown action types alone, so mithril swings finish here
  HOOKS.update.push(dt => {
    const a = player.action;
    if (!a || a.type !== 'mine_mithril' || a.t < a.need) return;
    player.action = null;
    if (tileAt(a.tx, a.ty) !== DW_MITHRIL) return;
    burst(tc(a.tx), tc(a.ty), '#9fc0e8', 8, 70);
    giveOrDrop('mithril_ore', 1, player.x, player.y); gainXp('mining', 80);
    if (Math.random() < 1 / 3) { changeTile(a.tx, a.ty, T.RUBBLE); regrow.push({ i: idx(a.tx, a.ty), t: DW_MITHRIL, timer: 90 }); }
    else player.action = { ...a, t: 0 };
    save();
  });

  // ---------- drawing ----------
  function dwDrawLamp(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), gl = 0.75 + Math.sin(time * 5 + tx * 1.7) * 0.15;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 9, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#3a3a42'; g.fillRect(cx - 8, cy + 10, 16, 5); g.fillRect(cx - 2.5, cy - 20, 5, 32); g.fillRect(cx - 2.5, cy - 22, 14, 3);
    g.fillStyle = '#2a2a30'; g.fillRect(cx + 5, cy - 19, 11, 15);
    g.fillStyle = `rgba(255,190,80,${gl})`; g.fillRect(cx + 6.5, cy - 17.5, 8, 12);
    g.fillStyle = `rgba(255,240,180,${gl})`; g.fillRect(cx + 9, cy - 14, 3, 5);
    const gr = g.createRadialGradient(cx + 10, cy - 12, 4, cx + 10, cy - 12, 56); gr.addColorStop(0, 'rgba(255,190,80,0.3)'); gr.addColorStop(1, 'rgba(255,190,80,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx + 10, cy - 12, 56, 0, 7); g.fill();
  }
  function dwDrawMithril(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)];
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 12, 18, 7, 0, 0, 7); g.fill();
    const pts = [[-18, 6], [-14, -8], [-4, -14], [8, -12], [17, -3], [15, 9], [2, 13], [-10, 12]];
    g.fillStyle = ['#5a7aa8', '#4f6d96', '#6484b0'][v]; g.beginPath(); for (const [x, y] of pts) g.lineTo(cx + x, cy + y); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(cx - 10, cy - 6); g.lineTo(cx - 2, cy - 12); g.lineTo(cx + 6, cy - 10); g.lineTo(cx - 4, cy - 4); g.closePath(); g.fill();
    g.strokeStyle = '#bcd4f5'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 12, cy + 2); g.lineTo(cx - 5, cy - 3); g.lineTo(cx + 1, cy + 4); g.lineTo(cx + 8, cy - 6); g.stroke();
    g.beginPath(); g.moveTo(cx - 6, cy + 9); g.lineTo(cx + 3, cy + 8); g.lineTo(cx + 11, cy + 3); g.stroke();
    g.fillStyle = `rgba(230,240,255,${0.5 + Math.sin(time * 3 + tx + ty) * 0.4})`; for (const [ox, oy] of [[-5, -3], [8, -6], [3, 8]]) { g.beginPath(); g.arc(cx + ox, cy + oy, 1.6, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 6, cy + 2); g.lineTo(cx + 3, cy + 6); g.lineTo(cx + 9, cy + 1); g.stroke();
  }
  function dwDrawShaft(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#15161c'; g.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
    g.fillStyle = '#a5763f'; g.fillRect(x + 17, y + 10, 4, 30); g.fillRect(x + 27, y + 10, 4, 30);
    for (let k = 0; k < 4; k++) g.fillRect(x + 17, y + 13 + k * 8, 14, 3);
    g.fillStyle = '#6b4a2a'; g.fillRect(x + 4, y + 4, TILE - 8, 6); g.fillRect(x + 4, y + TILE - 10, TILE - 8, 6); g.fillRect(x + 4, y + 4, 6, TILE - 8); g.fillRect(x + TILE - 10, y + 4, 6, TILE - 8);
    g.fillStyle = '#8a5a2b'; g.fillRect(x + 4, y + 4, TILE - 8, 2); g.fillRect(x + 4, y + 4, 2, TILE - 8);
    g.fillStyle = '#3a3a42'; for (const [ox, oy] of [[7, 7], [TILE - 7, 7], [7, TILE - 7], [TILE - 7, TILE - 7]]) { g.beginPath(); g.arc(x + ox, y + oy, 1.8, 0, 7); g.fill(); }
  }
  function dwDrawLadder(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    const gr = g.createRadialGradient(cx, cy - 10, 4, cx, cy - 10, 60); gr.addColorStop(0, 'rgba(255,245,210,0.35)'); gr.addColorStop(1, 'rgba(255,245,210,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy - 10, 60, 0, 7); g.fill();
    g.fillStyle = '#2a2a30'; g.fillRect(cx - 14, cy - 24, 28, 8);
    g.fillStyle = '#a5763f'; g.fillRect(cx - 8, cy - 22, 4, 44); g.fillRect(cx + 4, cy - 22, 4, 44);
    for (let k = 0; k < 6; k++) g.fillRect(cx - 8, cy - 19 + k * 7, 16, 3);
    g.fillStyle = '#6b4a2a'; g.fillRect(cx - 8, cy - 22, 4, 2); g.fillRect(cx + 4, cy - 22, 4, 2);
  }
  function dwDrawThrone(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, cx = tc(tx);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, y + TILE - 4, 18, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#5a5d64'; g.fillRect(x + 8, y + 2, TILE - 16, TILE - 6);
    g.fillStyle = '#6e7178'; g.fillRect(x + 11, y + 5, TILE - 22, TILE - 12);
    g.fillStyle = '#f5c542'; g.fillRect(x + 8, y + 2, TILE - 16, 4); g.fillRect(x + 8, y + 2, 3, TILE - 6); g.fillRect(x + TILE - 11, y + 2, 3, TILE - 6);
    g.fillStyle = '#8a8d95'; g.fillRect(x + 14, y + 24, TILE - 28, 14);
    g.fillStyle = MITHRIL; g.beginPath(); g.arc(cx, y + 12, 3.5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(cx - 1, y + 11, 1.2, 0, 7); g.fill();
  }
  function dwDrawChest(g, tx, ty, opened) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 8, y + 36, 32, 6);
    g.fillStyle = '#5a3a1e'; g.fillRect(x + 8, y + 12, 32, 26); g.fillStyle = opened ? '#2a2a30' : '#4a2e13'; g.fillRect(x + 8, y + 10, 32, 10);
    g.fillStyle = '#8f96a3'; g.fillRect(x + 12, y + 10, 4, 28); g.fillRect(x + 32, y + 10, 4, 28); g.fillRect(x + 8, y + 19, 32, 3);
    g.fillStyle = opened ? '#6e7178' : '#f5c542'; g.fillRect(x + 21, y + 17, 6, 7);
    g.strokeStyle = '#2a2a30'; g.lineWidth = 1; g.strokeRect(x + 8, y + 10, 32, 28);
  }
  function dwDrawDwarf(g, d) {
    const e = { x: d.px, y: d.py, r: 11, facing: d.facing, hurtT: 0, attackT: 0, moving: false, walkT: 0 };
    const near = dist(player.x, player.y, e.x, e.y) < 110;
    if (near) e.facing = { x: Math.sign(player.x - e.x) || 0, y: Math.sign(player.y - e.y) || 1 };
    g.save(); g.translate(e.x, e.y);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 10, 11, 5, 0, 0, 7); g.fill();
    g.scale(0.85, 0.85); g.translate(0, 2);
    drawHuman(g, e, { tunic: d.tunic, hair: d.hair, apron: d.apron, helm: d.helm || null, crown: d.crown, woman: d.woman, beard: !d.woman, shoulder: d.shoulder || '#6a5a4a' });
    if (!d.woman) dwBigBeard(g, d.hair);
    g.restore();
    if (near) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(d.name, e.x, e.y - 24); g.fillStyle = '#ffe9a8'; g.fillText(d.name, e.x, e.y - 24); }
  }
  // darkness: an offscreen layer, holes cut with destination-out (the core's cave technique).
  // Drawn as the last world item rather than in HOOKS.hud so the HUD (HP, minimap, hotbar) stays readable underground.
  const dwDark = document.createElement('canvas');
  function dwDrawDark(g) {
    const inside = player.region === 'Deepholm';
    const rx = DH.x0 * TILE - cam.x, ry = DH.y0 * TILE - cam.y, rw = (DH.x1 - DH.x0 + 1) * TILE, rh = (DH.y1 - DH.y0 + 1) * TILE;
    if (!inside && (rx > VW || ry > VH || rx + rw < 0 || ry + rh < 0)) return;
    if (dwDark.width !== canvas.width || dwDark.height !== canvas.height) { dwDark.width = canvas.width; dwDark.height = canvas.height; }
    const dg = dwDark.getContext('2d');
    dg.setTransform(DPR, 0, 0, DPR, 0, 0); dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, VW, VH);
    dg.fillStyle = 'rgba(4,6,14,0.55)';
    if (inside) dg.fillRect(0, 0, VW, VH); else dg.fillRect(rx, ry, rw, rh);
    dg.globalCompositeOperation = 'destination-out';
    const lights = [];
    if (inside) lights.push({ x: player.x, y: player.y, r: 150 });
    for (const [lx, ly] of LAMPS) lights.push({ x: tc(lx) + 10, y: tc(ly) - 12, r: 130 });
    for (const [fx, fy] of FORGES) lights.push({ x: tc(fx), y: tc(fy), r: 100 });
    lights.push({ x: tc(LADDER_T.x), y: tc(LADDER_T.y), r: 110 });
    for (const L of lights) {
      const sx = L.x - cam.x, sy = L.y - cam.y; if (sx < -L.r || sy < -L.r || sx > VW + L.r || sy > VH + L.r) continue;
      const gr = dg.createRadialGradient(sx, sy, 10, sx, sy, L.r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = gr; dg.beginPath(); dg.arc(sx, sy, L.r, 0, 7); dg.fill();
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(dwDark, 0, 0); g.restore();
  }
  const DW_USABLE = [DW_SHAFT, DW_LADDER, DW_MITHRIL, DW_CHEST, DW_THRONE];
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE));
    for (let ty = y0; ty <= y1 + 2; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === DW_LAMP) items.push({ y: ty * TILE + TILE - 6, draw: () => dwDrawLamp(g, tx, ty) });
      else if (t === DW_MITHRIL) items.push({ y: ty * TILE + TILE - 4, draw: () => dwDrawMithril(g, tx, ty) });
      else if (t === DW_SHAFT) items.push({ y: ty * TILE - 1, draw: () => dwDrawShaft(g, tx, ty) });
      else if (t === DW_LADDER) items.push({ y: ty * TILE + TILE - 6, draw: () => dwDrawLadder(g, tx, ty) });
      else if (t === DW_THRONE) items.push({ y: ty * TILE + TILE - 6, draw: () => dwDrawThrone(g, tx, ty) });
      else if (t === DW_CHEST) items.push({ y: ty * TILE + TILE - 6, draw: () => dwDrawChest(g, tx, ty, dq().chests.includes(tx + ',' + ty)) });
    }
    for (const d of DWARVES) if (d.px > cam.x - 60 && d.px < cam.x + VW + 60 && d.py > cam.y - 60 && d.py < cam.y + VH + 60) items.push({ y: d.py + 13 + (d.sortY || 0), draw: () => dwDrawDwarf(g, d) });
    // the pickaxe in hand while mining mithril (the core only animates its own 'mine' action)
    const a = player.action;
    if (a && a.type === 'mine_mithril' && !player.dead) items.push({ y: player.y + player.r + 0.01, draw: () => {
      const ang = Math.atan2(player.facing.y, player.facing.x), sw = Math.sin(time * 14) * 0.6;
      g.save(); g.translate(player.x, player.y); g.rotate(ang - 0.7 + sw); g.fillStyle = '#8a6a3a'; g.fillRect(2, -1.5, 26, 3);
      g.fillStyle = a.tier >= 3 ? MITHRIL : a.tier === 2 ? '#a9adb5' : '#b8863a'; g.beginPath(); g.moveTo(24, -2); g.quadraticCurveTo(30, -8, 34, -6); g.lineTo(30, 0); g.lineTo(34, 6); g.quadraticCurveTo(30, 8, 24, 2); g.closePath(); g.fill(); g.restore();
    } });
    items.push({ y: 1e9, draw: () => dwDrawDark(g) });
    // interaction highlight for our own tiles and dwarves (the core only highlights what it knows)
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 1, draw: () => {
      const d = dwInFront();
      if (d) { g.strokeStyle = 'rgba(255,233,168,0.7)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(d.px, d.py, 18, 0, 7); g.stroke(); g.setLineDash([]); return; }
      const { tx, ty } = frontTile(player);
      if (DW_USABLE.includes(tileAt(tx, ty))) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    h.peace(true);
    check('dwarves: Deepholm region in the south-west', REGIONS[0].name === 'Deepholm' && regionAt(14, 80).name === 'Deepholm' && regionAt(12, 70).name === 'Wolfwood', { first: REGIONS[0].name, at1480: regionAt(14, 80).name });
    // shaft down, ladder up
    { F.tp(54, 14); const w = F.goAdjacent(SHAFT_T.x, SHAFT_T.y, 1500); F.face(SHAFT_T.x, SHAFT_T.y); F.press('KeyE'); F.sim(3, []);
      check('dwarves: mine shaft at Grey Quarry drops you into Deepholm', typeof w === 'number' && player.region === 'Deepholm' && tileAt(SHAFT_T.x, SHAFT_T.y) === DW_SHAFT && Math.floor(player.x / TILE) === LADDER_T.x && Math.floor(player.y / TILE) === LADDER_T.y + 1, { w, region: player.region, tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) });
      F.face(LADDER_T.x, LADDER_T.y); F.press('KeyE'); F.sim(3, []);
      check('dwarves: ladder climbs back up beside the shaft', player.region === 'Grey Quarry' && Math.floor(player.x / TILE) === SHAFT_T.x && Math.floor(player.y / TILE) === SHAFT_T.y + 1, { region: player.region, tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) }); }
    // mithril rocks + mining gates
    { let rocks = 0; for (let y = DH.y0; y <= DH.y1; y++) for (let x = DH.x0; x <= DH.x1; x++) if (tileAt(x, y) === DW_MITHRIL) rocks++; check('dwarves: mithril rocks in the galleries', rocks >= 10, { rocks }); }
    { F.tp(LADDER_T.x, LADDER_T.y + 1); const r = F.nearestTile([DW_MITHRIL]); const w = F.goAdjacent(r.x, r.y, 2500); F.face(r.x, r.y);
      const stash = []; for (let i = 0; i < INV_SLOTS; i++) { const s = player.inv[i]; if (s && ITEMS[s.id].tool === 'pickaxe') { stash.push([i, s]); player.inv[i] = null; } } const eqw = player.equip.weapon; if (eqw && ITEMS[eqw].tool === 'pickaxe') player.equip.weapon = null;
      F.press('KeyE'); F.sim(2, []); const noPick = !player.action && notice && /pickaxe/.test(notice.text);
      for (const [i, s] of stash) player.inv[i] = s; if (eqw && ITEMS[eqw].tool === 'pickaxe') player.equip.weapon = eqw; if (!hasTool('pickaxe')) h.give('bronze_pickaxe', 1);
      player.skills.mining.xp = XP_TABLE[19]; F.face(r.x, r.y); F.press('KeyE'); F.sim(2, []); const lowLv = !player.action && notice && /Mining level 20/.test(notice.text);
      check('dwarves: mithril needs a pickaxe, then Mining 20', typeof w === 'number' && noPick && lowLv, { w, noPick, lowLv, notice: notice && notice.text });
      player.skills.mining.xp = XP_TABLE[20]; const ore0 = countItem('mithril_ore'), mx0 = player.skills.mining.xp; F.face(r.x, r.y); F.press('KeyE'); const started = player.action && player.action.type === 'mine_mithril';
      const steps = F.untilAction(600, () => countItem('mithril_ore') > ore0); player.action = null;
      const left = tileAt(r.x, r.y) === DW_MITHRIL || (tileAt(r.x, r.y) === T.RUBBLE && regrow.some(e => e.i === idx(r.x, r.y) && e.t === DW_MITHRIL && e.timer > 0));
      check('dwarves: mine mithril with a pickaxe at Mining 20 (ore, 80 xp, rock settles to rubble and regrows)', started && typeof steps === 'number' && countItem('mithril_ore') === ore0 + 1 && player.skills.mining.xp === mx0 + 80 && left, { started, steps, ore: countItem('mithril_ore'), tile: tileAt(r.x, r.y) }); }
    // smelt at a Deepholm forge
    { if (countItem('mithril_ore') < 1) h.give('mithril_ore', 1); h.give('coal', 2); if (player.skills.smithing.xp < XP_TABLE[20]) player.skills.smithing.xp = XP_TABLE[20];
      const ore0 = countItem('mithril_ore'), coal0 = countItem('coal'), bar0 = countItem('mithril_bar'), sx0 = player.skills.smithing.xp;
      const [fx, fy] = FORGES[0]; const w = F.goAdjacent(fx, fy, 2500); F.face(fx, fy); F.press('KeyE'); const open = panel === 'station' && panelArg === 'forge';
      const c = F.clickButton('Mithril ore + 2 Coal → Mithril bar'); const steps = F.untilAction(300, () => countItem('mithril_bar') > bar0); closePanel();
      check('dwarves: Deepholm forge smelts mithril ore + 2 coal into a mithril bar (Smithing 20)', typeof w === 'number' && open && c && typeof steps === 'number' && countItem('mithril_bar') === bar0 + 1 && countItem('mithril_ore') === ore0 - 1 && countItem('coal') === coal0 - 2 && player.skills.smithing.xp === sx0 + 30, { w, open, c, steps, bars: countItem('mithril_bar') }); }
    // anvil: mithril sword
    { while (countItem('mithril_bar') < 2) h.give('mithril_bar', 1); if (!hasTool('hammer')) h.give('hammer', 1); if (player.skills.smithing.xp < XP_TABLE[22]) player.skills.smithing.xp = XP_TABLE[22];
      const bar0 = countItem('mithril_bar'), sw0 = countItem('mithril_sword'), sx0 = player.skills.smithing.xp;
      const [ax, ay] = ANVILS[0]; const w = F.goAdjacent(ax, ay, 2500); F.face(ax, ay); F.press('KeyE'); const open = panel === 'station' && panelArg === 'anvil';
      let viaButton = F.clickButton('2 mithril bars → Mithril sword'); if (!viaButton) craft(RECIPES.find(r => r.out === 'mithril_sword')); // the anvil list can be cut short on small screens
      const steps = F.untilAction(300, () => countItem('mithril_sword') > sw0); closePanel();
      check('dwarves: anvil + hammer smiths a mithril sword from 2 bars (Smithing 22)', typeof w === 'number' && open && typeof steps === 'number' && countItem('mithril_sword') === sw0 + 1 && countItem('mithril_bar') === bar0 - 2 && player.skills.smithing.xp === sx0 + 100 && ITEMS.mithril_sword.weapon.str === 24, { w, open, viaButton, steps, swords: countItem('mithril_sword') }); }
    // the king's quest and Brunhild's shop
    { const drain = () => { dialog.queue.length = 0; dialog.cur = null; }; // earlier lines (the Voice on the way down) would otherwise sit in front
      dq().stage = 0; drain(); F.tp(THRONE_T.x, THRONE_T.y - 1); F.face(THRONE_T.x, THRONE_T.y); F.press('KeyE'); F.sim(3, []);
      const asked = dq().stage === 1 && dialog.cur && dialog.cur.who === 'King Thrain' && activeQuests().includes('dwarf') && /coal/.test(questText('dwarf'));
      drain(); F.tp(13, 81); F.face(12, 81); closePanel(); F.press('KeyE'); F.sim(3, []); const refused = panel !== 'shop' && dialog.cur && /cold/.test(dialog.cur.text);
      check('dwarves: King Thrain asks for 5 coal + 3 iron bars; Brunhild refuses to trade before', asked, { stage: dq().stage, who: dialog.cur && dialog.cur.who, refused });
      check('dwarves: Brunhild will not trade by a cold forge', refused, { panel, refused });
      while (countItem('coal') < 5) h.give('coal', 1); while (countItem('iron_bar') < 3) h.give('iron_bar', 1); const coal0 = countItem('coal'), bars0 = countItem('iron_bar'), c0 = coins(), sx0 = player.skills.smithing.xp;
      F.tp(THRONE_T.x, THRONE_T.y - 1); F.face(THRONE_T.x, THRONE_T.y); F.press('KeyE'); F.sim(3, []);
      check('dwarves: the king takes the coal and iron, pays 300 coins and 200 Smithing xp', dq().stage === 2 && coins() === c0 + 300 && player.skills.smithing.xp === sx0 + 200 && countItem('coal') === coal0 - 5 && countItem('iron_bar') === bars0 - 3 && !activeQuests().includes('dwarf'), { stage: dq().stage, coins: coins() - c0, xp: player.skills.smithing.xp - sx0 });
      F.tp(13, 81); F.face(12, 81); F.press('KeyE'); F.sim(2, []); const open = panel === 'shop' && panelArg === 'dwarf'; const coalB = countItem('coal'); const bought = F.clickButton('Buy 25'); closePanel();
      check("dwarves: Brunhild's shop opens after the quest and sells coal (and a mithril pickaxe at 900)", open && bought && countItem('coal') === coalB + 1 && SHOPS.dwarf.stock.some(([id, p]) => id === 'mithril_pickaxe' && p === 900), { open, bought, coal: countItem('coal') }); }
    { const g = monsters.filter(m => m.type === 'dwarf_guard'); check('dwarves: two neutral dwarf guards hold the throne hall', g.length === 2 && g.every(m => !m.angry && inDeepholm(Math.floor(m.home.x / TILE), Math.floor(m.home.y / TILE))), { guards: g.length }); }
    h.peace(false);
  });
}
