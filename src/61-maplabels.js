// ============================================================================
// THE WORLD MAP'S PLACE NAMES (the Great Spread, Stage 4b; spec ADDENDUM B)
// src/61-maplabels.js
//
// The world map panel (10-hud's drawMapPanel) names the places from ONE source: the Atlas's overworld places (each a
// REGIONS box or outline, one entry per place). The old panel drew every REGIONS name at its box's centre and every quest
// target's own words beside its ring, so on the 400 x 280 map names sat on names ("THE GREY SEA" on "IRONCLAD ISLE",
// "Hollowford" in gold over "HOLLOWFORD"), on the gold rings, and a prospector's name was printed in the Redcut.
//
// Now:
//   - one label per place, from the Atlas places (MAP_LABELS.items);
//   - laid out by priority (towns, then regions, then landmarks, then small places); each label's box is nudged (a set
//     distance at most) off the labels already placed, off every marker and quest ring, and off the key strip; a label
//     that cannot fit is DROPPED at that zoom, never drawn over another (MAP_LABELS.layout);
//   - people and things are markers, not labels: a quest ring keeps its ring; a ring on a place lights that place's own
//     name in gold instead of printing the name a second time; a ring on a person or a thing prints no words.
//
// MAP_LABELS.layout is one shared function: any screen that draws the world small (the teacher view's map) calls it with
// its own scale, rings and bounds and gets the same answer.
//
// window.MAP_LABELS = { items(), layout(items, opts), draw(g, result), textWidth(g, s, font, size), TIERS, last }
// ============================================================================
{
  // ---------- which kind of place each is (the Atlas id; anything not listed is a small place) ----------
  // 0 towns, 1 regions (the broad grounds and seas), 2 landmarks, 3 small places (the staked new places among them)
  const TOWNS = ['thistledown', 'hollowford', 'grubmarket', 'sylvaris'];
  const REGION_IDS = ['wolfwood', 'ashfields', 'jungle', 'grey_sea', 'sound', 'grub_fields', 'ash_wastes', 'far_shore', 'redcut'];
  const LANDMARKS = ['castle_thistledown', 'castle_gnash', 'brightwater', 'cave', 'grey_quarry', 'goblin_camp', 'miller_pond', 'gull_isle', 'ironclad_isle',
    'fang_lair', 'old_bridge', 'beacon_hills', 'bandit_hills', 'wreck_rock', 'skypier'];
  // the two broad grounds the map never names (as before): the open fields and the Wilds round everything
  const UNNAMED = ['goblin_fields', 'wilds'];
  const tierOf = id => TOWNS.includes(id) ? 0 : REGION_IDS.includes(id) ? 1 : LANDMARKS.includes(id) ? 2 : 3;
  const TIERS = { towns: TOWNS, regions: REGION_IDS, landmarks: LANDMARKS, unnamed: UNNAMED };

  // ---------- the items: one per overworld place, made once per world (keyed by the Atlas hash) ----------
  let cache = null, cacheKey = null;
  function items() {
    const A = window.ATLAS; if (!A || !A.built || !A.built()) return [];
    const key = A.hash() + '|' + MAP_W + 'x' + MAP_H; if (cache && cacheKey === key) return cache;
    const out = [], seen = new Set();
    for (const p of A.places) {
      if (p.map !== 'over' || p.kind !== 'region' || UNNAMED.includes(p.id) || seen.has(p.id) || !p.rects.length) continue;
      seen.add(p.id);
      const r = p.rects[0], area = (r[2] - r[0] + 1) * (r[3] - r[1] + 1);
      // where the name goes: the box's centre when the place owns it (its outline may not: Wolfwood's box runs under the
      // Ashfields' rim), else the tile of its own nearest that centre
      const cx = (r[0] + r[2] + 1) / 2, cy = (r[1] + r[3] + 1) / 2;
      const owns = (x, y) => { const g = regionAt(x, y); return !!g && (g.atlas || ATLAS.slug(g.name)) === p.id; };
      let at = [cx, cy];
      if (!owns(Math.floor(cx), Math.floor(cy))) {
        let best = null; const step = area > 2000 ? 3 : 1;
        for (let y = Math.max(0, r[1]); y <= Math.min(MAP_H - 1, r[3]); y += step) for (let x = Math.max(0, r[0]); x <= Math.min(MAP_W - 1, r[2]); x += step) {
          if (!owns(x, y)) continue; const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (!best || d < best[2]) best = [x + 0.5, y + 0.5, d]; }
        if (best) at = [best[0], best[1]];
      }
      out.push({ id: p.id, text: p.name.toUpperCase(), name: p.name, x: at[0], y: at[1], tier: tierOf(p.id), area, owns });
    }
    // priority: tier first; within a tier the bigger place first (it has the fewer places it can go)
    out.sort((a, b) => a.tier - b.tier || b.area - a.area || (a.id < b.id ? -1 : 1));
    cache = out; cacheKey = key; return out;
  }

  // ---------- measuring: the real canvas, or (a headless canvas measures every string as 10 px) a fair estimate ----------
  function textWidth(g, s, font, size) {
    try { g.font = font; const a = g.measureText('M').width, b = g.measureText('MMMMMMMMMM').width; if (b > a * 2) return g.measureText(String(s)).width; } catch (e) { }
    return String(s).length * size * 0.74;   // Cinzel 800 capitals run about 0.7 of their size wide
  }

  // ---------- the layout ----------
  // opts: { sc, ox, oy (the map's top-left on screen and its pixels a tile), bounds: { x, y, w, h } (where a label may
  //         sit), rings: [{ x, y, r }] (marker and quest rings, screen px), blocks: [{ x, y, w, h }], measure(text, tier) ->
  //         { w, size, font }, lit: Set of place ids lit gold, nudge (px, small places; regions may move further) }
  // returns { drawn: [{ id, text, cx, cy, box: { x, y, w, h }, size, font, tier, lit, moved }], dropped: [{ id, why }] }
  function layout(list, opts) {
    const o = opts, B = o.bounds, PAD = 2, drawn = [], dropped = [];
    const hitsBox = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const hitsRing = (a, c) => { const nx = Math.max(a.x, Math.min(c.x, a.x + a.w)), ny = Math.max(a.y, Math.min(c.y, a.y + a.h)); return Math.hypot(c.x - nx, c.y - ny) < c.r; };
    const free = b => b.x >= B.x && b.y >= B.y && b.x + b.w <= B.x + B.w && b.y + b.h <= B.y + B.h &&
      !drawn.some(d => hitsBox(b, { x: d.box.x - PAD, y: d.box.y - PAD, w: d.box.w + PAD * 2, h: d.box.h + PAD * 2 })) &&
      !(o.rings || []).some(c => hitsRing(b, c)) && !(o.blocks || []).some(k => hitsBox(b, k));
    for (const it of list) {
      const m = o.measure(it.text, it.tier), h = m.size * 1.15, w = m.w + 4;
      const sx = o.ox + it.x * o.sc, sy = o.oy + it.y * o.sc;
      // the offsets tried, nearest first: none, then rings of 8 directions every few pixels out to the nudge limit
      // (a region's name may move further, but only onto its own ground; a landmark's half as far again as a small place's)
      // (a town's name may move as far, to stand clear of the town's own rings: its shops and quests crowd its middle)
      const lim = it.tier <= 1 ? Math.max(o.nudge * 3, 40) : it.tier === 2 ? o.nudge * 1.5 : o.nudge, stepPx = Math.max(3, h * 0.4);
      const tries = [[0, 0]];
      for (let d = stepPx; d <= lim + 0.01; d += stepPx) for (const [ux, uy] of [[0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]]) tries.push([ux * d * (ux && uy ? 0.75 : 1), uy * d * (ux && uy ? 0.75 : 1)]);
      let put = null;
      for (const [dx, dy] of tries) {
        const cx = sx + dx, cy = sy + dy, box = { x: cx - w / 2, y: cy - h / 2, w, h };
        if (!free(box)) continue;
        if (it.tier === 1 && (dx || dy) && it.owns && !it.owns(Math.floor((cx - o.ox) / o.sc), Math.floor((cy - o.oy) / o.sc))) continue;
        put = { cx, cy, box, moved: Math.round(Math.hypot(dx, dy)) }; break;
      }
      if (!put) { dropped.push({ id: it.id, why: 'no room within ' + Math.round(lim) + ' px' }); continue; }
      drawn.push({ id: it.id, text: it.text, cx: put.cx, cy: put.cy, box: put.box, size: m.size, font: m.font, tier: it.tier, lit: !!(o.lit && o.lit.has(it.id)), moved: put.moved });
    }
    return { drawn, dropped };
  }

  // ---------- drawing ----------
  const COLOUR = t => [HK.T.ink, HK.T.inkDim, HK.T.ink, HK.T.inkDim][t];
  function draw(g, res) {
    for (const d of res.drawn) HK.text(g, d.text, d.cx, d.box.y + d.size * 0.92, { font: d.font, align: 'center', color: d.lit ? HK.T.goldHi : COLOUR(d.tier), halo: 3 });
  }

  // ---------- the world map's own call (10-hud's drawMapPanel, out in the world) ----------
  // L: { g, ox, oy, sc, ix, iy, iw, ih, narrow, targets } -> the layout drawn (kept as MAP_LABELS.last for the self-test)
  function drawWorld(L) {
    const g = L.g, base = Math.max(9, Math.min(15, L.sc * 2.4));
    const size = t => Math.max(8, base + [1, 0, -1, -2][t]);
    const measure = (s, t) => { const sz = size(t), font = t === 1 ? HK.FC(700, sz) : HK.FC(800, sz); return { w: textWidth(g, s, font, sz), size: sz, font }; };
    const rings = [], lit = new Set(), list = items();
    // the quest rings: a ring on a place lights that place's name; any ring is kept clear of every name
    for (const tg of L.targets || []) {
      rings.push({ x: L.ox + (tg.x + 0.5) * L.sc, y: L.oy + (tg.y + 0.5) * L.sc, r: 9 });
      const word = String(tg.label || '').replace(/^the\s+/i, '').toLowerCase();
      const p = window.ATLAS && ATLAS.at(tg.x, tg.y), byName = list.find(it => it.name.replace(/^the\s+/i, '').toLowerCase() === word);
      if (byName) lit.add(byName.id); else if (p && list.some(it => it.id === p.id) && p.name.replace(/^the\s+/i, '').toLowerCase() === word) lit.add(p.id);
    }
    if (player.home) rings.push({ x: L.ox + player.home.x / TILE * L.sc, y: L.oy + player.home.y / TILE * L.sc, r: 9 });
    // the markers (61-markers draws them after this, over the map) and the key strip at the map's foot
    const M = window.MARKERS; let foot = L.ih;
    if (M) {
      try { const lay = M.layout(g, L.ix, L.iy, L.iw, L.ih, L.narrow); if (lay && lay.y > L.iy) foot = lay.y - L.iy; } catch (e) { }
      if (M.show()) for (const m of M.known()) rings.push({ x: L.ox + (m.x + 0.5) * L.sc, y: L.oy + (m.y + 0.5) * L.sc, r: (M.MAP_R || 5.2) + 1.5 });
    }
    const res = layout(list, { sc: L.sc, ox: L.ox, oy: L.oy, bounds: { x: L.ix + 2, y: L.iy + 2, w: L.iw - 4, h: foot - 4 }, rings, measure, lit, nudge: Math.max(12, base * 1.6) });
    draw(g, res);
    res.rings = rings; res.bounds = { x: L.ix + 2, y: L.iy + 2, w: L.iw - 4, h: foot - 4 }; res.view = [VW, VH]; res.markers = !!(M && M.show());
    MAP_LABELS.last = res;
    return res;
  }

  window.MAP_LABELS = { items, layout, draw, drawWorld, textWidth, TIERS, tierOf, last: null };

  // ---------- self-test (ADDENDUM B, rule 3) ----------
  // At 1280x800, 1024x768 (iPad landscape), 768x1024 (iPad portrait) and 390x844 (phone), markers on and off: no two drawn
  // labels' boxes meet, no label box meets a marker or quest ring, no place is named twice (every word the map panel draws
  // is heard through a recording canvas that measures real-ish letter widths), and no person's name is printed.
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'map labels: ', M = window.MARKERS;
    const own = k => Object.getOwnPropertyDescriptor(window, k), saved = { w: own('innerWidth'), h: own('innerHeight'), t: window.__forceTouch };
    const st0 = M ? { show: M.show(), seen: { ...M.state().seen } } : null, q0 = { wren: quest.wren, tracked: quest.tracked, u: quest.untrackedByPlayer };
    const recorder = () => { const texts = []; const g = new Proxy({}, {
      get: (t, k) => k === 'measureText' ? s => ({ width: String(s).length * 8.5 }) : k === 'fillText' ? s => { texts.push(String(s)); }
        : (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient') ? () => ({ addColorStop: () => { } }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : typeof k === 'string' ? () => { } : undefined,
      set: () => true }); return { g, texts }; };
    h.peace(true); closePanel(); dialog.cur = null; dialog.queue.length = 0;
    // a person's quest ring (Old Wren) and a place's (Hollowford, when its quest is on the map) on the map
    quest.wren = 'active'; quest.tracked = 'wren'; quest.untrackedByPlayer = false;
    if (M) { M.refresh(); for (const m of M.all()) M.state().seen[m.key] = 1; }
    const people = NPCS.map(n => n.name).filter(Boolean);
    const problems = [], seenSizes = []; let tried = 0, drawnMin = 1e9, names = new Set();
    for (const [w, hh, touch] of [[1280, 800, false], [1024, 768, true], [768, 1024, true], [390, 844, true]]) for (const on of [true, false]) {
      try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { }
      window.__forceTouch = touch; if (typeof resize === 'function' && (VW !== w || VH !== hh)) resize();
      if (VW !== w || VH !== hh) { problems.push(`${w}x${hh}: the view is ${VW}x${VH}`); continue; }
      if (M) M.setShow(on);
      const r = recorder(); buttons.length = 0; openPanel('map'); MAP_LABELS.last = null; drawPanels(r.g, VW < 700, VH < 500, 0, 44); buttons.length = 0;
      const res = MAP_LABELS.last, tag = `${w}x${hh} markers ${on ? 'on' : 'off'}`; tried++;
      if (!res) { problems.push(tag + ': no labels laid out'); continue; }
      seenSizes.push(tag + ': ' + res.drawn.length + ' drawn, ' + res.dropped.length + ' dropped');
      drawnMin = Math.min(drawnMin, res.drawn.length); for (const d of res.drawn) names.add(d.id);
      const D = res.drawn;
      for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++) { const a = D[i].box, b = D[j].box; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) problems.push(`${tag}: ${D[i].id} meets ${D[j].id}`); }
      for (const d of D) for (const c of res.rings) { const a = d.box, nx = Math.max(a.x, Math.min(c.x, a.x + a.w)), ny = Math.max(a.y, Math.min(c.y, a.y + a.h)); if (Math.hypot(c.x - nx, c.y - ny) < c.r) problems.push(`${tag}: ${d.id} on a ring at ${Math.round(c.x)},${Math.round(c.y)}`); }
      for (const d of D) { const a = d.box, B = res.bounds; if (a.x < B.x - 0.01 || a.y < B.y - 0.01 || a.x + a.w > B.x + B.w + 0.01 || a.y + a.h > B.y + B.h + 0.01) problems.push(`${tag}: ${d.id} off the map`); }
      if (new Set(D.map(d => d.id)).size !== D.length) problems.push(`${tag}: a place laid out twice`);
      // every word drawn: a place's name at most once (any case), and no person's name
      const counts = {}; for (const s of r.texts) { const k = s.toUpperCase(); counts[k] = (counts[k] || 0) + 1; }
      for (const it of MAP_LABELS.items()) if ((counts[it.text] || 0) > 1) problems.push(`${tag}: ${it.text} drawn ${counts[it.text]} times`);
      for (const p of people) if (r.texts.includes(p)) problems.push(`${tag}: the person ${p} is named on the map`);
      if (on && M && !res.rings.length) problems.push(tag + ': no rings to keep clear of');
      closePanel();
    }
    if (saved.w) { Object.defineProperty(window, 'innerWidth', saved.w); Object.defineProperty(window, 'innerHeight', saved.h); }
    window.__forceTouch = saved.t; if (typeof resize === 'function') resize();
    if (M) { M.setShow(st0.show); M.state().seen = st0.seen; M.refresh(); }
    quest.wren = q0.wren; quest.tracked = q0.tracked; quest.untrackedByPlayer = q0.u; render(); h.peace(false);
    // one source: every overworld place but the two open grounds has exactly one item, and nothing else is an item
    const want = ATLAS.places.filter(p => p.map === 'over' && p.kind === 'region' && !UNNAMED.includes(p.id)).map(p => p.id).sort(), got = items().map(i => i.id).sort();
    check(P + 'one label per place from the Atlas places (no second list); at 1280x800, 1024x768, 768x1024 and 390x844, markers on and off, no two drawn names meet, none sits on a marker or quest ring or off the map, no place is named twice and no person is named',
      tried === 8 && !problems.length && JSON.stringify(want) === JSON.stringify(got) && drawnMin >= 4 && ['thistledown', 'hollowford'].every(id => names.has(id)),
      { tried, problems: problems.slice(0, 8), more: Math.max(0, problems.length - 8), sizes: seenSizes, one: JSON.stringify(want) === JSON.stringify(got) });
    // the layout itself: priority wins, a nudge moves a name off another, and a name with no room is dropped, not drawn over
    { const meas = () => ({ w: 60, size: 10, font: '' });
      const L = (list, rings) => layout(list, { sc: 1, ox: 0, oy: 0, bounds: { x: 0, y: 0, w: 200, h: 100 }, rings: rings || [], measure: meas, nudge: 20 });
      // (screen pixels in a 200 x 100 box, written in units of u = 50 px: a test of the layout, not a place on the map)
      const u = 50, item = (id, tier, px, py) => ({ id, text: id, x: px, y: py, tier, area: 4 - tier }), ring = (px, py, r) => ({ x: px, y: py, r });
      const a = L([item('town', 0, 2 * u, u), item('small', 3, 2 * u + 2, u + 6)]);
      const nudged = a.drawn.length === 2 && a.drawn[0].id === 'town' && a.drawn[0].moved === 0 && a.drawn[1].moved > 0;
      const b = L([item('town', 0, 2 * u, u), item('small', 3, 2 * u, u)], [ring(2 * u, u + 14, 6), ring(2 * u, u - 14, 6), ring(3.4 * u, u, 30), ring(0.6 * u, u, 30)]);
      const dropped = b.drawn.length === 1 && b.dropped.length === 1 && b.dropped[0].id === 'small';
      check(P + 'the layout: the higher tier keeps its spot, a lower one is nudged off it, and one with no room is dropped (never drawn over)', nudged && dropped, { a: a.drawn.map(d => [d.id, d.moved]), b: b.drawn.map(d => d.id), dropped: b.dropped }); }
  });
}
