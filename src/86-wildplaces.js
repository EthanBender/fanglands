// ============================================================================
// THE WILD PLACES (the Great Spread, Stage 5d: ~/.fanglands/work/spread/spec.md §4 "New places", §6, §13 STAGE 5)
// src/86-wildplaces.js
//
// Two places off the beaten road, each built on its staked ground (93-spread staked them in Stage 4):
//
//   BEACON HILLS     a rock ridge, curved like a horseshoe, its rim all cliff: the only way up is the switchback path at
//                    its foot, three legs back and forth between rock walls. Three beacon towers stand on the crest at
//                    the Beacon Path's ports (beacon_hills.tower_w, tower_n, tower_e): stone towers with a fire basket on
//                    top, lit every night (HOOKS.nightLights: 35-night's dark is the overworld's; 89-lighting's LIGHTS
//                    paints only inside an instance's scene). E at a tower's door climbs it: every map marker within 60
//                    tiles is marked seen (61-markers' quest.markers.seen) and the first climb of each tower trains
//                    Agility. Ansel the beacon keeper lights them; climb all three and he thanks the knight. Crows on the
//                    crest, snakes and an adder in the rocks of the bay between the ridge's arms. A rail at the foot.
//   THE HUNTERS'     a log lodge at Wolfwood's edge, where the Wolfwood Road passes: Hilde the trapper inside (she buys
//   LODGE            pelts and skins at full price), skin racks by its wall, a range of three targets (an arrow that
//                    strikes one trains Ranged and lands at its foot), Corvin the hunter by the range (he teaches traps:
//                    the first word with him gives the knight a goblin trap and how to use it; then he sells traps, a
//                    bow and arrows). A rail and a woodpile. In the wood past the road, the bear den: a rock hollow
//                    open on its far side, with a bear ('bear', lv 14) that keeps to it, 8+ tiles off the road.
//
// Every place: its stakes taken up, its REGIONS line its own (ATLAS.markBuilt, read by 93-spread), a rail (RAILS.add), its
// signpost (Stage 4's: the Beacon fork on the Quarry Track, and the Lodge's) without "(builders at work)", people in the
// 83-townsfolk look (83-townsart's 'wildplaces' family), a 6-tile dressing ring of worn ground outside its box, and its
// footprint in ATLAS.REVS[4] (WORLD_REV 4): a knight's plank or wall standing in a box, its ring, the den, comes back to him.
//
// WHERE: every point in its place's own frame (ATLAS.planFrame: offsets from the staked box's top-left), the towers at
// their ports. WHEN: on the finished land (HOOKS.built), as 84 and 85 do; the people and the lodge are taken out of NPCS
// and BUILDINGS before every world (a generateWorld wrapper, ahead of the core's own generation, and a HOOKS.world pass).
// Its dice are its own (mulberry32 of its name).
// The towers and the targets are solid things a knight walks round: each stands on 95-thistledown's TD_PROP tile (solid,
// and outside Thistledown's own plan it has no town kind) with its kind in this file's side table (THINGS), drawn and read
// here, as 84-crossroads' well. The skin racks, the woodpile and the den's bones are DECO. No new tile id.
// The Beacon Path's track (01-atlas r1b_beacon) still runs straight between its ports for the network's reckoning; on the
// ground inside the ridge it is the switchback (the self-test walks it from the fork to every tower).
// Feature file: registers through HOOKS. window.WILDPLACES is the test handle.
// ============================================================================
{
  const A = ATLAS, Tn = n => (n in T ? T[n] : -1);
  const IDS = ['beacon_hills', 'hunters_lodge'];
  // built: 93-spread (which loads later) names these regions for the place, not the builders
  A.markBuilt('beacon_hills', { sub: 'Three beacon towers on a rocky ridge' });
  A.markBuilt('hunters_lodge', { sub: 'Pelts, traps, a range, and a bear in the wood' });
  const BH = A.planFrame('beacon_hills'), HL = A.planFrame('hunters_lodge');
  const FR = { beacon_hills: BH, hunters_lodge: HL };
  const RING = 6;
  const SEED = (() => { let h = 2166136261; for (const c of '86-wildplaces') h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; })();

  // ---------- the plans: one glyph a tile, rows from the box's top-left ----------
  //   .  as the land is (a stray stretch of old dirt goes back to grass)
  //   g  open grass (trees, rocks, flowers and mushrooms go; ore and berry bushes stay)
  //   ,  a worn path          #  rock face (CLIFF)          o  a boulder (ROCK)
  //   W N E  a beacon tower's base (laid from its port: three wide, two deep, its door over the port)
  //   H  the hitching rail     l  a woodpile (DECO)          k  a skin rack (DECO)          b  old bones (DECO)
  //   t  a target (solid: a TD_PROP cell in THINGS)          @  a person (open grass)
  // Beacon Hills: the ridge's rim is all rock face; the switchback climbs from the foot (bottom left) through three legs
  // to the gap at (7, 10), then the crest path runs tower to tower.
  const PLAN = {
    beacon_hills: [
      '...........o.oo.o.o............',
      '.........oo###########oo.......',
      '.......oo###gggNNNggg###oo.....',
      '.....oo###gggggNNNgg@lgg###o...',
      '...oo###gggggg,,,,,,,ggggg##o..',
      '..o###ggggggg,,,ggggg,,,gggg##o.',
      '.o#WWWgggg,,,gg######g,,,gggg#o',
      '.o#WWWggg,,gg###oooo###g,,,ggg#',
      '.o#g,,,,,,gg##oo....oo##gg,,,,#',
      '.o#g,,,,ggg##o........o##gEEE,#',
      '.o#####,####o..........o##EEE,#',
      '.o#,,,,,###o............o#g,,,#',
      '.o#,#######..............##gg##',
      '.o#,,,,,,,#o..............#####',
      '.o#######,#o...............ooo.',
      '.o,,,,,,,,.o...................',
      ',,,............................',
      '..H............................',
    ],
    // the Hunters' Lodge: the lodge (a BUILDINGS row) on the box's first five rows, its door to the path; the range's
    // three targets in a row with a worn line to stand on; the road crosses the box's foot (rows 6..10, as it is). Rows 17..22:
    // the bear den in the wood past the road, a rock hollow open on its far side
    hunters_lodge: [
      '.......gtgtgt',
      '.......kggggg',
      '.......kggggg',
      '.......g,,,,,',
      '.......g,gggg',
      'l,,,,,,,,,ggg',
      '.H.,.kgg.....',
      '...,.........',
      '...,.........',
      '...,.........',
      '.............',
      '.............',
      '.............',
      '.............',
      '.............',
      '.............',
      '..ggggg......',
      '.g#####g.....',
      '.g#b,,#g.....',
      '.o#,,,#o.....',
      '.g#,,b#g.....',
      '.go,,,og.....',
      '..ggggg......',
    ],
  };
  // the switchback's top, where the climb comes out on the crest (the self-test shuts it and the towers are cut off)
  const GAP = () => BH.p(7, 10);

  // ---------- the beacon towers (at the Beacon Path's ports) ----------
  const TOWERS = [
    { id: 'tower_w', port: 'beacon_hills.tower_w', name: 'the Low Beacon' },
    { id: 'tower_n', port: 'beacon_hills.tower_n', name: 'the High Beacon' },
    { id: 'tower_e', port: 'beacon_hills.tower_e', name: 'the Far Beacon' },
  ];
  // [x, y] the door's step (the port); the base: three wide, two deep, over it
  const stepOf = tw => A.port(tw.port).map(Math.round);
  const baseOf = tw => { const [x, y] = stepOf(tw), out = []; for (let dy = -2; dy <= -1; dy++) for (let dx = -1; dx <= 1; dx++) out.push([x + dx, y + dy]); return out; };
  const SEE = 60;   // tiles: from the top, every map marker this near is marked seen
  const TOWER_REACH = TILE * 4;   // px: how far a tower's drawing reaches past its base (the cull)

  // ---------- the lodge (a BUILDINGS row) ----------
  // a hearth (oven), shelves and Hilde's counter along the back wall, a table and a bed by the door, a bearskin rug
  const LODGE = Object.assign(HL.pt({ id: 'hlodge', x: 0, y: 0, w: 7, h: 5, name: "The Hunters' Lodge", roof: '#5a3a22', sign: 'LODGE', door: 3,
    f: [[T.OVEN, 1, 1], [T.SHELF, 2, 1], [T.COUNTER, 4, 1], [T.SHELF, 5, 1], [T.TABLE, 1, 3], [T.BED, 5, 3], [T.RUG, 3, 2]] }), { wildplaces: true });

  // ---------- the people (NPCS rows; each id is a look in 83-townsart's 'wildplaces' family) ----------
  const LINES = {
    ansel: [
      'I keep the three beacons on this ridge. Every night I climb up and light them. One, two, three.',
      'Long ago the beacons were lit to warn the town when goblins came. Now they help travellers find their way in the dark.',
      'Climb a tower and look around. From the top you can see places you have never been, and your map will remember them.',
      'The path up goes back and forth. It is slow, but it is the only way. The rock is too steep to climb anywhere else.',
      'Mind the snakes in the rocks below. And the crows. A crow will steal anything shiny.',
      'Climb all three towers and come back to me. A keeper always thanks a climber.',
    ],
    hilde: [
      'Pelts, skins and furs! I pay full price for every one.',
      'A wolf pelt keeps a bed warm all winter. A bear pelt keeps a whole family warm.',
      'There is a bear in a den in the wood, past the road. Big and grumpy. Only go if you are strong.',
      'Snakeskin makes the best belts. Bring me every skin you find.',
    ],
    corvin: [
      'A trap hurts a goblin and holds it still for a moment. Then you hit it while it cannot run.',
      'Changed your mind? Press E on a trap to pick it up again. Traps are not cheap.',
      "I make my traps from an iron bar and two planks at the tinker's table. You can too, once your Crafting is 3.",
      'Try our targets with a bow. Stand on the worn line and shoot. Your arrow lands at the target\'s foot.',
      'Traps catch beasts and goblins. People are too clever for them.',
    ],
  };
  const WORDS = {
    trapGift: 'Want to learn traps? Take this one. Use it from your pack to set it down where goblins walk. When one steps on it, snap!',
    allThree: 'You climbed all three towers! Not many people do. Here, a keeper\'s thanks.',
    pelts: 'Hilde only buys pelts, skins and feathers.',
    traps: 'Corvin buys nothing. He only sells.',
  };
  const PEOPLE = [
    BH.pt({ id: 'ansel', name: 'Ansel the beacon keeper', x: 20, y: 3, tunic: '#7a5a3a', hair: '#cfcac0', beard: true, role: 'beaconkeeper', lines: LINES.ansel }),
    HL.pt({ id: 'hilde_trapper', name: 'Hilde the trapper', x: 4, y: 2, tunic: '#6a4a2e', hair: '#b8742e', woman: true, role: 'shop', shop: 'lodge_pelts' }),
    HL.pt({ id: 'corvin_hunter', name: 'Corvin the hunter', x: 7, y: 3, tunic: '#4a5a32', hair: '#3a2a1a', beard: true, role: 'shop', shop: 'lodge_traps' }),
  ].map(n => Object.assign(n, { wildplaces: true }));

  // ---------- the bear ----------
  // XP is 42-playthrough's (hp x 4, plus level x 10 from level 10): 360. She keeps to her den (roam 2) and charges at 4
  // tiles, so a knight on the road (8+ tiles off) is never seen: the fight is one he chooses.
  MONSTER_DEFS.bear = { name: 'Bear', level: 14, r: 18, hp: 55, att: 15, maxHit: 9, def: 11, speed: 140, aggro: true, sight: 4 * TILE, respawn: 90, roam: 2,
    drops: { always: [['bear_pelt', 1, 1]], table: [['nothing', 0, 0, 4], ['raw_beef', 1, 2, 5], ['coins', 5, 15, 2]] } };
  ITEMS.bear_pelt = { id: 'bear_pelt', name: 'Bear pelt', value: 60, color: '#5a3e28', shape: 'pelt', stack: 50 };

  // ---------- the creatures (87-critters' kinds, and the bear) ----------
  const SPAWNS = [
    // Beacon Hills: crows on the crest, snakes and an adder in the rocks of the bay between the ridge's arms
    { place: 'beacon_hills', type: 'crow', at: () => BH.pts([[10, 5], [25, 6]]) },
    { place: 'beacon_hills', type: 'snake', at: () => BH.pts([[16, 10], [20, 12]]) },
    { place: 'beacon_hills', type: 'adder', at: () => [BH.p(14, 12)] },
    // the bear in her den, in the wood past the road
    { place: 'hunters_lodge', type: 'bear', at: () => [HL.p(4, 19)] },
  ];
  const spotsOf = s => s.at().map(([x, y]) => [Math.round(x), Math.round(y)]);
  // a goblin of 02-world's open land stood where the ridge's bay now is: it moves to the meadow below the ridge
  const GOBLIN_TO = () => BH.p(17, 23);
  const DEN = () => HL.box([0, 15, 9, 24]);

  // ---------- the footprint (§10): WORLD_REV 4 ----------
  const grow = (b, d) => [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
  const FOOT = () => [...IDS.map(id => grow(A.box(id), RING)), DEN()];
  if (A.REVS) A.REVS[4] = { stage: '5d', by: '86-wildplaces', why: "Beacon Hills and the Hunters' Lodge: each box with its dressing ring, and the bear's den", boxes: FOOT() };

  // ---------- the shops ----------
  SHOPS.lodge_pelts = { name: "Hilde's Furs", stock: [['raw_beef', 6], ['cooked_beef', 12]], buys: ['wolf_pelt', 'bear_pelt', 'snakeskin', 'boar_tusk', 'wool', 'crow_feather'], rate: 1, buysWords: WORDS.pelts };   // (the crow's feather: she trims her hats with them)
  SHOPS.lodge_traps = { name: "Corvin's Traps", stock: [['goblin_trap', 50], ['shortbow', 50], ['stone_arrow', 1]], buys: [], rate: 1, buysWords: WORDS.traps };

  // ---------- the rails ----------
  const POSTS = {};
  const RAIL_NAMES = { beacon_hills: 'the rail at the foot of Beacon Hills', hunters_lodge: "the rail at the Hunters' Lodge" };
  if (window.RAILS) for (const id of IDS) RAILS.add({ id, place: RAIL_NAMES[id], at: () => POSTS[id] || null });

  // ---------- the state (quest.wild: no positions, only which tower he has climbed and what he was given) ----------
  const W = () => { if (!quest.wild || typeof quest.wild !== 'object') quest.wild = {}; const q = quest.wild; if (!q.climbed || typeof q.climbed !== 'object') q.climbed = {}; return q; };
  const lit = () => !!(window.NIGHT && NIGHT.phase() !== 'day');

  // ---------- the solid things: idx -> { kind, under, tower? } on TD_PROP cells (made in the built pass, emptied each world) ----------
  const THINGS = new Map(), PK = {};
  const SOLID_T = () => Tn('TD_PROP');
  const shadow = (g, cx, y, rx) => { g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx, y, rx, rx * 0.28, 0, 0, 7); g.fill(); };
  // a beacon tower: a stone shaft three tiles wide at its foot, an arched door over the step, two arrow slits, a
  // crenellated top and the fire basket; the fire roars at night and smoulders by day
  function drawTower(g, tw) {
    const [sx, sy] = stepOf(tw), cx = (sx + 0.5) * TILE, foot = sy * TILE - 2, H = TILE * 4.6, w0 = TILE * 2.4, w1 = w0 * 0.84, top = foot - H;
    shadow(g, cx + 6, foot, w0 * 0.55);
    // the shaft, tapering, in courses of grey stone
    g.beginPath(); g.moveTo(cx - w0 / 2, foot); g.lineTo(cx - w1 / 2, top + 20); g.lineTo(cx + w1 / 2, top + 20); g.lineTo(cx + w0 / 2, foot); g.closePath();
    const sh = g.createLinearGradient(cx - w0 / 2, 0, cx + w0 / 2, 0); sh.addColorStop(0, '#9a968e'); sh.addColorStop(0.55, '#86827a'); sh.addColorStop(1, '#5e5a54');
    g.fillStyle = sh; g.fill(); g.strokeStyle = 'rgba(30,26,22,0.55)'; g.lineWidth = 2; g.stroke();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(40,36,30,0.35)'; g.lineWidth = 1;
    for (let k = 0, y = foot - 12; y > top + 20; y -= 12, k++) { g.beginPath(); g.moveTo(cx - w0, y); g.lineTo(cx + w0, y); g.stroke();
      for (let x = cx - w0 / 2 + (k % 2) * 10; x < cx + w0 / 2; x += 20) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 12); g.stroke(); } }
    g.fillStyle = 'rgba(80,120,60,0.35)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx - w0 / 2 + 10 + ((k * 37 + sx * 7) % (w0 - 20)), foot - 4 - (k % 2) * 6, 8, 4, 0, 0, 7); g.fill(); }
    g.restore();
    // the door, an arch over the step, with a lantern beside it at night
    g.fillStyle = '#2a2018'; g.beginPath(); g.moveTo(cx - 13, foot); g.lineTo(cx - 13, foot - 30); g.arc(cx, foot - 30, 13, Math.PI, 0); g.lineTo(cx + 13, foot); g.closePath(); g.fill();
    g.strokeStyle = '#6a655c'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#5a3c22'; g.fillRect(cx - 10, foot - 30, 20, 30); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; for (const x of [-4, 4]) { g.beginPath(); g.moveTo(cx + x, foot - 30); g.lineTo(cx + x, foot); g.stroke(); }
    g.fillStyle = '#c9a64a'; g.beginPath(); g.arc(cx + 6, foot - 15, 1.8, 0, 7); g.fill();
    // two arrow slits
    g.fillStyle = '#1e1a16'; for (const y of [foot - H * 0.45, foot - H * 0.72]) g.fillRect(cx - 3, y, 6, 18);
    // the parapet: a stone band with merlons
    const py = top + 20, pw = w1 + 16;
    g.fillStyle = '#7d7972'; g.fillRect(cx - pw / 2, py - 10, pw, 14); g.strokeStyle = 'rgba(30,26,22,0.5)'; g.lineWidth = 1.5; g.strokeRect(cx - pw / 2, py - 10, pw, 14);
    g.fillStyle = '#8f8b84'; for (let k = 0; k < 5; k++) { const mx = cx - pw / 2 + k * (pw - 12) / 4; g.fillRect(mx, py - 22, 12, 12); g.strokeRect(mx, py - 22, 12, 12); }
    // the fire basket: an iron bowl on a short post
    g.fillStyle = '#2e2a28'; g.fillRect(cx - 3, py - 34, 6, 14);
    g.beginPath(); g.moveTo(cx - 16, py - 42); g.lineTo(cx + 16, py - 42); g.lineTo(cx + 10, py - 32); g.lineTo(cx - 10, py - 32); g.closePath(); g.fill();
    g.strokeStyle = '#4a4440'; g.lineWidth = 1; for (const x of [-8, 0, 8]) { g.beginPath(); g.moveTo(cx + x, py - 42); g.lineTo(cx + x * 0.7, py - 32); g.stroke(); }
    const t = time + sx * 0.37;
    if (lit()) {
      // a beacon fire: tall tongues of flame, sparks rising
      const gl = g.createRadialGradient(cx, py - 52, 4, cx, py - 52, 46); gl.addColorStop(0, 'rgba(255,190,90,0.55)'); gl.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(cx, py - 52, 46, 0, 7); g.fill();
      for (let k = 0; k < 5; k++) { const fl = cx + (k - 2) * 5.5, h = 18 + 8 * Math.sin(t * 9 + k * 1.7) + (k % 2 ? 4 : 0);
        g.fillStyle = k % 2 ? '#ffb43c' : '#ff7a1e'; g.beginPath(); g.moveTo(fl - 4, py - 42); g.quadraticCurveTo(fl - 3, py - 42 - h * 0.6, fl + Math.sin(t * 7 + k) * 2, py - 42 - h); g.quadraticCurveTo(fl + 4, py - 42 - h * 0.5, fl + 4, py - 42); g.closePath(); g.fill(); }
      g.fillStyle = '#fff2c0'; g.beginPath(); g.ellipse(cx, py - 47, 6, 5, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,200,120,0.85)'; for (let k = 0; k < 4; k++) { const p = (t * 0.7 + k * 0.25) % 1; g.fillRect(cx - 6 + Math.sin(k * 2.3 + t) * 10, py - 60 - p * 40, 2, 2); }
    } else {
      // by day the fire is banked: embers and a thread of smoke
      g.fillStyle = '#7a2a14'; g.beginPath(); g.ellipse(cx, py - 42, 12, 3, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,120,40,0.7)'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(cx - 6 + k * 6, py - 43, 1.6, 0, 7); g.fill(); }
      for (let k = 0; k < 4; k++) { const p = (t * 0.25 + k * 0.25) % 1; g.fillStyle = `rgba(200,200,200,${(0.35 * (1 - p)).toFixed(3)})`; g.beginPath(); g.arc(cx + Math.sin(p * 4 + k) * 6, py - 46 - p * 50, 4 + p * 8, 0, 7); g.fill(); }
    }
    // the climbed mark: a little banner on the parapet once the knight has stood up there
    if (W().climbed[tw.id]) { g.fillStyle = '#5a3c22'; g.fillRect(cx + pw / 2 - 6, py - 46, 2, 26); g.fillStyle = '#c9a64a'; g.beginPath(); g.moveTo(cx + pw / 2 - 4, py - 46); g.lineTo(cx + pw / 2 + 10, py - 42); g.lineTo(cx + pw / 2 - 4, py - 38); g.closePath(); g.fill(); }
  }
  PK.tower = { use: c => climb(c.tower) };
  // a straw target on a wooden stand, painted in rings
  PK.target = { use: 'A straw target. Stand on the worn line and shoot it with a bow and arrows.',
    draw(g, px, py) {
      const cx = px + TILE / 2, base = py + TILE - 6;
      shadow(g, cx, base + 2, 16);
      g.fillStyle = '#5a3c22'; g.fillRect(cx - 14, base - 22, 3, 24); g.fillRect(cx + 11, base - 22, 3, 24); g.fillRect(cx - 2, base - 16, 4, 18);
      g.fillStyle = '#d9c88a'; g.beginPath(); g.arc(cx, base - 30, 17, 0, 7); g.fill(); g.strokeStyle = '#9c854f'; g.lineWidth = 1.5; g.stroke();
      for (const [r, c] of [[13, '#f2ece0'], [10, '#3a6a9a'], [7, '#b8352b'], [3.5, '#f5c542']]) { g.fillStyle = c; g.beginPath(); g.arc(cx, base - 30, r, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(150,120,60,0.6)'; g.lineWidth = 1; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3; g.beginPath(); g.moveTo(cx + Math.cos(a) * 15, base - 30 + Math.sin(a) * 15); g.lineTo(cx + Math.cos(a) * 18, base - 30 + Math.sin(a) * 18); g.stroke(); }
      const hits = TARGET_HITS.get(idx(Math.floor(px / TILE), Math.floor(py / TILE))) || 0;
      for (let k = 0; k < Math.min(3, hits); k++) { const a = k * 2.1 + 0.4, d = 3 + k * 2.5, ax = cx + Math.cos(a) * d, ay = base - 30 + Math.sin(a) * d;
        g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + 7, ay + 5); g.stroke(); g.fillStyle = '#e8e2d6'; g.fillRect(ax + 5, ay + 3, 4, 4); }
    } };

  // ---------- DECO: skin racks, a woodpile, old bones ----------
  DECO.kind('skin_rack', { use: 'A wolf pelt stretched on a frame to dry. Hilde will sell it to a tanner.',
    draw(g, px, py, c, tx, ty) {
      const cx = px + TILE / 2, base = py + TILE - 6;
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(cx, base + 2, 18, 4, 0, 0, 7); g.fill();
      g.fillStyle = '#6b4a2a'; g.fillRect(cx - 17, base - 36, 4, 38); g.fillRect(cx + 13, base - 36, 4, 38); g.fillRect(cx - 19, base - 37, 38, 4); g.fillRect(cx - 19, base - 8, 38, 3);
      const col = (tx + ty) % 2 ? '#7a7068' : '#8a5e3a';
      g.fillStyle = col; g.beginPath(); g.moveTo(cx - 11, base - 32); g.lineTo(cx + 11, base - 32); g.lineTo(cx + 9, base - 22); g.lineTo(cx + 12, base - 11); g.lineTo(cx - 12, base - 11); g.lineTo(cx - 9, base - 22); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(30,20,10,0.5)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(255,240,220,0.25)'; g.beginPath(); g.ellipse(cx, base - 22, 4, 7, 0, 0, 7); g.fill();
      g.strokeStyle = '#c9b07a'; g.lineWidth = 0.8; for (const [x0, y0, x1, y1] of [[-11, -32, -17, -35], [11, -32, 13, -35], [-12, -11, -17, -8], [12, -11, 13, -8]]) { g.beginPath(); g.moveTo(cx + x0, base + y0); g.lineTo(cx + x1, base + y1); g.stroke(); }
    } });
  DECO.kind('woodpile', { use: 'Split logs for the lodge fire, stacked to dry.',
    draw(g, px, py) {
      const cx = px + TILE / 2, base = py + TILE - 6;
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(cx, base + 2, 20, 5, 0, 0, 7); g.fill();
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) { const lg = cx + (r * 5 + k * 10 - 15), lh = base - 6 - r * 8;
        g.fillStyle = '#7a5434'; g.beginPath(); g.arc(lg, lh, 5, 0, 7); g.fill(); g.fillStyle = '#c9a070'; g.beginPath(); g.arc(lg, lh, 3.4, 0, 7); g.fill();
        g.strokeStyle = 'rgba(90,60,30,0.6)'; g.lineWidth = 0.7; g.beginPath(); g.arc(lg, lh, 1.8, 0, 7); g.stroke(); }
    } });
  DECO.kind('bones', { use: 'Old bones, picked clean. Something big lives here.',
    draw(g, px, py, c, tx) {
      const cx = px + TILE / 2, cy = py + TILE / 2 + 6;
      g.save(); g.translate(cx, cy); g.rotate((tx % 3) * 0.7);
      g.fillStyle = '#e4dccb'; g.fillRect(-11, -2, 22, 4); for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 11, -2, 3, 0, 7); g.arc(s * 11, 2, 3, 0, 7); g.fill(); }
      g.rotate(1.1); g.fillRect(-7, -1.5, 14, 3); g.restore();
      g.fillStyle = '#d8cfbc'; g.beginPath(); g.arc(cx + 9, cy - 9, 5, 0, 7); g.fill(); g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(cx + 7.5, cy - 10, 1.2, 0, 7); g.arc(cx + 10.5, cy - 10, 1.2, 0, 7); g.fill();
    } });

  // ---------- climbing a tower ----------
  // every map marker within SEE tiles is marked seen; the first climb of each tower trains Agility; all three and Ansel thanks him
  function climb(tw) {
    const q = W(), [sx, sy] = stepOf(tw), first = !q.climbed[tw.id];
    let found = 0;
    if (window.MARKERS) { const s = MARKERS.state(); for (const m of MARKERS.all()) if (!s.seen[m.key] && Math.hypot(m.x - sx, m.y - sy) <= SEE) { s.seen[m.key] = 1; found++; } }
    q.climbed[tw.id] = 1;
    if (first) gainXp('agility', 25);
    burst(player.x, player.y - 30, '#ffd166', 12, 60); sfx('open');
    say(`You climb the ladder inside ${tw.name} and look out from the top. ` + (found ? `${found === 1 ? 'One new place is' : found + ' new places are'} marked on your map.` : 'Everything you can see is on your map already.'), 'The Voice');
    save();
    return found;
  }

  // ---------- the range: an arrow that strikes a target trains Ranged and lands at its foot ----------
  // (the core stops an arrow on a solid tile, so each player arrow is looked at a step ahead of the next frame)
  const TARGET_HITS = new Map(), RANGE = { hits: 0, xp: 0 };
  HOOKS.update.push(dt => {
    if (window.__instance || !THINGS.size || !projectiles.length) return;
    let hit = null;
    for (const p of projectiles) {
      if (p.kind !== 'arrow' || p.owner !== 'player' || p.done) continue;
      for (const k of [0, 1, 1.6]) {
        const tx = Math.floor((p.x + p.vx * dt * k) / TILE), ty = Math.floor((p.y + p.vy * dt * k) / TILE), c = inMap(tx, ty) && THINGS.get(idx(tx, ty));
        if (!c || c.kind !== 'target' || map[idx(tx, ty)] !== SOLID_T()) continue;
        const dmg = rollHit(playerAttackRoll(true), 9 * 64, playerMaxHit(true)), cx = tc(tx), cy = tc(ty);
        floatText(cx, cy - 40, dmg ? (dmg >= playerMaxHit(true) ? 'Bullseye!' : 'Hit! ' + dmg) : 'Just missed', dmg ? '#ffd166' : '#8fb4ff'); burst(cx, cy - 28, '#d9c88a', 6, 50);
        if (dmg) gainXp('range', dmg);
        drops.push({ x: cx, y: cy + TILE * 0.8, id: p.str > 5 ? 'iron_arrow' : 'stone_arrow', qty: 1, t: 0 });
        TARGET_HITS.set(idx(tx, ty), (TARGET_HITS.get(idx(tx, ty)) || 0) + 1); RANGE.hits++; RANGE.xp += dmg;
        (hit = hit || new Set()).add(p); break;
      }
    }
    if (hit) projectiles = projectiles.filter(p => !hit.has(p));
  });

  // ---------- the pass (HOOKS.built: the finished land) ----------
  // out of NPCS and BUILDINGS BEFORE a world is made: the core's own generation (ahead of every HOOKS.world pass) lays every
  // BUILDINGS row, and the passes after it keep rings clear round people and buildings with the shared dice
  const unBuild = () => {
    THINGS.clear(); TARGET_HITS.clear();
    for (let i = NPCS.length - 1; i >= 0; i--) if (NPCS[i].wildplaces) NPCS.splice(i, 1);
    for (let i = BUILDINGS.length - 1; i >= 0; i--) if (BUILDINGS[i].wildplaces) BUILDINGS.splice(i, 1);
  };
  { const _generateWorld = generateWorld; generateWorld = function () { unBuild(); return _generateWorld.apply(this, arguments); }; }
  HOOKS.world.unshift(unBuild);
  const STATS = {};
  HOOKS.built.push((rnd0, api) => {
    const set = api.setTile, at = api.tileAt, rnd = mulberry32(SEED);
    const S = STATS; S.stakes = 0; S.ring = 0; S.deco = 0; S.props = 0; S.cleared = 0; S.paths = 0; S.goblin = null;
    const NATURE = new Set([T.TREE, T.OAK, T.ROCK, T.FLOWERS, T.MUSHROOM, Tn('FERN'), Tn('DEADTREE'), Tn('DEAD_TREE')].filter(v => v >= 0));
    // what a plan never paints over: ore, berry bushes, signposts, chests (a rock face or a tower takes ore: the rim must hold)
    const KEEP = new Set(['IRON', 'COAL', 'BLACKIRON', 'SUNSTONE', 'STORMSTONE', 'MITHRIL', 'BERRY_BUSH', 'SIGN', 'CHEST'].map(Tn).filter(v => v >= 0));
    const KEEP_HARD = new Set(['SIGN', 'CHEST'].map(Tn).filter(v => v >= 0));
    const CLIFF = Tn('CLIFF'), SG = window.SPREAD_GROUND;
    const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

    // 1. the stakes come up: each one's ground goes back
    if (SG) for (const [i, p] of [...SG.PROPS]) if (IDS.includes(p.place)) { set(i % MAP_W, (i / MAP_W) | 0, p.under); SG.PROPS.delete(i); S.stakes++; }

    // 2. the plans
    // (an apron round every rock face and boulder: the trees, flowers and loose rocks on the open ground beside one go, so
    // no new face shuts a pocket of ground, an ore or a rock a knight could reach before; a cell the plan says is rock,
    // a face or kept ground is left alone)
    const clearRound = (F, rows, rx, ry) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue;
      const c = (rows[ry + dy] || '')[rx + dx]; if (c !== undefined && c !== '.' && c !== 'g') continue;
      const [x, y] = F.p(rx + dx, ry + dy); if (!inMap(x, y)) continue; const t = at(x, y); if (NATURE.has(t) && !KEEP.has(t)) { set(x, y, T.GRASS); S.cleared++; } } };
    const posts = {};
    const thing = (x, y, kind, extra) => { const t = SOLID_T(); if (t < 0) return; THINGS.set(idx(x, y), Object.assign({ kind, under: at(x, y) === t ? T.GRASS : at(x, y) }, extra)); set(x, y, t); S.props++; };
    for (const id of IDS) {
      const F = FR[id], rows = PLAN[id], box = A.box(id);
      for (let ry = 0; ry < rows.length; ry++) for (let rx = 0; rx < rows[ry].length; rx++) {
        const ch = rows[ry][rx], [x, y] = F.p(rx, ry), t = at(x, y);
        if (!inMap(x, y)) continue;
        if (ch === '.' || ch === '@') {
          // (the land as it is; inside the box a stray stretch of old path goes back to grass, never a main road's lanes, and a
          // person's tile is open)
          if (inB(box, x, y) && t === T.DIRT && !A.onMainRoad(x, y)) set(x, y, T.GRASS);
          if (ch === '@' && (NATURE.has(t) || SOLID.has(t))) set(x, y, T.GRASS);
          continue;
        }
        if (KEEP_HARD.has(t)) continue;
        if (ch === '#') { set(x, y, CLIFF); clearRound(F, rows, rx, ry); continue; }
        if (ch === ',') { set(x, y, T.DIRT); S.paths++; continue; }
        if (ch === 'W' || ch === 'N' || ch === 'E') { if (NATURE.has(t) || SOLID.has(t) || t === T.DIRT) set(x, y, T.GRASS); continue; }   // the tower is laid below
        if (KEEP.has(t)) continue;
        if (ch === 'g') { if (NATURE.has(t)) { set(x, y, T.GRASS); S.cleared++; } else if (t === T.DIRT && inB(box, x, y) && !A.onMainRoad(x, y)) set(x, y, T.GRASS); }
        else if (ch === 'o') { set(x, y, T.ROCK); clearRound(F, rows, rx, ry); }
        else if (ch === 'H') { set(x, y, T.HITCH); posts[id] = { x, y }; }
        else if (ch === 'l') { if (NATURE.has(t) || t === T.DIRT) set(x, y, T.GRASS); DECO.put(api, x, y, 'woodpile'); S.deco++; }
        else if (ch === 'k') { if (NATURE.has(t) || t === T.DIRT) set(x, y, T.GRASS); DECO.put(api, x, y, 'skin_rack'); S.deco++; }
        else if (ch === 'b') { set(x, y, T.DIRT); DECO.put(api, x, y, 'bones'); S.deco++; }
        else if (ch === 't') { if (NATURE.has(t) || t === T.DIRT) set(x, y, T.GRASS); thing(x, y, 'target'); }
      }
    }
    Object.keys(POSTS).forEach(k => delete POSTS[k]); Object.assign(POSTS, posts);

    // 3. the towers: three wide and two deep over each port, one record for all six cells
    for (const tw of TOWERS) { for (const [x, y] of baseOf(tw)) thing(x, y, 'tower', { tower: tw }); const [sx, sy] = stepOf(tw); if (SOLID.has(at(sx, sy))) set(sx, sy, T.DIRT); }

    // 4. the lodge, as 02-world lays its own (walls, floor, door, furniture, a clear step)
    { const b = LODGE;
      if (!BUILDINGS.includes(b)) BUILDINGS.push(b);
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
        const edge = x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1;
        set(x, y, edge ? T.HWALL : T.FLOOR);
      }
      set(b.x + b.door, b.y + b.h - 1, T.DOOR);
      for (const [t, rx, ry] of b.f) set(b.x + rx, b.y + ry, t);
      const [sx, sy] = [b.x + b.door, b.y + b.h];
      if (SOLID.has(at(sx, sy))) set(sx, sy, T.DIRT);
      // (an apron round its walls: the open ground beside the lodge stays open, so the bank between it and the scarp is
      // still walked to round either end)
      for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) if (!inB([b.x, b.y, b.x + b.w - 1, b.y + b.h - 1], x, y) && NATURE.has(at(x, y))) { set(x, y, T.GRASS); S.cleared++; } }

    // 5. the people
    for (const n of PEOPLE) { if (!NPCS.includes(n)) NPCS.push(n); initNpc(n); if (SOLID.has(at(n.x, n.y))) set(n.x, n.y, insideBuilding(n.x, n.y) ? T.FLOOR : T.GRASS); }

    // 6. the creatures: each where its point says, the 3 x 3 round it open (as the core clears it); the goblin that stood
    // in the ridge's bay moves to the meadow below it
    for (const s of SPAWNS) {
      const pts = spotsOf(s), n0 = MONSTER_SPAWNS.length;
      for (const [x, y] of pts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (NATURE.has(at(x + dx, y + dy))) set(x + dx, y + dy, T.GRASS);
      api.spawnList(s.type, pts);
      for (let k = n0; k < MONSTER_SPAWNS.length; k++) MONSTER_SPAWNS[k].by = '86-wildplaces:' + s.place;
    }
    { const b = A.box('beacon_hills'), [gx, gy] = GOBLIN_TO().map(Math.round);
      for (const s of MONSTER_SPAWNS) if (s.type === 'goblin' && !s.by && inB(b, s.tx, s.ty)) {
        S.goblin = [s.tx, s.ty, gx, gy]; s.tx = gx; s.ty = gy;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (NATURE.has(at(gx + dx, gy + dy))) set(gx + dx, gy + dy, T.GRASS);
      } }

    // 7. the dressing ring: worn ground outside each box, thinning out over RING tiles (its own dice), never on a road's
    // lanes, a person, a spawn, a building or another place's box
    const roadD = (x, y) => { let best = 99; for (const tid of A.ROAD_IDS) { const pl = A.track(tid); for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k];
      if (x < Math.min(ax, bx) - 4 || x > Math.max(ax, bx) + 4 || y < Math.min(ay, by) - 4 || y > Math.max(ay, by) + 4) continue;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); best = Math.min(best, Math.hypot(x - ax - u * dx, y - ay - u * dy)); } } return best; };
    const busy = new Set(), mark = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) busy.add(idx(x + dx, y + dy)); };
    for (const n of NPCS) mark(n.x, n.y, 1);
    for (const s of MONSTER_SPAWNS) mark(s.tx, s.ty, 1);
    for (const pid in A.PORTS) { const p = A.port(pid); if (p) mark(Math.round(p[0]), Math.round(p[1]), 1); }
    for (const b of BUILDINGS) for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) busy.add(idx(x, y));
    const others = Object.keys(A.ANCHORS).filter(id => !IDS.includes(id) && A.box(id)).map(id => A.box(id));
    const free = (x, y) => inMap(x, y) && x > 0 && y > 0 && !busy.has(idx(x, y)) && !others.some(q => x >= q[0] - 3 && x <= q[2] + 3 && y >= q[1] - 3 && y <= q[3] + 3) && roadD(x, y) > 2.5;
    for (const id of IDS) {
      const b = A.box(id);
      for (let y = b[1] - RING; y <= b[3] + RING; y++) for (let x = b[0] - RING; x <= b[2] + RING; x++) {
        const d = Math.max(b[0] - x, x - b[2], b[1] - y, y - b[3]); if (d < 1) continue;
        const r = rnd();
        if (!free(x, y) || at(x, y) !== T.GRASS) continue;
        // (worn most by the box, gone by four tiles out; the rest of the ring keeps its grass and its wood)
        if (r < 0.22 * (1 - (d - 1) / 4)) { set(x, y, T.DIRT); S.ring++; }
      }
    }
  });

  // ---------- the solid things: what E says, and how each is drawn (the ground beneath first, then the thing) ----------
  HOOKS.use.push((t, tx, ty) => {
    if (window.__instance || t !== SOLID_T()) return false;
    const c = THINGS.get(idx(tx, ty)), k = c && PK[c.kind]; if (!k) return false;
    const words = typeof k.use === 'function' ? k.use(c, tx, ty) : k.use;
    if (typeof words === 'string') notify(words);
    return true;
  });
  HOOKS.draw.push((g, items) => {
    if (window.__instance || !THINGS.size) return;
    const vis = (x, y, r) => x + r > cam.x && x - r < cam.x + VW && y + r > cam.y && y - r < cam.y + VH;
    for (const [i, c] of THINGS) {
      const tx = i % MAP_W, ty = (i / MAP_W) | 0, px = tx * TILE, py = ty * TILE;
      if (map[i] !== SOLID_T() || !vis(px + TILE / 2, py + TILE / 2, TILE)) continue;
      const v = variant[i] % 3;
      items.push({ y: -1e9 + 1, draw: () => { const img = tex[TEX_NAME[c.under] + v]; if (img) g.drawImage(img, px, py, TILE, TILE); } });
      if (c.kind === 'target') items.push({ y: py + TILE - 4, draw: () => PK.target.draw(g, px, py) });
    }
    // each tower once, sorted at its foot (it stands four tiles tall over its base)
    for (const tw of TOWERS) {
      const [sx, sy] = stepOf(tw), c = THINGS.get(idx(sx, sy - 1));
      if (!c || c.tower !== tw || map[idx(sx, sy - 1)] !== SOLID_T() || !vis((sx + 0.5) * TILE, (sy - 2.5) * TILE, TOWER_REACH)) continue;
      items.push({ y: sy * TILE - 3, draw: () => drawTower(g, tw) });
    }
  });
  // night: each beacon's fire and its door lantern light the dark (35-night's overworld scrim)
  const beaconLights = (out, x0, y0, x1, y1) => {
    if (window.__instance || !lit() || !THINGS.size) return;
    for (const tw of TOWERS) { const [sx, sy] = stepOf(tw); if (sx < x0 - 4 || sx > x1 + 4 || sy < y0 - 4 || sy > y1 + 8) continue;
      if (map[idx(sx, sy - 1)] !== SOLID_T()) continue;
      out.push({ x: (sx + 0.5) * TILE, y: sy * TILE - TILE * 4.6 - 20, r: 150, kind: 'beacon' });
      out.push({ x: (sx + 0.5) * TILE, y: sy * TILE - 20, r: 64, kind: 'beacon door' }); }
  };
  if (HOOKS.nightLights) HOOKS.nightLights.push(beaconLights);

  // ---------- talking ----------
  const SAID = {};
  const nextLine = n => { const k = SAID[n.id] = ((SAID[n.id] === undefined ? -1 : SAID[n.id]) + 1) % n.lines.length; return n.lines[k]; };
  // Ansel: his story a line at a time; climb all three towers and he thanks the knight once
  HOOKS.talk.beaconkeeper = n => {
    const q = W();
    if (!q.met) { q.met = 1; if (!TOWERS.every(tw => q.climbed[tw.id])) { quest.tracked = 'beacons'; notify(`New quest: The Three Beacons. ${touchMode() ? 'Tap QUESTS' : 'Press ' + keyName('J')} to read it.`); } save(); }
    if (TOWERS.every(tw => q.climbed[tw.id]) && !q.thanked) { q.thanked = 1; addItem('coins', 40); say(WORDS.allThree, n.name); burst(player.x, player.y, '#ffd166', 12, 60); save(); return; }
    say(nextLine(n), n.name);
  };
  // the quest book (J) and the map: The Three Beacons, from the first word with Ansel to his thanks (the review of bcb559f)
  QUEST_DEFS.beacons = { name: 'The Three Beacons' };
  const climbedN = () => TOWERS.filter(tw => W().climbed[tw.id]).length;
  HOOKS.questText.beacons = () => { const q = W(); return q.thanked ? 'Done.' : climbedN() === TOWERS.length ? 'All three towers climbed! Go back and tell Ansel.' : `Climb the three beacon towers on Beacon Hills (${climbedN()}/${TOWERS.length}). Press E at a tower's door. The path up goes back and forth.`; };
  HOOKS.activeQuests.push(() => { const q = quest.wild; return q && q.met && !q.thanked ? ['beacons'] : []; });
  if (HOOKS.mapTarget) HOOKS.mapTarget.push(() => { const q = quest.wild; if (!q || !q.met || q.thanked) return null;
    const tw = TOWERS.find(t => !W().climbed[t.id]);
    if (!tw) { const a = PEOPLE[0]; return { x: a.x, y: a.y, label: a.name, id: 'beacons' }; }
    const [x, y] = stepOf(tw); return { x, y, label: tw.name.charAt(0).toUpperCase() + tw.name.slice(1), id: 'beacons' }; });
  // Hilde greets and opens her furs; Corvin gives the knight his first trap (once), then talks traps and opens his shop
  { const prev = HOOKS.talkBefore.shop;
    HOOKS.talkBefore.shop = n => {
      if (n.id === 'hilde_trapper') { say(LINES.hilde[SAID[n.id] = ((SAID[n.id] === undefined ? -1 : SAID[n.id]) + 1) % LINES.hilde.length], n.name); openPanel('shop', n.shop); return true; }
      if (n.id === 'corvin_hunter') {
        const q = W();
        if (!q.trapGift) { q.trapGift = 1; giveOrDrop('goblin_trap', 1, player.x, player.y); say(WORDS.trapGift, n.name); save(); }
        else say(LINES.corvin[SAID[n.id] = ((SAID[n.id] === undefined ? -1 : SAID[n.id]) + 1) % LINES.corvin.length], n.name);
        openPanel('shop', n.shop); return true;
      }
      return prev ? prev(n) : false;
    }; }

  // ---------- 42-playthrough: the bear on the curve ----------
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => { const m = MONSTER_DEFS.bear; add('melee', "the bear by the Hunters' Lodge", 14, m.hp * 4 + m.level * 10, 30, '86-wildplaces, one per ' + m.respawn + ' s'); });

  // ---------- the handle ----------
  window.WILDPLACES = { IDS, PLAN, LODGE, PEOPLE, LINES, WORDS, SPAWNS, spotsOf, TOWERS, stepOf, baseOf, SEE, GAP, GOBLIN_TO, DEN, POSTS, STATS, THINGS, TARGET_HITS, RANGE, FOOT, FR, climb, beaconLights };

  // ---------- self-tests ----------
  HOOKS.selfTest.push((check, Fh, h) => {
    const P = 'wildplaces: ', tiles = window.PLAYTHROUGH ? PLAYTHROUGH.pristine : map;
    const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
    const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - ax - u * dx, py - ay - u * dy); };
    const roadD = (x, y, ids) => { let b = Infinity; for (const id of ids) { const pl = A.track(id); for (let k = 1; k < pl.length; k++) b = Math.min(b, segD(x, y, pl[k - 1][0], pl[k - 1][1], pl[k][0], pl[k][1])); } return b; };
    const SG = window.SPREAD_GROUND;
    // a 4-connected walk from the cave mouth over the fresh map (closed: tiles shut for the walk)
    const walk = closed => { const N = MAP_W * MAP_H, seen = new Uint8Array(N), q = new Int32Array(N); let n = 0;
      const pass = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || t === Tn('WARDEN_GATE') || t === Tn('LAIR_GATE');
      const take = i => { if (!seen[i] && pass(tiles[i]) && !(closed && closed.has(i))) { seen[i] = 1; q[n++] = i; } };
      const [mx, my] = A.port('cave.mouth'); take(idx(mx, my));
      for (let k = 0; k < n; k++) { const c = q[k], x = c % MAP_W; if (x > 0) take(c - 1); if (x < MAP_W - 1) take(c + 1); if (c >= MAP_W) take(c - MAP_W); if (c + MAP_W < N) take(c + MAP_W); }
      return (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inMap(x + dx, y + dy) && seen[idx(x + dx, y + dy)]); };
    const reach = walk();

    // 1. built: no stake or plaque of theirs left, each region names the place, WORLD_REV 4 with the footprint
    { const left = SG ? [...SG.PROPS.values()].filter(p => IDS.includes(p.place)).length : -1;
      const regs = IDS.map(id => REGIONS.find(r => r.atlas === id));
      const subs = regs.every((r, k) => r && r.sub === A.BUILT.get(IDS[k]).sub && !/staked/.test(r.sub));
      const R = A.REVS && A.REVS[4], foot = !!R && IDS.every(id => R.boxes.some(b => { const q = A.box(id); return b[0] <= q[0] - RING && b[1] <= q[1] - RING && b[2] >= q[2] + RING && b[3] >= q[3] + RING; }));
      const den = !!R && SPAWNS.filter(s => s.type === 'bear').every(s => spotsOf(s).every(([x, y]) => R.boxes.some(b => inB(b, x - 1, y - 1) && inB(b, x + 1, y + 1))));
      check(P + "Beacon Hills and the Hunters' Lodge are built: their builders' stakes and plaques are gone, each region names the place, and WORLD_REV 4 declares each box with its 6-tile ring (and the bear's den) as its footprint",
        left === 0 && STATS.stakes > 0 && subs && WORLD_REV >= 4 && foot && den && IDS.every(id => A.isBuilt(id)), { left, stakes: STATS.stakes, subs: regs.map(r => r && r.sub), WORLD_REV, foot, den }); }

    // 2. the ridge: three towers on their ports (solid, six cells each), the crest reached from the cave mouth only up the
    // switchback (with its top shut, no tower is reached), the rim all rock face
    { const bad = [];
      for (const tw of TOWERS) { const base = baseOf(tw), [sx, sy] = stepOf(tw);
        if (!base.every(([x, y]) => tiles[idx(x, y)] === SOLID_T() && THINGS.get(idx(x, y)) && THINGS.get(idx(x, y)).tower === tw)) bad.push(tw.id + ' base');
        if (SOLID.has(tiles[idx(sx, sy)]) || !reach(sx, sy)) bad.push(tw.id + ' step not reached'); }
      const [gx, gy] = GAP(), shut = walk(new Set([idx(gx, gy)]));
      const cut = TOWERS.filter(tw => shut(...stepOf(tw))).map(tw => tw.id);
      const rim = PLAN.beacon_hills.join('').split('').filter(c => c === '#').length;
      check(P + 'Beacon Hills: three beacon towers stand on the crest at the Beacon Path\'s ports, each a solid base three wide with its door over the step; a knight reaches every step from the cave mouth, but only up the switchback (shut its top and no tower is reached)',
        !bad.length && !cut.length && rim > 60, { bad, cut, rim }); }

    // 3. a climb: from the step, E on the tower's door marks every map marker within 60 tiles as seen (and none past it),
    // trains Agility the first time, and the tower is remembered as climbed; at night the three fires light the dark
    { const keep = { seen: JSON.parse(JSON.stringify(MARKERS.state().seen)), wild: JSON.parse(JSON.stringify(quest.wild || {})), x: player.x, y: player.y, f: { ...player.facing }, skills: JSON.parse(JSON.stringify(player.skills)), day: player.dayTime };
      const res = {};
      try {
        const tw = TOWERS[1], [sx, sy] = stepOf(tw);
        MARKERS.state().seen = {}; quest.wild = {};
        const ag0 = player.skills.agility.xp;
        Fh.tp(sx, sy); player.facing = { x: 0, y: -1 }; notice = null; dialog.queue.length = 0; advanceDialog(); useAction();
        const s = MARKERS.state().seen, all = MARKERS.all();
        res.near = all.filter(m => Math.hypot(m.x - sx, m.y - sy) <= SEE).length; res.marked = all.filter(m => s[m.key] && Math.hypot(m.x - sx, m.y - sy) <= SEE).length;
        res.far = all.filter(m => s[m.key] && Math.hypot(m.x - sx, m.y - sy) > SEE + 12).length;
        res.agility = player.skills.agility.xp - ag0; res.climbed = !!W().climbed[tw.id];
        const d = [dialog.cur, ...dialog.queue].find(q => q && q.who === 'The Voice'); res.words = d && d.text;
        const ag1 = player.skills.agility.xp; dialog.queue.length = 0; advanceDialog(); useAction(); res.again = player.skills.agility.xp - ag1;
        const lights = (dayTime) => { player.dayTime = dayTime; const out = []; beaconLights(out, 0, 0, MAP_W - 1, MAP_H - 1); return out.filter(l => l.kind === 'beacon').length; };
        res.dark = lights(540); res.day = lights(100);
      } finally { MARKERS.state().seen = keep.seen; quest.wild = keep.wild; player.x = keep.x; player.y = keep.y; player.facing = keep.f; player.skills = keep.skills; player.dayTime = keep.day; dialog.queue.length = 0; advanceDialog(); }
      check(P + 'climbing a beacon tower marks every map marker within 60 tiles as seen (none past it), the first climb trains Agility and the second does not, the tower is remembered; at night the three beacon fires light the dark, by day none',
        res.near > 0 && res.marked === res.near && res.far === 0 && res.agility === 25 && res.again === 0 && res.climbed && /new place|on your map already/.test(res.words || '') && res.dark === 3 && res.day === 0, res); }

    // 4. the people: on open ground in their own place (the Atlas zone is the place), reached from the cave mouth, in the
    // townsfolk look; the rails, the targets, the den's mouth are reached too
    { const bad = [];
      for (const p of PEOPLE) {
        const zone = A.zoneAt('over', p.x, p.y), id = IDS.find(i => inB(A.box(i), p.x, p.y));
        if (!NPCS.includes(p)) bad.push(p.id + ' not in NPCS');
        if (SOLID.has(tileAt(p.x, p.y))) bad.push(p.id + ' on ' + tileName(tileAt(p.x, p.y)));
        if (!reach(p.x, p.y)) bad.push(p.id + ' not reached from the cave');
        if (!id || zone !== id) bad.push(p.id + ' zone ' + zone);
        if (!TOWNSFOLK_ART.NEW_NPC[p.id]) bad.push(p.id + ' has no look');
      }
      if (insideBuilding(PEOPLE[1].x, PEOPLE[1].y) !== LODGE) bad.push('Hilde is not inside the lodge');
      for (const id of IDS) { const p = POSTS[id]; if (!p || tileAt(p.x, p.y) !== T.HITCH || !reach(p.x, p.y)) bad.push(id + ' rail'); }
      for (const [i, c] of THINGS) if (c.kind === 'target' && !reach(i % MAP_W, (i / MAP_W) | 0)) bad.push('target not reached');
      for (const s of SPAWNS) for (const [x, y] of spotsOf(s)) if (!reach(x, y)) bad.push(s.type + ' not reached');
      check(P + "Ansel stands on the crest, Hilde in the lodge, Corvin by the range, each in the townsfolk look and in his own place's Atlas zone; a knight walks to each of them, to both rails, the three targets and every new creature from the cave mouth",
        !bad.length, { bad }); }

    // 5. they talk: plain words, short, no compass word (the signposts give the ways); Ansel a line at a time
    { const said = [];
      const lines = Object.values(LINES).flat().concat(Object.values(WORDS));
      { const p = PEOPLE[0], keep = SAID[p.id]; for (let k = 0; k < p.lines.length; k++) { dialog.queue.length = 0; advanceDialog(); closePanel(); talkTo(p); const d = [dialog.cur, ...dialog.queue].find(q => q && q.who === p.name); said.push(d ? d.text : null); } SAID[p.id] = keep; closePanel(); dialog.queue.length = 0; advanceDialog(); }
      check(P + 'Ansel tells his story a line at a time; every line of the three (and every word they say) is short and plain, with no compass word',
        LINES.ansel.every(t => said.includes(t)) && lines.every(t => t.length <= 140 && !/\b(north|south|east|west)\b|\bmiles?\b/i.test(t)), { said }); }

    // 6. the services: Hilde opens her furs and pays full price for a pelt (and says what she buys); Corvin gives the first
    // trap once, then opens his shop of traps, a bow and arrows; climbing all three towers earns Ansel's thanks once
    { const keep = { inv: JSON.parse(JSON.stringify(player.inv)), wild: JSON.parse(JSON.stringify(quest.wild || {})) };
      const res = {};
      try {
        player.inv = new Array(INV_SLOTS).fill(null); quest.wild = {};
        const [hilde, corvin, ansel] = [PEOPLE[1], PEOPLE[0 + 2], PEOPLE[0]];
        talkTo(hilde); res.hildeShop = panel === 'shop' && panelArg === 'lodge_pelts'; closePanel(); dialog.queue.length = 0; advanceDialog();
        const sh = SHOPS.lodge_pelts; res.buys = ['wolf_pelt', 'bear_pelt', 'snakeskin'].every(id => sh.buys.includes(id)) && sh.rate === 1 && sh.buysWords === WORDS.pelts;
        talkTo(corvin); res.gift = countItem('goblin_trap'); res.corvinShop = panel === 'shop' && panelArg === 'lodge_traps'; closePanel(); dialog.queue.length = 0; advanceDialog();
        talkTo(corvin); res.gift2 = countItem('goblin_trap'); closePanel(); dialog.queue.length = 0; advanceDialog();
        res.stock = ['goblin_trap', 'shortbow', 'stone_arrow'].every(id => SHOPS.lodge_traps.stock.some(([k]) => k === id));
        // (the review of bcb559f) Corvin buys nothing, and his panel says so: no "Tap your pack to sell", no empty "SELLS FOR
        // FULL PRICE:"; the crow's feathers have a buyer (Hilde)
        res.corvinHead = shopSellHead(SHOPS.lodge_traps); res.corvinSub = shopSubtitle(SHOPS.lodge_traps);
        res.corvinPanel = res.corvinHead === WORDS.traps.toUpperCase() && !/tap your pack/i.test(res.corvinSub) && /tap your pack/i.test(shopSubtitle(sh));
        res.feathers = sh.buys.includes('crow_feather');
        const c0 = coins(); for (const tw of TOWERS) W().climbed[tw.id] = 1;
        talkTo(ansel); res.thanks = coins() - c0; talkTo(ansel); res.thanks2 = coins() - c0; dialog.queue.length = 0; advanceDialog();
      } finally { player.inv = keep.inv; quest.wild = keep.wild; closePanel(); dialog.queue.length = 0; advanceDialog(); }
      check(P + "the services: Hilde's furs open and she buys wolf and bear pelts, snakeskin and crow feathers at full price; Corvin gives one goblin trap the first time only, and sells traps, a bow and arrows (his panel says he buys nothing, and never asks for a tap on the pack); with all three towers climbed Ansel gives 40 coins, once",
        res.hildeShop && res.buys && res.corvinPanel && res.feathers && res.gift === 1 && res.gift2 === 1 && res.corvinShop && res.stock && res.thanks === 40 && res.thanks2 === 40, res); }

    // 7. the range: an arrow shot from the worn line strikes a target (it trains Ranged and lands at the target's foot)
    { const keep = { inv: JSON.parse(JSON.stringify(player.inv)), eq: JSON.parse(JSON.stringify(player.equip)), x: player.x, y: player.y, f: { ...player.facing }, skills: JSON.parse(JSON.stringify(player.skills)) };
      const res = {};
      try {
        const tgt = [...THINGS].find(([, c]) => c.kind === 'target'), tx = tgt[0] % MAP_W, ty = (tgt[0] / MAP_W) | 0;
        h.give('shortbow', 1); h.give('stone_arrow', 5); equipItem(player.inv.findIndex(s => s && s.id === 'shortbow'));
        Fh.tp(tx, ty + 3); player.facing = { x: 0, y: -1 }; player.attackCd = 0; h.peace(true);
        const hits0 = RANGE.hits, d0 = drops.length; playerAttack(); Fh.sim(60, []);
        res.hits = RANGE.hits - hits0; res.dropped = drops.slice(d0).some(d => d.id === 'stone_arrow' && Math.floor(d.y / TILE) === ty + 1 && Math.floor(d.x / TILE) === tx);
        res.solid = [...THINGS.values()].filter(c => c.kind === 'target').length;
        h.peace(false);
      } finally { player.inv = keep.inv; player.equip = keep.eq; player.x = keep.x; player.y = keep.y; player.facing = keep.f; player.skills = keep.skills; }
      check(P + "the Hunters' Lodge range: three solid targets; an arrow shot from the worn line strikes one and lands at its foot", res.solid === 3 && res.hits === 1 && res.dropped, res); }

    // 8. the creatures: Beacon Hills' crows, snakes and an adder in its box (its Atlas zone), each at its kind's level; the
    // goblin that stood there moved out; the bear lv 14 in her den, the only spawn there, beyond sight and roam of the road
    { const bad = [], mine = MONSTER_SPAWNS.filter(s => /^86-wildplaces/.test(s.by || ''));
      const bh = A.box('beacon_hills');
      for (const s of mine) {
        const lv = MONSTER_DEFS[s.type].level;
        if (s.by === '86-wildplaces:beacon_hills' && (!inB(bh, s.tx, s.ty) || A.zoneAt('over', s.tx, s.ty) !== 'beacon_hills' || lv < 2 || lv > 6)) bad.push(s.type + '@' + s.tx + ',' + s.ty + ' ' + A.zoneAt('over', s.tx, s.ty));
        if (SOLID.has(tiles[idx(s.tx, s.ty)])) bad.push(s.type + ' on solid ground');
      }
      const others = MONSTER_SPAWNS.filter(s => !/^86-wildplaces/.test(s.by || '') && inB(bh, s.tx, s.ty)).map(s => s.type + '@' + s.tx + ',' + s.ty);
      const bears = mine.filter(s => s.type === 'bear'), B = MONSTER_DEFS.bear;
      const off = bears.map(s => roadD(s.tx, s.ty, A.MAIN_ROADS)), need = B.roam + B.sight / TILE + 1.5;
      const inDen = bears.every(s => inB(DEN(), s.tx, s.ty)), lodgeBox = MONSTER_SPAWNS.filter(s => inB(A.box('hunters_lodge'), s.tx, s.ty)).length;
      check(P + "the creatures: Beacon Hills' two crows, two snakes and an adder (levels 2 to 6) wake in its box and Atlas zone, and no other kind does there (its goblin moved off the ridge); the bear (lv 14, attacks at 4 tiles, keeps to 2 of her den) wakes in her den past the road, farther from every main road than she sees and roams",
        !bad.length && !others.length && mine.filter(s => s.by === '86-wildplaces:beacon_hills').length === 5 && bears.length === 1 && B.level === 14 && B.aggro && inDen && off.every(d => d > need) && !lodgeBox && !!STATS.goblin,
        { bad, others, off, need, inDen, lodgeBox, goblin: STATS.goblin }); }

    // 9. the rails and the signposts: a RAILS entry on a HITCH tile in each place; the two signposts (the Beacon fork's and
    // the Lodge's) name the places without "builders at work"; nothing built here stands on a main road
    { const rails = IDS.map(id => { const r = RAILS.find(q => q.id === id), p = r && r.at(); return !!p && inB(A.box(id), p.x, p.y) && tileAt(p.x, p.y) === T.HITCH && RAILS.of(p.x, p.y) === r && !r.reserved; });
      const words = SG ? SG.signs.map(([x, y]) => A.signText(x, y)) : [];
      const builders = words.filter(t => /(Beacon Hills|Hunters' Lodge) \(builders at work\)/.test(t));
      const named = ['Beacon Hills', "Hunters' Lodge"].every(nm => words.some(t => t.includes(nm)));
      const onRoad = []; for (const id of IDS) PLAN[id].forEach((row, ry) => [...row].forEach((c, rx) => { const [x, y] = FR[id].p(rx, ry); if (/[#oHtWNE]/.test(c) && A.onMainRoad(x, y)) onRoad.push(c + '@' + x + ',' + y); }));
      for (let y = LODGE.y; y < LODGE.y + LODGE.h; y++) for (let x = LODGE.x; x < LODGE.x + LODGE.w; x++) if (A.onMainRoad(x, y)) onRoad.push('lodge@' + x + ',' + y);
      check(P + "each place has its hitching rail (a RAILS entry, on a HITCH tile in its box); the signposts name Beacon Hills and the Hunters' Lodge without \"builders at work\"; nothing built here stands on a main road",
        rails.every(Boolean) && !builders.length && named && !onRoad.length, { rails, builders, onRoad }); }

    // 10. its ground is its own: placing here says whose it is
    { h.give('goblin_trap', 2); h.peace(true);
      const res = {};
      for (const [id, F, rx, ry] of [['beacon_hills', BH, 5, 19], ['hunters_lodge', HL, 9, 5]]) {
        const [x, y] = F.p(rx, ry), n0 = countItem('goblin_trap'); Fh.tp(x, y); player.facing = { x: 0, y: -1 }; notice = null; placeAction('goblin_trap');
        res[id] = { placed: countItem('goblin_trap') < n0, notice: notice && notice.text };
      }
      h.peace(false);
      check(P + "nothing is built on their ground: \"This is Beacon Hills' ground. Build somewhere else.\" and the Hunters' Lodge's likewise",
        !res.beacon_hills.placed && res.beacon_hills.notice === "This is Beacon Hills' ground. Build somewhere else." && !res.hunters_lodge.placed && res.hunters_lodge.notice === "This is the Hunters' Lodge's ground. Build somewhere else.", res); }
  });
}
