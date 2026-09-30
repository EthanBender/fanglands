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
  // One recipe plate per pie, like a station's rows: the pie in a pouch, its name in Cinzel, what goes in and what is in
  // the pack in plain words with exact counts, and a Bake plate (green when it can be baked). The plate answers to the
  // recipe's label, so every test and the harness still find it by name.
  let ovenPage = 0;
  const ovenLabel = r => r.label + (r.lv > 1 ? `  (lv ${r.lv})` : '');
  const needsLine = r => r.needs.map(([id, q]) => `${q} ${ITEMS[id] ? ITEMS[id].name : id} (you have ${countItem(id)})`).join(', ');
  function ovenGeom(g) {
    const K = PLACE_KIT, R = K.R(), G = K.GAP(), S = K.POUCH();
    const list = RECIPES.filter(r => r.station === 'oven');
    const w = Math.min(PANEL_KIT.room().aw, 460), inner = w - 36, bw = touchMode() ? 96 : 84;
    const textW = inner - 12 - S - 12 - bw - 12, f = K.SENT(13), lh = K.lineH(f);
    const heights = list.map(r => Math.max(S + 16, 10 + 18 + K.linesOf(g, needsLine(r), textW, f) * lh + 8, R + 16));
    const foot = R + 8, room = PANEL_KIT.room().ah - 62 - 12 - foot;
    const pages = K.pages(heights, room, G);
    const many = pages.length > 1;
    const pageH = Math.max(...pages.map(p => p.reduce((a, i) => a + heights[i], 0) + (p.length - 1) * G));
    return { K, R, G, S, list, w, inner, bw, textW, f, lh, heights, pages, h: 62 + pageH + 12 + (many ? foot : 0) };
  }
  HOOKS.panel.oven = (g, narrow) => {
    const Q = ovenGeom(g), { K, R, G, S } = Q;
    ovenPage = clamp(ovenPage, 0, Q.pages.length - 1);
    const { px, py, h } = panelBox(g, Q.w, Q.h, 'Oven', `Cooking level ${skillLv('cooking')}. Flour and a filling go in, a pie comes out.`);
    const x0 = px + 18; let y = py + 62;
    const canOf = r => ({ has: r.needs.every(([id, q]) => countItem(id) >= q), lvOk: skillLv(r.skill) >= r.lv });
    Q.list.forEach((r, i) => {
      const { has, lvOk } = canOf(r), can = has && lvOk;
      if (!Q.pages[ovenPage].includes(i)) { K.offscreen(ovenLabel(r), () => craft(r), can); return; }
      const ch = Q.heights[i];
      K.card(g, x0, y, Q.inner, ch, can ? HK.T.gold : null);
      K.pouch(g, x0 + 12, y + Math.round((ch - S) / 2), S, r.out, r.qty || 1);
      const tx = x0 + 12 + S + 12, name = ITEMS[r.out] ? ITEMS[r.out].name : r.out;
      const lvW = r.lv > 1 ? HK.tw(g, `Level ${r.lv}`, K.NAME(11)) + 8 : 0;
      K.say(g, name, tx, y + 23, Q.textW - lvW, { font: K.NAME(13), color: can ? HK.T.ink : HK.T.inkDim, id: 'oven:name' });
      if (r.lv > 1) K.say(g, `Level ${r.lv}`, tx + Q.textW, y + 23, lvW, { font: K.NAME(11), align: 'right', color: lvOk ? HK.T.good : HK.T.warn, id: 'oven:lv' });
      K.para(g, needsLine(r), tx, y + 28 + 13, Q.textW, 99, { font: Q.f, color: has ? HK.T.ink : HK.T.inkDim, id: 'oven:needs' });
      K.plate(g, x0 + Q.inner - 12 - Q.bw, y + Math.round((ch - R) / 2), Q.bw, R, 'Bake', ovenLabel(r), () => craft(r), can ? 'primary' : null, can, { name: 'Bake a ' + name.toLowerCase() });
      y += ch + G;
    });
    if (Q.pages.length > 1) K.pager(g, x0, py + h - 12 - R, Q.inner, ovenPage, Q.pages.length, p => { ovenPage = clamp(p, 0, Q.pages.length - 1); });
  };
  // the panel audit's scene (PLACE_KIT, run from 63-house): flour and berries in the pack, so one pie can be baked
  PLACE_KIT.scene({
    id: 'oven', panel: 'oven', name: 'Oven (one pie ready to bake, the others short)',
    setup() {
      const inv = player.inv.map(s => (s ? { ...s } : null));
      player.inv = new Array(INV_SLOTS).fill(null); addItem('flour', 2); addItem('berries', 6); addItem('raw_beef', 1);
      return () => { player.inv = inv; ovenPage = 0; };
    },
    variants: [{ name: '', open: () => { openPanel('oven'); ovenPage = 0; } }],
  });

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
      if (tileAt(tx, ty) === T_BERRY) { HK.brackets(g, tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4); }
    } });
  });
}
