// ============================================================================
// THE GOBLIN OUTPOSTS (the Great Spread, Stage 5e: ~/.fanglands/work/spread/spec.md §4 "New places", §6, §13 STAGE 5)
// src/86-outposts.js
//
// Two goblin outposts on the Goblin Road, each built on its staked ground (93-spread staked them in Stage 4):
//
//   THE NORTH OUTPOST   in the fields between the camp and the river, west of the road. A ring of 65-palisade's
//                       sharpened stakes with one gap, which faces the road (13 tiles off it): a worn trail runs from the
//                       road to the gap, with a signpost where it leaves the road. Inside, a lookout of lashed poles, a
//                       scrap heap and a fire. Three goblins and a sapper. Bramble the scout watches it from her hide.
//   THE SOUTH OUTPOST   below the goblin bridge, between the Goblin Road and the river's rock face (the scarp closes its
//                       corner). The ring's gap is on the far side (12 tiles off the road); the Drovers' Track ends at
//                       its wall, and a worn path goes round to the gap. Inside, a lookout over the road, a scrap heap
//                       and a fire. Three goblins and a brute. Brin the drover waits at the end of his track, with a
//                       signpost where the track leaves the road.
//
// Both are fights the knight chooses: the road passes 12+ tiles off each gap and no goblin there can see the road. Each is
// multi combat (markBuilt's `combat`: the gang fights, as at the camp), and keeps the camp's respawn rule (06-systems: a
// spawn with `outpost` is a camp monster: down 30 minutes, back only while the knight is 40+ tiles away). When the last
// one falls: "GOBLIN OUTPOST CLEARED", the heap may be dug through once, and the watcher thanks the knight (once ever).
//
// Every place: its stakes taken up, its REGIONS line its own (ATLAS.markBuilt), a rail (RAILS.add), its signpost, a person
// in the 83-townsfolk look (83-townsart's 'outposts' family), a 6-tile dressing ring of worn ground outside its box, and
// its footprint in ATLAS.REVS[5] (WORLD_REV 5): each box with its ring, and the north trail's run to the road.
//
// WHERE: every point in its place's own frame (ATLAS.planFrame: offsets from the staked box's top-left). WHEN: on the
// finished land (HOOKS.built), as 84, 85 and 86-wildplaces do; the people are taken out of NPCS before every world (a
// generateWorld wrapper, and a HOOKS.world pass). Its dice are its own (mulberry32 of its name).
// The stakes are 65-palisade's PALISADE tile (PALISADE.addRing draws them leaning out from each ring's middle; the
// bulldozer smashes them and they are driven in again). The lookouts are solid: 95-thistledown's TD_PROP tile with this
// file's side table (THINGS), as 84's well and 86-wildplaces' towers. The fire is the core's FIRE (cook on it). The heap,
// the hide and the junk are DECO. The two signposts are SIGN tiles whose words are this file's (ATLAS.signText and
// SIGN_ARMS ask here first). No new tile id.
// Feature file: registers through HOOKS. window.OUTPOSTS is the test handle.
// ============================================================================
{
  const A = ATLAS, Tn = n => (n in T ? T[n] : -1);
  const IDS = ['outpost_north', 'outpost_south'];
  // built: 93-spread (which loads later) names these regions for the place, not the builders; multi combat (01-atlas build)
  A.markBuilt('outpost_north', { sub: 'Goblins behind sharp stakes', combat: 'multi' });
  A.markBuilt('outpost_south', { sub: 'Goblins behind sharp stakes', combat: 'multi' });
  const ON = A.planFrame('outpost_north'), OS = A.planFrame('outpost_south');
  const FR = { outpost_north: ON, outpost_south: OS };
  const RING = 6;
  const SEED = (() => { let h = 2166136261; for (const c of '86-outposts') h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; })();

  // ---------- the plans: one glyph a tile, rows from the box's top-left ----------
  //   .  as the land is (a stray stretch of old dirt in the box goes back to grass)
  //   g  open grass (trees, rocks, flowers and mushrooms go; ore and berry bushes stay)
  //   ,  trampled earth or a worn path          p  sharpened stakes (65-palisade)
  //   L  the lookout (solid: a TD_PROP cell in THINGS)          F  the fire (FIRE: cook on it)
  //   s  the scrap heap (DECO)          h  the scout's hide (DECO)          H  the hitching rail
  //   S  the signpost (SIGN, this file's words)                  @  a person (open grass)
  // Ore and berry bushes are never painted over (the outposts keep theirs inside the ring); a rock face is never touched.
  // A row may run past the box: the north trail goes on to the road, the south path round below the ring.
  const PLAN = {
    // the gap is the east wall's (10, 5), toward the road; the trail runs from it to the road at (23, 5), the signpost
    // above its end
    outpost_north: [
      '.@h.......H',
      'ppppppppppp',
      'pL,,,,,,,,p',
      'p,,,,,,,,,p',
      'p,,,,F,,,,p..........S',
      'p,,,,,,,,,,,,,,,,,,,,,,,',
      'p,,,,,,,,,p',
      'p,,.,,,,s,p',
      'ppppppppppp',
    ],
    // the river's rock face (CLIFF) closes the north-east corner ((9, 1), (10, 1), (10, 2)); the gap is the bottom wall's
    // (7, 8), on the far side from the road; the Drovers' Track ends at the west wall, by Brin, and the worn path goes
    // round below the ring to the gap (it steps round an iron rock at (5, 9), which stays)
    outpost_south: [
      'gggggggg...',
      'Hpppppppp..',
      '@pL,,,,,,,.',
      ',p,,,,,,,,p',
      ',p,,,,F,,,p',
      ',p,,,,,,,,p',
      ',p,,,,,,,,p',
      ',p,,,.,,,sp',
      ',pppppp,ppp',
      ',,,,,.,,',
      '....,,,',
    ],
  };
  const GAP = { outpost_north: () => ON.p(10, 5), outpost_south: () => OS.p(7, 8) };
  const gapOf = id => GAP[id]();
  // the south outpost's signpost, where the Drovers' Track leaves the Goblin Road (west of the box: no plan row reaches it)
  const SOUTH_SIGN = () => OS.p(-2, 5);
  // the north trail's run from the box's dressing ring to the road (and its signpost): footprint beyond the ring
  const LANE = () => ON.box([17, 3, 24, 6]);

  // ---------- the people (NPCS rows; each id is a look in 83-townsart's 'outposts' family) ----------
  const LINES = {
    bramble_scout: [
      'Shh! I am Bramble, a scout from Thistledown. I watch this goblin outpost from my hide.',
      'Three goblins and a sapper live in there. The sapper is the one who throws bombs.',
      'When a bomb lands by your feet, step away fast. It goes bang a moment later.',
      'There is only one way in: the gap in the spikes. Walk into the spikes and they prick you.',
      'Beat them all and they stay away for a long while. Goblins hate losing.',
    ],
    brin_drover: [
      'I am Brin. I drive cows along this track to the inn. Then the goblins built a fence right across it!',
      'Three goblins and a big brute are in there. The brute hits very hard. Eat some food when you get hurt.',
      'The way in is round the far side. Follow the worn path round the spikes.',
      'My sister Marigold is at the Crossroads Inn. She drives cows too.',
      'My cows will not walk past goblins. Cows are clever like that.',
    ],
  };
  // while the outpost is cleared (after the thanks); and once it has been won, while it fills again
  const AFTER = {
    bramble_scout: [
      'Empty! I will keep watch in case they come back.',
      'The guards in town were very pleased when I told them about you.',
      'Goblins hate losing. They will stay away for a long while.',
    ],
    brin_drover: [
      'The cows walk this way again. Listen to them moo!',
      'Marigold at the Crossroads Inn heard what you did. She will want to thank you.',
      'Goblins do not stay away for ever. If they come back, I will tell you.',
    ],
  };
  const BACK = {
    bramble_scout: [
      'Shh! The goblins came back. Three goblins and a sapper, the same as before.',
      'You beat them once. Beat them again and they stay away for a long while.',
    ],
    brin_drover: [
      'The goblins came back! My cows will not walk past them again.',
      'You beat them once. You can beat them again. Eat some food when you get hurt.',
    ],
  };
  const WORDS = {
    thanks: {
      bramble_scout: 'You beat the whole outpost! I will tell the guards in town. Here, take this for being so brave.',
      brin_drover: 'You beat them all! Now my cows can walk this way again. Thank you! Here, it is all I have.',
    },
    lookout: 'A goblin lookout, lashed together from poles. From up there they watch the road.',
    lookoutEmpty: 'The lookout is empty. The goblins are gone, for now.',
    heapGuarded: 'A heap of goblin junk. The goblins guard it. Beat them first, then dig through it.',
    heapFound: 'You dig through the heap and find 15 coins and two bits of goblin scrap.',
    heapEmpty: 'Nothing else worth having in the heap. The goblins will bring more when they come back.',
    hide: "Bramble's hide: cut branches leaned together. From behind it she can watch without being seen.",
    junk: 'Bent nails and a broken goblin pot.',
    cleared: ['GOBLIN OUTPOST CLEARED', 'They will not be back for a while'],
  };
  const REWARD = { bramble_scout: 30, brin_drover: 40 };
  const PEOPLE = [
    ON.pt({ id: 'bramble_scout', name: 'Bramble the scout', x: 1, y: 0, place: 'outpost_north', tunic: '#4e6a3a', hair: '#7a4a24', woman: true, role: 'outpostwatch', lines: LINES.bramble_scout }),
    OS.pt({ id: 'brin_drover', name: 'Brin the drover', x: 0, y: 7, place: 'outpost_south', tunic: '#7a5a3a', hair: '#5a3a1e', beard: true, role: 'outpostwatch', lines: LINES.brin_drover }),
  ].map(n => Object.assign(n, { outposts: true }));

  // ---------- the goblins: north three goblins and a sapper, south three goblins and a brute ----------
  // (the core clears ore, trees and rocks in the 3 x 3 round every spawn after the world passes: none stands by an ore)
  const SPAWNS = [
    { place: 'outpost_north', type: 'goblin', at: () => ON.pts([[3, 3], [7, 3], [5, 6]]) },
    { place: 'outpost_north', type: 'sapper', at: () => [ON.p(7, 6)] },
    { place: 'outpost_south', type: 'goblin', at: () => OS.pts([[4, 3], [8, 3], [3, 6]]) },
    { place: 'outpost_south', type: 'brute', at: () => [OS.p(7, 6)] },
  ];
  const spotsOf = s => s.at().map(([x, y]) => [Math.round(x), Math.round(y)]);

  // ---------- the footprint (§10): WORLD_REV 5 ----------
  const grow = (b, d) => [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
  const FOOT = () => [...IDS.map(id => grow(A.box(id), RING)), LANE()];
  if (A.REVS) A.REVS[5] = { stage: '5e', by: '86-outposts', why: 'The goblin outposts: each box with its dressing ring, and the north trail to the Goblin Road', boxes: FOOT() };

  // ---------- the rails ----------
  const POSTS = {};
  const RAIL_NAMES = { outpost_north: 'the rail by the north goblin outpost', outpost_south: 'the rail by the south goblin outpost' };
  if (window.RAILS) for (const id of IDS) RAILS.add({ id, place: RAIL_NAMES[id], at: () => POSTS[id] || null });

  // ---------- the state (quest.outposts: no positions; per place: won (ever cleared), cleared (now), searched, thanked) ----------
  const Q = id => { if (!quest.outposts || typeof quest.outposts !== 'object') quest.outposts = {}; const q = quest.outposts;
    if (!q[id] || typeof q[id] !== 'object') q[id] = {}; return q[id]; };
  const outpostOf = m => { const s = m && m.home && campSpawnOf(m); return s && s.outpost && IDS.includes(s.outpost) ? s.outpost : null; };
  const gang = id => monsters.filter(m => !m.phantom && outpostOf(m) === id);
  const standing = id => gang(id).filter(m => !m.dead).length;

  // ---------- the solid things: idx -> { kind, under, place } on TD_PROP cells (made in the built pass, emptied each world) ----------
  const THINGS = new Map();
  const SOLID_T = () => Tn('TD_PROP');
  const LOOKOUT_REACH = TILE * 3;   // px: how far a lookout's drawing reaches past its base (the cull)
  const shadow = (g, cx, y, rx) => { g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx, y, rx, rx * 0.28, 0, 0, 7); g.fill(); };
  // a goblin lookout: four leaning poles lashed with rope, a plank platform two tiles up with sharpened stakes round its
  // rail, a ladder up the front and a rag flag; while the outpost holds goblins, one peeks over the rail
  function drawLookout(g, tx, ty, place) {
    const cx = (tx + 0.5) * TILE, foot = (ty + 1) * TILE - 4, top = foot - TILE * 2.3, w0 = TILE * 0.95, w1 = TILE * 0.7;
    shadow(g, cx + 4, foot, TILE * 0.6);
    g.lineCap = 'round';
    // the poles, splayed at the foot
    g.strokeStyle = '#4e3719'; g.lineWidth = 5;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * w0 / 2, foot); g.lineTo(cx + s * w1 / 2, top + 6); g.stroke(); }
    g.strokeStyle = '#3e2c14'; g.lineWidth = 4;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * w0 / 3, foot - 6); g.lineTo(cx + s * w1 / 3, top + 8); g.stroke(); }
    // cross-bracing, lashed at each end
    g.strokeStyle = '#6f5027'; g.lineWidth = 2.5;
    for (const [a, b] of [[0.15, 0.55], [0.55, 0.15]]) { const y0 = foot - (foot - top) * a, y1 = foot - (foot - top) * b;
      g.beginPath(); g.moveTo(cx - w0 / 2 + (w0 - w1) / 2 * a, y0); g.lineTo(cx + w0 / 2 - (w0 - w1) / 2 * b, y1); g.stroke(); }
    g.strokeStyle = '#7d6a45'; g.lineWidth = 1.5;
    for (const y of [foot - (foot - top) * 0.15, foot - (foot - top) * 0.55]) for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * (w0 / 2 - 4), y, 2.5, 0, 7); g.stroke(); }
    // the ladder up the front
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 2;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 6, foot); g.lineTo(cx + s * 5, top + 10); g.stroke(); }
    for (let y = foot - 8; y > top + 12; y -= 9) { g.beginPath(); g.moveTo(cx - 6, y); g.lineTo(cx + 6, y); g.stroke(); }
    // the platform
    g.fillStyle = '#7a5a32'; g.fillRect(cx - w1 / 2 - 8, top, w1 + 16, 8);
    g.strokeStyle = 'rgba(40,26,10,0.6)'; g.lineWidth = 1; g.strokeRect(cx - w1 / 2 - 8, top, w1 + 16, 8);
    for (let x = cx - w1 / 2 - 2; x < cx + w1 / 2 + 8; x += 7) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + 8); g.stroke(); }
    // a goblin on watch, peeking over the rail (while the outpost holds any)
    if (standing(place) > 0) {
      const bob = Math.sin(time * 1.6 + tx) * 1.5, gx = cx + Math.sin(time * 0.5 + ty) * 6, gy = top - 8 + bob;
      g.fillStyle = '#6d8f3a'; g.beginPath(); g.ellipse(gx, gy, 7, 6, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(20,30,10,0.6)'; g.lineWidth = 1; g.stroke();
      g.beginPath(); g.moveTo(gx - 6, gy - 2); g.lineTo(gx - 13, gy - 6); g.lineTo(gx - 6, gy + 1); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(gx + 6, gy - 2); g.lineTo(gx + 13, gy - 6); g.lineTo(gx + 6, gy + 1); g.closePath(); g.fill();
      g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(gx - 2.5, gy - 1, 1.4, 0, 7); g.arc(gx + 2.5, gy - 1, 1.4, 0, 7); g.fill();
    }
    // the rail of sharpened stakes round the platform
    for (let k = 0; k < 6; k++) { const x = cx - w1 / 2 - 6 + k * (w1 + 12) / 5, h = 12 + (k % 2) * 3;
      g.fillStyle = '#4e3719'; g.beginPath(); g.moveTo(x - 2, top + 2); g.lineTo(x + 2, top + 2); g.lineTo(x + 0.5, top - h); g.lineTo(x - 0.5, top - h); g.closePath(); g.fill();
      g.fillStyle = '#c8a874'; g.beginPath(); g.moveTo(x - 1.2, top - h + 4); g.lineTo(x + 1.2, top - h + 4); g.lineTo(x, top - h); g.closePath(); g.fill(); }
    g.strokeStyle = '#7d6a45'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - w1 / 2 - 7, top - 4); g.lineTo(cx + w1 / 2 + 7, top - 4); g.stroke();
    // a rag flag on a pole, flapping
    const fx = cx + w1 / 2 + 6, fy = top - 30, fl = Math.sin(time * 4 + tx) * 2;
    g.strokeStyle = '#3e2c14'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx, top); g.lineTo(fx, fy); g.stroke();
    g.fillStyle = '#8a2a1e'; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + 14, fy + 3 + fl); g.lineTo(fx + 10, fy + 6); g.lineTo(fx + 15, fy + 10 + fl); g.lineTo(fx, fy + 11); g.closePath(); g.fill();
    g.lineCap = 'butt';
  }

  // ---------- DECO: the scrap heap, the scout's hide, bits of junk ----------
  // the heap: a mound of earth and rust, a dented pot, a cogwheel, a broken helmet and a plank sticking out
  DECO.kind('scrap_heap', { use: c => heapUse(c),
    draw(g, px, py, c, tx) {
      const cx = px + TILE / 2, base = py + TILE - 6;
      shadow(g, cx, base + 2, 22);
      g.fillStyle = '#5a4630'; g.beginPath(); g.ellipse(cx, base - 4, 21, 11, 0, Math.PI, 0); g.fill();
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 14, base - 6); g.lineTo(cx - 4, base - 26); g.stroke();
      g.fillStyle = '#6e7178'; g.beginPath(); g.arc(cx + 7, base - 9, 7, 0, 7); g.fill(); g.strokeStyle = '#3e4046'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#3e4046'; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.fillRect(cx + 7 + Math.cos(a) * 7 - 1.5, base - 9 + Math.sin(a) * 7 - 1.5, 3, 3); }
      g.fillStyle = '#8a8e96'; g.beginPath(); g.arc(cx + 7, base - 9, 2.4, 0, 7); g.fill();
      g.fillStyle = '#7d6e62'; g.beginPath(); g.ellipse(cx - 7, base - 12, 7, 5, -0.3, 0, 7); g.fill(); g.fillStyle = '#5a4c40'; g.beginPath(); g.ellipse(cx - 7, base - 14, 5, 2.4, -0.3, 0, 7); g.fill();
      g.fillStyle = '#9a7a3a'; g.beginPath(); g.arc(cx - 1, base - 18, 5, Math.PI, 0); g.fill(); g.fillRect(cx - 7, base - 18, 12, 2);
      g.fillStyle = '#b8732e'; for (let k = 0; k < 5; k++) g.fillRect(cx - 14 + ((k * 11 + tx * 3) % 26), base - 4 - (k % 3) * 3, 3, 2);
    } });
  // the hide: cut branches leaned on a pole, with their leaves still on
  DECO.kind('hide', { use: WORDS.hide,
    draw(g, px, py) {
      const cx = px + TILE / 2, base = py + TILE - 6;
      shadow(g, cx, base + 2, 18);
      g.strokeStyle = '#5a3c22'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - 18, base - 22); g.lineTo(cx + 18, base - 24); g.stroke();
      for (let k = 0; k < 6; k++) { const x = cx + (k * 7 - 17); g.strokeStyle = '#6a4a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 3, base); g.lineTo(x + 2, base - 26); g.stroke(); }
      for (let k = 0; k < 9; k++) { const x = cx + ((k * 13) % 36 - 18), y = base - 8 - (k * 7) % 20; g.fillStyle = k % 2 ? '#4f7a32' : '#5f8a3c'; g.beginPath(); g.ellipse(x, y, 6, 4, k * 0.7, 0, 7); g.fill(); }
    } });
  DECO.kind('junk', { use: WORDS.junk,
    draw(g, px, py, c, tx, ty) {
      const cx = px + TILE / 2, cy = py + TILE / 2 + 6, r = (tx * 7 + ty * 3) % 4;
      g.fillStyle = '#6e5a46'; g.beginPath(); g.ellipse(cx - 6, cy, 6, 4, 0.2, 0, 7); g.fill(); g.fillStyle = '#4a3c30'; g.beginPath(); g.ellipse(cx - 6, cy - 1.5, 4, 1.6, 0.2, 0, 7); g.fill();
      g.strokeStyle = '#7d8087'; g.lineWidth = 1.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(cx + 2 + k * 4, cy + 4 - (k + r) % 3); g.lineTo(cx + 6 + k * 4, cy - 2 + (k + r) % 2); g.stroke(); }
    } });

  // ---------- the heap: dug through once a clear ----------
  function heapUse(c) {
    const id = placeOfCell(c);
    if (!id) return WORDS.junk;
    const q = Q(id);
    if (!q.cleared || standing(id) > 0) return WORDS.heapGuarded;
    if (q.searched) return WORDS.heapEmpty;
    q.searched = 1; addItem('coins', 15); giveOrDrop('goblin_scrap', 2, player.x, player.y); sfx('open'); save();
    return WORDS.heapFound;
  }
  const HEAPS = new Map();   // idx -> place id (the built pass)
  const placeOfCell = c => { for (const [i, id] of HEAPS) if (DECO.CELLS.get(i) === c) return id; return null; };

  // ---------- the signposts: their words and their arms ----------
  const SIGNS = new Map();   // idx -> { words, arms }
  const SIGN_WORDS = {
    outpost_north: { words: '→ The goblin outpost, west, along the trail. Goblins live behind the spikes. Go in only when you are ready to fight.', arms: [[-42, 'OUTPOST', false, true]] },
    outpost_south: { words: "→ The goblin outpost, east, at the end of the Drovers' Track.   → The Crossroads Inn, west.", arms: [[-42, 'OUTPOST', false, false], [-26, 'INN', false, true]] },
  };
  { const prev = A.signText; A.signText = (tx, ty) => { const s = !window.__instance && SIGNS.get(idx(tx, ty)); return s && tileAt(tx, ty) === T.SIGN ? s.words : prev(tx, ty); }; }
  let armsWrapped = false;
  const wrapArms = () => { if (armsWrapped || typeof window.SIGN_ARMS !== 'function') return; armsWrapped = true;
    const prev = window.SIGN_ARMS; window.SIGN_ARMS = (tx, ty) => { const s = !window.__instance && SIGNS.get(idx(tx, ty)); return s && tileAt(tx, ty) === T.SIGN ? s.arms : prev(tx, ty); }; };

  // ---------- the pass (HOOKS.built: the finished land) ----------
  // the people out of NPCS BEFORE a world is made (the passes before HOOKS.built keep rings clear round people with dice)
  const unBuild = () => {
    THINGS.clear(); HEAPS.clear(); SIGNS.clear();
    for (let i = NPCS.length - 1; i >= 0; i--) if (NPCS[i].outposts) NPCS.splice(i, 1);
  };
  { const _generateWorld = generateWorld; generateWorld = function () { unBuild(); return _generateWorld.apply(this, arguments); }; }
  HOOKS.world.unshift(unBuild);
  const STATS = {};
  HOOKS.built.push((rnd0, api) => {
    const set = api.setTile, at = api.tileAt, rnd = mulberry32(SEED);
    const S = STATS; S.stakes = 0; S.palisade = 0; S.ring = 0; S.deco = 0; S.cleared = 0; S.paths = 0; S.kept = [];
    wrapArms();
    const PAL = window.PALISADE ? PALISADE.tile : Tn('PALISADE');
    const NATURE = new Set([T.TREE, T.OAK, T.ROCK, T.FLOWERS, T.MUSHROOM, Tn('FERN'), Tn('DEADTREE'), Tn('DEAD_TREE'), T.STUMP].filter(v => v >= 0));
    // what a plan never paints over: ore, berry bushes, signposts, chests and rock faces (the scarp holds the river)
    const KEEP = new Set(['IRON', 'COAL', 'BLACKIRON', 'SUNSTONE', 'STORMSTONE', 'MITHRIL', 'BERRY_BUSH', 'SIGN', 'CHEST', 'CLIFF', 'WATER'].map(Tn).filter(v => v >= 0));
    const SG = window.SPREAD_GROUND;
    const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

    // 1. the stakes come up: each one's ground goes back
    if (SG) for (const [i, p] of [...SG.PROPS]) if (IDS.includes(p.place)) { set(i % MAP_W, (i / MAP_W) | 0, p.under); SG.PROPS.delete(i); S.stakes++; }

    // 2. the plans
    // (an apron round every stake: the trees, flowers and loose rocks on the open ground beside one go, so the ring never
    // shuts a pocket of ground, an ore or a rock a knight could reach before)
    const clearRound = (F, rows, rx, ry) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue;
      const c = (rows[ry + dy] || '')[rx + dx]; if (c !== undefined && c !== '.' && c !== 'g') continue;
      const [x, y] = F.p(rx + dx, ry + dy); if (!inMap(x, y)) continue; const t = at(x, y); if (NATURE.has(t) && !KEEP.has(t)) { set(x, y, T.GRASS); S.cleared++; } } };
    const posts = {};
    const thing = (x, y, kind, extra) => { const t = SOLID_T(); if (t < 0) return; THINGS.set(idx(x, y), Object.assign({ kind, under: at(x, y) === t ? T.GRASS : at(x, y) }, extra)); set(x, y, t); };
    const open = (x, y) => { const t = at(x, y); if (NATURE.has(t) || t === T.DIRT || SOLID.has(t) && !KEEP.has(t)) set(x, y, T.GRASS); };
    for (const id of IDS) {
      const F = FR[id], rows = PLAN[id], box = A.box(id);
      for (let ry = 0; ry < rows.length; ry++) for (let rx = 0; rx < rows[ry].length; rx++) {
        const ch = rows[ry][rx], [x, y] = F.p(rx, ry), t = at(x, y);
        if (!inMap(x, y)) continue;
        if (KEEP.has(t)) { if (ch !== '.' && ch !== 'g') S.kept.push(ch + '@' + x + ',' + y + ':' + tileName(t)); continue; }
        if (ch === '.') { if (inB(box, x, y) && t === T.DIRT && !A.onMainRoad(x, y)) set(x, y, T.GRASS); continue; }
        if (ch === 'g') { if (NATURE.has(t)) { set(x, y, T.GRASS); S.cleared++; } else if (t === T.DIRT && inB(box, x, y) && !A.onMainRoad(x, y)) set(x, y, T.GRASS); continue; }
        if (ch === 'p') { set(x, y, PAL); S.palisade++; clearRound(F, rows, rx, ry); continue; }
        if (ch === ',') { set(x, y, T.DIRT); S.paths++; continue; }
        if (ch === '@') { open(x, y); continue; }
        if (ch === 'H') { set(x, y, T.HITCH); posts[id] = { x, y }; continue; }
        if (ch === 'F') { set(x, y, T.FIRE); continue; }
        if (ch === 'L') { set(x, y, T.DIRT); thing(x, y, 'lookout', { place: id }); continue; }
        if (ch === 's') { set(x, y, T.DIRT); DECO.put(api, x, y, 'scrap_heap'); HEAPS.set(idx(x, y), id); S.deco++; continue; }
        if (ch === 'h') { open(x, y); DECO.put(api, x, y, 'hide'); S.deco++; continue; }
        if (ch === 'S') { open(x, y); set(x, y, T.SIGN); SIGNS.set(idx(x, y), SIGN_WORDS[id]); continue; }
      }
      // the ring, drawn by 65-palisade (its points lean out from the ring's middle)
      if (window.PALISADE && PALISADE.addRing) { const [x0, y0] = F.p(0, 1), [x1, y1] = F.p(rows[1].length - 1, 8); PALISADE.addRing(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)); }
    }
    // the south signpost, where the Drovers' Track leaves the road
    { const [x, y] = SOUTH_SIGN().map(Math.round); if (!KEEP.has(at(x, y))) { open(x, y); set(x, y, T.SIGN); SIGNS.set(idx(x, y), SIGN_WORDS.outpost_south); } }
    Object.keys(POSTS).forEach(k => delete POSTS[k]); Object.assign(POSTS, posts);

    // 3. the people
    for (const n of PEOPLE) { if (!NPCS.includes(n)) NPCS.push(n); initNpc(n); if (SOLID.has(at(n.x, n.y))) set(n.x, n.y, T.GRASS); }

    // 4. the goblins: each where its point says (the trampled earth round it is open), marked as its outpost's
    for (const s of SPAWNS) {
      const pts = spotsOf(s), n0 = MONSTER_SPAWNS.length;
      for (const [x, y] of pts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (NATURE.has(at(x + dx, y + dy))) set(x + dx, y + dy, T.DIRT);
      api.spawnList(s.type, pts);
      for (let k = n0; k < MONSTER_SPAWNS.length; k++) { MONSTER_SPAWNS[k].by = '86-outposts:' + s.place; MONSTER_SPAWNS[k].outpost = s.place; }
    }

    // 5. the dressing ring: worn ground and a few bits of goblin junk outside each box, thinning out over RING tiles (its
    // own dice), never on a road's lanes, a person, a spawn, a building or another place's box
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
        // (worn most by the box, gone by four tiles out; now and then a bit of junk the goblins threw over the stakes)
        if (r < 0.025 && d <= 3) { DECO.put(api, x, y, 'junk'); S.deco++; }
        else if (r < 0.22 * (1 - (d - 1) / 4)) { set(x, y, T.DIRT); S.ring++; }
      }
    }
  });

  // ---------- the lookouts: what E says, and how each is drawn (the ground beneath first, then the lookout) ----------
  HOOKS.use.push((t, tx, ty) => {
    if (window.__instance || t !== SOLID_T()) return false;
    const c = THINGS.get(idx(tx, ty)); if (!c || c.kind !== 'lookout') return false;
    notify(standing(c.place) > 0 ? WORDS.lookout : WORDS.lookoutEmpty);
    return true;
  });
  HOOKS.draw.push((g, items) => {
    if (window.__instance || !THINGS.size) return;
    for (const [i, c] of THINGS) {
      const tx = i % MAP_W, ty = (i / MAP_W) | 0, px = tx * TILE, py = ty * TILE;
      if (map[i] !== SOLID_T()) continue;
      if (px + TILE + LOOKOUT_REACH < cam.x || px - LOOKOUT_REACH > cam.x + VW || py + TILE < cam.y || py - LOOKOUT_REACH > cam.y + VH) continue;
      const v = variant[i] % 3;
      items.push({ y: -1e9 + 1, draw: () => { const img = tex[TEX_NAME[c.under] + v]; if (img) g.drawImage(img, px, py, TILE, TILE); } });
      items.push({ y: py + TILE - 3, draw: () => drawLookout(g, tx, ty, c.place) });
    }
  });

  // ---------- clearing an outpost: the banner once a clear, and the heap and the thanks it opens ----------
  HOOKS.monsterDeath.push(m => {
    const id = outpostOf(m); if (!id) return;
    const q = Q(id);
    if (!q.cleared && gang(id).length && standing(id) === 0) {
      q.cleared = 1; q.won = 1; q.searched = 0;
      levelBanner = { text: WORDS.cleared[0], sub: WORDS.cleared[1], t: 4 }; sfx('levelup'); save();
    }
  });
  // when one comes back, the outpost is filling again: the next full clear earns the banner (and the heap) again
  let refillT = 0;
  HOOKS.update.push(dt => {
    if (window.__instance || (refillT -= dt) > 0) return; refillT = 1;
    if (!quest.outposts) return;
    for (const id of IDS) { const q = quest.outposts[id]; if (q && q.cleared && standing(id) > 0) q.cleared = 0; }
  });

  // ---------- talking: each watcher a line at a time; once the outpost has been cleared, thanks (once ever) ----------
  const SAID = {};
  // which story the watcher tells now (the review of bcb559f: after the win they still said the goblins were in there):
  // 'before' it has ever been cleared; 'after' while it is cleared; 'back' while it fills again after a win
  const mood = id => { const q = Q(id); return q.cleared ? 'after' : q.won ? 'back' : 'before'; };
  const linesOf = (n, m) => (m === 'before' ? n.lines : (m === 'back' ? BACK : AFTER)[n.id] || n.lines);
  const nextLine = n => { const m = mood(n.place), L = linesOf(n, m), key = n.id + ':' + m; const k = SAID[key] = ((SAID[key] === undefined ? -1 : SAID[key]) + 1) % L.length; return L[k]; };
  HOOKS.talk.outpostwatch = n => {
    const q = Q(n.place);
    if (!q.met) { q.met = 1; if (!q.won) { quest.tracked = 'outposts'; notify(`New quest: The Goblin Outposts. ${touchMode() ? 'Tap QUESTS' : 'Press ' + keyName('J')} to read it.`); } save(); }
    if (q.won && !q.thanked) { q.thanked = 1; addItem('coins', REWARD[n.id]); say(WORDS.thanks[n.id], n.name); burst(player.x, player.y, '#ffd166', 12, 60); save(); return; }
    say(nextLine(n), n.name);
  };

  // ---------- the quest book (J) and the map: The Goblin Outposts, from the first word with Bramble or Brin to their
  // thanks (the review of bcb559f) ----------
  QUEST_DEFS.outposts = { name: 'The Goblin Outposts' };
  const WHOSE = { outpost_north: 'Bramble', outpost_south: 'Brin' };
  const open_ = () => IDS.filter(id => { const q = quest.outposts && quest.outposts[id]; return q && q.met && !q.thanked; });
  HOOKS.questText.outposts = () => { const ids = open_(); if (!ids.length) return 'Done.';
    return ids.map(id => Q(id).won ? `${WHOSE[id]}'s outpost is beaten! Go back and tell ${WHOSE[id]}.` : `${WHOSE[id]}'s outpost: beat every goblin in it. Go in through the gap in the spikes.`).join(' '); };
  HOOKS.activeQuests.push(() => open_().length ? ['outposts'] : []);
  if (HOOKS.mapTarget) HOOKS.mapTarget.push(() => { const id = open_()[0]; if (!id) return null;
    if (Q(id).won) { const w = PEOPLE.find(p => p.place === id); return { x: w.x, y: w.y, label: w.name, id: 'outposts' }; }
    const [x, y] = gapOf(id).map(Math.round); return { x, y, label: 'The goblin outpost', id: 'outposts' }; });

  // ---------- the handle ----------
  window.OUTPOSTS = { IDS, PLAN, PEOPLE, LINES, AFTER, BACK, mood, WORDS, REWARD, SPAWNS, spotsOf, GAP, gapOf, SOUTH_SIGN, LANE, POSTS, STATS, THINGS, HEAPS, SIGNS, FOOT, FR, Q, outpostOf, gang, standing };

  // ---------- self-tests ----------
  HOOKS.selfTest.push((check, Fh, h) => {
    const P = 'outposts: ', tiles = window.PLAYTHROUGH ? PLAYTHROUGH.pristine : map;
    const inB = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
    const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - ax - u * dx, py - ay - u * dy); };
    const roadD = (x, y, ids) => { let b = Infinity; for (const id of ids) { const pl = A.track(id); for (let k = 1; k < pl.length; k++) b = Math.min(b, segD(x, y, pl[k - 1][0], pl[k - 1][1], pl[k][0], pl[k][1])); } return b; };
    const SG = window.SPREAD_GROUND, PAL = PALISADE.tile;
    // a 4-connected walk from the cave mouth over the fresh map (closed: tiles shut for the walk)
    const walk = closed => { const N = MAP_W * MAP_H, seen = new Uint8Array(N), q = new Int32Array(N); let n = 0;
      const pass = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || t === Tn('WARDEN_GATE') || t === Tn('LAIR_GATE');
      const take = i => { if (!seen[i] && pass(tiles[i]) && !(closed && closed.has(i))) { seen[i] = 1; q[n++] = i; } };
      const [mx, my] = A.port('cave.mouth'); take(idx(mx, my));
      for (let k = 0; k < n; k++) { const c = q[k], x = c % MAP_W; if (x > 0) take(c - 1); if (x < MAP_W - 1) take(c + 1); if (c >= MAP_W) take(c - MAP_W); if (c + MAP_W < N) take(c + MAP_W); }
      const at = (x, y) => inMap(x, y) && !!seen[idx(x, y)];
      return Object.assign((x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy)), { at }); };
    const reach = walk();
    const mine = MONSTER_SPAWNS.filter(s => /^86-outposts/.test(s.by || ''));

    // 1. built: no stake or plaque of theirs left, each region names the place, WORLD_REV 5 with the footprint; multi combat
    { const left = SG ? [...SG.PROPS.values()].filter(p => IDS.includes(p.place)).length : -1;
      const regs = IDS.map(id => REGIONS.find(r => r.atlas === id));
      const subs = regs.every((r, k) => r && r.sub === A.BUILT.get(IDS[k]).sub && !/staked/.test(r.sub));
      const R = A.REVS && A.REVS[5], foot = !!R && IDS.every(id => R.boxes.some(b => { const q = A.box(id); return b[0] <= q[0] - RING && b[1] <= q[1] - RING && b[2] >= q[2] + RING && b[3] >= q[3] + RING; }));
      const combat = IDS.map(id => { const [x0, y0, x1, y1] = A.box(id); return [A.zoneAt('over', (x0 + x1) >> 1, (y0 + y1) >> 1), A.combatAt('over', (x0 + x1) >> 1, (y0 + y1) >> 1)]; });
      check(P + 'the two goblin outposts are built: their builders\' stakes and plaques are gone, each region names the place, each is multi combat, and WORLD_REV 5 declares each box with its 6-tile ring (and the north trail) as its footprint',
        left === 0 && STATS.stakes > 0 && subs && WORLD_REV >= 5 && foot && IDS.every(id => A.isBuilt(id)) && combat.every(([z, c], k) => z === IDS[k] && c === 'multi'), { left, stakes: STATS.stakes, subs: regs.map(r => r && r.sub), WORLD_REV, foot, combat }); }

    // 2. the rings: sharpened stakes all round with one gap; inside is reached from the cave mouth, but only through the gap
    // (shut it and nothing inside is reached); the river's rock face is untouched; nothing the plans meant to paint was ore
    { const res = {};
      for (const id of IDS) {
        const F = FR[id], rows = PLAN[id], pal = [], inside = [], ore = [];
        const W = rows[1].length;
        for (let ry = 1; ry <= 8; ry++) for (let rx = 0; rx < Math.min(W, rows[ry].length); rx++) { const ch = rows[ry][rx], [x, y] = F.p(rx, ry);
          if (ch === '.' && rx >= 1 && rx <= 9 && ry >= 2 && ry <= 7) ore.push(/IRON|COAL|STONE|MITHRIL/.test(tileName(tiles[idx(x, y)])));
          if (ch === 'p') pal.push(tiles[idx(x, y)] === PAL); else if (rx >= 1 && rx <= 9 && ry >= 2 && ry <= 7 && ch !== '.' && !SOLID.has(tiles[idx(x, y)])) inside.push([x, y]); }
        const [gx, gy] = gapOf(id), shut = walk(new Set([idx(gx, gy)]));
        const rings = PALISADE.RINGS.filter(r => inB([r.x0, r.y0, r.x1, r.y1], gx, gy)).length;
        res[id] = { stakes: pal.length, standing: pal.every(Boolean), ore: ore.length === 1 && ore.every(Boolean), gapOpen: !SOLID.has(tiles[idx(gx, gy)]) && reach(gx, gy), inside: inside.length,
          reached: inside.every(([x, y]) => reach.at(x, y)), sealed: inside.every(([x, y]) => !shut.at(x, y)), rings };
      }
      const cliffs = OS.pts([[9, 1], [10, 1], [10, 2]]).map(([x, y]) => tiles[idx(x, y)] === Tn('CLIFF'));
      // Brin's worn path: from the end of his track round below the ring to the gap, on worn earth all the way
      const path = new Set(); PLAN.outpost_south.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === ',' && (rx === 0 || ry >= 8)) path.add(idx(...OS.p(rx, ry))); }));
      const [bx, by] = OS.p(0, 3), [sx, sy] = gapOf('outpost_south'), seen = new Set([idx(bx, by)]), todo = [[bx, by]];
      for (let k = 0; k < todo.length; k++) { const [x, y] = todo[k]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = idx(x + dx, y + dy); if (!seen.has(i) && path.has(i) && tiles[i] === T.DIRT) { seen.add(i); todo.push([x + dx, y + dy]); } } }
      res.path = seen.has(idx(sx, sy));
      check(P + 'each outpost is a ring of sharpened stakes with one gap: every tile inside is reached from the cave mouth, and with the gap shut none is; each keeps the iron ore inside it; the river\'s rock face closes the south ring\'s corner; Brin\'s worn path goes round to the gap; 65-palisade draws both rings',
        res.path && IDS.every(id => res[id].stakes >= 25 && res[id].standing && res[id].ore && res[id].gapOpen && res[id].inside >= 40 && res[id].reached && res[id].sealed && res[id].rings === 1) && cliffs.every(Boolean) && !STATS.kept.length,
        { res, cliffs, kept: STATS.kept }); }

    // 3. the goblins: north three goblins and a sapper, south three goblins and a brute, inside their rings (their Atlas
    // zone, multi), on open ground, each a camp monster (the camp's respawn rule); the road passes 8+ tiles off each gap and
    // no goblin there can see a knight on the road
    { const bad = [], want = { outpost_north: { goblin: 3, sapper: 1 }, outpost_south: { goblin: 3, brute: 1 } }, got = {};
      for (const s of mine) {
        const id = s.outpost; (got[id] = got[id] || {})[s.type] = (got[id][s.type] || 0) + 1;
        const b = A.box(id), sight = MONSTER_DEFS[s.type].sight / TILE, off = roadD(s.tx, s.ty, A.MAIN_ROADS);
        if (!inB([b[0] + 1, b[1] + 1, b[2] - 1, b[3] - 1], s.tx, s.ty) || A.zoneAt('over', s.tx, s.ty) !== id) bad.push(s.type + '@' + s.tx + ',' + s.ty + ' zone ' + A.zoneAt('over', s.tx, s.ty));
        if (SOLID.has(tiles[idx(s.tx, s.ty)]) || !reach(s.tx, s.ty)) bad.push(s.type + '@' + s.tx + ',' + s.ty + ' not on open ground reached');
        if (off <= sight + 2.5) bad.push(s.type + '@' + s.tx + ',' + s.ty + ' sees the road (' + off.toFixed(1) + ')');
        const m = monsters.find(q => Math.floor(q.home.x / TILE) === s.tx && Math.floor(q.home.y / TILE) === s.ty && q.type === s.type);
        if (!m || !isCampMonster(m) || isGoblinCampMonster(m) || outpostOf(m) !== id) bad.push(s.type + '@' + s.tx + ',' + s.ty + ' not under the camp rule');
      }
      const gaps = IDS.map(id => roadD(...gapOf(id), A.MAIN_ROADS));
      const others = MONSTER_SPAWNS.filter(s => !/^86-outposts/.test(s.by || '') && IDS.some(id => inB(A.box(id), s.tx, s.ty))).map(s => s.type + '@' + s.tx + ',' + s.ty);
      check(P + 'the north outpost holds three goblins and a sapper, the south three goblins and a brute, each inside its ring and Atlas zone under the camp\'s respawn rule; no other creature wakes there; the road passes 8+ tiles off each gap and no outpost goblin sees the road',
        !bad.length && JSON.stringify(got) === JSON.stringify(want) && gaps.every(d => d >= 8) && !others.length, { bad, got, gaps, others }); }

    // 4. clearing one: the last goblin down shows the banner once (not the camp's), each stays down 30 minutes and only comes
    // back while the knight is 40+ tiles off; then the heap gives its find once, the lookout is empty, and the watcher thanks
    // the knight once; when one comes back the outpost is filling again
    { const id = 'outpost_north', g = gang(id), snap = g.map(m => ({ m, dead: m.dead, hp: m.hp, respawnT: m.respawnT, deadT: m.deadT, state: m.state, x: m.x, y: m.y }));
      const keep = { op: JSON.parse(JSON.stringify(quest.outposts || {})), inv: JSON.parse(JSON.stringify(player.inv)), camp: quest.campCleared, x: player.x, y: player.y, f: { ...player.facing } };
      const res = {};
      try {
        quest.outposts = {}; quest.campCleared = false; player.inv = new Array(INV_SLOTS).fill(null);
        Fh.tp(...ATLAS.frame('drill_field').p(60, 40)); levelBanner = null; dialog.queue.length = 0; advanceDialog();
        const heap = [...HEAPS].find(([, p]) => p === id), hx = heap[0] % MAP_W, hy = (heap[0] / MAP_W) | 0;
        res.guarded = heapUse(DECO.at(hx, hy));
        const last = g.find(m => m.type === 'goblin');
        for (const m of g) if (m !== last) { m.dead = true; m.deadT = 0; m.respawnT = 999; }
        res.notYet = !Q(id).cleared;
        last.dead = false; last.hp = 1; last.x = last.home.x; last.y = last.home.y; killMonster(last);
        res.banner = !!levelBanner && levelBanner.text === WORDS.cleared[0] && levelBanner.sub === WORDS.cleared[1];
        res.campBanner = quest.campCleared; res.slow = last.respawnT === CAMP_RESPAWN; res.cleared = Q(id).cleared === 1 && Q(id).won === 1;
        const lk = [...THINGS].find(([, c]) => c.place === id); notice = null; for (const f of HOOKS.use) if (f(SOLID_T(), lk[0] % MAP_W, (lk[0] / MAP_W) | 0)) break; res.lookout = notice && notice.text;
        const c0 = coins(); res.found = heapUse(DECO.at(hx, hy)); res.coins = coins() - c0; res.scrap = countItem('goblin_scrap'); res.again = heapUse(DECO.at(hx, hy));
        const watcher = PEOPLE.find(p => p.place === id); const c1 = coins(); talkTo(watcher); res.thanks = coins() - c1; talkTo(watcher); res.thanks2 = coins() - c1; dialog.queue.length = 0; advanceDialog();
        // too close (14 tiles off the gap) it waits; far off it comes back, and the outpost is filling again
        levelBanner = null; last.respawnT = 0; const [gx, gy] = gapOf(id); Fh.tp(gx + 14, gy); h.peace(true); Fh.sim(5, []); res.waits = last.dead;
        Fh.tp(...ATLAS.frame('drill_field').p(60, 40)); Fh.sim(80, []); h.peace(false); res.back = !last.dead && Q(id).cleared === 0;
      } finally {
        for (const s of snap) Object.assign(s.m, { dead: s.dead, hp: s.hp, respawnT: s.respawnT, deadT: s.deadT, state: s.state, x: s.x, y: s.y });
        quest.outposts = keep.op; player.inv = keep.inv; quest.campCleared = keep.camp; player.x = keep.x; player.y = keep.y; player.facing = keep.f; levelBanner = null; notice = null;
        dialog.queue.length = 0; advanceDialog(); drops = drops.filter(d => !g.some(m => dist(d.x, d.y, m.home.x, m.home.y) < LOOKOUT_REACH));
      }
      check(P + 'clearing the north outpost: the last goblin down shows "GOBLIN OUTPOST CLEARED" (not the camp\'s banner), each stays down 30 minutes and waits while the knight is near; the heap gives 15 coins and two scrap once, the lookout is empty, Bramble thanks the knight once (30 coins); far off they come back and the outpost fills again',
        res.guarded === WORDS.heapGuarded && res.notYet && res.banner && !res.campBanner && res.slow && res.cleared && res.lookout === WORDS.lookoutEmpty && res.found === WORDS.heapFound && res.coins === 15 && res.scrap === 2
        && res.again === WORDS.heapEmpty && res.thanks === REWARD.bramble_scout && res.thanks2 === REWARD.bramble_scout && res.waits && res.back, res); }

    // 5. the people: on open ground in their own place (the Atlas zone), reached from the cave mouth, in the townsfolk look;
    // the rails, the lookouts, the heaps and the fires are reached too
    { const bad = [];
      for (const p of PEOPLE) {
        const zone = A.zoneAt('over', p.x, p.y);
        if (!NPCS.includes(p)) bad.push(p.id + ' not in NPCS');
        if (SOLID.has(tileAt(p.x, p.y))) bad.push(p.id + ' on ' + tileName(tileAt(p.x, p.y)));
        if (!reach(p.x, p.y)) bad.push(p.id + ' not reached from the cave');
        if (zone !== p.place) bad.push(p.id + ' zone ' + zone);
        if (!TOWNSFOLK_ART.NEW_NPC[p.id]) bad.push(p.id + ' has no look');
      }
      for (const id of IDS) { const p = POSTS[id]; if (!p || tileAt(p.x, p.y) !== T.HITCH || !reach(p.x, p.y)) bad.push(id + ' rail'); }
      for (const [i] of THINGS) if (!reach(i % MAP_W, (i / MAP_W) | 0)) bad.push('lookout not reached');
      for (const [i] of HEAPS) if (!reach.at(i % MAP_W, (i / MAP_W) | 0)) bad.push('heap not reached');
      for (const id of IDS) { const rows = PLAN[id]; rows.forEach((row, ry) => [...row].forEach((c, rx) => { if (c !== 'F') return; const [x, y] = FR[id].p(rx, ry); if (tileAt(x, y) !== T.FIRE || !reach(x, y)) bad.push(id + ' fire'); })); }
      check(P + 'Bramble the scout by her hide and Brin the drover at the end of his track stand in their own outposts\' Atlas zones in the townsfolk look; a knight walks to each of them, to both rails, the lookouts, the heaps and the fires (cook on them) from the cave mouth',
        !bad.length, { bad }); }

    // 6. they talk: a line at a time; plain words, short, no compass word
    // (and after the win: while the outpost is cleared their after lines, never the story before it; while it fills again
    // after a win, that the goblins are back: the review of bcb559f)
    { const said = {}, MOODS = { before: () => ({}), after: id => ({ [id]: { cleared: 1, won: 1, thanked: 1, searched: 1 } }), back: id => ({ [id]: { cleared: 0, won: 1, thanked: 1 } }) };
      const want = (p, m) => m === 'before' ? p.lines : (m === 'after' ? AFTER : BACK)[p.id];
      for (const p of PEOPLE) { const keep = { s: Object.assign({}, SAID), op: JSON.parse(JSON.stringify(quest.outposts || {})) }; said[p.id] = {};
        for (const m of Object.keys(MOODS)) { quest.outposts = MOODS[m](p.place); said[p.id][m] = [];
          for (let k = 0; k < want(p, m).length + 2; k++) { dialog.queue.length = 0; advanceDialog(); talkTo(p); const d = [dialog.cur, ...dialog.queue].find(q => q && q.who === p.name); said[p.id][m].push(d ? d.text : null); } }
        Object.keys(SAID).forEach(k => delete SAID[k]); Object.assign(SAID, keep.s); quest.outposts = keep.op; dialog.queue.length = 0; advanceDialog(); }
      const lines = Object.values(LINES).flat().concat(Object.values(AFTER).flat(), Object.values(BACK).flat(), Object.values(WORDS.thanks), [WORDS.lookout, WORDS.lookoutEmpty, WORDS.heapGuarded, WORDS.heapFound, WORDS.heapEmpty, WORDS.hide, WORDS.junk]);
      const told = PEOPLE.every(p => Object.keys(MOODS).every(m => want(p, m).every(t => said[p.id][m].includes(t)) && said[p.id][m].every(t => want(p, m).includes(t))));
      check(P + 'Bramble and Brin each tell their story a line at a time; once the outpost is cleared they say only their after-the-win lines (never that the goblins are still in there), and while it fills again after a win, that the goblins came back; every line (and every word the outposts say) is short and plain, with no compass word',
        told && lines.every(t => t.length <= 140 && !/\b(north|south|east|west)\b|\bmiles?\b/i.test(t)), { said }); }

    // 7. the rails and the signposts: a RAILS entry on a HITCH tile in each place; a signpost where the trail and the
    // Drovers' Track leave the road, naming the outpost (arms drawn) and never "builders at work"; nothing built here stands
    // on a main road; placing on their ground says whose it is
    { const rails = IDS.map(id => { const r = RAILS.find(q => q.id === id), p = r && r.at(); return !!p && inB(A.box(id), p.x, p.y) && tileAt(p.x, p.y) === T.HITCH && RAILS.of(p.x, p.y) === r && !r.reserved; });
      const signs = [...SIGNS.keys()].map(i => { const x = i % MAP_W, y = (i / MAP_W) | 0, w = A.signText(x, y), arms = window.SIGN_ARMS && SIGN_ARMS(x, y);
        return { at: [x, y], sign: tileAt(x, y) === T.SIGN, outpost: /goblin outpost/.test(w || ''), arms: !!arms && arms.some(a => a[1] === 'OUTPOST'), road: roadD(x, y, A.MAIN_ROADS), reached: reach(x, y) }; });
      const words = SG ? SG.signs.map(([x, y]) => A.signText(x, y)) : [];
      const builders = words.filter(t => /goblin outpost \(builders at work\)/i.test(t));
      const onRoad = []; for (const id of IDS) PLAN[id].forEach((row, ry) => [...row].forEach((c, rx) => { const [x, y] = FR[id].p(rx, ry); if (/[pLFHS]/.test(c) && A.onMainRoad(x, y)) onRoad.push(c + '@' + x + ',' + y); }));
      h.give('goblin_trap', 2); h.peace(true);
      const placed = {};
      for (const [id, F, rx, ry] of [['outpost_north', ON, 5, 2], ['outpost_south', OS, 4, 4]]) {
        const [x, y] = F.p(rx, ry), n0 = countItem('goblin_trap'); Fh.tp(x, y); player.facing = { x: 0, y: 1 }; notice = null; placeAction('goblin_trap');
        placed[id] = { placed: countItem('goblin_trap') < n0, notice: notice && notice.text };
      }
      h.peace(false);
      check(P + "each outpost has its hitching rail (a RAILS entry, on a HITCH tile in its box); a signpost by the road names the goblin outpost (its arm drawn), none says \"builders at work\"; nothing built stands on a main road; \"This is a goblin outpost's ground. Build somewhere else.\"",
        rails.every(Boolean) && signs.length === 2 && signs.every(s => s.sign && s.outpost && s.arms && s.road <= 6 && s.reached) && !builders.length && !onRoad.length
        && IDS.every(id => !placed[id].placed && placed[id].notice === "This is a goblin outpost's ground. Build somewhere else."), { rails, signs, builders, onRoad, placed }); }
  });
}
