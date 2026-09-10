// ============================================================================
// THE COAL ROAD — carts out of Deepholm, and a mini-game at the end of the line
// Owner's ask: "Deepholm should have coal carts to take you to a coal mine instance where you can play a
// mini game to get lots of coal."
// King Thrain already says the dwarves' great forge went cold "when the goblins cut the coal road"
// (24-dwarves). This is that road, reopened: a cart on rails at the east end of the undercity runs you down
// to the seam, and the seam is a timed rush — glowing faces of coal that move as you break them, props that
// have to be knocked back in before the roof comes down, and a cart that hauls out whatever you filled it with.
// Feature file: registers through HOOKS only, edits no core file. window.COALMINE exposes the tables.
// ============================================================================
{
  // ---------- tiles ----------
  const T_CART = addTile('COAL_CART', { solid: true, tex: 'cave', mini: '#8a5a2a' });   // the cart in Deepholm: E rides it down
  const T_RAIL = addTile('COAL_RAIL', { tex: 'cave', mini: '#4a4a52' });                // sleepers, walked over
  const T_SEAM = addTile('COAL_SEAM', { solid: true, tex: 'cave', mini: '#2b2b33' });   // a live face of coal, mined on a timer
  const T_PROP = addTile('PIT_PROP', { solid: true, tex: 'cave', mini: '#7a5a32' });    // a roof prop: hit it to reset the roof
  const T_HAUL = addTile('HAUL_CART', { solid: true, tex: 'cave', mini: '#a5763f' });   // the cart at the seam: what you fill, and the way out
  const T_PILLAR = addTile('MINE_PILLAR', { solid: true, tex: 'cave', mini: '#55585f' }); // a worked pillar of rock left standing — drawn as a column, never as wall
  const T_SPOIL = addTile('MINE_SPOIL', { tex: 'cave', mini: '#3a3a42' });                // spilled coal and spoil underfoot, walked over
  const T_TIMBER = addTile('MINE_TIMBER', { tex: 'cave', mini: '#5a4530' });              // old sleepers and offcuts stacked against the wall

  for (const t of [T_CART, T_SEAM, T_PROP, T_HAUL]) INTERESTING_TILES.add(t); // so a tap on the iPad reaches them

  // ---------- the run ----------
  const RUN_SECONDS = 75;        // how long a shift at the face lasts
  const SEAM_LIVE = 4;           // faces glowing at once
  const SWING = 1.1;             // seconds per swing at a face
  const ROOF_FUSE = 22;          // seconds before the roof starts to give
  const ROOF_WARN = 6;           // warning before the first fall
  const PROP_RESET = 18;         // seconds a prop buys back
  const MINE = { id: 'coalmine', w: 30, h: 22 };
  const ENTRY = [3, 18], EXIT = [2, 18], HAUL = [2, 16]; // the haul cart sits beside the way out, never on it — the instance owns the exit tile
  const CART_T = { x: 24, y: 80 };   // filled in at world-gen: the east-most spot in Deepholm with open floor south of it and a run of floor west

  const st = () => { if (!quest.coalmine) quest.coalmine = { runs: 0, best: 0, lastHaul: 0, told: false }; return quest.coalmine; };
  HOOKS.newGame.push(() => { quest.coalmine = { runs: 0, best: 0, lastHaul: 0, told: false }; });

  // live state for one shift, rebuilt on every entry
  let run = null;
  const running = () => !!run && window.INSTANCES && INSTANCES.active() === MINE.id;

  // ---------- the seam map ----------
  // A wide gallery: rock walls, a floor of rail and stone, the haul cart by the way out, four props down the
  // middle. Faces of coal are opened by the run itself, not by the builder, so every shift is laid out fresh.
  const FACE_SPOTS = [];
  const PILLARS = [], LITTER = [];
  // A worked-out gallery, not a grid: the seam is followed in wandering runs from the rail head, the runs open
  // into irregular chambers where the coal was richest, and pillars of rock are left standing where the roof
  // needed holding. Torches go up where the miners actually worked, so the light comes from somewhere.
  function buildMine(setTile, rnd) {
    FACE_SPOTS.length = 0; PILLARS.length = 0; LITTER.length = 0;
    // build() writes through setTile into the instance grid, which is NOT the live map yet — tileAt would read
    // the overworld. So the builder keeps its own copy and reads that.
    const grid = new Array(MINE.w * MINE.h).fill(T.WALL);
    const at = (x, y) => (x < 0 || y < 0 || x >= MINE.w || y >= MINE.h) ? T.WALL : grid[y * MINE.w + x];
    const put = (x, y, t) => { if (x < 0 || y < 0 || x >= MINE.w || y >= MINE.h) return; grid[y * MINE.w + x] = t; setTile(x, y, t); };
    for (let y = 0; y < MINE.h; y++) for (let x = 0; x < MINE.w; x++) put(x, y, T.WALL);
    const open = [];
    const carve = (cx, cy, r) => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 1 || y < 1 || x >= MINE.w - 1 || y >= MINE.h - 1) continue;
        if (dx * dx + dy * dy > r * r + r) continue;                 // a rounded bite, not a square
        if (at(x, y) !== T.CAVE) { put(x, y, T.CAVE); open.push([x, y]); }
      }
    };
    carve(ENTRY[0] + 1, ENTRY[1], 2);
    const runs = [{ x: ENTRY[0] + 2, y: ENTRY[1], dx: 1, dy: 0 }, { x: ENTRY[0] + 2, y: ENTRY[1], dx: 1, dy: -1 }, { x: ENTRY[0] + 2, y: ENTRY[1], dx: 1, dy: -0.4 }];
    for (const run of runs) {
      let x = run.x, y = run.y, dx = run.dx, dy = run.dy;
      for (let step = 0; step < 46; step++) {
        dx += (rnd() - 0.5) * 0.5; dy += (rnd() - 0.5) * 0.7;
        const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
        if (x > MINE.w - 5) dx = -Math.abs(dx); if (x < 4) dx = Math.abs(dx);
        if (y > MINE.h - 4) dy = -Math.abs(dy); if (y < 3) dy = Math.abs(dy);
        x += dx; y += dy;
        carve(Math.round(x), Math.round(y), rnd() < 0.18 ? 3 : 1);    // now and then it opens into a chamber
      }
    }
    for (let x = 1; x < MINE.w - 2; x++) if (at(x, ENTRY[1]) === T.CAVE) put(x, ENTRY[1], T_RAIL);
    for (const [x, y] of [ENTRY, EXIT, HAUL, [EXIT[0] + 1, EXIT[1]], [HAUL[0] + 1, HAUL[1]]]) put(x, y, T.CAVE);
    put(HAUL[0], HAUL[1], T_HAUL);
    const roomy = (x, y) => { let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (at(x + dx, y + dy) === T.CAVE) n++; return n; };
    for (const [x, y] of open) {
      if (PILLARS.length >= 7) break;
      if (y === ENTRY[1] || at(x, y) !== T.CAVE || roomy(x, y) < 20) continue;
      if (Math.abs(x - EXIT[0]) < 5 && Math.abs(y - EXIT[1]) < 5) continue;
      if (PILLARS.some(p => Math.abs(p[0] - x) < 5 || Math.abs(p[1] - y) < 4)) continue;
      put(x, y, T_PILLAR); PILLARS.push([x, y]);
    }
    const props = [];
    for (const [x, y] of open) {
      if (props.length >= 5) break;
      if (at(x, y) !== T.CAVE || y === ENTRY[1] || roomy(x, y) < 14) continue;
      if (props.some(p => Math.hypot(p[0] - x, p[1] - y) < 7) || PILLARS.some(p => Math.hypot(p[0] - x, p[1] - y) < 3)) continue;
      put(x, y, T_PROP); props.push([x, y]);
    }
    let torches = 0;
    for (const [x, y] of open) {
      if (torches >= 9) break;
      if (at(x, y) !== T.CAVE) continue;
      let wall = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, y + dy) === T.WALL) wall++;
      if (wall < 2) continue;                                          // a torch is bracketed to a wall, not stood in the open
      if (LITTER.some(l => Math.hypot(l[0] - x, l[1] - y) < 6)) continue;
      put(x, y, T.TORCH); LITTER.push([x, y]); torches++;
    }
    for (const [x, y] of open) {
      if (at(x, y) !== T.CAVE) continue;
      const r = rnd();
      if (r < 0.055) put(x, y, T_SPOIL);
      else if (r < 0.075) { let wall = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, y + dy) === T.WALL) wall++; if (wall >= 1) put(x, y, T_TIMBER); }
    }
    for (let y = 2; y < MINE.h - 2; y++) for (let x = 2; x < MINE.w - 2; x++) {
      const t = at(x, y);
      if (t !== T.CAVE && t !== T_SPOIL) continue;
      if (y === ENTRY[1]) continue;
      if (Math.abs(x - EXIT[0]) < 3 && Math.abs(y - EXIT[1]) < 3) continue;
      if (Math.abs(x - HAUL[0]) < 2 && Math.abs(y - HAUL[1]) < 2) continue;
      FACE_SPOTS.push([x, y]);
    }
  }

  const inst = () => (window.INSTANCES ? INSTANCES.get(MINE.id) : null);
  if (window.INSTANCES) {
    INSTANCES.define(MINE.id, {
      name: 'The Coal Road', sub: 'The seam the goblins cut off', w: MINE.w, h: MINE.h, dark: true,
      build: buildMine, spawns: [], exit: EXIT, entry: ENTRY,
      voice: 'The old workings. Fill the cart before the roof remembers it is a roof.',
    });
  }

  // ---------- opening and closing faces ----------
  function openFace() {
    if (!run) return;
    const free = FACE_SPOTS.filter(([x, y]) => tileAt(x, y) !== T_SEAM && !(Math.floor(player.x / TILE) === x && Math.floor(player.y / TILE) === y));
    if (!free.length) return;
    const [x, y] = free[Math.floor(Math.random() * free.length)];
    changeTile(x, y, T_SEAM); run.faces.push([x, y]);
  }
  function closeFace(x, y) {
    if (!run) return;
    changeTile(x, y, T.CAVE);
    run.faces = run.faces.filter(f => !(f[0] === x && f[1] === y));
  }

  function startRun() {
    run = { t: RUN_SECONDS, coal: 0, faces: [], roof: ROOF_FUSE, fell: 0, swings: 0, warned: false, done: false };
    for (let i = 0; i < SEAM_LIVE; i++) openFace();
    notify(`Fill the cart. ${RUN_SECONDS} seconds. Knock the props back in or the roof comes down.`);
  }

  function endRun(reason) {
    if (!run || run.done) return;
    run.done = true;
    const s = st(), hauled = run.coal;
    s.runs++; s.lastHaul = hauled; if (hauled > s.best) s.best = hauled;
    if (hauled > 0) giveOrDrop('coal', hauled, player.x, player.y);
    gainXp('mining', hauled * 12);
    const best = hauled >= s.best && hauled > 0;
    levelBanner = { t: 2.4, title: `${hauled} COAL`, sub: best ? 'Your best shift yet' : reason };
    notify(`The cart goes up with ${hauled} coal. Best shift: ${s.best}.`);
    for (const [x, y] of run.faces.slice()) closeFace(x, y);
    run = null; save();
    if (window.INSTANCES && INSTANCES.active() === MINE.id) INSTANCES.leave();
  }

  // ---------- the shift ----------
  HOOKS.update.push(dt => {
    if (!running()) { if (run) run = null; return; }
    const r = run;
    r.t -= dt;
    if (r.t <= 0) { endRun('Shift over'); return; }
    // the roof: a prop knocked back in resets it, otherwise rock starts to come down
    r.roof -= dt;
    if (r.roof < ROOF_WARN && !r.warned) { r.warned = true; notify('The roof is talking. Find a prop and knock it back in.'); sfx('hurt'); }
    if (r.roof <= 0) {
      r.roof = 3; r.fell++;
      const px = Math.floor(player.x / TILE), py = Math.floor(player.y / TILE);
      for (let i = 0; i < 5; i++) burst(tc(px + rint(-3, 3)), tc(py + rint(-3, 3)), '#6e7178', 8, 60);
      hurtPlayer(rint(3, 6), player.x, player.y + 20, true);
      // a fall costs you coal off the top of the cart as it spills
      const spill = Math.min(r.coal, rint(1, 3)); r.coal -= spill;
      notify(spill ? `Rock down. ${spill} coal off the cart. Knock a prop back in.` : 'Rock down. Knock a prop back in.');
      if (player.dead) endRun('The roof won');
    }
  });

  // ---------- E: the cart in Deepholm, a face, a prop, the haul cart ----------
  HOOKS.use.push((t, tx, ty) => {
    if (t === T_CART) {
      if (!window.INSTANCES) return true;
      if (!hasTool('pickaxe')) { notify('The cart runs down to the old seam. You would want a pickaxe first.'); return true; }
      const s = st();
      if (!s.told) { s.told = true; say('The coal road. It runs down to the seam the goblins cut us off from. Fill the cart and bring it up — the forge is hungry.', 'Deepholm'); }
      // CHANGED with the underground move: the cart stands INSIDE the Deepholm instance now, and one
      // instance cannot be opened from inside another, so 58-underground steps us out of Deepholm, down
      // into the seam, and back into Deepholm beside this cart when the shift ends. Off the coal road
      // (no Deepholm, no hop) it is the plain entry it always was.
      const hopped = !!(window.UNDERGROUND && UNDERGROUND.rideFrom(MINE.id, [tx, ty + 1]));
      if (!hopped && !INSTANCES.enter(MINE.id, [tx, ty + 1])) { notify('You cannot ride down right now.'); return true; }
      startRun();
      return true;
    }
    if (!running()) return false;
    if (t === T_SEAM) {
      if (!hasTool('pickaxe')) { notify('You need a pickaxe down here.'); return true; }
      if (player.action && player.action.type === 'coalface') return true;
      player.action = { type: 'coalface', t: 0, need: SWING, tx, ty };
      return true;
    }
    if (t === T_PROP) {
      run.roof = PROP_RESET; run.warned = false;
      burst(tc(tx), tc(ty), '#7a5a32', 10, 60); sfx('ui');
      floatText(player.x, player.y - 30, 'Prop in', '#7ee787', 13);
      notify('The prop bites. The roof settles.');
      return true;
    }
    if (t === T_HAUL) { endRun('You called it'); return true; }
    return false;
  });

  // the timed swing at a face: the core runs player.action, this finishes ours
  HOOKS.update.push(() => {
    const a = player.action;
    if (!a || a.type !== 'coalface') return;
    if (!running()) { player.action = null; return; }
    if (a.t < a.need) return;
    player.action = null;
    if (tileAt(a.tx, a.ty) !== T_SEAM) return;
    const n = rint(2, 4);
    run.coal += n; run.swings++;
    gainXp('mining', 18);
    burst(tc(a.tx), tc(a.ty), '#2b2b33', 12, 70); sfx('mine');
    floatText(tc(a.tx), tc(a.ty) - 20, `+${n}`, '#c9d1d9', 13);
    closeFace(a.tx, a.ty); openFace();
  });

  // ---------- the shift clock on screen ----------
  HOOKS.hud.push((g, narrow) => {
    if (!running()) return;
    const w = narrow ? 150 : 190, x = VW / 2 - w / 2, y = Math.max(HUD_LAYOUT.topStackBottom + 8, 92);
    roundRect(g, x, y, w, 44, 8); g.fillStyle = 'rgba(10,14,22,0.86)'; g.fill();
    g.strokeStyle = run.roof < ROOF_WARN ? '#c0392b' : '#30363d'; g.lineWidth = run.roof < ROOF_WARN ? 2 : 1; g.stroke();
    g.textAlign = 'left'; g.font = 'bold 13px sans-serif'; g.fillStyle = '#e6edf3';
    g.fillText(`${run.coal} coal`, x + 12, y + 18);
    g.textAlign = 'right'; g.fillStyle = '#8b949e'; g.font = '12px sans-serif';
    g.fillText(`${Math.max(0, Math.ceil(run.t))}s`, x + w - 12, y + 18);
    // the roof bar: full is safe, empty is rock on your head
    const bw = w - 24, f = Math.max(0, Math.min(1, run.roof / PROP_RESET));
    g.fillStyle = '#21262d'; g.fillRect(x + 12, y + 26, bw, 8);
    g.fillStyle = f > 0.45 ? '#3fb950' : f > 0.2 ? '#d29922' : '#c0392b';
    g.fillRect(x + 12, y + 26, bw * f, 8);
    g.textAlign = 'left'; g.font = '10px sans-serif'; g.fillStyle = '#6e7681';
    g.fillText('roof', x + 12, y + 42);
    g.textAlign = 'center';
  });

  // ---------- the cart and the rails in Deepholm ----------
  HOOKS.world.push((rnd, api) => {
    // CHANGED with the underground move: Deepholm is an instance of its own (24-dwarves), so its halls are
    // no longer part of `map` and there is nothing to scan on the surface. The berth is picked the same way
    // as before — the east-most floor tile with open floor beneath it (you stand there to use the cart) and
    // a clear run west for the sleepers — but read and written through window.DEEPHOLM, which is the
    // undercity's own tile map. The relative berth is unchanged: the same tile in the same hall.
    const dh = window.DEEPHOLM;
    if (!dh) return;
    const open = (x, y) => { const t = dh.at(x, y); return t === T.CAVE || t === T.DIRT || t === T.FLOOR; };
    let best = null;
    for (let y = dh.rect.y0 + 1; y <= dh.rect.y1 - 1 && !best; y++) {
      for (let x = dh.rect.x1 - 1; x >= dh.rect.x0 + 6; x--) {
        if (!open(x, y) || !open(x, y + 1)) continue;
        let west = 0; while (west < 5 && open(x - 1 - west, y)) west++;
        if (west < 3) continue;
        if (dh.DWARVES.some(n => Math.abs(n.x - x) < 3 && Math.abs(n.y - y) < 3)) continue;
        best = { x, y, west }; break;
      }
    }
    if (!best) return;                                  // no berth: no cart, rather than a cart in a wall
    CART_T.x = best.x; CART_T.y = best.y;
    for (let d = 1; d <= best.west; d++) dh.set(best.x - d, best.y, T_RAIL);
    dh.set(best.x, best.y, T_CART);
  });

  HOOKS.draw.push((g, items) => {
    const seen = t => t >= cam.x / TILE - 2 && t <= (cam.x + VW) / TILE + 2;
    // the cart in Deepholm
    if (seen(CART_T.x) && tileAt(CART_T.x, CART_T.y) === T_CART) items.push({ y: tc(CART_T.y), draw: () => drawCart(g, tc(CART_T.x), tc(CART_T.y), 0) });
    if (!running()) return;
    for (const [x, y] of run.faces) {
      if (!seen(x)) continue;
      items.push({ y: tc(y), draw: () => {
        const cx = tc(x), cy = tc(y), pulse = 0.5 + Math.sin(time * 4 + x + y) * 0.25;
        g.fillStyle = '#1a1a20'; g.beginPath(); g.arc(cx, cy, 13, 0, 7); g.fill();
        g.fillStyle = `rgba(245,197,66,${0.18 + pulse * 0.22})`; g.beginPath(); g.arc(cx, cy, 15, 0, 7); g.fill();
        g.fillStyle = '#2b2b33';
        for (const [ox, oy, r] of [[-4, -3, 5], [4, -1, 6], [-1, 5, 5]]) { g.beginPath(); g.arc(cx + ox, cy + oy, r, 0, 7); g.fill(); }
        g.fillStyle = `rgba(255,180,60,${pulse})`; g.beginPath(); g.arc(cx + 2, cy - 2, 2.2, 0, 7); g.fill();
      } });
    }
    // pillars: a worked column, not a slab of wall — a wide base, a tapered shaft, a cap under the roof,
    // timber bracing lashed round it and a real shadow, so a child can tell at a glance what he is looking at
    for (const [px, py] of PILLARS) {
      if (!seen(px) || tileAt(px, py) !== T_PILLAR) continue;
      items.push({ y: tc(py) + 8, draw: () => {
        const x = tc(px), y = tc(py), h = TILE / 2;
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(x, y + h - 4, 15, 6, 0, 0, 7); g.fill();
        g.fillStyle = '#4a4d54'; g.beginPath(); g.ellipse(x, y + h - 6, 14, 6, 0, 0, 7); g.fill();      // base
        g.fillStyle = '#5f636b'; g.beginPath();                                                          // tapered shaft
        g.moveTo(x - 12, y + h - 6); g.lineTo(x - 8, y - h + 6); g.lineTo(x + 8, y - h + 6); g.lineTo(x + 12, y + h - 6); g.closePath(); g.fill();
        g.fillStyle = '#6d717a'; g.fillRect(x - 8, y - h + 6, 6, TILE - 12);                             // lit face
        g.fillStyle = '#3f424a'; g.fillRect(x + 4, y - h + 6, 4, TILE - 12);                             // shaded face
        g.fillStyle = '#787c86'; g.beginPath(); g.ellipse(x, y - h + 6, 11, 5, 0, 0, 7); g.fill();       // cap under the roof
        g.strokeStyle = '#6b4f2a'; g.lineWidth = 3;                                                       // timber bracing
        g.beginPath(); g.moveTo(x - 11, y + 2); g.lineTo(x + 11, y + 2); g.moveTo(x - 10, y - 8); g.lineTo(x + 10, y - 8); g.stroke();
      } });
    }
    // spoil underfoot and stacked timber against the rock
    for (let ty = Math.max(0, Math.floor(cam.y / TILE) - 1); ty <= Math.ceil((cam.y + VH) / TILE) + 1; ty++)
      for (let tx = Math.max(0, Math.floor(cam.x / TILE) - 1); tx <= Math.ceil((cam.x + VW) / TILE) + 1; tx++) {
        const t = tileAt(tx, ty);
        if (t !== T_SPOIL && t !== T_TIMBER) continue;
        const sx = tc(tx), sy = tc(ty), kind = t;
        items.push({ y: sy - 6, draw: () => {
          if (kind === T_SPOIL) {
            g.fillStyle = '#2b2b33';
            for (const [ox, oy, r] of [[-7, 3, 4], [2, -2, 5], [8, 5, 3], [-2, 7, 3]]) { g.beginPath(); g.arc(sx + ox, sy + oy, r, 0, 7); g.fill(); }
            g.fillStyle = 'rgba(120,124,134,0.35)'; g.beginPath(); g.arc(sx + 3, sy - 3, 1.6, 0, 7); g.fill();
          } else {
            g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(sx - 13, sy + 6, 26, 4);
            g.fillStyle = '#5a4530'; g.fillRect(sx - 13, sy - 2, 26, 5);
            g.fillStyle = '#6b5238'; g.fillRect(sx - 11, sy - 8, 22, 5);
            g.fillStyle = '#4a3826'; g.fillRect(sx - 9, sy - 13, 18, 4);
          }
        } });
      }
    const hx = HAUL[0], hy = HAUL[1];
    if (tileAt(hx, hy) === T_HAUL) items.push({ y: tc(hy), draw: () => drawCart(g, tc(hx), tc(hy), run.coal) });
  });

  function drawCart(g, x, y, load) {
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 11, 14, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#6b4f2a'; g.fillRect(x - 13, y - 8, 26, 15);
    g.fillStyle = '#8a6a3a'; g.fillRect(x - 13, y - 10, 26, 4);
    if (load > 0) { g.fillStyle = '#2b2b33'; const h = Math.min(9, 2 + load * 0.25); g.beginPath(); g.ellipse(x, y - 8, 11, h / 2, 0, 0, 7); g.fill(); }
    g.fillStyle = '#3a3a42';
    g.beginPath(); g.arc(x - 8, y + 8, 4, 0, 7); g.fill();
    g.beginPath(); g.arc(x + 8, y + 8, 4, 0, 7); g.fill();
  }

  window.COALMINE = { MINE, CART_T, RUN_SECONDS, SEAM_LIVE, PROP_RESET, ROOF_FUSE, tiles: { cart: T_CART, seam: T_SEAM, prop: T_PROP, haul: T_HAUL, rail: T_RAIL }, HAUL, EXIT, ENTRY, state: st, get run() { return run; }, startRun, endRun, openFace, FACE_SPOTS };

  // ---------- self-test ----------
  const P = 'coalmine: ';
  HOOKS.selfTest.push((check, F, h) => {
    if (!window.INSTANCES) { check(P + 'the coal road needs the instance system', false, {}); return; }
    if (!window.DEEPHOLM) { check(P + 'the coal road needs Deepholm', false, {}); return; }
    const q0 = quest.coalmine ? { ...quest.coalmine } : null;
    // CHANGED with the underground move: the cart stands inside the Deepholm instance, so the check walks
    // down there to look at it instead of reading the surface map. Same intent: cart on rails, in Deepholm,
    // on a tile you can stand beside and tap; and it must not stand anywhere on the surface.
    if (INSTANCES.active() && INSTANCES.active() !== DEEPHOLM.ID) INSTANCES.leave();
    { let surface = false; for (let y = 0; y < MAP_H && !surface; y++) for (let x = 0; x < MAP_W; x++) if (tileAt(x, y) === COALMINE.tiles.cart) { surface = true; break; }
      DEEPHOLM.enter();
      const onMap = tileAt(COALMINE.CART_T.x, COALMINE.CART_T.y) === COALMINE.tiles.cart;
      const rails = [1, 2, 3, 4, 5].filter(d => tileAt(COALMINE.CART_T.x - d, COALMINE.CART_T.y) === COALMINE.tiles.rail).length;
      const tappable = INTERESTING_TILES.has(COALMINE.tiles.cart);
      const standable = !SOLID.has(tileAt(COALMINE.CART_T.x, COALMINE.CART_T.y + 1));
      const inHall = COALMINE.CART_T.x >= DEEPHOLM.rect.x0 && COALMINE.CART_T.x <= DEEPHOLM.rect.x1 && COALMINE.CART_T.y >= DEEPHOLM.rect.y0 && COALMINE.CART_T.y <= DEEPHOLM.rect.y1;
      check(P + 'a coal cart stands on rails at the east end of Deepholm, on a tile you can walk up to and tap', onMap && rails >= 2 && tappable && standable && inHall && !surface, { onMap, rails, tappable, standable, inHall, onSurface: surface, at: [COALMINE.CART_T.x, COALMINE.CART_T.y] }); }
    // riding it opens the seam: a live gallery with faces, props and a haul cart
    { const bag = player.inv.slice();
      const pick = player.inv.findIndex(s2 => s2 && s2.id === 'bronze_pickaxe');
      if (pick < 0) h.give('bronze_pickaxe', 1);
      const c = COALMINE.CART_T;
      // no pickaxe: it tells you so and does not take you down
      const saved = player.inv.slice(); player.inv = player.inv.map(() => null);
      notice = null; const beforeId = INSTANCES.active();
      for (const hk of HOOKS.use) if (hk(COALMINE.tiles.cart, c.x, c.y)) break;
      const refused = INSTANCES.active() === beforeId && !!notice && /pickaxe/i.test(notice.text);
      player.inv = saved;
      for (const hk of HOOKS.use) if (hk(COALMINE.tiles.cart, c.x, c.y)) break;
      const inside = INSTANCES.active() === COALMINE.MINE.id, r = COALMINE.run;
      const faces = r ? r.faces.length : 0;
      const props = COALMINE.FACE_SPOTS.length > 0;
      const haul = tileAt(COALMINE.HAUL[0], COALMINE.HAUL[1]) === COALMINE.tiles.haul;
      check(P + 'the cart runs you down to a live seam: four faces glowing, a haul cart at the mouth, and it refuses you with no pickaxe', refused && inside && faces === COALMINE.SEAM_LIVE && props && haul && !!r && r.t > 0, { refused, inside, faces, haul, t: r && Math.round(r.t) });
      // mining a face pays coal into the cart and opens a fresh face somewhere else
      if (r && r.faces.length) {
        const [fx, fy] = r.faces[0];
        F.tp(fx + 1, fy); F.face(fx, fy);
        for (const hk of HOOKS.use) if (hk(COALMINE.tiles.seam, fx, fy)) break;
        const started = !!player.action && player.action.type === 'coalface';
        player.action.t = player.action.need; const c0 = r.coal, mx0 = player.skills.mining.xp;
        for (const u of HOOKS.update) u(0.016);
        const mined = r.coal - c0, gone = tileAt(fx, fy) !== COALMINE.tiles.seam, refilled = r.faces.length === COALMINE.SEAM_LIVE, xp = player.skills.mining.xp - mx0;
        check(P + 'a swing at a face pays 2-4 coal into the cart, closes that face and opens another', started && mined >= 2 && mined <= 4 && gone && refilled && xp === 18, { started, mined, gone, refilled, xp, faces: r.faces.length });
      } else check(P + 'a swing at a face pays 2-4 coal into the cart, closes that face and opens another', false, { noFaces: true });
      // the roof runs down and a prop puts it back
      if (COALMINE.run) {
        const r2 = COALMINE.run; r2.roof = 2; r2.warned = true;
        for (const hk of HOOKS.use) if (hk(COALMINE.tiles.prop, 8, 6)) break;
        const reset = r2.roof === COALMINE.PROP_RESET && r2.warned === false;
        // let it run out and the roof falls: it hurts and spills coal
        r2.roof = 0.001; r2.coal = 6; const hp0 = player.hp;
        for (const u of HOOKS.update) u(0.02);
        const fell = r2.fell >= 1 && (player.hp < hp0 || r2.coal < 6);
        check(P + 'the roof runs down on a clock, a prop resets it, and a fall costs health and coal off the cart', reset && fell, { reset, fell, roof: Math.round(r2.roof), coal: r2.coal, hp: player.hp, hp0 });
      } else check(P + 'the roof runs down on a clock, a prop resets it, and a fall costs health and coal off the cart', false, { noRun: true });
      // calling it at the haul cart pays out, records a best, and puts you back in Deepholm
      if (COALMINE.run) {
        const r3 = COALMINE.run; r3.coal = 21; player.hp = player.maxHp;
        const coal0 = countItem('coal'), mx1 = player.skills.mining.xp;
        COALMINE.endRun('test');
        // CHANGED with the underground move: "back up" now means back into Deepholm beside the cart, and
        // 58-underground's hop lands you there on the tick after the shift ends — so let a tick run.
        F.sim(3, []);
        const paid = countItem('coal') - coal0, out = INSTANCES.active() !== COALMINE.MINE.id, best = COALMINE.state().best >= 21, xp2 = player.skills.mining.xp - mx1;
        const inDeepholm = INSTANCES.active() === DEEPHOLM.ID, at = [Math.floor(player.x / TILE), Math.floor(player.y / TILE)];
        const beside = at[0] === COALMINE.CART_T.x && at[1] === COALMINE.CART_T.y + 1;
        check(P + 'the haul cart pays the coal out, banks your best shift and takes you back up', paid === 21 && out && best && xp2 === 21 * 12 && inDeepholm && beside, { paid, out, best: COALMINE.state().best, xp2, inDeepholm, at, cart: [COALMINE.CART_T.x, COALMINE.CART_T.y] });
      } else check(P + 'the haul cart pays the coal out, banks your best shift and takes you back up', false, { noRun: true });
      player.inv = bag;
      if (INSTANCES.active()) INSTANCES.leave();   // out of the seam or out of Deepholm: back on the surface either way
    }
    if (q0) quest.coalmine = q0;
  });
}
