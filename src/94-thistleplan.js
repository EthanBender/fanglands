// ============================================================================
// THISTLEDOWN, THE CAPITAL: the plan. src/94-thistleplan.js (data only)
//
// The owner, 2026-10-02: "personally the design you did for the sky city was phenomenal I would sujest doing the
// same process on the main city". This is the main city's plan, drawn the way Aerie's was (src/36-aerieplan.js):
// one character a tile over the town and one tile of the outside round it, x 84..141 and y 13..57 (58 x 45).
// src/95-thistledown.js paints it into the world (the first HOOKS.world pass, no random numbers) and draws it.
//
// A town change is a row change. Every building cell, door included, is '@' (02-world carves the buildings; the
// painter leaves them alone). The legend is GLYPHS (the tile the painter writes, or null to leave the cell as it is)
// and KIND_OF (what a solid prop or a piece of greenery is). Lamps, benches, trees and every count are scanned from
// ROWS at load, never typed by hand.
//
//   columns: x = 84 + the index in the row; rows: y = 13 + the index in ROWS
//   -  outside the town (left alone)        #  the wall line (the core lays FENCE, 57-townwall turns it to stone)
//   G  the core's gate (T.GATE)             @  a building cell (02-world)
//   =  a street (setts)   +  flagstones     "  mown lawn      .  grass     ,  dirt     a  allotment soil
//   ~  water   b  a bridge   j  the jetty   T  a wall tower   F  a fountain
//   h  hedge   t  tree   *  roses           l lamp  s statue  p plinth  n bench  k stall  i sign  B the bell  d sundial
//   N  the notice board's cell   O  the island portal's cell   D  the dozer bay's cell   Y  the agility track
//   x  the square's brazier   S  Greta's and Fennick's stalls   C  the castle wall   P  the portcullis
//   f  fence   g  a yard gate   u  a training dummy
//   v  a flower bed   w  a woodpile   c  the smithy's handcart (two tiles)   A  the old anvil on its stump   q  a water trough
//   V  the well on the Bell Green   U  a table in the inn's garden
// ============================================================================
{
  // The plan is Thistledown's: its top-left is the port thistledown.origin (old 84,13) and every named place below is
  // written in the old map's numbers and read through the capital's frame (ATLAS.frame('thistledown')), so the whole
  // town moves as one at the spread.
  const TD = ATLAS.frame('thistledown');
  const [X0, Y0] = ATLAS.port('thistledown.origin'), W = 58, H = 45;
  const ROWS = [
    '----------------------------------------------------------',
    '-TT#####TT########TT################TT###TT############TT-',
    '-TT"""""TT""""""""TT*""""++BB++"vv""TTvvvTT"=hhhhhhhhhhTT-',
    '-#."t""t""t""t""t""t""t"n++BB++"===t"""""""t=h""""h"""hh#-',
    '-#.""""""""""""""""""""""++======O="v""V""v"=h"hh"h"h"hh#-',
    '-#.""t""t""t""t""t""t""tl++========"v"n"n"v"=h"hd"""h"hh#-',
    '-#l==========================++++++++l""""""=h"hhhhhh"hh#-',
    '-#.+++@@@@@@@==@@@@@@@@""""==+kk+++kk+@@@@@@=h"""h""""hh#-',
    '-TT+++@@@@@@@==@@@@@@@@"t""==+++FF++++@@@@@@=hhh"h"hhhhTT-',
    '-TT+l+@@@@@@@==@@@@@@@@"""n==+++FF++++@@@@@@=h""""""""hTT-',
    '-#.+++@@@@@@@==@@@@@@@@""""==+++++++++@@@@@@=hhhh"hhhhh.#-',
    '-#.+++@@@@@@@==@@@@@@@@"t""==+kk+++kk+@@@@@@=++++++++++.#-',
    '-#.+++@@@@@@@==@@@@@@@@""""==+++++++++@@@@@@=t~~~bb~~~t.#-',
    '-#.+@@@@+++++++++++++++n++l==ln+++++++++++++="j~~bb~~~".#-',
    '-#.+@@@@.@@@@==@@@@@+N+++++==++++++,,l++@@@@="~~~bb~~~".#-',
    '-TT+@@@@.@@@@==@@@@@++++SS+==+++SS+,,+++@@@@=t~~~bb~~~tTT-',
    '-TT+@@@@.@@@@==@@@@@+++++++==++++++,,+++@@@@=""n"++""**TT-',
    '-TT+l++++@@@@++@@@@@l++++++==++++l+++l++@@@@=hhhh++hhhhTT-',
    '-G======================================================G-',
    '-G======================================================G-',
    '-G======================================================G-',
    '-TTi++l++++l++++l++l++++++FFFF+++++++l++l+==++l+++++l+iTT-',
    '-TT"""vv"v"n",,"v"vv++s+++FFFF+++s++++++++=="v""""""v""TT-',
    '-TTw,,@@@@@@@,,@@@@@@@++++FFFF+++++++@@@@@==@@@@t"@@@@@TT-',
    '-#w,,,@@@@@@@,,@@@@@@@+++++++++++++++@@@@@==@@@@""@@@@@.#-',
    '-#w,,,@@@@@@@,,@@@@@@@s++++++++++s+x+@@@@@==@@@@"*@@@@@.#-',
    '-#,,cc@@@@@@@,,@@@@@@@+++++++++++++++@@@@@==@@@@""@@@@@.#-',
    '-#ffff@@@@@@@,,@@@@@@@++l++++p+l++++++++++==+++l+++++++.#-',
    '-#,,,,@@@@@@@,,ww,,~~~~~~~~bb~~~~~~~~~~+++==+++++++++++.#-',
    '-#,,u,fw+++A,,,+++w~CCCCCCCPPCCCCCCCCC~+++==+++,,**""t"TT-',
    '-#,,,,g++++,D,q++++~C++++++++++++++++C~+++==+++,,""""""TT-',
    '-#,,u,f,,,,,,,,,,,,~C++++++++++++++++C~@@@@@@@@,,""FF"n.#-',
    '-#,,,,f,,,,,,,,,,,,~C++++++++++++++++C~@@@@@@@@,,""FF"".#-',
    '-#fffff"@@@@""@@@@"~C+++@@@@@@@@@@+++C~@@@@@@@@,,"""""".#-',
    '-#""t"""@@@@""@@@@"~C+++@@@@@@@@@@+++C~@@@@@@@@,,n""""*.#-',
    '-TT"""n"@@@@""@@@@"~C+++@@@@@@@@@@+++C~@@@@@@@@,,@@@@@@TT-',
    '-TT"vv""@@@@""@@@@"~C+++@@@@@@@@@@+++C~@@@@@@@@,,@@@@@@TT-',
    '-#fgfffffffffffffff~C**+@@@@@@@@@@+**C~"U"aaaaa,,@@@@@@.#-',
    '-#YYYYYYYYYYYYYYYYf~C**+@@@@@@@@@@+**C~"""aaaaa,,@@@@@@.#-',
    '-#YffffffffffffffYf~C**+@@@@@@@@@@+**C~"U"aaaaa,,@@@@@@.#-',
    '-#YYYYYYYYYYYYYYYYf~C++++++++++++++++C~"""aaaaa,,,,,,,,.#-',
    '-#fffffffffffffffff~CCCCCCCCCCCCCCCCCC~t""""""",,,,,,,,.#-',
    '-TThhhhhhhhhhhhhhhh~~~~~~~~~~~~~~~~~~~~""vv"TT",,""""""TT-',
    '-TT#########################################TT#########TT-',
    '----------------------------------------------------------',
  ];
  // the tile each glyph is painted as (a tile NAME, resolved when the world is generated), or null: leave it alone
  const GLYPHS = {
    '-': null, '#': null, 'G': null, '@': null,
    '=': 'COBBLE', '+': 'COBBLE', 'N': 'COBBLE', 'O': 'COBBLE',
    '"': 'TD_LAWN', '.': 'GRASS', 'D': 'GRASS', ',': 'DIRT', 'a': 'SOIL', 'Y': 'DIRT',
    '~': 'WATER', 'b': 'BRIDGE', 'j': 'BRIDGE',
    'T': 'TOWN_WALL', 'F': 'TD_FOUNTAIN',
    'h': 'TD_HEDGE', 't': 'TD_HEDGE', '*': 'TD_HEDGE', 'v': 'TD_HEDGE',
    'l': 'TD_PROP', 's': 'TD_PROP', 'p': 'TD_PROP', 'n': 'TD_PROP', 'k': 'TD_PROP', 'i': 'TD_PROP', 'B': 'TD_PROP', 'd': 'TD_PROP',
    'w': 'TD_PROP', 'c': 'TD_PROP', 'A': 'TD_PROP', 'q': 'TD_PROP', 'V': 'TD_PROP', 'U': 'TD_PROP',
    'x': 'FIRE', 'S': 'STALL', 'C': 'CWALL', 'P': 'PORTCULLIS', 'f': 'FENCE', 'g': 'GATE', 'u': 'DUMMY',
  };
  // what a prop, a piece of greenery or a fountain cell is ('t' is a fruit tree or a cherry, 'F' one of three fountains: see kindAt)
  const KIND_OF = { l: 'lamp', s: 'statue', p: 'plinth', n: 'bench', k: 'stall', i: 'sign', B: 'bell', d: 'sundial', h: 'hedge', t: 'tree', '*': 'roses', F: 'fountain',
    v: 'flowers', w: 'woodpile', c: 'cart', A: 'oldanvil', q: 'trough', V: 'well', U: 'table' };

  // ---------- named places (world tiles) ----------
  // the eighteen wall towers: top-left, 2 wide, 2 tall unless h is 3 (the four gate towers)
  const TOWERS = TD.pts([
    { x: 85, y: 14, at: 'corner' }, { x: 139, y: 14, at: 'corner' }, { x: 85, y: 55, at: 'corner' }, { x: 139, y: 55, at: 'corner' },
    { x: 85, y: 28, h: 3, at: 'gate' }, { x: 85, y: 34, h: 3, at: 'gate' }, { x: 139, y: 28, h: 3, at: 'gate' }, { x: 139, y: 34, h: 3, at: 'gate' },
    { x: 92, y: 14, at: 'north' }, { x: 102, y: 14, at: 'north' }, { x: 120, y: 14, at: 'north' }, { x: 125, y: 14, at: 'north' },
    { x: 85, y: 21, at: 'west' }, { x: 85, y: 48, at: 'west' },
    { x: 139, y: 21, at: 'east' }, { x: 139, y: 42, at: 'east' }, { x: 139, y: 48, at: 'east' },
    { x: 128, y: 55, at: 'south' },
  ]).map(t => Object.assign({ h: 2, w: 2 }, t));
  // the two gates in the wall: three tiles of T.GATE each, a gate tower above and below
  const GATES = [
    { id: 'west', name: 'The West Gate', x: TD.x(85), rows: [TD.y(31), TD.y(32), TD.y(33)], towers: TD.pts([[85, 28], [85, 34]]), dir: 1 },
    { id: 'east', name: 'The East Gate', x: TD.x(140), rows: [TD.y(31), TD.y(32), TD.y(33)], towers: TD.pts([[139, 28], [139, 34]]), dir: -1 },
  ];
  const FOUNTAINS = TD.pts([
    { id: 'great', x: 110, y: 34, w: 4, h: 3 },
    { id: 'market', x: 116, y: 21, w: 2, h: 2 },
    { id: 'rose', x: 135, y: 44, w: 2, h: 2 },
  ]);
  const STATUES = TD.pts([
    { x: 106, y: 35, id: 'last_knight', who: 'The Last Knight of Hollowford' },
    { x: 117, y: 35, id: 'thrain', who: 'King Thrain of the Dwarves' },
    { x: 106, y: 38, id: 'aelith', who: 'Queen Aelith of the Elves' },
    { x: 117, y: 38, id: 'seraphel', who: 'Queen Seraphel of Aerie' },
  ]);
  const PLINTH = TD.pt({ x: 113, y: 40 });
  // the market's four stalls, two tiles wide each (the left tile is x)
  const STALLS = TD.pts([
    { x: 114, y: 20, goods: 'apples', awning: '#b8352b', seller: 'hettie' },
    { x: 119, y: 20, goods: 'candles', awning: '#2e5a9a', seller: 'mabel' },
    { x: 114, y: 24, goods: 'flowers', awning: '#3f7d33', seller: 'moll' },
    { x: 119, y: 24, goods: 'cloth', awning: '#c9a14a', seller: null },
  ]);
  const SIGNS = TD.pts([{ x: 87, y: 34, side: 'west' }, { x: 138, y: 34, side: 'east' }]);
  const BELL = TD.pt({ x: 111, y: 15, w: 2, h: 2, stand: TD.pts([[111, 17], [112, 17]]), plaza: [TD.box([109, 15, 110, 18]), TD.box([113, 15, 114, 16])] });
  const SUNDIAL = TD.pt({ x: 132, y: 18, stand: TD.p(133, 18), mazeGate: TD.p(133, 23) });
  const POND = TD.rect({ x0: 130, y0: 25, x1: 137, y1: 28, bridge: [TD.x(133), TD.x(134)], jetty: TD.p(130, 26), boat: TD.p(130, 27), swans: [TD.rect({ x0: 131, x1: 132, y0: 25, y1: 28 }), TD.rect({ x0: 135, x1: 137, y0: 25, y1: 28, ducklings: 4 })] });
  // bunting strung between two lamp heads (the first runs along the south pavement: strung from 88,30 to 90,34 it crossed
  // the High Street in the West Gate's mouth, over the face of every knight walking in)
  const BUNTING = [TD.pts([[90, 34], [95, 34]]), TD.pts([[104, 30], [103, 34]]), TD.pts([[121, 30], [124, 34]]), TD.pts([[110, 26], [113, 26]])];
  // Tess and Robin play tag round the fountain: a U path, ping-pong, by the wall clock (not Nell: Nell is the Hollowford
  // survivor who runs the rebuild, and a second Nell would muddle her story)
  const KIDS = { path: TD.pts([[109, 34], [109, 37], [114, 37], [114, 34]]), speed: 1.6, lag: 1.2, names: ['Tess', 'Robin'] };
  const DUCHESS = TD.pt({ x: 113, y: 16 });
  // the wards: a banner on the way into each (see 95's wardsTick)
  const WARDS = [
    TD.rect({ id: 'square', name: 'Fountain Square', sub: 'Every street comes back here', x0: 104, y0: 26, x1: 120, y1: 40 }),
    TD.rect({ id: 'market', name: 'The Market Court', sub: 'Apples, candles, flowers and cloth', x0: 113, y0: 19, x1: 121, y1: 25 }),
    TD.rect({ id: 'orchard', name: "The Duke's Orchard", sub: null, x0: 87, y0: 15, x1: 108, y1: 18 }),
    TD.rect({ id: 'green', name: "The Duke's Green", sub: 'The maze and Swan Pond', x0: 129, y0: 15, x1: 138, y1: 30 }),
    TD.rect({ id: 'roses', name: 'The Rose Garden', sub: "The Duke's roses", x0: 133, y0: 42, x1: 138, y1: 47 }),
  ];
  // cells later world passes lay on top of the plan (95's snapshot holds what they laid)
  const OWNED = { BOARD: ATLAS.port('thistledown.board'), HOUSE_PORTAL: ATLAS.port('thistledown.house_portal'), HITCH: ATLAS.port('thistledown.rail'), DOZER_BAY: ATLAS.port('thistledown.dozer_bay'), AGILITY_GATE: ATLAS.port('thistledown.agility_gate') };
  // the six new people (95 pushes them into NPCS at load); none of them wanders
  const PEOPLE = TD.pts([
    { id: 'osric', name: 'Gatewarden Osric', x: 91, y: 30, role: 'td_warden', tunic: '#5a2e7a', hair: '#6a6a6a', helmet: true, beard: true },
    { id: 'ambrose', name: 'Ambrose the bell-ringer', x: 110, y: 17, role: 'td_bell', tunic: '#4a4f5a', hair: '#d9d0c0', beard: true },
    { id: 'hettie', name: 'Hettie the apple seller', x: 114, y: 19, role: 'villager', woman: true, apron: true, tunic: '#b8352b', hair: '#3a2a1a' },
    { id: 'mabel', name: 'Mabel the candle maker', x: 119, y: 19, role: 'villager', woman: true, tunic: '#2e5a9a', hair: '#c9843a' },
    { id: 'moll', name: 'Moll the flower seller', x: 114, y: 25, role: 'villager', woman: true, apron: true, tunic: '#3f7d33', hair: '#e0c080' },
    { id: 'wynn', name: 'Wynn', x: 131, y: 24, role: 'td_wynn', woman: true, tunic: '#8a5a7a', hair: '#7a3a1a' },
  ]);
  // the streets, for the book and the signs (rectangles x0, y0, x1, y1)
  const STREETS = [
    { id: 'high', name: 'The High Street', rects: [TD.box([85, 31, 140, 33])], note: 'gate to gate, with a pavement on each side (y 30 and y 34)' },
    { id: 'crown', name: 'Crown Street', rects: [TD.box([111, 17, 112, 30])] },
    { id: 'north', name: 'North Lane', rects: [TD.box([87, 19, 110, 19])] },
    { id: 'bank', name: 'Bank Alley', rects: [TD.box([97, 20, 98, 29])] },
    { id: 'store', name: 'Store Row', rects: [TD.box([87, 26, 127, 26])] },
    { id: 'kings', name: 'The Kings Walk', rects: [TD.box([111, 37, 112, 40])], note: 'from the fountain to the drawbridge' },
    { id: 'green', name: 'Green Walk', rects: [TD.box([128, 15, 128, 30])] },
    { id: 'pond', name: 'Pond Walk', rects: [TD.box([129, 24, 138, 24])] },
    { id: 'rose', name: 'Rose Lane', rects: [TD.box([126, 34, 127, 43])] },
    { id: 'cross', name: 'Cross Lane', rects: [TD.box([128, 40, 138, 41])] },
    { id: 'coffin', name: 'Coffin Lane', rects: [TD.box([131, 42, 132, 55])] },
    { id: 'smithy', name: 'Smithy Lane', rects: [TD.box([91, 44, 102, 45])] },
  ];

  // ---------- reading the plan ----------
  const inPlan = (x, y) => x >= X0 && y >= Y0 && x < X0 + W && y < Y0 + H;
  const at = (x, y) => inPlan(x, y) ? ROWS[y - Y0][x - X0] : '-';
  const fountainAt = (x, y) => FOUNTAINS.find(f => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) || null;
  // the Duke's Orchard is the two rows of trees along the north wall; every other tree is a cherry
  const treeKind = (x, y) => (y === TD.y(16) || y === TD.y(18)) && x >= TD.x(87) && x <= TD.x(108) ? 'fruit' : 'cherry';
  function kindAt(x, y) {
    const c = at(x, y), k = KIND_OF[c];
    if (!k) return null;
    if (k === 'tree') return treeKind(x, y);
    if (k === 'fountain') { const f = fountainAt(x, y); return f ? f.id : null; }
    return k;
  }
  const towerAt = (x, y) => TOWERS.find(t => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) || null;
  const wardAt = (x, y) => WARDS.find(w => x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1) || null;
  const streetAt = (x, y) => STREETS.find(s => s.rects.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d)) || null;

  // ---------- scanned from ROWS (never typed by hand) ----------
  const COUNTS = {}, LAMPS = [], BENCHES = [], TREES = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = ROWS[j][i], x = X0 + i, y = Y0 + j;
    COUNTS[c] = (COUNTS[c] || 0) + 1;
    if (c === 'l') LAMPS.push([x, y]);
    else if (c === 'n') BENCHES.push([x, y]);
    else if (c === 't') TREES.push({ x, y, kind: treeKind(x, y) });
  }
  const fruitTrees = TREES.filter(t => t.kind === 'fruit').length;
  WARDS.find(w => w.id === 'orchard').sub = `${fruitTrees} fruit trees, and nobody may climb them`;

  window.THISTLE_PLAN = {
    X0, Y0, W, H, ROWS, GLYPHS, KIND_OF, TOWERS, GATES, FOUNTAINS, STATUES, PLINTH, STALLS, SIGNS, BELL, SUNDIAL, POND, BUNTING, KIDS, DUCHESS,
    WARDS, OWNED, PEOPLE, STREETS, COUNTS, LAMPS, BENCHES, TREES, fruitTrees,
    inPlan, at, kindAt, fountainAt, towerAt, wardAt, streetAt, treeKind,
  };
}
