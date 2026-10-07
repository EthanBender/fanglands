// ============================================================================
// DECO — the Great Spread's one tile for Stage 5's places (~/.fanglands/work/spread/spec.md §0.6, §13 STAGE 5)
// src/83-deco.js
//
// Stage 5 spends one tile id, DECO, the way Stage 4 spent PROP (93-spread): a DECO cell is open ground a knight walks on
// (not solid: a stone bridge's deck, reeds, standing wheat, a drying rack, a low hedge), and WHAT it is lives in a sparse
// side table, idx -> { kind, under }. Each place's file says how its kinds look and what E on one says:
//
//   DECO.kind('stone_bridge', { draw(g, px, py, cell, tx, ty), ground: false, use: 'Old stone, worn smooth.', bridge: true })
//   DECO.put(api, x, y, 'stone_bridge')      in a HOOKS.built pass (the tile is made on the first one: see below)
//   DECO.at(x, y)                            the cell's { kind, under } or null
//   DECO.cells(kind)                         every cell of a kind, as [x, y]
//
// `ground` (default true): the ground beneath (`under`, as the world had it) is drawn first, then the kind; a kind that
// covers its whole tile (the bridge deck) says ground: false. `bridge`: the cell is part of a river crossing (97-spreadchecks'
// scarp seal and 92-worldshape's bridge count read DECO.isBridge).
//
// The tile is made by the first HOOKS.built pass that puts a cell (DECO.ensure), so it is made after 93-spread's PROP (the
// world's first pass makes that one): every tile id that stood before keeps its number, and DECO takes the next free one.
// The table is emptied at the start of every world (a HOOKS.world pass ahead of all the others), so a second new game
// lays the same cells again. No dice here; each place's file uses its own stream.
// Feature file: registers through HOOKS; no core file edits. window.DECO is the handle.
// ============================================================================
const DECO = window.DECO = (() => {
  let id = -1;
  const CELLS = new Map(), KINDS = {};
  const ensure = () => { if (id < 0) { id = addTile('DECO', { solid: false, tex: 'grass', mini: '#a89a72' }); API.id = id; } return id; };
  const API = {
    id, CELLS, KINDS, ensure,
    kind(name, def) { KINDS[name] = Object.assign({ ground: true }, def); return KINDS[name]; },
    put(api, x, y, kind) {
      if (!KINDS[kind]) throw new Error('DECO.put: no kind ' + JSON.stringify(kind));
      const t = ensure(), i = idx(x, y), was = api.tileAt(x, y), old = CELLS.get(i);
      CELLS.set(i, { kind, under: was === t && old ? old.under : was });
      if (was !== t) api.setTile(x, y, t);
    },
    at: (x, y) => (id >= 0 && inMap(x, y) && map[idx(x, y)] === id ? CELLS.get(idx(x, y)) || null : null),
    cells: kind => { const out = []; for (const [i, c] of CELLS) if (c.kind === kind && map[i] === id) out.push([i % MAP_W, (i / MAP_W) | 0]); return out; },
    isBridge: i => id >= 0 && map[i] === id && !!(CELLS.get(i) && KINDS[CELLS.get(i).kind] && KINDS[CELLS.get(i).kind].bridge),
  };
  return API;
})();
{
  // a new world: the table starts empty (ahead of every other pass)
  HOOKS.world.unshift(() => { DECO.CELLS.clear(); });

  // E on a DECO cell: what its kind says (a string, or a function of the cell)
  HOOKS.use.push((t, tx, ty) => {
    if (DECO.id < 0 || t !== DECO.id || window.__instance) return false;
    const c = DECO.CELLS.get(idx(tx, ty)), k = c && DECO.KINDS[c.kind]; if (!k || !k.use) return false;
    const words = typeof k.use === 'function' ? k.use(c, tx, ty) : k.use;
    if (words) notify(words);
    return !!words;
  });

  // drawing: the ground beneath (unless the kind covers it), then the kind, sorted by its foot like everything standing
  HOOKS.draw.push((g, items) => {
    if (DECO.id < 0 || window.__instance) return;
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 1);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const i = idx(tx, ty); if (map[i] !== DECO.id) continue;
      const c = DECO.CELLS.get(i), k = c && DECO.KINDS[c.kind]; if (!k) continue;
      const px = tx * TILE, py = ty * TILE, v = variant[i] % 3;
      if (k.ground) items.push({ y: -1e9 + 1, draw: () => { const img = tex[TEX_NAME[c.under] + v]; if (img) g.drawImage(img, px, py, TILE, TILE); } });
      items.push({ y: k.flat ? -1e9 + 2 : py + TILE - (k.foot || 4), draw: () => k.draw(g, px, py, c, tx, ty, v) });
    }
  });

  // ---------- self-tests ----------
  HOOKS.selfTest.push(check => {
    const P = 'deco: ', ids = Object.values(T), n = DECO.CELLS.size;
    const bad = []; for (const [i, c] of DECO.CELLS) if (map[i] !== DECO.id && !(window.PLAYTHROUGH)) bad.push([i % MAP_W, (i / MAP_W) | 0, c.kind]);
    check(P + 'DECO is one tile (made after PROP, so no older tile id moved; within the 255 a map byte holds), not solid, and every cell in its table is a DECO tile with a known kind',
      (n === 0 || (DECO.id >= 0 && DECO.id <= 255 && T.DECO === DECO.id && !SOLID.has(DECO.id) && (T.PROP === undefined || T.PROP < DECO.id))) && !bad.length && [...DECO.CELLS.values()].every(c => DECO.KINDS[c.kind]) && new Set(ids).size === ids.length,
      { id: DECO.id, prop: T.PROP, cells: n, bad: bad.slice(0, 5) });
  });
}
