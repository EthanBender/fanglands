// ============================================================================
// NECROMANCY'S LOOK — pictures only (stripped from the server's copy: tools/build-sim.mjs STRIP_FILES)
// src/89-necroart.js
//
// Everything Necromancy draws, in the game's hand: blue-green runes and glow, friendly skeletons in BLUE SCARVES (a
// friend tells a helper from an enemy skeleton at a glance: the scarf, a teal ring at its feet and a small teal diamond
// over its head), ghosts in a cold mist, candles, the barrow mound and its chapel ruin. Nothing is gory: the bones are
// clean and tidy, the dead are kind.
//   * the item icons (ICONS.set: 80-icons' rules, inside -9..+9, nothing under 2 units across, never branching on size)
//   * the monster looks (MONSTER_LOOK.addType) for the Lantern Watch's candles, bell, wisps, snuffers and fighters, the
//     Barrow King, the Hollow and its stolen names; each box measured in Chromium every 16th of a turn (standing, walking,
//     swinging), 3 px all round (~/.fanglands/work/necromancy/measure.cjs)
//   * the helpers, bolts, spikes, ward shards, mist and puffs (89-necromancy draws them through NECRO_ART)
//   * the Old Barrow's things (89-oldbarrow: the mound, the ruin, the Bone Altar, Rattle on his post, the lanterns, the
//     bone dummies, the lych-gate, the candles and the old graves) and the Barrow Deep's
//   * Granny Wick's look: built from the townsfolk sample's own parts (83-townsart: an old woman in a dark shawl, a
//     candle in her hand), registered as a family of one (TOWNSFOLK_ART.addPeople)
// This file loads before 89-necromancy and 89-oldbarrow (name order): it only defines drawings.
// window.NECRO_ART is the handle.
// ============================================================================
const NECRO_ART = (() => {
  const C = {
    teal: '#4fd1b5', glow: '#9fe8d6', deep: '#1f6f62', bone: '#e9e4d2', boneSh: '#c3bda6', boneDk: '#9a937c',
    scarf: '#3a6fd8', scarfDk: '#274f9e', gold: '#d9b25c', candle: '#f2ead2', flame: '#ffd36a', violet: '#8a6aff', ink: '#1a1814',
  };
  const TAU = Math.PI * 2;
  const ell = (g, x, y, rx, ry, rot) => { g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU); };
  const shadow = (g, x, y, rx) => { g.fillStyle = 'rgba(0,0,0,0.24)'; ell(g, x, y, rx, rx * 0.32); g.fill(); };
  function glow(g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  const TEAL = '126,240,208', GOLD = '255,207,122', VIOLET = '160,110,255';

  // =====================================================================================================================
  // THE SKELETON (helpers and the Watch's fighters share one tidy skeleton; the helpers wear a blue scarf)
  // =====================================================================================================================
  function skeleton(g, e, o) {
    const f = e.facing || { x: 0, y: 1 }, side = Math.abs(f.x) > Math.abs(f.y), back = !side && f.y < 0, dir = f.x < 0 ? -1 : 1;
    const wt = e.moving ? (e.walkT || 0) : 0, step = Math.sin(wt) * 3, bob = e.moving ? Math.abs(Math.sin(wt)) * 1.2 : 0;
    const sw = e.attackT > 0 ? Math.sin((1 - e.attackT / 0.22) * Math.PI) : 0;
    const bone = o.hurt ? '#ffd8d8' : (o.bone || C.bone), sh = o.hurt ? '#e0b4b4' : (o.sh || C.boneSh), s = o.scale || 1;
    g.save(); g.scale(s, s); g.translate(0, -bob);
    // legs
    g.strokeStyle = sh; g.lineWidth = 3; g.lineCap = 'round';
    for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 3, 6); g.lineTo(k * 3 + (side ? k * step * dir : 0), 16 + (side ? 0 : k * step * 0.5)); g.stroke(); }
    // pelvis and spine
    g.fillStyle = bone; ell(g, 0, 6, 5.5, 2.6); g.fill();
    g.strokeStyle = bone; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 5); g.lineTo(0, -7); g.stroke();
    // ribs
    g.strokeStyle = bone; g.lineWidth = 1.8;
    for (let k = 0; k < 3; k++) { const y = -5 + k * 3.2, w = 6.5 - k * 0.9; g.beginPath(); g.moveTo(-w, y + 1); g.quadraticCurveTo(0, y - 2.2, w, y + 1); g.stroke(); }
    // the scarf (a helper's: blue, tied at the neck, its tail lifting in the walk)
    if (o.scarf) {
      g.fillStyle = o.scarf; g.beginPath(); g.moveTo(-6.5, -9); g.quadraticCurveTo(0, -5.5, 6.5, -9); g.lineTo(6, -6.2); g.quadraticCurveTo(0, -3, -6, -6.2); g.closePath(); g.fill();
      const tx = back ? 0 : -dir * 4, flap = Math.sin(time * 6 + (e.walkT || 0)) * 1.5;
      g.fillStyle = C.scarfDk; g.beginPath(); g.moveTo(tx - 1.5, -6); g.lineTo(tx - 4 * dir + flap, 2); g.lineTo(tx + 1.5 - 2 * dir + flap, 1.5); g.lineTo(tx + 1.5, -6); g.closePath(); g.fill();
    }
    // arms: the weapon arm swings forward on an attack
    g.strokeStyle = bone; g.lineWidth = 2.4;
    const reach = sw * 8;
    for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 6, -6); g.lineTo(k * 7.5 + (k === dir ? reach * (side ? dir : 0) : 0), 3 + (k === dir && !side ? reach * f.y : 0)); g.stroke(); }
    if (o.weapon) { const hx = dir * 7.5 + (side ? reach * dir : 0), hy = 3 + (!side ? reach * f.y : 0); g.save(); g.translate(hx, hy); g.rotate((side ? 0.4 * dir : 0) - sw * 1.2 * dir); o.weapon(g); g.restore(); }
    // the skull
    g.fillStyle = bone; ell(g, 0, -14, 6.2, 6); g.fill();
    g.fillStyle = sh; ell(g, side ? dir * 1.5 : 0, -9.5, 3.6, 2.2); g.fill();
    if (!back) { g.fillStyle = o.eye || C.ink; const ex = side ? dir * 2.4 : 0; for (const k of side ? [0] : [-1, 1]) { ell(g, ex + k * 2.3, -14.5, 1.6, 1.8); g.fill(); }
      if (o.eyeGlow) { g.fillStyle = o.eyeGlow; for (const k of side ? [0] : [-1, 1]) { ell(g, ex + k * 2.3, -14.5, 0.8, 0.9); g.fill(); } } }
    if (o.hat) o.hat(g, side, dir, back);
    g.restore();
  }
  const shortSword = g => { g.strokeStyle = '#8f96a3'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -12); g.stroke(); g.strokeStyle = '#6b4a2a'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-3, 0); g.lineTo(3, 0); g.stroke(); };
  const stoneSword = g => { g.fillStyle = '#8a8a82'; g.beginPath(); g.moveTo(-2, 0); g.lineTo(-2.6, -20); g.lineTo(0, -24); g.lineTo(2.6, -20); g.lineTo(2, 0); g.closePath(); g.fill(); g.fillStyle = C.gold; g.fillRect(-5, -1, 10, 2.4); };
  const roundShield = g => { g.fillStyle = C.scarf; ell(g, 0, 0, 5, 6); g.fill(); g.strokeStyle = C.bone; g.lineWidth = 1.2; g.stroke(); };
  // a friend's mark: the teal ring at its feet and the diamond over its head (so it never reads as an enemy)
  function friendMark(g, top, frac) {
    g.strokeStyle = `rgba(${TEAL},0.7)`; g.lineWidth = 1.6; ell(g, 0, 15, 12, 4); g.stroke();
    g.fillStyle = C.teal; g.beginPath(); g.moveTo(0, top - 7); g.lineTo(3, top - 3.5); g.lineTo(0, top); g.lineTo(-3, top - 3.5); g.closePath(); g.fill();
    if (frac != null && frac < 1) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(-9, top + 2, 18, 2.6); g.fillStyle = C.teal; g.fillRect(-9, top + 2, 18 * Math.max(0, frac), 2.6); }
  }

  // =====================================================================================================================
  // THE HELPERS (89-necromancy): drawn round the helper's middle; o = { frac: time left 0..1, rise: 0..1 climbing up }
  // =====================================================================================================================
  function helper(g, kind, e, o) {
    o = o || {};
    const rise = o.rise == null ? 1 : o.rise, x = e.x, y = e.y;
    g.save(); g.translate(x, y);
    if (rise < 1) { g.beginPath(); g.rect(-60, -80, 120, 80 + 16 * rise + 2); g.clip(); g.translate(0, (1 - rise) * 22); }
    if (kind === 'lk' || e.look === 'corwin') {
      // the last knight of Hollowford: a knight made of moonlight, his shield bare
      shadow(g, 0, 15, 11); glow(g, 0, -4, 30, '200,230,255', 0.25);
      g.globalAlpha *= 0.82;
      const f = e.facing || { x: 0, y: 1 }, dir = f.x < 0 ? -1 : 1, wt = e.moving ? (e.walkT || 0) : 0;
      g.fillStyle = '#cfe6ff'; g.strokeStyle = '#7fa8d8'; g.lineWidth = 1;
      for (const k of [-1, 1]) { g.fillRect(k * 3.5 - 2, 4 + Math.sin(wt) * k * 1.5, 4, 11); }
      g.beginPath(); g.moveTo(-8, -9); g.lineTo(8, -9); g.lineTo(7, 6); g.lineTo(-7, 6); g.closePath(); g.fill(); g.stroke();
      ell(g, 0, -15, 6.5, 6.5); g.fill(); g.stroke();
      g.fillStyle = '#4a6a9a'; g.fillRect(-4.5, -16, 9, 1.8);
      g.fillStyle = '#e8f4ff'; ell(g, -dir * 9, -1, 4.5, 6.5); g.fill(); g.strokeStyle = '#7fa8d8'; g.stroke();
      const sw = e.attackT > 0 ? Math.sin((1 - e.attackT / 0.22) * Math.PI) : 0;
      g.save(); g.translate(dir * 8, -2); g.rotate(dir * (0.3 + sw * 1.4) - 0.2); g.fillStyle = '#e8f4ff'; g.fillRect(-1.2, -20, 2.4, 20); g.fillStyle = '#9fc4ef'; g.fillRect(-3.5, -1, 7, 2); g.restore();
      g.globalAlpha /= 0.82;
      friendMark(g, -26, o.frac);
    } else if (kind === 'bb') {
      // the Bone brute: two tiles of tidy bones, a blue sash, a great bone club
      shadow(g, 0, 26, 26); glow(g, 0, 26, 30, TEAL, 0.12);
      skeleton(g, e, { scale: 2.1, scarf: C.scarf, hurt: false, weapon: g2 => { g2.fillStyle = C.bone; g2.fillRect(-1.6, -14, 3.2, 14); ell(g2, 0, -15, 3.2, 3.2); g2.fill(); } });
      g.save(); g.translate(0, 9); friendMark(g, -52, o.frac); g.restore();
    } else {
      // the Bone Squire (sq) and the Risen guard (rg); Ambrose wears a bell-ringer's cap
      shadow(g, 0, 15, 10);
      const rg = kind === 'rg';
      skeleton(g, e, { scarf: C.scarf, weapon: rg ? roundShield : shortSword, eyeGlow: C.glow, sh: rg ? '#b9b39c' : C.boneSh,
        hat: e.look === 'ambrose' ? (g2, side) => { g2.fillStyle = '#5a4a3a'; ell(g2, 0, -19, 6.5, 2.6); g2.fill(); g2.fillRect(-4, -24, 8, 5); } : rg ? (g2) => { g2.fillStyle = '#7d8087'; g2.beginPath(); g2.arc(0, -16, 6.6, Math.PI, TAU); g2.fill(); } : null });
      friendMark(g, -26, o.frac);
    }
    g.restore();
  }

  // ---------- spells in the air ----------
  function bolt(g, kind, x, y, tx, ty) {
    const a = Math.atan2(ty - y, tx - x), col = kind === 'banish' ? '232,246,255' : kind === 'siphon' ? '126,231,135' : TEAL;
    glow(g, x, y, 14, col, 0.55);
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `rgba(${col},0.35)`; ell(g, -10, 0, 12, 3); g.fill();
    g.fillStyle = kind === 'banish' ? '#ffffff' : kind === 'siphon' ? '#c8ffd0' : '#d8fff4'; ell(g, 0, 0, 5, 3.2); g.fill();
    g.restore();
    if (kind === 'siphon') { g.strokeStyle = 'rgba(126,231,135,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(a) * 40, y - Math.sin(a) * 40); g.stroke(); }
  }
  function flash(g, kind, x, y, p) {
    p = Math.max(0, Math.min(1, p));
    if (kind === 'spikes') {
      for (let k = 0; k < 10; k++) { const a = k * TAU / 10, r = 34 + (k % 2) * 22, h = 18 * Math.sin(p * Math.PI);
        const sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r * 0.55 + 10;
        g.fillStyle = C.bone; g.beginPath(); g.moveTo(sx - 3.5, sy); g.lineTo(sx, sy - h); g.lineTo(sx + 3.5, sy); g.closePath(); g.fill(); g.strokeStyle = C.boneDk; g.lineWidth = 0.8; g.stroke(); }
    } else if (kind === 'slam') {
      g.strokeStyle = `rgba(233,228,210,${(1 - p) * 0.8})`; g.lineWidth = 3; ell(g, x, y, 20 + p * 50, (20 + p * 50) * 0.4); g.stroke();
    } else if (kind === 'puff') {
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6; g.fillStyle = `rgba(${TEAL},${(1 - p) * 0.45})`; ell(g, x + Math.cos(a) * 14 * p, y - 10 + Math.sin(a) * 8 * p, 7, 6); g.fill(); }
    } else if (kind === 'mist') {
      for (let k = 0; k < 5; k++) { const yy = y + 10 - p * 40 - k * 9, a = (1 - p) * 0.4 * (1 - k / 6); g.fillStyle = `rgba(190,220,235,${a})`; ell(g, x + Math.sin(k * 1.7 + p * 4) * 8, yy, 14 - k, 6); g.fill(); }
    }
  }
  function shard(g, x, y, a) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = C.bone; g.beginPath(); g.moveTo(-4, 1.5); g.lineTo(0, -4); g.lineTo(4, 1.5); g.closePath(); g.fill(); g.strokeStyle = C.boneDk; g.lineWidth = 0.7; g.stroke(); g.restore(); }

  // =====================================================================================================================
  // THE OLD BARROW'S THINGS (89-oldbarrow): each drawn in its tile, its base at the tile's foot
  // =====================================================================================================================
  function thing(g, kind, px, py, o) {
    const cx = px + TILE / 2, base = py + TILE - 6;
    if (kind === 'ruin') {
      const t = (o.tx * 7 + o.ty * 3) % 3, top = base - 26 - t * 6;
      shadow(g, cx, base + 2, 22);
      g.fillStyle = '#6f6b62'; g.fillRect(px + 2, top, TILE - 4, base - top + 4);
      g.fillStyle = '#86827a'; for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { const sx = px + 4 + k * 14 + (r % 2) * 6, sy = top + 3 + r * 8; if (sy < base) g.fillRect(sx, sy, 11, 6); }
      g.fillStyle = '#4f7f36'; ell(g, px + 10 + t * 8, top + 1, 7, 3); g.fill();       // moss on the broken top
    } else if (kind === 'altar') {
      shadow(g, cx, base + 2, 22);
      g.fillStyle = '#5f5b54'; g.fillRect(cx - 20, base - 20, 40, 22); g.fillStyle = '#77736b'; g.fillRect(cx - 22, base - 24, 44, 6);
      g.fillStyle = C.bone; for (let k = 0; k < 3; k++) { ell(g, cx - 10 + k * 10, base - 28, 3.4, 3.2); g.fill(); }
      g.fillStyle = '#1a1814'; for (let k = 0; k < 3; k++) { ell(g, cx - 11 + k * 10, base - 28.5, 0.8, 1); g.fill(); ell(g, cx - 9 + k * 10, base - 28.5, 0.8, 1); g.fill(); }
      glow(g, cx, base - 14, 20, TEAL, 0.25 + 0.1 * Math.sin(time * 2));
      g.strokeStyle = C.teal; g.lineWidth = 1.2; for (let k = 0; k < 4; k++) { const rx = cx - 15 + k * 10; g.beginPath(); g.moveTo(rx, base - 12); g.lineTo(rx + 3, base - 7); g.lineTo(rx + 6, base - 12); g.stroke(); }
    } else if (kind === 'rattle') {
      // a skull on a post, his jaw clacking when he talks
      shadow(g, cx, base + 2, 9);
      g.fillStyle = '#5a3c22'; g.fillRect(cx - 3, base - 30, 6, 32);
      const talk = o.rattleTalk ? Math.abs(Math.sin(time * 14)) * 2.5 : 0;
      g.fillStyle = C.bone; ell(g, cx, base - 40, 9, 8.5); g.fill();
      g.fillStyle = C.boneSh; g.fillRect(cx - 5, base - 33 + talk, 10, 4); g.strokeStyle = C.boneDk; g.lineWidth = 0.8; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(cx + k * 3, base - 33 + talk); g.lineTo(cx + k * 3, base - 29 + talk); g.stroke(); }
      g.fillStyle = C.ink; ell(g, cx - 3.6, base - 41, 2.4, 2.8); g.fill(); ell(g, cx + 3.6, base - 41, 2.4, 2.8); g.fill();
      g.fillStyle = C.glow; ell(g, cx - 3.6, base - 41, 0.9, 1); g.fill(); ell(g, cx + 3.6, base - 41, 0.9, 1); g.fill();
      // a jester's cap, faded red and gold
      g.fillStyle = '#9a3a32'; g.beginPath(); g.moveTo(cx - 9, base - 45); g.quadraticCurveTo(cx - 14, base - 56, cx - 18, base - 50); g.lineTo(cx, base - 49); g.closePath(); g.fill();
      g.fillStyle = '#b8902e'; g.beginPath(); g.moveTo(cx + 9, base - 45); g.quadraticCurveTo(cx + 14, base - 56, cx + 18, base - 50); g.lineTo(cx, base - 49); g.closePath(); g.fill();
      g.fillStyle = C.gold; ell(g, cx - 18, base - 50, 2.2, 2.2); g.fill(); ell(g, cx + 18, base - 50, 2.2, 2.2); g.fill();
    } else if (kind === 'lantern') {
      shadow(g, cx, base + 2, 7);
      g.fillStyle = '#3a2a1a'; g.fillRect(cx - 2, base - 40, 4, 42); g.fillRect(cx - 2, base - 40, 12, 3);
      const lit = o.night;
      g.fillStyle = '#2a2a2a'; g.fillRect(cx + 5, base - 37, 9, 11);
      g.fillStyle = lit ? C.flame : '#6a6450'; g.fillRect(cx + 7, base - 35, 5, 7);
      if (lit) glow(g, cx + 9.5, base - 31, 22, GOLD, 0.35);
    } else if (kind === 'dummy') {
      // a bone dummy: a post with a skull, a ribcage of sticks and old cloth
      shadow(g, cx, base + 2, 11);
      g.fillStyle = '#6b4a2a'; g.fillRect(cx - 2.5, base - 34, 5, 36); g.fillRect(cx - 14, base - 26, 28, 4);
      g.strokeStyle = C.bone; g.lineWidth = 2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(cx - 9, base - 20 + k * 5); g.quadraticCurveTo(cx, base - 23 + k * 5, cx + 9, base - 20 + k * 5); g.stroke(); }
      g.fillStyle = C.bone; ell(g, cx, base - 39, 7, 6.5); g.fill(); g.fillStyle = C.ink; ell(g, cx - 2.6, base - 40, 1.6, 1.9); g.fill(); ell(g, cx + 2.6, base - 40, 1.6, 1.9); g.fill();
      g.fillStyle = 'rgba(80,110,160,0.8)'; g.fillRect(cx - 12, base - 26, 6, 10);
    }
  }
  function mound(g, b, night, t, door) {
    const x0 = b[0] * TILE, y0 = b[1] * TILE, x1 = (b[2] + 1) * TILE, y1 = (b[3] + 1) * TILE, cx = (x0 + x1) / 2, w = x1 - x0, h = y1 - y0;
    shadow(g, cx, y1 - 4, w * 0.5);
    g.fillStyle = '#3e6a2c'; ell(g, cx, y1 - h * 0.45, w * 0.52, h * 0.58); g.fill();
    g.fillStyle = '#4f7f36'; ell(g, cx, y1 - h * 0.55, w * 0.44, h * 0.44); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.06)'; ell(g, cx - w * 0.12, y1 - h * 0.7, w * 0.2, h * 0.16); g.fill();
    // the kerb stones round its foot
    for (let k = 0; k <= 12; k++) { const a = Math.PI * (0.05 + 0.9 * k / 12), sx = cx - Math.cos(a) * w * 0.5, sy = y1 - h * 0.45 + Math.sin(a) * h * 0.55; g.fillStyle = k % 2 ? '#8a8680' : '#77736c'; g.fillRect(sx - 6, sy - 6, 12, 9); }
    // the stair down in its face: a dark doorway with steps going down, in a stone frame carved with runes
    const dx = door ? door[0] * TILE : cx - TILE / 2, dy = door ? door[1] * TILE : y1 - TILE;
    g.fillStyle = '#16120e'; g.fillRect(dx + 2, dy + 2, TILE - 4, TILE - 2);
    g.fillStyle = '#3a342c'; for (let k = 0; k < 4; k++) g.fillRect(dx + 6 + k * 2, dy + 12 + k * 9, TILE - 12 - k * 4, 4);
    g.fillStyle = '#5f5b54'; g.fillRect(dx - 6, dy - 10, TILE + 12, 10); g.fillRect(dx - 6, dy - 10, 8, TILE + 10); g.fillRect(dx + TILE - 2, dy - 10, 8, TILE + 10);
    g.strokeStyle = C.teal; g.lineWidth = 1.4; for (let k = 0; k < 5; k++) { const rx = dx + 2 + k * 9; g.beginPath(); g.moveTo(rx, dy - 7); g.lineTo(rx + 3, dy - 3); g.lineTo(rx + 6, dy - 7); g.stroke(); }
    if (night) glow(g, cx, dy - 5, 30, TEAL, 0.2 + 0.06 * Math.sin(t * 2));
  }
  function moundWisps(g, b, t) {
    const x0 = b[0] * TILE, y0 = b[1] * TILE, w = (b[2] - b[0] + 1) * TILE;
    for (let k = 0; k < 5; k++) { const x = x0 + ((k * 0.23 + t * 0.03 * (k % 2 ? 1 : -1)) % 1 + 1) % 1 * w, y = y0 + 10 + Math.sin(t * 0.8 + k * 1.9) * 14; glow(g, x, y, 10, TEAL, 0.45); g.fillStyle = '#e8fff8'; ell(g, x, y, 2, 2); g.fill(); }
  }
  function lychGate(g, px, py) {
    const cx = px + TILE / 2, base = py + TILE - 2;
    g.fillStyle = '#4a3220'; g.fillRect(cx - 26, base - 52, 6, 54); g.fillRect(cx + 20, base - 52, 6, 54);
    g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(cx - 34, base - 50); g.lineTo(cx, base - 70); g.lineTo(cx + 34, base - 50); g.lineTo(cx + 30, base - 46); g.lineTo(cx, base - 63); g.lineTo(cx - 30, base - 46); g.closePath(); g.fill();
    g.fillStyle = '#5a4030'; for (let k = 0; k < 4; k++) g.fillRect(cx - 28 + k * 15, base - 56 + Math.abs(1.5 - k) * 4, 10, 3);
    g.fillStyle = C.teal; ell(g, cx, base - 56, 2.4, 2.4); g.fill();
  }
  function candleCell(g, px, py, tx, ty) {
    const n = 2 + (tx * 3 + ty) % 2;
    for (let k = 0; k < n; k++) { const x = px + 12 + ((tx * 7 + ty * 5 + k * 13) % 26), y = py + 18 + ((tx * 3 + ty * 11 + k * 7) % 20), h = 7 + (k * 3 + tx) % 5;
      g.fillStyle = 'rgba(0,0,0,0.2)'; ell(g, x, y + 1, 3.5, 1.2); g.fill();
      g.fillStyle = C.candle; g.fillRect(x - 2, y - h, 4, h); g.fillStyle = '#e6dcc4'; g.fillRect(x - 2, y - h, 4, 1.5);
      const fl = Math.sin(time * 9 + k + tx) * 0.6; g.fillStyle = C.flame; ell(g, x + fl * 0.3, y - h - 3, 1.6, 3); g.fill(); glow(g, x, y - h - 3, 9, GOLD, 0.35); }
  }
  function oldGrave(g, px, py, tx, ty, tobias) {
    const cx = px + TILE / 2, base = py + TILE - 10;
    g.fillStyle = 'rgba(70,60,40,0.35)'; ell(g, cx, base - 4, 16, 9); g.fill();
    if (tobias) return;
    const lean = ((tx + ty) % 3 - 1) * 0.08;
    g.save(); g.translate(cx, base); g.rotate(lean);
    g.fillStyle = '#7a7770'; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-8, -16); g.quadraticCurveTo(0, -24, 8, -16); g.lineTo(8, 0); g.closePath(); g.fill();
    g.fillStyle = '#4f7f36'; ell(g, -3, -2, 6, 2.5); g.fill();
    g.restore();
  }
  function tobiasStone(g, px, py, t) {
    const cx = px + TILE / 2, base = py + TILE - 10;
    g.fillStyle = '#8a8a82'; g.beginPath(); g.moveTo(cx - 9, base); g.lineTo(cx - 9, base - 18); g.quadraticCurveTo(cx, base - 27, cx + 9, base - 18); g.lineTo(cx + 9, base); g.closePath(); g.fill();
    g.strokeStyle = '#5a5a54'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - 5, base - 15); g.quadraticCurveTo(cx, base - 19, cx + 5, base - 13); g.stroke();
    // Bramble, asleep on it: a little curl of mist
    g.fillStyle = `rgba(200,225,235,${0.35 + 0.1 * Math.sin(t)})`; ell(g, cx + 2, base - 4, 11, 5); g.fill(); ell(g, cx + 11, base - 7, 4, 3.5); g.fill();
  }
  function spoil(g, px, py, stone) {
    const cx = px + TILE / 2, base = py + TILE - 8;
    g.fillStyle = '#6a5034'; ell(g, cx, base - 4, 20, 9); g.fill(); g.fillStyle = '#7d6040'; ell(g, cx - 4, base - 8, 13, 6); g.fill();
    if (stone) { g.fillStyle = '#8a8a82'; g.save(); g.translate(cx + 4, base - 7); g.rotate(0.3); g.fillRect(-9, -4, 18, 8); g.restore(); }
  }
  function pawPrints(g, x, y, k) {
    const a = 0.55 + 0.25 * Math.sin(time * 2 + k);
    for (const [ox, oy] of [[-6, -4], [6, 6]]) { g.fillStyle = `rgba(${TEAL},${a})`; ell(g, x + ox, y + oy, 3.2, 3.6); g.fill(); for (let j = -1; j <= 1; j++) { ell(g, x + ox + j * 2.6, y + oy - 4.4, 1.2, 1.4); g.fill(); } }
  }
  function nameLight(g, x, y, t) { glow(g, x, y, 12, '232,246,255', 0.5 + 0.2 * Math.sin(t * 3)); g.fillStyle = '#ffffff'; ell(g, x, y, 2, 2); g.fill(); }

  // ---------- the Barrow Deep's things ----------
  function deepThing(g, kind, px, py, t) {
    const cx = px + TILE / 2, base = py + TILE - 4;
    if (kind === 'throne') {
      shadow(g, cx, base + 2, 22);
      g.fillStyle = '#5f5b54'; g.fillRect(cx - 18, base - 44, 36, 46); g.fillStyle = '#77736b'; g.fillRect(cx - 22, base - 18, 44, 20);
      g.fillStyle = C.bone; for (let k = 0; k < 5; k++) { ell(g, cx - 14 + k * 7, base - 46, 3, 3); g.fill(); }
      g.fillStyle = C.gold; g.beginPath(); g.moveTo(cx - 8, base - 50); g.lineTo(cx - 8, base - 56); g.lineTo(cx - 4, base - 52); g.lineTo(cx, base - 58); g.lineTo(cx + 4, base - 52); g.lineTo(cx + 8, base - 56); g.lineTo(cx + 8, base - 50); g.closePath(); g.fill();
    } else if (kind.indexOf('rope_') === 0) {
      const col = kind === 'rope_dusk' ? '#c9a36a' : kind === 'rope_midnight' ? '#6a7aa8' : '#6a4a9a';
      g.fillStyle = '#4a3220'; g.fillRect(px + 4, py - 6, TILE - 8, 6);
      const sw = Math.sin(t * 1.4 + px) * 2;
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, py - 2); g.quadraticCurveTo(cx + sw, base - 18, cx + sw * 0.5, base - 6); g.stroke();
      g.fillStyle = col; ell(g, cx + sw * 0.5, base - 4, 4, 5); g.fill();
    } else if (kind === 'bonedoor') {
      g.fillStyle = '#3a3630'; g.fillRect(px, py - 10, TILE, TILE + 10);
      g.fillStyle = C.bone; for (let k = 0; k < 5; k++) { g.fillRect(px + 6 + k * 8, py - 4 - (k === 2 ? 6 : Math.abs(2 - k) * 2), 5, 28); ell(g, px + 8.5 + k * 8, py - 4 - (k === 2 ? 6 : Math.abs(2 - k) * 2), 3, 3); g.fill(); }
      g.fillRect(px + 4, py + 22, TILE - 8, 12);
    } else if (kind === 'vaultdoor') {
      g.fillStyle = '#2e2a3a'; g.fillRect(px, py - 10, TILE, TILE + 10);
      g.strokeStyle = C.gold; g.lineWidth = 1.4; g.strokeRect(px + 4, py - 6, TILE - 8, TILE + 2);
      g.fillStyle = C.gold; for (let k = 0; k < 6; k++) g.fillRect(px + 8 + k * 6, py + 16, 4, 2);
      glow(g, cx, py + 14, 18, VIOLET, 0.25);
    } else if (kind === 'namestone') {
      shadow(g, cx, base + 2, 16);
      g.fillStyle = '#5a5664'; g.beginPath(); g.moveTo(cx - 14, base); g.lineTo(cx - 12, base - 38); g.quadraticCurveTo(cx, base - 46, cx + 12, base - 38); g.lineTo(cx + 14, base); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(30,26,40,0.8)'; g.lineWidth = 1.2; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(cx - 9, base - 32 + k * 5); g.quadraticCurveTo(cx, base - 35 + k * 5, cx + 9, base - 30 + k * 5); g.stroke(); }
    }
  }
  // an Ossuary shelf: a stone niche of neat skulls and long bones, row on row (tidy, never gory)
  function boneShelf(g, px, py, k) {
    g.fillStyle = '#3a3630'; g.fillRect(px + 2, py - 14, TILE - 4, TILE + 10);
    g.fillStyle = '#2a2622'; for (let r = 0; r < 3; r++) g.fillRect(px + 5, py - 10 + r * 18, TILE - 10, 14);
    for (let r = 0; r < 3; r++) for (let j = 0; j < 3; j++) { const sx = px + 12 + j * 12, sy = py - 2 + r * 18;
      if ((j + r + k) % 3 === 0) { g.fillStyle = C.bone; g.fillRect(sx - 5, sy - 2, 12, 3); }
      else { g.fillStyle = C.bone; ell(g, sx, sy - 3, 4.2, 4); g.fill(); g.fillStyle = C.ink; ell(g, sx - 1.5, sy - 3.5, 1, 1.2); g.fill(); ell(g, sx + 1.5, sy - 3.5, 1, 1.2); g.fill(); } }
  }
  // Hollowford's memorial board: a little roofed board of names; one of them scraped off (Ambrose's), or written fresh
  function memorialBoard(g, px, py, mended) {
    const cx = px + TILE / 2, base = py + TILE - 6;
    shadow(g, cx, base + 2, 12); g.fillStyle = '#5a3c22'; g.fillRect(cx - 12, base - 30, 3, 32); g.fillRect(cx + 9, base - 30, 3, 32);
    g.fillStyle = '#8a8680'; g.fillRect(cx - 14, base - 34, 28, 22); g.fillStyle = '#4a3220'; g.fillRect(cx - 16, base - 37, 32, 4);
    g.fillStyle = '#3a3630'; for (let k = 0; k < 4; k++) g.fillRect(cx - 10, base - 30 + k * 5, k === 2 ? 10 : 18, 2);
    if (mended) { g.fillStyle = C.gold; g.fillRect(cx - 10, base - 20, 18, 2); }
    else { g.strokeStyle = '#5a5650'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - 9, base - 18); g.quadraticCurveTo(cx - 1, base - 23, cx + 8, base - 19); g.stroke(); }
  }
  function wallNames(g, px, py, k) { g.fillStyle = `rgba(232,246,255,${0.3 + 0.15 * Math.sin(time * 1.5 + k)})`; for (let j = 0; j < 4; j++) g.fillRect(px + 6 + j * 9, py + 18 + (j % 2) * 6, 6, 2); }
  function hollowCircle(g, x, y, t) { g.strokeStyle = `rgba(${VIOLET},${0.35 + 0.1 * Math.sin(t * 2)})`; g.lineWidth = 2; ell(g, x, y, 56, 24); g.stroke(); ell(g, x, y, 44, 18); g.stroke(); for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + t * 0.2; g.fillStyle = `rgba(${VIOLET},0.5)`; ell(g, x + Math.cos(a) * 50, y + Math.sin(a) * 21, 2.5, 2); g.fill(); } }

  // ---------- the ghosts (Speak with the Dead), the lanterns and the moths ----------
  function ghost(g, gh, t) {
    const x = gh.x, y = gh.y, hov = Math.sin(t * 2 + x * 0.01) * 2;
    glow(g, x, y - 14 + hov, 30, '200,230,240', 0.22);
    g.save(); g.translate(x, y + hov); g.globalAlpha *= 0.78;
    if (gh.kind === 'dog') {
      g.fillStyle = '#d6e8ee'; ell(g, 0, 2, 13, 7); g.fill(); ell(g, 11, -6, 6, 5.5); g.fill(); g.fillRect(-10, 2, 3, 9); g.fillRect(6, 2, 3, 9);
      g.beginPath(); g.moveTo(13, -11); g.lineTo(16, -16); g.lineTo(16, -9); g.closePath(); g.fill();
      g.strokeStyle = '#d6e8ee'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(-18, -6 + Math.sin(t * 6) * 2, -16, -10); g.stroke();
      g.fillStyle = '#8a5a2a'; g.fillRect(7, -3, 7, 2);
    } else if (gh.kind === 'bones') {
      skeleton(g, { facing: { x: -0.3, y: 1 }, moving: false, walkT: 0, attackT: 0 }, { hat: (g2) => { g2.fillStyle = '#5a4a3a'; ell(g2, 0, -19, 6.5, 2.6); g2.fill(); g2.fillRect(-4, -24, 8, 5); } });
    } else if (gh.kind === 'knight') {
      helper(g, 'lk', { x: 0, y: 0, facing: { x: 0, y: 1 }, moving: false, walkT: 0, attackT: 0, look: 'corwin' }, { frac: 1 });
    } else {
      // a person in mist: a hooded figure, a face, hands; each wanderer a little different (what he holds)
      g.fillStyle = '#d0e4ec'; g.beginPath(); g.moveTo(-9, 10); g.quadraticCurveTo(-11, -10, 0, -18); g.quadraticCurveTo(11, -10, 9, 10); g.quadraticCurveTo(0, 14 + Math.sin(t * 3) * 2, -9, 10); g.closePath(); g.fill();
      g.fillStyle = '#e8f4f8'; ell(g, 0, -20, 6, 6); g.fill();
      g.fillStyle = '#4a6a7a'; ell(g, -2.2, -20.5, 1, 1.2); g.fill(); ell(g, 2.2, -20.5, 1, 1.2); g.fill();
      const k = gh.kind;
      g.fillStyle = '#b8d0dc';
      if (k === 'pell') { g.fillRect(-14, -2, 7, 2); ell(g, -15, -1, 2.5, 2.5); g.fill(); }                  // a ladle
      else if (k === 'finn') { g.strokeStyle = '#b8d0dc'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(8, 2); g.lineTo(16, -18); g.stroke(); }   // a rod
      else if (k === 'snik') { g.fillStyle = '#c8e0c0'; ell(g, -7, -22, 3, 1.6, -0.5); g.fill(); ell(g, 7, -22, 3, 1.6, 0.5); g.fill(); }    // goblin ears
      else if (k === 'osric_ghost') { g.fillRect(-3, -4, 6, 8); }                                         // a counting slate
      else if (k === 'ivy') { g.fillStyle = '#f0f8ff'; ell(g, 6, -19, 1.4, 1.4); g.fill(); }            // the one earring
      else if (k === 'hob') { g.fillRect(-2, 6, 4, 4); }
      else if (k === 'farmer') { g.fillStyle = '#c8b890'; ell(g, 0, -25, 9, 2.5); g.fill(); g.fillRect(-5, -30, 10, 5); }
    }
    g.restore();
    if (gh.lantern) tinyLantern(g, x, y - 40, t);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText(gh.name, x + 1, y - 37);
    g.fillStyle = '#c8f4e8'; g.fillText(gh.name, x, y - 38);
  }
  function wayLantern(g, x, y, lit, prog) {
    g.fillStyle = '#3a2a1a'; g.fillRect(x - 2, y - 30, 4, 34); g.fillStyle = '#2a2a2a'; g.fillRect(x - 6, y - 40, 12, 12);
    g.fillStyle = lit ? C.flame : '#4a4638'; g.fillRect(x - 3.5, y - 37.5, 7, 7);
    if (lit) glow(g, x, y - 34, 26, GOLD, 0.4);
    if (prog > 0) { g.strokeStyle = C.teal; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y - 34, 11, -Math.PI / 2, -Math.PI / 2 + TAU * prog); g.stroke(); }
  }
  function tinyLantern(g, x, y, t) { g.fillStyle = '#2a2a2a'; g.fillRect(x - 3, y - 3, 6, 7); g.fillStyle = C.flame; g.fillRect(x - 1.5, y - 1.5, 3, 3); glow(g, x, y, 9, GOLD, 0.35 + 0.1 * Math.sin(t * 5)); }
  function moths(g, x, y, r) {
    for (let k = 0; k < 14; k++) { const p = Math.min(1, r * 1.3 + (k % 5) * 0.04), a = k * 2.4, mx = x + Math.cos(a) * (10 + p * 40) + Math.sin(time * 7 + k) * 4, my = y - 10 - p * 70 - (k % 4) * 6;
      g.fillStyle = `rgba(${VIOLET},${(1 - p) * 0.85})`; const fl = Math.abs(Math.sin(time * 14 + k)) * 3 + 1; ell(g, mx - 2, my, fl, 2.2); g.fill(); ell(g, mx + 2, my, fl, 2.2); g.fill(); }
  }

  // =====================================================================================================================
  // THE MONSTER LOOKS (MONSTER_LOOK.addType). Drawn round the monster's middle; `v` is what a puppet row also has.
  // =====================================================================================================================
  const hurtOf = v => v.hurtT > 0;
  function drawCandle(g, v) {
    const lit = !(v.hp <= 0), frac = v.maxHp > 0 ? Math.max(0, Math.min(1, v.hp / v.maxHp)) : 1;
    shadow(g, 0, 10, 12);
    g.fillStyle = '#4a3a2a'; g.fillRect(-9, 4, 18, 6); g.fillRect(-2, -6, 4, 12);
    g.fillStyle = '#5a4630'; ell(g, 0, -7, 9, 3); g.fill();
    const h = 8 + 12 * frac;
    g.fillStyle = C.candle; g.fillRect(-4, -8 - h, 8, h); g.fillStyle = '#e6dcc4'; g.fillRect(-4, -8 - h, 8, 2);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -8 - h); g.lineTo(0, -11 - h); g.stroke();
    if (lit) { const fl = Math.sin(time * 9 + (v.x || 0) * 0.1) * 0.8; glow(g, 0, -15 - h, 18, GOLD, 0.45); g.fillStyle = C.flame; ell(g, fl * 0.4, -15 - h, 3, 5.5); g.fill(); g.fillStyle = '#fffbe8'; ell(g, 0, -14 - h, 1.3, 2.4); g.fill(); }
    else { g.fillStyle = 'rgba(160,160,160,0.5)'; ell(g, Math.sin(time * 2) * 2, -18 - h - (time * 6 % 8), 2.5, 2.5); g.fill(); }
  }
  function drawBell(g, v) {
    shadow(g, 0, 16, 18);
    g.fillStyle = '#4a3220'; g.fillRect(-22, -34, 4, 50); g.fillRect(18, -34, 4, 50); g.fillRect(-24, -38, 48, 6);
    const st = String(v.state || 'idle'), ringing = /^w[1-6]$/.test(st) || st === 'won' || st === 'lost';
    const sw = ringing ? Math.sin(time * 6) * 0.25 : 0;
    g.save(); g.translate(0, -32); g.rotate(sw);
    g.fillStyle = '#b8902e'; g.beginPath(); g.moveTo(-6, 0); g.quadraticCurveTo(-8, 8, -13, 20); g.lineTo(13, 20); g.quadraticCurveTo(8, 8, 6, 0); g.closePath(); g.fill();
    g.strokeStyle = '#7a5a1e'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#d9b25c'; g.fillRect(-12, 16, 24, 3);
    g.fillStyle = '#5a4a2a'; ell(g, 0, 21, 2.6, 2.6); g.fill();
    g.restore();
    if (st === 'won') glow(g, 0, -14, 30, GOLD, 0.35);
  }
  function drawWisp(scale, col, dark) {
    return (g, v) => {
      const hov = Math.sin(time * 3 + (v.x || 0) * 0.05) * 3, s = scale;
      glow(g, 0, -8 + hov, 18 * s, col, 0.45);
      g.fillStyle = hurtOf(v) ? '#ffd8d8' : dark; g.beginPath(); g.moveTo(-7 * s, -2 * s + hov); g.quadraticCurveTo(-8 * s, -16 * s + hov, 0, -18 * s + hov); g.quadraticCurveTo(8 * s, -16 * s + hov, 7 * s, -2 * s + hov);
      g.quadraticCurveTo(4 * s, 4 * s + hov, 0, 1 * s + hov + Math.sin(time * 8) * 2); g.quadraticCurveTo(-4 * s, 4 * s + hov, -7 * s, -2 * s + hov); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; ell(g, -2.4 * s, -10 * s + hov, 1.4 * s, 1.8 * s); g.fill(); ell(g, 2.4 * s, -10 * s + hov, 1.4 * s, 1.8 * s); g.fill();
      if (v.attackT > 0) { g.fillStyle = `rgba(${col},0.6)`; ell(g, 0, -4 * s + hov, 4 * s, 2 * s); g.fill(); }   // puffing
    };
  }
  const drawBones = (g, v) => { shadow(g, 0, 15, 10); skeleton(g, v, { hurt: hurtOf(v), weapon: shortSword, eye: '#3a0a0a' }); };
  const drawGuard = (g, v) => { shadow(g, 0, 15, 11); skeleton(g, v, { hurt: hurtOf(v), weapon: stoneSword, sh: '#a8a290', eye: '#3a0a0a', hat: (g2) => { g2.fillStyle = '#6b707b'; g2.beginPath(); g2.arc(0, -16, 6.8, Math.PI, TAU); g2.fill(); g2.fillRect(-1, -24, 2, 5); } }); };
  const drawBrute = (g, v) => { shadow(g, 0, 28, 26); skeleton(g, v, { hurt: hurtOf(v), scale: 2.1, weapon: g2 => { g2.fillStyle = C.boneSh; g2.fillRect(-2, -16, 4, 16); ell(g2, 0, -17, 4, 4); g2.fill(); }, eye: '#3a0a0a', sh: '#a8a290' }); };
  function drawKing(g, v) {
    shadow(g, 0, 22, 18);
    if (String(v.state) === 'sweep') { g.strokeStyle = `rgba(${GOLD},0.75)`; g.lineWidth = 3; ell(g, 0, 18, 3 * TILE, 3 * TILE * 0.45); g.stroke(); g.fillStyle = `rgba(${GOLD},0.12)`; g.fill(); }
    skeleton(g, v, { hurt: hurtOf(v), scale: 1.45, weapon: stoneSword, sh: '#bdb59a', eyeGlow: '#ffcf7a',
      hat: (g2) => { g2.fillStyle = 'rgba(255,215,130,0.85)'; g2.beginPath(); g2.moveTo(-6.5, -19); g2.lineTo(-6.5, -25); g2.lineTo(-3, -21.5); g2.lineTo(0, -26.5); g2.lineTo(3, -21.5); g2.lineTo(6.5, -25); g2.lineTo(6.5, -19); g2.closePath(); g2.fill(); glow(g2, 0, -23, 9, GOLD, 0.35); } });
    g.fillStyle = 'rgba(120,20,30,0.55)'; g.beginPath(); g.moveTo(-10, -10); g.lineTo(10, -10); g.lineTo(13, 14); g.lineTo(-13, 14); g.closePath(); g.fill();   // a royal mantle, faded
  }
  function drawHollow(g, v) {
    const st = String(v.state || ''), fade = st === 'fade', f = v.facing || { x: 0, y: 1 }, dir = f.x < 0 ? -1 : 1;
    g.save(); if (fade) g.globalAlpha *= 0.22;
    shadow(g, 0, 24, 16);
    if (st === 'reap') { const a = Math.atan2(f.y, f.x); g.fillStyle = `rgba(${VIOLET},0.25)`; g.beginPath(); g.moveTo(0, 10); g.arc(0, 10, 3 * TILE, a - 0.9, a + 0.9); g.closePath(); g.fill(); g.strokeStyle = `rgba(${VIOLET},0.8)`; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 10, 3 * TILE, a - 0.9, a + 0.9); g.stroke(); }
    // a tall hooded shade in dark robes, tendrils at its hem
    g.fillStyle = hurtOf(v) ? '#5a3040' : '#17131f';
    g.beginPath(); g.moveTo(-15, 22); g.quadraticCurveTo(-17, -10, -9, -30); g.quadraticCurveTo(0, -42, 9, -30); g.quadraticCurveTo(17, -10, 15, 22);
    for (let k = 0; k <= 6; k++) g.lineTo(15 - k * 5, 22 + Math.sin(time * 4 + k) * 4 + (k % 2) * 4);
    g.closePath(); g.fill();
    g.fillStyle = '#0b090f'; ell(g, 0, -27, 8, 8.5); g.fill();
    g.fillStyle = '#ff8a1a'; ell(g, dir * 1.5, -27, 2.6, 1.8); g.fill(); glow(g, dir * 1.5, -27, 10, '255,138,26', 0.5);
    // the Void Scythe in its hands (the scythe's own colours: a purple-to-orange crescent)
    const sw = v.attackT > 0 ? Math.sin((1 - v.attackT / 0.22) * Math.PI) : 0;
    g.save(); g.translate(dir * 12, -6); g.rotate(dir * (0.2 + sw * 1.3));
    g.fillStyle = '#251e30'; g.fillRect(-1.6, -34, 3.2, 52);
    const gr = g.createLinearGradient(0, -34, dir * 22, -18); gr.addColorStop(0, '#ffb08a'); gr.addColorStop(0.4, '#e872cc'); gr.addColorStop(1, '#8f4dff');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -34); g.quadraticCurveTo(dir * 26, -36, dir * 24, -12); g.quadraticCurveTo(dir * 14, -28, 0, -28); g.closePath(); g.fill();
    g.restore();
    g.restore();
  }
  function drawNameWisp(g, v) {
    const hov = Math.sin(time * 5 + (v.x || 0)) * 2;
    glow(g, 0, -6 + hov, 14, '232,246,255', 0.6);
    // a ribbon of light with a name written on it, its tail streaming behind
    g.fillStyle = hurtOf(v) ? 'rgba(255,220,220,0.85)' : 'rgba(240,248,255,0.85)';
    g.beginPath(); g.moveTo(-9, -9 + hov); g.quadraticCurveTo(0, -12 + hov, 9, -9 + hov); g.lineTo(9, -4 + hov); g.quadraticCurveTo(0, -7 + hov, -9, -4 + hov); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(200,220,255,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-9, -6 + hov); g.quadraticCurveTo(-14, -3 + hov + Math.sin(time * 7) * 2, -17, -6 + hov); g.stroke();
    g.fillStyle = '#4a6a9a'; for (let k = 0; k < 5; k++) g.fillRect(-6.5 + k * 3, -8.4 + hov + (k % 2) * 0.6, 1.8, 2.6);
    g.fillStyle = '#ffffff'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(-4 + k * 4, -13 + hov - (time * 3 + k) % 3, 0.9, 0, TAU); g.fill(); }
  }
  // boxes: [x0, y0, x1, y1] standing, then swinging, in game pixels round the middle (measured in Chromium: every 16th of
  // a turn, standing, walking and swinging, 3 px all round; ~/.fanglands/work/necromancy/measure.cjs)
  const LOOKS = {
    watch_candle: { draw: drawCandle, r: 12, pic: false, box: [-20, -55, 20, 17, -20, -55, 20, 17] },
    watch_bell: { draw: drawBell, r: 18, pic: false, box: [-30, -44, 30, 25, -30, -44, 30, 25] },
    barrow_wisp: { draw: drawWisp(1, TEAL, '#bff6e8'), r: 11, pic: false, box: [-20, -25, 20, 14, -20, -25, 20, 14] },
    shade_wisp: { draw: drawWisp(1.15, '120,130,200', '#b8c0f0'), r: 12, pic: false, box: [-23, -28, 22, 17, -23, -28, 22, 17] },
    void_wisp: { draw: drawWisp(1.3, VIOLET, '#c8b0ff'), r: 13, pic: false, box: [-25, -30, 25, 19, -25, -30, 25, 19] },
    old_snuffer: { draw: drawWisp(1.7, '180,200,180', '#d8e8d8'), r: 18, pic: false, box: [-32, -37, 31, 26, -32, -37, 31, 26] },
    snuffer: { draw: drawWisp(1.9, '120,130,200', '#b8c0f0'), r: 20, pic: false, box: [-35, -40, 35, 29, -35, -40, 35, 29] },
    deep_snuffer: { draw: drawWisp(2.1, VIOLET, '#c8b0ff'), r: 22, pic: false, box: [-38, -44, 38, 33, -38, -44, 38, 33] },
    barrow_bones: { draw: drawBones, r: 12, pic: true, box: [-17, -23, 16, 21, -22, -23, 22, 21] },
    barrow_guard: { draw: drawGuard, r: 13, pic: true, box: [-21, -27, 21, 22, -23, -27, 23, 22] },
    barrow_brute: { draw: drawBrute, r: 30, pic: false, box: [-42, -45, 41, 40, -42, -45, 41, 40] },
    barrow_king: { draw: drawKing, r: 20, pic: false, box: [-29, -48, 29, 31, -149, -52, 149, 87] },
    the_hollow: { draw: drawHollow, r: 22, pic: false, box: [-43, -43, 42, 33, -149, -139, 148, 153] },
    name_wisp: { draw: drawNameWisp, r: 10, pic: false, box: [-21, -24, 16, 9, -21, -24, 16, 9] },
  };
  if (window.MONSTER_LOOK && MONSTER_LOOK.addType) for (const t in LOOKS) MONSTER_LOOK.addType(t, LOOKS[t]);
  // their deaths: the undead crumble (79-deaths' kind, from MONSTER_DEFS `death: 'undead'`); the candles and the bell never die

  // =====================================================================================================================
  // THE ICONS (80-icons: inside -9..+9, nothing under 2 units across, never branching on size)
  // =====================================================================================================================
  if (window.ICONS && ICONS.set) {
    const ol = (g, a) => { g.strokeStyle = `rgba(0,0,0,${a || 0.5})`; g.lineWidth = 1; g.stroke(); };
    ICONS.set('soul_shard', (g, size, item) => {          // a small blue-green crystal, glowing at its heart
      g.fillStyle = 'rgba(126,240,208,0.3)'; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
      g.fillStyle = item.color; g.beginPath(); g.moveTo(0, -8); g.lineTo(5, -2); g.lineTo(3, 7); g.lineTo(-3, 7); g.lineTo(-5, -2); g.closePath(); g.fill(); ol(g);
      g.fillStyle = '#d8fff4'; g.beginPath(); g.moveTo(0, -6); g.lineTo(2.4, -1.6); g.lineTo(0, 4); g.lineTo(-2.4, -1.6); g.closePath(); g.fill();
    });
    ICONS.set('brute_bone', (g, size, item) => {          // a huge knuckled bone, three knobs at each end
      g.save(); g.rotate(-0.6); g.fillStyle = item.color;
      g.fillRect(-6, -2.6, 12, 5.2); for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 6.5, -2.6, 2.8, 0, TAU); g.arc(s * 6.5, 2.6, 2.8, 0, TAU); g.fill(); g.beginPath(); g.arc(s * 8.2, 0, 2.4, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.strokeRect(-6, -2.6, 12, 5.2); g.restore();
    });
    ICONS.set('barrow_wand', (g, size, item) => {         // a short pale-wood rod, a blue gem at its tip
      g.save(); g.rotate(-0.8); g.fillStyle = item.color; g.fillRect(-8, -1.2, 13, 2.4); ol(g);
      g.fillStyle = '#6a4a2a'; g.fillRect(-8, -1.6, 4, 3.2);
      g.fillStyle = '#4aa3df'; g.beginPath(); g.moveTo(5, 0); g.lineTo(7, -2.4); g.lineTo(9, 0); g.lineTo(7, 2.4); g.closePath(); g.fill(); ol(g);
      g.restore();
    });
    ICONS.set('gravewood_stave', (g, size, item) => {     // a dark twisted staff, a skull knot at its head
      g.save(); g.rotate(-0.7); g.strokeStyle = item.color; g.lineWidth = 2.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-9, 0); for (let x = -9; x <= 4; x += 1) g.lineTo(x, Math.sin(x * 1.1) * 1.2); g.stroke();
      g.fillStyle = '#e9e4d2'; g.beginPath(); g.arc(6.5, 0, 3.2, 0, TAU); g.fill(); ol(g);
      g.fillStyle = '#1a1814'; g.fillRect(5.6, -1.6, 2, 2);
      g.restore();
    });
    ICONS.set('tobias_stone', (g, size, item) => {        // an old grave slab, a curved scrape where the name was
      g.fillStyle = item.color; g.beginPath(); g.moveTo(-6, 8); g.lineTo(-6, -4); g.quadraticCurveTo(0, -10, 6, -4); g.lineTo(6, 8); g.closePath(); g.fill(); ol(g);
      g.strokeStyle = '#4a4a44'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-3.5, -2); g.quadraticCurveTo(0, -5, 3.5, 1); g.stroke();
    });
    ICONS.set('bramble_collar', (g, size, item) => {      // a worn leather collar with a brass tag
      g.strokeStyle = item.color; g.lineWidth = 3; g.beginPath(); g.ellipse(0, -1, 7, 5, 0, 0, TAU); g.stroke();
      g.fillStyle = '#d9b25c'; g.beginPath(); g.arc(0, 5.6, 2.6, 0, TAU); g.fill(); ol(g);
      g.fillStyle = '#8a8a82'; g.fillRect(4.6, -4, 2.6, 2.6);
    });
    ICONS.set('little_bell', (g, size, item) => {         // a little brass hand bell on a wooden handle
      g.fillStyle = '#6b4a2a'; g.fillRect(-1.2, -9, 2.4, 5);
      g.fillStyle = item.color; g.beginPath(); g.moveTo(-3, -4); g.quadraticCurveTo(-4, 1, -7, 5); g.lineTo(7, 5); g.quadraticCurveTo(4, 1, 3, -4); g.closePath(); g.fill(); ol(g);
      g.fillStyle = '#7a5a1e'; g.beginPath(); g.arc(0, 6.6, 1.8, 0, TAU); g.fill();
    });
    ICONS.set('neds_turnip', (g, size, item) => {         // a turnip: white and purple, two green leaves
      g.fillStyle = '#4f7f36'; g.beginPath(); g.ellipse(-2, -6, 2, 4.4, -0.4, 0, TAU); g.fill(); g.beginPath(); g.ellipse(2.4, -6, 2, 4.4, 0.4, 0, TAU); g.fill();
      g.fillStyle = item.color; g.beginPath(); g.arc(0, 2, 6, 0, TAU); g.fill(); ol(g);
      g.fillStyle = '#9a5aa8'; g.beginPath(); g.arc(0, 2, 6, Math.PI * 1.05, Math.PI * 1.95); g.fill();
      g.strokeStyle = '#e2d6e8'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 8); g.lineTo(0, 9.5); g.stroke();
    });
    ICONS.set('kings_seal', (g, size, item) => {          // a gold seal with a crown
      g.fillStyle = item.color; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill(); ol(g);
      g.fillStyle = '#7a5a1e'; g.beginPath(); g.moveTo(-5, 3); g.lineTo(-5, -2.5); g.lineTo(-2.4, 0); g.lineTo(0, -4); g.lineTo(2.4, 0); g.lineTo(5, -2.5); g.lineTo(5, 3); g.closePath(); g.fill();
    });
    if (ICONS.cape) { const f = ICONS.cape('necromancy'); if (f) ICONS.set('cape_necromancy', f); }
  }

  // =====================================================================================================================
  // GRANNY WICK: the townsfolk sample's own parts (83-townsart), an old woman in a dark shawl with a candle in her hand
  // =====================================================================================================================
  if (typeof TOWNSFOLK_ART !== 'undefined' && TOWNSFOLK_ART.npc && TOWNSFOLK_ART.NEW_NPC) {
    const S = TOWNSFOLK_ART.SKIN, TA = TOWNSFOLK_ART;
    // (as 83-townsart's own addPeople registers a family: the drawing, the family's name, the spec)
    const add = (family, specs) => { for (const [id, sp] of Object.entries(specs)) { TA.NEW_NPC[id] = TA.npc(sp); TA.NPC_FAMILY[id] = family; TA.NPC_SPEC[id] = sp; } };
    add('oldbarrow', {
      granny_wick: {
        build: 'adult', size: 0.94, skin: S.fair,
        face: { eye: '#3a5a4a', lash: '#2a1a10', brow: '#d8d4cc', lines: true, age: 'elder', eyes: 'sleepy', mouth: 'smile', lip: '#a05a5a', nose: 'long', blush: 'rgba(220,140,140,0.35)' },
        hair: { style: 'bun', c: '#e2ddd4' },
        hat: { kind: 'kerchief', c: '#232b25', dots: '#4fd1b5' },
        body: { kind: 'dress', c: '#2f3a2a', under: '#e8dcc0', sleeve: '#283224', belt: '#1e2a1c' },
        over: [{ kind: 'apron', c: '#d8cfb8', bib: false, stain: '#f2e2a0' }, { kind: 'shawl', c: '#1c2420' }],
        legs: { boot: '#2a2420' },
        off: { kind: 'candle', c: '#f2ead2' },
      },
    });
  }

  // ---------- the cast's sound: a soft rising chime ----------
  if (typeof SFX === 'object' && SFX && !SFX.necro && typeof tone === 'function') SFX.necro = () => { tone('sine', 660, 990, 0.25, 0.04); tone('triangle', 330, 495, 0.3, 0.02); };

  return { C, helper, bolt, flash, shard, thing, boneShelf, memorialBoard, mound, moundWisps, lychGate, candleCell, oldGrave, tobiasStone, spoil, pawPrints, nameLight, deepThing, wallNames, hollowCircle, ghost, wayLantern, tinyLantern, moths, skeleton, LOOKS };
})();
window.NECRO_ART = NECRO_ART;
