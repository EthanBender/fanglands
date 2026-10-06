// ============================================================================
// THE TEACHER'S MAP — GET /teacher-map.json on the teacher address (docs/ONLINE.md, "The teacher view", "The map file")
// The overworld as the watch screen draws it, built once per isolate from the same atlas.json the World bundles (so a deploy
// with a new Atlas serves the new map by itself; nothing is committed twice). Answered by the Worker: it never reaches the
// Durable Object, so it costs no Durable Object request.
//   {hash, W, H, TILE, places: [{id, name, kind, rects}] (the overworld's), doors: {id: {name, x, y}}, grid, fixed}
// grid and fixed are atlas.json's own runs ([place index, count, ...] and [0s, 1s, 0s, ...] counts).
// ============================================================================

import ATLAS_JSON from './atlas.json' with { type: 'json' };

export const MAP_KEYS = ['hash', 'W', 'H', 'TILE', 'places', 'doors', 'grid', 'fixed'];

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
  return { hash: a.hash, W: a.MAP_W, H: a.MAP_H, TILE: a.TILE, places, doors, grid: a.grid, fixed: a.fixed && a.fixed.over };
}

let body = null;
export function teacherMap() {
  if (!body) body = JSON.stringify(buildTeacherMap(ATLAS_JSON));
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } });
}
