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
// Disabled buttons are still registered (as inert hit rects, label prefixed 'disabled:') so a tap on a greyed button does not fall through to the panel/world.
function button(g, x, y, w, h, label, action, color = '#238636', enabled = true) {
  roundRect(g, x, y, w, h, 8); g.fillStyle = enabled ? color : '#2a2f3a'; g.fill();
  g.fillStyle = enabled ? '#fff' : '#6e7681'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + h / 2); g.textBaseline = 'alphabetic';
  buttons.push(enabled ? { x, y, w, h, label, action } : { x, y, w, h, label: 'disabled:' + label, action: () => { }, disabled: true });
}
function panelBox(g, w, h, title, subtitle) {
  w = Math.min(w, VW - 20); h = Math.min(h, VH - 20);
  const px = Math.round(VW / 2 - w / 2), py = Math.round(Math.max(10, VH / 2 - h / 2 - 20));
  roundRect(g, px, py, w, h, 12); g.fillStyle = 'rgba(10,14,22,0.95)'; g.fill(); g.strokeStyle = '#30363d'; g.lineWidth = 1; g.stroke();
  g.fillStyle = '#e6edf3'; g.font = `700 17px ${DISPLAY}`; g.textAlign = 'left'; g.fillText(title, px + 18, py + 30);
  if (subtitle) { g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.fillText(subtitle, px + 18, py + 50); }
  button(g, px + w - 56, py + 10, 44, 36, '×', closePanel, '#21262d');
  panelRect = { x: px, y: py, w, h };
  return { px, py, w, h };
}
// Prev / Next row. Returns the page actually shown (clamped).
function pager(g, x, y, w, page, pages, setPage) {
  const p = clamp(page, 0, Math.max(0, pages - 1));
  button(g, x, y, 80, 30, 'Prev', () => setPage(p - 1), '#21262d', p > 0);
  g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText(`${p + 1} / ${pages}`, x + w / 2, y + 19);
  button(g, x + w - 80, y, 80, 30, 'Next', () => setPage(p + 1), '#21262d', p < pages - 1);
  return p;
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
  const E = keyName('E');
  if (def.heal) return `Eat to heal ${def.heal}.`;
  if (def.weapon) return def.weapon.ranged ? 'Bow. Needs arrows in your pack.' : `Weapon: strength +${def.weapon.str}, accuracy +${def.weapon.att}${def.weapon.perk ? ', ' + def.weapon.perk : ''}.`;
  if (def.armour) return `${def.armour.slot}: defence +${def.armour.def}.`;
  if (def.place) return 'Place it in front of you.';
  if (def.burn) return 'Logs. Light a fire (Firemaking) or craft planks.';
  if (def.cook) return 'Raw. Cook it at a fire or oven.';
  if (def.tool) return { axe: `Chops trees (${E}).`, pickaxe: `Mines rocks (${E}).`, hoe: `Tills grass for farming (${E}).`, rod: `Fish at water (${E}).`, hammer: 'Needed at the anvil.' }[def.tool];
  if (def.seed) return `Plant on tilled soil (${E}).`;
  if (def.arrow) return `Arrows: strength +${def.arrow.str}. Equip a bow.`;
  if (def.throwable) return 'Throw it (use). Big boom.';
  return `Worth ${def.value} coins each.`;
}
function drawHud(g) {
  buttons.length = 0; minimapRect = null; dialogRect = null; panelRect = null;
  g.textBaseline = 'alphabetic';
  const narrow = VW < 640, short = isTouch && VH < 500;
  const mmSize = narrow ? 96 : 150, mmx = VW - mmSize - 14, mmy = 14;
  // HP + combat + coins (never under the minimap)
  const hpw = narrow && isTouch ? Math.min(250, mmx - 14 - 10) : 250;
  roundRect(g, 14, 14, hpw, 62, 10); g.fillStyle = 'rgba(10,14,22,0.78)'; g.fill();
  const barW = Math.min(196, hpw - 62);
  g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText('HP', 26, 34);
  g.fillStyle = '#2a2f3a'; roundRect(g, 52, 22, barW, 14, 6); g.fill();
  g.fillStyle = player.hp / player.maxHp > 0.5 ? '#3fb950' : player.hp / player.maxHp > 0.25 ? '#d29922' : '#f85149'; roundRect(g, 52, 22, barW * clamp(player.hp / player.maxHp, 0, 1), 14, 6); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 52 + barW / 2, 33);
  g.textAlign = 'left'; g.font = '13px sans-serif'; g.fillStyle = '#f5c542'; drawItemIcon(g, 'coins', 32, 56, 13); g.fillText(`${coins()}`, 44, 60);
  g.fillStyle = '#c9d1d9'; g.fillText(`Combat ${combatLevel()}`, 120, 60);
  if (player.mech) { g.fillStyle = '#ffb347'; g.fillText(`Walker ${player.mech.hp}/${player.mech.maxHp}`, 190, 60); }
  else if (window.__kidmode) { g.fillStyle = '#7ec8ff'; g.font = 'bold 11px sans-serif'; g.fillText('Kid mode', 190, 60); }
  // minimap (top-right) + compass toward the tracked quest
  drawMinimap(g, mmx, mmy, mmSize); minimapRect = { x: mmx, y: mmy, w: mmSize, h: mmSize };
  drawCompass(g, mmx, mmy, mmSize);
  g.fillStyle = 'rgba(230,237,243,0.6)'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText(isTouch ? 'tap for map' : 'M for map', mmx + mmSize / 2, mmy + mmSize + 12);
  // phone: MENU / SKILLS / HELP stack under the minimap; the quest box, notice slot and hotbar follow below
  let topStackBottom = 76;
  if (isTouch && narrow) {
    const bx = VW - 74, by = mmy + mmSize + 16;
    button(g, bx, by, 60, 28, 'MENU', () => { paused = !paused; }, '#21262d');
    button(g, bx, by + 34, 60, 28, 'SKILLS', () => panel === 'skills' ? closePanel() : openPanel('skills'), '#21262d');
    button(g, bx, by + 68, 60, 28, 'HELP', () => panel === 'help' ? closePanel() : openPanel('help'), '#21262d');
    topStackBottom = by + 68 + 28;
  }
  // tracked quest (only when tracked). Placement: desktop → left of the minimap; phone → under the MENU stack;
  // landscape phone (short) → under the HP box; tablet → beside the hotbar. Never under the MENU/SKILLS/HELP row.
  let qh = 0;
  const qy = !isTouch ? 14 : narrow ? topStackBottom + 10 : short ? 84 : 90;
  if (quest.tracked && activeQuests().includes(quest.tracked)) {
    const qt = questText(quest.tracked); g.font = 'bold 13px sans-serif';
    const qw = !isTouch ? Math.min(360, Math.max(260, g.measureText(qt).width + 40)) : narrow ? VW - 28 : short ? Math.min(300, VW / 2 - 40) : clamp(VW - 334 - mmSize - 14 - 24, 200, 360);
    qh = 54; const qx = !isTouch ? VW - mmSize - 14 - qw - 12 : narrow || short ? 14 : 334;
    roundRect(g, qx, qy, qw, qh, 10); g.fillStyle = 'rgba(10,14,22,0.78)'; g.fill();
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText(QUEST_DEFS[quest.tracked].name.toUpperCase(), qx + 20, qy + 18);
    g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif';
    let shown = qt; while (shown.length > 8 && g.measureText(shown + '…').width > qw - 40) shown = shown.slice(0, -1); g.fillText(shown === qt ? qt : shown + '…', qx + 20, qy + 40);
  }
  const questSlotH = narrow ? 54 : qh; // phones reserve the quest slot so the hotbar does not jump
  const noticeY = narrow ? qy + questSlotH + 8 : short ? 46 : 84; // short: the strip between the HP box and the minimap, clear of the quest box and dialogue
  // hotbar: first five pack slots (keys 1–5)
  const hb = 44, hgap = 6, hw = 5 * (hb + hgap) + 60;
  const hx = short ? VW / 2 - hw / 2 + 30 : isTouch ? 14 : VW / 2 - hw / 2;
  const hy = short ? VH - 58 : isTouch ? (narrow ? noticeY + 32 + 10 : 90) : VH - 96;
  roundRect(g, hx - 6, hy - 6, hw + 6, hb + 12, 10); g.fillStyle = 'rgba(10,14,22,0.7)'; g.fill();
  for (let i = 0; i < 5; i++) {
    const sx = hx + i * (hb + hgap);
    drawSlot(g, sx, hy, hb, player.inv[i], false);
    if (!isTouch) { g.fillStyle = '#8b949e'; g.font = '9px sans-serif'; g.textAlign = 'left'; g.fillText(i + 1, sx + 3, hy + 10); }
    buttons.push({ x: sx, y: hy, w: hb, h: hb, label: 'hot' + i, action: () => useItem(i) });
  }
  button(g, hx + 5 * (hb + hgap), hy, 54, hb, isTouch ? 'BAG' : 'Bag (I)', () => panel === 'inventory' ? closePanel() : openPanel('inventory'), '#21262d');
  Object.assign(HUD_LAYOUT, { narrow, short, hotbarY: hy, hotbarH: hb, questY: qy, questH: qh, noticeY, topStackBottom, bossBarY: isTouch ? (narrow ? hy + hb + 12 : short ? 84 + (qh ? qh + 8 : 0) : 152) : 84 });
  if (!isTouch) { g.fillStyle = 'rgba(230,237,243,0.75)'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText(player.mech ? 'WASD move · click to walk · Space stomp · E crush planks · X climb out' : 'WASD move · click to walk · Space swing · E use / talk · Q place · 1-5 use · I bag · C craft · Tab skills · J quests · M map · H home · ? help · Esc menu', VW / 2, VH - 16); }
  else if (!short) { // touch: one line between the stick and the buttons; it shortens on phones instead of running under them (landscape phones have no free edge for it)
    const maxW = Math.max(120, VW - 460); g.fillStyle = 'rgba(230,237,243,0.7)'; g.font = '11px sans-serif'; g.textAlign = 'center';
    let t = 'Tap to walk · tap a tree, rock, water or person to use it · tap a monster to fight · SWING · USE · BAG';
    if (g.measureText(t).width > maxW) t = 'Tap to walk · tap things to use them · tap a monster to fight';
    while (g.measureText(t).width > maxW && t.length > 12) t = t.slice(0, -2) + '…';
    g.fillText(t, VW / 2, VH - 8);
  }
  // touch controls
  if (isTouch) {
    if (touch.active) { g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(touch.ox, touch.oy, 60, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(touch.ox + touch.dx * 60, touch.oy + touch.dy * 60, 26, 0, 7); g.fill(); }
    else { g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(110, VH - 110, 60, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText('MOVE', 110, VH - 106); }
    const defs = [['SWING', () => touch.taps.push('attack'), 70, VW - 70, VH - 100], ['USE', () => touch.taps.push('use'), 52, VW - 160, VH - 66], [player.mech ? 'EXIT' : 'CRAFT', () => player.mech ? exitMech() : (panel === 'craft' ? closePanel() : openPanel('craft')), 52, VW - 160, VH - 160], ['QUESTS', () => panel === 'quests' ? closePanel() : openPanel('quests'), 52, VW - 70, VH - 200]];
    if (player.home && !player.mech) defs.push(['HOME', goHome, 52, VW - 160, VH - 254]);
    for (const [label, action, r, x, y] of defs) {
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.arc(x, y, r / 2 + 8, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText(label, x, y + 4);
      buttons.push({ x: x - r / 2 - 8, y: y - r / 2 - 8, w: r + 16, h: r + 16, label, action });
    }
    if (!narrow) {
      button(g, VW / 2 - 30, 14, 60, 26, 'MENU', () => { paused = !paused; }, '#21262d');
      button(g, VW / 2 + 36, 14, 60, 26, 'SKILLS', () => panel === 'skills' ? closePanel() : openPanel('skills'), '#21262d');
      button(g, VW / 2 + 102, 14, 60, 26, 'HELP', () => panel === 'help' ? closePanel() : openPanel('help'), '#21262d');
    }
  }
  drawBossBars(g, HUD_LAYOUT.bossBarY);
  for (const h of HOOKS.hud) h(g, narrow);
  drawPanels(g, narrow, short, qh, hb);
  // dialog: the box grows to fit its wrapped lines and waits for a tap (the update loop auto-advances only after 4 + len/9 s)
  if (dialog.cur) {
    const dw = short ? Math.max(260, VW - 400) : Math.min(720, VW - 40), dx = VW / 2 - dw / 2;
    g.font = '16px sans-serif'; const lines = dialogLines(g, dialog.cur.text, dw - 36); const dh = 60 + lines * 20;
    const dy = short ? 150 : clamp(VH - dh - (isTouch ? (narrow ? 300 : 250) : 130), narrow ? 150 : 90, VH - dh - 10);
    const col = dialog.cur.who === 'The Voice' ? '#b58cff' : dialog.cur.who === 'Death' ? '#8fa2b8' : '#c9a36a';
    roundRect(g, dx, dy, dw, dh, 12); g.fillStyle = 'rgba(10,14,22,0.92)'; g.fill(); g.strokeStyle = col; g.lineWidth = 2; g.stroke();
    g.fillStyle = col; g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.fillText(dialog.cur.who.toUpperCase(), dx + 18, dy + 24);
    g.fillStyle = '#e6edf3'; g.font = '16px sans-serif';
    wrapText(g, dialog.cur.text.slice(0, dialog.shown), dx + 18, dy + 48, dw - 36, 20);
    g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'right'; g.fillText(isTouch ? 'tap here to continue' : 'Enter or click here to continue', dx + dw - 14, dy + dh - 10);
    dialogRect = { x: dx, y: dy, w: dw, h: dh };
  }
  if (notice) { g.fillStyle = `rgba(10,14,22,${clamp(notice.t, 0, 0.85)})`; const nw = short ? Math.min(520, VW - 274 - mmSize - 24) : Math.min(VW - 20, 520), nx = short ? 274 : VW / 2 - nw / 2; roundRect(g, nx, noticeY, nw, 32, 8); g.fill(); g.fillStyle = `rgba(230,237,243,${clamp(notice.t, 0, 1)})`; g.font = '13px sans-serif'; g.textAlign = 'center'; let t = notice.text; while (g.measureText(t).width > nw - 20 && t.length > 8) t = t.slice(0, -2) + '…'; g.fillText(t, nx + nw / 2, noticeY + 21); }
  if (areaBanner) {
    const a = clamp(Math.min(areaBanner.t, 0.8) * 1.5, 0, 1);
    g.globalAlpha = a; g.fillStyle = '#e6edf3'; g.font = `800 ${narrow ? 22 : 30}px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.strokeText(areaBanner.name.toUpperCase(), VW / 2, VH * 0.22); g.fillText(areaBanner.name.toUpperCase(), VW / 2, VH * 0.22);
    g.font = '13px sans-serif'; g.fillStyle = '#c9a36a'; g.strokeText(areaBanner.sub, VW / 2, VH * 0.22 + 22); g.fillText(areaBanner.sub, VW / 2, VH * 0.22 + 22);
    g.globalAlpha = 1;
  }
  // level banners: the live one, then up to one displaced banner 40 px lower (smaller, so the two never touch)
  const banners = [];
  if (levelBanner) banners.push(levelBanner);
  if (bannerQueue.length) banners.push(bannerQueue[0]);
  banners.slice(0, 2).forEach((b, i) => {
    const a = clamp(Math.min(b.t, 1) * 1.2, 0, 1); const by = VH * 0.34 + (i ? 40 + 14 : 0);
    g.globalAlpha = a; g.fillStyle = i ? '#e6c76a' : '#f5c542'; g.font = `800 ${i ? (narrow ? 16 : 22) : (narrow ? 24 : 34)}px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.strokeText(b.text, VW / 2, by); g.fillText(b.text, VW / 2, by);
    g.font = `bold ${i ? 12 : 14}px sans-serif`; g.fillStyle = '#e6edf3'; g.strokeText(b.sub, VW / 2, by + (i ? 18 : 26)); g.fillText(b.sub, VW / 2, by + (i ? 18 : 26));
    g.globalAlpha = 1;
  });
  if (paused) {
    buttons.length = 0; minimapRect = null; dialogRect = null; panelRect = null; // nothing under the menu is tappable
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, VW, VH);
    const pw = 300, ph = 292, px = VW / 2 - pw / 2, py = VH / 2 - ph / 2;
    roundRect(g, px, py, pw, ph, 12); g.fillStyle = 'rgba(10,14,22,0.96)'; g.fill(); g.strokeStyle = '#30363d'; g.stroke();
    g.fillStyle = '#e6edf3'; g.font = `800 24px ${DISPLAY}`; g.textAlign = 'center'; g.fillText('FANGLANDS', VW / 2, py + 40);
    g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.fillText(quest.stage >= 7 ? 'Chapter 3 · Goblin Tech' : quest.stage >= 5 ? 'Chapter 2 · Thistledown' : 'Chapter 1 · The Cave', VW / 2, py + 60);
    button(g, px + 24, py + 78, pw - 48, 36, 'Resume', () => { paused = false; });
    button(g, px + 24, py + 120, pw - 48, 36, audioMuted ? 'Sound: off' : 'Sound: on', toggleMute, '#21262d');
    button(g, px + 24, py + 162, pw - 48, 36, window.__kidmode ? 'Kid mode: on' : 'Kid mode: off', toggleKidMode, '#21262d');
    const erase = confirmActive('newgame');
    button(g, px + 24, py + 204, pw - 48, 36, erase ? 'Really erase? Tap again' : 'New game (erases save)', () => confirmTap('newgame', newGame), erase ? '#c0392b' : '#8b2e2e');
    g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(`Kills ${player.kills} · Deaths ${player.deaths} · Best hit ${player.highestHit}`, VW / 2, py + 254);
    g.fillText('Progress saves automatically in this browser.', VW / 2, py + 272);
  }
}
// small arrow on the minimap edge pointing at the tracked quest's target (or a ring when the target is on the minimap)
function drawCompass(g, x, y, size) {
  const t = trackedTarget(); if (!t) return;
  const tilesAcross = 44, scale = size / tilesAcross;
  const cx = player.x / TILE, cy = player.y / TILE;
  const sx = clamp(cx - tilesAcross / 2, 0, MAP_W - tilesAcross), sy = clamp(cy - tilesAcross / 2, 0, MAP_H - tilesAcross);
  const mx = x + (t.x + 0.5 - sx) * scale, my = y + (t.y + 0.5 - sy) * scale;
  g.strokeStyle = '#f5c542'; g.lineWidth = 2;
  if (mx > x + 6 && mx < x + size - 6 && my > y + 6 && my < y + size - 6) { g.beginPath(); g.arc(mx, my, 5 + Math.sin(time * 4) * 1.5, 0, 7); g.stroke(); return; }
  const ccx = x + size / 2, ccy = y + size / 2, ang = Math.atan2(my - ccy, mx - ccx);
  // point on the (rounded) square edge in that direction
  const half = size / 2 - 9, k = Math.min(half / Math.max(Math.abs(Math.cos(ang)), 1e-6), half / Math.max(Math.abs(Math.sin(ang)), 1e-6));
  const ex = ccx + Math.cos(ang) * k, ey = ccy + Math.sin(ang) * k;
  g.save(); g.translate(ex, ey); g.rotate(ang);
  g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, -6); g.lineTo(-2, 0); g.lineTo(-5, 6); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.stroke(); g.restore();
}
// generic boss bar for any big monster nearby (features that draw their own, like the Fang, are skipped)
function drawBossBars(g, y) {
  const bosses = monsters.filter(m => !m.dead && m.type !== 'the_fang' && MONSTER_DEFS[m.type] && MONSTER_DEFS[m.type].level >= 25 && MONSTER_DEFS[m.type].hp >= 300 && dist(m.x, m.y, player.x, player.y) <= 12 * TILE).slice(0, 2);
  bosses.forEach((m, i) => {
    const def = MONSTER_DEFS[m.type], w = HUD_LAYOUT.short ? 180 : Math.min(236, VW - 28), h = 48, x = 14, by = y + i * (h + 8);
    roundRect(g, x, by, w, h, 10); g.fillStyle = 'rgba(10,14,22,0.82)'; g.fill(); g.strokeStyle = '#ff6b6b'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#e6edf3'; g.font = `700 14px ${DISPLAY}`; g.textAlign = 'left'; g.fillText(def.name.toUpperCase(), x + 12, by + 19);
    g.fillStyle = '#ff6b6b'; g.font = 'bold 11px sans-serif'; g.textAlign = 'right'; g.fillText(`LV ${def.level}`, x + w - 12, by + 19);
    g.fillStyle = '#2a2f3a'; roundRect(g, x + 12, by + 27, w - 24, 11, 5); g.fill();
    g.fillStyle = '#e63946'; roundRect(g, x + 12, by + 27, (w - 24) * clamp(m.hp / m.maxHp, 0, 1), 11, 5); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText(`${Math.ceil(m.hp)} / ${m.maxHp}`, x + w / 2, by + 36);
  });
}
function drawPanels(g, narrow, short, qh, hb) {
  const gridCols = narrow ? 5 : 10;
  if (panel && HOOKS.panel[panel]) { HOOKS.panel[panel](g, narrow); return; }
  if (panel === 'skills') {
    const rowH = clamp(Math.floor((VH - 70) / SKILL_DEFS.length), 24, 34), pw = 270, ph = 40 + SKILL_DEFS.length * rowH;
    const px = 14; let py = narrow ? HUD_LAYOUT.hotbarY + hb + 12 : 90; if (py + ph > VH - 10) py = Math.max(14, VH - 10 - ph);
    roundRect(g, px, py, pw, ph, 10); g.fillStyle = 'rgba(10,14,22,0.92)'; g.fill();
    panelRect = { x: px, y: py, w: pw, h: ph };
    button(g, px + pw - 50, py + 4, 44, 36, '×', closePanel, '#21262d');
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText(`SKILLS · combat level ${combatLevel()}`, px + 12, py + 18);
    SKILL_DEFS.forEach((s, i) => {
      const y = py + 30 + i * rowH, sk = player.skills[s.key], lv = levelForXp(sk.xp);
      const locked = s.needs && sk.xp === 0 && !hasTool(s.needs === 'a bow' ? 'bow' : s.needs === 'an axe' ? 'axe' : s.needs === 'a pickaxe' ? 'pickaxe' : s.needs === 'a rod' ? 'rod' : 'hoe') && !(s.key === 'range' && (player.equip.weapon === 'shortbow' || countItem('shortbow')));
      g.fillStyle = locked ? '#6e7681' : '#e6edf3'; g.font = 'bold 12px sans-serif'; g.fillText(s.name, px + 12, y + 11);
      g.fillStyle = locked ? '#6e7681' : '#f5c542'; g.textAlign = 'right'; g.fillText(locked ? `needs ${s.needs}` : `Lv ${lv}`, px + pw - 12, y + 11); g.textAlign = 'left';
      g.fillStyle = '#2a2f3a'; roundRect(g, px + 12, y + 15, pw - 24, 5, 3); g.fill();
      if (!locked) { const cur = sk.xp - xpForLevel(lv), need = xpForLevel(lv + 1) - xpForLevel(lv); g.fillStyle = '#58a6ff'; roundRect(g, px + 12, y + 15, (pw - 24) * clamp(cur / need, 0, 1), 5, 3); g.fill(); if (rowH >= 32) { g.fillStyle = '#6e7681'; g.font = '9px sans-serif'; g.fillText(`${cur} / ${need} xp`, px + 12, y + 29); } }
    });
  }
  if (panel === 'help') {
    const rows = isTouch
      ? [['Tap the world', 'walk there · tap a tree, rock, water or person to use it · tap a monster to fight'], ['Hold on a thing', 'shows what it is, then acts when you let go'], ['Left side of screen', 'drag to move (or tap to walk)'], ['SWING', 'attack, shoot, stomp, hit a dummy (or double-tap the world)'], ['USE', 'talk, chop, mine, fish, cook, open, enter'], ['BAG', 'pack + worn gear (tap, tap = swap)'], ['Hotbar', 'tap a slot to eat or use it'], ['Bag › Place', 'put down a plank, door, bed, lodestone or trap'], ['CRAFT / SKILLS / QUESTS', 'panels · QUESTS also shows what was Said'], ['HOME', 'teleport to your lodestone (5 min)'], ['EXIT', 'climb out of a walker or bulldozer'], ['Machines', 'USE a wreck to repair it, USE again to climb in'], ['Death', 'if you fall, he keeps your pack in his stone house'], ['Notice board', 'in the square and by the cave road: paid jobs'], ['Minimap', 'tap the minimap for the world map'], ['MENU', 'sound, kid mode, new game']]
      : [['WASD / arrows', 'move'], ['Click the world', 'walk there · click a tree, rock, water, person or monster to use / fight it'], ['Space', 'swing, shoot, stomp'], ['E', 'talk, chop, mine, fish, cook, open, enter'], ['Q', 'place a plank, door, bed, lodestone or trap'], ['1–5', 'eat or use the first five pack slots'], ['I / C / Tab / J / M', 'pack · craft · skills · quests · map'], ['H', 'teleport home (lodestone, 5 min)'], ['X', 'climb out of a machine'], ['Machines', 'E on a wreck repairs it, E again climbs in'], ['Death', 'if you fall, he keeps your pack in his stone house'], ['Notice board', 'in the square and by the cave road: paid jobs'], ['Enter', 'next line of talk (or click the box)'], ['Minimap', 'click the minimap (or M) for the world map'], ['Esc', 'menu (sound, kid mode, new game)']];
    const rh = Math.min(26, Math.floor((VH - 120) / rows.length));
    const { px, py, w } = panelBox(g, 500, 90 + rows.length * rh, 'How to play', 'Every skill trains by doing. Die and Death keeps your pack.');
    rows.forEach(([k, v], i) => { const y = py + 78 + i * rh; g.fillStyle = '#f5c542'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(k, px + 18, y); g.fillStyle = '#c9d1d9'; g.font = narrow ? '11px sans-serif' : '13px sans-serif'; g.fillText(v, px + (narrow ? 150 : 190), y); });
  }
  if (panel === 'quests') {
    const list = activeQuests(); const done = []; if (quest.bread === 'done') done.push('bread'); if (quest.wren === 'done') done.push('wren');
    const said = questsTab === 'said';
    const lines = said ? dialogLog.slice(-Math.max(3, Math.floor((VH - 160) / 22))).reverse() : [];
    const { px, py, w, h } = panelBox(g, 460, said ? Math.min(VH - 20, 120 + lines.length * 22) : 150 + list.length * 74 + done.length * 20, said ? 'Said' : 'Quests', said ? 'The last things people said to you, newest first.' : 'The tracked quest stays on screen and marks the map.');
    button(g, px + 18, py + 60, 80, 28, 'Quests', () => { questsTab = 'quests'; }, said ? '#21262d' : '#238636', said);
    button(g, px + 104, py + 60, 80, 28, 'Said', () => { questsTab = 'said'; }, said ? '#238636' : '#21262d', !said);
    let y = py + 100;
    if (said) {
      if (!lines.length) { g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText('Nobody has said anything yet.', px + 18, y + 8); }
      for (const l of lines) { g.fillStyle = '#c9a36a'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText(l.who.toUpperCase(), px + 18, y + 8); g.fillStyle = '#c9d1d9'; g.font = '12px sans-serif'; let t = l.text; const maxW = w - 36 - (narrow ? 70 : 110); while (g.measureText(t).width > maxW && t.length > 8) t = t.slice(0, -2) + '…'; g.fillText(t, px + (narrow ? 88 : 128), y + 8); y += 22; if (y > py + h - 20) break; }
      return;
    }
    for (const id of list) {
      const tracked = quest.tracked === id;
      roundRect(g, px + 18, y, w - 36, 64, 8); g.fillStyle = tracked ? 'rgba(88,166,255,0.12)' : 'rgba(255,255,255,0.05)'; g.fill();
      g.fillStyle = '#e6edf3'; g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillText(QUEST_DEFS[id].name + (id === 'main' ? '  · main story' : '  · side quest'), px + 30, y + 20);
      g.fillStyle = '#c9d1d9'; g.font = '12px sans-serif'; let t = questText(id); while (g.measureText(t).width > w - 180 && t.length > 8) t = t.slice(0, -2) + '…'; g.fillText(t, px + 30, y + 42);
      button(g, px + w - 120, y + 16, 90, 30, tracked ? 'Untrack' : 'Track', () => { if (tracked) { quest.tracked = null; if (id === 'main') quest.untrackedByPlayer = true; } else { quest.tracked = id; if (id === 'main') quest.untrackedByPlayer = false; } save(); }, tracked ? '#21262d' : '#238636');
      y += 74;
    }
    for (const id of done) { g.fillStyle = '#6e7681'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(`✓ ${QUEST_DEFS[id].name} — done`, px + 30, y + 12); y += 20; }
  }
  if (panel === 'map') {
    const mw = Math.min(VW - 40, 760), mh = Math.min(VH - 60, mw * MAP_H / MAP_W + 70);
    const { px, py, w, h } = panelBox(g, mw, mh, 'The Fanglands', 'White: you. Blue: home. Gold: quest targets. Tap anywhere to close.');
    if (miniDirty || miniDiffCount !== mapDiffs.size) refreshMini();
    const iw = w - 36, ih = Math.min(h - 80, iw * MAP_H / MAP_W), ix = px + 18, iy = py + 62; const sc = iw / MAP_W;
    g.save(); roundRect(g, ix, iy, iw, ih, 8); g.clip(); g.imageSmoothingEnabled = false; g.drawImage(miniCanvas, 0, 0, MAP_W, MAP_H, ix, iy, iw, MAP_W * sc * MAP_H / MAP_W); g.imageSmoothingEnabled = true;
    for (const r of REGIONS) { if (r.name === 'Goblin Fields' || r.name === 'The Wilds') continue; const cx = ix + (r.x0 + r.x1 + 1) / 2 * sc, cy = iy + (r.y0 + r.y1 + 1) / 2 * sc; g.font = `700 ${Math.max(9, sc * 2.2)}px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(r.name.toUpperCase(), cx, cy); g.fillStyle = '#e6edf3'; g.fillText(r.name.toUpperCase(), cx, cy); }
    const dot = (wx, wy, color, r) => { g.fillStyle = color; g.beginPath(); g.arc(ix + wx / TILE * sc, iy + wy / TILE * sc, r, 0, 7); g.fill(); };
    if (player.home) dot(player.home.x, player.home.y, '#7ec8ff', 4);
    for (const t of mapTargets()) {
      const tx = ix + (t.x + 0.5) * sc, ty = iy + (t.y + 0.5) * sc, isTracked = t.id === quest.tracked;
      g.strokeStyle = isTracked ? '#f5c542' : 'rgba(245,197,66,0.7)'; g.lineWidth = isTracked ? 2.5 : 1.5; g.beginPath(); g.arc(tx, ty, (isTracked ? 6 : 5) + Math.sin(time * 4) * 2, 0, 7); g.stroke();
      if (t.label) { g.font = `bold ${narrow ? 9 : 11}px sans-serif`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(t.label, tx, ty - 10); g.fillStyle = '#f5c542'; g.fillText(t.label, tx, ty - 10); }
    }
    dot(player.x, player.y, '#ffffff', 4);
    g.restore();
    buttons.push({ x: ix, y: iy, w: iw, h: ih, label: 'mapimage', action: closePanel }); // "tap anywhere to close" — the map itself closes too
  }
  if (panel === 'inventory') {
    const cols = gridCols, size = narrow ? 44 : 46, gap = 6;
    const eqw = 70;
    const { px, py, w, h } = panelBox(g, cols * (size + gap) + 30 + eqw, narrow ? 440 : 300, 'Your pack', `${player.inv.filter(Boolean).length} / ${INV_SLOTS} slots · tap one, then another, to swap`);
    if (player.home) button(g, px + w - 56 - 84, py + 14, 74, 28, isTouch ? 'HOME' : 'Home (H)', goHome, '#21262d');
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
      const doDrop = () => { const q = player.inv[selectedSlot]; if (!q) return; drops.push({ x: player.x + player.facing.x * 30, y: player.y + player.facing.y * 30, id: q.id, qty: q.qty, t: 0 }); player.inv[selectedSlot] = null; selectedSlot = -1; save(); };
      const arm = needsConfirm(def) && confirmActive('drop');
      button(g, bx, by, arm ? 130 : 80, 30, arm ? 'Tap again to drop' : 'Drop', () => { if (needsConfirm(def)) confirmTap('drop', doDrop); else doDrop(); }, arm ? '#c0392b' : '#8b2e2e');
    } else { g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(isTouch ? 'Tap an item. Tap a worn piece to take it off. The hotbar uses the first five slots.' : 'Tap an item. Tap a worn piece to take it off. Keys 1–5 use the first five slots.', px + 18 + eqw, gy + 30); }
  }
  if (panel === 'bank') {
    const cols = gridCols, size = 40, gap = 5, rows = 3, per = cols * rows, pages = Math.max(1, Math.ceil(BANK_SLOTS / per));
    const { px, py, w } = panelBox(g, cols * (size + gap) + 30, narrow ? 560 : 440, 'Bank of Thistledown', `${player.bank.length} / ${BANK_SLOTS} vault slots · tap to move items`);
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText('VAULT', px + 18, py + 70);
    bankPage = clamp(bankPage, 0, pages - 1);
    for (let k = 0; k < per; k++) {
      const i = bankPage * per + k; if (i >= BANK_SLOTS) break;
      const cx = px + 18 + (k % cols) * (size + gap), cy = py + 78 + Math.floor(k / cols) * (size + gap), b = player.bank[i];
      drawSlot(g, cx, cy, size, b, false);
      if (b) buttons.push({ x: cx, y: cy, w: size, h: size, label: 'bank' + i, action: () => { const left = addItem(b.id, b.qty); b.qty = left; if (!left) player.bank.splice(i, 1); if (left) notify('Your pack is full.'); save(); } });
    }
    const pgy = py + 78 + rows * (size + gap) + 4;
    pager(g, px + 18, pgy, w - 36, bankPage, pages, p => { bankPage = clamp(p, 0, pages - 1); });
    g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText('YOUR PACK', px + 18, pgy + 52);
    drawInvGrid(g, px + 18, pgy + 60, cols, size, gap, i => { const s = player.inv[i]; if (!s) return; if (bankAdd(s.id, s.qty)) { player.inv[i] = null; save(); } else notify('The vault is full.'); });
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
    const armSell = confirmActive('sell');
    g.fillStyle = armSell ? '#f5c542' : '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText(armSell ? `TAP AGAIN TO SELL ${(ITEMS[uxConfirm.item] || {}).name || 'it'}` : shop.buys ? `SELLS FOR FULL PRICE: ${shop.buys.map(i => ITEMS[i].name).join(', ')}` : `SELL FROM YOUR PACK (${Math.round(rate * 100)}% of value)`, px + 18, gy);
    drawInvGrid(g, px + 18, gy + 8, cols, size, gap, i => {
      const s = player.inv[i]; if (!s || s.id === 'coins') return; if (shop.buys && !shop.buys.includes(s.id)) { notify('Fennick only wants pelts, tusks, wool, silk, scrap and coal.'); return; }
      const sell = () => { const q = player.inv[i]; if (!q) return; const price = Math.max(1, Math.floor(ITEMS[q.id].value * rate)); q.qty -= 1; if (q.qty <= 0) player.inv[i] = null; addItem('coins', price); floatText(player.x, player.y - 30, `+${price} coins`, '#ffd166'); save(); };
      if (needsConfirm(ITEMS[s.id])) { if (confirmActive('sell') && uxConfirm.item === s.id) { uxConfirm = null; sell(); } else { uxConfirm = { label: 'sell', until: nowMs() + 3000, item: s.id }; sfx('open'); } } else sell();
    });
  }
  if (panel === 'craft' || panel === 'station') {
    const station = panel === 'craft' ? null : panelArg;
    const all = station === 'forge' ? SMELT : RECIPES.filter(r => r.station === station);
    const titles = { forge: 'Forge — smelting', anvil: 'Anvil — smithing (needs a hammer)', workbench: 'Workbench', workshop: "Tinker's table — traps and arrows", alchemy: 'Alchemy table — bombs' };
    const skillKey = station === 'forge' || station === 'anvil' ? 'smithing' : 'crafting';
    // tabs by tier when the list is long; 8 rows a page (fewer on a short screen) with Prev/Next
    const tabbed = all.length > 8;
    const tiers = tabbed ? ['Bronze/Iron', 'Steel', 'Mithril', 'Godly', 'Other'].filter(t => all.some(r => recipeTier(r) === t)) : [];
    if (tabbed && !tiers.includes(recipeTab)) recipeTab = tiers[0];
    const list = tabbed ? all.filter(r => recipeTier(r) === recipeTab) : all;
    const rowsY0 = tabbed ? 92 : 62, n = list.length;
    const noPagerH = rowsY0 + n * 40 + 24;
    const needPager = n > 8 || noPagerH > VH - 20;
    const wantH = needPager ? rowsY0 + Math.min(8, n) * 40 + 54 : noPagerH;
    const { px, py, w, h } = panelBox(g, 420, Math.min(VH - 20, Math.max(160, wantH)), station ? titles[station] || 'Station' : 'Crafting', station ? `${SKILL_DEFS.find(s => s.key === skillKey).name} level ${skillLv(skillKey)}` : 'Simple things craft from your pack. Stations in Thistledown make the rest.');
    if (tabbed) { let tx = px + 18; for (const t of tiers) { const tw = Math.max(64, 14 + t.length * 8); button(g, tx, py + 58, tw, 26, t, () => { recipeTab = t; recipePage = 0; }, t === recipeTab ? '#238636' : '#21262d', t !== recipeTab); tx += tw + 6; } }
    const perPage = needPager ? Math.max(2, Math.min(8, Math.floor((h - rowsY0 - 54) / 40))) : Math.max(1, n);
    const pages = Math.max(1, Math.ceil(n / perPage)); recipePage = clamp(recipePage, 0, pages - 1);
    const canMake = r => { const rec = station === 'forge' ? { ...r, station: 'forge', skill: 'smithing', qty: 1 } : r; const has = rec.needs.every(([id, q]) => countItem(id) >= q); const lvOk = !rec.skill || skillLv(rec.skill) >= rec.lv; return { rec, can: has && lvOk && !(station === 'anvil' && !hasTool('hammer')) }; };
    const pageList = list.slice(recipePage * perPage, recipePage * perPage + perPage);
    pageList.forEach((r, i) => {
      const y = py + rowsY0 + i * 40; const { rec, can } = canMake(r);
      button(g, px + 18, y, w - 36, 34, rec.label + (rec.lv > 1 ? `  (lv ${rec.lv})` : ''), () => craft(rec), can ? '#238636' : '#2a2f3a', can);
    });
    // recipes on other tabs/pages stay addressable by label for the harness (F.clickButton) but sit off-screen, so no tap can reach them
    for (const r of all) { if (pageList.includes(r)) continue; const { rec, can } = canMake(r); if (can) buttons.push({ x: -1e9, y: -1e9, w: 0, h: 0, label: rec.label + (rec.lv > 1 ? `  (lv ${rec.lv})` : ''), action: () => craft(rec), offscreen: true }); }
    if (pages > 1) pager(g, px + 18, py + h - 40, w - 36, recipePage, pages, p => { recipePage = clamp(p, 0, pages - 1); });
    if (station === 'anvil' && !hasTool('hammer')) { g.fillStyle = '#ff6b6b'; g.font = '12px sans-serif'; g.textAlign = pages > 1 ? 'center' : 'left'; g.fillText('You need a hammer in your pack.', pages > 1 ? px + w / 2 : px + 18, pages > 1 ? py + h - 46 : py + h - 12); }
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
