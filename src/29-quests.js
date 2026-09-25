// ============================================================================
// NOTICE BOARD — tiny quests. "The huge quest, the side quests, and the tiny quests."
// A wooden board in Thistledown's square (and one on the road outside the cave) lists small jobs
// from the folk of the village. Everything is taken and handed in at the board, so no core NPC
// needs touching. Registered entirely through HOOKS; edits no core file.
// State lives in quest.board = { taken, done, page, fish, fires, wolves, goblins, toasted }.
// ============================================================================

// ============================================================================
// PANEL_KIT — the small pieces the place-and-machine panels share: the bank (60), the notice board (29), the oven
// (34), the capes (38), the bulldozer bay (40), Fennick's rail (51), the wreck and Nix (52) and the island build
// panel (63). It sits here because this is the first of those files to load; everything in it reaches the Heraldry
// kit (HK, src/59-hudkit.js) only when a panel is drawn, so load order does not matter. The integrator may lift it
// into the kit. Every panel keeps the one panel contract:
//   · the frame is panelBox(); content starts at py + 62
//   · sentences are the system sans, HK.FS(600, 13), and grow with Settings > Text size; names and numbers are Cinzel,
//     HK.FC(800, 11-13), a fixed size; section heads are gold Cinzel capitals with a gold hairline
//   · colours come only from HK.T; rows sit on dark vellum; items sit in drawSlot pouches (44 px on touch)
//   · verbs are iron plate buttons HK.row() tall (44 on touch, 32 with a mouse), 8 px apart on touch; green = the
//     main choice, red = danger; a disabled one is still registered (inert) so a tap never falls through
//   · plates never change size with the text size: a plate's width comes from its word, and the word shrinks to fit
//   · long text wraps at whole words (HK.wrap); nothing is ever cut inside a word with an ellipsis
// PANEL_KIT.scene() registers a panel with the panel audit (run from 63-house's self-test, the last of these files).
// ============================================================================
const PANEL_KIT = (() => {
  const isTouch = () => (typeof touchMode === 'function' ? touchMode() : false);
  const R = () => HK.row();
  const GAP = () => (isTouch() ? 8 : 5);
  const POUCH = () => (isTouch() ? 44 : 40);
  const SENT = (px = 13) => HK.FS(600, px);
  const NAME = (px = 12) => HK.FC(800, px);
  // a plate's width from its word: the same number in the browser and the harness, and never bigger with the text size
  const plateW = (s, pad = 24) => Math.max(R(), Math.round(String(s).length * 7.6 + pad));
  const lineH = f => Math.round((f.s ? f.px * HK.k() : f.px) * 1.34);

  // a gold hairline (the page's rule)
  function rule(g, x, y, w, a = 0.35) {
    g.beginPath(); g.moveTo(Math.round(x), Math.round(y) + 0.5); g.lineTo(Math.round(x + w), Math.round(y) + 0.5);
    g.strokeStyle = `rgba(217,178,92,${a})`; g.lineWidth = 1; g.stroke();
  }
  // A section head: gold Cinzel capitals, a gold hairline to the right, and an optional short value at the far right.
  // Takes 18 px. Returns that height.
  function head(g, x, y, w, label, right) {
    const f = NAME(11), rf = NAME(11);
    const rw = right ? Math.ceil(HK.tw(g, right, rf)) + 10 : 0;
    const lw = HK.text(g, String(label).toUpperCase(), x, y + 12, { font: f, color: HK.T.gold, box: { x, y, w: w - rw, h: 16 }, fitId: 'panel:head' });
    if (right) HK.text(g, right, x + w, y + 12, { font: rf, align: 'right', color: HK.T.inkDim, box: { x: x + w - rw, y, w: rw, h: 16 }, fitId: 'panel:head' });
    const r0 = x + lw + 8, r1 = x + w - rw - (right ? 0 : 0);
    if (r1 > r0 + 8) rule(g, r0, y + 8, r1 - r0);
    return 18;
  }
  // One line of text in a box of width w. A Cinzel name shrinks to a floor first; whatever still does not fit ends at a
  // whole word. o: { font, color, align, floor, id }. Returns the width drawn.
  function say(g, s, x, y, w, o = {}) {
    let f = o.font || SENT(13); s = String(s);
    if (!f.s && HK.tw(g, s, f) > w) { let p = f.px; while (p > (o.floor || 9) && HK.tw(g, s, HK.FC(f.w, p)) > w) p -= 0.5; f = HK.FC(f.w, p); }
    if (HK.tw(g, s, f) > w) s = HK.wrap(g, s, w, 1, f).lines[0] || '';
    const bx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    return HK.text(g, s, x, y, { font: f, align: o.align || 'left', color: o.color || HK.T.inkDim, box: { x: bx, y: y - 14, w, h: 18 }, fitId: o.id || 'panel:line' });
  }
  // How many lines a sentence needs at width w (whole words).
  const linesOf = (g, s, w, f = SENT(13)) => Math.max(1, HK.wrap(g, s, w, 99, f).lines.length);
  // A wrapped sentence; y is the first baseline. Returns the height taken (lines x line height).
  function para(g, s, x, y, w, maxLines = 99, o = {}) {
    const f = o.font || SENT(13), lh = o.lh || lineH(f);
    const { lines } = HK.wrap(g, s, w, maxLines, f);
    lines.forEach((ln, i) => HK.text(g, ln, x, y + i * lh, { font: f, color: o.color || HK.T.inkDim, box: { x, y: y + i * lh - 14, w, h: lh }, fitId: o.id || 'panel:para' }));
    return lines.length * lh;
  }
  // An iron plate button that SHOWS one word and ANSWERS to a label (tests and the harness click by label, so a
  // label never changes; the word on the plate can be plainer). tone: 'primary' | 'danger' | 'warn' | null.
  // A disabled plate is registered as an inert 'disabled:' rect, as button() does.
  function plate(g, x, y, w, h, shown, label, action, tone, enabled = true, o = {}) {
    const st = enabled ? HK.stateOf(label) : {};
    HK.plateButton(g, { x, y, w, h }, o.em || null, shown, tone, { pressed: !!st.pressed, hover: !!st.hover, disabled: !enabled, on: !!o.on, cinzel: !!o.cinzel });
    buttons.push(enabled ? { x, y, w, h, label, action, up: true, name: o.name || shown } : { x, y, w, h, label: 'disabled:' + label, action: () => { }, disabled: true, inert: true });
  }
  // A tab: a plate, the chosen one primary (gold edge). Tabs stay tappable when chosen (a second tap does nothing new).
  const tab = (g, x, y, w, shown, label, on, action) => plate(g, x, y, w, R(), shown, label, action, on ? 'primary' : null, true);
  // A row of plates of equal width across w. items: [{ shown, label, action, tone, on, enabled }]
  function plateRow(g, x, y, w, items) {
    const G = GAP(), n = items.length, pw = (w - (n - 1) * G) / n;
    items.forEach((it, i) => {
      const bx = Math.round(x + i * (pw + G)), bw = Math.round(x + i * (pw + G) + pw) - bx;
      plate(g, bx, y, bw, R(), it.shown, it.label, it.action, it.on ? 'primary' : (it.tone || null), it.enabled !== false);
    });
    return R();
  }
  // Lay plates of their own widths into rows no wider than width. Each item carries w; returns [[{ ...item, x }]].
  function flow(items, width) {
    const G = GAP(), rows = []; let row = null, x = 0;
    for (const it of items) {
      if (!row || (x > 0 && x + it.w > width)) { row = []; rows.push(row); x = 0; }
      row.push(Object.assign({}, it, { x })); x += it.w + G;
    }
    return rows;
  }
  const flowH = rows => (rows.length ? rows.length * R() + (rows.length - 1) * GAP() : 0);
  // Prev / Next: two plates with drawn chevrons and the page count between them, HK.row() tall.
  // Reserve HK.row() + 8 below it. Returns the page shown (clamped).
  function pager(g, x, y, w, page, pages, setPage) {
    const p = clamp(page, 0, Math.max(0, pages - 1)), h = R(), pw = isTouch() ? 92 : 82;
    const one = (bx, label, em, on, fn) => {
      plate(g, bx, y, pw, h, label === 'Prev' ? 'Back' : 'Next', label, fn, null, on, { name: label === 'Prev' ? 'Back a page' : 'Next page' });
      HK.emblem(g, em, label === 'Prev' ? bx + 15 : bx + pw - 15, y + h / 2, 13, on ? HK.T.goldHi : HK.T.inkMute, { hole: null });
    };
    one(x, 'Prev', 'chevronL', p > 0, () => setPage(p - 1));
    say(g, `${p + 1} / ${pages}`, x + w / 2, y + h / 2 + 5, Math.max(40, w - 2 * pw - 16), { font: NAME(13), align: 'center', color: HK.T.inkDim, id: 'panel:pager' });
    one(x + w - pw, 'Next', 'chevronR', p < pages - 1, () => setPage(p + 1));
    return p;
  }
  // A row of work on dark vellum: the page's card. edge: a meaning colour for its inner line (gold = ready, good = done).
  const card = (g, x, y, w, h, edge) => HK.vellumPlate(g, x, y, w, h, edge ? { edge } : {});
  // An item in a pouch (the kit's slot). qty 1 is stamped too when `stamp` is set, so a cost of one reads "1".
  function pouch(g, x, y, s, id, qty, o = {}) {
    drawSlot(g, x, y, s, id ? { id, qty } : null, !!o.sel);
    if (id && qty === 1 && o.stamp) HK.text(g, '1', x + s - 5, y + s - 6, { font: NAME(Math.max(11, Math.round(s * 0.24))), align: 'right', color: '#f6d98c', halo: 3 });
  }
  // A cost as pouches: each item with the number needed stamped on it, and under it "have / need" in green when there
  // is enough and amber when not. Returns the height taken (pouch + its count line).
  function costRow(g, x, y, cost, o = {}) {
    const s = o.s || POUCH(), G = GAP(), cw = Math.max(s, 46);
    cost.forEach(([id, n], i) => {
      const cx = x + i * (cw + G), have = countItem(id), ok = have >= n;
      pouch(g, cx + (cw - s) / 2, y, s, id, n, { stamp: true });
      say(g, `${Math.min(have, 9999)} / ${n}`, cx + cw / 2, y + s + 13, cw + G - 2, { font: NAME(10), align: 'center', color: ok ? HK.T.good : HK.T.warn, id: 'panel:cost' });
    });
    return s + 16;
  }
  const costW = (n, s) => n ? n * Math.max(s || POUCH(), 46) + (n - 1) * GAP() : 0;
  // A drawn mark with a word beside it: the tick for "yes", the cross for "no" (no glyph characters).
  function mark(g, ok, x, y, word, o = {}) {
    const col = o.color || (ok ? HK.T.good : HK.T.warn);
    HK.emblem(g, ok ? 'tick' : 'close', x + 7, y - 4, 14, col, { hole: null });
    return 18 + say(g, word, x + 18, y, o.w || 200, { font: o.font || SENT(13), color: col, id: 'panel:mark' });
  }
  // The harness still reaches a control drawn on another page (F.clickButton finds it by label), but no tap can.
  function offscreen(label, action, enabled = true) {
    buttons.push(enabled ? { x: -1e9, y: -1e9, w: 0, h: 0, label, action, offscreen: true } : { x: -1e9, y: -1e9, w: 0, h: 0, label: 'disabled:' + label, action: () => { }, offscreen: true, inert: true, disabled: true });
  }
  // Greedy pages of rows with their own heights, so no row is ever cut or squeezed: [[index, ...], ...]
  function pages(heights, room, gap) {
    const out = []; let cur = [], used = 0;
    heights.forEach((h, i) => { const need = (cur.length ? gap : 0) + h; if (cur.length && used + need > room) { out.push(cur); cur = []; used = 0; } used += (cur.length ? gap : 0) + h; cur.push(i); });
    if (cur.length) out.push(cur);
    return out.length ? out : [[]];
  }

  // ---------- the panel audit ----------
  // Every registered scene opens its panel at the 8 device sizes, touch and mouse, at Normal and Large text, and the
  // panel is drawn by the real drawHud onto a context that measures text the way the fonts do (HK.audit.fitCtx) and
  // records every string it paints. Checked from the × seal onward: 44 px on touch (26 with a mouse), 8 px apart on
  // touch (4 with a mouse), inside the panel and on screen; at Large every string fits its box; nothing painted is a
  // tick or cross glyph or an ellipsis.
  const SCENES = [];
  function scene(def) { SCENES.push(def); }
  function recorder() {
    const fc = HK.audit.fitCtx(); let drawn = [];
    const rec = new Proxy({}, {
      get: (t, k) => (k === 'fillText' || k === 'strokeText') ? (s => { drawn.push(String(s)); }) : fc[k],
      set: (t, k, v) => { fc[k] = v; return true; },
    });
    return { rec, take: () => { const d = drawn; drawn = []; return d; } };
  }
  function audit(check, F, h) {
    const A = HK.audit, own = k0 => Object.getOwnPropertyDescriptor(window, k0);
    const saved = { w: own('innerWidth'), h: own('innerHeight'), touch: window.__forceTouch, text: window.SETTINGS ? SETTINGS.get('text') : 'normal', panel, arg: panelArg, paused, dc: dialog.cur, notice, mech: player.mech };
    const setSize = (w, hh) => { window.innerWidth = w; window.innerHeight = hh; if (VW !== w || VH !== hh) resize(); return VW === w && VH === hh; };
    const { rec, take } = recorder();
    const shape = b => (b.r ? { k: 'c', x: b.cx != null ? b.cx : b.x + b.w / 2, y: b.cy != null ? b.cy : b.y + b.h / 2, r: b.r } : { k: 'r', x: b.x, y: b.y, w: b.w, h: b.h });
    const box = s => (s.k === 'c' ? { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 } : s);
    const results = [];
    try {
      HK.setCacheOff(true); closePanel(); paused = false; dialog.cur = null; notice = null; player.mech = null;
      for (const sc of SCENES) {
        const problems = []; let frames = 0, opened = 0;
        let undo = null;
        try {
          undo = sc.setup ? sc.setup(F, h) : null;
          for (const [w, hh] of A.SIZES) {
            if (!setSize(w, hh)) { problems.push(`${w}x${hh}: could not size the window`); continue; }
            for (const t of [true, false]) {
              window.__forceTouch = t;
              for (const tx of ['normal', 'large']) {
                if (window.SETTINGS) SETTINGS.set('text', tx);
                for (const v of sc.variants) {
                  const where = `${sc.id}${v.name ? ' ' + v.name : ''} ${w}x${hh} ${t ? 'touch' : 'mouse'} ${tx}`;
                  closePanel(); v.open();
                  HK.FIT.on = true; HK.FIT.log.length = 0; take();
                  // where the panel's own words start in the fit log (the HUD under it is drawn first)
                  let fitFrom = 0; const ph = HOOKS.panel[sc.panel];
                  HOOKS.panel[sc.panel] = (g2, nar) => { fitFrom = HK.FIT.log.length; return ph(g2, nar); };
                  try { drawHud(rec); } finally { HOOKS.panel[sc.panel] = ph; }
                  frames++;
                  HK.FIT.on = false;
                  const painted = take();
                  if (panel !== sc.panel) { problems.push(`${where}: the panel did not stay open (${panel})`); continue; }
                  opened++;
                  if (!panelRect) { problems.push(`${where}: no panel frame`); continue; }
                  const P = panelRect, floor = t ? 44 : 26, clear = t ? 8 : 4;
                  if (P.x < -0.5 || P.y < -0.5 || P.x + P.w > VW + 0.5 || P.y + P.h > VH + 0.5) problems.push(`${where}: the panel runs off the screen`);
                  const all = buttons.filter(b => !b.offscreen && b.w > 0 && b.h > 0);
                  const ci = all.findIndex(b => b.label === '×');
                  if (ci < 0) { problems.push(`${where}: no close seal`); continue; }
                  const mine = all.slice(ci).map(b => ({ b, s: shape(b) }));
                  for (const q of mine) {
                    const r = box(q.s);
                    if (r.w < floor - 0.5 || r.h < floor - 0.5) problems.push(`${where}: ${q.b.label} is ${Math.round(r.w)}x${Math.round(r.h)}, under ${floor}`);
                    if (r.x < P.x - 0.5 || r.y < P.y - 0.5 || r.x + r.w > P.x + P.w + 0.5 || r.y + r.h > P.y + P.h + 0.5) problems.push(`${where}: ${q.b.label} is outside the panel`);
                    if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > VW + 0.5 || r.y + r.h > VH + 0.5) problems.push(`${where}: ${q.b.label} is off screen`);
                  }
                  for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) {
                    const gp = HK.gapBetween(mine[i].s, mine[j].s);
                    if (gp < clear - 0.01) problems.push(`${where}: ${mine[i].b.label} and ${mine[j].b.label} are ${gp.toFixed(1)} px apart`);
                  }
                  // only the panel's own words: the HUD under it has its own fit audit in 59-hudkit
                  if (tx === 'large') { HK.FIT.log.splice(0, fitFrom); for (const p of A.fitIssues(where)) problems.push(p); }
                  const bad = painted.filter(s => /[✓✔✗✘…]/.test(s));
                  if (bad.length) problems.push(`${where}: painted ${JSON.stringify(bad.slice(0, 3))}`);
                  if (sc.more) for (const p of sc.more(where, painted) || []) problems.push(p);
                }
              }
            }
          }
        } catch (e) { problems.push(`${sc.id}: threw ${e && e.message}`); }
        finally { closePanel(); try { if (undo) undo(); } catch (e) { problems.push(`${sc.id}: undo threw ${e && e.message}`); } }
        results.push({ sc, problems, frames, opened });
      }
    } finally {
      HK.FIT.on = false; HK.setCacheOff(false);
      window.__forceTouch = saved.touch; if (window.SETTINGS) SETTINGS.set('text', saved.text);
      if (saved.w) { Object.defineProperty(window, 'innerWidth', saved.w); Object.defineProperty(window, 'innerHeight', saved.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } }
      resize(); closePanel(); paused = saved.paused; dialog.cur = saved.dc; notice = saved.notice; player.mech = saved.mech;
      if (saved.panel) openPanel(saved.panel, saved.arg);
      render();
    }
    for (const r of results) {
      const want = 8 * 2 * 2 * r.sc.variants.length;
      check(`panels: ${r.sc.name} — at all 8 sizes, touch and mouse, normal and large text (${want} frames): every control from the close seal on is 44 px on touch (26 with a mouse) and 8 px apart on touch (4 with a mouse), inside the panel and on screen; every word fits its box at Large; no tick, cross or ellipsis glyph is painted`,
        r.frames === want && r.opened === want && r.problems.length === 0, { frames: r.frames, opened: r.opened, problems: r.problems.slice(0, 10), total: r.problems.length });
    }
  }
  return { R, GAP, POUCH, SENT, NAME, plateW, lineH, rule, head, say, linesOf, para, plate, tab, plateRow, flow, flowH, pager, card, pouch, costRow, costW, mark, offscreen, pages, scene, audit, SCENES };
})();
window.PANEL_KIT = PANEL_KIT;

