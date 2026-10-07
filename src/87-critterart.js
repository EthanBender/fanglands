// ============================================================================
// THE STARTING CREATURES' LOOK (the Great Spread, Stage 5a; the rules are 87-critters)
// src/87-critterart.js — pictures only: stripped from the server's copy (tools/build-sim.mjs STRIP_FILES).
//
// Five new monsters drawn in the hand of the owner-approved sample (78-monsterart, through its shared helpers
// MONSTER_ART.H), keeping its binding calls: animals seen from the side (facing us from the front, facing away from
// behind), birds and the low things that crawl seen from above with a shadow, turned to face where they go.
//   crow        from above: wings folded as it struts and pecks, open and beating as it flits low; a glossy blue-black
//   giant rat   from the side: a long body low to the ground, round pink ears, a bald pink tail, whiskers
//   snake       from above: an S that travels as it slithers and sways as it waits, a yellow collar, a flicking tongue
//   adder       the same, grey-brown with the black zigzag down its back and a red eye
//   wild dog    from the side: a scruffy tan mongrel, one ear up and one flopped, its tail curled over its back
// 78-monsterart.js is generated from the sample and never edited by hand: these are added through
// MONSTER_LOOK.addType (their boxes measured as the sample's were: every 16th of a turn, standing, walking and biting,
// in headless Chromium, 3 px all round; ~/.fanglands/work/spread/s5a/measure.cjs), so every place that draws a monster
// (the world, a puppet online, a falling body, the book's portrait, the admin panel) draws these too.
// Also here: 79-deaths' legs as one rolls over (a crow's two, a snake's none), the icons of the crow feather and the
// snakeskin (80-icons' rules: inside -9..+9), and the book's words for each creature.
// ============================================================================
{
  const H = MONSTER_ART.H, { lerp, OUT, shade, rr, ell, outline, vfill, rfill, shadow, face4, swingOf, bobOf } = H;
  const TAU = Math.PI * 2;

  // ---------- the shared moves (the sample's own, redone here: 78-monsterart keeps them inside its closure) ----------
  // seen from above, turned to face where it goes; the shadow drawn first, offset (a flyer's lift)
  function topDown(g, e, fn, shadowOff) {
    const ang = Math.atan2(e.facing.y, e.facing.x);
    g.save();
    if (shadowOff) { g.save(); g.translate(shadowOff.x, shadowOff.y); g.rotate(ang); fn(g, true); g.restore(); }
    g.rotate(ang); fn(g, false); g.restore();
  }
  // four legs in a trot (diagonal pairs together): L { xs: [back, front], y, len, w, c, foot, k }
  function quadLegs(g, e, L) {
    const ph = e.moving ? e.walkT : 0;
    for (const [x, p, dim] of [[L.xs[0], 0, 0.82], [L.xs[1], Math.PI, 0.82], [L.xs[0] + 1.6, Math.PI, 1], [L.xs[1] + 1.6, 0, 1]]) {
      const a = e.moving ? Math.sin(ph + p) * (L.k || 0.45) : 0;
      g.save(); g.translate(x, L.y); g.rotate(a);
      rr(g, -L.w / 2, 0, L.w, L.len, L.w / 2); g.fillStyle = dim < 1 ? shade(L.c, -0.25) : L.c; g.fill(); outline(g, 0.5);
      rr(g, -L.w / 2 - 0.2, L.len - 1.4, L.w + 0.4, 1.8, 0.8); g.fillStyle = L.foot; g.fill();
      g.restore();
    }
  }
  // side-on, mirrored facing left; facing us its front, facing away its back
  function drawQuad(g, e, Q) {
    const f = face4(e), sw = swingOf(e), bob = bobOf(e, 1);
    g.save(); shadow(g, 0, Q.ground + 0.6, Q.sh, 3.2);
    if (f === 'down' || f === 'up') { g.translate(0, bob); (f === 'down' ? Q.front : Q.rear)(g, e, sw); g.restore(); return; }
    if (f === 'left') g.scale(-1, 1);
    g.translate(sw >= 0 ? Math.sin(sw * Math.PI) * (Q.lunge || 3) : 0, 0);
    Q.side(g, e, sw, bob);
    g.restore();
  }
  // a bite: a few white dashes where the jaws met
  function snap(g, x, y, sw) {
    if (sw < 0.25 || sw > 0.85) return;
    const a = 1 - Math.abs(sw - 0.55) / 0.3;
    g.save(); g.strokeStyle = `rgba(255,255,255,${(0.7 * a).toFixed(3)})`; g.lineWidth = 0.8; g.lineCap = 'round';
    for (const [dx, dy] of [[1.6, -1.8], [2.4, 0], [1.6, 1.8]]) { g.beginPath(); g.moveTo(x + dx * 0.6, y + dy * 0.6); g.lineTo(x + dx * 1.4, y + dy * 1.4); g.stroke(); }
    g.restore();
  }

  // ---------- the crow ----------
  const CROW = { c: '#23262f', gloss: '#56649a', dark: '#14161c', beak: '#3e3c3a', beakHi: '#6a6660', eye: '#e2c86a' };
  function drawCrow(g, e) {
    const sw = swingOf(e), peck = sw >= 0 ? Math.sin(sw * Math.PI) : 0, seed = e.seed || 0;
    // standing it hops now and then (a 2 s loop); moving it flits a hand's height off the grass, wings beating twice a step
    const hop = e.moving ? 0 : Math.max(0, Math.sin(time * Math.PI * 2 + seed)) * 1.6;
    const lift = e.moving ? 6.5 + Math.sin(e.walkT) * 0.8 : hop;
    const beat = e.moving ? Math.sin(e.walkT * 2) : 0, open = e.moving ? 1 : 0;
    const body = (g, sh) => {
      const col = c => sh ? 'rgba(0,0,0,0.22)' : c;
      // the tail: a fan of long feathers
      g.beginPath(); g.moveTo(-3.6, -1.2); g.lineTo(-10.4, -3); g.quadraticCurveTo(-11.6, 0, -10.4, 3); g.lineTo(-3.6, 1.2); g.closePath();
      g.fillStyle = sh ? col() : vfill(g, CROW.c, -3, 3, 0.15, -0.3); g.fill();
      if (!sh) { outline(g, 0.5); g.strokeStyle = CROW.dark; g.lineWidth = 0.45; for (const y of [-1.6, 0, 1.6]) { g.beginPath(); g.moveTo(-5, y * 0.4); g.lineTo(-10.2, y * 1.4); g.stroke(); } }
      // the wings: folded along its back, or spread and beating
      for (const s of [-1, 1]) {
        if (open) {
          const span = 10.5 + beat * 2.2, W = y => s * y * (span / 10.5);
          g.beginPath(); g.moveTo(1.8, s * 1.8); g.quadraticCurveTo(1.2, W(6.5), -0.6, W(11));
          for (let k = 0; k < 4; k++) { const x = -1.4 - k * 1.4, y = 11.4 - k * 1.5; g.lineTo(x - 1.4, W(y + 0.4)); g.lineTo(x - 0.7, W(y - 1)); }
          g.quadraticCurveTo(-6.6, W(4.6), -4.8, s * 1.6); g.closePath();
          g.fillStyle = sh ? col() : vfill(g, CROW.c, -11, 11, 0.12, -0.25); g.fill();
          if (sh) continue;
          outline(g, 0.55);
          g.strokeStyle = 'rgba(120,140,200,0.35)'; g.lineWidth = 0.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-0.4 - k * 1.2, W(3 + k)); g.lineTo(-1.6 - k * 1.4, W(9.4 - k * 1.2)); g.stroke(); }
        } else {
          ell(g, -2.2, s * 2.6, 6.2, 2, s * -0.06); g.fillStyle = sh ? col() : vfill(g, CROW.c, s * 2.6 - 2, s * 2.6 + 2, 0.18, -0.3); g.fill();
          if (sh) continue;
          outline(g, 0.5);
          g.strokeStyle = CROW.dark; g.lineWidth = 0.4; for (const x of [-4.6, -6.4]) { g.beginPath(); g.moveTo(x, s * 1.4); g.lineTo(x - 1.4, s * 3.6); g.stroke(); }
        }
      }
      // the body and its blue sheen
      ell(g, -0.8, 0, 5.4, 3.3); g.fillStyle = sh ? col() : rfill(g, CROW.c, -0.8, 0, 5.4); g.fill(); if (sh) return; outline(g, 0.6);
      g.fillStyle = 'rgba(86,100,154,0.45)'; ell(g, -1.6, -1, 3, 1, -0.1); g.fill();
      // the head, pushed forward in a peck
      const hx = 4.6 + peck * 2.4;
      ell(g, hx, 0, 2.7, 2.5); g.fillStyle = rfill(g, CROW.c, hx, 0, 2.7); g.fill(); outline(g, 0.5);
      g.fillStyle = 'rgba(86,100,154,0.5)'; ell(g, hx - 0.6, -0.9, 1.2, 0.6); g.fill();
      // the beak, a little open at the bottom of a peck
      const gape = peck > 0.5 ? (peck - 0.5) * 1.2 : 0;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx + 1.6, s * 1); g.lineTo(hx + 5.6, s * gape * 0.5); g.lineTo(hx + 1.8, s * 0.1); g.closePath(); g.fillStyle = s < 0 ? CROW.beakHi : CROW.beak; g.fill(); outline(g, 0.35); }
      for (const s of [-1, 1]) { ell(g, hx + 0.9, s * 1.5, 0.62, 0.56); g.fillStyle = CROW.eye; g.fill(); ell(g, hx + 1.05, s * 1.5, 0.3, 0.34); g.fillStyle = '#0d0d10'; g.fill(); }
    };
    g.save(); g.translate(0, -lift); topDown(g, e, body, { x: 1.5 + lift * 0.25, y: lift + 4 }); g.restore();
    // the feet, when it stands: two little three-toed prints of shadow under it
    if (!e.moving && lift < 0.6) { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.4, 3.8); g.lineTo(s * 1.4 - 1, 5); g.moveTo(s * 1.4, 3.8); g.lineTo(s * 1.4 + 1, 5); g.stroke(); } }
  }

  // ---------- the giant rat ----------
  const RAT = { c: '#7b6b5c', belly: '#bcae9a', dark: '#4e4238', skin: '#dba2a0', nose: '#c46f74' };
  function ratTail(g, x, y, e, len, sideways) {
    const wig = Math.sin(time * Math.PI * 2 + (e.seed || 0)) * 0.6 + (e.moving ? Math.sin(e.walkT) * 0.8 : 0);
    g.lineCap = 'round';
    for (const [w, c] of [[2.4, OUT], [1.5, RAT.skin]]) {
      g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
      if (sideways) g.bezierCurveTo(x - len * 0.4, y + 3 + wig, x - len * 0.7, y - 2 - wig, x - len, y + 1 + wig * 1.5);
      else g.bezierCurveTo(x + 2 + wig, y + len * 0.4, x - 2 - wig, y + len * 0.7, x + wig * 1.5, y + len);
      g.stroke();
    }
    g.strokeStyle = 'rgba(120,60,60,0.35)'; g.lineWidth = 0.4;
    for (let k = 1; k < 5; k++) { const t = k / 5; const px = sideways ? x - len * t : x + Math.sin(t * 3) * 1.2, py = sideways ? y + Math.sin(t * 6 + wig) * 1.6 : y + len * t; g.beginPath(); g.moveTo(px - 0.6, py - 0.6); g.lineTo(px + 0.6, py + 0.6); g.stroke(); }
  }
  function ratSide(g, e, sw, bob) {
    ratTail(g, -9.5, 1.6 + bob, e, 13, true);
    quadLegs(g, e, { xs: [-6, 3.8], y: 3 + bob, len: 4.2, w: 2, c: RAT.c, foot: RAT.skin, k: 0.6 });
    g.translate(0, bob);
    // a long low body, its back arched
    g.beginPath(); g.moveTo(-10.4, 2.4); g.quadraticCurveTo(-11, -4.6, -3, -5.4); g.quadraticCurveTo(4, -5.8, 7.4, -2.6); g.quadraticCurveTo(8.4, 2, 5, 4); g.quadraticCurveTo(-3, 5.4, -10.4, 2.4); g.closePath();
    g.fillStyle = vfill(g, RAT.c, -6, 5, 0.18, -0.3); g.fill(); outline(g, 0.8);
    g.beginPath(); g.moveTo(-8.6, 3); g.quadraticCurveTo(-1, 5.2, 4.6, 3.6); g.quadraticCurveTo(-1, 2.6, -8.6, 3); g.fillStyle = RAT.belly; g.fill();
    // a rough coat
    g.strokeStyle = 'rgba(40,30,22,0.45)'; g.lineWidth = 0.45; for (const x of [-7.4, -4.6, -1.8, 1]) { g.beginPath(); g.moveTo(x, -4.6); g.lineTo(x + 1, -2.8); g.stroke(); }
    // the head: a long wedge to a pink nose, a round ear
    const bite = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    g.save(); g.translate(6.4, -2.2); g.rotate(sw >= 0 ? 0.12 : Math.sin(time * Math.PI * 3) * 0.04);
    g.beginPath(); g.moveTo(-2.4, -3.2); g.quadraticCurveTo(2, -3.6, 7, -0.4); g.quadraticCurveTo(7.2, 1, 6, 1.6); g.quadraticCurveTo(1, 3.4, -2.6, 2.4); g.closePath();
    g.fillStyle = vfill(g, RAT.c, -3.4, 2.6); g.fill(); outline(g, 0.7);
    ell(g, 7, 0.5, 1.1, 0.95); g.fillStyle = RAT.nose; g.fill(); outline(g, 0.35);
    // whiskers
    g.strokeStyle = 'rgba(240,235,225,0.75)'; g.lineWidth = 0.35; for (const a of [-0.35, 0, 0.35]) { g.beginPath(); g.moveTo(6, 0.8); g.lineTo(6 + Math.cos(a) * 4.4, 0.8 + Math.sin(a) * 2.6); g.stroke(); }
    // teeth in a bite
    if (bite > 0.1) { g.fillStyle = '#f6eed2'; g.fillRect(5.2, 1.4, 0.9, 1.2 * bite + 0.4); g.fillStyle = '#6a2a2a'; ell(g, 4.6, 1.8, 1.4, 0.6 * bite); g.fill(); }
    // the ear and the eye
    ell(g, -0.8, -3.6, 2.3, 2.1, -0.2); g.fillStyle = RAT.c; g.fill(); outline(g, 0.5); ell(g, -0.7, -3.5, 1.4, 1.2, -0.2); g.fillStyle = RAT.skin; g.fill();
    ell(g, 2.6, -1.1, 0.8, 0.75); g.fillStyle = '#120a08'; g.fill(); ell(g, 2.8, -1.3, 0.28, 0.28); g.fillStyle = '#fff'; g.fill();
    g.restore();
    snap(g, 13.6, -1.6, sw);
  }
  function ratFront(g, e, sw) {
    quadLegs(g, e, { xs: [-3, 1.4], y: 3.2, len: 4, w: 2, c: RAT.c, foot: RAT.skin, k: 0.25 });
    ell(g, 0, 0.8, 7, 5.2); g.fillStyle = vfill(g, RAT.c, -4, 6); g.fill(); outline(g, 0.8);
    g.fillStyle = RAT.belly; ell(g, 0, 2.4, 3.6, 2.6); g.fill();
    const hy = -3.4;
    for (const s of [-1, 1]) { ell(g, s * 3.8, hy - 3.2, 2.4, 2.2); g.fillStyle = RAT.c; g.fill(); outline(g, 0.5); ell(g, s * 3.8, hy - 3.1, 1.5, 1.35); g.fillStyle = RAT.skin; g.fill(); }
    g.beginPath(); g.moveTo(-4, hy - 1.6); g.quadraticCurveTo(0, hy - 4.4, 4, hy - 1.6); g.quadraticCurveTo(2, hy + 3.4, 0, hy + 4); g.quadraticCurveTo(-2, hy + 3.4, -4, hy - 1.6); g.closePath();
    g.fillStyle = rfill(g, RAT.c, 0, hy, 4.4); g.fill(); outline(g, 0.7);
    ell(g, 0, hy + 3.6, 1.1, 0.9); g.fillStyle = RAT.nose; g.fill();
    g.strokeStyle = 'rgba(240,235,225,0.75)'; g.lineWidth = 0.35; for (const s of [-1, 1]) for (const a of [-0.2, 0.15]) { g.beginPath(); g.moveTo(s * 0.8, hy + 3.2); g.lineTo(s * 5, hy + 3.2 + a * 6); g.stroke(); }
    for (const s of [-1, 1]) { ell(g, s * 1.7, hy, 0.75, 0.75); g.fillStyle = '#120a08'; g.fill(); ell(g, s * 1.85, hy - 0.2, 0.26, 0.26); g.fillStyle = '#fff'; g.fill(); }
    if (sw >= 0) { g.fillStyle = '#f6eed2'; g.fillRect(-0.9, hy + 4.4, 0.8, 1.4); g.fillRect(0.1, hy + 4.4, 0.8, 1.4); }
  }
  function ratRear(g, e) {
    quadLegs(g, e, { xs: [-3, 1.4], y: 3.2, len: 4, w: 2, c: RAT.c, foot: RAT.skin, k: 0.25 });
    ell(g, 0, 0.6, 7, 5.4); g.fillStyle = vfill(g, RAT.c, -5, 6); g.fill(); outline(g, 0.8);
    g.strokeStyle = 'rgba(40,30,22,0.45)'; g.lineWidth = 0.45; for (const x of [-3, 0, 3]) { g.beginPath(); g.moveTo(x, -3.6); g.lineTo(x + 0.6, -1.6); g.stroke(); }
    for (const s of [-1, 1]) { ell(g, s * 3.4, -5.4, 2.2, 2); g.fillStyle = RAT.c; g.fill(); outline(g, 0.5); }
    ratTail(g, 0, 4.4, e, 9, false);
  }
  function drawRat(g, e) { drawQuad(g, e, { ground: 7.2, sh: 9.5, side: ratSide, front: ratFront, rear: ratRear, lunge: 3.5 }); }

  // ---------- the snakes ----------
  const GRASS_SNAKE = { c: '#5f7a3a', back: '#4a6230', belly: '#c9c178', collar: '#efd35a', fleck: '#2c3a1c', eye: '#f0d060', tongue: '#d8455a' };
  const ADDER = { c: '#8a7a62', back: '#6e604c', belly: '#c8b896', zig: '#2a221c', eye: '#d24a32', tongue: '#d8455a' };
  // the body as a chain of discs from the tail (0) to the head (N - 1), its S travelling down it as it slithers
  function snakeSpine(e, S) {
    const N = 20, sw = swingOf(e), strike = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    const ph = e.moving ? e.walkT : time * Math.PI, amp = e.moving ? 2.8 : 1.5;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      let x = lerp(-S.len / 2, S.len / 2, u), y = Math.sin(u * 7.2 - ph) * amp * (0.35 + 0.65 * Math.sin(Math.min(1, u * 1.15) * Math.PI));
      // the strike: the front third straightens and throws the head forward
      if (strike > 0 && u > 0.6) { const k = (u - 0.6) / 0.4; x += strike * 4.8 * k * k; y *= 1 - strike * k; }
      const w = S.w * (u < 0.85 ? 0.32 + 0.68 * Math.sin(Math.min(1, (u + 0.08) * 1.25) * Math.PI / 2) : 0.82);
      pts.push([x, y, w]);
    }
    return { pts, strike };
  }
  function drawSnakeBody(g, e, S) {
    // its shadow follows the S it lies in (drawn by topDown, a little below it)
    topDown(g, e, (g, sh) => {
      const { pts, strike } = snakeSpine(e, S), N = pts.length;
      if (sh) { g.fillStyle = 'rgba(0,0,0,0.2)'; for (const [x, y, w] of pts) { ell(g, x, y, w / 2 + 0.6, w / 2 + 0.6); g.fill(); } return; }
      // the outline, then the body, then the back's darker line
      for (const [x, y, w] of pts) { ell(g, x, y, w / 2 + 0.7, w / 2 + 0.7); g.fillStyle = OUT; g.fill(); }
      for (let i = 0; i < N; i++) { const [x, y, w] = pts[i]; ell(g, x, y, w / 2, w / 2); g.fillStyle = i % 2 ? S.c : shade(S.c, 0.06); g.fill(); }
      for (let i = 1; i < N - 2; i++) { const [x, y, w] = pts[i]; ell(g, x, y + w * 0.22, w * 0.3, w * 0.16); g.fillStyle = S.belly; g.fill(); }
      g.strokeStyle = S.back; g.lineWidth = Math.max(1, S.w * 0.28); g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[1][0], pts[1][1] - pts[1][2] * 0.12);
      for (let i = 2; i < N - 2; i++) g.lineTo(pts[i][0], pts[i][1] - pts[i][2] * 0.12); g.stroke();
      // its pattern: the adder's zigzag, the grass snake's black flecks and yellow collar
      if (S.zig) {
        g.strokeStyle = S.zig; g.lineWidth = Math.max(1, S.w * 0.2); g.lineJoin = 'miter'; g.beginPath();
        for (let i = 2; i < N - 2; i++) { const [x, y, w] = pts[i]; const o = (i % 2 ? 1 : -1) * w * 0.26; if (i === 2) g.moveTo(x, y + o); else g.lineTo(x, y + o); }
        g.stroke();
      } else {
        g.fillStyle = S.fleck; for (let i = 3; i < N - 3; i += 2) { const [x, y, w] = pts[i]; for (const s of [-1, 1]) { ell(g, x, y + s * w * 0.3, 0.55, 0.45); g.fill(); } }
        const [cx, cy, cw] = pts[N - 3]; for (const s of [-1, 1]) { ell(g, cx, cy + s * cw * 0.28, 0.9, 0.7); g.fillStyle = S.collar; g.fill(); }
      }
      // the head: along the last stretch of the body, a little wider than the neck
      const [hx, hy] = pts[N - 1], [nx, ny] = pts[N - 3], ha = Math.atan2(hy - ny, hx - nx);
      g.save(); g.translate(hx, hy); g.rotate(ha);
      // the tongue, flicking out (twice in each 2 s loop) or out in a strike
      const flick = strike > 0.2 || Math.max(0, Math.sin(time * Math.PI * 2 + (e.seed || 0))) > 0.72;
      if (flick) { g.strokeStyle = S.tongue; g.lineWidth = 0.55; g.lineCap = 'round'; g.beginPath(); g.moveTo(2.4, 0); g.lineTo(5.2, 0); g.lineTo(6.4, -0.8); g.moveTo(5.2, 0); g.lineTo(6.4, 0.8); g.stroke(); }
      ell(g, 0.6, 0, S.head * 1.25, S.head); g.fillStyle = OUT; g.fill();
      ell(g, 0.6, 0, S.head * 1.25 - 0.6, S.head - 0.6); g.fillStyle = rfill(g, S.c, 0.6, 0, S.head); g.fill();
      if (S.zig) { g.fillStyle = S.zig; g.beginPath(); g.moveTo(-0.8, -0.9); g.lineTo(0.8, 0); g.lineTo(-0.8, 0.9); g.lineTo(-0.2, 0); g.closePath(); g.fill(); }
      for (const s of [-1, 1]) { ell(g, 1.3, s * (S.head * 0.55), 0.6, 0.5); g.fillStyle = S.eye; g.fill(); ell(g, 1.4, s * (S.head * 0.55), 0.18, 0.4); g.fillStyle = '#0d0d10'; g.fill(); }
      g.restore();
    }, { x: 0.6, y: 1.8 });
  }
  const drawSnake = (g, e) => drawSnakeBody(g, e, Object.assign({ len: 24, w: 3.8, head: 2.3 }, GRASS_SNAKE));
  const drawAdder = (g, e) => drawSnakeBody(g, e, Object.assign({ len: 26, w: 4.4, head: 2.7 }, ADDER));

  // ---------- the wild dog ----------
  const DOG = { c: '#9a7652', belly: '#dcc8a2', dark: '#5a4330', patch: '#6e5236', nose: '#1d1612' };
  function dogTail(g, x, y, e) {
    const wag = Math.sin(time * Math.PI * 4 + (e.seed || 0)) * 0.25 + (e.moving ? Math.sin(e.walkT * 2) * 0.15 : 0);
    g.save(); g.translate(x, y); g.rotate(-1.1 + wag);
    g.beginPath(); g.moveTo(0, -1.2); g.quadraticCurveTo(-5, -2.4, -7.6, 1.6); g.quadraticCurveTo(-7.2, 3.4, -5.6, 2.4); g.quadraticCurveTo(-3.4, 0.6, 0, 1.4); g.closePath();
    g.fillStyle = vfill(g, DOG.c, -2, 3); g.fill(); outline(g, 0.6);
    g.fillStyle = DOG.belly; ell(g, -6.8, 1.8, 1.2, 0.9); g.fill();
    g.restore();
  }
  function dogSide(g, e, sw, bob) {
    dogTail(g, -9.6, -3 + bob, e);
    quadLegs(g, e, { xs: [-6.2, 4.4], y: 2.6 + bob, len: 7, w: 2.3, c: DOG.c, foot: DOG.dark, k: 0.55 });
    g.translate(0, bob);
    g.beginPath(); g.moveTo(-10.6, -1); g.quadraticCurveTo(-10, -5.8, -3, -5.6); g.quadraticCurveTo(4, -6, 8.4, -2.4); g.quadraticCurveTo(9, 2.6, 5, 3.8); g.quadraticCurveTo(-3, 5, -9, 3.4); g.quadraticCurveTo(-11.2, 1.8, -10.6, -1); g.closePath();
    g.fillStyle = vfill(g, DOG.c, -6, 5, 0.18, -0.25); g.fill(); outline(g, 0.8);
    // a dark saddle patch, a pale belly, a scruffy back
    g.save(); g.clip(); g.fillStyle = DOG.patch; ell(g, -3.4, -4.4, 4.6, 2.6, -0.1); g.fill(); g.restore();
    g.beginPath(); g.moveTo(-8, 3.2); g.quadraticCurveTo(-1, 5, 4.6, 3.4); g.quadraticCurveTo(0, 2.2, -8, 3.2); g.fillStyle = DOG.belly; g.fill();
    g.fillStyle = DOG.c; for (const x of [-8.4, -6, -1, 2]) { g.beginPath(); g.moveTo(x, -5.2); g.lineTo(x + 0.8, -6.8); g.lineTo(x + 1.6, -5.2); g.closePath(); g.fill(); }
    // the head
    const jaw = sw >= 0 ? Math.sin(sw * Math.PI) * 0.5 : 0;
    g.save(); g.translate(7.2, -4.2); g.rotate(sw >= 0 ? 0.15 : Math.sin(time * Math.PI) * 0.05);
    ell(g, 1.8, 0, 4.8, 4.1); g.fillStyle = rfill(g, DOG.c, 1.8, 0, 4.6); g.fill(); outline(g, 0.7);
    g.fillStyle = DOG.belly; ell(g, 2.6, 2.2, 3.2, 1.6); g.fill();
    // one ear up, one flopped over
    g.beginPath(); g.moveTo(-1.2, -2.6); g.lineTo(-0.2, -7.6); g.lineTo(1.4, -2.8); g.closePath(); g.fillStyle = DOG.patch; g.fill(); outline(g, 0.5);
    g.beginPath(); g.moveTo(1.6, -3.2); g.quadraticCurveTo(3.6, -6.6, 4.8, -3.6); g.quadraticCurveTo(4.6, -1.6, 3.6, -1.2); g.closePath(); g.fillStyle = DOG.c; g.fill(); outline(g, 0.5);
    // the muzzle, shorter than a wolf's
    g.save(); g.rotate(jaw * 0.35);
    g.beginPath(); g.moveTo(4.6, -1.4); g.lineTo(9.6, -0.4); g.quadraticCurveTo(10.2, 1.4, 8.6, 1.8); g.lineTo(4.6, 2.2); g.closePath(); g.fillStyle = vfill(g, DOG.c, -1.4, 2.2); g.fill(); outline(g, 0.6);
    ell(g, 9.6, 0.1, 1.15, 0.95); g.fillStyle = DOG.nose; g.fill();
    g.restore();
    if (jaw > 0.05) { g.save(); g.rotate(jaw * 0.7); g.beginPath(); g.moveTo(4.8, 2.2); g.lineTo(9, 2.8); g.lineTo(5.2, 4); g.closePath(); g.fillStyle = '#b84a4a'; g.fill(); g.fillStyle = '#ffffff'; for (const x of [6, 7.6]) { g.beginPath(); g.moveTo(x, 2.3); g.lineTo(x + 0.5, 3.4); g.lineTo(x + 1, 2.4); g.closePath(); g.fill(); } g.restore(); }
    ell(g, 3.8, -1, 1.15, 0.95); g.fillStyle = '#e8b04a'; g.fill(); ell(g, 4.05, -1, 0.5, 0.65); g.fillStyle = '#140e0a'; g.fill();
    g.restore();
    snap(g, 18.4, -2.6, sw);
  }
  function dogFront(g, e, sw) {
    quadLegs(g, e, { xs: [-3.4, 1.8], y: 3, len: 6.6, w: 2.3, c: DOG.c, foot: DOG.dark, k: 0.25 });
    ell(g, 0, 1, 8, 6); g.fillStyle = vfill(g, DOG.c, -5, 7); g.fill(); outline(g, 0.8);
    g.fillStyle = DOG.belly; g.beginPath(); g.moveTo(-3.6, -1); g.quadraticCurveTo(0, 6.4, 3.6, -1); g.quadraticCurveTo(0, 1, -3.6, -1); g.fill();
    const hy = -5.2; ell(g, 0, hy, 5.8, 5); g.fillStyle = rfill(g, DOG.c, 0, hy, 5.6); g.fill(); outline(g, 0.8);
    // the up ear and the flopped one
    g.beginPath(); g.moveTo(-2.2, hy - 3.4); g.lineTo(-4.8, hy - 8.6); g.lineTo(-5.6, hy - 2.4); g.closePath(); g.fillStyle = DOG.patch; g.fill(); outline(g, 0.5);
    g.beginPath(); g.moveTo(2.2, hy - 3.6); g.quadraticCurveTo(6.4, hy - 6.4, 6.6, hy - 1.4); g.quadraticCurveTo(5, hy - 1, 4, hy - 2); g.closePath(); g.fillStyle = DOG.c; g.fill(); outline(g, 0.5);
    g.fillStyle = DOG.belly; ell(g, 0, hy + 2.4, 3.4, 2.8); g.fill(); outline(g, 0.5);
    ell(g, 0, hy + 1.4, 1.4, 1.05); g.fillStyle = DOG.nose; g.fill();
    for (const s of [-1, 1]) { ell(g, s * 2.4, hy - 1.4, 1.1, 0.95); g.fillStyle = '#e8b04a'; g.fill(); ell(g, s * 2.4, hy - 1.4, 0.5, 0.7); g.fillStyle = '#140e0a'; g.fill(); }
    if (sw >= 0) { g.fillStyle = '#7a2a2a'; ell(g, 0, hy + 4.2, 1.8, 1 + Math.sin(sw * Math.PI)); g.fill(); g.fillStyle = '#fff'; g.fillRect(-1.3, hy + 3.4, 0.8, 1); g.fillRect(0.5, hy + 3.4, 0.8, 1); }
  }
  function dogRear(g, e) {
    quadLegs(g, e, { xs: [-3.4, 1.8], y: 3, len: 6.6, w: 2.3, c: DOG.c, foot: DOG.dark, k: 0.25 });
    ell(g, 0, 0.6, 7.8, 6.2); g.fillStyle = vfill(g, DOG.c, -6, 7); g.fill(); outline(g, 0.8);
    g.save(); ell(g, 0, 0.6, 7.8, 6.2); g.clip(); g.fillStyle = DOG.patch; ell(g, 0, -3.6, 5, 2.6); g.fill(); g.restore();
    // the tail curled up over its back, wagging
    const t = Math.sin(time * Math.PI * 4 + (e.seed || 0)) * 1.4;
    g.beginPath(); g.moveTo(-1.4, -1); g.quadraticCurveTo(t - 3, -7, t + 0.6, -8.6); g.quadraticCurveTo(t + 2.6, -6.4, 1.4, -1); g.closePath(); g.fillStyle = vfill(g, DOG.c, -9, -1); g.fill(); outline(g, 0.6);
    ell(g, 0, -6.2, 4.6, 3.8); g.fillStyle = DOG.c; g.fill(); outline(g, 0.6);
    g.beginPath(); g.moveTo(-1.6, -8.4); g.lineTo(-4.2, -13); g.lineTo(-4.8, -7); g.closePath(); g.fillStyle = DOG.patch; g.fill(); outline(g, 0.5);
    g.beginPath(); g.moveTo(1.6, -8.6); g.quadraticCurveTo(5.4, -10.6, 5.6, -6.4); g.lineTo(3.8, -6.4); g.closePath(); g.fillStyle = DOG.c; g.fill(); outline(g, 0.5);
  }
  function drawDog(g, e) { drawQuad(g, e, { ground: 9.6, sh: 10.5, side: dogSide, front: dogFront, rear: dogRear, lunge: 4 }); }

  // ---------- into the look (MONSTER_LOOK.addType) ----------
  // boxes: [x0, y0, x1, y1] at rest, then with a bite, in game pixels round the middle (measure.cjs, 3 px all round)
  const LOOKS = {
    crow: { draw: drawCrow, size: 1.25, r: 10, pic: true, top: true, box: [-21, -30, 24, 25, -21, -30, 24, 25] },
    giant_rat: { draw: drawRat, size: 1.3, r: 12, pic: true, box: [-34, -16, 34, 23, -34, -16, 34, 23] },
    snake: { draw: drawSnake, size: 1.3, r: 11, pic: true, top: true, box: [-28, -28, 28, 28, -33, -33, 33, 33] },
    adder: { draw: drawAdder, size: 1.3, r: 12, pic: true, top: true, box: [-29, -29, 29, 29, -35, -35, 35, 35] },
    wild_dog: { draw: drawDog, size: 1.15, r: 13, pic: true, box: [-24, -20, 24, 19, -33, -20, 33, 19] },
  };
  if (window.MONSTER_LOOK && MONSTER_LOOK.addType) for (const t in LOOKS) MONSTER_LOOK.addType(t, LOOKS[t]);
  window.CRITTER_LOOKS = LOOKS;

  // ---------- a falling body's legs (79-deaths): a bird shows two, a snake none ----------
  if (window.DEATHS && DEATHS.LEGS) {
    DEATHS.LEGS.crow = { n: 2, col: '#3e3c3a', w: 0.07 };
    DEATHS.LEGS.snake = { n: 0 }; DEATHS.LEGS.adder = { n: 0 };
    DEATHS.LEGS.giant_rat = { n: 4, col: '#c98a88' };
  }

  // ---------- the icons (80-icons' rules: inside -9..+9, nothing under 2 units across, never branch on size) ----------
  if (window.ICONS && ICONS.set) {
    const dk = a => 'rgba(0,0,0,' + a + ')';
    const line = (g, col, w, cap) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = cap || 'butt'; };
    ICONS.set('crow_feather', (g, size, item) => {                     // a long black flight feather, curved, with a blue sheen down its vane
      g.save(); g.rotate(-0.85);
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-8.6, 0.4); g.quadraticCurveTo(-2, -4.4, 8.6, -1.6); g.quadraticCurveTo(2, 3.4, -8.6, 0.4); g.closePath(); g.fill(); line(g, 'rgba(0,0,0,0.55)', 1.1); g.stroke();
      g.fillStyle = 'rgba(110,130,200,0.5)'; g.beginPath(); g.moveTo(-5, -0.8); g.quadraticCurveTo(0, -3.4, 7, -1.8); g.quadraticCurveTo(0, -1.4, -5, -0.2); g.closePath(); g.fill();
      line(g, dk(0.4), 1);                                                                                   // the barbs, slanting back
      for (let k = 0; k < 4; k++) { const x = -4 + k * 3; g.beginPath(); g.moveTo(x, -0.2); g.lineTo(x + 1.6, -2.6 + k * 0.3); g.stroke(); }
      line(g, '#c8ccd8', 1.2, 'round');                                                                     // the quill
      g.beginPath(); g.moveTo(-9.4, 1.2); g.quadraticCurveTo(-1, -0.6, 8.2, -1.4); g.stroke();
      g.restore();
    });
    ICONS.set('snakeskin', (g, size, item) => {                         // a shed skin in a loose coil, papery, scaled in diamonds
      g.lineCap = 'round'; g.lineJoin = 'round';
      const path = () => { g.beginPath(); g.moveTo(-6.4, 5.2); g.bezierCurveTo(-7.2, -1.6, -1.6, -6.8, 3.4, -5.2); g.bezierCurveTo(7.4, -3.8, 6.8, 2.8, 2.4, 3.4); g.bezierCurveTo(-1.2, 3.8, -2, -1, 1.2, -1.6); };
      line(g, 'rgba(0,0,0,0.5)', 4.4); path(); g.stroke();
      line(g, item.color, 3); path(); g.stroke();
      line(g, 'rgba(255,255,240,0.55)', 1); path(); g.stroke();
      line(g, dk(0.32), 1);                                                                                  // the scales' crossing lines
      for (const [x, y] of [[-5.8, 1.6], [-4.8, -2.6], [-1.8, -5.2], [2.2, -5.2], [5.4, -2.8], [5.2, 1.4], [1.8, 3.4]]) { g.beginPath(); g.moveTo(x - 1, y - 1); g.lineTo(x + 1, y + 1); g.moveTo(x - 1, y + 1); g.lineTo(x + 1, y - 1); g.stroke(); }
      g.fillStyle = item.color; g.beginPath(); g.arc(1.4, -1.6, 1.5, 0, 7); g.fill(); line(g, 'rgba(0,0,0,0.5)', 1); g.stroke();   // the empty head end
    });
  }

  // ---------- the book (44-wiki): plain words for each creature ----------
  if (window.WIKI && WIKI.add) {
    // [name, words] (87-critters' MONSTER_DEFS names: this file loads first, and the self-test holds the two the same)
    const BLURB = {
      crow: ['Crow', "Crows peck about the meadow by the old signpost. A crow grabs anything shiny, so one sometimes drops a coin it stole. Leave it be and it leaves you be."],
      giant_rat: ['Giant rat', "A rat as big as a cat, up out of the cave and into the grass. It nibbles everything: bread, seeds, even coins. It only bites back if you hit it first."],
      snake: ['Snake', "A grass snake that lives in the reeds round Miller's Pond. Hit it and it bites. It sheds a fine skin that shops will buy."],
      adder: ['Adder', "An adder: grey-brown, with a black zigzag down its back and a red eye. Tougher than a grass snake, and its bite hurts more. It always leaves its skin behind."],
      wild_dog: ['Wild dog', "Wild dogs hunt in packs of three, out in the fields away from the road. Come within four steps and the whole pack runs at you. Keep to the road, or come back when you are stronger."],
    };
    for (const id in BLURB) WIKI.add('monsters', { id, name: BLURB[id][0], blurb: BLURB[id][1] });
  }

  // ---------- self-test ----------
  HOOKS.selfTest.push((check) => {
    const types = Object.keys(LOOKS);
    // the book: each creature's page under its own name (the same as 87-critters' MONSTER_DEFS), with its words, where it lives and what it drops
    if (window.WIKI && WIKI.get) {
      const bad = types.filter(t => { const e = WIKI.get('monsters', t); return !e || !MONSTER_DEFS[t] || e.name !== MONSTER_DEFS[t].name || !e.blurb || !(e.where || []).length || !(e.drops || []).length; });
      check('critter look: the book has a page for each creature under its own name, with its words, where it lives and what it drops', !bad.length, { bad }); }
    // the look: each drawn in the new hand (addType), its hit circle the rules' r, and the icons of what they leave drawn
    { const L = window.MONSTER_LOOK, bad = types.filter(t => !L || !L.ADDED.has(t) || L.HIT_R[t] !== MONSTER_DEFS[t].r || !L.BOX[t]);
      const icons = ['crow_feather', 'snakeskin'].filter(id => !(window.ICONS && ICONS.audit && ITEMS[id]));
      const legs = window.DEATHS && DEATHS.LEGS ? [DEATHS.LEGS.crow && DEATHS.LEGS.crow.n === 2, DEATHS.LEGS.snake && DEATHS.LEGS.snake.n === 0, DEATHS.LEGS.adder && DEATHS.LEGS.adder.n === 0] : [false];
      check('critter look: the five creatures are drawn through MONSTER_LOOK.addType with their rules\' hit circles, the feather and the skin have their items, and a falling crow shows two legs and a snake none', !bad.length && !icons.length && legs.every(Boolean), { bad, icons, legs }); }
  });
}
