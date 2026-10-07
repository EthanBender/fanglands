// ============================================================================
// THE GREAT SPREAD: THE SAVE MIGRATION (Stage 4c of the spread spec, ~/.fanglands/work/spread/spec.md §10)
// src/97-spread.js
//
// The owner's decision (2 Oct): every knight goes back to spawn; quest progress is kept; what the story changed in the
// world is made again from quest state; anything else placed or changed on the old map is cleared, and what he placed
// comes back to him (the bank, then the pack, then Aldous keeps it until there is room).
//
// How a world-1 save comes in (WORLD_V 2 since this stage):
//   1. 04-state's load() parses the save and, because its worldV is below WORLD_V, runs HOOKS.saveIn: SPREAD.prepare(d)
//      takes the old map's diffs, crops, regrowth and fires out of d (decoded with the old width into old x, y and the
//      tile's NAME), so the core never lays an old index on the new map; it sets player.cityV = 1 (95's own capital pass
//      has nothing to do) and holds SAVE_LOCK, so nothing is written (here or to the cloud) until the knight stands in
//      the new world. Saves inside a dungeon or on the island already hold the step outside (16-instances' save), and
//      the old region, walk path and tied mare are cleared here.
//   2. The core load and every feature's load wrapper run, on a world generated fresh for this map.
//   3. This file's load wrapper is the outermost (97 sorts after 96; 99-boot only calls load): SPREAD.finish() puts the
//      knight at spawn, translates the positions the quest keeps (§10's table), runs every HOOKS.remake (the story's
//      tiles at their new cells), sorts the old diffs by tile NAME (placed things refunded, machines parked round the
//      Dozer Bay, the mare tied at Fennick's rail, crops refunded, the story's tiles already re-made, the rest dropped),
//      lets go of SAVE_LOCK and saves: the save is worldV 2 from then on, and a second load changes nothing.
//   A preparation or a finish that throws keeps the old save byte for byte (SAVE_KEPT, 04-state's plaque).
// What he hears, once: the Voice ("While you slept, the land grew and settled. You wake in Thistledown."), what came back
// and where, where the mare and the machines are; a NEW WORLD plaque and page list the same, and its plate opens the map
// on the gold ring of his next quest step.
//
// worldRev sweeps (§10): a later stage that changes ground knights build on declares ATLAS.REVS[n] = { boxes } and bumps
// WORLD_REV; an older worldRev's save is swept in those boxes only, with the same sorting (SPREAD.sweep).
// Every position here is read from the Atlas (oldToNew / oldToNewWorld are the migration's own mappings) or from the game.
// window.SPREAD exposes the migration for the tools (tools/spread-migrate-check.mjs) and the checks.
// ============================================================================
{
  // ---------- what each old tile is, by NAME ----------
  // the knight's machines and their wrecks (b): parked round the Dozer Bay, never deleted; the mare: tied at her rail
  const MACHINES = ['MECH', 'DOZER', 'BEAST', 'WRECK', 'DOZER_WRECK', 'BEAST_WRECK'];
  const MARE = 'HORSE';
  const MACHINE_WORDS = { MECH: ['walker', 'walkers'], DOZER: ['bulldozer', 'bulldozers'], BEAST: ['Barrelbeast', 'Barrelbeasts'],
    WRECK: ['walker wreck', 'walker wrecks'], DOZER_WRECK: ['bulldozer wreck', 'bulldozer wrecks'], BEAST_WRECK: ['Barrelbeast wreck', 'Barrelbeast wrecks'] };
  // a ridden machine's tile when it is parked (player.mech.kind; none is the walker)
  const RIDDEN = { walker: 'MECH', dozer: 'DOZER', beast: 'BEAST' };
  // a ripe crop gives 2 to 4 at the harvest (06-systems): the migration gives the middle, so it rolls no dice
  const RIPE_GIVES = 3;
  // (a) a tile placed from an item: HOOKS.placedFrom first (a feature's own placeables), then 95-thistledown's reverse
  // lookup (an item whose `place` is this tile's name)
  function placedItemFor(name) {
    if (HOOKS.placedFrom[name] && ITEMS[HOOKS.placedFrom[name]]) return HOOKS.placedFrom[name];
    if (window.CAPITAL && CAPITAL.placedItemFor && typeof T[name] === 'number') return CAPITAL.placedItemFor(T[name]);
    for (const id in ITEMS) if (ITEMS[id] && ITEMS[id].place === name) return id;
    return null;
  }
  const seedFor = crop => { for (const id in ITEMS) if (ITEMS[id] && ITEMS[id].seed === crop) return id; return 'potato_seed'; };
  // every place in a save that holds a map position, and what the migration does with it (proof 3, the sweep, walks a
  // migrated save and fails on a position-shaped value whose path is not here)
  const HANDLED = [
    [/^player$/, 'the knight: back to spawn'],
    [/^player\.facing$/, 'a direction, not a place: south'],
    [/^player\.home$/, 'cleared (the lodestone comes back)'],
    [/^player\.bedSpawn$/, 'cleared (a placed bed comes back)'],
    [/^player\.horse\.at$/, 'the mare: tied at her rail'],
    [/^player\.companion$/, 'the hero: beside the knight'],
    [/^player\.walkPath(\[\])?$/, 'cleared'],
    [/^player\.tapTarget$/, 'cleared'],
    [/^player\.chests\[\]$/, 'translated with oldToNew inside a place, dropped outside'],
    [/^player\.house\./, "the island's own grid (an instance): untouched"],
    [/^quest\.markers\.seen\.<x,y>$/, 'translated with oldToNew, kept only where that marker stands'],
    [/^quest\.graves(\[\])?$/, 'cleared'],
    [/^quest\.hollowford\.wreck$/, "translated (Hollowford's frame); re-made by 20-hollowford's remake"],
    [/^quest\.fang\.looted\[\]$/, "translated through the Fang's lair's frame"],
    [/^quest\.dwarf\.chests\[\]$/, "Deepholm's chests (an instance): untouched"],
    [/^quest\.instances\.chests\.<x,y>$/, "the dungeons' chests (instances): untouched"],
  ];

  const S = window.SPREAD = { pending: null, last: null, remaking: null, MACHINES, MARE, HANDLED, placedItemFor };

  // ---------- 1. prepare (HOOKS.saveIn): right after JSON.parse, before anything is loaded ----------
  function prepare(d) {
    if ((d.worldV | 0) >= WORLD_V) return prepareRev(d);
    const oldW = d.mapW || 160;
    const at = i => ({ x: i % oldW, y: Math.floor(i / oldW) });
    const nameOf = t => typeof t === 'string' ? t : typeof t === 'number' ? tileName(t) : null;
    const P = { kind: 'spread', oldW, diffs: [], crops: [], regrow: 0, fires: 0, horseAt: null };
    for (const e of Array.isArray(d.mapDiffs) ? d.mapDiffs : []) {
      if (!Array.isArray(e) || typeof e[0] !== 'number') continue;
      const n = nameOf(e[1]); if (n) P.diffs.push(Object.assign(at(e[0]), { name: n }));
    }
    for (const c of Array.isArray(d.crops) ? d.crops : []) if (c && typeof c.i === 'number') P.crops.push(Object.assign(at(c.i), { stage: c.stage | 0, crop: c.crop || null }));
    P.regrow = Array.isArray(d.regrow) ? d.regrow.length : 0; P.fires = Array.isArray(d.fires) ? d.fires.length : 0;
    // the core's width remap never sees an old index
    d.mapDiffs = []; d.regrow = []; d.crops = []; d.fires = [];
    const p = d.player && typeof d.player === 'object' ? d.player : null;
    if (p) {
      p.cityV = 1;   // 95-thistledown's capital pass: nothing of the old map is left for it to move
      const h = p.horse; if (h && typeof h === 'object') { P.horseAt = Array.isArray(h.at) ? h.at.slice(0, 2) : null; h.at = null; h.under = null; }
      p.region = null; p.walkPath = null; p.tapTarget = null;
    }
    S.pending = P;
    SAVE_LOCK = true; saveLockSay = SAVE_KEPT;   // nothing is written until finish() has put him in the new world
  }
  // a save of this world from an older worldRev: only the diffs inside the new footprints come out, to be swept
  function prepareRev(d) {
    const from = d.worldRev | 0, boxes = [];
    for (let r = from + 1; r <= WORLD_REV; r++) { const rev = ATLAS.REVS && ATLAS.REVS[r]; if (rev && Array.isArray(rev.boxes)) boxes.push(...rev.boxes); }
    const W = d.mapW || MAP_W, inBox = (x, y) => boxes.some(b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
    const P = { kind: 'rev', from, boxes, diffs: [], crops: [] }, keep = [], keepCrops = [];
    for (const e of Array.isArray(d.mapDiffs) ? d.mapDiffs : []) {
      if (!Array.isArray(e) || typeof e[0] !== 'number') continue;
      const x = e[0] % W, y = Math.floor(e[0] / W);
      if (inBox(x, y)) P.diffs.push({ x, y, name: typeof e[1] === 'string' ? e[1] : tileName(e[1]) }); else keep.push(e);
    }
    for (const c of Array.isArray(d.crops) ? d.crops : []) { const x = c.i % W, y = Math.floor(c.i / W); if (inBox(x, y)) P.crops.push({ x, y, stage: c.stage | 0, crop: c.crop || null }); else keepCrops.push(c); }
    d.mapDiffs = keep; d.crops = keepCrops;
    S.pending = P;
    SAVE_LOCK = true; saveLockSay = SAVE_KEPT;
  }
  HOOKS.saveIn.push(prepare);

  // ---------- shared pieces of finish() and the sweep ----------
  const cellOf = q => q ? [Math.round(q[0]), Math.round(q[1])] : null;
  // a place's point through its frame (null on open land): the migration's own mapping
  const placeCell = (x, y) => cellOf(ATLAS.oldToNew(x, y));
  const anyCell = (x, y) => placeCell(x, y) || cellOf(ATLAS.oldToNewWorld(x, y));
  function newReport(kind) {
    return { kind, refunds: { bank: {}, pack: {}, owed: {} }, parked: {}, mare: null, remade: {}, dropped: {}, sorted: { remade: 0, same: 0, machine: 0, mare: 0, crop: 0, placed: 0, dropped: 0 }, crops: 0, lines: [], list: [] };
  }
  // (a) one of `id` back: the bank, then the pack, then Aldous keeps it (quest.spread.owed)
  function refund(R, id, qty) {
    for (let k = 0; k < qty; k++) {
      let where = 'owed';
      if (bankAdd(id, 1)) where = 'bank'; else if (addItem(id, 1) === 0) where = 'pack';
      R.refunds[where][id] = (R.refunds[where][id] || 0) + 1;
    }
  }
  // a cell round (cx, cy) where a machine or the mare may stand: 95-thistledown's parkSpot rings (the city's own open
  // ground, as the world made it, nothing of the knight's on it, not by a door or a person, off the High Street), 1..8,
  // then 1..16; past that any open ground nearer than 40 that is nobody's (never lost: no cell at all throws, and the
  // save is kept as it was)
  function parkAround(cx, cy) {
    if (window.CAPITAL && CAPITAL.parkSpot) { const s = CAPITAL.parkSpot(cx, cy, 8) || CAPITAL.parkSpot(cx, cy, 16); if (s) return s; }
    for (let r = 1; r <= 40; r++) {
      let best = null;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (!inMap(x, y) || mapDiffs.has(idx(x, y)) || !PLACEABLE_ON.has(tileAt(x, y)) || insideBuilding(x, y) || buildingAt(x, y)) continue;
        if (ATLAS.reservedAt(x, y) || ATLAS.onMainRoad(x, y)) continue;
        if (NPCS.some(n => circleHitsTile(n.px, n.py, 14, x, y)) || circleHitsTile(player.x, player.y, player.r, x, y)) continue;
        const d = Math.hypot(dx, dy); if (!best || d < best.d) best = { x, y, d };
      }
      if (best) return best;
    }
    throw new Error('the spread: no ground near ' + cx + ',' + cy + ' to park on');
  }
  const bayCell = () => { const b = window.DOZERUP && DOZERUP.bay; return b ? [b.x, b.y] : cellOf(ATLAS.port('thistledown.dozer_bay')); };
  function parkMachine(R, name) {
    const [bx, by] = bayCell(), s = parkAround(bx, by);
    changeTile(s.x, s.y, T[name]); R.parked[name] = (R.parked[name] || 0) + 1;
    (R.parkedAt = R.parkedAt || []).push([s.x, s.y, name, Math.max(Math.abs(s.x - bx), Math.abs(s.y - by))]);
    return s;
  }
  function tieMare(R) {
    if (!window.MOUNTS || !MOUNTS.tiles) return null;
    const h = player.horse || (player.horse = { owned: true, hp: MOUNTS.HP, at: null, under: null });
    h.owned = true;
    const post = MOUNTS.post || (q => q && { x: q[0], y: q[1] })(cellOf(ATLAS.port('thistledown.rail')));
    const s = parkAround(post.x, post.y), prev = tileAt(s.x, s.y);
    changeTile(s.x, s.y, MOUNTS.tiles.HORSE); h.at = [s.x, s.y]; h.under = tileName(prev);
    R.mare = [s.x, s.y];
    return s;
  }
  // HOOKS.remake, every one, recording the cells each one changed (a remade old diff is one of these, at its new cell)
  function remakeAll(R, ctx) {
    const remade = new Map();
    S.remaking = ctx || {};
    try {
      for (const f of HOOKS.remake) {
        const b = new Map(mapDiffs);
        f();
        let n = 0; for (const [i, t] of mapDiffs) if (b.get(i) !== t) { remade.set(i, t); n++; }
        if (n) R.remade[f.remakeOf || f.name || 'remake'] = (R.remade[f.remakeOf || f.name || 'remake'] || 0) + n;
      }
    } finally { S.remaking = null; }
    return remade;
  }
  // the old diffs, sorted by tile NAME (§10 classes a..e); `cell(x, y)` is where an old cell is now
  function sortDiffs(R, P, remade, cell) {
    const machines = []; let mare = false;
    for (const e of P.diffs) {
      const t = T[e.name], c = cell(e.x, e.y), ci = c && inMap(c[0], c[1]) ? idx(c[0], c[1]) : -1;
      const cls = (() => {
        // (d) the story's own tile, already made again at its new cell by a remake
        if (ci >= 0 && typeof t === 'number' && remade.get(ci) === t) return 'remade';
        if (e.name === MARE) { mare = true; return 'mare'; }
        // (b) a machine or a wreck: parked, never deleted
        if (MACHINES.includes(e.name)) { machines.push(e.name); return 'machine'; }
        // (c) a crop: refunded from the crop list below
        if (e.name === 'CROP') return 'crop';
        // the new world already has this very tile there (a door or a bed the world itself makes): nothing to give back
        if (ci >= 0 && typeof t === 'number' && tileAt(c[0], c[1]) === t && !mapDiffs.has(ci)) return 'same';
        // (a) placed from an item
        const id = placedItemFor(e.name);
        if (id) { refund(R, id, 1); return 'placed'; }
        // (e) everything else: stumps, rubble, tilled soil, fires, mined rock, regrown trees, cleared ground
        R.dropped[e.name] = (R.dropped[e.name] || 0) + 1; return 'dropped';
      })();
      R.sorted[cls]++; R.list.push([e.x, e.y, e.name, cls, c]);
    }
    for (const c of P.crops) {
      const ripe = c.stage >= 3, crop = c.crop && ITEMS[c.crop] ? c.crop : 'potato';
      refund(R, ripe ? crop : seedFor(crop), ripe ? RIPE_GIVES : 1); R.crops++;
    }
    return { machines, mare };
  }

  // ---------- words ----------
  const plural = w => /(s|x|ch|sh)$/.test(w) ? w + 'es' : /[^aeiou]o$/.test(w) ? w + 'es' : w + 's';
  const UNCOUNTED = new Set(['wheat', 'herbs', 'flour']);
  const itemWords = (id, n) => { const w = (ITEMS[id] && ITEMS[id].name || id).toLowerCase(); return UNCOUNTED.has(w) ? `${n} ${w}` : n === 1 ? (/^[aeiou]/.test(w) ? 'an ' : 'a ') + w : `${n} ${plural(w)}`; };
  const list = parts => parts.length <= 1 ? (parts[0] || '') : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  const itemsList = o => list(Object.keys(o).map(id => itemWords(id, o[id])));
  function machineLine(parked) {
    const names = MACHINES.filter(n => parked[n]);
    if (!names.length) return null;
    const total = names.reduce((s, n) => s + parked[n], 0);
    const words = names.map(n => parked[n] === 1 ? MACHINE_WORDS[n][0] : `${parked[n]} ${MACHINE_WORDS[n][1]}`);
    return `Your ${list(words)} ${total === 1 ? 'waits' : 'wait'} at the Dozer Bay.`;
  }
  function refundLines(R) {
    const out = [];
    if (Object.keys(R.refunds.bank).length) out.push(`Back in your bank: ${itemsList(R.refunds.bank)}.`);
    if (Object.keys(R.refunds.pack).length) out.push(`In your pack: ${itemsList(R.refunds.pack)}.`);
    if (Object.keys(R.refunds.owed).length) out.push(`Aldous the banker is keeping ${itemsList(R.refunds.owed)} for you. He hands them over when your bank has room.`);
    return out;
  }
  const mareName = () => (window.MOUNTS && MOUNTS.NAME) || 'Cinder';

  // ---------- 2. finish (the outermost load wrapper): the knight in the new world ----------
  function finish(P) {
    const R = newReport('spread');
    R.at = Math.round(player.playSeconds || 0); R.from = { worldV: 1, mapW: P.oldW }; R.stage = quest.stage;
    // the knight: off whatever he rode (the machine is parked below, with its hp kept the way exitMech keeps it)
    const mech = player.mech;
    if (mech) { player.mech = null; player.r = 13; player.speed = 175; if (mech.kind !== 'horse') player.mechHp = mech.hp; }
    player.bedSpawn = null; player.home = null; player.action = null; player.walkPath = null; player.tapTarget = null;
    player.region = null; player.moving = false; player.facing = { x: 0, y: 1 };
    const town = !!player.visitedVillage || quest.stage >= 5;
    const want = town ? VILLAGE_SPAWN : SPAWN;
    const sp = safeSpot(want.x, want.y, 13, 'person') || respawnPoint();
    player.x = sp.x; player.y = sp.y; areaBanner = null; clearBanners();
    R.wake = [Math.floor(player.x / TILE), Math.floor(player.y / TILE)]; R.town = town;
    // the positions the quest keeps (§10's table)
    const q = quest;
    if (q.markers && q.markers.seen && typeof q.markers.seen === 'object') {
      const out = {};
      for (const k of Object.keys(q.markers.seen)) {
        const m = /^([^:]+):(-?\d+),(-?\d+)$/.exec(k); if (!m) continue;
        const c = anyCell(+m[2], +m[3]), nk = m[1] + ':' + c[0] + ',' + c[1];
        if (window.MARKERS && MARKERS.get(nk)) out[nk] = q.markers.seen[k];
      }
      R.markers = [Object.keys(q.markers.seen).length, Object.keys(out).length];
      q.markers.seen = out;
    }
    if (Array.isArray(player.chests)) player.chests = player.chests.map(s => { const m = /^(-?\d+),(-?\d+)$/.exec(String(s)); const c = m && placeCell(+m[1], +m[2]); return c ? c[0] + ',' + c[1] : null; }).filter(Boolean);
    if (q.fang && Array.isArray(q.fang.looted)) {
      const F = ATLAS.frame('fang_lair');
      q.fang.looted = q.fang.looted.map(s => { const m = /^(-?\d+),(-?\d+)$/.exec(String(s)); if (!m) return null; const c = F.inOld(+m[1], +m[2]) ? cellOf(F.p(+m[1], +m[2])) : placeCell(+m[1], +m[2]); return c ? c[0] + ',' + c[1] : null; }).filter(Boolean);
    }
    q.graves = []; q.graveNight = { rose: 0, walked: 0, laid: 0 };
    if (q.boats && typeof q.boats === 'object') { q.boats.where = 'dock'; q.boats.sailing = null; }
    // the Barrelbeast's wreck in Hollowford: where it lay, on the new map (20-hollowford's remake lays it, or the first free
    // spot by the War Shed); only if it still lay there (a rebuilt beast is a machine, parked below)
    const ctx = { wreckLies: false };
    const hf = q.hollowford;
    if (hf && Array.isArray(hf.wreck)) {
      const wt = T.BEAST_WRECK !== undefined ? 'BEAST_WRECK' : 'WRECK', [ox, oy] = hf.wreck;
      ctx.wreckLies = P.diffs.some(e => e.x === ox && e.y === oy && e.name === wt);
      hf.wreck = anyCell(ox, oy);
    }
    // the story's tiles, made again from quest state
    const remade = remakeAll(R, ctx);
    // the old map's changes, sorted
    const got = sortDiffs(R, P, remade, placeCell);
    R.dropped.regrow = P.regrow; R.dropped.fires = P.fires;
    // the machines: the one he rode first, then every machine and wreck the old map held
    if (mech && mech.kind !== 'horse') parkMachine(R, RIDDEN[mech.kind || 'walker'] || 'MECH');
    for (const n of got.machines) parkMachine(R, n);
    // the mare: tied at Fennick's rail (bought, standing out on the old map, or ridden)
    const ownsMare = !!(player.horse && player.horse.owned) || got.mare || !!(mech && mech.kind === 'horse') || !!P.horseAt;
    if (ownsMare) tieMare(R);
    // the hero who follows him stands beside him (a dismissed hero waits at the inn, 21-companion's own spot)
    const c = player.companion;
    if (c && typeof c === 'object') { const s = safeSpot(player.x, player.y + TILE, 13, 'person') || { x: player.x, y: player.y }; c.x = s.x; c.y = s.y; if (c.id) c.mode = 'follow'; }
    // what he is told, once
    const lines = [`While you slept, the land grew and settled. You wake in ${town ? 'Thistledown' : 'the cave'}.`, ...refundLines(R)];
    if (R.mare) lines.push(`${mareName()} is tied at Fennick's rail.`);
    const ml = machineLine(R.parked); if (ml) lines.push(ml);
    R.lines = lines;
    for (const l of lines) say(l, 'The Voice');
    const owed = Object.keys(R.refunds.owed).map(id => ({ id, qty: R.refunds.owed[id] }));
    q.spread = { v: WORLD_V, at: R.at, from: R.from.mapW, refunds: R.refunds, parked: R.parked, mare: !!R.mare, remade: R.remade, dropped: R.dropped, owed, lines, told: false };
    miniDirty = true;
    S.last = R;
    return R;
  }

  // ---------- worldRev sweeps (Stage 5 and 6 releases) ----------
  // the diffs inside the boxes are sorted the same way (refunded, re-parked or re-made); everything else is kept. The
  // knight stays where he is (the core load already lifted him out of anything solid).
  function sweepFinish(P) {
    const R = newReport('rev'); R.from = { worldRev: P.from }; R.boxes = P.boxes;
    const remade = remakeAll(R, { wreckLies: false });
    const got = sortDiffs(R, P, remade, (x, y) => [x, y]);
    for (const n of got.machines) parkMachine(R, n);
    if (got.mare) tieMare(R);
    const lines = refundLines(R);
    if (R.mare) lines.push(`${mareName()} is tied at Fennick's rail.`);
    const ml = machineLine(R.parked); if (ml) lines.push(ml);
    if (lines.length) { lines.unshift('Builders came while you slept.'); for (const l of lines) say(l, 'The Voice'); }
    R.lines = lines;
    const s = quest.spread && typeof quest.spread === 'object' ? quest.spread : (quest.spread = { told: true, owed: [] });
    for (const id of Object.keys(R.refunds.owed)) { const e = s.owed.find(o => o.id === id); if (e) e.qty += R.refunds.owed[id]; else s.owed.push({ id, qty: R.refunds.owed[id] }); }
    s.rev = WORLD_REV;
    miniDirty = true;
    S.last = R;
    return R;
  }
  // a sweep of the live game in `boxes` (the new map's [x0, y0, x1, y1]): what a worldRev load does, on demand. A load
  // sweeps a freshly made world; here `ground(x, y)` names the tile the world had under each swept change
  S.sweep = (boxes, ground) => {
    const inBox = (x, y) => boxes.some(b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
    const P = { kind: 'rev', from: WORLD_REV, boxes, diffs: [], crops: [] };
    for (const [i, t] of [...mapDiffs]) { const x = i % MAP_W, y = Math.floor(i / MAP_W); if (!inBox(x, y)) continue; P.diffs.push({ x, y, name: tileName(t) }); mapDiffs.delete(i); setTile(x, y, ground(x, y)); }
    crops = crops.filter(c => { const x = c.i % MAP_W, y = Math.floor(c.i / MAP_W); if (!inBox(x, y)) return true; P.crops.push({ x, y, stage: c.stage | 0, crop: c.crop || null }); return false; });
    return P;
  };

  // ---------- the outermost load wrapper ----------
  {
    const _load = load;
    load = function () {
      S.pending = null;
      const ok = _load.apply(this, arguments);
      const P = S.pending; S.pending = null;
      if (!P) return ok;
      if (!ok) return ok;   // the core refused it after the preparation: SAVE_LOCK stays, nothing was written
      try { if (P.kind === 'rev') sweepFinish(P); else finish(P); }
      catch (e) { SAVE_LOCK = true; saveLockSay = SAVE_KEPT; notify(SAVE_KEPT); window.__saveInError = String(e && e.stack || e); return false; }
      SAVE_LOCK = false;
      save();   // worldV, worldRev and mapW are this world's from here on: a second load changes nothing
      return ok;
    };
  }

  // ---------- Aldous pays out what he kept, on each bank visit, as room frees ----------
  let bankWas = false;
  function payOwed() {
    const s = quest.spread; if (!s || !Array.isArray(s.owed) || !s.owed.length) return null;
    const paid = {};
    for (const e of s.owed) while (e.qty > 0 && (bankAdd(e.id, 1) || addItem(e.id, 1) === 0)) { e.qty--; paid[e.id] = (paid[e.id] || 0) + 1; }
    s.owed = s.owed.filter(e => e.qty > 0);
    if (Object.keys(paid).length) notify(`Aldous hands back ${itemsList(paid)}.`);
    if (s.owed.length) say('I am keeping some of your things for you. Make room in your bank and I will hand them over.', 'Aldous the banker');
    if (Object.keys(paid).length) save();
    return paid;
  }
  S.payOwed = payOwed;
  HOOKS.update.push(() => {
    const atBank = panel === 'bank';
    if (atBank && !bankWas) payOwed();
    bankWas = atBank;
    // the NEW WORLD page opens by itself once, when the Voice has finished and nothing else is open
    const s = quest.spread;
    if (s && s.told === false && !paused && !panel && !dialog.cur && !dialog.queue.length && !(title && title.active)) { s.told = true; openPanel('newworld'); }
  });
  HOOKS.newGame.push(() => { bankWas = false; });

  // ---------- the NEW WORLD plaque and page ----------
  HOOKS.hud.push(g => {
    const s = quest.spread;
    if (!s || s.told !== false || paused || panel) return;
    const back = Object.values(s.refunds && s.refunds.bank || {}).reduce((a, b) => a + b, 0) + Object.values(s.refunds && s.refunds.pack || {}).reduce((a, b) => a + b, 0);
    const sub = back ? `The land grew. ${back} of your things came back.` : 'The land grew while you slept.';
    const r = HK.addPlaque(g, { id: 'new_world', emblem: 'map', name: 'NEW WORLD', nameColor: HK.T.goldHi, sub });
    if (!r) return;
    buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label: 'NEW WORLD', action: () => { s.told = true; openPanel('newworld'); }, up: true, name: 'What changed', sub });
  });
  HOOKS.panel.newworld = (g, narrow) => {
    const s = quest.spread || { lines: [] }, K = PLACE_KIT, R = K.R(), G = K.GAP();
    const lines = (s.lines || []).slice(1).length ? s.lines.slice(1) : ['Nothing of yours needed moving.'];
    const w = Math.min(PANEL_KIT.room().aw, 460), inner = w - 36, f = K.SENT(13), lh = K.lineH(f);
    const textH = lines.reduce((a, l) => a + K.linesOf(g, l, inner, f) * lh + 8, 0);
    const { px, py, h } = panelBox(g, w, 62 + textH + 12 + R + G + R + 12, 'NEW WORLD', (s.lines && s.lines[0]) || 'The land grew and settled.');
    let y = py + 62;
    lines.forEach((l, k) => { y += K.para(g, l, px + 18, y + 13, inner, 99, { font: f, color: HK.T.ink, id: 'newworld:' + k }) + 8; });
    const by = py + h - 12 - R - G - R;
    K.plate(g, px + 18, by, inner, R, 'Open the map', 'Open the map', () => { closePanel(); openPanel('map'); }, 'primary', true);
    K.plate(g, px + 18, by + R + G, inner, R, 'Close', 'Close', () => closePanel(), null, true);
  };

  // the panel audit's scene (PLACE_KIT): the page as a knight with everything to be told sees it, and as a plain one
  {
    let keep;
    const full = { told: true, owed: [{ id: 'bed', qty: 1 }], lines: ['While you slept, the land grew and settled. You wake in Thistledown.', 'Back in your bank: 3 planks, a lodestone and a bed.', 'In your pack: 2 potato seeds.',
      'Aldous the banker is keeping a bed for you. He hands them over when your bank has room.', "Cinder is tied at Fennick's rail.", 'Your walker, 2 bulldozers, 12 walker wrecks and 3 bulldozer wrecks wait at the Dozer Bay.'] };
    PLACE_KIT.scene({
      id: 'newworld', panel: 'newworld', name: 'NEW WORLD (everything to tell, and nothing)',
      setup() { keep = quest.spread; return () => { quest.spread = keep; }; },
      variants: [
        { name: '', open: () => { quest.spread = JSON.parse(JSON.stringify(full)); openPanel('newworld'); } },
        { name: 'plain', open: () => { quest.spread = { told: true, owed: [], lines: [full.lines[0].replace('Thistledown', 'the cave')] }; openPanel('newworld'); } },
      ],
    });
  }

  // ---------- self-test: an old knight comes into the new world ----------
  // A world-1 save made here by hand: the old map's cells are this map's cells through the frames' inverses (F.ix, F.iy),
  // so the test needs no old map. A placed bed he sleeps in and a lodestone home in the old Thistledown, a crop, a
  // regrown stump, the walker under him, the mare out in the Wolfwood, the crypt open; then the bank and the pack full.
  HOOKS.selfTest.push((check, F, h) => {
    const P0 = 'spread migration: ';
    if (title.active) title.startSlot(title.slot);
    save();
    const K = n => title.slotKey(n), slot0 = title.slot, raw0 = localStorage.getItem(K(slot0)), cur0 = localStorage.getItem('fanglands.slot.current'), notice0 = notice;
    const TD = ATLAS.frame('thistledown'), GY = ATLAS.frame('graveyard'), WW = ATLAS.world;
    const old = (Fr, x, y) => [Math.round(Fr.ix(x)), Math.round(Fr.iy(y))];   // a cell of this map, as the old map had it
    const OLD_W = ATLAS.WORLD.xs[ATLAS.WORLD.xs.length - 1][0] + 1;   // the old map's width (its last column, plus one)
    const oi = ([x, y]) => y * OLD_W + x;
    const sq = ATLAS.port('thistledown.square').map(Math.round), crypt = ATLAS.port('graveyard.crypt').map(Math.round);
    const bedOld = old(TD, sq[0] - 4, sq[1] + 3), lodeOld = old(TD, sq[0] + 4, sq[1] + 3), cropOld = old(TD, sq[0] - 6, sq[1] + 5);
    const mareOld = [Math.round(WW.ix(crypt[0] + 30)), Math.round(WW.iy(crypt[1] + 6))], stumpOld = [Math.round(WW.ix(crypt[0] + 20)), Math.round(WW.iy(crypt[1] + 4))];
    const base = JSON.parse(raw0);
    const knight = (o = {}) => {
      const d = JSON.parse(JSON.stringify(base));
      delete d.worldV; delete d.worldRev; d.mapW = OLD_W;
      d.quest.stage = Math.max(8, d.quest.stage); d.player.visitedVillage = true; delete d.quest.spread;
      d.quest.night = Object.assign({}, d.quest.night, { crypt: true });
      d.player.bedSpawn = { x: tc(bedOld[0]), y: tc(bedOld[1]) }; d.player.home = { x: tc(lodeOld[0]), y: tc(lodeOld[1] + 1) };
      d.player.mech = { hp: 90, maxHp: 130 }; d.player.x = tc(stumpOld[0]); d.player.y = tc(stumpOld[1]);
      d.player.horse = { owned: true, hp: 60, at: mareOld.slice(), under: 'GRASS' };
      d.mapDiffs = [[oi(bedOld), 'BED'], [oi(lodeOld), 'LODESTONE'], [oi(cropOld), 'CROP'], [oi(stumpOld), 'STUMP'], [oi(mareOld), 'HORSE'], [oi(old(GY, crypt[0], crypt[1])), 'CRYPT_DOOR']];
      d.crops = [{ i: oi(cropOld), stage: 1, t: 0, crop: 'potato' }]; d.regrow = [{ i: oi(stumpOld), t: 'TREE', timer: 50 }]; d.fires = [];
      return Object.assign(d, o);
    };
    const count = id => countItem(id) + player.bank.filter(s => s.id === id).reduce((a, s) => a + s.qty, 0);
    try {
      const d = knight(), stage0 = d.quest.stage, coins0 = d.player.inv.filter(s => s && s.id === 'coins').reduce((a, s) => a + s.qty, 0);
      const have = id => d.player.inv.filter(s => s && s.id === id).reduce((a, s) => a + s.qty, 0) + (d.player.bank || []).filter(s => s.id === id).reduce((a, s) => a + s.qty, 0);
      const bed0 = have('bed'), lode0 = have('lodestone'), seed0 = have('potato_seed');
      localStorage.setItem(K(slot0), JSON.stringify(d)); dialog.queue.length = 0; dialog.cur = null;
      title.startSlot(slot0);
      const R = S.last || {}, wrote = JSON.parse(localStorage.getItem(K(slot0)) || '{}');
      const tile = [Math.floor(player.x / TILE), Math.floor(player.y / TILE)], said = dialog.queue.concat(dialog.cur ? [dialog.cur] : []).map(l => l.text);
      const bay = window.DOZERUP && DOZERUP.bay, parkedAt = [...mapDiffs].filter(([, t]) => t === T.MECH).map(([i]) => [i % MAP_W, Math.floor(i / MAP_W)]);
      const r = {
        stage: quest.stage === stage0, coins: coins() === coins0, lock: !SAVE_LOCK, worldV: wrote.worldV === WORLD_V && wrote.worldRev === WORLD_REV && wrote.mapW === MAP_W,
        wake: Math.hypot(tile[0] - Math.floor(VILLAGE_SPAWN.x / TILE), tile[1] - Math.floor(VILLAGE_SPAWN.y / TILE)) <= 3 && !collides(player.x, player.y, player.r, playerWho()),
        bed: count('bed') === bed0 + 1 && count('lodestone') === lode0 + 1 && count('potato_seed') === seed0 + 1 && !player.bedSpawn && !player.home,
        walker: !player.mech && parkedAt.length === 1 && !!bay && Math.max(Math.abs(parkedAt[0][0] - bay.x), Math.abs(parkedAt[0][1] - bay.y)) <= 16,
        mare: !!player.horse.at && tileAt(player.horse.at[0], player.horse.at[1]) === MOUNTS.tiles.HORSE && !!MOUNTS.post && Math.max(Math.abs(player.horse.at[0] - MOUNTS.post.x), Math.abs(player.horse.at[1] - MOUNTS.post.y)) <= 16,
        crypt: tileAt(crypt[0], crypt[1]) === NIGHT.tiles.crypt && mapDiffs.get(idx(crypt[0], crypt[1])) === NIGHT.tiles.crypt,
        oldGone: !regrow.length && !crops.length && ![...mapDiffs.values()].some(t => t === T.CROP) && (c => mapDiffs.get(idx(c[0], c[1])) !== T.STUMP)(anyCell(...stumpOld)),
        voice: said[0] === 'While you slept, the land grew and settled. You wake in Thistledown.' && said.includes('Back in your bank: a bed, a lodestone and a potato seed.') && said.includes('Cinder is tied at Fennick\'s rail.') && said.includes('Your walker waits at the Dozer Bay.'),
        remade: !!R.remade && R.remade['35-night'] === 1,
      };
      // a second load is a no-op: the same diffs, the same knight, nothing said
      const diffs1 = JSON.stringify([...mapDiffs]), at1 = [player.x, player.y], inv1 = JSON.stringify([player.inv, player.bank]);
      dialog.queue.length = 0; dialog.cur = null; S.last = null; title.startSlot(slot0);
      r.again = JSON.stringify([...mapDiffs]) === diffs1 && player.x === at1[0] && player.y === at1[1] && JSON.stringify([player.inv, player.bank]) === inv1 && S.last === null && !dialog.cur && !dialog.queue.length;
      check(P0 + 'a world-1 knight (a bed he slept in and a lodestone home in the old Thistledown, a crop, the walker under him, the mare out in the Wolfwood, the crypt open) wakes on the Fountain Square, gets the bed, the lodestone and the seed back in his bank, finds the walker at the Dozer Bay, the mare at Fennick\'s rail and the crypt door at the crypt; story and coins kept; the Voice says so once; the save is worldV ' + WORLD_V + '; a second load changes nothing',
        Object.values(r).every(Boolean), Object.assign(r, { said: said.slice(0, 6), parkedAt, sorted: R.sorted, refunds: R.refunds }));
      // the NEW WORLD page opens by itself once the Voice is done, and its plate opens the map
      { const k = knight(); localStorage.setItem(K(slot0), JSON.stringify(k)); title.startSlot(slot0); closePanel(); dialog.queue.length = 0; dialog.cur = null; F.step([]); render();
        const page = panel === 'newworld', mapBtn = buttons.find(b => b.label === 'Open the map'), big = !!mapBtn && mapBtn.h >= HK.row();
        if (mapBtn) mapBtn.action(); const map = panel === 'map';
        closePanel(); F.step([]); const once = panel === null && quest.spread.told === true;
        check(P0 + 'the NEW WORLD page opens once by itself after the Voice, lists what came back, and its plate (a full row tall) opens the map', page && big && map && once, { page, big, map, once, panel }); }
      // the bank and the pack full: Aldous keeps the bed and the lodestone, and hands them over at the bank as room frees
      { const k = knight(), skip = new Set(['bed', 'lodestone', 'potato_seed', 'coins']), spare = Object.keys(ITEMS).filter(id => !skip.has(id));
        k.player.bank = spare.slice(0, BANK_SLOTS).map(id => ({ id, qty: 1 }));
        const more = spare.slice(BANK_SLOTS); k.player.inv = k.player.inv.map(() => ({ id: more.shift(), qty: 1 }));   // every slot something else
        localStorage.setItem(K(slot0), JSON.stringify(k)); title.startSlot(slot0);
        const owed = (quest.spread.owed || []).map(o => o.id + ':' + o.qty).sort().join(' '), full = player.bank.length === BANK_SLOTS && player.inv.every(Boolean);
        const said = dialog.queue.concat(dialog.cur ? [dialog.cur] : []).map(l => l.text), told = said.some(t => /^Aldous the banker is keeping a bed, a lodestone and a potato seed for you\./.test(t));
        dialog.queue.length = 0; dialog.cur = null;
        player.bank.splice(0, 2); closePanel(); openPanel('bank'); F.step([]);
        const paid = count('bed') >= 1 && count('lodestone') >= 1 && quest.spread.owed.length === 1 && quest.spread.owed[0].id === 'potato_seed', kept = dialog.queue.concat(dialog.cur ? [dialog.cur] : []).some(l => l.who === 'Aldous the banker' && /I am keeping some of your things for you/.test(l.text));
        closePanel();
        check(P0 + 'the bank and the pack full: Aldous keeps the bed, the lodestone and the seed (quest.spread.owed) and says so; at the bank he hands over as many as fit and says he keeps the rest',
          full && owed === 'bed:1 lodestone:1 potato_seed:1' && told && paid && kept, { full, owed, told, paid, kept, left: quest.spread.owed }); }
      // a worldRev sweep in a box: a plank placed there comes back, a machine is parked, a stump is dropped, the rest is kept
      { title.startSlot(slot0); dialog.queue.length = 0; dialog.cur = null; quest.spread = null;
        // an open 5 x 5 of plain ground near the square, with open ground 6 tiles east of its middle
        const free = (x, y) => inMap(x, y) && PLACEABLE_ON.has(tileAt(x, y)) && !mapDiffs.has(idx(x, y)) && !insideBuilding(x, y) && !buildingAt(x, y) && !NPCS.some(n => circleHitsTile(n.px, n.py, 16, x, y));
        let o = null;
        for (let r = 2; r <= 40 && !o; r++) for (let dy = -r; dy <= r && !o; dy++) for (let dx = -r; dx <= r && !o; dx++) {
          const cx = sq[0] + dx, cy = sq[1] + dy; let ok = free(cx + 6, cy);
          for (let y = cy - 2; y <= cy + 2 && ok; y++) for (let x = cx - 2; x <= cx + 2 && ok; x++) ok = free(x, y);
          if (ok) o = [cx, cy];
        }
        o = o || sq;
        const box = [o[0] - 2, o[1] - 2, o[0] + 2, o[1] + 2], out = [o[0] + 6, o[1]];
        const g0 = [o[0] - 1, o[1]], g1 = [o[0] + 1, o[1]], g2 = [o[0], o[1] + 1];
        const ok0 = [g0, g1, g2, out].every(([x, y]) => PLACEABLE_ON.has(tileAt(x, y)));
        const was = [g0, g1, g2, out].map(([x, y]) => tileAt(x, y));
        changeTile(...g0, T.PLANK); changeTile(...g1, T.WRECK); changeTile(...g2, T.STUMP); changeTile(...out, T.PLANK);
        const planks0 = count('plank'), under = new Map([g0, g1, g2].map(([x, y], k) => [idx(x, y), was[k]])), P = S.sweep([box], (x, y) => under.get(idx(x, y))); const R = sweepFinish(P);
        const wreckAt = [...mapDiffs].filter(([, t]) => t === T.WRECK).map(([i]) => [i % MAP_W, Math.floor(i / MAP_W)]);
        const res = { ok0, plank: count('plank') === planks0 + 1, wreck: wreckAt.length >= 1 && R.parked.WRECK === 1, stump: tileAt(...g2) === was[2] && R.dropped.STUMP === 1, kept: tileAt(...out) === T.PLANK && mapDiffs.get(idx(...out)) === T.PLANK };
        for (const [i, t] of [...mapDiffs]) if (t === T.WRECK) { mapDiffs.delete(i); setTile(i % MAP_W, Math.floor(i / MAP_W), T.DIRT); }
        changeTile(...out, was[3]); mapDiffs.delete(idx(...out)); removeItem('plank', 1); dialog.queue.length = 0; dialog.cur = null;
        check(P0 + 'a worldRev sweep in a footprint box: a plank placed inside comes back, a walker wreck inside is parked at the Dozer Bay, a stump inside is cleared, and a plank outside the box is kept', Object.values(res).every(Boolean), res); }
    } finally {
      SAVE_LOCK = false; quest.spread = null;
      if (raw0 === null) localStorage.removeItem(K(slot0)); else localStorage.setItem(K(slot0), raw0);
      if (cur0 === null) localStorage.removeItem('fanglands.slot.current'); else localStorage.setItem('fanglands.slot.current', cur0);
      title.slot = slot0; title.startSlot(slot0); closePanel(); dialog.queue.length = 0; dialog.cur = null; notice = notice0;
    }
  });
}
