// ============================================================================
// HUD KIT — STORYBOOK HERALDRY. The HUD is one knight's kit, not a panel of app buttons.
//
// FIVE MATERIALS, ONE JOB EACH (the rule every feature follows):
//   IRON studs     — things you DO: SWING, USE (TALK / CHOP / MINE ...), BLOCK, the context seat (EXIT, RIDE, LEAVE ...)
//   WAX seals      — things you OPEN or READ: MENU, FRIENDS, the quest scroll's seal, the book's close seal
//   LEATHER        — what you CARRY: the belt, its five pouches and the BAG satchel
//   dark VELLUM    — words: the quest scroll, the talk page, tooltips, the book's pages
//   SABLE cloth    — numbers and news: the crest's banner, the notice ribbon
// Gold only ever means "look here / ready / selected". Red only ever means health or danger.
// No rounded box with a word in it is drawn on the play screen.
//
// EVERYTHING HAS A RESERVED PLACE. HK.layout() is the geometry engine (a port of the final layout.js the spec
// ships with): per device family (desk / tab / phoneP / phoneL), with the notch, Dynamic Island and home-indicator
// bands kept clear, the four touch seats (swing | use | block | ctx) fixed, and plaque slots under the quest scroll.
// Nothing moves when something appears: a plaque fades into a slot that was already there.
//
// HOW A FEATURE FILE USES IT (full reference: docs/EXTENDING.md, section "HUD"):
//   a plaque        HOOKS.hud.push(g => { if (on) HK.addPlaque(g, { emblem:'skull', name:'GRAVES 3', right:'risen 1', sub:'Dusk', edge:HK.T.warn }); });
//   a seat face     hudSeatFace('ctx', { id:'leave', when:() => inDungeon(), emblem:'leave', ribbon:'LEAVE', key:'L', action:leave });
//   a book tile     hudControl({ id:'music', label:() => 'MUSIC', emblem:'music', key:'N', on:() => enabled, action:toggle });
//   a boss banner   hudBoss(() => alive ? { mark:'fang', name:'THE FANG', lv:40, hp, max, phase:'FIRE' } : null);
//   a seal          hudSeal('friends', () => ({ show:true, wax:'blue', badge:'2', action:openFriends }));
//   a coach line    HK.teach('talk', 'E', 'Talk to Tobin', { x, y })   (world pixels; shown the first 3 times)
//   a tooltip       give the buttons[] entry { name:'World map', keys:['M'] }
// hudControl / hudMechName / hudSeatFace / hudSeal / hudBoss are hoisted declarations, so files that load before
// this one (10-hud, 15-music, 16-instances, 22-bulldozer ...) can call them at load time.
// ============================================================================

// ---------- registries (hoisted) ----------
// A BOOK TILE in the Knight's Book (the pause menu). The twelve kit tiles are fixed (see KIT_TILES); a registration
// with one of their ids supplies that tile's live behaviour (action, on, label, badge, asleep). Any other id becomes an
// extra tile after the twelve. `show` is ignored for the twelve (they always stand in the book).
function hudControl(def) {
  const list = (hudControl.list = hudControl.list || []);
  const i = list.findIndex(d => d.id === def.id);
  if (i >= 0) list[i] = Object.assign({}, list[i], def); else list.push(def);
  list.sort((a, b) => (a.sort || 100) - (b.sort || 100) || String(a.id).localeCompare(String(b.id)));
  return def;
}
// What to call the machine you are in: feeds the crest's second line ("40 / 60" is the machine, then its name).
function hudMechName(fn) { (hudMechName.list = hudMechName.list || []).push(fn); return fn; }
// A FACE for one of the four touch seats (on desktop: the four medallions on the belt). The first face whose when()
// is true wins, highest prio first. Fields may be values or functions: { id, when, prio, emblem, ribbon, key, name,
// action, hold, lit, on, disabled, asleep, cool:{frac, text}, charge, badge }.
function hudSeatFace(seat, face) {
  const list = (hudSeatFace.list = hudSeatFace.list || []);
  const f = Object.assign({ prio: 0 }, face, { seat });
  const i = f.id ? list.findIndex(d => d.seat === seat && d.id === f.id) : -1;
  if (i >= 0) list[i] = f; else list.push(f);
  return f;
}
// A seal's live state: hudSeal('friends', () => ({ show, wax:'blue'|'grey'|'umber', badge, action, on, name })).
function hudSeal(id, fn) { (hudSeal.map = hudSeal.map || {})[id] = fn; return fn; }
// A boss for the boss banner slots: fn() → null or { id, mark, name, lv, hp, max, phase, sub, heart:{ hp, max } }.
function hudBoss(fn) { (hudBoss.list = hudBoss.list || []).push(fn); return fn; }

