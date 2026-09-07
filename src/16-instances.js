// ============================================================================
// INSTANCES — caves, dungeons and boss arenas that live off the main map.
// Feature file: registers through HOOKS and edits no core file. Everything sits in one block.
//
// An instance is a small w×h tile map of its own. While it is active it is written into the
// top-left of the core `map` (everything outside the rect becomes WALL), the overworld is kept in a
// snapshot, and its monsters replace the overworld `monsters` array. Leaving (exit ladder, L key,
// LEAVE touch button, or dying) restores the snapshot and puts the knight on the step tile outside.
//
// Wrapped core functions (reassigned by name; every wrapper falls through to the original outside an instance):
//   changeTile   — inside an instance a tile edit does NOT touch mapDiffs (instance tiles are never saved)
//   save         — inside an instance the save is the OVERWORLD snapshot with the knight on the step tile,
//                  so a reload lands outside; regrow/fires are the overworld's, not the frozen empties
//   load         — loading while inside leaves the instance first (a save never describes an instance)
//   respawnPoint — dying inside leaves the instance and respawns on the step tile outside
// Reassigned `let` bindings: monsters, miniDirty, regrow, fires, drops, projectiles (all restored on leave).
// Overwritten const contents: map / variant (.set from the snapshot), REGIONS (an entry is unshifted while inside
// and removed on leave), NPCS / BUILDINGS (entries whose position falls inside the instance rect are hidden while
// inside and put back on leave, so Death's house does not stand in the middle of a dungeon).
//
// window.INSTANCES = { define, enter, leave, list, active } for tests and for adding more bosses:
//   define(id, { name, sub, w, h, build(setTile, rnd), spawns: [[type, x, y]...], exit: [x, y], entry: [x, y],
//                dark, boss, onClear(first, count), door: [x, y], step: [x, y], voice })
//   door/step are optional: a DUNGEON_DOOR tile is placed at `door` in HOOKS.world with `step` set to DIRT; E on it enters.
//   enter(id, step?) — step = [tx, ty] to return to (defaults to the door's step tile, else where the knight stands).
// ============================================================================
{
  const WEB_SPEED = 89;        // the Brood Mother's web. 89, not 90: 28-thefang resets an off-ice speed of exactly 90 to 175 every tick
  const BASE_SPEED = 175;
  const EGG_HATCH = 6, EGG_EVERY = 8, WEB_TIME = 4;

  // ---------- tiles (ids captured locally) ----------
  const T_DOOR = addTile('DUNGEON_DOOR', { solid: true, tex: 'wall', mini: '#1a1a22' });
  const T_EXIT = addTile('DUNGEON_EXIT', { solid: true, tex: 'cave', mini: '#8fa2b8' });
  const T_TORCH = addTile('TORCH', { solid: true, tex: 'wall', mini: '#ffb347' });
  const T_EGG = addTile('EGG', { solid: true, tex: 'cave', mini: '#e8e2d8' });
  const T_CHEST = addTile('DEN_CHEST', { solid: true, tex: 'cave', mini: '#8a5a2b' });
  const T_SHROOM = addTile('CAVE_MUSHROOM', { tex: 'cave', mini: '#5d5f66' }); // T.MUSHROOM draws a grass texture; this one keeps the cave floor under the caps

  // ---------- items ----------
  ITEMS.silk_cloak = { name: 'Silk cloak', value: 150, color: '#e9eef5', shape: 'body', armour: { slot: 'body', def: 6 } };
  ITEMS.silk_cloak.id = 'silk_cloak'; ITEMS.silk_cloak.stack = 1;

  // ---------- monsters ----------
  MONSTER_DEFS.giant_spider = { name: 'Giant spider', level: 8, r: 16, hp: 30, att: 9, maxHit: 5, def: 6, speed: 130, aggro: true, sight: 5 * TILE, respawn: 60,
    drops: { always: [['spider_silk', 1, 3]], table: [['coins', 5, 15, 3], ['bread', 1, 1, 1]] } };
  MONSTER_DEFS.brood_mother = { name: 'Brood Mother', level: 15, r: 28, hp: 140, att: 16, maxHit: 9, def: 12, speed: 90, aggro: true, sight: 8 * TILE, respawn: 600,
    drops: { always: [['spider_silk', 10, 10], ['coins', 60, 120]] } };

  // a bigger, hairier cave spider with striped legs
  HOOKS.drawMonster.giant_spider = (g, e, hurt) => {
    const ang = Math.atan2(e.facing.y, e.facing.x);
    g.save(); g.rotate(ang); g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const ph = Math.sin(e.walkT * 1.5 + i * 1.1) * (e.moving ? 4 : 0), lx = -9 + i * 6;
      for (const s of [-1, 1]) {
        const kx = lx - 4, ky = s * (13 + ph), fx = lx - 10, fy = s * (20 + ph);
        g.strokeStyle = hurt ? '#ffb0b0' : '#2a262e'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(lx, 0); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
        g.strokeStyle = hurt ? '#ffd0d0' : '#a08a5a'; g.lineWidth = 3.2; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(lx, 0); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke(); g.setLineDash([]); // stripes
      }
    }
    g.fillStyle = hurt ? '#ffb0b0' : '#3a3440'; g.beginPath(); g.ellipse(-5, 0, 12, 9, 0, 0, 7); g.fill();
    g.strokeStyle = hurt ? '#ffc0c0' : '#5a5262'; g.lineWidth = 1; for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; const cx = -5 + Math.cos(a) * 11, cy = Math.sin(a) * 8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3); g.stroke(); } // hairs
    g.fillStyle = hurt ? '#ffc0c0' : '#4a4452'; g.beginPath(); g.arc(9, 0, 6, 0, 7); g.fill();
    g.fillStyle = '#e63946'; for (const [ox, oy, r] of [[12, -2.5, 1.5], [12, 2.5, 1.5], [10, -4.5, 1], [10, 4.5, 1]]) { g.beginPath(); g.arc(ox, oy, r, 0, 7); g.fill(); }
    g.strokeStyle = '#1b1b20'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(14, -2); g.lineTo(18, -4); g.moveTo(14, 2); g.lineTo(18, 4); g.stroke(); // fangs
    g.restore();
  };
  // the Brood Mother: a huge dark spider, pale abdomen, glowing red eyes, legs that walk
  HOOKS.drawMonster.brood_mother = (g, e, hurt) => {
    const ang = Math.atan2(e.facing.y, e.facing.x), t = time, breathe = 1 + Math.sin(t * 2.2) * 0.03;
    g.save(); g.rotate(ang); g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 4; i++) {
      const ph = Math.sin(e.walkT * 1.4 + i * 0.9) * (e.moving ? 7 : 0), lx = -10 + i * 9;
      for (const s of [-1, 1]) {
        const kx = lx - 6, ky = s * (26 + ph), fx = lx - 18, fy = s * (40 + ph * 0.6);
        g.strokeStyle = hurt ? '#ffb0b0' : '#1e1a22'; g.lineWidth = 6; g.beginPath(); g.moveTo(lx, 0); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
        g.strokeStyle = hurt ? '#ffd0d0' : '#3a3242'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(lx, 0); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
        g.fillStyle = '#8a8296'; g.beginPath(); g.arc(kx, ky, 3, 0, 7); g.fill();
      }
    }
    // pale abdomen with dark markings
    g.save(); g.scale(breathe, breathe);
    g.fillStyle = hurt ? '#ffd0d0' : '#d9d2c4'; g.beginPath(); g.ellipse(-16, 0, 22, 17, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-20, -6, 9, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#3a2e3a'; g.beginPath(); g.moveTo(-8, -6); g.lineTo(-20, -2); g.lineTo(-30, -6); g.lineTo(-26, 0); g.lineTo(-30, 6); g.lineTo(-20, 2); g.lineTo(-8, 6); g.lineTo(-12, 0); g.closePath(); g.fill();
    for (const [ox, oy] of [[-24, -10], [-12, 10], [-28, 8]]) { g.beginPath(); g.arc(ox, oy, 2, 0, 7); g.fill(); }
    g.restore();
    // dark cephalothorax and head
    g.fillStyle = hurt ? '#ffb0b0' : '#2a2430'; g.beginPath(); g.ellipse(6, 0, 14, 11, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#ffc0c0' : '#3a3242'; g.beginPath(); g.arc(18, 0, 8, 0, 7); g.fill();
    // eyes: a red glow and eight points
    const gl = 0.35 + Math.sin(t * 5) * 0.15;
    const gr = g.createRadialGradient(22, 0, 1, 22, 0, 20); gr.addColorStop(0, `rgba(255,60,60,${gl})`); gr.addColorStop(1, 'rgba(255,60,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(22, 0, 20, 0, 7); g.fill();
    g.fillStyle = '#ff3b3b'; for (const [ox, oy, r] of [[23, -3, 2.2], [23, 3, 2.2], [20, -6, 1.4], [20, 6, 1.4], [25, -7, 1], [25, 7, 1], [18, -2, 1], [18, 2, 1]]) { g.beginPath(); g.arc(ox, oy, r, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(23.6, -3.6, 0.7, 0, 7); g.arc(23.6, 2.4, 0.7, 0, 7); g.fill();
    // fangs, spread on attack
    const sp = e.attackT > 0 ? 4 : 0;
    g.strokeStyle = '#e8e2d8'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(24, -3); g.lineTo(31, -6 - sp); g.moveTo(24, 3); g.lineTo(31, 6 + sp); g.stroke();
    g.restore();
  };

  // ---------- registry and state ----------
  const INST = {};
  const DOORS = {};          // map index of a DUNGEON_DOOR tile → { id, step: {x, y} }
  let active = null;         // { id, inst, snap, eggs, webT, region, hidden, cleared }
  const Q = () => quest.instances || (quest.instances = { cleared: {}, chests: {}, visited: {} });
  HOOKS.newGame.push(() => {
    quest.instances = { cleared: {}, chests: {}, visited: {} };
    // newGame regenerated the world already; only the bookkeeping is left
    if (active) { unhide(); active = null; window.__instance = null; }
  });

  function define(id, def) {
    if (!def || !(def.w > 0) || !(def.h > 0) || def.w > MAP_W || def.h > MAP_H) throw new Error('defineInstance: bad size for ' + id);
    const inst = { id, name: def.name || id, sub: def.sub || '', w: def.w, h: def.h, spawns: def.spawns || [], exit: def.exit || null, entry: def.entry || [1, 1], dark: !!def.dark, boss: def.boss || null, onClear: def.onClear || null, door: def.door || null, step: def.step || null, voice: def.voice || null, build: def.build, tiles: null, vars: null };
    inst.tiles = new Uint8Array(inst.w * inst.h).fill(T.WALL);
    inst.vars = new Uint8Array(inst.w * inst.h);
    const rnd = mulberry32(0x5eed ^ (id.length * 7919) ^ Math.imul(id.charCodeAt(0), 2654435761));
    for (let i = 0; i < inst.vars.length; i++) inst.vars[i] = Math.floor(rnd() * 3);
    const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < inst.w && y < inst.h) inst.tiles[y * inst.w + x] = t; };
    const at = (x, y) => (x >= 0 && y >= 0 && x < inst.w && y < inst.h) ? inst.tiles[y * inst.w + x] : T.WALL;
    if (typeof inst.build === 'function') inst.build(set, rnd, at);
    if (inst.exit) set(inst.exit[0], inst.exit[1], T_EXIT);
    set(inst.entry[0], inst.entry[1], T.CAVE);
    for (const [, x, y] of inst.spawns) if (SOLID.has(at(x, y))) set(x, y, T.CAVE);
    INST[id] = inst;
    return inst;
  }

  function makeMonster(type, tx, ty) {
    const d = MONSTER_DEFS[type];
    return { type, x: tc(tx), y: tc(ty), home: { x: tc(tx), y: tc(ty) }, r: d.r, hp: d.hp, maxHp: d.hp, speed: d.speed, angry: d.aggro, state: 'idle', wanderT: Math.random() * 2,
      wander: { x: 0, y: 0 }, attackCd: 0, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0 };
  }
  const inRect = (inst, tx, ty) => tx >= 0 && ty >= 0 && tx < inst.w && ty < inst.h;
  function hideOverworld(inst) {
    const hidden = { npcs: [], buildings: [] };
    for (let i = NPCS.length - 1; i >= 0; i--) { const n = NPCS[i]; if (inRect(inst, Math.floor(n.px / TILE), Math.floor(n.py / TILE)) || inRect(inst, n.x, n.y)) { hidden.npcs.push(n); NPCS.splice(i, 1); } }
    for (let i = BUILDINGS.length - 1; i >= 0; i--) { const b = BUILDINGS[i]; if (b.x < inst.w && b.y < inst.h) { hidden.buildings.push(b); BUILDINGS.splice(i, 1); } }
    return hidden;
  }
  function unhide() {
    if (!active || !active.hidden) return;
    for (const n of active.hidden.npcs) if (!NPCS.includes(n)) NPCS.push(n);
    for (const b of active.hidden.buildings) if (!BUILDINGS.includes(b)) BUILDINGS.push(b);
    active.hidden = null;
  }
  // regionAt while inside answers with the instance's own region (it sits at REGIONS[0] and covers the top-left); this asks the overworld
  const overworldRegionAt = (tx, ty) => REGIONS.find(r => !(active && r === active.region) && tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) || REGIONS[REGIONS.length - 1];
  function restoreSpeed() {
    if (!player.mech && player.equip.body !== 'hover_armour' && player.speed === WEB_SPEED) player.speed = BASE_SPEED;
  }

  function enterInstance(id, step) {
    const inst = INST[id];
    if (!inst || active || player.dead) return false;
    if (player.mech) { notify('The walker will not fit through there. Climb out first (X).'); return false; }
    const stepPx = step ? { x: tc(step[0]), y: tc(step[1]) } : inst.step ? { x: tc(inst.step[0]), y: tc(inst.step[1]) } : { x: player.x, y: player.y };
    const snap = { map: map.slice(), variant: variant.slice(), monsters, player: { x: player.x, y: player.y, region: player.region }, step: stepPx, regrow, fires, drops, projectiles };
    closePanel(); player.action = null;
    map.fill(T.WALL); variant.fill(0);
    for (let y = 0; y < inst.h; y++) for (let x = 0; x < inst.w; x++) { map[idx(x, y)] = inst.tiles[y * inst.w + x]; variant[idx(x, y)] = inst.vars[y * inst.w + x]; }
    monsters = inst.spawns.map(([type, x, y]) => makeMonster(type, x, y));
    regrow = []; fires = []; drops = []; projectiles = [];
    const region = { name: inst.name, sub: inst.sub, x0: 0, y0: 0, x1: inst.w - 1, y1: inst.h - 1 };
    REGIONS.unshift(region);
    active = { id, inst, snap, eggs: [], webT: 0, region, hidden: null, cleared: false, hatched: 0 };
    active.hidden = hideOverworld(inst);
    player.x = tc(inst.entry[0]); player.y = tc(inst.entry[1]); player.facing = { x: 0, y: 1 };
    { const s = safeSpot(player.x, player.y, player.r, 'player'); if (s) { player.x = s.x; player.y = s.y; } }
    player.region = inst.name; areaBanner = { name: inst.name, sub: inst.sub, t: 3.2 };
    miniDirty = true; window.__instance = id;
    burst(player.x, player.y, '#9aa6b8', 14, 80); sfx('open');
    const q = Q(); if (!q.visited[id]) { q.visited[id] = true; if (inst.voice) say(inst.voice, 'The Voice'); }
    return true;
  }
  function leaveInstance() {
    if (!active) return false;
    const { snap, inst } = active;
    // whatever still lies on the dungeon floor comes out with the knight and lands on the step
    const carried = drops.map(d => ({ ...d, x: snap.step.x + rint(-14, 14), y: snap.step.y + rint(-14, 14) }));
    map.set(snap.map); variant.set(snap.variant);
    monsters = snap.monsters; regrow = snap.regrow; fires = snap.fires; drops = snap.drops.concat(carried); projectiles = [];
    { const i = REGIONS.indexOf(active.region); if (i >= 0) REGIONS.splice(i, 1); }
    unhide();
    const sp = safeSpot(snap.step.x, snap.step.y, player.r, 'player') || snap.step;
    player.x = sp.x; player.y = sp.y; player.action = null; player.facing = { x: 1, y: 0 };
    if (active.webT > 0) { active.webT = 0; restoreSpeed(); }
    active = null; window.__instance = null; miniDirty = true;
    burst(player.x, player.y, '#9aa6b8', 14, 80);
    inst.lastLeft = time;
    return true;
  }

  // ---------- core wrappers (see the header) ----------
  const _changeTile = changeTile;
  changeTile = (tx, ty, t) => { if (!active) return _changeTile(tx, ty, t); setTile(tx, ty, t); blockHp.delete(idx(tx, ty)); miniDirtyTiles.add(idx(tx, ty)); };
  if (window.FANGLANDS) window.FANGLANDS.changeTile = changeTile;
  const _save = save;
  save = () => {
    if (!active) return _save();
    const s = active.snap, keep = { x: player.x, y: player.y, region: player.region, speed: player.speed }, rg = regrow, fr = fires;
    player.x = s.step.x; player.y = s.step.y; player.region = overworldRegionAt(Math.floor(s.step.x / TILE), Math.floor(s.step.y / TILE)).name;
    if (player.speed === WEB_SPEED) player.speed = BASE_SPEED;
    regrow = s.regrow; fires = s.fires;
    try { _save(); } finally { player.x = keep.x; player.y = keep.y; player.region = keep.region; player.speed = keep.speed; regrow = rg; fires = fr; }
  };
  const _load = load;
  load = () => { if (active) leaveInstance(); return _load(); };
  const _respawnPoint = respawnPoint;
  respawnPoint = () => {
    if (!active) return _respawnPoint();
    const st = active.snap.step; leaveInstance();
    return safeSpot(st.x, st.y, 13, 'person') || st;
  };

  // ---------- doors placed in the world ----------
  HOOKS.world.push((rnd, api) => {
    for (const id in INST) {
      const inst = INST[id]; if (!inst.door) continue;
      const [dx, dy] = inst.door, step = inst.step || [dx + 1, dy];
      api.setTile(dx, dy, T_DOOR); api.setTile(step[0], step[1], T.DIRT);
      DOORS[idx(dx, dy)] = { id, step };
    }
  });

  // ---------- eggs ----------
  const eggAt = (tx, ty) => active && active.eggs.find(e => e.tx === tx && e.ty === ty);
  function layEggs(m) {
    const cx = Math.floor(m.x / TILE), cy = Math.floor(m.y / TILE), inst = active.inst, cands = [];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const tx = cx + dx, ty = cy + dy;
      if (!inRect(inst, tx, ty) || tileAt(tx, ty) !== T.CAVE) continue;
      if (tx === inst.entry[0] && ty === inst.entry[1]) continue;
      if (inst.exit && Math.abs(tx - inst.exit[0]) <= 1 && Math.abs(ty - inst.exit[1]) <= 1) continue;
      if (circleHitsTile(player.x, player.y, player.r + 4, tx, ty)) continue;
      if (monsters.some(o => !o.dead && circleHitsTile(o.x, o.y, o.r + 2, tx, ty))) continue;
      cands.push([tx, ty]);
    }
    let laid = 0;
    while (laid < 2 && cands.length) {
      const [tx, ty] = cands.splice(Math.floor(Math.random() * cands.length), 1)[0];
      setTile(tx, ty, T_EGG); miniDirtyTiles.add(idx(tx, ty)); active.eggs.push({ tx, ty, t: 0 }); laid++;
      burst(tc(tx), tc(ty), '#e8e2d8', 6, 40);
    }
    if (laid) floatText(m.x, m.y - m.r - 26, 'She lays eggs!', '#e8e2d8', 13);
  }
  function breakEgg(e, quiet = false) {
    if (tileAt(e.tx, e.ty) === T_EGG) { setTile(e.tx, e.ty, T.CAVE); miniDirtyTiles.add(idx(e.tx, e.ty)); }
    active.eggs = active.eggs.filter(x => x !== e);
    burst(tc(e.tx), tc(e.ty), '#e8e2d8', 10, 70); burst(tc(e.tx), tc(e.ty), '#9fbf5a', 4, 40);
    if (!quiet) { floatText(tc(e.tx), tc(e.ty) - 20, 'Egg broken', '#e8e2d8', 13); sfx('hit'); }
  }
  function hatchEgg(e) {
    if (tileAt(e.tx, e.ty) === T_EGG) { setTile(e.tx, e.ty, T.CAVE); miniDirtyTiles.add(idx(e.tx, e.ty)); }
    active.eggs = active.eggs.filter(x => x !== e);
    const m = makeMonster('spider', e.tx, e.ty); m.hatched = true; m.angry = true; monsters.push(m); active.hatched++;
    burst(tc(e.tx), tc(e.ty), '#5a5a6a', 10, 70); floatText(tc(e.tx), tc(e.ty) - 20, 'Hatched!', '#ff6b6b', 13);
  }

  // ---------- per-tick behaviour ----------
  HOOKS.update.push(dt => {
    if (!active) return;
    const inst = active.inst;
    player.region = inst.name;
    if (pressed.has('KeyL') && !player.dead) { leaveInstance(); notify('You climb back out into the light.'); return; }
    // web timer
    if (active.webT > 0) { active.webT -= dt; if (active.webT <= 0) { active.webT = 0; restoreSpeed(); floatText(player.x, player.y - 30, 'The web tears', '#e9eef5', 12); } }
    // eggs: age, hatch
    for (const e of active.eggs.slice()) { e.t += dt; if (e.t >= EGG_HATCH) hatchEgg(e); }
    // a swing breaks eggs within reach
    if (player.attackT > 0 && !player.dead) for (const e of active.eggs.slice()) {
      const nx = clamp(player.x, e.tx * TILE, e.tx * TILE + TILE), ny = clamp(player.y, e.ty * TILE, e.ty * TILE + TILE);
      if (dist(player.x, player.y, nx, ny) <= 40) breakEgg(e);
    }
    // hatched spiders never respawn: once the death animation is over they are gone
    if (monsters.some(m => m.hatched && m.dead && m.deadT > 1)) monsters = monsters.filter(m => !(m.hatched && m.dead && m.deadT > 1));
    // the boss
    if (inst.boss) for (const m of monsters) {
      if (m.type !== inst.boss) continue;
      if (m.dead) { if (active.cleared) m.respawnT = Infinity; continue; }
      if (m.type === 'brood_mother' && !player.dead) {
        m.eggT = (m.eggT ?? EGG_EVERY) - dt;
        if (m.eggT <= 0 && dist(m.x, m.y, player.x, player.y) < 10 * TILE) { m.eggT = EGG_EVERY; layEggs(m); }
        if (!m.webbed && m.hp <= m.maxHp * 0.5) {
          m.webbed = true; active.webT = WEB_TIME;
          if (!player.mech && player.equip.body !== 'hover_armour') player.speed = WEB_SPEED;
          floatText(player.x, player.y - 34, 'Webbed!', '#e9eef5', 15); burst(player.x, player.y, '#e9eef5', 16, 60); sfx('hurt');
          say('Silk on your legs. Cut her down before she wraps the rest of you.', 'The Voice');
        }
      }
    }
  });

  // ---------- use: doors, exits, eggs, chests, torches ----------
  HOOKS.use.push((t, tx, ty) => {
    if (t === T_DOOR) {
      const d = DOORS[idx(tx, ty)];
      if (!d) { notify('A cave mouth. Nothing stirs.'); return true; }
      if (!enterInstance(d.id, d.step)) notify('You cannot go in right now.');
      return true;
    }
    if (!active) return false;
    if (t === T_EXIT) { leaveInstance(); notify('You climb back out into the light.'); return true; }
    if (t === T_EGG) { const e = eggAt(tx, ty); if (e) breakEgg(e); else { setTile(tx, ty, T.CAVE); miniDirtyTiles.add(idx(tx, ty)); } return true; }
    if (t === T_TORCH) { notify('A torch someone wedged into the rock. It still burns.'); return true; }
    if (t === T_CHEST) {
      const q = Q(), key = active.id + ':' + tx + ',' + ty;
      if (q.chests[key]) { notify('Empty. You already took what was in it.'); return true; }
      if (active.inst.boss && !(q.cleared[active.id] > 0)) { notify('Webbed shut. The thing that spun it is still alive.'); return true; }
      q.chests[key] = true;
      if (active.inst.chestLoot) for (const [id, n] of active.inst.chestLoot) giveOrDrop(id, n, player.x, player.y);
      burst(tc(tx), tc(ty), '#f5c542', 20, 100); sfx('coins'); save();
      return true;
    }
    return false;
  });

  // ---------- boss kills ----------
  HOOKS.kill.push(m => {
    if (!active) return;
    const inst = active.inst;
    if (!inst.boss || m.type !== inst.boss || active.cleared) return;
    active.cleared = true; m.respawnT = Infinity;
    const q = Q(); const n = (q.cleared[inst.id] || 0) + 1; q.cleared[inst.id] = n;
    for (const e of active.eggs.slice()) breakEgg(e, true);
    levelBanner = { text: 'DUNGEON CLEARED', sub: inst.name, t: 4 }; sfx('quest');
    burst(m.x, m.y, '#e8e2d8', 30, 160); burst(m.x, m.y, '#e63946', 16, 120);
    if (active.webT > 0) { active.webT = 0; restoreSpeed(); }
    if (inst.onClear) inst.onClear(n === 1, n);
    save();
  });

  // ---------- drawing ----------
  function drawDoor(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, cx = tc(tx);
    // the mouth: a black arch in the rock
    g.fillStyle = '#07080c'; g.beginPath(); g.moveTo(x + 9, y + TILE); g.lineTo(x + 9, y + 20); g.quadraticCurveTo(cx, y - 2, x + TILE - 9, y + 20); g.lineTo(x + TILE - 9, y + TILE); g.closePath(); g.fill();
    g.fillStyle = 'rgba(80,90,110,0.18)'; g.beginPath(); g.moveTo(x + 12, y + TILE); g.lineTo(x + 12, y + 24); g.quadraticCurveTo(cx, y + 6, x + TILE - 12, y + 24); g.lineTo(x + TILE - 12, y + TILE); g.closePath(); g.fill();
    // timber frame: two posts and a lintel, pegged
    g.fillStyle = '#5a3a1e'; g.fillRect(x + 4, y + 14, 6, TILE - 14); g.fillRect(x + TILE - 10, y + 14, 6, TILE - 14); g.fillRect(x + 2, y + 10, TILE - 4, 7);
    g.fillStyle = '#8a5a2b'; g.fillRect(x + 4, y + 14, 2, TILE - 14); g.fillRect(x + TILE - 10, y + 14, 2, TILE - 14); g.fillRect(x + 2, y + 10, TILE - 4, 2);
    g.fillStyle = '#2a1e14'; for (const [ox, oy] of [[7, 20], [7, 40], [TILE - 7, 20], [TILE - 7, 40], [8, 13], [TILE - 8, 13]]) { g.beginPath(); g.arc(x + ox, y + oy, 1.4, 0, 7); g.fill(); }
    // a hanging lantern on a short chain, swinging a little
    const sw = Math.sin(time * 1.7 + tx) * 2.5, lx = cx + sw, ly = y + 27, gl = 0.75 + Math.sin(time * 6 + ty) * 0.15;
    g.strokeStyle = '#3a3a42'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, y + 17); g.lineTo(lx, ly - 7); g.stroke();
    const gr = g.createRadialGradient(lx, ly, 2, lx, ly, 34); gr.addColorStop(0, `rgba(255,190,90,${0.35 * gl})`); gr.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gr; g.beginPath(); g.arc(lx, ly, 34, 0, 7); g.fill();
    g.fillStyle = '#2a2a30'; g.fillRect(lx - 4, ly - 7, 8, 2); g.fillRect(lx - 4, ly + 5, 8, 2);
    g.fillStyle = `rgba(255,200,110,${gl})`; g.fillRect(lx - 3, ly - 5, 6, 10);
    g.fillStyle = `rgba(255,245,200,${gl})`; g.fillRect(lx - 1, ly - 2, 2, 4);
  }
  function drawExit(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    const gr = g.createRadialGradient(cx, cy - 16, 4, cx, cy - 16, 64); gr.addColorStop(0, 'rgba(255,248,220,0.5)'); gr.addColorStop(1, 'rgba(255,248,220,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy - 16, 64, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,248,220,0.18)'; g.beginPath(); g.moveTo(cx - 10, cy - 24); g.lineTo(cx + 10, cy - 24); g.lineTo(cx + 22, cy + 22); g.lineTo(cx - 22, cy + 22); g.closePath(); g.fill(); // a shaft of daylight
    g.fillStyle = '#2a2a30'; g.fillRect(cx - 15, cy - 26, 30, 8);
    g.fillStyle = '#a5763f'; g.fillRect(cx - 8, cy - 24, 4, 46); g.fillRect(cx + 4, cy - 24, 4, 46);
    for (let k = 0; k < 6; k++) g.fillRect(cx - 8, cy - 20 + k * 7.5, 16, 3);
    g.fillStyle = '#d9c88a'; g.fillRect(cx - 8, cy - 24, 4, 2); g.fillRect(cx + 4, cy - 24, 4, 2);
  }
  function drawTorch(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), fl = Math.sin(time * 9 + tx * 2.3 + ty) * 2, gl = 0.8 + Math.sin(time * 7 + tx) * 0.15;
    g.fillStyle = '#3a3a42'; g.fillRect(cx - 4, cy + 4, 8, 4); g.fillRect(cx - 1.5, cy - 12, 3, 18); // bracket and stick
    g.fillStyle = '#6b4a2a'; g.fillRect(cx - 2.5, cy - 12, 5, 12);
    const gr = g.createRadialGradient(cx, cy - 14, 3, cx, cy - 14, 44); gr.addColorStop(0, `rgba(255,170,60,${0.4 * gl})`); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy - 14, 44, 0, 7); g.fill();
    g.fillStyle = `rgba(255,120,30,${gl})`; g.beginPath(); g.moveTo(cx - 5, cy - 12); g.quadraticCurveTo(cx - 6 + fl, cy - 22, cx, cy - 28 + fl); g.quadraticCurveTo(cx + 6 + fl, cy - 22, cx + 5, cy - 12); g.closePath(); g.fill();
    g.fillStyle = `rgba(255,220,120,${gl})`; g.beginPath(); g.moveTo(cx - 2.5, cy - 12); g.quadraticCurveTo(cx - 2 + fl * 0.5, cy - 18, cx, cy - 22 + fl); g.quadraticCurveTo(cx + 2 + fl * 0.5, cy - 18, cx + 2.5, cy - 12); g.closePath(); g.fill();
  }
  function drawEgg(g, tx, ty, e) {
    const cx = tc(tx), cy = tc(ty), p = e ? clamp(e.t / EGG_HATCH, 0, 1) : 0, pulse = 1 + Math.sin(time * (4 + p * 10)) * 0.04 * (0.5 + p);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 14, 14, 5, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(233,238,245,0.55)'; g.lineWidth = 1; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 6); g.lineTo(cx + Math.cos(a) * 22, cy + 14 + Math.sin(a) * 6); g.stroke(); } // silk strands to the floor
    g.save(); g.translate(cx, cy + 2); g.scale(pulse, pulse);
    g.fillStyle = '#e8e2d8'; g.beginPath(); g.ellipse(0, 0, 13, 16, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(-4, -6, 5, 6, 0, 0, 7); g.fill();
    g.fillStyle = `rgba(60,50,70,${0.25 + p * 0.5})`; for (const [ox, oy] of [[3, 2], [-5, 5], [1, -8], [6, -3]]) { g.beginPath(); g.arc(ox, oy, 1.6 + p * 1.2, 0, 7); g.fill(); } // the spiderling shows through
    g.strokeStyle = 'rgba(160,150,170,0.6)'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 0, 13, 16, 0, 0, 7); g.stroke();
    g.restore();
  }
  function drawChest(g, tx, ty, opened) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 8, y + 36, 32, 6);
    g.fillStyle = '#5a3a1e'; g.fillRect(x + 8, y + 12, 32, 26); g.fillStyle = opened ? '#2a2a30' : '#4a2e13'; g.fillRect(x + 8, y + 10, 32, 10);
    g.fillStyle = '#8f96a3'; g.fillRect(x + 12, y + 10, 4, 28); g.fillRect(x + 32, y + 10, 4, 28); g.fillRect(x + 8, y + 19, 32, 3);
    g.fillStyle = opened ? '#6e7178' : '#f5c542'; g.fillRect(x + 21, y + 17, 6, 7);
    if (!opened) { g.strokeStyle = 'rgba(233,238,245,0.7)'; g.lineWidth = 1.2; for (const [a, b, c, d] of [[6, 8, 42, 30], [8, 34, 40, 12], [4, 22, 44, 20], [24, 6, 26, 40]]) { g.beginPath(); g.moveTo(x + a, y + b); g.lineTo(x + c, y + d); g.stroke(); } } // webbed shut
    g.strokeStyle = '#2a2a30'; g.lineWidth = 1; g.strokeRect(x + 8, y + 10, 32, 28);
  }
  // darkness: an offscreen layer with holes cut by destination-out (the core's cave technique, as in 24-dwarves)
  const darkC = document.createElement('canvas');
  function drawDark(g) {
    if (darkC.width !== canvas.width || darkC.height !== canvas.height) { darkC.width = canvas.width; darkC.height = canvas.height; }
    const dg = darkC.getContext('2d');
    dg.setTransform(DPR, 0, 0, DPR, 0, 0); dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, VW, VH);
    dg.fillStyle = 'rgba(4,6,14,0.6)'; dg.fillRect(0, 0, VW, VH);
    dg.globalCompositeOperation = 'destination-out';
    const lights = [{ x: player.x, y: player.y, r: 150 }];
    const inst = active.inst;
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 3), x1 = Math.min(inst.w - 1, Math.ceil((cam.x + VW) / TILE) + 3);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 3), y1 = Math.min(inst.h - 1, Math.ceil((cam.y + VH) / TILE) + 3);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const t = map[idx(tx, ty)]; if (t === T_TORCH) lights.push({ x: tc(tx), y: tc(ty) - 14, r: 130 }); else if (t === T_EXIT) lights.push({ x: tc(tx), y: tc(ty) - 10, r: 110 }); }
    for (const L of lights) {
      const sx = L.x - cam.x, sy = L.y - cam.y; if (sx < -L.r || sy < -L.r || sx > VW + L.r || sy > VH + L.r) continue;
      const gr = dg.createRadialGradient(sx, sy, 10, sx, sy, L.r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = gr; dg.beginPath(); dg.arc(sx, sy, L.r, 0, 7); dg.fill();
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(darkC, 0, 0); g.restore();
  }
  const USABLE = [T_DOOR, T_EXIT, T_EGG, T_CHEST];
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
    const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE));
    for (let ty = y0; ty <= y1 + 2; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === T_DOOR) items.push({ y: ty * TILE + TILE - 6, draw: () => drawDoor(g, tx, ty) });
      else if (t === T_EXIT) items.push({ y: ty * TILE + TILE - 6, draw: () => drawExit(g, tx, ty) });
      else if (t === T_TORCH) items.push({ y: ty * TILE + TILE - 6, draw: () => drawTorch(g, tx, ty) });
      else if (t === T_EGG) items.push({ y: ty * TILE + TILE - 6, draw: () => drawEgg(g, tx, ty, eggAt(tx, ty)) });
      else if (t === T_CHEST) items.push({ y: ty * TILE + TILE - 6, draw: () => drawChest(g, tx, ty, !!(active && Q().chests[active.id + ':' + tx + ',' + ty])) });
      else if (t === T_SHROOM) items.push({ y: ty * TILE - 2 * TILE, draw: () => drawFurniture(g, tx, ty, T.MUSHROOM) });
    }
    if (active && active.inst.dark) items.push({ y: 1e9, draw: () => drawDark(g) });
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 1, draw: () => {
      const { tx, ty } = frontTile(player);
      if (USABLE.includes(tileAt(tx, ty))) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });
  // HUD: where you are and how to get out
  HOOKS.hud.push((g, narrow) => {
    if (!active) return;
    const lay = typeof HUD_LAYOUT !== 'undefined' ? HUD_LAYOUT : null, touchFloor = (isTouch && lay && !lay.short) ? lay.hotbarY + lay.hotbarH + 12 : 0;
    const inst = active.inst, y = Math.max(HUD.leftY, touchFloor, 84), w = narrow && isTouch ? VW - 108 : 250, h = isTouch ? 52 : 40; // shared left-HUD cursor, under the law / companion tags and clear of the touch hotbar
    roundRect(g, 14, y, w, h, 10); g.fillStyle = 'rgba(10,14,22,0.78)'; g.fill();
    g.fillStyle = '#e6edf3'; g.font = `700 13px ${DISPLAY}`; g.textAlign = 'left'; g.fillText(inst.name.toUpperCase(), 26, y + 18);
    const alive = monsters.filter(m => !m.dead).length;
    g.fillStyle = '#8b949e'; g.font = '11px sans-serif'; g.fillText(inst.boss && !active.cleared ? `${alive} left · boss alive` : active.cleared ? 'cleared' : `${alive} left`, 26, y + 32);
    if (active.webT > 0) { g.fillStyle = '#e9eef5'; g.fillText(`webbed ${active.webT.toFixed(1)}s`, 130, y + 32); }
    if (isTouch) button(g, 14 + w - 74, y + 12, 62, 28, 'LEAVE', () => { leaveInstance(); notify('You climb back out into the light.'); }, '#7a2e2e');
    else { g.fillStyle = '#8b949e'; g.textAlign = 'right'; g.fillText('L to leave', 14 + w - 12, y + 18); }
    HUD.leftY = y + h + 6;
  });

  // ============================================================================
  // THE SPIDER DEN — the first dungeon (Chapter 1–2): a winding dark cave behind a door on the cave cliff
  // ============================================================================
  const DEN = { id: 'spider_den', w: 40, h: 30 };
  // the top-left 21×16 of the core map is the core's own cave: its darkness overlay is drawn there whenever the camera is
  // near the origin, so the den keeps that corner solid rock and winds through the L-shaped rest
  const denAllowed = (x, y) => x >= 1 && x <= DEN.w - 2 && y >= 1 && y <= DEN.h - 2 && !(x <= 21 && y <= 16);
  const DEN_ENTRY = [34, 3], DEN_EXIT = [34, 2], DEN_BOSS = [12, 22], DEN_CHEST_T = [3, 26];
  const DEN_CHAMBERS = [[34, 5, 3.2], [27, 11, 3.6], [33, 18, 3.6], [24, 24, 3.6], [12, 22, 4.6], [5, 26, 2.2]];
  const DEN_PATH = [[34, 5], [31, 9], [27, 11], [29, 15], [33, 18], [30, 22], [24, 24], [19, 23], [12, 22], [8, 25], [5, 26]];
  const DEN_SPAWNS = [
    ['spider', 26, 10], ['spider', 28, 12], ['spider', 25, 12],
    ['spider', 32, 17], ['spider', 34, 19], ['giant_spider', 33, 18],
    ['giant_spider', 23, 23], ['giant_spider', 25, 25], ['spider', 26, 23], ['spider', 22, 25],
    ['brood_mother', DEN_BOSS[0], DEN_BOSS[1]], ['giant_spider', 14, 20], ['spider', 10, 24],
  ];
  function buildDen(set, rnd, at) {
    const carve = (cx, cy, r, ragged) => { for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) { if (!denAllowed(x, y)) continue; const rr = ragged ? r * (0.72 + rnd() * 0.56) : r; if (dist(x, y, cx, cy) <= rr) set(x, y, T.CAVE); } };
    for (const [cx, cy, r] of DEN_CHAMBERS) carve(cx, cy, r, true);
    for (let s = 0; s < DEN_PATH.length - 1; s++) { const [ax, ay] = DEN_PATH[s], [bx, by] = DEN_PATH[s + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2; for (let k = 0; k <= n; k++) carve(ax + (bx - ax) * k / n, ay + (by - ay) * k / n, 1.3, true); }
    for (const [x, y] of [[DEN_ENTRY[0], DEN_ENTRY[1]], [DEN_ENTRY[0] - 1, DEN_ENTRY[1] + 1], [DEN_ENTRY[0] + 1, DEN_ENTRY[1] + 1], [DEN_ENTRY[0], DEN_ENTRY[1] + 1], [DEN_ENTRY[0] - 1, DEN_ENTRY[1]], [DEN_ENTRY[0] + 1, DEN_ENTRY[1]]]) set(x, y, T.CAVE);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(DEN_BOSS[0] + dx, DEN_BOSS[1] + dy, T.CAVE); // she is wider than a tile
    for (const [, x, y] of DEN_SPAWNS) set(x, y, T.CAVE);
    set(DEN_CHEST_T[0] + 1, DEN_CHEST_T[1], T.CAVE); set(DEN_CHEST_T[0] + 1, DEN_CHEST_T[1] + 1, T.CAVE); set(DEN_CHEST_T[0] + 2, DEN_CHEST_T[1], T.CAVE);
    set(DEN_CHEST_T[0], DEN_CHEST_T[1], T_CHEST);
    set(DEN_EXIT[0] - 1, DEN_EXIT[1], T.WALL); set(DEN_EXIT[0] + 1, DEN_EXIT[1], T.WALL); set(DEN_EXIT[0], DEN_EXIT[1] - 1, T.WALL);
    // ragged carving leaves the odd one-tile pocket in the rock: fill anything with no floor beside it
    for (let y = 1; y < DEN.h - 1; y++) for (let x = 1; x < DEN.w - 1; x++) if (at(x, y) === T.CAVE && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === T.CAVE)) set(x, y, T.WALL);
    // torches: the nearest wall tile that touches floor near each anchor
    const isFloor = (x, y) => at(x, y) === T.CAVE;
    const torchNear = (ax, ay) => { for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = ax + dx, y = ay + dy; if (!denAllowed(x, y) || at(x, y) !== T.WALL) continue; if (isFloor(x, y + 1) || isFloor(x - 1, y) || isFloor(x + 1, y)) { set(x, y, T_TORCH); return; } } };
    for (const [ax, ay] of [[31, 4], [37, 6], [24, 9], [30, 13], [29, 16], [36, 19], [31, 21], [21, 23], [27, 26], [16, 19], [8, 20], [9, 26], [14, 26], [4, 24]]) torchNear(ax, ay);
    // mushrooms on quiet floor
    const busy = (x, y) => DEN_SPAWNS.some(([, sx, sy]) => Math.abs(sx - x) <= 1 && Math.abs(sy - y) <= 1) || (Math.abs(x - DEN_ENTRY[0]) <= 1 && Math.abs(y - DEN_ENTRY[1]) <= 1) || (Math.abs(x - DEN_CHEST_T[0]) <= 1 && Math.abs(y - DEN_CHEST_T[1]) <= 1);
    for (let y = 1; y < DEN.h - 1; y++) for (let x = 1; x < DEN.w - 1; x++) if (at(x, y) === T.CAVE && !busy(x, y) && rnd() < 0.06) set(x, y, T_SHROOM);
  }
  const den = define(DEN.id, {
    name: 'The Spider Den', sub: 'Silk, and the thing that spins it', w: DEN.w, h: DEN.h, dark: true, boss: 'brood_mother',
    build: buildDen, spawns: DEN_SPAWNS, exit: DEN_EXIT, entry: DEN_ENTRY, door: [22, 3], step: [23, 3],
    voice: 'Silk. And the thing that spins it.',
    onClear: first => {
      say('The Brood Mother curls up and is still. The den is yours. Her chest at the back is webbed shut no longer.', 'The Voice');
      if (first) { giveOrDrop('silk_cloak', 1, player.x, player.y); say('A cloak of her silk. Light, and stronger than it looks.', 'The Voice'); }
    },
  });
  den.chestLoot = [['stone_arrow', 30]];
  // the door sits in a little cliff face east of the cave, with a clear patch and a path down to the road
  HOOKS.world.push((rnd, api) => {
    for (const [x, y] of [[21, 2], [21, 3], [21, 4], [22, 2], [22, 4]]) api.setTile(x, y, T.WALL);
    const soft = [T.TREE, T.OAK, T.ROCK, T.IRON, T.COAL, T.FLOWERS, T.MUSHROOM, T.STUMP];
    for (let y = 2; y <= 5; y++) for (let x = 23; x <= 25; x++) if (soft.includes(api.tileAt(x, y))) api.setTile(x, y, T.GRASS);
    for (let y = 3; y <= 6; y++) if ([T.GRASS, T.DIRT].includes(api.tileAt(23, y))) api.setTile(23, y, T.DIRT);
  });

  window.INSTANCES = { define, enter: enterInstance, leave: leaveInstance, list: () => Object.keys(INST), active: () => active && active.id, get: id => INST[id] };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const sum = () => { let s = 0; for (let i = 0; i < map.length; i++) s = (Math.imul(s, 31) + map[i]) | 0; return s; };
    const tileOf = () => [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
    const onStep = () => { const [x, y] = tileOf(); return x === 23 && y === 3; };
    const enterByDoor = () => { if (active) leaveInstance(); closePanel(); F.tp(23, 3); F.face(22, 3); F.press('KeyE'); F.sim(2, []); return active && active.id === DEN.id; };
    h.peace(true); if (active) leaveInstance();
    // the overworld must hold still while its checksum is compared: no stump regrows, no fire burns out; fists or a blade, not a bow
    const rg0 = regrow, fr0 = fires; regrow = []; fires = [];
    const w0 = player.equip.weapon; if (w0 && ITEMS[w0].weapon && ITEMS[w0].weapon.ranged) player.equip.weapon = null;
    const beside = (tx, ty) => { for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const nx = tx + dx, ny = ty + dy; if (!SOLID.has(tileAt(nx, ny)) && !collides(tc(nx), tc(ny), 13, 'player')) return { x: tc(nx), y: tc(ny) }; } return safeSpot(tc(tx), tc(ty), 13, 'player'); };
    check('instance: entrance door on the cave cliff at (22,3) with a dirt step at (23,3)', tileAt(22, 3) === T_DOOR && tileAt(23, 3) === T.DIRT && !SOLID.has(tileAt(23, 3)) && DOORS[idx(22, 3)] && DOORS[idx(22, 3)].id === DEN.id, { door: tileAt(22, 3), step: tileAt(23, 3) });
    const sum0 = sum(), n0 = monsters.length, diffs0 = mapDiffs.size;
    { const ok = enterByDoor(); const [px, py] = tileOf();
      const path = F.bfs(DEN_ENTRY[0], DEN_ENTRY[1], DEN_BOSS[0], DEN_BOSS[1]), chestPath = F.bfs(DEN_ENTRY[0], DEN_ENTRY[1], DEN_CHEST_T[0] + 1, DEN_CHEST_T[1]);
      check('instance: E on the door swaps the map in (WALL at 0,0; the brood chamber is CAVE), knight at the entry, region + banner set, 13 monsters', ok && window.__instance === DEN.id && tileAt(0, 0) === T.WALL && tileAt(DEN_BOSS[0], DEN_BOSS[1]) === T.CAVE && px === DEN_ENTRY[0] && py === DEN_ENTRY[1] && player.region === 'The Spider Den' && !!areaBanner && areaBanner.name === 'The Spider Den' && monsters.length === 13 && monsters.filter(m => m.type === 'spider').length === 8 && monsters.filter(m => m.type === 'giant_spider').length === 4 && monsters.some(m => m.type === 'brood_mother') && tileAt(DEN_EXIT[0], DEN_EXIT[1]) === T_EXIT, { ok, at: [px, py], region: player.region, monsters: monsters.length, inst: window.__instance });
      let torches = 0, shrooms = 0; for (let y = 0; y < DEN.h; y++) for (let x = 0; x < DEN.w; x++) { const t = tileAt(x, y); if (t === T_TORCH) torches++; else if (t === T_SHROOM) shrooms++; }
      check('instance: the den winds from the ladder to the brood chamber and the chest; torches on the walls, mushrooms on the floor; the core cave corner stays rock', !!path && !!chestPath && path.length > 30 && torches >= 8 && shrooms >= 10 && tileAt(10, 10) === T.WALL && tileAt(21, 7) === T.WALL, { path: path && path.length, chest: chestPath && chestPath.length, torches, shrooms }); }
    { const tx = DEN_ENTRY[0], ty = DEN_ENTRY[1] + 1; const t0 = tileAt(tx, ty); changeTile(tx, ty, T_SHROOM); const same = mapDiffs.size === diffs0 && tileAt(tx, ty) === T_SHROOM; changeTile(tx, ty, t0);
      check('instance: changeTile inside edits the dungeon but never mapDiffs', same && mapDiffs.size === diffs0, { diffs: mapDiffs.size, diffs0 }); }
    { const left = leaveInstance(); F.sim(2, []);
      check('instance: leaving restores the overworld exactly (map checksum, monster count) and stands you on the step', left && window.__instance === null && sum() === sum0 && monsters.length === n0 && onStep() && !REGIONS.some(r => r.name === 'The Spider Den') && NPCS.some(n => n.id === 'death1') && BUILDINGS.some(b => b.id === 'death1'), { same: sum() === sum0, monsters: monsters.length, n0, at: tileOf() }); }
    { enterByDoor(); const inv0 = player.inv.map(s => s ? { ...s } : null), dk0 = deathKeep, bed0 = player.bedSpawn; player.bedSpawn = null;
      hurtPlayer(player.hp + 999, player.x + 10, player.y, true); const died = player.dead; F.sim(200, []);
      check('instance: dying inside respawns you outside on the step tile, instance closed, overworld back', died && !player.dead && window.__instance === null && onStep() && sum() === sum0 && monsters.length === n0, { died, at: tileOf(), inst: window.__instance });
      player.inv = inv0; deathKeep = dk0; player.bedSpawn = bed0; }
    // eggs: laid near the Brood Mother, hatch after 6 s, broken by E or a swing
    { enterByDoor(); const bm = monsters.find(m => m.type === 'brood_mother'); F.tp(DEN_BOSS[0] + 3, DEN_BOSS[1]); bm.x = tc(DEN_BOSS[0]); bm.y = tc(DEN_BOSS[1]); bm.state = 'idle'; bm.wanderT = 99; bm.wander = { x: 0, y: 0 }; bm.eggT = 0;
      const eggs = () => { let n = 0; for (let y = 0; y < DEN.h; y++) for (let x = 0; x < DEN.w; x++) if (tileAt(x, y) === T_EGG) n++; return n; };
      F.sim(2, []); const laid = eggs(); const m0 = monsters.length; bm.eggT = 99;
      F.sim(Math.ceil(6.2 * 60), []); const hatched = eggs() === 0 && monsters.length === m0 + laid && monsters.filter(m => m.type === 'spider' && m.hatched).length === laid;
      bm.eggT = 0; F.sim(2, []); const laid2 = eggs(); const e = active.eggs[0]; let swung = false, byE = false;
      if (e) { const sp = beside(e.tx, e.ty); player.x = sp.x; player.y = sp.y; F.face(e.tx, e.ty); player.attackCd = 0; F.press('Space'); F.sim(2, []); swung = tileAt(e.tx, e.ty) === T.CAVE && !active.eggs.includes(e); }
      let e2 = active.eggs[0]; if (!e2) { bm.eggT = 0; F.sim(2, []); e2 = active.eggs[0]; }
      if (e2) { const sp = beside(e2.tx, e2.ty); player.x = sp.x; player.y = sp.y; F.face(e2.tx, e2.ty); closePanel(); F.press('KeyE'); F.sim(2, []); byE = tileAt(e2.tx, e2.ty) === T.CAVE; }
      check('instance: the Brood Mother lays 2 eggs that hatch into spiders after 6 s; a swing or E breaks one', laid === 2 && hatched && laid2 === 2 && swung && byE, { laid, hatched, laid2, swung, byE, eggsNow: eggs() });
      for (const x of active.eggs.slice()) breakEgg(x, true); monsters = monsters.filter(m => !m.hatched); }
    // the web at half hp, then the kill: banner, cloak once, chest once
    { const bm = monsters.find(m => m.type === 'brood_mother'); const q = Q(); q.cleared[DEN.id] = 0; q.chests = {}; player.equip.body = null; player.mech = null; player.speed = BASE_SPEED;
      let free = player.inv.filter(s => !s).length; for (let i = player.inv.length - 1; i >= 0 && free < 3; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour) { player.inv[i] = null; free++; } }
      F.tp(DEN_BOSS[0] + 3, DEN_BOSS[1]); bm.x = tc(DEN_BOSS[0]); bm.y = tc(DEN_BOSS[1]); bm.hp = 60; bm.webbed = false; bm.eggT = 99; F.sim(2, []); const webbed = player.speed === WEB_SPEED && active.webT > 0; F.sim(260, []); const torn = player.speed === BASE_SPEED && active.webT === 0;
      check('instance: at half hp the Brood Mother webs the knight (slow for 4 s, then free)', webbed && torn, { webbed, torn, speed: player.speed });
      const cloak = () => countItem('silk_cloak') + drops.filter(d => d.id === 'silk_cloak').reduce((s, d) => s + d.qty, 0);
      const kill = () => { const b = monsters.find(m => m.type === 'brood_mother'); b.hp = 1; b.stunT = 0; b.state = 'idle'; player.facing = { x: -1, y: 0 }; for (let i = 0; i < 80 && !b.dead; i++) { b.x = player.x - 50; b.y = player.y; b.stunT = 0; player.attackCd = 0; F.press('Space'); F.sim(3, []); } return b.dead; };
      const k1 = kill(); F.sim(3, []); const banner = !!levelBanner && levelBanner.text === 'DUNGEON CLEARED'; const c1 = cloak(); const cleared1 = q.cleared[DEN.id];
      check('instance: killing the Brood Mother shows DUNGEON CLEARED and gives the silk cloak (body, def 6)', k1 && banner && c1 === 1 && cleared1 === 1 && ITEMS.silk_cloak.armour.slot === 'body' && ITEMS.silk_cloak.armour.def === 6, { k1, banner: levelBanner && levelBanner.text, cloak: c1, cleared: cleared1 });
      drops = drops.filter(d => d.id !== 'silk_cloak');
      const cx = DEN_CHEST_T[0], cy = DEN_CHEST_T[1]; F.tp(cx + 1, cy); F.face(cx, cy); const a0 = countItem('stone_arrow'); F.press('KeyE'); F.sim(2, []); const got = countItem('stone_arrow') + drops.filter(d => d.id === 'stone_arrow').reduce((s, d) => s + d.qty, 0) - a0; F.press('KeyE'); F.sim(2, []); const got2 = countItem('stone_arrow') + drops.filter(d => d.id === 'stone_arrow').reduce((s, d) => s + d.qty, 0) - a0;
      check('instance: the chest at the back gives 30 stone arrows once', got === 30 && got2 === 30 && Object.keys(q.chests).length === 1, { got, got2, chests: Object.keys(q.chests) });
      drops = drops.filter(d => d.id !== 'stone_arrow');
      enterByDoor(); F.tp(DEN_BOSS[0] + 3, DEN_BOSS[1]); const fresh = monsters.some(m => m.type === 'brood_mother' && !m.dead); const k2 = kill(); F.sim(3, []);
      check('instance: a second visit brings the Brood Mother back; a second kill gives no second cloak', fresh && k2 && cloak() === 1 && q.cleared[DEN.id] === 2, { fresh, k2, cloak: cloak(), cleared: q.cleared[DEN.id] });
      drops = drops.filter(d => d.id !== 'silk_cloak' && d.id !== 'spider_silk' && d.id !== 'coins'); }
    // save inside → the save describes the overworld with the knight on the step; load lands outside
    { if (!active) enterByDoor(); F.tp(DEN_BOSS[0] + 3, DEN_BOSS[1]); save(); const raw = JSON.parse(localStorage.getItem(SAVE_KEY)); const still = active && active.id === DEN.id && Math.floor(player.x / TILE) === DEN_BOSS[0] + 3;
      const ok = load(); F.sim(2, []);
      check('instance: save() inside stores the knight on the step outside; load() lands outside the den', still && raw.player.x === tc(23) && raw.player.y === tc(3) && raw.player.region !== 'The Spider Den' && ok && window.__instance === null && player.region !== 'The Spider Den' && onStep() && tileAt(22, 3) === T_DOOR && sum() === sum0, { still, saved: [raw.player.x / TILE - 0.5, raw.player.y / TILE - 0.5], region: player.region, at: tileOf() }); }
    { enterByDoor(); const inside = window.__instance === DEN.id; F.press('KeyL'); F.sim(2, []);
      check('instance: L leaves the dungeon', inside && window.__instance === null && onStep() && sum() === sum0, { inside, at: tileOf() }); }
    { F.tp(23, 3); F.face(22, 3); F.press('KeyE'); F.sim(2, []); const inside = window.__instance === DEN.id; F.tp(DEN_EXIT[0], DEN_EXIT[1] + 1); F.face(DEN_EXIT[0], DEN_EXIT[1]); F.press('KeyE'); F.sim(2, []);
      check('instance: E on the exit ladder leaves too; INSTANCES API lists the den', inside && window.__instance === null && onStep() && INSTANCES.list().includes(DEN.id) && INSTANCES.active() === null, { inside, at: tileOf(), list: INSTANCES.list() }); }
    if (active) leaveInstance(); regrow = rg0; fires = fr0; if (w0 && !player.equip.weapon) player.equip.weapon = w0; save(); h.peace(false);
  });
}
