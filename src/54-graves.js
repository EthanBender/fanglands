// ============================================================================
// WHAT THE GOBLINS LEAVE BEHIND — grave markers by day, zombies out of them by night
// Owner's design, in his words: "Every time you kill a goblin it leaves a little gravestone or grave marker,
// like a little wooden cross. And then at night, that's where the zombies spawn, and they remove the cross.
// It's kind of a way of closing the loop. Zombies should have slightly better drops than just rotten flesh
// and should have a rare chance at a powerful skull mace. The zombie mace."
// So the map remembers your day. Every goblin you put down leaves a cross where it fell; after dark the ones
// near you push a zombie up and the cross goes with it. Fight where you fought yesterday and the night is
// busier. Fight somewhere new and it is quiet. Crosses fade by themselves if nothing ever rises from them.
// Feature file: registers through HOOKS only, edits no core file. window.GRAVES exposes the tables.
// ============================================================================
{
  // ---------- the marker ----------
  // Walk-over on purpose: a solid one would fence the knight in exactly the way the wrecks used to.
  const T_CROSS = addTile('GRAVE_MARKER', { tex: 'grass', mini: '#8a6a3a' });
  INTERESTING_TILES.add(T_CROSS);

  const MAX_MARKERS = 40;        // the map remembers your last forty kills, not every kill you ever made
  const MARKER_LIFE = 900;       // game seconds a cross stands if nothing rises from it (two nights)
  const RISE_RADIUS = 14;        // tiles: a cross this close to the knight can push a zombie up
  const GOBLIN_KIN = ['goblin', 'sapper', 'brute', 'goblin_archer', 'castle_guard'];

  const isGoblinKin = type => {
    if (GOBLIN_KIN.includes(type)) return true;
    const d = MONSTER_DEFS[type];
    return !!d && !d.mech && /goblin/i.test(d.name || '');
  };
  const marks = () => { if (!Array.isArray(quest.graves)) quest.graves = []; return quest.graves; };
  HOOKS.newGame.push(() => { quest.graves = []; });

  // markers are saved as plain tile coordinates and re-laid on load, so nothing depends on a tile id
  const layMarker = (tx, ty) => {
    if (!inMap(tx, ty)) return false;
    const t = tileAt(tx, ty);
    if (![T.GRASS, T.DIRT, T.SAND, T.SCORCH].includes(t)) return false; // SCORCH is added by 20-hollowford; undefined simply never matches
    if (buildingAt(tx, ty)) return false;
    const list = marks();
    if (list.some(m => m.x === tx && m.y === ty)) return false;
    changeTile(tx, ty, T_CROSS);
    list.push({ x: tx, y: ty, t: 0, was: tileName(t) });
    while (list.length > MAX_MARKERS) { const old = list.shift(); clearMarker(old, true); }
    return true;
  };
  function clearMarker(m, quiet) {
    if (!m) return;
    if (tileAt(m.x, m.y) === T_CROSS) changeTile(m.x, m.y, (m.was && tileId(m.was) !== null) ? tileId(m.was) : T.GRASS);
    if (!quiet) burst(tc(m.x), tc(m.y), '#6a5a3a', 8, 50);
  }
  const removeMarker = m => { const list = marks(); const i = list.indexOf(m); if (i >= 0) list.splice(i, 1); clearMarker(m); };

  // ---------- a goblin falls, a cross goes up ----------
  HOOKS.kill.push(m => {
    if (!m || !isGoblinKin(m.type)) return;
    if (window.INSTANCES && INSTANCES.active()) return;           // dungeons keep their own dead
    const tx = Math.floor(m.x / TILE), ty = Math.floor(m.y / TILE);
    if (layMarker(tx, ty)) return;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (layMarker(tx + dx, ty + dy)) return;
  });

  // ---------- a cross ages, and after dark it gives something back ----------
  const night = () => !!window.NIGHT && NIGHT.phase && NIGHT.phase() === 'night';
  let sweep = 0;
  HOOKS.update.push(dt => {
    const list = marks(); if (!list.length) return;
    sweep += dt; if (sweep < 1) return; const step = sweep; sweep = 0;
    for (const m of list.slice()) {
      m.t = (m.t || 0) + step;
      if (tileAt(m.x, m.y) !== T_CROSS) { const i = list.indexOf(m); if (i >= 0) list.splice(i, 1); continue; } // something built over it
      if (m.t > MARKER_LIFE) removeMarker(m);
    }
  });

  // The night spawner in 35-night picks an empty tile in a ring round the knight. This runs first and offers it
  // a grave instead: same spawner, same limits, but the dead come up where the dead were left.
  window.__graveRise = null;
  const riseSpot = () => {
    if (!night()) return null;
    const list = marks(); if (!list.length) return null;
    const px = Math.floor(player.x / TILE), py = Math.floor(player.y / TILE);
    const near = list.filter(m => tileAt(m.x, m.y) === T_CROSS
      && Math.abs(m.x - px) <= RISE_RADIUS && Math.abs(m.y - py) <= RISE_RADIUS
      && dist(tc(m.x), tc(m.y), player.x, player.y) > 3 * TILE
      && !(window.NIGHT && NIGHT.inNoGo && NIGHT.inNoGo(m.x, m.y))
      && !collides(tc(m.x), tc(m.y), 13, 'beast'));
    if (!near.length) return null;
    return near[Math.floor(Math.random() * near.length)];
  };
  // 35-night's spawner reads its tile from spawnTile(); wrapping the monster-list push is fragile, so instead
  // this hook watches for a zombie that has just appeared and moves it onto a grave, which is what the owner
  // asked for and what a player sees: the cross goes, and the thing that comes up stands where it stood.
  let known = new Set();
  HOOKS.update.push(() => {
    if (!night()) { if (known.size) known = new Set(); return; }
    for (const m of monsters) {
      if (m.dead || !m.night || known.has(m)) continue;
      known.add(m);
      if (m.type !== 'zombie' && m.type !== 'grave_zombie') continue;
      const g = riseSpot(); if (!g) continue;
      m.x = tc(g.x); m.y = tc(g.y); m.home = { x: m.x, y: m.y };
      m.fromGrave = true;
      burst(m.x, m.y, '#6a5a3a', 14, 70);
      floatText(m.x, m.y - 28, 'The cross falls', '#8b949e', 12);
      removeMarker(g);
    }
    for (const m of [...known]) if (m.dead) known.delete(m);
  });

  // ---------- the cross itself ----------
  HOOKS.use.push(t => {
    if (t !== T_CROSS) return false;
    notify(night() ? 'A goblin fell here. The ground is loose tonight.' : 'A goblin fell here. Someone pushed a cross into the ground for it.');
    return true;
  });

  HOOKS.draw.push((g, items) => {
    const list = marks(); if (!list.length) return;
    const x0 = cam.x / TILE - 2, x1 = (cam.x + VW) / TILE + 2, y0 = cam.y / TILE - 2, y1 = (cam.y + VH) / TILE + 2;
    for (const m of list) {
      if (m.x < x0 || m.x > x1 || m.y < y0 || m.y > y1) continue;
      if (tileAt(m.x, m.y) !== T_CROSS) continue;
      const restless = night();
      items.push({ y: tc(m.y), draw: () => {
        const x = tc(m.x), y = tc(m.y);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + 9, 8, 3.5, 0, 0, 7); g.fill();
        g.fillStyle = '#6b4f2a'; g.fillRect(x - 1.6, y - 12, 3.2, 21);
        g.fillStyle = '#7a5a32'; g.fillRect(x - 6, y - 7, 12, 3);
        if (restless) { // the ground remembers after dark
          const p = 0.35 + Math.sin(time * 3 + m.x + m.y) * 0.2;
          g.fillStyle = `rgba(126,231,135,${p * 0.35})`; g.beginPath(); g.ellipse(x, y + 8, 10, 4.5, 0, 0, 7); g.fill();
        }
      } });
    }
  });

  // ---------- the zombie mace, and drops worth the walk ----------
  Object.assign(ITEMS, {
    skull_mace: { name: 'Skull mace', value: 1600, color: '#cfd3d8', shape: 'warhammer', stack: 1, weapon: { str: 26, att: 12, cd: 0.7, perk: 'knockback' } },
    grave_iron: { name: 'Grave iron', value: 45, color: '#7a7f86', shape: 'bar', stack: 50 },
  });
  ITEMS.skull_mace.id = 'skull_mace'; ITEMS.grave_iron.id = 'grave_iron';

  // A zombie was worth coins and a scrap of cloth. Now it is worth the walk: iron off the dead, grave dust,
  // and one in a hundred and fifty carries the mace. The grave zombie is the better bet, as it should be.
  const zombieDrops = {
    always: [['coins', 8, 20]],
    table: [['nothing', 0, 0, 3], ['rotten_cloth', 1, 2, 6], ['grave_iron', 1, 1, 4], ['grave_dust', 1, 1, 3], ['coal', 1, 2, 2], ['bread', 1, 1, 2]],
    rare: { chance: 150, table: [['skull_mace', 1, 1, 1]] },
  };
  for (const key of ['zombie', 'zombie_calm']) if (MONSTER_DEFS[key]) MONSTER_DEFS[key].drops = { ...zombieDrops, table: zombieDrops.table.slice() };
  for (const key of ['grave_zombie', 'grave_zombie_calm']) if (MONSTER_DEFS[key]) {
    MONSTER_DEFS[key].drops = {
      always: [['coins', 20, 40], ['grave_dust', 1, 1]],
      table: [['nothing', 0, 0, 2], ['grave_iron', 1, 3, 6], ['rotten_cloth', 1, 2, 4], ['steel_bar', 1, 1, 2]].filter(r => r[0] === 'nothing' || ITEMS[r[0]]),
      rare: { chance: 40, table: [['skull_mace', 1, 1, 2], ['vampire_fang', 1, 1, 3]].filter(r => ITEMS[r[0]]) },
    };
  }
  // one raised out of a grave you dug yourself carries a little more
  HOOKS.kill.push(m => {
    if (!m || !m.fromGrave) return;
    giveOrDrop('grave_iron', rint(1, 2), m.x, m.y);
    floatText(m.x, m.y - 34, 'Off the grave', '#8b949e', 12);
  });

  window.GRAVES = { tile: T_CROSS, MAX_MARKERS, MARKER_LIFE, RISE_RADIUS, marks, layMarker, removeMarker, riseSpot, isGoblinKin, zombieDrops };

  // ---------- self-test ----------
  const P = 'graves: ';
  HOOKS.selfTest.push((check, F, h) => {
    const g0 = Array.isArray(quest.graves) ? quest.graves.slice() : [];
    quest.graves = [];
    // a goblin that falls leaves a cross where it fell, and the cross does not block you
    { const o = h.openSpot(58, 30); F.tp(o.x, o.y);
      const tx = Math.floor(player.x / TILE) + 6, ty = Math.floor(player.y / TILE); // clear of the 3-tile 'not under your feet' rule in riseSpot
      const was = tileAt(tx, ty); changeTile(tx, ty, T.GRASS);
      for (const hk of HOOKS.kill) hk({ type: 'goblin', dead: true, x: tc(tx), y: tc(ty), r: 12 });
      const laid = tileAt(tx, ty) === GRAVES.tile, listed = GRAVES.marks().some(m => m.x === tx && m.y === ty);
      const walkable = !solidFor(tileAt(tx, ty), 'player') && !collides(tc(tx), tc(ty), 13, 'player');
      // a sheep leaves nothing
      const sx = tx + 2; const sWas = tileAt(sx, ty); changeTile(sx, ty, T.GRASS);
      for (const hk of HOOKS.kill) hk({ type: 'sheep', dead: true, x: tc(sx), y: tc(ty), r: 12 });
      const noSheepCross = tileAt(sx, ty) !== GRAVES.tile;
      changeTile(sx, ty, sWas);
      check(P + 'a fallen goblin leaves a cross you can walk over; a sheep leaves nothing', laid && listed && walkable && noSheepCross, { laid, listed, walkable, noSheepCross });
      // and after dark a zombie comes up on it, taking the cross with it
      if (laid && window.NIGHT) {
        const t0 = player.dayTime;
        player.dayTime = NIGHT.LIGHT + NIGHT.DUSK + 20;          // past dusk, properly dark (day 600, light 420, dusk 60)
        const isNight = NIGHT.phase() === 'night';
        const z = { type: 'zombie', dead: false, night: true, x: player.x + 400, y: player.y, r: 13, home: { x: player.x + 400, y: player.y } };
        monsters.push(z);
        for (const u of HOOKS.update) u(0.016);
        const rose = Math.floor(z.x / TILE) === tx && Math.floor(z.y / TILE) === ty;
        const crossGone = tileAt(tx, ty) !== GRAVES.tile, unlisted = !GRAVES.marks().some(m => m.x === tx && m.y === ty);
        monsters.splice(monsters.indexOf(z), 1); player.dayTime = t0;
        check(P + 'after dark a zombie comes up out of a grave near you, and the cross goes with it', isNight && rose && crossGone && unlisted && z.fromGrave === true, { isNight, rose, crossGone, unlisted, fromGrave: !!z.fromGrave });
      } else check(P + 'after dark a zombie comes up out of a grave near you, and the cross goes with it', false, { laid, night: !!window.NIGHT });
      changeTile(tx, ty, was); quest.graves = []; }
    // the map remembers your last forty kills, not all of them
    { quest.graves = [];
      const o = h.openSpot(56, 34); const bx = o.x, by = o.y;
      let laid = 0, peak = 0;
      for (let i = 0; i < GRAVES.MAX_MARKERS * 2; i++) {
        const x = bx + (i % 14) * 2, y = by + Math.floor(i / 14) * 2;
        if (!inMap(x, y) || SOLID.has(tileAt(x, y)) || buildingAt(x, y)) continue;
        if (GRAVES.layMarker(x, y)) laid++;
        peak = Math.max(peak, GRAVES.marks().length);
      }
      const capped = peak <= GRAVES.MAX_MARKERS && GRAVES.marks().length <= GRAVES.MAX_MARKERS;
      const cleaned = GRAVES.marks().every(m => tileAt(m.x, m.y) === GRAVES.tile);
      for (const m of GRAVES.marks().slice()) GRAVES.removeMarker(m);
      const allGone = GRAVES.marks().length === 0;
      check(P + 'the ground keeps at most forty crosses, and the oldest is tidied away rather than left standing', laid > GRAVES.MAX_MARKERS && capped && cleaned && allGone, { laid, peak, kept: capped, cleaned, allGone }); }
    // zombies are worth the walk now, and one in a hundred and fifty carries the mace
    { const z = MONSTER_DEFS.zombie.drops, gz = MONSTER_DEFS.grave_zombie.drops;
      const zTable = z.table.reduce((a, r) => a + r[3], 0);
      const betterThanCloth = z.table.some(r => r[0] === 'grave_iron') && z.table.some(r => r[0] === 'grave_dust');
      const mace = !!ITEMS.skull_mace && z.rare && z.rare.chance === 150 && z.rare.table.some(r => r[0] === 'skull_mace');
      const graveBetter = gz.rare && gz.rare.chance < z.rare.chance;
      const strong = ITEMS.skull_mace.weapon.str > (ITEMS.steel_warhammer ? ITEMS.steel_warhammer.weapon.str : 20);
      check(P + 'a zombie drops more than rotten cloth, carries the skull mace at 1 in 150, and the grave zombie carries it more often', betterThanCloth && mace && graveBetter && strong && zTable > 0, { zTable, betterThanCloth, mace, graveBetter, str: ITEMS.skull_mace.weapon.str }); }
    // one raised from your own grave pays a little extra
    { const bag = player.inv.slice(); player.inv = player.inv.map(() => null);
      for (const hk of HOOKS.kill) hk({ type: 'zombie', dead: true, fromGrave: true, x: player.x, y: player.y, r: 13 });
      const extra = countItem('grave_iron');
      player.inv = bag;
      check(P + 'a zombie you raised out of your own kill pays grave iron on top', extra >= 1 && extra <= 2, { extra }); }
    quest.graves = g0;
  });
}
