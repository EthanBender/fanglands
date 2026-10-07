// ============================================================================
// THE CROSSROADS INN (the Great Spread, Stage 5c: ~/.fanglands/work/spread/spec.md §4 "New places", §6, §13 STAGE 5)
// src/84-crossroads.js
//
// Where the Long Road, the Ash Road and the Drovers' Track meet, south of the Old Bridge (93-spread staked it in Stage 4):
//
//   THE INN          'xinn', 12 x 8 and two rooms, on the south side of the junction with its door facing the signpost:
//                    the common room (Mother Hobb's counter, her oven, two tables) and, through a doorway, the back room
//                    with three beds. Mother Hobb the cook: five coins buys a bowl of stew (her hands heal a knight to full)
//                    and the room, and a bed in it then holds his spirit, like the Barrel & Boar's (Dorran's flag is
//                    innRested; hers is player.xinnRested). Her kitchen sells pies, bread, potatoes and beef.
//   THE YARD         a stable yard beside the inn, fenced on its far sides: a hitching rail (RAILS), a trough, a well,
//                    hay bales; the inn's notice board stands at its corner by the road (nothing pinned yet: the Bandit
//                    Toll's notice goes up there in Stage 5f, CROSSROADS.notices).
//   THE JUNCTION     the clearing round the four roads; the four-way signpost (Stage 4's, at the yard port) shows all
//                    four arms. Two travellers wander here: Jory the pedlar and Marigold the drover.
//   No spawns inside.
//
// The inn stands south of the roads, so it runs five rows past the staked box (152..168 x 116..128: the roads cross the
// box's middle and leave three free rows under them). The place's REGIONS line is grown to cover it (BOX below) on the
// finished land only, in this file's HOOKS.built pass, and put back at the start of every world, the way its people and
// buildings are: every earlier pass sees the region it saw before, and the banner, the Atlas zone and the map say "The
// Crossroads Inn" over the whole inn. The anchor (A.box) stays the staked box.
//
// WHERE: every point in the place's own frame (ATLAS.planFrame('crossroads_inn'): offsets from the staked box's top-left).
// WHEN: on the finished land (HOOKS.built), as 85-riverside does. Its dice are its own (mulberry32 of its name).
// The well, the trough and the notice board are solid things a knight walks round, so they cannot be DECO (open ground)
// or Stage 4's PROP (the stakes, walkable): each stands on 95-thistledown's TD_PROP tile (solid, and nothing outside
// Thistledown's own plan: its kinds live in the town's table) with its kind in this file's side table (THINGS), drawn and
// read here. Stage 5 still spends only DECO; the hay is DECO.
// Feature file: registers through HOOKS. window.CROSSROADS is the test handle.
// ============================================================================
{
  const A = ATLAS, Tn = n => (n in T ? T[n] : -1), ID = 'crossroads_inn';
  // built: 93-spread (which loads later) names the region for the place, and its signpost shows all four roads
  const F = A.planFrame(ID), RING = 6;
  // (box: the ground it holds past its stakes, which placeAction keeps too; arms: its signpost shows all four roads)
  A.markBuilt(ID, { sub: 'Four roads, a hot supper and a bed', arms: 4, box: F.box([0, 0, 16, 18]) });
  const SEED = (() => { let h = 2166136261; for (const c of '84-crossroads') h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; })();
  // the place as built: the staked box, grown south over the inn and its yard (the frame's own offsets)
  const BOX = () => A.BUILT.get(ID).box.slice(), STAKED = () => A.box(ID);

  // ---------- the plan: one glyph a tile, rows from the staked box's top-left ----------
  //   .  as the land is (the inn's own cells: the building lays them)
  //   g  open grass (trees, rocks, flowers and mushrooms go; ore, berry bushes and the signpost stay)
  //   ,  worn dirt      f  fence      H  the hitching rail      a  hay (DECO)
  //   w  the well       q  the trough      n  the notice board   (each solid: a TD_PROP cell in THINGS)
  const PLAN = [
    'ggggggggggggggggg',
    'ggggggggggggggggg',
    'ggggggggggggggggg',
    'ggggggggggggggggg',
    'ggggggggggggggggg',
    'ggggggggggggggggg',
    'ggggggggggggggggg',
    'ggggggggggggggggg',
    'ggggggggggggggggg',
    'ggggggggggggggggg',
    '............n,Hq,',
    '............,,,,f',
    '............,,,,f',
    '............,,w,f',
    '............,,,,f',
    '............,,,,f',
    '............a,,af',
    '............fffff',
    'ggggggggggggggggg',
  ];

  // ---------- the inn (a BUILDINGS row): two rooms with a doorway between ----------
  // the common room east (the door from the road, Mother Hobb's counter and oven, two tables); the back room west (three
  // beds, a rug, a shelf); the partition a wall of the building's own with a gap
  const WALL = [1, 2, 3, 5, 6].map(ry => [T.HWALL, 5, ry]);
  const INN = Object.assign(F.pt({ id: 'xinn', x: 0, y: 10, w: 12, h: 8, name: 'The Crossroads Inn', roof: '#7a4a2e', sign: 'INN', doorTop: 9,
    f: [...WALL, [T.RUG, 5, 4],
      [T.BED, 1, 1], [T.BED, 1, 3], [T.BED, 1, 6], [T.SHELF, 4, 1], [T.RUG, 3, 4], [T.TABLE, 4, 6],
      [T.SHELF, 6, 1], [T.COUNTER, 6, 2], [T.COUNTER, 7, 2], [T.OVEN, 10, 1], [T.TABLE, 9, 4], [T.TABLE, 9, 6], [T.TABLE, 6, 6]] }),
  { crossroads: true, inn: { flag: 'xinnRested', keeper: 'Mother Hobb' } });

  // ---------- the people (NPCS rows; each id is a look in 83-townsart's 'crossroads' family) ----------
  const LINES = {
    jory: [
      "Four roads meet here, so everybody passes Mother Hobb's door sooner or later. Me, every week.",
      'I carry needles, buttons and news. The news is free.',
      "The old road past the stone circle goes to the Fang's lair. I don't walk that one. Nobody sensible does.",
      "Hollowford burned, but its people came back. They're building again. Go and see.",
      "Lost? Read the signpost. It's never wrong. I am, sometimes.",
    ],
    marigold: [
      "I used to walk my cows down the Drovers' Track. Then the goblins built a camp right across it.",
      "Goblins don't even want the cows. They want the bells. Shiny, you see.",
      'My cows are safe in a field by Hollowford now. I miss walking them.',
      "If you ever chase those goblins off my track, I'll sing about you. Loudly.",
      "Mother Hobb's pie is the best thing on any road. Don't tell the baker in Thistledown.",
    ],
  };
  const PEOPLE = [
    F.pt({ id: 'mother_hobb', name: 'Mother Hobb', x: 7, y: 13, tunic: '#a0522d', hair: '#d8d0c4', woman: true, apron: true, role: 'shop', shop: 'xinn_kitchen' }),
    F.pt({ id: 'jory', name: 'Jory the pedlar', x: 10, y: 2, tunic: '#6a5a8a', hair: '#7a4a24', wander: true, role: 'wayfarer', lines: LINES.jory }),
    F.pt({ id: 'marigold', name: 'Marigold the drover', x: 13, y: 14, tunic: '#7a8a4a', hair: '#c9843a', woman: true, wander: true, role: 'wayfarer', lines: LINES.marigold }),
  ].map(n => Object.assign(n, { crossroads: true }));

  // ---------- the footprint (§10): WORLD_REV 3 ----------
  const grow = (b, d) => [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
  const FOOT = () => [grow(BOX(), RING)];
  if (A.REVS) A.REVS[3] = { stage: '5c', by: '84-crossroads', why: 'the Crossroads Inn: its box grown over the inn and the yard, with its dressing ring', boxes: FOOT() };

  // ---------- the kitchen ----------
  SHOPS.xinn_kitchen = { name: "Mother Hobb's Kitchen", stock: [['meat_pie', 25], ['bread', 8], ['baked_potato', 6], ['cooked_beef', 12]] };

  // ---------- the rail ----------
  const POSTS = {};
  if (window.RAILS) RAILS.add({ id: ID, place: 'the rail at the Crossroads Inn', at: () => POSTS.rail || null });

  // ---------- the notice board: kept for the Bandit Toll (86-bandits pins its notice here) ----------
  const NOTICES = [];
  const boardWords = () => NOTICES.length ? NOTICES.map(n => typeof n === 'function' ? n() : n).filter(Boolean).join('   ')
    : "The inn's notice board. Nothing is pinned to it yet. Travellers leave news here when there is any.";

  // ---------- the solid things: idx -> { kind, under } on TD_PROP cells (made in the built pass, emptied each world) ----------
  const THINGS = new Map(), PK = {};
  const SOLID_T = () => Tn('TD_PROP');
  const shadow = (g, cx, y, rx) => { g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx, y, rx, rx * 0.28, 0, 0, 7); g.fill(); };
  // a stone well: a round wall of grey stones, dark water, two posts, a little shingle roof and a bucket on its rope
  PK.well = { use: 'The well at the Crossroads Inn. The water is cold and sweet. Horses love it.',
    draw(g, px, py) {
      const cx = px + TILE / 2, base = py + TILE - 6;
      shadow(g, cx, base + 2, 20);
      g.fillStyle = '#7d7a74'; g.beginPath(); g.ellipse(cx, base - 8, 18, 10, 0, 0, 7); g.fill();
      g.fillStyle = '#8f8b84'; g.fillRect(cx - 18, base - 18, 36, 10);
      g.fillStyle = '#9c9890'; for (let k = 0; k < 5; k++) { g.fillRect(cx - 17 + k * 7, base - 17 + (k % 2) * 4, 6, 4); }
      g.fillStyle = '#9c9890'; g.beginPath(); g.ellipse(cx, base - 18, 18, 9, 0, 0, 7); g.fill();
      g.fillStyle = '#1e2c38'; g.beginPath(); g.ellipse(cx, base - 18, 13, 6, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(140,190,230,0.35)'; g.beginPath(); g.ellipse(cx - 3, base - 19, 5, 1.6, 0, 0, 7); g.fill();
      g.fillStyle = '#6b4a2a'; g.fillRect(cx - 17, base - 44, 4, 28); g.fillRect(cx + 13, base - 44, 4, 28); g.fillRect(cx - 17, base - 42, 34, 3);
      g.fillStyle = '#8a3a2a'; g.beginPath(); g.moveTo(cx - 23, base - 40); g.lineTo(cx, base - 54); g.lineTo(cx + 23, base - 40); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,20,10,0.4)'; g.lineWidth = 1; g.stroke();
      const sw = Math.sin(time * 1.4 + px) * 1.2;
      g.strokeStyle = '#c9b07a'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, base - 41); g.lineTo(cx + sw, base - 30); g.stroke();
      g.fillStyle = '#7a5434'; g.fillRect(cx - 4 + sw, base - 30, 8, 7); g.fillStyle = '#4a3220'; g.fillRect(cx - 4 + sw, base - 30, 8, 2);
    } };
  // a long wooden trough of water, the boards dark where it splashes
  PK.trough = { use: 'A horse trough, full to the brim. Your horse will drink here.',
    draw(g, px, py) {
      const cx = px + TILE / 2, base = py + TILE - 8;
      shadow(g, cx, base + 3, 21);
      g.fillStyle = '#5a3c22'; g.fillRect(cx - 21, base - 14, 42, 15);
      g.fillStyle = '#7a5434'; g.fillRect(cx - 21, base - 14, 42, 4);
      g.fillStyle = '#3a6a8a'; g.fillRect(cx - 18, base - 13, 36, 3);
      g.fillStyle = `rgba(200,230,255,${0.35 + 0.2 * Math.sin(time * 2 + px)})`; g.fillRect(cx - 12, base - 13, 9, 1);
      g.fillStyle = '#4a3220'; for (const s of [-1, 1]) g.fillRect(cx + s * 19 - 2, base - 2, 4, 4);
      g.strokeStyle = 'rgba(30,20,10,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 21, base - 6); g.lineTo(cx + 21, base - 6); g.stroke();
    } };
  // the notice board: a roofed board on two posts; a paper for each notice, or bare wood
  PK.board = { use: () => boardWords(), say: 'Notice board',
    draw(g, px, py) {
      const cx = px + TILE / 2, base = py + TILE - 6;
      shadow(g, cx, base + 2, 17);
      g.fillStyle = '#5a3c22'; g.fillRect(cx - 15, base - 34, 4, 36); g.fillRect(cx + 11, base - 34, 4, 36);
      g.fillStyle = '#b08a58'; g.fillRect(cx - 18, base - 40, 36, 22);
      g.strokeStyle = '#5a3c22'; g.lineWidth = 2; g.strokeRect(cx - 18, base - 40, 36, 22);
      g.fillStyle = '#6a3a24'; g.beginPath(); g.moveTo(cx - 22, base - 40); g.lineTo(cx, base - 49); g.lineTo(cx + 22, base - 40); g.closePath(); g.fill();
      g.fillStyle = '#4a2e13'; g.font = 'bold 6px sans-serif'; g.textAlign = 'center'; g.fillText('NOTICES', cx, base - 33);
      for (let k = 0; k < Math.min(3, NOTICES.length); k++) { g.fillStyle = '#efe6cf'; g.fillRect(cx - 14 + k * 10, base - 30 + (k % 2), 8, 10); g.fillStyle = '#b8352b'; g.fillRect(cx - 11 + k * 10, base - 30 + (k % 2), 2, 2); }
    } };

  // ---------- DECO: hay bales in the yard ----------
  DECO.kind('hay', { use: 'Hay for the horses. It smells like summer.',
    draw(g, px, py, c, tx, ty) {
      const cx = px + TILE / 2, base = py + TILE - 8;
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(cx, base + 3, 18, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#c9b07a'; g.fillRect(cx - 17, base - 14, 34, 16);
      g.fillStyle = '#ddc68e'; g.fillRect(cx - 17, base - 14, 34, 4);
      g.strokeStyle = '#9c854f'; g.lineWidth = 1.5; for (const ox of [-8, 8]) { g.beginPath(); g.moveTo(cx + ox, base - 14); g.lineTo(cx + ox, base + 2); g.stroke(); }
      g.strokeStyle = 'rgba(150,120,60,0.6)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { const sx = px + 10 + ((k * 9 + (tx % 5) * 7) % 28); g.beginPath(); g.moveTo(sx, base - 15); g.lineTo(sx + 2, base - 19); g.stroke(); }
    } });

  // ---------- the pass (HOOKS.built: the finished land) ----------
  const reg = () => REGIONS.find(q => q.atlas === ID);
  const unGrow = () => { const r = reg(), s = STAKED(); if (r) { r.x0 = s[0]; r.y0 = s[1]; r.x1 = s[2]; r.y1 = s[3]; } };
  // out of NPCS and BUILDINGS, and the region back to its staked box, BEFORE a world is made: the core's own generation
  // (ahead of every HOOKS.world pass) lays every BUILDINGS row and reads regionAt, and the passes after it keep rings clear
  // round people and buildings with the shared dice; an inn laid early there re-rolls ground all over the map
  const unBuild = () => {
    THINGS.clear();
    for (let i = NPCS.length - 1; i >= 0; i--) if (NPCS[i].crossroads) NPCS.splice(i, 1);
    for (let i = BUILDINGS.length - 1; i >= 0; i--) if (BUILDINGS[i].crossroads) BUILDINGS.splice(i, 1);
    unGrow();
  };
  { const _generateWorld = generateWorld; generateWorld = function () { unBuild(); return _generateWorld.apply(this, arguments); }; }
  HOOKS.world.unshift(unBuild);
  const STATS = {};
  HOOKS.built.push((rnd0, api) => {
    const set = api.setTile, at = api.tileAt, rnd = mulberry32(SEED);
    const S = STATS; S.stakes = 0; S.ring = 0; S.deco = 0; S.props = 0; S.cleared = 0;
    const NATURE = new Set([T.TREE, T.OAK, T.ROCK, T.FLOWERS, T.MUSHROOM, Tn('FERN'), Tn('DEADTREE'), Tn('DEAD_TREE')].filter(v => v >= 0));
    // what a plan never paints over: ore, berry bushes, signposts, chests
    const KEEP = new Set(['IRON', 'COAL', 'BLACKIRON', 'SUNSTONE', 'STORMSTONE', 'MITHRIL', 'BERRY_BUSH', 'SIGN', 'CHEST'].map(Tn).filter(v => v >= 0));
    const SG = window.SPREAD_GROUND;

    // 1. the stakes come up: each one's ground goes back
    if (SG) for (const [i, p] of [...SG.PROPS]) if (p.place === ID) { set(i % MAP_W, (i / MAP_W) | 0, p.under); SG.PROPS.delete(i); S.stakes++; }

    // 2. the region grows over the inn (the earlier passes are done; the Atlas, the banner and the map read it from here)
    { const r = reg(), b = BOX(); if (r) { r.x0 = b[0]; r.y0 = b[1]; r.x1 = b[2]; r.y1 = b[3]; } }

    // 3. the plan
    POSTS.rail = null;
    const thing = (x, y, kind) => { const t = SOLID_T(); if (t < 0) return; THINGS.set(idx(x, y), { kind, under: at(x, y) }); set(x, y, t); S.props++; };
    for (let ry = 0; ry < PLAN.length; ry++) for (let rx = 0; rx < PLAN[ry].length; rx++) {
      const ch = PLAN[ry][rx]; if (ch === '.') continue;
      const [x, y] = F.p(rx, ry), t = at(x, y);
      if (KEEP.has(t)) continue;
      if (ch === 'g') { if (NATURE.has(t)) { set(x, y, T.GRASS); S.cleared++; } }
      else if (ch === ',') set(x, y, T.DIRT);
      else if (ch === 'f') set(x, y, T.FENCE);
      else if (ch === 'H') { set(x, y, T.HITCH); POSTS.rail = { x, y }; }
      else if (ch === 'a') { set(x, y, T.DIRT); DECO.put(api, x, y, 'hay'); S.deco++; }
      else if (ch === 'w') { set(x, y, T.DIRT); thing(x, y, 'well'); }
      else if (ch === 'q') { set(x, y, T.DIRT); thing(x, y, 'trough'); }
      else if (ch === 'n') { set(x, y, T.DIRT); thing(x, y, 'board'); }
    }

    // 4. the inn, as 02-world lays its own (walls, floor, door, furniture, a clear step)
    { const b = INN;
      if (!BUILDINGS.includes(b)) BUILDINGS.push(b);
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
        const edge = x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1;
        set(x, y, edge ? T.HWALL : T.FLOOR);
      }
      set(b.x + b.doorTop, b.y, T.DOOR);
      for (const [t, rx, ry] of b.f) set(b.x + rx, b.y + ry, t);
      const [sx, sy] = [b.x + b.doorTop, b.y - 1];
      if (SOLID.has(at(sx, sy))) set(sx, sy, T.DIRT); }

    // 5. the people
    for (const n of PEOPLE) { if (!NPCS.includes(n)) NPCS.push(n); initNpc(n); if (SOLID.has(at(n.x, n.y))) set(n.x, n.y, insideBuilding(n.x, n.y) ? T.FLOOR : T.GRASS); }

    // 6. the dressing ring: worn ground outside the box, thinning out over RING tiles (its own dice), never on a road's
    // lanes, a person, a building or another place's box
    const roadD = (x, y) => { let best = 99; for (const tid of A.ROAD_IDS) { const pl = A.track(tid); for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k];
      if (x < Math.min(ax, bx) - 4 || x > Math.max(ax, bx) + 4 || y < Math.min(ay, by) - 4 || y > Math.max(ay, by) + 4) continue;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); best = Math.min(best, Math.hypot(x - ax - u * dx, y - ay - u * dy)); } } return best; };
    const busy = new Set(), mark = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) busy.add(idx(x + dx, y + dy)); };
    for (const n of NPCS) mark(n.x, n.y, 1);
    for (const s of MONSTER_SPAWNS) mark(s.tx, s.ty, 1);
    for (const b of BUILDINGS) for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) busy.add(idx(x, y));
    const others = Object.keys(A.ANCHORS).filter(id => id !== ID && A.box(id)).map(id => A.box(id));
    const free = (x, y) => inMap(x, y) && !busy.has(idx(x, y)) && !others.some(q => x >= q[0] - 3 && x <= q[2] + 3 && y >= q[1] - 3 && y <= q[3] + 3) && roadD(x, y) > 2.5;
    { const b = BOX();
      for (let y = b[1] - RING; y <= b[3] + RING; y++) for (let x = b[0] - RING; x <= b[2] + RING; x++) {
        const d = Math.max(b[0] - x, x - b[2], b[1] - y, y - b[3]); if (d < 1) continue;
        const r = rnd();
        if (!free(x, y) || at(x, y) !== T.GRASS) continue;
        // (worn most by the box, gone by four tiles out; the rest of the ring keeps its grass and its wood)
        if (r < 0.22 * (1 - (d - 1) / 4)) { set(x, y, T.DIRT); S.ring++; }
      } }
  });

  // ---------- the solid things: what E says, and how each is drawn (the ground beneath first, then the thing) ----------
  HOOKS.use.push((t, tx, ty) => {
    if (window.__instance || t !== SOLID_T()) return false;
    const c = THINGS.get(idx(tx, ty)), k = c && PK[c.kind]; if (!k) return false;
    const words = typeof k.use === 'function' ? k.use(c, tx, ty) : k.use;
    if (k.say) say(words, k.say); else notify(words);
    return true;
  });
  HOOKS.draw.push((g, items) => {
    if (window.__instance || !THINGS.size) return;
    const vis = (x, y, r) => x + r > cam.x && x - r < cam.x + VW && y + r > cam.y && y - r < cam.y + VH;
    for (const [i, c] of THINGS) {
      const tx = i % MAP_W, ty = (i / MAP_W) | 0, px = tx * TILE, py = ty * TILE, k = PK[c.kind];
      if (!k || map[i] !== SOLID_T() || !vis(px + TILE / 2, py + TILE / 2, TILE + TILE)) continue;
      const v = variant[i] % 3;
      items.push({ y: -1e9 + 1, draw: () => { const img = tex[TEX_NAME[c.under] + v]; if (img) g.drawImage(img, px, py, TILE, TILE); } });
      items.push({ y: py + TILE - 4, draw: () => k.draw(g, px, py, c, tx, ty) });
    }
  });

  // ---------- talking ----------
  const SAID = {};
  HOOKS.talk.wayfarer = n => { const k = SAID[n.id] = ((SAID[n.id] === undefined ? -1 : SAID[n.id]) + 1) % n.lines.length; say(n.lines[k], n.name); };
  // Mother Hobb: five coins for a bowl of stew (healed to full) and the room (a bed in the back room holds the knight's
  // spirit from then on, like Dorran's at the Barrel & Boar); then her kitchen opens
  const ROOM = 5;
  const hobbWords = {
    paid: 'Five coins. Hot stew, and the bed in the back room is yours. Sleep in it and you will wake here if you fall.',
    again: 'Five coins. Sit down and eat. You look done in.',
    poor: 'A bowl of stew and a bed are five coins. Come back with coin, love.',
    home: 'Welcome back. Your bed is made. Hungry?',
  };
  { const prev = HOOKS.talkBefore.shop;
    HOOKS.talkBefore.shop = n => {
      if (n.id !== 'mother_hobb') return prev ? prev(n) : false;
      const paid = !!player.xinnRested, hurt = player.hp < player.maxHp;
      if ((!paid || hurt) && coins() >= ROOM) {
        payCoins(ROOM); player.hp = player.maxHp; player.xinnRested = true;
        say(paid ? hobbWords.again : hobbWords.paid, n.name); burst(player.x, player.y, '#7ee787', 10, 40); save();
      } else say(paid ? hobbWords.home : hobbWords.poor, n.name);
      openPanel('shop', n.shop); return true;
    }; }

  // ---------- the handle ----------
  window.CROSSROADS = { ID, THINGS, BOX, STAKED, PLAN, INN, PEOPLE, LINES, POSTS, STATS, NOTICES, FOOT, FR: F, boardWords, hobbWords, ROOM };

  // ---------- self-tests ----------
  HOOKS.selfTest.push((check, Fh, h) => {
    const P = 'crossroads: ', tiles = window.PLAYTHROUGH ? PLAYTHROUGH.pristine : map;
    const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
    const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - ax - u * dx, py - ay - u * dy); };
    const roadD = (x, y, ids) => { let b = Infinity; for (const id of ids) { const pl = A.track(id); for (let k = 1; k < pl.length; k++) b = Math.min(b, segD(x, y, pl[k - 1][0], pl[k - 1][1], pl[k][0], pl[k][1])); } return b; };
    const B = BOX(), SG = window.SPREAD_GROUND;

    // 1. built: no stake or plaque of its own left, the region names the place over the whole inn, WORLD_REV 3 with
    // the footprint
    { const left = SG ? [...SG.PROPS.values()].filter(p => p.place === ID && (p.kind === 'stake' || p.kind === 'plaque')).length : -1;
      const r = REGIONS.find(q => q.atlas === ID), R = A.REVS && A.REVS[3];
      const regionOk = !!r && r.sub === A.BUILT.get(ID).sub && r.x0 === B[0] && r.y0 === B[1] && r.x1 === B[2] && r.y1 === B[3];
      const corners = [[INN.x, INN.y], [INN.x + INN.w - 1, INN.y + INN.h - 1]].every(([x, y]) => regionAt(x, y) === r && A.zoneAt('over', x, y) === ID);
      const foot = !!R && R.boxes.some(q => q[0] <= B[0] - RING && q[1] <= B[1] - RING && q[2] >= B[2] + RING && q[3] >= B[3] + RING);
      check(P + "the Crossroads Inn is built: its builders' stakes and plaque are gone, its region (the banner, the Atlas zone) covers the whole inn and yard, and WORLD_REV 3 declares that box with its 6-tile ring as its footprint",
        left === 0 && STATS.stakes > 0 && regionOk && corners && WORLD_REV >= 3 && foot && A.isBuilt(ID), { left, stakes: STATS.stakes, region: r && [r.x0, r.y0, r.x1, r.y1, r.sub], B, WORLD_REV }); }

    // 2. the inn: 12 x 8, two rooms joined by a doorway, its door to the road; three beds in the back room, the counter,
    // the oven and tables in the common room; nothing of it on a main road
    { const b = INN, inside = (x, y) => x > b.x && x < b.x + b.w - 1 && y > b.y && y < b.y + b.h - 1;
      const N = MAP_W * MAP_H, seen = new Uint8Array(N), q = []; const [dx0, dy0] = [b.x + b.doorTop, b.y + 1];
      const take = (x, y) => { const i = idx(x, y); if (!seen[i] && inside(x, y) && !SOLID.has(tiles[i])) { seen[i] = 1; q.push([x, y]); } };
      take(dx0, dy0); for (let k = 0; k < q.length; k++) { const [x, y] = q[k]; take(x + 1, y); take(x - 1, y); take(x, y + 1); take(x, y - 1); }
      const wallX = b.x + 5, west = q.filter(([x]) => x < wallX).length, east = q.filter(([x]) => x > wallX).length;
      const beds = []; for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (tiles[idx(x, y)] === T.BED) beds.push([x, y]);
      const besideBed = beds.every(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ex, ey]) => seen[idx(x + ex, y + ey)]));
      const has = t => { for (let y = b.y; y < b.y + b.h; y++) for (let x = wallX + 1; x < b.x + b.w; x++) if (tiles[idx(x, y)] === t) return true; return false; };
      const onRoad = []; for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (A.onMainRoad(x, y)) onRoad.push([x, y]);
      check(P + "the inn is 12 by 8 with two rooms: through its door from the road into the common room (counter, oven, tables), through the doorway into the back room's three beds, each bed beside open floor; none of it on a main road",
        b.w === 12 && b.h === 8 && BUILDINGS.includes(b) && tiles[idx(b.x + b.doorTop, b.y)] === T.DOOR && west >= 10 && east >= 15 && beds.length === 3 && beds.every(([x]) => x < wallX) && besideBed && has(T.COUNTER) && has(T.OVEN) && !onRoad.length,
        { west, east, beds, onRoad }); }

    // 3. the people: on open ground in the place (the Atlas zone is the inn's), reached from the cave mouth, in the
    // townsfolk look; the rail, the yard's things and the board are reached too
    const N = MAP_W * MAP_H, seen = new Uint8Array(N), qq = new Int32Array(N); let n = 0;
    { const pass = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || t === Tn('WARDEN_GATE') || t === Tn('LAIR_GATE');
      const take = i => { if (!seen[i] && pass(tiles[i])) { seen[i] = 1; qq[n++] = i; } };
      const [mx, my] = A.port('cave.mouth'); take(idx(mx, my));
      for (let k = 0; k < n; k++) { const c = qq[k], x = c % MAP_W; if (x > 0) take(c - 1); if (x < MAP_W - 1) take(c + 1); if (c >= MAP_W) take(c - MAP_W); if (c + MAP_W < N) take(c + MAP_W); } }
    const reach = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[idx(x + dx, y + dy)]);
    { const bad = [];
      for (const p of PEOPLE) {
        if (!NPCS.includes(p)) bad.push(p.id + ' not in NPCS');
        if (SOLID.has(tileAt(p.x, p.y))) bad.push(p.id + ' on ' + tileName(tileAt(p.x, p.y)));
        if (!reach(p.x, p.y)) bad.push(p.id + ' not reached from the cave');
        if (!inB(B, p.x, p.y) || A.zoneAt('over', p.x, p.y) !== ID) bad.push(p.id + ' zone ' + A.zoneAt('over', p.x, p.y));
        if (!TOWNSFOLK_ART.NEW_NPC[p.id]) bad.push(p.id + ' has no look');
      }
      const hobb = PEOPLE[0]; if (insideBuilding(hobb.x, hobb.y) !== INN) bad.push('Mother Hobb is not inside the inn');
      if (PEOPLE.filter(p => p.wander).length !== 2) bad.push('two travellers wander');
      for (const [i, c] of THINGS) if (!reach(i % MAP_W, (i / MAP_W) | 0)) bad.push(c.kind + ' not reached');
      const p = POSTS.rail; if (!p || tileAt(p.x, p.y) !== T.HITCH || !reach(p.x, p.y)) bad.push('rail');
      check(P + 'Mother Hobb stands in her common room, Jory and Marigold wander the junction and the yard, all three in the townsfolk look and in the inn\'s Atlas zone; a knight walks to each of them, to the rail, the well, the trough and the notice board from the cave mouth',
        !bad.length, { bad }); }

    // 4. they talk: plain words, short; Jory and Marigold tell their stories a line at a time
    { const said = {};
      for (const p of PEOPLE.slice(1)) { said[p.id] = []; for (let k = 0; k < p.lines.length; k++) { dialog.queue.length = 0; advanceDialog(); closePanel(); talkTo(p); const d = [dialog.cur, ...dialog.queue].find(q => q && q.who === p.name); said[p.id].push(d ? d.text : null); } closePanel(); dialog.queue.length = 0; advanceDialog(); }
      const all = Object.values(LINES).flat().concat(Object.values(hobbWords));
      const every = PEOPLE.slice(1).every(p => p.lines.every(t => said[p.id].includes(t)));
      check(P + 'Jory and Marigold each say every one of their lines in turn, every line (and every one of Mother Hobb\'s) short and plain, with no compass words (the signpost gives the ways)',
        every && all.every(t => t.length <= 140 && !/\b(north|south|east|west)\b/i.test(t)), { said }); }

    // 5. the room and the kitchen: no coin, no room (and the bed says whose room it is); five coins heals him to full and
    // the back room's bed then holds his spirit; her kitchen opens every time; the Barrel & Boar's room is its own
    { const keep = { inv: JSON.parse(JSON.stringify(player.inv)), hp: player.hp, rested: player.xinnRested, inn: player.innRested, bed: player.bedSpawn, x: player.x, y: player.y, f: { ...player.facing } };
      const res = {};
      try {
        const hobb = PEOPLE[0], bed = (() => { for (let y = INN.y; y < INN.y + INN.h; y++) for (let x = INN.x; x < INN.x + INN.w; x++) if (tileAt(x, y) === T.BED) return [x, y]; return null; })();
        const sleep = () => { Fh.tp(bed[0] + 1, bed[1]); player.facing = { x: -1, y: 0 }; notice = null; dialog.queue.length = 0; advanceDialog(); useAction(); const d = [dialog.cur, ...dialog.queue].find(q => q && q.who === 'The Voice'); return { bed: !!player.bedSpawn, words: (notice && notice.text) || (d && d.text) }; };
        player.inv = new Array(INV_SLOTS).fill(null); player.xinnRested = false; player.innRested = true; player.bedSpawn = null;
        res.unpaid = sleep();
        talkTo(hobb); res.poorShop = panel === 'shop' && panelArg === 'xinn_kitchen'; res.poorRested = !!player.xinnRested; closePanel(); dialog.queue.length = 0; advanceDialog();
        addItem('coins', 12); player.hp = Math.max(1, player.maxHp - 5);
        talkTo(hobb); res.coins = coins(); res.healed = player.hp === player.maxHp; res.rested = !!player.xinnRested; res.shop = panel === 'shop' && panelArg === 'xinn_kitchen'; closePanel(); dialog.queue.length = 0; advanceDialog();
        talkTo(hobb); res.coins2 = coins(); closePanel(); dialog.queue.length = 0; advanceDialog();
        res.paid = sleep(); res.at = player.bedSpawn && [Math.floor(player.bedSpawn.x / TILE), Math.floor(player.bedSpawn.y / TILE)]; res.wantAt = bed;
        res.stock = ['meat_pie', 'bread'].every(id => SHOPS.xinn_kitchen.stock.some(([k]) => k === id));
      } finally { player.inv = keep.inv; player.hp = keep.hp; player.xinnRested = keep.rested; player.innRested = keep.inn; player.bedSpawn = keep.bed; player.x = keep.x; player.y = keep.y; player.facing = keep.f; closePanel(); dialog.queue.length = 0; advanceDialog(); }
      check(P + "the room: unpaid, the bed says \"Pay Mother Hobb for the room first.\" (the Barrel & Boar's paid room does not count here); with no coin she opens her kitchen and keeps the room; five coins heals the knight to full, the room is his and a second word with him whole costs nothing; then the back room's bed holds his spirit; her kitchen sells pies and bread",
        !res.unpaid.bed && res.unpaid.words === 'Pay Mother Hobb for the room first.' && res.poorShop && !res.poorRested && res.coins === 7 && res.healed && res.rested && res.shop && res.coins2 === 7 && res.paid.bed && !!res.at && res.at[0] === res.wantAt[0] && res.at[1] === res.wantAt[1] && res.stock,
        res); }

    // 6. no creature spawns inside the place (or in its yard), and the yard's things are solid and say their words
    { const inside = MONSTER_SPAWNS.filter(s => inB(B, s.tx, s.ty)).map(s => s.type + '@' + s.tx + ',' + s.ty);
      const things = [...THINGS].map(([i, c]) => [c.kind, i % MAP_W, (i / MAP_W) | 0]);
      const kinds = new Set(things.map(t => t[0]));
      const solid = things.every(([, x, y]) => SOLID.has(tiles[idx(x, y)]) && tiles[idx(x, y)] === SOLID_T() && inB(B, x, y));
      const board = boardWords();
      const hay = DECO.cells('hay').filter(([x, y]) => inB(B, x, y)).length;
      // (86-bandits pins its WANTED notice for the Bandit Hills' bandits; without it, nothing is pinned)
      const pinned = window.BANDITS ? /Bandit Hills/.test(board) && !/Nothing is pinned/.test(board) : /Nothing is pinned/.test(board);
      check(P + 'no creature spawns inside the inn\'s ground; the yard has its well, trough and hay, the notice board stands by the road (86-bandits\' notice pinned to it), each solid',
        !inside.length && kinds.has('well') && kinds.has('trough') && kinds.has('board') && things.length === 3 && solid && pinned && hay === 2,
        { inside, things, board, hay }); }

    // 7. the rail and the signpost: a RAILS entry on a HITCH tile in its own ground; the four-way signpost shows four
    // arms and no "builders at work"; nothing built here stands on a main road
    { const r = RAILS.find(q => q.id === ID), p = r && r.at();
      const railOk = !!p && inB(B, p.x, p.y) && tileAt(p.x, p.y) === T.HITCH && RAILS.of(p.x, p.y) === r && !r.reserved;
      const [yx, yy] = A.port(ID + '.yard'), s = SG && SG.signs.find(q => q[2] === Math.round(yx) && q[3] === Math.round(yy));
      const arms = s && window.SIGN_ARMS ? SIGN_ARMS(s[0], s[1]) : null, words = s ? A.signText(s[0], s[1]) : null;
      const anyBuilders = SG.signs.map(([x, y]) => A.signText(x, y)).filter(t => /Crossroads Inn \(builders at work\)/.test(t));
      const onRoad = []; PLAN.forEach((row, ry) => [...row].forEach((c, rx) => { const [x, y] = F.p(rx, ry); if (/[fHwqn]/.test(c) && A.onMainRoad(x, y)) onRoad.push(c + '@' + x + ',' + y); }));
      check(P + 'the inn has its hitching rail (a RAILS entry, on a HITCH tile in its yard); the signpost at the crossroads shows four arms and names the inn without "builders at work" (nor does any other); nothing built here stands on a main road',
        railOk && !!arms && arms.length === 4 && /^Here: The Crossroads Inn\./.test(words || '') && !anyBuilders.length && !onRoad.length, { rail: p, arms, words, anyBuilders, onRoad }); }

    // 8. its ground is its own: placing here says whose it is; the main roads through the junction stay clear and 6+
    // tiles from any of its creatures (it has none)
    { h.give('goblin_trap', 2); h.peace(true);
      // (in the yard, past the staked box: the inn's ground is the grown box)
      const [x, y] = F.p(13, 12), n0 = countItem('goblin_trap'); Fh.tp(x, y); player.facing = { x: 0, y: 1 }; notice = null; placeAction('goblin_trap');
      const res = { placed: countItem('goblin_trap') < n0, notice: notice && notice.text, pastStakes: !inB(STAKED(), x, y + 1) };
      h.peace(false);
      check(P + "nothing is built on the inn's ground: \"This is the Crossroads Inn's ground. Build somewhere else.\"", !res.placed && res.pastStakes && res.notice === "This is the Crossroads Inn's ground. Build somewhere else.", res); }
  });
}
