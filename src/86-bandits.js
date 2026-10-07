// ============================================================================
// THE BANDIT HILLS (the Great Spread, Stage 5f: ~/.fanglands/work/spread/spec.md §4 "New places", §6, §13 STAGE 5)
// src/86-bandits.js
//
// The jungle's north-east corner on the Grey Sea's south shore, built on its staked ground (93-spread staked it in Stage 4):
//
//   THE APPROACH     the Bandit Track comes down from Hollowford through rock-and-scrub hills (the jungle cut back to
//                    thorn scrub, boulders and dead trees). A signpost where the track comes into the hills, and Wat the
//                    carter with his rail: the bandits took his cart at their toll gate.
//   THE TOLL GATE    the track ends at a gap in a ring of rock (CLIFF): the bandits' gate, its pole raised, and their toll
//                    booth beside it (bandit_hills.toll). The ring runs round the hollow on three sides; the river that
//                    runs down to the sea closes the fourth. The gap is the one way in on foot.
//   THE HOLLOW       the bandits' camp: two tents, a fire (cook on it), their sacks of stolen goods, Wat's cart, and in
//                    the rock at the back the mouth of their hideout, staked by the builders for later (an instance:
//                    "Builders' stakes. The Bandit Hideout is coming."; port bandit_hills.hideout is the step before it).
//
// The bandits are people (MONSTER_DEFS `human`: they walk like people, traps do not catch them, and they die as 'person'
// in 79-deaths), drawn with the core's drawHuman (MONSTER_LOOK.addType): four bandits (lv 12), two bandit archers (lv 15,
// throwers: they keep back and throw bombs) and the bandit chief (lv 20). The spec's ranges (12-14, 15-17) take their low
// end, as 87-critters and 86-wildplaces did. A fight the knight chooses: the track ends at the gate, no main road comes near
// (the nearest is 40+ tiles off), and none of them can see Wat, his rail or the signpost. Multi combat (markBuilt's
// `combat`), and the Goblin Camp's respawn rule (06-systems: a spawn with `outpost` is a camp monster: down 30 minutes,
// back only while the knight is 40+ tiles away). When the last one falls: "BANDIT HILLS CLEARED", the sacks may be searched
// once, the booth is empty, and Wat thanks the knight once the chief has been beaten (once ever). The inn's notice board
// (84-crossroads' NOTICES) carries their WANTED notice.
//
// Every place: its stakes taken up, its REGIONS line its own (ATLAS.markBuilt), a rail (RAILS.add), its signpost, a person
// in the 83-townsfolk look (83-townsart's 'bandits' family), a 6-tile dressing ring outside its box (the jungle thinning
// to scrub), and its footprint in ATLAS.REVS[6] (WORLD_REV 6): the box with its ring.
//
// WHERE: every point in the place's own frame (ATLAS.planFrame: offsets from the staked box's top-left, 250,148). WHEN: on
// the finished land (HOOKS.built), as 84, 85 and the other 86 files do; Wat is taken out of NPCS before every world (a
// generateWorld wrapper, and a HOOKS.world pass). Its dice are its own (mulberry32 of its name).
// The booth, the tents, the cart and the hideout mouth are solid: 95-thistledown's TD_PROP tile with this file's side table
// (THINGS). The gate, the scrub and the sacks are DECO. The hideout's stakes and plaque are 93-spread's PROP cells (its
// side table, place 'bandit_hideout'). The signpost is a SIGN tile with this file's words (ATLAS.signText and SIGN_ARMS ask
// here first). No new tile id.
// Feature file: registers through HOOKS. window.BANDITS is the test handle.
// ============================================================================
{
  const A = ATLAS, Tn = n => (n in T ? T[n] : -1);
  const ID = 'bandit_hills';
  // built: 93-spread (which loads later) names the region for the place, not the builders; multi combat (01-atlas build)
  A.markBuilt(ID, { sub: 'Bandits behind a ring of rock', combat: 'multi' });
  const BF = A.planFrame(ID);
  const RING = 6;
  const SEED = (() => { let h = 2166136261; for (const c of '86-bandits') h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; })();

  // ---------- the plan: one glyph a tile, rows from the box's top-left (a missing glyph is '.') ----------
  //   .  the hills as the land is: jungle trees, ferns, flowers and mushrooms go to open ground, now and then thorn scrub
  //      (DECO) or a bare dry patch (its own dice); water, sand, dirt (the track) and ore stay; boulders make the hills
  //   g  open grass          ,  a worn path          #  rock face (CLIFF)          o  a boulder (ROCK)
  //   G  the toll gate (DECO: open, its pole up)          H  the hitching rail
  //   B  the toll booth, T a tent, C Wat's cart, M the hideout's mouth (solid: TD_PROP cells in THINGS)
  //   F  the fire (FIRE: cook on it)          L  the stolen sacks (DECO)          S  the signpost (SIGN, this file's words)
  //   k  a builders' stake, P the builders' plaque (93-spread's PROP, place 'bandit_hideout')          @  a person
  // The Bandit Track's own cells (its centre line, as 97-spreadchecks rounds it) are worn path wherever the plan says '.'.
  // The ring: its north wall (row 10) has the gate at the track's end (12, 10); its west wall is column 1; its south wall
  // (row 21) holds the hideout's mouth (7, 21); the river closes its east side (the water is never painted).
  const PLAN = [
    '..o......................',
    '.oo.....S................',
    '..o........oo............',
    '............oo...........',
    '.....H@,,....o...........',
    '..o......................',
    '.o.............oo........',
    '.oo......................',
    '..o....o........o........',
    '.....oo......B...........',
    '.###########G##########..',
    '.#..........,....o.......',
    '.#..T......,,....T.o.....',
    '.#........,,.............',
    '.#.......,,..............',
    '.#.L...F,,...............',
    '.#o....,,................',
    '.#.....,.................',
    '.#.....,...C.............',
    '.#.....,.................',
    '.#o...kPk................',
    '.######M####.............',
    '.........................',
  ];
  const glyph = (rx, ry) => (PLAN[ry] || '')[rx] || '.';
  // the plan's own cells of a glyph, as [rx, ry] in the frame
  const cellsOf = ch => { const out = []; PLAN.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === ch) out.push([rx, ry]); })); return out; };
  const [GATE_AT] = cellsOf('G'), [MOUTH_AT] = cellsOf('M');
  const GATE = () => BF.p(...GATE_AT);
  const MOUTH = () => BF.p(...MOUTH_AT);
  // the ring's walls: the rock face and the hideout's mouth (the gate is its one gap; the river is its fourth side), and the
  // hollow's rows: from the gate's row down to the mouth's
  const WALLS = () => cellsOf('#').concat([MOUTH_AT]);
  const HOLLOW_ROWS = () => [GATE_AT[1] + 1, MOUTH_AT[1] - 1];

  // ---------- the people (NPCS rows; the id is a look in 83-townsart's 'bandits' family) ----------
  const LINES = {
    wat_carter: [
      'Hello there. I am Wat. I carry pots and pans in my cart, from town to town.',
      'Bandits put a gate across this track. They wanted ten coins from me. I did not have ten coins.',
      'So they took my whole cart! It is in their camp, past the toll gate, inside the ring of rock.',
      'There are lots of them. Some throw bombs from far away. If one lands by your feet, step away fast!',
      'Their chief is the biggest. He swings a huge axe. Eat some food when you get hurt.',
      'Beat the chief and the rest, and the track is safe again. Then I can get my cart back.',
    ],
  };
  // after the chief has fallen: his cart is home (and, while the hills fill again, a word that the bandits are back)
  const AFTER = {
    wat_carter: [
      'My cart is home. Pots and pans for everyone!',
      'The track is safe, so I can sell my pots in every town again.',
      'Thank you again for beating the bandit chief. You are very brave.',
    ],
  };
  const BACK = {
    wat_carter: [
      'The bandits came back to their camp! My cart is safe at home, at least.',
      'You beat them once. Beat them again and the track is safe again.',
    ],
  };
  const WORDS = {
    thanks: 'You beat the bandit chief! My cart is free and the track is safe again. Thank you! Here, take these coins.',
    booth: 'The bandits\' toll booth. A board on it says: TOLL, TEN COINS. PAY OR GO HOME.',
    boothEmpty: 'The toll booth is empty. Nobody will make you pay today.',
    tent: 'A bandit tent. It smells of old socks and smoke.',
    cart: "Wat's cart, full of pots and pans. The bandits took it.",
    cartFree: "Wat's cart, full of pots and pans. Wat can fetch it now.",
    mouth: 'A dark hole in the rock: the way into the bandits\' hideout. Builders have blocked it for now.',
    gate: 'The bandits\' toll gate. The pole is up. They want you to walk in.',
    sacksGuarded: 'Sacks of stolen things. The bandits guard them. Beat them first.',
    sacksFound: 'You dig through the sacks and find 25 coins and a meat pie.',
    sacksEmpty: 'Nothing else in the sacks. The bandits will steal more when they come back.',
    scrub: 'A dry thorn bush. It scratches your knees.',
    cleared: ['BANDIT HILLS CLEARED', 'The track is safe, for now'],
  };
  const REWARD = { wat_carter: 60 };
  const PEOPLE = [
    BF.pt({ id: 'wat_carter', name: 'Wat the carter', x: 11, y: 5, place: ID, tunic: '#4e6a3e', hair: '#a8a49c', beard: true, role: 'banditwatch', lines: LINES.wat_carter }),
  ].map(n => Object.assign(n, { bandits: true }));

  // ---------- the bandits ----------
  // XP is the core's (hp x 4, and level x 10 from level 10): bandit 320, archer 342, chief 680.
  // drops: always [[id,min,max]], table [[id,min,max,weight]] ('nothing' allowed), rare {chance, table} (01-items)
  const DEFS = {
    bandit: { name: 'Bandit', level: 12, r: 13, hp: 50, att: 13, maxHit: 7, def: 11, speed: 140, aggro: true, sight: 5 * TILE, respawn: 60, human: true,
      drops: { always: [['coins', 8, 20]], table: [['nothing', 0, 0, 12], ['bread', 1, 1, 5], ['iron_dagger', 1, 1, 3], ['iron_arrow', 3, 8, 4]], rare: { chance: 30, table: [['iron_helm', 1, 1, 2], ['steel_dagger', 1, 1, 1]] } } },
    // a thrower (07-update): keeps two and a half to five tiles off and throws a sticky bomb
    bandit_archer: { name: 'Bandit archer', level: 15, r: 13, hp: 48, att: 15, maxHit: 8, def: 10, speed: 135, aggro: true, sight: 6 * TILE, respawn: 70, human: true, thrower: true,
      drops: { always: [['coins', 10, 24]], table: [['nothing', 0, 0, 10], ['iron_arrow', 5, 12, 8], ['blast_powder', 1, 1, 3], ['shortbow', 1, 1, 2]], rare: { chance: 30, table: [['oak_bow', 1, 1, 1]] } } },
    bandit_chief: { name: 'Bandit chief', level: 20, r: 15, hp: 120, att: 20, maxHit: 11, def: 16, speed: 130, aggro: true, sight: 5 * TILE, respawn: 300, human: true,
      drops: { always: [['coins', 40, 80]], table: [['meat_pie', 1, 2, 6], ['steel_dagger', 1, 1, 3], ['steel_helm', 1, 1, 2]], rare: { chance: 12, table: [['steel_sword', 1, 1, 1]] } } },
  };
  Object.assign(MONSTER_DEFS, DEFS);
  const TYPES = Object.keys(DEFS);

  // ---------- where they wake: four bandits, two archers and the chief, all in the hollow ----------
  // (the core clears trees, rocks and ore in the 3 x 3 round every spawn after the world passes: none stands by a boulder)
  const SPAWNS = [
    { type: 'bandit', at: () => BF.pts([[6, 13], [13, 14], [10, 17], [3, 18]]) },
    { type: 'bandit_archer', at: () => BF.pts([[15, 13], [9, 19]]) },
    { type: 'bandit_chief', at: () => [BF.p(5, 17)] },
  ];
  const spotsOf = s => s.at().map(([x, y]) => [Math.round(x), Math.round(y)]);

  // ---------- the Bandit Track's own cells in the box (its centre line, each point rounded to its tile) ----------
  const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
  function trackCells() {
    const out = new Set(), pl = A.track('r8_bandit'), b = A.box(ID);
    for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 20);
      for (let s = 0; s <= n; s++) { const x = Math.round(ax + (bx - ax) * s / n), y = Math.round(ay + (by - ay) * s / n); if (inB(b, x, y)) out.add(idx(x, y)); } }
    return out;
  }

  // ---------- the footprint (§10): WORLD_REV 6 ----------
  const grow = (b, d) => [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
  const FOOT = () => [grow(A.box(ID), RING)];
  if (A.REVS) A.REVS[6] = { stage: '5f', by: '86-bandits', why: 'The Bandit Hills: the box with its dressing ring', boxes: FOOT() };

  // ---------- the rail ----------
  const POSTS = {};
  if (window.RAILS) RAILS.add({ id: ID, place: 'the rail by the Bandit Hills', at: () => POSTS[ID] || null });

  // ---------- the state (quest.bandits: no positions; won (the chief beaten, ever), cleared (now), searched, thanked) ----------
  const Q = () => { if (!quest.bandits || typeof quest.bandits !== 'object') quest.bandits = {}; return quest.bandits; };
  const isBandit = m => { const s = m && m.home && campSpawnOf(m); return !!s && s.outpost === ID; };
  const gang = () => monsters.filter(m => !m.phantom && isBandit(m));
  const standing = () => gang().filter(m => !m.dead).length;

  // ---------- the look: 86-banditart (drawHuman through MONSTER_LOOK.addType; pictures only, stripped from the server's copy) ----------

  // ---------- the solid things: idx -> { kind, under } on TD_PROP cells (made in the built pass, emptied each world) ----------
  const THINGS = new Map();
  const SOLID_T = () => Tn('TD_PROP');
  const THING_REACH = TILE * 2;   // px: how far a thing's drawing reaches past its own tile (the cull)
  const shadow = (g, cx, y, rx) => { g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx, y, rx, rx * 0.28, 0, 0, 7); g.fill(); };
  const PK = {
    // the toll booth: a plank hut with a little window, a slanted roof and the board nailed by its door
    booth: { use: () => (Q().cleared && standing() === 0 ? WORDS.boothEmpty : WORDS.booth),
      draw(g, px, py) {
        const cx = px + TILE / 2, base = py + TILE - 4;
        shadow(g, cx, base, 22);
        g.fillStyle = '#6b4a2a'; g.fillRect(cx - 18, base - 34, 36, 34);
        g.strokeStyle = 'rgba(40,26,10,0.55)'; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx + k * 6, base - 34); g.lineTo(cx + k * 6, base); g.stroke(); }
        g.fillStyle = '#2a1e14'; g.fillRect(cx - 10, base - 26, 12, 9); g.fillStyle = '#8a6a3a'; g.fillRect(cx - 11, base - 18, 14, 2);
        g.fillStyle = '#5a3a22'; g.beginPath(); g.moveTo(cx - 23, base - 32); g.lineTo(cx + 23, base - 40); g.lineTo(cx + 23, base - 34); g.lineTo(cx - 23, base - 26); g.closePath(); g.fill();
        g.fillStyle = '#d9c49a'; g.fillRect(cx + 4, base - 15, 13, 9); g.fillStyle = '#7a2a1e'; g.fillRect(cx + 6, base - 13, 9, 1.6); g.fillRect(cx + 6, base - 10, 7, 1.6);
      } },
    // a bandit tent: patched brown canvas on two poles, its flap open on the dark inside
    tent: { use: WORDS.tent,
      draw(g, px, py) {
        const cx = px + TILE / 2, base = py + TILE - 5;
        shadow(g, cx, base + 1, 26);
        g.fillStyle = '#7a6448'; g.beginPath(); g.moveTo(cx - 26, base); g.lineTo(cx, base - 38); g.lineTo(cx + 26, base); g.closePath(); g.fill();
        g.fillStyle = '#5e4a34'; g.beginPath(); g.moveTo(cx, base - 38); g.lineTo(cx + 26, base); g.lineTo(cx + 10, base); g.closePath(); g.fill();
        g.fillStyle = '#1e1610'; g.beginPath(); g.moveTo(cx - 9, base); g.lineTo(cx, base - 24); g.lineTo(cx + 7, base); g.closePath(); g.fill();
        g.fillStyle = '#8e7a52'; g.fillRect(cx - 18, base - 14, 7, 6); g.fillStyle = '#6a5a3a'; g.fillRect(cx + 12, base - 20, 6, 5);
        g.strokeStyle = '#3e2c14'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, base - 38); g.lineTo(cx, base - 44); g.stroke();
      } },
    // Wat's cart: a two-wheeled cart, its load of pots and pans under a rope
    cart: { use: () => (Q().won ? WORDS.cartFree : WORDS.cart),
      draw(g, px, py) {
        const cx = px + TILE / 2, base = py + TILE - 6;
        shadow(g, cx, base + 2, 22);
        g.strokeStyle = '#6b4a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 16, base - 12); g.lineTo(cx + 30, base - 6); g.stroke();
        g.fillStyle = '#8a5a2b'; g.fillRect(cx - 19, base - 22, 36, 14); g.fillStyle = '#6b4a2a'; g.fillRect(cx - 19, base - 10, 36, 3);
        for (const [x, r, c] of [[-11, 6, '#8f96a3'], [-1, 5, '#b8732e'], [9, 6, '#6e7178']]) { g.fillStyle = c; g.beginPath(); g.arc(cx + x, base - 23, r, Math.PI, 0); g.fill(); }
        g.strokeStyle = '#c9b48a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - 19, base - 24); g.lineTo(cx + 17, base - 26); g.stroke();
        g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(cx - 2, base - 4, 8, 0, 7); g.fill(); g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(cx - 2, base - 4, 3, 0, 7); g.fill();
      } },
    // the hideout's mouth: a dark cave in the rock face, boards nailed across it
    mouth: { use: WORDS.mouth, rock: true,
      draw(g, px, py) {
        const cx = px + TILE / 2, base = py + TILE;
        g.fillStyle = '#0e0c0a'; g.beginPath(); g.moveTo(cx - 17, base); g.quadraticCurveTo(cx - 18, base - 34, cx, base - 36); g.quadraticCurveTo(cx + 18, base - 34, cx + 17, base); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(120,110,100,0.6)'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#8a6a3a'; for (const [y, a] of [[-26, -0.2], [-14, 0.15]]) { g.save(); g.translate(cx, base + y); g.rotate(a); g.fillRect(-19, -3, 38, 6); g.fillStyle = '#4a3a2a'; g.fillRect(-15, -1, 2, 2); g.fillRect(13, -1, 2, 2); g.fillStyle = '#8a6a3a'; g.restore(); }
      } },
  };

  // ---------- DECO: the toll gate, thorn scrub, the stolen sacks ----------
  DECO.kind('bandit_gate', { use: WORDS.gate, foot: 2,
    draw(g, px, py) {
      const base = py + TILE - 4;
      for (const x of [px + 4, px + TILE - 8]) { g.fillStyle = '#5a3a22'; g.fillRect(x, base - 30, 5, 30); g.fillStyle = '#3e2814'; g.fillRect(x, base - 30, 5, 3); }
      // the pole, raised: red and white bands, hinged on the left post
      g.save(); g.translate(px + 6.5, base - 26); g.rotate(-1.15);
      for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#efe6d4' : '#b8352b'; g.fillRect(k * 7, -2.5, 7, 5); }
      g.restore();
      g.fillStyle = '#3e2c14'; g.fillRect(px + TILE - 9, base - 22, 7, 3);
    } });
  DECO.kind('bandit_scrub', { use: WORDS.scrub,
    draw(g, px, py, c, tx, ty) {
      const cx = px + TILE / 2 + ((tx * 7 + ty * 3) % 9) - 4, base = py + TILE - 8 - ((tx + ty * 5) % 5);
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.ellipse(cx, base + 3, 13, 4, 0, 0, 7); g.fill();
      g.strokeStyle = '#6a5a3a'; g.lineWidth = 1.4;
      for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.38; g.beginPath(); g.moveTo(cx, base); g.lineTo(cx + Math.cos(a) * (10 + (k % 3) * 2), base + Math.sin(a) * (11 + (k % 2) * 3)); g.stroke(); }
      for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#7d7a42' : '#8e8a4c'; g.beginPath(); g.ellipse(cx + ((k * 11) % 16) - 8, base - 6 - ((k * 5) % 8), 4, 2.6, k * 0.8, 0, 7); g.fill(); }
    } });
  DECO.kind('bandit_sacks', { use: () => sacksUse(),
    draw(g, px, py) {
      const cx = px + TILE / 2, base = py + TILE - 6;
      shadow(g, cx, base + 2, 20);
      for (const [x, y, w, h, c] of [[-9, -8, 9, 11, '#a08a5a'], [6, -7, 10, 12, '#8e7a4e'], [-1, -16, 8, 10, '#b09a6a']]) {
        g.fillStyle = c; g.beginPath(); g.ellipse(cx + x, base + y, w, h, 0, 0, 7); g.fill(); g.fillStyle = '#5a4630'; g.fillRect(cx + x - 2, base + y - h + 1, 4, 2.5); }
      g.fillStyle = '#d9b84a'; g.beginPath(); g.arc(cx + 14, base - 1, 2.5, 0, 7); g.arc(cx + 10, base + 1, 2.2, 0, 7); g.fill();
    } });

  // ---------- the sacks: searched once a clear ----------
  function sacksUse() {
    const q = Q();
    if (!q.cleared || standing() > 0) return WORDS.sacksGuarded;
    if (q.searched) return WORDS.sacksEmpty;
    q.searched = 1; addItem('coins', 25); giveOrDrop('meat_pie', 1, player.x, player.y); sfx('open'); save();
    return WORDS.sacksFound;
  }

  // ---------- the signpost: its words and its arms ----------
  const SIGNS = new Map();   // idx -> { words, arms }
  const SIGN_WORDS = { words: '→ The Bandit Hills, through the toll gate. Bandits! Go in only when you are strong.   → Hollowford, back along the Bandit Track.',
    arms: [[-42, 'BANDITS', false, false], [-26, 'HOLLOWFORD', false, true]] };
  { const prev = A.signText; A.signText = (tx, ty) => { const s = !window.__instance && SIGNS.get(idx(tx, ty)); return s && tileAt(tx, ty) === T.SIGN ? s.words : prev(tx, ty); }; }
  let armsWrapped = false;
  const wrapArms = () => { if (armsWrapped || typeof window.SIGN_ARMS !== 'function') return; armsWrapped = true;
    const prev = window.SIGN_ARMS; window.SIGN_ARMS = (tx, ty) => { const s = !window.__instance && SIGNS.get(idx(tx, ty)); return s && tileAt(tx, ty) === T.SIGN ? s.arms : prev(tx, ty); }; };

  // ---------- the inn's notice board (84-crossroads): the WANTED notice ----------
  const NOTICE = () => (Q().won
    ? 'NEWS: A brave knight beat the bandit chief in the Bandit Hills! Wat the carter has his cart back.'
    : 'WANTED: the bandits of the Bandit Hills. They stop carts at a toll gate at the end of the Bandit Track, past Hollowford. Wat the carter will thank whoever beats their chief.');
  if (window.CROSSROADS && Array.isArray(CROSSROADS.NOTICES)) CROSSROADS.NOTICES.push(NOTICE);

  // ---------- the pass (HOOKS.built: the finished land) ----------
  // Wat out of NPCS BEFORE a world is made (the passes before HOOKS.built keep rings clear round people with dice)
  const unBuild = () => {
    THINGS.clear(); SIGNS.clear();
    for (let i = NPCS.length - 1; i >= 0; i--) if (NPCS[i].bandits) NPCS.splice(i, 1);
  };
  { const _generateWorld = generateWorld; generateWorld = function () { unBuild(); return _generateWorld.apply(this, arguments); }; }
  HOOKS.world.unshift(unBuild);
  const STATS_B = { };
  HOOKS.built.push((rnd0, api) => {
    const set = api.setTile, at = api.tileAt, rnd = mulberry32(SEED);
    const S = STATS_B; S.stakes = 0; S.cliff = 0; S.ring = 0; S.scrub = 0; S.cleared = 0; S.paths = 0; S.kept = []; S.hideout = 0;
    wrapArms();
    const SG = window.SPREAD_GROUND;
    const NATURE = new Set([T.TREE, T.OAK, T.FLOWERS, T.MUSHROOM, Tn('JUNGLE'), Tn('FERN'), Tn('PALM'), T.STUMP].filter(v => v >= 0));
    // what the plan never paints over: ore, berry bushes, signposts, chests, rock faces and water (the river closes the ring)
    const KEEP = new Set(['IRON', 'COAL', 'BLACKIRON', 'SUNSTONE', 'STORMSTONE', 'MITHRIL', 'BERRY_BUSH', 'SIGN', 'CHEST', 'CLIFF', 'WATER', 'SAND'].map(Tn).filter(v => v >= 0));
    const CLIFF = Tn('CLIFF'), box = A.box(ID), TRACK = trackCells();

    // 1. the stakes come up: each one's ground goes back
    if (SG) for (const [i, p] of [...SG.PROPS]) if (p.place === ID) { set(i % MAP_W, (i / MAP_W) | 0, p.under); SG.PROPS.delete(i); S.stakes++; }

    // 2. the plan (every tile of the box, row by row; one die for every tile, so the stream never shifts)
    // (round every spawn and person, the ground stays clear of scrub; the track's own cells are worn path)
    const quiet = new Set(), hush = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) quiet.add(idx(x + dx, y + dy)); };
    for (const s of SPAWNS) for (const [x, y] of spotsOf(s)) hush(x, y);
    for (const n of PEOPLE) hush(n.x, n.y);
    const thing = (x, y, kind) => { const t = SOLID_T(); if (t < 0) return; THINGS.set(idx(x, y), { kind, under: at(x, y) === t ? T.GRASS : (SOLID.has(at(x, y)) ? T.DIRT : at(x, y)) }); set(x, y, t); };
    const open = (x, y) => { const t = at(x, y); if (NATURE.has(t) || t === T.DIRT || SOLID.has(t) && !KEEP.has(t)) set(x, y, T.GRASS); };
    const stake = (x, y, kind) => { if (!SG || T.PROP === undefined) return; SG.PROPS.set(idx(x, y), { kind, place: 'bandit_hideout', under: T.DIRT }); set(x, y, T.PROP); S.hideout++; };
    const posts = {};
    for (let ry = 0; ry < BF.h; ry++) for (let rx = 0; rx < BF.w; rx++) {
      const ch = glyph(rx, ry), [x, y] = BF.p(rx, ry), t = at(x, y), i = idx(x, y), r = rnd();
      if (!inMap(x, y)) continue;
      if (KEEP.has(t)) { if (ch !== '.' && ch !== 'g') S.kept.push(ch + '@' + x + ',' + y + ':' + tileName(t)); continue; }
      if (ch === '.' || ch === 'g') {
        if (TRACK.has(i)) { set(x, y, T.DIRT); S.paths++; continue; }
        if (NATURE.has(t) || t === Tn('DEADTREE') || t === Tn('DEAD_TREE')) { set(x, y, T.GRASS); S.cleared++; }
        if (ch === 'g' || quiet.has(i) || at(x, y) !== T.GRASS) continue;
        // the hills: thorn scrub now and then, a bare dry patch now and then
        if (r < 0.13) { DECO.put(api, x, y, 'bandit_scrub'); S.scrub++; } else if (r < 0.16) set(x, y, T.DIRT);
        continue;
      }
      if (ch === '#') { set(x, y, CLIFF); S.cliff++; continue; }
      if (ch === ',') { set(x, y, T.DIRT); S.paths++; continue; }
      if (ch === 'o') { set(x, y, T.ROCK); continue; }
      if (ch === '@') { open(x, y); continue; }
      if (ch === 'H') { set(x, y, T.HITCH); posts[ID] = { x, y }; continue; }
      if (ch === 'F') { set(x, y, T.FIRE); continue; }
      if (ch === 'G') { set(x, y, T.DIRT); DECO.put(api, x, y, 'bandit_gate'); continue; }
      if (ch === 'L') { set(x, y, T.DIRT); DECO.put(api, x, y, 'bandit_sacks'); continue; }
      if (ch === 'S') { open(x, y); set(x, y, T.SIGN); SIGNS.set(i, SIGN_WORDS); continue; }
      if (ch === 'B') { set(x, y, T.DIRT); thing(x, y, 'booth'); continue; }
      if (ch === 'T') { set(x, y, T.DIRT); thing(x, y, 'tent'); continue; }
      if (ch === 'C') { set(x, y, T.DIRT); thing(x, y, 'cart'); continue; }
      if (ch === 'M') { set(x, y, CLIFF); thing(x, y, 'mouth'); continue; }
      if (ch === 'k') { set(x, y, T.DIRT); stake(x, y, 'stake'); continue; }
      if (ch === 'P') { set(x, y, T.DIRT); stake(x, y, 'plaque'); continue; }
    }
    Object.keys(POSTS).forEach(k => delete POSTS[k]); Object.assign(POSTS, posts);

    // 3. Wat
    for (const n of PEOPLE) { if (!NPCS.includes(n)) NPCS.push(n); initNpc(n); if (SOLID.has(at(n.x, n.y))) set(n.x, n.y, T.GRASS); }

    // 4. the bandits: each where its point says (the ground round it is open), each marked as the hills' (the camp's rule)
    for (const s of SPAWNS) {
      const pts = spotsOf(s), n0 = MONSTER_SPAWNS.length;
      for (const [x, y] of pts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (NATURE.has(at(x + dx, y + dy))) set(x + dx, y + dy, T.GRASS);
      api.spawnList(s.type, pts);
      for (let k = n0; k < MONSTER_SPAWNS.length; k++) { MONSTER_SPAWNS[k].by = '86-bandits'; MONSTER_SPAWNS[k].outpost = ID; }
    }

    // 5. the dressing ring: the jungle thins to fern, grass and thorn scrub toward the box over RING tiles (its own dice),
    // never on a road's lanes, by a person or a spawn, in the water or the Hollowford burn, or near another place's box
    const roadD = (x, y) => { let best = 99; for (const tid of A.ROAD_IDS) { const pl = A.track(tid); for (let k = 1; k < pl.length; k++) { const [ax, ay] = pl[k - 1], [bx, by] = pl[k];
      if (x < Math.min(ax, bx) - 4 || x > Math.max(ax, bx) + 4 || y < Math.min(ay, by) - 4 || y > Math.max(ay, by) + 4) continue;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); best = Math.min(best, Math.hypot(x - ax - u * dx, y - ay - u * dy)); } } return best; };
    const busy = new Set(), mark = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) busy.add(idx(x + dx, y + dy)); };
    for (const n of NPCS) mark(n.x, n.y, 1);
    for (const s of MONSTER_SPAWNS) mark(s.tx, s.ty, 1);
    for (const pid in A.PORTS) { const p = A.port(pid); if (p) mark(Math.round(p[0]), Math.round(p[1]), 1); }
    for (const b of BUILDINGS) for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) busy.add(idx(x, y));
    const others = Object.keys(A.ANCHORS).filter(id => id !== ID && A.box(id)).map(id => A.box(id));
    const JUNGLY = new Set([Tn('JUNGLE'), T.TREE, T.OAK, Tn('PALM'), Tn('FERN')].filter(v => v >= 0)), FERN = Tn('FERN');
    const free = (x, y) => inMap(x, y) && x > 0 && y > 0 && !busy.has(idx(x, y)) && !others.some(q => x >= q[0] - 3 && x <= q[2] + 3 && y >= q[1] - 3 && y <= q[3] + 3) && roadD(x, y) > 2.5;
    for (let y = box[1] - RING; y <= box[3] + RING; y++) for (let x = box[0] - RING; x <= box[2] + RING; x++) {
      const d = Math.max(box[0] - x, x - box[2], box[1] - y, y - box[3]); if (d < 1) continue;
      const r = rnd(), r2 = rnd();
      if (!free(x, y) || !JUNGLY.has(at(x, y))) continue;
      // (thinned most by the box, hardly at all six tiles out)
      if (r >= 0.85 - 0.13 * (d - 1)) continue;
      if (at(x, y) === FERN && d >= 4) continue;
      if (d <= 3 && r2 < 0.3) { set(x, y, T.GRASS); DECO.put(api, x, y, 'bandit_scrub'); S.scrub++; }
      else set(x, y, d >= 4 && FERN >= 0 ? FERN : T.GRASS);
      S.ring++;
    }
  });

  // ---------- the solid things: what E says, and how each is drawn (the ground beneath first, then the thing) ----------
  HOOKS.use.push((t, tx, ty) => {
    if (window.__instance || t !== SOLID_T()) return false;
    const c = THINGS.get(idx(tx, ty)); if (!c || !PK[c.kind]) return false;
    const u = PK[c.kind].use; notify(typeof u === 'function' ? u() : u);
    return true;
  });
  HOOKS.draw.push((g, items) => {
    if (window.__instance || !THINGS.size) return;
    for (const [i, c] of THINGS) {
      const tx = i % MAP_W, ty = (i / MAP_W) | 0, px = tx * TILE, py = ty * TILE;
      if (map[i] !== SOLID_T() || !PK[c.kind]) continue;
      if (px + TILE + THING_REACH < cam.x || px - THING_REACH > cam.x + VW || py + TILE + THING_REACH < cam.y || py - THING_REACH > cam.y + VH) continue;
      const v = variant[i] % 3, under = PK[c.kind].rock ? Tn('CLIFF') : c.under;
      items.push({ y: -1e9 + 1, draw: () => { const img = tex[TEX_NAME[under] + v]; if (img) g.drawImage(img, px, py, TILE, TILE); } });
      items.push({ y: py + TILE - 3, draw: () => PK[c.kind].draw(g, px, py) });
    }
  });

  // ---------- clearing the hills: the banner once a clear, and the sacks, the booth and the thanks it opens ----------
  HOOKS.monsterDeath.push(m => {
    if (!isBandit(m)) return;
    const q = Q();
    if (m.type === 'bandit_chief') q.won = 1;
    if (!q.cleared && gang().length && standing() === 0) {
      q.cleared = 1; q.searched = 0;
      levelBanner = { text: WORDS.cleared[0], sub: WORDS.cleared[1], t: 4 }; sfx('levelup'); save();
    }
  });
  // when one comes back, the hills are filling again: the next full clear earns the banner (and the sacks) again
  let refillT = 0;
  HOOKS.update.push(dt => {
    if (window.__instance || (refillT -= dt) > 0) return; refillT = 1;
    const q = quest.bandits; if (q && q.cleared && standing() > 0) q.cleared = 0;
  });

  // ---------- talking: Wat a line at a time; once the chief has been beaten, thanks (once ever), then his after-the-win
  // lines (the review of bcb559f: he went back to "they took my cart" after paying for it) ----------
  const SAID = {};
  // which story he tells now: 'before' the chief falls; 'after' once he has (his cart is home); 'back' while the hills are
  // filling again after that
  const mood = () => { const q = Q(); return !q.won ? 'before' : (!q.cleared && standing() > 0) ? 'back' : 'after'; };
  const linesOf = (n, m) => (m === 'before' ? n.lines : (m === 'back' ? BACK : AFTER)[n.id] || n.lines);
  const nextLine = n => { const m = mood(), L = linesOf(n, m), key = n.id + ':' + m; const k = SAID[key] = ((SAID[key] === undefined ? -1 : SAID[key]) + 1) % L.length; return L[k]; };
  HOOKS.talk.banditwatch = n => {
    const q = Q();
    if (!q.met) { q.met = 1; if (!q.won) { quest.tracked = 'wat_cart'; notify(`New quest: Wat's Cart. ${touchMode() ? 'Tap QUESTS' : 'Press ' + keyName('J')} to read it.`); } save(); }
    if (q.won && !q.thanked) { q.thanked = 1; addItem('coins', REWARD[n.id]); say(WORDS.thanks, n.name); burst(player.x, player.y, '#ffd166', 12, 60); save(); return; }
    say(nextLine(n), n.name);
  };

  // ---------- the quest book (J) and the map: Wat's Cart, from the first word with him to his thanks (the review of
  // bcb559f: the story was in no book and on no map) ----------
  QUEST_DEFS.wat_cart = { name: "Wat's Cart" };
  HOOKS.questText.wat_cart = () => { const q = Q(); return q.thanked ? 'Done.' : q.won ? 'The bandit chief is beaten! Go back and tell Wat the carter.' : "Bandits took Wat the carter's cart. Go in past their toll gate and beat the bandit chief."; };
  HOOKS.activeQuests.push(() => { const q = quest.bandits; return q && q.met && !q.thanked ? ['wat_cart'] : []; });
  if (HOOKS.mapTarget) HOOKS.mapTarget.push(() => { const q = quest.bandits; if (!q || !q.met || q.thanked) return null;
    if (q.won) { const w = PEOPLE[0]; return { x: w.x, y: w.y, label: 'Wat the carter', id: 'wat_cart' }; }
    const [x, y] = GATE().map(Math.round); return { x, y, label: "The bandits' toll gate", id: 'wat_cart' }; });

  // ---------- 42-playthrough: the bandits on the curve ----------
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    for (const [type, req, where] of [['bandit', 12, 'a bandit in the Bandit Hills'], ['bandit_archer', 15, 'a bandit archer in the Bandit Hills'], ['bandit_chief', 20, 'the bandit chief']]) {
      const m = MONSTER_DEFS[type]; add('melee', where, req, m.hp * 4 + m.level * 10, 40, '86-bandits, the camp rule: back 30 minutes after a clear');
    }
  });

  // ---------- the handle ----------
  window.BANDITS = { ID, PLAN, PEOPLE, LINES, AFTER, BACK, mood, WORDS, REWARD, DEFS, SPAWNS, spotsOf, GATE, MOUTH, WALLS, POSTS, STATS: STATS_B, THINGS, SIGNS, FOOT, BF, Q, gang, standing, isBandit, trackCells, NOTICE };

  // ---------- self-tests ----------
  HOOKS.selfTest.push((check, Fh, h) => {
    const P = 'bandits: ', tiles = window.PLAYTHROUGH ? PLAYTHROUGH.pristine : map;
    const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - ax - u * dx, py - ay - u * dy); };
    const roadD = (x, y, ids) => { let b = Infinity; for (const id of ids) { const pl = A.track(id); for (let k = 1; k < pl.length; k++) b = Math.min(b, segD(x, y, pl[k - 1][0], pl[k - 1][1], pl[k][0], pl[k][1])); } return b; };
    const SG = window.SPREAD_GROUND, box = A.box(ID), CLIFF = Tn('CLIFF');
    // a 4-connected walk from the cave mouth over the fresh map (closed: tiles shut for the walk)
    const walk = closed => { const N = MAP_W * MAP_H, seen = new Uint8Array(N), q = new Int32Array(N); let n = 0;
      const pass = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || t === Tn('WARDEN_GATE') || t === Tn('LAIR_GATE');
      const take = i => { if (!seen[i] && pass(tiles[i]) && !(closed && closed.has(i))) { seen[i] = 1; q[n++] = i; } };
      const [mx, my] = A.port('cave.mouth'); take(idx(mx, my));
      for (let k = 0; k < n; k++) { const c = q[k], x = c % MAP_W; if (x > 0) take(c - 1); if (x < MAP_W - 1) take(c + 1); if (c >= MAP_W) take(c - MAP_W); if (c + MAP_W < N) take(c + MAP_W); }
      const at = (x, y) => inMap(x, y) && !!seen[idx(x, y)];
      return Object.assign((x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy)), { at }); };
    const reach = walk();
    const mine = MONSTER_SPAWNS.filter(s => s.by === '86-bandits');
    // the hollow: every tile the ring holds (inside its walls, west of the river)
    const [r0, r1] = HOLLOW_ROWS(), west = Math.min(...WALLS().map(([rx]) => rx)) + 1;
    const hollow = []; for (let ry = r0; ry <= r1; ry++) for (let rx = west; rx < BF.w; rx++) { const [x, y] = BF.p(rx, ry); if (tiles[idx(x, y)] === T.WATER) break; hollow.push([x, y]); }

    // 1. built: no stake or plaque of theirs left, the region names the place, WORLD_REV 6 with the footprint; multi combat
    { const left = SG ? [...SG.PROPS.values()].filter(p => p.place === ID).length : -1;
      const reg = REGIONS.find(r => r.atlas === ID), sub = !!reg && reg.sub === A.BUILT.get(ID).sub && !/staked/.test(reg.sub);
      const R = A.REVS && A.REVS[6], foot = !!R && R.boxes.some(b => b[0] <= box[0] - RING && b[1] <= box[1] - RING && b[2] >= box[2] + RING && b[3] >= box[3] + RING);
      const mid = [(box[0] + box[2]) >> 1, (box[1] + box[3]) >> 1], zone = A.zoneAt('over', mid[0], mid[1]), combat = A.combatAt('over', mid[0], mid[1]);
      check(P + 'the Bandit Hills are built: their builders\' stakes and plaque are gone, the region names the place, it is multi combat, and WORLD_REV 6 declares the box with its 6-tile ring as its footprint',
        left === 0 && STATS_B.stakes > 0 && sub && WORLD_REV >= 6 && foot && A.isBuilt(ID) && zone === ID && combat === 'multi', { left, stakes: STATS_B.stakes, sub: reg && reg.sub, WORLD_REV, foot, zone, combat }); }

    // 2. the ring: rock all round the hollow but the toll gate, the river on its far side; every tile of the hollow is
    // reached from the cave mouth, and with the gate shut none is; the hideout's mouth is solid rock, staked, with its plaque;
    // nothing the plan meant to paint was ore or water
    { const walls = WALLS().map(([rx, ry]) => { const [x, y] = BF.p(rx, ry); return SOLID.has(tiles[idx(x, y)]) && (tiles[idx(x, y)] === CLIFF || THINGS.has(idx(x, y))); });
      const [gx, gy] = GATE(), shut = walk(new Set([idx(gx, gy)]));
      const open = hollow.filter(([x, y]) => !SOLID.has(tiles[idx(x, y)]));
      const reached = open.every(([x, y]) => reach.at(x, y)), sealed = open.every(([x, y]) => !shut.at(x, y));
      // the far side: each row of the hollow ends at the river
      const river = []; for (let ry = r0; ry <= r1; ry++) { let rx = west; while (rx < BF.w && tiles[idx(...BF.p(rx, ry))] !== T.WATER) rx++; river.push(rx < BF.w); }
      const [mx, my] = MOUTH(), mouth = THINGS.get(idx(mx, my)), plaque = SG && [...SG.PROPS.entries()].find(([, p]) => p.place === 'bandit_hideout' && p.kind === 'plaque');
      const stakes = SG ? [...SG.PROPS.values()].filter(p => p.place === 'bandit_hideout' && p.kind === 'stake').length : 0;
      const step = A.port('bandit_hills.hideout'), words = SG && SG.plaqueText ? SG.plaqueText('bandit_hideout') : null;
      check(P + "a ring of rock with one gap (the toll gate at the Bandit Track's end) and the river on its far side: every open tile of the hollow is reached from the cave mouth, and with the gate shut none is; the hideout's mouth is solid in the rock, two builders' stakes and a plaque before it (\"Builders' stakes. The Bandit Hideout is coming.\") on its step (bandit_hills.hideout)",
        walls.every(Boolean) && walls.length >= 40 && !SOLID.has(tiles[idx(gx, gy)]) && reach(gx, gy) && open.length >= 80 && reached && sealed && river.every(Boolean) && !!mouth && mouth.kind === 'mouth' && SOLID.has(tiles[idx(mx, my)])
        && !!plaque && plaque[0] === idx(Math.round(step[0]), Math.round(step[1])) && stakes === 2 && words === "Builders' stakes. The Bandit Hideout is coming." && reach(Math.round(step[0]), Math.round(step[1])) && !STATS_B.kept.length,
        { walls: walls.length, bad: walls.filter(b => !b).length, open: open.length, reached, sealed, river, mouth: !!mouth, plaque: !!plaque, stakes, words, kept: STATS_B.kept }); }

    // 3. the bandits: four bandits (lv 12), two archers (lv 15, throwers), the chief (lv 20); people who die as people; each
    // in the hollow (the Atlas zone, multi) on open ground, under the camp's rule; none can see Wat, his rail or the
    // signpost; no main road near; no other creature wakes in the box
    { const bad = [], want = { bandit: 4, bandit_archer: 2, bandit_chief: 1 }, got = {};
      const D = MONSTER_DEFS, lv = TYPES.map(t => [t, D[t].level]), ok = D.bandit.level === 12 && D.bandit_archer.level === 15 && D.bandit_chief.level === 20 && TYPES.every(t => D[t].human && D[t].aggro) && D.bandit_archer.thrower && !D.bandit.thrower && !D.bandit_chief.thrower;
      const dies = window.DEATHS ? TYPES.map(t => DEATHS.kindOf(t)) : [];
      const inHollow = new Set(hollow.map(([x, y]) => idx(x, y)));
      const calm = [...PEOPLE.map(p => [p.x, p.y]), ...[...SIGNS.keys()].map(i => [i % MAP_W, (i / MAP_W) | 0]), POSTS[ID] ? [POSTS[ID].x, POSTS[ID].y] : null].filter(Boolean);
      for (const s of mine) {
        got[s.type] = (got[s.type] || 0) + 1; const at = s.type + '@' + s.tx + ',' + s.ty, sight = D[s.type].sight / TILE;
        if (!inHollow.has(idx(s.tx, s.ty)) || A.zoneAt('over', s.tx, s.ty) !== ID) bad.push(at + ' zone ' + A.zoneAt('over', s.tx, s.ty));
        if (SOLID.has(tiles[idx(s.tx, s.ty)]) || !reach(s.tx, s.ty)) bad.push(at + ' not on open ground reached');
        for (const [x, y] of calm) if (Math.hypot(x - s.tx, y - s.ty) <= sight + 2.5) bad.push(at + ' sees ' + x + ',' + y);
        if (roadD(s.tx, s.ty, A.MAIN_ROADS) < 6) bad.push(at + ' by a main road');
        const m = monsters.find(q => Math.floor(q.home.x / TILE) === s.tx && Math.floor(q.home.y / TILE) === s.ty && q.type === s.type);
        if (!m || !isCampMonster(m) || isGoblinCampMonster(m) || !isBandit(m)) bad.push(at + ' not under the camp rule');
      }
      const others = MONSTER_SPAWNS.filter(s => s.by !== '86-bandits' && inB(box, s.tx, s.ty)).map(s => s.type + '@' + s.tx + ',' + s.ty);
      check(P + 'the hollow holds four bandits (lv 12), two bandit archers (lv 15, throwers) and the bandit chief (lv 20): people who attack on sight and die as people, each in the hollow (its Atlas zone) on open ground under the camp\'s respawn rule; none can see Wat, his rail or the signpost, none is near a main road, and no other creature wakes in the box',
        ok && dies.length === 3 && dies.every(k => k === 'person') && !bad.length && JSON.stringify(got) === JSON.stringify(want) && !others.length, { lv, dies, bad, got, others }); }

    // 5. clearing them: the last one down shows "BANDIT HILLS CLEARED" once (not the camp's banner); each stays down 30
    // minutes and waits while the knight is near; then the sacks give 25 coins and a meat pie once, the booth is empty, and Wat
    // thanks the knight once (60 coins); far off they come back and the hills fill again
    { const g = gang(), snap = g.map(m => ({ m, dead: m.dead, hp: m.hp, respawnT: m.respawnT, deadT: m.deadT, state: m.state, x: m.x, y: m.y }));
      const keep = { bq: JSON.parse(JSON.stringify(quest.bandits || {})), inv: JSON.parse(JSON.stringify(player.inv)), camp: quest.campCleared, x: player.x, y: player.y, f: { ...player.facing } };
      const res = {};
      try {
        quest.bandits = {}; quest.campCleared = false; player.inv = new Array(INV_SLOTS).fill(null);
        Fh.tp(...ATLAS.frame('drill_field').p(60, 40)); levelBanner = null; dialog.queue.length = 0; advanceDialog();
        res.guarded = sacksUse();
        const last = g.find(m => m.type === 'bandit');
        for (const m of g) if (m !== last) { m.dead = true; m.deadT = 0; m.respawnT = 999; if (m.type === 'bandit_chief') Q().won = 1; }
        res.notYet = !Q().cleared;
        const booth = [...THINGS].find(([, c]) => c.kind === 'booth'); notice = null; for (const f of HOOKS.use) if (f(SOLID_T(), booth[0] % MAP_W, (booth[0] / MAP_W) | 0)) break; res.boothBefore = notice && notice.text;
        last.dead = false; last.hp = 1; last.x = last.home.x; last.y = last.home.y; killMonster(last);
        res.banner = !!levelBanner && levelBanner.text === WORDS.cleared[0] && levelBanner.sub === WORDS.cleared[1];
        res.campBanner = quest.campCleared; res.slow = last.respawnT === CAMP_RESPAWN; res.cleared = Q().cleared === 1 && Q().won === 1;
        notice = null; for (const f of HOOKS.use) if (f(SOLID_T(), booth[0] % MAP_W, (booth[0] / MAP_W) | 0)) break; res.booth = notice && notice.text;
        const c0 = coins(); res.found = sacksUse(); res.coins = coins() - c0; res.pie = countItem('meat_pie'); res.again = sacksUse();
        const wat = PEOPLE[0]; const c1 = coins(); talkTo(wat); res.thanks = coins() - c1; talkTo(wat); res.thanks2 = coins() - c1; dialog.queue.length = 0; advanceDialog();
        res.notice = /NEWS/.test(NOTICE());
        // near (by Wat, 10 tiles off) it waits; far off it comes back, and the hills fill again
        levelBanner = null; last.respawnT = 0; Fh.tp(wat.x, wat.y + 1); h.peace(true); Fh.sim(5, []); res.waits = last.dead;
        Fh.tp(...ATLAS.frame('drill_field').p(60, 40)); Fh.sim(80, []); h.peace(false); res.back = !last.dead && Q().cleared === 0;
      } finally {
        for (const s of snap) Object.assign(s.m, { dead: s.dead, hp: s.hp, respawnT: s.respawnT, deadT: s.deadT, state: s.state, x: s.x, y: s.y });
        quest.bandits = keep.bq; player.inv = keep.inv; quest.campCleared = keep.camp; player.x = keep.x; player.y = keep.y; player.facing = keep.f; levelBanner = null; notice = null;
        dialog.queue.length = 0; advanceDialog(); drops = drops.filter(d => !g.some(m => dist(d.x, d.y, m.home.x, m.home.y) < THING_REACH));
      }
      check(P + 'clearing the hills: the last bandit down shows "BANDIT HILLS CLEARED" (not the camp\'s banner), each stays down 30 minutes and waits while the knight is near; the sacks give 25 coins and a meat pie once, the toll booth is empty, Wat thanks the knight once (60 coins) and the inn\'s notice tells the news; far off they come back and the hills fill again',
        res.guarded === WORDS.sacksGuarded && res.notYet && res.boothBefore === WORDS.booth && res.banner && !res.campBanner && res.slow && res.cleared && res.booth === WORDS.boothEmpty && res.found === WORDS.sacksFound && res.coins === 25 && res.pie === 1
        && res.again === WORDS.sacksEmpty && res.thanks === REWARD.wat_carter && res.thanks2 === REWARD.wat_carter && res.notice && res.waits && res.back, res); }

    // 6. Wat: on open ground in the place (its Atlas zone), reached from the cave mouth, in the townsfolk look; the rail, the
    // signpost, the gate, the booth, the fire, the sacks, the tents and the cart are reached too
    { const bad = [];
      for (const p of PEOPLE) {
        const zone = A.zoneAt('over', p.x, p.y);
        if (!NPCS.includes(p)) bad.push(p.id + ' not in NPCS');
        if (SOLID.has(tileAt(p.x, p.y))) bad.push(p.id + ' on ' + tileName(tileAt(p.x, p.y)));
        if (!reach(p.x, p.y)) bad.push(p.id + ' not reached from the cave');
        if (zone !== ID) bad.push(p.id + ' zone ' + zone);
        if (!TOWNSFOLK_ART.NEW_NPC[p.id]) bad.push(p.id + ' has no look');
      }
      const p = POSTS[ID]; if (!p || tileAt(p.x, p.y) !== T.HITCH || !reach(p.x, p.y)) bad.push('rail');
      for (const [i, c] of THINGS) if (c.kind !== 'mouth' && !reach(i % MAP_W, (i / MAP_W) | 0)) bad.push(c.kind + ' not reached');
      for (const k of ['bandit_sacks', 'bandit_gate']) for (const [x, y] of DECO.cells(k)) if (!reach.at(x, y)) bad.push(k + ' not reached');
      PLAN.forEach((row, ry) => [...row].forEach((c, rx) => { if (c !== 'F') return; const [x, y] = BF.p(rx, ry); if (tileAt(x, y) !== T.FIRE || !reach(x, y)) bad.push('fire'); }));
      const kinds = [...THINGS.values()].map(c => c.kind).sort().join();
      check(P + 'Wat the carter stands by the Bandit Track in the place\'s Atlas zone in the townsfolk look; a knight walks to him, the rail, the signpost, the toll gate and booth, and in the hollow the fire (cook on it), the sacks, the two tents and Wat\'s cart, from the cave mouth',
        !bad.length && kinds === 'booth,cart,mouth,tent,tent', { bad, kinds }); }

    // 7. Wat talks: a line at a time; plain words, short, no compass word
    // (after the chief has fallen his cart is home: only his after-the-win lines, and while the hills fill again that the
    // bandits came back; never "they took my cart" again: the review of bcb559f)
    { const said = {}; const keep = { s: Object.assign({}, SAID), bq: JSON.parse(JSON.stringify(quest.bandits || {})) };
      const p = PEOPLE[0], up = gang().filter(m => !m.dead).length > 0;
      const MOODS = { before: {}, after: { won: 1, cleared: 1, thanked: 1, searched: 1 }, back: { won: 1, cleared: 0, thanked: 1 } };
      const want = m => m === 'before' ? p.lines : (m === 'after' ? AFTER : BACK)[p.id];
      for (const m of Object.keys(MOODS)) { quest.bandits = Object.assign({}, MOODS[m]); said[m] = [];
        for (let k = 0; k < want(m).length + 2; k++) { dialog.queue.length = 0; advanceDialog(); talkTo(p); const d = [dialog.cur, ...dialog.queue].find(q => q && q.who === p.name); said[m].push(d ? d.text : null); } }
      Object.keys(SAID).forEach(k => delete SAID[k]); Object.assign(SAID, keep.s); quest.bandits = keep.bq; dialog.queue.length = 0; advanceDialog();
      const lines = LINES.wat_carter.concat(AFTER.wat_carter, BACK.wat_carter, [WORDS.thanks, WORDS.booth, WORDS.boothEmpty, WORDS.tent, WORDS.cart, WORDS.cartFree, WORDS.mouth, WORDS.gate, WORDS.sacksGuarded, WORDS.sacksFound, WORDS.sacksEmpty, WORDS.scrub]);
      const told = up && Object.keys(MOODS).every(m => want(m).every(t => said[m].includes(t)) && said[m].every(t => want(m).includes(t)));
      check(P + 'Wat tells his story a line at a time; once the chief has fallen only his after-the-win lines (his cart is home), and while the hills fill again that the bandits came back; every line (and every word the hills say) is short and plain, with no compass word',
        told && lines.every(t => t.length <= 140 && !/\b(north|south|east|west)\b|\bmiles?\b/i.test(t)), { said, up }); }

    // 8. the rail, the signpost and the track: a RAILS entry on a HITCH tile in the box; a signpost by the track names the
    // Bandit Hills (its arm drawn); Hollowford's signpost no longer says "builders at work"; the Bandit Track's own cells
    // are open and none FIXED_SOLID; nothing built stands on a main road; placing on the ground says whose it is
    { const r = RAILS.find(q => q.id === ID), rp = r && r.at(), rail = !!rp && inB(box, rp.x, rp.y) && tileAt(rp.x, rp.y) === T.HITCH && RAILS.of(rp.x, rp.y) === r && !r.reserved;
      const signs = [...SIGNS.keys()].map(i => { const x = i % MAP_W, y = (i / MAP_W) | 0, w = A.signText(x, y), arms = window.SIGN_ARMS && SIGN_ARMS(x, y);
        return { at: [x, y], sign: tileAt(x, y) === T.SIGN, hills: /Bandit Hills/.test(w || ''), arms: !!arms && arms.some(a => a[1] === 'BANDITS'), track: roadD(x, y, ['r8_bandit']), reached: reach(x, y) }; });
      const words = SG ? SG.signs.map(([x, y]) => A.signText(x, y)) : [];
      const builders = words.filter(t => /Bandit Hills \(builders at work\)/i.test(t)), named = words.filter(t => /The Bandit Hills/.test(t)).length;
      const fixed = A.fixed, track = [...trackCells()].filter(i => SOLID.has(tiles[i]) || (fixed && fixed[i])).map(i => (i % MAP_W) + ',' + ((i / MAP_W) | 0) + ' ' + tileName(tiles[i]));
      const onRoad = []; PLAN.forEach((row, ry) => [...row].forEach((c, rx) => { const [x, y] = BF.p(rx, ry); if (c !== '.' && c !== 'g' && A.onMainRoad(x, y)) onRoad.push(c + '@' + x + ',' + y); }));
      h.give('goblin_trap', 2); h.peace(true);
      const [px, py] = BF.p(4, 7), n0 = countItem('goblin_trap'); Fh.tp(px, py); player.facing = { x: 0, y: 1 }; notice = null; placeAction('goblin_trap');
      const placed = { placed: countItem('goblin_trap') < n0, notice: notice && notice.text };
      h.peace(false);
      check(P + "the hills have their hitching rail (a RAILS entry, on a HITCH tile in the box); a signpost by the Bandit Track names the Bandit Hills (its arm drawn); Hollowford's signpost names them without \"builders at work\"; the track's own cells are open ground, none fixed solid; nothing built stands on a main road; \"This is the Bandit Hills' ground. Build somewhere else.\"",
        rail && signs.length === 1 && signs.every(s => s.sign && s.hills && s.arms && s.track <= 2 && s.reached) && !builders.length && named >= 1 && !track.length && !onRoad.length
        && !placed.placed && placed.notice === "This is the Bandit Hills' ground. Build somewhere else.", { rail, signs, builders, named, track, onRoad, placed }); }
  });
}