const HK = (() => {
  // =================================================================================================
  // TOKENS
  // =================================================================================================
  const T = {
    ink: '#f4ead3', inkDim: '#cdbf9e', inkMute: '#8c8170',
    gold: '#d9b25c', goldHi: '#f7dc8f', goldLo: '#7a5b22',
    gules: '#d23a30', gulesHi: '#ff8a6e', gulesDk: '#6c1119',
    good: '#8ad883', warn: '#f0a93b', bad: '#ef4b3f', friend: '#6fb1ff',
    companion: '#a6f0a0', home: '#58a0ff', enemy: '#ff5a4a', passive: '#f2c14e',
    hole: '#1c1f24', halo: '#ffc452', worldHalo: 'rgba(8,6,4,0.92)',
  };
  const CINZEL = '"Cinzel", "Trajan Pro", Georgia, serif';
  const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const TAU = Math.PI * 2;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const touchOn = () => (typeof touchMode === 'function') ? touchMode() : false;
  // The Text size setting (43-settings). It applies to SENTENCE text only; plates, names and numbers never change size.
  const k = () => (window.SETTINGS && SETTINGS.textScale) ? SETTINGS.textScale() : 1;

  // ---------- fonts: two families. Cinzel for names / numbers / ribbons / titles (fixed size), the system sans for sentences ----------
  // 43-settings installs a font scaler on the game canvas that multiplies every px size by the text scale. A FIXED font is
  // written pre-divided so it lands at its true size; a SENTENCE font is written as-is there, and scaled by hand on any
  // other context (the offscreen caches, a test's recording context).
  const scalerOn = g => { try { return !!Object.getOwnPropertyDescriptor(g, 'font'); } catch (e) { return false; } };
  const FC = (w, px) => ({ fam: CINZEL, w, px, s: false });
  const FS = (w, px) => ({ fam: SANS, w, px, s: true });
  function setF(g, f) {
    if (typeof f === 'string') { g.font = f; return; }
    const kk = k(), inst = scalerOn(g);
    let p = f.px;
    if (f.s) { if (!inst) p = f.px * kk; } else if (inst && kk !== 1) p = f.px / kk;
    g.font = `${f.w} ${Math.round(p * 100) / 100}px ${f.fam}`;
  }
  // the px a font really draws at on this context (sentences grow with the setting)
  const realPx = f => (f.s ? f.px * k() : f.px);
  function tw(g, s, f) { setF(g, f); return g.measureText(String(s)).width; }
  function text(g, s, x, y, o = {}) {
    setF(g, o.font || FC(800, 12)); g.textAlign = o.align || 'left'; g.textBaseline = 'alphabetic';
    s = String(s);
    if (o.halo) { g.lineJoin = 'round'; g.miterLimit = 2; g.lineWidth = o.halo; g.strokeStyle = o.haloColor || T.worldHalo; g.strokeText(s, x, y); }
    if (o.shadow) { g.fillStyle = o.shadow; g.fillText(s, x, y + 1); }
    g.fillStyle = o.color || T.ink; g.fillText(s, x, y);
    const w = g.measureText(s).width;
    if (FIT.on) FIT.log.push({ s, x, y, w, align: o.align || 'left', box: o.box || null, id: o.fitId || null });
    return w;
  }
  // The text-fit log the audit reads: every string the kit draws with the box it had to fit in.
  const FIT = { on: false, log: [] };
  // Balanced, word-safe wrap. Never cuts inside a word; when the lines run out the last one ends at a word and
  // `more` is set (the caller draws a gold chevron and the full text lives one tap away).
  function wrap(g, s, maxW, maxLines, f) {
    setF(g, f);
    const words = String(s).split(/\s+/).filter(Boolean), out = [];
    let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width <= maxW || !cur) cur = t; else { out.push(cur); cur = w; } }
    if (cur) out.push(cur);
    if (out.length <= maxLines) {
      // balance: pull words down from the first line while the last one is short (nicer rag, same line count)
      if (out.length === 2) {
        const all = out.join(' ').split(' ');
        let best = out;
        for (let cut = all.length - 1; cut > 0; cut--) {
          const a = all.slice(0, cut).join(' '), b = all.slice(cut).join(' ');
          if (g.measureText(a).width > maxW || g.measureText(b).width > maxW) continue;
          const d = Math.abs(g.measureText(a).width - g.measureText(b).width), bd = Math.abs(g.measureText(best[0]).width - g.measureText(best[1]).width);
          if (d < bd) best = [a, b];
        }
        return { lines: best, more: false };
      }
      return { lines: out, more: false };
    }
    return { lines: out.slice(0, maxLines), more: true };
  }
  function rr(c, x, y, w, h, r) {
    const [a, b, d, e] = Array.isArray(r) ? r : [r, r, r, r];
    c.beginPath(); c.moveTo(x + a, y); c.lineTo(x + w - b, y); c.arcTo(x + w, y, x + w, y + b, b);
    c.lineTo(x + w, y + h - d); c.arcTo(x + w, y + h, x + w - d, y + h, d); c.lineTo(x + e, y + h);
    c.arcTo(x, y + h, x, y + h - e, e); c.lineTo(x, y + a); c.arcTo(x, y, x + a, y, a); c.closePath();
  }
  function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function shadowed(g, fn, blur = 8, oy = 3, col = 'rgba(0,0,0,0.55)') { g.save(); g.shadowColor = col; g.shadowBlur = blur; g.shadowOffsetY = oy; fn(); g.restore(); }

  // ---------- materials: four procedural grains, built once ----------
  const PAT = {};
  function grain(g, kind) {
    if (kind in PAT) return PAT[kind];
    let p = null;
    try {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      const R = rng({ iron: 3, leather: 5, vellum: 9, cloth: 17 }[kind] || 1);
      if (kind === 'leather') {
        for (let i = 0; i < 2200; i++) { x.fillStyle = R() < 0.55 ? `rgba(0,0,0,${0.12 + R() * 0.25})` : `rgba(255,214,170,${0.03 + R() * 0.07})`; x.beginPath(); x.arc(R() * 128, R() * 128, 0.4 + R() * 1.1, 0, TAU); x.fill(); }
        x.strokeStyle = 'rgba(0,0,0,0.2)'; x.lineWidth = 0.6;
        for (let i = 0; i < 14; i++) { const sx = R() * 128, sy = R() * 128; x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(sx + R() * 20 - 10, sy + R() * 20 - 10, sx + R() * 30 - 15, sy + R() * 30 - 15); x.stroke(); }
      } else if (kind === 'vellum' || kind === 'cloth') {
        for (let i = 0; i < 170; i++) { x.strokeStyle = R() < 0.5 ? `rgba(255,230,190,${0.03 + R() * 0.05})` : `rgba(0,0,0,${0.08 + R() * 0.12})`; x.lineWidth = 0.5 + R() * 0.8; const sx = R() * 128, sy = R() * 128, l = 6 + R() * 22, a = (R() - 0.5) * (kind === 'cloth' ? 0.1 : 0.6); x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke(); }
        for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${R() * 0.18})`; x.fillRect(R() * 128, R() * 128, 1, 1); }
      } else {
        for (let i = 0; i < 2600; i++) { x.fillStyle = R() < 0.5 ? `rgba(0,0,0,${R() * 0.3})` : `rgba(255,255,255,${R() * 0.06})`; x.fillRect(R() * 128, R() * 128, R() < 0.2 ? 2 : 1, 1); }
        x.strokeStyle = 'rgba(255,255,255,0.035)'; for (let i = 0; i < 30; i++) { const sx = R() * 128, sy = R() * 128; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + R() * 40 - 20, sy + R() * 6 - 3); x.stroke(); }
      }
      p = g.createPattern(c, 'repeat') || null;
    } catch (e) { p = null; }
    return (PAT[kind] = p);
  }
  // fills a path with a grain, only over its own box (a full-screen pattern fill per piece would cost a frame)
  function texture(g, kind, alpha, pathFn, bx, by, bw, bh) {
    const p = grain(g, kind); if (!p) return;
    g.save(); pathFn(); g.clip(); g.globalAlpha *= alpha; g.fillStyle = p; g.fillRect(bx - 1, by - 1, bw + 2, bh + 2); g.restore();
  }

  // ---------- offscreen caches for static layers (per size x DPR x state) ----------
  // HK.cache(key, w, h, draw, pad) → draws `draw(cg)` once into a canvas of w x h (plus pad on every side for shadows and
  // halos) at the current DPR, and hands back a blitter. Bounded: the oldest entries go first.
  const CACHE = new Map(); const CACHE_MAX = 260;
  let cacheOff = false;   // the audit turns it off so a recording context sees every draw call
  function cache(g, key, x, y, w, h, draw, pad = 0) {
    const dpr = (typeof DPR === 'number' && DPR) || 1;
    if (cacheOff || typeof document === 'undefined' || !document.createElement) { draw(g, x, y); return; }
    const kk = key + '|' + dpr + '|' + w + 'x' + h + '|' + k();
    let c = CACHE.get(kk);
    if (!c) {
      try {
        c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil((w + pad * 2) * dpr)); c.height = Math.max(1, Math.ceil((h + pad * 2) * dpr));
        const cg = c.getContext('2d'); if (!cg || typeof cg.setTransform !== 'function') { draw(g, x, y); return; }
        cg.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(cg, pad, pad);
      } catch (e) { draw(g, x, y); return; }
      CACHE.set(kk, c);
      if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
    } else { CACHE.delete(kk); CACHE.set(kk, c); }
    g.drawImage(c, x - pad, y - pad, w + pad * 2, h + pad * 2);
  }

  // =================================================================================================
  // EMBLEMS: single-colour drawn marks with cut-outs (no emoji, no glyph fonts). Each draws with the current
  // fillStyle / strokeStyle; `hole` is the face colour used for cut-outs.
  // =================================================================================================
  function starPath(c, cx, cy, R, r, n = 5) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, d = i % 2 ? r : R; const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); }
  function heaterPath(c, x, y, w, h) {
    c.beginPath(); c.moveTo(x, y + h * 0.05); c.quadraticCurveTo(x + w * 0.5, y - h * 0.035, x + w, y + h * 0.05);
    c.lineTo(x + w, y + h * 0.47); c.bezierCurveTo(x + w, y + h * 0.78, x + w * 0.64, y + h * 0.92, x + w * 0.5, y + h);
    c.bezierCurveTo(x + w * 0.36, y + h * 0.92, x, y + h * 0.78, x, y + h * 0.47); c.closePath();
  }
  const bootPath = (c, s) => {   // an iron boot, toe to the right, sole on y = 0.2s
    c.beginPath(); c.moveTo(-s * 0.2, -s * 0.44); c.lineTo(s * 0.08, -s * 0.44); c.lineTo(s * 0.08, -s * 0.04);
    c.quadraticCurveTo(s * 0.14, s * 0.02, s * 0.32, s * 0.04); c.quadraticCurveTo(s * 0.44, s * 0.07, s * 0.42, s * 0.2);
    c.lineTo(-s * 0.24, s * 0.2); c.quadraticCurveTo(-s * 0.26, s * 0.02, -s * 0.2, -s * 0.44); c.closePath();
  };
  const EM = {
    sword(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); const bw = s * 0.17;
      c.beginPath(); c.moveTo(0, -s * 0.5); c.lineTo(bw / 2, -s * 0.5 + bw * 1.2); c.lineTo(bw / 2, s * 0.12); c.lineTo(-bw / 2, s * 0.12); c.lineTo(-bw / 2, -s * 0.5 + bw * 1.2); c.closePath(); c.fill();
      rr(c, -s * 0.25, s * 0.11, s * 0.5, s * 0.09, s * 0.045); c.fill();
      rr(c, -s * 0.048, s * 0.19, s * 0.096, s * 0.21, s * 0.03); c.fill();
      c.beginPath(); c.arc(0, s * 0.44, s * 0.075, 0, TAU); c.fill(); c.restore();
    },
    swing(c, cx, cy, s) {
      c.save(); c.translate(cx, cy);
      const R = s * 0.5, a0 = Math.PI * 0.86, a1 = Math.PI * 1.7, th = s * 0.2, oy = s * 0.05;
      c.save(); c.globalAlpha *= 0.5; c.beginPath();
      for (let i = 0; i <= 24; i++) { const t = i / 24, a = a0 + (a1 - a0) * t; c.lineTo(Math.cos(a) * R, Math.sin(a) * R + oy); }
      for (let i = 24; i >= 0; i--) { const t = i / 24, a = a0 + (a1 - a0) * t, r = R - th * Math.pow(t, 1.3); c.lineTo(Math.cos(a) * r, Math.sin(a) * r + oy); }
      c.closePath(); c.fill(); c.restore();
      c.save(); c.globalAlpha *= 0.35; c.lineWidth = Math.max(1, s * 0.035); c.lineCap = 'round';
      for (const [q, k0, k1] of [[0.34, 0.95, 1.4], [0.24, 1.02, 1.3]]) { c.beginPath(); c.arc(0, oy, q * s, Math.PI * k0, Math.PI * k1); c.stroke(); }
      c.restore();
      c.rotate(Math.PI * 0.25); EM.sword(c, 0, 0, s * 1.02); c.restore();
    },
    // an iron boot coming down on a burst: the walker's and the bulldozer's STOMP
    stomp(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy - s * 0.06);
      bootPath(c, s); c.fill();
      rr(c, -s * 0.26, -s * 0.5, s * 0.38, s * 0.1, s * 0.03); c.fill();
      c.lineWidth = Math.max(1.4, s * 0.075); c.lineCap = 'round';
      c.beginPath();
      for (const [x0, y0, x1, y1] of [[-0.44, 0.3, -0.52, 0.44], [-0.2, 0.32, -0.24, 0.5], [0.04, 0.32, 0.04, 0.52], [0.28, 0.32, 0.32, 0.5], [0.46, 0.3, 0.54, 0.44]]) { c.moveTo(x0 * s, y0 * s); c.lineTo(x1 * s, y1 * s); }
      c.stroke();
      if (hole) { c.fillStyle = hole; for (const x of [-0.14, 0.02]) { c.beginPath(); c.arc(x * s, -s * 0.45, s * 0.028, 0, TAU); c.fill(); } rr(c, -s * 0.2, s * 0.13, s * 0.58, s * 0.035, s * 0.015); c.fill(); }
      c.restore();
    },
    // a barrel with a spike: the Barrelbeast's RAM
    ram(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      rr(c, -s * 0.44, -s * 0.28, s * 0.66, s * 0.56, s * 0.16); c.fill();
      c.beginPath(); c.moveTo(s * 0.18, -s * 0.16); c.lineTo(s * 0.5, 0); c.lineTo(s * 0.18, s * 0.16); c.closePath(); c.fill();
      if (hole) { c.strokeStyle = hole; c.lineWidth = Math.max(1.2, s * 0.06); c.beginPath(); for (const x of [-0.26, 0.02]) { c.moveTo(x * s, -s * 0.26); c.lineTo(x * s, s * 0.26); } c.stroke(); }
      c.restore();
    },
    hand(c, cx, cy, s) {
      c.save(); c.translate(cx, cy + s * 0.04); const fw = s * 0.14;
      for (const [fx, ft] of [[-0.21, -0.25], [-0.07, -0.36], [0.075, -0.34], [0.215, -0.23]]) { rr(c, fx * s - fw / 2, ft * s, fw, (0.12 - ft) * s, fw / 2); c.fill(); }
      rr(c, -s * 0.29, -s * 0.02, s * 0.58, s * 0.4, [s * 0.05, s * 0.05, s * 0.2, s * 0.22]); c.fill();
      c.save(); c.translate(-s * 0.26, s * 0.13); c.rotate(-0.8); rr(c, -fw / 2, -s * 0.27, fw, s * 0.31, fw / 2); c.fill(); c.restore(); c.restore();
    },
    talk(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      rr(c, -s * 0.45, -s * 0.36, s * 0.9, s * 0.6, s * 0.2); c.fill();
      c.beginPath(); c.moveTo(-s * 0.24, s * 0.16); c.lineTo(-s * 0.32, s * 0.45); c.lineTo(-s * 0.02, s * 0.2); c.closePath(); c.fill();
      if (hole) { c.fillStyle = hole; for (const dx of [-0.21, 0, 0.21]) { c.beginPath(); c.arc(dx * s, -s * 0.06, s * 0.068, 0, TAU); c.fill(); } }
      c.restore();
    },
    chat(c, cx, cy, s) { EM.talk(c, cx, cy, s, null); },
    block(c, cx, cy, s, hole) {
      const w = s * 0.8, h = s * 0.94, x = cx - w / 2, y = cy - h / 2;
      heaterPath(c, x, y, w, h); c.fill();
      if (hole) {
        c.save(); c.strokeStyle = hole; c.fillStyle = hole; c.lineWidth = Math.max(1.2, s * 0.055);
        heaterPath(c, x + w * 0.14, y + h * 0.12, w * 0.72, h * 0.74); c.stroke();
        c.beginPath(); c.moveTo(cx, y + h * 0.16); c.lineTo(cx, y + h * 0.82); c.moveTo(x + w * 0.16, y + h * 0.4); c.lineTo(x + w * 0.84, y + h * 0.4); c.stroke();
        c.restore();
      }
    },
    goblin(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      for (const q of [-1, 1]) { c.beginPath(); c.moveTo(q * s * 0.18, -s * 0.16); c.quadraticCurveTo(q * s * 0.42, -s * 0.2, q * s * 0.52, -s * 0.36); c.quadraticCurveTo(q * s * 0.4, -s * 0.02, q * s * 0.2, s * 0.08); c.closePath(); c.fill(); }
      c.beginPath(); c.moveTo(-s * 0.26, -s * 0.12); c.quadraticCurveTo(-s * 0.26, -s * 0.4, 0, -s * 0.4); c.quadraticCurveTo(s * 0.26, -s * 0.4, s * 0.26, -s * 0.12);
      c.quadraticCurveTo(s * 0.28, s * 0.22, 0, s * 0.4); c.quadraticCurveTo(-s * 0.28, s * 0.22, -s * 0.26, -s * 0.12); c.closePath(); c.fill();
      if (hole) {
        c.fillStyle = hole;
        for (const q of [-1, 1]) { c.beginPath(); c.moveTo(q * s * 0.04, -s * 0.08); c.lineTo(q * s * 0.2, -s * 0.15); c.lineTo(q * s * 0.18, -s * 0.03); c.closePath(); c.fill(); }
        c.beginPath(); c.moveTo(-s * 0.16, s * 0.12); c.lineTo(s * 0.16, s * 0.12); c.lineTo(s * 0.1, s * 0.25); c.lineTo(-s * 0.1, s * 0.25); c.closePath(); c.fill();
      }
      c.restore();
    },
    bag(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      c.lineWidth = Math.max(1.6, s * 0.08); c.beginPath(); c.arc(0, -s * 0.2, s * 0.19, Math.PI, 0); c.stroke();
      rr(c, -s * 0.43, -s * 0.2, s * 0.86, s * 0.64, [s * 0.1, s * 0.1, s * 0.17, s * 0.17]); c.fill();
      if (hole) { c.fillStyle = hole; c.beginPath(); c.moveTo(-s * 0.43, -s * 0.02); c.quadraticCurveTo(0, s * 0.24, s * 0.43, -s * 0.02); c.lineTo(s * 0.43, s * 0.03); c.quadraticCurveTo(0, s * 0.3, -s * 0.43, s * 0.03); c.closePath(); c.fill(); rr(c, -s * 0.075, s * 0.04, s * 0.15, s * 0.13, s * 0.02); c.fill(); }
      c.restore();
    },
    pin(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy); c.beginPath(); c.moveTo(0, s * 0.47); c.bezierCurveTo(-s * 0.1, s * 0.22, -s * 0.34, s * 0.04, -s * 0.34, -s * 0.13); c.arc(0, -s * 0.13, s * 0.34, Math.PI, 0); c.bezierCurveTo(s * 0.34, s * 0.04, s * 0.1, s * 0.22, 0, s * 0.47); c.closePath(); c.fill();
      if (hole) { c.fillStyle = hole; c.beginPath(); c.arc(0, -s * 0.13, s * 0.13, 0, TAU); c.fill(); }
      c.restore();
    },
    play(c, cx, cy, s) { c.beginPath(); c.moveTo(cx - s * 0.26, cy - s * 0.38); c.lineTo(cx + s * 0.4, cy); c.lineTo(cx - s * 0.26, cy + s * 0.38); c.closePath(); c.fill(); },
    castle(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.moveTo(-s * 0.44, s * 0.42); c.lineTo(-s * 0.44, -s * 0.3); c.lineTo(-s * 0.3, -s * 0.3); c.lineTo(-s * 0.3, -s * 0.18); c.lineTo(-s * 0.16, -s * 0.18); c.lineTo(-s * 0.16, -s * 0.3);
      c.lineTo(s * 0.16, -s * 0.3); c.lineTo(s * 0.16, -s * 0.18); c.lineTo(s * 0.3, -s * 0.18); c.lineTo(s * 0.3, -s * 0.3); c.lineTo(s * 0.44, -s * 0.3); c.lineTo(s * 0.44, s * 0.42); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-s * 0.1, -s * 0.3); c.lineTo(-s * 0.1, -s * 0.46); c.lineTo(s * 0.1, -s * 0.46); c.lineTo(s * 0.1, -s * 0.3); c.fill();
      if (hole) { c.fillStyle = hole; c.beginPath(); c.moveTo(-s * 0.12, s * 0.42); c.lineTo(-s * 0.12, s * 0.16); c.arc(0, s * 0.16, s * 0.12, Math.PI, 0); c.lineTo(s * 0.12, s * 0.42); c.closePath(); c.fill(); }
      c.restore();
    },
    erase(c, cx, cy, s) { EM.close(c, cx, cy, s); },
    craft(c, cx, cy, s) {
      c.save(); c.translate(cx, cy + s * 0.04);
      c.beginPath(); c.moveTo(-s * 0.47, s * 0.02); c.lineTo(s * 0.36, s * 0.02); c.lineTo(s * 0.36, s * 0.13); c.lineTo(s * 0.18, s * 0.19);
      c.lineTo(s * 0.15, s * 0.29); c.lineTo(s * 0.3, s * 0.4); c.lineTo(-s * 0.24, s * 0.4); c.lineTo(-s * 0.09, s * 0.29); c.lineTo(-s * 0.12, s * 0.19);
      c.quadraticCurveTo(-s * 0.32, s * 0.17, -s * 0.47, s * 0.02); c.closePath(); c.fill();
      c.save(); c.translate(s * 0.02, -s * 0.28); c.rotate(-0.55);
      rr(c, -s * 0.21, -s * 0.09, s * 0.42, s * 0.17, s * 0.03); c.fill(); rr(c, -s * 0.038, s * 0.06, s * 0.076, s * 0.3, s * 0.03); c.fill(); c.restore(); c.restore();
    },
    quests(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      rr(c, -s * 0.3, -s * 0.32, s * 0.6, s * 0.6, s * 0.04); c.fill();
      rr(c, -s * 0.42, -s * 0.42, s * 0.84, s * 0.16, s * 0.08); c.fill(); rr(c, -s * 0.42, s * 0.24, s * 0.84, s * 0.16, s * 0.08); c.fill();
      if (hole) { c.fillStyle = hole; for (const ly of [-0.16, -0.04, 0.08]) c.fillRect(-s * 0.2, ly * s, s * 0.4, Math.max(1, s * 0.05)); }
      c.restore();
    },
    home(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.moveTo(0, -s * 0.45); c.lineTo(s * 0.47, -s * 0.03); c.lineTo(s * 0.35, -s * 0.03); c.lineTo(s * 0.35, s * 0.4); c.lineTo(-s * 0.35, s * 0.4); c.lineTo(-s * 0.35, -s * 0.03); c.lineTo(-s * 0.47, -s * 0.03); c.closePath(); c.fill();
      if (hole) { c.fillStyle = hole; rr(c, -s * 0.1, s * 0.1, s * 0.2, s * 0.3, [s * 0.1, s * 0.1, 0, 0]); c.fill(); }
      c.restore();
    },
    bomb(c, cx, cy, s) {
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.arc(-s * 0.06, s * 0.1, s * 0.33, 0, TAU); c.fill();
      c.save(); c.translate(s * 0.17, -s * 0.15); c.rotate(0.75); rr(c, -s * 0.09, -s * 0.07, s * 0.18, s * 0.14, s * 0.02); c.fill(); c.restore();
      c.lineWidth = Math.max(1.3, s * 0.055); c.lineCap = 'round';
      c.beginPath(); c.moveTo(s * 0.22, -s * 0.21); c.quadraticCurveTo(s * 0.33, -s * 0.36, s * 0.25, -s * 0.44); c.stroke();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.moveTo(s * 0.25 + Math.cos(a) * s * 0.04, -s * 0.44 + Math.sin(a) * s * 0.04); c.lineTo(s * 0.25 + Math.cos(a) * s * 0.11, -s * 0.44 + Math.sin(a) * s * 0.11); c.stroke(); }
      c.restore();
    },
    exit(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); c.lineWidth = Math.max(1.6, s * 0.085); c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(s * 0.06, -s * 0.22); c.lineTo(s * 0.06, -s * 0.4); c.lineTo(-s * 0.38, -s * 0.4); c.lineTo(-s * 0.38, s * 0.4); c.lineTo(s * 0.06, s * 0.4); c.lineTo(s * 0.06, s * 0.22); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.16, 0); c.lineTo(s * 0.32, 0); c.stroke();
      c.beginPath(); c.moveTo(s * 0.47, 0); c.lineTo(s * 0.24, -s * 0.19); c.lineTo(s * 0.24, s * 0.19); c.closePath(); c.fill(); c.restore();
    },
    // an arched doorway with an arrow walking out of it: LEAVE a dungeon
    leave(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); c.lineWidth = Math.max(1.6, s * 0.085); c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-s * 0.4, s * 0.42); c.lineTo(-s * 0.4, -s * 0.12); c.arc(-s * 0.14, -s * 0.12, s * 0.26, Math.PI, 0); c.lineTo(s * 0.12, -s * 0.04); c.stroke();
      c.beginPath(); c.moveTo(s * 0.12, s * 0.2); c.lineTo(s * 0.12, s * 0.42); c.moveTo(-s * 0.56, s * 0.42); c.lineTo(s * 0.02, s * 0.42); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.2, s * 0.08); c.lineTo(s * 0.3, s * 0.08); c.stroke();
      c.beginPath(); c.moveTo(s * 0.5, s * 0.08); c.lineTo(s * 0.26, -s * 0.12); c.lineTo(s * 0.26, s * 0.28); c.closePath(); c.fill(); c.restore();
    },
    map(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      const p = [[-0.45, -0.3], [-0.15, -0.39], [0.15, -0.3], [0.45, -0.39], [0.45, 0.3], [0.15, 0.39], [-0.15, 0.3], [-0.45, 0.39]];
      c.beginPath(); p.forEach(([x, y], i) => i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s)); c.closePath(); c.fill();
      if (hole) {
        c.strokeStyle = hole; c.lineWidth = Math.max(1, s * 0.045);
        c.beginPath(); c.moveTo(-s * 0.15, -s * 0.39); c.lineTo(-s * 0.15, s * 0.3); c.moveTo(s * 0.15, -s * 0.3); c.lineTo(s * 0.15, s * 0.39); c.stroke();
        c.lineWidth = Math.max(1.2, s * 0.065); c.beginPath(); c.moveTo(s * 0.22, -s * 0.19); c.lineTo(s * 0.34, -s * 0.07); c.moveTo(s * 0.34, -s * 0.19); c.lineTo(s * 0.22, -s * 0.07); c.stroke();
        c.setLineDash([s * 0.07, s * 0.05]); c.lineWidth = Math.max(1, s * 0.045); c.beginPath(); c.moveTo(-s * 0.33, s * 0.2); c.quadraticCurveTo(-s * 0.05, -s * 0.22, s * 0.2, -s * 0.03); c.stroke(); c.setLineDash([]);
      }
      c.restore();
    },
    skills(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.moveTo(-s * 0.27, -s * 0.47); c.lineTo(-s * 0.07, -s * 0.47); c.lineTo(s * 0.07, -s * 0.1); c.lineTo(-s * 0.1, -s * 0.05); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(s * 0.27, -s * 0.47); c.lineTo(s * 0.07, -s * 0.47); c.lineTo(-s * 0.07, -s * 0.1); c.lineTo(s * 0.1, -s * 0.05); c.closePath(); c.fill();
      c.beginPath(); c.arc(0, s * 0.16, s * 0.3, 0, TAU); c.fill();
      if (hole) { c.fillStyle = hole; starPath(c, 0, s * 0.17, s * 0.19, s * 0.08); c.fill(); }
      c.restore();
    },
    wiki(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.moveTo(0, -s * 0.25); c.quadraticCurveTo(-s * 0.22, -s * 0.37, -s * 0.47, -s * 0.29); c.lineTo(-s * 0.47, s * 0.3);
      c.quadraticCurveTo(-s * 0.22, s * 0.22, 0, s * 0.35); c.quadraticCurveTo(s * 0.22, s * 0.22, s * 0.47, s * 0.3); c.lineTo(s * 0.47, -s * 0.29); c.quadraticCurveTo(s * 0.22, -s * 0.37, 0, -s * 0.25); c.closePath(); c.fill();
      if (hole) {
        c.strokeStyle = hole; c.lineWidth = Math.max(1, s * 0.045); c.beginPath(); c.moveTo(0, -s * 0.23); c.lineTo(0, s * 0.33);
        for (const q of [-0.11, 0.01, 0.13]) { c.moveTo(-s * 0.37, q * s); c.quadraticCurveTo(-s * 0.2, (q - 0.05) * s, -s * 0.08, q * s); c.moveTo(s * 0.08, q * s); c.quadraticCurveTo(s * 0.2, (q - 0.05) * s, s * 0.37, q * s); }
        c.stroke();
      }
      c.restore();
    },
    // a closed book with a brass clasp over its fore-edge: MENU opens the Knight's Book
    book(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      rr(c, -s * 0.4, -s * 0.44, s * 0.7, s * 0.88, [s * 0.14, s * 0.05, s * 0.05, s * 0.14]); c.fill();
      rr(c, s * 0.08, -s * 0.11, s * 0.4, s * 0.22, s * 0.06); c.fill();
      if (hole) {
        c.strokeStyle = hole; c.fillStyle = hole; c.lineWidth = Math.max(1.1, s * 0.055);
        c.beginPath(); c.moveTo(-s * 0.25, -s * 0.38); c.lineTo(-s * 0.25, s * 0.38); c.stroke();
        rr(c, -s * 0.15, -s * 0.33, s * 0.3, s * 0.15, s * 0.03); c.stroke();
        c.beginPath(); c.arc(s * 0.36, 0, s * 0.055, 0, TAU); c.fill();
      }
      c.restore();
    },
    help(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); c.lineWidth = Math.max(2, s * 0.14); c.lineCap = 'round';
      c.beginPath(); c.arc(0, -s * 0.16, s * 0.2, Math.PI * 1.05, Math.PI * 2.25); c.quadraticCurveTo(0, s * 0.02, 0, s * 0.13); c.stroke();
      c.beginPath(); c.arc(0, s * 0.36, s * 0.085, 0, TAU); c.fill(); c.restore();
    },
    music(c, cx, cy, s, hole, off) {
      c.save(); c.translate(cx, cy); const hr = s * 0.13;
      for (const [hx, hy] of [[-0.2, 0.26], [0.22, 0.18]]) { c.save(); c.translate(hx * s, hy * s); c.rotate(-0.4); c.beginPath(); c.ellipse(0, 0, hr * 1.25, hr, 0, 0, TAU); c.fill(); c.restore(); }
      const lw = Math.max(1.5, s * 0.07); c.lineWidth = lw;
      c.beginPath(); c.moveTo(-s * 0.06, s * 0.24); c.lineTo(-s * 0.06, -s * 0.3); c.moveTo(s * 0.36, s * 0.16); c.lineTo(s * 0.36, -s * 0.38); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.06 - lw / 2, -s * 0.3); c.lineTo(s * 0.36 + lw / 2, -s * 0.38); c.lineTo(s * 0.36 + lw / 2, -s * 0.24); c.lineTo(-s * 0.06 - lw / 2, -s * 0.16); c.closePath(); c.fill();
      if (off) { c.lineWidth = Math.max(2, s * 0.1); c.lineCap = 'round'; c.beginPath(); c.moveTo(-s * 0.42, -s * 0.42); c.lineTo(s * 0.44, s * 0.42); c.stroke(); }
      c.restore();
    },
    friends(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.arc(-s * 0.17, -s * 0.2, s * 0.14, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-s * 0.44, s * 0.2); c.quadraticCurveTo(-s * 0.42, -s * 0.03, -s * 0.17, -s * 0.03); c.quadraticCurveTo(s * 0.08, -s * 0.03, s * 0.1, s * 0.2); c.closePath(); c.fill();
      const front = () => { c.beginPath(); c.arc(s * 0.15, -s * 0.06, s * 0.16, 0, TAU); c.moveTo(-s * 0.15, s * 0.42); c.quadraticCurveTo(-s * 0.13, s * 0.13, s * 0.15, s * 0.13); c.quadraticCurveTo(s * 0.44, s * 0.13, s * 0.46, s * 0.42); c.closePath(); };
      if (hole) { c.save(); c.strokeStyle = hole; c.lineWidth = Math.max(1.5, s * 0.09); front(); c.stroke(); c.restore(); }
      front(); c.fill(); c.restore();
    },
    menu(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); const h = Math.max(2.2, s * 0.13);
      for (const y of [-0.27, 0, 0.27]) { rr(c, -s * 0.34, y * s - h / 2, s * 0.68, h, h / 2); c.fill(); }
      c.restore();
    },
    fang(c, cx, cy, s) {
      c.save(); c.translate(cx, cy);
      rr(c, -s * 0.36, -s * 0.44, s * 0.72, s * 0.15, s * 0.07); c.fill();
      c.beginPath(); c.moveTo(-s * 0.25, -s * 0.31); c.lineTo(s * 0.23, -s * 0.31); c.bezierCurveTo(s * 0.21, s * 0.02, s * 0.12, s * 0.28, -s * 0.07, s * 0.47);
      c.bezierCurveTo(-s * 0.04, s * 0.18, -s * 0.17, -s * 0.06, -s * 0.25, -s * 0.31); c.closePath(); c.fill(); c.restore();
    },
    expand(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); c.lineWidth = Math.max(1.3, s * 0.12); c.lineCap = 'round'; c.lineJoin = 'round';
      const a = s * 0.36, b = s * 0.2;
      c.beginPath(); c.moveTo(a - b, -a); c.lineTo(a, -a); c.lineTo(a, -a + b); c.moveTo(a, -a); c.lineTo(s * 0.07, -s * 0.07);
      c.moveTo(-a + b, a); c.lineTo(-a, a); c.lineTo(-a, a - b); c.moveTo(-a, a); c.lineTo(-s * 0.07, s * 0.07); c.stroke(); c.restore();
    },
    cog(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy); const n = 8, R1 = s * 0.46, R2 = s * 0.34, w = TAU / n / 4;
      c.beginPath();
      for (let i = 0; i < n; i++) { const a = i / n * TAU; [[a - w * 1.7, R2], [a - w, R1], [a + w, R1], [a + w * 1.7, R2]].forEach(([ang, R], q) => { const x = Math.cos(ang) * R, y = Math.sin(ang) * R; (i === 0 && q === 0) ? c.moveTo(x, y) : c.lineTo(x, y); }); }
      c.closePath(); c.fill();
      if (hole) { c.fillStyle = hole; c.beginPath(); c.arc(0, 0, s * 0.17, 0, TAU); c.fill(); }
      c.restore();
    },
    gear(c, cx, cy, s, hole) { EM.cog(c, cx, cy, s, hole); },
    star(c, cx, cy, s) { starPath(c, cx, cy, s * 0.48, s * 0.2); c.fill(); },
    skull(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.arc(0, -s * 0.08, s * 0.35, Math.PI * 0.82, Math.PI * 2.18); c.lineTo(s * 0.21, s * 0.32); c.lineTo(-s * 0.21, s * 0.32); c.closePath(); c.fill();
      if (hole) {
        c.fillStyle = hole; for (const ex of [-0.14, 0.14]) { c.beginPath(); c.arc(ex * s, -s * 0.06, s * 0.09, 0, TAU); c.fill(); }
        c.beginPath(); c.moveTo(0, s * 0.06); c.lineTo(-s * 0.05, s * 0.15); c.lineTo(s * 0.05, s * 0.15); c.closePath(); c.fill();
        for (const tx of [-0.1, -0.015, 0.07]) c.fillRect(tx * s, s * 0.22, s * 0.03, s * 0.1);
      }
      c.restore();
    },
    horseshoe(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy); c.lineWidth = s * 0.17;
      c.beginPath(); c.arc(0, -s * 0.02, s * 0.3, Math.PI * 0.68, Math.PI * 2.32); c.stroke();
      if (hole) { c.fillStyle = hole; for (let i = 0; i < 6; i++) { const a = Math.PI * (0.8 + i * 0.28); c.beginPath(); c.arc(Math.cos(a) * s * 0.3, -s * 0.02 + Math.sin(a) * s * 0.3, s * 0.03, 0, TAU); c.fill(); } }
      c.restore();
    },
    // an arrow going down into a tray: GET DOWN off the mare
    getdown(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); c.lineWidth = Math.max(1.6, s * 0.09); c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(-s * 0.42, s * 0.08); c.lineTo(-s * 0.42, s * 0.42); c.lineTo(s * 0.42, s * 0.42); c.lineTo(s * 0.42, s * 0.08); c.stroke();
      c.beginPath(); c.moveTo(0, -s * 0.46); c.lineTo(0, s * 0.06); c.stroke();
      c.beginPath(); c.moveTo(0, s * 0.28); c.lineTo(-s * 0.2, s * 0.04); c.lineTo(s * 0.2, s * 0.04); c.closePath(); c.fill(); c.restore();
    },
    door(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.moveTo(-s * 0.3, s * 0.43); c.lineTo(-s * 0.3, -s * 0.12); c.arc(0, -s * 0.12, s * 0.3, Math.PI, 0); c.lineTo(s * 0.3, s * 0.43); c.closePath(); c.fill();
      if (hole) { c.fillStyle = hole; c.beginPath(); c.arc(s * 0.14, s * 0.12, s * 0.05, 0, TAU); c.fill(); c.fillRect(-s * 0.02, -s * 0.38, s * 0.04, s * 0.8); }
      c.restore();
    },
    tick(c, cx, cy, s) { c.save(); c.translate(cx, cy); c.lineWidth = Math.max(1.6, s * 0.15); c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-s * 0.32, 0); c.lineTo(-s * 0.08, s * 0.24); c.lineTo(s * 0.34, -s * 0.24); c.stroke(); c.restore(); },
    cloud(c, cx, cy, s) {
      c.save(); c.translate(cx, cy);
      for (const [x, y, r] of [[-0.22, 0.06, 0.2], [0.02, -0.08, 0.26], [0.25, 0.08, 0.18]]) { c.beginPath(); c.arc(x * s, y * s, r * s, 0, TAU); c.fill(); }
      rr(c, -s * 0.42, s * 0.04, s * 0.84, s * 0.22, s * 0.11); c.fill(); c.restore();
    },
    axe(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); c.rotate(-0.6);
      rr(c, -s * 0.04, -s * 0.46, s * 0.08, s * 0.92, s * 0.03); c.fill();
      c.beginPath(); c.moveTo(s * 0.02, -s * 0.36); c.quadraticCurveTo(s * 0.44, -s * 0.44, s * 0.4, -s * 0.12); c.quadraticCurveTo(s * 0.2, -s * 0.18, s * 0.02, -s * 0.12); c.closePath(); c.fill(); c.restore();
    },
    pick(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); c.rotate(-0.6);
      rr(c, -s * 0.04, -s * 0.36, s * 0.08, s * 0.84, s * 0.03); c.fill();
      c.beginPath(); c.moveTo(-s * 0.46, -s * 0.18); c.quadraticCurveTo(0, -s * 0.5, s * 0.46, -s * 0.18); c.quadraticCurveTo(0, -s * 0.36, -s * 0.46, -s * 0.18); c.closePath(); c.fill(); c.restore();
    },
    hook(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); c.lineWidth = Math.max(1.6, s * 0.1); c.lineCap = 'round';
      c.beginPath(); c.moveTo(s * 0.06, -s * 0.44); c.lineTo(s * 0.06, s * 0.12); c.arc(-s * 0.1, s * 0.12, s * 0.16, 0, Math.PI); c.lineTo(-s * 0.26, s * 0.0); c.stroke();
      c.beginPath(); c.arc(s * 0.06, -s * 0.44, s * 0.06, 0, TAU); c.stroke(); c.restore();
    },
    // a cooking pot with a wisp of steam: COOK
    pot(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy + s * 0.06);
      c.beginPath(); c.moveTo(-s * 0.36, -s * 0.06); c.lineTo(s * 0.36, -s * 0.06); c.bezierCurveTo(s * 0.36, s * 0.3, s * 0.2, s * 0.36, 0, s * 0.36); c.bezierCurveTo(-s * 0.2, s * 0.36, -s * 0.36, s * 0.3, -s * 0.36, -s * 0.06); c.closePath(); c.fill();
      rr(c, -s * 0.44, -s * 0.15, s * 0.88, s * 0.11, s * 0.05); c.fill();
      c.lineWidth = Math.max(1.3, s * 0.06); c.lineCap = 'round';
      for (const q of [-1, 1]) { c.beginPath(); c.arc(q * s * 0.4, s * 0.02, s * 0.08, q < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, q < 0 ? Math.PI * 1.5 : Math.PI * 0.5, false); c.stroke(); }
      for (const x of [-0.14, 0.12]) { c.beginPath(); c.moveTo(x * s, -s * 0.24); c.quadraticCurveTo((x + 0.08) * s, -s * 0.34, x * s, -s * 0.42); c.quadraticCurveTo((x - 0.08) * s, -s * 0.5, x * s, -s * 0.58); c.stroke(); }
      if (hole) { c.fillStyle = hole; rr(c, -s * 0.26, s * 0.04, s * 0.52, s * 0.04, s * 0.02); c.fill(); }
      c.restore();
    },
    // the gold NEXT arrow: USE advances the talk page while someone talks
    next(c, cx, cy, s) {
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.moveTo(-s * 0.42, -s * 0.12); c.lineTo(s * 0.06, -s * 0.12); c.lineTo(s * 0.06, -s * 0.34); c.lineTo(s * 0.46, 0); c.lineTo(s * 0.06, s * 0.34); c.lineTo(s * 0.06, s * 0.12); c.lineTo(-s * 0.42, s * 0.12); c.closePath(); c.fill();
      c.restore();
    },
    // a plank split by a boot: a machine's USE only ever crushes planks
    crush(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy);
      c.save(); c.translate(-s * 0.2, s * 0.3); c.rotate(0.28); rr(c, -s * 0.24, -s * 0.08, s * 0.44, s * 0.16, s * 0.03); c.fill(); c.restore();
      c.save(); c.translate(s * 0.22, s * 0.3); c.rotate(-0.28); rr(c, -s * 0.2, -s * 0.08, s * 0.44, s * 0.16, s * 0.03); c.fill(); c.restore();
      c.save(); c.translate(0, -s * 0.18); c.scale(0.62, 0.62); bootPath(c, s); c.fill(); c.restore();
      if (hole) { c.strokeStyle = hole; c.lineWidth = Math.max(1, s * 0.04); c.beginPath(); c.moveTo(-s * 0.02, s * 0.2); c.lineTo(s * 0.04, s * 0.3); c.lineTo(-s * 0.02, s * 0.4); c.stroke(); }
      c.restore();
    },
    // a lightning bolt: the machine SPECIAL (hold to charge)
    bolt(c, cx, cy, s) {
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.moveTo(s * 0.12, -s * 0.48); c.lineTo(-s * 0.26, s * 0.06); c.lineTo(-s * 0.02, s * 0.06); c.lineTo(-s * 0.14, s * 0.48); c.lineTo(s * 0.28, -s * 0.1); c.lineTo(s * 0.03, -s * 0.1); c.closePath(); c.fill();
      c.restore();
    },
    key(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy); c.rotate(-0.6);
      c.beginPath(); c.arc(-s * 0.24, 0, s * 0.2, 0, TAU); c.fill();
      rr(c, -s * 0.08, -s * 0.06, s * 0.56, s * 0.12, s * 0.03); c.fill();
      c.fillRect(s * 0.3, s * 0.02, s * 0.07, s * 0.16); c.fillRect(s * 0.4, s * 0.02, s * 0.07, s * 0.12);
      if (hole) { c.fillStyle = hole; c.beginPath(); c.arc(-s * 0.24, 0, s * 0.08, 0, TAU); c.fill(); }
      c.restore();
    },
    bird(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); c.beginPath(); c.moveTo(-s * 0.46, -s * 0.1); c.quadraticCurveTo(-s * 0.2, -s * 0.36, 0, -s * 0.02); c.quadraticCurveTo(s * 0.2, -s * 0.36, s * 0.46, -s * 0.1);
      c.quadraticCurveTo(s * 0.2, -s * 0.18, 0, s * 0.1); c.quadraticCurveTo(-s * 0.2, -s * 0.18, -s * 0.46, -s * 0.1); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(s * 0.06, s * 0.08); c.lineTo(-s * 0.08, s * 0.3); c.lineTo(s * 0.02, s * 0.3); c.lineTo(-s * 0.08, s * 0.48); c.lineTo(s * 0.16, s * 0.24); c.lineTo(s * 0.06, s * 0.24); c.closePath(); c.fill(); c.restore();
    },
    prop(c, cx, cy, s) {
      c.save(); c.translate(cx, cy); rr(c, -s * 0.46, -s * 0.36, s * 0.92, s * 0.14, s * 0.03); c.fill();
      rr(c, -s * 0.34, -s * 0.22, s * 0.12, s * 0.64, s * 0.03); c.fill(); rr(c, s * 0.22, -s * 0.22, s * 0.12, s * 0.64, s * 0.03); c.fill();
      c.lineWidth = Math.max(1, s * 0.05); c.beginPath(); c.moveTo(-s * 0.06, -s * 0.36); c.lineTo(0, -s * 0.28); c.lineTo(-s * 0.04, -s * 0.22); c.stroke(); c.restore();
    },
    drill(c, cx, cy, s, hole) {
      c.save(); c.translate(cx, cy); c.rotate(0.6);
      c.beginPath(); c.moveTo(-s * 0.2, -s * 0.2); c.lineTo(s * 0.2, -s * 0.2); c.lineTo(0, s * 0.48); c.closePath(); c.fill();
      rr(c, -s * 0.24, -s * 0.44, s * 0.48, s * 0.22, s * 0.04); c.fill();
      if (hole) { c.strokeStyle = hole; c.lineWidth = Math.max(1, s * 0.05); for (const y of [-0.08, 0.06, 0.2]) { c.beginPath(); c.moveTo(-s * 0.16 * (0.48 - y) / 0.68 * 1.4, y * s); c.lineTo(s * 0.18 * (0.48 - y) / 0.68 * 1.4, (y + 0.07) * s); c.stroke(); } }
      c.restore();
    },
    build(c, cx, cy, s) {
      c.save(); c.translate(cx, cy);
      c.beginPath(); c.moveTo(-s * 0.44, s * 0.44); c.lineTo(-s * 0.44, -s * 0.04); c.arc(-s * 0.08, -s * 0.04, s * 0.36, Math.PI, 0); c.lineTo(s * 0.28, s * 0.44); c.lineTo(s * 0.14, s * 0.44); c.lineTo(s * 0.14, -s * 0.04); c.arc(-s * 0.08, -s * 0.04, s * 0.22, 0, Math.PI, true); c.lineTo(-s * 0.3, s * 0.44); c.closePath(); c.fill();
      c.restore();
    },
    arch(c, cx, cy, s) { EM.build(c, cx, cy, s); },
    coin(c, cx, cy, s, hole) { c.beginPath(); c.arc(cx, cy, s * 0.42, 0, TAU); c.fill(); if (hole) { c.strokeStyle = hole; c.lineWidth = Math.max(1, s * 0.06); c.beginPath(); c.arc(cx, cy, s * 0.3, 0, TAU); c.stroke(); c.fillStyle = hole; starPath(c, cx, cy, s * 0.18, s * 0.08); c.fill(); } },
    heart(c, cx, cy, s) { c.beginPath(); c.moveTo(cx, cy + s * 0.36); c.bezierCurveTo(cx - s * 0.58, cy - s * 0.02, cx - s * 0.3, cy - s * 0.52, cx, cy - s * 0.2); c.bezierCurveTo(cx + s * 0.3, cy - s * 0.52, cx + s * 0.58, cy - s * 0.02, cx, cy + s * 0.36); c.closePath(); c.fill(); },
    swords(c, cx, cy, s) {
      for (const a of [-0.72, 0.72]) { c.save(); c.translate(cx, cy); c.rotate(a); c.beginPath(); c.moveTo(0, -s * 0.52); c.lineTo(s * 0.085, -s * 0.38); c.lineTo(s * 0.085, s * 0.14); c.lineTo(-s * 0.085, s * 0.14); c.lineTo(-s * 0.085, -s * 0.38); c.closePath(); c.fill(); rr(c, -s * 0.22, s * 0.12, s * 0.44, s * 0.1, s * 0.05); c.fill(); rr(c, -s * 0.05, s * 0.22, s * 0.1, s * 0.19, s * 0.03); c.fill(); c.restore(); }
    },
    chevron(c, cx, cy, s) { c.save(); c.translate(cx, cy); c.lineWidth = Math.max(1.5, s * 0.16); c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-s * 0.3, -s * 0.14); c.lineTo(0, s * 0.16); c.lineTo(s * 0.3, -s * 0.14); c.stroke(); c.restore(); },
    chevronR(c, cx, cy, s) { c.save(); c.translate(cx, cy); c.rotate(-Math.PI / 2); EM.chevron(c, 0, 0, s); c.restore(); },
    chevronL(c, cx, cy, s) { c.save(); c.translate(cx, cy); c.rotate(Math.PI / 2); EM.chevron(c, 0, 0, s); c.restore(); },
    close(c, cx, cy, s) { c.save(); c.translate(cx, cy); c.lineWidth = Math.max(1.8, s * 0.15); c.lineCap = 'round'; c.beginPath(); c.moveTo(-s * 0.3, -s * 0.3); c.lineTo(s * 0.3, s * 0.3); c.moveTo(s * 0.3, -s * 0.3); c.lineTo(-s * 0.3, s * 0.3); c.stroke(); c.restore(); },
  };
  // draw an emblem struck into the material: a dark copy offset 3.5% down, then the mark
  function emblem(g, name, cx, cy, s, col, o = {}) {
    const f = EM[name]; if (!f) return false;
    const d = Math.max(1, s * 0.035);
    g.save();
    g.fillStyle = g.strokeStyle = o.relief || 'rgba(0,0,0,0.75)';
    g.save(); g.translate(0, d); f(g, cx, cy, s, null, o.off); g.restore();
    if (o.glow) { g.shadowColor = o.glowColor || 'rgba(255,196,90,0.95)'; g.shadowBlur = o.glowBlur || 10; }
    g.fillStyle = g.strokeStyle = col; f(g, cx, cy, s, o.hole === undefined ? T.hole : o.hole, o.off);
    g.restore();
    return true;
  }
  // a mark stamped INTO wax: a light copy offset down, then the dark mark (debossed)
  function deboss(g, name, cx, cy, s, dark, o = {}) {
    const f = EM[name]; if (!f) return;
    g.save(); g.fillStyle = g.strokeStyle = 'rgba(255,215,200,0.32)'; f(g, cx, cy + 1, s, null, o.off); g.restore();
    g.save(); g.fillStyle = g.strokeStyle = dark; f(g, cx, cy, s, o.hole || null, o.off); g.restore();
  }
  function coin(g, cx, cy, r) {
    const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    gr.addColorStop(0, '#fff0b0'); gr.addColorStop(0.45, '#f0c24e'); gr.addColorStop(1, '#a3741f');
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fillStyle = gr; g.fill(); g.strokeStyle = '#4a3209'; g.lineWidth = Math.max(0.8, r * 0.12); g.stroke();
    g.beginPath(); g.arc(cx, cy, r * 0.66, 0, TAU); g.strokeStyle = 'rgba(122,82,18,0.8)'; g.lineWidth = Math.max(0.6, r * 0.09); g.stroke();
    g.fillStyle = 'rgba(122,82,18,0.85)'; starPath(g, cx, cy, r * 0.4, r * 0.17); g.fill();
  }
  function crossedSwords(g, cx, cy, s) {
    for (const a of [-0.72, 0.72]) {
      g.save(); g.translate(cx, cy); g.rotate(a);
      const lw = Math.max(0.9, s * 0.06);
      g.beginPath(); g.moveTo(0, -s * 0.52); g.lineTo(s * 0.085, -s * 0.38); g.lineTo(s * 0.085, s * 0.14); g.lineTo(-s * 0.085, s * 0.14); g.lineTo(-s * 0.085, -s * 0.38); g.closePath();
      const bl = g.createLinearGradient(-s * 0.09, 0, s * 0.09, 0); bl.addColorStop(0, '#ffffff'); bl.addColorStop(1, '#9aa5b1');
      g.fillStyle = bl; g.fill(); g.strokeStyle = '#111418'; g.lineWidth = lw; g.stroke();
      rr(g, -s * 0.22, s * 0.12, s * 0.44, s * 0.1, s * 0.05); g.fillStyle = '#e2bb62'; g.fill(); g.stroke();
      rr(g, -s * 0.05, s * 0.22, s * 0.1, s * 0.19, s * 0.03); g.fillStyle = '#6b3f22'; g.fill(); g.stroke();
      g.beginPath(); g.arc(0, s * 0.45, s * 0.07, 0, TAU); g.fillStyle = '#e2bb62'; g.fill(); g.stroke();
      g.restore();
    }
  }
  function rivet(g, x, y, r, brass) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    if (brass) { gr.addColorStop(0, '#fff2c0'); gr.addColorStop(0.5, '#c79a45'); gr.addColorStop(1, '#4a3310'); }
    else { gr.addColorStop(0, '#eef1f5'); gr.addColorStop(0.45, '#8a929d'); gr.addColorStop(1, '#23272d'); }
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = gr; g.fill();
  }
  function shieldPath(g, x, y, w, h) { heaterPath(g, x, y, w, h); }
  // =================================================================================================
  // CONTROLS. Every control takes a state object:
  //   { pressed, hover, lit, on, disabled, asleep, cool:{ frac, text }, charge, badge, ripple }
  // pressed shows in the very next frame after pointer-down (HK.stateOf reads the live press), and stays >= 100 ms.
  // =================================================================================================
  // the name ribbon across the foot of a stud / under a seal: a swallowtail band
  function ribbon(g, cx, cy, label, o = {}) {
    let size = o.size || 11;
    const h = o.h || Math.round(size * 1.5), t = o.tail != null ? o.tail : Math.round(h * 0.5), maxW = (o.maxW || 999) - 2 * t;
    while (size > 8 && tw(g, label, FC(800, size)) + size * 0.9 > maxW) size -= 0.5;
    const w0 = tw(g, label, FC(800, size));
    const w = Math.round(w0 + size * 0.9), x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
    if (FIT.on) FIT.log.push({ s: label, x: cx, y: y + h / 2, w: w0, align: 'center', box: { x, y, w, h }, id: o.fitId });
    const flags = `${+!!o.on}${+!!o.pressed}${+!!o.lit}${+!!o.dim}`;
    cache(g, `rib|${label}|${size}|${w}|${h}|${t}|${flags}`, x - t, y, w + 2 * t, h + 3, (cg, X, Y) => {
      const bx = X + t, by = Y;
      cg.fillStyle = '#120b07';
      cg.beginPath(); cg.moveTo(bx + 3, by + 3); cg.lineTo(bx - t, by + 3); cg.lineTo(bx - t * 0.55, by + h / 2 + 3); cg.lineTo(bx - t, by + h + 3); cg.lineTo(bx + 3, by + h + 3); cg.closePath(); cg.fill();
      cg.beginPath(); cg.moveTo(bx + w - 3, by + 3); cg.lineTo(bx + w + t, by + 3); cg.lineTo(bx + w + t * 0.55, by + h / 2 + 3); cg.lineTo(bx + w + t, by + h + 3); cg.lineTo(bx + w - 3, by + h + 3); cg.closePath(); cg.fill();
      const bg = cg.createLinearGradient(0, by, 0, by + h); bg.addColorStop(0, o.on ? '#27402a' : o.pressed ? '#24160e' : '#3b2519'); bg.addColorStop(1, o.on ? '#142417' : '#140c07');
      rr(cg, bx, by, w, h, 2); cg.fillStyle = bg; cg.fill();
      cg.strokeStyle = o.lit ? 'rgba(247,220,143,0.95)' : o.on ? 'rgba(138,216,131,0.85)' : 'rgba(217,178,92,0.6)'; cg.lineWidth = 1; cg.stroke();
      const on0 = FIT.on; FIT.on = false;
      text(cg, label, bx + w / 2, by + h / 2 + size * 0.36, { font: FC(800, size), align: 'center', color: o.dim ? T.inkMute : o.lit ? T.goldHi : o.on ? '#c9f5c0' : T.ink });
      FIT.on = on0;
    }, 2);
    const box = { x: x - t, y, w: w + 2 * t, h: h + 3 };
    if (DRAWN.on && !DRAWN.mute) DRAWN.log.push({ id: (o.id || label) + ':ribbon', k: 'r', ...box, deco: o.id || label });
    return box;
  }
  const DRAWN = { on: false, log: [] };   // the audit's record of drawn pieces (ribbons, the strap) this frame
  function studBody(g, cx, cy, R, em, f) {
    const { pr, dis, lit, on } = f, rim = Math.max(4, Math.round(R * 0.14)), fr = R - rim;
    shadowed(g, () => { g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = '#101216'; g.fill(); }, pr ? 1 : 10, pr ? 0 : 4, 'rgba(0,0,0,0.65)');
    const rg = g.createLinearGradient(cx - R, cy - R, cx + R * 0.7, cy + R);
    if (pr) { rg.addColorStop(0, '#1c1f24'); rg.addColorStop(0.6, '#4a5058'); rg.addColorStop(1, '#8b939e'); }
    else if (dis) { rg.addColorStop(0, '#6a6e75'); rg.addColorStop(0.5, '#3a3e44'); rg.addColorStop(1, '#1b1d21'); }
    else if (lit) { rg.addColorStop(0, '#fff0bd'); rg.addColorStop(0.35, '#c79a45'); rg.addColorStop(1, '#3d2a0b'); }
    else { rg.addColorStop(0, '#b3bbc6'); rg.addColorStop(0.4, '#5f6670'); rg.addColorStop(1, '#1b1e23'); }
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = rg; g.fill();
    const fg = g.createRadialGradient(cx - fr * 0.3, cy - fr * 0.45, fr * 0.1, cx, cy, fr * 1.05);
    fg.addColorStop(0, pr ? '#16181c' : dis ? '#29292b' : (f.faceHi || '#3c4149')); fg.addColorStop(1, pr ? '#08090b' : (f.faceLo || '#14161a'));
    g.beginPath(); g.arc(cx, cy, fr, 0, TAU); g.fillStyle = fg; g.fill();
    texture(g, 'iron', 0.6, () => { g.beginPath(); g.arc(cx, cy, fr, 0, TAU); }, cx - fr, cy - fr, fr * 2, fr * 2);
    g.beginPath(); g.arc(cx, cy, fr, 0, TAU); g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 1.5; g.stroke();
    if (pr) { g.beginPath(); g.arc(cx, cy + 1.5, fr - 3, Math.PI * 1.02, Math.PI * 1.98); g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 5; g.stroke(); }
    else { g.beginPath(); g.arc(cx, cy, fr - 1.5, Math.PI * 0.15, Math.PI * 0.85); g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1.5; g.stroke(); }
    const n = R >= 40 ? 10 : 8;
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * TAU; rivet(g, cx + Math.cos(a) * (R - rim / 2), cy + Math.sin(a) * (R - rim / 2), Math.max(1.2, rim * 0.27), lit); }
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1; g.stroke();
    if (em) {
      const es = fr * (f.rib ? 1.02 : 1.3) * (pr ? 0.9 : 1), ey = cy - (f.rib ? fr * 0.12 : 0);
      const ecol = dis ? '#77705f' : lit ? T.goldHi : on ? '#c9f5c0' : (f.emCol || T.ink);
      emblem(g, em, cx, ey, es, ecol, { hole: pr ? '#0e0f12' : T.hole, glow: lit, off: f.off });
    }
    if (pr) { g.beginPath(); g.arc(cx, cy, fr - 1.5, 0, TAU); g.strokeStyle = 'rgba(255,244,214,0.8)'; g.lineWidth = 2; g.stroke(); }
  }
  // IRON STUD: the pressable for DOING things. r is the radius; the ribbon (st.ribbon) rides the lower rim.
  function stud(g, cx, cy, r, em, st = {}) {
    const pr = !!st.pressed, dis = !!st.disabled, lit = !!st.lit && !dis && !pr, on = !!st.on && !dis && !pr, hv = !!st.hover && !pr && !dis;
    const R = r * (pr ? 0.95 : 1), y = cy + (pr ? 2.5 : hv ? -1 : 0);
    g.save();
    if (st.asleep) g.globalAlpha *= 0.45;
    if (lit || on) {
      const col = on ? T.good : T.halo, pulse = on ? 1 : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now() / 1200 * TAU));
      g.save(); g.globalAlpha *= pulse;
      cache(g, `halo|${Math.round(R * 10)}|${col}`, cx - R, y - R, R * 2, R * 2, (cg, X, Y) => shadowed(cg, () => { cg.beginPath(); cg.arc(X + R, Y + R, R + 1.5, 0, TAU); cg.strokeStyle = col; cg.lineWidth = 3; cg.stroke(); }, 18, 0, col), 26);
      g.restore();
    }
    if (hv) shadowed(g, () => { g.beginPath(); g.arc(cx, y, R + 1.5, 0, TAU); g.strokeStyle = T.goldHi; g.lineWidth = 2; g.stroke(); }, 6, 0, T.goldHi);
    const f = { pr, dis, lit, on, rib: !!st.ribbon, off: !!st.off, faceHi: st.faceHi, faceLo: st.faceLo, emCol: st.emCol };
    const key = `stud|${Math.round(R * 10)}|${+pr}${+dis}${+lit}${+on}${+f.rib}${+f.off}|${em}|${st.faceHi || ''}${st.emCol || ''}`;
    cache(g, key, cx - R, y - R, R * 2, R * 2, (cg, ox, oy) => studBody(cg, ox + R, oy + R, R, em, f), 18);
    const fr = R - Math.max(4, Math.round(R * 0.14));
    // the ripple: two rings thrown out from the press, fading over 180 ms
    if (st.ripple != null && st.ripple < 180) {
      const a = 1 - st.ripple / 180, rp = r * 2 < 60 ? [2.5, 5.5] : [5, 11];
      g.beginPath(); g.arc(cx, y, r + rp[0], 0, TAU); g.strokeStyle = `rgba(255,244,214,${0.6 * a})`; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(cx, y, r + rp[1], 0, TAU); g.strokeStyle = `rgba(255,244,214,${0.22 * a})`; g.lineWidth = 2; g.stroke();
    }
    // cooldown: the unready part of the face shaded clockwise from 12, the ready part edged in gold, the time on top
    if (st.cool && st.cool.frac > 0) {
      const fz = cl(st.cool.frac, 0, 1), ey = y - (st.ribbon ? fr * 0.12 : 0);
      g.save(); g.beginPath(); g.moveTo(cx, y); g.arc(cx, y, fr - 1, -Math.PI / 2, -Math.PI / 2 + TAU * fz); g.closePath(); g.fillStyle = 'rgba(4,5,7,0.7)'; g.fill(); g.restore();
      if (fz < 1) { g.beginPath(); g.arc(cx, y, fr - 1, -Math.PI / 2 + TAU * fz, -Math.PI / 2 + TAU); g.strokeStyle = 'rgba(247,220,143,0.95)'; g.lineWidth = 2.5; g.stroke(); }
      if (st.cool.text) text(g, st.cool.text, cx, ey + fr * 0.2, { font: FC(800, Math.max(9, Math.round(fr * 0.5))), align: 'center', color: T.ink, halo: 3 });
    }
    // charge: a gold ring filling outside the rim
    if (st.charge != null && st.charge > 0) {
      const c = cl(st.charge, 0, 1);
      g.save(); g.shadowColor = '#ffd766'; g.shadowBlur = 10; g.beginPath(); g.arc(cx, y, r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * c); g.strokeStyle = '#ffd766'; g.lineWidth = 4; g.lineCap = 'round'; g.stroke(); g.restore();
      g.beginPath(); g.arc(cx, y, r + 5, -Math.PI / 2 + TAU * c, -Math.PI / 2 + TAU); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 4; g.stroke();
    }
    let rb = null;
    if (st.ribbon) rb = ribbon(g, cx, y + r - 2, st.ribbon, { size: st.ribbonSize || (r >= 40 ? 12 : 11), maxW: st.ribbonMaxW || Math.max(r * 1.7, 44), h: 16, lit, dim: dis, on, pressed: pr, id: st.id, fitId: st.id });
    if (st.badge) badge(g, cx + r * 0.72, y - r * 0.72, String(st.badge), r >= 30 ? 11 : 10);
    g.restore();
    return rb;
  }
  function blobPath(g, pts) { g.beginPath(); const n = pts.length; for (let i = 0; i <= n; i++) { const p = pts[i % n], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; i ? g.quadraticCurveTo(p[0], p[1], mx, my) : g.moveTo(mx, my); } g.closePath(); }
  const WAX = { umber: ['#8a5a3a', '#5a361f', '#2a170b'], blue: ['#7aa6e6', '#2c5292', '#0f2143'], grey: ['#9a9a9a', '#5b5b5b', '#262626'], red: ['#dd5b4c', '#9b2121', '#4c0b0c'] };
  function sealBody(g, cx, cy, r, em, wax, f) {
    const [hi0, mid0, dk0] = WAX[wax] || WAX.umber;
    const dark = c => { const n = parseInt(c.slice(1), 16), q = f.pr ? 0.75 : 1; return `rgb(${Math.round((n >> 16 & 255) * q)},${Math.round((n >> 8 & 255) * q)},${Math.round((n & 255) * q)})`; };
    const hi = dark(hi0), mid = dark(mid0), dk = dark(dk0);
    const R = rng(f.seed || 11), pts = [];
    for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; const q = 0.93 + R() * 0.09; pts.push([cx + Math.cos(a) * r * q, cy + Math.sin(a) * r * q]); }
    shadowed(g, () => { blobPath(g, pts); g.fillStyle = dk; g.fill(); }, f.pr ? 1 : 7, f.pr ? 0 : 3, 'rgba(0,0,0,0.6)');
    const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
    gr.addColorStop(0, f.pr ? mid : hi); gr.addColorStop(0.55, mid); gr.addColorStop(1, dk);
    blobPath(g, pts); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1; g.stroke();
    // the stamped ring; pressed flips its highlight to the other side (the seal is pushed in)
    g.beginPath(); g.arc(cx, cy, r * 0.7, 0, TAU); g.strokeStyle = dk; g.lineWidth = Math.max(1.4, r * 0.07); g.stroke();
    if (f.pr) { g.beginPath(); g.arc(cx, cy - 1, r * 0.7, Math.PI * 1.15, Math.PI * 1.85); g.strokeStyle = 'rgba(255,215,200,0.3)'; g.lineWidth = 1; g.stroke(); }
    else { g.beginPath(); g.arc(cx, cy + 1, r * 0.7, Math.PI * 0.15, Math.PI * 0.85); g.strokeStyle = 'rgba(255,215,200,0.3)'; g.lineWidth = 1; g.stroke(); }
    if (em) deboss(g, em, cx, cy, r * (f.scale || 0.92), dk, { off: f.off, hole: mid });
    if (!f.pr) { g.beginPath(); g.ellipse(cx - r * 0.38, cy - r * 0.46, r * 0.26, r * 0.12, -0.5, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fill(); }
  }
  // WAX SEAL: the pressable for OPENING / READING things. wax: 'umber' (MENU, the quest seal, the close seal), 'blue'
  // (FRIENDS only), 'grey' (FRIENDS when offline).
  function seal(g, cx, cy, r, em, wax, st = {}) {
    const pr = !!st.pressed, hv = !!st.hover && !pr;
    const R = r * (pr ? 0.95 : 1), y = cy + (pr ? 2.5 : 0);
    g.save(); if (st.asleep) g.globalAlpha *= 0.45;
    if (hv) shadowed(g, () => { g.beginPath(); g.arc(cx, y, R + 1, 0, TAU); g.strokeStyle = T.goldHi; g.lineWidth = 2; g.stroke(); }, 8, 0, T.goldHi);
    if (st.on) shadowed(g, () => { g.beginPath(); g.arc(cx, y, R + 1.5, 0, TAU); g.strokeStyle = T.good; g.lineWidth = 2.5; g.stroke(); }, 14, 0, T.good);
    const f = { pr, seed: st.seed || 11, scale: st.scale || 0.9, off: st.off };
    cache(g, `seal|${Math.round(R * 10)}|${wax}|${+pr}|${em}|${f.seed}|${f.scale}`, cx - R, y - R, R * 2, R * 2, (cg, ox, oy) => sealBody(cg, ox + R, oy + R, R, em, wax, f), 14);
    if (st.ripple != null && st.ripple < 180) {
      const a = 1 - st.ripple / 180, rp = r * 2 < 60 ? [2.5, 5.5] : [5, 11];
      g.beginPath(); g.arc(cx, y, r + rp[0], 0, TAU); g.strokeStyle = `rgba(255,244,214,${0.6 * a})`; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(cx, y, r + rp[1], 0, TAU); g.strokeStyle = `rgba(255,244,214,${0.22 * a})`; g.lineWidth = 2; g.stroke();
    }
    let rb = null;
    if (st.ribbon) rb = ribbon(g, cx, cy + r + 3, st.ribbon, { size: 10, h: 14, maxW: st.ribbonMaxW || r * 2 + 20, pressed: pr, lit: hv, id: st.id, fitId: st.id });
    if (st.badge) badge(g, cx + r * 0.72, y - r * 0.72, String(st.badge), 11);
    g.restore();
    return rb;
  }
  function badge(g, cx, cy, label, size) {
    const f = FC(800, size), w = Math.max(size + 6, tw(g, label, f) + 8), h = size + 6;
    shadowed(g, () => { rr(g, cx - w / 2, cy - h / 2, w, h, h / 2); g.fillStyle = '#000'; g.fill(); }, 3, 1);
    const gr = g.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); gr.addColorStop(0, '#f6db93'); gr.addColorStop(1, '#b0852e');
    rr(g, cx - w / 2, cy - h / 2, w, h, h / 2); g.fillStyle = gr; g.fill(); g.strokeStyle = '#3d2a08'; g.lineWidth = 1; g.stroke();
    text(g, label, cx, cy + size * 0.36, { font: f, align: 'center', color: '#2a1c07' });
  }

  // ---------- leather: the belt, its pouches and the satchel ----------
  function beltStrap(g, x, y, w, h) {
    ((draw) => draw(g, x, y))((cg, ox, oy) => {
      shadowed(cg, () => { rr(cg, ox, oy, w, h, h * 0.3); cg.fillStyle = '#120b06'; cg.fill(); }, 7, 3, 'rgba(0,0,0,0.6)');
      const gr = cg.createLinearGradient(0, oy, 0, oy + h); gr.addColorStop(0, '#6d4a30'); gr.addColorStop(0.45, '#48301e'); gr.addColorStop(1, '#24160c');
      rr(cg, ox, oy, w, h, h * 0.3); cg.fillStyle = gr; cg.fill();
      texture(cg, 'leather', 0.9, () => rr(cg, ox, oy, w, h, h * 0.3), ox, oy, w, h);
      cg.save(); cg.setLineDash([3, 2.5]); cg.strokeStyle = 'rgba(226,186,124,0.6)'; cg.lineWidth = 1; cg.beginPath(); cg.moveTo(ox + 6, oy + 3.5); cg.lineTo(ox + w - 4, oy + 3.5); cg.moveTo(ox + 6, oy + h - 3.5); cg.lineTo(ox + w - 4, oy + h - 3.5); cg.stroke(); cg.restore();
      rr(cg, ox, oy, w, h, h * 0.3); cg.strokeStyle = 'rgba(0,0,0,0.9)'; cg.lineWidth = 1; cg.stroke();
    });
  }
  function buckle(g, x, y, w, h, strapY, strapH) {
    const tipX = x - Math.round(w * 0.35);
    g.beginPath(); g.moveTo(x + 4, strapY); g.lineTo(tipX + strapH * 0.5, strapY); g.quadraticCurveTo(tipX, strapY + strapH / 2, tipX + strapH * 0.5, strapY + strapH); g.lineTo(x + 4, strapY + strapH); g.closePath();
    const lg = g.createLinearGradient(0, strapY, 0, strapY + strapH); lg.addColorStop(0, '#6d4a30'); lg.addColorStop(1, '#24160c'); g.fillStyle = lg; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1; g.stroke();
    shadowed(g, () => { rr(g, x, y, w, h, 5); g.fillStyle = '#000'; g.fill(); }, 5, 2, 'rgba(0,0,0,0.6)');
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#fbe3a0'); gr.addColorStop(0.45, '#b98b38'); gr.addColorStop(1, '#4d360f');
    rr(g, x, y, w, h, 5); g.fillStyle = gr; g.fill(); g.strokeStyle = '#2c1d05'; g.lineWidth = 1; g.stroke();
    const t = Math.max(4, Math.round(w * 0.24));
    rr(g, x + t, y + t, w - t * 2, h - t * 2, 2); g.fillStyle = lg; g.fill(); g.strokeStyle = '#2c1d05'; g.stroke();
    g.beginPath(); g.moveTo(x + t * 0.6, y + h / 2); g.lineTo(x + w - t * 0.3, y + h / 2); g.strokeStyle = '#2c1d05'; g.lineWidth = 3.5; g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#e8c36e'; g.lineWidth = 2; g.stroke(); g.lineCap = 'butt';
  }
  function pouchShell(g, x, y, s, h, f) {
    const lipY = y + h * 0.6;
    const outer = () => rr(g, x, y + h * 0.1, s, h * 0.9, [s * 0.24, s * 0.24, s * 0.32, s * 0.32]);
    shadowed(g, () => { outer(); g.fillStyle = '#0d0805'; g.fill(); }, f.pr ? 1 : 7, f.pr ? 0 : 3, 'rgba(0,0,0,0.6)');
    const bk = g.createLinearGradient(0, y, 0, lipY); bk.addColorStop(0, f.pr ? '#1a100a' : '#2d1c11'); bk.addColorStop(1, '#120b06');
    outer(); g.fillStyle = bk; g.fill();
    if (f.empty) { g.beginPath(); g.ellipse(x + s / 2, y + h * 0.42, s * 0.3, h * 0.12, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill(); }
  }
  function pouchFront(g, x, y, s, h, f) {
    const lipY = y + h * 0.6;
    const front = () => { g.beginPath(); g.moveTo(x, lipY); g.quadraticCurveTo(x + s / 2, lipY + h * 0.09, x + s, lipY); g.lineTo(x + s, y + h - s * 0.32); g.quadraticCurveTo(x + s, y + h, x + s - s * 0.32, y + h); g.lineTo(x + s * 0.32, y + h); g.quadraticCurveTo(x, y + h, x, y + h - s * 0.32); g.closePath(); };
    const fr = g.createLinearGradient(0, lipY, 0, y + h); fr.addColorStop(0, f.pr ? '#4a2e1b' : '#6a432a'); fr.addColorStop(1, '#2b190e');
    front(); g.fillStyle = fr; g.fill(); texture(g, 'leather', 0.9, front, x, lipY, s, h * 0.4);
    g.save(); g.setLineDash([2.5, 2.5]); g.strokeStyle = f.sel ? 'rgba(247,220,143,0.95)' : 'rgba(222,180,118,0.6)'; g.lineWidth = f.sel ? 1.5 : 1; g.beginPath(); g.moveTo(x + 4, lipY + 3.5); g.quadraticCurveTo(x + s / 2, lipY + h * 0.09 + 3.5, x + s - 4, lipY + 3.5); g.stroke(); g.restore();
    front(); g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 1; g.stroke();
    rr(g, x, y + h * 0.1, s, h * 0.9, [s * 0.24, s * 0.24, s * 0.32, s * 0.32]); g.strokeStyle = f.sel ? 'rgba(247,220,143,0.95)' : 'rgba(0,0,0,0.9)'; g.lineWidth = f.sel ? 2 : 1; g.stroke();
  }
  // POUCH: one hotbar slot (or a pack slot). item = { id, qty } or null. key = '1'..'5' engraved on desktop.
  function pouch(g, r, item, key, st = {}) {
    const pr = !!st.pressed, hv = !!st.hover && !pr, sel = !!st.selected;
    const s = r.w, h = r.h, x = r.x, y = r.y + (pr ? 2 : hv ? -1 : 0);
    const f = { pr, sel, empty: !item };
    if (hv) shadowed(g, () => { rr(g, x, y + h * 0.1, s, h * 0.9, [s * 0.24, s * 0.24, s * 0.32, s * 0.32]); g.strokeStyle = T.goldHi; g.lineWidth = 2; g.stroke(); }, 8, 0, T.goldHi);
    cache(g, `pouchB|${s}|${h}|${+pr}|${+!item}`, x, y, s, h, (cg, ox, oy) => pouchShell(cg, ox, oy, s, h, f), 12);
    if (item && typeof drawItemIcon === 'function') { const isz = Math.round(s * 0.6), bx = Math.round(isz * 0.8); cache(g, `item|${item.id}|${isz}`, x + s / 2 - bx, y + h * 0.42 + (pr ? 2 : 0) - bx, bx * 2, bx * 2, (cg, X, Y) => { try { drawItemIcon(cg, item.id, X + bx, Y + bx, isz); } catch (e) { } }, 2); }
    cache(g, `pouchF|${s}|${h}|${+pr}|${+sel}`, x, y, s, h, (cg, ox, oy) => pouchFront(cg, ox, oy, s, h, f), 12);
    if (item && item.qty > 1) { const lbl = item.qty > 9999 ? Math.floor(item.qty / 1000) + 'k' : String(item.qty); text(g, lbl, x + s - 5, y + h - 6, { font: FC(800, Math.max(11, Math.round(s * 0.24))), align: 'right', color: '#f6d98c', halo: 3 }); }
    if (key) text(g, key, x + 6, y + h * 0.1 + 11, { font: FC(800, 10), color: 'rgba(244,234,211,0.9)', halo: 2.5 });
    if (st.ripple != null && st.ripple < 180) { const a = 1 - st.ripple / 180; rr(g, x - 1, y + h * 0.1 - 1, s + 2, h * 0.9 + 2, s * 0.26); g.strokeStyle = `rgba(247,220,143,${0.9 * a})`; g.lineWidth = 2; g.stroke(); }
    if (pr) { rr(g, x, y + h * 0.1, s, h * 0.9, [s * 0.24, s * 0.24, s * 0.32, s * 0.32]); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill(); }
  }
  // SATCHEL: the BAG at the belt's end
  function satchel(g, r, st = {}) {
    const pr = !!st.pressed, hv = !!st.hover && !pr, w = r.w, h = r.h, x = r.x, y = r.y + (pr ? 2 : hv ? -1 : 0);
    const body = c => rr(c, 0, h * 0.12, w, h * 0.88, [w * 0.16, w * 0.16, w * 0.26, w * 0.26]);
    if (hv) shadowed(g, () => { g.save(); g.translate(x, y); body(g); g.restore(); g.strokeStyle = T.goldHi; g.lineWidth = 2; g.stroke(); }, 8, 0, T.goldHi);
    if (st.on) shadowed(g, () => { g.save(); g.translate(x, y); body(g); g.restore(); g.strokeStyle = T.gold; g.lineWidth = 2; g.stroke(); }, 10, 0, T.gold);
    cache(g, `satchel|${w}|${h}|${+pr}`, x, y, w, h, (cg, ox, oy) => {
      cg.save(); cg.translate(ox, oy);
      shadowed(cg, () => { body(cg); cg.fillStyle = '#0d0805'; cg.fill(); }, pr ? 1 : 8, pr ? 0 : 4, 'rgba(0,0,0,0.6)');
      cg.beginPath(); cg.moveTo(w * 0.3, h * 0.14); cg.quadraticCurveTo(w * 0.5, -h * 0.08, w * 0.7, h * 0.14); cg.strokeStyle = '#2a190e'; cg.lineWidth = 4; cg.stroke(); cg.strokeStyle = 'rgba(0,0,0,0.8)'; cg.lineWidth = 1; cg.stroke();
      const bg = cg.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, pr ? '#4a2e1c' : '#5b3923'); bg.addColorStop(1, '#2a180d');
      body(cg); cg.fillStyle = bg; cg.fill(); texture(cg, 'leather', 0.9, () => body(cg), 0, 0, w, h);
      const fl = () => { cg.beginPath(); cg.moveTo(-1, h * 0.16); cg.lineTo(w + 1, h * 0.16); cg.lineTo(w + 1, h * 0.42); cg.quadraticCurveTo(w / 2, h * 0.66, -1, h * 0.42); cg.closePath(); };
      const fg = cg.createLinearGradient(0, h * 0.14, 0, h * 0.6); fg.addColorStop(0, '#7a4e30'); fg.addColorStop(1, '#40271a');
      shadowed(cg, () => { fl(); cg.fillStyle = fg; cg.fill(); }, 4, 2); texture(cg, 'leather', 0.9, fl, 0, 0, w, h);
      cg.save(); cg.setLineDash([2.5, 2.5]); cg.strokeStyle = 'rgba(222,180,118,0.6)'; cg.lineWidth = 1; cg.beginPath(); cg.moveTo(4, h * 0.44); cg.quadraticCurveTo(w / 2, h * 0.62, w - 4, h * 0.44); cg.stroke(); cg.restore();
      fl(); cg.strokeStyle = 'rgba(0,0,0,0.85)'; cg.lineWidth = 1; cg.stroke();
      rr(cg, w / 2 - 5, h * 0.28, 10, h * 0.34, 2); cg.fillStyle = '#2b190d'; cg.fill(); cg.strokeStyle = 'rgba(0,0,0,0.8)'; cg.stroke();
      rr(cg, w / 2 - 7, h * 0.46, 14, 9, 2); cg.fillStyle = '#c9a052'; cg.fill(); cg.strokeStyle = '#3a2708'; cg.stroke();
      text(cg, 'BAG', w / 2, h * 0.9, { font: FC(800, Math.max(11, Math.round(w * 0.22))), align: 'center', color: '#f1dfb4', shadow: 'rgba(0,0,0,0.9)' });
      body(cg); cg.strokeStyle = 'rgba(0,0,0,0.9)'; cg.lineWidth = 1; cg.stroke();
      cg.restore();
    }, 14);
    if (st.ripple != null && st.ripple < 180) { const a = 1 - st.ripple / 180; g.save(); g.translate(x, y); body(g); g.restore(); g.strokeStyle = `rgba(247,220,143,${0.9 * a})`; g.lineWidth = 2; g.stroke(); }
  }

  // ---------- iron plates: plaques (readouts), plate buttons (panel verbs) ----------
  function plateBody(g, x, y, w, h, o = {}) {
    shadowed(g, () => { rr(g, x, y, w, h, 6); g.fillStyle = '#0b0c0e'; g.fill(); }, o.pr ? 1 : 8, o.pr ? 0 : 3);
    const gr = g.createLinearGradient(0, y, 0, y + h);
    if (o.pr) { gr.addColorStop(0, '#121418'); gr.addColorStop(1, '#262a31'); } else { gr.addColorStop(0, o.top || '#2d3138'); gr.addColorStop(1, o.bot || '#16181c'); }
    rr(g, x, y, w, h, 6); g.fillStyle = gr; g.fill(); texture(g, 'iron', 0.6, () => rr(g, x, y, w, h, 6), x, y, w, h);
    g.beginPath(); g.moveTo(x + 6, y + (o.pr ? h - 1.5 : 1.5)); g.lineTo(x + w - 6, y + (o.pr ? h - 1.5 : 1.5)); g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1; g.stroke();
    rr(g, x, y, w, h, 6); g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1; g.stroke();
    if (o.rivets !== false && h >= 26 && w >= 60) for (const [px, py] of [[x + w - 6, y + 6], [x + w - 6, y + h - 6]]) rivet(g, px, py, 1.8);
  }
  function meterBar(g, x, y, w, h, frac, col, o = {}) {
    rr(g, x, y, w, h, h / 2); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1; g.stroke();
    if (o.trail != null && o.trail > frac) { rr(g, x + 1, y + 1, Math.max(h - 2, (w - 2) * cl(o.trail, 0, 1)), h - 2, (h - 2) / 2); g.fillStyle = 'rgba(255,220,205,0.6)'; g.fill(); }
    const f = cl(frac, 0, 1);
    if (f > 0) {
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, o.hi || '#ff8266'); gr.addColorStop(0.5, col || '#d8322b'); gr.addColorStop(1, o.lo || '#6d1016');
      rr(g, x + 1, y + 1, Math.max(h - 2, (w - 2) * f), h - 2, (h - 2) / 2); g.fillStyle = gr; g.fill();
      g.beginPath(); g.moveTo(x + 3, y + 2.5); g.lineTo(x + Math.max(h - 2, (w - 2) * f) - 2, y + 2.5); g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1; g.stroke();
    }
    if (o.ticks) { g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1; for (let i = 1; i < o.ticks; i++) { const tx = Math.round(x + w * i / o.ticks) + 0.5; g.beginPath(); g.moveTo(tx, y + 2); g.lineTo(tx, y + h - 2); g.stroke(); } }
  }
  // the ramp every health-like bar uses: green > 50%, amber > 25%, red below
  const ramp = f => f > 0.5 ? T.good : f > 0.25 ? T.warn : T.bad;
  const RAMP_BAR = { [T.good]: ['#9ce68e', '#3fae4a', '#1d5a22'], [T.warn]: ['#ffd08a', '#e8a33d', '#7a4a0e'], [T.bad]: ['#ff8266', '#d8322b', '#6d1016'] };
  function portrait(g, cx, cy, r, o = {}) {
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
    g.fillStyle = o.down ? '#3a1d1d' : '#35506b'; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    g.beginPath(); g.arc(cx, cy - r * 0.05, r * 0.62, Math.PI * 1.05, Math.PI * 1.95); g.lineTo(cx + r * 0.68, cy + r * 0.9); g.lineTo(cx - r * 0.68, cy + r * 0.9); g.closePath(); g.fillStyle = o.hair || '#9a4a1f'; g.fill();
    g.beginPath(); g.arc(cx, cy + r * 0.05, r * 0.46, 0, TAU); g.fillStyle = o.skin || '#eab78e'; g.fill();
    g.beginPath(); g.arc(cx, cy - r * 0.12, r * 0.5, Math.PI * 1.08, Math.PI * 1.92); g.quadraticCurveTo(cx, cy - r * 0.2, cx - r * 0.46, cy - r * 0.3); g.fillStyle = o.hair || '#b5552a'; g.fill();
    g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(cx - r * 0.17, cy + r * 0.05, r * 0.06, 0, TAU); g.arc(cx + r * 0.17, cy + r * 0.05, r * 0.06, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(cx, cy + r * 1.1, r * 0.8, r * 0.45, 0, 0, TAU); g.fillStyle = o.tunic || '#4f7a3a'; g.fill();
    if (o.down) { g.fillStyle = 'rgba(80,0,0,0.45)'; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
    g.restore();
  }
  // PLAQUE: a contextual readout. { emblem | portrait:{hair, skin, tunic, down}, name, right, sub, frac, bar:'good'|'warn'|'bad'|colour,
  //   edge (a meaning colour for the plate's edge), stars:{n, of}, more (brass +n badge), emblemColor, nameColor, rightColor, alpha }
  function plaque(g, r, o = {}) {
    const { x, y, w, h } = r;
    g.save(); if (o.alpha != null) g.globalAlpha *= cl(o.alpha, 0, 1);
    cache(g, `plaque|${w}|${h}`, x, y, w, h, (cg, ox, oy) => plateBody(cg, ox, oy, w, h), 12);
    if (o.edge) { rr(g, x + 0.5, y + 0.5, w - 1, h - 1, 6); g.strokeStyle = o.edge; g.lineWidth = 1.5; g.stroke(); }
    const rd = h - 8, rcx = x + 4 + rd / 2, rcy = y + h / 2;
    let tx = x + 10;
    if (o.emblem || o.portrait) {
      g.beginPath(); g.arc(rcx, rcy, rd / 2, 0, TAU); g.fillStyle = '#111317'; g.fill();
      if (o.portrait) portrait(g, rcx, rcy, rd / 2 - 2, o.portrait);
      else emblem(g, o.emblem, rcx, rcy, rd * 0.6, o.emblemColor || T.ink, { hole: '#111317' });
      g.beginPath(); g.arc(rcx, rcy, rd / 2 - 1, 0, TAU); g.strokeStyle = o.edge || 'rgba(217,178,92,0.7)'; g.lineWidth = 2; g.stroke();
      tx = x + rd + 12;
    }
    const right = o.right != null ? String(o.right) : '';
    const rf = FC(800, 11), rw = right ? tw(g, right, rf) + 12 : 0;
    const stars = o.stars ? o.stars.of * 16 + 6 : 0;
    const lineTop = (o.sub || o.frac != null) ? y + 17 : y + h / 2 + 5;
    let ns = 13; const name = String(o.name || '');
    while (ns > 9 && tw(g, name, FC(800, ns)) > x + w - 14 - tx - rw - stars) ns -= 0.5;
    text(g, name, tx, lineTop, { font: FC(800, ns), color: o.nameColor || T.ink, shadow: 'rgba(0,0,0,0.9)', box: { x: tx, y: y, w: x + w - 14 - rw - stars - tx, h }, fitId: 'plaque:name' });
    if (o.stars) { let sx = tx + tw(g, name, FC(800, ns)) + 8; for (let i = 0; i < o.stars.of; i++) { starPath(g, sx + 7, y + 12, 7, 3); g.fillStyle = i < o.stars.n ? T.goldHi : 'rgba(0,0,0,0.5)'; g.fill(); g.strokeStyle = '#3a2708'; g.lineWidth = 1; g.stroke(); sx += 16; } }
    if (right) text(g, right, x + w - 14, y + 17, { font: rf, align: 'right', color: o.rightColor || T.inkDim, shadow: 'rgba(0,0,0,0.9)' });
    if (o.frac != null) {
      const col = o.bar ? (o.bar === 'good' ? T.good : o.bar === 'warn' ? T.warn : o.bar === 'bad' ? T.bad : o.bar) : ramp(o.frac);
      const st = RAMP_BAR[col] || ['#ff8266', col, '#6d1016'];
      meterBar(g, tx, y + h - 15, x + w - 14 - tx, 9, o.frac, st[1], { hi: st[0], lo: st[2] });
    } else if (o.sub) {
      const sf = FS(600, 12); let sub = String(o.sub);
      const maxW = x + w - 14 - tx;
      if (tw(g, sub, sf) > maxW) { const ww = wrap(g, sub, maxW, 1, sf); sub = ww.lines[0] || ''; }
      text(g, sub, tx, y + h - 9, { font: sf, color: o.subColor || T.inkDim, shadow: 'rgba(0,0,0,0.9)', box: { x: tx, y, w: maxW, h }, fitId: 'plaque:sub' });
    }
    if (o.more) badge(g, x + w - 6, y + 6, '+' + o.more, 10);
    g.restore();
  }
  // PLATE BUTTON: a panel verb (and the book's rows). tone: 'primary' (gold edge) | 'danger' (red edge) | 'warn' | null.
  function plateButton(g, r, em, label, tone, st = {}) {
    const pr = !!st.pressed, hv = !!st.hover && !pr, dis = !!st.disabled, { x, w, h } = r, y = r.y + (pr ? 1.5 : 0);
    if (hv) shadowed(g, () => { rr(g, x, y, w, h, 6); g.strokeStyle = T.goldHi; g.lineWidth = 2; g.stroke(); }, 10, 0, T.goldHi);
    cache(g, `plateB|${w}|${h}|${+pr}|${+dis}`, x, y, w, h, (cg, ox, oy) => plateBody(cg, ox, oy, w, h, { pr, top: dis ? '#24272c' : null, bot: dis ? '#15171a' : null }), 12);
    const edge = dis ? null : tone === 'primary' ? 'rgba(217,178,92,0.95)' : tone === 'danger' ? 'rgba(239,75,63,0.9)' : tone === 'warn' ? 'rgba(240,169,59,0.9)' : st.on ? 'rgba(138,216,131,0.9)' : null;
    if (edge) { rr(g, x + 1, y + 1, w - 2, h - 2, 5); g.strokeStyle = edge; g.lineWidth = 1.5; g.stroke(); }
    let tx = x + w / 2, align = 'center', room = w - 14;
    if (em && h >= 30) {
      const rd = h - 10, rcx = x + 5 + rd / 2, rcy = y + h / 2;
      g.beginPath(); g.arc(rcx, rcy, rd / 2, 0, TAU); g.fillStyle = '#111317'; g.fill();
      g.beginPath(); g.arc(rcx, rcy, rd / 2 - 1, 0, TAU); g.strokeStyle = tone === 'danger' ? 'rgba(239,75,63,0.7)' : 'rgba(217,178,92,0.7)'; g.lineWidth = 1.5; g.stroke();
      emblem(g, em, rcx, rcy, rd * 0.56, tone === 'danger' ? '#ffb4a8' : T.ink, { hole: '#111317' });
      tx = x + rd + 14; align = 'left'; room = w - rd - 24 - (st.key ? keycapW(g, st.key, 11) + 14 : 0);
    }
    const col = dis ? T.inkMute : tone === 'danger' ? '#ffb4a8' : hv ? T.goldHi : T.ink;
    const fam = st.cinzel ? FC : (a, b) => FS(a, b);
    let size = st.size || (st.cinzel ? Math.min(15, Math.round(h * 0.36)) : Math.min(14, Math.max(11, Math.round(h * 0.34))));
    const minS = st.cinzel ? 10 : 9;
    while (size > minS && tw(g, label, fam(st.cinzel ? 800 : 700, size)) > room) size -= 0.5;
    let shown = String(label);
    if (tw(g, shown, fam(st.cinzel ? 800 : 700, size)) > room) { const ww = wrap(g, shown, room, 1, fam(st.cinzel ? 800 : 700, size)); shown = ww.lines[0] || shown; }
    text(g, shown, tx, y + h / 2 + realPx(fam(700, size)) * 0.36, { font: fam(st.cinzel ? 800 : 700, size), align, color: col, shadow: 'rgba(0,0,0,0.9)', box: { x: x + 7, y, w: w - 14, h }, fitId: 'button' });
    if (st.key && h >= 28 && w >= 110) keycap(g, x + w - 12 - keycapW(g, st.key, 11), y + h / 2 - 10, st.key, 11);
  }
  // BOOK TILE: one of the kit's twelve (an iron stud with its word under it, and a keycap on desktop)
  function bookTile(g, cx, cy, D, em, word, key, st = {}) {
    stud(g, cx, cy, D / 2, em, { pressed: st.pressed, hover: st.hover, on: st.on, lit: st.lit, disabled: st.disabled, asleep: st.asleep, off: st.off, cool: st.cool, ripple: st.ripple });
    if (st.badge) badge(g, cx + D * 0.36, cy - D * 0.38, String(st.badge), 11);
    let size = D >= 50 ? 12 : 11; while (size > 9 && tw(g, word, FC(800, size)) > (st.maxW || D + 34)) size -= 0.5;
    const ly = cy + D / 2 + 15;
    text(g, word, cx, ly, { font: FC(800, size), align: 'center', color: st.hover ? T.goldHi : st.asleep ? T.inkMute : T.ink, shadow: 'rgba(0,0,0,0.9)', box: { x: cx - (st.maxW || D + 34) / 2, y: ly - 12, w: st.maxW || D + 34, h: 16 }, fitId: 'tile' });
    if (key) { const kw = keycapW(g, key, 10); keycap(g, cx - kw / 2, ly + 5, key, 10); }
  }
  // THE STICK: a quiet engraved ring with four chevrons and a steel knob; no word. held = the rim warms to gold.
  function stickRing(g, cx, cy, r, knob, held) {
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fillStyle = held ? 'rgba(12,10,8,0.30)' : 'rgba(12,10,8,0.22)'; g.fill();
    g.strokeStyle = held ? 'rgba(247,220,143,0.75)' : 'rgba(244,234,211,0.34)'; g.lineWidth = held ? 2.5 : 2; g.stroke();
    g.beginPath(); g.arc(cx, cy, r - 6, 0, TAU); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = held ? 'rgba(247,220,143,0.6)' : 'rgba(244,234,211,0.5)';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.save(); g.translate(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72); g.rotate(a); g.beginPath(); g.moveTo(r * 0.12, 0); g.lineTo(-r * 0.06, -r * 0.11); g.lineTo(-r * 0.06, r * 0.11); g.closePath(); g.fill(); g.restore(); }
    const kx = knob ? knob.x : cx, ky = knob ? knob.y : cy, kr = r * 0.36;
    const kg = g.createRadialGradient(kx - kr * 0.35, ky - kr * 0.4, kr * 0.1, kx, ky, kr);
    kg.addColorStop(0, held ? 'rgba(200,206,214,0.85)' : 'rgba(170,176,186,0.35)'); kg.addColorStop(1, held ? 'rgba(40,44,50,0.85)' : 'rgba(30,33,38,0.35)');
    g.beginPath(); g.arc(kx, ky, kr, 0, TAU); g.fillStyle = kg; g.fill(); g.strokeStyle = held ? 'rgba(0,0,0,0.7)' : 'rgba(244,234,211,0.28)'; g.lineWidth = 1.5; g.stroke();
    g.restore();
  }

  // =================================================================================================
  // READOUTS
  // =================================================================================================
  function vellumPlate(g, x, y, w, h, o = {}) {
    w = Math.round(w); h = Math.round(h);
    cache(g, `vellum|${w}|${h}|${o.edge || ''}`, x, y, w, h, (cg, X, Y) => {
      shadowed(cg, () => { rr(cg, X, Y, w, h, 5); cg.fillStyle = '#0b0906'; cg.fill(); }, 10, 4);
      const vg = cg.createLinearGradient(0, Y, 0, Y + h); vg.addColorStop(0, '#31281e'); vg.addColorStop(1, '#1d1712');
      rr(cg, X, Y, w, h, 5); cg.fillStyle = vg; cg.fill(); texture(cg, 'vellum', 1, () => rr(cg, X, Y, w, h, 5), X, Y, w, h);
      rr(cg, X + 2.5, Y + 2.5, w - 5, h - 5, 3); cg.strokeStyle = o.edge || 'rgba(217,178,92,0.5)'; cg.lineWidth = 1; cg.stroke();
      rr(cg, X, Y, w, h, 5); cg.strokeStyle = 'rgba(0,0,0,0.9)'; cg.lineWidth = 1; cg.stroke();
    }, 16);
  }
  function keycapW(g, key, size) { return Math.max(size + 10, tw(g, key, FC(800, size)) + 12); }
  function keycap(g, x, y, key, size = 11) {
    const w = keycapW(g, key, size), h = size + 10;
    rr(g, x, y + 2, w, h - 1, 4); g.fillStyle = '#4a3d29'; g.fill();
    const gr = g.createLinearGradient(0, y, 0, y + h - 3); gr.addColorStop(0, '#f6ebcf'); gr.addColorStop(1, '#cdbb90');
    rr(g, x, y, w, h - 3, 4); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(40,28,10,0.8)'; g.lineWidth = 1; g.stroke();
    text(g, key, x + w / 2, y + (h - 3) / 2 + size * 0.36, { font: FC(800, size), align: 'center', color: '#2a1d0c' });
    return w;
  }
  // TOOLTIP (desktop hover, 350 ms): a vellum plate with the name and drawn keycaps. Placement searches the four sides of
  // the anchor and keeps the first that clears every HUD rect it is told about.
  function tooltip(g, anchor, title, keys = [], sub, avoid = []) {
    const tf = FC(800, 12), sf = FS(600, 12);
    const wT = tw(g, title, tf), kws = keys.map(q => keycapW(g, q, 11)), wK = kws.reduce((a, b) => a + b + 5, 0);
    const wS = sub ? tw(g, sub, sf) : 0;
    const w = Math.round(Math.max(wT + (keys.length ? 12 + wK : 0), wS) + 24), h = sub ? 50 : 32;
    const a = anchor.k === 'c' ? { x: anchor.x - anchor.r, y: anchor.y - anchor.r, w: anchor.r * 2, h: anchor.r * 2 } : anchor;
    const cands = [
      ['left', a.x - 12 - w, a.y + a.h / 2 - h / 2], ['down', a.x + a.w / 2 - w / 2, a.y + a.h + 12],
      ['up', a.x + a.w / 2 - w / 2, a.y - 12 - h], ['right', a.x + a.w + 12, a.y + a.h / 2 - h / 2],
    ];
    const hits = (x, y) => avoid.some(q => q !== anchor && x < q.x + q.w && q.x < x + w && y < q.y + q.h && q.y < y + h);
    let pick = cands.find(([, x, y]) => x >= 6 && y >= 6 && x + w <= VW - 6 && y + h <= VH - 6 && !hits(x, y)) || cands.find(([, x, y]) => x >= 6 && y >= 6 && x + w <= VW - 6 && y + h <= VH - 6) || cands[0];
    let [side, x, y] = pick; x = cl(x, 6, VW - w - 6); y = cl(y, 6, VH - h - 6);
    vellumPlate(g, x, y, w, h);
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    g.beginPath();
    if (side === 'left') { g.moveTo(x + w, ay - 6); g.lineTo(x + w + 8, ay); g.lineTo(x + w, ay + 6); }
    else if (side === 'right') { g.moveTo(x, ay - 6); g.lineTo(x - 8, ay); g.lineTo(x, ay + 6); }
    else if (side === 'up') { g.moveTo(ax - 6, y + h); g.lineTo(ax, y + h + 8); g.lineTo(ax + 6, y + h); }
    else { g.moveTo(ax - 6, y); g.lineTo(ax, y - 8); g.lineTo(ax + 6, y); }
    g.closePath(); g.fillStyle = '#261f17'; g.fill(); g.strokeStyle = 'rgba(217,178,92,0.5)'; g.stroke();
    text(g, title, x + 12, y + 21, { font: tf, color: T.ink });
    let kx = x + 12 + wT + 12; keys.forEach((q, i) => { keycap(g, kx, y + 7, q, 11); kx += kws[i] + 5; });
    if (sub) text(g, sub, x + 12, y + 40, { font: sf, color: T.inkDim });
    return { x, y, w, h };
  }
  // TAG: a small vellum tag with a pointer tooth, above a point (the long-press name, a world label)
  // side 'right': (cx, by) is the point the tag stands beside, on its left, vertically centred on it
  function tag(g, cx, by, label, o = {}) {
    const f = FS(700, 13), w = Math.max(o.side === 'right' ? 40 : 60, tw(g, label, f) + 22 + (o.key ? keycapW(g, o.key, 11) + 8 : 0) + (o.emblem ? 22 : 0)), h = 30;
    const right = o.side === 'right';
    const x = right ? cl(Math.round(cx + 8), 6, VW - w - 6) : cl(Math.round(cx - w / 2), 6, VW - w - 6), y = right ? cl(Math.round(by - h / 2), 6, VH - h - 6) : cl(Math.round(by - h - 8), 6, VH - h - 6);
    vellumPlate(g, x, y, w, h, { edge: o.edge });
    const tx = cl(cx, x + 10, x + w - 10);
    g.beginPath();
    if (right) { const ty = cl(by, y + 8, y + h - 8); g.moveTo(x, ty - 6); g.lineTo(x - 7, ty); g.lineTo(x, ty + 6); }
    else { g.moveTo(tx - 6, y + h); g.lineTo(tx, y + h + 7); g.lineTo(tx + 6, y + h); }
    g.closePath(); g.fillStyle = '#211b14'; g.fill(); g.strokeStyle = o.edge || 'rgba(217,178,92,0.5)'; g.lineWidth = 1; g.stroke();
    let px = x + 11;
    if (o.key) px += keycap(g, px, y + 6, o.key, 11) + 8;
    if (o.emblem) { emblem(g, o.emblem, px + 8, y + h / 2, 17, T.goldHi, { hole: '#241d15' }); px += 22; }
    text(g, label, px, y + 20, { font: f, color: T.ink });
    return { x, y, w, h };
  }
  // the world prompt: gold corner brackets on the faced tile / person, drawn in WORLD space (inside the camera transform)
  function brackets(g, x, y, w, h, t) {
    const a = 0.75 + 0.25 * Math.sin(now() / 400), L = Math.min(10, w * 0.3);
    g.save(); g.strokeStyle = `rgba(247,220,143,${a})`; g.lineWidth = 2.5; g.lineCap = 'round'; g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 3;
    g.beginPath();
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { g.moveTo(cx + sx * L, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + sy * L); }
    g.stroke(); g.restore();
  }

  // ---------- notice ribbon, banners ----------
  function noticeRibbon(g, r0, msg, alpha = 1, slide = 0) {
    const tails = 2 * (Math.round(r0.h * 0.7) - 8 + Math.round(r0.h * 0.28));
    const want = Math.min(r0.w, Math.max(200, tw(g, msg, FS(600, 14)) + 40 + tails));
    const r = { x: Math.round(r0.x + (r0.w - want) / 2), y: r0.y, w: want, h: r0.h };
    const { x, w, h } = r, y = r.y - slide;
    g.save(); g.globalAlpha *= cl(alpha, 0, 1);
    const t = Math.round(h * 0.7), n = Math.round(h * 0.28);
    const inner = { x: x + t - 8 + n, w: w - 2 * (t - 8 + n) };
    const tail = (dir) => {
      const ex = dir < 0 ? inner.x + 10 : inner.x + inner.w - 10, ox = dir < 0 ? inner.x - t + 8 : inner.x + inner.w + t - 8;
      g.beginPath(); g.moveTo(ex, y + 5); g.lineTo(ox, y + 5); g.lineTo(ox - dir * n, y + h / 2 + 5); g.lineTo(ox, y + h + 5); g.lineTo(ex, y + h + 5); g.closePath();
      const tg = g.createLinearGradient(0, y, 0, y + h); tg.addColorStop(0, '#231a17'); tg.addColorStop(1, '#0f0b0a'); g.fillStyle = tg; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1; g.stroke();
      g.beginPath(); g.moveTo(ex, y + h + 5); g.lineTo(dir < 0 ? inner.x : inner.x + inner.w, y + h); g.lineTo(ex, y + h); g.closePath(); g.fillStyle = '#050404'; g.fill();
    };
    const ix = inner.x, iw = inner.w;
    cache(g, `notice|${w}|${h}`, x, y, w, h + 6, (cg, X, Y) => {
      const saveG = g; g = cg; const dx = X - x, dy = Y - y;
      g.save(); g.translate(dx, dy);
      shadowed(g, () => { tail(-1); tail(1); }, 6, 3);
      shadowed(g, () => { rr(g, ix, y, iw, h, 2); g.fillStyle = '#0d0b0b'; g.fill(); }, 8, 3);
      const bg = g.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, '#2d2322'); bg.addColorStop(1, '#161112');
      rr(g, ix, y, iw, h, 2); g.fillStyle = bg; g.fill(); texture(g, 'cloth', 0.8, () => rr(g, ix, y, iw, h, 2), ix, y, iw, h);
      g.strokeStyle = 'rgba(217,178,92,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ix + 2, y + 3.5); g.lineTo(ix + iw - 2, y + 3.5); g.moveTo(ix + 2, y + h - 3.5); g.lineTo(ix + iw - 2, y + h - 3.5); g.stroke();
      rr(g, ix, y, iw, h, 2); g.strokeStyle = 'rgba(0,0,0,0.9)'; g.stroke();
      g.restore(); g = saveG;
    }, 24);
    // one line of sans at 14; smaller before it ever wraps; two balanced lines before it is ever cut, and then at a word
    const room = iw - 16;
    let size = 14, f = FS(600, size), lines = [String(msg)];
    while (size > 11 && tw(g, msg, FS(600, size)) > room) size -= 0.5;
    f = FS(600, size);
    if (tw(g, msg, f) > room) { f = FS(600, 11.5); lines = wrap(g, msg, room, 2, f).lines; }
    const lh = realPx(f) * 1.15, y0 = y + h / 2 - (lines.length - 1) * lh / 2 + realPx(f) * 0.36;
    lines.forEach((l, i) => text(g, l, ix + iw / 2, y0 + i * lh, { font: f, align: 'center', color: T.ink, shadow: 'rgba(0,0,0,0.9)', box: { x: ix + 8, y, w: room, h }, fitId: 'notice' }));
    g.restore();
  }
  function flourish(g, cx, y, w) {
    g.strokeStyle = 'rgba(217,178,92,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - w / 2, y); g.lineTo(cx - 8, y); g.moveTo(cx + 8, y); g.lineTo(cx + w / 2, y); g.stroke();
    g.fillStyle = T.gold; g.beginPath(); g.moveTo(cx, y - 4); g.lineTo(cx + 5, y); g.lineTo(cx, y + 4); g.lineTo(cx - 5, y); g.closePath(); g.fill();
  }
  // a banner's sentence under its headline: it shrinks to 11 px before it wraps, and wraps (two balanced lines) before it is cut
  function subLines(g, sub, cx, top, r, size, col, halo) {
    const room = r.w - 8; let sz = size; while (sz > 11 && tw(g, sub, FS(600, sz)) > room) sz -= 0.5;
    const f = FS(600, sz), lines = tw(g, sub, f) > room ? wrap(g, sub, room, 2, f).lines : [String(sub)];
    lines.forEach((l, i) => text(g, l, cx, top + realPx(f) * (1 + i * 1.2), { font: f, align: 'center', color: col, halo: 4, haloColor: `rgba(10,8,6,${halo})`, box: r, fitId: 'banner:sub' }));
  }
  // BANNER: an area name (kind 'area') or a level-up / event headline (kind 'level'), in its lane, faded by alpha
  function banner(g, r, o) {
    const phone = r.w < 420 || VW < 640;
    g.save(); g.globalAlpha *= cl(o.alpha == null ? 1 : o.alpha, 0, 1);
    const cx = r.x + r.w / 2;
    if (o.kind === 'area') {
      let size = o.small ? 18 : phone ? 22 : 30; while (size > 14 && tw(g, o.title, FC(800, size)) > r.w - 8) size -= 1;
      const ty = r.y + size;
      text(g, o.title, cx, ty, { font: FC(800, size), align: 'center', color: T.ink, halo: 6, haloColor: 'rgba(10,8,6,0.8)', box: r, fitId: 'banner' });
      flourish(g, cx, ty + 9, Math.min(r.w - 20, tw(g, o.title, FC(800, size)) * 0.8));
      if (o.sub) subLines(g, o.sub, cx, ty + 9 + 8, r, phone ? 13 : 15, '#e6c77a', 0.8);
    } else {
      let size = o.small ? (phone ? 16 : 20) : phone ? 24 : 30; while (size > 14 && tw(g, o.title, FC(800, size)) > r.w - 8) size -= 1;
      const ty = r.y + size;
      text(g, o.title, cx, ty, { font: FC(800, size), align: 'center', color: o.small ? '#e6c76a' : T.goldHi, halo: 6, haloColor: 'rgba(10,8,6,0.85)', box: r, fitId: 'banner' });
      if (o.sub) subLines(g, o.sub, cx, ty + 6, r, o.small ? 12 : 14, T.ink, 0.85);
    }
    g.restore();
  }

  // ---------- the boss banner ----------
  function bossBanner(g, r, b) {
    // a banner is 54-58 px tall wherever it sits; in a taller slot (the scroll's, on a phone) it hangs at the slot's top
    const { x, y, w } = r, h = Math.min(r.h, 58), compact = !!b.compact || h < 44;
    const rd = compact ? h - 4 : h + 4, rcx = x + rd / 2 - (compact ? 0 : 6), rcy = y + h / 2;
    const mark = b.mark || 'skull';
    // the plate, its edge, the roundel and the boss's mark never change during a fight: drawn once
    cache(g, `bossB|${w}|${h}|${+compact}|${mark}|${b.edge || ''}`, x, y, w, h, (cg, ox, oy) => {
      const X = ox, Y = oy, px = X + rd * (compact ? 0.5 : 0.55), qcx = X + rd / 2 - (compact ? 0 : 6), qcy = Y + h / 2;
      shadowed(cg, () => { rr(cg, px, Y, w - (px - X), h, 6); cg.fillStyle = '#0b0c0e'; cg.fill(); }, 10, 4);
      const gr = cg.createLinearGradient(0, Y, 0, Y + h); gr.addColorStop(0, '#30262a'); gr.addColorStop(1, '#161214');
      rr(cg, px, Y, w - (px - X), h, 6); cg.fillStyle = gr; cg.fill(); texture(cg, 'iron', 0.6, () => rr(cg, px, Y, w - (px - X), h, 6), px, Y, w - (px - X), h);
      cg.beginPath(); cg.moveTo(px + 6, Y + 1.5); cg.lineTo(X + w - 6, Y + 1.5); cg.strokeStyle = 'rgba(255,255,255,0.1)'; cg.lineWidth = 1; cg.stroke();
      rr(cg, px, Y, w - (px - X), h, 6); cg.strokeStyle = b.edge || 'rgba(239,75,63,0.55)'; cg.lineWidth = 1.5; cg.stroke();
      if (!compact) for (const [qx, qy] of [[X + w - 7, Y + 7], [X + w - 7, Y + h - 7]]) rivet(cg, qx, qy, 2);
      shadowed(cg, () => { cg.beginPath(); cg.arc(qcx, qcy, rd / 2, 0, TAU); cg.fillStyle = '#000'; cg.fill(); }, 6, 2);
      const rg = cg.createLinearGradient(qcx - rd / 2, qcy - rd / 2, qcx + rd / 2, qcy + rd / 2); rg.addColorStop(0, '#e0786a'); rg.addColorStop(0.45, '#8e2320'); rg.addColorStop(1, '#3a0b0b');
      cg.beginPath(); cg.arc(qcx, qcy, rd / 2, 0, TAU); cg.fillStyle = rg; cg.fill(); cg.strokeStyle = '#000'; cg.lineWidth = 1; cg.stroke();
      cg.beginPath(); cg.arc(qcx, qcy, rd / 2 - 3.5, 0, TAU); cg.fillStyle = '#17181c'; cg.fill();
      const markCol = mark === 'goblin' ? '#9fd06e' : mark === 'fang' ? '#ffd0a0' : mark === 'bird' ? T.goldHi : '#e8dcc6';
      emblem(cg, mark, qcx, qcy + 1, rd * 0.62, markCol, { hole: '#17181c' });
      if (mark === 'goblin') for (const q of [-1, 1]) { cg.save(); cg.beginPath(); cg.arc(qcx + q * rd * 0.085, qcy - rd * 0.02, rd * 0.03, 0, TAU); cg.fillStyle = '#ffe56a'; cg.shadowColor = '#ffe56a'; cg.shadowBlur = 6; cg.fill(); cg.restore(); }
    }, 16);
    const tx = x + rd + (compact ? 4 : 6), rightW = 14;
    const right = b.phase ? String(b.phase).toUpperCase() : (b.lv != null ? 'LV ' + b.lv : '');
    if (compact) {
      // two rows in a short plate: NAME (and LV while it fits), then the bar with "n / max" on it
      const nm = String(b.name).toUpperCase(), room = x + w - 12 - tx;
      let nf = Math.min(11.5, Math.round(h * 0.3)); const lv = right ? right : '';
      const lvW = () => lv ? tw(g, lv, FC(800, Math.max(8, nf - 1))) + 8 : 0;
      while (nf > 8 && tw(g, nm, FC(800, nf)) + lvW() > room) nf -= 0.5;
      const showLv = lv && tw(g, nm, FC(800, nf)) + lvW() <= room;
      const ny = y + nf + 3;
      text(g, nm, tx, ny, { font: FC(800, nf), color: T.ink, shadow: 'rgba(0,0,0,0.9)', box: { x: tx, y, w: showLv ? room - lvW() : room, h: nf + 6 }, fitId: 'boss:name' });
      if (showLv) text(g, lv, x + w - 12, ny, { font: FC(800, Math.max(8, nf - 1)), align: 'right', color: b.phase ? T.goldHi : '#ff9a86', shadow: 'rgba(0,0,0,0.9)' });
      const bh = Math.max(9, Math.round(h * 0.34)), by = y + h - bh - 4, bw = room;
      meterBar(g, tx, by, bw, bh, b.hp / b.max, '#d8322b', { ticks: 10, trail: b.trail });
      const nt = b.heart ? `${Math.ceil(b.hp)} / ${b.max} · heart ${Math.ceil(b.heart.hp)}` : `${Math.ceil(b.hp)} / ${b.max}`;
      text(g, nt, tx + bw / 2, by + bh / 2 + Math.round(bh * 0.3), { font: FC(800, Math.max(8.5, Math.round(bh * 0.78))), align: 'center', color: T.ink, halo: 3 });
      return;
    }
    let nf = Math.round(Math.min(16, h * 0.28)); const nm = String(b.name).toUpperCase();
    const lvf = () => FC(800, Math.max(9, Math.round(nf * 0.8))), room = x + w - 16 - tx;
    // the name shrinks first; if it still meets the level, the level gives way (the name is what a child reads)
    while (nf > 9.5 && tw(g, nm, FC(800, nf)) + (right ? tw(g, right, lvf()) + 14 : 0) > room) nf -= 0.5;
    const showRight = right && tw(g, nm, FC(800, nf)) + tw(g, right, lvf()) + 14 <= room;
    const ny = y + nf + 7;
    text(g, nm, tx, ny, { font: FC(800, nf), color: T.ink, shadow: 'rgba(0,0,0,0.9)', box: { x: tx, y, w: showRight ? room - tw(g, right, lvf()) - 14 : room, h: nf + 8 }, fitId: 'boss:name' });
    if (showRight) text(g, right, x + w - 16, ny, { font: lvf(), align: 'right', color: b.phase ? T.goldHi : '#ff9a86', shadow: 'rgba(0,0,0,0.9)' });
    const heartRow = !!b.heart;
    const bh = Math.round(h * (heartRow ? 0.22 : 0.3)), by = heartRow ? y + h - 2 * bh - 12 : y + h - bh - 9, bw = x + w - 14 - tx;
    meterBar(g, tx, by, bw, bh, b.hp / b.max, '#d8322b', { ticks: 10, trail: b.trail });
    text(g, `${Math.ceil(b.hp)} / ${b.max}`, tx + bw / 2, by + bh / 2 + Math.round(bh * 0.3), { font: FC(800, Math.max(9, Math.round(bh * 0.74))), align: 'center', color: T.ink, halo: 3 });
    if (heartRow) {
      const hy = by + bh + 4;
      meterBar(g, tx, hy, bw, bh, b.heart.hp / b.heart.max, '#e8a33d', { hi: '#ffd08a', lo: '#7a4a0e' });
      text(g, `HEART ${Math.ceil(b.heart.hp)} / ${b.heart.max}`, tx + bw / 2, hy + bh / 2 + Math.round(bh * 0.3), { font: FC(800, Math.max(9, Math.round(bh * 0.74))), align: 'center', color: T.ink, halo: 3 });
    } else if (b.sub && h >= 50) {
      // a short instruction under the name, where there is room ("Wait it out", "Break the heart")
    }
  }

  // ---------- the crest: a heraldic shield (health) + a sable banner with the numbers ----------
  function bannerPath(g, x, y, w, h, notch) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - notch, y + h / 2); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); }
  function healthShield(g, x, y, w, h, frac, o = {}) {
    const low = !o.mech && frac <= 0.25 && frac > 0;
    const i = Math.max(3.5, w * 0.085), ix0 = i, iy0 = i * 0.95, iw = w - i * 2, ih = h - i * 2.25;
    // the back: its shadow, the red glow at a quarter, the hover edge, the forged rim and the empty lozenge-lattice field
    cache(g, `shieldB|${w}|${h}|${+low}|${+!!o.hover}`, x, y, w, h, (cg, ox, oy) => {
      shadowed(cg, () => { shieldPath(cg, ox, oy, w, h); cg.fillStyle = '#0c0c0e'; cg.fill(); }, 9, 4, 'rgba(0,0,0,0.6)');
      if (low) shadowed(cg, () => { shieldPath(cg, ox, oy, w, h); cg.strokeStyle = 'rgba(255,80,60,0.9)'; cg.lineWidth = 2; cg.stroke(); }, 14, 0, 'rgba(255,60,40,0.95)');
      if (o.hover) shadowed(cg, () => { shieldPath(cg, ox, oy, w, h); cg.strokeStyle = T.goldHi; cg.lineWidth = 2; cg.stroke(); }, 8, 0, T.goldHi);
      const rim = cg.createLinearGradient(ox, oy, ox + w, oy + h); rim.addColorStop(0, '#b4bbc5'); rim.addColorStop(0.35, '#646b75'); rim.addColorStop(0.7, '#2e3238'); rim.addColorStop(1, '#16181c');
      shieldPath(cg, ox, oy, w, h); cg.fillStyle = rim; cg.fill();
      texture(cg, 'iron', 0.5, () => shieldPath(cg, ox, oy, w, h), ox, oy, w, h);
      const ix = ox + ix0, iy = oy + iy0;
      const field = cg.createLinearGradient(0, iy, 0, iy + ih); field.addColorStop(0, '#231519'); field.addColorStop(1, '#100a0c');
      shieldPath(cg, ix, iy, iw, ih); cg.fillStyle = field; cg.fill();
      cg.save(); shieldPath(cg, ix, iy, iw, ih); cg.clip();
      cg.strokeStyle = 'rgba(255,220,200,0.05)'; cg.lineWidth = 1;
      for (let q = -ih; q < iw + ih; q += 7) { cg.beginPath(); cg.moveTo(ix + q, iy); cg.lineTo(ix + q - ih, iy + ih); cg.moveTo(ix + q - ih, iy); cg.lineTo(ix + q, iy + ih); cg.stroke(); }
      cg.restore();
    }, 22);
    // the liquid: red (or the machine's steel blue) rising from the base with a living surface — the only live layer
    const ix = x + ix0, iy = y + iy0, fy = iy + ih * (1 - cl(frac, 0, 1)), ph = o.phase || 0;
    if (frac > 0) {
      g.save(); shieldPath(g, ix, iy, iw, ih); g.clip();
      g.beginPath(); g.moveTo(ix - 2, fy);
      for (let xx = 0; xx <= iw + 4; xx += 3) g.lineTo(ix - 2 + xx, fy + Math.sin((xx + ph) / 5.5) * 1.3);
      g.lineTo(ix + iw + 2, iy + ih + 2); g.lineTo(ix - 2, iy + ih + 2); g.closePath();
      const liq = g.createLinearGradient(0, fy, 0, iy + ih);
      if (o.mech) { liq.addColorStop(0, '#b4c6d8'); liq.addColorStop(1, '#3b4a5c'); } else { liq.addColorStop(0, '#f0564a'); liq.addColorStop(0.35, T.gules); liq.addColorStop(1, '#7a1219'); }
      g.fillStyle = liq; g.fill();
      g.beginPath(); for (let xx = 0; xx <= iw + 4; xx += 3) { const px = ix - 2 + xx, py = fy + Math.sin((xx + ph) / 5.5) * 1.3; xx ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.strokeStyle = o.flash ? `rgba(255,255,255,${0.5 + 0.5 * o.flash})` : o.mech ? 'rgba(230,240,250,0.75)' : 'rgba(255,190,170,0.75)'; g.lineWidth = o.flash ? 2 : 1.2; g.stroke();
      g.restore();
    }
    // the front: gloss, the cracks at a quarter, the field's edge, the gold heart (or the machine's mark), the rivets
    const em = o.mech ? (o.mech.emblem || 'cog') : 'heart';
    cache(g, `shieldF|${w}|${h}|${+low}|${em}`, x, y, w, h, (cg, ox, oy) => {
      const jx = ox + ix0, jy = oy + iy0;
      cg.save(); shieldPath(cg, jx, jy, iw, ih); cg.clip();
      cg.beginPath(); cg.ellipse(jx + iw * 0.3, jy + ih * 0.42, iw * 0.12, ih * 0.36, -0.12, 0, TAU); cg.fillStyle = 'rgba(255,255,255,0.07)'; cg.fill();
      if (low) { cg.strokeStyle = 'rgba(0,0,0,0.75)'; cg.lineWidth = 1.3; cg.beginPath(); cg.moveTo(jx + iw * 0.55, jy); cg.lineTo(jx + iw * 0.45, jy + ih * 0.22); cg.lineTo(jx + iw * 0.6, jy + ih * 0.36); cg.lineTo(jx + iw * 0.48, jy + ih * 0.55); cg.stroke(); }
      cg.restore();
      shieldPath(cg, jx, jy, iw, ih); cg.strokeStyle = 'rgba(0,0,0,0.85)'; cg.lineWidth = 1.5; cg.stroke();
      const hs = iw * 0.44, hx = ox + w / 2, hy = jy + ih * 0.33;
      if (em !== 'heart') emblem(cg, em, hx, hy, hs * 1.05, '#dfe6ee', { hole: '#2a3440' });
      else {
        cg.save(); cg.fillStyle = 'rgba(0,0,0,0.6)'; EM.heart(cg, hx, hy + 1.2, hs);
        const hg = cg.createLinearGradient(0, hy - hs * 0.4, 0, hy + hs * 0.4); hg.addColorStop(0, '#fbe29a'); hg.addColorStop(1, '#c08d2c');
        cg.fillStyle = hg; EM.heart(cg, hx, hy, hs); cg.strokeStyle = 'rgba(60,34,6,0.9)'; cg.lineWidth = 1; cg.stroke(); cg.restore();
      }
      for (const [px, py] of [[0.18, 0.1], [0.5, 0.055], [0.82, 0.1], [0.06, 0.42], [0.94, 0.42], [0.5, 0.93]]) rivet(cg, ox + w * px, oy + h * py, Math.max(1.3, w * 0.035));
      shieldPath(cg, ox, oy, w, h); cg.strokeStyle = 'rgba(0,0,0,0.9)'; cg.lineWidth = 1; cg.stroke();
    }, 4);
  }
  const fmtInt = n => String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // crest metrics from the reserved box: the widest possible values (999 / 999, 999,999 coins, level 99) always fit
  function crestMetrics(g, r, st) {
    const s = Math.round(r.h / 1.18), notch = Math.round(s * 0.2), tx = Math.round(s * 1.16);
    const avail = r.w - tx - notch - Math.round(s * 0.08);
    let f1 = Math.round(s * 0.36), f1b = Math.round(s * 0.24), f2 = Math.max(11, Math.round(s * 0.25));
    const kidW = st.kid ? tw(g, 'KID', FC(800, 9)) + 18 : 0;
    while (f1 > 12 && tw(g, '999', FC(800, f1)) + tw(g, ' / 999', FC(600, f1b)) + kidW > avail) { f1 -= 0.5; f1b = Math.round(f1 * 0.67 * 2) / 2; }
    const line2 = sz => { const ic = Math.round(sz * 1.45), gap = Math.round(sz * 0.8); return ic + 4 + tw(g, '999,999', FC(800, sz)) + gap + ic + 4 + tw(g, '99', FC(800, sz)); };
    while (f2 > 10 && line2(f2) > avail) f2 -= 0.5;
    return { s, sh: r.h, notch, tx, avail, f1, f1b, f2, icon: Math.round(f2 * 1.45), gap: Math.round(f2 * 0.8) };
  }
  // CREST: st = { hp, max, coins, combat, kid, mech:{ name, hp, max, emblem }, saved (0..1), cloud (0..1), low, flash, frac (the eased fill), hover, pressed, dead }
  function crest(g, r, st) {
    const cm = crestMetrics(g, r, st), x = r.x, y = r.y + (st.pressed ? 1.5 : 0), s = cm.s;
    const bh = Math.round(cm.sh * 0.66), by = Math.round(y + cm.sh * 0.1), bx = x + Math.round(s * 0.5), bw = r.w - Math.round(s * 0.5);
    cache(g, `crestB|${bw}|${bh}|${cm.notch}`, bx, by, bw, bh, (cg, ox, oy) => {
      shadowed(cg, () => { bannerPath(cg, ox, oy, bw, bh, cm.notch); cg.fillStyle = '#0d0b0b'; cg.fill(); }, 8, 3);
      const clg = cg.createLinearGradient(0, oy, 0, oy + bh); clg.addColorStop(0, '#2a2020'); clg.addColorStop(1, '#141011');
      bannerPath(cg, ox, oy, bw, bh, cm.notch); cg.fillStyle = clg; cg.fill();
      texture(cg, 'cloth', 0.8, () => bannerPath(cg, ox, oy, bw, bh, cm.notch), ox, oy, bw, bh);
      bannerPath(cg, ox + 3, oy + 3, bw - 6, bh - 6, cm.notch - 1); cg.strokeStyle = 'rgba(217,178,92,0.55)'; cg.lineWidth = 1; cg.stroke();
      bannerPath(cg, ox, oy, bw, bh, cm.notch); cg.strokeStyle = 'rgba(0,0,0,0.9)'; cg.lineWidth = 1; cg.stroke();
    }, 12);
    const tx = x + cm.tx, l1 = by + bh * 0.47, l2 = by + bh * 0.84, box1 = { x: tx, y: by, w: cm.avail, h: bh / 2 };
    const big = st.mech ? st.mech : st, low = !st.mech && st.max > 0 && st.hp / st.max <= 0.25;
    const bf = st.mech ? ramp(st.mech.hp / Math.max(1, st.mech.max)) : low ? '#ff8a7a' : T.ink;
    const w1 = text(g, String(Math.ceil(big.hp)), tx, l1, { font: FC(800, cm.f1), color: st.mech ? '#e8f0f8' : bf, shadow: 'rgba(0,0,0,0.8)', box: box1, fitId: 'crest:hp' });
    const w1b = text(g, ' / ' + big.max, tx + w1, l1, { font: FC(600, cm.f1b), color: T.inkDim, shadow: 'rgba(0,0,0,0.8)' });
    if (st.kid) {
      const kx = tx + w1 + w1b + 8, kw = tw(g, 'KID', FC(800, 9)) + 10;
      rr(g, kx, l1 - 12, kw, 14, 7); g.fillStyle = '#2f5a2a'; g.fill(); g.strokeStyle = 'rgba(160,230,150,0.7)'; g.lineWidth = 1; g.stroke();
      text(g, 'KID', kx + kw / 2, l1 - 2, { font: FC(800, 9), align: 'center', color: '#dff7d8' });
    }
    const ic = cm.icon, cy2 = l2 - cm.f2 * 0.36;
    if (st.mech) {
      // line 2 in a machine: a small heart and YOUR hp, then the machine's name if there is room for it
      g.save(); g.fillStyle = 'rgba(0,0,0,0.6)'; EM.heart(g, tx + ic / 2, cy2 + 1, ic * 0.8); g.fillStyle = '#f0564a'; EM.heart(g, tx + ic / 2, cy2, ic * 0.8); g.restore();
      const lo = st.max > 0 && st.hp / st.max <= 0.25;
      const w2 = text(g, `${Math.ceil(st.hp)} / ${st.max}`, tx + ic + 4, l2, { font: FC(800, cm.f2), color: lo ? '#ff8a7a' : T.ink, shadow: 'rgba(0,0,0,0.8)', box: { x: tx, y: l2 - cm.f2, w: cm.avail, h: cm.f2 + 4 }, fitId: 'crest:line2' });
      const nm = String(st.mech.name || '').toUpperCase(), room = cm.avail - (ic + 4 + w2 + cm.gap);
      let nf = Math.round(cm.f2 * 0.8); while (nf > 9 && tw(g, nm, FC(800, nf)) > room) nf -= 0.5;
      if (nm && tw(g, nm, FC(800, nf)) <= room) text(g, nm, tx + ic + 4 + w2 + cm.gap, l2, { font: FC(800, nf), color: T.inkDim, shadow: 'rgba(0,0,0,0.8)' });
    } else {
      cache(g, `coin|${ic}`, tx, cy2 - ic / 2, ic, ic, (cg, X, Y) => coin(cg, X + ic / 2, Y + ic / 2, ic * 0.4), 2);
      const cw = text(g, fmtInt(st.coins), tx + ic + 4, l2, { font: FC(800, cm.f2), color: '#f3d27e', shadow: 'rgba(0,0,0,0.8)', box: { x: tx, y: l2 - cm.f2, w: cm.avail, h: cm.f2 + 4 }, fitId: 'crest:line2' });
      const x2 = tx + ic + 4 + Math.max(cw, tw(g, '9,999', FC(800, cm.f2))) + cm.gap;
      cache(g, `swords|${ic}`, x2, cy2 - 1 - ic * 0.6, ic, ic * 1.2, (cg, X, Y) => crossedSwords(cg, X + ic / 2, Y + ic * 0.6, ic * 1.02), 4);
      text(g, String(st.combat), x2 + ic + 4, l2, { font: FC(800, cm.f2), color: T.ink, shadow: 'rgba(0,0,0,0.8)' });
    }
    // 'Saved' / 'Saved to the cloud': a green tick on the banner's swallowtail for a moment
    if (st.saved > 0 || st.cloud > 0) {
      const ex = x + r.w - cm.notch * 0.5 - 2, ey = by + bh / 2;
      g.save(); g.globalAlpha *= Math.max(st.saved || 0, st.cloud || 0);
      if (st.cloud > 0) { g.fillStyle = '#c9d0d8'; EM.cloud(g, ex - 8, ey - 1, 16); }
      g.fillStyle = g.strokeStyle = T.good; g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 3; EM.tick(g, ex - 8, ey + (st.cloud > 0 ? 1 : 0), st.cloud > 0 ? 9 : 13);
      g.restore();
    }
    const frac = st.dead ? 0 : st.mech ? st.mech.hp / Math.max(1, st.mech.max) : st.max > 0 ? st.hp / st.max : 0;
    healthShield(g, x, y, s, cm.sh, st.frac != null ? st.frac : frac, { phase: now() / 180, mech: st.mech, flash: st.flash, hover: st.hover });
  }

  // ---------- the quest scroll ----------
  function scrollRoll(g, x, y, w, h) {
    const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#1b140d'); gr.addColorStop(0.35, '#5c4630'); gr.addColorStop(0.62, '#3b2d1f'); gr.addColorStop(1, '#130e09');
    rr(g, x, y, w, h, w / 2); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 1; g.stroke();
    for (const ky of [y - 3, y + h - 3]) { rr(g, x + w * 0.18, ky, w * 0.64, 6, 3); const kg = g.createLinearGradient(x, 0, x + w, 0); kg.addColorStop(0, '#3a2412'); kg.addColorStop(0.4, '#8a5a30'); kg.addColorStop(1, '#2a180a'); g.fillStyle = kg; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.8)'; g.stroke(); }
  }
  // QUEST SCROLL: dark vellum between turned rolls; gold Cinzel title; the instruction in full (balanced wrap, a gold
  // "more" chevron if it still runs out); an umber wax seal with the Fang's tooth on the right roll (decoration inside the hit).
  function questScroll(g, r, o) {
    const { x, w, h } = r, y = r.y + (o.pressed ? 1.5 : 0), rw = Math.max(9, Math.round(h * 0.15)), sealR = Math.round(cl(h * 0.24, 12, 16));
    cache(g, `scroll|${w}|${h}`, x, y, w, h, (cg, ox, oy) => {
      shadowed(cg, () => { rr(cg, ox + rw * 0.5, oy + 2, w - rw, h - 4, 3); cg.fillStyle = '#0b0906'; cg.fill(); }, 9, 4, 'rgba(0,0,0,0.6)');
      const vg = cg.createLinearGradient(0, oy, 0, oy + h); vg.addColorStop(0, '#30271d'); vg.addColorStop(1, '#1d1712');
      rr(cg, ox + rw * 0.5, oy + 2, w - rw, h - 4, 3); cg.fillStyle = vg; cg.fill();
      texture(cg, 'vellum', 1, () => rr(cg, ox + rw * 0.5, oy + 2, w - rw, h - 4, 3), ox, oy, w, h);
      for (const [sx, dir] of [[ox + rw * 0.5, 1], [ox + w - rw * 0.5, -1]]) { const sg = cg.createLinearGradient(sx, 0, sx + dir * 14, 0); sg.addColorStop(0, 'rgba(0,0,0,0.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); cg.fillStyle = sg; cg.fillRect(Math.min(sx, sx + dir * 14), oy + 2, 14, h - 4); }
      scrollRoll(cg, ox, oy, rw, h); scrollRoll(cg, ox + w - rw, oy, rw, h);
    }, 12);
    if (o.hover) { rr(g, x + rw * 0.5, y + 2, w - rw, h - 4, 3); g.strokeStyle = 'rgba(247,220,143,0.8)'; g.lineWidth = 1.5; g.stroke(); }
    const pad = Math.round(rw + 8), tf = h >= 80 ? 12 : 11, maxW = w - pad * 2 - sealR * 0.9;
    const title = String(o.title || 'NO QUEST FOLLOWED').toUpperCase();
    let ts = tf; while (ts > 9 && tw(g, title, FC(800, ts)) > maxW) ts -= 0.5;
    const ty = y + 7 + ts;
    text(g, title, x + pad, ty, { font: FC(800, ts), color: T.gold, shadow: 'rgba(0,0,0,0.9)', box: { x: x + pad, y, w: maxW, h: ts + 8 }, fitId: 'scroll:title' });
    let qf = FS(600, o.size || 13), lh = Math.round(realPx(qf) * 1.28);
    let nLines = Math.max(1, Math.floor((y + h - 6 - (ty + 4)) / lh));
    if (wrap(g, o.text || '', maxW, nLines, qf).more && (o.size || 13) > 12) {
      const q2 = FS(600, (o.size || 13) - 1), l2 = Math.round(realPx(q2) * 1.28), n2 = Math.max(1, Math.floor((y + h - 6 - (ty + 4)) / l2));
      if (!wrap(g, o.text || '', maxW, n2, q2).more) { qf = q2; lh = l2; nLines = n2; }
    }
    const ww = wrap(g, o.text || '', o.more ? maxW - 10 : maxW, nLines, qf);
    let lines = ww.lines, more = ww.more;
    if (more) { const w2 = wrap(g, o.text || '', maxW - 14, nLines, qf); lines = w2.lines; }
    lines.forEach((l, i) => text(g, l, x + pad, ty + 4 + lh * (i + 1) - Math.round(lh * 0.22), { font: qf, color: o.empty ? T.inkDim : T.ink, shadow: 'rgba(0,0,0,0.9)', box: { x: x + pad, y, w: maxW, h }, fitId: 'scroll:text' }));
    if (more) { const lastW = tw(g, lines[lines.length - 1] || '', qf); g.fillStyle = g.strokeStyle = T.goldHi; EM.chevronR(g, x + pad + lastW + 8, ty + 4 + lh * lines.length - Math.round(lh * 0.22) - realPx(qf) * 0.3, 10); }
    // the wax seal and its two ribbon tails, on the right roll
    const scx = x + w - rw * 0.5, scy = y + h - sealR * 0.7;
    g.fillStyle = '#4a2a14';
    g.beginPath(); g.moveTo(scx - 5, scy); g.lineTo(scx - 9, scy + sealR + 6); g.lineTo(scx - 5, scy + sealR + 3); g.lineTo(scx - 2, scy + sealR + 7); g.lineTo(scx, scy); g.fill();
    g.beginPath(); g.moveTo(scx + 2, scy); g.lineTo(scx + 4, scy + sealR + 4); g.lineTo(scx + 7, scy + sealR + 1); g.lineTo(scx + 10, scy + sealR + 5); g.lineTo(scx + 6, scy); g.fill();
    seal(g, scx, scy, sealR, 'fang', 'umber', { pressed: o.pressed, seed: 5, scale: 0.95 });
    return { more };
  }
  // the scroll rolled up (phones in a boss fight, or while someone talks sideways): a strip, tap = read it
  function rolledScroll(g, r, title, o = {}) {
    const { x, w, h } = r, y = r.y + (o.pressed ? 1.5 : 0), th = Math.round(h * 0.5), ty = y + h / 2 - th / 2;
    shadowed(g, () => { rr(g, x + 14, ty, w - 20, th, th / 2); g.fillStyle = '#0b0906'; g.fill(); }, 6, 3);
    const gr = g.createLinearGradient(0, ty, 0, ty + th); gr.addColorStop(0, '#5a4631'); gr.addColorStop(0.5, '#3a2d20'); gr.addColorStop(1, '#17110b');
    rr(g, x + 14, ty, w - 20, th, th / 2); g.fillStyle = gr; g.fill(); texture(g, 'vellum', 0.7, () => rr(g, x + 14, ty, w - 20, th, th / 2), x, ty, w, th); g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.ellipse(x + w - 8, ty + th / 2, th * 0.18, th * 0.46, 0, 0, TAU); g.fillStyle = '#6d5438'; g.fill(); g.stroke();
    for (const kx of [x + w - 8]) { rr(g, kx - 3, ty - 3, 6, th + 6, 3); g.fillStyle = '#8a5a30'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.8)'; g.stroke(); }
    if (o.hover) { rr(g, x + 14, ty, w - 20, th, th / 2); g.strokeStyle = T.goldHi; g.lineWidth = 1.5; g.stroke(); }
    const sr = Math.round(h * 0.3);
    seal(g, x + sr + 2, y + h / 2, sr, 'fang', 'umber', { pressed: o.pressed, seed: 5, scale: 0.95 });
    const t = String(title || 'QUEST').toUpperCase(); let ts = 11; const room = w - 20 - (sr * 2 + 12) - 10, tx0 = x + sr * 2 + 12;
    while (ts > 8.5 && tw(g, t, FC(800, ts)) > room) ts -= 0.5;
    // a name too long for one line takes two (the strip is tall enough), never a cut word
    const lines = tw(g, t, FC(800, ts)) > room ? wrap(g, t, room, 2, FC(800, 9)).lines : [t];
    if (lines.length > 1) ts = 9;
    lines.forEach((l, i) => text(g, l, tx0, y + h / 2 + ts * 0.36 + (i - (lines.length - 1) / 2) * (ts + 2), { font: FC(800, ts), color: T.gold, shadow: 'rgba(0,0,0,0.9)', box: { x: tx0, y, w: room, h }, fitId: 'rolled' }));
  }

  // ---------- the talk page ----------
  function talkPage(g, r, d) {
    const { x, y, w, h } = r;
    vellumPlate(g, x, y, w, h, { edge: 'rgba(217,178,92,0.45)' });
    const col = d.col || '#c9a36a';
    // the speaker's name plate on the top edge, in the speaker's colour
    const nm = String(d.who || '').toUpperCase(), nf = FC(800, 12), nw = tw(g, nm, nf) + 30;
    const npx = x + 14, npy = y - 9;
    shadowed(g, () => { rr(g, npx, npy, nw, 20, 3); g.fillStyle = '#1a140f'; g.fill(); }, 4, 2);
    rr(g, npx, npy, nw, 20, 3); g.strokeStyle = col; g.lineWidth = 1.5; g.stroke();
    g.beginPath(); g.arc(npx + 11, npy + 10, 4.5, 0, TAU); g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 1; g.stroke();
    text(g, nm, npx + 21, npy + 14.5, { font: nf, color: col, shadow: 'rgba(0,0,0,0.9)' });
    g.fillStyle = col; g.fillRect(x + 1, y + 6, 3, h - 12);
    const f = d.font, lh = d.lh;
    (d.lines || []).forEach((l, i) => text(g, l, x + 18, y + 20 + realPx(f) + i * lh, { font: f, color: T.ink, shadow: 'rgba(0,0,0,0.9)', box: { x: x + 18, y, w: w - 36, h }, fitId: 'talk' }));
    const go = d.touch ? 'Tap to go on' : 'Enter or click to go on';
    text(g, go, x + w - 32, y + h - 10, { font: FS(600, 11), align: 'right', color: T.inkDim });
    const bob = Math.sin(now() / 250) * 1.5;
    g.fillStyle = g.strokeStyle = T.goldHi; EM.chevron(g, x + w - 18, y + h - 14 + bob, 12);
  }

  // ---------- the book: a brown leather cover with brass corners, vellum pages ----------
  function bookCover(g, x, y, w, h, o = {}) {
    shadowed(g, () => { rr(g, x, y, w, h, 10); g.fillStyle = '#000'; g.fill(); }, o.flat ? 12 : 26, o.flat ? 4 : 10, 'rgba(0,0,0,0.75)');
    const cg = g.createLinearGradient(0, y, 0, y + h); cg.addColorStop(0, '#5b3923'); cg.addColorStop(1, '#2a180d');
    rr(g, x, y, w, h, 10); g.fillStyle = cg; g.fill(); texture(g, 'leather', 1, () => rr(g, x, y, w, h, 10), x, y, w, h);
    rr(g, x + 4, y + 4, w - 8, h - 8, 8); g.strokeStyle = 'rgba(217,178,92,0.5)'; g.lineWidth = 1.2; g.stroke();
    const c = Math.min(24, w * 0.08, h * 0.08);
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      g.beginPath(); g.moveTo(cx, cy + sy * c); g.lineTo(cx, cy); g.lineTo(cx + sx * c, cy); g.lineTo(cx + sx * c, cy + sy * 7); g.lineTo(cx + sx * 7, cy + sy * 7); g.lineTo(cx + sx * 7, cy + sy * c); g.closePath();
      const bg = g.createLinearGradient(cx, cy, cx + sx * c, cy + sy * c); bg.addColorStop(0, '#f6db93'); bg.addColorStop(1, '#8a6424'); g.fillStyle = bg; g.fill(); g.strokeStyle = '#3a2708'; g.lineWidth = 1; g.stroke();
    }
  }
  function bookPage(g, x, y, w, h) {
    const vg = g.createLinearGradient(0, y, 0, y + h); vg.addColorStop(0, '#30271d'); vg.addColorStop(1, '#1c1611');
    rr(g, x, y, w, h, 4); g.fillStyle = vg; g.fill(); texture(g, 'vellum', 1, () => rr(g, x, y, w, h, 4), x, y, w, h);
    rr(g, x, y, w, h, 4); g.strokeStyle = 'rgba(0,0,0,0.8)'; g.lineWidth = 1; g.stroke();
  }
  // =================================================================================================
  // LAYOUT: a port of the spec's final/layout.js (the geometry engine its audit proved over 3,072 combinations).
  // layoutFor(VW, VH, opts) is pure; layout() is the live one (reads the settings and the safe-area insets).
  // =================================================================================================
  const Mx = { desk: 16, tab: 18, phoneP: 12, phoneL: 10 };
  const CREST = { desk: [225, 73], tab: [253, 83], phoneP: [198, 64], phoneL: [174, 57] };
  const MM = { desk: [72, 9], tab: [72, 9], phoneP: [52, 7], phoneL: [44, 6] };
  const SEALD = { desk: 44, tab: 50, phoneP: 46, phoneL: 46 };
  const RIB = 14;
  const STICKR = { tab: 64, phoneP: 54, phoneL: 50 };
  function family(W, H, touch) {
    const short = Math.min(W, H);
    if (!touch && W >= 900 && H >= 560) return 'desk';
    if (short >= 600) return 'tab';
    return H > W ? 'phoneP' : 'phoneL';
  }
  // The floors: each iPhone / iPad family's worst case. On a device the live insets are max(env(safe-area-inset-*), floor).
  function floorInsets(W, H, fam, touch) {
    if (!touch) return { t: 0, r: 0, b: 0, l: 0 };
    if (fam === 'phoneP') return H < 700 ? { t: 20, r: 0, b: 0, l: 0 } : { t: H >= 900 ? 59 : 47, r: 0, b: 34, l: 0 };
    if (fam === 'phoneL') { const s = W >= 900 ? 59 : 47; return { t: 0, r: s, b: 21, l: s }; }
    if (fam === 'tab') return { t: 24, r: 0, b: 20, l: 0 };
    return { t: 0, r: 0, b: 0, l: 0 };
  }
  // env(safe-area-inset-*), read by 05-input from a hidden probe on every resize (0 where the page has none)
  const SAFE_ENV = { t: 0, r: 0, b: 0, l: 0 };
  function insets(W, H, fam, touch) {
    const f = floorInsets(W, H, fam, touch);
    if (!touch) return f;
    return { t: Math.max(f.t, SAFE_ENV.t), r: Math.max(f.r, SAFE_ENV.r), b: Math.max(f.b, SAFE_ENV.b), l: Math.max(f.l, SAFE_ENV.l) };
  }
  function fanR(fam, H) {
    if (fam === 'tab') return { s: 52, u: 38, b: 38, c: 33, gap: 14 };
    if (fam === 'phoneL') return { s: 42, u: 31, b: 31, c: 28, gap: 12 };
    if (H < 700) return { s: 40, u: 30, b: 30, c: 27, gap: 12 };
    return { s: 45, u: 34, b: 34, c: 30, gap: 12 };
  }
  const bbox = a => (a.k === 'c' ? { x: a.x - a.r, y: a.y - a.r, w: 2 * a.r, h: 2 * a.r } : a);
  // signed clearance between two shapes (negative = overlap); circles are tested as circles
  function gapBetween(a, b) {
    if (a.k === 'c' && b.k === 'c') return Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
    if (a.k === 'c' || b.k === 'c') {
      const c = a.k === 'c' ? a : b, r = a.k === 'c' ? b : a;
      const nx = Math.max(r.x, Math.min(c.x, r.x + r.w)), ny = Math.max(r.y, Math.min(c.y, r.y + r.h));
      const inside = c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h;
      return inside ? -c.r : Math.hypot(c.x - nx, c.y - ny) - c.r;
    }
    const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    if (dx < 0 && dy < 0) return Math.max(dx, dy);
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  }
  function layoutFor(W, H, o) {
    o = Object.assign({ touch: true, stickRight: false, bosses: 0, minimap: true, chat: 0, dialog: false, plaques: 99, online: true, home: true }, o);
    const fam = family(W, H, o.touch), S = insets(W, H, fam, o.touch), M = Mx[fam];
    const L = { VW: W, VH: H, fam, S, M, items: [], touch: o.touch, stickRight: o.stickRight, opts: o };
    const add = it => { L.items.push(it); return it; };
    const Rr = (id, x, y, w, h, tap, extra) => add(Object.assign({ id, k: 'r', x, y, w, h, tap: !!tap }, extra));
    const Cc = (id, x, y, r, tap, extra) => add(Object.assign({ id, k: 'c', x, y, r, tap: !!tap }, extra));
    const mir = x => (o.stickRight ? W - x : x);
    const left = S.l + M, top = S.t + M, right = W - S.r - M, bottom = H - S.b - M;
    L.left = left; L.top = top; L.right = right; L.bottom = bottom;
    // ---- top-left: the crest (tap = Skills) ----
    const [cw, ch] = CREST[fam];
    const crest = Rr('crest', left, top, cw, ch, true, { persist: true });
    L.crest = { x: crest.x, y: crest.y, w: cw, h: ch };
    // ---- top-right: the ring (tap = the world map); Minimap Off leaves a 48 px map stud at the same centre ----
    const [mr, mw] = MM[fam], RR = mr + mw;
    const mmx = right - RR, mmy = top + RR;
    if (o.minimap) Cc('minimap', mmx, mmy, RR, true, { persist: true }); else Cc('mapStud', mmx, mmy, 24, true, { persist: true });
    L.mm = { x: mmx, y: mmy, r: mr, R: RR, ring: mw };
    // ---- seals: HOME (an iron stud), FRIENDS (blue wax), MENU (umber wax), each with a ribbon under it ----
    const D = SEALD[fam], sealIds = ['home', 'friends', 'menu'].filter(id => id !== 'friends' || o.online);
    L.seals = {};
    const sealAt = (id, cx, cy) => {
      Cc(id, cx, cy, D / 2, true, { reserved: id === 'home' && !o.home, persist: true });
      Rr(id + ':ribbon', cx - D / 2 - 5, cy + D / 2 - 4, D + 10, RIB, false, { deco: id });
      L.seals[id] = { x: cx, y: cy, r: D / 2 };
    };
    let sealsBottom;
    if (fam === 'phoneP') {
      const cx = right - D / 2 - 5; let cy = mmy + RR + 10 + D / 2;
      for (const id of sealIds) { sealAt(id, cx, cy); cy += D + RIB + 10; }
      sealsBottom = cy - D / 2 - 10; L.colLeft = cx - D / 2 - 5;
    } else if (fam === 'phoneL') {
      let cx = left + 5 + D / 2; const cy = crest.y + ch + 8 + D / 2;
      for (const id of sealIds) { sealAt(id, cx, cy); cx += D + 10 + 12; }
      sealsBottom = cy + D / 2 - 4 + RIB; L.sealsRight = cx - (D + 10 + 12) + D / 2 + 5;
    } else {
      const cy = mmy + RR + 10 + D / 2; let cx = right - 5 - D / 2;
      for (const id of [...sealIds].reverse()) { sealAt(id, cx, cy); cx -= D + 10 + 14; }
      sealsBottom = cy + D / 2 - 4 + RIB;
    }
    L.sealsBottom = sealsBottom;
    // ---- the quest scroll, and the boss slots ----
    const band0 = [crest.x + cw + 16, mmx - RR - 16];
    const bandW = [Math.max(crest.x + cw, fam === 'phoneL' ? 0 : left + (fam === 'desk' ? 318 : 330)) + 16, mmx - RR - 16];
    const band = (fam === 'desk' || fam === 'tab') ? bandW : band0;
    const bossTop = (fam === 'desk' || fam === 'tab') && band[1] - band[0] >= 300;
    let scroll;
    if (fam === 'phoneL') { const x = crest.x + cw + 14, w = mmx - RR - 12 - x; scroll = { x, y: top, w, h: 67 }; }
    else { const w = fam === 'desk' ? 318 : fam === 'tab' ? 330 : Math.min(300, mmx - RR - 10 - left); scroll = { x: left, y: crest.y + ch + 10, w, h: fam === 'desk' ? 67 : fam === 'tab' ? 74 : 84 }; }
    const bossInScroll = o.bosses > 0 && !bossTop;
    const scrollRolled = bossInScroll || (fam === 'phoneL' && o.dialog);
    const scrollHidden = scrollRolled || (fam === 'phoneP' && o.dialog);
    L.scroll = scroll; L.scrollRolled = scrollRolled; L.scrollHidden = scrollHidden; L.bossTop = bossTop;
    if (!scrollHidden) Rr('scroll', scroll.x, scroll.y, scroll.w, scroll.h, true, { persist: true });
    L.boss = [];
    if (bossInScroll && !(fam === 'phoneP' && o.dialog)) {
      const n = Math.min(2, o.bosses), h = n === 1 ? scroll.h : (scroll.h - 4) / 2;
      for (let i = 0; i < n; i++) L.boss.push(Rr('boss' + i, scroll.x, scroll.y + i * (h + 4), scroll.w, h, false, { compact: n > 1 }));
    }
    // the reserved top-centre boss slots (desk / tab landscape), always the same place
    L.bossSlots = [];
    if (bossTop) {
      const w = Math.min(460, band[1] - band[0]), x = Math.round((band[0] + band[1]) / 2 - w / 2);
      for (let i = 0; i < 2; i++) L.bossSlots.push({ x, y: top + i * 60, w, h: 54 });
      for (let i = 0; i < Math.min(2, o.bosses); i++) L.boss.push(Rr('boss' + i, x, top + i * 60, w, 54, false));
      L.bossBand = { x, w };
    }
    // ---- the plaque column (the rolled scroll always takes plaque slot 1) ----
    let px, py, pw, ph, pmax;
    if (fam === 'phoneL') { px = left; py = sealsBottom + 8; pw = L.sealsRight - left; ph = 44; }
    else { px = scroll.x; py = scroll.y + scroll.h + 10; pw = scroll.w; ph = 44; }
    // ---- touch: the stick and the four-seat fan (drawn, without the stick, for a small mouse window too) ----
    const fr = fanR(fam, H);
    let stick = null, fan = null;
    L.seats = {};
    if (fam !== 'desk') {
      if (o.touch) {
        const sr = STICKR[fam], sx = left + sr + 6, sy = bottom - sr - 6;
        stick = { x: mir(sx), y: sy, r: sr, keep: sr + 6 };
        Cc('stick', stick.x, stick.y, stick.keep, false, { stick: true, persist: true });
      }
      const Sx = right - fr.s - 4, Sy = bottom - fr.s - 4;
      const s = { x: Sx, y: Sy }, u = { x: Sx - (fr.s + fr.u + fr.gap), y: Sy }, b = { x: Sx, y: Sy - (fr.s + fr.b + fr.gap + 6) };
      let d = fr.s + fr.c + fr.gap, c;
      for (; ; d += 1) {
        c = { x: Sx - d * Math.SQRT1_2, y: Sy - d * Math.SQRT1_2 };
        const ok = (p, r) => Math.hypot(c.x - p.x, c.y - p.y) >= fr.c + r + fr.gap + 4;
        if (ok(u, fr.u) && ok(b, fr.b) && ok(s, fr.s)) break;
      }
      fan = { s, u, b, c };
      const seat = (id, p, r) => { Cc(id, mir(p.x), p.y, r, true, { persist: true, seat: true }); Rr(id + ':ribbon', mir(p.x) - r * 0.68, p.y + r - 10, r * 1.36, 16, false, { deco: id }); L.seats[id] = { x: mir(p.x), y: p.y, r }; };
      seat('swing', s, fr.s); seat('use', u, fr.u); seat('block', b, fr.b); seat('ctx', c, fr.c);
    }
    // ---- the belt ----
    const beltP = fam === 'desk' ? 46 : fam === 'tab' ? (W > H ? 54 : 48) : fam === 'phoneL' ? 46 : Math.min(48, Math.floor((W - 2 * M - 22 - 6 - 32 - 8) / 6.08));
    const bagW = Math.round(beltP * 1.08), beltH = beltP + 10;
    const PG = 8; const beltW = 22 + 6 + 5 * beltP + 4 * PG + 8 + bagW;
    let belt;
    L.pouches = [];
    if (fam === 'desk') {
      const medW = 44 + 8 + 44 + 8 + 44 + 8 + 52;
      const w = beltW + 16 + medW, x = Math.round(W / 2 - w / 2), y = bottom - beltH;
      belt = { x, y, w, h: beltH };
      let cx = x + 28;
      for (let i = 0; i < 5; i++) { L.pouches.push(Rr('pouch' + (i + 1), cx, y + 5, beltP, beltP, true, { persist: true })); cx += beltP + PG; }
      L.bag = Rr('bag', cx + 3, y + 3, bagW, beltP + 4, true, { persist: true }); cx += 3 + bagW + 16;
      for (const [id, r] of [['ctx', 22], ['block', 22], ['use', 22], ['swing', 26]]) { Cc(id, cx + r, y + beltH / 2, r, true, { persist: true, seat: true }); L.seats[id] = { x: cx + r, y: y + beltH / 2, r, medal: true }; cx += 2 * r + 8; }
      Rr('belt:strap', x, y, w, beltH, false, { deco: 'belt', strap: true, persist: true });
    } else {
      const seatsR = [['s', fr.s], ['u', fr.u], ['b', fr.b], ['c', fr.c]];
      const fanTop = Math.min(...seatsR.map(([q, r]) => fan[q].y - r)) - 2;
      const stickTop = stick ? stick.y - stick.keep : Infinity;
      let placed = false;
      if (fam !== 'phoneP') {
        const by = bottom - beltH;
        const fanLeft = Math.min(...seatsR.filter(([q, r]) => fan[q].y + r + 6 > by - 10).map(([q, r]) => fan[q].x - r));
        const lo = stick ? (o.stickRight ? W - fanLeft : stick.x + stick.keep) + 10 : left + 4;
        const hi = stick ? (o.stickRight ? stick.x - stick.keep : fanLeft) - 10 : fanLeft - 10;
        const lo2 = o.stickRight && !stick ? W - fanLeft + 10 : lo, hi2 = o.stickRight && !stick ? right - 4 : hi;
        if (hi2 - lo2 >= beltW + 16) { belt = { x: Math.round((lo2 + hi2) / 2 - beltW / 2), y: by, w: beltW, h: beltH }; placed = true; }
      }
      if (!placed) { const by = Math.min(fanTop, stickTop) - 12 - beltH; belt = { x: Math.round(W / 2 - beltW / 2), y: by, w: beltW, h: beltH }; }
      Rr('belt:strap', belt.x, belt.y, belt.w, belt.h, false, { deco: 'belt', strap: true, persist: true });
      let cx = belt.x + 28;
      for (let i = 0; i < 5; i++) { L.pouches.push(Rr('pouch' + (i + 1), cx, belt.y + 5, beltP, beltP, true, { persist: true })); cx += beltP + PG; }
      L.bag = Rr('bag', cx + 3, belt.y + 3, bagW, beltP + 4, true, { persist: true });
    }
    L.belt = belt; L.beltP = beltP;
    // ---- plaque slots ----
    if (fam === 'desk' || fam === 'tab') pmax = 4;
    else {
      const under = L.items.filter(i => (i.tap || i.stick) && i.k === 'c' && i.y > H / 2 && i.x + i.r > px && i.x - i.r < px + pw);
      const limit = Math.min(belt.y - 8, fam === 'phoneP' ? H / 2 - 40 : Infinity, ...under.map(i => i.y - i.r - 8 - (i.stick ? 0 : 6)));
      pmax = Math.max(1, Math.min(fam === 'phoneP' && H < 700 ? 1 : 2, Math.floor((limit - py + 8) / (ph + 8))));
    }
    L.plaqueSlots = pmax;
    L.plaques = [];
    for (let i = 0; i < pmax; i++) L.plaques.push({ x: px, y: py + i * (ph + 8), w: pw, h: ph });
    const nPl = Math.min(pmax, o.plaques);
    for (let i = 0; i < nPl; i++) if (!(i === 0 && fam === 'phoneP' && o.dialog)) Rr(i === 0 && scrollRolled ? 'rolledScroll' : 'plaque' + i, px, py + i * (ph + 8), pw, ph, true, { persist: !(i === 0 && scrollRolled) });
    L.rolled = scrollRolled ? L.plaques[0] : null;
    const plaquesBottom = py + pmax * (ph + 8) - 8;
    // ---- the notice lane (fixed per size) ----
    let nt;
    if (bossTop) { const w = Math.min(520, band[1] - band[0]); nt = { x: Math.round((band[0] + band[1]) / 2 - w / 2), y: top + 2 * 60 + 4, w, h: 34 }; }
    else if (fam === 'tab') { const w = band0[1] - band0[0]; nt = { x: band0[0], y: top, w, h: 34 }; }
    else if (fam === 'phoneL') { const x = Math.max(scroll.x, L.sealsRight + 12); nt = { x, y: top + 96 + 8, w: scroll.x + scroll.w - x, h: 34 }; }
    else { const w = L.colLeft - 10 - left; let y = plaquesBottom + 8; if (y + 34 > H / 2 - 34) y = H / 2 + 40; nt = { x: left, y, w, h: 34 }; }
    Rr('notice', nt.x, nt.y, nt.w, nt.h, false, { lane: 'notice', transient: true });
    // ---- the chat strip (tap = the chat log) and the talk page (tap = the next line) ----
    const lineH = 20;
    const chatMax = fam === 'desk' || fam === 'tab' ? 4 : fam === 'phoneP' && H < 700 ? 1 : 2;
    L.chatMax = chatMax; L.chatLineH = lineH;
    const nChat = o.dialog ? 0 : Math.min(chatMax, o.chat);
    let dlg = null;
    if (o.dialog) {
      if (fam === 'desk') dlg = { w: 640, h: 132, x: W / 2 - 320, y: belt.y - 16 - 132 };
      else if (fam === 'phoneL') { const x = Math.max(scroll.x, L.sealsRight + 12); dlg = { x, y: top, w: scroll.x + scroll.w - x, h: 96 }; }
      else if (fam === 'phoneP') dlg = { x: left, y: scroll.y, w: scroll.w, h: scroll.h + 10 + 44 };
      else {
        const rOf = { s: fr.s, u: fr.u, b: fr.b, c: fr.c };
        const minX = Math.min(...['s', 'u', 'b', 'c'].map(q => mir(fan[q].x) - rOf[q])), maxX = Math.max(...['s', 'u', 'b', 'c'].map(q => mir(fan[q].x) + rOf[q]));
        const lo = o.stickRight ? maxX + 10 : (stick ? stick.x + stick.keep + 10 : left), hi = o.stickRight ? (stick ? stick.x - stick.keep - 10 : right) : minX - 10;
        const w = Math.min(640, hi - lo); dlg = { x: Math.round((lo + hi) / 2 - w / 2), w, h: 132, y: belt.y - 10 - 132 };
      }
      Rr('dialog', dlg.x, dlg.y, dlg.w, dlg.h, true);
    }
    L.chatLane = n => {
      if (!n) return null;
      let cx, cw2, cb;
      // a computer: bottom-left beside the belt, unless the belt leaves it too narrow to read a line (a 1000 px window); then above the belt
      if (fam === 'desk' && belt.x - 16 - left >= 280) { cx = left; cw2 = belt.x - 16 - left; cb = bottom; }
      else if (fam === 'phoneP') { cx = left; cw2 = right - left; cb = belt.y - 8; }
      else { cx = belt.x; cw2 = belt.w; cb = belt.y - 8; }
      const hh = Math.max(44, n * lineH); return { x: cx, y: cb - hh, w: cw2, h: hh, lines: n };
    };
    if (nChat) { const c = L.chatLane(nChat); Rr('chat', c.x, c.y, c.w, c.h, true); L.chat = c; }
    // ---- banners (transient, never tappable; one at a time on phones through the 13-ux queue) ----
    const knightTop = H / 2 - 34;
    const solid = () => L.items.filter(i => !/^banner/.test(i.id));
    const freeBand = (y, h) => {
      let lo = left, hi = right;
      for (const i of solid()) { const b = bbox(i); if (b.y > y + h || b.y + b.h < y) continue; if (b.x + b.w / 2 < W / 2) lo = Math.max(lo, b.x + b.w + 16); else hi = Math.min(hi, b.x - 16); }
      return [lo, hi];
    };
    const place = (y0, h, minW, maxW) => {
      for (let y = y0; y + h <= knightTop - 4; y += 4) { const [lo, hi] = freeBand(y, h); if (hi - lo >= minW) { const w = Math.min(maxW, hi - lo); return { x: Math.round((lo + hi) / 2 - w / 2), y, w, h }; } }
      return null;
    };
    L.banners = [];
    if (fam === 'phoneL' || fam === 'phoneP') {
      const b = !scrollHidden ? { x: scroll.x, y: scroll.y, w: scroll.w, h: scroll.h, at: 'scroll' } : { x: nt.x, y: nt.y, w: nt.w, h: nt.h, at: 'notice' };
      Rr('banner', b.x, b.y, b.w, b.h, false, { transient: true, lane: 'banner' }); L.banners.push(b);
    } else {
      const a = place(Math.round(H * 0.22) - 24, 48, 320, 560);
      if (a) { Rr('banner', a.x, a.y, a.w, a.h, false, { transient: true, lane: 'banner' }); L.banners.push(a); } else L.bannerFail = true;
      if (a) { const b = place(Math.max(a.y + 56, Math.round(H * 0.34) - 24), 48, 320, 560); if (b) { Rr('banner2', b.x, b.y, b.w, b.h, false, { transient: true, lane: 'banner' }); L.banners.push(b); } else L.bannerFail = true; }
    }
    L.knight = { x: W / 2 - 22, y: H / 2 - 34, w: 44, h: 70 };
    L.stick = stick; L.fan = fan; L.fr = fr; L.dialog = dlg; L.notice = nt;
    return L;
  }
  // the keep-out bands: the notch / Dynamic Island / home indicator
  function bands(L) {
    const { VW: W, VH: H, S } = L, out = [];
    if (S.t) out.push({ k: 'r', x: 0, y: 0, w: W, h: S.t, name: 'top notch band' });
    if (S.b) out.push({ k: 'r', x: 0, y: H - S.b, w: W, h: S.b, name: 'home-indicator band' });
    if (S.l) out.push({ k: 'r', x: 0, y: 0, w: S.l, h: H, name: 'left notch band' });
    if (S.r) out.push({ k: 'r', x: W - S.r, y: 0, w: S.r, h: H, name: 'right notch band' });
    return out;
  }
  // THE KNIGHT'S BOOK (the pause menu): a port of layout.js bookLayout()
  function bookLayoutFor(W, H, o) {
    o = Object.assign({ touch: true, online: true, page: 'kit', tiles: 12, extraRows: 1 }, o);
    const fam = family(W, H, o.touch), S = insets(W, H, fam, o.touch), M = Mx[fam];
    const L = { VW: W, VH: H, fam, S, M, items: [], knight: { x: -999, y: -999, w: 0, h: 0 }, tiles: [], rows: [], marks: [] };
    const Rr = (id, x, y, w, h, tap) => { const it = { id, k: 'r', x, y, w, h, tap }; L.items.push(it); return it; };
    const Cc = (id, x, y, r, tap) => { const it = { id, k: 'c', x, y, r, tap }; L.items.push(it); return it; };
    const aw = W - S.l - S.r - 2 * M, ah = H - S.t - S.b - 2 * M;
    const onePage = fam === 'phoneP';
    const w = onePage ? aw : Math.min(860, aw), h = onePage ? ah : Math.min(560, ah);
    const x = S.l + M + (aw - w) / 2, y = S.t + M + (ah - h) / 2;
    L.book = { x, y, w, h }; L.onePage = onePage;
    const cr = fam === 'tab' ? 25 : 22;
    L.close = Cc('book:close', x + w - cr - 8, y + cr + 8, cr, true);
    const rowH = fam === 'desk' ? 44 : 48;
    const nT = Math.max(12, o.tiles), nRows = Math.ceil(nT / 3);
    // Resume, Settings, one row per HOOKS.pauseMenu entry (Title screen is the first), New game
    const rows = ['resume', 'settings'].concat(Array.from({ length: Math.max(1, o.extraRows) }, (_, i) => i ? 'extra' + i : 'title'), ['newgame']);
    const grid = (gx, gy, gw, gh) => {
      const tw_ = (gw - 2 * 12) / 3, keyH = fam === 'desk' ? 18 : 0;
      const Dd = Math.min(fam === 'phoneL' ? 46 : 56, tw_ - 10, (gh - (nRows - 1) * 8) / nRows - 16 - keyH);
      const th = Dd + 16 + keyH;
      // spread the rows down the page when there is room (a tall phone), never closer than the spec's pitch
      const pitch = Math.max(th + 8, Math.min(th + 40, (gh - th) / Math.max(1, nRows - 1)));
      for (let i = 0; i < nT; i++) { const cx = gx + (i % 3) * (tw_ + 12) + tw_ / 2, cy = gy + Math.floor(i / 3) * pitch + Dd / 2; L.tiles.push(Cc('tile' + i, cx, cy, Dd / 2, true)); }
      L.tileD = Dd; L.tileW = tw_; L.grid = { x: gx, y: gy, w: gw, h: gh }; return gy + (nRows - 1) * pitch + th + 8;
    };
    const rowList = (rx, ry, rw) => {
      let yy = ry;
      for (const r of rows) { L.rows.push(Rr('row:' + r, rx, yy, rw, rowH, true)); yy += rowH + 10; }
      L.rowsBottom = yy; return yy;
    };
    if (onePage) {
      const bw = 96; L.marks.push(Rr('mark:kit', x + 16, y + 8, bw, 44, true)); L.marks.push(Rr('mark:game', x + 16 + bw + 10, y + 8, bw, 44, true));
      const py = y + 8 + 44 + 16;
      L.pageTop = py;
      if (o.page === 'kit') L.bottom = grid(x + 16, py + 22, w - 32, h - (py - y) - 16 - 22);
      else if (o.page === 'game') { L.bottom = rowList(x + 16, py + 78, w - 32); L.statsY = L.bottom + 18; }
      else L.bottom = py;
      L.pages = [{ x: x + 10, y: y + 60, w: w - 20, h: h - 70 }];
    } else {
      const pw = (w - 30) / 2, lx = x + 12, rx = x + 18 + pw, top = y + (fam === 'phoneL' ? 50 : 70);
      L.pages = [{ x: x + 10, y: y + 10, w: pw + 4, h: h - 20 }, { x: rx - 4, y: y + 10, w: pw + 4, h: h - 20 }];
      rowList(lx + 12, top + (fam === 'phoneL' ? 0 : 20), pw - 24);
      L.statsY = y + h - 38;
      if (fam === 'desk') { L.marks.push(Rr('mark:kit', rx + pw - 2 * 90 - 70, y + 12, 90, 44, true)); L.marks.push(Rr('mark:keys', rx + pw - 90 - 64, y + 12, 90, 44, true)); }
      if (o.page === 'keys' && fam === 'desk') { L.keysBox = { x: rx + 12, y: top, w: pw - 24, h: h - (top - y) - 12 }; L.bottom = top; }
      else L.bottom = grid(rx + 12, top, pw - 24, h - (top - y) - 12);
      L.titleX = lx + pw / 2; L.titleY = y + 44;
    }
    return L;
  }

  // =================================================================================================
  // THE LIVE HUD STATE: the layout for this frame, the press / hover / hold, the seats, the plaque slots
  // =================================================================================================
  const FRAME = { L: null, bosses: [], chatLines: 0, drawn: [], faces: {}, plaqueRects: [], overflow: 0, lastBook: null };
  const liveOpts = () => ({
    touch: touchOn(), stickRight: window.__stickRight === true,
    minimap: !(window.SETTINGS && SETTINGS.get && SETTINGS.get('minimap') === false),
    online: !!(window.NET && NET.enabled),
    home: !!(typeof player !== 'undefined' && player && player.home),
    bosses: FRAME.bosses.length, dialog: !!(typeof dialog !== 'undefined' && dialog && dialog.cur),
    chat: FRAME.chatLines, plaques: 99,
  });
  function layout(extra) {
    const L = layoutFor(VW, VH, Object.assign(liveOpts(), extra || {}));
    FRAME.L = L;
    if (typeof HUD_LAYOUT !== 'undefined') {
      const q = L.scrollHidden ? (L.rolled || null) : L.scroll;
      Object.assign(HUD_LAYOUT, {
        narrow: VW < 640, short: L.fam === 'phoneL', fam: L.fam,
        hotbarY: L.belt.y, hotbarH: L.belt.h, noticeY: L.notice.y, topStackBottom: L.crest.y + L.crest.h,
        questX: q ? q.x : 0, questY: q ? q.y : 0, questW: q ? q.w : 0, questH: q ? q.h : 0,
        bossBarY: L.plaques[0] ? L.plaques[0].y : L.crest.y + L.crest.h + 10, col2Top: L.top,
        crest: L.crest, mm: L.mm, seals: L.seals, scroll: L.scroll, belt: L.belt, seats: L.seats, notice: L.notice, plaques: L.plaques, bossSlots: L.bossSlots, safe: L.S,
      });
    }
    return L;
  }
  const cur = () => FRAME.L || layout();

  // ---------- press / hover / hold (05-input feeds these) ----------
  const INPUT = { press: null, last: null, hover: null, hoverT: 0, pos: {}, cursor: '' };
  const HOLD_NAME_MS = 400, PRESS_MIN_MS = 100;
  function hitButton(b, x, y, slop = 0) {
    if (!b) return false;
    if (b.r) { const cx = b.cx != null ? b.cx : b.x + b.w / 2, cy = b.cy != null ? b.cy : b.y + b.h / 2; return Math.hypot(x - cx, y - cy) <= b.r + slop; }
    return x >= b.x - slop && x <= b.x + b.w + slop && y >= b.y - slop && y <= b.y + b.h + slop;
  }
  function pressStart(b, x, y, id, fired) {
    INPUT.press = { b, label: b.label, x, y, id, t0: now(), up: !!b.up, hold: !!b.hold, fired: !!fired, inside: true, named: false };
    INPUT.pos[id] = { x, y };
  }
  function pressMove(x, y, id) {
    INPUT.pos[id] = { x, y };
    const p = INPUT.press;
    if (p && p.id === id && (p.up || p.hold)) p.inside = hitButton(p.b, x, y, 10);
    if (id === 'mouse' && !p) {
      let h = null;
      if (typeof buttons !== 'undefined') for (let i = buttons.length - 1; i >= 0; i--) { const b = buttons[i]; if (b.disabled || b.offscreen || b.inert) continue; if (hitButton(b, x, y)) { h = b; break; } }
      const lbl = h ? h.label : null;
      if (!INPUT.hover || INPUT.hover.label !== lbl) INPUT.hover = lbl ? { label: lbl, b: h, t0: now() } : null;
      else if (h) INPUT.hover.b = h;
      const want = h ? 'pointer' : '';
      if (want !== INPUT.cursor) { INPUT.cursor = want; try { if (typeof canvas !== 'undefined' && canvas.style) canvas.style.cursor = want || 'default'; } catch (e) { } }
    }
  }
  function pressDrop(id) { if (INPUT.press && INPUT.press.id === id) INPUT.press = null; }
  // returns true when the release belonged to a HUD control (so it is not also a tap on the world)
  function pressEnd(id, x, y) {
    const p = INPUT.press;
    if (!p || p.id !== id) return false;
    INPUT.press = null;
    const t = now();
    INPUT.last = { label: p.label, t0: p.t0, until: Math.max(t, p.t0 + PRESS_MIN_MS) };
    if (x != null && y != null) p.inside = hitButton(p.b, x, y, 10);
    if (p.up && p.inside && !p.named && t - p.t0 < HOLD_NAME_MS) {
      try { if (typeof sfx === 'function') sfx('ui'); } catch (e) { }
      learn(p.b.learn);
      p.b.action();
    }
    return true;
  }
  // a pointer-up control held 400 ms names itself (the touch twin of a tooltip) instead of firing
  function holdTick() {
    const p = INPUT.press;
    if (p && p.up && p.inside && !p.named && now() - p.t0 >= HOLD_NAME_MS) p.named = true;
  }
  const held = label => { const p = INPUT.press; return !!(p && p.hold && p.inside && (label == null || p.label === label || (p.b && p.b.seat === label))); };
  function stateOf(label) {
    const p = INPUT.press, t = now(), L0 = INPUT.last;
    const live = !!(p && p.label === label && (p.inside || p.fired));
    const pressed = live || !!(L0 && L0.label === label && t < L0.until);
    const ripple = p && p.label === label ? t - p.t0 : L0 && L0.label === label ? t - L0.t0 : null;
    const hover = !touchOn() && !!INPUT.hover && INPUT.hover.label === label && !p;
    return { pressed, ripple, hover };
  }

  // ---------- "Button words": a ribbon on SWING / BLOCK / HOME / FRIENDS / MENU hides after 20 uses (while learning) ----------
  const LEARN_MAX = 20;
  function lsGet(k0) { try { return localStorage.getItem(k0); } catch (e) { return null; } }
  function lsSet(k0, v) { try { localStorage.setItem(k0, v); return true; } catch (e) { return false; } }
  const learnMem = {};
  function learn(id) { if (!id) return; const n = learnCount(id) + 1; learnMem[id] = n; lsSet('fl_learn_' + id, String(n)); }
  function learnCount(id) { if (learnMem[id] != null) return learnMem[id]; const v = +(lsGet('fl_learn_' + id) || 0); learnMem[id] = v || 0; return learnMem[id]; }
  const wordsMode = () => { const w = window.SETTINGS && SETTINGS.get ? SETTINGS.get('words') : undefined; return w === 'always' || w === 'off' ? w : 'learning'; };
  function showWord(id) { const m = wordsMode(); if (m === 'always') return true; if (m === 'off') return false; return learnCount(id) < LEARN_MAX; }

  // ---------- the coach: "[E] Talk to Tobin", in the world, the first 3 times an action becomes available ----------
  const COACH_MAX = 3, coachSession = {}, coachLive = {};
  function coachCount(id) { const v = lsGet('fl_coach_' + id); if (v === null) return coachSession[id] || 0; return +v || 0; }
  // HK.teach(id, key, verb, at): call it every frame the action is available; it counts one "showing" per appearance.
  // at = { x, y } in world pixels (the thing), or { sx, sy } in screen pixels. On touch the seat's emblem shows instead of a key.
  function teach(id, key, verb, at, o = {}) {
    const t = now(), c = coachLive[id];
    if (!c || t - c.seen > 1500) {
      if (coachCount(id) >= COACH_MAX) { coachLive[id] = { seen: t, off: true }; return false; }
      const n = coachCount(id) + 1;
      if (!lsSet('fl_coach_' + id, String(n))) coachSession[id] = COACH_MAX;   // storage refused: at most once a session
      else coachSession[id] = n;
      coachLive[id] = { seen: t, since: t, off: false };
    } else c.seen = t;
    if (coachLive[id].off) return false;
    FRAME.coach = FRAME.coach || []; FRAME.coach.push({ id, key, verb, at, emblem: o.emblem || null, side: o.side || (at && at.sx != null ? 'right' : null) });
    return true;
  }

  // ---------- plaque slots: HK.slot() / HK.claim() keep the old cursor contract (HUD.leftY) but hand out plaque slots ----------
  const OFF = { x: -4000, y: -4000 };
  function beginPlaques(L, reserveFirst) {
    FRAME.plaqueRects = L.plaques.slice(); FRAME.overflow = 0; FRAME.plaqueStart = reserveFirst ? 1 : 0;
    HUD.leftCol = 0; HUD.leftY = L.plaques[FRAME.plaqueStart] ? L.plaques[FRAME.plaqueStart].y : L.plaques.length ? L.plaques[L.plaques.length - 1].y + 52 : L.crest.y + L.crest.h + 10;
  }
  function slotAt(h, peek) {
    const P = FRAME.plaqueRects; if (!P || !P.length) { if (!peek) FRAME.overflow++; return null; }
    const n = h <= 56 ? 1 : 1 + Math.ceil((h - 44) / 52);
    let i = P.findIndex((p, k) => k >= (FRAME.plaqueStart || 0) && p.y >= HUD.leftY - 1);
    if (i < 0 || i + n - 1 >= P.length) { if (!peek) FRAME.overflow++; return null; }
    const r = { x: P[i].x, y: P[i].y, w: P[i].w, h: n * 44 + (n - 1) * 8, col: 0 };
    if (!peek) { HUD.leftY = r.y + r.h + 8; FRAME.lastPlaque = i + n - 1; }
    return r;
  }
  // old contract: always returns a rect (off-screen when the column is full, and the overflow is counted for the +n badge)
  function slot(h) { const r = slotAt(h, false); return r || { x: OFF.x, y: OFF.y, w: cur().plaques[0] ? cur().plaques[0].w : 200, h, col: 0, full: true }; }
  function claim(h, opt = {}) { const r = slotAt(h, false); if (!r) return null; if (opt.w) r.w = Math.min(r.w, opt.w); return r; }
  // THE WAY TO ADD A PLAQUE: claims the next slot and draws it. Returns the rect, or null when it folded into the +n badge.
  function addPlaque(g, o) {
    const r = slotAt(44, false); if (!r) return null;
    const key = o.id || o.name; const t = now();
    FRAME.plaqueSeen = FRAME.plaqueSeen || {};
    const born = PLAQ_BORN[key] && t - PLAQ_BORN[key].seen < 600 ? PLAQ_BORN[key].born : t;
    PLAQ_BORN[key] = { born, seen: t };
    plaque(g, r, Object.assign({ alpha: cl((t - born) / 150, 0, 1) }, o));
    return r;
  }
  const PLAQ_BORN = {};

  // ---------- seat faces ----------
  const SEATS = ['swing', 'use', 'block', 'ctx'];
  const val = x => { try { return typeof x === 'function' ? x() : x; } catch (e) { return undefined; } };
  function faceOf(seat) {
    const list = (hudSeatFace.list || []).filter(f => f.seat === seat).sort((a, b) => (b.prio || 0) - (a.prio || 0));
    for (const f of list) {
      let ok = false; try { ok = f.when ? !!f.when() : true; } catch (e) { ok = false; }
      if (!ok) continue;
      const ribbon = val(f.ribbon);
      return {
        id: f.id, seat, emblem: val(f.emblem), ribbon, label: val(f.label) || ribbon || f.id, key: val(f.key), name: val(f.name) || null,
        action: f.action, hold: !!val(f.hold), lit: !!val(f.lit), on: !!val(f.on), disabled: !!val(f.disabled), asleep: !!val(f.asleep),
        cool: val(f.cool) || null, charge: val(f.charge), badge: val(f.badge), learn: f.learn || null, faceHi: val(f.faceHi), emCol: val(f.emCol),
      };
    }
    return null;
  }
  const SWAP = {};   // per seat: the face it showed last frame, for the 120 ms cross-fade

  // ---------- bosses for the banner slots ----------
  const TRAIL = new Map();   // per boss: the damage trail (lags 400 ms, then drains over 300 ms)
  function trailFor(key, frac) {
    const t = now(); let s = TRAIL.get(key);
    if (!s) { s = { shown: frac, hold: 0, from: frac }; TRAIL.set(key, s); }
    if (frac > s.shown) { s.shown = frac; s.hold = 0; }
    else if (frac < s.shown) {
      if (!s.hold) { s.hold = t; s.from = s.shown; }
      const e = t - s.hold;
      if (e > 400) s.shown = Math.max(frac, s.from - (s.from - frac) * cl((e - 400) / 300, 0, 1));
      if (s.shown <= frac + 1e-4) { s.shown = frac; s.hold = 0; }
    }
    if (TRAIL.size > 20) TRAIL.delete(TRAIL.keys().next().value);
    return s.shown;
  }
  // =================================================================================================
  // THE CORE HUD PIECES (10-hud's drawHud calls these in order; each pushes its own taps into `buttons`)
  // =================================================================================================
  const push = b => { if (typeof buttons !== 'undefined') buttons.push(b); return b; };
  const circleBtn = (label, c, action, o = {}) => push(Object.assign({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2, r: c.r, cx: c.x, cy: c.y, label, action }, o));
  const dimmed = () => typeof player !== 'undefined' && player && player.dead;
  function withDim(g, fn) { if (!dimmed()) return fn(); g.save(); g.globalAlpha *= 0.45; try { fn(); } finally { g.restore(); } }
  const mmss = s => { s = Math.max(0, Math.ceil(s)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}`; };

  // ---- the ring (the minimap in a forged iron ring, the day riding its top arc) ----
  function metalRing(g, cx, cy, rO, rI, brass) {
    const gr = g.createLinearGradient(cx - rO, cy - rO, cx + rO * 0.6, cy + rO);
    if (brass) { gr.addColorStop(0, '#fff0bd'); gr.addColorStop(0.35, '#b88d3e'); gr.addColorStop(1, '#3b2a0c'); }
    else { gr.addColorStop(0, '#b6bec9'); gr.addColorStop(0.35, '#5c636d'); gr.addColorStop(1, '#17191d'); }
    g.beginPath(); g.arc(cx, cy, rO, 0, TAU); g.arc(cx, cy, rI, 0, TAU, true); g.fillStyle = gr; g.fill();
    texture(g, 'iron', 0.5, () => { g.beginPath(); g.arc(cx, cy, rO, 0, TAU); g.arc(cx, cy, rI, 0, TAU, true); }, cx - rO, cy - rO, rO * 2, rO * 2);
    g.beginPath(); g.arc(cx, cy, rO, 0, TAU); g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.arc(cx, cy, rI, 0, TAU); g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 1.5; g.stroke();
    const rm = (rO + rI) / 2, bez = rO - rI;
    for (const a of [0.2, 0.5, 0.8, 0.02, 0.98].map(v => v * Math.PI)) rivet(g, cx + Math.cos(a) * rm, cy + Math.sin(a) * rm, Math.max(1.4, bez * 0.26), brass);
    // the expand mark at 4:30: decoration inside the ring's hit, not a second target
    const ea = Math.PI * 0.25, erd = Math.max(8, Math.round(rI * 0.15)), ecx = cx + Math.cos(ea) * (rI + bez * 0.2), ecy = cy + Math.sin(ea) * (rI + bez * 0.2);
    shadowed(g, () => { g.beginPath(); g.arc(ecx, ecy, erd, 0, TAU); g.fillStyle = '#000'; g.fill(); }, 4, 2);
    const eg = g.createLinearGradient(ecx - erd, ecy - erd, ecx + erd, ecy + erd); eg.addColorStop(0, brass ? '#fff0bd' : '#aab2bd'); eg.addColorStop(1, brass ? '#5a4210' : '#22252a');
    g.beginPath(); g.arc(ecx, ecy, erd, 0, TAU); g.fillStyle = eg; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.arc(ecx, ecy, erd - 2.5, 0, TAU); g.fillStyle = '#1a1c20'; g.fill();
    g.fillStyle = g.strokeStyle = brass ? T.goldHi : T.ink; EM.expand(g, ecx, ecy, erd * 1.25);
  }
  // the same window 09-render's drawMinimap paints (miniWindow: 44 tiles across in the world, the whole instance inside a small one)
  function miniView() {
    if (typeof miniWindow === 'function') { const w = miniWindow(1); return { across: w.across, sx: w.sx, sy: w.sy }; }
    const across = 44, sx = cl(player.x / TILE - across / 2, 0, MAP_W - across), sy = cl(player.y / TILE - across / 2, 0, MAP_H - across);
    return { across, sx, sy };
  }
  function drawRing(g, L) {
    const mm = L.mm, st = stateOf('minimap'), on = !(window.SETTINGS && SETTINGS.get && SETTINGS.get('minimap') === false);
    const open = typeof panel !== 'undefined' && panel;
    if (!on) {
      // Minimap Off: a 48 px iron map stud in the same place; the seals do not move
      const c = { x: mm.x, y: mm.y, r: 24 }, s2 = stateOf('MAP');
      stud(g, c.x, c.y, c.r, 'map', { pressed: s2.pressed, hover: s2.hover, ripple: s2.ripple, on: open === 'map' });
      if (!open || open === 'map') circleBtn('MAP', c, () => { panel === 'map' ? closePanel() : openPanel('map'); }, { up: true, nameHold: true, name: 'World map', keys: ['M'] });
      if (typeof minimapRect !== 'undefined') minimapRect = null;
      return;
    }
    const cx = mm.x, cy = mm.y, r = mm.r, R = mm.R, brass = st.hover || st.pressed;
    cache(g, `ringS|${R}`, cx - R, cy - R, R * 2, R * 2, (cg, ox, oy) => shadowed(cg, () => { cg.beginPath(); cg.arc(ox + R, oy + R, R, 0, TAU); cg.fillStyle = '#0b0c0e'; cg.fill(); }, 12, 5, 'rgba(0,0,0,0.6)'), 22);
    if (st.hover) shadowed(g, () => { g.beginPath(); g.arc(cx, cy, R + 1, 0, TAU); g.strokeStyle = T.goldHi; g.lineWidth = 2; g.stroke(); }, 12, 0, T.goldHi);
    const day = window.NIGHT && NIGHT.dayT ? cl(NIGHT.dayT() / (NIGHT.DAY || 600), 0, 1) : 0.3;
    const ph = window.NIGHT && NIGHT.phase ? NIGHT.phase() : 'day';
    const inst = window.__instance, after = window.NIGHT && inst === 'afterlands';
    const night = ph === 'night' || after, dusk = ph === 'dusk';
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
    g.fillStyle = '#10141a'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    try { if (typeof drawMinimap === 'function') drawMinimap(g, cx - r, cy - r, r * 2); } catch (e) { }
    if (night && !(inst && !after)) { g.fillStyle = 'rgba(12,22,60,0.38)'; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
    const vg = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)'); g.fillStyle = vg; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    // you: a white arrowhead, facing the way the knight faces, repainted on top of every dot and glyph
    const v = miniView(), sc = (r * 2) / v.across;
    const ux = cx - r + (player.x / TILE - v.sx) * sc, uy = cy - r + (player.y / TILE - v.sy) * sc, fa = Math.atan2(player.facing.y || 0, player.facing.x || 1);
    g.save(); g.translate(ux, uy); g.rotate(fa); const yr = Math.max(4, r * 0.08);
    g.beginPath(); g.moveTo(yr * 1.2, 0); g.lineTo(-yr * 0.8, -yr * 0.85); g.lineTo(-yr * 0.35, 0); g.lineTo(-yr * 0.8, yr * 0.85); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1.2; g.stroke(); g.restore();
    g.restore();
    cache(g, `ring|${R}|${r}|${+brass}`, cx - R, cy - R, R * 2, R * 2, (cg, ox, oy) => metalRing(cg, ox + R, oy + R, R, r, brass), 8);
    // the day: a groove along the top arc; the sun rides it by day, it reddens at dusk, the moon rides it at night
    const bez = R - r, a0 = Math.PI * 1.16, a1 = Math.PI * 1.84, rm = r + bez / 2;
    g.beginPath(); g.arc(cx, cy, rm, a0, a1); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = bez * 0.62; g.lineCap = 'round'; g.stroke();
    const dg = g.createLinearGradient(cx - rm, 0, cx + rm, 0);
    if (night) { dg.addColorStop(0, 'rgba(90,120,220,0.55)'); dg.addColorStop(1, 'rgba(120,150,240,0.6)'); }
    else if (dusk) { dg.addColorStop(0, 'rgba(255,150,80,0.45)'); dg.addColorStop(1, 'rgba(230,80,70,0.7)'); }
    else { dg.addColorStop(0, 'rgba(255,170,90,0.55)'); dg.addColorStop(0.5, 'rgba(255,226,140,0.6)'); dg.addColorStop(1, 'rgba(255,140,90,0.55)'); }
    g.beginPath(); g.arc(cx, cy, rm, a0, a1); g.strokeStyle = dg; g.lineWidth = bez * 0.28; g.stroke(); g.lineCap = 'butt';
    if (!inst || after) {
      const tt = after ? 0.5 : night ? cl((day - 0.8) / 0.2, 0, 1) : cl(day / 0.8, 0, 1), sa = a0 + (a1 - a0) * tt, sx = cx + Math.cos(sa) * rm, sy = cy + Math.sin(sa) * rm, sr = Math.max(3.5, bez * 0.62);
      if (night) {
        g.beginPath(); g.arc(sx, sy, sr * 1.9, 0, TAU); g.fillStyle = 'rgba(170,200,255,0.18)'; g.fill();
        g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fillStyle = '#e6eeff'; g.fill();
        g.beginPath(); g.arc(sx + sr * 0.45, sy - sr * 0.25, sr * 0.85, 0, TAU); g.fillStyle = '#1b2440'; g.fill();
      } else {
        g.beginPath(); g.arc(sx, sy, sr * 2, 0, TAU); g.fillStyle = 'rgba(255,210,90,0.16)'; g.fill();
        g.strokeStyle = dusk ? '#ff9a5a' : '#ffd766'; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.moveTo(sx + Math.cos(a) * sr * 1.25, sy + Math.sin(a) * sr * 1.25); g.lineTo(sx + Math.cos(a) * sr * 1.75, sy + Math.sin(a) * sr * 1.75); } g.stroke();
        g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fillStyle = dusk ? '#ffb070' : '#ffe07a'; g.fill();
        g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.strokeStyle = '#7a4a0a'; g.lineWidth = 1; g.stroke();
      }
    }
    // the quest compass: a gold arrowhead on the inside edge at the target's bearing, or a pulsing gold ring inside the glass
    try { if (typeof drawCompass === 'function') drawCompass(g, cx - r, cy - r, r * 2); } catch (e) { }
    // the tap: the whole ring (glass + iron). minimapRect stays the glass square so feature dots still land on the map.
    if (typeof minimapRect !== 'undefined') minimapRect = open ? null : { x: cx - r, y: cy - r, w: r * 2, h: r * 2, r: R, cx, cy };
    if (!open || open === 'map') circleBtn('minimap', { x: cx, y: cy, r: R }, () => { panel === 'map' ? closePanel() : openPanel('map'); }, { up: true, nameHold: true, name: 'World map', keys: ['M'], sub: touchOn() ? '' : 'Click to open the big map' });
  }
  // the compass arrow / ring, drawn on the ring (10-hud's drawCompass calls this with the glass square)
  function compassOnRing(g, x, y, size) {
    const t = typeof trackedTarget === 'function' ? trackedTarget() : null; if (!t) return;
    const r = size / 2, cx = x + r, cy = y + r, v = miniView(), sc = size / v.across;
    const mx = x + (t.x + 0.5 - v.sx) * sc, my = y + (t.y + 0.5 - v.sy) * sc;
    if (Math.hypot(mx - cx, my - cy) < r - 8) {
      const p = 5 + Math.sin(now() / 250) * 1.5;
      g.save(); g.strokeStyle = 'rgba(40,24,4,0.8)'; g.lineWidth = 4; g.beginPath(); g.arc(mx, my, p, 0, TAU); g.stroke();
      g.strokeStyle = T.goldHi; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, p, 0, TAU); g.stroke(); g.beginPath(); g.arc(mx, my, p + 4, 0, TAU); g.globalAlpha *= 0.5; g.stroke(); g.restore();
      return;
    }
    const ang = Math.atan2(my - cy, mx - cx), ex = cx + Math.cos(ang) * (r - 9), ey = cy + Math.sin(ang) * (r - 9);
    g.save(); g.translate(ex, ey); g.rotate(ang);
    g.beginPath(); g.moveTo(11, 0); g.lineTo(-8, -9.5); g.lineTo(-3.5, 0); g.lineTo(-8, 9.5); g.closePath(); g.fillStyle = 'rgba(255,200,80,0.25)'; g.fill();
    g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -7); g.lineTo(-2.5, 0); g.lineTo(-6, 7); g.closePath(); g.fillStyle = T.goldHi; g.fill(); g.strokeStyle = '#3a2708'; g.lineWidth = 1; g.stroke(); g.restore();
  }

  // ---- HOME / FRIENDS / MENU ----
  function drawSeals(g, L) {
    const S0 = L.seals, open = typeof panel !== 'undefined' ? panel : null;
    const rib = (id, word) => L.fam !== 'desk' && showWord(id) ? word : null;
    // a seal's ribbon may be as wide as the room to its neighbours allows (the column on an upright phone has no neighbour
    // beside it, only the screen's edge)
    const ids = Object.keys(S0), sealRibbon = (c, word, id) => {
      let room = 96;
      for (const k of ids) { const o = S0[k]; if (o === c || Math.abs(o.y - c.y) > 4) continue; room = Math.min(room, Math.abs(o.x - c.x) - 12); }
      room = Math.min(room, 2 * (VW - L.S.r - 2 - c.x), 2 * (c.x - L.S.l - 2));
      ribbon(g, c.x, c.y + c.r + 3, word, { size: 10, h: 14, tail: 4, maxW: room, id, fitId: id });
    };
    // HOME: an iron stud, hidden until a lodestone is set (its slot stays reserved), asleep in a machine
    if (S0.home && player.home) {
      const c = S0.home, st = stateOf('HOME'), left = HOME_COOLDOWN - (time - (player.homeCd || -1e9)), cool = left > 0 ? { frac: left / HOME_COOLDOWN, text: mmss(left) } : null;
      stud(g, c.x, c.y, c.r, 'home', { pressed: st.pressed, hover: st.hover, ripple: st.ripple, cool, asleep: !!player.mech, id: 'home' });
      if (rib('home', 'HOME')) sealRibbon(c, 'HOME', 'home');
      circleBtn('HOME', c, () => goHome(), { up: true, nameHold: true, learn: 'home', name: cool ? `Home · ready in ${mmss(left)}` : 'Home', keys: ['H'] });
    }
    if (S0.friends) {
      const f = hudSeal.map && hudSeal.map.friends ? val(hudSeal.map.friends) : null;
      if (f && f.show !== false) {
        const c = S0.friends, st = stateOf('friends');
        seal(g, c.x, c.y, c.r, 'friends', f.wax || 'blue', { pressed: st.pressed, hover: st.hover, ripple: st.ripple, on: !!f.on, seed: 23, scale: 0.9, badge: f.badge });
        if (rib('friends', 'FRIENDS')) sealRibbon(c, 'FRIENDS', 'friends');
        circleBtn('friends', c, () => { if (f.action) f.action(); }, { up: true, nameHold: true, learn: 'friends', name: f.name || 'Friends', keys: ['F'], badge: f.badge });
      }
    }
    if (S0.menu) {
      const c = S0.menu, st = stateOf('MENU');
      seal(g, c.x, c.y, c.r, 'book', 'umber', { pressed: st.pressed, hover: st.hover, ripple: st.ripple, seed: 41, scale: 0.78 });
      if (rib('menu', 'MENU')) sealRibbon(c, 'MENU', 'menu');
      circleBtn('MENU', c, () => { paused = !paused; if (paused) BOOK.page = FRAME.L && FRAME.L.fam === 'phoneP' ? 'kit' : 'kit'; }, { up: true, nameHold: true, learn: 'menu', name: 'Menu', keys: ['Esc'] });
    }
  }

  // ---- the crest ----
  const CREST_ANIM = { shown: null, t: 0, lastHp: null, flashT: -1e9 };
  function drawCrest(g, L) {
    const mech = player.mech ? { name: mechLabel(), hp: Math.ceil(player.mech.hp), max: player.mech.maxHp, emblem: player.mech.kind === 'horse' ? 'horseshoe' : 'cog' } : null;
    const target = player.dead ? 0 : mech ? mech.hp / Math.max(1, mech.max) : player.hp / Math.max(1, player.maxHp);
    const t = now(), dt = Math.min(0.1, (t - (CREST_ANIM.t || t)) / 1000); CREST_ANIM.t = t;
    if (CREST_ANIM.shown == null) CREST_ANIM.shown = target;
    const hpNow = mech ? mech.hp : player.hp;
    if (CREST_ANIM.lastHp != null && hpNow < CREST_ANIM.lastHp) CREST_ANIM.flashT = t;
    CREST_ANIM.lastHp = hpNow;
    CREST_ANIM.shown += (target - CREST_ANIM.shown) * cl(dt / 0.25 * 3, 0, 1);
    if (Math.abs(target - CREST_ANIM.shown) < 0.002) CREST_ANIM.shown = target;
    const flash = cl(1 - (t - CREST_ANIM.flashT) / 300, 0, 1);
    const sv = typeof title !== 'undefined' && title && title.savedAt ? (performance.now() - title.savedAt) / 1000 : 99;
    const cv = window.CLOUD && CLOUD.savedAt ? (performance.now() - CLOUD.savedAt) / 1000 : 99;
    const fade = e => e < 0 ? 0 : e < 0.2 ? e / 0.2 : e < 1.2 ? 1 - (e - 0.2) : 0;
    const st = stateOf('crest');
    crest(g, L.crest, { hp: Math.ceil(player.hp), max: player.maxHp, coins: typeof coins === 'function' ? coins() : 0, combat: typeof combatLevel === 'function' ? combatLevel() : 1, kid: !!window.__kidmode, mech, frac: CREST_ANIM.shown, flash, saved: fade(sv), cloud: fade(cv), hover: st.hover, pressed: st.pressed, dead: player.dead });
    const open = typeof panel !== 'undefined' ? panel : null;
    if (!open || open === 'skills') push({ x: L.crest.x, y: L.crest.y, w: L.crest.w, h: L.crest.h, label: 'crest', action: () => { panel === 'skills' ? closePanel() : openPanel('skills'); }, up: true, nameHold: true, name: mech ? `Your skills · in the ${mech.name}` : 'Your skills', keys: ['Tab'] });
  }

  // ---- the quest scroll, the rolled strip, the boss banners ----
  function trackedQuest() { try { return quest.tracked && typeof activeQuests === 'function' && activeQuests().includes(quest.tracked) ? quest.tracked : null; } catch (e) { return null; } }
  function openQuest() { if (trackedQuest() && HOOKS.panel && HOOKS.panel.quest_detail) openPanel('quest_detail'); else openPanel('quests'); }
  function drawScroll(g, L) {
    const id = trackedQuest(), open = typeof panel !== 'undefined' ? panel : null;
    const title = id ? (QUEST_DEFS[id] ? QUEST_DEFS[id].name : id) : 'No quest followed';
    const txt = id ? (typeof questText === 'function' ? questText(id) : '') : 'Tap to pick one';
    if (!L.scrollHidden) {
      const st = stateOf('questbox:open'), r = L.scroll;
      questScroll(g, r, { title, text: id ? txt : (touchOn() ? 'Tap to pick one.' : 'Click to pick one.'), empty: !id, pressed: st.pressed, hover: st.hover, size: L.fam === 'desk' || L.fam === 'tab' ? 14 : 13 });
      if (!open) push({ x: r.x, y: r.y, w: r.w, h: r.h, label: 'questbox:open', action: openQuest, up: true, nameHold: true, name: id ? 'Your quest' : 'Pick a quest', keys: ['J'] });
    } else if (L.rolled) {
      const st = stateOf('questbox:open'), r = L.rolled;
      rolledScroll(g, r, id ? title : 'Quests', { pressed: st.pressed, hover: st.hover });
      if (!open) push({ x: r.x, y: r.y, w: r.w, h: r.h, label: 'questbox:open', action: openQuest, up: true, nameHold: true, name: 'Your quest', keys: ['J'] });
    }
  }
  function drawBosses(g, L) {
    const n = Math.min(2, FRAME.bosses.length);
    for (let i = 0; i < n && i < L.boss.length; i++) {
      const b = FRAME.bosses[i], r = L.boss[i];
      bossBanner(g, r, Object.assign({}, b, { trail: trailFor(b.key || b.name, b.hp / Math.max(1, b.max)) * b.max / Math.max(1, b.max), compact: !!r.compact }));
    }
  }

  // ---- the belt ----
  function drawBelt(g, L) {
    const B = L.belt, P = L.beltP, strapH = Math.round(P * 0.34), strapY = Math.round(B.y + B.h / 2 - strapH / 2), desk = L.fam === 'desk';
    const x0 = B.x + 14, x1 = desk ? B.x + B.w - 4 : L.bag.x + L.bag.w * 0.6;
    const gaps = L.pouches.slice(0, 4).map(r0 => r0.x + P + 4 - B.x);
    cache(g, `belt|${B.w}|${B.h}|${P}|${Math.round(x1 - x0)}|${gaps.join(',')}`, B.x, B.y, B.w, B.h, (cg, X, Y) => {
      const sy = Y + (strapY - B.y);
      beltStrap(cg, X + 14, sy, x1 - x0, strapH);
      for (const gx of gaps) { rivet(cg, X + gx, sy + strapH * 0.3, 1.8, true); rivet(cg, X + gx, sy + strapH * 0.72, 1.8, true); }
      buckle(cg, X + 6, sy - 7, Math.round(P * 0.44), strapH + 14, sy, strapH);
    }, 18);
    if (DRAWN.on) DRAWN.log.push({ id: 'belt:strap', k: 'r', x: B.x, y: B.y, w: B.w, h: B.h, deco: 'belt', strap: true });
    const open = typeof panel !== 'undefined' ? panel : null;
    for (let i = 0; i < 5; i++) {
      const r0 = L.pouches[i], item = player.inv[i] ? { id: player.inv[i].id, qty: player.inv[i].qty } : null;
      const ph = Math.round(P * 1.06), r = { x: r0.x, y: B.y + (B.h - ph) / 2, w: P, h: ph };
      const st = stateOf('hot' + i);
      pouch(g, r, item, touchOn() ? '' : String(i + 1), st);
      push({ x: r0.x, y: r0.y, w: r0.w, h: r0.h, label: 'hot' + i, action: () => useItem(i), name: item && ITEMS[item.id] ? ITEMS[item.id].name : 'Empty pouch', keys: [String(i + 1)] });
    }
    const st = stateOf('BAG'), bg = L.bag;
    satchel(g, { x: bg.x, y: bg.y - 2, w: bg.w, h: bg.h + 4 }, { pressed: st.pressed, hover: st.hover, ripple: st.ripple, on: open === 'inventory' });
    push({ x: bg.x, y: bg.y, w: bg.w, h: bg.h, label: 'BAG', action: () => { panel === 'inventory' ? closePanel() : openPanel('inventory'); }, up: true, nameHold: true, name: 'Your pack', keys: ['I'] });
  }

  // ---- the stick ----
  function drawStick(g, L) {
    if (!L.stick) return;
    if (typeof touch !== 'undefined' && touch.active) stickRing(g, touch.ox, touch.oy, L.stick.r, { x: touch.ox + touch.dx * 60 * Math.min(1, L.stick.r / 60), y: touch.oy + touch.dy * 60 * Math.min(1, L.stick.r / 60) }, true);
    else stickRing(g, L.stick.x, L.stick.y, L.stick.r, null, false);
  }

  // ---- the four seats (touch fan, or the desk's medallions) ----
  function drawSeats(g, L) {
    const desk = L.fam === 'desk', t = now();
    FRAME.faces = {};
    // the coach: "[Space] Swing" over the monster the first times one is in reach
    if (!player.mech && !player.dead && !paused && !panel) { const m = monsterInReach(); if (m) teach('swing', 'Space', 'Swing', { x: m.x, y: m.y, lift: (m.r || 14) + 30 }, { emblem: 'swing' }); }
    for (const seat of SEATS) {
      const c = L.seats[seat]; if (!c) continue;
      const f = faceOf(seat); FRAME.faces[seat] = f;
      const sw = SWAP[seat] || (SWAP[seat] = { id: null, prev: null, t: 0 });
      const fid = f ? f.id + '|' + f.emblem : null;
      if (fid !== sw.id) { sw.prev = sw.cur || null; sw.id = fid; sw.cur = f; sw.t = t; }
      const fadeIn = cl((t - sw.t) / 120, 0, 1);
      const draw = (face, alpha) => {
        if (!face) return;
        const st = stateOf(face.label);
        const ribbonTxt = desk ? null : (face.ribbon && (!face.learn || showWord(face.learn)) ? face.ribbon : null);
        g.save(); g.globalAlpha *= alpha;
        stud(g, c.x, c.y, c.r, face.emblem, { pressed: st.pressed || (face.hold && held(face.label)), hover: st.hover, ripple: st.ripple, lit: face.lit, on: face.on, disabled: face.disabled, asleep: face.asleep, cool: face.cool, charge: face.charge, badge: face.badge, ribbon: ribbonTxt, id: seat, faceHi: face.faceHi, emCol: face.emCol });
        if (desk && face.key) { const kw = keycapW(g, face.key, 9); keycap(g, c.x - kw / 2, c.y + c.r - 6, face.key, 9); }
        g.restore();
      };
      if (sw.prev && fadeIn < 1) { DRAWN.mute = true; try { draw(sw.prev, 1 - fadeIn); } finally { DRAWN.mute = false; } }
      draw(f, sw.prev ? fadeIn : 1);
      if (f) {
        const b = circleBtn(f.label, c, f.hold ? () => { } : () => { learn(f.learn); if (f.action) f.action(); }, { seat, name: f.name || (f.ribbon ? f.ribbon.charAt(0) + f.ribbon.slice(1).toLowerCase() : f.id), keys: f.key ? [f.key] : [], hold: f.hold, disabledFace: f.disabled });
        if (f.hold) b.up = false;
      }
    }
  }

  // ---- the talk page ----
  function dialogGeom(g, L) {
    if (!dialog.cur) return null;
    const who = dialog.cur.who || 'The Voice', col = who === 'The Voice' ? '#b58cff' : who === 'Death' ? '#8fa2b8' : '#c9a36a';
    let r = L.dialog ? { ...L.dialog } : null; if (!r) return null;
    const desk = L.fam === 'desk';
    let size = desk ? 16 : 15, f = FS(600, size), lh = Math.round(realPx(f) * 1.38);
    const room = r.w - 36;
    let lines = wrap(g, dialog.cur.text, room, 99, f).lines;
    const fits = n => 20 + n * lh + 22 <= r.h;
    while (!fits(lines.length) && size > 12.5) { size -= 0.5; f = FS(600, size); lh = Math.round(realPx(f) * 1.32); lines = wrap(g, dialog.cur.text, room, 99, f).lines; }
    if (!fits(lines.length)) {
      // grow toward the world, never over the knight: down on phones held upright and sideways (it starts at the top), up elsewhere
      const need = 20 + lines.length * lh + 22, knightTop = VH / 2 - 34 - 6, beltTop = L.belt.y - 10;
      if (L.fam === 'phoneP' || L.fam === 'phoneL') r.h = Math.min(need, knightTop - r.y);
      else { const nh = Math.min(need, r.y + r.h - (VH / 2 + 40)); r.y = r.y + r.h - nh; r.h = nh; if (r.y + r.h > beltTop) r.y = beltTop - r.h; }
    }
    const shown = dialog.cur.text.slice(0, dialog.shown);
    const vis = wrap(g, dialog.cur.text, room, 99, f).lines, out = []; let left = shown.length;
    for (const l of vis) { if (left <= 0) break; out.push(l.slice(0, left)); left -= l.length + 1; }
    const maxLines = Math.max(1, Math.floor((r.h - 42) / lh));
    return { r, who, col, font: f, lh, lines: out.slice(0, maxLines) };
  }
  function drawTalk(g, geo) {
    if (!geo) return;
    talkPage(g, geo.r, { who: geo.who, col: geo.col, font: geo.font, lh: geo.lh, lines: geo.lines, touch: touchOn() });
  }

  // ---- the notice ribbon, in its fixed lane (slides 8 px and fades in over 150 ms; fades out over 300 ms) ----
  const NOTE = { text: null, born: 0 };
  function drawNotice(g, L) {
    if (typeof notice === 'undefined' || !notice) { NOTE.text = null; return; }
    if (notice.text !== NOTE.text) { NOTE.text = notice.text; NOTE.born = now(); }
    const age = (now() - NOTE.born) / 150, a = Math.min(cl(age, 0, 1), cl(notice.t / 0.3, 0, 1));
    const lane = (L.fam === 'phoneP' || L.fam === 'phoneL') && FRAME.bannerOnNotice ? null : L.notice;
    if (!lane) return;
    noticeRibbon(g, lane, notice.text, a, (1 - cl(age, 0, 1)) * 8);
  }
  // ---- banners: an area name and the level / event headline, in their lanes (phones: one at a time, in the scroll slot) ----
  function drawBanners(g, L) {
    const phone = L.fam === 'phoneP' || L.fam === 'phoneL';
    const list = [];
    if (typeof levelBanner !== 'undefined' && levelBanner) list.push({ kind: 'level', title: levelBanner.text, sub: levelBanner.sub, t: levelBanner.t });
    if (typeof areaBanner !== 'undefined' && areaBanner) list.push({ kind: 'area', title: String(areaBanner.name).toUpperCase(), sub: areaBanner.sub, t: areaBanner.t });
    // the banners waiting in bannerQueue (04-state) are not drawn here: they come up one at a time after the live one
    FRAME.bannerOnNotice = false;
    if (!list.length) return;
    const alphaOf = b => b.kind === 'area' ? cl(Math.min(b.t, 0.8) * 1.5, 0, 1) : cl(Math.min(b.t, 1) * 1.2, 0, 1);
    if (phone) {
      const b = list[0], lane = L.banners[0]; if (!lane) return;
      if (lane.at === 'notice') FRAME.bannerOnNotice = true;
      g.save();
      // a banner borrowing the scroll slot sits on a sable plate, so the words never land on the quest text
      const a = alphaOf(b); g.globalAlpha *= a;
      shadowed(g, () => { rr(g, lane.x, lane.y, lane.w, lane.h, 5); g.fillStyle = 'rgba(20,15,13,0.94)'; g.fill(); }, 8, 3);
      rr(g, lane.x + 3, lane.y + 3, lane.w - 6, lane.h - 6, 3); g.strokeStyle = 'rgba(217,178,92,0.55)'; g.lineWidth = 1; g.stroke();
      g.restore();
      const tall = lane.h >= 60;
      banner(g, { x: lane.x + 6, y: lane.y + (tall ? Math.max(4, (lane.h - (b.sub ? 54 : 30)) / 2) : 2), w: lane.w - 12, h: lane.h - 4 }, { kind: b.kind, title: b.title, sub: tall ? b.sub : null, alpha: a, small: !tall });
      return;
    }
    list.slice(0, 2).forEach((b, i) => { const lane = L.banners[i]; if (lane) banner(g, lane, { kind: b.kind, title: b.title, sub: b.sub, alpha: alphaOf(b), small: i > 0 }); });
  }

  // ---- overlays drawn last: the long-press name tag, desktop tooltips, coach lines ----
  function drawOverlays(g, L) {
    holdTick();
    const p = INPUT.press;
    if (p && p.named && p.inside) {
      const b = p.b, cx = b.r ? (b.cx != null ? b.cx : b.x + b.w / 2) : b.x + b.w / 2, top = b.r ? (b.cy != null ? b.cy : b.y + b.h / 2) - b.r : b.y;
      tag(g, cx, top - 4, b.name || b.label, { key: touchOn() ? null : (b.keys && b.keys[0]) });
    }
    if (!touchOn() && INPUT.hover && !p && now() - INPUT.hover.t0 >= 350) {
      const b = buttons.find(q => q.label === INPUT.hover.label);
      if (b && b.name) {
        const anchor = b.r ? { k: 'c', x: b.cx != null ? b.cx : b.x + b.w / 2, y: b.cy != null ? b.cy : b.y + b.h / 2, r: b.r } : b;
        tooltip(g, anchor, b.name, b.keys || [], b.sub || null, hudRects());
      }
    }
    const busy = [];
    if (typeof notice !== 'undefined' && notice) busy.push(L.notice);
    if ((typeof levelBanner !== 'undefined' && levelBanner) || (typeof areaBanner !== 'undefined' && areaBanner)) for (const b of L.banners) busy.push(b);
    const clash = r => busy.concat(hudRects()).some(q => q && r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h);
    for (const c of FRAME.coach || []) {
      let sx, sy, side = c.side;
      if (c.at && c.at.sx != null) { sx = c.at.sx; sy = c.at.sy; }
      else if (c.at && typeof cam !== 'undefined') {
        // above the thing, else below it, else beside it: the first place clear of the lanes in use and of the HUD
        const px = Math.round(c.at.x - cam.x), py = Math.round(c.at.y - cam.y), lift = c.at.lift || 30, w0 = 150;
        const cand = [['up', px, py - lift, { x: px - w0 / 2, y: py - lift - 38, w: w0, h: 38 }], ['up', px, py + lift + 38, { x: px - w0 / 2, y: py + lift, w: w0, h: 38 }], ['right', px + lift * 0.6, py, { x: px + lift * 0.6 + 8, y: py - 15, w: w0, h: 30 }]];
        const pick = cand.find(q => !clash(q[3])) || cand[0];
        sx = pick[1]; sy = pick[2]; side = pick[0] === 'right' ? 'right' : null;
      } else continue;
      tag(g, sx, sy, c.verb, { key: touchOn() ? null : c.key, emblem: touchOn() ? c.emblem : null, edge: 'rgba(247,220,143,0.75)', side });
    }
    FRAME.coach = [];
    if (FRAME.overflow > 0 && FRAME.plaqueRects.length) { const r = FRAME.plaqueRects[FRAME.plaqueRects.length - 1]; badge(g, r.x + r.w - 8, r.y + 8, '+' + FRAME.overflow, 11); }
  }
  // every HUD rect this frame (tooltips place themselves clear of them)
  function hudRects() {
    const out = [];
    for (const b of (typeof buttons !== 'undefined' ? buttons : [])) if (!b.offscreen && b.w > 0) out.push({ x: b.x, y: b.y, w: b.w, h: b.h });
    const L = FRAME.L; if (L) { out.push(L.crest, L.scroll, L.belt, L.notice); for (const p of L.plaques) out.push(p); }
    return out;
  }

  // =================================================================================================
  // THE KNIGHT'S BOOK (the pause menu): left page = the game rows, right page = the kit's twelve tiles.
  // Phones held upright get one page with Kit / Game bookmarks (it opens on Kit); a computer adds a Keys bookmark.
  // =================================================================================================
  const BOOK = { page: 'kit' };
  const KIT_TILES = [
    { id: 'bag', emblem: 'bag', word: 'BAG', key: 'I', action: () => openPanel('inventory') },
    { id: 'skills', emblem: 'skills', word: 'SKILLS', key: 'TAB', action: () => openPanel('skills') },
    { id: 'quests', emblem: 'quests', word: 'QUESTS', key: 'J', action: () => openPanel('quests') },
    { id: 'crafting', emblem: 'craft', word: 'CRAFTING', key: 'C', action: () => openPanel('craft') },
    { id: 'map', emblem: 'map', word: 'MAP', key: 'M', action: () => openPanel('map') },
    { id: 'wiki', emblem: 'wiki', word: 'WIKI', key: 'K', action: () => openPanel('wiki') },
    { id: 'friends', emblem: 'friends', word: 'FRIENDS', key: 'F', action: () => { if (HOOKS.panel && HOOKS.panel.friends) openPanel('friends'); else notify('Friends are for the online game.'); }, asleep: () => !(window.NET && NET.enabled) },
    { id: 'chat', emblem: 'chat', word: 'CHAT', key: 'Y', action: () => notify('Chat is for the online game.'), asleep: () => !(window.NET && NET.enabled) },
    { id: 'home', emblem: 'home', word: 'HOME', key: 'H', action: () => goHome(), asleep: () => !player.home || !!player.mech },
    { id: 'help', emblem: 'help', word: 'HELP', key: '?', action: () => openPanel('help') },
    { id: 'music', emblem: 'music', word: 'MUSIC', key: 'N', action: () => { } },
    { id: 'markers', emblem: 'pin', word: 'MARKERS', key: 'P', action: () => { if (window.MARKERS && MARKERS.toggle) MARKERS.toggle(); }, on: () => !!(window.MARKERS && MARKERS.show && MARKERS.show()) },
  ];
  function bookTiles() {
    const reg = hudControl.list || [];
    const out = KIT_TILES.map(t => {
      const r = reg.find(d => d.id === t.id) || {};
      const seal0 = t.id === 'friends' && hudSeal.map && hudSeal.map.friends ? val(hudSeal.map.friends) : null;
      const onF = r.on || t.on, asleepF = r.asleep || t.asleep, badgeF = r.badge || t.badge || (seal0 && seal0.show !== false ? seal0.badge : null);
      let word = t.word; if (t.id === 'music') { const on = !!val(onF); word = on ? 'MUSIC ON' : 'MUSIC OFF'; }
      const home = t.id === 'home' && player.home ? HOME_COOLDOWN - (time - (player.homeCd || -1e9)) : 0;
      return { id: t.id, emblem: r.emblem || t.emblem, word, key: r.key || t.key, action: r.action || t.action, on: !!val(onF), asleep: !!val(asleepF), badge: val(badgeF), off: t.id === 'music' && !val(onF), cool: home > 0 ? { frac: home / HOME_COOLDOWN, text: mmss(home) } : null };
    });
    for (const r of reg) if (!KIT_TILES.some(t => t.id === r.id)) {
      let lab = r.label; try { if (typeof lab === 'function') lab = lab(); } catch (e) { lab = r.id; }
      let ok = true; try { if (r.show && r.bookShow) ok = !!r.bookShow(); } catch (e) { ok = true; }
      if (ok) out.push({ id: r.id, emblem: r.emblem || 'star', word: String(lab || r.id).toUpperCase(), key: r.key || '', action: r.action, on: !!val(r.on), asleep: !!val(r.asleep), badge: val(r.badge) });
    }
    return out;
  }
  // the rows' emblems and keys, looked up by label so button() calls from other files (Title screen, Log out) wear them too
  const ROW_LOOK = [[/^Resume/, 'play', 'ESC'], [/^Settings/, 'gear', ','], [/^Title screen/, 'castle', 'T'], [/^Log out/, 'leave', ''], [/^(New game|Really erase)/, 'erase', '']];
  const bookState = { drawing: false };
  function drawBook(g) {
    const t = touchOn(), tiles = bookTiles();
    const BL = bookLayoutFor(VW, VH, { touch: t, online: !!(window.NET && NET.enabled), page: BOOK.page, tiles: tiles.length, extraRows: Math.max(1, HOOKS.pauseMenu.length) });
    FRAME.lastBook = BL;
    if ((BL.onePage && BOOK.page === 'keys') || (!BL.onePage && BOOK.page === 'game') || (BOOK.page === 'keys' && BL.fam !== 'desk')) BOOK.page = 'kit';
    g.fillStyle = 'rgba(6,5,4,0.68)'; g.fillRect(0, 0, VW, VH);
    const B = BL.book;
    bookCover(g, B.x, B.y, B.w, B.h);
    for (const p of BL.pages) bookPage(g, p.x, p.y, p.w, p.h);
    if (!BL.onePage) { const lp = BL.pages[0], rp = BL.pages[1], gx = lp.x + lp.w - 18, gw = rp.x - gx + 18; const gg = g.createLinearGradient(gx, 0, gx + gw + 18, 0); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(0.5, 'rgba(0,0,0,0.55)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.fillRect(gx, B.y + 10, gw + 18, B.h - 20); }
    const chapter = quest.stage >= 7 ? 'Chapter 3: Goblin Tech' : quest.stage >= 5 ? 'Chapter 2: Thistledown' : 'Chapter 1: The Cave';
    // the title, and the chapter under it where the page has the room (a phone held sideways has room for the title only)
    const titleBlock = (cx, y, big, short) => {
      text(g, 'FANGLANDS', cx, y, { font: FC(800, big ? 30 : short ? 20 : 24), align: 'center', color: T.goldHi, shadow: 'rgba(0,0,0,0.95)' });
      if (short) return;
      text(g, chapter, cx, y + 22, { font: FS(600, 13), align: 'center', color: T.inkDim });
      flourish(g, cx, y + 36, 180);
    };
    const statsBlock = (cx, y) => {
      const town = quest.rebuild && quest.rebuild.title;
      const s = `Kills ${player.kills}     Deaths ${player.deaths}     Best hit ${player.highestHit}`;
      if (town) { const w1 = tw(g, town, FC(800, 13)), gap = 12, w2 = tw(g, s, FS(600, 12)), x0 = cx - (w1 + gap + w2) / 2; text(g, town, x0, y, { font: FC(800, 13), color: T.gold }); text(g, s, x0 + w1 + gap, y, { font: FS(600, 12), color: T.inkDim }); }
      else text(g, s, cx, y, { font: FS(600, 12), align: 'center', color: T.inkDim });
      text(g, 'Your game saves by itself.', cx, y + 20, { font: FS(600, 12), align: 'center', color: T.inkMute });
    };
    bookState.drawing = true;
    try {
      const drawRows = () => {
        const R0 = BL.rows; let i = 0;
        const row = (label, action, tone) => { const r = R0[i++]; if (r) button(g, r.x, r.y, r.w, r.h, label, action, tone); };
        row('Resume', () => { paused = false; }, '#238636');
        row('Settings', () => { paused = false; openPanel('settings'); }, '#21262d');
        for (const f of HOOKS.pauseMenu) { const r = R0[i]; if (!r || i >= R0.length - 1) break; i++; try { f(g, r.x, r.y, r.w, r.h); } catch (e) { } }
        const erase = typeof confirmActive === 'function' && confirmActive('newgame');
        const r = R0[R0.length - 1]; if (r) button(g, r.x, r.y, r.w, r.h, erase ? 'Really erase? Tap again' : 'New game (erases save)', () => confirmTap('newgame', newGame), erase ? '#c0392b' : '#8b2e2e');
      };
      const drawKit = () => {
        const n = BL.tiles.length;
        for (let i = 0; i < n && i < tiles.length; i++) {
          const tl = tiles[i], c = BL.tiles[i], st = stateOf(tl.word);
          bookTile(g, c.x, c.y, BL.tileD, tl.emblem, tl.word, t ? '' : tl.key, { pressed: st.pressed, hover: st.hover, ripple: st.ripple, on: tl.on, asleep: tl.asleep, badge: tl.badge, off: tl.off, cool: tl.cool, maxW: BL.tileW });
          circleBtn(tl.word, { x: c.x, y: c.y, r: BL.tileD / 2 }, () => { paused = false; if (tl.action) tl.action(); }, { up: true, name: tl.word.charAt(0) + tl.word.slice(1).toLowerCase(), keys: tl.key ? [tl.key] : [] });
        }
      };
      const drawKeys = () => {
        const kb = BL.keysBox; if (!kb) return;
        let rows = []; try { rows = window.SETTINGS && SETTINGS.keyMap ? SETTINGS.keyMap() : []; } catch (e) { rows = []; }
        // a key two features both use (P: the map's markers, and Build on your island) lists every job it does
        rows = rows.map(r => { const jobs = []; for (const k0 of HOOKS.keyHelp || []) if (r.codes && k0.codes.some(c => r.codes.includes(c)) && !jobs.includes(k0.action)) jobs.push(k0.action); return jobs.length > 1 ? Object.assign({}, r, { action: jobs.join('; ') }) : r; });
        text(g, 'THE KEYS', kb.x, kb.y + 4, { font: FC(800, 13), color: T.gold });
        const lh = 20, top0 = kb.y + 26, per = Math.max(1, Math.floor((kb.h - 30) / lh)), cols = rows.length > per ? 2 : 1, cw = kb.w / cols;
        rows.forEach((r, i) => {
          const col = Math.floor(i / per); if (col >= cols) return;
          const x0 = kb.x + col * cw, y = top0 + (i % per) * lh, capW = cols > 1 ? 58 : Math.min(150, kb.w * 0.42);
          let kx = x0; const caps = (r.label || '').split(/ or /);
          for (const c of caps.slice(0, 3)) { if (!c) continue; const w = keycap(g, kx, y - 14, c.length > 6 ? c.slice(0, 6) : c, 9); kx += w + 4; if (kx > x0 + capW - 10) break; }
          let f = FS(600, 12); const room = cw - capW - 8; let lbl = r.action;
          if (tw(g, lbl, f) > room) { f = FS(600, 10.5); if (tw(g, lbl, f) > room) lbl = wrap(g, lbl, room, 1, f).lines[0] || lbl; }
          text(g, lbl, x0 + capW, y, { font: f, color: T.ink });
        });
      };
      if (BL.onePage) {
        const pg = BL.pages[0];
        for (const m of BL.marks) {
          const on = (m.id === 'mark:kit' && BOOK.page === 'kit') || (m.id === 'mark:game' && BOOK.page === 'game'), st = stateOf(m.id);
          plateButton(g, m, m.id === 'mark:kit' ? 'bag' : 'castle', m.id === 'mark:kit' ? 'Kit' : 'Game', on ? 'primary' : null, { pressed: st.pressed, hover: st.hover, cinzel: true, size: 13 });
          push({ x: m.x, y: m.y, w: m.w, h: m.h, label: m.id, action: () => { BOOK.page = m.id === 'mark:kit' ? 'kit' : 'game'; }, up: true });
        }
        if (BOOK.page === 'kit') { text(g, 'YOUR KIT', pg.x + 14, BL.pageTop + 10, { font: FC(800, 12), color: T.gold }); drawKit(); }
        else { titleBlock(pg.x + pg.w / 2, BL.pageTop + 26, false); drawRows(); statsBlock(pg.x + pg.w / 2, BL.statsY + 14); }
      } else {
        const lp = BL.pages[0], rp = BL.pages[1];
        titleBlock(lp.x + lp.w / 2, B.y + (BL.fam === 'phoneL' ? 36 : 46), BL.fam !== 'phoneL', BL.fam === 'phoneL');
        drawRows();
        if (BL.fam !== 'phoneL') statsBlock(lp.x + lp.w / 2, BL.statsY);
        text(g, BOOK.page === 'keys' ? '' : 'YOUR KIT', rp.x + 18, B.y + (BL.fam === 'phoneL' ? 34 : 44), { font: FC(800, 13), color: T.gold });
        for (const m of BL.marks) {
          const on = (m.id === 'mark:kit' && BOOK.page !== 'keys') || (m.id === 'mark:keys' && BOOK.page === 'keys'), st = stateOf(m.id);
          plateButton(g, m, m.id === 'mark:kit' ? 'bag' : 'key', m.id === 'mark:kit' ? 'Kit' : 'Keys', on ? 'primary' : null, { pressed: st.pressed, hover: st.hover, cinzel: true, size: 13 });
          push({ x: m.x, y: m.y, w: m.w, h: m.h, label: m.id, action: () => { BOOK.page = m.id === 'mark:keys' ? 'keys' : 'kit'; }, up: true });
        }
        if (BOOK.page === 'keys') drawKeys(); else drawKit();
      }
      // the close seal (Esc)
      const c = BL.close, st = stateOf('book:close');
      seal(g, c.x, c.y, c.r, 'close', 'umber', { pressed: st.pressed, hover: st.hover, ripple: st.ripple, seed: 61, scale: 0.62 });
      if (!t) keycap(g, c.x - keycapW(g, 'ESC', 9) / 2, c.y + c.r + 3, 'ESC', 9);
      circleBtn('book:close', c, () => { paused = false; }, { up: true, name: 'Close the book', keys: ['Esc'] });
    } finally { bookState.drawing = false; }
    return BL;
  }

  // =================================================================================================
  // THE CORE SEAT FACES (the per-state face table; features add theirs with hudSeatFace)
  // =================================================================================================
  const mechKind = () => player.mech ? (player.mech.kind || 'walker') : null;
  function monsterInReach() {
    const w = typeof weaponDef === 'function' ? weaponDef() : null, ranged = !!(w && w.weapon && w.weapon.ranged && !player.mech);
    const reach = player.mech ? 70 : w ? 58 : 36;
    for (const m of monsters) {
      if (m.dead) continue; const def = MONSTER_DEFS[m.type]; if (def && def.harmless) continue;
      const d = dist(player.x, player.y, m.x, m.y);
      if (!ranged && d <= reach + m.r + 6) return m;
      if (ranged && d <= 280) return m;
    }
    return null;
  }
  // what USE would do right now: the verb, its emblem, and what it is aimed at
  function usePreview() {
    if (typeof player === 'undefined' || player.dead) return null;
    const npc = typeof npcInFront === 'function' ? npcInFront() : null;
    const ft = frontTile(player), tt = tileAt(ft.tx, ft.ty);
    const blockedNpc = npc && npc.wander && ((typeof SOLID !== 'undefined' && SOLID.has(tt)) || (typeof PUSH_THROUGH !== 'undefined' && PUSH_THROUGH.has(tt)));
    if (npc && !blockedNpc) return { verb: 'TALK', emblem: 'talk', what: npc.name, at: { x: npc.px, y: npc.py, npc: true } };
    const at = { x: ft.tx * TILE, y: ft.ty * TILE, w: TILE, h: TILE };
    if (tt === T.WATER) return { verb: 'FISH', emblem: 'hook', what: 'water', at };
    if (tt === T.FIRE || tt === T.OVEN) return { verb: 'COOK', emblem: 'pot', what: tt === T.OVEN ? 'the oven' : 'the fire', at };
    if (typeof GATHER !== 'undefined' && GATHER[tt]) return GATHER[tt].skill === 'woodcutting' ? { verb: 'CHOP', emblem: 'axe', what: 'the ' + GATHER[tt].label, at } : { verb: 'MINE', emblem: 'pick', what: 'the ' + GATHER[tt].label, at };
    if (tt === T.CHEST) return { verb: 'OPEN', emblem: 'door', what: 'the chest', at };
    if (tt === T.MECH || (T.DUNGEON_DOOR != null && tt === T.DUNGEON_DOOR) || (T.BEAST != null && tt === T.BEAST)) return { verb: 'ENTER', emblem: 'door', what: tt === T.MECH ? 'the walker' : 'the door', at };
    if (typeof INTERESTING_TILES !== 'undefined' && INTERESTING_TILES.has(tt) && tt !== T.STUMP && tt !== T.RUBBLE) return { verb: 'USE', emblem: 'hand', what: '', at };
    return null;
  }
  const inMachine = () => !!player.mech && player.mech.kind !== 'horse';
  const plankAhead = () => { const ft = frontTile(player); return tileAt(ft.tx, ft.ty) === T.PLANK; };
  // SWING
  hudSeatFace('swing', { id: 'swing', prio: 0, when: () => !player.mech, emblem: 'swing', ribbon: 'SWING', key: 'Space', name: 'Swing', learn: 'swing', lit: () => !!monsterInReach(), action: () => touch.taps.push('attack') });
  hudSeatFace('swing', { id: 'stomp', prio: 10, when: () => inMachine() && mechKind() !== 'beast', emblem: 'stomp', ribbon: 'STOMP', key: 'Space', name: 'Stomp', lit: () => !!monsterInReach(), action: () => touch.taps.push('attack') });
  hudSeatFace('swing', { id: 'ram', prio: 10, when: () => mechKind() === 'beast', emblem: 'ram', ribbon: 'RAM', key: 'Space', name: 'Ram', lit: () => !!monsterInReach(), action: () => touch.taps.push('attack') });
  hudSeatFace('swing', { id: 'saddle', prio: 10, when: () => mechKind() === 'horse', emblem: 'swing', ribbon: 'SWING', key: 'Space', name: 'No swinging from the saddle', disabled: true, action: () => notify('No swinging from the saddle. Get down first.') });
  // USE
  hudSeatFace('use', { id: 'next', prio: 100, when: () => !!(dialog && dialog.cur), emblem: 'next', ribbon: 'NEXT', key: 'Enter', name: 'Next line', lit: true, emCol: T.goldHi, action: () => advanceDialog() });
  hudSeatFace('use', { id: 'crush', prio: 50, when: () => inMachine() && plankAhead(), emblem: 'crush', ribbon: 'CRUSH', key: 'E', name: 'Crush the planks', lit: true, action: () => touch.taps.push('use') });
  hudSeatFace('use', { id: 'crush-idle', prio: 10, when: () => inMachine(), emblem: 'crush', ribbon: 'CRUSH', key: 'E', name: 'Crush planks in front of you', asleep: true, action: () => touch.taps.push('use') });
  hudSeatFace('use', { id: 'use', prio: 0, when: () => true, emblem: () => { const p = usePreview(); return p ? p.emblem : 'hand'; }, ribbon: () => { const p = usePreview(); return p ? p.verb : 'USE'; }, key: 'E', name: () => { const p = usePreview(); return p ? (p.verb.charAt(0) + p.verb.slice(1).toLowerCase() + (p.what ? ' ' + (p.verb === 'TALK' ? 'to ' : '') + p.what : '')) : 'Use'; }, asleep: () => !usePreview(), action: () => touch.taps.push('use') });
  // ctx: EXIT in any machine (the mare's GET DOWN comes from 51-mounts)
  hudSeatFace('ctx', { id: 'exit', prio: 50, when: () => inMachine(), emblem: 'exit', ribbon: 'EXIT', key: 'X', name: 'Climb out', action: () => exitMech() });

  // =================================================================================================
  // COMPATIBILITY: the wave-14 kit's API, kept so every file not yet moved onto the Heraldry kit still draws and still
  // lands in a reserved place. HK.plate / chip draw an iron plaque; HK.control draws a plate button; HK.disc a stud;
  // HK.slot / HK.claim hand out plaque slots; HK.status draws the crest. New code should use the Heraldry API above.
  // =================================================================================================
  const C = {
    INK: T.ink, DIM: T.inkDim, RULE: 'rgba(217,178,92,0.25)', GOOD: T.good, WARN: T.warn, BAD: T.bad, GOLD: T.gold,
    SCRIM_TOP: '#2d3138', SCRIM_BOT: '#16181c', EDGE: 'rgba(0,0,0,0.9)', RAISE: 0.1, RAISE_ON: 0.05,
    CTRL_EDGE: 'rgba(217,178,92,0.6)', CTRL_ON_EDGE: 'rgba(247,220,143,0.9)', CTRL_OFF_EDGE: 'rgba(140,129,112,0.4)', TRACK: 'rgba(0,0,0,0.6)',
  };
  const F = { label: () => FC(800, 11), value: () => FC(800, 13), body: () => FS(600, 12), ctrl: () => FS(700, 12), name: () => FC(800, 14) };
  const row = () => touchOn() ? 44 : 32;
  const LINE = () => Math.round(15 * k()), BAR = () => Math.round(11 * k()), BAR_S = () => Math.round(8 * k());
  const meterH = small => LINE() + 3 + (small ? BAR_S() : BAR());
  const chipH = () => 44;
  const colW = () => (cur().plaques[0] ? cur().plaques[0].w : 200);
  const colX = () => (cur().plaques[0] ? cur().plaques[0].x : cur().left);
  function compatPlate(g, x, y, w, h, opt = {}) {
    w = Math.round(w); h = Math.round(h);
    cache(g, `cplate|${w}|${h}`, x, y, w, h, (cg, X, Y) => plateBody(cg, X, Y, w, h, { rivets: h >= 30 && w >= 90 }), 12);
    if (opt.tone) { rr(g, x + 0.5, y + 0.5, w - 1, h - 1, 6); g.strokeStyle = opt.tone; g.lineWidth = 1.5; g.stroke(); }
    return { x, y, w, h };
  }
  function toneOf(col) {
    const c = hex(col); if (!c) return null;
    const [r, gg, b] = c, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    if (mx - mn < 40) return null;
    if (gg > 110 && gg > r * 1.15 && gg > b * 1.15) return 'primary';
    if (r > 110 && r > gg * 1.6 && r > b * 1.4) return 'danger';
    if (gg > 110 && r >= gg && r > b * 1.5 && gg > b * 1.3) return 'warn';
    return null;
  }
  function control(g, x, y, w, h, label, action, opt = {}) {
    const enabled = opt.enabled !== false, st = stateOf(opt.hit || label);
    const tone = opt.tone === C.GOOD || opt.tone === 'primary' ? 'primary' : opt.tone === C.BAD || opt.tone === 'danger' ? 'danger' : opt.tone === C.WARN || opt.tone === 'warn' ? 'warn' : null;
    plateButton(g, { x, y, w, h }, opt.emblem || null, label, tone, { pressed: st.pressed && enabled, hover: st.hover && enabled, disabled: !enabled, on: !!opt.on });
    push(enabled ? { x, y, w, h, label: opt.hit || label, action, up: true } : { x, y, w, h, label: 'disabled:' + (opt.hit || label), action: () => { }, disabled: true, inert: true });
  }
  function disc(g, cx, cy, r, label, opt = {}) {
    const st = stateOf(label);
    stud(g, cx, cy, r, opt.emblem || null, { pressed: st.pressed, disabled: opt.enabled === false, on: !!opt.tone && opt.tone === C.GOOD, ribbon: opt.quiet ? null : label, asleep: !!opt.quiet });
  }
  const OLD_SEAT = ['swing', 'use', 'ctx', null, 'use', 'block'];
  function thumbSeat(i) { const L = cur(), s = L.seats[OLD_SEAT[cl(i, 0, 5)] || 'ctx'] || { x: -4000, y: -4000, r: 22 }; return { x: s.x, y: s.y, r: s.r }; }
  function oldMeter(g, x, y, w, o) {
    const line = LINE(), bh = o.small ? BAR_S() : BAR(), base = y + line - 3;
    let lw = w;
    if (o.value) { const vw = tw(g, o.template || o.value, FC(800, 12)); text(g, o.value, x + w, base, { font: FC(800, 12), align: 'right', color: o.valueColour || T.ink, shadow: 'rgba(0,0,0,0.9)' }); lw = w - vw - 8; }
    let lab = String(o.label || ''); let ls = 11; while (ls > 8.5 && tw(g, lab, FC(800, ls)) > lw) ls -= 0.5;
    text(g, lab, x, base, { font: FC(800, ls), color: T.inkDim, shadow: 'rgba(0,0,0,0.9)' });
    const f = o.frac === undefined ? 1 : o.frac, col = o.tone === C.GOOD ? T.good : o.tone === C.WARN ? T.warn : o.tone === C.BAD ? T.bad : o.tone || ramp(f);
    const stp = RAMP_BAR[col] || ['#ff8266', col, '#6d1016'];
    meterBar(g, x, y + line + 3, w, bh, f, stp[1], { hi: stp[0], lo: stp[2] });
    return line + 3 + bh;
  }
  function readout(g, x, y, w, cells) {
    const line = LINE(), base = y + line - 3, list = cells.filter(Boolean), n = list.length; if (!n) return 0;
    const cw = Math.floor((w - 8 * (n - 1)) / n); let cx = x;
    for (const c of list) {
      let tx = cx;
      if (c.icon) { try { drawItemIcon(g, c.icon, cx + 7, base - 4, 14); } catch (e) { } tx = cx + 18; }
      if (c.label) tx += text(g, c.label, tx, base, { font: FC(800, 10.5), color: T.inkDim, shadow: 'rgba(0,0,0,0.9)' }) + 6;
      text(g, c.value, tx, base, { font: FC(800, 12), color: T.ink, shadow: 'rgba(0,0,0,0.9)' });
      cx += cw + 8;
    }
    return line;
  }
  function bar(g, x, y, w, h, frac, tone) { const col = tone === C.GOOD ? T.good : tone === C.WARN ? T.warn : tone === C.BAD ? T.bad : tone || T.good; const stp = RAMP_BAR[col] || ['#ff8266', col, '#6d1016']; meterBar(g, x, y, w, h, frac, stp[1], { hi: stp[0], lo: stp[2] }); }
  function fieldW(g, template, font) { return Math.ceil(tw(g, template, font || FC(800, 13))); }
  function field(g, s, rightX, y, opt = {}) { text(g, s, rightX, y, { font: opt.font || FC(800, 13), align: 'right', color: opt.colour || T.ink }); }
  const mechLabel = () => {
    if (!player.mech) return null;
    for (const f of (hudMechName.list || [])) { let n = null; try { n = f(); } catch (e) { n = null; } if (n) return n; }
    return 'Walker';
  };
  function status(g) { const L = cur(); drawCrest(g, L); return L.crest.y + L.crest.h; }
  function pauseBox() {
    const BL = FRAME.lastBook || bookLayoutFor(VW, VH, { touch: touchOn() }), p = BL.pages[0], rr0 = BL.rows[0] || { h: 44 };
    return { px: p.x, py: p.y, pw: p.w, ph: p.h, bh: rr0.h, step: rr0.h + 10, firstY: rr0.y || p.y, statsY: BL.statsY || p.y + p.h - 38 };
  }
  // colour maths (the contrast proof uses these)
  const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const lin = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const lum = rgb => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const contrast = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); };
  const over = (fg, alpha, bg) => [0, 1, 2].map(i => fg[i] * alpha + bg[i] * (1 - alpha));

  const API = {
    // tokens and type
    T, C, F, CINZEL, SANS, FC, FS, setF, tw, text, wrap, k, fmtInt,
    // materials and marks
    EM, emblem, deboss, grain, texture, cache, rr, rivet, coin, crossedSwords, shadowed, starPath,
    // controls
    stud, ribbon, seal, badge, pouch, satchel, beltStrap, buckle, plateButton, bookTile, stickRing,
    // readouts
    crest, crestMetrics, healthShield, questScroll, rolledScroll, plaque, meterBar, bossBanner, noticeRibbon, banner, flourish,
    vellumPlate, keycap, keycapW, tooltip, tag, brackets, talkPage, bookCover, bookPage, portrait, ramp,
    // geometry
    layout, layoutFor, bookLayoutFor, family, floorInsets, insets, bands, gapBetween, SAFE_ENV, cur: () => cur(),
    seat: name => { const s = cur().seats[name]; return s ? { x: s.x, y: s.y, r: s.r } : null; },
    lane: (name, n) => { const L = cur(); if (name === 'chat') return L.chatLane(n || 1); if (name === 'notice') return L.notice; if (name === 'banner') return L.banners[0] || null; if (name === 'banner2') return L.banners[1] || null; if (name === 'dialog') return L.dialog; if (name === 'plaques') return L.plaques; return null; },
    // registration
    seatFace: hudSeatFace, sealState: hudSeal, boss: hudBoss, tile: hudControl, mechName: hudMechName,
    face: seat => FRAME.faces[seat] || faceOf(seat), faceOf, usePreview, monsterInReach,
    teach, coachCount, learn, learnCount, showWord, wordsMode,
    addPlaque, slot, claim, beginPlaques,
    // input
    input: INPUT, get press() { return INPUT.press; }, get hover() { return INPUT.hover; }, stateOf, held, hitButton, pressStart, pressMove, pressEnd, pressDrop,
    // the core pieces (10-hud's drawHud)
    drawRing, compassOnRing, drawSeals, drawCrest, drawScroll, drawBosses, drawBelt, drawStick, drawSeats, dialogGeom, drawTalk, drawNotice, drawBanners, drawOverlays, drawBook, bookTiles, BOOK, KIT_TILES, ROW_LOOK, bookState, FRAME, DRAWN, FIT, trailFor, openQuest, trackedQuest, hudRects,
    setCacheOff: v => { cacheOff = !!v; }, cacheSize: () => CACHE.size,
    // the wave-14 names, kept working
    M: () => cur().M, GUT: 8, PAD: 12, R: 6, R_SLOT: 6, touch: touchOn, narrow: () => VW < 640, short: () => cur().fam === 'phoneL',
    LINE, BAR, BAR_S, row, ctrlW: () => Math.round(colW() / 2), meterH, chipH, gutV: () => 8, colW, colX, colOrigin: colX, mirrored: () => window.__stickRight === true,
    mmSize: () => cur().mm.R * 2, mmX: () => cur().mm.x - cur().mm.R, stickRect: () => { const s = cur().stick; return s ? { x: s.x - s.keep, y: s.y - s.keep, w: s.keep * 2, h: s.keep * 2 } : { x: -4000, y: -4000, w: 0, h: 0 }; },
    plate: compatPlate, chip: compatPlate, control, disc, thumbSeat, bar, toneOf, meter: oldMeter, readout, field, fieldW, occupied: () => hudRects(), stackFloor: () => 0,
    status, statusH: () => cur().crest.h, mechLabel, drawRail: () => { }, railBottom: () => cur().sealsBottom, railCells: () => null, pauseBox,
    hex, lum, contrast, over,
  };
  return API;
})();
window.HK = HK;
if (typeof readSafeArea === 'function') readSafeArea();

