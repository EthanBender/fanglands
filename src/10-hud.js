// ============================================================================
// HUD AND PANELS
// The HUD is drawn from the Heraldry kit (src/59-hudkit.js): one knight's kit — a crest for health, a quest scroll,
// an iron-ringed minimap, a leather belt with five pouches and the BAG satchel, iron studs for the four touch seats,
// wax seals for HOME / FRIENDS / MENU — every piece in a place HK.layout() reserved for it, so nothing jumps.
// Panels wear the kit's frame: panelBox() is the book's cover and vellum page, button() is an iron plate button.
//
// THE PANEL CONTRACT (every core panel below, and the ones other files draw):
//   frame     panelBox(g, w, h, title, sub) -> { px, py, w, h }; content starts at py + 62; it sits inside the safe
//             insets (notch, Dynamic Island, home bar) and on screen, and closes with the umber '×' seal.
//   words     HK.text with a box. Sentences in the system sans (HK.FS(600, 13-14), grows with Text size); names,
//             headers and numbers in Cinzel (HK.FC(800, 11-13)); section headers are gold Cinzel capitals.
//             Colours come only from HK.T. Long text wraps at whole words (HK.wrap); nothing is cut inside a word.
//   rows      a vellum plate (HK.vellumPlate) or a gold hairline between them.
//   items     drawSlot pouches, 44 px or more on touch.
//   verbs     button() at HK.row() (44 on touch, 32 with a mouse); green means the primary choice, red means danger.
//   tabs      plate buttons, the chosen one primary (gold edge), like the book's Kit / Keys bookmarks.
//   lists     long lists page with pager() instead of shrinking.
// ============================================================================
// A pack / bank / shop slot: a small leather pouch with the item in its mouth. Selected = a gold stitched edge.
// st (optional) = the pouch's press state from HK.stateOf(label).
function drawSlot(g, x, y, size, slot, selected, st) {
  HK.pouch(g, { x, y: y - Math.round(size * 0.04), w: size, h: Math.round(size * 1.04) }, slot ? { id: slot.id, qty: slot.qty } : null, '', { selected, pressed: !!(st && st.pressed), hover: !!(st && st.hover), ripple: st ? st.ripple : null });
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

// ---------- the panel toolkit: the pieces every core panel (and the Wiki book) is built from ----------
const PANEL_KIT = (() => {
  // the room a panel may use: inside the notch / Dynamic Island / home-indicator insets, with a small margin
  function room() {
    const t = touchMode(), fam = HK.family(VW, VH, t), S = HK.insets(VW, VH, fam, t), m = t ? 6 : 10;
    return { t, fam, S, m, aw: VW - S.l - S.r - 2 * m, ah: VH - S.t - S.b - 2 * m, R: HK.row(), G: t ? 8 : 6 };
  }
  // pages per panel (and per tab), reset whenever a panel opens
  const pages = {};
  const page = (k, v) => { if (v !== undefined) pages[k] = v; return pages[k] || 0; };
  const resetPages = () => { for (const k in pages) delete pages[k]; };
  const k = () => (HK.k ? HK.k() : 1);
  const lineH = size => Math.round(size * k() * 1.32);
  const FB = (s, w) => HK.FS(w || 600, s || 13);
  const FN = (s, w) => HK.FC(w || 800, s || 13);
  // a gold hairline (rows, dividers)
  function hair(g, x, y, w, a) {
    g.beginPath(); g.moveTo(Math.round(x), Math.round(y) + 0.5); g.lineTo(Math.round(x + w), Math.round(y) + 0.5);
    g.strokeStyle = `rgba(217,178,92,${a == null ? 0.35 : a})`; g.lineWidth = 1; g.stroke();
  }
  // a section header: gold Cinzel capitals, then a hairline to the end of the room. y is the baseline.
  function head(g, x, y, w, label, o = {}) {
    let s = o.size || 11.5; while (s > 9 && HK.tw(g, label, FN(s)) > w) s -= 0.5;
    const tw = HK.text(g, label, x, y, { font: FN(s), color: o.color || HK.T.gold, shadow: 'rgba(0,0,0,0.8)', box: { x, y: y - 12, w, h: 16 }, fitId: 'panel:head' });
    if (o.rule !== false && tw + 18 < w) hair(g, x + tw + 10, y - 4, w - tw - 10);
    return tw;
  }
  // sentence text wrapped at whole words. Returns { h, lines, more }. It shrinks a step (to o.min) before it gives up
  // lines, and when the lines still run out the last one ends at a word.
  function para(g, s, x, y, w, o = {}) {
    const wt = o.weight || 600, max = o.lines || 99;
    let size = o.size || 13, f = FB(size, wt), ww = HK.wrap(g, s, w, max, f);
    while (ww.more && size > (o.min || 11.5)) { size -= 0.5; f = FB(size, wt); ww = HK.wrap(g, s, w, max, f); }
    const lh = o.lh || lineH(size);
    if (!o.measure) ww.lines.forEach((ln, i) => HK.text(g, ln, x, y + i * lh, { font: f, color: o.color || HK.T.ink, align: o.align, box: { x: o.align === 'center' ? x - w / 2 : x, y: y + i * lh - lh + 3, w, h: lh }, fitId: o.fitId || 'panel:text' }));
    return { h: ww.lines.length * lh, lines: ww.lines, more: ww.more, lh };
  }
  // one line of Cinzel that shrinks to fit (names, numbers); returns the width drawn
  function name(g, s, x, y, w, o = {}) {
    let size = o.size || 13; while (size > (o.min || 9.5) && HK.tw(g, s, FN(size)) > w) size -= 0.5;
    let shown = String(s);
    if (HK.tw(g, shown, FN(size)) > w) shown = HK.wrap(g, shown, w, 1, FN(size)).lines[0] || shown;
    return HK.text(g, shown, x, y, { font: FN(size), align: o.align, color: o.color || HK.T.ink, shadow: 'rgba(0,0,0,0.8)', box: { x: o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x, y: y - size, w, h: size + 4 }, fitId: o.fitId || 'panel:name' });
  }
  // the width a plate button needs for its word (with its emblem roundel when it has one)
  function verbW(g, text, emblem, h, cinzel) {
    const size = cinzel ? Math.min(15, Math.round(h * 0.36)) : Math.min(14, Math.max(11, Math.round(h * 0.34)));
    const w0 = HK.tw(g, text, cinzel ? HK.FC(800, size) : HK.FS(700, size));
    return Math.ceil(emblem && h >= 30 ? w0 + (h - 10) + 32 : w0 + 28);
  }
  // a plate button with an emblem: the same buttons[] entry button() pushes (pointer-up, 'disabled:' when greyed)
  function verb(g, x, y, w, h, label, action, o = {}) {
    const on = o.enabled !== false, st = on ? HK.stateOf(label) : {};
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    HK.plateButton(g, { x, y, w, h }, o.emblem || null, o.text != null ? o.text : label, o.tone || null, { pressed: !!st.pressed, hover: !!st.hover, disabled: !on, on: !!o.on, key: o.key || null, cinzel: !!o.cinzel, size: o.size });
    const b = on ? { x, y, w, h, label, action, up: true } : { x, y, w, h, label: 'disabled:' + label, action: () => { }, disabled: true, inert: true };
    if (o.name) { b.name = o.name; b.keys = o.keys || []; }
    buttons.push(b);
    return b;
  }
  // a plate-button body with nothing written on it yet (the caller draws an icon and its own words on top)
  function plate(g, x, y, w, h, label, action, o = {}) {
    const on = o.enabled !== false, st = on ? HK.stateOf(label) : {};
    HK.plateButton(g, { x, y, w, h }, null, '', o.tone || null, { pressed: !!st.pressed, hover: !!st.hover, disabled: !on });
    buttons.push(on ? { x, y, w, h, label, action, up: true } : { x, y, w, h, label: 'disabled:' + label, action: () => { }, disabled: true, inert: true });
    return { pressed: !!st.pressed, hover: !!st.hover, dy: st.pressed ? 1.5 : 0 };
  }
  // TABS: plate buttons in a row (two rows when they do not fit), the chosen one primary. list = [{ label, text }].
  // Returns the height used.
  function tabs(g, x, y, w, list, sel, pick, o = {}) {
    const { R, G, t } = room(), min = t ? 56 : 60;
    const nat = list.map(it => Math.max(min, verbW(g, it.text || it.label, null, R)));
    const one = nat.reduce((a, b) => a + b, 0) + G * (list.length - 1) <= w;
    const rows = one ? [list.map((_, i) => i)] : (() => { const half = Math.ceil(list.length / (o.rows3 ? 3 : 2)); const out = []; for (let i = 0; i < list.length; i += half) out.push(list.slice(i, i + half).map((_, j) => i + j)); return out; })();
    let yy = y;
    for (const r of rows) {
      let xx = x; const eq = one ? null : Math.floor((w - G * (r.length - 1)) / r.length);
      for (const i of r) {
        const it = list[i], bw = eq || nat[i], on = it.label === sel;
        verb(g, xx, yy, bw, R, it.label, () => pick(it.label), { text: it.text, tone: on ? 'primary' : null });
        xx += bw + G;
      }
      yy += R + G;
    }
    return yy - y - G;
  }
  // an iron roundel with an emblem (help rows, the pack's FITTED line)
  function roundel(g, cx, cy, r, em, col) {
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = '#111317'; g.fill();
    g.beginPath(); g.arc(cx, cy, r - 1, 0, Math.PI * 2); g.strokeStyle = 'rgba(217,178,92,0.7)'; g.lineWidth = 1.5; g.stroke();
    HK.emblem(g, em, cx, cy, r * 1.15, col || HK.T.ink, { hole: '#111317' });
  }
  // marks the kit does not draw (yet): a flame for 'Light fire'. Added to HK.EM on first use so plateButton can use it.
  function marks() {
    if (HK.EM.flame) return;
    HK.EM.flame = (c, cx, cy, s) => {
      c.save(); c.translate(cx, cy); c.beginPath();
      c.moveTo(0, -s * 0.5); c.bezierCurveTo(s * 0.34, -s * 0.18, s * 0.4, s * 0.08, s * 0.3, s * 0.3);
      c.quadraticCurveTo(s * 0.18, s * 0.5, 0, s * 0.5); c.quadraticCurveTo(-s * 0.18, s * 0.5, -s * 0.3, s * 0.3);
      c.bezierCurveTo(-s * 0.4, s * 0.06, -s * 0.22, -s * 0.06, -s * 0.12, -s * 0.24); c.quadraticCurveTo(-s * 0.04, -s * 0.02, s * 0.02, -s * 0.06);
      c.quadraticCurveTo(s * 0.08, -s * 0.28, 0, -s * 0.5); c.closePath(); c.fill(); c.restore();
    };
  }
  return { room, page, resetPages, lineH, FB, FN, hair, head, para, name, verbW, verb, plate, tabs, roundel, marks };
})();
// every panel opens on its first page
{ const _openPanel = openPanel; openPanel = function (name, arg) { PANEL_KIT.resetPages(); return _openPanel(name, arg); }; }

// The panel frame: the book's brown leather cover with brass corners, a vellum page inside, the title in Cinzel,
// the subtitle in the system sans, and an umber wax seal that closes it (labelled '×', the size of a kit row).
// The frame stays inside the safe insets (the notch, the Dynamic Island, the home bar) and on screen. The subtitle
// never runs under the seal and is never cut inside a word: it shrinks, then wraps to a second line in the header.
// The geometry contract is unchanged ({ px, py, w, h }, panelRect, contents from py + 62).
function panelBox(g, w, h, title, subtitle) {
  const Rm = PANEL_KIT.room(), S = Rm.S;
  w = Math.round(Math.min(w, Rm.aw)); h = Math.round(Math.min(h, Rm.ah));
  const px = Math.round(S.l + Rm.m + (Rm.aw - w) / 2);
  const py = Math.round(clamp(VH / 2 - h / 2 - 20, S.t + Rm.m, VH - S.b - Rm.m - h));
  HK.bookCover(g, px, py, w, h, { flat: true });
  HK.bookPage(g, px + 6, py + 6, w - 12, h - 12);
  const cb = HK.row(), cx = px + w - cb - 12, sealBottom = py + 10 + cb;
  const room = cx - 12 - (px + 18);
  let ts = 18; while (ts > 12 && HK.tw(g, title, HK.FC(800, ts)) > room) ts -= 0.5;
  let subLines = null, sf = null;
  if (subtitle) {
    let s = 12; sf = HK.FS(600, s);
    while (s > 10.5 && HK.tw(g, subtitle, sf) > room) { s -= 0.5; sf = HK.FS(600, s); }
    if (HK.tw(g, subtitle, sf) <= room) subLines = [[String(subtitle), room]];
    else {
      // two lines in the header: the first beside the seal; the second beside it too, or the full width when the
      // seal ends above it (a mouse's smaller seal)
      sf = HK.FS(600, 11);
      const room2 = sealBottom + 2 < py + 48 ? w - 36 : room;
      const words = String(subtitle).split(/\s+/).filter(Boolean), l1 = [], l2 = [];
      for (const wd of words) { if (!l2.length && HK.tw(g, l1.concat(wd).join(' '), sf) <= room) l1.push(wd); else l2.push(wd); }
      while (l2.length && HK.tw(g, l2.join(' '), sf) > room2) l2.pop();
      subLines = [[l1.join(' '), room], [l2.join(' '), room2]];
    }
  }
  const two = subLines && subLines.length > 1;
  HK.text(g, title, px + 18, py + (two ? 28 : 30), { font: HK.FC(800, ts), color: HK.T.goldHi, shadow: 'rgba(0,0,0,0.9)', box: { x: px + 18, y: py + 10, w: room, h: 24 }, fitId: 'panel:title' });
  if (subLines) subLines.forEach(([s, rw], i) => { if (s) HK.text(g, s, px + 18, py + (two ? 44 + i * 14 : 50), { font: sf, color: HK.T.inkDim, box: { x: px + 18, y: py + 36 + i * 14, w: rw, h: 16 }, fitId: 'panel:sub' }); });
  const st = HK.stateOf('×');
  HK.seal(g, cx + cb / 2, py + 10 + cb / 2, cb / 2, 'close', 'umber', { pressed: st.pressed, hover: st.hover, ripple: st.ripple, seed: 61, scale: 0.62 });
  buttons.push({ x: cx, y: py + 10, w: cb, h: cb, r: cb / 2, cx: cx + cb / 2, cy: py + 10 + cb / 2, label: '×', action: closePanel, up: true, name: 'Close', keys: ['Esc'] });
  panelRect = { x: px, y: py, w, h };
  return { px, py, w, h };
}
// Prev / Next: two plate buttons a kit row tall (44 on touch, 32 with a mouse) with drawn chevrons, and the page
// count between them. Returns the page shown (clamped).
function pager(g, x, y, w, page, pages, setPage) {
  const p = clamp(page, 0, Math.max(0, pages - 1)), R = HK.row(), bw = touchMode() ? 96 : 84;
  const one = (bx, label, em, on, fn) => {
    const st = on ? HK.stateOf(label) : {};
    HK.plateButton(g, { x: bx, y, w: bw, h: R }, null, label, null, { pressed: !!st.pressed, hover: !!st.hover, disabled: !on });
    g.fillStyle = g.strokeStyle = on ? HK.T.goldHi : HK.T.inkMute; HK.EM[em](g, label === 'Prev' ? bx + 14 : bx + bw - 14, y + R / 2 + (st.pressed ? 1.5 : 0), 12);
    buttons.push(on ? { x: bx, y, w: bw, h: R, label, action: fn, up: true } : { x: bx, y, w: bw, h: R, label: 'disabled:' + label, action: () => { }, disabled: true, inert: true });
  };
  one(x, 'Prev', 'chevronL', p > 0, () => setPage(p - 1));
  HK.text(g, `${p + 1} / ${pages}`, x + w / 2, y + R / 2 + 5, { font: HK.FC(800, 13), align: 'center', color: HK.T.inkDim });
  one(x + w - bw, 'Next', 'chevronR', p < pages - 1, () => setPage(p + 1));
  return p;
}
function drawInvGrid(g, x, y, cols, size, gap, onClick, swap = false) {
  for (let i = 0; i < INV_SLOTS; i++) {
    const cx = x + (i % cols) * (size + gap), cy = y + Math.floor(i / cols) * (size + gap);
    drawSlot(g, cx, cy, size, player.inv[i], selectedSlot === i, HK.stateOf('slot' + i));
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

// =================================================================================================
// THE CORE PANELS
// =================================================================================================
// ---------- the pack (the satchel, I, the BAG tile) ----------
// After the runner-up Kit's pack: a 5 x 4 grid of pouches (the top row is the belt), WORN beside it (2 x 3; 3 x 2 when
// stacked on an upright phone) with each empty slot's name, the gear's stats in plain words, the chosen item with ONE
// row of verbs (Eat / Equip / Place / Light fire / Throw, Drop, Wiki), the keyring as a leather strap of 44 px tiles,
// the Home plate when a lodestone is set, and FITTED while you drive the bulldozer.
function packFitted() { return player.mech && player.mech.kind === 'dozer' && typeof dozerFitted === 'function' ? dozerFitted() : []; }
function packKeys() { try { return window.KEYRING && KEYRING.list ? KEYRING.list() : []; } catch (e) { return []; } }
function drawPackPanel(g) {
  const K = PANEL_KIT, Rm = K.room(), { t, fam, R, G } = Rm, T = HK.T;
  K.marks();
  const stacked = fam === 'phoneP';
  const nW = EQUIP_SLOTS.length, wc = stacked ? 3 : 2, wr = Math.ceil(nW / wc);
  const HEAD = 18, keys = packKeys(), fitted = packFitted(), inMech = !!player.mech, home = !!player.home && !inMech;
  const lhB = K.lineH(13), lhS = K.lineH(12);
  // the verbs: one fixed slot each, so nothing shifts when an item is chosen or Drop asks again
  const acts = [['Eat', 'heart'], ['Equip', 'block'], ['Place', 'build'], ['Light fire', 'flame'], ['Throw', 'bomb']];
  let emb = true;
  const slotW = () => [Math.max(...acts.map(([a, e]) => K.verbW(g, a, emb && e, R))), K.verbW(g, 'Tap again to drop', emb && 'getdown', R), K.verbW(g, 'Wiki', emb && 'book', R)];
  let aw3 = slotW();
  const actSum = () => aw3[0] + aw3[1] + aw3[2] + 2 * G;
  const fitAct = room => { if (actSum() > room) { emb = false; aw3 = slotW(); } if (actSum() > room) { const k0 = (room - 2 * G) / (actSum() - 2 * G); aw3 = aw3.map(v => Math.floor(v * k0)); } };
  const statsLine = `Strength +${gearBonus('str')} · Accuracy +${gearBonus('att')} · Defence +${gearBonus('def')} · Max hit ${playerMaxHit()}`;
  const statsList = [`Strength +${gearBonus('str')}`, `Accuracy +${gearBonus('att')}`, `Defence +${gearBonus('def')}`, `Max hit ${playerMaxHit()}`];
  const fitTxt = fitted.length ? 'Fitted: ' + fitted.join(', ') : '';
  const keyRow = keys.length ? HEAD + 44 + 6 : 0;
  const itemH = 18 + 2 * lhB;                         // the name, then two lines of blurb (reserved, so nothing jumps)
  const statsH = lhS * (fitted.length ? 3 : 1) + 10;
  // the side column beside WORN: the stats as a list, FITTED, and Home
  const sideH = 4 + statsList.length * lhS + (fitted.length ? 4 + 2 * lhS : 0) + (home ? 8 + R : 0);
  // ---- measure: stacked (an upright phone), below (desk / iPad: the Kit's look) or beside (a phone on its side) ----
  let mode, cw, h, s, side = false;
  const dims = () => { const gridW = 5 * s + 4 * G, wornW = wc * s + (wc - 1) * G; return { gridW, gridH: 4 * s + 3 * G, wornW, wornH: wr * s + (wr - 1) * G, aW: gridW + 16 + wornW }; };
  if (stacked) {
    mode = 'stacked'; cw = Rm.aw - 36; fitAct(cw); side = true;
    const measure = () => { const D = dims(); return 62 + HEAD + D.gridH + 12 + Math.max(HEAD + D.wornH, sideH) + 18 + itemH + 8 + R + 12 + keyRow + 8; };
    // the pouches as big as the width allows (56 at most), then smaller until the page fits the screen (44 at least)
    s = t ? Math.min(56, Math.floor((cw - 4 * G) / 5)) : 46;
    while (s > 44 && measure() > Rm.ah) s -= 2;
    h = measure();
  } else {
    s = t ? (fam === 'tab' ? 52 : 44) : 46;
    const D = dims(), belowW = Math.max(D.aW, 170 + 16 + actSum());
    side = belowW - D.aW - 16 >= 150;
    const band = side ? Math.max(HEAD + D.gridH, HEAD + sideH) + 8 : HEAD + D.gridH + 8 + statsH;
    const belowH = 62 + band + 18 + Math.max(itemH, R) + 12 + Math.max(keyRow, !side && home ? R : 0) + 12;
    if (belowH <= Rm.ah && belowW <= Rm.aw - 36) { mode = 'below'; cw = belowW; h = belowH; }
    else {
      mode = 'beside'; side = false;
      const iw = Math.min(360, Rm.aw - 36 - D.aW - 24);
      fitAct(iw);
      cw = D.aW + 24 + iw;
      const infoH = HEAD + itemH + 8 + R + 12 + keyRow + (home ? R + 8 : 0);
      h = 62 + Math.max(HEAD + D.gridH + 8 + statsH, infoH) + 12;
    }
  }
  const { gridW, gridH, wornW, wornH, aW } = dims();
  const nUsed = player.inv.filter(Boolean).length;
  const { px, py, w } = panelBox(g, cw + 36, h, 'Your pack', `${nUsed} of ${INV_SLOTS} pouches used. Tap two to swap them.`);
  const x0 = px + 18, y0 = py + 62, cwR = w - 36;
  // ---- the grid (PACK): the top row is the belt ----
  K.head(g, x0, y0 + 12, 60, 'PACK', { rule: false });
  const nx = x0 + HK.tw(g, 'PACK', K.FN(11.5)) + 10;
  HK.text(g, 'Top row is your belt', nx, y0 + 12, { font: K.FB(11.5), color: T.inkMute, box: { x: nx, y: y0, w: x0 + gridW - nx, h: 16 }, fitId: 'pack:note' });
  const gx = x0, gy = y0 + HEAD;
  drawInvGrid(g, gx, gy, 5, s, G, i => { selectedSlot = selectedSlot === i ? -1 : i; }, true);
  // ---- WORN: every slot a knight wears, empty ones named ----
  const wx = stacked ? x0 : gx + gridW + 16, wyH = stacked ? gy + gridH + 12 : y0, wy = wyH + HEAD;
  K.head(g, wx, wyH + 12, wornW, 'WORN');
  EQUIP_SLOTS.forEach((kk, i) => {
    const ex = wx + (i % wc) * (s + G), ey = wy + Math.floor(i / wc) * (s + G), id = player.equip[kk];
    drawSlot(g, ex, ey, s, id ? { id, qty: 1 } : null, false, id ? HK.stateOf('eq' + kk) : null);
    if (!id) {
      const word = kk.charAt(0).toUpperCase() + kk.slice(1);
      let fs = 11; while (fs > 8.5 && HK.tw(g, word, HK.FS(600, fs)) > s - 6) fs -= 0.5;
      HK.text(g, word, ex + s / 2, ey + s * 0.58, { font: HK.FS(600, fs), align: 'center', color: T.inkMute, box: { x: ex + 2, y: ey, w: s - 4, h: s }, fitId: 'pack:worn' });
    } else buttons.push({ x: ex, y: ey, w: s, h: s, label: 'eq' + kk, action: () => unequip(kk), name: `${ITEMS[id] ? ITEMS[id].name : id}: tap to take it off` });
  });
  // ---- the gear's stats in plain words, and FITTED while driving the bulldozer ----
  const fittedAt = (fx, top, fw) => {
    K.roundel(g, fx + 10, top + lhS / 2 + 1, 10, 'drill', T.goldHi);
    return K.para(g, fitTxt, fx + 26, top + lhS - 3, fw - 26, { size: 12, lines: 2, color: T.ink, fitId: 'pack:fitted' }).h;
  };
  let sideBottom;
  if (side) {
    const sx = wx + wornW + 16, sw = x0 + cwR - sx;
    let top = (stacked ? wyH : wy) + 4;
    for (const ln of statsList) { HK.text(g, ln, sx, top + lhS - 3, { font: K.FB(12), color: T.inkDim, box: { x: sx, y: top, w: sw, h: lhS }, fitId: 'pack:stats' }); top += lhS; }
    if (fitted.length) { top += 4; top += fittedAt(sx, top, sw); }
    if (home) { top += 8; packHome(g, sx, top, Math.min(sw, 150), R); top += R; }
    sideBottom = Math.max(wy + wornH, gy + (stacked ? 0 : gridH), top);
  } else {
    let top = gy + gridH + 8;
    top += K.para(g, statsLine, x0, top + lhS - 3, aW, { size: 12, lines: 1, min: 10, color: T.inkDim, fitId: 'pack:stats' }).h;
    if (fitted.length) { top += 2; top += fittedAt(x0, top, aW); }
    sideBottom = top;
  }
  // ---- the chosen item, and its ONE row of verbs ----
  let ix, iy, iw;
  if (mode === 'beside') { ix = gx + aW + 24; iw = x0 + cwR - ix; K.head(g, ix, y0 + 12, iw, 'CHOSEN'); iy = y0 + HEAD; }
  else { ix = x0; iw = cwR; iy = Math.round(sideBottom + 8); K.hair(g, x0, iy, cwR, 0.45); iy += 10; }
  const sl = selectedSlot >= 0 ? player.inv[selectedSlot] : null;
  const actY = mode === 'below' ? iy + Math.round(Math.max(0, itemH - R) / 2) : iy + itemH + 8;
  const actX = mode === 'below' ? ix + iw - actSum() : ix;
  const textW = mode === 'below' ? iw - actSum() - 16 : iw;
  if (sl) {
    const def = ITEMS[sl.id];
    try { drawItemIcon(g, sl.id, ix + 12, iy + 10, 22); } catch (e) { }
    K.name(g, `${def.name} × ${sl.qty}`, ix + 30, iy + 15, textW - 30, { size: 14 });
    K.para(g, itemBlurb(def), ix, iy + 18 + lhB - 2, textW, { size: 13, lines: 2, color: T.inkDim, fitId: 'pack:blurb' });
    const act = def.heal ? 'Eat' : (def.weapon || def.armour) ? 'Equip' : def.place ? 'Place' : def.burn ? 'Light fire' : def.throwable ? 'Throw' : null;
    let bx = actX;
    if (act) K.verb(g, bx, actY, aw3[0], R, act, () => { const i = selectedSlot; useItem(i); if (act !== 'Equip') return; selectedSlot = -1; }, { emblem: emb && acts.find(a => a[0] === act)[1], tone: 'primary' });
    bx += aw3[0] + G;
    const doDrop = () => { const q = player.inv[selectedSlot]; if (!q) return; drops.push({ x: player.x + player.facing.x * 30, y: player.y + player.facing.y * 30, id: q.id, qty: q.qty, t: 0 }); player.inv[selectedSlot] = null; selectedSlot = -1; save(); };
    const arm = needsConfirm(def) && confirmActive('drop');
    K.verb(g, bx, actY, aw3[1], R, arm ? 'Tap again to drop' : 'Drop', () => { if (needsConfirm(def)) confirmTap('drop', doDrop); else doDrop(); }, { emblem: emb && 'getdown', tone: 'danger' });
    bx += aw3[1] + G;
    const wid = sl.id;
    K.verb(g, bx, actY, aw3[2], R, 'Wiki', () => { if (window.WIKI) WIKI.open('items', wid); }, { emblem: emb && 'book', name: `Read about ${def.name}`, keys: ['K'] });
  } else {
    K.para(g, t ? 'Tap a thing to choose it. Tap what you wear to take it off.' : 'Click a thing to choose it. Keys 1 to 5 use the belt row.', ix, iy + 15, textW, { size: 13, lines: 2, color: T.inkDim, fitId: 'pack:hint' });
  }
  // ---- the keyring, and the Home plate (in the side column when there is one) ----
  const ky = mode === 'below' ? iy + Math.max(itemH, R) + 12 : actY + R + 12;
  const homeHere = home && !side;
  if (keys.length) packKeyring(g, ix, ky, mode === 'below' && homeHere ? iw - 166 : iw, keys);
  if (homeHere) {
    if (mode === 'below') packHome(g, ix + iw - 150, ky + (keys.length ? HEAD : 0), 150, R);
    else packHome(g, ix, ky + keyRow, Math.min(iw, 160), R);
  }
}
// the Home plate: the lodestone teleport, with its cooldown written on it
function packHome(g, x, y, w, h) {
  const left = Math.max(0, HOME_COOLDOWN - (time - (player.homeCd || -1e9)));
  const mm = `${Math.floor(Math.ceil(left) / 60)}:${String(Math.ceil(left) % 60).padStart(2, '0')}`;
  PANEL_KIT.verb(g, x, y, w, h, touchMode() ? 'HOME' : 'Home (H)', goHome, { emblem: 'home', text: left > 0 ? `Home ${mm}` : 'Home', key: touchMode() || w < 110 ? null : 'H', name: left > 0 ? `Home · ready in ${mm}` : 'Home', keys: ['H'] });
}
// THE KEYRING: a leather key strap with brass-edged 44 px tiles. Tap one: its note.
function packKeyring(g, x, y, w, keys) {
  const K = PANEL_KIT, T = HK.T, s = 44, G = K.room().G;
  K.head(g, x, y + 12, w, 'KEYRING', { rule: false });
  HK.text(g, 'Always with you. Takes no pouch.', x + HK.tw(g, 'KEYRING', K.FN(11.5)) + 10, y + 12, { font: K.FB(11.5), color: T.inkMute, box: { x, y, w, h: 16 }, fitId: 'pack:keynote' });
  const ty = y + 18, n = Math.max(1, Math.min(keys.length, Math.floor((w + G) / (s + G))));
  HK.beltStrap(g, x - 4, ty + s / 2 - 9, n * (s + G) - G + 8, 18);
  keys.slice(0, n).forEach((kk, i) => {
    const kx = x + i * (s + G), label = 'keyring:' + kk.id, st = HK.stateOf(label), dy = st.pressed ? 1.5 : 0;
    HK.vellumPlate(g, kx, ty + dy, s, s, { edge: 'rgba(247,220,143,0.9)' });
    try { drawItemIcon(g, kk.id, kx + s / 2, ty + s / 2 + dy, 22); } catch (e) { }
    buttons.push({ x: kx, y: ty, w: s, h: s, label, action: () => notify(`${kk.name}. ${kk.note}`), up: true, name: kk.name });
  });
}

// ---------- skills (the crest, Tab, the SKILLS tile) ----------
function skillLocked(s) {
  const sk = player.skills[s.key]; if (!s.needs || !sk) return false;
  return sk.xp === 0 && !hasTool(s.needs === 'a bow' ? 'bow' : s.needs === 'an axe' ? 'axe' : s.needs === 'a pickaxe' ? 'pickaxe' : s.needs === 'a rod' ? 'rod' : 'hoe') && !(s.key === 'range' && (player.equip.weapon === 'shortbow' || countItem('shortbow')));
}
function drawSkillsPanel(g) {
  const K = PANEL_KIT, Rm = K.room(), T = HK.T, { R } = Rm;
  const list = SKILL_DEFS.filter(s => player.skills[s.key]), n = list.length;
  const two = Rm.aw - 36 >= 560, cols = two ? 2 : 1, pitch = 50, colGap = 28;
  const rowsAll = Math.ceil(n / cols), pagerH = R + 14;
  let perCol = rowsAll, h = 62 + rowsAll * pitch + 8;
  if (h > Rm.ah) { perCol = Math.max(2, Math.floor((Rm.ah - 62 - 8 - pagerH) / pitch)); h = 62 + perCol * pitch + 8 + pagerH; }
  const per = perCol * cols, pages = Math.max(1, Math.ceil(n / per));
  const { px, py, w } = panelBox(g, two ? Math.min(Rm.aw, 740) : Math.min(Rm.aw, 440), h, 'Skills', `Combat level ${combatLevel()}. Every skill trains by doing it.`);
  const x0 = px + 18, cw = w - 36, colW = (cw - (cols - 1) * colGap) / cols;
  const p = clamp(K.page('skills'), 0, pages - 1);
  list.slice(p * per, p * per + per).forEach((s, i) => {
    const col = Math.floor(i / perCol), row = i % perCol, x = x0 + col * (colW + colGap), y = py + 62 + row * pitch;
    const sk = player.skills[s.key], lv = levelForXp(sk.xp), locked = skillLocked(s);
    const lvW = HK.tw(g, 'Lv 99', K.FN(13)) + 4;
    K.name(g, s.name, x, y + 16, colW - lvW - 8, { size: 13, color: locked ? T.inkMute : T.ink });
    if (!locked) K.name(g, `Lv ${lv}`, x + colW, y + 16, lvW, { size: 13, color: T.gold, align: 'right' });
    if (locked) K.para(g, `Needs ${s.needs}. Get one to start.`, x, y + 36, colW, { size: 12, lines: 1, min: 10, color: T.inkMute, fitId: 'skills:needs' });
    else {
      const top = lv >= 99, cur = sk.xp - xpForLevel(lv), need = xpForLevel(lv + 1) - xpForLevel(lv);
      const xpT = top ? `${HK.fmtInt(sk.xp)} xp` : `${HK.fmtInt(cur)} / ${HK.fmtInt(need)} xp`;
      const xw = HK.tw(g, xpT, K.FN(11)) + 2;
      HK.meterBar(g, x, y + 25, Math.max(40, colW - xw - 10), 10, top ? 1 : clamp(cur / Math.max(1, need), 0, 1), '#c9a13c', { hi: '#f7dc8f', lo: '#6b4c14' });
      K.name(g, xpT, x + colW, y + 34, xw, { size: 11, color: T.inkDim, align: 'right' });
    }
    if (row < perCol - 1 && i < n - 1) K.hair(g, x, y + pitch - 6, colW, 0.25);
  });
  if (pages > 1) pager(g, x0, py + h - 14 - R, cw, p, pages, q => K.page('skills', clamp(q, 0, pages - 1)));
}

// ---------- how to play (the HELP tile, ? or F1) ----------
function helpRows() {
  const t = touchMode();
  if (t) return [
    { em: 'swing', name: 'SWING', text: 'Hit, shoot or stomp. You can also tap a monster, or tap the world twice.' },
    { em: 'hand', name: 'USE', text: 'Its word changes to what you face: TALK, CHOP, MINE, FISH, COOK, OPEN or ENTER.' },
    { em: 'block', name: 'BLOCK', text: 'Hold up your shield just before a hit lands.' },
    { em: 'exit', name: 'The fourth button', text: 'EXIT a machine, RIDE or GET DOWN from your horse, LEAVE a dungeon, BUILD on your island.' },
    { em: 'hand', name: 'Tap the world', text: 'Walk there. Tap a tree, rock, water or person to use it.' },
    { em: 'chevron', name: 'Left side', text: 'Drag your thumb to walk.' },
    { em: 'bag', name: 'Belt pouches', text: 'The five things on your belt. Tap one to eat it or use it.' },
    { em: 'bag', name: 'BAG', text: 'Your pack and what you wear. Tap two things to swap them. Place, Eat and Drop live here.' },
    { em: 'map', name: 'The round map', text: 'Tap it to see the whole world.' },
    { em: 'home', name: 'HOME', text: 'Back to your lodestone. Then it rests for 5 minutes.' },
    { em: 'friends', name: 'FRIENDS', text: 'Who is online. Chat with them and give them things.' },
    { em: 'menu', name: 'MENU', text: 'The book: Crafting, Quests, Skills, Wiki, Map, Chat, Music, Markers and Settings.' },
    { em: 'help', name: 'Hold a button', text: 'Its name shows. Slide off it to change your mind.' },
    { em: 'cog', name: 'Machines', text: 'USE a wreck to mend it. USE it again to climb in.' },
    { em: 'quests', name: 'Notice boards', text: 'In the square and by the cave road: paid jobs.' },
    { em: 'skull', name: 'If you fall', text: 'Death keeps your pack in his stone house.' },
  ];
  let km = []; try { km = window.SETTINGS && SETTINGS.keyMap ? SETTINGS.keyMap() : []; } catch (e) { km = []; }
  const K = (action, dflt) => { const r = km.find(q => q.action === action); return r && r.label ? r.label.split(' or ').slice(0, 2) : dflt; };
  return [
    { keys: ['W', 'A', 'S', 'D'], name: 'Walk', text: 'Or the arrow keys. Or click the ground to walk there.' },
    { keys: ['Click'], name: 'Click the world', text: 'Click a tree, rock, water or person to use it, or a monster to fight it.' },
    { keys: K('Swing', ['Space']), name: 'Swing', text: 'Hit, shoot or stomp.' },
    { keys: K('Use / talk', ['E']), name: 'Use', text: 'Talk, chop, mine, fish, cook, open or enter what you face.' },
    { keys: K('Block', ['R']), name: 'Block', text: 'Hold up your shield just before a hit lands.' },
    { keys: K('Place', ['Q']), name: 'Place', text: 'Put down a plank, door, bed, lodestone or trap.' },
    { keys: ['1–5'], name: 'Belt', text: 'Eat or use the five things on your belt.' },
    { keys: [K('Bag', ['I'])[0], K('Craft', ['C'])[0], K('Skills', ['Tab'])[0]], name: 'Pack, craft, skills', text: 'Your pack, crafting, and your skills.' },
    { keys: [K('Quests', ['J'])[0], K('Map', ['M'])[0], K('Wiki', ['K'])[0]], name: 'Quests, map, wiki', text: 'Your quests, the world map and the book of everything.' },
    { keys: K('Home', ['H']), name: 'Home', text: 'Back to your lodestone. Then it rests for 5 minutes.' },
    { keys: K('Climb out', ['X']), name: 'Climb out', text: 'Leave a walker, bulldozer or Barrelbeast.' },
    { keys: K('Next line of talk', ['Enter']), name: 'Next line', text: 'Read on when someone talks (or click the page).' },
    { keys: ['Esc'], name: 'The book', text: 'Settings, the title screen, a new game, and the whole kit.' },
    { em: 'cog', name: 'Machines', text: 'Use a wreck to mend it. Use it again to climb in.' },
    { em: 'quests', name: 'Notice boards', text: 'In the square and by the cave road: paid jobs.' },
    { em: 'skull', name: 'If you fall', text: 'Death keeps your pack in his stone house.' },
  ];
}
function drawHelpPanel(g) {
  const K = PANEL_KIT, Rm = K.room(), T = HK.T, { R, t } = Rm;
  const rows = helpRows();
  const two = Rm.aw - 36 >= 720, cols = two ? 2 : 1, colGap = 28;
  const W = two ? Math.min(Rm.aw, 900) : Math.min(Rm.aw, 520), cw = W - 36, colW = (cw - (cols - 1) * colGap) / cols;
  const lead = t ? 40 : 118, lh = K.lineH(13);
  // measure each row: its name, then the sentence wrapped under it
  const hts = rows.map(r => 18 + HK.wrap(g, r.text, colW - lead, 4, K.FB(13)).lines.length * lh + 8);
  const pagerH = R + 14, avail = Rm.ah - 62 - 10;
  // pack rows into pages of `cols` columns; when everything fits on one page, split the columns evenly
  const build = lim => { const pg = []; let cur = [[]], ch = [0]; for (let i = 0; i < rows.length; i++) { let c = cur.length - 1; if (ch[c] + hts[i] > lim) { if (cur.length < cols) { cur.push([]); ch.push(0); c++; } else { pg.push(cur); cur = [[]]; ch = [0]; c = 0; } } cur[c].push(i); ch[c] += hts[i]; } pg.push(cur); return pg; };
  let pgs = build(avail), paged = pgs.length > 1;
  if (paged) pgs = build(avail - pagerH);
  else if (cols === 2) {
    const total = hts.reduce((a, b) => a + b, 0); let acc = 0, cut = 0;
    for (let i = 0; i < rows.length; i++) { if (acc + hts[i] / 2 > total / 2) break; acc += hts[i]; cut = i + 1; }
    pgs = [[rows.slice(0, cut).map((_, i) => i), rows.slice(cut).map((_, i) => cut + i)]];
  }
  const colH = Math.max(...pgs.map(pg => Math.max(...pg.map(c => c.reduce((a, i) => a + hts[i], 0)))));
  const h = 62 + colH + 10 + (paged ? pagerH : 0);
  const { px, py } = panelBox(g, W, h, 'How to play', 'Every skill trains by doing. If you fall, Death keeps your pack.');
  const x0 = px + 18, p = clamp(K.page('help'), 0, pgs.length - 1);
  pgs[p].forEach((col, ci) => {
    let y = py + 62; const x = x0 + ci * (colW + colGap);
    for (const i of col) {
      const r = rows[i];
      if (r.keys) { let kx = x; for (const kk of r.keys.filter(Boolean)) { if (kx + HK.keycapW(g, kk, 11) > x + lead - 6) break; kx += HK.keycap(g, kx, y + 2, kk, 11) + 4; } }
      else K.roundel(g, x + 15, y + 14, 14, r.em);
      K.name(g, r.name, x + lead, y + 14, colW - lead, { size: 12.5, color: T.goldHi });
      K.para(g, r.text, x + lead, y + 18 + lh - 3, colW - lead, { size: 13, lines: 4, color: T.inkDim, fitId: 'help:text' });
      y += hts[i];
    }
  });
  if (pgs.length > 1) pager(g, x0, py + h - 14 - R, W - 36, p, pgs.length, q => K.page('help', clamp(q, 0, pgs.length - 1)));
}

// ---------- quests (J, the QUESTS tile): tabs Quests / Said ----------
function drawQuestsPanel(g, narrow) {
  const K = PANEL_KIT, Rm = K.room(), T = HK.T, { R, G } = Rm;
  const said = questsTab === 'said';
  const W = Math.min(Rm.aw, 560), cw = W - 36, lh = K.lineH(13), pagerH = R + 14;
  const top = 62 + R + 12;
  let items = [];
  if (said) {
    const log = dialogLog.slice().reverse();
    items = log.map(l => ({ kind: 'said', l, h: 18 + HK.wrap(g, l.text, cw, 4, K.FB(13)).lines.length * lh + 10 }));
    if (!items.length) items = [{ kind: 'none', h: 30 }];
  } else {
    const list = activeQuests();
    items = list.map(id => { const lines = HK.wrap(g, questText(id) || '', cw - 24, 5, K.FB(13)).lines.length; return { kind: 'quest', id, h: 8 + R + 6 + lines * lh + 12 + 8 }; });
    if (!items.length) items.push({ kind: 'none', h: 30 });
    const done = []; if (quest.bread === 'done') done.push('bread'); if (quest.wren === 'done') done.push('wren');
    if (done.length) { items.push({ kind: 'doneHead', h: 24 }); for (const id of done) items.push({ kind: 'done', id, h: 24 }); }
  }
  const total = items.reduce((a, it) => a + it.h, 0);
  let lim = Rm.ah - top - 10, paged = total > lim;
  if (paged) lim -= pagerH;
  const pgs = [[]]; let acc = 0;
  for (const it of items) { if (acc + it.h > lim && pgs[pgs.length - 1].length) { pgs.push([]); acc = 0; } pgs[pgs.length - 1].push(it); acc += it.h; }
  const bodyH = Math.max(...pgs.map(pg => pg.reduce((a, it) => a + it.h, 0)));
  const h = top + bodyH + 10 + (pgs.length > 1 ? pagerH : 0);
  const { px, py } = panelBox(g, W, h, said ? 'Said' : 'Quests', said ? 'What people said to you, newest first.' : 'The quest you follow stays on screen and marks the map.');
  const x0 = px + 18;
  K.tabs(g, x0, py + 62, Math.min(cw, 2 * 120 + G), [{ label: 'Quests' }, { label: 'Said' }], said ? 'Said' : 'Quests', l => { questsTab = l === 'Said' ? 'said' : 'quests'; K.page('quests', 0); });
  const pkey = 'quests';
  const p = clamp(K.page(pkey), 0, pgs.length - 1);
  let y = py + top;
  for (const it of pgs[p]) {
    if (it.kind === 'none') K.para(g, said ? 'Nobody has said anything yet.' : 'No quests right now. Talk to people to find some.', x0, y + 16, cw, { size: 13, lines: 2, color: T.inkDim });
    if (it.kind === 'said') {
      K.name(g, String(it.l.who || '').toUpperCase(), x0, y + 13, cw, { size: 11.5, color: T.gold });
      K.para(g, it.l.text, x0, y + 18 + lh - 3, cw, { size: 13, lines: 4, color: T.ink, fitId: 'said:text' });
      K.hair(g, x0, y + it.h - 4, cw, 0.2);
    }
    if (it.kind === 'quest') {
      const id = it.id, tracked = quest.tracked === id, ch = it.h - 8;
      HK.vellumPlate(g, x0, y, cw, ch, tracked ? { edge: 'rgba(247,220,143,0.95)' } : {});
      const tw = K.verbW(g, 'Untrack', 'pin', R);
      K.verb(g, x0 + cw - 10 - tw, y + 8, tw, R, tracked ? 'Untrack' : 'Track', () => { if (tracked) { quest.tracked = null; if (id === 'main') quest.untrackedByPlayer = true; } else { quest.tracked = id; if (id === 'main') quest.untrackedByPlayer = false; } save(); }, { emblem: 'pin', tone: tracked ? null : 'primary' });
      const nw = cw - 24 - tw - 12;
      K.name(g, QUEST_DEFS[id].name, x0 + 12, y + 8 + R / 2 - 1, nw, { size: 13, color: tracked ? T.goldHi : T.ink });
      HK.text(g, id === 'main' ? 'Main story' : 'Side quest', x0 + 12, y + 8 + R / 2 + 14, { font: K.FB(11), color: T.inkMute, box: { x: x0 + 12, y: y + 8, w: nw, h: R }, fitId: 'quest:kind' });
      K.para(g, questText(id) || '', x0 + 12, y + 8 + R + 6 + lh - 4, cw - 24, { size: 13, lines: 5, color: T.inkDim, fitId: 'quest:text' });
    }
    if (it.kind === 'doneHead') K.head(g, x0, y + 16, cw, 'DONE');
    if (it.kind === 'done') {
      HK.emblem(g, 'tick', x0 + 9, y + 11, 16, T.good, { hole: null });
      K.name(g, QUEST_DEFS[it.id].name, x0 + 24, y + 16, cw - 24, { size: 12.5, color: T.inkMute });
    }
    y += it.h;
  }
  if (pgs.length > 1) pager(g, x0, py + h - 14 - R, cw, p, pgs.length, q => K.page(pkey, clamp(q, 0, pgs.length - 1)));
}

// ---------- the world map (the ring, M, the MAP tile, the map stud) ----------
// The image rect is also the buttons[] entry 'mapimage' (tap the map to close it): 61-markers cuts it back for its key
// strip and 73-players draws friends inside the same rect (px + 18, py + 62, w - 36 wide).
function drawMapPanel(g, narrow) {
  const K = PANEL_KIT, Rm = K.room(), T = HK.T;
  const mw = Math.min(Rm.aw, 760), mh = Math.min(Rm.ah, (mw - 36) * MAP_H / MAP_W + 80);
  const { px, py, w, h } = panelBox(g, mw, mh, 'The Fanglands', touchMode() ? 'White arrow: you. Blue: home. Gold rings: quests. Tap the map to close.' : 'White arrow: you. Blue: home. Gold rings: quests. Click the map to close.');
  if (miniDirty || miniDiffCount !== mapDiffs.size) refreshMini();
  const iw = w - 36, ih = Math.min(h - 80, iw * MAP_H / MAP_W), ix = px + 18, iy = py + 62; const sc = iw / MAP_W;
  g.save(); g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
  g.imageSmoothingEnabled = false; g.drawImage(miniCanvas, 0, 0, MAP_W, MAP_H, ix, iy, iw, MAP_H * sc); g.imageSmoothingEnabled = true;
  const fs = Math.max(9, Math.min(15, sc * 2.4));
  for (const r of REGIONS) {
    if (r.name === 'Goblin Fields' || r.name === 'The Wilds') continue;
    const cx = ix + (r.x0 + r.x1 + 1) / 2 * sc, cy = iy + (r.y0 + r.y1 + 1) / 2 * sc;
    HK.text(g, r.name.toUpperCase(), cx, cy, { font: HK.FC(800, fs), align: 'center', color: T.ink, halo: 3 });
  }
  if (player.home) HK.emblem(g, 'home', ix + player.home.x / TILE * sc, iy + player.home.y / TILE * sc, 13, T.home, { hole: null, relief: 'rgba(0,0,0,0.9)' });
  for (const tg of mapTargets()) {
    const tx = ix + (tg.x + 0.5) * sc, ty = iy + (tg.y + 0.5) * sc, isTracked = tg.id === quest.tracked;
    g.strokeStyle = isTracked ? T.goldHi : 'rgba(217,178,92,0.8)'; g.lineWidth = isTracked ? 2.5 : 1.5;
    g.beginPath(); g.arc(tx, ty, (isTracked ? 6 : 5) + Math.sin(time * 4) * 2, 0, 7); g.stroke();
    if (tg.label) HK.text(g, tg.label, tx, ty - 10, { font: HK.FS(700, narrow ? 10 : 11.5), align: 'center', color: T.goldHi, halo: 3 });
  }
  // you: a white arrowhead pointing the way you face
  {
    const ax = ix + player.x / TILE * sc, ay = iy + player.y / TILE * sc, ang = Math.atan2(player.facing.y || 0, player.facing.x || 1);
    g.save(); g.translate(ax, ay); g.rotate(ang);
    g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, -6); g.lineTo(-2, 0); g.lineTo(-5, 6); g.closePath();
    g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 1.5; g.stroke(); g.restore();
  }
  g.restore();
  // the gold hairline around the glass
  g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 1; g.strokeRect(ix - 1.5, iy - 1.5, iw + 3, ih + 3);
  g.strokeStyle = 'rgba(217,178,92,0.75)'; g.strokeRect(ix - 0.5, iy - 0.5, iw + 1, ih + 1);
  buttons.push({ x: ix, y: iy, w: iw, h: ih, label: 'mapimage', action: closePanel }); // tap the map to close it
}

// ---------- crafting (C, the CRAFTING tile) and the stations (Forge, Anvil, Workbench, Tinker's table, Alchemy) ----------
// A recipe row: an iron plate with the item's picture, the recipe in words, and the level it needs on the right.
function recipeRow(g, x, y, w, h, rec, label, can, action) {
  const K = PANEL_KIT, T = HK.T;
  const st = K.plate(g, x, y, w, h, label, action, { enabled: can, tone: can ? 'primary' : null });
  const dy = st.dy, ic = Math.min(h - 8, 30);
  try { drawItemIcon(g, rec.out || (rec.needs[0] && rec.needs[0][0]), x + 6 + ic / 2, y + h / 2 + dy, ic * 0.8); } catch (e) { }
  const lvT = rec.lv > 1 ? `Lv ${rec.lv}` : '';
  const lvOk = !rec.skill || skillLv(rec.skill) >= rec.lv;
  const lw = lvT ? HK.tw(g, lvT, K.FN(12)) + 12 : 0;
  if (lvT) K.name(g, lvT, x + w - 10, y + h / 2 + 5 + dy, lw, { size: 12, align: 'right', color: lvOk ? T.inkDim : T.warn });
  const tx = x + 12 + ic, room = w - (tx - x) - 10 - lw;
  let size = 13, f = HK.FS(700, size);
  while (size > 10.5 && HK.tw(g, rec.label, f) > room) { size -= 0.5; f = HK.FS(700, size); }
  const col = can ? (st.hover ? T.goldHi : T.ink) : T.inkMute;
  if (HK.tw(g, rec.label, f) <= room || h < 40) {
    let s = rec.label; if (HK.tw(g, s, f) > room) s = HK.wrap(g, s, room, 1, f).lines[0] || s;
    HK.text(g, s, tx, y + h / 2 + 5 + dy, { font: f, color: col, box: { x: tx, y, w: room, h }, fitId: 'recipe' });
  } else {
    f = HK.FS(700, 11.5); const ln = HK.wrap(g, rec.label, room, 2, f).lines, lh = K.lineH(11.5);
    ln.forEach((s, i) => HK.text(g, s, tx, y + h / 2 + 4 - (ln.length - 1) * lh / 2 + i * lh + dy, { font: f, color: col, box: { x: tx, y, w: room, h }, fitId: 'recipe' }));
  }
}
function drawCraftPanel(g) {
  const K = PANEL_KIT, Rm = K.room(), T = HK.T, { R, G, t } = Rm;
  const station = panel === 'craft' ? null : panelArg;
  const all = station === 'forge' ? SMELT : RECIPES.filter(r => r.station === station);
  const titles = { forge: 'Forge: smelting', anvil: 'Anvil: smithing', workbench: 'Workbench', workshop: "Tinker's table: traps and arrows", alchemy: 'Alchemy table: bombs' };
  const skillKey = station === 'forge' || station === 'anvil' ? 'smithing' : 'crafting';
  // tabs by tier when the list is long; 8 rows a page (fewer on a short screen) with Prev / Next
  const tabbed = all.length > 8;
  const tiers = tabbed ? ['Bronze/Iron', 'Steel', 'Mithril', 'Godly', 'Other'].filter(tn => all.some(r => recipeTier(r) === tn)) : [];
  if (tabbed && !tiers.includes(recipeTab)) recipeTab = tiers[0];
  const list = tabbed ? all.filter(r => recipeTier(r) === recipeTab) : all;
  const W = Math.min(Rm.aw, t ? 480 : 440), cw = W - 36;
  // the tab rows' height, measured the way K.tabs lays them out
  let tabsH = 0;
  if (tabbed) { const nat = tiers.map(tn => Math.max(t ? 56 : 60, K.verbW(g, tn, null, R))); tabsH = (nat.reduce((a, b) => a + b, 0) + G * (tiers.length - 1) <= cw ? R : 2 * R + G) + 10; }
  const pitch = R + 8, y0 = 62 + tabsH, n = list.length, pagerH = R + 14;
  const noHammer = station === 'anvil' && !hasTool('hammer'), warnH = noHammer ? 20 : 0;
  const needPager = n > 8 || y0 + n * pitch + 16 + warnH > Rm.ah;
  let perPage, h;
  if (needPager) { perPage = Math.max(2, Math.min(8, Math.floor((Rm.ah - y0 - pagerH - warnH) / pitch))); h = y0 + perPage * pitch + pagerH + warnH; }
  else { perPage = Math.max(1, n); h = Math.max(160, y0 + n * pitch + 16 + warnH); }
  const { px, py, w, h: ph } = panelBox(g, W, h, station ? titles[station] || 'Station' : 'Crafting', station ? `${SKILL_DEFS.find(s => s.key === skillKey).name} level ${skillLv(skillKey)}${station === 'anvil' ? '. Needs a hammer.' : ''}` : 'Simple things craft from your pack. Stations in Thistledown make the rest.');
  const x0 = px + 18;
  if (tabbed) K.tabs(g, x0, py + 62, w - 36, tiers.map(tn => ({ label: tn })), recipeTab, tn => { recipeTab = tn; recipePage = 0; });
  const pages = Math.max(1, Math.ceil(n / perPage)); recipePage = clamp(recipePage, 0, pages - 1);
  const canMake = r => { const rec = station === 'forge' ? { ...r, station: 'forge', skill: 'smithing', qty: 1 } : r; const has = rec.needs.every(([id, q]) => countItem(id) >= q); const lvOk = !rec.skill || skillLv(rec.skill) >= rec.lv; return { rec, can: has && lvOk && !(station === 'anvil' && !hasTool('hammer')) }; };
  const labelOf = rec => rec.label + (rec.lv > 1 ? `  (lv ${rec.lv})` : '');
  const pageList = list.slice(recipePage * perPage, recipePage * perPage + perPage);
  pageList.forEach((r, i) => {
    const y = py + y0 + i * pitch; const { rec, can } = canMake(r);
    recipeRow(g, x0, y, w - 36, R, rec, labelOf(rec), can, () => craft(rec));
  });
  // recipes on other tabs/pages stay addressable by label for the harness (F.clickButton) but sit off-screen, so no tap can reach them
  for (const r of all) { if (pageList.includes(r)) continue; const { rec, can } = canMake(r); if (can) buttons.push({ x: -1e9, y: -1e9, w: 0, h: 0, label: labelOf(rec), action: () => craft(rec), offscreen: true }); }
  if (noHammer) HK.text(g, 'You need a hammer in your pack.', x0, py + ph - (pages > 1 ? pagerH : 14) - 6, { font: K.FB(13), color: T.bad, box: { x: x0, y: py + ph - 60, w: w - 36, h: 60 }, fitId: 'craft:hammer' });
  if (pages > 1) pager(g, x0, py + ph - 14 - R, w - 36, recipePage, pages, p => { recipePage = clamp(p, 0, pages - 1); });
}

// ---------- the shop (every opener) ----------
// Measurements other shops copy (26-boats' Pete): rows are vellum plates HK.row() + 8 tall (52 on touch, 40 with a
// mouse) on a pitch of row + 14; a 36 / 28 px pouch at the left; the name in Cinzel 13; the blurb in the sans at 12
// (hidden under 520 px of content); 'Buy n' a primary plate HK.row() tall, the coin emblem, 4 px inside the row's
// right edge; sell pouches 44 on touch, 40 with a mouse, 8 / 6 apart.
function drawShopPanel(g, narrow) {
  const K = PANEL_KIT, Rm = K.room(), T = HK.T, { R, G, t } = Rm;
  const shop = SHOPS[panelArg] || { name: "Fennick's Stall", stock: [], buys: ['wolf_pelt', 'boar_tusk', 'wool', 'spider_silk', 'goblin_scrap', 'coal'], rate: 1 };
  const rate = shop.rate || 0.6, s = t ? 44 : 40;
  const cols2 = Rm.aw - 36 >= 640;
  const gridCols = cols2 ? 5 : (Rm.aw - 36 >= 10 * s + 9 * G ? 10 : 5);
  const gridW = gridCols * s + (gridCols - 1) * G, gridH = Math.ceil(INV_SLOTS / gridCols) * (s + G) - G;
  const W = cols2 ? Math.min(Rm.aw, 820) : Math.min(Rm.aw, Math.max(gridW + 36, 480)), cw = W - 36;
  const listW = cols2 ? cw - gridW - 28 : cw, rowH = R + 8, pitch = rowH + 6, pagerH = R + 14;
  const armSell = confirmActive('sell');
  const sellHead = armSell ? `TAP AGAIN TO SELL ${((ITEMS[uxConfirm.item] || {}).name || 'it').toUpperCase()}` : shop.buys ? `SELLS FOR FULL PRICE: ${shop.buys.map(i => ITEMS[i].name).join(', ').toUpperCase()}` : `SELL FROM YOUR PACK: ${Math.round(rate * 100)}% OF WHAT IT IS WORTH`;
  const sellW = cols2 ? gridW : cw;
  const headLines = HK.wrap(g, sellHead, sellW, 3, K.FN(11)).lines.length, headH = headLines * 15 + 6;
  const sellH = headH + gridH;
  const n = shop.stock.length;
  let perPage, h;
  if (cols2) {
    const fullH = 62 + Math.max(n * pitch, sellH) + 12;
    if (fullH <= Rm.ah) { perPage = Math.max(1, n); h = fullH; }
    else { perPage = Math.max(1, Math.floor((Rm.ah - 62 - 12 - pagerH) / pitch)); h = 62 + Math.max(perPage * pitch + pagerH, sellH) + 12; }
  } else {
    const fullH = 62 + n * pitch + 12 + sellH + 12;
    if (fullH <= Rm.ah) { perPage = Math.max(1, n); h = fullH; }
    else { perPage = Math.max(1, Math.floor((Rm.ah - 62 - 12 - sellH - 12 - pagerH) / pitch)); h = 62 + perPage * pitch + pagerH + 12 + sellH + 12; }
  }
  const pages = Math.max(1, Math.ceil(n / perPage));
  const { px, py, w, h: ph } = panelBox(g, W, h, shop.name, `You have ${coins()} coins. Tap your pack to sell.`);
  const x0 = px + 18, p = clamp(K.page('shop'), 0, pages - 1);
  const blurbOn = listW >= 440;
  const bw = Math.max(...shop.stock.map(([, price]) => K.verbW(g, `Buy ${price}`, 'coin', R)), K.verbW(g, 'Buy 99', 'coin', R));
  shop.stock.forEach(([id, price], i) => {
    const label = `Buy ${price}`, def = ITEMS[id], can = coins() >= price;
    const buy = () => { if (!payCoins(price)) { notify('Not enough coins.'); return; } if (addItem(id, 1) > 0) { addItem('coins', price); notify('Your pack is full.'); return; } floatText(player.x, player.y - 30, `Bought ${def.name}`, def.color); save(); };
    const k = i - p * perPage;
    if (k < 0 || k >= perPage) { if (can) buttons.push({ x: -1e9, y: -1e9, w: 0, h: 0, label, action: buy, offscreen: true }); return; }
    const y = py + 62 + k * pitch;
    HK.vellumPlate(g, x0, y, listW, rowH);
    const ps = t ? 36 : 28;
    HK.pouch(g, { x: x0 + 8, y: y + (rowH - ps) / 2 - 1, w: ps, h: ps + 2 }, { id, qty: 1 }, '', {});
    const tx = x0 + 16 + ps, room = listW - (tx - x0) - bw - 16;
    if (blurbOn) {
      K.name(g, def.name, tx, y + rowH / 2 - 2, Math.min(room, 170), { size: 13 });
      K.para(g, itemBlurb(def), tx, y + rowH / 2 + 14, room, { size: 12, lines: 1, min: 10, color: T.inkDim, fitId: 'shop:blurb' });
    } else K.name(g, def.name, tx, y + rowH / 2 + 5, room, { size: 13 });
    K.verb(g, x0 + listW - 4 - bw, y + 4, bw, R, label, buy, { emblem: 'coin', tone: can ? 'primary' : null, enabled: can, name: `${def.name}: ${price} coins` });
  });
  if (pages > 1) pager(g, x0, py + 62 + perPage * pitch + 4, listW, p, pages, q => K.page('shop', clamp(q, 0, pages - 1)));
  // selling: tap a pouch (a precious thing asks twice)
  const sx = cols2 ? x0 + listW + 28 : x0, sy = cols2 ? py + 62 : py + ph - 12 - sellH;
  HK.wrap(g, sellHead, sellW, 3, K.FN(11)).lines.forEach((ln, i) => HK.text(g, ln, sx, sy + 12 + i * 15, { font: K.FN(11), color: armSell ? T.goldHi : T.gold, shadow: 'rgba(0,0,0,0.8)', box: { x: sx, y: sy, w: sellW, h: headH }, fitId: 'shop:sell' }));
  drawInvGrid(g, sx, sy + headH, gridCols, s, G, i => {
    const sl = player.inv[i]; if (!sl || sl.id === 'coins') return; if (shop.buys && !shop.buys.includes(sl.id)) { notify('Fennick only wants pelts, tusks, wool, silk, scrap and coal.'); return; }
    const sell = () => { const q = player.inv[i]; if (!q) return; const price = Math.max(1, Math.floor(ITEMS[q.id].value * rate)); q.qty -= 1; if (q.qty <= 0) player.inv[i] = null; addItem('coins', price); floatText(player.x, player.y - 30, `+${price} coins`, '#ffd166'); save(); };
    if (needsConfirm(ITEMS[sl.id])) { if (confirmActive('sell') && uxConfirm.item === sl.id) { uxConfirm = null; sell(); } else { uxConfirm = { label: 'sell', until: nowMs() + 3000, item: sl.id }; sfx('open'); } } else sell();
  });
}

// ---------- Death's Chest ----------
function drawCoffinPanel(g) {
  const K = PANEL_KIT, Rm = K.room(), T = HK.T, { R } = Rm;
  const W = Math.min(Rm.aw, 480), cw = W - 36, lhI = 26;
  const fee = deathKeep ? coffinFee() : 0, held = deathKeep && deathKeep.items.find(s => s.id === 'coins'), fromHeld = held ? Math.min(held.qty, fee) : 0, rest = fee - fromHeld;
  const words = !deathKeep ? 'The chest is empty. For now. When you fall, what you carry comes here. Cheap things I return for nothing. Precious things cost a quarter of their worth, and I take it from your own coin first.'
    : fee ? `Your pack is in the chest. The fee is ${fee} coins${fromHeld ? `, ${fromHeld} of it from the purse you dropped` : ''}${rest ? `, ${rest} from your hand` : ''}.` : 'Your pack is in the chest. Nothing in it is worth my time. Take it, and try not to fall again.';
  const wh = HK.wrap(g, words, cw, 8, K.FB(14)).lines.length * K.lineH(14);
  const items = deathKeep ? deathKeep.items : [];
  const maxRows = Math.max(3, Math.floor((Rm.ah - 62 - 20 - wh - 16 - R - 24) / lhI));
  const shown = items.slice(0, Math.min(7, items.length > maxRows ? maxRows - 1 : maxRows)), more = items.length - shown.length;
  const h = 62 + 20 + wh + 10 + (deathKeep ? shown.length * lhI + (more > 0 ? lhI : 0) + 12 + R : 0) + 16;
  const { px, py, w, h: ph } = panelBox(g, W, h, "Death's Chest", 'Piles of his gold. A chest of what you lost.');
  const x0 = px + 18;
  K.head(g, x0, py + 62 + 12, cw, 'DEATH SAYS');
  K.para(g, words, x0, py + 62 + 20 + K.lineH(14) - 4, cw, { size: 14, lines: 8, color: T.ink, fitId: 'coffin:words' });
  if (!deathKeep) return;
  let y = py + 62 + 20 + wh + 10;
  for (const sl of shown) {
    try { drawItemIcon(g, sl.id, x0 + 10, y + lhI / 2, 16); } catch (e) { }
    // the fee Death really charges for this pile (50-economy spreads the total over the chest; it adds up to the fee above)
    const f1 = typeof itemFee === 'function' ? itemFee(sl.id, sl.qty) : 0, paid = f1 > 0;
    const feeT = paid ? `${f1} coins` : 'free', fw = HK.tw(g, feeT, K.FN(12)) + 6;
    HK.text(g, `${ITEMS[sl.id].name} × ${sl.qty}`, x0 + 26, y + lhI / 2 + 5, { font: K.FB(13), color: T.ink, box: { x: x0 + 26, y, w: cw - 26 - fw - 8, h: lhI }, fitId: 'coffin:item' });
    K.name(g, feeT, x0 + cw, y + lhI / 2 + 5, fw, { size: 12, align: 'right', color: paid ? T.gold : T.inkMute });
    K.hair(g, x0, y + lhI - 1, cw, 0.18);
    y += lhI;
  }
  if (more > 0) { HK.text(g, `and ${more} more`, x0 + 26, y + lhI / 2 + 5, { font: K.FB(12), color: T.inkDim, box: { x: x0, y, w: cw, h: lhI }, fitId: 'coffin:more' }); }
  const ok = coins() >= rest;
  K.verb(g, x0, py + ph - 16 - R, cw, R, fee ? `Reclaim everything for ${fee} coins` : 'Reclaim everything', reclaimFromDeath, { emblem: 'coin', tone: 'primary', enabled: ok, name: ok ? 'Take your things back' : `You need ${rest} coins` });
}

function drawPanels(g, narrow, short, qh, hb) {
  if (panel && HOOKS.panel[panel]) { HOOKS.panel[panel](g, narrow); return; }
  if (panel === 'skills') drawSkillsPanel(g, narrow);
  if (panel === 'help') drawHelpPanel(g, narrow);
  if (panel === 'quests') drawQuestsPanel(g, narrow);
  if (panel === 'map') drawMapPanel(g, narrow);
  if (panel === 'inventory') drawPackPanel(g, narrow);
  if (panel === 'bank') {
    // the core bank (60-bank registers HOOKS.panel.bank and replaces this one)
    const cols = narrow ? 5 : 10, size = touchMode() ? 44 : 40, gap = touchMode() ? 8 : 5, rows = 3, per = cols * rows, pages = Math.max(1, Math.ceil(BANK_SLOTS / per));
    const { px, py, w } = panelBox(g, cols * (size + gap) + 30, narrow ? 600 : 480, 'Bank of Thistledown', `${player.bank.length} of ${BANK_SLOTS} vault slots. Tap to move things.`);
    PANEL_KIT.head(g, px + 18, py + 74, w - 36, 'VAULT');
    bankPage = clamp(bankPage, 0, pages - 1);
    for (let k = 0; k < per; k++) {
      const i = bankPage * per + k; if (i >= BANK_SLOTS) break;
      const cx = px + 18 + (k % cols) * (size + gap), cy = py + 82 + Math.floor(k / cols) * (size + gap), b = player.bank[i];
      drawSlot(g, cx, cy, size, b, false);
      if (b) buttons.push({ x: cx, y: cy, w: size, h: size, label: 'bank' + i, action: () => { const left = addItem(b.id, b.qty); b.qty = left; if (!left) player.bank.splice(i, 1); if (left) notify('Your pack is full.'); save(); } });
    }
    const pgy = py + 82 + rows * (size + gap) + 4;
    pager(g, px + 18, pgy, w - 36, bankPage, pages, p => { bankPage = clamp(p, 0, pages - 1); });
    PANEL_KIT.head(g, px + 18, pgy + HK.row() + 22, w - 36, 'YOUR PACK');
    drawInvGrid(g, px + 18, pgy + HK.row() + 30, cols, size, gap, i => { const s = player.inv[i]; if (!s) return; if (bankAdd(s.id, s.qty)) { player.inv[i] = null; save(); } else notify('The vault is full.'); });
  }
  if (panel === 'shop') drawShopPanel(g, narrow);
  if (panel === 'craft' || panel === 'station') drawCraftPanel(g, narrow);
  if (panel === 'coffin') drawCoffinPanel(g, narrow);
}
// the core drawPanels, before 61-markers and 73-players wrap it (the self-test paints the core panels on their own)
const CORE_DRAW_PANELS = drawPanels;

function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '';
  for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; } else line = test; }
  if (line) g.fillText(line, x, y);
}

