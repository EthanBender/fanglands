// ============================================================================
// THE ASHFIELDS' EDGE — the burnt country fades into the land around it (owner, on the test world 2026-09-25:
// "still needs a better transition into the surrounding world and maybe a little bit of effort to make it
// less rectangular").
// On the world map the Ashfields were a grey near-rectangle: a ruled east side at x 99 against the jungle,
// grey meeting green in one step all the way round, and The Fang's Lair a clean black box on the west side.
// This pass runs after every other world pass (92-worldshape is the one before it), so it sees the finished map
// and only dresses it:
//   1. The edge band. Every tile gets a signed distance from the Ashfields' outline (the region masks, lair
//      included), wobbled by smooth noise so the band's contours wander in bays and headlands. Outside the
//      outline green grass goes dry, then singed, then cinders with ash patches that thin out; living trees
//      near the edge are charred. Inside the outline the ash thins into cinders and scorch. The colours step
//      green -> dry grass -> singed straw -> cinders -> ash, so grey never meets green at a line.
//   2. The lair's footprint. Volcanic crags lean against the lair's east and south walls at a noise-driven
//      depth, and the ground at its foot is scorched, so the black box reads as a ragged rock mass. The lair's
//      own walls, gate and the approach to it are not touched: nothing solid goes on the approach rows.
//   3. At draw time: charred trees and stumps, smoke from the cinders, and a soft feathered edge between the
//      band's ground kinds.
// Nothing here moves a region's name (regionAt is unchanged) or opens a way anywhere: open ground only ever
// becomes other open ground, a living tree only ever becomes a dead one, and every rock or dead tree this file
// stands on open ground passes a local test first — the open tiles round it must stay joined without it, and
// nothing solid beside it may lose its last side to stand on — so no path is cut and nothing is walled in.
// Feature file: registers through HOOKS only, edits no core file. window.ASHEDGE exposes the tallies.
// ============================================================================
{
  const SEED = 9331;
  const Tn = n => (n in T ? T[n] : -1);
  const ASH = Tn('ASH'), SCORCH = Tn('SCORCH'), JUNGLE = Tn('JUNGLE'), FERN = Tn('FERN'), DEADTREE = Tn('DEADTREE');
  const LAIR_GATE = Tn('LAIR_GATE'), WARDEN_GATE = Tn('WARDEN_GATE'), BRIDGE = Tn('BRIDGE'), DOCK = Tn('DOCK');
  const RIM = Tn('CLIFF');                                            // 92-worldshape's rock face (it loads before this file)

  // ---------- textures: the same smooth procedural style as the core's ground ----------
  {
    const r = mulberry32(9312);
    const blades = (g, n, cols, tip) => {
      g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const x = r() * TILE, y = r() * TILE, h = 4 + r() * 6, bend = (r() - 0.5) * 6;
        g.strokeStyle = cols[Math.floor(r() * cols.length)]; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + bend, y - h * 0.6, x + bend * 1.4, y - h); g.stroke();
        if (tip && r() < 0.55) { g.fillStyle = tip; g.beginPath(); g.arc(x + bend * 1.4, y - h, 1.1, 0, 7); g.fill(); }
      }
    };
    const grad = (g, a, b) => { const gr = g.createLinearGradient(0, 0, TILE, TILE); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, TILE, TILE); };
    const flecks = (g, n, col) => { for (let i = 0; i < n; i++) { g.fillStyle = col; g.beginPath(); g.arc(r() * TILE, r() * TILE, 0.6 + r() * 1.1, 0, 7); g.fill(); } };
    for (let v = 0; v < 3; v++) {
      // dry grass: the green going yellow
      makeTex('afdry' + v, g => { grad(g, '#86a042', '#748c38'); blades(g, 30, ['#a9b84e', '#5f7a2e', '#c2b45a', '#8fa844'], null); });
      // singed grass: straw with burnt tips, a few ash flecks
      makeTex('afsinged' + v, g => {
        grad(g, '#9c8f50', '#877b44');
        for (let i = 0; i < 4; i++) { g.fillStyle = r() < 0.5 ? 'rgba(70,58,40,0.28)' : 'rgba(190,172,110,0.3)'; g.beginPath(); g.ellipse(r() * TILE, r() * TILE, 5 + r() * 6, 3 + r() * 3, r() * 3, 0, 7); g.fill(); }
        blades(g, 26, ['#bda866', '#6e5f36', '#a8944f', '#c9b872'], '#3a302a'); flecks(g, 8, 'rgba(210,210,214,0.35)');
      });
      // cinders: burnt stubble and grey-brown ash, an ember now and then
      makeTex('afcinders' + v, g => {
        grad(g, '#786f5f', '#655d50');
        for (let i = 0; i < 6; i++) { g.fillStyle = r() < 0.5 ? '#58544e' : '#7c776c'; g.beginPath(); g.ellipse(r() * TILE, r() * TILE, 4 + r() * 7, 3 + r() * 4, r() * 3, 0, 7); g.fill(); }
        g.strokeStyle = '#2e2a27'; g.lineWidth = 1.4; g.lineCap = 'round';
        for (let i = 0; i < 12; i++) { const x = r() * TILE, y = r() * TILE; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 3); g.stroke(); }
        flecks(g, 12, 'rgba(205,205,210,0.4)');
        if (v === 1) { g.fillStyle = 'rgba(255,120,40,0.45)'; g.beginPath(); g.arc(r() * TILE, r() * TILE, 1.4, 0, 7); g.fill(); }
      });
      // a dried riverbed: pale cracked mud in plates, pebbles where the water ran
      makeTex('afbed' + v, g => {
        grad(g, '#8a7658', '#76644b');
        g.strokeStyle = 'rgba(52,40,30,0.7)'; g.lineWidth = 1.3; g.lineJoin = 'round';
        for (let i = 0; i < 7; i++) { let x = r() * TILE, y = r() * TILE; g.beginPath(); g.moveTo(x, y);
          for (let k = 0; k < 3; k++) { x += (r() - 0.5) * 18; y += (r() - 0.5) * 18; g.lineTo(x, y); } g.stroke(); }
        for (let i = 0; i < 6; i++) { g.fillStyle = r() < 0.5 ? '#9a8a70' : '#5e5244'; g.beginPath(); g.ellipse(r() * TILE, r() * TILE, 1.6 + r() * 1.8, 1.2 + r() * 1.2, r() * 3, 0, 7); g.fill(); }
        flecks(g, 5, 'rgba(205,205,210,0.3)');
      });
      // volcanic crag: dark rock heaped against the lair, faint heat in the cracks
      makeTex('afcrag' + v, g => {
        g.fillStyle = '#322c2e'; g.fillRect(0, 0, TILE, TILE);
        for (let i = 0; i < 5; i++) {
          const cx = r() * TILE, cy = r() * TILE, rr = 9 + r() * 9; g.fillStyle = ['#443c3e', '#4c4345', '#3b3436'][i % 3];
          g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, q = rr * (0.7 + r() * 0.4); g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } g.closePath(); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1.5; g.stroke();
        }
        if (v !== 2) { g.strokeStyle = 'rgba(255,110,40,0.35)'; g.lineWidth = 1.2; const x = r() * TILE, y = r() * TILE; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 16, y + (r() - 0.5) * 16); g.lineTo(x + (r() - 0.5) * 22, y + (r() - 0.5) * 22); g.stroke(); }
      });
    }
  }

  // ---------- tiles ----------
  // The map colours step between the greens (#4c9134 grass, #3f8a3a fern) and the ash (#5d5f66), so the world map fades too.
  const DRY = addTile('AF_DRYGRASS', { tex: 'afdry', mini: '#7b983c', placeableOn: true });
  const SINGED = addTile('AF_SINGED', { tex: 'afsinged', mini: '#928a4e', placeableOn: true });
  const CINDERS = addTile('AF_CINDERS', { tex: 'afcinders', mini: '#766d5b', placeableOn: true });
  // (on the map a burnt tree is a shade darker than the cinders round it, not black: a column of black dots read as
  // a ruled line down the jungle's edge)
  const CHAR = addTile('AF_CHARTREE', { solid: true, tex: 'afcinders', mini: '#564e44' });
  // (a crag's own tile is the scorched ground it stands on: the boulder heap is drawn over it and spills past the
  // tile, so the rock mass has no square edge; with its own rock texture every crag read as a square block)
  const CRAG = addTile('AF_CRAG', { solid: true, tex: 'scorch', mini: '#3b3335' });
  // the river from Sylvaris runs west into the burnt country and dries up: cracked mud where it used to flow
  const DRYBED = addTile('AF_DRYBED', { tex: 'afbed', mini: '#7a6a55', placeableOn: true });

  // ---------- smooth value noise (the same shape 39-worldblend and 92-worldshape use), 0..1 ----------
  const makeNoise = (seed, cell) => {
    const r = mulberry32(seed), N = 64, lat = new Float32Array(N * N); for (let i = 0; i < lat.length; i++) lat[i] = r();
    const at = (ix, iy) => lat[((iy % N + N) % N) * N + ((ix % N + N) % N)];
    const sm = t => t * t * (3 - 2 * t);
    const oct = (x, y, c) => { const fx = x / c, fy = y / c, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy); return lerp(lerp(at(ix, iy), at(ix + 1, iy), tx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty); };
    return (x, y) => clamp(0.5 + (oct(x, y, cell) * 0.7 + oct(x + 37.3, y + 11.7, cell / 2) * 0.3 - 0.5) * 1.7, 0, 1);
  };
  const WOB = makeNoise(SEED + 1, 11), FINE = makeNoise(SEED + 2, 3), PATCH = makeNoise(SEED + 3, 4), DEPTH = makeNoise(SEED + 4, 3.5), PICK = makeNoise(SEED + 5, 2.5), RAG = makeNoise(SEED + 6, 4);
  const RIDGE = makeNoise(SEED + 11, 9), CREST = makeNoise(SEED + 7, 4.5), BED = makeNoise(SEED + 8, 5), BURN = makeNoise(SEED + 9, 5), JIT = makeNoise(SEED + 10, 1.6);

  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];
  // a small deterministic hash per tile and slot, 0..1 (world passes and drawing both use it)
  const hsh = (tx, ty, k) => { let v = Math.imul(tx * 374761393 + ty * 668265263 + k * 2246822519, 1274126177); v ^= v >>> 15; return ((v >>> 0) % 1000) / 1000; };
  const LAIR = { x0: 2, y0: 108, x1: 34, y1: 138 };                  // 28-thefang's box: its walls are never touched
  const APPROACH = { x0: 1, y0: 103, x1: 40, y1: 107 };              // 27-dragons keeps it open: nothing solid goes here
  const AF_BOX = { x0: 0, y0: 96, x1: 99, y1: 139 };                 // the Ashfields' box: nothing green inside it (56-ashfields), so no dry grass either
  const BAND_OUT = 9, BAND_IN = 5;                                   // how far the fade reaches out of the outline, and into it
  const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  const AE = window.ASHEDGE = { stats: {}, band: null, big: null, box: null, DRY, SINGED, CINDERS, CHAR, CRAG, BAND_OUT, BAND_IN };
  // every kind of ground this pass lays outside the Ashfields (the rim's crest included: it climbs into Wolfwood's last rows)
  AE.FRINGE = [DRY, SINGED, CINDERS, CHAR, SCORCH, RIM].filter(v => v >= 0);

  HOOKS.world.push((rnd0, api) => {
    const rnd = mulberry32(SEED);                  // its own stream: what drew before this must not move the result
    const set = api.setTile, at = api.tileAt, W = MAP_W, H = MAP_H, I = (x, y) => y * W + x;
    const S = AE.stats = { out: {}, inside: {}, charred: 0, standing: 0, crags: 0, lairDressed: 0, refused: 0, box: null };
    const GREEN = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, FERN].filter(v => v >= 0));
    const TREES = new Set([T.TREE, T.OAK, JUNGLE].filter(v => v >= 0));
    const GATES = new Set([LAIR_GATE, WARDEN_GATE, Tn('CRYPT_BARS'), Tn('SCARP_STEPS'), Tn('DUNGEON_DOOR')].filter(v => v >= 0));
    const ROADISH = new Set([T.COBBLE, T.PLANK, BRIDGE, DOCK, T.SOIL, T.CROP, T.WATER].filter(v => v >= 0));
    // the tracks 27-dragons trod through the ash (Wolfwood -> the farm -> the lair): nothing solid within 2.5 tiles of them
    const TRACKS = [[[60, 94], [60, 100], [56, 104], [48, 105], [36, 105]], [[60, 100], [63, 103], [69, 103]]];
    const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; const q = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(px - (ax + dx * q), py - (ay + dy * q)); };
    const nearTrack = (x, y) => TRACKS.some(pl => pl.some((p, k) => k > 0 && segDist(x, y, pl[k - 1][0], pl[k - 1][1], p[0], p[1]) <= 2.5));

    // ---- the outline: Ashfields and the lair, as the region masks now draw them ----
    // the map as this pass found it, for step 1g
    const pre = new Int32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pre[I(x, y)] = at(x, y);
    const own = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = regionAt(x, y); if (r && (r.name === 'The Ashfields' || r.name === "The Fang's Lair")) own[I(x, y)] = 1; }
    // the burnt country as the eye sees it: the outline, and everything below the rim row inside the Ashfields' box
    const land = AE.land = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (own[I(x, y)] || (x <= 99 && y >= 96 && y <= 139)) land[I(x, y)] = 1;
    // chamfer distance to the nearest seed tile (1 straight, 1.414 diagonal)
    const chamfer = seed => {
      const d = new Float32Array(W * H).fill(1e6);
      for (let i = 0; i < d.length; i++) if (seed(i)) d[i] = 0;
      const rel = (i, j, c) => { if (d[j] + c < d[i]) d[i] = d[j] + c; };
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = I(x, y);
        if (x > 0) rel(i, i - 1, 1); if (y > 0) { rel(i, i - W, 1); if (x > 0) rel(i, i - W - 1, 1.414); if (x < W - 1) rel(i, i - W + 1, 1.414); } }
      for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = I(x, y);
        if (x < W - 1) rel(i, i + 1, 1); if (y < H - 1) { rel(i, i + W, 1); if (x < W - 1) rel(i, i + W + 1, 1.414); if (x > 0) rel(i, i + W - 1, 1.414); } }
      return d;
    };
    // the rim (92-worldshape's rock face above the Ashfields, rows 95 down to its foot) counts as the Ashfields' own edge,
    // so the fade starts right above the rock rather than a few rows up in the wood
    const rim = new Uint8Array(W * H);
    const CLIFF = Tn('CLIFF'), foot = window.WORLDSHAPE && WORLDSHAPE.seams && WORLDSHAPE.seams.footWA;
    if (CLIFF >= 0 && foot) for (let x = 1; x <= 99; x++) for (let y = 95; y <= foot(x); y++) if (at(x, y) === CLIFF || own[I(x, y)]) rim[I(x, y)] = 1;
    const dOut = chamfer(i => own[i] === 1 || rim[i] === 1), dIn = chamfer(i => own[i] === 0);
    // signed distance from the outline, wobbled: positive outside, negative inside
    const edge = (x, y) => { const i = I(x, y); const s = own[i] ? -(dIn[i] - 0.5) : dOut[i] - 0.5; return s + (WOB(x, y) - 0.5) * 15 + (FINE(x, y) - 0.5) * 2.4; };

    // ---- what this pass may not touch ----
    const hard = new Uint8Array(W * H);
    const mark = (x0, y0, x1, y1) => { for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) hard[I(x, y)] = 1; };
    mark(0, 0, W - 1, 0); mark(0, H - 1, W - 1, H - 1); mark(0, 0, 0, H - 1); mark(W - 1, 0, W - 1, H - 1);   // the tree border
    mark(LAIR.x0, LAIR.y0, LAIR.x1, LAIR.y1);                     // the lair itself
    mark(53, 83, 68, 106);                                        // the stone circle, the warden, his gate, the road through and the fork below
    mark(84, 100, 90, 106);                                       // the ruined shrine
    mark(58, 96, 79, 107);                                        // Dunstan's farm
    mark(91, 77, 99, 85);                                         // the watchtower
    for (const b of BUILDINGS) mark(b.x - 2, b.y - 2, b.x + b.w + 1, b.y + b.h + 1);
    for (const n of NPCS) mark(n.x - 2, n.y - 2, n.x + 2, n.y + 2);
    for (const s of MONSTER_SPAWNS) mark(s.tx - 2, s.ty - 2, s.tx + 2, s.ty + 2);
    if (window.PROGRESSION && PROGRESSION.CROSSINGS) for (const c of PROGRESSION.CROSSINGS) { mark(c.a.x - 2, c.a.y - 2, c.a.x + 2, c.a.y + 2); mark(c.b.x - 2, c.b.y - 2, c.b.x + 2, c.b.y + 2); }
    const free = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && !hard[I(x, y)] && !buildingAt(x, y);

    // ---- a rock or a dead tree may stand on open ground only where it cuts nothing ----
    const open = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || GATES.has(t) || WALK_OVER.has(t);
    const canStand = (x, y) => {
      if (!free(x, y) || !open(at(x, y)) || inRect(APPROACH, x, y) || nearTrack(x, y)) return false;
      for (const [dx, dy] of N8) { const t = at(x + dx, y + dy); if (ROADISH.has(t) || GATES.has(t) || PUSH_THROUGH.has(t)) return false; }
      // the open tiles round it must stay joined to each other without it (4-connected round the ring of eight)
      const ring = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
      const o = ring.map(([dx, dy]) => open(at(x + dx, y + dy)));
      const seen = new Array(8).fill(false); let comps = 0, sideComps = new Set();
      for (let k = 0; k < 8; k++) {
        if (!o[k] || seen[k]) continue; comps++;
        const st = [k]; seen[k] = true;
        while (st.length) { const c = st.pop(); if (c % 2 === 1) sideComps.add(comps);
          for (const nk of [(c + 1) % 8, (c + 7) % 8]) {
            if (seen[nk] || !o[nk]) continue;
            // corners join their two sides; two sides only meet through a corner
            if (c % 2 === 0 || nk % 2 === 0) { seen[nk] = true; st.push(nk); }
          } }
      }
      if (sideComps.size > 1) return false;
      // nothing solid beside it may lose its last side to stand on
      // (this file's own rock and dead trees, the lair's walls and the rim's rock face need no side: nobody works them)
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy, t = at(nx, ny); if (open(t) || t === CRAG || t === CHAR || t === T.WALL || t === RIM) continue;
        let sides = 0; for (const [ex, ey] of N4) { const ax = nx + ex, ay = ny + ey; if ((ax !== x || ay !== y) && inMap(ax, ay) && open(at(ax, ay))) sides++; }
        if (sides === 0) return false; }
      return true;
    };
    // (every open tile this pass makes solid is remembered, so step 1g can give it back if it closed a pocket)
    const placed = [];
    const stand = (x, y, t) => { if (!canStand(x, y)) { S.refused++; return false; } placed.push([x, y, at(x, y), t]); set(x, y, t); return true; };

    const band = AE.band = new Uint8Array(W * H);    // the tiles this pass dressed, for the draw pass
    const big = AE.big = new Uint8Array(W * H);      // charred trees that were jungle giants: drawn bigger
    const tally = (o, k) => { o[k] = (o[k] || 0) + 1; };
    const name = t => t === DRY ? 'dry' : t === SINGED ? 'singed' : t === CINDERS ? 'cinders' : t === ASH ? 'ash' : t === SCORCH ? 'scorch' : t === T.DIRT ? 'dirt' : String(t);

    // ---- 1. the edge band ----
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = I(x, y);
      if (own[i] ? dIn[i] > BAND_IN + 6 : dOut[i] > BAND_OUT + 6) continue;
      if (!free(x, y)) continue;
      // r picks between the kinds a zone mixes: mostly smooth noise, so the kinds lie in small patches rather than a checkerboard
      const t = at(x, y), e = edge(x, y), r = clamp(PICK(x, y) * 0.8 + rnd() * 0.2, 0, 0.999), p = PATCH(x, y), inBox = inRect(AF_BOX, x, y);
      if (!own[i]) {
        // outside the outline: green ground burns by how near the ash it lies, ash lying in patches that thin out
        if (GREEN.has(t)) {
          let to = null;
          // (ash itself only within two tiles of the outline: above the rim 92-worldshape wants Wolfwood free of ash
          // from six rows up, so further out the patches are cinders, which read as burnt but are not ash)
          const ashOk = dOut[i] <= 2;
          if (e < 1.4) to = p > 0.5 && ashOk ? ASH : r < 0.3 ? SCORCH : CINDERS;
          else if (e < 3.4) to = p > 0.66 && ashOk ? ASH : r < 0.55 ? CINDERS : SINGED;
          else if (e < 5.6) to = p > 0.8 ? CINDERS : r < 0.62 ? SINGED : DRY;
          else if (e < BAND_OUT) to = r < (BAND_OUT - e) / (BAND_OUT - 5.6) * 0.85 ? (p > 0.7 ? SINGED : DRY) : null;
          if (to === DRY && inBox) to = SINGED;                                          // nothing green inside the box, not even dry grass
          if (to !== null) { set(x, y, to); band[i] = 1; tally(S.out, name(to)); }
        } else if (TREES.has(t)) {
          // living trees at the edge are charred where they stand (solid for solid: no path changes)
          // (the trees right on the outline burn a third of the time or more wherever the wobble puts the fade, so the
          // jungle's wall at x 100 is a broken line of burnt giants and green ones rather than one ruled row of canopy)
          // (the fire ran in tongues: a second, finer noise pushes the burnt trees out into bays and holds living ones
          // back as headlands, so on the map the grey-brown of the burnt wood meets the green in a wandering line)
          const bay = e + (BURN(x, y) - 0.5) * 7;
          let burn = bay < 2.5 ? 0.92 : bay < 5 ? 0.45 : e < 7.5 ? 0.08 : 0;
          if (dOut[i] <= 1.5) burn = Math.max(burn, 0.35);
          if (rnd() < burn) { set(x, y, CHAR); band[i] = 1; S.charred++; if (t === JUNGLE) big[i] = 1; }
        }
        // a dead tree or two out on the burnt ground itself
        if (band[i] && e < 3 && (at(x, y) === ASH || at(x, y) === CINDERS) && rnd() < 0.05 && stand(x, y, CHAR)) S.standing++;
      } else {
        // inside the outline: the ash thins into cinders, scorch and singed straw toward the edge
        if (e < -BAND_IN) continue;
        // (except the three rows under the rim: that is where the rock face stands, and 92-worldshape holds that the
        // ground below it is ash; the fade across the rim happens above it and further in)
        if (foot && x <= 99 && y <= foot(x) + 3) continue;
        if (t === ASH || t === SCORCH || (t === T.DIRT && !nearTrack(x, y))) {
          // in a bay (the wobble pulls the edge inward) the ground goes to singed straw and cinders outright;
          // along the edge it is cinders with ash between; a little deeper, a scatter of cinders in the ash
          let to = null;
          if (e > 1.8) to = r < 0.8 ? SINGED : r < 0.93 ? CINDERS : T.DIRT;
          else if (e > 0.6) to = r < 0.5 ? SINGED : r < 0.9 ? CINDERS : T.DIRT;
          else if (e > -0.9) to = t !== ASH ? null : r < 0.45 ? CINDERS : r < 0.62 ? SINGED : null;
          else if (e > -2.6) to = t !== ASH || p > 0.55 ? null : r < 0.45 ? CINDERS : r < 0.55 ? SCORCH : null;
          else to = t === ASH && r < 0.14 ? CINDERS : null;
          if (to === t) to = null;
          if (to !== null) { set(x, y, to); band[i] = 1; tally(S.inside, name(to)); }
          else band[i] = 1;
          // dead trees stand thicker toward the edge
          if (e > -1.5 && rnd() < 0.07 && stand(x, y, CHAR)) S.standing++;
        } else if (GREEN.has(t)) {
          // the seam's last grass (56-ashfields keeps some so the rim still dithers): outside the box it goes singed,
          // inside it is burnt by step 1e below
          if (!inBox) { set(x, y, r < 0.5 ? SINGED : DRY); band[i] = 1; tally(S.inside, 'singed'); }
        } else if (TREES.has(t)) { set(x, y, CHAR); band[i] = 1; S.charred++; if (t === JUNGLE) big[i] = 1; }
        else if (t === SCORCH || t === T.DIRT || t === CINDERS) band[i] = 1;
      }
    }

    // ---- 1b. the jungle's wall at x 100: a ragged treeline, not a ruled column ----
    // 39-worldblend keeps one unbroken column of jungle giants at x 100 so nobody walks from the jungle into dragon
    // country; on the map that column is a ruled line however the ground either side is dressed. Burnt and living
    // trees now stand in front of it and behind it at a depth that wanders 0-4 tiles, so the dark edge has a shape.
    // The column itself is untouched (solid stays solid), and every tree added passes the same local test.
    S.treeline = 0;
    for (let y = 100; y <= 156; y++) for (let x = 95; x <= 105; x++) {
      const k = Math.abs(x - 100); if (k === 0) continue;
      const depth = RAG(x, y) * 5 - 0.6;
      if (k > depth) continue;
      const t = at(x, y); if (!(t === ASH || t === CINDERS || t === SCORCH || t === SINGED || t === DRY || GREEN.has(t))) continue;
      const green = x > 100 && edge(x, y) > 4 && JUNGLE >= 0;
      if (stand(x, y, green ? JUNGLE : CHAR)) { S.treeline++; band[I(x, y)] = 1; if (x > 100 && !green) big[I(x, y)] = 1; }
    }

    // ---- 2. the lair's footprint: crags against its east and south walls, scorch at its foot ----
    // Depth wanders by noise; nothing solid on the approach rows (103-107) or the lair's west strip.
    const rectOut = (x, y) => Math.max(LAIR.x0 - x, 0, x - LAIR.x1, LAIR.y0 - y, y - LAIR.y1);
    for (let y = LAIR.y0 - 5; y <= LAIR.y1 + 8; y++) for (let x = LAIR.x0 - 1; x <= LAIR.x1 + 8; x++) {
      if (!inMap(x, y)) continue;
      const d = rectOut(x, y); if (d < 1 || !free(x, y)) continue;
      const t = at(x, y), soft = t === ASH || t === CINDERS || t === SCORCH || t === T.DIRT;
      if (!soft) continue;
      const face = x >= LAIR.x0 && (x > LAIR.x1 || y > LAIR.y1);   // the east and south faces take rock; the north is the approach
      // how far the rock and the scorch reach out from the wall here: up to five tiles on the faces, three on the approach
      const depth = face ? 0.4 + DEPTH(x, y) * 5.6 : -0.3 + DEPTH(x, y) * 3.4;
      if (face && d <= depth - 0.4 && !(t === T.DIRT && nearTrack(x, y)) && stand(x, y, CRAG)) { S.crags++; band[I(x, y)] = 1; continue; }
      let to = null;
      if (d <= depth + 0.5) to = SCORCH;
      else if (d <= depth + 1.7 && rnd() < 0.65) to = CINDERS;
      if (to !== null && t !== to && !(t === T.DIRT && nearTrack(x, y))) { set(x, y, to); S.lairDressed++; }
      if (to !== null) band[I(x, y)] = 1;
    }

    // ---- 1c. the rim's crest: the rock face climbs 0-3 rows above row 95, so its top edge wanders ----
    // 92-worldshape's rim is solid all along row 95 (the warden's gate the one notch) with its foot wandering 95-99;
    // its top was row 95 everywhere, one ruled line 90 tiles long on the map and across every screen. The face now
    // climbs by a noise height per column, onto burnt ground (open for solid only where the local test says it cuts
    // nothing) or in place of a tree (solid for solid). A column stops at the first tile it may not take, so no rock
    // floats. Nothing near the warden's road, the stone circle or the watchtower (the guards in `free`).
    S.crest = 0; S.foot = 0; AE.crestTop = [];
    const FOOTABLE = new Set([ASH, SCORCH, CINDERS, SINGED].filter(v => v >= 0));
    const RIM_CLIFF = RIM;
    if (RIM_CLIFF >= 0) for (let x = 1; x <= 99; x++) {
      AE.crestTop[x] = 95;
      if (x >= 54 && x <= 66) continue;
      if (at(x, 95) !== RIM_CLIFF) continue;
      // (a slow noise for hills and dips several columns long, a quicker one on top, and a quick one so neighbouring
      // columns seldom stand level for long). Owner 2026-09-30 by eye: a 0 to 3 rise averaged one row and still read as
      // a ruled line on the map, so the ridge now climbs up to five rows where the slow noise is high ...
      const up = clamp(Math.round(RIDGE(x, 2.9) * 7 - 1.8 + (CREST(x, 3.7) - 0.5) * 2 + (JIT(x, 7.7) - 0.5) * 1.6), 0, 5);
      for (let y = 94; y >= 95 - up; y--) {
        const t = at(x, y);
        if (TREES.has(t) || t === CHAR || t === DEADTREE) { if (!free(x, y)) break; set(x, y, RIM_CLIFF); }
        else if (!stand(x, y, RIM_CLIFF)) break;
        S.crest++; band[I(x, y)] = 1; AE.crestTop[x] = y;
      }
      // ... and where it is low the rock steps down into the ash instead, up to three rows, so the face itself wanders
      // (open burnt ground only, each rock through the local test; 1g gives back any that shut something off)
      const down = clamp(Math.round((0.5 - RIDGE(x, 2.9)) * 8 + (JIT(x, 3.1) - 0.5) * 1.4), 0, 3);
      for (let y = 96; y <= 95 + down; y++) {
        const t = at(x, y);
        if (!FOOTABLE.has(t) || !free(x, y) || nearTrack(x, y) || !stand(x, y, RIM_CLIFF)) break;
        S.foot++; band[I(x, y)] = 1;
      }
    }

    // ---- 1d. the river from Sylvaris runs dry in the burnt country ----
    // 25-elves' river runs west from Sylvaris and stopped dead at the jungle's wall in a square end. It now carries on
    // west as a dry bed of cracked mud that wanders and thins out into the ash. Open ground only (the bed passes
    // behind a tree, a rock or the wall rather than through it), so not one step of the walk changes.
    S.bed = 0;
    { let wx = 999, wy = -1;
      for (let y = 128; y <= 146; y++) for (let x = 100; x <= 115; x++) if (at(x, y) === T.WATER && x < wx) { wx = x; wy = y; }
      AE.riverEnd = wy >= 0 ? [wx, wy] : null;
      if (wy >= 0) {
        const BEDDABLE = new Set([ASH, SCORCH, CINDERS, SINGED, DRY, T.DIRT, ...GREEN].filter(v => v >= 0));
        let y = wy, len = 22;
        for (let k = 1; k <= len; k++) {
          const x = wx - k;
          // the bed drifts a row at a time, following its own noise
          const want = wy + Math.round((BED(x, 9.1) - 0.5) * 7);
          if (k > 2 && want !== y) y += want > y ? 1 : -1;
          const wide = k <= 6 ? 2 : k <= 12 ? (BED(x, 2.3) > 0.5 ? 2 : 1) : 1;
          const gap = k > 14 && rnd() < (k - 14) / 10;   // the last stretch breaks up into puddle marks
          for (let w = 0; w < wide; w++) {
            const yy = y + w;
            if (gap || !free(x, yy) || nearTrack(x, yy) || !BEDDABLE.has(at(x, yy))) continue;
            set(x, yy, DRYBED); band[I(x, yy)] = 1; S.bed++;
          }
        }
      }
    }

    // ---- 1e. nothing green left inside the burnt country ----
    // 56-ashfields kept some grass on the seam under the rim so it dithered into the wood; with the rim a rock face
    // those were bright green squares at its foot. They burn to singed straw and cinders now (56's check counts the
    // straw as the seam's fade). And any living tree the other passes left standing inside the Ashfields' outline
    // (a row of them on its south lobe) is charred, solid for solid.
    S.seam = 0; S.deepTrees = 0;
    for (let y = 96; y <= 160; y++) for (let x = 1; x <= 99; x++) {
      const i = I(x, y); if (!(own[i] || y >= 96) || buildingAt(x, y)) continue;    // (south of the rim row is burnt country whatever the name says)
      const t = at(x, y);
      // (grass to straw is open ground to open ground, so it may go where the solid-placing guards say no: the
      // warden's road and Dunstan's farm had the brightest squares)
      if (GREEN.has(t) && inRect(AF_BOX, x, y)) { set(x, y, PICK(x, y) < 0.62 ? SINGED : CINDERS); band[i] = 1; S.seam++; }
      else if (TREES.has(t) && (own[i] || (y >= 96 && y <= 100)) && free(x, y)) { set(x, y, CHAR); band[i] = 1; S.deepTrees++; }
    }

    // ---- 1f. the jungle's edge burnt to a ragged depth ----
    // Along x 100 the jungle's giants stood green right against the ash for a dozen rows at a time, one ruled wall of
    // canopy. Each row now burns into the jungle to its own depth (0 to 8 tiles, a slow noise for bays and headlands
    // and a quick one so no two neighbouring rows agree for long): trees charred, fern burnt to cinders and straw,
    // then a tile or two of singed and dry fern before the green. Solid for solid, open for open.
    S.eastBurn = 0; AE.eastDepth = [];
    if (JUNGLE >= 0) for (let y = 96; y <= 158; y++) {
      const depth = 0.6 + BURN(100.5, y) * 5.6 + (JIT(3.3, y) - 0.5) * 3.4;
      AE.eastDepth[y] = depth;
      for (let x = 101; x <= 111; x++) {
        const k = x - 100, i = I(x, y), t = at(x, y);
        if (!free(x, y) || nearTrack(x, y)) continue;
        if (k <= depth) {
          if (TREES.has(t)) { if (rnd() < 0.9) { set(x, y, CHAR); band[i] = 1; big[i] = t === JUNGLE ? 1 : 0; S.eastBurn++; } }
          else if (GREEN.has(t)) { set(x, y, k <= depth - 1.5 ? (PICK(x, y) < 0.55 ? CINDERS : SCORCH) : (PICK(x, y) < 0.5 ? CINDERS : SINGED)); band[i] = 1; S.eastBurn++; }
        } else if (k <= depth + 2) {
          if (TREES.has(t)) { if (rnd() < 0.25) { set(x, y, CHAR); band[i] = 1; big[i] = t === JUNGLE ? 1 : 0; S.eastBurn++; } }
          else if (GREEN.has(t)) { set(x, y, k <= depth + 1 ? SINGED : DRY); band[i] = 1; S.eastBurn++; }
        }
      }
    }

    // ---- 1j. the wood above the rim singes to a wandering depth ----
    // Step 1's wobble pulls the fade back into bays, and above the rim from x 27 to x 52 a bay ran the whole way: the
    // wood stood green down to the ash that drifts over the rim in rows 92-94, so on the world map the Ashfields' top was
    // one ruled row 50 tiles long. Every column now singes to its own depth above row 92 (1 to 7 rows, a slow noise and a
    // quick one): cinders nearest the ash, then singed straw, then dry grass, and the trees in it charred. Open for open,
    // solid for solid; rows 93-94 are left as 39-worldblend and 58-underground want them (ash and grass both there).
    S.aboveRim = 0; AE.rimDepth = [];
    for (let x = 1; x <= 99; x++) {
      const depth = clamp(1.2 + CREST(x, 21.5) * 4.6 + (JIT(x, 31.3) - 0.5) * 2.8, 1, 7);
      AE.rimDepth[x] = depth;
      for (let k = 0; k <= Math.ceil(depth) + 1; k++) {
        const y = 92 - k, i = I(x, y), t = at(x, y); if (!free(x, y)) continue;
        if (GREEN.has(t) || (t === DRY && k <= depth - 1)) {
          const to = k <= depth - 2.5 ? (PICK(x, y) < 0.7 ? CINDERS : SINGED) : k <= depth - 1 ? (PICK(x, y) < 0.35 ? CINDERS : SINGED) : k <= depth ? (PICK(x, y) < 0.7 ? SINGED : DRY) : (PICK(x, y) < 0.5 ? DRY : null);
          if (to !== null && to !== t) { set(x, y, to); band[i] = 1; S.aboveRim++; }
        } else if (TREES.has(t) && k <= depth && hsh(x, y, 720) < (k <= depth - 1.5 ? 0.85 : 0.45)) { set(x, y, CHAR); band[i] = 1; S.aboveRim++; }
      }
    }

    // ---- 1h. no living green right against the grey ----
    // Around the whole burnt country (and the ash that drifts over the rim into Wolfwood's last rows) a green tree or a
    // square of grass stood against ash or scorch in places: a grove on the south side touching the ash, a live tree in
    // the drift above the rim, the map's tree border at x 0 green all down the lair's west side. Trees burn by how near
    // the grey they stand (always within a tile and a half, then less and less out to three and a half), grass that
    // touches the grey singes, and the tree border beside burnt ground is charred. Solid for solid and open for open,
    // so no path changes; the guards in `free` still hold (the tree border is only ever charred, never opened).
    S.nearGrey = 0; S.greySinged = 0; S.borderCharred = 0;
    { const GREY = new Set([ASH, SCORCH, CRAG].filter(v => v >= 0)), RX0 = 0, RX1 = 116, RY0 = 84, RY1 = 172;
      const dG = new Float32Array(W * H).fill(1e6);
      for (let y = RY0; y <= RY1; y++) for (let x = RX0; x <= RX1; x++) if (GREY.has(at(x, y))) dG[I(x, y)] = 0;
      const rel = (i, j, c) => { if (dG[j] + c < dG[i]) dG[i] = dG[j] + c; };
      for (let y = RY0; y <= RY1; y++) for (let x = RX0; x <= RX1; x++) { const i = I(x, y); if (x > RX0) rel(i, i - 1, 1); if (y > RY0) { rel(i, i - W, 1); if (x > RX0) rel(i, i - W - 1, 1.414); if (x < RX1) rel(i, i - W + 1, 1.414); } }
      for (let y = RY1; y >= RY0; y--) for (let x = RX1; x >= RX0; x--) { const i = I(x, y); if (x < RX1) rel(i, i + 1, 1); if (y < RY1) { rel(i, i + W, 1); if (x < RX1) rel(i, i + W + 1, 1.414); if (x > RX0) rel(i, i + W - 1, 1.414); } }
      for (let y = RY0; y <= RY1; y++) for (let x = RX0; x <= RX1; x++) {
        const i = I(x, y), t = at(x, y), d = dG[i];
        if (x === 0) {
          // the tree border: charred where the ground beside it is burnt (x 0 is never opened, only its tree changes)
          const n = at(1, y);
          if (TREES.has(t) && (GREY.has(n) || n === CINDERS || n === CHAR || n === DEADTREE || n === T.WALL || n === CRAG || n === SINGED)) { set(x, y, CHAR); band[i] = 1; S.borderCharred++; }
          continue;
        }
        // (east of the jungle's wall step 1f already burns the jungle to its own wandering depth, which its check holds to)
        if (!free(x, y) || d > 3.6 || x > 100) continue;
        const burn = d <= 1.5 ? 1 : d <= 2.5 ? 0.7 : 0.35;
        if (TREES.has(t) && hsh(x, y, 700) < burn) { set(x, y, CHAR); band[i] = 1; big[i] = t === JUNGLE ? 1 : 0; S.nearGrey++; }
        // (grass above the rim is left as it is: 39-worldblend holds that ash and grass both still stand in rows 93-99,
        // and the ragged fronts drawn over it already carry the ash into it)
        else if (GREEN.has(t) && d <= 1 && y >= 96) { set(x, y, PICK(x, y) < 0.5 ? CINDERS : SINGED); band[i] = 1; S.greySinged++; }
      }
    }

    // ---- 1i. the jungle's wall at x 100 is not one row of the same tree ----
    // 39-worldblend's column of solid giants has to stay solid (nobody walks between the jungle and dragon country),
    // but a burnt giant on every tile of it read as a fence. A share of it is a heap of volcanic rock instead, and the
    // rest is drawn with more room to lean (see drawCharTree). Solid for solid.
    S.wallRock = 0;
    for (let y = 96; y <= 138; y++) if (at(100, y) === CHAR && hsh(100, y, 710) < 0.24) { set(100, y, CRAG); band[I(100, y)] = 1; S.wallRock++; }

    // ---- 1g. nothing walled off ----
    // The local test in `canStand` keeps the open tiles round a new rock joined, but it cannot see that the tile it
    // leaves open was itself shut in by trees: the rim's crest took the last reachable sides of a rock at 35,94 that way,
    // leaving it only a side on a patch of grass ringed by trees. So the whole map is walked the way 92-worldshape's
    // self-test walks it (from the cave's mouth, trees solid, bridges, the warden's gate and the scarp's steps open),
    // before this pass and after it. Anything he could reach before (ground, or a side of an iron, rock or berry bush)
    // that he cannot now gets back the nearest tile this pass made solid, until nothing is lost.
    { const STEPS_T = Tn('SCARP_STEPS');
      const passT = t => !SOLID.has(t) || PUSH_THROUGH.has(t) || t === WARDEN_GATE || t === STEPS_T;
      const flood = get => { const seen = new Uint8Array(W * H), q = [];
        const push = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = I(x, y); if (seen[i] || !passT(get(i))) return; seen[i] = 1; q.push(i); };
        push(CAVE_EXIT_X + 1, 7);
        for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % W, y = (c / W) | 0; for (const [dx, dy] of N4) push(x + dx, y + dy); }
        return seen; };
      const KINDS = new Set([T.IRON, T.ROCK, T.BERRY_BUSH].filter(v => v !== undefined && v >= 0));
      const was = flood(i => pre[i]);
      const side = (seen, x, y) => N4.some(([dx, dy]) => inMap(x + dx, y + dy) && seen[I(x + dx, y + dy)]);
      S.unwalled = 0; S.unwalledAt = [];
      for (let round = 0; round < 400; round++) {
        const now = flood(i => at(i % W, (i / W) | 0));
        let lost = -1;
        for (let i = 0; i < W * H && lost < 0; i++) { const x = i % W, y = (i / W) | 0, t = at(x, y);
          if ((was[i] && !now[i] && passT(t)) || (KINDS.has(t) && pre[i] === t && side(was, x, y) && !side(now, x, y))) lost = i; }
        if (lost < 0) break;
        const lx = lost % W, ly = (lost / W) | 0;
        let best = -1, bd = 1e9;
        for (let k = 0; k < placed.length; k++) { const [x, y, , t] = placed[k]; if (at(x, y) !== t) continue; const d = Math.hypot(x - lx, y - ly); if (d < bd) { bd = d; best = k; } }
        if (best < 0) break;
        // (green or dry grass given back beside the rock would be a lime square in the ridge: it comes back as straw)
        const [bx, by, was0] = placed[best]; set(bx, by, was0 === DRY || GREEN.has(was0) ? SINGED : was0); band[I(bx, by)] = 0; S.unwalled++; if (S.unwalledAt.length < 12) S.unwalledAt.push(`${bx},${by} for ${lx},${ly}`);
      }
    }

    // within four tiles of the band or the burnt country, for the draw pass: a dirt clearing there has ragged edges too
    { const near = AE.near = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!band[I(x, y)] && !land[I(x, y)]) continue;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H) near[I(nx, ny)] = 1; } } }

    // the band's bounding box, so the draw pass can skip the whole thing when the camera is elsewhere
    { let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (band[I(x, y)]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      AE.box = S.box = x1 >= 0 ? { x0, y0, x1, y1 } : null; }
  });

  // ---------- use ----------
  HOOKS.use.push(t => {
    if (t === CHAR) { notify('A burnt tree. The fire took everything worth cutting.'); return true; }
    if (t === CRAG) { notify('Black volcanic rock, still warm.'); return true; }
    return false;
  });

  // ---------- draw ----------
  function drawCharTree(g, tx, ty) {
    // every burnt tree stands a little off its tile's centre and at its own size, so a column of them (the jungle's
    // wall at x 100) reads as trees, not as a fence of identical trunks on a ruler
    // (on the jungle's wall at x 100, where they stand in one column, a good deal more)
    const wall = tx === 100, ox = (hsh(tx, ty, 1) - 0.5) * (wall ? 40 : 22), oy = (hsh(tx, ty, 2) - 0.5) * (wall ? 16 : 10), sc = (wall ? 0.7 : 0.84) + hsh(tx, ty, 3) * (wall ? 0.5 : 0.32);
    const big = AE.big && AE.big[idx(tx, ty)], s = big ? sc * 1.3 : sc, bx = tc(tx), by = tc(ty) + 14;
    g.save(); g.translate(bx + ox, by + oy); g.scale(s, s); g.translate(-bx, -by);
    // (a burnt jungle giant is the same tree, a third again as big, never a stump)
    drawCharTreeAt(g, tx, ty, !big && (tx * 73 + ty * 37) % 7 < 3);
    g.restore();
  }
  // the Ashfields' rim, drawn as a ridge of rounded boulders over 92-worldshape's coursed face: the face's top and
  // foot were straight tile edges, so a crest that climbs a row still read as steps. The boulders overlap the tile's
  // sides, poke above it by a height that differs tile to tile where the tile above is not rock, and spill scree
  // onto the ground where the tile below is not rock. Only the rim (x 1-100, rows 88-101) is redrawn.
  const RIDGE_FACE = ['#6b6157', '#655c53', '#71675c', '#5f574e'];
  function blob(g, cx, cy, rx, ry, seed, tx, ty) {
    g.beginPath();
    for (let a = 0; a < 9; a++) { const ang = a / 9 * Math.PI * 2, q = 0.8 + hsh(tx, ty, seed + a) * 0.28; const px = cx + Math.cos(ang) * rx * q, py = cy + Math.sin(ang) * ry * q; a ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath(); g.fill();
  }
  function drawRidge(g, tx, ty, top, bot, left, right) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#58504a'; g.fillRect(x, y, TILE, TILE);
    // the face: boulders across the tile, reaching a little past it on every side
    const F = [[0.12, 0.28, 15], [0.5, 0.2, 16], [0.9, 0.3, 15], [0.28, 0.66, 16], [0.72, 0.62, 16], [0.08, 0.9, 12], [0.5, 0.92, 13], [0.94, 0.88, 12]];
    for (let k = 0; k < F.length; k++) {
      const [fx, fy, r] = F[k], cx = x + fx * TILE + (hsh(tx, ty, 10 + k) - 0.5) * 8, cy = y + fy * TILE + (hsh(tx, ty, 20 + k) - 0.5) * 6, rr = r * (0.85 + hsh(tx, ty, 30 + k) * 0.3);
      g.fillStyle = RIDGE_FACE[(k + tx + ty) % 4]; blob(g, cx, cy, rr, rr * 0.82, 40 + k * 9, tx, ty);
      g.fillStyle = 'rgba(255,245,230,0.08)'; g.beginPath(); g.ellipse(cx - rr * 0.25, cy - rr * 0.35, rr * 0.5, rr * 0.25, -0.4, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(cx + rr * 0.15, cy + rr * 0.45, rr * 0.6, rr * 0.2, 0, 0, 7); g.fill();
    }
    // a crack or two
    g.strokeStyle = 'rgba(40,34,30,0.45)'; g.lineWidth = 1.3; g.beginPath();
    const c0 = x + 8 + hsh(tx, ty, 90) * 32; g.moveTo(c0, y + 10); g.lineTo(c0 + (hsh(tx, ty, 91) - 0.5) * 12, y + 26); g.lineTo(c0 + (hsh(tx, ty, 92) - 0.5) * 16, y + 40); g.stroke();
    if (left || right) {
      // an end of the rock: boulders spill past the side onto the ground
      for (const side of [left ? -1 : 0, right ? 1 : 0]) { if (!side) continue;
        for (let k = 0; k < 3; k++) { const cx = x + (side < 0 ? 2 : TILE - 2) + side * hsh(tx, ty, 100 + k) * 6, cy = y + 8 + k * 16 + (hsh(tx, ty, 110 + k) - 0.5) * 6, rr = 9 + hsh(tx, ty, 120 + k) * 5;
          g.fillStyle = RIDGE_FACE[(k + 1) % 4]; blob(g, cx, cy, rr, rr * 0.85, 130 + k * 9, tx, ty); } }
    }
    if (top) {
      // the crest: boulders standing proud of the tile by a height that differs tile to tile, dusted with ash
      const lift = 2 + hsh(tx, ty, 200) * 13;
      for (let k = 0; k < 4; k++) {
        const cx = x + (0.05 + k * 0.3) * TILE + (hsh(tx, ty, 210 + k) - 0.5) * 8, rr = 10 + hsh(tx, ty, 220 + k) * 6, cy = y + 6 - lift * (0.45 + hsh(tx, ty, 230 + k) * 0.55);
        g.fillStyle = k % 2 ? '#7a7065' : '#72685d'; blob(g, cx, cy, rr, rr * 0.8, 240 + k * 9, tx, ty);
        g.fillStyle = 'rgba(214,208,198,0.22)'; g.beginPath(); g.ellipse(cx - rr * 0.1, cy - rr * 0.45, rr * 0.7, rr * 0.28, 0, 0, 7); g.fill();
      }
    }
    if (bot) {
      // the foot: fallen boulders heaped out onto the ash by a distance that differs tile to tile (0-3 of them, reaching
      // up to 26 pixels out), their shadow, and scree beyond. A foot that stayed on one row for ten tiles was a ruled
      // line of shadow; the heaps give it bays and spurs.
      const heap = Math.floor(hsh(tx, ty, 340) * 4), reach = 4 + hsh(tx, ty, 341) * 18;
      const gr = g.createLinearGradient(0, y + TILE - 3, 0, y + TILE + reach + 8); gr.addColorStop(0, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x + TILE / 2, y + TILE - 3, TILE * 0.62, reach + 10, 0, 0, Math.PI); g.fill();
      for (let k = 0; k < heap; k++) { const cx = x + 6 + hsh(tx, ty, 350 + k) * (TILE - 12), cy = y + TILE - 4 + hsh(tx, ty, 360 + k) * reach, rr = 7 + hsh(tx, ty, 370 + k) * 7;
        g.fillStyle = RIDGE_FACE[(k + 2) % 4]; blob(g, cx, cy, rr, rr * 0.78, 380 + k * 9, tx, ty);
        g.fillStyle = 'rgba(255,245,230,0.08)'; g.beginPath(); g.ellipse(cx - rr * 0.25, cy - rr * 0.35, rr * 0.5, rr * 0.25, -0.4, 0, 7); g.fill(); }
      for (let k = 0; k < 5; k++) { const cx = x + 3 + hsh(tx, ty, 300 + k) * (TILE - 6), cy = y + TILE + 1 + hsh(tx, ty, 310 + k) * (reach + 6), rr = 2.5 + hsh(tx, ty, 320 + k) * 3.5;
        g.fillStyle = RIDGE_FACE[k % 4]; blob(g, cx, cy, rr, rr * 0.75, 330 + k * 9, tx, ty); }
    }
  }
  function drawCharTreeAt(g, tx, ty, stump) {
    const cx = tc(tx), cy = tc(ty) + 8, h = (tx * 73 + ty * 37) % 7, lean = (h - 3) * 1.2;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 6, stump ? 11 : 13, 5, 0, 0, 7); g.fill();
    if (stump) {
      // a charred stump: short, split top, black rings
      g.fillStyle = '#2f2622'; g.beginPath(); g.moveTo(cx - 9, cy + 6); g.lineTo(cx - 8, cy - 8); g.lineTo(cx - 4, cy - 4); g.lineTo(cx - 1, cy - 12); g.lineTo(cx + 3, cy - 6); g.lineTo(cx + 8, cy - 10); g.lineTo(cx + 9, cy + 6); g.closePath(); g.fill();
      g.strokeStyle = '#1c1715'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - 5, cy + 4); g.lineTo(cx - 4, cy - 3); g.moveTo(cx + 4, cy + 4); g.lineTo(cx + 5, cy - 4); g.stroke();
      g.fillStyle = `rgba(255,120,40,${0.25 + Math.sin(time * 2.6 + tx * 3) * 0.2})`; g.beginPath(); g.arc(cx + 1, cy - 6, 1.4, 0, 7); g.fill();
      return;
    }
    // a charred tree: black trunk, snapped branches, the bark split
    g.strokeStyle = '#2b2320'; g.lineCap = 'round'; g.lineWidth = 8; g.beginPath(); g.moveTo(cx, cy + 6); g.lineTo(cx + lean, cy - 26); g.stroke();
    g.lineWidth = 3.5; g.beginPath();
    g.moveTo(cx + lean * 0.4, cy - 10); g.lineTo(cx - 13, cy - 22); g.lineTo(cx - 16, cy - 20);
    g.moveTo(cx + lean, cy - 26); g.lineTo(cx + 11, cy - 38);
    g.moveTo(cx + lean * 0.8, cy - 20); g.lineTo(cx + 14, cy - 24);
    g.moveTo(cx + lean, cy - 26); g.lineTo(cx - 4, cy - 40); g.stroke();
    g.strokeStyle = 'rgba(120,100,90,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 2, cy + 4); g.lineTo(cx - 2 + lean * 0.8, cy - 20); g.stroke();
    g.fillStyle = `rgba(255,120,40,${0.25 + Math.sin(time * 3 + tx * 2) * 0.2})`; g.beginPath(); g.arc(cx + lean * 0.6, cy - 16, 1.5, 0, 7); g.fill();
  }
  // a crag: a heap of dark volcanic boulders that spills past its tile, so the rock mass has no ruled edge
  // (each heap has its own count, sizes and offsets, and reaches into the tiles round it, so a field of crags is one
  // broken rock mass; a fixed three-lump heap on every tile read as a grid)
  // (a shade lighter than the scorch they stand on, with a dark edge, so the heap reads as rock and not as more scorch)
  const CRAG_COL = ['#4a4144', '#554a4c', '#41393b', '#5c5052'];
  function drawCrag(g, tx, ty) {
    // (a heap stands well off its tile's centre, so a field of them has no rows)
    let cx = tc(tx) + (hsh(tx, ty, 400) - 0.5) * 30, cy = tc(ty) + (hsh(tx, ty, 401) - 0.5) * 24; const n = 3 + Math.floor(hsh(tx, ty, 402) * 3);
    // a heap against the lair's outer wall leans on it: shifted toward the wall and up its face by its own amount, so
    // the foot of the wall is buried to a different height all along instead of standing clean out of the ground
    for (const [dx, dy] of N4) { const wx = tx + dx, wy = ty + dy;
      if (!inMap(wx, wy) || map[idx(wx, wy)] !== T.WALL || !(wx === LAIR.x0 || wx === LAIR.x1 || wy === LAIR.y0 || wy === LAIR.y1)) continue;
      const lean = 10 + hsh(tx, ty, 405) * 24; cx = tc(tx) + dx * lean + (dx ? 0 : (hsh(tx, ty, 400) - 0.5) * 30); cy = tc(ty) + dy * lean + (dy ? 0 : (hsh(tx, ty, 401) - 0.5) * 24); break; }
    g.fillStyle = 'rgba(0,0,0,0.26)'; g.beginPath(); g.ellipse(cx, cy + 14, 26 + hsh(tx, ty, 403) * 8, 9, 0, 0, 7); g.fill();
    for (let k = 0; k < n; k++) {
      const a = hsh(tx, ty, 410 + k) * Math.PI * 2, d = hsh(tx, ty, 420 + k) * 16, r = 9 + hsh(tx, ty, 430 + k) * (k === 0 ? 12 : 8);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.7 - (k === 0 ? 6 : 0);
      g.fillStyle = 'rgba(20,16,18,0.55)'; blob(g, x + 1, y + 2, r + 1.5, r * 0.8 + 1.5, 440 + k * 11, tx, ty);
      g.fillStyle = CRAG_COL[(k + tx * 3 + ty) % 4]; blob(g, x, y, r, r * 0.8, 440 + k * 11, tx, ty);
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.35, r * 0.45, r * 0.22, -0.4, 0, 7); g.fill();
    }
    if (hsh(tx, ty, 404) < 0.35) { g.strokeStyle = `rgba(255,110,40,${0.35 + Math.sin(time * 2 + tx) * 0.15})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - 6, cy - 2); g.lineTo(cx, cy + 4); g.lineTo(cx + 5, cy + 1); g.stroke(); }
  }
  // rubble fallen from the lair's walls: dark stones on the scorched ground at their foot
  function drawRubble(g, tx, ty, dx, dy) {
    const cx = tc(tx) + dx * 12, cy = tc(ty) + dy * 12, h = (tx * 19 + ty * 31) % 4;
    const stones = [[-9, 2, 6], [3, 5, 5], [9, -3, 4], [-2, -5, 4], [-12, -6, 3]].slice(0, 3 + h % 3);
    for (const [ox, oy, r] of stones) { g.fillStyle = h % 2 ? '#3b3436' : '#48403f'; g.beginPath(); g.ellipse(cx + ox, cy + oy, r * 1.2, r, (ox + oy) * 0.1, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke(); }
  }
  // where the river runs dry: a lip of mud over its square end, and reeds
  function drawMudLip(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, cy = y + TILE / 2;
    const gr = g.createRadialGradient(x - 4, cy, 4, x - 4, cy, TILE * 0.95);
    gr.addColorStop(0, 'rgba(127,108,82,1)'); gr.addColorStop(0.55, 'rgba(127,108,82,0.8)'); gr.addColorStop(1, 'rgba(127,108,82,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x - 4, cy, TILE * 0.95, TILE * 0.7, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(70,120,160,0.25)'; g.beginPath(); g.ellipse(x + TILE * 0.55, cy, TILE * 0.3, TILE * 0.18, 0, 0, 7); g.fill();
  }
  function drawReeds(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const bx = x + 4 + hsh(tx, ty, 500 + k) * 26, by = y + 10 + hsh(tx, ty, 510 + k) * 30, h = 10 + hsh(tx, ty, 520 + k) * 12, lean = (hsh(tx, ty, 530 + k) - 0.5) * 6;
      g.strokeStyle = k % 3 ? '#8a7a48' : '#5f6a38'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + lean * 0.3, by - h * 0.6, bx + lean, by - h); g.stroke();
      if (k % 3 === 0) { g.fillStyle = '#5a3f2a'; g.beginPath(); g.ellipse(bx + lean, by - h, 1.6, 3.4, 0, 0, 7); g.fill(); }
    }
  }
  function drawSmoke(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    for (let k = 0; k < 2; k++) {
      const ph = (time * 0.28 + tx * 0.13 + ty * 0.07 + k * 0.5) % 1;
      g.fillStyle = `rgba(118,116,122,${0.24 * (1 - ph)})`; g.beginPath(); g.arc(cx + Math.sin(time * 0.9 + tx + k) * 7, cy - 6 - ph * 46, 5 + ph * 12, 0, 7); g.fill();
    }
  }
  // the ground colour of each kind the band mixes, for the feathered edge between them
  const GROUND_COL = {};
  { const c = (t, col) => { if (t >= 0) GROUND_COL[t] = col; };
    c(T.GRASS, '#57a03c'); c(T.FLOWERS, '#57a03c'); c(T.MUSHROOM, '#57a03c'); c(FERN, '#4a9140'); c(DRY, '#7e9a3e'); c(SINGED, '#928650');
    c(CINDERS, '#70685a'); c(ASH, '#5d5f66'); c(SCORCH, '#35302d'); c(T.DIRT, '#8e6b43'); c(CHAR, '#70685a'); c(DRYBED, '#7f6c52'); c(CRAG, '#35302d'); }
  const FEATHER = 12, strips = {};
  const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
  const strip = (c, side) => {
    const k = c + side; if (strips[k]) return strips[k];
    const cv = document.createElement('canvas'), horiz = side === 0 || side === 2;
    cv.width = horiz ? TILE : FEATHER; cv.height = horiz ? FEATHER : TILE;
    const sg = cv.getContext('2d');
    const gr = horiz ? sg.createLinearGradient(0, side === 0 ? 0 : FEATHER, 0, side === 0 ? FEATHER : 0) : sg.createLinearGradient(side === 3 ? 0 : FEATHER, 0, side === 3 ? FEATHER : 0, 0);
    gr.addColorStop(0, rgba(c, 0.55)); gr.addColorStop(1, rgba(c, 0));
    sg.fillStyle = gr; sg.fillRect(0, 0, cv.width, cv.height);
    return strips[k] = cv;
  };
  const SOFT_GROUND = new Set([DRY, SINGED, CINDERS, DRYBED]);
  const PROPPED = new Set([T.ROCK, T.IRON, T.COAL, T.STUMP, T.RUBBLE, T.BERRY_BUSH].filter(v => v !== undefined));
  const FENCED = new Set([T.FENCE, T.GATE].filter(v => v !== undefined));
  const GREEN_T = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, FERN, T.TREE, T.OAK, JUNGLE].filter(v => v !== undefined && v >= 0));
  const BURNT_TEX = {};
  { const b = (t, k) => { if (t !== undefined && t >= 0) BURNT_TEX[t] = k; };
    b(ASH, 'cave'); b(SCORCH, 'scorch'); b(CINDERS, 'afcinders'); b(SINGED, 'afsinged'); b(DRY, 'afdry'); b(T.DIRT, 'dirt'); b(CHAR, 'afcinders'); b(DRYBED, 'afbed'); b(CRAG, 'scorch'); b(RIM, 'cave'); b(DEADTREE, 'cave'); b(Tn('OBSIDIAN'), 'cave'); }
  // ---- the ragged edge between two kinds of ground ----
  // Every kind of ground here is a square tile, so a patch of scorch in the ash, a field of straw, or the singed grass
  // meeting the green read as squares and staircases however the tiles were chosen. Where a tile meets a more burnt
  // kind, the more burnt ground creeps into it as a tongue of its own texture with a wandering, soft-edged front:
  // the fire's side always wins, so ash eats into cinders, cinders into straw, straw into grass. The front's depth at
  // each tile corner comes from that corner (two tiles sharing it agree), so a long edge is one wandering line with
  // no step at the tile seams. Lava, water, walls and rock never take part: a hazard's edge stays exact.
  const PRI = {};
  { const p = (t, v) => { if (t !== undefined && t >= 0) PRI[t] = v; };
    // (a rock, an ore or a berry bush stands on grass: its ground takes part as grass, so it is not left a green square
    // in the straw; stumps, rubble and fences are drawn in the ground pass, so the fronts would paint over them)
    for (const t of [T.GRASS, T.FLOWERS, T.MUSHROOM, FERN, T.TREE, T.OAK, JUNGLE, T.ROCK, T.IRON, T.COAL, T.BERRY_BUSH, Tn('BLACKIRON'), Tn('SUNSTONE'), Tn('STORMSTONE')]) p(t, 0);
    p(DRY, 1); p(SINGED, 2); p(CINDERS, 4); p(CHAR, 4); p(T.DIRT, 5); p(ASH, 6); p(DEADTREE, 6); p(SCORCH, 7); p(CRAG, 7);
    // (the dry riverbed spreads into the ash rather than being eaten by it, so it stays one wandering channel)
    p(DRYBED, 6.5); }
  const TS = 64, TONGUE_END = [6, 19];
  const tongueMasks = {}, tongues = {}; let tongueCount = 0;
  // depth of the front (in tile pixels) along a side, from one corner's end depth to the other's, with a wander between
  const front = (e0, e1, m, a) => {
    const w = a / TILE, base = e0 + (e1 - e0) * w;
    const mid = m === 0 ? 10 * Math.sin(Math.PI * w) - 5 * Math.sin(2 * Math.PI * w) + 3 * Math.sin(3 * Math.PI * w)
      : m === 1 ? -5 * Math.sin(Math.PI * w) + 8 * Math.sin(2 * Math.PI * w) + 3 * Math.sin(5 * Math.PI * w)
        : 13 * Math.sin(Math.PI * w) + 3 * Math.sin(4 * Math.PI * w);
    return clamp(base + mid, 3, 34);
  };
  const tongueMask = (side, prof) => {
    const k = side * 16 + prof; if (tongueMasks[k]) return tongueMasks[k];
    const cv = document.createElement('canvas'); cv.width = TS; cv.height = TS;
    const mg = cv.getContext('2d'), img = mg.getImageData(0, 0, TS, TS), d = img.data, e0 = TONGUE_END[prof >> 2 & 1], e1 = TONGUE_END[prof >> 1 & 1], m = prof & 1 ? 1 : (prof >> 3) ? 2 : 0;
    for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
      const u = (px + 0.5) * TILE / TS, v = (py + 0.5) * TILE / TS;
      // distance in from the side, and how far along it from its first corner (left for top/bottom, top for left/right)
      const dist = side === 0 ? v : side === 1 ? TILE - u : side === 2 ? TILE - v : u, along = side === 0 || side === 2 ? u : v;
      const f = front(e0, e1, m, along), q = clamp((f - dist) / 7 + 0.5, 0, 1), o = (py * TS + px) * 4;
      d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(q * q * (3 - 2 * q) * 255);
    }
    mg.putImageData(img, 0, 0);
    return tongueMasks[k] = cv;
  };
  const tongue = (texKey, side, prof) => {
    const k = texKey + '|' + side + '|' + prof; if (tongues[k]) return tongues[k];
    const src = tex[texKey]; if (!src) return null;
    // (a cap on what is kept: every combination met is built once, and the lot is let go if a long walk piles them up)
    if (++tongueCount > 480) { for (const j in tongues) delete tongues[j]; tongueCount = 1; }
    const cv = document.createElement('canvas'); cv.width = TS; cv.height = TS;
    const tg = cv.getContext('2d'); tg.drawImage(src, 0, 0, TS, TS);
    tg.globalCompositeOperation = 'destination-in'; tg.drawImage(tongueMask(side, prof), 0, 0); tg.globalCompositeOperation = 'source-over';
    return tongues[k] = cv;
  };
  // grass kept beside the rim's rock (drawn as singed straw, and taking part in the fronts as straw)
  const rimGrass = (tx, ty, t) => t === T.GRASS && ty >= 92 && ty <= 94 && tx <= 100 && N4.some(([dx, dy]) => map[idx(tx + dx, ty + dy)] === RIM);
  const priAt = (tx, ty, t) => rimGrass(tx, ty, t) ? PRI[SINGED] : PRI[t];
  AE.tongueStats = () => ({ masks: Object.keys(tongueMasks).length, tongues: Object.keys(tongues).length });
  HOOKS.draw.push((g, items, cam) => {
    // (everything here is read against the overworld's masks, so inside an instance, which is written over the map's
    // top-left corner, none of it applies)
    if (window.__instance) return;
    const B = AE.box; if (!B || !AE.band) return;
    const x0 = Math.max(B.x0 - 1, Math.floor(cam.x / TILE) - 1), x1 = Math.min(B.x1 + 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(B.y0 - 1, Math.floor(cam.y / TILE) - 1), y1 = Math.min(B.y1 + 1, Math.ceil((cam.y + VH) / TILE) + 2);
    if (x0 > x1 || y0 > y1) return;
    const band = AE.band;
    // a rock, a stump or an ore standing in burnt ground: the core paints grass under it (its texture is grass), which
    // left green squares all over the ash. Here the ground under it is painted as the burnt ground round it.
    items.push({ y: -1e9 + 0.5, draw: () => {
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!inMap(tx, ty)) continue;
        const t = map[idx(tx, ty)];
        // (the few squares of grass 39-worldblend keeps in rows 93-94 for its dithered seam stand in the rim's rock:
        // bright green squares pasted into the ridge. The tile stays grass; its ground is drawn as singed straw)
        if (rimGrass(tx, ty, t)) {
          const img = tex['afsinged' + variant[idx(tx, ty)]]; if (img) g.drawImage(img, tx * TILE, ty * TILE, TILE, TILE); continue; }
        if (TEX_NAME[t] !== 'grass' || GREEN_T.has(t)) continue;
        const land = AE.land && AE.land[idx(tx, ty)];
        if (!land && (!SOLID.has(t) || !PROPPED.has(t))) continue;
        let burnt = null, green = 0, burntN = 0;
        for (const [dx, dy] of N4) { if (!inMap(tx + dx, ty + dy)) continue; const n = map[idx(tx + dx, ty + dy)];
          if (GREEN_T.has(n)) green++; else if (BURNT_TEX[n]) { burntN++; if (!burnt) burnt = BURNT_TEX[n]; } }
        // inside the burnt country anything standing on grass texture (Dunstan's fence and gate, a rock, an ore) stands
        // on the burnt ground round it (the fence on trodden dirt): a ring of green round his field read as pasted on
        if (land) { if (buildingAt(tx, ty)) continue; burnt = FENCED.has(t) ? 'dirt' : burnt || 'cave'; }
        else if (!burnt || burntN < 2 || green > 1) continue;
        const img = tex[burnt + variant[idx(tx, ty)]]; if (img) g.drawImage(img, tx * TILE, ty * TILE, TILE, TILE);
        // (the core draws these props in its ground pass, so painting the ground over them hid them: draw them again)
        if (t === T.FENCE || t === T.GATE) drawFenceProp(g, tx, ty, t === T.GATE);
        else if (t === T.RUBBLE) drawRubbleProp(g, tx, ty);
        else if (t === T.STUMP) drawStumpProp(g, tx, ty);
      }
    } });
    // the ragged fronts (after the ground under the props, before the colour strips that soften them further)
    items.push({ y: -1e9 + 0.8, draw: () => {
      const land = AE.land;
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!inMap(tx, ty)) continue;
        // (no building check: a building's own tiles are floor and wall, which take no part, and its roof covers the rest)
        const i = idx(tx, ty), t = map[i], mine = priAt(tx, ty, t); if (mine === undefined) continue;
        const px = tx * TILE, py = ty * TILE;
        for (let s = 0; s < 4; s++) {
          const nx = tx + (s === 1 ? 1 : s === 3 ? -1 : 0), ny = ty + (s === 0 ? -1 : s === 2 ? 1 : 0);
          if (!inMap(nx, ny)) continue;
          const j = idx(nx, ny), n = map[j], theirs = priAt(nx, ny, n);
          if (theirs === undefined || theirs <= mine) continue;
          // (on the dressed band and in the burnt country; elsewhere wherever one side is burnt ground, such as the ash
          // that drifts over the rim; a dirt road meeting grass far off in Wolfwood is left as the rest of the world draws it)
          if (!band[i] && !band[j] && !(land && (land[i] || land[j])) && (theirs < 2 || n === T.DIRT) && !(AE.near && AE.near[i])) continue;
          // the two corners of this side, in world coordinates, pick its end depths; the tile picks the wander between
          const c0x = s === 1 ? tx + 1 : tx, c0y = s === 2 ? ty + 1 : ty, c1x = s === 0 || s === 2 ? c0x + 1 : c0x, c1y = s === 0 || s === 2 ? c0y : c0y + 1;
          const prof = (hsh(c0x, c0y, 600 + (s & 1)) < 0.5 ? 0 : 4) | (hsh(c1x, c1y, 600 + (s & 1)) < 0.5 ? 0 : 2) | (hsh(tx, ty, 610 + s) < 0.5 ? 0 : 1) | (hsh(tx, ty, 620 + s) < 0.4 ? 8 : 0);
          const img = tongue((rimGrass(nx, ny, n) ? 'afsinged' : TEX_NAME[n]) + variant[j], s, prof & 1 ? prof & 7 : prof);
          if (img) g.drawImage(img, px, py, TILE, TILE);
        }
      }
    } });
    // the feathered edge: on every band tile (and the grass beside one), a soft strip of each neighbour's ground colour
    items.push({ y: -1e9 + 1, draw: () => {
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!inMap(tx, ty)) continue;
        const t = map[idx(tx, ty)], mine = GROUND_COL[t]; if (!mine) continue;
        // (all through the burnt country, not only on the band: a lone square of dirt or scorch in the ash had four ruled
        // edges; with the strips it is a soft patch)
        const near = band[idx(tx, ty)] || SOFT_GROUND.has(t) || (AE.land && AE.land[idx(tx, ty)]);
        const px = tx * TILE, py = ty * TILE;
        for (let s = 0; s < 4; s++) {
          const nx = tx + (s === 1 ? 1 : s === 3 ? -1 : 0), ny = ty + (s === 0 ? -1 : s === 2 ? 1 : 0);
          if (!inMap(nx, ny)) continue;
          const n = map[idx(nx, ny)], c = GROUND_COL[n];
          if (!c || c === mine || n === t) continue;
          if (!near && !band[idx(nx, ny)] && !SOFT_GROUND.has(n)) continue;
          if (n === CHAR) continue;
          // (two kinds that both take part in the ragged fronts are joined by the tongue; a straight colour strip on top
          // drew the tile's square back in)
          if (PRI[t] !== undefined && PRI[n] !== undefined) continue;
          const img = strip(c, s);
          if (s === 0) g.drawImage(img, px, py); else if (s === 1) g.drawImage(img, px + TILE - FEATHER, py); else if (s === 2) g.drawImage(img, px, py + TILE - FEATHER); else g.drawImage(img, px, py);
        }
      }
    } });
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!inMap(tx, ty)) continue;
      const t = map[idx(tx, ty)];
      if (t === CRAG) { items.push({ y: ty * TILE + TILE - 6, draw: () => drawCrag(g, tx, ty) }); continue; }
      if (t === T.WATER && AE.riverEnd && Math.abs(tx - AE.riverEnd[0]) <= 4 && Math.abs(ty - AE.riverEnd[1]) <= 3 && inMap(tx - 1, ty) && map[idx(tx - 1, ty)] !== T.WATER) {
        items.push({ y: -1e9 + 2, draw: () => drawMudLip(g, tx, ty) });
        items.push({ y: ty * TILE + TILE - 8, draw: () => drawReeds(g, tx, ty) }); continue;
      }
      if (t === RIM && tx <= 100 && ty >= 88 && ty <= 101) {
        const rock = (ax, ay) => inMap(ax, ay) && map[idx(ax, ay)] === RIM;
        const top = !rock(tx, ty - 1), bot = !rock(tx, ty + 1), left = !rock(tx - 1, ty), right = !rock(tx + 1, ty);
        // (just after 92-worldshape's own item for the tile, which sits at its centre)
        items.push({ y: tc(ty) + 0.5, draw: () => drawRidge(g, tx, ty, top, bot, left, right) }); continue;
      }
      // rubble at the foot of the lair's outer walls, on the ground side
      if (!SOLID.has(t) && band[idx(tx, ty)] && (tx * 13 + ty * 7) % 3 !== 0) {
        for (const [dx, dy] of N4) { const wx = tx + dx, wy = ty + dy;
          if (map[idx(wx, wy)] !== T.WALL || !(wx === LAIR.x0 || wx === LAIR.x1 || wy === LAIR.y0 || wy === LAIR.y1)) continue;
          items.push({ y: ty * TILE + TILE / 2, draw: () => drawRubble(g, tx, ty, dx, dy) }); break; }
      }
      if (t === CHAR) { items.push({ y: ty * TILE + TILE - 4, draw: () => drawCharTree(g, tx, ty) }); if ((tx * 29 + ty * 13) % 9 === 0) items.push({ y: ty * TILE + TILE + 60, draw: () => drawSmoke(g, tx, ty) }); }
      else if ((t === CINDERS || t === SCORCH || t === CRAG) && band[idx(tx, ty)] && (tx * 31 + ty * 17) % 11 === 0) items.push({ y: ty * TILE + TILE + 60, draw: () => drawSmoke(g, tx, ty) });
    }
  });

  // ---------- self-test ----------
  const P = 'ashedge: ';
  HOOKS.selfTest.push((check, F) => {
    const S = AE.stats;
    const GREENS = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, FERN].filter(v => v >= 0));
    const GREYS = new Set([ASH, SCORCH].filter(v => v >= 0));
    const MID = new Set([DRY, SINGED, CINDERS]);
    // 1. the east side is no longer a ruled line: where the grey ends on each row wanders
    { const xs = new Set(), row = [];
      for (let y = 97; y <= 138; y++) { let last = -1; for (let x = 70; x <= 115; x++) if (GREYS.has(tileAt(x, y))) last = x; if (last >= 0) { xs.add(last); row.push(last); } }
      check(P + "the Ashfields' east side wanders (the last grey tile on rows 97-138 sits at 8 or more different columns; it sat at 3 when the side was a ruled line)", xs.size >= 8, { distinct: xs.size, cols: [...xs].sort((a, b) => a - b) }); }
    // 2. grey meets green through steps, not at a line: few ash tiles touch green directly, and the steps are there
    { let touch = 0, mid = 0, dry = 0, singed = 0, cinders = 0;
      for (let y = 80; y <= 170; y++) for (let x = 1; x <= 115; x++) {
        const t = tileAt(x, y);
        if (t === DRY) dry++; else if (t === SINGED) singed++; else if (t === CINDERS) cinders++;
        if (MID.has(t)) mid++;
        if (!GREYS.has(t)) continue;
        for (const [dx, dy] of N4) if (GREENS.has(tileAt(x + dx, y + dy))) touch++;
      }
      check(P + 'grey steps into green through dry grass, singed grass and cinders (each laid 150+ times; under 80 places where ash still touches green, from 184)', dry >= 150 && singed >= 150 && cinders >= 150 && touch < 80, { dry, singed, cinders, touch, out: S.out, inside: S.inside }); }
    // 3. nothing green inside the Ashfields' box (not even dry grass: the fringe inside is singed straw), and the edge trees are charred
    { let bad = 0; for (let y = 96; y <= 139; y++) for (let x = 0; x <= 99; x++) { const t = tileAt(x, y); if (t === DRY) bad++; }
      let charred = 0; for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (tileAt(x, y) === CHAR) charred++;
      check(P + 'no dry green grass inside the Ashfields box; charred trees stand at the edge (40+)', bad === 0 && charred >= 40, { bad, charred, standing: S.standing, refused: S.refused }); }
    // 4. the lair is not a clean box: crags lean on its east and south walls at more than one depth, and its walls, gate and approach are as they were
    { const reach = new Set(); for (let y = 108; y <= 138; y++) { let x = 35; while (tileAt(x, y) === CRAG) x++; reach.add(x - 35); }
      let south = 0; for (let x = 2; x <= 40; x++) if (tileAt(x, 139) === CRAG) south++;
      // (the gate, x 17-19 on the north wall, is left out: the story opens it)
      let walls = true; for (let x = LAIR.x0; x <= LAIR.x1; x++) for (const y of [LAIR.y0, LAIR.y1]) { if (y === LAIR.y0 && x >= 17 && x <= 19) continue; if (tileAt(x, y) !== T.WALL) walls = false; }
      for (let y = LAIR.y0; y <= LAIR.y1; y++) for (const x of [LAIR.x0, LAIR.x1]) if (tileAt(x, y) !== T.WALL) walls = false;
      let approach = true; for (let y = APPROACH.y0; y <= APPROACH.y1; y++) for (let x = APPROACH.x0; x <= APPROACH.x1; x++) if (x >= LAIR.x0 && SOLID.has(tileAt(x, y)) && !inRect(LAIR, x, y) && tileAt(x, y) !== T.WALL) approach = false;
      const path = F.bfs ? F.bfs(36, 105, 18, 107) : true;
      check(P + "the lair's east and south faces are ragged crags (3+ different depths, some on the south), its walls and gate unchanged, the approach open and walkable to the gate", reach.size >= 3 && south >= 4 && walls && approach && !!path,
        { depths: [...reach].sort(), south, walls, approach, path: path && path.length, crags: S.crags }); }
    // 5. the rim is not one ruled line: its top climbs and falls, and no long stretch keeps both top and foot level
    { const tops = [], rows = new Set(); let run = 0, longest = 0, at = null, prev = null, solid95 = 0;
      for (let x = 1; x <= 99; x++) {
        if (!(x >= 59 && x <= 61) && SOLID.has(tileAt(x, 95))) solid95++;   // (59-61: the warden's gate, which the story opens)
        if (x >= 54 && x <= 66 || tileAt(x, 95) !== RIM) { prev = null; continue; }
        let top = 95, foot = 95; while (tileAt(x, top - 1) === RIM) top--; while (tileAt(x, foot + 1) === RIM) foot++;
        tops.push(top); rows.add(top);
        const k = top + ',' + foot; if (k === prev) { run++; if (run > longest) { longest = run; at = x; } } else run = 1; prev = k;
      }
      check(P + "the Ashfields' rim is a ridge, not a ruled line: its top stands on 3+ different rows and no stretch longer than 6 tiles keeps its top and its foot level; row 95 is still solid all along (the warden's gate the one way through)",
        rows.size >= 3 && longest <= 6 && S.crest >= 40 && solid95 === 96, { topRows: [...rows].sort(), longestLevelStretch: longest, endingAtX: at, crestTiles: S.crest, solidOnRow95: solid95 }); }
    // 6. where the living jungle begins wanders from row to row along x 100
    { const GREENISH = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, FERN, T.TREE, T.OAK, JUNGLE].filter(v => v >= 0));
      const first = []; for (let y = 100; y <= 156; y++) { let x = 101; while (x < 125 && !GREENISH.has(tileAt(x, y))) x++; first.push(x); }
      let run = 1, longest = 1; for (let i = 1; i < first.length; i++) { if (first[i] === first[i - 1]) { run++; longest = Math.max(longest, run); } else run = 1; }
      let wall = 0; for (let y = 96; y <= 138; y++) if (SOLID.has(tileAt(100, y))) wall++;
      check(P + "the jungle's green begins at 6+ different columns down its edge with the Ashfields, never the same column for more than 4 rows running, and its wall at x 100 is still solid (rows 96-138)",
        new Set(first).size >= 6 && longest <= 4 && wall === 43, { firstGreenColumns: first.join(' '), longestStraight: longest, wallSolid: wall, burnt: S.eastBurn }); }
    // 7. the river from Sylvaris runs dry into the ash instead of stopping in a square end
    { const end = AE.riverEnd; let bed = 0, near = 0, solidBed = 0;
      for (let y = 120; y <= 160; y++) for (let x = 70; x <= 110; x++) if (tileAt(x, y) === DRYBED) { bed++; if (SOLID.has(DRYBED)) solidBed++; if (end && Math.abs(x - end[0]) <= 4 && Math.abs(y - end[1]) <= 3) near++; }
      check(P + "the river from Sylvaris runs on as a dry bed of cracked mud (10+ tiles, starting at the river's end), open ground all of it", !!end && bed >= 10 && near >= 1 && solidBed === 0 && !SOLID.has(DRYBED),
        { riverEnd: end, bedTiles: bed, nearTheEnd: near }); }
    // 8. nothing green below the rim, and no living tree inside the Ashfields
    { const GREENISH = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, FERN, DRY].filter(v => v >= 0)), LIVE = new Set([T.TREE, T.OAK, JUNGLE].filter(v => v >= 0));
      const green = [], trees = [];
      for (let y = 96; y <= 139; y++) for (let x = 1; x <= 99; x++) { if (buildingAt(x, y)) continue; const t = tileAt(x, y); if (GREENISH.has(t)) green.push(x + ',' + y); }
      for (let y = 96; y < MAP_H; y++) for (let x = 1; x <= 99; x++) { const r = regionAt(x, y); if (r && (r.name === 'The Ashfields' || r.name === "The Fang's Lair") && LIVE.has(tileAt(x, y))) trees.push(x + ',' + y); }
      check(P + 'no grass, fern or dry grass below the rim anywhere in the Ashfields box, and no living tree inside its outline', green.length === 0 && trees.length === 0,
        { green: green.slice(0, 10), greenCount: green.length, livingTrees: trees.slice(0, 10), livingTreeCount: trees.length, burntSeam: S.seam, charredInside: S.deepTrees }); }
    // 9. no living tree right against the grey anywhere round the burnt country (the warden's guarded ground at the gate
    // left as it is), the map's tree border burnt where it runs beside burnt ground, and nothing this pass stood on open
    // ground left anything walled off (step 1g's count of what it gave back is reported)
    { const GREY = new Set([ASH, SCORCH, CRAG].filter(v => v >= 0)), LIVE = new Set([T.TREE, T.OAK, JUNGLE].filter(v => v >= 0)), BURNT = new Set([ASH, SCORCH, CRAG, CINDERS, CHAR, DEADTREE, SINGED, T.WALL].filter(v => v >= 0));
      const near = [], border = [];
      for (let y = 84; y <= 172; y++) for (let x = 1; x <= 100; x++) {
        if (x >= 53 && x <= 68 && y >= 83 && y <= 106 || !LIVE.has(tileAt(x, y))) continue;
        let n = 0; for (const [dx, dy] of N8) if (GREY.has(tileAt(x + dx, y + dy))) n++;
        if (n) near.push(x + ',' + y); }
      for (let y = 96; y <= 139; y++) if (LIVE.has(tileAt(0, y)) && BURNT.has(tileAt(1, y))) border.push(y);
      check(P + 'no living tree stands against ash or scorch round the burnt country, and the tree border beside the lair and the ash is burnt too', near.length === 0 && border.length === 0 && S.borderCharred >= 30,
        { treesAgainstGrey: near.slice(0, 10), count: near.length, greenBorderRows: border.slice(0, 10), borderCharred: S.borderCharred, burntNearGrey: S.nearGrey, rockGivenBack: S.unwalled, givenBackAt: S.unwalledAt }); }
  });
}
