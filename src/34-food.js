// ============================================================================
// FEATURE: FOOD — berry bushes, wheat, flour and pies
// Berry bushes grow wild on the grass between the villages: E picks 1–3 berries and the bush goes bare for two
// minutes. Wheat seed (Greta, 01-items) grows like potatoes; two wheat make flour at a workbench; flour and a filling
// make a pie at an oven (Rosalind's bakery). The core's T.OVEN branch (06) opens the 'oven' panel below when the
// knight holds flour and a filling, and cooks raw food the plain way otherwise. Bush state is not saved: every
// bush is ripe again on load, which is fine.
// ============================================================================
{
  // ---------- items ----------
  Object.assign(ITEMS, {
    berries: { name: 'Berries', value: 2, color: '#c0294a', shape: 'berries', heal: 2 },
    flour: { name: 'Flour', value: 8, color: '#e9e2d0', shape: 'flour' },
    berry_pie: { name: 'Berry pie', value: 30, color: '#a8434a', shape: 'pie', heal: 10 },
    fish_pie: { name: 'Fish pie', value: 35, color: '#c9a56a', shape: 'pie', heal: 14 },
  });
  for (const k of ['berries', 'flour', 'berry_pie', 'fish_pie']) { ITEMS[k].id = k; ITEMS[k].stack = 50; }

  // ---------- recipes ----------
  RECIPES.push(
    { out: 'flour', qty: 1, needs: [['wheat', 2]], station: 'workbench', skill: 'crafting', lv: 1, xp: 4, label: '2 Wheat → Flour' },
    { out: 'berry_pie', qty: 1, needs: [['berries', 4], ['flour', 1]], station: 'oven', skill: 'cooking', lv: 1, xp: 40, label: '4 Berries + Flour → Berry pie' },
    { out: 'meat_pie', qty: 1, needs: [['raw_beef', 1], ['flour', 1]], station: 'oven', skill: 'cooking', lv: 8, xp: 60, label: 'Flour + Raw beef → Meat pie' },
    { out: 'fish_pie', qty: 1, needs: [['raw_trout', 1], ['flour', 1]], station: 'oven', skill: 'cooking', lv: 12, xp: 80, label: 'Flour + Raw trout → Fish pie' },
  );

  // ---------- the oven panel: pies ----------
  // Opened by the core's T.OVEN branch (06) when the knight holds flour and any filling; craft() handles the rest.
  HOOKS.panel.oven = (g, narrow) => {
    const list = RECIPES.filter(r => r.station === 'oven');
    const { px, py, w } = panelBox(g, 420, 62 + list.length * 40 + 24, 'Oven — pies', `Cooking level ${skillLv('cooking')} · flour and a filling go in, a pie comes out`);
    list.forEach((r, i) => {
      const y = py + 62 + i * 40, has = r.needs.every(([id, q]) => countItem(id) >= q), lvOk = skillLv(r.skill) >= r.lv;
      button(g, px + 18, y, w - 36, 34, r.label + (r.lv > 1 ? `  (lv ${r.lv})` : ''), () => craft(r), has && lvOk ? '#238636' : '#2a2f3a', has && lvOk);
    });
  };

  // ---------- berry bushes ----------
  const T_BERRY = addTile('BERRY_BUSH', { solid: true, tex: 'grass', mini: '#3f7d2b' });
  // bare bushes by tile index → { timer } seconds until ripe again. Not persisted.
  const FOOD = window.FOOD = { bushes: new Map(), BUSH_REGROW: 120, BUSH_COUNT: 60, tile: T_BERRY };
  const bushBare = i => { const b = FOOD.bushes.get(i); return !!b && b.timer > 0; };

  // ~60 bushes on open grass, away from the villages, the camp, every building, every spawn and the roads
  HOOKS.world.push((rnd0, api) => {
    const rs = mulberry32(3404); // own stream: where the bushes land does not depend on what carved before
    const NO_REGION = new Set(['The Cave', 'Thistledown', 'Castle Thistledown', 'Goblin Camp', 'Hollowford', 'Sylvaris', 'The Jungle', 'The Ashfields', 'Deepholm']);
    const near = new Set();
    for (const s of MONSTER_SPAWNS) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near.add(idx(s.tx + dx, s.ty + dy));
    for (const n of NPCS) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) near.add(idx(n.x + dx, n.y + dy));
    const nearBuilding = (x, y) => BUILDINGS.some(b => x >= b.x - 3 && x <= b.x + b.w + 2 && y >= b.y - 3 && y <= b.y + b.h + 2);
    const nearPath = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = api.tileAt(x + dx, y + dy); if (t === T.DIRT || t === T.COBBLE || t === T.SAND || t === T.WATER) return true; } return false; };
    const cands = [];
    for (let y = 2; y <= 137; y++) for (let x = CAVE_EXIT_X + 4; x <= 197; x++) {
      if (api.tileAt(x, y) !== T.GRASS || near.has(idx(x, y)) || NO_REGION.has(regionAt(x, y).name)) continue;
      if (Math.abs(x - SIGN_TILE.x) < 4 && Math.abs(y - SIGN_TILE.y) < 4) continue;
      if (nearBuilding(x, y) || nearPath(x, y)) continue;
      cands.push([x, y]);
    }
    for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rs() * (i + 1)); const t = cands[i]; cands[i] = cands[j]; cands[j] = t; }
    const placed = [];
    for (const [x, y] of cands) {
      if (placed.length >= FOOD.BUSH_COUNT) break;
      if (placed.some(([px, py]) => Math.max(Math.abs(px - x), Math.abs(py - y)) < 5)) continue;
      api.setTile(x, y, T_BERRY); placed.push([x, y]);
    }
  });

  HOOKS.use.push((t, tx, ty) => {
    if (t !== T_BERRY) return false;
    const i = idx(tx, ty);
    if (bushBare(i)) { notify('Picked bare. The berries grow back in a couple of minutes.'); return true; }
    if (!canFit('berries', 1)) { notify('Your pack is full.'); return true; }
    const n = rint(1, 3);
    giveOrDrop('berries', n, player.x, player.y); FOOD.bushes.set(i, { timer: FOOD.BUSH_REGROW });
    floatText(player.x, player.y - 30, `+${n} Berries`, ITEMS.berries.color); burst(tc(tx), tc(ty), '#c0294a', 8, 60); sfx('pickup');
    return true;
  });
  HOOKS.update.push(dt => { for (const [i, b] of FOOD.bushes) { b.timer -= dt; if (b.timer <= 0) FOOD.bushes.delete(i); } });
  HOOKS.newGame.push(() => { FOOD.bushes.clear(); });

  // ---------- drawing ----------
  // a round bush: dark leaf-balls with lighter tops; ripe = red berries with a shine; bare = duller, a few pale stalks where the berries were
  const drawBush = (g, tx, ty) => {
    const cx = tc(tx), cy = tc(ty), bare = bushBare(idx(tx, ty)), sway = Math.sin(time * 1.6 + tx * 0.9 + ty * 0.4) * 0.8;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 16, 19, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3a1e'; g.fillRect(cx - 2, cy + 4, 4, 12);
    const balls = [[-9, 2, 11], [9, 3, 10], [0, -6, 12], [-5, 8, 8], [6, 9, 8]];
    for (const [ox, oy, r] of balls) { g.fillStyle = bare ? '#3a6a2a' : '#2f6a28'; g.beginPath(); g.arc(cx + ox + sway * 0.4, cy + oy, r, 0, 7); g.fill(); }
    for (const [ox, oy, r] of balls) { g.fillStyle = bare ? '#5a8a3a' : '#4c9134'; g.beginPath(); g.arc(cx + ox - 2 + sway * 0.4, cy + oy - 3, r * 0.6, 0, 7); g.fill(); }
    if (!bare) {
      for (const [ox, oy] of [[-10, -2], [-3, -10], [6, -6], [11, 2], [-6, 6], [3, 3], [9, 9], [-1, -3]]) {
        g.fillStyle = '#c0294a'; g.beginPath(); g.arc(cx + ox + sway * 0.4, cy + oy, 2.4, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(cx + ox - 0.8 + sway * 0.4, cy + oy - 0.8, 0.8, 0, 7); g.fill();
      }
    } else {
      g.strokeStyle = '#a8c07a'; g.lineWidth = 1; for (const [ox, oy] of [[-8, -3], [4, -7], [9, 4]]) { g.beginPath(); g.moveTo(cx + ox, cy + oy + 3); g.lineTo(cx + ox + 1, cy + oy - 2); g.stroke(); }
    }
  };
  HOOKS.draw.push((g, items, cam) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tileAt(tx, ty) === T_BERRY) items.push({ y: ty * TILE + TILE - 4, draw: () => drawBush(g, tx, ty) });
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 4, draw: () => { // use-highlight: the core only highlights its own tiles
      if (npcInFront()) return;
      const { tx, ty } = frontTile(player);
      if (tileAt(tx, ty) === T_BERRY) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.setLineDash([5, 4]); roundRect(g, tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 6); g.stroke(); g.setLineDash([]); }
    } });
  });
}