// ============================================================================
// THE HUD AUDIT (HOOKS.selfTest) — the spec's rules, held against the REAL game: the buttons it registers and the
// pieces it draws, not a mock. HK.audit() is also callable in a browser (the screenshot pass prints it).
//   rules: every tap target 44 px or more (circles by diameter); no two tap targets closer than 8 px on touch, 4 px with
//   a mouse (circle to circle, circle to rect, never by bounding box); nothing tappable in the notch / Dynamic Island /
//   home-indicator bands or on the stick; ribbons and the belt strap touch no other control; the notice lane touches no
//   control and not the knight; no persistent piece covers the knight; everything on screen; at most four seats with one
//   face each; nothing jumps (every persistent rect identical across scenes); every string fits its plate at Large.
// ============================================================================
const HUD_AUDIT = (() => {
  const SIZES = [[375, 667], [390, 844], [844, 390], [430, 932], [932, 430], [768, 1024], [1024, 768], [1280, 800]];
  const bb = a => (a.k === 'c' ? { x: a.x - a.r, y: a.y - a.r, w: 2 * a.r, h: 2 * a.r } : a);
  // ---- the pure engine: layout.js audit() / auditBook(), over HK.layoutFor and HK.bookLayoutFor ----
  function auditLayout(L, o) {
    const issues = [], tapsAll = L.items.filter(i => i.tap), MIN = 44, CLEAR = o.touch ? 8 : 4, gap = HK.gapBetween;
    const st = L.items.find(i => i.stick);
    for (const t of tapsAll) {
      const b = bb(t);
      if (b.w < MIN - 0.01 || b.h < MIN - 0.01) issues.push(`${t.id} under 44 px`);
      if (b.x < 0 || b.y < 0 || b.x + b.w > L.VW + 0.01 || b.y + b.h > L.VH + 0.01) issues.push(`${t.id} off screen`);
      for (const z of HK.bands(L)) if (gap(z, t) < 0) issues.push(`${t.id} in the ${z.name}`);
      if (st && gap(st, t) < 0) issues.push(`${t.id} on the stick`);
    }
    for (let i = 0; i < tapsAll.length; i++) for (let j = i + 1; j < tapsAll.length; j++) { const g = gap(tapsAll[i], tapsAll[j]); if (g < CLEAR) issues.push(`${tapsAll[i].id}~${tapsAll[j].id} gap ${g.toFixed(1)}`); }
    const drawn = L.items.filter(i => i.deco);
    for (const d of drawn) for (const t of tapsAll) {
      if (t.id === d.deco) continue;
      if (d.strap && /^pouch|^bag$|^swing$|^use$|^block$|^ctx$/.test(t.id) && L.fam === 'desk') continue;
      if (d.strap && /^pouch|^bag$/.test(t.id)) continue;
      if (gap(d, t) < 2) issues.push(`drawn ${d.id} touches ${t.id}`);
    }
    for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) if (gap(drawn[i], drawn[j]) < 2) issues.push(`drawn ${drawn[i].id} touches ${drawn[j].id}`);
    const strap = L.items.find(i => i.strap);
    if (st && strap && gap(st, strap) < 8) issues.push('the belt is under 8 px from the stick');
    if (L.bannerFail) issues.push('no banner lane fits above the knight');
    const knight = Object.assign({ k: 'r' }, L.knight);
    for (const t of L.items.filter(i => i.transient)) {
      if (gap(knight, t) < 0) issues.push(`${t.id} lane covers the knight`);
      if (t.id === 'notice') for (const c of tapsAll.filter(i => !i.reserved)) if (gap(t, c) < 2) issues.push(`notice lane touches ${c.id}`);
      if (/^banner/.test(t.id)) for (const c of tapsAll.filter(i => !i.reserved)) if (c.id !== 'scroll' && gap(t, c) < 0) issues.push(`banner lane covers ${c.id}`);
    }
    for (const t of L.items.filter(i => i.tap && !/^dialog|^chat/.test(i.id))) if (gap(knight, t) < 0) issues.push(`${t.id} covers the knight`);
    return issues;
  }
  function auditBookLayout(B, o) {
    const iss = auditLayout(Object.assign({}, B, { knight: { x: -999, y: -999, w: 0, h: 0 } }), o);
    if (B.bottom > B.book.y + B.book.h + 0.5) iss.push(`book content runs ${Math.round(B.bottom - B.book.y - B.book.h)} px past the page`);
    return iss;
  }
  function pureMatrix() {
    let runs = 0, fails = 0; const seen = [];
    for (const [w, h] of SIZES) for (const touch of [true, false]) for (const stickRight of [false, true]) for (const bosses of [0, 1, 2])
      for (const minimap of [true, false]) for (const chat of [0, 4]) for (const dialog of [false, true]) for (const online of [true, false]) for (const home of [true, false]) {
        const o = { touch, stickRight, bosses, minimap, chat, dialog, online, home, plaques: 99 };
        const iss = auditLayout(HK.layoutFor(w, h, o), o); runs++;
        if (iss.length) { fails++; if (seen.length < 12) seen.push(`${w}x${h} ${touch ? 'touch' : 'mouse'}: ${iss[0]}`); }
      }
    let bRuns = 0, bFails = 0;
    for (const [w, h] of SIZES) for (const touch of [true, false]) for (const online of [true, false]) for (const page of ['kit', 'game']) {
      const o = { touch, online, page }, iss = auditBookLayout(HK.bookLayoutFor(w, h, o), o); bRuns++;
      if (iss.length) { bFails++; if (seen.length < 16) seen.push(`BOOK ${w}x${h} ${touch ? 'touch' : 'mouse'} ${page}: ${iss[0]}`); }
    }
    return { runs, fails, bRuns, bFails, seen };
  }

  // ---- one live frame: the real buttons[], the pieces the kit drew, the layout's lanes ----
  function frameIssues(where, opt = {}) {
    const L = HK.cur(), t = L.touch, out = [], gap = HK.gapBetween;
    const taps = buttons.filter(b => !b.offscreen && b.w > 0 && b.h > 0).map(b => b.r ? { id: b.label, k: 'c', x: b.cx != null ? b.cx : b.x + b.w / 2, y: b.cy != null ? b.cy : b.y + b.h / 2, r: b.r, b } : { id: b.label, k: 'r', x: b.x, y: b.y, w: b.w, h: b.h, b });
    const MIN = 44, CLEAR = t ? 8 : 4, knight = Object.assign({ k: 'r' }, L.knight), bandsL = HK.bands(L);
    const stick = L.stick && !opt.book ? { k: 'c', x: L.stick.x, y: L.stick.y, r: L.stick.keep } : null;   // the book is modal: no stick under it
    for (const q of taps) {
      const b = bb(q);
      if (b.w < MIN - 0.01 || b.h < MIN - 0.01) out.push(`${where}: ${q.id} under 44 px (${Math.round(b.w)}x${Math.round(b.h)})`);
      if (b.x < -0.5 || b.y < -0.5 || b.x + b.w > VW + 0.5 || b.y + b.h > VH + 0.5) out.push(`${where}: ${q.id} off screen`);
      for (const z of bandsL) if (gap(z, q) < 0) out.push(`${where}: ${q.id} in the ${z.name}`);
      if (stick && gap(stick, q) < 0) out.push(`${where}: ${q.id} on the stick`);
      if (!opt.book && !/^(dialog|chat:log)$/.test(q.id) && gap(knight, q) < 0) out.push(`${where}: ${q.id} covers the knight`);
    }
    for (let i = 0; i < taps.length; i++) for (let j = i + 1; j < taps.length; j++) { const g0 = gap(taps[i], taps[j]); if (g0 < CLEAR) out.push(`${where}: ${taps[i].id} ~ ${taps[j].id} gap ${g0.toFixed(1)} < ${CLEAR}`); }
    if (!opt.book) {
      const drawn = HK.DRAWN.log.slice();
      const own = (d, q) => (q.b.seat && d.deco === q.b.seat) || d.deco === String(q.id).toLowerCase();
      for (const d of drawn) for (const q of taps) {
        if (own(d, q)) continue;
        if (d.strap && (/^hot\d$|^BAG$/.test(q.id) || (L.fam === 'desk' && q.b.seat))) continue;
        if (gap(Object.assign({ k: 'r' }, d), q) < 2) out.push(`${where}: drawn ${d.id} touches ${q.id}`);
      }
      for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) { if (drawn[i].strap || drawn[j].strap) continue; if (gap(Object.assign({ k: 'r' }, drawn[i]), Object.assign({ k: 'r' }, drawn[j])) < 2) out.push(`${where}: drawn ${drawn[i].id} touches ${drawn[j].id}`); }
      const strap = drawn.find(d => d.strap);
      if (stick && strap && gap(stick, Object.assign({ k: 'r' }, strap)) < 8) out.push(`${where}: the belt is under 8 px from the stick`);
      const nt = Object.assign({ k: 'r' }, L.notice);
      for (const q of taps) if (gap(nt, q) < 2) out.push(`${where}: the notice lane touches ${q.id}`);
      if (gap(knight, nt) < 0) out.push(`${where}: the notice lane covers the knight`);
      for (const bn of L.banners) if (gap(knight, Object.assign({ k: 'r' }, bn)) < 0) out.push(`${where}: a banner lane covers the knight`);
      const seatTaps = taps.filter(q => q.b.seat), seats = new Set(seatTaps.map(q => q.b.seat));
      if (seatTaps.length > 4 || seats.size !== seatTaps.length) out.push(`${where}: ${seatTaps.length} seat taps for ${seats.size} seats`);
    }
    return out;
  }
  // the persistent pieces' rects, for NOTHING JUMPS
  function signature(L) {
    const r = o => o ? [o.x, o.y, o.w, o.h, o.r].map(v => v == null ? '' : Math.round(v * 10) / 10).join(',') : '-';
    const s = ['crest ' + r(L.crest), 'mm ' + r(L.mm), 'scroll ' + r(L.scroll), 'belt ' + r(L.belt), 'bag ' + r(L.bag), 'stick ' + r(L.stick)];
    for (const k of Object.keys(L.seals).sort()) s.push(k + ' ' + r(L.seals[k]));
    for (const k of Object.keys(L.seats).sort()) s.push(k + ' ' + r(L.seats[k]));
    L.plaques.forEach((p, i) => s.push('plaque' + i + ' ' + r(p)));
    L.pouches.forEach((p, i) => s.push('pouch' + i + ' ' + r(p)));
    return s.join(' | ');
  }
  // a context that measures text the way the fonts do, a little generously (headless has no fonts; calibrated in Chromium:
  // Cinzel capitals read 5-20% wide, the system sans 0-5% wide), and records nothing else
  function fitCtx() {
    let font = '12px sans-serif';
    const est = s => { const m = /(\d+(?:\.\d+)?)px/.exec(font), px = m ? +m[1] : 12, cz = /Cinzel/.test(font); let w = 0; for (const ch of String(s)) w += ch === ' ' ? 0.29 : /[A-Z]/.test(ch) ? (cz ? 0.8 : 0.72) : /[0-9]/.test(ch) ? (cz ? 0.64 : 0.61) : /[.,:;'!|il]/.test(ch) ? 0.3 : (cz ? 0.62 : 0.585); return w * px * (/800|700|bold/.test(font) ? 1.04 : 1); };
    const nop = () => { };
    return new Proxy({}, {
      get: (tg, key) => key === 'measureText' ? (s => ({ width: est(s) })) : key === 'font' ? font
        : (key === 'createLinearGradient' || key === 'createRadialGradient') ? (() => ({ addColorStop: nop })) : key === 'createPattern' ? (() => null)
          : typeof key === 'string' ? nop : undefined,
      set: (tg, key, v) => { if (key === 'font') font = v; return true; },
    });
  }
  function fitIssues(where) {
    const out = [];
    for (const e of HK.FIT.log) {
      if (!e.box) continue;
      const x0 = e.align === 'center' ? e.x - e.w / 2 : e.align === 'right' ? e.x - e.w : e.x, x1 = x0 + e.w;
      if (x0 < e.box.x - 1 || x1 > e.box.x + e.box.w + 1) out.push(`${where}: "${e.s}" (${e.id || 'text'}) runs ${Math.round(Math.max(e.box.x - x0, x1 - e.box.x - e.box.w))} px out of its plate`);
    }
    return out;
  }
  return { SIZES, auditLayout, auditBookLayout, pureMatrix, frameIssues, signature, fitCtx, fitIssues };
})();
HK.audit = HUD_AUDIT;

