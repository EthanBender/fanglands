// ============================================================================
// YOUR ISLAND, PART TWO — a Build button on every device, and walls only on your own ground
// Cohen (on his iPad): "I can't see the build button in the house on my iPad, so there should be a build button on
// all the devices when you're in the house. And you shouldn't be able to place blocks outside of ... the house floor."
//
// Why the button was missing: the island is an instance (16-instances), so 16-instances' LEAVE face (ctx seat, prio 30)
// always beat 63-house's BUILD face (prio 20). A keyboard has P; touch has nothing else. 63-house's BUILD now sits at
// prio 35, and this file gives LEAVE a seat of its own on the island: the block seat (nothing fights you there, so
// a shield has nothing to do). Both are on screen at every size, touch and mouse; P and L still work on the keys, and
// the arch by the porch still takes you home.
//
// Placement (owner's decision, 3 Oct): walls, floors and doors (an item whose place is PLANK, DOOR, FLOOR or WALL) go
// only on the island's own land: never in the shared world, never in a dungeon, never out over the sky. Beds,
// workbenches, goblin traps and the lodestone keep the core's rules. When Q (no item named) would put down a wall where
// one cannot go, he gets the plain line and nothing else goes down in the wall's place.
//
// Wraps placeAction by reassignment, explicit args (63-house and 54-graves wrap it before this file; this one runs first).
// window.ISLAND exposes the rule for checks.
// ============================================================================
{
  const WALL_PLACES = new Set(['PLANK', 'DOOR', 'FLOOR', 'WALL']);
  const ORDER = ['plank', 'door', 'bed', 'lodestone', 'workbench', 'goblin_trap'];   // the core's own Q order (06-systems)
  const NOT_HERE = 'Build walls and floors on your island.';
  const NOT_SKY = 'Build on the island’s own ground, not out over the sky.';
  const isWall = id => !!(id && ITEMS[id] && WALL_PLACES.has(ITEMS[id].place));
  const onIsland = () => !!(window.HOUSE && HOUSE.inside && window.INSTANCES && INSTANCES.active() === HOUSE.ID);
  // the island's own land: inside its grid and not sky in the island as it was built
  const islandLand = (tx, ty) => onIsland() && tx >= 0 && ty >= 0 && tx < HOUSE.W && ty < HOUSE.H && HOUSE.base(HOUSE.hidx(tx, ty)) !== HOUSE.tiles.sky;
  // why a wall cannot go in front of the knight (null when it can)
  function wallRefusal() {
    if (!onIsland()) return NOT_HERE;
    const { tx, ty } = frontTile(player, 40);
    return islandLand(tx, ty) ? null : NOT_SKY;
  }

  const _placeAction = placeAction;
  placeAction = function (id) {
    if (player.dead || player.mech) return _placeAction(id);
    if (!id) {
      // Q: the core takes the first of its list. When that is a wall that cannot go here he is told so, and nothing
      // else goes down in its place (a bed, a workbench or the lodestone cannot be picked back up in the world, and
      // a lodestone would move his home)
      const first = ORDER.find(k => ITEMS[k] && countItem(k) > 0);
      if (isWall(first)) { const why = wallRefusal(); if (why) { notify(why); return; } }
      return _placeAction(id);
    }
    if (isWall(id)) { const why = wallRefusal(); if (why) { notify(why); return; } }
    return _placeAction(id);
  };

  // ---------- LEAVE on the island: the block seat ----------
  const leaveIsland = () => { if (window.HOUSE && HOUSE.leave()) notify('You step back through into Thistledown.'); };
  hudSeatFace('block', { id: 'island_leave', prio: 30, when: () => onIsland() && !player.mech && !player.dead, emblem: 'leave', ribbon: 'LEAVE', key: 'L', name: 'Leave your island', action: leaveIsland });

  window.ISLAND = { WALL_PLACES, NOT_HERE, NOT_SKY, isWall, islandLand, wallRefusal };

  // ---------- self-test ----------
  const P = 'island: ';
  HOOKS.selfTest.push((check, F, h) => {
    if (!window.HOUSE) { check(P + 'the island is there', false, {}); return; }
    const own = k => Object.getOwnPropertyDescriptor(window, k);
    const keep = { w: own('innerWidth'), h: own('innerHeight'), t: window.__forceTouch, sr: window.__stickRight, bag: player.inv.map(s => (s ? { ...s } : null)), house: JSON.parse(JSON.stringify(player.house || {})), x: player.x, y: player.y };
    const setSize = (w, hh) => { window.innerWidth = w; window.innerHeight = hh; resize(); };
    const putBack = () => {
      if (keep.w) { Object.defineProperty(window, 'innerWidth', keep.w); Object.defineProperty(window, 'innerHeight', keep.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } }
      resize(); window.__forceTouch = keep.t; window.__stickRight = keep.sr;
    };
    const out = () => { if (HOUSE.inside) HOUSE.leave(); if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave(); F.sim(1, []); };
    const goIn = () => { out(); closePanel(); return HOUSE.enter(); };
    const empty = () => { player.inv = player.inv.map(() => null); };
    // a clear grass tile on the island with clear grass in front (north)
    const standAt = (x, y) => {
      if (SOLID.has(tileAt(x, y))) changeTile(x, y, T.GRASS);
      if (tileAt(x, y - 1) !== T.GRASS) changeTile(x, y - 1, T.GRASS);
      F.tp(x, y); F.face(x, y - 1); player.action = null;
      drops = drops.filter(d => !circleHitsTile(d.x, d.y, 8, x, y - 1));
      return [x, y - 1];
    };
    h.peace(true);
    try {
      // --- A. BUILD and LEAVE are both on screen on the island: iPad, phone and laptop ---
      { const seen = {};
        for (const [w, hh, t] of [[768, 1024, true], [390, 844, true], [1280, 800, false]]) {
          const where = `${w}x${hh} ${t ? 'touch' : 'mouse'}`;
          setSize(w, hh); window.__forceTouch = t;
          const went = goIn(); closePanel(); dialog.cur = null; dialog.queue.length = 0; render();
          const ctx = HK.face('ctx'), blk = HK.face('block'), plaques = (HK.FRAME.plaqueIds || []).slice();
          const onePlaque = !plaques.includes('dungeon') && (plaques.includes('island') || HK.FRAME.overflow > 0);
          const b = buttons.find(q => q.label === 'BUILD'), l = buttons.find(q => q.label === 'LEAVE');
          const big = q => !!q && (q.r ? q.r * 2 : Math.min(q.w, q.h)) >= (t ? 44 : 32) - 0.5;
          // BUILD opens the build panel, the way a tap does
          const pressedB = !!b && F.clickButton('BUILD'); F.sim(1, []);
          const opened = panel === 'house_build';
          closePanel(); render();
          // LEAVE takes him home to the step by the portal, the island packed away
          const pressedL = F.clickButton('LEAVE'); F.sim(1, []);
          const home = !HOUSE.inside && !(window.INSTANCES && INSTANCES.active()) && Math.floor(player.x / TILE) === HOUSE.STEP.x && Math.floor(player.y / TILE) === HOUSE.STEP.y;
          seen[where] = { went, plaques, onePlaque, ctx: ctx && ctx.id, block: blk && blk.id, buildBig: big(b), leaveBig: big(l), pressedB, opened, pressedL, home };
        }
        putBack();
        const ok = Object.values(seen).every(s => s.went && s.onePlaque && s.ctx === 'build' && s.block === 'island_leave' && s.buildBig && s.leaveBig && s.pressedB && s.opened && s.pressedL && s.home);
        check(P + 'on the island BUILD is the context seat and LEAVE the block seat, both on screen at 44 px or more on the iPad and the phone (and on the laptop\'s belt); BUILD opens the build panel and LEAVE takes him home to the portal step; the island shows its own plaque, not a "0 left" dungeon one',
          ok, seen); }

      // --- B. walls and doors are refused in the shared world, with a plain line; Q puts the bed down instead ---
      { out(); empty();
        const o = h.openSpot(ATLAS.world.tx(58), ATLAS.world.ty(30)); F.tp(o.x, o.y);   // the shared world's open Goblin Fields: a stretched-world point player.facing = { x: 1, y: 0 };
        const f = frontTile(player, 40), was = tileAt(f.tx, f.ty);
        drops = drops.filter(d => !circleHitsTile(d.x, d.y, 8, f.tx, f.ty));
        const said = {};
        for (const id of ['plank', 'door']) {
          empty(); h.give(id, 2); notice = null;
          placeAction(id);
          said[id] = { kept: countItem(id) === 2, ground: tileAt(f.tx, f.ty) === was, line: notice && notice.text };
          if (tileAt(f.tx, f.ty) !== was) changeTile(f.tx, f.ty, was);
        }
        // Q with planks first in the pack: refused with the line, and nothing else goes down in their place (a bed
        // put down in the world cannot be picked back up; a lodestone would move his home)
        const qWith = {};
        for (const other of ['bed', 'workbench', 'lodestone']) {
          empty(); h.give('plank', 3); h.give(other, 1); notice = null;
          const home0 = player.home ? { x: player.home.x, y: player.home.y } : null;
          F.press('KeyQ'); F.sim(1, []);
          const home1 = player.home ? { x: player.home.x, y: player.home.y } : null;
          qWith[other] = { ground: tileAt(f.tx, f.ty) === was, kept: countItem(other) === 1 && countItem('plank') === 3, line: notice && notice.text, home: JSON.stringify(home0) === JSON.stringify(home1) };
          if (tileAt(f.tx, f.ty) !== was) changeTile(f.tx, f.ty, was);
          if (home0) player.home = home0;
        }
        const bedKept = Object.values(qWith).every(q => q.ground && q.kept && q.line === NOT_HERE && q.home);
        // Q with only planks: refused with the line
        empty(); h.give('plank', 3); notice = null;
        F.press('KeyQ'); F.sim(1, []);
        const qRefused = tileAt(f.tx, f.ty) === was && countItem('plank') === 3 && !!notice && notice.text === NOT_HERE;
        if (tileAt(f.tx, f.ty) !== was) changeTile(f.tx, f.ty, was);
        // and a workbench still goes down in the world, as it always has
        empty(); h.give('workbench', 1); placeAction('workbench');
        const benchDown = tileAt(f.tx, f.ty) === T.WORKBENCH && countItem('workbench') === 0;
        if (tileAt(f.tx, f.ty) !== was) changeTile(f.tx, f.ty, was);
        const refused = ['plank', 'door'].every(id => said[id].kept && said[id].ground && said[id].line === NOT_HERE);
        check(P + 'in the shared world a plank or a door stays in the pack and the ground stays as it was, with "' + NOT_HERE + '"; Q there with planks and a bed, a workbench or the lodestone is refused with the same line, puts nothing down, keeps the pack and leaves home where it was; a workbench named still goes down',
          refused && bedKept && qRefused && benchDown, { said, qWith, qRefused, benchDown, ground: tileName(was) }); }

      // --- C. in a dungeon too: a dungeon is not his island ---
      { out(); empty();
        const went = !!(window.INSTANCES && INSTANCES.enter('spider_den'));
        let refused = false, info = {};
        if (went) {
          // any open cave floor with open floor north of it
          let spot = null;
          for (let y = 2; y < 29 && !spot; y++) for (let x = 2; x < 39 && !spot; x++) if (tileAt(x, y) === T.CAVE && tileAt(x, y - 1) === T.CAVE && !SOLID.has(tileAt(x, y))) spot = [x, y];
          if (spot) {
            for (const m of monsters) m.x = -9999;
            F.tp(spot[0], spot[1]); F.face(spot[0], spot[1] - 1);
            drops = drops.filter(d => !circleHitsTile(d.x, d.y, 8, spot[0], spot[1] - 1));
            h.give('plank', 1); notice = null; placeAction('plank');
            refused = tileAt(spot[0], spot[1] - 1) === T.CAVE && countItem('plank') === 1 && !!notice && notice.text === NOT_HERE;
            info = { spot, tile: tileName(tileAt(spot[0], spot[1] - 1)), line: notice && notice.text };
          }
        }
        out();
        check(P + 'a plank is refused in a dungeon too (the Spider Den): the cave floor stays bare', went && refused, { went, ...info }); }

      // --- D. on the island: walls and doors go on its grass, never out over the sky ---
      { const went = goIn(); empty();
        const [px, py] = standAt(HOUSE.ENTRY[0] - 4, HOUSE.ENTRY[1] - 4);
        h.give('plank', 2); h.give('door', 1);
        placeAction('plank');
        const plank = tileAt(px, py) === T.PLANK && countItem('plank') === 1;
        const [dx, dy] = standAt(HOUSE.ENTRY[0] + 4, HOUSE.ENTRY[1] - 4);
        placeAction('door');
        const door = tileAt(dx, dy) === T.DOOR && countItem('door') === 0;
        // the edge of the land: the westmost grass on the middle row, facing west into the sky
        const row = Math.floor(HOUSE.H / 2); let ex = -1;
        for (let x = 0; x < HOUSE.W && ex < 0; x++) if (HOUSE.base(HOUSE.hidx(x, row)) !== HOUSE.tiles.sky) ex = x;
        if (SOLID.has(tileAt(ex, row))) changeTile(ex, row, T.GRASS);
        F.tp(ex, row); F.face(ex - 1, row); player.action = null; notice = null;
        const sky0 = tileAt(ex - 1, row);
        placeAction('plank');
        const skyKept = sky0 === HOUSE.tiles.sky && tileAt(ex - 1, row) === HOUSE.tiles.sky && countItem('plank') === 1 && !!notice && notice.text === NOT_SKY;
        // Q with planks and a bed, faced out over the sky: the sky line, and the bed stays in the pack
        empty(); h.give('plank', 2); h.give('bed', 1); notice = null;
        F.press('KeyQ'); F.sim(1, []);
        const qSky = { tile: tileName(tileAt(ex - 1, row)), bed: countItem('bed'), planks: countItem('plank'), line: notice && notice.text };
        const skyQ = tileAt(ex - 1, row) === HOUSE.tiles.sky && qSky.bed === 1 && qSky.planks === 2 && qSky.line === NOT_SKY;
        const rule = !ISLAND.islandLand(ex - 1, row) && ISLAND.islandLand(ex, row) && !ISLAND.islandLand(HOUSE.W, row) && ISLAND.isWall('plank') && ISLAND.isWall('door') && !ISLAND.isWall('bed') && !ISLAND.isWall('lodestone') && !ISLAND.isWall('workbench') && !ISLAND.isWall('goblin_trap');
        out();
        check(P + 'on his island a plank and a door go up on the grass, and a plank faced out over the sky stays in the pack with "' + NOT_SKY + '" (Q with planks and a bed there too: nothing goes over the sky, the bed stays packed)',
          went && plank && door && skyKept && skyQ && rule, { went, plank, door, skyKept, skyQ, qSky, rule, edge: [ex, row], line: notice && notice.text }); }

      // --- E. arriving while the Voice talks and the "YOUR ISLAND" banner is up: BUILD waits for the talk to end, then
      //        opens the build panel with nothing drawn over it (no talk page, no banner, no arrival line) ---
      { setSize(768, 1024); window.__forceTouch = true;
        const went = goIn(); closePanel();
        if (!dialog.cur && !dialog.queue.length) say('Grass, sky, and nobody else.', 'The Voice');
        notify('Your island. Tap BUILD to put something up. USE on the arch to go home.');
        F.sim(1, []); render();
        const talking = !!dialog.cur, banner0 = !!areaBanner;
        const face = HK.face('ctx'), dim = !!face && face.id === 'build' && !!face.disabled;
        const tapped0 = F.clickButton('BUILD'); F.sim(1, []);
        const tapHeld = panel !== 'house_build';
        F.press('KeyP'); F.sim(1, []);
        const heldOff = tapHeld && panel !== 'house_build';
        // the talk ends: the tap made during it does not open the panel later on its own
        dialog.cur = null; dialog.queue.length = 0; F.sim(2, []); render();
        const noLate = panel !== 'house_build';
        const banner1 = !!areaBanner, line1 = !!notice;
        const tapped1 = F.clickButton('BUILD'); F.sim(1, []); render();
        const opened = panel === 'house_build', clear = !dialog.cur && !dialogRect && areaBanner === null && notice === null;
        closePanel(); out(); putBack();
        check(P + 'arriving while the Voice talks with the area banner up: BUILD is dimmed and neither its tap nor P opens the panel under the talk page (nor later on its own); after the talk BUILD opens the build panel with no talk page, no banner and no arrival line over it',
          went && talking && banner0 && dim && tapped0 && heldOff && noLate && banner1 && line1 && tapped1 && opened && clear, { went, talking, banner0, dim, tapped0, heldOff, noLate, banner1, line1, tapped1, opened, clear }); }

      // --- F. the island plaque on a landscape phone: "YOUR ISLAND" and the arch count never run together ---
      { const seen = {}; let shown = 0;
        for (const [w, hh] of [[844, 390], [667, 375], [932, 430], [768, 1024], [1280, 800]]) for (const right of [false, true]) {
          const t = w !== 1280, where = `${w}x${hh}${t ? ' touch' : ''} stick-${right ? 'right' : 'left'}`;
          setSize(w, hh); window.__forceTouch = t; window.__stickRight = right;
          goIn(); closePanel(); dialog.cur = null; dialog.queue.length = 0; areaBanner = null; notice = null;
          drawHud(HK.audit.fitCtx());
          const pt = (HK.FRAME.plaqueText || {}).island, folded = !pt && HK.FRAME.overflow > 0;
          const ok = folded || (!!pt && (pt.rightStart == null || pt.nameEnd <= pt.rightStart - 4) && pt.size >= 11 && pt.subFits && /of \d+ arches/.test((pt.right || '') + ' ' + (pt.sub || '')));
          if (pt) shown++;
          seen[where] = pt ? { ok, nameEnd: Math.round(pt.nameEnd), rightStart: pt.rightStart == null ? null : Math.round(pt.rightStart), right: pt.right, sub: pt.sub, size: pt.size } : { ok, folded };
          out();
        }
        putBack();
        check(P + 'the island plaque never runs "YOUR ISLAND" into its arch count: on a landscape phone (844x390, 667x375, 932x430) the count moves to the line under the name, the name stays 11 px or more and every word fits; the iPad and the laptop keep it on the right',
          shown >= 6 && seen['844x390 touch stick-left'].ok && /arches/.test(seen['844x390 touch stick-left'].sub || '') && /arches/.test(seen['768x1024 touch stick-left'].right || '') && /arches/.test(seen['1280x800 stick-left'].right || '') && Object.values(seen).every(q => q.ok), seen); }
    } finally {
      putBack(); out(); closePanel();
      player.inv = keep.bag; player.house = keep.house; player.x = keep.x; player.y = keep.y;
      h.peace(false);
    }
  });
}