// ---------- the panel audit ----------
// The ten core panels (the pack, Skills, How to play, Quests, the map, Crafting, the stations, the shop, Death's Chest
// and the Wiki book) are drawn at every device size, touch and mouse, at Normal and Large text, and must hold the
// panel contract: from the '×' seal on, every control 44 px on touch (26 with a mouse), 8 px apart on touch (4 with a
// mouse), inside the panel and on the screen, and every string inside its plate. Then every other panel's FRAME (the
// other files are still restyling their insides) and a recording of what the core panels paint.
HOOKS.selfTest.push((check, F, h) => {
  const P = 'panels: ', A = HK.audit;
  const own = kk => Object.getOwnPropertyDescriptor(window, kk);
  const saved = {
    w: own('innerWidth'), h: own('innerHeight'), touch: window.__forceTouch, stick: window.__stickRight, text: window.SETTINGS ? SETTINGS.get('text') : 'normal',
    inv: player.inv.map(q => q ? { ...q } : null), equip: { ...player.equip }, mech: player.mech, home: player.home, homeCd: player.homeCd,
    keyring: Array.isArray(player.keyring) ? player.keyring.slice() : player.keyring, dozerUp: player.dozerUp, dk: deathKeep, panel, arg: panelArg, paused,
    dc: dialog.cur, dq: dialog.queue.slice(), notice, qt: questsTab, sel: selectedSlot, ux: uxConfirm, tracked: quest.tracked, nLog: dialogLog.length,
    wk: window.WIKI ? JSON.parse(JSON.stringify(WIKI.state)) : null,
  };
  const setSize = (w, hh) => { window.innerWidth = w; window.innerHeight = hh; if (VW !== w || VH !== hh) resize(); return VW === w && VH === hh; };
  const restore = () => {
    HK.setCacheOff(false); HK.FIT.on = false;
    window.__forceTouch = saved.touch; window.__stickRight = saved.stick; if (window.SETTINGS) SETTINGS.set('text', saved.text);
    player.inv = saved.inv; Object.assign(player.equip, saved.equip); player.mech = saved.mech; player.home = saved.home; player.homeCd = saved.homeCd;
    player.keyring = saved.keyring; if (window.KEYRING) KEYRING.absorb(); player.dozerUp = saved.dozerUp; deathKeep = saved.dk;
    dialog.cur = saved.dc; dialog.queue.length = 0; dialog.queue.push(...saved.dq); notice = saved.notice; quest.tracked = saved.tracked; dialogLog.length = Math.min(dialogLog.length, saved.nLog);
    if (saved.wk) Object.assign(WIKI.state, saved.wk);
    if (saved.w) { Object.defineProperty(window, 'innerWidth', saved.w); Object.defineProperty(window, 'innerHeight', saved.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } }
    resize(); closePanel(); paused = saved.paused; if (saved.panel) { openPanel(saved.panel, saved.arg); selectedSlot = saved.sel; } questsTab = saved.qt; uxConfirm = saved.ux; render();
  };
  const PACK = [['iron_sword', 1], ['bread', 5], ['wood', 12], ['iron_ore', 6], ['coins', 340], ['bronze_pickaxe', 1], ['bronze_axe', 1], ['iron_dagger', 1], ['hammer', 1], ['iron_bar', 4]];
  const fixture = () => {
    player.inv = new Array(INV_SLOTS).fill(null); PACK.forEach(([id, n], i) => { if (ITEMS[id]) player.inv[i] = { id, qty: n }; });
    player.mech = null; player.home = { x: player.x + 100, y: player.y }; player.homeCd = -1e9; player.keyring = []; if (window.KEYRING) KEYRING.absorb();
    dialog.cur = null; dialog.queue.length = 0; notice = null; uxConfirm = null; paused = false;
  };
  const SCENES = [
    ['pack', () => { openPanel('inventory'); selectedSlot = 1; }],
    ['pack in the bulldozer, keyring, Drop armed', () => { if (window.KEYRING) { KEYRING.add('wind_flute'); KEYRING.add('dragon_horn'); } player.dozerUp = { drill: true, irondrill: true, ram: true, boiler: true }; player.mech = { kind: 'dozer', hp: 74, maxHp: 110 }; openPanel('inventory'); selectedSlot = 7; uxConfirm = { label: 'drop', until: nowMs() + 60000 }; }],
    ['skills', () => openPanel('skills')],
    ['help', () => openPanel('help')],
    ['quests', () => { quest.tracked = activeQuests()[0] || null; openPanel('quests'); }],
    ['said', () => { dialogLog.push({ who: 'Tobin', text: 'Goblins came up the east road last night. If you mean to scout their camp, take bread. Lots of bread.' }, { who: 'The Voice', text: 'Thistledown. You will wake here now if you fall.' }); openPanel('quests'); questsTab = 'said'; }],
    ['map', () => openPanel('map')],
    ['crafting', () => openPanel('craft')],
    ['forge', () => openPanel('station', 'forge')],
    ['anvil', () => openPanel('station', 'anvil')],
    ['shop, a sale armed', () => { openPanel('shop', 'general'); uxConfirm = { label: 'sell', until: nowMs() + 60000, item: 'iron_dagger' }; }],
    ['coffin', () => { deathKeep = { items: [{ id: 'iron_sword', qty: 1 }, { id: 'bread', qty: 5 }, { id: 'coins', qty: 40 }, { id: 'iron_ore', qty: 6 }, { id: 'wood', qty: 12 }] }; openPanel('coffin'); }],
    ['wiki page', () => { if (window.WIKI) WIKI.open('monsters', 'goblin'); }],
    ['wiki index', () => { if (window.WIKI) { WIKI.open('items', null); WIKI.state.view = 'list'; } }],
  ];
  // controls another file draws inside a core panel (61-markers' key toggle on the map) are that file's to check
  const FOREIGN = /^markers:/;
  const shape = b => b.r ? { k: 'c', x: b.cx != null ? b.cx : b.x + b.w / 2, y: b.cy != null ? b.cy : b.y + b.h / 2, r: b.r } : { k: 'r', x: b.x, y: b.y, w: b.w, h: b.h };
  const box = b => { const q = shape(b); return q.k === 'c' ? { x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 } : q; };
  const safeOf = t => HK.insets(VW, VH, HK.family(VW, VH, t), t);
  const frameIssues = (where, t) => {
    const out = [], R = panelRect, S = safeOf(t);
    if (!R) return [`${where}: no frame`];
    if (R.x < S.l - 0.5 || R.y < S.t - 0.5 || R.x + R.w > VW - S.r + 0.5 || R.y + R.h > VH - S.b + 0.5) out.push(`${where}: the frame leaves the safe area (${Math.round(R.x)},${Math.round(R.y)} ${Math.round(R.w)}x${Math.round(R.h)})`);
    const c = buttons.find(b => b.label === '×');
    if (!c) out.push(`${where}: no close seal`);
    else {
      const cb = box(c);
      if (cb.w < (t ? 44 : 32) - 0.5) out.push(`${where}: the close seal is ${Math.round(cb.w)} px`);
      for (const z of HK.bands({ VW, VH, S })) if (HK.gapBetween(z, shape(c)) < 0) out.push(`${where}: the close seal is in the ${z.name}`);
    }
    return out;
  };
  const panelIssues = (where, t) => {
    const out = frameIssues(where, t), R = panelRect; if (!R) return out;
    const ci = buttons.findIndex(b => b.label === '×');
    const mine = buttons.slice(Math.max(0, ci)).filter(b => !b.offscreen && b.w > 0 && b.h > 0 && !FOREIGN.test(b.label));
    const floor = t ? 44 : 26, clear = t ? 8 : 4;
    for (const b of mine) {
      const q = box(b);
      if (q.w < floor - 0.5 || q.h < floor - 0.5) out.push(`${where}: ${b.label} is ${Math.round(q.w)}x${Math.round(q.h)}, under ${floor}`);
      if (q.x < R.x - 0.5 || q.y < R.y - 0.5 || q.x + q.w > R.x + R.w + 0.5 || q.y + q.h > R.y + R.h + 0.5) out.push(`${where}: ${b.label} leaves the panel`);
      if (q.x < -0.5 || q.y < -0.5 || q.x + q.w > VW + 0.5 || q.y + q.h > VH + 0.5) out.push(`${where}: ${b.label} is off screen`);
    }
    for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) { const gp = HK.gapBetween(shape(mine[i]), shape(mine[j])); if (gp < clear - 0.01) out.push(`${where}: ${mine[i].label} ~ ${mine[j].label} ${gp.toFixed(1)} px apart`); }
    return out;
  };
  const fc = A.fitCtx();
  try {
    HK.setCacheOff(true);
    // ---------- 1. the ten core panels at 8 sizes x touch / mouse x Normal / Large text ----------
    {
      const problems = [], seen = {}; let frames = 0, tried = 0;
      for (const [w, hh] of A.SIZES) {
        if (!setSize(w, hh)) continue; tried++;
        for (const t of [true, false]) for (const tx of ['normal', 'large']) {
          window.__forceTouch = t; window.__stickRight = false; if (window.SETTINGS) SETTINGS.set('text', tx);
          for (const [name, open] of SCENES) {
            fixture(); closePanel(); open();
            const want = panel;
            HK.FIT.on = true; HK.FIT.log.length = 0; drawHud(fc); HK.FIT.on = false; frames++;
            const where = `${w}x${hh} ${t ? 'touch' : 'mouse'} ${tx} ${name}`;
            if (!want || panel !== want) { problems.push(`${where}: did not stay open`); continue; }
            for (const p of panelIssues(where, t).concat(A.fitIssues(where))) if (problems.length < 60) problems.push(p);
            // what each scene must show
            if (name === 'pack' && !(buttons.some(b => b.label === 'Wiki') && buttons.some(b => b.label === 'Eat') && buttons.some(b => b.label === 'Drop') && buttons.some(b => b.label === (t ? 'HOME' : 'Home (H)')))) problems.push(`${where}: the chosen item's verbs or Home are missing`);
            if (name.startsWith('pack in') && !(buttons.some(b => b.label === 'keyring:wind_flute') && buttons.some(b => b.label === 'Tap again to drop') && HK.FIT.log.filter(e => e.id === 'pack:fitted').map(e => e.s).join(' ') === 'Fitted: Iron drill, Ram, Boiler')) problems.push(`${where}: the keyring, FITTED or the armed Drop is missing`);
            seen[name] = (seen[name] || 0) + 1;
          }
        }
      }
      check(P + `the ten core panels keep the panel contract at 8 sizes, touch and mouse, Normal and Large text (${SCENES.length} scenes: the pack with an item chosen, the pack in the bulldozer with the keyring and FITTED, Skills, How to play, Quests, Said, the map, Crafting, the forge, the anvil, the shop with a sale armed, Death's Chest, a Wiki page and its index): from the close seal on, 44 px on touch (26 with a mouse), 8 px apart on touch (4 with a mouse), inside the panel, on screen, inside the safe insets, every string inside its plate`,
        tried === 8 && frames === 8 * 2 * 2 * SCENES.length && problems.length === 0, { tried, frames, problems: problems.slice(0, 14), total: problems.length });
    }
    // ---------- 2. every panel's frame: on screen, inside the safe insets, a close seal clear of the notch and home-bar bands ----------
    {
      const problems = [], noFrame = new Set(), threw = new Set(); let frames = 0;
      const ids = Array.from(new Set(Object.keys(HOOKS.panel).concat(['inventory', 'skills', 'help', 'quests', 'map', 'craft', 'station', 'shop', 'coffin', 'bank'])));
      const ARG = { station: 'forge', shop: 'general', gift: 'Ava' };
      if (window.SETTINGS) SETTINGS.set('text', 'normal');
      for (const [w, hh] of A.SIZES) {
        if (!setSize(w, hh)) continue;
        for (const t of [true, false]) {
          window.__forceTouch = t;
          for (const id of ids) {
            fixture(); closePanel();
            try { openPanel(id, ARG[id] || null); drawHud(fc); } catch (e) { threw.add(id); continue; }
            if (panel !== id) continue;
            frames++;
            if (!panelRect) { noFrame.add(id); continue; }
            for (const p of frameIssues(`${w}x${hh} ${t ? 'touch' : 'mouse'} ${id}`, t)) if (problems.length < 40) problems.push(p);
          }
        }
      }
      check(P + `every panel's frame (${ids.length} panels, 8 sizes, touch and mouse) sits on screen inside the safe insets (the notch, the Dynamic Island, the home bar), and its close seal is 44 px on touch and clear of those bands`, frames > 8 * 2 * 10 && problems.length === 0,
        { frames, problems: problems.slice(0, 12), total: problems.length, noFrame: [...noFrame], threw: [...threw] });
    }
    // ---------- 3. what the core panels paint: no glyph ticks, no word cut by an ellipsis, only the kit's colours ----------
    {
      const GITHUB = new Set(['#e6edf3', '#c9d1d9', '#8b949e', '#6e7681', '#f5c542', '#58a6ff', '#7ec8ff', '#b58cff', '#ff6b6b', '#8fa2b8', '#4b535d', '#30363d', '#21262d', '#238636', '#2a2f3a', '#ffd166', '#c0392b', '#8b2e2e', '#5a2e7a', '#161b22', '#0d1117']);
      const bad = []; let strings = 0;
      const recorder = () => {
        const out = []; let fill = '#000', font = '12px sans-serif';
        const nop = () => { };
        const p = new Proxy({}, {
          get: (tg, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6.5 })) : k === 'fillText' ? ((s) => out.push({ s: String(s), c: String(fill).toLowerCase() }))
            : k === 'fillStyle' ? fill : k === 'font' ? font : (k === 'createLinearGradient' || k === 'createRadialGradient') ? (() => ({ addColorStop: nop })) : k === 'createPattern' ? (() => null)
              : typeof k === 'string' ? nop : undefined,
          set: (tg, k, v) => { if (k === 'fillStyle') fill = v; if (k === 'font') font = v; return true; },
        });
        return { p, out };
      };
      for (const [w, hh, t] of [[390, 844, true], [1024, 768, true], [1280, 800, false]]) {
        setSize(w, hh); window.__forceTouch = t;
        for (const [name, open] of SCENES) {
          fixture(); closePanel(); open(); render();
          const rec = recorder(), keep = buttons.length;
          if (panel === 'wiki') HOOKS.panel.wiki(rec.p, VW < 640); else CORE_DRAW_PANELS(rec.p, VW < 640, false, 0, 0);
          buttons.length = keep;
          for (const e of rec.out) {
            strings++;
            if (/[✓✔✗✘★☆]/.test(e.s)) bad.push(`${w}x${hh} ${name}: a glyph mark in "${e.s}"`);
            if (/\w…/.test(e.s)) bad.push(`${w}x${hh} ${name}: a word cut by an ellipsis in "${e.s}"`);
            if (GITHUB.has(e.c)) bad.push(`${w}x${hh} ${name}: "${e.s}" painted in ${e.c}`);
          }
        }
      }
      check(P + 'the core panels paint no glyph ticks or stars, never cut a word with an ellipsis, and write only in the kit\'s colours (no leftover GitHub greys, blues or greens)', bad.length === 0 && strings > 200, { strings, bad: bad.slice(0, 12), total: bad.length });
    }
  } finally { restore(); }
});
