// ============================================================================
// AERIE, THE WALLED KINGDOM — Cohen's Cloud Kingdom. src/91-cloudkingdom.js
//
// Cohen (ten), 2026-09-24, verbatim: "I want the cloud kingdome to be a actual kingdome with walls and a keep and
// spires and gates and fountains and buildings and roads and bridges and parks and decorations".
//
// Aerie was mostly open white cloud with a plank path. This file turns it into a walled city of white stone, gold and
// sky-blue: a curtain wall with nineteen towers and five gates, Queen Seraphel's keep on a raised plaza in a moat of
// sky, five spires, two fountains, twelve buildings you walk into (the roof lifts), paved streets to everywhere, eight
// bridges, the Queen's Garden with a hedge maze and the Mirror Pond, and lamps, banners, planters, awnings and bunting.
// People live there, and the Queen has one small story: Lark's First Flight.
//
// src/36-aerieplan.js is the plan (100 x 80 characters). 36-skycity sizes the instance from it and lays the sky;
// this file paints every other cell of it once, at load, with no random numbers, so every knight online builds
// exactly the same city. 88-aerie keeps the Rookery, the Songstone, the Catch, the Spire Run and the six updrafts,
// all moved onto the plan's spots.
//
// HOW THE BUILDINGS WORK (instance-local BUILDINGS)
//   The core draws BUILDINGS with a roof that lifts when the knight stands inside one. Aerie's twelve are mounted
//   into BUILDINGS only while window.__instance === 'aerie' and taken out on every way out: INSTANCES.enter/leave
//   (wrapped), the L key and the LEAVE button and dying (16-instances calls leaveInstance directly, so the update
//   hook re-syncs at the start and the end of every tick), load, respawnPoint and a new game (generateWorld leaves
//   the instance first, so the Thistledown buildings the instance hid are back before the world is carved again).
//   drawBuilding is wrapped: a kingdom building draws itself here, every other one exactly as before.
//
// WRAPPED BY REASSIGNMENT (each captures the previous binding and passes explicit arguments):
//   INSTANCES.enter / INSTANCES.leave, load, respawnPoint, generateWorld, render (a re-sync), drawBuilding,
//   tapLabelFor (names for the kingdom's tiles), tapPick (a tap on the middle of a fountain or tower walks to its rim).
//
// THE STORY, Lark's First Flight, opens once the Song of Above is sung (KINGDOM.queenFirst is the first line of 36's
//   Queen). Lark's first feather lives on the keyring; with it, either gold updraft stone opens her flight panel
//   ('lark_flight': six places in the city, one column of 44 px buttons on a narrow screen).
//
// THE SKY CURTAIN: the camera stops at the edge of the whole map, not the edge of the city, so near Aerie's east and south
//   edges it would show what the core draws there by coordinate (Thistledown's villagers, the castle's towers). One item at
//   y 9.5e8 paints that with 36's sky. 45-progression's crossing posts and 54-graves' markers, which are drawn by overworld
//   coordinate inside the city's rectangle, skip instances (checked in K21b).
//
// ONLINE (docs/ONLINE.md): the map is a literal. Nothing here spawns a monster or moves anything shared: Aerie keeps
// its four sky sentinels. Walkers and fliers are placed from the wall clock (Date.now), so every client agrees
// without a message. The gates read PLAYERS.remote and never write it. Lark, her flight and the coin toss are per
// knight. No tile changes beyond the wisp, perch and snag behaviour 36 and 88 already had.
//
// State: quest.kingdom = { stage: 0..6 | 'done', wishes, seen } (saved with the quest; reset in HOOKS.newGame).
// Handle: window.KINGDOM (see the end of the file).
// ============================================================================
{
  const PLAN = window.AERIE_PLAN;
  const W = PLAN.W, H = PLAN.H, SP = PLAN.SPOTS;
  const inside = () => window.__instance === 'aerie';

  // =========================================================================
  // 1. tiles (twelve, 208 -> 220; the ceiling is 255)
  // =========================================================================
  const PAVE = addTile('KING_PAVE', { tex: 'floor', mini: '#f4efe2' });
  const BRIDGE = addTile('KING_BRIDGE', { tex: 'plank', mini: '#b08a55' });
  const LAWN = addTile('KING_LAWN', { tex: 'grass', mini: '#8fce6a' });            // not T.GRASS: a hoe cannot till it
  const BLOOM = addTile('KING_BLOOM', { tex: 'grass', mini: '#e58fb4' });
  // a push tile, like a door: knights and people walk through it, monsters never do (the portcullis is drawn, and lifts)
  const GATE = addTile('KING_GATE', { push: true, tex: 'cobble', mini: '#f5c542' });
  const WALL = addTile('KING_WALL', { solid: true, tex: 'cobble', mini: '#c9d3e2' }); // never T.CWALL (57-townwall learned this)
  const TOWER = addTile('KING_TOWER', { solid: true, tex: 'cobble', mini: '#9fb3d0' });
  const SPIRE = addTile('KING_SPIRE', { solid: true, tex: 'cobble', mini: '#3b5ba8' });
  const FOUNTAIN = addTile('KING_FOUNTAIN', { solid: true, tex: 'water', mini: '#2f8fd8' });
  const POND = addTile('KING_POND', { solid: true, tex: 'water', mini: '#4aa3df' });
  const GARDEN = addTile('KING_GARDEN', { solid: true, tex: 'grass', mini: '#3f8a3a' });
  const PROP = addTile('KING_PROP', { solid: true, tex: 'floor', mini: '#ffd166' });
  const TILES = { PAVE, BRIDGE, LAWN, BLOOM, GATE, WALL, TOWER, SPIRE, FOUNTAIN, POND, GARDEN, PROP };
  const MAX_TILE = Math.max(...Object.values(T));
  if (MAX_TILE > 255) console.error('91-cloudkingdom: tile id ' + MAX_TILE + ' does not fit the map (Uint8Array)');
  // a tap on any of these walks up to it and uses it (17-tap); the gates are walked through, so a tap on one is a walk
  if (typeof INTERESTING_TILES !== 'undefined') for (const t of [FOUNTAIN, POND, GARDEN, PROP, SPIRE, TOWER, WALL]) INTERESTING_TILES.add(t);

  // =========================================================================
  // 2. paint: ROWS -> tile ids, cell for cell (no rnd, no Math.random), and what each garden or prop cell is
  // =========================================================================
  const KIND_NAMES = ['', 'hedge', 'tree', 'planter', 'bench', 'pew', 'lamp', 'throne', 'well'];
  const KIND_CODE = {}; KIND_NAMES.forEach((n, i) => { if (n) KIND_CODE[n] = i; });
  const KIND = new Uint8Array(W * H);
  const TID = {};
  let glyphsOk = true; const missingGlyphs = [];
  for (const c in PLAN.GLYPHS) { const id = T[PLAN.GLYPHS[c]]; if (typeof id !== 'number') { glyphsOk = false; missingGlyphs.push(c + '=' + PLAN.GLYPHS[c]); } else TID[c] = id; }
  if (!glyphsOk) console.error('91-cloudkingdom: no tile for ' + missingGlyphs.join(', '));
  function paint(tiles) {
    if (!glyphsOk) return tiles;
    for (let y = 0; y < H; y++) { const row = PLAN.ROWS[y]; for (let x = 0; x < W; x++) tiles[y * W + x] = TID[row[x]]; }
    return tiles;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = PLAN.ROWS[y][x], k = PLAN.KINDS[c];
    if (!k) continue;
    KIND[y * W + x] = KIND_CODE[c === 'b' && PLAN.inBuilding(x, y) ? 'pew' : k];
  }
  const kindAt = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? KIND_NAMES[KIND[y * W + x]] || null : null;
  const AER = window.INSTANCES && INSTANCES.get ? INSTANCES.get('aerie') : null;
  const PAINTED = !!(AER && glyphsOk && AER.w === W && AER.h === H);
  if (PAINTED) paint(AER.tiles);

  // =========================================================================
  // 3. the twelve buildings: mounted into BUILDINGS only while the knight is in Aerie
  // =========================================================================
  const AER_BUILDINGS = PLAN.BUILDINGS.map(b => {
    const o = { id: b.id, name: b.name, x: b.x, y: b.y, w: b.w, h: b.h, roof: b.roof, stone: b.fabric === 'stone', kingdom: true, f: [] };
    if (b.door !== undefined) o.door = b.door; else o.doorTop = b.doorTop;
    if (b.sign) o.sign = b.sign;
    return o;
  });
  const BY_ID = {}; for (const b of AER_BUILDINGS) BY_ID[b.id] = b;
  const isOurs = b => !!b && typeof b.id === 'string' && b.id.indexOf('aer_') === 0;
  function unmount() {
    let changed = false;
    for (let i = BUILDINGS.length - 1; i >= 0; i--) if (isOurs(BUILDINGS[i])) { BUILDINGS.splice(i, 1); changed = true; }
    if (changed) miniDirty = true;
    return changed;
  }
  function mountSync() {
    if (!inside()) return unmount();
    let changed = false;
    for (const b of AER_BUILDINGS) if (BUILDINGS.indexOf(b) < 0) { BUILDINGS.push(b); changed = true; }
    if (changed) miniDirty = true;
    return changed;
  }
  const mounted = () => BUILDINGS.filter(isOurs).length;
  // the ways in and out (see the header for why every one of them is here)
  if (window.INSTANCES) {
    const _enter = INSTANCES.enter, _leave = INSTANCES.leave;
    INSTANCES.enter = (id, step) => { unmount(); const r = _enter(id, step); mountSync(); if (r && id === 'aerie') { arrived(); wasInside = true; } return r; };
    INSTANCES.leave = () => { const was = inside(); const r = _leave(); mountSync(); if (was && !inside()) { departed(); wasInside = false; } return r; };
  }
  { const _load = load; load = function () { const r = _load(); mountSync(); larkFromStage(); return r; }; }
  { const _respawnPoint = respawnPoint; respawnPoint = function () { const r = _respawnPoint(); mountSync(); return r; }; }
  { const _generateWorld = generateWorld;
    generateWorld = function () { if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave(); unmount(); return _generateWorld(); }; }
  { const _render = render; render = function () { mountSync(); return _render(); }; }
  HOOKS.update.unshift(() => { mountSync(); });

  // =========================================================================
  // 4. state
  // =========================================================================
  QUEST_DEFS.lark = { name: "Lark's First Flight" };
  const freshK = () => ({ stage: 0, wishes: 0, seen: {} });
  const Q = () => {
    let q = quest.kingdom; if (!q || typeof q !== 'object') q = quest.kingdom = freshK();
    if (q.stage === undefined) q.stage = 0;
    if (typeof q.wishes !== 'number') q.wishes = 0;
    if (!q.seen || typeof q.seen !== 'object') q.seen = {};
    return q;
  };
  const after = () => { const s = Q().stage; return s === 6 || s === 'done'; };
  const midQuest = () => { const s = Q().stage; return typeof s === 'number' && s >= 1 && s <= 6; };

  // =========================================================================
  // 5. people: eight who stand, Lark, four who walk the streets, three in the air
  // =========================================================================
  const PEOPLE = [
    { id: 'aldric', name: 'Captain Aldric', at: SP.aldric, wing: 1.1, look: { tunic: '#3b5ba8', hair: '#6a4a2a', helm: '#dfe6f0', shoulder: '#f5c542', spear: true, skin: '#f0d8c0' } },
    { id: 'tamsin', name: 'Tamsin the baker', at: SP.tamsin, wing: 0.95, look: { tunic: '#c9784a', hair: '#8a3a1e', woman: true, apron: true, shoulder: '#e9d8b8', skin: '#f2d6bf' } },
    { id: 'mossbeard', name: 'Mossbeard', at: SP.mossbeard, wing: 0.85, look: { tunic: '#4f7a3a', hair: '#7a8a5a', beard: true, shoulder: '#8a6a4a', tool: 'hoe', toolColor: '#9aa3b2', skin: '#e8c8a8' } },
    { id: 'aubade', name: 'Sister Aubade', at: SP.aubade, wing: 1.05, look: { tunic: '#f4f1ea', hair: '#d9d6cf', woman: true, shoulder: '#9fb8dc', skin: '#f0d8c0' } },
    { id: 'corvin', name: 'Guildmaster Corvin', at: SP.corvin, wing: 1.0, look: { tunic: '#2e3f66', hair: '#1f1f28', beard: true, shoulder: '#6f8fbf', skin: '#e8c8a8' } },
    { id: 'merriweather', name: 'Merriweather', at: SP.merriweather, wing: 0.95, look: { tunic: '#9a5a3a', hair: '#c9783a', apron: true, shoulder: '#d9b36a', skin: '#f2d0b5' } },
    { id: 'orla', name: 'Warden Orla', at: SP.orla, wing: 1.05, look: { tunic: '#c9d6ea', hair: '#e8d9a0', woman: true, helm: '#dfe6f0', spear: true, shoulder: '#9ab0d0', skin: '#f0d8c0' } },
    { id: 'brisk', name: 'Warden Brisk', at: SP.brisk, wing: 1.05, look: { tunic: '#c9d6ea', hair: '#5a3a1e', helm: '#dfe6f0', spear: true, shoulder: '#9ab0d0', skin: '#e8c0a0' } },
  ];
  for (const p of PEOPLE) { p.x = p.at[0]; p.y = p.at[1]; p.px = tc(p.x); p.py = tc(p.y); p.facing = { x: 0, y: 1 }; p.b = PLAN.inBuilding(p.x, p.y); }
  // Lark: where she stands depends on her story (the maze, then at the knight's heel, then the plaza). She is this
  // knight's own: online, every knight has their own Lark, in their own place in the story.
  const LARK = { id: 'lark', name: 'Lark', px: tc(SP.larkMaze[0]), py: tc(SP.larkMaze[1]), facing: { x: 0, y: 1 }, mode: 'maze', trail: [], bubble: null,
    n: 0, t0: 0, from: null, moving: false, walkT: 0, far: false, lastX: null, lastY: null };
  const LOOK_LARK = { tunic: '#7fb2e8', hair: '#f5d77a', woman: true, shoulder: '#f5c542', skin: '#f5dcc8' };
  const LARK_LOG = [];          // every line Lark says out loud while she walks (the checks read it)
  function larkFromStage() {
    const s = Q().stage;
    const put = p => { LARK.px = tc(p[0]); LARK.py = tc(p[1]); };
    LARK.trail.length = 0; LARK.bubble = null; LARK.moving = false; LARK.far = false; LARK.lastX = null; LARK.lastY = null;
    if (s === 6 || s === 'done') { LARK.mode = 'plaza'; put(SP.larkPlaza); }
    else if (s === 5) { LARK.mode = 'wait'; put(SP.larkWait); }
    else { LARK.mode = 'maze'; put(SP.larkMaze); }
  }
  const larkStands = () => ['maze', 'follow', 'wait', 'rail', 'plaza'].includes(LARK.mode);
  // a line said on the move: a bubble over her head (it stays long enough to read), a float, and the Said log
  function larkSay(text) {
    LARK.bubble = { text, t: 4.2 }; LARK_LOG.push(text);
    floatText(LARK.px, LARK.py - 46, text, '#ffe9a8', 13);
    if (typeof dialogLog !== 'undefined') { dialogLog.push({ text, who: 'Lark', at: time }); while (dialogLog.length > 30) dialogLog.shift(); }
  }

  // the walkers and fliers: pure functions of the wall clock
  const CLOCK = { fixed: null };
  const wallMs = () => CLOCK.fixed !== null ? CLOCK.fixed : Date.now();
  const routeLen = r => { if (r.len !== undefined) return r.len; let L = 0; for (let i = 0; i < r.path.length - 1; i++) L += Math.hypot(r.path[i + 1][0] - r.path[i][0], r.path[i + 1][1] - r.path[i][1]); r.len = L; return L; };
  function routeAt(r, ms) {
    const L = routeLen(r); if (!(L > 0)) return { x: r.path[0][0], y: r.path[0][1], dx: 0, dy: 1 };
    const travel = (ms / 1000) * r.speed;
    let s, back = false;
    if (r.loop) s = ((travel + r.phase * L) % L + L) % L;
    else { const u = ((travel + r.phase * 2 * L) % (2 * L) + 2 * L) % (2 * L); if (u > L) { s = 2 * L - u; back = true; } else s = u; }
    for (let i = 0; i < r.path.length - 1; i++) {
      const [ax, ay] = r.path[i], [bx, by] = r.path[i + 1], d = Math.hypot(bx - ax, by - ay);
      if (s <= d || i === r.path.length - 2) { const k = d > 0 ? Math.min(1, s / d) : 0; const dx = (bx - ax) / (d || 1), dy = (by - ay) / (d || 1); return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, dx: back ? -dx : dx, dy: back ? -dy : dy }; }
      s -= d;
    }
    const e = r.path[r.path.length - 1]; return { x: e[0], y: e[1], dx: 0, dy: 1 };
  }
  const walkerAt = (i, ms) => routeAt(PLAN.WALKERS[i], ms);
  const flierAt = (i, ms) => routeAt(PLAN.FLIERS[i], ms);
  const WALKERS = PLAN.WALKERS.map((w, i) => ({ id: w.id, name: w.name, i, child: !!w.child, px: 0, py: 0, facing: { x: 0, y: 1 }, walkT: 0, moving: true,
    look: w.id === 'bellweather' ? { tunic: '#6a5a8a', hair: '#bfbfbf', beard: true, shoulder: '#f5c542', tool: 'hoe', toolColor: '#f5c542', skin: '#f0d8c0' }
      : w.id === 'brannoc' ? { tunic: '#7a5a3a', hair: '#3a2a1a', shoulder: '#c9a36a', skin: '#e0b894' }
      : w.id === 'fen' ? { tunic: '#58a6ff', hair: '#7a4a2a', shoulder: '#f5c542', skin: '#f2d6bf' }
      : { tunic: '#ff9ec8', hair: '#f0c060', woman: true, shoulder: '#ffffff', skin: '#f5dcc8' } }));
  const FLIERS = PLAN.FLIERS.map((f, i) => ({ id: f.id, name: f.name, i, px: 0, py: 0, dx: 0, dy: 1 }));
  function walkerCache() {
    const ms = wallMs();
    for (const w of WALKERS) { const p = walkerAt(w.i, ms); const nx = tc(p.x), ny = tc(p.y); if (Math.hypot(nx - w.px, ny - w.py) > 0.01) w.walkT += 0.18; w.px = nx; w.py = ny; w.facing = { x: p.dx, y: p.dy }; }
    for (const f of FLIERS) { const p = flierAt(f.i, ms); f.px = tc(p.x); f.py = tc(p.y); f.dx = p.dx; f.dy = p.dy; }
  }
  walkerCache();

  // who stands where the knight could talk to them (Lark only while she is standing somewhere)
  const standing = () => larkStands() ? PEOPLE.concat([LARK]) : PEOPLE;
  const ptile = () => ({ tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) });
  // no talking through walls: a person indoors answers only a knight in the same building, and one outdoors only a knight outdoors
  const sameRoom = (px, py) => { const a = ptile(); return buildingAt(a.tx, a.ty) === buildingAt(Math.floor(px / TILE), Math.floor(py / TILE)); };
  function facingScore(px, py, reach) {
    const d = dist(player.x, player.y, px, py); if (d > reach) return null;
    const dot = ((px - player.x) * player.facing.x + (py - player.y) * player.facing.y) / (d || 1);
    if (dot < 0.2 && d > 30) return null;
    return d;
  }
  // Lark in the maze answers only from the tile beside her in its middle (a hedge is a wall to her)
  const reachOf = p => (p === LARK && LARK.mode === 'maze') ? 72 : 96;
  function inFront() {
    if (!inside() || player.dead || player.mech) return null;
    let best = null, bd = 1e9;
    for (const p of standing()) { if (!sameRoom(p.px, p.py)) continue; const d = facingScore(p.px, p.py, reachOf(p)); if (d !== null && d < bd) { bd = d; best = p; } }
    return best;
  }
  function walkerInFront() {
    if (!inside() || player.dead || player.mech) return null;
    let best = null, bd = 1e9;
    for (const w of WALKERS) { if (!sameRoom(w.px, w.py)) continue; const d = facingScore(w.px, w.py, 96); if (d !== null && d < bd) { bd = d; best = w; } }
    return best;
  }

  // =========================================================================
  // 6. the story: Lark's First Flight
  //   Reason: Lark, the Queen's daughter, is ten today. Every child of Aerie steps off the Long Rail in the year they
  //   turn ten, and the wind catches them. She has hidden. Turn: the guards fly, so they look up; the knight walks, so
  //   he finds her on foot, in the hedge maze nobody with wings ever enters -- and the one who cannot fly gives the one
  //   who can her courage. Only in it: Lark herself, her flight, her first feather (the gold updraft stones) and 250
  //   coins. No xp. It opens only once the Song of Above is sung.
  // =========================================================================
  const faceTo = p => { const dx = p.px - player.x, dy = p.py - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; };
  const HINT = {
    1: 'Captain Aldric keeps the Great Gate, at the south end of the Kingsway. Ask him first.',
    2: 'The baker saw her? Then she walked. Lark never walks. Go and hear it from Tamsin, at the Cloud Oven by the market.',
    3: 'The garden. Of course. Mossbeard knows every hedge in it. Ask him.',
    4: 'The maze. Nobody in Aerie goes into the maze. We fly over it. Go in, knight. Find her.',
    5: 'You found her. Stay with her. Walk her to the Long Rail, through the Flight Gate at the north end of the Kingsway.',
  };
  // KINGDOM.queenFirst(e): the first line of 36-skycity's sky_queen branch. It speaks only once the Song of Above is
  // sung and only until Lark's story is done; it returns true only when the Queen spoke, so 36's own lines run otherwise.
  function queenFirst(e) {
    const sky = window.SKYCITY ? SKYCITY.SQ() : { stage: 'done' };
    if (sky.stage !== 'done') return false;
    const k = Q(), s = k.stage, who = e.name;
    if (s === 0) {
      k.stage = 1;
      say('Knight. You gave Aerie its Song back. Now I need to ask you for something only you can do.', who);
      say('Today is my daughter\'s first flight. Every child of Aerie steps off the Long Rail in the year they turn ten, and the wind catches them. Lark is ten today, and Lark is gone.', who);
      say('My guards have searched every roof and every spire. They fly, so they look up. You walk. Start at the Great Gate and ask Captain Aldric whether she went out.', who);
      levelBanner = { text: 'NEW QUEST', sub: "Lark's First Flight", t: 3.5 }; sfx('quest'); save();
      return true;
    }
    if (typeof s === 'number' && s >= 1 && s <= 5) { say(HINT[s], who); return true; }
    if (s === 6) {
      k.stage = 'done';
      giveOrDrop('coins', 250, player.x, player.y);
      say('I saw it from the top of the keep. A girl who would not fly and a knight who cannot, standing at the Long Rail together. And then she flew.', who);
      say('You gave my daughter the sky, and you did it without wings. Aerie will not forget it.', who);
      say('She gave you her first feather. Keep it. The gold updraft stones know it now. Stand on one and Lark will carry you anywhere in the city.', who);
      levelBanner = { text: 'LARK FLIES', sub: "Lark's First Flight", t: 3.5 }; sfx('quest');
      burst(player.x, player.y, '#f5c542', 40, 200); burst(player.x, player.y - 20, '#fff6d8', 24, 140); save();
      return true;
    }
    return false;
  }
  const LARK_AFTER = ['Watch this!', 'I did four loops round the Bell Spire today.', 'Mother says I am not allowed to fly through the chapel. I only did it once.'];
  function talk(p) {
    faceTo(p);
    const k = Q(), s = k.stage, who = p.name;
    switch (p.id) {
      case 'aldric':
        if (s === 1) {
          say('Lark? Not through my gate. Nobody has gone out this morning but the bread cart.', who);
          say('But here is a funny thing. The baker\'s boy says the princess bought a honey bun and walked off. Walked, knight. A girl with wings, walking.', who);
          say('Ask Tamsin at the Cloud Oven, in the Market Ward.', who);
          k.stage = 2; save();
        } else if (typeof s === 'number' && s >= 2 && s <= 5) say('Tamsin at the Cloud Oven. East of the plaza, on Forge Street.', who);
        else if (after()) say('I watched her fly from the top of the gatehouse. First flight, and she did three loops. Showing off. Good.', who);
        else say('The Great Gate of Aerie. We raise it for knights and lower it for storms. Mind the edge out there. It is a long way down.', who);
        return;
      case 'tamsin':
        if (s === 2) {
          say('The princess? She came in early and bought one honey bun. She paid, she said thank you, and she walked out. On her feet.', who);
          say('She went west along the Garden Walk, looking behind her. The long way round, so nobody would see her flying. Or see her not flying.', who);
          say('Mossbeard keeps the Queen\'s Garden. Ask him.', who);
          k.stage = 3; save(); return;
        }
        say(after() ? 'Lark came back for two more honey buns. Flying makes you hungry, she says.' : 'Warm bread, berry pie and fish pie. Everything up here is baked on cloud-fire, so nothing ever burns.', who);
        openPanel('shop', 'aerie_bakery');
        return;
      case 'mossbeard':
        if (s === 3) {
          say('Footprints, knight. In my lawn. Small ones, going into the hedges.', who);
          say('That is the maze. Nobody in Aerie goes into the maze. You just fly over it and wave at the middle.', who);
          say('Unless you do not want anybody to know you cannot fly yet. The way in is on the north side. The middle is further than it looks.', who);
          k.stage = 4; save();
        } else if (s === 4) say('The maze gate is on the north side. Keep one hand on the hedge and you will get there.', who);
        else if (after()) say('She flew over my maze this morning and dropped a honey bun wrapper in the middle. I will allow it.', who);
        else say('Mind the flower beds. The hedges bite if you cut the corners. Not really. But mind them.', who);
        return;
      case 'aubade':
        if (!k.seen.aubade) { k.seen.aubade = true; say('This is the Chapel of the Four Winds. The organ has no keys. The wind plays it when it wants to.', who); }
        else say('The four statues on the plaza are the four winds. The last one has no name. Nobody knows why.', who);
        return;
      case 'corvin':
        say('The Wingwrights carry every letter in the Fanglands that goes by air. Our fastest runner is Skyla, out on the Spire Run. Our slowest is me.', who);
        return;
      case 'merriweather':
        if (!k.seen.merriweather) { k.seen.merriweather = true; say('Welcome to the Tailwind. No beds, I am afraid. Nobody up here sleeps in a bed. We sleep in nests.', who); }
        else say('The soup is cloud soup. It is mostly steam.', who);
        return;
      case 'orla': say('The Queen will see you. Walk up the red carpet, and do not touch the throne.', who); return;
      case 'brisk': say('I have stood at this door for twenty years. Nobody has ever tried to touch the throne. Please do not be the first.', who); return;
      case 'lark': return talkLark();
    }
  }
  const onBalcony = () => { const a = ptile(), b = SP.balcony; return a.tx >= b.x0 && a.tx <= b.x1 && a.ty >= b.y0 && a.ty <= b.y1; };
  function startFollow() { LARK.mode = 'follow'; LARK.trail.length = 0; LARK.far = false; LARK.lastX = null; LARK.lastY = null; }
  function talkLark() {
    const k = Q(), s = k.stage, who = 'Lark';
    // before her mother has asked anybody (the Song is not sung yet), she is only a girl hiding in a maze
    if (s === 0) { say('Shh. I am not here. Please do not tell anyone you saw me.', who); return; }
    if (typeof s === 'number' && s >= 1 && s <= 4) {
      say('Go away. ... Oh. You are not a guard. You are the knight who came up through the storm. With no wings.', who);
      say('Everyone says the wind catches you when you step off the Long Rail. What if it does not catch me? What if I am the one it does not catch?', who);
      say('You came all the way up here without wings, and you did not turn back.', who);
      say('Will you walk with me to the Long Rail? If you are standing there, I think I can do it.', who);
      k.stage = 5; startFollow(); save();
      notify('Lark will follow you. The Long Rail is through the Flight Gate, north of the Kingsway.');
      levelBanner = { text: 'LARK FOLLOWS YOU', sub: 'Walk her to the Long Rail', t: 3.5 }; sfx('quest');
      return;
    }
    if (s === 5) {
      if (onBalcony()) {
        LARK.mode = 'rail';
        say('This is it. The Long Rail. Do not look down. I mean it. I am not looking down.', who);
        say('Count with me. Three...', who);
        sceneStart();
      } else {
        say('Stay close. The Long Rail is through the Flight Gate, at the north end of the Kingsway.', who);
        if (LARK.mode === 'wait') startFollow();
      }
      return;
    }
    // after her flight: one line a talk, in turn
    const line = LARK_AFTER[LARK.n % LARK_AFTER.length]; LARK.n++;
    say(line, who);
    if (line === 'Watch this!') { LARK.mode = 'hop'; LARK.t0 = time; }
  }
  const WALKER_LINES = {
    bellweather: `Every lamp in Aerie. All ${SP.lamps.length} of them. I light them at dusk, I put them out at dawn, and then I start again.`,
    fen: 'Tilly says the fountain has a fish in it. It does not. I looked.',
    tilly: 'There is a fish. It is a cloud fish. You can only see it when you are not looking.',
    brannoc: 'Flour up, bread down. Or bread up. I carry things. That is the job.',
  };
  function talkWalker(w) { faceTo(w); say(WALKER_LINES[w.id], w.name); }

  // ---------- the flight: 7.5 s, this knight's own, and he can move while it runs ----------
  const SCENE = { active: false, t0: 0, cues: {}, land: null };
  const sceneT = () => SCENE.active ? time - SCENE.t0 : 0;
  // a free spot beside the knight, where she comes down
  function landBeside() {
    for (const [dx, dy] of [[34, 0], [-34, 0], [0, 30], [0, -30]]) { const x = player.x + dx, y = player.y + dy; if (!SOLID.has(tileAt(Math.floor(x / TILE), Math.floor(y / TILE)))) return { x, y }; }
    return { x: player.x, y: player.y };
  }
  function sceneStart() { SCENE.active = true; SCENE.t0 = time; SCENE.cues = {}; SCENE.land = null; LARK.mode = 'scene'; LARK.bubble = null; LARK.moving = false; LARK.px = tc(SP.larkRail[0]); LARK.py = tc(SP.larkRail[1]); }
  function sceneTick() {
    if (!SCENE.active) return;
    const t = sceneT(), c = SCENE.cues, rx = tc(SP.larkRail[0]), ry = tc(SP.larkRail[1]);
    if (t >= 1.0 && !c.two) { c.two = true; floatText(rx, ry - 40, 'Two...', '#ffe9a8', 16); }
    if (t >= 2.0 && !c.one) { c.one = true; floatText(rx, ry - 40, 'One...', '#ffe9a8', 16); }
    if (t >= 2.6 && !c.step) { c.step = true; sfx('open'); }
    if (t >= 3.0 && !c.voice) { c.voice = true; say('She is gone over the rail.', 'The Voice'); }
    if (t >= 4.5 && !c.rise) { c.rise = true; sfx('levelup'); }
    if (t >= 6.9 && !SCENE.land) SCENE.land = landBeside();
    if (t >= 7.5) sceneFinish();
  }
  function sceneFinish() {
    if (!SCENE.active) return;
    SCENE.active = false;
    const k = Q(); k.stage = 6;
    const land = SCENE.land || landBeside();
    LARK.px = land.x; LARK.py = land.y;
    giveOrDrop('lark_feather', 1, player.x, player.y);
    levelBanner = { text: 'FIRST FEATHER', sub: 'Lark flew', t: 3.5 }; sfx('quest');
    if (inside()) burst(LARK.px, LARK.py, '#fffaf0', 30, 160);
    say('It caught me. It really caught me. The wind was there the whole time.', 'Lark');
    say('Here. This is my first feather. You get one when you fly for the first time, and you give it to someone who helped. Stand on a gold updraft stone with it, and I will come.', 'Lark');
    say('Now go and tell my mother. No, wait. I will tell her. I will fly and tell her!', 'Lark');
    // she flies off, and from now on she stands on the plaza
    if (inside()) { LARK.mode = 'flyoff'; LARK.t0 = time; LARK.from = { x: LARK.px, y: LARK.py }; }
    else { LARK.mode = 'plaza'; LARK.px = tc(SP.larkPlaza[0]); LARK.py = tc(SP.larkPlaza[1]); }
    save();
  }
  // where Lark is drawn during the flight (world px), how big, how clear, and whether she is in the air
  function scenePose(t) {
    const R = SP.larkRail, rail = [tc(R[0]), tc(R[1])];
    if (t < 2.6) return { x: rail[0], y: rail[1], s: 1, a: 1, air: false, wings: 0.9 };
    // over the rail (east of her is the rail and then nothing), and down below the edge
    if (t < 2.8) { const u = (t - 2.6) / 0.2; return { x: rail[0] + u * 1.2 * TILE, y: rail[1] - Math.sin(u * Math.PI) * 16, s: 1, a: 1, air: false, wings: 1.0 }; }
    if (t < 3.0) { const u = (t - 2.8) / 0.2; return { x: rail[0] + 1.2 * TILE + u * 10, y: rail[1] + u * u * 70, s: lerp(1, 0.4, u), a: 1 - u, air: true, wings: 0.5 }; }
    // a second and a half of wind, and nothing else
    if (t < 4.5) return { x: rail[0], y: rail[1], s: 0.4, a: 0, air: true, wings: 0.5, gone: true };
    // she comes up in a spiral past the balcony, wings wide, loops the Long Rail twice at air height, and lands beside the knight
    const cx = tc(48), cy = tc(3), sx = tc(55), sy = tc(8);
    const a0 = Math.atan2(sy - cy, sx - cx), r0 = Math.hypot(sx - cx, sy - cy), R3 = 3.2 * TILE;
    const u = Math.min(1, (t - 4.5) / 3.0);
    if (u < 0.82) {
      const v = u / 0.82, ang = a0 - v * Math.PI * 4, r = lerp(r0, R3, Math.min(1, v * 2.2));
      return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, s: lerp(0.5, 1.15, Math.min(1, v * 3)), a: Math.min(1, v * 5), air: true, wings: 1.5, loop: true };
    }
    const v = (u - 0.82) / 0.18, endA = a0 - Math.PI * 4, ex = cx + Math.cos(endA) * R3, ey = cy + Math.sin(endA) * R3;
    const land = SCENE.land || { x: player.x + 34, y: player.y };
    return { x: lerp(ex, land.x, v), y: lerp(ey, land.y, v), s: lerp(1.15, 1, v), a: 1, air: v < 1, wings: lerp(1.5, 0.9, v) };
  }

  // ---------- the quest log, the map, the new game ----------
  HOOKS.questText.lark = () => {
    const s = Q().stage;
    if (s === 'done') return "Done. Lark's first feather is on your keyring: stand on a gold updraft stone in Aerie and Lark will fly you anywhere in the city.";
    return {
      0: 'Not started. Queen Seraphel, in her keep in Aerie, will ask for help once the Song of Above is sung.',
      1: "Queen Seraphel's daughter Lark is ten today and should fly from the Long Rail, but she is hiding. Ask Captain Aldric at the Great Gate whether she went out.",
      2: 'Aldric says Lark bought a honey bun and walked off. Ask Tamsin at the Cloud Oven, in the Market Ward.',
      3: 'Tamsin saw Lark walk west along the Garden Walk. Ask Mossbeard in the Queen\'s Garden.',
      4: 'Mossbeard found small footprints going into the hedge maze in the Queen\'s Garden. The way in is on the north side. Find Lark in the middle.',
      5: 'Walk Lark to the Long Rail: through the Flight Gate at the north end of the Kingsway and over the bridge. Stand with her and talk to her.',
      6: 'Lark flew. Go back to Queen Seraphel in the keep.',
    }[s] || 'Done.';
  };
  HOOKS.activeQuests.push(() => midQuest() ? ['lark'] : []);
  const TARGETS = [null, [SP.aldric, 'Captain Aldric, the Great Gate'], [SP.tamsin, 'Tamsin, the Cloud Oven'], [SP.mossbeard, "Mossbeard, the Queen's Garden"], [SP.mazeGate, 'The maze gate'], [SP.railSpot, 'The Long Rail'], [SP.seraphel, 'Queen Seraphel, the keep']];
  HOOKS.mapTarget.push(() => {
    if (!midQuest()) return null;
    const s = Q().stage;
    if (inside()) { const [p, label] = TARGETS[s]; return { x: p[0], y: p[1], label, id: 'lark' }; }
    return { x: 62, y: 6, label: "Aerie: Lark's First Flight", id: 'lark' };
  });

  // =========================================================================
  // 7. what E (or a tap) on the kingdom's things says
  // =========================================================================
  const LAMPS_N = SP.lamps.length;
  const KIND_LINE = {
    hedge: ['A hedge', 'A hedge, clipped square. Mossbeard\'s work.'],
    tree: ['A cloudblossom tree', 'A cloudblossom tree. When its petals fall, they float up.'],
    planter: ['A planter', 'A stone planter full of flowers. Somebody waters these every morning.'],
    bench: ['A bench', 'A white stone bench, warm from the sun. The city hums around you.'],
    pew: ['A pew', 'A chapel pew. It creaks when the wind plays the organ.'],
    lamp: ['A sky lamp', `A sky lamp: cloud-fire in glass. Bellweather lights all ${LAMPS_N} of them every evening.`],
    throne: ['The Sky Throne', 'The Sky Throne. The Queen stands in front of it to talk to people. She says a throne is for feasts.'],
    well: ['The Wishing Well', 'The Wishing Well. It goes all the way down through the cloud. Nobody has ever heard a coin land.'],
  };
  const TAP_KIND = { hedge: 'Hedge', tree: 'Tree', planter: 'Planter', bench: 'Bench', pew: 'Pew', lamp: 'Lamp', throne: 'Throne', well: 'Well' };
  const FOUNTAINS = SP.fountains.map(f => Object.assign({}, f, f.id === 'royal'
    ? { name: 'The Royal Fountain', line: 'The Royal Fountain. The water falls up as much as it falls down.' }
    : { name: 'The Market Fountain', line: 'The Market Fountain. The statue is the first wingwright, holding the first letter.' }));
  const fountainAt = (x, y) => FOUNTAINS.find(f => x >= f.x0 && x <= f.x1 && y >= f.y0 && y <= f.y1) || null;
  const SPIRES = PLAN.SPIRE_NAMES;
  const spireAt = (x, y) => SPIRES.find(s => s.x === x && s.y === y) || null;
  const GATES = PLAN.GATES;
  const gateAt = (x, y) => GATES.find(g => g.cells.some(([cx, cy]) => cx === x && cy === y)) || null;
  const BRIDGE_LINE = 'A bridge over open sky. Do not look down. Or do. It is very pretty.';
  const TOWER_LINE = 'A wall tower. The pennant on top shows the winged folk which way the wind blows.';
  const WALL_LINE = 'The city wall. White stone, gold on top. It keeps the storms out and the children in.';
  const POND_LINE = 'The Mirror Pond. The fish are the colour of the sky, so you only see them when they move.';
  const ROYAL = PLAN.ROYAL;
  const royalAt = (x, y) => ROYAL.findIndex(r => r.t[0] === x && r.t[1] === y);
  function toss(f) {
    if (coins() >= 1) {
      payCoins(1); sfx('coins'); Q().wishes++;
      say(`You toss 1 coin in and make a wish. You have ${coins()} coins left.`, f.name);
      burst(tc((f.x0 + f.x1) / 2), tc((f.y0 + f.y1) / 2) - 20, '#f5c542', 10, 70);
    } else say('You have no coin to toss. The fountain does not mind.', f.name);
  }
  // the gold updraft stones: with Lark's first feather either one opens her flight panel; without it they will not lift you
  const DESTS = [
    { id: 'landing', name: 'The Wind Landing', ward: 'The Wind Landing', x: 48, y: 70 },
    { id: 'plaza', name: 'The Royal Plaza', ward: 'The Royal Plaza', x: 41, y: 45 },
    { id: 'market', name: 'The Market Square', ward: 'The Market Ward', x: 70, y: 43 },
    { id: 'garden', name: "The Queen's Garden", ward: "The Queen's Garden", x: 30, y: 18 },
    { id: 'rail', name: 'The Long Rail', ward: 'The Long Rail', x: 48, y: 2 },
    { id: 'crown', name: 'The Crown', ward: 'The Crown', x: 95, y: 19 },
  ];
  const REFUSE_LINE = 'The updraft is edged in gold. It will only lift someone the royal family trusts.';
  const FLIGHT = { from: null, to: null, t0: -99 };
  function useRoyal() {
    if (!countItem('lark_feather')) { say(REFUSE_LINE, 'The gold updraft'); return; }
    openPanel('lark_flight');
  }
  function flyTo(d) {
    closePanel();
    if (!inside()) return false;
    const from = { x: player.x, y: player.y };
    burst(player.x, player.y, '#ffffff', 26, 200); sfx('levelup');
    const s = safeSpot(tc(d.x), tc(d.y), player.r, 'player') || { x: tc(d.x), y: tc(d.y) };
    player.x = s.x; player.y = s.y; player.action = null; player.moving = false;
    if (typeof tapCancel === 'function') tapCancel('manual');
    burst(player.x, player.y, '#ffffff', 22, 150);
    FLIGHT.from = from; FLIGHT.to = { x: player.x, y: player.y }; FLIGHT.t0 = time;
    notify(`Lark swoops down and carries you to ${d.name}.`);
    return true;
  }
  HOOKS.panel.lark_flight = (g, narrow) => {
    const cols = narrow ? 1 : 2, BH = 44, GAP = 8, rows = Math.ceil(DESTS.length / cols);
    const { px, py, w } = panelBox(g, narrow ? 320 : 540, 76 + rows * (BH + GAP) + BH + 22, 'Where to, knight?', 'Pick a place. Lark will fly you there.');
    const bw = (w - 36 - (cols - 1) * GAP) / cols;
    DESTS.forEach((d, i) => { const c = i % cols, r = Math.floor(i / cols); button(g, px + 18 + c * (bw + GAP), py + 64 + r * (BH + GAP), bw, BH, d.name, () => flyTo(d), '#238636'); });
    button(g, px + 18, py + 70 + rows * (BH + GAP), w - 36, BH, 'Close', closePanel, '#21262d');
  };
  // the line a tile of ours says, and the name it goes under (the same for E and a tap)
  function lineFor(t, x, y) {
    if (t === FOUNTAIN) { const f = fountainAt(x, y); return f ? [f.name, f.line, f] : null; }
    if (t === POND) return ['The Mirror Pond', POND_LINE];
    if (t === GARDEN || t === PROP) { const k = kindAt(x, y); return k && KIND_LINE[k] ? [KIND_LINE[k][0], KIND_LINE[k][1]] : null; }
    if (t === SPIRE) { const s = spireAt(x, y); return s ? [s.name, s.line] : null; }
    if (t === TOWER) return ['A wall tower', TOWER_LINE];
    if (t === WALL) return ['The city wall', WALL_LINE];
    if (t === GATE) { const g = gateAt(x, y); return g ? [g.name, g.line] : null; }
    if (t === BRIDGE) return ['A bridge', BRIDGE_LINE];
    return null;
  }
  // E: a standing person or Lark first (unshifted, ahead of every other feature's E; false unless one of ours is in front) ...
  HOOKS.use.unshift(() => { const p = inFront(); if (!p) return false; talk(p); return true; });
  // ... then the kingdom's own tiles and the gold updraft stones (pushed: 36 and 88 have had their turn, and 88's
  // rideDraft answers false for a stone that is not one of its six) ...
  HOOKS.use.push((t, tx, ty) => {
    if (!inside()) return false;
    if (t === T.UPDRAFT) { if (royalAt(tx, ty) >= 0) { useRoyal(); return true; } return false; }
    const l = lineFor(t, tx, ty); if (!l) return false;
    say(l[1], l[0]);
    if (t === FOUNTAIN && l[2]) toss(l[2]);
    return true;
  });
  // ... and last of all, someone walking by
  HOOKS.use.push(() => { const w = walkerInFront(); if (!w) return false; talkWalker(w); return true; });

  // a tap names the thing the way E does (17-tap's own names read 'King garden' and 'King prop' otherwise)
  { const _tapLabelFor = tapLabelFor;
    tapLabelFor = function (p) {
      if (p && inside() && (p.kind === 'use' || p.kind === 'walk' || p.kind === 'wall')) {
        const t = p.t;
        if (t === GARDEN || t === PROP) { const k = kindAt(p.tx, p.ty); if (k) return TAP_KIND[k]; }
        if (t === FOUNTAIN) { const f = fountainAt(p.tx, p.ty); if (f) return f.name.replace(/^The /, ''); }
        if (t === SPIRE) { const s = spireAt(p.tx, p.ty); if (s) return s.name.replace(/^The /, ''); }
        if (t === GATE) { const g = gateAt(p.tx, p.ty); if (g) return g.name.replace(/^The /, ''); }
        const plain = { [PAVE]: 'Paving', [BRIDGE]: 'Bridge', [LAWN]: 'Lawn', [BLOOM]: 'Flower bed', [WALL]: 'City wall', [TOWER]: 'Wall tower', [POND]: 'Mirror Pond' }[t];
        if (plain) return plain;
        if (t === T.UPDRAFT && royalAt(p.tx, p.ty) >= 0) return 'Royal updraft';
      }
      return _tapLabelFor(p);
    };
  }
  // a tap on the middle of a fountain, the pond or a tower (no side a knight can stand at) walks to the nearest rim tile
  { const _tapPick = tapPick;
    tapPick = function (sx, sy) {
      const p = _tapPick(sx, sy);
      if (!p || !inside() || p.kind !== 'use' || ![FOUNTAIN, POND, TOWER].includes(p.t)) return p;
      const open = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !SOLID.has(tileAt(x + dx, y + dy)));
      if (open(p.tx, p.ty)) return p;
      let best = null, bd = 1e9;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = p.tx + dx, y = p.ty + dy; if (tileAt(x, y) !== p.t || !open(x, y)) continue;
        const d = dist(tc(x), tc(y), player.x, player.y); if (d < bd) { bd = d; best = [x, y]; }
      }
      return best ? Object.assign({}, p, { tx: best[0], ty: best[1] }) : p;
    };
  }
  TAP_PEOPLE.push(() => {
    if (!inside()) return [];
    const out = standing().map(p => ({ x: p.px, y: p.py, r: 13, id: p.id, name: p.name, talk: () => talk(p) }));
    for (const w of WALKERS) out.push({ x: w.px, y: w.py, r: 13, id: w.id, name: w.name, talk: () => talkWalker(w) });
    return out;
  });

  // =========================================================================
  // 8. every tick: the wards, the gates, Lark, the walkers
  // =========================================================================
  const LIFT = {}, RISING = {}; for (const g of GATES) { LIFT[g.id] = 0; RISING[g.id] = false; }
  const LIFT_RATE = 3;        // a gate goes from down to up (or back) in a third of a second
  // any knight on this map within 2.5 tiles of the gate: this one, or a friend (73-players; read only, never written)
  function knightsNear(g) {
    const near = (x, y) => g.cells.some(([cx, cy]) => dist(x, y, tc(cx), tc(cy)) <= 2.5 * TILE);
    if (!player.dead && near(player.x, player.y)) return true;
    if (window.PLAYERS && PLAYERS.remote) for (const n in PLAYERS.remote) { const e = PLAYERS.remote[n]; if (e && e.map === 'aerie' && !e.dead && typeof e.x === 'number' && near(e.x, e.y)) return true; }
    return false;
  }
  function gatesTick(dt) {
    for (const g of GATES) {
      const up = knightsNear(g), was = LIFT[g.id], step = LIFT_RATE * dt;
      LIFT[g.id] = up ? Math.min(1, was + step) : Math.max(0, was - step);
      // one creak of the chains per lift, when this knight is near enough to hear it
      if (up && !RISING[g.id] && g.cells.some(([cx, cy]) => dist(player.x, player.y, tc(cx), tc(cy)) <= 6 * TILE)) sfx('open');
      RISING[g.id] = up;
    }
  }
  const WARD = { name: null, shown: null, since: -1e9 };
  function arrived() {
    player.facing = { x: 0, y: -1 };
    const a = ptile(), w = PLAN.wardAt(a.tx, a.ty);
    WARD.name = w ? w.name : null; WARD.shown = WARD.name; WARD.since = time;
    for (const g of GATES) { LIFT[g.id] = 0; RISING[g.id] = false; }
    larkFromStage();
    walkerCache();
  }
  function departed() {
    const k = Q();
    if (SCENE.active) sceneFinish();
    if (k.stage === 5 && (LARK.mode === 'follow' || LARK.mode === 'rail')) say('I will wait inside the Flight Gate. Come back?', 'Lark');
    larkFromStage();
  }
  function wardsTick() {
    const a = ptile(), w = PLAN.wardAt(a.tx, a.ty), name = w ? w.name : null;
    WARD.name = name;
    // a ward's banner shows on the way into it, never in the first 3.2 s (the AERIE banner has those), never twice running
    if (w && name !== WARD.shown && time - WARD.since >= 3.2) { WARD.shown = name; areaBanner = { name: w.name, sub: w.sub, t: 2.4 }; }
  }
  // what Lark says on the way, once each, the first time she reaches the place (the order they are checked in)
  const WALK_LINES = [
    { id: 'maze', line: 'I have never been inside the maze before today. From up there it looks easy.', on: (x, y) => Math.abs(x - SP.mazeGate[0]) <= 1 && Math.abs(y - SP.mazeGate[1]) <= 1 },
    { id: 'pond', line: 'The Mirror Pond. When you fly over it you see yourself flying. I have never seen that.', on: (x, y) => { const p = SP.pond; return x >= p.x0 - 3 && x <= p.x1 + 3 && y >= p.y0 - 3 && y <= p.y1 + 3; } },
    { id: 'kingsway', line: 'Everybody is looking up for me. Nobody is looking at the street.', on: (x, y) => x >= 47 && x <= 49 && y >= 12 && y <= 21 },
    { id: 'flightgate', line: 'The Flight Gate. On the other side there is only the Long Rail, and then sky.', on: (x, y) => Math.abs(x - 48) <= 2 && Math.abs(y - 11) <= 2 },
    { id: 'bridge', line: 'Rope bridges wobble. Nobody told me rope bridges wobble.', on: (x, y) => x >= 47 && x <= 49 && y >= 4 && y <= 6 },
  ];
  const HEEL = 1.3 * TILE, FAR = 12 * TILE, TRAIL_STEP = 6, TRAIL_MAX = 4000;
  // the knight's last tile touched an updraft stone (so a jump of more than two tiles was a ride, not a walk)
  const nearDraft = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(tx + dx, ty + dy) === T.UPDRAFT) return true; return false; };
  function stepToward(gx, gy, sp) {
    const d = dist(LARK.px, LARK.py, gx, gy); if (d <= 0.01) return 0;
    const m = Math.min(sp, d); LARK.px += (gx - LARK.px) / d * m; LARK.py += (gy - LARK.py) / d * m;
    LARK.facing = { x: (gx - LARK.px) / (d || 1), y: (gy - LARK.py) / (d || 1) };
    return m;
  }
  function followTick(dt) {
    const tr = LARK.trail;
    // a jump: an updraft (or anything else that moves him more than two tiles at once). She is not letting him fly first.
    if (LARK.lastX !== null && dist(LARK.lastX, LARK.lastY, player.x, player.y) > 2 * TILE) {
      if (nearDraft(LARK.lastX, LARK.lastY)) larkSay('Hey! No flying yet. That is my job.');
      const s = landBeside(); LARK.px = s.x; LARK.py = s.y; tr.length = 0; LARK.far = false;
      burst(LARK.px, LARK.py, '#fffaf0', 12, 90);
    }
    LARK.lastX = player.x; LARK.lastY = player.y;
    // his footsteps are her way
    const last = tr.length ? tr[tr.length - 1] : null;
    if (!last || dist(last.x, last.y, player.x, player.y) >= TRAIL_STEP) { tr.push({ x: player.x, y: player.y }); if (tr.length > TRAIL_MAX) tr.shift(); }
    // how far behind she is, measured along the way he came
    let behind = 0, qx = LARK.px, qy = LARK.py;
    for (const p of tr) { behind += dist(qx, qy, p.x, p.y); qx = p.x; qy = p.y; }
    behind += dist(qx, qy, player.x, player.y);
    const gap = dist(LARK.px, LARK.py, player.x, player.y);
    if (gap > FAR && !LARK.far) { LARK.far = true; larkSay('Wait for me! Walking is slow!'); }
    else if (LARK.far && gap < 4 * TILE) LARK.far = false;
    if (behind > HEEL + 2) {
      let step = Math.min(Math.max(player.speed || 175, 175) * (LARK.far ? 2.2 : 1.2) * dt, behind - HEEL);
      while (step > 0.01 && tr.length) {
        const p = tr[0], d = dist(LARK.px, LARK.py, p.x, p.y);
        if (d <= step) { step -= d; LARK.px = p.x; LARK.py = p.y; tr.shift(); }
        else { step -= stepToward(p.x, p.y, step); }
      }
      if (step > 0.01) stepToward(player.x, player.y, step);
      LARK.moving = true; LARK.walkT += dt * 9;
    } else LARK.facing = { x: Math.sign(player.x - LARK.px) || 0, y: Math.sign(player.y - LARK.py) || 1 };
  }
  function larkTick(dt) {
    if (LARK.bubble) { LARK.bubble.t -= dt; if (LARK.bubble.t <= 0) LARK.bubble = null; }
    const k = Q();
    LARK.moving = false;
    if (LARK.mode === 'wait') {
      // she waits inside the Flight Gate, and follows again once the knight is within 2 tiles
      if (k.stage === 5 && dist(player.x, player.y, LARK.px, LARK.py) <= 2 * TILE) startFollow();
      return;
    }
    if (LARK.mode === 'hop') { if (time - LARK.t0 > 1.6) LARK.mode = 'plaza'; return; }
    if (LARK.mode === 'flyoff') { if (time - LARK.t0 > 2.4) { LARK.mode = 'plaza'; LARK.px = tc(SP.larkPlaza[0]); LARK.py = tc(SP.larkPlaza[1]); } return; }
    if (LARK.mode === 'follow' || LARK.mode === 'rail') {
      if (k.stage !== 5) { larkFromStage(); return; }
      if (onBalcony()) LARK.mode = 'rail';
      else if (LARK.mode === 'rail' && dist(player.x, player.y, tc(SP.larkRail[0]), tc(SP.larkRail[1])) > 6 * TILE) startFollow();
      if (LARK.mode === 'rail') {
        // on the balcony she goes to the rail and waits for him there
        const gx = tc(SP.larkRail[0]), gy = tc(SP.larkRail[1]);
        if (stepToward(gx, gy, Math.max(player.speed || 175, 175) * 1.2 * dt) > 0.01) { LARK.moving = true; LARK.walkT += dt * 9; }
        else LARK.facing = { x: Math.sign(player.x - LARK.px) || 0, y: Math.sign(player.y - LARK.py) || 1 };
        LARK.lastX = player.x; LARK.lastY = player.y; LARK.trail.length = 0;
      } else followTick(dt);
      // the first time she reaches each place on the way, she says so (one line a tick at most)
      const lx = Math.floor(LARK.px / TILE), ly = Math.floor(LARK.py / TILE);
      for (const m of WALK_LINES) if (!k.seen[m.id] && m.on(lx, ly)) { k.seen[m.id] = true; larkSay(m.line); break; }
    }
  }
  let wasInside = false;
  HOOKS.update.push(dt => {
    const now = inside();
    if (now && !wasInside) { if (time - WARD.since > 0.5) arrived(); }
    if (!now && wasInside) departed();
    wasInside = now;
    if (now) {
      walkerCache();
      gatesTick(dt);
      wardsTick();
      larkTick(dt);
      sceneTick();
    }
    mountSync();
  });
  HOOKS.newGame.push(() => {
    quest.kingdom = freshK();
    SCENE.active = false; LARK.n = 0; LARK_LOG.length = 0;
    larkFromStage();
    for (const g of GATES) { LIFT[g.id] = 0; RISING[g.id] = false; }
    WARD.name = null; WARD.shown = null; WARD.since = -1e9; wasInside = false;
    mountSync();
  });

  // =========================================================================
  // 9. drawing
  //   Layers (y): the ground, one item per visible row, at -1e8 + ty*48 + 0.0005 (after 36's sky and cloud; 88 lays no
  //   deck where this file paints ground); the sky decor (cloud-tops in the moat and under the bridges, the plaza's
  //   retaining face) and the fliers' shadows after every ground row; walls, towers, spires, trees, lamps, fountains and
  //   people y-sorted at their base like everything else; the air (fliers, Lark flying) at 5e7; the sky curtain at 9.5e8
  //   (see drawCurtain); the use highlight at 1e9 + 5. Every item's draw takes no arguments.
  // =========================================================================
  const SS = 2;                                   // patterns and sprites are drawn at 2x, like the core's textures
  const hash = (x, y) => ((Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0) / 4294967296;
  const STATS = { frames: 0, curtain: 0, drawn: {}, gates: 0, fountains: 0, awnings: 0, banners: 0, pennants: 0, spires: 0, towers: 0, items: 0 };
  const CACHE = {};
  function sprite(key, w, h, ax, ay, fn) {
    let s = CACHE[key];
    if (!s) {
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * SS)); c.height = Math.max(1, Math.ceil(h * SS));
      const cg = c.getContext ? c.getContext('2d') : null;
      if (cg) { try { cg.scale(SS, SS); cg.translate(ax, ay); fn(cg); } catch (e) { } }
      s = CACHE[key] = { c, w, h, ax, ay };
    }
    return s;
  }
  const blit = (g, s, x, y) => g.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h);
  const hex2 = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const shade = (h, k) => { const [r, g2, b] = hex2(h); const f = v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return `rgb(${f(r)},${f(g2)},${f(b)})`; };
  // the knight behind something tall: draw it see-through so he never vanishes
  const knightBox = () => ({ x0: player.x - 14, y0: player.y - 34, x1: player.x + 14, y1: player.y + 14 });
  function behindAlpha(x0, y0, x1, y1, sortY) {
    if (player.dead || player.y + player.r >= sortY) return 1;
    const k = knightBox();
    return (k.x1 > x0 && k.x0 < x1 && k.y1 > y0 && k.y0 < y1) ? 0.45 : 1;
  }
  function label(g, text, x, y) {
    g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.strokeText(text, x, y); g.fillStyle = '#ffe9a8'; g.fillText(text, x, y);
  }
  // a small gold wing: the crest of Aerie, on banners, the Great Gate and the royal pennant
  function goldWing(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s / 10, s / 10);
    g.fillStyle = col || '#f5c542';
    for (let f = 0; f < 4; f++) { const a = -0.3 - f * 0.32, L = 11 - f * 1.8; g.beginPath(); g.moveTo(-3, 2); g.quadraticCurveTo(-3 + Math.cos(a) * L * 0.6, 2 + Math.sin(a) * L * 0.6 - 3, -3 + Math.cos(a) * L, 2 + Math.sin(a) * L); g.quadraticCurveTo(-3 + Math.cos(a) * L * 0.6 + 1, 2 + Math.sin(a) * L * 0.6 + 2, -3, 5); g.closePath(); g.fill(); }
    g.beginPath(); g.arc(-3, 3.5, 2.2, 0, 7); g.fill();
    g.restore();
  }

  // ---------- the ground: what each cell is painted with ----------
  const G_NONE = 0, G_PAVE = 1, G_PLAZA = 2, G_LAWN = 3, G_BLOOM = 4, G_MARBLE = 5, G_CWALL = 6, G_HWALL = 7, G_RUG = 8, G_DOOR = 9, G_BRIDGE = 10, G_CLOUD = 11, G_UNDER = 12;
  const PLAZA = { x0: 36, y0: 24, x1: 60, y1: 48 };
  const inPlaza = (x, y) => x >= PLAZA.x0 && x <= PLAZA.x1 && y >= PLAZA.y0 && y <= PLAZA.y1;
  const GROUND = new Uint8Array(W * H), VAR = new Uint8Array(W * H), BRIDGE_AT = new Int8Array(W * H).fill(-1);
  const codeFor = (c, x, y) => (c === '=' || c === 'G') ? (inPlaza(x, y) ? G_PLAZA : G_PAVE) : c === '"' ? G_LAWN : c === '*' ? G_BLOOM
    : (c === '_' || c === 'a' || c === 'q' || c === 'c') ? G_MARBLE : c === 'C' ? G_CWALL : c === 'H' ? G_HWALL : c === 'R' ? G_RUG : c === 'D' ? G_DOOR
    : c === '+' ? G_BRIDGE : c === ',' ? G_CLOUD : c === 'u' ? G_UNDER : G_NONE;
  const OUR_GROUND = '="*G_aqcCHRD+', OUR_PROPS = '#TSFohtpblYw', THEIR_PROPS = 'sknxr^UPOzfLNg';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = PLAN.ROWS[y][x], i = y * W + x; let code = G_NONE;
    VAR[i] = Math.floor(hash(x, y) * 3);
    if (OUR_GROUND.includes(c)) code = codeFor(c, x, y);
    else if (OUR_PROPS.includes(c)) code = codeFor(PLAN.groundAt(x, y), x, y);
    else if (THEIR_PROPS.includes(c)) { const gc = PLAN.groundAt(x, y); if (gc === '=' || gc === '"' || gc === '_') code = codeFor(gc, x, y); }
    GROUND[i] = code;
  }
  PLAN.BRIDGES.forEach((b, bi) => { for (const [x0, y0, x1, y1] of b.rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) BRIDGE_AT[y * W + x] = bi; });
  // which way you walk across each bridge (the planks and the rails run the other way)
  const BRIDGE_DIR = { moatN: 'ns', moatS: 'ns', moatW: 'ew', moatE: 'ew', crown: 'ew', lowStair: 'ns', rail: 'ns' };
  const bridgeDir = (bi, x) => { const b = PLAN.BRIDGES[bi]; return b.id === 'runners' ? (x >= 78 ? 'ew' : 'ns') : BRIDGE_DIR[b.id]; };
  const paintsGround = (x, y) => x >= 0 && y >= 0 && x < W && y < H && GROUND[y * W + x] !== G_NONE;
  const glyph = (x, y) => PLAN.at(x, y);
  // the step outside each door (the core's doorstep mat and lantern glow are redrawn on it, over the paving)
  const STEPS = {};
  for (const b of AER_BUILDINGS) { const [dx, dy] = PLAN.doorOf(b), up = b.doorTop !== undefined; STEPS[(dx) + ',' + (up ? dy - 1 : dy + 1)] = up; }

  // ---------- the patterns (48 x 48, cached at 2x) ----------
  function patPave(g, v) {
    const r = mulberry32(0x9a5e + v * 131);
    g.fillStyle = '#b9ab90'; g.fillRect(0, 0, 48, 48);
    for (let row = 0; row < 3; row++) {
      const off = ((row + v) % 2) ? 12 : 0, y = row * 16;
      for (let c = -1; c < 3; c++) {
        const x = c * 24 + off;
        g.fillStyle = ['#e4d9c3', '#ddd1b9', '#e8dfcb', '#d8cbb1', '#e1d6bf'][Math.floor(r() * 5)]; g.fillRect(x + 1, y + 1, 22, 14);
        g.fillStyle = 'rgba(255,250,235,0.55)'; g.fillRect(x + 1, y + 1, 22, 1.4);
        g.fillStyle = 'rgba(110,95,70,0.2)'; g.fillRect(x + 1, y + 13.4, 22, 1.6);
      }
    }
    for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(130,115,90,${(0.1 + r() * 0.12).toFixed(3)})`; g.fillRect(r() * 46, r() * 46, 1.3, 1.3); }
  }
  function patPlaza(g, v) {
    const r = mulberry32(0x71a2 + v * 57);
    g.fillStyle = '#c9a95a'; g.fillRect(0, 0, 48, 48);
    g.fillStyle = ['#ece4d3', '#e6ddca', '#eae1cf'][v]; g.fillRect(1.5, 1.5, 45, 45);
    g.strokeStyle = 'rgba(150,165,190,0.20)'; g.lineWidth = 0.8;
    for (let k = 0; k < 2; k++) { let x = r() * 48, y = r() * 48; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (r() - 0.3) * 16; y += (r() - 0.5) * 14; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(1, 1, 46, 1.5);
    g.fillStyle = 'rgba(120,110,80,0.10)'; g.fillRect(1, 45.5, 46, 1.5);
  }
  function patLawn(g, v) {
    const r = mulberry32(0x1a3 + v * 97);
    for (let b = 0; b < 4; b++) { g.fillStyle = b % 2 ? '#8acb66' : '#97d573'; g.fillRect(0, b * 12, 48, 12); }
    for (let i = 0; i < 28; i++) { const x = r() * 46, y = r() * 44; g.strokeStyle = r() < 0.5 ? 'rgba(55,115,40,0.35)' : 'rgba(200,245,160,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + (r() - 0.5) * 3, y); g.stroke(); }
    if (v === 2) for (let i = 0; i < 3; i++) { const x = 6 + r() * 36, y = 6 + r() * 36; g.fillStyle = '#ffffff'; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 1.1, 0, 7); g.fill(); } g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(x, y, 1, 0, 7); g.fill(); }
  }
  function patBloom(g, v) {
    const r = mulberry32(0xb100 + v * 71);
    g.fillStyle = '#7fb85a'; g.fillRect(0, 0, 48, 48);
    g.fillStyle = '#7a5a3a'; roundRect(g, 3, 3, 42, 42, 6); g.fill();
    g.fillStyle = '#5a8a36'; for (let i = 0; i < 16; i++) { g.beginPath(); g.ellipse(5 + r() * 38, 5 + r() * 38, 4.5, 2.5, r() * 3, 0, 7); g.fill(); }
    const cols = ['#ff8fb8', '#ffffff', '#ffd24a', '#8fc8ff', '#ff6f91', '#c9a0ff'];
    for (let i = 0; i < 13; i++) { const x = 8 + r() * 32, y = 8 + r() * 32, c = cols[Math.floor(r() * cols.length)]; g.fillStyle = c; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, 0, 7); g.fill(); } g.fillStyle = '#ffe066'; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill(); }
  }
  function patMarble(g, v) {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { g.fillStyle = (i + j + v) % 2 ? '#d5dde9' : '#eeebe4'; g.fillRect(i * 24, j * 24, 24, 24); }
    g.strokeStyle = 'rgba(214,190,120,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 24); g.lineTo(48, 24); g.moveTo(24, 0); g.lineTo(24, 48); g.stroke();
    g.strokeStyle = 'rgba(214,190,120,0.4)'; g.strokeRect(0.5, 0.5, 47, 47);
    g.strokeStyle = 'rgba(150,160,180,0.16)'; g.beginPath(); g.moveTo(4 + v * 6, 30); g.quadraticCurveTo(18, 22, 30, 34 - v * 4); g.stroke();
  }
  function patCwall(g, v) {
    g.fillStyle = '#b3a78f'; g.fillRect(0, 0, 48, 48);
    for (let r0 = 0; r0 < 3; r0++) for (let c = -1; c < 3; c++) { const off = r0 % 2 ? 12 : 0, x = c * 24 + off, y = r0 * 16; g.fillStyle = ['#e0d7c5', '#d8ceba', '#e5ddcd'][(r0 + c + v + 3) % 3]; g.fillRect(x + 1, y + 1, 22, 14); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x + 1, y + 1, 22, 1.5); }
    g.fillStyle = 'rgba(232,194,90,0.8)'; g.fillRect(0, 0, 48, 2);
  }
  function patHwall(g, v) {
    g.fillStyle = '#e8e1d2'; g.fillRect(0, 0, 48, 48);
    g.fillStyle = '#6f8fb8'; g.fillRect(0, 0, 48, 5); g.fillRect(0, 43, 48, 5); g.fillRect(0, 0, 5, 48); g.fillRect(43, 0, 5, 48);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, 48, 1.5);
  }
  function patRug(g, v) {
    patMarble(g, v);
    g.fillStyle = '#8e1c30'; g.fillRect(8, 0, 32, 48);
    g.fillStyle = '#b3243b'; g.fillRect(11, 0, 26, 48);
    g.fillStyle = '#e8c25a'; g.fillRect(8, 0, 3, 48); g.fillRect(37, 0, 3, 48);
    g.fillStyle = '#e8c25a'; for (let k = 0; k < 2; k++) { const cy = 12 + k * 24; g.beginPath(); g.moveTo(24, cy - 5); g.lineTo(29, cy); g.lineTo(24, cy + 5); g.lineTo(19, cy); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(11, 0, 8, 48);
  }
  function patCloud(g, v, low) {
    g.fillStyle = low ? '#c3d0e2' : '#eef3fa'; g.fillRect(0, 0, 48, 48);
    g.fillStyle = low ? 'rgba(206,220,238,0.85)' : 'rgba(255,255,255,0.85)';
    for (const [ox, oy, rr] of [[12 + v * 3, 14, 12], [30, 22 + v * 2, 14], [20, 34, 11], [38, 10, 8]]) { g.beginPath(); g.arc(ox, oy, rr, 0, 7); g.fill(); }
  }
  function patStoneDeck(g, dir, v) {
    g.fillStyle = '#a99c84'; g.fillRect(0, 0, 48, 48);
    const r = mulberry32(0x5b1d + v * 13 + (dir === 'ns' ? 0 : 7));
    for (let a = 0; a < 4; a++) for (let b = -1; b < 2; b++) {
      const off = a % 2 ? 12 : 0, p0 = b * 24 + off, q0 = a * 12;
      g.fillStyle = ['#d9cfbc', '#d2c7b2', '#ddd4c2'][Math.floor(r() * 3)];
      if (dir === 'ns') g.fillRect(q0 + 1, p0 + 1, 10, 22); else g.fillRect(p0 + 1, q0 + 1, 22, 10);
    }
  }
  function patRopeDeck(g, dir, v) {
    g.fillStyle = '#8fd0ff'; g.fillRect(0, 0, 48, 48);
    const cols = ['#b08a55', '#a57f4c', '#b8925c', '#9e7845'];
    for (let k = 0; k < 4; k++) {
      const c = cols[(k + v) % 4], j = (hash(k, v) - 0.5) * 2;
      g.fillStyle = c;
      if (dir === 'ns') { g.fillRect(4 + j, k * 12 + 1.5, 40, 9); g.fillStyle = 'rgba(255,240,210,0.3)'; g.fillRect(4 + j, k * 12 + 1.5, 40, 1.5); g.fillStyle = 'rgba(50,30,15,0.35)'; g.fillRect(4 + j, k * 12 + 9, 40, 1.5); }
      else { g.fillRect(k * 12 + 1.5, 4 + j, 9, 40); g.fillStyle = 'rgba(255,240,210,0.3)'; g.fillRect(k * 12 + 1.5, 4 + j, 1.5, 40); g.fillStyle = 'rgba(50,30,15,0.35)'; g.fillRect(k * 12 + 9, 4 + j, 1.5, 40); }
    }
  }
  const pat = (key, fn) => sprite('g:' + key, 48, 48, 0, 0, fn);
  function groundSprite(code, i, x) {
    const v = VAR[i];
    switch (code) {
      case G_PAVE: return pat('pave' + v, g => patPave(g, v));
      case G_PLAZA: return pat('plaza' + v, g => patPlaza(g, v));
      case G_LAWN: return pat('lawn' + v, g => patLawn(g, v));
      case G_BLOOM: return pat('bloom' + v, g => patBloom(g, v));
      case G_MARBLE: case G_DOOR: return pat('marble' + v, g => patMarble(g, v));
      case G_CWALL: return pat('cwall' + v, g => patCwall(g, v));
      case G_HWALL: return pat('hwall' + v, g => patHwall(g, v));
      case G_RUG: return pat('rug' + v, g => patRug(g, v));
      case G_CLOUD: return pat('cloud' + v, g => patCloud(g, v, false));
      case G_UNDER: return pat('under' + v, g => patCloud(g, v, true));
      case G_BRIDGE: { const bi = BRIDGE_AT[i], d = bi >= 0 ? bridgeDir(bi, x) : 'ns', stone = bi >= 0 && PLAN.BRIDGES[bi].kind === 'stone'; return stone ? pat('sdeck' + d + v, g => patStoneDeck(g, d, v)) : pat('rdeck' + d + v, g => patRopeDeck(g, d, v)); }
    }
    return null;
  }

  // ---------- two big inlays, painted once: the plaza's gold star and the Wind Landing's compass rose ----------
  const STAR = { x0: 44, y0: 40, w: 9, h: 9, cx: (48.5 - 44) * 48, cy: (44.5 - 40) * 48 };
  const ROSE = { x0: 45, y0: 68, w: 7, h: 4, cx: (48.5 - 45) * 48, cy: (70 - 68) * 48 };
  function starDecal() {
    return sprite('decal:star', STAR.w * 48, STAR.h * 48, 0, 0, g => {
      const cx = STAR.cx, cy = STAR.cy, pts = (R, r) => { const out = []; for (let k = 0; k < 16; k++) { const a = -Math.PI / 2 + k * Math.PI / 8, rr = k % 2 ? r : R; out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return out; };
      const poly = p => { g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
      poly(pts(192, 86)); g.fillStyle = 'rgba(232,194,90,0.85)'; g.fill(); g.strokeStyle = '#b8912a'; g.lineWidth = 2; g.stroke();
      poly(pts(150, 70)); g.fillStyle = 'rgba(127,166,214,0.9)'; g.fill(); g.strokeStyle = '#f5c542'; g.lineWidth = 1.5; g.stroke();
      poly(pts(118, 60)); g.fillStyle = 'rgba(250,248,242,0.95)'; g.fill();
      g.strokeStyle = '#e8c25a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 96, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(184,145,42,0.7)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, 102, 0, 7); g.stroke();
    });
  }
  function roseDecal() {
    return sprite('decal:rose', ROSE.w * 48, ROSE.h * 48, 0, 0, g => {
      const cx = ROSE.cx, cy = ROSE.cy, R = 84;
      g.strokeStyle = '#e8c25a'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R * 0.72, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(184,145,42,0.8)'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, R * 0.78, 0, 7); g.stroke();
      for (let k = 0; k < 8; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 4, long = k % 2 === 0, L = long ? R : R * 0.55, wd = long ? 14 : 9;
        const tx = cx + Math.cos(a) * L, ty = cy + Math.sin(a) * L, lx = cx + Math.cos(a - Math.PI / 2) * wd, ly = cy + Math.sin(a - Math.PI / 2) * wd, rx = cx + Math.cos(a + Math.PI / 2) * wd, ry = cy + Math.sin(a + Math.PI / 2) * wd;
        g.fillStyle = k === 0 ? '#5b8fd6' : long ? '#e8c25a' : '#f0dca0';
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(lx, ly); g.lineTo(cx, cy); g.closePath(); g.fill();
        g.fillStyle = k === 0 ? '#3b5ba8' : long ? '#b8912a' : '#d9c07a';
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(rx, ry); g.lineTo(cx, cy); g.closePath(); g.fill();
      }
      g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill(); g.strokeStyle = '#e8c25a'; g.lineWidth = 2; g.stroke();
      g.font = 'bold 15px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const [t, a] of [['N', -Math.PI / 2], ['E', 0], ['S', Math.PI / 2], ['W', Math.PI]]) {
        const d = t === 'N' || t === 'S' ? R * 0.6 : R * 1.12, x = cx + Math.cos(a) * d + (t === 'N' || t === 'S' ? 18 : 0), y = cy + Math.sin(a) * d * (t === 'N' || t === 'S' ? 1.0 : 1);
        g.lineWidth = 3; g.strokeStyle = 'rgba(90,70,20,0.55)'; g.strokeText(t, x, y); g.fillStyle = '#f5c542'; g.fillText(t, x, y);
      }
      g.textBaseline = 'alphabetic';
    });
  }
  const decalCell = (g, D, s, tx, ty, x, y) => { if (tx >= D.x0 && tx < D.x0 + D.w && ty >= D.y0 && ty < D.y0 + D.h) g.drawImage(s.c, (tx - D.x0) * 48 * SS, (ty - D.y0) * 48 * SS, 48 * SS, 48 * SS, x, y, 48, 48); };
  const isSky = (x, y) => glyph(x, y) === '~';
  const soft = c => c === '"' || c === '*' || c === ',' || c === 'u';

  // ---------- one row of the ground ----------
  function drawGroundRow(g, ty, x0, x1) {
    const star = ty >= STAR.y0 && ty < STAR.y0 + STAR.h ? starDecal() : null, rose = ty >= ROSE.y0 && ty < ROSE.y0 + ROSE.h ? roseDecal() : null;
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * W + tx, code = GROUND[i]; if (!code) continue;
      const x = tx * TILE, y = ty * TILE, s = groundSprite(code, i, tx);
      if (s) g.drawImage(s.c, x, y, TILE, TILE);
      if (code === G_PLAZA) {
        if (star) decalCell(g, STAR, star, tx, ty, x, y);
        // the border band, one tile in from the plaza's edge: gold, with a sky-blue line down its middle
        const bh = (ty === PLAZA.y0 + 1 || ty === PLAZA.y1 - 1) && tx >= PLAZA.x0 + 1 && tx <= PLAZA.x1 - 1, bv = (tx === PLAZA.x0 + 1 || tx === PLAZA.x1 - 1) && ty >= PLAZA.y0 + 1 && ty <= PLAZA.y1 - 1;
        if (bh) { g.fillStyle = '#e8c25a'; g.fillRect(x, y + 19, 48, 10); g.fillStyle = '#7fa6d6'; g.fillRect(x, y + 22.5, 48, 3); }
        if (bv) { g.fillStyle = '#e8c25a'; g.fillRect(x + 19, y, 10, 48); g.fillStyle = '#7fa6d6'; g.fillRect(x + 22.5, y, 3, 48); }
        // gold coping where the raised plaza meets the moat
        g.fillStyle = '#e8c25a';
        if (isSky(tx, ty - 1)) g.fillRect(x, y, 48, 4);
        if (isSky(tx, ty + 1)) g.fillRect(x, y + 44, 48, 4);
        if (isSky(tx - 1, ty)) g.fillRect(x, y, 4, 48);
        if (isSky(tx + 1, ty)) g.fillRect(x + 44, y, 4, 48);
      }
      if (code === G_PAVE && rose) decalCell(g, ROSE, rose, tx, ty, x, y);
      if (code === G_PAVE || code === G_PLAZA) {
        // a kerb where the paving meets a lawn, a flower bed or the cloud
        g.fillStyle = 'rgba(160,148,122,0.55)';
        if (soft(glyph(tx, ty - 1))) g.fillRect(x, y, 48, 2.5);
        if (soft(glyph(tx, ty + 1))) g.fillRect(x, y + 45.5, 48, 2.5);
        if (soft(glyph(tx - 1, ty))) g.fillRect(x, y, 2.5, 48);
        if (soft(glyph(tx + 1, ty))) g.fillRect(x + 45.5, y, 2.5, 48);
        // a stone lip where plain paving ends over open sky
        if (code === G_PAVE && isSky(tx, ty + 1)) { g.fillStyle = '#d6cebe'; g.fillRect(x, y + 42, 48, 6); g.fillStyle = '#e8c25a'; g.fillRect(x, y + 41, 48, 1.5); }
      }
      if (code === G_BRIDGE) drawBridgeRails(g, tx, ty, x, y);
      if (code === G_DOOR) { drawDoorProp(g, tx, ty, false); g.strokeStyle = '#e8c25a'; g.lineWidth = 2; g.strokeRect(x + 7, y + 1, 34, 46); }
      const st = STEPS[tx + ',' + ty]; if (st !== undefined) drawDoorstep(g, tx, ty, st, false);
    }
  }
  // the balustrade of a stone bridge (a gold rail on white posts) or the ropes of a rope one, on every side over open sky
  function drawBridgeRails(g, tx, ty, x, y) {
    const bi = BRIDGE_AT[ty * W + tx]; if (bi < 0) return;
    const stone = PLAN.BRIDGES[bi].kind === 'stone';
    const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => isSky(tx + dx, ty + dy));
    for (const [dx, dy] of sides) {
      const horiz = dy !== 0, ex = dx > 0 ? x + 42 : x, ey = dy > 0 ? y + 42 : y;
      if (stone) {
        g.fillStyle = '#f4f0e7'; for (let k = 0; k < 4; k++) { if (horiz) g.fillRect(x + 3 + k * 12, ey + 1, 5, 5); else g.fillRect(ex + 1, y + 3 + k * 12, 5, 5); }
        g.fillStyle = '#e8c25a'; if (horiz) g.fillRect(x, ey + (dy > 0 ? 2 : 0), 48, 3); else g.fillRect(ex + (dx > 0 ? 2 : 0), y, 3, 48);
        g.fillStyle = 'rgba(255,248,215,0.9)'; if (horiz) g.fillRect(x, ey + (dy > 0 ? 2 : 0), 48, 1); else g.fillRect(ex + (dx > 0 ? 2 : 0), y, 1, 48);
      } else {
        g.strokeStyle = '#e2d3a6'; g.lineWidth = 2.2; g.beginPath();
        if (horiz) { const yy = ey + (dy > 0 ? 4 : 2); g.moveTo(x, yy); g.quadraticCurveTo(x + 24, yy + 3, x + 48, yy); }
        else { const xx = ex + (dx > 0 ? 4 : 2); g.moveTo(xx, y); g.quadraticCurveTo(xx + 3, y + 24, xx, y + 48); }
        g.stroke();
        g.fillStyle = '#7a5a36'; if (horiz) { g.fillRect(x + 2, ey, 4, 6); g.fillRect(x + 42, ey, 4, 6); } else { g.fillRect(ex, y + 2, 6, 4); g.fillRect(ex, y + 42, 6, 4); }
      }
    }
  }

  // ---------- the sky decor: cloud-tops drifting in the moat and under the bridges, and the plaza standing up out of it ----------
  const DECOR = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (PLAN.ROWS[y][x] !== '~') continue;
    if (x >= 34 && x <= 62 && y >= 22 && y <= 50) { DECOR[y * W + x] = 1; continue; }
    for (const b of PLAN.BRIDGES) for (const [x0, y0, x1, y1] of b.rects) if (x >= x0 - 3 && x <= x1 + 3 && y >= y0 - 3 && y <= y1 + 3) DECOR[y * W + x] = 1;
  }
  function drawSkyDecor(g, x0, x1, y0, y1) {
    let any = false;
    g.save(); g.beginPath();
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (DECOR[ty * W + tx]) { g.rect(tx * TILE, ty * TILE, TILE, TILE); any = true; }
    if (!any) { g.restore(); return; }
    g.clip();
    // cloud-tops a long way below, drifting east
    for (let ty = y0 - 1; ty <= y1 + 1; ty++) for (let tx = x0 - 3; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const h = hash(tx * 3 + 11, ty * 7 + 5); if (h > 0.2) continue;
      const drift = (time * (5 + h * 20) + h * 300) % (TILE * 4), cx = tx * TILE + drift, cy = ty * TILE + 10 + h * 30;
      g.fillStyle = 'rgba(160,190,230,0.35)'; for (const [ox, oy, rr] of [[0, 6, 14], [16, 8, 12], [-14, 9, 10]]) { g.beginPath(); g.ellipse(cx + ox, cy + oy, rr * 1.3, rr * 0.7, 0, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.78)'; for (const [ox, oy, rr] of [[0, 0, 14], [16, 3, 11], [-14, 4, 10], [6, -6, 9]]) { g.beginPath(); g.arc(cx + ox, cy + oy, rr, 0, 7); g.fill(); }
    }
    // the plaza's retaining face on the moat side: white stone, gold coping, a shadow falling on the cloud below
    for (let tx = Math.max(x0, PLAZA.x0); tx <= Math.min(x1, PLAZA.x1); tx++) {
      const ty = PLAZA.y1 + 1; if (ty < y0 || ty > y1 || !isSky(tx, ty)) continue;
      const x = tx * TILE, y = ty * TILE;
      g.fillStyle = '#e3dccd'; g.fillRect(x, y, 48, 24);
      g.fillStyle = 'rgba(150,135,110,0.3)'; for (let r = 0; r < 2; r++) { g.fillRect(x, y + 11 + r * 12, 48, 1); for (let c = 0; c < 3; c++) g.fillRect(x + ((r + tx) % 2 ? 12 : 0) + c * 24, y + r * 12, 1, 11); }
      const sh = g.createLinearGradient(0, y + 24, 0, y + 44); sh.addColorStop(0, 'rgba(60,90,140,0.30)'); sh.addColorStop(1, 'rgba(60,90,140,0)'); g.fillStyle = sh; g.fillRect(x, y + 24, 48, 20);
    }
    for (let ty = Math.max(y0, PLAZA.y0); ty <= Math.min(y1, PLAZA.y1 + 1); ty++) for (const tx of [PLAZA.x0 - 1, PLAZA.x1 + 1]) {
      if (tx < x0 || tx > x1 || !isSky(tx, ty)) continue;
      const x = tx * TILE, y = ty * TILE, east = tx > PLAZA.x1;
      g.fillStyle = 'rgba(60,90,140,0.22)'; g.fillRect(east ? x : x + 40, y, 8, 48);
    }
    // stone bridges over sky: the face under an east-west span, and a shadow beside a north-south one
    for (const b of PLAN.BRIDGES) for (const [bx0, by0, bx1, by1] of b.rects) {
      const dir = b.id === 'runners' ? (bx0 >= 78 ? 'ew' : 'ns') : BRIDGE_DIR[b.id];
      if (dir === 'ew') for (let tx = bx0; tx <= bx1; tx++) {
        const ty = by1 + 1; if (tx < x0 || tx > x1 || ty < y0 || ty > y1 || !isSky(tx, ty)) continue;
        const x = tx * TILE, y = ty * TILE;
        if (b.kind === 'stone') { g.fillStyle = '#e3dccd'; g.fillRect(x, y, 48, 16); g.fillStyle = '#8fd0ff'; g.beginPath(); g.ellipse(x + 24, y + 16, 18, 10, 0, Math.PI, 0); g.fill(); g.fillStyle = '#e8c25a'; g.fillRect(x, y, 48, 2); }
        const sh = g.createLinearGradient(0, y + 12, 0, y + 40); sh.addColorStop(0, 'rgba(60,90,140,0.22)'); sh.addColorStop(1, 'rgba(60,90,140,0)'); g.fillStyle = sh; g.fillRect(x, y + 12, 48, 28);
      } else for (let ty = by0; ty <= by1; ty++) for (const tx of [bx0 - 1, bx1 + 1]) {
        if (tx < x0 || tx > x1 || ty < y0 || ty > y1 || !isSky(tx, ty)) continue;
        g.fillStyle = 'rgba(60,90,140,0.18)'; g.fillRect(tx * TILE + (tx > bx1 ? 0 : 36), ty * TILE + 8, 12, 48);
      }
    }
    g.restore();
  }

  // ---------- the curtain wall ----------
  const BANNERS = new Set(SP.banners.map(([x, y]) => x + ',' + y));
  const ARCH_STUBS = new Set(['46,61', '50,61']);            // the Great Gate's arch covers these two wall tiles
  const wallish = (x, y) => { const c = glyph(x, y); return c === '#' || c === 'T' || c === 'G'; };
  function drawBanner(g, cx, top, len, wd) {
    const sw = Math.sin(time * 1.7 + cx * 0.013) * 3;
    g.fillStyle = '#b8912a'; g.fillRect(cx - wd / 2 - 3, top - 2, wd + 6, 3);
    g.fillStyle = '#4f7fc8'; g.beginPath(); g.moveTo(cx - wd / 2, top); g.lineTo(cx + wd / 2, top); g.lineTo(cx + wd / 2 + sw, top + len); g.lineTo(cx + sw * 0.5, top + len - wd * 0.45); g.lineTo(cx - wd / 2 + sw, top + len); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(cx - wd / 2, top, wd * 0.3, len - 6);
    g.strokeStyle = '#f5c542'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - wd / 2, top); g.lineTo(cx - wd / 2 + sw, top + len); g.moveTo(cx + wd / 2, top); g.lineTo(cx + wd / 2 + sw, top + len); g.stroke();
    goldWing(g, cx + sw * 0.35 + 2, top + len * 0.38, wd * 0.62);
    STATS.banners++;
  }
  function drawWallH(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = 'rgba(40,60,100,0.15)'; g.fillRect(x, y + 48, 48, 9);
    // the face
    g.fillStyle = '#dad0bd'; g.fillRect(x, y + 14, 48, 34);
    g.fillStyle = 'rgba(145,130,105,0.28)';
    for (let r = 0; r < 3; r++) { const yy = y + 15 + r * 11; g.fillRect(x, yy + 10, 48, 1); const off = (r + tx) % 2 ? 12 : 0; for (let c = 0; c < 3; c++) g.fillRect(x + off + c * 24, yy, 1, 10); }
    const sh = g.createLinearGradient(0, y + 30, 0, y + 48); sh.addColorStop(0, 'rgba(60,80,120,0)'); sh.addColorStop(1, 'rgba(60,80,120,0.16)'); g.fillStyle = sh; g.fillRect(x, y + 30, 48, 18);
    // the walk, the gold string course, the merlons (world-aligned, so the whole wall lines up)
    g.fillStyle = '#eae3d5'; g.fillRect(x, y + 3, 48, 9);
    g.fillStyle = '#e8c25a'; g.fillRect(x, y + 12, 48, 3); g.fillStyle = '#fff0b0'; g.fillRect(x, y + 12, 48, 1);
    for (let k = 0; k < 4; k++) {
      if ((tx * 4 + k) % 2) continue;
      const mx = x + k * 12;
      g.fillStyle = '#e1d8c6'; g.fillRect(mx, y - 6, 12, 18);
      g.fillStyle = '#f0eadf'; g.fillRect(mx, y - 9, 12, 4);
      g.fillStyle = '#f5c542'; g.fillRect(mx, y - 10, 12, 2);
      g.fillStyle = 'rgba(60,80,120,0.12)'; g.fillRect(mx + 9, y - 6, 3, 18);
    }
    if (BANNERS.has(tx + ',' + ty)) drawBanner(g, x + 24, y + 16, 38, 16);
  }
  function drawWallV(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = 'rgba(40,60,100,0.14)'; g.fillRect(x + 44, y, 9, 48);
    g.fillStyle = '#d8cebb'; g.fillRect(x + 4, y, 40, 48);
    g.fillStyle = '#e9e2d4'; g.fillRect(x + 11, y, 26, 48);
    g.fillStyle = 'rgba(145,130,105,0.22)'; for (let r = 0; r < 4; r++) g.fillRect(x + 11, y + r * 12 + 11, 26, 1);
    for (let k = 0; k < 4; k++) {
      if ((ty * 4 + k) % 2) continue;
      const my = y + k * 12;
      for (const ex of [x + 4, x + 36]) { g.fillStyle = '#e1d8c6'; g.fillRect(ex, my - 6, 8, 12); g.fillStyle = '#f5c542'; g.fillRect(ex, my - 7, 8, 2); g.fillStyle = '#d8d0c0'; g.fillRect(ex, my + 6, 8, 4); }
    }
    if (!wallish(tx, ty + 1)) { g.fillStyle = '#e2dbcd'; g.fillRect(x + 4, y + 34, 40, 14); g.fillStyle = '#e8c25a'; g.fillRect(x + 4, y + 33, 40, 2); g.fillStyle = 'rgba(40,60,100,0.15)'; g.fillRect(x + 4, y + 48, 40, 8); }
  }

  // ---------- the towers: nineteen, each with a pennant ----------
  // the two towers either side of the Crown Gate are squat gate-turrets, so the gate between them shows
  const SQUAT = new Set(['79,14', '79,20']);
  const TOWERS = SP.towers.map(([x, y]) => ({ x, y, kind: SQUAT.has(x + ',' + y) ? 'squat' : 'round' })).concat(SP.gatehouse.map(o => ({ x: o.x, y: o.y, kind: 'gate', x0: o.x0, x1: o.x1, y0: o.y0, y1: o.y1 })));
  function drawPennant(g, x, y, len, col) {
    const t = time * 3 + x * 0.02, w1 = Math.sin(t) * 4, w2 = Math.sin(t + 1.3) * 5;
    g.fillStyle = col || '#4f7fc8';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len * 0.5, y - 3 + w1, x + len, y + 3 + w2); g.quadraticCurveTo(x + len * 0.5, y + 7 + w1, x, y + 9); g.closePath(); g.fill();
    g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(x + len * 0.72, y + 1.5 + w1 * 0.8); g.lineTo(x + len, y + 3 + w2); g.lineTo(x + len * 0.72, y + 7 + w1 * 0.8); g.closePath(); g.fill();
    STATS.pennants++;
  }
  // a round tower: base ellipse at (0, 18), 112 px of white stone, a crenellated rim, a blue cone, a gold finial
  function paintRoundTower(g, TOP, CH) {
    const RX = 62, BY = 18;
    g.fillStyle = 'rgba(40,60,100,0.2)'; g.beginPath(); g.ellipse(8, BY + 6, RX + 10, 24, 0, 0, 7); g.fill();
    const body = g.createLinearGradient(-RX, 0, RX, 0);
    body.addColorStop(0, '#b9ae98'); body.addColorStop(0.32, '#eee7d9'); body.addColorStop(0.7, '#d8cebb'); body.addColorStop(1, '#a99e87');
    g.fillStyle = body; g.beginPath(); g.moveTo(-RX, TOP); g.lineTo(-RX, BY); g.ellipse(0, BY, RX, 22, 0, Math.PI, 0, true); g.lineTo(RX, TOP); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(140,125,100,0.28)'; g.lineWidth = 1;
    for (let r = 0; r < Math.floor((BY - TOP) / 15); r++) { const yy = BY - 14 - r * 15; g.beginPath(); g.ellipse(0, yy, RX, 22, 0, 0.05, Math.PI - 0.05); g.stroke(); }
    // arrow slits and a gold band under the rim
    g.fillStyle = '#3d4658'; for (const [sx, sy] of TOP < -60 ? [[-22, -30], [22, -30], [0, -60], [-38, -62], [38, -62]] : [[-24, -8], [24, -8], [0, -14]]) { roundRect(g, sx - 2.5, sy - 9, 5, 18, 2); g.fill(); }
    g.fillStyle = '#e8c25a'; g.beginPath(); g.ellipse(0, TOP + 12, RX + 1, 22, 0, 0, Math.PI); g.lineTo(-RX - 1, TOP + 8); g.ellipse(0, TOP + 8, RX + 1, 22, 0, Math.PI, 0, true); g.closePath(); g.fill();
    // the rim and its merlons
    g.fillStyle = '#e6dfd0'; g.beginPath(); g.ellipse(0, TOP, RX + 4, 24, 0, 0, 7); g.fill();
    g.fillStyle = '#cbc1ad'; g.beginPath(); g.ellipse(0, TOP, RX - 6, 18, 0, 0, 7); g.fill();
    for (let k = 0; k < 10; k++) { const a = Math.PI * (0.05 + k * 0.1), mx = Math.cos(a) * (RX + 1), my = TOP + Math.sin(a) * 23; g.fillStyle = '#e1d8c6'; g.fillRect(mx - 5, my - 13, 10, 13); g.fillStyle = '#f5c542'; g.fillRect(mx - 5, my - 15, 10, 2.5); }
    // the cone
    const CT = TOP - CH, cone = g.createLinearGradient(-RX, 0, RX, 0);
    cone.addColorStop(0, '#2f4f96'); cone.addColorStop(0.35, '#6f9ede'); cone.addColorStop(0.7, '#4a74c0'); cone.addColorStop(1, '#27417e');
    g.fillStyle = cone; g.beginPath(); g.moveTo(-RX + 6, TOP - 4); g.lineTo(0, CT); g.lineTo(RX - 6, TOP - 4); g.ellipse(0, TOP - 4, RX - 6, 16, 0, 0, Math.PI); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; for (let k = 1; k < 5; k++) { const f = k / 5; g.beginPath(); g.ellipse(0, TOP - 4 - (TOP - 4 - CT) * f * 0.98, (RX - 6) * (1 - f), 16 * (1 - f), 0, 0.1, Math.PI - 0.1); g.stroke(); }
    g.fillStyle = '#e8c25a'; g.beginPath(); g.ellipse(0, TOP - 4, RX - 5, 16, 0, 0, Math.PI); g.lineTo(-RX + 5, TOP - 1); g.ellipse(0, TOP - 1, RX - 5, 16, 0, Math.PI, 0, true); g.closePath(); g.fill();
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(0, CT - 4, 5, 0, 7); g.fill(); g.fillRect(-1.2, CT - 22, 2.4, 18);
  }
  function drawRoundTower(g, t) {
    const cx = tc(t.x), cy = tc(t.y), sortY = (t.y + 2) * TILE - 2, squat = t.kind === 'squat', TOP = squat ? -38 : -92, CH = squat ? 66 : 96;
    const s = squat ? sprite('tower-squat', 170, 200, 85, 142, g2 => paintRoundTower(g2, TOP, CH)) : sprite('tower', 170, 290, 85, 232, g2 => paintRoundTower(g2, TOP, CH));
    const a = behindAlpha(cx - 70, cy + TOP - CH - 22, cx + 70, cy + 40, sortY);
    if (a < 1) { g.save(); g.globalAlpha = a; }
    blit(g, s, cx, cy);
    drawPennant(g, cx + 1, cy + TOP - CH - 22, 34);
    if (a < 1) g.restore();
    STATS.towers++;
  }
  // the gatehouse towers: square, three tiles across and six deep, a blue roof, and the Great Gate's long banner
  function paintGateTower(g) {
    const W0 = 144, D = 288, HT = 150;            // local origin: the footprint's top-left
    const topY = -HT, faceY = D - HT;
    g.fillStyle = 'rgba(40,60,100,0.2)'; g.fillRect(8, D - 4, W0, 12);
    // the top: a stone roof walk inside a parapet, and a round turret with a blue cone in the middle
    g.fillStyle = '#e3dbcb'; g.fillRect(0, topY, W0, D);
    g.fillStyle = '#d2c8b4'; g.fillRect(10, topY + 10, W0 - 20, D - 20);
    g.strokeStyle = 'rgba(135,118,92,0.25)'; g.lineWidth = 1; for (let yy = topY + 34; yy < faceY - 10; yy += 24) { g.beginPath(); g.moveTo(10, yy); g.lineTo(W0 - 10, yy); g.stroke(); }
    turret(g, W0 / 2, topY + 170, topY + 90, 34);
    // the parapet's merlons all round the top
    for (let k = 0; k < 12; k++) { if (k % 2) continue; const mx = k * 12; g.fillStyle = '#ede7da'; g.fillRect(mx, faceY - 16, 12, 16); g.fillStyle = '#f5c542'; g.fillRect(mx, faceY - 18, 12, 2.5); }
    for (let k = 0; k < 24; k++) { if (k % 2) continue; const my = topY + k * 12; g.fillStyle = '#ede7da'; g.fillRect(0, my, 8, 10); g.fillRect(W0 - 8, my, 8, 10); }
    // the face: white stone, a gold band, a tall window
    g.fillStyle = '#e8e1d3'; g.fillRect(0, faceY, W0, HT);
    g.fillStyle = 'rgba(145,130,105,0.26)'; for (let r = 0; r < 12; r++) { const yy = faceY + 4 + r * 12; g.fillRect(0, yy, W0, 1); const off = r % 2 ? 12 : 0; for (let c = 0; c < 6; c++) g.fillRect(off + c * 24, yy, 1, 12); }
    g.fillStyle = '#e8c25a'; g.fillRect(0, faceY, W0, 4); g.fillRect(0, faceY + 48, W0, 3);
    const sh = g.createLinearGradient(0, faceY, 0, D); sh.addColorStop(0, 'rgba(60,80,120,0)'); sh.addColorStop(1, 'rgba(60,80,120,0.2)'); g.fillStyle = sh; g.fillRect(0, faceY, W0, HT);
    g.fillStyle = 'rgba(40,60,100,0.12)'; g.fillRect(W0 - 16, faceY, 16, HT);
  }
  const drawTowerAny = (g, t) => t.kind === 'gate' ? drawGateTower(g, t) : drawRoundTower(g, t);
  function drawGateTower(g, t) {
    const x = t.x0 * TILE, y = t.y0 * TILE, sortY = (t.y1 + 1) * TILE - 2;
    const s = sprite('gatetower', 160, 480, 0, 180, paintGateTower);
    const a = behindAlpha(x, y - 170, x + 144, y + 288, sortY);
    if (a < 1) { g.save(); g.globalAlpha = a; }
    blit(g, s, x, y);
    // the Great Gate's two long banners, one on each tower's face
    drawBanner(g, x + 72, y + 288 - 150 + 58, 78, 30);
    drawPennant(g, x + 73, y - 150 + 90 - 96 - 16, 40);
    if (a < 1) g.restore();
    STATS.towers++;
  }

  // ---------- the five gates, drawn at their lift (0 down or shut, 1 up or open) ----------
  function grille(g, x, top, w, bottom, lift, h) {
    const gy = top - 4, gb = bottom - lift * h;
    if (gb <= top + 1) return;
    g.save(); g.beginPath(); g.rect(x, top, w, bottom - top); g.clip();
    g.fillStyle = 'rgba(40,48,62,0.85)';
    for (let k = 0; k <= Math.floor(w / 9); k++) g.fillRect(x + 2 + k * 9, gy, 3, gb - gy);
    for (let yy = gb - 6; yy > gy; yy -= 11) g.fillRect(x, yy, w, 2.5);
    g.fillStyle = '#f5c542'; for (let k = 0; k <= Math.floor(w / 9); k++) { g.beginPath(); g.moveTo(x + 1 + k * 9, gb - 1); g.lineTo(x + 3.5 + k * 9, gb + 5); g.lineTo(x + 6 + k * 9, gb - 1); g.closePath(); g.fill(); }
    g.restore();
  }
  // A gate in the north or south wall is drawn in two parts, so a knight standing in the gateway is inside the arch:
  // 'back' (the wall with the arch cut out and the shadowed passage) sorts before him, 'front' (the grille and the
  // gold arch) after him.
  function smallArch(g, x, y) { g.beginPath(); g.moveTo(x + 8, y + 48); g.lineTo(x + 8, y + 26); g.arc(x + 24, y + 26, 16, Math.PI, 0); g.lineTo(x + 40, y + 48); g.closePath(); }
  function drawSmallGate(g, gt, part) {
    const [tx, ty] = gt.cells[0], x = tx * TILE, y = ty * TILE, lift = LIFT[gt.id];
    if (part === 'back') {
      g.save(); g.beginPath(); g.rect(x - 1, y - 12, 50, 72); smallArch(g, x, y); g.clip('evenodd'); drawWallH(g, tx, ty); g.restore();
      g.save(); smallArch(g, x, y); g.clip();
      const pass = g.createLinearGradient(0, y + 10, 0, y + 48); pass.addColorStop(0, 'rgba(40,50,70,0.5)'); pass.addColorStop(1, 'rgba(40,50,70,0.04)'); g.fillStyle = pass; g.fillRect(x, y + 8, 48, 40);
      g.restore();
      return;
    }
    grille(g, x + 9, y + 10, 30, y + 48, lift, 38);
    g.strokeStyle = '#e8c25a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 8, y + 48); g.lineTo(x + 8, y + 26); g.arc(x + 24, y + 26, 16, Math.PI, 0); g.lineTo(x + 40, y + 48); g.stroke();
    g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(x + 20, y + 7); g.lineTo(x + 28, y + 7); g.lineTo(x + 26, y + 13); g.lineTo(x + 22, y + 13); g.closePath(); g.fill();
    STATS.gates++;
  }
  // the Great Gate: an arch between the gatehouse towers, grille, gold lintel, the royal crest (a gold wing on sky blue)
  const GG = { x: 46 * TILE, y: 61 * TILE, w: 5 * TILE, faceTop: 61 * TILE - 70, groundY: 62 * TILE, oX: 47 * TILE, oW: 3 * TILE, oTop: 62 * TILE - 104 };
  function bigArch(g) { g.moveTo(GG.oX, GG.groundY); g.lineTo(GG.oX, GG.oTop + GG.oW / 2); g.arc(GG.oX + GG.oW / 2, GG.oTop + GG.oW / 2, GG.oW / 2, Math.PI, 0); g.lineTo(GG.oX + GG.oW, GG.groundY); g.closePath(); }
  function drawGreatGate(g, gt, part) {
    const { x, w, faceTop, groundY, oX, oW, oTop } = GG, lift = LIFT[gt.id];
    if (part === 'back') {
      // the walk on top and its merlons
      g.fillStyle = '#e6dfd1'; g.fillRect(x, faceTop - 26, w, 26);
      for (let k = 0; k < 20; k++) { if (k % 2) continue; const mx = x + k * 12; g.fillStyle = '#e1d8c6'; g.fillRect(mx, faceTop - 42, 12, 18); g.fillStyle = '#f5c542'; g.fillRect(mx, faceTop - 44, 12, 2.5); }
      // the face with the arch cut out of it
      g.save(); g.beginPath(); g.rect(x, faceTop, w, groundY - faceTop); bigArch(g);
      g.fillStyle = '#dcd2bf'; g.fill('evenodd'); g.clip('evenodd');
      g.fillStyle = 'rgba(145,130,105,0.26)'; for (let r = 0; r < 10; r++) { const yy = faceTop + 4 + r * 12; g.fillRect(x, yy, w, 1); const off = r % 2 ? 12 : 0; for (let c = 0; c < 10; c++) g.fillRect(x + off + c * 24, yy, 1, 12); }
      const sh = g.createLinearGradient(0, faceTop, 0, groundY); sh.addColorStop(0, 'rgba(60,80,120,0)'); sh.addColorStop(1, 'rgba(60,80,120,0.18)'); g.fillStyle = sh; g.fillRect(x, faceTop, w, groundY - faceTop);
      g.restore();
      // the shadowed passage under the arch
      g.save(); g.beginPath(); bigArch(g); g.clip();
      const pass = g.createLinearGradient(0, oTop, 0, groundY); pass.addColorStop(0, 'rgba(40,50,70,0.55)'); pass.addColorStop(1, 'rgba(40,50,70,0.04)'); g.fillStyle = pass; g.fillRect(oX, oTop, oW, groundY - oTop);
      g.restore();
      return;
    }
    g.save(); g.beginPath(); bigArch(g); g.clip(); grille(g, oX + 2, oTop, oW - 4, groundY, lift, groundY - oTop); g.restore();
    g.strokeStyle = '#e8c25a'; g.lineWidth = 5; g.beginPath(); bigArch(g); g.stroke();
    g.strokeStyle = '#fff0b0'; g.lineWidth = 1.2; g.beginPath(); bigArch(g); g.stroke();
    g.fillStyle = '#e8c25a'; g.fillRect(x, faceTop, w, 5);
    const cx = oX + oW / 2, cy = oTop - 6;
    g.fillStyle = '#e8c25a'; g.beginPath(); g.moveTo(cx - 22, cy - 26); g.lineTo(cx + 22, cy - 26); g.lineTo(cx + 22, cy - 6); g.quadraticCurveTo(cx + 20, cy + 10, cx, cy + 18); g.quadraticCurveTo(cx - 20, cy + 10, cx - 22, cy - 6); g.closePath(); g.fill();
    g.fillStyle = '#5b8fd6'; g.beginPath(); g.moveTo(cx - 18, cy - 22); g.lineTo(cx + 18, cy - 22); g.lineTo(cx + 18, cy - 7); g.quadraticCurveTo(cx + 16, cy + 7, cx, cy + 13); g.quadraticCurveTo(cx - 16, cy + 7, cx - 18, cy - 7); g.closePath(); g.fill();
    goldWing(g, cx + 3, cy - 4, 13);
    STATS.gates++;
  }
  // a door leaf hinged at (hx, hy), its foot running `dirY` (down or up the wall) when shut and swinging out toward `outX`
  // as it opens (theta 0 shut, up to about 80 degrees open); it stands DH tall, so an open leaf shows its whole face
  function leafFace(g, hx, hy, dirY, outX, theta, L, DH) {
    const s = Math.sin(theta), c = Math.cos(theta), px = hx + outX * s * L, py = hy + dirY * c * L;
    if (s < 0.04) return;
    const quad = () => { g.beginPath(); g.moveTo(hx, hy); g.lineTo(px, py); g.lineTo(px, py - DH); g.lineTo(hx, hy - DH); g.closePath(); };
    quad(); g.fillStyle = s > 0.6 ? '#9a6a3e' : s > 0.3 ? '#855a34' : '#6f4a2c'; g.fill();
    g.strokeStyle = 'rgba(40,24,12,0.5)'; g.lineWidth = 1.2;
    for (let k = 1; k < 5; k++) { const f = k / 5, bx = lerp(hx, px, f), by = lerp(hy, py, f); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by - DH); g.stroke(); }
    g.strokeStyle = '#f5c542'; g.lineWidth = 3.5;
    for (const hf of [0.2, 0.8]) { g.beginPath(); g.moveTo(hx, hy - DH * hf); g.lineTo(px, py - DH * hf); g.stroke(); }
    g.fillStyle = '#fff0b0';
    for (const hf of [0.2, 0.8]) for (let k = 1; k < 5; k++) { const f = k / 5; g.beginPath(); g.arc(lerp(hx, px, f), lerp(hy, py, f) - DH * hf, 1.7, 0, 7); g.fill(); }
    g.strokeStyle = '#c9a36a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(hx, hy - DH); g.lineTo(px, py - DH); g.stroke();
    g.strokeStyle = 'rgba(40,24,12,0.6)'; g.lineWidth = 1.5; quad(); g.stroke();
  }
  // a gate shut in a north-south wall: one slab of oak across the gateway, seen from above like the wall itself
  function shutSlab(g, x, top, bottom, seams) {
    g.fillStyle = 'rgba(40,60,100,0.16)'; g.fillRect(x + 40, top, 8, bottom - top);
    g.fillStyle = '#6f4a2c'; g.fillRect(x + 9, top, 30, bottom - top);
    g.fillStyle = '#8a5e36'; g.fillRect(x + 12, top, 8, bottom - top);
    g.fillStyle = '#f5c542'; for (let yy = top + 10; yy < bottom - 6; yy += 22) g.fillRect(x + 8, yy, 32, 4);
    g.fillStyle = '#3a2616'; for (const sy of seams) g.fillRect(x + 9, sy - 1.5, 30, 3);
  }
  // the Crown Gate: two oak leaves banded in gold, between the two gate turrets of the east wall, swinging out toward the
  // Crown Bridge when a knight comes near
  function drawCrownGate(g, gt, part) {
    if (part === 'back') return;
    const lift = LIFT[gt.id], x = 79 * TILE, y0 = 16 * TILE, y1 = 19 * TILE, cx = x + 24, L = (y1 - y0) / 2 - 2;
    // the gateway's floor, in the shade of the turrets
    g.fillStyle = 'rgba(60,70,90,0.18)'; g.fillRect(x, y0, 48, y1 - y0);
    const shut = clamp(1 - lift / 0.3, 0, 1);
    if (shut > 0) { g.save(); g.globalAlpha = shut; shutSlab(g, x, y0 - 4, y1 + 2, [(y0 + y1) / 2]); g.restore(); }
    leafFace(g, cx, y0 + 3, 1, 1, lift * 1.4, L, 52);
    leafFace(g, cx, y1 - 3, -1, 1, lift * 1.4, L, 52);
    // the hinge posts: white stone with gold caps
    for (const py of [y0 + 3, y1 - 3]) { g.fillStyle = '#e6dfd0'; g.fillRect(cx - 5, py - 58, 10, 58); g.fillStyle = '#f5c542'; g.fillRect(cx - 6, py - 62, 12, 5); }
    STATS.gates++;
  }
  // the Postern: one small arched oak door in the west wall, hinged at its north end, opening outward (west)
  function drawPostern(g, gt, part) {
    if (part === 'back') return;
    const lift = LIFT[gt.id], [tx, ty] = gt.cells[0], x = tx * TILE, y = ty * TILE, cx = x + 24;
    g.fillStyle = 'rgba(60,70,90,0.18)'; g.fillRect(x, y, 48, 48);
    const shut = clamp(1 - lift / 0.3, 0, 1);
    if (shut > 0) {
      g.save(); g.globalAlpha = shut; shutSlab(g, x, y - 2, y + 46, []);
      // its round top, facing south where you come at it along the wall
      g.fillStyle = '#6f4a2c'; g.beginPath(); g.moveTo(x + 9, y + 46); g.lineTo(x + 9, y + 30); g.arc(cx, y + 30, 15, Math.PI, 0); g.lineTo(x + 39, y + 46); g.closePath(); g.fill();
      g.strokeStyle = '#f5c542'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 9, y + 46); g.lineTo(x + 9, y + 30); g.arc(cx, y + 30, 15, Math.PI, 0); g.lineTo(x + 39, y + 46); g.stroke();
      g.fillStyle = '#f5c542'; g.beginPath(); g.arc(cx + 8, y + 36, 2.2, 0, 7); g.fill();
      g.restore();
    }
    leafFace(g, cx, y + 3, 1, -1, lift * 1.35, 40, 40);
    g.fillStyle = '#e6dfd0'; g.fillRect(cx - 5, y - 44, 10, 47); g.fillStyle = '#f5c542'; g.fillRect(cx - 6, y - 48, 12, 5);
    STATS.gates++;
  }
  const GATE_DRAW = { great: drawGreatGate, flight: drawSmallGate, spire: drawSmallGate, crown: drawCrownGate, postern: drawPostern };
  const gateSortY = gt => { const ys = gt.cells.map(c => c[1]); return (Math.max(...ys) + 1) * TILE - 2; };

  // ---------- the five spires: 0.8 of a tile wide, five tiles tall, a pennant on each ----------
  function paintSpire(g) {
    const B = 0;
    g.fillStyle = 'rgba(40,60,100,0.2)'; g.beginPath(); g.ellipse(6, B + 2, 26, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#d6ccb8'; g.fillRect(-22, B - 16, 44, 16); g.fillStyle = '#e9e2d4'; g.fillRect(-22, B - 18, 44, 4); g.fillStyle = '#e8c25a'; g.fillRect(-22, B - 19, 44, 2);
    const shaft = g.createLinearGradient(-17, 0, 17, 0); shaft.addColorStop(0, '#c2b7a2'); shaft.addColorStop(0.35, '#f0e9dc'); shaft.addColorStop(1, '#b3a891');
    g.fillStyle = shaft; g.beginPath(); g.moveTo(-17, B - 18); g.lineTo(-15, B - 176); g.lineTo(15, B - 176); g.lineTo(17, B - 18); g.closePath(); g.fill();
    g.fillStyle = '#e8c25a'; for (const yy of [-66, -116, -160]) g.fillRect(-17 + (-yy - 18) / 158 * 2, B + yy, 34 - (-yy - 18) / 158 * 4, 3);
    g.fillStyle = '#3b5ba8'; for (const yy of [-96, -142]) { roundRect(g, -3.5, B + yy - 10, 7, 14, 3.5); g.fill(); g.fillStyle = '#9fd0ff'; g.fillRect(-2, B + yy - 6, 1.5, 6); g.fillStyle = '#3b5ba8'; }
    g.fillStyle = '#e6dfd0'; g.beginPath(); g.ellipse(0, B - 178, 21, 6, 0, 0, 7); g.fill(); g.fillStyle = '#e8c25a'; g.fillRect(-21, B - 181, 42, 3);
    const cone = g.createLinearGradient(-16, 0, 16, 0); cone.addColorStop(0, '#2f4f96'); cone.addColorStop(0.4, '#6f9ede'); cone.addColorStop(1, '#27417e');
    g.fillStyle = cone; g.beginPath(); g.moveTo(-16, B - 181); g.lineTo(0, B - 236); g.lineTo(16, B - 181); g.closePath(); g.fill();
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(0, B - 239, 4, 0, 7); g.fill(); g.fillRect(-1, B - 254, 2, 15);
  }
  function drawSpire(g, sp) {
    const cx = tc(sp.x), by = (sp.y + 1) * TILE - 6;
    const a = behindAlpha(cx - 22, by - 250, cx + 22, by, by);
    if (a < 1) { g.save(); g.globalAlpha = a; }
    blit(g, sprite('spire', 70, 280, 35, 266, paintSpire), cx, by);
    drawPennant(g, cx + 1, by - 254, 30, '#5b8fd6');
    if (a < 1) g.restore();
    STATS.spires++;
  }

  // ---------- the garden: hedges, cloudblossom trees, planters ----------
  function paintHedge(g, n, e, s, w, v) {
    const l = w ? 0 : 3, r = e ? 48 : 45, top = n ? -10 : -8, bot = s ? 38 : 30;
    const r2 = mulberry32(0xed9e + v * 31 + (n ? 1 : 0) + (e ? 2 : 0) + (s ? 4 : 0) + (w ? 8 : 0));
    g.fillStyle = '#4a9642'; g.fillRect(l, top, r - l, bot - top);
    if (!s) { g.fillStyle = '#2f6e2c'; g.fillRect(l, 30, r - l, 15); g.fillStyle = 'rgba(20,50,20,0.35)'; g.fillRect(l, 40, r - l, 5); g.fillStyle = 'rgba(40,60,100,0.18)'; g.fillRect(l + 2, 45, r - l, 6); }
    for (let i = 0; i < 26; i++) { const x = l + 2 + r2() * (r - l - 4), y = top + 2 + r2() * (bot - top - 4); g.fillStyle = r2() < 0.55 ? 'rgba(120,200,100,0.5)' : 'rgba(35,90,35,0.45)'; g.beginPath(); g.arc(x, y, 2 + r2() * 2.2, 0, 7); g.fill(); }
    if (!s) for (let i = 0; i < 10; i++) { const x = l + 2 + r2() * (r - l - 4), y = 32 + r2() * 9; g.fillStyle = 'rgba(80,150,70,0.45)'; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); }
    if (!n) { g.fillStyle = 'rgba(190,240,160,0.55)'; g.fillRect(l, top, r - l, 2); }
  }
  function drawHedge(g, tx, ty) {
    const H0 = (x, y) => kindAt(x, y) === 'hedge';
    const n = H0(tx, ty - 1), e = H0(tx + 1, ty), s = H0(tx, ty + 1), w = H0(tx - 1, ty), v = VAR[ty * W + tx] % 2;
    blit(g, sprite('hedge' + (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0) + v, 48, 64, 0, 12, cg => paintHedge(cg, n, e, s, w, v)), tx * TILE, ty * TILE);
  }
  function paintTree(g, v) {
    const r = mulberry32(0x7ee + v * 101);
    g.fillStyle = 'rgba(40,60,100,0.2)'; g.beginPath(); g.ellipse(4, 2, 26, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#8a6a5a'; g.beginPath(); g.moveTo(-5, 0); g.quadraticCurveTo(-2 + v, -20, -3, -40); g.lineTo(3, -40); g.quadraticCurveTo(4 + v, -20, 5, 0); g.closePath(); g.fill();
    g.fillStyle = '#a88a78'; g.fillRect(-2, -36, 2, 34);
    const puffs = [[-16, -52, 18], [14, -54, 18], [0, -66, 22], [-8, -76, 16], [12, -74, 15], [0, -48, 16]];
    for (const [x, y, rr] of puffs) { g.fillStyle = '#e99ab9'; g.beginPath(); g.arc(x + 2, y + 3, rr, 0, 7); g.fill(); }
    for (const [x, y, rr] of puffs) { g.fillStyle = '#f7b8cf'; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); }
    for (const [x, y, rr] of puffs) { g.fillStyle = '#ffd6e6'; g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.35, rr * 0.55, 0, 7); g.fill(); }
    for (let i = 0; i < 22; i++) { const a = r() * Math.PI * 2, d = r() * 26, x = Math.cos(a) * d, y = -62 + Math.sin(a) * d * 0.8; g.fillStyle = r() < 0.5 ? '#fff4f8' : '#ff9ec4'; g.beginPath(); g.arc(x, y, 1.6 + r() * 1.4, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,190,215,0.8)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(-18 + r() * 36, -2 + r() * 6, 2.2, 1.3, r() * 3, 0, 7); g.fill(); }
  }
  function drawTree(g, tx, ty) {
    const cx = tc(tx), by = (ty + 1) * TILE - 8, v = VAR[ty * W + tx];
    const a = behindAlpha(cx - 36, by - 92, cx + 36, by - 20, by);
    if (a < 1) { g.save(); g.globalAlpha = a; }
    blit(g, sprite('tree' + v, 80, 110, 40, 98, cg => paintTree(cg, v)), cx, by);
    // the petals fall up
    for (let k = 0; k < 3; k++) {
      const h = hash(tx * 7 + k, ty * 3 + k), ph = (time * 0.32 + h) % 1, px = cx - 20 + h * 40 + Math.sin(ph * 6 + k) * 6, py = by - 62 - ph * 70;
      g.fillStyle = `rgba(255,${190 + Math.floor(h * 40)},215,${(Math.sin(ph * Math.PI) * 0.9).toFixed(3)})`; g.beginPath(); g.ellipse(px, py, 2.4, 1.4, ph * 6, 0, 7); g.fill();
    }
    if (a < 1) g.restore();
  }
  function paintPlanter(g) {
    g.fillStyle = 'rgba(40,60,100,0.2)'; g.beginPath(); g.ellipse(3, 1, 20, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#e6dfd1'; g.fillRect(-17, -14, 34, 14); g.fillStyle = 'rgba(60,80,120,0.15)'; g.fillRect(-17, -6, 34, 6);
    g.fillStyle = '#e8c25a'; g.fillRect(-18, -17, 36, 4);
    g.fillStyle = '#6a4a2e'; g.fillRect(-15, -20, 30, 4);
    g.fillStyle = '#4f9a45'; for (const [x, y] of [[-12, -22], [-4, -26], [5, -23], [12, -21], [0, -19]]) { g.beginPath(); g.ellipse(x, y, 6, 4, 0, 0, 7); g.fill(); }
    const cols = ['#ff8fb8', '#ffd24a', '#ffffff', '#8fc8ff', '#ff6f91'];
    [[-11, -27], [-3, -31], [6, -28], [12, -25], [1, -24], [-7, -22]].forEach(([x, y], i) => { g.fillStyle = cols[i % cols.length]; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 1.9, 0, 7); g.fill(); } g.fillStyle = '#ffe066'; g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); });
  }
  // ---------- the props: benches, pews, lamps, the throne, the well, the keep's pillars ----------
  function paintBench(g) {
    g.fillStyle = 'rgba(40,60,100,0.2)'; g.fillRect(-18, -2, 40, 6);
    g.fillStyle = '#e2dbcc'; g.fillRect(-18, -30, 36, 9); g.fillStyle = '#e8c25a'; g.fillRect(-18, -31, 36, 2);
    g.fillStyle = '#d8d0c0'; g.fillRect(-16, -21, 5, 19); g.fillRect(11, -21, 5, 19);
    g.fillStyle = '#f5f1e8'; g.fillRect(-20, -16, 40, 6); g.fillStyle = '#ddd5c5'; g.fillRect(-20, -10, 40, 3);
  }
  function paintPew(g) {
    g.fillStyle = 'rgba(40,40,60,0.2)'; g.fillRect(-21, -2, 44, 5);
    g.fillStyle = '#7a5236'; g.fillRect(-21, -18, 42, 6);
    g.fillStyle = '#5e3e28'; g.fillRect(-21, -12, 42, 12); g.fillStyle = '#6b4a2e'; for (let k = 0; k < 4; k++) g.fillRect(-19 + k * 10.5, -10, 8, 8);
    g.fillStyle = '#e8c25a'; g.fillRect(-21, -19, 42, 2);
    g.fillStyle = '#4a2e1c'; g.fillRect(-21, -18, 3, 18); g.fillRect(18, -18, 3, 18);
  }
  function paintLamp(g) {
    g.fillStyle = 'rgba(40,60,100,0.2)'; g.beginPath(); g.ellipse(3, 0, 11, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#e6dfd1'; g.fillRect(-7, -8, 14, 8); g.fillStyle = '#e8c25a'; g.fillRect(-7, -9, 14, 2);
    g.fillStyle = '#4a5a78'; g.fillRect(-2, -62, 4, 54); g.fillStyle = '#6b7da0'; g.fillRect(-2, -62, 1.5, 54);
    g.fillStyle = '#e8c25a'; g.fillRect(-4, -30, 8, 3); g.fillRect(-4, -60, 8, 3);
    g.fillStyle = '#c9a23a'; g.fillRect(-8, -77, 16, 3); g.fillRect(-8, -64, 16, 3);
    g.fillStyle = '#fffbe8'; g.fillRect(-6, -74, 12, 10);
    g.strokeStyle = '#c9a23a'; g.lineWidth = 1.2; g.strokeRect(-6, -74, 12, 10); g.beginPath(); g.moveTo(0, -74); g.lineTo(0, -64); g.stroke();
    g.fillStyle = '#e8c25a'; g.beginPath(); g.moveTo(-9, -77); g.lineTo(0, -85); g.lineTo(9, -77); g.closePath(); g.fill(); g.beginPath(); g.arc(0, -86, 2, 0, 7); g.fill();
  }
  function drawLamp(g, tx, ty) {
    const cx = tc(tx), by = (ty + 1) * TILE - 8;
    blit(g, sprite('lamp', 30, 100, 15, 92, paintLamp), cx, by);
    const f = 0.85 + Math.sin(time * 5 + tx * 1.7) * 0.08, ly = by - 69;
    const gl = g.createRadialGradient(cx, ly, 2, cx, ly, 34); gl.addColorStop(0, `rgba(255,248,215,${(0.5 * f).toFixed(3)})`); gl.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(cx, ly, 34, 0, 7); g.fill();
    g.fillStyle = `rgba(210,235,255,${f.toFixed(3)})`; g.beginPath(); g.ellipse(cx, ly + 1, 2.6, 3.6 + Math.sin(time * 7 + ty) * 0.6, 0, 0, 7); g.fill();
  }
  function paintThrone(g) {
    g.fillStyle = 'rgba(40,40,60,0.2)'; g.fillRect(-40, -2, 84, 6);
    g.fillStyle = '#e6dfd1'; g.fillRect(-40, -12, 80, 12); g.fillStyle = '#f3efe6'; g.fillRect(-32, -20, 64, 9); g.fillStyle = '#e8c25a'; g.fillRect(-40, -13, 80, 2); g.fillRect(-32, -21, 64, 2);
    for (const s of [-1, 1]) {
      g.save(); g.scale(s, 1);
      for (let f = 0; f < 5; f++) { const L = 60 - f * 8, a = -1.25 + f * 0.12; g.fillStyle = f % 2 ? '#f6f2ea' : '#fffdf8'; g.strokeStyle = '#d9b44a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(8, -30); g.quadraticCurveTo(8 + Math.cos(a) * L * 0.6 + 8, -30 + Math.sin(a) * L * 0.6, 8 + Math.cos(a) * L * 0.5, -30 + Math.sin(a) * L); g.quadraticCurveTo(6, -30 + Math.sin(a) * L * 0.5, 8, -26); g.closePath(); g.fill(); g.stroke(); }
      g.restore();
    }
    g.fillStyle = '#f5f1e8'; g.fillRect(-14, -66, 28, 40); g.strokeStyle = '#e8c25a'; g.lineWidth = 2; g.strokeRect(-14, -66, 28, 40);
    g.fillStyle = '#3b5ba8'; g.fillRect(-12, -38, 24, 10); g.fillStyle = '#5b8fd6'; g.fillRect(-12, -38, 24, 3);
    g.fillStyle = '#e8c25a'; g.fillRect(-18, -40, 5, 14); g.fillRect(13, -40, 5, 14);
    g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(-8, -66); g.lineTo(-8, -74); g.lineTo(-4, -70); g.lineTo(0, -78); g.lineTo(4, -70); g.lineTo(8, -74); g.lineTo(8, -66); g.closePath(); g.fill();
  }
  function paintWell(g) {
    g.fillStyle = 'rgba(40,60,100,0.2)'; g.beginPath(); g.ellipse(3, 2, 24, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#6b4a2e'; g.fillRect(-21, -52, 4, 44); g.fillRect(17, -52, 4, 44);
    g.fillStyle = '#e2dbcc'; g.fillRect(-20, -18, 40, 16); g.fillStyle = 'rgba(60,80,120,0.15)'; g.fillRect(-20, -8, 40, 6);
    g.fillStyle = '#f3efe6'; g.beginPath(); g.ellipse(0, -18, 20, 8, 0, 0, 7); g.fill();
    g.fillStyle = '#1f3552'; g.beginPath(); g.ellipse(0, -18, 14, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#e8c25a'; g.beginPath(); g.ellipse(0, -18, 20, 8, 0, Math.PI, 0); g.lineWidth = 2; g.strokeStyle = '#e8c25a'; g.stroke();
    g.fillStyle = '#8a6a44'; g.fillRect(-21, -46, 42, 3);
    g.strokeStyle = '#d9c9a0'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(4, -44); g.lineTo(4, -30); g.stroke(); g.fillStyle = '#8a6a44'; g.fillRect(0, -30, 8, 6);
    g.fillStyle = '#3b5ba8'; g.beginPath(); g.moveTo(-28, -50); g.lineTo(0, -66); g.lineTo(28, -50); g.lineTo(24, -48); g.lineTo(-24, -48); g.closePath(); g.fill();
    g.fillStyle = '#5b8fd6'; g.beginPath(); g.moveTo(-28, -50); g.lineTo(0, -66); g.lineTo(-2, -48); g.lineTo(-24, -48); g.closePath(); g.fill();
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(0, -67, 2.5, 0, 7); g.fill();
  }
  function paintPillar(g) {
    g.fillStyle = 'rgba(40,40,60,0.2)'; g.beginPath(); g.ellipse(3, 0, 16, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#e6dfd1'; g.fillRect(-13, -8, 26, 8); g.fillStyle = '#e8c25a'; g.fillRect(-13, -9, 26, 2);
    const sh = g.createLinearGradient(-9, 0, 9, 0); sh.addColorStop(0, '#d9d2c4'); sh.addColorStop(0.4, '#fdfbf6'); sh.addColorStop(1, '#d2cab9');
    g.fillStyle = sh; g.fillRect(-9, -64, 18, 56);
    g.strokeStyle = 'rgba(150,140,120,0.3)'; g.lineWidth = 1; for (const fx of [-4, 0, 4]) { g.beginPath(); g.moveTo(fx, -62); g.lineTo(fx, -10); g.stroke(); }
    g.fillStyle = '#f3efe6'; g.fillRect(-14, -72, 28, 8); g.fillStyle = '#e8c25a'; g.fillRect(-14, -64, 28, 2); g.fillRect(-14, -73, 28, 2);
  }
  const SPR_KIND = {
    planter: () => sprite('planter', 44, 44, 22, 36, paintPlanter),
    bench: () => sprite('bench', 48, 40, 24, 34, paintBench),
    pew: () => sprite('pew', 48, 28, 24, 22, paintPew),
    throne: () => sprite('throne', 100, 100, 50, 88, paintThrone),
    well: () => sprite('well', 64, 80, 32, 72, paintWell),
  };
  function drawKind(g, k, tx, ty) {
    if (k === 'hedge') return drawHedge(g, tx, ty);
    if (k === 'tree') return drawTree(g, tx, ty);
    if (k === 'lamp') return drawLamp(g, tx, ty);
    const f = SPR_KIND[k]; if (!f) return;
    blit(g, f(), tc(tx), (ty + 1) * TILE - 6);
  }

  // ---------- the two fountains: an octagon of white stone, three tiers (or the first wingwright), water that moves ----------
  function octagon(g, cx, cy, r, k) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * k; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); }
  function bowl(g, cx, y, rx, ry) {
    g.fillStyle = '#e2dbcc'; g.beginPath(); g.ellipse(cx, y, rx, ry, 0, 0, Math.PI); g.lineTo(cx - rx, y); g.fill();
    g.fillStyle = '#d4ccbb'; g.beginPath(); g.moveTo(cx - rx, y); g.quadraticCurveTo(cx, y + ry * 3.2, cx + rx, y); g.fill();
    g.fillStyle = '#f7f4ee'; g.beginPath(); g.ellipse(cx, y, rx, ry, 0, 0, 7); g.fill();
    g.fillStyle = '#6fbde9'; g.beginPath(); g.ellipse(cx, y + 0.5, rx - 3, ry - 1.5, 0, 0, 7); g.fill();
    g.strokeStyle = '#e8c25a'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(cx, y, rx, ry, 0, 0, 7); g.stroke();
  }
  // water falling off a bowl's rim into whatever is below it
  function curtain(g, cx, y, rx, drop, t) {
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (0.08 + k * 0.105), x = cx + Math.cos(a) * rx, y0 = y + Math.sin(a) * rx * 0.36;
      const ph = (t * 1.6 + k * 0.37) % 1;
      g.strokeStyle = `rgba(215,238,255,${(0.35 + 0.35 * Math.sin((ph + k) * 6.28)).toFixed(3)})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + Math.cos(a) * 5, y0 + drop * 0.5, x + Math.cos(a) * 8, y0 + drop); g.stroke();
    }
  }
  function drawFountain(g, f) {
    const cx = (f.x0 + 1.5) * TILE, cy = (f.y0 + 1.5) * TILE, t = time, R = 70, K = 0.84, royal = f.id === 'royal';
    g.fillStyle = 'rgba(40,60,100,0.18)'; g.beginPath(); g.ellipse(cx + 6, cy + R * K + 6, R, 12, 0, 0, 7); g.fill();
    // the basin: a rim face on the near side, the rim, the water
    octagon(g, cx, cy + 10, R, K); g.fillStyle = '#d9d1c1'; g.fill();
    octagon(g, cx, cy, R, K); g.fillStyle = '#f4f0e7'; g.fill();
    g.strokeStyle = '#e8c25a'; g.lineWidth = 2.5; g.stroke();
    octagon(g, cx, cy, R - 10, K); const wat = g.createLinearGradient(0, cy - R * K, 0, cy + R * K); wat.addColorStop(0, '#7fc6ef'); wat.addColorStop(1, '#2f8fd8'); g.fillStyle = wat; g.fill();
    // ripples, spreading from the middle
    g.save(); octagon(g, cx, cy, R - 11, K); g.clip();
    for (let k = 0; k < 3; k++) { const ph = (t * 0.45 + k / 3) % 1, rr = 18 + ph * 44; g.strokeStyle = `rgba(255,255,255,${((1 - ph) * 0.55).toFixed(3)})`; g.lineWidth = 1.6; g.beginPath(); g.ellipse(cx, cy + 4, rr, rr * K * 0.62, 0, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(cx - 26, cy - 22, 16, 5, -0.3, 0, 7); g.fill();
    g.restore();
    if (royal) {
      // three tiers: the water falls up as much as it falls down
      g.fillStyle = '#ece6d9'; g.fillRect(cx - 7, cy - 24, 14, 30);
      bowl(g, cx, cy - 24, 34, 11); curtain(g, cx, cy - 24, 34, 26, t);
      g.fillStyle = '#ece6d9'; g.fillRect(cx - 5, cy - 50, 10, 26);
      bowl(g, cx, cy - 50, 22, 7.5); curtain(g, cx, cy - 50, 22, 24, t + 0.3);
      g.fillStyle = '#ece6d9'; g.fillRect(cx - 4, cy - 70, 8, 20);
      bowl(g, cx, cy - 70, 12, 4.5); curtain(g, cx, cy - 70, 12, 18, t + 0.6);
      g.fillStyle = '#f5c542'; g.beginPath(); g.arc(cx, cy - 78, 4.5, 0, 7); g.fill(); goldWing(g, cx + 2, cy - 84, 9); g.save(); g.translate(cx, cy - 84); g.scale(-1, 1); goldWing(g, 2, 0, 9); g.restore();
      // the jet, and it arcs up and back
      for (let k = 0; k < 4; k++) { const ph = (t * 1.3 + k / 4) % 1; g.strokeStyle = `rgba(230,246,255,${(0.7 * (1 - ph)).toFixed(3)})`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx, cy - 86); g.quadraticCurveTo(cx + (k - 1.5) * 10, cy - 116 - ph * 8, cx + (k - 1.5) * 18, cy - 90 + ph * 12); g.stroke(); }
    } else {
      // the first wingwright, holding the first letter, and four spouts
      g.fillStyle = '#e6dfd1'; g.fillRect(cx - 12, cy - 30, 24, 30); g.fillStyle = '#e8c25a'; g.fillRect(cx - 13, cy - 31, 26, 3);
      for (const s of [-1, 1]) { g.save(); g.translate(cx, cy - 58); g.scale(s, 1); g.fillStyle = '#f7f4ee'; g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(22, -16, 28, -34); g.quadraticCurveTo(16, -18, 6, 10); g.closePath(); g.fill(); g.strokeStyle = 'rgba(160,150,130,0.5)'; g.lineWidth = 1; g.stroke(); g.restore(); }
      g.fillStyle = '#f2eee6'; g.beginPath(); g.ellipse(cx, cy - 44, 8, 14, 0, 0, 7); g.fill(); g.beginPath(); g.arc(cx, cy - 64, 6, 0, 7); g.fill();
      g.fillStyle = '#fffaf0'; g.fillRect(cx + 5, cy - 58, 10, 7); g.strokeStyle = '#c9a23a'; g.lineWidth = 1; g.strokeRect(cx + 5, cy - 58, 10, 7); g.beginPath(); g.moveTo(cx + 5, cy - 58); g.lineTo(cx + 10, cy - 54); g.lineTo(cx + 15, cy - 58); g.stroke();
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, sx = cx + Math.cos(a) * 12, sy = cy - 22 + Math.sin(a) * 5, ex = cx + Math.cos(a) * 42, ey = cy + Math.sin(a) * 24; for (let j = 0; j < 2; j++) { const ph = (t * 1.5 + j * 0.5 + k * 0.2) % 1; g.strokeStyle = `rgba(225,244,255,${(0.75 - ph * 0.4).toFixed(3)})`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2, sy - 18 - ph * 4, ex, ey); g.stroke(); } }
    }
    // spray: 24 drops at most, placed by the clock (hash of the drop and an eighth of a second)
    const frame = Math.floor(t * 8);
    for (let k = 0; k < 24; k++) {
      const h1 = hash(k + (royal ? 0 : 100), frame), h2 = hash(frame + 7, k * 13 + 1);
      const a = h1 * Math.PI * 2, d = 10 + h2 * (royal ? 48 : 44), x = cx + Math.cos(a) * d, y = cy - 6 + Math.sin(a) * d * 0.5 - h2 * (royal ? 30 : 16);
      g.fillStyle = `rgba(255,255,255,${(0.45 + h1 * 0.5).toFixed(3)})`; g.beginPath(); g.arc(x, y, 1.1 + h2 * 1.2, 0, 7); g.fill();
    }
    STATS.fountains++;
  }
  // ---------- the Mirror Pond ----------
  function drawPond(g) {
    const p = SP.pond, x = p.x0 * TILE, y = p.y0 * TILE, w = (p.x1 - p.x0 + 1) * TILE, h = (p.y1 - p.y0 + 1) * TILE, t = time;
    g.fillStyle = '#e9e3d6'; roundRect(g, x + 2, y + 2, w - 4, h - 4, 34); g.fill();
    g.strokeStyle = '#e8c25a'; g.lineWidth = 2; roundRect(g, x + 2, y + 2, w - 4, h - 4, 34); g.stroke();
    const wat = g.createLinearGradient(0, y, 0, y + h); wat.addColorStop(0, '#8fd0ff'); wat.addColorStop(0.5, '#5fb4ea'); wat.addColorStop(1, '#3d98d8');
    g.fillStyle = wat; roundRect(g, x + 10, y + 10, w - 20, h - 20, 28); g.fill();
    g.save(); roundRect(g, x + 10, y + 10, w - 20, h - 20, 28); g.clip();
    // the sky in it: a mirror
    g.fillStyle = 'rgba(255,255,255,0.28)'; for (let k = 0; k < 3; k++) { const sx = x + 30 + ((t * 6 + k * 90) % (w - 20)); g.beginPath(); g.ellipse(sx, y + 34 + k * 26, 30, 7, 0, 0, 7); g.fill(); }
    for (let k = 0; k < 4; k++) { const hx = hash(k, 3), hy = hash(k, 9), ph = (t * 0.5 + hx) % 1; g.strokeStyle = `rgba(255,255,255,${((1 - ph) * 0.5).toFixed(3)})`; g.lineWidth = 1.3; g.beginPath(); g.ellipse(x + 30 + hx * (w - 60), y + 24 + hy * (h - 48), 4 + ph * 20, (4 + ph * 20) * 0.45, 0, 0, 7); g.stroke(); }
    // the fish are the colour of the sky: you see them when they move
    for (let k = 0; k < 4; k++) {
      const a = t * (0.5 + k * 0.13) + k * 1.7, fx = x + w / 2 + Math.cos(a) * (w * 0.32 - k * 6), fy = y + h / 2 + Math.sin(a) * (h * 0.26 - k * 2), dir = a + Math.PI / 2;
      g.save(); g.translate(fx, fy); g.rotate(dir); g.fillStyle = 'rgba(210,240,255,0.85)'; g.beginPath(); g.ellipse(0, 0, 9, 3.6, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-8, 0); g.lineTo(-14, -4); g.lineTo(-14, 4); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(2, -1, 4, 1.4); g.restore();
    }
    g.restore();
    // lily pads, two in flower
    for (let k = 0; k < 7; k++) { const lx = x + 28 + hash(k, 21) * (w - 56), ly = y + 26 + hash(k, 43) * (h - 52), bob = Math.sin(t * 1.2 + k) * 1.2; g.fillStyle = '#4f9a45'; g.beginPath(); g.moveTo(lx, ly + bob); g.arc(lx, ly + bob, 9, 0.35, Math.PI * 2 - 0.1); g.closePath(); g.fill(); g.fillStyle = 'rgba(160,220,120,0.5)'; g.beginPath(); g.arc(lx - 2, ly + bob - 2, 4, 0, 7); g.fill(); if (k % 3 === 0) { g.fillStyle = '#ffb3cf'; for (let q = 0; q < 5; q++) { const a = q / 5 * Math.PI * 2; g.beginPath(); g.ellipse(lx + Math.cos(a) * 3, ly + bob - 3 + Math.sin(a) * 2, 3, 1.8, a, 0, 7); g.fill(); } g.fillStyle = '#ffe066'; g.beginPath(); g.arc(lx, ly + bob - 3, 1.6, 0, 7); g.fill(); } }
  }
  // ---------- the market: striped awnings over the four stalls, and bunting over the square ----------
  function drawAwning(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, fl = Math.sin(time * 2.2 + tx) * 1.2;
    g.fillStyle = 'rgba(40,60,100,0.18)'; g.fillRect(x - 3, y + 26, 54, 5);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#5b9be0'; g.beginPath(); g.moveTo(x - 3 + k * 9, y + 2); g.lineTo(x + 6 + k * 9, y + 2); g.lineTo(x + 6 + k * 9 + fl * 0.3, y + 22 + fl); g.lineTo(x - 3 + k * 9 + fl * 0.3, y + 22 + fl); g.closePath(); g.fill(); }
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#5b9be0'; g.beginPath(); g.arc(x + 1.5 + k * 9 + fl * 0.3, y + 22 + fl, 4.5, 0, Math.PI); g.fill(); }
    g.fillStyle = '#e8c25a'; g.fillRect(x - 4, y, 56, 3);
    STATS.awnings++;
  }
  function drawBunting(g) {
    const [a, b] = SP.bunting, x0 = tc(a[0]), x1 = tc(b[0]), y = a[1] * TILE + 6, top = y - 58;
    for (const px of [x0, x1]) { g.fillStyle = '#f3efe6'; g.fillRect(px - 2, top, 4, 58); g.fillStyle = '#f5c542'; g.beginPath(); g.arc(px, top - 2, 3.5, 0, 7); g.fill(); }
    const sag = 26 + Math.sin(time * 1.3) * 2, pt = u => ({ x: lerp(x0, x1, u), y: top + 4 + Math.sin(u * Math.PI) * sag });
    g.strokeStyle = '#8a6a44'; g.lineWidth = 1.4; g.beginPath(); for (let k = 0; k <= 20; k++) { const p = pt(k / 20); if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); } g.stroke();
    const cols = ['#5b9be0', '#ffffff', '#f5c542'];
    for (let k = 1; k < 24; k++) { const p = pt(k / 24), sw = Math.sin(time * 3 + k) * 2; g.fillStyle = cols[k % 3]; g.beginPath(); g.moveTo(p.x - 6, p.y); g.lineTo(p.x + 6, p.y); g.lineTo(p.x + sw, p.y + 13); g.closePath(); g.fill(); }
  }
  function groundRing(g, tx, ty, wisp) {
    const cx = tc(tx), cy = ty * TILE + (wisp ? 26 : 40), p = 0.75 + Math.sin(time * 2.4 + tx) * 0.2;
    if (wisp) {
      // a pool of sky-blue under the white swirl, so the wisp stands out on the cloud
      const gl = g.createRadialGradient(cx, cy, 3, cx, cy, 24); gl.addColorStop(0, `rgba(88,150,230,${(0.6 * p).toFixed(3)})`); gl.addColorStop(1, 'rgba(88,150,230,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.fill();
    }
    g.strokeStyle = `rgba(80,140,220,${(0.6 * p).toFixed(3)})`; g.lineWidth = 2.2; g.beginPath(); g.ellipse(cx, wisp ? cy + 14 : cy, 18, 7, 0, 0, 7); g.stroke();
  }
  // the two royal updraft stones wear a gold edge (88 draws the stone itself)
  function drawRoyalRim(g, r) {
    const cx = tc(r.t[0]), y = r.t[1] * TILE, pulse = 0.6 + Math.sin(time * 3) * 0.25;
    g.strokeStyle = `rgba(245,197,66,${pulse.toFixed(3)})`; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, y + 43, 17, 6, 0, 0, 7); g.stroke();
    g.strokeStyle = '#e8c25a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 13, y + 44); g.lineTo(cx - 8, y + 22); g.lineTo(cx + 8, y + 22); g.lineTo(cx + 13, y + 44); g.stroke();
    for (let k = 0; k < 4; k++) { const ph = (time * 0.8 + k * 0.25) % 1; g.fillStyle = `rgba(255,220,120,${(1 - ph).toFixed(3)})`; g.beginPath(); g.arc(cx + Math.sin(k * 2.1 + time) * 8, y + 30 - ph * 44, 1.8, 0, 7); g.fill(); }
  }

  // ---------- the buildings (drawBuilding is wrapped: a kingdom building draws itself here) ----------
  // how far each one's roof, towers and spires rise above its footprint (for culling and for the see-through)
  const RISE = { aer_keep: 400, aer_chapel: 170, aer_guild: 70, aer_forge: 110, aer_bakery: 80, aer_inn: 80 };
  const riseOf = b => RISE[b.id] || 70;
  function stoneFace(g, x, y, w, h) {
    g.fillStyle = '#dcd2bf'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(135,118,92,0.3)';
    for (let r = 0; r * 12 < h; r++) { const yy = y + r * 12; g.fillRect(x, yy, w, 1); const off = r % 2 ? 12 : 0; for (let c = 0; c * 24 < w + 24; c++) { const xx = x + off + c * 24; if (xx < x + w) g.fillRect(xx, yy, 1, Math.min(12, y + h - yy)); } }
    const sh = g.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(1, 'rgba(60,80,120,0.16)'); g.fillStyle = sh; g.fillRect(x, y, w, h);
  }
  function plasterFace(g, x, y, w, h) {
    g.fillStyle = '#ece5d6'; g.fillRect(x, y, w, h);
    g.fillStyle = '#6f8fb8'; g.fillRect(x, y, w, 4); g.fillRect(x, y + h - 5, w, 5);
    for (let c = 0; c <= Math.floor(w / 48); c++) g.fillRect(Math.min(x + w - 4, x + c * 48), y, 4, h);
    const sh = g.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,255,255,0.15)'); sh.addColorStop(1, 'rgba(60,80,120,0.14)'); g.fillStyle = sh; g.fillRect(x, y, w, h);
  }
  function archWindow(g, cx, top, w, h, box) {
    g.fillStyle = '#e9e2d4'; roundRect(g, cx - w / 2 - 3, top - 3, w + 6, h + 5, w / 2 + 3); g.fill();
    g.fillStyle = '#6fa8e0'; g.beginPath(); g.moveTo(cx - w / 2, top + h); g.lineTo(cx - w / 2, top + w / 2); g.arc(cx, top + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, top + h); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(cx - w / 2 + 2, top + w / 2, 2.5, h - w / 2 - 2);
    g.strokeStyle = '#e8c25a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, top + 2); g.lineTo(cx, top + h); g.moveTo(cx - w / 2, top + h * 0.55); g.lineTo(cx + w / 2, top + h * 0.55); g.stroke();
    g.fillStyle = '#e8c25a'; g.fillRect(cx - w / 2 - 3, top + h, w + 6, 2.5);
    if (box) {   // a window box, with flowers
      g.fillStyle = '#8a5e36'; g.fillRect(cx - w / 2 - 4, top + h + 2, w + 8, 6);
      const cols = ['#ff6f91', '#ffd24a', '#ffffff', '#ff8fb8'];
      for (let k = 0; k < 4; k++) { g.fillStyle = '#4f9a45'; g.beginPath(); g.arc(cx - w / 2 - 1 + k * (w + 2) / 3, top + h + 1, 3, 0, 7); g.fill(); g.fillStyle = cols[(k + Math.floor(cx)) % 4]; g.beginPath(); g.arc(cx - w / 2 - 1 + k * (w + 2) / 3, top + h - 1, 2.2, 0, 7); g.fill(); }
    }
  }
  function archDoor(g, cx, bottom, w, h, studs) {
    g.fillStyle = '#e6dfd0'; roundRect(g, cx - w / 2 - 5, bottom - h - 5, w + 10, h + 5, w / 2 + 5); g.fill();
    g.fillStyle = '#7a5236'; g.beginPath(); g.moveTo(cx - w / 2, bottom); g.lineTo(cx - w / 2, bottom - h + w / 2); g.arc(cx, bottom - h + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, bottom); g.closePath(); g.fill();
    g.fillStyle = '#6b4a2e'; for (let k = 1; k < 4; k++) g.fillRect(cx - w / 2 + k * w / 4 - 1, bottom - h + w / 2, 2, h - w / 2);
    g.strokeStyle = '#e8c25a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - w / 2, bottom); g.lineTo(cx - w / 2, bottom - h + w / 2); g.arc(cx, bottom - h + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, bottom); g.stroke();
    if (studs) { g.fillStyle = '#f5c542'; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { g.beginPath(); g.arc(cx - w / 4 + c * w / 4, bottom - 10 - r * (h - w / 2) / 4, 1.8, 0, 7); g.fill(); } }
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(cx + w / 4, bottom - h * 0.42, 2.5, 0, 7); g.fill();
  }
  // a hipped roof over x..x+w from `top` (the back) to `eave` (the front), ridge running east-west
  function hipRoof(g, x, top, w, eave, col) {
    const d = eave - top, inset = Math.min(w * 0.32, d * 0.6), ridge = top + d * 0.36;
    g.fillStyle = shade(col, -0.3); g.beginPath(); g.moveTo(x - 5, top); g.lineTo(x + w + 5, top); g.lineTo(x + w - inset, ridge); g.lineTo(x + inset, ridge); g.closePath(); g.fill();
    g.fillStyle = shade(col, -0.12); g.beginPath(); g.moveTo(x - 5, top); g.lineTo(x + inset, ridge); g.lineTo(x - 5, eave + 5); g.closePath(); g.fill();
    g.fillStyle = shade(col, -0.36); g.beginPath(); g.moveTo(x + w + 5, top); g.lineTo(x + w - inset, ridge); g.lineTo(x + w + 5, eave + 5); g.closePath(); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(x + inset, ridge); g.lineTo(x + w - inset, ridge); g.lineTo(x + w + 5, eave + 5); g.lineTo(x - 5, eave + 5); g.closePath(); g.fill();
    // rows of slate on the front slope
    g.save(); g.beginPath(); g.moveTo(x + inset, ridge); g.lineTo(x + w - inset, ridge); g.lineTo(x + w + 5, eave + 5); g.lineTo(x - 5, eave + 5); g.closePath(); g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 1; for (let yy = ridge + 7; yy < eave + 5; yy += 7) { g.beginPath(); g.moveTo(x - 5, yy); g.lineTo(x + w + 5, yy); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x - 5, ridge, w + 10, (eave - ridge) * 0.3);
    g.restore();
    g.fillStyle = '#e8c25a'; g.fillRect(x + inset, ridge - 1.5, w - inset * 2, 3);
    g.fillStyle = '#f5c542'; for (const px of [x + inset, x + w - inset]) { g.beginPath(); g.arc(px, ridge - 2, 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(40,60,100,0.22)'; g.fillRect(x - 5, eave + 5, w + 10, 5);
    return { ridge, inset };
  }
  function weathervane(g, x, y) {
    g.fillStyle = '#c9a23a'; g.fillRect(x - 1, y - 26, 2, 26);
    g.save(); g.translate(x, y - 22); g.scale(Math.cos(time * 0.5 + x * 0.01) * 0.6 + 0.4, 1);
    g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(-10, 0); g.lineTo(8, -1.5); g.lineTo(8, -4); g.lineTo(13, 0); g.lineTo(8, 4); g.lineTo(8, 1.5); g.lineTo(-10, 1.5); g.closePath(); g.fill();
    goldWing(g, -8, -2, 7);
    g.restore();
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(x, y - 27, 2.2, 0, 7); g.fill();
  }
  function steam(g, x, y) {
    for (let k = 0; k < 5; k++) { const ph = (time * 0.35 + k / 5) % 1; g.fillStyle = `rgba(255,255,255,${(0.75 * (1 - ph)).toFixed(3)})`; g.beginPath(); g.arc(x + Math.sin(ph * 5 + k) * 6 + ph * 10, y - ph * 60, 5 + ph * 12, 0, 7); g.fill(); }
  }
  function hangSign(g, cx, y, draw) {
    g.fillStyle = '#6b4a2e'; g.fillRect(cx - 1, y - 8, 2, 8); g.fillRect(cx - 16, y - 9, 32, 2.5);
    const sw = Math.sin(time * 1.8 + cx * 0.02) * 0.06;
    g.save(); g.translate(cx, y); g.rotate(sw); draw(g); g.restore();
  }
  // a hall or a house: the front wall (white stone, or white plaster with sky-blue timbers), a hipped roof, windows, the door
  function drawHall(g, b, x, y, w, h) {
    const stone = b.stone, FH = stone ? 58 : 48, top = y - (stone ? 12 : 20), eave = y + h - FH, house = !stone;
    g.fillStyle = 'rgba(40,60,100,0.18)'; g.fillRect(x + 8, y + h - 2, w, 10);
    if (stone) stoneFace(g, x, eave, w, FH); else plasterFace(g, x, eave, w, FH);
    g.fillStyle = '#e8c25a'; g.fillRect(x, eave, w, 3);
    const doorC = b.door !== undefined ? b.door : -1;
    for (let c = 0; c < b.w; c++) { if (c === doorC) continue; if (b.w <= 5 && c !== 1 && c !== b.w - 2 && c !== Math.floor(b.w / 2)) continue; if (b.w > 5 && c % 2 === (b.w % 2 ? 1 : 0) && c !== 0 && c !== b.w - 1) continue; archWindow(g, x + c * 48 + 24, eave + 12, stone ? 16 : 14, stone ? 26 : 20, house); }
    const R = hipRoof(g, x, top, w, eave, b.roof);
    if (b.door !== undefined) archDoor(g, x + b.door * 48 + 24, y + h, stone ? 30 : 26, stone ? 46 : 38, stone);
    if (b.doorTop !== undefined) {
      // a door on the north wall: its porch shows over the back of the roof, lanterns either side
      const dx = x + b.doorTop * 48 + 24;
      g.fillStyle = '#f3efe6'; g.fillRect(dx - 20, top - 16, 40, 22); g.fillStyle = '#7a5236'; g.fillRect(dx - 12, top - 12, 24, 18);
      g.fillStyle = '#e8c25a'; g.fillRect(dx - 20, top - 17, 40, 3); g.fillStyle = '#f5c542'; g.beginPath(); g.arc(dx + 6, top - 3, 2, 0, 7); g.fill();
      drawLantern(g, dx - 25, top - 6); drawLantern(g, dx + 25, top - 6);
    }
    const mid = x + w / 2;
    if (b.id === 'aer_guild') hangSign(g, x + b.door * 48 + 24, eave - 2, sg => { sg.fillStyle = '#f5f1e8'; sg.beginPath(); sg.arc(0, 12, 13, 0, 7); sg.fill(); sg.strokeStyle = '#e8c25a'; sg.lineWidth = 2; sg.stroke(); sg.fillStyle = '#dfe6f0'; sg.save(); sg.translate(-2, 12); sg.scale(0.9, 0.9); for (let f = 0; f < 4; f++) { const a = -0.4 - f * 0.34, L = 12 - f * 2; sg.beginPath(); sg.moveTo(-4, 4); sg.quadraticCurveTo(-4 + Math.cos(a) * L * 0.6, 4 + Math.sin(a) * L * 0.6 - 3, -4 + Math.cos(a) * L, 4 + Math.sin(a) * L); sg.quadraticCurveTo(-3, 2, -4, 6); sg.closePath(); sg.fill(); } sg.restore(); sg.strokeStyle = '#c9a23a'; sg.lineWidth = 1.6; sg.beginPath(); sg.moveTo(8, 3); sg.lineTo(-2, 21); sg.stroke(); sg.fillStyle = '#f5c542'; sg.beginPath(); sg.moveTo(8, 3); sg.quadraticCurveTo(12, 8, 5, 12); sg.closePath(); sg.fill(); });
    if (b.id === 'aer_forge') { const chx = x + w - 60, chy = top + 14; g.fillStyle = '#c9c1b0'; g.fillRect(chx - 10, chy - 30, 20, 36); g.fillStyle = '#e8c25a'; g.fillRect(chx - 12, chy - 32, 24, 4); steam(g, chx, chy - 34); }
    if (b.id === 'aer_bakery') { const chx = x + 34, chy = top + 16; g.fillStyle = '#c9b89a'; g.fillRect(chx - 7, chy - 22, 14, 26); steam(g, chx, chy - 24);
      hangSign(g, x + b.doorTop * 48 + 50, top - 2, sg => { sg.fillStyle = '#f5f1e8'; roundRect(sg, -22, 0, 44, 30, 6); sg.fill(); sg.strokeStyle = '#e8c25a'; sg.lineWidth = 2; sg.stroke(); sg.fillStyle = '#d9a04a'; sg.beginPath(); sg.ellipse(0, 11, 11, 7, 0, 0, 7); sg.fill(); sg.fillStyle = '#f0c070'; sg.beginPath(); sg.ellipse(-2, 9, 6, 3, -0.3, 0, 7); sg.fill(); sg.fillStyle = '#7a4a1e'; sg.font = 'bold 7px sans-serif'; sg.textAlign = 'center'; sg.fillText(b.sign, 0, 26); }); }
    if (b.id === 'aer_inn') hangSign(g, x + b.door * 48 + 24, eave - 4, sg => { sg.fillStyle = '#f5f1e8'; roundRect(sg, -38, 0, 76, 18, 5); sg.fill(); sg.strokeStyle = '#e8c25a'; sg.lineWidth = 2; sg.stroke(); sg.fillStyle = '#3b5ba8'; sg.font = `700 9px ${DISPLAY}`; sg.textAlign = 'center'; sg.fillText(b.sign, 0, 13); });
    if (house && b.id !== 'aer_bakery') weathervane(g, mid, R.ridge);
    if (house && b.id === 'aer_bakery') weathervane(g, x + w - 40, R.ridge);
  }
  // the chapel: a gable end to the south with a rose window, a steep roof running back, a bell-cote on the ridge
  function drawChapel(g, b, x, y, w, h) {
    const FH = 64, eave = y + h - FH, apexY = eave - 92, mid = x + w / 2, back = y - 34;
    g.fillStyle = 'rgba(40,60,100,0.18)'; g.fillRect(x + 8, y + h - 2, w, 10);
    // the two slopes of the nave, back to front
    g.fillStyle = shade(b.roof, -0.1); g.beginPath(); g.moveTo(mid, back); g.lineTo(mid, apexY); g.lineTo(x - 6, eave + 4); g.lineTo(x - 6, y + 20); g.closePath(); g.fill();
    g.fillStyle = shade(b.roof, -0.34); g.beginPath(); g.moveTo(mid, back); g.lineTo(mid, apexY); g.lineTo(x + w + 6, eave + 4); g.lineTo(x + w + 6, y + 20); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; for (let k = 1; k < 8; k++) { const f = k / 8; g.beginPath(); g.moveTo(mid, lerp(back, apexY, f)); g.lineTo(x - 6, lerp(y + 20, eave + 4, f)); g.moveTo(mid, lerp(back, apexY, f)); g.lineTo(x + w + 6, lerp(y + 20, eave + 4, f)); g.stroke(); }
    g.fillStyle = '#e8c25a'; g.beginPath(); g.moveTo(mid - 2, back); g.lineTo(mid + 2, back); g.lineTo(mid + 2, apexY); g.lineTo(mid - 2, apexY); g.closePath(); g.fill();
    // the bell-cote: two posts, a little roof, the bell swinging
    const bx = mid, by = lerp(back, apexY, 0.35), sw = Math.sin(time * 2.1) * 0.35;
    g.fillStyle = '#f3efe6'; g.fillRect(bx - 12, by - 34, 4, 34); g.fillRect(bx + 8, by - 34, 4, 34);
    g.fillStyle = '#3b5ba8'; g.beginPath(); g.moveTo(bx - 17, by - 32); g.lineTo(bx, by - 50); g.lineTo(bx + 17, by - 32); g.closePath(); g.fill();
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(bx, by - 52, 2.5, 0, 7); g.fill();
    g.save(); g.translate(bx, by - 30); g.rotate(sw); g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(-7, 14); g.quadraticCurveTo(-7, 2, 0, 1); g.quadraticCurveTo(7, 2, 7, 14); g.closePath(); g.fill(); g.fillStyle = '#c9a23a'; g.fillRect(-8, 13, 16, 2.5); g.restore();
    // the gable end and the front wall
    g.save(); g.beginPath(); g.moveTo(x, eave); g.lineTo(mid, apexY); g.lineTo(x + w, eave); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); g.clip(); stoneFace(g, x, apexY, w, y + h - apexY); g.restore();
    g.strokeStyle = '#e8c25a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 4, eave + 2); g.lineTo(mid, apexY - 3); g.lineTo(x + w + 4, eave + 2); g.stroke();
    // the rose window
    const rx = mid, ry = apexY + 50;
    g.fillStyle = '#f3efe6'; g.beginPath(); g.arc(rx, ry, 25, 0, 7); g.fill();
    g.fillStyle = '#4f7fc8'; g.beginPath(); g.arc(rx, ry, 21, 0, 7); g.fill();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + time * 0.05; g.fillStyle = k % 2 ? '#9fd0ff' : '#f5c542'; g.beginPath(); g.ellipse(rx + Math.cos(a) * 11, ry + Math.sin(a) * 11, 7, 3.5, a, 0, 7); g.fill(); }
    g.fillStyle = '#ff8fb8'; g.beginPath(); g.arc(rx, ry, 5, 0, 7); g.fill();
    g.strokeStyle = '#e8c25a'; g.lineWidth = 2; g.beginPath(); g.arc(rx, ry, 21, 0, 7); g.stroke();
    // tall lancet windows beside the door, and the door
    for (const c of [1, 2, 6, 7]) archWindow(g, x + c * 48 + 24, eave + 8, 12, 34, false);
    archDoor(g, x + b.door * 48 + 24, y + h, 34, 54, true);
    g.fillStyle = '#e8c25a'; g.fillRect(x, eave, w, 3);
  }
  // Queen Seraphel's keep: four turrets with blue cones two tiles over the roof, the donjon five tiles tall with the
  // royal pennant, crenellations all round, a studded arched door and two banners
  function turret(g, cx, base, top, rx) {
    const body = g.createLinearGradient(cx - rx, 0, cx + rx, 0); body.addColorStop(0, '#b9ae98'); body.addColorStop(0.35, '#eee7d9'); body.addColorStop(1, '#ab9f89');
    g.fillStyle = body; g.beginPath(); g.moveTo(cx - rx, top); g.lineTo(cx - rx, base); g.ellipse(cx, base, rx, rx * 0.34, 0, Math.PI, 0, true); g.lineTo(cx + rx, top); g.closePath(); g.fill();
    g.fillStyle = '#3d4658'; roundRect(g, cx - 2.5, (base + top) / 2 - 8, 5, 16, 2); g.fill();
    g.fillStyle = '#e8c25a'; g.fillRect(cx - rx, top + 6, rx * 2, 3);
    g.fillStyle = '#e6dfd0'; g.beginPath(); g.ellipse(cx, top, rx + 3, rx * 0.36, 0, 0, 7); g.fill();
    for (let k = 0; k < 6; k++) { const a = Math.PI * (0.08 + k * 0.17), mx = cx + Math.cos(a) * (rx + 1), my = top + Math.sin(a) * rx * 0.34; g.fillStyle = '#ede7da'; g.fillRect(mx - 4, my - 10, 8, 10); g.fillStyle = '#f5c542'; g.fillRect(mx - 4, my - 12, 8, 2); }
    const ct = top - 96, cone = g.createLinearGradient(cx - rx, 0, cx + rx, 0); cone.addColorStop(0, '#2f4f96'); cone.addColorStop(0.4, '#6f9ede'); cone.addColorStop(1, '#27417e');
    g.fillStyle = cone; g.beginPath(); g.moveTo(cx - rx + 2, top - 3); g.lineTo(cx, ct); g.lineTo(cx + rx - 2, top - 3); g.ellipse(cx, top - 3, rx - 2, rx * 0.3, 0, 0, Math.PI); g.closePath(); g.fill();
    g.fillStyle = '#e8c25a'; g.fillRect(cx - rx + 2, top - 4, rx * 2 - 4, 3);
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(cx, ct - 3, 4, 0, 7); g.fill(); g.fillRect(cx - 1, ct - 16, 2, 13);
    return ct - 16;
  }
  function drawKeep(g, b, x, y, w, h) {
    const FH = 100, faceY = y + h - FH, terr = y - 24;
    g.fillStyle = 'rgba(40,60,100,0.2)'; g.fillRect(x + 10, y + h - 2, w, 12);
    // the two back turrets
    turret(g, x + 30, terr + 40, terr - 60, 30); turret(g, x + w - 30, terr + 40, terr - 60, 30);
    // the roof terrace inside its parapet
    g.fillStyle = '#ddd4c2'; g.fillRect(x, terr, w, faceY - terr);
    g.fillStyle = '#cfc5b1'; g.fillRect(x + 12, terr + 12, w - 24, faceY - terr - 24);
    g.strokeStyle = 'rgba(150,135,110,0.25)'; g.lineWidth = 1; for (let yy = terr + 24; yy < faceY - 12; yy += 24) { g.beginPath(); g.moveTo(x + 12, yy); g.lineTo(x + w - 12, yy); g.stroke(); }
    for (let k = 0; k < Math.floor(w / 12); k++) if (!(k % 2)) { g.fillStyle = '#ede7da'; g.fillRect(x + k * 12, terr - 12, 12, 12); g.fillStyle = '#f5c542'; g.fillRect(x + k * 12, terr - 14, 12, 2.5); }
    for (let k = 0; k < Math.floor((faceY - terr) / 12); k++) if (!(k % 2)) { g.fillStyle = '#ede7da'; g.fillRect(x, terr + k * 12, 9, 10); g.fillRect(x + w - 9, terr + k * 12, 9, 10); }
    // the donjon: a square tower in the middle of the keep, five tiles over the roof, the royal pennant on top
    const dw = 150, dx = x + w / 2 - dw / 2, dBase = faceY - 40, dTop = dBase - 200;
    g.fillStyle = 'rgba(40,60,100,0.18)'; g.fillRect(dx + 8, dBase - 4, dw, 12);
    stoneFace(g, dx, dTop, dw, dBase - dTop);
    g.fillStyle = 'rgba(40,60,100,0.14)'; g.fillRect(dx + dw - 22, dTop, 22, dBase - dTop);
    g.fillStyle = '#e8c25a'; g.fillRect(dx, dTop + 26, dw, 3); g.fillRect(dx, dBase - 60, dw, 3);
    for (const c of [-1, 0, 1]) archWindow(g, dx + dw / 2 + c * 44, dTop + 60, 14, 32, false);
    archWindow(g, dx + dw / 2, dBase - 50, 20, 34, false);
    for (let k = 0; k < Math.floor(dw / 12); k++) if (!(k % 2)) { g.fillStyle = '#ede7da'; g.fillRect(dx + k * 12, dTop - 14, 12, 14); g.fillStyle = '#f5c542'; g.fillRect(dx + k * 12, dTop - 16, 12, 2.5); }
    const cone = g.createLinearGradient(dx, 0, dx + dw, 0); cone.addColorStop(0, '#2f4f96'); cone.addColorStop(0.4, '#6f9ede'); cone.addColorStop(1, '#27417e');
    g.fillStyle = cone; g.beginPath(); g.moveTo(dx + 10, dTop - 12); g.lineTo(dx + dw / 2, dTop - 128); g.lineTo(dx + dw - 10, dTop - 12); g.closePath(); g.fill();
    g.fillStyle = '#3f64ae'; g.beginPath(); g.moveTo(dx + 10, dTop - 12); g.lineTo(dx + dw / 2, dTop - 128); g.lineTo(dx + dw / 2 - 6, dTop - 12); g.closePath(); g.fill();
    g.fillStyle = '#e8c25a'; g.fillRect(dx + 10, dTop - 14, dw - 20, 4);
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(dx + dw / 2, dTop - 132, 6, 0, 7); g.fill(); g.fillRect(dx + dw / 2 - 1.5, dTop - 158, 3, 26);
    // the royal pennant: long, sky blue, a gold wing on it
    { const px = dx + dw / 2 + 1, py = dTop - 158, t = time * 2.6, w1 = Math.sin(t) * 5, w2 = Math.sin(t + 1.2) * 7, L = 70;
      g.fillStyle = '#4f7fc8'; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + L * 0.5, py - 4 + w1, px + L, py + 5 + w2); g.quadraticCurveTo(px + L * 0.5, py + 12 + w1, px, py + 16); g.closePath(); g.fill();
      g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(px + L * 0.75, py + 2 + w1 * 0.8); g.lineTo(px + L, py + 5 + w2); g.lineTo(px + L * 0.75, py + 12 + w1 * 0.8); g.closePath(); g.fill();
      goldWing(g, px + L * 0.34, py + 7 + w1 * 0.4, 10); STATS.pennants++; }
    // the front face: white stone, a gold string course, tall windows, the studded arched door
    stoneFace(g, x, faceY, w, FH);
    g.fillStyle = '#e8c25a'; g.fillRect(x, faceY, w, 4); g.fillRect(x, faceY + 30, w, 2);
    for (let k = 0; k < Math.floor(w / 12); k++) if (!(k % 2)) { g.fillStyle = '#ede7da'; g.fillRect(x + k * 12, faceY - 14, 12, 14); g.fillStyle = '#f5c542'; g.fillRect(x + k * 12, faceY - 16, 12, 2.5); }
    for (const c of [2, 4, 10, 12]) archWindow(g, x + c * 48 + 24, faceY + 40, 18, 40, false);
    const doorX = x + b.door * 48 + 24;
    archDoor(g, doorX, y + h, 58, 80, true);
    drawBanner(g, doorX - 62, faceY + 8, 72, 24); drawBanner(g, doorX + 62, faceY + 8, 72, 24);
    // the two front turrets stand over the face's corners
    turret(g, x + 28, y + h - 6, faceY - 50, 32); turret(g, x + w - 28, y + h - 6, faceY - 50, 32);
  }
  function drawKingBuilding(g, b) {
    STATS.drawn[b.id] = (STATS.drawn[b.id] || 0) + 1;
    const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    const a = behindAlpha(x, y - riseOf(b), x + w, y + h, (b.y + b.h) * TILE - 1);
    g.save(); if (a < 1) g.globalAlpha = a;
    if (b.id === 'aer_keep') drawKeep(g, b, x, y, w, h);
    else if (b.id === 'aer_chapel') drawChapel(g, b, x, y, w, h);
    else drawHall(g, b, x, y, w, h);
    g.restore();
  }
  { const _drawBuilding = drawBuilding; drawBuilding = function (g, b) { return (b && b.kingdom) ? drawKingBuilding(g, b) : _drawBuilding(g, b); }; }

  // ---------- people: wings, a person, the name when you are close ----------
  function wings(g, scale, flap, tone) {
    g.save(); g.scale(scale, scale); g.translate(0, -2);
    for (const s of [-1, 1]) {
      g.save(); g.scale(s, 1); g.rotate(-flap);
      g.fillStyle = tone || '#f4f0e0'; g.strokeStyle = '#c9b676'; g.lineWidth = 0.8;
      for (let f = 0; f < 4; f++) { const a = -0.25 - f * 0.3, L = 24 - f * 4, ex = 9 + Math.cos(a) * L, ey = Math.sin(a) * L; g.beginPath(); g.moveTo(9, 0); g.quadraticCurveTo(9 + Math.cos(a) * L * 0.55, Math.sin(a) * L * 0.55 - 5, ex, ey); g.quadraticCurveTo(9 + Math.cos(a) * L * 0.55 + 2, Math.sin(a) * L * 0.55 + 3, 9, 4); g.closePath(); g.fill(); g.stroke(); }
      g.restore();
    }
    g.restore();
  }
  function drawPerson(g, p, look, wing, scale, name) {
    const near = dist(player.x, player.y, p.px, p.py) < 3 * TILE;
    const facing = (near && !p.moving) ? { x: Math.sign(player.x - p.px) || 0, y: Math.sign(player.y - p.py) || 1 } : (p.facing || { x: 0, y: 1 });
    const e = { x: p.px, y: p.py, r: 13, facing, hurtT: 0, attackT: 0, moving: !!p.moving, walkT: p.walkT || 0 };
    const bob = p.moving ? Math.abs(Math.sin((p.walkT || 0) * 1.2)) * 2 : Math.sin(time * 1.8 + p.px * 0.01) * 1.2;
    g.save(); g.translate(p.px, p.py - bob); if (scale !== 1) g.scale(scale, scale);
    g.fillStyle = 'rgba(80,110,170,0.25)'; g.beginPath(); g.ellipse(0, 12 + bob, 12, 5, 0, 0, 7); g.fill();
    wings(g, wing, Math.sin(time * 1.6 + p.px * 0.02) * 0.15);
    drawHuman(g, e, look);
    g.restore();
    if (near && name) label(g, name, p.px, p.py - 28 * scale);
  }
  function drawBubble(g, text, x, y) {
    g.font = 'bold 11px sans-serif'; const words = text.split(' '), lines = []; let line = '';
    for (const wd of words) { const t2 = line ? line + ' ' + wd : wd; if (g.measureText(t2).width > 170 && line) { lines.push(line); line = wd; } else line = t2; }
    if (line) lines.push(line);
    const bw = Math.min(190, Math.max(...lines.map(l => g.measureText(l).width)) + 16), bh = lines.length * 14 + 10, bx = x - bw / 2, by = y - bh - 10;
    g.fillStyle = 'rgba(255,255,255,0.94)'; roundRect(g, bx, by, bw, bh, 7); g.fill(); g.strokeStyle = 'rgba(90,120,170,0.6)'; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(x - 5, by + bh); g.lineTo(x, by + bh + 7); g.lineTo(x + 5, by + bh); g.closePath(); g.fillStyle = 'rgba(255,255,255,0.94)'; g.fill();
    g.fillStyle = '#23324d'; g.textAlign = 'center'; lines.forEach((l, i) => g.fillText(l, x, by + 17 + i * 14));
  }
  // Lark in the air: over the rail, down past the edge, up in a spiral, and round the Long Rail
  function drawLarkAir(g) {
    let pose = null;
    if (LARK.mode === 'scene' && SCENE.active) {
      const t = sceneT();
      pose = scenePose(t);
      // the second and a half after she goes over: only the wind, streaming up past the rail
      if (t >= 2.8 && t < 4.6) windStreaks(g, t);
    }
    else if (LARK.mode === 'flyoff') { const u = Math.min(1, (time - LARK.t0) / 2.4), f = LARK.from || { x: player.x, y: player.y }; pose = { x: lerp(f.x, tc(SP.larkPlaza[0]), u), y: lerp(f.y, tc(SP.larkPlaza[1]), u) - Math.sin(u * Math.PI) * 90, s: 1.1, a: 1, air: true, wings: 1.4 }; }
    else if (LARK.mode === 'hop') { const u = Math.min(1, (time - LARK.t0) / 1.6), a = u * Math.PI * 2; pose = { x: tc(SP.larkPlaza[0]) + Math.sin(a) * 34, y: tc(SP.larkPlaza[1]) - Math.sin(u * Math.PI) * 70 - (1 - Math.cos(a)) * 10, s: 1, a: 1, air: true, wings: 1.4 }; }
    if (!pose || pose.a <= 0.01) return;
    larkFigure(g, pose);
  }
  function larkFigure(g, pose) {
    g.save(); g.globalAlpha = Math.max(0, Math.min(1, pose.a));
    if (pose.air) { g.fillStyle = 'rgba(60,90,140,0.18)'; g.beginPath(); g.ellipse(pose.x, pose.y + 46, 12 * pose.s, 4 * pose.s, 0, 0, 7); g.fill(); }
    g.translate(pose.x, pose.y); g.scale(0.8 * pose.s, 0.8 * pose.s);
    wings(g, pose.wings, Math.sin(time * (pose.air ? 9 : 2)) * (pose.air ? 0.45 : 0.12), '#fffaf0');
    drawHuman(g, { x: 0, y: 0, r: 13, facing: { x: 0, y: 1 }, hurtT: 0, attackT: 0, moving: false, walkT: 0 }, LOOK_LARK);
    g.restore();
  }
  function windStreaks(g, t) {
    const cx = tc(SP.larkRail[0]) + 30, cy = tc(SP.larkRail[1]);
    g.save(); g.strokeStyle = '#ffffff'; g.lineWidth = 2.2; g.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      const ph = (t * 1.4 + k / 8) % 1, x = cx - 80 + k * 22 + Math.sin(k * 1.7) * 8, y = cy + 110 - ph * 190;
      g.globalAlpha = Math.sin(ph * Math.PI) * 0.75;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 9, y - 18, x, y - 36); g.stroke();
    }
    g.restore();
  }
  // the gold stones: Lark swoops in, sets the knight down and is gone again
  function drawCarry(g) {
    const u = (time - FLIGHT.t0) / 1.3, to = FLIGHT.to; if (u < 0 || u > 1 || !to) return;
    larkFigure(g, { x: to.x + Math.sin(u * 2.4) * 40 + u * 60, y: to.y - 20 - u * 150, s: 1.05, a: 1 - u * u, air: true, wings: 1.5 });
  }
  function flierShadow(g, f) { g.fillStyle = 'rgba(60,90,140,0.16)'; g.beginPath(); g.ellipse(f.px, f.py + 10, 13, 4.5, 0, 0, 7); g.fill(); }
  function drawFlier(g, f) {
    const y = f.py - 70, flap = Math.sin(time * 8 + f.i) * 0.5;
    g.save(); g.translate(f.px, y); g.rotate(Math.atan2(f.dy, f.dx) * 0.15);
    wings(g, 1.3, flap, '#fbf6e6');
    drawHuman(g, { x: 0, y: 0, r: 13, facing: { x: f.dx, y: f.dy }, hurtT: 0, attackT: 0, moving: true, walkT: time * 6 }, f.id === 'wick' ? { tunic: '#2b8c8c', hair: '#f0d0b0', shoulder: '#f5c542', skin: '#f0d8c0' } : { tunic: '#c9d6ea', hair: '#e8d9a0', shoulder: '#9ab0d0', skin: '#f0d8c0' });
    g.restore();
  }
  // ---------- the sky curtain ----------
  function drawCurtain(g, c) {
    const WX = W * TILE, HY = H * TILE;
    g.save();
    g.fillStyle = '#8fd0ff';
    if (c.x + VW > WX) g.fillRect(WX, c.y - TILE, c.x + VW + TILE - WX, VH + 2 * TILE);
    if (c.y + VH > HY) g.fillRect(c.x - TILE, HY, VW + 2 * TILE, c.y + VH + TILE - HY);
    // 36's soft band and drifting cloud on every tile of it, so it is the same sky as the rest
    if (window.SKYCITY && SKYCITY.drawSky) {
      const x0 = Math.max(0, Math.floor(c.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((c.x + VW) / TILE)), y0 = Math.max(0, Math.floor(c.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((c.y + VH) / TILE));
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tx >= W || ty >= H) SKYCITY.drawSky(g, tx, ty);
    }
    g.restore();
    STATS.curtain++;
  }

  // ---------- the hook ----------
  const TALL_ROWS = 5;
  const vis = (c, x0, y0, x1, y1) => x1 > c.x && x0 < c.x + VW && y1 > c.y && y0 < c.y + VH;
  const drawHook = (g, items, c0) => {
    if (!inside()) return;
    const c = c0 || cam;
    STATS.frames++; STATS.gates = 0; STATS.fountains = 0; STATS.awnings = 0; STATS.banners = 0; STATS.pennants = 0; STATS.spires = 0; STATS.towers = 0;
    const n0 = items.length;
    const x0 = Math.max(0, Math.floor(c.x / TILE) - 1), x1 = Math.min(W - 1, Math.ceil((c.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(c.y / TILE) - 1), y1 = Math.min(H - 1, Math.ceil((c.y + VH) / TILE) + 1);
    // the ground, a row at a time, and the sky decor once every row is down
    for (let ty = y0; ty <= y1; ty++) items.push({ y: -1e8 + ty * TILE + 0.0005, draw: () => drawGroundRow(g, ty, x0, x1) });
    items.push({ y: -1e8 + H * TILE + 1, draw: () => drawSkyDecor(g, x0, x1, y0, y1) });
    // the fliers' shadows cross the streets (on the ground, under everyone standing)
    items.push({ y: -1e8 + H * TILE + 2, draw: () => { for (const f of FLIERS) if (vis(c, f.px - 30, f.py - 10, f.px + 30, f.py + 20)) flierShadow(g, f); } });
    // cell by cell: the wall, the garden, the props (a few rows past the bottom edge, for the tall ones)
    for (let ty = y0; ty <= Math.min(H - 1, y1 + 3); ty++) {
      const row = PLAN.ROWS[ty];
      for (let tx = x0; tx <= x1; tx++) {
        const ch = row[tx];
        if (ch === '#') { if (ARCH_STUBS.has(tx + ',' + ty)) continue; const horiz = ty === 11 || ty === 61; items.push({ y: (ty + 1) * TILE - 2, draw: () => horiz ? drawWallH(g, tx, ty) : drawWallV(g, tx, ty) }); continue; }
        const k = KIND_NAMES[KIND[ty * W + tx]];
        if (k) { items.push({ y: (ty + 1) * TILE - (k === 'hedge' ? 3 : 6), draw: () => drawKind(g, k, tx, ty) }); continue; }
        if (ch === 'C') { const b = PLAN.inBuilding(tx, ty); if (b && b.id === 'aer_keep' && tx > b.x && tx < b.x + b.w - 1 && ty > b.y && ty < b.y + b.h - 1) items.push({ y: (ty + 1) * TILE - 8, draw: () => blit(g, sprite('pillar', 40, 90, 20, 80, paintPillar), tc(tx), (ty + 1) * TILE - 8) }); }
        // a wisp is white on white cloud, and an updraft stone pale: a ring of sky-blue on the ground under each, so they read
        else if ((ch === 'W' && window.SKYCITY && tileAt(tx, ty) === SKYCITY.WISP) || (ch === 'U' && royalAt(tx, ty) < 0)) items.push({ y: -1e8 + ty * TILE + 0.8, draw: () => groundRing(g, tx, ty, ch === 'W') });
      }
    }
    // the towers, the spires, the fountains, the pond, the gates
    for (const t of TOWERS) {
      if (t.kind !== 'gate') { const cx = tc(t.x), cy = tc(t.y); if (vis(c, cx - 80, cy - 215, cx + 80, cy + 60)) items.push({ y: (t.y + 2) * TILE - 2, draw: () => drawRoundTower(g, t) }); }
      else { const x = t.x0 * TILE, y = t.y0 * TILE; if (vis(c, x, y - 170, x + 150, (t.y1 + 1) * TILE + 12)) items.push({ y: (t.y1 + 1) * TILE - 2, draw: () => drawGateTower(g, t) }); }
    }
    for (const s of SPIRES) { const cx = tc(s.x), by = (s.y + 1) * TILE; if (vis(c, cx - 40, by - 260, cx + 40, by + 12)) items.push({ y: by - 6, spire: s.name, draw: () => drawSpire(g, s) }); }
    for (const f of FOUNTAINS) { const x = f.x0 * TILE, y = f.y0 * TILE; if (vis(c, x - 10, y - 140, x + 154, y + 160)) items.push({ y: (f.y1 + 1) * TILE - 4, draw: () => drawFountain(g, f) }); }
    { const p = SP.pond; if (vis(c, p.x0 * TILE, p.y0 * TILE, (p.x1 + 1) * TILE, (p.y1 + 1) * TILE)) items.push({ y: (p.y1 + 1) * TILE - 40, draw: () => drawPond(g) }); }
    for (const gt of GATES) {
      const xs = gt.cells.map(q => q[0]), ys = gt.cells.map(q => q[1]), gx0 = (Math.min(...xs) - 1) * TILE, gx1 = (Math.max(...xs) + 2) * TILE, gy0 = (Math.min(...ys) - 3) * TILE, gy1 = (Math.max(...ys) + 1) * TILE;
      if (!vis(c, gx0, gy0, gx1, gy1)) continue;
      const f = GATE_DRAW[gt.id], by = gateSortY(gt), topRow = Math.min(...ys);
      items.push({ y: topRow * TILE + 2, draw: () => f(g, gt, 'back') });
      items.push({ y: by, draw: () => f(g, gt, 'front') });
    }
    // the market's awnings and bunting, the royal updrafts' gold
    for (const [sx, sy] of SP.stalls) if (vis(c, sx * TILE - 8, sy * TILE - 8, (sx + 1) * TILE + 8, (sy + 1) * TILE)) items.push({ y: (sy + 1) * TILE - 3, draw: () => drawAwning(g, sx, sy) });
    { const [a, b] = SP.bunting; if (vis(c, a[0] * TILE, a[1] * TILE - 70, (b[0] + 1) * TILE, (a[1] + 1) * TILE)) items.push({ y: 4.8e7, draw: () => drawBunting(g) }); }
    for (const r of ROYAL) if (vis(c, r.t[0] * TILE - 20, r.t[1] * TILE - 40, (r.t[0] + 1) * TILE + 20, (r.t[1] + 1) * TILE)) items.push({ y: (r.t[1] + 1) * TILE - 3, draw: () => drawRoyalRim(g, r) });
    // a kingdom building whose footprint is off the screen while its towers are not: the core culls by footprint
    for (const b of AER_BUILDINGS) {
      const bx = b.x * TILE, by = b.y * TILE, bw = b.w * TILE, bh = b.h * TILE;
      const coreSees = (b.x + b.w) * TILE > c.x && b.x * TILE < c.x + VW && (b.y + b.h) * TILE > c.y && b.y * TILE < c.y + VH;
      const pt = ptile();
      if (!coreSees && vis(c, bx - 20, by - riseOf(b), bx + bw + 20, by + bh) && buildingAt(pt.tx, pt.ty) !== b && BUILDINGS.includes(b)) items.push({ y: (b.y + b.h) * TILE - 1, draw: () => drawBuilding(g, b) });
    }
    // people: the residents, Lark on the ground, the walkers; the fliers and Lark flying in the air
    for (const p of PEOPLE) if (vis(c, p.px - 60, p.py - 70, p.px + 60, p.py + 30)) items.push({ y: p.py + 13, draw: () => drawPerson(g, p, p.look, p.wing, 1, p.name) });
    if (larkStands() && vis(c, LARK.px - 60, LARK.py - 70, LARK.px + 60, LARK.py + 30)) items.push({ y: LARK.py + 13, draw: () => { drawPerson(g, LARK, LOOK_LARK, 0.8, 0.8, 'Lark'); if (LARK.bubble) drawBubble(g, LARK.bubble.text, LARK.px, LARK.py - 34); } });
    if (!larkStands()) items.push({ y: 5e7 + 10, draw: () => drawLarkAir(g) });
    if (time - FLIGHT.t0 < 1.3 && FLIGHT.to) items.push({ y: 5e7 + 11, draw: () => drawCarry(g) });
    for (const w of WALKERS) if (vis(c, w.px - 60, w.py - 70, w.px + 60, w.py + 30)) items.push({ y: w.py + 13, draw: () => drawPerson(g, Object.assign(w, { moving: true }), w.look, w.child ? 0.7 : 0.95, w.child ? 0.78 : 1, w.name) });
    FLIERS.forEach((f, k) => { if (vis(c, f.px - 60, f.py - 130, f.px + 60, f.py + 30)) items.push({ y: 5e7 + 20 + k, draw: () => drawFlier(g, f) }); });
    // the sky curtain: the camera stops at the edge of the whole map, not at the edge of the city, so near the city's east
    // and south edges it looks past them, at what the core draws there by coordinate (Thistledown's villagers from x 100,
    // the castle's towers at x 104). One item over every world thing (9.5e8: under the light and the use highlights at 1e9)
    // paints all of that with 36's own sky, so the edge reads as more sky.
    if (c.x + VW > W * TILE || c.y + VH > H * TILE) items.push({ y: 9.5e8, curtain: true, draw: () => drawCurtain(g, c) });
    // the use highlight for a person of ours in front
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 5, draw: () => {
      const p = inFront() || walkerInFront(); if (!p) return;
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.arc(p.px, p.py, 22, 0, 7); g.stroke(); g.setLineDash([]);
    } });
    STATS.items = items.length - n0;
  };
  HOOKS.draw.push(drawHook);

  // =========================================================================
  // 10. registers: Lark's feather, the Cloud Oven, the marker, the book, the Voice
  // =========================================================================
  ITEMS.lark_feather = { name: "Lark's first feather", value: 0, color: '#fffaf0', shape: 'silk', stack: 1 };
  ITEMS.lark_feather.id = 'lark_feather';
  if (window.KEYRING && KEYRING.register) KEYRING.register('lark_feather', "Lark's first feather. Stand on a gold updraft stone in Aerie and she flies you anywhere in the city.");
  if (window.ICONS && ICONS.set) ICONS.set('lark_feather', (g, size, item) => {
    // a small downy white feather with a curled gold tip, and a sky-blue ribbon tied round the quill
    g.save(); g.rotate(-0.7);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-7.4, 0.4); g.quadraticCurveTo(-2.8, -5.8, 5.8, -3.1); g.quadraticCurveTo(7.8, -1.6, 6.7, 0.5); g.quadraticCurveTo(0, 5.1, -7.4, 0.4); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.stroke();
    // the down: barbs either side of the shaft
    g.strokeStyle = 'rgba(150,170,200,0.7)'; g.lineWidth = 1;
    for (const k of [-3.6, -0.9, 1.8]) { g.beginPath(); g.moveTo(k, -0.5); g.lineTo(k + 2, -3.6); g.moveTo(k, 0); g.lineTo(k + 1.6, 3.1); g.stroke(); }
    // the curled gold tip
    g.strokeStyle = '#f5c542'; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(5.4, -2.4); g.quadraticCurveTo(8.5, -2.2, 7.6, 1.1); g.stroke();
    // the shaft
    g.strokeStyle = '#c9b676'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-8.4, 0.9); g.lineTo(5.8, -0.9); g.stroke();
    // the ribbon round the quill, its two ends hanging down
    g.fillStyle = '#5b9be0'; g.fillRect(-6.9, -1.3, 2.4, 4);
    g.beginPath(); g.moveTo(-5.8, 2.5); g.lineTo(-7.9, 5.9); g.lineTo(-5.6, 5); g.lineTo(-4.2, 6.6); g.lineTo(-4.7, 2.5); g.closePath(); g.fill();
    g.restore();
  });
  SHOPS.aerie_bakery = { name: 'The Cloud Oven', stock: [['bread', 12], ['berry_pie', 40], ['fish_pie', 46]] };
  // 61-markers hangs every shop on a mark. The Cloud Oven is inside Aerie, which has no door in the world: its mark goes
  // beside the Windward Market's, by the wind shrine's step
  let OVEN_MARK = null;
  if (window.MARKERS && MARKERS.add) for (const [mx, my] of [[63, 7], [61, 7], [63, 8]]) { OVEN_MARK = MARKERS.add({ x: mx, y: my, kind: 'shop', label: 'The Cloud Oven' }); if (OVEN_MARK) break; }
  if (AER) AER.voice = 'Above the clouds: Aerie, the walled city of the winged folk. They have watched the Fanglands for a thousand years. Listen: they sing.';
  if (window.WIKI && WIKI.add) {
    const who = PEOPLE.map(p => p.name).concat(['Lark, the Queen\'s daughter'], WALKERS.map(w => w.name + ' (walks the streets)'));
    const where = b => { const w = PLAN.wardAt(b.x + (b.w >> 1), b.y + (b.h >> 1)); return w ? w.name.replace(/^The /, 'the ') : 'the city'; };
    const lines = [
      'Aerie, the walled city of the winged folk, above the clouds over the Grey Quarry. The wind shrine lifts you up once the storm is broken.',
      `A white stone wall with ${SP.towers.length + SP.gatehouse.length} towers and ${GATES.length} gates, Queen Seraphel's keep on a raised plaza in a moat of sky, ${SPIRES.length} spires, 2 fountains, ${AER_BUILDINGS.length} buildings, ${PLAN.BRIDGES.length} bridges, the Queen's Garden with a hedge maze, and ${LAMPS_N} lamps.`,
      { t: 'THE WARDS', c: '#8b949e' },
      ...PLAN.WARDS.map(wd => `${wd.name}: ${wd.sub.charAt(0).toLowerCase() + wd.sub.slice(1)}.`),
      { t: 'BUILDINGS', c: '#8b949e' },
      ...AER_BUILDINGS.map(b => `${b.name}, in ${where(b)}`),
      { t: 'PEOPLE', c: '#8b949e' },
      'Queen Seraphel (in her keep)', 'Master Halcyon (at the sky forge)', 'Keeper Pell (the Rookery)', 'Quill Windward (the Windward Market)', 'Skyla Fleetwing (the Spire Run)', 'Old Ferris (the Underside)',
      ...who,
      `Sky sentinels (${SP.sentinels.length}), level ${MONSTER_DEFS.sky_sentinel ? MONSTER_DEFS.sky_sentinel.level : 35}: winged guards who only fight back.`,
      { t: 'GETTING ROUND', c: '#8b949e' },
      'Six updraft stones carry you between the Wind Landing, the Crown, the Underside and the Spire Run.',
      "Two more stones are edged in gold, at the Wind Landing and on the Royal Plaza. With Lark's first feather, stand at either and she flies you to any of six places in the city.",
      "On foot: the Great Gate from the Wind Landing, the Flight Gate to the Long Rail, the Crown Gate and the Crown Bridge to the Rookery, the Spire Gate and the Runners' Bridge to the Spire Run, the Postern and the Low Stair down to the Underside.",
      { t: 'SHOPS', c: '#8b949e' },
      'The Windward Market (Quill Windward)', 'The Cloud Oven (Tamsin): bread 12, berry pie 40, fish pie 46',
      { t: 'PLAYING WITH FRIENDS', c: '#8b949e' },
      'Each knight has their own Lark: her story, her flight and her feather are yours alone. The gates lift for any knight.',
    ];
    WIKI.add('places', { id: 'aerie', name: 'Aerie', sub: 'The walled city above the clouds', kind: 'instance', lines, buildings: AER_BUILDINGS.map(b => b.name), npcs: ['Queen Seraphel', 'Master Halcyon'].concat(who) });
    WIKI.add('quests', { id: 'lark', giver: 'Queen Seraphel, in her keep in Aerie, once the Song of Above is sung', reward: "250 coins and Lark's first feather (each knight has their own Lark)", kind: 'Side quest' });
    WIKI.add('items', { id: 'lark_feather', lines: [
      "Lark's first feather. Every child of Aerie gets one on their first flight, and gives it to someone who helped.",
      "Lark gives it to you on the Long Rail at the end of Lark's First Flight. It lives on your keyring: no pack space, and you cannot lose it.",
      `Stand at one of the two gold updraft stones (the Wind Landing and the Royal Plaza) and use it: Lark flies you to ${DESTS.map(d => d.name).join(', ')}.`,
      'Each knight has their own Lark.' ] });
  }

  // =========================================================================
  // 11. handle
  // =========================================================================
  const KNOWN = [['the maze middle (Lark)', SP.larkMaze[0], SP.larkMaze[1]], ['the Long Rail', SP.railSpot[0], SP.railSpot[1]]]
    .concat(PEOPLE.map(p => [p.name, p.x, p.y]))
    .concat(AER_BUILDINGS.map(b => { const [dx, dy] = PLAN.doorOf(b); return [b.name + ' door', dx, dy]; }))
    .concat(ROYAL.map(r => ['the gold updraft stone at ' + r.name, r.t[0], r.t[1]]));
  window.KINGDOM = {
    PLAN, TILES, KIND, KIND_NAMES, AER_BUILDINGS, mounted, mountSync, unmount, PEOPLE, LARK, LARK_LOG, WALKERS, FLIERS, walkerAt, flierAt, CLOCK, KNOWN, ROYAL, DESTS, WARDS: PLAN.WARDS, WARD,
    GATES, FOUNTAINS, SPIRES, TOWERS, BANNERS: SP.banners, LIFT, lift: id => LIFT[id], kindAt, paintsGround, paint, painted: () => PAINTED, glyphsOk: () => glyphsOk, maxTile: MAX_TILE,
    queenFirst, Q, talk, talkWalker, inFront, walkerInFront, lineFor, standing, flyTo, useRoyal, WALK_LINES, REFUSE_LINE,
    scene: { start: sceneStart, get t() { return sceneT(); }, get active() { return SCENE.active; }, finish: sceneFinish },
    stats: STATS, drawHook, drawBuilding: drawKingBuilding, drawCurtain, art: { tower: drawTowerAny, fountain: drawFountain, spire: drawSpire, awning: drawAwning },
    arrived, larkFromStage, follow: startFollow, OVEN_MARK: () => OVEN_MARK,
  };

  // =========================================================================
  // 12. self-test (K1-K21; every check puts back what it touched)
  // =========================================================================
  let A5 = null;       // K5's record, which K17 reads (the new game K5 starts is the one K17 needs)
  HOOKS.selfTest.push((check, F, h) => {
    const K = 'kingdom: ';
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const said = () => (dialog.cur ? [dialog.cur] : []).concat(dialog.queue);
    const firstLine = () => { const d = said()[0]; return d ? d.who + ' | ' + d.text : null; };
    const tileOf = () => ({ tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) });
    const inst = () => INSTANCES.get('aerie');
    const leave = () => { if (INSTANCES.active()) INSTANCES.leave(); };
    const enter = () => { leave(); const ok = INSTANCES.enter('aerie', [SKYCITY.STEP_T.x, SKYCITY.STEP_T.y]); F.sim(2, []); drain(); closePanel(); return ok; };
    const count = (tiles, id) => { let n = 0; for (let i = 0; i < tiles.length; i++) if (tiles[i] === id) n++; return n; };
    const glyphCount = c => { let n = 0; for (const r of PLAN.ROWS) for (const ch of r) if (ch === c) n++; return n; };
    // BFS over Aerie's own grid, 4 ways, over tiles `pass` allows; -1 is out of reach
    const flood = (tiles, sx, sy, pass) => {
      const d = new Int32Array(W * H).fill(-1), q = [sy * W + sx]; d[sy * W + sx] = 0;
      for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (d[n] >= 0 || !pass(tiles[n], nx, ny)) continue; d[n] = d[c] + 1; q.push(n); } }
      return d;
    };
    const walkable = t => !SOLID.has(t);
    // reached: the tile itself, or (for something solid) one of its four sides
    const reachAt = (d, x, y) => { let best = d[y * W + x]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const v = d[ny * W + nx]; if (v >= 0 && (best < 0 || v + 1 < best)) best = v + 1; } return best; };
    // a recording canvas: every call is logged with its arguments
    const recorder = () => { const log = []; const g = new Proxy({}, {
      get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? (() => ({ addColorStop: () => { } })) : typeof k === 'string' ? ((...a) => { log.push([k, a]); }) : undefined,
      set: () => true }); return { g, log }; };
    // every item a render drew, in the order it drew them (a hook pushed last, taken out again)
    const capture = () => { const cap = { items: null }; const hook = (g, items) => { cap.items = items; }; HOOKS.draw.push(hook); try { render(); } finally { const i = HOOKS.draw.indexOf(hook); if (i >= 0) HOOKS.draw.splice(i, 1); } return cap.items || []; };
    const screenTap = (wx, wy) => { render(); const sx = wx - cam.x, sy = wy - cam.y; tap.lastTap = null; tapCancel('manual'); pointerDown(sx, sy, 'mouse'); pointerUp('mouse'); };
    const untilTapDone = (max = 600) => { let s = 0; while (s < max && (tap.kind || (tap.path && tap.path.length))) { F.step([]); s++; } F.step([]); return s; };

    // ---- what the checks touch, to put back at the end ----
    h.peace(true); closePanel(); drain(); leave();
    const comp = (player.companion && typeof player.companion === 'object') ? player.companion : null;
    const compDown = comp ? comp.downT : 0; if (comp) comp.downT = 999;
    const snap = { k: JSON.stringify(quest.kingdom === undefined ? null : quest.kingdom), sky: JSON.stringify(quest.sky === undefined ? null : quest.sky), ring: (player.keyring || []).slice(),
      inv: player.inv.map(s => s ? { ...s } : null), equip: JSON.stringify(player.equip), hp: player.hp, x: player.x, y: player.y, deathKeep, touch: window.__forceTouch };
    const restoreKingdom = () => { quest.kingdom = JSON.parse(snap.k); if (quest.kingdom === null) delete quest.kingdom; };
    const restoreSky = () => { quest.sky = JSON.parse(snap.sky); if (quest.sky === null) delete quest.sky; };
    const restoreKit = () => { player.inv = snap.inv.map(s => s ? { ...s } : null); player.equip = JSON.parse(snap.equip); player.keyring = snap.ring.slice(); if (window.KEYRING && KEYRING.absorb) KEYRING.absorb(); player.hp = Math.max(1, snap.hp); };
    const setCoins = n => { while (coins() > 0) payCoins(coins()); if (n > 0) h.give('coins', n); };
    const featherOff = () => { while (KEYRING.held('lark_feather')) removeItem('lark_feather', 1); };
    const sky = () => SKYCITY.SQ();

    // ---- K1. the plan ----
    { const rowsOk = PLAN.ROWS.length === 80 && PLAN.ROWS.every(r => r.length === 100) && W === 100 && H === 80;
      const glyphsKnown = PLAN.ROWS.every(r => [...r].every(c => c in PLAN.GLYPHS));
      const namesExist = Object.values(PLAN.GLYPHS).every(n => typeof T[n] === 'number');
      const maxId = Math.max(...Object.values(T));
      // every named spot on its glyph (a person or a walker on any ground a knight can stand on)
      const WALK = ',u=+"*G_DRfLNg';
      const want = { entry: '=', leap: 'J', wisps: 'W', seraphel: '_', throne: 'Y', halcyon: '_', aldric: WALK, tamsin: WALK, mossbeard: WALK, aubade: WALK, corvin: WALK, merriweather: WALK, orla: '_', brisk: '_',
        pell: WALK, quill: WALK, skyla: WALK, ferris: WALK, sentinels: WALK, larkMaze: '*', larkWait: '=', larkPlaza: '=', mazeGate: '"', railSpot: '=', larkRail: '=', larkLand: '=', perches: 'P', songstone: 'O', snags: 'z', nests: 'n',
        braziers: 'x', statues: 's', stalls: 'k', organ: 'k', rails: 'r', cloudSpires: '^', spires: 'S', well: 'w', towers: 'T', pillars: 'C', bunting: '=', lamps: 'l', trees: 't', hedges: 'h', planters: 'p', benches: 'b', pews: 'b', beds: '*', pondCells: 'o', gateCells: 'G', banners: '#' };
      const bad = [];
      for (const key in want) { const v = SP[key]; const list = Array.isArray(v) && Array.isArray(v[0]) ? v : [v]; for (const [x, y] of list) if (!want[key].includes(PLAN.at(x, y))) bad.push(key + '@' + x + ',' + y + '=' + PLAN.at(x, y)); }
      for (const f of SP.fountains) for (let y = f.y0; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) if (PLAN.at(x, y) !== 'F') bad.push('fountain@' + x + ',' + y);
      for (const o of SP.gatehouse) if (PLAN.at(o.x, o.y) !== 'T') bad.push('gatehouse@' + o.x + ',' + o.y);
      for (let y = SP.balcony.y0; y <= SP.balcony.y1; y++) for (let x = SP.balcony.x0; x <= SP.balcony.x1; x++) if (PLAN.at(x, y) !== '=') bad.push('balcony@' + x + ',' + y);
      for (let y = SP.songRing.y0; y <= SP.songRing.y1; y++) for (let x = SP.songRing.x0; x <= SP.songRing.x1; x++) if (PLAN.at(x, y) !== (x === SP.songstone[0] && y === SP.songstone[1] ? 'O' : '_')) bad.push('songRing@' + x + ',' + y);
      for (const d of PLAN.DRAFTS.concat(PLAN.ROYAL)) { if (PLAN.at(d.t[0], d.t[1]) !== 'U') bad.push('draft@' + d.t); if (!WALK.includes(PLAN.at(d.land[0], d.land[1]))) bad.push('land@' + d.land); }
      for (const g of PLAN.GATES) for (const [x, y] of g.cells) if (PLAN.at(x, y) !== 'G') bad.push('gate ' + g.id + '@' + x + ',' + y);
      for (const s of PLAN.SPIRE_NAMES) if (PLAN.at(s.x, s.y) !== 'S') bad.push('spire@' + s.x + ',' + s.y);
      // the glyph counts the judge's plan-check.js measured on plan-rows.txt (sha1 a0fd9636...)
      const COUNTS = { '=': 1582, '#': 160, 'T': 189, 'G': 9, '+': 73, '"': 469, '*': 17, 'h': 71, 't': 24, 'o': 18, 'F': 18, 'S': 5, 'l': 26, 'p': 10, 'b': 9, 'w': 1, 'Y': 1, 's': 4,
        'k': 7, 'n': 7, 'x': 6, 'r': 21, '^': 8, 'U': 8, 'P': 3, 'O': 1, 'z': 6, 'f': 6, 'L': 9, 'N': 3, 'g': 4, 'W': 3, 'J': 1, 'C': 136, 'H': 118, '_': 279, 'D': 12, 'R': 7, 'a': 13, 'q': 6, 'c': 4, 'u': 270, ',': 1226, '~': 3150 };
      const off = Object.keys(COUNTS).filter(c => glyphCount(c) !== COUNTS[c]).map(c => c + ' ' + glyphCount(c) + ' want ' + COUNTS[c]);
      const total = Object.values(COUNTS).reduce((a, b) => a + b, 0);
      check(K + 'K1 the plan: 100x80, every row 100 wide, every glyph known and named, every spot on its glyph, tile ids fit a byte (max <= 255), and every glyph count is the measured one',
        rowsOk && glyphsKnown && namesExist && bad.length === 0 && maxId <= 255 && off.length === 0 && total === W * H,
        { rowsOk, glyphsKnown, namesExist, maxId, bad: bad.slice(0, 6), off, total }); }

    // ---- K2. paint ----
    { const live = inst().tiles, fresh = paint(new Uint8Array(W * H));
      let diff = 0; for (let i = 0; i < W * H; i++) if (live[i] !== fresh[i]) diff++;
      const R = Math.random; let threw = null; Math.random = () => { throw new Error('Math.random used'); };
      let again = null; try { again = paint(new Uint8Array(W * H)); } catch (e) { threw = e.message; } finally { Math.random = R; }
      let same = !!again; if (again) for (let i = 0; i < W * H; i++) if (again[i] !== fresh[i]) { same = false; break; }
      check(K + 'K2 paint: Aerie is the plan painted cell for cell, with no random numbers (every client builds the same city), and two paints are byte-identical',
        diff === 0 && !threw && same, { diff, threw, same }); }

    // ---- K3. Cohen's list, one line each ----
    enter();
    { const tl = inst().tiles, A = {};
      // WALLS: 160 wall tiles, and the ring is closed (from the keep door, with the gates shut, nothing gets past x 17-78, y 12-60)
      { const d = flood(tl, 48, 38, t => walkable(t) && t !== GATE); let esc = 0; for (let i = 0; i < W * H; i++) if (d[i] >= 0) { const x = i % W, y = (i / W) | 0; if (x < 17 || x > 78 || y < 12 || y > 60) esc++; }
        A.walls = count(tl, WALL) === 160 && esc === 0 && d[38 * W + 48] === 0; A.wallInfo = { wall: count(tl, WALL), escaped: esc }; }
      // TOWERS: 19 of them over 189 tower tiles, and every one flies a pennant
      { const p0 = STATS.pennants, { g } = recorder(); for (const t of TOWERS) drawTowerAny(g, t); const flags = STATS.pennants - p0;
        A.towers = TOWERS.length === 19 && count(tl, TOWER) === 189 && flags === 19; A.towerInfo = { towers: TOWERS.length, tiles: count(tl, TOWER), pennants: flags }; }
      // KEEP: mounted at 15 x 12, one throne, seven carpet tiles, four pillars inside
      { const b = BUILDINGS.find(o => o.id === 'aer_keep'); let throne = 0, rug = 0, pillars = 0;
        if (b) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { if (kindAt(x, y) === 'throne') throne++; if (tl[y * W + x] === T.RUG) rug++; if (x > b.x && x < b.x + b.w - 1 && y > b.y && y < b.y + b.h - 1 && tl[y * W + x] === T.CWALL) pillars++; }
        A.keep = !!b && b.w === 15 && b.h === 12 && throne === 1 && rug === 7 && pillars === 4; A.keepInfo = { mounted: !!b, throne, rug, pillars }; }
      A.spires = count(tl, SPIRE) === 5 && SPIRES.length === 5;
      A.gates = GATES.length === 5 && count(tl, GATE) === 9;
      A.fountains = FOUNTAINS.length === 2 && count(tl, FOUNTAIN) === 18;
      A.buildings = mounted() === 12;
      // ROADS: 1,582 paving stones, and from the Great Gate the streets (with gates, bridges, doors, floors, carpet, lawn and flower beds) reach every door and every gate
      { const road = new Set([PAVE, GATE, BRIDGE, T.DOOR, T.FLOOR, T.RUG, LAWN, BLOOM]); const d = flood(tl, 48, 61, t => road.has(t));
        const doors = AER_BUILDINGS.map(b => PLAN.doorOf(b)).filter(([x, y]) => d[y * W + x] >= 0).length;
        const gates = SP.gateCells.filter(([x, y]) => d[y * W + x] >= 0).length;
        A.roads = count(tl, PAVE) === 1582 && doors === 12 && gates === 9; A.roadInfo = { pave: count(tl, PAVE), doors, gates }; }
      A.bridges = PLAN.BRIDGES.length === 8 && count(tl, BRIDGE) === 73;
      // PARKS: the lawns, trees, hedges, pond, flower beds, benches and the well; the maze's middle only through its gate
      { let trees = 0, hedges = 0, benches = 0, wells = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = kindAt(x, y); if (k === 'tree') trees++; else if (k === 'hedge') hedges++; else if (k === 'bench' || k === 'pew') benches++; else if (k === 'well') wells++; }
        const open = flood(tl, SP.entry[0], SP.entry[1], walkable), shut = flood(tl, SP.entry[0], SP.entry[1], (t, x, y) => walkable(t) && !(x === SP.mazeGate[0] && y === SP.mazeGate[1]));
        const mid = SP.larkMaze[1] * W + SP.larkMaze[0];
        A.parks = count(tl, LAWN) === 469 && trees === 24 && hedges === 71 && count(tl, POND) === 18 && count(tl, BLOOM) === 17 && benches === 9 && wells === 1 && open[mid] > 0 && shut[mid] === -1;
        A.parkInfo = { lawn: count(tl, LAWN), trees, hedges, pond: count(tl, POND), bloom: count(tl, BLOOM), benches, wells, maze: open[mid], mazeShut: shut[mid] }; }
      // DECORATIONS: lamps, planters, statues, the awninged stalls, banners on the wall, pennants on the towers
      { let lamps = 0, planters = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = kindAt(x, y); if (k === 'lamp') lamps++; else if (k === 'planter') planters++; }
        const a0 = STATS.awnings, { g } = recorder(); for (const [sx, sy] of SP.stalls) drawAwning(g, sx, sy); const awnings = STATS.awnings - a0;
        const banners = SP.banners.filter(([x, y]) => tl[y * W + x] === WALL).length;
        A.decor = lamps === 26 && planters === 10 && count(tl, T.WIND_STATUE) === 4 && awnings === 4 && SP.stalls.length === 4 && banners === 12 && SP.banners.length === 12 && A.towerInfo.pennants === 19;
        A.decorInfo = { lamps, planters, statues: count(tl, T.WIND_STATUE), awnings, banners }; }
      check(K + "K3 Cohen's list: walls (160, a closed ring), towers (19, 189 tiles, a pennant each), the keep (15x12, throne, carpet, 4 pillars), spires (5), gates (5 over 9 tiles), fountains (2), buildings (12), roads (1,582 paving reaching every door and gate), bridges (8, 73 tiles), parks and decorations",
        A.walls && A.towers && A.keep && A.spires && A.gates && A.fountains && A.buildings && A.roads && A.bridges && A.parks && A.decor, A); }

    // ---- K4. everything on foot from the Wind Landing, without an updraft ----
    { const tl = inst().tiles, d = flood(tl, SP.entry[0], SP.entry[1], walkable), miss = [];
      const need = (name, x, y) => { if (reachAt(d, x, y) < 0) miss.push(name + '@' + x + ',' + y); };
      for (const p of PEOPLE) need(p.name, p.x, p.y);
      for (const b of AER_BUILDINGS) { const [x, y] = PLAN.doorOf(b); need(b.id + ' door', x, y); }
      need('the rail spot', SP.railSpot[0], SP.railSpot[1]); need('the Songstone', SP.songstone[0], SP.songstone[1]); need('Skyla', SP.skyla[0], SP.skyla[1]);
      need('Seraphel', SP.seraphel[0], SP.seraphel[1]); need('Halcyon', SP.halcyon[0], SP.halcyon[1]); need('Pell', SP.pell[0], SP.pell[1]); need('Quill', SP.quill[0], SP.quill[1]); need('Ferris', SP.ferris[0], SP.ferris[1]);
      for (const [x, y] of SP.perches) need('perch', x, y);
      for (const [x, y] of SP.snags) need('snag', x, y);
      for (const [x, y] of SP.wisps) need('wisp', x, y);
      for (const s of PLAN.DRAFTS.concat(PLAN.ROYAL)) need('updraft', s.t[0], s.t[1]);
      // one side of every prop there is something to use on: garden, props, fountains, the pond, spires, statues, stalls, braziers, nests
      const usable = new Set([GARDEN, PROP, FOUNTAIN, POND, SPIRE, TOWER, WALL, T.WIND_STATUE, T.WIND_STALL, T.SKY_BRAZIER, T.NEST_HOUSE, T.HAWK_PERCH, T.SONGSTONE, T.CLOUD_SNAG]);
      const groups = {}; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = tl[y * W + x]; if (!usable.has(t)) continue; const f = t === FOUNTAIN ? fountainAt(x, y) : null; const key = f ? 'fountain ' + f.id : t === POND ? 'pond' : t === TOWER ? 'tower ' + (TOWERS.find(o => o.kind === 'gate' ? x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1 : Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1) || {}).x + ',' + y : x + ',' + y; (groups[key] = groups[key] || []).push([x, y]); }
      // a tower is one prop however many tiles it covers; a hedge in the middle of a hedge row is part of the row
      const lone = []; for (const key in groups) if (!groups[key].some(([x, y]) => reachAt(d, x, y) > 0)) lone.push(key);
      const loneOk = lone.every(key => { const [x, y] = groups[key][0]; return kindAt(x, y) === 'hedge' || tl[y * W + x] === TOWER || tl[y * W + x] === WALL; });
      const sera = d[SP.seraphel[1] * W + SP.seraphel[0]], pell = d[SP.pell[1] * W + SP.pell[0]];
      let total = 0; for (let i = 0; i < W * H; i++) if (d[i] >= 0) total++;
      check(K + 'K4 on foot from the Wind Landing with no updraft: every resident, all 12 doors, the Long Rail, the Songstone, the perches, snags, wisps, updraft stones and a side of every prop; the Queen is 46 tiles away and Pell 107',
        miss.length === 0 && loneOk && sera === 46 && pell === 107 && total === 3958, { miss: miss.slice(0, 6), lone: lone.filter((k, i) => i < 6), loneOk, sera, pell, total }); }

    // ---- K5. the buildings never leak out of Aerie ----
    { leave(); render();
      const idsOf = () => BUILDINGS.map(b => b.id).filter(Boolean).sort().join(',');
      const ids0 = idsOf(), n0 = BUILDINGS.length, marks0 = (MARKERS.all ? MARKERS.all() : []).map(m => m.key).sort().join('|');
      const r = { outside: mounted() };
      enter(); r.inside = mounted();
      INSTANCES.leave(); r.leaveApi = mounted();
      enter(); F.press('KeyL'); r.keyL = mounted() + (INSTANCES.active() ? 100 : 0);
      enter(); window.__forceTouch = true; render(); const clicked = F.clickButton('LEAVE'); window.__forceTouch = snap.touch; r.button = mounted() + (INSTANCES.active() ? 100 : 0) + (clicked ? 0 : 1000);
      enter(); { const keep = deathKeep, deaths = player.deaths; hurtPlayer(player.maxHp + 999, player.x + 10, player.y, true); F.sim(200, []); r.death = mounted() + (INSTANCES.active() ? 100 : 0) + (player.dead ? 1000 : 0); deathKeep = keep; player.deaths = deaths; restoreKit(); }
      leave(); save();
      enter(); { const ok = load(); F.sim(2, []); r.load = mounted() + (INSTANCES.active() ? 100 : 0) + (ok ? 0 : 1000); }
      // a new game from inside Aerie; newGame deletes the save, so the slot is copied first and put back to load it again
      enter(); { const sk = 'fanglands.slot.' + title.slot, raw = localStorage.getItem(sk), at = localStorage.getItem(sk + '.at');
        F.newGame(); F.sim(2, []); r.newGame = mounted() + (INSTANCES.active() ? 100 : 0); r.kingdomReset = !!quest.kingdom && quest.kingdom.stage === 0 && quest.kingdom.wishes === 0;
        r.store = BUILDINGS.some(b => b.x === 90 && b.y === 20);
        if (raw != null) { localStorage.setItem(sk, raw); if (at != null) localStorage.setItem(sk + '.at', at); localStorage.setItem('fanglands.slot.current', String(title.slot)); }
        r.reloaded = raw != null && load(); F.sim(2, []); h.peace(true); if (player.companion && typeof player.companion === 'object') player.companion.downT = 999; }
      r.same = idsOf() === ids0 && BUILDINGS.length === n0 && (MARKERS.all ? MARKERS.all() : []).map(m => m.key).sort().join('|') === marks0;
      A5 = r;
      check(K + 'K5 the twelve buildings are only ever in Aerie: none outside, 12 inside, and none again after INSTANCES.leave, the L key, the LEAVE button, dying, loading and a new game; the Thistledown store is back and the overworld buildings and markers are exactly as before',
        r.outside === 0 && r.inside === 12 && r.leaveApi === 0 && r.keyL === 0 && r.button === 0 && r.death === 0 && r.load === 0 && r.newGame === 0 && r.store && r.reloaded && r.same, r); }

    // ---- K6. the roof lifts off the building you stand in ----
    enter();
    { F.tp(48, 33); F.step([]); const inKeep = buildingAt(48, 33) && buildingAt(48, 33).id === 'aer_keep';
      const d0 = STATS.drawn.aer_keep || 0; render(); const inside1 = (STATS.drawn.aer_keep || 0) - d0;
      F.tp(48, 40); F.step([]); const d1 = STATS.drawn.aer_keep || 0; render(); const outside1 = (STATS.drawn.aer_keep || 0) - d1;
      check(K + "K6 the keep's roof lifts: standing in the hall at (48,33) the keep is not drawn over you; from the plaza at (48,40) it is",
        !!inKeep && inside1 === 0 && outside1 === 1, { inKeep: !!inKeep, inside: inside1, outside: outside1 }); }

    // ---- K7. you walk behind the tall things ----
    { F.tp(44, 39); F.step([]); const items = capture();
      const spire = items.find(i => i.spire === 'The West Twin Spire'), me = items.find(i => Math.abs(i.y - (player.y + player.r)) < 0.01 && !i.spire);
      check(K + 'K7 at (44,39), just north of the West Twin Spire, the spire is drawn after the knight (he stands behind it)',
        !!spire && !!me && spire.y > me.y && items.indexOf(spire) > items.indexOf(me), { spire: spire && spire.y, knight: me && me.y }); }

    // ---- K8. the gates lift for knights and never let a monster through ----
    { const G0 = PLAN.GATES[0];
      F.tp(48, 65); F.sim(40, []); const far = LIFT.great;
      F.tp(48, 62); F.sim(40, []); const near = LIFT.great;
      const solid = !solidFor(GATE, 'player') && !solidFor(GATE, 'person') && solidFor(GATE, 'beast');
      F.tp(48, 66); F.sim(60, []); const down = LIFT.great;
      const name = '__kingdom_test_knight';
      PLAYERS.remote[name] = { n: name, map: 'aerie', x: tc(48), y: tc(60), shown: { x: tc(48), y: tc(60) }, facing: { x: 0, y: 1 }, moving: false, walkT: 0, hp: 10, mhp: 10, lv: 3, look: null, mech: null, dead: false, act: null, hurtT: 0, attackT: 0, r: 13, lastAt: nowMs() };
      F.sim(40, []); const friend = LIFT.great;
      delete PLAYERS.remote[name]; F.sim(60, []); const after2 = LIFT.great;
      check(K + 'K8 the Great Gate is down with nobody near (4 tiles), lifts for a knight within a tile (40 frames), lifts for a friend online too; knights and people walk through a gate, monsters never',
        G0.id === 'great' && far === 0 && near >= 0.95 && solid && down === 0 && friend >= 0.95 && after2 === 0 && !(name in PLAYERS.remote), { far, near, solid, down, friend, after: after2 }); }

    // ---- K9. a coin in the fountain ----
    { const c0 = coins(), f = FOUNTAINS[0], w0 = Q().wishes;
      setCoins(5); drain(); F.tp(48, 46); F.face(48, 45); F.press('KeyE'); F.sim(2, []);
      const lines1 = said().map(d => d.text);
      const tossed = coins() === 4 && Q().wishes === w0 + 1 && lines1[0] === f.line && lines1.includes('You toss 1 coin in and make a wish. You have 4 coins left.');
      setCoins(0); drain(); F.face(48, 45); F.press('KeyE'); F.sim(2, []);
      const none = said().some(d => d.text === 'You have no coin to toss. The fountain does not mind.') && Q().wishes === w0 + 1;
      // the spray is placed by the clock: the same fountain half a second apart draws its drops somewhere else
      const t0 = time, spray = at => { time = at; const { g, log } = recorder(); drawFountain(g, f); return JSON.stringify(log.filter(([k]) => k === 'arc').slice(-24)); };
      const s1 = spray(t0), s2 = spray(t0 + 0.5); time = t0;
      setCoins(c0);
      check(K + 'K9 a coin in the Royal Fountain: with 5 coins you toss one (4 left, a wish counted, the line says so); with none it says so; the spray moves with the clock',
        tossed && none && s1 !== s2, { tossed, none, lines: lines1.slice(0, 2), sprayMoves: s1 !== s2 }); }

    // ---- K10. every new thing says its own line on E, and a tap on the fountain says the same ----
    { const PROBES = [
        ['The Royal Fountain', 48, 46, 48, 45], ['The Market Fountain', 69, 48, 69, 47], ['The Mirror Pond', 37, 17, 37, 16], ['A hedge', 22, 23, 21, 23], ['A cloudblossom tree', 23, 15, 23, 14],
        ['A planter', 39, 25, 39, 24], ['A bench', 37, 17, 36, 17], ['A pew', 68, 27, 67, 27], ['A sky lamp', 47, 14, 46, 14], ['The Sky Throne', 47, 27, 48, 28], ['The Wishing Well', 26, 55, 26, 54],
        ['The Garden Folly', 32, 17, 32, 16], ['The Bell Spire', 75, 28, 75, 27], ['The West Twin Spire', 44, 41, 44, 40], ['The East Twin Spire', 52, 41, 52, 40], ['The Span Spire', 19, 39, 19, 38],
        ['A wall tower', 18, 12, 17, 12], ['The city wall', 17, 14, 16, 14], ['The Great Gate', 48, 62, 48, 61], ['The Flight Gate', 48, 12, 48, 11], ['The Crown Gate', 78, 17, 79, 17], ['The Spire Gate', 72, 60, 72, 61], ['The Postern', 17, 55, 16, 55],
        ['A bridge', 48, 51, 48, 50] ];
      const c0 = coins(); setCoins(3); const bad = [];
      for (const [who, sx, sy, fx, fy] of PROBES) {
        closePanel(); drain(); F.tp(sx, sy); F.step([]); F.face(fx, fy); F.press('KeyE'); F.sim(1, []);
        const l = lineFor(tileAt(fx, fy), fx, fy), d = said()[0];
        if (!l || !d || d.who !== who || d.text !== l[1]) bad.push(who + ': ' + (d ? d.who + ' | ' + d.text.slice(0, 40) : 'nothing'));
      }
      // a tap on the middle of the Royal Fountain: walk to its rim and use it
      closePanel(); drain(); F.tp(46, 44); F.step([]); drain(); F.face(47, 44); F.press('KeyE'); F.sim(1, []); const eLine = firstLine();
      closePanel(); drain(); F.tp(42, 44); F.step([]); drain(); screenTap(tc(48), tc(44)); const tapKind = tap.kind; untilTapDone(); const tLine = firstLine();
      setCoins(c0);
      check(K + 'K10 E on every new kind of thing says its own line (2 fountains, the pond, hedge, tree, planter, bench, pew, lamp, throne, well, 5 spires, a tower, the wall, 5 gates, a bridge), and a tap on the Royal Fountain walks there and says what E says',
        bad.length === 0 && tapKind === 'use' && !!eLine && tLine === eLine, { bad, tapKind, eLine, tLine }); }

    // ---- K11. the people ----
    { const E_AT = { aldric: [48, 58], tamsin: [66, 53], mossbeard: [28, 20], aubade: [69, 27], corvin: [56, 18], merriweather: [22, 42], orla: [46, 32], brisk: [50, 32] };
      const TAP_AT = { aldric: [48, 60], tamsin: [65, 55], mossbeard: [30, 21], aubade: [69, 29], corvin: [54, 18], merriweather: [24, 43], orla: [46, 34], brisk: [50, 34] };
      const k0 = JSON.stringify(Q()), diff = [];
      for (const p of PEOPLE) {
        quest.kingdom = JSON.parse(k0); closePanel(); drain(); F.tp(E_AT[p.id][0], E_AT[p.id][1]); F.step([]); F.face(p.x, p.y); F.press('KeyE'); F.sim(1, []); const e = firstLine();
        quest.kingdom = JSON.parse(k0); closePanel(); drain(); F.tp(TAP_AT[p.id][0], TAP_AT[p.id][1]); F.step([]); drain(); screenTap(p.px, p.py); const kind = tap.kind; untilTapDone(); const t = firstLine();
        if (!e || e !== t || kind !== 'person') diff.push(p.id + ': ' + e + ' / ' + kind + ' ' + t);
      }
      quest.kingdom = JSON.parse(k0); closePanel(); drain();
      // the walkers: a pure function of the clock, on walkable ground at every sample, moving, and never on top of anybody who stands still
      const tl = inst().tiles, KEEP = PEOPLE.map(p => [p.x, p.y]).concat([SP.larkMaze, SP.larkWait, SP.larkPlaza, SP.larkRail, SP.mazeGate, SP.railSpot, SP.seraphel, SP.halcyon], PLAN.ROYAL.map(r => r.t), SKYCITY.SKY_NPCS.map(n => [n.x, n.y]), AERIE.FOLK.map(n => [n.x, n.y]));
      let pure = true, onGround = true, moves = true, keepOut = true; const where = [];
      PLAN.WALKERS.forEach((w, i) => {
        const L = routeLen(w), period = (w.loop ? L : 2 * L) / w.speed * 1000;
        if (JSON.stringify(walkerAt(i, 123456)) !== JSON.stringify(walkerAt(i, 123456))) pure = false;
        const a = walkerAt(i, 5000), b = walkerAt(i, 7000); if (Math.hypot(a.x - b.x, a.y - b.y) < 0.5) moves = false;
        for (let s = 0; s < 200; s++) {
          const p = walkerAt(i, s * period / 200), tx = Math.floor(p.x + 0.5), ty = Math.floor(p.y + 0.5);
          if (SOLID.has(tl[ty * W + tx])) { onGround = false; where.push(w.id + ' on ' + tx + ',' + ty); }
          for (const [kx, ky] of KEEP) if (Math.max(Math.abs(p.x - kx), Math.abs(p.y - ky)) < 2) { keepOut = false; where.push(w.id + ' near ' + kx + ',' + ky); break; }
        }
      });
      check(K + 'K11 the people: every resident says the same first line to E and to a tap; the walkers are a pure function of the clock, move, stay on walkable ground at 200 samples a round, and never come within 2 tiles of anyone standing',
        diff.length === 0 && pure && onGround && moves && keepOut, { diff: diff.slice(0, 4), pure, onGround, moves, keepOut, where: where.slice(0, 4) }); }

    // ---- K12. the whole story, played by the harness ----
    { quest.sky = { stage: 'done', wisps: 0, forged: 0 }; quest.kingdom = { stage: 0, wishes: 0, seen: {} }; featherOff(); LARK_LOG.length = 0;
      enter(); const r = {};
      const talkTo = (sx, sy, fx, fy) => { closePanel(); drain(); F.tp(sx, sy); F.step([]); F.face(fx, fy); F.press('KeyE'); F.sim(2, []); };
      talkTo(48, 30, 48, 29);
      r.opened = Q().stage === 1 && activeQuests().includes('lark') && levelBanner && levelBanner.sub === "Lark's First Flight";
      { const t = mapTargets().find(o => o.id === 'lark'); r.targetIn = !!t && t.x === SP.aldric[0] && t.y === SP.aldric[1]; }
      leave(); { const t = mapTargets().find(o => o.id === 'lark'); r.targetOut = !!t && t.x === 62 && t.y === 6;
        const c = PLAYTHROUGH.connectivity(), rows = c.rows.filter(o => o.x === 62 && o.y === 6); r.audit = rows.length > 0 && rows.every(o => o.open >= 0) && c.unreachable.length === 0; }
      enter();
      talkTo(48, 58, 48, 57); r.aldric = Q().stage === 2;
      talkTo(66, 53, 66, 54); r.tamsin = Q().stage === 3 && panel !== 'shop'; closePanel();
      talkTo(28, 20, 28, 19); r.mossbeard = Q().stage === 4;
      F.tp(26, 21); F.step([]); r.maze = typeof F.walkTo(26, 27) === 'number';
      F.walkTo(27, 27); drain(); F.face(26, 27); F.press('KeyE'); F.sim(2, []);
      r.found = Q().stage === 5 && LARK.mode === 'follow' && !!levelBanner && levelBanner.text === 'LARK FOLLOWS YOU';
      // she follows: through the maze and out of its gate, then 15 tiles and more along the Garden Walk
      F.walkTo(26, 21); F.walkTo(41, 18); F.sim(40, []);
      r.heel = dist(LARK.px, LARK.py, player.x, player.y) <= 2 * TILE;
      F.walkTo(48, 20); F.sim(20, []);
      const fired = () => WALK_LINES.filter(m => LARK_LOG.filter(l => l === m.line).length === 1).length;
      r.threeLines = fired() >= 3;
      F.walkTo(48, 12); F.walkTo(48, 5); F.walkTo(49, 2); F.sim(90, []);
      r.allFive = fired() === 5 && WALK_LINES.every(m => LARK_LOG.filter(l => l === m.line).length === 1);
      r.atRail = LARK.mode === 'rail' && dist(LARK.px, LARK.py, tc(SP.larkRail[0]), tc(SP.larkRail[1])) < 8;
      // on the balcony: the flight
      const slots0 = player.inv.filter(s => s && s.id === 'lark_feather').length;
      F.walkTo(51, 2); drain(); F.face(52, 2); F.press('KeyE'); r.scene = SCENE.active;
      F.sim(Math.ceil(8 * 60), []);
      r.flew = Q().stage === 6 && KEYRING.held('lark_feather') && countItem('lark_feather') === 1 && player.inv.filter(s => s && s.id === 'lark_feather').length === slots0 && !!levelBanner && levelBanner.text === 'FIRST FEATHER';
      // back to the Queen
      const c0 = coins(), d0 = drops.length;
      talkTo(48, 30, 48, 29);
      r.done = Q().stage === 'done' && (coins() - c0 === 250 || drops.slice(d0).some(o => o.id === 'coins' && o.qty === 250)) && !!levelBanner && levelBanner.text === 'LARK FLIES' && !activeQuests().includes('lark');
      // a second run, from stage 1: Lark found first jumps straight to 5
      quest.kingdom = { stage: 1, wishes: 0, seen: {} }; larkFromStage();
      F.tp(27, 27); F.step([]); drain(); F.face(26, 27); F.press('KeyE'); F.sim(2, []);
      r.shortcut = Q().stage === 5 && LARK.mode === 'follow';
      check(K + "K12 Lark's First Flight, played through: the Queen opens it (map target Aldric inside, the shrine outside, the audit walks to it), Aldric, Tamsin (no shop at that beat), Mossbeard, the maze, Lark follows at the heel and says all 5 lines once each, flies from the Long Rail (feather on the keyring, no pack slot), the Queen pays exactly 250; and Lark found early jumps to stage 5",
        Object.values(r).every(Boolean), r); }

    // ---- K12b. Lark while she follows: an updraft, falling behind, leaving Aerie ----
    { quest.kingdom = { stage: 5, wishes: 0, seen: { maze: true, pond: true, kingsway: true, flightgate: true, bridge: true } }; LARK_LOG.length = 0;
      enter(); const r = {};
      // she stands at his heel, a tile and a bit behind him (east), while he faces the stone (west)
      F.tp(45, 68); F.step([]); startFollow(); LARK.px = player.x + HEEL; LARK.py = player.y; F.sim(5, []);
      drain(); F.face(44, 68); F.press('KeyE'); F.sim(10, []);
      r.draftLine = LARK_LOG.includes('Hey! No flying yet. That is my job.') && dist(LARK.px, LARK.py, player.x, player.y) <= 2 * TILE && tileOf().tx >= 90;
      // she falls 13 tiles behind: one call, then she catches up along the way he came
      F.tp(48, 51); startFollow(); LARK.px = player.x - 13 * TILE; LARK.py = player.y; F.sim(1, []);
      const called = LARK_LOG.filter(l => l === 'Wait for me! Walking is slow!').length;
      F.sim(240, []);
      r.farLine = called === 1 && LARK_LOG.filter(l => l === 'Wait for me! Walking is slow!').length === 1 && dist(LARK.px, LARK.py, player.x, player.y) <= 2 * TILE;
      // he leaves Aerie: she waits inside the Flight Gate and follows again once he is within 2 tiles
      drain(); INSTANCES.leave(); F.sim(2, []);
      r.waitLine = said().some(d => d.who === 'Lark' && d.text === 'I will wait inside the Flight Gate. Come back?');
      enter(); r.waiting = LARK.mode === 'wait' && Math.floor(LARK.px / TILE) === SP.larkWait[0] && Math.floor(LARK.py / TILE) === SP.larkWait[1];
      F.tp(SP.larkWait[0], SP.larkWait[1] + 2); F.sim(2, []); r.again = LARK.mode === 'follow';
      check(K + 'K12b following Lark: an updraft ride gets "No flying yet" and she jumps to your side; 13 tiles behind she calls "Wait for me!" once and catches up; leave Aerie and she waits inside the Flight Gate at (48,15), following again within 2 tiles',
        Object.values(r).every(Boolean), r); }

    // ---- K13. the gold updraft stones and Lark's flight panel ----
    { quest.kingdom = { stage: 'done', wishes: 0, seen: {} }; larkFromStage(); featherOff(); closePanel();
      enter(); const r = {};
      F.tp(51, 68); F.step([]); drain(); const p0 = { x: player.x, y: player.y }; F.face(52, 68); F.press('KeyE'); F.sim(1, []);
      r.refused = said().some(d => d.text === REFUSE_LINE) && panel !== 'lark_flight' && player.x === p0.x && player.y === p0.y;
      closePanel(); drain(); giveOrDrop('lark_feather', 1, player.x, player.y); drain();
      F.face(52, 68); F.press('KeyE'); r.opened = panel === 'lark_flight'; render();
      r.buttons = DESTS.every(d => buttons.some(b => b.label === d.name)) && DESTS.length === 6;
      const landed = [];
      for (const d of DESTS) {
        closePanel(); drain(); F.tp(41, 45); F.step([]); F.face(40, 45); F.press('KeyE'); render();
        const ok = panel === 'lark_flight' && F.clickButton(d.name); F.step([]);
        const t = tileOf(), w = PLAN.wardAt(t.tx, t.ty);
        landed.push(ok && !SOLID.has(tileAt(t.tx, t.ty)) && !!w && w.name === d.ward && (d.id !== 'plaza' || (Math.abs(t.tx - 41) <= 1 && Math.abs(t.ty - 45) <= 1)) ? true : d.name + '@' + t.tx + ',' + t.ty);
      }
      r.landed = landed.every(v => v === true);
      // on a narrow screen the six stack in one column, every button 44 px tall or more
      { const keep = buttons.length, { g } = recorder(); HOOKS.panel.lark_flight(g, true); const mine = buttons.slice(keep).filter(b => DESTS.some(d => d.name === b.label) || b.label === 'Close'); buttons.length = keep;
        r.narrow = mine.length === 7 && new Set(mine.map(b => Math.round(b.x))).size === 1 && mine.every(b => b.h >= 44); }
      closePanel(); drain();
      check(K + "K13 the gold stones: without Lark's feather they refuse and you stay put; with it either stone opens 'Where to, knight?' with 6 places, each landing on walkable ground in its ward (the Royal Plaza at 41,45); one column of 44 px buttons on a narrow screen",
        Object.values(r).every(Boolean), Object.assign(r, { landed })); }

    // ---- K14. the Song comes first ----
    { quest.kingdom = { stage: 0, wishes: 0, seen: {} }; featherOff(); enter(); const r = {}; const Qn = SKYCITY.SKY_NPCS[0];
      const ask = () => { closePanel(); drain(); F.tp(Qn.x, Qn.y + 1); F.step([]); F.face(Qn.x, Qn.y); F.press('KeyE'); F.sim(2, []); return said().map(d => d.text); };
      player.inv = player.inv.map(s => s && s.id === 'coins' ? s : null);      // the kit comes back at the end (restoreKit)
      sky().stage = 0; let l = ask(); r.s0 = Q().stage === 0 && sky().stage === 2 && /A knight, carried up/.test(l[0] || '');
      sky().stage = 1; l = ask(); r.s1 = Q().stage === 0 && sky().stage === 2 && /A knight, carried up/.test(l[0] || '');
      l = ask(); r.s2 = Q().stage === 0 && sky().stage === 2 && /Five dragon scales and three cloud essence/.test(l[0] || '');
      h.give('dragon_scale', 5); h.give('cloud_essence', 3); const c0 = coins(), d0 = drops.length;
      l = ask(); r.song = sky().stage === 'done' && Q().stage === 0 && (coins() - c0 === 400 || drops.slice(d0).some(o => o.id === 'coins' && o.qty === 400));
      l = ask(); r.lark = Q().stage === 1 && /You gave Aerie its Song back/.test(l[0] || '');
      check(K + "K14 the Song comes first: at Song stages 0, 1 and 2 (without the scales) the Queen says only her Song lines and Lark's story stays at 0; with 5 scales and 3 essence she sings (400 coins); only the next talk asks for Lark",
        Object.values(r).every(Boolean), r); }

    // ---- K15. ward banners ----
    { leave(); enter(); const r = { entry: !!areaBanner && areaBanner.name === 'Aerie' };
      F.tp(48, 53); F.step([]); F.sim(Math.ceil(3.3 * 60), []); r.quiet = !(areaBanner && areaBanner.name === 'The Market Ward');
      F.walkTo(51, 53); F.sim(2, []); r.market = !!areaBanner && areaBanner.name === 'The Market Ward' && areaBanner.sub === 'The Windward Market and the sky forge' && player.region === 'Aerie';
      check(K + "K15 ward banners: entering Aerie leaves the AERIE banner up; walking into the Market Ward after 3.2 s names it; the knight's region is still Aerie",
        Object.values(r).every(Boolean), r); }

    // ---- K16. no new monsters ----
    { leave(); enter(); F.sim(200, []);
      const types = monsters.map(m => m.type);
      check(K + 'K16 Aerie keeps exactly its four sky sentinels: after 200 frames there are 4 monsters, all sky sentinels, and no walker or Lark among them',
        monsters.length === 4 && types.every(t => t === 'sky_sentinel') && !monsters.some(m => m === LARK || WALKERS.includes(m)), { types }); }

    // ---- K17. saves ----
    { leave(); const k1 = { stage: 3, wishes: 7, seen: { aubade: true, pond: true } };
      quest.kingdom = JSON.parse(JSON.stringify(k1)); save(); quest.kingdom = { stage: 0, wishes: 0, seen: {} }; const ok = load(); F.sim(1, []);
      const kept = ok && JSON.stringify(quest.kingdom) === JSON.stringify(k1);
      check(K + 'K17 quest.kingdom survives a save and load exactly, and a new game resets it to stage 0 with no wishes',
        kept && A5 && A5.kingdomReset === true, { kept, reset: A5 && A5.kingdomReset }); }

    // ---- K18. the Cloud Oven ----
    { leave(); const S = SHOPS.aerie_bakery, m = OVEN_MARK;
      const stock = S && JSON.stringify(S.stock) === JSON.stringify([['bread', 12], ['berry_pie', 40], ['fish_pie', 46]]);
      const above = S && S.stock.every(([id, p]) => ITEMS[id] && p > ITEMS[id].value);
      const onMap = !!m && (MARKERS.all ? MARKERS.all() : []).some(o => o.label === 'The Cloud Oven' && o.kind === 'shop' && o.x === m.x && o.y === m.y) && !SOLID.has(tileAt(m.x, m.y));
      check(K + "K18 the Cloud Oven sells bread 12, berry pie 40 and fish pie 46 (every price above what the item is worth), and its shop mark stands on walkable ground by the wind shrine",
        S && S.name === 'The Cloud Oven' && stock && above && onMap && m.x === 63 && m.y === 7, { stock, above, onMap, mark: m && [m.x, m.y] }); }

    // ---- K19. the feather's icon ----
    { const a = ICONS.audit();
      check(K + "K19 icons: every item still draws its own picture (0 missing, 0 shared) and Lark's first feather has its own art",
        a.missing.length === 0 && a.duplicates.length === 0 && ICONS.has('lark_feather'), { missing: a.missing.slice(0, 5), shared: a.duplicates.slice(0, 5) }); }

    // ---- K20. the book ----
    { const d = WIKI.rebuild(), text = (WIKI.lines('places', 'aerie') || []).map(l => typeof l === 'string' ? l : (l && (l.t || l.text)) || '').join('\n');
      const names = AER_BUILDINGS.every(b => text.includes(b.name)) && text.split('\nHouse, in ').length - 1 === AER_BUILDINGS.filter(b => b.name === 'House').length;
      const folk = PEOPLE.every(p => text.includes(p.name)) && text.includes('Lark') && WALKERS.every(w => text.includes(w.name));
      check(K + "K20 the wiki: the Aerie page names all 12 buildings and everybody who lives there; Lark's First Flight and Lark's first feather have pages",
        names && folk && !!d.quests.lark && !!d.items.lark_feather && !!d.places.aerie, { names, folk, quest: !!d.quests.lark, item: !!d.items.lark_feather }); }

    // ---- K21. the sky curtain ----
    { enter(); const iw = window.innerWidth, ih = window.innerHeight, c0 = STATS.curtain;
      window.innerWidth = 1920; window.innerHeight = 1080; F.tp(97, 9); F.step([]);
      // world things sort by where they stand (the ground layers, the pixel rows, the air at 5e7); the overlays at 1e9 are
      // screen-wide light and night, drawn over the curtain on purpose so the edge is lit like the rest
      const items = capture(), cur = items.find(i => i.curtain), top = Math.max(...items.filter(i => i !== cur && i.y < 9e8).map(i => i.y));
      const past = NPCS.filter(n => n.px >= W * TILE && n.px > cam.x - 60 && n.px < cam.x + VW + 60 && n.py > cam.y - 60 && n.py < cam.y + VH + 60);
      const pastUnder = past.every(n => items.some(i => Math.abs(i.y - (n.py + 13)) < 0.01 && items.indexOf(i) < items.indexOf(cur)));
      const issued = !!cur && STATS.curtain > c0 && cur.y > top && pastUnder;
      window.innerWidth = 1280; window.innerHeight = 800; F.tp(48, 40); F.step([]);
      const quiet = !capture().some(i => i.curtain);
      window.innerWidth = iw; window.innerHeight = ih; render();
      check(K + 'K21 the sky curtain: at (97,9) on a 1920x1080 screen it is drawn over every world thing (the edge of the whole map is further east than the edge of the city); at (48,40) on 1280x800 there is none',
        issued && quiet, { issued, curtainY: cur && cur.y, top, frames: STATS.curtain - c0, villagersPastTheEdge: past.map(n => n.name), pastUnder, quiet }); }

    // ---- K21b. what the overworld draws by coordinate stays out of Aerie (45's river crossing posts, 54's grave markers) ----
    { const crossHook = HOOKS.draw.find(f => /CROSSINGS/.test(String(f))), graveHook = HOOKS.draw.find(f => /MARKER_ART/.test(String(f)));
      const pushed = (hook, x, y) => { if (!hook) return -1; F.tp(x, y); render(); const items = [], { g } = recorder(); hook(g, items, cam); return items.length; };
      const posts = (window.PROGRESSION ? PROGRESSION.CROSSINGS : []).flatMap(c => [c.a, c.b]).filter(p => p.x < W && p.y < H);
      const graves0 = quest.graves; quest.graves = (Array.isArray(graves0) ? graves0.slice() : []).concat([{ x: 48, y: 40, g: 'cross' }]);
      leave(); const outside = { grave: pushed(graveHook, 48, 40), posts: posts.map(p => pushed(crossHook, p.x, p.y)) };
      enter(); const inside = { grave: pushed(graveHook, 48, 40), posts: posts.map(p => pushed(crossHook, p.x, p.y)) };
      quest.graves = graves0; if (graves0 === undefined) delete quest.graves;
      check(K + "K21b the overworld's things drawn by coordinate stay out of Aerie: a grave marker at (48,40) draws on the overworld and not on the Royal Plaza, and so do the river crossing posts inside the city's rectangle",
        !!graveHook && !!crossHook && outside.grave >= 1 && inside.grave === 0 && outside.posts.every(n => n >= 1) && inside.posts.every(n => n === 0), { outside, inside, posts: posts.length }); }

    // ---- put everything back ----
    leave(); closePanel(); drain(); tapCancel('manual');
    restoreKingdom(); restoreSky(); restoreKit(); larkFromStage(); CLOCK.fixed = null;
    // the loads in K5 and K17 hand back a companion object of their own: the one sitting now is whichever is live
    if (comp) { comp.downT = compDown; if (player.companion && typeof player.companion === 'object') player.companion.downT = compDown; }
    window.__forceTouch = snap.touch;
    player.x = snap.x; player.y = snap.y; h.peace(false);
  });
}
