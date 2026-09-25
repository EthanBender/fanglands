// ============================================================================
// AERIE, THE WALLED KINGDOM — the plan. src/36-aerieplan.js
//
// Cohen, 2026-09-24: "I want the cloud kingdome to be a actual kingdome with walls and a keep and spires and
// gates and fountains and buildings and roads and bridges and parks and decorations."
//
// This file is pure data. It names no tile id (the ids are made by addTile in 36-skycity, 38-agility, 88-aerie
// and 91-cloudkingdom, which all load around it), so it can sort first ('36-a' < '36-s') and be read by all of
// them. 36-skycity sizes the instance from it; 88-aerie reads its spots; 91-cloudkingdom paints ROWS into the
// instance once at load, cell for cell, with no random numbers — every client builds the same city.
//
// ROWS: 100 x 80 tiles, one character per tile, 48 px a tile (4800 x 3840 px). Copied byte for byte from the
// judge's plan-rows.txt (sha1 eadc9a3784076af81069d9591b777aa9d082237b); do not edit a row here without
// re-measuring every count the self-tests quote. GLYPHS says which tile NAME each character paints.
//
//     0         1         2         3         4         5         6         7         8         9
//     0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789
// ============================================================================
{
  const ROWS = [
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~rrrrrrrrrrr~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~r=========r~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~r=========r~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~r=========r~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+++~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+++~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,,,~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+++~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,,,P,,,~~~',
    '~~~~~~~~~~~~~~~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~~~~~~~~~~,,,,,,,~~~',
    '~~~~~~~~~~~~~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~~~~~~~,P,,,,,P,~~',
    '~~~~~~~~~~~~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~~~~~,,,,,,,,,,,~',
    '~~~~~~~~~~~~~,,TTT,,,,,,,,,,,,,TTT,,,,,,,,,,TTT,,,TTT,,,,,,,,,,TTT,,,,,,,,,,,,TTT,~~~~~~,,,,,,,,,,,~',
    '~~~~~~~~~~~~,,,TTT#############TTT##########TTT#G#TTT##########TTT############TTT,,~~~~~,,,,,,,,,,^~',
    '~~~~~~~~~~~~,,,TTT=============TTT==========TTT===TTT==========TTT============TTT,,~~~~,,n,,,,,,,n,,',
    '~~~~~~~~~~~~,,,,#=============================================================TTT,,~~~~,,,,,,,,,,,,,',
    '~~~~~~~~~~~~,,,,#==""""t"****"""""t"oooooo""t"l===l=CCCCCCCCC"t"""p"""t"""p"t=TTT,,~~~~,x,,,,,,,,,,,',
    '~~~~~~~~~~~~,,,,#=="t"""""""""t"""""oooooo"""""=====Cq_____qC""""""""""""""""=TTT,,~~~~,,,,,,,,,,,,,',
    '~~~~~~~~~~~~,,,,#=="""""""""""""S"""oooooo""""t=====C__a_a__C==================G,,,++++,,,,,,,,,,,,,',
    '~~~~~~~~~~~~,,,,#==""""l""""""""""""b"b""b"""""=====C_______C==================G,,,++++,,,,,,,,,,,,,',
    '~~~~~~~~~~~~,,,,#===================================C_______C==================G,,,++++,,,,,,,,,,,,,',
    '~~~~~~~~~~~~,,,,#=="""""""=""""l""""""""""l""""=====CCCCDCCCl===========l=====TTT,,~~~~,,,,,,,,,U,,,',
    '~~~~~~~~~~~~,,,,#=="""""""=""***""""""****""t"l===============================TTT,,~~~~,x,,,,,,,,,,,',
    '~~~~~~~~~~~~,,,,#=="t"""""=""""""t"""""""""""""===============================TTT,,~~~~,,,,,,,,,,,,,',
    '~~~~~~~~~~~~,,,,#==""hhhhh"hhhhh""~~~~~~~~~~~~~+++~~~~~~~~~~~~~""========="""==#,,,~~~~,,,,,___,,,,,',
    '~~~~~~~~~~~~,,,TTT=""h"""""""""h""~~~~~~~~~~~~~+++~~~~~~~~~~~~~t"CCCCCCCCC"""==#,,,~~~~~,,,,_O_,,,,~',
    '~~~~~~~~~~~~,,,TTT=t"h"hhhhhhh"h""~~===p=================p===~~""C__kkk__C"""==#,,,~~~~~,^,,___,,,,~',
    '~~~~~~~~~~~~,,,TTT=""h"h"""""""h"t~~=s========l===l========s=~~""C_______C"""==#,,,~~~~~,,,,,,,,,,,~',
    '~~~~~~~~~~~~,,,,#==""h"h"hhhhhhh""~~=====CCCCCCCCCCCCCCC=====~~""C_______C"""==#,,,~~~~~~,,,,,,,,,~~',
    '~~~~~~~~~~~~,,,,#==""h"h"h*""""h*"~~="""=C_x_________x_C="""=~~""C_b___b_C"S"==#,,,~~~~~~~n,,,,,U~~~',
    '~~~~~~~~~~~~,,,,#=="*h"h"hhhhh"h""~~="t"=C______Y______C="t"=~~""C_______C"""==#,,,~~~~~~~,,,,,,,~~~',
    '~~~~~~~~~~~~,,,,#=="*h"h"""""h"h""~~="""=C_____________C="""=~~""C_b___b_C"""==#,,,~~~~~~~~~,,,~~~~~',
    '~~~~~~~~~~~~,,,,#==""h"hhhhhhh"h"t~~="*"=C__C___R___C__C="*"=~~""C_______C"""==#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#==""h"""""""""h""~~="""=C______R______C="""=~~""C_______C""t==#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#==t"hhhhhhhhhhh""~~="t"=C______R______C="t"=~~""CCCCDCCCC"""==#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=="""""""""""""""~~="""=C__C___R___C__C="""=~~=l==============#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=="""""""""""""""~~=====C_a____R____a_C=====~~================#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=================++=====C_a____R____a_C=====++===============TTT,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=================++=====C______R______C=====++===============TTT,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=================++=====CCCCCCCDCCCCCCC=====++===============TTT,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#==S==============~~=========================~~================#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,TTT==HHHHHHHHH=HHHH~~==========l===l==========~~================#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,TTT==Hcc_____H=H_aH~~========S=======S========~~==k==k==k==k====#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,TTT==H_____a_H=H__H~~==p===================p==~~================#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#===H_______H=HDHH~~====b===============b====~~================#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#===Ha____a_H=====~~===========FFF===========~~================#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#===HHHHDHHHHl====~~===========FFF===========~~=l==========l===#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=================~~====U======FFF===========~~=====FFF========#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=================~~=========================~~=====FFF========#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#===HHHHH=HHHHH"""~~=s=======l=====l=======s=~~==p==FFF==p====TTT,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#===Ha__H=H__qH"""~~=========================~~===============TTT,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#===H___H=H___H"n"~~~~~~~~~~~~~+++~~~~~~~~~~~~~l============l=TTT,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#==lHHDHH=HHDHH"""~~~~~~~~~~~~~+++~~~~~~~~~~~~~================#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=================l============================================#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#===================================CCCCDCCCC===HHDHHH==HHDHH==#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=="""""""""""""""t=HHDHH=HDHH======Cx_____xC===Hc__cH==H___H==#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=="n"""""w""t"""""=H___H=H__H======C_______C===H____H==Ha__H==#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,G==""""""""""""""""=Ha__H=H_qHp===p=C_______C===H____H==H___H==#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=="""=========""""=HHHHH=HHHH======Cq_____qC===HHHHHH==HHHHH==#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#=="""U"""""""""n""=================CCCCCCCCC==================#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#==""""""""""""""""========TTT=====TTT=========================#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,,#==========================TTT=====TTT=========================#,,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,TTT===========TTT===========TTT=====TTT===============TTT=TTT==TTT,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~,,,TTT###########TTT###########TTT#GGG#TTT###############TTTGTTT##TTT,,~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~,,TTT,,,,,,,,,,,TTT,,,,,,,,,,,TTT=====TTT,,,,,,,,,,,,,,,TTT,TTT,,TTT,~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,TTT,===,TTT,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,l===l,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,===,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~++~~~~~~~~~~~~~~~~,,W,,,,,,===,,,,,,W,,~~~~~~~~~~~~~~~~~++~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~++~~~~~~~~~~~~~~~~,,,,,,,,,===,,,,,,,,,~~~~~~~~~~~~~~~~~++~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~++~~~~~~~~~~~~~~~~,,,,,,U=======U,,,,,,~~~~~~~~~~~~~~~~~++~~~~,,,~~~~,,,~~~,,,~~',
    '~~~~~~~~~~~uuuuurruuuuurru~~~~~~~~~~~~,,,,,,,=======,,,,,,,~~~~~~~~~~~~~~~~~++~~~~,f,LLLg,f,NNN,f,~~',
    '~~~~~~~uuuuuuuuuuuuuuuuuuuuuuu~~~~~~~~~,,,,,,l=====l,,,,,,~~~~~~~~~~~~~~~~~~++~~~~,,,~~~~,,,~~~,,,~~',
    '~~~~~uuuuuuuuzuuuuuuuuuuuuuuuuuu~~~~~~~~,,W,,=======,,,,,~~~~~~~~~~~~~~~~~~~++~~~~~g~~~~~~~~~~~~g~~~',
    '~~~~uuuuuuuUuuuuuuuuunuuzuuuuuuuu~~~~~~~~,,,,,,,J,,,,,,,~~~~~~~~~~~~~~~~~~~~++~~,,,,,~~~~,,,~~~,,,~~',
    '~~~uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~++++,U,f,gLLL,f,LLL,f,~~',
    '~~uuuuuuzuuuuuuuuuuuuuuuuuuuuuuzuuu~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~++++,,,,,~~~~,,,~~~,,,~~',
    '~~~uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,,,~~~,,,~~~,,,~~~,,,',
    '~~~~^uuuuuuuuuuuuuuuuuuuuuuuuuuuu~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,^,~~~,^,~~~,^,~~~,^,',
    '~~~~~uuuuuuuuuuuzuuuuuuuuuuuzuuu~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~,,,~~~,,,~~~,,,~~~,,,',
    '~~~~~~~uuuuuuuuuuuuuuuuuuuuuuu^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~uuuuuuuuuuuuuuu~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ];
  const W = 100, H = 80;

  // glyph -> tile NAME (resolved with T[name] when 91 paints). KING_* are 91's own; the rest were already here.
  const GLYPHS = {
    '~': 'SKY', ',': 'CLOUD', 'u': 'UNDERCLOUD',
    '=': 'KING_PAVE', '+': 'KING_BRIDGE', '"': 'KING_LAWN', '*': 'KING_BLOOM', 'G': 'KING_GATE',
    '#': 'KING_WALL', 'T': 'KING_TOWER', 'S': 'KING_SPIRE', 'F': 'KING_FOUNTAIN', 'o': 'KING_POND',
    'h': 'KING_GARDEN', 't': 'KING_GARDEN', 'p': 'KING_GARDEN',
    'b': 'KING_PROP', 'l': 'KING_PROP', 'Y': 'KING_PROP', 'w': 'KING_PROP',
    's': 'WIND_STATUE', 'k': 'WIND_STALL', 'n': 'NEST_HOUSE', 'x': 'SKY_BRAZIER', 'r': 'SKY_RAIL', '^': 'CLOUD_SPIRE',
    'U': 'UPDRAFT', 'P': 'HAWK_PERCH', 'O': 'SONGSTONE', 'z': 'CLOUD_SNAG', 'f': 'SPIRE_FLAG',
    'W': 'CLOUD_WISP', 'J': 'CLOUD_LEAP',
    'L': 'LOG_BALANCE', 'N': 'NET', 'g': 'JUMP_GAP',
    'C': 'CWALL', 'H': 'HWALL', '_': 'FLOOR', 'D': 'DOOR', 'R': 'RUG', 'a': 'TABLE', 'q': 'SHELF', 'c': 'COUNTER',
  };
  // what a garden or prop cell is, by its glyph (KING_GARDEN and KING_PROP are one tile each; the kind is drawn)
  const KINDS = { h: 'hedge', t: 'tree', p: 'planter', b: 'bench', l: 'lamp', Y: 'throne', w: 'well' };

  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? ROWS[y][x] : '~';
  // every cell of one glyph, in reading order
  function scan(glyph) { const out = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ROWS[y][x] === glyph) out.push([x, y]); return out; }
  // the ground a prop stands on: the walkable glyph most of its 4 neighbours share (then the 8, then 2 out)
  const GROUNDS = ['=', '"', '_', ',', 'u'];
  function groundAt(x, y) {
    for (const ring of [[[1, 0], [-1, 0], [0, 1], [0, -1]], [[1, 1], [-1, 1], [1, -1], [-1, -1]], [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2]]]) {
      const n = {}; let best = null;
      for (const [dx, dy] of ring) { const c = at(x + dx, y + dy); if (GROUNDS.includes(c)) { n[c] = (n[c] || 0) + 1; if (!best || n[c] > n[best] || (n[c] === n[best] && GROUNDS.indexOf(c) < GROUNDS.indexOf(best))) best = c; } }
      if (best) return best;
    }
    return ',';
  }

  // ---------- the buildings (instance-local: 91 mounts them into BUILDINGS only while the knight is in Aerie) ----------
  const BUILDINGS = [
    { id: 'aer_keep', name: "Queen Seraphel's Keep", x: 41, y: 26, w: 15, h: 12, door: 7, fabric: 'stone', roof: '#7fa6d6' },
    { id: 'aer_chapel', name: 'Chapel of the Four Winds', x: 65, y: 23, w: 9, h: 10, door: 4, fabric: 'stone', roof: '#9fb8dc' },
    { id: 'aer_guild', name: "Wingwrights' Guildhall", x: 52, y: 14, w: 9, h: 6, door: 4, fabric: 'stone', roof: '#6f8fbf' },
    { id: 'aer_forge', name: "Halcyon's Sky Forge", x: 52, y: 52, w: 9, h: 6, doorTop: 4, fabric: 'stone', roof: '#5d6f8f' },
    { id: 'aer_bakery', name: 'The Cloud Oven', x: 64, y: 52, w: 6, h: 5, doorTop: 2, fabric: 'house', roof: '#d9b36a', sign: 'BAKERY' },
    { id: 'aer_h6', name: 'House', x: 72, y: 52, w: 5, h: 5, doorTop: 2, fabric: 'house', roof: '#8fb0d8' },
    { id: 'aer_inn', name: 'The Tailwind', x: 20, y: 39, w: 9, h: 6, door: 4, fabric: 'house', roof: '#c9a36a', sign: 'THE TAILWIND' },
    { id: 'aer_h5', name: 'House', x: 30, y: 39, w: 4, h: 4, door: 1, fabric: 'house', roof: '#9fb8dc' },
    { id: 'aer_h1', name: 'House', x: 20, y: 47, w: 5, h: 4, door: 2, fabric: 'house', roof: '#8fb0d8' },
    { id: 'aer_h2', name: 'House', x: 26, y: 47, w: 5, h: 4, door: 2, fabric: 'house', roof: '#b7c9e2' },
    { id: 'aer_h3', name: 'House', x: 36, y: 53, w: 5, h: 4, doorTop: 2, fabric: 'house', roof: '#9fb8dc' },
    { id: 'aer_h4', name: 'House', x: 42, y: 53, w: 4, h: 4, doorTop: 1, fabric: 'house', roof: '#8fb0d8' },
  ];
  const inBuilding = (x, y) => BUILDINGS.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || null;
  const doorOf = b => b.door !== undefined ? [b.x + b.door, b.y + b.h - 1] : [b.x + b.doorTop, b.y];

  // ---------- named spots (single ones by hand; lists of one kind are scanned from ROWS below) ----------
  const SPOTS = {
    entry: [48, 71], leap: [48, 72],
    sentinels: [[40, 31], [56, 31], [92, 15], [26, 75]],
    wisps: [[40, 66], [56, 66], [42, 71]],
    seraphel: [48, 29], throne: [48, 28], halcyon: [56, 55],
    pell: [93, 9], quill: [69, 42], skyla: [82, 74], ferris: [19, 74],
    aldric: [48, 57], tamsin: [66, 54], mossbeard: [28, 19], aubade: [69, 26], corvin: [56, 17], merriweather: [22, 41],
    hale: [46, 31], brisk: [50, 31],
    larkMaze: [26, 27], larkWait: [48, 15], larkPlaza: [54, 44],
    mazeGate: [26, 22], railSpot: [48, 2],
    balcony: { x0: 44, y0: 1, x1: 52, y1: 3 }, larkRail: [52, 2], larkLand: [51, 2],
    perches: [[90, 8], [93, 6], [96, 8]],
    songstone: [93, 23], songRing: { x0: 92, y0: 22, x1: 94, y1: 24 },
    snags: [[8, 74], [13, 71], [16, 77], [24, 72], [28, 77], [31, 74]],
    nests: [[32, 49], [20, 54], [32, 57], [89, 12], [97, 12], [90, 27], [21, 72]],
    braziers: [[43, 27], [53, 27], [53, 53], [59, 53], [88, 14], [88, 20]],
    statues: [[37, 25], [59, 25], [37, 47], [59, 47]],
    stalls: [[65, 40], [68, 40], [71, 40], [74, 40]],
    organ: [[68, 24], [69, 24], [70, 24]],
    rails: [[43, 0], [44, 0], [45, 0], [46, 0], [47, 0], [48, 0], [49, 0], [50, 0], [51, 0], [52, 0], [53, 0], [43, 1], [43, 2], [43, 3], [53, 1], [53, 2], [53, 3], [16, 69], [17, 69], [23, 69], [24, 69]],
    cloudSpires: [[80, 76], [86, 76], [92, 76], [98, 76], [98, 11], [89, 24], [4, 76], [30, 78]],
    spires: [[32, 16], [75, 27], [44, 40], [52, 40], [19, 38]],
    fountains: [{ id: 'royal', x0: 47, y0: 43, x1: 49, y1: 45 }, { id: 'market', x0: 68, y0: 45, x1: 70, y1: 47 }],
    pond: { x0: 36, y0: 14, x1: 41, y1: 16 },
    well: [26, 54],
    towers: [[16, 11], [79, 11], [16, 61], [79, 61], [32, 11], [64, 11], [45, 11], [51, 11], [30, 61], [70, 61], [74, 61], [79, 14], [79, 20], [79, 36], [79, 48], [16, 24], [16, 40]],
    gatehouse: [{ x: 44, y: 60, x0: 43, x1: 45, y0: 58, y1: 63 }, { x: 52, y: 60, x0: 51, x1: 53, y0: 58, y1: 63 }],
    pillars: [[44, 30], [52, 30], [44, 33], [52, 33]],
    bunting: [[64, 39], [76, 39]],
  };
  // the lists that are scanned, never written by hand (a hand list once had a lamp where there was none)
  SPOTS.lamps = scan('l');
  SPOTS.trees = scan('t');
  SPOTS.hedges = scan('h');
  SPOTS.planters = scan('p');
  SPOTS.benches = scan('b').filter(([x, y]) => !inBuilding(x, y));
  SPOTS.pews = scan('b').filter(([x, y]) => !!inBuilding(x, y));
  SPOTS.beds = scan('*');
  SPOTS.pondCells = scan('o');
  SPOTS.gateCells = scan('G');
  // banners hang on every stretch of the north and south curtain wall where x % 6 === 3
  SPOTS.banners = [11, 61].flatMap(y => { const out = []; for (let x = 0; x < W; x++) if (ROWS[y][x] === '#' && x % 6 === 3) out.push([x, y]); return out; });

  const GATES = [
    { id: 'great', name: 'The Great Gate', cells: [[47, 61], [48, 61], [49, 61]], side: 'south', line: 'The Great Gate. It lifts for anyone who walks up to it.' },
    { id: 'flight', name: 'The Flight Gate', cells: [[48, 11]], side: 'north', line: 'The Flight Gate. Every child of Aerie walks through it once, and flies back.' },
    { id: 'crown', name: 'The Crown Gate', cells: [[79, 16], [79, 17], [79, 18]], side: 'east', line: 'The Crown Gate. The bridge beyond it goes to the Rookery and the Songstone.' },
    { id: 'spire', name: 'The Spire Gate', cells: [[72, 61]], side: 'south', line: 'The Spire Gate. The runners go out this way.' },
    { id: 'postern', name: 'The Postern', cells: [[16, 55]], side: 'west', line: 'The Postern. A small door for people who do not want to be seen leaving.' },
  ];
  const BRIDGES = [
    { id: 'moatN', name: 'the north moat bridge', kind: 'stone', moat: true, rects: [[47, 22, 49, 23]] },
    { id: 'moatS', name: 'the south moat bridge', kind: 'stone', moat: true, rects: [[47, 49, 49, 50]] },
    { id: 'moatW', name: 'the west moat bridge', kind: 'stone', moat: true, rects: [[34, 35, 35, 37]] },
    { id: 'moatE', name: 'the east moat bridge', kind: 'stone', moat: true, rects: [[61, 35, 62, 37]] },
    { id: 'crown', name: 'the Crown Bridge', kind: 'stone', rects: [[83, 16, 86, 18]] },
    { id: 'lowStair', name: 'the Low Stair', kind: 'rope', rects: [[20, 66, 21, 68]] },
    { id: 'runners', name: "the Runners' Bridge", kind: 'rope', rects: [[76, 66, 77, 74], [78, 73, 79, 74]] },
    { id: 'rail', name: 'the rail bridge', kind: 'rope', rects: [[47, 4, 49, 6]] },
  ];
  const STATUE_NAMES = ['Vireth, the north wind', 'Sorrow, the east wind', 'Halloa, the west wind', 'The Last Wind, that has no name'];
  const SPIRE_NAMES = [
    { x: 32, y: 16, name: 'The Garden Folly', line: 'The Garden Folly. It was built to be looked at, and nothing else.' },
    { x: 75, y: 27, name: 'The Bell Spire', line: 'The Bell Spire. The bell rings by itself when the east wind comes.' },
    { x: 44, y: 40, name: 'The West Twin Spire', line: 'The West Twin Spire. Its twin is exactly as tall. They have been measured.' },
    { x: 52, y: 40, name: 'The East Twin Spire', line: 'The East Twin Spire. Its twin is exactly as tall. They have been measured.' },
    { x: 19, y: 38, name: 'The Span Spire', line: 'The Span Spire. The children race to its top and back, with wings.' },
  ];
  // the six updraft stones (88-aerie's table, order kept) and the two royal ones only Lark's feather opens
  const DRAFTS = [
    { t: [44, 68], land: [45, 68], to: 1, name: 'the Crown' },
    { t: [96, 19], land: [95, 19], to: 0, name: 'the Wind Landing' },
    { t: [22, 57], land: [23, 57], to: 3, name: 'the Underside' },
    { t: [11, 72], land: [12, 72], to: 2, name: 'the Span Ward' },
    { t: [96, 27], land: [95, 27], to: 5, name: 'the Spire Run' },
    { t: [81, 73], land: [82, 73], to: 4, name: 'the Crown' },
  ];
  const ROYAL = [
    { id: 'A', t: [52, 68], land: [51, 68], to: 1, name: 'the Royal Plaza' },
    { id: 'B', t: [40, 45], land: [41, 45], to: 0, name: 'the Wind Landing' },
  ];
  // the wards: an arrival banner each (the first match wins, so the Long Rail and the Great Gate come first)
  const WARDS = [
    { name: 'The Long Rail', sub: 'Where the children of Aerie learn to fly', x0: 43, y0: 0, x1: 53, y1: 6 },
    { name: 'The Great Gate', sub: 'Where the city begins', x0: 42, y0: 57, x1: 54, y1: 63 },
    { name: 'The Wind Landing', sub: 'Where the wind sets you down', x0: 38, y0: 64, x1: 58, y1: 72 },
    { name: 'The Royal Plaza', sub: 'The keep of Queen Seraphel', x0: 36, y0: 24, x1: 60, y1: 48 },
    { name: "The Queen's Garden", sub: 'Hedges, a maze and the Mirror Pond', x0: 19, y0: 14, x1: 46, y1: 34 },
    { name: 'The Crown Ward', sub: 'The guildhall and the chapel', x0: 50, y0: 14, x1: 78, y1: 34 },
    { name: 'The Span Ward', sub: 'Houses, the inn and the Wishing Well', x0: 17, y0: 38, x1: 46, y1: 60 },
    { name: 'The Market Ward', sub: 'The Windward Market and the sky forge', x0: 50, y0: 38, x1: 78, y1: 60 },
    { name: 'The Crown', sub: 'The Rookery and the Songstone', x0: 83, y0: 3, x1: 99, y1: 30 },
    { name: 'The Underside', sub: 'Everything the city drops', x0: 0, y0: 66, x1: 36, y1: 79 },
    { name: 'The Spire Run', sub: 'Six flags over the drop', x0: 76, y0: 66, x1: 99, y1: 79 },
  ];
  const wardAt = (x, y) => WARDS.find(w => x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1) || null;
  // people who walk the city, on routes every tile of which is walkable, kept 2+ tiles off every standing person.
  // Positions come from the wall clock, so every knight online sees them in the same place without a message.
  const WALKERS = [
    { id: 'bellweather', name: 'Bellweather the lamplighter', path: [[18, 13], [77, 13], [77, 51], [35, 51], [35, 52], [18, 52], [18, 13]], loop: true, speed: 1.2, phase: 0 },
    { id: 'brannoc', name: 'Brannoc the porter', path: [[51, 57], [51, 51], [66, 51], [66, 44]], loop: false, speed: 1.0, phase: 0 },
    { id: 'fen', name: 'Fen', path: [[45, 41], [51, 41], [51, 46], [45, 46], [45, 41]], loop: true, speed: 1.8, phase: 0, child: true },
    { id: 'tilly', name: 'Tilly', path: [[45, 41], [51, 41], [51, 46], [45, 46], [45, 41]], loop: true, speed: 1.8, phase: 0.5, child: true },
  ];
  // the air: winged folk on their errands, over the roofs (drawn, never tapped)
  const FLIERS = [
    { id: 'wick', name: 'Wick the messenger', path: [[90, 17], [48, 20], [24, 24], [48, 48]], loop: false, speed: 3.2, phase: 0 },
    { id: 'wing1', name: 'A winged porter', path: [[20, 70], [48, 56], [76, 40]], loop: false, speed: 2.6, phase: 0.3 },
    { id: 'wing2', name: 'A winged guard', path: [[60, 4], [40, 30], [70, 60]], loop: false, speed: 2.8, phase: 0.6 },
  ];

  window.AERIE_PLAN = {
    W, H, ROWS, GLYPHS, KINDS, SPOTS, BUILDINGS, GATES, WARDS, DRAFTS, ROYAL, RUN_OFFSET: [27, 47],
    STATUE_NAMES, SPIRE_NAMES, BRIDGES, WALKERS, FLIERS,
    at, groundAt, scan, inBuilding, doorOf, wardAt,
  };
}
