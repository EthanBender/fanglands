// ============================================================================
// HUD KIT — one grid, one container, one colour language, for the whole heads-up display.
//
// WHY. Before this file the HUD was nine islands: four container styles at five corner radii, colour used
// as decoration (an orange machine pill beside a blue drill pill, for two things that are not opposites),
// slabs sized to their own text so the shapes jittered as numbers ticked, and buttons that looked like
// labels. Every feature that wanted a chip invented one. This file is the single system they all draw
// through, and 10-hud plus the feature HOOKS.hud blocks were migrated onto it.
//
// THE RULES, in full, so a later feature can follow them without reading the code:
//
//   GRID.       One margin (M), one gutter (GUT), one row height (row()), one column width (colW()).
//               Everything in the left stack shares one left edge and one width — it is a column, not a pile
//               of content-sized boxes, so nothing changes shape as a number changes. Numbers live in fields
//               reserved from their widest possible value (fieldW()), never from today's. The column wraps
//               into a second one rather than running into the joystick or off the bottom of the screen.
//
//   CONTAINER.  One: plate(). A soft dark scrim with a hairline light edge, radius R, sitting ON the art
//               rather than punching a hole in it. The game is bright and painterly, so the plate is a
//               gradient of 0.78 → 0.66 alpha, not the old flat 0.95 black — as light as it can be and still
//               clear 4.5:1 for both text colours over the brightest ground the game paints. Item tiles
//               (the pack grid) are the one other shape, at R_SLOT, because a slot is not a container.
//
//   COLOUR.     Text is INK or DIM. Nothing else. Colour lives in FILLS — bar fills, the 3 px rule down a
//               chip's left edge, a control's tint — and it means exactly one thing everywhere:
//                 GOOD  green  — healthy, ready, safe
//                 WARN  amber  — watch this: getting low, winding up, counting down
//                 BAD   red    — danger: nearly dead, wanted, the roof is coming in, a boss is on you
//                 GOLD  gold   — the coin, and quest markers. A resource marker, never a state.
//                 (no tone)    — a neutral readout. Most chips are neutral. That is the point.
//               The old orange machine pill is now a health meter in the GOOD/WARN/BAD ramp (the machine's
//               hp IS your hp while you are in it); the old blue drill pill is now a neutral parts line,
//               because a fitted drill is a fact, not a warning.
//
//   PRESSABLE.  control() draws the SAME plate with light laid over it and a 1.5 px light edge round it.
//               Readouts never get that edge. The difference is shape and weight, not colour, so it reads
//               at arm's length on an iPad and it survives colour blindness. Controls are row() tall —
//               44 px on touch, always — and go through the core button() helper, so they stay tappable.
//
//   HIERARCHY.  First read: health, and being in danger — the status plate at top left, biggest bar on
//               screen. Second: coins, combat level, machine state — the plate's quiet second line and the
//               chips stacked under it. Rarely: menus, the book, the map, music — the control rail under
//               the minimap, off the main stack entirely.
//
// HOW TO USE IT from a feature file (all of these are safe to call inside a HOOKS.hud handler):
//   const s = HK.slot(HK.meterH());            // claim the next row of the left column → {x, y, w, h}
//   HK.plate(g, s.x, s.y, s.w, s.h);           // the one container
//   HK.meter(g, s.x, s.y, s.w, { label:'SERA', value:'42 / 60', frac:.7 });   // label / value / bar
//   HK.chip(g, x, y, w, h, { tone: HK.C.BAD }); // a plate with a meaning rule down its left edge
//   HK.control(g, x, y, w, h, 'LEAVE', fn, { tone: HK.C.BAD });               // a pressable
//   HK.disc(g, p.x, p.y, p.r, 'BOMB');         // a round pressable; HK.thumbSeat(n) gives it a seat
//   hudControl({ id:'wiki', sort:40, label:() => 'WIKI', action: fn, show: () => true });  // rail entry
// hudControl is a hoisted function declaration on purpose: files that load BEFORE this one (10-hud,
// 15-music, 43-settings, 44-wiki) call it at load time, so the rail's size is known on the very first frame.
//
// Registers nothing destructive: one HOOKS.hud entry (pushed last, so it draws the rail over everything
// else), one HOOKS.selfTest entry (the layout audit and the contrast proof).
// ============================================================================

// The control-rail registry. A hoisted declaration with its list on the function object, so it can be
// called from any file at load time without caring which order the files were concatenated in.
function hudControl(def) {
  const list = (hudControl.list = hudControl.list || []);
  const i = list.findIndex(d => d.id === def.id);
  if (i >= 0) list[i] = def; else list.push(def);
  list.sort((a, b) => (a.sort || 100) - (b.sort || 100) || a.id.localeCompare(b.id));
  return def;
}

// What to call the machine you are in. Hoisted for the same reason as hudControl: 22-bulldozer, 32-beast and
// 51-mounts register their names at load time, and the status plate reads them on the very first frame it
// draws (a HOOKS.hud handler would be one frame late, and the plate is drawn before the hooks run).
function hudMechName(fn) { (hudMechName.list = hudMechName.list || []).push(fn); return fn; }

