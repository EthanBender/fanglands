// ============================================================================
// HUD AND PANELS
// ============================================================================
// An item tile, not a container: the one other shape in the HUD, at HK.R_SLOT. "Selected" is drawn as a
// RAISED tile (brighter fill, a light edge) rather than a blue one — the kit's rule is that colour carries
// meaning and selection is not a meaning, it is a state of the control. (src/59-hudkit.js)
function drawSlot(g, x, y, size, slot, selected) {
  roundRect(g, x, y, size, size, HK.R_SLOT); g.fillStyle = selected ? 'rgba(233,240,248,0.20)' : 'rgba(233,240,248,0.06)'; g.fill();
  g.strokeStyle = selected ? HK.C.CTRL_EDGE : HK.C.EDGE; g.lineWidth = selected ? 2 : 1; g.stroke();
  if (slot) {
    drawItemIcon(g, slot.id, x + size / 2, y + size / 2 - 2, size * 0.5);
    if (slot.qty > 1) { g.fillStyle = HK.C.INK; g.font = 'bold 11px sans-serif'; g.textAlign = 'right'; g.fillText(slot.qty > 9999 ? Math.floor(slot.qty / 1000) + 'k' : slot.qty, x + size - 4, y + size - 4); }
  }
}
// Disabled buttons are still registered (as inert hit rects, label prefixed 'disabled:') so a tap on a greyed button does not fall through to the panel/world.
// One pressable style for the whole game, drawn by HK.control: a raised plate with a light edge, so a
// control never looks like a readout. The legacy colour argument is kept (no call site had to change) but
// it is now read as a MEANING — green = go, red = danger, amber = wait, anything else = a neutral control —
// which is what turned thirty hand-picked hex codes into one language. (src/59-hudkit.js)
function button(g, x, y, w, h, label, action, color = '#238636', enabled = true) {
  HK.control(g, x, y, w, h, label, action, { tone: HK.toneOf(color), enabled });
}
function panelBox(g, w, h, title, subtitle) {
  w = Math.min(w, VW - 20); h = Math.min(h, VH - 20);
  const px = Math.round(VW / 2 - w / 2), py = Math.round(Math.max(10, VH / 2 - h / 2 - 20));
  // the same plate as every HUD chip, only near-opaque: a panel covers the world on purpose
  HK.plate(g, px, py, w, h, { top: 'rgba(17,21,30,0.96)', bottom: 'rgba(11,14,21,0.94)' });
  g.fillStyle = HK.C.INK; g.font = `700 17px ${DISPLAY}`; g.textAlign = 'left'; g.fillText(title, px + 18, py + 30);
  if (subtitle) { g.fillStyle = HK.C.DIM; g.font = '12px sans-serif'; g.fillText(subtitle, px + 18, py + 50); }
  const cb = HK.row(); button(g, px + w - cb - 12, py + 10, cb, cb, '×', closePanel, '#21262d');
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
  // touchMode() rather than isTouch: identical on a real device, but a test can force either layout, which
  // is what lets the HUD-kit layout audit render the iPad HUD headlessly (src/59-hudkit.js).
  const isT = touchMode();
  const narrow = VW < 640, short = isT && VH < 500;
  const mmSize = HK.mmSize(), mmx = HK.mmX(), mmy = 14;
  // ---- the status plate: health first and biggest, the machine you are in second, coins and combat quiet ----
  const statusBottom = HK.status(g);
  HUD.leftY = statusBottom + HK.GUT; HUD.leftCol = 0; // the left column starts under the plate — set, not maxed: drawHud owns this cursor
  // minimap (top-right) + compass toward the tracked quest
  drawMinimap(g, mmx, mmy, mmSize); minimapRect = panel ? null : { x: mmx, y: mmy, w: mmSize, h: mmSize }; // a panel owns the screen: no tap falls through to the map
  drawCompass(g, mmx, mmy, mmSize);
  g.fillStyle = 'rgba(233,240,248,0.55)'; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText(isT ? 'tap for map' : 'M for map', mmx + mmSize / 2, mmy + mmSize + 12);
  // The control rail (MENU / SKILLS / HELP / WIKI / MAP / MUSIC) is registered with hudControl() below and
  // drawn by the kit's own HOOKS.hud entry, last, over everything. Its band is reserved here so the quest
  // box and the hotbar can stack under it exactly as they used to.
  const topStackBottom = isT && narrow ? HK.railBottom() : Math.max(statusBottom, 76);
  // Tracked quest. It is a readout, not a control, so it gets a plate and no edge. Placement is on the grid:
  // desktop → the top-right band, left of the minimap; narrow phone → full width under the rail; every other
  // touch layout → the second column, at the top, right of the left column and left of the minimap. (It used
  // to sit under the HP box on a landscape phone, which the taller status plate would have run into.)
  let qh = 0, qx = 0, qw = 0;   // qx/qw are published on HUD_LAYOUT so 67-questbox can put its expand control over the box
  const col2 = HK.colX(1);                 // the second column's left edge (shifted right of a mirrored thumb cluster)
  const qy = !isT ? 14 : narrow ? topStackBottom + 10 : 14;
  if (quest.tracked && activeQuests().includes(quest.tracked)) {
    const qt = questText(quest.tracked); g.font = 'bold 13px sans-serif';
    qw = !isT ? Math.min(360, Math.max(260, g.measureText(qt).width + 40)) : narrow ? VW - 28 : clamp(mmx - col2 - 12, 200, 360);
    qh = 54; qx = !isT ? VW - mmSize - 14 - qw - 12 : narrow ? 14 : col2;
    HK.plate(g, qx, qy, qw, qh);
    g.fillStyle = HK.C.DIM; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText(QUEST_DEFS[quest.tracked].name.toUpperCase(), qx + HK.PAD + 4, qy + 20);
    g.fillStyle = HK.C.INK; g.font = 'bold 13px sans-serif';
    let shown = qt; while (shown.length > 8 && g.measureText(shown + '…').width > qw - 40) shown = shown.slice(0, -1); g.fillText(shown === qt ? qt : shown + '…', qx + HK.PAD + 4, qy + 42);
  }
  const questSlotH = narrow ? 54 : qh; // phones reserve the quest slot so the hotbar does not jump
  // hotbar: first five pack slots (keys 1–5). One plate, one gutter, slots on the grid.
  const hb = 44, hgap = 6, hw = 5 * (hb + hgap) + 60;
  const hx = short ? VW / 2 - hw / 2 + 30 : isT ? HK.M() + 6 : VW / 2 - hw / 2; // +6: the plate is drawn at hx-6, so its edge lands on the column's
  // a tablet's hotbar hangs off the bottom of the status plate; the notice then goes under the hotbar
  // rather than across it (at the old fixed y = 84 the two overlapped on every tablet)
  const hbTop = short ? VH - 58 : isT ? (narrow ? null : statusBottom + HK.GUT + 6) : VH - 96;
  // the notice slot: a narrow phone stacks it under the quest box; every other touch layout puts it in the
  // second column right under the quest slot (centred, it used to land across the left column's chips);
  // desktop keeps it centred at the top, where nothing else lives.
  const noticeY = narrow ? qy + questSlotH + 8 : isT ? 14 + 54 + HK.GUT : 84;
  const hy = (isT && narrow) ? noticeY + 32 + 10 : hbTop;
  HK.plate(g, hx - 6, hy - 6, hw + 6, hb + 12);
  for (let i = 0; i < 5; i++) {
    const sx = hx + i * (hb + hgap);
    drawSlot(g, sx, hy, hb, player.inv[i], false);
    if (!isT) { g.fillStyle = HK.C.DIM; g.font = '9px sans-serif'; g.textAlign = 'left'; g.fillText(i + 1, sx + 3, hy + 10); }
    buttons.push({ x: sx, y: hy, w: hb, h: hb, label: 'hot' + i, action: () => useItem(i) });
  }
  button(g, hx + 5 * (hb + hgap), hy, 54, hb, isT ? 'BAG' : 'Bag (I)', () => panel === 'inventory' ? closePanel() : openPanel('inventory'), '#21262d');
  // the boss bar joins the left column like every other chip, so nothing has to guess where it ended
  const bossBarY = Math.max(HUD.leftY, HK.stackFloor());
  // where a wrapped chip lands: under whatever the second column already holds (quest, notice, the rail)
  const col2Top = isT && !narrow ? Math.max(HK.railBottom(), noticeY + 32) + HK.GUT : 14;
  Object.assign(HUD_LAYOUT, { narrow, short, hotbarY: hy, hotbarH: hb, questY: qy, questH: qh, questX: qx, questW: qw, noticeY, topStackBottom, bossBarY, col2Top });
  if (!isT) { g.fillStyle = 'rgba(233,240,248,0.72)'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText(player.mech ? 'WASD move · click to walk · Space stomp · E crush planks · X climb out' : 'WASD move · click to walk · Space swing · E use / talk · Q place · 1-5 use · I bag · C craft · Tab skills · J quests · M map · H home · ? help · Esc menu', VW / 2, VH - 16); }
  else if (!short) { // touch: one line between the stick and the buttons; it shortens on phones instead of running under them (landscape phones have no free edge for it)
    // the longest of three whole sentences that fits, rather than one sentence chopped mid-word: a phone was
    // showing "Tap to walk · tap thing…", which teaches nothing and looks broken
    const maxW = Math.max(120, VW - 460); g.fillStyle = 'rgba(233,240,248,0.68)'; g.font = '11px sans-serif'; g.textAlign = 'center';
    const lines = ['Tap to walk · tap a tree, rock, water or person to use it · tap a monster to fight · SWING · USE · BAG',
      'Tap to walk · tap things to use them · tap a monster to fight', 'Tap to walk · tap things to use them', 'Tap to walk'];
    const t = lines.find(l => g.measureText(l).width <= maxW) || lines[lines.length - 1];
    g.fillText(t, VW / 2, VH - 8);
  }
  // touch controls: the thumb cluster. Round because they are held-down actions, not menu entries — the one
  // deliberate exception to the plate, and it is a whole class of control, not a one-off.
  if (isT) {
    const mx = x => window.__stickRight === true ? VW - x : x; // Settings › Move stick side: right-handed players get the stick on the right and the buttons on the left (src/43-settings.js)
    if (touch.active) { g.fillStyle = 'rgba(233,240,248,0.14)'; g.beginPath(); g.arc(touch.ox, touch.oy, 60, 0, 7); g.fill(); g.fillStyle = 'rgba(233,240,248,0.38)'; g.beginPath(); g.arc(touch.ox + touch.dx * 60, touch.oy + touch.dy * 60, 26, 0, 7); g.fill(); }
    else HK.disc(g, mx(110), VH - 110, 60, 'MOVE', { quiet: true }); // the idle stick: a control, but the quietest one on screen
    // seats 0-4 of the kit's thumb grid; features take the ones the core does not (32-beast: 4, 47-outliers: 5)
    const defs = [[0, 'SWING', () => touch.taps.push('attack')], [1, 'USE', () => touch.taps.push('use')],
      [2, player.mech ? 'EXIT' : 'CRAFT', () => player.mech ? exitMech() : (panel === 'craft' ? closePanel() : openPanel('craft'))],
      [3, 'QUESTS', () => panel === 'quests' ? closePanel() : openPanel('quests')]];
    if (player.home && !player.mech) defs.push([4, 'HOME', goHome]);
    for (const [seat, label, action] of defs) {
      const p = HK.thumbSeat(seat);
      HK.disc(g, p.x, p.y, p.r, label);   // the same scrim, raise and edge as every other pressable
      buttons.push({ x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2, label, action });
    }
  }
  drawBossBars(g, HUD_LAYOUT.bossBarY);
  for (const h of HOOKS.hud) h(g, narrow);
  drawPanels(g, narrow, short, qh, hb);
  // dialog: the box grows to fit its wrapped lines and waits for a tap (the update loop auto-advances only after 4 + len/9 s)
  if (dialog.cur) {
    const dw = short ? Math.max(260, VW - 400) : Math.min(720, VW - 40), dx = VW / 2 - dw / 2;
    g.font = '16px sans-serif'; const lines = dialogLines(g, dialog.cur.text, dw - 36); const dh = 60 + lines * 20;
    const dy = short ? 150 : clamp(VH - dh - (isT ? (narrow ? 300 : 250) : 130), narrow ? 150 : 90, VH - dh - 10);
    // Who is speaking is a real distinction, so it keeps a colour — but as a 3 px rule down the left edge
    // (the kit's tone rule), not as a full outline competing with the state colours.
    const col = dialog.cur.who === 'The Voice' ? '#b58cff' : dialog.cur.who === 'Death' ? '#8fa2b8' : '#c9a36a';
    HK.plate(g, dx, dy, dw, dh, { top: 'rgba(17,21,30,0.92)', bottom: 'rgba(11,14,21,0.88)', tone: col });
    g.fillStyle = HK.C.DIM; g.font = 'bold 12px sans-serif'; g.textAlign = 'left'; g.fillText(dialog.cur.who.toUpperCase(), dx + 18, dy + 24);
    g.fillStyle = HK.C.INK; g.font = '16px sans-serif';
    wrapText(g, dialog.cur.text.slice(0, dialog.shown), dx + 18, dy + 48, dw - 36, 20);
    g.fillStyle = 'rgba(211,220,232,0.65)'; g.font = '11px sans-serif'; g.textAlign = 'right'; g.fillText(isT ? 'tap here to continue' : 'Enter or click here to continue', dx + dw - 14, dy + dh - 10);
    dialogRect = { x: dx, y: dy, w: dw, h: dh };
  }
  // notice: the same plate, faded in and out by notice.t. On a landscape phone it sits in the second column
  // under the quest slot, so it never lands on the status plate or the minimap.
  if (notice) {
    const nx0 = HK.colX(1);                              // the second column
    const nw = isT && !narrow ? clamp(mmx - nx0 - 12, 200, 520) : Math.min(VW - 20, 520), nx = isT && !narrow ? nx0 : VW / 2 - nw / 2;
    const a = clamp(notice.t, 0, 1);
    g.globalAlpha = a; HK.plate(g, nx, noticeY, nw, 32); g.globalAlpha = 1;
    g.fillStyle = `rgba(242,246,250,${a})`; g.font = '13px sans-serif'; g.textAlign = 'center';
    let t = notice.text; while (g.measureText(t).width > nw - 20 && t.length > 8) t = t.slice(0, -2) + '…'; g.fillText(t, nx + nw / 2, noticeY + 21);
  }
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
    // geometry from HK.pauseBox() so the rows are finger-sized on touch and the stats line stays findable:
    // 31-rebuild repaints that line with the town's name and asks the kit for the same y.
    const { px, py, pw, ph, bh, step, firstY, statsY } = HK.pauseBox();
    HK.plate(g, px, py, pw, ph, { top: 'rgba(17,21,30,0.97)', bottom: 'rgba(11,14,21,0.95)' });
    g.fillStyle = HK.C.INK; g.font = `800 24px ${DISPLAY}`; g.textAlign = 'center'; g.fillText('FANGLANDS', VW / 2, py + 34);
    g.fillStyle = HK.C.DIM; g.font = '12px sans-serif'; g.fillText(quest.stage >= 7 ? 'Chapter 3 · Goblin Tech' : quest.stage >= 5 ? 'Chapter 2 · Thistledown' : 'Chapter 1 · The Cave', VW / 2, py + 52);
    button(g, px + 24, firstY, pw - 48, bh, 'Resume', () => { paused = false; });
    // sound, music, kid mode and the rest live in the Settings panel (src/43-settings.js); the panel draws under the pause overlay, so unpause to show it
    button(g, px + 24, firstY + step, pw - 48, bh, 'Settings', () => { paused = false; openPanel('settings'); }, '#21262d');
    let by = firstY + step * 2; for (const f of HOOKS.pauseMenu) { f(g, px + 24, by, pw - 48, bh); by += step; } // feature buttons (14-title: Title screen) — registered here, after the buttons reset above, so they are tappable
    const erase = confirmActive('newgame');
    button(g, px + 24, by, pw - 48, bh, erase ? 'Really erase? Tap again' : 'New game (erases save)', () => confirmTap('newgame', newGame), erase ? '#c0392b' : '#8b2e2e');
    g.fillStyle = 'rgba(211,220,232,0.7)'; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(`Kills ${player.kills} · Deaths ${player.deaths} · Best hit ${player.highestHit}`, VW / 2, statsY);
    g.fillStyle = HK.C.DIM; g.fillText('Settings: sound, music, kid mode, text size, controls', VW / 2, statsY + 18);
    g.fillStyle = 'rgba(211,220,232,0.7)'; g.fillText('Progress saves automatically in this browser.', VW / 2, statsY + 36);
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
// Generic boss bar for any big monster nearby (features that draw their own, like the Fang, are skipped).
// Now a chip in the left column like everything else: same plate, same width, a BAD rule down the left edge
// because a boss on you IS the danger state, and the same label / value / bar block as your own health.
// It advances HUD.leftY, so no feature has to guess how many bars are above it any more.
function drawBossBars(g, y) {
  const bosses = monsters.filter(m => !m.dead && m.type !== 'the_fang' && MONSTER_DEFS[m.type] && MONSTER_DEFS[m.type].level >= 25 && MONSTER_DEFS[m.type].hp >= 300 && dist(m.x, m.y, player.x, player.y) <= 12 * TILE).slice(0, 2);
  HUD.leftY = Math.max(HUD.leftY, y);
  for (const m of bosses) {
    const def = MONSTER_DEFS[m.type], pad = 10;
    const s = HK.slot(pad * 2 + HK.meterH());
    HK.plate(g, s.x, s.y, s.w, s.h, { tone: HK.C.BAD });
    HK.meter(g, s.x + pad + 2, s.y + pad, s.w - pad * 2 - 2, {
      label: `${def.name.toUpperCase()} · lv ${def.level}`, value: `${Math.ceil(m.hp)} / ${m.maxHp}`, template: `${m.maxHp} / ${m.maxHp}`,
      frac: clamp(m.hp / m.maxHp, 0, 1), tone: HK.C.BAD,
    });
  }
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
    const rows = touchMode()
      ? [['Tap the world', 'walk there · tap a tree, rock, water or person to use it · tap a monster to fight'], ['Hold on a thing', 'shows what it is, then acts when you let go'], ['Left side of screen', 'drag to move (or tap to walk)'], ['SWING', 'attack, shoot, stomp, hit a dummy (or double-tap the world)'], ['USE', 'talk, chop, mine, fish, cook, open, enter'], ['BAG', 'pack + worn gear (tap, tap = swap)'], ['Hotbar', 'tap a slot to eat or use it'], ['Bag › Place', 'put down a plank, door, bed, lodestone or trap'], ['CRAFT / SKILLS / QUESTS', 'panels · QUESTS also shows what was Said'], ['HOME', 'teleport to your lodestone (5 min)'], ['EXIT', 'climb out of a walker or bulldozer'], ['Machines', 'USE a wreck to repair it, USE again to climb in'], ['Death', 'if you fall, he keeps your pack in his stone house'], ['Notice board', 'in the square and by the cave road: paid jobs'], ['Minimap', 'tap the minimap for the world map'], ['MENU', 'settings, title screen, new game']]
      : [['WASD / arrows', 'move'], ['Click the world', 'walk there · click a tree, rock, water, person or monster to use / fight it'], ['Space', 'swing, shoot, stomp'], ['E', 'talk, chop, mine, fish, cook, open, enter'], ['Q', 'place a plank, door, bed, lodestone or trap'], ['1–5', 'eat or use the first five pack slots'], ['I / C / Tab / J / M', 'pack · craft · skills · quests · map'], ['H', 'teleport home (lodestone, 5 min)'], ['X', 'climb out of a machine'], ['Machines', 'E on a wreck repairs it, E again climbs in'], ['Death', 'if you fall, he keeps your pack in his stone house'], ['Notice board', 'in the square and by the cave road: paid jobs'], ['Enter', 'next line of talk (or click the box)'], ['Minimap', 'click the minimap (or M) for the world map'], ['Esc', 'menu (settings, title screen, new game)']];
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
    // rowH: the kit's control height — 44 on touch, so every button in the pack is finger-sized. The panel
    // grows by the difference rather than letting the action row spill past its own box.
    const rowH = HK.row(), grow = (rowH - 30) * 2;
    const { px, py, w, h } = panelBox(g, cols * (size + gap) + 30 + eqw, (narrow ? 440 : 300) + grow, 'Your pack', `${player.inv.filter(Boolean).length} / ${INV_SLOTS} slots · tap one, then another, to swap`);
    if (player.home) button(g, px + w - HK.row() - 12 - 86, py + 10, 78, rowH, touchMode() ? 'HOME' : 'Home (H)', goHome, '#21262d');
    const gy = drawInvGrid(g, px + 18 + eqw, py + 66, cols, size, gap, i => { selectedSlot = selectedSlot === i ? -1 : i; }, true);
    // equipment column
    g.fillStyle = '#8b949e'; g.font = 'bold 10px sans-serif'; g.textAlign = 'left'; g.fillText('WORN', px + 18, py + 62);
    EQUIP_SLOTS.forEach((k, i) => {
      // one full pitch on every screen: a narrow phone used to pack the worn slots at 0.8 of it, which put 44 px
      // tap targets on a 40 px pitch — every two neighbours a knight wears overlapped by 4 px (the kit's layout
      // audit catches it the moment he wears a helm and a body). Six slots at full pitch are 300 px; the panel is 440
      const ey = py + 66 + i * (size + gap); const id = player.equip[k];
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
      if (act) { button(g, bx, by, 90, rowH, act, () => { const i = selectedSlot; useItem(i); if (act !== 'Equip') return; selectedSlot = -1; }); bx += 98; }
      const doDrop = () => { const q = player.inv[selectedSlot]; if (!q) return; drops.push({ x: player.x + player.facing.x * 30, y: player.y + player.facing.y * 30, id: q.id, qty: q.qty, t: 0 }); player.inv[selectedSlot] = null; selectedSlot = -1; save(); };
      const arm = needsConfirm(def) && confirmActive('drop');
      button(g, bx, by, arm ? 130 : 80, rowH, arm ? 'Tap again to drop' : 'Drop', () => { if (needsConfirm(def)) confirmTap('drop', doDrop); else doDrop(); }, arm ? '#c0392b' : '#8b2e2e');
    } else { g.fillStyle = '#8b949e'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(touchMode() ? 'Tap an item. Tap a worn piece to take it off. The hotbar uses the first five slots.' : 'Tap an item. Tap a worn piece to take it off. Keys 1–5 use the first five slots.', px + 18 + eqw, gy + 30); }
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
// The three menu buttons the touch layout needs join the control rail under the minimap instead of being
// three loose buttons stacked in a corner on a phone and a different three at the top of the screen on a
// tablet. hudControl() is a hoisted declaration from src/59-hudkit.js, so this runs at load time.
hudControl({ id: 'menu', sort: 10, label: () => 'MENU', show: () => touchMode(), on: () => paused, action: () => { paused = !paused; } });
hudControl({ id: 'skills', sort: 20, label: () => 'SKILLS', show: () => touchMode(), on: () => panel === 'skills', action: () => panel === 'skills' ? closePanel() : openPanel('skills') });
hudControl({ id: 'help', sort: 30, label: () => 'HELP', show: () => touchMode(), on: () => panel === 'help', action: () => panel === 'help' ? closePanel() : openPanel('help') });

function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '';
  for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; } else line = test; }
  if (line) g.fillText(line, x, y);
}
