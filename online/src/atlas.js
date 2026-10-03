// ============================================================================
// THE ATLAS, AS THE ROOM READS IT (docs/ONLINE.md, "The shared world", Stage 1)
// The Room has no game, so it reads the places, the zone grid and the FIXED_SOLID masks from atlas.json, which
// tools/atlas.mjs writes from the built game (src/01-atlas.js, src/96-atlas.js). This file only decodes that JSON and
// answers the same questions window.ATLAS answers in the game; it never builds anything itself.
//
//   const atlas = readAtlas(json)        json: the parsed atlas.json (null or junk gives null)
//   atlas.hash, atlas.places, atlas.get(id), atlas.place(map, tx, ty), atlas.zoneAt(map, tx, ty), atlas.combatAt(map, tx, ty)
//   atlas.knows(map)                      the map is the overworld or an instance the Atlas has a FIXED_SOLID mask for
//   atlas.solidAt(map, tx, ty)            FIXED_SOLID (everything off the map's edge is)
//   atlas.speedMax, atlas.fixedCount      the fastest mover (px/s), and how many overworld tiles are FIXED_SOLID
// Pure JavaScript, no Cloudflare APIs.
// ============================================================================

const OVER = 'over';
export const isHouse = map => typeof map === 'string' && (map === 'house' || map.startsWith('house:'));

// [value, count, value, count, ...] into n cells
function unRuns(r, n) {
  const out = new Uint8Array(n); let i = 0;
  for (let k = 0; k + 1 < r.length && i < n; k += 2) { const v = r[k], c = r[k + 1]; out.fill(v, i, Math.min(n, i + c)); i += c; }
  if (i !== n) throw new Error('atlas: a grid of ' + i + ' cells, not ' + n);
  return out;
}
// counts that alternate 0s and 1s, starting with 0s
function unBits(r, n) {
  const out = new Uint8Array(n); let i = 0, v = 0;
  for (const c of r) { if (v) out.fill(1, i, Math.min(n, i + c)); i += c; v ^= 1; }
  if (i !== n) throw new Error('atlas: a mask of ' + i + ' cells, not ' + n);
  return out;
}

export function readAtlas(json) {
  if (!json || typeof json !== 'object' || typeof json.hash !== 'string' || !Array.isArray(json.places)) return null;
  const W = json.MAP_W, H = json.MAP_H;
  const places = json.places, byId = {};
  for (const p of places) byId[p.id] = p;
  const grid = unRuns(json.grid, W * H);
  const fixed = { [OVER]: { w: W, h: H, mask: unBits(json.fixed.over, W * H) } };
  for (const id of Object.keys(json.fixed)) if (id !== OVER) { const f = json.fixed[id]; fixed[id] = { w: f.w, h: f.h, mask: unBits(f.runs, f.w * f.h) }; }
  let fixedCount = 0; for (const b of fixed[OVER].mask) fixedCount += b;
  const get = id => byId[id] || null;
  function place(map, tx, ty) {
    const m = map || OVER;
    if (m === OVER) return (tx >= 0 && ty >= 0 && tx < W && ty < H) ? (places[grid[ty * W + tx]] || null) : null;
    const p = byId[isHouse(m) ? 'house' : m];
    if (!p || p.kind !== 'instance') return null;
    const r = p.rects[0];
    return tx >= r[0] && tx <= r[2] && ty >= r[1] && ty <= r[3] ? p : null;
  }
  const knows = map => typeof map === 'string' && !isHouse(map) && Object.prototype.hasOwnProperty.call(fixed, map);
  function solidAt(map, tx, ty) {
    const f = fixed[map || OVER];
    if (!f) return false;
    if (tx < 0 || ty < 0 || tx >= f.w || ty >= f.h) return true;
    return f.mask[ty * f.w + tx] === 1;
  }
  return {
    v: json.v, hash: json.hash, TILE: json.TILE, MAP_W: W, MAP_H: H, places, get, place, knows, solidAt,
    zoneAt: (map, tx, ty) => { const p = place(map, tx, ty); return p ? p.id : null; },
    combatAt: (map, tx, ty) => { const p = place(map, tx, ty); return p ? (p.safe ? 'safe' : p.combat) : null; },
    speedMax: (json.speed && json.speed.max) || 350, speed: json.speed || {}, fixedCount,
  };
}
