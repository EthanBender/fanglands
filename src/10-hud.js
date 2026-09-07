// ============================================================================
// HUD AND PANELS
// ============================================================================
function drawSlot(g, x, y, size, slot, selected) {
  roundRect(g, x, y, size, size, 6); g.fillStyle = selected ? 'rgba(88,166,255,0.25)' : 'rgba(255,255,255,0.06)'; g.fill();
  g.strokeStyle = selected ? '#58a6ff' : 'rgba(255,255,255,0.12)'; g.lineWidth = selected ? 2 : 1; g.stroke();
  if (slot) {
    drawItemIcon(g, slot.id, x + size / 2, y + size / 2 - 2, size * 0.5);
    if (slot.qty > 1) { g.fillStyle = '#e6edf3'; g.font = 'bold 11px sans-serif'; g.textAlign = 'right'; g.fillText(slot.qty > 9999 ? Math.floor(slot.qty / 1000) + 'k' : slot.qty, x + size - 4, y + size - 4); }
  }
}
function button(g, x, y, w, h, label, action, color = '#238636', enabled = true) {
  roundRect(g, x, y, w, h, 8); g.fillStyle = enabled ? color : '#2a2f3a'; g.fill();
  g.fillStyle = enabled ? '#fff' : '#6e7681'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + h / 2); g.textBaseline = 'alphabetic';
  if (enabled) buttons.push({ x, y, w, h, label, action });
}
function panelBox(g, w, h, title, subtitle) {
  w = Math.min(w, VW - 20); h = Math.min(h, VH - 20);
  const px = Math.round(VW / 2 - w / 2), py = Math.round(Math.max(10, VH / 2 - h / 2 - 20));
  roundRect(g, px, py, w, h, 12); g.fillStyle = 'rgba(10,14,22,0.95)'; g.fill(); g.strokeStyle = '#30363d'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#e6edf3'; g.font = `700 17px ${DISPLAY}`; g.textAlign = 'left'; g.fillText(title, px + 18, py + 30);
  if (subtitle) { g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.fillText(subtitle, px + 18, py + 50); }
  button(g, px + w - 42, py + 12, 30, 26, '×', closePanel, '#21262d');
  return { px, py, w, h };
}
function drawInvGrid(g, x, y, cols, size, gap, onClick, swap = false) {
  for (let i = 0; i < INV_SLOTS; i++) {
    const cx = x + (i % cols) * (size + gap), cy = y + Math.floor(i / cols) * (size + gap);
    drawSlot(g, cx, cy, size, player.inv[i], selectedSlot === i);
    buttons.push({ x: cx, y: cy, w: size, h: size, label: 'slot' + i, action: () => { if (swap && selectedSlot >= 0 && selectedSlot !== i) { const a = player.inv[selectedSlot]; player.inv[selectedSlot] = player.inv[i]; player.inv[i] = a; selectedSlot = -1; save(); } else onClick(i); } });
  }
  return y + Math.ceil(INV_SLOTS / cols) * (size + gap);
}
function itemBlurb(def) {
  if (def.heal) return `Eat to heal ${def.heal}.`;
  if (def.weapon) return def.weapon.ranged ? 'Bow. Needs arrows in your pack.' : `Weapon: strength +${def.weapon.str}, accuracy +${def.weapon.att}${def.weapon.perk ? ', ' + def.weapon.perk : ''}.`;
  if (def.armour) return `${def.armour.slot}: defence +${def.armour.def}.`;
  if (def.place) return 'Place it in front of you.';
  if (def.burn) return 'Logs. Light a fire (Firemaking) or craft planks.';
  if (def.cook) return 'Raw. Cook it at a fire or oven.';
  if (def.tool) return { axe: 'Chops trees (E).', pickaxe: 'Mines rocks (E).', hoe: 'Tills grass for farming (E).', rod: 'Fish at water (E).', hammer: 'Needed at the anvil.' }[def.tool];
  if (def.seed) return 'Plant on tilled soil (E).';
  if (def.arrow) return `Arrows: strength +${def.arrow.str}. Equip a bow.`;
  if (def.throwable) return 'Throw it (use). Big boom.';
  return `Worth ${def.value} coins each.`;
}
function drawHud(g) {
  buttons.length = 0; minimapRect = null;
  g.textBaseline = 'alphabetic';
  const narrow = VW < 640, short = isTouch && VH < 500;
  // HP + combat + coins
  const hpw = narrow && isTouch ? VW - 108 : 250;
  roundRect(g, 14, 14, hpw, 62, 10); g.fillStyle = 'rgba(10,14,22,0.78)'; g.fill();
  g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText('HP', 26, 34);
  g.fillStyle = '#2a2f3a'; roundRect(g, 52, 22, 196, 14, 6); g.fill();
  g.fillStyle = player.hp / player.maxHp > 0.5 ? '#3fb950' : player.hp / player.maxHp > 0.25 ? '#d29922' : '#f85149'; roundRect(g, 52, 22, 196 * clamp(player.hp / player.maxHp, 0, 1), 14, 6); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 150, 33);
  g.textAlign = 'left'; g.font = '13px sans-serif'; g.fillStyle = '#f5c542'; drawItemIcon(g, 'coins', 32, 56, 13); g.fillText(`${coins()}`, 44, 60);
  g.fillStyle = '#c9d1d9'; g.fillText(`Combat ${combatLevel()}`, 120, 60);
  if (player.mech) { g.fillStyle = '#ffb347'; g.fillText(`Walker ${player.mech.hp}/${player.mech.maxHp}`, 190, 60); }
  // minimap (top-right)
  const mmSize = narrow ? 96 : 150, mmx = VW - mmSize - 14, mmy = 14;
  drawMinimap(g, mmx, mmy, mmSize); minimapRect = { x: mmx, y: mmy, w: mmSize, h: mmSize };
  g.fillStyle = 'rgba(230,237,243,0.6)'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText(isTouch ? 'tap for map' : 'M for map', mmx + mmSize / 2, mmy + mmSize + 12);
  // tracked quest (only when tracked)
  let qh = 0;
  if (quest.tracked && activeQuests().includes(quest.tracked)) {
    const qt = questText(quest.tracked); g.font = 'bold 13px sans-serif';
    const qw = narrow ? VW - 28 : Math.min(360, Math.max(260, g.measureText(qt).width + 40));
    qh = 54; const qx = narrow ? 14 : VW - mmSize - 14 - qw - 12, qy = narrow ? 84 : 14;
    roundRect(g, qx, qy, qw, qh, 10); g.fillStyle = 'rgba(10,14,22,0.78)'; g.fill();
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText(QUEST_DEFS[quest.tracked].name.toUpperCase(), qx + 20, qy + 18);
    g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif';
    let shown = qt; while (shown.length > 8 && g.measureText(shown + '…').width > qw - 40) shown = shown.slice(0, -1); g.fillText(shown === qt ? qt : shown + '…', qx + 20, qy + 40);
  }
  // hotbar: first five pack slots (keys 1–5)
  const hb = 44, hgap = 6, hw = 5 * (hb + hgap) + 60;
  const hx = short ? VW / 2 - hw / 2 + 30 : isTouch ? 14 : VW / 2 - hw / 2;
  const hy = short ? VH - 58 : isTouch ? (narrow ? 84 + qh + 8 : 90) : VH - 96;
  roundRect(g, hx - 6, hy - 6, hw + 6, hb + 12, 10); g.fillStyle = 'rgba(10,14,22,0.7)'; g.fill();
  for (let i = 0; i < 5; i++) {
    const sx = hx + i * (hb + hgap);
    drawSlot(g, sx, hy, hb, player.inv[i], false);
    if (!isTouch) { g.fillStyle = '#8b949e'; g.font = '9px sans-serif'; g.textAlign = 'left'; g.fillText(i + 1, sx + 3, hy + 10); }
    buttons.push({ x: sx, y: hy, w: hb, h: hb, label: 'hot' + i, action: () => useItem(i) });
  }
  button(g, hx + 5 * (hb + hgap), hy, 54, hb, isTouch ? 'BAG' : 'Bag (I)', () => panel === 'inventory' ? closePanel() : openPanel('inventory'), '#21262d');
  if (!isTouch) { g.fillStyle = 'rgba(230,237,243,0.75)'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText(player.mech ? 'WASD move · Space stomp · E crush planks · X climb out' : 'WASD move · Space swing · E use / talk · Q place · 1-5 use · I bag · C craft · Tab skills · J quests · M map · H home · ? help · Esc menu', VW / 2, VH - 16); }
  // touch controls
  if (isTouch) {
    if (touch.active) { g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(touch.ox, touch.oy, 60, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(touch.ox + touch.dx * 60, touch.oy + touch.dy * 60, 26, 0, 7); g.fill(); }
    else { g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(110, VH - 110, 60, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText('MOVE', 110, VH - 106); }
    const defs = [['SWING', () => touch.taps.push('attack'), 70, VW - 70, VH - 100], ['USE', () => touch.taps.push('use'), 52, VW - 160, VH - 66], [player.mech ? 'EXIT' : 'CRAFT', () => player.mech ? exitMech() : (panel === 'craft' ? closePanel() : openPanel('craft')), 52, VW - 160, VH - 160], ['QUESTS', () => panel === 'quests' ? closePanel() : openPanel('quests'), 52, VW - 70, VH - 200]];
    for (const [label, action, r, x, y] of defs) {
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.arc(x, y, r / 2 + 8, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText(label, x, y + 4);
      buttons.push({ x: x - r / 2 - 8, y: y - r / 2 - 8, w: r + 16, h: r + 16, label, action });
    }
    button(g, narrow ? VW - 74 : VW / 2 - 30, narrow ? 44 : 14, 60, 26, 'MENU', () => { paused = !paused; }, '#21262d');
    button(g, narrow ? VW - 74 : VW / 2 + 36, narrow ? 76 : 14, 60, 26, 'SKILLS', () => panel === 'skills' ? closePanel() : openPanel('skills'), '#21262d');
    button(g, narrow ? VW - 74 : VW / 2 + 102, narrow ? 108 : 14, 60, 26, 'HELP', () => panel === 'help' ? closePanel() : openPanel('help'), '#21262d');
  }
  for (const h of HOOKS.hud) h(g, narrow);
  drawPanels(g, narrow, short, qh, hb);
  // dialog
  if (dialog.cur) {
    const dw = short ? Math.max(260, VW - 400) : Math.min(720, VW - 40), dh = 92, dx = VW / 2 - dw / 2;
    const dy = short ? 100 : clamp(VH - dh - (isTouch ? 250 : 130), narrow ? 150 : 90, VH - dh - 10);
    const col = dialog.cur.who === 'The Voice' ? '#b58cff' : dialog.cur.who === 'Death' ? '#8fa2b8' : '#c9a36a';
    roundRect(g, dx, dy, dw, dh, 12); g.fillStyle = 'rgba(10,14,22,0.92)'; g.fill(); g.strokeStyle = col; g.lineWidth = 2; g.stroke();
    g.fillStyle = col; g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.fillText(dialog.cur.who.toUpperCase(), dx + 18, dy + 24);
    g.fillStyle = '#e6edf3'; g.font = '16px sans-serif';
    wrapText(g, dialog.cur.text.slice(0, dialog.shown), dx + 18, dy + 48, dw - 36, 20);
    g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'right'; g.fillText(isTouch ? 'tap to continue' : 'Enter to continue', dx + dw - 14, dy + dh - 10);
  }
  if (notice) { g.fillStyle = `rgba(10,14,22,${clamp(notice.t, 0, 0.85)})`; const nw = Math.min(VW - 20, 520); roundRect(g, VW / 2 - nw / 2, narrow ? 150 : 84, nw, 32, 8); g.fill(); g.fillStyle = `rgba(230,237,243,${clamp(notice.t, 0, 1)})`; g.font = '13px sans-serif'; g.textAlign = 'center'; let t = notice.text; while (g.measureText(t).width > nw - 20 && t.length > 8) t = t.slice(0, -2) + '…'; g.fillText(t, VW / 2, (narrow ? 150 : 84) + 21); }
  if (areaBanner) {
    const a = clamp(Math.min(areaBanner.t, 0.8) * 1.5, 0, 1);
    g.globalAlpha = a; g.fillStyle = '#e6edf3'; g.font = `800 ${narrow ? 22 : 30}px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.strokeText(areaBanner.name.toUpperCase(), VW / 2, VH * 0.22); g.fillText(areaBanner.name.toUpperCase(), VW / 2, VH * 0.22);
    g.font = '13px sans-serif'; g.fillStyle = '#c9a36a'; g.strokeText(areaBanner.sub, VW / 2, VH * 0.22 + 22); g.fillText(areaBanner.sub, VW / 2, VH * 0.22 + 22);
    g.globalAlpha = 1;
  }
  if (levelBanner) {
    const a = clamp(Math.min(levelBanner.t, 1) * 1.2, 0, 1);
    g.globalAlpha = a; g.fillStyle = '#f5c542'; g.font = `800 ${narrow ? 24 : 34}px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.strokeText(levelBanner.text, VW / 2, VH * 0.34); g.fillText(levelBanner.text, VW / 2, VH * 0.34);
    g.font = 'bold 14px sans-serif'; g.fillStyle = '#e6edf3'; g.strokeText(levelBanner.sub, VW / 2, VH * 0.34 + 26); g.fillText(levelBanner.sub, VW / 2, VH * 0.34 + 26);
    g.globalAlpha = 1;
  }
  if (paused) {
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, VW, VH);
    const pw = 300, ph = 250, px = VW / 2 - pw / 2, py = VH / 2 - ph / 2;
    roundRect(g, px, py, pw, ph, 12); g.fillStyle = 'rgba(10,14,22,0.96)'; g.fill(); g.strokeStyle = '#30363d'; g.stroke();
    g.fillStyle = '#e6edf3'; g.font = `800 24px ${DISPLAY}`; g.textAlign = 'center'; g.fillText('FANGLANDS', VW / 2, py + 40);
    g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.fillText(quest.stage >= 7 ? 'Chapter 3 · Goblin Tech' : quest.stage >= 5 ? 'Chapter 2 · Thistledown' : 'Chapter 1 · The Cave', VW / 2, py + 60);
    button(g, px + 24, py + 78, pw - 48, 36, 'Resume', () => { paused = false; });
    button(g, px + 24, py + 120, pw - 48, 36, audioMuted ? 'Sound: off' : 'Sound: on', toggleMute, '#21262d');
    button(g, px + 24, py + 162, pw - 48, 36, 'New game (erases save)', () => { newGame(); }, '#8b2e2e');
    g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(`Kills ${player.kills} · Deaths ${player.deaths} · Best hit ${player.highestHit}`, VW / 2, py + 208);
    g.fillText('Progress saves automatically in this browser.', VW / 2, py + 228);
  }
}
function drawPanels(g, narrow, short, qh, hb) {
  const gridCols = narrow ? 5 : 10;
  if (panel && HOOKS.panel[panel]) { HOOKS.panel[panel](g, narrow); return; }
  if (panel === 'skills') {
    const pw = 270, ph = 40 + SKILL_DEFS.length * 34;
    const px = 14, py = narrow ? 84 + qh + 8 + (isTouch ? hb + 20 : 0) : 90;
    roundRect(g, px, py, pw, ph, 10); g.fillStyle = 'rgba(10,14,22,0.92)'; g.fill();
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText(`SKILLS · combat level ${combatLevel()}`, px + 12, py + 18);
    SKILL_DEFS.forEach((s, i) => {
      const y = py + 30 + i * 34, sk = player.skills[s.key], lv = levelForXp(sk.xp);
      const locked = s.needs && sk.xp === 0 && !hasTool(s.needs === 'a bow' ? 'bow' : s.needs === 'an axe' ? 'axe' : s.needs === 'a pickaxe' ? 'pickaxe' : s.needs === 'a rod' ? 'rod' : 'hoe') && !(s.key === 'range' && (player.equip.weapon === 'shortbow' || countItem('shortbow')));
      g.fillStyle = locked ? '#6e7681' : '#e6edf3'; g.font = 'bold 12px sans-serif'; g.fillText(s.name, px + 12, y + 11);
      g.fillStyle = locked ? '#6e7681' : '#f5c542'; g.textAlign = 'right'; g.fillText(locked ? `needs ${s.needs}` : `Lv ${lv}`, px + pw - 12, y + 11); g.textAlign = 'left';
      g.fillStyle = '#2a2f3a'; roundRect(g, px + 12, y + 15, pw - 24, 5, 3); g.fill();
      if (!locked) { const cur = sk.xp - xpForLevel(lv), need = xpForLevel(lv + 1) - xpForLevel(lv); g.fillStyle = '#58a6ff'; roundRect(g, px + 12, y + 15, (pw - 24) * clamp(cur / need, 0, 1), 5, 3); g.fill(); g.fillStyle = '#6e7681'; g.font = '9px sans-serif'; g.fillText(`${cur} / ${need} xp`, px + 12, y + 29); }
    });
  }
  if (panel === 'help') {
    const rows = isTouch
      ? [['Left side of screen', 'drag to move'], ['SWING', 'attack / hit a dummy'], ['USE', 'talk, chop, mine, fish, cook, open, enter'], ['BAG', 'pack + worn gear (tap, tap = swap)'], ['Hotbar', 'tap a slot to eat or use it'], ['CRAFT / SKILLS / QUESTS', 'panels'], ['Minimap', 'tap for the world map'], ['MENU', 'sound, new game']]
      : [['WASD / arrows', 'move'], ['Space', 'swing, shoot, stomp'], ['E', 'talk, chop, mine, fish, cook, open, enter'], ['Q', 'place a plank, door, bed, lodestone or trap'], ['1–5', 'eat or use the first five pack slots'], ['I / C / Tab / J / M', 'pack · craft · skills · quests · map'], ['H', 'teleport home (lodestone, 5 min)'], ['X', 'climb out of a machine'], ['Enter', 'next line of talk'], ['Esc', 'menu (sound, new game)']];
    const { px, py, w } = panelBox(g, 480, 90 + rows.length * 26, 'How to play', 'Every skill trains by doing. Die and Death keeps your pack.');
    rows.forEach(([k, v], i) => { const y = py + 78 + i * 26; g.fillStyle = '#f5c542'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(k, px + 18, y); g.fillStyle = '#c9d1d9'; g.font = '13px sans-serif'; g.fillText(v, px + 190, y); });
  }
  if (panel === 'quests') {
    const list = activeQuests(); const done = []; if (quest.bread === 'done') done.push('bread'); if (quest.wren === 'done') done.push('wren');
    const { px, py, w } = panelBox(g, 460, 120 + list.length * 74 + done.length * 20, 'Quests', 'Track one to keep it on screen.');
    let y = py + 70;
    for (const id of list) {
      const tracked = quest.tracked === id;
      roundRect(g, px + 18, y, w - 36, 64, 8); g.fillStyle = tracked ? 'rgba(88,166,255,0.12)' : 'rgba(255,255,255,0.05)'; g.fill();
      g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(QUEST_DEFS[id].name + (id === 'main' ? '  · main story' : '  · side quest'), px + 30, y + 20);
      g.fillStyle = '#c9d1d9'; g.font = '12px sans-serif'; let t = questText(id); while (g.measureText(t).width > w - 180 && t.length > 8) t = t.slice(0, -2) + '…'; g.fillText(t, px + 30, y + 42);
      button(g, px + w - 120, y + 16, 90, 30, tracked ? 'Untrack' : 'Track', () => { quest.tracked = tracked ? null : id; save(); }, tracked ? '#21262d' : '#238636');
      y += 74;
    }
    for (const id of done) { g.fillStyle = '#6e7681'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(`✓ ${QUEST_DEFS[id].name} — done`, px + 30, y + 12); y += 20; }
  }
  if (panel === 'map') {
    const mw = Math.min(VW - 40, 760), mh = Math.min(VH - 60, mw * MAP_H / MAP_W + 70);
    const { px, py, w, h } = panelBox(g, mw, mh, 'The Fanglands', 'White: you. Blue: home. Gold: quest. Tap anywhere to close.');
    if (miniDirty || miniDiffCount !== mapDiffs.size) refreshMini();
    const iw = w - 36, ih = Math.min(h - 80, iw * MAP_H / MAP_W), ix = px + 18, iy = py + 62; const sc = iw / MAP_W;
    g.save(); roundRect(g, ix, iy, iw, ih, 8); g.clip(); g.imageSmoothingEnabled = false; g.drawImage(miniCanvas, 0, 0, MAP_W, MAP_H, ix, iy, iw, MAP_W * sc * MAP_H / MAP_W); g.imageSmoothingEnabled = true;
    for (const r of REGIONS) { if (r.name === 'Goblin Fields' || r.name === 'The Wilds') continue; const cx = ix + (r.x0 + r.x1 + 1) / 2 * sc, cy = iy + (r.y0 + r.y1 + 1) / 2 * sc; g.font = `700 ${Math.max(9, sc * 2.2)}px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(r.name.toUpperCase(), cx, cy); g.fillStyle = '#e6edf3'; g.fillText(r.name.toUpperCase(), cx, cy); }
    const dot = (wx, wy, color, r) => { g.fillStyle = color; g.beginPath(); g.arc(ix + wx / TILE * sc, iy + wy / TILE * sc, r, 0, 7); g.fill(); };
    if (player.home) dot(player.home.x, player.home.y, '#7ec8ff', 4);
    const target = quest.stage <= 4 ? { x: tc(SIGN_TILE.x), y: tc(SIGN_TILE.y) } : quest.stage <= 6 ? { x: tc(112), y: tc(49) } : quest.stage === 7 && !quest.walkerKilled ? { x: tc(152), y: tc(30) } : { x: tc(112), y: tc(49) };
    if (quest.tracked === 'main') { g.strokeStyle = '#f5c542'; g.lineWidth = 2; g.beginPath(); g.arc(ix + target.x / TILE * sc, iy + target.y / TILE * sc, 6 + Math.sin(time * 4) * 2, 0, 7); g.stroke(); }
    dot(player.x, player.y, '#ffffff', 4);
    g.restore();
  }
  if (panel === 'inventory') {
    const cols = gridCols, size = narrow ? 44 : 46, gap = 6;
    const eqw = 70;
    const { px, py, w, h } = panelBox(g, cols * (size + gap) + 30 + eqw, narrow ? 420 : 300, 'Your pack', `${player.inv.filter(Boolean).length} / ${INV_SLOTS} slots · tap one, then another, to swap`);
    const gy = drawInvGrid(g, px + 18 + eqw, py + 66, cols, size, gap, i => { selectedSlot = selectedSlot === i ? -1 : i; }, true);
    // equipment column
    g.fillStyle = '#8b949e'; g.font = 'bold 10px sans-serif'; g.textAlign = 'left'; g.fillText('WORN', px + 18, py + 62);
    EQUIP_SLOTS.forEach((k, i) => {
      const ey = py + 66 + i * (size + gap) * (narrow ? 0.8 : 1); const id = player.equip[k];
      drawSlot(g, px + 18, ey, size, id ? { id, qty: 1 } : null, false);
      if (!id) { g.fillStyle = '#4b535d'; g.font = '9px sans-serif'; g.textAlign = 'center'; g.fillText(k, px + 18 + size / 2, ey + size / 2 + 3); }
      else buttons.push({ x: px + 18, y: ey, w: size, h: size, label: 'eq' + k, action: () => unequip(k) });
    });
    g.fillStyle = '#6e7681'; g.font = '10px sans-serif'; g.textAlign = 'left'; g.fillText(`str +${gearBonus('str')}  acc +${gearBonus('att')}  def +${gearBonus('def')}  max hit ${playerMaxHit()}`, px + 18 + eqw, gy + 8);
    const s = selectedSlot >= 0 ? player.inv[selectedSlot] : null;
    if (s) {
      const def = ITEMS[s.id];
      g.fillStyle = '#e6edf3'; g.font = 'bold 14px sans-serif'; g.textAlign = 'left'; g.fillText(`${def.name} × ${s.qty}`, px + 18 + eqw, gy + 30);
      g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.fillText(itemBlurb(def), px + 18 + eqw, gy + 48);
      let bx = px + 18 + eqw; const by = gy + 58;
      const act = def.heal ? 'Eat' : (def.weapon || def.armour) ? 'Equip' : def.place ? 'Place' : def.burn ? 'Light fire' : def.throwable ? 'Throw' : null;
      if (act) { button(g, bx, by, 90, 30, act, () => { const i = selectedSlot; useItem(i); if (act !== 'Equip') return; selectedSlot = -1; }); bx += 98; }
      button(g, bx, by, 80, 30, 'Drop', () => { const q = player.inv[selectedSlot]; if (!q) return; drops.push({ x: player.x + player.facing.x * 30, y: player.y + player.facing.y * 30, id: q.id, qty: q.qty, t: 0 }); player.inv[selectedSlot] = null; selectedSlot = -1; save(); }, '#8b2e2e');
      if (player.home) button(g, bx + 88, by, 90, 30, 'Home (H)', goHome, '#21262d');
    } else { g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText('Tap an item. Tap a worn piece to take it off. Keys 1–5 use the first five slots.', px + 18 + eqw, gy + 30); }
  }
  if (panel === 'bank') {
    const cols = gridCols, size = 40, gap = 5;
    const { px, py, w } = panelBox(g, cols * (size + gap) + 30, narrow ? 520 : 400, 'Bank of Thistledown', `${player.bank.length} / ${BANK_SLOTS} vault slots · tap to move items`);
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText('VAULT', px + 18, py + 70);
    const rows = 3;
    for (let i = 0; i < cols * rows; i++) {
      const cx = px + 18 + (i % cols) * (size + gap), cy = py + 78 + Math.floor(i / cols) * (size + gap), b = player.bank[i];
      drawSlot(g, cx, cy, size, b, false);
      if (b) buttons.push({ x: cx, y: cy, w: size, h: size, label: 'bank' + i, action: () => { const left = addItem(b.id, b.qty); b.qty = left; if (!left) player.bank.splice(i, 1); if (left) notify('Your pack is full.'); save(); } });
    }
    if (player.bank.length > cols * rows) { g.fillStyle = '#8b949e'; g.font = '11px sans-serif'; g.fillText(`+${player.bank.length - cols * rows} more stacks`, px + 18, py + 78 + rows * (size + gap) + 12); }
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.fillText('YOUR PACK', px + 18, py + 78 + rows * (size + gap) + 30);
    drawInvGrid(g, px + 18, py + 78 + rows * (size + gap) + 38, cols, size, gap, i => { const s = player.inv[i]; if (!s) return; if (bankAdd(s.id, s.qty)) { player.inv[i] = null; save(); } else notify('The vault is full.'); });
  }
  if (panel === 'shop') {
    const shop = SHOPS[panelArg] || { name: "Fennick's Stall", stock: [], buys: ['wolf_pelt', 'boar_tusk', 'wool', 'spider_silk', 'goblin_scrap', 'coal'], rate: 1 };
    const cols = gridCols, size = 40, gap = 5; const rate = shop.rate || 0.6;
    const { px, py, w } = panelBox(g, cols * (size + gap) + 30, 200 + shop.stock.length * 38 + Math.ceil(INV_SLOTS / cols) * (size + gap), shop.name, `${coins()} coins · buy on the left, tap your pack to sell`);
    shop.stock.forEach(([id, price], i) => {
      const y = py + 62 + i * 38; const def = ITEMS[id]; const can = coins() >= price;
      roundRect(g, px + 18, y, w - 36, 32, 8); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill();
      drawItemIcon(g, id, px + 38, y + 16, 18);
      g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(def.name, px + 58, y + 20);
      if (!narrow) { g.fillStyle = '#8b949e'; g.font = '11px sans-serif'; g.fillText(itemBlurb(def), px + 190, y + 20); }
      button(g, px + w - 120, y + 3, 96, 26, `Buy ${price}`, () => { if (!payCoins(price)) { notify('Not enough coins.'); return; } if (addItem(id, 1) > 0) { addItem('coins', price); notify('Your pack is full.'); return; } floatText(player.x, player.y - 30, `Bought ${def.name}`, def.color); save(); }, can ? '#238636' : '#2a2f3a', can);
    });
    const gy = py + 62 + shop.stock.length * 38 + 12;
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText(shop.buys ? `SELLS FOR FULL PRICE: ${shop.buys.map(i => ITEMS[i].name).join(', ')}` : `SELL FROM YOUR PACK (${Math.round(rate * 100)}% of value)`, px + 18, gy);
    drawInvGrid(g, px + 18, gy + 8, cols, size, gap, i => { const s = player.inv[i]; if (!s || s.id === 'coins') return; if (shop.buys && !shop.buys.includes(s.id)) { notify('Fennick only wants pelts, tusks, wool, silk, scrap and coal.'); return; } const price = Math.max(1, Math.floor(ITEMS[s.id].value * rate)); s.qty -= 1; if (s.qty <= 0) player.inv[i] = null; addItem('coins', price); floatText(player.x, player.y - 30, `+${price} coins`, '#ffd166'); save(); });
  }
  if (panel === 'craft' || panel === 'station') {
    const station = panel === 'craft' ? null : panelArg;
    const list = station === 'forge' ? SMELT : RECIPES.filter(r => r.station === station);
    const titles = { forge: 'Forge — smelting', anvil: 'Anvil — smithing (needs a hammer)', workbench: 'Workbench', workshop: "Tinker's table — traps and arrows", alchemy: 'Alchemy table — bombs' };
    const skillKey = station === 'forge' || station === 'anvil' ? 'smithing' : 'crafting';
    const { px, py, w, h } = panelBox(g, 420, Math.min(VH - 20, 90 + list.length * 40), station ? titles[station] : 'Crafting', station ? `${SKILL_DEFS.find(s => s.key === skillKey).name} level ${skillLv(skillKey)}` : 'Simple things craft from your pack. Stations in Thistledown make the rest.');
    const maxRows = Math.floor((h - 80) / 40);
    list.slice(0, maxRows).forEach((r, i) => {
      const y = py + 62 + i * 40; const rec = station === 'forge' ? { ...r, station: 'forge', skill: 'smithing', qty: 1 } : r;
      const has = rec.needs.every(([id, q]) => countItem(id) >= q); const lvOk = !rec.skill || skillLv(rec.skill) >= rec.lv; const can = has && lvOk && !(station === 'anvil' && !hasTool('hammer'));
      button(g, px + 18, y, w - 36, 34, rec.label + (rec.lv > 1 ? `  (lv ${rec.lv})` : ''), () => craft(rec), can ? '#238636' : '#2a2f3a', can);
    });
    if (station === 'anvil' && !hasTool('hammer')) { g.fillStyle = '#ff6b6b'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText('You need a hammer in your pack.', px + 18, py + h - 12); }
  }
  if (panel === 'coffin') {
    const { px, py, w, h } = panelBox(g, 460, 340, "Death's Chest", 'Piles of his gold. A chest of what you lost.');
    g.fillStyle = '#b58cff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText('DEATH', px + 18, py + 76);
    g.fillStyle = '#e6edf3'; g.font = '14px sans-serif';
    if (!deathKeep) { wrapText(g, "The chest is empty. For now. When you fall, what you carry comes here. Cheap things I return for nothing. Precious things cost a quarter of their worth, and I take it from your own coin first.", px + 18, py + 98, w - 36, 19); }
    else {
      const fee = coffinFee(); const held = deathKeep.items.find(s => s.id === 'coins'); const fromHeld = held ? Math.min(held.qty, fee) : 0; const rest = fee - fromHeld;
      wrapText(g, fee ? `Your pack is in the chest. The fee is ${fee} coins${fromHeld ? `, ${fromHeld} of it from the purse you dropped` : ''}${rest ? `, ${rest} from your hand` : ''}.` : 'Your pack is in the chest. Nothing in it is worth my time. Take it, and try not to fall again.', px + 18, py + 98, w - 36, 19);
      deathKeep.items.slice(0, 7).forEach((s, i) => { const y = py + 156 + i * 20; drawItemIcon(g, s.id, px + 28, y - 4, 16); g.fillStyle = '#c9d1d9'; g.font = '13px sans-serif'; g.textAlign = 'left'; g.fillText(`${ITEMS[s.id].name} × ${s.qty}`, px + 44, y); const v = ITEMS[s.id].value * s.qty; g.fillStyle = s.id !== 'coins' && v >= 20 ? '#f5c542' : '#6e7681'; g.textAlign = 'right'; g.fillText(s.id !== 'coins' && v >= 20 ? `${Math.ceil(v * 0.25)}c` : 'free', px + w - 18, y); });
      if (deathKeep.items.length > 7) { g.fillStyle = '#8b949e'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText(`+${deathKeep.items.length - 7} more`, px + 44, py + 156 + 7 * 20); }
      const ok = coins() >= rest;
      button(g, px + 18, py + h - 52, w - 36, 36, fee ? `Reclaim everything for ${fee} coins` : 'Reclaim everything', reclaimFromDeath, ok ? '#5a2e7a' : '#2a2f3a', ok);
    }
  }
}
function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '';
  for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; } else line = test; }
  if (line) g.fillText(line, x, y);
}