const HK = (() => {
  // ---------- tokens ----------
  const M_ = 14;            // the one screen margin, and the left edge of the whole left column
  const GUT = 8;            // the one gutter, between plates and between fields
  const PAD = 12;           // the one inner padding
  const R = 10;             // the one container radius
  const R_SLOT = 6;         // item tiles only (the pack grid) — a slot is not a container

  const C = {
    INK: '#f2f6fa',                       // text: everything you actually read
    DIM: '#d3dce8',                       // text: labels, units, the quieter half of a pair
    RULE: 'rgba(214,226,240,0.16)',       // hairlines, never text
    GOOD: '#46c05a', WARN: '#e8a33d', BAD: '#f0524d', GOLD: '#f5c542',
    SCRIM_TOP: 'rgba(18,22,31,0.78)',     // the plate, top of its gradient
    SCRIM_BOT: 'rgba(12,15,22,0.66)',     // the plate, bottom (the worst case the contrast proof uses)
    EDGE: 'rgba(233,240,248,0.11)',       // the plate's quiet edge
    RAISE: 0.10,                          // a pressable: how much light is laid OVER the plate (never instead of it)
    RAISE_ON: 0.05,                       // a pressable that is currently on: pressed IN, not lit up
    CTRL_EDGE: 'rgba(233,240,248,0.38)',  // a pressable: the edge that says "press me"
    CTRL_ON_EDGE: 'rgba(242,246,250,0.80)', // a pressable that is on: the edge does the work, not more white
    CTRL_OFF_EDGE: 'rgba(160,172,188,0.20)',
    TRACK: 'rgba(4,7,12,0.55)',           // the empty half of any bar
  };
  const scrimAlpha = () => 0.66;          // the thinnest the plate ever gets; the contrast proof uses this

  const k = () => (window.SETTINGS && SETTINGS.textScale) ? SETTINGS.textScale() : 1;
  const touch = () => (typeof touchMode === 'function') ? touchMode() : isTouch;
  const narrow = () => VW < 640;
  const short = () => touch() && VH < 500;

  // one text line box, one bar height, one control height — the whole vertical rhythm
  const LINE = () => Math.round(15 * k());
  const BAR = () => Math.round(11 * k());
  const BAR_S = () => Math.round(8 * k());
  const row = () => touch() ? 44 : 32;                       // a control is finger-sized on touch, always
  const ctrlW = () => Math.round(colW() / 2);                // one width for every control on the left column
  const meterH = (small) => LINE() + 3 + (small ? BAR_S() : BAR());
  const chipH = () => Math.max(touch() ? (short() ? 28 : 32) : 26, LINE() + 10);
  const gutV = () => short() ? 6 : GUT;   // the gutter between stacked chips; a landscape phone gets the tight one

  // fonts — sans for data, the game's display serif for names
  const F = {
    label: () => `bold ${Math.round(11)}px sans-serif`,   // small caps label (scaled by SETTINGS)
    value: () => `bold 13px sans-serif`,
    body: () => `12px sans-serif`,
    ctrl: () => `bold 12px sans-serif`,
    name: () => `700 14px ${DISPLAY}`,
  };

  const mmSize = () => (narrow() || short()) ? 96 : 150;   // a landscape phone has no 150 px to spare
  const mmX = () => VW - mmSize() - M_;

  // The left column width. Fixed for the whole session at a given size, so a plate never resizes itself
  // around its text: the numbers move inside the plate, the plate does not move around the numbers.
  const colW = () => Math.round(clamp(VW - M_ * 2 - mmSize() - 12, 168, 264));
  // Where the thumb cluster starts across the screen. Settings › Move stick side mirrors it to the left,
  // which on a landscape phone is exactly where the HUD column lives — so there the columns shift right
  // past it. On a tall phone or a tablet the cluster is far below the column and nothing has to move.
  const mirrored = () => window.__stickRight === true;
  const clusterFrom = () => mirrored() ? 0 : VW - 194;
  const clusterTo = () => mirrored() ? 194 : VW;
  const colOrigin = () => (short() && mirrored()) ? clusterTo() + 16 : M_;
  const colX = col => colOrigin() + col * (colW() + GUT);

  // ---------- the one container ----------
  function plate(g, x, y, w, h, opt = {}) {
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, opt.top || C.SCRIM_TOP); grad.addColorStop(1, opt.bottom || C.SCRIM_BOT);
    roundRect(g, x, y, w, h, opt.r === undefined ? R : opt.r); g.fillStyle = grad; g.fill();
    g.strokeStyle = opt.edge || C.EDGE; g.lineWidth = 1; g.stroke();
    if (opt.tone) { // the meaning rule: 3 px down the left edge. Colour as a fill, never as text.
      g.save(); roundRect(g, x, y, w, h, opt.r === undefined ? R : opt.r); g.clip();
      g.fillStyle = opt.tone; g.fillRect(x, y, 3, h); g.restore();
    }
    return { x, y, w, h };
  }
  const chip = (g, x, y, w, h, opt = {}) => plate(g, x, y, w, h, opt);

  // ---------- the one pressable ----------
  // Draws through the core button() helper so the hit rect lands in `buttons` exactly like every other
  // control; the colour argument carries the tint and the kit repaints the plate over it.
  function control(g, x, y, w, h, label, action, opt = {}) {
    const on = !!opt.on, enabled = opt.enabled !== false;
    const tone = opt.tone || null;
    plate(g, x, y, w, h);                       // the same dark plate every readout gets…
    g.save(); roundRect(g, x, y, w, h, R); g.clip();
    if (enabled) { g.fillStyle = `rgba(233,240,248,${on ? C.RAISE_ON : C.RAISE})`; g.fillRect(x, y, w, h); } // …plus the raise that says "press me"
    if (tone && enabled) { g.globalAlpha = on ? 0.5 : 0.32; g.fillStyle = tone; g.fillRect(x, y, w, h); g.globalAlpha = 1; }
    g.restore();
    // the edge is what a pressable wears and a readout never does; "on" turns it up rather than adding light
    roundRect(g, x, y, w, h, R);
    g.strokeStyle = !enabled ? C.CTRL_OFF_EDGE : on ? C.CTRL_ON_EDGE : C.CTRL_EDGE; g.lineWidth = on ? 2 : 1.5; g.stroke();
    g.fillStyle = enabled ? C.INK : C.DIM; g.font = F.ctrl(); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, x + w / 2, y + h / 2 + 0.5); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    buttons.push(enabled ? { x, y, w, h, label: opt.hit || label, action } : { x, y, w, h, label: 'disabled:' + (opt.hit || label), action: () => { }, disabled: true });
  }

  // A round control: the thumb cluster (SWING, USE, BOMB…). Round because they are held-down actions rather
  // than menu entries — one deliberate second shape, and a whole class of control, not a one-off. Built from
  // exactly the same three layers as control() — scrim, raise, edge — so the contrast proof covers it, and so
  // it stops being a wash of white on white over bright grass.
  function disc(g, cx, cy, r, label, opt = {}) {
    const enabled = opt.enabled !== false, quiet = !!opt.quiet;
    g.beginPath(); g.arc(cx, cy, r, 0, 7);
    const grad = g.createRadialGradient(cx, cy - r * 0.4, r * 0.2, cx, cy, r);
    grad.addColorStop(0, C.SCRIM_TOP); grad.addColorStop(1, C.SCRIM_BOT);
    g.fillStyle = quiet ? 'rgba(12,15,22,0.42)' : grad; g.fill();
    if (enabled && !quiet) { g.fillStyle = `rgba(233,240,248,${C.RAISE})`; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }
    if (opt.tone && enabled) { g.save(); g.globalAlpha = 0.32; g.fillStyle = opt.tone; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.restore(); }
    g.beginPath(); g.arc(cx, cy, r, 0, 7);
    g.strokeStyle = quiet ? C.EDGE : enabled ? C.CTRL_EDGE : C.CTRL_OFF_EDGE; g.lineWidth = 1.5; g.stroke();
    if (label) { g.fillStyle = quiet ? 'rgba(233,240,248,0.55)' : enabled ? C.INK : C.DIM; g.font = F.ctrl(); g.textAlign = 'center'; g.fillText(label, cx, cy + 4); g.textAlign = 'left'; }
  }

  // THE THUMB CLUSTER, as a grid. Six numbered seats in a staggered arc up from the corner, mirrored by
  // Settings › Move stick side. Features ask for a seat by number instead of inventing coordinates — which is
  // how BLOCK ended up at (VW-250, VH-134), a third column that lands on top of the joystick on a 390 px phone.
  //   0 the big one (SWING)   1 USE   2 CRAFT / EXIT   3 QUESTS   4 HOME / BOMB   5 BLOCK
  const THUMB = [[70, 100, 70], [160, 66, 52], [160, 160, 52], [70, 200, 52], [160, 254, 52], [70, 294, 52]];
  function thumbSeat(i) {
    const [dx, dy, r] = THUMB[clamp(i, 0, THUMB.length - 1)];
    const x = window.__stickRight === true ? dx : VW - dx;
    return { x, y: VH - dy, r: r / 2 + 8 };
  }

  // ---------- fields: a number lives in the width of its biggest possible self, so nothing jitters ----------
  function fieldW(g, template, font) { const f = g.font; g.font = font || F.value(); const w = Math.ceil(g.measureText(template).width); g.font = f; return w; }
  function field(g, text, rightX, y, opt = {}) {
    g.font = opt.font || F.value(); g.fillStyle = opt.colour || C.INK; g.textAlign = 'right';
    g.fillText(text, rightX, y); g.textAlign = 'left';
  }

  // ---------- the one bar ----------
  function bar(g, x, y, w, h, frac, tone) {
    roundRect(g, x, y, w, h, h / 2); g.fillStyle = C.TRACK; g.fill();
    const f = clamp(frac, 0, 1);
    if (f > 0) { roundRect(g, x, y, Math.max(h, w * f), h, h / 2); g.fillStyle = tone || C.GOOD; g.fill(); }
  }
  // health-shaped ramp: the same three steps everywhere in the game
  const ramp = f => f > 0.5 ? C.GOOD : f > 0.25 ? C.WARN : C.BAD;

  // Reads a legacy button colour as one of the four meanings. Thirty-odd hand-picked hex codes were passed
  // to button() across the codebase; rather than edit every call site, the kit reads the INTENT out of the
  // colour (a saturated green means go, a saturated red means danger, a bright amber means wait) and paints
  // the one tone that means that. Anything unsaturated, blue, purple or brown is a neutral control — which
  // is how the decorative blues and purples stopped being colours that meant nothing.
  function toneOf(col) {
    const c = hex(col); if (!c) return null;
    const [r, gg, b] = c, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    if (mx - mn < 40) return null;                                        // grey: a neutral control
    if (gg > 110 && gg > r * 1.15 && gg > b * 1.15) return C.GOOD;
    if (r > 110 && r > gg * 1.6 && r > b * 1.4) return C.BAD;
    if (gg > 110 && r >= gg && r > b * 1.5 && gg > b * 1.3) return C.WARN;
    return null;
  }

  // ---------- the one label / value / bar block ----------
  // { label, value, frac, tone, small, template } — template is the widest the value can ever be.
  function meter(g, x, y, w, o) {
    const line = LINE(), bh = o.small ? BAR_S() : BAR();
    g.font = F.label(); g.fillStyle = C.DIM; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const base = y + line - 3;
    let lw = w;
    if (o.value) { const rw = fieldW(g, o.template || o.value, F.value()); field(g, o.value, x + w, base, { colour: o.valueColour || C.INK }); lw = w - rw - GUT; }
    let t = o.label; g.font = F.label();
    while (t.length > 3 && g.measureText(t).width > lw) t = t.slice(0, -1);
    g.fillText(t, x, base);
    bar(g, x, y + line + 3, w, bh, o.frac === undefined ? 1 : o.frac, o.tone || ramp(o.frac === undefined ? 1 : o.frac));
    return line + 3 + bh;
  }

  // ---------- a one-line readout row: pairs of [label, value] laid out on the grid ----------
  function readout(g, x, y, w, cells) {
    const line = LINE(), base = y + line - 3, n = cells.filter(Boolean).length;
    if (!n) return 0;
    const cw = Math.floor((w - GUT * (n - 1)) / n);
    let cx = x;
    for (const c of cells) {
      if (!c) continue;
      let tx = cx;
      if (c.icon) { drawItemIcon(g, c.icon, cx + 7, base - 4, 14); tx = cx + 18; }
      if (c.label) { g.font = F.label(); g.fillStyle = C.DIM; g.textAlign = 'left'; g.fillText(c.label, tx, base); tx += Math.ceil(g.measureText(c.label).width) + 6; }
      g.font = F.value(); g.fillStyle = C.INK; g.textAlign = 'left'; g.fillText(c.value, tx, base);
      cx += cw + GUT;
    }
    return line;
  }

  // ---------- the left column: one cursor, one left edge, one width ----------
  // Every feature chip claims its row here instead of guessing a y. Keeps the old HUD.leftY contract.
  function stackFloor() {
    const lay = typeof HUD_LAYOUT !== 'undefined' ? HUD_LAYOUT : null;
    let f = 0;
    if (touch() && lay && !lay.short) f = Math.max(f, lay.hotbarY + lay.hotbarH + 12); // clear of the touch hotbar
    return f;
  }
  // How far down a column may run before it has to wrap. On touch, column 0 stops short of the joystick — a
  // control sitting in the stick's circle is a control you cannot press and a stick you cannot start.
  const stickTop = () => VH - 176;
  function colLimit(col) {
    if (!touch()) return VH - 30;
    if (col === 0) return stickTop() - 4;
    return short() ? VH - 66 : VH - 20;      // a landscape phone's hotbar runs along the bottom of column 1
  }
  // Room for a second column only where the screen is wide enough to hold two full columns and both margins.
  const canWrap = () => VW - colOrigin() >= M_ + colW() * 2 + GUT;
  const colTop = col => col === 0 ? M_ + statusH() + GUT : (typeof HUD_LAYOUT !== 'undefined' && HUD_LAYOUT.col2Top) || M_;
  function slot(h) {
    let col = HUD.leftCol || 0;
    let y = Math.max(HUD.leftY, col === 0 ? stackFloor() : 0);
    if (y + h > colLimit(col) && canWrap() && col < 1) { col = 1; y = colTop(col); HUD.leftCol = col; }
    HUD.leftY = y + h + gutV();
    return { x: colX(col), y, w: colW(), h };
  }

  // ---------- the control rail: everything he needs rarely, in one place under the minimap ----------
  const railCells = () => {
    const list = (hudControl.list || []).filter(d => { try { return d.show ? d.show() : true; } catch (e) { return false; } });
    if (!list.length) return null;
    // Under the minimap. On a narrow phone the status plate reaches nearly the full column width, so the
    // rail also has to clear it (the sun dial from 35-night sits at +18 on wider screens, hence the +44).
    // On a landscape phone the whole right-hand edge under the minimap is thumb cluster, so the rail moves
    // into the second column instead, under the quest and notice slots.
    const cw = touch() ? 74 : 84, ch = row(), sh = short();
    const y0 = sh ? M_ + 54 + GUT + 32 + GUT
      : touch() && narrow() ? Math.max(M_ + mmSize() + 16, M_ + statusH() + GUT)
        : M_ + mmSize() + 44;
    // never let the rail wander into the left column (except on a narrow phone, where the column starts
    // far below the rail and the full width is free)
    const maxW = sh ? Math.max(cw, Math.min(mmX(), mirrored() ? VW : clusterFrom()) - colX(1) - 12)   // clear of the minimap AND the thumb cluster
      : narrow() ? VW - M_ * 2 : VW - M_ * 2 - colW() - GUT;
    const cols = Math.max(1, Math.min(list.length, Math.floor((maxW + GUT) / (cw + GUT))));
    const rows = Math.ceil(list.length / cols);
    const cells = [];
    list.forEach((d, i) => {
      const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, list.length - r * cols);
      const rowW = inRow * cw + (inRow - 1) * GUT;
      const x0 = sh ? colX(1) : VW - M_ - rowW;   // left-aligned in the second column, else right-aligned
      cells.push({ def: d, x: Math.round(x0 + c * (cw + GUT)), y: y0 + r * (ch + GUT), w: cw, h: ch });
    });
    return { cells, y0, bottom: y0 + rows * ch + (rows - 1) * GUT, cols, rows };
  };
  function drawRail(g) {
    const r = railCells(); if (!r) return;
    for (const c of r.cells) {
      const d = c.def;
      let label = d.label; try { if (typeof label === 'function') label = label(); } catch (e) { label = d.id.toUpperCase(); }
      let on = false; try { on = d.on ? !!d.on() : false; } catch (e) { on = false; }
      control(g, c.x, c.y, c.w, c.h, label, d.action, { on, tone: d.tone || null });
    }
  }
  const railBottom = () => { const r = railCells(); return r ? r.bottom : M_ + mmSize() + 16; };

  // ---------- the status plate: health first, everything else quieter ----------
  // Drawn by 10-hud at the top of the HUD. Returns its bottom edge.
  // Whichever machine you are in names itself through hudMechName(); the core's generic one is a Walker.
  const mechLabel = () => {
    if (!player.mech) return null;
    for (const f of (hudMechName.list || [])) { let n = null; try { n = f(); } catch (e) { n = null; } if (n) return n; }
    return 'Walker';
  };
  const statusPad = () => short() ? 9 : PAD;
  const statusH = () => statusPad() * 2 + meterH() + (mechLabel() ? GUT + meterH(true) : 0) + GUT + LINE();
  function status(g) {
    const w = colW(), x = colX(0), y = M_;
    const machine = mechLabel();
    const pad = statusPad();
    const h = statusH();
    plate(g, x, y, w, h);
    let cy = y + pad;
    const hf = clamp(player.hp / player.maxHp, 0, 1);
    cy += meter(g, x + pad, cy, w - pad * 2, { label: 'HEALTH', value: `${Math.ceil(player.hp)} / ${player.maxHp}`, template: `${player.maxHp} / ${player.maxHp}`, frac: hf });
    if (machine) {
      cy += GUT;
      const mf = clamp(player.mech.hp / player.mech.maxHp, 0, 1);
      cy += meter(g, x + pad, cy, w - pad * 2, { label: machine.toUpperCase(), value: `${Math.ceil(player.mech.hp)} / ${player.mech.maxHp}`, template: `${player.mech.maxHp} / ${player.mech.maxHp}`, frac: mf, small: true });
    }
    cy += GUT;
    readout(g, x + pad, cy, w - pad * 2, [
      { icon: 'coins', value: `${coins()}` },
      { label: 'COMBAT', value: `${combatLevel()}` },
      window.__kidmode ? { label: 'KID', value: 'ON' } : null,
    ]);
    return y + h;
  }

  // ---------- the pause menu box, on the grid ----------
  // Exported rather than hardcoded because two files draw into it: 10-hud draws the menu, 31-rebuild
  // repaints the stats line with the town's name in front of it. That line used to be the magic number
  // VH/2 + 83 in both files; now both ask for statsY, so a finger-sized button row cannot break it.
  function pauseBox() {
    const bh = row(), step = bh + 6, nRows = 3 + HOOKS.pauseMenu.length; // Resume, Settings, features…, New game
    const pw = 300, head = 66, foot = 70;
    const ph = Math.min(VH - 20, head + nRows * step - 6 + 12 + foot);
    const px = Math.round(VW / 2 - pw / 2), py = Math.round(clamp(VH / 2 - ph / 2, 10, Math.max(10, VH - ph - 10)));
    return { px, py, pw, ph, bh, step, firstY: py + head, statsY: py + head + nRows * step - 6 + 24 };
  }

  // ---------- self-test helpers: real contrast maths, not a vibe ----------
  const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const lin = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const lum = rgb => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const contrast = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); };
  const over = (fg, alpha, bg) => [0, 1, 2].map(i => fg[i] * alpha + bg[i] * (1 - alpha)); // src-over composite
  // Every ground colour the game paints, taken from the game's own minimap palette (03-textures MINI, plus
  // whatever feature files added with addTile), and the two lightest grains any texture paints, so a new
  // bright tile automatically tightens the proof instead of silently loosening it.
  function grounds() {
    const out = [];
    for (const t in MINI) { const c = hex(MINI[t]); if (c) out.push({ c, name: MINI[t] }); }
    for (const extra of ['#e6d79d', '#d4b078']) out.push({ c: hex(extra), name: extra + ' (texture grain)' }); // 03-textures: sand grain, floorboard
    return out;
  }

  const API = {
    M: () => M_, GUT, PAD, R, R_SLOT, C, F,
    k, touch, narrow, short, LINE, BAR, BAR_S, row, ctrlW, meterH, chipH, gutV, colW, colX, colOrigin, mirrored, clusterFrom, mmSize, mmX, stickTop, colLimit, canWrap,
    plate, chip, control, disc, thumbSeat, bar, ramp, toneOf, meter, readout, field, fieldW, slot, stackFloor,
    status, statusH, mechLabel, drawRail, railBottom, railCells, pauseBox,
    // colour maths, exported so any file can prove its own text instead of guessing
    hex, lum, contrast, over, grounds, scrimAlpha,
  };
  return API;
})();
window.HK = HK;

