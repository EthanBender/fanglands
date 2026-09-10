// ============================================================================
// FEATURE: IMPACT — the ground flutters under a mega hit (Paper Mario tile flip)
// A heavy hit calls window.IMPACT.wave(x, y, strength) and a ring of ground tiles lifts, folds, tips and settles
// back, travelling outward from the point of impact over half a second. Strongest at the centre, fading to nothing
// at the rim. It is a real per-tile effect: every tile is redrawn from its own texture on a lifted, folded, tilted
// transform with a shadow pit under it. It is not a screen shake and it is not a flat overlay.
//
// How it draws without disturbing the tile cache: 09-render paints the flat tile layer straight out of the `tex`
// atlas and then calls HOOKS.draw. This file draws IN that hook (immediately, pushing no item), so the lifted
// copies land on top of the flat ground and underneath every prop, NPC and monster in the y-sorted list. Nothing
// here writes `map`, `variant`, `mapDiffs`, `miniDirty` or `miniDirtyTiles`: the tile data and the minimap cache
// are read-only to this feature, so a wave cannot dirty a cached pixel and the tile layer comes out identical.
//
// Cost when idle: one `waves.length === 0` test per update tick and one per frame. No allocation, no scanning.
//
// It obeys the Screen shake setting (43-settings): shake off means wave() makes nothing and a wave already in the
// air stops lifting. 43-settings keeps its row list private inside its closure, so this shares that one switch
// instead of editing another feature's file for a second row — and the owner's rule is exactly that: a player who
// turned shake off does not get this either.
//
// Wired to the heavy hits: bombs (06-systems explode), the Barrelbeast ram (32-beast), the bulldozer's ram-plate
// stomp (22-bulldozer), Full Steam (55-riding), The Gnasher's arm and its fall (33-goblincity), and The Fang
// waking, turning and falling (28-thefang).
// Debug/test handle: window.IMPACT.
// ============================================================================
{
  // ---------- the shape of a wave ----------
  const TRAVEL = 0.32;   // seconds for the ring front to reach the rim
  const FLUTTER = 0.18;  // seconds one tile spends lifting and settling
  const LIFE = TRAVEL + FLUTTER; // 0.50 s: the whole wave, from the hit to still ground
  const R_PER_S = 3, R_MIN = 1, R_MAX = 8;           // radius in tiles = round(3 × strength), held to 1..8
  const LIFT_PER_S = 6, LIFT_MIN = 4, LIFT_MAX = 18; // peak lift at the centre in pixels = 6 × strength, held to 4..18
  const TILT = 0.22;     // radians the tile tips at full lift (which way is fixed per tile, so the ring looks broken up)
  const FOLD = 0.9;      // radians of end-over-end fold: at full lift the tile stands to cos(FOLD) ≈ 0.62 of its height
  const GROW = 0.08;     // a lifted tile is 8% bigger — nearer the eye, and it covers the seam it left behind
  const OUT = 3;         // pixels the tile is shoved outward along the blast line
  const SHADOW = 0.5;    // alpha of the pit under a tile at full lift
  const MIN_LIFT = 1 / 64; // under a 64th of a pixel a tile is where it started: no lift, no pit, no drift in the tail
  const MAX_WAVES = 6;
  const SAME_TAG_GAP = 0.08; // one stomp landing on three goblins makes one wave, not three

  const radiusTiles = s => clamp(Math.round(R_PER_S * s), R_MIN, R_MAX);
  const liftPx = s => clamp(LIFT_PER_S * s, LIFT_MIN, LIFT_MAX);

  // What flutters: ground only. Never anything solid (walls, water, trees, rock, furniture) and never the
  // non-solid tiles 09-render paints a prop on top of — the ground must not slide out from under a rug or a crop.
  // Both sets are read live, so tiles added by feature files 20–57 are covered without a list here.
  const DECOR = new Set([T.DOOR, T.COFFINDOOR, T.GATE, T.PORTCULLIS, T.RUG, T.FLOWERS, T.MUSHROOM, T.ASHES, T.TRAP, T.CROP]);
  const canLift = t => !SOLID.has(t) && !DECOR.has(t);

  // the switch: 43-settings owns it. A build without SETTINGS counts as on.
  const shakeOn = () => { try { return typeof SETTINGS === 'undefined' || SETTINGS.get('shake') !== false; } catch (e) { return true; } };

  const waves = [];
  let last = null, drawn = 0;

  // Amplitude 0..1 for one tile under one wave: a half-sine over FLUTTER seconds, delayed by how far out the tile
  // sits, faded straight down to exactly 0 at the rim. Outside the ring, before the front arrives, or after the
  // tile has settled: exactly 0. sin(0) and sin(π·1) are the only ends, so a tile always comes back to where it was.
  function ampOf(w, tx, ty, now) {
    const age = now - w.t0;
    if (age <= 0 || age >= LIFE) return 0;
    const dx = tx + 0.5 - w.cx, dy = ty + 0.5 - w.cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= w.r) return 0;
    const local = (age - (d / w.r) * TRAVEL) / FLUTTER;
    if (local <= 0 || local >= 1) return 0;
    return Math.sin(Math.PI * local) * (1 - d / w.r);
  }

  // Two waves over one tile take the STRONGER lift, never the sum: overlapping blasts cannot double-lift the ground.
  function sample(tx, ty, now) {
    let lift = 0, amp = 0, win = null;
    for (const w of waves) {
      const a = ampOf(w, tx, ty, now);
      if (a <= 0) continue;
      const l = a * w.lift;
      if (l > lift) { lift = l; amp = a; win = w; }
    }
    return (win && lift >= MIN_LIFT) ? { lift, amp, w: win } : null;
  }

  // how far the ground under this tile is raised right now, in pixels (0 when the tile cannot flutter or shake is off)
  const liftAt = (tx, ty) => {
    if (!waves.length || !shakeOn()) return 0;
    if (!inMap(tx, ty) || !canLift(map[idx(tx, ty)])) return 0;
    const s = sample(tx, ty, time);
    return s ? s.lift : 0;
  };
  // the wave shape alone, whatever tile happens to be there — what the geometry claims, for the self-test
  const geomLift = (tx, ty) => { if (!waves.length || !shakeOn()) return 0; const s = sample(tx, ty, time); return s ? s.lift : 0; };

  const tipOf = (tx, ty) => ((((tx * 73856093) ^ (ty * 19349663)) >>> 0) & 1) ? 1 : -1;
  function prune() { for (let i = waves.length - 1; i >= 0; i--) if (time - waves[i].t0 >= LIFE) waves.splice(i, 1); }

  // ---------- the public call ----------
  function wave(x, y, strength, tag) {
    if (!shakeOn()) return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const s = clamp(+strength || 1, 0.2, 3);
    if (tag && last && last.tag === tag && time - last.t0 < SAME_TAG_GAP) return null;
    const w = { cx: x / TILE, cy: y / TILE, r: radiusTiles(s), lift: liftPx(s), t0: time, s, tag: tag || '' };
    if (waves.length >= MAX_WAVES) waves.shift();
    waves.push(w); last = w;
    return w;
  }
  const clearWaves = () => { waves.length = 0; last = null; drawn = 0; };

  // ---------- drawing: immediate, inside HOOKS.draw ----------
  // HOOKS.draw is called as (g, items, cam) with g already translated by -cam, and every item pushed into `items`
  // has its draw() called with no arguments. This handler pushes nothing: it paints the lifted tiles straight onto
  // g, which puts them above the flat ground 09-render just laid down and below everything in the sorted list.
  HOOKS.draw.push((g, items, cam) => {
    drawn = 0;
    if (!waves.length || !shakeOn()) return;
    if (typeof title !== 'undefined' && title && title.active) return; // no fluttering ground behind the title card
    prune();
    if (!waves.length) return;
    // One union box over every live wave, clipped to the visible tiles (+1 for a tile lifting in from off-screen):
    // each tile is visited once however many waves overlap it, and the worst case is bounded by the screen.
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const w of waves) {
      bx0 = Math.min(bx0, Math.floor(w.cx - w.r)); bx1 = Math.max(bx1, Math.ceil(w.cx + w.r));
      by0 = Math.min(by0, Math.floor(w.cy - w.r)); by1 = Math.max(by1, Math.ceil(w.cy + w.r));
    }
    const x0 = Math.max(0, bx0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, bx1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, by0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, by1, Math.ceil((cam.y + VH) / TILE) + 1);
    if (x1 < x0 || y1 < y0) return;
    const now = time;
    g.save();
    g.fillStyle = '#05070b'; // the pit colour never changes: set it once for the whole ring
    // top row first: a tile further down the screen is nearer the eye, so it paints over the one above it
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const s = sample(tx, ty, now);
      if (!s) continue;
      const i = idx(tx, ty), t = map[i];
      if (!canLift(t)) continue;
      const img = tex[TEX_NAME[t] + variant[i]];
      if (!img) continue; // no texture for this tile: the flat pass drew its fallback, leave it lying flat
      const a = s.amp, w = s.w;
      // the pit it came out of, so the flat copy underneath never shows through the gap it left
      g.globalAlpha = SHADOW * a;
      g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      g.globalAlpha = 1;
      const ox = tx + 0.5 - w.cx, oy = ty + 0.5 - w.cy, od = Math.hypot(ox, oy) || 1;
      const gr = 1 + GROW * a;
      g.save();
      g.translate(tx * TILE + TILE / 2 + ox / od * OUT * a, ty * TILE + TILE / 2 - s.lift + oy / od * OUT * a);
      g.rotate(TILT * a * tipOf(tx, ty));
      g.scale(gr, gr * Math.cos(FOLD * a));
      g.drawImage(img, -TILE / 2, -TILE / 2, TILE, TILE);
      g.restore();
      drawn++;
    }
    g.restore();
  });

  // ============================================================================
  // WIRING: the heavy hits
  // ============================================================================

  // ---------- bombs: every bomb in the game lands in explode() — the knight's, the Barrelbeast's chute, goblin
  // throwers and The Gnasher's sticky bombs ----------
  { const _explode = explode; explode = function (x, y, radius) { wave(x, y, 1.2, 'bomb'); return _explode.apply(this, arguments); }; }

  // ---------- the bulldozer's ram plate: the same guard 22-bulldozer uses for the plate itself, so the ground
  // only jumps on the stomp the plate actually doubles ----------
  const onHit = (m, dmg, source) => {
    if (source !== 'player' || dmg <= 0 || m.dead || !player.mech || player.mech.kind !== 'dozer') return;
    if (!(player.dozerUp || {}).ram || player.attackT !== 0.22) return;
    if (dist(player.x, player.y, m.x, m.y) > 70 + 46 + m.r + 8) return;
    wave(m.x, m.y, 1.5, 'dozer-ram');
  };
  HOOKS.hit.push(onHit);

  // ---------- The Gnasher's piston arm: 33-goblincity swings it with hurtPlayer(dmg, m.x, m.y) from the machine's
  // own centre, so a hit that starts at a live Gnasher's exact position is that arm coming down ----------
  const onHurt = (dmg, fx, fy) => {
    if (!Number.isFinite(fx) || !Number.isFinite(fy)) return;
    for (const m of monsters) {
      if (m.type !== 'gnasher' || m.dead) continue;
      if (Math.abs(m.x - fx) < 1 && Math.abs(m.y - fy) < 1) { wave(player.x, player.y, 1.4, 'gnasher-arm'); return; }
    }
  };
  HOOKS.hurt.push(onHurt);

  // ---------- the big machines going down ----------
  const onKill = m => {
    if (m.type === 'gnasher') wave(m.x, m.y, 2.2, 'gnasher-fall');
    else if (m.type === 'barrelbeast') wave(m.x, m.y, 2, 'beast-fall');
  };
  HOOKS.kill.push(onKill);

  // ---------- polled hits: the Barrelbeast ram, Full Steam and The Fang ----------
  // Every poll sits behind a cheap gate (driving a beast, a steam run in the air, The Fang summoned and not yet
  // slain), so an ordinary tick reads three properties and stops.
  let ramsWas = -1, steamWas = null, fangRef = null, fangAlive = false, fangEl = null;

  const onUpdate = () => {
    if (waves.length) prune();

    // the Barrelbeast ram: window.BEAST counts a ram only when the spikes actually shove something
    if (player.mech && player.mech.kind === 'beast' && window.BEAST) {
      const n = window.BEAST.stats.rams;
      if (ramsWas >= 0 && n > ramsWas) { const f = player.facing || { x: 1, y: 0 }; wave(player.x + f.x * 44, player.y + f.y * 44, 1.3, 'beast-ram'); }
      ramsWas = n;
    } else ramsWas = -1;

    // Full Steam: the boiler letting go, then the slam at the end of the run
    if (window.RIDING) {
      const sp = window.RIDING.special, phase = sp ? sp.phase : null;
      if (phase === 'run' && steamWas === 'wind') wave(player.x, player.y, 1, 'steam-run');
      else if (!phase && steamWas === 'run') wave(player.x, player.y, 2, 'steam-slam');
      steamWas = phase;
    }

    // The Fang: it rises out of the lava, it turns to a new element, it falls
    const fq = quest.fang;
    if (fq && fq.summoned && !fq.slain) {
      if (!fangRef) fangRef = monsters.find(x => x.type === 'the_fang') || null;
      const m = fangRef;
      if (m) {
        const alive = !m.dead;
        if (alive && !fangAlive) wave(m.x, m.y, 2.6, 'fang-wake');
        else if (!alive && fangAlive) wave(m.x, m.y, 3, 'fang-fall');
        else if (alive && m.element && m.element !== fangEl) wave(m.x, m.y, 1.8, 'fang-element');
        fangAlive = alive; fangEl = alive ? (m.element || null) : null;
      }
    } else { fangRef = null; fangAlive = false; fangEl = null; }
  };
  HOOKS.update.push(onUpdate);

  // an instance swaps the whole map out from under us: a wave raised in the overworld must not flutter dungeon floor
  let instWas = null;
  HOOKS.update.push(() => { const i = window.__instance || null; if (i !== instWas) { instWas = i; clearWaves(); } });

  HOOKS.newGame.push(() => { clearWaves(); ramsWas = -1; steamWas = null; fangRef = null; fangAlive = false; fangEl = null; instWas = window.__instance || null; });

  // ---------- handle ----------
  window.IMPACT = {
    wave, clear: clearWaves,
    TRAVEL, FLUTTER, LIFE, TILT, FOLD, GROW, OUT, R_MAX, LIFT_MAX, MIN_LIFT,
    radiusTiles, liftPx, canLift,
    on: shakeOn,
    count: () => waves.length,
    liftAt, geomLift,
    get drawn() { return drawn; },   // tiles redrawn on the last frame
    get last() { return last; },
    get waves() { return waves; },
    onHit, onHurt, onKill, onUpdate,
  };

  // ============================================================================
  // SELF-TEST
  // ============================================================================
  const P = 'impact: ';
  HOOKS.selfTest.push((check, F, h) => {
    const shake0 = typeof SETTINGS !== 'undefined' ? SETTINGS.get('shake') : true;
    const peace0 = !!window.__peace;
    const home0 = { x: player.x, y: player.y };
    const mech0 = player.mech, up0 = player.dozerUp, r0 = player.r, sp0 = player.speed, comp0 = player.companion;
    h.peace(true); closePanel();
    if (typeof SETTINGS !== 'undefined') SETTINGS.set('shake', true);
    const o = h.openSpot(58, 36); F.tp(o.x, o.y);
    const box = (cx, cy, r, fn) => { for (let ty = cy - r - 1; ty <= cy + r + 1; ty++) for (let tx = cx - r - 1; tx <= cx + r + 1; tx++) fn(tx, ty); };
    const withTime = fn => { const t = time; try { return fn(); } finally { time = t; } };
    const setShake = v => { if (typeof SETTINGS !== 'undefined') SETTINGS.set('shake', v); };

    try {
      // ---------- A. the ring lifts, fades outward, and every tile settles back to exactly nothing ----------
      { clearWaves(); const cx = o.x, cy = o.y;
        const w = wave(tc(cx), tc(cy), 3, 'test');
        const madeIt = !!w && w.r === 8 && w.lift === 18 && waves.length === 1;
        // one tile settles to exactly 0 while the wave is still travelling: FLUTTER after the front reaches it
        const settle = withTime(() => { const t = w.t0; time = t + FLUTTER - 1 / 240; const before = geomLift(cx, cy); time = t + FLUTTER; const after = geomLift(cx, cy); time = t + FLUTTER + 0.05; return { before, after, later: geomLift(cx, cy) }; });
        // now walk the whole wave a frame at a time and keep the highest lift every tile reaches
        const peak = new Map(), key = (x, y) => x + ',' + y;
        let ticks = 0;
        while (waves.length && ticks < 200) { box(cx, cy, 9, (tx, ty) => { const l = geomLift(tx, ty); const k = key(tx, ty); if (l > (peak.get(k) || 0)) peak.set(k, l); }); F.step([]); ticks++; }
        const at = (dx, dy) => +(peak.get(key(cx + dx, cy + dy)) || 0);
        const centre = at(0, 0), near = at(2, 0), mid = at(4, 0), far = at(6, 0), rim = at(8, 0), out = at(9, 0);
        // peak lift falls off straight: 18 × (1 − d/8) → 18.0 / 13.5 / 9.0 / 4.5 / 0 / 0
        const shape = Math.abs(centre - 18) < 0.4 && Math.abs(near - 13.5) < 0.4 && Math.abs(mid - 9) < 0.4 && Math.abs(far - 4.5) < 0.4 && rim === 0 && out === 0;
        const fades = centre > near && near > mid && mid > far && far > 0;
        const settled = settle.before > 0 && settle.after === 0 && settle.later === 0;
        check(P + 'a wave lifts the ground in a ring — 18 px at the centre, fading straight down to 0 at the 8-tile rim — and each tile settles back to exactly 0 as the ring passes on',
          madeIt && shape && fades && settled && waves.length === 0 && ticks >= 30 && ticks <= 32,
          { madeIt, centre: +centre.toFixed(2), near: +near.toFixed(2), mid: +mid.toFixed(2), far: +far.toFixed(2), rim, out, settle: { before: +settle.before.toFixed(3), after: settle.after, later: settle.later }, ticks }); }

      // ---------- B. the radius and the duration are the numbers claimed ----------
      { clearWaves(); const cx = o.x, cy = o.y;
        const radii = [0.3, 1, 1.5, 2, 3].map(s => radiusTiles(s)).join(',');        // 1,3,5,6,8
        const lifts = [0.3, 1, 1.5, 2, 3].map(s => +liftPx(s).toFixed(2)).join(',');  // 4,6,9,12,18
        const r = withTime(() => {
          const w1 = wave(tc(cx), tc(cy), 1, 'test'); // radius 3 tiles
          let outside = 0, inside = 0;
          for (let k = 0; k <= 64; k++) { time = w1.t0 + k / 120; box(cx, cy, 5, (tx, ty) => { const d = Math.hypot(tx - cx, ty - cy); const l = geomLift(tx, ty); if (d >= 3) outside = Math.max(outside, l); else inside = Math.max(inside, l); }); }
          clearWaves();
          const w2 = wave(tc(cx), tc(cy), 3, 'test');
          let lastMoving = 0;
          for (let k = 0; k <= 80; k++) { time = w2.t0 + k / 120; let m = 0; box(cx, cy, 9, (tx, ty) => { m = Math.max(m, geomLift(tx, ty)); }); if (m > 0) lastMoving = k / 120; }
          time = w2.t0 + LIFE; let atEnd = 0; box(cx, cy, 9, (tx, ty) => { atEnd = Math.max(atEnd, geomLift(tx, ty)); });
          const aliveJustBefore = (time = w2.t0 + LIFE - 1 / 240, onUpdate(), waves.length);
          const droppedAtLife = (time = w2.t0 + LIFE, onUpdate(), waves.length);
          return { outside, inside, lastMoving, atEnd, aliveJustBefore, droppedAtLife };
        });
        clearWaves();
        check(P + 'radius is round(3 × strength) tiles capped at 8 and peak lift is 6 × strength px capped at 18; a tile at or past the rim never moves, and the whole wave is over in 0.50 s',
          radii === '1,3,5,6,8' && lifts === '4,6,9,12,18' && LIFE === 0.5 && r.outside === 0 && r.inside > 0 && r.lastMoving > 0.48 && r.lastMoving < 0.5 && r.atEnd === 0 && r.aliveJustBefore === 1 && r.droppedAtLife === 0,
          { radii, lifts, LIFE, outside: r.outside, inside: +r.inside.toFixed(2), lastMoving: +r.lastMoving.toFixed(4), atEnd: r.atEnd, aliveJustBefore: r.aliveJustBefore, droppedAtLife: r.droppedAtLife }); }

      // ---------- C. Screen shake off means none of this happens ----------
      { clearWaves();
        setShake(false);
        const refused = wave(tc(o.x), tc(o.y), 3, 'test') === null && waves.length === 0 && !IMPACT.on();
        setShake(true);
        clearWaves(); wave(tc(o.x), tc(o.y), 3, 'test'); F.sim(6, []);
        const wasLifting = geomLift(o.x, o.y) > 0 && liftAt(o.x, o.y) > 0;
        setShake(false);
        render();
        const stopped = geomLift(o.x, o.y) === 0 && liftAt(o.x, o.y) === 0 && IMPACT.drawn === 0;
        setShake(true);
        clearWaves();
        check(P + 'with Screen shake turned off a heavy hit raises no wave at all, and a wave already in the air stops lifting the moment the switch goes off',
          refused && wasLifting && stopped, { refused, wasLifting, stopped, hasSettings: typeof SETTINGS !== 'undefined' }); }

      // ---------- D. two waves over one tile take the stronger lift, never the sum ----------
      { clearWaves(); const cx = o.x, cy = o.y, px = cx + 2, py = cy;
        wave(tc(cx), tc(cy), 3, 'a'); F.sim(8, []);
        const alone = geomLift(px, py);
        const age = time - waves[0].t0;
        clearWaves();
        const w1 = wave(tc(cx), tc(cy), 3, 'a'); w1.t0 = time - age;        // the same wave at the same age
        const w2 = wave(tc(cx + 5), tc(cy), 3, 'b'); w2.t0 = time - age;    // a second blast five tiles east, overlapping
        const both = geomLift(px, py);
        const solo2 = (() => { const first = waves.splice(0, 1)[0]; const v = geomLift(px, py); waves.unshift(first); return v; })();
        const two = waves.length === 2;
        const noDouble = Math.abs(both - Math.max(alone, solo2)) < 1e-9 && both < alone + solo2 - 1e-9;
        clearWaves();
        const t3 = time; const a1 = wave(tc(cx), tc(cy), 3, 'a'), a2 = wave(tc(cx), tc(cy), 3, 'b'); a1.t0 = a2.t0 = t3 - age;
        const twins = waves.length === 2 && Math.abs(geomLift(px, py) - alone) < 1e-9;
        clearWaves();
        check(P + 'two overlapping waves take the stronger lift on a tile they share, never the sum — and two waves fired at the same spot lift it exactly as much as one',
          two && alone > 0 && solo2 > 0 && noDouble && twins,
          { alone: +alone.toFixed(3), solo2: +solo2.toFixed(3), both: +both.toFixed(3), sum: +(alone + solo2).toFixed(3), twins }); }

      // ---------- E. the tile layer, the map diffs and the minimap cache come out identical ----------
      // driven by the clock alone (render() runs no game logic), so anything that changed could only be this feature
      { clearWaves();
        const sum = arr => { let a = 1, b = 0; for (let i = 0; i < arr.length; i++) { a = (a + arr[i]) % 65521; b = (b + a) % 65521; } return (b * 65536 + a); };
        render(); // flush the minimap cache first
        const m0 = sum(map), v0 = sum(variant), d0 = mapDiffs.size, md0 = miniDirty, mt0 = miniDirtyTiles.size;
        // count minimap repaints too: drawMinimap flushes the dirty flags every frame, so a draw pass that dirtied
        // the cache would look clean afterwards — the repaint count is what catches it
        const _refreshMini = refreshMini; let repaints = 0;
        refreshMini = function () { repaints++; return _refreshMini.apply(this, arguments); };
        const res = withTime(() => {
          const w = wave(player.x, player.y, 3, 'test'); const t = w.t0;
          let sawDrawn = 0, frames = 0, dirtied = false;
          for (let k = 0; k <= 31 && waves.length; k++) { time = t + k / 60; render(); sawDrawn = Math.max(sawDrawn, drawn); frames++; if (miniDirty || miniDirtyTiles.size) dirtied = true; }
          time = t + LIFE; render();
          return { sawDrawn, frames, dirtied, left: waves.length, drawnAtEnd: drawn };
        });
        refreshMini = _refreshMini;
        const same = sum(map) === m0 && sum(variant) === v0 && mapDiffs.size === d0 && miniDirty === md0 && miniDirtyTiles.size === mt0;
        clearWaves();
        check(P + 'a whole wave redraws real tiles and leaves the tile layer, the map diffs and the minimap cache exactly as it found them',
          same && !res.dirtied && repaints === 0 && res.sawDrawn > 0 && res.left === 0 && res.drawnAtEnd === 0,
          { same, dirtied: res.dirtied, minimapRepaints: repaints, tilesDrawn: res.sawDrawn, frames: res.frames, left: res.left, diffs: mapDiffs.size, d0 }); }

      // ---------- F. only ground flutters, and what a full-strength wave costs a frame ----------
      { clearWaves(); const cx = o.x, cy = o.y;
        const ground = canLift(T.GRASS) && canLift(T.DIRT) && canLift(T.CAVE) && canLift(T.COBBLE) && canLift(T.FLOOR) && canLift(T.SAND) && canLift(T.SOIL);
        const notSolid = !canLift(T.WALL) && !canLift(T.WATER) && !canLift(T.TREE) && !canLift(T.ROCK) && !canLift(T.ANVIL) && !canLift(T.HWALL);
        const notDecor = !canLift(T.CROP) && !canLift(T.RUG) && !canLift(T.FLOWERS) && !canLift(T.DOOR) && !canLift(T.TRAP);
        const res = withTime(() => {
          // a solid tile inside the ring stays put even though the wave shape covers it
          const rx = cx + 2, ry = cy + 1, was = map[idx(rx, ry)];
          const w = wave(tc(cx), tc(cy), 3, 'test');
          time = w.t0 + 0.10;                      // the front is over that tile now
          const groundMoves = liftAt(rx, ry) > 0;  // as grass it lifts
          map[idx(rx, ry)] = T.ROCK;
          const rockStill = liftAt(rx, ry) === 0 && geomLift(rx, ry) > 0;
          map[idx(rx, ry)] = was;
          time = w.t0 + 0.32;                      // the widest moment of a full-strength wave
          let moving = 0; box(cx, cy, 9, (tx, ty) => { if (geomLift(tx, ty) > 0) moving++; });
          // frame cost: hold the wave at its widest and time render() with it and without it
          const N = 150;
          for (let i = 0; i < 20; i++) render();
          const ta = nowMs(); for (let i = 0; i < N; i++) render(); const withWave = nowMs() - ta;
          const tiles = drawn;
          clearWaves();
          for (let i = 0; i < 20; i++) render();
          const tb = nowMs(); for (let i = 0; i < N; i++) render(); const without = nowMs() - tb;
          return { rockStill, groundMoves, moving, tiles, costMs: +((withWave - without) / N).toFixed(4), withWave, without, N };
        });
        clearWaves();
        check(P + 'only ground flutters — never a wall, water, a rock or a rug — and the widest full-strength wave moves 156 tiles for a fraction of a millisecond a frame',
          ground && notSolid && notDecor && res.groundMoves && res.rockStill && res.moving === 156 && res.tiles > 0 && res.costMs < 8,
          { costMs: res.costMs, tilesDrawn: res.tiles, tilesMoving: res.moving, ground, notSolid, notDecor, groundMoves: res.groundMoves, rockStill: res.rockStill, msWith: res.withWave, msWithout: res.without, frames: res.N, note: 'the headless canvas is a stub: this is the wave arithmetic and its canvas calls, not rasterising' }); }

      // ---------- G. once the ground is still again it costs nothing ----------
      { clearWaves();
        wave(tc(o.x), tc(o.y), 3, 'test'); F.sim(6, []); render();
        const busy = drawn > 0;                       // mid-wave: tiles are being redrawn
        F.sim(30, []);                                // let it age out on its own, no clearing
        const gone = waves.length === 0;
        render(); const idleDrawn = drawn;
        onUpdate(); const idleWaves = waves.length;
        clearWaves();
        check(P + 'once the wave has passed the effect draws nothing, holds no wave and lifts nothing',
          busy && gone && idleDrawn === 0 && idleWaves === 0 && liftAt(o.x, o.y) === 0, { busy, gone, idleDrawn, idleWaves }); }

      // ---------- H. wiring: a bomb ----------
      { clearWaves(); player.mech = null;
        const bx = player.x + 200, by = player.y;
        const near = monsters.filter(m => !m.dead && dist(m.x, m.y, bx, by) < 140).map(m => ({ m, x: m.x, y: m.y, hp: m.hp, angry: m.angry, state: m.state, hurtT: m.hurtT }));
        explode(bx, by, 64, 0, 0, 'player');
        for (const s of near) Object.assign(s.m, { x: s.x, y: s.y, hp: s.hp, angry: s.angry, state: s.state, hurtT: s.hurtT });
        const bomb = waves.length === 1 && last.tag === 'bomb' && last.r === radiusTiles(1.2) && Math.abs(last.cx - bx / TILE) < 1e-9;
        clearWaves();
        check(P + 'a bomb going off lifts the ground around where it lands', bomb, { tag: last && last.tag, r: last && last.r, restored: near.length }); }

      // ---------- I. wiring: the bulldozer's ram-plate stomp ----------
      { clearWaves();
        const target = { type: 'goblin', dead: false, hp: 400, maxHp: 400, x: player.x + 60, y: player.y, r: 12, stunT: 0, state: 'idle', angry: false, hurtT: 0, home: { x: player.x + 60, y: player.y } };
        monsters.push(target);
        player.mech = { kind: 'dozer', hp: 110, maxHp: 110 }; player.dozerUp = {}; player.attackT = 0.22;
        onHit(target, 6, 'player'); const noPlate = waves.length === 0;               // no ram plate fitted: no wave
        player.dozerUp = { ram: true };
        player.attackT = 0.1; onHit(target, 6, 'player'); const notStomp = waves.length === 0; // mid-swing, not the stomp tick
        player.attackT = 0.22; onHit(target, 6, 'player');
        const plate = waves.length === 1 && last.tag === 'dozer-ram' && last.r === radiusTiles(1.5);
        const wired = HOOKS.hit.includes(onHit);
        monsters.splice(monsters.indexOf(target), 1); player.mech = null; player.dozerUp = up0; player.attackT = 0; clearWaves();
        check(P + "the bulldozer's ram-plate stomp shakes the ground, and only when the plate is fitted and the stomp itself lands",
          noPlate && notStomp && plate && wired, { noPlate, notStomp, plate, wired }); }

      // ---------- J. wiring: The Gnasher's arm and its fall ----------
      { clearWaves();
        const gn = { type: 'gnasher', dead: false, hp: 320, maxHp: 320, x: player.x + 70, y: player.y - 10, r: 30, stunT: 0, state: 'chase', angry: true, hurtT: 0, facing: { x: -1, y: 0 }, home: { x: player.x + 70, y: player.y - 10 } };
        monsters.push(gn);
        onHurt(9, gn.x + 40, gn.y + 40); const elsewhere = waves.length === 0; // an ordinary goblin hit is not that arm
        onHurt(9, gn.x, gn.y);
        const arm = waves.length === 1 && last.tag === 'gnasher-arm' && last.r === radiusTiles(1.4);
        clearWaves(); onKill(gn);
        const fall = waves.length === 1 && last.tag === 'gnasher-fall' && last.r === radiusTiles(2.2) && radiusTiles(2.2) > radiusTiles(1.4);
        const wired = HOOKS.hurt.includes(onHurt) && HOOKS.kill.includes(onKill);
        monsters.splice(monsters.indexOf(gn), 1); clearWaves();
        check(P + "The Gnasher's piston arm coming down shakes the ground, and the machine falling shakes it harder",
          elsewhere && arm && fall && wired, { elsewhere, arm, fall, wired }); }

      // ---------- K. wiring: The Fang wakes, turns, falls ----------
      { clearWaves();
        const m = monsters.find(x => x.type === 'the_fang');
        if (!m) check(P + 'The Fang waking out of the lava, turning to a new element and falling each shake the ground, hardest when it falls', false, { fang: false });
        else {
          const fq0 = quest.fang ? { ...quest.fang } : null;
          const snap = { dead: m.dead, deadT: m.deadT, hp: m.hp, element: m.element, respawnT: m.respawnT };
          quest.fang = Object.assign({}, quest.fang, { summoned: true, slain: false });
          fangRef = null; fangAlive = false; fangEl = null;
          m.dead = true; onUpdate(); const asleep = waves.length === 0;
          m.dead = false; m.hp = m.maxHp; m.element = 'fire'; onUpdate();
          const woke = waves.length === 1 && last.tag === 'fang-wake' && last.r === 8;
          clearWaves(); onUpdate(); const quiet = waves.length === 0;      // nothing changed, so nothing happens
          m.element = 'ice'; onUpdate();
          const turned = waves.length === 1 && last.tag === 'fang-element' && last.r === radiusTiles(1.8);
          clearWaves(); m.dead = true; onUpdate();
          const fell = waves.length === 1 && last.tag === 'fang-fall' && last.r === 8 && last.lift === 18;
          Object.assign(m, snap); if (fq0) quest.fang = fq0; else delete quest.fang;
          fangRef = null; fangAlive = false; fangEl = null; clearWaves();
          check(P + 'The Fang waking out of the lava, turning to a new element and falling each shake the ground, hardest when it falls',
            asleep && woke && quiet && turned && fell, { asleep, woke, quiet, turned, fell }); } }

      // ---------- L. wiring: Full Steam and the Barrelbeast ram ----------
      { clearWaves();
        let steamOk = false, steamInfo = { hasRiding: !!window.RIDING };
        if (window.RIDING) {
          player.companion = null;
          window.RIDING.resetCool();
          player.mech = { kind: 'dozer', hp: 110, maxHp: 110 }; player.r = 20; player.speed = 130; player.dozerUp = {}; player.facing = { x: 1, y: 0 };
          steamWas = null;
          window.RIDING.startSteam();
          let run = null, slam = null;
          for (let i = 0; i < 400 && !slam; i++) {
            for (const u of HOOKS.update) u(0.016);
            if (last && last.tag === 'steam-run' && !run) run = last;
            if (last && last.tag === 'steam-slam' && !slam) slam = last;
          }
          steamOk = !!run && run.r === radiusTiles(1) && !!slam && slam.r === radiusTiles(2);
          steamInfo = { hasRiding: true, runR: run && run.r, slamR: slam && slam.r };
          window.RIDING.resetCool();
        }
        player.mech = null; player.dozerUp = up0; player.r = r0; player.speed = sp0; player.companion = comp0; clearWaves();
        let ramOk = false, ramInfo = { hasBeast: !!window.BEAST };
        if (window.BEAST) {
          const t2 = h.openSpot(58, 36); F.tp(t2.x, t2.y);
          const target = { type: 'goblin', dead: false, hp: 900, maxHp: 900, x: player.x + 44, y: player.y, r: 12, stunT: 0, state: 'idle', angry: false, hurtT: 0, home: { x: player.x + 44, y: player.y } };
          monsters.push(target);
          player.mech = { hp: 300, maxHp: 300, kind: 'beast' }; player.r = 26; player.speed = 100; player.facing = { x: 1, y: 0 }; player.attackCd = 0; player.attackT = 0;
          ramsWas = -1; onUpdate();
          const n0 = window.BEAST.stats.rams;
          F.press('Space'); for (let i = 0; i < 12; i++) F.step([]);
          const rammed = window.BEAST.stats.rams > n0;
          ramOk = rammed && !!last && last.tag === 'beast-ram' && last.r === radiusTiles(1.3);
          ramInfo = { hasBeast: true, rammed, tag: last && last.tag, r: last && last.r };
          monsters.splice(monsters.indexOf(target), 1);
        }
        player.mech = mech0; player.dozerUp = up0; player.r = r0; player.speed = sp0; player.attackT = 0; ramsWas = -1; steamWas = null; clearWaves();
        check(P + 'Full Steam shakes the ground when the boiler lets go and again when the machine slams to a stop, and a Barrelbeast ram shakes it too',
          steamOk && ramOk, { ...steamInfo, ...ramInfo }); }
    } finally {
      clearWaves();
      player.mech = mech0; player.dozerUp = up0; player.r = r0; player.speed = sp0; player.companion = comp0; player.attackT = 0;
      player.x = home0.x; player.y = home0.y;
      ramsWas = -1; steamWas = null; fangRef = null; fangAlive = false; fangEl = null;
      setShake(shake0);
      h.peace(peace0);
    }
  });
}
