// ============================================================================
// MONSTER ART — every monster's new look, the owner-approved sample (2026-10-03, "all approved"), drawn in the style of
// the approved knight (82-knightgear). This file is the sample's drawing code PORTED, NOT REDESIGNED: mobs-new.js (the
// helpers and the first 14) and the four groups (people, undead, machines, bosses: the other 33), byte for byte inside
// one closure, with only two mechanical changes: the review page's own clock (`let time = 0`) is gone so the drawings read
// the game's `time`, and every comment that trailed code now sits on its own line. The review page is
// https://claude.ai/artifact/MdLhCpWTGUDabEbHL3G5et; the sample lives in ~/.fanglands/work/mob-sample and this file is
// regenerated from it by ~/.fanglands/work/monsterlook/gen/make-art.py.
// The owner's binding calls are in the drawings: weapons upright with the hand at the waist, floating hands and no arms,
// in front facing us and behind facing away; animals seen from the side; spiders, birds, drakes and dragons from above
// with a shadow; the cow bigger than the boar and the sheep, the brute bigger, the ash drake almost the green dragon's
// size, the green dragon almost double, the bosses bigger still, and the Fang the biggest thing in the game.
// What a drawing reads from `e` (the sample's names; 78-monsterlook builds this view from the game's monster and from
// what a puppet's snapshot row carries): type, facing {x, y} (a unit vector), moving, walkT (the step's clock), attackT
// (0.22 counting down to 0: a swing's progress), hurtT, seed, plus one field per type for the states the game shows
// (phase, element, windT / stagT, heart / coldT, emberT, ally; see 78-monsterlook).
// Nothing here runs at load beyond defining the drawings: MONSTER_ART = { NEW_DRAW, MOB_SIZE, drawNewMob, H } where
// NEW_DRAW[type](g, e) draws one around the monster's middle (its feet on the ground line below it) at the sample's
// scale, MOB_SIZE[type] is that type's overall scale and drawNewMob(g, e) applies it. H holds the shared helpers for
// 78-monsterlook's state overlays, so what it adds is drawn with the same hand.
// ============================================================================
const MONSTER_ART = (() => {
  // ---------- mobs-new ----------
  // ================= NEW MONSTERS: drawn in the approved knight's style =================
  // helpers (the knight sample's)
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const OUT = 'rgba(22,14,8,0.62)';
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); }
  function outline(g, w) { g.strokeStyle = OUT; g.lineWidth = w || 0.8; g.stroke(); }
  function vfill(g, c, y0, y1, hi, lo) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, shade(c, hi === undefined ? 0.3 : hi)); gr.addColorStop(0.55, c); gr.addColorStop(1, shade(c, lo === undefined ? -0.3 : lo)); return gr; }
  function rfill(g, c, x, y, r) { const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1); gr.addColorStop(0, shade(c, 0.35)); gr.addColorStop(0.6, c); gr.addColorStop(1, shade(c, -0.35)); return gr; }
  function sparkle(g, x, y, s, col) { if (s <= 0) return; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.28, y - s * 0.28); g.lineTo(x + s, y); g.lineTo(x + s * 0.28, y + s * 0.28); g.lineTo(x, y + s); g.lineTo(x - s * 0.28, y + s * 0.28); g.lineTo(x - s, y); g.lineTo(x - s * 0.28, y - s * 0.28); g.closePath(); g.fill(); }
  function shadow(g, x, y, rx, ry, a) { g.fillStyle = `rgba(0,0,0,${a || 0.3})`; ell(g, x, y, rx, ry); g.fill(); }
  const face4 = e => { const fx = e.facing.x, fy = e.facing.y; if (fy < -0.55) return 'up'; if (fy > 0.55) return 'down'; return fx < 0 ? 'left' : 'right'; };
  const swingOf = e => e.attackT > 0 ? 1 - e.attackT / 0.22 : -1;
  const stepOf = e => e.moving ? Math.sin(e.walkT) : 0;
  const bobOf = (e, k) => e.moving ? -Math.abs(Math.sin(e.walkT)) * (k || 1.3) : Math.sin(time * 2.2 + (e.seed || 0)) * 0.3;
  function swoosh(g, cx, cy, ang, sw, rad) { if (sw < 0 || sw > 0.9) return; const a0 = ang - 1.4, a1 = ang + lerp(-1.4, 1.2, ease(sw)); g.save(); g.strokeStyle = `rgba(255,255,255,${0.42 * (1 - sw)})`; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, rad, a0, a1); g.stroke(); g.restore(); }
  const hurtTint = (g, e) => { if (e.hurtT > 0) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,90,90,0.45)'; g.fillRect(-60, -60, 120, 120); g.globalCompositeOperation = 'source-over'; } };

  // ---------- the walking figures: goblins, the skeleton, the zombie ----------
  // Same rules as the approved knight: no arms, floating hands; a weapon rests upright with the hand at the waist and is in
  // front facing us, behind facing away; legs step; a swing leaves a swoosh.
  function bipedLegs(g, step, o) {
    for (const s of [-1, 1]) {
      const off = step * 1.7 * s, x = s * (o.gap || 3.6), y = (o.hip || 5.5) + off;
      if (o.bone) {
        g.strokeStyle = OUT; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x + s * 0.3, y + 5); g.stroke();
        g.strokeStyle = o.c; g.lineWidth = 1.9; g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x + s * 0.3, y + 5); g.stroke();
        ell(g, x + s * 0.2, y + 1.6, 1.4, 1.2); g.fillStyle = shade(o.c, 0.15); g.fill(); outline(g, 0.4);
        ell(g, x + s * 0.5, y + 5.6, 2.2, 1.1); g.fillStyle = o.c; g.fill(); outline(g, 0.5);
        continue;
      }
      rr(g, x - 2.4, y - 2, 4.8, 6, 1.8); g.fillStyle = vfill(g, o.c, y - 2, y + 4); g.fill(); outline(g, 0.6);
      if (o.wrap) { g.strokeStyle = o.wrap; g.lineWidth = 0.7; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(x - 2.3, y - 0.4 + k * 1.8); g.lineTo(x + 2.3, y + 0.4 + k * 1.8); g.stroke(); } }
      if (o.tear) { g.fillStyle = o.skin; g.beginPath(); g.moveTo(x - 2.4, y + 2.6); g.lineTo(x - 1, y + 1.6); g.lineTo(x + 0.4, y + 3); g.lineTo(x + 2.4, y + 2); g.lineTo(x + 2.4, y + 4); g.lineTo(x - 2.4, y + 4); g.closePath(); g.fill(); }
      if (o.barefoot) {
        ell(g, x, y + 4.8, 2.8, 1.6); g.fillStyle = o.foot; g.fill(); outline(g, 0.5);
        g.fillStyle = shade(o.foot, -0.3); for (const t of [-1.6, -0.4, 0.8]) { ell(g, x + t, y + 5.9, 0.55, 0.45); g.fill(); }
      } else { rr(g, x - 2.8, y + 3.4, 5.6, 3, 1.4); g.fillStyle = o.boot || '#3a2a1c'; g.fill(); outline(g, 0.5); }
    }
  }
  function goblinEars(g, skin, back, flick) {
    for (const s of [-1, 1]) {
      const tip = s * (16.5 + (s > 0 ? flick : 0));
      g.beginPath(); g.moveTo(s * 5.5, -12.5); g.quadraticCurveTo(s * 11, -16.5, tip, -17 + Math.abs(flick) * 0.4); g.quadraticCurveTo(s * 11.5, -11.5, s * 6, -8.5); g.closePath();
      g.fillStyle = vfill(g, skin, -17, -8); g.fill(); outline(g, 0.7);
      if (!back) { g.beginPath(); g.moveTo(s * 7, -12); g.quadraticCurveTo(s * 11, -14.6, s * (tip > 0 ? tip - 3.5 : -(Math.abs(tip) - 3.5)), -15.6); g.quadraticCurveTo(s * 10.5, -12, s * 7.2, -10); g.closePath(); g.fillStyle = 'rgba(230,120,130,0.75)'; g.fill(); }
    }
  }
  function goblinHead(g, e, o, back, fx) {
    const hy = -10.5, r = 7.6, flick = e.moving ? Math.sin(e.walkT * 2) * 0.8 : Math.max(0, Math.sin(time * 1.7 + (e.seed || 0)) - 0.9) * 8;
    goblinEars(g, o.skin, back, flick);
    ell(g, 0, hy, r, r * 0.95); g.fillStyle = rfill(g, o.skin, 0, hy, r); g.fill(); outline(g, 0.9);
    if (!back) {
      const ex = fx * 1.6;
      g.fillStyle = shade(o.skin, -0.25); ell(g, ex, hy + 1.6, 1.4, 1.8); g.fill();
      for (const s of [-1, 1]) {
        ell(g, s * 2.9 + ex, hy - 0.6, 1.9, 1.5); g.fillStyle = '#f6e27a'; g.fill(); outline(g, 0.4);
        ell(g, s * 2.9 + ex + fx * 0.4, hy - 0.5, 0.8, 1); g.fillStyle = '#c0241f'; g.fill();
        g.strokeStyle = shade(o.skin, -0.55); g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * 1.2 + ex, hy - 2.4); g.lineTo(s * 4.6 + ex, hy - 3.3); g.stroke();
      }
      const swing = swingOf(e), open = swing >= 0 ? 1.4 : 0.5;
      g.beginPath(); g.moveTo(-3.6 + ex, hy + 3.3); g.quadraticCurveTo(ex, hy + 4.4 + open, 3.6 + ex, hy + 3.3); g.quadraticCurveTo(ex, hy + 3.8, -3.6 + ex, hy + 3.3); g.closePath(); g.fillStyle = '#3a1612'; g.fill();
      g.fillStyle = '#fbf6e8'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.9 + ex - 0.6, hy + 3.4); g.lineTo(s * 1.9 + ex, hy + 4.9 + (o.tusks ? 1 : 0)); g.lineTo(s * 1.9 + ex + 0.6, hy + 3.5); g.closePath(); g.fill(); }
      if (o.tusks) { g.fillStyle = '#efe6d0'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.2 + ex - 0.8, hy + 4); g.quadraticCurveTo(s * 3.6 + ex, hy + 1, s * 4.2 + ex + 0.4, hy + 0.6); g.lineTo(s * 3.6 + ex + 0.8, hy + 4); g.closePath(); g.fill(); outline(g, 0.35); } }
      if (o.scar) { g.strokeStyle = '#c96a6a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-5 + ex, hy - 3.6); g.lineTo(-2.4 + ex, hy + 0.8); g.moveTo(-4.4 + ex, hy - 2.4); g.lineTo(-3.4 + ex, hy - 2.8); g.moveTo(-3.6 + ex, hy - 0.8); g.lineTo(-2.6 + ex, hy - 1.2); g.stroke(); }
    }
    o.hat && o.hat(g, hy, r, back, fx);
  }
  function bipedHand(g, x, y, c) { ell(g, x, y, 2.1, 2.1); g.fillStyle = c; g.fill(); outline(g, 0.5); }
  // a weapon held at the waist, upright, or round the shoulder in a swing; drawWeapon(g) draws it pointing along +x from the hand
  function heldWeapon(e, sh, rest) {
    const sw = swingOf(e), back = face4(e) === 'up';
    const ang = Math.atan2(e.facing.y, Math.abs(e.facing.x) || 0.0001);
    let a, hx, hy;
    if (sw >= 0) { a = ang + lerp(-1.4, 1.2, ease(sw)); hx = sh.x + Math.cos(a) * 4.6; hy = sh.y + Math.sin(a) * 4.6; }
    else { a = rest.a + stepOf(e) * 0.08; hx = rest.x; hy = rest.y + stepOf(e) * 0.5; }
    return { a, hx, hy, sw, back, ang };
  }
  function drawBiped(g, e, P) {
    const f = face4(e), back = f === 'up', mirror = f === 'left', fx = mirror ? -e.facing.x : e.facing.x;
    const step = stepOf(e), bob = bobOf(e, P.bobK);
    const W = heldWeapon(e, P.shoulder || { x: 6.4, y: 0.6 }, P.rest || { a: -1.12, x: 10, y: 4.4 });
    g.save(); shadow(g, 0, 11.4 * P.s, 9.5 * P.s, 3.8 * P.s);
    g.scale(mirror ? -P.s : P.s, P.s);
    if (P.sway) g.rotate(Math.sin(e.walkT * 0.5) * (e.moving ? 0.06 : 0.02));
    const weapon = () => { g.save(); g.translate(W.hx, W.hy + bob); g.rotate(W.a); P.weapon(g, W.sw); g.restore(); };
    const hand = () => { if (P.weapon) bipedHand(g, W.hx, W.hy + bob, P.hand); };
    const off = () => { if (P.off) { g.save(); g.translate(-10.6, 3 + bob - step * 1.2); P.off(g, back); g.restore(); } else if (!P.reach) bipedHand(g, -10.2, 3.6 + bob - step * 1.2, P.hand); };
    if (back) { off(); if (P.weapon) { weapon(); hand(); } if (P.reach) P.reach(g, e, bob, true); }
    else if (P.backItem) P.backItem(g, bob);
    bipedLegs(g, step, P.legs);
    g.translate(0, bob);
    P.torso(g, back, e);
    if (!back) off();
    P.head(g, e, back, fx);
    g.translate(0, -bob);
    if (!back) { if (P.weapon) { weapon(); hand(); swoosh(g, 6.4, bob + 0.6, W.ang, W.sw, 26); } if (P.reach) P.reach(g, e, bob, false); }
    g.restore();
  }

  // --- the goblin soldier: a cleaver and a nailed buckler
  const GOB = '#74bd46';
  function goblinTorso(c, apron) {
    return (g, back) => {
      g.beginPath(); g.moveTo(-7, -3.5); g.quadraticCurveTo(-8.6, 2, -7, 7.6); g.lineTo(7, 7.6); g.quadraticCurveTo(8.6, 2, 7, -3.5); g.quadraticCurveTo(0, -5.6, -7, -3.5); g.closePath();
      g.fillStyle = vfill(g, c, -4, 8); g.fill(); outline(g, 0.8);
      g.strokeStyle = shade(c, -0.45); g.lineWidth = 0.5; g.beginPath(); g.moveTo(-7, 7.6); for (let x = -7; x <= 7; x += 2) g.lineTo(x + 1, 8.8 + ((x / 2) % 2 ? 0 : 0.6)); g.stroke();
      if (!back && !apron) { rr(g, 1.4, -1.6, 3.6, 3.2, 0.6); g.fillStyle = shade(c, 0.25); g.fill(); g.strokeStyle = 'rgba(40,24,10,0.7)'; g.lineWidth = 0.4; g.setLineDash([0.7, 0.6]); rr(g, 1.4, -1.6, 3.6, 3.2, 0.6); g.stroke(); g.setLineDash([]); }
      if (apron && !back) { g.beginPath(); g.moveTo(-4.5, -2.4); g.lineTo(4.5, -2.4); g.lineTo(5.6, 8.6); g.lineTo(-5.6, 8.6); g.closePath(); g.fillStyle = vfill(g, '#4a3420', -2, 9); g.fill(); outline(g, 0.6); g.fillStyle = 'rgba(20,16,14,0.55)'; ell(g, -2, 3, 1.6, 1.1); g.fill(); ell(g, 2.6, 6, 1.2, 0.8); g.fill(); }
      g.strokeStyle = '#c9a66b'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-7.4, 4.4); g.quadraticCurveTo(0, 5.8, 7.4, 4.4); g.stroke();
      if (!back) { g.beginPath(); g.moveTo(-1, 5.2); g.quadraticCurveTo(-1.6, 7.4, -0.8, 8.8); g.stroke(); }
    };
  }
  function drawCleaver(g, sw) {
    g.fillStyle = '#4a2e13'; g.fillRect(-3, -1.2, 6, 2.4); g.fillStyle = '#6b4a2a'; ell(g, -3.6, 0, 1.5, 1.5); g.fill();
    g.beginPath(); g.moveTo(3, -2.2); g.lineTo(20, -3.6); g.lineTo(22.5, -1); g.lineTo(21, 3.2); g.lineTo(3, 2.2); g.closePath(); g.fillStyle = vfill(g, '#a7a39a', -4, 3); g.fill(); outline(g, 0.6);
    g.fillStyle = '#7a4a24'; for (const [x, y, s] of [[9, 0.8, 1.2], [15, -1.2, 0.9], [18.6, 1.6, 0.8]]) { ell(g, x, y, s, s * 0.7); g.fill(); }
    g.fillStyle = '#5aa846'; g.beginPath(); g.moveTo(12, 3); g.lineTo(13, 1.6); g.lineTo(14, 3); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(4, -1.6); g.lineTo(19.6, -2.8); g.stroke();
  }
  function drawBuckler(g, back) {
    ell(g, 0, 0, 5, 5); g.fillStyle = rfill(g, '#8a5a2b', 0, 0, 5); g.fill(); g.strokeStyle = '#5b606b'; g.lineWidth = 1.2; g.stroke(); outline(g, 0.5);
    if (!back) { g.strokeStyle = 'rgba(40,24,10,0.5)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-4.6, -1.4); g.lineTo(4.6, -1.4); g.moveTo(-4.6, 1.6); g.lineTo(4.6, 1.6); g.stroke(); g.fillStyle = '#c8ccd4'; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ell(g, Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0.45, 0.45); g.fill(); } ell(g, 0, 0, 1.4, 1.4); g.fillStyle = '#8f96a3'; g.fill(); }
    bipedHand(g, 1.4, 2.8, GOB);
  }
  function capHat(g, hy, r, back) {
    g.beginPath(); g.arc(0, hy - 1.4, r + 0.3, Math.PI * 1.05, Math.PI * 1.95); g.quadraticCurveTo(0, hy - 2.8, -r, hy - 3.2); g.closePath(); g.fillStyle = vfill(g, '#6b4a2a', hy - 9, hy - 2); g.fill(); outline(g, 0.6);
    g.strokeStyle = 'rgba(30,18,8,0.6)'; g.lineWidth = 0.4; g.setLineDash([0.6, 0.6]); g.beginPath(); g.arc(0, hy - 1.4, r - 1.4, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.setLineDash([]);
    if (!back) { g.strokeStyle = '#4a321c'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-r + 0.4, hy - 2.6); g.quadraticCurveTo(-r + 1, hy + 3, -3, hy + 5.4); g.stroke(); }
  }
  function drawGoblin(g, e) {
    drawBiped(g, e, {
      s: 0.92, hand: GOB, legs: { c: '#7a5a3a', wrap: '#c9a66b', barefoot: true, foot: GOB },
      torso: goblinTorso('#7a5a3a'), head: (g, e, back, fx) => goblinHead(g, e, { skin: GOB, hat: capHat }, back, fx),
      weapon: drawCleaver, off: drawBuckler,
    });
  }
  // --- the sapper: goggles, a scorched apron, a satchel of bombs and one lit in his hand
  function drawBomb(g, sw) {
    ell(g, 6, 0, 3.6, 3.6); g.fillStyle = rfill(g, '#2f3036', 6, 0, 3.6); g.fill(); outline(g, 0.6);
    g.fillStyle = '#8a6a3a'; g.fillRect(8.8, -0.9, 2, 1.8);
    g.strokeStyle = '#c9a66b'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(10.8, 0); g.quadraticCurveTo(12.6, -1.6, 13.6, -0.4); g.stroke();
    const p = (Math.sin(time * 18) + 1) / 2; sparkle(g, 13.8, -0.4, 1.6 + p * 1.4, `rgba(255,${180 + p * 60 | 0},80,0.95)`); sparkle(g, 13.8, -0.4, 0.8, '#ffffff');
  }
  function drawSatchel(g, bob) { g.save(); g.translate(-7.6, 6 + bob); rr(g, -3, -2.6, 6, 5, 1.2); g.fillStyle = vfill(g, '#6b4a2a', -3, 3); g.fill(); outline(g, 0.6); for (const x of [-1.6, 1]) { ell(g, x, -2.8, 1.4, 1.4); g.fillStyle = '#2f3036'; g.fill(); outline(g, 0.4); } g.restore(); }
  function gogglesHat(g, hy, r, back) {
    capHat(g, hy, r, back);
    g.fillStyle = '#5a3a1e'; g.fillRect(-r - 0.2, hy - 4.2, (r + 0.2) * 2, 1.4);
    if (!back) for (const x of [-2.8, 2.8]) { ell(g, x, hy - 4.6, 2.4, 2.4); g.fillStyle = '#b98a3a'; g.fill(); outline(g, 0.5); const gl = g.createRadialGradient(x - 0.7, hy - 5.3, 0.2, x, hy - 4.6, 1.9); gl.addColorStop(0, '#e8f6ff'); gl.addColorStop(1, '#4f88b0'); g.fillStyle = gl; ell(g, x, hy - 4.6, 1.6, 1.6); g.fill(); }
  }
  function drawSapper(g, e) {
    drawBiped(g, e, {
      s: 0.92, hand: GOB, legs: { c: '#5a4632', wrap: '#8a6a3a', barefoot: true, foot: GOB },
      torso: goblinTorso('#6b5a46', true), head: (g, e, back, fx) => { goblinHead(g, e, { skin: GOB, hat: gogglesHat }, back, fx); if (!back) { g.fillStyle = 'rgba(30,26,24,0.45)'; ell(g, 4.6, -7.6, 1.6, 1); g.fill(); } },
      weapon: drawBomb, rest: { a: -0.4, x: 10, y: 4 },
      off: (g, back) => bipedHand(g, 0, 0, GOB), backItem: drawSatchel,
    });
  }
  // --- the brute: bigger, a spiked helm, one shoulder plate, a great maul
  const BRUTE = '#5c9a36';
  function bruteTorso(g, back) {
    g.beginPath(); g.moveTo(-8.4, -4); g.quadraticCurveTo(-10.6, 2, -7.6, 8); g.lineTo(7.6, 8); g.quadraticCurveTo(10.6, 2, 8.4, -4); g.quadraticCurveTo(0, -6.4, -8.4, -4); g.closePath();
    g.fillStyle = vfill(g, BRUTE, -5, 8); g.fill(); outline(g, 0.9);
    if (!back) {
      g.strokeStyle = shade(BRUTE, -0.4); g.lineWidth = 0.7; g.beginPath(); g.moveTo(-6, -1.4); g.quadraticCurveTo(-3, 0.6, 0, -0.6); g.quadraticCurveTo(3, 0.6, 6, -1.4); g.moveTo(0, -0.6); g.lineTo(0, 4.4); g.moveTo(-2.4, 2.4); g.lineTo(2.4, 2.4); g.stroke();
      g.strokeStyle = '#d98a8a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(3.4, -3.2); g.lineTo(5.8, 1.2); g.stroke();
    }
    g.strokeStyle = '#4a321c'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-7.4, -3.4); g.lineTo(6.6, 5.2); g.stroke();
    g.beginPath(); g.moveTo(-8.6, 5.6); g.lineTo(8.6, 5.6); g.lineTo(9, 10.4); g.lineTo(5, 9.2); g.lineTo(2, 10.6); g.lineTo(-2, 9.4); g.lineTo(-5.4, 10.6); g.lineTo(-9, 10); g.closePath(); g.fillStyle = vfill(g, '#6b4a2a', 5, 11); g.fill(); outline(g, 0.6);
    ell(g, -9, -2.6, 5, 3.8, -0.25); g.fillStyle = vfill(g, '#8f96a3', -7, 1); g.fill(); outline(g, 0.7);
    g.fillStyle = '#c8ccd4'; for (const k of [0, 1]) { const bx = -8 - k * 2.6, by = -5.4 + k * 0.6; g.beginPath(); g.moveTo(bx - 1, by + 0.8); g.lineTo(bx - 0.6, by - 2.6); g.lineTo(bx + 1, by + 0.8); g.closePath(); g.fill(); }
  }
  function spikeHelm(g, hy, r, back) {
    g.fillStyle = '#c8ccd4'; for (const x of [-4.4, 0, 4.4]) { g.beginPath(); g.moveTo(x - 1.3, hy - r + 1.6); g.lineTo(x, hy - r - 3.4 - (x === 0 ? 1.2 : 0)); g.lineTo(x + 1.3, hy - r + 1.6); g.closePath(); g.fill(); outline(g, 0.4); }
    g.beginPath(); g.arc(0, hy - 0.8, r + 0.7, Math.PI, 0); g.closePath(); g.fillStyle = vfill(g, '#7d8087', hy - 9, hy); g.fill(); outline(g, 0.8);
    g.fillStyle = '#5b606b'; g.fillRect(-r - 0.7, hy - 2, (r + 0.7) * 2, 2);
    if (!back) { g.fillStyle = '#6b707b'; g.fillRect(-0.9, hy - 1.6, 1.8, 4.4); }
    g.fillStyle = '#c8ccd4'; for (const x of [-5.6, -2, 2, 5.6]) { ell(g, x, hy - 1, 0.5, 0.5); g.fill(); }
  }
  function drawMaul(g, sw) {
    rr(g, -9, -1.3, 32, 2.6, 1.1); g.fillStyle = '#6b4a2a'; g.fill(); outline(g, 0.5);
    g.strokeStyle = '#3a2410'; g.lineWidth = 0.6; for (const x of [-2, 0, 2]) { g.beginPath(); g.moveTo(x, -1.3); g.lineTo(x + 0.8, 1.3); g.stroke(); }
    rr(g, 19, -7, 10, 14, 1.6); g.fillStyle = vfill(g, '#7d8087', -7, 7); g.fill(); outline(g, 0.8);
    g.fillStyle = '#4a4f5a'; g.fillRect(19, -1.4, 10, 2.8);
    g.fillStyle = '#c8ccd4'; for (const [x, y] of [[21.4, -4.8], [26.6, -4.8], [21.4, 4.8], [26.6, 4.8]]) { ell(g, x, y, 0.7, 0.7); g.fill(); }
  }
  function drawBrute(g, e) {
    drawBiped(g, e, {
      s: 1.22, hand: BRUTE, legs: { c: '#4a3a28', barefoot: true, foot: BRUTE, gap: 4 },
      torso: bruteTorso, head: (g, e, back, fx) => goblinHead(g, e, { skin: BRUTE, hat: spikeHelm, tusks: true, scar: true }, back, fx),
      weapon: drawMaul, rest: { a: -1.12, x: 10.4, y: 4.6 }, bobK: 1.8,
    });
  }
  // --- the skeleton: ribs, a jaw that chatters, a notched sword and a torn sash
  const BONE = '#e9e4d2';
  function skeletonTorso(g, back) {
    g.strokeStyle = OUT; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, 5); g.stroke();
    g.strokeStyle = BONE; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, 5); g.stroke();
    for (let k = 0; k < 4; k++) {
      const y = -3 + k * 1.9, w = 6.4 - k * 0.7;
      g.strokeStyle = OUT; g.lineWidth = 1.9; g.beginPath(); g.moveTo(-0.6, y); g.quadraticCurveTo(-w - 0.4, y + 0.4, -w + 1, y + 1.8); g.moveTo(0.6, y); g.quadraticCurveTo(w + 0.4, y + 0.4, w - 1, y + 1.8); g.stroke();
      g.strokeStyle = BONE; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-0.6, y); g.quadraticCurveTo(-w - 0.4, y + 0.4, -w + 1, y + 1.8); g.moveTo(0.6, y); g.quadraticCurveTo(w + 0.4, y + 0.4, w - 1, y + 1.8); g.stroke();
    }
    ell(g, 0, 5.6, 4.4, 2); g.fillStyle = vfill(g, BONE, 4, 8); g.fill(); outline(g, 0.6);
    g.fillStyle = '#8a1e1e'; g.beginPath(); g.moveTo(-4.8, 4.4); g.lineTo(4.8, 4.8); g.lineTo(3.6, 6.6); g.lineTo(-4.6, 6.2); g.closePath(); g.fill();
    const flap = Math.sin(time * 4) * 0.8; g.beginPath(); g.moveTo(-3.6, 6.2); g.lineTo(-4.4 + flap, 10.6); g.lineTo(-2.6 + flap, 9.4); g.lineTo(-1.8, 6.4); g.closePath(); g.fill();
    ell(g, -8, -3.2, 2.6, 2.2); g.fillStyle = BONE; g.fill(); outline(g, 0.5); ell(g, 8, -3.2, 2.6, 2.2); g.fill(); outline(g, 0.5);
  }
  function skullHead(g, e, back, fx) {
    const hy = -10.4, r = 6.8, chat = swingOf(e) >= 0 ? Math.abs(Math.sin(time * 30)) * 1.6 : Math.abs(Math.sin(time * 3)) * 0.4;
    if (!back) { rr(g, -3.6 + fx, hy + 3, 7.2, 3.2 + chat, 1.2); g.fillStyle = vfill(g, BONE, hy + 3, hy + 6.5); g.fill(); outline(g, 0.5); g.strokeStyle = 'rgba(60,50,30,0.6)'; g.lineWidth = 0.4; for (let x = -2.4; x <= 2.4; x += 1.2) { g.beginPath(); g.moveTo(x + fx, hy + 3 + chat); g.lineTo(x + fx, hy + 4.6 + chat); g.stroke(); } }
    ell(g, 0, hy, r, r * 0.92); g.fillStyle = rfill(g, BONE, 0, hy, r); g.fill(); outline(g, 0.9);
    if (!back) {
      const ex = fx * 1.5, glow = 0.55 + Math.sin(time * 3) * 0.25;
      for (const s of [-1, 1]) { ell(g, s * 2.6 + ex, hy + 0.2, 2, 2.2); g.fillStyle = '#16120e'; g.fill(); const gl = g.createRadialGradient(s * 2.6 + ex, hy + 0.4, 0, s * 2.6 + ex, hy + 0.4, 2.6); gl.addColorStop(0, `rgba(170,255,170,${glow})`); gl.addColorStop(1, 'rgba(170,255,170,0)'); g.fillStyle = gl; ell(g, s * 2.6 + ex, hy + 0.4, 2.6, 2.6); g.fill(); ell(g, s * 2.6 + ex, hy + 0.4, 0.55, 0.55); g.fillStyle = '#d6ffd6'; g.fill(); }
      g.fillStyle = '#16120e'; g.beginPath(); g.moveTo(ex, hy + 2); g.lineTo(ex - 0.9, hy + 3.4); g.lineTo(ex + 0.9, hy + 3.4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(80,66,40,0.7)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-3, hy - 5.6); g.lineTo(-1.6, hy - 3.6); g.lineTo(-2.4, hy - 2.4); g.stroke();
    } else { g.strokeStyle = 'rgba(80,66,40,0.5)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, hy - r); g.lineTo(0.6, hy - 2); g.stroke(); }
  }
  function drawRustySword(g, sw) {
    g.fillStyle = '#4a2e13'; g.fillRect(-3, -1.2, 6, 2.4); ell(g, -3.8, 0, 1.6, 1.6); g.fillStyle = '#6b5a46'; g.fill();
    rr(g, 3, -4, 2, 8, 0.6); g.fillStyle = '#6b5a46'; g.fill(); outline(g, 0.4);
    g.beginPath(); g.moveTo(5, -2); g.lineTo(9, -2.1); g.lineTo(10, -1.2); g.lineTo(11, -2.1); g.lineTo(18, -2); g.lineTo(19, -1); g.lineTo(20, -1.9); g.lineTo(26, -1.6); g.lineTo(29.5, 0); g.lineTo(26, 1.8); g.lineTo(5, 2); g.closePath(); g.fillStyle = vfill(g, '#9a958a', -2, 2); g.fill(); outline(g, 0.6);
    g.fillStyle = '#8a5a2a'; for (const [x, y, s] of [[12, 0.6, 1.3], [21, -0.6, 1], [24, 0.8, 0.8]]) { ell(g, x, y, s, s * 0.7); g.fill(); }
  }
  function drawSkeleton(g, e) {
    drawBiped(g, e, {
      s: 0.96, hand: BONE, legs: { c: BONE, bone: true },
      torso: skeletonTorso, head: skullHead, weapon: drawRustySword,
    });
  }
  // --- the zombie: torn clothes, a tilted head, one glowing eye, arms reaching out in front
  const ZSKIN = '#8fa87a';
  function zombieTorso(g, back) {
    g.beginPath(); g.moveTo(-7.6, -4); g.quadraticCurveTo(-9.4, 2, -7.4, 6.8); for (let x = -7.4; x <= 7.4; x += 1.85) g.lineTo(x + 0.9, 8.8 - (Math.round(x / 1.85) % 2 ? 1.6 : 0)); g.lineTo(7.4, 6.8); g.quadraticCurveTo(9.4, 2, 7.6, -4); g.quadraticCurveTo(0, -6, -7.6, -4); g.closePath();
    g.fillStyle = vfill(g, '#55657a', -5, 9); g.fill(); outline(g, 0.8);
    if (!back) {
      ell(g, 2.4, 1.6, 2.4, 2); g.fillStyle = ZSKIN; g.fill(); g.strokeStyle = shade(ZSKIN, -0.45); g.lineWidth = 0.5; for (const y of [0.8, 2.2]) { g.beginPath(); g.moveTo(1, y); g.lineTo(3.8, y + 0.2); g.stroke(); }
      g.fillStyle = 'rgba(90,60,40,0.5)'; ell(g, -3.4, 4.4, 1.8, 1.2); g.fill();
    }
    g.strokeStyle = '#3a2a1c'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-7.2, 5); g.lineTo(7.2, 5.4); g.stroke();
  }
  function zombieHead(g, e, back, fx) {
    const hy = -10, r = 7.2;
    g.save(); g.translate(0, hy); g.rotate(-0.16 + (e.moving ? Math.sin(e.walkT * 0.5) * 0.06 : 0)); g.translate(0, -hy);
    ell(g, 0, hy, r, r * 0.96); g.fillStyle = rfill(g, ZSKIN, 0, hy, r); g.fill(); outline(g, 0.9);
    g.fillStyle = '#3a3a2e'; g.beginPath(); g.arc(0, hy - 1.2, r + 0.2, Math.PI * 1.08, Math.PI * 1.7); g.quadraticCurveTo(-1, hy - 3.6, -r, hy - 2); g.closePath(); g.fill();
    if (!back) {
      const ex = fx * 1.5, glow = 0.6 + Math.sin(time * 5) * 0.3;
      ell(g, -2.8 + ex, hy + 0.2, 1.7, 1.5); g.fillStyle = '#e8e2c0'; g.fill(); ell(g, -2.8 + ex, hy + 0.3, 0.6, 0.6); g.fillStyle = '#4a4a3a'; g.fill();
      const gl = g.createRadialGradient(2.8 + ex, hy, 0, 2.8 + ex, hy, 3.4); gl.addColorStop(0, `rgba(255,236,120,${glow})`); gl.addColorStop(1, 'rgba(255,236,120,0)'); g.fillStyle = gl; ell(g, 2.8 + ex, hy, 3.4, 3.4); g.fill();
      ell(g, 2.8 + ex, hy, 1.5, 1.4); g.fillStyle = '#ffe36b'; g.fill();
      g.beginPath(); g.moveTo(-2.8 + ex, hy + 3.4); g.quadraticCurveTo(ex, hy + 5.6, 2.6 + ex, hy + 3.6); g.closePath(); g.fillStyle = '#2a1410'; g.fill();
      g.fillStyle = '#e8e2c0'; g.fillRect(-1.4 + ex, hy + 3.5, 1, 1.1); g.fillRect(1 + ex, hy + 3.6, 0.9, 0.9);
      g.strokeStyle = '#3a2a24'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-4.6, hy - 4.6); g.lineTo(-0.8, hy - 3.4); for (let x = -4; x <= -1.2; x += 0.9) { g.moveTo(x, hy - 5.2 + (x + 4) * 0.3); g.lineTo(x + 0.2, hy - 3.6 + (x + 4) * 0.3); } g.stroke();
    }
    g.restore();
  }
  function zombieReach(g, e, bob, back) {
    // arms out in front: facing us the two hands at chest height; side-on both reach forward; facing away they are hidden
    if (back) return;
    const sw = swingOf(e), lunge = sw >= 0 ? Math.sin(sw * Math.PI) : 0, wob = Math.sin(time * 3 + (e.seed || 0)) * 0.5;
    const f = face4(e);
    const big = (x, y) => { ell(g, x, y, 2.6, 2.4); g.fillStyle = ZSKIN; g.fill(); outline(g, 0.7); g.strokeStyle = shade(ZSKIN, -0.45); g.lineWidth = 0.4; g.beginPath(); g.moveTo(x - 1, y + 1.6); g.lineTo(x - 1, y + 2.6); g.moveTo(x + 0.2, y + 1.8); g.lineTo(x + 0.2, y + 2.8); g.moveTo(x + 1.3, y + 1.6); g.lineTo(x + 1.3, y + 2.5); g.stroke(); };
    if (f === 'down') for (const s of [-1, 1]) big(s * (6.6 - lunge * 1.6), -0.6 + bob + (s > 0 ? wob : -wob) - lunge * 2.4);
    else for (const [x, y, k] of [[10.4, -0.8, 1], [8.6, 1.8, -1]]) big(x + lunge * 4, y + bob + wob * k);
  }
  function drawZombie(g, e) {
    drawBiped(g, e, {
      s: 1, hand: ZSKIN, legs: { c: '#5a4a3a', tear: true, skin: ZSKIN, boot: '#3a2a1c' }, sway: true, bobK: 0.9,
      torso: zombieTorso, head: zombieHead, reach: zombieReach,
    });
  }

  // ---------- the four-legged: seen from the side (facing down: from the front; facing away: from behind) ----------
  function quadLegs(g, e, L) {
    // L: { xs:[back,front], y, len, w, c, hoof, k }  -- a trot: diagonal pairs swing together
    const ph = e.moving ? e.walkT : 0;
    const sets = [[L.xs[0], 0, 0.82], [L.xs[1], Math.PI, 0.82], [L.xs[0] + 1.6, Math.PI, 1], [L.xs[1] + 1.6, 0, 1]];
    for (const [x, p, dim] of sets) {
      const a = e.moving ? Math.sin(ph + p) * (L.k || 0.45) : 0;
      g.save(); g.translate(x, L.y); g.rotate(a);
      rr(g, -L.w / 2, 0, L.w, L.len, L.w / 2); g.fillStyle = dim < 1 ? shade(L.c, -0.25) : L.c; g.fill(); outline(g, 0.5);
      rr(g, -L.w / 2 - 0.2, L.len - 1.6, L.w + 0.4, 2, 0.8); g.fillStyle = L.hoof; g.fill();
      g.restore();
    }
  }
  function drawQuad(g, e, Q) {
    const f = face4(e), sw = swingOf(e), bob = bobOf(e, 1);
    g.save(); shadow(g, 0, Q.ground + 0.6, Q.sh, 3.6);
    if (f === 'down' || f === 'up') { g.translate(0, bob); (f === 'down' ? Q.front : Q.rear)(g, e, sw); g.restore(); return; }
    if (f === 'left') g.scale(-1, 1);
    const lunge = sw >= 0 ? Math.sin(sw * Math.PI) * (Q.lunge || 3) : 0;
    g.translate(lunge, 0);
    Q.side(g, e, sw, bob);
    g.restore();
  }
  // --- the wolf
  const WOLF = { back: '#6e6660', belly: '#b3aaa0', dark: '#46403c' };
  function wolfSide(g, e, sw, bob) {
    const tail = Math.sin(time * 4 + (e.seed || 0)) * 0.25 + (e.moving ? Math.sin(e.walkT) * 0.15 : 0);
    g.save(); g.translate(-10.5, -2 + bob); g.rotate(-0.5 + tail);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-5, -3, -10, 1.5); g.quadraticCurveTo(-6, 3, 0, 2.6); g.closePath(); g.fillStyle = vfill(g, WOLF.back, -3, 3); g.fill(); outline(g, 0.6);
    g.fillStyle = WOLF.belly; ell(g, -9, 1.2, 1.6, 1); g.fill(); g.restore();
    quadLegs(g, e, { xs: [-6.5, 4.5], y: 2.4 + bob, len: 7.6, w: 2.4, c: WOLF.back, hoof: WOLF.dark, k: 0.55 });
    g.translate(0, bob);
    g.beginPath(); g.moveTo(-11, -1); g.quadraticCurveTo(-10, -6.4, -3, -6.2); g.lineTo(-1.6, -7.6); g.lineTo(0, -6); g.lineTo(1.6, -7.4); g.lineTo(3, -5.8); g.quadraticCurveTo(8, -5.6, 9, -2); g.quadraticCurveTo(9.4, 3, 5, 4); g.quadraticCurveTo(-3, 5.4, -9, 3.6); g.quadraticCurveTo(-11.6, 2, -11, -1); g.closePath();
    g.fillStyle = vfill(g, WOLF.back, -7, 5, 0.2, -0.25); g.fill(); outline(g, 0.8);
    g.beginPath(); g.moveTo(-8, 3.4); g.quadraticCurveTo(-1, 5.2, 5, 3.6); g.quadraticCurveTo(0, 2.2, -8, 3.4); g.fillStyle = WOLF.belly; g.fill();
    g.fillStyle = WOLF.dark; g.beginPath(); g.moveTo(-8, -4); g.quadraticCurveTo(-2, -7, 4, -5); g.quadraticCurveTo(-1, -4.4, -8, -2.6); g.closePath(); g.fill();
    const jaw = sw >= 0 ? Math.sin(sw * Math.PI) * 0.5 : 0;
    g.save(); g.translate(7, -4.6); g.rotate(sw >= 0 ? 0.15 : 0);
    ell(g, 2, 0, 5.2, 4.4); g.fillStyle = rfill(g, WOLF.back, 2, 0, 5); g.fill(); outline(g, 0.7);
    g.fillStyle = WOLF.belly; ell(g, 2.4, 2.4, 3.6, 1.8); g.fill();
    for (const [x, d] of [[0, 0.82], [2.6, 1]]) { g.beginPath(); g.moveTo(x - 1.6, -3); g.lineTo(x + 0.2, -8.2); g.lineTo(x + 1.6, -3); g.closePath(); g.fillStyle = d < 1 ? WOLF.dark : WOLF.back; g.fill(); outline(g, 0.5); if (d === 1) { g.fillStyle = '#c99a9a'; g.beginPath(); g.moveTo(x - 0.6, -3.4); g.lineTo(x + 0.2, -6.6); g.lineTo(x + 0.8, -3.4); g.closePath(); g.fill(); } }
    g.save(); g.rotate(jaw * 0.4);
    g.beginPath(); g.moveTo(5, -1.4); g.lineTo(11.2, 0.2); g.quadraticCurveTo(11.6, 1.8, 10, 2); g.lineTo(5, 2.4); g.closePath(); g.fillStyle = vfill(g, WOLF.back, -1.6, 2.4); g.fill(); outline(g, 0.6);
    ell(g, 11, 0.4, 1.2, 1); g.fillStyle = '#1a1614'; g.fill(); g.restore();
    if (jaw > 0.05) { g.save(); g.rotate(jaw * 0.7); g.beginPath(); g.moveTo(5, 2.4); g.lineTo(10.4, 3); g.lineTo(5.4, 4.4); g.closePath(); g.fillStyle = '#b84a4a'; g.fill(); g.fillStyle = '#ffffff'; for (const x of [6.4, 8.2, 9.8]) { g.beginPath(); g.moveTo(x, 2.4); g.lineTo(x + 0.5, 3.6); g.lineTo(x + 1, 2.5); g.closePath(); g.fill(); } g.restore(); }
    ell(g, 4.2, -1.2, 1.3, 1); g.fillStyle = '#f2c94c'; g.fill(); ell(g, 4.5, -1.2, 0.5, 0.7); g.fillStyle = '#1a1614'; g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.6; for (const x of [-6, -2, 2]) { g.beginPath(); g.moveTo(x, -4.6); g.lineTo(x + 1.2, -2.6); g.stroke(); }
  }
  function wolfFront(g, e, sw) {
    quadLegs(g, e, { xs: [-3.4, 1.8], y: 3, len: 7.2, w: 2.4, c: WOLF.back, hoof: WOLF.dark, k: 0.25 });
    ell(g, 0, 1, 8.6, 6.4); g.fillStyle = vfill(g, WOLF.back, -5, 7); g.fill(); outline(g, 0.8);
    g.fillStyle = WOLF.belly; g.beginPath(); g.moveTo(-4, -1); g.quadraticCurveTo(0, 7, 4, -1); g.quadraticCurveTo(0, 1, -4, -1); g.fill();
    const hy = -5.6; ell(g, 0, hy, 6.2, 5.4); g.fillStyle = rfill(g, WOLF.back, 0, hy, 6); g.fill(); outline(g, 0.8);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2.6, hy - 3.6); g.lineTo(s * 5.6, hy - 9.4); g.lineTo(s * 6.2, hy - 2.6); g.closePath(); g.fillStyle = WOLF.back; g.fill(); outline(g, 0.5); g.fillStyle = '#c99a9a'; g.beginPath(); g.moveTo(s * 3.6, hy - 3.6); g.lineTo(s * 5.4, hy - 7.6); g.lineTo(s * 5.6, hy - 3.2); g.closePath(); g.fill(); }
    g.fillStyle = WOLF.belly; ell(g, 0, hy + 2.6, 3.6, 3); g.fill(); outline(g, 0.5);
    ell(g, 0, hy + 1.6, 1.5, 1.1); g.fillStyle = '#1a1614'; g.fill();
    for (const s of [-1, 1]) { ell(g, s * 2.6, hy - 1.4, 1.2, 1); g.fillStyle = '#f2c94c'; g.fill(); ell(g, s * 2.6, hy - 1.4, 0.5, 0.75); g.fillStyle = '#1a1614'; g.fill(); }
    if (sw >= 0) { g.fillStyle = '#7a2a2a'; ell(g, 0, hy + 4.4, 2, 1.2 + Math.sin(sw * Math.PI)); g.fill(); g.fillStyle = '#fff'; g.fillRect(-1.4, hy + 3.6, 0.8, 1); g.fillRect(0.6, hy + 3.6, 0.8, 1); }
  }
  function wolfRear(g, e) {
    quadLegs(g, e, { xs: [-3.4, 1.8], y: 3, len: 7.2, w: 2.4, c: WOLF.back, hoof: WOLF.dark, k: 0.25 });
    ell(g, 0, 0.6, 8.4, 6.6); g.fillStyle = vfill(g, WOLF.back, -6, 7); g.fill(); outline(g, 0.8);
    const t = Math.sin(time * 4 + (e.seed || 0)) * 2.2; g.beginPath(); g.moveTo(-1.6, 2); g.quadraticCurveTo(t, 6, t * 0.6 + 0.6, 11); g.quadraticCurveTo(t + 2.6, 6, 1.6, 2); g.closePath(); g.fillStyle = vfill(g, WOLF.back, 2, 11); g.fill(); outline(g, 0.6);
    ell(g, 0, -6.4, 5, 4); g.fillStyle = WOLF.back; g.fill(); outline(g, 0.6);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.8, -8.6); g.lineTo(s * 4.6, -13.4); g.lineTo(s * 5, -7); g.closePath(); g.fillStyle = WOLF.dark; g.fill(); outline(g, 0.5); }
  }
  function drawWolf(g, e) { drawQuad(g, e, { ground: 10.2, sh: 11, side: wolfSide, front: wolfFront, rear: wolfRear, lunge: 4 }); }
  // --- the boar
  const BOAR = { c: '#6b4a2a', dark: '#3e2a18', snout: '#d99a8a' };
  function boarSide(g, e, sw, bob) {
    quadLegs(g, e, { xs: [-6.2, 4.4], y: 3 + bob, len: 6, w: 2.8, c: BOAR.c, hoof: '#1f1610', k: 0.5 });
    g.translate(0, bob);
    const tail = Math.sin(time * 6) * 0.6; g.strokeStyle = BOAR.dark; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-11, -1); g.quadraticCurveTo(-13.4, -3 + tail, -12.6, -4.6); g.quadraticCurveTo(-11.6, -5, -12.2, -3.6); g.stroke();
    ell(g, -1, 0, 11, 6.8); g.fillStyle = vfill(g, BOAR.c, -7, 7, 0.18, -0.35); g.fill(); outline(g, 0.9);
    g.fillStyle = BOAR.dark; g.beginPath(); g.moveTo(-10, -3); for (let x = -10; x <= 6; x += 1.6) g.lineTo(x + 0.8, -7.6 - Math.sin((x + 10) / 16 * Math.PI) * 2); g.lineTo(6.6, -4.4); g.quadraticCurveTo(-2, -6.4, -10, -3); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(30,20,10,0.5)'; g.lineWidth = 0.5; for (const x of [-7, -3, 1]) { g.beginPath(); g.moveTo(x, 1); g.lineTo(x + 1, 4); g.stroke(); }
    g.save(); g.translate(8.4, -0.4); g.rotate(sw >= 0 ? 0.25 : 0.05);
    g.beginPath(); g.moveTo(-3, -5); g.quadraticCurveTo(4, -5, 6, -1); g.lineTo(6.6, 2.6); g.quadraticCurveTo(2, 4.6, -3, 3.6); g.closePath(); g.fillStyle = vfill(g, BOAR.c, -5, 4); g.fill(); outline(g, 0.8);
    ell(g, 6.6, 0.8, 1.4, 2.2); g.fillStyle = BOAR.snout; g.fill(); outline(g, 0.5); g.fillStyle = '#5a3328'; ell(g, 6.9, 0.2, 0.35, 0.5); g.fill(); ell(g, 6.9, 1.5, 0.35, 0.5); g.fill();
    g.fillStyle = '#fbf6e8'; g.beginPath(); g.moveTo(4.2, 2.6); g.quadraticCurveTo(6.4, 3, 6.6, -0.6); g.quadraticCurveTo(5.6, 1.4, 3.6, 1.6); g.closePath(); g.fill(); outline(g, 0.4);
    g.fillStyle = BOAR.dark; g.beginPath(); g.moveTo(-1.6, -4.4); g.lineTo(0.4, -8); g.lineTo(1.4, -4); g.closePath(); g.fill();
    ell(g, 1.8, -1.6, 0.9, 0.8); g.fillStyle = '#1a0e08'; g.fill(); ell(g, 2, -1.8, 0.3, 0.3); g.fillStyle = '#fff'; g.fill();
    g.restore();
    if (sw >= 0) { g.fillStyle = `rgba(190,160,110,${0.5 * (1 - sw)})`; for (const [x, y, r] of [[-12, 8, 2.6], [-15, 6.6, 1.8], [-10, 9.4, 1.6]]) { ell(g, x - sw * 4, y, r, r * 0.7); g.fill(); } }
  }
  function boarFront(g, e, sw) {
    quadLegs(g, e, { xs: [-3.6, 2], y: 3, len: 6, w: 2.8, c: BOAR.c, hoof: '#1f1610', k: 0.2 });
    ell(g, 0, 0.6, 9, 7); g.fillStyle = vfill(g, BOAR.c, -6, 7); g.fill(); outline(g, 0.9);
    g.fillStyle = BOAR.dark; for (let x = -4; x <= 4; x += 1.6) { g.beginPath(); g.moveTo(x - 0.7, -5); g.lineTo(x, -8.4); g.lineTo(x + 0.7, -5); g.closePath(); g.fill(); }
    const hy = -1; ell(g, 0, hy, 6.4, 5.4); g.fillStyle = rfill(g, BOAR.c, 0, hy, 6); g.fill(); outline(g, 0.8);
    for (const s of [-1, 1]) { g.fillStyle = BOAR.dark; g.beginPath(); g.moveTo(s * 3.2, hy - 4); g.lineTo(s * 6.4, hy - 7); g.lineTo(s * 6, hy - 2.6); g.closePath(); g.fill(); ell(g, s * 2.6, hy - 1.6, 0.9, 0.8); g.fillStyle = '#1a0e08'; g.fill(); }
    ell(g, 0, hy + 2.6, 3, 2.2); g.fillStyle = BOAR.snout; g.fill(); outline(g, 0.5); g.fillStyle = '#5a3328'; ell(g, -0.9, hy + 2.6, 0.5, 0.7); g.fill(); ell(g, 0.9, hy + 2.6, 0.5, 0.7); g.fill();
    for (const s of [-1, 1]) { g.fillStyle = '#fbf6e8'; g.beginPath(); g.moveTo(s * 2.4, hy + 4); g.quadraticCurveTo(s * 4.6, hy + 4, s * 4.4, hy + 0.6); g.quadraticCurveTo(s * 3.6, hy + 2.6, s * 2.2, hy + 2.8); g.closePath(); g.fill(); outline(g, 0.4); }
  }
  function boarRear(g, e) {
    quadLegs(g, e, { xs: [-3.6, 2], y: 3, len: 6, w: 2.8, c: BOAR.c, hoof: '#1f1610', k: 0.2 });
    ell(g, 0, 0.4, 9, 7); g.fillStyle = vfill(g, BOAR.c, -7, 7); g.fill(); outline(g, 0.9);
    g.fillStyle = BOAR.dark; for (let y = -6; y <= 2; y += 1.8) { g.beginPath(); g.moveTo(-1, y); g.lineTo(0, y - 2.6); g.lineTo(1, y); g.closePath(); g.fill(); }
    const t = Math.sin(time * 6); g.strokeStyle = BOAR.dark; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 4); g.quadraticCurveTo(1.6 + t, 6, 0.4, 7.4); g.stroke();
  }
  function drawBoar(g, e) { drawQuad(g, e, { ground: 9.6, sh: 11.5, side: boarSide, front: boarFront, rear: boarRear, lunge: 5 }); }
  // --- the sheep
  function woolBlob(g, cx, cy, w, h, seed) {
    const pts = []; for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2; pts.push([cx + Math.cos(a) * w, cy + Math.sin(a) * h, 2.6 + ((k * 7 + seed) % 3) * 0.5]); }
    for (const [x, y, r] of pts) { ell(g, x, y, r + 0.8, r + 0.8); g.fillStyle = OUT; g.fill(); }
    ell(g, cx, cy, w + 0.2, h + 0.2); g.fillStyle = OUT; g.fill();
    for (const [x, y, r] of pts) { ell(g, x, y, r, r); g.fillStyle = y > cy + h * 0.3 ? '#d9d2c2' : '#f4f1e8'; g.fill(); }
    ell(g, cx, cy, w, h); g.fillStyle = rfill(g, '#f4f1e8', cx, cy, Math.max(w, h)); g.fill();
    g.strokeStyle = 'rgba(160,150,130,0.6)'; g.lineWidth = 0.5; for (const [x, y] of [[cx - w * 0.4, cy - h * 0.2], [cx + w * 0.2, cy + h * 0.1], [cx - w * 0.1, cy + h * 0.45]]) { g.beginPath(); g.arc(x, y, 1.4, 0.2, Math.PI * 1.4); g.stroke(); }
  }
  function sheepSide(g, e, sw, bob) {
    quadLegs(g, e, { xs: [-5, 3.6], y: 3 + bob, len: 6.4, w: 1.7, c: '#2b2b2b', hoof: '#111', k: 0.4 });
    g.translate(0, bob);
    woolBlob(g, -0.6, -0.6, 8.6, 5.6, 1);
    g.save(); g.translate(8, -3.4); g.rotate(e.moving ? 0.1 : Math.sin(time * 1.3 + (e.seed || 0)) * 0.12);
    ell(g, 1.6, 0.6, 3.6, 2.8, 0.25); g.fillStyle = vfill(g, '#2b2b2b', -2, 3, 0.25, -0.2); g.fill(); outline(g, 0.6);
    const flick = Math.max(0, Math.sin(time * 2.1 + (e.seed || 0)) - 0.85) * 4;
    ell(g, -0.6, -1.6, 2.2, 0.9, -0.5 - flick * 0.2); g.fillStyle = '#2b2b2b'; g.fill(); outline(g, 0.4); g.fillStyle = '#c98a8a'; ell(g, -0.8, -1.6, 1.2, 0.4, -0.5 - flick * 0.2); g.fill();
    ell(g, 2, -0.4, 0.9, 0.7); g.fillStyle = '#fff'; g.fill(); ell(g, 2.2, -0.3, 0.45, 0.5); g.fillStyle = '#111'; g.fill();
    woolBlob(g, -0.6, -2.6, 2.4, 1.6, 4);
    g.restore();
  }
  function sheepFront(g, e) {
    quadLegs(g, e, { xs: [-3, 1.4], y: 3.4, len: 6, w: 1.7, c: '#2b2b2b', hoof: '#111', k: 0.2 });
    woolBlob(g, 0, 0, 7.6, 6.2, 2);
    const hy = -2; ell(g, 0, hy, 3.4, 4); g.fillStyle = vfill(g, '#2b2b2b', hy - 4, hy + 4, 0.25, -0.2); g.fill(); outline(g, 0.6);
    for (const s of [-1, 1]) { ell(g, s * 4.6, hy - 1.4, 2.2, 0.9, s * 0.3); g.fillStyle = '#2b2b2b'; g.fill(); outline(g, 0.4); ell(g, s * 1.4, hy - 0.4, 0.8, 0.7); g.fillStyle = '#fff'; g.fill(); ell(g, s * 1.4, hy - 0.3, 0.4, 0.45); g.fillStyle = '#111'; g.fill(); }
    woolBlob(g, 0, hy - 4, 2.6, 1.6, 5);
  }
  function sheepRear(g, e) { quadLegs(g, e, { xs: [-3, 1.4], y: 3.4, len: 6, w: 1.7, c: '#2b2b2b', hoof: '#111', k: 0.2 }); woolBlob(g, 0, 0, 7.6, 6.4, 3); ell(g, 0, -6.6, 3, 2.2); g.fillStyle = '#2b2b2b'; g.fill(); outline(g, 0.5); }
  function drawSheep(g, e) { drawQuad(g, e, { ground: 9.8, sh: 10, side: sheepSide, front: sheepFront, rear: sheepRear, lunge: 1 }); }
  // --- the cow
  const COW = { c: '#f1ece2', spot: '#6a4428' };
  function cowSide(g, e, sw, bob) {
    quadLegs(g, e, { xs: [-8, 6], y: 3 + bob, len: 7.4, w: 2.8, c: '#e6dfd2', hoof: '#3a2a1c', k: 0.35 });
    g.translate(0, bob);
    const t = Math.sin(time * 2.6 + (e.seed || 0)) * 0.35; g.strokeStyle = '#d9d0c0'; g.lineWidth = 1; g.beginPath(); g.moveTo(-12.4, -3); g.quadraticCurveTo(-15, 1 + t * 3, -14 + t * 2, 6); g.stroke(); ell(g, -14 + t * 2, 6.6, 1, 1.6); g.fillStyle = COW.spot; g.fill();
    const body = () => { g.beginPath(); g.moveTo(-12.6, -4); g.quadraticCurveTo(-12, -7.4, -4, -7); g.quadraticCurveTo(4, -7.4, 9, -5.4); g.quadraticCurveTo(11, 0, 9, 4); g.quadraticCurveTo(0, 6.4, -11, 4.4); g.quadraticCurveTo(-13.6, 1, -12.6, -4); g.closePath(); };
    body(); g.fillStyle = vfill(g, COW.c, -7, 6, 0.1, -0.15); g.fill();
    g.save(); body(); g.clip(); g.fillStyle = COW.spot; for (const [x, y, rx, ry] of [[-7, -3, 3.6, 2.6], [1, 1, 3, 2.4], [6.4, -4, 2.2, 1.8], [-2, -6.4, 2, 1.4]]) { ell(g, x, y, rx, ry, 0.4); g.fill(); } g.restore();
    body(); outline(g, 0.9);
    ell(g, -2.4, 5, 2.6, 1.6); g.fillStyle = '#e8a4a0'; g.fill(); outline(g, 0.5); g.fillStyle = '#d98a86'; for (const x of [-3.6, -2.4, -1.2]) { ell(g, x, 6.4, 0.45, 0.8); g.fill(); }
    g.save(); g.translate(10.6, -4.6); g.rotate(e.moving ? 0.08 : Math.sin(time * 1.1 + (e.seed || 0)) * 0.1 + 0.1);
    g.beginPath(); g.moveTo(-2.4, -3.4); g.quadraticCurveTo(3.6, -4.6, 5.4, 0); g.quadraticCurveTo(5.4, 3.6, 2.4, 3.8); g.lineTo(-2, 2.4); g.closePath(); g.fillStyle = vfill(g, COW.c, -4, 4); g.fill(); outline(g, 0.7);
    ell(g, 4.4, 2.2, 2.4, 1.8); g.fillStyle = '#e8b4b0'; g.fill(); outline(g, 0.5); g.fillStyle = '#7a4a46'; ell(g, 5.4, 2, 0.4, 0.55); g.fill();
    g.fillStyle = '#efe6d0'; g.beginPath(); g.moveTo(-0.6, -3.4); g.quadraticCurveTo(0.4, -6.4, 2, -6); g.quadraticCurveTo(0.8, -5.4, 0.8, -3.4); g.closePath(); g.fill(); outline(g, 0.4);
    ell(g, -2.4, -2, 2, 1, -0.4); g.fillStyle = '#e6dfd2'; g.fill(); outline(g, 0.4);
    ell(g, 1.8, -1.2, 0.9, 0.8); g.fillStyle = '#1a0e08'; g.fill(); g.strokeStyle = '#1a0e08'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(1, -1.8); g.lineTo(0.6, -2.4); g.moveTo(1.8, -2); g.lineTo(1.8, -2.7); g.stroke();
    ell(g, 0.6, -2.8, 1.4, 1, 0.2); g.fillStyle = COW.spot; g.fill();
    g.restore();
  }
  function cowFront(g, e) {
    quadLegs(g, e, { xs: [-4.4, 2.6], y: 3.4, len: 7, w: 2.8, c: '#e6dfd2', hoof: '#3a2a1c', k: 0.2 });
    ell(g, 0, 0.4, 10, 7.4); g.fillStyle = vfill(g, COW.c, -7, 8, 0.1, -0.15); g.fill(); g.save(); ell(g, 0, 0.4, 10, 7.4); g.clip(); g.fillStyle = COW.spot; ell(g, -6, -2, 3.4, 2.4); g.fill(); ell(g, 5.6, 3, 2.6, 2); g.fill(); g.restore(); ell(g, 0, 0.4, 10, 7.4); outline(g, 0.9);
    const hy = -3; g.beginPath(); g.moveTo(-4.4, hy - 4); g.quadraticCurveTo(0, hy - 6, 4.4, hy - 4); g.quadraticCurveTo(4.6, hy + 2, 3.6, hy + 5); g.lineTo(-3.6, hy + 5); g.quadraticCurveTo(-4.6, hy + 2, -4.4, hy - 4); g.closePath(); g.fillStyle = vfill(g, COW.c, hy - 6, hy + 5); g.fill(); outline(g, 0.8);
    ell(g, 0, hy + 4.4, 3.8, 2.4); g.fillStyle = '#e8b4b0'; g.fill(); outline(g, 0.5); g.fillStyle = '#7a4a46'; ell(g, -1.3, hy + 4.4, 0.55, 0.75); g.fill(); ell(g, 1.3, hy + 4.4, 0.55, 0.75); g.fill();
    for (const s of [-1, 1]) { g.fillStyle = '#efe6d0'; g.beginPath(); g.moveTo(s * 3, hy - 4.6); g.quadraticCurveTo(s * 6, hy - 7.6, s * 6.6, hy - 6); g.quadraticCurveTo(s * 5, hy - 5.4, s * 4.2, hy - 3.6); g.closePath(); g.fill(); outline(g, 0.4); ell(g, s * 6.4, hy - 2.6, 2.2, 1, s * 0.3); g.fillStyle = '#e6dfd2'; g.fill(); outline(g, 0.4); ell(g, s * 1.8, hy - 0.6, 0.9, 0.8); g.fillStyle = '#1a0e08'; g.fill(); }
    g.fillStyle = COW.spot; ell(g, 1.6, hy - 3, 1.6, 1.1); g.fill();
  }
  function cowRear(g, e) {
    quadLegs(g, e, { xs: [-4.4, 2.6], y: 3.4, len: 7, w: 2.8, c: '#e6dfd2', hoof: '#3a2a1c', k: 0.2 });
    ell(g, 0, 0.4, 10, 7.6); g.fillStyle = vfill(g, COW.c, -7, 8, 0.1, -0.15); g.fill(); g.save(); ell(g, 0, 0.4, 10, 7.6); g.clip(); g.fillStyle = COW.spot; ell(g, 4, -3, 3.6, 2.6); g.fill(); ell(g, -5, 2.6, 2.6, 2); g.fill(); g.restore(); ell(g, 0, 0.4, 10, 7.6); outline(g, 0.9);
    const t = Math.sin(time * 2.6) * 1.6; g.strokeStyle = '#d9d0c0'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -1); g.quadraticCurveTo(t, 4, t * 0.5, 9); g.stroke(); ell(g, t * 0.5, 9.6, 1, 1.5); g.fillStyle = COW.spot; g.fill();
  }
  function drawCow(g, e) { drawQuad(g, e, { ground: 11, sh: 13, side: cowSide, front: cowFront, rear: cowRear, lunge: 1.5 }); }

  // ---------- seen from above, turned to face where they go: spiders, the hawk, the drake, the dragon ----------
  function topDown(g, e, fn, shadowOff) {
    const ang = Math.atan2(e.facing.y, e.facing.x);
    g.save();
    if (shadowOff) { g.save(); g.translate(shadowOff.x, shadowOff.y); g.rotate(ang); fn(g, true); g.restore(); }
    g.rotate(ang); fn(g, false); g.restore();
  }
  function spiderLegs(g, e, L) {
    const gait = e.moving ? e.walkT * 1.2 : time * 0.6;
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const base = L.x0 + i * L.dx, swing = Math.sin(gait + i * Math.PI / 2 + (s > 0 ? Math.PI : 0)) * (e.moving ? 0.35 : 0.06);
      const a0 = s * (Math.PI / 2) + (i - 1.5) * 0.42 * s + swing * s;
      const kx = base + Math.cos(a0) * L.l1, ky = s * L.w + Math.sin(a0) * L.l1 * 0.9;
      const a1 = a0 + s * 0.55 * (i < 2 ? -1 : 1);
      const fx = kx + Math.cos(a1) * L.l2, fy = ky + Math.sin(a1) * L.l2;
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = OUT; g.lineWidth = L.t + 1; g.beginPath(); g.moveTo(base, s * L.w * 0.5); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.strokeStyle = L.c; g.lineWidth = L.t; g.beginPath(); g.moveTo(base, s * L.w * 0.5); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      if (L.band) { g.strokeStyle = L.band; g.lineWidth = L.t; g.beginPath(); g.moveTo(lerp(kx, fx, 0.35), lerp(ky, fy, 0.35)); g.lineTo(lerp(kx, fx, 0.5), lerp(ky, fy, 0.5)); g.moveTo(lerp(base, kx, 0.55), lerp(s * L.w * 0.5, ky, 0.55)); g.lineTo(lerp(base, kx, 0.7), lerp(s * L.w * 0.5, ky, 0.7)); g.stroke(); }
      if (L.hair) { g.strokeStyle = L.c; g.lineWidth = 0.4; for (let k = 1; k < 4; k++) { const hx = lerp(kx, fx, k / 4), hy = lerp(ky, fy, k / 4); g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + s * 0.6 + 0.4, hy + s * 0.9); g.stroke(); } }
      ell(g, kx, ky, L.t * 0.55, L.t * 0.55); g.fillStyle = shade(L.c, 0.25); g.fill();
    }
  }
  function drawSpider(g, e) {
    shadow(g, 0, 3.4, 7, 2.6, 0.25);
    topDown(g, e, (g) => {
      spiderLegs(g, e, { x0: -1.6, dx: 1.2, w: 2, l1: 4.2, l2: 4.4, t: 0.9, c: '#2e2a33' });
      ell(g, -3.2, 0, 4, 3.2); g.fillStyle = rfill(g, '#3a3440', -3.2, 0, 4); g.fill(); outline(g, 0.6);
      g.fillStyle = 'rgba(200,190,220,0.25)'; ell(g, -4.2, -1, 1.6, 0.8); g.fill();
      ell(g, 1.6, 0, 2.4, 2); g.fillStyle = rfill(g, '#4a4452', 1.6, 0, 2.4); g.fill(); outline(g, 0.5);
      g.fillStyle = '#ff4a3a'; for (const [x, y] of [[3, -0.8], [3, 0.8], [3.5, -0.3], [3.5, 0.3]]) { ell(g, x, y, 0.4, 0.4); g.fill(); }
    });
  }
  function drawGiantSpider(g, e) {
    const sw = swingOf(e);
    shadow(g, 0, 7, 15, 5, 0.28);
    topDown(g, e, (g) => {
      spiderLegs(g, e, { x0: -3, dx: 2.6, w: 4.4, l1: 9.4, l2: 9.6, t: 1.8, c: '#3a2e26', band: '#b89a6a', hair: true });
      ell(g, -7, 0, 8.6, 7); g.fillStyle = rfill(g, '#2e2630', -7, 0, 8.6); g.fill(); outline(g, 0.9);
      g.fillStyle = 'rgba(255,255,255,0.18)'; ell(g, -9, -2.6, 3.4, 1.6, -0.3); g.fill();
      g.fillStyle = '#d23a30'; g.beginPath(); g.moveTo(-11, -2.4); g.lineTo(-7, 0); g.lineTo(-11, 2.4); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-3, -2.4); g.lineTo(-7, 0); g.lineTo(-3, 2.4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(60,40,30,0.7)'; g.lineWidth = 0.4; for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; g.beginPath(); g.moveTo(-7 + Math.cos(a) * 8.4, Math.sin(a) * 6.8); g.lineTo(-7 + Math.cos(a) * 9.6, Math.sin(a) * 7.8); g.stroke(); }
      ell(g, 2.6, 0, 4.6, 4); g.fillStyle = rfill(g, '#3e3238', 2.6, 0, 4.6); g.fill(); outline(g, 0.7);
      const open = sw >= 0 ? Math.sin(sw * Math.PI) * 0.6 : 0.1;
      for (const s of [-1, 1]) { g.save(); g.translate(6.4, s * 1.4); g.rotate(s * open); g.beginPath(); g.moveTo(0, -0.9); g.quadraticCurveTo(3.4, 0, 3.2, s * 1.6); g.lineTo(0, 0.9); g.closePath(); g.fillStyle = '#1a1418'; g.fill(); g.restore(); }
      for (const [x, y, r] of [[5.4, -1.4, 0.8], [5.4, 1.4, 0.8], [6, -0.5, 0.6], [6, 0.5, 0.6], [4.6, -2.4, 0.5], [4.6, 2.4, 0.5], [4.2, -0.8, 0.4], [4.2, 0.8, 0.4]]) { ell(g, x, y, r, r); g.fillStyle = '#ff4a3a'; g.fill(); ell(g, x - r * 0.3, y - r * 0.3, r * 0.3, r * 0.3); g.fillStyle = '#fff'; g.fill(); }
    });
  }
  function drawRimhawk(g, e) {
    const sw = swingOf(e), flap = e.moving ? Math.sin(time * 8) : Math.sin(time * 2.4) * 0.35, dive = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    const span = (1 - dive * 0.6) * (0.85 + flap * 0.15), lift = 12 - dive * 7;
    const body = (g, sh) => {
      const col = c => sh ? 'rgba(0,0,0,0.22)' : c;
      g.scale(1.3, 1.3);
      for (const s of [-1, 1]) {
        const W = (y) => s * y * span;
        g.beginPath(); g.moveTo(2, s * 1.6);
        g.quadraticCurveTo(1, W(9), -1, W(17));
        for (let k = 0; k < 5; k++) { const x = -1.6 - k * 1.5, y = 17.6 - k * 1.7; g.lineTo(x - 1.6, W(y + 0.6)); g.lineTo(x - 0.8, W(y - 1)); }
        g.quadraticCurveTo(-8.4, W(6), -6.4, s * 1.6); g.closePath();
        g.fillStyle = sh ? col() : vfill(g, '#8a5a32', -18, 18, 0.15, -0.25); g.fill();
        if (sh) continue;
        outline(g, 0.6);
        g.fillStyle = '#5a3a1e'; for (let k = 0; k < 5; k++) { const x = -1.6 - k * 1.5, y = 17.6 - k * 1.7; g.beginPath(); g.moveTo(x + 0.4, W(y - 3)); g.lineTo(x - 1.6, W(y + 0.6)); g.lineTo(x - 0.8, W(y - 1)); g.closePath(); g.fill(); }
        g.strokeStyle = 'rgba(40,24,10,0.5)'; g.lineWidth = 0.45; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-0.6 - k * 1.2, W(4 + k)); g.lineTo(-2.2 - k * 1.5, W(14 - k * 1.4)); g.stroke(); }
        g.fillStyle = '#e8dcc0'; g.beginPath(); g.moveTo(1.2, s * 1.8); g.quadraticCurveTo(0.2, W(6), -1.2, W(9)); g.lineTo(-3.4, W(4)); g.lineTo(-3.4, s * 1.8); g.closePath(); g.fill();
        g.strokeStyle = '#7a4a28'; g.lineWidth = 0.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-0.6 - k, W(3 + k * 1.6)); g.lineTo(-1.4 - k, W(4 + k * 1.6)); g.stroke(); }
      }
      g.beginPath(); g.moveTo(-6, -1.6); g.lineTo(-13, -4); g.quadraticCurveTo(-14, 0, -13, 4); g.lineTo(-6, 1.6); g.closePath(); g.fillStyle = sh ? col() : vfill(g, '#8a5a32', -4, 4); g.fill();
      if (!sh) { outline(g, 0.5); g.strokeStyle = '#3a2410'; g.lineWidth = 0.7; for (const x of [-9, -11.4]) { g.beginPath(); g.moveTo(x, -3.2); g.lineTo(x, 3.2); g.stroke(); } }
      ell(g, -1.4, 0, 6.2, 3.2); g.fillStyle = sh ? col() : rfill(g, '#7a4a28', -1.4, 0, 6.2); g.fill(); if (sh) return; outline(g, 0.6);
      g.fillStyle = '#efe4c8'; ell(g, 0.6, 0, 3.6, 2); g.fill(); g.strokeStyle = '#a07a4a'; g.lineWidth = 0.4; for (const x of [-1.4, 0.4, 2]) { g.beginPath(); g.moveTo(x, -1); g.lineTo(x + 0.4, 1); g.stroke(); }
      ell(g, 5.2, 0, 2.7, 2.5); g.fillStyle = rfill(g, '#f2ead6', 5.2, 0, 2.7); g.fill(); outline(g, 0.5);
      g.beginPath(); g.moveTo(7.2, -1.1); g.quadraticCurveTo(10.4, -0.8, 9.8, 1.6); g.lineTo(7.4, 1); g.closePath(); g.fillStyle = '#f2c94c'; g.fill(); outline(g, 0.35);
      for (const s of [-1, 1]) { ell(g, 5.8, s * 1.5, 0.75, 0.65); g.fillStyle = '#ffb000'; g.fill(); ell(g, 6, s * 1.5, 0.35, 0.45); g.fillStyle = '#1a0e08'; g.fill(); }
      if (dive > 0.2) { g.strokeStyle = '#f2c94c'; g.lineWidth = 0.9; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(2, s * 1.4); g.lineTo(5 + dive * 3, s * 2.6); g.stroke(); } }
    };
    g.save(); g.translate(0, -lift); topDown(g, e, body, { x: 4, y: lift + 6 }); g.restore();
  }
  function drawAshDrake(g, e) {
    const sw = swingOf(e), step = e.moving ? e.walkT : 0, pulse = 0.55 + Math.sin(time * 4) * 0.3;
    shadow(g, 0, 8, 20, 6.5, 0.3);
    topDown(g, e, (g) => {
      const tail = Math.sin(time * 2 + step * 0.5) * 0.35;
      g.save(); g.translate(-12, 0); g.rotate(tail); g.beginPath(); g.moveTo(0, -3.4); g.quadraticCurveTo(-10, -2, -18, tail * 6); g.quadraticCurveTo(-10, 2, 0, 3.4); g.closePath(); g.fillStyle = vfill(g, '#3a3533', -4, 4, 0.2, -0.3); g.fill(); outline(g, 0.7);
      const gl = g.createRadialGradient(-18, tail * 6, 0, -18, tail * 6, 5); gl.addColorStop(0, `rgba(255,170,60,${pulse})`); gl.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gl; ell(g, -18, tail * 6, 5, 5); g.fill(); g.restore();
      for (const [x, s, p] of [[6, -1, 0], [6, 1, Math.PI], [-7, -1, Math.PI], [-7, 1, 0]]) {
        const a = Math.sin(step + p) * 0.4; g.save(); g.translate(x, s * 5); g.rotate(s * (0.9 + a));
        rr(g, 0, -1.6, 8, 3.2, 1.6); g.fillStyle = '#2e2a28'; g.fill(); outline(g, 0.5);
        g.fillStyle = '#efe6d0'; for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(8, k * 1.1); g.lineTo(10, k * 1.6); g.lineTo(8, k * 1.1 + 0.6); g.closePath(); g.fill(); }
        g.restore();
      }
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(3, s * 4); g.quadraticCurveTo(-2, s * 12, -9, s * 10); g.quadraticCurveTo(-5, s * 7, -6, s * 4); g.closePath(); g.fillStyle = vfill(g, '#6a2a1e', -10, 10); g.fill(); outline(g, 0.6); g.strokeStyle = '#2e2a28'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(3, s * 4); g.lineTo(-9, s * 10); g.stroke(); }
      ell(g, -2, 0, 13, 6.4); g.fillStyle = rfill(g, '#3a3533', -2, 0, 13); g.fill(); outline(g, 0.9);
      g.strokeStyle = `rgba(255,140,50,${pulse})`; g.lineWidth = 0.9; g.lineCap = 'round';
      for (const [x0, y0, x1, y1, x2, y2] of [[-8, -2, -5, 1, -3, -1.4], [2, 2.6, 4, 0, 6, 1.6], [-4, 3.4, -1, 2, 1, 3.8], [-10, 2, -12, 0.6, -13, 2.4]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
      g.fillStyle = '#5a4a44'; for (let x = -12; x <= 6; x += 3) { g.beginPath(); g.moveTo(x - 1.2, -0.9); g.lineTo(x + 1.4, 0); g.lineTo(x - 1.2, 0.9); g.closePath(); g.fill(); }
      g.save(); g.translate(11.6, 0);
      g.beginPath(); g.moveTo(-3, -3.6); g.quadraticCurveTo(5, -3.6, 8.6, 0); g.quadraticCurveTo(5, 3.6, -3, 3.6); g.closePath(); g.fillStyle = rfill(g, '#3a3533', 2, 0, 6); g.fill(); outline(g, 0.8);
      for (const s of [-1, 1]) { g.fillStyle = '#efe6d0'; g.beginPath(); g.moveTo(-1, s * 2.4); g.quadraticCurveTo(-5, s * 5.6, -7.6, s * 4.6); g.quadraticCurveTo(-4.6, s * 4, -2.6, s * 1.2); g.closePath(); g.fill(); outline(g, 0.4); ell(g, 3.4, s * 2, 1.1, 0.8); g.fillStyle = `rgba(255,190,60,${0.7 + pulse * 0.3})`; g.fill(); }
      g.restore();
      if (sw >= 0) { const L = 26 * Math.sin(sw * Math.PI); const fl = g.createLinearGradient(20, 0, 20 + L, 0); fl.addColorStop(0, 'rgba(255,230,140,0.95)'); fl.addColorStop(0.5, 'rgba(255,140,40,0.75)'); fl.addColorStop(1, 'rgba(200,60,20,0)'); g.fillStyle = fl; g.beginPath(); g.moveTo(19.6, -1.4); g.lineTo(20 + L, -L * 0.32); g.quadraticCurveTo(22 + L, 0, 20 + L, L * 0.32); g.lineTo(19.6, 1.4); g.closePath(); g.fill(); }
    });
    for (let k = 0; k < 5; k++) { const ph = (time * 0.6 + k / 5) % 1, x = Math.sin(k * 7.3 + time) * 10, y = 2 - ph * 22; g.fillStyle = `rgba(255,${150 + k * 15},60,${(1 - ph) * 0.8})`; ell(g, x, y, 0.7, 0.7); g.fill(); }
  }
  function drawGreenDragon(g, e) {
    const sw = swingOf(e), flap = Math.sin(time * (e.moving ? 3 : 1.5)), lift = 12;
    const span = 0.84 + flap * 0.16;
    const D = '#3f8a4a', DK = '#244f2b', BELLY = '#c9d38a', MEM = '#6cb468';
    const body = (g, sh) => {
      const col = () => 'rgba(0,0,0,0.2)';
      const tail = Math.sin(time * 1.6) * 0.3;
      g.save(); g.translate(-13, 0); g.rotate(tail);
      g.beginPath(); g.moveTo(0, -4.6); g.quadraticCurveTo(-12, -3.4, -23, tail * 10); g.quadraticCurveTo(-12, 3.4, 0, 4.6); g.closePath(); g.fillStyle = sh ? col() : vfill(g, D, -4, 4); g.fill();
      if (!sh) { outline(g, 0.7); g.fillStyle = '#d9e06a'; for (let x = -4; x >= -18; x -= 3.4) { g.beginPath(); g.moveTo(x + 1.2, -0.8); g.lineTo(x - 1.4, 0); g.lineTo(x + 1.2, 0.8); g.closePath(); g.fill(); } g.beginPath(); g.moveTo(-22, tail * 10); g.lineTo(-29, tail * 10 - 4.6); g.lineTo(-26.4, tail * 10); g.lineTo(-29, tail * 10 + 4.6); g.closePath(); g.fillStyle = DK; g.fill(); outline(g, 0.5); }
      g.restore();
      for (const s of [-1, 1]) {
        // the arm bone from the shoulder to the wrist, then three finger bones; the membrane hangs between them in scallops
        const sh0 = [5, s * 5.6], wrist = [-1 - flap * 1.5, s * 20 * span], f1 = [-4 - flap * 2, s * 36 * span], f2 = [-14, s * 33 * span], f3 = [-22, s * 22 * span], root = [-13, s * 5];
        const mem = () => { g.beginPath(); g.moveTo(...sh0); g.lineTo(...wrist); g.lineTo(...f1); g.quadraticCurveTo(-8, s * 29 * span, ...f2); g.quadraticCurveTo(-16, s * 24 * span, ...f3); g.quadraticCurveTo(-15, s * 13 * span, ...root); g.closePath(); };
        mem(); g.fillStyle = sh ? col() : vfill(g, MEM, -36, 36, 0.12, -0.3); g.fill();
        if (sh) continue;
        g.save(); mem(); g.clip(); g.fillStyle = 'rgba(30,70,35,0.28)'; g.beginPath(); g.moveTo(...wrist); g.lineTo(...f2); g.lineTo(...f3); g.closePath(); g.fill(); g.restore();
        mem(); outline(g, 0.8);
        g.strokeStyle = DK; g.lineCap = 'round'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(...sh0); g.lineTo(...wrist); g.stroke();
        g.lineWidth = 1.1; g.beginPath(); for (const f of [f1, f2, f3]) { g.moveTo(...wrist); g.lineTo(...f); } g.stroke();
        g.fillStyle = '#efe6d0'; g.beginPath(); g.moveTo(wrist[0], wrist[1]); g.lineTo(wrist[0] + 3, wrist[1] + s * 0.8); g.lineTo(wrist[0] + 0.4, wrist[1] - s * 1.4); g.closePath(); g.fill(); outline(g, 0.35);
      }
      for (const [x, s] of [[6, -1], [6, 1], [-8, -1], [-8, 1]]) { g.save(); g.translate(x, s * 6.4); g.rotate(s * 0.7); rr(g, 0, -1.4, 5.4, 2.8, 1.4); g.fillStyle = sh ? col() : D; g.fill(); if (!sh) { outline(g, 0.5); g.fillStyle = '#efe6d0'; for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(5.4, k); g.lineTo(7, k * 1.4); g.lineTo(5.4, k + 0.6); g.closePath(); g.fill(); } } g.restore(); }
      ell(g, -3, 0, 15.5, 8.6); g.fillStyle = sh ? col() : rfill(g, D, -3, 0, 15.5); g.fill(); if (sh) return; outline(g, 1);
      g.fillStyle = BELLY; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-15, s * 6.2); g.quadraticCurveTo(-3, s * 9.6, 9, s * 5.8); g.quadraticCurveTo(-3, s * 7.4, -15, s * 6.2); g.fill(); }
      g.strokeStyle = 'rgba(20,50,25,0.45)'; g.lineWidth = 0.5; for (let row = 0; row < 4; row++) for (let k = -5; k <= 3; k++) { const x = k * 3 + (row % 2) * 1.5, y = -4.6 + row * 3; g.beginPath(); g.arc(x, y, 1.3, 0.3, Math.PI - 0.3); g.stroke(); }
      g.fillStyle = '#d9e06a'; for (let x = -16; x <= 9; x += 3.1) { g.beginPath(); g.moveTo(x - 1.6, -1.2); g.lineTo(x + 2, 0); g.lineTo(x - 1.6, 1.2); g.closePath(); g.fill(); outline(g, 0.35); }
      g.save(); g.translate(13.4, 0);
      g.beginPath(); g.moveTo(-3, -5); g.quadraticCurveTo(6, -4.8, 11.4, -1.8); g.quadraticCurveTo(12.6, 0, 11.4, 1.8); g.quadraticCurveTo(6, 4.8, -3, 5); g.closePath(); g.fillStyle = rfill(g, D, 3, 0, 8); g.fill(); outline(g, 0.9);
      g.strokeStyle = DK; g.lineWidth = 0.5; g.beginPath(); g.moveTo(5, -2.6); g.quadraticCurveTo(8.6, -1.6, 10.6, -0.8); g.moveTo(5, 2.6); g.quadraticCurveTo(8.6, 1.6, 10.6, 0.8); g.stroke();
      for (const s of [-1, 1]) {
        g.fillStyle = '#efe6d0'; g.beginPath(); g.moveTo(-1, s * 3.4); g.quadraticCurveTo(-6.6, s * 7.6, -10, s * 6.4); g.quadraticCurveTo(-5.6, s * 5.4, -3, s * 2.2); g.closePath(); g.fill(); outline(g, 0.4);
        g.fillStyle = DK; g.beginPath(); g.moveTo(-2.4, s * 4.8); g.lineTo(-5.4, s * 9.4); g.lineTo(-0.4, s * 4.6); g.closePath(); g.fill();
        const glow = 0.6 + Math.sin(time * 3) * 0.3; const gl = g.createRadialGradient(4.6, s * 2.6, 0, 4.6, s * 2.6, 3); gl.addColorStop(0, `rgba(255,80,60,${glow})`); gl.addColorStop(1, 'rgba(255,80,60,0)'); g.fillStyle = gl; ell(g, 4.6, s * 2.6, 3, 3); g.fill();
        ell(g, 4.6, s * 2.6, 1.3, 0.9); g.fillStyle = '#ff4a3a'; g.fill(); ell(g, 4.8, s * 2.6, 0.4, 0.65); g.fillStyle = '#1a0e08'; g.fill(); ell(g, 11, s * 0.9, 0.5, 0.4); g.fillStyle = '#1a2a1a'; g.fill();
      }
      g.restore();
      if (sw >= 0) { const L = 30 * Math.sin(sw * Math.PI); for (let k = 0; k < 7; k++) { const t = k / 7, x = 25 + L * t, r = 2 + t * 6.4; g.fillStyle = `rgba(150,220,90,${(1 - t) * 0.6})`; ell(g, x, Math.sin(k * 2 + time * 6) * t * 3, r, r * 0.8); g.fill(); } }
    };
    g.save(); g.translate(0, -lift); topDown(g, e, body, { x: 6, y: lift + 8 }); g.restore();
  }

  const NEW_DRAW = { goblin: drawGoblin, sapper: drawSapper, brute: drawBrute, spider: drawSpider, giant_spider: drawGiantSpider, wolf: drawWolf, boar: drawBoar, grave_skeleton: drawSkeleton, zombie: drawZombie, ash_drake: drawAshDrake, rimhawk: drawRimhawk, green_dragon: drawGreenDragon, sheep: drawSheep, cow: drawCow };
  // how big each one is drawn, against its first sample size (owner: the cow bigger than the boar and the sheep, the ash drake
  // almost the green dragon's size, the green dragon almost double, the brute a little bigger)
  const MOB_SIZE = { cow: 1.4, brute: 1.2, ash_drake: 2.1, green_dragon: 1.9 };
  function drawNewMob(g, e) { g.save(); const k = MOB_SIZE[e.type] || 1; if (k !== 1) g.scale(k, k); (NEW_DRAW[e.type] || (() => {}))(g, e); g.restore(); }

  // ---------- people ----------
  // ================= THE PEOPLE: drawn in the approved knight's style =================
  // guard_m and guard_f (Thistledown's town guards), dwarf_guard (Deepholm), castle_guard (the goblin keep), elf_sentinel,
  // sky_sentinel (Aerie), vampire and count_ashvane (the Afterlands), ally_knight (the Duke's Dragon Killers: Sir Garrick,
  // or Sergeant Hale when e.ally === 'hale').
  // The knight's rules: no arms, a hand floating by the shoulder plate; a weapon rests upright with the hand at the waist,
  // a spear stands beside them, a bow hangs at the side; facing us or side-on the weapon is in front, facing away all they
  // hold is behind the body; the hand rises round the shoulder only in a swing (a swoosh), a spear jabs, a bow draws.

  const PPL_GOLD = '#e0b546';
  // shade() as a hex string, for the helpers that take a hex colour (vfill, rfill, shade itself)
  function ppl_hex(c, f) { const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(shade(c, f)); return '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join(''); }
  const ppl_metal = (g, c, y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, shade(c, 0.42)); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, -0.32)); return gr; };
  function ppl_gem(g, x, y, r, c, glow) {
    if (glow) { const gl = g.createRadialGradient(x, y, 0, x, y, r * 2.8); gl.addColorStop(0, glow); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; ell(g, x, y, r * 2.8, r * 2.8); g.fill(); }
    g.fillStyle = c; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.8, y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,20,10,0.6)'; g.lineWidth = 0.35; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)'; ell(g, x - r * 0.2, y - r * 0.35, r * 0.26, r * 0.26); g.fill();
  }
  function ppl_swish(g, cx, cy, ang, sw, rad, rgb, w) {
    if (sw < 0 || sw > 0.9) return; const a0 = ang - 1.4, a1 = ang + lerp(-1.4, 1.2, ease(sw)), al = Math.min(1, 1.5 * (1 - sw));
    g.save(); g.lineCap = 'round'; g.strokeStyle = `rgba(${rgb},${0.8 * al})`; g.lineWidth = w || 4.5; g.beginPath(); g.arc(cx, cy, rad, a0, a1); g.stroke();
    g.strokeStyle = `rgba(255,220,220,${0.7 * al})`; g.lineWidth = (w || 4.5) * 0.3; g.stroke(); g.restore();
  }
  function ppl_rivets(g, pts, c, r) { g.fillStyle = c; for (const [x, y] of pts) { ell(g, x, y, r || 0.5, r || 0.5); g.fill(); } }

  // ---------- how the weapon hand moves ----------
  const ppl_angOf = e => Math.atan2(e.facing.y, Math.abs(e.facing.x) || 0.0001);
  function ppl_restOf(e, rest, k) { const st = stepOf(e); return { a: rest.a + st * (k === undefined ? 0.08 : k), hx: rest.x, hy: rest.y + st * 0.5, sw: -1, ang: ppl_angOf(e), push: 0 }; }
  // a swing: round the shoulder, a swoosh behind it
  function ppl_swing(e, sh, rest) {
    const sw = swingOf(e); if (sw < 0) return ppl_restOf(e, rest);
    const ang = ppl_angOf(e), a = ang + lerp(-1.4, 1.2, ease(sw));
    return { a, hx: sh.x + Math.cos(a) * 4.6, hy: sh.y + Math.sin(a) * 4.6, sw, ang, push: 0 };
  }
  // a jab: the spear comes level with where they face and shoots out, then back
  function ppl_thrust(e, sh, rest) {
    const sw = swingOf(e); if (sw < 0) return ppl_restOf(e, rest, 0.04);
    const ang = ppl_angOf(e), push = Math.sin(Math.min(1, sw * 1.25) * Math.PI), a = ang + lerp(-0.22, 0.04, ease(sw)), r = 2.5 + push * 8;
    return { a, hx: sh.x + Math.cos(a) * r, hy: sh.y + Math.sin(a) * r, sw, ang, push };
  }
  // a draw: the bow comes up level with where they face, the string comes back
  function ppl_draw(e, sh, rest) {
    const sw = swingOf(e); if (sw < 0) return ppl_restOf(e, rest, 0.05);
    const ang = ppl_angOf(e); return { a: ang, hx: sh.x + Math.cos(ang) * 5.4, hy: sh.y + Math.sin(ang) * 5.4, sw, ang, push: 0 };
  }

  // ---------- the walking person (drawBiped's layering, with room for cloaks, wings, long hair and a collar) ----------
  function ppl_biped(g, e, P) {
    const f = face4(e), back = f === 'up', mirror = f === 'left', fx = mirror ? -e.facing.x : e.facing.x, fy = e.facing.y;
    const step = stepOf(e), bob = bobOf(e, P.bobK), s = P.s || 1;
    const sh = P.shoulder || { x: 6.6, y: 1.2 }, rest = P.rest || { a: -1.12, x: 10.4, y: 4.8 };
    const W = (P.pose || ppl_swing)(e, sh, rest);
    const C = { e, f, back, mirror, fx, fy, step, bob, W, sh };
    g.save(); shadow(g, 0, (P.ground || 12) * s, (P.shW || 9.8) * s, (P.shH || 3.9) * s);
    g.scale(mirror ? -s : s, s);
    const weapon = () => { if (!P.weapon) return; g.save(); g.translate(W.hx, W.hy + bob); g.rotate(W.a); P.weapon(g, W, C); g.restore(); if (P.hand) bipedHand(g, W.hx, W.hy + bob, P.hand); };
    const off = () => { g.save(); g.translate(-10.6, 3 + bob - step * 1.2); if (P.off) P.off(g, back, C); else bipedHand(g, 0.4, 0.6, P.offHand || P.hand); g.restore(); };
    const trail = () => { if (W.sw >= 0 && P.trail !== false) (P.trail || ((g, W, C) => swoosh(g, sh.x, sh.y + C.bob, W.ang, W.sw, P.swooshR || 27)))(g, W, C); };
    if (back) { off(); trail(); weapon(); }
    else if (P.backItem) P.backItem(g, C);
    if (typeof P.legs === 'function') P.legs(g, step, C); else bipedLegs(g, step, P.legs);
    g.translate(0, bob);
    P.torso(g, back, C);
    if (!back) off();
    P.head(g, C);
    if (P.top) P.top(g, back, C);
    g.translate(0, -bob);
    if (!back) { weapon(); trail(); }
    if (P.after) P.after(g, C);
    g.restore();
  }

  // plain or armoured legs: o = { c, metal, knee, boot, cuff, gap, hip, w, len, toe }
  function ppl_legs(o) {
    return (g, step) => {
      for (const s of [-1, 1]) {
        const off = step * 1.8 * s, x = s * (o.gap || 3.8), y = (o.hip || 6) + off, w = o.w || 5.2, L = o.len || 6.2;
        rr(g, x - w / 2, y - 2, w, L, Math.min(1.9, w / 2)); g.fillStyle = o.metal ? ppl_metal(g, o.c, y - 2, y + L - 2) : vfill(g, o.c, y - 2, y + L - 2, 0.2, -0.3); g.fill(); outline(g, 0.6);
        if (o.knee) { ell(g, x, y + 0.6, w * 0.38, 1.35); g.fillStyle = shade(o.knee, 0.45); g.fill(); g.strokeStyle = shade(o.knee, -0.5); g.lineWidth = 0.5; g.stroke(); }
        if (o.seam) { g.strokeStyle = shade(o.c, -0.35); g.lineWidth = 0.4; g.beginPath(); g.moveTo(x + s * 0.7, y - 1.4); g.lineTo(x + s * 0.5, y + L - 3); g.stroke(); }
        const by = y + L - 2.6, bw = w + (o.bootW || 0.8);
        rr(g, x - bw / 2, by, bw, 3.4, 1.5); g.fillStyle = vfill(g, o.boot, by, by + 3.4, 0.28, -0.32); g.fill(); outline(g, 0.6);
        if (o.cuff) { g.fillStyle = o.cuff; rr(g, x - bw / 2 - 0.1, by - 0.2, bw + 0.2, 1.1, 0.5); g.fill(); }
        if (o.toe) { ell(g, x, by + 2.4, bw * 0.34, 1); g.fillStyle = ppl_metal(g, o.toe, by + 1.4, by + 3.4); g.fill(); outline(g, 0.35); }
        if (o.wing) { g.fillStyle = '#fbfaf4'; g.strokeStyle = 'rgba(150,130,70,0.7)'; g.lineWidth = 0.35; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + s * bw * 0.45, by + 0.8); g.quadraticCurveTo(x + s * (bw * 0.5 + 2 + k * 0.6), by - 1.6 - k * 0.8, x + s * (bw * 0.5 + 3.2 + k * 0.4), by - 0.4 - k * 1.1); g.quadraticCurveTo(x + s * (bw * 0.5 + 1.6), by + 0.4, x + s * bw * 0.45, by + 1.6); g.closePath(); g.fill(); g.stroke(); } }
      }
    };
  }
  // a body: shoulders at y0, a little wider at the ribs, the waist at y1
  function ppl_bodyPath(g, w, bulge, low, y0, y1) { g.beginPath(); g.moveTo(-w, y0); g.quadraticCurveTo(-bulge, (y0 + y1) / 2 - 0.6, -low, y1); g.lineTo(low, y1); g.quadraticCurveTo(bulge, (y0 + y1) / 2 - 0.6, w, y0); g.quadraticCurveTo(0, y0 - 2.3, -w, y0); g.closePath(); }
  // round shoulder plates: o = { c, x, y, rx, ry, lame, trim, rivet, spikes }
  function ppl_pauldrons(g, o) {
    for (const s of [-1, 1]) {
      const x = s * (o.x || 9), y = o.y || -2.6, rx = o.rx || 4.6, ry = o.ry || 3.6;
      ell(g, x, y, rx, ry, s * 0.25); g.fillStyle = ppl_metal(g, o.c, y - ry, y + ry); g.fill(); outline(g, 0.7);
      if (o.lame) { ell(g, x + s * 0.4, y + ry * 0.5, rx * 0.82, ry * 0.62, s * 0.25); g.fillStyle = shade(o.c, -0.12); g.fill(); outline(g, 0.5); }
      g.strokeStyle = shade(o.c, 0.65); g.lineWidth = 0.7; g.beginPath(); g.arc(x, y - ry * 0.18, rx * 0.6, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
      if (o.trim) { g.strokeStyle = o.trim; g.lineWidth = 0.6; ell(g, x, y, rx, ry, s * 0.25); g.stroke(); }
      if (o.rivet) ppl_rivets(g, [[x, y + 0.4]], o.rivet, 0.55);
    }
  }
  // a face: o = { hy, r, skin, eye, brow, lash, mouth, blush, nose }
  function ppl_face(g, C, o) {
    const hy = o.hy, r = o.r, ex = C.fx * 1.8, ey = C.fy * 1.3;
    ell(g, 0, hy, r, r * 0.97); g.fillStyle = rfill(g, o.skin, 0, hy, r); g.fill(); outline(g, 0.85);
    if (C.back) return;
    g.fillStyle = o.blush || 'rgba(230,120,110,0.32)'; ell(g, -4 + ex, hy + 2.7 + ey, 1.3, 0.8); g.fill(); ell(g, 4 + ex, hy + 2.7 + ey, 1.3, 0.8); g.fill();
    for (const s of [-1, 1]) {
      const x = s * 2.6 + ex, y = hy + 0.8 + ey;
      if (o.glow) { const R = o.glowR || 2.6, gl = g.createRadialGradient(x, y, 0, x, y, R); gl.addColorStop(0, o.glow); gl.addColorStop(1, 'rgba(255,40,40,0)'); g.fillStyle = gl; ell(g, x, y, R, R); g.fill(); }
      ell(g, x, y, o.ew || 1.1, o.eh || 1.25, o.tilt ? s * o.tilt : 0); g.fillStyle = o.eye || '#2a1a10'; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)'; ell(g, x + 0.3, y - 0.4, 0.36, 0.36); g.fill();
      if (o.lash) { g.strokeStyle = o.lash; g.lineWidth = 0.45; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + s * 0.9, y - 0.8); g.lineTo(x + s * 1.8, y - 1.5); g.moveTo(x + s * 1.1, y - 0.2); g.lineTo(x + s * 2, y - 0.6); g.stroke(); }
      if (o.brow) { g.strokeStyle = o.brow; g.lineWidth = o.browW || 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * (o.browIn || 1.6) + ex, hy - 1.4 + ey + (o.browTilt || 0)); g.lineTo(s * 3.7 + ex, hy - 1.1 + ey - (o.browTilt || 0)); g.stroke(); }
    }
    if (o.nose !== false) { g.strokeStyle = shade(o.skin, -0.3); g.lineWidth = 0.5; g.beginPath(); g.arc(ex + 0.2, hy + 2.1 + ey, 0.7, 0.2, Math.PI * 0.9); g.stroke(); }
    if (o.mouth) o.mouth(g, ex, hy + 4 + ey);
  }

  // ---------- the spear (town guards, the castle guard, the sky sentinel, Sergeant Hale) ----------
  // o = { haft, blade, band, butt, pennant, trim, crude, wing, glow, tassel, len }
  function ppl_spear(g, W, o) {
    const L = o.len || 0, tip = 38.5 + L, base = 27 + L;
    if (W.sw >= 0 && W.sw < 0.92) {
      const a = 0.55 * (1 - W.sw) * (0.4 + (W.push || 0) * 0.6); g.strokeStyle = o.glow ? `rgba(200,235,255,${a})` : `rgba(255,255,255,${a})`; g.lineWidth = 0.9; g.lineCap = 'round';
      for (const [y, l] of [[-3.4, 13], [3.4, 13], [-6, 8], [6, 8], [0, 18]]) { g.beginPath(); g.moveTo(tip - 3 - l, y); g.lineTo(tip - 3, y * 0.7); g.stroke(); }
    }
    rr(g, -9, -1.15, base + 9.6, 2.3, 1.1); g.fillStyle = vfill(g, o.haft, -1.2, 1.2, 0.3, -0.35); g.fill(); outline(g, 0.5);
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-8, -0.5); g.lineTo(base - 1, -0.5); g.stroke();
    if (o.crude) { g.strokeStyle = shade(o.haft, -0.45); g.lineWidth = 0.4; for (const x of [4, 12, 19]) { g.beginPath(); g.moveTo(x, -1.1); g.lineTo(x + 1.6, 0.2); g.stroke(); } }
    // the grip, wrapped
    g.strokeStyle = o.grip || '#4a2e13'; g.lineWidth = 0.7; for (let x = -3; x <= 3; x += 1.5) { g.beginPath(); g.moveTo(x, -1.2); g.lineTo(x + 1, 1.2); g.stroke(); }
    rr(g, -10.2, -1.5, 2.4, 3, 0.8); g.fillStyle = ppl_metal(g, o.butt || '#5b606b', -1.5, 1.5); g.fill(); outline(g, 0.4);
    if (o.band) for (const x of [base - 8, 8]) { rr(g, x, -1.5, 1.4, 3, 0.4); g.fillStyle = o.band; g.fill(); }
    // the pennant, below the head
    if (o.pennant) {
      const wv = Math.sin(time * 5 + (o.seed || 0)) * 1.2 - (W.push || 0) * 2.5, x0 = base - 9.5, x1 = base - 2;
      const fl = () => { g.beginPath(); g.moveTo(x1, 1); g.lineTo(x0, 1); g.quadraticCurveTo(x0 - 1 + wv * 0.5, 4.6, x0 - 2 + wv, 9.2); g.lineTo(x0 + 1.2 + wv * 0.6, 6.4); g.quadraticCurveTo(x1 - 2, 4.4, x1, 1); g.closePath(); };
      fl(); g.fillStyle = vfill(g, o.pennant, 1, 9, 0.25, -0.3); g.fill(); outline(g, 0.45);
      if (o.trim) { g.save(); fl(); g.clip(); g.strokeStyle = o.trim; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x1 - 1, 2.6); g.quadraticCurveTo(x0 + 1 + wv * 0.4, 3.6, x0 - 0.8 + wv * 0.8, 7.4); g.stroke(); g.restore(); }
    }
    if (o.tassel) { const wv = Math.sin(time * 4) * 0.8 - (W.push || 0) * 2; g.strokeStyle = o.tassel; g.lineWidth = 0.9; g.lineCap = 'round'; for (const k of [0, 1, 2]) { g.beginPath(); g.moveTo(base - 0.6, 1.2); g.quadraticCurveTo(base - 3, 3.4 + k, base - 5.6 + wv, 4.8 + k * 1.1); g.stroke(); } }
    // the socket and the head
    rr(g, base - 1.6, -1.9, 3.2, 3.8, 0.8); g.fillStyle = ppl_metal(g, o.band || ppl_hex(o.blade, -0.25), -1.9, 1.9); g.fill(); outline(g, 0.4);
    if (o.wing) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(base, s * 1.6); g.quadraticCurveTo(base - 2.6, s * 5.6, base - 5.4, s * 6.4); g.quadraticCurveTo(base - 2.4, s * 3.8, base - 2.6, s * 1.6); g.closePath(); g.fillStyle = PPL_GOLD; g.fill(); outline(g, 0.35); }
    g.beginPath();
    if (o.crude) { g.moveTo(base + 1.4, -2.2); g.lineTo(base + 4, -3.4); g.lineTo(base + 4.6, -2.2); g.lineTo(base + 7.4, -3); g.lineTo(tip, 0.3); g.lineTo(base + 6, 2.6); g.lineTo(base + 5, 1.8); g.lineTo(base + 3.6, 3.2); g.lineTo(base + 1.4, 2.2); }
    else { g.moveTo(base + 1.4, -2.3); g.quadraticCurveTo(base + 6, -3.9, tip, 0); g.quadraticCurveTo(base + 6, 3.9, base + 1.4, 2.3); }
    g.closePath(); g.fillStyle = ppl_metal(g, o.blade, -3.6, 3.6); g.fill(); outline(g, 0.6);
    g.strokeStyle = shade(o.blade, 0.6); g.lineWidth = 0.6; g.beginPath(); g.moveTo(base + 2.4, -0.6); g.lineTo(tip - 2.2, -0.2); g.stroke();
    g.strokeStyle = shade(o.blade, -0.35); g.lineWidth = 0.4; g.beginPath(); g.moveTo(base + 2.4, 0.5); g.lineTo(tip - 3, 0.3); g.stroke();
    if (o.glow) { g.save(); g.globalAlpha = 0.4 + Math.sin(time * 4) * 0.15; g.strokeStyle = o.glow; g.lineWidth = 1.6; g.beginPath(); g.moveTo(base + 2, 1.2); g.lineTo(tip - 2.5, 0.6); g.stroke(); g.restore(); }
    if (W.sw >= 0 && W.push > 0.6) sparkle(g, tip + 0.6, 0, 1.6 + W.push, 'rgba(255,255,255,0.9)');
  }

  // ================= the town guards of Thistledown =================
  const PPL_TABARD = '#7a2e2e', PPL_MAIL = '#8f96a3';
  // the thistle on the tabard: on a cream roundel with a gold rim
  function ppl_thistle(g, x, y, k) {
    g.save(); g.translate(x, y); g.scale(k, k);
    ell(g, 0, 0, 2.9, 2.9); g.fillStyle = rfill(g, '#f2e8d0', 0, 0, 2.9); g.fill(); g.strokeStyle = PPL_GOLD; g.lineWidth = 0.6; g.stroke();
    g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, 0.8); g.lineTo(0, 2.4); g.stroke();
    g.fillStyle = '#4a8a3a'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, 1.8); g.quadraticCurveTo(s * 1.4, 1, s * 2, 1.8); g.quadraticCurveTo(s * 1.2, 2.3, 0, 2.1); g.closePath(); g.fill(); }
    ell(g, 0, 0.5, 1.05, 0.85); g.fillStyle = '#5a9a3a'; g.fill(); g.strokeStyle = '#2f5a2a'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(-0.8, 0.1); g.lineTo(0.6, 1); g.moveTo(0.8, 0.1); g.lineTo(-0.6, 1); g.stroke();
    g.strokeStyle = '#a45ad0'; g.lineWidth = 0.55; g.lineCap = 'round'; for (let k2 = 0; k2 < 5; k2++) { const a = -Math.PI / 2 + (k2 - 2) * 0.32; g.beginPath(); g.moveTo(0, -0.2); g.lineTo(Math.cos(a) * 2.1, -0.2 + Math.sin(a) * 2.1); g.stroke(); }
    g.fillStyle = '#d8a6f0'; for (let k2 = 0; k2 < 5; k2++) { const a = -Math.PI / 2 + (k2 - 2) * 0.32; ell(g, Math.cos(a) * 2.1, -0.2 + Math.sin(a) * 2.1, 0.32, 0.32); g.fill(); }
    g.restore();
  }
  function ppl_guardTorso(woman) {
    return (g, back, C) => {
      const hem = woman ? 10.6 : 9.6, w = woman ? 7.8 : 8.4;
      // the mail shirt, its hem in rings
      const body = () => ppl_bodyPath(g, w, w + 1.5, w - 0.6, -4, 8.6);
      body(); g.fillStyle = ppl_metal(g, PPL_MAIL, -5, 9); g.fill(); outline(g, 0.85);
      g.save(); body(); g.clip(); g.fillStyle = 'rgba(40,46,56,0.45)'; for (let y = -4; y < 9; y += 1.45) for (let x = -10 + (Math.round((y + 4) / 1.45) % 2) * 0.72; x < 10; x += 1.45) { ell(g, x, y, 0.42, 0.34); g.fill(); } g.restore();
      g.fillStyle = shade(PPL_MAIL, -0.15); for (let x = -w + 0.6; x <= w - 0.6; x += 1.5) { ell(g, x, 8.7, 0.85, 0.75); g.fill(); }
      // the tabard: Thistledown red, gold-edged, the thistle on the chest; a woman's is longer and flares
      const tab = () => { g.beginPath(); g.moveTo(-4.8, -5); g.quadraticCurveTo(0, -3.2, 4.8, -5); g.lineTo(woman ? 6.4 : 5.4, hem); g.lineTo(woman ? -6.4 : -5.4, hem); g.closePath(); };
      tab(); g.fillStyle = vfill(g, PPL_TABARD, -5, hem, 0.24, -0.3); g.fill(); outline(g, 0.7);
      g.save(); tab(); g.clip(); g.strokeStyle = PPL_GOLD; g.lineWidth = 0.75; tab(); g.stroke();
      g.strokeStyle = shade(PPL_TABARD, -0.4); g.lineWidth = 0.5; g.beginPath(); g.moveTo(-2.6, 6.2); g.quadraticCurveTo(-3.2, 8.4, -3.8, hem); g.moveTo(2.6, 6.2); g.quadraticCurveTo(3.2, 8.4, 3.8, hem); g.stroke(); g.restore();
      ppl_thistle(g, 0, back ? -0.6 : 0, back ? 0.8 : 0.95);
      // the belt and its buckle; the man's keys, the woman's horn
      g.fillStyle = '#4a3020'; rr(g, -w - 0.2, 4.4, (w + 0.2) * 2, 1.7, 0.6); g.fill(); outline(g, 0.4);
      if (!back) {
        rr(g, -1.3, 4.1, 2.6, 2.3, 0.5); g.fillStyle = PPL_GOLD; g.fill(); outline(g, 0.35); g.fillStyle = '#4a3020'; g.fillRect(-0.5, 4.7, 1, 1.1);
        if (!woman) { g.strokeStyle = PPL_GOLD; g.lineWidth = 0.5; g.beginPath(); g.arc(5.6, 6.9, 1, 0, Math.PI * 2); g.stroke(); for (const [x, a] of [[5, 0.25], [6.2, -0.2]]) { g.save(); g.translate(x, 7.6); g.rotate(a); g.fillStyle = PPL_GOLD; g.fillRect(-0.25, 0, 0.5, 3); g.fillRect(0, 2.2, 1, 0.5); g.fillRect(0, 2.9, 0.8, 0.45); ell(g, 0, -0.2, 0.6, 0.6); g.fill(); g.restore(); } }
        else { g.save(); g.translate(-6.2, 6.6); g.beginPath(); g.moveTo(-2.4, -0.6); g.quadraticCurveTo(0, 2, 2.8, -0.4); g.lineTo(3.1, 1.2); g.quadraticCurveTo(0, 3.6, -2.4, 0.4); g.closePath(); g.fillStyle = vfill(g, '#e9dcb8', -1, 3); g.fill(); outline(g, 0.4); rr(g, 2.6, -0.7, 1.4, 2.2, 0.5); g.fillStyle = PPL_GOLD; g.fill(); g.restore(); }
      }
      ppl_pauldrons(g, { c: PPL_MAIL, x: 8.6, y: -2.8, rx: 4.1, ry: 3.2, rivet: shade(PPL_MAIL, 0.6) });
    };
  }
  // a guard's kettle hat: a round crown and a wide brim, a ridge and rivets
  function ppl_kettleHat(g, hy, r, back, ex, plume) {
    const c = PPL_MAIL;
    ell(g, ex * 0.3, hy - 2.3, r + 3.8, 2.4); g.fillStyle = ppl_metal(g, c, hy - 4.7, hy + 0.1); g.fill(); outline(g, 0.75);
    if (!back) { g.strokeStyle = shade(c, 0.55); g.lineWidth = 0.6; g.beginPath(); g.ellipse(ex * 0.3, hy - 2.3, r + 3.2, 1.8, 0, 0.15, Math.PI - 0.15); g.stroke(); }
    const dome = () => { g.beginPath(); g.moveTo(-r + 0.5, hy - 2.6); g.bezierCurveTo(-r + 0.1, hy - 12.2, r - 0.1, hy - 12.2, r - 0.5, hy - 2.6); g.closePath(); };
    dome(); g.fillStyle = ppl_metal(g, c, hy - 11, hy - 2.6); g.fill(); outline(g, 0.8);
    g.fillStyle = shade(c, -0.28); g.beginPath(); g.moveTo(-r + 0.5, hy - 2.6); g.lineTo(-r + 0.55, hy - 4.1); g.quadraticCurveTo(0, hy - 5, r - 0.55, hy - 4.1); g.lineTo(r - 0.5, hy - 2.6); g.quadraticCurveTo(0, hy - 3.4, -r + 0.5, hy - 2.6); g.fill();
    ppl_rivets(g, [[-4.6, hy - 3.4], [-1.6, hy - 3.9], [1.6, hy - 3.9], [4.6, hy - 3.4]], shade(c, 0.6), 0.45);
    g.strokeStyle = shade(c, 0.65); g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, hy - 9.6); g.lineTo(0, hy - 4.6); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-r + 1.6, hy - 4.6); g.quadraticCurveTo(-r + 1.4, hy - 8.4, -2.2, hy - 9.4); g.quadraticCurveTo(-r + 2.8, hy - 7.6, -r + 2.8, hy - 4.6); g.closePath(); g.fill();
    if (plume) { const wv = Math.sin(time * 3.4) * 0.6; g.fillStyle = plume; g.beginPath(); g.moveTo(r - 2.4, hy - 6.4); g.quadraticCurveTo(r + 1, hy - 12.6, r + 4.2 + wv, hy - 11.6); g.quadraticCurveTo(r + 1.6, hy - 10, r - 0.8, hy - 5.4); g.closePath(); g.fill(); outline(g, 0.45); g.strokeStyle = shade(plume, 0.4); g.lineWidth = 0.4; g.beginPath(); g.moveTo(r - 1.6, hy - 6.2); g.quadraticCurveTo(r + 1, hy - 10.6, r + 3.6 + wv, hy - 11.4); g.stroke(); }
  }
  function ppl_guardHead(woman) {
    const skin = '#e8b790', hair = woman ? '#c9843a' : '#2a1a0a', hy = -10.2, r = 7.4;
    return (g, C) => {
      const ex = C.fx * 1.8, ey = C.fy * 1.3;
      if (C.back) {
        ell(g, 0, hy, r, r * 0.97); g.fillStyle = rfill(g, hair, 0, hy, r); g.fill(); outline(g, 0.8);
        g.strokeStyle = shade(hair, 0.25); g.lineWidth = 0.4; for (const x of [-3, 0, 3]) { g.beginPath(); g.moveTo(x, hy - 2); g.quadraticCurveTo(x * 1.2, hy + 3, x * 0.9, hy + 6); g.stroke(); }
        if (woman) ppl_braid(g, [[0, hy + 4.6], [0.4, hy + 8], [-0.2, hy + 11.2], [0.3, hy + 14.2]], hair);
        ppl_kettleHat(g, hy, r, true, 0, woman ? null : '#b0202c');
        return;
      }
      ppl_face(g, C, { hy, r, skin, eye: '#2a1a10', brow: shade(hair, -0.1), lash: woman ? '#2a1a10' : null, browW: woman ? 0.55 : 0.8,
        mouth: woman ? (g, x, y) => { g.strokeStyle = '#a0484a'; g.lineWidth = 0.6; g.lineCap = 'round'; g.beginPath(); g.arc(x, y - 1.2, 1.2, 0.35, Math.PI - 0.35); g.stroke(); } : null });
      // hair under the hat: the man's sideburns and moustache, the woman's locks and braid over the shoulder
      g.fillStyle = hair;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(s * (r - 0.2), hy - 2.6); g.quadraticCurveTo(s * (r + 0.6), hy + (woman ? 3 : 1), s * (r - (woman ? 0.6 : 1.4)), hy + (woman ? 5.4 : 2.8)); g.quadraticCurveTo(s * (r - 2.4), hy + (woman ? 1.6 : 0.4), s * (r - 2.2), hy - 2.6); g.closePath(); g.fill();
      }
      if (!woman) { g.fillStyle = '#3a2414'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(ex, hy + 2.8 + ey); g.quadraticCurveTo(ex + s * 1.8, hy + 2.2 + ey, ex + s * 3.2, hy + 3.9 + ey); g.quadraticCurveTo(ex + s * 1.6, hy + 3.6 + ey, ex, hy + 3.5 + ey); g.closePath(); g.fill(); } }
      else ppl_braid(g, [[r - 1.4, hy + 4.2], [r - 0.6, hy + 7.4], [r - 0.2, hy + 10.4], [r - 0.6, hy + 13.2]], hair);
      ppl_kettleHat(g, hy, r, false, ex, woman ? null : '#b0202c');
    };
  }
  function ppl_braid(g, pts, hair) {
    for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i]; ell(g, x, y, 1.7 - i * 0.12, 1.9, i % 2 ? 0.35 : -0.35); g.fillStyle = vfill(g, hair, y - 2, y + 2, 0.25, -0.25); g.fill(); outline(g, 0.45); }
    const [x, y] = pts[pts.length - 1]; g.fillStyle = '#b0202c'; rr(g, x - 1.1, y + 1.4, 2.2, 1.1, 0.4); g.fill(); g.fillStyle = hair; g.beginPath(); g.moveTo(x - 1, y + 2.4); g.lineTo(x, y + 4.6); g.lineTo(x + 1, y + 2.4); g.closePath(); g.fill();
  }
  function ppl_guardSpear(g, W, C) { ppl_spear(g, W, { haft: '#8a6a3a', blade: '#c9ccd3', band: '#9aa0aa', pennant: '#a52a2a', trim: PPL_GOLD, seed: C.e.seed }); }
  function ppl_drawGuard(g, e, woman) {
    ppl_biped(g, e, {
      hand: '#6b4a2e', legs: ppl_legs({ c: '#4a4448', boot: '#3a2a1c', cuff: '#6b4a2e', seam: true, w: woman ? 4.8 : 5.2, gap: woman ? 3.5 : 3.8 }),
      torso: ppl_guardTorso(woman), head: ppl_guardHead(woman),
      weapon: ppl_guardSpear, pose: ppl_thrust, rest: { a: -1.48, x: 10.6, y: 4.6 }, trail: false,
    });
  }
  const ppl_drawGuardM = (g, e) => ppl_drawGuard(g, e, false);
  const ppl_drawGuardF = (g, e) => ppl_drawGuard(g, e, true);

  // ================= the dwarf guard: short and broad, a great ginger beard, a double-bitted axe =================
  const PPL_DW = { tunic: '#7a2e2e', beard: '#c9843a', iron: '#8f96a3', skin: '#e8b08a', hy: -5 };
  function ppl_dwarfTorso(g, back) {
    const body = () => ppl_bodyPath(g, 10, 12, 9.6, -1.6, 8.8);
    body(); g.fillStyle = vfill(g, PPL_DW.tunic, -4, 9, 0.22, -0.32); g.fill(); outline(g, 0.9);
    // a mail skirt below the belt
    g.save(); body(); g.clip(); g.fillStyle = ppl_metal(g, PPL_DW.iron, 5, 10); g.fillRect(-12, 5.6, 24, 5); g.fillStyle = 'rgba(40,46,56,0.45)'; for (let y = 6.2; y < 10; y += 1.4) for (let x = -11 + (Math.round(y / 1.4) % 2) * 0.7; x < 11; x += 1.4) { ell(g, x, y, 0.42, 0.34); g.fill(); } g.restore();
    g.fillStyle = shade(PPL_DW.iron, -0.12); for (let x = -9; x <= 9; x += 1.5) { ell(g, x, 8.9, 0.85, 0.75); g.fill(); }
    if (!back) { g.strokeStyle = shade(PPL_DW.tunic, -0.4); g.lineWidth = 0.6; g.beginPath(); g.moveTo(-6.6, -0.4); g.quadraticCurveTo(-7.4, 2.4, -6.8, 4.6); g.moveTo(6.6, -0.4); g.quadraticCurveTo(7.4, 2.4, 6.8, 4.6); g.stroke(); }
    // the broad belt and its great square buckle
    g.fillStyle = '#4a3020'; rr(g, -10.8, 3.8, 21.6, 2.4, 0.8); g.fill(); outline(g, 0.45);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(-10.4, 4, 20.8, 0.5);
    if (!back) { rr(g, -1.7, 3.4, 3.4, 3.2, 0.6); g.fillStyle = ppl_metal(g, PPL_GOLD, 3.4, 6.6); g.fill(); outline(g, 0.45); rr(g, -0.9, 4.2, 1.8, 1.6, 0.3); g.fillStyle = '#7a5a20'; g.fill(); ell(g, 0, 5, 0.45, 0.45); g.fillStyle = '#c0392b'; g.fill(); }
    ppl_pauldrons(g, { c: PPL_DW.iron, x: 10, y: -0.8, rx: 4.8, ry: 3.6, lame: true, rivet: '#d9b25c' });
    for (const s of [-1, 1]) ppl_rivets(g, [[s * 8.2, -2.8], [s * 11.8, -1.6]], '#d9b25c', 0.42);
  }
  // a plait of hair: a chain of lobes, an iron ring, a tuft
  function ppl_plait(g, x0, y0, x1, y1, n, c, ring) {
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t); ell(g, x, y, 1.45 - i * 0.08, (y1 - y0) / n * 0.62, i % 2 ? 0.35 : -0.35); g.fillStyle = vfill(g, c, y - 1.4, y + 1.4, 0.25, -0.28); g.fill(); outline(g, 0.4); }
    rr(g, x1 - 1.3, y1 - 0.3, 2.6, 1.3, 0.5); g.fillStyle = ppl_metal(g, ring, y1 - 0.3, y1 + 1); g.fill(); outline(g, 0.35);
    g.fillStyle = c; g.beginPath(); g.moveTo(x1 - 1.1, y1 + 0.9); g.lineTo(x1 - 0.3, y1 + 2.8); g.lineTo(x1 + 0.2, y1 + 1.6); g.lineTo(x1 + 0.8, y1 + 2.6); g.lineTo(x1 + 1.1, y1 + 0.9); g.closePath(); g.fill(); outline(g, 0.3);
  }
  function ppl_dwarfHead(g, C) {
    const hy = PPL_DW.hy, r = 7.3, ex = C.fx * 1.6, ey = C.fy * 0.9, B = PPL_DW.beard;
    if (C.back) {
      for (const s of [-1, 1]) { ell(g, s * 6, hy + 5, 2.8, 3.2, s * -0.3); g.fillStyle = vfill(g, B, hy + 2, hy + 8); g.fill(); outline(g, 0.5); }
      ell(g, 0, hy, r, r * 0.97); g.fillStyle = rfill(g, B, 0, hy, r); g.fill(); outline(g, 0.8);
      // a mail curtain hangs from the helm over the back of the neck
      const mail = () => { g.beginPath(); g.moveTo(-r - 0.6, hy - 1.8); g.lineTo(-r - 0.4, hy + 3.4); g.quadraticCurveTo(0, hy + 7.4, r + 0.4, hy + 3.4); g.lineTo(r + 0.6, hy - 1.8); g.closePath(); };
      mail(); g.fillStyle = ppl_metal(g, PPL_DW.iron, hy - 2, hy + 6); g.fill(); outline(g, 0.6);
      g.save(); mail(); g.clip(); g.fillStyle = 'rgba(40,46,56,0.5)'; for (let y = hy - 1.4; y < hy + 7; y += 1.4) for (let x = -9 + (Math.round(y / 1.4) % 2) * 0.7; x < 9; x += 1.4) { ell(g, x, y, 0.42, 0.34); g.fill(); } g.restore();
      ppl_plait(g, 0, hy + 5.2, 0.2, hy + 10.4, 3, B, PPL_DW.iron);
      ppl_dwarfHelm(g, hy, r, true, 0); return;
    }
    ppl_face(g, C, { hy, r, skin: PPL_DW.skin, eye: '#1e140c', brow: shade(B, -0.2), browW: 1.6, browIn: 1.1, browTilt: -0.2, nose: false, blush: 'rgba(225,95,80,0.45)' });
    // the beard: cheek to cheek, a great rounded mass, and two plaits below it with iron rings
    const bx = ex * 0.6;
    for (const s of [-1, 1]) ppl_plait(g, s * 2.6 + bx, hy + 8.2, s * 3 + bx, hy + 13.2, 3, B, PPL_DW.iron);
    const beard = () => {
      g.beginPath(); g.moveTo(-r + 0.2 + bx, hy - 0.2); g.quadraticCurveTo(-r - 2.6 + bx, hy + 5.4, -5 + bx, hy + 8.8);
      g.quadraticCurveTo(-2.6 + bx, hy + 10.4, bx, hy + 9.4); g.quadraticCurveTo(2.6 + bx, hy + 10.4, 5 + bx, hy + 8.8);
      g.quadraticCurveTo(r + 2.6 + bx, hy + 5.4, r - 0.2 + bx, hy - 0.2); g.quadraticCurveTo(r - 1.8 + bx, hy + 3.6, 3 + bx, hy + 3.8); g.quadraticCurveTo(bx, hy + 4.6, -3 + bx, hy + 3.8); g.quadraticCurveTo(-r + 1.8 + bx, hy + 3.6, -r + 0.4 + bx, hy + 0.2); g.closePath();
    };
    beard(); g.fillStyle = vfill(g, B, hy + 1, hy + 9, 0.22, -0.25); g.fill(); outline(g, 0.75);
    g.save(); beard(); g.clip(); g.strokeStyle = shade(B, -0.3); g.lineWidth = 0.45; g.lineCap = 'round';
    for (const [x, y] of [[-5.6, 4.6], [-2.6, 6.4], [0, 5.6], [2.6, 6.4], [5.6, 4.6], [-4.2, 7.6], [1.2, 8.2], [4.2, 7.6], [-7, 2.6], [7, 2.6]]) { g.beginPath(); g.arc(x + bx, hy + y, 1, 0.4, 2.7); g.stroke(); }
    g.strokeStyle = 'rgba(255,230,180,0.35)'; for (const [x, y] of [[-3.6, 5.2], [3.4, 5.4], [-1, 7]]) { g.beginPath(); g.arc(x + bx, hy + y, 0.8, 3.6, 5.6); g.stroke(); } g.restore();
    // the moustache, curling at the ends
    g.fillStyle = vfill(g, ppl_hex(B, -0.08), hy + 2.6, hy + 5.6, 0.2, -0.25);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(ex, hy + 3 + ey); g.quadraticCurveTo(ex + s * 3.2, hy + 2.2 + ey, ex + s * 5.4, hy + 4.4 + ey); g.quadraticCurveTo(ex + s * 6.4, hy + 3.4 + ey, ex + s * 6.2, hy + 2.6 + ey); g.quadraticCurveTo(ex + s * 7.2, hy + 4.8 + ey, ex + s * 5.2, hy + 5.4 + ey); g.quadraticCurveTo(ex + s * 2.6, hy + 4.8 + ey, ex, hy + 4.2 + ey); g.closePath(); g.fill(); outline(g, 0.35); }
    ppl_dwarfHelm(g, hy, r, false, ex);
    // the big round nose, below the nose guard
    ell(g, ex, hy + 2.5 + ey, 1.75, 1.5); g.fillStyle = rfill(g, '#e8907a', ex, hy + 2.5 + ey, 1.75); g.fill(); outline(g, 0.45);
  }
  function ppl_dwarfHelm(g, hy, r, back, ex) {
    const c = PPL_DW.iron;
    if (!back) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r + 0.6), hy - 1.4); g.lineTo(s * (r + 0.9), hy + 2.2); g.lineTo(s * (r - 1.4), hy + 3); g.lineTo(s * (r - 1.8), hy - 0.6); g.closePath(); g.fillStyle = ppl_metal(g, c, hy - 1, hy + 3); g.fill(); outline(g, 0.5); ppl_rivets(g, [[s * (r - 0.3), hy + 1.2]], '#d9b25c', 0.4); }
    g.beginPath(); g.arc(0, hy - 0.8, r + 0.9, Math.PI, 0); g.closePath(); g.fillStyle = ppl_metal(g, c, hy - r - 1, hy); g.fill(); outline(g, 0.85);
    g.fillStyle = shade(c, -0.28); g.fillRect(-r - 0.9, hy - 2.6, (r + 0.9) * 2, 2); g.strokeStyle = OUT; g.lineWidth = 0.5; g.strokeRect(-r - 0.9, hy - 2.6, (r + 0.9) * 2, 2);
    ppl_rivets(g, [[-6.4, hy - 1.6], [-3.2, hy - 1.6], [0, hy - 1.6], [3.2, hy - 1.6], [6.4, hy - 1.6]], '#d9b25c', 0.45);
    g.strokeStyle = shade(c, 0.6); g.lineWidth = 1.2; g.beginPath(); g.arc(0, hy - 0.8, r + 0.9, Math.PI * 1.32, Math.PI * 1.68); g.stroke();
    rr(g, -1, hy - r - 2.4, 2, 2.4, 0.8); g.fillStyle = ppl_metal(g, PPL_GOLD, hy - r - 2.4, hy - r); g.fill(); outline(g, 0.4);
    g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, hy - r - 0.4); g.lineTo(0, hy - 2.6); g.stroke();
    if (!back) { rr(g, -0.85 + ex * 0.7, hy - 1.2, 1.7, 3, 0.7); g.fillStyle = ppl_metal(g, c, hy - 1, hy + 1.8); g.fill(); outline(g, 0.45); }
  }
  function ppl_dwarfAxe(g, W) {
    rr(g, -7, -1.35, 33, 2.7, 1.2); g.fillStyle = vfill(g, '#6b4a2a', -1.4, 1.4, 0.3, -0.35); g.fill(); outline(g, 0.5);
    g.strokeStyle = '#3a2410'; g.lineWidth = 0.7; for (let x = -3; x <= 3; x += 1.5) { g.beginPath(); g.moveTo(x, -1.35); g.lineTo(x + 1, 1.35); g.stroke(); }
    for (const x of [-7.6, 6, 15]) { rr(g, x, -1.7, 1.6, 3.4, 0.5); g.fillStyle = ppl_metal(g, PPL_GOLD, -1.7, 1.7); g.fill(); outline(g, 0.3); }
    g.beginPath(); g.moveTo(25.6, -1.2); g.lineTo(30.4, 0); g.lineTo(25.6, 1.2); g.closePath(); g.fillStyle = ppl_metal(g, '#c8ccd4', -1.2, 1.2); g.fill(); outline(g, 0.4);
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(18.6, s * 1.4); g.quadraticCurveTo(16.4, s * 10.6, 26.6, s * 11.8); g.quadraticCurveTo(23.6, s * 6.4, 26.6, s * 1.4); g.closePath();
      g.fillStyle = ppl_metal(g, '#a9adb5', -12, 12); g.fill(); outline(g, 0.7);
      g.strokeStyle = '#eef0f4'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(26.2, s * 10.6); g.quadraticCurveTo(23.8, s * 6.4, 25.6, s * 2.2); g.stroke();
      g.strokeStyle = 'rgba(60,66,76,0.55)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(19.6, s * 2.6); g.quadraticCurveTo(19.4, s * 7.6, 24.4, s * 9.6); g.stroke();
      ppl_rivets(g, [[21.4, s * 4.4]], '#d9b25c', 0.5);
    }
    rr(g, 17.8, -2.4, 9.6, 4.8, 1.2); g.fillStyle = ppl_metal(g, '#6b707b', -2.4, 2.4); g.fill(); outline(g, 0.5);
    ppl_rivets(g, [[19.6, 0], [25.4, 0]], '#d9b25c', 0.55);
  }
  function ppl_drawDwarf(g, e) {
    ppl_biped(g, e, {
      hand: '#c9a06a', legs: ppl_legs({ c: '#5a3a2a', boot: '#3a2a1c', toe: '#8f96a3', hip: 7.4, len: 4.6, w: 5.8, gap: 4.4, bootW: 1.4 }),
      torso: ppl_dwarfTorso, head: ppl_dwarfHead, offHand: '#c9a06a',
      weapon: ppl_dwarfAxe, rest: { a: -1.24, x: 11.8, y: 5.2 }, shoulder: { x: 7.4, y: 2.2 }, swooshR: 28, ground: 12.2, shW: 11.4, shH: 4.2, bobK: 1.1,
    });
  }

  // ================= the goblin castle guard: a tall-spiked helm too big for him, the keep's red tabard, a notched spear =================
  const PPL_CG = { skin: '#74bd46', tabard: '#7a2e2e', helm: '#5f6068' };
  function ppl_castleTorso(g, back) {
    const c = '#5a3a22';
    g.beginPath(); g.moveTo(-7, -3.5); g.quadraticCurveTo(-8.6, 2, -7, 7.6); g.lineTo(7, 7.6); g.quadraticCurveTo(8.6, 2, 7, -3.5); g.quadraticCurveTo(0, -5.6, -7, -3.5); g.closePath();
    g.fillStyle = vfill(g, c, -4, 8); g.fill(); outline(g, 0.8);
    // the keep's tabard, ragged at the hem, a gold crown daubed on the chest
    const tab = () => { g.beginPath(); g.moveTo(-4.4, -4.4); g.quadraticCurveTo(0, -3, 4.4, -4.4); g.lineTo(5, 8.2); g.lineTo(3.4, 9.6); g.lineTo(2, 8.4); g.lineTo(0.4, 10); g.lineTo(-1.4, 8.6); g.lineTo(-3, 9.8); g.lineTo(-5, 8.4); g.closePath(); };
    tab(); g.fillStyle = vfill(g, PPL_CG.tabard, -4, 10, 0.22, -0.32); g.fill(); outline(g, 0.6);
    if (!back) {
      g.fillStyle = PPL_GOLD; g.beginPath(); g.moveTo(-2.4, 1.4); g.lineTo(-2.6, -1.8); g.lineTo(-1.2, -0.4); g.lineTo(0, -2.6); g.lineTo(1.2, -0.4); g.lineTo(2.6, -1.8); g.lineTo(2.4, 1.4); g.closePath(); g.fill(); g.strokeStyle = 'rgba(80,50,10,0.7)'; g.lineWidth = 0.35; g.stroke();
      g.fillStyle = '#c0392b'; ell(g, 0, 0.4, 0.5, 0.5); g.fill();
      g.strokeStyle = 'rgba(40,20,10,0.4)'; g.lineWidth = 0.4; g.setLineDash([0.7, 0.6]); g.beginPath(); g.moveTo(-3.6, 6.4); g.lineTo(3.8, 6.2); g.stroke(); g.setLineDash([]);
    }
    g.strokeStyle = '#c9a66b'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-7.4, 4.2); g.quadraticCurveTo(0, 5.6, 7.4, 4.2); g.stroke();
    if (!back) { g.beginPath(); g.moveTo(1, 5); g.quadraticCurveTo(1.6, 7.2, 0.8, 8.6); g.stroke(); }
    ppl_pauldrons(g, { c: '#7d8087', x: 7.8, y: -2.6, rx: 3.6, ry: 2.8, rivet: '#c8ccd4' });
  }
  function ppl_castleHelm(g, hy, r, back, fx) {
    g.save(); g.translate(0, hy); g.rotate(0.07); g.translate(0, -hy);
    // the spike and its red tuft
    const top = hy - r - 10.4;
    rr(g, -0.7, top, 1.4, 8, 0.5); g.fillStyle = ppl_metal(g, '#8f96a3', top, top + 8); g.fill(); outline(g, 0.4);
    ell(g, 0, top - 0.4, 1.3, 1.3); g.fillStyle = rfill(g, '#c8ccd4', 0, top - 0.4, 1.3); g.fill(); outline(g, 0.35);
    const wv = Math.sin(time * 4 + 1) * 0.8; g.fillStyle = '#b0202c'; g.beginPath(); g.moveTo(0, top - 0.4); g.quadraticCurveTo(-3.4, top - 0.6, -5.2 + wv, top + 4); g.quadraticCurveTo(-2.4, top + 2, -0.6, top + 0.8); g.closePath(); g.fill(); outline(g, 0.35);
    // the pot helm, slipping down over his brows, a dent in one side
    g.beginPath(); g.arc(0, hy - 1.6, r + 1.3, Math.PI, 0); g.closePath(); g.fillStyle = ppl_metal(g, PPL_CG.helm, hy - r - 2, hy - 1.6); g.fill(); outline(g, 0.85);
    g.fillStyle = 'rgba(20,20,26,0.35)'; ell(g, 4.6, hy - 6.4, 1.6, 1.1, 0.4); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.5; g.beginPath(); g.arc(4.4, hy - 6.6, 1.6, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
    g.fillStyle = shade(PPL_CG.helm, -0.3); g.fillRect(-r - 1.3, hy - 3.6, (r + 1.3) * 2, 2.2); g.strokeStyle = OUT; g.lineWidth = 0.5; g.strokeRect(-r - 1.3, hy - 3.6, (r + 1.3) * 2, 2.2);
    ppl_rivets(g, [[-6.6, hy - 2.5], [-3.3, hy - 2.5], [0, hy - 2.5], [3.3, hy - 2.5], [6.6, hy - 2.5]], '#c8ccd4', 0.45);
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 0.9; g.beginPath(); g.arc(0, hy - 1.6, r - 0.4, Math.PI * 1.2, Math.PI * 1.45); g.stroke();
    g.restore();
  }
  function ppl_castleSpear(g, W) { ppl_spear(g, W, { haft: '#7a5a3a', blade: '#a7a39a', crude: true, tassel: '#b0202c', butt: '#4a4f5a', len: -1.5 }); }
  function ppl_drawCastleGuard(g, e) {
    ppl_biped(g, e, {
      hand: PPL_CG.skin, legs: { c: '#4a3a28', wrap: '#9a3a32', barefoot: true, foot: PPL_CG.skin },
      torso: ppl_castleTorso, head: (g, C) => goblinHead(g, C.e, { skin: PPL_CG.skin, hat: ppl_castleHelm }, C.back, C.fx),
      weapon: ppl_castleSpear, pose: ppl_thrust, rest: { a: -1.46, x: 10, y: 4.4 }, trail: false, ground: 11.4, shW: 9.5, shH: 3.8,
    });
  }

  // ================= the elf sentinel: slim and tall, long gold hair, a longbow at the side, a quiver on the back =================
  const PPL_ELF = { skin: '#f0d0b0', hair: '#e8d9a0', tunic: '#3f7a3a', leather: '#6b4a2a', hy: -11, r: 7 };
  function ppl_elfHairBack(g, C, front) {
    // the long hair that falls behind the shoulders (drawn before the body facing us, over the back facing away)
    const hy = PPL_ELF.hy, H = PPL_ELF.hair, sway = Math.sin(time * 2 + (C.e.seed || 0)) * 0.5 + C.step * 0.4;
    g.save(); g.translate(0, C.bob);
    g.beginPath(); g.moveTo(-6.4, hy - 3); g.quadraticCurveTo(-9.6, hy + 6, -7.6 + sway, front ? 3.6 : 5.6);
    for (let k = 0; k <= 6; k++) g.lineTo(-7.6 + sway + k * 15.2 / 6, (front ? 3.6 : 5.6) + (k % 2 ? 1.6 : 0));
    g.quadraticCurveTo(9.6, hy + 6, 6.4, hy - 3); g.closePath();
    g.fillStyle = vfill(g, H, hy - 3, 7, 0.2, -0.3); g.fill(); outline(g, 0.6);
    g.strokeStyle = shade(H, -0.28); g.lineWidth = 0.45; for (const x of [-4.6, -1.6, 1.6, 4.6]) { g.beginPath(); g.moveTo(x * 0.8, hy + 2); g.quadraticCurveTo(x * 1.2 + sway * 0.5, hy + 9, x + sway, front ? 3.4 : 5.4); g.stroke(); }
    g.restore();
  }
  function ppl_quiver(g, x, y, ang, back) {
    g.save(); g.translate(x, y); g.rotate(ang);
    for (const [dx, c] of [[-1.3, '#e9eef5'], [0, '#4a9a4a'], [1.3, '#e9eef5']]) { g.strokeStyle = '#8a6a3a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(dx, -6); g.lineTo(dx * 1.2, -9.4); g.stroke(); g.fillStyle = c; g.beginPath(); g.moveTo(dx * 1.2 - 0.9, -9); g.lineTo(dx * 1.2, -11.6); g.lineTo(dx * 1.2 + 0.9, -9); g.closePath(); g.fill(); outline(g, 0.3); }
    if (back) { rr(g, -2.4, -6.6, 4.8, 13, 1.6); g.fillStyle = vfill(g, PPL_ELF.leather, -7, 7, 0.25, -0.3); g.fill(); outline(g, 0.6); g.fillStyle = '#8a6238'; g.fillRect(-2.4, -6.6, 4.8, 1.3); g.fillRect(-2.4, 3.6, 4.8, 1); g.strokeStyle = PPL_GOLD; g.lineWidth = 0.4; g.beginPath(); g.moveTo(0, -4.6); g.quadraticCurveTo(1.4, -1, 0, 2.6); g.quadraticCurveTo(-1.4, -1, 0, -4.6); g.stroke(); }
    g.restore();
  }
  function ppl_leaf(g, x, y, len, w, ang, c) { g.save(); g.translate(x, y); g.rotate(ang); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -w, len, 0); g.quadraticCurveTo(len * 0.5, w, 0, 0); g.closePath(); g.fillStyle = c; g.fill(); outline(g, 0.45); g.strokeStyle = shade(c.startsWith('#') ? c : '#6b4a2a', -0.35); g.lineWidth = 0.35; g.beginPath(); g.moveTo(0.6, 0); g.lineTo(len - 0.8, 0); g.stroke(); g.restore(); }
  function ppl_elfTorso(g, back, C) {
    const T = PPL_ELF.tunic;
    const body = () => ppl_bodyPath(g, 6.8, 7.9, 6.2, -4.4, 8.4);
    body(); g.fillStyle = vfill(g, T, -5, 9, 0.24, -0.3); g.fill(); outline(g, 0.8);
    // the hem cut in leaves
    for (let k = 0; k < 6; k++) { const x = -5.6 + k * 2.24; g.beginPath(); g.moveTo(x - 1.2, 8); g.quadraticCurveTo(x - 0.8, 10.2, x, 11 + (k % 2) * 0.6); g.quadraticCurveTo(x + 0.8, 10.2, x + 1.2, 8); g.closePath(); g.fillStyle = vfill(g, ppl_hex(T, -0.1), 8, 11); g.fill(); outline(g, 0.4); }
    if (!back) {
      g.beginPath(); g.moveTo(-2.4, -5.4); g.lineTo(0, -1.6); g.lineTo(2.4, -5.4); g.closePath(); g.fillStyle = '#efe6cc'; g.fill(); outline(g, 0.4);
      g.strokeStyle = shade(T, 0.4); g.lineWidth = 0.5; g.beginPath(); g.moveTo(-2.4, -5.4); g.lineTo(0, -1.6); g.lineTo(2.4, -5.4); g.stroke();
      g.strokeStyle = shade(T, -0.4); g.lineWidth = 0.45; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.2, 0); g.quadraticCurveTo(s * 4, 3, s * 3.4, 5.6); g.stroke(); }
      // the quiver strap across the chest, a leaf buckle on it
      g.strokeStyle = PPL_ELF.leather; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-5.6, -4.4); g.lineTo(5.6, 4.2); g.stroke(); g.strokeStyle = shade(PPL_ELF.leather, 0.3); g.lineWidth = 0.4; g.beginPath(); g.moveTo(-5.4, -4.9); g.lineTo(5.8, 3.6); g.stroke();
      ppl_leaf(g, -1.4, -1.4, 3, 1.3, 0.6, '#c8d6c0');
    } else {
      g.strokeStyle = PPL_ELF.leather; g.lineWidth = 1.5; g.beginPath(); g.moveTo(5.6, -4.4); g.lineTo(-5.6, 4.2); g.stroke();
    }
    g.fillStyle = '#5a3a20'; rr(g, -6.6, 4.2, 13.2, 1.5, 0.5); g.fill(); outline(g, 0.4);
    if (!back) { ell(g, 0, 4.95, 1.2, 1); g.fillStyle = '#c8d6ee'; g.fill(); outline(g, 0.3); }
    // leather shoulder guards: overlapping leaves
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) ppl_leaf(g, s * (5 + k * 0.5), -4.6 + k * 1.6, 5.4 - k * 0.6, 2.2, s > 0 ? 0.35 + k * 0.25 : Math.PI - 0.35 - k * 0.25, shade(PPL_ELF.leather, 0.1 - k * 0.1));
    if (back) { ppl_elfHairBack(g, { ...C, bob: 0 }, false); ppl_quiver(g, 3.4, -1.2, 0.5, true); }
  }
  function ppl_elfHead(g, C) {
    const hy = PPL_ELF.hy, r = PPL_ELF.r, ex = C.fx * 1.7, H = PPL_ELF.hair, S = PPL_ELF.skin;
    // the long ears, sweeping up and out
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 5.4, hy - 1.6); g.quadraticCurveTo(s * 10.4, hy - 4.6, s * 13.4, hy - 8.6); g.quadraticCurveTo(s * 10.2, hy + 0.6, s * 5.6, hy + 2.4); g.closePath();
      g.fillStyle = vfill(g, S, hy - 8, hy + 2); g.fill(); outline(g, 0.6);
      if (!C.back) { g.fillStyle = 'rgba(220,130,130,0.45)'; g.beginPath(); g.moveTo(s * 6.4, hy - 0.6); g.quadraticCurveTo(s * 10, hy - 3.6, s * 12, hy - 6.8); g.quadraticCurveTo(s * 9.2, hy - 0.4, s * 6.4, hy + 1); g.closePath(); g.fill(); }
    }
    if (C.back) {
      ell(g, 0, hy, r, r * 0.97); g.fillStyle = vfill(g, H, hy - r, hy + r, 0.25, -0.2); g.fill(); outline(g, 0.8);
      g.strokeStyle = shade(H, -0.3); g.lineWidth = 0.5; for (const x of [-4.4, -2, 0.4, 2.8, 4.8]) { g.beginPath(); g.moveTo(x * 0.3, hy - r + 0.6); g.quadraticCurveTo(x * 1.1, hy - 1, x * 0.9, hy + r - 0.4); g.stroke(); }
      g.strokeStyle = '#c8d6ee'; g.lineWidth = 0.7; g.beginPath(); g.arc(0, hy + 1.6, r + 0.1, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      // a green ribbon gathering the hair at the nape, a silver leaf on it
      rr(g, -2.2, hy + 4.4, 4.4, 1.6, 0.6); g.fillStyle = '#3f7a3a'; g.fill(); outline(g, 0.4);
      ppl_leaf(g, -1.4, hy + 5.2, 2.8, 1.1, 0, '#c8d6c0');
      return;
    }
    ppl_face(g, C, { hy, r, skin: S, eye: '#2f7a3a', ew: 1.25, eh: 1.15, tilt: -0.2, brow: shade(H, -0.25), browW: 0.5, lash: '#3a3020',
      mouth: (g, x, y) => { g.strokeStyle = '#b06a62'; g.lineWidth = 0.5; g.lineCap = 'round'; g.beginPath(); g.arc(x, y - 1.3, 1, 0.4, Math.PI - 0.4); g.stroke(); } });
    // the hair: parted in the middle, locks framing the face and falling over the shoulders
    g.fillStyle = vfill(g, H, hy - r, hy + 4, 0.3, -0.15);
    g.beginPath(); g.moveTo(-r - 0.4, hy + 1); g.quadraticCurveTo(-r - 0.6, hy - r - 0.6, ex * 0.4, hy - r - 0.4); g.quadraticCurveTo(r + 0.6, hy - r - 0.6, r + 0.4, hy + 1); g.quadraticCurveTo(r - 1.6, hy - 2.6, ex * 0.4 + 0.6, hy - 4.6); g.quadraticCurveTo(-r + 1.6, hy - 2.6, -r - 0.4, hy + 1); g.closePath(); g.fill(); outline(g, 0.6);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r - 0.6), hy - 1); g.quadraticCurveTo(s * (r + 1.2), hy + 5, s * (r - 0.4), -2); g.lineTo(s * (r - 2.2), -2.6); g.quadraticCurveTo(s * (r - 1.6), hy + 4, s * (r - 2.2), hy - 0.4); g.closePath(); g.fillStyle = vfill(g, H, hy, -2, 0.2, -0.25); g.fill(); outline(g, 0.5); }
    // a silver circlet with a green leaf gem
    g.strokeStyle = '#c8d6ee'; g.lineWidth = 0.8; g.beginPath(); g.arc(0, hy + 2.2, r + 0.2, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
    ppl_gem(g, ex * 0.4 + 0.2, hy - 4.6, 1.2, '#5ac46a', 'rgba(140,255,150,0.6)');
  }
  function ppl_elfBow(g, W) {
    const pull = W.sw >= 0 ? Math.sin(Math.min(1, W.sw * 1.6) * Math.PI) * 6 : 0, len = 14;
    g.save(); g.translate(-4, 0); g.lineCap = 'round';
    const limb = () => { g.beginPath(); g.moveTo(0.4, -len - 2); g.quadraticCurveTo(-0.6, -len - 0.4, 1.5, -len); g.quadraticCurveTo(8.4, -len * 0.7, 6, -len * 0.27); g.quadraticCurveTo(4.5, 0, 6, len * 0.27); g.quadraticCurveTo(8.4, len * 0.7, 1.5, len); g.quadraticCurveTo(-0.6, len + 0.4, 0.4, len + 2); };
    g.strokeStyle = OUT; g.lineWidth = 3.4; limb(); g.stroke();
    g.strokeStyle = '#7a5a2a'; g.lineWidth = 2.4; limb(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(3.6, -len * 0.75); g.quadraticCurveTo(6.8, -len * 0.5, 5.8, -len * 0.3); g.stroke();
    g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.5; for (const y of [-len * 0.55, len * 0.55]) { g.beginPath(); g.moveTo(6.6, y - 1); g.lineTo(7.4, y + 1); g.stroke(); }
    for (const y of [-len - 2, len + 2]) { ell(g, 0.4, y, 0.9, 0.9); g.fillStyle = PPL_GOLD; g.fill(); outline(g, 0.3); }
    rr(g, 3.8, -2.2, 2.8, 4.4, 0.9); g.fillStyle = '#d9b25c'; g.fill(); outline(g, 0.35); g.strokeStyle = '#8a6238'; g.lineWidth = 0.4; for (const y of [-1.2, 0, 1.2]) { g.beginPath(); g.moveTo(3.8, y); g.lineTo(6.6, y + 0.5); g.stroke(); }
    g.strokeStyle = '#eef2f6'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(1.5, -len); g.lineTo(1.5 - pull, 0); g.lineTo(1.5, len); g.stroke();
    if (W.sw >= 0) {
      const ax = 1.5 - pull; g.strokeStyle = '#8a6a3a'; g.lineWidth = 1; g.beginPath(); g.moveTo(ax, 0); g.lineTo(ax + 24, 0); g.stroke();
      g.fillStyle = '#d6dee8'; g.beginPath(); g.moveTo(ax + 23, -1.7); g.lineTo(ax + 27, 0); g.lineTo(ax + 23, 1.7); g.closePath(); g.fill(); outline(g, 0.35);
      g.fillStyle = '#4a9a4a'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(ax + 0.6, 0); g.lineTo(ax + 1.6, s * 1.9); g.lineTo(ax + 4.6, s * 1.6); g.lineTo(ax + 3.8, 0); g.closePath(); g.fill(); }
      if (W.sw > 0.25) { g.strokeStyle = `rgba(220,255,220,${0.5 * (1 - W.sw)})`; g.lineWidth = 0.6; for (const y of [-2.6, 2.6]) { g.beginPath(); g.moveTo(ax + 8, y); g.lineTo(ax + 20, y * 0.5); g.stroke(); } }
    }
    g.restore();
  }
  function ppl_drawElf(g, e) {
    ppl_biped(g, e, {
      hand: PPL_ELF.skin, legs: ppl_legs({ c: '#4a5a32', boot: '#6b4a2a', cuff: '#8a6238', w: 4.4, gap: 3.2, len: 6.6, seam: true }),
      backItem: (g, C) => { ppl_quiver(g, -5.6, -1.6 + C.bob, -0.5, false); ppl_elfHairBack(g, C, true); },
      torso: ppl_elfTorso, head: ppl_elfHead,
      weapon: ppl_elfBow, pose: ppl_draw, rest: { a: -0.12, x: 11.4, y: 2.4 }, shoulder: { x: 6.2, y: 0.6 }, trail: false, shW: 8.6,
    });
  }

  // ================= the sky sentinel of Aerie: great white wings, a winged helm, a silver breastplate, a winged spear =================
  const PPL_SKY = { tunic: '#c9d6ea', plate: '#dfe6f0', shoulder: '#9ab0d0', skin: '#f0d8c0', hair: '#e8d9a0', feather: '#f6f2e4', edge: '#c9b676' };
  // a feather: a long rounded blade from (x0, y0) along angle a, with its quill
  function ppl_feather(g, x0, y0, a, len, w, c) {
    const cx = x0 + Math.cos(a) * len / 2, cy = y0 + Math.sin(a) * len / 2;
    ell(g, cx, cy, len / 2, w / 2, a); g.fillStyle = c; g.fill(); outline(g, 0.45);
    g.strokeStyle = PPL_SKY.edge; g.lineWidth = 0.4; g.beginPath(); g.moveTo(x0 + Math.cos(a) * 1, y0 + Math.sin(a) * 1); g.lineTo(x0 + Math.cos(a) * len * 0.8, y0 + Math.sin(a) * len * 0.8); g.stroke();
  }
  // one wing, raised beside the shoulder blade at (0,0): the arm runs up to the wrist, the long feathers fan out and down
  // from it, the shorter ones hang below the arm, a smooth covert over the top; s = -1 mirrors it
  function ppl_skyWing(g, s, flap) {
    g.save(); g.scale(s, 1); g.rotate(-flap);
    const F = PPL_SKY.feather, elbow = [5, -7], wrist = [11, -11];
    for (let k = 5; k >= 0; k--) { const t = k * 0.17, bx = lerp(wrist[0], elbow[0], t), by = lerp(wrist[1], elbow[1], t); ppl_feather(g, bx, by, -0.5 + k * 0.33, 12.4 - k * 0.6, 3.6, shade(F, -0.05 - k * 0.02)); }
    for (let j = 4; j >= 0; j--) { const t = j / 4, bx = lerp(1.4, elbow[0] + 2, t), by = lerp(-1.2, elbow[1] + 0.6, t); ppl_feather(g, bx, by, 1.5 - j * 0.1, 9.6 - j * 0.5, 3.4, shade(F, -0.02 - j * 0.015)); }
    const cov = () => { g.beginPath(); g.moveTo(-0.6, 1.4); g.quadraticCurveTo(1.6, -9, wrist[0] + 1.2, wrist[1] - 1.4); g.quadraticCurveTo(wrist[0] + 2.4, wrist[1] + 2.4, wrist[0] - 0.4, wrist[1] + 4.4);
      for (let k = 0; k < 4; k++) { const x = wrist[0] - 2.6 - k * 2.8, y = wrist[1] + 6.4 + k * 2; g.quadraticCurveTo(x + 1.6, y + 1.6, x, y); }
      g.quadraticCurveTo(0.6, 1.6, -0.6, 1.4); g.closePath(); };
    cov(); g.fillStyle = vfill(g, F, -12, 2, 0.6, -0.06); g.fill(); outline(g, 0.55);
    g.save(); cov(); g.clip(); g.strokeStyle = PPL_SKY.edge; g.lineWidth = 0.4; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(3 + k * 2.6, -3.6 - k * 2.2, 1.6, 0.2, Math.PI - 0.2); g.stroke(); } g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0.4, -0.6); g.quadraticCurveTo(2.4, -8.4, wrist[0] + 0.6, wrist[1] - 0.8); g.stroke();
    g.restore();
  }
  function ppl_skyWings(g, C) {
    const flap = Math.sin(time * 2.2 + (C.e.seed || 0)) * 0.08 + (C.e.moving ? Math.sin(C.e.walkT * 0.5) * 0.12 : 0) + (C.W.sw >= 0 ? Math.sin(C.W.sw * Math.PI) * 0.25 : 0);
    g.save(); g.translate(0, -1.4 + C.bob); g.scale(1.15, 1.15);
    for (const s of [-1, 1]) { g.save(); g.translate(s * 3, 0); ppl_skyWing(g, s, flap); g.restore(); }
    g.restore();
  }
  function ppl_skyTorso(g, back, C) {
    const T = PPL_SKY.tunic, Pl = PPL_SKY.plate;
    // the skirt of strips under the plate
    for (let k = 0; k < 7; k++) { const x = -6.6 + k * 2.2; rr(g, x - 1.05, 4.6, 2.1, 5.8 - Math.abs(k - 3) * 0.3, 0.7); g.fillStyle = vfill(g, k % 2 ? '#a8bcd8' : T, 4.6, 10.4, 0.3, -0.2); g.fill(); outline(g, 0.4); g.fillStyle = PPL_GOLD; g.fillRect(x - 1, 9.4 - Math.abs(k - 3) * 0.3, 2, 0.6); }
    const body = () => ppl_bodyPath(g, 7.8, 9, 6.8, -4.2, 6.2);
    body(); g.fillStyle = ppl_metal(g, Pl, -5, 6.4); g.fill(); outline(g, 0.85);
    g.strokeStyle = PPL_GOLD; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-6.8, 5.8); g.quadraticCurveTo(0, 7, 6.8, 5.8); g.stroke();
    if (!back) {
      g.strokeStyle = shade(Pl, 0.7); g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -4.6); g.lineTo(0, 4.6); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-5.8, -3.2); g.quadraticCurveTo(-6.8, 0, -5.4, 3); g.lineTo(-4.4, 2.8); g.quadraticCurveTo(-5.6, 0, -4.8, -3.4); g.closePath(); g.fill();
      // a gold-winged sky gem on the chest
      g.fillStyle = PPL_GOLD; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.2, -0.6); g.quadraticCurveTo(s * 4, -3.4, s * 5.2, -1.2); g.quadraticCurveTo(s * 3.6, -1.2, s * 1.2, 0.8); g.closePath(); g.fill(); g.strokeStyle = 'rgba(120,90,30,0.6)'; g.lineWidth = 0.3; g.stroke(); }
      ppl_gem(g, 0, 0, 1.6, '#7ec8ff', 'rgba(150,215,255,0.7)');
    } else { g.strokeStyle = shade(Pl, -0.3); g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, -4.4); g.lineTo(0, 5.6); g.stroke(); }
    // feathered shoulder plates
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const x = s * (7.4 + k * 0.9), y = -3.6 + k * 1.5; ell(g, x, y, 3.6 - k * 0.5, 2.4 - k * 0.3, s * (0.35 + k * 0.15)); g.fillStyle = ppl_metal(g, k ? ppl_hex(PPL_SKY.shoulder, k * 0.08) : PPL_SKY.shoulder, y - 2.4, y + 2.4); g.fill(); outline(g, 0.5); }
    for (const s of [-1, 1]) { g.strokeStyle = PPL_GOLD; g.lineWidth = 0.5; g.beginPath(); g.ellipse(s * 7.4, -3.6, 3.6, 2.4, s * 0.35, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
    if (back) ppl_skyWings(g, { ...C, bob: 0 });
  }
  function ppl_skyHead(g, C) {
    const hy = -10.4, r = 7.2, ex = C.fx * 1.8, H = PPL_SKY.hair;
    if (C.back) { ell(g, 0, hy, r, r * 0.97); g.fillStyle = vfill(g, H, hy - r, hy + r, 0.25, -0.2); g.fill(); outline(g, 0.8); g.strokeStyle = ppl_hex(H, -0.3); g.lineWidth = 0.5; for (const x of [-4.4, -2, 0.4, 2.8, 4.8]) { g.beginPath(); g.moveTo(x * 0.3, hy - r + 0.6); g.quadraticCurveTo(x * 1.1, hy - 1, x * 0.9, hy + r - 0.4); g.stroke(); } }
    else {
      ppl_face(g, C, { hy, r, skin: PPL_SKY.skin, eye: '#3a6aa8', brow: shade(H, -0.3), browW: 0.55, mouth: (g, x, y) => { g.strokeStyle = '#b0706a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x - 0.9, y - 0.6); g.lineTo(x + 0.9, y - 0.6); g.stroke(); } });
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r - 0.2), hy - 2.4); g.quadraticCurveTo(s * (r + 1.4), hy + 2.6, s * (r - 0.4), hy + 5.2); g.quadraticCurveTo(s * (r - 1.6), hy + 2.4, s * (r - 2.4), hy - 2); g.closePath(); g.fillStyle = vfill(g, H, hy - 2, hy + 5); g.fill(); outline(g, 0.45); }
    }
    // the winged helm: a silver cap, a gold band, feathered wings that lift and settle
    const flap = Math.sin(time * 4 + 0.5) * 0.08;
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * (r - 0.4), hy - 4); g.scale(s, 1); g.rotate(-flap);
      for (let k = 2; k >= 0; k--) ppl_feather(g, -0.6 + k * 0.3, -k * 0.9, -0.3 - k * 0.42, 6.6 - k * 0.9, 2.2, ['#ffffff', '#f2f3f7', '#e3e6ee'][k]);
      g.restore();
    }
    g.beginPath(); g.arc(0, hy - 1.6, r + 0.6, Math.PI, 0); g.quadraticCurveTo(0, hy - 3.4, -r - 0.6, hy - 1.6); g.closePath(); g.fillStyle = ppl_metal(g, PPL_SKY.plate, hy - r - 2, hy - 2); g.fill(); outline(g, 0.8);
    g.strokeStyle = PPL_GOLD; g.lineWidth = 1; g.beginPath(); g.moveTo(-r - 0.5, hy - 2); g.quadraticCurveTo(0, hy - 3.6, r + 0.5, hy - 2); g.stroke();
    g.strokeStyle = shade(PPL_SKY.plate, 0.7); g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, hy - r - 1.8); g.lineTo(0, hy - 4); g.stroke();
    if (!C.back) ppl_gem(g, ex * 0.3, hy - 4.2, 1.1, '#7ec8ff', 'rgba(150,215,255,0.6)');
  }
  function ppl_skySpear(g, W) { ppl_spear(g, W, { haft: '#e9eef5', blade: '#eef3fa', band: PPL_GOLD, butt: PPL_GOLD, wing: true, glow: '#bfe3ff', len: 2, grip: '#7a9ac8' }); }
  function ppl_drawSky(g, e) {
    ppl_biped(g, e, {
      hand: '#dfe6f0', legs: ppl_legs({ c: '#dfe6f0', metal: true, knee: PPL_GOLD, boot: '#f2efe6', wing: true, w: 4.8, gap: 3.5 }),
      backItem: ppl_skyWings, torso: ppl_skyTorso, head: ppl_skyHead,
      weapon: ppl_skySpear, pose: ppl_thrust, rest: { a: -1.48, x: 10.6, y: 4.4 }, trail: false, shW: 10.4,
    });
  }

  // ================= the vampires: a slim black cloak open at the front, red inside, a high stiff collar =================
  // o = { lining, trim, hem, collarH, count }
  const PPL_VAMP = { skin: '#ece4ec', hair: '#0c0a10', cloak: '#18121e', coat: '#3a2448' };
  // a bat-wing hem: from the current point at (x0, y + deep), pointed tips joined by scallops that curve up
  function ppl_batHem(g, x0, x1, y, n, sway, deep) { for (let k = 1; k <= n; k++) { const t = k / n, x = lerp(x0, x1, t) + sway * Math.sin(t * Math.PI), xm = lerp(x0, x1, t - 0.5 / n) + sway * Math.sin((t - 0.5 / n) * Math.PI); g.quadraticCurveTo(xm, y - deep * 0.25 + Math.sin(time * 3 + k) * 0.25, x, y + deep); } }
  function ppl_vampBack(o) {
    // facing us: the inside of the cloak behind the body, its lining showing, edged in black
    return (g, C) => {
      const sway = Math.sin(time * 2.4 + (C.e.seed || 0)) * 0.6 + C.step * 1.2, H = o.hem, b = C.bob, W = o.wide;
      const path = () => { g.beginPath(); g.moveTo(-6.6, -4.6 + b); g.quadraticCurveTo(-6.6 - (W - 6.6) * 0.3, 3, -W + sway * 0.4, H + 1.6); ppl_batHem(g, -W + sway * 0.4, W + sway * 0.4, H, 5, sway * 0.5, 1.6); g.quadraticCurveTo(6.6 + (W - 6.6) * 0.3, 3, 6.6, -4.6 + b); g.closePath(); };
      path(); g.fillStyle = vfill(g, o.lining, -4, H + 2, 0.12, -0.5); g.fill();
      g.strokeStyle = PPL_VAMP.cloak; g.lineWidth = 1.4; g.stroke(); outline(g, 0.6);
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 0.7; for (const x of [-7, 7]) { g.beginPath(); g.moveTo(x * 0.6, -1 + b); g.quadraticCurveTo(x * 0.95, 6, x * 1.15 + sway * 0.3, H + 1); g.stroke(); }
    };
  }
  function ppl_vampCollar(g, o) {
    const h = o.collarH;
    for (const s of [-1, 1]) {
      const flap = () => { g.beginPath(); g.moveTo(s * 2.6, -4.8); g.quadraticCurveTo(s * 3.8, -h + 2.4, s * 6, -h); g.quadraticCurveTo(s * 9.8, -h + 1.6, s * 12.4, -h + 3.4); g.quadraticCurveTo(s * 10.6, -8.4, s * 8.6, -4.2); g.closePath(); };
      flap(); g.fillStyle = vfill(g, o.collar, -h, -4, 0.22, -0.4); g.fill();
      g.save(); flap(); g.clip(); g.strokeStyle = PPL_VAMP.cloak; g.lineWidth = 2; flap(); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.5; for (const k of [0, 1]) { g.beginPath(); g.moveTo(s * (4.6 + k * 2.4), -5); g.quadraticCurveTo(s * (6 + k * 2.6), -9, s * (7.6 + k * 2.6), -h + 2.4 + k * 0.6); g.stroke(); } g.restore();
      flap(); outline(g, 0.75);
      if (o.trim) { g.strokeStyle = o.trim; g.lineWidth = 0.6; g.beginPath(); g.moveTo(s * 6, -h); g.quadraticCurveTo(s * 9.8, -h + 1.6, s * 12.4, -h + 3.4); g.stroke(); }
    }
  }
  function ppl_vampTorso(o) {
    return (g, back, C) => {
      const sway = Math.sin(time * 2.4 + (C.e.seed || 0)) * 0.6 + C.step * 1.2, H = o.hem, W = o.wide;
      if (back) {
        // facing away: the cloak over the back, a little red showing under its bat-wing hem
        g.beginPath(); g.moveTo(-W + 1 + sway * 0.4, H); ppl_batHem(g, -W + 1 + sway * 0.4, W - 1 + sway * 0.4, H + 0.2, 5, sway * 0.5, 1.8); g.lineTo(W - 1, H - 2); g.lineTo(-W + 1, H - 2); g.closePath(); g.fillStyle = o.lining; g.fill();
        const path = () => { g.beginPath(); g.moveTo(-7.4, -4.6); g.quadraticCurveTo(-7.4 - (W - 7.4) * 0.3, 3, -W + sway * 0.4, H + 1.4); ppl_batHem(g, -W + sway * 0.4, W + sway * 0.4, H - 0.4, 6, sway * 0.5, 1.8); g.quadraticCurveTo(7.4 + (W - 7.4) * 0.3, 3, 7.4, -4.6); g.quadraticCurveTo(0, -6.8, -7.4, -4.6); g.closePath(); };
        path(); g.fillStyle = vfill(g, ppl_hex(PPL_VAMP.cloak, 0.08), -5, H + 2, 0.25, -0.25); g.fill(); outline(g, 0.85);
        g.save(); path(); g.clip();
        g.strokeStyle = 'rgba(150,120,170,0.35)'; g.lineWidth = 0.7; for (const x of [-6, -2, 2, 6]) { g.beginPath(); g.moveTo(x * 0.5, -3); g.quadraticCurveTo(x * 0.95, 5, x * 1.3 + sway * 0.4, H + 2); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,0.3)'; for (const x of [-4, 0, 4]) { g.beginPath(); g.moveTo(x * 0.6, 1); g.quadraticCurveTo(x * 1.1 - 0.8, 7, x * 1.2 + sway * 0.4 - 0.4, H + 2); g.lineTo(x * 1.2 + sway * 0.4 + 0.9, H + 2); g.quadraticCurveTo(x * 1.1 + 0.6, 7, x * 0.6 + 0.4, 1); g.closePath(); g.fill(); }
        g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.9; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 6.4, -2, 3, s > 0 ? Math.PI * 1.3 : Math.PI * 1.1, s > 0 ? Math.PI * 1.9 : Math.PI * 1.7); g.stroke(); }
        if (o.trim) { g.strokeStyle = o.trim; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-W + sway * 0.4, H); ppl_batHem(g, -W + sway * 0.4, W + sway * 0.4, H - 1.4, 6, sway * 0.5, 1.8); g.stroke(); }
        g.restore();
        return;
      }
      ppl_vampCollar(g, o);
      // a slim plum coat, a white shirt, a red cravat and a gem
      const body = () => ppl_bodyPath(g, 6.6, 7.4, 5.8, -4.4, 8.6);
      body(); g.fillStyle = vfill(g, PPL_VAMP.coat, -5, 9, 0.22, -0.32); g.fill(); outline(g, 0.8);
      g.beginPath(); g.moveTo(-2.4, -5); g.lineTo(0, 2.4); g.lineTo(2.4, -5); g.closePath(); g.fillStyle = '#f2eef0'; g.fill(); outline(g, 0.4);
      g.fillStyle = '#b0202c'; g.beginPath(); g.moveTo(-1.6, -4.4); g.quadraticCurveTo(0, -2.6, 1.6, -4.4); g.lineTo(1.2, -1); g.quadraticCurveTo(0, 0.4, -1.2, -1); g.closePath(); g.fill(); outline(g, 0.35);
      ppl_gem(g, 0, -2.8, 0.9, o.count ? '#ff3b4a' : '#c02838', o.count ? 'rgba(255,60,60,0.6)' : null);
      g.strokeStyle = shade(PPL_VAMP.coat, -0.45); g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, 2.4); g.lineTo(0, 8.4); g.stroke();
      g.fillStyle = '#c9b8d0'; for (const y of [3.4, 5.6]) { ell(g, -1.1, y, 0.38, 0.38); g.fill(); ell(g, 1.1, y, 0.38, 0.38); g.fill(); }
      if (o.count) {
        // the count's gold chain and its blood-red medallion
        g.strokeStyle = PPL_GOLD; g.lineWidth = 0.6; g.setLineDash([0.8, 0.5]); g.beginPath(); g.moveTo(-5, -3.6); g.quadraticCurveTo(-3, 2.6, 0, 3.4); g.quadraticCurveTo(3, 2.6, 5, -3.6); g.stroke(); g.setLineDash([]);
        ell(g, 0, 4, 1.7, 1.7); g.fillStyle = ppl_metal(g, PPL_GOLD, 2.3, 5.7); g.fill(); outline(g, 0.4); ppl_gem(g, 0, 4, 1, '#ff3b4a', 'rgba(255,60,60,0.5)');
      }
      // the cloak's two front edges falling open from the shoulders, a red lapel turned back at the top of each
      for (const s of [-1, 1]) {
        const sw = sway * 0.3 * s, panel = () => { g.beginPath(); g.moveTo(s * 3.8, -4.8); g.quadraticCurveTo(s * 6.8, -6, s * 8.8, -4.4); g.quadraticCurveTo(s * (8.8 + (W - 8.8) * 0.3), 3, s * (W - 0.4) + sw, H + 1.6); g.quadraticCurveTo(s * (W - 1.6) + sw, H + 0.2, s * (W - 2.6) + sw, H + 1.4); g.quadraticCurveTo(s * (W - 3.4) + sw, H, s * (W - 4.2) + sw, H + 1); g.quadraticCurveTo(s * 5.6, 4, s * 4.8, -1.6); g.quadraticCurveTo(s * 4.2, -3.6, s * 3.8, -4.8); g.closePath(); };
        panel(); g.fillStyle = vfill(g, ppl_hex(PPL_VAMP.cloak, 0.06), -6, H, 0.3, -0.2); g.fill(); outline(g, 0.75);
        g.beginPath(); g.moveTo(s * 3.8, -4.8); g.lineTo(s * 6.6, -4.6); g.quadraticCurveTo(s * 6.2, -1, s * 5.2, 1.6); g.quadraticCurveTo(s * 4.6, -1.6, s * 3.8, -4.8); g.closePath(); g.fillStyle = vfill(g, o.collar, -5, 2, 0.2, -0.3); g.fill(); outline(g, 0.4);
        g.strokeStyle = o.lining; g.lineWidth = 0.8; g.beginPath(); g.moveTo(s * 5.2, 1.6); g.quadraticCurveTo(s * 5.8, 6, s * (W - 4.2) + sw, H + 0.8); g.stroke();
        if (o.trim) { g.strokeStyle = o.trim; g.lineWidth = 0.5; g.beginPath(); g.moveTo(s * 6.6, -4.6); g.quadraticCurveTo(s * 6.2, -1, s * 5.2, 1.6); g.stroke(); }
        g.strokeStyle = 'rgba(150,120,170,0.4)'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(s * 8, -2.6); g.quadraticCurveTo(s * (8 + (W - 8) * 0.4), 4, s * (W - 1.6) + sw, H); g.stroke();
      }
      // the clasp chain across the collar
      g.strokeStyle = o.trim || '#a9adb5'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-3.8, -4.4); g.quadraticCurveTo(0, -3, 3.8, -4.4); g.stroke();
      for (const s of [-1, 1]) { ell(g, s * 3.8, -4.4, 0.8, 0.8); g.fillStyle = o.trim || '#a9adb5'; g.fill(); outline(g, 0.3); }
    };
  }
  function ppl_vampHead(o) {
    const hy = -10.6, r = 7.1, S = PPL_VAMP.skin, Hr = PPL_VAMP.hair;
    return (g, C) => {
      const ex = C.fx * 1.8, ey = C.fy * 1.3;
      // pointed ears
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 5.8, hy - 1); g.lineTo(s * 9.8, hy - 4.6); g.lineTo(s * 6.4, hy + 2.2); g.closePath(); g.fillStyle = vfill(g, S, hy - 4, hy + 2); g.fill(); outline(g, 0.5); }
      if (C.back) {
        ell(g, 0, hy, r, r * 0.97); g.fillStyle = vfill(g, Hr, hy - r, hy + r, 0.3, 0); g.fill(); outline(g, 0.8);
        g.strokeStyle = 'rgba(150,130,180,0.5)'; g.lineWidth = 0.5; for (const x of [-3.4, -1, 1.4, 3.6]) { g.beginPath(); g.moveTo(x * 0.6, hy - r + 1); g.quadraticCurveTo(x, hy, x * 0.9, hy + 5.6); g.stroke(); }
        if (o.count) { g.strokeStyle = '#b8b2bc'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-2.2, hy - r + 0.8); g.quadraticCurveTo(-3, hy - 1, -2.6, hy + 5); g.stroke(); }
      } else {
        ppl_face(g, C, { hy, r, skin: S, eye: '#e0203a', glow: o.count ? 'rgba(255,50,60,0.5)' : 'rgba(255,50,60,0.3)', glowR: 2, brow: '#0c0a10', browW: 0.9, browTilt: 0.55, browIn: 1.1, blush: 'rgba(170,110,160,0.2)',
          mouth: (g, x, y) => {
            g.strokeStyle = '#5a1a2a'; g.lineWidth = 0.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 2, y - 0.9); g.quadraticCurveTo(x, y - 0.1, x + 2.1, y - 1.3); g.stroke();
            g.fillStyle = '#ffffff'; for (const dx of [-1, 1]) { g.beginPath(); g.moveTo(x + dx - 0.55, y - 0.7); g.lineTo(x + dx, y + 1.1); g.lineTo(x + dx + 0.55, y - 0.6); g.closePath(); g.fill(); g.strokeStyle = 'rgba(60,20,30,0.5)'; g.lineWidth = 0.25; g.stroke(); }
          } });
        // black hair swept back from a widow's peak
        g.beginPath(); g.moveTo(-r - 0.3, hy + 0.6); g.quadraticCurveTo(-r - 0.6, hy - r - 0.8, 0, hy - r - 0.6); g.quadraticCurveTo(r + 0.6, hy - r - 0.8, r + 0.3, hy + 0.6); g.quadraticCurveTo(r - 1, hy - 3.4, 3.6 + ex * 0.5, hy - 4); g.quadraticCurveTo(1.6 + ex * 0.5, hy - 4.6, ex * 0.5, hy - 2); g.quadraticCurveTo(-1.6 + ex * 0.5, hy - 4.6, -3.6 + ex * 0.5, hy - 4); g.quadraticCurveTo(-r + 1, hy - 3.4, -r - 0.3, hy + 0.6); g.closePath();
        g.fillStyle = vfill(g, Hr, hy - r, hy, 0.3, 0); g.fill(); outline(g, 0.6);
        g.strokeStyle = 'rgba(170,150,200,0.55)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-4, hy - 5); g.quadraticCurveTo(-2, hy - 7.6, 1, hy - 7.4); g.moveTo(3, hy - 4.6); g.quadraticCurveTo(4.4, hy - 6.6, 5.2, hy - 4.6); g.stroke();
        if (o.count) { g.strokeStyle = '#b8b2bc'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-3.2 + ex * 0.5, hy - 4.2); g.quadraticCurveTo(-3, hy - 6.8, -0.6, hy - 7.6); g.stroke(); }
      }
      if (o.count) {
        // a silver circlet with three points, a blood-red stone at the front
        const cx = C.back ? 0 : ex * 0.3;
        g.strokeStyle = '#c9ccd3'; g.lineWidth = 1.1; g.beginPath(); g.arc(0, hy + 1.4, r + 0.3, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        g.fillStyle = '#c9ccd3'; for (const s of [-1, 0, 1]) { g.beginPath(); g.moveTo(s * 2.6 - 0.7 + cx, hy - 5.6 + Math.abs(s) * 0.4); g.lineTo(s * 2.6 + cx, hy - 8.6 + Math.abs(s) * 0.8); g.lineTo(s * 2.6 + 0.7 + cx, hy - 5.6 + Math.abs(s) * 0.4); g.closePath(); g.fill(); outline(g, 0.3); }
        if (!C.back) ppl_gem(g, cx, hy - 6.2, 1.15, '#e63946', 'rgba(255,60,60,0.55)');
      }
    };
  }
  // facing away, the collar stands up round the back of the neck, hiding the bottom of the head
  function ppl_vampTop(o) {
    return (g, back) => {
      if (!back) return; const h = o.collarH;
      const band = () => { g.beginPath(); g.moveTo(-7.4, -4.6); g.quadraticCurveTo(-10.6, -7, -12.4, -h + 3.4); g.quadraticCurveTo(-8, -h + 3.6, -5.2, -9.8); g.quadraticCurveTo(0, -8.2, 5.2, -9.8); g.quadraticCurveTo(8, -h + 3.6, 12.4, -h + 3.4); g.quadraticCurveTo(10.6, -7, 7.4, -4.6); g.quadraticCurveTo(0, -6, -7.4, -4.6); g.closePath(); };
      band(); g.fillStyle = vfill(g, ppl_hex(PPL_VAMP.cloak, 0.1), -h, -4, 0.35, -0.1); g.fill(); outline(g, 0.75);
      g.strokeStyle = 'rgba(150,120,170,0.4)'; g.lineWidth = 0.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6, -6); g.quadraticCurveTo(s * 8.6, -9, s * 10.6, -h + 4.2); g.stroke(); }
      if (o.trim) { g.strokeStyle = o.trim; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-12.4, -h + 3.4); g.quadraticCurveTo(-8, -h + 3.6, -5.2, -9.8); g.quadraticCurveTo(0, -8.2, 5.2, -9.8); g.quadraticCurveTo(8, -h + 3.6, 12.4, -h + 3.4); g.stroke(); }
    };
  }
  // a pale hand with long dark nails; the nails point along +x
  function ppl_clawHand(g, sw, red) {
    g.strokeStyle = OUT; g.lineCap = 'round';
    for (const [y, l] of [[-1.2, 3.6], [0, 4.2], [1.2, 3.6]]) { g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.moveTo(1.2, y * 0.8); g.lineTo(1.2 + l, y * 1.25); g.stroke(); g.strokeStyle = PPL_VAMP.skin; g.lineWidth = 0.7; g.beginPath(); g.moveTo(1.2, y * 0.8); g.lineTo(0.8 + l * 0.7, y * 1.15); g.stroke(); g.strokeStyle = red || '#2a0e1a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0.8 + l * 0.7, y * 1.15); g.lineTo(1.6 + l, y * 1.3); g.stroke(); }
    ell(g, 0, 0, 2.1, 2.1); g.fillStyle = PPL_VAMP.skin; g.fill(); outline(g, 0.5);
  }
  function ppl_clawTrail(g, W, C) {
    if (W.sw < 0 || W.sw > 0.9) return;
    const a0 = W.ang - 1.3, a1 = W.ang + lerp(-1.3, 1.1, ease(W.sw)), al = Math.min(1, 1.6 * (1 - W.sw));
    g.save(); g.lineCap = 'round';
    for (const [r, w] of [[19, 1.6], [22.5, 2], [26, 1.6]]) { g.strokeStyle = `rgba(235,40,60,${al})`; g.lineWidth = w; g.beginPath(); g.arc(C.sh.x, C.sh.y + C.bob, r, a0 + (r - 22) * 0.02, a1); g.stroke(); g.strokeStyle = `rgba(255,190,200,${al * 0.6})`; g.lineWidth = w * 0.35; g.stroke(); }
    g.restore();
  }
  function ppl_blackBlade(g, W) {
    g.fillStyle = '#2a1a1e'; g.fillRect(-3.4, -1.3, 6.8, 2.6); g.strokeStyle = '#8a1e2a'; g.lineWidth = 0.5; for (const x of [-2, 0, 2]) { g.beginPath(); g.moveTo(x, -1.3); g.lineTo(x + 0.8, 1.3); g.stroke(); }
    ppl_gem(g, -4.4, 0, 1.5, '#e63946', 'rgba(255,60,60,0.5)');
    // the bat-wing guard
    g.fillStyle = PPL_GOLD;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(3.4, 0); g.quadraticCurveTo(3, s * 4, 5.6, s * 6.8); g.lineTo(5, s * 4.6); g.lineTo(6.2, s * 4.4); g.lineTo(5.2, s * 2.8); g.lineTo(6, s * 1.4); g.lineTo(5.6, 0); g.closePath(); g.fill(); outline(g, 0.4); }
    g.beginPath(); g.moveTo(5.6, -2.2); g.lineTo(27, -1.6); g.lineTo(33, 0); g.lineTo(27, 1.6); g.lineTo(5.6, 2.2); g.closePath();
    const bl = g.createLinearGradient(0, -2.2, 0, 2.2); bl.addColorStop(0, '#5a5262'); bl.addColorStop(0.5, '#2f2a3a'); bl.addColorStop(1, '#16121c'); g.fillStyle = bl; g.fill(); outline(g, 0.7);
    g.save(); g.globalAlpha = 0.55 + Math.sin(time * 4) * 0.2; g.strokeStyle = '#ff4a4a'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(7, 0); g.lineTo(28, 0); g.stroke(); g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(7, -1.5); g.lineTo(27, -1.1); g.stroke();
  }
  function ppl_ash(g, C, n, spread) {
    for (let k = 0; k < n; k++) { const ph = (time * 0.4 + k / n) % 1, x = Math.sin(k * 5.1 + time * 0.8) * spread, y = 12 - ph * 26; g.fillStyle = `rgba(${170 + k * 8},${160 + k * 6},${168},${(1 - ph) * 0.7})`; g.save(); g.translate(x, y); g.rotate(time * 2 + k); g.fillRect(-0.7, -0.45, 1.4, 0.9); g.restore(); }
  }
  function ppl_bat(g, x, y, s, flap) {
    g.save(); g.translate(x, y); g.scale(s, s);
    for (const k of [-1, 1]) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(k * 3, -3 - flap * 2, k * 6, -1 - flap * 3); g.lineTo(k * 5, 0.6); g.lineTo(k * 4, -0.2); g.lineTo(k * 3, 1.2); g.lineTo(k * 2, 0.4); g.lineTo(k * 1.2, 1.4); g.closePath(); g.fillStyle = '#231a2a'; g.fill(); outline(g, 0.4); }
    ell(g, 0, 0.4, 1.3, 1.7); g.fillStyle = '#2e2236'; g.fill(); outline(g, 0.4);
    g.fillStyle = '#2e2236'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 0.4, -0.8); g.lineTo(k * 1, -2.2); g.lineTo(k * 1.1, -0.6); g.closePath(); g.fill(); }
    g.fillStyle = '#ff5050'; ell(g, -0.45, 0, 0.3, 0.3); g.fill(); ell(g, 0.45, 0, 0.3, 0.3); g.fill();
    g.restore();
  }
  const PPL_VAMP_O = { lining: '#6a1a2c', collar: '#a01c2c', hem: 11.4, wide: 11.6, collarH: 18, count: false };
  const PPL_COUNT_O = { lining: '#9a1426', collar: '#c0202e', trim: PPL_GOLD, hem: 12.2, wide: 13.4, collarH: 20.4, count: true };
  function ppl_drawVampire(g, e) {
    const o = PPL_VAMP_O;
    ppl_biped(g, e, {
      hand: null, offHand: PPL_VAMP.skin, legs: ppl_legs({ c: '#221a28', boot: '#0c0a10', w: 4.4, gap: 3.2, len: 6.4 }),
      backItem: ppl_vampBack(o), torso: ppl_vampTorso(o), head: ppl_vampHead(o), top: ppl_vampTop(o),
      off: (g, back) => { g.save(); g.translate(0.4, 0.6); g.rotate(1.75); ppl_clawHand(g, -1); g.restore(); },
      weapon: (g, W) => ppl_clawHand(g, W.sw), rest: { a: 1.45, x: 10.2, y: 4.4 }, trail: ppl_clawTrail, shW: 10.6,
    });
  }
  function ppl_drawCount(g, e) {
    const o = PPL_COUNT_O, pulse = 0.5 + Math.sin(time * 2.6) * 0.18;
    // a red haze round him
    const gl = g.createRadialGradient(0, -2, 2, 0, -2, 22); gl.addColorStop(0, `rgba(255,40,60,${0.28 * pulse})`); gl.addColorStop(1, 'rgba(255,40,60,0)'); g.fillStyle = gl; ell(g, 0, -2, 22, 22); g.fill();
    ppl_biped(g, e, {
      hand: PPL_VAMP.skin, offHand: PPL_VAMP.skin, legs: ppl_legs({ c: '#221a28', boot: '#0c0a10', w: 4.6, gap: 3.3, len: 6.4, cuff: '#5a4a20' }),
      backItem: ppl_vampBack(o), torso: ppl_vampTorso(o), head: ppl_vampHead(o), top: ppl_vampTop(o),
      off: (g, back) => { g.save(); g.translate(0.4, 0.6); g.rotate(1.75); ppl_clawHand(g, -1, '#7a1020'); g.restore(); },
      weapon: ppl_blackBlade, rest: { a: -1.12, x: 10.4, y: 4.6 },
      trail: (g, W, C) => { ppl_swish(g, C.sh.x, C.sh.y + C.bob, W.ang, W.sw, 28, '225,30,50', 5); },
      after: (g, C) => { ppl_ash(g, C, 6, 9); const t = time * 1.6; for (const k of [0, 1]) { const a = t + k * Math.PI; ppl_bat(g, Math.cos(a) * 17, -25 + Math.sin(a * 2) * 2 + C.bob, 0.6, Math.sin(time * 14 + k * 2)); } }, shW: 11,
    });
  }

  // ================= the Dragon Killers: the Duke's knights in heavy plate, his red livery, a gold dragon's head =================
  // the Dragon Killers' badge: a gold dragon's head in profile, horn swept back, jaws open
  function ppl_dragonBadge(g, x, y, k, c) {
    g.save(); g.translate(x, y); g.scale(k, k);
    g.beginPath(); g.moveTo(-2.4, 3.2); g.quadraticCurveTo(-2.8, 0.4, -1.4, -1.2); g.lineTo(-3.4, -3.4); g.lineTo(-0.6, -2.2); g.quadraticCurveTo(0.8, -2.6, 1.6, -1.8);
    g.lineTo(3.4, -1.1); g.lineTo(3.2, -0.2); g.lineTo(1.2, 0); g.lineTo(3, 1); g.lineTo(0.9, 1.5); g.quadraticCurveTo(-0.3, 1.9, -0.3, 3.2); g.closePath();
    g.fillStyle = c || PPL_GOLD; g.fill(); g.strokeStyle = 'rgba(70,40,10,0.75)'; g.lineWidth = 0.35; g.stroke();
    g.fillStyle = c || PPL_GOLD; for (const [px, py] of [[-2.6, 1.6], [-2.3, -0.2]]) { g.beginPath(); g.moveTo(px, py - 0.7); g.lineTo(px - 1, py); g.lineTo(px, py + 0.7); g.closePath(); g.fill(); }
    g.fillStyle = '#7a1414'; ell(g, 0.5, -1.1, 0.42, 0.32); g.fill();
    g.fillStyle = 'rgba(70,40,10,0.7)'; ell(g, 2.9, -0.8, 0.2, 0.18); g.fill();
    g.restore();
  }
  const PPL_DK = {
    garrick: { plate: '#c9ccd3', coat: '#8a2a2a', cape: '#8a2a2a', trim: PPL_GOLD },
    hale: { plate: '#9aa1ad', coat: '#4a4f5a', cape: '#3e4552', trim: PPL_GOLD },
  };
  function ppl_dkCape(L, over) {
    return (g, C) => {
      const c = L.cape, sway = Math.sin(time * 3 + C.step) * 0.8 + C.step * 1.2, b = over ? 0 : C.bob;
      const path = () => { g.beginPath(); g.moveTo(-8, -4 + b); g.quadraticCurveTo(-11.5, 5, -11 + sway * 0.4, 14); g.quadraticCurveTo(-5, 15.6 + sway * 0.6, 0, 14.6); g.quadraticCurveTo(5, 15.6 - sway * 0.6, 11 + sway * 0.4, 14); g.quadraticCurveTo(11.5, 5, 8, -4 + b); g.closePath(); };
      path(); g.fillStyle = vfill(g, c, -4, 15, 0.12, -0.38); g.fill();
      g.save(); path(); g.clip(); g.strokeStyle = L.trim; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-12 + sway * 0.4, 13.2); g.quadraticCurveTo(-5, 14.8 + sway * 0.6, 0, 13.8); g.quadraticCurveTo(5, 14.8 - sway * 0.6, 12 + sway * 0.4, 13.2); g.stroke(); g.restore();
      path(); outline(g, 0.8);
      if (over) {
        g.strokeStyle = shade(c, -0.45); g.lineWidth = 0.7; g.beginPath(); g.moveTo(-4, 0); g.quadraticCurveTo(-5, 6, -5.5, 12); g.moveTo(4, 0); g.quadraticCurveTo(5, 6, 5.5, 12); g.stroke();
        ell(g, 0, 5, 3.6, 3.6); g.fillStyle = shade(c, -0.25); g.fill(); g.strokeStyle = L.trim; g.lineWidth = 0.6; g.stroke(); ppl_dragonBadge(g, 0, 5, 0.85);
      }
    };
  }
  function ppl_dkTorso(L) {
    return (g, back, C) => {
      const c = L.plate, body = () => ppl_bodyPath(g, 8.5, 10.2, 7.6, -4, 8.6);
      body(); g.fillStyle = ppl_metal(g, c, -5, 9); g.fill(); outline(g, 0.9);
      g.strokeStyle = shade(c, -0.42); g.lineWidth = 0.7; g.beginPath(); g.moveTo(-7.4, 5.4); g.quadraticCurveTo(0, 6.8, 7.4, 5.4); g.moveTo(-7.6, 7.4); g.quadraticCurveTo(0, 8.8, 7.6, 7.4); g.stroke();
      if (!back) {
        // the surcoat over the plate: the Duke's colour, gold-edged, the gold dragon's head
        const tab = () => { g.beginPath(); g.moveTo(-4.4, -4.8); g.quadraticCurveTo(0, -3, 4.4, -4.8); g.lineTo(5.4, 9.8); g.lineTo(0, 10.8); g.lineTo(-5.4, 9.8); g.closePath(); };
        tab(); g.fillStyle = vfill(g, L.coat, -5, 11, 0.22, -0.32); g.fill(); outline(g, 0.7);
        g.save(); tab(); g.clip(); g.strokeStyle = L.trim; g.lineWidth = 0.8; tab(); g.stroke(); g.restore();
        ppl_dragonBadge(g, 0, -0.2, 0.95);
        g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.moveTo(-6.6, -3.2); g.quadraticCurveTo(-7.6, 0, -6.2, 3.2); g.lineTo(-5.4, 3); g.quadraticCurveTo(-6.4, 0, -5.6, -3.4); g.closePath(); g.fill();
      }
      g.fillStyle = '#3a2418'; rr(g, -8.4, 4.4, 16.8, 1.6, 0.5); g.fill(); outline(g, 0.4);
      if (!back) { rr(g, -1.3, 4, 2.6, 2.4, 0.5); g.fillStyle = ppl_metal(g, PPL_GOLD, 4, 6.4); g.fill(); outline(g, 0.35); }
      // a gorget at the neck
      g.beginPath(); g.moveTo(-4.6, -4.8); g.quadraticCurveTo(0, -2.4, 4.6, -4.8); g.quadraticCurveTo(0, -6.6, -4.6, -4.8); g.closePath(); g.fillStyle = ppl_metal(g, c, -6, -3); g.fill(); outline(g, 0.5);
      ppl_pauldrons(g, { c, lame: true, trim: L.trim });
      for (const s of [-1, 1]) { g.fillStyle = shade(c, 0.6); ell(g, s * 9, -2.2, 0.5, 0.5); g.fill(); }
      if (back) ppl_dkCape(L, true)(g, C);
    };
  }
  function ppl_garrickHead(g, C) {
    const hy = -10.2, r = 7.4, ex = C.fx * 1.8, ey = C.fy * 1.3, c = PPL_DK.garrick.plate, beard = '#c4bcb2';
    // the red plume, streaming back
    const wv = Math.sin(time * 4) * 1;
    g.beginPath(); g.moveTo(-1, hy - r - 1.4); g.quadraticCurveTo(-4, hy - r - 7.4, -10.6 + wv, hy - r - 2.6 + wv * 0.4); g.quadraticCurveTo(-6, hy - r - 2.4, -1.6, hy - r + 1.2); g.closePath(); g.fillStyle = vfill(g, '#c0392b', hy - r - 7, hy - r + 1, 0.3, -0.3); g.fill(); outline(g, 0.5);
    g.strokeStyle = '#e8705a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-1.4, hy - r - 1); g.quadraticCurveTo(-4, hy - r - 5.6, -8.6 + wv, hy - r - 2.8); g.stroke();
    if (C.back) {
      // facing away: the bowl, a flared neck guard, the ridge
      g.beginPath(); g.moveTo(-r - 1.2, hy + 2.6); g.quadraticCurveTo(0, hy + 6.4, r + 1.2, hy + 2.6); g.lineTo(r + 0.4, hy); g.lineTo(-r - 0.4, hy); g.closePath(); g.fillStyle = ppl_metal(g, c, hy, hy + 5); g.fill(); outline(g, 0.6);
      ell(g, 0, hy - 0.6, r + 0.6, r + 0.2); g.fillStyle = ppl_metal(g, c, hy - r, hy + r); g.fill(); outline(g, 0.9);
      g.strokeStyle = shade(c, 0.6); g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, hy - r - 0.4); g.lineTo(0, hy + 4.4); g.stroke();
      g.strokeStyle = PPL_GOLD; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-r - 1.2, hy + 2.6); g.quadraticCurveTo(0, hy + 6.4, r + 1.2, hy + 2.6); g.stroke();
      ppl_rivets(g, [[-4.6, hy + 2.2], [4.6, hy + 2.2]], shade(c, 0.6), 0.5);
      return;
    }
    ppl_face(g, C, { hy, r, skin: '#e8b790', eye: '#2a3a4a', brow: '#d8d0c6', browW: 1.1, browIn: 1.3, browTilt: 0.2 });
    // a full grey beard and a sweeping moustache below the helm's open face
    const bx = ex * 0.7;
    const bd = () => { g.beginPath(); g.moveTo(-r + 0.8 + bx, hy + 1.2); g.quadraticCurveTo(-r + 0.2 + bx, hy + 6.2, -2.6 + bx, hy + 8.6); g.quadraticCurveTo(bx, hy + 10.4, 2.6 + bx, hy + 8.6); g.quadraticCurveTo(r - 0.2 + bx, hy + 6.2, r - 0.8 + bx, hy + 1.2); g.quadraticCurveTo(r - 2.4 + bx, hy + 4.4, 1.6 + bx, hy + 4.6); g.quadraticCurveTo(bx, hy + 5.6, -1.6 + bx, hy + 4.6); g.quadraticCurveTo(-r + 2.4 + bx, hy + 4.4, -r + 0.8 + bx, hy + 1.2); g.closePath(); };
    bd(); g.fillStyle = vfill(g, beard, hy + 1, hy + 10, 0.35, -0.15); g.fill(); outline(g, 0.55);
    g.save(); bd(); g.clip(); g.strokeStyle = shade(beard, -0.22); g.lineWidth = 0.4; g.lineCap = 'round'; for (const [x, y] of [[-4.4, 4.4], [-2, 6.6], [0.6, 7.6], [2.8, 6.2], [4.6, 4], [-0.8, 9]]) { g.beginPath(); g.arc(x + bx, hy + y, 0.9, 0.4, 2.7); g.stroke(); } g.restore();
    g.fillStyle = vfill(g, ppl_hex(beard, 0.18), hy + 2.4, hy + 5, 0.2, -0.2); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(ex, hy + 3 + ey * 0.4); g.quadraticCurveTo(ex + s * 2.4, hy + 2.3 + ey * 0.4, ex + s * 4.4, hy + 4.4); g.quadraticCurveTo(ex + s * 2.2, hy + 4.4, ex, hy + 4); g.closePath(); g.fill(); outline(g, 0.3); }
    g.fillStyle = '#a0484a'; ell(g, ex, hy + 5.1 + ey * 0.3, 1, 0.45); g.fill();
    // the helm: a rounded steel bowl, cheek guards, a nasal, a gold rim
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r + 0.8), hy - 1.6); g.lineTo(s * (r + 1), hy + 3.4); g.quadraticCurveTo(s * (r - 0.6), hy + 4.6, s * (r - 2.2), hy + 3.6); g.lineTo(s * (r - 2.4), hy - 0.4); g.closePath(); g.fillStyle = ppl_metal(g, c, hy - 1, hy + 4); g.fill(); outline(g, 0.5); ppl_rivets(g, [[s * (r - 0.6), hy + 1.6]], shade(c, 0.6), 0.4); }
    g.beginPath(); g.arc(0, hy - 0.6, r + 0.9, Math.PI, 0); g.closePath(); g.fillStyle = ppl_metal(g, c, hy - r - 1, hy); g.fill(); outline(g, 0.85);
    g.fillStyle = shade(c, -0.22); g.fillRect(-r - 0.9, hy - 2.4, (r + 0.9) * 2, 1.9); g.strokeStyle = PPL_GOLD; g.lineWidth = 0.6; g.strokeRect(-r - 0.9, hy - 2.4, (r + 0.9) * 2, 1.9);
    g.strokeStyle = shade(c, 0.65); g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, hy - r - 0.6); g.lineTo(0, hy - 2.6); g.stroke();
    rr(g, -0.8 + ex * 0.7, hy - 1.4, 1.6, 4.6, 0.6); g.fillStyle = ppl_metal(g, c, hy - 1, hy + 3.4); g.fill(); outline(g, 0.4);
  }
  function ppl_haleHead(g, C) {
    const hy = -10.2, r = 7.4, ex = C.fx * 1.6, ey = C.fy * 1.2, c = PPL_DK.hale.plate;
    const wv = Math.sin(time * 4 + 1) * 0.8;
    g.beginPath(); g.moveTo(0, hy - r - 1); g.quadraticCurveTo(-2.6, hy - r - 5.6, -7.4 + wv, hy - r - 1.6); g.quadraticCurveTo(-4, hy - r - 1.4, -1, hy - r + 1); g.closePath(); g.fillStyle = vfill(g, '#4a4f5a', hy - r - 5, hy - r + 1, 0.4, -0.3); g.fill(); outline(g, 0.45);
    // a bascinet with its visor down: a pointed snout, a sight slit, breathing holes
    ell(g, 0, hy, r + 0.7, r + 0.7); g.fillStyle = ppl_metal(g, c, hy - r, hy + r); g.fill(); outline(g, 0.9);
    if (!C.back) {
      g.beginPath(); g.moveTo(-r + 0.6 + ex, hy - 1.6 + ey * 0.5); g.quadraticCurveTo(ex, hy - 2.6, r - 0.6 + ex, hy - 1.6 + ey * 0.5); g.quadraticCurveTo(r - 1 + ex, hy + 4, ex + 1.4, hy + 6); g.lineTo(ex, hy + 7); g.lineTo(ex - 1.4, hy + 6); g.quadraticCurveTo(-r + 1 + ex, hy + 4, -r + 0.6 + ex, hy - 1.6 + ey * 0.5); g.closePath();
      g.fillStyle = ppl_metal(g, ppl_hex(c, 0.05), hy - 2, hy + 7); g.fill(); outline(g, 0.6);
      rr(g, -4.8 + ex, hy - 0.4 + ey * 0.6, 9.6, 1.3, 0.6); g.fillStyle = '#121418'; g.fill();
      g.strokeStyle = shade(c, 0.6); g.lineWidth = 0.5; g.beginPath(); g.moveTo(ex, hy + 1.2); g.lineTo(ex, hy + 6.4); g.stroke();
      g.fillStyle = '#121418'; for (const [x, y] of [[-2.4, 3], [-2.4, 4.4], [2.4, 3], [2.4, 4.4]]) { ell(g, x + ex, hy + y, 0.4, 0.4); g.fill(); }
      ppl_rivets(g, [[-r + 0.2, hy - 1], [r - 0.2, hy - 1]], shade(c, 0.6), 0.6);
    } else { g.strokeStyle = shade(c, 0.6); g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, hy - r - 0.3); g.lineTo(0, hy + 5); g.stroke(); g.fillStyle = shade(c, -0.25); g.fillRect(-r, hy + 3.6, r * 2, 1.4); }
    g.strokeStyle = PPL_GOLD; g.lineWidth = 0.6; g.beginPath(); g.arc(0, hy, r + 0.7, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  }
  function ppl_dkSword(g, W) {
    g.fillStyle = '#4a2e13'; g.fillRect(-3.4, -1.3, 6.8, 2.6); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.5; for (const x of [-2, -0.4, 1.2]) { g.beginPath(); g.moveTo(x, -1.3); g.lineTo(x + 0.7, 1.3); g.stroke(); }
    ell(g, -4.2, 0, 1.9, 1.9); g.fillStyle = ppl_metal(g, PPL_GOLD, -1.9, 1.9); g.fill(); outline(g, 0.5);
    rr(g, 3.2, -5.4, 2.4, 10.8, 0.8); g.fillStyle = ppl_metal(g, PPL_GOLD, -5.4, 5.4); g.fill(); outline(g, 0.45); for (const y of [-5.8, 5.8]) { ell(g, 4.4, y, 1, 1); g.fillStyle = PPL_GOLD; g.fill(); outline(g, 0.3); }
    g.beginPath(); g.moveTo(5.6, -2.3); g.lineTo(29, -1.9); g.lineTo(34.5, 0); g.lineTo(29, 1.9); g.lineTo(5.6, 2.3); g.closePath(); g.fillStyle = ppl_metal(g, '#d5d9e0', -2.3, 2.3); g.fill(); outline(g, 0.7);
    g.strokeStyle = '#ffffff'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(6.4, -1.4); g.lineTo(28, -1); g.stroke();
    g.strokeStyle = shade('#d5d9e0', -0.4); g.lineWidth = 0.7; g.beginPath(); g.moveTo(7, 0.2); g.lineTo(27, 0.2); g.stroke();
  }
  function ppl_dkShield(L) {
    return (g, back) => {
      bipedHand(g, 0.2, 0.4, shade(L.plate, -0.15));
      g.save(); if (back) g.scale(0.95, 0.95); else { g.translate(-0.6, -0.8); g.rotate(-0.12); }
      const shape = () => { g.beginPath(); g.moveTo(0, -6.8); g.quadraticCurveTo(5.4, -6, 5.2, -0.5); g.quadraticCurveTo(4.6, 5.8, 0, 10); g.quadraticCurveTo(-4.6, 5.8, -5.2, -0.5); g.quadraticCurveTo(-5.4, -6, 0, -6.8); g.closePath(); };
      shape(); g.fillStyle = vfill(g, L.coat, -7, 10, 0.25, -0.3); g.fill();
      g.strokeStyle = PPL_GOLD; g.lineWidth = 1.3; shape(); g.stroke(); shape(); outline(g, 0.6);
      if (!back) { ppl_dragonBadge(g, 0, 0.8, 1.25); g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(-3.6, -4.8); g.quadraticCurveTo(-4.4, 0, -2.6, 4); g.lineTo(-2, 3.6); g.quadraticCurveTo(-3.4, 0, -2.8, -5); g.closePath(); g.fill(); }
      else { g.strokeStyle = shade(L.coat, -0.4); g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -5); g.lineTo(0, 8); g.stroke(); }
      g.restore();
    };
  }
  function ppl_haleSpear(g, W) { ppl_spear(g, W, { haft: '#5a3a24', blade: '#d5d9e0', band: PPL_GOLD, butt: '#5b606b', tassel: '#c0392b', len: 1.5 }); }
  function ppl_drawAlly(g, e) {
    // in the game every Dragon Killer carries e.ally; without one (a sample) Hale stands in, as the game's own fallback does, and
    // a crowd mixes the two by seed
    const hale = e.ally ? e.ally === 'hale' : Math.floor(e.seed || 0) % 2 === 0, L = hale ? PPL_DK.hale : PPL_DK.garrick;
    ppl_biped(g, e, {
      hand: shade(L.plate, -0.15), legs: ppl_legs({ c: L.plate, metal: true, knee: L.plate, boot: ppl_hex(L.plate, -0.42), cuff: shade(L.plate, 0.1), w: 5.4, gap: 3.9, len: 6.4 }),
      backItem: ppl_dkCape(L, false), torso: ppl_dkTorso(L), head: hale ? ppl_haleHead : ppl_garrickHead,
      off: hale ? null : ppl_dkShield(L),
      weapon: hale ? ppl_haleSpear : ppl_dkSword, pose: hale ? ppl_thrust : ppl_swing, trail: hale ? false : undefined,
      rest: hale ? { a: -1.48, x: 10.6, y: 4.6 } : { a: -1.12, x: 10.4, y: 4.8 }, swooshR: 28, shW: 10.4,
    });
  }

  Object.assign(NEW_DRAW, {
    guard_m: ppl_drawGuardM, guard_f: ppl_drawGuardF, dwarf_guard: ppl_drawDwarf, castle_guard: ppl_drawCastleGuard,
    elf_sentinel: ppl_drawElf, sky_sentinel: ppl_drawSky, vampire: ppl_drawVampire, count_ashvane: ppl_drawCount, ally_knight: ppl_drawAlly,
  });
  // how big each is drawn (the knight is 1.08): townsfolk about his size, the dwarf short but broad, the goblin smaller,
  // the sky sentinel a touch taller, Count Ashvane a lord and a boss
  Object.assign(MOB_SIZE, { guard_m: 1.06, guard_f: 1.03, dwarf_guard: 1.06, castle_guard: 0.98, elf_sentinel: 1.06, sky_sentinel: 1.1, vampire: 1.05, count_ashvane: 1.5, ally_knight: 1.1 });

  // ---------- undead ----------
  // ================= THE UNDEAD AND THE FIRE: drawn in the approved knight's style =================
  // zombie_calm, grave_risen, grave_zombie, grave_zombie_calm, zombie_brute, cinderwight, cinder_heart.
  // Loaded after mobs-new.js: every helper there is used as-is (shade, rr, ell, outline, vfill, rfill, sparkle,
  // shadow, face4, swingOf, stepOf, bobOf, swoosh, bipedLegs, zombieTorso). Same rules as the approved 14: no
  // arms, floating hands; a weapon rests upright with the hand at the waist, in front facing us or side-on and
  // behind facing away; legs step; a swing leaves a swoosh. Every top-level name here starts with und_ / UND_.

  // the approved zombie's skin
  const UND_SKIN = '#8fa87a';
  // the grave zombie: darker, longer in the ground
  const UND_GSKIN = '#6f8a55';
  // grave cloth
  const UND_LINEN = '#cdbf9b';
  // grave earth (54-graves' dust colour)
  const UND_DIRT = '#5a4530';

  // ---------- the walking frame: drawBiped's order, plus a slower shamble and hands that hang ----------
  function und_biped(g, e, P) {
    const f = face4(e), back = f === 'up', mirror = f === 'left', fx = mirror ? -e.facing.x : e.facing.x;
    const step = stepOf(e) * (P.stepK || 1), bob = bobOf(e, P.bobK) * (P.bobScale || 1);
    const W = P.pose ? P.pose(e) : null;
    g.save(); shadow(g, 0, 11.4 * P.s, (P.shadowW || 9.5) * P.s, (P.shadowH || 3.8) * P.s);
    g.scale(mirror ? -P.s : P.s, P.s);
    if (P.sway) g.rotate(Math.sin(e.walkT * (P.swayF || 0.5)) * (e.moving ? P.sway : 0.02) + (P.lean ? P.lean(e) : 0));
    const weapon = () => { if (!W) return; g.save(); g.translate(W.hx, W.hy + bob); g.rotate(W.a); P.weapon(g, W.sw, e); g.restore(); if (P.grip) P.grip(g, W.hx, W.hy + bob, back); };
    if (back) weapon();
    if (P.hands) P.hands(g, e, bob, step, 'behind', f);
    if (P.legs) P.legs(g, step, e, f); else bipedLegs(g, step, P.legSpec);
    g.translate(0, bob);
    P.torso(g, back, e, fx, f);
    P.head(g, e, back, fx, f);
    g.translate(0, -bob);
    if (!back) { weapon(); if (W && P.swoosh) P.swoosh(g, W, bob, f); }
    if (P.hands) P.hands(g, e, bob, step, 'front', f);
    if (P.after) P.after(g, e, bob, step, f);
    g.restore();
  }

  // ---------- hands ----------
  // a floating dead hand: o.down = fingers hanging (calm), o.claws = dark nails, o.cuff = a broken iron shackle,
  // o.dirt = grave earth under the nails
  function und_hand(g, x, y, c, o) {
    o = o || {}; const r = o.r || 2.5;
    if (o.cuff) { rr(g, x - r - 0.3, y - r * 0.55 - (o.down ? 1.6 : 0), (r + 0.3) * 2, 1.7, 0.6); g.fillStyle = vfill(g, '#7d8087', y - 3, y); g.fill(); outline(g, 0.5); }
    ell(g, x, y, r, r * 0.92); g.fillStyle = rfill(g, c, x, y, r); g.fill(); outline(g, 0.7);
    g.strokeStyle = shade(c, -0.45); g.lineWidth = 0.45; g.lineCap = 'round'; g.beginPath();
    for (const k of [-1, 0, 1]) { g.moveTo(x + k * r * 0.48, y + r * 0.62); g.lineTo(x + k * r * 0.48, y + r * 1.05); }
    g.stroke();
    if (o.claws || o.dirt) { g.fillStyle = o.dirt ? 'rgba(70,52,34,0.9)' : '#2a2620'; for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(x + k * r * 0.48 - 0.45, y + r * 0.82); g.lineTo(x + k * r * 0.48, y + r * 1.25); g.lineTo(x + k * r * 0.48 + 0.45, y + r * 0.82); g.closePath(); g.fill(); } }
    if (o.dirt) { g.fillStyle = 'rgba(90,69,48,0.55)'; ell(g, x - r * 0.3, y - r * 0.2, r * 0.45, r * 0.32); g.fill(); }
  }
  // reaching out in front at chest height (the approved zombie's grab); facing away they are hidden
  function und_reach(g, e, bob, stage, f, H) {
    if (stage !== 'front' || f === 'up') return;
    const sw = swingOf(e), lunge = sw >= 0 ? Math.sin(sw * Math.PI) : 0, wob = Math.sin(time * 3 + (e.seed || 0)) * 0.5;
    if (f === 'down') for (const s of [-1, 1]) und_hand(g, s * (6.6 - lunge * 1.6), -0.6 + bob + (s > 0 ? wob : -wob) - lunge * 2.4, H.c, H);
    else for (const [x, y, k] of [[10.4, -0.8, 1], [8.6, 1.8, -1]]) und_hand(g, x + lunge * 4, y + bob + wob * k, H.c, H);
    // a clawed one rakes as it grabs: three short scratches in the air in front of it
    if (H.claws && sw >= 0 && sw < 0.85) {
      g.save(); g.strokeStyle = `rgba(255,255,255,${0.55 * (1 - sw)})`; g.lineWidth = 0.9; g.lineCap = 'round';
      const cx = f === 'down' ? 0 : 14, cy = f === 'down' ? 4.5 : 0.4;
      for (const k of [-1, 0, 1]) { g.beginPath(); if (f === 'down') { g.moveTo(cx + k * 2.4 - 2, cy - 3); g.quadraticCurveTo(cx + k * 2.4, cy, cx + k * 2.4 + 1.6, cy + 3.4); } else { g.moveTo(cx - 1, cy + k * 2.2 - 3.2); g.quadraticCurveTo(cx + 2, cy + k * 2.2, cx + 1.4, cy + k * 2.2 + 3.2); } g.stroke(); }
      g.restore();
    }
  }
  // calm: the hands hang down at its sides, swaying a little; when it is hit and turns to fight it grabs again
  function und_limp(g, e, bob, step, stage, f, H) {
    if (swingOf(e) >= 0) return und_reach(g, e, bob, stage, f, H);
    const dang = Math.sin(time * 1.6 + (e.seed || 0)) * 0.45, Hd = Object.assign({}, H, { down: true });
    if (f === 'down') { if (stage === 'front') for (const s of [-1, 1]) und_hand(g, s * (9.7 + dang * 0.3 * s), 5.6 + bob - step * s * 0.5 + dang * s * 0.6, H.c, Hd); }
    else if (f === 'up') { if (stage === 'behind') for (const s of [-1, 1]) und_hand(g, s * 9.9, 5.4 + bob + step * s * 0.5, H.c, Hd); }
    else if (stage === 'front') und_hand(g, 1.4 + step * 1.8 + dang * 0.4, 6.2 + bob, H.c, Hd);
  }
  // a fly that has found a calm one: it has not noticed the fly either
  function und_fly(g, e, bob, hy) {
    const t = time + (e.seed || 0) * 1.7, x = Math.cos(t * 4.3) * 9, y = (hy || -17) + Math.sin(t * 6.7) * 2.4 + bob;
    g.fillStyle = 'rgba(235,245,255,0.85)'; ell(g, x - 0.5, y - 0.7, 0.75, 0.45, -0.5); g.fill(); ell(g, x + 0.5, y - 0.7, 0.75, 0.45, 0.5); g.fill();
    g.fillStyle = '#1a1814'; ell(g, x, y, 0.7, 0.55); g.fill();
    g.strokeStyle = 'rgba(30,30,30,0.25)'; g.lineWidth = 0.35; g.setLineDash([0.6, 0.9]); g.beginPath(); g.arc(x - Math.cos(t * 4.3) * 2.2, y + 0.4, 2.2, 0.2, 1.6); g.stroke(); g.setLineDash([]);
  }

  // ---------- heads ----------
  // o: { skin, hair, tilt, calm, helm, hood, dirt, eyes: 'one' | 'both' }. Calm heads loll on the neck, droop,
  // and their eyes are half shut.
  function und_zhead(g, e, back, fx, o) {
    const hy = o.helm ? -10.4 : -10, r = 7.2, sw = swingOf(e), sleepy = o.calm && sw < 0;
    const wob = e.moving ? Math.sin(e.walkT * 0.5) : Math.sin(time * 1.1 + (e.seed || 0));
    const base = o.tilt === undefined ? -0.16 : o.tilt;
    const tilt = sleepy ? base * 2.3 + wob * 0.14 : base + (e.moving ? wob * 0.06 : 0);
    const piv = hy + r * 0.85, drop = sleepy ? 1.3 : 0;
    g.save(); g.translate(0, piv); g.rotate(tilt); g.translate(0, -piv + drop);
    if (o.hood) und_hoodBehind(g, hy, r, back);
    ell(g, 0, hy, r, r * 0.96); g.fillStyle = rfill(g, o.skin, 0, hy, r); g.fill(); outline(g, 0.9);
    if (o.hair && !o.helm) {
      g.fillStyle = o.hair; g.beginPath();
      if (back) { g.arc(0, hy - 0.4, r + 0.2, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(3, hy + 1.6, 0.6, hy + 0.4); g.quadraticCurveTo(-3, hy + 2.2, -r - 0.1, hy - 0.2); }
      else { g.arc(0, hy - 1.2, r + 0.2, Math.PI * 1.08, Math.PI * 1.7); g.quadraticCurveTo(-1, hy - 3.6, -r, hy - 2); }
      g.closePath(); g.fill();
      if (back) { g.strokeStyle = '#3a2a24'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(2.4, hy + 2.4); g.lineTo(5, hy + 3.6); for (let k = 0; k < 3; k++) { g.moveTo(2.8 + k * 0.9, hy + 1.8 + k * 0.45); g.lineTo(2.6 + k * 0.9, hy + 3.4 + k * 0.45); } g.stroke(); }
    }
    if (!back) und_zface(g, e, fx, hy, o, sleepy);
    if (o.helm) und_potHelm(g, hy, r, back, sleepy);
    if (o.hood) und_hoodFront(g, hy, r, back);
    if (o.dirt) und_clod(g, -1.4, hy - r - 1.2, 3.4, 1.9, true);
    g.restore();
  }
  function und_zface(g, e, fx, hy, o, sleepy) {
    const ex = fx * 1.5, ey = o.helm ? hy + 1.5 : hy + 0.2, pulse = Math.sin(time * 5);
    const glowA = sleepy ? 0.28 + pulse * 0.08 : 0.6 + pulse * 0.3;
    const eyeCol = o.eyeCol || '#ffe36b', glowRGB = o.glowRGB || '255,236,120';
    const glowEye = (x) => {
      const gl = g.createRadialGradient(x, ey, 0, x, ey, 3.4); gl.addColorStop(0, `rgba(${glowRGB},${glowA})`); gl.addColorStop(1, `rgba(${glowRGB},0)`); g.fillStyle = gl; ell(g, x, ey, 3.4, 3.4); g.fill();
      ell(g, x, ey, 1.5, 1.4); g.fillStyle = sleepy ? shade(eyeCol, -0.25) : eyeCol; g.fill();
    };
    if (o.eyes === 'both') {
      for (const s of [-1, 1]) { ell(g, s * 2.8 + ex, ey, 2.1, 1.9); g.fillStyle = shade(o.skin, -0.5); g.fill(); glowEye(s * 2.8 + ex); }
      if (!sleepy) { g.strokeStyle = shade(o.skin, -0.6); g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(-4.8 + ex, ey - 2.4); g.lineTo(-1.2 + ex, ey - 1.5); g.moveTo(4.8 + ex, ey - 2.4); g.lineTo(1.2 + ex, ey - 1.5); g.stroke(); }
    } else {
      ell(g, -2.8 + ex, ey, 1.7, 1.5); g.fillStyle = '#e8e2c0'; g.fill(); ell(g, -2.8 + ex + fx * 0.3, ey + (sleepy ? 0.6 : 0.1), 0.6, 0.6); g.fillStyle = '#4a4a3a'; g.fill();
      glowEye(2.8 + ex);
    }
    // heavy lids, half shut
    if (sleepy) {
      for (const s of [-1, 1]) { const x = s * 2.8 + ex; g.beginPath(); g.ellipse(x, ey + 0.1, 2.1, 1.9, 0, Math.PI, Math.PI * 2); g.closePath(); g.fillStyle = shade(o.skin, -0.12); g.fill(); g.strokeStyle = shade(o.skin, -0.55); g.lineWidth = 0.55; g.beginPath(); g.moveTo(x - 1.9, ey + 0.1); g.quadraticCurveTo(x, ey + 0.6, x + 1.9, ey + 0.1); g.stroke(); }
    }
    const my = o.helm ? hy + 4.6 : hy + 3.4;
    // the jaw hangs slack
    if (sleepy) {
      ell(g, ex + 0.4, my + 0.9, 1.7, 1.3); g.fillStyle = '#2a1410'; g.fill(); g.strokeStyle = shade(o.skin, -0.45); g.lineWidth = 0.5; g.beginPath(); g.arc(ex + 0.4, my + 0.9, 1.9, 0.3, Math.PI - 0.3); g.stroke();
      g.fillStyle = '#e8e2c0'; g.fillRect(ex - 0.5, my - 0.4, 0.9, 0.9);
    // teeth bared, an underbite
    } else if (o.eyes === 'both') {
      g.beginPath(); g.moveTo(-3.2 + ex, my); g.quadraticCurveTo(ex, my + 2.6, 3.2 + ex, my); g.quadraticCurveTo(ex, my + 0.8, -3.2 + ex, my); g.closePath(); g.fillStyle = '#2a1410'; g.fill();
      g.fillStyle = '#e8e2c0'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.8 + ex - 0.55, my + 1.6); g.lineTo(s * 1.8 + ex, my - 0.3); g.lineTo(s * 1.8 + ex + 0.55, my + 1.5); g.closePath(); g.fill(); }
      g.fillRect(ex - 0.45, my + 0.2, 0.9, 0.9);
    } else {
      g.beginPath(); g.moveTo(-2.8 + ex, my); g.quadraticCurveTo(ex, my + 2.2, 2.6 + ex, my + 0.2); g.closePath(); g.fillStyle = '#2a1410'; g.fill();
      g.fillStyle = '#e8e2c0'; g.fillRect(-1.4 + ex, my + 0.1, 1, 1.1); g.fillRect(1 + ex, my + 0.2, 0.9, 0.9);
    }
    // stitches: across the brow on the plain dead, across the cheek on the grave zombie
    g.strokeStyle = '#3a2a24'; g.lineWidth = 0.5; g.beginPath();
    if (o.eyes === 'both') { g.moveTo(3.4 + ex, hy + 3.4); g.lineTo(6, hy + 1.4); for (let k = 0; k < 3; k++) { const x = 3.9 + k * 0.8, y = hy + 3 - k * 0.62; g.moveTo(x - 0.5, y - 0.6); g.lineTo(x + 0.5, y + 0.6); } }
    else if (!o.hood) { g.moveTo(-4.6, hy - 4.6); g.lineTo(-0.8, hy - 3.4); for (let x = -4; x <= -1.2; x += 0.9) { g.moveTo(x, hy - 5.2 + (x + 4) * 0.3); g.lineTo(x + 0.2, hy - 3.6 + (x + 4) * 0.3); } }
    else { g.moveTo(-5.2 + ex, hy + 2.2); g.lineTo(-3.4 + ex, hy + 3.6); }
    g.stroke();
    if (o.hood || o.dirt) { g.fillStyle = 'rgba(90,69,48,0.55)'; ell(g, 4.6 + ex, hy + 4, 1.5, 0.9, -0.3); g.fill(); ell(g, -4.8 + ex, hy + 2.8, 1, 0.7); g.fill(); }
  }
  // the grave zombie's iron pot helm: dented, rusted, sitting crooked (more crooked on a calm one)
  function und_potHelm(g, hy, r, back, sleepy) {
    g.save(); g.translate(0, hy); g.rotate(sleepy ? 0.2 : 0.1); g.translate(0, -hy);
    g.beginPath(); g.arc(0, hy - 0.6, r + 0.9, Math.PI, Math.PI * 2); g.closePath();
    g.fillStyle = vfill(g, '#6a6e76', hy - 9, hy, 0.3, -0.35); g.fill(); outline(g, 0.8);
    g.fillStyle = 'rgba(30,32,38,0.45)'; g.beginPath(); g.arc(-3.4, hy - 5.4, 2, 0.4, Math.PI * 1.5); g.quadraticCurveTo(-2.4, hy - 5.4, -3.4, hy - 3.4); g.fill();
    if (!back) { g.strokeStyle = '#45484f'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0.4, hy - r - 1.4); g.lineTo(0.4, hy - 1); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.6; g.beginPath(); g.arc(0, hy - 0.6, r - 0.6, Math.PI * 1.15, Math.PI * 1.45); g.stroke();
    rr(g, -r - 1.6, hy - 1.9, (r + 1.6) * 2, 2.3, 0.9); g.fillStyle = vfill(g, '#4f525a', hy - 2, hy + 0.4); g.fill(); outline(g, 0.6);
    g.fillStyle = '#a9adb5'; for (const x of [-6.2, -2.6, 2.6, 6.2]) { ell(g, x, hy - 0.75, 0.5, 0.5); g.fill(); }
    g.strokeStyle = 'rgba(150,84,40,0.75)'; g.lineWidth = 0.55; g.beginPath(); for (const [x, l] of [[-2.6, 2.2], [2.6, 1.4], [5, 3]]) { g.moveTo(x, hy - 2.3); g.lineTo(x + 0.2, hy - 2.3 - l); } g.stroke();
    g.fillStyle = 'rgba(150,84,40,0.55)'; ell(g, 4.4, hy - 0.4, 1.4, 0.6); g.fill();
    g.restore();
  }
  // the risen's shroud hood
  function und_hoodBehind(g, hy, r, back) {
    g.beginPath(); g.moveTo(-r - 1.9, hy + 5.4); g.quadraticCurveTo(-r - 2.8, hy - r - 1.4, 0, hy - r - 2.2); g.quadraticCurveTo(r + 2.8, hy - r - 1.4, r + 1.9, hy + 5.4); g.quadraticCurveTo(0, hy + 7.6, -r - 1.9, hy + 5.4); g.closePath();
    g.fillStyle = vfill(g, UND_LINEN, hy - r - 2, hy + 7); g.fill(); outline(g, 0.8);
  }
  function und_hoodFront(g, hy, r, back) {
    // from behind the hood covers the whole head: a seam, earth ground into the weave
    if (back) {
      g.beginPath(); g.ellipse(0, hy - 0.4, r + 1.7, r + 1.5, 0, 0, Math.PI * 2); g.fillStyle = rfill(g, UND_LINEN, 0, hy, r + 1.6); g.fill(); outline(g, 0.8);
      g.strokeStyle = 'rgba(110,90,60,0.6)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, hy - r - 1.6); g.quadraticCurveTo(0.6, hy, 0, hy + r); g.stroke();
      g.fillStyle = 'rgba(90,69,48,0.45)'; ell(g, -3.4, hy + 2.6, 2.4, 1.6); g.fill(); ell(g, 3.6, hy - 2.4, 1.6, 1.1); g.fill();
      return;
    }
    g.beginPath(); g.arc(0, hy + 0.8, r + 1.5, Math.PI * 1.04, Math.PI * 1.96); g.arc(0, hy + 1.4, r - 0.2, Math.PI * 1.9, Math.PI * 1.1, true); g.closePath();
    g.fillStyle = vfill(g, UND_LINEN, hy - r - 1, hy - 3); g.fill(); outline(g, 0.7);
    g.strokeStyle = 'rgba(110,90,60,0.55)'; g.lineWidth = 0.45; g.beginPath(); g.arc(0, hy + 1.2, r + 0.6, Math.PI * 1.25, Math.PI * 1.75); g.stroke();
    g.fillStyle = 'rgba(90,69,48,0.5)'; ell(g, 3.6, hy - r + 0.4, 1.6, 0.8, 0.3); g.fill();
  }
  // a clod of grave earth with grass still growing out of it
  function und_clod(g, x, y, w, h, grass) {
    g.beginPath(); g.moveTo(x - w, y + h * 0.5); g.quadraticCurveTo(x - w * 1.05, y - h * 0.6, x - w * 0.3, y - h * 0.8); g.quadraticCurveTo(x + w * 0.1, y - h * 1.3, x + w * 0.6, y - h * 0.7); g.quadraticCurveTo(x + w * 1.15, y - h * 0.2, x + w, y + h * 0.6); g.quadraticCurveTo(x, y + h * 1.1, x - w, y + h * 0.5); g.closePath();
    g.fillStyle = rfill(g, UND_DIRT, x, y, w); g.fill(); outline(g, 0.6);
    g.fillStyle = 'rgba(40,28,16,0.6)'; ell(g, x - w * 0.3, y + h * 0.2, 0.5, 0.4); g.fill(); ell(g, x + w * 0.45, y, 0.4, 0.35); g.fill();
    if (grass) { g.strokeStyle = '#6fbf4a'; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); for (const [dx, tx, ty] of [[-0.6, -1.6, -3.4], [0.2, 0.4, -4], [0.9, 2.2, -3]]) { g.moveTo(x + dx, y - h * 0.6); g.quadraticCurveTo(x + dx + tx * 0.2, y - h * 0.6 + ty * 0.6, x + dx + tx * 0.5, y - h * 0.6 + ty); } g.stroke(); }
  }

  // ---------- the calm zombie: the approved zombie, asleep on its feet ----------
  function und_drawZombieCalm(g, e) {
    und_biped(g, e, {
      s: 1, stepK: 0.55, bobK: 0.5, sway: 0.1, swayF: 0.5,
      legSpec: { c: '#5a4a3a', tear: true, skin: UND_SKIN, boot: '#3a2a1c' },
      torso: (g, back) => zombieTorso(g, back),
      head: (g, e, back, fx) => und_zhead(g, e, back, fx, { skin: UND_SKIN, hair: '#3a3a2e', calm: true, tilt: -0.17 }),
      hands: (g, e, bob, step, stage, f) => und_limp(g, e, bob, step, stage, f, { c: UND_SKIN }),
      after: (g, e, bob) => { if (swingOf(e) < 0) und_fly(g, e, bob, -17.5); },
    });
  }

  // ---------- the risen: out of the grave a minute ago, in its burial shroud, the earth falling off it ----------
  function und_shroudTorso(g, back, e) {
    zombieTorso(g, back);
    // the grave is all over it: earth ground into the tunic
    const body = () => { g.beginPath(); g.moveTo(-7.6, -4); g.quadraticCurveTo(-9.4, 2, -7.4, 6.8); g.lineTo(-7.4, 9); g.lineTo(7.4, 9); g.lineTo(7.4, 6.8); g.quadraticCurveTo(9.4, 2, 7.6, -4); g.closePath(); };
    g.save(); body(); g.clip(); g.fillStyle = 'rgba(90,69,48,0.6)';
    for (const [x, y, rx, ry] of [[-4.4, 5.6, 3, 1.8], [4.6, 6.6, 2.4, 1.6], [0.4, 8.2, 2.6, 1.2], [5.6, 3.4, 1.4, 1]]) { ell(g, x, y, rx, ry, 0.3); g.fill(); }
    g.restore();
    // the shroud: a capelet of grave linen over the shoulders, its hem torn, the dirt still on it
    const cape = () => {
      g.beginPath(); g.moveTo(-8.6, -4.6); g.quadraticCurveTo(0, -7.2, 8.6, -4.6); g.quadraticCurveTo(10.4, -1.4, 9.8, back ? 3.6 : 1.4);
      const pts = back ? [[7.6, 2.6], [5.4, 4.6], [3, 3], [0.6, 5.2], [-1.8, 3.2], [-4.2, 4.8], [-6.6, 2.8], [-9.8, 3.6]] : [[7.8, 2.8], [6, 0.8], [4.2, 2.6], [2.2, 0.2], [0, -0.6], [-2.2, 0.2], [-4.2, 2.4], [-6, 0.6], [-7.8, 2.6], [-9.8, 1.4]];
      for (const q of pts) g.lineTo(...q);
      g.quadraticCurveTo(-10.4, -1.4, -8.6, -4.6); g.closePath();
    };
    cape(); g.fillStyle = vfill(g, UND_LINEN, -6.5, 4.5, 0.25, -0.25); g.fill();
    g.save(); cape(); g.clip();
    g.fillStyle = 'rgba(90,69,48,0.55)'; for (const [x, y, rx, ry] of [[-6, 0.6, 2.2, 1.4], [5.4, -1.6, 1.8, 1.2], [1.4, 2.4, 1.6, 0.9]]) { ell(g, x, y, rx, ry, 0.4); g.fill(); }
    g.strokeStyle = 'rgba(110,90,60,0.5)'; g.lineWidth = 0.45; g.beginPath(); for (const x of [-5.6, -2.6, 2.8, 5.8]) { g.moveTo(x * 0.8, -5.2); g.quadraticCurveTo(x, -2, x * 1.08, 2.2); } g.stroke();
    g.restore();
    cape(); outline(g, 0.7);
    // the shroud's tie at the throat
    if (!back) {
      g.strokeStyle = OUT; g.lineWidth = 1.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-1.6, -4.4); g.lineTo(-0.4, -2.6); g.moveTo(1.6, -4.4); g.lineTo(0.4, -2.6); g.stroke();
      g.strokeStyle = '#a89870'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-1.6, -4.4); g.lineTo(-0.4, -2.6); g.moveTo(1.6, -4.4); g.lineTo(0.4, -2.6); g.stroke();
      ell(g, 0, -4.4, 0.9, 0.7); g.fillStyle = '#a89870'; g.fill(); outline(g, 0.35);
    }
    // roots still hanging off the shroud and the hem
    g.strokeStyle = '#4a3420'; g.lineWidth = 0.55; g.lineCap = 'round'; g.beginPath();
    for (const [x, y0, l, b] of [[-7.6, 2.4, 3.6, -0.8], [6.4, 2.4, 3, 0.8], [-3, 8.6, 2.6, 0.6], [4.4, 8.6, 2.2, -0.6]]) { g.moveTo(x, y0); g.quadraticCurveTo(x + b, y0 + l * 0.5, x - b * 0.4, y0 + l); g.moveTo(x + b * 0.3, y0 + l * 0.5); g.lineTo(x + b * 1.4, y0 + l * 0.7); }
    g.stroke();
    // clods of earth on the shoulders; a worm has come along for the ride
    und_clod(g, -6.8, -4.8, 2.6, 1.4, false);
    und_clod(g, 6.4, -5, 2.4, 1.3, !back);
    if (!back) { const w = Math.sin(time * 3) * 0.5; g.strokeStyle = OUT; g.lineWidth = 1.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(7.4, -5.6); g.quadraticCurveTo(8.6 + w, -7.8, 7.6 + w, -8.8); g.stroke(); g.strokeStyle = '#e39a9a'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(7.4, -5.6); g.quadraticCurveTo(8.6 + w, -7.8, 7.6 + w, -8.8); g.stroke(); }
  }
  function und_crumbs(g, e, bob) {
    // the grave keeps falling off it, a crumb at a time (faster when it walks)
    const sp = e.moving ? 1.6 : 0.7;
    for (let i = 0; i < 4; i++) {
      const ph = (time * sp + i * 0.29 + (e.seed || 0) * 0.13) % 1, x = [-5.4, 1.6, 6, -2][i], y = 6.4 + bob + ph * 5;
      g.fillStyle = `rgba(74,56,38,${0.9 * (1 - ph)})`; ell(g, x + Math.sin(i * 3 + ph * 4) * 0.5, y, 0.7, 0.6); g.fill();
    }
  }
  function und_drawRisen(g, e) {
    und_biped(g, e, {
      s: 1, bobK: 0.9, sway: 0.07,
      legSpec: { c: '#54483a', tear: true, skin: UND_SKIN, barefoot: true, foot: '#7f946a' },
      torso: (g, back, e) => und_shroudTorso(g, back, e),
      head: (g, e, back, fx) => und_zhead(g, e, back, fx, { skin: UND_SKIN, hair: '#3a3a2e', hood: true, dirt: true, tilt: 0.14 }),
      hands: (g, e, bob, step, stage, f) => und_reach(g, e, bob, stage, f, { c: UND_SKIN, dirt: true }),
      after: (g, e, bob) => und_crumbs(g, e, bob),
    });
  }

  // ---------- the grave zombie (level 24) and its calm twin: an old dead soldier in a rusted helm ----------
  function und_graveTorso(g, back) {
    const C = '#3a3a30';
    const path = () => { g.beginPath(); g.moveTo(-8, -4.2); g.quadraticCurveTo(-9.9, 2, -7.8, 6.8); for (let x = -7.8; x <= 7.8; x += 1.95) g.lineTo(x + 0.95, 9 - (Math.round(x / 1.95) % 2 ? 1.8 : 0)); g.lineTo(7.8, 6.8); g.quadraticCurveTo(9.9, 2, 8, -4.2); g.quadraticCurveTo(0, -6.3, -8, -4.2); g.closePath(); };
    path(); g.fillStyle = vfill(g, C, -5, 9, 0.28, -0.35); g.fill(); outline(g, 0.8);
    // a rip across the chest: dead skin, ribs showing through
    if (!back) {
      g.beginPath(); g.moveTo(0.6, -2.6); g.lineTo(2.4, -3.2); g.lineTo(4.8, -2.4); g.lineTo(5.6, 0.2); g.lineTo(4.6, 2.6); g.lineTo(2, 2.2); g.lineTo(0.8, 0.4); g.closePath();
      g.fillStyle = vfill(g, UND_GSKIN, -3, 3); g.fill(); outline(g, 0.5);
      g.strokeStyle = '#d9d4bf'; g.lineWidth = 0.6; g.lineCap = 'round'; g.beginPath(); for (const y of [-1.8, -0.3, 1.2]) { g.moveTo(1.6, y); g.quadraticCurveTo(3.2, y - 0.6, 5, y + 0.2); } g.stroke();
      g.fillStyle = 'rgba(90,69,48,0.5)'; ell(g, -4, 2.8, 1.9, 1.2); g.fill();
    // a patch sewn on the back
    } else {
      rr(g, -2.4, -1.6, 4.4, 3.6, 0.5); g.fillStyle = '#4e4a3a'; g.fill(); g.strokeStyle = 'rgba(200,190,160,0.6)'; g.lineWidth = 0.4; g.setLineDash([0.7, 0.6]); rr(g, -2.4, -1.6, 4.4, 3.6, 0.5); g.stroke(); g.setLineDash([]);
    }
    // a broad belt, an iron buckle, and a broken chain hanging off it
    g.beginPath(); g.moveTo(-8.4, 4.4); g.quadraticCurveTo(0, 5.6, 8.4, 4.6); g.lineTo(8.3, 6.4); g.quadraticCurveTo(0, 7.4, -8.3, 6.2); g.closePath(); g.fillStyle = vfill(g, '#2a2018', 4, 7); g.fill(); outline(g, 0.5);
    if (!back) { rr(g, -1.4, 4.4, 2.8, 2.6, 0.5); g.fillStyle = vfill(g, '#8a8e96', 4, 7); g.fill(); outline(g, 0.4); g.fillStyle = '#2a2018'; g.fillRect(-0.6, 5.2, 1.2, 1); }
    g.strokeStyle = '#7d8087'; g.lineWidth = 0.6; for (let k = 0; k < 3; k++) { ell(g, -5.6 + (k % 2) * 0.3, 7 + k * 1.3, 0.6, 0.85); g.stroke(); }
    // an iron shoulder plate, rusted, with rivets
    ell(g, -8.6, -3.2, 4.3, 3.3, -0.25); g.fillStyle = vfill(g, '#6a6e76', -6.6, 0.2); g.fill(); outline(g, 0.7);
    g.strokeStyle = 'rgba(40,42,48,0.6)'; g.lineWidth = 0.5; g.beginPath(); g.arc(-8.6, -1.6, 3.4, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.fillStyle = '#b4b8c0'; for (const [x, y] of [[-11, -3.4], [-8.6, -5.6], [-6.2, -3.6]]) { ell(g, x, y, 0.45, 0.45); g.fill(); }
    g.strokeStyle = 'rgba(150,84,40,0.7)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-9.6, -4.8); g.lineTo(-10, -1.4); g.moveTo(-7.4, -4.6); g.lineTo(-7.2, -2.2); g.stroke();
  }
  function und_drawGraveZombie(g, e, calm) {
    const H = { c: UND_GSKIN, r: 2.7, claws: true };
    und_biped(g, e, {
      s: 1, stepK: calm ? 0.55 : 1, bobK: calm ? 0.5 : 1.1, sway: calm ? 0.1 : 0.05,
      legSpec: { c: '#3e3a32', tear: true, skin: UND_GSKIN, boot: '#24201a' },
      torso: (g, back) => und_graveTorso(g, back),
      head: (g, e, back, fx) => und_zhead(g, e, back, fx, { skin: UND_GSKIN, helm: true, calm, tilt: 0.2, eyes: 'both', eyeCol: '#e8f07a', glowRGB: '214,255,120' }),
      hands: (g, e, bob, step, stage, f) => calm ? und_limp(g, e, bob, step, stage, f, Object.assign({ cuff: true }, H)) : und_reach(g, e, bob, stage, f, Object.assign({ cuff: true }, H)),
      after: calm ? (g, e, bob) => { if (swingOf(e) < 0) und_fly(g, e, bob, -18.6); } : null,
    });
  }

  // ---------- the zombie brute (level 30): two tiles of dead weight with a headstone lashed to a beam ----------
  const UND_BR = { skin: '#63804c', dark: '#41562f', cloth: '#4a4038', iron: '#6e7178', wood: '#5c4326', stone: '#8d9098' };
  // 54-graves' SLAM.wind and SLAM.stagger
  const UND_SLAM_WIND = 1.1, UND_SLAM_STAGGER = 1.7;
  function und_brutePose(e) {
    const sw = swingOf(e), ang = Math.atan2(e.facing.y, Math.abs(e.facing.x) || 0.0001);
    const wind = e.windT > 0 ? 1 - e.windT / UND_SLAM_WIND : 0, stag = e.stagT > 0 ? e.stagT / UND_SLAM_STAGGER : 0;
    const sh = { x: 9, y: -5 };
    let a, hx, hy;
    if (sw >= 0) { a = ang + lerp(-2, 1.3, ease(sw)); hx = sh.x + Math.cos(a) * 6; hy = sh.y + Math.sin(a) * 6; }
    else if (wind > 0) { a = lerp(-1.3, -2.6, ease(wind)); hx = lerp(12.5, 5, wind); hy = lerp(4.5, -9, wind); }
    else if (stag > 0) { a = ang + 1.3; hx = sh.x + Math.cos(a) * 6; hy = sh.y + Math.sin(a) * 6; }
    else { a = -1.32 + stepOf(e) * 0.05; hx = 12.6; hy = 4.6 + stepOf(e) * 0.5; }
    return { a, hx, hy, sw, ang, sh, wind, stag };
  }
  function und_headstoneMaul(g, sw) {
    // the beam
    rr(g, -6, -1.8, 28, 3.6, 1.3); g.fillStyle = vfill(g, UND_BR.wood, -2, 2); g.fill(); outline(g, 0.7);
    g.strokeStyle = 'rgba(40,26,12,0.55)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-4, -0.6); g.lineTo(9, -0.4); g.moveTo(2, 0.8); g.lineTo(15, 0.6); g.stroke();
    g.strokeStyle = '#3a2410'; g.lineWidth = 0.6; for (const x of [-3, -1.2, 0.6]) { g.beginPath(); g.moveTo(x, -1.8); g.lineTo(x + 0.9, 1.8); g.stroke(); }
    // the headstone, its round top pointing away along the beam
    const stone = () => { g.beginPath(); g.moveTo(19, -8); g.lineTo(27, -8); g.quadraticCurveTo(34.6, -8, 34.6, 0); g.quadraticCurveTo(34.6, 8, 27, 8); g.lineTo(19, 8); g.quadraticCurveTo(18.2, 0, 19, -8); g.closePath(); };
    stone(); g.fillStyle = vfill(g, UND_BR.stone, -8, 8, 0.32, -0.38); g.fill();
    g.save(); stone(); g.clip();
    g.fillStyle = 'rgba(90,130,60,0.75)'; ell(g, 19.6, 5.6, 3, 2.6); g.fill(); ell(g, 21.4, -6.6, 2.2, 1.6); g.fill(); ell(g, 30.6, 6.2, 1.6, 1.2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(19, -7.4, 15, 2);
    g.restore();
    stone(); outline(g, 0.9);
    // a plain carved cross, and a crack through the stone
    g.strokeStyle = 'rgba(40,42,48,0.75)'; g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(23, 0); g.lineTo(31.4, 0); g.moveTo(28.6, -3); g.lineTo(28.6, 3); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(23.2, 0.7); g.lineTo(31.2, 0.7); g.moveTo(29.2, -2.6); g.lineTo(29.2, 3); g.stroke();
    g.strokeStyle = 'rgba(30,30,34,0.7)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(33.4, -4); g.lineTo(31, -2.6); g.lineTo(32, -1); g.lineTo(30.2, 0.4); g.stroke();
    // rope lashing the stone onto the beam
    g.strokeStyle = OUT; g.lineWidth = 1.6; g.beginPath(); g.moveTo(17.4, -5); g.lineTo(23, 5); g.moveTo(17.4, 5); g.lineTo(23, -5); g.stroke();
    g.strokeStyle = '#c9a66b'; g.lineWidth = 1; g.beginPath(); g.moveTo(17.4, -5); g.lineTo(23, 5); g.moveTo(17.4, 5); g.lineTo(23, -5); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(16.4, -2.2); g.lineTo(16.4, 2.2); g.stroke(); g.strokeStyle = '#c9a66b'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(16.4, -2.2); g.lineTo(16.4, 2.2); g.stroke();
  }
  function und_bruteFist(g, x, y, back) {
    ell(g, x, y, 3.5, 3.2); g.fillStyle = rfill(g, UND_BR.skin, x, y, 3.5); g.fill(); outline(g, 0.8);
    if (!back) { g.strokeStyle = shade(UND_BR.skin, -0.45); g.lineWidth = 0.55; g.beginPath(); for (const k of [-1, 0, 1]) { g.moveTo(x + k * 1.3, y + 1.4); g.lineTo(x + k * 1.3, y + 2.9); } g.stroke(); }
    g.fillStyle = 'rgba(30,40,20,0.35)'; ell(g, x + 1.2, y - 1, 1, 0.7); g.fill();
  }
  function und_bruteLegs(g, step) {
    for (const s of [-1, 1]) {
      const off = step * 1.3 * s, x = s * 6.2, y = 5.2 + off;
      // thick legs in ragged trousers, the shins bare
      rr(g, x - 3.7, y - 3.2, 7.4, 5.4, 2.4); g.fillStyle = vfill(g, UND_BR.cloth, y - 3, y + 2); g.fill(); outline(g, 0.7);
      g.fillStyle = UND_BR.cloth; g.beginPath(); g.moveTo(x - 3.7, y + 1.4); for (let k = 0; k <= 4; k++) g.lineTo(x - 3.7 + k * 1.85, y + 2.4 + (k % 2 ? 1.2 : 0)); g.lineTo(x + 3.7, y + 1.4); g.closePath(); g.fill();
      rr(g, x - 2.6, y + 1.6, 5.2, 2.6, 1.2); g.fillStyle = UND_BR.dark; g.fill();
      // big bare feet
      ell(g, x + s * 0.5, y + 4.4, 4.1, 2.1); g.fillStyle = vfill(g, UND_BR.skin, y + 2.4, y + 6.4); g.fill(); outline(g, 0.7);
      g.fillStyle = shade(UND_BR.skin, -0.35); for (const t of [-2.4, -0.9, 0.6, 2]) { ell(g, x + s * 0.5 + t, y + 5.8, 0.7, 0.55); g.fill(); }
    }
  }
  function und_bruteTorso(g, back, e, fx) {
    const B = UND_BR, cx = back ? 0 : fx * 1.2;
    const slab = () => { g.beginPath(); g.moveTo(-12.6, -6.4); g.quadraticCurveTo(-16, 1, -11.2, 7.6); g.quadraticCurveTo(0, 10.6, 11.2, 7.6); g.quadraticCurveTo(16, 1, 12.6, -6.4); g.quadraticCurveTo(0, -11.4, -12.6, -6.4); g.closePath(); };
    slab(); g.fillStyle = vfill(g, B.skin, -11, 10, 0.22, -0.35); g.fill();
    g.save(); slab(); g.clip();
    if (!back) {
      // the sag of the belly
      g.fillStyle = 'rgba(40,58,28,0.45)'; ell(g, cx, 5.6, 9.4, 4.4); g.fill();
      // ribs pushing through
      g.strokeStyle = 'rgba(232,228,210,0.8)'; g.lineWidth = 1.1; g.lineCap = 'round'; g.beginPath();
      for (let k = 0; k < 3; k++) { const y = -4.4 + k * 2.5; g.moveTo(cx - 2.2, y); g.quadraticCurveTo(cx - 6.4, y - 0.8, cx - 9, y + 1.2); }
      g.stroke();
      // rot
      g.fillStyle = 'rgba(70,60,80,0.4)'; ell(g, cx + 7, -1.4, 2.6, 1.8, 0.4); g.fill(); ell(g, cx - 6.4, 4.6, 2, 1.3); g.fill();
      g.fillStyle = 'rgba(200,210,150,0.35)'; ell(g, cx + 7.4, -1.8, 1, 0.6); g.fill();
      g.strokeStyle = 'rgba(30,26,18,0.7)'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(cx + 5, 2.4); g.lineTo(cx + 9.6, 4.6); for (let k = 0; k < 3; k++) { const x = cx + 5.8 + k * 1.5, y = 2.8 + k * 0.7; g.moveTo(x - 0.4, y - 0.9); g.lineTo(x + 0.4, y + 0.9); } g.stroke();
    } else {
      // shoulder blades
      g.fillStyle = 'rgba(40,58,28,0.35)'; for (const s of [-1, 1]) { ell(g, s * 5.4, -2.6, 4.2, 2.8, s * 0.3); g.fill(); }
      // the spine
      g.fillStyle = shade(B.skin, 0.25); for (let k = 0; k < 5; k++) { ell(g, 0, -7 + k * 2.6, 1, 0.8); g.fill(); }
      g.fillStyle = 'rgba(70,60,80,0.4)'; ell(g, -6.6, 3.6, 2.4, 1.6, 0.3); g.fill(); ell(g, 7, -4, 1.8, 1.2); g.fill();
    }
    g.restore();
    slab(); outline(g, 1);
    // a stitched seam down the middle (across the back from behind)
    g.strokeStyle = 'rgba(30,26,18,0.8)'; g.lineWidth = 0.8; g.beginPath();
    if (!back) { g.moveTo(cx + 2, -8); g.quadraticCurveTo(cx + 3, 0, cx + 1.4, 7.6); for (let y = -6.6; y < 7; y += 2.2) { const x = cx + 2 + Math.sin((y + 8) / 16 * Math.PI) * 0.9; g.moveTo(x - 1.1, y - 0.5); g.lineTo(x + 1.1, y + 0.5); } }
    else { g.moveTo(-9, 1); g.quadraticCurveTo(0, 3, 9, 0.4); for (let x = -7.6; x < 9; x += 2.2) { const y = 1 + Math.sin((x + 9) / 18 * Math.PI) * 1.1; g.moveTo(x - 0.4, y - 1.1); g.lineTo(x + 0.4, y + 1.1); } }
    g.stroke();
    // a rope belt and the rag hanging from it
    g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, 6); g.quadraticCurveTo(0, 8.6, 12, 6); g.stroke();
    g.strokeStyle = '#a88a56'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-12, 6); g.quadraticCurveTo(0, 8.6, 12, 6); g.stroke();
    if (!back) { g.beginPath(); g.moveTo(cx - 3.4, 7.6); g.lineTo(cx + 3.4, 7.6); g.lineTo(cx + 2.8, 11.6); g.lineTo(cx + 1, 10.6); g.lineTo(cx - 0.6, 12); g.lineTo(cx - 3, 11); g.closePath(); g.fillStyle = vfill(g, '#5a4c3e', 7, 12); g.fill(); outline(g, 0.5); }
    // the hunched shoulders
    for (const s of [-1, 1]) { ell(g, s * 11.6, -6.4, 5.2, 4.4, s * 0.2); g.fillStyle = rfill(g, B.dark, s * 11.6, -6.4, 5.2); g.fill(); outline(g, 0.8); }
    g.strokeStyle = 'rgba(232,228,210,0.55)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(10.4, -8.6); g.lineTo(13.4, -5.6); g.moveTo(11, -7.2); g.lineTo(12.4, -8.4); g.moveTo(11.8, -6.2); g.lineTo(13, -7.2); g.stroke();
    // the iron collar, riveted, a link of broken chain off the front
    ell(g, 0, -9.4, 7.6, 2.9); g.fillStyle = vfill(g, B.iron, -12, -6.5, 0.3, -0.4); g.fill(); outline(g, 0.8);
    ell(g, 0, -9.9, 5.2, 1.6); g.fillStyle = '#3e4148'; g.fill();
    g.fillStyle = '#b4b8c0'; for (const x of [-6, -3, 3, 6]) { ell(g, x, -8.4 + Math.abs(x) * -0.12, 0.6, 0.6); g.fill(); }
    if (!back) { g.strokeStyle = OUT; g.lineWidth = 1.6; ell(g, cx, -5.4, 1, 1.4); g.stroke(); g.strokeStyle = '#8f96a3'; g.lineWidth = 0.9; ell(g, cx, -5.4, 1, 1.4); g.stroke(); }
  }
  function und_bruteHead(g, e, back, fx) {
    const hy = -13.8, r = 5.3, W = und_brutePose(e), sw = W.sw, gape = sw >= 0 ? Math.sin(sw * Math.PI) * 1.2 : 0;
    g.save(); g.translate(0, hy + 4); g.rotate(0.14 - W.wind * 0.25 + (e.moving ? Math.sin(e.walkT * 0.5) * 0.05 : 0)); g.translate(0, -hy - 4);
    // little ears
    for (const s of [-1, 1]) { ell(g, s * 5.2, hy + 0.6, 1.3, 1.8); g.fillStyle = shade(UND_BR.skin, -0.1); g.fill(); outline(g, 0.5); }
    ell(g, 0, hy, r, r * 0.98); g.fillStyle = rfill(g, UND_BR.skin, 0, hy, r); g.fill(); outline(g, 0.9);
    // a few hairs and stitches across the scalp
    g.strokeStyle = '#2e2a20'; g.lineWidth = 0.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-1.6, hy - r + 0.2); g.quadraticCurveTo(-2.4, hy - r - 2, -0.6, hy - r - 2.4); g.moveTo(0.8, hy - r + 0.1); g.quadraticCurveTo(1.6, hy - r - 1.6, 2.8, hy - r - 1.4); g.stroke();
    g.strokeStyle = 'rgba(30,26,18,0.75)'; g.lineWidth = 0.5; g.beginPath(); g.arc(0, hy + 2, r + 0.2, Math.PI * 1.2, Math.PI * 1.62); for (let k = 0; k < 4; k++) { const a = Math.PI * (1.24 + k * 0.11); g.moveTo(Math.cos(a) * (r - 0.9), hy + 2 + Math.sin(a) * (r - 0.9)); g.lineTo(Math.cos(a) * (r + 1.2), hy + 2 + Math.sin(a) * (r + 1.2)); } g.stroke();
    if (!back) {
      const ex = fx * 1.2;
      // a heavy brow
      g.fillStyle = shade(UND_BR.skin, -0.3); g.beginPath(); g.moveTo(-4.4 + ex, hy - 2); g.quadraticCurveTo(ex, hy - 0.4, 4.4 + ex, hy - 2); g.lineTo(4.4 + ex, hy - 0.6); g.quadraticCurveTo(ex, hy + 0.6, -4.4 + ex, hy - 0.6); g.closePath(); g.fill();
      const glow = 0.55 + Math.sin(time * 4) * 0.25;
      for (const s of [-1, 1]) { const x = s * 2 + ex; ell(g, x, hy + 0.4, 1.3, 1.1); g.fillStyle = '#141410'; g.fill(); const gl = g.createRadialGradient(x, hy + 0.4, 0, x, hy + 0.4, 2.2); gl.addColorStop(0, `rgba(232,226,107,${glow})`); gl.addColorStop(1, 'rgba(232,226,107,0)'); g.fillStyle = gl; ell(g, x, hy + 0.4, 2.2, 2.2); g.fill(); ell(g, x, hy + 0.4, 0.6, 0.6); g.fillStyle = '#f0ea8a'; g.fill(); }
      // the jaw hangs open (wider on a swing)
      ell(g, ex, hy + 3.3 + gape * 0.4, 2.6, 1.7 + gape); g.fillStyle = '#3a2a20'; g.fill(); outline(g, 0.5);
      g.fillStyle = '#e9e4d2'; for (const t of [-1.4, 0, 1.4]) { g.beginPath(); g.moveTo(ex + t - 0.5, hy + 2); g.lineTo(ex + t, hy + 3.2); g.lineTo(ex + t + 0.5, hy + 2); g.closePath(); g.fill(); }
      for (const t of [-1.6, 1.6]) { g.beginPath(); g.moveTo(ex + t - 0.5, hy + 4.8 + gape * 1.6); g.lineTo(ex + t, hy + 3.7 + gape * 1.6); g.lineTo(ex + t + 0.5, hy + 4.8 + gape * 1.6); g.closePath(); g.fill(); }
    }
    g.restore();
  }
  function und_drawBrute(g, e) {
    und_biped(g, e, {
      s: 1, bobK: 1.4, sway: 0.04, shadowW: 15, shadowH: 4.6,
      pose: und_brutePose, weapon: (g, sw) => und_headstoneMaul(g, sw),
      grip: (g, x, y, back) => und_bruteFist(g, x, y, back),
      legs: (g, step) => und_bruteLegs(g, step),
      torso: und_bruteTorso, head: und_bruteHead,
      // the free hand hangs at its side, a big dead fist
      hands: (g, e, bob, step, stage, f) => {
        const back = f === 'up', want = back ? 'behind' : 'front';
        if (stage !== want) return;
        const W = und_brutePose(e), x = f === 'down' || back ? -14.2 : -2.6 + step * 1.6, y = 4.6 + bob - (f === 'down' ? step : 0) * 1 + (W.wind > 0 ? -3 * W.wind : 0);
        und_bruteFist(g, x, y, back);
      },
      swoosh: (g, W, bob) => {
        if (W.sw < 0 || W.sw > 0.92) return;
        const a0 = W.ang - 2, a1 = W.ang + lerp(-2, 1.3, ease(W.sw));
        g.save(); g.lineCap = 'round';
        g.strokeStyle = `rgba(255,255,255,${0.42 * (1 - W.sw)})`; g.lineWidth = 5.5; g.beginPath(); g.arc(W.sh.x, W.sh.y + bob, 33, a0, a1); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${0.25 * (1 - W.sw)})`; g.lineWidth = 2; g.beginPath(); g.arc(W.sh.x, W.sh.y + bob, 26, a0 + 0.3, a1); g.stroke();
        // the ground takes it: dust and stones kicked up where the headstone lands
        if (W.sw > 0.55) {
          const p = (W.sw - 0.55) / 0.37, a = W.ang + 1.3, gx = W.sh.x + Math.cos(a) * 30, gy = Math.min(11, W.sh.y + Math.sin(a) * 30);
          g.fillStyle = `rgba(150,130,100,${0.55 * (1 - p)})`; for (const [dx, dy, rr0] of [[-5, 0, 3], [4, 0.6, 3.4], [0, -2.4, 2.6], [-8, 1.6, 2], [8, 1.4, 2.2]]) { ell(g, gx + dx * (1 + p), gy + dy, rr0 * (0.8 + p * 0.6), rr0 * 0.6 * (0.8 + p * 0.6)); g.fill(); }
        }
        g.restore();
      },
    });
  }

  // ---------- the cinderwight (level 66, a boss): a burnt dead thing that got back up and burns still ----------
  // No legs: it drifts on a tail of its own ash. A tattered shroud still smouldering at the edges, a charred skull
  // with fire for hair and a jaw that hangs, a ribcage open at the front with its ember heart burning inside, and two
  // floating charcoal claws. The chest is the tell (46-cinderwight): an ember means the heart is home, a dark smoking
  // hole means the heart is out on the ground (e.heart). Cold (e.coldT) turns it steel-blue.
  const UND_WIGHT = {
    hot: { body: '#2f2a2b', char: '#3c3332', cloak: '#262022', bone: '#8a7868', skull: '#54463e', ember: '#ff7a2a', core: '#ffe08a', glow: '255,122,42', hot: '255,230,150', flame: ['#e8501a', '#ff9a2a', '#ffe48a'], ash: '150,130,110' },
    cold: { body: '#4b515c', char: '#56606e', cloak: '#3c434e', bone: '#a9bed2', skull: '#6c7886', ember: '#7ec8ff', core: '#e6f6ff', glow: '126,200,255', hot: '220,240,255', flame: ['#3a78c0', '#7ec8ff', '#e6f6ff'], ash: '150,180,210' },
  };
  function und_flames(g, cx, cy, w, h, lean, C, n, seed) {
    for (let layer = 0; layer < 3; layer++) {
      const k = [1, 0.68, 0.4][layer]; g.fillStyle = C.flame[layer];
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0 : i / (n - 1) - 0.5, x = cx + u * w, half = w / n * 0.95 * k;
        const hh = h * k * (1 - Math.abs(u) * 0.8) * (0.82 + 0.18 * Math.sin(time * 9 + i * 1.7 + seed));
        const tx = x + lean * hh + Math.sin(time * 7 + i * 2.3 + seed) * 1.1 * k;
        g.beginPath(); g.moveTo(x - half, cy); g.quadraticCurveTo(x - half * 0.8, cy - hh * 0.55, tx, cy - hh); g.quadraticCurveTo(x + half * 0.9, cy - hh * 0.5, x + half, cy); g.closePath(); g.fill();
      }
    }
  }
  function und_cracks(g, C, lines, a) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = `rgba(${C.glow},${0.45 * a})`; g.lineWidth = 1.5; g.beginPath(); for (const L of lines) { g.moveTo(...L[0]); for (const p of L.slice(1)) g.lineTo(...p); } g.stroke();
    g.strokeStyle = `rgba(${C.hot},${0.9 * a})`; g.lineWidth = 0.55; g.beginPath(); for (const L of lines) { g.moveTo(...L[0]); for (const p of L.slice(1)) g.lineTo(...p); } g.stroke();
  }
  function und_wightClaw(g, x, y, ang, C, curl) {
    g.save(); g.translate(x, y); g.rotate(ang);
    for (const i of [-1, 0, 1]) {
      const tx = 6.6 + (i === 0 ? 1 : 0), ty = i * (2 + curl * 0.6), cx = 4.4, cy = i * 1.6 - curl;
      g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 2.3; g.beginPath(); g.moveTo(1, i * 1.1); g.quadraticCurveTo(cx, cy, tx, ty); g.stroke();
      g.strokeStyle = C.char; g.lineWidth = 1.4; g.beginPath(); g.moveTo(1, i * 1.1); g.quadraticCurveTo(cx, cy, tx, ty); g.stroke();
      g.fillStyle = C.bone; g.beginPath(); g.moveTo(tx - 1.2, ty - 0.6); g.lineTo(tx + 1.5, ty + 0.4 - curl * 0.3); g.lineTo(tx - 0.8, ty + 0.7); g.closePath(); g.fill();
    }
    ell(g, 0, 0, 2.7, 2.4); g.fillStyle = rfill(g, C.char, 0, 0, 2.7); g.fill(); outline(g, 0.7);
    und_cracks(g, C, [[[-1.4, -1], [0, 0.2], [-0.4, 1.4]], [[0.6, -1.4], [1.4, -0.2]]], 1);
    g.restore();
  }
  function und_fireArc(g, cx, cy, a0, a1, rad, sw, C) {
    if (sw < 0 || sw > 0.9) return;
    g.save(); g.lineCap = 'round';
    g.strokeStyle = `rgba(${C.glow},${0.8 * (1 - sw * 0.7)})`; g.lineWidth = 4.6; g.beginPath(); g.arc(cx, cy, rad, Math.min(a0, a1), Math.max(a0, a1)); g.stroke();
    g.strokeStyle = `rgba(${C.hot},${0.95 * (1 - sw * 0.7)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, rad, Math.min(a0, a1), Math.max(a0, a1)); g.stroke();
    const ae = a1; for (let k = 0; k < 3; k++) { const a = ae - (a1 > a0 ? 1 : -1) * k * 0.35, r = rad + Math.sin(k * 5 + time * 9) * 2; ell(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.8, 0.8); g.fillStyle = `rgba(${C.hot},${0.8 * (1 - sw)})`; g.fill(); }
    g.restore();
  }
  function und_drawWight(g, e) {
    const f = face4(e), back = f === 'up', side = f === 'left' || f === 'right', mirror = f === 'left';
    const C = (e.coldT || 0) > 0 ? UND_WIGHT.cold : UND_WIGHT.hot;
    const feeding = !!(e.heart && !e.heart.dead);
    const sw = swingOf(e), rake = sw >= 0 ? ease(sw) : -1, seed = e.seed || 0;
    const hov = -2.4 + Math.sin(time * 2.2 + seed) * 1.1 + (e.moving ? -Math.abs(Math.sin(e.walkT)) * 0.8 : 0);
    const pulse = 0.75 + Math.sin(time * 5 + seed) * 0.25;
    g.save();
    // the ground under it: ash and a few live coals; it floats, so its shadow stays down here
    g.fillStyle = `rgba(${C.ash},0.35)`; ell(g, 0, 11.4, 12, 3.8); g.fill(); ell(g, -7, 12.4, 4.4, 1.6); g.fill(); ell(g, 7.6, 10.6, 3.6, 1.4); g.fill();
    shadow(g, 0, 11.4, 7.5, 2.6, 0.32);
    for (const [x, y, k] of [[-8.4, 11.8, 0], [6, 12.6, 1], [9.6, 10.8, 2], [-3, 13.4, 3]]) { const a = 0.5 + Math.sin(time * 3 + k * 2) * 0.4; ell(g, x, y, 0.7, 0.45); g.fillStyle = `rgba(${C.glow},${a})`; g.fill(); }
    if (mirror) g.scale(-1, 1);
    g.translate(0, hov);
    g.rotate(e.moving ? (side ? 0.08 : Math.sin(e.walkT * 0.5) * 0.04) : Math.sin(time * 1.3 + seed) * 0.025);
    const fx = side ? 1 : back ? 0 : (e.facing.x * 0.6);
    // where the claws are: idle they hang at its sides, fingers down; on a strike they rise and rake
    let hands;
    if (rake >= 0) {
      if (side) hands = [{ x: lerp(1, 9, rake) - 3, y: lerp(-11, 3, rake) + 1.2, a: lerp(-0.9, 1.3, rake), far: true }, { x: lerp(3, 14, rake), y: lerp(-12, 4, rake), a: lerp(-0.7, 1.4, rake) }];
      else if (back) hands = [-1, 1].map(s => ({ x: s * lerp(11, 7, rake), y: lerp(-12, -6, rake), a: -Math.PI / 2 + s * 0.4, far: true }));
      else hands = [-1, 1].map(s => ({ x: s * lerp(13, 5, rake), y: lerp(-10, 6, rake), a: Math.PI / 2 - s * lerp(1.1, 0.2, rake) }));
    } else {
      const dr = Math.sin(time * 1.8 + seed);
      if (side) hands = [{ x: -1.6, y: 1.8 + dr * 0.8, a: 1.25, far: true }, { x: 4.6 + (e.moving ? Math.sin(e.walkT) * 1.2 : 0), y: 2.4 - dr * 0.8, a: 1.15 }];
      else hands = [-1, 1].map(s => ({ x: s * 11.6, y: 1.4 + s * dr * 0.8, a: Math.PI / 2 + s * 0.3, far: back }));
    }
    const curl = rake >= 0 ? 0.4 : 1;
    for (const h of hands) if (h.far) und_wightClaw(g, h.x, h.y, h.a, C, curl);
    // its tail of ash, streaming back the way it came
    {
      const s = e.moving ? Math.sin(e.walkT) : Math.sin(time * 1.7 + seed), tipx = side ? -7.6 + s * 0.8 : s * 2.2, tipy = side ? 12 : 14;
      const tg = g.createLinearGradient(0, 1, 0, tipy); tg.addColorStop(0, C.body); tg.addColorStop(0.55, `rgba(${C.ash},0.75)`); tg.addColorStop(1, `rgba(${C.ash},0)`);
      g.beginPath(); g.moveTo(-5, 1.6); g.quadraticCurveTo(-5.4 + tipx * 0.2, 8, tipx - 1.2, tipy); g.quadraticCurveTo(tipx + 2.6, tipy - 1.4, tipx * 0.4 + 2.4, tipy - 3.4); g.quadraticCurveTo(4.6, 7, 5, 1.6); g.closePath(); g.fillStyle = tg; g.fill();
      g.fillStyle = `rgba(${C.ash},0.4)`; for (let k = 0; k < 3; k++) { const ph = (time * 0.8 + k / 3 + seed * 0.1) % 1; ell(g, tipx * (0.6 + ph) + Math.sin(k * 4) * 3, tipy - 2 + ph * 3, 1.6 * (1 - ph * 0.5), 1.1 * (1 - ph * 0.5)); g.fill(); }
      for (let k = 0; k < 4; k++) { const ph = (time * 0.9 + k / 4) % 1; ell(g, Math.sin(k * 2.7 + time) * 3.4 + tipx * ph * 0.7, 4 + ph * 8, 0.55, 0.55); g.fillStyle = `rgba(${C.glow},${0.9 * (1 - ph)})`; g.fill(); }
    }
    // the shroud, behind
    const hem = (x0, x1, y, n, up) => { const pts = []; for (let k = 0; k <= n; k++) pts.push([lerp(x0, x1, k / n), y + (k % 2 ? -(up || 2.6) : 0) + Math.sin(time * 3 + k * 1.3 + seed) * 0.4]); return pts; };
    {
      const H = side ? hem(3.4, -12.6, 6.6, 7) : hem(-11, 11, 7.2, 8);
      g.beginPath(); g.moveTo(side ? 1 : -8.6, -8.6);
      if (side) { g.quadraticCurveTo(-8, -6, -12.6, 6.6); } else g.quadraticCurveTo(-12.6, -2, -11, 7.2);
      for (const p of (side ? H.slice().reverse() : H)) g.lineTo(...p);
      if (side) g.quadraticCurveTo(4.4, 0, 4, -6); else g.quadraticCurveTo(12.6, -2, 8.6, -8.6);
      g.closePath(); g.fillStyle = vfill(g, C.cloak, -9, 8, 0.15, -0.3); g.fill(); outline(g, 0.8);
      g.strokeStyle = `rgba(${C.glow},0.85)`; g.lineWidth = 0.7; g.beginPath(); const HH = side ? H.slice().reverse() : H; g.moveTo(...HH[0]); for (const p of HH.slice(1)) g.lineTo(...p); g.stroke();
    }
    // the body: gaunt, cracked charcoal; open at the chest with the heart inside
    const W = side ? 0.72 : 1, ox = side ? 0.8 : 0;
    const torso = () => { g.beginPath(); g.moveTo(ox - 8.6 * W, -8.4); g.quadraticCurveTo(ox - 9.8 * W, -5.6, ox - 7 * W, -3); g.quadraticCurveTo(ox - 4.4 * W, 0.4, ox - 4.2 * W, 4); g.lineTo(ox + 4.2 * W, 4); g.quadraticCurveTo(ox + 4.4 * W, 0.4, ox + 7 * W, -3); g.quadraticCurveTo(ox + 9.8 * W, -5.6, ox + 8.6 * W, -8.4); g.quadraticCurveTo(ox, -11.4, ox - 8.6 * W, -8.4); g.closePath(); };
    torso(); g.fillStyle = vfill(g, C.char, -11, 4, 0.2, -0.35); g.fill(); outline(g, 0.9);
    const hx = side ? ox + 2.2 : fx * 0.8, hy0 = -3.6;
    if (!back) {
      ell(g, hx, hy0, 4.3 * (side ? 0.8 : 1), 5); g.fillStyle = '#120c0a'; g.fill(); outline(g, 0.5);
      if (!feeding) {
        const gl = g.createRadialGradient(hx, hy0, 0.4, hx, hy0, 7.5 * pulse); gl.addColorStop(0, `rgba(${C.hot},0.9)`); gl.addColorStop(0.3, `rgba(${C.glow},0.6)`); gl.addColorStop(1, `rgba(${C.glow},0)`);
        g.fillStyle = gl; ell(g, hx, hy0, 7.5 * pulse, 7.5 * pulse); g.fill();
        const hk = 1.25 + (pulse - 0.75) * 0.3;
        g.beginPath(); g.moveTo(hx, hy0 + 3.4 * hk); g.bezierCurveTo(hx - 3.6 * hk, hy0 + 1 * hk, hx - 3 * hk, hy0 - 3 * hk, hx, hy0 - 1.4 * hk); g.bezierCurveTo(hx + 3 * hk, hy0 - 3 * hk, hx + 3.6 * hk, hy0 + 1 * hk, hx, hy0 + 3.4 * hk); g.closePath();
        const cg = g.createRadialGradient(hx - 0.5, hy0 - 0.4, 0.2, hx, hy0, 3.6 * hk); cg.addColorStop(0, '#fffbe6'); cg.addColorStop(0.4, C.core); cg.addColorStop(1, C.ember); g.fillStyle = cg; g.fill(); outline(g, 0.5);
        und_flames(g, hx, hy0 - 1.8, 3.2, 4.4 * pulse, 0, C, 2, seed + 4);
      } else {
        g.fillStyle = 'rgba(160,150,140,0.55)'; for (let k = 0; k < 4; k++) { const ph = (time * 0.7 + k / 4) % 1; ell(g, hx + Math.sin(time * 2 + k * 1.7) * 1.6 * ph, hy0 - ph * 13, 1.2 + ph * 1.6, 1 + ph * 1.2); g.fill(); }
      }
      // the ribs: three charred bars across the open chest, the heart's light between them
      for (let k = 0; k < 3; k++) {
        const y = -7.6 + k * 3.1, w = (4.9 - Math.abs(k - 1) * 0.5) * (side ? 0.8 : 1);
        for (const [col, lw] of [[OUT, 1.6], [shade(C.bone, -0.2), 0.85]]) { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx - w, y + 1.4); g.quadraticCurveTo(hx, y - 0.4, hx + w, y + 1.4); g.stroke(); }
      }
      g.strokeStyle = OUT; g.lineWidth = 2.2; g.beginPath(); g.moveTo(hx, -9.6); g.lineTo(hx, -7.4); g.stroke(); g.strokeStyle = C.bone; g.lineWidth = 1.3; g.beginPath(); g.moveTo(hx, -9.6); g.lineTo(hx, -7.4); g.stroke();
      if (!feeding) { g.fillStyle = `rgba(${C.glow},${0.12 * pulse})`; ell(g, hx, hy0, 5.6, 6); g.fill(); }
      und_cracks(g, C, [[[ox - 6.4 * W, -6.6], [ox - 5.4 * W, -4.6], [ox - 6 * W, -3.4]], [[ox + 5.6 * W, -7], [ox + 6.4 * W, -5], [ox + 5.2 * W, -3.6]], [[ox - 3.4 * W, 1], [ox - 2.6 * W, 3]]], pulse);
    } else {
      // from behind: the spine, the shoulder blades, and the heart's light through the cracks
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2, -8.6); g.quadraticCurveTo(s * 7.4, -8, s * 5.6, -3.2); g.quadraticCurveTo(s * 3.4, -4.4, s * 2, -8.6); g.fillStyle = shade(C.char, 0.15); g.fill(); outline(g, 0.5); }
      for (let k = 0; k < 6; k++) { ell(g, 0, -9 + k * 2.2, 1.1, 0.8); g.fillStyle = C.bone; g.fill(); outline(g, 0.35); }
      if (!feeding) und_cracks(g, C, [[[-2.2, -4.4], [-1.2, -2.6], [-2, -1]], [[2, -5.4], [1.2, -3.6], [2.2, -2]]], pulse);
    }
    // the front of the shroud, draped over the shoulders, its edges still smouldering
    if (!back) {
      for (const s of side ? [-1] : [-1, 1]) {
        const x0 = ox + s * 8.6 * W, xi = ox + s * (side ? 2.6 : 4.4) * W;
        g.beginPath(); g.moveTo(x0 + s * 0.6, -9); g.quadraticCurveTo(ox + s * 5 * W, -10.6, xi, -8.4); g.quadraticCurveTo(xi + s * 0.6, -2, xi + s * 0.6, 4.6);
        const pts = hem(xi + s * 0.6, x0 + s * 2.6, 5.2, 3, 2.2); for (const p of pts) g.lineTo(...p);
        g.quadraticCurveTo(x0 + s * 2.6, -4, x0 + s * 0.6, -9); g.closePath(); g.fillStyle = vfill(g, C.cloak, -10, 6, 0.22, -0.3); g.fill(); outline(g, 0.7);
        g.strokeStyle = `rgba(${C.glow},0.85)`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.stroke();
        // a hole burnt through it
        g.fillStyle = `rgba(${C.glow},0.7)`; ell(g, x0 + s * 1.4, -1.4, 0.7, 1); g.fill();
      }
    } else {
      const H = hem(-10.6, 10.6, 7.4, 8, 2.8);
      g.beginPath(); g.moveTo(-8.8, -8.8); g.quadraticCurveTo(0, -11.6, 8.8, -8.8); g.quadraticCurveTo(12, -2, H[H.length - 1][0], H[H.length - 1][1]); for (const p of H.slice().reverse()) g.lineTo(...p); g.quadraticCurveTo(-12, -2, -8.8, -8.8); g.closePath();
      g.fillStyle = vfill(g, C.cloak, -10, 8, 0.2, -0.3); g.fill(); outline(g, 0.8);
      g.strokeStyle = `rgba(${C.glow},0.85)`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(...H[0]); for (const p of H.slice(1)) g.lineTo(...p); g.stroke();
      g.fillStyle = '#120c0a'; ell(g, -3.6, -1, 1.4, 1.8); g.fill(); ell(g, 4, 2.6, 1, 1.3); g.fill();
      g.fillStyle = `rgba(${C.glow},0.8)`; ell(g, -3.6, -1, 0.8, 1.1); g.fill(); ell(g, 4, 2.6, 0.5, 0.7); g.fill();
    }
    // bony shoulders
    for (const s of side ? [1] : [-1, 1]) { const x = ox + s * 8.4 * W; ell(g, x, -8.8, 2.4, 1.9); g.fillStyle = rfill(g, C.bone, x, -8.8, 2.4); g.fill(); outline(g, 0.6); g.fillStyle = C.bone; g.beginPath(); g.moveTo(x - 0.9, -9.8); g.lineTo(x + s * 0.8, -12.4); g.lineTo(x + 1, -9.6); g.closePath(); g.fill(); outline(g, 0.4); }
    // the skull, fire for hair, the jaw hanging loose (dropping open on a strike)
    {
      const hy = -15.6, r = 5.4, sx = side ? 2 : fx * 0.8, gap = 1 + (rake >= 0 ? Math.sin(sw * Math.PI) * 2.6 : Math.sin(time * 1.4 + seed) * 0.3);
      const lean = side ? -0.8 - (e.moving ? 0.3 : 0) : Math.sin(time * 1.7) * 0.15;
      und_flames(g, sx - (side ? 1.2 : 0), hy - 2.4, 10.4, 10, lean, C, 5, seed);
      if (!back) {
        // the jaw first, hanging below the skull on nothing
        const jx = sx + (side ? 0.8 : 0), jy = hy + 4.4 + gap;
        g.beginPath(); g.moveTo(jx - 3.4, jy - 0.4); g.quadraticCurveTo(jx - 3.6, jy + 2.6, jx, jy + 2.8); g.quadraticCurveTo(jx + 3.6, jy + 2.6, jx + 3.4, jy - 0.4); g.closePath(); g.fillStyle = vfill(g, C.skull, jy - 1, jy + 3); g.fill(); outline(g, 0.6);
        g.fillStyle = shade(C.bone, 0.2); for (const t of [-2, -0.7, 0.7, 2]) { g.beginPath(); g.moveTo(jx + t - 0.45, jy); g.lineTo(jx + t, jy - 1.1); g.lineTo(jx + t + 0.45, jy); g.closePath(); g.fill(); }
        const mg = g.createRadialGradient(jx, hy + 4, 0, jx, hy + 4, 3 + gap); mg.addColorStop(0, `rgba(${C.glow},${0.75 * pulse})`); mg.addColorStop(1, `rgba(${C.glow},0)`); g.fillStyle = mg; ell(g, jx, hy + 3.6 + gap * 0.5, 3 + gap, 1 + gap * 0.6); g.fill();
      }
      ell(g, sx * 0.5, hy, r, r * 1.04); g.fillStyle = rfill(g, C.skull, sx * 0.5, hy, r); g.fill(); outline(g, 0.9);
      if (!back) {
        // cheekbones and the upper teeth
        rr(g, sx - 3.6, hy + 1, 7.2, 3.6, 1.6); g.fillStyle = vfill(g, C.skull, hy + 1, hy + 4.6); g.fill(); outline(g, 0.6);
        g.fillStyle = shade(C.bone, 0.2); for (const t of [-2.2, -0.75, 0.75, 2.2]) { g.beginPath(); g.moveTo(sx + t - 0.5, hy + 3.8); g.lineTo(sx + t, hy + 5.2); g.lineTo(sx + t + 0.5, hy + 3.8); g.closePath(); g.fill(); }
        for (const s of [-1, 1]) {
          const x = sx + s * 2.3; ell(g, x, hy + 0.2, 1.8, 2); g.fillStyle = '#120c0a'; g.fill();
          const gl = g.createRadialGradient(x, hy + 0.3, 0, x, hy + 0.3, 3); gl.addColorStop(0, `rgba(${C.hot},${0.9 * pulse})`); gl.addColorStop(0.4, `rgba(${C.glow},${0.5 * pulse})`); gl.addColorStop(1, `rgba(${C.glow},0)`); g.fillStyle = gl; ell(g, x, hy + 0.3, 3, 3); g.fill();
          ell(g, x, hy + 0.4, 0.65, 0.75); g.fillStyle = '#fffbe6'; g.fill();
        }
        g.fillStyle = '#120c0a'; g.beginPath(); g.moveTo(sx, hy + 1.8); g.lineTo(sx - 0.8, hy + 3.2); g.lineTo(sx + 0.8, hy + 3.2); g.closePath(); g.fill();
        und_cracks(g, C, [[[sx - 1.2, hy - r + 0.6], [sx - 0.4, hy - 3], [sx - 1.4, hy - 1.8]], [[sx + 3.6, hy - 3.4], [sx + 2.6, hy - 2]]], pulse);
      } else und_cracks(g, C, [[[0, hy - r + 0.8], [0.8, hy - 2], [-0.4, hy + 0.4], [0.6, hy + 2.6]]], pulse);
    }
    // the near claws, then the strike
    for (const h of hands) if (!h.far) und_wightClaw(g, h.x, h.y, h.a, C, curl);
    if (rake >= 0 && !back) {
      if (side) und_fireArc(g, 3, -2, -1.4, lerp(-1.4, 1.3, rake), 13, sw, C);
      else for (const s of [-1, 1]) { const a0 = s > 0 ? -0.5 : Math.PI + 0.5, a1 = s > 0 ? lerp(-0.5, 1.6, rake) : lerp(Math.PI + 0.5, Math.PI - 1.6, rake); und_fireArc(g, s * 3, -1, a0, a1, 10, sw, C); }
    }
    // embers coming off it
    for (let k = 0; k < 6; k++) { const ph = (time * 0.7 + k / 6 + seed * 0.1) % 1, x = Math.sin(k * 7.3 + time * 1.3) * 8 - (side ? ph * 4 : 0), y = -9 - ph * 18; ell(g, x, y, 0.75, 0.75); g.fillStyle = `rgba(${C.glow},${(1 - ph) * 0.9})`; g.fill(); }
    g.restore();
  }

  // ---------- the cinder heart: the wight's own ember, set down on the ground, beating ----------
  function und_drawHeart(g, e) {
    const C = UND_WIGHT.hot, life = e.emberT ? Math.max(0.15, 1 - e.emberT / 10) : 1, seed = e.seed || 0;
    const ph = (time * 1.1 + seed * 0.37) % 1;
    // lub-dub
    const beat = Math.exp(-Math.pow((ph - 0.12) / 0.06, 2)) + 0.6 * Math.exp(-Math.pow((ph - 0.34) / 0.07, 2));
    const k = 1 + beat * 0.08, A = (0.55 + beat * 0.45) * life;
    // the heat it throws on the ground, a soft heap of ash and a few coals
    const hg = g.createRadialGradient(0, 3, 1, 0, 3, 19); hg.addColorStop(0, `rgba(255,190,80,${0.8 * A})`); hg.addColorStop(0.5, `rgba(255,150,50,${0.38 * A})`); hg.addColorStop(1, `rgba(${C.glow},0)`); g.fillStyle = hg; ell(g, 0, 3, 19, 15); g.fill();
    g.beginPath(); g.moveTo(-10, 10.2); g.quadraticCurveTo(-8.6, 6.4, -3, 6.8); g.quadraticCurveTo(0, 5.6, 3.4, 6.8); g.quadraticCurveTo(8.8, 6.4, 10, 10.2); g.quadraticCurveTo(0, 12.4, -10, 10.2); g.closePath();
    g.fillStyle = vfill(g, '#8c827b', 6, 12, 0.3, -0.25); g.fill(); outline(g, 0.45);
    for (const [x, y, r] of [[-6.6, 9.2, 1.5], [5.6, 9.8, 1.4], [8, 8.8, 1.1], [-3, 10.6, 1.1]]) { ell(g, x, y, r, r * 0.72); g.fillStyle = '#2a201c'; g.fill(); outline(g, 0.35); ell(g, x + 0.2, y - 0.15, r * 0.55, r * 0.36); g.fillStyle = `rgba(255,160,60,${A})`; g.fill(); }
    // the heart itself: a lump of charcoal in the shape of a heart, molten inside, split with fire
    g.save(); g.translate(0, 1.6); g.scale(k, k);
    const heart = () => { g.beginPath(); g.moveTo(0, 6.6); g.bezierCurveTo(-4.4, 3.8, -7.8, 0.6, -7.4, -2.7); g.bezierCurveTo(-7, -6.4, -1.8, -7, 0, -3.5); g.bezierCurveTo(1.8, -7, 7, -6.4, 7.4, -2.7); g.bezierCurveTo(7.8, 0.6, 4.4, 3.8, 0, 6.6); g.closePath(); };
    heart(); g.fillStyle = rfill(g, '#33282a', -1, -1, 7.8); g.fill();
    g.save(); heart(); g.clip();
    const ig = g.createRadialGradient(0, 0.6, 0.5, 0, 0.6, 7.4); ig.addColorStop(0, `rgba(255,190,90,${0.8 * A})`); ig.addColorStop(0.55, `rgba(${C.glow},${0.45 * A})`); ig.addColorStop(1, `rgba(${C.glow},0)`); g.fillStyle = ig; g.fillRect(-8, -7, 16, 14);
    for (const [x, y, r] of [[-3.4, -1.8, 1.9], [3, 0.4, 1.6], [0.2, 3.2, 1.2], [4, -3.6, 1]]) { const mg = g.createRadialGradient(x, y, 0, x, y, r); mg.addColorStop(0, `rgba(255,236,160,${A})`); mg.addColorStop(0.6, `rgba(255,140,40,${0.9 * A})`); mg.addColorStop(1, `rgba(200,70,20,${0.5 * A})`); g.fillStyle = mg; ell(g, x, y, r, r * 0.85); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.14)'; ell(g, -4.2, -4, 2, 1.2, -0.5); g.fill();
    g.restore();
    heart(); outline(g, 1);
    und_cracks(g, C, [[[-5, -3.8], [-3.4, -1.8], [-4, 0.6], [-1.6, 2.6], [-0.6, 5]], [[4.6, -4.4], [3, -1.8], [4, 0.4], [1.6, 2.4]], [[-0.2, -2.8], [0.8, -0.6], [-0.4, 1.2]], [[5.8, -1.4], [6.6, 0.2]]], Math.min(1, A * 1.3));
    // the split at the top glows white-hot
    ell(g, 0, -2.6, 1.2, 0.9); g.fillStyle = `rgba(255,251,230,${A})`; g.fill();
    und_flames(g, 0, -3.2, 3.6, (3.4 + beat * 2.4) * life, Math.sin(time * 2) * 0.15, C, 2, seed);
    g.restore();
    // sparks going up
    for (let i = 0; i < 4; i++) { const p = (time * 0.9 + i / 4 + seed * 0.2) % 1, x = Math.sin(i * 5.1 + time * 2) * 4, y = -4 - p * 15; ell(g, x, y, 0.65, 0.65); g.fillStyle = `rgba(${C.glow},${(1 - p) * A})`; g.fill(); }
    if (e.hurtT > 0) { g.globalAlpha = 0.5; sparkle(g, 0, 1, 7, '#fffbe6'); g.globalAlpha = 1; }
  }

  Object.assign(NEW_DRAW, {
    zombie_calm: und_drawZombieCalm,
    grave_risen: und_drawRisen,
    grave_zombie: (g, e) => und_drawGraveZombie(g, e, false),
    grave_zombie_calm: (g, e) => und_drawGraveZombie(g, e, true),
    zombie_brute: und_drawBrute,
    cinderwight: und_drawWight,
    cinder_heart: und_drawHeart,
  });
  // a zombie is 1; the grave zombie is the tougher, bigger dead (its old sprite was 1.15); the brute is two tiles of
  // dead weight; the cinderwight is a boss and stands twice a zombie's height; the heart is a small thing on the ground
  Object.assign(MOB_SIZE, { grave_zombie: 1.18, grave_zombie_calm: 1.18, zombie_brute: 2.3, cinderwight: 2.1, cinder_heart: 1.2 });

  // ---------- machines ----------
  // ================= THE MACHINES AND GOLEMS: drawn in the approved knight's style =================
  // Goblin machines (the walker, the bulldozer, the Barrelbeast, the Gnasher) and the golems of the royal mine.
  // Seen like the four-legged beasts: from the side facing left/right, from the front facing down, from behind facing up.
  // Every name here starts mch_ so nothing clashes with the other families. Uses the helpers in mobs-new.js.

  // ---------- shared parts ----------
  const mch_C = { IRON: '#3a3a42', IRON2: '#4e4e58', DARK: '#2e2e36', STEEL: '#8f96a3', RIV: '#c9ccd3', WOOD: '#7a4a2a', BRASS: '#c9a02a', GOLD: '#d4a017' };
  const mch_q = (a, c, b, t) => (1 - t) * (1 - t) * a + 2 * t * (1 - t) * c + t * t * b;
  const mch_TAU = Math.PI * 2;
  // a cylinder lit from the left: for drums, boilers, pipes standing up
  function mch_hfill(g, c, x0, x1) { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, shade(c, -0.15)); gr.addColorStop(0.3, shade(c, 0.34)); gr.addColorStop(0.62, c); gr.addColorStop(1, shade(c, -0.45)); return gr; }
  function mch_rivets(g, pts, r) {
    for (const [x, y] of pts) { ell(g, x + r * 0.3, y + r * 0.35, r, r); g.fillStyle = 'rgba(20,14,10,0.5)'; g.fill(); ell(g, x, y, r, r); g.fillStyle = mch_C.RIV; g.fill(); ell(g, x - r * 0.3, y - r * 0.3, r * 0.42, r * 0.42); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill(); }
  }
  function mch_bolt(g, x, y, r, c) { ell(g, x, y, r, r); g.fillStyle = rfill(g, c, x, y, r); g.fill(); outline(g, Math.min(0.5, r * 0.35)); ell(g, x - r * 0.32, y - r * 0.36, r * 0.3, r * 0.3); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fill(); }
  // a thick limb along a polyline: dark edge, colour, a lit stripe
  function mch_beam(g, pts, w, c, lw) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const path = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
    path(); g.strokeStyle = OUT; g.lineWidth = w + (lw === undefined ? 0.9 : lw); g.stroke();
    path(); g.strokeStyle = c; g.lineWidth = w; g.stroke();
    g.save(); g.translate(-w * 0.12, -w * 0.2); path(); g.strokeStyle = shade(c, 0.3); g.lineWidth = w * 0.3; g.stroke(); g.restore();
  }
  // a steam piston: a dark cylinder, then a bright rod
  function mch_piston(g, x0, y0, x1, y1, w, split) {
    const t = split === undefined ? 0.55 : split, sx = lerp(x0, x1, t), sy = lerp(y0, y1, t);
    mch_beam(g, [[sx, sy], [x1, y1]], w * 0.42, '#d5d9e0', 0.5);
    mch_beam(g, [[x0, y0], [sx, sy]], w, mch_C.DARK, 0.6);
    ell(g, sx, sy, w * 0.62, w * 0.62); g.fillStyle = '#5a5d64'; g.fill(); outline(g, 0.3);
  }
  // puffs from a chimney: dark coal smoke that greys as it climbs (dark) or white steam
  function mch_smoke(g, x, y, s, n, rate, dark, seed, rise) {
    for (let i = 0; i < n; i++) {
      const ph = (time * rate + i / n + (seed || 0) * 0.37) % 1, drift = Math.sin(time * 1.6 + i * 2.4) * s * (0.25 + ph);
      const px = x + drift + ph * s * 1.1, py = y - ph * s * (rise || 6.5), r = s * (0.6 + ph * 1.3), a = 0.92 * (1 - ph * 0.85) * Math.min(1, ph * 5 + 0.4);
      const c = dark ? lerp(78, 175, ph) | 0 : 236;
      ell(g, px + r * 0.12, py + r * 0.15, r, r); g.fillStyle = `rgba(${c - 30},${c - 34},${c - 28},${a * 0.6})`; g.fill();
      ell(g, px, py, r, r); g.fillStyle = `rgba(${c},${c - 4},${c},${a})`; g.fill();
      ell(g, px - r * 0.3, py - r * 0.32, r * 0.5, r * 0.44); g.fillStyle = `rgba(255,255,255,${a * 0.35})`; g.fill();
    }
  }
  function mch_dust(g, x, y, s, a) { if (a <= 0.02) return; for (const [dx, dy, r] of [[-1.3, -0.3, 1], [0, -0.75, 1.25], [1.3, -0.2, 0.9]]) { ell(g, x + dx * s, y + dy * s, r * s, r * s * 0.78); g.fillStyle = `rgba(196,172,128,${a})`; g.fill(); } }
  // a hit: a ring of short white strokes and a star
  function mch_impact(g, x, y, s, a) {
    if (a <= 0.02) return; g.save(); g.strokeStyle = `rgba(255,250,228,${a})`; g.lineWidth = s * 0.14; g.lineCap = 'round';
    for (let k = 0; k < 8; k++) { const t = k / 8 * mch_TAU + 0.2, o = k % 2 ? 0.95 : 1.3; g.beginPath(); g.moveTo(x + Math.cos(t) * s * 0.55, y + Math.sin(t) * s * 0.55); g.lineTo(x + Math.cos(t) * s * o, y + Math.sin(t) * s * o); g.stroke(); }
    sparkle(g, x, y, s * 0.6, `rgba(255,255,255,${a})`); g.restore();
  }
  function mch_speed(g, x, y, len, rows, a, w) { if (a <= 0.02) return; g.save(); g.strokeStyle = `rgba(255,255,255,${a})`; g.lineCap = 'round'; g.lineWidth = w || 0.5; for (const [dy, k] of rows) { g.beginPath(); g.moveTo(x, y + dy); g.lineTo(x - len * k, y + dy); g.stroke(); } g.restore(); }
  function mch_hand(g, x, y, r, c) { ell(g, x, y, r, r); g.fillStyle = rfill(g, c || GOB, x, y, r); g.fill(); outline(g, r * 0.3); }
  // yellow-and-black warning stripes inside a path
  function mch_hazard(g, path, x0, y0, x1, y1, w) {
    g.save(); path(); g.clip(); g.fillStyle = '#f2c230'; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.fillStyle = '#2a2622'; const h = y1 - y0;
    for (let x = x0 - h; x < x1; x += w * 2) { g.beginPath(); g.moveTo(x, y1); g.lineTo(x + w, y1); g.lineTo(x + w + h, y0); g.lineTo(x + h, y0); g.closePath(); g.fill(); }
    g.restore();
  }
  // a little two-colour chequered flag on a pole (the training yard's)
  function mch_flag(g, x, y, h, c1, c2) {
    mch_beam(g, [[x, y], [x, y - h]], 0.45, '#6b4a2a', 0.4);
    const wv = k => Math.sin(time * 6 + k * 1.3) * 0.5;
    g.save(); g.translate(x, y - h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.moveTo(i * 1.2, j * 1.2 + wv(i)); g.lineTo(i * 1.2 + 1.2, j * 1.2 + wv(i + 1)); g.lineTo(i * 1.2 + 1.2, j * 1.2 + 1.2 + wv(i + 1)); g.lineTo(i * 1.2, j * 1.2 + 1.2 + wv(i)); g.closePath(); g.fillStyle = (i + j) % 2 ? c2 : c1; g.fill(); }
    g.beginPath(); g.moveTo(0, wv(0)); for (let i = 1; i <= 4; i++) g.lineTo(i * 1.2, wv(i)); for (let i = 4; i >= 0; i--) g.lineTo(i * 1.2, 2.4 + wv(i)); g.closePath(); outline(g, 0.3);
    g.restore(); ell(g, x, y - h - 0.2, 0.45, 0.45); g.fillStyle = '#d4a017'; g.fill();
  }
  // the goblin at the controls: the top of his tunic and the approved goblin head (ears, eyes, teeth, his hat), drawn small
  function mch_pilot(g, e, x, y, s, hat, back, fx, tunic) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.beginPath(); g.moveTo(-7, 7); g.quadraticCurveTo(-8.2, -3.6, 0, -4.6); g.quadraticCurveTo(8.2, -3.6, 7, 7); g.closePath();
    g.fillStyle = vfill(g, tunic || '#7a5a3a', -4.6, 7); g.fill(); outline(g, 0.9);
    if (!back) { g.strokeStyle = '#c9a66b'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-5.4, -2.6); g.lineTo(5, 5.4); g.stroke(); }
    goblinHead(g, e, { skin: GOB, hat }, back, fx);
    g.restore();
  }
  // the bulldozer driver's leather cap with one goggle; the training yard's padded cap with a yellow band
  function mch_oneGoggle(g, hy, r, back) {
    capHat(g, hy, r, back);
    g.fillStyle = '#5a3a1e'; g.beginPath(); g.moveTo(-r - 0.2, hy - 3.4); g.lineTo(r + 0.2, hy - 4.6); g.lineTo(r + 0.2, hy - 3.2); g.lineTo(-r - 0.2, hy - 2); g.closePath(); g.fill();
    if (!back) { const x = 3, y = hy - 4.4; ell(g, x, y, 2.7, 2.7); g.fillStyle = '#b98a3a'; g.fill(); outline(g, 0.5); const gl = g.createRadialGradient(x - 0.7, y - 0.7, 0.2, x, y, 2); gl.addColorStop(0, '#e8f6ff'); gl.addColorStop(1, '#4f88b0'); g.fillStyle = gl; ell(g, x, y, 1.8, 1.8); g.fill(); ell(g, x - 0.6, y - 0.6, 0.5, 0.5); g.fillStyle = '#fff'; g.fill(); }
  }
  function mch_yardHat(g, hy, r, back) {
    g.beginPath(); g.arc(0, hy - 1.2, r + 0.6, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(0, hy - 2.6, -r - 0.6, hy - 1.6); g.closePath(); g.fillStyle = vfill(g, '#8a6a3a', hy - 9, hy - 2); g.fill(); outline(g, 0.6);
    g.save(); g.beginPath(); g.arc(0, hy - 1.2, r + 0.6, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.clip();
    g.fillStyle = '#f2c230'; g.fillRect(-r - 1, hy - 5.6, (r + 1) * 2, 2); g.fillStyle = '#2a2622'; for (let x = -r - 1; x < r + 1; x += 2.4) { g.beginPath(); g.moveTo(x, hy - 3.6); g.lineTo(x + 1.2, hy - 3.6); g.lineTo(x + 2, hy - 5.6); g.lineTo(x + 0.8, hy - 5.6); g.closePath(); g.fill(); }
    g.restore();
    ell(g, 0, hy - r - 1.4, 1.3, 1.1); g.fillStyle = '#f2c230'; g.fill(); outline(g, 0.4);
  }

  // ---------- the goblin walker: a barrel on four stomping iron legs, a boiler, a ram, a goblin in the tub on top ----------
  function mch_walkerPal(yard) {
    return yard ? { wood: '#94704a', band: '#55555f', leg: '#5c5c66', boiler: '#606068', yard: true, hat: mch_yardHat, tunic: '#5a6a3a' }
      : { wood: '#7a4a2a', band: '#3a3a42', leg: '#4a4a54', boiler: '#5a5a62', yard: false, hat: gogglesHat, tunic: '#7a5a3a' };
  }
  // one iron leg: hip, a knee raised high with a brass bolt and a piston, a heavy round stomping foot
  function mch_wLeg(g, H, K, F, dark, P, w) {
    const c = dark ? shade(P.leg, -0.38) : P.leg, k = w || 1;
    mch_beam(g, [H, K], 2.8 * k, c);
    mch_beam(g, [K, [F[0], F[1] - 1.2 * k]], 2.5 * k, c);
    if (!dark) mch_piston(g, lerp(H[0], K[0], 0.35), lerp(H[1], K[1], 0.35) + 1.1 * k, lerp(K[0], F[0], 0.6), lerp(K[1], F[1], 0.6) - 0.2, 1.1 * k, 0.5);
    mch_bolt(g, H[0], H[1], 1.15 * k, dark ? '#3a3a42' : '#6b6f7a');
    mch_bolt(g, K[0], K[1], 1.3 * k, dark ? '#7a6020' : mch_C.BRASS);
    rr(g, F[0] - 3.2 * k, F[1] - 2.2 * k, 6.4 * k, 2.8 * k, 1.2 * k); g.fillStyle = vfill(g, dark ? '#2a2a30' : '#55555f', F[1] - 2 * k, F[1] + 0.6 * k); g.fill(); outline(g, 0.5);
    g.fillStyle = dark ? '#1e1e24' : '#2e2e36'; for (const t of [-1.8, 0, 1.8]) { g.beginPath(); g.moveTo(F[0] + t * k - 0.7 * k, F[1] + 0.5 * k); g.lineTo(F[0] + t * k, F[1] + 1.1 * k); g.lineTo(F[0] + t * k + 0.7 * k, F[1] + 0.5 * k); g.closePath(); g.fill(); }
    if (!dark) mch_rivets(g, [[F[0] - 1.6 * k, F[1] - 1.1 * k], [F[0] + 1.6 * k, F[1] - 1.1 * k]], 0.32 * k);
  }
  // where a leg's foot is in its step: lifted and swung forward, then planted and pushed back; dust when it lands
  function mch_step(e, ph, amp, lift) {
    if (!e.moving) return { lift: 0, slide: 0, dust: 0 };
    const th = (e.walkT || 0) + ph, u = ((th % mch_TAU) + mch_TAU) % mch_TAU;
    return { lift: Math.max(0, Math.sin(th)) * lift, slide: -Math.cos(th) * amp, dust: u > Math.PI && u < Math.PI + 1.3 ? 1 - (u - Math.PI) / 1.3 : 0 };
  }
  // a barrel lying along x, seen from the side: staves, iron hoops with rivets, a lit top
  function mch_barrelSide(g, x0, x1, yt, yb, bulge, wood, band, hoops, rv) {
    const xm = (x0 + x1) / 2, ym = (yt + yb) / 2;
    const path = () => { g.beginPath(); g.moveTo(x0, yt); g.quadraticCurveTo(xm, yt - bulge * 2, x1, yt); g.quadraticCurveTo(x1 + bulge * 0.7, ym, x1, yb); g.quadraticCurveTo(xm, yb + bulge * 2, x0, yb); g.quadraticCurveTo(x0 - bulge * 0.7, ym, x0, yt); g.closePath(); };
    path(); g.fillStyle = vfill(g, wood, yt - bulge, yb + bulge, 0.28, -0.42); g.fill();
    g.save(); path(); g.clip();
    g.strokeStyle = 'rgba(40,20,8,0.42)'; g.lineWidth = 0.32;
    for (const t of [0.14, 0.29, 0.43, 0.57, 0.71, 0.86]) { g.beginPath(); g.moveTo(x0, lerp(yt, yb, t)); g.quadraticCurveTo(xm, lerp(yt - bulge * 2, yb + bulge * 2, t), x1, lerp(yt, yb, t)); g.stroke(); }
    g.strokeStyle = 'rgba(255,225,180,0.16)'; g.lineWidth = 0.5; for (const t of [0.2, 0.36]) { g.beginPath(); g.moveTo(x0 + 2, lerp(yt, yb, t) + 0.3); g.quadraticCurveTo(xm, lerp(yt - bulge * 2, yb + bulge * 2, t) + 0.3, x1 - 2, lerp(yt, yb, t) + 0.3); g.stroke(); }
    for (const hx of hoops) {
      const u = (hx - x0) / (x1 - x0), ht = mch_q(yt, yt - bulge * 2, yt, u) - 1, hb = mch_q(yb, yb + bulge * 2, yb, u) + 1, hw = 0.85 * (rv || 1) / 0.36;
      g.fillStyle = vfill(g, band, ht, hb, 0.3, -0.35); g.fillRect(hx - hw, ht, hw * 2, hb - ht);
      g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(hx - hw, ht, hw * 0.45, hb - ht);
      g.strokeStyle = OUT; g.lineWidth = 0.35; g.strokeRect(hx - hw, ht, hw * 2, hb - ht);
      mch_rivets(g, [[hx, ht + 2.2], [hx, (ht + hb) / 2], [hx, hb - 2.2]], rv || 0.36);
    }
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x0 - 2, lerp(yt, yb, 0.72), x1 - x0 + 4, yb - yt + bulge * 2);
    g.restore();
    path(); outline(g, 0.6);
    return path;
  }
  // a barrel standing on its end and seen end-on: round lid, planks, an iron rim with rivets
  function mch_barrelEnd(g, cx, cy, rx, ry, wood, band, n) {
    ell(g, cx, cy, rx, ry); g.fillStyle = rfill(g, wood, cx, cy, Math.max(rx, ry)); g.fill();
    g.save(); ell(g, cx, cy, rx, ry); g.clip();
    g.strokeStyle = 'rgba(40,20,8,0.45)'; g.lineWidth = 0.32; for (let k = -2; k <= 2; k++) { const x = cx + k * rx * 0.36; g.beginPath(); g.moveTo(x, cy - ry); g.lineTo(x, cy + ry); g.stroke(); }
    g.strokeStyle = 'rgba(255,225,180,0.14)'; g.lineWidth = 0.6; for (let k = -2; k <= 1; k++) { const x = cx + k * rx * 0.36 + rx * 0.08; g.beginPath(); g.moveTo(x, cy - ry); g.lineTo(x, cy + ry); g.stroke(); }
    g.restore();
    ell(g, cx, cy, rx - 0.8, ry - 0.8); g.strokeStyle = OUT; g.lineWidth = 2.3; g.stroke(); g.strokeStyle = band; g.lineWidth = 1.6; g.stroke();
    g.strokeStyle = shade(band, 0.35); g.lineWidth = 0.4; g.beginPath(); g.ellipse(cx, cy, rx - 1.2, ry - 1.2, 0, Math.PI * 1.05, Math.PI * 1.65); g.stroke();
    const pts = []; for (let k = 0; k < (n || 10); k++) { const a = k / (n || 10) * mch_TAU + 0.3; pts.push([cx + Math.cos(a) * (rx - 0.8), cy + Math.sin(a) * (ry - 0.8)]); }
    mch_rivets(g, pts, 0.36);
    ell(g, cx, cy, rx, ry); outline(g, 0.6);
  }
  // the ram: a cylinder, a bright rod that shoots out on an attack, and a studded iron head (the yard's is a stuffed leather pad)
  function mch_ramSide(g, x, y, ext, pad, k) {
    const s = k || 1;
    rr(g, x, y - 1.9 * s, 3.2 * s, 3.8 * s, 0.8 * s); g.fillStyle = vfill(g, mch_C.DARK, y - 2, y + 2); g.fill(); outline(g, 0.5);
    if (ext > 0.1) { rr(g, x + 3 * s, y - 0.8 * s, ext + 0.6, 1.6 * s, 0.6 * s); g.fillStyle = vfill(g, '#d5d9e0', y - 0.8, y + 0.8, 0.4, -0.2); g.fill(); outline(g, 0.35); }
    const hx = x + 3 * s + ext;
    if (pad) {
      ell(g, hx + 2.6 * s, y, 2.8 * s, 4.4 * s); g.fillStyle = rfill(g, '#a0522d', hx + 2.6 * s, y, 4.4 * s); g.fill(); outline(g, 0.6);
      g.strokeStyle = 'rgba(255,230,190,0.75)'; g.lineWidth = 0.28; g.setLineDash([0.6, 0.5]); g.beginPath(); g.ellipse(hx + 2.6 * s, y, 1.9 * s, 3.4 * s, 0, 0, mch_TAU); g.stroke(); g.setLineDash([]);
      g.strokeStyle = '#d9b860'; g.lineWidth = 0.4; for (const t of [-0.6, 0, 0.6]) { g.beginPath(); g.moveTo(hx + 0.4, y + t * s); g.lineTo(hx - 1 * s, y + t * 1.8 * s); g.stroke(); }
      rr(g, hx - 0.4 * s, y - 2.6 * s, 1.2 * s, 5.2 * s, 0.4); g.fillStyle = '#5a3a1e'; g.fill(); outline(g, 0.3);
      return hx + 5.4 * s;
    }
    rr(g, hx, y - 4.4 * s, 3.6 * s, 8.8 * s, 1 * s); g.fillStyle = vfill(g, '#8f96a3', y - 4.4 * s, y + 4.4 * s); g.fill(); outline(g, 0.6);
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(hx + 0.5 * s, y - 3.8 * s, 0.7 * s, 7.6 * s);
    for (const t of [-2.8, 0, 2.8]) { ell(g, hx + 3.7 * s, y + t * s, 1.1 * s, 1.15 * s); g.fillStyle = rfill(g, '#a9adb5', hx + 3.7 * s, y + t * s, 1.2 * s); g.fill(); outline(g, 0.35); }
    mch_rivets(g, [[hx + 1.3 * s, y - 3.4 * s], [hx + 1.3 * s, y + 3.4 * s]], 0.32 * s);
    return hx + 4.8 * s;
  }
  function mch_walkerSide(g, e, P, sw, bob) {
    const hit = sw >= 0 ? Math.sin(sw * Math.PI) : 0, ext = hit * 7.5, rock = e.moving ? Math.sin(e.walkT) * 0.03 : 0;
    const legs = [[-4.2, 0.6, -7.6, -1, Math.PI, 9.6], [7.6, 0.6, 11, 1, 0, 9.6], [-6.2, 2.8, -9.8, -1, 0, 11.2], [6.4, 2.8, 10, 1, Math.PI, 11.2]];
    const leg = ([hx, hy, fx, dir, ph, gy], dark) => {
      const st = mch_step(e, ph, 2.1, 2.8), H = [hx, hy + bob], F = [fx + st.slide, gy - st.lift];
      const K = [lerp(H[0], F[0], 0.5) + dir * 3.3, Math.min(H[1], F[1]) - 3.6];
      mch_wLeg(g, H, K, F, dark, P); if (!dark) mch_dust(g, F[0] - dir * 1.2, gy + 0.4, 1.3, st.dust * 0.55);
    };
    leg(legs[0], true); leg(legs[1], true);
    g.save(); g.translate(0, bob); g.rotate(rock);
    // boiler on the back with a pressure dial, a chimney, the firebox glowing under it
    rr(g, -10.6, -16.6, 6.4, 8.6, 1.8); g.fillStyle = mch_hfill(g, P.boiler, -10.6, -4.2); g.fill(); outline(g, 0.55);
    g.fillStyle = mch_C.BRASS; g.fillRect(-10.6, -13.6, 6.4, 1.1); g.strokeStyle = OUT; g.lineWidth = 0.3; g.strokeRect(-10.6, -13.6, 6.4, 1.1);
    mch_rivets(g, [[-9.6, -15.6], [-5.2, -15.6], [-9.6, -10.2], [-5.2, -10.2]], 0.3);
    ell(g, -7.4, -11, 1.25, 1.25); g.fillStyle = '#efe8d0'; g.fill(); outline(g, 0.3); g.strokeStyle = '#c0392b'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(-7.4, -11); g.lineTo(-7.4 + Math.cos(time * 2.5) * 0.9, -11 + Math.sin(time * 2.5) * 0.9); g.stroke();
    rr(g, -8.5, -22.6, 2.3, 6.4, 0.5); g.fillStyle = mch_hfill(g, '#3a3a42', -8.5, -6.2); g.fill(); outline(g, 0.45);
    g.beginPath(); g.moveTo(-9.5, -23.6); g.lineTo(-5.2, -23.6); g.lineTo(-6, -22.2); g.lineTo(-8.7, -22.2); g.closePath(); g.fillStyle = '#2a2a30'; g.fill(); outline(g, 0.4);
    // the barrel
    mch_barrelSide(g, -11.5, 11.5, -8.2, 3, 1.4, P.wood, P.band, [-7.6, -0.6, 6.6], 0.34);
    if (P.yard) {
      const band = () => { g.beginPath(); g.rect(2, -11, 2.6, 16); };
      g.save(); g.beginPath(); g.moveTo(-11.5, -8.2); g.quadraticCurveTo(0, -11, 11.5, -8.2); g.lineTo(11.5, 3); g.quadraticCurveTo(0, 5.8, -11.5, 3); g.closePath(); g.clip();
      mch_hazard(g, band, 2, -11, 4.6, 6, 0.9); g.restore();
      rr(g, -5.2, -2.6, 3.6, 3, 0.5); g.fillStyle = vfill(g, '#7d8a6a', -2.6, 0.4); g.fill(); outline(g, 0.4); mch_rivets(g, [[-4.6, -2], [-2.2, -2], [-4.6, -0.2], [-2.2, -0.2]], 0.24);
    } else {
      g.strokeStyle = 'rgba(160,30,24,0.8)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(1, -3.6); g.lineTo(2.4, -1.6); g.lineTo(3.6, -3.6); g.lineTo(4.8, -1.6); g.lineTo(6, -3.6); g.stroke();
    }
    // nose plate where the ram comes out
    rr(g, 10.2, -6.8, 2.6, 8.4, 0.9); g.fillStyle = vfill(g, '#55555f', -7, 2); g.fill(); outline(g, 0.5); mch_rivets(g, [[11.5, -5.6], [11.5, 0.4]], 0.3);
    // the goblin in the tub, his hand on the lever
    mch_pilot(g, e, 2.6, -12.5, 0.42, P.hat, false, 1, P.tunic);
    rr(g, -1.6, -13.4, 8.8, 4.8, 1); g.fillStyle = vfill(g, shade(P.wood, 0.08), -13.4, -8.6); g.fill(); outline(g, 0.5);
    g.strokeStyle = 'rgba(40,20,8,0.4)'; g.lineWidth = 0.3; for (const x of [0.6, 2.8, 5]) { g.beginPath(); g.moveTo(x, -12.6); g.lineTo(x, -8.8); g.stroke(); }
    rr(g, -2, -14.2, 9.6, 1.5, 0.6); g.fillStyle = vfill(g, P.band, -14.2, -12.7); g.fill(); outline(g, 0.4); mch_rivets(g, [[-0.6, -13.45], [2.8, -13.45], [6.2, -13.45]], 0.26);
    const lv = e.moving ? Math.sin(e.walkT * 2) * 0.25 : 0, la = -0.5 + lv - hit * 0.5;
    mch_beam(g, [[6.6, -13.6], [6.6 + Math.sin(la + 0.9) * 3.6, -13.6 - Math.cos(la + 0.9) * 3.6]], 0.55, '#3a3a42', 0.45);
    const kx = 6.6 + Math.sin(la + 0.9) * 3.6, ky = -13.6 - Math.cos(la + 0.9) * 3.6;
    mch_bolt(g, kx, ky, 0.75, '#c0392b'); mch_hand(g, kx - 0.5, ky + 0.5, 0.85);
    if (P.yard) mch_flag(g, -1.2, -13.6, 6.5, '#f2c230', '#2f7a3a');
    g.restore();
    // near legs over the barrel's belly
    leg(legs[2], false); leg(legs[3], false);
    // the ram, punched out on an attack
    g.save(); g.translate(0, bob); g.rotate(rock);
    const tip = mch_ramSide(g, 12.6, -2.4, ext, P.yard, 1);
    g.restore();
    if (hit > 0) { mch_speed(g, 14 + ext, -2.4 + bob, 6, [[-5, 0.7], [-2.8, 1], [1.6, 0.8], [4, 0.6]], 0.6 * hit); mch_impact(g, tip + 1.2, -2.4 + bob, 3.6, sw > 0.25 && sw < 0.85 ? Math.sin((sw - 0.25) / 0.6 * Math.PI) : 0); }
    mch_smoke(g, -7.3, -24.6 + bob, 1.6, 5, e.moving ? 0.9 : 0.55, true, e.seed);
  }
  // facing down (front) and up (behind): the barrel end-on with its top running back, the tub, four legs splayed out
  function mch_walkerEnd(g, e, P, sw, bob, back) {
    const hit = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    const leg = (s, front, ph) => {
      const st = mch_step(e, ph, 0, 2.6), H = front ? [s * 8.4, 2.2 + bob] : [s * 6.8, -9.2 + bob], gy = front ? 11.2 : 6.6;
      const F = [s * (front ? 12.6 : 11.2), gy - st.lift], K = [s * (front ? 14.6 : 13.2), Math.min(H[1], F[1]) - 3.4];
      mch_wLeg(g, H, K, F, !front, P, front ? 1 : 0.85); if (front) mch_dust(g, F[0], gy + 0.4, 1.3, st.dust * 0.55);
    };
    leg(-1, false, 0); leg(1, false, Math.PI);
    g.save(); g.translate(0, bob);
    // the barrel's top, running away from us, staves and two hoops
    const top = () => { g.beginPath(); g.moveTo(-9.6, -1.4); g.lineTo(-9, -14.4); g.quadraticCurveTo(0, -16.6, 9, -14.4); g.lineTo(9.6, -1.4); g.closePath(); };
    top(); g.fillStyle = vfill(g, shade(P.wood, -0.1), -16, -1, 0.15, -0.3); g.fill();
    g.save(); top(); g.clip(); g.strokeStyle = 'rgba(40,20,8,0.42)'; g.lineWidth = 0.32; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 2.9, -1.4); g.lineTo(k * 2.6, -16); g.stroke(); }
    for (const y of [-12.6, -6]) { g.fillStyle = vfill(g, P.band, y - 0.8, y + 0.8); g.beginPath(); g.moveTo(-10, y - 0.8); g.quadraticCurveTo(0, y - 2.2, 10, y - 0.8); g.lineTo(10, y + 0.8); g.quadraticCurveTo(0, y - 0.6, -10, y + 0.8); g.closePath(); g.fill(); }
    g.restore(); top(); outline(g, 0.55);
    // boiler and chimney: behind the tub facing us, in front of it from behind
    const boiler = (bx, by) => {
      rr(g, bx - 3.2, by - 4.4, 6.4, 6.6, 1.8); g.fillStyle = mch_hfill(g, P.boiler, bx - 3.2, bx + 3.2); g.fill(); outline(g, 0.5);
      g.fillStyle = mch_C.BRASS; g.fillRect(bx - 3.2, by - 2.4, 6.4, 1); mch_rivets(g, [[bx - 2.2, by - 3.4], [bx + 2.2, by - 3.4]], 0.28);
      rr(g, bx - 1.15, by - 10.6, 2.3, 6.4, 0.5); g.fillStyle = mch_hfill(g, '#3a3a42', bx - 1.15, bx + 1.15); g.fill(); outline(g, 0.45);
      g.beginPath(); g.moveTo(bx - 2.2, by - 11.6); g.lineTo(bx + 2.2, by - 11.6); g.lineTo(bx + 1.4, by - 10.2); g.lineTo(bx - 1.4, by - 10.2); g.closePath(); g.fillStyle = '#2a2a30'; g.fill(); outline(g, 0.4);
      if (back) { rr(g, bx - 1.6, by - 1, 3.2, 2.4, 0.6); g.fillStyle = '#1e1a18'; g.fill(); const fl = 0.55 + Math.sin(time * 9) * 0.25; g.fillStyle = `rgba(255,${150 + fl * 60 | 0},60,${fl})`; for (const x of [-0.9, 0, 0.9]) g.fillRect(bx + x - 0.25, by - 0.6, 0.5, 1.6); }
    };
    const tub = () => {
      rr(g, -4.8, -17, 9.6, 5, 1.2); g.fillStyle = vfill(g, shade(P.wood, 0.08), -17, -12); g.fill(); outline(g, 0.5);
      g.strokeStyle = 'rgba(40,20,8,0.4)'; g.lineWidth = 0.3; for (const x of [-2.4, 0, 2.4]) { g.beginPath(); g.moveTo(x, -16); g.lineTo(x, -12.2); g.stroke(); }
      rr(g, -5.2, -17.8, 10.4, 1.5, 0.6); g.fillStyle = vfill(g, P.band, -17.8, -16.3); g.fill(); outline(g, 0.4); mch_rivets(g, [[-3.6, -17.05], [0, -17.05], [3.6, -17.05]], 0.26);
    };
    if (!back) {
      boiler(-6.6, -14.8);
      if (P.yard) mch_flag(g, 4.6, -17, 6.6, '#f2c230', '#2f7a3a');
      mch_pilot(g, e, 0, -16, 0.42, P.hat, false, e.facing.x, P.tunic); tub();
      const lv = e.moving ? Math.sin(e.walkT * 2) * 0.5 : 0;
      for (const s of [-1, 1]) { const tx = s * 3 + (s > 0 ? lv : -lv) * 0.6 - hit * s * 0.4, ty = -20 + hit * 0.6; mch_beam(g, [[s * 2.6, -17.4], [tx, ty]], 0.5, '#3a3a42', 0.4); mch_bolt(g, tx, ty, 0.72, '#c0392b'); mch_hand(g, tx + s * 0.2, ty + 0.6, 0.85); }
    } else {
      mch_pilot(g, e, 0, -16, 0.42, P.hat, true, 0, P.tunic); tub();
      if (P.yard) mch_flag(g, -4.6, -17, 6.6, '#f2c230', '#2f7a3a');
      boiler(6.4, -12.8);
    }
    // the barrel's end facing us
    mch_barrelEnd(g, 0, -1.4, 9.8, 8.8, P.wood, P.band, 12);
    if (P.yard) { const ring = () => { g.beginPath(); g.ellipse(0, -1.4, 7.4, 6.6, 0, 0, mch_TAU); g.ellipse(0, -1.4, 5.8, 5.1, 0, 0, mch_TAU, true); }; mch_hazard(g, ring, -8, -9, 8, 6, 0.9); }
    if (!back) {
      // the ram's iron collar and its studded head (the yard's: a stuffed pad), thrust at us on an attack
      ell(g, 0, -0.4, 4.4, 4); g.fillStyle = rfill(g, '#4a4a54', 0, -0.4, 4.4); g.fill(); outline(g, 0.5);
      mch_rivets(g, [0, 1, 2, 3, 4, 5].map(k => [Math.cos(k / 6 * mch_TAU) * 3.5, -0.4 + Math.sin(k / 6 * mch_TAU) * 3.1]), 0.3);
      const s = 1 + hit * 0.45, hy = 0.4 + hit * 3.4;
      g.save(); g.translate(0, hy); g.scale(s, s);
      if (P.yard) { ell(g, 0, 0, 3.6, 3.3); g.fillStyle = rfill(g, '#a0522d', 0, 0, 3.6); g.fill(); outline(g, 0.5); g.strokeStyle = 'rgba(255,230,190,0.75)'; g.lineWidth = 0.26; g.setLineDash([0.6, 0.5]); ell(g, 0, 0, 2.5, 2.2); g.stroke(); g.setLineDash([]); }
      else { rr(g, -3, -2.8, 6, 5.6, 1); g.fillStyle = vfill(g, '#8f96a3', -2.8, 2.8); g.fill(); outline(g, 0.5); for (const [x, y] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.3], [1.4, 1.3]]) { ell(g, x, y, 0.95, 0.95); g.fillStyle = rfill(g, '#b9bec6', x, y, 1); g.fill(); outline(g, 0.3); } }
      g.restore();
      if (hit > 0) mch_impact(g, 0, hy + 1, 5.4, sw > 0.25 && sw < 0.85 ? Math.sin((sw - 0.25) / 0.6 * Math.PI) : 0);
    } else {
      // from behind: the stoke-hole of the firebox in the barrel's end
      ell(g, 0, -0.6, 3.6, 3.2); g.fillStyle = '#2a2420'; g.fill(); outline(g, 0.5);
      const fl = 0.6 + Math.sin(time * 8) * 0.25, gl = g.createRadialGradient(0, -0.2, 0.2, 0, -0.4, 3); gl.addColorStop(0, `rgba(255,220,120,${fl})`); gl.addColorStop(1, 'rgba(255,90,30,0.15)'); g.fillStyle = gl; ell(g, 0, -0.5, 2.8, 2.4); g.fill();
      g.strokeStyle = '#3a3a42'; g.lineWidth = 0.5; for (const x of [-1.4, 0, 1.4]) { g.beginPath(); g.moveTo(x, -3.2); g.lineTo(x, 2.2); g.stroke(); }
    }
    g.restore();
    leg(-1, true, Math.PI); leg(1, true, 0);
    mch_smoke(g, back ? 6.4 : -6.6, (back ? -24.6 : -26.6) + bob, 1.6, 5, e.moving ? 0.9 : 0.55, true, e.seed);
  }
  function mch_drawWalker(g, e, yard) {
    const P = mch_walkerPal(yard), f = face4(e), sw = swingOf(e), bob = e.moving ? -Math.abs(Math.sin(e.walkT)) * 1 : Math.sin(time * 2.2 + (e.seed || 0)) * 0.25;
    g.save(); shadow(g, 0, 11.4, 15.5, 3.6, 0.3);
    if (f === 'left') g.scale(-1, 1);
    if (f === 'down' || f === 'up') mch_walkerEnd(g, e, P, sw, bob, f === 'up'); else mch_walkerSide(g, e, P, sw, bob);
    g.restore();
  }
  const mch_walker = (g, e) => mch_drawWalker(g, e, false);
  const mch_yardWalker = (g, e) => mch_drawWalker(g, e, true);

  // ---------- the goblin bulldozer: a wooden deck on iron-shod wheels, a boiler and stack at the back, a great toothed blade ----------
  function mch_dozerPal(yard) {
    return yard ? { wood: '#94704a', band: '#55555f', boiler: '#606068', blade: '#8a8f99', yard: true, hat: mch_yardHat, tunic: '#5a6a3a', wheel: '#a07a4a' }
      : { wood: '#7a4a2a', band: '#3a3a42', boiler: '#5a5a62', blade: '#6e727c', yard: false, hat: mch_oneGoggle, tunic: '#7a5a3a', wheel: '#8a5a32' };
  }
  // a spoked wheel with an iron tyre, seen from the side
  function mch_wheel(g, x, y, r, spin, dark, P) {
    g.save(); g.translate(x, y);
    ell(g, 0, 0, r, r); g.fillStyle = rfill(g, dark ? '#26262c' : '#3e3e46', 0, 0, r); g.fill(); outline(g, 0.6);
    g.fillStyle = dark ? '#34343c' : '#666a74'; for (let k = 0; k < 14; k++) { g.save(); g.rotate(spin + k / 14 * mch_TAU); g.fillRect(r - 0.75, -0.42, 1, 0.84); g.restore(); }
    ell(g, 0, 0, r * 0.7, r * 0.7); g.fillStyle = dark ? '#160e08' : '#2a1a10'; g.fill();
    for (let k = 0; k < 6; k++) { const a = spin + k / 6 * mch_TAU; mch_beam(g, [[Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2], [Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68]], r * 0.15, dark ? '#4a2e18' : P.wheel, 0.35); }
    ell(g, 0, 0, r * 0.7, r * 0.7); g.strokeStyle = dark ? '#4a2e18' : P.wheel; g.lineWidth = r * 0.12; g.stroke(); g.strokeStyle = OUT; g.lineWidth = 0.3; g.stroke();
    mch_bolt(g, 0, 0, r * 0.25, dark ? '#55555f' : '#a9adb5');
    g.restore();
  }
  // a wheel seen edge-on (front and back views): a tall tyre whose tread runs down as it rolls
  function mch_wheelEdge(g, x, y, w, h, roll, dark) {
    rr(g, x - w / 2, y - h / 2, w, h, w * 0.45); g.fillStyle = mch_hfill(g, dark ? '#2a2a30' : '#45454e', x - w / 2, x + w / 2); g.fill(); outline(g, 0.55);
    g.save(); rr(g, x - w / 2, y - h / 2, w, h, w * 0.45); g.clip(); g.fillStyle = dark ? '#3a3a42' : '#6b6f7a';
    const step = 1.6, off = ((roll % step) + step) % step; for (let yy = y - h / 2 - step + off; yy < y + h / 2; yy += step) g.fillRect(x - w / 2, yy, w, 0.55);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - w / 2, y - h / 2, w, h * 0.22); g.fillRect(x - w / 2, y + h * 0.3, w, h * 0.2);
    g.restore();
  }
  // the blade's face seen from the front: a curved iron plate, dark in its hollow, a bright worn edge with teeth
  function mch_lantern(g, x, y) {
    mch_glow(g, x, y, 3.2, '255,210,110', 0.45 + Math.sin(time * 5 + x) * 0.1);
    rr(g, x - 0.9, y - 1.2, 1.8, 2.4, 0.4); g.fillStyle = '#ffe9a0'; g.fill(); outline(g, 0.35);
    g.strokeStyle = '#7a5a1e'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(x, y - 1.2); g.lineTo(x, y + 1.2); g.stroke();
    g.beginPath(); g.moveTo(x - 1.2, y - 1.2); g.lineTo(x, y - 2.2); g.lineTo(x + 1.2, y - 1.2); g.closePath(); g.fillStyle = mch_C.BRASS; g.fill(); outline(g, 0.3);
    rr(g, x - 1.1, y + 1.1, 2.2, 0.6, 0.2); g.fillStyle = mch_C.BRASS; g.fill();
  }
  // the blade's face from the front: a curved iron plate whose ends sweep forward, hollow and dark under its lip, worn bright at the
  // edge, iron teeth along the bottom, and a big painted goblin grin (the yard's: warning stripes and a leather bumper)
  function mch_bladeFront(g, x0, x1, yt, yb, P) {
    const path = () => { g.beginPath(); g.moveTo(x0 - 1.4, yt - 1.6); g.quadraticCurveTo(x0 + 2, yt + 0.4, 0, yt + 0.6); g.quadraticCurveTo(x1 - 2, yt + 0.4, x1 + 1.4, yt - 1.6); g.lineTo(x1 + 1.8, yb - 0.4); g.quadraticCurveTo(0, yb + 0.8, x0 - 1.8, yb - 0.4); g.closePath(); };
    path(); const gr = g.createLinearGradient(0, yt - 1, 0, yb); gr.addColorStop(0, shade(P.blade, 0.45)); gr.addColorStop(0.12, shade(P.blade, -0.5)); gr.addColorStop(0.42, shade(P.blade, -0.08)); gr.addColorStop(0.78, shade(P.blade, 0.3)); gr.addColorStop(1, shade(P.blade, -0.25)); g.fillStyle = gr; g.fill();
    g.save(); path(); g.clip();
    // the ends sweep toward us: lit wings
    for (const s of [-1, 1]) { const ex = s > 0 ? x1 : x0; g.beginPath(); g.moveTo(ex + s * 1.8, yt - 2); g.lineTo(ex - s * 2.4, yt); g.lineTo(ex - s * 2.6, yb); g.lineTo(ex + s * 2, yb); g.closePath(); g.fillStyle = s < 0 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.22)'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(ex - s * 2.4, yt); g.lineTo(ex - s * 2.6, yb); g.stroke(); }
    const my = lerp(yt, yb, 0.5);
    if (P.yard) { const band = () => { g.beginPath(); g.rect(x0 - 2, my - 2.4, x1 - x0 + 4, 4.8); }; mch_hazard(g, band, x0 - 2, my - 2.4, x1 + 2, my + 2.4, 1.5); }
    else {
      // the painted grin: a red mouth, white teeth top and bottom, two slanted painted eyes over it
      const mw = (x1 - x0) * 0.36, mouth = () => { g.beginPath(); g.moveTo(-mw, my - 2.2); g.quadraticCurveTo(0, my - 0.6, mw, my - 2.2); g.quadraticCurveTo(mw * 0.7, my + 3.6, 0, my + 3.8); g.quadraticCurveTo(-mw * 0.7, my + 3.6, -mw, my - 2.2); g.closePath(); };
      mouth(); g.fillStyle = 'rgba(176,36,28,0.92)'; g.fill();
      g.save(); mouth(); g.clip(); g.fillStyle = 'rgba(245,240,226,0.95)';
      for (let k = 0; k < 7; k++) { const x = lerp(-mw + 1, mw - 1, k / 6), y = my - 1.6 + Math.abs(x) / mw * -0.6; g.beginPath(); g.moveTo(x - 0.9, y - 0.8); g.lineTo(x, y + 1.4); g.lineTo(x + 0.9, y - 0.8); g.closePath(); g.fill(); }
      for (let k = 0; k < 6; k++) { const x = lerp(-mw + 2, mw - 2, k / 5), y = my + 3.6 - Math.abs(x) / mw * 1.6; g.beginPath(); g.moveTo(x - 0.8, y + 0.6); g.lineTo(x, y - 1.3); g.lineTo(x + 0.8, y + 0.6); g.closePath(); g.fill(); }
      g.restore(); mouth(); g.strokeStyle = 'rgba(90,16,12,0.8)'; g.lineWidth = 0.3; g.stroke();
      g.fillStyle = 'rgba(176,36,28,0.92)'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2.4, my - 3.4); g.lineTo(s * 6.4, my - 5.4); g.lineTo(s * 6, my - 3.6); g.closePath(); g.fill(); }
    }
    for (const x of [x0 + 3.2, x1 - 3.2]) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 0.9, yt, 1.8, yb - yt); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x - 0.9, yt, 0.6, yb - yt); }
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 0.35; for (const [a, b] of [[-9, -7.4], [6, 8.2], [-1.4, 0.2]]) { g.beginPath(); g.moveTo(a, yb - 2.6); g.lineTo(b, yb - 1.4); g.stroke(); }
    g.restore();
    path(); outline(g, 0.65);
    g.strokeStyle = shade(P.blade, 0.6); g.lineWidth = 0.6; g.beginPath(); g.moveTo(x0 - 1, yt - 1.2); g.quadraticCurveTo(x0 + 2, yt + 0.7, 0, yt + 0.9); g.quadraticCurveTo(x1 - 2, yt + 0.7, x1 + 1, yt - 1.2); g.stroke();
    const rv = []; for (let k = 0; k < 8; k++) { const x = lerp(x0 + 1.2, x1 - 1.2, k / 7); rv.push([x, yt + 2.2 - Math.abs(x) * 0.02], [x, yb - 1.3]); } mch_rivets(g, rv, 0.3);
    if (P.yard) {
      rr(g, x0 - 1.2, yt - 3.2, x1 - x0 + 2.4, 3, 1.5); g.fillStyle = vfill(g, '#a0522d', yt - 3.2, yt - 0.2); g.fill(); outline(g, 0.5);
      g.strokeStyle = 'rgba(255,230,190,0.7)'; g.lineWidth = 0.25; g.setLineDash([0.6, 0.5]); g.beginPath(); g.moveTo(x0, yt - 1.7); g.lineTo(x1, yt - 1.7); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#5a3a1e'; for (const x of [x0 + 4, 0, x1 - 4]) g.fillRect(x - 0.4, yt - 3.4, 0.8, 3.4);
    } else {
      for (let k = 0; k <= 8; k++) { const x = lerp(x0 + 0.4, x1 - 0.4, k / 8); g.beginPath(); g.moveTo(x - 1.1, yb + 0.2); g.lineTo(x, yb + 2.2); g.lineTo(x + 1.1, yb + 0.2); g.closePath(); g.fillStyle = vfill(g, '#d5d9e0', yb, yb + 2.2, 0.3, -0.3); g.fill(); outline(g, 0.3); }
    }
  }
  function mch_dozerSide(g, e, P, sw) {
    const wt = e.walkT || 0, mv = e.moving, hit = sw >= 0 ? Math.sin(sw * Math.PI) : 0, L = hit * 4.5, spin = wt * 1.6 + hit * 2, rumble = mv ? Math.sin(wt * 3) * 0.22 : 0;
    if (mv || hit) for (let k = 0; k < 3 + (hit ? 2 : 0); k++) { const ph = (time * 1.4 + k * 0.29) % 1; mch_dust(g, -13 - ph * 6 - k * 0.8, 10.4 - ph * 1.6, 1.1 + ph * 1.2 + hit * 0.4, (1 - ph) * (hit ? 0.6 : 0.4)); }
    g.save(); g.translate(1.3, -1.7); mch_wheel(g, -6.8, 6, 5.2, spin, true, P); mch_wheel(g, 6.4, 7.2, 4, spin * 1.3, true, P); g.restore();
    g.save(); g.translate(hit * 1.6, rumble);
    // boiler and stack at the back
    rr(g, -13, -13.4, 6.8, 12, 2.2); g.fillStyle = mch_hfill(g, P.boiler, -13, -6.2); g.fill(); outline(g, 0.55);
    for (const y of [-10.6, -5]) { g.fillStyle = mch_C.BRASS; g.fillRect(-13, y, 6.8, 1); g.strokeStyle = OUT; g.lineWidth = 0.3; g.strokeRect(-13, y, 6.8, 1); }
    mch_rivets(g, [[-12, -12.2], [-7.2, -12.2], [-12, -7.6], [-7.2, -7.6], [-12, -2.4], [-7.2, -2.4]], 0.28);
    rr(g, -12.2, -3.8, 3, 2.6, 0.6); g.fillStyle = '#1e1a18'; g.fill(); outline(g, 0.35);
    const fl = 0.55 + Math.sin(time * 8) * 0.25 + hit * 0.2; g.fillStyle = `rgba(255,${140 + fl * 70 | 0},50,${Math.min(1, fl)})`; for (const x of [-11.6, -10.7, -9.8]) g.fillRect(x, -3.4, 0.5, 1.8);
    rr(g, -10.8, -21.4, 2.4, 8.4, 0.5); g.fillStyle = mch_hfill(g, '#3a3a42', -10.8, -8.4); g.fill(); outline(g, 0.45);
    g.beginPath(); g.moveTo(-11.9, -22.4); g.lineTo(-7.3, -22.4); g.lineTo(-8.2, -20.9); g.lineTo(-11, -20.9); g.closePath(); g.fillStyle = '#2a2a30'; g.fill(); outline(g, 0.4);
    // the seat's back, the driver, his wheel
    rr(g, -4.8, -7.6, 1.6, 6.4, 0.6); g.fillStyle = vfill(g, '#5a3a1e', -7.6, -1.2); g.fill(); outline(g, 0.4);
    mch_pilot(g, e, -0.6, -6.2, 0.42, P.hat, false, 1, P.tunic);
    // the deck
    rr(g, -12.8, -2, 22.4, 7, 1.2); g.fillStyle = vfill(g, P.wood, -2, 5, 0.28, -0.4); g.fill();
    g.save(); rr(g, -12.8, -2, 22.4, 7, 1.2); g.clip(); g.strokeStyle = 'rgba(40,20,8,0.45)'; g.lineWidth = 0.3; for (const y of [0.3, 2.6]) { g.beginPath(); g.moveTo(-12.8, y); g.lineTo(9.6, y); g.stroke(); }
    for (const x of [-5.6, 2.4]) { g.fillStyle = vfill(g, P.band, -2, 5); g.fillRect(x - 0.8, -2, 1.6, 7); }
    if (P.yard) mch_hazard(g, () => { g.beginPath(); g.rect(-12.8, 3.4, 22.4, 1.6); }, -12.8, 3.4, 9.6, 5, 0.8);
    g.restore(); rr(g, -12.8, -2, 22.4, 7, 1.2); outline(g, 0.55);
    mch_rivets(g, [[-5.6, -1], [-5.6, 3.8], [2.4, -1], [2.4, 3.8]], 0.3);
    rr(g, 8.4, -2.4, 2.2, 7.6, 0.6); g.fillStyle = vfill(g, '#4e4e58', -2.4, 5.2); g.fill(); outline(g, 0.45); mch_rivets(g, [[9.5, -1.2], [9.5, 4]], 0.28);
    mch_beam(g, [[9, -2.2], [9, -6]], 0.4, '#3a3a42', 0.35); mch_lantern(g, 9, -7.2);
    // steering column, wheel and both hands on it
    mch_beam(g, [[4.6, -1.4], [3.2, -6.2]], 0.6, '#3a3a42', 0.4);
    g.save(); g.translate(3.1, -6.6); g.rotate(0.35); ell(g, 0, 0, 0.9, 2.4); g.strokeStyle = OUT; g.lineWidth = 0.9; g.stroke(); g.strokeStyle = mch_C.BRASS; g.lineWidth = 0.55; g.stroke(); g.restore();
    mch_hand(g, 3.4, -8.4 + (mv ? Math.sin(wt * 2) * 0.3 : 0), 0.85); mch_hand(g, 2.8, -4.9, 0.85);
    // a mudguard over the big back wheel, then the near wheels
    g.restore();
    mch_wheel(g, -6.8 + hit * 1.6, 6, 5.2, spin, false, P); mch_wheel(g, 6.4 + hit * 1.6, 7.2, 4, spin * 1.3, false, P);
    g.beginPath(); g.arc(-6.8 + hit * 1.6, 6, 6.2, Math.PI * 1.08, Math.PI * 1.92); g.strokeStyle = OUT; g.lineWidth = 1.7; g.stroke(); g.strokeStyle = '#55555f'; g.lineWidth = 1.2; g.stroke();
    // push arms, the piston that shoves the blade, and the blade itself
    g.save(); g.translate(hit * 1.6, rumble);
    mch_beam(g, [[6.6, 3.6], [12 + L, 6]], 1.6, '#3a3a42');
    mch_beam(g, [[6.4, -0.6], [12.2 + L, -3]], 1.6, '#3a3a42');
    mch_piston(g, 2.6, -2.6, 11.8 + L, -7.4, 1.4, 0.5);
    g.translate(L, 0);
    const bl = () => { g.beginPath(); g.moveTo(12.2, -11.4); g.quadraticCurveTo(9.8, 0.6, 12.4, 10.8); g.lineTo(17.6, 11.2); g.quadraticCurveTo(14, 1.4, 16.2, -12); g.quadraticCurveTo(14.2, -13.2, 12.2, -11.4); g.closePath(); };
    bl(); g.fillStyle = mch_hfill(g, P.blade, 10.6, 16.6); g.fill(); outline(g, 0.6);
    g.strokeStyle = shade(P.blade, 0.6); g.lineWidth = 0.6; g.beginPath(); g.moveTo(17.2, 10.6); g.quadraticCurveTo(14.4, 1.4, 16, -11.4); g.stroke();
    for (const y of [-7, -1, 5]) { rr(g, 10.6 + Math.abs(y + 1) * 0.12, y - 1.6, 1.6, 3.2, 0.5); g.fillStyle = '#3a3a42'; g.fill(); outline(g, 0.3); }
    mch_rivets(g, [[12.6, -7], [12, -1], [12.4, 5]], 0.32);
    if (P.yard) { rr(g, 12.2, -14, 4.4, 3.2, 1.5); g.fillStyle = vfill(g, '#a0522d', -14, -10.8); g.fill(); outline(g, 0.45); }
    else for (const [x, y] of [[17.4, 11], [16.4, 8.6]]) { g.beginPath(); g.moveTo(x - 0.4, y - 1.4); g.lineTo(x + 2, y + 0.1); g.lineTo(x - 0.2, y + 0.3); g.closePath(); g.fillStyle = '#d5d9e0'; g.fill(); outline(g, 0.3); }
    g.restore();
    if (hit > 0) { const a = sw > 0.2 && sw < 0.85 ? Math.sin((sw - 0.2) / 0.65 * Math.PI) : 0; mch_impact(g, 19.4 + L + hit * 1.6, 3, 4.4, a); for (const [x, y, r] of [[19, 9.6, 1], [21.2, 7.4, 0.7], [20.4, 5.2, 0.6]]) { ell(g, x + L + sw * 3, y - sw * 3, r, r * 0.8); g.fillStyle = `rgba(150,120,80,${a})`; g.fill(); } mch_speed(g, -12, -6, 6, [[-2, 0.7], [1, 1], [4, 0.8]], 0.55 * hit); }
    mch_smoke(g, -9.6 + hit * 1.6, -23.4, 1.7, mv || hit ? 6 : 4, mv || hit ? 1.1 : 0.55, true, e.seed);
  }
  function mch_dozerEnd(g, e, P, sw, back) {
    const wt = e.walkT || 0, mv = e.moving, hit = sw >= 0 ? Math.sin(sw * Math.PI) : 0, roll = wt * 3.4 * (back ? -1 : 1), rumble = mv ? Math.sin(wt * 3) * 0.22 : 0;
    g.save(); g.translate(0, rumble);
    if (!back) {
      for (const s of [-1, 1]) mch_wheelEdge(g, s * 12.8, 3, 4.4, 10, roll, true);
      // the deck behind the blade and the boiler and stack at the back
      rr(g, -10.6, -9.4, 21.2, 7.2, 1.2); g.fillStyle = vfill(g, shade(P.wood, -0.05), -9.4, -2.2); g.fill(); outline(g, 0.5);
      g.save(); rr(g, -10.6, -9.4, 21.2, 7.2, 1.2); g.clip(); g.strokeStyle = 'rgba(40,20,8,0.4)'; g.lineWidth = 0.3; for (const x of [-6, -2, 2, 6]) { g.beginPath(); g.moveTo(x, -9.4); g.lineTo(x * 1.08, -2.2); g.stroke(); } g.restore();
      rr(g, -8.6, -15.4, 6.4, 7.6, 2); g.fillStyle = mch_hfill(g, P.boiler, -8.6, -2.2); g.fill(); outline(g, 0.5);
      g.fillStyle = mch_C.BRASS; g.fillRect(-8.6, -12.6, 6.4, 1); mch_rivets(g, [[-7.6, -14.4], [-3.2, -14.4]], 0.28);
      rr(g, -6.6, -21.6, 2.4, 6.6, 0.5); g.fillStyle = mch_hfill(g, '#3a3a42', -6.6, -4.2); g.fill(); outline(g, 0.45);
      g.beginPath(); g.moveTo(-7.7, -22.6); g.lineTo(-3.1, -22.6); g.lineTo(-4, -21.2); g.lineTo(-6.8, -21.2); g.closePath(); g.fillStyle = '#2a2a30'; g.fill(); outline(g, 0.4);
      if (P.yard) mch_flag(g, 6.8, -8.8, 7, '#f2c230', '#2f7a3a');
      mch_pilot(g, e, 1, -8.6, 0.42, P.hat, false, e.facing.x, P.tunic);
      // his steering wheel, both hands gripping it
      ell(g, 1, -6.2, 2.7, 1.05); g.strokeStyle = OUT; g.lineWidth = 0.95; g.stroke(); g.strokeStyle = mch_C.BRASS; g.lineWidth = 0.6; g.stroke();
      const tw = mv ? Math.sin(wt * 2) * 0.4 : 0; mch_hand(g, -1.3, -6.4 + tw, 0.85); mch_hand(g, 3.3, -6.4 - tw, 0.85);
      for (const s of [-1, 1]) { mch_wheelEdge(g, s * 15.8, 5.8, 4.4, 10.6, roll, false); mch_beam(g, [[s * 9.4, -8.4], [s * 9.4, -5]], 0.4, '#3a3a42', 0.35); mch_lantern(g, s * 9.4, -9.4); }
      g.save(); g.translate(0, hit * 2.4); const k = 1 + hit * 0.1; g.translate(0, 10.5); g.scale(k, k); g.translate(0, -10.5);
      mch_bladeFront(g, -13.6, 13.6, -4.2, 10.2, P);
      g.restore();
      if (hit > 0) { const a = sw > 0.2 && sw < 0.85 ? Math.sin((sw - 0.2) / 0.65 * Math.PI) : 0; for (const s of [-1, 1]) mch_dust(g, s * 12, 12.4, 1.8, a * 0.7); mch_impact(g, 0, 8.6 + hit * 2.4, 6, a); }
    } else {
      // from behind: the blade's back far off, the wheels, the boiler's firebox door facing us
      g.fillStyle = vfill(g, shade(P.blade, -0.25), -12, -6); rr(g, -14, -12.6, 28, 6.4, 1.4); g.fill(); outline(g, 0.5);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (const x of [-9, 0, 9]) g.fillRect(x - 0.7, -12.6, 1.4, 6.4);
      for (const s of [-1, 1]) mch_wheelEdge(g, s * 15.1, -1.6, 3.2, 8, roll, true);
      rr(g, -10.6, -8.2, 21.2, 10, 1.2); g.fillStyle = vfill(g, P.wood, -8.2, 1.8); g.fill(); outline(g, 0.5);
      g.save(); rr(g, -10.6, -8.2, 21.2, 10, 1.2); g.clip(); g.strokeStyle = 'rgba(40,20,8,0.4)'; g.lineWidth = 0.3; for (const y of [-5, -2]) { g.beginPath(); g.moveTo(-10.6, y); g.lineTo(10.6, y); g.stroke(); } for (const x of [-6.4, 6.4]) { g.fillStyle = vfill(g, P.band, -8, 2); g.fillRect(x - 0.8, -8.2, 1.6, 10); } g.restore();
      mch_pilot(g, e, -2.2, -8.4, 0.42, P.hat, true, 0, P.tunic);
      if (P.yard) mch_flag(g, -8.2, -7.4, 7, '#f2c230', '#2f7a3a');
      rr(g, 1.6, -13.2, 8, 14.4, 2.4); g.fillStyle = mch_hfill(g, P.boiler, 1.6, 9.6); g.fill(); outline(g, 0.55);
      for (const y of [-10.6, -3.4]) { g.fillStyle = mch_C.BRASS; g.fillRect(1.6, y, 8, 1); }
      mch_rivets(g, [[2.6, -12.2], [8.6, -12.2], [2.6, 0.2], [8.6, 0.2]], 0.28);
      ell(g, 5.6, -1, 2.6, 2.4); g.fillStyle = '#2a2420'; g.fill(); outline(g, 0.45);
      const fl = 0.6 + Math.sin(time * 8) * 0.25, gl = g.createRadialGradient(5.6, -0.8, 0.2, 5.6, -1, 2.4); gl.addColorStop(0, `rgba(255,220,120,${fl})`); gl.addColorStop(1, 'rgba(255,90,30,0.15)'); g.fillStyle = gl; ell(g, 5.6, -1, 2, 1.8); g.fill();
      g.strokeStyle = '#3a3a42'; g.lineWidth = 0.45; for (const x of [4.6, 5.6, 6.6]) { g.beginPath(); g.moveTo(x, -3); g.lineTo(x, 1); g.stroke(); }
      rr(g, 4.4, -21.4, 2.4, 8.6, 0.5); g.fillStyle = mch_hfill(g, '#3a3a42', 4.4, 6.8); g.fill(); outline(g, 0.45);
      g.beginPath(); g.moveTo(3.3, -22.4); g.lineTo(7.9, -22.4); g.lineTo(7, -21); g.lineTo(4.2, -21); g.closePath(); g.fillStyle = '#2a2a30'; g.fill(); outline(g, 0.4);
      for (const s of [-1, 1]) mch_wheelEdge(g, s * 13, 5.6, 5, 11.4, roll, false);
      for (const s of [-1, 1]) { mch_beam(g, [[s * 8.6, -8.6], [s * 8.6, -6]], 0.4, '#3a3a42', 0.35); g.fillStyle = '#c0392b'; ell(g, s * 8.6, -9.2, 0.9, 0.9); g.fill(); outline(g, 0.3); mch_glow(g, s * 8.6, -9.2, 2.2, '255,80,60', 0.4); }
    }
    g.restore();
    mch_smoke(g, back ? 5.6 : -5.4, -23.6, 1.7, mv || hit ? 6 : 4, mv || hit ? 1.1 : 0.55, true, e.seed);
  }
  function mch_drawDozer(g, e, yard) {
    const P = mch_dozerPal(yard), f = face4(e), sw = swingOf(e);
    g.save(); shadow(g, 0, 11.4, 17, 3.8, 0.3);
    if (f === 'left') g.scale(-1, 1);
    if (f === 'down' || f === 'up') mch_dozerEnd(g, e, P, sw, f === 'up'); else mch_dozerSide(g, e, P, sw);
    g.restore();
  }
  const mch_bulldozer = (g, e) => mch_drawDozer(g, e, false);
  const mch_yardDozer = (g, e) => mch_drawDozer(g, e, true);


  // ---------- the Barrelbeast: a war machine built from barrels, legs of stacked kegs, a crew of three, a lightning rod, a spiked ram ----------
  const mch_BB = { wood: '#6a4022', band: '#2e2e36', keg: '#7a4a26', boiler: '#4a4a52' };
  // a small keg along a segment (the beast's legs are kegs bound with iron)
  function mch_keg(g, x0, y0, x1, y1, w, dark) {
    const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), c = dark ? shade(mch_BB.keg, -0.4) : mch_BB.keg;
    g.save(); g.translate(x0, y0); g.rotate(a);
    const path = () => { g.beginPath(); g.moveTo(0, -w / 2); g.quadraticCurveTo(L / 2, -w / 2 - w * 0.22, L, -w / 2); g.lineTo(L, w / 2); g.quadraticCurveTo(L / 2, w / 2 + w * 0.22, 0, w / 2); g.closePath(); };
    path(); const gr = g.createLinearGradient(0, -w / 2, 0, w / 2); gr.addColorStop(0, shade(c, 0.3)); gr.addColorStop(0.45, c); gr.addColorStop(1, shade(c, -0.4)); g.fillStyle = gr; g.fill();
    g.save(); path(); g.clip(); g.strokeStyle = 'rgba(40,20,8,0.45)'; g.lineWidth = 0.3; for (const t of [-0.25, 0.08, 0.36]) { g.beginPath(); g.moveTo(0, t * w); g.quadraticCurveTo(L / 2, t * w * 1.3, L, t * w); g.stroke(); }
    for (const u of [0.16, 0.84]) { g.fillStyle = vfill(g, dark ? '#1e1e24' : mch_BB.band, -w, w, 0.25, -0.3); g.fillRect(u * L - 0.55, -w, 1.1, w * 2); }
    g.restore(); path(); outline(g, 0.55);
    g.restore();
  }
  function mch_bbLeg(g, H, dir, gy, st, dark) {
    const K = [H[0] + dir * 3.8 + st.slide * 0.4, H[1] + 3.6 - st.lift * 0.6], F = [H[0] + dir * 2.4 + st.slide, gy - st.lift];
    if (!dark) mch_piston(g, H[0] - dir * 1.4, H[1] - 1.6, lerp(K[0], F[0], 0.55), lerp(K[1], F[1], 0.55), 1.2, 0.5);
    mch_keg(g, H[0], H[1], K[0], K[1], 4.2, dark);
    mch_keg(g, K[0], K[1], F[0], F[1] - 1.6, 3.8, dark);
    mch_bolt(g, K[0], K[1], 2, dark ? '#2a2a30' : '#4a4a54'); mch_bolt(g, K[0], K[1], 0.9, dark ? '#6a5520' : mch_C.BRASS);
    // an iron hoof with three claws
    g.beginPath(); g.moveTo(F[0] - 3.4, F[1] + 0.6); g.lineTo(F[0] - 2.4, F[1] - 2.2); g.lineTo(F[0] + 2.4, F[1] - 2.2); g.lineTo(F[0] + 3.4, F[1] + 0.6); g.closePath();
    g.fillStyle = vfill(g, dark ? '#202026' : '#4a4a54', F[1] - 2.2, F[1] + 0.6); g.fill(); outline(g, 0.55);
    g.fillStyle = dark ? '#5a5d64' : '#c9ccd3'; for (const t of [-2.2, 0, 2.2]) { g.beginPath(); g.moveTo(F[0] + t - 0.8, F[1] + 0.5); g.lineTo(F[0] + t + dir * 0.5, F[1] + 1.5); g.lineTo(F[0] + t + 0.8, F[1] + 0.5); g.closePath(); g.fill(); }
    if (!dark) mch_rivets(g, [[F[0] - 1.6, F[1] - 1.1], [F[0] + 1.6, F[1] - 1.1]], 0.32);
    if (!dark) mch_dust(g, F[0], gy + 0.6, 1.8, st.dust * 0.6);
  }
  // the lightning rod: an iron rod with a copper coil and a glass ball that crackles
  function mch_rod(g, x, y0, y1) {
    mch_beam(g, [[x, y0], [x, y1]], 0.9, '#3a3a42', 0.5);
    for (const y of [y0 - 1.2, lerp(y0, y1, 0.55)]) { rr(g, x - 1.2, y - 0.6, 2.4, 1.2, 0.3); g.fillStyle = '#8f96a3'; g.fill(); outline(g, 0.3); }
    g.strokeStyle = '#c8763a'; g.lineWidth = 0.4; for (let k = 0; k < 5; k++) { const y = y1 + 3 + k * 0.9; g.beginPath(); g.moveTo(x - 0.9, y); g.lineTo(x + 0.9, y + 0.45); g.stroke(); }
    const by = y1 - 1.8, p = 0.65 + Math.sin(time * 7) * 0.2;
    const gl = g.createRadialGradient(x, by, 0.3, x, by, 5); gl.addColorStop(0, `rgba(230,215,255,${p})`); gl.addColorStop(1, 'rgba(170,140,255,0)'); g.fillStyle = gl; ell(g, x, by, 5, 5); g.fill();
    ell(g, x, by, 1.9, 1.9); g.fillStyle = rfill(g, '#b9a6ff', x, by, 1.9); g.fill(); outline(g, 0.4); ell(g, x - 0.6, by - 0.6, 0.6, 0.6); g.fillStyle = '#ffffff'; g.fill();
    g.strokeStyle = `rgba(255,255,255,${0.5 + p * 0.5})`; g.lineWidth = 0.3; for (let k = 0; k < 3; k++) { const a = time * 9 + k * 2.1; g.beginPath(); g.moveTo(x + Math.cos(a) * 2, by + Math.sin(a) * 2); g.lineTo(x + Math.cos(a + 0.4) * 3, by + Math.sin(a + 0.4) * 3); g.lineTo(x + Math.cos(a) * 4, by + Math.sin(a) * 4); g.stroke(); }
  }
  function mch_pennant(g, x, y0, y1, toward) {
    mch_beam(g, [[x, y0], [x, y1]], 0.6, '#4a3218', 0.45);
    const w = k => Math.sin(time * 5 + k * 1.4) * 0.8;
    g.beginPath(); g.moveTo(x, y1); g.quadraticCurveTo(x + toward * 3, y1 + w(1), x + toward * 7, y1 + 0.6 + w(2)); g.lineTo(x + toward * 5.2, y1 + 2.2 + w(2)); g.lineTo(x + toward * 7, y1 + 3.8 + w(2)); g.quadraticCurveTo(x + toward * 3, y1 + 4.4 + w(1), x, y1 + 4.4); g.closePath();
    g.fillStyle = vfill(g, '#8a2e2a', y1, y1 + 4.4); g.fill(); outline(g, 0.4);
    g.fillStyle = '#f2ead6'; g.beginPath(); g.moveTo(x + toward * 0.6, y1 + 1.6); for (let k = 0; k < 4; k++) { g.lineTo(x + toward * (1.3 + k * 1.2), y1 + 2.8 + w(1) * 0.5); g.lineTo(x + toward * (1.9 + k * 1.2), y1 + 1.6 + w(1) * 0.5); } g.lineTo(x + toward * 0.6, y1 + 1.6); g.fill();
    ell(g, x, y1 - 0.3, 0.6, 0.6); g.fillStyle = mch_C.GOLD; g.fill();
  }
  function mch_bomb(g, x, y, r) {
    ell(g, x, y, r, r); g.fillStyle = rfill(g, '#2f3036', x, y, r); g.fill(); outline(g, 0.45);
    g.fillStyle = '#8a6a3a'; g.fillRect(x + r * 0.5, y - r - 0.4, r * 0.6, r * 0.5);
    g.strokeStyle = '#c9a66b'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(x + r * 0.8, y - r - 0.4); g.quadraticCurveTo(x + r * 1.4, y - r * 1.8, x + r * 1.9, y - r * 1.5); g.stroke();
    const p = (Math.sin(time * 18) + 1) / 2; sparkle(g, x + r * 1.95, y - r * 1.5, r * (0.5 + p * 0.4), `rgba(255,${180 + p * 60 | 0},80,0.95)`); sparkle(g, x + r * 1.95, y - r * 1.5, r * 0.25, '#ffffff');
  }
  function mch_spikedRam(g, x, y, ext) {
    rr(g, x, y - 2.4, 3.6, 4.8, 0.9); g.fillStyle = vfill(g, mch_C.DARK, y - 2.4, y + 2.4); g.fill(); outline(g, 0.5);
    if (ext > 0.1) { rr(g, x + 3.4, y - 1, ext + 0.6, 2, 0.6); g.fillStyle = vfill(g, '#d5d9e0', y - 1, y + 1, 0.4, -0.2); g.fill(); outline(g, 0.35); }
    const hx = x + 3.6 + ext;
    rr(g, hx, y - 5.8, 4, 11.6, 1.2); g.fillStyle = vfill(g, '#4e4e58', y - 5.8, y + 5.8); g.fill(); outline(g, 0.6);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(hx + 0.5, y - 5.2, 0.8, 10.4);
    for (const t of [-3.8, 0, 3.8]) { g.beginPath(); g.moveTo(hx + 3.8, y + t - 1.5); g.lineTo(hx + 7.6, y + t); g.lineTo(hx + 3.8, y + t + 1.5); g.closePath(); g.fillStyle = vfill(g, '#c9ccd3', y + t - 1.5, y + t + 1.5, 0.4, -0.3); g.fill(); outline(g, 0.4); }
    mch_rivets(g, [[hx + 1.4, y - 4.6], [hx + 1.4, y + 4.6], [hx + 1.4, y - 1.9], [hx + 1.4, y + 1.9]], 0.32);
    return hx + 7.6;
  }
  function mch_bbSide(g, e, sw, bob) {
    g.translate(-2.4, 0);
    const hit = sw >= 0 ? Math.sin(sw * Math.PI) : 0, ext = hit * 4.6, rock = e.moving ? Math.sin(e.walkT) * 0.025 : 0;
    const L = [[-7.6, -0.4, -1, Math.PI, 10.6], [11.4, -0.4, 1, 0, 10.6], [-9.6, 1.6, -1, 0, 12], [9.6, 1.6, 1, Math.PI, 12]];
    const leg = (l, dark) => mch_bbLeg(g, [l[0], l[1] + bob], l[2], l[4], mch_step(e, l[3], 2.3, 2.6), dark);
    leg(L[0], true); leg(L[1], true);
    g.save(); g.translate(0, bob); g.rotate(rock);
    // boiler and chimney at the back, the pennant behind the crew
    rr(g, -17, -25, 7.6, 13.6, 2.4); g.fillStyle = mch_hfill(g, mch_BB.boiler, -17, -9.4); g.fill(); outline(g, 0.55);
    for (const y of [-22, -15.4]) { g.fillStyle = mch_C.BRASS; g.fillRect(-17, y, 7.6, 1.1); g.strokeStyle = OUT; g.lineWidth = 0.3; g.strokeRect(-17, y, 7.6, 1.1); }
    mch_rivets(g, [[-16, -23.6], [-10.4, -23.6], [-16, -18.6], [-10.4, -18.6]], 0.32);
    ell(g, -13.2, -18.6, 1.5, 1.5); g.fillStyle = '#efe8d0'; g.fill(); outline(g, 0.3); g.strokeStyle = '#c0392b'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-13.2, -18.6); g.lineTo(-13.2 + Math.cos(time * 3) * 1.1, -18.6 + Math.sin(time * 3) * 1.1); g.stroke();
    rr(g, -14.6, -30.6, 2.8, 6, 0.6); g.fillStyle = mch_hfill(g, '#3a3a42', -14.6, -11.8); g.fill(); outline(g, 0.45);
    g.beginPath(); g.moveTo(-15.8, -31.8); g.lineTo(-10.6, -31.8); g.lineTo(-11.6, -30.2); g.lineTo(-14.8, -30.2); g.closePath(); g.fillStyle = '#2a2a30'; g.fill(); outline(g, 0.4);
    mch_pennant(g, -8.2, -15, -31, -1);
    // the barrel, with two spare kegs strapped to its belly
    mch_barrelSide(g, -15.5, 15.5, -13.2, 3.6, 1.9, mch_BB.wood, mch_BB.band, [-11, -3.8, 3.8, 11], 0.4);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(6, -10); g.lineTo(7.6, -7); g.lineTo(6.4, -4.6); g.lineTo(8, -2.4); g.stroke();
    for (const x of [-1.6, 1.8]) { rr(g, x - 1.6, -3.2, 3.2, 5.4, 1.2); g.fillStyle = mch_hfill(g, mch_BB.keg, x - 1.6, x + 1.6); g.fill(); outline(g, 0.45); g.fillStyle = mch_BB.band; g.fillRect(x - 1.6, -2.3, 3.2, 0.6); g.fillRect(x - 1.6, 0.8, 3.2, 0.6); }
    g.strokeStyle = '#5a3a1e'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-4, -0.4); g.lineTo(4.2, -0.4); g.stroke();
    // the crew behind the deck rail: a helmed goblin, the driver at the lever, the bomber in goggles with a lit bomb
    mch_rod(g, 13.6, -11.6, -30.4);
    mch_pilot(g, e, -5.8, -16, 0.42, spikeHelm, false, 1, '#6b4a2a');
    mch_pilot(g, e, 0.4, -17, 0.42, null, false, 1, '#7a5a3a');
    mch_pilot(g, e, 6.4, -16, 0.42, gogglesHat, false, 1, '#6b5a46');
    rr(g, -12.6, -16.6, 24, 3.6, 0.6); g.fillStyle = vfill(g, '#8a5a32', -16.6, -13); g.fill(); outline(g, 0.5);
    g.strokeStyle = 'rgba(40,20,8,0.45)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(-12.6, -14.8); g.lineTo(11.4, -14.8); g.stroke();
    for (const x of [-12, -4, 4, 11]) { rr(g, x - 0.6, -17.6, 1.2, 4.8, 0.4); g.fillStyle = '#5a3a1e'; g.fill(); outline(g, 0.3); }
    const la = -0.35 + (e.moving ? Math.sin(e.walkT * 2) * 0.3 : 0) - hit * 0.6;
    const lx = 2.8 + Math.sin(la + 0.6) * 4.6, ly = -16.6 - Math.cos(la + 0.6) * 4.6;
    mch_beam(g, [[2.8, -16.6], [lx, ly]], 0.6, '#3a3a42', 0.45); mch_bolt(g, lx, ly, 0.8, '#c0392b'); mch_hand(g, lx - 0.4, ly + 0.6, 0.85);
    // the bomb chute at the front, the bomber's hand with a lit bomb over it
    mch_beam(g, [[9.6, -14.6], [11, -18.2]], 2.4, '#2e2e36', 0.6); ell(g, 11.1, -18.4, 1.3, 0.7); g.fillStyle = '#121216'; g.fill();
    mch_bomb(g, 9.6, -20.6 - (hit ? 0.8 : 0), 1.25); mch_hand(g, 8.4, -19.8 - (hit ? 0.8 : 0), 0.85);
    g.restore();
    leg(L[2], false); leg(L[3], false);
    g.save(); g.translate(0, bob); g.rotate(rock);
    rr(g, 14.4, -9.4, 2.8, 9.6, 1); g.fillStyle = vfill(g, '#4e4e58', -9.4, 0.2); g.fill(); outline(g, 0.5); mch_rivets(g, [[15.8, -8.2], [15.8, -1]], 0.32);
    const tip = mch_spikedRam(g, 16.8, -4.6, ext);
    g.restore();
    if (hit > 0) { const a = sw > 0.25 && sw < 0.85 ? Math.sin((sw - 0.25) / 0.6 * Math.PI) : 0; mch_speed(g, 20 + ext, -4.6 + bob, 8, [[-6.4, 0.7], [-3, 1], [2.4, 0.9], [6, 0.6]], 0.6 * hit, 0.6); mch_impact(g, tip - 1, -4.6 + bob, 3.6, a); }
    mch_smoke(g, -13.2, -33 + bob, 2.1, 6, e.moving ? 0.8 : 0.5, true, e.seed, 4.2);
  }
  function mch_bbEnd(g, e, sw, bob, back) {
    const hit = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    const leg = (s, front, ph) => {
      const st = mch_step(e, ph, 0, 2.4), H = front ? [s * 11.2, 2.6 + bob] : [s * 9.4, -11.6 + bob], gy = front ? 12 : 6;
      if (!front) { g.save(); g.translate(H[0], 0); g.scale(0.82, 1); g.translate(-H[0], 0); }
      mch_bbLeg(g, H, s, gy, { lift: st.lift, slide: 0, dust: st.dust }, !front);
      if (!front) g.restore();
    };
    leg(-1, false, 0); leg(1, false, Math.PI);
    g.save(); g.translate(0, bob);
    const top = () => { g.beginPath(); g.moveTo(-13.6, -5); g.lineTo(-12.6, -19.4); g.quadraticCurveTo(0, -22.4, 12.6, -19.4); g.lineTo(13.6, -5); g.closePath(); };
    top(); g.fillStyle = vfill(g, shade(mch_BB.wood, -0.1), -22, -5, 0.15, -0.3); g.fill();
    g.save(); top(); g.clip(); g.strokeStyle = 'rgba(40,20,8,0.42)'; g.lineWidth = 0.32; for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(k * 3.1, -5); g.lineTo(k * 2.8, -22); g.stroke(); } g.restore(); top(); outline(g, 0.55);
    const boiler = (bx, by) => {
      rr(g, bx - 3.8, by - 6, 7.6, 9, 2.2); g.fillStyle = mch_hfill(g, mch_BB.boiler, bx - 3.8, bx + 3.8); g.fill(); outline(g, 0.55);
      g.fillStyle = mch_C.BRASS; g.fillRect(bx - 3.8, by - 3.4, 7.6, 1.1); mch_rivets(g, [[bx - 2.6, by - 4.8], [bx + 2.6, by - 4.8]], 0.3);
      rr(g, bx - 1.4, by - 11.6, 2.8, 6, 0.6); g.fillStyle = mch_hfill(g, '#3a3a42', bx - 1.4, bx + 1.4); g.fill(); outline(g, 0.45);
      g.beginPath(); g.moveTo(bx - 2.6, by - 12.8); g.lineTo(bx + 2.6, by - 12.8); g.lineTo(bx + 1.6, by - 11.2); g.lineTo(bx - 1.6, by - 11.2); g.closePath(); g.fillStyle = '#2a2a30'; g.fill(); outline(g, 0.4);
      if (back) { rr(g, bx - 2, by - 1.6, 4, 2.8, 0.7); g.fillStyle = '#1e1a18'; g.fill(); const fl = 0.55 + Math.sin(time * 9) * 0.25; g.fillStyle = `rgba(255,${150 + fl * 60 | 0},60,${fl})`; for (const x of [-1.1, 0, 1.1]) g.fillRect(bx + x - 0.3, by - 1.2, 0.6, 2); }
    };
    const rail = () => { rr(g, -11.6, -21, 23.2, 3.4, 0.6); g.fillStyle = vfill(g, '#8a5a32', -21, -17.6); g.fill(); outline(g, 0.5); for (const x of [-11, -3.8, 3.8, 11]) { rr(g, x - 0.6, -22, 1.2, 4.6, 0.4); g.fillStyle = '#5a3a1e'; g.fill(); outline(g, 0.3); } };
    const fx = back ? 0 : e.facing.x;
    if (!back) {
      boiler(-8.4, -20.4); mch_pennant(g, -12.6, -19, -32, -1); mch_rod(g, 10.4, -20.4, -32.4);
      mch_pilot(g, e, -6, -18.6, 0.42, spikeHelm, false, fx, '#6b4a2a'); mch_pilot(g, e, 6, -18.6, 0.42, gogglesHat, false, fx, '#6b5a46'); mch_pilot(g, e, 0, -19.6, 0.42, null, false, fx, '#7a5a3a');
      rail();
      const lv = e.moving ? Math.sin(e.walkT * 2) * 0.5 : 0;
      mch_beam(g, [[1.6, -21], [2.4 + lv - hit, -24.6]], 0.55, '#3a3a42', 0.45); mch_bolt(g, 2.4 + lv - hit, -24.6, 0.8, '#c0392b'); mch_hand(g, 2.1 + lv - hit, -24, 0.85);
      mch_bomb(g, 9.6, -22.8 - hit, 1.25); mch_hand(g, 8.6, -22, 0.85);
    } else {
      mch_rod(g, -10.4, -20.4, -32.4);
      mch_pilot(g, e, 6, -18.6, 0.42, spikeHelm, true, 0, '#6b4a2a'); mch_pilot(g, e, -6, -18.6, 0.42, gogglesHat, true, 0, '#6b5a46'); mch_pilot(g, e, 0, -19.6, 0.42, null, true, 0, '#7a5a3a');
      rail(); mch_pennant(g, 12.6, -19, -32, 1); boiler(8.4, -15.6);
    }
    mch_barrelEnd(g, 0, -5, 13.6, 12.4, mch_BB.wood, mch_BB.band, 14);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-9, -12); g.lineTo(-7, -9); g.lineTo(-8.4, -6.6); g.lineTo(-6.6, -4); g.stroke();
    if (!back) {
      ell(g, 0, -4.4, 5.8, 5.2); g.fillStyle = rfill(g, '#4a4a54', 0, -4.4, 5.8); g.fill(); outline(g, 0.55);
      mch_rivets(g, [0, 1, 2, 3, 4, 5, 6, 7].map(k => [Math.cos(k / 8 * mch_TAU) * 4.8, -4.4 + Math.sin(k / 8 * mch_TAU) * 4.3]), 0.32);
      const s = 1 + hit * 0.42, hy = -3.4 + hit * 4.6;
      g.save(); g.translate(0, hy); g.scale(s, s);
      rr(g, -3.8, -3.6, 7.6, 7, 1.2); g.fillStyle = vfill(g, '#4e4e58', -3.6, 3.4); g.fill(); outline(g, 0.55);
      for (const [x, y] of [[-2, -1.4], [2, -1.4], [0, 1.6]]) { g.beginPath(); g.moveTo(x - 1.3, y - 0.6); g.lineTo(x, y + 2.6); g.lineTo(x + 1.3, y - 0.6); g.quadraticCurveTo(x, y - 1.6, x - 1.3, y - 0.6); g.closePath(); g.fillStyle = vfill(g, '#c9ccd3', y - 1.4, y + 2.6, 0.45, -0.3); g.fill(); outline(g, 0.35); }
      g.restore();
      if (hit > 0) mch_impact(g, 0, hy + 2.6, 6.4, sw > 0.25 && sw < 0.85 ? Math.sin((sw - 0.25) / 0.6 * Math.PI) : 0);
    } else {
      ell(g, 0, -4.6, 5, 4.4); g.fillStyle = '#2a2420'; g.fill(); outline(g, 0.55);
      const fl = 0.6 + Math.sin(time * 8) * 0.25, gl = g.createRadialGradient(0, -4.2, 0.2, 0, -4.4, 4.2); gl.addColorStop(0, `rgba(255,220,120,${fl})`); gl.addColorStop(1, 'rgba(255,90,30,0.15)'); g.fillStyle = gl; ell(g, 0, -4.5, 4, 3.5); g.fill();
      g.strokeStyle = '#3a3a42'; g.lineWidth = 0.6; for (const x of [-2, 0, 2]) { g.beginPath(); g.moveTo(x, -8.4); g.lineTo(x, -0.8); g.stroke(); }
      mch_rivets(g, [0, 1, 2, 3, 4, 5].map(k => [Math.cos(k / 6 * mch_TAU) * 5.6, -4.6 + Math.sin(k / 6 * mch_TAU) * 5]), 0.32);
    }
    g.restore();
    leg(-1, true, Math.PI); leg(1, true, 0);
    mch_smoke(g, back ? 8.4 : -8.4, (back ? -29.4 : -34.2) + bob, 2.1, 6, e.moving ? 0.8 : 0.5, true, e.seed, 4.2);
  }
  function mch_barrelbeast(g, e) {
    const f = face4(e), sw = swingOf(e), bob = e.moving ? -Math.abs(Math.sin(e.walkT)) * 1.1 : Math.sin(time * 2 + (e.seed || 0)) * 0.3;
    g.save(); g.translate(0, 3); shadow(g, 0, 12.2, 20, 4.6, 0.32);
    if (f === 'left') g.scale(-1, 1);
    if (f === 'down' || f === 'up') mch_bbEnd(g, e, sw, bob, f === 'up'); else mch_bbSide(g, e, sw, bob);
    g.restore();
  }

  // ---------- the Gnasher: Tinkerton's machine gone wrong. A riveted iron box on two treads, a gnashing iron jaw, two red lamps,
  // a boiler on its back, a bomb chute on top and two piston arms with claws that swing ----------
  const mch_GN = { hull: '#5a5d64', dark: '#2e2e36', tread: '#26262c' };
  function mch_gnArm(g, x, y, A, ext, open, dark) {
    g.save(); g.translate(x, y); g.rotate(A);
    mch_beam(g, [[0, 0], [7.4, 0]], 2.8, dark ? '#25252b' : '#3e3e46');
    mch_beam(g, [[7, 0], [11.4 + ext, 0]], 1.2, dark ? '#7a7e86' : '#d5d9e0', 0.5);
    rr(g, 6.6, -1.9, 1.6, 3.8, 0.5); g.fillStyle = dark ? '#3a3a42' : mch_C.BRASS; g.fill(); outline(g, 0.35);
    g.translate(11.4 + ext, 0);
    rr(g, -0.8, -2.2, 2.8, 4.4, 0.8); g.fillStyle = vfill(g, dark ? '#2a2a30' : '#4e4e58', -2.2, 2.2); g.fill(); outline(g, 0.45);
    for (const s of [-1, 1]) {
      g.save(); g.translate(1.8, s * 1.2); g.rotate(s * (0.15 + open * 0.55));
      g.beginPath(); g.moveTo(0, -s * 0.9); g.quadraticCurveTo(3.4, -s * 1.6, 5.2, s * 0.9); g.lineTo(4.2, s * 1.1); g.quadraticCurveTo(3, -s * 0.2, 0, s * 0.9); g.closePath();
      g.fillStyle = vfill(g, dark ? '#4a4e56' : '#a9adb5', -2, 2); g.fill(); outline(g, 0.4); g.restore();
    }
    if (!dark) mch_rivets(g, [[0.6, -1.2], [0.6, 1.2]], 0.28);
    g.restore();
    mch_bolt(g, x, y, 2.2, dark ? '#2a2a30' : '#55555f'); mch_bolt(g, x, y, 0.9, dark ? '#5a4a20' : mch_C.BRASS);
  }
  // a tread seen from the side: a long rounded track, road wheels, iron shoes that run round as it moves
  function mch_tread(g, x0, x1, y0, y1, roll, dark) {
    const h = y1 - y0, r = h / 2;
    rr(g, x0, y0, x1 - x0, h, r); g.fillStyle = vfill(g, dark ? '#1c1c22' : mch_GN.tread, y0, y1, 0.2, -0.2); g.fill(); outline(g, 0.6);
    g.save(); rr(g, x0, y0, x1 - x0, h, r); g.clip();
    g.fillStyle = dark ? '#2e2e36' : '#55555f'; const step = 1.8, off = ((roll % step) + step) % step;
    for (let x = x0 - step + off; x < x1 + step; x += step) { g.fillRect(x, y0, 0.7, 1.1); g.fillRect(x1 + x0 - x - 0.7, y1 - 1.1, 0.7, 1.1); }
    g.restore();
    rr(g, x0 + 1, y0 + 1.3, x1 - x0 - 2, h - 2.6, r - 1.3); g.fillStyle = dark ? '#24242a' : '#3d3d46'; g.fill();
    const n = 5; for (let k = 0; k < n; k++) { const x = lerp(x0 + r, x1 - r, k / (n - 1)), rad = k === 0 || k === n - 1 ? r - 1.4 : r - 2; mch_bolt(g, x, (y0 + y1) / 2, rad, dark ? '#3a3a42' : '#6b6f7a'); if (!dark) mch_bolt(g, x, (y0 + y1) / 2, rad * 0.35, '#8f96a3'); }
    if (!dark) { for (const x of [x0 + r, x1 - r]) for (let k = 0; k < 8; k++) { const a = roll * 0.6 + k / 8 * mch_TAU; ell(g, x + Math.cos(a) * (r - 1.6), (y0 + y1) / 2 + Math.sin(a) * (r - 1.6), 0.35, 0.35); g.fillStyle = '#2a2a30'; g.fill(); } }
  }
  function mch_gnSide(g, e, sw) {
    const wt = e.walkT || 0, mv = e.moving, hit = sw >= 0 ? Math.sin(sw * Math.PI) : 0, roll = wt * 2.2, rumble = mv ? Math.sin(wt * 3) * 0.25 : 0;
    const chew = Math.max(0, Math.sin(time * 7)) * 0.12, open = 0.06 + chew + hit * 0.45;
    const armA = sw >= 0 ? lerp(-1.3, 1.05, ease(sw)) : 0.62 + (mv ? Math.sin(wt) * 0.1 : Math.sin(time * 2) * 0.05), armX = sw >= 0 ? hit * 4 : 0;
    g.save(); g.translate(1.2, -1.8); mch_tread(g, -14.6, 12.4, 2, 11, roll, true); g.restore();
    g.save(); g.translate(0, rumble);
    mch_gnArm(g, 3.6, -10.2, 0.62 + (mv ? -Math.sin(wt) * 0.12 : 0), 0, 0.2, true);
    // the boiler on its back and its whistling steam pipe
    rr(g, -17.2, -13.6, 6, 14, 2.4); g.fillStyle = mch_hfill(g, '#4a4a52', -17.2, -11.2); g.fill(); outline(g, 0.55);
    for (const y of [-10.8, -4]) { g.fillStyle = mch_C.BRASS; g.fillRect(-17.2, y, 6, 1); g.strokeStyle = OUT; g.lineWidth = 0.3; g.strokeRect(-17.2, y, 6, 1); }
    rr(g, -16.2, -2.4, 3.6, 2.6, 0.6); g.fillStyle = '#1e1a18'; g.fill(); const fl = 0.55 + Math.sin(time * 8) * 0.25; g.fillStyle = `rgba(255,${140 + fl * 70 | 0},50,${fl})`; for (const x of [-15.6, -14.6, -13.6]) g.fillRect(x, -2, 0.5, 1.8);
    rr(g, -15.2, -19.6, 2, 6.2, 0.5); g.fillStyle = mch_hfill(g, '#3a3a42', -15.2, -13.2); g.fill(); outline(g, 0.4);
    rr(g, -15.8, -20.6, 3.2, 1.4, 0.5); g.fillStyle = mch_C.BRASS; g.fill(); outline(g, 0.35);
    // the hull
    const hull = () => { g.beginPath(); g.moveTo(-12.4, 3); g.lineTo(-12.4, -11); g.lineTo(-9.2, -14.2); g.lineTo(6.6, -14.2); g.lineTo(11.6, -9.4); g.lineTo(12.4, -6); g.lineTo(12.4, 3); g.closePath(); };
    hull(); g.fillStyle = vfill(g, mch_GN.hull, -14.2, 3, 0.26, -0.38); g.fill();
    g.save(); hull(); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(-12.4, -14.2, 25, 2.6);
    g.strokeStyle = 'rgba(20,20,26,0.65)'; g.lineWidth = 0.4; g.beginPath(); for (const x of [-4.6, 3.6]) { g.moveTo(x, -14.2); g.lineTo(x, 3); } g.moveTo(-12.4, -5); g.lineTo(7.4, -5); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.3; g.beginPath(); for (const x of [-4.2, 4]) { g.moveTo(x, -13.6); g.lineTo(x, 2.6); } g.stroke();
    g.fillStyle = 'rgba(150,80,40,0.35)'; ell(g, -8, -1, 2.2, 1.4); g.fill(); ell(g, 0.6, -9.4, 1.4, 0.9); g.fill();
    g.restore(); hull(); outline(g, 0.65);
    mch_rivets(g, [[-11.4, -10.6], [-11.4, -6], [-11.4, 1.6], [-5.6, -12.8], [2.6, -12.8], [-5.6, 1.6], [2.6, 1.6], [-3.6, -6], [2.6, -6], [-8.6, -12.8]], 0.32);
    // the bomb hopper on top, a lit bomb showing
    mch_bomb(g, -1.8, -18.6, 1.9);
    g.beginPath(); g.moveTo(-5.4, -14); g.lineTo(-6.6, -18.4); g.lineTo(2.9, -18.4); g.lineTo(1.7, -14); g.closePath(); g.fillStyle = vfill(g, mch_GN.dark, -18.4, -14); g.fill(); outline(g, 0.5);
    rr(g, -7, -19.2, 10.3, 1.4, 0.5); g.fillStyle = '#4e4e58'; g.fill(); outline(g, 0.4); mch_rivets(g, [[-5.6, -18.5], [1.9, -18.5]], 0.28);
    // the face at the front: a lamp under an iron brow, a mouth of iron teeth with fire behind
    ell(g, 9.4, -2.6, 3, 2.4); g.fillStyle = 'rgba(255,120,40,0.85)'; g.fill();
    const lp = 0.7 + Math.sin(time * 8) * 0.25, lg = g.createRadialGradient(9.4, -10, 0.3, 9.4, -10, 4.4); lg.addColorStop(0, `rgba(255,90,60,${lp})`); lg.addColorStop(1, 'rgba(255,60,40,0)'); g.fillStyle = lg; ell(g, 9.4, -10, 4.4, 4.4); g.fill();
    ell(g, 9.4, -10, 1.7, 1.7); g.fillStyle = '#ff4a3a'; g.fill(); outline(g, 0.4); ell(g, 9, -10.4, 0.6, 0.6); g.fillStyle = '#ffe0d0'; g.fill();
    g.beginPath(); g.moveTo(6.6, -13.6); g.lineTo(12, -11.4); g.lineTo(11.4, -10.6); g.lineTo(6.6, -12.2); g.closePath(); g.fillStyle = '#3a3a42'; g.fill(); outline(g, 0.35);
    rr(g, 7.6, -6.6, 5.6, 2.2, 0.6); g.fillStyle = vfill(g, '#4e4e58', -6.6, -4.4); g.fill(); outline(g, 0.45);
    g.fillStyle = '#e8e4d8'; for (const x of [8.4, 9.9, 11.4]) { g.beginPath(); g.moveTo(x - 0.65, -4.5); g.lineTo(x, -3); g.lineTo(x + 0.65, -4.5); g.closePath(); g.fill(); outline(g, 0.25); }
    g.save(); g.translate(7.6, -2.8); g.rotate(open);
    g.fillStyle = '#e8e4d8'; for (const x of [1.2, 2.7, 4.2]) { g.beginPath(); g.moveTo(x - 0.65, 0.2); g.lineTo(x, -1.3); g.lineTo(x + 0.65, 0.2); g.closePath(); g.fill(); outline(g, 0.25); }
    rr(g, 0, 0, 5.6, 2.4, 0.6); g.fillStyle = vfill(g, '#4e4e58', 0, 2.4); g.fill(); outline(g, 0.45); mch_rivets(g, [[1, 1.2], [4.6, 1.2]], 0.26);
    g.restore();
    g.restore();
    mch_tread(g, -14.6, 12.4, 2, 11, roll, false);
    g.save(); g.translate(0, rumble);
    mch_gnArm(g, -1.4, -3.2, armA, armX, sw >= 0 ? 0.3 + hit * 0.7 : 0.15, false);
    g.restore();
    if (sw >= 0) swoosh(g, -1.4, -3.2 + rumble, 0.2, sw, 18);
    if (hit > 0) mch_impact(g, -1.4 + Math.cos(armA) * (17 + armX), -3.2 + Math.sin(armA) * (17 + armX), 3.6, sw > 0.3 && sw < 0.85 ? Math.sin((sw - 0.3) / 0.55 * Math.PI) : 0);
    mch_smoke(g, -14.2, -21.4 + rumble, 1.8, 5, mv ? 1 : 0.6, false, e.seed);
  }
  function mch_gnEnd(g, e, sw, back) {
    const wt = e.walkT || 0, mv = e.moving, hit = sw >= 0 ? Math.sin(sw * Math.PI) : 0, roll = wt * 2.2 * (back ? -1 : 1), rumble = mv ? Math.sin(wt * 3) * 0.25 : 0;
    const treadF = (x) => { rr(g, x - 2.9, -3, 5.8, 14, 2.6); g.fillStyle = mch_hfill(g, '#34343c', x - 2.9, x + 2.9); g.fill(); outline(g, 0.6); g.save(); rr(g, x - 2.9, -3, 5.8, 14, 2.6); g.clip(); g.fillStyle = '#5a5d64'; const st = 1.7, off = ((roll % st) + st) % st; for (let y = -3 - st + off; y < 11; y += st) g.fillRect(x - 2.9, y, 5.8, 0.6); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 2.9, -3, 5.8, 3); g.restore(); };
    const armRest = s => Math.PI / 2 - s * 0.42 + (mv ? Math.sin(wt + (s > 0 ? 0 : Math.PI)) * 0.1 : 0);
    g.save(); g.translate(0, rumble);
    // what is behind: the boiler's top and its steam pipe facing us, the hopper; in front of us from behind
    const boilerTop = (bx, by) => { rr(g, bx - 3.4, by - 5, 6.8, 6, 2.2); g.fillStyle = mch_hfill(g, '#4a4a52', bx - 3.4, bx + 3.4); g.fill(); outline(g, 0.5); g.fillStyle = mch_C.BRASS; g.fillRect(bx - 3.4, by - 3, 6.8, 0.9); rr(g, bx - 0.9, by - 10.4, 1.8, 5.6, 0.5); g.fillStyle = mch_hfill(g, '#3a3a42', bx - 0.9, bx + 0.9); g.fill(); outline(g, 0.4); rr(g, bx - 1.5, by - 11.4, 3, 1.3, 0.5); g.fillStyle = mch_C.BRASS; g.fill(); outline(g, 0.3); };
    const hopper = (hx, hy) => { mch_bomb(g, hx, hy - 4.6, 1.9); g.beginPath(); g.moveTo(hx - 3.6, hy); g.lineTo(hx - 4.8, hy - 4.4); g.lineTo(hx + 4.8, hy - 4.4); g.lineTo(hx + 3.6, hy); g.closePath(); g.fillStyle = vfill(g, mch_GN.dark, hy - 4.4, hy); g.fill(); outline(g, 0.5); rr(g, hx - 5.2, hy - 5.2, 10.4, 1.4, 0.5); g.fillStyle = '#4e4e58'; g.fill(); outline(g, 0.4); };
    if (!back) { boilerTop(-6.6, -14.6); hopper(1.6, -15); }
    for (const s of [-1, 1]) treadF(s * 14);
    // the hull: its top seen from above, then its face
    rr(g, -11.6, -16, 23.2, 5.4, 1.6); g.fillStyle = vfill(g, shade(mch_GN.hull, 0.12), -16, -10.6); g.fill(); outline(g, 0.5);
    if (back) { hopper(-1.6, -14.4); }
    rr(g, -11.6, -11.6, 23.2, 14.6, 1.8); g.fillStyle = vfill(g, mch_GN.hull, -11.6, 3, 0.2, -0.38); g.fill();
    g.save(); rr(g, -11.6, -11.6, 23.2, 14.6, 1.8); g.clip(); g.strokeStyle = 'rgba(20,20,26,0.6)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-11.6, -4.6); g.lineTo(11.6, -4.6); g.moveTo(0, -11.6); g.lineTo(0, -4.6); g.stroke(); g.fillStyle = 'rgba(150,80,40,0.35)'; ell(g, -7.4, 0.6, 2, 1.2); g.fill(); g.restore();
    rr(g, -11.6, -11.6, 23.2, 14.6, 1.8); outline(g, 0.65);
    mch_rivets(g, [[-10.4, -10.4], [10.4, -10.4], [-10.4, 1.8], [10.4, 1.8], [-10.4, -4.6], [10.4, -4.6], [-1.4, -10.4], [1.4, -10.4]], 0.32);
    if (!back) {
      // two red lamps under angry iron brows, a gnashing jaw with the furnace glowing behind it
      for (const s of [-1, 1]) {
        const lx = s * 5.4 + e.facing.x * 0.8, ly = -8;
        const lp = 0.7 + Math.sin(time * 8 + s) * 0.25, lg = g.createRadialGradient(lx, ly, 0.3, lx, ly, 4.6); lg.addColorStop(0, `rgba(255,90,60,${lp})`); lg.addColorStop(1, 'rgba(255,60,40,0)'); g.fillStyle = lg; ell(g, lx, ly, 4.6, 4.6); g.fill();
        ell(g, lx, ly, 2.3, 2.1); g.fillStyle = '#3a3a42'; g.fill(); outline(g, 0.4); ell(g, lx, ly, 1.6, 1.5); g.fillStyle = rfill(g, '#ff4a3a', lx, ly, 1.6); g.fill(); ell(g, lx - 0.5, ly - 0.5, 0.5, 0.5); g.fillStyle = '#ffe0d0'; g.fill();
        g.beginPath(); g.moveTo(lx - s * 3.4, ly - 3.6); g.lineTo(lx + s * 2.8, ly - 1.8); g.lineTo(lx + s * 2.8, ly - 0.8); g.lineTo(lx - s * 3.4, ly - 2.4); g.closePath(); g.fillStyle = vfill(g, '#3a3a42', ly - 3.6, ly - 0.8); g.fill(); outline(g, 0.35);
      }
      const drop = 0.5 + Math.max(0, Math.sin(time * 7)) * 0.5 + hit * 3.2, mx = e.facing.x * 0.6;
      rr(g, -7.6 + mx, -3.6, 15.2, 4.4 + drop, 1); g.fillStyle = '#2a1410'; g.fill();
      const fg = g.createRadialGradient(mx, -0.6 + drop * 0.5, 0.3, mx, -0.6 + drop * 0.5, 6); fg.addColorStop(0, `rgba(255,200,90,${0.7 + hit * 0.3})`); fg.addColorStop(1, 'rgba(255,90,30,0.2)'); g.fillStyle = fg; rr(g, -7.2 + mx, -3.2, 14.4, 3.8 + drop, 1); g.fill();
      rr(g, -8 + mx, -4.6, 16, 1.8, 0.6); g.fillStyle = vfill(g, '#4e4e58', -4.6, -2.8); g.fill(); outline(g, 0.45);
      g.fillStyle = '#e8e4d8'; for (let k = 0; k < 7; k++) { const x = -6.3 + k * 2.1 + mx; g.beginPath(); g.moveTo(x - 0.8, -2.9); g.lineTo(x, -0.9); g.lineTo(x + 0.8, -2.9); g.closePath(); g.fill(); outline(g, 0.25); }
      g.save(); g.translate(0, drop);
      g.fillStyle = '#e8e4d8'; for (let k = 0; k < 6; k++) { const x = -5.2 + k * 2.1 + mx; g.beginPath(); g.moveTo(x - 0.8, 0.6); g.lineTo(x, -1.4); g.lineTo(x + 0.8, 0.6); g.closePath(); g.fill(); outline(g, 0.25); }
      rr(g, -8 + mx, 0.4, 16, 2.4, 0.7); g.fillStyle = vfill(g, '#4e4e58', 0.4, 2.8); g.fill(); outline(g, 0.45); mch_rivets(g, [[-6.6 + mx, 1.6], [6.6 + mx, 1.6]], 0.28);
      g.restore();
    } else {
      // from behind: the boiler's round end, a brass ring and the firebox door
      ell(g, 0, -4.4, 6.6, 6); g.fillStyle = rfill(g, '#4a4a52', 0, -4.4, 6.6); g.fill(); outline(g, 0.6);
      ell(g, 0, -4.4, 5, 4.5); g.strokeStyle = mch_C.BRASS; g.lineWidth = 0.9; g.stroke();
      ell(g, 0, -4, 2.8, 2.4); g.fillStyle = '#1e1a18'; g.fill(); const fl = 0.6 + Math.sin(time * 8) * 0.25; const gl = g.createRadialGradient(0, -3.8, 0.2, 0, -4, 2.6); gl.addColorStop(0, `rgba(255,220,120,${fl})`); gl.addColorStop(1, 'rgba(255,90,30,0.2)'); g.fillStyle = gl; ell(g, 0, -4, 2.3, 2); g.fill();
      g.strokeStyle = '#3a3a42'; g.lineWidth = 0.45; for (const x of [-1, 0, 1]) { g.beginPath(); g.moveTo(x, -6); g.lineTo(x, -2); g.stroke(); }
      mch_rivets(g, [0, 1, 2, 3, 4, 5, 6, 7].map(k => [Math.cos(k / 8 * mch_TAU) * 5.8, -4.4 + Math.sin(k / 8 * mch_TAU) * 5.3]), 0.3);
      rr(g, 3.6, -19.6, 1.8, 8, 0.5); g.fillStyle = mch_hfill(g, '#3a3a42', 3.6, 5.4); g.fill(); outline(g, 0.4); rr(g, 3, -20.6, 3, 1.3, 0.5); g.fillStyle = mch_C.BRASS; g.fill(); outline(g, 0.3);
    }
    // the arms at its sides, claws forward; one sweeps across the front on an attack
    for (const s of [-1, 1]) {
      const swinging = sw >= 0 && s > 0 && !back, A = swinging ? lerp(-0.9, 2.5, ease(sw)) : armRest(s);
      g.save(); g.translate(s * 12.6, -7.4); g.scale(1, swinging ? 1 : 0.85); g.translate(-s * 12.6, 7.4);
      mch_gnArm(g, s * 12.6, -7.4, A, swinging ? hit * 2 : 0, swinging ? 0.3 + hit * 0.7 : 0.15, back);
      g.restore();
      if (swinging) { swoosh(g, 12.6, -7.4 + rumble, 1.1, sw, 15); mch_impact(g, 12.6 + Math.cos(A) * 17, -7.4 + Math.sin(A) * 17, 3.4, sw > 0.3 && sw < 0.85 ? Math.sin((sw - 0.3) / 0.55 * Math.PI) : 0); }
    }
    g.restore();
    mch_smoke(g, back ? 4.5 : -6.6, (back ? -21.6 : -26.4) + rumble, 1.8, 5, mv ? 1 : 0.6, false, e.seed);
  }
  function mch_gnasher(g, e) {
    const f = face4(e), sw = swingOf(e);
    g.save(); shadow(g, 0, 11.4, 19, 4.4, 0.32);
    if (f === 'left') g.scale(-1, 1);
    if (f === 'down' || f === 'up') mch_gnEnd(g, e, sw, f === 'up'); else mch_gnSide(g, e, sw);
    g.restore();
  }


  // ================= THE GOLEMS =================
  // a smooth rounded outline through a list of points (rock shapes)
  function mch_blob(g, pts) {
    const n = pts.length, mid = i => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
    g.beginPath(); const m0 = mid(n - 1); g.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const m = mid(i); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
    g.closePath();
  }
  // a six-sided crystal growing out of rock: a lit face, a shadowed face, a bright tip
  function mch_crystal(g, x, y, h, w, a, C) {
    g.save(); g.translate(x, y); g.rotate(a);
    const sh = -h * 0.74, r = w * 0.08;
    g.beginPath(); g.moveTo(-w / 2, 0.8); g.lineTo(-w / 2, sh); g.lineTo(0, -h); g.lineTo(r, sh * 0.96); g.lineTo(r, 0.8); g.closePath(); g.fillStyle = C[0]; g.fill();
    g.beginPath(); g.moveTo(r, 0.8); g.lineTo(r, sh * 0.96); g.lineTo(0, -h); g.lineTo(w / 2, sh); g.lineTo(w / 2, 0.8); g.closePath(); g.fillStyle = C[2]; g.fill();
    g.beginPath(); g.moveTo(-w / 2, sh); g.lineTo(0, -h); g.lineTo(r, sh * 0.96); g.closePath(); g.fillStyle = C[1]; g.fill();
    g.beginPath(); g.moveTo(-w / 2, 0.8); g.lineTo(-w / 2, sh); g.lineTo(0, -h); g.lineTo(w / 2, sh); g.lineTo(w / 2, 0.8); outline(g, Math.min(0.5, w * 0.2));
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = w * 0.09; g.beginPath(); g.moveTo(-w * 0.3, -h * 0.15); g.lineTo(-w * 0.3, sh * 0.92); g.stroke();
    g.restore();
  }
  // a nugget of ore set in rock: a dark rim, the metal, a bright facet
  function mch_nugget(g, x, y, r, C, tw) {
    const hex = rr2 => { g.beginPath(); for (let j = 0; j < 6; j++) { const t = (tw || 0) + j / 6 * mch_TAU, q = rr2 * (0.86 + ((j * 7) % 3) * 0.08); const px = x + Math.cos(t) * q, py = y + Math.sin(t) * q * 0.85; j ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); };
    hex(r); g.fillStyle = C.deep; g.fill(); hex(r * 0.74); g.fillStyle = C.mid; g.fill();
    g.fillStyle = C.hi; g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.05); g.lineTo(x - r * 0.1, y - r * 0.55); g.lineTo(x + r * 0.32, y - r * 0.22); g.closePath(); g.fill();
  }
  // a glowing seam of ore running through the rock
  function mch_vein(g, pts, rgb, w, a, smooth) {
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); if (smooth) { for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); } else pts.forEach(([x, y], i) => i && g.lineTo(x, y)); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    path(); g.strokeStyle = `rgba(${rgb},${0.3 * a})`; g.lineWidth = w * 3.2; g.stroke();
    path(); g.strokeStyle = 'rgba(20,16,24,0.7)'; g.lineWidth = w * 1.5; g.stroke();
    path(); g.strokeStyle = `rgba(${rgb},${0.95 * a})`; g.lineWidth = w; g.stroke();
  }
  function mch_glow(g, x, y, r, rgb, a) { const gl = g.createRadialGradient(x, y, r * 0.05, x, y, r); gl.addColorStop(0, `rgba(${rgb},${a})`); gl.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gl; ell(g, x, y, r, r); g.fill(); }
  // a little lightning crackle
  function mch_bolt3(g, pts, a) {
    if (a <= 0.05) return; g.lineCap = 'round'; g.lineJoin = 'round';
    const path = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
    path(); g.strokeStyle = `rgba(190,150,255,${0.45 * a})`; g.lineWidth = 1.6; g.stroke();
    path(); g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 0.45; g.stroke();
  }

  // ---------- the mithril and stormstone golems: boulder bodies woken out of the giant ores ----------
  const mch_MITH = { smooth: true, stone: '#7a8aa0', light: '#a3b3c8', dark: '#4f5c6c', vein: '170,215,255', eye: '#d8f0ff', eyeRgb: '160,215,255', gold: true, storm: false,
    crys: ['#c4dcf6', '#f2f8ff', '#6f98cc'], ore: { deep: '#2f3d5a', mid: '#7fb0e8', hi: '#eef6ff' } };
  const mch_STORM = { stone: '#5f4f96', light: '#8676c4', dark: '#3a2f62', vein: '205,170,255', eye: '#f2e8ff', eyeRgb: '210,170,255', gold: false, storm: true,
    crys: ['#d4c0ff', '#f6f0ff', '#8a6ad8'], ore: { deep: '#2c2350', mid: '#b48cf0', hi: '#f4ecff' } };
  function mch_golemFist(g, x, y, k, G, s, back, dim) {
    g.save(); g.translate(x, y); g.scale(k * s, k);
    mch_blob(g, [[-3.6, -3.2], [0.4, -4], [3.8, -2.6], [4.2, 1.4], [2.4, 3.8], [-1.6, 3.9], [-4, 1.6]]);
    g.fillStyle = rfill(g, dim ? shade(G.stone, -0.2) : G.stone, 0, 0, 4.4); g.fill(); outline(g, 0.6);
    g.strokeStyle = 'rgba(20,16,24,0.5)'; g.lineWidth = 0.35;
    if (!back) { for (const t of [-1.6, 0.2, 2]) { g.beginPath(); g.arc(t, 2.4, 1, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } g.beginPath(); g.moveTo(-1.6, -1.6); g.lineTo(0, 0.2); g.lineTo(-0.6, 1.4); g.stroke(); }
    ell(g, -3.4, 0.4, 1.4, 1.8); g.fillStyle = shade(G.stone, -0.1); g.fill(); outline(g, 0.35);
    g.fillStyle = 'rgba(255,255,255,0.16)'; ell(g, -1, -2.2, 2, 1); g.fill();
    if (G.gold) { g.beginPath(); g.moveTo(-3.8, -2.4); g.quadraticCurveTo(0, -4.4, 4, -1.8); g.lineTo(3.9, -0.4); g.quadraticCurveTo(0, -2.9, -3.9, -1); g.closePath(); g.fillStyle = vfill(g, mch_C.GOLD, -4, -0.6, 0.45, -0.3); g.fill(); outline(g, 0.35); mch_rivets(g, [[-2.2, -2.2], [0.4, -2.8], [2.8, -2.2]], 0.28); }
    if (G.storm) mch_crystal(g, -1.2, -3, 3.6, 1.6, -0.5, G.crys);
    g.restore();
  }
  function mch_golem(g, e, G) {
    const f = face4(e), back = f === 'up', side = f === 'left' || f === 'right', sw = swingOf(e), mv = e.moving, wt = e.walkT || 0;
    const step = stepOf(e), bob = mv ? -Math.abs(Math.sin(wt)) * 1 : Math.sin(time * 1.8 + (e.seed || 0)) * 0.25, fx = side ? 1 : back ? 0 : e.facing.x;
    const hit = sw >= 0 ? Math.sin(sw * Math.PI) : 0, pulse = 0.6 + Math.sin(time * 3 + (e.seed || 0)) * 0.25;
    g.save(); shadow(g, 0, 11.2, 13, 3.6, 0.32);
    if (f === 'left') g.scale(-1, 1);
    // fists: floating at its sides; the forward one punches on an attack
    const fl = s => Math.sin(time * 2 + s * 1.3) * 0.45;
    const restF = s => [s * 13.6, 0.4 + bob + fl(s) + (mv ? s * step * 0.9 : 0)];
    const punch = () => side ? [13.4 + hit * 7, -1.6 + bob] : [lerp(13.6, 5, hit), lerp(0.4, 6.4, hit) + bob];
    const fists = (front) => {
      for (const s of [-1, 1]) {
        const p = s > 0 && sw >= 0 ? punch() : restF(s); if (s < 0 && sw >= 0) p[1] -= 1.4;
        mch_golemFist(g, p[0], p[1], s > 0 && sw >= 0 && !side ? 1 + hit * 0.4 : 1, G, s, back, side && s < 0);
      }
    };
    if (back) fists();
    // legs, one heavy stamp at a time
    for (const s of [-1, 1]) {
      const st = mch_step(e, s > 0 ? 0 : Math.PI, 0, 2.2), x = s * 4.6;
      rr(g, x - 2.9, 1.6 + bob * 0.5, 5.8, 7.4 - st.lift, 1.8); g.fillStyle = vfill(g, G.stone, 1.6, 9, 0.1, -0.45); g.fill(); outline(g, 0.6);
      g.strokeStyle = 'rgba(20,16,24,0.45)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(x - 1.4, 3.4); g.lineTo(x + 0.4, 5); g.lineTo(x - 0.4, 6.6); g.stroke();
      rr(g, x - 3.7, 8 - st.lift, 7.4, 3.1, 1.3); g.fillStyle = vfill(g, G.dark, 8 - st.lift, 11 - st.lift, 0.2, -0.3); g.fill(); outline(g, 0.55);
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 0.3; for (const t of [-1.2, 1.2]) { g.beginPath(); g.moveTo(x + t, 9.6 - st.lift); g.lineTo(x + t, 11 - st.lift); g.stroke(); }
      mch_dust(g, x, 11.6, 1.5, st.dust * 0.6);
    }
    g.save(); g.translate(0, bob); g.rotate(mv ? step * 0.035 : 0);
    // the boulder body: lit from the top left, a shadowed lower plane, cracks, glowing seams and nuggets of its ore
    const body = [[-10.6, -10.4], [0, -11.2], [10.6, -10.4], [12, -4.2], [8.8, 3.2], [0, 4.8], [-8.8, 3.2], [-12, -4.2]];
    mch_blob(g, body); const bg = g.createLinearGradient(-9, -11, 8, 5); bg.addColorStop(0, G.light); bg.addColorStop(0.5, G.stone); bg.addColorStop(1, G.dark); g.fillStyle = bg; g.fill();
    g.save(); mch_blob(g, body); g.clip();
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.moveTo(1, -1); g.lineTo(13, -6.4); g.lineTo(13, 6); g.lineTo(-3, 6); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(-12, -11); g.lineTo(-1, -11.6); g.lineTo(-4, -6.4); g.lineTo(-12, -3.6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(20,16,24,0.45)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-11, -4); g.lineTo(-7.6, -3); g.lineTo(-6.4, 0.6); g.moveTo(9.4, -9.6); g.lineTo(8, -6.6); g.stroke();
    if (!back) {
      g.strokeStyle = 'rgba(20,16,24,0.5)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-12, -2.6); g.quadraticCurveTo(-6, -1.4, -4.2, 4.8); g.moveTo(12, -3.4); g.quadraticCurveTo(6.4, -2, 4.4, 4.8); g.moveTo(-3.4, -11); g.quadraticCurveTo(0, -9, 3.4, -11); g.stroke();
      mch_vein(g, [[-8.4, -8.4], [-5.4, -5.8], [-6.4, -2.4], [-3.8, 1.6]], G.vein, 0.75, pulse + 0.3, G.smooth);
      mch_vein(g, [[8.8, -7.6], [5.8, -4.6], [7.2, -1.2], [5.2, 2.6]], G.vein, 0.75, pulse + 0.3, G.smooth);
      mch_nugget(g, -7.6, -0.6, 1.3, G.ore, 0.3); mch_nugget(g, 6.6, 1.8, 1.1, G.ore, 0.9); mch_nugget(g, 2.6, -8.6, 0.9, G.ore, 0.5);
      if (G.smooth) for (let k = 0; k < 3; k++) { const tw = Math.max(0, Math.sin(time * 3 + k * 2.1 + (e.seed || 0))); if (tw > 0.3) sparkle(g, [-7.6, 6.6, 2.6][k] - 0.6, [-0.6, 1.8, -8.6][k] - 0.8, 1.3 * tw, `rgba(255,255,255,${0.9 * tw})`); }
      // the heart-ore in its chest
      mch_glow(g, 0, -3.4, 6.4, G.eyeRgb, 0.6 * pulse + 0.15 + hit * 0.3);
      mch_nugget(g, 0, -3.4, 3, G.ore, 0.1); ell(g, -0.7, -4.4, 0.7, 0.7); g.fillStyle = '#ffffff'; g.fill();
    } else {
      mch_vein(g, [[-7, -8.6], [-3.4, -5], [-5, -1], [-2, 2.4]], G.vein, 0.7, pulse + 0.2, G.smooth);
      mch_vein(g, [[7.4, -8], [4, -3.6], [6, 1.6]], G.vein, 0.7, pulse + 0.2, G.smooth);
      mch_nugget(g, 6.4, -6.6, 1.2, G.ore, 0.4); mch_nugget(g, -6.8, 1, 1, G.ore, 0.2);
    }
    g.restore(); mch_blob(g, body); outline(g, 0.75);
    // crystals out of its shoulders (and down its back from behind)
    const sets = G.storm ? [[0.2, 8, 2.7], [0.8, 5.8, 2.2], [-0.3, 5.2, 1.9], [1.25, 3.8, 1.6]] : [[0.25, 5.8, 2.3], [0.85, 4.2, 1.8], [-0.3, 3.8, 1.5]];
    for (const s of [-1, 1]) for (const [a, h, w] of sets) { const k = side && s < 0 ? 0.8 : 1; mch_crystal(g, s * (8.6 + a * 1.4), -9.2 + Math.abs(a) * 1.2, h * k, w * k, s * a, side && s < 0 ? [shade(G.crys[0], -0.25), shade(G.crys[1], -0.2), shade(G.crys[2], -0.25)] : G.crys); }
    if (back) for (const [x, h] of [[-2.4, 4.2], [0.4, 5.4], [3, 3.8]]) mch_crystal(g, x, -6 + Math.abs(x) * 0.2, h, 1.8, x * 0.06, G.crys);
    // the head: a block sunk between the shoulders, a heavy brow, two glowing eyes, a crack of a mouth
    const hx = fx * 1.2;
    mch_blob(g, [[-4.8 + hx * 0.3, -11.4], [-5 + hx * 0.3, -16], [-1.6 + hx * 0.4, -18.6], [2.4 + hx * 0.4, -18.4], [5.2 + hx * 0.3, -15.6], [4.8 + hx * 0.3, -11.2], [0 + hx * 0.3, -9.6]]);
    g.fillStyle = vfill(g, G.light, -18.6, -9.6, 0.15, -0.35); g.fill(); outline(g, 0.6);
    g.fillStyle = 'rgba(255,255,255,0.14)'; ell(g, -1.6 + hx * 0.4, -17, 2.2, 0.9, -0.2); g.fill();
    if (!back) {
      for (const s of [-1, 1]) { const ex = s * 2.1 + hx, ey = -13; ell(g, ex, ey, 1.6, 1.1); g.fillStyle = '#16121c'; g.fill(); mch_glow(g, ex, ey, 2.8, G.eyeRgb, 0.7 * pulse + 0.25 + hit * 0.3); ell(g, ex + s * 0.1, ey + 0.1, 1.05, 0.55 + hit * 0.25); g.fillStyle = G.eye; g.fill(); ell(g, ex - 0.25, ey - 0.05, 0.3, 0.22); g.fillStyle = '#ffffff'; g.fill(); }
      g.beginPath(); g.moveTo(-5.4 + hx, -15.4); g.lineTo(-0.6 + hx, -13.9); g.lineTo(0.6 + hx, -13.9); g.lineTo(5.4 + hx, -15.4); g.lineTo(5 + hx, -16.6); g.lineTo(0 + hx, -15.4); g.lineTo(-5 + hx, -16.6); g.closePath();
      g.fillStyle = vfill(g, G.stone, -16.6, -13.9, 0.25, -0.25); g.fill(); outline(g, 0.4);
      g.strokeStyle = 'rgba(20,16,24,0.75)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-2.2 + hx, -10.9); g.lineTo(-1.1 + hx, -10.4 - hit * 0.5); g.lineTo(0 + hx, -11); g.lineTo(1.1 + hx, -10.4 - hit * 0.5); g.lineTo(2.2 + hx, -10.9); g.stroke();
    } else { g.strokeStyle = 'rgba(20,16,24,0.4)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-2, -17.4); g.lineTo(-0.6, -14.4); g.lineTo(-1.4, -12); g.stroke(); }
    if (G.storm) for (const [x, h, a] of [[-2.6, 3.4, -0.35], [0, 4.8, 0], [2.6, 3, 0.35]]) mch_crystal(g, x + hx * 0.4, -17.6 + Math.abs(x) * 0.25, h, 1.6, a, G.crys);
    if (G.storm) {
      const z = Math.sin(time * 9 + wt * 2 + (e.seed || 0));
      mch_bolt3(g, [[-9.2, -15.6], [-7.4, -13], [-8.6, -11.6], [-6, -8.6]], z > -0.3 ? 0.9 : 0);
      mch_bolt3(g, [[9.6, -16.2], [7.6, -13.6], [9, -12], [6.4, -9.6]], z < 0.3 ? 0.9 : 0);
    }
    g.restore();
    if (!back) fists();
    if (sw >= 0) {
      if (side) { swoosh(g, 6, -3 + bob, 0.1, sw, 14); mch_speed(g, 13.4 + hit * 7 - 3, -1.6 + bob, 6, [[-2.4, 0.7], [0, 1], [2.4, 0.7]], 0.55 * hit); mch_impact(g, 20.4 + hit * 2, -1.6 + bob, 3.4, sw > 0.3 && sw < 0.85 ? Math.sin((sw - 0.3) / 0.55 * Math.PI) : 0); }
      else { swoosh(g, 4, -4 + bob, Math.atan2(e.facing.y, Math.abs(e.facing.x) || 0.0001), sw, 12); mch_impact(g, 5, 10.4 + bob, 4, sw > 0.3 && sw < 0.85 ? Math.sin((sw - 0.3) / 0.55 * Math.PI) : 0); }
    }
    g.restore();
  }
  const mch_mithrilGolem = (g, e) => mch_golem(g, e, mch_MITH);
  const mch_stormGolem = (g, e) => mch_golem(g, e, mch_STORM);

  // ---------- the little golem: three stacked stones on stubby feet, glowing eyes, a red chip held proudly over its head ----------
  const mch_LING = { leg: '#3a352e', low: '#4f4940', mid: '#5c554b', top: '#6a6358', rim: '#e0452e' };
  function mch_golemling(g, e) {
    const f = face4(e), back = f === 'up', side = f === 'left' || f === 'right', sw = swingOf(e), mv = e.moving, wt = e.walkT || 0;
    const hop = sw >= 0 ? Math.sin(sw * Math.PI) : 0, bob = (mv ? -Math.abs(Math.sin(wt * 1.3)) * 1.4 : Math.sin(time * 3 + (e.seed || 0)) * 0.3) - hop * 2.4;
    const fx = side ? 1 : back ? 0 : e.facing.x, p = 0.6 + Math.sin(time * 6 + (e.seed || 0)) * 0.3;
    g.save(); shadow(g, 0, 11, 7.4 - hop, 2.6, 0.3);
    if (f === 'left') g.scale(-1, 1);
    for (const s of [-1, 1]) { const st = mch_step(e, s > 0 ? 0 : Math.PI, 0, 1.6), x = s * 3; ell(g, x, 9.4 - st.lift + (hop ? -hop * 1.2 : 0), 2.8, 1.9); g.fillStyle = vfill(g, mch_LING.leg, 7.6, 11.2, 0.2, -0.3); g.fill(); outline(g, 0.5); }
    g.save(); g.translate(0, bob); g.rotate(mv ? Math.sin(wt * 1.3) * 0.07 : 0);
    const chipY = -17.6 - hop * 2;
    if (back) { for (const s of [-1, 1]) mch_hand(g, s * 3.4, chipY + 1.8, 1.5, '#5c554b'); }
    // the stones, each with a glowing red rim where it sits on the one below
    const stone = (y, rx, ry, c, seed) => {
      mch_blob(g, [[-rx, y - ry * 0.2], [-rx * 0.6, y - ry], [rx * 0.3, y - ry * 1.05], [rx, y - ry * 0.4], [rx * 0.9, y + ry * 0.6], [0, y + ry], [-rx * 0.85, y + ry * 0.7]]);
      g.fillStyle = rfill(g, c, -rx * 0.2, y - ry * 0.2, Math.max(rx, ry)); g.fill(); g.strokeStyle = `rgba(255,90,60,${0.3 * p})`; g.lineWidth = 1.5; g.stroke(); outline(g, 0.75); g.strokeStyle = mch_LING.rim; g.lineWidth = 0.35; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.13)'; ell(g, -rx * 0.35, y - ry * 0.45, rx * 0.4, ry * 0.25, -0.3); g.fill();
      g.strokeStyle = 'rgba(20,16,12,0.45)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(rx * 0.5, y - ry * 0.3 + seed); g.lineTo(rx * 0.2, y + ry * 0.2); g.stroke();
    };
    const rim = (y, rx) => { g.save(); g.lineCap = 'round'; g.strokeStyle = `rgba(255,90,60,${0.35 * p})`; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, y, rx, rx * 0.28, 0, 0.1, Math.PI - 0.1); g.stroke(); g.strokeStyle = mch_LING.rim; g.lineWidth = 0.55; g.stroke(); g.restore(); };
    stone(4.2, 7.2, 5, mch_LING.low, 0); rim(0.2, 5.4);
    stone(-2.8, 5.8, 3.9, mch_LING.mid, 0.4); rim(-6.2, 4.2);
    stone(-8.8, 4.6, 3.5, mch_LING.top, 0.2);
    g.fillStyle = '#5f8a3a'; ell(g, -1.2, -12, 2.6, 0.9, -0.15); g.fill(); g.fillStyle = '#7aa84a'; ell(g, -1.6, -12.3, 1.3, 0.5); g.fill();
    if (!back) {
      for (const s of [-1, 1]) { const ex = s * 1.7 + fx * 1.3, ey = -9; mch_glow(g, ex, ey, 2, '255,150,70', 0.6 * p); ell(g, ex, ey, 1, 1.15); g.fillStyle = '#ff9a4a'; g.fill(); ell(g, ex - 0.3, ey - 0.35, 0.38, 0.38); g.fillStyle = '#fff0c0'; g.fill(); }
      g.strokeStyle = 'rgba(20,14,10,0.7)'; g.lineWidth = 0.4; g.beginPath(); g.arc(fx * 1.3, -7.6, 1, 0.3, Math.PI - 0.3); g.stroke();
    }
    // the chip held up high in two little stone hands
    mch_glow(g, 0, chipY, 7, '255,110,70', 0.55 + 0.35 * p + hop * 0.3);
    g.beginPath(); g.moveTo(-3, chipY + 1.6); g.lineTo(-0.8, chipY - 3); g.lineTo(2.8, chipY - 1.8); g.lineTo(2.2, chipY + 2); g.closePath(); g.fillStyle = vfill(g, '#ff5a3c', chipY - 3, chipY + 2, 0.45, -0.3); g.fill(); outline(g, 0.45);
    g.fillStyle = '#ffd0a0'; g.beginPath(); g.moveTo(-1.6, chipY + 0.2); g.lineTo(-0.6, chipY - 2); g.lineTo(0.8, chipY - 1); g.closePath(); g.fill();
    if (hop > 0.2) { sparkle(g, -3.6, chipY - 2.6, 1.4 * hop, 'rgba(255,240,200,0.95)'); sparkle(g, 3.8, chipY - 1.4, 1 * hop, 'rgba(255,240,200,0.95)'); }
    if (!back) { for (const s of [-1, 1]) mch_hand(g, s * 3.2, chipY + 1.4, 1.5, '#5c554b'); }
    g.restore(); g.restore();
  }

  // ---------- the Ginormous Golem: the mountain stood up. Snow on his shoulder peaks, pines and moss on his slopes,
  // the heartstone burning in his chest, a gold-edged brow; harmless, but his fists shake the floor ----------
  const mch_GG = { stone: '#6d665c', light: '#8f877a', dark: '#4f4940', deep: '#3d3831', moss: '#5f8a3a', mossL: '#7aa84a', pine: '#2f5a32' };
  function mch_heart(g, x, y, s) { g.beginPath(); g.moveTo(x, y + s * 1.2); g.bezierCurveTo(x - s * 2.2, y - s * 0.2, x - s * 1.2, y - s * 1.9, x, y - s * 0.8); g.bezierCurveTo(x + s * 1.2, y - s * 1.9, x + s * 2.2, y - s * 0.2, x, y + s * 1.2); g.closePath(); }
  function mch_pine(g, x, y, h) { rr(g, x - 0.18, y - 0.5, 0.36, 0.9, 0.1); g.fillStyle = '#4a3218'; g.fill(); for (let k = 0; k < 3; k++) { const yy = y - k * h * 0.28, w = h * (0.42 - k * 0.1); g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x, yy - h * 0.5); g.lineTo(x + w, yy); g.closePath(); g.fillStyle = k === 2 ? '#3f7a40' : mch_GG.pine; g.fill(); } g.beginPath(); g.moveTo(x - h * 0.42, y); g.lineTo(x, y - h * 1.05); g.lineTo(x + h * 0.42, y); g.closePath(); outline(g, 0.2); }
  function mch_ggFist(g, x, y, s, k, back) {
    g.save(); g.translate(x, y); g.scale(s * k, k);
    mch_blob(g, [[-4.6, -3.8], [0.4, -4.8], [4.6, -3.2], [5.2, 1.6], [3, 4.6], [-2, 4.8], [-5, 2]]);
    g.fillStyle = rfill(g, mch_GG.light, 0, 0, 5.4); g.fill(); outline(g, 0.45);
    g.strokeStyle = 'rgba(30,24,18,0.5)'; g.lineWidth = 0.28; if (!back) for (const t of [-2.2, 0.2, 2.6]) { g.beginPath(); g.arc(t, 3, 1.3, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    ell(g, -4.2, 0.6, 1.7, 2.2); g.fillStyle = shade(mch_GG.stone, 0.05); g.fill(); outline(g, 0.3);
    g.beginPath(); g.moveTo(-4.6, -2.8); g.quadraticCurveTo(0.4, -5.6, 5, -2.2); g.lineTo(4.9, -0.4); g.quadraticCurveTo(0.4, -3.6, -4.7, -0.9); g.closePath(); g.fillStyle = vfill(g, mch_C.GOLD, -5, -0.6, 0.5, -0.3); g.fill(); outline(g, 0.3);
    g.strokeStyle = '#f5d76e'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(-4.4, -2.5); g.quadraticCurveTo(0.4, -5.2, 4.8, -2); g.stroke();
    mch_rivets(g, [[-2.8, -2.6], [0.4, -3.4], [3.4, -2.4]], 0.26);
    g.fillStyle = mch_GG.moss; ell(g, 1.4, -4.4, 2, 0.7, 0.2); g.fill();
    g.restore();
  }
  function mch_ginormous(g, e) {
    const f = face4(e), back = f === 'up', side = f === 'left' || f === 'right', sw = swingOf(e), mv = e.moving, wt = e.walkT || 0;
    const step = stepOf(e), bob = mv ? -Math.abs(Math.sin(wt)) * 0.7 : Math.sin(time * 1.2 + (e.seed || 0)) * 0.2, fx = side ? 1 : back ? 0 : e.facing.x;
    const pulse = 0.75 + Math.sin(time * 3.2) * 0.25;
    // the slam: fists up beside the head, down onto the floor, then the floor rings
    const up = sw >= 0 && sw < 0.3 ? ease(sw / 0.3) : 0, down = sw >= 0.3 && sw < 0.5 ? ease((sw - 0.3) / 0.2) : sw >= 0.5 ? 1 : 0, ring = sw >= 0.45 ? (sw - 0.45) / 0.55 : -1;
    g.save(); g.translate(0, 3.4); shadow(g, 0, 11.3, 21, 4.4, 0.36);
    if (f === 'left') g.scale(-1, 1);
    if (ring >= 0) {
      const rx = 9 + ring * 26, a = (1 - ring) * 0.85;
      g.strokeStyle = `rgba(255,248,225,${a})`; g.lineWidth = 0.9; ell(g, side ? 10 : 0, 10.6, rx, rx * 0.3); g.stroke();
      g.strokeStyle = `rgba(196,172,128,${a * 0.8})`; g.lineWidth = 1.6; ell(g, side ? 10 : 0, 10.6, rx * 0.7, rx * 0.21); g.stroke();
      for (let k = 0; k < 7; k++) { const t = k / 7 * Math.PI + 0.2, d = 6 + ring * 18; const x = (side ? 10 : 0) + Math.cos(t) * d * (k % 2 ? 1 : 0.8), y = 10.4 - Math.sin(t) * d * 0.3 - Math.sin(ring * Math.PI) * (3 + k % 3); ell(g, x, y, 0.8 + (k % 3) * 0.3, 0.6 + (k % 2) * 0.3); g.fillStyle = `rgba(110,100,88,${1 - ring})`; g.fill(); }
    }
    const fistAt = s => {
      if (sw < 0) return [s * 16.4 + (side ? 2 : 0), 1.6 + bob + Math.sin(time * 1.6 + s) * 0.5 + (mv ? s * step * 1 : 0)];
      const rest = [s * 16.4, 1.6], top = side ? [6 + s * 4, -25] : [s * 12, -25], hitP = side ? [12 + s * 3.4, 7.6 + (s < 0 ? -1 : 0)] : [s * 9.4, 7.6];
      if (down <= 0) return [lerp(rest[0], top[0], up), lerp(rest[1], top[1], up) + bob];
      return [lerp(top[0], hitP[0], down), lerp(top[1], hitP[1], down) + bob];
    };
    if (back) for (const s of [-1, 1]) { const p = fistAt(s); mch_ggFist(g, p[0], p[1], s, 1, true); }
    if (side) { const p = fistAt(-1); g.save(); mch_ggFist(g, p[0], p[1], -1, 0.9, false); g.restore(); }
    // legs: two pillars of rock, a heavy step each
    for (const s of [-1, 1]) {
      const st = mch_step(e, s > 0 ? 0 : Math.PI, 0, 1.8), x = s * 6.4;
      rr(g, x - 4.4, -1 + bob * 0.4, 8.8, 10 - st.lift, 2.6); g.fillStyle = vfill(g, mch_GG.stone, -1, 9, 0.1, -0.45); g.fill(); outline(g, 0.5);
      g.strokeStyle = 'rgba(30,24,18,0.4)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(x - 3, 2.4); g.quadraticCurveTo(x, 3.4, x + 3.6, 2); g.stroke();
      mch_blob(g, [[x - 5.6, 8.4 - st.lift], [x, 7.6 - st.lift], [x + 5.6, 8.4 - st.lift], [x + 5.4, 11.2 - st.lift], [x - 5.4, 11.2 - st.lift]]); g.fillStyle = vfill(g, mch_GG.dark, 7.6 - st.lift, 11.2 - st.lift, 0.2, -0.3); g.fill(); outline(g, 0.45);
      g.fillStyle = mch_GG.moss; ell(g, x - 2, 8.2 - st.lift, 1.8, 0.5); g.fill();
      mch_dust(g, x, 11.4, 2.2, st.dust * 0.6);
    }
    g.save(); g.translate(0, bob); g.rotate(mv ? step * 0.02 : 0);
    // the mountain of his body
    const body = [[-15.4, 6], [-16.6, -1], [-14.4, -9], [-12.4, -14.2], [-9.4, -20.4], [-6.4, -16.6], [0, -17.2], [6.4, -16.6], [9.4, -20.4], [12.4, -14.2], [14.4, -9], [16.6, -1], [15.4, 6], [0, 8.2]];
    mch_blob(g, body); const bg = g.createLinearGradient(-14, -17, 12, 7); bg.addColorStop(0, mch_GG.light); bg.addColorStop(0.5, mch_GG.stone); bg.addColorStop(1, mch_GG.dark); g.fillStyle = bg; g.fill();
    g.save(); mch_blob(g, body); g.clip();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(3, -4); g.lineTo(18, -10); g.lineTo(18, 8); g.lineTo(-2, 8); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,245,225,0.12)'; g.beginPath(); g.moveTo(-15, -10); g.lineTo(-9.4, -20.4); g.lineTo(-7, -11); g.lineTo(-15, -2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(30,24,18,0.22)'; g.lineWidth = 0.6; for (const y of [-8.4, -2, 3.4]) { g.beginPath(); g.moveTo(-18, y + 1); g.quadraticCurveTo(0, y + 2.8, 18, y - 0.6); g.stroke(); }
    g.strokeStyle = 'rgba(30,24,18,0.45)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(-13, -6); g.lineTo(-10.6, -4); g.lineTo(-11.6, -1.4); g.moveTo(12, 0); g.lineTo(10, 2.4); g.stroke();
    // moss down his slopes
    g.fillStyle = mch_GG.moss; for (const [x, y, rx, ry, a] of [[-12.4, -11, 3.8, 1.7, -1.1], [12, -10.6, 3.6, 1.6, 1.1], [-15, -2, 1.6, 3, 0.2], [10.6, 3, 2.4, 1, 0.3], [-4, -15.8, 2.4, 0.8, 0]]) { ell(g, x, y, rx, ry, a); g.fill(); }
    g.fillStyle = mch_GG.mossL; for (const [x, y, rx, ry, a] of [[-12.8, -11.8, 1.6, 0.6, -1.1], [11.6, -11.4, 1.4, 0.5, 1.1]]) { ell(g, x, y, rx, ry, a); g.fill(); }
    g.restore(); mch_blob(g, body); outline(g, 0.6);
    // snow on his shoulder peaks, pines on his slopes
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 11.6, -16.2); g.quadraticCurveTo(s * 10.2, -19.6, s * 9.5, -19.7); g.quadraticCurveTo(s * 8.8, -19.6, s * 7.4, -17.4); g.lineTo(s * 8.2, -17); g.lineTo(s * 8.9, -17.7); g.lineTo(s * 9.7, -16.8); g.lineTo(s * 10.6, -17.4); g.closePath();
      g.fillStyle = vfill(g, '#f4f6fa', -20, -16.6, 0.2, -0.12); g.fill(); outline(g, 0.3);
    }
    for (const [x, y, h] of back ? [[-11.6, -12.4, 2.6], [-9.4, -11.4, 2], [10.6, -12, 2.4], [12.8, -9.6, 1.8], [-2, -9.6, 2], [2.6, -9, 2.2]] : [[-12.8, -12, 2.6], [-10.4, -11.6, 2], [-14.6, -8, 1.8], [12.8, -11, 2.2]]) mch_pine(g, x, y, h);
    if (!back) {
      // the furnace and the heartstone
      mch_glow(g, 0, -4.6, 10, '255,130,60', 0.5 * pulse + (sw >= 0 ? 0.2 : 0));
      ell(g, 0, -4.6, 5.4, 4.6); g.fillStyle = mch_GG.deep; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke(); g.strokeStyle = mch_C.GOLD; g.lineWidth = 0.9; g.stroke();
      g.strokeStyle = '#f5d76e'; g.lineWidth = 0.25; g.beginPath(); g.ellipse(0, -4.6, 5.2, 4.4, 0, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
      mch_rivets(g, [0, 1, 2, 3, 4, 5, 6, 7].map(k => [Math.cos(k / 8 * mch_TAU + 0.4) * 5.4, -4.6 + Math.sin(k / 8 * mch_TAU + 0.4) * 4.6]), 0.3);
      const hg = g.createRadialGradient(-0.8, -5.6, 0.2, 0, -4.6, 3.6); hg.addColorStop(0, '#ffe8b0'); hg.addColorStop(0.45, '#ff7a2a'); hg.addColorStop(1, '#b8281a');
      mch_heart(g, 0, -4.4, 1.9 + pulse * 0.12); g.fillStyle = hg; g.fill(); outline(g, 0.3);
      ell(g, -0.9, -5.4, 0.5, 0.4); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
    } else {
      g.strokeStyle = 'rgba(30,24,18,0.35)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -14); g.lineTo(-0.8, -8); g.lineTo(0.6, -2); g.lineTo(-0.4, 4); g.stroke();
    }
    // the head between the peaks
    const hx = fx * 1.4;
    rr(g, -5.2 + hx * 0.4, -26.4, 10.4, 10.6, 2.8); g.fillStyle = vfill(g, mch_GG.light, -26.4, -15.8, 0.12, -0.35); g.fill(); outline(g, 0.5);
    g.fillStyle = 'rgba(255,245,225,0.14)'; rr(g, -4.4 + hx * 0.4, -25.8, 4.4, 2, 1); g.fill();
    if (!back) {
      rr(g, -5.4 + hx, -23.2, 10.8, 2.2, 0.6); g.fillStyle = vfill(g, mch_GG.deep, -23.2, -21); g.fill(); outline(g, 0.35);
      g.fillStyle = mch_C.GOLD; g.fillRect(-5.4 + hx, -23.6, 10.8, 0.8); g.fillStyle = '#f5d76e'; g.fillRect(-5.4 + hx, -23.6, 10.8, 0.25);
      const eyeA = 0.75 + Math.sin(time * 6) * 0.2;
      for (const s of [-1, 1]) { const ex = s * 2.5 + hx, ey = -19.8; mch_glow(g, ex, ey, 2.8, '255,170,70', eyeA); ell(g, ex, ey, 1.3, 0.75 + (sw >= 0 ? 0.25 : 0)); g.fillStyle = '#fff0c0'; g.fill(); ell(g, ex, ey, 0.5, 0.5); g.fillStyle = '#ff7a1a'; g.fill(); }
      g.strokeStyle = mch_GG.deep; g.lineWidth = 0.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-2.6 + hx, -17.4); g.lineTo(-0.8 + hx, -17 - (sw >= 0 ? 0.6 : 0)); g.lineTo(0.8 + hx, -17.5); g.lineTo(2.4 + hx, -17.1); g.stroke();
    } else { g.fillStyle = mch_GG.moss; ell(g, 0.6, -19, 3.4, 1.4, 0.1); g.fill(); }
    // moss on his crown, with two little white flowers
    g.fillStyle = mch_GG.moss; ell(g, -1 + hx * 0.4, -26.4, 4.4, 1.2); g.fill(); g.fillStyle = mch_GG.mossL; ell(g, -2 + hx * 0.4, -26.8, 2, 0.5); g.fill();
    for (const [x, y] of [[-3.2, -27], [1.6, -26.7]]) { g.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) { const a = k / 5 * mch_TAU; ell(g, x + hx * 0.4 + Math.cos(a) * 0.32, y + Math.sin(a) * 0.32, 0.24, 0.24); g.fill(); } ell(g, x + hx * 0.4, y, 0.18, 0.18); g.fillStyle = '#f2c94c'; g.fill(); }
    g.restore();
    if (!back) for (const s of side ? [1] : [-1, 1]) { const p = fistAt(s); if (ring >= 0) mch_dust(g, p[0] + s * 4, 10.8, 2.4, (1 - ring) * 0.55); mch_ggFist(g, p[0], p[1], s, 1, false); if (sw >= 0.3 && sw < 0.8) { g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - (sw - 0.3) / 0.5)})`; g.lineWidth = 1.2; g.lineCap = 'round'; for (const t of [-2.4, 0, 2.4]) { g.beginPath(); g.moveTo(p[0] + t, p[1] - 5.6); g.lineTo(p[0] + t * 1.2, p[1] - 12); g.stroke(); } } }
    g.restore();
  }

  // ---------- the giant ores: great boulders studded with crystals of their metal; they quiver when something inside stirs ----------
  const mch_ORE_M = { hi: '#b4c8e6', mid: '#7089b4', lo: '#4a5f86', deep: '#2f3d5a', rgb: '160,210,255', crys: ['#c4dcf6', '#f2f8ff', '#6f98cc'], ore: { deep: '#2f3d5a', mid: '#8fbcf0', hi: '#eef6ff' }, eye: '#e6f4ff', iris: '#4a9aff' };
  const mch_ORE_S = { hi: '#a898dc', mid: '#6d5cae', lo: '#4a3c80', deep: '#2c2350', rgb: '210,170,255', crys: ['#d4c0ff', '#f6f0ff', '#8a6ad8'], ore: { deep: '#2c2350', mid: '#b48cf0', hi: '#f4ecff' }, eye: '#f4ecff', iris: '#b070ff' };
  function mch_giantOre(g, e, O, storm) {
    const sw = swingOf(e), mv = e.moving, waking = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    const q = mv ? 0.55 : 0.12, shake = q + waking * 0.9, jx = Math.sin(time * 41 + (e.walkT || 0) * 7) * shake, jy = Math.cos(time * 37 + (e.walkT || 0) * 5) * shake * 0.5;
    g.save(); shadow(g, 0, 10.4, 15, 3.6, 0.36);
    // a rock looks the same from every side, and keeps its light from the top left
    // rubble round its foot
    for (const [x, y, r, c] of [[-11.6, 9.6, 1.8, O.lo], [-8.4, 10.4, 1.3, O.mid], [9.8, 10, 1.6, O.lo], [12.4, 9.4, 1.1, O.mid], [6.4, 10.6, 1.1, O.deep], [-4.4, 10.8, 0.9, O.mid]]) { mch_blob(g, [[x - r, y], [x - r * 0.3, y - r * 0.8], [x + r, y - r * 0.3], [x + r * 0.7, y + r * 0.5], [x - r * 0.6, y + r * 0.5]]); g.fillStyle = rfill(g, c, x, y, r); g.fill(); outline(g, 0.35); }
    g.save(); g.translate(jx, jy);
    const R = [[-13.2, 6.2], [-14.2, -1], [-11.8, -8.8], [-6.2, -13.6], [1.4, -14.8], [8.6, -12.2], [13.2, -5.8], [14.2, 1.6], [11.8, 8], [3, 9.8], [-7.8, 9.6]];
    const poly = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
    const cluster = (x, y, a, h, w, list) => { for (const [da, k, dx] of list || [[-0.42, 0.62, -0.9], [0.4, 0.55, 0.9], [0, 1, 0]]) mch_crystal(g, x + Math.cos(a) * dx * w, y + Math.sin(a) * dx * w, h * k, w * (0.6 + k * 0.4), a + da, O.crys); };
    if (storm) for (const [x, y, h, w, a] of [[-8, -10, 7.6, 3.2, -0.55], [-4, -12.6, 10.6, 3.8, -0.22], [0.8, -13.6, 12.6, 4, 0.02], [5.4, -12.2, 9.6, 3.6, 0.3], [9.2, -10, 6.4, 3, 0.62]]) mch_crystal(g, x, y, h, w, a, O.crys);
    else { cluster(-5.4, -12, -0.3, 9.6, 3.6); cluster(7, -11.4, 0.5, 6, 2.8); }
    g.lineJoin = 'round'; poly(R); g.fillStyle = O.mid; g.fill();
    g.save(); poly(R); g.clip();
    // the chiselled faces of the rock: a lit top, a left face, the front, a shadowed right face, the dark foot
    const F = [[[-11.8, -8.8], [-6.2, -13.6], [1.4, -14.8], [8.6, -12.2], [4.4, -6.2], [-4.6, -5.6]], [[-14.2, -1], [-11.8, -8.8], [-4.6, -5.6], [-6.6, 2.4], [-13.2, 6.2]], [[-4.6, -5.6], [4.4, -6.2], [6.8, 1.6], [1.6, 4.6], [-6.6, 2.4]], [[4.4, -6.2], [8.6, -12.2], [13.2, -5.8], [14.2, 1.6], [11.8, 8], [6.8, 1.6]], [[-13.2, 6.2], [-6.6, 2.4], [1.6, 4.6], [6.8, 1.6], [11.8, 8], [3, 9.8], [-7.8, 9.6]]];
    const T = [[O.hi, 0.12], [O.mid, 0.12], [O.mid, 0], [O.lo, 0], [O.lo, -0.2]];
    F.forEach((pts, k) => { poly(pts); const gr = g.createLinearGradient(-8, -14, 8, 10); gr.addColorStop(0, shade(T[k][0], T[k][1] + 0.1)); gr.addColorStop(1, shade(T[k][0], T[k][1] - 0.12)); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 0.35; g.stroke(); g.strokeStyle = 'rgba(10,8,20,0.3)'; g.lineWidth = 0.2; g.stroke(); });
    g.strokeStyle = 'rgba(10,8,20,0.45)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-9, -3); g.lineTo(-7.4, 0); g.lineTo(-8.6, 2.4); g.moveTo(9.6, -6); g.lineTo(8.4, -2.4); g.lineTo(10, 0.6); g.stroke();
    const pulse = 0.6 + Math.sin(time * 3 + (e.seed || 0)) * 0.3;
    mch_vein(g, [[-10, 4], [-6.4, 1.6], [-7, -1.4], [-3.4, -4]], O.rgb, 0.45, pulse);
    mch_vein(g, [[9.4, 4.4], [6, 2.6], [7.2, -0.8], [4.4, -5.6]], O.rgb, 0.45, pulse);
    for (const [x, y, r, t] of storm ? [[-6.4, -7.4, 2.4, 0.3], [5.8, -7.6, 2, 0.9], [-2, 4.6, 2.4, 0.2], [8.8, 2, 1.7, 0.6], [-9.6, 2.4, 1.6, 0.5]] : [[-6.6, -7.6, 2.3, 0.3], [5.4, -8.4, 1.9, 0.9], [-1.4, 4.8, 2.5, 0.2], [8.6, 1.6, 1.9, 0.6], [-9.8, 2, 1.7, 0.5], [2.4, -2.6, 1.4, 0.1]]) mch_nugget(g, x, y, r, O.ore, t);
    if (storm) { const z = Math.sin(time * 5 + (e.walkT || 0) * 3 + (e.seed || 0)); mch_bolt3(g, [[-8.4, -3], [-5.4, -1], [-6.4, 1], [-3, 3.4], [-1.4, 2.2]], z > -0.2 ? 0.95 : 0); mch_bolt3(g, [[3.4, -9], [5.6, -6.6], [4.2, -4.8], [7.4, -3]], z < 0.4 ? 0.9 : 0); }
    if (waking > 0.05) {
      // something inside wakes: a crack opens and two eyes look out
      const ey = -0.4; mch_glow(g, 0, ey, 9, O.rgb, 0.6 * waking);
      g.fillStyle = '#10141c'; ell(g, 0, ey, 6.6 * (0.6 + waking * 0.4), 2.6 * waking); g.fill();
      for (const s of [-1, 1]) { ell(g, s * 2.8, ey, 1.5, 1 * waking); g.fillStyle = O.eye; g.fill(); ell(g, s * 2.8, ey, 0.65, 0.65 * waking); g.fillStyle = O.iris; g.fill(); }
    }
    g.restore(); poly(R); outline(g, 0.75);
    // clusters of crystals breaking out of its sides and face
    if (storm) { cluster(-13, -1.8, -1.2, 6.6, 3); cluster(13.4, 0.4, 1.25, 5.6, 2.8, [[-0.4, 0.7, -0.8], [0, 1, 0]]); }
    else { cluster(-13.2, -1.6, -1.2, 6.4, 3); cluster(13.2, 2, 1.3, 4.6, 2.4, [[-0.4, 0.7, -0.8], [0, 1, 0]]); cluster(-2.6, 7.6, -0.2, 3.4, 2, [[0, 1, 0], [0.5, 0.7, 0.9]]); }
    for (let k = 0; k < 5; k++) { const tw = Math.max(0, Math.sin(time * 3 + k * 1.7 + (e.seed || 0))); if (tw < 0.25) continue; const [x, y] = [[-5, -9], [6, -4], [-8, 3], [2, 1], [9, -7]][k]; sparkle(g, x, y, 1.5 * tw, `rgba(255,255,255,${0.9 * tw})`); }
    g.restore();
    // pebbles shaken loose while it quivers
    if (mv || waking > 0.05) for (let k = 0; k < 3; k++) { const ph = (time * 1.6 + k / 3) % 1; ell(g, [-9, 3, 10][k] + ph * [-1.4, 0.6, 1.2][k], -2 + ph * 12, 0.6, 0.5); g.fillStyle = `rgba(90,80,110,${(1 - ph) * 0.9})`; g.fill(); }
    g.restore();
  }
  const mch_giantMithril = (g, e) => mch_giantOre(g, e, mch_ORE_M, false);
  const mch_giantStorm = (g, e) => mch_giantOre(g, e, mch_ORE_S, true);

  Object.assign(NEW_DRAW, { walker: mch_walker, yard_walker: mch_yardWalker, bulldozer: mch_bulldozer, yard_dozer: mch_yardDozer, barrelbeast: mch_barrelbeast, gnasher: mch_gnasher,
    golemling: mch_golemling, mithril_golem: mch_mithrilGolem, stormstone_golem: mch_stormGolem, ginormous_golem: mch_ginormous, giant_mithril: mch_giantMithril, giant_stormstone: mch_giantStorm });
  Object.assign(MOB_SIZE, { walker: 2.6, yard_walker: 2.6, bulldozer: 2.7, yard_dozer: 2.7, barrelbeast: 2.9, gnasher: 3,
    golemling: 2, mithril_golem: 2.4, stormstone_golem: 3.3, ginormous_golem: 4.4, giant_mithril: 2.9, giant_stormstone: 3.7 });

  // ---------- bosses ----------
  // ================= THE BIG BEASTS AND BOSSES (bos_): the Brood Mother, the Thunderbird, the red dragon, the Dustjaw, The Fang =================
  // Drawn in the approved knight style with mobs-new.js's helpers (shade, rr, ell, outline, vfill, rfill, sparkle, shadow, topDown...).
  // Each draw function takes (g, e) and draws around the monster's middle; MOB_SIZE[type] scales the whole drawing.

  // ---------- small helpers of this family ----------
  const bos_rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function bos_rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`; }
  // shade() gives an rgb() string; this gives hex, so the result can go back into vfill / rfill / shade
  function bos_hex(hex, f) { const m = shade(hex, f).match(/\d+/g).map(Number); return '#' + m.map(v => v.toString(16).padStart(2, '0')).join(''); }
  function bos_pt(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
  function bos_q(p0, c, p1, t) { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]; }
  // a soft round light (an ellipse when ry differs from rx)
  function bos_glow(g, x, y, rx, ry, hex, a) {
    if (a <= 0 || rx <= 0) return;
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, bos_rgba(hex, a)); gr.addColorStop(1, bos_rgba(hex, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // a jagged bolt between two points; seed picks its shape
  function bos_boltPts(x0, y0, x1, y1, n, jit, seed) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, pts = [[x0, y0]];
    for (let i = 1; i < n; i++) { const t = i / n, o = (bos_rnd(seed + i * 3.7) - 0.5) * 2 * jit * Math.sin(t * Math.PI) ** 0.5; pts.push([x0 + dx * t + nx * o, y0 + dy * t + ny * o]); }
    pts.push([x1, y1]); return pts;
  }
  function bos_bolt(g, pts, w, core, glow, a) {
    if (a <= 0) return;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const line = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
    line(); g.strokeStyle = bos_rgba(glow, 0.22 * a); g.lineWidth = w * 4.2; g.stroke();
    line(); g.strokeStyle = bos_rgba(glow, 0.75 * a); g.lineWidth = w * 1.8; g.stroke();
    line(); g.strokeStyle = bos_rgba(core, a); g.lineWidth = w * 0.75; g.stroke();
    g.restore();
  }
  // a cone of breath blown along +x from x0: a soft cone, rolling puffs that travel out along it, and a white-hot core
  function bos_breathCone(g, x0, L, W, pal, a) {
    if (L < 1 || a <= 0) return;
    g.save();
    const fl = g.createLinearGradient(x0, 0, x0 + L, 0);
    fl.addColorStop(0, bos_rgba(pal[0], 0.95 * a)); fl.addColorStop(0.42, bos_rgba(pal[1], 0.78 * a)); fl.addColorStop(1, bos_rgba(pal[2], 0));
    g.fillStyle = fl; g.beginPath(); g.moveTo(x0, -W * 0.07);
    g.quadraticCurveTo(x0 + L * 0.45, -W * 0.4, x0 + L, -W * 0.5); g.quadraticCurveTo(x0 + L * 1.12, 0, x0 + L, W * 0.5);
    g.quadraticCurveTo(x0 + L * 0.45, W * 0.4, x0, W * 0.07); g.closePath(); g.fill();
    for (let k = 0; k < 11; k++) {
      const u = (k / 11 + time * 1.7) % 1, x = x0 + L * (0.06 + u * 0.94), r = W * (0.09 + u * 0.33), y = Math.sin(k * 2.3 + time * 9) * W * 0.17 * u;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, bos_rgba(pal[0], 0.85 * (1 - u * 0.8) * a)); gr.addColorStop(0.5, bos_rgba(pal[1], 0.6 * (1 - u * 0.7) * a)); gr.addColorStop(1, bos_rgba(pal[2], 0));
      g.fillStyle = gr; ell(g, x, y, r, r * 0.86); g.fill();
    }
    const core = g.createLinearGradient(x0, 0, x0 + L * 0.55, 0); core.addColorStop(0, bos_rgba('#ffffff', 0.9 * a)); core.addColorStop(1, bos_rgba(pal[0], 0));
    g.fillStyle = core; g.beginPath(); g.moveTo(x0, -W * 0.05); g.quadraticCurveTo(x0 + L * 0.3, -W * 0.14, x0 + L * 0.55, 0); g.quadraticCurveTo(x0 + L * 0.3, W * 0.14, x0, W * 0.05); g.closePath(); g.fill();
    g.restore();
  }
  // a smooth tapered body through spine points [x, y, half-width]: one closed path (a serpent's neck or tail, a horn)
  function bos_tubePath(g, pts) {
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      L.push([p[0] + nx * p[2], p[1] + ny * p[2]]); R.push([p[0] - nx * p[2], p[1] - ny * p[2]]);
    }
    g.beginPath(); g.moveTo(...L[0]);
    for (let i = 1; i < L.length - 1; i++) { const m = bos_pt(L[i], L[i + 1], 0.5); g.quadraticCurveTo(...L[i], ...m); }
    g.lineTo(...L[L.length - 1]);
    const e = pts[pts.length - 1], f = pts[pts.length - 2], ex = e[0] - f[0], ey = e[1] - f[1], ed = Math.hypot(ex, ey) || 1;
    g.quadraticCurveTo(e[0] + ex / ed * e[2] * 1.4, e[1] + ey / ed * e[2] * 1.4, ...R[R.length - 1]);
    for (let i = R.length - 2; i > 0; i--) { const m = bos_pt(R[i], R[i - 1], 0.5); g.quadraticCurveTo(...R[i], ...m); }
    g.lineTo(...R[0]); g.closePath();
    return { L, R };
  }
  // a clawed foot seen from above: three bone claws at the end of a limb pointing along +x
  function bos_claws(g, x, w, col, n) {
    g.fillStyle = col;
    for (let k = 0; k < (n || 3); k++) { const o = (k - ((n || 3) - 1) / 2) * w; g.beginPath(); g.moveTo(x - 0.4, o - w * 0.36); g.quadraticCurveTo(x + w * 1.2, o, x + w * 1.6, o + w * 0.2); g.quadraticCurveTo(x + w * 0.8, o + w * 0.42, x - 0.4, o + w * 0.36); g.closePath(); g.fill(); outline(g, 0.3); }
  }

  // ================= THE BROOD MOTHER: the Spider Den's queen =================
  // Far bigger than the giant spider: eight long banded legs that walk, a swollen egg-sac abdomen with the eggs pressing out
  // through the silk, a dark crown mark, eight red eyes that glow, pale fangs that open. Her attack is a web shot.
  const BOS_BM = { leg: '#231d29', leg2: '#3e3548', band: '#a49ab4', thorax: '#2e2636', head: '#3a3242', sac: '#ddd5c6', mark: '#3a2440', egg: '#f7ecc4', eye: '#ff3b3b', fang: '#efe8da', silk: '#f4f6fb' };
  function bos_bmLeg(g, p0, p1, p2, p3, t) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const seg = (a, b) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
    g.strokeStyle = OUT; g.lineWidth = t + 1.2; seg(p0, p1); g.lineWidth = t * 0.8 + 1.1; seg(p1, p2); g.lineWidth = t * 0.5 + 1; seg(p2, p3);
    g.strokeStyle = BOS_BM.leg2; g.lineWidth = t; seg(p0, p1); g.lineWidth = t * 0.8; seg(p1, p2); g.strokeStyle = BOS_BM.leg; g.lineWidth = t * 0.5; seg(p2, p3);
    g.strokeStyle = 'rgba(214,196,240,0.32)'; g.lineWidth = t * 0.26; seg(bos_pt(p0, p1, 0.2), bos_pt(p0, p1, 0.72)); seg(bos_pt(p1, p2, 0.26), bos_pt(p1, p2, 0.62));
    // pale bands at the knee, the ankle and the hip end of the thigh
    g.strokeStyle = BOS_BM.band; g.lineWidth = t * 0.82; seg(bos_pt(p1, p2, 0.1), bos_pt(p1, p2, 0.22)); g.lineWidth = t * 0.6; seg(bos_pt(p1, p2, 0.86), bos_pt(p2, p3, 0.12)); g.lineWidth = t; seg(bos_pt(p0, p1, 0.78), bos_pt(p0, p1, 0.88));
    // bristles along the shin
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    g.strokeStyle = BOS_BM.leg; g.lineWidth = 0.4;
    for (let k = 1; k < 6; k++) { const q = bos_pt(p1, p2, k / 6), sd = k % 2 ? 1 : -1; g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] + nx * sd * 1.7 + dx / L * 0.9, q[1] + ny * sd * 1.7 + dy / L * 0.9); g.stroke(); }
    ell(g, p1[0], p1[1], t * 0.6, t * 0.6); g.fillStyle = rfill(g, BOS_BM.band, p1[0], p1[1], t * 0.6); g.fill(); outline(g, 0.4);
    ell(g, p3[0], p3[1], t * 0.3, t * 0.3); g.fillStyle = '#120e16'; g.fill();
  }
  function bos_broodMother(g, e) {
    const sw = swingOf(e), shot = sw >= 0 ? Math.sin(sw * Math.PI) : 0, br = 1 + Math.sin(time * 2.2 + (e.seed || 0)) * 0.025;
    shadow(g, 0, 10, 33, 12, 0.3);
    topDown(g, e, (g) => {
      // eight legs: front pairs reach forward, back pairs trail; a walking spider moves them in two alternating sets of four
      const gait = e.moving ? e.walkT * 1.2 : time * 0.5;
      const AT = [[8.6, 3.4, -1.02], [6.4, 4.8, -0.4], [3.8, 5.2, 0.26], [1.2, 4.4, 0.92]];
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        const [ax, ay, spr] = AT[i], ph = gait + i * Math.PI / 2 + (s > 0 ? Math.PI : 0);
        const swg = Math.sin(ph) * (e.moving ? 0.24 : 0.035), up = e.moving ? Math.max(0, Math.cos(ph)) : 0;
        const a0 = s * (Math.PI / 2 + spr + swg), bend = (i < 2 ? -1 : 1) * 0.6, a1 = a0 + s * bend, a2 = a1 + s * bend * 0.5;
        const L1 = 13.5 - up * 1.2, L2 = 14.5 - up * 2.2, L3 = 5.2;
        const p0 = [ax, s * ay], p1 = [p0[0] + Math.cos(a0) * L1, p0[1] + Math.sin(a0) * L1];
        const p2 = [p1[0] + Math.cos(a1) * L2, p1[1] + Math.sin(a1) * L2], p3 = [p2[0] + Math.cos(a2) * L3, p2[1] + Math.sin(a2) * L3];
        bos_bmLeg(g, p0, p1, p2, p3, 2.8 - i * 0.12);
      }
      // she rocks back as the web flies
      g.translate(-shot * 1.6, 0);
      // ---- the abdomen: an egg sac ----
      g.save(); g.translate(-15, 0); g.scale(br, br);
      // spinnerets
      ell(g, -15.6, 0, 2.4, 2); g.fillStyle = BOS_BM.leg; g.fill(); outline(g, 0.5);
      if (e.moving) { g.strokeStyle = 'rgba(244,246,251,0.6)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-17.4, 0); for (let k = 1; k <= 6; k++) g.lineTo(-17.4 - k * 3, Math.sin(k * 1.3 + e.walkT) * 1.4 * k / 6); g.stroke(); }
      const SAC = () => ell(g, 0, 0, 15.6, 12.8);
      SAC(); g.fillStyle = rfill(g, BOS_BM.sac, 0, 0, 15.6); g.fill();
      g.save(); SAC(); g.clip();
      // the eggs press out through the silk: each a pale bump with a shadow under it
      const EGGS = [[-12.4, 0, 3], [-9.6, -5.2, 3.2], [-9.8, 5.4, 3.2], [-6, -1.2, 3.6], [-5, -8.2, 3], [-4.8, 7.4, 3.2], [-1.6, -4.6, 3], [-1.2, 3.4, 3.1], [-13.6, -6.4, 2.4], [-13.4, 6.6, 2.4], [1.6, -9.4, 2.4], [1.4, 9.4, 2.4]];
      for (const [x, y, r] of EGGS) { ell(g, x + 0.6, y + 0.7, r + 0.4, r * 0.92 + 0.4); g.fillStyle = 'rgba(90,70,60,0.35)'; g.fill(); }
      EGGS.forEach(([x, y, r], k) => {
        const wob = 1 + Math.max(0, Math.sin(time * 3 + k * 1.7)) * 0.05;
        ell(g, x, y, r * wob, r * 0.92 * wob); g.fillStyle = rfill(g, BOS_BM.egg, x, y, r); g.fill(); g.strokeStyle = 'rgba(120,96,70,0.55)'; g.lineWidth = 0.45; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.7)'; ell(g, x - r * 0.35, y - r * 0.38, r * 0.3, r * 0.2, -0.5); g.fill();
      });
      // silk wrapped round it
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.45;
      for (let k = 0; k < 7; k++) { const x = -15 + k * 4.4; g.beginPath(); g.moveTo(x + 2, -13); g.quadraticCurveTo(x - 3 + (k % 2) * 4, 0, x - 1, 13); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.3)'; for (const y of [-6, 0, 6]) { g.beginPath(); g.moveTo(-16, y * 1.1); g.quadraticCurveTo(-2, y + 2, 16, y * 0.8); g.stroke(); }
      // the crown mark of the queen, near the waist, with a red gem in it
      g.beginPath(); g.moveTo(13.6, 0); g.quadraticCurveTo(13, -4, 11, -5); g.lineTo(5.6, -5.8); g.lineTo(7.8, -2.6); g.lineTo(4.4, -1.8); g.lineTo(5.4, 0);
      g.lineTo(4.4, 1.8); g.lineTo(7.8, 2.6); g.lineTo(5.6, 5.8); g.lineTo(11, 5); g.quadraticCurveTo(13, 4, 13.6, 0); g.closePath();
      g.fillStyle = vfill(g, BOS_BM.mark, -6, 6, 0.25, -0.3); g.fill(); outline(g, 0.5);
      const gem = 0.6 + Math.sin(time * 4) * 0.25; bos_glow(g, 10, 0, 3.4, 3.4, '#ff3b3b', gem * 0.6);
      g.beginPath(); g.moveTo(11.6, 0); g.lineTo(10, -1.3); g.lineTo(8.4, 0); g.lineTo(10, 1.3); g.closePath(); g.fillStyle = '#e8283a'; g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; ell(g, 9.9, -0.5, 0.45, 0.3); g.fill();
      g.restore();
      SAC(); outline(g, 1);
      g.fillStyle = 'rgba(255,255,255,0.28)'; ell(g, -3, -6.6, 7, 2.6, -0.15); g.fill();
      g.restore();
      // ---- the waist, the cephalothorax and the head ----
      ell(g, -0.6, 0, 2.8, 2.4); g.fillStyle = BOS_BM.leg; g.fill(); outline(g, 0.5);
      ell(g, 4.8, 0, 8.6, 7.4); g.fillStyle = rfill(g, BOS_BM.thorax, 4.8, 0, 8.6); g.fill(); outline(g, 1);
      g.strokeStyle = 'rgba(12,6,16,0.55)'; g.lineWidth = 0.55;
      for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; g.beginPath(); g.moveTo(4.8 + Math.cos(a) * 2.2, Math.sin(a) * 2); g.lineTo(4.8 + Math.cos(a) * 7.4, Math.sin(a) * 6.3); g.stroke(); }
      g.fillStyle = 'rgba(206,176,236,0.24)'; ell(g, 3.2, -3.2, 4.4, 1.8, -0.2); g.fill();
      // a ridge of short spikes round the back of the head
      g.fillStyle = BOS_BM.leg2;
      for (const k of [-2, -1, 0, 1, 2]) { const a = Math.PI + k * 0.5, bx = 4.8 + Math.cos(a) * 6.6, by = Math.sin(a) * 5.7, tx = 4.8 + Math.cos(a) * 9.4, ty = Math.sin(a) * 8; g.beginPath(); g.moveTo(bx + Math.sin(a) * 1.1, by - Math.cos(a) * 1.1); g.lineTo(tx, ty); g.lineTo(bx - Math.sin(a) * 1.1, by + Math.cos(a) * 1.1); g.closePath(); g.fill(); outline(g, 0.35); }
      ell(g, 11.6, 0, 4.6, 4.8); g.fillStyle = rfill(g, BOS_BM.head, 11.6, 0, 4.6); g.fill(); outline(g, 0.8);
      // pedipalps: two short feelers that twitch
      for (const s of [-1, 1]) {
        g.save(); g.translate(14.4, s * 3.1); g.rotate(s * (0.45 + Math.sin(time * 4 + s) * 0.14) - s * shot * 0.3);
        rr(g, 0, -0.95, 4.8, 1.9, 0.95); g.fillStyle = BOS_BM.leg2; g.fill(); outline(g, 0.4); ell(g, 4.6, 0, 1.2, 1.1); g.fillStyle = BOS_BM.band; g.fill(); outline(g, 0.3);
        g.restore();
      }
      // chelicerae and fangs: they open wide when she strikes
      const open = 0.12 + shot * 0.7;
      for (const s of [-1, 1]) {
        g.save(); g.translate(15.4, s * 1.6);
        ell(g, 0, 0, 2.3, 1.9); g.fillStyle = rfill(g, BOS_BM.leg2, 0, 0, 2.3); g.fill(); outline(g, 0.5);
        g.rotate(s * open);
        g.beginPath(); g.moveTo(1, s * 1); g.quadraticCurveTo(4.8, s * 0.8, 5.6, -s * 1.5); g.quadraticCurveTo(3.6, -s * 0.2, 1, -s * 0.9); g.closePath();
        g.fillStyle = vfill(g, BOS_BM.fang, -1.5, 1.5); g.fill(); outline(g, 0.4);
        g.restore();
      }
      // eight red eyes and their glow
      bos_glow(g, 12.4, 0, 7.5, 7.5, '#ff3c3c', 0.28 + Math.sin(time * 5) * 0.1 + shot * 0.2);
      for (const [x, y, r] of [[13.2, 1.45, 1.3], [11.4, 3, 0.95], [14.2, 3.1, 0.72], [10.4, 1.1, 0.7]]) for (const s of [-1, 1]) {
        ell(g, x, s * y, r, r); g.fillStyle = rfill(g, BOS_BM.eye, x, s * y, r); g.fill(); g.strokeStyle = 'rgba(30,8,10,0.7)'; g.lineWidth = 0.3; g.stroke();
        ell(g, x - r * 0.3, s * y - r * 0.32, r * 0.32, r * 0.32); g.fillStyle = '#ffffff'; g.fill();
      }
      // the web shot: strands from her jaws to a net that spins open as it flies
      if (sw >= 0) {
        const fly = ease(Math.min(1, sw * 1.5)), L = 6 + 34 * fly, R = 1.5 + 8 * fly, nx = 19 + L, a = 1 - Math.max(0, sw - 0.75) * 4;
        g.save(); g.lineCap = 'round';
        for (const o of [-1, 0, 1]) {
          g.beginPath(); g.moveTo(18.5, o * 0.5); g.quadraticCurveTo(18.5 + L * 0.5, o * 1.8 + Math.sin(time * 18 + o * 2) * 0.7, nx - R * 0.7, o * R * 0.35);
          g.strokeStyle = bos_rgba('#2a2430', 0.35 * a); g.lineWidth = 1.1; g.stroke(); g.strokeStyle = bos_rgba(BOS_BM.silk, 0.95 * a); g.lineWidth = 0.5; g.stroke();
        }
        g.translate(nx, 0); g.rotate(time * 3);
        ell(g, 0, 0, R, R); g.fillStyle = bos_rgba('#ffffff', 0.2 * a); g.fill();
        const net = (col, w) => {
          g.strokeStyle = col; g.lineWidth = w; g.beginPath();
          for (let k = 0; k < 8; k++) { const q = k / 8 * Math.PI * 2; g.moveTo(0, 0); g.lineTo(Math.cos(q) * R, Math.sin(q) * R); }
          for (const f of [0.38, 0.7, 1]) for (let k = 0; k <= 8; k++) { const q = k / 8 * Math.PI * 2, q0 = (k - 1) / 8 * Math.PI * 2; if (k === 0) g.moveTo(Math.cos(q) * R * f, Math.sin(q) * R * f); else g.quadraticCurveTo(Math.cos((q + q0) / 2) * R * f * 0.8, Math.sin((q + q0) / 2) * R * f * 0.8, Math.cos(q) * R * f, Math.sin(q) * R * f); }
          g.stroke();
        };
        net(bos_rgba('#2a2430', 0.4 * a), 1); net(bos_rgba(BOS_BM.silk, a), 0.5);
        g.restore();
      }
    });
  }

  // ================= THE THUNDERBIRD: a huge storm bird =================
  // Long storm-black wings of layered feathers with six finger-feathers at each tip, a fanned tail, lightning zigzags that
  // flicker in the feathers, a crest, a hooked gold beak and two white eyes. Sparks jump off it. Its attack calls a bolt down
  // in front of it. The game's phases are kept: 'high' (lifted, paler) and 'perch' (wings folded, crackling).
  const BOS_TB = { dark: '#1c2133', mid: '#2e354d', light: '#45527a', edge: '#9aaedd', bolt: '#fff7c0', beak: '#e8c37a', beak2: '#b98a40' };
  function bos_tbWing(g, s, span, flap, sh, charge) {
    const Y = y => s * y * span, sx = -flap * 2.6;
    const TIPS = [[-2, 41.5], [-7.6, 41.2], [-12.8, 39.4], [-17.2, 36.4], [-20.8, 32.4], [-23.2, 27.8]];
    const NOTCH = [[-4.4, 33.8], [-9.6, 33.2], [-14.1, 31.4], [-17.8, 28.6], [-20.6, 25]];
    const SEC = [[-22.6, 22], [-21.2, 16.6], [-18.8, 11.6], [-15.6, 7.6], [-11.6, 4.4]];
    const path = () => {
      g.beginPath(); g.moveTo(4, s * 4.2); g.quadraticCurveTo(7.4, Y(11), 2.4 - flap, Y(20));
      for (let k = 0; k < 6; k++) {
        const [tx, ty] = TIPS[k], x = tx + sx * (0.6 + k * 0.1);
        g.lineTo(x + 1.3, Y(ty - 2)); g.quadraticCurveTo(x + 0.6, Y(ty + 0.9), x - 1.3, Y(ty - 0.6));
        if (k < 5) g.lineTo(NOTCH[k][0] + sx * 0.6, Y(NOTCH[k][1]));
      }
      let px = -23.2 + sx * 1.1, py = 27.8;
      for (const [x, y] of SEC) { g.quadraticCurveTo((px + x) / 2 - 2.6, Y((py + y) / 2 + 0.4), x, Y(y)); px = x; py = y; }
      g.lineTo(-10, s * 3.6); g.closePath();
    };
    path();
    if (sh) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fill(); return; }
    const wg = g.createLinearGradient(2, s * 4, -12, Y(42)); wg.addColorStop(0, '#3a4566'); wg.addColorStop(0.45, BOS_TB.mid); wg.addColorStop(1, '#151927');
    g.fillStyle = wg; g.fill();
    g.save(); path(); g.clip();
    // coverts: rows of small overlapping feathers along the front of the wing
    for (let r = 0; r < 3; r++) for (let j = 0; j < 6; j++) {
      const t = (j + 0.5) / 6, cx = lerp(2.6 - r * 3.4, 0.6 - r * 4.4 - flap, t), cy = lerp(s * 6.2, Y(19.5 - r * 2), t), rad = 2.5 - r * 0.25;
      g.beginPath(); g.arc(cx, cy, rad, Math.PI / 2, Math.PI * 1.5); g.closePath(); g.fillStyle = r === 0 ? BOS_TB.light : r === 1 ? '#3a4566' : '#323a56'; g.fill();
      g.strokeStyle = 'rgba(10,12,22,0.55)'; g.lineWidth = 0.4; g.beginPath(); g.arc(cx, cy, rad, Math.PI / 2, Math.PI * 1.5); g.stroke();
    }
    // secondaries: feather lines from the trailing scallops toward the arm
    g.strokeStyle = 'rgba(10,12,22,0.6)'; g.lineWidth = 0.5;
    for (const [x, y] of SEC) { g.beginPath(); g.moveTo(x, Y(y)); g.lineTo(x + 7.5, Y(y * 0.84)); g.stroke(); }
    // primaries: a pale shaft down each finger feather, dark gaps between
    TIPS.forEach(([tx, ty], k) => {
      const x = tx + sx * (0.6 + k * 0.1), bx = -2.4 - k * 1.7 - flap * 0.8, by = 20.5 + k * 0.4;
      g.strokeStyle = 'rgba(160,180,230,0.45)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(bx, Y(by)); g.lineTo(x, Y(ty - 0.6)); g.stroke();
      if (k < 5) { g.strokeStyle = 'rgba(8,10,18,0.6)'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(NOTCH[k][0] + sx * 0.6, Y(NOTCH[k][1])); g.lineTo(bx - 1, Y(by + 1)); g.stroke(); }
      g.fillStyle = 'rgba(154,174,221,0.75)'; ell(g, x - 0.2, Y(ty - 0.7), 1.1, 1.1); g.fill();
    });
    // lightning in the feathers: a zigzag that flickers
    const fl = 0.55 + 0.45 * Math.max(0, Math.sin(time * 13 + s * 1.7)) * charge + charge * 0.3;
    const Z = [[1, 6], [-3.4, 11.4], [0.6, 15.6], [-5, 22], [-2, 26.2], [-9.4, 33.6]].map(([x, y]) => [x - flap * (y / 40), Y(y)]);
    bos_bolt(g, Z, 1.15, '#ffffff', BOS_TB.bolt, Math.min(1, fl));
    g.restore();
    path(); outline(g, 0.7);
    return TIPS.map(([tx, ty], k) => [tx + sx * (0.6 + k * 0.1), Y(ty)]);
  }
  function bos_thunderbird(g, e) {
    const sw = swingOf(e), ph = e.phase || 'hunt', high = ph === 'high', perch = ph === 'perch';
    const strike = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    const flap = perch ? 0 : Math.sin(time * (e.moving ? 4 : 2.1) + (e.seed || 0));
    const span = perch ? 0.4 : (0.84 + flap * 0.16) * (1 + strike * 0.1), lift = high ? 34 : perch ? 6 : 22;
    const charge = perch ? 1 : 0.35 + strike * 0.65;
    const body = (g, sh) => {
      const SH = 'rgba(0,0,0,0.22)';
      // the fanned tail: seven long feathers, pale tips, a lightning band across
      g.save(); g.translate(-10, 0);
      const fan = 0.58 + (e.moving ? Math.sin(time * 4) * 0.04 : 0.08), N = 9, TL = 23, tip = k => { const a = Math.PI + (-fan + k * 2 * fan / (N - 1)); return [Math.cos(a) * TL + 2, Math.sin(a) * TL]; };
      const tailPath = () => { g.beginPath(); g.moveTo(4, -6.4); for (let k = 0; k < N; k++) { const [x, y] = tip(k), a = Math.PI + (-fan + k * 2 * fan / (N - 1)); g.lineTo(x - Math.sin(a) * 2 + 1.4, y + Math.cos(a) * 2); g.quadraticCurveTo(x - 1.8, y, x + Math.sin(a) * 2 + 1.4, y - Math.cos(a) * 2); } g.lineTo(4, 6.4); g.closePath(); };
      tailPath(); g.fillStyle = sh ? SH : vfill(g, BOS_TB.mid, -8, 8, 0.15, -0.3); g.fill();
      if (!sh) {
        g.save(); tailPath(); g.clip();
        g.strokeStyle = 'rgba(8,10,18,0.55)'; g.lineWidth = 0.5; for (let k = 0; k < N; k++) { const [x, y] = tip(k); g.beginPath(); g.moveTo(2, y * 0.15); g.lineTo(x, y); g.stroke(); }
        g.strokeStyle = 'rgba(154,174,221,0.8)'; g.lineWidth = 2.4; g.beginPath(); g.arc(2, 0, TL - 1, Math.PI - fan - 0.1, Math.PI + fan + 0.1); g.stroke();
        const fl = 0.5 + Math.max(0, Math.sin(time * 11 + 2)) * 0.5 * charge + charge * 0.3;
        const zz = []; for (let k = 0; k <= 8; k++) { const a = Math.PI - fan + k * fan / 4, r = k % 2 ? 12.6 : 16; zz.push([Math.cos(a) * r + 2, Math.sin(a) * r]); }
        bos_bolt(g, zz, 0.9, '#ffffff', BOS_TB.bolt, Math.min(1, fl));
        g.restore(); tailPath(); outline(g, 0.6);
      }
      g.restore();
      // the wings
      const tips = [];
      for (const s of [-1, 1]) tips.push(bos_tbWing(g, s, span, flap, sh, charge));
      // the body: back feathers in chevrons, a ruff of spiky feathers at the neck
      ell(g, -1, 0, 12.6, 7.2); g.fillStyle = sh ? SH : rfill(g, '#2a3046', -1, 0, 12.6); g.fill(); if (sh) return; outline(g, 0.8);
      g.strokeStyle = 'rgba(120,140,190,0.35)'; g.lineWidth = 0.5;
      for (let r = 0; r < 4; r++) { const x = 4 - r * 3.6; g.beginPath(); g.moveTo(x - 2.2, -3.8 + r * 0.3); g.lineTo(x, 0); g.lineTo(x - 2.2, 3.8 - r * 0.3); g.stroke(); }
      g.fillStyle = '#262c40';
      for (let k = -3; k <= 3; k++) { const a = k * 0.42, bx = 7.6 + Math.cos(a) * 1.5, by = Math.sin(a) * 4.6; g.beginPath(); g.moveTo(bx + 1.6, by - 1.4); g.lineTo(bx - 3.8, by * 1.45); g.lineTo(bx + 1.6, by + 1.4); g.closePath(); g.fill(); outline(g, 0.35); }
      // the head
      ell(g, 11.8, 0, 5.4, 4.8); g.fillStyle = rfill(g, '#2c3348', 11.8, 0, 5.4); g.fill(); outline(g, 0.8);
      // the crest: three long feathers swept back, tipped with light
      for (const [y, l] of [[-2, 10], [2, 10], [0, 13]]) {
        g.beginPath(); g.moveTo(11, y * 0.8 - 1.2); g.quadraticCurveTo(6, y * 1.6 - 0.4, 10 - l, y * 2.8); g.quadraticCurveTo(6, y * 1.6 + 1.6, 11, y * 0.8 + 1.2); g.closePath();
        g.fillStyle = vfill(g, '#6a7cae', y - 3, y + 3, 0.25, -0.25); g.fill(); outline(g, 0.45);
        g.strokeStyle = 'rgba(20,24,40,0.5)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(10, y * 0.8); g.quadraticCurveTo(6, y * 1.6 + 0.6, 10.6 - l, y * 2.8); g.stroke();
        bos_glow(g, 10.4 - l, y * 2.8, 2.2, 2.2, BOS_TB.bolt, 0.5 * charge + 0.2); ell(g, 10.6 - l, y * 2.8, 0.9, 0.7); g.fillStyle = bos_rgba(BOS_TB.bolt, 0.7 + charge * 0.3); g.fill();
      }
      // the hooked gold beak
      g.beginPath(); g.moveTo(15.4, -2.2); g.quadraticCurveTo(20.6, -1.8, 23.2, 0.6); g.quadraticCurveTo(21, 1.2, 20.4, 2.2); g.quadraticCurveTo(18, 2.2, 15.4, 2.2); g.closePath();
      g.fillStyle = vfill(g, BOS_TB.beak, -2.4, 2.4); g.fill(); outline(g, 0.5);
      g.fillStyle = BOS_TB.beak2; g.beginPath(); g.moveTo(20.4, -0.6); g.quadraticCurveTo(22.2, -0.4, 23.2, 0.6); g.quadraticCurveTo(21.6, 1, 20.6, 1.4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(90,60,20,0.6)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(15.6, 0.2); g.quadraticCurveTo(18.6, 0.4, 20.6, 1.2); g.stroke();
      ell(g, 17.2, -1, 0.5, 0.35); g.fillStyle = '#3a2a10'; g.fill();
      // two white eyes, glowing brighter as it strikes
      const eg = 0.7 + Math.sin(time * 9) * 0.2 + strike * 0.3;
      for (const s of [-1, 1]) {
        bos_glow(g, 14.2, s * 2.9, 4, 4, '#fffbe0', 0.5 * eg);
        g.beginPath(); g.moveTo(12.4, s * 3.5); g.quadraticCurveTo(13.8, s * 2.1, 16, s * 2.3); g.quadraticCurveTo(14.6, s * 3.9, 12.4, s * 3.5); g.closePath();
        g.fillStyle = '#fffff0'; g.fill(); g.strokeStyle = 'rgba(10,12,20,0.75)'; g.lineWidth = 0.35; g.stroke();
        ell(g, 14.7, s * 2.85, 0.32, 0.5); g.fillStyle = '#2a3048'; g.fill();
        g.strokeStyle = '#141826'; g.lineWidth = 0.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(11.8, s * 2.2); g.lineTo(15.6, s * 1.6); g.stroke();
      }
      // sparks jumping between the wing tips and the air near them
      for (let k = 0; k < 4; k++) {
        const fk = Math.floor(time * 11) + k * 17; if (bos_rnd(fk) > 0.35 + charge * 0.4) continue;
        const side = tips[k % 2], p = side[Math.floor(bos_rnd(fk + 1) * 6)], q = [p[0] - 3 - bos_rnd(fk + 2) * 6, p[1] + (bos_rnd(fk + 3) - 0.5) * 9];
        bos_bolt(g, bos_boltPts(p[0], p[1], q[0], q[1], 4, 1.6, fk), 0.45, '#ffffff', BOS_TB.bolt, 0.9);
      }
    };
    g.save(); g.translate(0, -lift); topDown(g, e, body, { x: 8, y: lift + 10 }); g.restore();
    // high in the cloud: pale behind a veil of mist
    if (high) bos_glow(g, 0, -lift, 46, 34, '#dfe6ff', 0.32);
    // the strike: a bolt from its chest to the ground ahead, a flash, a ring, sparks
    if (sw >= 0) {
      const n = Math.hypot(e.facing.x, e.facing.y) || 1, ux = e.facing.x / n, uy = e.facing.y / n;
      const sx = ux * 10, sy = uy * 10 - lift, tx = ux * 40, ty = uy * 40 + 6, seed = Math.floor(time * 16) * 7, a = Math.min(1, (1 - sw) * 3.5);
      bos_glow(g, 0, -lift, 34, 34, BOS_TB.bolt, 0.3 * strike);
      g.fillStyle = `rgba(40,36,30,${0.35 * a})`; ell(g, tx, ty, 9, 3.6); g.fill();
      bos_glow(g, tx, ty, 20, 8, BOS_TB.bolt, 0.6 * a);
      const rr0 = 4 + sw * 16; g.strokeStyle = bos_rgba(BOS_TB.bolt, 0.85 * a); g.lineWidth = 1.2; ell(g, tx, ty, rr0, rr0 * 0.4); g.stroke();
      g.strokeStyle = bos_rgba('#ffffff', 0.9 * a); g.lineWidth = 0.6;
      for (let k = 0; k < 8; k++) { const q = k / 8 * Math.PI * 2 + 0.3, r0 = 3 + sw * 6, r1 = r0 + 4 + bos_rnd(k + seed) * 4; g.beginPath(); g.moveTo(tx + Math.cos(q) * r0, ty + Math.sin(q) * r0 * 0.4); g.lineTo(tx + Math.cos(q) * r1, ty + Math.sin(q) * r1 * 0.4); g.stroke(); }
      const pts = bos_boltPts(sx, sy, tx, ty, 9, 6, seed);
      bos_bolt(g, pts, 1.7, '#ffffff', BOS_TB.bolt, a);
      for (const k of [3, 6]) { const p = pts[k], q = [p[0] + (bos_rnd(seed + k) - 0.5) * 24, p[1] + 5 + bos_rnd(seed + k * 2) * 8]; bos_bolt(g, bos_boltPts(p[0], p[1], q[0], q[1], 4, 2.6, seed + k * 5), 0.85, '#ffffff', BOS_TB.bolt, a * 0.85); }
    }
  }

  // ================= THE RED DRAGON: level 60, bigger and meaner than the green =================
  // Crimson scales and gold flanks, wings on four finger bones with hooked claws and an ember glow through the membrane, a row
  // of tall orange back plates, curled ram horns, a cheek frill, a spade on the tail, smoke at rest and a roaring cone of fire.
  const BOS_RD = { body: '#b23a30', dark: '#6e1f18', wing: '#8a2a22', spine: '#ffb347', horn: '#e8dcc0', belly: '#f2bf6a', eye: '#ffd23a' };
  function bos_rdPlate(g, x, y, side, h, col) {
    g.beginPath(); g.moveTo(x + 1.9, y); g.quadraticCurveTo(x + 0.4, y + side * h * 0.7, x - 1.3, y + side * h); g.lineTo(x - 2.2, y + side * 0.3); g.closePath();
    g.fillStyle = vfill(g, col, y - h, y + h, 0.3, -0.2); g.fill(); outline(g, 0.4);
  }
  function bos_redDragon(g, e) {
    const C = BOS_RD, sw = swingOf(e), breath = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    const flap = Math.sin(time * (e.moving ? 2.6 : 1.3) + (e.seed || 0)), span = 0.84 + flap * 0.16, lift = 14;
    const body = (g, sh) => {
      const SH = 'rgba(0,0,0,0.2)';
      // ---- the tail, ending in a spade ----
      const tw = Math.sin(time * 1.5 + (e.seed || 0)) * 0.28 + (e.moving ? Math.sin(e.walkT * 0.5) * 0.12 : 0), ty = tw * 9;
      g.save(); g.translate(-15, 0); g.rotate(tw * 0.5);
      const tailPath = () => { g.beginPath(); g.moveTo(0, -5.8); g.quadraticCurveTo(-14, -4.4, -29, ty - 1.3); g.lineTo(-29, ty + 1.3); g.quadraticCurveTo(-14, 4.4, 0, 5.8); g.closePath(); };
      tailPath(); g.fillStyle = sh ? SH : vfill(g, C.body, -6, 6, 0.25, -0.3); g.fill();
      if (!sh) {
        tailPath(); outline(g, 0.8);
        g.strokeStyle = 'rgba(60,10,8,0.4)'; g.lineWidth = 0.5; for (let x = -4; x >= -24; x -= 3.4) { const yc = ty * (x / -29) ** 2, w = 5.4 * (1 + x / 34); g.beginPath(); g.moveTo(x + 1, yc - w * 0.8); g.quadraticCurveTo(x - 0.6, yc, x + 1, yc + w * 0.8); g.stroke(); }
      }
      g.beginPath(); g.moveTo(-26.6, ty); g.quadraticCurveTo(-28.6, ty - 6.6, -34, ty - 5.8); g.lineTo(-41, ty); g.lineTo(-34, ty + 5.8); g.quadraticCurveTo(-28.6, ty + 6.6, -26.6, ty); g.closePath();
      g.fillStyle = sh ? SH : vfill(g, C.dark, ty - 6, ty + 6, 0.3, -0.25); g.fill();
      if (!sh) {
        outline(g, 0.7); g.strokeStyle = C.spine; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-28.4, ty); g.lineTo(-39, ty); g.stroke();
        for (let i = 0, x = -2; x >= -24; x -= 4.4, i++) bos_rdPlate(g, x, ty * (x / -29) ** 2, i % 2 ? 1 : -1, 2.8 - i * 0.35, C.spine);
      }
      g.restore();
      // ---- the wings: an arm bone to the wrist, four finger bones, the membrane between them, a hooked claw on each ----
      for (const s of [-1, 1]) {
        const Y = v => s * v * span;
        const sh0 = [6, s * 6.6], wr = [-1 - flap * 1.8, Y(23)], f1 = [-3 - flap * 2.4, Y(46)], f2 = [-14.5 - flap * 1.4, Y(45)], f3 = [-24.5 - flap * 0.6, Y(37.5)], f4 = [-30.5, Y(24.5)], root = [-14, s * 6];
        const mem = () => {
          g.beginPath(); g.moveTo(...sh0); g.lineTo(...wr); g.lineTo(...f1);
          g.quadraticCurveTo(-9.5 - flap * 1.6, Y(36.5), ...f2); g.quadraticCurveTo(-18.5 - flap, Y(31.5), ...f3); g.quadraticCurveTo(-24.5, Y(23.5), ...f4); g.quadraticCurveTo(-22.5, Y(11.5), ...root); g.closePath();
        };
        mem();
        if (sh) { g.fillStyle = SH; g.fill(); continue; }
        const wg = g.createRadialGradient(sh0[0], sh0[1], 2, sh0[0], sh0[1], 46 * span);
        wg.addColorStop(0, '#e0602c'); wg.addColorStop(0.3, '#b23a28'); wg.addColorStop(0.7, C.wing); wg.addColorStop(1, '#4e1610');
        g.fillStyle = wg; g.fill();
        g.save(); mem(); g.clip();
        g.strokeStyle = 'rgba(255,170,80,0.4)'; g.lineWidth = 0.5;
        for (const [a, b] of [[f1, f2], [f2, f3], [f3, f4]]) { const m = bos_pt(a, b, 0.5), c = bos_pt(wr, m, 0.5); g.beginPath(); g.moveTo(...wr); g.quadraticCurveTo(c[0] + 2, c[1], m[0], m[1]); g.stroke(); g.beginPath(); g.moveTo(...bos_pt(wr, a, 0.4)); g.lineTo(...bos_pt(m, b, 0.3)); g.stroke(); }
        g.fillStyle = 'rgba(40,6,4,0.25)'; g.beginPath(); g.moveTo(...wr); g.lineTo(...f3); g.lineTo(...f4); g.lineTo(...root); g.closePath(); g.fill();
        g.restore();
        mem(); outline(g, 0.9);
        g.lineCap = 'round'; g.strokeStyle = C.dark; g.lineWidth = 2.4; g.beginPath(); g.moveTo(...sh0); g.lineTo(...wr); g.stroke();
        g.lineWidth = 1.4; g.beginPath(); for (const f of [f1, f2, f3, f4]) { g.moveTo(...wr); g.lineTo(...f); } g.stroke();
        g.strokeStyle = 'rgba(255,150,110,0.45)'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(sh0[0] - 0.4, sh0[1]); g.lineTo(wr[0] - 0.4, wr[1]); g.stroke();
        ell(g, wr[0], wr[1], 1.6, 1.6); g.fillStyle = C.dark; g.fill(); outline(g, 0.4);
        for (const f of [f1, f2, f3, f4, [wr[0] + 2, wr[1] + s * 0.4]]) {
          const dx = f[0] - wr[0], dy = f[1] - wr[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, big = f[0] === wr[0] + 2 ? 1.4 : 1;
          const tip = [f[0] + ux * 2.8 * big - uy * s * 0.8, f[1] + uy * 2.8 * big + ux * s * 0.8];
          if (big > 1) { tip[0] = wr[0] + 4.2; tip[1] = wr[1] - s * 0.6; }
          g.beginPath(); g.moveTo(f[0] - uy * 0.8, f[1] + ux * 0.8); g.quadraticCurveTo(tip[0] - ux, tip[1] - uy, tip[0], tip[1]); g.lineTo(f[0] + uy * 0.8, f[1] - ux * 0.8); g.closePath();
          g.fillStyle = C.horn; g.fill(); outline(g, 0.35);
        }
      }
      // ---- four legs, tucked, clawed ----
      for (const [x, s, k] of [[8, -1, 0], [8, 1, 1], [-9, -1, 2], [-9, 1, 3]]) {
        const paddle = e.moving ? Math.sin(e.walkT + k * Math.PI / 2) * 0.22 : 0;
        g.save(); g.translate(x, s * 7.8); g.rotate(s * ((x > 0 ? 0.8 : 2.25) + paddle));
        rr(g, 0, -2, 6.8, 4, 2); g.fillStyle = sh ? SH : vfill(g, C.body, -2, 2); g.fill();
        if (!sh) { outline(g, 0.6); bos_claws(g, 6.6, 1.25, C.horn, 3); }
        g.restore();
      }
      // ---- the body ----
      ell(g, -2, 0, 17.5, 10); g.fillStyle = sh ? SH : rfill(g, C.body, -2, 0, 17.5); g.fill(); if (sh) return; outline(g, 1);
      g.save(); ell(g, -2, 0, 17.5, 10); g.clip();
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(-19, s * 6.4); g.quadraticCurveTo(-2, s * 12.4, 15, s * 5.6); g.quadraticCurveTo(-2, s * 8.2, -19, s * 6.4); g.fillStyle = vfill(g, C.belly, -10, 10, 0.2, -0.2); g.fill();
        g.strokeStyle = 'rgba(150,80,20,0.55)'; g.lineWidth = 0.45; for (let x = -15; x <= 11; x += 2.6) { const yy = s * (7.6 + Math.cos((x + 2) / 17 * 1.4) * 1.6); g.beginPath(); g.moveTo(x, yy - s * 1.1); g.lineTo(x - 0.6, yy + s * 1.4); g.stroke(); }
      }
      g.strokeStyle = 'rgba(70,10,8,0.3)'; g.lineWidth = 0.5;
      for (let row = 0; row < 4; row++) for (let k = -6; k <= 4; k++) { const x = k * 3 + (row % 2) * 1.5, y = -5.6 + row * 3.6; g.beginPath(); g.arc(x, y, 1.4, 0.3, Math.PI - 0.3); g.stroke(); }
      g.restore();
      g.fillStyle = 'rgba(255,220,200,0.16)'; ell(g, -5, -4.6, 11, 2.6, -0.05); g.fill();
      g.fillStyle = C.dark; ell(g, -2, 0, 15.5, 1.8); g.fill();
      for (let i = 0, x = 12; x >= -16; x -= 3.5, i++) bos_rdPlate(g, x, 0, i % 2 ? 1 : -1, 4.2 - Math.abs(x + 2) * 0.07, C.spine);
      // ---- the neck and head ----
      g.beginPath(); g.moveTo(11, -6.4); g.quadraticCurveTo(19, -4.6, 25, -3.9); g.lineTo(25, 3.9); g.quadraticCurveTo(19, 4.6, 11, 6.4); g.closePath();
      g.fillStyle = vfill(g, C.body, -6, 6, 0.25, -0.3); g.fill(); outline(g, 0.8);
      g.fillStyle = vfill(g, C.belly, -5, 5); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(12, s * 5.6); g.quadraticCurveTo(19, s * 4.4, 24.6, s * 3.6); g.quadraticCurveTo(19, s * 3.4, 12, s * 4.2); g.fill(); }
      for (let i = 0, x = 23; x >= 14; x -= 3, i++) bos_rdPlate(g, x, 0, i % 2 ? -1 : 1, 2.6, C.spine);
      g.save(); g.translate(28, 0); g.scale(1.15, 1.15);
      for (const s of [-1, 1]) {
        // a ram's horn curling at each side of the head: back, out, and round to the front, ridged
        const H = []; for (let i = 0; i <= 16; i++) { const t = i / 16, q = -0.9 - t * 4.4, rho = 5.6 * (1 - t * 0.45); H.push([-3 + Math.cos(q) * rho, s * (7.4 + Math.sin(q) * rho), 1.7 * (1 - t * 0.72)]); }
        const { L: HL, R: HR } = bos_tubePath(g, H); g.fillStyle = vfill(g, C.horn, -12, 12, 0.25, -0.3); g.fill(); outline(g, 0.5);
        g.strokeStyle = 'rgba(120,100,70,0.6)'; g.lineWidth = 0.4; for (let i = 2; i < 15; i += 2) { g.beginPath(); g.moveTo(...HL[i]); g.lineTo(...HR[i]); g.stroke(); }
        // the cheek frill: three dark spines
        g.fillStyle = C.dark; for (const [x, l] of [[3.2, 5.6], [1, 6.4], [-1.2, 5]]) { g.beginPath(); g.moveTo(x + 1.2, s * 4.4); g.lineTo(x - 2.6, s * (4.4 + l * 0.75)); g.lineTo(x - 0.8, s * 4.6); g.closePath(); g.fill(); outline(g, 0.3); }
      }
      g.beginPath(); g.moveTo(-3.6, -5.4); g.quadraticCurveTo(5, -6.6, 11.4, -3.2); g.quadraticCurveTo(14.2, 0, 11.4, 3.2); g.quadraticCurveTo(5, 6.6, -3.6, 5.4); g.quadraticCurveTo(-5.4, 0, -3.6, -5.4); g.closePath();
      g.fillStyle = rfill(g, C.body, 4, 0, 10); g.fill(); outline(g, 0.9);
      g.strokeStyle = C.dark; g.lineWidth = 0.55; g.beginPath(); g.moveTo(6, -2.2); g.quadraticCurveTo(9.4, -1.6, 11.8, -1); g.moveTo(6, 2.2); g.quadraticCurveTo(9.4, 1.6, 11.8, 1); g.stroke();
      // the nose horn
      g.beginPath(); g.moveTo(6.4, -1); g.lineTo(10.6, 0); g.lineTo(6.4, 1); g.closePath(); g.fillStyle = C.horn; g.fill(); outline(g, 0.3);
      for (const s of [-1, 1]) {
        g.strokeStyle = C.dark; g.lineWidth = 1.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(2, s * 4.4); g.quadraticCurveTo(4.6, s * 4.6, 6.8, s * 3); g.stroke();
        bos_glow(g, 4.8, s * 3.1, 3.2, 3.2, '#ffb030', 0.45 + Math.sin(time * 3) * 0.15);
        ell(g, 4.8, s * 3.1, 1.5, 1); g.fillStyle = C.eye; g.fill(); outline(g, 0.3);
        ell(g, 5, s * 3.1, 0.35, 0.85); g.fillStyle = '#2a0a06'; g.fill();
        ell(g, 12, s * 1.3, 0.55, 0.4); g.fillStyle = '#2a0a06'; g.fill();
      }
      if (breath > 0) {
        g.beginPath(); g.moveTo(8.4, 0); g.lineTo(14.4, -2.8 * breath); g.lineTo(14.4, 2.8 * breath); g.closePath(); g.fillStyle = '#3a0e0a'; g.fill();
        g.fillStyle = '#fbf6e8'; for (const s of [-1, 1]) for (const x of [10.4, 12.4]) { g.beginPath(); g.moveTo(x, s * 2.5 * breath * (x - 8.4) / 6); g.lineTo(x + 0.6, s * 0.9); g.lineTo(x + 1.2, s * 2.5 * breath * (x - 7.2) / 6); g.closePath(); g.fill(); }
        bos_glow(g, 13, 0, 7, 7, '#ffb347', 0.8 * breath);
      } else for (let k = 0; k < 4; k++) {
        const u = (time * 0.45 + k / 4) % 1, s = k % 2 ? 1 : -1;
        g.fillStyle = `rgba(110,96,92,${0.38 * (1 - u)})`; ell(g, 12.6 + u * 9, s * (1.4 + u * 3), 0.8 + u * 2.4, 0.8 + u * 2.2); g.fill();
      }
      g.restore();
      if (breath > 0) bos_breathCone(g, 43.5, 56 * breath, 36 * (0.55 + breath * 0.45), ['#fff3b0', '#ffa53a', '#d8341c'], 1);
    };
    g.save(); g.translate(0, -lift); topDown(g, e, body, { x: 7, y: lift + 9 }); g.restore();
  }

  // ================= THE DUSTJAW: a canyon beast that chews the rock =================
  // Squat and heavy, seen from the side like the boar and the wolf: armadillo bands of sandstone armour over a hunched back,
  // a stubby armoured club of a tail, thick legs with digging claws, a low head under a heavy brow and the jaw that is its
  // name: a huge underbite of pale bone with jagged teeth, always chewing, spilling red grit. Its attack is a pounce.
  const BOS_DJ = { hide: '#6a4a3c', plate: '#9a7056', plate2: '#b88a64', ridge: '#4a3327', head: '#7a5644', jaw: '#d9d0c0', eye: '#f5c542', claw: '#ece2cc', grit: '#b4643a' };
  function bos_djLeg(g, x, y, a, len, w, dim, front) {
    g.save(); g.translate(x, y); g.rotate(a);
    const c = dim ? bos_hex(BOS_DJ.hide, -0.22) : BOS_DJ.hide;
    rr(g, -w / 2, -1, w, len * 0.62, w / 2); g.fillStyle = vfill(g, c, -1, len * 0.6); g.fill(); outline(g, 0.6);
    rr(g, -w * 0.42, len * 0.42, w * 0.84, len * 0.5, w * 0.36); g.fillStyle = vfill(g, bos_hex(c, -0.08), len * 0.4, len); g.fill(); outline(g, 0.5);
    ell(g, 0.6, len * 0.92, w * 0.62, w * 0.34); g.fillStyle = shade(c, -0.2); g.fill(); outline(g, 0.5);
    g.fillStyle = dim ? bos_hex(BOS_DJ.claw, -0.25) : BOS_DJ.claw;
    for (const k of [-1, 0, 1]) { const cx = w * 0.4 + k * w * 0.32; g.beginPath(); g.moveTo(cx - 0.7, len * 0.88); g.quadraticCurveTo(cx + 1.8, len * 0.9, cx + 2.4, len * 1.06); g.quadraticCurveTo(cx + 1, len * 1.06, cx - 0.5, len * 1.0); g.closePath(); g.fill(); outline(g, 0.3); }
    if (!dim && front) { g.strokeStyle = 'rgba(40,24,16,0.45)'; g.lineWidth = 0.4; for (const yy of [len * 0.25, len * 0.36]) { g.beginPath(); g.moveTo(-w / 2 + 0.4, yy); g.lineTo(w / 2 - 0.4, yy + 0.4); g.stroke(); } }
    g.restore();
  }
  function bos_djHeadSide(g, jawA, shot) {
    // around the jaw hinge; +x forward. The lower jaw first, then the head over it
    g.save(); g.rotate(jawA);
    g.beginPath(); g.moveTo(-0.6, 0.4); g.quadraticCurveTo(7, 1.4, 14.6, -0.6); g.quadraticCurveTo(16, 3.6, 13, 6.2); g.quadraticCurveTo(5.4, 7.6, -1.2, 4.6); g.closePath();
    g.fillStyle = vfill(g, BOS_DJ.jaw, -1, 7, 0.2, -0.3); g.fill(); outline(g, 0.7);
    g.strokeStyle = 'rgba(110,90,70,0.55)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(3, 3.4); g.lineTo(6, 4.6); g.lineTo(8.6, 3.8); g.moveTo(10, 5.4); g.lineTo(12, 4); g.stroke();
    // the jagged teeth of the underbite, the front two standing up like tusks
    g.fillStyle = '#f4efe2';
    for (const [x, h, w] of [[13.4, 5.4, 1.5], [11, 4, 1.3], [8.4, 2.6, 1.1], [5.8, 2.2, 1], [3.4, 1.8, 0.9]]) { g.beginPath(); g.moveTo(x - w, 0.6 + (14 - x) * 0.04); g.lineTo(x - 0.2, -h); g.lineTo(x + w * 0.8, 0.2); g.closePath(); g.fill(); outline(g, 0.35); }
    g.restore();
    if (shot > 0.05) { g.fillStyle = '#3a1a12'; g.beginPath(); g.moveTo(0.6, 0.6); g.lineTo(12.6, -1); g.lineTo(12, 2 + jawA * 9); g.lineTo(0.6, 2.4); g.closePath(); g.fill(); }
    g.beginPath(); g.moveTo(-2, -6.6); g.quadraticCurveTo(5, -9.4, 10.6, -6); g.lineTo(12.8, -1.6); g.quadraticCurveTo(11.8, 0.8, 9, 0.9); g.lineTo(-0.6, 1.4); g.closePath();
    g.fillStyle = vfill(g, BOS_DJ.head, -9, 1, 0.2, -0.3); g.fill(); outline(g, 0.8);
    g.fillStyle = '#fbf6e8'; for (const x of [4, 6.4, 8.8, 10.8]) { g.beginPath(); g.moveTo(x - 0.8, 1.1); g.lineTo(x, 2.8); g.lineTo(x + 0.8, 0.9); g.closePath(); g.fill(); }
    ell(g, 12.2, -2.8, 0.6, 0.45); g.fillStyle = '#2a1a12'; g.fill();
    // the brow plate, with two stubby rock horns
    g.fillStyle = BOS_DJ.claw; for (const [x, l] of [[1.4, 3.4], [4.6, 2.6]]) { g.beginPath(); g.moveTo(x - 1.3, -7.4); g.quadraticCurveTo(x - 1.6, -7.6 - l, x - 2.6, -8 - l); g.quadraticCurveTo(x + 0.2, -8 - l * 0.6, x + 1.2, -7.6); g.closePath(); g.fill(); outline(g, 0.35); }
    g.beginPath(); g.moveTo(-2.6, -7.2); g.quadraticCurveTo(4.6, -10.2, 10.4, -6.6); g.lineTo(9.6, -4.4); g.quadraticCurveTo(5.6, -6.4, -1.2, -4.2); g.closePath();
    g.fillStyle = vfill(g, BOS_DJ.plate, -10, -4, 0.3, -0.2); g.fill(); outline(g, 0.6);
    g.fillStyle = BOS_DJ.plate2; for (const x of [1.6, 4.2, 6.8]) { ell(g, x, -7.4 + Math.abs(x - 4) * 0.1, 0.7, 0.5); g.fill(); }
    // a small yellow eye in a dark socket under the brow
    ell(g, 7.4, -3.4, 1.7, 1.3); g.fillStyle = '#2a1a12'; g.fill();
    bos_glow(g, 7.6, -3.4, 2.8, 2.8, BOS_DJ.eye, 0.35 + shot * 0.3);
    ell(g, 7.7, -3.4, 1.05, 0.85); g.fillStyle = BOS_DJ.eye; g.fill(); ell(g, 8, -3.4, 0.35, 0.65); g.fillStyle = '#1a0e08'; g.fill();
    g.strokeStyle = BOS_DJ.ridge; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(5.4, -5.2); g.lineTo(9.4, -4.6); g.stroke();
  }
  function bos_djBands(g, P0, C1, P1, C2, P2, n, thick) {
    // armadillo bands along the back curve (two quadratic pieces), rump first so each one lies over the one behind it
    const at = t => t < 1 ? bos_q(P0, C1, P1, t) : bos_q(P1, C2, P2, t - 1);
    for (let i = 0; i < n; i++) {
      const t0 = i / n * 2 - 0.04, t1 = (i + 1) / n * 2 + 0.04, top = [], bot = [];
      for (let k = 0; k <= 5; k++) {
        const t = Math.max(0, Math.min(2, lerp(t0, t1, k / 5))), p = at(t), q = at(Math.min(2, t + 0.02)), pp = at(Math.max(0, t - 0.02));
        // outward normal (up)
        const dx = q[0] - pp[0], dy = q[1] - pp[1], L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = -dx / L;
        top.push([p[0] + nx * 1.3, p[1] + ny * 1.3]); bot.push([p[0] - nx * thick, p[1] - ny * thick]);
      }
      g.beginPath(); g.moveTo(...top[0]); for (const p of top) g.lineTo(...p); for (let k = bot.length - 1; k >= 0; k--) g.lineTo(...bot[k]); g.closePath();
      g.fillStyle = vfill(g, i % 2 ? BOS_DJ.plate : bos_hex(BOS_DJ.plate, -0.07), top[2][1] - 1, bot[2][1] + 1, 0.3, -0.25); g.fill(); outline(g, 0.6);
      g.strokeStyle = BOS_DJ.ridge; g.lineWidth = 0.55; g.beginPath(); g.moveTo(...bot[0]); g.lineTo(...top[0]); g.stroke();
      g.strokeStyle = 'rgba(255,230,190,0.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(...bos_pt(top[1], bot[1], 0.15)); for (let k = 2; k < 5; k++) g.lineTo(...bos_pt(top[k], bot[k], 0.15)); g.stroke();
      g.fillStyle = BOS_DJ.plate2; ell(g, ...bos_pt(top[3], bot[3], 0.42), 0.8, 0.8); g.fill(); outline(g, 0.3);
    }
  }
  function bos_djSide(g, e, sw, bob) {
    const shot = sw >= 0 ? Math.sin(sw * Math.PI) : 0, ph = e.moving ? e.walkT : 0;
    const chew = shot > 0 ? 0.62 * shot : 0.05 + (Math.sin(time * 6 + (e.seed || 0)) + 1) * 0.07;
    // a pounce: it rears up off the back legs, the front legs reach and the jaw gapes
    g.translate(-10, 11); g.rotate(-shot * 0.2); g.translate(10, -11 - shot * 4);
    if (shot > 0.05) for (let k = 0; k < 4; k++) { const u = (k / 4 + sw) % 1; g.fillStyle = `rgba(200,150,110,${0.45 * (1 - u) * shot})`; ell(g, -16 - u * 10, 10 - u * 3 + k, 2.4 + u * 3, 1.6 + u * 2); g.fill(); }
    else if (e.moving) for (let k = 0; k < 2; k++) { const u = ((ph / Math.PI + k * 0.5) % 1); g.fillStyle = `rgba(200,150,110,${0.35 * (1 - u)})`; ell(g, -12 + k * 18 - u * 5, 11.4 - u * 2, 1.4 + u * 2, 1 + u * 1.2); g.fill(); }
    const legA = (p) => e.moving ? Math.sin(ph + p) * 0.42 : 0;
    // far legs (darker), then the near ones
    bos_djLeg(g, -8.6, 2 + bob, legA(0) + shot * 0.7, 9.6, 4.6, true, false);
    bos_djLeg(g, 7.6, 1 + bob, legA(Math.PI) - shot * 1.2, 9.8, 4.8, true, true);
    // the club tail
    g.save(); g.translate(-14.6, -0.6 + bob); g.rotate(Math.sin(time * 2 + (e.seed || 0)) * 0.08 + (e.moving ? Math.sin(ph) * 0.06 : 0) + shot * 0.25);
    g.beginPath(); g.moveTo(0.6, -3.4); g.quadraticCurveTo(-5.6, -2.4, -9, 1.8); g.lineTo(-8, 4.6); g.quadraticCurveTo(-4, 2.6, 0.6, 3); g.closePath(); g.fillStyle = vfill(g, BOS_DJ.hide, -4, 4); g.fill(); outline(g, 0.6);
    for (const x of [-2, -5]) { g.beginPath(); g.moveTo(x + 1.6, -2.8 + (x + 2) * -0.3); g.quadraticCurveTo(x, -3.6 + (x + 2) * -0.3, x - 1.8, -1.6 + (x + 2) * -0.5); g.lineTo(x - 0.8, 2.8); g.lineTo(x + 1.6, 2.6); g.closePath(); g.fillStyle = vfill(g, BOS_DJ.plate, -4, 3); g.fill(); outline(g, 0.45); }
    ell(g, -10.2, 3, 3.4, 2.9); g.fillStyle = rfill(g, BOS_DJ.plate, -10.2, 3, 3.4); g.fill(); outline(g, 0.6);
    g.fillStyle = BOS_DJ.claw; for (const [x, y, a] of [[-10.6, 0, -1.7], [-13.2, 2.6, 3.1], [-10.4, 6, 1.6]]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(-1, 0.2); g.lineTo(0, -2); g.lineTo(1, 0.2); g.closePath(); g.fill(); outline(g, 0.3); g.restore(); }
    g.restore();
    g.translate(0, bob);
    // the hunched body
    const P0 = [-15.4, -6.4], C1 = [-7, -15], P1 = [3.6, -13.8], C2 = [11.4, -12.8], P2 = [13.6, -5];
    const bodyPath = () => { g.beginPath(); g.moveTo(-16, 3.4); g.quadraticCurveTo(-19.2, -2.4, ...P0); g.quadraticCurveTo(...C1, ...P1); g.quadraticCurveTo(...C2, ...P2); g.lineTo(13.2, 3); g.quadraticCurveTo(0, 7.8, -16, 3.4); g.closePath(); };
    bodyPath(); g.fillStyle = vfill(g, BOS_DJ.hide, -14, 7, 0.15, -0.3); g.fill(); outline(g, 0.9);
    g.save(); bodyPath(); g.clip(); g.strokeStyle = 'rgba(30,18,12,0.35)'; g.lineWidth = 0.5; for (let x = -12; x <= 10; x += 2.6) { g.beginPath(); g.moveTo(x, 1); g.lineTo(x - 0.8, 4.6); g.stroke(); } g.restore();
    bos_djBands(g, P0, C1, P1, C2, P2, 6, 8);
    // two rock spikes on the hump
    g.fillStyle = BOS_DJ.plate2; for (const [x, y, h] of [[0, -14.4, 3], [4.6, -14.3, 2.4]]) { g.beginPath(); g.moveTo(x - 1.6, y + 1); g.lineTo(x - 0.6, y - h); g.lineTo(x + 1.4, y + 1); g.closePath(); g.fill(); outline(g, 0.4); }
    // the near legs over the body
    bos_djLeg(g, -9.6, 2.6, legA(Math.PI) + shot * 0.7, 9.2, 5, false, false);
    bos_djLeg(g, 6.4, 1.6, legA(0) - shot * 1.3, 9.4, 5.2, false, true);
    // the head, low and forward
    g.save(); g.translate(12.4, 0.8); g.rotate(-shot * 0.15); bos_djHeadSide(g, chew, shot);
    // grit falling from the jaw as it chews
    if (shot < 0.05) for (let k = 0; k < 3; k++) { const u = (time * 1.4 + k / 3) % 1; g.fillStyle = bos_rgba(BOS_DJ.grit, 0.9 * (1 - u * 0.6)); g.beginPath(); const x = 14 + k * 1.2 - u, y = 3 + u * 9; g.moveTo(x, y - 0.6); g.lineTo(x + 0.6, y); g.lineTo(x, y + 0.6); g.lineTo(x - 0.6, y); g.closePath(); g.fill(); }
    g.restore();
  }
  function bos_djFront(g, e, sw) {
    const shot = sw >= 0 ? Math.sin(sw * Math.PI) : 0, step = e.moving ? Math.sin(e.walkT) : 0;
    const chew = shot > 0 ? 3.6 * shot : 0.3 + (Math.sin(time * 6 + (e.seed || 0)) + 1) * 0.45;
    g.translate(0, shot * 3); g.scale(1 + shot * 0.08, 1 + shot * 0.08);
    // the dome of the back, banded, behind the head
    ell(g, 0, -4, 16.6, 11); g.fillStyle = vfill(g, BOS_DJ.hide, -15, 7); g.fill(); outline(g, 0.9);
    for (let i = 0; i < 4; i++) { const ry = 11 - i * 2.4, rx = 16.8 - i * 0.6, yc = -4 + i * 0.6; g.beginPath(); g.ellipse(0, yc, rx, ry, 0, Math.PI, 0); g.ellipse(0, yc + 2.6, rx - 0.4, ry - 2.2, 0, 0, Math.PI, true); g.closePath(); g.fillStyle = vfill(g, i % 2 ? BOS_DJ.plate : bos_hex(BOS_DJ.plate, -0.08), yc - ry, yc, 0.3, -0.2); g.fill(); outline(g, 0.55); g.fillStyle = BOS_DJ.plate2; ell(g, 0, yc - ry + 0.9, 0.9, 0.6); g.fill(); }
    // front legs splayed, claws forward
    for (const s of [-1, 1]) {
      const lift = (s > 0 ? step : -step) * 1.2 + shot * 2.4;
      g.save(); g.translate(s * 11.4, 2 - lift); g.scale(s, 1);
      rr(g, -2.8, -2, 5.6, 9.6, 2.6); g.fillStyle = vfill(g, BOS_DJ.hide, -2, 8); g.fill(); outline(g, 0.7);
      ell(g, 0, 8, 3.6, 1.8); g.fillStyle = shade(BOS_DJ.hide, -0.2); g.fill(); outline(g, 0.5);
      g.fillStyle = BOS_DJ.claw; for (const k of [-1.6, 0, 1.6]) { g.beginPath(); g.moveTo(k - 0.8, 8.4); g.quadraticCurveTo(k, 11.4, k + 0.2, 11.6); g.quadraticCurveTo(k + 0.6, 10.4, k + 0.8, 8.4); g.closePath(); g.fill(); outline(g, 0.3); }
      g.restore();
    }
    // the head: brow plate, eyes, snout over the great underbite
    const hy = 1;
    if (shot > 0.05) { g.fillStyle = '#3a1a12'; rr(g, -8.4, hy + 3, 16.8, 3 + chew, 2); g.fill(); }
    g.beginPath(); g.moveTo(-9.6, hy - 5); g.quadraticCurveTo(0, hy - 8.6, 9.6, hy - 5); g.lineTo(8.6, hy + 3.4); g.quadraticCurveTo(0, hy + 5, -8.6, hy + 3.4); g.closePath();
    g.fillStyle = vfill(g, BOS_DJ.head, hy - 8, hy + 4); g.fill(); outline(g, 0.8);
    g.fillStyle = '#fbf6e8'; for (const x of [-5.4, -2.8, 2.8, 5.4]) { g.beginPath(); g.moveTo(x - 0.9, hy + 3.6); g.lineTo(x, hy + 5.4); g.lineTo(x + 0.9, hy + 3.6); g.closePath(); g.fill(); }
    ell(g, -1.4, hy + 1.2, 0.7, 0.5); ell(g, 1.4, hy + 1.2, 0.7, 0.5); g.fillStyle = '#2a1a12'; g.fill();
    // the lower jaw, wide as the head, its teeth standing up in front
    g.save(); g.translate(0, chew);
    g.beginPath(); g.moveTo(-10.4, hy + 4); g.quadraticCurveTo(0, hy + 5.6, 10.4, hy + 4); g.quadraticCurveTo(10.6, hy + 9.4, 0, hy + 10.6); g.quadraticCurveTo(-10.6, hy + 9.4, -10.4, hy + 4); g.closePath();
    g.fillStyle = vfill(g, BOS_DJ.jaw, hy + 3, hy + 11, 0.2, -0.3); g.fill(); outline(g, 0.7);
    g.fillStyle = '#f4efe2'; for (const [x, h] of [[-8.6, 5.4], [-5.8, 3.2], [-3, 2.4], [0, 2.2], [3, 2.4], [5.8, 3.2], [8.6, 5.4]]) { g.beginPath(); g.moveTo(x - 1.1, hy + 4.8); g.lineTo(x + (x < 0 ? 0.3 : -0.3), hy + 4.6 - h); g.lineTo(x + 1.1, hy + 4.8); g.closePath(); g.fill(); outline(g, 0.35); }
    g.strokeStyle = 'rgba(110,90,70,0.55)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-6, hy + 8); g.lineTo(-3, hy + 7.2); g.moveTo(4, hy + 8.6); g.lineTo(6.6, hy + 7.4); g.stroke();
    g.restore();
    g.fillStyle = BOS_DJ.claw; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.6, hy - 6.8); g.quadraticCurveTo(s * 5, hy - 10.4, s * 6.6, hy - 11.2); g.quadraticCurveTo(s * 6, hy - 8.6, s * 6.4, hy - 6.4); g.closePath(); g.fill(); outline(g, 0.35); }
    g.beginPath(); g.moveTo(-10.2, hy - 4.8); g.quadraticCurveTo(0, hy - 9.6, 10.2, hy - 4.8); g.lineTo(9, hy - 2.2); g.quadraticCurveTo(0, hy - 5.6, -9, hy - 2.2); g.closePath();
    g.fillStyle = vfill(g, BOS_DJ.plate, hy - 9, hy - 2, 0.3, -0.2); g.fill(); outline(g, 0.6);
    for (const s of [-1, 1]) {
      ell(g, s * 5, hy - 1, 1.9, 1.4); g.fillStyle = '#2a1a12'; g.fill();
      bos_glow(g, s * 5, hy - 1, 3, 3, BOS_DJ.eye, 0.35 + shot * 0.3);
      ell(g, s * 5, hy - 1, 1.15, 0.95); g.fillStyle = BOS_DJ.eye; g.fill(); ell(g, s * 5, hy - 1, 0.35, 0.7); g.fillStyle = '#1a0e08'; g.fill();
      g.strokeStyle = BOS_DJ.ridge; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * 2.8, hy - 2.6); g.lineTo(s * 7, hy - 2.2); g.stroke();
    }
    if (shot < 0.05) for (let k = 0; k < 3; k++) { const u = (time * 1.4 + k / 3) % 1, x = (k - 1) * 4 + Math.sin(k * 5) * 1.4, y = hy + 9 + u * 4; g.fillStyle = bos_rgba(BOS_DJ.grit, 0.9 * (1 - u)); ell(g, x, y + chew, 0.6, 0.6); g.fill(); }
  }
  function bos_djRear(g, e) {
    const step = e.moving ? Math.sin(e.walkT) : 0;
    for (const s of [-1, 1]) {
      const lift = (s > 0 ? -step : step) * 1.2;
      g.save(); g.translate(s * 10.6, 2.6 - lift); rr(g, -2.8, -2, 5.6, 9, 2.6); g.fillStyle = vfill(g, bos_hex(BOS_DJ.hide, -0.1), -2, 8); g.fill(); outline(g, 0.7);
      ell(g, 0, 7.4, 3.4, 1.7); g.fillStyle = shade(BOS_DJ.hide, -0.25); g.fill(); outline(g, 0.5); g.restore();
    }
    ell(g, 0, -3, 16.4, 11.6); g.fillStyle = vfill(g, BOS_DJ.hide, -15, 8); g.fill(); outline(g, 0.9);
    for (let i = 0; i < 5; i++) { const yc = -12 + i * 3.6, rx = 15.6 - Math.abs(i - 1.6) * 1.3; g.beginPath(); g.ellipse(0, yc + 3.2, rx, 3.6, 0, Math.PI, 0); g.lineTo(rx - 0.6, yc + 5.6); g.ellipse(0, yc + 5.6, rx - 0.6, 2.6, 0, 0, Math.PI); g.closePath(); g.fillStyle = vfill(g, i % 2 ? BOS_DJ.plate : bos_hex(BOS_DJ.plate, -0.08), yc, yc + 7, 0.3, -0.2); g.fill(); outline(g, 0.55); g.fillStyle = BOS_DJ.plate2; ell(g, 0, yc + 0.6, 0.9, 0.6); g.fill(); }
    g.fillStyle = BOS_DJ.claw; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2.6, -13.2); g.lineTo(s * 4.6, -17.4); g.lineTo(s * 5.4, -13); g.closePath(); g.fill(); outline(g, 0.35); }
    const t = Math.sin(time * 2 + (e.seed || 0)) * 1.6 + step * 0.8;
    g.beginPath(); g.moveTo(-3.4, 4); g.quadraticCurveTo(t * 0.5, 8, t - 2, 11); g.lineTo(t + 2, 11); g.quadraticCurveTo(t * 0.5 + 1, 8, 3.4, 4); g.closePath(); g.fillStyle = vfill(g, BOS_DJ.hide, 4, 12); g.fill(); outline(g, 0.6);
    ell(g, t, 12.4, 3.6, 3); g.fillStyle = rfill(g, BOS_DJ.plate, t, 12.4, 3.6); g.fill(); outline(g, 0.6);
    g.fillStyle = BOS_DJ.claw; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(t + s * 2.6, 11.4); g.lineTo(t + s * 5.4, 11.8); g.lineTo(t + s * 2.8, 13.4); g.closePath(); g.fill(); outline(g, 0.3); }
  }
  function bos_dustjaw(g, e) { drawQuad(g, e, { ground: 11.6, sh: 21, side: bos_djSide, front: bos_djFront, rear: bos_djRear, lunge: 7 }); }

  // ================= THE FANG: the final boss, a legendary elemental dragon =================
  // Today's identity kept and made grand: a serpent's neck and tail of shrinking segments with a glowing gem on each, four
  // clawed legs, great wings, a crested horned head and ONE enormous fang, wrapped in an aura of its element. The element
  // cycles fire, ice, storm and stone (e.element when the game sets it; on this page the clock turns it, fire first) and
  // tints everything: scales, wings, eyes, the motes that circle it, and the breath it attacks with.
  const BOS_EL = {
    fire: { col: '#ff6a1a', scale: '#7a2a1a', scale2: '#5a1e14', mem: '#ff7a30', eye: '#ffd166', mote: '#ffb347', belly: '#e0955a', glow: '#ff7a28', breath: ['#fff3b0', '#ffa53a', '#d8341c'] },
    ice: { col: '#8fd3ff', scale: '#3a6a8a', scale2: '#2a5070', mem: '#a6dcff', eye: '#e6f7ff', mote: '#bfe3ff', belly: '#cfe6f2', glow: '#8cd2ff', breath: ['#ffffff', '#c4ecff', '#5aa8e0'] },
    storm: { col: '#d8c8ff', scale: '#3a3a5a', scale2: '#2a2a44', mem: '#c4b0ff', eye: '#fff7c0', mote: '#e8e0ff', belly: '#b4acd6', glow: '#b8a4ff', breath: ['#ffffff', '#fff7c0', '#a890ff'] },
    stone: { col: '#b0a08a', scale: '#5a554e', scale2: '#45413b', mem: '#a39780', eye: '#ffb347', mote: '#8d9098', belly: '#a89c88', glow: '#c8b89a', breath: ['#e0d4bc', '#a8977a', '#6a5e50'] },
  };
  const BOS_ELS = ['fire', 'ice', 'storm', 'stone'];
  function bos_fangGem(g, x, y, r, C, el) {
    // a shard of ice standing up off the spine
    if (el === 'ice') {
      g.beginPath(); g.moveTo(x + r * 1.1, y); g.lineTo(x + r * 0.2, y - r * 0.7); g.lineTo(x - r * 1.5, y - r * 0.2); g.lineTo(x - r * 1.5, y + r * 0.2); g.lineTo(x + r * 0.2, y + r * 0.7); g.closePath();
      g.fillStyle = vfill(g, '#dff4ff', y - r, y + r, 0.4, -0.25); g.fill(); outline(g, 0.4); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(x + r * 0.9, y); g.lineTo(x - r * 1.3, y); g.stroke(); return;
    }
    // a rough slab of rock
    if (el === 'stone') {
      g.beginPath(); g.moveTo(x + r, y - r * 0.2); g.lineTo(x + r * 0.2, y - r * 0.9); g.lineTo(x - r * 0.9, y - r * 0.6); g.lineTo(x - r * 1.1, y + r * 0.4); g.lineTo(x, y + r * 0.9); g.lineTo(x + r * 0.8, y + r * 0.5); g.closePath();
      g.fillStyle = rfill(g, '#9a8e7a', x, y, r); g.fill(); outline(g, 0.45); return;
    }
    bos_glow(g, x, y, r * 2.4, r * 2.4, C.col, 0.6 + Math.sin(time * 4 + x) * 0.2);
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x, y - r * 0.7); g.lineTo(x - r, y); g.lineTo(x, y + r * 0.7); g.closePath();
    g.fillStyle = vfill(g, C.col, y - r, y + r, 0.45, -0.2); g.fill(); outline(g, 0.4);
    g.fillStyle = 'rgba(255,255,255,0.7)'; ell(g, x - r * 0.15, y - r * 0.25, r * 0.3, r * 0.16); g.fill();
  }
  function bos_fangTube(g, pts, C, el, sh, isTail) {
    bos_tubePath(g, pts);
    if (sh) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fill(); return; }
    const r0 = pts[0][2];
    g.fillStyle = vfill(g, C.scale, -r0 - 3, r0 + 3, 0.3, -0.32); g.fill();
    g.save(); bos_tubePath(g, pts); g.clip();
    // the belly showing along both edges, a dark ridge down the middle, a scale band at each segment
    g.strokeStyle = bos_rgba(C.belly, 0.7); g.lineWidth = 3; bos_tubePath(g, pts); g.stroke();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = bos_rgba(C.scale2, 0.85); g.lineWidth = 2.6; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke();
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], a = pts[i - 1], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, ux = dx / d * (isTail ? 1 : -1), uy = dy / d * (isTail ? 1 : -1), r = p[2] * 1.1;
      g.strokeStyle = 'rgba(0,0,0,0.32)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(p[0] + nx * r, p[1] + ny * r); g.quadraticCurveTo(p[0] + ux * r * 0.9, p[1] + uy * r * 0.9, p[0] - nx * r, p[1] - ny * r); g.stroke();
      if (el === 'fire' && i % 2) { g.strokeStyle = bos_rgba('#ffb347', 0.55 + Math.sin(time * 4 + i) * 0.25); g.lineWidth = 0.7; g.beginPath(); g.moveTo(p[0] + nx * r * 0.7, p[1] + ny * r * 0.7); g.lineTo(p[0] + nx * r * 0.25 - ux * 1.5, p[1] + ny * r * 0.25 - uy * 1.5); g.lineTo(p[0] + nx * r * 0.45 - ux * 3, p[1] + ny * r * 0.45 - uy * 3); g.stroke(); }
      if (el === 'stone' && i % 2 === 0) { g.strokeStyle = 'rgba(20,16,12,0.6)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(p[0] - nx * r * 0.8, p[1] - ny * r * 0.8); g.lineTo(p[0] - nx * r * 0.3 + ux * 1.4, p[1] - ny * r * 0.3 + uy * 1.4); g.lineTo(p[0] - nx * r * 0.5 + ux * 3, p[1] - ny * r * 0.5 + uy * 3); g.stroke(); }
      if (el === 'ice') { g.strokeStyle = 'rgba(240,250,255,0.5)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(p[0] + nx * r * 0.75 - ux, p[1] + ny * r * 0.75 - uy); g.lineTo(p[0] + nx * r * 0.6 + ux * 2.4, p[1] + ny * r * 0.6 + uy * 2.4); g.stroke(); }
    }
    g.restore();
    bos_tubePath(g, pts); outline(g, 0.85);
    for (let i = 1; i < pts.length - 1; i++) bos_fangGem(g, pts[i][0], pts[i][1], Math.max(1, pts[i][2] * 0.36), C, el);
  }
  function bos_theFang(g, e) {
    const el = BOS_EL[e.element] ? e.element : BOS_ELS[Math.floor(time / 7) % 4], C = BOS_EL[el];
    const sw = swingOf(e), breath = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    const flap = Math.sin(time * (e.moving ? 2.2 : 1.1) + (e.seed || 0)), span = 0.86 + flap * 0.14, lift = 10, sd = e.seed || 0;
    // the aura on the ground, and the motes circling it: those behind are drawn before the dragon, those in front after
    bos_glow(g, 0, 4, 92, 50, C.glow, 0.34 + Math.sin(time * 4) * 0.08); bos_glow(g, 0, 2, 46, 24, C.col, 0.22 + Math.sin(time * 4) * 0.06);
    const motes = front => {
      for (let k = 0; k < 10; k++) {
        const a = time * 1.1 + k * Math.PI * 2 / 10, R = 52 + Math.sin(time * 2 + k) * 5, x = Math.cos(a) * R, y = Math.sin(a) * R * 0.45 - lift * 0.6;
        if ((Math.sin(a) > 0) !== front) continue;
        if (el === 'fire') { bos_glow(g, x, y, 4, 4, '#ff8a2a', 0.6); ell(g, x, y, 1.3, 1.3); g.fillStyle = '#ffe08a'; g.fill(); }
        else if (el === 'ice') { sparkle(g, x, y, 3, 'rgba(230,246,255,0.95)'); ell(g, x, y, 0.7, 0.7); g.fillStyle = '#ffffff'; g.fill(); }
        else if (el === 'storm') { bos_glow(g, x, y, 4, 4, '#d8c8ff', 0.6); sparkle(g, x, y, 2.4 + Math.sin(time * 20 + k) * 0.8, '#fff7c0'); }
        else { g.save(); g.translate(x, y); g.rotate(time * 2 + k); g.beginPath(); g.moveTo(2, 0); g.lineTo(0.6, -1.7); g.lineTo(-1.6, -1.2); g.lineTo(-1.9, 0.9); g.lineTo(0.4, 1.8); g.closePath(); g.fillStyle = rfill(g, '#8d8478', 0, 0, 2); g.fill(); outline(g, 0.4); g.restore(); }
      }
    };
    motes(false);
    const body = (g, sh) => {
      const SH = 'rgba(0,0,0,0.2)';
      // ---- the tail: a long serpent's tail, swaying, its segments marked by scale bands and a gem on each; a bone blade at its tip ----
      const TN = 13, tail = [];
      for (let i = 0; i < TN; i++) tail.push([-15 - i * 5.2, Math.sin(time * 2.2 - i * 0.55 + sd) * (0.4 + i * 0.75) + (e.moving ? Math.sin(e.walkT * 0.5 - i * 0.4) * i * 0.2 : 0), 10.4 - i * 0.66]);
      { const [x, y] = tail[TN - 1], [px, py] = tail[TN - 2], a = Math.atan2(y - py, x - px);
        g.save(); g.translate(x, y); g.rotate(a);
        g.beginPath(); g.moveTo(-1, -2.6); g.quadraticCurveTo(5, -8.6, 13, -6.4); g.quadraticCurveTo(8.6, -1.6, 15, 0); g.quadraticCurveTo(8.6, 1.6, 13, 6.4); g.quadraticCurveTo(5, 8.6, -1, 2.6); g.closePath();
        g.fillStyle = sh ? SH : vfill(g, '#f5f0d8', -8, 8, 0.2, -0.35); g.fill(); if (!sh) { outline(g, 0.7); g.strokeStyle = 'rgba(120,100,70,0.5)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(1, 0); g.lineTo(12, -5.2); g.moveTo(1, 0); g.lineTo(12, 5.2); g.moveTo(1, 0); g.lineTo(13.6, 0); g.stroke(); }
        if (!sh && el === 'fire') for (let k = 0; k < 3; k++) { const u = (time * 1.5 + k / 3) % 1; bos_glow(g, 14 + u * 6, (k - 1) * 2.4 * u, 3.4 - u * 1.5, 3.4 - u * 1.5, '#ff9a3a', 0.75 * (1 - u)); }
        g.restore(); }
      bos_fangTube(g, tail, C, el, sh, true);
      // ---- the wings ----
      for (const s of [-1, 1]) {
        const Y = v => s * v * span;
        const sh0 = [4, s * 10], wr = [-6 - flap * 2.6, Y(34)], f1 = [-8 - flap * 3.4, Y(71)], f2 = [-29 - flap * 2.2, Y(72)], f3 = [-48 - flap, Y(60)], f4 = [-60, Y(39)], root = [-25, s * 9.4];
        const mem = () => {
          g.beginPath(); g.moveTo(...sh0); g.lineTo(...wr); g.lineTo(...f1);
          g.quadraticCurveTo(-19 - flap * 2.6, Y(59), ...f2); g.quadraticCurveTo(-37 - flap * 1.6, Y(53), ...f3); g.quadraticCurveTo(-48, Y(41), ...f4); g.quadraticCurveTo(-42, Y(19), ...root); g.closePath();
        };
        mem();
        if (sh) { g.fillStyle = SH; g.fill(); continue; }
        const wg = g.createRadialGradient(sh0[0], sh0[1], 4, sh0[0], sh0[1], 76 * span);
        wg.addColorStop(0, shade(C.scale, -0.25)); wg.addColorStop(0.45, C.scale); wg.addColorStop(0.8, shade(C.mem, -0.3)); wg.addColorStop(1, C.mem);
        g.fillStyle = wg; g.fill();
        g.save(); mem(); g.clip();
        // glowing veins of the element running out through the membrane
        g.lineCap = 'round';
        for (const [a, b] of [[f1, f2], [f2, f3], [f3, f4]]) {
          const m = bos_pt(a, b, 0.5), c = bos_pt(wr, m, 0.5);
          g.strokeStyle = bos_rgba(C.col, 0.25); g.lineWidth = 2.4; g.beginPath(); g.moveTo(...wr); g.quadraticCurveTo(c[0] + 3, c[1], m[0], m[1]); g.stroke();
          g.strokeStyle = bos_rgba(C.col, 0.75); g.lineWidth = 0.6; g.stroke();
        }
        g.strokeStyle = bos_rgba(C.col, 0.6); g.lineWidth = 1.6; mem(); g.stroke();
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(...wr); g.lineTo(...f3); g.lineTo(...f4); g.lineTo(...root); g.closePath(); g.fill();
        g.restore();
        mem(); outline(g, 1);
        if (el === 'ice') { g.fillStyle = 'rgba(225,245,255,0.95)'; for (const [a, b] of [[f1, f2], [f2, f3], [f3, f4]]) for (const t of [0.3, 0.55, 0.78]) { const p = bos_pt(a, b, t), q = bos_pt(wr, p, 0.92); g.beginPath(); g.moveTo(q[0] - 1.1, q[1]); g.lineTo(p[0] + (p[0] - wr[0]) * 0.06, p[1] + (p[1] - wr[1]) * 0.08); g.lineTo(q[0] + 1.1, q[1]); g.closePath(); g.fill(); outline(g, 0.3); } }
        g.lineCap = 'round'; g.strokeStyle = '#1a1a22'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(...sh0); g.lineTo(...wr); g.stroke();
        g.lineWidth = 2; g.beginPath(); for (const f of [f1, f2, f3, f4]) { g.moveTo(...wr); g.lineTo(...f); } g.stroke();
        g.strokeStyle = bos_rgba(C.mem, 0.45); g.lineWidth = 0.6; g.beginPath(); g.moveTo(sh0[0] - 0.6, sh0[1]); g.lineTo(wr[0] - 0.6, wr[1]); g.stroke();
        for (const f of [f1, f2, f3, f4]) { const p = bos_pt(wr, f, 0.5); ell(g, p[0], p[1], 1.2, 1.2); g.fillStyle = '#2a2a34'; g.fill(); }
        ell(g, wr[0], wr[1], 2.4, 2.4); g.fillStyle = '#1a1a22'; g.fill(); outline(g, 0.5);
        for (const f of [f1, f2, f3, f4]) {
          const dx = f[0] - wr[0], dy = f[1] - wr[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, tip = [f[0] + ux * 4 - uy * s * 1.2, f[1] + uy * 4 + ux * s * 1.2];
          g.beginPath(); g.moveTo(f[0] - uy * 1.1, f[1] + ux * 1.1); g.quadraticCurveTo(tip[0] - ux, tip[1] - uy, tip[0], tip[1]); g.lineTo(f[0] + uy * 1.1, f[1] - ux * 1.1); g.closePath(); g.fillStyle = '#f5f0d8'; g.fill(); outline(g, 0.4);
        }
        g.beginPath(); g.moveTo(wr[0] - 1.4, wr[1]); g.quadraticCurveTo(wr[0] + 4, wr[1] - s * 0.4, wr[0] + 6.4, wr[1] - s * 2); g.lineTo(wr[0] + 1, wr[1] + s * 1.4); g.closePath(); g.fillStyle = '#f5f0d8'; g.fill(); outline(g, 0.4);
        if (el === 'storm') { const fk = Math.floor(time * 12) + s * 31; if (bos_rnd(fk) < 0.7) { const f = [f1, f2, f3][Math.floor(bos_rnd(fk + 1) * 3)]; bos_bolt(g, bos_boltPts(wr[0], wr[1], f[0], f[1], 6, 2.4, fk), 0.6, '#ffffff', '#fff7c0', 0.9); } }
      }
      // ---- four legs with great bone claws ----
      for (const [x, s, k] of [[13, -1, 0], [13, 1, 1], [-15, -1, 2], [-15, 1, 3]]) {
        const paddle = e.moving ? Math.sin(e.walkT * 0.8 + k * Math.PI / 2) * 0.25 : Math.sin(time + k) * 0.04;
        g.save(); g.translate(x, s * 11.6); g.rotate(s * ((x > 0 ? 0.7 : 2.3) + paddle));
        rr(g, 0, -2.8, 10, 5.6, 2.8); g.fillStyle = sh ? SH : vfill(g, C.scale2, -3, 3, 0.25, -0.3); g.fill();
        if (!sh) { outline(g, 0.7); g.fillStyle = bos_rgba(C.belly, 0.5); ell(g, 5, 1.4, 3.6, 1); g.fill(); ell(g, 10, 0, 3, 3.2); g.fillStyle = rfill(g, bos_hex(C.scale2, -0.2), 10, 0, 3); g.fill(); outline(g, 0.5); bos_claws(g, 11.6, 1.9, '#f5f0d8', 3); }
        g.restore();
      }
      // ---- the torso ----
      ell(g, -1, 0, 22, 13.6); g.fillStyle = sh ? SH : rfill(g, C.scale, -1, 0, 22); g.fill();
      if (!sh) {
        outline(g, 1.1);
        g.save(); ell(g, -1, 0, 22, 13.6); g.clip();
        for (const s of [-1, 1]) {
          g.beginPath(); g.moveTo(-22, s * 8.4); g.quadraticCurveTo(-1, s * 16, 20, s * 7.4); g.quadraticCurveTo(-1, s * 10.6, -22, s * 8.4); g.fillStyle = vfill(g, C.belly, -13, 13, 0.2, -0.25); g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.5; for (let x = -18; x <= 16; x += 3) { const yy = s * (10 + Math.cos(x / 21 * 1.5) * 1.6); g.beginPath(); g.moveTo(x, yy - s * 1.4); g.lineTo(x - 0.6, yy + s * 1.8); g.stroke(); }
        }
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.55;
        for (let row = 0; row < 5; row++) for (let k = -7; k <= 6; k++) { const x = k * 3.2 + (row % 2) * 1.6, y = -7.6 + row * 3.8; g.beginPath(); g.arc(x, y, 1.5, 0.3, Math.PI - 0.3); g.stroke(); }
        if (el === 'fire') { g.strokeStyle = bos_rgba('#ffb347', 0.6 + Math.sin(time * 4) * 0.25); g.lineWidth = 0.9; g.lineCap = 'round'; for (const p of [[-15, -5, -11, -1, -8, -4.4], [4, 4, 7, 1, 10, 3.6], [-6, 5, -3, 2.4, 0, 5.4], [8, -6, 11, -3.4, 14, -5.4], [-17, 3, -14, 5.6, -11, 4]]) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[2], p[3]); g.lineTo(p[4], p[5]); g.stroke(); } }
        if (el === 'stone') { g.strokeStyle = 'rgba(20,16,12,0.65)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-18, -9); g.lineTo(-10, -3); g.lineTo(-13, 6); g.moveTo(8, -10); g.lineTo(5, -2); g.lineTo(12, 7); g.moveTo(-2, 8); g.lineTo(1, 3); g.stroke(); }
        if (el === 'ice') { g.strokeStyle = 'rgba(240,250,255,0.55)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-14, -8); g.lineTo(-4, -9.6); g.moveTo(2, -8.6); g.lineTo(12, -6.6); g.stroke(); }
        g.restore();
        g.fillStyle = 'rgba(255,255,255,0.1)'; ell(g, -5, -6, 14, 3, -0.04); g.fill();
        g.fillStyle = C.scale2; ell(g, -1, 0, 19, 2.2); g.fill();
        for (let x = 15; x >= -17; x -= 6.4) bos_fangGem(g, x, 0, 2.4 - Math.abs(x) * 0.02, C, el);
        if (el === 'storm') { const fk = Math.floor(time * 14); for (let k = 0; k < 2; k++) if (bos_rnd(fk + k * 9) < 0.75) { const x0 = 15 - Math.floor(bos_rnd(fk + k) * 5) * 6.4; bos_bolt(g, bos_boltPts(x0, 0, x0 - 6.4, 0, 4, 2.2, fk + k * 3), 0.55, '#ffffff', '#fff7c0', 0.9); } }
      }
      // ---- the serpent neck ----
      const NN = 6, neck = [];
      for (let i = 0; i < NN; i++) neck.push([12 + i * 6.4, Math.sin(time * 2 + i * 0.7 + sd) * i * 0.6, 10 - i * 0.7]);
      if (sh) { bos_fangTube(g, neck, C, el, true, false); ell(g, neck[NN - 1][0] + 14, neck[NN - 1][1], 17, 10); g.fillStyle = SH; g.fill(); return; }
      bos_fangTube(g, neck, C, el, false, false);
      // ---- the head ----
      const [nx, ny] = neck[NN - 1], ha = Math.atan2(ny - neck[NN - 2][1], 6.4) * 0.6;
      g.save(); g.translate(nx + 3, ny); g.rotate(ha); g.scale(1.3, 1.3);
      // crest: five long spikes sweeping back, tipped with the element
      for (const [y, l, w] of [[-5.6, 13, 1.8], [-2.8, 16, 2], [0, 18, 2.2], [2.8, 16, 2], [5.6, 13, 1.8]]) {
        g.beginPath(); g.moveTo(-1, y - w); g.quadraticCurveTo(-l * 0.5, y * 1.5 - w * 0.4, -l, y * 2.1); g.quadraticCurveTo(-l * 0.5, y * 1.5 + w * 0.4, -1, y + w); g.closePath();
        g.fillStyle = vfill(g, C.scale2, y - 4, y + 4, 0.25, -0.25); g.fill(); outline(g, 0.45);
        bos_glow(g, -l + 1, y * 2.1, 2.6, 2.6, C.col, 0.7); ell(g, -l + 1.2, y * 2.08, 1, 0.8); g.fillStyle = C.col; g.fill();
      }
      // two long horns sweeping back, ridged
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(1.4, s * 3.4); g.quadraticCurveTo(-8, s * 16.6, -24, s * 15.6); g.quadraticCurveTo(-11, s * 11.4, -3.4, s * 8.2); g.closePath();
        g.fillStyle = vfill(g, '#f5f0d8', -16, 16, 0.2, -0.3); g.fill(); outline(g, 0.6);
        g.strokeStyle = 'rgba(120,100,70,0.55)'; g.lineWidth = 0.45; for (const t of [0.2, 0.38, 0.56, 0.74]) { const a = bos_q([1.4, s * 3.4], [-8, s * 16.6], [-24, s * 15.6], t), b = bos_q([-3.4, s * 8.2], [-11, s * 11.4], [-24, s * 15.6], t); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
      }
      // the skull: long and wedged, with snout plates
      const bite = breath;
      g.beginPath(); g.moveTo(-5, -7.6); g.quadraticCurveTo(8, -9, 18, -4.2); g.quadraticCurveTo(21.6, 0, 18, 4.2); g.quadraticCurveTo(8, 9, -5, 7.6); g.quadraticCurveTo(-8, 0, -5, -7.6); g.closePath();
      g.fillStyle = rfill(g, C.scale, 5, 0, 13); g.fill(); outline(g, 1);
      g.fillStyle = C.scale2; for (const x of [8, 11.6, 15]) { g.beginPath(); g.moveTo(x - 2, -1.4); g.lineTo(x + 1.6, 0); g.lineTo(x - 2, 1.4); g.closePath(); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(6, -4); g.quadraticCurveTo(13, -3.2, 18.4, -1.6); g.moveTo(6, 4); g.quadraticCurveTo(13, 3.2, 18.4, 1.6); g.stroke();
      if (el === 'stone') { g.strokeStyle = 'rgba(20,16,12,0.6)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-2, -6); g.lineTo(2, -2.6); g.lineTo(0, 1); g.stroke(); }
      if (bite > 0) { g.beginPath(); g.moveTo(12, 0); g.lineTo(20.8, -3.4 * bite); g.lineTo(20.8, 3.4 * bite); g.closePath(); g.fillStyle = '#1a0a0a'; g.fill(); bos_glow(g, 19, 0, 8, 8, C.col, 0.8 * bite); }
      // brows and the glowing eyes
      for (const s of [-1, 1]) {
        g.strokeStyle = shade(C.scale2, -0.3); g.lineWidth = 1.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(1.4, s * 6.8); g.quadraticCurveTo(5, s * 6.2, 9.4, s * 2.6); g.stroke();
        bos_glow(g, 5.8, s * 4.5, 6, 6, C.eye, 0.6 + Math.sin(time * 8) * 0.2);
        g.beginPath(); g.moveTo(3, s * 5.6); g.quadraticCurveTo(5.4, s * 2.9, 9, s * 3.4); g.quadraticCurveTo(6.4, s * 5.8, 3, s * 5.6); g.closePath(); g.fillStyle = C.eye; g.fill(); outline(g, 0.4);
        ell(g, 6.2, s * 4.4, 0.45, 1.1, s * 0.3); g.fillStyle = '#1a0e0a'; g.fill(); ell(g, 5.2, s * 4.3, 0.5, 0.3); g.fillStyle = '#ffffff'; g.fill();
        ell(g, 18, s * 1.7, 0.75, 0.5); g.fillStyle = '#140c0a'; g.fill();
      }
      // the two lesser fangs, and THE FANG: longer than the head, curved like a sabre
      const fv = vfill(g, '#f5f0d8', -4, 16, 0.25, -0.3);
      g.beginPath(); g.moveTo(14, -3.2); g.quadraticCurveTo(19, -4.8, 23.4, -8.2); g.quadraticCurveTo(19.6, -3.6, 16.2, -2); g.closePath(); g.fillStyle = fv; g.fill(); outline(g, 0.45);
      g.beginPath(); g.moveTo(17.2, 2.4); g.quadraticCurveTo(20.4, 3.4, 22.4, 6); g.quadraticCurveTo(19.6, 3.4, 18.4, 1.8); g.closePath(); g.fill(); outline(g, 0.4);
      g.beginPath(); g.moveTo(10.2, 3.2); g.quadraticCurveTo(13, 2.6, 16.4, 3.6); g.quadraticCurveTo(25.6, 6.6, 34 + bite * 3, 16 + bite * 2.4); g.quadraticCurveTo(21, 11.8, 11.2, 6.6); g.quadraticCurveTo(10, 5, 10.2, 3.2); g.closePath();
      g.fillStyle = vfill(g, '#f5f0d8', 2, 16, 0.25, -0.35); g.fill(); outline(g, 0.75);
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(14, 4.2); g.quadraticCurveTo(24, 7.2, 31.6, 13.8); g.stroke();
      g.strokeStyle = 'rgba(120,100,70,0.5)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(15.4, 7.6); g.lineTo(16.8, 5.4); g.moveTo(20.6, 9.6); g.lineTo(21.8, 7.6); g.moveTo(25.4, 11.6); g.lineTo(26.2, 10.2); g.stroke();
      // its breath, in its element
      if (breath > 0) {
        const L = 74 * breath, W = 46 * (0.5 + breath * 0.5), x0 = 21;
        if (el === 'storm') {
          bos_glow(g, x0 + L * 0.4, 0, L * 0.6, W * 0.4, '#b8a4ff', 0.35 * breath);
          const seed = Math.floor(time * 18) * 5;
          for (const [a, k] of [[-0.32, 1], [0, 2], [0.32, 3]]) {
            const pts = bos_boltPts(x0, 0, x0 + Math.cos(a) * L, Math.sin(a) * L, 9, 5, seed + k * 11); bos_bolt(g, pts, 1.6, '#ffffff', '#fff7c0', breath);
            const p = pts[4], q = [p[0] + 12, p[1] + (bos_rnd(seed + k) - 0.5) * 18]; bos_bolt(g, bos_boltPts(p[0], p[1], q[0], q[1], 4, 2, seed + k * 7), 0.8, '#ffffff', '#d8c8ff', breath * 0.8);
          }
        } else if (el === 'stone') {
          bos_breathCone(g, x0, L, W, C.breath, 0.55);
          for (let k = 0; k < 9; k++) {
            const u = (k / 9 + time * 1.3) % 1, x = x0 + L * (0.1 + u * 0.85), y = (bos_rnd(k * 3.1) - 0.5) * W * 0.8 * u, r = 1.8 + bos_rnd(k * 7.7) * 2.6;
            g.save(); g.translate(x, y); g.rotate(time * 5 + k); g.beginPath(); g.moveTo(r, 0); g.lineTo(r * 0.3, -r * 0.9); g.lineTo(-r * 0.8, -r * 0.6); g.lineTo(-r, r * 0.4); g.lineTo(0, r * 0.9); g.lineTo(r * 0.8, r * 0.5); g.closePath();
            g.fillStyle = rfill(g, '#8a7e6c', 0, 0, r); g.fill(); outline(g, 0.5); g.restore();
          }
        } else {
          bos_breathCone(g, x0, L, W, C.breath, 1);
          if (el === 'ice') for (let k = 0; k < 10; k++) {
            const u = (k / 10 + time * 1.5) % 1, x = x0 + L * (0.1 + u * 0.85), y = (bos_rnd(k * 5.3) - 0.5) * W * 0.85 * u, r = 1.6 + bos_rnd(k * 2.9) * 1.8;
            if (k % 3 === 0) sparkle(g, x, y, r * 1.4, 'rgba(255,255,255,0.95)');
            else { g.save(); g.translate(x, y); g.rotate(k + time * 4); g.beginPath(); g.moveTo(r * 1.4, 0); g.lineTo(0, -r * 0.45); g.lineTo(-r * 1.4, 0); g.lineTo(0, r * 0.45); g.closePath(); g.fillStyle = 'rgba(225,245,255,0.95)'; g.fill(); outline(g, 0.3); g.restore(); }
          }
        }
      } else if (el === 'fire') for (let k = 0; k < 3; k++) { const u = (time * 1.2 + k / 3) % 1; bos_glow(g, 21 + u * 10, (k - 1) * 2.6 * u, 2.4 + u * 2.4, 2.4 + u * 2.4, '#ff8a2a', 0.6 * (1 - u)); }
      else if (el === 'ice') for (let k = 0; k < 3; k++) { const u = (time * 0.8 + k / 3) % 1; g.fillStyle = `rgba(235,248,255,${0.6 * (1 - u)})`; ell(g, 20 + u * 9, (k - 1) * 2 * u, 1 + u * 2, 1 + u * 2); g.fill(); }
      else if (el === 'storm') { const fk = Math.floor(time * 10); if (bos_rnd(fk) < 0.6) bos_bolt(g, bos_boltPts(19, 0, 26, (bos_rnd(fk + 1) - 0.5) * 8, 3, 1.2, fk), 0.5, '#ffffff', '#fff7c0', 0.9); }
      g.restore();
    };
    g.save(); g.translate(0, -lift); topDown(g, e, body, { x: 10, y: lift + 12 }); g.restore();
    motes(true);
    // the element in the air around it
    for (let k = 0; k < 6; k++) {
      const u = (time * 0.5 + k / 6) % 1, x = Math.sin(k * 7.3 + time * 0.7) * 28;
      if (el === 'fire') { const y = 4 - u * 46; g.fillStyle = `rgba(255,${150 + k * 15},60,${(1 - u) * 0.85})`; ell(g, x, y, 1, 1); g.fill(); }
      else if (el === 'ice') { const y = -40 + u * 50; sparkle(g, x, y, 1.6, `rgba(240,250,255,${(1 - u) * 0.9})`); }
      else if (el === 'storm') { if (bos_rnd(Math.floor(time * 9) + k * 5) < 0.25) { const y = -20 + Math.sin(k * 3) * 18; bos_bolt(g, bos_boltPts(x, y, x + 6, y + 5, 3, 1.4, k + Math.floor(time * 9)), 0.5, '#ffffff', '#d8c8ff', 0.9); } }
      else { const y = 6 - u * 10; g.fillStyle = `rgba(160,146,124,${(1 - u) * 0.35})`; ell(g, x * 1.4, y + 4, 2 + u * 4, 1.2 + u * 2); g.fill(); }
    }
  }

  // ---------- register ----------
  Object.assign(NEW_DRAW, { brood_mother: bos_broodMother, thunderbird: bos_thunderbird, red_dragon: bos_redDragon, dustjaw: bos_dustjaw, the_fang: bos_theFang });
  // sizes against the drawing units above (the green dragon is 1.9, the ash drake 2.1):
  // the Brood Mother about three giant spiders across; the Thunderbird a huge storm bird; the red dragon bigger than the green;
  // the Dustjaw a heavy beast about the ash drake's length; The Fang the biggest thing in the game
  Object.assign(MOB_SIZE, { brood_mother: 2.1, thunderbird: 2.2, red_dragon: 1.85, dustjaw: 1.9, the_fang: 1.75 });

  const H = { lerp, ease, OUT, shade, rr, ell, outline, vfill, rfill, sparkle, shadow, face4, swingOf, stepOf, bobOf, swoosh };
  return { NEW_DRAW, MOB_SIZE, drawNewMob, H };
})();