// The rail draws last, over every feature chip, so nothing can be drawn on top of a control. Nothing while
// the pause menu is up: that block clears the button list, so a rail drawn under it would be a row of
// controls that look pressable and are not (anything that must be live while paused goes through
// HOOKS.pauseMenu instead).
HOOKS.hud.push(g => { if (paused) return; if (typeof title !== 'undefined' && title && title.active) return; HK.drawRail(g); });

// ============================================================================
// SELF-TEST — the layout audit and the contrast proof
// ============================================================================
HOOKS.selfTest.push((check, F, h) => {
  const P = 'hudkit: ';
  const prevTouch = window.__forceTouch, dc = dialog.cur, dq = dialog.queue.slice();
  const own = kk => Object.getOwnPropertyDescriptor(window, kk);
  const savedSize = { w: own('innerWidth'), h: own('innerHeight') };
  const savedText = window.SETTINGS ? SETTINGS.get('text') : 'normal';
  const m0 = player.mech, c0 = player.companion ? JSON.parse(JSON.stringify(player.companion)) : null;
  const mon0 = monsters.slice(), px0 = player.x, py0 = player.y, paused0 = paused, panel0 = panel;
  dialog.cur = null; dialog.queue.length = 0; closePanel(); paused = false;

  // ---------- 1. the colour language is a small, named, closed set ----------
  {
    const need = ['INK', 'DIM', 'GOOD', 'WARN', 'BAD', 'GOLD'];
    const named = need.every(n => /^#[0-9a-f]{6}$/i.test(HK.C[n]));
    const distinct = new Set(need.map(n => HK.C[n].toLowerCase())).size === need.length;
    const rampOk = HK.ramp(1) === HK.C.GOOD && HK.ramp(0.4) === HK.C.WARN && HK.ramp(0.1) === HK.C.BAD && HK.ramp(0.5) === HK.C.WARN && HK.ramp(0.51) === HK.C.GOOD;
    check(P + 'one colour language: six named colours, all distinct, and one health ramp (green > 50%, amber > 25%, red below)', named && distinct && rampOk, { named, distinct, rampOk, ramp: [HK.ramp(1), HK.ramp(0.4), HK.ramp(0.1)] });
  }

  // ---------- 2. contrast: every text style, over the lightest and darkest ground the game draws ----------
  const contrastReport = {};
  {
    const gs = HK.grounds();
    let lightest = gs[0], darkest = gs[0];
    for (const q of gs) { if (HK.lum(q.c) > HK.lum(lightest.c)) lightest = q; if (HK.lum(q.c) < HK.lum(darkest.c)) darkest = q; }
    // the worst case: the thinnest the plate ever gets (the bottom of its gradient) over the brightest ground
    const a = HK.scrimAlpha(), scrim = [12, 15, 22];
    const styles = { INK: HK.C.INK, DIM: HK.C.DIM };
    const worst = [];
    for (const [name, col] of Object.entries(styles)) {
      for (const ground of [lightest, darkest]) {
        const plate = HK.over(scrim, a, ground.c);
        const r = HK.contrast(HK.hex(col), plate);
        contrastReport[name + ' on ' + (ground === lightest ? 'lightest' : 'darkest') + ' ' + ground.name] = Math.round(r * 100) / 100;
        if (r < 4.5) worst.push(`${name} over ${ground.name} = ${r.toFixed(2)}`);
      }
    }
    // a control's label sits on the raised fill, which is LIGHTER than the plate — check it too
    for (const ground of [lightest, darkest]) {
      const plate = HK.over(scrim, a, ground.c);
      const ctrl = HK.over([233, 240, 248], HK.C.RAISE, plate); // a control is the plate plus its raise
      const r = HK.contrast(HK.hex(HK.C.INK), ctrl);
      contrastReport['control label on ' + (ground === lightest ? 'lightest' : 'darkest')] = Math.round(r * 100) / 100;
      if (r < 4.5) worst.push(`control label over ${ground.name} = ${r.toFixed(2)}`);
    }
    check(P + 'every text colour clears 4.5:1 against the plate over the lightest and the darkest ground the game paints', worst.length === 0, { worst, lightest: lightest.name, darkest: darkest.name, ...contrastReport });
  }

  // ---------- 3. the layout audit: 4 viewports x 2 text sizes x touch/desktop x 4 scenes ----------
  {
    const problems = [];
    const setSize = (w, hh) => { try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { } render(); return VW === w && VH === hh; };
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const inside = r => r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= VW + 0.5 && r.y + r.h <= VH + 0.5;
    // the minimap is a tap target that never goes through button() (05-input matches it separately), so the
    // audit has to know about it — the thumb cluster used to overlap it on a landscape phone unnoticed
    const live = () => {
      const out = buttons.filter(b => !b.offscreen && b.w > 0 && b.h > 0);
      if (minimapRect) out.push({ ...minimapRect, label: 'minimap' });
      return out;
    };
    // The circle the idle joystick is actually drawn in (10-hud paints it at 110, VH-110 with r 60, mirrored
    // by Settings › Move stick side). A control drawn on top of that is a control you cannot press and a
    // stick you cannot see, because 05-input matches the button list before it starts the stick. The wider
    // joystickZone() rectangle is a tap-to-walk rule, not a keep-out: on a 390 px phone the thumb cluster
    // necessarily reaches into it, and that has always been fine.
    const stickBox = () => {
      const cx = window.__stickRight === true ? VW - 110 : 110;
      return { x: cx - 60, y: VH - 170, w: 120, h: 120, label: 'the joystick' };
    };
    const boss = () => { // a real boss bar: the biggest monster the game knows, standing on the knight
      const type = Object.keys(MONSTER_DEFS).find(t => t !== 'the_fang' && MONSTER_DEFS[t].level >= 25 && MONSTER_DEFS[t].hp >= 300);
      if (!type) return false;
      const d = MONSTER_DEFS[type];
      monsters.length = 0;
      monsters.push({ // the same shape spawnMonsters() builds (04-state), so it draws as well as it reads
        type, x: player.x + 40, y: player.y, home: { x: player.x + 40, y: player.y },
        r: d.r, hp: d.hp * 0.6, maxHp: d.hp, speed: d.speed, angry: false, state: 'idle', wanderT: 9,
        wander: { x: 0, y: 0 }, attackCd: 9, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0,
      });
      return true;
    };
    let tried = 0;
    for (const [w, hh] of [[390, 844], [844, 390], [768, 1024], [1280, 800]]) {
      if (!setSize(w, hh)) continue; tried++;
      for (const t of [true, false]) {
        window.__forceTouch = t;
        for (const big of ['normal', 'large']) {
          if (window.SETTINGS) SETTINGS.set('text', big);
          for (const scene of ['plain', 'inventory', 'boss', 'machine', 'plain-righthanded']) {
            monsters.length = 0; player.mech = null; player.companion = c0 ? JSON.parse(JSON.stringify(c0)) : null; closePanel();
            window.__stickRight = scene === 'plain-righthanded';   // Settings › Move stick side mirrors the thumb cluster
            if (scene === 'inventory') { player.inv[0] = player.inv[0] || { id: 'bread', qty: 1 }; openPanel('inventory'); selectedSlot = 0; }
            if (scene === 'boss' && !boss()) continue;
            if (scene === 'machine') { player.mech = { kind: 'dozer', hp: 74, maxHp: 110 }; player.companion = { id: 'sera', hp: 44, maxHp: 60, mode: 'follow', x: player.x, y: player.y, downT: 0, freed: { sera: true } }; }
            render();
            const where = `${w}x${hh} ${t ? 'touch' : 'desktop'} ${big} ${scene}`;
            let rects = live();
            if (scene === 'inventory') { // a panel shadows the HUD under it by design; audit the panel's own controls
              const ci = rects.findIndex(b => b.label === '×');
              if (ci < 0) problems.push(where + ': the pack has no close button');
              else rects = rects.slice(ci);
              if (panelRect && !inside(panelRect)) problems.push(`${where}: the pack box is off-screen ${JSON.stringify(panelRect)}`);
            }
            for (const r of rects) if (!inside(r)) problems.push(`${where}: ${r.label} off-screen ${JSON.stringify([Math.round(r.x), Math.round(r.y), r.w, r.h])}`);
            for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (overlap(rects[i], rects[j])) problems.push(`${where}: ${rects[i].label} × ${rects[j].label}`);
            // a ten-year-old's finger: 44 x 44, every control, on touch. On desktop a mouse is precise, so
            // the floor is the kit's desktop row height.
            const floor = t ? 44 : 26;
            for (const r of rects) if (!/^slot\d+|^bank\d+|^hot\d+|^eq/.test(r.label) && (r.w < floor - 0.5 || r.h < floor - 0.5)) problems.push(`${where}: ${r.label} is ${Math.round(r.w)}x${Math.round(r.h)}, under ${floor}`);
            for (const r of rects) if (/^slot\d+|^bank\d+|^hot\d+|^eq/.test(r.label) && t && (r.w < 40 || r.h < 40)) problems.push(`${where}: item tile ${r.label} is ${Math.round(r.w)}x${Math.round(r.h)}`);
            // nothing pressable in the joystick's circle (the thumb cluster is the deliberate exception:
            // it is mirrored to the far side by the same setting, so it is never in the live stick zone)
            if (t && scene !== 'inventory') { const sb = stickBox(); for (const r of rects) if (overlap(r, sb)) problems.push(`${where}: ${r.label} is inside the joystick`); }
          }
        }
      }
    }
    window.__forceTouch = prevTouch; window.__stickRight = window.SETTINGS ? SETTINGS.get('stick') === 'right' : false;
    if (window.SETTINGS) SETTINGS.set('text', savedText);
    monsters.length = 0; for (const m of mon0) monsters.push(m);
    player.mech = m0; player.companion = c0; player.x = px0; player.y = py0; closePanel(); selectedSlot = -1;
    if (savedSize.w) { Object.defineProperty(window, 'innerWidth', savedSize.w); Object.defineProperty(window, 'innerHeight', savedSize.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } }
    paused = paused0; if (panel0) openPanel(panel0); render();
    check(P + 'layout audit: 390x844, 844x390, 768x1024 and 1280x800, touch and desktop, normal and large text, with no panel / the pack open / a boss bar up / driving a machine with a companion — no control overlaps another, none falls off screen, and every touch control is at least 44x44', tried === 4 && problems.length === 0, { tried, problems: problems.slice(0, 10), total: problems.length });
  }

  // ---------- 4. the grid is real: one left edge, one width, no content-sized plates ----------
  {
    HUD.leftY = 82;
    const a = HK.slot(HK.meterH()), b = HK.slot(HK.chipH()), c = HK.slot(HK.chipH());
    const sameEdge = a.x === b.x && b.x === c.x && a.x === HK.M();
    const sameWidth = a.w === b.w && b.w === c.w && a.w === HK.colW();
    const gutters = (b.y - (a.y + a.h)) === HK.GUT && (c.y - (b.y + b.h)) === HK.GUT;
    HUD.leftY = 82;
    check(P + 'the left column is a grid: every chip shares one left edge and one width, separated by one gutter', sameEdge && sameWidth && gutters, { x: [a.x, b.x, c.x], w: [a.w, b.w, c.w], gutters, M: HK.M(), colW: HK.colW() });
  }

  // ---------- 5. numbers sit in fields reserved from their widest value, so nothing jitters ----------
  {
    const g = ctx;
    const w1 = HK.fieldW(g, '9 / 110'), w2 = HK.fieldW(g, '110 / 110');
    // the kit always measures the template (max/max), never the live value, so the reserved width is the
    // same at 9 hp as at 110 hp — that is what stops the plate twitching as the number ticks
    const stable = HK.fieldW(g, '110 / 110') === w2 && w2 >= w1;
    check(P + 'a changing number is drawn in a field reserved from its widest possible value', stable, { atNine: w1, atMax: w2 });
  }

  // ---------- 6. the rail is one place, and it holds the rarely-used controls ----------
  {
    render();
    const ids = (hudControl.list || []).map(d => d.id);
    const cells = HK.railCells();
    const wanted = ['wiki'];
    const has = wanted.every(idw => ids.includes(idw));
    const laidOut = !!cells && cells.cells.length > 0 && cells.cells.every(c => c.w >= (HK.touch() ? 44 : 26) && c.h >= (HK.touch() ? 44 : 26));
    check(P + 'the rarely-used controls (the book, the map, music, the menus) live in one rail under the minimap, not bolted on wherever there was room', has && laidOut, { ids, cells: cells && cells.cells.length, cols: cells && cells.cols });
  }

  dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq);
  window.__forceTouch = prevTouch; paused = paused0;
  window.__HK_CONTRAST = contrastReport; // read by the build notes / console
});
