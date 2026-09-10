// ============================================================================
// ITEM ICONS — one drawing per item, rarity tiers with a halo, and the audit that proves it
// src/80-icons.js. Feature file: registers through HOOKS and by wrapping, edits no core file.
//
// Cohen's dad's ask: "Many items use the same graphic, and it doesn't make any sense... Every item should be
// unique, and bonus points if you put a coloured halo on rares and uniques." A shrimp and a shark were the same
// picture; dragon scale drew as a shield, dragon dung as a rock, the blueprints as planks.
//
// BASELINE, measured by ICONS.audit() on master: 170 items, 46 distinct drawings, 152 items sharing one with
// something else, in 28 groups. (Counting by ITEMS.shape alone says 158; six of those are not really duplicates —
// iron ore gets its own ore flecks inside the rock case, and a few items whose own colour happens to match a
// hard-coded accent paint a different sequence. The recorder counts what is actually painted, so 152 is the
// number to beat and ICONS.audit().implicated is the live figure.)
//
// THREE THINGS LIVE HERE
//   1. window.ICONS.set(id, fn) — a per-item drawing registry. A registered icon wins; an unregistered item
//      still falls through to the core shape switch in src/08-draw.js, unchanged.
//   2. window.ICONS.rarity(id) — five tiers worked out from the live tables (drop tables, shop stock, recipes,
//      gathering, cooking), with value as the tiebreak. Rare and better get a coloured halo behind the icon.
//   3. window.ICONS.audit() — draws every item into a recording context, hashes the call sequence, and reports
//      which items still draw the same thing. A self-test FAILS while any two match.
//
// ---------------------------------------------------------------------------
// HOW TO DRAW AN ICON (for the artists who come after this file)
// ---------------------------------------------------------------------------
//   ICONS.set('my_item', (g, size, item) => { ...draw around 0,0... });
//
//   * The canvas is already translated to the icon's centre and scaled for you. Never call translate/scale
//     to place your icon — draw straight into the design box and the wrapper puts it where it belongs.
//   * The design box is 18 units across, the same box the core icons in src/08-draw.js use, so you can lift
//     an existing shape and edit it. Draw inside -9..+9 (ICONS.SAFE); -11..+11 (ICONS.BOUND) is the hard
//     limit and the self-test fails past it. On screen that box is `size` pixels across.
//   * g.fillStyle is already the item's colour, g.strokeStyle is the house outline rgba(0,0,0,0.45) and
//     g.lineWidth is 1.2 — the same defaults the core shapes start from.
//   * MINIMUM FEATURE SIZE IS 2 UNITS (ICONS.MIN_FEATURE). The hotbar draws icons at 13 px, so one design
//     unit is 0.72 px there: anything under 2 units across vanishes. Circles need radius >= 1, rectangles
//     need their short side >= 2, and lineWidth must be >= 1 (ICONS.MIN_LINE). The self-test checks all three.
//   * `size` is the real pixel size, passed only so you can decide how much detail is worth drawing.
//     `item` is the ITEMS entry (name, colour, value, weapon/armour...).
//   * The halo is drawn for you, behind your icon. Do not draw one yourself.
//   * Two items must never draw the same call sequence with the same relative palette. Recolouring is not a
//     drawing: a shrimp and a shark need different silhouettes, not different greens.
//
// WHAT THE AUDIT ACTUALLY COMPARES
//   Every canvas call and every colour set is logged. Colours are recorded by their position in the icon's
//   own palette (first colour used is c0, second c1...), not by their hex, so "the same picture in another
//   colour" hashes the same and is reported as a duplicate. That is the owner's complaint, made mechanical.
//   The halo is never recorded: a rarity glow must not be what makes an icon count as unique. An icon that
//   throws is caught, falls back to the shape switch so the HUD survives, and is named by ICONS.broken().
// ============================================================================
{
  const UNIT = 18;          // design box: 18 units maps to `size` pixels (matches the core icons)
  const BOUND = 11;         // hard limit — nothing may be drawn outside this
  const SAFE = 9;           // recommended reach
  const MIN_FEATURE = 2;    // smallest feature that survives a 13 px hotbar slot (2 units = 1.44 px there)
  const MIN_LINE = 1;       // smallest lineWidth that survives it

  const REG = Object.create(null);   // id -> (g, size, item) => {}
  let haloOn = true;                 // the audit turns this off: a halo must never make an icon look unique
  const BROKEN = new Map();          // id -> the error a registered icon threw, so the audit can name it

  // ---------- rarity tiers ----------
  // Plain words. Only rare and better carry a halo; the glow says the tier, the ring keeps it readable on a
  // bright panel (a light glow alone disappears on white, a dark ring alone disappears on the dark pack grid).
  const TIERS = {
    common: { key: 'common', name: 'Common', order: 0, glow: null, ring: null, strength: 0 },
    uncommon: { key: 'uncommon', name: 'Uncommon', order: 1, glow: null, ring: null, strength: 0 },
    rare: { key: 'rare', name: 'Rare', order: 2, glow: '#58a6ff', ring: '#1f6feb', strength: 0.3 },
    epic: { key: 'epic', name: 'Epic', order: 3, glow: '#b58cff', ring: '#7b3fe4', strength: 0.44 },
    unique: { key: 'unique', name: 'Unique', order: 4, glow: '#f5c542', ring: '#a9750a', strength: 0.6 },
  };
  const TIER_ORDER = ['common', 'uncommon', 'rare', 'epic', 'unique'];

  // The exact odds rollDrops rolls at, the same maths src/44-wiki.js prints: always 100%, one row of the
  // weighted table by weight, the rare table one time in `chance` and then by weight. Plus the two feature
  // tables that live in closures and expose themselves on window (40-dozerup blueprints, 37-dragonkillers).
  function dropRows(type, def) {
    const d = (def && def.drops) || {}, rows = [];
    for (const r of d.always || []) if (ITEMS[r[0]]) rows.push({ id: r[0], pct: 100 });
    if (d.table && d.table.length) { const tot = d.table.reduce((s, r) => s + r[3], 0) || 1; for (const r of d.table) if (ITEMS[r[0]]) rows.push({ id: r[0], pct: r[3] / tot * 100 }); }
    if (d.rare && d.rare.table && d.rare.table.length) { const tot = d.rare.table.reduce((s, r) => s + r[3], 0) || 1; for (const r of d.rare.table) if (ITEMS[r[0]]) rows.push({ id: r[0], pct: 100 / d.rare.chance * (r[3] / tot) }); }
    const bp = window.DOZERUP && DOZERUP.BLUEPRINT_DROPS && DOZERUP.BLUEPRINT_DROPS[type];
    if (bp && bp.pool) for (const id of bp.pool) if (ITEMS[id]) rows.push({ id, pct: 100 / bp.chance / bp.pool.length });
    const dk = window.DRAGON_KILLERS && typeof DRAGON_KILLERS.chance === 'function' ? DRAGON_KILLERS.chance(type) : 0;
    if (dk > 0) for (const id of DRAGON_KILLERS.DRAGON_ITEMS) if (ITEMS[id]) rows.push({ id, pct: dk * 100 / DRAGON_KILLERS.DRAGON_ITEMS.length });
    return rows;
  }

  // Gathering that lives inside a feature file's own HOOKS.use closure, with the file it comes from. The wiki
  // keeps the same list for the same reason (see GATHER_EXTRA in src/44-wiki.js): these tiles are picked and
  // mined by code, not by a table anything else can read. Level is the skill gate that makes it rarer.
  const GATHER_IN_CLOSURES = [
    ['jungle_log', 15],       // 25-elves: chop a jungle tree, Woodcutting 15
    ['mithril_ore', 20],      // 24-dwarves: mine a mithril rock in Deepholm, Mining 20
    ['obsidian', 28],         // 27-dragons: mine obsidian in the Ashfields, Mining 28
    ['berries', 1],           // 34-food: pick a berry bush, no tool, it grows back
    ['raw_lobster', 25],      // 26-boats: lower a lobster pot at the buoys off Gull Isle, Fishing 25
    ['cloud_essence', 1],     // 36-skycity: pick a wisp of cloud in Aerie, they grow back
    ['burnt_food', 1],        // 06-systems: cook something badly. Every young cook has a pile of it
  ];

  // How much of each item the game actually hands out, read off the live tables. Worked out once, lazily,
  // so world generation and every feature file have finished adding to ITEMS/SHOPS/MONSTER_DEFS first.
  //
  // Four streams add up: a shop that always stocks it, gathering it, cooking it, and monsters dropping it.
  // Crafting is different — a recipe is only as available as its rarest ingredient, so the craft value is
  // settled by iteration (ore feeds bars, bars feed swords) and a recipe takes the best route, not the sum.
  const gate = lv => Math.max(0.1, 1 - (Math.max(1, lv | 0) - 1) / 40); // a skill gate makes a thing rarer, not impossible
  let SUP = null;
  function supply() {
    if (SUP) return SUP;
    const s = Object.create(null);
    const row = id => s[id] || (s[id] = { shop: 0, recipe: 0, gather: 0, cook: 0, drop: 0, monsters: 0 });
    const bump = (id, k, n) => { if (!ITEMS[id] || !(n > 0)) return; row(id)[k] += n; };
    for (const k in SHOPS) for (const r of SHOPS[k].stock || []) bump(r[0], 'shop', 1);
    for (const id in ITEMS) if (ITEMS[id].capeSkill) bump(id, 'shop', gate(99));   // the Master of Skills sells one, at level 99
    for (const t in GATHER) bump(GATHER[t].item, 'gather', gate(GATHER[t].lv));
    if (window.PROGRESSION && Array.isArray(PROGRESSION.CATCH)) for (const c of PROGRESSION.CATCH) bump(c.id, 'gather', gate(c.lv));
    bump('raw_shrimp', 'gather', 1); bump('raw_trout', 'gather', gate(5));         // the two the core rod catches (06-systems)
    for (const [id, lv] of GATHER_IN_CLOSURES) bump(id, 'gather', gate(lv));
    for (const id in ITEMS) if (ITEMS[id].seed && ITEMS[ITEMS[id].seed]) bump(ITEMS[id].seed, 'gather', 0.8); // sow it, wait, harvest it
    for (const type in MONSTER_DEFS) {
      const def = MONSTER_DEFS[type], often = Math.min(2, Math.max(0.04, 60 / Math.max(1, def.respawn || 60))); // an hour-long respawn supplies far less than a 12 s one
      for (const r of dropRows(type, def)) { bump(r.id, 'drop', r.pct * often * 0.5); if (r.pct > 0) bump(r.id, 'monsters', 1); }
    }
    // cooking: a cooked fish is exactly as easy to come by as the raw one
    const raw = id => { const r = s[id]; return r ? r.shop * 60 + r.gather * 50 + r.drop : 0; };
    for (const id in ITEMS) { const d = ITEMS[id]; if (d.cook && ITEMS[d.cook]) bump(d.cook, 'cook', Math.max(0.02, Math.min(1, raw(id) / 25))); }
    // crafting: every recipe the game knows, including the ones features keep on window
    const made = [];
    for (const r of RECIPES) if (r.out && ITEMS[r.out]) made.push({ out: r.out, lv: r.lv || 1, needs: r.needs || [] });
    for (const r of SMELT) if (ITEMS[r.out]) made.push({ out: r.out, lv: r.lv || 1, needs: r.needs || [] });
    if (window.SKYCITY && Array.isArray(SKYCITY.FORGE)) for (const f of SKYCITY.FORGE) if (ITEMS[f.out]) made.push({ out: f.out, lv: 30, needs: [['dragon_scale', f.scales], ['mithril_bar', f.mithril], ['obsidian', 1]] });
    const flat = id => { const r = s[id]; return r ? r.shop * 60 + r.gather * 50 + r.cook * 40 + r.drop + r.recipe : 0; };
    for (let pass = 0; pass < 4; pass++) {          // ore feeds bars, bars feed swords: let the chain settle
      const next = Object.create(null);
      for (const m of made) {
        let f = 1;
        for (const n of m.needs) f = Math.min(f, Math.max(0.02, Math.min(1, flat(n[0]) / 25)) / Math.pow(Math.max(1, n[1] || 1), 0.35)); // as available as its rarest ingredient, and more of it is more work
        const v = 30 * gate(m.lv) * f;
        if (v > (next[m.out] || 0)) next[m.out] = v;  // the easiest recipe wins; two ways to make a thing is not twice as many
      }
      for (const id in s) s[id].recipe = 0;
      for (const id in next) row(id).recipe = next[id];
    }
    SUP = s; return s;
  }
  const blank = { shop: 0, recipe: 0, gather: 0, cook: 0, drop: 0, monsters: 0 };
  function score(id) { const r = supply()[id] || blank; return r.shop * 60 + r.gather * 50 + r.cook * 40 + r.drop + r.recipe; }

  const TIER_CACHE = Object.create(null);
  function tierOf(id) {
    if (TIER_CACHE[id]) return TIER_CACHE[id];
    const sc = score(id), v = (ITEMS[id] && ITEMS[id].value) || 0;
    let t = sc >= 40 ? TIERS.common : sc >= 12 ? TIERS.uncommon : sc >= 1.2 ? TIERS.rare : sc >= 0.1 ? TIERS.epic : TIERS.unique;
    if (v >= 900 && t.order < TIERS.uncommon.order) t = TIERS.uncommon;  // value is the tiebreak: nothing this dear is merely common
    if (v <= 30 && t.order > TIERS.uncommon.order) t = TIERS.uncommon;   // and nothing worth thirty coins is a treasure
    return (TIER_CACHE[id] = t);
  }

  // ---------- the halo ----------
  // A soft ring of light behind the icon, with a hole in the middle so the icon itself is never washed out,
  // and a darker ring at the edge so it still reads against a light panel.
  // Cached per context, never globally: the audit's recording context makes gradient stubs, and one of those
  // must never end up as a fillStyle on the real canvas.
  const GRADS = new WeakMap();
  function haloGrad(g, tier, r) {
    let m = GRADS.get(g); if (!m) GRADS.set(g, m = new Map());
    const key = tier.key + '|' + Math.round(r * 4);
    let gr = m.get(key);
    if (!gr) {
      gr = g.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
      const rgb = hexRgb(tier.glow);
      gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.45, `rgba(${rgb},${tier.strength})`);
      gr.addColorStop(0.72, `rgba(${rgb},${tier.strength * 0.75})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      m.set(key, gr);
    }
    return gr;
  }
  const hexRgb = hex => { const h = String(hex).replace('#', ''); const n = h.length === 3 ? h.split('').map(c => parseInt(c + c, 16)) : [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return n.join(','); };
  const lum = hex => { const h = String(hex || '#888').replace('#', ''); const n = h.length === 3 ? h.split('').map(c => parseInt(c + c, 16)) : [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return (n[0] * 0.299 + n[1] * 0.587 + n[2] * 0.114) / 255; };
  function drawHalo(g, size, tier) {
    if (!tier || !tier.glow) return;
    const r = size * 0.76;                              // hugs the icon: a glow, not a badge it sits inside
    g.fillStyle = haloGrad(g, tier, r); g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.strokeStyle = tier.ring; g.lineWidth = Math.max(0.9, size * 0.035); // the ring is what keeps it readable on a bright panel
    g.globalAlpha = 0.26 + tier.strength * 0.4; g.beginPath(); g.arc(0, 0, r * 0.94, 0, 7); g.stroke(); g.globalAlpha = 1;
  }

  // ---------- the wrapper ----------
  // 38-agility.js already wrapped drawItemIcon for the cape shape; this file loads after it, so unregistered
  // capes still reach that drawing and everything else still reaches the core shape switch in 08-draw.js.
  const _drawItemIcon = drawItemIcon;
  drawItemIcon = (g, id, x, y, size = 18) => {
    const def = ITEMS[id];
    if (haloOn && def) { const t = tierOf(id); if (t.glow) { g.save(); g.translate(x, y); drawHalo(g, size, t); g.restore(); } }
    const fn = REG[id];
    if (!fn) return _drawItemIcon(g, id, x, y, size);
    const s = size / UNIT;
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = def ? def.color : '#c9d1d9'; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.lineCap = 'butt'; g.lineJoin = 'miter';
    try { fn(g, size, def); } catch (e) { BROKEN.set(id, String(e && e.message || e)); g.restore(); return _drawItemIcon(g, id, x, y, size); } // a broken icon falls back to the shape switch rather than taking the HUD down, and the audit names it
    g.restore();
  };

  // ---------- the recorder: a stub canvas that writes down everything an icon does ----------
  // Every drawing call and every colour set goes into a list. Colours are stored by their place in this
  // icon's own palette (c0, c1...) rather than by hex, so the same drawing in another colour hashes the same
  // and is caught as a duplicate. The transform is tracked too, so the recorder also knows the icon's bounds.
  const CALLS = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'quadraticCurveTo', 'bezierCurveTo',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'setLineDash', 'drawImage'];
  const STYLES = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'globalAlpha', 'font', 'textAlign', 'textBaseline',
    'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'globalCompositeOperation', 'miterLimit', 'lineDashOffset', 'filter'];
  const COLOUR_STYLES = new Set(['fillStyle', 'strokeStyle', 'shadowColor']);
  const num = v => typeof v === 'number' ? (Math.round(v * 1000) / 1000) : v;

  function Recorder() {
    const rec = { log: [], pal: new Map(), grads: 0, lw: 1, min: [Infinity, Infinity], max: [-Infinity, -Infinity], m: [1, 0, 0, 1, 0, 0], stack: [], small: [], thin: [] };
    const paint = v => { // a colour becomes its index in this icon's palette; a gradient becomes its own token
      if (v && typeof v === 'object' && v.__grad) return v.__grad;
      const k = String(v); if (!rec.pal.has(k)) rec.pal.set(k, 'c' + rec.pal.size); return rec.pal.get(k);
    };
    const pt = (x, y) => { // a point in icon units, through the current transform
      const m = rec.m, px = m[0] * x + m[2] * y + m[4], py = m[1] * x + m[3] * y + m[5];
      const pad = rec.lw / 2 * Math.hypot(m[0], m[1]);
      if (px - pad < rec.min[0]) rec.min[0] = px - pad; if (px + pad > rec.max[0]) rec.max[0] = px + pad;
      if (py - pad < rec.min[1]) rec.min[1] = py - pad; if (py + pad > rec.max[1]) rec.max[1] = py + pad;
    };
    const box = (x, y, w, h) => { pt(x, y); pt(x + w, y); pt(x, y + h); pt(x + w, y + h); };
    const scaleOf = () => Math.hypot(rec.m[0], rec.m[1]);
    const feature = d => { const px = Math.abs(d) * scaleOf(); if (px > 0 && px < MIN_FEATURE - 1e-6) rec.small.push(+px.toFixed(2)); };
    const g = {
      __rec: rec,
      save() { rec.log.push('save'); rec.stack.push([rec.m.slice(), rec.lw]); },
      restore() { rec.log.push('restore'); const s = rec.stack.pop(); if (s) { rec.m = s[0]; rec.lw = s[1]; } },
      translate(x, y) { rec.log.push('translate ' + num(x) + ' ' + num(y)); rec.m = mul(rec.m, [1, 0, 0, 1, x, y]); },
      scale(x, y) { rec.log.push('scale ' + num(x) + ' ' + num(y)); rec.m = mul(rec.m, [x, 0, 0, y, 0, 0]); },
      rotate(a) { rec.log.push('rotate ' + num(a)); rec.m = mul(rec.m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
      transform(a, b, c, d, e, f) { rec.log.push('transform'); rec.m = mul(rec.m, [a, b, c, d, e, f]); },
      setTransform(a, b, c, d, e, f) { rec.log.push('setTransform'); rec.m = [a, b, c, d, e, f]; },
      measureText: t => ({ width: String(t).length * 5 }),
      createLinearGradient() { const t = 'lg' + rec.grads++; rec.log.push(t); return gradStub(t, rec, paint); },
      createRadialGradient() { const t = 'rg' + rec.grads++; rec.log.push(t); return gradStub(t, rec, paint); },
      createPattern() { const t = 'pat' + rec.grads++; rec.log.push(t); return { __grad: t }; },
    };
    for (const name of CALLS) g[name] = (...a) => {
      rec.log.push(name + ' ' + a.map(num).join(' '));
      switch (name) {
        case 'moveTo': case 'lineTo': pt(a[0], a[1]); break;
        case 'quadraticCurveTo': pt(a[0], a[1]); pt(a[2], a[3]); break;
        case 'bezierCurveTo': pt(a[0], a[1]); pt(a[2], a[3]); pt(a[4], a[5]); break;
        case 'arcTo': pt(a[0], a[1]); pt(a[2], a[3]); break;
        case 'arc': for (const q of arcPts(a[0], a[1], a[2], a[2], 0, a[3], a[4], a[5])) pt(q[0], q[1]); feature(a[2] * 2); break;
        case 'ellipse': for (const q of arcPts(a[0], a[1], a[2], a[3], a[4] || 0, a[5], a[6], a[7])) pt(q[0], q[1]); feature(Math.min(a[2], a[3]) * 2); break;
        case 'rect': case 'fillRect': case 'strokeRect': case 'clearRect': box(a[0], a[1], a[2], a[3]); feature(Math.min(Math.abs(a[2]), Math.abs(a[3]))); break;
        case 'fillText': case 'strokeText': pt(a[1], a[2]); break;
      }
    };
    for (const name of STYLES) Object.defineProperty(g, name, {
      get() { return name === 'lineWidth' ? rec.lw : rec['s_' + name]; },
      set(v) {
        if (COLOUR_STYLES.has(name)) rec.log.push('set ' + name + '=' + paint(v));
        else { rec.log.push('set ' + name + '=' + num(v)); if (name === 'lineWidth') { rec.lw = v; const px = v * scaleOf(); if (px > 0 && px < MIN_LINE - 1e-6) rec.thin.push(+px.toFixed(2)); } }
        rec['s_' + name] = v;
      },
    });
    return g;
  }
  // Where an arc or ellipse actually reaches: its two ends, plus whichever quarter-turns the sweep passes
  // through. A half-arc must not be measured as a whole circle — that would fail an icon that fits fine.
  function arcPts(cx, cy, rx, ry, rot, a0, a1, ccw) {
    let s0 = a0, e0 = a1;
    if (ccw) { if (s0 - e0 >= Math.PI * 2) { s0 = 0; e0 = Math.PI * 2; } else { while (e0 > s0) e0 -= Math.PI * 2; } }
    else { if (e0 - s0 >= Math.PI * 2) { s0 = 0; e0 = Math.PI * 2; } else { while (e0 < s0) e0 += Math.PI * 2; } }
    const lo = Math.min(s0, e0), hi = Math.max(s0, e0), c = Math.cos(rot), sn = Math.sin(rot), out = [];
    const at = a => { const x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * c - y * sn, cy + x * sn + y * c]; };
    out.push(at(lo), at(hi));
    for (let k = -4; k <= 8; k++) { const a = k * Math.PI / 2; if (a >= lo && a <= hi) out.push(at(a)); }
    return out;
  }
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const gradStub = (tok, rec, paint) => ({ __grad: tok, addColorStop(p, c) { rec.log.push(tok + ' stop ' + num(p) + ' ' + paint(c)); } });

  // FNV-1a over the call list: same picture in, same hash out.
  function hashOf(list) { let h = 0x811c9dc5; const s = list.join('\n'); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return h.toString(16).padStart(8, '0'); }

  // Draw one item into a recorder. Always without a halo — a halo must never be what makes an icon unique.
  function recordIcon(id, size = UNIT) {
    const g = Recorder(); const was = haloOn; haloOn = false;
    try { drawItemIcon(g, id, 0, 0, size); } finally { haloOn = was; }
    const rec = g.__rec, sc = size / UNIT;
    const bounded = rec.min[0] < Infinity;
    return {
      id, hash: hashOf(rec.log), calls: rec.log.length, colours: rec.pal.size, log: rec.log,
      minX: bounded ? rec.min[0] / sc : 0, maxX: bounded ? rec.max[0] / sc : 0, minY: bounded ? rec.min[1] / sc : 0, maxY: bounded ? rec.max[1] / sc : 0,
      reach: bounded ? Math.max(-rec.min[0], rec.max[0], -rec.min[1], rec.max[1]) / sc : 0,
      small: rec.small, thin: rec.thin, empty: rec.log.length === 0,
    };
  }

  // ---------- the audit ----------
  function audit() {
    const ids = Object.keys(ITEMS), byHash = new Map(), missing = [], rows = {};
    for (const id of ids) { const r = recordIcon(id); rows[id] = r; if (!REG[id]) missing.push(id); const a = byHash.get(r.hash); if (a) a.push(id); else byHash.set(r.hash, [id]); }
    const duplicates = [], groups = [];
    let implicated = 0;
    for (const [, list] of byHash) {
      if (list.length < 2) continue;
      groups.push(list.slice()); implicated += list.length;
      for (let i = 1; i < list.length; i++) duplicates.push([list[i], list[0]]);
    }
    groups.sort((a, b) => b.length - a.length);
    return { total: ids.length, unique: byHash.size, duplicates, missing, implicated, groups, rows };
  }

  // Record the artist's drawing on its own, in design units, with no outer transform. Used to check the box
  // and the feature sizes in the units an artist actually types, and to catch an icon that changes with `size`.
  function recordArt(id, size) {
    const fn = REG[id]; if (!fn) return null;
    const g = Recorder(), def = ITEMS[id] || { color: '#c9d1d9' }, rec = g.__rec;
    g.fillStyle = def.color; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2;
    let threw = null; try { fn(g, size, def); } catch (e) { threw = String(e && e.message || e); }
    const bounded = rec.min[0] < Infinity;
    return { id, threw, hash: hashOf(rec.log), calls: rec.log.length, small: rec.small, thin: rec.thin,
      reach: bounded ? Math.max(-rec.min[0], rec.max[0], -rec.min[1], rec.max[1]) : 0 };
  }

  // ============================================================================
  // THE ART — the twelve worst offenders, drawn as the reference the rest of the wave copies
  // ============================================================================

  // ---------- capes: one silhouette, fifteen emblems ----------
  // Every skill cape drew the same cloth. A cape says which skill it is by its emblem, so the emblem carries
  // the whole job: it must be one clear shape, at least 2 units across, in ink that reads on any cape colour.
  const EMBLEM = {
    melee: (g, ink) => { // crossed swords
      g.strokeStyle = ink; g.lineWidth = 1.8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-4.5, 5.5); g.lineTo(4.5, -3); g.moveTo(4.5, 5.5); g.lineTo(-4.5, -3); g.stroke();
      g.lineWidth = 1.4; g.beginPath(); g.moveTo(-4, 1.2); g.lineTo(4, 1.2); g.stroke();
    },
    defence: (g, ink) => { // a shield
      g.fillStyle = ink; g.beginPath(); g.moveTo(-4.5, -3.4); g.lineTo(4.5, -3.4); g.lineTo(4.5, 1.4); g.lineTo(0, 6); g.lineTo(-4.5, 1.4); g.closePath(); g.fill();
    },
    range: (g, ink) => { // an arrow, nocked and pointing up
      g.strokeStyle = ink; g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 6); g.lineTo(0, -2); g.stroke();
      g.fillStyle = ink; g.beginPath(); g.moveTo(0, -5); g.lineTo(3.2, -0.6); g.lineTo(-3.2, -0.6); g.closePath(); g.fill();
      g.lineWidth = 1.4; g.beginPath(); g.moveTo(-2.8, 6); g.lineTo(0, 3.2); g.moveTo(2.8, 6); g.lineTo(0, 3.2); g.stroke();
    },
    woodcutting: (g, ink) => { // a pine
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(0, -5); g.lineTo(3.4, -0.4); g.lineTo(-3.4, -0.4); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0, -2); g.lineTo(4.6, 3.4); g.lineTo(-4.6, 3.4); g.closePath(); g.fill();
      g.fillRect(-1.2, 3.4, 2.4, 2.8);
    },
    mining: (g, ink) => { // a pickaxe: a fat crescent head crowning the shaft
      g.fillStyle = ink; g.fillRect(-1.1, -3.6, 2.2, 9.6);
      g.beginPath(); g.moveTo(-6, -0.4); g.quadraticCurveTo(0, -7.6, 6, -0.4);
      g.quadraticCurveTo(0, -3.6, -6, -0.4); g.closePath(); g.fill();
    },
    fishing: (g, ink) => { // a fish
      g.fillStyle = ink; g.beginPath(); g.ellipse(-0.8, 1.4, 4.2, 2.5, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(2.8, 1.4); g.lineTo(5.6, -1.4); g.lineTo(5.6, 4.2); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-1.6, -1.1); g.lineTo(1.6, -1.1); g.lineTo(0, -3.8); g.closePath(); g.fill();
    },
    cooking: (g, ink) => { // a cooking pot with two handles
      g.strokeStyle = ink; g.lineWidth = 1.4;
      g.beginPath(); g.arc(-4.6, 1.4, 1.8, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
      g.beginPath(); g.arc(4.6, 1.4, 1.8, Math.PI * 1.5, Math.PI * 0.5); g.stroke();
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(-4.6, -0.6); g.lineTo(4.6, -0.6); g.quadraticCurveTo(4, 5.8, 0, 5.8); g.quadraticCurveTo(-4, 5.8, -4.6, -0.6); g.closePath(); g.fill();
      g.fillRect(-5.4, -2.6, 10.8, 2.2);
      g.beginPath(); g.moveTo(-2.4, -4.4); g.quadraticCurveTo(-1.4, -6, 0, -6.6); g.quadraticCurveTo(0.4, -5, 1.6, -4.4); g.closePath(); g.fill();
    },
    firemaking: (g, ink) => { // a flame
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(0, 6); g.quadraticCurveTo(-4.6, 2.6, -2, -1.4); g.quadraticCurveTo(-1.4, -4.4, 0.6, -5.6);
      g.quadraticCurveTo(-0.4, -1.8, 1.8, -1.6); g.quadraticCurveTo(4.6, 1.2, 0, 6); g.closePath(); g.fill();
    },
    farming: (g, ink) => { // a stalk of wheat
      g.strokeStyle = ink; g.lineWidth = 1.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 6); g.lineTo(0, -1.4); g.stroke();
      g.fillStyle = ink;
      for (let j = 0; j < 3; j++) { g.beginPath(); g.ellipse(-1.7, -1.6 - j * 2, 1.8, 1.1, -0.6, 0, 7); g.ellipse(1.7, -1.6 - j * 2, 1.8, 1.1, 0.6, 0, 7); g.fill(); }
    },
    smithing: (g, ink) => { // an anvil
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(-5, -2.6); g.lineTo(3, -2.6); g.lineTo(5.4, -0.6); g.lineTo(1.6, -0.6); g.lineTo(1.6, 1);
      g.lineTo(3.2, 5.4); g.lineTo(-3.2, 5.4); g.lineTo(-1.6, 1); g.lineTo(-1.6, -0.6); g.lineTo(-5, -0.6); g.closePath(); g.fill();
    },
    crafting: (g, ink, col) => { // a spool with thread wound on it
      g.fillStyle = ink;
      g.fillRect(-5.2, -5, 10.4, 2.2); g.fillRect(-5.2, 2.8, 10.4, 2.2); g.fillRect(-3.4, -2.8, 6.8, 5.6);
      g.strokeStyle = col; g.lineWidth = 1.2;      // the winding reads as gaps in the thread
      g.beginPath(); g.moveTo(-3.4, 2.4); g.lineTo(3.4, -0.4); g.moveTo(-3.4, 0.4); g.lineTo(3.4, -2.4); g.stroke();
    },
    hitpoints: (g, ink) => { // a heart
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(0, 6); g.quadraticCurveTo(-5.4, 1.4, -5.4, -1.6); g.quadraticCurveTo(-5.4, -4.6, -2.6, -4.6);
      g.quadraticCurveTo(-0.8, -4.6, 0, -2.4); g.quadraticCurveTo(0.8, -4.6, 2.6, -4.6); g.quadraticCurveTo(5.4, -4.6, 5.4, -1.6);
      g.quadraticCurveTo(5.4, 1.4, 0, 6); g.closePath(); g.fill();
    },
    agility: (g, ink) => { // a running boot
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(-2.6, -4.6); g.lineTo(1, -4.6); g.lineTo(1.6, 0.6); g.lineTo(5, 2.6); g.lineTo(5.4, 5.4); g.lineTo(-2.6, 5.4); g.closePath(); g.fill();
      g.strokeStyle = ink; g.lineWidth = 1.3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-6, -1.6); g.lineTo(-4, -1.6); g.moveTo(-6, 1.6); g.lineTo(-4, 1.6); g.stroke();
    },
    guild: (g, ink, col) => { // Hollowford's keep
      g.fillStyle = ink; g.fillRect(-3.6, -2.4, 7.2, 8);
      g.fillRect(-5, -4.8, 2.6, 2.6); g.fillRect(-1.3, -4.8, 2.6, 2.6); g.fillRect(2.4, -4.8, 2.6, 2.6);
      g.fillStyle = col; g.beginPath(); g.moveTo(-1.5, 5.6); g.lineTo(-1.5, 1.6); g.quadraticCurveTo(0, 0.2, 1.5, 1.6); g.lineTo(1.5, 5.6); g.closePath(); g.fill();
    },
  };
  function capeIcon(emblem) {
    return (g, size, item) => {
      const col = item.color;
      g.fillStyle = col;
      g.beginPath(); g.moveTo(-7, -9); g.lineTo(-3, -7.6); g.quadraticCurveTo(0, -6.4, 3, -7.6); g.lineTo(7, -9);
      g.lineTo(9.4, 7.2); g.quadraticCurveTo(4.7, 4.4, 0, 8.6); g.quadraticCurveTo(-4.7, 4.4, -9.4, 7.2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#f5c542'; g.beginPath(); g.arc(-5, -8.2, 1.5, 0, 7); g.arc(5, -8.2, 1.5, 0, 7); g.fill();
      const ink = lum(col) > 0.55 ? '#241c14' : '#f7f3e6'; // a pale cape takes dark ink, a dark cape takes cream
      g.save(); g.translate(0, 0.4); emblem(g, ink, col); g.restore();
    };
  }

  // ---------- the eleven that drew as the wrong thing entirely ----------
  const ART = {
    // was a shield: it is one plate off a dragon's back, keeled down the middle
    dragon_scale: (g, size, item) => {
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(0, -9); g.quadraticCurveTo(6.2, -3.2, 7.2, 3.4); g.quadraticCurveTo(7.4, 6.4, 5.8, 7.4);
      g.lineTo(-5.8, 7.4); g.quadraticCurveTo(-7.4, 6.4, -7.2, 3.4); g.quadraticCurveTo(-6.2, -3.2, 0, -9);
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.32)';      // the light catches the two upper edges
      g.beginPath(); g.moveTo(0, -8); g.quadraticCurveTo(5.2, -2.8, 6.2, 2.6); g.quadraticCurveTo(3.4, -0.6, 0, -5.4);
      g.quadraticCurveTo(-3.4, -0.6, -6.2, 2.6); g.quadraticCurveTo(-5.2, -2.8, 0, -8); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.26)';            // ridges fanning down from the point to the base
      for (const x of [-3.4, 0, 3.4]) { g.beginPath(); g.moveTo(x * 0.34, -3); g.quadraticCurveTo(x * 0.9, 2, x, 6.4);
        g.quadraticCurveTo(x * 0.9 + 1.3, 2, x * 0.34 + 1.3, -3); g.closePath(); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.1; // the scales that sat either side of it in the hide
      g.beginPath(); g.arc(-8.4, 7.4, 3, -1.5, 0.1); g.stroke();
      g.beginPath(); g.arc(8.4, 7.4, 3, 3, 4.7); g.stroke();
    },
    // was a rock: it is a steaming pile, and Dunstan the dung farmer wants five of them
    dragon_dung: (g, size, item) => {
      g.fillStyle = item.color;
      g.beginPath(); g.ellipse(0, 5.8, 8.2, 3.1, 0, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(-3.2, 1.4, 4.8, 3.4, -0.2, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(3.4, 1, 4.2, 3.1, 0.25, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(0, -3.2, 3.8, 2.9, 0, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(210,205,180,0.5)'; g.lineWidth = 1.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-2.2, -7); g.quadraticCurveTo(-3.8, -8.8, -1.6, -9.4); g.moveTo(2.4, -6.8); g.quadraticCurveTo(0.8, -8.6, 3, -9.2); g.stroke();
    },
    // was a bar: Grubb's boiler, riveted, with a chimney and a pressure gauge
    boiler: (g, size, item) => {
      g.fillStyle = '#5a5a62'; g.fillRect(-2.6, -8.6, 5.2, 4.4);
      g.fillStyle = item.color; roundRect(g, -6.6, -4.6, 13.2, 11.8, 3); g.fill(); g.stroke();
      g.fillStyle = '#3a3a42'; g.fillRect(-6.6, -1.4, 13.2, 2.2);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (const x of [-4.6, 4.6]) { g.beginPath(); g.arc(x, -3, 1, 0, 7); g.arc(x, 5, 1, 0, 7); g.fill(); }
      g.fillStyle = '#ffb347'; g.beginPath(); g.arc(2.8, 3.6, 1.9, 0, 7); g.fill();
      g.strokeStyle = '#3a3a42'; g.lineWidth = 1; g.beginPath(); g.moveTo(2.8, 3.6); g.lineTo(2.8, 2); g.stroke();
      g.fillStyle = 'rgba(220,220,230,0.45)'; g.beginPath(); g.arc(0, -8.8, 1.3, 0, 7); g.fill();
    },
    // was a bar: Old Snaggle's bomb chute — a slanted hopper with a bomb rolling out of the bottom
    bomb_chute: (g, size, item) => {
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-8, -8); g.lineTo(-1.2, -8); g.lineTo(3.4, 0.8); g.lineTo(6.4, 0.8); g.lineTo(6.4, 4.8);
      g.lineTo(0.6, 4.8); g.lineTo(-4.4, -4); g.lineTo(-8, -4); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(200,204,214,0.4)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-8, -8); g.lineTo(-1.2, -8); g.lineTo(3.4, 0.8); g.lineTo(6.4, 0.8); g.lineTo(6.4, 4.8); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.moveTo(-7, -6.8); g.lineTo(-2, -6.8); g.lineTo(-1.4, -5.4); g.lineTo(-7, -5.4); g.closePath(); g.fill();
      g.fillStyle = '#2f2f35'; g.beginPath(); g.arc(3.4, 7.6, 2.6, 0, 7); g.fill();
      g.strokeStyle = 'rgba(200,204,214,0.7)'; g.lineWidth = 1.1; g.beginPath(); g.arc(3.4, 7.6, 2.6, 0, 7); g.stroke();
      g.strokeStyle = '#ffb347'; g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(5.2, 6); g.lineTo(7.2, 4.4); g.stroke();
    },
    // was a dagger: the tooth you pulled out of The Fang, bound into a grip
    fang_of_the_fang: (g, size, item) => {
      g.save(); g.rotate(-0.7);
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-4, 3.2); g.quadraticCurveTo(2, 3.6, 10.4, -0.6); g.quadraticCurveTo(2.4, -0.4, -4, -3); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-2, 0.6); g.quadraticCurveTo(3, 1.4, 8.4, -0.5); g.stroke();
      g.fillStyle = '#4a2e13'; g.fillRect(-9.4, -2.4, 6, 4.8);
      g.strokeStyle = '#c9a36a'; g.lineWidth = 1;
      for (const x of [-8.1, -6.4, -4.7]) { g.beginPath(); g.moveTo(x, -2.4); g.lineTo(x, 2.4); g.stroke(); }
      g.fillStyle = '#7a2e2e'; g.beginPath(); g.arc(-3.2, 0, 1.6, 0, 7); g.fill();
      g.restore();
    },
    // was a dagger: two teeth out of a vampire's jaw, and one drop that has not dried
    vampire_fang: (g, size, item) => {
      g.fillStyle = item.color;
      for (const [x, w] of [[-3.2, 2.6], [3.4, 2.2]]) {
        g.beginPath(); g.moveTo(x - w, -7.4); g.quadraticCurveTo(x - w * 0.7, 2, x, 7.4); g.quadraticCurveTo(x + w * 0.7, 2, x + w, -7.4); g.closePath(); g.fill(); g.stroke();
      }
      g.fillStyle = 'rgba(120,96,96,0.4)';
      g.beginPath(); g.moveTo(-6.4, -7.4); g.lineTo(6.4, -7.4); g.lineTo(6.4, -5.2); g.lineTo(-6.4, -5.2); g.closePath(); g.fill();
      g.fillStyle = '#8b1a1a';
      g.beginPath(); g.moveTo(-3.2, 8); g.quadraticCurveTo(-4.6, 9.6, -3.2, 10.2); g.quadraticCurveTo(-1.8, 9.6, -3.2, 8); g.closePath(); g.fill();
    },
    // was a helm: Tinkerton's goggles, two lenses on a leather strap
    tinker_goggles: (g, size, item) => {
      g.fillStyle = '#5a4a3a'; g.fillRect(-9.4, -2.2, 18.8, 4.4);
      g.fillStyle = item.color;
      for (const x of [-4.4, 4.4]) { g.beginPath(); g.arc(x, 0, 4.4, 0, 7); g.fill(); g.stroke(); }
      g.fillStyle = '#9fd3ff'; for (const x of [-4.4, 4.4]) { g.beginPath(); g.arc(x, 0, 2.8, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.6)'; for (const x of [-5.4, 3.4]) { g.beginPath(); g.arc(x, -1.1, 1.1, 0, 7); g.fill(); }
      g.fillStyle = '#5a4a3a'; g.fillRect(-1.7, -1.5, 3.4, 3);
      g.strokeStyle = '#3a2e22'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-9.4, -2.2); g.lineTo(-9.4, 2.2); g.moveTo(9.4, -2.2); g.lineTo(9.4, 2.2); g.stroke();
    },
  };
  // was a cloak with no scales on it: the dragon-scale cloak, drawn in overlapping plates
  ART.scale_cloak = (g, size, item) => {
    const col = item.color;
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-7, -9); g.lineTo(7, -9); g.lineTo(9.4, 7.2); g.quadraticCurveTo(4.7, 4.4, 0, 8.6); g.quadraticCurveTo(-4.7, 4.4, -9.4, 7.2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.34)'; g.lineWidth = 1.1;
    for (let row = 0; row < 4; row++) {
      const y = -6.2 + row * 3.3, n = 3 + (row % 2), off = (row % 2) ? 0 : 2.2;
      for (let k = 0; k < n; k++) { g.beginPath(); g.arc(-6.6 + off + k * 4.4, y, 2.2, 0, Math.PI); g.stroke(); }
    }
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(-5, -8.2, 1.5, 0, 7); g.arc(5, -8.2, 1.5, 0, 7); g.fill();
  };
  // were four identical planks: four blueprints, each with the part it builds drawn on it
  const DIAGRAM = {
    blueprint_drill: g => { // a drill bit
      g.beginPath(); g.moveTo(-5, -3); g.lineTo(5, -3); g.lineTo(0, 5.2); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(-3.4, -0.4); g.lineTo(3.4, -0.4); g.moveTo(-1.8, 2.2); g.lineTo(1.8, 2.2); g.stroke();
    },
    blueprint_irondrill: g => { // a heavier drill: a second cone inside the first, on a shaft
      g.beginPath(); g.moveTo(-6, -4); g.lineTo(6, -4); g.lineTo(0, 6); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(-3.2, -4); g.lineTo(3.2, -4); g.lineTo(0, 1.6); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -7.2); g.stroke();
    },
    blueprint_ram: g => { // a ram plate, bolted
      g.beginPath(); g.moveTo(-6.4, -3.4); g.lineTo(6.4, -3.4); g.lineTo(4.4, 3.4); g.lineTo(-4.4, 3.4); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(-5.8, 0); g.lineTo(5.8, 0); g.stroke();
      g.beginPath(); g.arc(-3.6, -1.7, 1.1, 0, 7); g.fill(); g.beginPath(); g.arc(3.6, -1.7, 1.1, 0, 7); g.fill();
      g.beginPath(); g.arc(-3, 1.8, 1.1, 0, 7); g.fill(); g.beginPath(); g.arc(3, 1.8, 1.1, 0, 7); g.fill();
      g.beginPath(); g.moveTo(0, 3.4); g.lineTo(0, 6.4); g.stroke();
    },
    blueprint_boiler: g => { // a boiler drum on its side, with the chimney
      g.beginPath(); g.moveTo(-5.2, -2.2); g.lineTo(5.2, -2.2); g.lineTo(5.2, 4.2); g.lineTo(-5.2, 4.2); g.closePath(); g.stroke();
      g.beginPath(); g.ellipse(-5.2, 1, 1.6, 3.2, 0, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(1.4, -2.2); g.lineTo(1.4, -6.4); g.lineTo(4.2, -6.4); g.stroke();
    },
  };
  for (const id in DIAGRAM) ART[id] = ((diagram) => (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8, -8.4); g.lineTo(8, -8.4); g.lineTo(8, 5.8); g.quadraticCurveTo(0, 9.2, -8, 5.8); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(214,232,255,0.26)'; g.lineWidth = 1;
    for (const x of [-4, 0, 4]) { g.beginPath(); g.moveTo(x, -8); g.lineTo(x, 6.6); g.stroke(); }
    for (const y of [-4.4, -0.4, 3.6]) { g.beginPath(); g.moveTo(-7.6, y); g.lineTo(7.6, y); g.stroke(); }
    g.strokeStyle = '#eaf2ff'; g.lineWidth = 1.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.fillStyle = '#eaf2ff';
    diagram(g);
  })(DIAGRAM[id]);

  // ---------- register everything this file draws ----------
  for (const id in ART) REG[id] = ART[id];
  const CAPE_EMBLEM = { guild_cape: 'guild' };
  for (const s of SKILL_DEFS) if (EMBLEM[s.key]) CAPE_EMBLEM['cape_' + s.key] = s.key;
  for (const id in CAPE_EMBLEM) REG[id] = capeIcon(EMBLEM[CAPE_EMBLEM[id]]);

  // ---------- the public API ----------
  window.ICONS = {
    UNIT, BOUND, SAFE, MIN_FEATURE, MIN_LINE, TIERS, TIER_ORDER,
    // set(id, (g, size, item) => {}) — the canvas is already centred and scaled; draw inside -9..+9.
    set(id, fn) { if (typeof fn !== 'function') throw new Error('ICONS.set(' + id + ') needs a drawing function'); REG[id] = fn; return fn; },
    get: id => REG[id] || null,
    has: id => !!REG[id],
    ids: () => Object.keys(REG),
    rarity: id => tierOf(id).key,                        // 'common' | 'uncommon' | 'rare' | 'epic' | 'unique'
    tier: id => tierOf(id),                              // the whole tier: name, order, glow, ring
    tierName: id => tierOf(id).name,
    supply: id => Object.assign({ score: +score(id).toFixed(3), value: (ITEMS[id] || {}).value || 0 }, supply()[id] || blank),
    halo(g, size, tier) { drawHalo(g, size, typeof tier === 'string' ? TIERS[tier] : tier); },
    record: recordIcon,
    art: recordArt,
    audit,
    broken: () => [...BROKEN.entries()].map(e => e[0] + ': ' + e[1]),
    measure(id, px = UNIT) { const r = recordIcon(id, px); return { minX: r.minX, maxX: r.maxX, minY: r.minY, maxY: r.maxY, reach: r.reach, px: r.reach * px / UNIT }; },
    reset() { SUP = null; for (const k in TIER_CACHE) delete TIER_CACHE[k]; }, // call after adding items, shops or drops late
  };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    // 1. THE GATE. This fails while any two items still draw the same picture. It is the wave's scoreboard:
    //    every icon an artist lands takes items out of `implicated` until the number reaches zero.
    const a = audit();
    check('icons: every item draws a different picture (no two items share one drawing)',
      a.duplicates.length === 0,
      { total: a.total, unique: a.unique, stillSharing: a.implicated, groups: a.groups.length, worst: a.groups.slice(0, 4).map(gr => gr.length + '×' + gr.slice(0, 3).join('/')) });

    // 2. the registry actually overrides, and an unregistered item is left exactly as it was
    const before = Recorder(); const was = haloOn; haloOn = false; _drawItemIcon(before, 'stone', 0, 0, UNIT); haloOn = was;
    const coreHash = hashOf(before.__rec.log);
    check('icons: a registered icon overrides the shape switch, an unregistered one falls through to it unchanged',
      !!REG.dragon_scale && !REG.stone && recordIcon('stone').hash === coreHash && recordIcon('dragon_scale').hash !== recordIcon('iron_shield').hash && recordIcon('stone').calls > 4,
      { registered: Object.keys(REG).length, fellThrough: recordIcon('stone').hash === coreHash, scaleIsNotAShield: recordIcon('dragon_scale').hash !== recordIcon('iron_shield').hash });

    // 3. the halo: rare and better get one, a common never does, and it never changes what the icon draws
    const withHalo = id => { const g2 = Recorder(); drawItemIcon(g2, id, 0, 0, UNIT); return g2.__rec.log.length; };
    const rareId = Object.keys(ITEMS).find(id => tierOf(id).glow), commonId = Object.keys(ITEMS).find(id => !tierOf(id).glow);
    const haloAdds = withHalo(rareId) - recordIcon(rareId).calls, commonAdds = withHalo(commonId) - recordIcon(commonId).calls;
    check('icons: a halo draws behind rare and better, never behind a common, and never changes the icon itself',
      haloAdds > 0 && commonAdds === 0 && !!TIERS.rare.glow && !!TIERS.epic.glow && !!TIERS.unique.glow && !TIERS.common.glow && !TIERS.uncommon.glow
      && TIERS.unique.strength > TIERS.epic.strength && TIERS.epic.strength > TIERS.rare.strength,
      { rare: rareId, haloAdds, common: commonId, commonAdds });

    // 4. rarity has to agree with the tables it was read off
    const shopIds = new Set(); for (const k in SHOPS) for (const r of SHOPS[k].stock || []) if (ITEMS[r[0]]) shopIds.add(r[0]);
    const shopTooRare = [...shopIds].filter(id => tierOf(id).order > TIERS.uncommon.order);
    const cheapDrop = new Set();
    for (const t in MONSTER_DEFS) { const d = MONSTER_DEFS[t]; if ((d.respawn || 60) <= 60) for (const r of (d.drops && d.drops.always) || []) if (ITEMS[r[0]]) cheapDrop.add(r[0]); }
    const dropTooRare = [...cheapDrop].filter(id => tierOf(id).order > TIERS.uncommon.order);
    const nothingGivesIt = Object.keys(ITEMS).filter(id => score(id) === 0);
    const looseUniques = nothingGivesIt.filter(id => tierOf(id).order < TIERS.epic.order && ((ITEMS[id].value || 0) > 30));
    const ordered = TIER_ORDER.every((k, i) => TIERS[k].order === i);
    check('icons: rarity follows the drop tables, shop stock, recipes and gathering it is derived from',
      shopTooRare.length === 0 && dropTooRare.length === 0 && looseUniques.length === 0 && ordered
      && ICONS.rarity('wood') === 'common' && ICONS.rarity('stone') === 'common' && ICONS.rarity('fang_of_the_fang') === 'unique'
      && ICONS.supply('bread').shop > 0 && ICONS.supply('fang_of_the_fang').score === 0,
      { shopTooRare: shopTooRare.slice(0, 5), dropTooRare: dropTooRare.slice(0, 5), looseUniques: looseUniques.slice(0, 5), wood: ICONS.rarity('wood'), fang: ICONS.rarity('fang_of_the_fang') });

    // 5. every registered icon fits its box at 13 px and at 35 px, and no feature is too small to see at 13 px
    const overflow = [], tiny = [], thin = [], drift = [], empty = [], threw = [];
    for (const id of Object.keys(REG)) {
      const art = recordArt(id, 13), big = recordArt(id, 35);
      const r13 = recordIcon(id, 13), r35 = recordIcon(id, 35);
      if (art && art.threw) { threw.push(id + ': ' + art.threw); continue; }
      if (!art || art.calls === 0) { empty.push(id); continue; }
      if (art.reach > BOUND + 1e-6 || r13.reach > BOUND + 1e-6 || r35.reach > BOUND + 1e-6) overflow.push(id + ' ' + Math.max(art.reach, r13.reach, r35.reach).toFixed(1));
      if (art.small.length) tiny.push(id + ' ' + art.small[0]);
      if (art.thin.length) thin.push(id + ' ' + art.thin[0]);
      if (art.hash !== big.hash) drift.push(id);
    }
    check('icons: every registered icon fits the box at 13 px and 35 px, with nothing under the 2-unit minimum feature',
      overflow.length === 0 && tiny.length === 0 && thin.length === 0 && drift.length === 0 && empty.length === 0 && threw.length === 0 && ICONS.broken().length === 0 && MIN_FEATURE === 2 && BOUND === 11,
      { checked: Object.keys(REG).length, overflow: overflow.slice(0, 4), tiny: tiny.slice(0, 4), thin: thin.slice(0, 4), drift: drift.slice(0, 4), empty: empty.slice(0, 4), threw: threw.slice(0, 4), fellBack: ICONS.broken().slice(0, 4) });

    // 6. the twelve worst offenders: fifteen capes that tell each other apart, and eleven items that drew as
    //    something they are not. Each must be registered, and each must hash differently from every other.
    const capes = Object.keys(ITEMS).filter(id => ITEMS[id].shape === 'cape');
    const wrong = ['dragon_scale', 'dragon_dung', 'blueprint_drill', 'blueprint_irondrill', 'blueprint_ram', 'blueprint_boiler', 'boiler', 'bomb_chute', 'fang_of_the_fang', 'vampire_fang', 'tinker_goggles'];
    const mine = capes.concat(wrong);
    const unregistered = mine.filter(id => !REG[id]);
    const hashes = new Set(mine.map(id => recordIcon(id).hash));
    const stillWrong = [['dragon_scale', 'iron_shield'], ['dragon_dung', 'stone'], ['blueprint_drill', 'plank'], ['blueprint_ram', 'plank'],
      ['boiler', 'iron_bar'], ['bomb_chute', 'iron_bar'], ['fang_of_the_fang', 'iron_dagger'], ['vampire_fang', 'iron_dagger'], ['tinker_goggles', 'iron_helm']]
      .filter(([a2, b2]) => recordIcon(a2).hash === recordIcon(b2).hash);
    check('icons: the fifteen capes and the eleven that drew as the wrong thing each have art of their own',
      unregistered.length === 0 && hashes.size === mine.length && stillWrong.length === 0 && capes.length >= 15,
      { capes: capes.length, wrong: wrong.length, unregistered: unregistered.slice(0, 4), distinct: hashes.size + '/' + mine.length, stillWrong: stillWrong.slice(0, 3) });
  });
}