{
  const BOARD = addTile('BOARD', { solid: true, tex: 'cobble', mini: '#8a6a3a' });
  const BOARD_TILES = [[105, 27], [24, 6]]; // the square in Thistledown; the road outside the cave
  const GOBLIN_TYPES = ['goblin', 'sapper', 'brute'];

  // ---------- the jobs ----------
  // kind: item (bring n of an item) | kill (defeat n monsters) | hit (best hit ≥ n) | fish (catch n fish) | fire (light n fires)
  // tag: unique short label used on buttons ('Take: Greta'); short: the words used in progress lines ('Greta: potatoes 4/10')
  const BOARD_QUESTS = [
    { id: 'greta', tag: 'Greta', giver: 'Greta', title: 'Spuds for Greta', kind: 'item', item: 'potato', n: 10, short: 'potatoes', reward: { coins: 60, xp: ['farming', 80] },
      note: "My stall's bare and the soup won't make itself. Ten potatoes, love.", thanks: "Ten fat potatoes! You're a good one. Here, and there's soup on if you want it." },
    { id: 'brakka', tag: 'Brakka', giver: 'Brakka the smith', title: 'Ore for the forge', kind: 'item', item: 'iron_ore', n: 6, short: 'iron ore', reward: { coins: 90, xp: ['smithing', 60] },
      note: 'Six lumps of iron ore. The forge eats more than I do.', thanks: 'Good ore. Heavy. The forge will sing tonight. Take your coin.' },
    { id: 'dorran', tag: 'Dorran', giver: 'Dorran the innkeeper', title: 'Pelts for the inn', kind: 'item', item: 'wolf_pelt', n: 3, short: 'wolf pelts', reward: { coins: 120 },
      note: 'Three wolf pelts for the beds upstairs. The guests keep moaning about the cold.', thanks: 'Warm as a summer night, these. No more moaning guests. Coin, as promised.' },
    { id: 'pim', tag: 'Pim', giver: 'Pim the tinker', title: 'Powder run', kind: 'item', item: 'blast_powder', n: 3, short: 'blast powder', reward: { coins: 100, xp: ['crafting', 200] },
      note: "Three blast powder. Don't shake it. Don't drop it. Don't ask.", thanks: "Oh lovely, still in one piece. Both of us. Here's your coin, and mind your eyebrows." },
    { id: 'rosalind', tag: 'Rosalind', giver: 'Rosalind', title: 'Pie filling', kind: 'item', item: 'raw_beef', n: 5, short: 'raw beef', reward: { coins: 70, xp: ['cooking', 60] },
      note: "Five raw beef and there's a pie in it for the whole street.", thanks: 'Five beef, fresh. The whole street eats pie tonight. Thank you, knight.' },
    { id: 'marta', tag: 'Marta', giver: 'Marta', title: 'Logs for the store', kind: 'item', item: 'wood', n: 20, short: 'logs', reward: { coins: 50, xp: ['woodcutting', 60] },
      note: "Twenty logs. Winter's coming and the shelves won't warm themselves.", thanks: "Twenty logs, stacked and dry. That's the winter sorted. Here you go." },
    { id: 'aldous', tag: 'Aldous', giver: 'Aldous the banker', title: 'Stone for the vault', kind: 'item', item: 'stone', n: 10, short: 'stone', reward: { coins: 30 },
      note: 'Ten stone. The vault wall has a crack and I do not like cracks.', thanks: 'Ten stone, counted twice. The crack will be gone by morning. Your fee.' },
    { id: 'fennick', tag: 'Fennick', giver: 'Fennick the trader', title: 'Tusks, tusks, tusks', kind: 'item', item: 'boar_tusk', n: 5, short: 'boar tusks', reward: { coins: 150 },
      note: "Five boar tusks. There's a buyer down south who pays silly money.", thanks: 'Five tusks! My buyer will weep with joy. Silly money, as promised.' },
    { id: 'duke', tag: 'Duke', giver: 'Duke Ferrin', title: 'Scrap for the armoury', kind: 'item', item: 'goblin_scrap', n: 20, short: 'goblin scrap', reward: { coins: 300, item: ['steel_bar', 1] },
      note: 'Twenty goblin scrap for the armoury. The Duchy pays well, and in steel.', thanks: 'Twenty scrap. Every piece of it was pointed at Thistledown once. Coin, and a bar of good steel.' },
    { id: 'hale', tag: 'Hale', giver: 'Sergeant Hale', title: 'Hit like a knight', kind: 'hit', n: 8, short: 'best hit', reward: { xp: ['melee', 200] },
      note: 'Show me a hit of eight. The dummies in my yard will take it.', thanks: 'Eight! That is a knight’s arm. Keep swinging like that and the goblins will run.' },
    { id: 'cass', tag: 'Cass', giver: 'Cass', title: 'Fish for the street', kind: 'fish', n: 10, short: 'fish', reward: { coins: 80, xp: ['fishing', 60] },
      note: "Ten fish from the pond. Shrimp or trout, I'm not fussy.", thanks: 'Ten fish! Everyone on the street eats tonight. You are a good sort, knight.' },
    { id: 'wren', tag: 'Wren', giver: 'Old Wren', title: 'Fires in the dark', kind: 'fire', n: 5, short: 'fires', reward: { coins: 60, xp: ['firemaking', 80] },
      note: "Light five fires out in the world. The wood gets dark, and wolves don't like light.", thanks: 'Five fires. I saw them from my hut. The wood was quieter for it. Well done.' },
    { id: 'bram', tag: 'Bram', giver: 'Bram', title: 'Wolf cull', kind: 'kill', types: ['wolf'], n: 5, short: 'wolves', reward: { coins: 150, xp: ['defence', 60] },
      note: "Five wolves, knight. They've been at the sheep again.", thanks: 'Five wolves down. The sheep can sleep, and so can I. Here.' },
    { id: 'captain', tag: 'Captain', giver: 'Captain Roderick', title: 'Goblin bounty', kind: 'kill', types: GOBLIN_TYPES, n: 10, short: 'goblins', reward: { coins: 250 },
      note: 'Ten goblins, any size. The watch pays by the head.', thanks: 'Ten heads. The watch pays, and the watch remembers. Good work, knight.' },
    { id: 'thessaly', tag: 'Thessaly', giver: 'Thessaly the weaver', title: 'Wool for the loom', kind: 'item', item: 'wool', n: 10, short: 'wool', reward: { coins: 40, xp: ['crafting', 300] },
      note: 'Ten wool, clean. The loom is hungry and the sheep are a long way from the jungle.', thanks: 'Ten wool. Soft as cloud. Watch how the loom takes it, and you will learn something of the craft.' },
    { id: 'pies', tag: 'Pies', giver: 'Rosalind', title: 'Berry pies for the bakery', kind: 'item', item: 'berry_pie', n: 3, short: 'berry pies', reward: { coins: 120, xp: ['cooking', 100] },
      note: 'Three berry pies. Bushes by the road, flour from wheat, and my ovens are yours. I want to taste yours before I sell them.', thanks: 'Three berry pies, and the crust holds. You could bake for a living, knight. Coin, and a trick or two of the oven.' },
  ];
  const byId = {}; for (const q of BOARD_QUESTS) byId[q.id] = q;

  // ---------- state ----------
  const freshBoard = () => ({ taken: {}, done: {}, page: 0, fish: 0, fires: 0, wolves: 0, goblins: 0, toasted: {} });
  const bq = () => { if (!quest.board) quest.board = freshBoard(); const b = quest.board; for (const k of ['taken', 'done', 'toasted']) if (!b[k]) b[k] = {}; for (const k of ['fish', 'fires', 'wolves', 'goblins']) if (typeof b[k] !== 'number') b[k] = 0; if (typeof b.page !== 'number') b.page = 0; return b; };
  const isTaken = q => !!bq().taken[q.id] && !bq().done[q.id];
  const openQuests = () => BOARD_QUESTS.filter(isTaken);
  const progress = q => {
    const b = bq();
    if (q.kind === 'item') return Math.min(q.n, countItem(q.item));
    if (q.kind === 'hit') return Math.min(q.n, player.highestHit);
    if (q.kind === 'fish') return Math.min(q.n, b.fish);
    if (q.kind === 'fire') return Math.min(q.n, b.fires);
    if (q.kind === 'kill') return Math.min(q.n, q.types.includes('wolf') ? b.wolves : b.goblins);
    return 0;
  };
  const ready = q => isTaken(q) && progress(q) >= q.n;
  const anyReady = () => BOARD_QUESTS.some(ready);
  const skillName = key => SKILL_DEFS.find(s => s.key === key).name;
  const needText = q => {
    const p = progress(q);
    if (q.kind === 'item') return `Bring ${q.n} ${ITEMS[q.item].name} (${p}/${q.n})`;
    if (q.kind === 'hit') return `Land a hit of ${q.n} or more (best ${player.highestHit})`;
    if (q.kind === 'fish') return `Catch ${q.n} fish (${p}/${q.n})`;
    if (q.kind === 'fire') return `Light ${q.n} fires (${p}/${q.n})`;
    return `Defeat ${q.n} ${q.short} (${p}/${q.n})`;
  };
  const rewardText = q => { const r = q.reward, parts = []; if (r.coins) parts.push(`${r.coins} coins`); if (r.xp) parts.push(`${r.xp[1]} ${skillName(r.xp[0])} xp`); if (r.item) parts.push(`${r.item[1] > 1 ? r.item[1] + ' ' : ''}${ITEMS[r.item[0]].name}`); return parts.join(', '); };
  const shortLine = q => `${q.tag}: ${q.short} ${progress(q)}/${q.n}`;

  // ---------- take / hand in ----------
  const takeQuest = q => {
    const b = bq(); if (b.taken[q.id]) return;
    b.taken[q.id] = true;
    notify(`Taken: ${q.title}. Open quests (J) to track it.`);
    floatText(player.x, player.y - 30, q.title, '#ffe9a8', 13);
    save();
  };
  const handIn = q => {
    if (!ready(q)) { notify(`Not yet. ${needText(q)}.`); return false; }
    const b = bq(); const r = q.reward;
    if (q.kind === 'item') removeItem(q.item, q.n);
    b.done[q.id] = true;
    if (r.coins) { giveOrDrop('coins', r.coins, player.x, player.y, true); floatText(player.x, player.y - 30, `+${r.coins} coins`, '#ffd166'); }
    if (r.xp) { gainXp(r.xp[0], r.xp[1]); floatText(player.x, player.y - 46, `+${r.xp[1]} ${skillName(r.xp[0])} xp`, '#58a6ff', 13); }
    if (r.item) giveOrDrop(r.item[0], r.item[1], player.x, player.y);
    say(q.thanks, q.giver);
    levelBanner = { text: 'JOB DONE', sub: q.title, t: 2.6 };
    burst(player.x, player.y, '#ffe066', 16, 110);
    save(); return true;
  };

  // ---------- counters ----------
  HOOKS.kill.push(m => {
    const b = bq(); let hit = false;
    for (const q of BOARD_QUESTS) { if (q.kind !== 'kill' || !isTaken(q) || !q.types.includes(m.type)) continue; if (q.types.includes('wolf')) b.wolves += 1; else b.goblins += 1; hit = true; }
    if (hit) save();
  });
  let lastFish = null; let lastFireSet = null;
  HOOKS.update.push(dt => {
    const b = bq();
    // fishing: raw fish rising while the rod is in the water
    const fishNow = countItem('raw_shrimp') + countItem('raw_trout');
    if (lastFish !== null && player.action && player.action.type === 'fish' && fishNow > lastFish && BOARD_QUESTS.some(q => q.kind === 'fish' && isTaken(q))) b.fish += fishNow - lastFish;
    lastFish = fishNow;
    // firemaking: a fire tile that was not burning last tick
    if (lastFireSet !== null && BOARD_QUESTS.some(q => q.kind === 'fire' && isTaken(q))) { let n = 0; for (const f of fires) if (!lastFireSet.has(f.i)) n++; if (n) b.fires += n; }
    lastFireSet = new Set(fires.map(f => f.i));
    // one toast per job when it becomes ready to hand in
    for (const q of BOARD_QUESTS) if (ready(q) && !b.toasted[q.id]) { b.toasted[q.id] = true; notify(`Notice board: ${q.giver.split(' ')[0]}'s ${q.short} ready to hand in.`); }
  });

  // ---------- world + use ----------
  HOOKS.world.push((rnd, api) => { for (const [x, y] of BOARD_TILES) api.setTile(x, y, BOARD); });
  HOOKS.use.push((t, tx, ty) => { if (t !== BOARD) return false; openPanel('board'); return true; });

  // ---------- panel ----------
  // Each job is a card of dark vellum: its title in Cinzel, who asks and what they said (whole, never cut), what it
  // takes with the exact count so far, and the reward — coins and xp in exact numbers. Take job / Hand in sits on the
  // card as an iron plate. Cards keep their full height, so a page holds as many whole cards as the screen has room
  // for; Back and Next turn the pages and Close shuts the board. A ready job's card wears the gold edge.
  const rewardBits = q => { const r = q.reward, out = []; if (r.coins) out.push({ coin: true, t: String(r.coins) }); if (r.xp) out.push({ t: `${r.xp[1]} ${skillName(r.xp[0])} xp` }); if (r.item) out.push({ t: `${r.item[1] > 1 ? r.item[1] + ' ' : ''}${ITEMS[r.item[0]].name}` }); return out; };
  // the geometry every size shares: the card's width, the plate's width, the text column, and each card's height
  function boardGeom(g) {
    const K = PANEL_KIT, R = K.R(), G = K.GAP();
    const w = Math.min(VW - 20, 640), inner = w - 36, wide = inner >= 470;
    const bw = touchMode() ? 124 : 112, textW = wide ? inner - 24 - bw - 14 : inner - 24;
    const f = K.SENT(13), lh = K.lineH(f);
    const hOf = q => {
      const text = 10 + 18 + K.linesOf(g, noteOf(q), textW, f) * lh + lh + 20 + 8;
      return wide ? Math.max(text, R + 24) : 10 + 18 + K.linesOf(g, noteOf(q), textW, f) * lh + lh + 4 + R + 10;
    };
    const heights = BOARD_QUESTS.map(hOf);
    const foot = R + 16, room = VH - 20 - 62 - foot - 8;
    const pages = K.pages(heights, room, G);
    const pageH = Math.max(...pages.map(p => p.reduce((a, i) => a + heights[i], 0) + (p.length - 1) * G));
    return { K, R, G, w, inner, wide, bw, textW, f, lh, heights, pages, h: 62 + pageH + 8 + foot };
  }
  const noteOf = q => `${q.giver}: “${q.note}”`;
  const boardPages = () => boardGeom(ctx).pages;
  const pageOf = q => boardPages().findIndex(p => p.includes(BOARD_QUESTS.indexOf(q)));
  HOOKS.panel.board = (g, narrow) => {
    const b = bq(), Q = boardGeom(g), { K, R, G } = Q;
    b.page = clamp(b.page | 0, 0, Q.pages.length - 1);
    const taken = openQuests().length, done = BOARD_QUESTS.filter(q => b.done[q.id]).length, readyN = BOARD_QUESTS.filter(ready).length;
    const { px, py, w, h } = panelBox(g, Q.w, Q.h, 'Notice board', taken || done ? `${taken} taken, ${done} done${readyN ? `, ${readyN} ready to hand in` : ''}` : 'Take a job, do it, bring it back here.');
    const x0 = px + 18;
    let y = py + 62;
    for (const i of Q.pages[b.page]) {
      const q = BOARD_QUESTS[i], ch = Q.heights[i], isDone = !!b.done[q.id], tk = isTaken(q), rd = ready(q);
      K.card(g, x0, y, Q.inner, ch, rd ? HK.T.goldHi : null);
      const tx = x0 + 12;
      let ty = y + 10;
      K.say(g, q.title, tx, ty + 13, Q.textW, { font: K.NAME(13), color: isDone ? HK.T.inkMute : rd ? HK.T.goldHi : HK.T.ink, id: 'board:title' });
      ty += 18;
      ty += K.para(g, noteOf(q), tx, ty + 12, Q.textW, 99, { font: Q.f, color: isDone ? HK.T.inkMute : HK.T.inkDim, id: 'board:note' });
      // what it takes, with the count so far
      if (isDone) K.mark(g, true, tx, ty + 13, 'Done. Thank you, knight.', { w: Q.textW - 18, color: HK.T.inkMute });
      else if (rd) K.mark(g, true, tx, ty + 13, needText(q) + '. Ready to hand in.', { w: Q.textW - 18 });
      else K.say(g, needText(q), tx, ty + 13, Q.textW, { font: Q.f, color: tk ? HK.T.ink : HK.T.inkDim, id: 'board:need' });
      ty += Q.lh + 2;
      // the reward, exact, in Cinzel
      const bx = x0 + Q.inner - 12 - Q.bw, by = Q.wide ? y + Math.round((ch - R) / 2) : y + ch - 10 - R;
      // (on a narrow card the reward shares the row with the plate, so the word Reward gives way and the numbers
      // shrink to fit, never cut)
      const ry = Q.wide ? ty + 13 : by + R / 2 + 5, rEnd = Q.wide ? tx + Q.textW : bx - 10, bits = rewardBits(q), label = Q.wide;
      const rowW = px0 => (label ? HK.tw(g, 'Reward', K.NAME(11)) + 8 : 0) + bits.reduce((a, bt) => a + (bt.coin ? 15 : 0) + HK.tw(g, bt.t, K.NAME(px0)) + 12, -12);
      let rp = 12; while (rp > 9 && rowW(rp) > rEnd - tx) rp -= 0.5;
      const rbox = { x: tx, y: ry - 12, w: rEnd - tx, h: 16 };
      let rx = tx;
      if (label) rx += HK.text(g, 'Reward', rx, ry, { font: K.NAME(11), color: HK.T.gold, box: rbox, fitId: 'board:reward' }) + 8;
      for (const bit of bits) {
        if (bit.coin) { HK.coin(g, rx + 6, ry - 4, 6); rx += 15; }
        rx += HK.text(g, bit.t, rx, ry, { font: K.NAME(rp), color: isDone ? HK.T.inkMute : bit.coin ? HK.T.goldHi : HK.T.ink, box: rbox, fitId: 'board:reward' }) + 12;
      }
      // the verb
      if (isDone) K.plate(g, bx, by, Q.bw, R, 'Done', 'Done', () => { }, null, false, { em: 'tick' });
      else if (!tk) K.plate(g, bx, by, Q.bw, R, 'Take job', `Take: ${q.tag}`, () => takeQuest(q), 'primary', true, { name: 'Take ' + q.giver + '’s job' });
      else K.plate(g, bx, by, Q.bw, R, 'Hand in', `Hand in: ${q.tag}`, () => handIn(q), rd ? 'primary' : null, rd, { name: 'Hand in ' + q.giver + '’s job' });
      y += ch + G;
    }
    // Back / the page / Next, and Close
    const fy = py + h - 8 - R, cw = K.plateW('Close');
    K.pager(g, x0, fy, Q.inner - cw - 2 * G, b.page, Q.pages.length, p => { b.page = clamp(p, 0, Q.pages.length - 1); save(); });
    K.plate(g, x0 + Q.inner - cw, fy, cw, R, 'Close', 'Close', closePanel, null, true);
  };
  // the panel audit's scene (PANEL_KIT, run from 63-house): jobs taken, one ready, one done, on the first and last page
  PANEL_KIT.scene({
    id: 'board', panel: 'board', name: 'Notice board (jobs taken, ready and done, first and last page)',
    setup() {
      const keep = quest.board ? JSON.parse(JSON.stringify(quest.board)) : null, inv = player.inv.map(s => (s ? { ...s } : null));
      quest.board = freshBoard(); const b = bq();
      b.taken.greta = true; b.done.greta = true; b.taken.brakka = true; b.taken.hale = true; b.taken.captain = true; b.goblins = 4; b.toasted = { hale: true };
      const hh = player.highestHit; player.highestHit = 12;
      return () => { quest.board = keep; player.inv = inv; player.highestHit = hh; };
    },
    variants: [
      { name: 'page 1', open: () => { openPanel('board'); bq().page = 0; } },
      { name: 'last page', open: () => { openPanel('board'); bq().page = 99; } },
    ],
  });

  // ---------- drawing ----------
  const drawBoard = (g, tx, ty, mark) => {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + 18, 20, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3e1e'; g.fillRect(cx - 18, cy - 26, 5, 46); g.fillRect(cx + 13, cy - 26, 5, 46);
    g.fillStyle = '#8a6a3a'; g.fillRect(cx - 23, cy - 34, 46, 31); g.strokeStyle = '#4a2e13'; g.lineWidth = 1.5; g.strokeRect(cx - 23, cy - 34, 46, 31);
    g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(cx - 23, cy - 34 + k * 8); g.lineTo(cx + 23, cy - 34 + k * 8); g.stroke(); }
    g.fillStyle = '#6b4a2a'; g.beginPath(); g.moveTo(cx - 27, cy - 34); g.lineTo(cx, cy - 43); g.lineTo(cx + 27, cy - 34); g.closePath(); g.fill();
    const papers = [[-19, -30, 11, 13, -0.08], [-5, -31, 10, 12, 0.06], [8, -29, 11, 14, -0.04], [-13, -16, 12, 10, 0.05], [3, -15, 13, 9, -0.06]];
    for (const [ox, oy, pw, ph, rot] of papers) {
      g.save(); g.translate(cx + ox + pw / 2, cy + oy + ph / 2); g.rotate(rot);
      g.fillStyle = '#efe6cf'; g.fillRect(-pw / 2, -ph / 2, pw, ph);
      g.strokeStyle = 'rgba(80,60,30,0.5)'; g.lineWidth = 0.8; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-pw / 2 + 2, -ph / 2 + 3.5 + k * 3); g.lineTo(pw / 2 - 2, -ph / 2 + 3.5 + k * 3); g.stroke(); }
      g.fillStyle = '#c0392b'; g.beginPath(); g.arc(0, -ph / 2 + 1.5, 1.5, 0, 7); g.fill();
      g.restore();
    }
    if (mark) { const bob = Math.sin(time * 4) * 2; g.font = `800 16px ${DISPLAY}`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText('!', cx, cy - 48 + bob); g.fillStyle = '#f5c542'; g.fillText('!', cx, cy - 48 + bob); }
  };
  HOOKS.draw.push((g, items, cam) => {
    const mark = anyReady();
    for (const [tx, ty] of BOARD_TILES) {
      if (tileAt(tx, ty) !== BOARD) continue;
      if (tx * TILE < cam.x - 80 || tx * TILE > cam.x + VW + 80 || ty * TILE < cam.y - 80 || ty * TILE > cam.y + VH + 80) continue;
      items.push({ y: ty * TILE + TILE - 6, draw: () => drawBoard(g, tx, ty, mark) });
    }
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 2, draw: () => {
      if (npcInFront()) return;
      const { tx, ty } = frontTile(player);
      if (tileAt(tx, ty) === BOARD) { HK.brackets(g, tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4); }
    } });
  });

  // ---------- quest tab ----------
  QUEST_DEFS.board = { name: 'Notice board' };
  HOOKS.activeQuests.push(() => openQuests().length ? ['board'] : []);
  HOOKS.questText.board = () => { const open = openQuests(); if (!open.length) return 'Take a job from the notice board in the square.'; const first = open.find(ready) || open[0]; return shortLine(first) + (ready(first) ? ' · hand in at the board' : '') + (open.length > 1 ? ` (+${open.length - 1} more)` : ''); };
  HOOKS.newGame.push(() => { quest.board = freshBoard(); lastFish = null; lastFireSet = null; });

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const ensureRoom = n => { for (let i = player.inv.length - 1; i >= 0 && player.inv.filter(s => !s).length < n; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour && !ITEMS[s.id].tool) player.inv[i] = null; } };
    const open = () => { openPanel('board'); render(); };
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
        h.peace(true); closePanel(); player.action = null; drops.length = 0; drain();
    quest.board = freshBoard(); lastFish = null; lastFireSet = null;
    ensureRoom(4); removeItem('potato', countItem('potato')); F.sim(2, []);
    // the board stands in the square and answers E
    { F.tp(112, 33); const w = F.walkTo(105, 28, 6000); F.face(105, 27); F.press('KeyE'); F.sim(2, []);
      check('board: notice board tile in the square (105,27) and by the cave road (24,6); E opens the panel', tileAt(105, 27) === BOARD && tileAt(24, 6) === BOARD && SOLID.has(BOARD) && typeof w === 'number' && panel === 'board', { w, panel, tile: tileAt(105, 27) }); }
    // take Greta's job
    { const greta = byId.greta; bq().page = pageOf(greta); render(); const took = F.clickButton('Take: Greta');
      check("board: 'Take: Greta' marks the job taken, the Notice board quest goes active with a progress line", took && isTaken(greta) && activeQuests().includes('board') && QUEST_DEFS.board.name === 'Notice board' && questText('board') === 'Greta: potatoes 0/10', { took, taken: !!bq().taken.greta, text: questText('board') }); }
    // hand-in refuses without potatoes; the toast fires once they are in the pack
    { render(); const refused = !F.clickButton('Hand in: Greta') && !bq().done.greta;
      h.give('potato', 4); F.sim(2, []); const partial = questText('board');
      notice = null; bq().toasted.greta = false; h.give('potato', 6); F.sim(2, []); const toast = notice && /Greta's potatoes ready to hand in/.test(notice.text);
      check('board: hand-in is refused without the potatoes; progress shows 4/10; a toast says when it is ready', refused && partial === 'Greta: potatoes 4/10' && !!toast, { refused, partial, notice: notice && notice.text }); }
    // hand in: potatoes out, coins + Farming xp in, job done
    { const c0 = coins(), fx0 = player.skills.farming.xp, p0 = countItem('potato'); drain(); open(); const clicked = F.clickButton('Hand in: Greta'); F.sim(2, []);
      check('board: handing in takes 10 potatoes and pays 60 coins + 80 Farming xp; the job is done and the quest tab clears', clicked && bq().done.greta && countItem('potato') === p0 - 10 && coins() === c0 + 60 && player.skills.farming.xp === fx0 + 80 && !activeQuests().includes('board') && dialog.cur && dialog.cur.who === 'Greta', { clicked, potatoes: countItem('potato'), coins: coins() - c0, xp: player.skills.farming.xp - fx0, who: dialog.cur && dialog.cur.who });
      render(); const again = F.clickButton('Hand in: Greta') || F.clickButton('Take: Greta'); check('board: a finished job cannot be taken or handed in twice', !again && bq().done.greta, { again }); }
    // kill counter: Goblin bounty
    { const q = byId.captain; bq().page = pageOf(q); open(); const took = F.clickButton('Take: Captain'); closePanel();
      const gob = monsters.find(m => m.type === 'goblin'); gob.dead = false; gob.hp = 1; gob.stunT = 0; gob.x = player.x + 40; gob.y = player.y; hitMonster(gob, 5, 0); F.sim(2, []);
      check('board: Goblin bounty counts goblin kills (1/10 after one goblin)', took && gob.dead && bq().goblins === 1 && progress(q) === 1 && /Captain: goblins 1\/10/.test(questText('board')), { took, dead: gob.dead, goblins: bq().goblins, text: questText('board') }); }
    // fire counter: light a fire on grass
    { const q = byId.wren; bq().page = pageOf(q); open(); const took = F.clickButton('Take: Wren'); closePanel();
      const o = h.openSpot(60, 24); F.tp(o.x, o.y); player.facing = { x: 1, y: 0 }; const tx = o.x + 1, ty = o.y; if (tileAt(tx, ty) !== T.GRASS) changeTile(tx, ty, T.GRASS); h.give('wood', 1);
      F.sim(1, []); const f0 = bq().fires; player.action = { type: 'light', t: 99, need: 1.5, tx, ty, log: 'wood', under: T.GRASS }; F.sim(2, []);
      check('board: Fires in the dark counts a fire the knight lights (1/5)', took && tileAt(tx, ty) === T.FIRE && bq().fires === f0 + 1 && progress(q) === 1, { took, tile: tileAt(tx, ty), fires: bq().fires }); }
    // best-hit job
    { const q = byId.hale; const hh = player.highestHit; player.highestHit = 0; bq().page = pageOf(q); open(); const took = F.clickButton('Take: Hale'); render(); const early = !F.clickButton('Hand in: Hale');
      player.highestHit = Math.max(8, hh); F.sim(2, []); const mx0 = player.skills.melee.xp; open(); const clicked = F.clickButton('Hand in: Hale'); F.sim(2, []);
      check("board: Hale's job needs a best hit of 8, then pays 200 Melee xp", took && early && clicked && bq().done.hale && player.skills.melee.xp === mx0 + 200, { took, early, clicked, xp: player.skills.melee.xp - mx0 }); closePanel(); }
    // fish counter: raw fish rising while fishing
    { const q = byId.cass; bq().page = pageOf(q); open(); const took = F.clickButton('Take: Cass'); closePanel(); ensureRoom(2);
      const w = F.nearestTile([T.WATER]) || { x: 43, y: 36 }; player.action = { type: 'fish', t: 0, need: 1.8, tx: w.x, ty: w.y }; const f0 = bq().fish;
      const steps = F.untilAction(2400, () => bq().fish > f0); player.action = null;
      check('board: Fish for the street counts fish caught with the rod', took && typeof steps === 'number' && bq().fish === f0 + 1 && progress(q) >= 1, { took, steps, fish: bq().fish }); }
    // paging
    { const pg = boardPages(), per = pg[0].length; const l2 = `Take: ${BOARD_QUESTS[pg[1][0]].tag}`, l1 = 'Take: Brakka';
      bq().page = 0; open(); const p0 = bq().page; const prevOff = !F.clickButton('Prev'); const next = F.clickButton('Next'); const p1 = bq().page; const onPage2 = !!buttons.find(b => b.label === l2); const prev = F.clickButton('Prev'); const p2 = bq().page; const onPage1 = !!buttons.find(b => b.label === l1);
      check('board: the jobs come a page at a time (as many whole cards as fit), Next and Prev turn the pages (Prev is off on the first page)', prevOff && next && p0 === 0 && p1 === 1 && onPage2 && prev && p2 === 0 && onPage1 && BOARD_QUESTS.length >= 12 && per >= 2 && pg.length >= 2, { p0, p1, p2, onPage2, onPage1, per, pages: pg.length, jobs: BOARD_QUESTS.length }); }
    // Rosalind's berry pies: three pies → 120 coins + 100 Cooking xp
    { const q = byId.pies; const ok = !!q && q.kind === 'item' && q.item === 'berry_pie' && q.n === 3 && q.reward.coins === 120 && q.reward.xp[0] === 'cooking' && q.reward.xp[1] === 100 && q.giver === 'Rosalind' && !!ITEMS.berry_pie;
      bq().page = pageOf(q); open(); const took = F.clickButton('Take: Pies'); closePanel(); ensureRoom(2); h.give('berry_pie', 3); F.sim(2, []);
      const c0 = coins(), x0 = player.skills.cooking.xp; drain(); open(); const clicked = F.clickButton('Hand in: Pies'); F.sim(2, []);
      check("board: Rosalind's berry pie job — 3 berry pies pay 120 coins + 100 Cooking xp", ok && took && clicked && bq().done.pies && countItem('berry_pie') === 0 && coins() === c0 + 120 && player.skills.cooking.xp === x0 + 100, { ok, took, clicked, coins: coins() - c0, xp: player.skills.cooking.xp - x0 }); closePanel(); }
    // several taken: the tracked line prefers a ready job and counts the rest
    { const open3 = openQuests(); const t = questText('board'); check('board: quest tab line shows one job with progress and how many more are taken', open3.length >= 3 && /^[A-Za-z]+: [a-z ]+ \d+\/\d+/.test(t) && new RegExp(`\\(\\+${open3.length - 1} more\\)`).test(t), { open: open3.map(q => q.id), text: t }); }
    closePanel(); player.action = null; drain(); h.peace(false); F.sim(2, []);
  });
}
