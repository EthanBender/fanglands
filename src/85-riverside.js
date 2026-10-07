// ============================================================================
// THE RIVERSIDE (the Great Spread, Stage 5b: ~/.fanglands/work/spread/spec.md §4 "New places", §6, §13 STAGE 5)
// src/85-riverside.js
//
// Three places along the river, each built on its staked ground (93-spread staked them in Stage 4):
//
//   THE OLD BRIDGE   the Long Road's crossing, laid in stone three wide (the DECO kind 'stone_bridge' over Stage 4's
//                    planks); the watchtower ruin and its chest on the far bank (02-world's, untouched); reeds on both
//                    banks with snakes and an adder in them (6+ tiles off the roads); Wilf the stonemason, who laid the
//                    stone; a rail. The signpost at the south end is Stage 4's (93-spread, at old_bridge.south).
//   MILLBROOK        a farm on the river bend: a farmhouse (with an oven), a red barn, a watermill whose wheel turns in a
//                    pit off a mill leat from the river (drawn here, in HOOKS.draw), Odo's wheat (DECO 'wheat' on soil),
//                    a paddock of sheep, a bare plot any knight may till. Tamsin the miller grinds wheat to flour (two
//                    sheaves to a sack) and sells flour, seed and bread; Odo the farmer talks. Crows in the wheat, giant
//                    rats by the barn. A rail. No river crossing: the leat is a dead end, the scarp seal is unchanged.
//   SALTMERE         the river mouth's north bank: five stilt huts (BUILDINGS over the water, posts drawn beneath), a
//                    boardwalk and a jetty (DOCK) two wide with lobster grounds off its end, drying racks (DECO 'rack'),
//                    fishing spots (shrimp and trout, the core's fishing; drawn as rings on the water); Nan Gully the
//                    fishmonger (buys every fish at full price, sells rods, pots and fish). Giant rats on the jetty. An
//                    8-tile marsh band of pools, sand bars and reeds on its land side. A rail.
//
// Every place: its stakes taken up, its REGIONS line its own (ATLAS.build, read by 93-spread), a rail (RAILS.add), people
// in the 83-townsfolk look (83-townsart's 'riverside' family), a 6-tile dressing ring of worn ground outside its box, and
// its footprint in ATLAS.REVS[2] (WORLD_REV 2): a knight's plank or wall standing in a box (or the ring) comes back to him.
//
// WHERE: every point is written in its place's own frame (ATLAS.planFrame: offsets from the plan box's top-left), so a
// place moves with its box. WHEN: on the finished land (HOOKS.built, after 92-worldshape, 93-ashedge and the stakes): the
// world's earlier passes keep rings clear round every person, building and spawn and draw dice as they go, so this
// file's people and buildings are taken out of NPCS and BUILDINGS at the start of every world and put back here. Its
// own dice are its own stream (mulberry32 of its name), never the shared rnd.
// Feature file: registers through HOOKS; wraps nothing in the core. window.RIVERSIDE is the test handle.
// ============================================================================
{
  const A = ATLAS, Tn = n => (n in T ? T[n] : -1);
  const IDS = ['old_bridge', 'millbrook', 'saltmere'];
  // built: 93-spread (which loads later) names these regions for the place, not the builders
  A.markBuilt('old_bridge', { sub: 'Stone over the river, and the old watchtower' });
  A.markBuilt('millbrook', { sub: 'A farm and a watermill on the river' });
  A.markBuilt('saltmere', { sub: 'Stilt huts and fresh fish on the river mouth' });
  const OB = A.planFrame('old_bridge'), MB = A.planFrame('millbrook'), SM = A.planFrame('saltmere');
  const FR = { old_bridge: OB, millbrook: MB, saltmere: SM };
  const RING = 6;
  const SEED = (() => { let h = 2166136261; for (const c of '85-riverside') h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; })();

  // ---------- the plans: one glyph a tile, rows from the box's top-left ----------
  //   .  as the land is     g  open grass (trees, rocks and flowers go; ore and berry bushes stay)
  //   ,  worn dirt          :  sand             ~  water           d  plank walk (DOCK)       L  lobster ground
  //   s  tilled soil (any knight may plant)     W  standing wheat  e  reeds                   h  a low hedge
  //   r  a drying rack      =  the stone bridge f  fence           G  a gate                  H  the hitching rail
  //   k  a fish stall
  const PLAN = {
    old_bridge: [
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '...................',
      '...............eee.',
      '...................',
      '...ee..===.........',
      '.......===.........',
      '..ee........H......',
    ],
    millbrook: [
      '......ggggggggggggg',
      'g.......ggggggggggg',
      'gssss....,ggggggggg',
      'gssssgH..,ggggggggg',
      'gggggggg.,ggggggggg',
      'gggg,,,,,,,,,,,,ggg',
      'ggggggggg,ggggg,ggg',
      'ggggggggg,ggggggggg',
      'ggggggggg,ggggggggg',
      'ggggggggg,ggggggggg',
      'ggggggggg,ggggggggg',
      'ggggggggg,ggggggggg',
      'g,,,,,,,,,,,,,,,,gg',
      'WWWWWWWggffffGffffg',
      'WWWWWWWggfgggggggfg',
      'WWWWWWW.gfgggggggfg',
      'hhhhhhhhhfffffffffg',
    ],
    saltmere: [
      '...rr..........rr..',
      '..::::::::kk::::::.',
      'H.::::::::::::::::.',
      '..::::::::::::::::.',
      '..:::::::::::::::..',
      '..ddddddddddddddd..',
      '......dd...........',
      '......dd...........',
      '......dd...........',
      '......dd...........',
      '......dd...........',
      '......dd...........',
      '......dd...........',
      '......dd...........',
      '......LL...........',
      '......LL...........',
    ],
  };

  // ---------- the buildings (BUILDINGS rows, in each place's frame) ----------
  const BLDG = [
    MB.pt({ id: 'mb_mill', x: 13, y: 0, w: 6, h: 5, name: 'Watermill', roof: '#7a5a3a', sign: 'MILL', door: 2, f: [[T.SHELF, 1, 1], [T.SHELF, 4, 1], [T.TABLE, 1, 3]] }),
    MB.pt({ id: 'mb_farmhouse', x: 1, y: 6, w: 6, h: 5, name: "Odo's Farmhouse", roof: '#8a6a2e', doorTop: 3, f: [[T.BED, 1, 1], [T.OVEN, 4, 1], [T.TABLE, 2, 3]] }),
    MB.pt({ id: 'mb_barn', x: 12, y: 7, w: 7, h: 5, name: 'Barn', roof: '#8a3a2a', doorTop: 3, f: [[T.SHELF, 1, 1], [T.SHELF, 5, 1]] }),
    SM.pt({ id: 'sm_hut1', x: 2, y: 6, w: 4, h: 3, name: 'Stilt hut', roof: '#6a5a44', doorTop: 2, stilts: true, f: [[T.BED, 1, 1]] }),
    SM.pt({ id: 'sm_hut2', x: 8, y: 6, w: 4, h: 3, name: 'Stilt hut', roof: '#5a6a6a', doorTop: 1, stilts: true, f: [[T.TABLE, 2, 1]] }),
    SM.pt({ id: 'sm_hut3', x: 13, y: 6, w: 4, h: 3, name: 'Stilt hut', roof: '#6a5048', doorTop: 2, stilts: true, f: [[T.BED, 1, 1]] }),
    SM.pt({ id: 'sm_hut4', x: 5, y: 1, w: 4, h: 3, name: "Nan Gully's hut", roof: '#4a5a6a', door: 1, stilts: true, f: [[T.SHELF, 2, 1]] }),
    SM.pt({ id: 'sm_hut5', x: 13, y: 1, w: 4, h: 3, name: 'Stilt hut', roof: '#6a5a44', door: 1, stilts: true, f: [[T.TABLE, 2, 1]] }),
  ].map(b => Object.assign(b, { riverside: true }));

  // ---------- the people (NPCS rows; each id is a look in 83-townsart's 'riverside' family) ----------
  const LINES = {
    wilf: [
      'This bridge was wood once. The river ate the planks, so I gave it stone. Three summers of hauling.',
      'That broken tower watched the bridge in the old days. Its guards ran when the goblins came, and nobody went back.',
      "There's a chest up in the ruin. I never opened it. It isn't mine to open. Maybe it's yours.",
      'Snakes love the reeds by the water. Leave them be and they leave you be. Mostly.',
      'Tie your horse at my rail if you like. Stone bridges don\'t mind hooves.',
    ],
    odo: [
      "Welcome to Millbrook! It's just us here: me, my wheat, my sheep, and Tamsin's mill.",
      "The crows think my wheat is their dinner. Chase them off if you like. They never listen to me.",
      'Rats got into the barn again. Big as cats, they are. Bigger than some cats.',
      "Bring Tamsin your wheat. Her wheel grinds it to flour, and flour makes pies. There's an oven in my farmhouse.",
      "That bare patch by the lane is for anyone. Dig it, plant it, eat it. Greta in Thistledown sells the seeds.",
    ],
  };
  const PEOPLE = [
    OB.pt({ id: 'wilf', name: 'Wilf the stonemason', x: 11, y: 11, tunic: '#8a8680', hair: '#a8a098', beard: true, role: 'riverfolk', lines: LINES.wilf }),
    MB.pt({ id: 'tamsin_miller', name: 'Tamsin the miller', x: 15, y: 2, tunic: '#5a86b0', hair: '#6a4426', woman: true, apron: true, role: 'shop', shop: 'mill' }),
    MB.pt({ id: 'odo', name: 'Odo the farmer', x: 8, y: 11, tunic: '#5a7a3e', hair: '#5a3a1a', beard: true, role: 'riverfolk', lines: LINES.odo }),
    SM.pt({ id: 'nan_gully', name: 'Nan Gully', x: 10, y: 2, tunic: '#3a5a7a', hair: '#e8e2d6', woman: true, apron: true, role: 'shop', shop: 'saltmere_fish' }),
  ].map(n => Object.assign(n, { riverside: true }));

  // ---------- the creatures (87-critters' kinds, and the farm's sheep) ----------
  const SPAWNS = [
    // the Old Bridge: in the reeds of both banks, each 6+ tiles off the Long Road and the Wolfwood Road
    { place: 'old_bridge', type: 'snake', at: () => OB.pts([[0, 5], [18, 5]]) },
    { place: 'old_bridge', type: 'adder', at: () => [OB.p(15, 4)] },
    // Millbrook: crows in the wheat, giant rats by the barn, sheep in the paddock
    { place: 'millbrook', type: 'crow', at: () => MB.pts([[1, 14], [4, 13], [5, 15]]) },
    { place: 'millbrook', type: 'giant_rat', at: () => MB.pts([[11, 12], [18, 12]]) },
    { place: 'millbrook', type: 'sheep', at: () => MB.pts([[12, 14], [15, 15]]) },
    // Saltmere: giant rats on the jetty
    { place: 'saltmere', type: 'giant_rat', at: () => SM.pts([[6, 10], [7, 12]]) },
  ];
  const spotsOf = s => s.at().map(([x, y]) => [Math.round(x), Math.round(y)]);

  // ---------- the mill leat and the wheel; Saltmere's fishing spots; the marsh band ----------
  const LEAT = () => MB.box([20, 1, 25, 1]), PIT = () => MB.box([19, 0, 19, 2]);
  const WHEEL = () => MB.p(19, 1);
  const FISH = () => SM.pts([[4, 11], [10, 10], [12, 13], [3, 14]]);
  const MARSH = () => SM.box([-8, 2, -1, 16]);

  // ---------- the footprint (§10): WORLD_REV 2 ----------
  const grow = (b, d) => [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
  const FOOT = () => [...IDS.map(id => grow(A.box(id), RING)), LEAT(), PIT(), MARSH()];
  if (A.REVS) A.REVS[2] = { stage: '5b', by: '85-riverside', why: 'the Old Bridge, Millbrook and Saltmere: each box with its dressing ring, the mill leat and the marsh band', boxes: FOOT() };

  // ---------- the shops ----------
  SHOPS.mill = { name: "Tamsin's Mill", stock: [['flour', 10], ['wheat_seed', 2], ['bread', 8]] };
  SHOPS.saltmere_fish = { name: "Nan Gully's Fish Stall", stock: [['fishing_rod', 60], ['lobster_pot', 60], ['shrimp', 8], ['trout', 20]], buys: ['raw_shrimp', 'shrimp', 'raw_trout', 'trout', 'raw_lobster', 'lobster'], rate: 1 };

  // ---------- the rails ----------
  const POSTS = {};
  const RAIL_NAMES = { old_bridge: "Wilf's rail by the Old Bridge", millbrook: "the rail at Millbrook", saltmere: "the rail at Saltmere" };
  if (window.RAILS) for (const id of IDS) RAILS.add({ id, place: RAIL_NAMES[id], at: () => POSTS[id] || null });

  // ---------- DECO kinds ----------
  // the Old Bridge's deck: worn grey setts between two parapet kerbs where the deck meets the water
  DECO.kind('stone_bridge', { ground: false, flat: true, bridge: true, use: 'Old stone, worn smooth by carts and boots. Wilf the stonemason laid it.',
    draw(g, px, py, c, tx, ty) {
      g.fillStyle = '#8d8a84'; g.fillRect(px, py, TILE, TILE);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
        const ox = (r % 2) * 6, sx = px + k * 12 + ox - 3, sy = py + r * 12;
        g.fillStyle = ((tx * 7 + ty * 3 + r * 5 + k) % 3) === 0 ? '#9c9890' : ((r + k) % 2 ? '#86827b' : '#928e87');
        g.fillRect(sx + 1, sy + 1, 10, 10);
      }
      g.strokeStyle = 'rgba(40,36,30,0.35)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      // a low parapet along each side of the deck (where the next cell is not deck), capped with a lighter stone
      const deck = (dx, dy) => DECO.isBridge(idx(tx + dx, ty + dy));
      for (const side of [-1, 1]) { if (deck(side, 0)) continue;
        const wx = side < 0 ? px : px + TILE - 9;
        g.fillStyle = '#6a665f'; g.fillRect(wx, py, 9, TILE); g.fillStyle = '#a7a39b'; g.fillRect(wx + 1, py, 7, 4);
        g.fillStyle = 'rgba(30,26,20,0.35)'; for (let k = 1; k < 4; k++) g.fillRect(wx, py + k * 12, 9, 1);
        if (!deck(0, 1) && tileAt(tx, ty + 1) === T.WATER) { g.fillStyle = 'rgba(30,50,70,0.4)'; g.fillRect(wx, py + TILE, 9, 6); } }
      // the arch's shadow on the water below the deck's last row
      if (!deck(0, 1) && tileAt(tx, ty + 1) === T.WATER) { g.fillStyle = 'rgba(20,40,60,0.3)'; g.fillRect(px, py + TILE, TILE, 7); }
    } });
  // reeds: a clump of green and tan blades, a brown cattail or two, swaying
  DECO.kind('reeds', { use: 'Reeds, taller than a knight\'s knee. Something rustles in them.',
    draw(g, px, py, c, tx, ty) {
      const sw = Math.sin(time * 1.6 + tx * 0.7 + ty) * 2;
      for (let k = 0; k < 7; k++) {
        const bx = px + 6 + ((tx * 13 + ty * 7 + k * 11) % 36), h = 18 + ((k * 7 + tx) % 12);
        g.strokeStyle = k % 3 ? '#5f8a3a' : '#a89a5a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(bx, py + TILE - 4); g.quadraticCurveTo(bx + sw * 0.5, py + TILE - 4 - h / 2, bx + sw, py + TILE - 4 - h); g.stroke();
        if (k % 3 === 0) { g.fillStyle = '#6a4424'; g.beginPath(); g.ellipse(bx + sw, py + TILE - 8 - h, 2.2, 5, 0, 0, 7); g.fill(); }
      }
    } });
  // standing wheat: gold stalks in rows, heads nodding
  DECO.kind('wheat', { use: "Odo's wheat, nearly ready. He cuts it himself at harvest.",
    draw(g, px, py, c, tx, ty) {
      const sw = Math.sin(time * 1.3 + tx * 0.5) * 1.6;
      for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) {
        const bx = px + 5 + k * 9 + (r % 2) * 4, by = py + 16 + r * 13;
        g.strokeStyle = '#b8963a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(bx, by + 8); g.lineTo(bx + sw, by - 6); g.stroke();
        g.fillStyle = (k + r + tx) % 3 ? '#e2b84a' : '#d0a33a'; g.beginPath(); g.ellipse(bx + sw, by - 9, 2.4, 5, 0.1, 0, 7); g.fill();
      }
    } });
  // a low hedge: a green mound with darker leaves
  DECO.kind('hedge', { use: 'A low hedge. You could step over it, but Odo would sigh.',
    draw(g, px, py, c, tx, ty) {
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(px + TILE / 2, py + TILE - 6, 22, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#3e6a2c'; g.beginPath(); g.ellipse(px + TILE / 2, py + TILE - 16, 23, 14, 0, 0, 7); g.fill();
      g.fillStyle = '#4f7f36'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(px + 8 + k * 8, py + TILE - 22 + ((k + tx) % 2) * 3, 7, 0, 7); g.fill(); }
      g.fillStyle = '#2f5222'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(px + 12 + k * 8, py + TILE - 13, 3, 0, 7); g.fill(); }
    } });
  // a drying rack: two posts, a pole, fish hanging to dry in the salt wind
  DECO.kind('rack', { use: 'Fish drying in the salt wind. Nan Gully counts them every morning.',
    draw(g, px, py, c, tx, ty) {
      const mid = px + TILE / 2, base = py + TILE - 6;
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(mid, base + 2, 20, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#6b4a2a'; g.fillRect(mid - 19, base - 32, 4, 34); g.fillRect(mid + 15, base - 32, 4, 34); g.fillRect(mid - 21, base - 33, 42, 4);
      const sw = Math.sin(time * 2 + tx) * 1.5;
      for (let k = 0; k < 4; k++) { const fx = mid - 13 + k * 9; g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(fx, base - 29); g.lineTo(fx + sw, base - 24); g.stroke();
        g.fillStyle = k % 2 ? '#b8b0a0' : '#c9a07a'; g.beginPath(); g.ellipse(fx + sw, base - 16, 3, 8, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(fx + sw, base - 9); g.lineTo(fx + sw - 3, base - 5); g.lineTo(fx + sw + 3, base - 5); g.closePath(); g.fill(); }
    } });

  // ---------- the pass (HOOKS.built: the finished land) ----------
  // out of NPCS and BUILDINGS while the earlier passes run (they keep rings clear round people and buildings, with dice)
  HOOKS.world.unshift(() => {
    for (let i = NPCS.length - 1; i >= 0; i--) if (NPCS[i].riverside) NPCS.splice(i, 1);
    for (let i = BUILDINGS.length - 1; i >= 0; i--) if (BUILDINGS[i].riverside) BUILDINGS.splice(i, 1);
  });
  const STATS = {};
  HOOKS.built.push((rnd0, api) => {
    const set = api.setTile, at = api.tileAt, rnd = mulberry32(SEED);
    const S = STATS; S.stakes = 0; S.ring = 0; S.marsh = { pools: 0, sand: 0, reeds: 0 }; S.deco = 0;
    const NATURE = new Set([T.TREE, T.OAK, T.ROCK, T.FLOWERS, T.MUSHROOM, Tn('FERN'), Tn('DEADTREE'), Tn('DEAD_TREE')].filter(v => v >= 0));
    // what a plan never paints over: ore, berry bushes, signposts, chests
    const KEEP = new Set(['IRON', 'COAL', 'BLACKIRON', 'SUNSTONE', 'STORMSTONE', 'MITHRIL', 'BERRY_BUSH', 'SIGN', 'CHEST'].map(Tn).filter(v => v >= 0));

    // 1. the stakes come up: each one's ground goes back
    const SG = window.SPREAD_GROUND;
    if (SG) for (const [i, p] of [...SG.PROPS]) if (IDS.includes(p.place)) { set(i % MAP_W, (i / MAP_W) | 0, p.under); SG.PROPS.delete(i); S.stakes++; }

    // 2. the plans
    const posts = {};
    for (const id of IDS) {
      const F = FR[id], rows = PLAN[id];
      for (let ry = 0; ry < rows.length; ry++) for (let rx = 0; rx < rows[ry].length; rx++) {
        const ch = rows[ry][rx]; if (ch === '.') continue;
        const [x, y] = F.p(rx, ry), t = at(x, y);
        if (KEEP.has(t)) continue;
        if (ch === 'g') { if (NATURE.has(t)) set(x, y, T.GRASS); }
        else if (ch === ',') set(x, y, T.DIRT);
        else if (ch === ':') set(x, y, T.SAND);
        else if (ch === '~') set(x, y, T.WATER);
        else if (ch === 'd') set(x, y, T.DOCK);
        else if (ch === 'L') set(x, y, T.LOBSTER_WATER);
        else if (ch === 's') set(x, y, T.SOIL);
        else if (ch === 'f') set(x, y, T.FENCE);
        else if (ch === 'G') set(x, y, T.GATE);
        else if (ch === 'k') set(x, y, T.STALL);
        else if (ch === 'H') { set(x, y, T.HITCH); posts[id] = { x, y }; }
        else if (ch === 'W') { set(x, y, T.SOIL); DECO.put(api, x, y, 'wheat'); S.deco++; }
        else if (ch === 'h') { if (NATURE.has(t) || t === T.DIRT) set(x, y, T.GRASS); DECO.put(api, x, y, 'hedge'); S.deco++; }
        else if (ch === 'e') { if (NATURE.has(t)) set(x, y, T.GRASS); DECO.put(api, x, y, 'reeds'); S.deco++; }
        else if (ch === 'r') { if (NATURE.has(t)) set(x, y, T.GRASS); DECO.put(api, x, y, 'rack'); S.deco++; }
        else if (ch === '=') { DECO.put(api, x, y, 'stone_bridge'); S.deco++; }
      }
    }
    Object.keys(POSTS).forEach(k => delete POSTS[k]); Object.assign(POSTS, posts);

    // 3. the mill's leat and its wheel pit: water from the river to the mill's wall (a dead end: no crossing)
    for (const b of [LEAT(), PIT()]) for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) set(x, y, T.WATER);

    // 4. the buildings, as 02-world lays its own (walls, floor, door, furniture, a clear step)
    for (const b of BLDG) {
      if (!BUILDINGS.includes(b)) BUILDINGS.push(b);
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
        const edge = x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1;
        set(x, y, edge ? T.HWALL : T.FLOOR);
      }
      if (b.door !== undefined) set(b.x + b.door, b.y + b.h - 1, T.DOOR);
      if (b.doorTop !== undefined) set(b.x + b.doorTop, b.y, T.DOOR);
      for (const [t, rx, ry] of b.f || []) set(b.x + rx, b.y + ry, t);
      const step = b.door !== undefined ? [b.x + b.door, b.y + b.h] : [b.x + b.doorTop, b.y - 1];
      if (SOLID.has(at(step[0], step[1])) && at(step[0], step[1]) !== T.WATER) set(step[0], step[1], T.DIRT);
    }

    // 5. the people
    for (const n of PEOPLE) { if (!NPCS.includes(n)) NPCS.push(n); initNpc(n); if (SOLID.has(at(n.x, n.y))) set(n.x, n.y, insideBuilding(n.x, n.y) ? T.FLOOR : T.GRASS); }

    // 6. the creatures: each where its point says, the 3 x 3 round it open (as the core clears it)
    for (const s of SPAWNS) {
      const pts = spotsOf(s), n0 = MONSTER_SPAWNS.length;
      for (const [x, y] of pts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (NATURE.has(at(x + dx, y + dy))) set(x + dx, y + dy, T.GRASS);
      api.spawnList(s.type, pts);
      for (let k = n0; k < MONSTER_SPAWNS.length; k++) MONSTER_SPAWNS[k].by = '85-riverside:' + s.place;
    }

    // 7. Saltmere's marsh band: pools, sand bars and reeds on its land side (its own dice; never on or by a road, a
    // person, a spawn or a port; a pool is one tile, so a knight always walks round it)
    const roadD = (x, y) => { let best = 99; for (const tid of A.ROAD_IDS) { const pl = A.track(tid); for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k];
      if (x < Math.min(ax, bx) - 4 || x > Math.max(ax, bx) + 4 || y < Math.min(ay, by) - 4 || y > Math.max(ay, by) + 4) continue;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } } return best; };
    const busy = new Set();
    const mark = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) busy.add(idx(x + dx, y + dy)); };
    for (const n of NPCS) mark(n.x, n.y, 1);
    for (const s of MONSTER_SPAWNS) mark(s.tx, s.ty, 1);
    for (const pid in A.PORTS) { const p = A.port(pid); if (p) mark(Math.round(p[0]), Math.round(p[1]), 1); }
    for (const b of BUILDINGS) for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) busy.add(idx(x, y));
    const others = Object.keys(A.ANCHORS).filter(id => !IDS.includes(id) && A.box(id)).map(id => A.box(id));
    const free = (x, y) => inMap(x, y) && !busy.has(idx(x, y)) && !others.some(b => x >= b[0] - 3 && x <= b[2] + 3 && y >= b[1] - 3 && y <= b[3] + 3) && roadD(x, y) > 2.5;
    { const m = MARSH();
      for (let y = m[1]; y <= m[3]; y++) for (let x = m[0]; x <= m[2]; x++) {
        const t = at(x, y), r = rnd();
        if (!free(x, y) || !(t === T.GRASS || t === T.SAND || t === T.DIRT || NATURE.has(t))) continue;
        // (a pool never touches another pool or the water: the land stays one piece)
        const wetNear = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dx, dy]) => at(x + dx, y + dy) === T.WATER);
        if (r < 0.12 && !wetNear) { set(x, y, T.WATER); S.marsh.pools++; }
        else if (r < 0.34) { set(x, y, T.SAND); S.marsh.sand++; }
        else if (r < 0.58) { if (NATURE.has(t)) set(x, y, T.GRASS); DECO.put(api, x, y, 'reeds'); S.marsh.reeds++; }
        else if (NATURE.has(t) && t !== T.FLOWERS) set(x, y, T.GRASS);
      } }

    // 8. the dressing ring: worn ground outside each box, thinning out over RING tiles (its own dice), so no place
    // starts on a ruled line
    for (const id of IDS) {
      const b = A.box(id);
      for (let y = b[1] - RING; y <= b[3] + RING; y++) for (let x = b[0] - RING; x <= b[2] + RING; x++) {
        const d = Math.max(b[0] - x, x - b[2], b[1] - y, y - b[3]); if (d < 1) continue;
        const r = rnd();
        if (!free(x, y) || at(x, y) !== T.GRASS) continue;
        // (worn most by the box, gone by four tiles out; the rest of the ring keeps its grass and verge)
        if (r < 0.22 * (1 - (d - 1) / 4)) { set(x, y, T.DIRT); S.ring++; }
      }
    }
  });

  // ---------- talking ----------
  const SAID = {};
  HOOKS.talk.riverfolk = n => { const k = SAID[n.id] = ((SAID[n.id] === undefined ? -1 : SAID[n.id]) + 1) % n.lines.length; say(n.lines[k], n.name); };
  // Tamsin grinds the knight's wheat (two sheaves to a sack of flour) before her shop opens; Nan Gully greets
  { const prev = HOOKS.talkBefore.shop;
    HOOKS.talkBefore.shop = n => {
      if (n.id === 'tamsin_miller') {
        const sheaves = countItem('wheat'), sacks = Math.floor(sheaves / 2);
        if (sacks > 0) {
          removeItem('wheat', sacks * 2); giveOrDrop('flour', sacks, player.x, player.y); burst(n.px, n.py, '#f2ecd8', 12, 50);
          say(`The wheel turns and the stones grind. ${sacks === 1 ? 'One sack' : sacks + ' sacks'} of flour for you. Two sheaves make a sack.`, n.name); save();
        } else say(sheaves === 1 ? 'One sheaf? Bring me two and the wheel makes you a sack of flour.' : 'Bring me wheat and my wheel grinds it to flour, two sheaves to a sack. Or buy a sack from me.', n.name);
        openPanel('shop', n.shop); return true;
      }
      if (n.id === 'nan_gully') { say('Fresh off the jetty! Shrimp, trout, lobster: I pay full price for every one. Rods and pots too.', n.name); openPanel('shop', n.shop); return true; }
      return prev ? prev(n) : false;
    }; }

  // ---------- drawing: the mill wheel, the stilts, the fishing rings ----------
  HOOKS.draw.push((g, items) => {
    if (window.__instance) return;
    const vis = (x, y, r) => x + r > cam.x && x - r < cam.x + VW && y + r > cam.y && y - r < cam.y + VH;
    // the wheel: a timber wheel turning in its pit, paddles dipping into the leat
    // (drawn after the mill, which it stands beside: sorted at the mill's foot)
    { const [wx, wy] = WHEEL(), cx = (wx + 0.62) * TILE, cy = (wy + 0.5) * TILE, R = TILE * 1.0, foot = MB.y(5) * TILE;
      if (vis(cx, cy, R + 10)) items.push({ y: foot, draw: () => {
        const a = time * 0.9;
        g.save(); g.translate(cx, cy);
        g.fillStyle = 'rgba(20,40,60,0.35)'; g.beginPath(); g.ellipse(0, R * 0.55, R * 0.7, 6, 0, 0, 7); g.fill();
        g.strokeStyle = '#4a3220'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, R * 0.82, 0, 7); g.stroke();
        g.strokeStyle = '#6b4a2a'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R * 0.82, 0, 7); g.stroke();
        for (let k = 0; k < 8; k++) { const t = a + k * Math.PI / 4, c = Math.cos(t), s = Math.sin(t);
          g.strokeStyle = '#5a3c22'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(c * R * 0.82, s * R * 0.82); g.stroke();
          g.save(); g.translate(c * R * 0.9, s * R * 0.9); g.rotate(t); g.fillStyle = '#7a5434'; g.fillRect(-4, -7, 8, 14); g.restore(); }
        g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); g.fillStyle = '#8f96a3'; g.beginPath(); g.arc(0, 0, 2.5, 0, 7); g.fill();
        // spray where the paddles meet the water
        g.fillStyle = 'rgba(220,240,255,0.6)'; for (let k = 0; k < 4; k++) { const sx = Math.sin(time * 5 + k * 1.7) * R * 0.5, sy = R * 0.62 + Math.cos(time * 4 + k) * 2; g.beginPath(); g.arc(sx, sy, 2 + (k % 2), 0, 7); g.fill(); }
        g.restore();
      } }); }
    // stilts: posts under each hut, standing in the water
    for (const b of BLDG) { if (!b.stilts) continue;
      const x = b.x * TILE, y = (b.y + b.h) * TILE, w = b.w * TILE; if (!vis(x + w / 2, y, w)) continue;
      items.push({ y: y - 2, draw: () => {
        for (const fx of [0.12, 0.5, 0.88]) { const sx = x + w * fx - 3;
          g.fillStyle = '#4a3220'; g.fillRect(sx, y - 6, 6, 18); g.fillStyle = 'rgba(200,230,255,0.35)'; g.fillRect(sx - 3, y + 11, 12, 2); }
      } }); }
    // fishing spots: rings spreading on the water
    for (const [fx, fy] of FISH()) { const cx = (fx + 0.5) * TILE, cy = (fy + 0.5) * TILE; if (!vis(cx, cy, TILE)) continue;
      items.push({ y: -1e9 + 3, draw: () => {
        for (let k = 0; k < 2; k++) { const p = (time * 0.6 + k * 0.5 + fx * 0.13) % 1; g.strokeStyle = `rgba(230,245,255,${0.55 * (1 - p)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy, 6 + p * 16, 3 + p * 7, 0, 0, 7); g.stroke(); }
      } }); }
  });

  // ---------- the handle ----------
  window.RIVERSIDE = { IDS, PLAN, BLDG, PEOPLE, SPAWNS, spotsOf, POSTS, STATS, LEAT, PIT, WHEEL, FISH, MARSH, FOOT, FR };

  // ---------- self-tests ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'riverside: ', tiles = window.PLAYTHROUGH ? PLAYTHROUGH.pristine : map;
    const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
    const roadD = (x, y, ids) => { let b = Infinity; for (const id of ids) { const pl = A.track(id); for (let k = 1; k < pl.length; k++) b = Math.min(b, segD(x, y, pl[k - 1][0], pl[k - 1][1], pl[k][0], pl[k][1])); } return b; };
    const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

    // 1. built: no stake or plaque of theirs left, each region its own line, WORLD_REV 2 with the footprint
    { const left = window.SPREAD_GROUND ? [...SPREAD_GROUND.PROPS.values()].filter(p => IDS.includes(p.place)).length : -1;
      const regs = IDS.map(id => REGIONS.find(r => r.atlas === id));
      const subs = regs.every((r, k) => r && r.sub === A.BUILT.get(IDS[k]).sub && !/staked/.test(r.sub));
      const R = A.REVS && A.REVS[2], foot = R && IDS.every(id => R.boxes.some(b => { const q = A.box(id); return b[0] <= q[0] - RING && b[1] <= q[1] - RING && b[2] >= q[2] + RING && b[3] >= q[3] + RING; }));
      check(P + "the Old Bridge, Millbrook and Saltmere are built: their builders' stakes and plaques are gone, each region names the place, and WORLD_REV 2 declares each box with its 6-tile ring (and the leat and the marsh) as its footprint",
        left === 0 && STATS.stakes > 0 && subs && WORLD_REV >= 2 && !!foot && IDS.every(id => A.isBuilt(id)), { left, stakes: STATS.stakes, subs: regs.map(r => r && r.sub), WORLD_REV }); }

    // 2. the Old Bridge is stone, three wide, and the only crossing here; Stage 4's planks are gone
    { const deck = DECO.cells('stone_bridge'), b = A.box('old_bridge'), BR = Tn('BRIDGE');
      let planks = 0; for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) if (tiles[idx(x, y)] === BR) planks++;
      const cols = new Set(deck.map(([x]) => x)), [sx, sy] = A.port('old_bridge.span');
      const near = deck.every(([x, y]) => Math.hypot(x - sx, y - sy) <= 3);
      check(P + "the Old Bridge is stone: the Long Road crosses on DECO 'stone_bridge' cells three wide by the span, and no plank tile is left in its box",
        deck.length >= 6 && cols.size === 3 && near && planks === 0 && deck.every(([x, y]) => DECO.isBridge(idx(x, y)) && !SOLID.has(tiles[idx(x, y)])), { deck, planks }); }

    // 3. the people: on walkable ground in their own place (the Atlas zone is the place), reached from the cave mouth,
    // in the townsfolk look, and each one talks
    { const N = MAP_W * MAP_H, seen = new Uint8Array(N), q = new Int32Array(N); let n = 0;
      const pass = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || t === Tn('WARDEN_GATE') || t === Tn('LAIR_GATE');
      const take = i => { if (!seen[i] && pass(tiles[i])) { seen[i] = 1; q[n++] = i; } };
      const [mx, my] = A.port('cave.mouth'); take(idx(mx, my));
      for (let k = 0; k < n; k++) { const c = q[k], x = c % MAP_W; if (x > 0) take(c - 1); if (x < MAP_W - 1) take(c + 1); if (c >= MAP_W) take(c - MAP_W); if (c + MAP_W < N) take(c + MAP_W); }
      const reach = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[idx(x + dx, y + dy)]);
      const bad = [];
      for (const p of PEOPLE) {
        const zone = A.zoneAt('over', p.x, p.y), id = IDS.find(i => inB(A.box(i), p.x, p.y));
        if (!NPCS.includes(p)) bad.push(p.id + ' not in NPCS');
        if (SOLID.has(tileAt(p.x, p.y))) bad.push(p.id + ' on ' + tileName(tileAt(p.x, p.y)));
        if (!reach(p.x, p.y)) bad.push(p.id + ' not reached from the cave');
        if (!id || zone !== id) bad.push(p.id + ' zone ' + zone);
        if (!TOWNSFOLK_ART.NEW_NPC[p.id]) bad.push(p.id + ' has no look');
      }
      // the spawns and the rails are reached too
      for (const s of SPAWNS) for (const [x, y] of spotsOf(s)) if (!reach(x, y)) bad.push(s.type + '@' + x + ',' + y + ' not reached');
      for (const id of IDS) { const p = POSTS[id]; if (!p || tileAt(p.x, p.y) !== T.HITCH || !reach(p.x, p.y)) bad.push(id + ' rail'); }
      check(P + "Wilf, Tamsin, Odo and Nan Gully stand on open ground in their own places (the Atlas zone is the place), each in the townsfolk look; a knight walks to each of them, to every new creature and to every rail from the cave mouth", !bad.length, { bad }); }

    // 4. they talk: plain words, and the shops open
    { const said = {}, panels = {};
      for (const p of PEOPLE) { dialog.queue.length = 0; advanceDialog(); closePanel(); talkTo(p); const d = [dialog.cur, ...dialog.queue].find(q => q && q.who === p.name); said[p.id] = d ? d.text : null; panels[p.id] = panel === 'shop' ? panelArg : null; closePanel(); dialog.queue.length = 0; advanceDialog(); }
      const long = Object.entries(said).filter(([, t]) => !t || t.length > 140).map(([k]) => k);
      check(P + 'each of them talks when spoken to (Wilf and Odo tell their stories a line at a time; Tamsin and Nan Gully open their shops), every line short and plain',
        !long.length && panels.tamsin_miller === 'mill' && panels.nan_gully === 'saltmere_fish' && !panels.wilf && !panels.odo && LINES.wilf.concat(LINES.odo).every(t => t.length <= 140 && !/\b(north|south|east|west)\b/i.test(t)), { said, panels, long }); }

    // 5. the services: Tamsin turns 5 wheat into 2 sacks of flour (1 left over); Nan Gully pays full price for fish
    { const keep = { inv: JSON.parse(JSON.stringify(player.inv)), coins: coins() };
      let res = {};
      try {
        player.inv = new Array(INV_SLOTS).fill(null); addItem('wheat', 5); addItem('raw_trout', 1); addItem('coins', 100);
        const tam = PEOPLE.find(p => p.id === 'tamsin_miller'), nan = PEOPLE.find(p => p.id === 'nan_gully');
        talkTo(tam); res.flour = countItem('flour'); res.wheat = countItem('wheat'); closePanel(); dialog.queue.length = 0; advanceDialog();
        const c0 = coins(); const shop = SHOPS.saltmere_fish, slot = player.inv.findIndex(s => s && s.id === 'raw_trout');
        res.buys = shop.buys.includes('raw_trout') && shop.rate === 1; res.troutValue = ITEMS.raw_trout.value;
        // (the panel's sell is the core's: full price when the shop names the item in buys)
        talkTo(nan); res.open = panel === 'shop' && panelArg === 'saltmere_fish'; closePanel(); dialog.queue.length = 0; advanceDialog();
        res.coins = c0; res.slot = slot;
        res.stock = ['fishing_rod', 'lobster_pot', 'shrimp', 'trout'].every(id => shop.stock.some(([k]) => k === id)) && SHOPS.mill.stock.some(([k]) => k === 'flour');
      } finally { player.inv = keep.inv; }
      check(P + "Tamsin grinds a knight's wheat: 5 sheaves make 2 sacks of flour with 1 sheaf left; her mill sells flour, seed and bread; Nan Gully's stall sells rods, lobster pots, shrimp and trout and buys every fish at full price",
        res.flour === 2 && res.wheat === 1 && res.buys && res.open && res.stock, res); }

    // 6. the creatures: in their own places at their levels, 6+ tiles off the main roads, none moved by the door rule
    { const ours = MONSTER_SPAWNS.filter(s => typeof s.by === 'string' && s.by.indexOf('85-riverside:') === 0), bad = [];
      for (const s of ours) {
        const place = s.by.split(':')[1], b = A.box(place);
        if (!inB(b, s.tx, s.ty)) bad.push(s.type + '@' + s.tx + ',' + s.ty + ' outside ' + place);
        if (s.movedFrom) bad.push(s.type + ' moved from ' + s.movedFrom);
        if (s.type !== 'sheep' && roadD(s.tx, s.ty, A.MAIN_ROADS) < 6) bad.push(s.type + '@' + s.tx + ',' + s.ty + ' ' + roadD(s.tx, s.ty, A.MAIN_ROADS).toFixed(1) + ' off a main road');
        if (SOLID.has(tiles[idx(s.tx, s.ty)])) bad.push(s.type + '@' + s.tx + ',' + s.ty + ' on ' + tileName(tiles[idx(s.tx, s.ty)]));
      }
      const by = (place, type) => ours.filter(s => s.by === '85-riverside:' + place && s.type === type).length;
      const lv = MONSTER_DEFS;
      const reeds = ours.filter(s => s.by === '85-riverside:old_bridge').every(s => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (tiles[idx(s.tx + dx, s.ty + dy)] === T.WATER) return true; return false; });
      const jetty = ours.filter(s => s.by === '85-riverside:saltmere').every(s => tiles[idx(s.tx, s.ty)] === T.DOCK);
      check(P + 'the creatures: snakes (lv 4) and an adder (lv 6) by the Old Bridge\'s water, crows (lv 2) in Millbrook\'s wheat, giant rats (lv 3) by its barn and on Saltmere\'s jetty, sheep in the paddock; each inside its place, none moved, 6+ tiles off every main road',
        !bad.length && reeds && jetty && by('old_bridge', 'snake') === 2 && by('old_bridge', 'adder') === 1 && by('millbrook', 'crow') === 3 && by('millbrook', 'giant_rat') === 2 && by('saltmere', 'giant_rat') === 2 && by('millbrook', 'sheep') === 2 &&
        lv.snake.level === 4 && lv.adder.level === 6 && lv.crow.level === 2 && lv.giant_rat.level === 3, { bad, n: ours.length, reeds, jetty }); }

    // 7. Millbrook's mill: the wheel's pit and its leat are water joined to the river, and a dead end (no new crossing);
    // its wheat stands on soil and a plot of soil is anyone's; Saltmere has its five stilt huts, a jetty two wide with
    // lobster grounds off its end, racks and its marsh band
    { const leat = LEAT(), pit = PIT(); let dry = 0; for (const b of [leat, pit]) for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) if (tiles[idx(x, y)] !== T.WATER) dry++;
      const joins = tiles[idx(leat[2] + 1, leat[1])] === T.WATER;
      const wheat = DECO.cells('wheat'), onSoil = wheat.every(([x, y]) => DECO.at(x, y).under === T.SOIL);
      let soil = 0; { const rows = PLAN.millbrook; rows.forEach((r, ry) => [...r].forEach((c, rx) => { if (c === 's') { const [x, y] = MB.p(rx, ry); if (tiles[idx(x, y)] === T.SOIL) soil++; } })); }
      const huts = BUILDINGS.filter(b => b.riverside && b.stilts).length;
      let dock = 0, lob = 0; { const rows = PLAN.saltmere; rows.forEach((r, ry) => [...r].forEach((c, rx) => { const [x, y] = SM.p(rx, ry); if (c === 'd' && tiles[idx(x, y)] === T.DOCK) dock++; if (c === 'L' && tiles[idx(x, y)] === T.LOBSTER_WATER) lob++; })); }
      const M = STATS.marsh;
      check(P + "Millbrook's wheel turns in a pit fed by a leat from the river (a dead end), its wheat stands on soil and a plot of soil waits for anyone; Saltmere has five stilt huts, a plank jetty two wide with lobster grounds off its end, drying racks, and a marsh band of pools, sand bars and reeds",
        dry === 0 && joins && wheat.length === 21 && onSoil && soil === 8 && huts === 5 && dock >= 30 && lob === 4 && DECO.cells('rack').length === 4 && M.pools > 0 && M.sand > 0 && M.reeds > 0, { dry, joins, wheat: wheat.length, soil, huts, dock, lob, marsh: M }); }

    // 8. the rails: each place's rail is in RAILS, on a HITCH tile in its own box, and the mare bolts to the nearest visited
    { const ok = IDS.every(id => { const r = RAILS.find(q => q.id === id), p = r && r.at(); return !!p && inB(A.box(id), p.x, p.y) && tileAt(p.x, p.y) === T.HITCH && RAILS.of(p.x, p.y) === r && !r.reserved; });
      check(P + 'each place has its hitching rail: a RAILS entry, its post on a HITCH tile in its own box', ok, { posts: POSTS }); }

    // 9. its signposts name the places, with no "builders at work" left on them; nothing built here stands on a main road
    { const words = [A.port('old_bridge.south'), A.port('millbrook.gate')].map(([x, y]) => { const s = window.SPREAD_GROUND && SPREAD_GROUND.signs.find(q => q[2] === Math.round(x) && q[3] === Math.round(y)); return s ? A.signText(s[0], s[1]) : null; });
      const anyBuilders = SPREAD_GROUND.signs.map(([x, y]) => A.signText(x, y)).filter(t => /(Old Bridge|Millbrook|Saltmere) \(builders at work\)/.test(t));
      const onRoad = []; for (const b of BLDG) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (A.onMainRoad(x, y)) onRoad.push(b.id);
      for (const id of IDS) { const rows = PLAN[id]; rows.forEach((r, ry) => [...r].forEach((c, rx) => { const [x, y] = FR[id].p(rx, ry); if (/[fGHkL~]/.test(c) && A.onMainRoad(x, y)) onRoad.push(id + ' ' + c + '@' + x + ',' + y); })); }
      check(P + "the signposts at the Old Bridge's south end and Millbrook's gate read, no signpost says the riverside's builders are still at work, and nothing built here stands on a main road",
        words.every(Boolean) && !anyBuilders.length && !onRoad.length, { words, anyBuilders, onRoad }); }

    // 10. the ground: no change outside the footprint boxes and their ring (the FOOTPRINT proof's own words, here as the
    // places say it), and placing in a built place says whose ground it is
    { const traps = () => countItem('goblin_trap'); h.give('goblin_trap', 2); h.peace(true);
      const [x, y] = MB.p(13, 5); F.tp(x, y + 1); player.facing = { x: 0, y: -1 }; notice = null; const n0 = traps(); placeAction('goblin_trap');
      const res = { placed: traps() < n0, notice: notice && notice.text }; if (res.placed && tileAt(x, y) === T.TRAP) changeTile(x, y, T.DIRT);
      h.peace(false);
      check(P + "nothing is built on a built place's ground: \"This is Millbrook's ground. Build somewhere else.\"", !res.placed && res.notice === "This is Millbrook's ground. Build somewhere else.", res); }
  });
}
