// ============================================================================
// RENDER: world, lighting, minimap
// ============================================================================
const cam = { x: 0, y: 0 };
const RENDER_FURNITURE = new Set([T.COUNTER, T.TABLE, T.BED, T.SHELF, T.ANVIL, T.FORGE, T.OVEN, T.WORKBENCH, T.WORKSHOP, T.ALCHEMY, T.THRONE, T.CHEST, T.GOLDPILE, T.STALL, T.LODESTONE, T.WRECK, T.MECH, T.CART, T.AXESTUMP, T.STONECIRCLE]); // hoisted: was an array literal built every tile every frame
const darkLayer = document.createElement('canvas');
// minimap: one pixel per tile. Painted in full once (boot, new game, load, or when a feature sets miniDirty); after that only the tiles
// changeTile touched (miniDirtyTiles) are repainted, so a chopped tree costs one pixel and not a 28,000-cell sweep.
const miniCanvas = document.createElement('canvas'); miniCanvas.width = MAP_W; miniCanvas.height = MAP_H;
let miniDirty = true, miniDiffCount = -1;
// What the maps show. Out in the world: the whole world. Inside an instance: that instance's own rect and nothing else.
// An instance is written into the top-left of `map`, over the ground where the Cave, the Grey Quarry and Miller's Pond
// are, so every map layer (the minimap, the world map, markers, quest rings, friends, the companion) asks this first
// instead of assuming MAP_W x MAP_H — otherwise the overworld's names and markers are drawn over the dungeon.
function mapView() {
  const id = window.INSTANCES && INSTANCES.active ? INSTANCES.active() : null;
  const inst = id && INSTANCES.get ? INSTANCES.get(id) : null;
  if (inst) return { id, w: inst.w, h: inst.h, name: inst.name, sub: inst.sub || '' };
  return { id: null, w: MAP_W, h: MAP_H, name: 'The Fanglands', sub: '' };
}
// The minimap's window onto mapView(): 44 tiles across in the world; inside a small instance the whole instance fits,
// and the window never slides past the instance's edge into the walls that fill the rest of the map.
function miniWindow(size) {
  const view = mapView(), across = view.id ? Math.min(44, Math.max(view.w, view.h)) : 44;
  const sx = clamp(player.x / TILE - across / 2, 0, Math.max(0, view.w - across)), sy = clamp(player.y / TILE - across / 2, 0, Math.max(0, view.h - across));
  return { across, scale: size / across, sx, sy, view };
}
// inside an instance only its own buildings are painted: the overworld's (Thistledown, the castle) stay in BUILDINGS
const onMiniMap = (tx, ty) => { const v = mapView(); return !v.id || (tx >= 0 && ty >= 0 && tx < v.w && ty < v.h); };
function refreshMini() {
  const g = miniCanvas.getContext('2d');
  if (miniDirty) {
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { g.fillStyle = MINI[map[idx(x, y)]] || '#4c9134'; g.fillRect(x, y, 1, 1); }
    for (const b of BUILDINGS) { if (!onMiniMap(b.x, b.y)) continue; g.fillStyle = b.roof; g.fillRect(b.x, b.y, b.w, b.h); }
  } else {
    for (const i of miniDirtyTiles) { const x = i % MAP_W, y = Math.floor(i / MAP_W); const b = onMiniMap(x, y) && buildingAt(x, y); g.fillStyle = b ? b.roof : (MINI[map[i]] || '#4c9134'); g.fillRect(x, y, 1, 1); }
  }
  miniDirtyTiles.clear(); miniDirty = false; miniDiffCount = mapDiffs.size;
}
const miniNeedsPaint = () => miniDirty || miniDirtyTiles.size > 0;
function render() {
  if (window.innerWidth !== VW || window.innerHeight !== VH) resize();
  const g = ctx;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.imageSmoothingEnabled = true;
  cam.x = clamp(player.x - VW / 2, 0, MAP_W * TILE - VW);
  cam.y = clamp(player.y - VH / 2, 0, MAP_H * TILE - VH);
  if (MAP_W * TILE < VW) cam.x = (MAP_W * TILE - VW) / 2;
  if (MAP_H * TILE < VH) cam.y = (MAP_H * TILE - VH) / 2;
  g.fillStyle = '#0b0f14'; g.fillRect(0, 0, VW, VH);
  g.save(); g.translate(-Math.round(cam.x), -Math.round(cam.y));
  const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE));
  const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE));
  const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
  const inside = buildingAt(ptx, pty); // roof hidden for this building
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = map[idx(tx, ty)];
    let v = variant[idx(tx, ty)];
    if (t === T.WATER) v = (v + Math.floor(time * 1.5)) % 3;
    const img = tex[TEX_NAME[t] + v];
    if (img) g.drawImage(img, tx * TILE, ty * TILE, TILE, TILE);
    else { window.__texMiss = (window.__texMiss || []).concat([[tx, ty, t, v, time]]).slice(-5); g.drawImage(tex.grass0, tx * TILE, ty * TILE, TILE, TILE); }
    if (t === T.WALL && !SOLID.has(tileAt(tx, ty + 1))) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(tx * TILE, ty * TILE + TILE - 6, TILE, 6); }
    if (t === T.FENCE || t === T.GATE) drawFenceProp(g, tx, ty, t === T.GATE);
    else if (t === T.DOOR || t === T.COFFINDOOR) drawDoorProp(g, tx, ty, t === T.COFFINDOOR);
    else if (t === T.PORTCULLIS) drawPortcullisProp(g, tx, ty);
    else if (t === T.RUG || t === T.FLOWERS || t === T.MUSHROOM || t === T.ASHES || t === T.TRAP) { if (t === T.ASHES) drawAshesProp(g, tx, ty); else drawFurniture(g, tx, ty, t); }
    else if (t === T.CROP) drawCropProp(g, tx, ty);
    else if (t === T.RUBBLE) drawRubbleProp(g, tx, ty);
    else if (t === T.STUMP) drawStumpProp(g, tx, ty);
  }
  // doormats + lantern glow on the step outside every door, drawn after the textures so the next tile's ground does not paint over them.
  // Doors one row off-screen still light a visible step, so scan one row wider. The keep's door is on its top wall: the step is north of it.
  for (let ty = y0 - 1; ty <= y1 + 1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tileAt(tx, ty); if (t !== T.DOOR && t !== T.COFFINDOOR) continue;
    const b = buildingAt(tx, ty); const up = !!b && ty === b.y && b.doorTop !== undefined && tx === b.x + b.doorTop;
    drawDoorstep(g, tx, up ? ty - 1 : ty + 1, up, t === T.COFFINDOOR);
  }
  for (const d of drops) if (d.x > cam.x - 40 && d.x < cam.x + VW + 40 && d.y > cam.y - 40 && d.y < cam.y + VH + 40) drawDrop(g, d);
  if (!swordTaken) drawSword(g);
  const items = [];
  const FURNITURE = RENDER_FURNITURE;
  const PROPS = { [T.TREE]: (tx, ty) => drawTreeProp(g, tx, ty, false), [T.OAK]: (tx, ty) => drawTreeProp(g, tx, ty, true), [T.ROCK]: (tx, ty) => drawRockProp(g, tx, ty, 'stone'), [T.IRON]: (tx, ty) => drawRockProp(g, tx, ty, 'iron'), [T.COAL]: (tx, ty) => drawRockProp(g, tx, ty, 'coal'), [T.SIGN]: (tx, ty) => drawSignProp(g, tx, ty), [T.FIRE]: (tx, ty) => drawFireProp(g, tx, ty), [T.DUMMY]: (tx, ty) => drawDummyProp(g, tx, ty), [T.GRAVE]: (tx, ty) => drawGraveProp(g, tx, ty) };
  for (let ty = y0; ty <= y1 + 2; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tileAt(tx, ty);
    if (PROPS[t]) items.push({ y: ty * TILE + TILE - 4, draw: () => PROPS[t](tx, ty) });
    else if (FURNITURE.has(t)) items.push({ y: ty * TILE + TILE - 6, draw: () => drawFurniture(g, tx, ty, t) });
  }
  // castle towers
  for (const [cx, cy] of [[CASTLE.x, CASTLE.y], [CASTLE.x + CASTLE.w - 1, CASTLE.y], [CASTLE.x, CASTLE.y + CASTLE.h - 1], [CASTLE.x + CASTLE.w - 1, CASTLE.y + CASTLE.h - 1]]) if (cx >= x0 - 1 && cx <= x1 + 1 && cy >= y0 - 2 && cy <= y1 + 2) items.push({ y: cy * TILE + TILE, draw: () => drawTower(g, tc(cx), tc(cy)) });
  for (const b of BUILDINGS) if (b !== inside && (b.x + b.w) * TILE > cam.x && b.x * TILE < cam.x + VW && (b.y + b.h) * TILE > cam.y && b.y * TILE < cam.y + VH) items.push({ y: (b.y + b.h) * TILE - 1, draw: () => drawBuilding(g, b) });
  for (const n of NPCS) if (n.px > cam.x - 60 && n.px < cam.x + VW + 60 && n.py > cam.y - 60 && n.py < cam.y + VH + 60) items.push({ y: n.py + 13, draw: () => drawNpc(g, n) });
  for (const m of monsters) {
    if (m.x < cam.x - 80 || m.x > cam.x + VW + 80 || m.y < cam.y - 80 || m.y > cam.y + VH + 80) continue;
    if (m.dead) { if (m.deadT < 0.8) items.push({ y: m.y, draw: () => { g.save(); g.globalAlpha = 1 - m.deadT / 0.8; g.translate(m.x, m.y); g.rotate(1.3); g.translate(-m.x, -m.y); drawCharacter(g, m, m.type); g.restore(); } }); continue; }
    items.push({ y: m.y + m.r, draw: () => { drawCharacter(g, m, m.type); const def = MONSTER_DEFS[m.type]; if (m.hp < m.maxHp || dist(m.x, m.y, player.x, player.y) < 140) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(m.x - 14, m.y - m.r - 16, 28, 5); g.fillStyle = '#e63946'; g.fillRect(m.x - 14, m.y - m.r - 16, 28 * (m.hp / m.maxHp), 5); g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillStyle = def.level > combatLevel() + 3 ? '#ff6b6b' : '#e6edf3'; g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(`${def.name} · lv ${def.level}`, m.x, m.y - m.r - 20); g.fillText(`${def.name} · lv ${def.level}`, m.x, m.y - m.r - 20); } if (m.stunT > 0) { g.fillStyle = '#ffe066'; for (let k = 0; k < 3; k++) { const a = time * 6 + k * 2.1; g.beginPath(); g.arc(m.x + Math.cos(a) * 12, m.y - m.r - 6 + Math.sin(a) * 4, 2, 0, 7); g.fill(); } } } });
  }
  if (!player.dead) items.push({ y: player.y + player.r, draw: () => drawCharacter(g, player, player.mech ? 'playermech' : 'player') });
  else items.push({ y: player.y + player.r, draw: () => { g.save(); g.globalAlpha = Math.max(0.15, 1 - player.deadT / 1.5); g.translate(player.x, player.y); g.rotate(1.4); g.translate(-player.x, -player.y); drawCharacter(g, player, 'player'); g.restore(); } });
  for (const h of HOOKS.draw) h(g, items, cam);
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
  for (const p of projectiles) {
    if (p.kind === 'arrow') { g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx)); g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-10, 0); g.lineTo(8, 0); g.stroke(); g.fillStyle = '#c9ccd3'; g.beginPath(); g.moveTo(8, -2.5); g.lineTo(13, 0); g.lineTo(8, 2.5); g.closePath(); g.fill(); g.restore(); }
    else { g.fillStyle = '#2f2f35'; g.beginPath(); g.arc(p.x, p.y, 7, 0, 7); g.fill(); g.fillStyle = '#ffb347'; g.beginPath(); g.arc(p.x + 5, p.y - 7, 2 + Math.sin(time * 30) * 1, 0, 7); g.fill(); if (p.kind === 'sticky' && p.t >= p.life) { g.strokeStyle = `rgba(255,80,40,${0.5 + Math.sin(time * 20) * 0.5})`; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 56, 0, 7); g.stroke(); } }
  }
  // the world prompt (src/59-hudkit.js): gold corner brackets on the tile or person you face, and after the world is drawn
  // a small verb tag beside it that matches the USE seat's face ("[E] Talk" on a computer, the USE emblem on touch)
  let prompt = null;
  if (!player.dead) {
    const npc = npcInFront();
    const { tx, ty } = frontTile(player);
    if (npc && !player.mech) { HK.brackets(g, npc.px - 18, npc.py - 24, 36, 44); prompt = { x: npc.px + 20, y: npc.py - 6 }; }
    else if (INTERESTING(tileAt(tx, ty))) { HK.brackets(g, tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4); prompt = { x: tx * TILE + TILE + 2, y: ty * TILE + TILE / 2 }; }
    // the action bar: a gold fill on a dark iron track
    if (player.action && player.action.need) { const p = clamp(player.action.t / player.action.need, 0, 1); roundRect(g, player.x - 16, player.y - 35, 32, 6, 3); g.fillStyle = 'rgba(14,16,20,0.85)'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1; g.stroke(); if (p > 0) { roundRect(g, player.x - 15, player.y - 34, Math.max(4, 30 * p), 4, 2); g.fillStyle = '#e8bf5c'; g.fill(); } }
  }
  for (const p of particles) { g.globalAlpha = clamp(p.t * 2, 0, 1); g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  for (const f of floaters) { g.globalAlpha = clamp(f.t * 1.5, 0, 1); g.font = `bold ${f.size}px sans-serif`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(f.text, f.x, f.y); g.fillStyle = f.color; g.fillText(f.text, f.x, f.y); }
  g.globalAlpha = 1;
  g.restore();
  // the verb tag, in screen space, beside what you face (the first times: the coach's longer line, "[E] Talk to Tobin")
  if (prompt && !paused && !panel && !dialog.cur) {
    const face = HK.face('use'), pv = HK.usePreview(), mech = !!player.mech;
    const verb = mech ? (face && face.id === 'crush' ? 'Crush' : null) : pv ? pv.verb.charAt(0) + pv.verb.slice(1).toLowerCase() : null;
    if (verb) {
      const sx = Math.round(prompt.x - cam.x), sy = Math.round(prompt.y - cam.y), t = touchMode();
      const long = pv && pv.what && pv.verb === 'TALK' ? `${verb} to ${pv.what}` : pv && pv.what ? `${verb} ${pv.what}` : verb;
      const coached = HK.teach('use', t ? null : 'E', long, { sx, sy }, { emblem: face && face.emblem });
      if (!coached) HK.tag(g, sx, sy, verb, { side: 'right', key: t ? null : 'E', emblem: t ? (face && face.emblem) : null });
    }
  }

  // cave darkness
  if (isCaveTile(ptx, pty) || cam.x < (CAVE_EXIT_X + 2) * TILE && cam.y < 17 * TILE) {
    if (darkLayer.width !== canvas.width || darkLayer.height !== canvas.height) { darkLayer.width = canvas.width; darkLayer.height = canvas.height; }
    const dg = darkLayer.getContext('2d');
    dg.setTransform(DPR, 0, 0, DPR, 0, 0); dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, VW, VH);
    const inCave = isCaveTile(ptx, pty);
    dg.fillStyle = inCave ? 'rgba(4,6,14,0.72)' : 'rgba(4,6,14,0.6)'; dg.fillRect(-cam.x, -cam.y, (CAVE_EXIT_X + 1) * TILE, 16 * TILE);
    dg.globalCompositeOperation = 'destination-out';
    const lights = [{ x: player.x, y: player.y, r: 150 }, { x: (CAVE_EXIT_X + 1) * TILE, y: 7.5 * TILE, r: 170 }];
    if (!swordTaken) lights.push({ x: SWORD_POS.x, y: SWORD_POS.y, r: 120 });
    for (const L of lights) { const gr = dg.createRadialGradient(L.x - cam.x, L.y - cam.y, 10, L.x - cam.x, L.y - cam.y, L.r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); dg.fillStyle = gr; dg.beginPath(); dg.arc(L.x - cam.x, L.y - cam.y, L.r, 0, 7); dg.fill(); }
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(darkLayer, 0, 0); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  // hurt: a red vignette at the screen's edges that fades with hurtT (the crest's liquid drops with a white flash too);
  // the middle, where the knight is, stays clear
  if (player.hurtT > 0) { const a = clamp(player.hurtT * 0.9, 0, 0.75), r0 = Math.min(VW, VH) * 0.38, r1 = Math.hypot(VW, VH) * 0.56; const vg = g.createRadialGradient(VW / 2, VH / 2, r0, VW / 2, VH / 2, r1); vg.addColorStop(0, 'rgba(210,40,30,0)'); vg.addColorStop(1, `rgba(210,40,30,${a})`); g.fillStyle = vg; g.fillRect(0, 0, VW, VH); }
  // death: the fade, and "You fell..." in Cinzel on a sable plate
  if (player.dead) { g.fillStyle = `rgba(0,0,0,${clamp(player.deadT / 2, 0, 0.75)})`; g.fillRect(0, 0, VW, VH); const w = Math.min(VW - 40, 320), h = 64, x = VW / 2 - w / 2, y = VH / 2 - h / 2 - 10; roundRect(g, x, y, w, h, 5); g.fillStyle = 'rgba(20,15,13,0.92)'; g.fill(); roundRect(g, x + 3, y + 3, w - 6, h - 6, 3); g.strokeStyle = 'rgba(217,178,92,0.55)'; g.lineWidth = 1; g.stroke(); HK.text(g, 'You fell...', VW / 2, y + h / 2 + 12, { font: HK.FC(600, 32), align: 'center', color: HK.T.ink, shadow: 'rgba(0,0,0,0.9)' }); }
  drawHud(g);
}
function drawMinimap(g, x, y, size) {
  if (miniNeedsPaint()) refreshMini();
  const { across: tilesAcross, scale, sx, sy, view } = miniWindow(size);
  g.save(); roundRect(g, x, y, size, size, 10); g.clip();
  g.imageSmoothingEnabled = false; g.drawImage(miniCanvas, sx, sy, tilesAcross, tilesAcross, x, y, size, size); g.imageSmoothingEnabled = true;
  const dot = (wx, wy, color, r) => { g.fillStyle = color; g.beginPath(); g.arc(x + (wx / TILE - sx) * scale, y + (wy / TILE - sy) * scale, r, 0, 7); g.fill(); };
  for (const n of NPCS) if (onMiniMap(Math.floor(n.px / TILE), Math.floor(n.py / TILE))) dot(n.px, n.py, n.ghost ? '#b58cff' : '#ffe9a8', 1.6);
  for (const m of monsters) if (!m.dead) dot(m.x, m.y, MONSTER_DEFS[m.type].aggro ? '#ff6b6b' : '#f5c542', 1.6);
  if (player.home && !view.id) dot(player.home.x, player.home.y, '#7ec8ff', 3); // home is a place in the world, not in here
  dot(player.x, player.y, 'rgba(0,0,0,0.7)', 5); dot(player.x, player.y, '#ffffff', 3.5); // a dark rim: a white dot alone vanishes on Aerie's white cloud
  g.restore();
  // the HUD kit frames the map in its iron ring and clips it to the round glass (src/59-hudkit.js drawRing)
}
