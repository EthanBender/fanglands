// ============================================================================
// THE TEACHER'S MAP — GET /teacher-map.json on every game address (docs/ONLINE.md, "The teacher view", "The map file")
// The overworld as the teacher screen draws it (src/79-teacherscreen.js), built once per isolate from the same atlas.json the World bundles (so a deploy
// with a new Atlas serves the new map by itself; nothing is committed twice). Answered by the Worker: it never reaches the
// Durable Object, so it costs no Durable Object request.
//   {hash, W, H, TILE, places: [{id, name, kind, rects}] (the overworld's), doors: {id: {name, x, y}}, grid, fixed, labels}
// grid and fixed are atlas.json's own runs ([place index, count, ...] and [0s, 1s, 0s, ...] counts).
// labels (round 2, the map's place names, docs/ONLINE.md "The teacher view"): one per NAME (Hollowford, The Ashfields and
// Ironclad Isle are two Atlas places each, merged), 'reserved' left out: {name, kind, idx: [Atlas indexes], area (owned
// tiles), box: [x0, y0, x1, y1] (the owned tiles' bounding box), anchor: [x, y] (the owned tile furthest from any tile it does
// not own, by a 3-4 chamfer distance; ties go to the tile nearest the owned tiles' centroid), depth (how many other places
// have a rect holding the anchor)}. The page lays the names out from these (79-teacherscreen layoutLabels); every coordinate
// comes from the Atlas, none is written in a game file.
// ============================================================================

import ATLAS_JSON from './atlas.json' with { type: 'json' };

export const MAP_KEYS = ['hash', 'W', 'H', 'TILE', 'places', 'doors', 'grid', 'fixed', 'labels'];
export const LABEL_KEYS = ['name', 'kind', 'idx', 'area', 'box', 'anchor', 'depth'];

export function buildTeacherMap(a) {
  const places = (a.places || []).map(p => p.map === 'over' ? { id: p.id, name: p.name, kind: p.kind, rects: p.rects } : null);
  const byId = {}; for (const p of a.places || []) byId[p.id] = p;
  const doors = {};
  for (const [id, d] of Object.entries(a.doors || {})) {
    const at = d && (d.door || d.step);
    if (!at || !byId[id]) continue;
    doors[id] = { name: byId[id].name, x: at[0], y: at[1] };
  }
  // `places` keeps the Atlas's indexes (the grid's values point into it): another map's place is null there
  return { hash: a.hash, W: a.MAP_W, H: a.MAP_H, TILE: a.TILE, places, doors, grid: a.grid, fixed: a.fixed && a.fixed.over, labels: buildLabels(a) };
}

// the grid's runs as one place index per tile
export function cellsOf(a) {
  const W = a.MAP_W, H = a.MAP_H, n = W * H, cells = new Int32Array(n).fill(-1);
  let i = 0;
  for (let k = 0; k + 1 < (a.grid || []).length; k += 2) { cells.fill(a.grid[k], i, Math.min(n, i + a.grid[k + 1])); i += a.grid[k + 1]; }
  return cells;
}
// 3-4 chamfer distance from every owned tile to the nearest tile it does not own (the map's edge counts as not owned)
function chamfer(mask, W, H) {
  const BIG = 1e9, d = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = mask[i] ? BIG : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : d[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4); }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4); }
  return d;
}
export function buildLabels(a) {
  const W = a.MAP_W, H = a.MAP_H, cells = cellsOf(a), out = [], byName = new Map();
  (a.places || []).forEach((p, i) => {
    if (!p || p.map !== 'over' || p.kind === 'reserved' || p.kind === 'instance') return;
    let e = byName.get(p.name);
    if (!e) { e = { name: p.name, kind: p.kind, idx: [], rects: [] }; byName.set(p.name, e); out.push(e); }
    e.idx.push(i); e.rects.push(...(p.rects || []));
    if (p.kind === 'area') e.kind = 'area';
  });
  for (const e of out) {
    const own = new Set(e.idx), mask = new Uint8Array(W * H);
    let n = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let k = 0; k < W * H; k++) if (own.has(cells[k])) { mask[k] = 1; n++; const x = k % W, y = (k - x) / W; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    e.area = n;
    if (!n) { e.box = null; e.anchor = null; e.depth = 0; continue; }
    e.box = [x0, y0, x1, y1];
    const d = chamfer(mask, W, H), cx = sx / n, cy = sy / n;
    let best = -1, bd = -1, bc = Infinity;
    for (let k = 0; k < W * H; k++) {
      if (!mask[k]) continue;
      const x = k % W, y = (k - x) / W, c = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d[k] > bd || (d[k] === bd && c < bc)) { best = k; bd = d[k]; bc = c; }
    }
    e.anchor = [best % W, Math.floor(best / W)];
  }
  for (const e of out) {
    e.depth = 0;
    if (!e.anchor) continue;
    const [ax, ay] = e.anchor;
    for (const o of out) if (o !== e && o.rects.some(r => ax >= r[0] && ay >= r[1] && ax <= r[2] && ay <= r[3])) e.depth++;
  }
  return out.filter(e => e.area > 0).map(e => ({ name: e.name, kind: e.kind, idx: e.idx, area: e.area, box: e.box, anchor: e.anchor, depth: e.depth }));
}

let body = null;
export function teacherMap() {
  if (!body) body = JSON.stringify(buildTeacherMap(ATLAS_JSON));
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
}
