// ============================================================================
// HUD AND PANELS
// The HUD is drawn from the Heraldry kit (src/59-hudkit.js): one knight's kit — a crest for health, a quest scroll,
// an iron-ringed minimap, a leather belt with five pouches and the BAG satchel, iron studs for the four touch seats,
// wax seals for HOME / FRIENDS / MENU — every piece in a place HK.layout() reserved for it, so nothing jumps.
// Panels wear the kit's frame: panelBox() is the book's cover and vellum page, button() is an iron plate button.
// ============================================================================
// A pack / bank / shop slot: a small leather pouch with the item in its mouth. Selected = a gold stitched edge.
function drawSlot(g, x, y, size, slot, selected) {
  HK.pouch(g, { x, y: y - Math.round(size * 0.04), w: size, h: Math.round(size * 1.04) }, slot ? { id: slot.id, qty: slot.qty } : null, '', { selected });
}
// One pressable for every panel verb: an iron plate button. The legacy colour argument is read as a MEANING
// (green = the primary choice, gold edge; red = danger, red edge; amber = wait) and everything else is neutral.
// Disabled buttons are still registered, as inert rects labelled 'disabled:', so a tap on a greyed button does not
// fall through to the panel or the world. Plate buttons fire on pointer-up inside (slide off to cancel).
function button(g, x, y, w, h, label, action, color = '#238636', enabled = true) {
  const tone = HK.toneOf(color);
  let em = null, key = null;
  if (HK.bookState.drawing) for (const [re, e, k] of HK.ROW_LOOK) if (re.test(label)) { em = e; key = touchMode() ? null : (k || null); break; }
  const st = enabled ? HK.stateOf(label) : {};
  HK.plateButton(g, { x, y, w, h }, em, label, tone, { pressed: !!st.pressed, hover: !!st.hover, disabled: !enabled, key, cinzel: !!em });
  buttons.push(enabled ? { x, y, w, h, label, action, up: true } : { x, y, w, h, label: 'disabled:' + label, action: () => { }, disabled: true, inert: true });
}
// The panel frame: the book's brown leather cover with brass corners, a vellum page inside, the title in Cinzel,
// the subtitle in the system sans, and an umber wax seal that closes it (labelled '×', the size of a kit row).
// The geometry contract is unchanged ({ px, py, w, h }, and panelRect), so every panel's contents stay where they were.
function panelBox(g, w, h, title, subtitle) {
  w = Math.min(w, VW - 20); h = Math.min(h, VH - 20);
  const px = Math.round(VW / 2 - w / 2), py = Math.round(Math.max(10, VH / 2 - h / 2 - 20));
  HK.bookCover(g, px, py, w, h, { flat: true });
  HK.bookPage(g, px + 6, py + 6, w - 12, h - 12);
  const cb = HK.row(), cx = px + w - cb - 12;
  const room = cx - 10 - (px + 18);
  let ts = 18; while (ts > 12 && HK.tw(g, title, HK.FC(800, ts)) > room) ts -= 0.5;
  HK.text(g, title, px + 18, py + 30, { font: HK.FC(800, ts), color: HK.T.goldHi, shadow: 'rgba(0,0,0,0.9)' });
  if (subtitle) {
    let sf = HK.FS(600, 12); const sw = HK.tw(g, subtitle, sf), full = w - 36;
    const lim = sw > room ? full : room;
    if (HK.tw(g, subtitle, sf) > lim) { let s = 12; while (s > 9.5 && HK.tw(g, subtitle, HK.FS(600, s)) > lim) s -= 0.5; sf = HK.FS(600, s); }
    HK.text(g, subtitle, px + 18, py + 50, { font: sf, color: HK.T.inkDim });
  }
  const st = HK.stateOf('×');
  HK.seal(g, cx + cb / 2, py + 10 + cb / 2, cb / 2, 'close', 'umber', { pressed: st.pressed, hover: st.hover, ripple: st.ripple, seed: 61, scale: 0.62 });
  buttons.push({ x: cx, y: py + 10, w: cb, h: cb, r: cb / 2, cx: cx + cb / 2, cy: py + 10 + cb / 2, label: '×', action: closePanel, up: true, name: 'Close', keys: ['Esc'] });
  panelRect = { x: px, y: py, w, h };
  return { px, py, w, h };
}
// Prev / Next: two plate buttons with drawn chevrons, and the page count between them. Returns the page shown (clamped).
function pager(g, x, y, w, page, pages, setPage) {
  const p = clamp(page, 0, Math.max(0, pages - 1));
  const one = (bx, label, em, on, fn) => {
    const st = on ? HK.stateOf(label) : {};
    HK.plateButton(g, { x: bx, y, w: 80, h: 30 }, null, label, null, { pressed: !!st.pressed, hover: !!st.hover, disabled: !on });
    g.fillStyle = g.strokeStyle = on ? HK.T.goldHi : HK.T.inkMute; HK.EM[em](g, label === 'Prev' ? bx + 13 : bx + 67, y + 15, 12);
    buttons.push(on ? { x: bx, y, w: 80, h: 30, label, action: fn, up: true } : { x: bx, y, w: 80, h: 30, label: 'disabled:' + label, action: () => { }, disabled: true, inert: true });
  };
  one(x, 'Prev', 'chevronL', p > 0, () => setPage(p - 1));
  HK.text(g, `${p + 1} / ${pages}`, x + w / 2, y + 20, { font: HK.FC(800, 13), align: 'center', color: HK.T.inkDim });
  one(x + w - 80, 'Next', 'chevronR', p < pages - 1, () => setPage(p + 1));
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
// The big monsters the boss banners show: level 25+ and 300+ hp within 12 tiles (the Fang draws its own), then any
// feature that registered one with hudBoss() (src/59-hudkit.js). Two at most.
function bossBarList() { return monsters.filter(m => !m.dead && m.type !== 'the_fang' && MONSTER_DEFS[m.type] && MONSTER_DEFS[m.type].level >= 25 && MONSTER_DEFS[m.type].hp >= 300 && dist(m.x, m.y, player.x, player.y) <= 12 * TILE).slice(0, 2); }
function hudBosses() {
  const out = bossBarList().map(m => { const def = MONSTER_DEFS[m.type]; return { key: m, mark: /goblin|walker|dozer|beast|sapper|brute/i.test(m.type + ' ' + def.name) ? 'goblin' : 'skull', name: def.name, lv: def.level, hp: Math.max(0, Math.ceil(m.hp)), max: m.maxHp }; });
  for (const f of (hudBoss.list || [])) { let b = null; try { b = f(); } catch (e) { b = null; } if (b) out.push(b); }
  return out.slice(0, 2);
}
function drawHud(g) {
  buttons.length = 0; minimapRect = null; dialogRect = null; panelRect = null;
  g.textBaseline = 'alphabetic';
  // touchMode() rather than isTouch: identical on a real device, but a test can force either layout
  const isT = touchMode();
  const narrow = VW < 640, short = isT && VH < 500;
  HK.FRAME.bosses = hudBosses();
  HK.FRAME.chatLines = window.CHAT && typeof CHAT.stripLines === 'function' ? CHAT.stripLines() : 0;
  const L = HK.layout();
  HK.beginPlaques(L, !!L.scrollRolled);
  const dead = player.dead;
  // the kit, in its fixed order: the ring, the seals, the crest, the scroll (or the boss / the rolled strip), the belt,
  // the stick and the four seats. When the knight has fallen everything but the crest dims.
  const dim = fn => { if (!dead) return fn(); g.save(); g.globalAlpha *= 0.4; try { fn(); } finally { g.restore(); } };
  dim(() => HK.drawRing(g, L));
  dim(() => HK.drawSeals(g, L));
  HK.drawCrest(g, L);
  dim(() => { HK.drawScroll(g, L); HK.drawBosses(g, L); });
  dim(() => HK.drawBelt(g, L));
  if (isT) dim(() => HK.drawStick(g, L));
  dim(() => HK.drawSeats(g, L));
  const nCore = buttons.length; for (let i = 0; i < nCore; i++) buttons[i].hud = true;
  // the feature hooks: plaques (HK.addPlaque), the FRIENDS seal state, the chat strip, and anything else a feature draws
  for (const h of HOOKS.hud) h(g, narrow);
  // the talk page: its tap goes in before the panels' own buttons, so a panel's buttons still win where they overlap it
  const talk = HK.dialogGeom(g, L);
  if (talk) { dialogRect = talk.r; buttons.push({ x: talk.r.x, y: talk.r.y, w: talk.r.w, h: talk.r.h, label: 'dialog', action: advanceDialog, up: true, hud: true, name: 'Next line', keys: ['Enter'] }); }
  drawPanels(g, narrow, short, 0, L.belt.h);
  // a panel owns its rectangle: a HUD control it covers does not take a tap through it
  if (panelRect) { const P = panelRect; for (let i = buttons.length - 1; i >= 0; i--) { const b = buttons[i]; if (b.hud && b.x < P.x + P.w && P.x < b.x + b.w && b.y < P.y + P.h && P.y < b.y + b.h) buttons.splice(i, 1); } }
  HK.drawTalk(g, talk);
  HK.drawBanners(g, L);
  HK.drawNotice(g, L);
  HK.drawOverlays(g, L);
  Object.assign(HUD_LAYOUT, { narrow, short });
  if (paused) {
    buttons.length = 0; minimapRect = null; dialogRect = null; panelRect = null; // nothing under the book is tappable
    HK.drawBook(g);
  }
}
// The quest compass: a gold arrowhead on the ring's inside edge at the tracked target's bearing, or a pulsing gold ring
// when the target is inside the glass. (x, y, size) is the glass square, as drawMinimap takes it.
function drawCompass(g, x, y, size) { HK.compassOnRing(g, x, y, size); }
// The boss banners in their slots (top centre on a computer and a landscape iPad; the scroll's slot elsewhere).
// Kept callable on its own for the features that stack under it: it advances the plaque cursor past the banners.
function drawBossBars(g, y) {
  const list = hudBosses();
  if (HK.FRAME.bosses.length !== list.length) HK.FRAME.bosses = list;
  const L = HK.layout({ bosses: list.length });
  HK.drawBosses(g, L);
  const first = L.plaques[L.scrollRolled ? 1 : 0];
  HUD.leftY = Math.max(HUD.leftY, y || 0, first ? first.y : 0);
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
      ? [['Tap the world', 'walk there · tap a tree, rock, water or person to use it · tap a monster to fight'], ['Hold on a thing', 'shows what it is, then acts when you let go'], ['Left side of screen', 'drag to move (or tap to walk)'], ['SWING', 'attack, shoot, stomp, hit a dummy (or double-tap the world)'], ['USE', 'talk, chop, mine, fish, cook, open, enter'], ['BAG', 'pack + worn gear (tap, tap = swap)'], ['BAG › Fight back', 'on: a monster that hits you gets hit back'], ['Hotbar', 'tap a slot to eat or use it'], ['Bag › Place', 'put down a plank, door, bed, lodestone or trap'], ['CRAFT / SKILLS / QUESTS', 'panels · QUESTS also shows what was Said'], ['HOME', 'teleport to your lodestone (5 min)'], ['EXIT', 'climb out of a walker or bulldozer'], ['Machines', 'USE a wreck to repair it, USE again to climb in'], ['Death', 'if you fall, he keeps your pack in his stone house'], ['Notice board', 'in the square and by the cave road: paid jobs'], ['Minimap', 'tap the minimap for the world map'], ['MENU', 'settings, title screen, new game']]
      : [['WASD / arrows', 'move'], ['Click the world', 'walk there · click a tree, rock, water, person or monster to use / fight it'], ['Space', 'swing, shoot, stomp'], ['E', 'talk, chop, mine, fish, cook, open, enter'], ['Q', 'place a plank, door, bed, lodestone or trap'], ['1–5', 'eat or use the first five pack slots'], ['I / C / Tab / J / M', 'pack · craft · skills · quests · map'], ['O', 'fight back when hit: on or off (also in the pack)'], ['H', 'teleport home (lodestone, 5 min)'], ['X', 'climb out of a machine'], ['Machines', 'E on a wreck repairs it, E again climbs in'], ['Death', 'if you fall, he keeps your pack in his stone house'], ['Notice board', 'in the square and by the cave road: paid jobs'], ['Enter', 'next line of talk (or click the box)'], ['Minimap', 'click the minimap (or M) for the world map'], ['Esc', 'menu (settings, title screen, new game)']];
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
    // Inside an instance the map is that instance: its name on the panel, its own rect drawn to fill the box, and
    // none of the overworld's region names, homes, markers or quest rings (they sit in the same top-left tiles).
    const view = mapView(), inside = !!view.id;
    // an instance's box is cut to its shape (Deepholm is nearly square): as wide as its map can be at the height there is
    let mw = Math.min(VW - 40, 760); if (inside) mw = Math.min(mw, Math.max(360, (VH - 60 - 80) * view.w / view.h + 36));
    const mh = Math.min(VH - 60, inside ? (mw - 36) * view.h / view.w + 80 : mw * MAP_H / MAP_W + 70);
    const { px, py, w, h } = panelBox(g, mw, mh, view.name, inside ? `${view.sub ? view.sub + '. ' : ''}White: you. Tap anywhere to close.` : 'White: you. Blue: home. Gold: quest targets. Tap anywhere to close.');
    if (miniDirty || miniDiffCount !== mapDiffs.size) refreshMini();
    const iw = w - 36, ih = Math.min(h - 80, iw * view.h / view.w), ix = px + 18, iy = py + 62;
    // the world keeps its old fit (full width, cropped at the foot on a short screen); an instance fits whole and is centred
    const sc = inside ? Math.min(iw / view.w, ih / view.h) : iw / MAP_W;
    const ox = inside ? ix + (iw - view.w * sc) / 2 : ix, oy = inside ? iy + (ih - view.h * sc) / 2 : iy;
    mapLayout = { ix, iy, iw, ih, ox, oy, sc, view };
    g.save(); roundRect(g, ix, iy, iw, ih, 8); g.clip();
    if (inside) { g.fillStyle = '#0b0f14'; g.fillRect(ix, iy, iw, ih); }
    g.imageSmoothingEnabled = false; g.drawImage(miniCanvas, 0, 0, view.w, view.h, ox, oy, view.w * sc, view.h * sc); g.imageSmoothingEnabled = true;
    for (const r of REGIONS) {
      if (r.name === 'Goblin Fields' || r.name === 'The Wilds') continue;
      // inside: only a region a feature marked as this instance's own (r.instance === id) and not the whole-instance one the title already names
      if (inside ? r.instance !== view.id || (r.x0 <= 0 && r.y0 <= 0 && r.x1 >= view.w - 1 && r.y1 >= view.h - 1) : r.instance) continue;
      const cx = ox + (r.x0 + r.x1 + 1) / 2 * sc, cy = oy + (r.y0 + r.y1 + 1) / 2 * sc; g.font = `700 ${Math.max(9, Math.min(16, sc * 2.2))}px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(r.name.toUpperCase(), cx, cy); g.fillStyle = '#e6edf3'; g.fillText(r.name.toUpperCase(), cx, cy);
    }
    const dot = (wx, wy, color, r) => { g.fillStyle = color; g.beginPath(); g.arc(ox + wx / TILE * sc, oy + wy / TILE * sc, r, 0, 7); g.fill(); };
    if (player.home && !inside) dot(player.home.x, player.home.y, '#7ec8ff', 4);
    for (const t of mapTargets()) {
      const tx = ox + (t.x + 0.5) * sc, ty = oy + (t.y + 0.5) * sc, isTracked = t.id === quest.tracked;
      g.strokeStyle = isTracked ? '#f5c542' : 'rgba(245,197,66,0.7)'; g.lineWidth = isTracked ? 2.5 : 1.5; g.beginPath(); g.arc(tx, ty, (isTracked ? 6 : 5) + Math.sin(time * 4) * 2, 0, 7); g.stroke();
      if (t.label) { g.font = `bold ${narrow ? 9 : 11}px sans-serif`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(t.label, tx, ty - 10); g.fillStyle = '#f5c542'; g.fillText(t.label, tx, ty - 10); }
    }
    dot(player.x, player.y, 'rgba(0,0,0,0.7)', 5.5); dot(player.x, player.y, '#ffffff', 4); // the rim keeps him visible on white cloud
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
    // The chest holds everything from every fall, so it can be long: every entry is listed, a page at a time when
    // they do not all fit, with the total count on top and nothing written past the panel's edge.
    const bw = Math.min(460, VW - 20), ROW = 22, textW = bw - 36;
    let intro, plan = null, fee = 0, rest = 0;
    if (!deathKeep) intro = "The chest is empty. For now. When you fall, what you carry comes here, and it stays here, from every fall, until you collect it. Cheap things I return for nothing. Precious things cost a share of their worth, and I take it from your own coin first.";
    else {
      plan = reclaimPlan(); fee = plan.total;
      const fromHeld = Math.min(chestCoins(deathKeep.items), fee); rest = fee - fromHeld;
      const how = `${fromHeld ? `, ${fromHeld} of it from the coins you dropped` : ''}${rest ? `, ${rest} from your hand` : ''}`;
      intro = 'I keep everything from every fall until you collect it. ' + (plan.all
        ? (fee ? `The fee is ${fee} coins${how}.` : 'Nothing in it is worth my time. Take it, and try not to fall again.')
        : `Your pack has room for only part of it${fee ? `. The fee for that part is ${fee} coins${how}` : ''}. The rest stays here until you come back.`);
    }
    g.font = '14px sans-serif'; const introLines = dialogLines(g, intro, textW);
    const listTop = 98 + (introLines - 1) * 19 + 26; // offset from the panel top of the "In the chest" line
    const n = deathKeep ? deathKeep.items.length : 0;
    const fullH = deathKeep ? listTop + 12 + n * ROW + 68 : 98 + introLines * 19 + 24;
    const { px, py, w, h } = panelBox(g, 460, Math.min(VH - 20, Math.max(200, fullH)), "Death's Chest", 'Piles of his gold. A chest of what you lost.');
    g.fillStyle = '#b58cff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left'; g.fillText('DEATH', px + 18, py + 76);
    g.fillStyle = '#e6edf3'; g.font = '14px sans-serif'; wrapText(g, intro, px + 18, py + 98, w - 36, 19);
    if (deathKeep) {
      const items = deathKeep.items;
      g.fillStyle = '#8b949e'; g.font = 'bold 12px sans-serif'; g.textAlign = 'left';
      let head = `In the chest: ${chestWords()}`; while (g.measureText(head).width > w - 36 && head.length > 8) head = head.slice(0, -2) + '…';
      g.fillText(head, px + 18, py + listTop);
      // rows between the heading and the button; a Prev / Next row takes 38 px when there is more than one page
      const room = h - listTop - 12 - 60;
      let perPage = Math.max(1, Math.floor(room / ROW));
      if (n > perPage) perPage = Math.max(1, Math.floor((room - 38) / ROW));
      const pages = Math.max(1, Math.ceil(n / perPage)); coffinPage = clamp(coffinPage, 0, pages - 1);
      const first = coffinPage * perPage;
      items.slice(first, first + perPage).forEach((s, k) => {
        const i = first + k, y = py + listTop + 12 + k * ROW + 14, coin = s.id === 'coins';
        const fits = plan.fits[i], f = plan.fees[i];
        const right = coin ? 'free' : fits <= 0 ? 'no room' : f > 0 ? `${f}c` : 'free';
        g.font = '12px sans-serif'; const rw = g.measureText(right).width;
        g.fillStyle = coin || f <= 0 ? '#6e7681' : '#f5c542'; if (!coin && fits <= 0) g.fillStyle = '#ff9b6b';
        g.textAlign = 'right'; g.fillText(right, px + w - 18, y);
        drawItemIcon(g, s.id, px + 28, y - 4, 16);
        g.font = '13px sans-serif'; g.textAlign = 'left'; g.fillStyle = '#c9d1d9';
        let t = `${ITEMS[s.id] ? ITEMS[s.id].name : s.id} × ${s.qty}` + (!coin && fits > 0 && fits < s.qty ? ` (room for ${fits})` : '');
        const maxW = w - 36 - 26 - rw - 10; while (g.measureText(t).width > maxW && t.length > 6) t = t.slice(0, -2) + '…';
        g.fillText(t, px + 44, y);
      });
      if (pages > 1) pager(g, px + 18, py + h - 52 - 38, w - 36, coffinPage, pages, p => { coffinPage = clamp(p, 0, pages - 1); });
      const ok = coins() >= rest;
      const label = plan.all ? (fee ? `Reclaim everything for ${fee} coins` : 'Reclaim everything') : (fee ? `Reclaim everything that fits for ${fee} coins` : 'Reclaim everything that fits');
      button(g, px + 18, py + h - 52, w - 36, 36, label, reclaimFromDeath, ok ? '#5a2e7a' : '#2a2f3a', ok);
    }
  }
}

function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '';
  for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; } else line = test; }
  if (line) g.fillText(line, x, y);
}
