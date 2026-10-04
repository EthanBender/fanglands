// ============================================================================
// THE MOUNTS IN THE NEW LOOK — the machines the knight drives, drawn with the monster refit's own machine art
// (owner: "make sure that the mounts are the updated graphic too"). Cinder the mare draws herself in 51-mounts.
// The walker, the bulldozer and the Barrelbeast are the same machines the goblins drive (78-monsterart's walker,
// bulldozer and barrelbeast, through 78-monsterlook's paint: its size, its cracks), so a knight's walker looks just like
// the camp's. 78-monsterlook.js is never changed here: its MONSTER_LOOK.drawMachine takes a pilot for the goblin's seat,
// and this file sits the knight there (82-knightgear, seated: no legs), in the drawing's own order, so the tub, the deck
// and the boiler go over him exactly as they went over the goblin; the Barrelbeast's two other goblins stay off. The
// goblin's green hands on the levers (mch_hand) are drawn through a thin stand-in for the canvas (handCtx) that turns
// them into the knight's hands (his gauntlets, or bare hands); a parked machine has nobody in it and no hands on its
// levers.
// What it draws:
//  - the knight's own machine (the player's draw item, after 22-bulldozer, 32-beast and the core put theirs there);
//  - a parked machine (T.MECH, T.DOZER, T.BEAST) with an empty seat, and a wreck (T.WRECK, T.DOZER_WRECK,
//    T.BEAST_WRECK) tipped over, dark and smoking;
//  - drawMech / drawDozer / the barrelbeast hook when called with a pilot or for a parked machine (the title screen's
//    goblin walker too: no pilot, not parked, the plain monster drawing);
//  - a friend online on a machine or on the mare (73-players calls MOUNT_LOOK.rider).
// The bulldozer's fitted upgrades (40-dozerup: the drill, the iron drill, the ram plate, the big boiler) are drawn on
// it in the same hand; a friend's are sent in presence (mech.up). A hit flashes the whole machine and the knight red,
// as a monster flashes: drawn on a picture of its own and coloured over.
// Pictures only, no rules: tools/build-sim.mjs strips this file from the server's copy.
// window.MOUNT_LOOK is the handle (and the test handle).
// ============================================================================
const MOUNT_LOOK = (() => {
  const LOOK = MONSTER_LOOK, ART = MONSTER_ART, SIZE = ART.MOB_SIZE;
  const ON = { on: true };
  const STATS = { machines: 0, seats: 0, hands: 0, handsHidden: 0, tinted: 0, riders: 0 };
  // the knight's machine kinds and the monster drawing each one wears
  const TYPE = { walker: 'walker', dozer: 'bulldozer', beast: 'barrelbeast' };
  const KINDS = Object.keys(TYPE);
  // a mech off the wire: { kind } with no kind (or 'walker') a walker, 'dozer', 'beast', 'horse'; anything else is no mount we draw
  const kindOf = mech => { if (!mech || typeof mech !== 'object') return null; const k = mech.kind; if (k === undefined || k === null || k === 'walker') return 'walker'; return k === 'horse' || (typeof k === 'string' && TYPE[k] && k !== 'walker') ? k : null; };
  const GOB = '#74bd46', TAU = Math.PI * 2;
  // the knight in a seat: game pixels per unit of his own drawing, and how far his middle sits under the goblin's
  // (in the goblin's own units: the goblin's chest is a little lower than the knight's middle)
  const SEAT = { walker: { s: 0.82, dy: 1.2 }, dozer: { s: 0.82, dy: 1.2 }, beast: { s: 0.8, dy: 1.6 } };
  // the knight's machines are drawn at the size of their own bodies: the goblins' walker (hit circle 24) carries the
  // knight's walker's 20, so his is drawn at 20/24 of it, and the same for the bulldozer (22 of 24) and the Barrelbeast
  // (26 of 36: the boss grew in the monster refit, the knight's did not). Every gate and wall he can ride past, his
  // machine is drawn the size that fits it.
  const OWN_R = { walker: 20, dozer: 22, beast: 26 };
  const KOF = kind => Math.min(1, OWN_R[kind] / ((LOOK.HIT_R && LOOK.HIT_R[TYPE[kind]]) || OWN_R[kind]));

  // ---------- small helpers, the sample's ----------
  const SH = new Map();
  function shade(c, f) {
    const k = c + '|' + f; let s = SH.get(k); if (s) return s;
    let h = /^#[0-9a-f]{6}$/i.test(c) ? c.slice(1) : '808080';
    const n = parseInt(h, 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; gg *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; }
    s = `rgb(${r | 0},${gg | 0},${b | 0})`; if (SH.size > 400) SH.clear(); SH.set(k, s); return s;
  }
  const OUT = 'rgba(22,14,8,0.62)';
  const ell = (g, x, y, rx, ry, rot) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); };
  const outline = (g, w) => { g.strokeStyle = OUT; g.lineWidth = w || 0.6; g.stroke(); };
  function vfill(g, c, y0, y1, hi, lo) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, shade(c, hi === undefined ? 0.3 : hi)); gr.addColorStop(0.55, c); gr.addColorStop(1, shade(c, lo === undefined ? -0.3 : lo)); return gr; }
  function rivets(g, pts, r) { for (const [x, y] of pts) { ell(g, x, y, r, r); g.fillStyle = '#c9ccd3'; g.fill(); ell(g, x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.4); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill(); } }
  const face4 = f => { const fx = f.x, fy = f.y; if (fy < -0.55) return 'up'; if (fy > 0.55) return 'down'; return fx < 0 ? 'left' : 'right'; };

  // ---------- the knight's hands: 82-knightgear's own rule (a gauntlet in plate, mail-brown in chain, else his skin) ----------
  function handColour(look) {
    const B = window.KNIGHTGEAR && look ? KNIGHTGEAR.partsOf(look).body : null, fam = B && B.fam;
    if ((fam === 'plate' || fam === 'hover') && /^#[0-9a-f]{6}$/i.test(B.color)) return shade(B.color, -0.15);
    if (fam === 'chain') return '#6b4a2e';
    return look && /^#[0-9a-f]{6}$/i.test(look.skin || '') ? look.skin : '#e8b790';
  }

  // ---------- the lever hands: a stand-in for the canvas that gives the goblin's green hands to the knight ----------
  // hand: the colour the hands take, or null to leave them off (nobody aboard). The drawing paints a hand as a radial
  // gradient of the goblin's skin (its middle stop exactly GOB) filled and then outlined; the gradient's stops wait until
  // it is used, and then a hand's three greens become the knight's (or that fill and its outline are left out).
  function handCtx(real, hand) {
    let handPend = 0;
    const pend = new Map();
    const flush = v => {
      const p = v && typeof v === 'object' ? pend.get(v) : null; if (!p) return;
      pend.delete(v);
      if (p.stops.some(([o, c]) => o === 0.6 && c === GOB)) {
        if (hand) { STATS.hands++; p.add(0, shade(hand, 0.35)); p.add(0.6, hand); p.add(1, shade(hand, -0.35)); }
        else { STATS.handsHidden++; for (const [o, c] of p.stops) p.add(o, c); handPend = 2; }
        return;
      }
      for (const [o, c] of p.stops) p.add(o, c);
    };
    const fns = new Map();
    return new Proxy({}, {
      get(t, k) {
        if (k === '__real') return real;
        const v = real[k];
        if (typeof v !== 'function') return v;
        let f = fns.get(k); if (f) return f;
        f = function () {
          const a = arguments;
          if (handPend && k === 'fill' && handPend === 2) { handPend = 1; return undefined; }
          if (handPend && k === 'stroke' && handPend === 1) { handPend = 0; return undefined; }
          if (k === 'createRadialGradient') {
            const gr = real.createRadialGradient(a[0], a[1], a[2], a[3], a[4], a[5]);
            if (gr && typeof gr.addColorStop === 'function') { const add = gr.addColorStop.bind(gr), stops = []; gr.addColorStop = (o, c) => { stops.push([o, c]); }; pend.set(gr, { stops, add }); }
            return gr;
          }
          return v.apply(real, a);
        };
        fns.set(k, f); return f;
      },
      set(t, k, v) { if (k === 'fillStyle' || k === 'strokeStyle') flush(v); real[k] = v; return true; },
    });
  }

  // ---------- the view the monster drawing reads (78-monsterart's `e`) ----------
  function viewOf(e, type, o) {
    let fx = e.facing ? +e.facing.x || 0 : 0, fy = e.facing ? +e.facing.y || 0 : 1;
    const L = Math.hypot(fx, fy); if (L < 1e-6) { fx = 0; fy = 1; } else { fx /= L; fy /= L; }
    const a = +e.attackT || 0;
    return { type, facing: { x: fx, y: fy }, moving: !!e.moving || !!o.charging, walkT: +e.walkT || 0, attackT: a > 0 ? Math.min(0.22, a) : 0, hurtT: 0, seed: o.seed || 0,
      state: 'idle', stunT: 0, hp: o.hp === undefined ? 1 : +o.hp, maxHp: o.maxHp === undefined ? 1 : +o.maxHp, unarmed: false, rodGlow: o.rodGlow || 0, chargeT: o.charging ? 1 : 0 };
  }
  // the knight's seat, MONSTER_LOOK.drawMachine's pilot(g, x, y, s, back, fx): where the goblin sat at scale s. He faces the
  // way the machine does (the drawing has already turned its own frame for left). k0: the machine's own size (KOF); the
  // knight shrinks with it only by its square root, so he still reads as himself.
  function seatFor(look, kind, k0) {
    const S = SEAT[kind], type = TYPE[kind];
    return (gp, x, y, s, back, fx) => {
      // the knight is drawn on the real canvas (the hand stand-in has nothing to do for him)
      // the side view seats its goblin with fx exactly 1 (its frame already turned for left); the front view with the facing's x
      const g = gp.__real || gp, facing = back ? { x: 0, y: -1 } : fx === 1 ? { x: 1, y: 0 } : { x: 0, y: 1 };
      const k = S.s / ((SIZE[type] || 1) * Math.sqrt(k0 || 1));
      g.save(); g.translate(x, y); g.scale(s, s); g.translate(0, S.dy); g.scale(k / s, k / s);
      try { drawHuman(g, { facing, hurtT: 0, attackT: 0, moving: false, walkT: 0, seated: true }, look); STATS.seats++; } finally { g.restore(); }
    };
  }

  // ---------- the bulldozer's upgrades, in the drawing's own units and frame ----------
  function dozerUpgrades(g, v, up) {
    const f = face4(v.facing), sw = v.attackT > 0 ? 1 - v.attackT / 0.22 : -1, hit = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    const spin = v.moving ? (v.walkT * 3) % 1 : 0;
    g.save(); g.scale(SIZE.bulldozer, SIZE.bulldozer); if (f === 'left') g.scale(-1, 1);
    if (f === 'left' || f === 'right') {
      const L = hit * 4.5 + hit * 1.6;
      if (up.boiler) {
        // the big boiler: a fatter drum over the old one, three brass bands and a pressure dial
        g.beginPath(); g.moveTo(-15, -13); g.arcTo(-5.2, -15, -5.2, -1, 2.6); g.arcTo(-5.2, -0.4, -15, -0.4, 2.2); g.arcTo(-15.6, -0.4, -15.6, -13, 2.2); g.arcTo(-15.6, -15, -5.2, -15, 2.6); g.closePath();
        const gr = g.createLinearGradient(-15.6, 0, -5.2, 0); gr.addColorStop(0, '#3e3e46'); gr.addColorStop(0.3, '#7d7d88'); gr.addColorStop(0.62, '#4e4e58'); gr.addColorStop(1, '#2a2a30'); g.fillStyle = gr; g.fill(); outline(g, 0.55);
        for (const y of [-12, -7.6, -3.2]) { g.fillStyle = '#c9a02a'; g.fillRect(-15.6, y, 10.4, 1); }
        rivets(g, [[-14.4, -13.8], [-6.4, -13.8], [-14.4, -1.6], [-6.4, -1.6]], 0.3);
        ell(g, -10.4, -9.8, 1.6, 1.6); g.fillStyle = '#efe8d0'; g.fill(); outline(g, 0.35);
        g.strokeStyle = '#c0392b'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-10.4, -9.8); g.lineTo(-10.4 + Math.cos(time * 3) * 1.2, -9.8 + Math.sin(time * 3) * 1.2); g.stroke();
      }
      g.translate(L, 0);
      if (up.ram) {
        // the ram plate: a thick riveted slab bolted over the blade's face, a spike top and bottom
        g.beginPath(); g.moveTo(15.4, -10.6); g.quadraticCurveTo(13.6, 0.6, 15.8, 10.2); g.lineTo(18.8, 10.4); g.quadraticCurveTo(16.6, 0.8, 18.4, -10.8); g.closePath();
        g.fillStyle = vfill(g, '#3a3a44', -11, 11, 0.25, -0.3); g.fill(); outline(g, 0.5);
        rivets(g, [[16.2, -7.4], [15.6, -1], [16.1, 5.6]], 0.34);
        for (const [y, d] of [[-9.6, -1], [9.2, 1]]) { g.beginPath(); g.moveTo(17.6, y - 1.2); g.lineTo(22.4, y + d * 1.8); g.lineTo(17.8, y + 1.2); g.closePath(); g.fillStyle = vfill(g, '#c9ccd3', y - 1.2, y + 1.8, 0.35, -0.2); g.fill(); outline(g, 0.35); }
      }
      if (up.drill) {
        // the drill: a cone on the blade's nose, its turns running as it rolls; the iron one bright, with teeth
        const iron = !!up.irondrill, x0 = up.ram ? 18.6 : 17, c = iron ? '#d5d9e0' : '#7a7d86';
        g.beginPath(); g.moveTo(x0, -3.4); g.lineTo(x0 + 8.6, 0); g.lineTo(x0, 3.4); g.closePath(); g.fillStyle = vfill(g, c, -3.4, 3.4, 0.4, -0.35); g.fill(); outline(g, 0.5);
        g.save(); g.beginPath(); g.moveTo(x0, -3.4); g.lineTo(x0 + 8.6, 0); g.lineTo(x0, 3.4); g.closePath(); g.clip();
        g.strokeStyle = iron ? '#5a5a62' : '#2e2e36'; g.lineWidth = 0.5;
        for (let k = 0; k < 4; k++) { const px = x0 + ((k + spin) / 4) * 8.6; g.beginPath(); g.moveTo(px, -3.6); g.lineTo(px + 1.8, 3.6); g.stroke(); }
        g.restore();
        if (iron) rivets(g, [[x0 + 2.4, -1.6], [x0 + 2.4, 1.6], [x0 + 5, 0]], 0.32);
        g.fillStyle = '#3a3a42'; g.fillRect(x0 - 1.2, -2, 1.4, 4);
      }
    } else if (f === 'down') {
      g.translate(0, hit * 2.4);
      if (up.ram) {
        g.fillStyle = vfill(g, '#3a3a44', -1, 4, 0.25, -0.3); g.fillRect(-14.4, -0.2, 28.8, 3.6); g.strokeStyle = OUT; g.lineWidth = 0.4; g.strokeRect(-14.4, -0.2, 28.8, 3.6);
        rivets(g, [[-11, 1.6], [-4, 1.6], [4, 1.6], [11, 1.6]], 0.34);
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 13, -0.2); g.lineTo(s * 16.4, 1.6); g.lineTo(s * 13, 3.4); g.closePath(); g.fillStyle = '#c9ccd3'; g.fill(); outline(g, 0.35); }
      }
      if (up.drill) {
        const iron = !!up.irondrill, c = iron ? '#d5d9e0' : '#7a7d86', y = 3.4;
        ell(g, 0, y, 4.2, 4.2); g.fillStyle = vfill(g, c, y - 4, y + 4, 0.4, -0.35); g.fill(); outline(g, 0.5);
        g.strokeStyle = iron ? '#5a5a62' : '#2e2e36'; g.lineWidth = 0.5; g.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * TAU * 2 + spin * TAU, r = 4 * (1 - k / 24); if (k) g.lineTo(Math.cos(a) * r, y + Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, y + Math.sin(a) * r); } g.stroke();
        ell(g, 0, y, 0.8, 0.8); g.fillStyle = iron ? '#ffffff' : '#c9ccd3'; g.fill();
      }
    } else if (up.boiler) {
      // from behind: the big boiler's drum stands taller over the old one
      g.beginPath(); g.moveTo(0.6, -14.6); g.lineTo(10.6, -14.6); g.lineTo(10.6, 2.2); g.lineTo(0.6, 2.2); g.closePath();
      const gr = g.createLinearGradient(0.6, 0, 10.6, 0); gr.addColorStop(0, '#3e3e46'); gr.addColorStop(0.3, '#7d7d88'); gr.addColorStop(0.62, '#4e4e58'); gr.addColorStop(1, '#2a2a30'); g.fillStyle = gr; g.fill(); outline(g, 0.55);
      for (const y of [-11.8, -6, -0.4]) { g.fillStyle = '#c9a02a'; g.fillRect(0.6, y, 10, 1); }
      ell(g, 5.6, -2.6, 2.6, 2.4); g.fillStyle = '#2a2420'; g.fill(); outline(g, 0.45);
      const fl = 0.6 + Math.sin(time * 8) * 0.25; g.fillStyle = `rgba(255,${150 + fl * 60 | 0},60,${fl.toFixed(3)})`; ell(g, 5.6, -2.4, 1.8, 1.6); g.fill();
    }
    g.restore();
  }

  // ---------- one machine ----------
  // machine(g, e, kind, o): kind 'walker' | 'dozer' | 'beast', drawn at the origin of g (the machine's middle).
  // o: { pilot: a knight's look or null, parked: nobody aboard, hurt, wreck, hp, maxHp, rodGlow, charging, up, seed }
  // No pilot and not parked: the goblins' own drawing, untouched (the title screen's walker).
  const HURT = 'rgba(255,90,90,0.45)', WRECK = 'rgba(34,26,20,0.5)';
  function paintMachine(g, kind, v, o) {
    const type = TYPE[kind];
    const seated = !!o.pilot || !!o.parked;
    const k = o.k || 1;
    g.save(); if (k !== 1) g.scale(k, k);
    try {
      if (seated) LOOK.drawMachine(handCtx(g, o.pilot ? handColour(o.pilot) : null), v, type, o.pilot ? seatFor(o.pilot, kind, k) : null);
      else LOOK.paint(g, v, type, null, null);
      if (kind === 'dozer' && o.up && (o.up.drill || o.up.ram || o.up.boiler)) dozerUpgrades(g, v, o.up);
    } finally { g.restore(); }
  }
  let scratch = null;
  function tinted(g, kind, v, o, col) {
    if (typeof document === 'undefined' || !document.createElement) return false;
    const kk = o.k || 1, b = LOOK.boxOf(TYPE[kind], true).map(x => x * kk), ss = Math.max(1, Math.min(2, typeof DPR === 'number' && DPR > 0 ? DPR : 1));
    const x0 = b[0] - 12, y0 = b[1] - 12, w = b[2] - b[0] + 24 + (kind === 'dozer' ? 30 : 0), h = b[3] - b[1] + 24;
    const W = Math.ceil(w * ss), Hh = Math.ceil(h * ss);
    if (!scratch || scratch.c.width < W || scratch.c.height < Hh) { const c = document.createElement('canvas'); c.width = Math.max(W, scratch ? scratch.c.width : 0); c.height = Math.max(Hh, scratch ? scratch.c.height : 0); const cg = c.getContext && c.getContext('2d'); if (!cg) return false; scratch = { c, cg }; }
    const cg = scratch.cg;
    cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, scratch.c.width, scratch.c.height);
    // a dozer facing left carries its drill on its left: the picture reaches as far that way
    const ox = kind === 'dozer' && face4(v.facing) === 'left' ? -30 : 0;
    cg.setTransform(ss, 0, 0, ss, (-x0 - ox) * ss, -y0 * ss); paintMachine(cg, kind, v, o);
    cg.save(); cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = col; cg.fillRect(0, 0, W, Hh); cg.restore();
    g.drawImage(scratch.c, 0, 0, W, Hh, x0 + ox, y0, w, h);
    STATS.tinted++;
    return true;
  }
  function machine(g, e, kind, o) {
    o = Object.assign({ k: KOF(kind) }, o || {});
    if (!TYPE[kind]) return false;
    STATS.machines++;
    const v = viewOf(e, TYPE[kind], o);
    if (o.wreck) {
      // tipped over on its side about where it stands, dark, smoke still coming off it
      const foot = 11.4 * (SIZE[TYPE[kind]] || 1) * o.k;
      g.save(); g.translate(0, foot); g.rotate(0.32); g.translate(0, -foot);
      if (!(g === ctx && tinted(g, kind, v, o, WRECK))) { g.globalAlpha *= 0.8; paintMachine(g, kind, v, o); }
      g.restore();
      for (let k = 0; k < 3; k++) { const ph = (time * 0.5 + k / 3 + (o.seed || 0)) % 1; g.fillStyle = `rgba(70,70,78,${(0.5 * (1 - ph)).toFixed(3)})`; ell(g, -8 + Math.sin(time * 1.6 + k * 2) * 4, -24 - ph * 30, 5 + ph * 7, 5 + ph * 7); g.fill(); }
      return true;
    }
    if (o.hurt && g === ctx && tinted(g, kind, v, o, HURT)) return true;
    paintMachine(g, kind, v, o);
    return true;
  }

  // ---------- where things sit on a machine ----------
  // the top of a machine's drawing over its middle (for a name over a friend), and its roof: where 55-riding's special
  // beacon stands (on the boiler's cap), in game pixels from the middle, for the way it faces
  const ROOF = { walker: { side: [-7.4, -17.4], down: [-6.6, -20.2], up: [6.4, -18.2] }, dozer: { side: [-9.6, -14.2], down: [-5.4, -16.2], up: [5.6, -14] },
    beast: { side: [-6, -24], down: [-8, -25], up: [8, -25] } };
  function roof(kind, facing) {
    const r = ROOF[kind]; if (!r) return null;
    const f = face4(facing || { x: 1, y: 0 }), k = (SIZE[TYPE[kind]] || 1) * KOF(kind), p = f === 'down' ? r.down : f === 'up' ? r.up : r.side;
    return { x: (f === 'left' ? -p[0] : p[0]) * k, y: p[1] * k };
  }
  function top(kind) {
    if (kind === 'horse') return 50;
    const b = TYPE[kind] && LOOK.boxOf(TYPE[kind], false);
    // the box reaches up into the chimney smoke; a name sits over the machine and its knight, under the smoke
    return b ? Math.round(-b[1] * 0.8 * KOF(kind)) : 46;
  }

  // ---------- a friend online on a mount (73-players) ----------
  // e: the remote knight (shown.x / shown.y are where he is drawn; g is already moved there), look: his look, as: the
  // kind to draw (73 passes 'walker' for a kind this page does not know)
  const UPS = ['drill', 'irondrill', 'ram', 'boiler'];
  function upsOf(s) { const o = {}; if (typeof s === 'string') for (const k of s.split(',')) if (UPS.includes(k)) o[k] = true; return o; }
  function rider(g, e, look, as) {
    const kind = as || kindOf(e.mech);
    if (!kind) return false;
    STATS.riders++;
    const ent = { facing: e.facing, moving: e.moving, walkT: e.walkT, attackT: e.attackT || 0, hurtT: e.hurtT || 0 };
    if (kind === 'horse') { if (!window.MOUNTS || !MOUNTS.drawHorse) return false; MOUNTS.drawHorse(g, ent, e.hurtT > 0, look); return true; }
    const m = e.mech, hp = Number.isFinite(m.hp) ? m.hp : 1, mx = Number.isFinite(m.maxHp) && m.maxHp > 0 ? m.maxHp : Math.max(1, hp);
    return machine(g, ent, kind, { pilot: look, hurt: e.hurtT > 0, hp, maxHp: mx, up: kind === 'dozer' ? upsOf(m.up) : null, seed: (e.n ? e.n.length : 0) * 0.7 });
  }

  // ---------- the knight's own machine: the player's draw item becomes the new machine ----------
  const myKind = () => player.mech && player.mech.kind !== 'horse' ? (player.mech.kind || 'walker') : null;
  function drawMine(g) {
    const kind = myKind(); if (!kind) return;
    const m = player.mech, charging = !!(window.RIDING && RIDING.special);
    g.save(); g.translate(player.x, player.y);
    try {
      machine(g, player, kind, { pilot: playerLook(), hurt: player.hurtT > 0, hp: m.hp, maxHp: m.maxHp, charging, up: kind === 'dozer' ? player.dozerUp : null, seed: 0.4 });
    } finally { g.restore(); }
  }
  HOOKS.draw.push((g, items) => {
    if (!ON.on || player.dead || !myKind()) return;
    // the core's item (y + r) and the one 22 / 32 push when they could not find it (y + r + 1): the first is the machine
    let first = true;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.who !== undefined || (it.y !== player.y + player.r && it.y !== player.y + player.r + 1)) continue;
      if (first) { it.draw = () => drawMine(g); first = false; } else it.draw = () => { };
    }
    if (first) items.push({ y: player.y + player.r, draw: () => drawMine(g) });
  });

  // ---------- the old entry points, for every other caller ----------
  const TITLE_K = 0.6;
  // drawMech(g, e, hurt, pilot): the walker (the title screen's, a parked one, a knight in it)
  { const _drawMech = drawMech;
    drawMech = function (g, e, hurt, pilot) {
      if (!ON.on || !e) return _drawMech(g, e, hurt, pilot);
      // no pilot and nobody parked it: the title screen's goblin walker (monsters are drawn by 78-monsterlook, never here).
      // The title has room for the old walker, so the new one stands there at that size, its feet on the title's shadow
      if (!pilot && !e.parked) {
        const v = viewOf(e, 'walker', {});
        g.save(); g.translate(0, 22); g.scale(TITLE_K, TITLE_K); g.translate(0, -22);
        try { if (!(hurt && g === ctx && tinted(g, 'walker', v, { k: 1 }, HURT))) LOOK.paint(g, v, 'walker', null, null); } finally { g.restore(); }
        return;
      }
      machine(g, e, 'walker', { pilot: pilot || null, parked: !pilot, hurt });
    }; }
  if (typeof drawDozer === 'function') {
    const _drawDozer = drawDozer;
    drawDozer = function (g, e, hurt, pilot, up) {
      if (!ON.on || !e || (!pilot && !e.parked)) return _drawDozer(g, e, hurt, pilot, up);
      machine(g, e, 'dozer', { pilot: pilot || null, parked: !pilot, hurt, up: pilot ? up : null });
    };
  }
  if (HOOKS.drawMonster.barrelbeast) {
    const _beast = HOOKS.drawMonster.barrelbeast;
    HOOKS.drawMonster.barrelbeast = function (g, e, hurt, pilot) {
      if (!ON.on || !e || (!pilot && !e.parked)) return _beast(g, e, hurt, pilot);
      machine(g, e, 'beast', { pilot: pilot || null, parked: !pilot, hurt, hp: e.hp, maxHp: e.maxHp, rodGlow: e.rodGlow });
    };
  }

  // ---------- parked machines and wrecks on the map ----------
  // a parked walker faces us, a parked bulldozer and Barrelbeast face away (as the old drawings stood them)
  const parkedOf = (cx, cy, fx, fy) => ({ x: cx, y: cy, facing: { x: fx, y: fy }, moving: false, walkT: 0, attackT: 0, hurtT: 0, parked: true });
  function drawParked(g, tx, ty, kind, wreck, fy, hp, maxHp) {
    const cx = tc(tx), cy = tc(ty);
    g.save(); g.translate(cx, cy);
    try { machine(g, parkedOf(cx, cy, 0, fy), kind, { parked: true, wreck, hp, maxHp, seed: (tx * 7 + ty * 13) % 10 / 10 }); } finally { g.restore(); }
  }
  { const _drawFurniture = drawFurniture;
    drawFurniture = function (g, tx, ty, t) {
      if (ON.on && (t === T.MECH || t === T.WRECK)) { drawParked(g, tx, ty, 'walker', t === T.WRECK, 1); return; }
      return _drawFurniture(g, tx, ty, t);
    }; }
  if (typeof drawDozerTile === 'function') {
    const _tile = drawDozerTile;
    drawDozerTile = function (g, tx, ty, t) {
      if (!ON.on) return _tile(g, tx, ty, t);
      drawParked(g, tx, ty, 'dozer', t === T.DOZER_WRECK, -1);
    };
  }
  if (window.BEAST) {
    const _tile = BEAST.drawTile;
    BEAST.drawTile = function (g, tx, ty, t) {
      if (!ON.on && _tile) return _tile(g, tx, ty, t);
      const wreck = t === BEAST.tiles.BEAST_WRECK;
      drawParked(g, tx, ty, 'beast', wreck, -1, wreck ? 0 : 1, 1);
    };
  }

  // ---------- a gate stands open while a rider is in it ----------
  // A rider goes through a gate (00-core: 'rider' passes T.GATE), so a gate he is in or about to go through is drawn
  // with its two leaves swung back against its posts, not shut across him. The town's own gates are 95-thistledown's
  // gatehouses (it draws no wooden gate there at all); this is every other gate: the pens, the Grubmarket wall, the bone fence.
  function riderAt(tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    if (!player.dead && player.mech && dist(player.x, player.y, cx, cy) < player.r + 34) return true;
    if (window.PLAYERS && PLAYERS.remote && typeof PLAYERS.mapId === 'function') {
      const my = PLAYERS.mapId();
      for (const n in PLAYERS.remote) { const e = PLAYERS.remote[n]; if (e && e.mech && !e.dead && e.map === my && e.shown && dist(e.shown.x, e.shown.y, cx, cy) < 54) return true; }
    }
    return false;
  }
  function drawOpenGate(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, Hf = t => t === T.FENCE || t === T.GATE;
    const h = Hf(tileAt(tx - 1, ty)) || Hf(tileAt(tx + 1, ty)), v = Hf(tileAt(tx, ty - 1)) || Hf(tileAt(tx, ty + 1));
    const leaf = (lx, ly, w, hh) => { g.fillStyle = '#a58455'; g.fillRect(lx, ly, w, hh); g.fillStyle = 'rgba(60,40,20,0.35)'; if (w > hh) g.fillRect(lx, ly + hh - 1, w, 1); else g.fillRect(lx + w - 1, ly, 1, hh); };
    if (h || !v) {
      // across a fence that runs left and right: the way through is up and down, the leaves fold back along it
      g.fillStyle = '#8a6a3a'; g.fillRect(x, y + 18, 5, 17); g.fillRect(x + TILE - 5, y + 18, 5, 17);
      leaf(x + 2, y + 2, 4, 18); leaf(x + TILE - 6, y + 2, 4, 18);
      g.fillStyle = '#6b4a2a'; g.fillRect(x, y + 14, 6, 6); g.fillRect(x + TILE - 6, y + 14, 6, 6);
    } else {
      // across a fence that runs up and down: the leaves fold back along the way through, left to right
      g.fillStyle = '#8a6a3a'; g.fillRect(x + 21, y, 5, 5); g.fillRect(x + 21, y + TILE - 5, 5, 5);
      leaf(x + 26, y + 3, 18, 4); leaf(x + 26, y + TILE - 7, 18, 4);
      g.fillStyle = '#6b4a2a'; g.fillRect(x + 20, y, 7, 6); g.fillRect(x + 20, y + TILE - 6, 7, 6);
    }
  }
  { const _drawFenceProp = drawFenceProp;
    drawFenceProp = function (g, tx, ty, gate) {
      if (gate && ON.on && !window.__instance && riderAt(tx, ty)) { drawOpenGate(g, tx, ty); return; }
      return _drawFenceProp(g, tx, ty, gate);
    }; }

  // ---------- 51's mare, 55's beacon and coach, a friend's name: what they read ----------
  window.MOUNT_LOOK = { ON, STATS, TYPE, KINDS, SEAT, ROOF, kindOf, machine, rider, roof, top, handCtx, viewOf, riderAt, drawOpenGate, handColour, upsOf, dozerUpgrades };

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'mount look: ';
    // a context that writes down every call (the headless canvas is a stub), as 78-monsterlook's own checks do
    const recorder = () => {
      const log = []; let n = 0;
      const g = new Proxy({}, {
        get: (t, k) => {
          if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => { n++; const stops = []; log.push(k); return { stops, addColorStop: (o, c) => { stops.push([o, c]); log.push('stop:' + o + ':' + c); } }; };
          if (k === 'measureText') return () => ({ width: 10 });
          if (k in t) return t[k];
          if (typeof k !== 'string') return undefined;
          return (...a) => { n++; log.push(k + ':' + a.map(x => typeof x === 'number' ? Math.round(x * 10) / 10 : typeof x).join(',')); };
        },
        set: (t, k, v) => { t[k] = v; log.push('=' + String(k) + ':' + (typeof v === 'object' && v && v.stops ? 'grad(' + v.stops.map(s => s[1]).join(',') + ')' : v)); return true; },
      });
      return { g, log, get n() { return n; } };
    };
    const look = Object.assign({}, playerLook(), { skin: '#e8b790' });
    const FACES = { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, up: { x: 0, y: -1 } };
    const ent = (f, o) => Object.assign({ x: 0, y: 0, facing: f, moving: false, walkT: 0, attackT: 0, hurtT: 0 }, o || {});
    // goblin green actually painted: a fill made while the fill colour (or its gradient) is the goblin's skin
    const greens = log => { let n = 0, armed = false; for (const l of log) { if (l.startsWith('=fillStyle:')) armed = l.includes(GOB); else if (armed && l.startsWith('fill:')) { n++; armed = false; } } return n; };

    // MA1. every machine at all four facings: the new drawing (78-monsterlook's paint, counted by its STATS), the knight in
    // the seat (one seat taken, through drawHuman, no goblin green anywhere), the hands his colour; parked: nobody, no hands
    { const bad = [], by0 = Object.assign({}, LOOK.STATS.by);
      const kg0 = window.KNIGHTGEAR ? KNIGHTGEAR.STATS.live : 0;
      for (const kind of KINDS) for (const fname in FACES) {
        const s0 = STATS.seats, h0 = STATS.hands, hh0 = STATS.handsHidden;
        const r = recorder(); machine(r.g, ent(FACES[fname], { moving: fname === 'left' }), kind, { pilot: look, hp: 10, maxHp: 10 });
        const seats = STATS.seats - s0, hands = STATS.hands - h0, gob = greens(r.log);
        // facing away the drawings show no lever hands at all
        if (seats !== 1 || gob || (fname !== 'up' && hands < 1) || STATS.handsHidden !== hh0) bad.push({ kind, fname, seats, hands, gob });
        const p0 = STATS.seats, ph0 = STATS.handsHidden;
        const r2 = recorder(); machine(r2.g, ent(FACES[fname]), kind, { parked: true });
        const pSeats = STATS.seats - p0, hid = STATS.handsHidden - ph0, gob2 = greens(r2.log);
        if (pSeats !== 0 || (fname !== 'up' && hid < 1) || gob2) bad.push({ parked: kind, fname, pSeats, hid, gob2 });
      }
      const drew = KINDS.every(k => (LOOK.STATS.by[TYPE[k]] || 0) >= (by0[TYPE[k]] || 0) + 8);
      const knight = !window.KNIGHTGEAR || KNIGHTGEAR.STATS.live >= kg0 + 12;
      check(P + 'MA1 the walker, the bulldozer and the Barrelbeast draw in the monster refit\'s machine art at all four facings: driven, the knight takes the one seat (the Barrelbeast\'s two other goblins stay off) with his own hands on the levers and no goblin green; parked, every seat and lever is empty',
        !bad.length && drew && knight, { bad: bad.slice(0, 6), drew, knight }); }

    // MA2. the old entry points and the knight's own draw item: drawMech / drawDozer / the barrelbeast hook with a pilot,
    // and the player's machine in the world's draw list, all draw the new machine; the title's goblin walker stays a goblin's
    { const m0 = STATS.machines, by0 = LOOK.STATS.by.walker || 0;
      const r1 = recorder(); drawMech(r1.g, ent(FACES.down), false, look);
      const r2 = recorder(); drawDozer(r2.g, ent(FACES.right), false, look, { drill: true, ram: true, boiler: true });
      const r3 = recorder(); HOOKS.drawMonster.barrelbeast(r3.g, ent(FACES.up, { hp: 300, maxHp: 300 }), false, look);
      const viaEntry = STATS.machines - m0 === 3;
      const s0 = STATS.seats; const r4 = recorder(); drawMech(r4.g, ent(FACES.left), false, null);
      const goblin = STATS.seats === s0 && (LOOK.STATS.by.walker || 0) >= by0 + 2 && greens(r4.log) > 0;
      // the knight's own walker in the world's draw list
      const mech0 = player.mech, r0 = player.r;
      player.mech = { hp: 100, maxHp: 130 }; player.r = 20; player.dead = false;
      const items = []; items.push({ y: player.y + player.r, draw: () => { } });
      for (const hk of HOOKS.draw) { try { hk(ctx, items, cam); } catch (err) { } }
      const mine = items.filter(it => it.y === player.y + player.r || it.y === player.y + player.r + 1);
      const m1 = STATS.machines; for (const it of mine) it.draw(); const once = STATS.machines - m1 === 1;
      player.mech = { kind: 'dozer', hp: 100, maxHp: 110 }; player.r = 22;
      const items2 = [{ y: player.y + player.r, draw: () => { } }]; for (const hk of HOOKS.draw) { try { hk(ctx, items2, cam); } catch (err) { } }
      const m2 = STATS.machines; for (const it of items2) if (it.y === player.y + player.r || it.y === player.y + player.r + 1) it.draw(); const dozerOnce = STATS.machines - m2 === 1;
      player.mech = mech0; player.r = r0;
      check(P + 'MA2 drawMech, drawDozer and the barrelbeast hook with the knight aboard draw the new machines, the knight\'s own walker and bulldozer in the world are drawn once each as the new machine, and the title\'s goblin walker keeps its goblin',
        viaEntry && goblin && once && dozerOnce, { viaEntry, goblin, once, dozerOnce, mine: mine.length }); }

    // MA3. the bulldozer's upgrades show on it at every facing that can see them (the drill and ram from the side and the
    // front, the big boiler from the side and behind), mirrored with it facing left
    { const bad = [];
      for (const fname in FACES) {
        const plain = recorder(), all = recorder();
        machine(plain.g, ent(FACES[fname]), 'dozer', { pilot: look });
        machine(all.g, ent(FACES[fname]), 'dozer', { pilot: look, up: { drill: true, irondrill: true, ram: true, boiler: true } });
        if (all.n <= plain.n + 20) bad.push({ fname, plain: plain.n, all: all.n });
      }
      const up = upsOf('drill,ram,boiler,nonsense'), none = upsOf(42);
      check(P + 'MA3 a bulldozer\'s fitted drill, ram plate and big boiler are drawn on the new bulldozer at all four facings, and a friend\'s list of them is read safely (unknown words and junk ignored)',
        !bad.length && up.drill && up.ram && up.boiler && !up.nonsense && !Object.keys(none).length, { bad, up, none }); }

    // MA4. parked machines and wrecks on the map: T.MECH, T.WRECK, T.DOZER, T.DOZER_WRECK, T.BEAST, T.BEAST_WRECK each draw
    // the new machine, empty; and the beacon's roof and a friend's name height come from the new drawings
    { const m0 = STATS.machines, s0 = STATS.seats, bad = [];
      const tiles = [[T.MECH, 'MECH'], [T.WRECK, 'WRECK'], [T.DOZER, 'DOZER'], [T.DOZER_WRECK, 'DOZER_WRECK'], [window.BEAST && BEAST.tiles.BEAST, 'BEAST'], [window.BEAST && BEAST.tiles.BEAST_WRECK, 'BEAST_WRECK']];
      for (const [t, name] of tiles) {
        if (t === undefined) { bad.push(name + ' missing'); continue; }
        const before = STATS.machines; const r = recorder();
        try { if (t === T.MECH || t === T.WRECK) drawFurniture(r.g, 10, 10, t); else if (t === T.DOZER || t === T.DOZER_WRECK) drawDozerTile(r.g, 10, 10, t); else BEAST.drawTile(r.g, 10, 10, t); } catch (err) { bad.push(name + ' threw ' + err.message); continue; }
        if (STATS.machines !== before + 1 || greens(r.log) > 0) bad.push(name);
      }
      const roofs = KINDS.every(k => Object.keys(FACES).every(f => { const p = roof(k, FACES[f]); return p && p.y < -30 && Math.abs(p.x) < 40; }));
      const tops = KINDS.every(k => top(k) > 40) && top('horse') > 40;
      check(P + 'MA4 a parked walker, bulldozer and Barrelbeast and their wrecks draw the new machine with nobody aboard; the special\'s beacon stands on each machine\'s boiler and a friend\'s name goes over the machine',
        !bad.length && STATS.seats === s0 && STATS.machines - m0 === 6 && roofs && tops, { bad, roofs, tops }); }

    // MA5. friends see riders: a friend's presence on the mare, the walker, the bulldozer (with its drill) and the
    // Barrelbeast, fed in as another knight online, is drawn on that mount with him aboard (not on foot), his name over
    // it; a mech kind this page does not know is drawn as the walker, as it always was
    if (window.PLAYERS && window.NET) {
      const name = 'MountLookTest', at = { x: Math.round(player.x + 90), y: Math.round(player.y) }, log = {}; let ok = true;
      const cases = [['horse', { kind: 'horse', hp: 60, maxHp: 60 }], ['walker', { kind: 'walker', hp: 90, maxHp: 130 }], ['dozer', { kind: 'dozer', hp: 110, maxHp: 110, up: 'drill,irondrill' }],
        ['beast', { kind: 'beast', hp: 200, maxHp: 300 }], ['unknown', { kind: 'zeppelin', hp: 5, maxHp: 5 }]];
      const horse0 = MOUNTS.drawHorse; let horses = 0;
      MOUNTS.drawHorse = function () { horses++; return horse0.apply(this, arguments); };
      try {
        for (const [label, mech] of cases) {
          NET.emit('p', { t: 'p', n: name, role: 'player', map: PLAYERS.mapId(), x: at.x, y: at.y, fx: 1, fy: 0, mv: true, wt: 2, hp: 20, mhp: 20, lv: 9, look: playerLook(), mech, dead: false, def: 100, act: null });
          F.step([]);
          const e = PLAYERS.remote[name];
          render();
          const r0 = STATS.riders, m0 = STATS.machines, s0 = STATS.seats, h0 = horses;
          let drew = true;
          try { const items = []; for (const hk of HOOKS.draw) hk(ctx, items, cam); for (const it of items) if (it.who === name) it.draw(); } catch (err) { drew = String(err && err.message); }
          const rode = STATS.riders - r0 === 1, aboard = label === 'horse' ? horses - h0 === 1 : STATS.machines - m0 === 1 && STATS.seats - s0 === 1;
          const tag = e && typeof e.tagTop === 'number' && e.tagTop < at.y - 40;
          log[label] = { drew, rode, aboard, tag: e && e.tagTop };
          if (!(drew === true && rode && aboard && tag)) ok = false;
        }
      } finally { MOUNTS.drawHorse = horse0; delete PLAYERS.remote[name]; }
      check(P + 'MA5 friends see riders: a friend on the mare, the walker, the bulldozer (its drill too) and the Barrelbeast is drawn riding it with himself aboard and his name over it; an unknown machine is drawn as the walker', ok, log);
    }

    // MA6. a gate stands open while a rider is in it, and shut otherwise (a pen gate; the town's gates are gatehouses)
    { let gate = null;
      for (let y = 1; y < MAP_H - 1 && !gate; y++) for (let x = 1; x < MAP_W - 1 && !gate; x++) if (tileAt(x, y) === T.GATE && !(x >= 84 && x <= 141 && y >= 13 && y <= 57)) gate = [x, y];
      let r = { gate };
      if (gate) {
        const keep = { x: player.x, y: player.y, mech: player.mech, r: player.r };
        const ops = () => { const rc = recorder(); drawFenceProp(rc.g, gate[0], gate[1], true); return rc.log.filter(l => l.startsWith('fillRect:')).map(l => l.slice(9)).join(' '); };
        player.mech = null; player.r = 13; player.x = tc(gate[0]); player.y = tc(gate[1]);
        const onFoot = ops();
        player.mech = { kind: 'horse', hp: 60, maxHp: 60 }; player.r = 16;
        const riding = ops();
        player.x = tc(gate[0] + 4); const away = ops();
        player.x = keep.x; player.y = keep.y; player.mech = keep.mech; player.r = keep.r;
        r = { gate, open: riding !== onFoot, shutAway: away === onFoot, onFoot: onFoot.slice(0, 40), riding: riding.slice(0, 40) };
      }
      check(P + 'MA6 a gate is drawn standing open while a rider is in it, and shut when he is on foot or gone', !!gate && r.open && r.shutAway, r); }
  });

  return window.MOUNT_LOOK;
})();
