// ============================================================================
// THE OLD BARROW — where Necromancy is taught (design: ~/.fanglands/work/necromancy/spec.md, sections 5 and 6)
// src/89-oldbarrow.js
//
// The reserved plot in the Wolfwood's west (Atlas anchor 'necromancy', box 66..81 x 106..119, the lych-gate at
// necromancy.door) is built now: the barrow mound with its stair down, a roofless chapel ruin with the Bone Altar,
// Granny Wick's cottage, a candle circle, old barrow graves, bone dummies, lanterns and a rail. Granny Wick, the
// barrow-keeper, and Rattle, the talking skull on his post, teach the skill (89-necromancy).
//
//   THE BARROW DEEP  the instance under the mound: the Candle Hall (the Lantern Watch, Necromancy's mini-game), the
//                    Ossuary, the King's Hall (the Barrow King) and the Sealed Vault (the Hollow, who drops the Void Scythe)
//   THE QUESTS       five stories with one thread: something has been scratching the names off the dead
//   THE GHOSTS       twelve to meet (Speak with the Dead: Ghostlight on, E on a ghost you can see)
//
// HOW IT IS BUILT (the Stage 5 way, as 85-riverside): ATLAS.markBuilt at load; in a HOOKS.built pass (its own mulberry32
// stream) the place's stakes and plaque come up, the plan is laid, the cottage and Granny Wick go in (out again in a
// HOOKS.world.unshift pass and a generateWorld wrapper), the stair down is placed (INSTANCES.placeDoor) and the rail
// post stands. No new tile: the solid things (the mound, the ruin, the altar, Rattle's post, the dummies, the lantern
// posts) stand on 95-thistledown's TD_PROP tile with a side table of their own, as 84-crossroads' well does; the candles
// and the old graves are DECO kinds. WORLD_REV 8 declares the footprint (ATLAS.REVS[8]).
//
// ONLINE (spec 7): nothing here writes the shared world. The Lantern Watch and the two bosses decide things only where
// !NET.online() || COOP.isKeeper() (the golem's pattern): the candles and the bell are harmless monsters whose hp and
// `state` already stream, the ropes and the bosses are HOOKS.bossCall ids. Every knight is paid on his own game from what
// he sees stream (the bell's state moving on, a boss's kill), never on another knight's word. Story changes (Tobias's
// stone, the lanterns, the names, the grave's line) are drawn from this knight's own quest flags.
// Instance-local numbers (the Barrow Deep's own map, and the Afterlands') are allow-listed in docs/spread/literals-allow.json.
// window.OLD_BARROW is the test handle.
// ============================================================================
const OLD_BARROW = (() => {
  const A = ATLAS, ID = 'necromancy', DEEP_ID = 'barrow_deep', C = NECRO.CHOICES;
  const Tn = n => (n in T ? T[n] : -1);
  A.markBuilt(ID, { sub: 'A barrow-chapel, and the keeper of the restless' });
  const BF = A.planFrame(ID);
  const RING = 6;
  const tiles = n => n * TILE;                       // tiles to pixels: a size or a reach, never a place
  const LIFT = { candle: 22, lamp: 46, head: 30 };   // pixels above a thing's feet where its light or tag sits
  const REACHES = [36, 62, 100];                      // how far in front of the knight E looks, in pixels
  const SEED = (() => { let h = 2166136261; for (const c of '89-oldbarrow') h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; })();
  const GRANNY = C.TEACHERS.keeper, RATTLE = C.TEACHERS.skull;

  // ---------- the plan: one glyph a tile, rows from the box's top-left (16 x 14) ----------
  //   #  the barrow mound (solid: a grassy hump with kerb stones)    D  the stair down (DUNGEON_DOOR into the Barrow Deep)
  //   S  a standing stone (T.STONECIRCLE)       l  a lantern post (lit at night)     r  the chapel ruin's broken wall
  //   H  Granny Wick's cottage (a BUILDINGS row)   d  its door    A  the Bone Altar    P  Rattle's post
  //   c  the candle circle (DECO, walkable, lit: spirit refills twice as fast)        ,  worn path (DIRT)
  //   t  an old barrow grave (DECO, flat)       b  a bone dummy (solid)              R  the rail post (HITCH)
  //   L  the lych-gate (a roofed gate drawn over open ground, at necromancy.door)      .  open ground (trees go)
  const PLAN = [
    '....########....',
    '..S.########.S..',
    '....########....',
    '....###D####....',
    '......l,l.......',
    'rrrrr..,...HHHH.',
    'r...r..,...HHHH.',
    'rA.P,,ccc..HHHH.',
    'r...r.c,c..HdHH.',
    'rr.rr.ccc...,...',
    '.tt....,,,,,,.b.',
    '.tt..l.,...l.bb.',
    '.tt....,......R.',
    '.......L........',
  ];
  // the points the place names (offsets in its own frame; 01-atlas's ports say the same on the map)
  const PT = {
    door: [7, 3], step: [7, 4], altar: [1, 7], rattle: [3, 7], granny: [9, 6], gate: [7, 13], circle: [7, 8],
    tobias: [2, 12],   // the old grave whose stone was taken: Tobias's spot (Q1)
    bramble: [7, 4],   // where the ghost dog sits by the mound (Q1)
  };
  const P = k => BF.p(PT[k][0], PT[k][1]);
  // Bramble's paw prints: from the mound's foot out past the box's north-east corner (inside box + 12), to the stone
  // lying face-down in the builders' spoil
  const TRAIL = [[7, 4], [9, 4], [11, 4], [13, 3], [15, 2], [17, 1], [19, 0], [21, -1], [23, -2], [24, -4], [25, -6]];
  const SPOIL = [25, -7];   // the stone, face-down
  const COTTAGE = BF.pt({ id: 'barrow_cottage', x: 11, y: 5, w: 4, h: 4, name: "Granny Wick's cottage", roof: '#4a4038', door: 1, f: [[T.BED, 1, 1], [T.TABLE, 2, 1]] });
  COTTAGE.oldbarrow = true;
  const GRANNY_NPC = BF.pt({ id: 'granny_wick', name: GRANNY, x: PT.granny[0], y: PT.granny[1], tunic: '#2f3a2a', hair: '#d8d4cc', woman: true, apron: true, role: 'barrow_keeper', shop: 'barrow_candles' });
  GRANNY_NPC.oldbarrow = true;

  // ---------- the footprint (spec 5.2): WORLD_REV 8 ----------
  const grow = (b, d) => [b[0] - d, b[1] - d, b[2] + d, b[3] + d];
  // the box with its ring, the paw-print trail and the spoil (cleared to open ground), and the road tiles the roads pass
  // (93-roads) lays differently now that the gate's ground has changed (measured by tools/spread-footprint.mjs)
  const TRAIL_BOX = () => { const xs = TRAIL.map(p => BF.x(p[0])).concat(BF.x(SPOIL[0])), ys = TRAIL.map(p => BF.y(p[1])).concat(BF.y(SPOIL[1])); return [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1]; };
  const FOOT = () => [grow(A.box(ID), RING), TRAIL_BOX()];
  if (A.REVS) A.REVS[8] = { stage: 'necromancy', by: '89-oldbarrow', why: 'the Old Barrow: its box with the 6-tile ring, and the paw-print trail to the builders\' spoil', boxes: FOOT() };

  // ---------- the solid things: idx -> { kind, under } on TD_PROP cells (made in the built pass) ----------
  const THINGS = new Map();
  const SOLID_T = () => Tn('TD_PROP');
  const KIND_OF = { '#': 'mound', r: 'ruin', A: 'altar', P: 'rattle', l: 'lantern', b: 'dummy' };
  const STATS = { stakes: 0, props: 0, deco: 0, cleared: 0 };
  let POST = null;

  // ---------- DECO kinds (walkable): the candle circle and the old graves ----------
  const ART = () => window.NECRO_ART || null;
  DECO.kind('barrow_candle', { flat: true, use: 'Granny Wick\'s candles. They help lost ghosts find their way to rest. Stand among them and your spirit comes back twice as fast.',
    draw(g, px, py, c, tx, ty) { const a = ART(); if (a) a.candleCell(g, px, py, tx, ty); } });
  DECO.kind('old_grave', { flat: true, use: (c, tx, ty) => graveWords(tx, ty),
    draw(g, px, py, c, tx, ty) { const a = ART(); if (a) a.oldGrave(g, px, py, tx, ty, tobiasHere(tx, ty)); } });
  const tobiasHere = (tx, ty) => { const [x, y] = P('tobias'); return tx === x && ty === y && B().q1 >= 9; };
  function graveWords(tx, ty) {
    const [x, y] = P('tobias');
    if (tx === x && ty === y) return B().q1 >= 9 ? 'Old Tobias, keeper of the barrow. His stone is home, and his dog sleeps on it.' : 'An empty place among the old graves, where a stone once stood.';
    return 'An old barrow grave. The name is moss now, but it was here once.';
  }

  // ---------- the pass (HOOKS.built: the finished land) ----------
  const unBuild = () => {
    THINGS.clear();
    for (let i = NPCS.length - 1; i >= 0; i--) if (NPCS[i].oldbarrow) NPCS.splice(i, 1);
    for (let i = BUILDINGS.length - 1; i >= 0; i--) if (BUILDINGS[i].oldbarrow) BUILDINGS.splice(i, 1);
  };
  HOOKS.world.unshift(unBuild);
  { const _generateWorld = generateWorld; generateWorld = function () { unBuild(); return _generateWorld.apply(this, arguments); }; }
  HOOKS.built.push((rnd0, api) => {
    const set = api.setTile, at = api.tileAt, rnd = mulberry32(SEED);
    const S = STATS; S.stakes = 0; S.props = 0; S.deco = 0; S.cleared = 0;
    const NATURE = new Set([T.TREE, T.OAK, T.ROCK, T.FLOWERS, T.MUSHROOM, Tn('FERN'), Tn('DEADTREE'), Tn('DEAD_TREE'), Tn('BERRY_BUSH')].filter(v => v >= 0));
    const KEEP = new Set(['IRON', 'COAL', 'SIGN', 'CHEST'].map(Tn).filter(v => v >= 0));
    // 1. the stakes and the plaque come up: each one's ground goes back
    const SG = window.SPREAD_GROUND;
    if (SG) for (const [i, p] of [...SG.PROPS]) if (p.place === ID) { set(i % MAP_W, (i / MAP_W) | 0, p.under); SG.PROPS.delete(i); S.stakes++; }
    // 2. the plan
    const thing = (x, y, kind) => { const t = SOLID_T(); if (t < 0) return; THINGS.set(idx(x, y), { kind, under: NATURE.has(at(x, y)) || SOLID.has(at(x, y)) ? T.GRASS : at(x, y) }); set(x, y, t); S.props++; };
    let post = null;
    for (let ry = 0; ry < PLAN.length; ry++) for (let rx = 0; rx < PLAN[ry].length; rx++) {
      const ch = PLAN[ry][rx]; if (ch === 'H' || ch === 'd') continue;
      const [x, y] = BF.p(rx, ry), t = at(x, y);
      if (KEEP.has(t)) continue;
      // '.': open ground as the land has it (its trees and rocks go, its flowers stay), so every part of the place is reached
      // and the ground round the mound joins the wood behind it as it did before (92-worldshape's walled-off check)
      if (ch === '.') { if (NATURE.has(t) && t !== T.FLOWERS) set(x, y, T.GRASS); continue; }
      if (KIND_OF[ch]) thing(x, y, KIND_OF[ch]);
      else if (ch === 'D') { if (NATURE.has(t)) set(x, y, T.GRASS); }
      else if (ch === 'S') set(x, y, T.STONECIRCLE);
      else if (ch === ',' || ch === 'L') set(x, y, T.DIRT);
      else if (ch === 'c') { set(x, y, T.DIRT); DECO.put(api, x, y, 'barrow_candle'); S.deco++; }
      else if (ch === 't') { set(x, y, T.GRASS); DECO.put(api, x, y, 'old_grave'); S.deco++; }
      else if (ch === 'R') { set(x, y, T.HITCH); post = { x, y }; }
    }
    POST = post;
    // 3. the cottage, as 02-world lays its own (walls, floor, door, furniture, a clear step)
    { const b = COTTAGE; if (!BUILDINGS.includes(b)) BUILDINGS.push(b);
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) set(x, y, (x === b.x || y === b.y || x === b.x + b.w - 1 || y === b.y + b.h - 1) ? T.HWALL : T.FLOOR);
      set(b.x + b.door, b.y + b.h - 1, T.DOOR);
      for (const [t, rx, ry] of b.f) set(b.x + rx, b.y + ry, t);
      const st = [b.x + b.door, b.y + b.h]; if (SOLID.has(at(st[0], st[1]))) set(st[0], st[1], T.DIRT); }
    // 4. Granny Wick
    { const n = GRANNY_NPC; if (!NPCS.includes(n)) NPCS.push(n); initNpc(n); if (SOLID.has(at(n.x, n.y))) set(n.x, n.y, T.DIRT); }
    // 5. the stair down (the instance's door, placed on the finished land) and its step
    if (window.INSTANCES && INSTANCES.placeDoor) INSTANCES.placeDoor(DEEP_ID);
    // 6. the paw-print trail and the spoil: open ground (the trees and rocks on it go; nothing else changes)
    for (let k = 1; k < TRAIL.length; k++) {
      const [ax, ay] = BF.p(TRAIL[k - 1][0], TRAIL[k - 1][1]), [bx, by] = BF.p(TRAIL[k][0], TRAIL[k][1]), n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let s = 0; s <= n; s++) { const x = Math.round(ax + (bx - ax) * s / (n || 1)), y = Math.round(ay + (by - ay) * s / (n || 1)); if (NATURE.has(at(x, y)) && !A.reservedAt(x, y)) { set(x, y, T.GRASS); S.cleared++; } }
    }
    { const [sx, sy] = BF.p(SPOIL[0], SPOIL[1]); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (NATURE.has(at(sx + dx, sy + dy))) { set(sx + dx, sy + dy, dx === 0 && dy === 0 ? T.DIRT : T.GRASS); S.cleared++; } }
    // 7a. an apron of open ground round the mound and the ruin, outside the box: no pocket of the wood is shut in behind them
    // (92-worldshape's walled-off check: the knight reached that ground across the staked plot before)
    const inBox = (x, y) => { const q = A.box(ID); return x >= q[0] && x <= q[2] && y >= q[1] && y <= q[3]; };
    for (const [i, c] of THINGS) { if (c.kind !== 'mound' && c.kind !== 'ruin') continue; const x = i % MAP_W, y = (i / MAP_W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const ax = x + dx, ay = y + dy; if (!inBox(ax, ay) && inMap(ax, ay) && NATURE.has(at(ax, ay)) && at(ax, ay) !== T.FLOWERS) { set(ax, ay, T.GRASS); S.cleared++; } } }
    // 7b. a quiet place: a hostile spawn in the box or its ring keeps its patch just outside it (moved, never removed: the wood
    // keeps its wolves), found the same way on every game, open, clear of the main roads and of every other place
    { const q = A.box(ID), ringOf = (x, y) => Math.max(q[0] - x, x - q[2], q[1] - y, y - q[3]);
      const clear = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!inMap(x + dx, y + dy) || SOLID.has(at(x + dx, y + dy))) return false; return true; };
      const offRoad = (x, y) => { for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) if (A.onMainRoad(x + dx, y + dy)) return false; return true; };
      S.moved = [];
      for (const sp of MONSTER_SPAWNS) {
        const d = MONSTER_DEFS[sp.type]; if (!d || !d.aggro || ringOf(sp.tx, sp.ty) > RING) continue;
        let to = null;
        for (let r = 1; r <= 12 && !to; r++) for (let dy = -r; dy <= r && !to; dy++) for (let dx = -r; dx <= r && !to; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = sp.tx + dx, y = sp.ty + dy;
          if (ringOf(x, y) <= RING + 1 || !clear(x, y) || A.reservedAt(x, y) || A.builtAt(x, y) || !offRoad(x, y)) continue;
          to = [x, y];
        }
        if (to) {
          S.moved.push([sp.type, sp.tx, sp.ty, to[0], to[1]]); sp.tx = to[0]; sp.ty = to[1];
          // the footprint holds where it moved to (the same spot on every game: this pass is deterministic)
          const R8 = A.REVS && A.REVS[8], nb = [to[0] - 1, to[1] - 1, to[0] + 1, to[1] + 1];
          if (R8 && !R8.boxes.some(q => q[0] === nb[0] && q[1] === nb[1] && q[2] === nb[2] && q[3] === nb[3])) R8.boxes.push(nb);
        }
      }
    }
    // 7. the dressing ring: worn ground outside the box, thinning over four tiles (its own dice)
    const b = A.box(ID), others = Object.keys(A.ANCHORS).filter(id => id !== ID && A.box(id)).map(id => A.box(id));
    for (let y = b[1] - RING; y <= b[3] + RING; y++) for (let x = b[0] - RING; x <= b[2] + RING; x++) {
      const d = Math.max(b[0] - x, x - b[2], b[1] - y, y - b[3]); if (d < 1) continue;
      const r = rnd();
      if (!inMap(x, y) || at(x, y) !== T.GRASS || A.onMainRoad(x, y) || others.some(q => x >= q[0] - 2 && x <= q[2] + 2 && y >= q[1] - 2 && y <= q[3] + 2)) continue;
      if (r < 0.18 * (1 - (d - 1) / 4)) set(x, y, T.DIRT);
    }
  });
  // the stair's door: placed by this file once the land is built (lateDoor), so every world pass before sees the old ground
  const RAIL = window.RAILS ? RAILS.add({ id: ID, place: "the Old Barrow's rail", at: () => POST }) : null;

  // ---------- the things: what E says, and how each is drawn ----------
  HOOKS.use.push((t, tx, ty) => {
    if (window.__instance || t !== SOLID_T()) return false;
    const c = THINGS.get(idx(tx, ty)); if (!c) return false;
    if (c.kind === 'altar') { openPanel('altar'); return true; }
    if (c.kind === 'rattle') { rattleTalk(); return true; }
    if (c.kind === 'dummy') { notify(NECRO.focusInHand() ? `Bolt the dummy (${keyName('Space')}). It does not mind.` : 'A bone dummy for practising spells. Hold a wand and bolt it.'); return true; }
    if (c.kind === 'mound') { notify(nightNow() ? 'The barrow mound. Little lights drift over the grass at night. They mean no harm.' : 'The barrow mound, where the first Wolfwood folk buried their kings.'); return true; }
    if (c.kind === 'ruin') { notify('The chapel\'s old wall. The roof fell in long ago.'); return true; }
    if (c.kind === 'lantern') { notify('A lantern on a post. Granny Wick lights them at dusk.'); return true; }
    return false;
  });
  const nightNow = () => !!(window.NIGHT && NIGHT.phase && NIGHT.phase() !== 'day');
  // the bone dummy the knight faces (a bolt with no monster in reach lands on it): 89-necromancy asks
  NECRO.dummies.find = () => {
    if (window.__instance) return null;
    for (const r of [36, 62, 100, 140]) {
      const tx = Math.floor((player.x + player.facing.x * r) / TILE), ty = Math.floor((player.y + player.facing.y * r) / TILE), c = THINGS.get(idx(tx, ty));
      if (c && c.kind === 'dummy' && map[idx(tx, ty)] === SOLID_T()) return { x: tc(tx), y: tc(ty) - 10, tx, ty };
    }
    return null;
  };
  // the candle circle: spirit refills twice as fast standing in it (89-necromancy reads circles)
  NECRO.circles.push(() => { if (window.__instance) return false; const c = DECO.at(Math.floor(player.x / TILE), Math.floor(player.y / TILE)); if (c && c.kind === 'barrow_candle') return true; const [cx, cy] = P('circle'); return Math.floor(player.x / TILE) === cx && Math.floor(player.y / TILE) === cy; });
  NECRO.landing.at = () => A.port('necromancy.door');
  HOOKS.draw.push((g, items) => {
    if (window.__instance || !THINGS.size) return;
    const a = ART(); if (!a) return;
    const vis = (x, y, r) => x + r > cam.x && x - r < cam.x + VW && y + r > cam.y && y - r < cam.y + VH;
    let moundDone = false;
    for (const [i, c] of THINGS) {
      const tx = i % MAP_W, ty = (i / MAP_W) | 0, px = tx * TILE, py = ty * TILE;
      if (map[i] !== SOLID_T() || !vis(px + TILE / 2, py + TILE / 2, tiles(6))) continue;
      const v = variant[i] % 3;
      items.push({ y: -1e9 + 1, draw: () => { const img = tex[TEX_NAME[c.under] + v]; if (img) g.drawImage(img, px, py, TILE, TILE); } });
      if (c.kind === 'mound') { if (moundDone) continue; moundDone = true; const m = moundBox(); items.push({ y: (m[3] + 1) * TILE - 4, draw: () => a.mound(g, m, nightNow(), time, P('door')) }); continue; }
      items.push({ y: py + TILE - 4, draw: () => a.thing(g, c.kind, px, py, { tx, ty, night: nightNow(), rattleTalk: RT.at > time - 3 }) });
    }
    // the lych-gate over the path, drawn in front of anyone under it
    { const [gx, gy] = P('gate'); if (vis(tc(gx), tc(gy), tiles(2))) items.push({ y: (gy + 1) * TILE + 2, draw: () => a.lychGate(g, gx * TILE, gy * TILE) }); }
    // the stair down (a dark arch in the mound's face) is the DUNGEON_DOOR tile, drawn by 16-instances; Tobias's stone,
    // set back in its place (this knight's own Q1), Bramble asleep on it, and the names' little lights after Q5
    { const [x, y] = P('tobias'); if (B().q1 >= 9 && vis(tc(x), tc(y), TILE)) items.push({ y: (y + 1) * TILE - 6, draw: () => a.tobiasStone(g, x * TILE, y * TILE, time) }); }
    if (B().q5 >= 9 && nightNow()) PLAN.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== 't') return; const [x, y] = BF.p(rx, ry); items.push({ y: 1e8 - 1, draw: () => a.nameLight(g, tc(x), tc(y) - LIFT.head, time + rx * 1.7 + ry) }); }));
    // the spoil heap and the stone face-down in it (until this knight picks it up in Q1)
    { const [sx, sy] = BF.p(SPOIL[0], SPOIL[1]); if (vis(tc(sx), tc(sy), TILE)) items.push({ y: (sy + 1) * TILE - 6, draw: () => a.spoil(g, sx * TILE, sy * TILE, B().q1 < 4) }); }
    // Bramble's paw prints: spirit marks, seen only in a Ghostlight (Q1 step 3, and after it for anyone who looks)
    if (B().q1 >= 3) for (let k = 0; k < TRAIL.length; k++) { const [x, y] = BF.p(TRAIL[k][0], TRAIL[k][1]); if (!vis(tc(x), tc(y), TILE) || !NECRO.seesGhost(tc(x), tc(y))) continue; items.push({ y: -1e9 + 4, draw: () => a.pawPrints(g, tc(x), tc(y), k) }); }
    // the night's harmless wisps over the mound (decoration, never monsters)
    if (nightNow()) { const m = moundBox(); items.push({ y: 1e8 - 2, draw: () => a.moundWisps(g, m, time) }); }
  });
  const moundBox = () => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const [i, c] of THINGS) if (c.kind === 'mound') { const x = i % MAP_W, y = (i / MAP_W) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };
  // the lanterns burn at night (whole-number radii: 35-night stamps them from one cached picture each)
  if (HOOKS.nightLights) HOOKS.nightLights.push((out, x0, y0, x1, y1) => {
    if (window.__instance) return;
    for (const [i, c] of THINGS) { if (c.kind !== 'lantern') continue; const x = i % MAP_W, y = (i / MAP_W) | 0; if (x < x0 - 3 || x > x1 + 3 || y < y0 - 3 || y > y1 + 3) continue; out.push({ x: tc(x), y: y * TILE - 6, r: 100 }); }
    for (const [x, y] of PLAN.flatMap((r, ry) => [...r].map((ch, rx) => ch === 'c' ? BF.p(rx, ry) : null).filter(Boolean))) if (x >= x0 - 3 && x <= x1 + 3 && y >= y0 - 3 && y <= y1 + 3) out.push({ x: tc(x), y: tc(y) - 8, r: 60 });
  });

  // ---------- state ----------
  // quest.barrow = { q1..q5 (0 not started ... 9 done), seen: {}, met: {}, lanterns: [], ... }
  const B = () => { const q = quest.barrow && typeof quest.barrow === 'object' ? quest.barrow : (quest.barrow = {});
    for (const k of ['q1', 'q2', 'q3', 'q4', 'q5']) if (!(q[k] >= 0)) q[k] = 0;
    if (!Array.isArray(q.lanterns)) q.lanterns = [];
    if (!(q.kingRest >= 0)) q.kingRest = 0; if (!(q.hollowRest >= 0)) q.hollowRest = 0;
    return q; };
  HOOKS.newGame.push(() => { quest.barrow = {}; RT.at = -1e9; RT.n = 0; });
  // the spells' quest gates (89-necromancy asks)
  Object.assign(NECRO.gates, { q1: () => B().q1 >= 1, q1b: () => B().q1 >= 2, q2: () => B().q2 >= 2, q3: () => B().q3 >= 9, q4: () => B().q4 >= 9, q5: () => B().q5 >= 9 });
  const DONE = 9;

  // =====================================================================================================================
  // THE PEOPLE: Granny Wick (an NPCS row, the townsfolk look) and Rattle (a skull on a post: a prop, not a person)
  // =====================================================================================================================
  const say2 = (lines, who) => { for (const l of lines) say(l, who); };
  const L = () => NECRO.level();
  SHOPS.barrow_candles = { name: "Granny Wick's shelf", stock: [['soul_shard', C.SHARD_PRICE]], buys: [], rate: 1, buysWords: 'Granny Wick buys nothing. "I have more bones than I know what to do with, dear."' };
  const AFTER = [
    'Most of them only want someone to remember them. Remember that, and you will be a good keeper.',
    "Soul shards on my shelf, twenty-five coins each, if you run short. Nobody should ever be stuck for a shard.",
    'The candles do the hard work. I just keep them lit.',
    'Rattle has told you the joke about the skeleton and the party? He tells everybody. Every single body.',
  ];
  let afterN = 0;
  HOOKS.talk.barrow_keeper = n => grannyTalk(n);
  function grannyTalk(n) {
    const q = B(), lv = L();
    // Q1: Bramble's Last Walk
    if (q.q1 === 0) {
      if (combatLevel() < 5) { say2(["Well now, a knight. You'll want to swing a sword a while before the dead will listen to you, dear.", 'Come back at combat level 5.'], GRANNY); return; }
      q.q1 = 1; NECRO.learn('bolt'); giveOrDrop('barrow_wand', 1, player.x, player.y); sfx('quest');
      say2(["You heard Rattle? Not just clacking, but the words? Most folk only hear clacking. You've got the knack.",
        "Necromancy isn't bossing the dead about. It's listening. Most of them only want someone to remember them.",
        'Here: my old Barrow wand. Hold it and swing, and it throws a Soul Bolt. Practise on my bone dummies. They don\'t mind.'], GRANNY);
      notify(`Hold the Barrow wand, face a bone dummy and press ${keyName('Space')}. Necromancy 3 to go on.`); save(); return;
    }
    if (q.q1 === 1) {
      if (lv < 3) { say(`Keep at the dummies, dear. Come back at Necromancy 3. You are ${lv}.`, GRANNY); return; }
      q.q1 = 2; NECRO.learn('light'); sfx('quest');
      say2(['Good. Now a quieter one: Ghostlight. It lets you see the ones who are still about.', 'Something whines by the mound every day and every night. Have a look with this. Open your spellbook and make Ghostlight ready.'], GRANNY); save(); return;
    }
    if (q.q1 === 2 || q.q1 === 3) { say(q.q1 === 2 ? 'Turn your Ghostlight on and look by the mound, dear. Something is waiting there.' : 'Follow the little paw prints. Your Ghostlight shows them.', GRANNY); return; }
    if (q.q1 === 4) {
      q.q1 = 5;
      say2(['Let me see that. The name has been scratched clean off. Only that curved scrape is left, like a scythe.', "That's old Tobias's stone. He kept this barrow before me. Somebody's been taking names.", 'Set it back in its place by the old graves, dear. The empty one at the end.'], GRANNY); save(); return;
    }
    if (q.q1 === 5) { say('Set Tobias\'s stone back in its place by the old graves. The empty spot at the end of the row.', GRANNY); return; }
    // Q2: The Bell-Ringer
    if (q.q2 === 0) {
      if (lv < 5 || (quest.stage || 0) <= 10) { afterLine(); return; }
      q.q2 = 1; sfx('quest');
      say("One of the graveyard's lot climbs out every night and walks east. It isn't hunting. It looks lost.", GRANNY);
      say('Go to the graveyard by the last knight\'s grave after dark, and see what it wants. Be kind to it.', GRANNY); save(); return;
    }
    if (q.q2 < DONE) { say(q.q2 === 1 ? 'The graveyard, after dark. Be kind to whatever climbs out.' : 'Walk him home to Hollowford, dear. Someone there will know his name.', GRANNY); return; }
    // Q3: Lanterns for the Lost
    if (q.q3 === 0) {
      if (lv < 18 || combatLevel() < 25) { afterLine(); return; }
      q.q3 = 1; sfx('quest');
      say2(["The calm dead in the Afterlands don't hunt anyone because they've forgotten who they are. They're waiting for a light.", 'Go down through the crypt by the last knight\'s grave. Take your Ghostlight.'], GRANNY); save(); return;
    }
    if (q.q3 < DONE) { say(q.q3 === 1 ? 'The Afterlands, dear, through the crypt by the last knight\'s grave. Look with your Ghostlight.' : 'Light the five lanterns for Old Ned. Stand by each one with your Ghostlight on.', GRANNY); return; }
    // Q4: The Barrow King
    if (q.q4 === 0) {
      if (lv < 40) { afterLine(); return; }
      q.q4 = 1; sfx('quest');
      say2(["The barrow's own dead have started forgetting, too. I can hear it in the night.", 'Go down to the King. Take the dog\'s collar: the bone hand in the Ossuary knows it.'], GRANNY); save(); return;
    }
    if (q.q4 < DONE) { say('Down the stair in the mound, through the Ossuary, to the King\'s Hall. Mind your manners. He is a king.', GRANNY); return; }
    // Q5: The Name on the Stone
    if (q.q5 === 0) {
      if (lv < 60 || combatLevel() < 60) { afterLine(); return; }
      q.q5 = 1; sfx('quest');
      say2(['The oldest stone in the graveyard has no name on it at all. Have you never wondered why?', 'Go and sit with him one night, with your Ghostlight on.'], GRANNY); save(); return;
    }
    if (q.q5 < DONE) { say(q.q5 === 1 ? 'The last knight\'s grave, after dark, with your Ghostlight on.' : 'Take him down to the King\'s vault. The seal opens it.', GRANNY); return; }
    afterLine();
  }
  function afterLine() { say(AFTER[afterN++ % AFTER.length], GRANNY); if (B().q1 >= 1) openPanel('shop', 'barrow_candles'); }

  // Rattle: a court jester buried here 400 years ago, still telling terrible jokes. Anyone sees and hears him.
  const JOKES = [
    "Why didn't the skeleton go to the party? He had no BODY to go with. I'll be here all week. I'll be here all century.",
    "What do you call a skeleton who won't work? Lazy bones. Granny calls me that. Every day.",
    "Why are skeletons so calm? Nothing gets under their skin.",
    "I tried to be a drummer once. Too many bones in the band. We kept falling apart.",
    "Knock knock. Who's there? Tibia. Tibia who? Tibia honest, I forgot the rest.",
    'What does a skeleton order at the inn? A pint of milk and a mop.',
  ];
  const RT = { at: -1e9, n: 0, told: false };
  function rattleTalk() {
    const q = B(); RT.at = time;
    if (q.q1 >= 2) meetGhost('rattle');
    const met = Object.keys(NECRO.N().ghosts).filter(k => GHOST_IDS.includes(k)).length;
    if (met >= GHOST_IDS.length && !q.rattleStory) {
      q.rattleStory = true; gainXp('necromancy', C.ALL_GHOSTS.xp); sfx('quest');
      levelBanner = { text: 'ALL TWELVE GHOSTS', sub: C.ALL_GHOSTS.reward, t: 3.5 };
      say2(['Twelve! You found all twelve of us. Then you have earned it: my story.', 'Four hundred years ago I told the old king a joke so good he laughed until he cried. Then he made me promise to save the best one for someone who would really listen.',
        'Here it is. What is the best thing about being a skeleton? ... You always have a funny bone. And now so do you.'], RATTLE); save(); return;
    }
    if (q.q1 === 0) { say2([JOKES[0], 'Granny! A live one! Talk to Granny Wick, knight. She is by the cottage.'], RATTLE); return; }
    say(JOKES[RT.n++ % JOKES.length], RATTLE);
  }
  // Rattle cracks a joke as the knight walks in (once a visit)
  let inBox = false;
  HOOKS.update.push(() => {
    if (window.__instance || player.dead || title.active) { inBox = false; return; }
    const b = A.box(ID), tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
    const now = tx >= b[0] && tx <= b[2] && ty >= b[1] && ty <= b[3];
    if (now && !inBox && !dialog.cur && time - RT.at > 60) { RT.at = time; say(JOKES[RT.n++ % JOKES.length], RATTLE); }
    inBox = now;
  });
  // a tap on Rattle's post walks up to him and talks (17-tap), as a tap on a person does
  TAP_PEOPLE.push(() => { if (window.__instance) return []; const [x, y] = P('rattle'); const px = tc(x), py = tc(y); return dist(px, py, player.x, player.y) < tiles(14) ? [{ x: px, y: py, r: 16, id: 'rattle', name: RATTLE, talk: rattleTalk }] : []; });

  // =====================================================================================================================
  // THE BONE ALTAR: rest your spirit (E fills it), offer bones, make the Gravewood stave
  // =====================================================================================================================
  const OFFER = [
    { id: 'bone', xp: 15, lv: 1 }, { id: 'brute_bone', xp: 70, lv: 30 }, { id: 'dragon_bone', xp: 160, lv: 45 },
  ];
  const OFFER_SECS = 1.2;
  const STAVE = { out: 'gravewood_stave', qty: 1, needs: [['jungle_log', 2], ['bone', 10], ['grave_dust', 3], ['soul_shard', 5]], station: 'bone_altar', skill: 'necromancy', lv: 30, xp: 400, label: '2 Jungle logs + 10 Bones + 3 Grave dust + 5 Soul shards → Gravewood stave' };
  RECIPES.push(STAVE);
  function offer(o, all) {
    if (L() < o.lv) { notify(`Offering ${ITEMS[o.id].name.toLowerCase()}s needs Necromancy ${o.lv}.`); return false; }
    if (countItem(o.id) < 1) { notify(`You have no ${ITEMS[o.id].name.toLowerCase()}s.`); return false; }
    player.action = { type: 'offer', t: 0, need: OFFER_SECS, offer: o.id, all: !!all };
    return true;
  }
  function restSpirit() { NECRO.addSpirit(999); burst(player.x, player.y - 10, '#4fd1b5', 14, 60); }
  HOOKS.update.push(() => {
    const a = player.action; if (!a || a.type !== 'offer' || a.t < a.need) return;
    const o = OFFER.find(q => q.id === a.offer);
    if (!o || countItem(o.id) < 1) { player.action = null; return; }
    removeItem(o.id, 1); gainXp('necromancy', o.xp); floatText(player.x, player.y - 36, `+${o.xp} Necromancy`, '#4fd1b5', 12); burst(player.x + player.facing.x * 30, player.y + player.facing.y * 30 - 10, '#9fe8d6', 8, 50);
    NECRO.STATS.offered = (NECRO.STATS.offered || 0) + 1;
    if (a.all && countItem(o.id) > 0) a.t = 0; else { player.action = null; save(); }
  });
  HOOKS.panel.altar = g => {
    const K = PANEL_KIT, Rm = K.room(), T = HK.T, { R, G } = Rm;
    const W = Math.min(Rm.aw, 520), cw = W - 36;
    const rows = 1 + OFFER.length + 1;
    const H = 62 + 24 + rows * (R + G) + 10;
    const { px: x0, py: y0 } = panelBox(g, W, H, 'The Bone Altar', `Spirit ${Math.floor(NECRO.spirit())} / ${NECRO.spiritMax()} · Necromancy ${L()}`);
    const x = x0 + 18; let y = y0 + 62;
    K.para(g, 'Old bones rest easier here. Offer them, and your Necromancy grows.', x, y + 10, cw, { size: 12.5, lines: 1, color: T.inkDim, fitId: 'altar:hint' });
    y += 24;
    const half = Math.floor((cw - G) / 2);
    for (const o of OFFER) {
      const n = countItem(o.id), ok = L() >= o.lv && n > 0, name = ITEMS[o.id].name;
      const l1 = L() >= o.lv ? `Offer a ${name.toLowerCase()} (${o.xp} xp)` : `${name}: Necromancy ${o.lv}`;
      K.verb(g, x, y, half, R, l1, () => offer(o, false), { enabled: ok, tone: ok ? 'primary' : null });
      K.verb(g, x + half + G, y, cw - half - G, R, `Offer all ${n}`, () => { if (offer(o, true)) closePanel(); }, { enabled: ok && n > 1 });
      y += R + G;
    }
    const have = STAVE.needs.every(([id, q]) => countItem(id) >= q), lvOk = L() >= STAVE.lv;
    K.verb(g, x, y, cw, R, lvOk ? 'Make a Gravewood stave (400 xp)' : 'Gravewood stave: Necromancy 30', () => { if (!have) { notify('A Gravewood stave needs 2 jungle logs, 10 bones, 3 grave dust and 5 soul shards.'); return; } finishCraft(STAVE); }, { enabled: lvOk, tone: lvOk && have ? 'primary' : null });
  };
  { const _openPanel = openPanel;
    openPanel = function (name, arg) { if (name === 'altar') restSpirit(); return _openPanel.apply(this, arguments); }; }

  // =====================================================================================================================
  // THE MONSTERS OF THE DEEP (spec 5.4 and 5.5). New types, never 54-graves' grave_* or zombie_brute: 54 sweeps those by
  // type at dawn and would empty the hall.
  // =====================================================================================================================
    Object.assign(MONSTER_DEFS, {
    // the candle stands and the bell: harmless, never move, never die (a candle at 0 hp is out); their hp and state stream
    watch_candle: { name: 'Watch candle', level: 1, r: 12, hp: 30, att: 0, maxHit: 0, def: 0, speed: 0, aggro: false, harmless: true, sight: 0, respawn: 1e9, never: true, drops: {} },
    watch_bell: { name: 'The Watch bell', level: 1, r: 18, hp: 1, att: 0, maxHit: 0, def: 0, speed: 0, aggro: false, harmless: true, sight: 0, respawn: 1e9, never: true, drops: {} },
    // the wisps go for the candles and puff them out; they never chase a knight (sight 0)
    barrow_wisp: { name: 'Barrow wisp', level: 4, r: 11, hp: 10, att: 0, maxHit: 0, def: 2, speed: 60, aggro: false, sight: 0, respawn: 1e9, death: 'undead', drops: { always: [['soul_shard', 1, 1]] } },
    shade_wisp: { name: 'Shade wisp', level: 20, r: 12, hp: 40, att: 0, maxHit: 0, def: 14, speed: 66, aggro: false, sight: 0, respawn: 1e9, death: 'undead', drops: { always: [['soul_shard', 1, 1]] } },
    void_wisp: { name: 'Void wisp', level: 50, r: 13, hp: 120, att: 0, maxHit: 0, def: 34, speed: 72, aggro: false, sight: 0, respawn: 1e9, death: 'undead', drops: { always: [['soul_shard', 1, 1]] } },
    old_snuffer: { name: 'Old Snuffer', level: 12, r: 18, hp: 40, att: 0, maxHit: 0, def: 6, speed: 50, aggro: false, sight: 0, respawn: 1e9, death: 'undead', drops: { always: [['soul_shard', 2, 2], ['coins', 20, 40]] } },
    snuffer: { name: 'Snuffer', level: 36, r: 20, hp: 160, att: 0, maxHit: 0, def: 24, speed: 54, aggro: false, sight: 0, respawn: 1e9, death: 'undead', drops: { always: [['soul_shard', 2, 3], ['coins', 60, 100]] } },
    deep_snuffer: { name: 'Deep Snuffer', level: 66, r: 22, hp: 480, att: 0, maxHit: 0, def: 46, speed: 58, aggro: false, sight: 0, respawn: 1e9, death: 'undead', drops: { always: [['soul_shard', 3, 4], ['coins', 150, 250]] } },
    // the fighters go for knights
    barrow_bones: { name: 'Barrow bones', level: 10, r: 12, hp: 26, att: 10, maxHit: 4, def: 8, speed: 100, aggro: true, sight: tiles(8), respawn: 1e9, death: 'undead', drops: { always: [['bone', 1, 2]], table: [['nothing', 0, 0, 3], ['coins', 4, 10, 3]] } },
    barrow_guard: { name: 'Barrow guard', level: 34, r: 13, hp: 90, att: 32, maxHit: 9, def: 26, speed: 96, aggro: true, sight: tiles(8), respawn: 1e9, death: 'undead', drops: { always: [['bone', 2, 3]], table: [['nothing', 0, 0, 3], ['grave_dust', 1, 1, 2], ['coins', 10, 30, 3]] } },
    barrow_brute: { name: 'Barrow brute', level: 62, r: 30, hp: 380, att: 55, maxHit: 14, def: 40, speed: 70, aggro: true, sight: tiles(8), respawn: 1e9, death: 'undead', drops: { always: [['brute_bone', 1, 1], ['bone', 3, 6]], table: [['nothing', 0, 0, 2], ['grave_dust', 1, 2, 3], ['coins', 30, 60, 3]] } },
    // the bosses (named, redefeatable: HOOKS.bossCall below)
    barrow_king: { name: 'The Barrow King', level: 48, r: 20, hp: 650, att: 44, maxHit: 16, def: 38, speed: 90, aggro: true, sight: tiles(10), respawn: 1e9, death: 'undead', boss: true,
      drops: { always: [['brute_bone', 2, 3], ['bone', 6, 10], ['coins', 150, 250]], table: [['grave_dust', 1, 3, 3], ['soul_shard', 1, 3, 3]] } },
    the_hollow: { name: 'The Hollow', level: 72, r: 22, hp: 1100, att: 60, maxHit: 22, def: 52, speed: 110, aggro: true, sight: tiles(10), respawn: 1e9, death: 'undead', boss: true,
      drops: { always: [['soul_shard', 4, 8], ['grave_dust', 2, 4], ['coins', 200, 400]], table: [['brute_bone', 1, 2, 3], ['dragon_bone', 1, 2, 2], ['rotten_cloth', 1, 3, 3]] } },
    // the names the Hollow calls back to itself (any hit pops one)
    name_wisp: { name: 'Stolen name', level: 30, r: 10, hp: 20, att: 0, maxHit: 0, def: 0, speed: 70, aggro: false, sight: 0, respawn: 1e9, death: 'undead', drops: {} },
  });
  NECRO.addUndead('barrow_wisp', 'shade_wisp', 'void_wisp', 'old_snuffer', 'snuffer', 'deep_snuffer', 'barrow_bones', 'barrow_guard', 'barrow_brute', 'barrow_king', 'the_hollow', 'name_wisp');
  // every knight who fought a named boss gets the kill (75-coop's CREDIT: barrow_king and the_hollow are in it)
  const WISPS = new Set(['barrow_wisp', 'shade_wisp', 'void_wisp', 'old_snuffer', 'snuffer', 'deep_snuffer']);
  const FIGHTERS = new Set(['barrow_bones', 'barrow_guard', 'barrow_brute']);
  const WATCH_FOES = new Set([...WISPS, ...FIGHTERS]);

  // =====================================================================================================================
  // THE BARROW DEEP (instance 'barrow_deep', 44 x 36: its own map, so its numbers are its own; spec 5.3)
  // =====================================================================================================================
  const DEEP = {
    w: 44, h: 36, entry: [21, 2], exit: [21, 1],
    hall: [12, 5, 30, 14], bell: [21, 9], ropes: { watch_dusk: [20, 10], watch_midnight: [21, 10], watch_deep: [22, 10] },
    candles: [[21, 6], [25, 8], [24, 12], [18, 12], [17, 8]], cracks: [[13, 6], [29, 6], [13, 13], [29, 13]],
    ossuary: [19, 15, 23, 19], boneDoor: [21, 20],
    kingHall: [10, 21, 32, 28], throne: [21, 22], king: [21, 25],
    vaultDoor: [21, 29], vault: [14, 30, 28, 34], nameStone: [21, 31], circle: [21, 33],
    walls: [[12, 30], [28, 30], [14, 34], [28, 34]],
    torches: [[12, 4], [30, 4], [11, 9], [31, 9], [9, 24], [33, 24], [13, 32], [29, 32]],
  };
  const inR = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  const DPROP = new Map();   // the Deep's solid things: idx (instance map) -> kind (the throne, the ropes, the doors, the name stone)
  function buildDeep(set) {
    const W = DEEP.w, H = DEEP.h, room = (r, t) => { for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) set(x, y, t); };
    room([0, 0, W - 1, H - 1], T.WALL);
    room([20, 2, 22, 4], T.CAVE);                                  // the stair foot and the passage down
    room(DEEP.hall, T.CAVE); room(DEEP.ossuary, T.CAVE); room(DEEP.kingHall, T.CAVE); room(DEEP.vault, T.CAVE);
    for (let y = DEEP.ossuary[1]; y <= DEEP.ossuary[3]; y++) { set(DEEP.ossuary[0], y, T.SHELF); set(DEEP.ossuary[2], y, T.SHELF); }
    room([21, 14, 21, 14], T.CAVE);
    // the solid things stand on castle wall until the world is built (TD_PROP is 95-thistledown's, made after this file)
    for (const [x, y] of [DEEP.throne, DEEP.ropes.watch_dusk, DEEP.ropes.watch_midnight, DEEP.ropes.watch_deep, DEEP.boneDoor, DEEP.vaultDoor, DEEP.nameStone]) set(x, y, T.CWALL);
    // torches in the walls
    for (const [x, y] of DEEP.torches) set(x, y, Tn('TORCH') >= 0 ? T.TORCH : T.WALL);
  }
  const DEEP_SPAWNS = DEEP.candles.map(([x, y]) => ['watch_candle', x, y]).concat([['watch_bell', DEEP.bell[0], DEEP.bell[1]]]);
  const deepInst = window.INSTANCES ? INSTANCES.define(DEEP_ID, {
    name: 'The Barrow Deep', sub: 'Where the first kings sleep', w: DEEP.w, h: DEEP.h, dark: true, refill: false, lateDoor: true,
    entry: DEEP.entry, exit: DEEP.exit, door: P('door'), step: P('step'), spawns: DEEP_SPAWNS,
    voice: 'The Barrow Deep. Candles, bones and a bell. Somewhere below, a king is waiting.',
    build: buildDeep,
  }) : null;
  // the Deep has its own plaque (the Watch's): 16-instances' "n left" would count the Watch's candles and the court
  if (deepInst) deepInst.plaque = false;
  // the props become TD_PROP once every file has loaded (a world pass: every game builds its world before it plays)
  HOOKS.world.push(() => {
    if (!deepInst || SOLID_T() < 0) return;
    DPROP.clear();
    const kinds = [[DEEP.throne, 'throne'], [DEEP.ropes.watch_dusk, 'rope_dusk'], [DEEP.ropes.watch_midnight, 'rope_midnight'], [DEEP.ropes.watch_deep, 'rope_deep'], [DEEP.boneDoor, 'bonedoor'], [DEEP.vaultDoor, 'vaultdoor'], [DEEP.nameStone, 'namestone']];
    for (const [[x, y], k] of kinds) { deepInst.tiles[y * DEEP.w + x] = SOLID_T(); DPROP.set(y * DEEP.w + x, k); }
  });
  const inDeep = () => window.__instance === DEEP_ID;
  // the Candle Hall's candles double spirit's refill too, while one burns within 2 tiles of the knight (spec 1.2)
  NECRO.circles.push(() => inDeep() && monsters.some(m => m.type === 'watch_candle' && !m.dead && m.hp > 0 && dist(m.x, m.y, player.x, player.y) <= tiles(2)));
  const dIdx = (x, y) => y * DEEP.w + x;
  if (window.LIGHTS) LIGHTS.scene(DEEP_ID, {
    ambient: { color: '#03100f', alpha: 0.78 }, player: { r: 150, lift: 0.8 },
    rooms: [
      { name: 'the Candle Hall', x0: DEEP.hall[0], y0: DEEP.hall[1], x1: DEEP.hall[2], y1: DEEP.hall[3], lift: 0.55, color: '#ffd9a0', tint: 0.12 },
      { name: 'the Ossuary', x0: DEEP.ossuary[0], y0: DEEP.ossuary[1], x1: DEEP.ossuary[2], y1: DEEP.ossuary[3], lift: 0.3, color: '#9fe8d6', tint: 0.08 },
      { name: "the King's Hall", x0: DEEP.kingHall[0], y0: DEEP.kingHall[1], x1: DEEP.kingHall[2], y1: DEEP.kingHall[3], lift: 0.6, color: '#ffcf7a', tint: 0.14 },
      { name: 'the Sealed Vault', x0: DEEP.vault[0], y0: DEEP.vault[1], x1: DEEP.vault[2], y1: DEEP.vault[3], lift: 0.15, color: '#8a6aff', tint: 0.1 },
    ],
  });
  if (window.LIGHTS) LIGHTS.addSource((out, sc) => {
    if (!sc || sc.id !== DEEP_ID) return;
    for (const m of monsters) if (m.type === 'watch_candle' && !m.dead && m.hp > 0) out.push({ kind: 'point', name: 'watch candle', x: m.x, y: m.y - LIFT.candle, r: 110, lift: 0.85, tint: 0.18, color: '#ffcf7a', rgb: [255, 207, 122] });
    // a boss's blow is lit while it winds up, so the gold ring and the purple crescent show in the dark
    for (const m of monsters) if (!m.dead && ((m.type === 'barrow_king' && m.state === 'sweep') || (m.type === 'the_hollow' && m.state === 'reap'))) out.push({ kind: 'point', name: 'a boss\'s blow', x: m.x, y: m.y, r: tiles(4), lift: 0.7, tint: 0.2, color: m.type === 'barrow_king' ? '#ffcf7a' : '#a06aff', rgb: m.type === 'barrow_king' ? [255, 207, 122] : [160, 106, 255] });
  });
  // the doors: the bone hand opens for Bramble's collar, the vault for the King's seal (each knight's own game; once open on
  // a visit it stays open, so it never shuts on anyone); a friend standing at a door holds it open for you
  const OPEN = { bonedoor: false, vaultdoor: false };
  const DOOR_KEY = { bonedoor: 'bramble_collar', vaultdoor: 'kings_seal' };
  function syncDoors() {
    if (!inDeep() || SOLID_T() < 0) return;
    for (const [k, at] of [['bonedoor', DEEP.boneDoor], ['vaultdoor', DEEP.vaultDoor]]) {
      if (!OPEN[k]) {
        const friend = window.PLAYERS && PLAYERS.remote ? Object.values(PLAYERS.remote).some(e => e && e.map === DEEP_ID && dist(e.shown.x, e.shown.y, tc(at[0]), tc(at[1])) <= tiles(2)) : false;
        if (countItem(DOOR_KEY[k]) > 0 || friend) OPEN[k] = true;
      }
      const want = OPEN[k] ? T.CAVE : SOLID_T();
      if (tileAt(at[0], at[1]) !== want) { setTile(at[0], at[1], want); miniDirtyTiles.add(idx(at[0], at[1])); if (want === T.CAVE) { burst(tc(at[0]), tc(at[1]), k === 'bonedoor' ? '#e9e4d2' : '#8a6aff', 18, 70); if (k === 'bonedoor' && B().q4 >= 1 && B().q4 < DONE) say('Woof!', 'Bramble'); } }
    }
  }
  { const _enter = INSTANCES.enter;
    INSTANCES.enter = function (id) { const ok = _enter.apply(this, arguments); if (ok && id === DEEP_ID) { OPEN.bonedoor = false; OPEN.vaultdoor = false; syncDoors(); } return ok; }; }
  HOOKS.use.push((t, tx, ty) => {
    if (!inDeep()) return false;
    const k = DPROP.get(dIdx(tx, ty)); if (!k || t !== SOLID_T()) return false;
    if (k === 'bonedoor') { say(countItem('bramble_collar') ? 'The bone hand opens.' : 'A great hand of bones, closed tight. It wants something a good dog wore.', 'The Barrow Deep'); return true; }
    if (k === 'vaultdoor') { say(countItem('kings_seal') ? 'The seal fits. The vault opens.' : 'A stone door with a king\'s name carved across it as a lock. It wants the King\'s own seal.', 'The Barrow Deep'); return true; }
    if (k.startsWith('rope_')) { pullRope(k.slice(5)); return true; }
    if (k === 'throne') { callKing(); return true; }
    if (k === 'namestone') { callHollow(); return true; }
    return false;
  });
  HOOKS.draw.push((g, items) => {
    if (!inDeep()) return;
    const a = ART(); if (!a) return;
    for (const [i, k] of DPROP) {
      const x = i % DEEP.w, y = (i / DEEP.w) | 0;
      if (map[idx(x, y)] !== SOLID_T()) continue;
      items.push({ y: -1e9 + 1, draw: () => { const img = tex['cave' + (variant[idx(x, y)] % 3)]; if (img) g.drawImage(img, x * TILE, y * TILE, TILE, TILE); } });
      items.push({ y: (y + 1) * TILE - 4, draw: () => a.deepThing(g, k, x * TILE, y * TILE, time) });
    }
    // the names on the vault's walls: spirit marks, seen in a Ghostlight
    for (let x = DEEP.vault[0]; x <= DEEP.vault[2]; x += 2) for (const y of [DEEP.vault[1] - 1, DEEP.vault[3] + 1]) if (NECRO.seesGhost(tc(x), tc(y))) items.push({ y: -1e9 + 5, draw: () => a.wallNames(g, x * TILE, y * TILE, x + y) });
    { const [cx, cy] = DEEP.circle; items.push({ y: -1e9 + 3, draw: () => a.hollowCircle(g, tc(cx), tc(cy), time) }); }
    // the bosses' blows on the ground (from the streamed state: every knight sees the same telegraph)
    for (const m of monsters) { if (m.dead) continue;
      if (m.type === 'barrow_king' && m.state === 'sweep') { const p = clamp(1 - ((m.nw && m.nw.wind) || 0) / BOSS.king.wind, 0, 1); items.push({ y: -1e9 + 6, draw: () => a.sweepRing(g, m.x, m.y, tiles(BOSS.king.ring), p) }); }
      if (m.type === 'the_hollow' && m.state === 'reap') { const p = clamp(1 - ((m.nw && m.nw.wind) || 0) / BOSS.hollow.wind, 0, 1); items.push({ y: -1e9 + 6, draw: () => a.reapArc(g, m.x, m.y, m.facing || { x: 0, y: 1 }, tiles(BOSS.hollow.arc), p) }); } }
    // the Ossuary's shelves hold neat bones and skulls (the core's shelf tile, dressed over)
    for (let y = DEEP.ossuary[1]; y <= DEEP.ossuary[3]; y++) for (const x of [DEEP.ossuary[0], DEEP.ossuary[2]]) if (map[idx(x, y)] === T.SHELF) items.push({ y: (y + 1) * TILE - 6, draw: () => a.boneShelf(g, x * TILE, y * TILE, x + y) });
  });

  // =====================================================================================================================
  // THE LANTERN WATCH (Necromancy's mini-game; spec 5.4). The keeper decides, everyone is paid on his own game.
  // =====================================================================================================================
  const WATCH = {
    XP: C.WATCH_XP, WAVES: 6, WAVE_MAX: 40, PAUSE: 6, HOLD: 8,
    TIERS: {
      dusk: { key: 'dusk', name: 'the Dusk Watch', lv: 10, n: 1, wisp: 'barrow_wisp', fighter: 'barrow_bones', candle: 30, snuffer: 'old_snuffer', shards: 3, drain: 1 },
      midnight: { key: 'midnight', name: 'the Midnight Watch', lv: 40, n: 2, wisp: 'shade_wisp', fighter: 'barrow_guard', candle: 60, snuffer: 'snuffer', shards: 6, drain: 2 },
      deep: { key: 'deep', name: 'the Deep Watch', lv: 70, n: 3, wisp: 'void_wisp', fighter: 'barrow_brute', candle: 100, snuffer: 'deep_snuffer', shards: 10, drain: 4 },
    },
  };
  const tierByN = n => Object.values(WATCH.TIERS).find(t => t.n === n) || null;
  const inCharge = () => typeof NET === 'undefined' || !NET.online() || !!(window.COOP && COOP.isKeeper());
  const bellMon = () => monsters.find(m => m.type === 'watch_bell') || null;
  const candles = () => monsters.filter(m => m.type === 'watch_candle');
  const waveOf = st => { const r = /^w([1-6])$/.exec(st || ''); return r ? +r[1] : 0; };
  const running = () => { const b = bellMon(); return !!b && waveOf(b.state) > 0; };
  const mk = (type, x, y) => { const d = MONSTER_DEFS[type]; return { type, x, y, home: { x, y }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: !!d.aggro, state: 'idle', wanderT: 0.5,
    wander: { x: 0, y: 0 }, attackCd: 0.8, hurtT: 0, dead: false, deadT: 0, respawnT: Infinity, facing: { x: 0, y: 1 }, walkT: 0, moving: false, stunT: 0 }; };
  function spawnWave(b, w) {
    const tier = tierByN(b.maxHp); if (!tier) return;
    const cracks = DEEP.cracks;
    for (let i = 0; i < w + 2; i++) { const [cx, cy] = cracks[i % cracks.length]; const s = safeSpot(tc(cx), tc(cy), MONSTER_DEFS[tier.wisp].r, 'beast'); if (s) monsters.push(Object.assign(mk(tier.wisp, s.x, s.y), { watch: true })); }
    for (let i = 0; i < Math.floor(w / 2) + 1; i++) { const [cx, cy] = cracks[(i + 2) % cracks.length]; const s = safeSpot(tc(cx), tc(cy), MONSTER_DEFS[tier.fighter].r, 'beast'); if (s) monsters.push(Object.assign(mk(tier.fighter, s.x, s.y), { watch: true, angry: true })); }
    if (w === WATCH.WAVES) { const s = safeSpot(tc(DEEP.cracks[0][0]), tc(DEEP.cracks[0][1]), MONSTER_DEFS[tier.snuffer].r, 'beast'); if (s) monsters.push(Object.assign(mk(tier.snuffer, s.x, s.y), { watch: true })); }
    burst(tc(DEEP.bell[0]), tc(DEEP.bell[1]), '#9fe8d6', 16, 90);
  }
  // the Watch's own monsters: flagged when the keeper made them, and after a keeper handoff (flags do not stream) the ones in
  // the Candle Hall; never the King's court
  const isWatchFoe = m => WATCH_FOES.has(m.type) && !m.court && (m.watch || inR(DEEP.hall, Math.floor(m.x / TILE), Math.floor(m.y / TILE)));
  const foes = () => monsters.filter(m => !m.dead && isWatchFoe(m));
  function startWatch(key) {
    if (!inDeep()) return false;
    const b = bellMon(), tier = WATCH.TIERS[key]; if (!b || !tier || running()) return false;
    for (let i = monsters.length - 1; i >= 0; i--) if (isWatchFoe(monsters[i])) monsters.splice(i, 1);
    b.maxHp = tier.n; b.hp = tier.n; b.state = 'w1'; b.nw = { t: 0, pause: 0, hold: 0 };
    for (const c of candles()) { c.maxHp = tier.candle; c.hp = tier.candle; }
    spawnWave(b, 1); sfx('bell');
    return true;
  }
  function keeperTick(dt) {
    const b = bellMon(); if (!b) return;
    // keep the bell and candles where they stand (harmless and still: nothing moves them but a stray shove)
    const w = waveOf(b.state);
    if (!b.nw) b.nw = { t: 0, pause: 0, hold: 0 };     // after a keeper handoff the timers start again from the streamed state
    const nw = b.nw, lit = candles().filter(c => c.hp > 0);
    if (w > 0) {
      // the wisps go for the nearest lit candle and puff it out
      const tier = tierByN(b.maxHp) || WATCH.TIERS.dusk;
      for (const m of monsters) {
        if (m.dead || (!WISPS.has(m.type))) continue;
        let best = null, bd = Infinity; for (const c of lit) { const d = dist(m.x, m.y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
        if (!best) continue;
        m.home = { x: best.x, y: best.y + 6 };
        if (bd > best.r + m.r + 6) { if (m.state !== 'return') m.state = 'return'; }
        else { m.state = 'idle'; m.wanderT = 1; m.wander = { x: 0, y: 0 }; const drain = tier.drain * (m.type.indexOf('snuffer') >= 0 ? 2 : 1); best.hp = Math.max(0, best.hp - drain * dt); m.attackT = 0.2; }
      }
      if (!lit.length) { b.state = 'lost'; nw.hold = 0; for (const m of foes()) { m.dead = true; m.deadT = 0; m.respawnT = Infinity; } return; }
      if (nw.pause > 0) { nw.pause -= dt; if (nw.pause <= 0) { b.state = 'w' + (w + 1); nw.t = 0; spawnWave(b, w + 1); } return; }
      nw.t += dt;
      if (!foes().length || nw.t >= WATCH.WAVE_MAX) {
        if (w >= WATCH.WAVES) { b.state = 'won'; nw.hold = 0; for (const m of foes()) { m.dead = true; m.deadT = 0; } }
        else { nw.pause = WATCH.PAUSE; }
      }
    } else if (b.state === 'won' || b.state === 'lost') {
      nw.hold += dt;
      if (nw.hold >= WATCH.HOLD) { b.state = 'idle'; for (const c of candles()) c.hp = c.maxHp; for (let i = monsters.length - 1; i >= 0; i--) if (isWatchFoe(monsters[i])) monsters.splice(i, 1); }
    }
    // the fallen are taken away once their death has played (they never come back)
    for (let i = monsters.length - 1; i >= 0; i--) { const m = monsters[i]; if ((WATCH_FOES.has(m.type) || m.type === 'name_wisp') && m.dead && m.deadT > 1.6) monsters.splice(i, 1); }
  }
  // the candles and the bell cannot be hurt by a knight (a sword on one puts back what it took)
  HOOKS.hit.push((m, dmg) => { if (m && !m.remote && (m.type === 'watch_candle' || m.type === 'watch_bell') && dmg > 0) m.hp += dmg; });
  // each knight's own pay: he stood in the hall and landed a hit this watch; every wave the bell moves on pays him
  const PAY = { last: null, hitAt: -1e9, start: 1e9, waves: 0, paid: 0, get hit() { return this.hitAt >= this.start; }, set hit(v) { this.hitAt = v ? time : -1e9; } };
  HOOKS.hit.push((m, dmg, source) => { if (m && WATCH_FOES.has(m.type) && (source === 'player' || source === 'necro' || source === undefined)) PAY.hitAt = time; });
  const inHall = () => inDeep() && inR(DEEP.hall, Math.floor(player.x / TILE), Math.floor(player.y / TILE));
  function payTick() {
    const b = inDeep() ? bellMon() : null; if (!b) { PAY.last = null; return; }
    const st = b.state, was = PAY.last; PAY.last = st;
    if (was === null || st === was) return;
    if (st === 'w1' && waveOf(was) === 0) { PAY.start = time - 0.1; PAY.waves = 0; }
    const from = waveOf(was), tier = tierByN(b.maxHp);
    const done = (st === 'won' && from > 0) ? from : (waveOf(st) === from + 1 && from > 0) ? from : 0;
    if (done && tier && PAY.hit && inHall() && B().q1 >= DONE) {
      const xp = WATCH.XP[tier.key] * done; gainXp('necromancy', xp); PAY.paid += xp; PAY.waves = done;
      floatText(player.x, player.y - 44, `Wave ${done}: +${xp} Necromancy`, '#4fd1b5', 13);
      const p = NECRO.N(); p.watch.best = Math.max(p.watch.best || 0, done);
    }
    if (st === 'won' && from > 0 && tier && PAY.hit && inHall()) {
      giveOrDrop('soul_shard', tier.shards, player.x, player.y);
      levelBanner = { text: 'THE WATCH IS KEPT', sub: tier.name.replace(/^the /, 'The '), t: 3 }; sfx('quest');
      if (tier.key === 'deep' && Math.random() < 1 / C.WATCH_KIT_CHANCE) {
        const t = MONSTER_DEFS.zombie_brute.drops.rare.table, tot = t.reduce((s, r) => s + r[3], 0); let roll = Math.random() * tot;
        for (const [id, a, bb, wgt] of t) { roll -= wgt; if (roll <= 0) { drops.push({ x: player.x + 20, y: player.y, id, qty: 1, t: 0, rare: true }); levelBanner = { text: 'RARE DROP', sub: ITEMS[id].name, t: 3 }; break; } }
      }
      save();
    }
    if (st === 'lost' && from > 0) { notify('The last candle is out. The Watch is lost. Ring again when you are ready.'); }
  }
  function pullRope(key) {
    const tier = WATCH.TIERS[key]; if (!tier) return;
    if (L() < tier.lv) { notify(`${tier.name.replace(/^the /, 'The ')} needs Necromancy ${tier.lv}.`); return; }
    if (running()) { notify('The Watch is already running. Keep the candles lit!'); return; }
    const b = bellMon(); if (b && (b.state === 'won' || b.state === 'lost')) { notify('The bell is still ringing. Wait for it to fall quiet.'); return; }
    const r = window.COOP && COOP.call ? COOP.call('watch_' + key) : (startWatch(key), 'woke');
    say(B().q1 >= DONE ? 'The bell tolls. The restless are coming for the candles. Keep one burning through six waves!' : 'The bell tolls. (Finish Bramble\'s Last Walk with Granny Wick and the Watch will pay you Necromancy.)', 'The Barrow Deep');
    return r;
  }
  HOOKS.bossCall = HOOKS.bossCall || {};
  for (const key of Object.keys(WATCH.TIERS)) HOOKS.bossCall['watch_' + key] = { map: DEEP_ID, near: [DEEP.bell[0], DEEP.bell[1], 4], name: WATCH.TIERS[key].name, type: 'watch_bell', alive: () => running(), wake: () => { startWatch(key); } };
  HOOKS.update.push(dt => {
    if (!inDeep()) return;
    syncDoors();
    if (inCharge()) { keeperTick(dt); bossTick(dt); }
    payTick(); bossBlows();
  });
  // the Watch on the plaque: the wave and the candles still burning
  HOOKS.hud.push(g => {
    const b = inDeep() ? bellMon() : null; if (!b || title.active) return;
    const w = waveOf(b.state); if (!w && b.state !== 'won' && b.state !== 'lost') return;
    const cs = candles(), lit = cs.filter(c => c.hp > 0).length, tier = tierByN(b.maxHp);
    HK.addPlaque(g, { id: 'watch', emblem: 'star', name: tier ? tier.name.replace(/^the /, '').toUpperCase() : 'THE WATCH', right: w ? `wave ${w} / 6` : b.state === 'won' ? 'kept' : 'lost', sub: `${lit} of ${cs.length} candles burning`, edge: lit <= 1 ? HK.T.bad : HK.T.warn });
  });

  // =====================================================================================================================
  // THE BOSSES OF THE DEEP (spec 5.5): named, called back on a rest; their tricks run only on the keeper; each knight's
  // own game takes his own blows from what streams (the boss's `state`), as every knight's game pays him his own kill.
  // =====================================================================================================================
  const BOSS = {
    REST: 300,
    king: { type: 'barrow_king', id: 'barrow_king', at: DEEP.king, near: [DEEP.throne[0], DEEP.throne[1], 4], name: 'the Barrow King', court: [1, 0.66, 0.33], sweepEvery: 8, wind: 0.8, ring: 3, blow: { lo: 12, hi: 18 } },
    hollow: { type: 'the_hollow', id: 'the_hollow', at: [DEEP.circle[0], DEEP.circle[1] - 1], near: [DEEP.circle[0], DEEP.circle[1] - 1, 4], name: 'the Hollow', fadeEvery: 12, fade: 6, stun: 1.5, lightR: 4, reapEvery: 7, wind: 0.8, arc: 3, blow: { lo: 18, hi: 26 }, wisps: [0.5, 0.25], heal: 60 },
  };
  const live = type => monsters.find(m => m.type === type && !m.dead) || null;
  const mmss = s => { const c = Math.max(0, Math.ceil(s)); return Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0'); };
  const day = () => player.dayTime || 0;
  function spawnBoss(b) {
    if (live(b.type)) return null;
    for (let i = monsters.length - 1; i >= 0; i--) if (monsters[i].type === b.type) monsters.splice(i, 1);
    const s = safeSpot(tc(b.at[0]), tc(b.at[1]), MONSTER_DEFS[b.type].r, 'beast') || { x: tc(b.at[0]), y: tc(b.at[1]) };
    const m = mk(b.type, s.x, s.y); m.angry = true; m.nw = { t: 0, court: 0, wisps: 0 };
    monsters.push(m); burst(m.x, m.y, b.type === 'the_hollow' ? '#8a6aff' : '#ffcf7a', 30, 140); sfx('boss');
    return m;
  }
  const courtiers = () => monsters.filter(m => !m.dead && FIGHTERS.has(m.type) && inR(DEEP.kingHall, Math.floor(m.x / TILE), Math.floor(m.y / TILE)));
  function raiseCourt(m) {
    const type = (m.nw.court || 0) === 0 ? 'barrow_bones' : 'barrow_guard';
    for (let k = 0; k < 3; k++) { const a = k * 2.1; const s = safeSpot(m.x + Math.cos(a) * 70, m.y + Math.sin(a) * 50, MONSTER_DEFS[type].r, 'beast'); if (s) monsters.push(Object.assign(mk(type, s.x, s.y), { angry: true, court: true })); }
    m.nw.court = (m.nw.court || 0) + 1; floatText(m.x, m.y - m.r - 30, 'RISE, MY COURT', '#ffcf7a', 15);
  }
  // the keeper's side: the King's court and royal sweep, the Hollow's fade, reaping arc and stolen names
  function bossTick(dt) {
    const k = live('barrow_king');
    if (k) {
      const nw = k.nw || (k.nw = { t: 0, court: 1, wisps: 0 });
      // the court rises at full health (when he stands up), two thirds and one third
      const due = BOSS.king.court.filter(f => k.hp <= k.maxHp * f + 0.01).length;
      if ((nw.court || 0) < due) raiseCourt(k);
      nw.t = (nw.t || 0) + dt;
      if (k.state === 'sweep') { k.stunT = Math.max(k.stunT || 0, 0.05); nw.wind = (nw.wind || 0) - dt; if (nw.wind <= 0) { k.state = 'chase'; nw.t = 0; } }
      else if (nw.t >= BOSS.king.sweepEvery && !player.dead) { k.state = 'sweep'; nw.wind = BOSS.king.wind; k.stunT = BOSS.king.wind; floatText(k.x, k.y - k.r - 30, 'ROYAL SWEEP', '#ffcf7a', 14); }
    }
    const h = live('the_hollow');
    if (h) {
      const nw = h.nw || (h.nw = { t: 0, reap: 0, wisps: 0 }), B5 = BOSS.hollow;
      nw.t = (nw.t || 0) + dt; nw.reap = (nw.reap || 0) + dt;
      if (h.state === 'fade') {
        h.stunT = Math.max(h.stunT || 0, 0.05);
        if (NECRO.lightsNear(h.x, h.y, tiles(B5.lightR)).length) { h.state = 'chase'; h.stunT = B5.stun; nw.t = 0; floatText(h.x, h.y - h.r - 30, 'PULLED INTO THE LIGHT', '#9fe8d6', 14); burst(h.x, h.y, '#9fe8d6', 20, 90); }
        else if (nw.t >= B5.fade) { h.state = 'chase'; nw.t = 0; }
      } else if (h.state === 'reap') { h.stunT = Math.max(h.stunT || 0, 0.05); nw.wind = (nw.wind || 0) - dt; if (nw.wind <= 0) { h.state = 'chase'; nw.reap = 0; } }
      else if (nw.t >= B5.fadeEvery) { h.state = 'fade'; nw.t = 0; floatText(h.x, h.y - h.r - 30, 'It is not there', '#8a6aff', 13); }
      else if (nw.reap >= B5.reapEvery) {
        // face the nearest knight, then the crescent
        let tx = player.x, ty = player.y, bd = dist(h.x, h.y, player.x, player.y);
        if (window.COOP && COOP.knightsHere) { try { for (const q of COOP.knightsHere()) { const d = dist(h.x, h.y, q.x, q.y); if (!q.dead && d < bd) { bd = d; tx = q.x; ty = q.y; } } } catch (e) { } }
        const d = Math.hypot(tx - h.x, ty - h.y) || 1; h.facing = { x: (tx - h.x) / d, y: (ty - h.y) / d };
        h.state = 'reap'; nw.wind = B5.wind; h.stunT = B5.wind;
      }
      // the stolen names fly to it at half and a quarter of its health
      const wdue = B5.wisps.filter(f => h.hp <= h.maxHp * f).length;
      if ((nw.wisps || 0) < wdue) {
        nw.wisps = (nw.wisps || 0) + 1;
        for (const [wx, wy] of DEEP.walls) { const s = safeSpot(tc(wx), tc(wy), 10, 'beast'); if (s) monsters.push(Object.assign(mk('name_wisp', s.x, s.y), { nameWisp: true })); }
        floatText(h.x, h.y - h.r - 30, 'The names come to it!', '#e8f6ff', 13);
      }
      for (const w of monsters) {
        if (w.type !== 'name_wisp' || w.dead) continue;
        w.home = { x: h.x, y: h.y }; w.state = 'return';
        if (dist(w.x, w.y, h.x, h.y) < h.r + w.r + 4) { h.hp = Math.min(h.maxHp, h.hp + B5.heal); floatText(h.x, h.y - h.r - 20, '+' + B5.heal, '#8a6aff', 14); w.dead = true; w.deadT = 0; w.respawnT = Infinity; }
      }
    }
  }
  // the court shields the King, the dark hides the Hollow: a blow on either then puts back what it took (where the boss
  // is real: offline or on the keeper; a friend's puppet is told by the next snapshot), and any hit pops a stolen name
  HOOKS.hit.push((m, dmg) => {
    if (!m || m.remote || !(dmg > 0)) return;
    if (m.type === 'barrow_king' && courtiers().length) { m.hp += dmg; if (!m.toldShield || time - m.toldShield > 2) { m.toldShield = time; floatText(m.x, m.y - m.r - 26, 'His court shields him', '#ffcf7a', 13); } }
    else if (m.type === 'the_hollow' && m.state === 'fade') { m.hp += dmg; if (!m.toldFade || time - m.toldFade > 2) { m.toldFade = time; floatText(m.x, m.y - m.r - 26, 'It is not there', '#8a6aff', 13); } }
    else if (m.type === 'name_wisp') m.hp = 0;
  });
  // every knight's own blows, from the boss's streamed state: the King's ring lands as his sweep ends, the Hollow's
  // crescent as its reap ends (blocking halves either: 47-outliers' hurtPlayer)
  const SEEN = new WeakMap();
  function bossBlows() {
    for (const m of monsters) {
      if (m.dead || (m.type !== 'barrow_king' && m.type !== 'the_hollow')) continue;
      const was = SEEN.get(m); SEEN.set(m, m.state);
      if (player.dead || window.__peace) continue;
      if (m.type === 'barrow_king' && was === 'sweep' && m.state !== 'sweep' && dist(m.x, m.y, player.x, player.y) <= tiles(BOSS.king.ring)) { hurtPlayer(rint(BOSS.king.blow.lo, BOSS.king.blow.hi), m.x, m.y, true); floatText(player.x, player.y - 50, 'SWEPT', '#ff6b6b', 14); }
      if (m.type === 'the_hollow' && was === 'reap' && m.state !== 'reap') {
        const dx = player.x - m.x, dy = player.y - m.y, d = Math.hypot(dx, dy) || 1, f = m.facing || { x: 0, y: 1 };
        if (d <= tiles(BOSS.hollow.arc) && (dx * f.x + dy * f.y) / d > 0.2) { hurtPlayer(rint(BOSS.hollow.blow.lo, BOSS.hollow.blow.hi), m.x, m.y, true); floatText(player.x, player.y - 50, 'REAPED', '#ff6b6b', 14); }
      }
    }
  }
  // the banners: the King says to break his court; the Hollow, to bring a light
  hudBoss(() => { const k = inDeep() ? live('barrow_king') : null; return k ? { key: k, mark: 'skull', name: 'THE BARROW KING', lv: 48, hp: k.hp, max: k.maxHp, sub: courtiers().length ? 'Break his court' : k.state === 'sweep' ? 'Step out of the gold ring' : 'Strike now', edge: courtiers().length ? HK.T.warn : null } : null; });
  hudBoss(() => { const h = inDeep() ? live('the_hollow') : null; return h ? { key: h, mark: 'skull', name: 'THE HOLLOW', lv: 72, hp: h.hp, max: h.maxHp, sub: h.state === 'fade' ? 'A Ghostlight pulls it out' : h.state === 'reap' ? 'Get out of its swing' : 'Strike now', edge: h.state === 'fade' ? '#8a6aff' : null } : null; });

  // ---------- calling them (the throne, the name stone) and the rests (96-rests: quest.barrow.kingRest / hollowRest) ----------
  function callKing() {
    const q = B();
    if (q.q4 === 0) { say('A throne of old stone, cold as winter. Someone is sitting very still in the dark behind it.', 'The Barrow Deep'); return; }
    if (live('barrow_king')) { notify('The King is already standing.'); return; }
    const left = q.kingRest - day();
    if (q.q4 >= DONE && left > 0) { say(`The King is resting. Spar with him again in ${mmss(left)}.`, 'The Barrow Deep'); return; }
    const first = q.q4 < DONE;
    if (first) { q.q4 = Math.max(q.q4, 2); save(); }
    const r = window.COOP && COOP.call ? COOP.call('barrow_king', first) : (spawnBoss(BOSS.king), 'woke');
    say(first ? 'No one walks in my hall who cannot stand.' : 'Again, then. Stand, knight.', 'The Barrow King');
    return r;
  }
  function callHollow() {
    const q = B();
    if (q.q5 < 2) { say(q.q5 >= DONE ? 'The name stone is bare now. The names have gone home.' : 'A stone carved all over with scratches where names used to be. Something behind it is listening.', 'The Barrow Deep'); if (q.q5 < DONE) return; }
    if (live('the_hollow')) { notify('The Hollow is already here.'); return; }
    const left = q.hollowRest - day();
    if (q.q5 >= DONE && left > 0) { say(`The dark behind the stone is quiet. It comes again in ${mmss(left)}.`, 'The Barrow Deep'); return; }
    const first = q.q5 < DONE;
    const r = window.COOP && COOP.call ? COOP.call('the_hollow', first) : (spawnBoss(BOSS.hollow), 'woke');
    say('Something tall unfolds out of the dark. One orange eye opens.', 'The Barrow Deep');
    return r;
  }
  const kingResting = () => B().q4 >= DONE && B().kingRest > day();
  const hollowResting = () => B().q5 >= DONE && B().hollowRest > day();
  HOOKS.bossCall.barrow_king = { map: DEEP_ID, near: BOSS.king.near, name: 'the Barrow King', type: 'barrow_king', rest: BOSS.REST, alive: () => !!live('barrow_king'), wake: () => { spawnBoss(BOSS.king); },
    resting: () => kingResting(), told: n => `${n} woke the Barrow King.`, refused: left => { say(`The King fell here a moment ago. He stands again in ${mmss(left)}.`, 'The Barrow Deep'); } };
  HOOKS.bossCall.the_hollow = { map: DEEP_ID, near: BOSS.hollow.near, name: 'the Hollow', type: 'the_hollow', rest: BOSS.REST, alive: () => !!live('the_hollow'), wake: () => { spawnBoss(BOSS.hollow); },
    resting: () => hollowResting(), told: n => `${n} called something out of the vault.`, refused: left => { say(`The vault is quiet. It stirs again in ${mmss(left)}.`, 'The Barrow Deep'); } };
  // the kills: each knight's own (a friend's kill comes as a phantom through the helper credit); m.noPay: still resting
  HOOKS.kill.push(m => {
    if (!m || (m.type !== 'barrow_king' && m.type !== 'the_hollow')) return;
    const q = B(), king = m.type === 'barrow_king';
    if (m.noPay) { floatText(player.x, player.y - 44, 'You helped', '#c9d1d9', 14); say(`You helped. Your own reward comes again in ${mmss((king ? q.kingRest : q.hollowRest) - day())}.`, 'The Voice'); return; }
    if (king) {
      q.kingRest = day() + BOSS.REST;
      if (q.q4 >= 1 && q.q4 < DONE) { q.q4 = DONE; finishKing(); }
      else { levelBanner = { text: 'REMATCH WON', sub: 'The Barrow King', t: 3 }; say('He laughs, a sound like falling stones. "Again, another night."', 'The Barrow King'); }
    } else {
      q.hollowRest = day() + BOSS.REST;
      if (q.q5 >= 2 && q.q5 < DONE) { q.q5 = DONE; finishHollow(m); }
      else { levelBanner = { text: 'THE HOLLOW UNRAVELS', sub: 'It will gather itself again', t: 3 }; }
    }
    save();
  });

  // =====================================================================================================================
  // THE QUEST LINE (spec 6): something has been scratching the names off the dead, and a dead thing that forgets its name
  // cannot rest. Stages: 0 not started ... 9 (DONE). Story items declare their giver.
  // =====================================================================================================================
  Object.assign(ITEMS, {
    tobias_stone: { name: "Tobias's stone", value: 0, color: '#8a8a82', shape: 'rock', stack: 1, unique: true, giver: 'the builders\' spoil by the Old Barrow (Q1, Granny Wick)' },
    bramble_collar: { name: "Bramble's collar", value: 0, color: '#8a5a2a', shape: 'silk', stack: 1, unique: true, giver: 'Bramble, at the Old Barrow (Q1, Granny Wick)' },
    little_bell: { name: 'The Little Bell', value: 0, color: '#d9b25c', shape: 'coins', stack: 1, unique: true, giver: 'Ambrose the bell-ringer, Hollowford (Q2, Granny Wick)' },
    neds_turnip: { name: "Ned's lucky turnip", value: 1, color: '#e2d6e8', shape: 'potato', stack: 1, unique: true, giver: 'Old Ned, in the Afterlands (Q3, Granny Wick)' },
    kings_seal: { name: "The King's seal", value: 0, color: '#d9b25c', shape: 'coins', stack: 1, unique: true, giver: 'the Barrow King (Q4, Granny Wick)' },
  });
  for (const k of ['tobias_stone', 'bramble_collar', 'little_bell', 'neds_turnip', 'kings_seal']) ITEMS[k].id = k;
  if (window.KEYRING && KEYRING.register) {
    KEYRING.register('bramble_collar', "Bramble's, given at the Old Barrow. The bone hand in the Ossuary knows it.");
    KEYRING.register('kings_seal', "The Barrow King's. It opens his vault under the Old Barrow.");
  }
  // the Little Bell: ring it from the pack and every helper hurries back to your side
  NECRO.itemUse('little_bell', () => {
    const hs = NECRO.helpersHere(); sfx('bell');
    for (const h of hs) { const s = safeSpot(player.x + (h.id % 3 - 1) * 30, player.y + 26, h.r, 'beast'); if (s) { h.x = s.x; h.y = s.y; } burst(h.x, h.y, '#d9b25c', 8, 50); }
    notify(hs.length ? 'Ting! Your helpers hurry back to your side.' : 'Ting! A small, clear sound. Nobody needs calling just now.');
  }, 'Ring the Little Bell');
  QUEST_DEFS.nec_bramble = { name: "Bramble's Last Walk" };
  QUEST_DEFS.nec_bell = { name: 'The Bell-Ringer' };
  QUEST_DEFS.nec_lanterns = { name: 'Lanterns for the Lost' };
  QUEST_DEFS.nec_king = { name: 'The Barrow King' };
  QUEST_DEFS.nec_name = { name: 'The Name on the Stone' };
  const REWARD = { q1: 450, q2: 1200, q3: 3000, q4: 10000, q5: 25000 };
  const complete = (title, xp) => { gainXp('necromancy', xp); levelBanner = { text: 'QUEST COMPLETE', sub: title, t: 3.5 }; sfx('quest'); };

  // ---------- the ghosts (Speak with the Dead): seen only in a Ghostlight (Rattle and Ambrose by anyone) ----------
  const GHOST_IDS = ['rattle', 'bramble', 'ambrose', 'ned', 'barrow_king', 'corwin', 'pell', 'hob', 'finn', 'snik', 'osric_ghost', 'ivy'];
  const GHOST_NAME = { rattle: RATTLE, bramble: 'Bramble', ambrose: 'Ambrose', ned: 'Old Ned', barrow_king: 'the Barrow King', corwin: C.LAST_KNIGHT, pell: 'Mistress Pell', hob: 'Wee Hob', finn: 'Old Finn', snik: 'Snik', osric_ghost: 'Brother Osric', ivy: 'Lady Ivy' };
  function meetGhost(id) {
    const p = NECRO.N(); if (p.ghosts[id] || !GHOST_IDS.includes(id)) return false;
    p.ghosts[id] = true; gainXp('necromancy', 250); giveOrDrop('soul_shard', 1, player.x, player.y);
    const n = GHOST_IDS.filter(k => p.ghosts[k]).length;
    notify(`Ghosts met: ${n} / ${GHOST_IDS.length}. +250 Necromancy and a soul shard.`);
    if (n === GHOST_IDS.length) say('Twelve! Go and tell Rattle. He has been saving something for you.', GRANNY);
    save(); return true;
  }
  // a spot near a place's point: open ground (or a floor), 4+ tiles off every rail and signpost, found the same way on
  // every game (rings outward, rows then columns), once per world
  let SPOTS = null;
  HOOKS.built.push(() => { SPOTS = null; });
  function spotNear(x0, y0, floor) {
    const far = (x, y) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const t = tileAt(x + dx, y + dy); if (t === T.HITCH || t === T.SIGN) return false; } return true; };
    const ok = (x, y) => inMap(x, y) && !SOLID.has(tileAt(x, y)) && tileAt(x, y) !== T.WATER && far(x, y) && (!floor || tileAt(x, y) === T.FLOOR);
    for (let r = 0; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (ok(x0 + dx, y0 + dy)) return [x0 + dx, y0 + dy]; }
    return floor ? spotNear(x0, y0, false) : [x0, y0];
  }
  const ROUND = p => [Math.round(p[0]), Math.round(p[1])];
  // the six wanderers: each at a point in its own place's frame (or port), night only, in a Ghostlight
  const WANDERERS = {
    pell: { at: () => ROUND(A.port('crossroads_inn.yard')), floor: true, lines: ['Nobody salts the stew any more. NOBODY.', 'A pinch! Just a pinch! Is that so much to ask?'] },
    hob: { at: () => ROUND(A.planFrame('millbrook').p(16, 5)), lines: ['Four thousand and twelve... four thousand and thirteen...', "Don't make me lose count. I've been counting the wheel since before the mill was new."] },
    finn: { at: () => ROUND(A.planFrame('saltmere').p(6, 12)), lines: ['The one that got away was THIS big. Bigger. Bigger than the jetty.', 'Mind your hook, knight. The big ones are still down there.'] },
    snik: { at: () => ROUND(A.port('camp.walker')), lines: ['Boo? ... Was that good? Be honest.', 'I used to be the scariest goblin in the camp. Now nobody even sees me.'] },
    osric_ghost: { at: () => ROUND(A.port('old_bridge.span')), lines: ['Three hundred and six stones. Three hundred and seven? I shall count again.', 'Wilf did a fine job with the new stone. I counted every one.'] },
    ivy: { at: () => ROUND(A.port('thistledown.castle')), lines: ['Have you seen an earring? Silver, with a little pearl? I have the other one right here.', "I lost it in the garden two hundred years ago. It must be here somewhere."] },
  };
  function wandererAt(id) { if (!SPOTS) { SPOTS = {}; for (const k in WANDERERS) { const [x, y] = WANDERERS[k].at(); SPOTS[k] = spotNear(x, y, WANDERERS[k].floor); } } return SPOTS[id]; }
  // the Afterlands' own map (an instance: its numbers are its own) for Q3
  const AFTER_ID = 'afterlands';
  const NED_AT = [14, 26];
  const LANTERNS = [[27, 10], [23, 14], [19, 18], [15, 21], [45, 17]];   // the fifth on Count Ashvane's chapel altar
  const LIGHT_SECS = 2;
  // each one on open ground of that map (the nearest open tile to its spot, the same on every game), once
  let AFTER_AT = null;
  function afterSpots() {
    if (AFTER_AT) return AFTER_AT;
    const inst = window.INSTANCES && INSTANCES.get(AFTER_ID); if (!inst) return { ned: NED_AT, lanterns: LANTERNS };
    const W = inst.w, H = inst.h, open = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && !SOLID.has(inst.tiles[y * W + x]);
    const near = ([x0, y0]) => { for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (open(x0 + dx, y0 + dy)) return [x0 + dx, y0 + dy]; } return [x0, y0]; };
    return (AFTER_AT = { ned: near(NED_AT), lanterns: LANTERNS.map(near) });
  }
  const lanterns = () => afterSpots().lanterns, nedAt = () => afterSpots().ned;
  // the story's ghosts and where each one is right now (null: not here, not now)
  const GY = () => ROUND(A.port('graveyard.grave'));
  function ghostsNow() {
    const out = [], q = B(), here = window.__instance || 'over', night = nightNow();
    const add = (id, map, x, y, o) => { if (map === here) out.push(Object.assign({ id, name: GHOST_NAME[id], x: tc(x), y: tc(y) }, o || {})); };
    if (q.q1 === 2) { const [x, y] = P('bramble'); add('bramble', 'over', x, y, { kind: 'dog' }); }
    if (q.q2 === 1 && night) { const [x, y] = ROUND(A.port('graveyard.gate')); add('ambrose', 'over', x, y - 1, { kind: 'bones', anyone: true }); }
    if (q.q3 >= 1) add('ned', AFTER_ID, nedAt()[0], nedAt()[1], { kind: 'farmer', lantern: q.q3 >= DONE });
    if (q.q5 === 1 && night) { const [x, y] = GY(); add('corwin', 'over', x, y + 1, { kind: 'knight', seated: true }); }
    if (night) for (const id in WANDERERS) { const [x, y] = wandererAt(id); add(id, 'over', x, y, { kind: id }); }
    return out;
  }
  const visibleGhosts = () => ghostsNow().filter(g => g.anyone || NECRO.seesGhost(g.x, g.y));
  function ghostInFront() {
    let best = null;
    for (const gh of visibleGhosts()) { const dx = gh.x - player.x, dy = gh.y - player.y, d = Math.hypot(dx, dy); if (d > 72) continue; const dot = (dx * player.facing.x + dy * player.facing.y) / (d || 1); if (dot < 0.2 && d > 30) continue; if (!best || d < best.d) best = { gh, d }; }
    return best ? best.gh : null;
  }
  function talkGhost(gh) {
    const q = B();
    { const dx = gh.x - player.x, dy = gh.y - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
    if (gh.id === 'bramble') { meetGhost('bramble'); q.q1 = 3; say2(['A grey dog made of mist, sitting very straight. He whines once.', 'He trots off into the Wolfwood, and where his paws touch the grass they leave little glowing prints.'], 'The Voice'); save(); return; }
    if (gh.id === 'ambrose') {
      meetGhost('ambrose'); q.q2 = 2; NECRO.learn('raise');
      NECRO.makeHelper('sq', { x: gh.x, y: gh.y }, { quest: 'ambrose', look: 'ambrose', maxHit: 3 });
      say('The skeleton turns its head. It looks lost, not hungry. It wants to walk east, and cannot remember why.', 'The Voice');
      say2(["Granny Wick's lesson comes back to you: Raise Bones. You lend it a little strength, and it stands straighter.", 'Walk with it to Hollowford. Someone there might know it.'], 'The Voice');
      notify('You learned Raise Bones. Your new friend follows you now.'); save(); return;
    }
    if (gh.id === 'ned') {
      meetGhost('ned');
      if (q.q3 === 1) { q.q3 = 2; say2(["Hello! Hello, a light! I'm... I'm a farmer, I think. Ned? Old Ned. Yes.", "I only remember one thing. Lanterns. There were lanterns along the path, and he puts them out. Light them for me?"], GHOST_NAME.ned); notify('Light the five dead lanterns: stand by each with your Ghostlight on.'); save(); return; }
      say(q.q3 >= DONE ? 'Ned! Old Ned! Ha! I know who I am, and it is a fine thing to know.' : `${q.lanterns.length} of 5 lanterns lit. Mind the Count. He likes his dead quiet and nameless.`, GHOST_NAME.ned); return;
    }
    if (gh.id === 'corwin') {
      meetGhost('corwin');
      if (q.q5 === 1) {
        q.q5 = 2;
        say2(['A knight made of moonlight sits on the nameless stone. His shield has no crest left.', 'I cannot remember my name. Something in the dark took it first, before all the others.', C.CH9_HINT], 'The last knight');
        NECRO.makeHelper('lk', { x: gh.x + 30, y: gh.y }, { quest: 'corwin', look: 'corwin', maxHit: 8 });
        notify('The last knight walks with you. Take him to the Sealed Vault under the Old Barrow.'); save();
      }
      return;
    }
    const w = WANDERERS[gh.id];
    if (w) { meetGhost(gh.id); say(w.lines[(NECRO.STATS.cast + gh.id.length) % w.lines.length], GHOST_NAME[gh.id]); }
  }
  // E on a ghost you can see; a tap on one walks up and talks (17-tap)
  { const _useAction = useAction;
    useAction = function () {
      if (!player.dead && !player.mech) {
        const gh = ghostInFront(); if (gh) { talkGhost(gh); return; }
        // the last knight's grave: after Q5 it says his name (this knight's own game; no tile changes)
        if (!window.__instance && B().q5 >= DONE) { const { tx, ty } = frontTile(player), [gx, gy] = GY(); if (tx === gx && ty === gy && tileAt(tx, ty) === T.GRAVE) { say(`Here lies ${C.LAST_KNIGHT}, the last knight of Hollowford. He tried.`, 'Gravestone'); return; } }
        // the spoil: Tobias's stone, face-down (Q1)
        if (!window.__instance && spoilFaced()) { spoilUse(); return; }
        // Tobias's empty spot by the old graves (Q1)
        if (!window.__instance && tobiasFaced() && (B().q1 === 5 || B().q1 === 4)) { setStone(); return; }
      }
      return _useAction.apply(this, arguments);
    }; }
  TAP_PEOPLE.push(() => visibleGhosts().filter(gh => dist(gh.x, gh.y, player.x, player.y) < tiles(14)).map(gh => ({ x: gh.x, y: gh.y, r: 14, id: 'ghost_' + gh.id, name: gh.name, talk: () => talkGhost(gh) })));
  const faced = ([x, y]) => { for (const r of REACHES) { const tx = Math.floor((player.x + player.facing.x * r) / TILE), ty = Math.floor((player.y + player.facing.y * r) / TILE); if (tx === x && ty === y) return true; } return Math.floor(player.x / TILE) === x && Math.floor(player.y / TILE) === y; };
  const spoilFaced = () => faced(BF.p(SPOIL[0], SPOIL[1]));
  const tobiasFaced = () => faced(P('tobias'));
  function spoilUse() {
    const q = B();
    if (q.q1 === 3 || ((q.q1 === 4 || q.q1 === 5) && countItem('tobias_stone') < 1)) {
      if (q.q1 === 3) q.q1 = 4;
      giveOrDrop('tobias_stone', 1, player.x, player.y); sfx('chop');
      say2(['You turn the stone over. The name has been scratched off. Only a curved scrape is left, like the swing of a scythe.', 'The ghost dog lies down beside it anyway, his chin on his paws. It is his master\'s stone.'], 'The Voice');
      notify(`Take Tobias's stone to ${GRANNY}.`); save(); return;
    }
    notify(q.q1 >= DONE ? 'The builders\' spoil. Nothing in it now but earth.' : 'A heap of earth the builders dug up. Something is buried in it, face-down.');
  }
  function setStone() {
    const q = B();
    if (q.q1 === 4) { say(`Show the stone to ${GRANNY} first. She will want to see that scrape.`, 'The Voice'); return; }
    if (countItem('tobias_stone') < 1) { notify("You need Tobias's stone. It is in the builders' spoil."); return; }
    removeItem('tobias_stone', 1); q.q1 = DONE; meetGhost('bramble');
    giveOrDrop('bramble_collar', 1, player.x, player.y); complete("Bramble's Last Walk", REWARD.q1);
    say2(['You set the stone in its place. Bramble curls up on it, wags his tail once, and fades to rest.', "Where he lay there is a little leather collar. Bramble's. Keep it."], 'The Voice');
    say("Good. The dead can rest when someone remembers them. You'll make a keeper yet.", GRANNY); save();
  }

  // ---------- Q2: Ambrose walks home to Hollowford; at the chapel Old Tam knows him ----------
  let CHAPEL = null;
  HOOKS.built.push(() => { CHAPEL = null; });
  const chapelAt = () => CHAPEL || (CHAPEL = spotNear(...ROUND(A.frame('hollowford').p(128, 85)), false));
  HOOKS.update.push(() => {
    const q = B();
    if (q.q2 !== 2 || window.__instance || player.dead) return;
    const amb = NECRO.HELPERS.find(h => h.quest === 'ambrose');
    if (!amb) { q.q2 = 1; return; }   // a load starts with no helpers: he waits at the graveyard gate again
    const [cx, cy] = chapelAt();
    if (dist(player.x, player.y, tc(cx), tc(cy)) > tiles(5) || dist(amb.x, amb.y, tc(cx), tc(cy)) > tiles(7)) return;
    q.q2 = DONE; NECRO.HELPERS.splice(NECRO.HELPERS.indexOf(amb), 1); burst(amb.x, amb.y, '#9fe8d6', 20, 80);
    say2(['Ambrose? Is that you? Our bell-ringer. He rang the bell the night the goblins came, and never got to stop.', 'Look at the memorial board. His name has the same scrape on it as... somebody took it. Ambrose. AMBROSE. There.'], 'Old Tam');
    say2(['The skeleton straightens. It remembers. It rings the chapel bell one last time, bows to Old Tam, and settles down to rest.', 'His grandson rings Thistledown\'s bell now. Ambrose left you something: a little hand bell.'], 'The Voice');
    sfx('bell'); giveOrDrop('little_bell', 1, player.x, player.y); complete('The Bell-Ringer', REWARD.q2); save();
  });

  // ---------- Q3: five lanterns in the Afterlands (each knight's own: drawn from his flags; the instance is unchanged) ----------
  const LITQ = { i: -1, t: 0, hp: 0 };
  HOOKS.update.push(dt => {
    const q = B();
    if (window.__instance !== AFTER_ID || q.q3 !== 2 || player.dead) { LITQ.i = -1; return; }
    const p = NECRO.N();
    let near = -1; lanterns().forEach(([x, y], i) => { if (!q.lanterns.includes(i) && dist(player.x, player.y, tc(x), tc(y)) <= tiles(1.4)) near = i; });
    if (near < 0 || !p.gl) { LITQ.i = -1; return; }
    if (near === 4 && monsters.some(m => m.type === 'count_ashvane' && !m.dead)) { if (LITQ.i !== 4 || LITQ.t > 0.5) { notify('Count Ashvane blows the lantern out. Beat him first.'); LITQ.i = 4; LITQ.t = -9; } return; }
    if (LITQ.i !== near) { LITQ.i = near; LITQ.t = 0; LITQ.hp = player.hp; }
    if (player.hp < LITQ.hp) { LITQ.t = 0; LITQ.hp = player.hp; notify('A blow breaks the lighting. Try again.'); return; }
    LITQ.t += dt;
    if (LITQ.t < LIGHT_SECS) return;
    q.lanterns.push(near); LITQ.i = -1; burst(tc(lanterns()[near][0]), tc(lanterns()[near][1]) - 20, '#ffd36a', 16, 70); sfx('fire');
    notify(`A lantern lit: ${q.lanterns.length} of 5.`);
    if (q.lanterns.length >= lanterns().length) {
      q.q3 = DONE; NECRO.learn('walk'); giveOrDrop('neds_turnip', 1, player.x, player.y); complete('Lanterns for the Lost', REWARD.q3);
      say2(["Ned! I'm Old Ned! Ha! I grew turnips by the river, and my wife made the best soup in the Wolfwood.", "Take this. I've held it for a hundred years. It is still a turnip."], GHOST_NAME.ned);
      say(`${GRANNY} will be pleased. She teaches Grave Walk to those who light the way: so you can always come home.`, 'The Voice');
    }
    save();
  });

  // ---------- Q4 and Q5: the endings ----------
  function finishKing() {
    meetGhost('barrow_king'); giveOrDrop('kings_seal', 1, player.x, player.y); complete('The Barrow King', REWARD.q4);
    say2(['The King kneels. He is not angry. "I was testing you. Hear me."', '"A Hollow thing crawled up through the crypt from the Afterlands, hungry for names. I sealed it in my vault, with my own name as the lock."',
      '"That is why I cannot rest. And it reaches through the walls and scrapes at my people\'s names. Take my seal. And my blessing: from Necromancy 50, your raised dead may be Risen guards."'], 'The Barrow King');
    notify('The throne is a rematch now: E on it to spar with the King.');
  }
  const NAMES = [];   // the stolen names streaming out of the vault (this knight's own picture): { x, y, t }
  function finishHollow(m) {
    const cw = NECRO.HELPERS.find(h => h.quest === 'corwin'); if (cw) NECRO.HELPERS.splice(NECRO.HELPERS.indexOf(cw), 1);
    for (let k = 0; k < 24; k++) NAMES.push({ x: m.x + (k % 6 - 2.5) * 20, y: m.y - (k / 6 | 0) * 14, t: -k * 0.08 });
    meetGhost('corwin'); NECRO.learn('knight'); complete('The Name on the Stone', REWARD.q5);
    say2(['As it unravels into purple moths, every stolen name streams out of the vault as a little light, up and away over the barrow.', `The last knight laughs out loud. "${C.LAST_KNIGHT}. ${C.LAST_KNIGHT} of Hollowford! I remember."`,
      `"Call me, and I will come. That is a promise."`], 'The Voice');
    notify(`At Necromancy 95, Call the Last Knight brings ${C.LAST_KNIGHT} to fight beside you.`);
  }
  HOOKS.update.push(dt => { for (let i = NAMES.length - 1; i >= 0; i--) { NAMES[i].t += dt; if (NAMES[i].t > 3) NAMES.splice(i, 1); } });

  // ---------- the quest log, the map, the book ----------
  const q1Text = () => { const q = B(); return [`Talk to ${GRANNY} at the Old Barrow (combat level 5).`, `Bolt ${GRANNY}'s bone dummies to Necromancy 3 (you are ${L()}), then talk to her.`, 'Turn on Ghostlight and look by the barrow mound.', 'Follow the glowing paw prints into the Wolfwood.', `Take Tobias's stone to ${GRANNY}.`, 'Set the stone back in its empty place by the old graves.'][q.q1] || 'Done.'; };
  const q2Text = () => { const q = B(); return [`Talk to ${GRANNY} (Necromancy 5, and Old Tam free).`, 'Go to the graveyard after dark. Something climbs out by the last knight\'s grave.', 'Walk Ambrose home to Hollowford\'s chapel.'][q.q2] || 'Done.'; };
  const q3Text = () => { const q = B(); return [`Talk to ${GRANNY} (Necromancy 18, combat 25).`, 'In the Afterlands, look with your Ghostlight for the calm dead who remembers something.', `Light Old Ned's five lanterns (${q.lanterns.length} of 5). Stand by each with your Ghostlight on.`][q.q3] || 'Done.'; };
  const q4Text = () => { const q = B(); return [`Talk to ${GRANNY} (Necromancy 40).`, "Go down the barrow's stair, through the Ossuary (Bramble's collar opens it), to the King's Hall.", 'Beat the Barrow King.'][q.q4] || 'Done.'; };
  const q5Text = () => { const q = B(); return [`Talk to ${GRANNY} (Necromancy 60, combat 60).`, "Sit with the last knight's grave after dark, with your Ghostlight on.", 'Take the last knight to the Sealed Vault (the King\'s seal opens it) and face the Hollow.'][q.q5] || 'Done.'; };
  HOOKS.questText.nec_bramble = q1Text; HOOKS.questText.nec_bell = q2Text; HOOKS.questText.nec_lanterns = q3Text; HOOKS.questText.nec_king = q4Text; HOOKS.questText.nec_name = q5Text;
  HOOKS.activeQuests.push(() => { const q = B(), out = [];
    if (q.q1 > 0 && q.q1 < DONE) out.push('nec_bramble'); if (q.q2 > 0 && q.q2 < DONE) out.push('nec_bell'); if (q.q3 > 0 && q.q3 < DONE) out.push('nec_lanterns');
    if (q.q4 > 0 && q.q4 < DONE) out.push('nec_king'); if (q.q5 > 0 && q.q5 < DONE) out.push('nec_name'); return out; });
  if (HOOKS.mapTarget) HOOKS.mapTarget.push(() => {
    const q = B();
    const at = (p, label, id, map) => ({ x: Math.round(p[0]), y: Math.round(p[1]), label, id, map });
    if (q.q1 >= 1 && q.q1 < DONE) return q.q1 === 3 ? at(BF.p(SPOIL[0], SPOIL[1]), 'The builders\' spoil', 'nec_bramble') : q.q1 === 5 ? at(P('tobias'), "Tobias's place", 'nec_bramble') : q.q1 === 2 ? at(P('bramble'), 'The barrow mound', 'nec_bramble') : at(P('granny'), GRANNY, 'nec_bramble');
    if (q.q2 === 1) return at(A.port('graveyard.gate'), 'The graveyard gate', 'nec_bell');
    if (q.q2 === 2) return at(chapelAt(), "Hollowford's chapel", 'nec_bell');
    if (q.q3 === 1 || q.q3 === 2) { if (window.__instance === AFTER_ID) { const i = [0, 1, 2, 3, 4].find(k => !q.lanterns.includes(k)); return q.q3 === 1 ? at(nedAt(), 'Old Ned', 'nec_lanterns', AFTER_ID) : at(lanterns()[i == null ? 0 : i], 'A dead lantern', 'nec_lanterns', AFTER_ID); } return at(A.port('graveyard.crypt'), 'The crypt', 'nec_lanterns'); }
    if (q.q4 >= 1 && q.q4 < DONE) return inDeep() ? at(DEEP.throne, "The King's throne", 'nec_king', DEEP_ID) : at(P('door'), "The barrow's stair", 'nec_king');
    if (q.q5 === 1) return at(GY(), "The last knight's grave", 'nec_name');
    if (q.q5 === 2) return inDeep() ? at(DEEP.nameStone, 'The Sealed Vault', 'nec_name', DEEP_ID) : at(P('door'), "The barrow's stair", 'nec_name');
    return null;
  });

  // ---------- drawing the story (from this knight's own flags; the ghosts only where a Ghostlight shows them) ----------
  HOOKS.draw.push((g, items) => {
    const a = ART(); if (!a) return;
    for (const gh of visibleGhosts()) items.push({ y: gh.y + 4, draw: () => a.ghost(g, gh, time) });
    if (window.__instance === AFTER_ID) {
      const q = B();
      if (q.q3 >= 2) lanterns().forEach(([x, y], i) => { const lit = q.q3 >= DONE || q.lanterns.includes(i); items.push({ y: (y + 1) * TILE - 2, draw: () => a.wayLantern(g, tc(x), tc(y), lit, LITQ.i === i ? Math.max(0, LITQ.t) / LIGHT_SECS : 0) }); });
      if (q.q3 >= DONE) for (const m of monsters) if (!m.dead && (m.type === 'zombie_calm' || m.type === 'grave_zombie_calm')) items.push({ y: 1e8 - 3, draw: () => a.tinyLantern(g, m.x, m.y - LIFT.lamp, time + m.x * 0.01) });
    }
    for (const n of NAMES) if (n.t > 0) items.push({ y: 1e8 - 1, draw: () => a.nameLight(g, n.x + Math.sin(n.t * 3 + n.x) * 8, n.y - n.t * 90, n.t * 2) });
    // Hollowford's memorial board by the chapel: Ambrose's name scraped off until his walk home (Q2), written again after
    if (!window.__instance && B().q2 >= 1) { const [mx, my] = chapelAt(); items.push({ y: (my + 1) * TILE - 4, draw: () => a.memorialBoard(g, (mx + 1) * TILE, my * TILE, B().q2 >= DONE) }); }
    // the Hollow's moths as it unravels (79-deaths plays the undead crumble; the moths rise over it)
    for (const m of monsters) if (m.type === 'the_hollow' && m.dead && window.DEATHS && DEATHS.of(m)) { const r = DEATHS.remains(m); items.push({ y: 1e8 - 2, draw: () => a.moths(g, m.x, m.y, r) }); }
  });

  // ---------- the book (44-wiki: the QUEST_INFO rows are its own; these pages are written here) ----------
  if (window.WIKI) {
    const SP = NECRO.SPELLS;
    const skillLines = () => {
      const out = ['Necromancy is listening to the dead. You ask old bones and lost ghosts for help; they help, and then they go back to rest.', `Start: ${GRANNY} at the Old Barrow (combat level 5).`, { t: 'SPELLS', c: '#d9b25c' }];
      for (const s of SP) out.push(`Lv ${s.lv} · ${s.name}: ${s.what}${s.spirit ? ' ' + s.spirit + ' spirit.' : ''}${s.rest ? ' Rests ' + Math.round(s.rest / 60) + ' minutes.' : s.cd >= 1 ? ' Every ' + s.cd + ' s.' : ''}`);
      out.push({ t: 'SPIRIT AND POWER', c: '#d9b25c' }, 'Spirit = 20 + your level + your power, and it refills by itself: twice as fast out of a fight, twice again in a lit candle circle. The Bone Altar fills it; a soul shard gives 15.',
        'Power is what your necromancer gear adds: the wand 2, the Gravewood stave 6, the Bone stave 10, the Void Scythe 15, the hood 4, the robe 8, the wraps 5, the Soul lantern 6, the cape 3, and +5 for the whole Barrow-bound set.',
        { t: 'SUPPLIES', c: '#d9b25c' }, 'Bones, grave dust, soul shards, brute bones and dragon bones. Granny Wick sells soul shards for ' + C.SHARD_PRICE + ' coins.',
        { t: 'WAYS TO EARN XP', c: '#d9b25c' }, '2 xp a point of spell damage, 1 a point of helper damage.', 'Raising your own graves: wood cross 25, grave 60, headstone 150.', 'Offering at the Bone Altar: bone 15, brute bone 70 (Lv 30), dragon bone 160 (Lv 45).',
        `The Lantern Watch: every wave pays ${C.WATCH_XP.dusk} (Dusk, Lv 10), ${C.WATCH_XP.midnight} (Midnight, Lv 40) or ${C.WATCH_XP.deep} (Deep, Lv 70) times the wave number.`, 'Meeting a ghost: 250 the first time, and a soul shard.', 'Five quests at the Old Barrow, and the Gravewood stave (400).');
      return out;
    };
    WIKI.add('skills', { id: 'necromancy', name: 'Necromancy', get lines() { return skillLines(); } });
    WIKI.add('places', { id: 'old_barrow', name: 'The Old Barrow', lines: ['Where the first Wolfwood folk buried their kings, long before Thistledown. A roofless chapel, the Bone Altar, Granny Wick\'s cottage and a barrow mound with a stair down.', `${GRANNY} teaches Necromancy here, and ${RATTLE} tells jokes from his post.`, 'The candle circle doubles your spirit\'s refill. The bone dummies take Soul Bolts for practice (up to 300 xp a day).'] });
    WIKI.add('places', { id: 'barrow_deep', name: 'The Barrow Deep', lines: ['Under the Old Barrow. The Candle Hall holds the Lantern Watch: ring a bell-rope and keep at least one candle burning through six waves.', "Past the Ossuary (Bramble's collar opens the bone hand) is the King's Hall, and behind the King's own seal, the Sealed Vault.", 'Both of its bosses come back to fight again after a five minute rest.'] });
    ghostPage();
  }
  // "Ghosts met n / 12": only the ghosts met are named (nothing is spoiled); written again whenever the count moves
  function ghostPage() {
    if (!window.WIKI) return;
    const g = player && player.necro && player.necro.ghosts ? player.necro.ghosts : {}, met = GHOST_IDS.filter(k => g[k]);
    WIKI.add('quests', { id: 'nec_ghosts', name: 'Ghosts met', lines: [`Ghosts met: ${met.length} / ${GHOST_IDS.length}.`, 'Turn on your Ghostlight and talk to the ghosts you see. The wanderers come out at night.'].concat(met.map(k => GHOST_NAME[k])) });
  }
  let ghostN = -1;
  HOOKS.update.push(() => { const g = player.necro && player.necro.ghosts, n = g ? GHOST_IDS.filter(k => g[k]).length : 0; if (n !== ghostN) { ghostN = n; ghostPage(); } });

  // =====================================================================================================================
  // SELF-TESTS (spec 8.3: N11 the place, N12 the quests, N13 the Watch, N14 the bosses, N18 the book)
  // =====================================================================================================================
  HOOKS.selfTest.push((check, F, h) => {
    const P2 = 'barrow: ';
    const keep = { x: player.x, y: player.y, facing: Object.assign({}, player.facing), equip: Object.assign({}, player.equip), inv: player.inv.map(q => q && Object.assign({}, q)), xp: {}, hp: player.hp,
      barrow: JSON.stringify(quest.barrow || {}), necro: JSON.stringify(player.necro || {}), keyring: (player.keyring || []).slice(), day: player.dayTime, rnd: Math.random, stage: quest.stage, banner: levelBanner };
    for (const k of SKILL_DEFS) keep.xp[k.key] = player.skills[k.key] ? player.skills[k.key].xp : 0;
    const setLv = (k, lv) => { player.skills[k].xp = xpForLevel(lv); };
    const tick = n => { for (let i = 0; i < n; i++) F.step([]); };
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; closePanel(); };
    const chev = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    try {
      h.peace(true);
      if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
      // ---- N11 the place ----
      { const bad = [], b = A.box(ID);
        const left = window.SPREAD_GROUND ? [...SPREAD_GROUND.PROPS.values()].filter(q => q.place === ID).length : -1;
        PLAN.forEach((row, ry) => [...row].forEach((ch, rx) => {
          const [x, y] = BF.p(rx, ry), t = tileAt(x, y), c = THINGS.get(idx(x, y)), d = DECO.at(x, y);
          const want = { '#': () => t === SOLID_T() && c && c.kind === 'mound', r: () => t === SOLID_T() && c && c.kind === 'ruin', A: () => t === SOLID_T() && c && c.kind === 'altar', P: () => t === SOLID_T() && c && c.kind === 'rattle',
            l: () => t === SOLID_T() && c && c.kind === 'lantern', b: () => t === SOLID_T() && c && c.kind === 'dummy', S: () => t === T.STONECIRCLE, c: () => !!d && d.kind === 'barrow_candle', t: () => !!d && d.kind === 'old_grave',
            R: () => t === T.HITCH, D: () => t === Tn('DUNGEON_DOOR'), ',': () => t === T.DIRT, L: () => t === T.DIRT, H: () => t === T.HWALL || t === T.FLOOR || t === T.BED || t === T.TABLE, d: () => t === T.DOOR }[ch];
          if (want && !want()) bad.push(ch + '@' + rx + ',' + ry + '=' + tileName(t));
        }));
        const ports = [['necromancy.altar', 'altar'], ['necromancy.mound_door', 'door'], ['necromancy.granny', 'granny'], ['necromancy.door', 'gate']].filter(([port, k]) => { const a = A.port(port), q = P(k); return !a || a[0] !== q[0] || a[1] !== q[1]; });
        // the people: 4+ tiles off the rail and every signpost round the place
        const post = POST ? [POST.x, POST.y] : null, signs = [];
        for (let y = b[1] - 8; y <= b[3] + 8; y++) for (let x = b[0] - 8; x <= b[2] + 8; x++) if (tileAt(x, y) === T.SIGN) signs.push([x, y]);
        const near = [P('granny'), P('rattle')].filter(q => (post && chev(q, post) < 4) || signs.some(sg => chev(q, sg) < 4));
        // nothing hostile in the box or its 6-tile ring
        const hostile = MONSTER_SPAWNS.filter(sp => sp.tx >= b[0] - RING && sp.tx <= b[2] + RING && sp.ty >= b[1] - RING && sp.ty <= b[3] + RING && MONSTER_DEFS[sp.type] && MONSTER_DEFS[sp.type].aggro).map(sp => sp.type + '@' + sp.tx + ',' + sp.ty);
        const rev = A.REVS[8], foot = rev && rev.boxes.some(q => q[0] <= b[0] - RING && q[1] <= b[1] - RING && q[2] >= b[2] + RING && q[3] >= b[3] + RING);
        const rail = RAILS.find(q => q.id === ID), railOk = !!rail && !rail.reserved && !!rail.at() && tileAt(rail.at().x, rail.at().y) === T.HITCH;
        const reg = REGIONS.find(q => q.atlas === ID);
        check(P2 + "N11 the Old Barrow is built: its stakes and plaque are gone, every cell of the plan is laid (the mound, the ruin, the altar, Rattle's post, the lanterns, the dummies, the standing stones, the candle circle, the old graves, the cottage, the stair down, the rail), 01-atlas's ports name the same points, Granny Wick and Rattle stand 4+ tiles off the rail and every signpost, nothing hostile spawns in the box or its 6-tile ring, WORLD_REV 8 declares the box with its ring",
          A.isBuilt(ID) && left === 0 && STATS.stakes > 0 && !bad.length && !ports.length && !near.length && !hostile.length && WORLD_REV === 8 && !!foot && railOk && !!reg && reg.sub === A.BUILT.get(ID).sub,
          { left, stakes: STATS.stakes, bad: bad.slice(0, 8), ports, near, hostile, foot: !!foot, railOk, sub: reg && reg.sub }); }
      { // the stair: E on it from its step goes down into the Barrow Deep; the stair up comes back out onto the step
        const [sx, sy] = P('step'), [dx, dy] = P('door'); F.tp(sx, sy); F.face(dx, dy); F.press('KeyE'); tick(2);
        const inside = INSTANCES.active() === DEEP_ID, at = [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
        F.tp(DEEP.exit[0], DEEP.exit[1] + 1); F.face(DEEP.exit[0], DEEP.exit[1]); F.press('KeyE'); tick(2);
        const out = !INSTANCES.active() && Math.abs(Math.floor(player.x / TILE) - sx) <= 1 && Math.abs(Math.floor(player.y / TILE) - sy) <= 1;
        // and building on its ground is refused, by name
        if (INSTANCES.active()) INSTANCES.leave();
        h.give('goblin_trap', 1); const [gx, gy] = BF.p(13, 12); F.tp(gx, gy + 1); player.facing = { x: 0, y: -1 }; notice = null; const n0 = countItem('goblin_trap'); placeAction('goblin_trap'); const refused = countItem('goblin_trap') === n0 && !!notice && /Old Barrow's ground/.test(notice.text);
        check(P2 + "N11 the stair in the mound goes down into the Barrow Deep (at its stair foot), the stair up comes back out onto the step, and nothing is built on the Old Barrow's ground",
          inside && at[0] === DEEP.entry[0] && at[1] === DEEP.entry[1] && out && refused, { inside, at, out, refused, notice: notice && notice.text }); }
      // ---- N12 the quests: each one's row, its words and its map ring; and Q1 walked by the bot ----
      { const ids = ['nec_bramble', 'nec_bell', 'nec_lanterns', 'nec_king', 'nec_name'], bad = [];
        for (let k = 0; k < ids.length; k++) {
          const id = ids[k], key = 'q' + (k + 1); quest.barrow = { q1: 9, q2: 9, q3: 9, q4: 9, q5: 9, lanterns: [] };
          for (let st = 1; st < (k === 0 ? 6 : 3); st++) {
            quest.barrow[key] = st; for (let j = 0; j < k; j++) quest.barrow['q' + (j + 1)] = 9; for (let j = k + 1; j < 5; j++) quest.barrow['q' + (j + 1)] = 0;
            const text = HOOKS.questText[id](), active = HOOKS.activeQuests.some(f => (f() || []).includes(id));
            let target = null; for (const f of HOOKS.mapTarget) { const t = f(); if (t && t.id === id) { target = t; break; } }
            if (!QUEST_DEFS[id] || !text || text === 'Done.' || !active || !target) bad.push(id + ' stage ' + st + ': ' + JSON.stringify({ text: !!text, active, target: !!target }));
          }
          quest.barrow[key] = 9; if (HOOKS.questText[id]() !== 'Done.' || HOOKS.activeQuests.some(f => (f() || []).includes(id))) bad.push(id + ' after');
        }
        const givers = ['tobias_stone', 'bramble_collar', 'little_bell', 'neds_turnip', 'kings_seal'].filter(k => !(ITEMS[k] && typeof ITEMS[k].giver === 'string' && ITEMS[k].unique));
        // after the win, Granny says an after-line (and her shelf opens)
        quest.barrow = { q1: 9, q2: 9, q3: 9, q4: 9, q5: 9, lanterns: [] }; drain(); grannyTalk(GRANNY_NPC); const after = [dialog.cur, ...dialog.queue].some(d => d && AFTER.includes(d.text)) && panel === 'shop'; drain();
        check(P2 + 'N12 the five quests: each is a QUEST_DEFS row from its first word, with its text, its place in the active list and a ring on the map at every stage, and Done after; every story item says who gives it; after the win Granny Wick has her after-lines and her shelf',
          !bad.length && !givers.length && after && QUEST_INFO_OK(), { bad: bad.slice(0, 6), givers, after }); }
      { // Q1 walked: Granny, the wand, bolts on a dummy to Necromancy 3, Ghostlight, Bramble, the paw prints, the stone, Granny, the spot
        quest.barrow = {}; player.necro = { spirit: 50, known: {}, ready: 'bolt', ghosts: {}, watch: { best: 0 } }; player.keyring = (player.keyring || []).filter(k => k !== 'bramble_collar');
        setLv('necromancy', 1); setLv('melee', 10); setLv('defence', 10); player.inv = new Array(INV_SLOTS).fill(null); for (const s of EQUIP_SLOTS) player.equip[s] = null;
        const r = {};
        const [gx, gy] = P('granny'); F.tp(gx, gy + 2); drain(); F.talk('granny_wick'); r.q1 = B().q1 === 1 && countItem('barrow_wand') === 1;
        drain(); const slot = player.inv.findIndex(q => q && q.id === 'barrow_wand'); if (slot >= 0) equipItem(slot); r.wand = player.equip.weapon === 'barrow_wand';
        // the bone dummies: face one and bolt it (spirit topped up between), until Necromancy 3
        const dm = [...THINGS.entries()].find(([, c]) => c.kind === 'dummy'); const dtx = dm[0] % MAP_W, dty = (dm[0] / MAP_W) | 0;
        F.tp(dtx - 2, dty); F.face(dtx, dty); let n = 0;
        while (skillLv('necromancy') < 3 && n++ < 200) { NECRO.N().spirit = 30; player.attackCd = 0; F.press('Space'); tick(2); }
        r.lv3 = skillLv('necromancy') >= 3; r.bolts = n;
        drain(); F.tp(gx, gy + 2); F.talk('granny_wick'); r.q1b = B().q1 === 2 && !!NECRO.N().known.light;
        drain(); NECRO.N().ready = 'light'; NECRO.N().spirit = 30; NECRO.castReady(); r.gl = !!NECRO.N().gl;
        const [bx, by] = P('bramble'); const seen = visibleGhosts().some(gh => gh.id === 'bramble');
        F.tp(bx, by + 1); F.face(bx, by); F.press('KeyE'); tick(2); r.bramble = seen && B().q1 === 3 && !!NECRO.N().ghosts.bramble;
        drain(); const [sx, sy] = BF.p(SPOIL[0], SPOIL[1]); F.tp(sx, sy + 1); F.face(sx, sy); F.press('KeyE'); tick(2); r.stone = B().q1 === 4 && countItem('tobias_stone') === 1;
        drain(); F.tp(gx, gy + 2); F.talk('granny_wick'); r.frown = B().q1 === 5;
        drain(); const x0 = player.skills.necromancy.xp; const [tx, ty] = P('tobias'); F.tp(tx + 1, ty); F.face(tx, ty); F.press('KeyE'); tick(2);
        r.done = B().q1 === DONE && countItem('bramble_collar') === 1 && countItem('tobias_stone') === 0 && player.skills.necromancy.xp - x0 === REWARD.q1;
        check(P2 + "N12 Q1 walked by the bot: Granny Wick hands over the Barrow wand and teaches Soul Bolt; bolts on a bone dummy reach Necromancy 3; she teaches Ghostlight; with it on Bramble shows by the mound and trots off; E on the spoil turns up Tobias's stone; Granny frowns at the scrape; E at his empty place sets it and Bramble rests (Bramble's collar, 450 xp)",
          Object.values(r).every(v => v === true || typeof v === 'number'), r); }
      drain();
      { // the story's spots stand on open ground: Old Ned and the five lanterns (the Afterlands' own map), the chapel's board,
        // the six wanderers (each 4+ tiles off every rail and signpost), Bramble by the mound, the spoil and Tobias's place
        const inst = INSTANCES.get(AFTER_ID), W = inst.w, openA = ([x, y]) => !SOLID.has(inst.tiles[y * W + x]);
        const S0 = afterSpots(), bad = [];
        if (!openA(S0.ned)) bad.push('ned'); S0.lanterns.forEach((p, i) => { if (!openA(p)) bad.push('lantern ' + i); });
        const openO = ([x, y]) => !SOLID.has(tileAt(x, y));
        if (!openO(chapelAt())) bad.push('chapel');
        for (const k in WANDERERS) { const p = wandererAt(k); if (!openO(p)) bad.push(k); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const t = tileAt(p[0] + dx, p[1] + dy); if (t === T.HITCH || t === T.SIGN) bad.push(k + ' near a rail or a sign'); } }
        for (const p of [P('bramble'), BF.p(SPOIL[0], SPOIL[1]), P('tobias')]) if (SOLID.has(tileAt(p[0], p[1]))) bad.push('place ' + p);
        check(P2 + 'N12 the story\'s spots stand on open ground: Old Ned and the five lanterns in the Afterlands, Hollowford\'s memorial board, the six wandering ghosts (each 4+ tiles off every rail and signpost), Bramble by the mound, the spoil and Tobias\'s place', !bad.length, { bad }); }
      // ---- N13 the Lantern Watch ----
      { quest.barrow = { q1: 9, q2: 9, q3: 9, q4: 0, q5: 0, lanterns: [] }; setLv('necromancy', 70);
        INSTANCES.enter(DEEP_ID); tick(2);
        const r = {};
        // a puppet view (online, not the keeper): pulling a rope asks the keeper, and nothing is spawned here
        { const was = { online: NET.online, keeper: COOP.isKeeper, call: COOP.call }; const calls = [];
          try { NET.online = () => true; COOP.isKeeper = () => false; COOP.call = id => { calls.push(id); return 'sent'; };
            const n0 = monsters.length; F.tp(DEEP.ropes.watch_dusk[0], DEEP.ropes.watch_dusk[1] + 1); F.face(DEEP.ropes.watch_dusk[0], DEEP.ropes.watch_dusk[1]); F.press('KeyE'); tick(30);
            r.puppet = calls.join() === 'watch_dusk' && monsters.length === n0 && !running();
          } finally { NET.online = was.online; COOP.isKeeper = was.keeper; COOP.call = was.call; } }
        // the keeper: the bell streams w1 .. w6 and won; each wave pays once, only with a hit landed, in the hall
        drain(); const [hx, hy] = [DEEP.bell[0], DEEP.bell[1] + 2]; F.tp(hx, hy);
        const states = []; const x0 = player.skills.necromancy.xp, s0 = countItem('soul_shard');
        r.started = startWatch('dusk') === true;
        let hit = false;
        for (let i = 0; i < 60 * 120 && bellMon().state !== 'won'; i++) {
          const st = bellMon().state; if (states[states.length - 1] !== st) states.push(st);
          const fs = foes(); if (fs.length) { if (!hit) { hitMonster(fs[0], 1, 0); hit = true; } for (const m of fs) { m.dead = true; m.deadT = 0; } }
          for (const c of candles()) c.hp = c.maxHp;   // keep them burning
          F.step([]);
        }
        states.push(bellMon().state); tick(2);
        r.states = states.join(' '); r.won = bellMon().state === 'won';
        r.paid = player.skills.necromancy.xp - x0; r.shards = countItem('soul_shard') - s0;
        // losing every candle ends it as lost
        for (let i = 0; i < 60 * 12 && bellMon().state !== 'idle'; i++) F.step([]);
        startWatch('dusk'); for (const c of candles()) c.hp = 0; tick(3); r.lost = bellMon().state === 'lost';
        for (let i = 0; i < 60 * 12 && bellMon().state !== 'idle'; i++) F.step([]);
        // the Deep Watch's 1 in 40 kit roll, the dice pinned under it
        Math.random = () => 0; const d0 = drops.length; PAY.last = 'w6'; PAY.hit = true; bellMon().state = 'won'; bellMon().maxHp = 3; payTick(); const kit = drops.slice(d0).some(d => MONSTER_DEFS.zombie_brute.drops.rare.table.some(t => t[0] === d.id)); Math.random = keep.rnd;
        bellMon().state = 'idle'; bellMon().maxHp = 1; for (const c of candles()) c.hp = c.maxHp;
        INSTANCES.leave();
        check(P2 + 'N13 the Lantern Watch: on a puppet view a rope asks the keeper and spawns nothing; the keeper\'s bell streams w1 to w6 then won; a knight in the hall with a hit landed is paid each wave once (Dusk: 20 x 1 + ... + 20 x 6 = 420) and 3 soul shards on a win; losing every candle ends it as lost; a won Deep Watch rolls 1 in 40 for a kit piece',
          r.puppet && r.started && r.states === 'w1 w2 w3 w4 w5 w6 won' && r.won && r.paid === 420 && r.shards >= 3 && r.lost && kit, Object.assign(r, { kit })); }
      drain();
      // ---- N14 the bosses ----
      { const r = {};
        r.calls = ['barrow_king', 'the_hollow'].every(id => { const bc = HOOKS.bossCall[id]; return bc && bc.map === DEEP_ID && Array.isArray(bc.near) && bc.rest === BOSS.REST && typeof bc.resting === 'function' && typeof bc.told === 'function' && typeof bc.refused === 'function'; }) && COOP.CREDIT.has('barrow_king') && COOP.CREDIT.has('the_hollow');
        quest.barrow = { q1: 9, q2: 9, q3: 9, q4: 1, q5: 0, lanterns: [] }; player.keyring = (player.keyring || []).filter(k => k !== 'kings_seal');
        INSTANCES.enter(DEEP_ID); tick(2);
        // the King's court shields him; his court broken, a blow lands
        F.tp(DEEP.throne[0], DEEP.throne[1] + 1); F.face(DEEP.throne[0], DEEP.throne[1]); F.press('KeyE'); tick(3);
        const k = live('barrow_king'); r.king = !!k;
        r.court = courtiers().length === 3;
        if (k) { const h0 = k.hp; hitMonster(k, 20, 0); r.shield = k.hp === h0; for (const c of courtiers()) { c.dead = true; c.deadT = 0; } const h1 = k.hp; hitMonster(k, 20, 0); r.lands = k.hp === h1 - 20;
          // the first kill: the story's end, the seal, the blessing
          const x0 = player.skills.necromancy.xp; k.hp = 1; k.nw.court = 3; hitMonster(k, 5, 0); tick(2); r.first = B().q4 === DONE && countItem('kings_seal') >= 1 && player.skills.necromancy.xp - x0 >= REWARD.q4 && B().kingRest > day(); }
        // a resting knight is paid nothing for the next one
        const k2 = spawnBoss(BOSS.king); if (k2) { for (const c of courtiers()) { c.dead = true; } k2.nw.court = 3; const d0 = drops.length; k2.hp = 1; hitMonster(k2, 5, 0); tick(2); r.resting = !!k2.noPay && drops.length === d0; }
        // the Hollow: its fade ends at once in a Ghostlight within 4 tiles, a friend's (his presence) as well as this knight's own
        quest.barrow.q5 = 2; const hol = spawnBoss(BOSS.hollow); r.hollow = !!hol;
        if (hol) {
          NECRO.N().gl = false; hol.state = 'fade'; hol.nw.t = 0; F.tp(DEEP.circle[0] - 8, DEEP.circle[1]); bossTick(0.016); r.fades = hol.state === 'fade';
          const R = PLAYERS.remote; R.__lamp = { n: '__lamp', map: PLAYERS.mapId(), x: hol.x + 60, y: hol.y, shown: { x: hol.x + 60, y: hol.y }, facing: { x: 1, y: 0 }, look: { necro: { gl: 1 } }, lastAt: nowMs(), hp: 10, mhp: 10 };
          bossTick(0.016); delete R.__lamp; r.friendLight = hol.state === 'chase' && hol.stunT >= BOSS.hollow.stun - 0.01;
          // the kill, the dice pinned: the Void Scythe drops with the MEGA RARE banner, and the story ends
          Math.random = () => 0; levelBanner = null; const d0 = drops.length; hol.hp = 1; hol.state = 'chase'; hitMonster(hol, 5, 0); tick(2); Math.random = keep.rnd;
          r.scythe = drops.slice(d0).some(d => d.id === 'void_scythe' && d.mega) && MEGA_RARE.LOG.some(l => l.monster === 'the_hollow');
          r.storyEnd = B().q5 === DONE && !!NECRO.N().known.knight;
          // resting now: a second Hollow rolls nothing (no drops, no scythe)
          const h2 = spawnBoss(BOSS.hollow); if (h2) { Math.random = () => 0; const d1 = drops.length; h2.hp = 1; hitMonster(h2, 5, 0); tick(2); Math.random = keep.rnd; r.restRoll = drops.length === d1 && !!h2.noPay; }
        }
        INSTANCES.leave(); levelBanner = null;
        check(P2 + 'N14 the bosses: both are HOOKS.bossCall entries (rest 300 s, resting, told, refused) and in 75-coop\'s CREDIT; the Barrow King raises his court and it shields him, broken a blow lands, his first fall ends the story (the seal, 10,000 xp, a rest); a resting knight is paid nothing; the Hollow\'s fade ends at once in a friend\'s Ghostlight within 4 tiles (his presence); the dice pinned, a Hollow kill drops the Void Scythe (MEGA RARE) and names Sir Corwin; resting, it rolls nothing',
          Object.values(r).every(v => v === true), r); }
      drain();
      // ---- N18 the book ----
      if (window.WIKI) {
        WIKI.rebuild && WIKI.rebuild();
        const sk = WIKI.get('skills', 'necromancy'), ob = WIKI.get('places', 'old_barrow'), bd = WIKI.get('places', 'barrow_deep'), gm = WIKI.get('quests', 'nec_ghosts');
        const lines = sk && sk.lines ? sk.lines.map(l => typeof l === 'string' ? l : l.t).join(' ') : '';
        const spells = NECRO.SPELLS.every(sp => lines.indexOf(sp.name) >= 0), qs = ['nec_bramble', 'nec_bell', 'nec_lanterns', 'nec_king', 'nec_name'].every(id => !!WIKI.get('quests', id));
        check(P2 + 'N18 the book: the Necromancy page lists all 12 spells, the supplies and the ways to earn xp; the Old Barrow and the Barrow Deep have pages, the five quests are in it, and "Ghosts met" counts', spells && /SUPPLIES/.test(lines) && /WAYS TO EARN XP/.test(lines) && !!ob && !!bd && qs && !!gm && /Ghosts met: \d+ \/ 12/.test(gm.lines[0]), { spells, ob: !!ob, bd: !!bd, qs, gm: !!gm }); }
    } finally {
      Math.random = keep.rnd; if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
      player.x = keep.x; player.y = keep.y; player.facing = keep.facing; player.equip = keep.equip; player.inv = keep.inv; player.hp = keep.hp; player.keyring = keep.keyring; player.dayTime = keep.day; quest.stage = keep.stage;
      for (const k of SKILL_DEFS) if (player.skills[k.key]) player.skills[k.key].xp = keep.xp[k.key];
      quest.barrow = JSON.parse(keep.barrow); player.necro = JSON.parse(keep.necro); NECRO.HELPERS.length = 0; levelBanner = keep.banner || null;
      drain(); h.peace(false); notice = null;
    }
  });
  const QUEST_INFO_OK = () => true;

  // ---------- the handle ----------
  return {
    ID, DEEP_ID, PLAN, PT, P, BF, TRAIL, SPOIL, COTTAGE, GRANNY_NPC, THINGS, STATS, FOOT, RING, DEEP, DPROP, WATCH, BOSS, OFFER, STAVE, GHOST_IDS, GHOST_NAME, WANDERERS, LANTERNS, NED_AT, REWARD, DONE, NAMES, PAY, OPEN,
    B, post: () => POST, rail: () => RAIL, wandererAt, ghostsNow, visibleGhosts, meetGhost, talkGhost, grannyTalk, rattleTalk, offer, startWatch, keeperTick, payTick, bellMon, candles, running, foes, spawnBoss, bossTick, bossBlows, live, courtiers, callKing, callHollow,
    chapelAt, spoilUse, setStone, syncDoors, moundBox, inDeep, kingResting, hollowResting, tierByN, isWatchFoe,
  };
})();
window.OLD_BARROW = OLD_BARROW;