HOOKS.selfTest.push((check, F, h) => {
  const P = 'hudkit: ', A = HUD_AUDIT;
  // ---------- 1. the colour language: a small closed set of named colours; red means health or danger only ----------
  {
    const T = HK.T, named = ['ink', 'inkDim', 'inkMute', 'gold', 'goldHi', 'goldLo', 'gules', 'good', 'warn', 'bad', 'friend'].every(n => /^#[0-9a-f]{6}$/i.test(T[n]));
    const distinct = new Set(['ink', 'inkDim', 'inkMute', 'gold', 'goldHi', 'gules', 'good', 'warn', 'bad', 'friend'].map(n => T[n].toLowerCase())).size === 10;
    const rampOk = HK.ramp(1) === T.good && HK.ramp(0.4) === T.warn && HK.ramp(0.1) === T.bad && HK.ramp(0.5) === T.warn && HK.ramp(0.51) === T.good;
    const red = c => { const q = HK.hex(c); return !!q && q[0] > 150 && q[0] > q[1] * 2 && q[0] > q[2] * 2; };
    const reds = Object.entries(T).filter(([, v]) => typeof v === 'string' && v[0] === '#' && red(v)).map(([k]) => k).sort().join();
    check(P + 'one colour language: named tokens, all distinct; red only for health and danger (gules, bad, enemy dots); one health ramp (green > 50%, amber > 25%, red below)', named && distinct && rampOk && reds === 'bad,enemy,gules', { named, distinct, rampOk, reds });
  }
  // ---------- 2. contrast: every text colour on every material it sits on ----------
  {
    const mats = { vellumTop: '#31281e', vellumBottom: '#1d1712', sableTop: '#2a2020', sableBottom: '#141011', plaqueTop: '#2d3138', plaqueBottom: '#16181c', bookPage: '#30271d' };
    const worst = [], rep = {};
    for (const [mn, mc] of Object.entries(mats)) for (const [tn, tc] of [['ink', HK.T.ink], ['inkDim', HK.T.inkDim], ['gold', HK.T.gold], ['goldHi', HK.T.goldHi]]) {
      const r = HK.contrast(HK.hex(tc), HK.hex(mc)); rep[tn + ' on ' + mn] = Math.round(r * 10) / 10; if (r < 4.5) worst.push(`${tn} on ${mn} = ${r.toFixed(2)}`);
    }
    const key = HK.contrast(HK.hex('#2a1d0c'), HK.hex('#cdbb90')); if (key < 4.5) worst.push('keycap letter ' + key.toFixed(2));
    const mute = HK.contrast(HK.hex(HK.T.inkMute), HK.hex('#16181c')); if (mute < 3) worst.push('inkMute (disabled) ' + mute.toFixed(2));
    check(P + 'contrast: ink, inkDim and gold clear 4.5:1 on vellum, sable cloth, the iron plaque and the book page; keycap letters too; disabled text still 3:1', worst.length === 0, { worst, ...rep, keycap: +key.toFixed(2), mute: +mute.toFixed(2) });
  }
  // ---------- 3. the geometry engine over the spec's whole matrix (3,072 HUD combinations and 64 of the book) ----------
  {
    const r = A.pureMatrix();
    check(P + `the layout engine passes the spec's matrix: ${r.runs} HUD combinations (8 sizes x touch/mouse x stick side x 0/1/2 bosses x minimap x chat x talk page x online x home) and ${r.bRuns} of the Knight's Book, with no overlap, 8 px apart on touch, 44 px floors, nothing in the notch or home-bar bands or on the stick`, r.runs === 3072 && r.fails === 0 && r.bRuns === 64 && r.bFails === 0, r);
  }

  // ---------- the live audits share one harness: the real game, drawn at every size ----------
  const own = kk => Object.getOwnPropertyDescriptor(window, kk);
  const saved = { w: own('innerWidth'), h: own('innerHeight'), touch: window.__forceTouch, stick: window.__stickRight, text: window.SETTINGS ? SETTINGS.get('text') : 'normal', map: window.SETTINGS ? SETTINGS.get('minimap') : true,
    mech: player.mech, comp: player.companion ? JSON.parse(JSON.stringify(player.companion)) : null, law: player.law ? JSON.parse(JSON.stringify(player.law)) : null, mons: monsters.slice(), x: player.x, y: player.y, home: player.home, homeCd: player.homeCd,
    paused, panel, dc: dialog.cur, dq: dialog.queue.slice(), lb: levelBanner, ab: typeof areaBanner !== 'undefined' ? areaBanner : null, notice, inv: player.inv.map(q => q ? { ...q } : null), page: HK.BOOK.page };
  dialog.cur = null; dialog.queue.length = 0; closePanel(); paused = false; levelBanner = null; notice = null; if (typeof areaBanner !== 'undefined') areaBanner = null;
  // the wire on a fake socket (70-net), as the online files' own checks run it: a friend beside us and chat on the strip
  const ONL = (() => {
    const can = !!(window.NET && window.CHAT && window.PLAYERS); let was = null;
    const feed = m => NET.sock && NET.sock.onmessage && NET.sock.onmessage({ data: JSON.stringify(m) });
    const TALK = [['Ava', 'Come and help me fight the boss'], ['Cohen', 'On my way, follow me'], ['Ava', 'It is by the old mill, hurry'], ['Cohen', 'Nearly there']];
    return {
      can,
      set(on, lines) {
        if (!can) return !on;
        if (!was) {
          was = { enabled: NET.enabled, token: NET.token, fake: NET.fake, log: CHAT.log.map(l => ({ ...l })), bubbles: { ...CHAT.bubbles } };
          const fake = { call: async () => ({}), open: () => { const s = { readyState: 1, send(str) { const m = JSON.parse(str); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen' }) }); }, close() { s.readyState = 3; } }; return s; } };
          NET.disconnect(); NET.enabled = true; NET.token = 'hudkit-test'; NET.useFake(fake); NET.connect();
          feed({ t: 'who', list: [{ n: 'Cohen', map: 'over', region: 'Thistledown', lv: 5 }, { n: 'Ava', map: 'over', region: 'Thistledown', lv: 7 }] });
        }
        if (on) { CHAT.log.length = 0; TALK.slice(0, lines).forEach(([n, text], i) => feed({ t: 'chat', n, text, at: 3 + i })); }
        NET.enabled = on; for (const l of CHAT.log) l.t = on ? 8 : 0;
        return !on || NET.online();
      },
      restore() {
        if (!was) return;
        NET.emit('offline', { t: 'offline' }); NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
        CHAT.log.length = 0; for (const l of was.log) CHAT.log.push(l); for (const n in CHAT.bubbles) delete CHAT.bubbles[n]; Object.assign(CHAT.bubbles, was.bubbles); was = null;
      },
    };
  })();
  const bossType = Object.keys(MONSTER_DEFS).filter(t => t !== 'the_fang' && MONSTER_DEFS[t].level >= 25 && MONSTER_DEFS[t].hp >= 300);
  const setBosses = n => {
    monsters.length = 0;
    for (let i = 0; i < n && i < bossType.length; i++) { const d = MONSTER_DEFS[bossType[i]]; monsters.push({ type: bossType[i], x: player.x + 40 + i * 30, y: player.y + 10, home: { x: player.x + 40, y: player.y }, r: d.r, hp: d.hp * 0.6, maxHp: d.hp, speed: d.speed, angry: false, state: 'idle', wanderT: 9, wander: { x: 0, y: 0 }, attackCd: 9, hurtT: 0, dead: false, deadT: 0, respawnT: 0, facing: { x: 1, y: 0 }, walkT: 0, moving: false, stunT: 0 }); }
  };
  const MECH = { walker: { kind: 'walker', hp: 40, maxHp: 60 }, dozer: { kind: 'dozer', hp: 74, maxHp: 110 }, beast: { kind: 'beast', hp: 240, maxHp: 300 }, horse: { kind: 'horse', hp: 30, maxHp: 40 } };
  const setSize = (w, hh) => { window.innerWidth = w; window.innerHeight = hh; if (VW !== w || VH !== hh) resize(); return VW === w && VH === hh; };
  const fctx = A.fitCtx();
  const frame = () => { HK.DRAWN.on = true; HK.DRAWN.log.length = 0; drawHud(fctx); HK.DRAWN.on = false; };
  const sigs = new Map(), jumps = [];
  const noteSig = (key, where) => { const s = A.signature(HK.cur()); if (!sigs.has(key)) sigs.set(key, { s, where }); else if (sigs.get(key).s !== s && jumps.length < 6) jumps.push(`${where} vs ${sigs.get(key).where}`); };
  const restoreWorld = () => {
    ONL.restore(); HK.setCacheOff(false); HK.FIT.on = false;
    window.__forceTouch = saved.touch; window.__stickRight = saved.stick;
    if (window.SETTINGS) { SETTINGS.set('text', saved.text); SETTINGS.set('minimap', saved.map); }
    monsters.length = 0; for (const m of saved.mons) monsters.push(m);
    player.mech = saved.mech; player.companion = saved.comp; player.law = saved.law; player.x = saved.x; player.y = saved.y; player.home = saved.home; player.homeCd = saved.homeCd; player.inv = saved.inv;
    if (saved.w) { Object.defineProperty(window, 'innerWidth', saved.w); Object.defineProperty(window, 'innerHeight', saved.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } }
    resize(); closePanel(); paused = saved.paused; if (saved.panel) openPanel(saved.panel);
    dialog.cur = saved.dc; dialog.queue.length = 0; dialog.queue.push(...saved.dq); levelBanner = saved.lb; if (typeof areaBanner !== 'undefined') areaBanner = saved.ab; notice = saved.notice; HK.BOOK.page = saved.page;
    render();
  };
  try {
    HK.setCacheOff(true);
    const texts = window.SETTINGS && SETTINGS.OPTIONS && SETTINGS.OPTIONS.text ? SETTINGS.OPTIONS.text.slice() : ['normal'];
    // ---------- 4. the live matrix: sizes x touch/mouse x stick side x boss bars x machine x text size x minimap x chat lines ----------
    {
      const problems = []; let frames = 0, tried = 0;
      const kinds = ['walker', 'dozer', 'beast'];
      for (const [w, hh] of A.SIZES) {
        if (!setSize(w, hh)) continue; tried++;
        for (const t of [true, false]) {
          window.__forceTouch = t;
          for (const right of [false, true]) for (const map of [true, false]) for (const chat of [0, 4]) {
            window.__stickRight = right; if (window.SETTINGS) SETTINGS.set('minimap', map);
            if (!ONL.set(chat > 0, chat)) { problems.push(`${w}x${hh}: the online scene did not come up`); continue; }
            for (const bosses of [0, 1, 2]) for (const mach of [false, true]) for (const tx of texts) {
              if (window.SETTINGS) SETTINGS.set('text', tx);
              setBosses(bosses); player.mech = mach ? { ...MECH[kinds[frames % 3]] } : null; player.home = { x: player.x - 80, y: player.y };
              frame(); frames++;
              const where = `${w}x${hh} ${t ? 'touch' : 'mouse'} stick-${right ? 'right' : 'left'} ${map ? 'map' : 'no-map'} chat${chat} boss${bosses}${mach ? ' ' + player.mech.kind : ''} ${tx}`;
              for (const p of A.frameIssues(where)) if (problems.length < 40) problems.push(p);
              noteSig(`${w}x${hh}|${t}|${right}|${map}|${chat > 0}`, where);
              if (chat && !bosses && !dialog.cur && !buttons.some(b => b.label === 'chat:log')) problems.push(`${where}: no chat strip`);
              if (chat && !buttons.some(b => b.label === 'friends')) problems.push(`${where}: no FRIENDS seal`);
            }
          }
        }
      }
      ONL.set(false, 0); setBosses(0); player.mech = null;
      check(P + `live audit over the real buttons: 8 sizes x touch/mouse x stick side x minimap x chat 0/4 (online) x 0/1/2 boss banners x on foot / in a machine x ${texts.length} text sizes = ${frames} frames — 44 px floors, 8 px apart on touch (4 with a mouse), nothing in the notch or home-bar bands or on the stick, ribbons and the belt clear of every control, the notice lane clear, nothing over the knight, everything on screen, four seats at most`, tried === 8 && frames === 8 * 2 * 2 * 2 * 2 * 3 * 2 * texts.length && problems.length === 0, { tried, frames, problems: problems.slice(0, 14), total: problems.length });
    }
    // ---------- 5. the scenes: busy (2 bosses + companion + full plaques + level-up + max chat), talk page, home not set,
    //            the walker / bulldozer / Barrelbeast / mare, a dungeon, and the book on both pages ----------
    {
      const problems = []; let frames = 0;
      if (window.SETTINGS) { SETTINGS.set('text', 'normal'); SETTINGS.set('minimap', true); }
      const scenes = ['busy', 'talk', 'no-home', 'walker', 'dozer', 'beast', 'mare', 'dungeon'];
      const inst = window.INSTANCES && INSTANCES.list().includes('spider_den') ? 'spider_den' : null;
      for (const [w, hh] of A.SIZES) {
        if (!setSize(w, hh)) continue;
        for (const t of [true, false]) for (const right of [false, true]) {
          window.__forceTouch = t; window.__stickRight = right;
          for (const sc of scenes) {
            player.mech = null; player.companion = saved.comp ? JSON.parse(JSON.stringify(saved.comp)) : null; player.law = saved.law ? JSON.parse(JSON.stringify(saved.law)) : null; player.home = { x: player.x - 80, y: player.y };
            dialog.cur = null; levelBanner = null; setBosses(0); ONL.set(false, 0);
            if (sc === 'busy') { setBosses(2); ONL.set(true, 4); player.companion = { id: 'sera', hp: 44, maxHp: 60, mode: 'follow', x: player.x - 30, y: player.y, downT: 0, freed: { sera: true } }; player.law = { wanted: 2, timer: 38, fines: 1 }; levelBanner = { text: 'LEVEL UP', sub: 'Melee 20', t: 3 }; }
            if (sc === 'talk') { ONL.set(true, 4); dialog.cur = { who: 'The Voice', text: 'Thistledown. You will wake here now if you fall. The captain of the watch keeps the gate, and the smith by the square will mend your blade.', t: 0 }; dialog.shown = dialog.cur.text.length; }
            if (sc === 'no-home') player.home = null;
            if (MECH[sc]) player.mech = { ...MECH[sc] };
            if (sc === 'mare') player.mech = { ...MECH.horse };
            if (sc === 'dungeon') { if (!inst) continue; if (!INSTANCES.active()) INSTANCES.enter(inst); }
            frame(); frames++;
            const where = `${w}x${hh} ${t ? 'touch' : 'mouse'} stick-${right ? 'right' : 'left'} ${sc}`;
            for (const p of A.frameIssues(where)) if (problems.length < 40) problems.push(p);
            if (sc !== 'dungeon' && sc !== 'busy' && sc !== 'talk') noteSig(`${w}x${hh}|${t}|${right}|true|false`, where);
            if (sc === 'dungeon') { INSTANCES.leave(); }
            if (sc === 'talk' && !buttons.some(b => b.label === 'dialog')) problems.push(`${where}: the talk page is not a tap`);
          }
          // the book, on every page this size has
          ONL.set(true, 0); paused = true;
          for (const page of ['kit', 'game', 'keys']) {
            HK.BOOK.page = page; frame(); frames++;
            const B = HK.FRAME.lastBook, where = `${w}x${hh} ${t ? 'touch' : 'mouse'} book:${page}`;
            if ((page === 'game' && !B.onePage) || (page === 'keys' && B.fam !== 'desk')) continue;
            for (const p of A.frameIssues(where, { book: true })) if (problems.length < 40) problems.push(p);
            for (const b of buttons) { const r = b.r ? { x: b.cx - b.r, y: b.cy - b.r, w: b.r * 2, h: b.r * 2 } : b; if (r.x < B.book.x - 0.5 || r.y < B.book.y - 0.5 || r.x + r.w > B.book.x + B.book.w + 0.5 || r.y + r.h > B.book.y + B.book.h + 0.5) problems.push(`${where}: ${b.label} is off the page`); }
          }
          paused = false; HK.BOOK.page = 'kit'; ONL.set(false, 0);
        }
      }
      setBosses(0); player.mech = null; dialog.cur = null; levelBanner = null;
      check(P + 'the scenes pass the same rules at every size, touch and mouse, stick either side: busy (2 bosses, a companion, WANTED and a fine, a level-up, 4 chat lines), the talk page, HOME not set, the walker, bulldozer, Barrelbeast and mare, a dungeon, and the Knight\'s Book (kit, game and keys pages) with everything on its page', frames > 8 * 2 * 2 * 8 && problems.length === 0, { frames, problems: problems.slice(0, 14), total: problems.length });
    }
    // ---------- 6. nothing jumps: every persistent piece has one rect per size and setting, whatever is happening ----------
    check(P + 'nothing jumps: the crest, the ring, the seals, the scroll slot, the plaque slots, the belt, its pouches and BAG, the four seats and the stick keep one rect per size and setting across every scene (bosses, machines, chat, text size)', jumps.length === 0 && sigs.size > 0, { settings: sigs.size, jumps });
    // ---------- 7. text fits at Large: every string inside its plate after the shrink and wrap rules ----------
    {
      const problems = []; let frames = 0; const fc = A.fitCtx();
      if (window.SETTINGS) SETTINGS.set('text', 'large');
      for (const [w, hh] of A.SIZES) {
        if (!setSize(w, hh)) continue;
        for (const t of [true, false]) {
          window.__forceTouch = t; window.__stickRight = false;
          for (const sc of ['busy', 'machine', 'talk']) {
            setBosses(sc === 'busy' ? 2 : 0); ONL.set(sc !== 'machine', 4); player.mech = sc === 'machine' ? { ...MECH.beast } : null;
            player.companion = sc === 'busy' ? { id: 'sera', hp: 44, maxHp: 60, mode: 'follow', x: player.x - 30, y: player.y, downT: 0, freed: { sera: true } } : null;
            player.law = sc === 'busy' ? { wanted: 2, timer: 38, fines: 1 } : null; levelBanner = sc === 'busy' ? { text: 'LEVEL UP', sub: 'Melee 20', t: 3 } : null;
            dialog.cur = sc === 'talk' ? { who: 'Death', text: 'You again. Your pack is in the chest in my house. Cheap things I return for nothing; precious things cost a quarter of their worth.', t: 0 } : null; if (dialog.cur) dialog.shown = dialog.cur.text.length;
            notice = { text: 'That shield can stop a blow. Tap BLOCK as the next one comes in.', t: 2 };
            HK.FIT.on = true; HK.FIT.log.length = 0; drawHud(fc); HK.FIT.on = false; frames++;
            for (const p of A.fitIssues(`${w}x${hh} ${t ? 'touch' : 'mouse'} ${sc}`)) if (problems.length < 30) problems.push(p);
          }
        }
      }
      notice = null; dialog.cur = null; levelBanner = null; setBosses(0); player.mech = null; ONL.set(false, 0); if (window.SETTINGS) SETTINGS.set('text', 'normal');
      check(P + 'text fits at Large: the crest, the scroll, plaques, boss banners, ribbons, the notice, banners, the talk page and the book keep every string inside its plate at every size (names shrink to a floor, sentences wrap, never cut inside a word)', frames === 48 && problems.length === 0, { frames, problems: problems.slice(0, 12), total: problems.length });
    }
    // ---------- 8. the seat table: four seats, one face each, the right face in every state ----------
    {
      setSize(390, 844); window.__forceTouch = true; window.__stickRight = false; if (window.SETTINGS) SETTINGS.set('minimap', true);
      setBosses(0); ONL.set(false, 0);
      const faces = () => { frame(); const f = HK.FRAME.faces; return ['swing', 'use', 'block', 'ctx'].map(s => f[s] ? f[s].id : '-').join(' '); };
      const got = {};
      player.mech = null; got.foot = faces();
      player.mech = { ...MECH.walker }; got.walker = faces();
      player.mech = { ...MECH.dozer }; got.dozer = faces();
      player.mech = { ...MECH.beast }; got.beast = faces();
      player.mech = { ...MECH.horse }; got.mare = faces();
      player.mech = null; dialog.cur = { who: 'The Voice', text: 'Next.', t: 0 }; got.talk = faces(); dialog.cur = null;
      const want = { foot: /^swing (use|next) block (-|ride|leave|build)$/, walker: /^stomp crush(-idle)? special exit$/, dozer: /^stomp crush(-idle)? special exit$/, beast: /^ram (bomb|crush) special exit$/, mare: /^saddle (use|next) - getdown$/, talk: /^swing next block/ };
      const bad = Object.keys(want).filter(k => !want[k].test(got[k]));
      const seatsOk = buttons.filter(b => b.seat).length <= 4;
      check(P + 'the seat table: four seats (SWING | USE | BLOCK | ctx), one face each — on foot SWING / USE / BLOCK, a walker or bulldozer STOMP / CRUSH / the special / EXIT, the Barrelbeast RAM / BOMB / the special / EXIT, the mare SWING (disabled) / USE / nothing / GET DOWN, and NEXT on USE while someone talks', bad.length === 0 && seatsOk, { got, bad });
      player.mech = null;
    }
    // ---------- 9. the controls behave: pointer-up inside fires, slide-off cancels, a 400 ms hold names instead, SWING fires on the press, a round control is hit as a circle ----------
    {
      setSize(1280, 800); window.__forceTouch = false; window.__stickRight = false; closePanel(); frame();
      const bag = buttons.find(b => b.label === 'BAG'), mid = b => [b.x + b.w / 2, b.y + b.h / 2];
      let [bx, by] = mid(bag);
      pointerDown(bx, by, 'mouse'); const notOnPress = panel !== 'inventory'; pointerUp('mouse', bx, by); const onRelease = panel === 'inventory'; closePanel(); frame();
      pointerDown(bx, by, 'mouse'); pointerMove(bx + 300, by - 300, 'mouse'); pointerUp('mouse', bx + 300, by - 300); const slideOff = panel !== 'inventory'; closePanel(); frame();
      pointerDown(bx, by, 'mouse'); HK.input.press.t0 -= 450; drawHud(ctx); const named = !!HK.press && HK.press.named; pointerUp('mouse', bx, by); const holdNames = named && panel !== 'inventory'; closePanel(); frame();
      const inv0 = player.inv.map(q => q ? { ...q } : null), hp0 = player.hp; player.inv[0] = { id: 'bread', qty: 3 }; player.hp = Math.max(1, player.maxHp - 10); frame();
      const bread0 = countItem('bread'), hot = buttons.find(b => b.label === 'hot0'); [bx, by] = mid(hot); pointerDown(bx, by, 'mouse'); const ateOnPress = countItem('bread') === bread0 - 1; pointerUp('mouse', bx, by); player.inv = inv0; player.hp = hp0; frame();
      const ring = buttons.find(b => b.label === 'minimap'), cx = ring.cx + ring.r * 0.9, cy = ring.cy + ring.r * 0.9;
      pointerDown(cx, cy, 'mouse'); const cornerMiss = !HK.press || HK.press.label !== 'minimap'; HK.pressDrop('mouse'); touch.press = null; touch.stickId = null; touch.active = false;
      pointerDown(ring.cx, ring.cy + ring.r * 0.9, 'mouse'); pointerUp('mouse', ring.cx, ring.cy + ring.r * 0.9); const ringHit = panel === 'map'; closePanel();
      check(P + 'controls: BAG fires on release inside and not on the press, sliding off cancels it, holding it 400 ms names it instead; a pouch fires on the press; the ring is hit as a circle (its box corner misses)', notOnPress && onRelease && slideOff && holdNames && ateOnPress && cornerMiss && ringHit, { notOnPress, onRelease, slideOff, holdNames, ateOnPress, cornerMiss, ringHit });
    }
    // ---------- 10. the Knight's Book holds everything rare: twelve tiles, each opening its panel, each with its key on a computer ----------
    {
      setSize(1280, 800); window.__forceTouch = false; closePanel(); paused = true; HK.BOOK.page = 'kit'; frame();
      const want = { BAG: 'inventory', SKILLS: 'skills', QUESTS: 'quests', CRAFTING: 'craft', MAP: 'map', WIKI: 'wiki', HELP: 'help' };
      const tiles = HK.bookTiles(), words = tiles.map(t => t.word);
      const opens = {}; for (const [wd, pn] of Object.entries(want)) { paused = true; frame(); const b = buttons.find(q => q.label === wd); if (b) b.action(); opens[wd] = panel === pn && !paused; closePanel(); }
      paused = true; frame(); const keys = tiles.slice(0, 12).every(t => t.key && buttons.some(b => b.label === t.word && (b.keys || []).includes(t.key)));
      const rows = ['Resume', 'Settings', 'Title screen', 'New game'].every(l => buttons.some(b => b.label.startsWith(l)));
      paused = false; frame();
      const twelve = ['BAG', 'SKILLS', 'QUESTS', 'CRAFTING', 'MAP', 'WIKI', 'FRIENDS', 'CHAT', 'HOME', 'HELP', 'MARKERS'].every(wd => words.includes(wd)) && words.some(wd => /^MUSIC/.test(wd)) && tiles.length >= 12;
      check(P + "the Knight's Book (MENU / Esc) holds the kit's twelve tiles — every panel is one tap from it and each tile wears its key on a computer — and its rows: Resume, Settings, Title screen, New game", twelve && Object.values(opens).every(Boolean) && keys && rows, { words, opens, keys, rows });
    }
    // ---------- 11. the panels wear the kit's frame and stay finger-sized: the pack (an item chosen), Friends, the Chat log and Give ----------
    {
      const problems = []; let tried = 0;
      const rectOf = b => b.r ? { x: b.cx - b.r, y: b.cy - b.r, w: b.r * 2, h: b.r * 2, label: b.label } : b;
      const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const inside = r => r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= VW + 0.5 && r.y + r.h <= VH + 0.5;
      const inv0 = player.inv.map(q => q ? { ...q } : null);
      for (const [w, hh] of A.SIZES) {
        if (!setSize(w, hh)) continue; tried++;
        for (const t of [true, false]) {
          window.__forceTouch = t; window.__stickRight = false; setBosses(0); player.mech = null;
          for (const [pn, arg] of [['inventory'], ['friends'], ['chatlog'], ['gift', 'Ava']]) {
            ONL.set(true, 2); player.inv = inv0.map(q => q ? { ...q } : null); player.inv[0] = { id: 'bread', qty: 3 };
            if (pn === 'gift') { player.inv = new Array(INV_SLOTS).fill(null); player.inv[0] = { id: 'stone', qty: 3 }; }
            closePanel(); openPanel(pn, arg); if (pn === 'inventory') selectedSlot = 0;
            frame(); drawHud(ctx);
            const where = `${w}x${hh} ${t ? 'touch' : 'mouse'} panel ${pn}`;
            const all = buttons.filter(b => !b.offscreen && b.w > 0 && b.h > 0).map(rectOf);
            const ci = all.findIndex(b => b.label === '×');
            if (ci < 0) { problems.push(`${where}: no close seal`); continue; }
            const rects = all.slice(ci);
            if (panelRect && !inside(panelRect)) problems.push(`${where}: the panel is off screen`);
            const floor = t ? 44 : 26, tile = /^slot\d+|^bank\d+|^hot\d+|^eq|^give/;
            for (const r of rects) {
              if (!inside(r)) problems.push(`${where}: ${r.label} off screen`);
              if (!tile.test(r.label) && (r.w < floor - 0.5 || r.h < floor - 0.5)) problems.push(`${where}: ${r.label} is ${Math.round(r.w)}x${Math.round(r.h)}, under ${floor}`);
              if (tile.test(r.label) && t && (r.w < 40 || r.h < 40)) problems.push(`${where}: item tile ${r.label} is ${Math.round(r.w)}x${Math.round(r.h)}`);
            }
            for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (ov(rects[i], rects[j])) problems.push(`${where}: ${rects[i].label} x ${rects[j].label}`);
          }
          closePanel(); selectedSlot = -1;
        }
      }
      player.inv = inv0; ONL.set(false, 0);
      check(P + 'the panels wear the book frame and stay usable at all 8 sizes, touch and mouse: the pack (an item chosen), Friends, the Chat log and Give each have a close seal, no two controls overlap, nothing is off screen, controls are 44 px on touch (26 with a mouse) and item pouches 40', tried === 8 && problems.length === 0, { tried, problems: problems.slice(0, 12), total: problems.length });
    }
    // ---------- 12. a changing number lives in a field reserved from its widest value: the crest never resizes or shifts ----------
    {
      setSize(390, 844); window.__forceTouch = true; frame();
      const r = HK.cur().crest, mc = HK.crestMetrics, fc = A.fitCtx();
      const variants = [{ hp: 9, max: 110, coins: 0, combat: 3 }, { hp: 110, max: 110, coins: 999999, combat: 99 }, { hp: 27, max: 34, coins: 340, combat: 19, mech: { name: 'Barrelbeast', hp: 999, max: 999 } }];
      const ms = variants.map(v => { const m = mc(fc, r, v); return [m.f1, m.f1b, m.f2, m.tx, m.avail].join(','); });
      const same = ms.every(x => x === ms[0]);
      // and the widest values really fit the banner at those sizes
      HK.FIT.on = true; HK.FIT.log.length = 0; HK.crest(fc, r, variants[1]); HK.crest(fc, r, variants[2]); HK.FIT.on = false;
      const fits = A.fitIssues('crest');
      check(P + 'numbers sit in fields reserved from their widest value: the crest lays out the same for 9 / 110, 999,999 coins and level 99, and a machine at 999 / 999 — and those widest values fit its banner', same && fits.length === 0, { metrics: ms, fits });
    }
  } finally { restoreWorld(); }
});
