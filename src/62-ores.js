// ============================================================================
// THE THREE MIDDLE METALS — blackiron, sunstone and stormstone
// Owner's ask: "there seems to be a steep cliff after steel in terms of mining and smithing. There is kind of
// steel, and there is a bit of a jump to mithril, and then dragon is way up there. There need to be more steps
// in between. There need to be more mining spots."
// src/42-playthrough.js measures that cliff. Before this file window.PLAYTHROUGH.progression() said:
//   mining   {"gap":10,"at":20,"lastNew":10}  — coal at 10, then nothing new to mine until mithril at 20
//   smithing {"gap":12,"at":42,"lastNew":30}  — the mithril platebody at 30, then nothing until obsidian at 42
// Three new rocks fill both holes. Each has its own rock on the map, its own Mining level, its own bar at a
// forge, and its own armour and blade at an anvil, every piece a step above the metal under it and a step
// below the metal over it:
//   BLACKIRON  Mining 13 · bar Smithing 15 · gear 19–21   between steel   and mithril
//   SUNSTONE   Mining 17 · bar Smithing 24 · gear 31–35   between mithril and Godly Plated
//   STORMSTONE Mining 24 · bar Smithing 33 · gear 37–41   between sunstone and the obsidian blade
// Territory: blackiron in Grey Quarry and the hills north of Thistledown, sunstone through Wolfwood,
// stormstone on the Far Shore south of Castle Gnash. A new rock is only ever laid on open grass with all
// eight neighbours walkable (so it can never cut a path in two) or over a plain grey rock in the quarry,
// which was already solid — nothing the world blend joined up is broken.
// Feature file: registers through HOOKS only, edits no core file. window.ORES exposes the tables.
// ============================================================================
{
  // ---------- tiles (ids captured locally so a later addTile of the same name cannot move them) ----------
  const OR_BLACKIRON = addTile('BLACKIRON', { solid: true, tex: 'grass', mini: '#3c3f47' });
  const OR_SUNSTONE = addTile('SUNSTONE', { solid: true, tex: 'grass', mini: '#c8802a' });
  const OR_STORMSTONE = addTile('STORMSTONE', { solid: true, tex: 'grass', mini: '#6a5aa8' });

  // ---------- the three tiers ----------
  // rock: the three stone tones the map variant picks between. vein: the flecks of metal in the face.
  const TIERS = [
    {
      key: 'blackiron', tile: OR_BLACKIRON, metal: 'Blackiron', label: 'blackiron rock',
      ore: 'blackiron_ore', bar: 'blackiron_bar', mineLv: 13, mineXp: 60, regrow: 55,
      barLv: 15, barXp: 26, coal: 1, oreColor: '#3c3f47', barColor: '#5b606b',
      rock: ['#4a4d55', '#42454d', '#53565e'], vein: '#20222a', anchor: [21, 7],
      voice: 'Blackiron. Heavier than it looks, and it takes an edge steel cannot hold. Coal and a forge will make a bar of it.',
    },
    {
      key: 'sunstone', tile: OR_SUNSTONE, metal: 'Sunstone', label: 'sunstone rock',
      ore: 'sunstone_ore', bar: 'sunstone_bar', mineLv: 17, mineXp: 70, regrow: 75,
      barLv: 24, barXp: 48, coal: 2, oreColor: '#c8802a', barColor: '#e8a640',
      rock: ['#8a6a3e', '#7f6038', '#957446'], vein: '#e8a640', glow: 'rgba(255,180,70,', anchor: [21, 7],
      voice: 'Sunstone. It holds the warm of the day in it. Two coals to a lump, and the forge has to be hotter than you can make it yet.',
    },
    {
      key: 'stormstone', tile: OR_STORMSTONE, metal: 'Stormstone', label: 'stormstone rock',
      ore: 'stormstone_ore', bar: 'stormstone_bar', mineLv: 24, mineXp: 95, regrow: 100,
      barLv: 33, barXp: 78, coal: 3, oreColor: '#6a5aa8', barColor: '#9a86e0',
      rock: ['#4e4670', '#463f66', '#584f7c'], vein: '#9a86e0', glow: 'rgba(150,130,240,', anchor: [206, 30],
      voice: 'Stormstone. It ticks under the pick like a sky about to break. Three coals to a lump, and a smith of thirty-three to hold it.',
    },
  ];
  const BY_TILE = {}; for (const t of TIERS) BY_TILE[t.tile] = t;
  const BY_KEY = {}; for (const t of TIERS) BY_KEY[t.key] = t;
  for (const t of TIERS) INTERESTING_TILES.add(t.tile); // the core E ring, frontTile's reach, and a tap on the iPad

  // ---------- items ----------
  // Every number below sits between the metal under it and the metal over it:
  //   helm   steel 9  → blackiron 11 → mithril 14 → sunstone 18 → stormstone 22 → obsidian 26 → godly 30
  //   body   steel 20 → blackiron 24 → mithril 30 → sunstone 38 → stormstone 46 → godly 55
  //   legs   steel 14 → blackiron 17 → mithril 20 → sunstone 26 → stormstone 32 → godly 38
  //   shield scale 16 → sunstone 19 → stormstone 23 → godly 28   (mithril's shield is 12, the same as steel's:
  //                                                               blackiron gets a dagger instead of a shield)
  //   sword  steel 16/14 → blackiron 19/16 → mithril 24/20 → sunstone 30/26 → stormstone 34/30
  const BI = '#5b606b', SU = '#e8a640', ST = '#9a86e0';
  Object.assign(ITEMS, {
    blackiron_ore: { name: 'Blackiron ore', value: 26, color: '#3c3f47', shape: 'rock' },
    blackiron_bar: { name: 'Blackiron bar', value: 92, color: BI, shape: 'bar' },
    blackiron_dagger: { name: 'Blackiron dagger', value: 260, color: BI, shape: 'dagger', stack: 1, weapon: { str: 12, att: 17, cd: 0.3, perk: 'swift' } },
    blackiron_helm: { name: 'Blackiron helm', value: 400, color: BI, shape: 'helm', stack: 1, armour: { slot: 'helm', def: 11 } },
    blackiron_legs: { name: 'Blackiron platelegs', value: 660, color: BI, shape: 'legs', stack: 1, armour: { slot: 'legs', def: 17 } },
    blackiron_sword: { name: 'Blackiron sword', value: 520, color: BI, shape: 'sword', stack: 1, weapon: { str: 19, att: 16, cd: 0.45 } },
    blackiron_body: { name: 'Blackiron platebody', value: 950, color: BI, shape: 'body', stack: 1, armour: { slot: 'body', def: 24 } },
    sunstone_ore: { name: 'Sunstone ore', value: 55, color: '#c8802a', shape: 'rock' },
    sunstone_bar: { name: 'Sunstone bar', value: 190, color: SU, shape: 'bar' },
    sunstone_helm: { name: 'Sunstone helm', value: 1300, color: SU, shape: 'helm', stack: 1, armour: { slot: 'helm', def: 18 } },
    sunstone_shield: { name: 'Sunstone shield', value: 1500, color: SU, shape: 'shield', stack: 1, armour: { slot: 'shield', def: 19 } },
    sunstone_legs: { name: 'Sunstone platelegs', value: 1900, color: SU, shape: 'legs', stack: 1, armour: { slot: 'legs', def: 26 } },
    sunstone_sword: { name: 'Sunstone sword', value: 1600, color: SU, shape: 'sword', stack: 1, weapon: { str: 30, att: 26, cd: 0.45 } },
    sunstone_body: { name: 'Sunstone platebody', value: 2700, color: SU, shape: 'body', stack: 1, armour: { slot: 'body', def: 38 } },
    stormstone_ore: { name: 'Stormstone ore', value: 85, color: '#6a5aa8', shape: 'rock' },
    stormstone_bar: { name: 'Stormstone bar', value: 300, color: ST, shape: 'bar' },
    stormstone_helm: { name: 'Stormstone helm', value: 2100, color: ST, shape: 'helm', stack: 1, armour: { slot: 'helm', def: 22 } },
    stormstone_shield: { name: 'Stormstone shield', value: 2300, color: ST, shape: 'shield', stack: 1, armour: { slot: 'shield', def: 23 } },
    stormstone_legs: { name: 'Stormstone platelegs', value: 2900, color: ST, shape: 'legs', stack: 1, armour: { slot: 'legs', def: 32 } },
    stormstone_sword: { name: 'Stormstone sword', value: 2600, color: ST, shape: 'sword', stack: 1, weapon: { str: 34, att: 30, cd: 0.45 } },
    stormstone_body: { name: 'Stormstone platebody', value: 4100, color: ST, shape: 'body', stack: 1, armour: { slot: 'body', def: 46 } },
  });
  const OUR_ITEMS = ['blackiron_ore', 'blackiron_bar', 'blackiron_dagger', 'blackiron_helm', 'blackiron_legs', 'blackiron_sword', 'blackiron_body',
    'sunstone_ore', 'sunstone_bar', 'sunstone_helm', 'sunstone_shield', 'sunstone_legs', 'sunstone_sword', 'sunstone_body',
    'stormstone_ore', 'stormstone_bar', 'stormstone_helm', 'stormstone_shield', 'stormstone_legs', 'stormstone_sword', 'stormstone_body'];
  for (const id of OUR_ITEMS) { ITEMS[id].id = id; if (!ITEMS[id].stack) ITEMS[id].stack = 50; }

  // ---------- mining: the core's own GATHER table, so the pickaxe gate, the swing timer, the level notice,
  // the rubble it leaves and the regrow are all the ones the knight already knows ----------
  for (const t of TIERS) {
    GATHER[t.tile] = { skill: 'mining', tool: 'pickaxe', lv: t.mineLv, xp: t.mineXp, item: t.ore, fall: 1, leaves: T.RUBBLE, regrow: t.regrow, label: t.label };
  }

  // ---------- smelting and smithing ----------
  for (const t of TIERS) {
    SMELT.push({ out: t.bar, needs: [[t.ore, 1], ['coal', t.coal]], lv: t.barLv, xp: t.barXp,
      label: `${ITEMS[t.ore].name} + ${t.coal > 1 ? t.coal + ' ' : ''}Coal → ${ITEMS[t.bar].name}` });
  }
  const ANVIL = [
    // blackiron: 19–21, between the steel platebody (18) and the mithril sword (22)
    ['blackiron_dagger', 1, 19, 55], ['blackiron_helm', 1, 19, 55], ['blackiron_legs', 2, 20, 110],
    ['blackiron_sword', 2, 21, 110], ['blackiron_body', 3, 21, 165],
    // sunstone: 31–35, between the mithril platebody (30) and the Godly helm (32)
    ['sunstone_helm', 1, 31, 190], ['sunstone_shield', 2, 32, 380], ['sunstone_legs', 2, 33, 380],
    ['sunstone_sword', 2, 34, 380], ['sunstone_body', 3, 35, 570],
    // stormstone: 37–41, between the Godly platelegs (36) and the obsidian helm (42)
    ['stormstone_helm', 1, 37, 320], ['stormstone_shield', 2, 38, 640], ['stormstone_legs', 2, 39, 640],
    ['stormstone_sword', 2, 40, 640], ['stormstone_body', 3, 41, 960],
  ];
  for (const [out, bars, lv, xp] of ANVIL) {
    const tier = BY_KEY[out.split('_')[0]];
    RECIPES.push({ out, qty: 1, needs: [[tier.bar, bars]], station: 'anvil', skill: 'smithing', lv, xp,
      label: `${bars} ${tier.key} bar${bars > 1 ? 's' : ''} → ${ITEMS[out].name}` });
  }

  // ---------- state: which metals the knight has cut for himself ----------
  const os = () => { if (!quest.ores || typeof quest.ores !== 'object') quest.ores = { seen: [] }; if (!Array.isArray(quest.ores.seen)) quest.ores.seen = []; return quest.ores; };
  HOOKS.newGame.push(() => { quest.ores = { seen: [] }; });

  // the first lump of each metal: the Voice says what it is and what it wants. The core pays the xp, so a
  // gain in Mining xp on one of our tiles is the proof the swing actually landed (a full pack drops the ore).
  const _finishGather = finishGather;
  finishGather = function () {
    const a = player.action, tier = a ? BY_TILE[tileAt(a.tx, a.ty)] : null;
    const x0 = player.skills.mining.xp;
    _finishGather();
    if (!tier || player.skills.mining.xp === x0) return;
    const st = os();
    if (st.seen.includes(tier.key)) return;
    st.seen.push(tier.key); say(tier.voice, 'The Voice'); save();
  };

  // ---------- where the rocks are ----------
  // Grey Quarry:            blackiron cut into the grey rock the miners already work
  // north of Thistledown:   blackiron in the open hills above the town wall
  // Wolfwood:               sunstone in the clearings between the oaks
  // The Far Shore:          stormstone on the scrub south of Castle Gnash
  const SEAM = {
    quarry: { x0: 46, y0: 5, x1: 61, y1: 13, want: 12 },        // grey rock recut as blackiron (solid → solid: no path changes)
    quarryFloor: { x0: 46, y0: 5, x1: 61, y1: 13, want: 6 },    // fresh faces opened on the quarry floor itself
    hills: { x0: 86, y0: 3, x1: 139, y1: 12, want: 10 },
    wolfwood: { x0: 34, y0: 63, x1: 117, y1: 92, want: 16 },
    farshore: { x0: 212, y0: 78, x1: 252, y1: 94, want: 12 },
  };
  const SPOTS = { blackiron: [], sunstone: [], stormstone: [] };

  HOOKS.world.push((rnd, api) => {
    for (const k in SPOTS) SPOTS[k].length = 0;
    const orn = mulberry32(62062026); // our own stream: the world rnd stays where the other files left it
    const laid = [];
    const apart = (x, y, d) => laid.every(([lx, ly]) => Math.max(Math.abs(lx - x), Math.abs(ly - y)) >= d);
    const nearSpawn = (x, y) => MONSTER_SPAWNS.some(s => Math.max(Math.abs(s.tx - x), Math.abs(s.ty - y)) <= 2);
    const nearNpc = (x, y) => NPCS.some(n => Math.max(Math.abs(n.x - x), Math.abs(n.y - y)) <= 3);
    const nearBuilding = (x, y) => BUILDINGS.some(b => x >= b.x - 5 && x < b.x + b.w + 5 && y >= b.y - 5 && y < b.y + b.h + 5);
    // every one of the eight neighbours walkable: a lone solid tile in open ground can never separate two
    // places, because the ring around it is itself a walkable loop
    const ringOpen = (x, y) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const t = api.tileAt(x + dx, y + dy);
        if (SOLID.has(t) || PUSH_THROUGH.has(t)) return false;
      }
      return true;
    };
    const shuffled = list => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(orn() * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; } return list; };
    const lay = (rect, sep, ok, tile, key) => {
      const cands = [];
      for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) if (ok(x, y)) cands.push([x, y]);
      let n = 0;
      for (const [x, y] of shuffled(cands)) {
        if (n >= rect.want) break;
        if (!apart(x, y, sep)) continue;
        api.setTile(x, y, tile); laid.push([x, y]); SPOTS[key].push([x, y]); n++;
      }
      return n;
    };
    // Grey Quarry: a grey rock becomes a blackiron rock. Clear of the shaft lane (x 53–58), the miners' cart
    // and the wind shrine, and never on a spawn's doorstep.
    const clearOfShaft = (x, y) => !(x >= 53 && x <= 58 && y <= 14); // the mine shaft, the lane up from the miners' cart, and the cart itself
    lay(SEAM.quarry, 1, (x, y) => api.tileAt(x, y) === T.ROCK && clearOfShaft(x, y) && !nearSpawn(x, y), OR_BLACKIRON, 'blackiron');
    const open = (x, y) => ringOpen(x, y) && !nearSpawn(x, y) && !nearNpc(x, y) && !nearBuilding(x, y) && !inVillageBounds(tc(x), tc(y));
    const fresh = (x, y) => api.tileAt(x, y) === T.GRASS && open(x, y);
    // the quarry floor is worked dirt, not grass: a fresh face is cut straight into it
    lay(SEAM.quarryFloor, 2, (x, y) => (api.tileAt(x, y) === T.DIRT || api.tileAt(x, y) === T.GRASS) && clearOfShaft(x, y) && open(x, y), OR_BLACKIRON, 'blackiron');
    lay(SEAM.hills, 3, (x, y) => fresh(x, y) && regionAt(x, y).name !== 'Thistledown', OR_BLACKIRON, 'blackiron');
    lay(SEAM.wolfwood, 4, (x, y) => fresh(x, y) && regionAt(x, y).name === 'Wolfwood', OR_SUNSTONE, 'sunstone');
    lay(SEAM.farshore, 3, (x, y) => fresh(x, y) && regionAt(x, y).name === 'The Far Shore', OR_STORMSTONE, 'stormstone');
  });

  // ---------- drawing ----------
  function orDrawRock(g, tx, ty, tier) {
    const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)] % 3;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 12, 18, 7, 0, 0, 7); g.fill();
    const pts = [[-18, 6], [-14, -8], [-4, -14], [8, -12], [17, -3], [15, 9], [2, 13], [-10, 12]];
    g.fillStyle = tier.rock[v]; g.beginPath(); for (const [x, y] of pts) g.lineTo(cx + x, cy + y); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.moveTo(cx - 10, cy - 6); g.lineTo(cx - 2, cy - 12); g.lineTo(cx + 6, cy - 10); g.lineTo(cx - 4, cy - 4); g.closePath(); g.fill();
    if (tier.glow) { // sunstone holds the light, stormstone flickers with it: a soft halo under the flecks
      const a = 0.16 + Math.sin(time * 2 + tx * 1.3 + ty * 0.7) * 0.07;
      const gr = g.createRadialGradient(cx, cy, 3, cx, cy, 26); gr.addColorStop(0, tier.glow + a.toFixed(3) + ')'); gr.addColorStop(1, tier.glow + '0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.fill();
    }
    g.fillStyle = tier.vein;
    for (const [ox, oy, r] of [[-8, 2, 2.4], [4, -4, 2.2], [8, 6, 2.0], [-2, 8, 1.8], [1, -9, 1.6]]) { g.beginPath(); g.arc(cx + ox, cy + oy, r, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 6, cy + 2); g.lineTo(cx + 3, cy + 6); g.lineTo(cx + 9, cy + 1); g.stroke();
  }
  // 09-render calls every draw hook as h(g, items, cam) and later runs each pushed draw() with NO arguments
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE));
    for (let ty = y0; ty <= y1 + 2; ty++) for (let tx = x0; tx <= x1; tx++) {
      const tier = BY_TILE[tileAt(tx, ty)];
      if (tier) items.push({ y: ty * TILE + TILE - 4, draw: () => orDrawRock(g, tx, ty, tier) });
    }
  });

  // ---------- tell the progression audit what these rocks are worth (42-playthrough reads HOOKS.xpSource) ----------
  // Same arithmetic the audit uses for the core rocks: a bronze pickaxe at the level the rock opens is
  // max(0.9, 2.2 - 0.4) / min(0.9, 0.35 + 0 + 0.1) = 1.8 / 0.45 = 4.0 seconds a swing.
  const SWING_SECS = 4.0;
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    for (const t of TIERS) add('mining', t.label, t.mineLv, t.mineXp, SWING_SECS, `${t.key} in ${t.key === 'blackiron' ? 'Grey Quarry and the hills north of Thistledown' : t.key === 'sunstone' ? 'Wolfwood' : 'the Far Shore'}; bronze pickaxe, at the level it opens`);
  });

  // ---------- the book ----------
  if (window.WIKI) WIKI.add('skills', { id: 'metals', name: 'The metals, in order', lines: [
    'Every metal in the Fanglands, weakest first. The first number is the Mining level the rock needs, the second the Smithing level its bar needs at a forge.',
    '',
    'IRON. Mining 5, Smithing 1. Grey rock with orange flecks, everywhere.',
    'STEEL. Iron ore and a coal, Smithing 10. No rock of its own.',
    'BLACKIRON. Mining 13, Smithing 15. Grey Quarry and the hills north of Thistledown. One coal to a bar. Gear at the anvil from 19.',
    'MITHRIL. Mining 20, Smithing 20. The dwarf galleries in Deepholm. Two coals to a bar. Gear from 22.',
    'SUNSTONE. Mining 17, Smithing 24. Clearings in Wolfwood. Two coals to a bar. Gear from 31 — better than mithril at every slot.',
    'STORMSTONE. Mining 24, Smithing 33. The scrub on the Far Shore, south of Castle Gnash. Three coals to a bar. Gear from 37 — the best armour a knight can dig up.',
    'OBSIDIAN. Mining 28. The Ashfields. It is not smelted; it goes straight into the helm at 42 and the blade at 45.',
    '',
    'The digging and the working are two different things. Sunstone rock comes out of the ground at Mining 17, easier than mithril, but no forge will take it until Smithing 24. Stormstone is the same: dig it at 24, work it at 33.',
    '',
    'GODLY PLATED is not mined at all. It is dragon scale, mithril and obsidian, and Halcyon forges it in the sky city.',
    'A rock you are not miner enough for tells you so when you press USE on it. Come back with the level.',
  ] });

  window.ORES = { TIERS, BY_KEY, BY_TILE, SPOTS, SEAM, ANVIL, swingSecs: SWING_SECS };

  // ---------- self-test ----------
  const P = 'ores: ';
  HOOKS.selfTest.push((check, F, h) => {
    h.peace(true); closePanel(); player.action = null;
    if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
    const skills0 = { mining: { ...player.skills.mining }, smithing: { ...player.skills.smithing } };
    const bag0 = player.inv.slice(), eq0 = { ...player.equip };
    const emptyPack = () => { player.inv = player.inv.map(() => null); };
    const openSide = (x, y) => { for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const ax = x + dx, ay = y + dy; if (inMap(ax, ay) && !SOLID.has(tileAt(ax, ay))) return [ax, ay]; } return null; };
    // Double entry. Every number this file promises, written out a second time here, so a check cannot read
    // its own expectation off the line it is testing. A typo in either place fails the suite.
    const WANT_MINE = { blackiron: [13, 60], sunstone: [17, 70], stormstone: [24, 95] };            // [Mining level, xp a lump]
    const WANT_SMELT = { blackiron: [15, 26, 1], sunstone: [24, 48, 2], stormstone: [33, 78, 3] };  // [Smithing level, xp, coal a bar]
    const WANT_ANVIL = {                                                                            // [bars, Smithing level, xp]
      blackiron_dagger: [1, 19, 55], blackiron_helm: [1, 19, 55], blackiron_legs: [2, 20, 110], blackiron_sword: [2, 21, 110], blackiron_body: [3, 21, 165],
      sunstone_helm: [1, 31, 190], sunstone_shield: [2, 32, 380], sunstone_legs: [2, 33, 380], sunstone_sword: [2, 34, 380], sunstone_body: [3, 35, 570],
      stormstone_helm: [1, 37, 320], stormstone_shield: [2, 38, 640], stormstone_legs: [2, 39, 640], stormstone_sword: [2, 40, 640], stormstone_body: [3, 41, 960],
    };
    { const bad = [];
      for (const t of TIERS) { const w = WANT_MINE[t.key]; if (t.mineLv !== w[0] || t.mineXp !== w[1]) bad.push(`${t.key} rock ${t.mineLv}/${t.mineXp} wanted ${w.join('/')}`); }
      for (const t of TIERS) { const w = WANT_SMELT[t.key], r = SMELT.find(x => x.out === t.bar);
        const coal = r && (r.needs.find(([id]) => id === 'coal') || [null, 0])[1];
        if (!r || r.lv !== w[0] || r.xp !== w[1] || coal !== w[2]) bad.push(`${t.bar} ${r ? r.lv + '/' + r.xp + '/' + coal : 'missing'} wanted ${w.join('/')}`); }
      for (const out in WANT_ANVIL) { const w = WANT_ANVIL[out], r = RECIPES.find(x => x.out === out);
        const bars = r && r.needs[0] && r.needs[0][1];
        if (!r || r.station !== 'anvil' || bars !== w[0] || r.lv !== w[1] || r.xp !== w[2]) bad.push(`${out} ${r ? bars + '/' + r.lv + '/' + r.xp : 'missing'} wanted ${w.join('/')}`); }
      check(P + 'the tables say what this file promises: three rocks at Mining 13/17/24, three bars at Smithing 15/24/33 for 1/2/3 coal, and fifteen anvil recipes from 19 to 41',
        bad.length === 0, { wrong: bad, mine: WANT_MINE, smelt: WANT_SMELT }); }

    // ---- every rock is on the map, in its own country, and can be walked to ----
    for (const t of TIERS) {
      const spots = SPOTS[t.key];
      const placed = spots.filter(([x, y]) => tileAt(x, y) === t.tile);
      const regions = [...new Set(spots.map(([x, y]) => regionAt(x, y).name))].sort();
      const sides = spots.map(([x, y]) => openSide(x, y));
      const walled = spots.filter((s, i) => !sides[i]);
      const unreached = [];
      for (let i = 0; i < spots.length; i++) { const s = sides[i]; if (!s) continue; if (!F.bfs(t.anchor[0], t.anchor[1], s[0], s[1])) unreached.push(spots[i].join(',')); }
      check(P + `${t.key}: rocks stand on the map (${t.key === 'blackiron' ? 'Grey Quarry and the hills north of Thistledown' : t.key === 'sunstone' ? 'Wolfwood' : 'the Far Shore'}), each with a side to stand on, each walkable from ${t.anchor.join(',')}`,
        spots.length >= 10 && placed.length === spots.length && walled.length === 0 && unreached.length === 0,
        { rocks: spots.length, standing: placed.length, regions, noSide: walled, unreachable: unreached, anchor: t.anchor });
    }
    // blackiron comes from two different countries, and no new rock was ever laid in a corridor
    { const rs = [...new Set(SPOTS.blackiron.map(([x, y]) => regionAt(x, y).name))].sort();
      const quarry = SPOTS.blackiron.filter(([x, y]) => regionAt(x, y).name === 'Grey Quarry').length;
      const hills = SPOTS.blackiron.length - quarry;
      check(P + 'blackiron is dug in two places: the Grey Quarry face and the hills north of the town wall',
        quarry >= 6 && hills >= 6 && rs.length >= 2, { quarry, hills, regions: rs }); }

    // ---- the pickaxe gate, the Mining level, the ore and the xp ----
    for (const t of TIERS) {
      const spot = SPOTS[t.key].find(([x, y]) => tileAt(x, y) === t.tile && openSide(x, y));
      if (!spot) { check(P + `${t.key}: mining it`, false, { spot }); continue; }
      const [rx, ry] = spot, [sx, sy] = openSide(rx, ry);
      // walk the last step, then stand square on the tile: a knight stopped short of the centre reaches for
      // whatever else is INTERESTING beside him instead of the rock he is facing
      F.tp(sx, sy); const walked = F.goAdjacent(rx, ry, 400); F.tp(sx, sy); F.face(rx, ry);
      // no pickaxe at all (an empty pack, and nothing in the weapon slot either)
      emptyPack(); const eqw = player.equip.weapon; player.equip.weapon = null;
      notice = null; F.press('KeyE'); F.sim(2, []);
      const noPick = !player.action && !!notice && /pickaxe/.test(notice.text);
      h.give('bronze_pickaxe', 1);
      // one level short
      player.skills.mining.xp = XP_TABLE[t.mineLv - 1]; notice = null; F.face(rx, ry); F.press('KeyE'); F.sim(2, []);
      const lowLv = !player.action && !!notice && new RegExp('Mining level ' + t.mineLv).test(notice.text) && tileAt(rx, ry) === t.tile;
      // at the level: the ore, the xp, rubble, and a regrow queued for it
      player.skills.mining.xp = XP_TABLE[t.mineLv];
      const ore0 = countItem(t.ore), x0 = player.skills.mining.xp;
      F.face(rx, ry); F.press('KeyE');
      const started = !!player.action && player.action.type === 'mine';
      const steps = F.untilAction(900, () => player.skills.mining.xp > x0); player.action = null;
      const gained = player.skills.mining.xp - x0;
      const settled = tileAt(rx, ry) === T.RUBBLE && regrow.some(r => r.i === idx(rx, ry) && r.t === t.tile && r.timer > 0);
      check(P + `${t.key}: needs a pickaxe, then Mining ${t.mineLv}; at ${t.mineLv} it gives ${ITEMS[t.ore].name} for ${t.mineXp} xp and the face settles to rubble and regrows`,
        typeof walked === 'number' && noPick && lowLv && started && typeof steps === 'number' && gained === WANT_MINE[t.key][1] && countItem(t.ore) === ore0 + 1 && settled,
        { walked, noPick, lowLv, started, steps, gained, want: t.mineXp, ore: countItem(t.ore), tile: tileName(tileAt(rx, ry)), settled, notice: notice && notice.text });
      // put the rock back for the next run of the suite
      changeTile(rx, ry, t.tile); regrow = regrow.filter(r => r.i !== idx(rx, ry));
      player.equip.weapon = eqw;
    }

    // ---- the forge: one smelt per metal ----
    const FORGE = [92, 37], ANV = [94, 38];
    for (const t of TIERS) {
      emptyPack(); h.give('hammer', 1); h.give(t.ore, 1); h.give('coal', t.coal);
      player.skills.smithing.xp = XP_TABLE[t.barLv - 1];
      F.tp(92, 39); const walked = F.walkTo(FORGE[0], FORGE[1] + 1, 600); F.tp(FORGE[0], FORGE[1] + 1); F.face(FORGE[0], FORGE[1]);
      closePanel(); F.press('KeyE'); render();
      const open = panel === 'station' && panelArg === 'forge';
      const rec = SMELT.find(s => s.out === t.bar);
      const low = !F.clickButton(rec.label); // one level short: the button is not registered as craftable
      closePanel();
      player.skills.smithing.xp = XP_TABLE[t.barLv];
      F.face(FORGE[0], FORGE[1]); F.press('KeyE'); render();
      const ore0 = countItem(t.ore), coal0 = countItem('coal'), bar0 = countItem(t.bar), x0 = player.skills.smithing.xp;
      const clicked = F.clickButton(rec.label);
      const steps = F.untilAction(400, () => countItem(t.bar) > bar0); closePanel(); player.action = null;
      check(P + `${t.key}: a forge smelts ${ITEMS[t.ore].name} + ${t.coal} coal into a ${ITEMS[t.bar].name} at Smithing ${t.barLv} (${t.barXp} xp), and refuses it at ${t.barLv - 1}`,
        typeof walked === 'number' && open && low && clicked && typeof steps === 'number' && countItem(t.bar) === bar0 + 1 && countItem(t.ore) === ore0 - 1 && countItem('coal') === coal0 - WANT_SMELT[t.key][2] && player.skills.smithing.xp === x0 + WANT_SMELT[t.key][1],
        { walked, open, refusedLow: low, clicked, steps, bars: countItem(t.bar), xp: player.skills.smithing.xp - x0, want: t.barXp });
    }

    // ---- the anvil: every one of the fifteen recipes, one at a time ----
    for (const [out, bars, lv, xp] of ANVIL) {
      const tier = BY_KEY[out.split('_')[0]];
      emptyPack(); h.give('hammer', 1); h.give(tier.bar, bars);
      player.skills.smithing.xp = XP_TABLE[lv];
      // square on the tile before the press: stopped 13 px short of the centre, Brakka is inside the knight's
      // cone and E talks to the smith instead of using his anvil
      F.tp(94, 40); const walked = F.walkTo(ANV[0], ANV[1] + 1, 600); F.tp(ANV[0], ANV[1] + 1); F.face(ANV[0], ANV[1]);
      closePanel(); F.press('KeyE'); render();
      const open = panel === 'station' && panelArg === 'anvil';
      const rec = RECIPES.find(r => r.out === out);
      const made0 = countItem(out), bar0 = countItem(tier.bar), x0 = player.skills.smithing.xp;
      // the anvil list pages by tier: the harness registers every craftable row off-screen, so the label is
      // reachable from any page. craft() is the same call the row makes, kept as the fallback the dwarves use.
      const viaButton = F.clickButton(rec.label); const clicked = viaButton || craft(rec) === true;
      const steps = F.untilAction(400, () => countItem(out) > made0); closePanel(); player.action = null;
      check(P + `${tier.key} at the anvil: ${rec.label} (Smithing ${lv}, ${xp} xp)`,
        typeof walked === 'number' && open && clicked && typeof steps === 'number' && countItem(out) === made0 + 1 && countItem(tier.bar) === bar0 - WANT_ANVIL[out][0] && player.skills.smithing.xp === x0 + WANT_ANVIL[out][2],
        { walked, open, viaButton, clicked, steps, made: countItem(out), barsLeft: countItem(tier.bar), xp: player.skills.smithing.xp - x0, want: xp });
    }
    player.inv = bag0; player.equip = eq0; recomputeMaxHp(); player.hp = player.maxHp;

    // ---- every piece is a step up on what came before and a step below what comes after ----
    { const def = id => (ITEMS[id] && ITEMS[id].armour && ITEMS[id].armour.def) || 0;
      const str = id => (ITEMS[id] && ITEMS[id].weapon && ITEMS[id].weapon.str) || 0;
      const ladders = {
        helm: ['steel_helm', 'blackiron_helm', 'mithril_helm', 'sunstone_helm', 'stormstone_helm', 'obsidian_helm', 'godly_helm'],
        body: ['steel_body', 'blackiron_body', 'mithril_body', 'sunstone_body', 'stormstone_body', 'godly_body'],
        legs: ['steel_legs', 'blackiron_legs', 'mithril_legs', 'sunstone_legs', 'stormstone_legs', 'godly_legs'],
        shield: ['scale_shield', 'sunstone_shield', 'stormstone_shield', 'godly_shield'],
      };
      const broken = [];
      for (const slot in ladders) { const l = ladders[slot].filter(id => ITEMS[id]); for (let i = 1; i < l.length; i++) if (def(l[i]) <= def(l[i - 1])) broken.push(`${slot}: ${l[i]} ${def(l[i])} is not above ${l[i - 1]} ${def(l[i - 1])}`); }
      const swords = ['steel_sword', 'blackiron_sword', 'mithril_sword', 'sunstone_sword', 'stormstone_sword'];
      for (let i = 1; i < swords.length; i++) if (str(swords[i]) <= str(swords[i - 1])) broken.push(`sword: ${swords[i]} ${str(swords[i])} is not above ${swords[i - 1]} ${str(swords[i - 1])}`);
      const topArmour = ['godly_helm', 'godly_body', 'godly_legs'].every(id => !ITEMS[id] || def(id) > def(id.replace('godly', 'stormstone')));
      check(P + 'the armour and blade ladders climb without a flat step: steel → blackiron → mithril → sunstone → stormstone → Godly, and nothing mined beats Godly Plated',
        broken.length === 0 && topArmour, { broken, topArmour }); }

    // ---- and the measurement this file exists for ----
    // Before: PLAYTHROUGH.progression().bands said mining {gap 10, lastNew 10, at 20} and
    //         smithing {gap 12, lastNew 30, at 42}. Both holes are now filled from inside.
    { const p = PLAYTHROUGH.progression();
      const m = p.bands.mining, s = p.bands.smithing;
      const mineSrc = (p.sources.mining || []).map(r => r.req);
      const smithGates = p.rows.filter(r => r.skill === 'smithing' && r.kind !== 'cape').map(r => r.lv);
      const inHole = (list, lo, hi) => list.some(v => v > lo && v < hi);
      const dead = p.rows.filter(r => r.dead && r.kind !== 'cape' && (r.skill === 'mining' || r.skill === 'smithing')).map(r => `${r.skill} ${r.lv} ${r.what}`);
      check(P + 'the audit measures both cliffs cut down: Mining was 10 levels with nothing new (10→20), Smithing 12 (30→42); now something new to mine between 10 and 20 and between 20 and 28, something new to forge between 30 and 42, and no gate left without a source',
        m.gap <= 6 && s.gap <= 5 && inHole(mineSrc, 10, 20) && inHole(mineSrc, 20, 28) && inHole(smithGates, 30, 42) && dead.length === 0,
        { before: { mining: { gap: 10, lastNew: 10, at: 20 }, smithing: { gap: 12, lastNew: 30, at: 42 } }, after: { mining: m, smithing: s },
          miningSourceLevels: mineSrc, newSmithingGates: smithGates.filter(v => v > 30 && v < 42), dead }); }

    // ---- the Voice names each metal the first time you cut it, once ----
    { const st = os(); const seen0 = st.seen.slice(); st.seen = [];
      const t = TIERS[0]; const spot = SPOTS[t.key].find(([x, y]) => tileAt(x, y) === t.tile && openSide(x, y));
      const said = () => (dialog.cur && /Blackiron\./.test(dialog.cur.text)) || dialog.queue.some(d => /Blackiron\./.test(d.text));
      let first = false, again = true, mined2 = false;
      if (spot) {
        const [rx, ry] = spot, [sx, sy] = openSide(rx, ry);
        emptyPack(); h.give('bronze_pickaxe', 1);
        const eqw = player.equip.weapon; player.equip.weapon = null;
        player.skills.mining.xp = XP_TABLE[t.mineLv];
        dialog.queue.length = 0; dialog.cur = null;
        const a0 = player.skills.mining.xp;
        F.tp(sx, sy); F.face(rx, ry); F.press('KeyE'); F.untilAction(900, () => player.skills.mining.xp > a0); player.action = null;
        first = st.seen.includes(t.key) && said();
        changeTile(rx, ry, t.tile); regrow = regrow.filter(r => r.i !== idx(rx, ry));
        // a second lump of the same metal: the ore still comes, the line does not
        dialog.queue.length = 0; dialog.cur = null;
        const a1 = player.skills.mining.xp;
        F.tp(sx, sy); F.face(rx, ry); F.press('KeyE'); F.untilAction(900, () => player.skills.mining.xp > a1); player.action = null;
        mined2 = player.skills.mining.xp > a1;
        again = said();
        changeTile(rx, ry, t.tile); regrow = regrow.filter(r => r.i !== idx(rx, ry));
        player.equip.weapon = eqw;
      }
      dialog.queue.length = 0; dialog.cur = null; st.seen = seen0;
      check(P + 'the Voice names a new metal the first lump you cut, and never again', first && mined2 && !again, { first, minedTwice: mined2, saidAgain: again }); }

    // ---- the iPad can reach them, and the book explains the ladder ----
    { const tappable = TIERS.every(t => INTERESTING_TILES.has(t.tile));
      const solid = TIERS.every(t => SOLID.has(t.tile));
      const page = window.WIKI ? WIKI.get('skills', 'metals') : null;
      const gathered = TIERS.every(t => GATHER[t.tile] && GATHER[t.tile].skill === 'mining' && GATHER[t.tile].tool === 'pickaxe');
      check(P + 'each new rock is solid, tappable on the iPad, mined through the core GATHER table, and the book has a page listing every metal in order',
        tappable && solid && gathered && !!page && page.lines.length >= 10, { tappable, solid, gathered, page: !!page, lines: page && page.lines.length }); }

    player.skills.mining = skills0.mining; player.skills.smithing = skills0.smithing;
    player.inv = bag0; player.equip = eq0; recomputeMaxHp(); player.hp = player.maxHp;
    h.peace(false);
  });
}
