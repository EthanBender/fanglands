// ============================================================================
// TWO MORE AGILITY COURSES — src/48-agility2.js
// Cohen asked for "agility courses where you level up by doing laps, and shortcuts". 38-agility.js built two of
// them (the Thistledown yard at 1, the Grey Quarry cliff at 30) and 45-progression.js added three river crossings
// (12, 22, 35). Above 35 there was nothing at all. This file adds the two ends of the ladder:
//
//   Sylvaris canopy run   — Agility 40, in the treetops above the path down to the elf city (300 xp a lap, 40
//                           coins every 5 laps);
//                           shortcut: the vine ladder over Sylvaris' wall of trees, Agility 45
//   Grubmarket rooftop run — Agility 60, along the scrap-metal roofs of the goblin market (800 xp a lap, 90 coins
//                           every 5 laps); shortcut: the goblins' scaffold, Agility 70 — three rungs that go over
//                           the scrap-yard fence and Tinkerton's compound wall instead of round to their gates
//
// Both courses run on 38-agility's machinery through window.AGILITY: the same flags, the same lap accounting, the
// same balance logs / climbing nets / jump gaps, and the same messages when you are not agile enough ("Slipped!
// Agility 32 for this log", "You fell! Agility 40 for this gap"). Nothing here is silent: every obstacle below its
// level costs health and says the number you need.
//
// And, like the yard's fence and the quarry's rock, each loop is WALLED, with one way in beside its start flag.
// That wall is the level requirement: without it you can walk the flags from the outside and take the xp at
// Agility 1, and a knight crossing the field gets slipped by a balance log over and over until it kills him.
//
// Feature file: registers through HOOKS only. The only other file touched is 38-agility.js, which gained
// window.AGILITY (the registration API) and a per-course lap purse. Everything lives in one block so no name leaks.
// Save state: none of its own — the laps live in quest.agility, kept by 38-agility.
// ============================================================================
{
  const AGI = window.AGILITY;                       // 38-agility's course machinery
  const AG_LOG = AGI.TILES.LOG, AG_NET = AGI.TILES.NET, AG_GAP = AGI.TILES.GAP, AG_MARK = AGI.TILES.MARK;

  // ---------- tiles ----------
  const CAN_DECK = addTile('CANOPY_DECK', { tex: 'plank', mini: '#a5763f' });                 // rope-bridge deck, high in the trees
  const CAN_RAIL = addTile('CANOPY_RAIL', { solid: true, tex: 'grass', mini: '#2f6a2a' });    // the woven rail down the middle of the loop
  const CAN_VINE = addTile('CANOPY_VINE', { solid: true, tex: 'grass', mini: '#6ab04c' });    // vine ladder: solid until Agility 45 (WALK_OVER)
  const ROOF_DECK = addTile('ROOF_DECK', { tex: 'cobble', mini: '#8f929a' });                 // scrap-metal roof panels
  const ROOF_RIDGE = addTile('ROOF_RIDGE', { solid: true, tex: 'hwall', mini: '#6e7178' });   // the roof ridge the loop runs around
  const GC_SCAFFOLD = addTile('GOBLIN_SCAFFOLD', { solid: true, tex: 'dirt', mini: '#c9a36a' }); // scaffold rung: solid until Agility 70

  const CANOPY_LV = 40, VINE_LV = 45, ROOF_LV = 60, SCAF_LV = 70;

  // ---------- geometry ----------
  // Both loops copy the Thistledown yard: two one-tile lanes with a solid spine between them, a turn at each end,
  // a start flag and four numbered flags. marks[0] is the start/finish.
  // Sylvaris canopy run: strung between the giant trees beside the path down from Hollowford, north-west of the
  // elf city. It stops at x 134 — the path itself comes through x 136-141 and must stay clear of the level-40 gap.
  const CAN = { x0: 121, x1: 134, north: 102, mid: 103, south: 104 };
  const CAN_MARKS = [[121, 102], [128, 102], [133, 102], [133, 104], [127, 104]];
  const CAN_LOGS = [[123, 102], [124, 102], [125, 102], [124, 104], [123, 104]];
  const CAN_NETS = [[130, 102], [131, 102]];
  const CAN_GAP1 = [[131, 104]];        // Agility 36
  const CAN_GAP2 = [[134, 103]];        // Agility 40 — the east turn, the leap that makes a lap
  // the vine ladder hangs on Sylvaris' wall of trees (25-elves' ring: x 126-166 at y 114). Over it is (128,115),
  // inside the city; round it is the totem gap at (137,114) and back again.
  const VINE = { x: 128, y: 114 };
  // Grubmarket rooftop run: the north roof line of the market, over Nix's Scrap and the hut beside it.
  const ROOF = { x0: 226, x1: 240, north: 19, mid: 20, south: 21 };
  const ROOF_MARKS = [[226, 19], [232, 19], [238, 19], [239, 21], [232, 21]];
  const ROOF_LOGS = [[228, 19], [229, 19], [230, 19], [229, 21], [228, 21]];
  const ROOF_NETS = [[234, 19], [235, 19]];
  const ROOF_GAP1 = [[235, 21]];        // Agility 52
  const ROOF_GAP2 = [[240, 20]];        // Agility 60 — the east turn, the jump over the alley
  // the goblins' scaffold: over the scrap yard's north fence, its south fence, and Tinkerton's compound wall
  const SCAFFOLD = [[245, 20], [250, 32], [254, 36]];

  // ---------- the wall round each loop ----------
  // Every shipped course is walled in. The Thistledown yard is fenced with one gate (38-agility, T.FENCE round
  // x 86-102 / y 50-54, T.GATE at 93,54) and the Grey Quarry ledge is cut into solid rock (T.WALL round x 46-62 /
  // y 1-4). That wall is not decoration: it is what stops a knight wandering onto a balance log by accident and
  // slipping over and over until it kills him. These two courses get the same wall — a rail right round the loop,
  // from x0-1 to x1+1 and from north-1 to south+1, with exactly one way in, put beside the start flag so the first
  // thing you meet is the flag and its message, never an obstacle.
  const CAN_DOOR = [121, 101], CAN_APPROACH = [121, 100];   // in off the jungle, straight down onto the canopy start flag
  const ROOF_DOOR = [225, 19], ROOF_APPROACH = [224, 19];   // in off the market cobbles, straight onto the roof start flag
  const ringOf = R => {
    const out = [];
    for (let x = R.x0 - 1; x <= R.x1 + 1; x++) { out.push([x, R.north - 1]); out.push([x, R.south + 1]); }
    for (let y = R.north; y <= R.south; y++) { out.push([R.x0 - 1, y]); out.push([R.x1 + 1, y]); }
    return out;
  };
  const notDoor = d => ([x, y]) => !(x === d[0] && y === d[1]);
  const CAN_RING = ringOf(CAN).filter(notDoor(CAN_DOOR));
  const ROOF_RING = ringOf(ROOF).filter(notDoor(ROOF_DOOR));

  const CAN_TRACK = [], ROOF_TRACK = [];   // every walkable tile of each loop, in no particular order
  for (const [R, out] of [[CAN, CAN_TRACK], [ROOF, ROOF_TRACK]]) {
    for (let x = R.x0; x <= R.x1; x++) { out.push([x, R.north]); out.push([x, R.south]); }
    out.push([R.x0, R.mid]); out.push([R.x1, R.mid]);
  }

  // ---------- register both courses on 38-agility ----------
  const CANOPY = AGI.addCourse('canopy', { name: 'Sylvaris canopy run', xp: 300, marks: CAN_MARKS, bonus: 40, bonusEvery: 5 });
  const ROOFTOP = AGI.addCourse('rooftop', { name: 'Grubmarket rooftop run', xp: 800, marks: ROOF_MARKS, bonus: 90, bonusEvery: 5 });
  AGI.addObstacles('canopy', AG_LOG, 32, CAN_LOGS);
  AGI.addObstacles('canopy', AG_NET, 1, CAN_NETS);
  AGI.addObstacles('canopy', AG_GAP, 36, CAN_GAP1);
  AGI.addObstacles('canopy', AG_GAP, CANOPY_LV, CAN_GAP2);
  AGI.addObstacles('rooftop', AG_LOG, 48, ROOF_LOGS);
  AGI.addObstacles('rooftop', AG_NET, 1, ROOF_NETS);
  AGI.addObstacles('rooftop', AG_GAP, 52, ROOF_GAP1);
  AGI.addObstacles('rooftop', AG_GAP, ROOF_LV, ROOF_GAP2);

  // ---------- world ----------
  // This runs last of the world hooks (file 48), so the deck, the spine and the flags are laid over whatever the
  // jungle, the goblin city and the world blend left behind, and nothing can move them afterwards.
  HOOKS.world.push((rnd, api) => {
    const set = api.setTile;
    for (const [x, y] of CAN_TRACK) set(x, y, CAN_DECK);
    for (let x = CAN.x0 + 1; x <= CAN.x1 - 1; x++) set(x, CAN.mid, CAN_RAIL);
    for (const [x, y] of ROOF_TRACK) set(x, y, ROOF_DECK);
    for (let x = ROOF.x0 + 1; x <= ROOF.x1 - 1; x++) set(x, ROOF.mid, ROOF_RIDGE);
    for (const [t, cells] of [[AG_LOG, CAN_LOGS], [AG_NET, CAN_NETS], [AG_GAP, CAN_GAP1], [AG_GAP, CAN_GAP2],
      [AG_LOG, ROOF_LOGS], [AG_NET, ROOF_NETS], [AG_GAP, ROOF_GAP1], [AG_GAP, ROOF_GAP2]]) for (const [x, y] of cells) set(x, y, t);
    for (const [x, y] of [...CAN_MARKS, ...ROOF_MARKS]) set(x, y, AG_MARK);
    // the wall, and the one way in. A ring cell that is already solid — a goblin hut's back wall, the scrap-yard
    // fence, a wall of jungle — is left alone and counted as the wall; everything else becomes rail or ridge.
    const shut = (x, y) => { const t = api.tileAt(x, y); return SOLID.has(t) && !PUSH_THROUGH.has(t); };
    for (const [x, y] of CAN_RING) if (!shut(x, y)) set(x, y, CAN_RAIL);
    for (const [x, y] of ROOF_RING) if (!shut(x, y)) set(x, y, ROOF_RIDGE);
    set(CAN_DOOR[0], CAN_DOOR[1], CAN_DECK); set(ROOF_DOOR[0], ROOF_DOOR[1], ROOF_DECK);
    if (shut(CAN_APPROACH[0], CAN_APPROACH[1])) set(CAN_APPROACH[0], CAN_APPROACH[1], T.DIRT);
    if (shut(ROOF_APPROACH[0], ROOF_APPROACH[1])) set(ROOF_APPROACH[0], ROOF_APPROACH[1], T.DIRT);
    // shortcuts. Both stay in SOLID for good: they only open for the knight, through WALK_OVER, at the level below.
    set(VINE.x, VINE.y, CAN_VINE);
    for (const [x, y] of SCAFFOLD) set(x, y, GC_SCAFFOLD);
  });

  // ---------- shortcuts ----------
  if (typeof INTERESTING_TILES !== 'undefined') { INTERESTING_TILES.add(CAN_VINE); INTERESTING_TILES.add(GC_SCAFFOLD); }
  let hintT = 0;
  HOOKS.newGame.push(() => { hintT = 0; WALK_OVER.delete(CAN_VINE); WALK_OVER.delete(GC_SCAFFOLD); });
  const agLv = () => skillLv('agility');
  HOOKS.update.push(dt => {
    const lv = agLv();
    if (lv >= VINE_LV) WALK_OVER.add(CAN_VINE); else WALK_OVER.delete(CAN_VINE);
    if (lv >= SCAF_LV) WALK_OVER.add(GC_SCAFFOLD); else WALK_OVER.delete(GC_SCAFFOLD);
    hintT = Math.max(0, hintT - dt);
    if (hintT > 0 || player.dead || player.mech) return;
    const near = (x, y) => dist(player.x, player.y, tc(x), tc(y)) < 1.6 * TILE;
    if (lv < VINE_LV && near(VINE.x, VINE.y)) { notify(`A vine ladder up the wall of trees. Agility ${VINE_LV} climbs it straight into Sylvaris.`); hintT = 12; }
    else if (lv < SCAF_LV && SCAFFOLD.some(([x, y]) => near(x, y))) { notify(`Goblin scaffolding. Agility ${SCAF_LV} goes over the wall here instead of round to the gate.`); hintT = 12; }
  });
  // E on a shortcut you are agile enough for carries you over it, the way the river crossings do (45-progression):
  // walking into it works too, but a tap on the iPad reaches a solid tile through `use`, never through `walk`.
  function stepOver(tx, ty, what) {
    const px = Math.floor(player.x / TILE), py = Math.floor(player.y / TILE);
    let dx = Math.sign(tx - px), dy = Math.sign(ty - py);
    if (dx && dy) { if (Math.abs(tx - px) >= Math.abs(ty - py)) dy = 0; else dx = 0; }
    const nx = tx + dx, ny = ty + dy;
    if ((!dx && !dy) || !inMap(nx, ny) || SOLID.has(tileAt(nx, ny))) { notify(`Stand at the foot of the ${what} and face it.`); return true; }
    player.x = tc(nx); player.y = tc(ny); player.action = null;
    floatText(player.x, player.y - 34, 'Over!', '#7ee787', 15); burst(player.x, player.y, '#bfe3ff', 12, 70); sfx('ui');
    return true;
  }
  HOOKS.use.push((t, tx, ty) => {
    if (t === CAN_VINE) { if (agLv() < VINE_LV) { notify(`The vine ladder needs Agility ${VINE_LV}. You are ${agLv()}.`); return true; } return stepOver(tx, ty, 'ladder'); }
    if (t === GC_SCAFFOLD) { if (agLv() < SCAF_LV) { notify(`This scaffold needs Agility ${SCAF_LV}. You are ${agLv()}.`); return true; } return stepOver(tx, ty, 'scaffold'); }
    if (t === CAN_RAIL) { notify('A rail of woven vine. The run goes round it, and the only way on is the gap above the start flag.'); return true; }
    if (t === ROOF_RIDGE) { notify('Scrap iron over a beam. The run goes round it, and the only way up is the gap beside the start flag.'); return true; }
    if (t === CAN_DECK) { notify(`Sylvaris canopy run. Touch the flags in order. Agility ${CANOPY_LV} for a full lap.`); return true; }
    if (t === ROOF_DECK) { notify(`Grubmarket rooftop run. Touch the flags in order. Agility ${ROOF_LV} for a full lap.`); return true; }
    return false;
  });

  // ---------- drawing ----------
  // 38-agility draws the logs, nets, gaps and flags on top; these items sort under them (a smaller y), so the deck
  // and the roof panels read as one continuous run instead of a strip of grass with obstacles dropped on it.
  const under = (tx, ty) => -1.5e8 + ty * TILE + tx * 0.01;
  const flat = (tx, ty) => -1e8 + ty * TILE + tx * 0.01;
  const inRect = (R, tx, ty) => tx >= R.x0 && tx <= R.x1 && ty >= R.north && ty <= R.south;
  const COURSE_TILES = new Set([AG_LOG, AG_NET, AG_GAP, AG_MARK]);

  function drawCanopyDeck(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, v = variant[idx(tx, ty)];
    g.fillStyle = 'rgba(6,16,8,0.85)'; g.fillRect(x, y, TILE, TILE);                 // the jungle floor, a long way down
    const sway = Math.sin(time * 0.9 + tx * 0.7) * 1.2;
    g.fillStyle = '#6b4a2a'; g.fillRect(x, y + 8 + sway, TILE, TILE - 18);           // the deck
    g.fillStyle = '#8a6a3a';
    for (let k = 0; k < 4; k++) g.fillRect(x + 1 + k * 12, y + 9 + sway, 10, TILE - 20);
    g.strokeStyle = 'rgba(40,25,10,0.55)'; g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(x + k * 12, y + 9 + sway); g.lineTo(x + k * 12, y + TILE - 11 + sway); g.stroke(); }
    // two rope rails, one at each side, with a knot every other tile
    g.strokeStyle = '#c9b58a'; g.lineWidth = 2;
    for (const ry of [y + 6 + sway, y + TILE - 6 + sway]) { g.beginPath(); g.moveTo(x, ry); g.quadraticCurveTo(x + TILE / 2, ry + 2.5, x + TILE, ry); g.stroke(); }
    g.fillStyle = '#9fe0b0'; if (v % 2 === 0) { g.beginPath(); g.ellipse(x + 10, y + 5 + sway, 3.5, 2, 0.5, 0, 7); g.fill(); }
  }
  function drawCanopyRail(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, sway = Math.sin(time * 0.8 + tx * 0.5) * 1.5;
    g.save();                                          // lineCap is set below: keep it off every later drawer
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y + TILE - 10, TILE, 10);
    g.fillStyle = '#3a2614'; g.fillRect(x + 6, y + 10, 5, TILE - 16); g.fillRect(x + TILE - 11, y + 10, 5, TILE - 16);
    g.strokeStyle = '#2f6a2a'; g.lineWidth = 3; g.lineCap = 'round';
    for (const ry of [y + 14, y + 26, y + 38]) { g.beginPath(); g.moveTo(x, ry + sway * 0.4); g.quadraticCurveTo(x + TILE / 2, ry + 3 + sway, x + TILE, ry + sway * 0.4); g.stroke(); }
    g.fillStyle = '#3ea54a';
    for (const [ox, oy] of [[12, 18], [30, 30], [20, 40]]) { g.beginPath(); g.ellipse(x + ox, y + oy + sway, 4, 2, 0.6, 0, 7); g.fill(); }
    g.restore();
  }
  function drawVineLadder(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, open = WALK_OVER.has(CAN_VINE), sway = Math.sin(time * 1.1) * 1.5;
    g.save();                                          // lineCap again
    g.fillStyle = '#17451f'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#1f5a2a'; g.beginPath(); g.arc(x + 12, y + 14, 13, 0, 7); g.arc(x + 34, y + 30, 15, 0, 7); g.fill();
    g.strokeStyle = open ? '#9fe0b0' : '#5a7a4a'; g.lineWidth = 3; g.lineCap = 'round';
    for (const ox of [x + 16, x + 30]) { g.beginPath(); g.moveTo(ox, y); g.quadraticCurveTo(ox + sway, y + TILE / 2, ox, y + TILE); g.stroke(); }
    g.strokeStyle = open ? '#c9b58a' : '#6b5a3a'; g.lineWidth = 2.5;
    for (let k = 0; k < 4; k++) { const ry = y + 6 + k * 12; g.beginPath(); g.moveTo(x + 16, ry); g.lineTo(x + 30, ry + 1); g.stroke(); }
    if (!open) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, TILE, TILE); }
    g.restore();
  }
  function drawRoofDeck(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, v = variant[idx(tx, ty)];
    g.fillStyle = 'rgba(10,12,16,0.8)'; g.fillRect(x, y, TILE, TILE);                 // the street below
    g.fillStyle = '#5a5f6a'; g.fillRect(x, y + 6, TILE, TILE - 12);                    // the panel
    const tone = ['#7a8090', '#6e7484', '#848a99'];
    for (let k = 0; k < 6; k++) { g.fillStyle = tone[(k + v) % 3]; g.fillRect(x + k * 8, y + 7, 7, TILE - 14); }
    g.strokeStyle = 'rgba(20,24,30,0.6)'; g.lineWidth = 1;
    for (let k = 0; k <= 6; k++) { g.beginPath(); g.moveTo(x + k * 8, y + 7); g.lineTo(x + k * 8, y + TILE - 7); g.stroke(); }
    g.fillStyle = '#c2c8d2'; for (const [ox, oy] of [[6, 12], [26, 12], [14, 36], [38, 36]]) { g.beginPath(); g.arc(x + ox, y + oy, 1.5, 0, 7); g.fill(); }
    g.fillStyle = '#3a3f4a'; g.fillRect(x, y + TILE - 6, TILE, 4);                     // the lip of the roof
    if (v === 1) { g.fillStyle = '#8a5a2b'; g.fillRect(x + 20, y + 2, 8, 6); }         // a patched-in plank
  }
  function drawRoofRidge(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + TILE - 12, TILE, 12);
    g.fillStyle = '#4a4f5a'; g.fillRect(x, y + 12, TILE, TILE - 22);
    g.fillStyle = '#9aa2b0'; g.beginPath(); g.moveTo(x, y + 16); g.lineTo(x + TILE / 2, y + 4); g.lineTo(x + TILE, y + 16); g.lineTo(x + TILE, y + 22); g.lineTo(x + TILE / 2, y + 10); g.lineTo(x, y + 22); g.closePath(); g.fill();
    g.fillStyle = '#6a5a3a'; g.fillRect(x + 8, y + 22, 5, TILE - 30); g.fillRect(x + TILE - 13, y + 22, 5, TILE - 30);
    g.strokeStyle = 'rgba(20,24,30,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + 30); g.lineTo(x + TILE, y + 30); g.stroke();
  }
  function drawScaffold(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, open = WALK_OVER.has(GC_SCAFFOLD);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 2, y + TILE - 8, TILE - 4, 8);
    g.fillStyle = '#6a5a3a'; g.fillRect(x + 5, y + 4, 5, TILE - 8); g.fillRect(x + TILE - 10, y + 4, 5, TILE - 8);
    g.fillStyle = open ? '#c9a36a' : '#8a7a5a';
    for (const ry of [y + 10, y + 24, y + 38]) g.fillRect(x + 4, ry, TILE - 8, 5);
    g.strokeStyle = '#4a4a52'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 6, y + 6); g.lineTo(x + TILE - 6, y + TILE - 6); g.stroke();
    g.fillStyle = '#4a4a52'; g.beginPath(); g.arc(x + 10, y + 10, 2, 0, 7); g.arc(x + TILE - 10, y + TILE - 10, 2, 0, 7); g.fill();
    if (!open) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y, TILE, TILE); }
  }
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 1);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === CAN_DECK) items.push({ y: flat(tx, ty), draw: () => drawCanopyDeck(g, tx, ty) });
      else if (t === ROOF_DECK) items.push({ y: flat(tx, ty), draw: () => drawRoofDeck(g, tx, ty) });
      else if (t === CAN_RAIL) items.push({ y: ty * TILE + TILE - 5, draw: () => drawCanopyRail(g, tx, ty) });
      else if (t === ROOF_RIDGE) items.push({ y: ty * TILE + TILE - 5, draw: () => drawRoofRidge(g, tx, ty) });
      else if (t === CAN_VINE) items.push({ y: ty * TILE + TILE - 4, draw: () => drawVineLadder(g, tx, ty) });
      else if (t === GC_SCAFFOLD) items.push({ y: ty * TILE + TILE - 4, draw: () => drawScaffold(g, tx, ty) });
      else if (COURSE_TILES.has(t)) {                                   // an obstacle of one of these two courses: lay its deck first
        if (inRect(CAN, tx, ty)) items.push({ y: under(tx, ty), draw: () => drawCanopyDeck(g, tx, ty) });
        else if (inRect(ROOF, tx, ty)) items.push({ y: under(tx, ty), draw: () => drawRoofDeck(g, tx, ty) });
      }
    }
  });

  // ---------- the progression audit (42-playthrough reads HOOKS.xpSource) ----------
  const lapSecs = marks => { let tiles = 0; for (let i = 0; i < marks.length; i++) { const a = marks[i], b = marks[(i + 1) % marks.length]; tiles += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); } return tiles * TILE / 175 + 2 * TILE * (1 / 60 - 1 / 175); };
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    add('agility', 'Sylvaris canopy run (lap)', CANOPY_LV, CANOPY.xp, lapSecs(CAN_MARKS), `logs at 32, the first gap at 36, the east leap at ${CANOPY_LV}`);
    add('agility', 'Grubmarket rooftop run (lap)', ROOF_LV, ROOFTOP.xp, lapSecs(ROOF_MARKS), `logs at 48, the first gap at 52, the alley jump at ${ROOF_LV}`);
  });

  window.AGILITY2 = { CANOPY, ROOFTOP, CAN, ROOF, VINE, SCAFFOLD, CANOPY_LV, VINE_LV, ROOF_LV, SCAF_LV, CAN_DOOR, ROOF_DOOR, CAN_RING, ROOF_RING, TILES: { CAN_DECK, CAN_RAIL, CAN_VINE, ROOF_DECK, ROOF_RIDGE, GC_SCAFFOLD } };

  // ---------- self-test ----------
  const P = 'agility2: ';
  HOOKS.selfTest.push((check, F, h) => {
    const co0 = window.FANGLANDS.companion && window.FANGLANDS.companion.comp();
    const s0 = { x: player.x, y: player.y, hp: player.hp, speed: player.speed, cape: player.equip.cape, agility: { ...player.skills.agility }, laps: JSON.parse(JSON.stringify(AGI.state())), co: co0 && co0.id ? { x: co0.x, y: co0.y } : null };
    h.peace(true); closePanel(); dialog.cur = null; dialog.queue.length = 0; player.action = null; player.equip.cape = null;
    const tileOf = () => ({ tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) });
    const setLv = lv => { player.skills.agility.xp = lv <= 1 ? 0 : XP_TABLE[lv]; F.step([]); };
    const said = re => floaters.some(f => re.test(f.text)) || (notice && re.test(notice.text));
    // A companion at the knight's heel answers E before any tile does (21-companion's use hook, 72 px and in front),
    // and a villager standing close does the same (06-systems' npcInFront). Park both before pressing E; the
    // companion walks back on its own, and its position is restored with everything else at the end.
    const CO = window.FANGLANDS.companion;
    const clearFront = () => {
      for (const n of NPCS) if (dist(n.px, n.py, player.x, player.y) < 5 * TILE) { n.px = tc(n.x); n.py = tc(n.y); if (dist(n.px, n.py, player.x, player.y) < 5 * TILE) { n.px += 10 * TILE; n.py += 10 * TILE; } n.wanderT = 30; n.dir = null; }
      const c = CO && CO.comp(); if (c && c.id) { c.x = player.x + 12 * TILE; c.y = player.y + 12 * TILE; }
      notice = null; floaters.length = 0;
    };
    // a BFS the knight could actually walk: solid stops it, doors and gates do not, `open` lists the shortcut
    // tiles to treat as climbable, and `shut` lists tiles this walk refuses to enter (the obstacle tiles, when the
    // question is whether the course can be got round without meeting one). Returns the steps, or -1 for no way.
    const route = (sx, sy, tx, ty, open = [], shut = []) => {
      const W = MAP_W, H = MAP_H, prev = new Int32Array(W * H).fill(-1), q = [sy * W + sx];
      prev[sy * W + sx] = sy * W + sx;
      const pass = t => !shut.includes(t) && (open.includes(t) || !SOLID.has(t) || PUSH_THROUGH.has(t));
      for (let qi = 0; qi < q.length; qi++) {
        const c = q[qi], cx = c % W, cy = (c / W) | 0; if (cx === tx && cy === ty) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy; if (!inMap(nx, ny)) continue; const n = ny * W + nx;
          if (prev[n] !== -1 || (!pass(map[n]) && !(nx === tx && ny === ty))) continue;
          prev[n] = c; q.push(n);
        }
      }
      if (prev[ty * W + tx] === -1) return null;
      const path = []; let c = ty * W + tx; while (c !== sy * W + sx) { path.push([c % W, (c / W) | 0]); c = prev[c]; }
      return path.reverse();
    };
    const walkLen = (sx, sy, tx, ty, open = [], shut = []) => { const p = route(sx, sy, tx, ty, open, shut); return p ? p.length : -1; };
    // touch a list of flags by teleporting onto them. This is only ever used to prove the ORDER rule (flags out of
    // order pay nothing); a lap that is meant to prove the course can be run is walked, below.
    const tpLap = (course, marks) => {
      const st = AGI.state(); st.next[course] = 0; const laps0 = st.laps[course], xp0 = player.skills.agility.xp, c0 = coins();
      for (const [x, y] of marks) { F.tp(x, y); F.step([]); }
      return { xp: player.skills.agility.xp - xp0, laps: st.laps[course] - laps0, coins: coins() - c0 };
    };
    // WALK a lap: start on the ground outside the one entrance and run the flags in order, no teleporting. `guard`
    // tops the knight's health up between short stretches, so a course he is too low for can slip him as often as
    // it likes without a death cascading through every later check — what is being measured is the lap counter.
    const walkLeg = (x, y, budget, guard) => {
      if (!guard) return F.walkTo(x, y, budget);
      // a knight who is not agile enough goes ROUND an obstacle whenever the ground lets him — that is exactly how
      // an unwalled course gets farmed at level 1. First he tries a way round that touches no obstacle and no other
      // course flag (crossing the start flag out of turn would only reset his lap), then any way round at all, and
      // only when there is none does he take the obstacle on the chin.
      const here = tileOf();
      const round = route(here.tx, here.ty, x, y, [], [AG_LOG, AG_GAP, AG_MARK]) || route(here.tx, here.ty, x, y, [], [AG_LOG, AG_GAP]);
      if (round) { for (const [wx, wy] of round) { player.hp = player.maxHp; F.walkTo(wx, wy, 120); } player.hp = player.maxHp; return 'round ' + round.length; }
      let r = 'timeout';
      for (let s = 0; s < budget; s += 60) { player.hp = player.maxHp; r = F.walkTo(x, y, 60); if (r !== 'timeout') break; }
      player.hp = player.maxHp; return r;
    };
    const walkLap = (course, marks, from, guard = false, budget = 1500) => {
      const st = AGI.state(); st.next[course] = 0;
      const laps0 = st.laps[course], xp0 = player.skills.agility.xp, c0 = coins(), hp0 = player.hp;
      F.tp(from[0], from[1]); F.step([]);
      const legs = [];
      for (const [x, y] of [marks[0], marks[1], marks[2], marks[3], marks[4], marks[0]]) legs.push(walkLeg(x, y, budget, guard));
      return { xp: player.skills.agility.xp - xp0, laps: st.laps[course] - laps0, coins: coins() - c0, hurt: guard ? 0 : hp0 - player.hp, legs };
    };
    // lean on one key from a spot on open ground, the way a ten-year-old does, and report where it left you and
    // what it cost. Health is topped up every 20 ticks so a broken wall shows as damage instead of as a death.
    const holdFrom = (fx, fy, code, ticks = 180) => {
      player.dead = false; player.hp = player.maxHp; F.tp(fx, fy); F.step([]);
      let lost = 0;
      for (let i = 0; i < ticks; i += 20) { F.sim(20, [code]); lost += player.maxHp - player.hp; player.hp = player.maxHp; if (player.dead) { player.dead = false; break; } }
      return { at: tileOf(), lost };
    };
    const onTrack = (R, r) => r.at.tx >= R.x0 && r.at.tx <= R.x1 && r.at.ty >= R.north && r.at.ty <= R.south;
    const stayedOut = (R, r) => r.lost === 0 && !onTrack(R, r);

    // ---- the canopy loop is walled, with one way in ----
    // The two shipped courses are enclosed: the Thistledown yard is fenced with a single gate and the Grey Quarry
    // ledge is cut into rock, so no amount of leaning on one key drops you onto a balance log. Without that wall a
    // level-40 course is only a suggestion — you can walk the flags from the outside and take the xp, and a knight
    // crossing the field gets slipped over and over until the coffin fee. So: no hole in the ring bar the door, no
    // way to reach flag 1 without meeting an obstacle, and a held key on open ground costs nothing.
    { setLv(1);
      const hole = ([x, y]) => !SOLID.has(tileAt(x, y)) || PUSH_THROUGH.has(tileAt(x, y));
      const holes = CAN_RING.filter(hole);
      const doorOpen = !SOLID.has(tileAt(CAN_DOOR[0], CAN_DOOR[1])) && !SOLID.has(tileAt(CAN_APPROACH[0], CAN_APPROACH[1]));
      const sneak = walkLen(CAN_APPROACH[0], CAN_APPROACH[1], CAN_MARKS[1][0], CAN_MARKS[1][1], [], [AG_LOG, AG_GAP]);
      const north = holdFrom(124, 100, 'KeyS');          // straight at the balance logs from the jungle floor
      const south = holdFrom(127, 106, 'KeyW');
      const east = holdFrom(136, 102, 'KeyA');
      const inDoor = holdFrom(CAN_APPROACH[0], CAN_APPROACH[1], 'KeyS');
      check(P + 'the canopy loop is walled the whole way round with one way in: holding a key on the jungle floor never puts you on a balance log, and flag 1 cannot be reached without an obstacle',
        holes.length === 0 && doorOpen && sneak === -1 && stayedOut(CAN, north) && stayedOut(CAN, south) && stayedOut(CAN, east) && onTrack(CAN, inDoor) && inDoor.lost === 0,
        { holes, doorOpen, sneak, north, south, east, inDoor }); }

    // ---- the canopy run exists, is walkable, and is carved where it should be ----
    { const deck = CAN_TRACK.filter(([x, y]) => [CAN_DECK, AG_LOG, AG_NET, AG_GAP, AG_MARK].includes(tileAt(x, y))).length;
      let rail = 0; for (let x = CAN.x0 + 1; x <= CAN.x1 - 1; x++) if (tileAt(x, CAN.mid) === CAN_RAIL) rail++;
      const pieces = CAN_MARKS.every(([x, y]) => tileAt(x, y) === AG_MARK) && CAN_LOGS.every(([x, y]) => tileAt(x, y) === AG_LOG)
        && CAN_NETS.every(([x, y]) => tileAt(x, y) === AG_NET) && tileAt(131, 104) === AG_GAP && tileAt(134, 103) === AG_GAP;
      const reach = F.bfs(141, 96, CAN_MARKS[0][0], CAN_MARKS[0][1]);           // from the jungle path down to the start flag
      setLv(CANOPY_LV); F.tp(140, 102); const walked = F.walkTo(CAN_MARKS[0][0], CAN_MARKS[0][1], 4000);
      check(P + 'the Sylvaris canopy run is carved in the treetops (deck, vine rail, logs, nets, two gaps, five flags) and you can walk to it from the jungle path',
        deck === CAN_TRACK.length && rail === CAN.x1 - CAN.x0 - 1 && pieces && !!reach && typeof walked === 'number' && tileOf().tx === CAN_MARKS[0][0],
        { deck, track: CAN_TRACK.length, rail, pieces, reach: reach && reach.length, walked, at: tileOf() }); }

    // ---- below 40 the east leap drops you; at 40 a lap pays 320 xp ----
    { setLv(CANOPY_LV - 1); const st = AGI.state(); st.next.canopy = 4; floaters.length = 0;
      player.hp = player.maxHp; const hp0 = player.hp; const xp0 = player.skills.agility.xp;
      F.tp(CAN.x1, CAN.north); F.step([]); F.tp(CAN_GAP2[0][0], CAN_GAP2[0][1]); F.step([]);
      const fell = player.hp === hp0 - 2 && said(new RegExp('Agility ' + CANOPY_LV + ' for this gap')) && st.next.canopy === 0 && player.skills.agility.xp === xp0;
      const backAtStart = dist(player.x, player.y, tc(CAN_MARKS[0][0]), tc(CAN_MARKS[0][1])) < 3 * TILE;
      floaters.length = 0; setLv(CANOPY_LV); player.hp = player.maxHp; st.next.canopy = 4;
      F.tp(CAN.x1, CAN.north); F.step([]); F.tp(CAN_GAP2[0][0], CAN_GAP2[0][1]); F.step([]);
      const jumped = player.hp === player.maxHp && said(/Jump!/) && st.next.canopy === 4;
      check(P + `the canopy run's east leap fails informatively below Agility ${CANOPY_LV} (2 damage, back to the start flag, lap lost) and clears at ${CANOPY_LV}`,
        fell && backAtStart && jumped, { fell, backAtStart, jumped, hp: player.hp, maxHp: player.maxHp }); }
    { setLv(CANOPY_LV); h.give('coins', 1); player.hp = player.maxHp;
      const st = AGI.state(); st.laps.canopy = CANOPY.bonusEvery - 1;
      const r = walkLap('canopy', CAN_MARKS, CAN_APPROACH);          // in through the door and round on foot, no teleporting
      const st2 = AGI.state(); st2.next.canopy = 0; const bad = tpLap('canopy', [CAN_MARKS[0], CAN_MARKS[2], CAN_MARKS[1], CAN_MARKS[3], CAN_MARKS[4]]);
      check(P + `a canopy lap WALKED at Agility ${CANOPY_LV} pays ${CANOPY.xp} Agility xp and ${CANOPY.bonus} coins every ${CANOPY.bonusEvery} laps; the flags out of order pay nothing`,
        r.xp === CANOPY.xp && r.laps === 1 && r.coins === CANOPY.bonus && r.hurt === 0 && bad.xp === 0 && bad.laps === 0,
        { lapXp: r.xp, laps: r.laps, bonus: r.coins, legs: r.legs, hurt: r.hurt, outOfOrder: bad.xp, name: CANOPY.name }); }
    // ---- and the same walk at Agility 1 pays nothing at all: the course refuses you ----
    { setLv(1); const st = AGI.state(); st.laps.canopy = 0; st.next.canopy = 0;
      const r = walkLap('canopy', CAN_MARKS, CAN_APPROACH, true, 600);
      check(P + `Agility 1 cannot walk a canopy lap: the logs at 32 and the leap at ${CANOPY_LV} turn you back, so no lap is credited and no xp is paid`,
        r.laps === 0 && r.xp === 0 && r.coins === 0 && AGI.state().next.canopy <= 1,
        { laps: r.laps, xp: r.xp, coins: r.coins, legs: r.legs, nextFlag: AGI.state().next.canopy, stoppedAt: tileOf() }); }

    // ---- the vine ladder: shut below 45, and a real short cut into Sylvaris at 45 ----
    { const outside = [VINE.x, VINE.y - 1], inside = [VINE.x, VINE.y + 1];
      setLv(VINE_LV - 1); F.tp(outside[0], outside[1]); F.sim(60, ['KeyS']); const blockedY = tileOf().ty;
      const shut = blockedY <= VINE.y - 1 && !WALK_OVER.has(CAN_VINE);
      setLv(VINE_LV); F.step([]); F.sim(90, ['KeyS']); const climbedY = tileOf().ty;
      const climbed = climbedY >= VINE.y && WALK_OVER.has(CAN_VINE);
      const roundabout = walkLen(outside[0], outside[1], inside[0], inside[1]);
      const over = walkLen(outside[0], outside[1], inside[0], inside[1], [CAN_VINE]);
      setLv(VINE_LV - 1); F.tp(outside[0], outside[1]); clearFront(); F.face(VINE.x, VINE.y); F.press('KeyE'); F.sim(2, []);
      const eRefused = tileOf().ty === outside[1] && notice && new RegExp('Agility ' + VINE_LV).test(notice.text);
      setLv(VINE_LV); F.tp(outside[0], outside[1]); clearFront(); F.face(VINE.x, VINE.y); F.press('KeyE'); F.sim(2, []);
      const eClimbed = tileOf().ty === inside[1] && tileOf().tx === inside[0];
      check(P + `the vine ladder over Sylvaris' wall of trees is solid below Agility ${VINE_LV}, climbs at ${VINE_LV} (walk into it or press E), and saves the walk round to the totem gap`,
        tileAt(VINE.x, VINE.y) === CAN_VINE && SOLID.has(CAN_VINE) && shut && climbed && eRefused && eClimbed && over > 0 && roundabout > over + 15,
        { blockedY, climbedY, shut, climbed, eRefused, eClimbed, stepsRound: roundabout, stepsOver: over, saved: roundabout - over }); }

    // ---- the rooftop loop is walled, with one way in ----
    { setLv(1);
      const hole = ([x, y]) => !SOLID.has(tileAt(x, y)) || PUSH_THROUGH.has(tileAt(x, y));
      const holes = ROOF_RING.filter(hole);
      const doorOpen = !SOLID.has(tileAt(ROOF_DOOR[0], ROOF_DOOR[1])) && !SOLID.has(tileAt(ROOF_APPROACH[0], ROOF_APPROACH[1]));
      const sneak = walkLen(ROOF_APPROACH[0], ROOF_APPROACH[1], ROOF_MARKS[1][0], ROOF_MARKS[1][1], [], [AG_LOG, AG_GAP]);
      const north = holdFrom(229, 17, 'KeyS');           // straight at the balance logs off the market grass
      const south = holdFrom(233, 23, 'KeyW');
      const east = holdFrom(242, 19, 'KeyA');
      const inDoor = holdFrom(ROOF_APPROACH[0], ROOF_APPROACH[1], 'KeyD', 40);
      check(P + 'the rooftop loop is walled the whole way round with one way in: holding a key in the market never puts you on a balance log, and flag 1 cannot be reached without an obstacle',
        holes.length === 0 && doorOpen && sneak === -1 && stayedOut(ROOF, north) && stayedOut(ROOF, south) && stayedOut(ROOF, east) && onTrack(ROOF, inDoor) && inDoor.lost === 0,
        { holes, doorOpen, sneak, north, south, east, inDoor }); }

    // ---- the rooftop run exists, is walkable, and is carved where it should be ----
    { const deck = ROOF_TRACK.filter(([x, y]) => [ROOF_DECK, AG_LOG, AG_NET, AG_GAP, AG_MARK].includes(tileAt(x, y))).length;
      let ridge = 0; for (let x = ROOF.x0 + 1; x <= ROOF.x1 - 1; x++) if (tileAt(x, ROOF.mid) === ROOF_RIDGE) ridge++;
      const pieces = ROOF_MARKS.every(([x, y]) => tileAt(x, y) === AG_MARK) && ROOF_LOGS.every(([x, y]) => tileAt(x, y) === AG_LOG)
        && ROOF_NETS.every(([x, y]) => tileAt(x, y) === AG_NET) && tileAt(235, 21) === AG_GAP && tileAt(240, 20) === AG_GAP;
      const reach = F.bfs(206, 30, ROOF_MARKS[0][0], ROOF_MARKS[0][1]);        // from Harl's far landing into the market and up
      setLv(ROOF_LV); F.tp(ROOF_APPROACH[0], ROOF_APPROACH[1]);
      const walkedIn = F.walkTo(ROOF_MARKS[0][0], ROOF_MARKS[0][1], 3000);     // in off the cobbles, through the one door
      const walked = F.walkTo(ROOF_MARKS[2][0], ROOF_MARKS[2][1], 3000);
      check(P + 'the Grubmarket rooftop run is carved along the market roofs (panels, ridge, logs, nets, two gaps, five flags) and you can walk in to it from the ferry landing',
        deck === ROOF_TRACK.length && ridge === ROOF.x1 - ROOF.x0 - 1 && pieces && !!reach && typeof walkedIn === 'number' && typeof walked === 'number' && tileOf().tx === ROOF_MARKS[2][0],
        { deck, track: ROOF_TRACK.length, ridge, pieces, reach: reach && reach.length, walkedIn, walked, at: tileOf() }); }

    // ---- below 60 the alley jump drops you; at 60 a lap pays 800 xp ----
    { setLv(ROOF_LV - 1); const st = AGI.state(); st.next.rooftop = 4; floaters.length = 0;
      player.hp = player.maxHp; const hp0 = player.hp; const xp0 = player.skills.agility.xp;
      F.tp(ROOF.x1, ROOF.north); F.step([]); F.tp(ROOF_GAP2[0][0], ROOF_GAP2[0][1]); F.step([]);
      const fell = player.hp === hp0 - 2 && said(new RegExp('Agility ' + ROOF_LV + ' for this gap')) && st.next.rooftop === 0 && player.skills.agility.xp === xp0;
      const backAtStart = dist(player.x, player.y, tc(ROOF_MARKS[0][0]), tc(ROOF_MARKS[0][1])) < 3 * TILE;
      floaters.length = 0; setLv(ROOF_LV); player.hp = player.maxHp; st.next.rooftop = 4;
      F.tp(ROOF.x1, ROOF.north); F.step([]); F.tp(ROOF_GAP2[0][0], ROOF_GAP2[0][1]); F.step([]);
      const jumped = player.hp === player.maxHp && said(/Jump!/) && st.next.rooftop === 4;
      check(P + `the rooftop run's alley jump fails informatively below Agility ${ROOF_LV} (2 damage, back to the start flag, lap lost) and clears at ${ROOF_LV}`,
        fell && backAtStart && jumped, { fell, backAtStart, jumped, hp: player.hp, maxHp: player.maxHp }); }
    { setLv(ROOF_LV); h.give('coins', 1); player.hp = player.maxHp;
      const st = AGI.state(); st.laps.rooftop = ROOFTOP.bonusEvery - 1;
      const r = walkLap('rooftop', ROOF_MARKS, ROOF_APPROACH);       // in through the door and round on foot, no teleporting
      const st2 = AGI.state(); st2.next.rooftop = 0; const bad = tpLap('rooftop', [ROOF_MARKS[0], ROOF_MARKS[2], ROOF_MARKS[1], ROOF_MARKS[3], ROOF_MARKS[4]]);
      check(P + `a rooftop lap WALKED at Agility ${ROOF_LV} pays ${ROOFTOP.xp} Agility xp and ${ROOFTOP.bonus} coins every ${ROOFTOP.bonusEvery} laps; the flags out of order pay nothing`,
        r.xp === ROOFTOP.xp && r.laps === 1 && r.coins === ROOFTOP.bonus && r.hurt === 0 && bad.xp === 0 && bad.laps === 0,
        { lapXp: r.xp, laps: r.laps, bonus: r.coins, legs: r.legs, hurt: r.hurt, outOfOrder: bad.xp, name: ROOFTOP.name }); }
    // ---- and the same walk at Agility 1 pays nothing at all: the course refuses you ----
    { setLv(1); const st = AGI.state(); st.laps.rooftop = 0; st.next.rooftop = 0;
      const r = walkLap('rooftop', ROOF_MARKS, ROOF_APPROACH, true, 600);
      check(P + `Agility 1 cannot walk a rooftop lap: the logs at 48 and the alley jump at ${ROOF_LV} turn you back, so no lap is credited and no xp is paid`,
        r.laps === 0 && r.xp === 0 && r.coins === 0 && AGI.state().next.rooftop <= 1,
        { laps: r.laps, xp: r.xp, coins: r.coins, legs: r.legs, nextFlag: AGI.state().next.rooftop, stoppedAt: tileOf() }); }

    // ---- the goblins' scaffold: shut below 70, and a real short cut from the scrap yard to Tinkerton's compound ----
    { const rungs = SCAFFOLD.every(([x, y]) => tileAt(x, y) === GC_SCAFFOLD);
      setLv(SCAF_LV - 1); F.tp(250, 33); F.sim(60, ['KeyW']); const blockedY = tileOf().ty;
      const shut = blockedY >= 33 && !WALK_OVER.has(GC_SCAFFOLD);
      setLv(SCAF_LV); F.step([]); F.sim(90, ['KeyW']); const overY = tileOf().ty;
      const over = overY <= 31 && WALK_OVER.has(GC_SCAFFOLD);
      const roundabout = walkLen(250, 30, 247, 42);                             // the scrap yard to the lab door, both gates
      const shortcut = walkLen(250, 30, 247, 42, [GC_SCAFFOLD]);
      // every rung has to come down on ground you can stand on, on both sides, or the climb goes nowhere
      const landings = SCAFFOLD.every(([x, y]) => !SOLID.has(tileAt(x, y - 1)) && !SOLID.has(tileAt(x, y + 1)));
      setLv(SCAF_LV - 1); F.tp(250, 33); clearFront(); F.face(250, 32); F.press('KeyE'); F.sim(2, []);
      const eRefused = tileOf().ty === 33 && notice && new RegExp('Agility ' + SCAF_LV).test(notice.text);
      setLv(SCAF_LV); F.tp(250, 33); clearFront(); F.face(250, 32); F.press('KeyE'); F.sim(2, []);
      const eClimbed = tileOf().tx === 250 && tileOf().ty === 31;
      check(P + `the goblins' scaffold (three rungs) is solid below Agility ${SCAF_LV}, goes over at ${SCAF_LV} (walk into it or press E), and cuts the walk from the scrap yard to Tinkerton's lab door`,
        rungs && SOLID.has(GC_SCAFFOLD) && landings && shut && over && eRefused && eClimbed && shortcut > 0 && roundabout > shortcut + 15,
        { rungs, landings, blockedY, overY, shut, over, eRefused, eClimbed, stepsRound: roundabout, stepsOver: shortcut, saved: roundabout - shortcut }); }

    // ---- the two courses fill the gap above Agility 35, and the audit can see them ----
    { const reqs = []; for (const f of HOOKS.xpSource) f((skill, name, req, xp) => { if (skill === 'agility' && xp > 0) reqs.push(req); });
      const has = req => reqs.includes(req);
      check(P + `both courses are declared to the progression audit at Agility ${CANOPY_LV} and ${ROOF_LV} (nothing stood above 35 before)`,
        has(CANOPY_LV) && has(ROOF_LV) && AGI.COURSES.canopy === CANOPY && AGI.COURSES.rooftop === ROOFTOP && CANOPY.xp === 300 && ROOFTOP.xp === 800,
        { reqs: reqs.slice().sort((a, b) => a - b), courses: Object.keys(AGI.COURSES) }); }

    // put everything back
    player.skills.agility = s0.agility; player.equip.cape = s0.cape; quest.agility = s0.laps;
    if (s0.co && co0) { co0.x = s0.co.x; co0.y = s0.co.y; }
    player.x = s0.x; player.y = s0.y; player.action = null; player.speed = s0.speed; F.step([]);
    player.hp = Math.min(s0.hp, player.maxHp); h.peace(false); closePanel();
  });
}
