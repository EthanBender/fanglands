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
  const CHAR = addTile('AF_CHARTREE', { solid: true, tex: 'afcinders', mini: '#3f3a30' });
  const CRAG = addTile('AF_CRAG', { solid: true, tex: 'afcrag', mini: '#3b3335' });

  // ---------- smooth value noise (the same shape 39-worldblend and 92-worldshape use), 0..1 ----------
  const makeNoise = (seed, cell) => {
    const r = mulberry32(seed), N = 64, lat = new Float32Array(N * N); for (let i = 0; i < lat.length; i++) lat[i] = r();
    const at = (ix, iy) => lat[((iy % N + N) % N) * N + ((ix % N + N) % N)];
    const sm = t => t * t * (3 - 2 * t);
    const oct = (x, y, c) => { const fx = x / c, fy = y / c, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy); return lerp(lerp(at(ix, iy), at(ix + 1, iy), tx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty); };
    return (x, y) => clamp(0.5 + (oct(x, y, cell) * 0.7 + oct(x + 37.3, y + 11.7, cell / 2) * 0.3 - 0.5) * 1.7, 0, 1);
  };
  const WOB = makeNoise(SEED + 1, 11), FINE = makeNoise(SEED + 2, 3), PATCH = makeNoise(SEED + 3, 4), DEPTH = makeNoise(SEED + 4, 3.5), PICK = makeNoise(SEED + 5, 2.5), RAG = makeNoise(SEED + 6, 4);

  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], N8 = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const LAIR = { x0: 2, y0: 108, x1: 34, y1: 138 };                  // 28-thefang's box: its walls are never touched
  const APPROACH = { x0: 1, y0: 103, x1: 40, y1: 107 };              // 27-dragons keeps it open: nothing solid goes here
  const AF_BOX = { x0: 0, y0: 96, x1: 99, y1: 139 };                 // the Ashfields' box: nothing green inside it (56-ashfields), so no dry grass either
  const BAND_OUT = 9, BAND_IN = 5;                                   // how far the fade reaches out of the outline, and into it
  const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  const AE = window.ASHEDGE = { stats: {}, band: null, big: null, box: null, DRY, SINGED, CINDERS, CHAR, CRAG, BAND_OUT, BAND_IN };
  AE.FRINGE = [DRY, SINGED, CINDERS, CHAR, SCORCH].filter(v => v >= 0);   // every kind of ground this pass lays outside the Ashfields

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
    const own = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = regionAt(x, y); if (r && (r.name === 'The Ashfields' || r.name === "The Fang's Lair")) own[I(x, y)] = 1; }
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
      // (this file's own rock and dead trees, and the lair's walls, need no side: nobody works them)
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy, t = at(nx, ny); if (open(t) || t === CRAG || t === CHAR || t === T.WALL) continue;
        let sides = 0; for (const [ex, ey] of N4) { const ax = nx + ex, ay = ny + ey; if ((ax !== x || ay !== y) && inMap(ax, ay) && open(at(ax, ay))) sides++; }
        if (sides === 0) return false; }
      return true;
    };
    const stand = (x, y, t) => { if (!canStand(x, y)) { S.refused++; return false; } set(x, y, t); return true; };

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
          let burn = e < 2.5 ? 0.8 : e < 5 ? 0.42 : e < 7.5 ? 0.14 : 0;
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
          // inside it stays as it is - the Ashfields' own test wants its seam to still show green through the ash
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
      const depth = face ? 0.4 + DEPTH(x, y) * 4.8 : -0.3 + DEPTH(x, y) * 3.4;
      if (face && d <= depth - 0.4 && t !== T.DIRT && stand(x, y, CRAG)) { S.crags++; band[I(x, y)] = 1; continue; }
      let to = null;
      if (d <= depth + 0.5) to = SCORCH;
      else if (d <= depth + 1.7 && rnd() < 0.65) to = CINDERS;
      if (to !== null && t !== to && !(t === T.DIRT && nearTrack(x, y))) { set(x, y, to); S.lairDressed++; }
      if (to !== null) band[I(x, y)] = 1;
    }

    // the band's bounding box, so the draw pass can skip the whole thing when the camera is elsewhere
    { let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (band[I(x, y)]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      AE.box = S.box = x1 >= 0 ? { x0, y0, x1, y1 } : null; }
  });

  // ---------- use ----------
  HOOKS.use.push(t => {
    if (t === CHAR) { notify('A burnt tree. The fire took everything worth cutting.'); return true; }
    if (t === CRAG) { notify('Black volcanic rock, still warm. It is heaped against the lair.'); return true; }
    return false;
  });

  // ---------- draw ----------
  function drawCharTree(g, tx, ty) {
    if (AE.big && AE.big[idx(tx, ty)]) {
      // a burnt jungle giant: the same tree, a third again as big, never a stump
      g.save(); g.translate(tc(tx), tc(ty) + 14); g.scale(1.3, 1.3); g.translate(-tc(tx), -tc(ty) - 14);
      drawCharTreeAt(g, tx, ty, false); g.restore(); return;
    }
    drawCharTreeAt(g, tx, ty, (tx * 73 + ty * 37) % 7 < 3);
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
  function drawCrag(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), h = (tx * 41 + ty * 23) % 5;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, cy + 14, 24, 8, 0, 0, 7); g.fill();
    const lumps = [[-10 + h, 4, 15], [9 - h, 6, 13], [(h - 2) * 3, -8, 12]];
    for (let k = 0; k < lumps.length; k++) {
      const [ox, oy, r] = lumps[k], x = cx + ox, y = cy + oy;
      g.fillStyle = ['#3d3537', '#463d3f', '#342e30'][(k + h) % 3]; g.beginPath();
      for (let a = 0; a < 7; a++) { const ang = a / 7 * Math.PI * 2 + k, q = r * (0.72 + ((tx * 7 + ty * 3 + a * 5 + k) % 5) * 0.08); g.lineTo(x + Math.cos(ang) * q, y + Math.sin(ang) * q * 0.8); }
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.35, r * 0.45, r * 0.22, -0.4, 0, 7); g.fill();
    }
    if (h < 2) { g.strokeStyle = `rgba(255,110,40,${0.35 + Math.sin(time * 2 + tx) * 0.15})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - 6, cy - 2); g.lineTo(cx, cy + 4); g.lineTo(cx + 5, cy + 1); g.stroke(); }
  }
  // rubble fallen from the lair's walls: dark stones on the scorched ground at their foot
  function drawRubble(g, tx, ty, dx, dy) {
    const cx = tc(tx) + dx * 12, cy = tc(ty) + dy * 12, h = (tx * 19 + ty * 31) % 4;
    const stones = [[-9, 2, 6], [3, 5, 5], [9, -3, 4], [-2, -5, 4], [-12, -6, 3]].slice(0, 3 + h % 3);
    for (const [ox, oy, r] of stones) { g.fillStyle = h % 2 ? '#3b3436' : '#48403f'; g.beginPath(); g.ellipse(cx + ox, cy + oy, r * 1.2, r, (ox + oy) * 0.1, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.stroke(); }
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
    c(CINDERS, '#70685a'); c(ASH, '#5d5f66'); c(SCORCH, '#35302d'); c(T.DIRT, '#8e6b43'); c(CHAR, '#70685a'); }
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
  const SOFT_GROUND = new Set([DRY, SINGED, CINDERS]);
  const PROPPED = new Set([T.ROCK, T.IRON, T.COAL, T.STUMP, T.RUBBLE].filter(v => v !== undefined));
  const GREEN_T = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, FERN, T.TREE, T.OAK, JUNGLE].filter(v => v !== undefined && v >= 0));
  const BURNT_TEX = {};
  { const b = (t, k) => { if (t !== undefined && t >= 0) BURNT_TEX[t] = k; };
    b(ASH, 'cave'); b(SCORCH, 'scorch'); b(CINDERS, 'afcinders'); b(SINGED, 'afsinged'); b(DRY, 'afdry'); b(T.DIRT, 'dirt'); b(CHAR, 'afcinders'); b(DEADTREE, 'cave'); b(Tn('OBSIDIAN'), 'cave'); }
  HOOKS.draw.push((g, items, cam) => {
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
        const t = map[idx(tx, ty)]; if (!SOLID.has(t) || TEX_NAME[t] !== 'grass' || !PROPPED.has(t)) continue;
        let burnt = null, green = 0, burntN = 0;
        for (const [dx, dy] of N4) { if (!inMap(tx + dx, ty + dy)) continue; const n = map[idx(tx + dx, ty + dy)];
          if (GREEN_T.has(n)) green++; else if (BURNT_TEX[n]) { burntN++; if (!burnt) burnt = BURNT_TEX[n]; } }
        if (!burnt || burntN < 2 || green > 1) continue;
        const img = tex[burnt + variant[idx(tx, ty)]]; if (img) g.drawImage(img, tx * TILE, ty * TILE, TILE, TILE);
      }
    } });
    // the feathered edge: on every band tile (and the grass beside one), a soft strip of each neighbour's ground colour
    items.push({ y: -1e9 + 1, draw: () => {
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!inMap(tx, ty)) continue;
        const t = map[idx(tx, ty)], mine = GROUND_COL[t]; if (!mine) continue;
        const near = band[idx(tx, ty)] || SOFT_GROUND.has(t);
        const px = tx * TILE, py = ty * TILE;
        for (let s = 0; s < 4; s++) {
          const nx = tx + (s === 1 ? 1 : s === 3 ? -1 : 0), ny = ty + (s === 0 ? -1 : s === 2 ? 1 : 0);
          if (!inMap(nx, ny)) continue;
          const n = map[idx(nx, ny)], c = GROUND_COL[n];
          if (!c || c === mine || n === t) continue;
          if (!near && !band[idx(nx, ny)] && !SOFT_GROUND.has(n)) continue;
          if (n === CHAR) continue;
          const img = strip(c, s);
          if (s === 0) g.drawImage(img, px, py); else if (s === 1) g.drawImage(img, px + TILE - FEATHER, py); else if (s === 2) g.drawImage(img, px, py + TILE - FEATHER); else g.drawImage(img, px, py);
        }
      }
    } });
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!inMap(tx, ty)) continue;
      const t = map[idx(tx, ty)];
      if (t === CRAG) { items.push({ y: ty * TILE + TILE - 6, draw: () => drawCrag(g, tx, ty) }); continue; }
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
  });
}
