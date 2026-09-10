// ============================================================================
// YOUR ISLAND — a private place to build, so nobody builds in the shared world
// Owner, thinking ahead to this being multiplayer one day: "we do not want players just building things
// willy-nilly in the world. So I think we need to introduce house portals that take you to a flat grassland
// that you can build on. It should be a floating island. You can get seeds from different trees and plant
// them if you want. You can build your crafting stuff. You can build a bank chest there. You can create a
// hub, then a portal nexus, a portal room."
//
// So: a stone portal stands inside Thistledown's north wall at (117,17) — five tiles east of the north road,
// on its own cobble plinth. E on it (or a tap) drops the knight onto a floating grassland island that is HIS.
// The island is an INSTANCE (16-instances), which means it is never part of the world map and nothing built
// on it can ever leak into the world. Instances are also normally thrown away when you leave — so this file
// gives the island a save format of its own:
//
//   player.house = {
//     w:      34,                                  the island grid the indices were written for
//     tiles:  { "<y*34+x>": "WORKBENCH", ... },    every tile that differs from the built island, by NAME
//     crops:  [ { x, y, stage, t, crop } ],        what is planted, with catch-up growth while you are away
//     grow:   [ { x, y, to: "TREE", at } ],        saplings and felled trees, due at an absolute `time`
//     portals:{ "<y*34+x>": "quarry" },            which arch goes where
//     been:   { quarry: true },                    the places you have stood in, which is what an arch needs
//     seen, made, awayAt
//   }
//
// Tile NAMES, never ids: a feature file coming or going renumbers every id (03-textures), and this save has
// to outlive that the same way the core's mapDiffs does.
//
// Wrapped core functions (reassignment, the accepted way — 13-ux, 44-wiki, 50-economy and 55-riding do it):
//   changeTile   — on the island a tile edit is written to player.house.tiles instead of mapDiffs, and a
//                  felled tree or a mined rock books its own regrowth (the core's `regrow` is instance-local
//                  and thrown away on the way out, so the island keeps its own clock)
//   save         — from the island the live `crops` are the island's; they are stashed and the overworld's
//                  put back for the write, so the world's save never contains an island crop
//   load         — leaves the island first, so the island is stashed before the save replaces `player`
//   placeAction  — saplings only plant on your own ground; a lodestone will not bind on floating rock
//   finishGather — chopping a tree in the world sometimes drops a sapling for the island
//
// Keeping building in the overworld exactly as it was is deliberate (see the summary): this gives him
// somewhere better, it does not take anything away.
// window.HOUSE exposes everything the self-test and any later feature needs.
// ============================================================================
{
  // ---------- the island ----------
  const HOUSE_ID = 'house';
  const HW = 34, HH = 24;                 // the instance grid: the island sits in the middle of it with sky all round
  const CX = 17, CY = 12, RX = 13, RY = 9; // the land: an ellipse of grass
  const ENTRY = [17, 19], GATE = [17, 20]; // where you land, and the arch home one step south of it
  const PORTAL = { x: 117, y: 17 }, STEP = { x: 117, y: 18 }; // the world portal, inside Thistledown's north wall
  const SAPLING_SECS = 90;                // a sapling becomes a tree
  const SAPLING_CHANCE = 0.2;             // a felled world tree hands one over this often
  const CROP_STAGE = 40;                  // the core's seconds per crop stage (07-update)

  const hidx = (x, y) => y * HW + x;
  const onGrid = (x, y) => x >= 0 && y >= 0 && x < HW && y < HH;

  // ---------- tiles ----------
  const T_PORTAL = addTile('HOUSE_PORTAL', { solid: true, tex: 'cobble', mini: '#b58cff' });
  const T_GATE = addTile('HOUSE_GATE', { solid: true, tex: 'cobble', mini: '#b58cff' });
  const T_VOID = addTile('HOUSE_SKY', { solid: true, tex: 'water', mini: '#8fd0ff' });
  const T_BANK = addTile('HOUSE_CHEST', { solid: true, tex: 'floor', mini: '#f5c542' });
  const T_ARCH = addTile('HOUSE_ARCH', { solid: true, tex: 'cobble', mini: '#7ec8ff' });
  const T_SAPLING = addTile('HOUSE_SAPLING', { tex: 'grass', mini: '#6fc24a' });
  for (const t of [T_PORTAL, T_GATE, T_BANK, T_ARCH]) INTERESTING_TILES.add(t); // a tap walks to them and uses them

  // ---------- saplings ----------
  Object.assign(ITEMS, {
    tree_sapling: { name: 'Tree sapling', value: 12, color: '#6fc24a', shape: 'seed', sapling: 'TREE', place: 'HOUSE_SAPLING' },
    oak_sapling: { name: 'Oak sapling', value: 30, color: '#3f7d2b', shape: 'seed', sapling: 'OAK', place: 'HOUSE_SAPLING' },
  });
  for (const id of ['tree_sapling', 'oak_sapling']) { ITEMS[id].id = id; ITEMS[id].stack = 50; }
  const SAPLING_FROM = { [T.TREE]: 'tree_sapling', [T.OAK]: 'oak_sapling' };
  // what grows back on the island, and how long it takes (the core's regrow numbers, in seconds)
  const REGROWS = { [T.TREE]: 40, [T.OAK]: 70, [T.ROCK]: 35, [T.IRON]: 50, [T.COAL]: 70 };

  // ---------- where an arch can take you ----------
  // Each one is a place with a region of its own; standing in that region is what unlocks the arch.
  const DESTS = [
    { key: 'thistledown', name: 'Thistledown', region: 'Thistledown', x: 112, y: 33, colour: '#d8a95e', line: 'The square, by the well.' },
    { key: 'quarry', name: 'Grey Quarry', region: 'Grey Quarry', x: 54, y: 8, colour: '#9aa0a8', line: 'Iron and coal in the rock.' },
    { key: 'pond', name: "Miller's Pond", region: "Miller's Pond", x: 41, y: 39, colour: '#3d86c6', line: 'Shrimp, and trout for the patient.' },
    { key: 'wolfwood', name: 'Wolfwood', region: 'Wolfwood', x: 80, y: 78, colour: '#4a6a3a', line: 'The deep road south. Keep to the paths.' },
    { key: 'camp', name: 'Goblin Camp', region: 'Goblin Camp', x: 152, y: 30, colour: '#8b2e2e', line: 'Their machines are here.' },
    { key: 'hollowford', name: 'Hollowford', region: 'Hollowford', x: 139, y: 79, colour: '#c9a36a', line: 'The town the beast walked through.' },
  ];
  const destOf = key => DESTS.find(d => d.key === key) || null;

  // ---------- what you can build ----------
  const KITS = [
    { key: 'workbench', name: 'Workbench', tile: T.WORKBENCH, cost: [['plank', 8]], xp: 60, blurb: 'Planks into arrows, bows, doors and beds.' },
    { key: 'forge', name: 'Forge', tile: T.FORGE, cost: [['stone', 12], ['iron_bar', 2]], xp: 90, blurb: 'Ore and coal into bars.' },
    { key: 'anvil', name: 'Anvil', tile: T.ANVIL, cost: [['iron_bar', 4], ['stone', 8]], xp: 90, blurb: 'Bars into weapons and armour. Bring a hammer.' },
    { key: 'oven', name: 'Oven', tile: T.OVEN, cost: [['stone', 14]], xp: 70, blurb: 'Cook what you catch, and bake pies.' },
    { key: 'workshop', name: 'Workshop', tile: T.WORKSHOP, cost: [['plank', 10], ['iron_bar', 3]], xp: 110, blurb: 'Traps and iron arrows.' },
    { key: 'alchemy', name: 'Alchemy bench', tile: T.ALCHEMY, cost: [['stone', 8], ['iron_bar', 2]], xp: 110, blurb: 'Blast powder and scrap into bombs.' },
    { key: 'chest', name: 'Bank chest', tile: T_BANK, cost: [['plank', 10], ['iron_bar', 3]], xp: 120, blurb: 'The same vault Aldous keeps in Thistledown.' },
  ];
  const ARCH_COST = [['lodestone', 1], ['stone', 6], ['iron_bar', 2]];
  const ARCH_XP = 150;
  const kitOf = key => KITS.find(k => k.key === key) || null;
  const kitByTile = t => KITS.find(k => k.tile === t) || null;

  // ---------- state ----------
  const fresh = () => ({ w: HW, tiles: {}, crops: [], grow: [], portals: {}, been: {}, seen: false, gotSapling: false, made: 0, awayAt: 0 });
  function H() {
    if (!player.house || typeof player.house !== 'object') player.house = fresh();
    const h = player.house;
    if (h.w !== HW) { h.w = HW; h.tiles = {}; h.crops = []; h.grow = []; h.portals = {}; } // the grid was resized: the old indices mean nothing
    if (!h.tiles || typeof h.tiles !== 'object') h.tiles = {};
    if (!Array.isArray(h.crops)) h.crops = [];
    if (!Array.isArray(h.grow)) h.grow = [];
    if (!h.portals || typeof h.portals !== 'object') h.portals = {};
    if (!h.been || typeof h.been !== 'object') h.been = {};
    if (typeof h.made !== 'number') h.made = 0;
    if (typeof h.awayAt !== 'number') h.awayAt = 0;
    return h;
  }
  let inside = false;      // this file's own view: are we standing on the island right now
  let owCrops = null;      // the overworld's crops, held while the island's are in the global list
  let buildTab = 0;
  const active = () => !!(window.INSTANCES && INSTANCES.active() === HOUSE_ID);
  HOOKS.newGame.push(() => { inside = false; owCrops = null; buildTab = 0; player.house = fresh(); });

  // ---------- building the island ----------
  const onLand = (x, y) => {
    const dx = (x - CX) / RX, dy = (y - CY) / RY;
    return dx * dx + dy * dy <= 1;
  };
  function buildIsland(set, rnd) {
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) set(x, y, onLand(x, y) ? T.GRASS : T_VOID);
    // the porch: cobble under the gate, so the way home is always clear whatever he builds
    for (let y = GATE[1] - 2; y <= GATE[1]; y++) for (let x = GATE[0] - 1; x <= GATE[0] + 1; x++) if (onGrid(x, y)) set(x, y, T.COBBLE);
    set(GATE[0], GATE[1], T_GATE);
    // a stand of trees and a little rock, so there is something to cut and something to mine from day one
    const spots = [];
    for (let y = 3; y < HH - 3; y++) for (let x = 3; x < HW - 3; x++) {
      if (!onLand(x, y) || !onLand(x + 1, y) || !onLand(x - 1, y) || !onLand(x, y + 1) || !onLand(x, y - 1)) continue;
      if (Math.abs(x - GATE[0]) <= 3 && Math.abs(y - GATE[1]) <= 4) continue; // keep the porch and the landing clear
      spots.push([x, y]);
    }
    const take = n => { const out = []; for (let i = 0; i < n && spots.length; i++) out.push(spots.splice(Math.floor(rnd() * spots.length), 1)[0]); return out; };
    for (const [x, y] of take(11)) set(x, y, T.TREE);
    for (const [x, y] of take(3)) set(x, y, T.OAK);
    for (const [x, y] of take(4)) set(x, y, T.ROCK);
    for (const [x, y] of take(2)) set(x, y, T.IRON);
    for (const [x, y] of take(9)) set(x, y, T.FLOWERS);
  }

  const inst = INSTANCES.define(HOUSE_ID, {
    name: 'Your Island', sub: 'Nobody builds here but you', w: HW, h: HH,
    build: buildIsland, spawns: [], exit: null, entry: ENTRY,
    voice: 'Grass, sky, and nobody else. Build what you like here — the world is not yours to nail planks to.',
  });
  // define() paints the entry tile CAVE (a cave floor on a grass island); the porch cobble belongs there
  inst.tiles[hidx(ENTRY[0], ENTRY[1])] = T.COBBLE;
  const baseAt = i => inst.tiles[i];

  // ---------- the island's own save ----------
  function record(tx, ty, t) {
    if (!onGrid(tx, ty)) return;
    const h = H(), i = hidx(tx, ty);
    if (baseAt(i) === t) delete h.tiles[i]; else h.tiles[i] = tileName(t);
  }
  function applyTiles() {
    const h = H();
    for (const k in h.tiles) {
      const i = +k; if (!(i >= 0 && i < HW * HH)) continue;
      const t = tileId(h.tiles[k]); if (t === null) continue; // a tile whose feature file has gone: skip it, as the core does
      const x = i % HW, y = (i / HW) | 0;
      setTile(x, y, t); miniDirtyTiles.add(idx(x, y));
    }
  }
  // crops: the core grows whatever is in the global `crops`, which on the island is the island's own list.
  // Time spent away is paid back on the way in, so a potato planted before a trip to the quarry is ready when you get home.
  function cropsIn() {
    const h = H(), away = Math.max(0, time - h.awayAt);
    return h.crops.map(c => {
      let t = (c.t || 0) + away, stage = c.stage || 0;
      while (stage < 3 && t > CROP_STAGE) { t -= CROP_STAGE; stage++; }
      return { i: idx(c.x, c.y), stage, t: stage < 3 ? t : 0, crop: c.crop, __house: true };
    });
  }
  function cropsOut() {
    const h = H();
    h.crops = crops.filter(c => c.__house).map(c => ({ x: c.i % MAP_W, y: (c.i / MAP_W) | 0, stage: c.stage, t: c.t, crop: c.crop }));
    h.awayAt = time;
  }
  function addGrow(x, y, toName, secs) {
    const h = H();
    h.grow = h.grow.filter(gr => !(gr.x === x && gr.y === y));
    h.grow.push({ x, y, to: toName, at: time + secs });
  }
  function growTick() {
    const h = H(); if (!h.grow.length || !inside) return;
    let changed = false;
    for (let i = h.grow.length - 1; i >= 0; i--) {
      const gr = h.grow[i];
      if (time < gr.at) continue;
      const t = tileId(gr.to), cur = tileAt(gr.x, gr.y);
      if (t !== null && (cur === T_SAPLING || cur === T.STUMP || cur === T.RUBBLE)) {
        if (circleHitsTile(player.x, player.y, player.r + 2, gr.x, gr.y)) { gr.at = time + 3; continue; } // nobody gets a tree grown through them
        changeTile(gr.x, gr.y, t);
        burst(tc(gr.x), tc(gr.y), t === T.ROCK || t === T.IRON ? '#9a9da5' : '#6fc24a', 10, 60);
      }
      h.grow.splice(i, 1); changed = true;
    }
    if (changed) save();
  }

  // ---------- coming and going ----------
  function enterHouse() {
    if (active()) return true;
    if (!window.INSTANCES || !INSTANCES.enter(HOUSE_ID, [STEP.x, STEP.y])) return false;
    inside = true;
    owCrops = crops; crops = cropsIn();
    applyTiles(); growTick();
    miniDirty = true;
    const h = H();
    if (!h.seen) { h.seen = true; notify(touchMode() ? 'Your island. Tap BUILD to put something up. USE on the arch to go home.' : 'Your island. P to build. E on the arch by the porch to go home.'); save(); }
    return true;
  }
  function stash() {
    if (!inside) return;
    cropsOut();
    crops = owCrops || [];
    owCrops = null; inside = false;
  }
  function leaveHouse() {
    if (!inside) return false;
    stash();
    return window.INSTANCES ? INSTANCES.leave() : false;
  }
  // the L key, the LEAVE button and dying all call 16-instances' own leave, which this file cannot wrap:
  // it is caught here on the same tick instead, while the island's crops are still in the global list.
  const settle = () => { if (inside && !active()) stash(); };

  // ---------- core wrappers ----------
  const _changeTile = changeTile;
  changeTile = function (tx, ty, t) {
    if (!inside || !onGrid(tx, ty)) return _changeTile(tx, ty, t);
    const old = tileAt(tx, ty);
    const r = _changeTile(tx, ty, t);
    record(tx, ty, t);
    const secs = REGROWS[old];
    if (secs && (t === T.STUMP || t === T.RUBBLE)) addGrow(tx, ty, tileName(old), secs); // the island keeps its own regrowth
    return r;
  };
  if (window.FANGLANDS) window.FANGLANDS.changeTile = changeTile;

  const _save = save;
  save = function () {
    if (!inside) return _save();
    cropsOut();
    const live = crops; crops = owCrops || [];
    try { return _save(); } finally { crops = live; }
  };

  const _load = load;
  load = function () { if (inside) leaveHouse(); return _load(); };

  const _placeAction = placeAction;
  placeAction = function (id) {
    const def = id && ITEMS[id] ? ITEMS[id] : null;
    if (def && def.sapling && !inside) { notify('A sapling needs ground of your own. Take it to your island and plant it there.'); return; }
    if (inside && id === 'lodestone') { notify('A lodestone will not bite on floating rock. The arch by the porch is the way home.'); return; }
    const ft = frontTile(player, 40);
    if (inside && protectedTile(ft.tx, ft.ty)) { notify('Not on the porch. The way home stays clear.'); return; }
    const r = _placeAction.apply(this, arguments);
    if (def && def.sapling && tileAt(ft.tx, ft.ty) === T_SAPLING) {
      addGrow(ft.tx, ft.ty, def.sapling, SAPLING_SECS);
      floatText(player.x, player.y - 30, 'Planted', '#7ee787');
      gainXp('farming', 20); save();
    }
    return r;
  };

  // chopping a tree in the world sometimes leaves a sapling in your hand
  const _finishGather = finishGather;
  finishGather = function () {
    const a = player.action, t = a ? tileAt(a.tx, a.ty) : -1;
    const sap = SAPLING_FROM[t], g = GATHER[t];
    const held = () => (g ? countItem(g.item) + drops.reduce((s, d) => s + (d.id === g.item ? d.qty : 0), 0) : 0);
    const n0 = held();
    const r = _finishGather.apply(this, arguments);
    if (sap && g && held() > n0 && Math.random() < SAPLING_CHANCE) {
      giveOrDrop(sap, 1, player.x, player.y, true);
      floatText(player.x, player.y - 44, ITEMS[sap].name, ITEMS[sap].color, 13);
      const h = H();
      if (!h.gotSapling) { h.gotSapling = true; say('A live one, roots and all. It will not take in this ground — everything here belongs to somebody. Plant it on your own island and it will grow.', 'The Voice'); save(); }
    }
    return r;
  };

  // ---------- building on the island ----------
  const protectedTile = (tx, ty) => (tx === GATE[0] && ty === GATE[1]) || (tx === ENTRY[0] && ty === ENTRY[1]);
  function buildSpot() {
    if (!inside) return { ok: false, why: 'Your island is through the portal in Thistledown.' };
    const { tx, ty } = frontTile(player, 40);
    if (!onGrid(tx, ty)) return { ok: false, why: 'Face your own ground.' };
    if (protectedTile(tx, ty)) return { ok: false, why: 'Not on the porch. The way home stays clear.' };
    const t = tileAt(tx, ty);
    if (!PLACEABLE_ON.has(t)) return { ok: false, tx, ty, why: 'Face open ground: grass, dirt or cobble.' };
    if (circleHitsTile(player.x, player.y, player.r + 1, tx, ty)) return { ok: false, tx, ty, why: 'Step back a little.' };
    for (const d of drops) if (circleHitsTile(d.x, d.y, 8, tx, ty)) return { ok: false, tx, ty, why: 'Pick that up first.' };
    for (const m of monsters) if (!m.dead && circleHitsTile(m.x, m.y, m.r + 2, tx, ty)) return { ok: false, tx, ty, why: 'Something is in the way.' };
    return { ok: true, tx, ty };
  }
  const canPay = cost => cost.every(([id, n]) => countItem(id) >= n);
  const costText = cost => cost.map(([id, n]) => `${n} ${ITEMS[id] ? ITEMS[id].name.toLowerCase() : id}`).join(', ');
  const shortText = cost => cost.filter(([id, n]) => countItem(id) < n).map(([id, n]) => `${n - countItem(id)} more ${ITEMS[id] ? ITEMS[id].name.toLowerCase() : id}`).join(', ');

  function buildHere(kit, destKey) {
    const spot = buildSpot();
    if (!spot.ok) { notify(spot.why); return false; }
    const cost = kit ? kit.cost : ARCH_COST;
    if (!canPay(cost)) { notify(`Not enough. You need ${shortText(cost)}.`); return false; }
    if (!kit) {
      const d = destOf(destKey);
      if (!d) return false;
      if (!H().been[d.key]) { notify(`An arch only remembers a place you have stood in. You have not been to ${d.name}.`); return false; }
      if (archTo(d.key)) { notify(`There is already an arch to ${d.name}.`); return false; }
    }
    for (const [id, n] of cost) removeItem(id, n);
    changeTile(spot.tx, spot.ty, kit ? kit.tile : T_ARCH);
    const h = H(); h.made++;
    if (!kit) h.portals[hidx(spot.tx, spot.ty)] = destKey;
    gainXp('crafting', kit ? kit.xp : ARCH_XP);
    burst(tc(spot.tx), tc(spot.ty), kit ? '#d8a95e' : '#b58cff', 20, 110); sfx(kit && kit.tile === T.ANVIL ? 'anvil' : 'craft');
    const label = kit ? kit.name : `Arch to ${destOf(destKey).name}`;
    floatText(player.x, player.y - 34, label, '#ffe9a8', 14);
    notify(`${label} built. ${h.made} thing${h.made === 1 ? '' : 's'} on your island now.`);
    save();
    return true;
  }
  const archTo = key => Object.keys(H().portals).some(i => H().portals[i] === key && tileAt(+i % HW, ((+i) / HW) | 0) === T_ARCH);
  const archCount = () => Object.keys(H().portals).filter(i => tileAt(+i % HW, ((+i) / HW) | 0) === T_ARCH).length;

  // taking a thing down again: it is his island, so the materials come straight back
  function takeDown() {
    if (!inside) return false;
    const { tx, ty } = frontTile(player, 40);
    if (!onGrid(tx, ty) || protectedTile(tx, ty)) { notify('Nothing of yours in front of you.'); return false; }
    const t = tileAt(tx, ty), kit = kitByTile(t);
    if (!kit && t !== T_ARCH) { notify('Nothing of yours in front of you.'); return false; }
    const h = H(), cost = kit ? kit.cost : ARCH_COST;
    changeTile(tx, ty, T.GRASS);
    if (!kit) delete h.portals[hidx(tx, ty)];
    h.made = Math.max(0, h.made - 1);
    for (const [id, n] of cost) giveOrDrop(id, n, player.x, player.y, true);
    burst(tc(tx), tc(ty), '#8a8f98', 14, 80); sfx('ui');
    notify(`Taken down. ${costText(cost)} back in your pack.`);
    save();
    return true;
  }

  // ---------- travelling by arch ----------
  function travel(tx, ty) {
    const d = destOf(H().portals[hidx(tx, ty)]);
    if (!d) { notify('The arch is dark. Nothing on the other side of it yet.'); return; }
    leaveHouse();
    const spot = safeSpot(tc(d.x), tc(d.y), player.r, 'player') || { x: tc(d.x), y: tc(d.y) };
    player.x = spot.x; player.y = spot.y; player.action = null; closePanel();
    player.region = regionAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE)).name;
    areaBanner = { name: d.name, sub: d.line, t: 3.2 };
    burst(player.x, player.y, d.colour, 20, 110); sfx('open');
    miniDirty = true; save();
  }

  // ---------- the world portal ----------
  HOOKS.world.push((rnd, api) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) api.setTile(PORTAL.x + dx, PORTAL.y + dy, T.COBBLE);
    api.setTile(PORTAL.x, PORTAL.y, T_PORTAL);
    api.setTile(STEP.x, STEP.y, T.COBBLE);
  });

  // ---------- use ----------
  HOOKS.use.push((t, tx, ty) => {
    if (t === T_PORTAL) {
      if (!enterHouse()) notify('You cannot step through right now.');
      return true;
    }
    if (!inside) return false;
    if (t === T_GATE) { leaveHouse(); notify('You step back through into Thistledown.'); return true; }
    if (t === T_BANK) { notify('Your vault, the same one Aldous keeps in town.'); openPanel('bank'); return true; }
    if (t === T_ARCH) { travel(tx, ty); return true; }
    if (t === T_SAPLING) { const gr = H().grow.find(g => g.x === tx && g.y === ty); notify(gr ? `A sapling. ${Math.max(0, Math.ceil(gr.at - time))}s and it is a tree.` : 'A sapling.'); return true; }
    if (t === T_VOID) { notify('Open sky, and a very long way down.'); return true; }
    return false;
  });

  // ---------- per-tick ----------
  HOOKS.keyHelp.push({ action: 'Build (on your island)', codes: ['KeyP'] });
  HOOKS.update.push(dt => {
    settle();
    // the places you have stood in are the places an arch can reach
    if (!inside && !(window.INSTANCES && INSTANCES.active()) && player.region) {
      const h = H(); let found = null;
      for (const d of DESTS) if (!h.been[d.key] && d.region === player.region) { h.been[d.key] = true; found = d; }
      if (found) { if (h.seen) notify(`${found.name}. Your island can hold an arch to it now.`); save(); }
    }
    // P only when nothing else owns the keyboard: the wiki and the settings panel type letters
    if ((pressed.has('KeyP') && !dialog.cur && (!panel || panel === 'house_build')) || tapped('housebuild')) {
      pressed.delete('KeyP');
      if (inside) { panel === 'house_build' ? closePanel() : openPanel('house_build'); }
      else notify(`Your island is through the stone portal in Thistledown, inside the north wall at ${PORTAL.x}, ${PORTAL.y}.`);
    }
    if (!inside) return;
    for (const c of crops) if (!c.__house) c.__house = true; // anything planted while you are here belongs to the island
    growTick();
  });

  // ---------- the build panel ----------
  HOOKS.panel.house_build = (g, narrow) => {
    if (!inside) { closePanel(); return; }
    const h = H(), spot = buildSpot();
    const rows = buildTab === 0 ? KITS.length : DESTS.length;
    const { px, py, w } = panelBox(g, narrow ? 340 : 470, 132 + rows * 38 + 44, 'Build on your island',
      `${h.made} built · ${archCount()} of ${DESTS.length} arches standing`);
    button(g, px + 18, py + 58, (w - 44) / 2, 30, 'Stations', () => { buildTab = 0; }, buildTab === 0 ? '#1f6feb' : '#21262d');
    button(g, px + 26 + (w - 44) / 2, py + 58, (w - 44) / 2, 30, 'Portal nexus', () => { buildTab = 1; }, buildTab === 1 ? '#1f6feb' : '#21262d');
    g.fillStyle = spot.ok ? '#8b949e' : '#d29922'; g.font = '12px sans-serif'; g.textAlign = 'left';
    g.fillText(spot.ok ? 'It goes on the ground in front of you.' : spot.why, px + 18, py + 110);

    let y = py + 122;
    if (buildTab === 0) {
      for (const k of KITS) {
        const pay = canPay(k.cost), can = pay && spot.ok;
        roundRect(g, px + 18, y, w - 36, 34, 8); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill();
        g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(k.name, px + 30, y + 15);
        g.fillStyle = pay ? '#8b949e' : '#8b2e2e'; g.font = '11px sans-serif'; g.fillText(pay ? costText(k.cost) : shortText(k.cost) + ' needed', px + 30, y + 28);
        button(g, px + w - 130, y + 2, 112, 30, can ? 'Build it' : pay ? 'No room' : 'Cannot pay', () => buildHere(k, null), can ? '#238636' : '#21262d', can);
        y += 38;
      }
    } else {
      for (const d of DESTS) {
        const have = archTo(d.key), been = !!h.been[d.key], pay = canPay(ARCH_COST), can = been && !have && pay && spot.ok;
        roundRect(g, px + 18, y, w - 36, 34, 8); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill();
        g.fillStyle = have ? '#3fb950' : been ? '#e6edf3' : '#6e7681'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(d.name, px + 30, y + 15);
        g.fillStyle = '#8b949e'; g.font = '11px sans-serif'; g.fillText(have ? 'standing' : been ? costText(ARCH_COST) : 'you have not been there yet', px + 30, y + 28);
        if (have) { g.fillStyle = '#3fb950'; g.textAlign = 'right'; g.fillText('built', px + w - 26, y + 20); g.textAlign = 'left'; }
        else button(g, px + w - 130, y + 2, 112, 30, !been ? 'Not been' : !pay ? 'Cannot pay' : can ? 'Raise the arch' : 'No room', () => buildHere(null, d.key), can ? '#6a3fb9' : '#21262d', can);
        y += 38;
      }
    }
    const f = frontTile(player, 40);
    const front = onGrid(f.tx, f.ty) ? tileAt(f.tx, f.ty) : -1;
    const removable = !protectedTile(f.tx, f.ty) && (!!kitByTile(front) || front === T_ARCH);
    button(g, px + 18, y + 6, w - 36, 32, removable ? 'Take down what is in front of you (materials back)' : 'Face something you built to take it down',
      takeDown, removable ? '#8b2e2e' : '#21262d', removable);
  };

  // ---------- HUD ----------
  HOOKS.hud.push((g, narrow) => {
    if (!inside) return;
    const w = narrow && isTouch ? Math.min(250, VW - 108) : 250, hgt = 34, y = Math.max(HUD.leftY, 84);
    roundRect(g, 14, y, w, hgt, 10); g.fillStyle = 'rgba(10,14,22,0.78)'; g.fill();
    const h = H();
    g.fillStyle = '#8b949e'; g.font = '11px sans-serif'; g.textAlign = 'left';
    g.fillText(`${h.made} built · ${archCount()} of ${DESTS.length} arches`, 26, y + 21);
    button(g, 14 + w - 74, y + 4, 62, 26, 'BUILD', () => { touch.taps.push('housebuild'); }, '#1f6feb');
    HUD.leftY = y + hgt + 6;
  });

  // ---------- drawing ----------
  function drawSky(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#8fbfe8'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, y, TILE, TILE / 2);
    // slow cloud banks, far below: deterministic per tile so they do not shimmer
    const s = ((tx * 7919) ^ (ty * 2654435761)) >>> 0, drift = (time * 6 + (s % 97)) % (TILE * 3);
    if (s % 5 === 0) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.ellipse(x + (drift % TILE), y + 14 + (s % 17), 13, 5, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x + (drift % TILE) + 9, y + 17 + (s % 13), 9, 4, 0, 0, 7); g.fill();
    }
  }
  function drawCliff(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE + TILE;
    g.fillStyle = '#6b5540'; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + TILE, y - 6); g.lineTo(x + TILE - 5, y + 16); g.lineTo(x + 6, y + 18); g.closePath(); g.fill();
    g.fillStyle = '#54432f'; g.beginPath(); g.moveTo(x + 8, y + 12); g.lineTo(x + TILE - 8, y + 10); g.lineTo(x + TILE / 2 + 2, y + 30); g.closePath(); g.fill();
    g.fillStyle = '#7d6448'; g.fillRect(x, y - 6, TILE, 3);
  }
  function drawArchway(g, tx, ty, colour, glowUp) {
    const cx = tc(tx), y = ty * TILE, gl = 0.55 + Math.sin(time * 3 + tx * 0.7 + ty) * 0.18;
    // two standing stones and a lintel
    g.fillStyle = '#6e7178'; g.fillRect(cx - 20, y + 8, 8, TILE - 8); g.fillRect(cx + 12, y + 8, 8, TILE - 8); g.fillRect(cx - 22, y + 2, 44, 9);
    g.fillStyle = '#8f929a'; g.fillRect(cx - 20, y + 8, 3, TILE - 8); g.fillRect(cx + 12, y + 8, 3, TILE - 8); g.fillRect(cx - 22, y + 2, 44, 3);
    // the sheet of light between them
    const gr = g.createLinearGradient(cx, y + 10, cx, y + TILE);
    gr.addColorStop(0, `rgba(${colour}, ${0.15 + gl * 0.35})`); gr.addColorStop(1, `rgba(${colour}, ${0.45 + gl * 0.3})`);
    g.fillStyle = gr; g.fillRect(cx - 12, y + 11, 24, TILE - 11);
    const halo = g.createRadialGradient(cx, y + 26, 3, cx, y + 26, 46);
    halo.addColorStop(0, `rgba(${colour}, ${0.30 * gl})`); halo.addColorStop(1, `rgba(${colour}, 0)`);
    g.fillStyle = halo; g.beginPath(); g.arc(cx, y + 26, 46, 0, 7); g.fill();
    // motes rising through it
    for (let k = 0; k < 4; k++) {
      const p = ((time * 0.35 + k * 0.25 + tx * 0.11) % 1);
      g.fillStyle = `rgba(255,255,255,${(1 - p) * 0.55})`;
      g.beginPath(); g.arc(cx - 8 + ((k * 37 + tx * 13) % 16), y + TILE - p * (TILE - 12), 1.6, 0, 7); g.fill();
    }
    if (glowUp) { g.fillStyle = `rgba(${colour}, ${0.25 * gl})`; g.beginPath(); g.ellipse(cx, y + TILE - 2, 22, 6, 0, 0, 7); g.fill(); }
  }
  function drawBankChest(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x + TILE / 2, y + 40, 19, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3a1e'; g.fillRect(x + 7, y + 14, 34, 24);
    g.fillStyle = '#6d4a24'; g.fillRect(x + 7, y + 10, 34, 9);
    g.fillStyle = '#8f96a3'; g.fillRect(x + 11, y + 10, 4, 28); g.fillRect(x + 33, y + 10, 4, 28); g.fillRect(x + 7, y + 19, 34, 3);
    g.fillStyle = '#f5c542'; g.fillRect(x + 21, y + 20, 6, 8);
    g.fillStyle = '#2a2a30'; g.beginPath(); g.arc(x + 24, y + 23, 1.4, 0, 7); g.fill();
    g.strokeStyle = '#2a2a30'; g.lineWidth = 1; g.strokeRect(x + 7, y + 10, 34, 28);
  }
  function drawSapling(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), sway = Math.sin(time * 1.6 + tx) * 1.6;
    g.save();                                   // lineCap would otherwise leak into whatever draws next
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy + 12); g.quadraticCurveTo(cx + sway * 0.5, cy + 2, cx + sway, cy - 6); g.stroke();
    g.fillStyle = '#4c9134'; g.beginPath(); g.ellipse(cx + sway - 5, cy - 7, 6, 3.4, -0.5, 0, 7); g.fill();
    g.fillStyle = '#6fc24a'; g.beginPath(); g.ellipse(cx + sway + 5, cy - 9, 6, 3.4, 0.5, 0, 7); g.fill();
    g.fillStyle = '#5a3d26'; g.beginPath(); g.ellipse(cx, cy + 13, 7, 3, 0, 0, 7); g.fill();
    g.restore();
  }
  const ARCH_RGB = { thistledown: '216,169,94', quarry: '154,160,168', pond: '61,134,198', wolfwood: '110,170,90', camp: '200,80,70', hollowford: '201,163,106' };

  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE));
    for (let ty = y0; ty <= y1 + 2; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      // while you are on the island everything that is not island is open sky — the instance fills the rest
      // of the core map with WALL, and a wall of rock round a floating island would be a lie
      if (inside && (t === T_VOID || t === T.WALL)) { items.push({ y: -1e6 + ty, draw: () => drawSky(g, tx, ty) }); continue; }
      if (t === T_PORTAL) items.push({ y: ty * TILE + TILE - 6, draw: () => drawArchway(g, tx, ty, '181,140,255', true) });
      else if (t === T_GATE) items.push({ y: ty * TILE + TILE - 6, draw: () => drawArchway(g, tx, ty, '181,140,255', true) });
      else if (t === T_ARCH) items.push({ y: ty * TILE + TILE - 6, draw: () => drawArchway(g, tx, ty, ARCH_RGB[H().portals[hidx(tx, ty)]] || '126,200,255', false) });
      else if (t === T_BANK) items.push({ y: ty * TILE + TILE - 6, draw: () => drawBankChest(g, tx, ty) });
      else if (t === T_SAPLING) items.push({ y: ty * TILE + TILE - 8, draw: () => drawSapling(g, tx, ty) });
      if (inside && t !== T_VOID && t !== T.WALL && tileAt(tx, ty + 1) === T_VOID) items.push({ y: ty * TILE + TILE - 5, draw: () => drawCliff(g, tx, ty) });
    }
  });

  // ---------- a line in the quest book until he has found it once, and a ring on the map to walk to ----------
  QUEST_DEFS.house = { name: 'A place of your own' };
  HOOKS.questText.house = () => H().seen
    ? `Your island: ${H().made} built, ${archCount()} of ${DESTS.length} arches standing.`
    : `A stone portal stands inside Thistledown's north wall, east of the north road (${PORTAL.x}, ${PORTAL.y}). Step through it.`;
  HOOKS.activeQuests.push(() => (player.visitedVillage && !H().seen ? ['house'] : []));
  HOOKS.mapTarget.push(() => (player.visitedVillage && !H().seen ? { x: PORTAL.x, y: PORTAL.y, label: 'Your island', id: 'house' } : null));

  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    add('crafting', 'build a station on your island', 1, 60, 20, 'a workbench for 8 planks; a bank chest pays 120');
    add('crafting', 'raise a portal arch on your island', 5, ARCH_XP, 30, 'a lodestone, 6 stone and 2 iron bars, to a place you have been');
    add('farming', 'plant a sapling on your island', 1, 20, 10, 'saplings fall from world trees about one chop in five');
  });

  window.HOUSE = {
    ID: HOUSE_ID, W: HW, H: HH, ENTRY, GATE, PORTAL, STEP, DESTS, KITS, ARCH_COST, ARCH_XP, SAPLING_SECS, SAPLING_CHANCE, CROP_STAGE,
    tiles: { portal: T_PORTAL, gate: T_GATE, sky: T_VOID, chest: T_BANK, arch: T_ARCH, sapling: T_SAPLING },
    state: H, hidx, base: baseAt, enter: enterHouse, leave: leaveHouse, build: buildHere, takeDown, travel, kitOf, destOf, archTo, archCount,
    get inside() { return inside; },
  };

  // ---------- self-test ----------
  const P = 'house: ';
  HOOKS.selfTest.push((check, F, h) => {
    const sum = () => { let s = 0; for (let i = 0; i < map.length; i++) s = (Math.imul(s, 31) + map[i]) | 0; return s; };
    const at = () => [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
    const onStep = () => at()[0] === STEP.x && at()[1] === STEP.y;
    const goIn = () => { if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave(); settle(); closePanel(); F.tp(STEP.x, STEP.y); F.face(PORTAL.x, PORTAL.y); F.press('KeyE'); F.sim(2, []); return inside; };
    const front = () => { const f = frontTile(player, 40); return [f.tx, f.ty]; };
    const goTo = (x, y, fx, fy) => { F.tp(x, y); F.face(fx, fy); player.action = null; };
    // stand on a clear island tile facing a clear one, ready to build (the island's trees and rocks are laid
    // down by a seeded rnd, so a spot is cleared rather than assumed)
    const standAt = (x, y) => {
      const fx = x, fy = y - 1;
      if (SOLID.has(tileAt(x, y))) changeTile(x, y, T.GRASS);
      if (tileAt(fx, fy) !== T.GRASS) changeTile(fx, fy, T.GRASS);
      goTo(x, y, fx, fy); return [fx, fy];
    };

    h.peace(true);
    if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
    settle();
    const rg0 = regrow, fr0 = fires; regrow = []; fires = [];   // the overworld must hold still while its checksum is compared
    const bag0 = player.inv.map(s => s ? { ...s } : null), bank0 = player.bank.slice(), house0 = JSON.parse(JSON.stringify(player.house || {}));
    const crops0 = crops.slice(), diffs0 = mapDiffs.size, sum0 = sum(), time0 = time;
    player.house = fresh();
    player.inv = player.inv.map(() => null);

    check(P + `a stone portal stands inside Thistledown's north wall at (${PORTAL.x},${PORTAL.y}), on a cobble plinth, with a step in front`,
      tileAt(PORTAL.x, PORTAL.y) === T_PORTAL && SOLID.has(T_PORTAL) && INTERESTING_TILES.has(T_PORTAL)
      && tileAt(STEP.x, STEP.y) === T.COBBLE && !SOLID.has(tileAt(STEP.x, STEP.y))
      && regionAt(PORTAL.x, PORTAL.y).name === 'Thistledown',
      { portal: tileName(tileAt(PORTAL.x, PORTAL.y)), step: tileName(tileAt(STEP.x, STEP.y)), region: regionAt(PORTAL.x, PORTAL.y).name });

    // --- enter and leave ---
    { const went = goIn(), landed = at(), region = player.region;
      const grass = tileAt(CX, CY) === T.GRASS, sky = tileAt(0, 0) === T_VOID, gate = tileAt(GATE[0], GATE[1]) === T_GATE;
      const alone = monsters.length === 0;
      F.tp(ENTRY[0], ENTRY[1]); F.face(GATE[0], GATE[1]); F.press('KeyE'); F.sim(2, []);
      check(P + 'E on the portal lands you on a floating grass island with no one else on it; E on the arch by the porch brings you home to the step',
        went && landed[0] === ENTRY[0] && landed[1] === ENTRY[1] && region === 'Your Island'
        && grass && sky && gate && alone && !inside && window.__instance === null && onStep() && sum() === sum0,
        { went, landed, region, grass, sky, gate, monsters: alone, out: window.__instance, back: at(), mapBack: sum() === sum0 }); }

    // --- the round trip: build, leave, save, wipe, load, come back ---
    { goIn();
      const [bx, by] = standAt(CX - 2, CY + 2);
      h.give('plank', 12); h.give('iron_bar', 6); h.give('stone', 20); h.give('lodestone', 2);
      H().been.thistledown = true;
      placeAction('plank');
      const plankOk = tileAt(bx, by) === T.PLANK && countItem('plank') === 11;
      standAt(CX + 1, CY + 2); const [kx, ky] = front();
      const benchOk = buildHere(kitOf('workbench'), null) && tileAt(kx, ky) === T.WORKBENCH;
      standAt(CX + 4, CY + 2); const [ax, ay] = front();
      const archOk = buildHere(null, 'thistledown') && tileAt(ax, ay) === T_ARCH;
      const named = Object.values(H().tiles).every(v => typeof v === 'string' && v in T)
        && H().tiles[hidx(bx, by)] === 'PLANK' && H().tiles[hidx(kx, ky)] === 'WORKBENCH' && H().tiles[hidx(ax, ay)] === 'HOUSE_ARCH';
      leaveHouse(); F.sim(2, []);
      save();
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      const savedNames = !!raw.player.house && Object.values(raw.player.house.tiles).every(v => typeof v === 'string' && v in T);
      // wipe the knight entirely, the way the core's own save/load check does, then read him back off disk
      player = newPlayer();
      const loaded = load();
      const back = goIn();
      const same = tileAt(bx, by) === T.PLANK && tileAt(kx, ky) === T.WORKBENCH && tileAt(ax, ay) === T_ARCH && H().portals[hidx(ax, ay)] === 'thistledown';
      check(P + 'a placed plank, a built workbench and a raised arch survive leaving, saving, a wiped knight, loading and coming back',
        plankOk && benchOk && archOk && named && savedNames && loaded && back && same,
        { plankOk, benchOk, archOk, named, savedNames, loaded, back, plank: tileName(tileAt(bx, by)), bench: tileName(tileAt(kx, ky)), arch: tileName(tileAt(ax, ay)), dest: H().portals[hidx(ax, ay)] });

      // --- the chest is the bank of Thistledown ---
      standAt(CX - 4, CY + 2); const [cx2, cy2] = front();
      h.give('plank', 10); h.give('iron_bar', 3);
      const chestBuilt = buildHere(kitOf('chest'), null) && tileAt(cx2, cy2) === T_BANK;
      player.bank = [{ id: 'iron_bar', qty: 7 }];
      closePanel(); F.face(cx2, cy2); F.press('KeyE'); F.sim(2, []);
      const opened = panel === 'bank';
      render(); const drew = buttons.some(b => b.label === 'bank0');
      const pulled = F.clickButton('bank0'); const got = countItem('iron_bar');
      closePanel();
      check(P + 'the chest on the island opens the same vault Aldous keeps in town — the very same items come out of it',
        chestBuilt && opened && drew && pulled && got >= 7 && player.bank.length === 0,
        { chestBuilt, opened, drew, pulled, ironBars: got, bank: player.bank.length });

      // --- an arch actually travels ---
      { closePanel(); F.tp(ax, ay + 1); F.face(ax, ay); F.press('KeyE'); F.sim(2, []);
        const d = destOf('thistledown'), landed = at();
        check(P + 'an arch you raised really travels: E on it leaves the island and puts you down in the place it remembers',
          !inside && window.__instance === null && Math.abs(landed[0] - d.x) <= 2 && Math.abs(landed[1] - d.y) <= 2 && player.region === 'Thistledown',
          { landed, want: [d.x, d.y], region: player.region, inst: window.__instance }); }

      // --- nothing leaks ---
      { const s1 = sum(), d1 = mapDiffs.size;
        const islandInWorld = crops.some(c => c.__house) || crops.length !== crops0.length;
        check(P + 'nothing built on the island reaches the overworld: the world map, its saved tile diffs and its crops are untouched',
          s1 === sum0 && d1 === diffs0 && !islandInWorld && tileAt(bx, by) !== T.PLANK && tileAt(kx, ky) !== T.WORKBENCH,
          { mapSame: s1 === sum0, diffs: d1, diffs0, worldCrops: crops.length, was: crops0.length, worldTileAtBuildSpot: tileName(tileAt(bx, by)) }); } }

    // --- saplings ---
    { goIn();
      const [sx, sy] = standAt(CX - 3, CY - 3);
      player.inv = player.inv.map(() => null); h.give('tree_sapling', 2);
      const planted = (placeAction('tree_sapling'), tileAt(sx, sy) === T_SAPLING) && countItem('tree_sapling') === 1
        && H().grow.some(gr => gr.x === sx && gr.y === sy && gr.to === 'TREE');
      // wind the clock on past the sapling's due time and step away, so it is not growing through the knight
      F.tp(CX + 5, CY + 5); time += SAPLING_SECS + 1; growTick();
      const grew = tileAt(sx, sy) === T.TREE && H().tiles[hidx(sx, sy)] === 'TREE' && !H().grow.some(gr => gr.x === sx && gr.y === sy);
      // and the world will not take one
      leaveHouse(); F.sim(2, []); notice = null;
      const o = h.openSpot(60, 30); F.tp(o.x, o.y); player.facing = { x: 1, y: 0 };
      const wf = frontTile(player, 40); placeAction('tree_sapling');
      const refused = tileAt(wf.tx, wf.ty) !== T_SAPLING && countItem('tree_sapling') === 1 && !!notice && /ground of your own/i.test(notice.text);
      check(P + 'a sapling planted on the island grows into a tree on the island’s own clock, and the world will not take one',
        planted && grew && refused, { planted, grew, refused, notice: notice && notice.text, tile: tileName(tileAt(sx, sy)) }); }

    // --- a felled island tree grows back, on the island's own clock, not the world's ---
    { goIn();
      // one of the island's own trees, not the sapling the check above grew (whose base tile is grass)
      const tree = (() => { for (let y = 3; y < HH - 3; y++) for (let x = 3; x < HW - 3; x++) if (tileAt(x, y) === T.TREE && baseAt(hidx(x, y)) === T.TREE) return [x, y]; return null; })();
      let felled = false, regrown = false, worldClock = true;
      if (tree) {
        const rlen = regrow.length;
        changeTile(tree[0], tree[1], T.STUMP);
        felled = tileAt(tree[0], tree[1]) === T.STUMP && H().tiles[hidx(tree[0], tree[1])] === 'STUMP'
          && H().grow.some(gr => gr.x === tree[0] && gr.y === tree[1] && gr.to === 'TREE');
        worldClock = regrow.length === rlen;   // the core's regrow list is thrown away on the way out: it must not be used
        F.tp(CX, tree[1] < CY ? CY + 5 : CY - 5);  // well clear of it: nobody gets a tree grown through them
        time += 45; growTick();
        regrown = tileAt(tree[0], tree[1]) === T.TREE && !H().tiles[hidx(tree[0], tree[1])];
      }
      check(P + 'a tree felled on the island books its own regrowth (never the world’s regrow list) and comes back',
        !!tree && felled && worldClock && regrown, { tree, felled, worldClock, regrown }); }

    // --- crops grow while you are away, and never appear in the world ---
    { goIn();
      const [px2, py2] = standAt(CX - 5, CY);
      player.inv = player.inv.map(() => null); h.give('potato_seed', 1); h.give('bronze_hoe', 1);
      changeTile(px2, py2, T.SOIL); F.face(px2, py2); closePanel(); F.press('KeyE'); F.sim(2, []);
      const sown = tileAt(px2, py2) === T.CROP && crops.some(c => c.i === idx(px2, py2) && c.__house);
      leaveHouse(); F.sim(2, []);
      const gone = !crops.some(c => c.i === idx(px2, py2)) && H().crops.some(c => c.x === px2 && c.y === py2);
      time += CROP_STAGE * 3 + 5;              // three stages' worth of wandering the world
      goIn();
      const c = crops.find(x => x.i === idx(px2, py2));
      const ripe = !!c && c.stage === 3 && tileAt(px2, py2) === T.CROP;
      goTo(px2, py2 + 1, px2, py2); closePanel();
      const pot0 = countItem('potato'); F.press('KeyE'); F.sim(2, []);
      const picked = countItem('potato') + drops.reduce((s, d) => s + (d.id === 'potato' ? d.qty : 0), 0) - pot0 >= 2 && tileAt(px2, py2) === T.SOIL;
      check(P + 'a crop sown on the island ripens while you are away in the world, and is never in the world’s own crop list',
        sown && gone && ripe && picked, { sown, gone, ripe, stage: c && c.stage, picked });
      drops = drops.filter(d => d.id !== 'potato'); }

    // --- L and the touch LEAVE button go through 16-instances, not this file: the island must still be packed away ---
    { goIn();
      const [lx, ly] = standAt(CX + 3, CY - 2);
      player.inv = player.inv.map(() => null); h.give('plank', 1);
      placeAction('plank');
      changeTile(lx - 1, ly, T.SOIL); goTo(lx - 1, ly + 1, lx - 1, ly);
      player.inv = player.inv.map(() => null); h.give('potato_seed', 1);
      closePanel(); F.press('KeyE'); F.sim(2, []);
      const sown = crops.some(c => c.i === idx(lx - 1, ly) && c.__house);
      F.press('KeyL'); F.sim(2, []);   // exactly what the LEAVE button calls
      const out = !inside && window.__instance === null && onStep();
      const packed = H().crops.some(c => c.x === lx - 1 && c.y === ly) && H().tiles[hidx(lx, ly)] === 'PLANK';
      const clean = !crops.some(c => c.__house) && !crops.some(c => c.i === idx(lx - 1, ly));
      goIn();
      const kept = tileAt(lx, ly) === T.PLANK && tileAt(lx - 1, ly) === T.CROP && crops.some(c => c.i === idx(lx - 1, ly));
      check(P + 'leaving with L (what the touch LEAVE button presses) packs the island away too — nothing of it is left in the world',
        sown && out && packed && clean && kept, { sown, out, packed, clean, kept }); }

    // --- the panel will not build what you cannot pay for ---
    { goIn(); standAt(CX + 2, CY - 3);
      player.inv = player.inv.map(() => null);
      closePanel(); buildTab = 0; openPanel('house_build'); render();
      const cannot = buttons.some(b => b.label === 'disabled:Cannot pay');
      const [fx, fy] = front(); const before = tileAt(fx, fy);
      F.clickButton('Cannot pay');
      const stillEmpty = tileAt(fx, fy) === before;
      h.give('plank', 8); render();
      const canNow = buttons.some(b => b.label === 'Build it');
      const built = F.clickButton('Build it') && tileAt(fx, fy) === T.WORKBENCH && countItem('plank') === 0;
      closePanel();
      check(P + 'the build panel names what you are short of, refuses to build it, and takes the exact materials when you can pay',
        cannot && stillEmpty && canNow && built, { cannot, stillEmpty, canNow, built, tile: tileName(tileAt(fx, fy)) }); }

    // --- an arch only remembers a place you have stood in ---
    { goIn(); standAt(CX + 6, CY - 1);
      player.inv = player.inv.map(() => null); h.give('lodestone', 1); h.give('stone', 6); h.give('iron_bar', 2);
      const st = H(); st.been = {}; notice = null;
      const [fx, fy] = front();
      const refused = !buildHere(null, 'quarry') && tileAt(fx, fy) !== T_ARCH && !!notice && /have not been/i.test(notice.text);
      st.been.quarry = true;
      const raised = buildHere(null, 'quarry') && tileAt(fx, fy) === T_ARCH && H().portals[hidx(fx, fy)] === 'quarry' && countItem('lodestone') === 0;
      // and the materials come back if he takes it down again
      F.face(fx, fy); const down = takeDown() && tileAt(fx, fy) === T.GRASS && countItem('lodestone') === 1 && countItem('stone') === 6 && !H().portals[hidx(fx, fy)];
      check(P + 'an arch needs a place you have stood in, costs a lodestone and gives it back if you take the arch down',
        refused && raised && down, { refused, raised, down, notice: notice && notice.text }); }

    // --- put the world back exactly as it was ---
    if (inside) leaveHouse();
    if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
    settle();
    const worldOk = sum() === sum0 && mapDiffs.size === diffs0 && !inside && !crops.some(c => c.__house) && crops.length === crops0.length;
    const worldInfo = { mapSame: sum() === sum0, diffs: mapDiffs.size, diffs0, inside, islandCropsLoose: crops.filter(c => c.__house).length, crops: crops.length, was: crops0.length };
    time = time0; regrow = rg0; fires = fr0;
    player.inv = bag0; player.bank = bank0; player.house = house0;
    F.tp(STEP.x, STEP.y);
    check(P + 'the self-test leaves the world exactly as it found it', worldOk, worldInfo);
    save(); h.peace(false);
  });
}
