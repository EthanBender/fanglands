// ============================================================================
// TOWNSFOLK ART — every follower and non-fighting townsperson in the owner-approved new look (the townsfolk sample,
// 2026-10-03, "everything has been approved"), drawn in the style of the approved knight (82-knightgear) and the
// monsters (78-monsterart). This file is the sample's drawing code PORTED, NOT REDESIGNED: npc-base.js (the shared
// civilian base: builds, faces, hair, beards, hats, clothes, cloaks, wings, held things, npc(spec), npcFromToday) and the
// seven family files (reference, then death, dwarves-elves, goblins-afterlands, hollowford, sky, thistledown), byte for
// byte inside one closure. The sample lives in ~/.fanglands/work/npc-sample and this file is regenerated from it by
// ~/.fanglands/work/townsfolk/gen/make-art.py. Never edit this file by hand: change the sample (or the generator's
// patches) and run the generator again.
// The changes from the sample, all mechanical:
//   1. the review page's own clock (`let time = 0`) is gone, so the drawings read the game's `time`;
//   2. every comment that trailed code now sits on its own line (the house rule);
//   3. e.seated (Harl at the oars) draws no ground shadow and no legs; e.air (Wick and the fliers, Lark in the air, a
//      statue on its plinth) draws no ground shadow;
//   4. e.unarmed (Sera locked in the goblin cage, her bow hidden in the straw; Harl rowing) leaves the main hand empty;
//   5. while e.attackT > 0 (a follower's shot or swing, 0.22 counting down, as 21-companion sets it) the main hand and
//      what it holds swing in the knight's style (npc_swing, below: round the shoulder with a swoosh, a spear jabs, a
//      bow comes up level and draws), and facing away all of it stays behind the body;
//   6. e.flapK beats the wings faster (the larger of it and a person's own rate): Lark and the fliers in the air;
//   7. addPeople keeps each person's spec (NPC_SPEC, for the portraits), and two marks (NPC_MARK) let the self-test
//      see where the body and the held thing are drawn. Neither changes a single pixel.
//   8. seated and unarmed together (Harl at the oars, his hands on the oar the boat draws) also leave the other hand
//      empty: his lantern is set down while he rows.
// The owner's standing decisions are in the drawings: no arms, a hand floats beside the shoulder; held things rest
// upright with the hand at the waist (a staff or spear stands beside them, a bow hangs at the side, a basket or tool at
// the waist); facing us or side-on what they hold is in front, facing away it is behind; robes and cloaks slim and open
// at the front; rich specific detail; a soft dark outline; legs that step, cloth that sways.
// What a drawing reads from `e`: facing {x, y} (a unit vector), moving, walkT (the step's clock), talking, talkT (seconds
// into the line), seed, attackT, plus seated, air, unarmed and flapK above. The feet's centre is at 0, 0.
// Nothing here runs at load beyond defining the drawings and registering the people: TOWNSFOLK_ART = { NEW_NPC,
// NPC_FAMILY, NPC_SPEC, NPC_NAMES, npc, drawPerson, npcFromToday, BUILDS, SKIN, HAIR, H, mark }. NEW_NPC[id](g, e) draws
// one person; 83-townsfolk.js is the glue that decides who is drawn with it, where and how cheaply.
// ============================================================================
const TOWNSFOLK_ART = (() => {
  // the self-test's marks (null in the game): NPC_MARK(g, 'body' | 'held', C) as each is drawn
  let NPC_MARK = null;
  const NPC_SPEC = {};
  // ---------- npc-base.js ----------
  // ================= FANGLANDS TOWNSFOLK: the shared civilian base =================
  // Every follower and townsperson is drawn from these pieces, in the approved knight's style (src/82-knightgear.js) and
  // the monster sample's people (mob-sample groups/people.js): a soft dark outline, light from the top left, legs that step,
  // no arms (a hand floats beside the body), anything held rests upright with the hand at the waist, in front facing us or
  // side-on and behind the body facing away; robes and cloaks are slim and open at the front; cloth sways.
  //
  // A person is a SPEC (plain data plus a few special pieces); npc(spec) turns it into a draw function (g, e).
  // e = { facing: {x, y}, moving, walkT, talking, talkT, seed }; the person's feet-centre is at 0, 0 (the game's e.x, e.y).

  // ---------- core helpers (the knight sample's, same names as mob-sample mobs-new.js so goblin parts paste across) ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const OUT = 'rgba(22,14,8,0.62)';
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  // shade() as a hex string, for the helpers that take a hex colour
  function hex(c, f) { const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(shade(c, f || 0)); return '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join(''); }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2); }
  function outline(g, w) { g.strokeStyle = OUT; g.lineWidth = w || 0.8; g.stroke(); }
  function vfill(g, c, y0, y1, hi, lo) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, shade(c, hi === undefined ? 0.3 : hi)); gr.addColorStop(0.55, c); gr.addColorStop(1, shade(c, lo === undefined ? -0.3 : lo)); return gr; }
  function rfill(g, c, x, y, r) { const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1); gr.addColorStop(0, shade(c, 0.35)); gr.addColorStop(0.6, c); gr.addColorStop(1, shade(c, -0.35)); return gr; }
  const metal = (g, c, y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, shade(c, 0.42)); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, -0.32)); return gr; };
  function sparkle(g, x, y, s, col) { if (s <= 0) return; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.28, y - s * 0.28); g.lineTo(x + s, y); g.lineTo(x + s * 0.28, y + s * 0.28); g.lineTo(x, y + s); g.lineTo(x - s * 0.28, y + s * 0.28); g.lineTo(x - s, y); g.lineTo(x - s * 0.28, y - s * 0.28); g.closePath(); g.fill(); }
  function shadow(g, x, y, rx, ry, a) { g.fillStyle = `rgba(0,0,0,${a || 0.3})`; ell(g, x, y, rx, ry); g.fill(); }
  function gem(g, x, y, r, c, glow) {
    if (glow) { const gl = g.createRadialGradient(x, y, 0, x, y, r * 2.8); gl.addColorStop(0, glow); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; ell(g, x, y, r * 2.8, r * 2.8); g.fill(); }
    g.fillStyle = c; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.8, y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,20,10,0.6)'; g.lineWidth = 0.35; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)'; ell(g, x - r * 0.2, y - r * 0.35, r * 0.26, r * 0.26); g.fill();
  }
  function rivets(g, pts, c, r) { g.fillStyle = c; for (const [x, y] of pts) { ell(g, x, y, r || 0.5, r || 0.5); g.fill(); } }
  const face4 = e => { const fx = e.facing.x, fy = e.facing.y; if (fy < -0.55) return 'up'; if (fy > 0.55) return 'down'; return fx < 0 ? 'left' : 'right'; };
  const stepOf = e => e.moving ? Math.sin(e.walkT) : 0;
  const bobOf = (e, k) => e.moving ? -Math.abs(Math.sin(e.walkT)) * (k || 1.3) : Math.sin(time * 2.2 + (e.seed || 0)) * 0.3;
  const GOLD = '#e0b546';

  // ---------- the palettes ----------
  const SKIN = { fair: '#f2d6bf', light: '#e8b790', warm: '#e0ac86', tan: '#c98e62', brown: '#9a6440', deep: '#6e4528', elf: '#f0d0b0', sky: '#f0d8c0', ruddy: '#e8b08a', goblin: '#74bd46' };
  const HAIR = { black: '#2a1a0a', brown: '#5a3a1e', chestnut: '#7a3a1a', auburn: '#9a4a24', ginger: '#c9843a', blond: '#e0c080', flax: '#e8d9a0', grey: '#9a948a', white: '#e6e2da', silver: '#d9d0c0' };

  // ---------- the builds: where everything sits, in game pixels before the size ----------
  // sh: shoulder line, w: half-width at the shoulders, hy/hr: head centre and radius, hip: top of the legs, leg: leg length,
  // gap: half the distance between the legs, hem: a tunic's hem, waist: the belt, hand: where the hands rest at the waist,
  // shY/shR: the shadow, s: overall size against the knight (1 = the knight's own size)
  const BUILDS = {
    adult:  { s: 1.0,  sh: -4.2, w: 8.0, hy: -10.2, hr: 7.4, hip: 6.2, leg: 6.6, gap: 3.6, hem: 8.8, waist: 4.6, hand: { x: 10.2, y: 4.8 }, shY: 13, shR: 9.6, bobK: 1.3, lw: 5.0 },
    child:  { s: 0.74, sh: -3.6, w: 7.4, hy: -10.6, hr: 8.2, hip: 5.6, leg: 5.6, gap: 3.4, hem: 7.8, waist: 4.0, hand: { x: 9.6, y: 4.2 }, shY: 12, shR: 9.0, bobK: 1.8, lw: 4.8 },
    dwarf:  { s: 0.96, sh: -1.6, w: 10.0, hy: -5.4, hr: 7.4, hip: 7.6, leg: 4.6, gap: 4.4, hem: 9.6, waist: 4.8, hand: { x: 12.0, y: 5.4 }, shY: 13, shR: 11.2, bobK: 1.0, lw: 5.8 },
    elf:    { s: 1.04, sh: -4.8, w: 6.8, hy: -11.4, hr: 7.0, hip: 6.4, leg: 7.6, gap: 3.2, hem: 9.4, waist: 4.4, hand: { x: 9.8, y: 5.0 }, shY: 14, shR: 8.6, bobK: 1.2, lw: 4.4 },
    goblin: { s: 0.92, sh: -3.5, w: 7.2, hy: -10.5, hr: 7.6, hip: 5.6, leg: 5.4, gap: 3.6, hem: 8.2, waist: 4.4, hand: { x: 10.0, y: 4.4 }, shY: 12, shR: 9.4, bobK: 1.3, lw: 4.8 },
  };

  // ---------- the person ----------
  // spec = {
  //   build: 'adult' | 'child' | 'dwarf' | 'elf' | 'goblin', size: 1, geo: { ...BUILDS overrides }, lift (float off the ground), alpha,
  //   skin, ears: 'round' | 'elf' | 'goblin' | 'none',
  //   face: { eye, eyes: 'round' | 'big' | 'sleepy' | 'narrow' | 'happy', brow, browW, browTilt, lash, age: 'child' | 'adult' | 'elder',
  //           lines, blush, freckles, mouth: 'smile' | 'flat' | 'grin' | 'frown' | 'o', lip, nose: 'button' | 'big' | 'long' | false, scar },
  //   hair: { style: 'short' | 'long' | 'bun' | 'braids' | 'ponytail' | 'bald' | 'curly' | 'crop' | 'tied', c, tie },
  //   beard: { style: 'stubble' | 'short' | 'full' | 'long' | 'forked' | 'moustache' | 'braided', c, len },
  //   hat: { kind: 'hood' | 'cap' | 'straw' | 'chef' | 'kerchief' | 'crown' | 'circlet' | 'helmet' | 'goggles' | 'wool' | 'coif', c, ... },
  //   body: { kind: 'tunic' | 'dress' | 'coat' | 'robe', c, under, trim, belt, buckle, collar, sleeves, len, pouch },
  //   legs: { c, boot, cuff, bare, skirt },
  //   over: [ { kind: 'apron' | 'leather' | 'tabard' | 'sash' | 'shawl' | 'chain' | 'vest', ... } ],
  //   cloak: { c, lining, clasp, hood: 'down' | 'up' | false, len, trim },
  //   held: { kind, ...opts } in the main hand at the waist; off: { kind, ...opts } in the other hand, or nothing,
  //   hand: the hand's colour (skin by default; a glove), wings: { scale, tone, edge },
  //   special pieces, each (g, C): behind (before everything facing us), back (over the body facing away), torso (over the
  //   clothes), collar (over the shoulders, under the head), head (over the head), top (last on the body), after (last of all)
  // }
  // C = { e, P, B, f, back, side, mirror, fx, fy, step, bob, talk, tt, seed } is handed to every piece.
  function npc(P) { return (g, e) => drawPerson(g, e, P); }
  function drawPerson(g, e, P) {
    const B = Object.assign({}, BUILDS[P.build || 'adult'], P.geo || {});
    const f = face4(e), back = f === 'up', mirror = f === 'left', side = f === 'left' || f === 'right';
    const fx = mirror ? -e.facing.x : e.facing.x, fy = e.facing.y;
    const step = stepOf(e), bob = bobOf(e, B.bobK), talk = e.talking ? 1 : 0, tt = e.talkT || 0;
    const s = B.s * (P.size || 1);
    const C = { e, P, B, f, back, side, mirror, fx, fy, step, bob, talk, tt, seed: e.seed || 0 };
    g.save(); if (!e.seated && !e.air) shadow(g, 0, B.shY * s, B.shR * s, B.shR * 0.4 * s);
    if (P.lift) g.translate(0, -P.lift - (P.alpha ? Math.sin(time * 2 + C.seed) * 1.2 : 0));
    if (P.alpha) g.globalAlpha *= P.alpha;
    g.scale(mirror ? -s : s, s);
    if (back) { offHand(g, C); mainHand(g, C); }
    else {
      if (P.wings) npc_wings(g, C, P.wings);
      if (P.cloak) npc_cloakBack(g, C, P.cloak);
      if (P.hair && P.hair.style === 'long' && !back) npc_hairFall(g, C, P.hair, false);
      if (P.behind) P.behind(g, C);
    }
    if (!e.seated) npc_legs(g, C, P.legs || {});
    g.translate(0, bob);
    if (NPC_MARK) NPC_MARK(g, 'body', C);
    npc_body(g, C, P.body || { kind: 'tunic', c: '#6a6a4a' });
    for (const o of P.over || []) npc_over(g, C, o);
    if (P.torso) P.torso(g, C);
    if (back) {
      if (P.cloak) npc_cloakBack(g, C, P.cloak);
      if (P.hair && (P.hair.style === 'long' || P.hair.style === 'braids' || P.hair.style === 'ponytail')) npc_hairFall(g, C, P.hair, true);
      if (P.wings) npc_wings(g, C, P.wings);
      if (P.back) P.back(g, C);
    } else if (P.cloak) npc_cloakFront(g, C, P.cloak);
    npc_shoulders(g, C);
    if (P.collar) P.collar(g, C);
    if (!back) offHand(g, C);
    // the head nods while they talk
    const nod = talk ? Math.sin(tt * 5.2) * 0.45 : 0;
    g.translate(0, nod); npc_head(g, C); if (P.head) P.head(g, C); g.translate(0, -nod);
    if (P.top) P.top(g, C);
    g.translate(0, -bob);
    if (!back) mainHand(g, C);
    if (P.after) P.after(g, C);
    g.restore();
  }
  const handCol = C => C.P.hand || C.P.skin || SKIN.light;
  function floatHand(g, x, y, c) { ell(g, x, y, 2.05, 2.05); g.fillStyle = rfill(g, c, x, y, 2.05); g.fill(); outline(g, 0.5); }
  // the main hand: at the waist, holding what they hold upright; it steps with them
  function mainHand(g, C) {
    const P = C.P, B = C.B, hx = B.hand.x, hy = B.hand.y + C.step * 0.5 + C.bob;
    if (C.e.unarmed) { floatHand(g, hx, hy, handCol(C)); return; }
    if (P.held && NPC_MARK) NPC_MARK(g, 'held', C);
    if (P.held && C.e.attackT > 0) { npc_swing(g, C); return; }
    if (P.held) { g.save(); g.translate(hx, hy); g.rotate(C.step * 0.04); npc_prop(g, C, P.held, 'main'); g.restore(); }
    floatHand(g, hx, hy, handCol(C));
    if (P.held && PROP_OVER[P.held.kind]) { g.save(); g.translate(hx, hy); g.rotate(C.step * 0.04); PROP_OVER[P.held.kind](g, C, P.held); g.restore(); }
  }
  // the other hand: beside the hip, swinging a little as they walk; while they talk it comes up and turns, as people do
  function offHand(g, C) {
    const P = C.P, B = C.B, k = C.talk ? Math.min(1, C.tt * 3) : 0;
    const wave = C.talk ? Math.sin(C.tt * 6.3) : 0;
    const x = lerp(-B.hand.x, -B.hand.x + 2.6, k) + wave * 0.9 * k, y = lerp(B.hand.y - 1.4 - C.step * 1.4, B.sh + 3.4, k) + Math.abs(wave) * -0.8 * k + C.bob;
    const offHeld = P.off && !(C.e.seated && C.e.unarmed);
    if (offHeld) { g.save(); g.translate(x, y); npc_prop(g, C, P.off, 'off'); g.restore(); }
    floatHand(g, x, y, handCol(C));
    if (offHeld && PROP_OVER[P.off.kind]) { g.save(); g.translate(x, y); PROP_OVER[P.off.kind](g, C, P.off); g.restore(); }
  }

  // ---------- legs: trousers or stockings, boots that step; a long skirt hides all but the boots ----------
  function npc_legs(g, C, L) {
    const B = C.B, long = C.P.body && (C.P.body.kind === 'dress' || C.P.body.kind === 'robe' || (C.P.body.len || 0) > 2.5);
    const c = L.c || '#4a4036', boot = L.boot || '#3a2a1c', w = L.w || B.lw;
    for (const s of [-1, 1]) {
      const off = C.step * 1.8 * s, x = s * B.gap, y = B.hip + off, len = B.leg;
      if (!long) {
        rr(g, x - w / 2, y - 2, w, len, Math.min(1.9, w / 2)); g.fillStyle = L.bare ? vfill(g, L.bare, y - 2, y + len) : vfill(g, c, y - 2, y + len - 2, 0.2, -0.3); g.fill(); outline(g, 0.6);
        if (!L.bare) { g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.4; g.beginPath(); g.moveTo(x + s * 0.7, y - 1.4); g.lineTo(x + s * 0.5, y + len - 3); g.stroke(); }
        if (L.patch && s > 0) { rr(g, x - 1.4, y + 0.4, 2.8, 2.4, 0.5); g.fillStyle = L.patch; g.fill(); g.strokeStyle = 'rgba(40,24,10,0.6)'; g.lineWidth = 0.3; g.setLineDash([0.5, 0.5]); g.stroke(); g.setLineDash([]); }
      }
      const by = y + len - 2.6, bw = w + 0.9;
      if (L.feet) { ell(g, x, by + 1.8, bw / 2 + 0.3, 1.7); g.fillStyle = L.feet; g.fill(); outline(g, 0.5); g.fillStyle = shade(L.feet, -0.3); for (const t of [-1.4, -0.2, 1]) { ell(g, x + t, by + 2.9, 0.5, 0.4); g.fill(); } continue; }
      rr(g, x - bw / 2, by, bw, 3.4, 1.5); g.fillStyle = vfill(g, boot, by, by + 3.4, 0.28, -0.32); g.fill(); outline(g, 0.6);
      if (L.cuff) { g.fillStyle = L.cuff; rr(g, x - bw / 2 - 0.1, by - 0.2, bw + 0.2, 1.1, 0.5); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x - bw / 2 + 0.8, by + 0.5, bw * 0.4, 0.5);
    }
  }

  // ---------- the body: tunic, dress, coat or robe ----------
  // a body outline: shoulders at y0, a little wider at the ribs, out to `low` at y1
  function bodyPath(g, w, bulge, low, y0, y1) { g.beginPath(); g.moveTo(-w, y0); g.quadraticCurveTo(-bulge, (y0 + y1) / 2 - 0.6, -low, y1); g.lineTo(low, y1); g.quadraticCurveTo(bulge, (y0 + y1) / 2 - 0.6, w, y0); g.quadraticCurveTo(0, y0 - 2.3, -w, y0); g.closePath(); }
  // a hem that sways: from (-x0, y) to (x0, y) with soft folds
  function swayHem(g, x0, x1, y, n, sway, deep) { for (let k = 1; k <= n; k++) { const t = k / n, x = lerp(x0, x1, t) + sway * Math.sin(t * Math.PI), xm = lerp(x0, x1, t - 0.5 / n) + sway * Math.sin((t - 0.5 / n) * Math.PI); g.quadraticCurveTo(xm, y + deep, x, y); } }
  function npc_body(g, C, Bd) {
    const B = C.B, c = Bd.c, w = B.w, y0 = B.sh, back = C.back, sway = C.step * 0.9 + Math.sin(time * 2 + C.seed) * 0.25;
    const kind = Bd.kind || 'tunic';
    if (kind === 'dress' || kind === 'robe') {
      // a long body: fitted to the waist, then a skirt that flares and swings with the step (a robe stays slim)
      const hem = B.hip + B.leg - (kind === 'robe' ? 1.0 : 1.6) + (Bd.len || 0), flare = kind === 'robe' ? w + 0.6 : w + 2.6, wst = B.waist;
      const path = () => {
        g.beginPath(); g.moveTo(-w + 0.6, y0); g.quadraticCurveTo(-w - 0.6, (y0 + wst) / 2, -w + 1.4, wst);
        g.quadraticCurveTo(-w - 0.2, (wst + hem) / 2, -flare + sway * 0.5, hem);
        swayHem(g, -flare + sway * 0.5, flare + sway * 0.5, hem, 5, sway * 0.3, 1.2);
        g.quadraticCurveTo(w + 0.2, (wst + hem) / 2, w - 1.4, wst); g.quadraticCurveTo(w + 0.6, (y0 + wst) / 2, w - 0.6, y0);
        g.quadraticCurveTo(0, y0 - 2.4, -w + 0.6, y0); g.closePath();
      };
      path(); g.fillStyle = vfill(g, c, y0 - 1, hem, 0.26, -0.32); g.fill(); outline(g, 0.85);
      g.save(); path(); g.clip();
      // folds in the skirt
      g.strokeStyle = shade(c, -0.38); g.lineWidth = 0.55;
      for (const x of [-4.4, -1.4, 1.6, 4.6]) { g.beginPath(); g.moveTo(x * 0.55, wst + 1.2); g.quadraticCurveTo(x * 0.9 + sway * 0.3, (wst + hem) / 2 + 1, x * 1.15 + sway * 0.45, hem); g.stroke(); }
      g.strokeStyle = shade(c, 0.35); g.lineWidth = 0.4; for (const x of [-3, 3]) { g.beginPath(); g.moveTo(x * 0.6, wst + 2); g.quadraticCurveTo(x * 0.85, (wst + hem) / 2, x * 1.05 + sway * 0.4, hem - 0.6); g.stroke(); }
      if (Bd.trim) { g.strokeStyle = Bd.trim; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-flare + sway * 0.5 - 1, hem - 0.4); swayHem(g, -flare + sway * 0.5 - 1, flare + sway * 0.5 + 1, hem - 0.4, 5, sway * 0.3, 1.2); g.stroke(); }
      if (kind === 'robe' && !back) {
        // open at the front over the under colour
        const u = Bd.under || shade(c, -0.45);
        g.beginPath(); g.moveTo(-1.2, y0 + 0.4); g.quadraticCurveTo(-1.8, wst, -2.6 + sway * 0.4, hem + 1); g.lineTo(2.6 + sway * 0.4, hem + 1); g.quadraticCurveTo(1.8, wst, 1.2, y0 + 0.4); g.closePath();
        g.fillStyle = vfill(g, u.startsWith('#') ? u : '#3a3040', y0, hem, 0.2, -0.3); g.fill();
        g.strokeStyle = Bd.edge || shade(c, 0.35); g.lineWidth = 0.7; g.beginPath(); g.moveTo(-1.2, y0 + 0.4); g.quadraticCurveTo(-1.8, wst, -2.6 + sway * 0.4, hem + 1); g.moveTo(1.2, y0 + 0.4); g.quadraticCurveTo(1.8, wst, 2.6 + sway * 0.4, hem + 1); g.stroke();
      }
      g.restore();
      if (kind === 'dress' && !back) {
        // the bodice: a lighter front with laces criss-crossed
        g.beginPath(); g.moveTo(-3.4, y0 + 0.2); g.quadraticCurveTo(-3.8, wst - 2, -2.4, wst + 0.6); g.lineTo(2.4, wst + 0.6); g.quadraticCurveTo(3.8, wst - 2, 3.4, y0 + 0.2); g.quadraticCurveTo(0, y0 + 1.6, -3.4, y0 + 0.2); g.closePath();
        g.fillStyle = vfill(g, Bd.under || '#efe4cc', y0, wst, 0.2, -0.15); g.fill(); outline(g, 0.45);
        g.strokeStyle = Bd.lace || shade(c, -0.45); g.lineWidth = 0.4; g.beginPath();
        for (let k = 0; k < 3; k++) { const y = y0 + 1.8 + k * 1.6; g.moveTo(-1.6, y); g.lineTo(1.6, y + 1.2); g.moveTo(1.6, y); g.lineTo(-1.6, y + 1.2); } g.stroke();
      }
      if (Bd.belt !== false) { g.strokeStyle = Bd.belt || shade(c, -0.5); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-w + 1.3, wst + 0.4); g.quadraticCurveTo(0, wst + 1.6, w - 1.3, wst + 0.4); g.stroke(); if (!back && Bd.knot !== false) { g.lineWidth = 0.8; g.beginPath(); g.moveTo(1.6, wst + 1); g.quadraticCurveTo(2.4 + sway * 0.4, wst + 3.4, 1.8 + sway * 0.6, wst + 5.2); g.moveTo(2.4, wst + 1); g.quadraticCurveTo(3.6 + sway * 0.4, wst + 3, 3.4 + sway * 0.6, wst + 4.6); g.stroke(); } }
      if (back) { g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, y0 - 0.6); g.lineTo(0, B.waist); g.stroke(); }
      return;
    }
    // tunic and coat: to the hem (a coat longer, open at the front)
    const hem = B.hem + (kind === 'coat' ? 2.4 : 0) + (Bd.len || 0);
    const body = () => bodyPath(g, w, w + 1.3, w - 0.5 + (kind === 'coat' ? 0.6 : 0), y0, hem);
    body(); g.fillStyle = vfill(g, c, y0 - 1, hem, 0.24, -0.3); g.fill(); outline(g, 0.85);
    g.save(); body(); g.clip();
    g.strokeStyle = shade(c, -0.38); g.lineWidth = 0.5;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (w - 2.6), y0 + 3.4); g.quadraticCurveTo(s * (w - 1.8), (y0 + hem) / 2 + 1, s * (w - 2.4), hem); g.stroke(); }
    if (kind === 'coat' && !back) {
      const u = Bd.under || '#e9dfc6';
      g.beginPath(); g.moveTo(-1.6, y0 + 0.2); g.lineTo(-2.2, hem + 1); g.lineTo(2.2, hem + 1); g.lineTo(1.6, y0 + 0.2); g.closePath(); g.fillStyle = vfill(g, u, y0, hem, 0.2, -0.25); g.fill();
      g.strokeStyle = shade(c, 0.3); g.lineWidth = 0.6; g.beginPath(); g.moveTo(-1.6, y0 + 0.2); g.lineTo(-2.2, hem + 1); g.moveTo(1.6, y0 + 0.2); g.lineTo(2.2, hem + 1); g.stroke();
      // lapels and buttons
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.6, y0 + 0.2); g.lineTo(s * 4.2, y0 + 0.6); g.lineTo(s * 2.2, y0 + 4.6); g.closePath(); g.fillStyle = shade(c, -0.18); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.35; g.stroke(); }
      g.fillStyle = Bd.button || GOLD; for (const y of [y0 + 5.4, y0 + 7.8, y0 + 10.2]) { ell(g, -2.9, y, 0.5, 0.5); g.fill(); }
      if (Bd.pocket !== false) { g.strokeStyle = shade(c, -0.45); g.lineWidth = 0.5; g.beginPath(); g.moveTo(3.6, hem - 3.4); g.lineTo(6.2, hem - 3.6); g.stroke(); }
    }
    // hem folds
    g.strokeStyle = shade(c, -0.42); g.lineWidth = 0.45; for (let x = -w + 1.5; x < w - 1; x += 2.6) { g.beginPath(); g.moveTo(x, hem - 1.2); g.lineTo(x + 0.4, hem); g.stroke(); }
    g.restore();
    if (!back && kind === 'tunic' && Bd.collar !== false) {
      // a V at the neck over the shirt beneath
      const u = Bd.under || '#efe4cc';
      g.beginPath(); g.moveTo(-2.6, y0 - 0.9); g.lineTo(0, y0 + 3); g.lineTo(2.6, y0 - 0.9); g.quadraticCurveTo(0, y0 - 0.2, -2.6, y0 - 0.9); g.closePath(); g.fillStyle = u; g.fill(); outline(g, 0.4);
      g.strokeStyle = Bd.trim || shade(c, 0.35); g.lineWidth = 0.6; g.beginPath(); g.moveTo(-2.6, y0 - 0.9); g.lineTo(0, y0 + 3); g.lineTo(2.6, y0 - 0.9); g.stroke();
      if (Bd.laces) { g.strokeStyle = shade(u, -0.5); g.lineWidth = 0.35; g.beginPath(); g.moveTo(-0.9, y0 + 0.6); g.lineTo(0.9, y0 + 1.4); g.moveTo(0.9, y0 + 0.6); g.lineTo(-0.9, y0 + 1.4); g.stroke(); }
    }
    if (Bd.trim && kind === 'tunic') { g.save(); body(); g.clip(); g.strokeStyle = Bd.trim; g.lineWidth = 1; g.beginPath(); g.moveTo(-w - 1, hem - 0.5); g.quadraticCurveTo(0, hem + 0.3, w + 1, hem - 0.5); g.stroke(); g.restore(); }
    if (Bd.belt !== false) {
      const bc = Bd.belt || '#4a3020', wy = B.waist;
      rr(g, -w - 0.3, wy, (w + 0.3) * 2, 1.6, 0.6); g.fillStyle = bc; g.fill(); outline(g, 0.4);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(-w, wy + 0.2, w * 2, 0.4);
      if (!back) { rr(g, -1.3, wy - 0.3, 2.6, 2.2, 0.5); g.fillStyle = Bd.buckle || GOLD; g.fill(); outline(g, 0.35); g.fillStyle = bc; g.fillRect(-0.5, wy + 0.3, 1, 1); }
      if (Bd.pouch !== false && !back) { rr(g, -w + 0.4, wy + 1.4, 3.2, 3, 0.9); g.fillStyle = vfill(g, Bd.pouch || '#6b4a2a', wy + 1, wy + 4.4); g.fill(); outline(g, 0.45); g.fillStyle = shade(Bd.pouch || '#6b4a2a', 0.25); g.fillRect(-w + 0.4, wy + 1.4, 3.2, 0.9); }
    }
    if (back) { g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, y0 - 0.8); g.lineTo(0, B.waist); g.stroke(); }
  }
  // the shoulders: round cloth caps where the arms would start (rolled sleeves, puffed sleeves, plain)
  function npc_shoulders(g, C) {
    const P = C.P, B = C.B, Bd = P.body || {}, c = Bd.sleeve || Bd.c || '#6a6a4a', y = B.sh + 1.6;
    if (Bd.shoulders === false) return;
    for (const s of [-1, 1]) {
      const x = s * (B.w + 0.4), rx = Bd.puff ? 3.4 : 3.0, ry = Bd.puff ? 3.0 : 2.7;
      ell(g, x, y, rx, ry, s * 0.2); g.fillStyle = rfill(g, c, x, y, rx); g.fill(); outline(g, 0.6);
      if (Bd.rolled) { ell(g, x + s * 0.3, y + 1.6, rx * 0.95, 1.1, s * 0.2); g.fillStyle = vfill(g, Bd.rolled, y + 0.6, y + 2.6, 0.3, -0.2); g.fill(); outline(g, 0.4); }
      if (Bd.puff) { g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.4; for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(x + k * 1.1, y - ry + 0.6); g.quadraticCurveTo(x + k * 1.4, y, x + k * 1.1, y + ry - 0.5); g.stroke(); } }
      if (Bd.epaulet) { ell(g, x, y - 0.6, rx * 0.8, 1.3, s * 0.2); g.fillStyle = Bd.epaulet; g.fill(); outline(g, 0.35); }
    }
  }

  // ---------- over the clothes ----------
  function npc_over(g, C, o) {
    const B = C.B, back = C.back, y0 = B.sh, wy = B.waist, w = B.w, long = C.P.body && (C.P.body.kind === 'dress' || C.P.body.kind === 'robe');
    const hemY = long ? B.hip + B.leg - 2.4 : B.hem + 1.4, sway = C.step * 0.6;
    if (o.kind === 'apron') {
      const c = o.c || '#efe6d4';
      if (back) { g.strokeStyle = c; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-w + 0.6, wy + 0.4); g.lineTo(w - 0.6, wy + 0.4); g.stroke(); for (const s of [-1, 1]) { ell(g, s * 1.1, wy + 0.4, 1.2, 0.8, s * 0.4); g.fillStyle = c; g.fill(); outline(g, 0.3); } g.strokeStyle = c; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-0.4, wy + 0.8); g.lineTo(-1 + sway, wy + 3.6); g.moveTo(0.4, wy + 0.8); g.lineTo(1.2 + sway, wy + 3.4); g.stroke(); return; }
      const top = o.bib === false ? wy - 0.4 : y0 + 1.4, half = o.w || 4.6;
      const ap = () => { g.beginPath(); g.moveTo(-half * 0.72, top); g.lineTo(half * 0.72, top); g.lineTo(half * 0.78, wy); g.quadraticCurveTo(half + 1, (wy + hemY) / 2, half + 0.6 + sway * 0.3, hemY); g.quadraticCurveTo(0, hemY + 1.2, -half - 0.6 + sway * 0.3, hemY); g.quadraticCurveTo(-half - 1, (wy + hemY) / 2, -half * 0.78, wy); g.closePath(); };
      ap(); g.fillStyle = vfill(g, c, top, hemY, 0.2, -0.22); g.fill(); outline(g, 0.6);
      if (o.bib !== false) { g.strokeStyle = shade(c, -0.25); g.lineWidth = 0.7; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * half * 0.72, top + 0.2); g.quadraticCurveTo(s * (half + 0.6), y0, s * (w - 1), y0 - 1); g.stroke(); } }
      g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.9; g.beginPath(); g.moveTo(-w + 0.8, wy + 0.3); g.lineTo(w - 0.8, wy + 0.3); g.stroke();
      g.save(); ap(); g.clip(); g.strokeStyle = shade(c, -0.22); g.lineWidth = 0.4; for (const x of [-2.2, 2.2]) { g.beginPath(); g.moveTo(x, wy + 1.4); g.quadraticCurveTo(x * 1.1 + sway * 0.2, wy + 4, x * 1.2 + sway * 0.3, hemY); g.stroke(); } g.restore();
      if (o.pocket !== false) { const py = wy + 2.2; rr(g, -2.2, py, 4.4, 2.8, 0.6); g.fillStyle = shade(c, -0.08); g.fill(); g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.35; g.setLineDash([0.6, 0.5]); rr(g, -1.9, py + 0.3, 3.8, 2.2, 0.5); g.stroke(); g.setLineDash([]); if (o.pocketItem) o.pocketItem(g, 0, py); }
      if (o.stain) { g.fillStyle = o.stain; for (const [x, y, r] of [[-2.6, wy - 1.6, 0.9], [2.4, wy + 5.6, 0.7], [1, top + 1.6, 0.5]]) { ell(g, x, y, r, r * 0.8); g.fill(); } }
      return;
    }
    if (o.kind === 'leather') {
      // a smith's heavy leather apron: neck strap, rivets, scorch marks
      const c = o.c || '#7a4a26';
      if (back) { g.strokeStyle = shade(c, -0.2); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-w + 0.4, wy + 0.5); g.lineTo(w - 0.4, wy + 0.5); g.stroke(); g.lineWidth = 0.9; g.beginPath(); g.moveTo(-3, y0 - 0.6); g.quadraticCurveTo(0, y0 + 1.4, 3, y0 - 0.6); g.stroke(); return; }
      const ap = () => { g.beginPath(); g.moveTo(-3.6, y0 + 0.6); g.lineTo(3.6, y0 + 0.6); g.lineTo(4.4, wy - 0.4); g.quadraticCurveTo(w, wy + 2, w - 0.2 + sway * 0.2, hemY + 0.8); g.lineTo(-w + 0.2 + sway * 0.2, hemY + 0.8); g.quadraticCurveTo(-w, wy + 2, -4.4, wy - 0.4); g.closePath(); };
      ap(); g.fillStyle = vfill(g, c, y0, hemY, 0.25, -0.35); g.fill(); outline(g, 0.75);
      g.save(); ap(); g.clip();
      g.strokeStyle = shade(c, 0.35); g.lineWidth = 0.4; g.setLineDash([0.7, 0.6]); g.beginPath(); g.moveTo(-3, y0 + 1.4); g.lineTo(3, y0 + 1.4); g.moveTo(-w + 0.9, hemY); g.lineTo(w - 0.9, hemY); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(25,18,14,0.55)'; for (const [x, y, r] of o.scorch || [[-2.8, wy + 3, 1.3], [2.2, wy - 1.8, 0.9], [3.6, hemY - 1.4, 1.1], [-0.6, y0 + 3.4, 0.6]]) { ell(g, x, y, r, r * 0.75, 0.4); g.fill(); }
      g.strokeStyle = 'rgba(255,220,180,0.22)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-3.2, y0 + 2); g.quadraticCurveTo(-3.8, wy + 2, -3.4, hemY - 1); g.stroke();
      g.restore();
      rivets(g, [[-3.4, y0 + 1.1], [3.4, y0 + 1.1], [-4.3, wy - 0.1], [4.3, wy - 0.1]], '#c8ccd4', 0.42);
      g.strokeStyle = shade(c, -0.3); g.lineWidth = 1; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.4, y0 + 0.8); g.quadraticCurveTo(s * 2.6, y0 - 1.6, s * 1.6, y0 - 2.6); g.stroke(); }
      return;
    }
    if (o.kind === 'tabard') {
      const c = o.c, hem = hemY + (o.len || 1);
      const tab = () => { g.beginPath(); g.moveTo(-4.8, y0 - 0.8); g.quadraticCurveTo(0, y0 + 1, 4.8, y0 - 0.8); g.lineTo(5.4 + sway * 0.2, hem); g.lineTo(-5.4 + sway * 0.2, hem); g.closePath(); };
      tab(); g.fillStyle = vfill(g, c, y0, hem, 0.24, -0.3); g.fill(); outline(g, 0.7);
      if (o.trim) { g.save(); tab(); g.clip(); g.strokeStyle = o.trim; g.lineWidth = 0.75; tab(); g.stroke(); g.restore(); }
      if (o.badge && !back) o.badge(g, 0, y0 + 4.4); else if (o.badge && back) o.badge(g, 0, y0 + 4.4, true);
      return;
    }
    if (o.kind === 'sash') { if (back) return; g.strokeStyle = o.c; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-w + 1.4, y0 + 0.2); g.lineTo(w - 1.6, wy + 1.4); g.stroke(); g.strokeStyle = shade(o.c, 0.35); g.lineWidth = 0.4; g.beginPath(); g.moveTo(-w + 1.6, y0 - 0.3); g.lineTo(w - 1.4, wy + 0.8); g.stroke(); return; }
    if (o.kind === 'shawl') {
      // a knitted shawl round the shoulders, tied at the chest, its fringe swaying
      const c = o.c; g.beginPath(); g.moveTo(-w - 0.8, y0 + 0.4); g.quadraticCurveTo(0, y0 - 2.4, w + 0.8, y0 + 0.4); g.quadraticCurveTo(w - 0.4, y0 + 4, back ? 0 : 1.2, back ? y0 + 7.4 : y0 + 5.4); g.lineTo(back ? 0 : -1.2, back ? y0 + 7.4 : y0 + 5.4); g.quadraticCurveTo(-w + 0.4, y0 + 4, -w - 0.8, y0 + 0.4); g.closePath();
      g.fillStyle = vfill(g, c, y0 - 2, y0 + 6, 0.25, -0.25); g.fill(); outline(g, 0.6);
      g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.35; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-w + 1 + k, y0 + 0.4 + k * 1.2); g.quadraticCurveTo(0, y0 + 1 + k * 1.6, w - 1 - k, y0 + 0.4 + k * 1.2); g.stroke(); }
      if (!back) { ell(g, 0, y0 + 5, 1.2, 0.9); g.fillStyle = shade(c, -0.15); g.fill(); outline(g, 0.35); g.strokeStyle = c; g.lineWidth = 0.6; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.5, y0 + 5.6); g.lineTo(s * 1 + sway * 0.4, y0 + 8.4); g.stroke(); } }
      return;
    }
    if (o.kind === 'chain') {
      // a chain of office: gold links over the shoulders, a medallion on the chest
      if (back) { g.fillStyle = o.c || GOLD; for (let k = 0; k <= 8; k++) { const t = k / 8, x = lerp(-w + 1.6, w - 1.6, t), y = y0 - 0.4 + Math.sin(t * Math.PI) * 1.2; ell(g, x, y, 0.55, 0.45); g.fill(); } return; }
      for (let k = 0; k <= 12; k++) { const t = k / 12, x = lerp(-w + 1.4, w - 1.4, t), y = y0 - 0.4 + Math.sin(t * Math.PI) * 5.2; ell(g, x, y, 0.7, 0.55, k % 2 ? 0.8 : -0.8); g.fillStyle = k % 2 ? shade(o.c || GOLD, 0.25) : (o.c || GOLD); g.fill(); g.strokeStyle = 'rgba(90,60,10,0.6)'; g.lineWidth = 0.25; g.stroke(); }
      const my = y0 + 6.2; ell(g, 0, my, 2.1, 2.1); g.fillStyle = metal(g, o.c || GOLD, my - 2, my + 2); g.fill(); outline(g, 0.45);
      if (o.medal) o.medal(g, 0, my); else gem(g, 0, my, 1.1, o.gem || '#c0392b');
      return;
    }
    if (o.kind === 'vest') {
      const c = o.c; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.4, y0 - 0.4); g.lineTo(s * (w - 0.2), y0 + 0.2); g.quadraticCurveTo(s * (w + 0.8), wy - 1, s * (w - 0.4), wy + 1.6); g.lineTo(s * 2, wy + 2.4); g.closePath(); if (back) continue; g.fillStyle = vfill(g, c, y0, wy + 2, 0.22, -0.3); g.fill(); outline(g, 0.55); }
      if (back) { bodyPath(g, w - 0.3, w + 0.6, w - 0.6, y0 - 0.2, wy + 1.8); g.fillStyle = vfill(g, c, y0, wy + 2); g.fill(); outline(g, 0.55); }
      else { g.fillStyle = o.button || '#d9c9a0'; for (const y of [y0 + 2.6, y0 + 4.8]) { ell(g, 1.8, y, 0.45, 0.45); g.fill(); } }
    }
  }

  // ---------- the cloak: slim and open at the front, the lining showing; behind the body facing us, over it facing away ----------
  function npc_cloakBack(g, C, K) {
    const B = C.B, back = C.back, y0 = B.sh - 0.6, w = B.w + 1.2, hem = B.hip + B.leg - 1.2 + (K.len || 0);
    const sway = Math.sin(time * 2.6 + C.seed) * 0.6 + C.step * 1.4 * (C.side ? -1 : 1);
    const path = () => { g.beginPath(); g.moveTo(-w + 1.4, y0); g.quadraticCurveTo(-w - 1.4, (y0 + hem) / 2, -w - 0.8 + sway * 0.6, hem); swayHem(g, -w - 0.8 + sway * 0.6, w + 0.8 + sway * 0.6, hem, 5, sway * 0.4, 1.3); g.quadraticCurveTo(w + 1.4, (y0 + hem) / 2, w - 1.4, y0); g.quadraticCurveTo(0, y0 - 2, -w + 1.4, y0); g.closePath(); };
    path(); g.fillStyle = back ? vfill(g, K.c, y0, hem, 0.18, -0.34) : vfill(g, K.lining || hex(K.c, -0.4), y0, hem, 0.1, -0.35); g.fill(); outline(g, 0.8);
    g.save(); path(); g.clip(); g.strokeStyle = back ? shade(K.c, -0.4) : 'rgba(0,0,0,0.25)'; g.lineWidth = 0.55;
    for (const x of [-4.6, -1.6, 1.6, 4.6]) { g.beginPath(); g.moveTo(x * 0.6, y0 + 3); g.quadraticCurveTo(x * 0.9 + sway * 0.3, (y0 + hem) / 2, x * 1.12 + sway * 0.6, hem + 1); g.stroke(); }
    if (K.trim) { g.strokeStyle = K.trim; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-w - 1.4 + sway * 0.6, hem - 0.4); swayHem(g, -w - 1.4 + sway * 0.6, w + 1.4 + sway * 0.6, hem - 0.4, 5, sway * 0.4, 1.3); g.stroke(); }
    g.restore();
    if (back) {
      if (K.hood === 'down' || K.hood === 'up') { const hy = B.hy; if (K.hood === 'down') { g.beginPath(); g.moveTo(-5.6, y0 - 1); g.quadraticCurveTo(-6.6, y0 + 4.6, 0, y0 + 6.2 + sway * 0.2); g.quadraticCurveTo(6.6, y0 + 4.6, 5.6, y0 - 1); g.quadraticCurveTo(0, y0 + 0.6, -5.6, y0 - 1); g.closePath(); g.fillStyle = vfill(g, K.c, y0 - 1, y0 + 6, 0.25, -0.25); g.fill(); outline(g, 0.6); g.strokeStyle = shade(K.c, -0.4); g.lineWidth = 0.45; g.beginPath(); g.moveTo(-3.2, y0 + 1); g.quadraticCurveTo(0, y0 + 4.4, 3.2, y0 + 1); g.stroke(); } }
      if (K.badge) K.badge(g, 0, y0 + 6, true);
    }
  }
  // facing us: the two front edges come down past the shoulders, the clasp at the throat
  function npc_cloakFront(g, C, K) {
    const B = C.B, y0 = B.sh - 0.6, w = B.w + 1.2, hem = B.hip + B.leg - 1.2 + (K.len || 0), sway = Math.sin(time * 2.6 + C.seed) * 0.6 + C.step * 1.2;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 3.2, y0 - 0.2); g.quadraticCurveTo(s * (w - 1), y0 - 0.8, s * (w + 0.2), y0 + 2.4); g.quadraticCurveTo(s * (w + 0.9), (y0 + hem) / 2, s * (w + 0.6) + sway * 0.5, hem); g.lineTo(s * (w - 2.2) + sway * 0.5, hem + 0.3); g.quadraticCurveTo(s * (w - 2.8), (y0 + hem) / 2 + 1, s * (w - 2.8), y0 + 3.8); g.quadraticCurveTo(s * 4.4, y0 + 1.4, s * 3.2, y0 - 0.2); g.closePath();
      g.fillStyle = vfill(g, K.c, y0, hem, 0.28, -0.3); g.fill(); outline(g, 0.6);
      g.strokeStyle = K.trim || shade(K.c, 0.32); g.lineWidth = K.trim ? 1.3 : 0.5; g.beginPath(); g.moveTo(s * 3.6, y0 + 0.2); g.quadraticCurveTo(s * (w - 2.8), y0 + 1.6, s * (w - 2.6), y0 + 3.8); g.quadraticCurveTo(s * (w - 2.8), (y0 + hem) / 2 + 1, s * (w - 2.2) + sway * 0.5, hem + 0.3); g.stroke();
    }
    if (K.hood === 'down') { g.beginPath(); g.moveTo(-6.2, y0 - 0.6); g.quadraticCurveTo(0, y0 - 3.4, 6.2, y0 - 0.6); g.quadraticCurveTo(4, y0 + 1.6, 0, y0 + 1); g.quadraticCurveTo(-4, y0 + 1.6, -6.2, y0 - 0.6); g.closePath(); g.fillStyle = vfill(g, K.c, y0 - 3, y0 + 1.6, 0.3, -0.2); g.fill(); outline(g, 0.55); }
    // the clasp
    if (K.clasp !== false) { const cy = y0 + 0.4; ell(g, -2.6, cy, 1.15, 1.15); ell(g, 2.6, cy, 1.15, 1.15); g.fillStyle = metal(g, K.clasp || GOLD, cy - 1.2, cy + 1.2); g.fill(); g.strokeStyle = shade(K.clasp || GOLD, -0.5); g.lineWidth = 0.6; g.beginPath(); g.moveTo(-1.6, cy); g.lineTo(1.6, cy); g.stroke(); ell(g, -2.6, cy, 1.15, 1.15); outline(g, 0.35); ell(g, 2.6, cy, 1.15, 1.15); outline(g, 0.35); }
  }

  // ---------- wings (the sky folk), feathered, from mob-sample people.js's sky sentinel ----------
  function npc_feather(g, x0, y0, a, len, w, c, edge) {
    const cx = x0 + Math.cos(a) * len / 2, cy = y0 + Math.sin(a) * len / 2;
    ell(g, cx, cy, len / 2, w / 2, a); g.fillStyle = c; g.fill(); outline(g, 0.45);
    g.strokeStyle = edge || '#c9b676'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(x0 + Math.cos(a) * 1, y0 + Math.sin(a) * 1); g.lineTo(x0 + Math.cos(a) * len * 0.8, y0 + Math.sin(a) * len * 0.8); g.stroke();
  }
  function npc_wing(g, s, flap, F, edge) {
    g.save(); g.scale(s, 1); g.rotate(-flap);
    const elbow = [5, -7], wrist = [11, -11];
    for (let k = 5; k >= 0; k--) { const t = k * 0.17, bx = lerp(wrist[0], elbow[0], t), by = lerp(wrist[1], elbow[1], t); npc_feather(g, bx, by, -0.5 + k * 0.33, 12.4 - k * 0.6, 3.6, shade(F, -0.05 - k * 0.02), edge); }
    for (let j = 4; j >= 0; j--) { const t = j / 4, bx = lerp(1.4, elbow[0] + 2, t), by = lerp(-1.2, elbow[1] + 0.6, t); npc_feather(g, bx, by, 1.5 - j * 0.1, 9.6 - j * 0.5, 3.4, shade(F, -0.02 - j * 0.015), edge); }
    const cov = () => { g.beginPath(); g.moveTo(-0.6, 1.4); g.quadraticCurveTo(1.6, -9, wrist[0] + 1.2, wrist[1] - 1.4); g.quadraticCurveTo(wrist[0] + 2.4, wrist[1] + 2.4, wrist[0] - 0.4, wrist[1] + 4.4);
      for (let k = 0; k < 4; k++) { const x = wrist[0] - 2.6 - k * 2.8, y = wrist[1] + 6.4 + k * 2; g.quadraticCurveTo(x + 1.6, y + 1.6, x, y); }
      g.quadraticCurveTo(0.6, 1.6, -0.6, 1.4); g.closePath(); };
    cov(); g.fillStyle = vfill(g, F, -12, 2, 0.6, -0.06); g.fill(); outline(g, 0.55);
    g.save(); cov(); g.clip(); g.strokeStyle = edge || '#c9b676'; g.lineWidth = 0.4; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(3 + k * 2.6, -3.6 - k * 2.2, 1.6, 0.2, Math.PI - 0.2); g.stroke(); } g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0.4, -0.6); g.quadraticCurveTo(2.4, -8.4, wrist[0] + 0.6, wrist[1] - 0.8); g.stroke();
    g.restore();
  }
  // W = { scale, tone, edge }: scale 1 is a grown sky person's wings (the game's wing sizes run 0.7 to 1.35)
  function npc_wings(g, C, W) {
    const fk = C.e.flapK || 1, flap = Math.sin(time * 2.2 * fk + C.seed) * 0.08 * fk + (C.e.moving ? Math.sin(C.e.walkT * 0.5) * 0.12 : 0) + (C.talk ? Math.sin(C.tt * 3) * 0.06 : 0);
    g.save(); g.translate(0, C.B.sh + 3 + (C.back ? 0 : C.bob)); g.scale(1.05 * (W.scale || 1), 1.05 * (W.scale || 1));
    for (const s of [-1, 1]) { g.save(); g.translate(s * 3, 0); npc_wing(g, s, flap, W.tone || '#f6f2e4', W.edge); g.restore(); }
    g.restore();
  }

  // ---------- the head ----------
  function npc_head(g, C) {
    const P = C.P, B = C.B, hy = B.hy, r = B.hr, back = C.back, ex = C.fx * 1.8, ey = C.fy * 1.2;
    const H = { hy, r, ex, ey, back };
    const hat = P.hat || null, hair = P.hair || { style: 'short', c: HAIR.brown }, skin = P.skin || SKIN.light;
    if (P.ears === 'goblin') { npc_goblinHead(g, C, H); return; }
    if (P.ears === 'elf') npc_elfEars(g, C, H, skin);
    if (back) {
      const bald = hair.style === 'bald';
      ell(g, 0, hy, r, r * 0.97); g.fillStyle = rfill(g, bald ? skin : hair.c, 0, hy, r); g.fill(); outline(g, 0.8);
      if (!bald) { g.strokeStyle = shade(hair.c, -0.28); g.lineWidth = 0.45; for (const x of [-4.4, -2, 0.4, 2.8, 4.8]) { g.beginPath(); g.moveTo(x * 0.3, hy - r + 0.6); g.quadraticCurveTo(x * 1.1, hy - 1, x * 0.9, hy + r - 0.6); g.stroke(); } }
      else { g.fillStyle = hair.c; for (const s of [-1, 1]) { ell(g, s * (r - 1.6), hy + 2.6, 2.2, 3, s * 0.3); g.fill(); } ell(g, 0, hy + r - 1.6, r - 2.4, 1.8); g.fill(); }
      if (P.ears !== 'elf' && P.ears !== 'none' && !(hat && /hood|kerchief|coif|helmet|wool/.test(hat.kind))) for (const s of [-1, 1]) { ell(g, s * (r - 0.1), hy + 0.8, 1.4, 1.9); g.fillStyle = shade(skin, -0.08); g.fill(); outline(g, 0.45); }
      npc_hairBack(g, C, H, hair);
      if (P.beard && P.beard.style !== 'moustache' && P.beard.style !== 'stubble') { g.fillStyle = P.beard.c; for (const s of [-1, 1]) { ell(g, s * (r - 0.6), hy + r * 0.55, 1.8, 2.4, s * -0.3); g.fill(); outline(g, 0.35); } }
      if (hat) npc_hat(g, C, H, hat);
      return;
    }
    if (P.ears !== 'elf' && P.ears !== 'none' && !(hat && /hood|kerchief|coif|helmet/.test(hat.kind))) for (const s of [-1, 1]) { ell(g, s * (r - 0.1) + ex * 0.2, hy + 0.9, 1.5, 2); g.fillStyle = rfill(g, skin, s * r, hy + 0.9, 2); g.fill(); outline(g, 0.45); g.strokeStyle = shade(skin, -0.3); g.lineWidth = 0.35; g.beginPath(); g.arc(s * (r - 0.1) + ex * 0.2, hy + 0.9, 0.8, 0, Math.PI * 2); g.stroke(); }
    if (hat && hat.kind === 'hood') npc_hoodBack(g, C, H, hat);
    npc_face(g, C, H, skin, P.face || {});
    if (P.beard) npc_beard(g, C, H, P.beard);
    npc_hairFront(g, C, H, hair, hat);
    if (hat) npc_hat(g, C, H, hat);
    if (hat && hat.kind === 'hood' && hair.style !== 'bald') npc_hoodHair(g, C, H, hair);
  }
  // hair that shows in a raised hood: a fringe over the brow, and long hair falling out over the shoulders
  function npc_hoodHair(g, C, H, Hr) {
    const { hy, r, ex } = H, c = Hr.c, hx = ex * 0.4;
    g.beginPath(); g.moveTo(-r + 1.2, hy - 1.2); g.quadraticCurveTo(-r + 1.4, hy - r + 1, hx, hy - r + 0.8); g.quadraticCurveTo(r - 1.4, hy - r + 1, r - 1.2, hy - 1.2); g.quadraticCurveTo(r - 2.4, hy - 3.6, hx + 1.6, hy - 4); g.quadraticCurveTo(hx - 0.6, hy - 2.4, hx - 2.6, hy - 3.8); g.quadraticCurveTo(-r + 2.4, hy - 3.4, -r + 1.2, hy - 1.2); g.closePath();
    g.fillStyle = vfill(g, c, hy - r, hy, 0.3, -0.2); g.fill(); outline(g, 0.5);
    if (Hr.style === 'long' || Hr.style === 'braids') for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r - 1.4), hy + 1); g.quadraticCurveTo(s * (r - 0.2), hy + 4.6, s * (r - 0.4), hy + 9.4); g.lineTo(s * (r - 2.6), hy + 8.8); g.quadraticCurveTo(s * (r - 2.6), hy + 4, s * (r - 2.8), hy + 1.4); g.closePath(); g.fillStyle = vfill(g, c, hy, hy + 9, 0.2, -0.25); g.fill(); outline(g, 0.45); g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.35; g.beginPath(); g.moveTo(s * (r - 1.8), hy + 2); g.quadraticCurveTo(s * (r - 1), hy + 5, s * (r - 1.4), hy + 8.4); g.stroke(); }
  }
  function npc_face(g, C, H, skin, F) {
    const { hy, r, ex, ey } = H, age = F.age || 'adult', talkO = C.talk ? Math.max(0, Math.sin(C.tt * 11)) : 0;
    ell(g, 0, hy, r, r * 0.97); g.fillStyle = rfill(g, skin, 0, hy, r); g.fill(); outline(g, 0.85);
    // cheeks
    g.fillStyle = F.blush || (age === 'child' ? 'rgba(232,108,120,0.45)' : 'rgba(230,120,110,0.3)'); ell(g, -4 + ex, hy + 2.7 + ey, 1.3, 0.8); g.fill(); ell(g, 4 + ex, hy + 2.7 + ey, 1.3, 0.8); g.fill();
    if (F.freckles) { g.fillStyle = 'rgba(150,80,40,0.55)'; for (const [x, y] of [[-4.6, 1.8], [-3.6, 2.4], [-4.2, 3.2], [4.6, 1.8], [3.6, 2.4], [4.2, 3.2], [-0.6, 1.6], [0.7, 1.7]]) { ell(g, x + ex, hy + y + ey, 0.28, 0.28); g.fill(); } }
    // eyes
    const big = F.eyes === 'big' || age === 'child', ew = big ? 1.3 : 1.1, eh = big ? 1.5 : 1.25;
    for (const s of [-1, 1]) {
      const x = s * (big ? 2.7 : 2.6) + ex, y = hy + 0.8 + ey;
      if (F.eyes === 'happy') { g.strokeStyle = F.eye || '#2a1a10'; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.arc(x, y + 0.4, 1, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
      else {
        ell(g, x, y, ew, F.eyes === 'narrow' ? eh * 0.6 : eh); g.fillStyle = F.eye || '#2a1a10'; g.fill();
        g.fillStyle = 'rgba(255,255,255,0.9)'; ell(g, x + 0.3, y - 0.45, big ? 0.48 : 0.36, big ? 0.48 : 0.36); g.fill();
        if (F.eyes === 'sleepy' || age === 'elder') { g.fillStyle = shade(skin, -0.08); g.beginPath(); g.ellipse(x, y - 0.2, ew + 0.3, eh * 0.62, 0, Math.PI, 0); g.fill(); g.strokeStyle = shade(skin, -0.42); g.lineWidth = 0.4; g.beginPath(); g.moveTo(x - ew - 0.2, y - 0.2); g.lineTo(x + ew + 0.2, y - 0.2); g.stroke(); }
      }
      if (F.lash) { g.strokeStyle = F.lash; g.lineWidth = 0.45; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + s * 0.9, y - 0.8); g.lineTo(x + s * 1.8, y - 1.5); g.moveTo(x + s * 1.1, y - 0.2); g.lineTo(x + s * 2, y - 0.6); g.stroke(); }
      if (F.brow !== false) { const bw = F.browW || (age === 'elder' ? 1 : 0.7); g.strokeStyle = F.brow || '#3a2414'; g.lineWidth = bw; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * (F.browIn || 1.6) + ex, hy - 1.4 + ey + (F.browTilt || 0) - (C.talk ? talkO * 0.3 : 0)); g.lineTo(s * 3.8 + ex, hy - 1.1 + ey - (F.browTilt || 0) - (C.talk ? talkO * 0.3 : 0)); g.stroke(); }
      // an elder's lines at the eye corners
      if (age === 'elder' || F.lines) { g.strokeStyle = shade(skin, -0.32); g.lineWidth = 0.35; g.beginPath(); g.moveTo(x + s * 1.6, y - 0.2); g.lineTo(x + s * 2.6, y - 0.7); g.moveTo(x + s * 1.6, y + 0.4); g.lineTo(x + s * 2.6, y + 0.8); g.stroke(); }
    }
    if (age === 'elder' || F.lines) { g.strokeStyle = shade(skin, -0.28); g.lineWidth = 0.35; g.beginPath(); g.moveTo(-2.4 + ex, hy - 3.2 + ey); g.quadraticCurveTo(ex, hy - 3.7 + ey, 2.4 + ex, hy - 3.2 + ey); g.moveTo(-1.8 + ex, hy - 4.3 + ey); g.quadraticCurveTo(ex, hy - 4.7 + ey, 1.8 + ex, hy - 4.3 + ey); g.stroke(); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.7 + ex, hy + 2.2 + ey); g.quadraticCurveTo(s * 2.5 + ex, hy + 3.4 + ey, s * 2.1 + ex, hy + 4.4 + ey); g.stroke(); } }
    // the nose
    if (F.nose === 'big') { ell(g, ex * 1.1, hy + 2.4 + ey, 1.5, 1.3); g.fillStyle = rfill(g, F.noseC || hex(skin, -0.05), ex, hy + 2.4 + ey, 1.5); g.fill(); outline(g, 0.4); }
    else if (F.nose === 'long') { g.strokeStyle = shade(skin, -0.35); g.lineWidth = 0.55; g.beginPath(); g.moveTo(ex + 0.2, hy + 0.6 + ey); g.quadraticCurveTo(ex + 1.4, hy + 2.6 + ey, ex - 0.2, hy + 3 + ey); g.stroke(); }
    else if (F.nose !== false) { g.strokeStyle = shade(skin, -0.3); g.lineWidth = 0.5; g.beginPath(); g.arc(ex + 0.2, hy + 2.1 + ey, 0.7, 0.2, Math.PI * 0.9); g.stroke(); }
    // the mouth (talking: it opens and shuts)
    if (F.mouth !== 'none') {
      const mx = ex, my = hy + 4 + ey, lip = F.lip || '#9a4a42';
      if (talkO > 0.15) { ell(g, mx, my - 0.2, 1.1, 0.5 + talkO * 0.7); g.fillStyle = '#5a1e1a'; g.fill(); }
      else if (F.mouth === 'grin') { g.beginPath(); g.moveTo(mx - 1.8, my - 0.9); g.quadraticCurveTo(mx, my + 1, mx + 1.8, my - 0.9); g.closePath(); g.fillStyle = '#5a1e1a'; g.fill(); g.fillStyle = '#fbf6e8'; g.fillRect(mx - 1.3, my - 0.9, 2.6, 0.5); }
      else if (F.mouth === 'flat') { g.strokeStyle = lip; g.lineWidth = 0.55; g.beginPath(); g.moveTo(mx - 1, my - 0.5); g.lineTo(mx + 1, my - 0.5); g.stroke(); }
      else if (F.mouth === 'frown') { g.strokeStyle = lip; g.lineWidth = 0.55; g.beginPath(); g.arc(mx, my + 0.4, 1.1, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
      else if (F.mouth === 'o') { ell(g, mx, my - 0.3, 0.6, 0.7); g.fillStyle = '#5a1e1a'; g.fill(); }
      else { g.strokeStyle = lip; g.lineWidth = 0.55; g.lineCap = 'round'; g.beginPath(); g.arc(mx, my - 1.3, 1.15, 0.4, Math.PI - 0.4); g.stroke(); }
    }
    if (F.scar) { g.strokeStyle = '#c47a6a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(3.4 + ex, hy - 2.6 + ey); g.lineTo(4.6 + ex, hy + 1 + ey); g.stroke(); }
  }
  // the long ears of the elves, sweeping up and out (from people.js's elf sentinel)
  function npc_elfEars(g, C, H, skin) {
    const { hy } = H;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 5.4, hy - 1.6); g.quadraticCurveTo(s * 9.8, hy - 4.2, s * 12.4, hy - 7.8); g.quadraticCurveTo(s * 9.6, hy + 0.6, s * 5.6, hy + 2.4); g.closePath();
      g.fillStyle = vfill(g, skin, hy - 8, hy + 2); g.fill(); outline(g, 0.6);
      if (!C.back) { g.fillStyle = 'rgba(220,130,130,0.45)'; g.beginPath(); g.moveTo(s * 6.4, hy - 0.6); g.quadraticCurveTo(s * 9.4, hy - 3.4, s * 11.1, hy - 6.2); g.quadraticCurveTo(s * 8.8, hy - 0.4, s * 6.4, hy + 1); g.closePath(); g.fill(); }
    }
  }
  // ---------- hair ----------
  // long hair that falls behind the shoulders: behind the body facing us, over the back facing away
  function npc_hairFall(g, C, Hr, over) {
    const B = C.B, hy = B.hy, c = Hr.c, sway = Math.sin(time * 2 + C.seed) * 0.5 + C.step * 0.4, len = Hr.len || 0;
    g.save(); if (!over) g.translate(0, C.bob);
    if (Hr.style === 'long') {
      const bot = (over ? B.sh + 9 : B.sh + 7) + len;
      g.beginPath(); g.moveTo(-6.4, hy - 3); g.quadraticCurveTo(-9.6, hy + 6, -7.4 + sway, bot);
      for (let k = 0; k <= 6; k++) g.lineTo(-7.4 + sway + k * 14.8 / 6, bot + (k % 2 ? 1.4 : 0));
      g.quadraticCurveTo(9.6, hy + 6, 6.4, hy - 3); g.closePath();
      g.fillStyle = vfill(g, c, hy - 3, bot, 0.2, -0.3); g.fill(); outline(g, 0.6);
      g.strokeStyle = shade(c, -0.28); g.lineWidth = 0.45; for (const x of [-4.6, -1.6, 1.6, 4.6]) { g.beginPath(); g.moveTo(x * 0.8, hy + 2); g.quadraticCurveTo(x * 1.2 + sway * 0.5, hy + 9, x + sway, bot - 0.4); g.stroke(); }
      if (Hr.tie && over) { rr(g, -1.8, hy + 6, 3.6, 1.4, 0.5); g.fillStyle = Hr.tie; g.fill(); outline(g, 0.35); }
    } else if (Hr.style === 'braids') {
      const n = 4; for (const s of (C.back ? [-1, 1] : [])) braid(g, s * 2.2, hy + 4, s * 2.6 + sway * 0.4, hy + 4 + n * 3.1, n, c, Hr.tie);
    } else if (Hr.style === 'ponytail' && over) {
      braid(g, 0, hy + 3, sway * 0.6, hy + 13, 3, c, Hr.tie, true);
    }
    g.restore();
  }
  // a plait or a tail: a chain of lobes, a tie, a tuft
  function braid(g, x0, y0, x1, y1, n, c, tie, tail) {
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t); ell(g, x, y, (tail ? 2.2 : 1.6) - i * 0.12, (y1 - y0) / n * 0.62, tail ? 0 : (i % 2 ? 0.35 : -0.35)); g.fillStyle = vfill(g, c, y - 1.6, y + 1.6, 0.25, -0.28); g.fill(); outline(g, 0.4); }
    if (tie) { rr(g, x1 - 1.2, y1 - 0.4, 2.4, 1.2, 0.5); g.fillStyle = tie; g.fill(); outline(g, 0.3); }
    g.fillStyle = c; g.beginPath(); g.moveTo(x1 - 1, y1 + 0.8); g.lineTo(x1 - 0.3, y1 + 2.8); g.lineTo(x1 + 0.2, y1 + 1.6); g.lineTo(x1 + 0.8, y1 + 2.6); g.lineTo(x1 + 1, y1 + 0.8); g.closePath(); g.fill(); outline(g, 0.3);
  }
  function npc_hairBack(g, C, H, Hr) {
    const { hy, r } = H, c = Hr.c;
    if (Hr.style === 'bun') { ell(g, 0, hy - 2.4, 3, 2.7); g.fillStyle = rfill(g, c, 0, hy - 2.4, 3); g.fill(); outline(g, 0.55); g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.4; g.beginPath(); g.arc(0, hy - 2.4, 1.6, 0.4, 4); g.stroke(); if (Hr.tie) { g.strokeStyle = Hr.tie; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-2.2, hy - 0.2); g.lineTo(2.2, hy - 0.2); g.stroke(); } }
    if (Hr.style === 'curly') { g.fillStyle = c; for (let k = 0; k < 9; k++) { const a = Math.PI * (0.05 + k * 0.1125) + Math.PI; ell(g, Math.cos(a) * r, hy + Math.sin(a) * r * 0.95, 1.6, 1.6); g.fill(); } }
  }
  function npc_hairFront(g, C, H, Hr, hat) {
    const { hy, r, ex } = H, c = Hr.c, st = Hr.style, hx = ex * 0.4;
    const covered = hat && /hood|helmet|coif|kerchief|wool|chef/.test(hat.kind);
    if (st === 'bald') {
      // bald on top, a fringe round the sides
      g.fillStyle = vfill(g, c, hy - 2, hy + 4); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r - 0.1), hy - 2.6); g.quadraticCurveTo(s * (r + 0.9), hy + 1.6, s * (r - 0.6), hy + 3.8); g.quadraticCurveTo(s * (r - 2.2), hy + 1, s * (r - 1.6), hy - 2.4); g.closePath(); g.fill(); outline(g, 0.4); }
      if (!covered) { g.fillStyle = 'rgba(255,255,255,0.35)'; ell(g, -2.4, hy - r + 2.2, 2.2, 1.2, -0.4); g.fill(); }
      return;
    }
    if (covered) {
      // only the edges show under the hat
      g.fillStyle = vfill(g, c, hy - 3, hy + 4); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r - 0.2), hy - 2.8); g.quadraticCurveTo(s * (r + 0.6), hy + 1.2, s * (r - 1), hy + 3); g.quadraticCurveTo(s * (r - 2.4), hy + 0.4, s * (r - 2.2), hy - 2.6); g.closePath(); g.fill(); }
      if (st === 'braids') for (const s of [-1, 1]) braid(g, s * (r - 1.2), hy + 4.4, s * (r - 0.6), hy + 14.4, 4, c, Hr.tie);
      if (st === 'long' && !(hat && hat.kind === 'hood')) for (const s of [-1, 1]) lock(g, s, H, c);
      return;
    }
    // the hair on top: a cap with a parting and a fringe that falls one way
    const top = () => {
      g.beginPath(); g.moveTo(-r - 0.3, hy + (st === 'crop' ? -1.4 : 0.6)); g.quadraticCurveTo(-r - 0.6, hy - r - 0.6, hx, hy - r - 0.5); g.quadraticCurveTo(r + 0.6, hy - r - 0.6, r + 0.3, hy + (st === 'crop' ? -1.4 : 0.6));
      if (st === 'curly') { for (let k = 0; k <= 6; k++) { const x = lerp(r - 0.4, -r + 0.4, k / 6); g.quadraticCurveTo(x + 0.6, hy - 2 + (k % 2 ? -1.6 : 0.8), x, hy - 3 + (k % 2 ? 0 : 1)); } }
      else { g.quadraticCurveTo(r - 1.6, hy - 2.8, hx + 2.2, hy - 4.4); g.quadraticCurveTo(hx - 0.6, hy - 2.2, hx - 2.4, hy - 4.2); g.quadraticCurveTo(-r + 1.6, hy - 2.6, -r - 0.3, hy + 0.6); }
      g.closePath();
    };
    top(); g.fillStyle = vfill(g, c, hy - r, hy + 2, 0.3, -0.15); g.fill(); outline(g, 0.6);
    g.strokeStyle = shade(c, 0.35); g.lineWidth = 0.45; g.beginPath(); g.arc(-1.4, hy - 2, r - 2.2, Math.PI * 1.18, Math.PI * 1.45); g.stroke();
    g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.4; g.beginPath(); g.moveTo(hx + 0.4, hy - r); g.quadraticCurveTo(hx + 0.8, hy - 5.6, hx + 0.2, hy - 4.2); g.stroke();
    if (st === 'long' || st === 'braids' || st === 'ponytail' || st === 'bun' || st === 'tied') {
      if (st === 'long') for (const s of [-1, 1]) lock(g, s, H, c);
      if (st === 'braids') for (const s of [-1, 1]) braid(g, s * (r - 1.2), hy + 4.4, s * (r - 0.6), hy + 14.4, 4, c, Hr.tie);
      if (st === 'bun') { ell(g, 0, hy - r - 0.6, 3, 2.4); g.fillStyle = rfill(g, c, 0, hy - r - 0.6, 3); g.fill(); outline(g, 0.5); g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.4; g.beginPath(); g.arc(0, hy - r - 0.6, 1.6, 0.6, 3.6); g.stroke(); }
      // the tail hangs outside the cheek, clear of the eye
      if (st === 'ponytail') { const sw = Math.sin(time * 2.4 + C.seed) * 0.6; braid(g, r + 0.7, hy - 1.2, r + 2.5 + sw, hy + 7.6, 3, c, Hr.tie, true); }
      if (st === 'tied') for (const s of [-1, 1]) { g.fillStyle = vfill(g, c, hy, hy + 5); g.beginPath(); g.moveTo(s * (r - 0.4), hy - 1); g.quadraticCurveTo(s * (r + 1.2), hy + 3, s * (r - 0.2), hy + 5); g.quadraticCurveTo(s * (r - 1.8), hy + 2, s * (r - 2), hy - 0.8); g.closePath(); g.fill(); outline(g, 0.4); }
    } else {
      // short: sideburns
      g.fillStyle = c; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r - 0.1), hy - 1.6); g.quadraticCurveTo(s * (r + 0.3), hy + 1.2, s * (r - 0.9), hy + 2.2); g.lineTo(s * (r - 1.6), hy - 1); g.closePath(); g.fill(); }
    }
  }
  // a lock of long hair framing the face, falling over the shoulder
  function lock(g, s, H, c) { const { hy, r } = H; g.beginPath(); g.moveTo(s * (r - 0.6), hy - 1); g.quadraticCurveTo(s * (r + 1.4), hy + 5, s * (r - 0.2), hy + 10); g.lineTo(s * (r - 2.2), hy + 9.4); g.quadraticCurveTo(s * (r - 1.6), hy + 4, s * (r - 2.2), hy - 0.4); g.closePath(); g.fillStyle = vfill(g, c, hy, hy + 10, 0.2, -0.25); g.fill(); outline(g, 0.5); g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.35; g.beginPath(); g.moveTo(s * (r - 1.2), hy + 1); g.quadraticCurveTo(s * (r - 0.2), hy + 5, s * (r - 1), hy + 9); g.stroke(); }

  // ---------- beards ----------
  // Bd = { style, c, len }: stubble, short, full, long, forked, moustache, braided
  function npc_beard(g, C, H, Bd) {
    const { hy, r, ex, ey } = H, c = Bd.c, bx = ex * 0.6, st = Bd.style, len = Bd.len || 0, sway = C.step * 0.3 + Math.sin(time * 1.8 + C.seed) * 0.15;
    const tlk = C.talk ? Math.max(0, Math.sin(C.tt * 11)) * 0.5 : 0;
    if (st === 'stubble') { g.fillStyle = hex(c, 0) + '66'; g.beginPath(); g.moveTo(-r + 1.2 + bx, hy + 1.6); g.quadraticCurveTo(-r + 1.6 + bx, hy + 6.4, bx, hy + r - 0.2); g.quadraticCurveTo(r - 1.6 + bx, hy + 6.4, r - 1.2 + bx, hy + 1.6); g.quadraticCurveTo(bx, hy + 4.6, -r + 1.2 + bx, hy + 1.6); g.fill(); }
    if (st === 'short' || st === 'full' || st === 'long' || st === 'forked' || st === 'braided') {
      const low = st === 'short' ? 7.6 : st === 'full' ? 9.6 : st === 'braided' ? 9.2 : 13.6 + len, wide = st === 'short' ? 0.6 : 2.2;
      const beard = () => {
        g.beginPath(); g.moveTo(-r + 0.3 + bx, hy - 0.2); g.quadraticCurveTo(-r - wide + bx, hy + 5.4, -4.4 + bx + sway, hy + low - (st === 'forked' ? 1 : 0.8));
        if (st === 'forked') { g.quadraticCurveTo(-2.8 + bx + sway, hy + low + 1.6, -1.6 + bx + sway, hy + low + 2.4); g.quadraticCurveTo(-0.6 + bx + sway, hy + low - 1, bx + sway, hy + low - 2); g.quadraticCurveTo(0.6 + bx + sway, hy + low - 1, 1.6 + bx + sway, hy + low + 2.4); g.quadraticCurveTo(2.8 + bx + sway, hy + low + 1.6, 4.4 + bx + sway, hy + low - 1); }
        else if (st === 'long') { g.quadraticCurveTo(-2 + bx + sway, hy + low + 1.4, bx + sway * 1.4, hy + low + 2.6); g.quadraticCurveTo(2 + bx + sway, hy + low + 1.4, 4.4 + bx + sway, hy + low - 0.8); }
        else { g.quadraticCurveTo(-2.4 + bx, hy + low + 1, bx, hy + low + 0.4); g.quadraticCurveTo(2.4 + bx, hy + low + 1, 4.4 + bx + sway, hy + low - 0.8); }
        g.quadraticCurveTo(r + wide + bx, hy + 5.4, r - 0.3 + bx, hy - 0.2); g.quadraticCurveTo(r - 1.6 + bx, hy + 3.4, 3 + bx, hy + 3.6 + tlk); g.quadraticCurveTo(bx, hy + 4.4 + tlk, -3 + bx, hy + 3.6 + tlk); g.quadraticCurveTo(-r + 1.6 + bx, hy + 3.4, -r + 0.5 + bx, hy + 0.2); g.closePath();
      };
      if (st === 'braided') for (const s of [-1, 1]) braid(g, s * 2.4 + bx, hy + low - 1.4, s * 2.8 + bx + sway, hy + low + 4.6, 3, c, Bd.ring || '#8f96a3');
      beard(); g.fillStyle = vfill(g, c, hy + 1, hy + low + 2, 0.22, -0.25); g.fill(); outline(g, 0.7);
      g.save(); beard(); g.clip(); g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.42; g.lineCap = 'round';
      for (const [x, y] of [[-5, 4.6], [-2.4, 6.2], [0, 5.4], [2.4, 6.2], [5, 4.6], [-3.6, 8], [1.2, 8.6], [3.8, 8], [-1.2, 11], [1.4, 12.4], [-2.8, 10.6]]) if (y < low + 2) { g.beginPath(); g.arc(x + bx, hy + y, 0.95, 0.4, 2.7); g.stroke(); }
      g.strokeStyle = 'rgba(255,240,220,0.35)'; for (const [x, y] of [[-3.4, 5.2], [3.2, 5.4], [-0.8, 7.4]]) { g.beginPath(); g.arc(x + bx, hy + y, 0.8, 3.6, 5.6); g.stroke(); } g.restore();
    }
    if (st !== 'stubble') {
      // the moustache, curling at the ends
      const mc = hex(c, -0.08), big = st === 'moustache' ? 1.15 : 1;
      const F = C.P.face || {}, tk = C.talk ? Math.max(0, Math.sin(C.tt * 11)) : 0;
      if (st !== 'moustache' && F.mouth !== 'none') { g.fillStyle = '#4a1a14'; g.beginPath(); g.moveTo(ex - 1.6, hy + 4.4 + ey); g.quadraticCurveTo(ex, hy + 5.8 + ey + tk, ex + 1.6, hy + 4.4 + ey); g.quadraticCurveTo(ex, hy + 4.9 + ey, ex - 1.6, hy + 4.4 + ey); g.fill(); if (F.mouth === 'grin') { g.fillStyle = '#fbf6e8'; g.fillRect(ex - 1, hy + 4.5 + ey, 2, 0.45); } }
      g.fillStyle = vfill(g, mc, hy + 2.4, hy + 5.4, 0.22, -0.25);
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(ex, hy + 3 + ey); g.quadraticCurveTo(ex + s * 2.6 * big, hy + 2.2 + ey, ex + s * 4.4 * big, hy + 3.8 + ey); g.quadraticCurveTo(ex + s * 5.4 * big, hy + 3.2 + ey, ex + s * 5.2 * big, hy + 2.6 + ey); g.quadraticCurveTo(ex + s * 6.2 * big, hy + 4.4 + ey, ex + s * 4.4 * big, hy + 4.8 + ey); g.quadraticCurveTo(ex + s * 2.2, hy + 4.4 + ey, ex, hy + 4 + ey); g.closePath(); g.fill(); outline(g, 0.35); }
    }
  }

  // ---------- hats and headwear ----------
  // the hood's back half (behind the face) when it is up
  function npc_hoodBack(g, C, H, K) {
    const { hy, r } = H, c = K.c;
    g.beginPath(); g.moveTo(-r - 2.2, hy + 6.4); g.quadraticCurveTo(-r - 3.4, hy - r - 0.6, 0, hy - r - 2.6); g.quadraticCurveTo(r + 3.4, hy - r - 0.6, r + 2.2, hy + 6.4); g.quadraticCurveTo(0, hy + 8.4, -r - 2.2, hy + 6.4); g.closePath();
    g.fillStyle = vfill(g, hex(c, -0.35), hy - r, hy + 7, 0.1, -0.2); g.fill(); outline(g, 0.6);
  }
  function npc_hat(g, C, H, K) {
    const { hy, r, ex, back } = H, c = K.c || '#6b4a2a', kind = K.kind;
    if (kind === 'hood') {
      // the hood up: a deep cowl framing the face, a point behind; facing away it covers the head
      const tip = Math.sin(time * 2 + C.seed) * 0.4 + C.step * 0.3;
      if (back) {
        g.beginPath(); g.moveTo(-r - 2.2, hy + 6.6); g.quadraticCurveTo(-r - 3.2, hy - r - 0.4, 0, hy - r - 2.4); g.quadraticCurveTo(r + 3.2, hy - r - 0.4, r + 2.2, hy + 6.6); g.quadraticCurveTo(r - 1, hy + 9.4 + tip, tip, hy + 10.8 + (K.point || 0)); g.quadraticCurveTo(-r + 1, hy + 9.4 + tip, -r - 2.2, hy + 6.6); g.closePath();
        g.fillStyle = vfill(g, c, hy - r - 2, hy + 10, 0.25, -0.3); g.fill(); outline(g, 0.75);
        g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, hy - r - 2); g.quadraticCurveTo(0.6, hy, tip, hy + 9.6); g.stroke();
        return;
      }
      const cowl = () => { g.beginPath(); g.moveTo(-r - 2.2, hy + 6.4); g.quadraticCurveTo(-r - 3.4, hy - r - 0.6, 0, hy - r - 2.6); g.quadraticCurveTo(r + 3.4, hy - r - 0.6, r + 2.2, hy + 6.4);
        g.quadraticCurveTo(r - 0.2, hy + 4.4, r - 1, hy + 1); g.quadraticCurveTo(r - 0.6, hy - r + 1.4, ex * 0.4, hy - r + 0.4); g.quadraticCurveTo(-r + 0.6, hy - r + 1.4, -r + 1, hy + 1); g.quadraticCurveTo(-r + 0.2, hy + 4.4, -r - 2.2, hy + 6.4); g.closePath(); };
      cowl(); g.fillStyle = vfill(g, c, hy - r - 2, hy + 7, 0.3, -0.28); g.fill(); outline(g, 0.75);
      g.strokeStyle = K.trim || shade(c, 0.35); g.lineWidth = K.trim ? 0.9 : 0.5; g.beginPath(); g.moveTo(-r + 1, hy + 1); g.quadraticCurveTo(-r + 0.6, hy - r + 1.4, ex * 0.4, hy - r + 0.4); g.quadraticCurveTo(r - 0.6, hy - r + 1.4, r - 1, hy + 1); g.stroke();
      g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.45; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r + 0.6), hy - 3); g.quadraticCurveTo(s * (r + 1.6), hy + 2, s * (r + 1), hy + 5.6); g.stroke(); }
      // shadow in the hood over the brow
      g.save(); cowl(); g.restore(); g.fillStyle = 'rgba(20,14,10,0.22)'; g.beginPath(); g.ellipse(ex * 0.4, hy - r + 2.2, r - 1.6, 1.8, 0, 0, Math.PI); g.fill();
      return;
    }
    if (kind === 'cap') {
      // a soft cloth cap with a short peak
      g.beginPath(); g.arc(0, hy - 1.2, r + 0.4, Math.PI * 1.04, Math.PI * 1.96); g.quadraticCurveTo(0, hy - 2.6, -r - 0.3, hy - 2.6); g.closePath();
      g.fillStyle = vfill(g, c, hy - r - 1, hy - 2, 0.3, -0.25); g.fill(); outline(g, 0.6);
      g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.4; g.beginPath(); g.moveTo(0, hy - r - 0.8); g.quadraticCurveTo(-1, hy - 5, -0.4, hy - 2.8); g.stroke();
      if (!back) { g.beginPath(); g.moveTo(-r * 0.7 + ex * 0.5, hy - 2.8); g.quadraticCurveTo(ex * 0.5, hy - 0.8, r * 0.7 + ex * 0.5, hy - 2.8); g.quadraticCurveTo(ex * 0.5, hy - 2, -r * 0.7 + ex * 0.5, hy - 2.8); g.closePath(); g.fillStyle = shade(c, -0.2); g.fill(); outline(g, 0.45); }
      ell(g, 0, hy - r - 0.6, 0.9, 0.7); g.fillStyle = shade(c, 0.2); g.fill();
      return;
    }
    if (kind === 'straw') {
      // a wide straw hat with a ribbon round the crown
      const brim = () => ell(g, ex * 0.3, hy - 3, r + 5.2, 2.8);
      brim(); g.fillStyle = vfill(g, c, hy - 6, hy, 0.25, -0.2); g.fill(); outline(g, 0.7);
      g.save(); brim(); g.clip(); g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.35; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(ex * 0.3, hy - 3, r + 4 - k * 1.6, 2.2 - k * 0.5, 0, 0, Math.PI * 2); g.stroke(); } g.restore();
      g.beginPath(); g.moveTo(-r + 0.8, hy - 3.4); g.bezierCurveTo(-r + 0.4, hy - 11, r - 0.4, hy - 11, r - 0.8, hy - 3.4); g.quadraticCurveTo(0, hy - 2.4, -r + 0.8, hy - 3.4); g.closePath();
      g.fillStyle = vfill(g, c, hy - 10, hy - 3, 0.3, -0.2); g.fill(); outline(g, 0.6);
      g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.35; for (let y = hy - 8.4; y < hy - 3.6; y += 1.4) { g.beginPath(); g.moveTo(-r + 1.4, y); g.lineTo(r - 1.4, y + 0.2); g.stroke(); }
      g.fillStyle = K.band || '#8a3a2a'; g.beginPath(); g.moveTo(-r + 0.9, hy - 4.8); g.quadraticCurveTo(0, hy - 4, r - 0.9, hy - 4.8); g.lineTo(r - 0.8, hy - 3.6); g.quadraticCurveTo(0, hy - 2.6, -r + 0.8, hy - 3.6); g.closePath(); g.fill();
      if (K.flower) { ell(g, r - 2, hy - 4.6, 1.3, 1.3); g.fillStyle = K.flower; g.fill(); outline(g, 0.3); ell(g, r - 2, hy - 4.6, 0.5, 0.5); g.fillStyle = '#f5d76a'; g.fill(); }
      return;
    }
    if (kind === 'chef') {
      // a tall white cook's hat, puffed at the top
      rr(g, -r + 0.6, hy - 6.4, (r - 0.6) * 2, 4, 1); g.fillStyle = vfill(g, c === '#6b4a2a' ? '#f2f2ec' : c, hy - 6, hy - 2, 0.2, -0.12); g.fill(); outline(g, 0.55);
      g.fillStyle = vfill(g, c === '#6b4a2a' ? '#f2f2ec' : c, hy - 15, hy - 6, 0.3, -0.12);
      g.beginPath(); g.moveTo(-r + 0.8, hy - 6); g.quadraticCurveTo(-r - 2.6, hy - 10, -r + 0.2, hy - 13.6); g.quadraticCurveTo(-2.6, hy - 17, 0, hy - 14.8); g.quadraticCurveTo(2.6, hy - 17, r - 0.2, hy - 13.6); g.quadraticCurveTo(r + 2.6, hy - 10, r - 0.8, hy - 6); g.closePath(); g.fill(); outline(g, 0.6);
      g.strokeStyle = 'rgba(120,110,100,0.4)'; g.lineWidth = 0.4; for (const x of [-2.4, 0.4, 3]) { g.beginPath(); g.moveTo(x, hy - 6.4); g.quadraticCurveTo(x - 0.6, hy - 10, x + 0.2, hy - 13.4); g.stroke(); }
      return;
    }
    if (kind === 'kerchief' || kind === 'coif') {
      // a headscarf tied at the nape (a kerchief) or under the chin (a coif)
      const cap = () => { g.beginPath(); g.moveTo(-r - 0.6, hy + (kind === 'coif' ? 3 : 0.4)); g.quadraticCurveTo(-r - 1, hy - r - 1.4, 0, hy - r - 1.2); g.quadraticCurveTo(r + 1, hy - r - 1.4, r + 0.6, hy + (kind === 'coif' ? 3 : 0.4)); g.quadraticCurveTo(r - 1.2, hy - 2.6, ex * 0.3, hy - 3.6); g.quadraticCurveTo(-r + 1.2, hy - 2.6, -r - 0.6, hy + (kind === 'coif' ? 3 : 0.4)); g.closePath(); };
      if (back) { ell(g, 0, hy - 0.6, r + 0.8, r + 0.4); g.fillStyle = vfill(g, c, hy - r, hy + r, 0.25, -0.25); g.fill(); outline(g, 0.6); }
      else { cap(); g.fillStyle = vfill(g, c, hy - r - 1, hy, 0.25, -0.2); g.fill(); outline(g, 0.6); }
      if (K.dots) { g.save(); if (back) { ell(g, 0, hy - 0.6, r + 0.8, r + 0.4); } else cap(); g.clip(); g.fillStyle = K.dots; for (let y = hy - r; y < hy + r; y += 2.2) for (let x = -r - 1 + ((y - hy) % 4.4 ? 1.1 : 0); x < r + 1; x += 2.2) { ell(g, x, y, 0.42, 0.42); g.fill(); } g.restore(); }
      if (back && kind === 'kerchief') { const sw = C.step * 0.4; ell(g, 0, hy + r - 1.6, 1.4, 1.1); g.fillStyle = shade(c, -0.1); g.fill(); outline(g, 0.35); g.fillStyle = c; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.6, hy + r - 1.2); g.lineTo(s * 2 + sw, hy + r + 2.4); g.lineTo(s * 0.4 + sw, hy + r + 2); g.closePath(); g.fill(); outline(g, 0.3); } }
      if (!back && kind === 'coif') { g.strokeStyle = shade(c, -0.2); g.lineWidth = 0.7; g.beginPath(); g.moveTo(-r + 0.2, hy + 2.6); g.quadraticCurveTo(0, hy + r + 1.4, r - 0.2, hy + 2.6); g.stroke(); }
      return;
    }
    if (kind === 'wool') {
      // a knitted cap with a turned-up rim and a bobble
      g.beginPath(); g.arc(0, hy - 1.2, r + 0.6, Math.PI, 0); g.closePath(); g.fillStyle = vfill(g, c, hy - r - 2, hy - 1, 0.25, -0.22); g.fill(); outline(g, 0.6);
      g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.4; for (let x = -r + 1.6; x < r; x += 1.6) { g.beginPath(); g.moveTo(x, hy - 2.4); g.quadraticCurveTo(x * 0.7, hy - r + 0.2, x * 0.3, hy - r - 0.6); g.stroke(); }
      rr(g, -r - 0.8, hy - 2.8, (r + 0.8) * 2, 2.6, 1); g.fillStyle = vfill(g, K.rim || hex(c, -0.12), hy - 3, hy, 0.2, -0.2); g.fill(); outline(g, 0.5);
      g.strokeStyle = shade(K.rim || c, -0.35); g.lineWidth = 0.35; for (let x = -r; x < r + 0.6; x += 1.1) { g.beginPath(); g.moveTo(x, hy - 2.6); g.lineTo(x, hy - 0.4); g.stroke(); }
      ell(g, 0, hy - r - 2, 1.9, 1.9); g.fillStyle = rfill(g, K.bobble || '#c9a36a', 0, hy - r - 2, 1.9); g.fill(); outline(g, 0.45);
      return;
    }
    if (kind === 'crown') {
      // a gold crown: a band with gems and five points, pearls on the tips
      const cy = hy - r + 2.2, cw = r - 0.4;
      g.beginPath(); g.moveTo(-cw, cy + 2.6); g.lineTo(-cw - 0.4, cy - 3.4); g.lineTo(-cw * 0.5, cy - 0.8); g.lineTo(0, cy - 4.8); g.lineTo(cw * 0.5, cy - 0.8); g.lineTo(cw + 0.4, cy - 3.4); g.lineTo(cw, cy + 2.6); g.quadraticCurveTo(0, cy + 3.6, -cw, cy + 2.6); g.closePath();
      g.fillStyle = metal(g, K.c || '#f0c040', cy - 5, cy + 3); g.fill(); outline(g, 0.6);
      g.fillStyle = shade(K.c || '#f0c040', -0.3); g.beginPath(); g.moveTo(-cw, cy + 1); g.quadraticCurveTo(0, cy + 2, cw, cy + 1); g.lineTo(cw, cy + 2.6); g.quadraticCurveTo(0, cy + 3.6, -cw, cy + 2.6); g.closePath(); g.fill();
      for (const [x, y] of [[-cw - 0.4, cy - 3.6], [0, cy - 5], [cw + 0.4, cy - 3.6]]) { ell(g, x, y, 0.75, 0.75); g.fillStyle = '#fbf6ec'; g.fill(); outline(g, 0.3); }
      if (!back) { gem(g, ex * 0.3, cy + 1.2, 1.2, K.gem || '#c0392b'); for (const s of [-1, 1]) gem(g, s * 3.6 + ex * 0.3, cy + 1.4, 0.8, K.gem2 || '#3a7bd5'); }
      if (K.velvet) { g.fillStyle = K.velvet; g.beginPath(); g.moveTo(-cw * 0.5 + 0.4, cy - 0.6); g.quadraticCurveTo(0, cy - 4, cw * 0.5 - 0.4, cy - 0.6); g.closePath(); g.fill(); }
      return;
    }
    if (kind === 'circlet') {
      g.strokeStyle = K.c || '#c8d6ee'; g.lineWidth = 0.85; g.beginPath(); g.arc(0, hy + 2.2, r + 0.2, Math.PI * 1.18, Math.PI * 1.82); g.stroke();
      if (!back) gem(g, ex * 0.4 + 0.2, hy - 4.6, 1.2, K.gem || '#5ac46a', K.glow || 'rgba(140,255,150,0.6)');
      if (K.leaves) for (const s of [-1, 1]) { g.save(); g.translate(s * (r - 0.8), hy - 3.6); g.rotate(s * -0.9); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(1.6, -1.2, 3.2, 0); g.quadraticCurveTo(1.6, 1.2, 0, 0); g.closePath(); g.fillStyle = K.leaves; g.fill(); outline(g, 0.3); g.restore(); }
      return;
    }
    if (kind === 'helmet') {
      // a kettle hat (the town guards' helmet): a round crown, a wide brim, a ridge and rivets
      ell(g, ex * 0.3, hy - 2.3, r + 3.4, 2.3); g.fillStyle = metal(g, c, hy - 4.6, hy); g.fill(); outline(g, 0.75);
      if (!back) { g.strokeStyle = shade(c, 0.55); g.lineWidth = 0.6; g.beginPath(); g.ellipse(ex * 0.3, hy - 2.3, r + 2.8, 1.7, 0, 0.15, Math.PI - 0.15); g.stroke(); }
      g.beginPath(); g.moveTo(-r + 0.5, hy - 2.6); g.bezierCurveTo(-r + 0.1, hy - 12.2, r - 0.1, hy - 12.2, r - 0.5, hy - 2.6); g.closePath(); g.fillStyle = metal(g, c, hy - 11, hy - 2.6); g.fill(); outline(g, 0.8);
      rivets(g, [[-4.6, hy - 3.4], [-1.6, hy - 3.9], [1.6, hy - 3.9], [4.6, hy - 3.4]], shade(c, 0.6), 0.45);
      g.strokeStyle = shade(c, 0.65); g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, hy - 9.6); g.lineTo(0, hy - 4.6); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-r + 1.6, hy - 4.6); g.quadraticCurveTo(-r + 1.4, hy - 8.4, -2.2, hy - 9.4); g.quadraticCurveTo(-r + 2.8, hy - 7.6, -r + 2.8, hy - 4.6); g.closePath(); g.fill();
      if (K.plume) { const wv = Math.sin(time * 3.4) * 0.6; g.fillStyle = K.plume; g.beginPath(); g.moveTo(r - 2.4, hy - 6.4); g.quadraticCurveTo(r + 1, hy - 12.6, r + 4.2 + wv, hy - 11.6); g.quadraticCurveTo(r + 1.6, hy - 10, r - 0.8, hy - 5.4); g.closePath(); g.fill(); outline(g, 0.45); }
      return;
    }
    if (kind === 'goggles') {
      // brass goggles pushed up on the forehead, over a leather cap
      npc_hat(g, C, H, { kind: 'cap', c: K.cap || '#6b4a2a' });
      g.fillStyle = '#5a3a1e'; g.fillRect(-r - 0.2, hy - 4.4, (r + 0.2) * 2, 1.4);
      if (!back) for (const x of [-2.8, 2.8]) { ell(g, x + ex * 0.3, hy - 4.6, 2.4, 2.4); g.fillStyle = metal(g, K.c || '#b98a3a', hy - 7, hy - 2); g.fill(); outline(g, 0.5); const gl = g.createRadialGradient(x + ex * 0.3 - 0.7, hy - 5.3, 0.2, x + ex * 0.3, hy - 4.6, 1.9); gl.addColorStop(0, '#e8f6ff'); gl.addColorStop(1, K.lens || '#4f88b0'); g.fillStyle = gl; ell(g, x + ex * 0.3, hy - 4.6, 1.6, 1.6); g.fill(); }
      return;
    }
  }

  // ---------- held things: drawn with the hand at 0, 0; upright means up the screen (-y) ----------
  // main hand at the waist: a staff or spear stands beside them, a bow hangs at the side, a basket or tool is held at the waist
  const PROPS = {
    // a tall staff of knotted wood, the head above the shoulder; o = { c, top: (g) => ..., len }
    staff(g, C, o) {
      const top = -(o.len || 26), bot = (C.B.hip + C.B.leg) - C.B.hand.y + 0.6, c = o.c || '#7a5230';
      g.save(); g.rotate(0.06);
      g.beginPath(); g.moveTo(-1, bot); g.quadraticCurveTo(-1.6, (bot + top) / 2, -0.8, top + 2); g.quadraticCurveTo(0, top - 0.4, 1, top + 2); g.quadraticCurveTo(1.6, (bot + top) / 2, 1, bot); g.closePath();
      g.fillStyle = (() => { const gr = g.createLinearGradient(-1.4, 0, 1.4, 0); gr.addColorStop(0, shade(c, 0.3)); gr.addColorStop(1, shade(c, -0.35)); return gr; })(); g.fill(); outline(g, 0.55);
      g.strokeStyle = shade(c, -0.45); g.lineWidth = 0.4; for (const y of [top + 7, top + 15, bot - 6]) { g.beginPath(); g.moveTo(-1.2, y); g.quadraticCurveTo(0, y + 0.8, 1.2, y - 0.2); g.stroke(); }
      for (const [y, s] of [[top + 10, -1], [bot - 10, 1]]) { ell(g, s * 1.3, y, 0.9, 0.7); g.fillStyle = shade(c, -0.15); g.fill(); outline(g, 0.3); }
      if (o.top) o.top(g, top); else { ell(g, 0, top + 1, 2.2, 2.4); g.fillStyle = rfill(g, c, 0, top + 1, 2.4); g.fill(); outline(g, 0.5); }
      g.restore();
    },
    // a spear stands beside them, the blade above the head
    spear(g, C, o) {
      const top = -(o.len || 30), bot = (C.B.hip + C.B.leg) - C.B.hand.y + 0.4;
      rr(g, -1, top + 6, 2, bot - top - 6, 1); g.fillStyle = (() => { const gr = g.createLinearGradient(-1, 0, 1, 0); gr.addColorStop(0, shade(o.haft || '#8a6a3a', 0.3)); gr.addColorStop(1, shade(o.haft || '#8a6a3a', -0.35)); return gr; })(); g.fill(); outline(g, 0.45);
      rr(g, -1.4, top + 5, 2.8, 2.4, 0.6); g.fillStyle = metal(g, o.band || '#8f96a3', top + 5, top + 7.4); g.fill(); outline(g, 0.35);
      g.beginPath(); g.moveTo(-1.9, top + 5.4); g.quadraticCurveTo(-2.6, top + 2, 0, top - 2.4); g.quadraticCurveTo(2.6, top + 2, 1.9, top + 5.4); g.closePath(); g.fillStyle = metal(g, o.blade || '#c9ccd3', top - 2, top + 5); g.fill(); outline(g, 0.5);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-0.4, top + 4.4); g.lineTo(-0.2, top - 0.8); g.stroke();
      if (o.pennant) { const wv = Math.sin(time * 5 + C.seed) * 1; g.beginPath(); g.moveTo(1, top + 7.6); g.lineTo(1, top + 13); g.quadraticCurveTo(4.4, top + 11 + wv * 0.4, 8.4 + wv, top + 12.4); g.lineTo(5.6 + wv * 0.6, top + 9.6); g.quadraticCurveTo(4, top + 8.2, 1, top + 7.6); g.closePath(); g.fillStyle = vfill(g, o.pennant, top + 7, top + 13, 0.25, -0.3); g.fill(); outline(g, 0.4); }
    },
    // a short bow hanging at the side, string out; o = { c, len }
    bow(g, C, o) {
      const len = o.len || 11, c = o.c || '#8a5a2b';
      g.save(); g.translate(1.6, 1);
      const limb = () => { g.beginPath(); g.moveTo(0.2, -len - 1.4); g.quadraticCurveTo(-0.4, -len - 0.2, 1.2, -len); g.quadraticCurveTo(6.2, -len * 0.7, 4.4, -len * 0.25); g.quadraticCurveTo(3.4, 0, 4.4, len * 0.25); g.quadraticCurveTo(6.2, len * 0.7, 1.2, len); g.quadraticCurveTo(-0.4, len + 0.2, 0.2, len + 1.4); };
      g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 2.9; limb(); g.stroke(); g.strokeStyle = c; g.lineWidth = 1.9; limb(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(2.6, -len * 0.74); g.quadraticCurveTo(5, -len * 0.5, 4.3, -len * 0.3); g.stroke();
      rr(g, 2.8, -1.8, 2.4, 3.6, 0.8); g.fillStyle = o.grip || '#3f6a3a'; g.fill(); outline(g, 0.3);
      g.strokeStyle = '#eef2f6'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(1.2, -len); g.lineTo(1.2, len); g.stroke();
      g.restore();
    },
    // a basket on the arm's hand, hanging below it; o = { c, fill: 'bread' | 'apples' | 'flowers' | 'eggs' | 'candles' | fn, cloth }
    basket(g, C, o) {
      const c = o.c || '#b8864a', sw = C.step * 0.08 + Math.sin(time * 2 + C.seed) * 0.03;
      g.save(); g.rotate(sw);
      g.strokeStyle = OUT; g.lineWidth = 1.7; g.beginPath(); g.arc(0, 4.4, 4.4, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); g.strokeStyle = shade(c, -0.1); g.lineWidth = 0.9; g.stroke();
      const body = () => { g.beginPath(); g.moveTo(-5.2, 3.8); g.lineTo(5.2, 3.8); g.quadraticCurveTo(5, 8.6, 3.4, 9.4); g.lineTo(-3.4, 9.4); g.quadraticCurveTo(-5, 8.6, -5.2, 3.8); g.closePath(); };
      // what is in it, peeking over the rim
      BASKET_FILL[o.fill] ? BASKET_FILL[o.fill](g) : o.fill && o.fill(g);
      if (o.cloth) { g.beginPath(); g.moveTo(-4.6, 4); g.quadraticCurveTo(-2, 1.6, 1, 2.8); g.quadraticCurveTo(3.6, 1.8, 4.6, 4); g.closePath(); g.fillStyle = o.cloth; g.fill(); outline(g, 0.3); }
      body(); g.fillStyle = vfill(g, c, 3.8, 9.4, 0.25, -0.3); g.fill(); outline(g, 0.55);
      g.save(); body(); g.clip(); g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.4; for (let y = 5.2; y < 9.4; y += 1.3) { g.beginPath(); g.moveTo(-5.4, y); g.lineTo(5.4, y); g.stroke(); } for (let x = -4.2; x < 5; x += 1.4) { g.beginPath(); g.moveTo(x, 3.8); g.lineTo(x * 0.85, 9.4); g.stroke(); } g.restore();
      rr(g, -5.6, 3.2, 11.2, 1.3, 0.6); g.fillStyle = shade(c, 0.12); g.fill(); outline(g, 0.4);
      g.restore();
    },
    // a smith's hammer, upright, the head above the hand; o = { c, haft }
    hammer(g, C, o) {
      rr(g, -0.9, -13, 1.8, 16.4, 0.8); g.fillStyle = vfill(g, o.haft || '#7a5230', -13, 3, 0.3, -0.3); g.fill(); outline(g, 0.45);
      g.strokeStyle = '#3a2410'; g.lineWidth = 0.5; for (const y of [-1.4, 0, 1.4]) { g.beginPath(); g.moveTo(-0.9, y); g.lineTo(0.9, y + 0.6); g.stroke(); }
      rr(g, -3.6, -16.6, 7.2, 4, 0.9); g.fillStyle = metal(g, o.c || '#8f96a3', -16.6, -12.6); g.fill(); outline(g, 0.55);
      g.fillStyle = shade(o.c || '#8f96a3', -0.3); g.fillRect(2.6, -16.4, 1, 3.6); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-3.2, -16.2, 6, 0.6);
    },
    // tongs, a hoe, a broom, a rolling pin, a ladle: o = { tool }
    tool(g, C, o) { (TOOLS[o.tool] || TOOLS.hoe)(g, C, o); },
    // a book held at the waist, its cover towards us
    book(g, C, o) { g.save(); g.rotate(-0.25); rr(g, -2.6, -1.4, 5.2, 6.4, 0.6); g.fillStyle = vfill(g, o.c || '#7a2e2e', -1.4, 5, 0.25, -0.3); g.fill(); outline(g, 0.5); g.fillStyle = '#efe6cc'; g.fillRect(2.2, -0.8, 0.6, 5.4); g.strokeStyle = GOLD; g.lineWidth = 0.4; rr(g, -1.9, -0.7, 3.8, 5, 0.4); g.stroke(); ell(g, 0, 1.8, 0.8, 0.8); g.fillStyle = GOLD; g.fill(); g.restore(); },
    // a lantern hanging from the hand, glowing
    lantern(g, C, o) {
      const sw = Math.sin(time * 2.2 + C.seed) * 0.08 + C.step * 0.1; g.save(); g.rotate(sw);
      g.strokeStyle = '#4a4f5a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 2.4); g.stroke();
      const p = 0.55 + Math.sin(time * 4) * 0.2, gl = g.createRadialGradient(0, 6, 0, 0, 6, 9); gl.addColorStop(0, `rgba(255,210,120,${p * 0.6})`); gl.addColorStop(1, 'rgba(255,210,120,0)'); g.fillStyle = gl; ell(g, 0, 6, 9, 9); g.fill();
      g.beginPath(); g.moveTo(-2.4, 3.6); g.lineTo(0, 2); g.lineTo(2.4, 3.6); g.closePath(); g.fillStyle = '#3a3f4a'; g.fill(); outline(g, 0.35);
      rr(g, -2, 3.6, 4, 5, 0.6); g.fillStyle = `rgba(255,214,120,${0.75 + p * 0.2})`; g.fill(); g.strokeStyle = '#3a3f4a'; g.lineWidth = 0.7; g.stroke(); g.beginPath(); g.moveTo(0, 3.6); g.lineTo(0, 8.6); g.stroke();
      ell(g, 0, 6.6, 0.6, 1); g.fillStyle = '#fffbe8'; g.fill();
      rr(g, -2.6, 8.4, 5.2, 1.2, 0.4); g.fillStyle = '#3a3f4a'; g.fill(); outline(g, 0.3);
      g.restore();
    },
    // a sceptre, upright: a gold rod and an orb or a gem on top; o = { c, gem }
    sceptre(g, C, o) {
      const c = o.c || '#e8b84a';
      rr(g, -0.8, -14, 1.6, 17, 0.7); g.fillStyle = metal(g, c, -14, 3); g.fill(); outline(g, 0.45);
      for (const y of [-12, -5, 1.6]) { rr(g, -1.3, y, 2.6, 1.2, 0.5); g.fillStyle = shade(c, 0.2); g.fill(); outline(g, 0.3); }
      ell(g, 0, -16, 2.6, 2.6); g.fillStyle = rfill(g, c, 0, -16, 2.6); g.fill(); outline(g, 0.5);
      g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.4; g.beginPath(); g.moveTo(-2.6, -16); g.lineTo(2.6, -16); g.moveTo(0, -18.6); g.lineTo(0, -13.4); g.stroke();
      rr(g, -0.5, -20.4, 1, 2.2, 0.3); g.fillStyle = c; g.fill(); g.fillRect(-1.2, -19.7, 2.4, 0.8);
      gem(g, 0, -16, 1, o.gem || '#9a2ac0', 'rgba(200,120,255,0.5)');
    },
    // a few things carried in the other hand at the waist
    apple(g, C, o) { ell(g, 0, 1.6, 2.2, 2); g.fillStyle = rfill(g, o.c || '#c8302a', 0, 1.6, 2.2); g.fill(); outline(g, 0.45); g.strokeStyle = '#5a3a1e'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, -0.2); g.lineTo(0.4, -1.2); g.stroke(); g.fillStyle = '#5a9a3a'; ell(g, 1.2, -0.9, 0.9, 0.45, -0.4); g.fill(); },
    candle(g, C, o) { rr(g, -1.6, 0.6, 3.2, 1, 0.4); g.fillStyle = '#b8b0a0'; g.fill(); outline(g, 0.3); rr(g, -0.9, -5.2, 1.8, 6, 0.5); g.fillStyle = vfill(g, o.c || '#f2ead2', -5, 1, 0.2, -0.15); g.fill(); outline(g, 0.4); const p = Math.sin(time * 9) * 0.3; ell(g, 0, -6.4 + p * 0.2, 0.7, 1.3); g.fillStyle = '#ffd36a'; g.fill(); ell(g, 0, -6.2, 0.3, 0.6); g.fillStyle = '#fffbe8'; g.fill(); },
    flowers(g, C, o) { const cs = o.cs || ['#e04a6a', '#f5d76a', '#9a6ad0', '#ffffff']; g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.5; for (const a of [-0.5, -0.15, 0.2, 0.5]) { g.beginPath(); g.moveTo(0, 1.6); g.lineTo(Math.sin(a) * 6, -5 + Math.abs(a) * 2); g.stroke(); } cs.forEach((c, i) => { const a = -0.5 + i * 0.33, x = Math.sin(a) * 6, y = -5 + Math.abs(a) * 2; for (let k = 0; k < 5; k++) { const b = k / 5 * Math.PI * 2; ell(g, x + Math.cos(b) * 0.9, y + Math.sin(b) * 0.9, 0.7, 0.7); g.fillStyle = c; g.fill(); } ell(g, x, y, 0.5, 0.5); g.fillStyle = '#f5c542'; g.fill(); }); rr(g, -1, 0.4, 2, 2.4, 0.5); g.fillStyle = o.wrap || '#e9dfc6'; g.fill(); outline(g, 0.3); },
    keys(g, C, o) { g.strokeStyle = GOLD; g.lineWidth = 0.5; g.beginPath(); g.arc(0, 1.4, 1, 0, Math.PI * 2); g.stroke(); for (const [x, a] of [[-0.6, 0.25], [0.6, -0.2]]) { g.save(); g.translate(x, 2.2); g.rotate(a); g.fillStyle = GOLD; g.fillRect(-0.25, 0, 0.5, 3); g.fillRect(0, 2.2, 1, 0.5); ell(g, 0, -0.2, 0.6, 0.6); g.fill(); g.restore(); } },
    bell(g, C, o) { const sw = C.talk ? Math.sin(C.tt * 14) * 0.4 : Math.sin(time * 2) * 0.05; g.save(); g.rotate(sw); rr(g, -0.6, -3, 1.2, 3, 0.4); g.fillStyle = '#6b4a2a'; g.fill(); g.beginPath(); g.moveTo(-1.4, 0); g.quadraticCurveTo(-1.6, 3, -3, 4.6); g.lineTo(3, 4.6); g.quadraticCurveTo(1.6, 3, 1.4, 0); g.closePath(); g.fillStyle = metal(g, o.c || '#d9a840', 0, 4.6); g.fill(); outline(g, 0.45); ell(g, 0, 5, 0.6, 0.6); g.fillStyle = '#6a5020'; g.fill(); g.restore(); },
    scroll(g, C, o) { g.save(); g.rotate(-0.4); rr(g, -1, -4, 2, 8, 0.9); g.fillStyle = vfill(g, '#f2e6c4', -4, 4, 0.2, -0.2); g.fill(); outline(g, 0.4); for (const y of [-4, 4]) { ell(g, 0, y, 1.3, 0.6); g.fillStyle = '#c9a36a'; g.fill(); outline(g, 0.3); } g.strokeStyle = '#b0202c'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-1, 0.4); g.lineTo(1, 0.4); g.stroke(); g.restore(); },
    tankard(g, C, o) { rr(g, -2, -1, 4, 5, 0.6); g.fillStyle = vfill(g, '#8a5a2b', -1, 4, 0.25, -0.3); g.fill(); outline(g, 0.45); g.strokeStyle = '#8f96a3'; g.lineWidth = 0.6; for (const y of [0, 3]) { g.beginPath(); g.moveTo(-2, y); g.lineTo(2, y); g.stroke(); } ell(g, 0, -1.2, 2, 0.8); g.fillStyle = '#fbf6e8'; g.fill(); outline(g, 0.3); g.strokeStyle = '#6b4a2a'; g.lineWidth = 0.8; g.beginPath(); g.arc(2.4, 1.6, 1.4, -1.2, 1.2); g.stroke(); },
    bread(g, C, o) { ell(g, 0, 1.4, 3.6, 1.8, -0.3); g.fillStyle = rfill(g, '#c98a3a', 0, 1.4, 3.6); g.fill(); outline(g, 0.45); g.strokeStyle = '#f2d39a'; g.lineWidth = 0.4; for (const x of [-1.4, 0, 1.4]) { g.beginPath(); g.moveTo(x - 0.5, 0.6); g.lineTo(x + 0.5, 1.6); g.stroke(); } },
  };
  // pieces that sit over the hand (a hand inside a basket's handle)
  const PROP_OVER = {
    basket(g, C, o) { g.strokeStyle = OUT; g.lineWidth = 1.1; g.beginPath(); g.arc(0, 4.4, 4.4, Math.PI * 1.38, Math.PI * 1.62); g.stroke(); g.strokeStyle = shade(o.c || '#b8864a', -0.1); g.lineWidth = 0.7; g.stroke(); },
  };
  const BASKET_FILL = {
    bread(g) { ell(g, -1.6, 3.2, 2.6, 1.5, -0.3); g.fillStyle = rfill(g, '#c98a3a', -1.6, 3.2, 2.6); g.fill(); outline(g, 0.4); ell(g, 2.2, 3, 1.8, 1.6); g.fillStyle = rfill(g, '#d9a050', 2.2, 3, 1.8); g.fill(); outline(g, 0.4); },
    apples(g) { for (const [x, y, c] of [[-2.6, 3.2, '#c8302a'], [0, 2.6, '#d8402a'], [2.6, 3.2, '#9ab83a'], [-1.2, 3.6, '#b82a2a'], [1.4, 3.8, '#c8302a']]) { ell(g, x, y, 1.5, 1.4); g.fillStyle = rfill(g, c, x, y, 1.5); g.fill(); outline(g, 0.35); } },
    flowers(g) { g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.5; for (const x of [-3, -1, 1, 3]) { g.beginPath(); g.moveTo(x * 0.6, 4); g.lineTo(x, -0.6); g.stroke(); } for (const [x, y, c] of [[-3, -0.8, '#e04a6a'], [-1, -1.6, '#f5d76a'], [1, -1.2, '#9a6ad0'], [3, -0.6, '#ffffff'], [0, 0.6, '#e87a3a']]) { for (let k = 0; k < 5; k++) { const b = k / 5 * Math.PI * 2; ell(g, x + Math.cos(b) * 0.8, y + Math.sin(b) * 0.8, 0.65, 0.65); g.fillStyle = c; g.fill(); } ell(g, x, y, 0.45, 0.45); g.fillStyle = '#f5c542'; g.fill(); } },
    eggs(g) { for (const [x, y] of [[-2, 3.2], [0.2, 2.8], [2.4, 3.3]]) { ell(g, x, y, 1.2, 1.5); g.fillStyle = rfill(g, '#f2e8d4', x, y, 1.5); g.fill(); outline(g, 0.3); } },
    candles(g) { for (const [x, h, c] of [[-2.6, 5, '#f2ead2'], [-0.8, 6.4, '#e8c86a'], [1, 5.6, '#f2ead2'], [2.8, 4.6, '#d9a0c0']]) { rr(g, x - 0.7, 4 - h, 1.4, h, 0.4); g.fillStyle = vfill(g, c, 4 - h, 4, 0.2, -0.15); g.fill(); outline(g, 0.3); g.strokeStyle = '#3a2a1a'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(x, 4 - h); g.lineTo(x, 3.4 - h); g.stroke(); } },
    herbs(g) { g.fillStyle = '#5a9a3a'; for (const [x, a] of [[-2.6, -0.4], [-0.8, -0.1], [1, 0.2], [2.8, 0.5]]) { g.save(); g.translate(x, 4); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-1.4, -2.6, 0, -4.6); g.quadraticCurveTo(1.4, -2.6, 0, 0); g.closePath(); g.fill(); outline(g, 0.3); g.restore(); } },
    scrap(g) { for (const [x, y, c] of [[-2.4, 3, '#8f96a3'], [0.6, 2.4, '#b8863a'], [2.6, 3.2, '#6b707b']]) { rr(g, x - 1.4, y - 1, 2.8, 2, 0.4); g.fillStyle = metal(g, c, y - 1, y + 1); g.fill(); outline(g, 0.3); } ell(g, 0.6, 2.4, 0.6, 0.6); g.fillStyle = '#3a3f4a'; g.fill(); },
  };
  const TOOLS = {
    hoe(g, C, o) { rr(g, -0.8, -15, 1.6, (C.B.hip + C.B.leg) - C.B.hand.y + 15, 0.7); g.fillStyle = vfill(g, '#8a6a3a', -15, 8, 0.3, -0.3); g.fill(); outline(g, 0.45); g.beginPath(); g.moveTo(-0.8, -15); g.lineTo(-5, -14.4); g.lineTo(-5.4, -11.8); g.lineTo(-0.8, -13.2); g.closePath(); g.fillStyle = metal(g, o.c || '#9aa3b2', -15, -11.8); g.fill(); outline(g, 0.45); },
    broom(g, C, o) { const bot = (C.B.hip + C.B.leg) - C.B.hand.y; rr(g, -0.8, -16, 1.6, bot + 10, 0.7); g.fillStyle = vfill(g, '#8a6a3a', -16, bot, 0.3, -0.3); g.fill(); outline(g, 0.45); g.beginPath(); g.moveTo(-1.4, bot - 6); g.lineTo(1.4, bot - 6); g.lineTo(4, bot + 1); g.lineTo(-4, bot + 1); g.closePath(); g.fillStyle = vfill(g, '#d9b86a', bot - 6, bot + 1, 0.2, -0.25); g.fill(); outline(g, 0.45); g.strokeStyle = '#a07a3a'; g.lineWidth = 0.35; for (const x of [-2.4, -0.8, 0.8, 2.4]) { g.beginPath(); g.moveTo(x * 0.4, bot - 5.6); g.lineTo(x, bot + 0.8); g.stroke(); } g.strokeStyle = '#7a2e2e'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-1.6, bot - 4.6); g.lineTo(1.6, bot - 4.6); g.stroke(); },
    tongs(g, C, o) { g.strokeStyle = OUT; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-0.6, 3); g.lineTo(-1.4, -12); g.moveTo(0.6, 3); g.lineTo(1.4, -12); g.stroke(); g.strokeStyle = '#4a4f5a'; g.lineWidth = 0.9; g.stroke(); g.fillStyle = '#4a4f5a'; ell(g, 0, -2, 0.8, 0.8); g.fill(); },
    rollingpin(g, C, o) { g.save(); g.rotate(-1.3); rr(g, -1, -1.6, 12, 3.2, 1.4); g.fillStyle = vfill(g, '#d9b07a', -1.6, 1.6, 0.25, -0.25); g.fill(); outline(g, 0.45); for (const x of [-3.6, 12.2]) { rr(g, x, -0.7, 2.6, 1.4, 0.6); g.fillStyle = '#a07a4a'; g.fill(); outline(g, 0.3); } g.restore(); },
    ladle(g, C, o) { rr(g, -0.6, -12, 1.2, 13, 0.5); g.fillStyle = metal(g, '#a9adb5', -12, 1); g.fill(); outline(g, 0.35); ell(g, 0, -13.4, 2.4, 1.8); g.fillStyle = metal(g, '#a9adb5', -15, -12); g.fill(); outline(g, 0.45); },
    pick(g, C, o) { rr(g, -0.8, -14, 1.6, 17, 0.7); g.fillStyle = vfill(g, '#7a5230', -14, 3, 0.3, -0.3); g.fill(); outline(g, 0.45); g.beginPath(); g.moveTo(-7, -11.6); g.quadraticCurveTo(0, -16.4, 7, -11.6); g.quadraticCurveTo(0, -14.6, -7, -11.6); g.closePath(); g.fillStyle = metal(g, o.c || '#8f96a3', -16, -11); g.fill(); outline(g, 0.5); },
    oar(g, C, o) { const bot = (C.B.hip + C.B.leg) - C.B.hand.y; rr(g, -0.8, -20, 1.6, bot + 14, 0.7); g.fillStyle = vfill(g, '#a07a4a', -20, bot, 0.3, -0.3); g.fill(); outline(g, 0.45); g.beginPath(); g.moveTo(-0.8, bot - 7); g.quadraticCurveTo(-2.8, bot - 3, -2.4, bot + 0.6); g.lineTo(2.4, bot + 0.6); g.quadraticCurveTo(2.8, bot - 3, 0.8, bot - 7); g.closePath(); g.fillStyle = vfill(g, '#b88a52', bot - 7, bot + 1, 0.25, -0.25); g.fill(); outline(g, 0.45); },
    sword(g, C, o) { rr(g, -0.9, -3, 1.8, 6, 0.6); g.fillStyle = '#4a2e13'; g.fill(); outline(g, 0.35); rr(g, -3.4, -4, 6.8, 1.4, 0.6); g.fillStyle = metal(g, o.guard || '#8a8f99', -4, -2.6); g.fill(); outline(g, 0.35); g.beginPath(); g.moveTo(-1.2, -4); g.lineTo(-1.2, -21); g.lineTo(0, -23.4); g.lineTo(1.2, -21); g.lineTo(1.2, -4); g.closePath(); g.fillStyle = metal(g, o.c || '#c9ccd3', -23, -4); g.fill(); outline(g, 0.5); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-0.3, -5); g.lineTo(-0.3, -21); g.stroke(); ell(g, 0, 3.4, 1.1, 1.1); g.fillStyle = metal(g, o.guard || '#8a8f99', 2.4, 4.4); g.fill(); outline(g, 0.3); },
  };
  function npc_prop(g, C, o, which) { const f = PROPS[o.kind]; if (f) f(g, C, o); }

  // ---------- the goblin townsfolk's head: the mob sample's NEW goblin (mobs-new.js goblinHead), so goblins stay one species ----------
  function npc_goblinHead(g, C, H) {
    const P = C.P, skin = P.skin || SKIN.goblin, hy = H.hy, r = H.r, back = H.back, fx = C.fx, e = C.e;
    const flick = e.moving ? Math.sin(e.walkT * 2) * 0.8 : Math.max(0, Math.sin(time * 1.7 + (e.seed || 0)) - 0.9) * 8;
    for (const s of [-1, 1]) {
      const tip = s * (16.5 + (s > 0 ? flick : 0));
      g.beginPath(); g.moveTo(s * 5.5, hy - 2); g.quadraticCurveTo(s * 11, hy - 6, tip, hy - 6.5 + Math.abs(flick) * 0.4); g.quadraticCurveTo(s * 11.5, hy - 1, s * 6, hy + 2); g.closePath();
      g.fillStyle = vfill(g, skin, hy - 6.5, hy + 2); g.fill(); outline(g, 0.7);
      if (!back) { g.beginPath(); g.moveTo(s * 7, hy - 1.5); g.quadraticCurveTo(s * 11, hy - 4.1, s * (Math.abs(tip) - 3.5), hy - 5.1); g.quadraticCurveTo(s * 10.5, hy - 1.5, s * 7.2, hy + 0.5); g.closePath(); g.fillStyle = 'rgba(230,120,130,0.75)'; g.fill(); }
    }
    ell(g, 0, hy, r, r * 0.95); g.fillStyle = rfill(g, skin, 0, hy, r); g.fill(); outline(g, 0.9);
    if (!back) {
      const ex = fx * 1.6, F = P.face || {}, talkO = C.talk ? Math.max(0, Math.sin(C.tt * 11)) : 0;
      g.fillStyle = shade(skin, -0.25); ell(g, ex, hy + 1.6, 1.4, 1.8); g.fill();
      for (const s of [-1, 1]) {
        ell(g, s * 2.9 + ex, hy - 0.6, 1.9, 1.5); g.fillStyle = F.white || '#f6e27a'; g.fill(); outline(g, 0.4);
        ell(g, s * 2.9 + ex + fx * 0.4, hy - 0.5, 0.8, 1); g.fillStyle = F.eye || '#c0241f'; g.fill();
        g.strokeStyle = shade(skin, -0.55); g.lineWidth = 0.9; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * 1.2 + ex, hy - 2.4 - (F.kind ? 0.4 : 0)); g.lineTo(s * 4.6 + ex, hy - 3.3 + (F.kind ? 0.8 : 0)); g.stroke();
      }
      const open = 0.5 + talkO;
      g.beginPath(); g.moveTo(-3.6 + ex, hy + 3.3); g.quadraticCurveTo(ex, hy + 4.4 + open + (F.smile ? 0.8 : 0), 3.6 + ex, hy + 3.3); g.quadraticCurveTo(ex, hy + 3.8, -3.6 + ex, hy + 3.3); g.closePath(); g.fillStyle = '#3a1612'; g.fill();
      g.fillStyle = '#fbf6e8'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.9 + ex - 0.6, hy + 3.4); g.lineTo(s * 1.9 + ex, hy + 4.9); g.lineTo(s * 1.9 + ex + 0.6, hy + 3.5); g.closePath(); g.fill(); }
      if (P.beard) npc_beard(g, C, { hy: hy + 0.6, r: r - 0.6, ex, ey: 0 }, P.beard);
    }
    if (P.hat) npc_hat(g, C, { hy, r, ex: fx * 1.6, ey: 0, back }, P.hat);
  }

  // ---------- a first pass from today's look: until a family file draws someone in full, the base dresses them from the ----------
  // game's own colours and flags (look = the object today's call site hands drawHuman or drawGob; info = NPC_INFO[id])
  function npcFromToday(look, info) {
    // Death: a pale hooded robe that floats, a scythe standing beside it
    if (look.ghost) return { build: 'adult', size: 1.3, lift: 3, alpha: 0.88, skin: '#8a92aa', ears: 'none', face: { eye: '#0b0f14', eyes: 'big', brow: false, nose: false, mouth: 'none', blush: 'rgba(0,0,0,0)' }, hair: { style: 'bald', c: '#8a92aa' },
      hat: { kind: 'hood', c: '#c8d0e0' }, body: { kind: 'robe', c: '#c8d0e0', under: '#7a8298', belt: false, sleeve: '#b8c0d4' }, legs: { boot: '#a8b0c4' }, hand: '#b8c0d4',
      held: { kind: 'staff', c: '#5a4a3a', len: 30, top: (g, top) => { g.beginPath(); g.moveTo(0, top + 1); g.quadraticCurveTo(-10, top - 6, -18, top + 2); g.quadraticCurveTo(-9, top - 2, 0, top + 4); g.closePath(); g.fillStyle = metal(g, '#c9ccd3', top - 5, top + 4); g.fill(); outline(g, 0.5); } } };
    const grp = info.group, kid = /child/.test(info.place || '');
    const build = grp === 'deepholm' ? 'dwarf' : grp === 'sylvaris' ? 'elf' : grp === 'goblin' ? 'goblin' : kid ? 'child' : 'adult';
    // grey or white hair (light and nearly colourless): an old person
    const pale = c => { const n = parseInt((c || '#000000').slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255; return (r + gg + b) / 3 > 150 && Math.max(r, gg, b) - Math.min(r, gg, b) < 48; };
    const hair = look.hair || '#3a2a1a', woman = !!look.woman, tunic = look.tunic || '#6a6a4a';
    const P = { build, skin: look.skin || (grp === 'goblin' ? SKIN.goblin : SKIN.light), legs: { c: hex(tunic, -0.45), boot: '#3a2a1c' } };
    if (grp === 'sylvaris') P.ears = 'elf';
    if (grp === 'goblin') { P.ears = 'goblin'; P.legs = { c: hex(tunic, -0.4), feet: SKIN.goblin }; }
    P.face = { age: pale(hair) && !woman && grp !== 'sylvaris' && grp !== 'aerie' ? 'elder' : kid ? 'child' : 'adult', lash: woman ? '#2a1a10' : null, brow: hex(hair, -0.2) };
    P.hair = { style: woman ? (grp === 'deepholm' ? 'braids' : grp === 'sylvaris' ? 'long' : kid ? 'ponytail' : 'long') : (pale(hair) && !kid ? 'bald' : 'short'), c: hair };
    if (grp === 'sylvaris' && !woman) P.hair.style = 'long';
    if (look.beard || (grp === 'deepholm' && !woman)) P.beard = { style: grp === 'deepholm' ? 'braided' : pale(hair) ? 'long' : 'full', c: grp === 'goblin' ? '#d9d0c0' : hair };
    P.body = woman ? { kind: 'dress', c: tunic, under: '#efe4cc' } : { kind: 'tunic', c: tunic, under: '#efe4cc', belt: '#4a3020' };
    if (look.fat) { P.size = 1.15; P.geo = { w: 9 }; }
    if (look.small) P.build = 'child';
    if (look.apron) P.over = [{ kind: 'apron', c: '#efe6d4' }];
    if (look.crown) { P.hat = { kind: grp === 'sylvaris' ? 'circlet' : 'crown' }; P.cloak = { c: look.shoulder && look.shoulder !== '#c9a36a' ? look.shoulder : '#7a1e2a', lining: '#e8dcc0', trim: '#f2ece0' }; }
    if (look.helm) P.hat = { kind: 'helmet', c: look.helm };
    if (look.hat) P.hat = { kind: { chef: 'chef', cap: 'cap', hood: 'hood', goggles: 'goggles', crown: 'crown', helm: 'helmet' }[look.hat] || 'cap', c: look.hat === 'hood' ? '#3a3a2a' : look.hat === 'cap' ? '#5a3a1e' : undefined };
    if (look.hat_overlay === 'straw') P.hat = { kind: 'straw', c: '#d9c88a' };
    if (look.hat_overlay === 'wool') P.hat = { kind: 'wool', c: '#d9d0c0' };
    if (look.cape) P.cloak = { c: '#4a1e1e', lining: '#7a2e2e' };
    if (look.spear) P.held = { kind: 'spear' };
    if (look.weapon && look.weapon.shape === 'bow') P.held = { kind: 'bow', c: look.weapon.color };
    if (look.weapon && look.weapon.shape === 'sword') P.held = { kind: 'tool', tool: 'sword', c: look.weapon.color };
    if (look.tool === 'hammer') P.held = { kind: 'hammer', c: look.toolColor };
    if (look.tool === 'hoe') P.held = { kind: 'tool', tool: 'hoe', c: look.toolColor };
    if (look.wing) P.wings = { scale: look.wing, tone: '#f6f2e4' };
    if (grp === 'sylvaris' || grp === 'aerie' || grp === 'cloud') P.hand = P.skin;
    return P;
  }

  // ---------- the register: a family file hands its people here ----------
  // NEW_NPC[id] = draw function (g, e); NPC_FAMILY[id] = which family file drew them in full
  const NEW_NPC = {}, NPC_FAMILY = {};
  function addPeople(family, specs) { for (const [id, s] of Object.entries(specs)) { NEW_NPC[id] = typeof s === 'function' ? s : npc(s); NPC_FAMILY[id] = family; NPC_SPEC[id] = typeof s === 'function' ? null : s; } }

  // ---------- groups/reference.js ----------
  // ================= THE FOUR REFERENCE PEOPLE: drawn in full, to set the bar for every family file =================
  // Sera (the follower), Brakka the smith, Duke Ferrin and Old Wren. Each one is a spec for npc() from npc-base.js plus a
  // few special pieces of its own (a quiver, soot, an ermine mantle, a wren on a staff). Colours come from today's look.

  // ---------- Sera, Ranger of Hollowford: a green hood and cloak, a leather jerkin, a quiver, a shortbow at her side ----------
  const REF_SERA = { green: '#3a6a4a', hood: '#2f5a3a', leather: '#7a5230', hair: '#c9843a' };
  // the quiver: a leather tube, fletchings out of the top; at (x, y) leaning by ang
  function ref_quiver(g, x, y, ang, full) {
    g.save(); g.translate(x, y); g.rotate(ang);
    for (const [dx, c] of [[-1.3, '#e9eef5'], [0, '#c0392b'], [1.3, '#e9eef5']]) { g.strokeStyle = '#8a6a3a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(dx, -6); g.lineTo(dx * 1.2, -9.2); g.stroke(); g.fillStyle = c; g.beginPath(); g.moveTo(dx * 1.2 - 0.9, -8.8); g.lineTo(dx * 1.2, -11.4); g.lineTo(dx * 1.2 + 0.9, -8.8); g.closePath(); g.fill(); outline(g, 0.3); }
    if (full) {
      rr(g, -2.4, -6.6, 4.8, 13, 1.6); g.fillStyle = vfill(g, REF_SERA.leather, -7, 7, 0.25, -0.3); g.fill(); outline(g, 0.6);
      g.fillStyle = '#5a3a20'; g.fillRect(-2.4, -6.6, 4.8, 1.3); g.fillRect(-2.4, 3.6, 4.8, 1);
      g.strokeStyle = '#d9b25c'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(0, -4.4); g.quadraticCurveTo(1.4, -1, 0, 2.4); g.quadraticCurveTo(-1.4, -1, 0, -4.4); g.stroke();
    }
    g.restore();
  }
  addPeople('reference', {
    sera: {
      build: 'adult', skin: SKIN.fair, hand: '#6b4a2e',
      face: { eye: '#2f6a3a', lash: '#3a2414', brow: '#9a5a24', browW: 0.6, freckles: true, mouth: 'smile', lip: '#b0605a' },
      hair: { style: 'long', c: REF_SERA.hair, len: -1 },
      hat: { kind: 'hood', c: REF_SERA.hood, trim: '#c9a66b' },
      body: { kind: 'tunic', c: REF_SERA.green, under: '#e9dcc0', belt: '#4a3020', buckle: '#c9a66b', pouch: '#6b4a2a', trim: '#c9a66b', sleeve: '#4a7a52' },
      over: [{ kind: 'vest', c: REF_SERA.leather, button: '#c9a66b' }],
      legs: { c: '#4a4a3a', boot: '#5a3a22', cuff: '#7a5230' },
      cloak: { c: REF_SERA.hood, lining: '#24402c', clasp: '#c9a66b', trim: '#c9a66b' },
      held: { kind: 'bow', c: '#8a5a2b', len: 11.5, grip: '#3f6a3a' },
      // facing us: the quiver's fletchings over her shoulder; a knife on her belt
      behind: (g, C) => ref_quiver(g, -5.2, C.B.sh - 0.4, -0.45, false),
      torso: (g, C) => {
        if (C.back) return;
        g.strokeStyle = '#4a3020'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-6.4, C.B.sh - 0.4); g.lineTo(5.6, C.B.waist - 0.2); g.stroke();
        g.save(); g.translate(5.2, C.B.waist + 1.2); g.rotate(0.25); rr(g, -0.9, 0, 1.8, 4.4, 0.6); g.fillStyle = vfill(g, '#5a3a20', 0, 4.4); g.fill(); outline(g, 0.35); rr(g, -0.7, -2, 1.4, 2, 0.4); g.fillStyle = '#3a2410'; g.fill(); g.restore();
      },
      // facing away: the full quiver on her back, over the cloak
      back: (g, C) => { g.strokeStyle = '#4a3020'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(6.4, C.B.sh - 0.4); g.lineTo(-5.6, C.B.waist - 0.2); g.stroke(); },
      after: (g, C) => { if (C.back) ref_quiver(g, 4.6, C.B.sh + 2.6 + C.bob, 0.36, true); },
    },

    // ---------- Brakka the smith: big and broad, a scorched leather apron, sleeves rolled, soot on his face, a great black beard ----------
    brakka: {
      build: 'adult', size: 1.06, geo: { w: 9.2, gap: 4, lw: 5.6, hand: { x: 11.2, y: 5 } }, skin: SKIN.warm,
      face: { eye: '#1e140c', eyes: 'happy', brow: '#1a1008', browW: 1.4, browIn: 1.2, browTilt: 0.25, nose: 'big', noseC: '#d9946e', mouth: 'grin', blush: 'rgba(220,90,70,0.4)' },
      hair: { style: 'crop', c: '#2a1a0a' },
      beard: { style: 'full', c: '#2a1a0a' },
      hat: { kind: 'kerchief', c: '#7a2a22' },
      body: { kind: 'tunic', c: '#5a4a3a', under: '#cdbfa0', collar: false, belt: '#3a2614', buckle: '#8f96a3', pouch: false, rolled: '#d9c9a8', sleeve: '#6a5a46' },
      over: [{ kind: 'leather', c: '#7a4a26' }],
      legs: { c: '#3a3430', boot: '#2a1e16', cuff: '#5a3a22' },
      held: { kind: 'hammer', c: '#7d8087', haft: '#6b4a2a' },
      off: { kind: 'tool', tool: 'tongs' },
      // soot on his cheek and brow, sweat on the brow
      head: (g, C) => {
        if (C.back) return; const hy = C.B.hy, ex = C.fx * 1.8;
        g.fillStyle = 'rgba(30,24,20,0.42)'; ell(g, 4.4 + ex, hy + 1.6, 1.5, 0.9, 0.5); g.fill(); ell(g, -3 + ex, hy - 3.1, 1.6, 0.6, -0.2); g.fill(); ell(g, -5.4 + ex, hy + 2.2, 0.8, 0.5); g.fill();
        g.fillStyle = 'rgba(220,240,255,0.8)'; ell(g, 2.6 + ex, hy - 3.6, 0.35, 0.55); g.fill();
      },
      // a glowing horseshoe hangs from the belt: he has just been at the forge
      torso: (g, C) => {
        if (C.back) return; const y = C.B.waist + 1.6, k = 0.6 + Math.sin(time * 3) * 0.2;
        g.save(); g.translate(-6.8, y); g.strokeStyle = '#3a2410'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -1.4); g.lineTo(0, 0.6); g.stroke();
        g.strokeStyle = OUT; g.lineWidth = 1.7; g.beginPath(); g.arc(0, 2.6, 1.9, Math.PI * 0.05, Math.PI * 0.95, true); g.stroke(); g.strokeStyle = '#8f96a3'; g.lineWidth = 1.1; g.stroke(); g.restore();
      },
    },

    // ---------- Duke Ferrin: a purple robe and mantle trimmed in ermine, a gold crown and chain of office, a sceptre ----------
    duke: {
      build: 'adult', size: 1.02, skin: SKIN.light, hand: '#f2e8d8',
      face: { eye: '#3a2a1a', age: 'elder', brow: '#6a5a4a', browW: 0.9, mouth: 'smile', nose: 'long' },
      hair: { style: 'tied', c: '#8a7a6a' },
      beard: { style: 'short', c: '#8a7a6a' },
      hat: { kind: 'crown', c: '#f0c040', gem: '#c0392b', gem2: '#2e8ad0', velvet: '#5a1e7a' },
      body: { kind: 'robe', c: '#5a2e7a', under: '#d9b25c', edge: '#e0b546', trim: '#f2ece0', belt: '#e0b546', knot: false, sleeve: '#4a2468' },
      legs: { boot: '#3a2030' },
      cloak: { c: '#4a2468', lining: '#f2ece0', clasp: '#e8b84a', trim: '#f2ece0', len: 0.8 },
      held: { kind: 'sceptre', c: '#e8b84a', gem: '#9a2ac0' },
      // the ermine: a white fur mantle round the shoulders, black tails in it; on the cloak's edges too
      collar: (g, C) => {
        const y0 = C.B.sh - 1.2, w = C.B.w + 1.4;
        const m = () => { g.beginPath(); g.moveTo(-w, y0 + 1); g.quadraticCurveTo(-w - 0.6, y0 + 4.6, -w + 2.4, y0 + 5.6); g.quadraticCurveTo(0, C.back ? y0 + 7.6 : y0 + 6.8, w - 2.4, y0 + 5.6); g.quadraticCurveTo(w + 0.6, y0 + 4.6, w, y0 + 1); g.quadraticCurveTo(0, y0 - 2.6, -w, y0 + 1); g.closePath(); };
        m(); g.fillStyle = vfill(g, '#f4efe4', y0 - 2, y0 + 7, 0.3, -0.15); g.fill(); outline(g, 0.6);
        g.save(); m(); g.clip(); g.fillStyle = '#1a1418';
        for (const [x, y] of [[-7.4, 2.6], [-3.6, 4.4], [0.2, 3], [3.8, 4.6], [7.2, 2.4], [-5.4, 0.4], [5.4, 0.6], [-1.8, 1.2], [2, 0.8]]) { g.beginPath(); g.moveTo(x - 0.35, y0 + y - 0.6); g.lineTo(x + 0.35, y0 + y - 0.6); g.lineTo(x, y0 + y + 0.9); g.closePath(); g.fill(); }
        g.restore();
        if (!C.back) { g.save(); g.translate(0, 0); OVER_AGAIN_CHAIN(g, C); g.restore(); }
      },
    },

    // ---------- Old Wren the hermit: a patched hooded robe, a long white beard, a knotted staff with a little wren on top ----------
    wren: {
      build: 'adult', skin: '#e0b090',
      face: { eye: '#2a1a10', age: 'elder', eyes: 'sleepy', brow: '#f2eee6', browW: 1.5, browIn: 1.1, browTilt: 0.35, nose: 'big', noseC: '#d99a7a', mouth: 'none', blush: 'rgba(220,110,100,0.4)' },
      hair: { style: 'bald', c: '#e6e2da' },
      beard: { style: 'long', c: '#ece8e0', len: 2 },
      hat: { kind: 'hood', c: '#5a6a4a', point: 2 },
      body: { kind: 'robe', c: '#6a5a40', under: '#4a5a3a', edge: '#8a7a5a', belt: '#c9a66b', sleeve: '#5a6a4a' },
      legs: { boot: '#5a3a22', feet: '#d9a07a' },
      held: { kind: 'staff', c: '#7a5230', len: 27, top: (g, top) => ref_wrenBird(g, top) },
      // patches on the robe, a rope belt's tassels, a little pouch of seeds
      torso: (g, C) => {
        const B = C.B, sway = C.step * 0.5;
        for (const [x, y, w, h, c] of C.back ? [[-3.6, 2, 3.4, 3, '#7a6a48'], [2, 7.6, 2.8, 2.6, '#5a6a4a']] : [[-6.4, 8.6, 3, 2.8, '#7a6a48'], [3.8, -0.4, 2.6, 2.4, '#5a6a4a']]) { rr(g, x, y, w, h, 0.4); g.fillStyle = c; g.fill(); g.strokeStyle = 'rgba(30,20,10,0.6)'; g.lineWidth = 0.3; g.setLineDash([0.5, 0.5]); g.stroke(); g.setLineDash([]); }
        if (C.back) return;
        g.strokeStyle = '#c9a66b'; g.lineWidth = 0.6; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-3 + s * 0.5, B.waist + 1.2); g.lineTo(-3.4 + s * 0.8 + sway, B.waist + 5.4); g.stroke(); ell(g, -3.4 + s * 0.8 + sway, B.waist + 5.6, 0.5, 0.6); g.fillStyle = '#c9a66b'; g.fill(); }
        g.save(); g.translate(5.6, B.waist + 1.4); rr(g, -1.6, 0, 3.2, 3.2, 1.2); g.fillStyle = vfill(g, '#8a6a3a', 0, 3.2); g.fill(); outline(g, 0.35); g.strokeStyle = '#4a3020'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-1.4, 0.8); g.lineTo(1.4, 0.8); g.stroke(); g.restore();
      },
    },
  });
  // the Duke's chain lies over the ermine mantle, so it is drawn again after it
  function OVER_AGAIN_CHAIN(g, C) { npc_over(g, C, { kind: 'chain', c: '#e8b84a', gem: '#c0392b', medal: (g, x, y) => { gem(g, x, y, 1.1, '#c0392b', 'rgba(255,90,90,0.4)'); g.strokeStyle = '#7a5a10'; g.lineWidth = 0.3; g.beginPath(); g.arc(x, y, 1.7, 0, Math.PI * 2); g.stroke(); } }); }
  // a wren: a little round brown bird with a cocked-up tail, perched on the staff's head, hopping and looking about
  function ref_wrenBird(g, top) {
    const hop = Math.max(0, Math.sin(time * 1.3)) > 0.97 ? -1.2 : 0, look = Math.sin(time * 0.9) > 0 ? 1 : -1;
    ell(g, 0, top + 1.2, 2.4, 1.6); g.fillStyle = rfill(g, '#6b4a2a', 0, top + 1.2, 2.4); g.fill(); outline(g, 0.45);
    g.save(); g.translate(0, top - 1.6 + hop); g.scale(look, 1);
    g.beginPath(); g.moveTo(-1.8, 0); g.quadraticCurveTo(-3.8, -2.6, -3, -4.4); g.quadraticCurveTo(-2.2, -2.6, -0.8, -1); g.closePath(); g.fillStyle = '#7a5230'; g.fill(); outline(g, 0.35);
    ell(g, 0, 0, 2.3, 1.9); g.fillStyle = rfill(g, '#9a6a3a', 0, 0, 2.3); g.fill(); outline(g, 0.45);
    g.strokeStyle = '#5a3a1e'; g.lineWidth = 0.3; for (const x of [-0.8, 0.2]) { g.beginPath(); g.moveTo(x, -0.8); g.lineTo(x + 0.6, 0.4); g.stroke(); }
    ell(g, 0.4, 0.8, 1.2, 0.8); g.fillStyle = '#d9b88a'; g.fill();
    ell(g, 1.8, -1.6, 1.3, 1.2); g.fillStyle = rfill(g, '#9a6a3a', 1.8, -1.6, 1.3); g.fill(); outline(g, 0.4);
    g.strokeStyle = '#efe0c0'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(1.2, -2.2); g.lineTo(2.8, -2); g.stroke();
    ell(g, 2.2, -1.7, 0.32, 0.32); g.fillStyle = '#1a1008'; g.fill();
    g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(2.9, -1.6); g.lineTo(4, -1.3); g.lineTo(2.9, -1.1); g.closePath(); g.fill();
    g.restore();
  }

  // ---------- groups/death.js ----------
  // ================= DEATH OF THISTLEDOWN: drawn in full =================
  // Death lives in Death's House at the east end of Thistledown (the REST sign, the coffin, the piles of gold). Today the
  // game draws him with drawGhost: a pale floating sheet, two dark eyes and a big scythe. Here he is the same pale ghost in
  // the knight's style: a slim hooded robe, open at the front over a dark inside with tiny stars in it, a ragged shoulder
  // cape, no feet (the hem trails into wisps and he floats), two round glowing eyes that blink in the dark of the hood,
  // bony hands that float, the scythe standing upright beside him with his hand at the waist, an hourglass with its sand
  // running in the other hand, and a little purse of gold at his rope belt. Spooky, not scary: he is a townsperson.
  // Not a spec for npc(): he has no legs, so he is his own draw function. Helpers are prefixed dth_.

  const DTH = { robe: '#c8d0e0', cape: '#a9b3c8', inside: '#232838', edge: '#eef2fa', bone: '#e2ddd0', wood: '#5a4a3a', blade: '#c9ccd3', eye: '#bfe8ff', cord: '#8a8478', sand: '#e0c27a', gold: '#e0b546' };

  // the scythe, standing on its butt beside him: the hand at (0, 0), the blade at the top curving away from his body
  function dth_scythe(g, C) {
    const top = -31;
    // the snath: a long, slightly bent pole
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(0.4, 8); g.quadraticCurveTo(-0.8, -12, 0, top); g.stroke();
    g.strokeStyle = DTH.wood; g.lineWidth = 1.7; g.beginPath(); g.moveTo(0.4, 8); g.quadraticCurveTo(-0.8, -12, 0, top); g.stroke();
    g.strokeStyle = shade(DTH.wood, 0.3); g.lineWidth = 0.45; g.beginPath(); g.moveTo(-0.1, 6); g.quadraticCurveTo(-1.1, -12, -0.4, top + 1); g.stroke();
    // the little grip peg halfway up
    rr(g, -0.2, -13.4, 3, 1.3, 0.5); g.fillStyle = shade(DTH.wood, 0.1); g.fill(); outline(g, 0.4);
    // the blade: a long thin crescent, out and down
    g.beginPath(); g.moveTo(-0.6, top - 0.6); g.quadraticCurveTo(8, top - 6.4, 15.6, top + 3.2); g.quadraticCurveTo(8.4, top - 2.2, -0.2, top + 2.2); g.closePath();
    g.fillStyle = metal(g, DTH.blade, top - 5, top + 3); g.fill(); outline(g, 0.55);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(1, top - 1.4); g.quadraticCurveTo(8, top - 5.4, 14.6, top + 2.2); g.stroke();
    // the iron collar where the blade meets the pole
    rr(g, -1.4, top - 1.2, 2.8, 2.6, 0.6); g.fillStyle = metal(g, '#6a6e78', top - 1.2, top + 1.4); g.fill(); outline(g, 0.4);
    // a glint runs along the edge now and then
    const gl = (time * 0.35 + C.seed) % 1; if (gl < 0.18) { const t = gl / 0.18; sparkle(g, lerp(2, 14.6, t), lerp(top - 2.4, top + 2, t * t), 1.4 * Math.sin(t * Math.PI), '#ffffff'); }
  }
  // the hourglass, held upright above the hand: the sand runs down and starts again
  function dth_hourglass(g, C) {
    const y0 = -10.4, y1 = -1.4, mid = (y0 + y1) / 2, run = (time * 0.12 + C.seed * 0.1) % 1;
    // the glass: two bulbs
    g.beginPath(); g.moveTo(-2.4, y0 + 1); g.quadraticCurveTo(-2.8, mid - 1.6, -0.35, mid); g.quadraticCurveTo(-2.8, mid + 1.6, -2.4, y1 - 1); g.lineTo(2.4, y1 - 1); g.quadraticCurveTo(2.8, mid + 1.6, 0.35, mid); g.quadraticCurveTo(2.8, mid - 1.6, 2.4, y0 + 1); g.closePath();
    g.fillStyle = 'rgba(223,238,252,0.45)'; g.fill(); g.strokeStyle = 'rgba(40,50,70,0.55)'; g.lineWidth = 0.4; g.stroke();
    // the sand: the top heap shrinks, the bottom heap grows, a thread between
    g.save(); g.clip();
    const topH = 3.2 * (1 - run), botH = 3.2 * run;
    g.fillStyle = DTH.sand; g.beginPath(); g.moveTo(-2.6, mid - 0.2); g.lineTo(2.6, mid - 0.2); g.lineTo(2.6, mid - 0.2 - topH); g.quadraticCurveTo(0, mid - 0.2 - topH * 0.6, -2.6, mid - 0.2 - topH); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-2.6, y1 - 1); g.lineTo(2.6, y1 - 1); g.lineTo(2.6, y1 - 1 - botH * 0.6); g.quadraticCurveTo(0, y1 - 1 - botH * 1.3, -2.6, y1 - 1 - botH * 0.6); g.closePath(); g.fill();
    g.strokeStyle = DTH.sand; g.lineWidth = 0.35; g.beginPath(); g.moveTo(0, mid); g.lineTo(0, y1 - 1 - botH * 0.9); g.stroke();
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.7)'; ell(g, -1.4, y0 + 2.4, 0.35, 0.9, 0.2); g.fill();
    // the wooden ends and the posts
    for (const y of [y0, y1 - 1.1]) { rr(g, -3, y, 6, 1.1, 0.4); g.fillStyle = vfill(g, DTH.wood, y, y + 1.1, 0.35, -0.2); g.fill(); outline(g, 0.4); }
    g.strokeStyle = shade(DTH.wood, -0.1); g.lineWidth = 0.5; for (const x of [-2.6, 2.6]) { g.beginPath(); g.moveTo(x, y0 + 1); g.lineTo(x, y1 - 1.1); g.stroke(); }
  }
  // a bony hand: pale, with two knuckle creases
  function dth_hand(g, x, y) { floatHand(g, x, y, DTH.bone); g.strokeStyle = 'rgba(90,80,64,0.5)'; g.lineWidth = 0.3; for (const d of [-0.6, 0.6]) { g.beginPath(); g.moveTo(x + d - 0.5, y - 0.5); g.lineTo(x + d + 0.4, y - 0.5); g.stroke(); } }

  function dth_draw(g, e) {
    const f = face4(e), back = f === 'up', mirror = f === 'left', side = f === 'left' || f === 'right';
    const fx = mirror ? -e.facing.x : e.facing.x, seed = e.seed || 0, s = 1.25;
    const talk = e.talking ? 1 : 0, tt = e.talkT || 0, moving = !!e.moving;
    const lift = 4 + Math.sin(time * 2 + seed) * 1.2, lean = moving ? -1.6 : 0, sway = Math.sin(time * 1.6 + seed) * 0.6 + (moving ? Math.sin((e.walkT || 0) * 0.5) * 0.6 : 0);
    const C = { e, f, back, side, mirror, fx, seed, talk, tt };
    g.save();
    // the shadow stays on the ground, smaller while he floats up
    if (!e.seated && !e.air) shadow(g, 0, 13 * s, (8.4 - lift * 0.3) * s, (3.2 - lift * 0.1) * s, 0.24);
    g.translate(0, -lift); g.scale(mirror ? -s : s, s);
    const hand = { x: 10.2, y: 4.2 }, k = talk ? Math.min(1, tt * 3) : 0, wave = talk ? Math.sin(tt * 6.3) : 0;
    const offX = lerp(-hand.x, -hand.x + 2.6, k) + wave * 0.9 * k, offY = lerp(hand.y - 0.6 + Math.sin(time * 1.8 + seed) * 0.5, -1.2, k) - Math.abs(wave) * 0.8 * k;
    const mainY = hand.y + Math.sin(time * 1.8 + seed + 1) * 0.5;
    const mainHand = () => { g.save(); g.translate(hand.x, mainY); g.rotate(sway * 0.02); dth_scythe(g, C); g.restore(); dth_hand(g, hand.x, mainY); };
    const offHand = () => { g.save(); g.translate(offX, offY); dth_hourglass(g, C); g.restore(); dth_hand(g, offX, offY); };
    // facing away: the hands and what they hold are behind him
    if (back) { offHand(); mainHand(); }
    // the robe: slim, wider at the hem, which trails into wisps that drift (back, when he moves)
    const hemY = 11.2, robe = () => {
      g.beginPath(); g.moveTo(-6.8, -5); g.quadraticCurveTo(-8.6, 3, -9 + lean + sway, hemY);
      const n = 6; for (let i = 0; i < n; i++) { const x0 = lerp(-9, 9, i / n) + lean + sway, x1 = lerp(-9, 9, (i + 1) / n) + lean + sway, dip = 2.6 + Math.sin(time * 3.4 + i * 1.7 + seed) * 1.1; g.quadraticCurveTo((x0 + x1) / 2 + lean * 0.5, hemY + dip + 0.8, x1, hemY + (i % 2 ? 0 : 0.6)); }
      g.quadraticCurveTo(8.6, 3, 6.8, -5); g.closePath();
    };
    g.save(); g.globalAlpha *= 0.94; robe(); g.fillStyle = vfill(g, DTH.robe, -6, hemY + 3, 0.3, -0.32); g.fill(); g.restore(); robe(); outline(g, 0.7);
    // folds
    g.strokeStyle = 'rgba(80,90,120,0.35)'; g.lineWidth = 0.45; for (const x of back ? [-4, 0, 4] : [-5.4, 5.4]) { g.beginPath(); g.moveTo(x * 0.7, -2); g.quadraticCurveTo(x + sway * 0.4, 5, x * 1.1 + lean + sway, hemY + 1.4); g.stroke(); }
    if (!back) {
      // open at the front over the dark inside, edged in pale cloth; tiny stars twinkle in the dark
      const ox = side ? 2.2 : fx * 0.9;
      g.beginPath(); g.moveTo(ox - 1.4, -4.6); g.lineTo(ox + 1.4, -4.6); g.quadraticCurveTo(ox + 2.6, 4, ox + 3 + lean * 0.6 + sway, hemY + 0.6); g.lineTo(ox - 3 + lean * 0.6 + sway, hemY + 0.6); g.quadraticCurveTo(ox - 2.6, 4, ox - 1.4, -4.6); g.closePath();
      g.fillStyle = vfill(g, DTH.inside, -4.6, hemY, 0.15, -0.35); g.fill();
      g.save(); g.clip(); for (let i = 0; i < 4; i++) { const tw = Math.sin(time * 2.6 + i * 2.1 + seed); if (tw > 0.2) sparkle(g, ox + [-1, 1.2, -0.4, 1.6][i], [0.6, 3.6, 6.8, 9.2][i], 0.9 * tw, 'rgba(220,236,255,0.9)'); } g.restore();
      g.strokeStyle = DTH.edge; g.lineWidth = 0.6; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(ox + sx * 1.4, -4.6); g.quadraticCurveTo(ox + sx * 2.6, 4, ox + sx * 3 + lean * 0.6 + sway, hemY + 0.6); g.stroke(); }
    }
    // the rope belt, a knot with two tassels, and a little purse of gold from the piles in his house
    g.strokeStyle = OUT; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-7.6, 2.6); g.quadraticCurveTo(0, 3.8, 7.6, 2.6); g.stroke();
    g.strokeStyle = DTH.cord; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-7.6, 2.6); g.quadraticCurveTo(0, 3.8, 7.6, 2.6); g.stroke();
    if (!back) {
      const kx = side ? -3 : -2.4; ell(g, kx, 3.3, 1, 0.8); g.fillStyle = DTH.cord; g.fill(); outline(g, 0.35);
      for (const d of [-0.6, 0.7]) { g.strokeStyle = DTH.cord; g.lineWidth = 0.55; g.beginPath(); g.moveTo(kx + d * 0.6, 3.8); g.quadraticCurveTo(kx + d + sway * 0.5, 6.2, kx + d * 1.4 + sway, 8.2); g.stroke(); ell(g, kx + d * 1.4 + sway, 8.6, 0.5, 0.7); g.fillStyle = shade(DTH.cord, -0.15); g.fill(); }
      // the purse
      const px = side ? 4.2 : 4.6; g.beginPath(); g.moveTo(px - 1.6, 4); g.quadraticCurveTo(px - 2.4, 7.6, px, 7.8); g.quadraticCurveTo(px + 2.4, 7.6, px + 1.6, 4); g.closePath(); g.fillStyle = vfill(g, '#6b4a2a', 4, 8, 0.3, -0.3); g.fill(); outline(g, 0.45);
      g.strokeStyle = DTH.gold; g.lineWidth = 0.45; g.beginPath(); g.moveTo(px - 1.6, 4.4); g.lineTo(px + 1.6, 4.4); g.stroke();
      ell(g, px + 0.4, 3.6, 0.9, 0.5); g.fillStyle = DTH.gold; g.fill(); outline(g, 0.3);
      const gl = (time * 0.5 + seed + 0.5) % 1; if (gl < 0.14) sparkle(g, px + 0.8, 3.4, 1.1 * Math.sin(gl / 0.14 * Math.PI), '#fff6c8');
    }
    // the ragged shoulder cape
    const cape = () => { g.beginPath(); g.moveTo(-7.4, -4.6); g.quadraticCurveTo(-9.6, -1.6, -9.2 + sway * 0.4, 0.8); for (let i = 0; i < 5; i++) { const x0 = lerp(-9.2, 9.2, i / 5) + sway * 0.4, x1 = lerp(-9.2, 9.2, (i + 1) / 5) + sway * 0.4; g.quadraticCurveTo((x0 + x1) / 2, 2.6 + Math.sin(time * 3 + i * 2 + seed) * 0.4, x1, 0.8 + (i % 2 ? 0.4 : 0)); } g.quadraticCurveTo(9.6, -1.6, 7.4, -4.6); g.quadraticCurveTo(0, -7.2, -7.4, -4.6); g.closePath(); };
    cape(); g.fillStyle = vfill(g, DTH.cape, -6.4, 2.6, 0.3, -0.3); g.fill(); outline(g, 0.6);
    if (!back) { g.strokeStyle = DTH.edge; g.lineWidth = 0.5; const ox = side ? 2.2 : fx * 0.9; g.beginPath(); g.moveTo(ox - 1.3, -5.4); g.lineTo(ox - 1.5, 1.6); g.moveTo(ox + 1.3, -5.4); g.lineTo(ox + 1.5, 1.6); g.stroke(); }
    // the head: a deep hood with a point; it nods while he talks
    const nod = talk ? Math.sin(tt * 5.2) * 0.45 : 0, hy = -11.4 + nod, ptx = side ? -3.4 : back ? 0.6 : -1.2;
    const hood = () => { g.beginPath(); g.moveTo(-7.8, -3.6 + nod); g.quadraticCurveTo(-9.4, hy - 4, -4.4, hy - 7.4); g.quadraticCurveTo(ptx - 0.8, hy - 9.2, ptx, hy - 10.6 + sway * 0.3); g.quadraticCurveTo(ptx + 2.8, hy - 8.8, 5.4, hy - 7); g.quadraticCurveTo(9.4, hy - 3.4, 7.8, -3.6 + nod); g.quadraticCurveTo(0, -1.8 + nod, -7.8, -3.6 + nod); g.closePath(); };
    hood(); g.fillStyle = vfill(g, DTH.robe, hy - 11, -2, 0.35, -0.3); g.fill(); outline(g, 0.75);
    if (back) {
      // the seam down the back of the hood, and a fold
      g.strokeStyle = 'rgba(80,90,120,0.45)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(ptx, hy - 10.6); g.quadraticCurveTo(0.6, hy - 3, 0, -3.2 + nod); g.stroke();
      g.beginPath(); g.moveTo(-5.6, hy - 4); g.quadraticCurveTo(-4.4, hy + 1, -5.2, -4 + nod); g.stroke();
    } else {
      // the dark inside of the hood, and two round eyes glowing in it; they blink, and brighten while he talks
      const ox = side ? 2.2 : fx * 1.2;
      ell(g, ox, hy + 0.6, side ? 4.4 : 5.2, 5.8); g.fillStyle = (() => { const gr = g.createRadialGradient(ox, hy + 1.6, 0.5, ox, hy + 0.6, 6); gr.addColorStop(0, '#2a3048'); gr.addColorStop(1, '#0c0f1a'); return gr; })(); g.fill();
      g.strokeStyle = DTH.edge; g.lineWidth = 0.7; ell(g, ox, hy + 0.6, side ? 4.4 : 5.2, 5.8); g.stroke(); outline(g, 0.35);
      const blinkT = (time * 0.31 + seed * 0.7) % 1, open = blinkT < 0.04 ? 0.15 : 1, bright = 0.75 + talk * (0.25 * Math.abs(Math.sin(tt * 8)));
      const eyes = side ? [[ox + 1.3, 1], [ox - 1.6, 0.8]] : [[ox - 2, 1], [ox + 2, 1]];
      for (const [x, sc] of eyes) {
        const glw = g.createRadialGradient(x, hy, 0, x, hy, 3.4 * sc); glw.addColorStop(0, `rgba(170,225,255,${0.55 * bright})`); glw.addColorStop(1, 'rgba(170,225,255,0)'); g.fillStyle = glw; ell(g, x, hy, 3.4 * sc, 3.4 * sc); g.fill();
        ell(g, x, hy, 1.15 * sc, 1.55 * sc * open); g.fillStyle = DTH.eye; g.fill();
        if (open > 0.5) { g.fillStyle = 'rgba(255,255,255,0.95)'; ell(g, x - 0.35 * sc, hy - 0.55 * sc, 0.36 * sc, 0.36 * sc); g.fill(); }
      }
      // the hood's front edge folds back a little
      g.strokeStyle = 'rgba(80,90,120,0.4)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(ox - 6, hy + 3.4); g.quadraticCurveTo(ox - 7.2, hy - 2, ox - 3.4, hy - 6); g.stroke();
    }
    // facing us or side-on: what he holds is in front
    if (!back) { offHand(); mainHand(); }
    g.restore();
  }

  addPeople('death', { death2: dth_draw });

  // ---------- groups/dwarves-elves.js ----------
  // ================= DEEPHOLM'S DWARVES AND SYLVARIS'S ELVES: drawn in full =================
  // Dwarves (King Thrain, Brunhild the smith, Dagny, Orik, Hilde): short and broad, heads low between the shoulders,
  // great beards in plaits with iron and gold rings, big round noses, iron helms, mining and smithing gear. They are one
  // people with the monster sample's dwarf guard (mob-sample groups/people.js): the same beard, nose and riveted helm.
  // Elves (Queen Aelith, Lira the archery master, Thessaly the weaver, Faelan): tall and slender, long pointed ears,
  // leaf and vine on everything they wear, the green of the jungle and the silk of Thessaly's loom.
  // Colours come from today's look in the game (24-dwarves.js DWARVES, 25-elves.js ELVES).

  // The game draws Brunhild and Dagny with beards (it has no woman flag for them). Their names are women's names, so here
  // they are dwarf women: braids, no beard. Set this to true to give them braided beards instead, the old dwarf way.
  const DE_BEARDED_WOMEN = false;
  const DE = { iron: '#8f96a3', gold: '#e0b546', mithril: '#7aa0d0', leather: '#6b4a2a', silver: '#c8d6ee', leafGreen: '#4a8a3a' };

  // ---------- shared pieces ----------
  // a leaf: from (x, y) along angle ang, len long, w wide, with a vein (the elf sentinel's leaf)
  function de_leaf(g, x, y, len, w, ang, c) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -w, len, 0); g.quadraticCurveTo(len * 0.5, w, 0, 0); g.closePath();
    g.fillStyle = c; g.fill(); outline(g, 0.4);
    g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.3; g.beginPath(); g.moveTo(0.5, 0); g.lineTo(len - 0.7, 0); g.stroke();
    g.restore();
  }
  // a vine: a wavy stem from (x0, y0) to (x1, y1), little leaves along it
  function de_vine(g, x0, y0, x1, y1, n, c, leafC, amp) {
    const a = amp === undefined ? 1 : amp;
    g.strokeStyle = c; g.lineWidth = 0.45; g.beginPath(); g.moveTo(x0, y0);
    for (let k = 1; k <= n * 2; k++) { const t = k / (n * 2), tm = (k - 0.5) / (n * 2); g.quadraticCurveTo(lerp(x0, x1, tm) + (k % 2 ? a : -a), lerp(y0, y1, tm), lerp(x0, x1, t), lerp(y0, y1, t)); }
    g.stroke();
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, s = k % 2 ? 1 : -1; de_leaf(g, lerp(x0, x1, t), lerp(y0, y1, t), 1.9, 0.8, s > 0 ? -0.5 : Math.PI + 0.5, leafC); }
  }
  // a plait: a chain of lobes, a metal ring, a tuft (the dwarf guard's plait)
  function de_plait(g, x0, y0, x1, y1, n, c, ring, wide) {
    const w = wide || 1.45;
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t); ell(g, x, y, w - i * 0.08, (y1 - y0) / n * 0.62, i % 2 ? 0.35 : -0.35); g.fillStyle = vfill(g, c, y - 1.4, y + 1.4, 0.25, -0.28); g.fill(); outline(g, 0.4); }
    if (ring) { rr(g, x1 - 1.3, y1 - 0.3, 2.6, 1.3, 0.5); g.fillStyle = metal(g, ring, y1 - 0.3, y1 + 1); g.fill(); outline(g, 0.35); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x1 - 0.9, y1 - 0.1, 0.8, 0.35); }
    g.fillStyle = c; g.beginPath(); g.moveTo(x1 - 1.1, y1 + 0.9); g.lineTo(x1 - 0.3, y1 + 2.8); g.lineTo(x1 + 0.2, y1 + 1.6); g.lineTo(x1 + 0.8, y1 + 2.6); g.lineTo(x1 + 1.1, y1 + 0.9); g.closePath(); g.fill(); outline(g, 0.3);
  }

  // ---------- the dwarf beard: cheek to cheek, a great rounded mass, plaits below with rings; the moustache curls ----------
  // o = { c, low (how far below the head centre), plaits: [x offsets], plaitLen, ring, fork, gold beads }
  function de_beard(g, C, o) {
    const B = C.B, hy = B.hy, r = B.hr, ex = C.fx * 1.8, ey = C.fy * 1.2, bx = ex * 0.6, c = o.c, low = o.low || 9.6;
    const sway = C.step * 0.35 + Math.sin(time * 1.8 + C.seed) * 0.18, tk = C.talk ? Math.max(0, Math.sin(C.tt * 11)) : 0;
    if (C.back) {
      // from behind: the beard shows past the cheeks, the plait tips swing below the shoulders
      for (const s of [-1, 1]) { ell(g, s * (r - 0.4), hy + 5, 2.8, 3.4, s * -0.3); g.fillStyle = vfill(g, c, hy + 2, hy + 8.4); g.fill(); outline(g, 0.5); }
      return;
    }
    // the plaits, behind the beard's mass
    for (const px of o.plaits || [-2.6, 2.6]) de_plait(g, px + bx + sway * 0.4, hy + low - 2.2, px * 1.15 + bx + sway, hy + low + (o.plaitLen || 4.6), 3, c, o.ring || DE.iron, o.plaitW);
    const beard = () => {
      g.beginPath(); g.moveTo(-r + 0.2 + bx, hy - 0.2); g.quadraticCurveTo(-r - 2.6 + bx, hy + 5.4, -5 + bx + sway * 0.5, hy + low - 0.8);
      if (o.fork) { g.quadraticCurveTo(-3.4 + bx + sway, hy + low + 2.2, -1.6 + bx + sway, hy + low + 1.6); g.quadraticCurveTo(-0.4 + bx + sway, hy + low - 1.2, bx + sway, hy + low - 1.6); g.quadraticCurveTo(0.4 + bx + sway, hy + low - 1.2, 1.6 + bx + sway, hy + low + 1.6); g.quadraticCurveTo(3.4 + bx + sway, hy + low + 2.2, 5 + bx + sway * 0.5, hy + low - 0.8); }
      else { g.quadraticCurveTo(-2.6 + bx + sway, hy + low + 0.8, bx + sway, hy + low); g.quadraticCurveTo(2.6 + bx + sway, hy + low + 0.8, 5 + bx + sway * 0.5, hy + low - 0.8); }
      g.quadraticCurveTo(r + 2.6 + bx, hy + 5.4, r - 0.2 + bx, hy - 0.2); g.quadraticCurveTo(r - 1.8 + bx, hy + 3.6, 3 + bx, hy + 3.8 + tk * 0.5); g.quadraticCurveTo(bx, hy + 4.6 + tk * 0.5, -3 + bx, hy + 3.8 + tk * 0.5); g.quadraticCurveTo(-r + 1.8 + bx, hy + 3.6, -r + 0.4 + bx, hy + 0.2); g.closePath();
    };
    beard(); g.fillStyle = vfill(g, c, hy + 1, hy + low + 1, 0.22, -0.25); g.fill(); outline(g, 0.75);
    g.save(); beard(); g.clip(); g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.45; g.lineCap = 'round';
    for (const [x, y] of [[-5.6, 4.6], [-2.6, 6.4], [0, 5.6], [2.6, 6.4], [5.6, 4.6], [-4.2, 7.6], [1.2, 8.2], [4.2, 7.6], [-7, 2.6], [7, 2.6], [-2.2, 10], [2, 10.6], [-0.4, 12.4], [-3.4, 12], [3.2, 12.6], [0.8, 14.4]]) if (y < low) { g.beginPath(); g.arc(x + bx + sway * (y / low), hy + y, 1, 0.4, 2.7); g.stroke(); }
    g.strokeStyle = 'rgba(255,240,215,0.38)'; for (const [x, y] of [[-3.6, 5.2], [3.4, 5.4], [-1, 7], [1.4, 10.4]]) if (y < low - 1) { g.beginPath(); g.arc(x + bx, hy + y, 0.8, 3.6, 5.6); g.stroke(); }
    g.restore();
    // beads or rings set in the beard
    if (o.beads) for (const [x, y] of o.beads) { rr(g, x + bx - 0.9, hy + y - 0.7, 1.8, 1.4, 0.4); g.fillStyle = metal(g, o.beadC || DE.gold, hy + y - 0.7, hy + y + 0.7); g.fill(); outline(g, 0.3); }
    // the mouth, shown in the beard (it opens as they talk)
    if (o.mouth !== false) { g.fillStyle = '#4a1a14'; g.beginPath(); g.moveTo(ex - 1.5, hy + 4.4 + ey); g.quadraticCurveTo(ex, hy + 5.6 + ey + tk * 1.1, ex + 1.5, hy + 4.4 + ey); g.quadraticCurveTo(ex, hy + 4.9 + ey, ex - 1.5, hy + 4.4 + ey); g.fill(); if (o.grin) { g.fillStyle = '#fbf6e8'; g.fillRect(ex - 0.9, hy + 4.5 + ey, 1.8, 0.4); } }
    // the moustache, curling at the ends
    const mc = hex(o.must || c, -0.08);
    g.fillStyle = vfill(g, mc, hy + 2.6, hy + 5.6, 0.2, -0.25);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(ex, hy + 3 + ey); g.quadraticCurveTo(ex + s * 3.2, hy + 2.2 + ey, ex + s * 5.4, hy + 4.4 + ey); g.quadraticCurveTo(ex + s * 6.4, hy + 3.4 + ey, ex + s * 6.2, hy + 2.6 + ey); g.quadraticCurveTo(ex + s * 7.2, hy + 4.8 + ey, ex + s * 5.2, hy + 5.4 + ey); g.quadraticCurveTo(ex + s * 2.6, hy + 4.8 + ey, ex, hy + 4.2 + ey); g.closePath(); g.fill(); outline(g, 0.35); }
  }
  // the big round dwarf nose, drawn last on the face (over the moustache)
  function de_nose(g, C, c) { const B = C.B, ex = C.fx * 1.8, ey = C.fy * 1.2; if (C.back) return; ell(g, ex, B.hy + 2.5 + ey, 1.75, 1.5); g.fillStyle = rfill(g, c || '#e8907a', ex, B.hy + 2.5 + ey, 1.75); g.fill(); outline(g, 0.45); g.fillStyle = 'rgba(255,255,255,0.5)'; ell(g, ex - 0.6, B.hy + 1.9 + ey, 0.5, 0.35); g.fill(); }
  // a dwarf's two thick braids of hair, falling over the shoulders in front (dwarf women), rings at the ends
  function de_hairBraids(g, C, c, ring, beads) {
    const B = C.B, hy = B.hy, r = B.hr, sway = C.step * 0.3 + Math.sin(time * 2 + C.seed) * 0.15;
    if (C.back) { for (const s of [-1, 1]) de_plait(g, s * 3.4, hy + 3.6, s * 4.4 + sway, hy + 13.4, 4, c, ring, 1.8); return; }
    for (const s of [-1, 1]) {
      de_plait(g, s * (r - 0.8), hy + 3, s * (r + 0.4) + sway, hy + 13.6, 4, c, ring, 1.8);
      if (beads) { ell(g, s * (r - 0.4), hy + 6.4, 0.7, 0.7); g.fillStyle = beads; g.fill(); outline(g, 0.25); }
    }
  }
  // the dwarf helm (the guard's): a riveted iron dome, a dark band, a bright ridge, a gold knob, cheek guards and a nose guard
  // o = { c, nose (a nose guard), cheeks, crest, brim (a miner's brim), candle }
  function de_helm(g, C, o) {
    const B = C.B, hy = B.hy, r = B.hr, back = C.back, ex = C.fx * 1.8, c = o.c || DE.iron, rv = o.rivet || '#d9b25c';
    if (!back && o.cheeks !== false) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r + 0.6), hy - 1.4); g.lineTo(s * (r + 0.9), hy + 2.2); g.lineTo(s * (r - 1.4), hy + 3); g.lineTo(s * (r - 1.8), hy - 0.6); g.closePath(); g.fillStyle = metal(g, c, hy - 1, hy + 3); g.fill(); outline(g, 0.5); rivets(g, [[s * (r - 0.3), hy + 1.2]], rv, 0.4); }
    if (o.brim) { ell(g, ex * 0.2, hy - 1.6, r + 2.6, 1.9); g.fillStyle = metal(g, shade(c, -0.1).startsWith('#') ? c : c, hy - 3.4, hy + 0.2); g.fill(); outline(g, 0.6); }
    g.beginPath(); g.arc(0, hy - 0.8, r + 0.9, Math.PI, 0); g.closePath(); g.fillStyle = metal(g, c, hy - r - 1, hy); g.fill(); outline(g, 0.85);
    g.fillStyle = shade(c, -0.28); g.fillRect(-r - 0.9, hy - 2.6, (r + 0.9) * 2, 2); g.strokeStyle = OUT; g.lineWidth = 0.5; g.strokeRect(-r - 0.9, hy - 2.6, (r + 0.9) * 2, 2);
    rivets(g, [[-6.4, hy - 1.6], [-3.2, hy - 1.6], [0, hy - 1.6], [3.2, hy - 1.6], [6.4, hy - 1.6]], rv, 0.45);
    g.strokeStyle = shade(c, 0.6); g.lineWidth = 1.2; g.beginPath(); g.arc(0, hy - 0.8, r + 0.9, Math.PI * 1.32, Math.PI * 1.68); g.stroke();
    if (o.crest !== false) { rr(g, -1, hy - r - 2.4, 2, 2.4, 0.8); g.fillStyle = metal(g, o.knob || DE.gold, hy - r - 2.4, hy - r); g.fill(); outline(g, 0.4); g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, hy - r - 0.4); g.lineTo(0, hy - 2.6); g.stroke(); }
    if (!back && o.nose) { rr(g, -0.85 + ex * 0.7, hy - 1.2, 1.7, 3, 0.7); g.fillStyle = metal(g, c, hy - 1, hy + 1.8); g.fill(); outline(g, 0.45); }
    if (o.candle) {
      // a miner's candle stub in an iron cup on the front of the helm, its flame flickering, a soft glow round it
      const x = back ? 0 : ex * 0.5, y = hy - r + 0.6, p = Math.sin(time * 9 + C.seed) * 0.25 + Math.sin(time * 13) * 0.15;
      if (!back) { const gl = g.createRadialGradient(x, y - 4, 0, x, y - 4, 9); gl.addColorStop(0, 'rgba(255,214,120,0.45)'); gl.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = gl; ell(g, x, y - 4, 9, 9); g.fill(); }
      rr(g, x - 1.9, y - 0.6, 3.8, 1.8, 0.6); g.fillStyle = metal(g, '#6b707b', y - 0.6, y + 1.2); g.fill(); outline(g, 0.4);
      rr(g, x - 0.9, y - 3.4, 1.8, 3, 0.4); g.fillStyle = vfill(g, '#f2ead2', y - 3.4, y, 0.2, -0.15); g.fill(); outline(g, 0.35);
      g.fillStyle = 'rgba(240,230,200,0.9)'; ell(g, x + 0.7, y - 2, 0.35, 0.8); g.fill();
      ell(g, x + p * 0.4, y - 5 + p * 0.2, 0.85, 1.6 + p * 0.3); g.fillStyle = '#ffb84a'; g.fill(); ell(g, x + p * 0.3, y - 4.6, 0.4, 0.8); g.fillStyle = '#fffbe0'; g.fill();
    }
  }
  // soot or coal dust on a dwarf's face (spots: [x, y, rx, ry])
  function de_soot(g, C, spots) { if (C.back) return; const hy = C.B.hy, ex = C.fx * 1.8; g.fillStyle = 'rgba(30,24,20,0.4)'; for (const [x, y, rx, ry] of spots) { ell(g, x + ex, hy + y, rx, ry, 0.3); g.fill(); } }
  // a broad dwarf belt with a great square buckle (over a robe or tunic)
  function de_belt(g, C, c, buckle, gemC) {
    const B = C.B, w = B.w, wy = B.waist;
    rr(g, -w - 0.4, wy - 0.4, (w + 0.4) * 2, 2.4, 0.8); g.fillStyle = c; g.fill(); outline(g, 0.45);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(-w, wy - 0.2, w * 2, 0.5);
    if (C.back) return;
    rr(g, -1.8, wy - 0.8, 3.6, 3.2, 0.6); g.fillStyle = metal(g, buckle || DE.gold, wy - 0.8, wy + 2.4); g.fill(); outline(g, 0.45);
    rr(g, -1, wy, 2, 1.6, 0.3); g.fillStyle = shade(buckle || DE.gold, -0.45); g.fill();
    if (gemC) gem(g, 0, wy + 0.8, 0.75, gemC);
  }

  // ---------- dwarf props ----------
  // King Thrain's hammer of state: a long gold-bound haft, a mithril head with gold corners, a blue stone set in it
  PROPS.de_kinghammer = (g, C, o) => {
    const bot = (C.B.hip + C.B.leg) - C.B.hand.y + 0.4, top = -22;
    rr(g, -1, top + 3, 2, bot - top - 3, 0.9); g.fillStyle = vfill(g, '#6b4a2a', top, bot, 0.3, -0.3); g.fill(); outline(g, 0.45);
    for (const y of [top + 5, -6, -1.6, bot - 2]) { rr(g, -1.4, y, 2.8, 1.3, 0.5); g.fillStyle = metal(g, DE.gold, y, y + 1.3); g.fill(); outline(g, 0.3); }
    g.strokeStyle = '#3a2410'; g.lineWidth = 0.45; for (const y of [-4.2, -3, 0.4, 1.6]) { g.beginPath(); g.moveTo(-1, y); g.lineTo(1, y + 0.6); g.stroke(); }
    rr(g, -5.2, top - 2.6, 10.4, 6, 1); g.fillStyle = metal(g, DE.mithril, top - 2.6, top + 3.4); g.fill(); outline(g, 0.6);
    for (const s of [-1, 1]) { rr(g, s * 5.2 - (s > 0 ? 1.6 : 0), top - 2.8, 1.6, 6.4, 0.5); g.fillStyle = metal(g, DE.gold, top - 2.8, top + 3.6); g.fill(); outline(g, 0.35); }
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-3.4, top - 2.1, 6.4, 0.6);
    gem(g, 0, top + 0.4, 1.4, '#3a7bd5', 'rgba(140,190,255,0.55)');
    ell(g, 0, top - 4, 1.2, 1.2); g.fillStyle = rfill(g, DE.gold, 0, top - 4, 1.2); g.fill(); outline(g, 0.35);
  };
  // tongs holding a hot blade blank, glowing orange-white at the tip
  PROPS.de_hotblade = (g, C, o) => {
    const p = 0.65 + Math.sin(time * 4 + C.seed) * 0.2;
    g.save(); g.rotate(-0.12);
    const gl = g.createRadialGradient(0, -13, 0, 0, -13, 7); gl.addColorStop(0, `rgba(255,170,70,${0.55 * p})`); gl.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gl; ell(g, 0, -13, 7, 7); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-0.6, 3); g.lineTo(-1.2, -7.6); g.moveTo(0.6, 3); g.lineTo(1.2, -7.6); g.stroke(); g.strokeStyle = '#4a4f5a'; g.lineWidth = 0.85; g.stroke();
    g.fillStyle = '#4a4f5a'; ell(g, 0, -1.6, 0.8, 0.8); g.fill();
    g.beginPath(); g.moveTo(-1.3, -7); g.lineTo(-1.3, -15.6); g.lineTo(0, -17.6); g.lineTo(1.3, -15.6); g.lineTo(1.3, -7); g.closePath();
    const bl = g.createLinearGradient(0, -7, 0, -17.6); bl.addColorStop(0, '#6b5a50'); bl.addColorStop(0.45, '#d9502a'); bl.addColorStop(0.8, '#ffb040'); bl.addColorStop(1, '#fff3c0'); g.fillStyle = bl; g.fill(); outline(g, 0.45);
    for (const s of [-1, 1]) { rr(g, s * 1.4 - 0.5, -8.6, 1, 2.6, 0.3); g.fillStyle = '#3a3f4a'; g.fill(); }
    sparkle(g, 0.4, -16.6, 1.1 * p, 'rgba(255,250,220,0.9)');
    g.restore();
  };
  // a mithril bar: a pale blue ingot that shines
  PROPS.de_mithrilbar = (g, C, o) => {
    g.save(); g.rotate(-0.3);
    g.beginPath(); g.moveTo(-3.6, 2.4); g.lineTo(-2.6, -0.6); g.lineTo(2.6, -0.6); g.lineTo(3.6, 2.4); g.closePath(); g.fillStyle = metal(g, DE.mithril, -0.6, 2.4); g.fill(); outline(g, 0.45);
    g.beginPath(); g.moveTo(-2.6, -0.6); g.lineTo(-1.8, -1.8); g.lineTo(1.8, -1.8); g.lineTo(2.6, -0.6); g.closePath(); g.fillStyle = shade(DE.mithril, 0.45); g.fill(); outline(g, 0.35);
    g.restore(); sparkle(g, -1.6, -2.6, 0.9 + Math.max(0, Math.sin(time * 2.4 + C.seed)) * 0.8, 'rgba(235,245,255,0.95)');
  };
  // a lump of mithril ore: grey rock with blue veins that glint
  PROPS.de_ore = (g, C, o) => {
    g.beginPath(); g.moveTo(-3, 2.4); g.lineTo(-3.4, -0.4); g.lineTo(-1.4, -2.6); g.lineTo(1.6, -2.4); g.lineTo(3.4, -0.2); g.lineTo(2.8, 2.6); g.closePath(); g.fillStyle = rfill(g, '#6e7178', 0, 0, 3.4); g.fill(); outline(g, 0.5);
    g.strokeStyle = DE.mithril; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-2.4, 1.2); g.lineTo(-0.6, -0.4); g.lineTo(1.4, 0.2); g.moveTo(-0.4, -1.8); g.lineTo(0.6, -0.6); g.stroke();
    for (const [x, y] of [[-0.6, -0.4], [1.6, 0.4]]) { ell(g, x, y, 0.6, 0.6); g.fillStyle = '#b8d4f4'; g.fill(); }
    sparkle(g, 0.8, -1.2, Math.max(0, Math.sin(time * 3 + C.seed)) * 1.4, 'rgba(235,245,255,0.95)');
  };
  // an iron coal pail full of black lumps, hanging from its handle
  PROPS.de_coalpail = (g, C, o) => {
    const sw = C.step * 0.08 + Math.sin(time * 2 + C.seed) * 0.03; g.save(); g.rotate(sw);
    g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 4, 4, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); g.strokeStyle = '#6b707b'; g.lineWidth = 0.7; g.stroke();
    for (const [x, y, rad] of [[-2.4, 3.6, 1.5], [0, 3, 1.7], [2.4, 3.6, 1.4], [-1, 4, 1.2], [1.4, 4.2, 1.2]]) { g.beginPath(); g.moveTo(x - rad, y + 0.4); g.lineTo(x - rad * 0.4, y - rad); g.lineTo(x + rad * 0.8, y - rad * 0.6); g.lineTo(x + rad, y + 0.6); g.closePath(); g.fillStyle = rfill(g, '#2a2a30', x, y, rad); g.fill(); outline(g, 0.3); g.fillStyle = 'rgba(200,210,230,0.5)'; ell(g, x - 0.3, y - rad * 0.5, 0.35, 0.25); g.fill(); }
    const body = () => { g.beginPath(); g.moveTo(-4.6, 3.8); g.lineTo(4.6, 3.8); g.lineTo(3.8, 9.2); g.lineTo(-3.8, 9.2); g.closePath(); };
    body(); g.fillStyle = metal(g, '#5f6068', 3.8, 9.2); g.fill(); outline(g, 0.55);
    for (const y of [5.2, 8]) { g.strokeStyle = '#3a3f4a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-4.4, y); g.lineTo(4.4, y); g.stroke(); }
    rivets(g, [[-3.4, 5.2], [3.4, 5.2], [-3.1, 8], [3.1, 8]], '#a9adb5', 0.35);
    rr(g, -4.9, 3.3, 9.8, 1.1, 0.5); g.fillStyle = metal(g, '#8f96a3', 3.3, 4.4); g.fill(); outline(g, 0.35);
    g.restore();
  };
  PROP_OVER.de_coalpail = (g, C, o) => { g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.arc(0, 4, 4, Math.PI * 1.38, Math.PI * 1.62); g.stroke(); g.strokeStyle = '#6b707b'; g.lineWidth = 0.6; g.stroke(); };
  // a basket of glowing cave mushrooms
  const de_mushrooms = g => {
    const p = 0.6 + Math.sin(time * 2.2) * 0.2;
    const gl = g.createRadialGradient(0, 2, 0, 0, 2, 7); gl.addColorStop(0, `rgba(150,230,255,${0.4 * p})`); gl.addColorStop(1, 'rgba(150,230,255,0)'); g.fillStyle = gl; ell(g, 0, 2, 7, 6); g.fill();
    for (const [x, y, rad, c] of [[-2.6, 2.2, 1.9, '#5ab8c8'], [0.4, 1, 2.2, '#7ad0dc'], [2.8, 2.4, 1.7, '#c87ab8'], [-0.8, 3, 1.4, '#5ab8c8']]) {
      rr(g, x - 0.45, y, 0.9, 2.6, 0.3); g.fillStyle = '#efe6d4'; g.fill(); outline(g, 0.25);
      g.beginPath(); g.ellipse(x, y + 0.2, rad, rad * 0.75, 0, Math.PI, 0); g.closePath(); g.fillStyle = rfill(g, c, x, y - 0.4, rad); g.fill(); outline(g, 0.35);
      g.fillStyle = 'rgba(255,255,255,0.75)'; ell(g, x - rad * 0.35, y - rad * 0.35, 0.35, 0.3); g.fill(); ell(g, x + rad * 0.3, y - rad * 0.2, 0.28, 0.24); g.fill();
    }
  };

  // ---------- elf props ----------
  // Queen Aelith's living staff: pale wood that grows, a vine climbing it, leaves, a glowing seed held in curled branches
  PROPS.de_lifestaff = (g, C, o) => {
    const bot = (C.B.hip + C.B.leg) - C.B.hand.y + 0.6, top = -30, sway = Math.sin(time * 1.6 + C.seed) * 0.1;
    g.save(); g.rotate(0.04);
    g.beginPath(); g.moveTo(-0.9, bot); g.quadraticCurveTo(-1.4, (bot + top) / 2, -0.7, top + 3); g.lineTo(0.7, top + 3); g.quadraticCurveTo(1.4, (bot + top) / 2, 0.9, bot); g.closePath();
    const gr = g.createLinearGradient(-1.2, 0, 1.2, 0); gr.addColorStop(0, '#f4ecd8'); gr.addColorStop(1, '#b8a888'); g.fillStyle = gr; g.fill(); outline(g, 0.5);
    // the vine spiralling up it
    g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(0.9, bot - 2); for (let k = 0; k < 9; k++) { const y = bot - 2 - (k + 1) * ((bot - top - 6) / 9); g.quadraticCurveTo(k % 2 ? 2 : -2, y + 1.6, k % 2 ? -0.9 : 0.9, y); } g.stroke();
    for (const [y, s] of [[-2, 1], [-9, -1], [-16, 1], [-22, -1]]) de_leaf(g, s * 0.9, y, 3, 1.2, s > 0 ? -0.4 : Math.PI + 0.4, '#5aa84a');
    // curled branches cradling a seed of light
    const ty = top + 1, p = 0.6 + Math.sin(time * 2 + C.seed) * 0.25;
    const gl = g.createRadialGradient(0, ty - 2.6, 0, 0, ty - 2.6, 9); gl.addColorStop(0, `rgba(200,255,190,${0.65 * p})`); gl.addColorStop(1, 'rgba(160,255,150,0)'); g.fillStyle = gl; ell(g, 0, ty - 2.6, 9, 9); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 1.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, ty + 2); g.quadraticCurveTo(s * 4.4, ty, s * 3.2, ty - 4.4); g.quadraticCurveTo(s * 2, ty - 6.6, s * 0.6, ty - 5.6); g.stroke(); }
    g.strokeStyle = '#e4d8bc'; g.lineWidth = 0.85; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, ty + 2); g.quadraticCurveTo(s * 4.4, ty, s * 3.2, ty - 4.4); g.quadraticCurveTo(s * 2, ty - 6.6, s * 0.6, ty - 5.6); g.stroke(); }
    ell(g, 0, ty - 2.4, 1.7, 2); g.fillStyle = rfill(g, '#d8ffc8', 0, ty - 2.4, 2); g.fill(); outline(g, 0.35);
    g.fillStyle = '#ffffff'; ell(g, -0.5, ty - 3.1, 0.5, 0.6); g.fill();
    g.save(); g.translate(0, ty - 4); g.rotate(sway); de_leaf(g, 3, -1.6, 3.6, 1.4, -0.9, '#6ac05a'); de_leaf(g, -3, -1.6, 3.6, 1.4, Math.PI + 0.9, '#5aa84a'); g.restore();
    sparkle(g, 2.2, ty - 6.4, Math.max(0, Math.sin(time * 2.6 + 1)) * 1.3, 'rgba(240,255,230,0.95)');
    g.restore();
  };
  // Lira's longbow, hanging at her side unstrung-straight: carved limbs, gold nocks, a green-bound grip, leaves carved on it
  PROPS.de_longbow = (g, C, o) => {
    const len = 14.5; g.save(); g.translate(1.4, 0.6); g.lineCap = 'round';
    const limb = () => { g.beginPath(); g.moveTo(0.4, -len - 2); g.quadraticCurveTo(-0.6, -len - 0.4, 1.5, -len); g.quadraticCurveTo(8, -len * 0.7, 5.6, -len * 0.27); g.quadraticCurveTo(4.2, 0, 5.6, len * 0.27); g.quadraticCurveTo(8, len * 0.7, 1.5, len); g.quadraticCurveTo(-0.6, len + 0.4, 0.4, len + 2); };
    g.strokeStyle = OUT; g.lineWidth = 3.3; limb(); g.stroke(); g.strokeStyle = o.c || '#7a5a2a'; g.lineWidth = 2.3; limb(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(3.4, -len * 0.76); g.quadraticCurveTo(6.4, -len * 0.5, 5.4, -len * 0.3); g.stroke();
    g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.5; for (const y of [-len * 0.56, len * 0.56]) { g.beginPath(); g.moveTo(6.2, y - 1); g.lineTo(7, y + 1); g.stroke(); }
    for (const y of [-len - 2, len + 2]) { ell(g, 0.4, y, 0.95, 0.95); g.fillStyle = rfill(g, DE.gold, 0.4, y, 0.95); g.fill(); outline(g, 0.3); }
    rr(g, 3.4, -2.3, 2.9, 4.6, 0.9); g.fillStyle = '#3f7a3a'; g.fill(); outline(g, 0.35); g.strokeStyle = '#2a5a2a'; g.lineWidth = 0.4; for (const y of [-1.3, 0, 1.3]) { g.beginPath(); g.moveTo(3.4, y); g.lineTo(6.3, y + 0.5); g.stroke(); }
    g.strokeStyle = '#eef2f6'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(1.5, -len); g.lineTo(1.5, len); g.stroke();
    g.restore();
  };
  // one arrow held point-up: a leaf-shaped head, green fletching
  PROPS.de_arrow = (g, C, o) => {
    g.save(); g.rotate(0.12);
    g.strokeStyle = OUT; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, 5); g.lineTo(0, -10); g.stroke(); g.strokeStyle = '#a07a4a'; g.lineWidth = 0.7; g.stroke();
    g.beginPath(); g.moveTo(0, -14); g.quadraticCurveTo(1.6, -11.6, 0, -9.6); g.quadraticCurveTo(-1.6, -11.6, 0, -14); g.closePath(); g.fillStyle = metal(g, '#d6dee8', -14, -9.6); g.fill(); outline(g, 0.35);
    g.fillStyle = '#4a9a4a'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, 2); g.lineTo(s * 1.6, 3); g.lineTo(s * 1.4, 5.6); g.lineTo(0, 4.6); g.closePath(); g.fill(); outline(g, 0.25); }
    g.restore();
  };
  // a drop spindle hanging on its silk thread, spinning; the thread runs up to the hand
  PROPS.de_spindle = (g, C, o) => {
    const sp = time * 7 + C.seed, sw = Math.sin(time * 1.8 + C.seed) * 0.06 + C.step * 0.05;
    g.save(); g.rotate(sw);
    g.strokeStyle = '#dfe8f6'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 4.4); g.stroke();
    rr(g, -0.45, 4.2, 0.9, 7.6, 0.4); g.fillStyle = vfill(g, '#b88a52', 4, 12, 0.3, -0.3); g.fill(); outline(g, 0.3);
    // the cop of spun silk, wound on the shaft
    ell(g, 0, 6.8, 1.8, 1.9); g.fillStyle = rfill(g, '#cfe4ff', 0, 6.8, 1.9); g.fill(); outline(g, 0.35);
    g.strokeStyle = 'rgba(120,150,200,0.6)'; g.lineWidth = 0.25; for (let k = 0; k < 3; k++) { const y = 5.6 + k * 0.9; g.beginPath(); g.moveTo(-1.6, y + Math.sin(sp + k) * 0.3); g.lineTo(1.6, y + 0.6 - Math.sin(sp + k) * 0.3); g.stroke(); }
    // the whorl: a wooden disc that turns (its painted dots go round)
    ell(g, 0, 10.4, 2.8, 0.9); g.fillStyle = vfill(g, '#8a5a2b', 9.6, 11.2, 0.3, -0.3); g.fill(); outline(g, 0.35);
    for (let k = 0; k < 3; k++) { const a = sp + k * 2.09, x = Math.cos(a) * 2.1; if (Math.sin(a) > 0) { ell(g, x, 10.6, 0.35, 0.25); g.fillStyle = '#e0b546'; g.fill(); } }
    g.restore();
  };
  // a skein of pale silk, loosely twisted, an end trailing
  PROPS.de_skein = (g, C, o) => {
    const sw = Math.sin(time * 2 + C.seed) * 0.5;
    g.save(); g.rotate(-0.2);
    for (const [dx, c] of [[-1.2, '#cfe4ff'], [1.2, '#e8f2ff']]) { ell(g, dx, 2.4, 1.9, 3.6, dx * 0.12); g.fillStyle = vfill(g, c, -1, 6, 0.25, -0.2); g.fill(); outline(g, 0.4); }
    g.strokeStyle = 'rgba(120,150,200,0.55)'; g.lineWidth = 0.3; for (const y of [0.8, 2.4, 4]) { g.beginPath(); g.moveTo(-2.8, y); g.quadraticCurveTo(0, y + 0.8, 2.8, y); g.stroke(); }
    rr(g, -2.6, 1.6, 5.2, 1.1, 0.4); g.fillStyle = '#9a6ad0'; g.fill(); outline(g, 0.3);
    g.strokeStyle = '#dfe8f6'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(1.6, 5.4); g.quadraticCurveTo(3 + sw, 7.4, 2 + sw * 1.6, 9.6); g.stroke();
    g.restore();
  };
  // a glass jar of fireflies on a cord: green-gold lights drifting inside it, a glow round it
  PROPS.de_fireflies = (g, C, o) => {
    const sw = Math.sin(time * 2.2 + C.seed) * 0.08 + C.step * 0.1; g.save(); g.rotate(sw);
    const gl = g.createRadialGradient(0, 6, 0, 0, 6, 9); gl.addColorStop(0, 'rgba(220,255,140,0.38)'); gl.addColorStop(1, 'rgba(200,255,120,0)'); g.fillStyle = gl; ell(g, 0, 6, 9, 9); g.fill();
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(-1.4, 2.6); g.moveTo(0, 0); g.lineTo(1.4, 2.6); g.stroke();
    const jar = () => { g.beginPath(); g.moveTo(-1.8, 3); g.lineTo(1.8, 3); g.quadraticCurveTo(3.2, 4, 3.1, 6.4); g.quadraticCurveTo(3, 9.4, 0, 9.6); g.quadraticCurveTo(-3, 9.4, -3.1, 6.4); g.quadraticCurveTo(-3.2, 4, -1.8, 3); g.closePath(); };
    jar(); g.fillStyle = 'rgba(200,240,230,0.35)'; g.fill(); g.strokeStyle = 'rgba(30,50,40,0.6)'; g.lineWidth = 0.5; g.stroke();
    g.save(); jar(); g.clip();
    for (let k = 0; k < 5; k++) { const a = time * (0.9 + k * 0.23) + k * 1.7 + C.seed, x = Math.sin(a) * 1.9, y = 6.4 + Math.cos(a * 1.3) * 2, on = 0.5 + 0.5 * Math.sin(time * 3 + k * 2); ell(g, x, y, 0.75, 0.75); g.fillStyle = `rgba(230,255,120,${0.35 + on * 0.6})`; g.fill(); ell(g, x, y, 0.3, 0.3); g.fillStyle = '#ffffe8'; g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-2.2, 5); g.quadraticCurveTo(-2.4, 7, -1.6, 8.4); g.stroke();
    rr(g, -2.1, 2.2, 4.2, 1.3, 0.5); g.fillStyle = vfill(g, '#8a6a3a', 2.2, 3.5, 0.3, -0.3); g.fill(); outline(g, 0.35);
    de_leaf(g, 1.2, 2.6, 2.6, 1, -0.5, '#5aa84a');
    g.restore();
  };
  // a quiver of arrows: leather tube, gold leaf tooled on it, green and white fletchings out of the top
  function de_quiver(g, x, y, ang, full) {
    g.save(); g.translate(x, y); g.rotate(ang);
    for (const [dx, c] of [[-1.3, '#e9eef5'], [0, '#4a9a4a'], [1.3, '#e9eef5']]) { g.strokeStyle = '#8a6a3a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(dx, -6); g.lineTo(dx * 1.2, -9.2); g.stroke(); g.fillStyle = c; g.beginPath(); g.moveTo(dx * 1.2 - 0.9, -8.8); g.lineTo(dx * 1.2, -11.4); g.lineTo(dx * 1.2 + 0.9, -8.8); g.closePath(); g.fill(); outline(g, 0.3); }
    if (full) {
      rr(g, -2.4, -6.6, 4.8, 13, 1.6); g.fillStyle = vfill(g, DE.leather, -7, 7, 0.25, -0.3); g.fill(); outline(g, 0.6);
      g.fillStyle = '#8a6238'; g.fillRect(-2.4, -6.6, 4.8, 1.3); g.fillRect(-2.4, 3.6, 4.8, 1);
      de_leaf(g, 0, 2.2, 5.2, 1.5, -Math.PI / 2, '#d9b25c');
    }
    g.restore();
  }

  // ---------- the elves' robes: leaf-cut hems, a vine climbing the skirt ----------
  // the hem of a tunic or gown cut into hanging leaves (y = the hem, w = half its width)
  function de_leafHem(g, C, y, w, c, n) {
    const sway = C.step * 0.6 + Math.sin(time * 2 + C.seed) * 0.2, k0 = n || 6;
    for (let k = 0; k < k0; k++) { const x = -w + (k + 0.5) * (2 * w / k0) + sway * 0.4; g.beginPath(); g.moveTo(x - w / k0, y - 0.6); g.quadraticCurveTo(x - w / k0 * 0.7, y + 1.6, x + sway * 0.2, y + 2.6 + (k % 2) * 0.6); g.quadraticCurveTo(x + w / k0 * 0.7, y + 1.6, x + w / k0, y - 0.6); g.closePath(); g.fillStyle = vfill(g, hex(c, -0.08), y - 0.6, y + 3, 0.15, -0.25); g.fill(); outline(g, 0.4); g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + sway * 0.2, y + 2.2); g.stroke(); }
  }
  // leaf shoulder guards: overlapping leaves on each shoulder (the elf sentinel's, in their own colours)
  function de_leafShoulders(g, C, c) {
    const B = C.B, y = B.sh + 0.2;
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) de_leaf(g, s * (B.w - 1.6 + k * 0.5), y + k * 1.5, 5.2 - k * 0.6, 2.1, s > 0 ? 0.35 + k * 0.25 : Math.PI - 0.35 - k * 0.25, shade(c, 0.1 - k * 0.12));
  }

  addPeople('dwarves-elves', {
    // ================= DEEPHOLM =================

    // ---------- King Thrain: an old dwarf king. A broad gold crown set with mithril, a bear-fur mantle, a red robe and
    // cloak trimmed in gold, a long white beard in two great gold-ringed plaits, and his hammer of state ----------
    thrain: {
      build: 'dwarf', size: 1.02, skin: SKIN.ruddy, hand: '#e8b08a',
      face: { eye: '#2a1a10', age: 'elder', brow: '#f2eee6', browW: 1.7, browIn: 1.1, browTilt: -0.15, nose: false, mouth: 'none', blush: 'rgba(225,95,80,0.45)' },
      hair: { style: 'long', c: '#e6e0d4', len: -2 },
      body: { kind: 'robe', c: '#7a2e2e', under: '#c9a36a', edge: DE.gold, trim: DE.gold, belt: false, sleeve: '#6a2424' },
      legs: { boot: '#3a2a1c', cuff: '#8f6a3a' },
      cloak: { c: '#6a2424', lining: '#3a1414', clasp: DE.gold, trim: DE.gold },
      held: { kind: 'de_kinghammer' },
      torso: (g, C) => {
        de_belt(g, C, '#4a3020', DE.gold, '#3a7bd5');
        if (C.back) return;
        // gold knotwork down the front of the robe
        const B = C.B; g.strokeStyle = DE.gold; g.lineWidth = 0.45; for (const y of [B.waist + 3, B.waist + 5.4]) { g.beginPath(); g.moveTo(-1.4, y); g.lineTo(0, y + 1); g.lineTo(1.4, y); g.lineTo(0, y - 1); g.closePath(); g.stroke(); }
      },
      // the bear-fur mantle round his shoulders, shaggy at the edge
      collar: (g, C) => {
        const B = C.B, y0 = B.sh - 1.4, w = B.w + 2;
        const m = () => { g.beginPath(); g.moveTo(-w, y0 + 1.6); for (let k = 0; k <= 12; k++) { const t = k / 12, x = lerp(-w + 0.6, w - 0.6, t), y = y0 + 4.6 + Math.sin(t * Math.PI) * (C.back ? 2.8 : 1.6); g.lineTo(x, y + (k % 2 ? 1.3 : 0)); } g.lineTo(w, y0 + 1.6); g.quadraticCurveTo(0, y0 - 2.6, -w, y0 + 1.6); g.closePath(); };
        m(); g.fillStyle = vfill(g, '#7a5a3a', y0 - 2, y0 + 7, 0.25, -0.3); g.fill(); outline(g, 0.6);
        g.save(); m(); g.clip(); g.strokeStyle = 'rgba(40,24,12,0.55)'; g.lineWidth = 0.4; for (let k = 0; k < 14; k++) { const x = -w + 1 + k * (2 * w - 2) / 13; g.beginPath(); g.moveTo(x, y0 + 0.4 + Math.abs(x) * 0.08); g.quadraticCurveTo(x + 0.6, y0 + 3, x - 0.2, y0 + 5.6); g.stroke(); } g.strokeStyle = 'rgba(230,200,160,0.4)'; for (let k = 0; k < 7; k++) { const x = -w + 2 + k * (2 * w - 4) / 6; g.beginPath(); g.moveTo(x, y0 + 1); g.quadraticCurveTo(x - 0.4, y0 + 2.6, x + 0.2, y0 + 4); g.stroke(); } g.restore();
        if (!C.back) { for (const s of [-1, 1]) { ell(g, s * 3.2, y0 + 3, 1.3, 1.3); g.fillStyle = metal(g, DE.gold, y0 + 1.8, y0 + 4.2); g.fill(); outline(g, 0.35); } g.strokeStyle = DE.gold; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-2.2, y0 + 3.2); g.quadraticCurveTo(0, y0 + 4.4, 2.2, y0 + 3.2); g.stroke(); }
      },
      head: (g, C) => {
        de_beard(g, C, { c: '#ece6da', low: 13.4, plaits: [-2.8, 2.8], plaitLen: 5.4, ring: DE.gold, plaitW: 1.7, beads: [[-4.6, 7.4], [4.6, 7.4]], fork: true });
        de_crown(g, C);
        de_nose(g, C, '#ec9a80');
      },
    },

    // ---------- Brunhild the smith: a dwarf woman of the forge. Ginger braids with iron rings, freckles and soot, an iron
    // cap, a scorched leather apron, sleeves rolled; her hammer upright, a blade glowing hot in her tongs ----------
    brunhild: {
      build: 'dwarf', skin: SKIN.ruddy, hand: '#e8b08a',
      face: { eye: '#2a6a3a', eyes: 'happy', lash: '#3a2414', brow: '#9a4a1e', browW: 1.1, freckles: true, nose: false, mouth: 'grin', blush: 'rgba(225,95,80,0.5)' },
      hair: { style: 'short', c: '#c9843a' },
      body: { kind: 'tunic', c: '#5a4a3a', under: '#cdbfa0', collar: false, belt: '#3a2614', buckle: '#8f96a3', pouch: false, rolled: '#d9c9a8', sleeve: '#6a5a4a' },
      over: [{ kind: 'leather', c: '#7a4a26' }],
      legs: { c: '#3a3430', boot: '#2a1e16', cuff: '#5a3a22' },
      held: { kind: 'hammer', c: '#7d8087', haft: '#6b4a2a' },
      off: { kind: 'de_hotblade' },
      behind: (g, C) => {},
      head: (g, C) => {
        de_hairBraids(g, C, '#c9843a', DE.iron, '#7aa0d0');
        if (DE_BEARDED_WOMEN) de_beard(g, C, { c: '#c9843a', low: 9.6, ring: DE.iron, grin: true });
        de_helm(g, C, { c: '#8f96a3', nose: false, cheeks: false });
        de_soot(g, C, [[4.2, 2.2, 1.3, 0.7], [-3.6, -1.2, 1.2, 0.5]]);
        de_nose(g, C, '#ee9a82');
        if (!C.back && !DE_BEARDED_WOMEN) { const ex = C.fx * 1.8, ey = C.fy * 1.2, hy = C.B.hy; g.fillStyle = 'rgba(220,240,255,0.85)'; ell(g, 2.8 + ex, hy - 0.4 + ey, 0.3, 0.5); g.fill(); }
      },
      // a mithril-blue gem on a thong at her throat: the dwarves' metal
      collar: (g, C) => { if (C.back) return; const y = C.B.sh + 1.4; g.strokeStyle = '#3a2614'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-2.4, C.B.sh - 0.8); g.quadraticCurveTo(0, y + 0.6, 2.4, C.B.sh - 0.8); g.stroke(); gem(g, 0, y + 0.8, 0.9, DE.mithril); },
    },

    // ---------- Dagny the miner: dark braids under a miner's helm with a candle burning on it, a leather jerkin, coal dust
    // on her cheek, her pick standing beside her and a lump of mithril ore in her other hand ----------
    dagny: {
      build: 'dwarf', skin: '#e8b48c', hand: '#9a7a5a',
      face: { eye: '#3a2414', lash: '#2a1a10', brow: '#2a1a0a', browW: 1, browTilt: 0.15, nose: false, mouth: 'smile', lip: '#a05048', blush: 'rgba(225,100,85,0.45)' },
      hair: { style: 'short', c: '#3a2a1a' },
      body: { kind: 'tunic', c: '#8a5a2a', under: '#d9c9a8', belt: '#3a2614', buckle: '#a9adb5', pouch: '#5a3a20', sleeve: '#7a4a22', laces: true },
      over: [{ kind: 'vest', c: '#5a3a22', button: '#a9adb5' }],
      legs: { c: '#4a4036', boot: '#2a1e16', cuff: '#6b4a2a', patch: '#7a6a50' },
      held: { kind: 'tool', tool: 'pick', c: DE.mithril },
      off: { kind: 'de_ore' },
      head: (g, C) => {
        de_hairBraids(g, C, '#3a2a1a', '#b8863a');
        if (DE_BEARDED_WOMEN) de_beard(g, C, { c: '#3a2a1a', low: 9.6, ring: '#b8863a' });
        de_helm(g, C, { c: '#7d8087', nose: false, cheeks: false, crest: false, brim: true, candle: true });
        de_soot(g, C, [[-4.4, 2.4, 1.4, 0.7], [3.4, 3.6, 0.8, 0.5]]);
        de_nose(g, C, '#e8987e');
      },
      // a coil of rope over her shoulder for the ladders, and a chalk-white tally on her jerkin
      torso: (g, C) => {
        const B = C.B;
        if (C.back) { g.strokeStyle = '#b89a62'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-B.w + 1.6, B.sh); g.quadraticCurveTo(0, B.waist - 1, B.w - 1.6, B.waist + 1); g.stroke(); g.strokeStyle = 'rgba(80,60,30,0.6)'; g.lineWidth = 0.35; g.setLineDash([0.6, 0.6]); g.stroke(); g.setLineDash([]); return; }
        g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(B.w - 1.6, B.sh); g.quadraticCurveTo(0, B.waist - 1, -B.w + 1.6, B.waist + 1); g.stroke(); g.strokeStyle = '#b89a62'; g.lineWidth = 1.3; g.stroke(); g.strokeStyle = 'rgba(80,60,30,0.6)'; g.lineWidth = 0.35; g.setLineDash([0.6, 0.6]); g.stroke(); g.setLineDash([]);
        g.strokeStyle = 'rgba(240,236,220,0.75)'; g.lineWidth = 0.35; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-5.6 + k * 0.7, B.sh + 2.4); g.lineTo(-5.6 + k * 0.7, B.sh + 4); g.stroke(); } g.beginPath(); g.moveTo(-6, B.sh + 3.6); g.lineTo(-3.2, B.sh + 2.6); g.stroke();
      },
    },

    // ---------- Orik the smelter: bald and shining, smoked goggles on his brow, a great forked auburn beard with iron
    // rings, a leather apron; a pail of coal in one hand and a mithril bar in the other ("two coal each. Two.") ----------
    orik: {
      build: 'dwarf', size: 1.02, skin: SKIN.ruddy, hand: '#e8b08a',
      face: { eye: '#1e140c', brow: '#6a2a10', browW: 1.5, browIn: 1, browTilt: 0.35, nose: false, mouth: 'none', blush: 'rgba(225,95,80,0.5)' },
      hair: { style: 'bald', c: '#7a3a1a' },
      body: { kind: 'tunic', c: '#6a3a2a', under: '#cdbfa0', belt: '#3a2614', buckle: '#8f96a3', pouch: '#5a3a20', sleeve: '#5a3020', rolled: '#cdbfa0' },
      over: [{ kind: 'apron', c: '#8a6a4a', bib: true, pocket: true, stain: 'rgba(30,24,20,0.45)', pocketItem: (g, x, y) => { rr(g, x - 1.4, y - 1.4, 1.2, 2.4, 0.3); g.fillStyle = '#3a3f4a'; g.fill(); rr(g, x + 0.3, y - 1, 1, 2, 0.3); g.fillStyle = '#b8863a'; g.fill(); } }],
      legs: { c: '#3a3430', boot: '#2a1e16', cuff: '#5a3a22' },
      held: { kind: 'de_coalpail' },
      off: { kind: 'de_mithrilbar' },
      head: (g, C) => {
        de_beard(g, C, { c: '#8a3a1a', low: 12.2, fork: true, plaits: [-3.2, 3.2], plaitLen: 4, ring: DE.iron, plaitW: 1.6 });
        // smoked goggles pushed up on the brow, a leather strap round the bald head
        const B = C.B, hy = B.hy, r = B.hr, ex = C.fx * 1.8;
        g.fillStyle = '#4a3020'; g.beginPath(); g.moveTo(-r - 0.1, hy - 3); g.quadraticCurveTo(0, hy - 5.2, r + 0.1, hy - 3); g.lineTo(r, hy - 1.8); g.quadraticCurveTo(0, hy - 4, -r, hy - 1.8); g.closePath(); g.fill(); outline(g, 0.3);
        if (!C.back) for (const x of [-2.6, 2.6]) { const cx = x + ex * 0.35, cy = hy - 4.2; ell(g, cx, cy, 2.2, 2); g.fillStyle = metal(g, '#b98a3a', cy - 2, cy + 2); g.fill(); outline(g, 0.45); const gl = g.createRadialGradient(cx - 0.6, cy - 0.6, 0.2, cx, cy, 1.6); gl.addColorStop(0, '#9aa0a8'); gl.addColorStop(1, '#2a2e36'); g.fillStyle = gl; ell(g, cx, cy, 1.45, 1.3); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; ell(g, cx - 0.5, cy - 0.5, 0.4, 0.3); g.fill(); }
        else { rr(g, -1.2, hy - 3.2, 2.4, 1.6, 0.4); g.fillStyle = '#b98a3a'; g.fill(); outline(g, 0.3); }
        de_soot(g, C, [[-4.6, 1.6, 1.1, 0.6]]);
        de_nose(g, C, '#e8826a');
      },
    },

    // ---------- Hilde: a dwarf matron who has seen everything. Blond braids wound in a crown round her head with gold
    // pins, a russet dress and a knitted shawl, a basket of glowing cave mushrooms and a lantern for the dark ----------
    hilde: {
      build: 'dwarf', skin: SKIN.ruddy, hand: '#e8b08a',
      face: { eye: '#3a5a8a', lash: '#3a2414', brow: '#b8964a', browW: 0.9, eyes: 'happy', lines: true, nose: false, mouth: 'smile', lip: '#a05048', blush: 'rgba(230,100,90,0.55)' },
      hair: { style: 'short', c: '#e0c080' },
      body: { kind: 'dress', c: '#7a4a3a', under: '#efe4cc', trim: '#c9a36a', belt: '#4a3020', sleeve: '#6a3a2a', puff: true },
      over: [{ kind: 'shawl', c: '#4a6a7a' }],
      legs: { boot: '#3a2a1c' },
      held: { kind: 'basket', c: '#9a6a3a', fill: de_mushrooms },
      off: { kind: 'lantern' },
      head: (g, C) => {
        const B = C.B, hy = B.hy, r = B.hr, c = '#e0c080';
        // the braid wound round the head like a crown, gold pins in it
        g.save(); g.translate(0, hy - r + 2);
        for (let k = 0; k < 9; k++) { const t = k / 8, x = lerp(-r + 0.4, r - 0.4, t), y = -Math.sin(t * Math.PI) * 1.6; ell(g, x, y, 1.6, 1.2, k % 2 ? 0.5 : -0.5); g.fillStyle = vfill(g, c, y - 1.2, y + 1.2, 0.3, -0.25); g.fill(); outline(g, 0.35); }
        for (const x of [-3.4, 3.4]) { ell(g, x, -1.6, 0.6, 0.6); g.fillStyle = rfill(g, DE.gold, x, -1.6, 0.6); g.fill(); outline(g, 0.25); }
        g.restore();
        // and two short braids looped down behind the ears
        for (const s of [-1, 1]) de_plait(g, s * (r - 0.4), hy + (C.back ? 1 : 0.6), s * (r + 0.2), hy + 6.4, 3, c, DE.gold, 1.4);
        de_nose(g, C, '#ec9a80');
      },
    },

    // ================= SYLVARIS =================

    // ---------- Queen Aelith: tall and still. Pale gold hair to her waist, a crown of silver leaves with a green stone that
    // glows, a green gown with a gold vine climbing it and a hem of leaves, a cloak of silk, and her living staff ----------
    aelith: {
      build: 'elf', size: 1.03, skin: SKIN.elf, ears: 'elf', hand: SKIN.elf,
      face: { eye: '#2f7a3a', lash: '#3a3020', brow: '#c9b88a', browW: 0.55, mouth: 'smile', lip: '#b06a62', blush: 'rgba(230,140,140,0.35)' },
      hair: { style: 'long', c: '#f2e6b8', len: 4 },
      body: { kind: 'dress', c: '#2f6a3a', under: '#e8dcae', lace: DE.gold, belt: DE.gold, knot: false, sleeve: '#3f7a46', puff: true },
      legs: { boot: '#c9b88a' },
      cloak: { c: '#d8e6d0', lining: '#a8c4a0', clasp: '#c8d6ee', trim: '#e0b546', len: 1.2 },
      held: { kind: 'de_lifestaff' },
      torso: (g, C) => {
        const B = C.B, hem = B.hip + B.leg - 1.6;
        if (!C.back) { de_vine(g, -1.6, hem - 0.4, 0.6, B.waist + 1.6, 3, DE.gold, '#e0b546', 1.2); de_vine(g, 3.4, hem - 0.6, 2.2, B.waist + 3, 2, DE.gold, '#e0b546', 0.8); }
        de_leafHem(g, C, hem - 1.2, B.w + 2, '#2f6a3a', 7);
      },
      collar: (g, C) => { if (C.back) return; const y = C.B.sh + 0.6; g.strokeStyle = '#c8d6ee'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-2.6, C.B.sh - 0.6); g.quadraticCurveTo(0, y + 1.2, 2.6, C.B.sh - 0.6); g.stroke(); de_leaf(g, 0, y + 0.8, 2.4, 1, Math.PI / 2, '#c8d6ee'); gem(g, 0, y + 1.6, 0.6, '#5ac46a'); },
      head: (g, C) => de_leafCrown(g, C),
    },

    // ---------- Lira the archery master: copper hair in a high tail with a red feather in it, a green tunic with a leaf hem,
    // a leather chest guard and leaf shoulder guards, a quiver on her back, her longbow hanging at her side, an arrow ready ----------
    lira: {
      build: 'elf', skin: SKIN.elf, ears: 'elf', hand: '#c9a06a',
      face: { eye: '#2f6a3a', lash: '#3a2414', brow: '#8a3a1e', browW: 0.7, browTilt: -0.15, freckles: true, mouth: 'smile', lip: '#b0605a', blush: 'rgba(230,130,120,0.35)' },
      hair: { style: 'ponytail', c: '#b04a2a', tie: '#3f7a3a' },
      body: { kind: 'tunic', c: '#4a6a2a', under: '#e9dcc0', trim: false, belt: '#5a3a20', buckle: '#c8d6ee', pouch: '#6b4a2a', sleeve: '#3a5a22', collar: false },
      legs: { c: '#4a5a32', boot: '#6b4a2a', cuff: '#8a6238', w: 4 },
      held: { kind: 'de_longbow', c: '#7a5a2a' },
      off: { kind: 'de_arrow' },
      behind: (g, C) => de_quiver(g, -5, C.B.sh - 0.6 + C.bob, -0.45, false),
      torso: (g, C) => {
        const B = C.B; de_leafHem(g, C, B.hem - 0.6, B.w + 0.8, '#4a6a2a', 6);
        if (C.back) { g.strokeStyle = DE.leather; g.lineWidth = 1.4; g.beginPath(); g.moveTo(5.4, B.sh - 0.2); g.lineTo(-5.2, B.waist); g.stroke(); return; }
        // the leather chest guard laced at the side, a leaf tooled on it, the quiver strap across it
        g.beginPath(); g.moveTo(-4.6, B.sh + 0.6); g.quadraticCurveTo(0, B.sh - 0.4, 3.6, B.sh + 0.6); g.lineTo(3.4, B.waist - 0.2); g.quadraticCurveTo(-0.6, B.waist + 0.6, -4.4, B.waist - 0.2); g.closePath(); g.fillStyle = vfill(g, '#7a5230', B.sh, B.waist, 0.25, -0.3); g.fill(); outline(g, 0.5);
        de_leaf(g, -0.6, B.waist - 1.2, 4.4, 1.4, -Math.PI / 2 + 0.2, '#d9b25c');
        g.strokeStyle = '#d9c9a0'; g.lineWidth = 0.3; for (let k = 0; k < 3; k++) { const y = B.sh + 1.6 + k * 1.6; g.beginPath(); g.moveTo(3, y); g.lineTo(3.8, y + 0.8); g.stroke(); }
        g.strokeStyle = DE.leather; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-5.6, B.sh - 0.2); g.lineTo(5.2, B.waist); g.stroke(); g.strokeStyle = shade(DE.leather, 0.3); g.lineWidth = 0.35; g.beginPath(); g.moveTo(-5.4, B.sh - 0.7); g.lineTo(5.4, B.waist - 0.5); g.stroke();
      },
      collar: (g, C) => de_leafShoulders(g, C, '#6b4a2a'),
      // a red feather tucked in her hair tie, and a green band across her brow
      head: (g, C) => {
        const B = C.B, hy = B.hy, r = B.hr, ex = C.fx * 1.8;
        if (!C.back) { g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.9; g.beginPath(); g.arc(0, hy + 2.6, r + 0.1, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
        const fx0 = C.back ? 1.4 : r - 0.6, fy0 = C.back ? hy - 1.6 : hy - 2, wv = Math.sin(time * 2.6 + C.seed) * 0.15;
        g.save(); g.translate(fx0, fy0); g.rotate(0.5 + wv);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-1.4, -3.6, 0.4, -7.4); g.quadraticCurveTo(1.8, -3.6, 0, 0); g.closePath(); g.fillStyle = vfill(g, '#c0392b', -7.4, 0, 0.25, -0.2); g.fill(); outline(g, 0.35);
        g.strokeStyle = '#f2e6d0'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0.3, -6.6); g.stroke(); g.restore();
      },
    },

    // ---------- Thessaly the weaver: dark hair in a bun stuck with a silver needle, a brown dress with a woven band, an
    // apron with spools in its pocket, a scarf of her own silk that floats as if it weighs nothing; she spins as she talks ----------
    thessaly: {
      build: 'elf', skin: SKIN.elf, ears: 'elf', hand: SKIN.elf,
      face: { eye: '#5a3a7a', lash: '#2a1a10', brow: '#2a1a0a', browW: 0.6, eyes: 'happy', mouth: 'smile', lip: '#b06a62', blush: 'rgba(230,130,130,0.4)' },
      hair: { style: 'bun', c: '#3a2a1a', tie: '#9a6ad0' },
      body: { kind: 'dress', c: '#6a5a3a', under: '#efe4cc', trim: '#9a6ad0', belt: false, sleeve: '#5a4a30' },
      over: [{ kind: 'apron', c: '#e9dfc6', bib: false, w: 4, pocketItem: (g, x, y) => { for (const [dx, c] of [[-1, '#cfe4ff'], [0.9, '#9a6ad0']]) { rr(g, x + dx - 0.6, y - 1.8, 1.2, 2.2, 0.3); g.fillStyle = c; g.fill(); outline(g, 0.2); } } }],
      legs: { boot: '#6b4a2a' },
      held: { kind: 'de_spindle' },
      off: { kind: 'de_skein' },
      // the woven band round the skirt: a pattern of diamonds in her silk colours
      torso: (g, C) => {
        const B = C.B, y = B.hip + B.leg - 5.4; if (C.back) { de_silkScarf(g, C); return; }
        const sway = C.step * 0.6; g.save(); g.beginPath(); g.rect(-B.w - 4, y - 1.2, (B.w + 4) * 2, 2.6); g.clip();
        g.fillStyle = '#4a3a24'; g.fillRect(-B.w - 4, y - 1.2, (B.w + 4) * 2, 2.6);
        for (let x = -B.w - 3; x < B.w + 4; x += 2) { g.beginPath(); g.moveTo(x + sway * 0.3, y - 1); g.lineTo(x + 1 + sway * 0.3, y + 0.1); g.lineTo(x + sway * 0.3, y + 1.2); g.lineTo(x - 1 + sway * 0.3, y + 0.1); g.closePath(); g.fillStyle = Math.round(x) % 4 === 0 ? '#cfe4ff' : '#9a6ad0'; g.fill(); }
        g.restore();
      },
      collar: (g, C) => { if (!C.back) de_silkScarf(g, C); },
      // the silver needle through her bun
      head: (g, C) => {
        const B = C.B, hy = B.hy, r = B.hr, y = C.back ? hy - 2.4 : hy - r - 0.6;
        g.save(); g.translate(0, y); g.rotate(-0.5); rr(g, -4.4, -0.35, 8.8, 0.7, 0.3); g.fillStyle = metal(g, '#c8d6ee', -0.4, 0.4); g.fill(); outline(g, 0.25); ell(g, 4.6, 0, 0.8, 0.8); g.fillStyle = '#9a6ad0'; g.fill(); outline(g, 0.25); g.restore();
      },
    },

    // ---------- Faelan: a young river elf. Long fair hair tied back, a mantle of overlapping leaves, a green tunic with a
    // vine at the hem, soft boots for the light-footed river path, and a jar of fireflies to see the bridges by ----------
    faelan: {
      build: 'elf', skin: SKIN.elf, ears: 'elf', hand: SKIN.elf,
      face: { eye: '#3a6a8a', brow: '#a8965a', browW: 0.6, mouth: 'smile', lip: '#a8625a', blush: 'rgba(230,140,130,0.3)' },
      hair: { style: 'long', c: '#d9c88a', tie: '#3f7a3a' },
      body: { kind: 'tunic', c: '#3a5a2a', under: '#e9dcc0', trim: false, belt: '#5a3a20', buckle: '#c8d6ee', pouch: '#6b4a2a', sleeve: '#2f4a22', laces: true },
      legs: { c: '#5a5a3a', boot: '#8a6a42', cuff: '#a08050', w: 4 },
      held: { kind: 'de_fireflies' },
      torso: (g, C) => {
        const B = C.B; de_leafHem(g, C, B.hem - 0.6, B.w + 0.8, '#3a5a2a', 6);
        if (!C.back) de_vine(g, -B.w + 1.2, B.hem - 1.6, B.w - 1.2, B.hem - 1.4, 3, '#2a4a1e', '#7ac05a', 0.6);
      },
      // the leaf mantle round his shoulders, leaves stirring in the air
      collar: (g, C) => {
        const B = C.B, y0 = B.sh - 1, wv = Math.sin(time * 2.2 + C.seed) * 0.08;
        const cols = ['#3f7a3a', '#5a9a3a', '#4a8a3a', '#6aa84a', '#3a6a32'];
        for (let row = 1; row >= 0; row--) for (let k = 0; k < 7; k++) { const t = k / 6, x = lerp(-B.w - 0.6, B.w + 0.6, t), y = y0 + 2.2 + row * 1.8 + Math.sin(t * Math.PI) * (C.back ? 1.6 : 0.6); de_leaf(g, x, y - 2.4, 4.4 - row * 0.4, 1.7, Math.PI / 2 + (x * 0.06) + wv * (k % 2 ? 1 : -1), cols[(k + row) % 5]); }
        if (!C.back) { ell(g, 0, y0 + 1.4, 1.1, 1.1); g.fillStyle = rfill(g, '#b8863a', 0, y0 + 1.4, 1.1); g.fill(); outline(g, 0.3); }
      },
    },
  });

  // ---------- King Thrain's crown: a broad gold band with square battlements, a great mithril stone and rubies, rivets ----------
  function de_crown(g, C) {
    const B = C.B, hy = B.hy, r = B.hr, ex = C.back ? 0 : C.fx * 1.8, cy = hy - r + 3, cw = r + 0.4;
    // red velvet cap inside it
    g.beginPath(); g.moveTo(-cw + 0.8, cy - 1); g.quadraticCurveTo(0, cy - 7.4, cw - 0.8, cy - 1); g.closePath(); g.fillStyle = vfill(g, '#8a2a2a', cy - 7, cy, 0.25, -0.3); g.fill(); outline(g, 0.45);
    ell(g, 0, cy - 6.2, 0.9, 0.9); g.fillStyle = rfill(g, DE.gold, 0, cy - 6.2, 0.9); g.fill(); outline(g, 0.3);
    const band = () => { g.beginPath(); g.moveTo(-cw, cy + 2.4); g.lineTo(-cw, cy - 2.6);
      const n = 5; for (let k = 0; k < n; k++) { const x0 = lerp(-cw, cw, k / n), x1 = lerp(-cw, cw, (k + 0.55) / n), x2 = lerp(-cw, cw, (k + 1) / n); g.lineTo(x0, cy - 4.4); g.lineTo(x1, cy - 4.4); g.lineTo(x1, cy - 2.4); g.lineTo(x2, cy - 2.4); }
      g.lineTo(cw, cy - 4.4); g.lineTo(cw, cy + 2.4); g.quadraticCurveTo(0, cy + 3.4, -cw, cy + 2.4); g.closePath(); };
    band(); g.fillStyle = metal(g, '#f0c040', cy - 4.4, cy + 3); g.fill(); outline(g, 0.6);
    g.fillStyle = shade('#f0c040', -0.3); g.beginPath(); g.moveTo(-cw, cy + 1.2); g.quadraticCurveTo(0, cy + 2.2, cw, cy + 1.2); g.lineTo(cw, cy + 2.4); g.quadraticCurveTo(0, cy + 3.4, -cw, cy + 2.4); g.closePath(); g.fill();
    rivets(g, [[-cw + 1, cy - 1.4], [cw - 1, cy - 1.4], [-cw + 1, cy + 0.6], [cw - 1, cy + 0.6]], '#fff0b0', 0.35);
    if (!C.back) { gem(g, ex * 0.3, cy - 0.4, 1.6, DE.mithril, 'rgba(150,200,255,0.5)'); for (const s of [-1, 1]) gem(g, s * 4.2 + ex * 0.3, cy - 0.2, 0.9, '#c0392b'); }
    else gem(g, 0, cy - 0.4, 1, '#c0392b');
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-cw + 0.6, cy - 2.2, 2, 0.5);
  }
  // Queen Aelith's crown: a silver circlet, silver leaves rising from it, a green stone that glows
  function de_leafCrown(g, C) {
    const B = C.B, hy = B.hy, r = B.hr, ex = C.back ? 0 : C.fx * 1.8, wv = Math.sin(time * 1.4 + C.seed) * 0.04;
    g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.arc(0, hy + 2.4, r + 0.2, Math.PI * 1.17, Math.PI * 1.83); g.stroke();
    g.strokeStyle = '#d8e2f0'; g.lineWidth = 0.9; g.stroke();
    const leaves = [[-5.2, -1.2, 4.2], [-3, -0.4, 5], [0, 0, 6.2], [3, -0.4, 5], [5.2, -1.2, 4.2]];
    for (const [x, dy, len] of leaves) { const px = x + ex * 0.3, py = hy - r + 3.2 + dy + Math.abs(x) * 0.25; de_leaf(g, px, py, len, len * 0.36, -Math.PI / 2 + x * 0.12 + wv, '#dce6f2'); }
    if (!C.back) gem(g, ex * 0.4, hy - r + 3.4, 1.3, '#5ac46a', 'rgba(140,255,150,0.6)');
    sparkle(g, ex * 0.3 + 2.2, hy - r - 2.2, Math.max(0, Math.sin(time * 2.2 + 0.6)) * 1.1, 'rgba(255,255,255,0.95)');
  }
  // Thessaly's scarf of her own silk: light as air, its ends lifting and drifting as if they weigh nothing
  function de_silkScarf(g, C) {
    const B = C.B, y0 = B.sh - 0.6, t = time * 1.6 + C.seed;
    g.save(); g.globalAlpha *= 0.85;
    if (!C.back) {
      g.beginPath(); g.moveTo(-B.w + 0.4, y0 + 0.4); g.quadraticCurveTo(0, y0 + 3.4, B.w - 0.4, y0 + 0.4); g.quadraticCurveTo(0, y0 + 1.4, -B.w + 0.4, y0 + 0.4); g.closePath();
      g.fillStyle = vfill(g, '#cfe4ff', y0, y0 + 3, 0.35, -0.1); g.fill(); g.strokeStyle = 'rgba(90,110,160,0.5)'; g.lineWidth = 0.4; g.stroke();
    }
    // the two ends float up and out, rippling
    for (const s of [-1, 1]) {
      const x0 = s * (B.w - 1), y = y0 + 1, f1 = Math.sin(t + s) * 1.4, f2 = Math.cos(t * 1.2 + s) * 1.2;
      g.beginPath(); g.moveTo(x0, y); g.bezierCurveTo(x0 + s * 3, y - 2 + f1, x0 + s * 4, y + 4 + f2, x0 + s * 6.4, y + 1.6 + f1);
      g.lineTo(x0 + s * 6.8, y + 3.6 + f1); g.bezierCurveTo(x0 + s * 3.6, y + 6 + f2, x0 + s * 2.2, y + 1 + f1, x0 - s * 0.6, y + 2.4); g.closePath();
      g.fillStyle = vfill(g, '#dceaff', y - 2, y + 6, 0.35, -0.15); g.fill(); g.strokeStyle = 'rgba(90,110,160,0.5)'; g.lineWidth = 0.4; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; ell(g, x0 + s * 3.4, y + 1.6 + f1 * 0.5, 0.9, 0.3, s * 0.3); g.fill();
    }
    g.restore();
  }

  // ---------- groups/goblins-afterlands.js ----------
  // ================= GOBLIN CITY TOWNSFOLK (Grubmarket and Castle Gnash, over the Grey Sea) =================
  // Nine goblins who only talk and trade. They are the monster sample's NEW goblin (npc_goblinHead: the same long ears that
  // flick, yellow eyes with red middles, two little fangs, green skin, bare green feet), so goblins stay one species, but
  // dressed as townsfolk: goggles, a cook's hat, caps, hoods, aprons, a crown. Nobody here carries a weapon.
  // Colours come from today's look (33-goblincity.js FOLK).
  //
  // THE AFTERLANDS (35-night.js): nobody to draw. Everyone drawn there fights and is in MONSTER_DEFS (zombies, grave zombies,
  // vampires, Count Ashvane), so the monster sample owns them. The only other voices there are 'The Voice' and 'Gravestone',
  // which are words on the screen, not people.

  const GOB_SKIN = SKIN.goblin;
  // every goblin: the goblin build and head, bare green feet, green hands
  const gob_base = (P) => Object.assign({ build: 'goblin', skin: GOB_SKIN, ears: 'goblin', hand: GOB_SKIN }, P, { legs: Object.assign({ feet: GOB_SKIN }, P.legs || {}) });
  // where the head is, in the same terms npc_goblinHead uses
  const gob_H = C => ({ hy: C.B.hy, r: C.B.hr, ex: C.back ? 0 : C.fx * 1.6, ey: 0, back: C.back });

  // ---------- small shared pieces ----------
  // a rope: a dark edge, the rope colour, and a twist down its length
  function gob_rope(g, path, c, w) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    path(); g.strokeStyle = OUT; g.lineWidth = (w || 1.4) + 0.8; g.stroke();
    path(); g.strokeStyle = c; g.lineWidth = w || 1.4; g.stroke();
    path(); g.strokeStyle = shade(c, -0.35); g.lineWidth = (w || 1.4) * 0.6; g.setLineDash([0.45, 0.65]); g.stroke(); g.setLineDash([]);
  }
  // a cog: n teeth round a hub with a hole
  function gob_cog(g, x, y, r, c, n) {
    n = n || 8; g.beginPath();
    for (let k = 0; k < n * 4; k++) { const a = (k / (n * 4)) * Math.PI * 2, rad = (k >> 1) % 2 ? r * 0.76 : r; const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; k ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath(); g.fillStyle = metal(g, c, y - r, y + r); g.fill(); outline(g, 0.4);
    g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.3; g.beginPath(); g.arc(x, y, r * 0.5, 0, Math.PI * 2); g.stroke();
    ell(g, x, y, r * 0.24, r * 0.24); g.fillStyle = '#2a2420'; g.fill();
  }
  // a patch sewn on, with running stitches
  function gob_patch(g, x, y, w, h, c) { rr(g, x, y, w, h, 0.4); g.fillStyle = c; g.fill(); g.strokeStyle = 'rgba(30,20,10,0.6)'; g.lineWidth = 0.3; g.setLineDash([0.5, 0.5]); g.stroke(); g.setLineDash([]); }

  // ---------- the things they hold (the hand at 0, 0; upright is up the screen) ----------
  // Tinkerton's big spanner, standing upright, open jaw at the top
  PROPS.gob_spanner = (g, C, o) => {
    const c = o.c || '#8f96a3';
    rr(g, -0.9, -12.6, 1.8, 15.8, 0.8); g.fillStyle = metal(g, c, -12, 3); g.fill(); outline(g, 0.45);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-0.5, -11.6, 0.4, 13);
    const jaw = () => { g.beginPath(); g.arc(0, -14.6, 2.3, -Math.PI / 2 + 0.75, -Math.PI / 2 - 0.75 + Math.PI * 2); };
    g.lineCap = 'butt'; jaw(); g.strokeStyle = OUT; g.lineWidth = 2.7; g.stroke(); jaw(); g.strokeStyle = shade(c, 0.15); g.lineWidth = 1.9; g.stroke();
    ell(g, 0, 3.6, 1.5, 1.5); g.fillStyle = metal(g, c, 2, 5); g.fill(); outline(g, 0.4); ell(g, 0, 3.6, 0.6, 0.6); g.fillStyle = '#2a2420'; g.fill();
    g.fillStyle = 'rgba(30,24,20,0.5)'; ell(g, 0.3, -6, 0.6, 1.2); g.fill();
  };
  // a brass gear wheel
  PROPS.gob_gear = (g, C, o) => { const spin = Math.sin(time * 0.8) * 0.15; g.save(); g.translate(0.4, -0.6); g.rotate(spin); gob_cog(g, 0, 0, 3.3, o.c || '#c9a040', 8); g.restore(); };
  // Grubb's wooden ladle, a drip of green soup on it
  PROPS.gob_ladle = (g, C, o) => {
    rr(g, -0.7, -12.6, 1.4, 16, 0.6); g.fillStyle = vfill(g, '#a07a4a', -12, 3, 0.3, -0.3); g.fill(); outline(g, 0.4);
    ell(g, 0, -14.6, 2.7, 2.1); g.fillStyle = rfill(g, '#a07a4a', 0, -14.6, 2.7); g.fill(); outline(g, 0.5);
    ell(g, 0, -15.2, 1.9, 1.1); g.fillStyle = '#8ab83a'; g.fill();
    const d = (time * 0.7) % 1; ell(g, 1.6, -12.8 + d * 3, 0.45, 0.6 + d * 0.2); g.fillStyle = `rgba(138,184,58,${1 - d})`; g.fill();
  };
  // a bowl of goblin soup, steaming, a fish tail sticking out (do not ask what is in it)
  PROPS.gob_soup = (g, C, o) => {
    g.save(); g.translate(0, -4.2);
    for (let k = 0; k < 3; k++) { const t = (time * 0.6 + k / 3) % 1, x = -1.6 + k * 1.6 + Math.sin(time * 2 + k) * 0.5; g.strokeStyle = `rgba(255,255,255,${0.55 * (1 - t)})`; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, -1 - t * 5); g.quadraticCurveTo(x + 0.8, -2 - t * 5, x, -3 - t * 5); g.stroke(); }
    // the fish tail
    g.save(); g.translate(2, -1.4); g.rotate(0.5 + Math.sin(time * 3) * 0.08); g.beginPath(); g.moveTo(0, 1); g.lineTo(-1.2, -2.2); g.lineTo(0, -1.4); g.lineTo(1.2, -2.2); g.closePath(); g.fillStyle = '#7a9ab0'; g.fill(); outline(g, 0.3); g.restore();
    ell(g, 0, -0.2, 3.6, 1); g.fillStyle = '#7aa83a'; g.fill(); ell(g, -1.2, -0.3, 0.6, 0.35); g.fillStyle = '#c9e07a'; g.fill(); ell(g, 1, 0, 0.4, 0.3); g.fill();
    g.beginPath(); g.moveTo(-3.8, -0.2); g.quadraticCurveTo(-3.6, 3.6, 0, 3.8); g.quadraticCurveTo(3.6, 3.6, 3.8, -0.2); g.quadraticCurveTo(0, 0.8, -3.8, -0.2); g.closePath();
    g.fillStyle = vfill(g, '#8a5a2b', -0.2, 3.8, 0.3, -0.3); g.fill(); outline(g, 0.5);
    g.strokeStyle = '#5a3a1e'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-3.2, 1.4); g.quadraticCurveTo(0, 2.4, 3.2, 1.4); g.stroke();
    g.restore();
  };
  // Nix's tin bucket of scrap: a gear wheel, a bent pipe and a spring over the rim
  PROPS.gob_bucket = (g, C, o) => {
    const sw = C.step * 0.08 + Math.sin(time * 2 + C.seed) * 0.03; g.save(); g.rotate(sw);
    g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 6.2, 6.2, Math.PI * 1.17, Math.PI * 1.83); g.stroke(); g.strokeStyle = '#8f96a3'; g.lineWidth = 0.8; g.stroke();
    g.translate(0, 2);
    // the scrap
    g.save(); g.translate(-2.4, 2.6); g.rotate(0.4); rr(g, -0.6, -3, 1.2, 4.4, 0.4); g.fillStyle = metal(g, '#b8863a', -3, 1.4); g.fill(); outline(g, 0.3); rr(g, -0.6, -3.6, 3, 1.2, 0.4); g.fill(); outline(g, 0.3); g.restore();
    gob_cog(g, 1.4, 2.2, 2.4, '#c9ccd3', 7);
    g.strokeStyle = '#6b707b'; g.lineWidth = 0.5; g.beginPath(); for (let k = 0; k <= 8; k++) { const y = 3.4 - k * 0.5; g.lineTo(3.8 + (k % 2 ? 0.8 : -0.4), y); } g.stroke();
    const body = () => { g.beginPath(); g.moveTo(-4.6, 3.6); g.lineTo(4.6, 3.6); g.lineTo(3.8, 9.4); g.lineTo(-3.8, 9.4); g.closePath(); };
    body(); g.fillStyle = (() => { const gr = g.createLinearGradient(-4.6, 0, 4.6, 0); gr.addColorStop(0, '#c9ccd3'); gr.addColorStop(0.4, '#9aa0aa'); gr.addColorStop(1, '#5b606b'); return gr; })(); g.fill(); outline(g, 0.55);
    g.strokeStyle = '#4a4f5a'; g.lineWidth = 0.4; for (const y of [5.6, 7.6]) { g.beginPath(); g.moveTo(-4.3, y); g.lineTo(4.3, y); g.stroke(); }
    g.fillStyle = 'rgba(110,60,30,0.5)'; ell(g, 2.4, 8.2, 1, 0.6); g.fill();
    rr(g, -5, 3, 10, 1.2, 0.5); g.fillStyle = metal(g, '#a9adb5', 3, 4.2); g.fill(); outline(g, 0.35);
    g.restore();
  };
  PROP_OVER.gob_bucket = (g, C, o) => { g.strokeStyle = OUT; g.lineWidth = 1.1; g.beginPath(); g.arc(0, 6.2, 6.2, Math.PI * 1.38, Math.PI * 1.62); g.stroke(); g.strokeStyle = '#8f96a3'; g.lineWidth = 0.6; g.stroke(); };
  // a big horseshoe magnet, red with bright tips, a nut stuck to one of them (for sorting iron from the rest)
  PROPS.gob_magnet = (g, C, o) => {
    const u = () => { g.beginPath(); g.arc(0, -3.2, 2.6, Math.PI, 0, true); g.lineTo(2.6, -7.6); g.moveTo(-2.6, -3.2); g.lineTo(-2.6, -7.6); };
    g.lineCap = 'butt'; u(); g.strokeStyle = OUT; g.lineWidth = 2.6; g.stroke(); u(); g.strokeStyle = '#c8302a'; g.lineWidth = 1.8; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 0.4; g.beginPath(); g.arc(0, -3.2, 2.4, Math.PI * 0.9, Math.PI * 0.6, true); g.stroke();
    for (const x of [-2.6, 2.6]) { rr(g, x - 0.95, -9.4, 1.9, 1.9, 0.3); g.fillStyle = metal(g, '#c9ccd3', -9.4, -7.5); g.fill(); outline(g, 0.3); }
    const j = Math.sin(time * 9) > 0.8 ? 0.2 : 0; ell(g, 2.6 + j, -10.4, 0.8, 0.8); g.fillStyle = metal(g, '#8f96a3', -11.2, -9.6); g.fill(); outline(g, 0.25); ell(g, 2.6 + j, -10.4, 0.3, 0.3); g.fillStyle = '#2a2420'; g.fill();
  };
  // Old Snaggle's driftwood stick: grey, twisted, a turn of old rope near the top
  const gob_driftTop = (g, top) => {
    g.beginPath(); g.moveTo(-1, top + 2.6); g.quadraticCurveTo(-3.2, top + 0.4, -2.2, top - 1.6); g.quadraticCurveTo(-0.6, top - 0.6, 0.2, top - 2.4); g.quadraticCurveTo(1.8, top - 0.4, 1.2, top + 2.6); g.closePath();
    g.fillStyle = vfill(g, '#a8a090', top - 2.4, top + 2.6, 0.25, -0.3); g.fill(); outline(g, 0.45);
    gob_rope(g, () => { g.beginPath(); g.moveTo(-1.3, top + 5); g.lineTo(1.3, top + 5.6); g.moveTo(-1.3, top + 6.2); g.lineTo(1.3, top + 6.8); }, '#c9a46a', 0.7);
    g.strokeStyle = '#c9a46a'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(1.2, top + 6.6); g.quadraticCurveTo(2.2, top + 8, 1.6 + Math.sin(time * 2) * 0.3, top + 9.6); g.stroke();
  };
  // a lumpy straw pillow, straw poking out of a split seam (he wants spider silk for it)
  PROPS.gob_pillow = (g, C, o) => {
    g.save(); g.translate(0.4, 1.6); g.rotate(-0.25);
    const p = () => { g.beginPath(); g.moveTo(-4.2, -2.2); g.quadraticCurveTo(0, -3.2, 4.2, -2.2); g.quadraticCurveTo(5, 0, 4.2, 2.2); g.quadraticCurveTo(0, 3.2, -4.2, 2.2); g.quadraticCurveTo(-5, 0, -4.2, -2.2); g.closePath(); };
    p(); g.fillStyle = vfill(g, '#d9c9a0', -3, 3, 0.25, -0.3); g.fill(); outline(g, 0.5);
    g.strokeStyle = '#a89870'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-3.4, 0.4); g.quadraticCurveTo(0, 1.2, 3.4, 0.2); g.stroke();
    g.strokeStyle = '#e0b84a'; g.lineWidth = 0.35; for (const [x, a] of [[1.6, -0.6], [2.2, 0.1], [2.8, -0.3], [-3.6, -1.2], [-4, -2.4]]) { g.beginPath(); g.moveTo(x, -2); g.lineTo(x + Math.cos(a - 1.2) * 2, -2 + Math.sin(a - 1.2) * 2); g.stroke(); }
    for (const [x, y] of [[-4.2, -2.2], [4.2, -2.2], [4.2, 2.2], [-4.2, 2.2]]) { ell(g, x, y, 0.6, 0.5); g.fillStyle = '#b8a070'; g.fill(); }
    g.restore();
  };
  // Pip-squeak's buzzing coil from the scrap yard: copper wound on a spool, sparks jumping off the top
  PROPS.gob_coil = (g, C, o) => {
    rr(g, -2.4, -1.2, 4.8, 1.6, 0.5); g.fillStyle = vfill(g, '#8a5a2b', -1.2, 0.4); g.fill(); outline(g, 0.35);
    rr(g, -1.7, -7, 3.4, 5.9, 0.8); g.fillStyle = (() => { const gr = g.createLinearGradient(-1.7, 0, 1.7, 0); gr.addColorStop(0, '#f0b070'); gr.addColorStop(0.5, '#c87a3a'); gr.addColorStop(1, '#7a4420'); return gr; })(); g.fill(); outline(g, 0.4);
    g.strokeStyle = '#7a4420'; g.lineWidth = 0.3; for (let y = -6.4; y < -1.4; y += 0.7) { g.beginPath(); g.moveTo(-1.7, y + 0.3); g.lineTo(1.7, y); g.stroke(); }
    rr(g, -2.2, -7.8, 4.4, 1.1, 0.4); g.fillStyle = vfill(g, '#8a5a2b', -7.8, -6.7); g.fill(); outline(g, 0.3);
    ell(g, 0, -8.8, 1.1, 1.1); g.fillStyle = rfill(g, '#c9ccd3', 0, -8.8, 1.1); g.fill(); outline(g, 0.3);
    // the buzz: a flicker of little lightning, never still
    const k = Math.floor(time * 12) % 4;
    g.strokeStyle = 'rgba(255,245,170,0.95)'; g.lineWidth = 0.45; g.beginPath();
    const pts = [[[0.8, -9.4], [2.4, -10.4], [1.8, -11], [3.4, -12]], [[-0.8, -9.4], [-2.2, -10], [-1.6, -10.8], [-3.2, -11.4]], [[0.4, -9.8], [0.2, -11.2], [1, -11.8], [0.6, -13]], [[-0.6, -9.6], [-1.4, -11], [-0.6, -11.6], [-1.6, -12.8]]];
    for (const [i, pp] of [[k, pts[k]], [(k + 2) % 4, pts[(k + 2) % 4]]]) { g.moveTo(...pp[0]); for (const q of pp.slice(1)) g.lineTo(...q); } g.stroke();
    sparkle(g, k % 2 ? 2.6 : -2.4, -11.4, 1, 'rgba(255,250,200,0.95)');
  };
  // King Gnash's sack of gold: fat, tied with gold cord, coins peeking out of the neck
  PROPS.gob_moneybag = (g, C, o) => {
    const sw = C.step * 0.08 + Math.sin(time * 2 + C.seed) * 0.03; g.save(); g.rotate(sw);
    for (const [x, y] of [[-1, 0.4], [0.9, 0.1], [0, -0.4]]) { ell(g, x, y, 1.3, 0.6); g.fillStyle = metal(g, '#f0c040', y - 0.6, y + 0.6); g.fill(); outline(g, 0.3); }
    const sack = () => { g.beginPath(); g.moveTo(-1.4, 1.2); g.quadraticCurveTo(-2.6, 2.4, -4.4, 5.6); g.quadraticCurveTo(-5, 9.6, 0, 9.8); g.quadraticCurveTo(5, 9.6, 4.4, 5.6); g.quadraticCurveTo(2.6, 2.4, 1.4, 1.2); g.closePath(); };
    sack(); g.fillStyle = vfill(g, '#a8844a', 1, 10, 0.3, -0.35); g.fill(); outline(g, 0.55);
    g.strokeStyle = '#7a5a2a'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-2.4, 3.6); g.quadraticCurveTo(-3.4, 6, -2.6, 8.8); g.moveTo(1.6, 3.2); g.quadraticCurveTo(2.8, 6, 2.2, 8.8); g.stroke();
    // a gold crown daubed on it: the king's own
    g.fillStyle = '#f0c040'; g.beginPath(); g.moveTo(-1.6, 7.2); g.lineTo(-1.8, 5); g.lineTo(-0.8, 6); g.lineTo(0, 4.6); g.lineTo(0.8, 6); g.lineTo(1.8, 5); g.lineTo(1.6, 7.2); g.closePath(); g.fill(); g.strokeStyle = 'rgba(80,50,10,0.6)'; g.lineWidth = 0.3; g.stroke();
    gob_rope(g, () => { g.beginPath(); g.moveTo(-1.8, 1.8); g.quadraticCurveTo(0, 2.6, 1.8, 1.8); }, '#e0b546', 0.7);
    g.strokeStyle = '#e0b546'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(1.2, 2.2); g.quadraticCurveTo(2.4, 3.6, 2, 4.6); g.stroke();
    sparkle(g, -0.6, -0.2, 0.9 + Math.max(0, Math.sin(time * 3)) * 0.8, 'rgba(255,250,220,0.95)');
    g.restore();
  };
  // one gold coin, turning in his fingers, catching the light
  PROPS.gob_coin = (g, C, o) => {
    const t = Math.cos(time * 2.6), w = Math.max(0.35, Math.abs(t));
    g.save(); g.translate(0.6, -2.2); g.scale(w, 1);
    ell(g, 0, 0, 2.2, 2.2); g.fillStyle = metal(g, '#f0c040', -2.2, 2.2); g.fill(); outline(g, 0.45);
    g.strokeStyle = '#b8862a'; g.lineWidth = 0.35; g.beginPath(); g.arc(0, 0, 1.5, 0, Math.PI * 2); g.stroke();
    if (w > 0.6) { g.fillStyle = '#b8862a'; g.beginPath(); g.moveTo(-0.9, 0.7); g.lineTo(-1, -0.6); g.lineTo(-0.4, 0); g.lineTo(0, -0.9); g.lineTo(0.4, 0); g.lineTo(1, -0.6); g.lineTo(0.9, 0.7); g.closePath(); g.fill(); }
    g.restore();
    if (t > 0.9) sparkle(g, -0.2, -3.4, 1.4, 'rgba(255,252,220,0.95)');
  };
  // Skritch's jar of trinkets: buttons, a tooth, a little key, behind glass with a cork
  PROPS.gob_jar = (g, C, o) => {
    const jar = () => rr(g, -2.8, -0.6, 5.6, 7.2, 1.5);
    jar(); g.fillStyle = 'rgba(200,232,240,0.35)'; g.fill();
    g.save(); jar(); g.clip();
    for (const [x, y, c] of [[-1.6, 5.4, '#c0392b'], [0, 5.8, '#3a7bd5'], [1.6, 5.2, '#f0c040'], [-0.8, 4.2, '#5ac46a'], [1, 3.8, '#e9eef5'], [-1.8, 3.2, '#9a6ad0'], [1.8, 2.6, '#e08a3a']]) { ell(g, x, y, 0.85, 0.75); g.fillStyle = c; g.fill(); g.fillStyle = 'rgba(0,0,0,0.35)'; ell(g, x - 0.2, y, 0.12, 0.12); g.fill(); ell(g, x + 0.2, y, 0.12, 0.12); g.fill(); }
    g.fillStyle = '#fbf6e8'; g.beginPath(); g.moveTo(-0.4, 1.4); g.lineTo(0.4, 1.4); g.lineTo(0, 3); g.closePath(); g.fill(); outline(g, 0.2);
    g.fillStyle = GOLD; g.fillRect(0.6, 1.2, 1.8, 0.35); ell(g, 0.5, 1.35, 0.45, 0.45); g.fill();
    g.restore();
    jar(); g.strokeStyle = 'rgba(40,60,70,0.7)'; g.lineWidth = 0.5; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-2, 0.6); g.lineTo(-2, 5); g.stroke();
    rr(g, -2, -2.2, 4, 1.8, 0.5); g.fillStyle = vfill(g, '#b8864a', -2.2, -0.4); g.fill(); outline(g, 0.35);
  };
  // a single shiny button held up to the light
  PROPS.gob_button = (g, C, o) => {
    ell(g, 0.4, -2.2, 1.5, 1.5); g.fillStyle = rfill(g, '#4aa0d0', 0.4, -2.2, 1.5); g.fill(); outline(g, 0.35);
    g.fillStyle = '#1a3a50'; for (const [x, y] of [[-0.1, -2.6], [0.9, -2.6], [-0.1, -1.7], [0.9, -1.7]]) { ell(g, x, y, 0.2, 0.2); g.fill(); }
    sparkle(g, -0.6, -3.2, 0.8 + Math.max(0, Math.sin(time * 2.4)) * 1, 'rgba(255,255,255,0.95)');
  };
  // a big spotted toadstool from Mudge's patch
  PROPS.gob_toadstool = (g, C, o) => {
    rr(g, -0.9, -4.2, 1.8, 4.6, 0.7); g.fillStyle = vfill(g, '#efe6d0', -4, 0.4, 0.2, -0.2); g.fill(); outline(g, 0.35);
    g.beginPath(); g.moveTo(-3.4, -3.8); g.quadraticCurveTo(-3.2, -7.4, 0, -7.6); g.quadraticCurveTo(3.2, -7.4, 3.4, -3.8); g.quadraticCurveTo(0, -3, -3.4, -3.8); g.closePath(); g.fillStyle = vfill(g, '#c8302a', -7.6, -3.2, 0.25, -0.25); g.fill(); outline(g, 0.45);
    g.fillStyle = '#fbf6e8'; for (const [x, y, r] of [[-1.6, -5.6, 0.55], [0.6, -6.6, 0.5], [2, -4.8, 0.45], [-0.2, -4.6, 0.4]]) { ell(g, x, y, r, r * 0.85); g.fill(); }
    g.fillStyle = 'rgba(110,70,40,0.55)'; ell(g, 0.4, 0.2, 1.2, 0.4); g.fill();
  };
  // a basket of mushrooms: red toadstools and little brown caps, with the dirt still on
  const gob_mushrooms = g => {
    for (const [x, y, c, r] of [[-3, 3.4, '#8a5a2b', 1.5], [3, 3.2, '#8a5a2b', 1.4], [-1, 2.8, '#c8302a', 1.9], [1.6, 2.4, '#c8302a', 1.7], [0.2, 3.6, '#d9b88a', 1.4]]) {
      g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x - r, y - r * 1.3, x, y - r * 1.3); g.quadraticCurveTo(x + r, y - r * 1.3, x + r, y); g.closePath(); g.fillStyle = vfill(g, c, y - r * 1.3, y, 0.25, -0.2); g.fill(); outline(g, 0.35);
      if (c === '#c8302a') { g.fillStyle = '#fbf6e8'; ell(g, x - r * 0.35, y - r * 0.75, 0.35, 0.3); g.fill(); ell(g, x + r * 0.4, y - r * 0.55, 0.3, 0.25); g.fill(); }
    }
  };
  // Ratchet's coil of rope, hanging from the hand, a frayed end swinging
  PROPS.gob_ropecoil = (g, C, o) => {
    const sw = C.step * 0.08 + Math.sin(time * 2 + C.seed) * 0.04; g.save(); g.rotate(sw);
    for (let k = 0; k < 4; k++) { const dx = (k - 1.5) * 0.5; gob_rope(g, () => { ell(g, dx, 4.4 + k * 0.2, 3.6 - k * 0.15, 3.8, 0); }, k % 2 ? '#c9a46a' : '#b8935a', 0.9); }
    gob_rope(g, () => { g.beginPath(); g.moveTo(2.6, 7.4); g.quadraticCurveTo(3.4 + sw * 6, 10, 2.4 + sw * 10, 11.6); }, '#c9a46a', 0.9);
    g.strokeStyle = '#e0c48a'; g.lineWidth = 0.3; for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(2.4 + sw * 10, 11.6); g.lineTo(2.4 + sw * 10 + Math.sin(a) * 1, 12.8); g.stroke(); }
    g.restore();
  };
  PROP_OVER.gob_ropecoil = (g, C, o) => gob_rope(g, () => { g.beginPath(); g.moveTo(-1.6, 0.6); g.quadraticCurveTo(0, -0.8, 1.6, 0.6); }, '#c9a46a', 0.9);

  // ---------- head pieces ----------
  // tufts of hair that stick out (Tinkerton's singed white frizz, Pip-squeak's buzzed-up shock)
  function gob_tuft(g, x, y, s, c, n, len) {
    g.beginPath(); g.moveTo(x - 1.4 * s, y + 1);
    for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.5 + s * 0.4, l = len * (k % 2 ? 0.75 : 1); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.lineTo(x + Math.cos(a + 0.25) * l * 0.35, y + Math.sin(a + 0.25) * l * 0.35); }
    g.lineTo(x + 1.4 * s, y + 1); g.closePath(); g.fillStyle = vfill(g, c, y - len, y + 1, 0.3, -0.2); g.fill(); outline(g, 0.4);
  }
  // a puff of frizzy hair: overlapping curls (Tinkerton's singed white frizz)
  function gob_frizz(g, x, y, s, c) {
    const pts = [[0, 0, 1.3], [s * 1.3, -0.9, 1.1], [s * 0.2, -1.7, 1.05], [s * 1.7, 0.7, 0.95], [s * -0.6, 0.9, 0.9]];
    for (const [dx, dy, r] of pts) { ell(g, x + dx, y + dy, r + 0.35, r + 0.35); g.fillStyle = OUT; g.fill(); }
    for (const [dx, dy, r] of pts) { ell(g, x + dx, y + dy, r, r); g.fillStyle = rfill(g, c, x + dx, y + dy, r); g.fill(); }
    g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.3; for (const [dx, dy, r] of pts) { g.beginPath(); g.arc(x + dx, y + dy, r * 0.5, 0.3, 2.6); g.stroke(); }
  }
  // sleepy lids over the goblin's eyes (Old Snaggle)
  function gob_lids(g, C, skin) {
    const { hy, ex } = gob_H(C); g.fillStyle = shade(skin, -0.12);
    for (const s of [-1, 1]) { const x = s * 2.9 + ex; g.beginPath(); g.ellipse(x, hy - 0.5, 2.1, 1.25, 0, Math.PI, 0); g.closePath(); g.fill(); g.strokeStyle = shade(skin, -0.5); g.lineWidth = 0.45; g.beginPath(); g.moveTo(x - 2, hy - 0.5); g.quadraticCurveTo(x, hy + 0.1, x + 2, hy - 0.5); g.stroke(); }
  }
  // rosy cheeks
  function gob_blush(g, C, a) { const { hy, ex } = gob_H(C); g.fillStyle = `rgba(220,80,70,${a || 0.35})`; for (const s of [-1, 1]) { ell(g, s * 4.4 + ex, hy + 2, 1.5, 0.9); g.fill(); } }

  addPeople('goblins-afterlands', {
    // ---------- Tinkerton: the inventor who builds the Gnasher. Brass goggles pushed up on a leather cap, singed white frizz,
    // a scorched leather apron with a screwdriver and pencil in the pocket, a big spanner, a brass gear wheel ----------
    tinkerton: gob_base({
      face: { kind: true, smile: true },
      hat: { kind: 'goggles', c: '#c9a040', cap: '#5a3a22', lens: '#4f88b0' },
      body: { kind: 'tunic', c: '#6a5a8a', under: '#e9dcc0', belt: '#3a2614', buckle: '#c9a040', pouch: false, sleeve: '#7a6a9a', rolled: '#d9c9a8' },
      over: [{ kind: 'leather', c: '#7a5a3a' }],
      legs: { c: '#4a3a4a', patch: '#8a7a9a' },
      held: { kind: 'gob_spanner', c: '#8f96a3' },
      off: { kind: 'gob_gear', c: '#c9a040' },
      head: (g, C) => {
        const { hy, r, ex } = gob_H(C);
        for (const s of [-1, 1]) gob_frizz(g, s * (r - 0.2), hy - 2.4, s, '#eeeae2');
        if (C.back) return;
        // soot on his cheek and nose from the last explosion
        g.fillStyle = 'rgba(30,26,24,0.45)'; ell(g, 4.6 + ex, hy + 1.8, 1.6, 0.9, 0.4); g.fill(); ell(g, -3.4 + ex, hy - 2.4, 1.2, 0.5, -0.2); g.fill();
        // a pencil behind his ear
        g.save(); g.translate(7.6, hy - 4.6); g.rotate(-0.42); rr(g, -2.6, -0.45, 5.2, 0.9, 0.3); g.fillStyle = '#e8c040'; g.fill(); outline(g, 0.3); g.fillStyle = '#efd9b0'; g.beginPath(); g.moveTo(2.6, -0.45); g.lineTo(3.8, 0); g.lineTo(2.6, 0.45); g.closePath(); g.fill(); g.fillStyle = '#d98aa0'; g.fillRect(-2.6, -0.45, 0.8, 0.9); g.restore();
      },
      torso: (g, C) => {
        if (C.back) return; const y0 = C.B.sh;
        // a screwdriver and a pencil stuck in the apron's pocket
        g.save(); g.translate(-2.6, y0 + 2.4); g.rotate(-0.2); rr(g, -0.35, -3.2, 0.7, 3.2, 0.2); g.fillStyle = '#c9ccd3'; g.fill(); outline(g, 0.25); rr(g, -0.6, -4.8, 1.2, 2, 0.4); g.fillStyle = '#b0302c'; g.fill(); outline(g, 0.3); g.restore();
        rr(g, -4.2, y0 + 1.8, 3.4, 2.6, 0.5); g.fillStyle = vfill(g, '#6a4a2a', y0 + 1.8, y0 + 4.4); g.fill(); outline(g, 0.35);
        g.strokeStyle = 'rgba(255,220,180,0.4)'; g.lineWidth = 0.3; g.setLineDash([0.5, 0.5]); rr(g, -3.9, y0 + 2.1, 2.8, 2, 0.4); g.stroke(); g.setLineDash([]);
      },
    }),

    // ---------- Grubb the cook: big and round, a tall cook's hat, a stained white apron, a curled moustache, rosy from the stove,
    // a wooden ladle dripping soup, a steaming bowl with a fish tail in it, a striped cloth over his shoulder ----------
    grubb: gob_base({
      size: 1.15, geo: { w: 9.2, gap: 4, lw: 5.4, hand: { x: 11.6, y: 4.6 } },
      face: { kind: true, smile: true },
      beard: { style: 'moustache', c: '#2a1a0a' },
      hat: { kind: 'chef', c: '#f4f2ea' },
      body: { kind: 'tunic', c: '#8a3a2a', under: '#efe4cc', belt: false, sleeve: '#9a4a3a', rolled: '#efe4cc' },
      over: [{ kind: 'apron', c: '#f2ede0', w: 5.8, stain: 'rgba(120,150,50,0.55)', pocketItem: (g, x, y) => { rr(g, x - 1.6, y - 2.4, 0.8, 3, 0.3); g.fillStyle = '#a07a4a'; g.fill(); outline(g, 0.25); ell(g, x - 1.2, y - 2.8, 0.9, 0.7); g.fill(); outline(g, 0.25); } }],
      legs: { c: '#4a3020' },
      held: { kind: 'gob_ladle' },
      off: { kind: 'gob_soup' },
      head: (g, C) => { if (C.back) return; gob_blush(g, C, 0.4); const { hy, ex } = gob_H(C); g.fillStyle = 'rgba(220,240,255,0.85)'; ell(g, -4.6 + ex, hy - 3.4, 0.4, 0.6); g.fill(); },
      // the round belly pushing the apron out
      torso: (g, C) => { if (C.back) return; const wy = C.B.waist; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.6; g.beginPath(); g.arc(0, wy + 1.4, 4.4, Math.PI * 1.15, Math.PI * 1.5); g.stroke(); },
      // a striped cloth over one shoulder
      collar: (g, C) => {
        const B = C.B, x = C.back ? B.w - 3 : -B.w - 0.2, y0 = B.sh - 1.4, len = C.back ? 8.4 : 7.2, sw = C.step * 0.3;
        g.save(); g.beginPath(); g.moveTo(x, y0); g.lineTo(x + 3.2, y0); g.lineTo(x + 3.2 + sw, y0 + len); g.lineTo(x + sw, y0 + len); g.closePath(); g.fillStyle = vfill(g, '#f2ede0', y0, y0 + len, 0.2, -0.2); g.fill(); outline(g, 0.45);
        g.clip(); g.strokeStyle = '#b0302c'; g.lineWidth = 0.55; for (const y of [y0 + 1.8, y0 + 3, y0 + len - 1.4]) { g.beginPath(); g.moveTo(x - 1, y); g.lineTo(x + 5, y); g.stroke(); } g.restore();
        g.strokeStyle = '#e8e0d0'; g.lineWidth = 0.3; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x + 0.4 + k * 0.8 + sw, y0 + len); g.lineTo(x + 0.4 + k * 0.8 + sw * 1.4, y0 + len + 0.9); g.stroke(); }
      },
    }),

    // ---------- Nix the scrapper: a cap, a brass eyeglass over one eye for sizing up scrap, a patched grey tunic, an oily leather
    // apron, a tin bucket of scrap with his best gear wheel on top, a horseshoe magnet in the other hand ----------
    nix: gob_base({
      face: { smile: true },
      hat: { kind: 'cap', c: '#3a3a44' },
      body: { kind: 'tunic', c: '#4a4a52', under: '#c9c0aa', belt: '#3a2614', buckle: '#8f96a3', pouch: false, sleeve: '#5a5a64' },
      over: [{ kind: 'leather', c: '#5a4a3a', scorch: [[-2.6, 7.4, 1.1], [2.4, 3, 0.8], [3.2, 8.4, 0.9]] }],
      legs: { c: '#3a3a3a', patch: '#6a5a4a' },
      held: { kind: 'gob_bucket' },
      off: { kind: 'gob_magnet' },
      head: (g, C) => {
        if (C.back) { const { hy, r } = gob_H(C); g.strokeStyle = '#3a2614'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-r + 0.2, hy - 1.6); g.quadraticCurveTo(0, hy - 0.6, r - 0.2, hy - 1.6); g.stroke(); return; }
        const { hy, r, ex } = gob_H(C), x = 2.9 + ex, y = hy - 0.6;
        // the eyeglass: a brass ring and a lens that catches the light, on a strap round the head
        g.strokeStyle = '#3a2614'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(x + 2.2, y - 0.6); g.quadraticCurveTo(r - 0.4, y - 1.8, r + 0.2, y - 1.2); g.moveTo(x - 2.2, y - 0.8); g.quadraticCurveTo(-0.4 + ex, y - 2.4, -r + 0.2, y - 1.6); g.stroke();
        ell(g, x, y, 2.3, 2.3); g.fillStyle = 'rgba(180,220,240,0.35)'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke(); g.strokeStyle = '#c9a040'; g.lineWidth = 0.9; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.35; g.beginPath(); g.arc(x, y, 1.5, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
      },
      torso: (g, C) => {
        if (C.back) { gob_patch(g, -4.6, -1.4, 2.6, 2.4, '#6a6a72'); return; }
        gob_patch(g, -6.4, C.B.waist + 1.8, 2.2, 2, '#6a6a72');
        // a string of nuts and washers on the belt
        for (let k = 0; k < 4; k++) { const x = 4.2 + k * 0.9, y = C.B.waist + 2.4 + Math.sin(k + time * 2) * 0.15 + k * 0.5; ell(g, x, y, 0.6, 0.6); g.fillStyle = metal(g, '#a9adb5', y - 0.6, y + 0.6); g.fill(); outline(g, 0.25); ell(g, x, y, 0.22, 0.22); g.fillStyle = '#2a2420'; g.fill(); }
      },
    }),

    // ---------- Old Snaggle: an old sailor who was on the ship that hit Ironclad Isle. A hood, a long white beard, sleepy lids,
    // one crooked tooth sticking up, a gold ring in his ear, an old sea coat over a striped shirt, a driftwood stick, and
    // the straw pillow he wants to swap for silk ----------
    snaggle: gob_base({
      skin: '#6aa848', hand: '#6aa848', legs: { c: '#3a3a30', feet: '#6aa848', patch: '#5a5a3a' },
      face: { kind: true, white: '#ecd88a', eye: '#a8301f' },
      beard: { style: 'long', c: '#e6e2da', len: 1 },
      hat: { kind: 'hood', c: '#4a5a3a', point: 2 },
      body: { kind: 'coat', c: '#4a5a3a', under: '#e6dcc4', belt: '#4a3020', buckle: '#8f96a3', pouch: false, button: '#a89870', sleeve: '#55664a' },
      held: { kind: 'staff', c: '#a8a090', len: 20, top: gob_driftTop },
      off: { kind: 'gob_pillow' },
      head: (g, C) => {
        const { hy, ex } = gob_H(C);
        // a gold ring in his ear (the sailor's)
        g.strokeStyle = OUT; g.lineWidth = 0.9; g.beginPath(); g.arc(-8.6, hy - 1.6, 1, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#f0c040'; g.lineWidth = 0.5; g.stroke();
        if (C.back) return;
        gob_lids(g, C, '#6aa848');
        // the snaggle tooth: one big crooked fang poking up out of the beard
        g.fillStyle = '#f2ead6'; g.beginPath(); g.moveTo(ex + 1.1, hy + 5.6); g.lineTo(ex + 1.9, hy + 3.2); g.lineTo(ex + 2.5, hy + 5.6); g.closePath(); g.fill(); outline(g, 0.3);
        // lines on his old brow
        g.strokeStyle = shade('#6aa848', -0.35); g.lineWidth = 0.35; g.beginPath(); g.moveTo(-1.8 + ex, hy - 4.2); g.quadraticCurveTo(ex, hy - 4.6, 1.8 + ex, hy - 4.2); g.stroke();
      },
      // the striped sailor's shirt in the open front of the coat, and a patch on the coat
      torso: (g, C) => {
        const B = C.B, y0 = B.sh, hem = B.hem + 2.4;
        if (C.back) { gob_patch(g, 1.2, B.waist + 1.4, 2.8, 2.6, '#6a6a4a'); return; }
        g.save(); g.beginPath(); g.moveTo(-1.6, y0 + 0.2); g.lineTo(-2.2, hem + 1); g.lineTo(2.2, hem + 1); g.lineTo(1.6, y0 + 0.2); g.closePath(); g.clip();
        g.strokeStyle = '#2e4a7a'; g.lineWidth = 0.6; for (let y = y0 + 1.4; y < hem + 1; y += 1.3) { g.beginPath(); g.moveTo(-3, y); g.lineTo(3, y); g.stroke(); } g.restore();
        gob_patch(g, 3.4, B.waist + 2.2, 2.6, 2.4, '#6a6a4a');
      },
    }),

    // ---------- Pip-squeak: the little one. A cap too big for him pushed back, his hair standing straight up from the buzzing coil
    // he found in the scrap yard (it still sparks), a slingshot in his belt, patched knees ----------
    pipsqueak: gob_base({
      build: 'child', geo: { hand: { x: 9.4, y: 4.4 } },
      face: { kind: true, smile: true },
      hat: { kind: 'cap', c: '#7a4a2a' },
      body: { kind: 'tunic', c: '#c89a4a', under: '#efe4cc', belt: '#6b4a2a', buckle: '#c9ccd3', pouch: false, sleeve: '#d9aa5a' },
      legs: { c: '#6a5030', patch: '#9a7a4a' },
      held: { kind: 'gob_coil' },
      // the hair, standing on end out of the top of the cap and round its edge; a spark jumps in it now and then
      head: (g, C) => {
        const { hy, r } = gob_H(C), c = '#4a2e1a';
        gob_tuft(g, 0.6, hy - r - 0.2, 1, c, 5, 4.2);
        for (const s of [-1, 1]) gob_tuft(g, s * (r - 0.8), hy - 2.8, s, c, 3, 2.6);
        const k = Math.floor(time * 5) % 6; if (k < 2) sparkle(g, k ? 2.6 : -1.6, hy - r - 3.4, 1.1, 'rgba(255,245,170,0.95)');
      },
      torso: (g, C) => {
        if (C.back) return; const wy = C.B.waist;
        // a slingshot tucked in his belt
        g.save(); g.translate(-4.2, wy + 0.4); g.rotate(-0.3); g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 2.4); g.lineTo(0, -0.4); g.lineTo(-1.2, -2.6); g.moveTo(0, -0.4); g.lineTo(1.2, -2.6); g.stroke(); g.strokeStyle = '#8a5a2b'; g.lineWidth = 0.9; g.stroke(); g.strokeStyle = '#b0302c'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-1.2, -2.6); g.quadraticCurveTo(0, -1.4, 1.2, -2.6); g.stroke(); g.restore();
      },
    }),

    // ---------- King Gnash: fat and pleased with himself. A gold crown a size too small and slipping, a red cape with a scruffy rat-fur
    // mantle, a gold chain with a coin on it, a tunic straining at the buttons (one has popped), two tusks and a gold tooth,
    // a sack of gold in one hand and a coin turning in the other ----------
    gnash: gob_base({
      size: 1.18, geo: { w: 9.6, gap: 4.2, lw: 5.6, hand: { x: 12, y: 4.8 } },
      face: { smile: true, white: '#f6e27a' },
      body: { kind: 'tunic', c: '#7a2e2e', under: '#e0b546', trim: '#e0b546', belt: '#3a2010', buckle: '#f0c040', pouch: false, sleeve: '#8a3a3a' },
      // the chain of office lies over the fur mantle, so it is drawn in collar() below
      legs: { c: '#3a1e1e', feet: undefined, boot: '#7a2e2e', cuff: '#f0c040' },
      cloak: { c: '#6a1e24', lining: '#a8303a', clasp: '#f0c040', trim: '#f0c040' },
      held: { kind: 'gob_moneybag' },
      off: { kind: 'gob_coin' },
      // the tunic strains over his belly: gold buttons, one popped off and hanging by a thread
      torso: (g, C) => {
        if (C.back) return; const y0 = C.B.sh, wy = C.B.waist;
        g.strokeStyle = shade('#7a2e2e', -0.4); g.lineWidth = 0.4; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.6, wy - 2.4); g.quadraticCurveTo(s * 2.4, wy - 1.6, s * 3.6, wy - 2.6); g.stroke(); }
        for (const y of [wy - 2.2, wy + 3.2]) { ell(g, 0, y, 0.6, 0.6); g.fillStyle = metal(g, '#f0c040', y - 0.6, y + 0.6); g.fill(); outline(g, 0.25); }
        g.strokeStyle = '#e0d0b0'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(0, wy - 0.2 + 0.2); g.quadraticCurveTo(0.6, wy + 0.8, 0.4 + Math.sin(time * 3) * 0.3, wy + 1.6); g.stroke();
        ell(g, 0.4 + Math.sin(time * 3) * 0.3, wy + 1.9, 0.5, 0.5); g.fillStyle = metal(g, '#f0c040', wy + 1.4, wy + 2.4); g.fill(); outline(g, 0.2);
      },
      // a scruffy mantle of grey rat fur round his shoulders, ragged at the edge, little dark tails in it
      collar: (g, C) => {
        const y0 = C.B.sh - 1.2, w = C.B.w + 1.2;
        const m = () => { g.beginPath(); g.moveTo(-w, y0 + 1); g.quadraticCurveTo(-w - 0.6, y0 + 4.2, -w + 2.2, y0 + 5); for (let k = 1; k <= 8; k++) { const x = -w + 2.2 + k * (2 * w - 4.4) / 8; g.lineTo(x - (2 * w - 4.4) / 16, (C.back ? y0 + 6.8 : y0 + 6) + (k % 2 ? 0.9 : 0.2) - Math.abs(x) * 0.08); g.lineTo(x, y0 + 5 + (C.back ? 0.8 : 0.4) - Math.abs(x) * 0.06); } g.quadraticCurveTo(w + 0.6, y0 + 4.2, w, y0 + 1); g.quadraticCurveTo(0, y0 - 2.6, -w, y0 + 1); g.closePath(); };
        m(); g.fillStyle = vfill(g, '#a09888', y0 - 2, y0 + 7, 0.3, -0.2); g.fill(); outline(g, 0.6);
        g.save(); m(); g.clip(); g.strokeStyle = '#6a6458'; g.lineWidth = 0.35; for (let x = -w + 1; x < w; x += 1.3) { g.beginPath(); g.moveTo(x, y0 + 0.6); g.lineTo(x + 0.4, y0 + 2); g.stroke(); }
        g.strokeStyle = '#3a342c'; g.lineWidth = 0.5; for (const [x, y] of [[-6.6, 2.6], [-2.6, 4], [1.6, 3.4], [5.8, 2.8]]) { g.beginPath(); g.moveTo(x, y0 + y - 1); g.quadraticCurveTo(x + 1, y0 + y, x + 0.4, y0 + y + 1.4); g.stroke(); } g.restore();
        if (!C.back) npc_over(g, C, { kind: 'chain', c: '#f0c040', medal: (g, x, y) => { g.fillStyle = '#b8862a'; g.beginPath(); g.moveTo(x - 1, y + 0.8); g.lineTo(x - 1.1, y - 0.6); g.lineTo(x - 0.4, y); g.lineTo(x, y - 1); g.lineTo(x + 0.4, y); g.lineTo(x + 1.1, y - 0.6); g.lineTo(x + 1, y + 0.8); g.closePath(); g.fill(); } });
      },
      head: (g, C) => {
        const H = gob_H(C), { hy, r, ex } = H;
        if (!C.back) {
          // two tusks from the bottom jaw, and one gold tooth up top
          g.fillStyle = '#efe6d0'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.2 + ex - 0.7, hy + 4.2); g.quadraticCurveTo(s * 3.5 + ex, hy + 1.6, s * 4 + ex + 0.3, hy + 1.2); g.lineTo(s * 3.6 + ex + 0.7, hy + 4.2); g.closePath(); g.fill(); outline(g, 0.3); }
          g.fillStyle = '#f0c040'; g.beginPath(); g.moveTo(1.9 + ex - 0.7, hy + 3.4); g.lineTo(1.9 + ex, hy + 5.1); g.lineTo(1.9 + ex + 0.7, hy + 3.5); g.closePath(); g.fill(); g.strokeStyle = '#8a6a1a'; g.lineWidth = 0.25; g.stroke();
          sparkle(g, 2.2 + ex, hy + 3.9, 0.6 + Math.max(0, Math.sin(time * 2.2)) * 0.7, 'rgba(255,252,220,0.95)');
        }
        // the crown, too small for his big head, slipped over to one side
        g.save(); g.translate(0, hy - r + 2); g.rotate(0.2); g.scale(0.82, 0.82); g.translate(0, -(hy - r + 2) - 0.6);
        npc_hat(g, C, H, { kind: 'crown', c: '#f0c040', gem: '#2e9a4a', gem2: '#c0392b', velvet: '#8a1e2a' });
        g.restore();
      },
    }),

    // ---------- Mudge: grows mushrooms and grumbles about the ferry price. A knitted cap, a coin pouch on his belt, mud on his
    // legs and feet, a basket of mushrooms, and the best red toadstool held up to show you ----------
    mudge: gob_base({
      face: {},
      hat: { kind: 'wool', c: '#8a6a3a', rim: '#6a4a2a', bobble: '#c8302a' },
      body: { kind: 'tunic', c: '#5a6a4a', under: '#d9c9a0', belt: '#4a3020', buckle: '#8f96a3', pouch: '#7a5230', sleeve: '#6a7a5a', laces: true },
      legs: { c: '#5a4a32', patch: '#7a6a4a' },
      held: { kind: 'basket', c: '#a07a4a', fill: gob_mushrooms },
      off: { kind: 'gob_toadstool' },
      // a grumpy downturned mouth line and mud splashed up his legs
      head: (g, C) => { if (C.back) return; const { hy, ex } = gob_H(C); g.strokeStyle = shade(GOB_SKIN, -0.5); g.lineWidth = 0.4; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.8 + ex, hy + 3.2); g.lineTo(s * 4.4 + ex, hy + 4.4); g.stroke(); } },
      after: (g, C) => {
        g.fillStyle = 'rgba(90,60,30,0.75)';
        for (const [x, y, r] of [[-4.4, 10.6, 1.1], [-2.6, 11.4, 0.7], [3.4, 10.2, 0.9], [4.6, 11.4, 0.6], [-3.2, 8.8, 0.5], [2.2, 9.2, 0.45], [0.6, 8.6, 0.4]]) { ell(g, x + (x < 0 ? -1 : 1) * C.step * 0.4, y + (x < 0 ? -C.step : C.step) * 1.8 * (x < 0 ? -1 : 1) * 0.5, r, r * 0.8); g.fill(); }
      },
    }),

    // ---------- Skritch: collects trinkets, buttons and teeth (not for sale, just for looking at). A plum hood, a canvas apron with
    // little pockets and buttons sewn all over it, a necklace of teeth and buttons, a jar of treasures, a blue button held up ----------
    skritch: gob_base({
      face: { kind: true, white: '#f6e27a' },
      hat: { kind: 'hood', c: '#5a3450' },
      body: { kind: 'tunic', c: '#7a4a6a', under: '#d9c9b0', belt: '#3a2614', buckle: '#c9a040', pouch: false, sleeve: '#8a5a7a' },
      over: [{ kind: 'apron', c: '#c9b48a', pocket: false, bib: true, w: 4.8 }],
      legs: { c: '#4a3040', patch: '#7a5a6a' },
      held: { kind: 'gob_jar' },
      off: { kind: 'gob_button' },
      torso: (g, C) => {
        if (C.back) return; const B = C.B, wy = B.waist;
        // two pockets, and buttons sewn on anywhere there is room
        for (const x of [-3.2, 1]) { rr(g, x, wy + 1.8, 2.4, 2.2, 0.5); g.fillStyle = shade('#c9b48a', -0.12); g.fill(); g.strokeStyle = shade('#c9b48a', -0.45); g.lineWidth = 0.3; g.setLineDash([0.5, 0.4]); g.stroke(); g.setLineDash([]); }
        for (const [x, y, c] of [[-2.2, B.sh + 2.6, '#c0392b'], [1.4, B.sh + 3.4, '#3a7bd5'], [-0.4, B.sh + 5, '#f0c040'], [2.6, wy + 5.6, '#5ac46a'], [-2.4, wy + 5.4, '#9a6ad0'], [0.2, wy + 6.4, '#e08a3a']]) { ell(g, x, y, 0.65, 0.65); g.fillStyle = c; g.fill(); outline(g, 0.2); g.fillStyle = 'rgba(0,0,0,0.4)'; ell(g, x - 0.18, y, 0.12, 0.12); g.fill(); ell(g, x + 0.18, y, 0.12, 0.12); g.fill(); }
        // a tooth peeking out of one pocket
        g.fillStyle = '#fbf6e8'; g.beginPath(); g.moveTo(1.8, wy + 1.9); g.lineTo(2.6, wy + 1.9); g.lineTo(2.2, wy + 0.6); g.closePath(); g.fill(); outline(g, 0.2);
      },
      // the necklace: teeth and buttons on a string, round under the chin
      collar: (g, C) => {
        if (C.back) { g.strokeStyle = '#8a6a3a'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-4, C.B.sh - 1.2); g.quadraticCurveTo(0, C.B.sh - 0.2, 4, C.B.sh - 1.2); g.stroke(); return; }
        const y0 = C.B.sh - 0.6; g.strokeStyle = '#8a6a3a'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-4.4, y0 - 0.6); g.quadraticCurveTo(0, y0 + 4.6, 4.4, y0 - 0.6); g.stroke();
        for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7, x = lerp(-3.8, 3.8, t), y = y0 - 0.4 + Math.sin(t * Math.PI) * 2.5;
          if (k % 2) { g.fillStyle = '#fbf6e8'; g.beginPath(); g.moveTo(x - 0.45, y); g.lineTo(x + 0.45, y); g.lineTo(x, y + 1.5); g.closePath(); g.fill(); outline(g, 0.2); }
          else { ell(g, x, y + 0.4, 0.55, 0.55); g.fillStyle = ['#c0392b', '#f0c040', '#3a7bd5', '#5ac46a'][k / 2]; g.fill(); outline(g, 0.2); } }
      },
    }),

    // ---------- Ratchet: sells rope (nobody buys rope; he has a lot of rope). A blue cap, a bushy grey beard, a great coil of rope
    // slung across his body and another hanging from his hand ----------
    ratchet: gob_base({
      face: { kind: true },
      beard: { style: 'full', c: '#cfc6b4' },
      hat: { kind: 'cap', c: '#2e3e5e' },
      body: { kind: 'tunic', c: '#4a5a7a', under: '#d9c9a0', belt: '#5a3a20', buckle: '#8f96a3', pouch: false, sleeve: '#5a6a8a', rolled: '#d9c9a0' },
      legs: { c: '#3a3a44', patch: '#5a5a6a' },
      held: { kind: 'gob_ropecoil' },
      // the coil across his body: over one shoulder, round under the other arm
      torso: (g, C) => {
        const B = C.B, s = C.back ? -1 : 1;
        for (let k = 0; k < 3; k++) gob_rope(g, () => { g.beginPath(); g.moveTo(-s * (B.w - 0.8) + k * 0.6 * s, B.sh - 1.4 + k * 0.4); g.quadraticCurveTo(-s * 1 + k * 0.4 * s, B.waist - 3, s * (B.w - 0.6), B.waist + 1.2 + k * 0.6); }, k % 2 ? '#b8935a' : '#c9a46a', 1);
      },
    }),
  });

  // ---------- groups/hollowford.js ----------
  // ================= HOLLOWFORD, THE REBUILD, THE GUILD AND THE FERRY =================
  // Old Tam, Nell and Pip (the three who hid in the chapel crypt), Hob and Wenna (who came back down the road when the
  // hammering started), and the sea folk: Old Harl the ferryman and Salt Pete of Gull Isle.
  // Hollowford folk are survivors who rebuilt their town: patched, practical clothes and the tools of the rebuild, and a
  // touch of Hollowford red (the guild's colour). Colours come from today's look in the game.
  // Helpers here are prefixed hf_. New held things are PROPS.hf_* (drawn with the hand at 0, 0, upright meaning -y).

  const HF_RED = '#7a2e2e';

  // ---------- small shared pieces ----------
  // a sewn-on patch: a square of other cloth with running stitches round it
  function hf_patch(g, x, y, w, h, c, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0);
    rr(g, -w / 2, -h / 2, w, h, 0.45); g.fillStyle = vfill(g, c, -h / 2, h / 2, 0.18, -0.2); g.fill(); g.strokeStyle = 'rgba(30,20,10,0.55)'; g.lineWidth = 0.3; g.stroke();
    g.strokeStyle = 'rgba(240,226,190,0.75)'; g.lineWidth = 0.28; g.setLineDash([0.5, 0.45]); rr(g, -w / 2 + 0.4, -h / 2 + 0.4, w - 0.8, h - 0.8, 0.3); g.stroke(); g.setLineDash([]);
    g.restore();
  }
  // draw a piece in the legs' own frame (legs do not bob), only below a line (so it stays under a tunic's hem)
  function hf_belowHem(g, C, hemY, fn) {
    g.save(); g.translate(0, -C.bob); g.beginPath(); g.rect(-30, hemY, 60, 40); g.clip(); fn(); g.restore();
  }
  const hf_leg = (C, s) => ({ x: s * C.B.gap, y: C.B.hip + C.step * 1.8 * s });
  const hf_ground = C => C.B.hip + C.B.leg - C.B.hand.y;

  // ---------- Old Tam's things: a red guild scarf, spectacles, a walking stick, the guild's ledger, the chest keys ----------
  // a knitted scarf in Hollowford red, wrapped once, one tail hanging down the front (down the back facing away)
  function hf_scarf(g, C, c, stripe) {
    const B = C.B, y = B.sh - 1.4, sw = C.step * 0.6 + Math.sin(time * 2 + C.seed) * 0.3;
    const tx = C.back ? 2.8 : -4.4;
    const tail = () => { g.beginPath(); g.moveTo(tx - 1.5, y + 1.4); g.lineTo(tx + 1.5, y + 1.6); g.quadraticCurveTo(tx + 1.9 + sw * 0.4, y + 6, tx + 1.7 + sw, y + 10.2); g.lineTo(tx - 1.5 + sw, y + 10.2); g.quadraticCurveTo(tx - 1.8 + sw * 0.4, y + 6, tx - 1.5, y + 1.4); g.closePath(); };
    tail(); g.fillStyle = vfill(g, c, y, y + 10, 0.22, -0.3); g.fill(); outline(g, 0.55);
    g.save(); tail(); g.clip(); g.fillStyle = stripe; g.fillRect(tx - 3 + sw, y + 6.6, 6, 0.7); g.fillRect(tx - 3 + sw, y + 8, 6, 0.7);
    g.strokeStyle = shade(c, -0.32); g.lineWidth = 0.3; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(tx + k, y + 1.6); g.quadraticCurveTo(tx + k + sw * 0.4, y + 6, tx + k * 1.05 + sw, y + 10.2); g.stroke(); } g.restore();
    g.strokeStyle = c; g.lineWidth = 0.45; for (let k = -1.2; k <= 1.25; k += 0.6) { g.beginPath(); g.moveTo(tx + k + sw, y + 10); g.lineTo(tx + k * 1.15 + sw * 1.3, y + 11.6); g.stroke(); }
    // the wrap round the neck
    const wrap = () => { g.beginPath(); g.moveTo(-5.2, y - 0.4); g.quadraticCurveTo(0, y - 2.4, 5.2, y - 0.4); g.quadraticCurveTo(5.8, y + 1.8, 4.4, y + 2.6); g.quadraticCurveTo(0, y + 3.8, -4.4, y + 2.6); g.quadraticCurveTo(-5.8, y + 1.8, -5.2, y - 0.4); g.closePath(); };
    wrap(); g.fillStyle = vfill(g, c, y - 2, y + 3.4, 0.3, -0.25); g.fill(); outline(g, 0.6);
    g.save(); wrap(); g.clip(); g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.3; for (let x = -4.8; x < 5; x += 1.1) { g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x + 0.3, y + 3.6); g.stroke(); } g.restore();
  }
  // round wire spectacles on the nose, the arms back to the ears
  function hf_specs(g, C, c) {
    if (C.back) { g.strokeStyle = c; g.lineWidth = 0.4; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (C.B.hr - 0.2), C.B.hy - 0.6); g.lineTo(s * (C.B.hr - 1.4), C.B.hy + 0.4); g.stroke(); } return; }
    const hy = C.B.hy, r = C.B.hr, ex = C.fx * 1.8, ey = C.fy * 1.2;
    for (const s of [-1, 1]) {
      const x = s * 2.6 + ex, y = hy + 0.8 + ey;
      ell(g, x, y, 1.7, 1.5); g.fillStyle = 'rgba(225,240,255,0.22)'; g.fill();
      g.strokeStyle = OUT; g.lineWidth = 0.85; g.stroke(); g.strokeStyle = c; g.lineWidth = 0.45; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.3; g.beginPath(); g.arc(x - 0.2, y - 0.1, 1.05, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
      g.strokeStyle = c; g.lineWidth = 0.4; g.beginPath(); g.moveTo(x + s * 1.7, y - 0.4); g.lineTo(s * (r - 0.4) + ex * 0.2, hy + 0.1); g.stroke();
    }
    g.strokeStyle = c; g.lineWidth = 0.45; g.beginPath(); g.moveTo(ex - 0.95, hy + 0.5 + ey); g.quadraticCurveTo(ex, hy - 0.3 + ey, ex + 0.95, hy + 0.5 + ey); g.stroke();
  }
  // a crook-handled walking stick of ash: the hand rests on the crook, the iron-shod tip on the ground
  PROPS.hf_cane = (g, C, o) => {
    const bot = hf_ground(C) + 0.4, c = o.c || '#8a6a42';
    g.save(); g.rotate(0.05);
    rr(g, -0.8, -0.8, 1.6, bot + 0.8, 0.7); g.fillStyle = (() => { const gr = g.createLinearGradient(-0.8, 0, 0.8, 0); gr.addColorStop(0, shade(c, 0.32)); gr.addColorStop(1, shade(c, -0.35)); return gr; })(); g.fill(); outline(g, 0.45);
    for (const [y, s] of [[3, 1], [6, -1]]) { ell(g, s * 0.9, y, 0.6, 0.5); g.fillStyle = shade(c, -0.2); g.fill(); outline(g, 0.25); }
    rr(g, -0.95, bot - 1.6, 1.9, 1.6, 0.45); g.fillStyle = metal(g, '#6b707b', bot - 1.6, bot); g.fill(); outline(g, 0.3);
    const crook = () => { g.beginPath(); g.moveTo(0, 0.6); g.lineTo(0, -1.4); g.arc(1.9, -1.4, 1.9, Math.PI, Math.PI * 2); g.lineTo(3.8, 0.4); };
    g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 2.5; crook(); g.stroke(); g.strokeStyle = c; g.lineWidth = 1.6; crook(); g.stroke();
    g.strokeStyle = shade(c, 0.4); g.lineWidth = 0.4; g.beginPath(); g.arc(1.9, -1.4, 1.75, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
    g.restore();
  };
  // the guild's ledger: a fat book bound in Hollowford red, brass corners, a ribbon, a quill in its pages
  PROPS.hf_ledger = (g, C, o) => {
    const c = o.c || HF_RED, sw = C.step * 0.4 + Math.sin(time * 2.2 + C.seed) * 0.25;
    g.save(); g.rotate(-0.14 + C.step * 0.04);
    // the quill, stuck in the pages
    g.save(); g.translate(1.4, -1.6); g.rotate(0.45); ell(g, 0, -3.4, 0.9, 2.8); g.fillStyle = vfill(g, '#f2eee4', -6, -0.6, 0.2, -0.2); g.fill(); outline(g, 0.3); g.strokeStyle = '#8a7a6a'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(0, 0.4); g.lineTo(0, -6); g.stroke(); g.restore();
    // pages, then the cover
    rr(g, -2.3, -1.1, 6.2, 8.1, 0.6); g.fillStyle = '#efe4c8'; g.fill(); outline(g, 0.4);
    g.strokeStyle = '#c9b88e'; g.lineWidth = 0.22; for (let y = -0.2; y < 6.6; y += 0.8) { g.beginPath(); g.moveTo(3.1, y); g.lineTo(3.8, y + 0.2); g.stroke(); }
    rr(g, -3, -1.6, 6, 8.2, 0.7); g.fillStyle = vfill(g, c, -1.6, 6.6, 0.28, -0.32); g.fill(); outline(g, 0.55);
    rr(g, -3, -1.6, 1.5, 8.2, 0.6); g.fillStyle = shade(c, -0.28); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 0.35; for (const y of [0, 2.6, 5.2]) { g.beginPath(); g.moveTo(-3, y); g.lineTo(-1.5, y); g.stroke(); }
    rr(g, -0.9, -0.5, 3, 6, 0.4); g.stroke();
    g.fillStyle = metal(g, '#c9a64a', -1.6, 6.6); for (const [x, y, a] of [[3, -1.6, 0], [3, 6.6, 1]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1.5, y); g.lineTo(x, a ? y - 1.5 : y + 1.5); g.closePath(); g.fill(); }
    // a little gold shield on the cover: the guild's mark
    g.beginPath(); g.moveTo(-0.3, 1.2); g.lineTo(1.7, 1.2); g.lineTo(1.6, 2.8); g.quadraticCurveTo(0.7, 3.8, 0.7, 3.8); g.quadraticCurveTo(-0.2, 3.3, -0.2, 2.8); g.closePath(); g.fillStyle = GOLD; g.fill();
    g.strokeStyle = '#d9b25c'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(1.4, 6.6); g.quadraticCurveTo(1.6 + sw * 0.5, 8, 1.3 + sw, 9.4); g.stroke();
    g.restore();
  };
  // the guild chest's keys on a ring at the belt
  function hf_keys(g, C, x, y) {
    const sw = C.step * 0.18 + Math.sin(time * 2.4 + C.seed) * 0.06;
    g.save(); g.translate(x, y); g.rotate(sw);
    g.strokeStyle = OUT; g.lineWidth = 1.1; g.beginPath(); g.arc(0, 0.9, 1.1, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#b8a26a'; g.lineWidth = 0.55; g.stroke();
    for (const [kx, a, len] of [[-0.7, 0.35, 3.4], [0, 0, 4.2], [0.7, -0.3, 3]]) {
      g.save(); g.translate(kx, 1.9); g.rotate(a);
      ell(g, 0, 0.1, 0.7, 0.7); g.fillStyle = '#b8a26a'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.25; g.stroke();
      rr(g, -0.28, 0.6, 0.56, len, 0.2); g.fillStyle = metal(g, '#b8a26a', 0, len); g.fill(); g.stroke();
      g.fillStyle = '#9a8450'; g.fillRect(0.2, len - 0.6, 0.9, 0.5); g.fillRect(0.2, len + 0.2, 0.6, 0.4);
      g.restore();
    }
    g.restore();
  }

  // ---------- Nell's things: the rebuild plan, a claw hammer, a carpenter's square, a charcoal pencil in her bun ----------
  // the plan: a long roll of vellum tied with red string, one corner curling open to show the inked house
  PROPS.hf_plan = (g, C, o) => {
    g.save(); g.rotate(-0.06 + C.step * 0.04);
    const x0 = -1.8, w = 3.6, y0 = -13.2, y1 = 3.4;
    g.beginPath(); g.moveTo(x0 + w - 0.2, y0 + 1.2); g.quadraticCurveTo(x0 + w + 2, y0 - 0.2, x0 + w + 3.8, y0 + 0.8); g.quadraticCurveTo(x0 + w + 3.2, y0 + 4, x0 + w + 3.6, y0 + 7); g.quadraticCurveTo(x0 + w + 1.6, y0 + 6.4, x0 + w - 0.2, y0 + 7.4); g.closePath();
    g.fillStyle = vfill(g, '#f2e6c4', y0, y0 + 7, 0.15, -0.2); g.fill(); outline(g, 0.4);
    // the inked house: walls, a roof (Tam says it is upside down), a door
    const hx = x0 + w + 0.8, hy = y0 + 2.2;
    g.strokeStyle = '#2f4f86'; g.lineWidth = 0.28; g.beginPath(); g.moveTo(hx, hy + 1.4); g.lineTo(hx + 1.2, hy); g.lineTo(hx + 2.4, hy + 1.4); g.rect(hx + 0.2, hy + 1.4, 2, 2.2); g.moveTo(hx + 1, hy + 3.6); g.lineTo(hx + 1, hy + 2.6); g.lineTo(hx + 1.5, hy + 2.6); g.lineTo(hx + 1.5, hy + 3.6); g.stroke();
    rr(g, x0, y0, w, y1 - y0, 1.6); g.fillStyle = (() => { const gr = g.createLinearGradient(x0, 0, x0 + w, 0); gr.addColorStop(0, '#fbf2d8'); gr.addColorStop(0.45, '#eedfb8'); gr.addColorStop(1, '#b8a47a'); return gr; })(); g.fill(); outline(g, 0.55);
    ell(g, x0 + w / 2, y0 + 0.9, w / 2 - 0.1, 0.85); g.fillStyle = '#e2d2a8'; g.fill(); outline(g, 0.3);
    g.strokeStyle = '#a89468'; g.lineWidth = 0.25; g.beginPath(); g.arc(x0 + w / 2 + 0.2, y0 + 0.9, 0.9, 0, Math.PI * 1.6); g.stroke(); g.beginPath(); g.arc(x0 + w / 2 + 0.1, y0 + 0.9, 0.4, 0, Math.PI * 1.6); g.stroke();
    g.strokeStyle = '#b8302a'; g.lineWidth = 0.6; for (const y of [y0 + 3.4, y1 - 3]) { g.beginPath(); g.moveTo(x0 - 0.1, y); g.lineTo(x0 + w + 0.1, y + 0.3); g.stroke(); }
    g.lineWidth = 0.4; g.beginPath(); g.moveTo(x0 + w, y0 + 3.6); g.quadraticCurveTo(x0 + w + 1.2, y0 + 3, x0 + w + 0.8, y0 + 4.6); g.moveTo(x0 + w, y0 + 3.7); g.quadraticCurveTo(x0 + w + 0.4, y0 + 5, x0 + w + 1.4, y0 + 5.6); g.stroke();
    g.restore();
  };
  // a carpenter's claw hammer: a smooth handle, a square face one side and the split claw the other
  PROPS.hf_claw = (g, C, o) => {
    rr(g, -0.7, -8.2, 1.4, 11.4, 0.6); g.fillStyle = vfill(g, '#a8783e', -8, 3, 0.3, -0.3); g.fill(); outline(g, 0.4);
    g.strokeStyle = '#5a3a1e'; g.lineWidth = 0.35; for (const y of [0.6, 1.6, 2.6]) { g.beginPath(); g.moveTo(-0.7, y); g.lineTo(0.7, y + 0.4); g.stroke(); }
    const head = () => { g.beginPath(); g.moveTo(-3.4, -10); g.lineTo(-0.2, -10.2); g.lineTo(0.8, -10.1); g.quadraticCurveTo(3, -10, 4, -7.6); g.quadraticCurveTo(2.6, -8.6, 0.8, -8.5); g.lineTo(-0.2, -8.3); g.lineTo(-3.4, -8.2); g.closePath(); };
    head(); g.fillStyle = metal(g, '#8f96a3', -10.4, -7.6); g.fill(); outline(g, 0.45);
    g.strokeStyle = '#4a4f5a'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(2, -9.6); g.quadraticCurveTo(3, -9.2, 3.6, -8); g.stroke();
    rr(g, -3.8, -10.3, 1, 2.3, 0.3); g.fillStyle = metal(g, '#a9adb5', -10.3, -8); g.fill(); outline(g, 0.3);
  };
  // her apron pocket: a folding rule and a pencil
  function hf_nellPocket(g, x, y) {
    g.save(); g.translate(x - 1, y + 0.8); g.rotate(-0.22); rr(g, -0.55, -3.4, 1.1, 3.8, 0.2); g.fillStyle = vfill(g, '#e2c260', -3.4, 0.4, 0.2, -0.2); g.fill(); outline(g, 0.3); g.strokeStyle = '#3a2a10'; g.lineWidth = 0.2; for (let k = -3; k < 0; k += 0.6) { g.beginPath(); g.moveTo(-0.55, k); g.lineTo(-0.1, k); g.stroke(); } g.restore();
    g.save(); g.translate(x + 1.1, y + 0.8); g.rotate(0.28); rr(g, -0.35, -3.6, 0.7, 3.9, 0.2); g.fillStyle = '#3f6a3a'; g.fill(); outline(g, 0.25); g.fillStyle = '#e8c890'; g.beginPath(); g.moveTo(-0.35, -3.6); g.lineTo(0, -4.6); g.lineTo(0.35, -3.6); g.closePath(); g.fill(); g.fillStyle = '#2a2a2a'; g.fillRect(-0.12, -4.6, 0.24, 0.35); g.restore();
  }
  // a steel carpenter's square tucked into the apron string at her hip
  function hf_square(g, x, y) {
    g.save(); g.translate(x, y); g.rotate(0.12);
    g.beginPath(); g.moveTo(0, -3.2); g.lineTo(1, -3.2); g.lineTo(1, 4.4); g.lineTo(4.4, 4.4); g.lineTo(4.4, 5.4); g.lineTo(0, 5.4); g.closePath();
    g.fillStyle = metal(g, '#a9adb5', -3.2, 5.4); g.fill(); outline(g, 0.4);
    g.strokeStyle = '#4a4f5a'; g.lineWidth = 0.2; for (let k = -2.6; k < 4; k += 0.8) { g.beginPath(); g.moveTo(0, k); g.lineTo(0.45, k); g.stroke(); } for (let k = 1.2; k < 4.4; k += 0.8) { g.beginPath(); g.moveTo(k, 5.4); g.lineTo(k, 4.95); g.stroke(); }
    g.restore();
  }

  // ---------- Pip's things: a wooden sword, a pot-lid shield with a red cross painted on, one boot (he lost the other) ----------
  PROPS.hf_woodsword = (g, C, o) => {
    g.save(); g.rotate(0.06);
    // the blade: a lath of pale wood, a point whittled on, some of it painted silver to look like steel
    const blade = () => { g.beginPath(); g.moveTo(-1.1, -2.4); g.lineTo(-1.1, -13.4); g.lineTo(0, -15.4); g.lineTo(1.1, -13.4); g.lineTo(1.1, -2.4); g.closePath(); };
    blade(); g.fillStyle = (() => { const gr = g.createLinearGradient(-1.1, 0, 1.1, 0); gr.addColorStop(0, '#f0d8a8'); gr.addColorStop(1, '#b8915a'); return gr; })(); g.fill(); outline(g, 0.5);
    g.save(); blade(); g.clip(); g.fillStyle = 'rgba(214,222,232,0.85)'; g.beginPath(); g.moveTo(-1.2, -8.4); g.lineTo(1.2, -9.4); g.lineTo(1.2, -16); g.lineTo(-1.2, -16); g.closePath(); g.fill();
    g.strokeStyle = '#9a7444'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(-0.3, -3); g.quadraticCurveTo(0, -6, -0.2, -8.2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(-0.6, -14, 0.35, 4.6); g.restore();
    // the cross-guard: a stick lashed on with twine
    rr(g, -3.4, -3.3, 6.8, 1.4, 0.6); g.fillStyle = vfill(g, '#8a5a2b', -3.3, -1.9, 0.3, -0.3); g.fill(); outline(g, 0.4);
    g.strokeStyle = '#d9c08a'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-1.1, -3.4); g.lineTo(1.1, -1.8); g.moveTo(1.1, -3.4); g.lineTo(-1.1, -1.8); g.stroke();
    rr(g, -0.8, -1.9, 1.6, 4.4, 0.5); g.fillStyle = '#6b4a2a'; g.fill(); outline(g, 0.35);
    ell(g, 0, 2.9, 0.9, 0.8); g.fillStyle = rfill(g, '#8a5a2b', 0, 2.9, 0.9); g.fill(); outline(g, 0.3);
    g.restore();
  };
  // a pot lid, held by its knob from behind: from the front, a little shield with Hollowford's red cross painted on
  PROP_OVER.hf_potlid = (g, C, o) => {
    const r = 3.6;
    ell(g, 0, 0.6, r, r * 0.96); g.fillStyle = rfill(g, '#a9b0ba', 0, 0.6, r); g.fill(); outline(g, 0.6);
    g.strokeStyle = 'rgba(60,64,72,0.55)'; g.lineWidth = 0.35; g.beginPath(); g.arc(0, 0.6, r - 0.8, 0, Math.PI * 2); g.stroke();
    if (C.back) { ell(g, 0, 0.6, 1.1, 0.9); g.fillStyle = '#3a2a1a'; g.fill(); outline(g, 0.3); return; }
    g.strokeStyle = '#a8282a'; g.lineWidth = 1.15; g.lineCap = 'round'; g.beginPath(); g.moveTo(0.1, -2); g.quadraticCurveTo(-0.2, 0.6, 0.1, 3.2); g.moveTo(-2.2, 0.4); g.quadraticCurveTo(0, 0.7, 2.3, 0.3); g.stroke();
    g.strokeStyle = 'rgba(40,44,52,0.5)'; g.lineWidth = 0.3; g.beginPath(); g.arc(2, 2.4, 0.6, 3.6, 5.6); g.stroke(); g.beginPath(); g.arc(-2.2, -1.2, 0.5, 0.2, 2); g.stroke();
    sparkle(g, -1.6, -1.4, 0.9, 'rgba(255,255,255,0.85)');
  };
  // his one boot (the other foot is in a darned stocking, a toe poking out): drawn over the base's stocking feet
  function hf_pipFeet(g, C) {
    const hemY = C.B.hem + (C.P.body.len || 0) + 0.35;
    hf_belowHem(g, C, hemY, () => {
      const B = C.B, w = B.lw + 0.9;
      { const { x, y } = hf_leg(C, 1), by = y + B.leg - 2.6 + 0.2; rr(g, x - w / 2 - 0.1, by - 0.4, w + 0.2, 3.6, 1.5); g.fillStyle = vfill(g, '#6b4426', by, by + 3.4, 0.28, -0.32); g.fill(); outline(g, 0.6);
        g.fillStyle = '#4a2e18'; rr(g, x - w / 2 - 0.2, by - 0.6, w + 0.4, 1.2, 0.5); g.fill(); g.strokeStyle = '#d9c08a'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(x - 0.8, by + 0.8); g.lineTo(x + 0.8, by + 1.4); g.moveTo(x + 0.8, by + 0.8); g.lineTo(x - 0.8, by + 1.4); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x - w / 2 + 0.7, by + 0.6, w * 0.4, 0.45); }
      if (!C.back) { const { x, y } = hf_leg(C, -1), by = y + B.leg - 2.6; ell(g, x - 1.4, by + 2.9, 0.7, 0.55); g.fillStyle = '#f2c8a8'; g.fill(); outline(g, 0.3);
        g.strokeStyle = '#a89a80'; g.lineWidth = 0.3; g.setLineDash([0.4, 0.35]); g.beginPath(); g.arc(x + 0.8, by + 1.4, 0.8, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    });
  }

  // ---------- Hob's things: a plank stood on end, a hand saw, sawdust ----------
  PROPS.hf_plank = (g, C, o) => {
    const bot = hf_ground(C) + 0.4, top = -23, x0 = -1.4, w = 3.6, c = o.c || '#c9a06a';
    g.save(); g.rotate(0.03);
    const pl = () => { g.beginPath(); g.moveTo(x0, bot); g.lineTo(x0, top + 0.6); g.lineTo(x0 + w, top - 0.4); g.lineTo(x0 + w, bot); g.closePath(); };
    pl(); g.fillStyle = (() => { const gr = g.createLinearGradient(x0, 0, x0 + w, 0); gr.addColorStop(0, shade(c, 0.28)); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, -0.3)); return gr; })(); g.fill(); outline(g, 0.55);
    g.save(); pl(); g.clip();
    g.strokeStyle = shade(c, -0.32); g.lineWidth = 0.3; for (const k of [0.8, 1.7, 2.7]) { g.beginPath(); g.moveTo(x0 + k, bot); g.bezierCurveTo(x0 + k + 0.4, -4, x0 + k - 0.4, -12, x0 + k + 0.2, top); g.stroke(); }
    ell(g, x0 + 2.2, -9, 0.8, 1.3); g.fillStyle = shade(c, -0.35); g.fill(); g.strokeStyle = shade(c, -0.5); g.lineWidth = 0.3; g.beginPath(); g.ellipse(x0 + 2.2, -9, 1.3, 2, 0, 0, Math.PI * 2); g.stroke();
    // the sawn end: paler, rings showing
    g.beginPath(); g.moveTo(x0, top + 0.6); g.lineTo(x0 + w, top - 0.4); g.lineTo(x0 + w, top + 0.8); g.lineTo(x0, top + 1.8); g.closePath(); g.fillStyle = shade(c, 0.4); g.fill();
    g.restore();
    rivets(g, [[x0 + 0.8, -15.4], [x0 + 2.8, -15.6]], '#5a5f6a', 0.35);
    g.restore();
  };
  // a hand saw hanging teeth-down from the other hand: an open wooden handle, a tapering steel blade
  PROPS.hf_saw = (g, C, o) => {
    g.save(); g.rotate(0.1 + C.step * 0.06);
    const blade = () => { g.beginPath(); g.moveTo(-1.2, 1.4); g.lineTo(2.8, 1.4); g.lineTo(1.6, 10.6); g.lineTo(-0.4, 10.6); g.closePath(); };
    blade(); g.fillStyle = metal(g, '#c3c8d0', 1, 11); g.fill(); outline(g, 0.45);
    g.fillStyle = '#7d828c'; g.beginPath(); g.moveTo(-1.2, 1.6); for (let y = 1.6; y < 10.4; y += 0.9) { g.lineTo(-1.6 + (y - 1.6) * 0.09, y + 0.45); g.lineTo(-1.2 + (y - 1.6) * 0.09, y + 0.9); } g.lineTo(-0.4, 10.6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(1.6, 2.2); g.lineTo(1, 9.6); g.stroke();
    // the handle round the hand
    g.beginPath(); g.moveTo(-1.8, 2); g.quadraticCurveTo(-2.4, -2.6, 0.4, -2.6); g.quadraticCurveTo(3.4, -2.6, 3.2, 2); g.lineTo(1.8, 2); g.quadraticCurveTo(2, -1.2, 0.4, -1.2); g.quadraticCurveTo(-0.9, -1.2, -0.6, 2); g.closePath();
    g.fillStyle = vfill(g, '#8a5a2b', -2.6, 2, 0.3, -0.3); g.fill(); outline(g, 0.45);
    rivets(g, [[-1, 1.6], [2.4, 1.6]], '#d9c08a', 0.3);
    g.restore();
  };

  // ---------- Wenna's thing: a wooden pail of water from the new well ----------
  PROPS.hf_bucket = (g, C, o) => {
    const sw = C.step * 0.08 + Math.sin(time * 2 + C.seed) * 0.03, slosh = Math.sin(time * 3 + C.seed) * 0.3 + C.step * 0.5;
    g.save(); g.rotate(sw);
    // the rope handle
    g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-3.8, 4.2); g.quadraticCurveTo(-3, -0.4, 0, -0.2); g.quadraticCurveTo(3, -0.4, 3.8, 4.2); g.stroke(); g.strokeStyle = '#c9a66b'; g.lineWidth = 0.8; g.stroke();
    const tub = () => { g.beginPath(); g.moveTo(-4.4, 3.8); g.lineTo(4.4, 3.8); g.lineTo(3.4, 9.4); g.quadraticCurveTo(0, 10.2, -3.4, 9.4); g.closePath(); };
    tub(); g.fillStyle = (() => { const gr = g.createLinearGradient(-4.4, 0, 4.4, 0); gr.addColorStop(0, '#c99a5e'); gr.addColorStop(0.5, '#a87a42'); gr.addColorStop(1, '#6e4a26'); return gr; })(); g.fill(); outline(g, 0.55);
    g.save(); tub(); g.clip(); g.strokeStyle = 'rgba(60,36,16,0.55)'; g.lineWidth = 0.3; for (const x of [-2.6, -0.9, 0.9, 2.6]) { g.beginPath(); g.moveTo(x, 3.8); g.lineTo(x * 0.8, 10); g.stroke(); }
    for (const y of [5, 8.2]) { g.fillStyle = metal(g, '#6b707b', y - 0.5, y + 0.5); g.fillRect(-5, y - 0.5, 10, 1); } g.restore();
    // the water: a cold blue surface, a glint, rocking as she walks
    ell(g, 0, 3.9, 4.2, 1.2); g.fillStyle = '#5a3a1e'; g.fill(); outline(g, 0.45);
    g.save(); ell(g, 0, 4.0, 3.7, 0.9); g.clip(); g.fillStyle = (() => { const gr = g.createLinearGradient(0, 3.2, 0, 4.9); gr.addColorStop(0, '#bfe6ff'); gr.addColorStop(1, '#4f90c8'); return gr; })(); g.fillRect(-4, 3 + slosh * 0.3, 8, 3);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-2 + slosh, 3.9); g.quadraticCurveTo(-0.8 + slosh, 3.5, 0.4 + slosh, 3.9); g.stroke(); g.restore();
    // a drop spilling over the rim when she walks
    if (C.e.moving) { const t = (time * 1.6 + C.seed) % 1; ell(g, 4.2 + t * 0.4, 4.2 + t * 7, 0.38, 0.55); g.fillStyle = `rgba(150,210,255,${0.9 - t * 0.6})`; g.fill(); }
    g.restore();
  };
  PROP_OVER.hf_bucket = (g, C, o) => { const sw = C.step * 0.08 + Math.sin(time * 2 + C.seed) * 0.03; g.save(); g.rotate(sw); g.strokeStyle = OUT; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-1.4, -0.4); g.quadraticCurveTo(0, -0.7, 1.4, -0.4); g.stroke(); g.strokeStyle = '#c9a66b'; g.lineWidth = 0.7; g.stroke(); g.restore(); };
  // a cornflower tucked behind her ear
  function hf_flower(g, x, y, c) { for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ell(g, x + Math.cos(a) * 0.9, y + Math.sin(a) * 0.9, 0.7, 0.45, a); g.fillStyle = c; g.fill(); } g.strokeStyle = OUT; g.lineWidth = 0.25; ell(g, x, y, 1.6, 1.6); ell(g, x, y, 0.5, 0.5); g.fillStyle = '#2a2a5a'; g.fill(); }

  // ---------- Old Harl's things: an oilskin sou'wester, a cream roll-neck, an oar with its blade up, a lantern ----------
  function hf_souwester(g, C, c) {
    const B = C.B, hy = B.hy, r = B.hr, ex = C.fx * 1.8, hx = ex * 0.35, tip = C.step * 0.35 + Math.sin(time * 2 + C.seed) * 0.2;
    const crown = () => { g.beginPath(); g.moveTo(-r + 0.6, hy - 4.2); g.bezierCurveTo(-r, hy - r - 4.6, r, hy - r - 4.6, r - 0.6, hy - 4.2); g.quadraticCurveTo(hx, hy - 3.4, -r + 0.6, hy - 4.2); g.closePath(); };
    const shine = () => { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-r + 1.8, hy - 4.2); g.quadraticCurveTo(-r + 1.8, hy - 8.4, -2.4, hy - 9.6); g.stroke(); };
    const seams = () => { g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.4; for (const x of [-3, 0, 3]) { g.beginPath(); g.moveTo(x * 0.3 + hx, hy - r - 2.5); g.quadraticCurveTo(x * 0.9 + hx, hy - 6.4, x * 1.15 + hx, hy - 2.8); g.stroke(); } };
    if (C.back) {
      // facing away: a wide back flap that keeps the rain off his neck
      const flap = () => { g.beginPath(); g.moveTo(-r - 2.4, hy + 3.4 + tip * 0.4); g.quadraticCurveTo(-r - 2.6, hy - 3, -r + 0.6, hy - 3.6); g.lineTo(r - 0.6, hy - 3.6); g.quadraticCurveTo(r + 2.6, hy - 3, r + 2.4, hy + 3.4 + tip * 0.4); g.quadraticCurveTo(0, hy + 6.6 + tip, -r - 2.4, hy + 3.4 + tip * 0.4); g.closePath(); };
      flap(); g.fillStyle = vfill(g, c, hy - 3, hy + 6.6, 0.22, -0.3); g.fill(); outline(g, 0.7);
      g.save(); flap(); g.clip(); g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.3; g.setLineDash([0.6, 0.5]); g.beginPath(); g.moveTo(-r - 1.4, hy + 2.6); g.quadraticCurveTo(0, hy + 5.4, r + 1.4, hy + 2.6); g.stroke(); g.setLineDash([]);
      g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.35; for (const x of [-4, 0, 4]) { g.beginPath(); g.moveTo(x * 0.8, hy - 2.6); g.quadraticCurveTo(x * 1.1, hy + 1, x * 1.25, hy + 5); g.stroke(); } g.restore();
      crown(); g.fillStyle = vfill(g, c, hy - r - 3, hy - 2, 0.38, -0.18); g.fill(); outline(g, 0.7); seams(); shine();
      return;
    }
    // facing us: one brim all round, short over the brow and sloping down at the sides over the ears
    g.fillStyle = 'rgba(20,14,10,0.2)'; g.beginPath(); g.ellipse(hx, hy - 2.2, r - 1.4, 1.4, 0, 0, Math.PI); g.fill();
    const brim = () => { g.beginPath(); g.moveTo(-r - 3.2, hy + 3 + tip * 0.3); g.quadraticCurveTo(-r - 3.4, hy - 3.6, hx - 2, hy - 5.2); g.lineTo(hx + 2, hy - 5.2); g.quadraticCurveTo(r + 3.4, hy - 3.6, r + 3.2, hy + 3 + tip * 0.3);
      g.quadraticCurveTo(r + 2, hy + 4, r + 0.6, hy + 2.6); g.quadraticCurveTo(r + 0.4, hy - 1.2, r - 0.8, hy - 2.6); g.quadraticCurveTo(hx, hy - 2, -r + 0.8, hy - 2.6); g.quadraticCurveTo(-r - 0.4, hy - 1.2, -r - 0.6, hy + 2.6); g.quadraticCurveTo(-r - 2, hy + 4, -r - 3.2, hy + 3 + tip * 0.3); g.closePath(); };
    brim(); g.fillStyle = vfill(g, c, hy - 5, hy + 4, 0.26, -0.3); g.fill(); outline(g, 0.7);
    g.save(); brim(); g.clip(); g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.3; g.setLineDash([0.6, 0.5]); g.beginPath(); g.moveTo(-r - 2.2, hy + 2.6); g.quadraticCurveTo(-r - 2.4, hy - 3, hx, hy - 4.4); g.quadraticCurveTo(r + 2.4, hy - 3, r + 2.2, hy + 2.6); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r - 0.6), hy - 2.4); g.quadraticCurveTo(s * (r + 0.6), hy, s * (r + 0.6), hy + 2.8); g.lineTo(s * (r + 1.6), hy + 3.4); g.quadraticCurveTo(s * (r + 1.4), hy - 0.6, s * (r + 0.2), hy - 2.8); g.closePath(); g.fill(); } g.restore();
    crown(); g.fillStyle = vfill(g, c, hy - r - 3, hy - 2, 0.38, -0.18); g.fill(); outline(g, 0.7); seams(); shine();
  }
  // a knitted roll-neck in cream wool, ribbed
  function hf_rollneck(g, C, c) {
    const y = C.B.sh - 2;
    const band = () => { g.beginPath(); g.moveTo(-4.8, y + 0.2); g.quadraticCurveTo(0, y - 1.6, 4.8, y + 0.2); g.lineTo(4.6, y + 2.6); g.quadraticCurveTo(0, y + 3.8, -4.6, y + 2.6); g.closePath(); };
    band(); g.fillStyle = vfill(g, c, y - 1.6, y + 3.6, 0.2, -0.22); g.fill(); outline(g, 0.55);
    g.save(); band(); g.clip(); g.strokeStyle = shade(c, -0.25); g.lineWidth = 0.3; for (let x = -4.4; x <= 4.5; x += 0.9) { g.beginPath(); g.moveTo(x, y - 1.6); g.lineTo(x * 0.96, y + 3.8); g.stroke(); } g.restore();
  }
  // an oar stood on its handle, the blade up above his hat: weathered wood, a leather collar, the blade's tip painted rust red
  PROPS.hf_oar = (g, C, o) => {
    const bot = hf_ground(C) + 0.4, top = -29, c = '#b08a5a';
    g.save(); g.rotate(0.04);
    rr(g, -0.85, top + 11, 1.7, bot - top - 11, 0.7); g.fillStyle = (() => { const gr = g.createLinearGradient(-0.85, 0, 0.85, 0); gr.addColorStop(0, shade(c, 0.3)); gr.addColorStop(1, shade(c, -0.35)); return gr; })(); g.fill(); outline(g, 0.45);
    rr(g, -1.1, bot - 3.4, 2.2, 3.4, 0.9); g.fillStyle = vfill(g, '#7a5a3a', bot - 3.4, bot, 0.25, -0.3); g.fill(); outline(g, 0.35);
    rr(g, -1.15, -4.4, 2.3, 2.8, 0.4); g.fillStyle = vfill(g, '#5a3a22', -4.4, -1.6, 0.25, -0.3); g.fill(); outline(g, 0.35);
    g.strokeStyle = '#d9c08a'; g.lineWidth = 0.25; g.setLineDash([0.4, 0.4]); g.beginPath(); g.moveTo(0, -4.2); g.lineTo(0, -1.8); g.stroke(); g.setLineDash([]);
    const blade = () => { g.beginPath(); g.moveTo(-0.8, top + 12); g.quadraticCurveTo(-2.8, top + 8, -2.6, top + 2); g.quadraticCurveTo(-2.4, top - 0.8, 0, top - 0.8); g.quadraticCurveTo(2.4, top - 0.8, 2.6, top + 2); g.quadraticCurveTo(2.8, top + 8, 0.8, top + 12); g.closePath(); };
    blade(); g.fillStyle = (() => { const gr = g.createLinearGradient(-2.8, 0, 2.8, 0); gr.addColorStop(0, shade(c, 0.32)); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, -0.32)); return gr; })(); g.fill(); outline(g, 0.55);
    g.save(); blade(); g.clip(); g.fillStyle = '#8a3e2e'; g.fillRect(-3, top - 1, 6, 3.4); g.fillStyle = 'rgba(240,230,210,0.85)'; g.fillRect(-3, top + 2.4, 6, 0.6);
    g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.3; g.beginPath(); g.moveTo(0, top + 3); g.lineTo(0, top + 11); g.moveTo(1.4, top + 4.6); g.lineTo(1.9, top + 7.4); g.stroke(); g.restore();
    g.restore();
  };

  // ---------- Salt Pete's things: a fishing rod with a float on the line, a lobster that waves, a gull feather ----------
  PROPS.hf_rod = (g, C, o) => {
    const bot = hf_ground(C) + 0.2, top = -31, bend = Math.sin(time * 1.4 + C.seed) * 0.7 + 1.2;
    rr(g, -0.95, -2, 1.9, 4.6, 0.8); g.fillStyle = vfill(g, '#d2a46a', -2, 2.6, 0.25, -0.25); g.fill(); outline(g, 0.4);
    rr(g, -0.7, 2.4, 1.4, bot - 2.4, 0.6); g.fillStyle = vfill(g, '#5a3a22', 2.4, bot, 0.2, -0.3); g.fill(); outline(g, 0.35);
    ell(g, 1.6, 2.4, 1.35, 1.35); g.fillStyle = metal(g, '#a9adb5', 1, 3.8); g.fill(); outline(g, 0.35); g.fillStyle = '#4a4f5a'; ell(g, 1.6, 2.4, 0.4, 0.4); g.fill(); g.fillRect(2.6, 2.1, 1, 0.5);
    const rod = () => { g.beginPath(); g.moveTo(-0.55, -2); g.quadraticCurveTo(bend * 0.25, top * 0.55, bend, top); g.quadraticCurveTo(bend * 0.25 + 0.6, top * 0.55, 0.55, -2); g.closePath(); };
    g.strokeStyle = OUT; g.lineWidth = 0.9; rod(); g.stroke(); g.fillStyle = '#7a5230'; g.fill();
    for (const t of [0.3, 0.55, 0.8]) { const y = -2 + (top + 2) * t, x = bend * t * t; ell(g, x + 0.5, y, 0.35, 0.35); g.strokeStyle = '#c9ccd3'; g.lineWidth = 0.2; g.stroke(); }
    // the line down to a red and white float, bobbing, a little lead and a hook below
    const fy = -10 + Math.sin(time * 2.6 + C.seed) * 0.6, fx = 4.2 + C.step * 0.4;
    g.strokeStyle = 'rgba(245,245,240,0.85)'; g.lineWidth = 0.22; g.beginPath(); g.moveTo(bend, top); g.quadraticCurveTo(fx + 1, top * 0.6, fx, fy - 1.2); g.moveTo(fx, fy + 1.2); g.lineTo(fx, fy + 4.6); g.stroke();
    ell(g, fx, fy, 1, 1.25); g.fillStyle = '#f2f0ea'; g.fill(); outline(g, 0.3);
    g.save(); ell(g, fx, fy, 1, 1.25); g.clip(); g.fillStyle = '#d0302a'; g.fillRect(fx - 1.2, fy - 1.4, 2.4, 1.4); g.restore();
    ell(g, fx, fy + 3.4, 0.45, 0.45); g.fillStyle = '#6b707b'; g.fill();
    g.strokeStyle = '#c9ccd3'; g.lineWidth = 0.3; g.beginPath(); g.arc(fx - 0.5, fy + 4.6, 0.5, 0, Math.PI); g.stroke();
  };
  // a lobster held by its back, claws up and waving, its tail curled under
  PROPS.hf_lobster = (g, C, o) => {
    const red = '#c8402a', wv = Math.sin(time * 3.4 + C.seed), op = Math.max(0, Math.sin(time * 4.4 + C.seed)) * 0.5;
    g.save(); g.translate(0, 0.6);
    // the feelers
    g.strokeStyle = '#a83020'; g.lineWidth = 0.3; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.5, -0.6); g.quadraticCurveTo(s * 2.6, -5 + wv * 0.3, s * (5.4 + wv * 0.4), -6.4); g.stroke(); }
    // the claws, each on a jointed arm
    for (const s of [-1, 1]) {
      g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.moveTo(s * 1.2, 1); g.lineTo(s * 2.6, -0.4); g.lineTo(s * 3.2, -2 + s * wv * 0.3); g.stroke(); g.strokeStyle = red; g.lineWidth = 0.8; g.stroke();
      g.save(); g.translate(s * 3.4, -2.6 + s * wv * 0.3); g.rotate(s * (0.35 + wv * 0.12));
      g.beginPath(); g.moveTo(-1.1, 0.8); g.quadraticCurveTo(-1.6, -1.8, -0.4, -3.6); g.quadraticCurveTo(0, -1.8, 0, -0.6); g.closePath(); g.fillStyle = rfill(g, red, -0.6, -1.4, 2); g.fill(); outline(g, 0.35);
      g.save(); g.rotate(op * s * 0.4 * (s > 0 ? 1 : -1)); g.beginPath(); g.moveTo(0.2, 0.6); g.quadraticCurveTo(1.4, -1.2, 0.6, -3); g.quadraticCurveTo(0.2, -1.2, -0.2, -0.4); g.closePath(); g.fillStyle = rfill(g, red, 0.4, -1.2, 1.6); g.fill(); outline(g, 0.35); g.restore();
      g.restore();
    }
    // little legs
    g.strokeStyle = '#a83020'; g.lineWidth = 0.35; for (const s of [-1, 1]) for (const y of [2, 3, 4]) { g.beginPath(); g.moveTo(s * 1.2, y); g.lineTo(s * 2.4, y + 0.8); g.stroke(); }
    // the shell, then the tail in plates, then the fan
    ell(g, 0, 2.4, 1.7, 2.6); g.fillStyle = rfill(g, red, 0, 2.4, 2.6); g.fill(); outline(g, 0.45);
    for (let k = 0; k < 4; k++) { const y = 5.2 + k * 1.05, w = 1.5 - k * 0.15; rr(g, -w, y - 0.5, w * 2, 1.15, 0.45); g.fillStyle = vfill(g, red, y - 0.5, y + 0.6, 0.25, -0.25); g.fill(); outline(g, 0.3); }
    g.beginPath(); g.moveTo(0, 9); g.lineTo(-1.8, 10.6); g.quadraticCurveTo(0, 11.4, 1.8, 10.6); g.closePath(); g.fillStyle = shade(red, -0.1); g.fill(); outline(g, 0.3);
    for (const s of [-1, 1]) { ell(g, s * 0.8, -0.4, 0.35, 0.35); g.fillStyle = '#1a1008'; g.fill(); }
    g.restore();
  };
  function hf_feather(g, x, y, a) {
    g.save(); g.translate(x, y); g.rotate(a);
    ell(g, 0, -3.2, 1.1, 3.4); g.fillStyle = vfill(g, '#f6f4ee', -6.6, 0, 0.1, -0.12); g.fill(); outline(g, 0.35);
    g.save(); ell(g, 0, -3.2, 1.1, 3.4); g.clip(); g.fillStyle = '#4a4f5a'; g.fillRect(-1.2, -6.8, 2.4, 1.8); g.fillStyle = '#9aa0aa'; g.fillRect(-1.2, -5, 2.4, 1); g.restore();
    g.strokeStyle = '#8a8070'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(0, 0.8); g.lineTo(0, -6.2); g.stroke();
    g.restore();
  }
  // trousers rolled to the knee: only the turned-up cuff shows under the smock's hem, bare shins below it
  function hf_rolledTrousers(g, C, c) {
    const hemY = C.B.hem + (C.P.body.len || 0) + 0.3;
    hf_belowHem(g, C, hemY, () => {
      const w = (C.P.legs && C.P.legs.w) || C.B.lw;
      for (const s of [-1, 1]) {
        const { x, y } = hf_leg(C, s), y0 = Math.max(hemY - 1, y - 1);
        rr(g, x - w / 2 - 0.7, y0, w + 1.4, 1.9, 0.7); g.fillStyle = vfill(g, c, y0, y0 + 1.9, 0.3, -0.25); g.fill(); outline(g, 0.5);
        g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.3; g.beginPath(); g.moveTo(x - w / 2 - 0.5, y0 + 0.95); g.lineTo(x + w / 2 + 0.5, y0 + 0.95); g.stroke();
      }
    });
  }
  // a rope tied round the waist for a belt, the knot's ends hanging
  function hf_ropeBelt(g, C, c) {
    const B = C.B, w = B.w, y = B.waist + 0.6, sw = C.step * 0.5;
    const rope = () => { g.beginPath(); g.moveTo(-w - 0.2, y - 0.2); g.quadraticCurveTo(0, y + 1.2, w + 0.2, y - 0.2); };
    g.strokeStyle = OUT; g.lineWidth = 1.7; rope(); g.stroke(); g.strokeStyle = c; g.lineWidth = 1.05; rope(); g.stroke();
    g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.28; for (let x = -w + 0.4; x < w; x += 0.9) { const yy = y - 0.2 + 1.4 * (1 - Math.pow(x / (w + 0.2), 2)) * 0.5; g.beginPath(); g.moveTo(x - 0.3, yy - 0.45); g.lineTo(x + 0.3, yy + 0.45); g.stroke(); }
    if (C.back) return;
    ell(g, 1.8, y + 0.5, 1, 0.8); g.fillStyle = c; g.fill(); outline(g, 0.35);
    g.lineCap = 'round'; for (const [dx, l] of [[1.4, 3.4], [2.3, 2.8]]) { g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.moveTo(dx, y + 1); g.quadraticCurveTo(dx + sw * 0.3, y + 1 + l / 2, dx + 0.2 + sw * 0.6, y + 1 + l); g.stroke(); g.strokeStyle = c; g.lineWidth = 0.65; g.stroke(); }
  }

  // ---------- Hob's neckerchief and braces ----------
  // a cotton neckerchief knotted at the side of the throat, a corner hanging; facing away, its point down the back
  function hf_kerchief(g, C, c, dot) {
    const y = C.B.sh - 0.5, sw = C.step * 0.4 + Math.sin(time * 2.2 + C.seed) * 0.2;
    const band = () => { g.beginPath(); g.moveTo(-4.8, y); g.quadraticCurveTo(0, y - 1.8, 4.8, y); g.quadraticCurveTo(5, y + 1.6, 4, y + 2.2); g.quadraticCurveTo(0, y + 3.2, -4, y + 2.2); g.quadraticCurveTo(-5, y + 1.6, -4.8, y); g.closePath(); };
    if (C.back) { g.beginPath(); g.moveTo(-4.4, y + 0.4); g.lineTo(4.4, y + 0.4); g.lineTo(sw * 0.4, y + 5.6); g.closePath(); g.fillStyle = vfill(g, c, y, y + 5.6, 0.25, -0.25); g.fill(); outline(g, 0.5); }
    band(); g.fillStyle = vfill(g, c, y - 1.8, y + 3.2, 0.3, -0.25); g.fill(); outline(g, 0.5);
    g.save(); band(); g.clip(); g.fillStyle = dot; for (let x = -4.4; x < 4.6; x += 1.5) { ell(g, x, y + 0.7 + (Math.round(x) % 2 ? 0.6 : 0), 0.3, 0.3); g.fill(); } g.restore();
    if (C.back) return;
    g.beginPath(); g.moveTo(2.4, y + 1.6); g.lineTo(4.4 + sw * 0.5, y + 5.2); g.lineTo(2.8 + sw * 0.5, y + 5.4); g.lineTo(1.6, y + 2); g.closePath(); g.fillStyle = vfill(g, c, y, y + 5.4, 0.2, -0.3); g.fill(); outline(g, 0.4);
    ell(g, 2.4, y + 1.7, 1.1, 0.9); g.fillStyle = shade(c, -0.12); g.fill(); outline(g, 0.35);
  }
  // braces: two straps over the shoulders down to the belt, brass buttons; facing away they cross on the back
  function hf_braces(g, C, c, btn) {
    const B = C.B, y0 = B.sh - 0.8, y1 = B.waist + 0.2;
    const strap = (x0, x1) => { g.strokeStyle = OUT; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + (x0 > 0 ? 0.6 : -0.6), (y0 + y1) / 2, x1, y1); g.stroke(); g.strokeStyle = c; g.lineWidth = 1.05; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.3; g.stroke(); };
    if (C.back) { strap(-4.2, 3.2); strap(4.2, -3.2); return; }
    for (const s of [-1, 1]) { strap(s * 4.4, s * 3.4); ell(g, s * 3.4, y1 - 0.2, 0.55, 0.55); g.fillStyle = metal(g, btn, y1 - 0.8, y1 + 0.4); g.fill(); outline(g, 0.25); }
  }

  addPeople('hollowford', {
    // ---------- Old Tam: the town's elder, who kept them alive in the crypt and founded the guild ----------
    // a long patched coat, the guild's red scarf, round spectacles, a white beard; the guild's ledger and a walking stick
    tam: {
      build: 'adult', skin: SKIN.ruddy, hand: '#e6b08a',
      face: { eye: '#3a2a1a', age: 'elder', brow: '#ece6da', browW: 1.3, browIn: 1.2, browTilt: -0.15, nose: 'big', noseC: '#e09a7a', mouth: 'smile', blush: 'rgba(220,110,100,0.38)' },
      hair: { style: 'bald', c: '#e2dacc' },
      beard: { style: 'full', c: '#e6e0d4' },
      body: { kind: 'coat', c: '#5a5048', under: '#7a6a52', sleeve: '#4e463e', button: '#c9b48a', belt: '#3a2a1c', buckle: '#a8a090', pouch: false },
      legs: { c: '#3e3832', boot: '#3a2a1c', cuff: '#5a4632', patch: '#6a5a48' },
      held: { kind: 'hf_cane', c: '#8a6a42' },
      off: { kind: 'hf_ledger', c: HF_RED },
      // patches on the coat: he has worn it since before the fire
      torso: (g, C) => {
        const B = C.B;
        if (C.back) { hf_patch(g, -3.2, B.hem - 0.4, 3, 2.8, '#6e6250', 0.1); hf_patch(g, 3.4, B.sh + 4, 2.6, 2.4, '#4a4440', -0.15); return; }
        hf_patch(g, -6, B.hem - 0.2, 2.8, 2.6, '#6e6250', -0.12);
        hf_keys(g, C, 4.8, B.waist + 1.6);
      },
      collar: (g, C) => {
        for (const s of [-1, 1]) hf_patch(g, s * (C.B.w + 0.4), C.B.sh + 2.2, 2.6, 2.2, s > 0 ? '#6e6250' : '#7a6a56', s * 0.25);
        hf_scarf(g, C, '#8a3030', '#e8dcc0');
      },
      head: (g, C) => hf_specs(g, C, '#c9b070'),
    },

    // ---------- Nell: she drew the plan for the rebuild, writes the guild's jobs, sorts the chest ----------
    // dark hair in a bun with a charcoal pencil through it, sleeves rolled, a carpenter's canvas apron; the rolled-up plan and a claw hammer
    nell: {
      build: 'adult', skin: SKIN.light,
      face: { eye: '#3a2414', lash: '#2a1a0a', brow: '#2a1a0a', browW: 0.7, browTilt: 0.08, mouth: 'smile', lip: '#a8524a' },
      hair: { style: 'bun', c: '#3a2a1a', tie: '#b8302a' },
      body: { kind: 'dress', c: '#6a4a4a', under: '#e9dcc0', lace: '#3a2414', sleeve: '#5a3e3e', rolled: '#e9dcc0', belt: false },
      over: [{ kind: 'apron', c: '#cbb68c', bib: false, w: 5, stain: 'rgba(120,90,50,0.35)', pocketItem: (g, x, y) => hf_nellPocket(g, x, y) }],
      legs: { boot: '#4a3020' },
      held: { kind: 'hf_plan' },
      off: { kind: 'hf_claw' },
      torso: (g, C) => { if (!C.back) hf_square(g, 4.6, C.B.waist - 0.6); },
      // a charcoal pencil stuck through the bun, and one strand of hair that will not stay up
      head: (g, C) => {
        const hy = C.B.hy, r = C.B.hr, by = C.back ? hy - 2.4 : hy - r - 0.6;
        g.save(); g.translate(0, by); g.rotate(-0.35); rr(g, -4.2, -0.4, 8.4, 0.8, 0.3); g.fillStyle = '#c9a66b'; g.fill(); outline(g, 0.25); g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(4.2, -0.4); g.lineTo(5.2, 0); g.lineTo(4.2, 0.4); g.closePath(); g.fill(); g.restore();
        if (C.back) return; const ex = C.fx * 1.8;
        g.strokeStyle = '#3a2a1a'; g.lineWidth = 0.45; g.lineCap = 'round'; g.beginPath(); g.moveTo(-5.2 + ex * 0.3, hy - 3.6); g.quadraticCurveTo(-7.6 + ex * 0.3, hy - 0.8, -6.6 + ex * 0.3 + Math.sin(time * 2 + C.seed) * 0.3, hy + 2.4); g.stroke();
      },
    },

    // ---------- Pip: the boy who hid under the hatch for two days; going to be a knight when he is big ----------
    // a child, a ginger mop with a cowlick, freckles, a hand-me-down tunic with the sleeves rolled, a patched knee, one boot
    // (he is still looking for the other); a wooden sword and a pot-lid shield with a red cross painted on
    pip: {
      build: 'child', skin: SKIN.fair,
      face: { eye: '#2f5a86', eyes: 'big', brow: '#a8602a', browW: 0.7, freckles: true, mouth: 'grin', blush: 'rgba(232,108,110,0.5)' },
      hair: { style: 'curly', c: '#c9843a' },
      body: { kind: 'tunic', c: '#4a5a6a', under: '#e9dcc0', len: 0.6, sleeve: '#56687a', rolled: '#e9dcc0', belt: false, laces: true },
      legs: { c: '#6a5a48', patch: '#9a7a52', feet: '#ddd3bd' },
      held: { kind: 'hf_woodsword' },
      off: { kind: 'hf_potlid' },
      torso: (g, C) => { hf_ropeBelt(g, C, '#c9a66b'); hf_pipFeet(g, C); },
      // the cowlick that will not lie down
      head: (g, C) => {
        const hy = C.B.hy, r = C.B.hr, hx = C.back ? 0.8 : C.fx * 0.7, c = '#c9843a', wob = Math.sin(time * 3 + C.seed) * 0.3 + C.step * 0.3;
        g.beginPath(); g.moveTo(hx - 1.6, hy - r + 0.2); g.quadraticCurveTo(hx - 2.2, hy - r - 2.6, hx + 0.2 + wob, hy - r - 3.6); g.quadraticCurveTo(hx - 0.4, hy - r - 1.8, hx + 0.6, hy - r + 0.2); g.closePath();
        g.moveTo(hx + 0.2, hy - r + 0.2); g.quadraticCurveTo(hx + 0.6, hy - r - 1.8, hx + 2.4 + wob, hy - r - 2.2); g.quadraticCurveTo(hx + 1.6, hy - r - 0.8, hx + 2, hy - r + 0.6); g.closePath();
        g.fillStyle = vfill(g, c, hy - r - 3.6, hy - r + 0.6, 0.3, -0.1); g.fill(); outline(g, 0.4);
      },
    },

    // ---------- Hob: came back down the road when he heard a knight was paying for planks ----------
    // broad, a cloth cap, a bushy black moustache and a day's stubble, a leather waistcoat, sleeves rolled, sawdust on him;
    // a plank stood on end and a hand saw
    hob: {
      build: 'adult', size: 1.03, geo: { w: 8.6, gap: 3.8 }, skin: SKIN.tan,
      face: { eye: '#2a1a10', brow: '#2a1a0a', browW: 1.1, browIn: 1.3, browTilt: 0.12, mouth: 'smile', lip: '#8a3e36', blush: 'rgba(210,100,80,0.35)' },
      hair: { style: 'short', c: '#3a2a1a' },
      beard: { style: 'stubble', c: '#2a1a0a' },
      hat: { kind: 'cap', c: '#5f7048' },
      body: { kind: 'tunic', c: '#7a5a3a', under: '#d9c9a8', laces: true, sleeve: '#6a4a2e', rolled: '#d9c9a8', belt: '#3a2614', buckle: '#a8a090', pouch: '#5a3a22' },
      legs: { c: '#5a5040', boot: '#3a2a1c', cuff: '#6a4a2e', patch: '#7a6a50' },
      held: { kind: 'hf_plank' },
      off: { kind: 'hf_saw' },
      // sawdust on his shoulders and waistcoat
      collar: (g, C) => hf_kerchief(g, C, '#3f5f8a', '#e8dcc0'),
      torso: (g, C) => { hf_braces(g, C, '#3a2a1c', '#c9a64a'); g.fillStyle = 'rgba(236,214,160,0.85)'; for (const [x, y] of C.back ? [[-4, -2.6], [3.6, -1.4], [-1, 1.2], [5, 2.6]] : [[-5.6, -1.6], [-3.2, 1.4], [5.4, -2.2], [4.2, 2.8], [-5, 4.4], [6, 6.4]]) { ell(g, x, C.B.sh + 2 + y, 0.35, 0.28); g.fill(); } },
      head: (g, C) => { if (C.back) return; npc_beard(g, C, { hy: C.B.hy, r: C.B.hr, ex: C.fx * 1.8, ey: C.fy * 1.2 }, { style: 'moustache', c: '#2a1a0a' }); },
    },

    // ---------- Wenna: came home the day she heard the well was working ----------
    // blond braids tied with blue, a cornflower behind her ear, a slate-blue dress, a russet knitted shawl; a pail of well water
    wenna: {
      build: 'adult', skin: SKIN.fair,
      face: { eye: '#3a5a8a', lash: '#3a2414', brow: '#b08a4a', browW: 0.65, browTilt: -0.1, mouth: 'smile', lip: '#c0645e', blush: 'rgba(235,120,120,0.45)' },
      hair: { style: 'braids', c: '#e0c080', tie: '#6a8ac0' },
      body: { kind: 'dress', c: '#5a6a7a', under: '#efe4cc', lace: '#3a4a5a', sleeve: '#4e5e6e', puff: true, belt: '#3a4a5a', knot: false },
      over: [{ kind: 'shawl', c: '#a8643e' }],
      legs: { boot: '#4a3020' },
      held: { kind: 'hf_bucket' },
      head: (g, C) => { if (C.back) { hf_flower(g, 5.6, C.B.hy - 2.4, '#5a7ad0'); return; } hf_flower(g, C.B.hr - 1.2 + C.fx * 0.6, C.B.hy - 3.6, '#5a7ad0'); },
    },

    // ---------- Old Harl the ferryman: rows the knight over the Grey Sea; the sea is calm today, it won't stay that way ----------
    // a yellow oilskin sou'wester and a long dark-green oilskin coat over a cream roll-neck, a white sea-captain's beard,
    // a squint and a wind-red nose, tall sea boots; his oar stood on its handle, and the ferry lantern
    harl: {
      build: 'adult', size: 1.04, geo: { w: 8.4 }, skin: '#d29a6c', hand: '#c98e62',
      face: { eye: '#2a2a3a', lines: true, brow: '#ece6da', browW: 1.5, browIn: 1.1, browTilt: 0.3, nose: 'big', noseC: '#d8705a', mouth: 'flat', blush: 'rgba(210,80,70,0.45)' },
      hair: { style: 'short', c: '#d9d0c0' },
      beard: { style: 'full', c: '#e2dace' },
      body: { kind: 'coat', c: '#3f4f3a', under: '#ddd3bf', sleeve: '#34422f', button: '#c9b48a', belt: '#2a2a26', buckle: '#a8a090', pouch: false },
      legs: { c: '#3a3a34', boot: '#24241f', cuff: '#4a4a42' },
      held: { kind: 'hf_oar' },
      off: { kind: 'lantern' },
      // the oilskin shines where the light catches it; salt spray dried white on it
      torso: (g, C) => {
        const B = C.B, hem = B.hem + 2.4;
        g.strokeStyle = 'rgba(255,255,255,0.24)'; g.lineWidth = 0.7; g.lineCap = 'round';
        for (const s of C.back ? [-1, 1] : [-1]) { g.beginPath(); g.moveTo(s * (B.w - 1.6), B.sh + 2); g.quadraticCurveTo(s * (B.w - 0.6), (B.sh + hem) / 2, s * (B.w - 1.2), hem - 1.4); g.stroke(); }
        g.fillStyle = 'rgba(235,240,235,0.26)'; for (const [x, y] of [[-5, 7.4], [-3.6, 9], [5.4, 8.2], [4.4, 1.2]]) { ell(g, x, y, 0.5, 0.32); g.fill(); }
      },
      collar: (g, C) => hf_rollneck(g, C, '#e2d8c4'),
      head: (g, C) => hf_souwester(g, C, '#d8a838'),
    },

    // ---------- Salt Pete of Gull Isle: sells lobster pots and rods by his fire, buys fish, and owes Harl a lobster ----------
    // sun-browned, a straw hat with a gull's feather in its band, a white ponytail, a braided beard with shell beads,
    // a canvas smock over a striped sailor's shirt, a rope belt, trousers rolled to the knee, bare feet; a rod and a lobster
    pete: {
      build: 'adult', skin: '#b97a4e', hand: '#b0724a',
      face: { eye: '#2a1a10', age: 'elder', eyes: 'happy', brow: '#ece6da', browW: 1.2, browTilt: -0.2, nose: 'big', noseC: '#c46a48', mouth: 'grin', blush: 'rgba(200,80,60,0.4)' },
      hair: { style: 'short', c: '#e6e0d0' },
      beard: { style: 'forked', c: '#e6e0d0' },
      hat: { kind: 'straw', c: '#d9c88a', band: '#3a6a8a' },
      body: { kind: 'tunic', c: '#8a7a5a', under: '#f2ece0', len: -1.8, sleeve: '#7a6a4a', rolled: '#e9e0cc', belt: false },
      legs: { bare: '#b97a4e', feet: '#b0724a', w: 3.8 },
      held: { kind: 'hf_rod' },
      off: { kind: 'hf_lobster' },
      torso: (g, C) => {
        const B = C.B, y0 = B.sh;
        hf_rolledTrousers(g, C, '#6f86a0');
        if (!C.back) { g.save(); g.beginPath(); g.moveTo(-2.6, y0 - 0.9); g.lineTo(0, y0 + 3); g.lineTo(2.6, y0 - 0.9); g.closePath(); g.clip(); g.fillStyle = '#2f5f8a'; for (const y of [y0 - 0.5, y0 + 0.6, y0 + 1.7]) g.fillRect(-3, y, 6, 0.5); g.restore(); }
        hf_ropeBelt(g, C, '#d9bf86');
        // a patch on the smock
        if (!C.back) hf_patch(g, 5, B.sh + 7.2, 2.6, 2.4, '#5a7a8a', 0.2); else hf_patch(g, -3, B.sh + 3.4, 2.8, 2.6, '#5a7a8a', -0.1);
      },
      // a gull's feather in the hat band, and loose straws at the brim's edge
      head: (g, C) => {
        const hy = C.B.hy, r = C.B.hr, ex = C.fx * 1.8;
        g.strokeStyle = '#b8a462'; g.lineWidth = 0.35; for (const [x, a] of [[-r - 5, -0.3], [r + 5, 0.4], [-r - 3.8, 0.6]]) { g.beginPath(); g.moveTo(x + ex * 0.3, hy - 3 + a); g.lineTo(x + ex * 0.3 + Math.sign(x) * 1.4, hy - 2.6 + a * 2); g.stroke(); }
        hf_feather(g, (C.back ? r - 1.6 : -r + 1.8) + ex * 0.3, hy - 4.2, C.back ? 0.5 : -0.55);
      },
    },
  });

  // ---------- groups/sky.js ----------
  // ================= THE SKY FOLK: Aerie and the Cloud Kingdom, drawn in full =================
  // Everyone who lives above the clouds keeps the wings they have in the game today, at the game's own wing size for each
  // person. The wings are the base's feathered wings (mob-sample's sky sentinel) with a little of each person in them:
  // gold-edged for the Queen, soot-tipped for the smith, hawk-barred for the Rookery keeper, ragged and grey for Old Ferris,
  // swept back for the runners, downy for the children. Pale sky colours, gold, feathers, and each one's own trade in hand.
  // Everyone here is a spec for npc() from npc-base.js plus a few special pieces, the way groups/reference.js does it.

  // ---------- the wings: one feather, one wing, the pair ----------
  // a feather from (x0, y0) at angle a: tip colour along its last third, barred like a hawk's when `bars` is a colour
  function sky_feather(g, x0, y0, a, len, w, c, edge, tip, bars) {
    const ca = Math.cos(a), sa = Math.sin(a), cx = x0 + ca * len / 2, cy = y0 + sa * len / 2;
    ell(g, cx, cy, len / 2, w / 2, a);
    if (tip) { const gr = g.createLinearGradient(x0, y0, x0 + ca * len, y0 + sa * len); gr.addColorStop(0, c); gr.addColorStop(0.55, c); gr.addColorStop(0.82, tip); gr.addColorStop(1, tip); g.fillStyle = gr; } else g.fillStyle = c;
    g.fill(); outline(g, 0.45);
    if (bars) { g.save(); ell(g, cx, cy, len / 2, w / 2, a); g.clip(); g.strokeStyle = bars; g.lineWidth = 0.55; for (let t = 0.32; t < 0.97; t += 0.16) { const px = x0 + ca * len * t, py = y0 + sa * len * t; g.beginPath(); g.moveTo(px + sa * w, py - ca * w); g.lineTo(px - sa * w, py + ca * w); g.stroke(); } g.restore(); }
    g.strokeStyle = edge || '#c9b676'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(x0 + ca, y0 + sa); g.lineTo(x0 + ca * len * 0.8, y0 + sa * len * 0.8); g.stroke();
  }
  // W = { scale, tone, edge, tip, bars, sheen, swept, down, ragged, flapK }
  function sky_wing(g, s, flap, W) {
    const F = W.tone || '#f6f2e4', edge = W.edge || '#c9b676', down = !!W.down, sw = W.swept ? 1 : 0;
    g.save(); g.scale(s, 1); g.rotate(-flap);
    const elbow = [5, -7], wrist = down ? [9, -9.6] : [11 - sw * 1, -11 - sw * 1.2];
    // the long flight feathers, out from the wrist and down to the elbow
    const nP = down ? 4 : 6;
    for (let k = nP - 1; k >= 0; k--) {
      // Old Ferris has lost one
      if (W.ragged && k === 2) continue;
      const t = k * (down ? 0.26 : 0.17), bx = lerp(wrist[0], elbow[0], t), by = lerp(wrist[1], elbow[1], t);
      let len = (12.4 - k * 0.6) * (down ? 0.6 : 1) * (sw ? 1.1 : 1); if (W.ragged && (k === 1 || k === 4)) len *= 0.74;
      const a = sw ? -0.92 + k * 0.3 : -0.5 + k * 0.33;
      sky_feather(g, bx, by, a + (W.ragged && k === 3 ? 0.18 : 0), len, down ? 4.4 : 3.6, shade(F, -0.05 - k * 0.02), edge, W.tip, W.bars);
    }
    // the shorter feathers along the arm
    const nS = down ? 3 : 5;
    for (let j = nS - 1; j >= 0; j--) { const t = j / (nS - 1), bx = lerp(1.4, elbow[0] + 2, t), by = lerp(-1.2, elbow[1] + 0.6, t); sky_feather(g, bx, by, 1.5 - j * 0.1 + sw * 0.12, (9.6 - j * 0.5) * (down ? 0.7 : 1), down ? 4 : 3.4, shade(F, -0.02 - j * 0.015), edge, W.tip ? shade(W.tip, 0.35) : null, W.bars); }
    // the coverts: the soft top of the wing, scalloped
    const cov = () => { g.beginPath(); g.moveTo(-0.6, 1.4); g.quadraticCurveTo(1.6, -9, wrist[0] + 1.2, wrist[1] - 1.4); g.quadraticCurveTo(wrist[0] + 2.4, wrist[1] + 2.4, wrist[0] - 0.4, wrist[1] + 4.4);
      for (let k = 0; k < 4; k++) { const x = wrist[0] - 2.6 - k * (down ? 2 : 2.8), y = wrist[1] + 6.4 + k * 2; g.quadraticCurveTo(x + 1.6, y + 1.6, x, y); }
      g.quadraticCurveTo(0.6, 1.6, -0.6, 1.4); g.closePath(); };
    cov(); g.fillStyle = vfill(g, F, -12, 2, 0.6, -0.06); g.fill(); outline(g, 0.55);
    g.save(); cov(); g.clip(); g.strokeStyle = edge; g.lineWidth = 0.4; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(3 + k * 2.6, -3.6 - k * 2.2, 1.6, 0.2, Math.PI - 0.2); g.stroke(); }
    if (down) { g.fillStyle = 'rgba(255,255,255,0.7)'; for (const [x, y] of [[2.2, -2], [4.6, -4.4], [6.6, -6.8], [3.4, -6.4]]) { ell(g, x, y, 1.1, 0.9); g.fill(); } }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0.4, -0.6); g.quadraticCurveTo(2.4, -8.4, wrist[0] + 0.6, wrist[1] - 0.8); g.stroke();
    if (W.sheen) { g.strokeStyle = W.sheen; g.lineWidth = 0.5; g.beginPath(); g.moveTo(1, -1.6); g.quadraticCurveTo(2.8, -8.8, wrist[0] + 0.2, wrist[1] - 1.6); g.stroke(); }
    g.restore();
  }
  // the pair, at the shoulder blades; they settle and lift a little standing, beat as they walk, ruffle as they talk
  function sky_wings(g, C, W) {
    const k = Math.max(W.flapK || 1, C.e.flapK || 1);
    const flap = Math.sin(time * 2.2 * k + C.seed) * 0.08 * k + (C.e.moving ? Math.sin(C.e.walkT * 0.5) * 0.12 : 0) + (C.talk ? Math.sin(C.tt * 3) * 0.06 : 0);
    g.save(); g.translate(0, C.B.sh + 3 + (C.back ? 0 : C.bob)); g.scale(1.05 * (W.scale || 1), 1.05 * (W.scale || 1));
    for (const s of [-1, 1]) { g.save(); g.translate(s * 3, 0); sky_wing(g, s, flap, W); g.restore(); }
    g.restore();
  }
  // a sky person: the spec, with their own wings drawn first behind them (facing us) and over the back (facing away)
  function sky_person(W, P) {
    const b0 = P.behind, k0 = P.back;
    return Object.assign({}, P, {
      behind: (g, C) => { sky_wings(g, C, W); if (b0) b0(g, C); },
      back: (g, C) => { sky_wings(g, C, W); if (k0) k0(g, C); },
    });
  }

  // ---------- small shared pieces ----------
  // a little pair of wings as a badge or a pin (the Wingwrights wear silver, the Gate and the throne room gold)
  function sky_wingBadge(g, x, y, c, k) {
    k = k || 1; g.save(); g.translate(x, y); g.scale(k, k);
    for (const s of [-1, 1]) for (let f = 0; f < 3; f++) { g.beginPath(); g.moveTo(s * 0.5, 0.4); g.quadraticCurveTo(s * (1.6 + f * 0.6), -1.4 - f * 0.5, s * (2.6 + f * 0.5), -0.6 - f * 0.7); g.quadraticCurveTo(s * (1.6 + f * 0.4), 0.2, s * 0.5, 1.2); g.closePath(); g.fillStyle = f ? shade(c, 0.15 * f) : c; g.fill(); g.strokeStyle = 'rgba(40,30,10,0.55)'; g.lineWidth = 0.25; g.stroke(); }
    ell(g, 0, 0.6, 0.8, 0.8); g.fillStyle = metal(g, c, -0.2, 1.4); g.fill(); g.strokeStyle = 'rgba(40,30,10,0.6)'; g.lineWidth = 0.25; g.stroke();
    g.restore();
  }
  // a feather tucked behind the ear (or in a hat band): from (x, y) up and out at angle a
  function sky_tuck(g, x, y, a, len, c, tip, bars) { sky_feather(g, x, y, a, len, 2.2, c, shade(c, -0.35), tip, bars); }
  // a scarf at the throat, the tails streaming away behind them
  function sky_scarf(g, C, c, stripe) {
    const B = C.B, y = B.sh + 0.6, wv = Math.sin(time * 5 + C.seed) * 0.8 + C.step * 0.8, run = C.e.moving ? 1.6 : 0;
    // the tails (behind the far shoulder when side-on, over the back facing away)
    const tails = (x0, y0, dir) => { for (const [dx, dl] of [[0, 0], [0.9, -1.6]]) { g.beginPath(); g.moveTo(x0 + dx * dir, y0); g.quadraticCurveTo(x0 + dir * (3 + run) + wv * 0.4, y0 + 3, x0 + dir * (4.6 + run * 2) + wv, y0 + 7 + dl - run); g.lineTo(x0 + dir * (3 + run * 2) + wv, y0 + 7.4 + dl - run); g.quadraticCurveTo(x0 + dir * (1.8 + run) + wv * 0.3, y0 + 3.6, x0 + dx * dir - dir * 1.4, y0 + 0.6); g.closePath(); g.fillStyle = vfill(g, c, y0, y0 + 8, 0.25, -0.3); g.fill(); outline(g, 0.4); if (stripe) { g.strokeStyle = stripe; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x0 + dir * (4 + run * 2) + wv * 0.9, y0 + 5.6 + dl - run); g.lineTo(x0 + dir * (2.6 + run * 2) + wv * 0.9, y0 + 6 + dl - run); g.stroke(); } } };
    if (C.back) tails(-0.6, y + 0.6, -1);
    rr(g, -4.6, y - 1.6, 9.2, 2.6, 1.3); g.fillStyle = vfill(g, c, y - 1.6, y + 1, 0.3, -0.25); g.fill(); outline(g, 0.5);
    if (stripe) { g.strokeStyle = stripe; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-4.2, y - 0.3); g.lineTo(4.2, y - 0.3); g.stroke(); }
    if (!C.back) { ell(g, -1.6, y + 0.4, 1.3, 1.1); g.fillStyle = shade(c, -0.1); g.fill(); outline(g, 0.4); tails(-1.8, y + 0.9, -1); }
  }
  // a sack on the back: facing us its top peeks over the shoulder, facing away it is all there (o = { c, tie, stamp, full })
  function sky_sackPeek(g, C, o) {
    const B = C.B, x = -B.w - 0.8, y = B.sh - 3 + C.bob;
    g.beginPath(); g.moveTo(x - 4, y + 3); g.quadraticCurveTo(x - 4.4, y - 2, x - 1.4, y - 2.8); g.quadraticCurveTo(x + 0.6, y - 4.6, x + 2.4, y - 2.2); g.quadraticCurveTo(x + 4, y - 0.6, x + 3.6, y + 3); g.closePath();
    g.fillStyle = vfill(g, o.c, y - 4, y + 3, 0.25, -0.3); g.fill(); outline(g, 0.6);
    if (o.full) o.full(g, x, y - 2.6);
    g.strokeStyle = shade(o.c, -0.35); g.lineWidth = 0.35; g.beginPath(); g.moveTo(x - 2.6, y - 0.6); g.quadraticCurveTo(x - 0.6, y - 1.4, x + 1.8, y - 0.4); g.stroke();
  }
  function sky_sackBack(g, C, o) {
    const B = C.B, x = 0.6, y0 = B.sh - 3.4, y1 = B.waist + 3.4;
    const sack = () => { g.beginPath(); g.moveTo(x - 4.6, y0 + 2); g.quadraticCurveTo(x - 7, (y0 + y1) / 2, x - 5.4, y1); g.quadraticCurveTo(x, y1 + 1.6, x + 5.4, y1); g.quadraticCurveTo(x + 7, (y0 + y1) / 2, x + 4.6, y0 + 2); g.quadraticCurveTo(x, y0 + 0.4, x - 4.6, y0 + 2); g.closePath(); };
    sack(); g.fillStyle = vfill(g, o.c, y0, y1, 0.25, -0.32); g.fill(); outline(g, 0.75);
    g.save(); sack(); g.clip(); g.strokeStyle = shade(o.c, -0.3); g.lineWidth = 0.4; for (const dx of [-3, 0.4, 3.6]) { g.beginPath(); g.moveTo(x + dx * 0.6, y0 + 3); g.quadraticCurveTo(x + dx * 1.1, (y0 + y1) / 2, x + dx, y1); g.stroke(); }
    if (o.patch) { rr(g, x + 1.4, y0 + 7, 3, 2.6, 0.4); g.fillStyle = o.patch; g.fill(); g.strokeStyle = 'rgba(40,24,10,0.6)'; g.lineWidth = 0.3; g.setLineDash([0.5, 0.5]); g.stroke(); g.setLineDash([]); }
    if (o.stamp) o.stamp(g, x, (y0 + y1) / 2 + 0.6);
    g.restore();
    // the neck, tied off, with a tuft
    g.beginPath(); g.moveTo(x - 2.4, y0 + 1.8); g.quadraticCurveTo(x - 1.6, y0 - 2.2, x - 2.8, y0 - 3.4); g.lineTo(x + 2.8, y0 - 3.4); g.quadraticCurveTo(x + 1.6, y0 - 2.2, x + 2.4, y0 + 1.8); g.closePath(); g.fillStyle = vfill(g, o.c, y0 - 3.4, y0 + 2, 0.3, -0.2); g.fill(); outline(g, 0.5);
    if (o.full) o.full(g, x, y0 - 3.2);
    g.strokeStyle = o.tie || '#8a6a3a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 2, y0); g.lineTo(x + 2, y0); g.stroke();
    // the strap over the shoulder
    g.strokeStyle = o.strap || '#5a3a20'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-B.w + 1.4, B.sh - 0.4); g.quadraticCurveTo(x - 4, y0 + 1, x - 4.6, y0 + 3); g.stroke();
  }
  // a strap or rope across the chest, from the off shoulder to the main hip
  function sky_strap(g, C, c, w) { if (C.back) return; g.strokeStyle = c; g.lineWidth = w || 1.1; g.beginPath(); g.moveTo(-C.B.w + 1.4, C.B.sh - 0.4); g.lineTo(C.B.w - 2.2, C.B.waist - 0.2); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-C.B.w + 1.6, C.B.sh - 0.9); g.lineTo(C.B.w - 2, C.B.waist - 0.7); g.stroke(); }
  // head-relative numbers for the special head pieces
  const sky_H = C => ({ hy: C.B.hy, r: C.B.hr, ex: C.fx * 1.8, ey: C.fy * 1.2 });

  // ---------- the things they hold (the hand is at 0, 0; upright is -y) ----------
  const sky_ground = C => (C.B.hip + C.B.leg) - C.B.hand.y + 0.6;
  // the Queen's lyre: a little gold lyre, the strings shimmering when she talks (she sings the Song of Above)
  PROPS.sky_lyre = (g, C, o) => {
    const c = o.c || '#e8b84a';
    g.save(); g.translate(0.6, 0);
    g.lineCap = 'round';
    const arms = () => { g.beginPath(); for (const s of [-1, 1]) { g.moveTo(s * 1, 0.6); g.quadraticCurveTo(s * 4.4, -2.4, s * 3, -6.6); g.quadraticCurveTo(s * 2.4, -9.2, s * 3.6, -10.2); } };
    g.strokeStyle = OUT; g.lineWidth = 2; arms(); g.stroke(); g.strokeStyle = metal(g, c, -10, 1); g.lineWidth = 1.2; arms(); g.stroke();
    rr(g, -3.4, -8.6, 6.8, 1.2, 0.5); g.fillStyle = metal(g, c, -8.6, -7.4); g.fill(); outline(g, 0.35);
    rr(g, -1.8, -0.2, 3.6, 1.6, 0.6); g.fillStyle = metal(g, c, -0.2, 1.4); g.fill(); outline(g, 0.35);
    const hum = C.talk ? Math.sin(C.tt * 30) * 0.25 : 0;
    g.strokeStyle = 'rgba(255,250,235,0.9)'; g.lineWidth = 0.28; for (const x of [-1.5, -0.5, 0.5, 1.5]) { g.beginPath(); g.moveTo(x, -7.4); g.quadraticCurveTo(x + hum, -3.6, x * 0.7, -0.2); g.stroke(); }
    gem(g, 0, -8, 0.7, '#5ab0f0');
    g.restore();
  };
  // a shard of stormglass: lightning caught in blue crystal, flickering
  PROPS.sky_shard = (g, C, o) => {
    const p = 0.6 + Math.sin(time * 5 + C.seed) * 0.25, fl = Math.sin(time * 23) > 0.6;
    const gl = g.createRadialGradient(0, -5, 0, 0, -5, 8); gl.addColorStop(0, `rgba(170,220,255,${0.55 * p})`); gl.addColorStop(1, 'rgba(170,220,255,0)'); g.fillStyle = gl; ell(g, 0, -5, 8, 8); g.fill();
    const sh = () => { g.beginPath(); g.moveTo(0.2, -9.6); g.lineTo(2, -5.4); g.lineTo(1.4, -0.8); g.lineTo(-1.2, -0.6); g.lineTo(-2, -5.8); g.closePath(); };
    sh(); const gr = g.createLinearGradient(-2, -9, 2, 0); gr.addColorStop(0, '#e8f6ff'); gr.addColorStop(0.5, '#7ab8e8'); gr.addColorStop(1, '#3a6aa8'); g.fillStyle = gr; g.fill(); outline(g, 0.5);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(0.2, -9.6); g.lineTo(-0.2, -4.6); g.lineTo(1.4, -0.8); g.moveTo(-0.2, -4.6); g.lineTo(-2, -5.8); g.stroke();
    g.strokeStyle = fl ? '#ffffff' : '#d8f0ff'; g.lineWidth = fl ? 0.6 : 0.4; g.beginPath(); g.moveTo(0.6, -8); g.lineTo(-0.6, -6); g.lineTo(0.8, -4.6); g.lineTo(-0.4, -2.4); g.stroke();
    if (fl) sparkle(g, 1.8, -8.4, 1.4, '#ffffff');
  };
  // Keeper Pell's skyhawk, sitting on his gloved fist, looking about; it bates its wings when he talks
  PROPS.sky_hawk = (g, C, o) => {
    const look = Math.sin(time * 0.8 + 1) > -0.3 ? 1 : -1, bate = C.talk ? Math.max(0, Math.sin(C.tt * 7)) : 0;
    g.save(); g.scale(1.3, 1.3);
    // the tail, under the fist
    g.beginPath(); g.moveTo(-1, -2.4); g.lineTo(-0.4, 5.6); g.lineTo(1.4, 5.8); g.lineTo(1.4, -2.4); g.closePath(); g.fillStyle = vfill(g, '#8a6a46', -2, 6, 0.2, -0.3); g.fill(); outline(g, 0.4);
    g.strokeStyle = '#4a3020'; g.lineWidth = 0.4; for (const y of [0.6, 2.4, 4.2]) { g.beginPath(); g.moveTo(-0.7, y); g.lineTo(1.4, y); g.stroke(); }
    // the body, the cream chest barred brown, the folded wing (spread when it bates)
    for (const s of bate > 0.2 ? [-1, 1] : []) { g.save(); g.translate(s * 1.6, -6.2); g.rotate(s * (0.6 + bate * 0.6)); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 2, -3.6, s * 7.4, -4.4); g.quadraticCurveTo(s * 5, -1, s * 1.4, 2.4); g.closePath(); g.fillStyle = vfill(g, '#7a5a3a', -4, 2, 0.25, -0.25); g.fill(); outline(g, 0.4); g.restore(); }
    ell(g, 0.2, -5, 2.8, 3.8); g.fillStyle = rfill(g, '#7a5a3a', 0.2, -5, 3.8); g.fill(); outline(g, 0.55);
    ell(g, 0.6 * look, -4.4, 1.8, 2.8); g.fillStyle = vfill(g, '#f0e2c4', -7, -1.6, 0.15, -0.15); g.fill();
    g.strokeStyle = '#7a5230'; g.lineWidth = 0.35; for (const y of [-5.6, -4.4, -3.2, -2.2]) { g.beginPath(); g.moveTo(0.6 * look - 1.2, y); g.quadraticCurveTo(0.6 * look, y + 0.5, 0.6 * look + 1.2, y); g.stroke(); }
    if (bate <= 0.2) { ell(g, -1.2 * look, -5, 1.8, 3.4, 0.15 * look); g.fillStyle = vfill(g, '#6a4a2e', -8, -1.6, 0.2, -0.25); g.fill(); outline(g, 0.35); g.strokeStyle = '#d9c09a'; g.lineWidth = 0.3; for (const y of [-5.6, -4, -2.6]) { g.beginPath(); g.arc(-1.2 * look, y, 1, 0.3, 2.6); g.stroke(); } }
    // the head: a dark cap, a yellow eye, a hooked beak
    g.save(); g.translate(0.4, -9.6); g.scale(look, 1);
    ell(g, 0, 0, 2.2, 2); g.fillStyle = rfill(g, '#7a5a3a', 0, 0, 2.2); g.fill(); outline(g, 0.45);
    g.fillStyle = '#3a2618'; g.beginPath(); g.ellipse(-0.2, -0.6, 2, 1.3, 0, Math.PI, 0); g.fill();
    ell(g, 0.6, 0.6, 1.3, 0.9); g.fillStyle = '#f0e2c4'; g.fill();
    ell(g, 1, -0.3, 0.55, 0.55); g.fillStyle = '#f5c542'; g.fill(); ell(g, 1.1, -0.3, 0.26, 0.26); g.fillStyle = '#140c06'; g.fill();
    g.beginPath(); g.moveTo(1.7, -0.6); g.quadraticCurveTo(3.4, -0.6, 3, 1); g.quadraticCurveTo(2.6, 0.5, 1.8, 0.6); g.closePath(); g.fillStyle = '#4a4f5a'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.3; g.stroke();
    g.fillStyle = '#e8c048'; ell(g, 1.8, -0.2, 0.45, 0.4); g.fill();
    g.restore(); g.restore();
  };
  // the leather gauntlet he holds her on, and her talons round it
  PROP_OVER.sky_hawk = (g, C, o) => {
    rr(g, -2.4, -0.6, 4.8, 4.6, 1.2); g.fillStyle = vfill(g, '#8a5a30', -0.6, 4, 0.25, -0.3); g.fill(); outline(g, 0.45);
    g.strokeStyle = '#d9b07a'; g.lineWidth = 0.3; g.setLineDash([0.5, 0.5]); g.beginPath(); g.moveTo(-2.2, 2.4); g.lineTo(2.2, 2.4); g.stroke(); g.setLineDash([]);
    ell(g, 0, -0.4, 2.3, 2.1); g.fillStyle = rfill(g, '#9a6a3a', 0, -0.4, 2.3); g.fill(); outline(g, 0.45);
    g.strokeStyle = '#f5c542'; g.lineWidth = 0.6; g.lineCap = 'round'; for (const x of [-1, 0.4, 1.4]) { g.beginPath(); g.moveTo(x, -2.4); g.lineTo(x + 0.2, -1.4); g.stroke(); }
    g.strokeStyle = '#1a120a'; g.lineWidth = 0.35; for (const x of [-1, 0.4, 1.4]) { g.beginPath(); g.arc(x + 0.5, -1.2, 0.5, Math.PI * 0.9, Math.PI * 1.7, true); g.stroke(); }
  };
  // a fish hanging by its tail from the hand: what you put on a perch for a skyhawk
  PROPS.sky_fish = (g, C, o) => {
    const sw = Math.sin(time * 2.6 + C.seed) * 0.12 + C.step * 0.1; g.save(); g.rotate(sw);
    g.beginPath(); g.moveTo(-0.2, 0.6); g.lineTo(-1.8, -1); g.lineTo(1.6, -1); g.closePath(); g.fillStyle = '#6a8aa8'; g.fill(); outline(g, 0.35);
    ell(g, 0, 4.6, 1.7, 4); g.fillStyle = (() => { const gr = g.createLinearGradient(-1.7, 0, 1.7, 0); gr.addColorStop(0, '#5a7a9a'); gr.addColorStop(0.5, '#c8d8e8'); gr.addColorStop(1, '#8aa0b8'); return gr; })(); g.fill(); outline(g, 0.45);
    g.strokeStyle = '#4a6a8a'; g.lineWidth = 0.3; for (const y of [3, 4.6, 6.2]) { g.beginPath(); g.arc(0, y - 0.6, 1, 0.5, Math.PI - 0.5); g.stroke(); }
    ell(g, 0.5, 7.4, 0.42, 0.42); g.fillStyle = '#1a1a22'; g.fill();
    g.restore();
  };
  // a glass jar with a cork: bottled cloud (Quill sells it), or Tilly's cloud fish, there only when you are not looking
  PROPS.sky_jar = (g, C, o) => {
    g.save(); g.translate(1.6, 0.4);
    const jar = () => { g.beginPath(); g.moveTo(-1.6, -2.2); g.lineTo(-1.6, -1.2); g.quadraticCurveTo(-3.2, -0.6, -3.1, 2); g.lineTo(-3, 5.4); g.quadraticCurveTo(-3, 6.6, -1.8, 6.6); g.lineTo(1.8, 6.6); g.quadraticCurveTo(3, 6.6, 3, 5.4); g.lineTo(3.1, 2); g.quadraticCurveTo(3.2, -0.6, 1.6, -1.2); g.lineTo(1.6, -2.2); g.closePath(); };
    jar(); g.fillStyle = o.fish ? 'rgba(170,215,240,0.55)' : 'rgba(200,225,250,0.45)'; g.fill();
    g.save(); jar(); g.clip();
    if (o.fish) {
      const a = time * 1.6 + C.seed, x = Math.cos(a) * 1.4, y = 3 + Math.sin(a * 2) * 1.2, d = -Math.sin(a) >= 0 ? 1 : -1, seen = 0.25 + 0.75 * Math.max(0, Math.sin(time * 0.9));
      g.globalAlpha *= seen; g.save(); g.translate(x, y); g.scale(d, 1);
      ell(g, 0, 0, 1.4, 0.8); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = 'rgba(90,140,200,0.8)'; g.lineWidth = 0.3; g.stroke();
      g.beginPath(); g.moveTo(-1.2, 0); g.lineTo(-2.3, -0.8); g.lineTo(-2.2, 0.8); g.closePath(); g.fillStyle = '#e8f4ff'; g.fill(); g.stroke();
      ell(g, 0.7, -0.15, 0.22, 0.22); g.fillStyle = '#2a4a7a'; g.fill(); g.restore();
      g.globalAlpha /= seen;
      g.fillStyle = 'rgba(255,255,255,0.7)'; for (const [bx, k] of [[1.6, 0], [-1, 0.5]]) { const by = 5.6 - ((time * 2 + k) % 1) * 6; ell(g, bx, by, 0.32, 0.32); g.fill(); }
    } else {
      for (const [x, y, r, k] of [[-0.8, 3.6, 1.9, 0], [1.2, 2.4, 1.6, 1], [0.4, 4.8, 1.8, 2], [-1.4, 1.6, 1.2, 3]]) { const dx = Math.sin(time * 1.3 + k) * 0.6; ell(g, x + dx, y, r, r * 0.8); g.fillStyle = rfill(g, '#f4f8ff', x + dx, y, r); g.fill(); }
    }
    g.restore();
    jar(); g.strokeStyle = 'rgba(40,60,90,0.6)'; g.lineWidth = 0.55; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-2.2, 0.8); g.lineTo(-2.2, 5); g.stroke();
    rr(g, -1.9, -3.8, 3.8, 2, 0.6); g.fillStyle = vfill(g, '#b8864a', -3.8, -1.8, 0.25, -0.25); g.fill(); outline(g, 0.4);
    g.strokeStyle = o.tie || '#2b5a7a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-1.8, -1.4); g.lineTo(1.8, -1.4); g.stroke();
    g.restore();
  };
  // the Spire Run's start flag: green, a white S on it, on a pole with a gold knob
  PROPS.sky_flag = (g, C, o) => {
    const top = -(o.len || 25), bot = sky_ground(C), wv = Math.sin(time * 5 + C.seed) * 0.9;
    rr(g, -0.7, top, 1.4, bot - top, 0.6); g.fillStyle = (() => { const gr = g.createLinearGradient(-0.7, 0, 0.7, 0); gr.addColorStop(0, '#c8d0dc'); gr.addColorStop(1, '#6e7b90'); return gr; })(); g.fill(); outline(g, 0.4);
    ell(g, 0, top - 0.6, 1.1, 1.1); g.fillStyle = rfill(g, '#f5c542', 0, top - 0.6, 1.1); g.fill(); outline(g, 0.35);
    const flag = () => { g.beginPath(); g.moveTo(0.7, top + 0.6); g.quadraticCurveTo(4.6, top + 1 + wv * 0.5, 9.4 + wv * 0.4, top + 3.6 + wv * 0.3); g.quadraticCurveTo(4.6, top + 5.4 + wv * 0.5, 0.7, top + 7); g.closePath(); };
    flag(); g.fillStyle = vfill(g, o.c || '#3fb950', top, top + 7, 0.25, -0.25); g.fill(); outline(g, 0.45);
    g.strokeStyle = '#ffffff'; g.lineWidth = 0.55; g.lineCap = 'round'; g.beginPath(); g.moveTo(4.6, top + 2.4 + wv * 0.4); g.quadraticCurveTo(2.6, top + 2.2, 3.2, top + 3.6); g.quadraticCurveTo(4.8, top + 4.4 + wv * 0.3, 3, top + 5.2); g.stroke();
  };
  // Old Ferris's snag hook: a long pole with an iron hook, rope wound under it
  PROPS.sky_snaghook = (g, C, o) => {
    const top = -24, bot = sky_ground(C);
    g.save(); g.rotate(0.05);
    rr(g, -0.8, top + 2, 1.6, bot - top - 2, 0.7); g.fillStyle = (() => { const gr = g.createLinearGradient(-0.8, 0, 0.8, 0); gr.addColorStop(0, '#a88a5a'); gr.addColorStop(1, '#5a4228'); return gr; })(); g.fill(); outline(g, 0.45);
    g.strokeStyle = '#c9b48a'; g.lineWidth = 0.5; for (let y = top + 6; y < top + 10; y += 0.9) { g.beginPath(); g.moveTo(-0.9, y); g.lineTo(0.9, y + 0.5); g.stroke(); }
    g.lineCap = 'round'; const hook = () => { g.beginPath(); g.moveTo(0, top + 3); g.lineTo(0, top - 1); g.arc(2.4, top - 1, 2.4, Math.PI, Math.PI * 2.15); };
    g.strokeStyle = OUT; g.lineWidth = 1.9; hook(); g.stroke(); g.strokeStyle = metal(g, '#7d8087', top - 4, top + 3); g.lineWidth = 1.1; hook(); g.stroke();
    g.fillStyle = '#7d8087'; g.beginPath(); g.moveTo(4.6, top - 0.6); g.lineTo(5.4, top + 0.6); g.lineTo(4.2, top + 0.2); g.closePath(); g.fill();
    g.restore();
  };
  // Bellweather's lamplighter's pole: brass, a little wick-holder burning at the top and a snuffer cone beside it
  PROPS.sky_lamppole = (g, C, o) => {
    const top = -27, bot = sky_ground(C), p = Math.sin(time * 9 + C.seed) * 0.3;
    rr(g, -0.6, top + 2, 1.2, bot - top - 2, 0.5); g.fillStyle = (() => { const gr = g.createLinearGradient(-0.6, 0, 0.6, 0); gr.addColorStop(0, '#fbe08a'); gr.addColorStop(1, '#9a7420'); return gr; })(); g.fill(); outline(g, 0.4);
    for (const y of [top + 9, -4]) { rr(g, -0.9, y, 1.8, 1, 0.4); g.fillStyle = '#c99a30'; g.fill(); outline(g, 0.3); }
    const gl = g.createRadialGradient(0, top - 2, 0, 0, top - 2, 7); gl.addColorStop(0, 'rgba(255,214,120,0.6)'); gl.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = gl; ell(g, 0, top - 2, 7, 7); g.fill();
    g.beginPath(); g.moveTo(-1.5, top + 0.4); g.lineTo(1.5, top + 0.4); g.lineTo(0.9, top + 2.4); g.lineTo(-0.9, top + 2.4); g.closePath(); g.fillStyle = metal(g, '#e0b546', top, top + 2.4); g.fill(); outline(g, 0.35);
    ell(g, 0, top - 1.6 + p * 0.3, 0.9, 1.7); g.fillStyle = '#ffb84a'; g.fill(); ell(g, 0, top - 1.2, 0.45, 0.9); g.fillStyle = '#fffbe8'; g.fill();
    // the snuffer: a little cone on an arm
    g.strokeStyle = '#9a7420'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0.4, top + 5); g.lineTo(3, top + 3); g.stroke();
    g.beginPath(); g.moveTo(2, top + 3.6); g.lineTo(3.2, top + 0.8); g.lineTo(4.4, top + 3.6); g.closePath(); g.fillStyle = metal(g, '#e0b546', top + 0.8, top + 3.6); g.fill(); outline(g, 0.3);
  };
  // Guildmaster Corvin's cane: black wood, a silver crow's head for a handle
  PROPS.sky_cane = (g, C, o) => {
    const bot = sky_ground(C);
    rr(g, -0.6, -4.4, 1.2, bot + 4.4, 0.5); g.fillStyle = (() => { const gr = g.createLinearGradient(-0.6, 0, 0.6, 0); gr.addColorStop(0, '#4a4458'); gr.addColorStop(1, '#141018'); return gr; })(); g.fill(); outline(g, 0.4);
    rr(g, -0.8, bot - 1, 1.6, 1.2, 0.4); g.fillStyle = '#c9d6ea'; g.fill();
    ell(g, 0, -5.4, 1.6, 1.4); g.fillStyle = metal(g, '#d4dce8', -7, -4); g.fill(); outline(g, 0.4);
    g.beginPath(); g.moveTo(1.2, -6); g.lineTo(3.4, -5.2); g.lineTo(1.2, -4.6); g.closePath(); g.fillStyle = metal(g, '#d4dce8', -6, -4.6); g.fill(); outline(g, 0.3);
    ell(g, 0.5, -5.8, 0.3, 0.3); g.fillStyle = '#2a3450'; g.fill();
  };
  // Merriweather's bowl of cloud soup: mostly steam
  PROPS.sky_soup = (g, C, o) => {
    g.save(); g.translate(0, -1.6);
    for (let k = 0; k < 3; k++) { const ph = (time * 0.6 + k / 3) % 1, x = -1.6 + k * 1.6 + Math.sin(time * 2 + k) * 0.6; g.strokeStyle = `rgba(255,255,255,${Math.sin(ph * Math.PI) * 0.8})`; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, -1 - ph * 3); g.quadraticCurveTo(x + 1.2, -3 - ph * 4, x, -5 - ph * 5); g.stroke(); }
    g.beginPath(); g.moveTo(-3.6, -0.6); g.quadraticCurveTo(-3.4, 3, 0, 3.2); g.quadraticCurveTo(3.4, 3, 3.6, -0.6); g.closePath(); g.fillStyle = vfill(g, '#e8dcc4', -0.6, 3.2, 0.2, -0.3); g.fill(); outline(g, 0.5);
    g.strokeStyle = '#3b6ab8'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-3.2, 0.8); g.quadraticCurveTo(0, 1.8, 3.2, 0.8); g.stroke();
    ell(g, 0, -0.6, 3.6, 1); g.fillStyle = '#f6efe2'; g.fill(); outline(g, 0.4); ell(g, 0, -0.5, 3, 0.7); g.fillStyle = '#f0f4fa'; g.fill();
    ell(g, 1, -0.6, 0.8, 0.35); g.fillStyle = '#ffffff'; g.fill();
    g.restore();
  };
  // Fen's little fishing net on a stick (there is no fish in the fountain; he looked)
  PROPS.sky_net = (g, C, o) => {
    const sw = Math.sin(time * 2 + C.seed) * 0.06 + C.step * 0.05; g.save(); g.rotate(0.12 + sw);
    rr(g, -0.6, -13, 1.2, 15.6, 0.5); g.fillStyle = vfill(g, '#b8864a', -13, 2, 0.3, -0.3); g.fill(); outline(g, 0.4);
    const cy = -16.2;
    g.beginPath(); g.moveTo(-2.8, cy); g.quadraticCurveTo(-2.4, cy + 4.6, 0.2, cy + 5.6); g.quadraticCurveTo(2.6, cy + 4.6, 2.8, cy); g.closePath(); g.fillStyle = 'rgba(240,240,230,0.35)'; g.fill();
    g.save(); g.clip(); g.strokeStyle = 'rgba(250,250,240,0.85)'; g.lineWidth = 0.25; for (let x = -3; x <= 3; x += 1.1) { g.beginPath(); g.moveTo(x, cy - 1); g.lineTo(x + 2, cy + 6); g.moveTo(x, cy - 1); g.lineTo(x - 2, cy + 6); g.stroke(); } g.restore();
    g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, cy, 2.8, 1.1, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#d9a840'; g.lineWidth = 0.6; g.stroke();
    // a drip off the net: it has been in the fountain
    const ph = (time * 0.9) % 1; g.fillStyle = `rgba(160,210,255,${1 - ph})`; ell(g, 0.4, cy + 6 + ph * 5, 0.35, 0.5); g.fill();
    g.restore();
  };
  // a sealed letter with a red wax seal (the Wingwrights carry every letter that goes by air)
  PROPS.sky_letter = (g, C, o) => {
    g.save(); g.translate(0.6, -0.4); g.rotate(-0.35);
    rr(g, -3, -2, 6, 4, 0.4); g.fillStyle = vfill(g, '#f6eedb', -2, 2, 0.2, -0.15); g.fill(); outline(g, 0.45);
    g.strokeStyle = '#b8a07a'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-2.8, -1.8); g.lineTo(0, 0.4); g.lineTo(2.8, -1.8); g.stroke();
    ell(g, 0, 0.5, 0.95, 0.95); g.fillStyle = rfill(g, '#c0302a', 0, 0.5, 0.95); g.fill(); outline(g, 0.3);
    g.restore();
  };
  // a honey bun with a bite out of it, honey dripping (the princess bought one and walked off; on her feet)
  function sky_bunAt(g, x, y, r, bite) {
    g.beginPath(); if (bite) { g.arc(x, y, r, -0.15, Math.PI * 2 - 1.15); g.quadraticCurveTo(x + r * 0.2, y - r * 0.55, x + r * 0.45, y - r * 0.3); g.quadraticCurveTo(x + r * 0.55, y + 0.1, x + r * Math.cos(-0.15), y + r * Math.sin(-0.15)); } else g.arc(x, y, r, 0, Math.PI * 2);
    g.closePath(); g.fillStyle = rfill(g, '#d99a40', x, y, r); g.fill(); outline(g, 0.45);
    g.strokeStyle = 'rgba(255,236,170,0.95)'; g.lineWidth = 0.4; g.beginPath(); g.arc(x - 0.2, y + 0.1, r * 0.5, 0.6, Math.PI * 1.7); g.stroke();
    g.fillStyle = 'rgba(245,190,60,0.9)'; ell(g, x - r * 0.3, y + r * 0.85, 0.35, 0.6); g.fill();
  }
  PROPS.sky_bun = (g, C, o) => {};
  PROP_OVER.sky_bun = (g, C, o) => { sky_bunAt(g, 0.8, -1.8, 2.3, true); };
  // Mossbeard's garden shears, blades up
  PROPS.sky_shears = (g, C, o) => {
    g.save(); g.rotate(-0.15);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -1); g.lineTo(s * 1.2, -9.4); g.lineTo(s * 0.1, -8.8); g.closePath(); g.fillStyle = metal(g, '#b8bec8', -9.4, -1); g.fill(); outline(g, 0.35); }
    for (const s of [-1, 1]) { g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -1); g.lineTo(s * 1.4, 3.4); g.stroke(); g.strokeStyle = '#8a5a30'; g.lineWidth = 0.9; g.stroke(); }
    ell(g, 0, -1.2, 0.5, 0.5); g.fillStyle = '#5a5f6a'; g.fill();
    g.restore();
  };
  // Sister Aubade's wind chime on a short staff: four silver tubes and a feather, rung by the wind
  PROPS.sky_chime = (g, C, o) => {
    const top = -12.5, bot = sky_ground(C), wind = Math.sin(time * 1.7 + C.seed) * 0.25 + (C.talk ? Math.sin(C.tt * 9) * 0.2 : 0) + C.step * 0.15;
    rr(g, -0.7, top, 1.4, bot - top, 0.6); g.fillStyle = (() => { const gr = g.createLinearGradient(-0.7, 0, 0.7, 0); gr.addColorStop(0, '#f2ead8'); gr.addColorStop(1, '#b8a888'); return gr; })(); g.fill(); outline(g, 0.4);
    g.strokeStyle = OUT; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-4.6, top + 1.4); g.quadraticCurveTo(0, top - 1.4, 4.6, top + 1.4); g.stroke(); g.strokeStyle = metal(g, '#c9d6ea', top - 1, top + 2); g.lineWidth = 0.7; g.stroke();
    ell(g, 0, top - 0.6, 1, 1); g.fillStyle = metal(g, '#c9d6ea', top - 1.6, top + 0.4); g.fill(); outline(g, 0.3);
    [[-4, 3.6], [-1.6, 4.8], [1.6, 4.2], [4, 3.2]].forEach(([x, L], i) => {
      const a = wind * (1 + i * 0.15) + Math.sin(time * 3.1 + i) * 0.08, y0 = top + 1.2 - Math.abs(x) * -0.05;
      g.save(); g.translate(x, y0); g.rotate(a);
      g.strokeStyle = 'rgba(80,80,90,0.7)'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 1.4); g.stroke();
      rr(g, -0.45, 1.4, 0.9, L, 0.4); g.fillStyle = metal(g, '#dfe6f0', 1.4, 1.4 + L); g.fill(); outline(g, 0.3);
      g.restore();
    });
    g.save(); g.translate(0, top + 1.6); g.rotate(wind * 1.4); g.strokeStyle = 'rgba(80,80,90,0.7)'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 4.6); g.stroke(); sky_feather(g, 0, 4.6, Math.PI / 2, 4, 1.8, '#ffffff', '#9fb8dc'); g.restore();
    if (Math.abs(wind) > 0.38) { sparkle(g, -5.6, top + 4, 0.9, 'rgba(255,255,255,0.9)'); sparkle(g, 5.4, top + 3, 0.7, 'rgba(255,255,255,0.8)'); }
  };
  // honey buns in Tamsin's basket
  const sky_buns = g => { sky_bunAt(g, -2.2, 3.4, 2.1, false); sky_bunAt(g, 2.2, 3.2, 2, false); sky_bunAt(g, 0, 2.2, 2.1, false); };

  // ---------- the Queen's pieces ----------
  // a mantle of white feathers round her shoulders, gold-tipped, clasped with a sky-blue stone
  function sky_featherMantle(g, C) {
    const y0 = C.B.sh - 1.2, w = C.B.w + 1.6;
    const m = () => { g.beginPath(); g.moveTo(-w, y0 + 1); g.quadraticCurveTo(-w - 0.8, y0 + 4.8, -w + 2.2, y0 + 6); g.quadraticCurveTo(0, C.back ? y0 + 8.4 : y0 + 7.4, w - 2.2, y0 + 6); g.quadraticCurveTo(w + 0.8, y0 + 4.8, w, y0 + 1); g.quadraticCurveTo(0, y0 - 2.6, -w, y0 + 1); g.closePath(); };
    m(); g.fillStyle = vfill(g, '#fbfaf4', y0 - 2, y0 + 8, 0.3, -0.12); g.fill(); outline(g, 0.6);
    g.save(); m(); g.clip();
    for (let row = 2; row >= 0; row--) for (let k = -5; k <= 5; k++) { const x = k * 1.8 + (row % 2) * 0.9, y = y0 + 1.4 + row * 2.1 + Math.abs(k) * 0.12; g.beginPath(); g.ellipse(x, y, 1.15, 1.5, 0, 0, Math.PI * 2); g.fillStyle = shade('#fbfaf4', -0.02 - row * 0.03); g.fill(); g.strokeStyle = 'rgba(190,160,80,0.75)'; g.lineWidth = 0.28; g.beginPath(); g.arc(x, y, 1.1, 0.25, Math.PI - 0.25); g.stroke(); }
    g.restore();
    g.strokeStyle = '#e0b546'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-w + 2.2, y0 + 6); g.quadraticCurveTo(0, C.back ? y0 + 8.4 : y0 + 7.4, w - 2.2, y0 + 6); g.stroke();
    if (!C.back) { ell(g, 0, y0 + 3.6, 1.7, 1.7); g.fillStyle = metal(g, '#e8b84a', y0 + 2, y0 + 5.2); g.fill(); outline(g, 0.4); gem(g, 0, y0 + 3.6, 1, '#5ab0f0', 'rgba(140,210,255,0.55)'); }
  }
  // little gold wings on the sides of her crown
  function sky_crownWings(g, C) {
    const { hy, r, ex } = sky_H(C), cy = hy - r + 2.6;
    for (const s of [-1, 1]) { g.save(); g.translate(s * (r - 0.4) + ex * 0.3, cy); g.scale(s, 1); for (let f = 0; f < 3; f++) { g.beginPath(); g.moveTo(0, 0.6); g.quadraticCurveTo(1.6 + f * 0.4, -1.6 - f * 0.9, 2.6 + f * 0.5, -2.6 - f * 1.2); g.quadraticCurveTo(1.4 + f * 0.3, -0.6, 0, 1.6); g.closePath(); g.fillStyle = metal(g, '#f0c040', -5, 1); g.fill(); g.strokeStyle = 'rgba(90,60,10,0.7)'; g.lineWidth = 0.28; g.stroke(); } g.restore(); }
  }
  // gold notes drifting up while she talks: the Song
  function sky_notes(g, C) {
    if (!C.talk) return; const { hy } = sky_H(C);
    for (let k = 0; k < 2; k++) { const ph = (C.tt * 0.7 + k * 0.5) % 1, x = 6 + k * 3 + Math.sin(ph * 6 + k) * 1.4, y = hy - 2 - ph * 12, a = Math.sin(ph * Math.PI);
      g.globalAlpha *= a; const nt = () => { g.beginPath(); g.ellipse(x, y, 1.3, 1, -0.4, 0, Math.PI * 2); g.moveTo(x + 1.1, y); g.lineTo(x + 1.1, y - 4.2); g.quadraticCurveTo(x + 2.8, y - 3.4, x + 2.8, y - 2); }; g.strokeStyle = OUT; g.lineWidth = 1.2; nt(); g.stroke(); g.strokeStyle = '#f5c542'; g.lineWidth = 0.6; nt(); g.stroke(); ell(g, x, y, 1.3, 1, -0.4); g.fillStyle = '#f5c542'; g.fill(); g.globalAlpha /= Math.max(a, 0.001); }
  }

  // ---------- everyone ----------
  // ---------- the Windward Market (the Cloud Kingdom polish, 2026-10-03): what its sellers and shoppers hold ----------
  // a bolt of wing-cloth, sky blue banded in gold, the loose end lifting in the wind (Maudie the weaver)
  PROPS.sky_cloth = (g, C, o) => {
    g.save(); g.translate(0.4, 0.2); g.rotate(-0.25);
    // (once every 2 s: a standing loop comes round without a jump, 83-townsfolk check 12)
    const c = o.c || '#5b9be0', lift = Math.sin(time * Math.PI + C.seed) * 0.8;
    g.beginPath(); g.moveTo(2.6, -2.6); g.quadraticCurveTo(5.6, -5 + lift, 8.2, -4 + lift * 1.4); g.lineTo(8, -1.6 + lift); g.quadraticCurveTo(5.4, -2.4 + lift * 0.6, 2.6, 0.4); g.closePath(); g.fillStyle = vfill(g, c, -5, 0, 0.35, -0.1); g.fill(); outline(g, 0.35);
    rr(g, -3, -3, 6, 6.4, 2.4); g.fillStyle = vfill(g, c, -3, 3.4, 0.3, -0.3); g.fill(); outline(g, 0.5);
    g.fillStyle = '#f5c542'; g.fillRect(-3, -0.6, 6, 1);
    ell(g, 0, -3, 3, 1.1); g.fillStyle = shade(c, -0.25); g.fill(); outline(g, 0.35);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.4; g.beginPath(); g.arc(0, -3, 1.6, 0, Math.PI * 2); g.stroke();
    g.restore();
  };
  // a fan of feathers, white, gold and grey, the quills bound in blue (Old Plume)
  PROPS.sky_featherFan = (g, C, o) => {
    g.save(); g.rotate(Math.sin(time * 1.6 + C.seed) * 0.05);
    [['#ffffff', -0.55], ['#f5c542', -0.2], ['#c9ccd6', 0.15], ['#ffffff', 0.5]].forEach(([c, a]) => sky_feather(g, 0, 0.6, -Math.PI / 2 + a, 9, 2.2, c, shade(c, -0.35)));
    rr(g, -1.2, -0.4, 2.4, 2.4, 0.6); g.fillStyle = '#3b6fc0'; g.fill(); outline(g, 0.35);
    g.restore();
  };
  // a white clay jug with a blue band, fired on cloud-fire (Crockett the potter)
  PROPS.sky_pot = (g, C, o) => {
    g.save(); g.translate(0.8, 0.6);
    const jug = () => { g.beginPath(); g.moveTo(-1.6, -3.6); g.quadraticCurveTo(-1.2, -2, -2.8, -0.6); g.quadraticCurveTo(-4, 2.6, -2.2, 4.6); g.lineTo(2.2, 4.6); g.quadraticCurveTo(4, 2.6, 2.8, -0.6); g.quadraticCurveTo(1.2, -2, 1.6, -3.6); g.closePath(); };
    g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.arc(3, 0.6, 1.8, -1.2, 1.4); g.stroke(); g.strokeStyle = '#f4f0e8'; g.lineWidth = 0.8; g.stroke();
    jug(); g.fillStyle = vfill(g, '#f4f0e8', -3.6, 4.6, 0.2, -0.25); g.fill(); outline(g, 0.5);
    g.fillStyle = '#3b6fc0'; g.fillRect(-3.2, 0.6, 6.4, 1.1);
    ell(g, 0, -3.6, 1.7, 0.6); g.fillStyle = '#6b6258'; g.fill(); outline(g, 0.3);
    g.restore();
  };
  // a full basket: a loaf, a bolt of cloth, an apple and a feather sticking out (Hazel, who came for one apple)
  const sky_marketFill = g => {
    ell(g, -2.2, 3.2, 2.2, 1.3, -0.3); g.fillStyle = rfill(g, '#c98a3a', -2.2, 3.2, 2.2); g.fill(); outline(g, 0.35);
    rr(g, 0.2, 1.4, 2.6, 2.6, 1); g.fillStyle = '#b07ad9'; g.fill(); outline(g, 0.35);
    ell(g, 3.4, 3.4, 1.3, 1.2); g.fillStyle = rfill(g, '#d8402a', 3.4, 3.4, 1.3); g.fill(); outline(g, 0.3);
    sky_feather(g, -0.6, 3, -Math.PI / 2 - 0.3, 7, 1.8, '#ffffff', '#c9ccd6');
  };

  addPeople('sky', {
    // ---------- Queen Seraphel of Aerie: the greatest wings in the sky, a white gown, a mantle of feathers, a gold lyre ----------
    seraphel: sky_person({ scale: 1.35, tone: '#fbf8ee', edge: '#e0c070', sheen: '#f0c040' }, {
      build: 'adult', size: 1.04, skin: '#f0d8c0', hand: '#f0d8c0',
      face: { eye: '#3a7ac0', lash: '#5a4a2a', brow: '#c9a860', browW: 0.6, mouth: 'smile', lip: '#c06a6a', nose: 'long', blush: 'rgba(230,140,140,0.35)' },
      hair: { style: 'long', c: '#f5e6a8', len: 3 },
      hat: { kind: 'crown', c: '#f0c040', gem: '#5ab0f0', gem2: '#f4f4ff', velvet: '#8fb4dc' },
      body: { kind: 'robe', c: '#e9eef5', under: '#a9c6e8', edge: '#e0b546', trim: '#e0b546', belt: '#e0b546', knot: false, sleeve: '#dfe6f0', len: 0.6 },
      legs: { boot: '#c9d6ea' },
      held: { kind: 'sky_lyre' },
      collar: sky_featherMantle,
      head: sky_crownWings,
      after: sky_notes,
    }),

    // ---------- Master Halcyon, the sky smith: soot-tipped wings, a long white beard, a leather apron, a stormglass shard ----------
    halcyon: sky_person({ scale: 1.1, tone: '#f2f0e8', edge: '#b8b0a0', tip: '#9c9aa2' }, {
      build: 'adult', size: 1.04, geo: { w: 8.6, gap: 3.8 }, skin: '#f0d8c0',
      face: { eye: '#3a5a8a', age: 'elder', brow: '#f2eee6', browW: 1.4, browIn: 1.2, browTilt: 0.2, nose: 'big', noseC: '#e8b49a', mouth: 'smile', blush: 'rgba(220,110,100,0.4)' },
      hair: { style: 'bald', c: '#d9d0c0' },
      beard: { style: 'long', c: '#ece6da', len: 1 },
      body: { kind: 'tunic', c: '#5a6a8a', under: '#cfd8e6', belt: '#2e2a36', buckle: '#c9ccd3', pouch: false, rolled: '#d9e0ea', sleeve: '#4a5a78' },
      over: [{ kind: 'leather', c: '#6a5040', scorch: [[-2.8, 7.6, 1], [2.4, 2.6, 0.7], [3.4, 11.4, 0.9]] }],
      legs: { c: '#3a4256', boot: '#2a2a34', cuff: '#5a4a3a' },
      held: { kind: 'hammer', c: '#c9ccd3', haft: '#5a4a3a' },
      off: { kind: 'sky_shard' },
      // a silver ring at the tip of his beard, and a smudge of forge soot on his brow
      head: (g, C) => {
        if (C.back) return; const { hy, ex, ey } = sky_H(C), bx = ex * 0.6 + C.step * 0.3;
        rr(g, bx - 1.4, hy + 13.4, 2.8, 1.4, 0.5); g.fillStyle = metal(g, '#d4dce8', hy + 13.4, hy + 14.8); g.fill(); outline(g, 0.3);
        g.fillStyle = 'rgba(40,40,50,0.35)'; ell(g, -3.6 + ex, hy - 3.6 + ey, 1.4, 0.6, -0.3); g.fill(); ell(g, 4.6 + ex, hy + 1.8 + ey, 0.8, 0.5); g.fill();
      },
      // stormglass chips glinting in the apron's pocket
      torso: (g, C) => {
        if (C.back) return; const y = C.B.waist + 2.6;
        rr(g, -2.2, y, 4.4, 2.6, 0.5); g.fillStyle = '#5a4434'; g.fill(); outline(g, 0.35);
        for (const [x, h] of [[-1, 2], [0.6, 2.6]]) { g.beginPath(); g.moveTo(x - 0.5, y + 0.2); g.lineTo(x, y - h); g.lineTo(x + 0.5, y + 0.2); g.closePath(); g.fillStyle = '#9ad0f5'; g.fill(); g.strokeStyle = 'rgba(30,50,80,0.6)'; g.lineWidth = 0.25; g.stroke(); }
        if (Math.sin(time * 3.3) > 0.7) sparkle(g, 0.8, y - 2.6, 0.9, '#ffffff');
      },
    }),

    // ---------- Keeper Pell of the Rookery: a skyhawk on his gloved fist, a fish for the perch, hawk-barred wings ----------
    pell: sky_person({ scale: 1.0, tone: '#f0ebdc', edge: '#b89a6a', tip: '#a8865a', bars: 'rgba(90,60,30,0.55)' }, {
      build: 'adult', skin: '#e8c8a8', hand: '#e8c8a8',
      face: { eye: '#3a2a1a', brow: '#2a1a0a', browW: 1.1, browIn: 1.3, browTilt: 0.2, mouth: 'smile', nose: 'long', blush: 'rgba(200,100,80,0.35)' },
      hair: { style: 'short', c: '#3a2a1a' },
      beard: { style: 'short', c: '#3a2a1a' },
      body: { kind: 'tunic', c: '#6a7f5a', under: '#e4dcc4', belt: '#5a3a20', buckle: '#b89a5a', pouch: '#7a5a3a', sleeve: '#5a6f4a', laces: true },
      over: [{ kind: 'vest', c: '#7a5230', button: '#b89a5a' }],
      cloak: { c: '#4f6a44', lining: '#34452c', hood: 'down', len: -4, clasp: '#b89a5a' },
      legs: { c: '#4a4a3a', boot: '#5a3a22', cuff: '#7a5230' },
      held: { kind: 'sky_fish' },
      off: { kind: 'sky_hawk' },
      // two hawk feathers tucked behind his ear
      head: (g, C) => { const { hy, r } = sky_H(C), x = C.back ? -r + 0.4 : r - 0.6; sky_tuck(g, x, hy - 0.6, -1.15, 6.4, '#c9a878', '#6a4a2a', 'rgba(70,45,20,0.6)'); sky_tuck(g, x + (C.back ? -0.6 : 0.6), hy, -0.85, 5.4, '#e8dcc0', '#8a6a46', 'rgba(70,45,20,0.5)'); },
    }),

    // ---------- Quill Windward, the market trader: a merchant's coat, a quill behind his ear, a jar of bottled cloud, his ledger ----------
    quill: sky_person({ scale: 1.0, tone: '#f6f2e4', edge: '#c9b676', tip: '#d9c48a' }, {
      build: 'adult', skin: '#f0d8c0',
      face: { eye: '#3a6a4a', brow: '#b8a060', browW: 0.8, browTilt: -0.2, mouth: 'grin', nose: 'button', blush: 'rgba(230,120,110,0.35)' },
      hair: { style: 'short', c: '#e8d9a0' },
      hat: { kind: 'cap', c: '#2b5a7a' },
      body: { kind: 'coat', c: '#8a6a3a', under: '#efe4cc', button: '#e0b546', belt: '#4a3020', buckle: '#e0b546', pouch: false, sleeve: '#7a5a2e' },
      legs: { c: '#4a3a2a', boot: '#3a2a1c', cuff: '#2b5a7a' },
      held: { kind: 'sky_jar', tie: '#2b5a7a' },
      off: { kind: 'book', c: '#2b5a7a' },
      // the quill behind his ear, a long white feather with a blue tip
      head: (g, C) => { const { hy, r } = sky_H(C); sky_tuck(g, C.back ? -r + 0.2 : r - 0.2, hy - 0.4, -1.2, 9, '#ffffff', '#3a7ac0'); },
      // a fat coin purse on his belt, a coin glinting
      torso: (g, C) => {
        if (C.back) return; const x = -5.6, y = C.B.waist + 1.6;
        g.beginPath(); g.moveTo(x - 1.2, y); g.quadraticCurveTo(x - 2.8, y + 3.6, x, y + 4); g.quadraticCurveTo(x + 2.8, y + 3.6, x + 1.2, y); g.closePath(); g.fillStyle = vfill(g, '#6a3a5a', y, y + 4, 0.25, -0.3); g.fill(); outline(g, 0.4);
        g.strokeStyle = '#e0b546'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(x - 1.2, y + 0.4); g.lineTo(x + 1.2, y + 0.4); g.stroke();
        ell(g, x + 0.6, y - 0.2, 0.8, 0.5); g.fillStyle = metal(g, '#f0c040', y - 0.7, y + 0.3); g.fill(); outline(g, 0.25);
        if (Math.sin(time * 2.7 + 1) > 0.8) sparkle(g, x + 0.9, y - 0.5, 0.9, '#fffbe8');
      },
    }),

    // ---------- Skyla Fleetwing, the fastest runner of the Wingwrights: swept wings, a streaming ponytail, the start flag ----------
    skyla: sky_person({ scale: 1.15, tone: '#f6f8f8', edge: '#8ac4c4', tip: '#3a9a9a', swept: true }, {
      build: 'adult', geo: { w: 7.4, gap: 3.3, lw: 4.6 }, skin: '#f0d8c0',
      face: { eye: '#2b7c7c', lash: '#5a4020', brow: '#c08a50', browW: 0.65, freckles: true, mouth: 'grin', blush: 'rgba(235,120,110,0.45)' },
      hair: { style: 'ponytail', c: '#ecc690', tie: '#f5c542' },
      body: { kind: 'tunic', c: '#2b8c8c', under: '#e9f2f2', trim: '#f5c542', belt: '#1f5a5a', buckle: '#f5c542', pouch: false, sleeve: '#237878', len: -1 },
      legs: { c: '#e8eef2', boot: '#3a5a6a', cuff: '#f5c542' },
      held: { kind: 'sky_flag' },
      collar: (g, C) => sky_scarf(g, C, '#f6f2e4', '#f5c542'),
      // a teal headband with a white feather in it
      head: (g, C) => {
        const { hy, r, ex } = sky_H(C);
        g.strokeStyle = OUT; g.lineWidth = 1.9; const band = () => { g.beginPath(); if (C.back) { g.moveTo(-r + 0.2, hy - 2.2); g.quadraticCurveTo(0, hy - 0.8, r - 0.2, hy - 2.2); } else { g.moveTo(-r + 0.3, hy - 2.4); g.quadraticCurveTo(ex * 0.4, hy - 5.2, r - 0.3, hy - 2.4); } };
        band(); g.stroke(); g.strokeStyle = '#2b8c8c'; g.lineWidth = 1.2; band(); g.stroke();
        if (C.back) { ell(g, 0, hy - 1.4, 0.9, 0.7); g.fillStyle = '#2b8c8c'; g.fill(); outline(g, 0.3); }
        sky_tuck(g, -r + 0.6, hy - 2.6, -2.1, 6.4, '#ffffff', '#8ac4c4');
      },
      // the Wingwrights' silver wing pin
      torso: (g, C) => { if (!C.back) sky_wingBadge(g, -3.4, C.B.sh + 2.6, '#d4dce8', 0.8); },
    }),

    // ---------- Old Ferris of the Underside: small grey wings with a feather gone, a snag hook, a sack of dropped things ----------
    ferris: sky_person({ scale: 0.8, tone: '#e4e2da', edge: '#9a948a', tip: '#8a8a8a', ragged: true }, {
      build: 'adult', size: 0.96, skin: '#e8c8a8',
      face: { eye: '#4a5a6a', age: 'elder', eyes: 'sleepy', brow: '#e6e0d4', browW: 1.4, browIn: 1, browTilt: 0.3, nose: 'big', noseC: '#e0a890', mouth: 'grin', blush: 'rgba(220,100,90,0.45)' },
      hair: { style: 'bald', c: '#d9d0c0' },
      beard: { style: 'full', c: '#d9d0c0' },
      hat: { kind: 'wool', c: '#7a6a5a', rim: '#5a4a3a', bobble: '#9fb8dc' },
      body: { kind: 'coat', c: '#5a6a7a', under: '#a89a80', button: '#8f96a3', belt: '#3a2e24', buckle: '#8f96a3', pouch: '#6a5a40', sleeve: '#4a5868' },
      legs: { c: '#4a4a44', boot: '#3a2e24', patch: '#7a6a50' },
      held: { kind: 'sky_snaghook' },
      behind: (g, C) => sky_sackPeek(g, C, { c: '#8a8a7a', full: sky_ferrisFinds }),
      back: (g, C) => sky_sackBack(g, C, { c: '#8a8a7a', tie: '#c9b48a', strap: '#5a4a3a', patch: '#6a7a8a', full: sky_ferrisFinds }),
      torso: (g, C) => {
        // patches on the coat, the rope of the sack across his chest, and a chip of stormglass in his pocket
        const B = C.B;
        for (const [x, y, w, h, c] of C.back ? [[-5.4, 6, 3, 2.6, '#6a7a6a']] : [[3.2, 5.4, 2.8, 2.4, '#7a6a5a'], [-6.2, 0.4, 2.4, 2.6, '#6a7a6a']]) { rr(g, x, y, w, h, 0.4); g.fillStyle = c; g.fill(); g.strokeStyle = 'rgba(30,20,10,0.6)'; g.lineWidth = 0.3; g.setLineDash([0.5, 0.5]); g.stroke(); g.setLineDash([]); }
        sky_strap(g, C, '#c9b48a', 0.9);
        if (!C.back) { g.beginPath(); g.moveTo(4.4, B.hem - 3.8); g.lineTo(4.9, B.hem - 6); g.lineTo(5.4, B.hem - 3.8); g.closePath(); g.fillStyle = '#9ad0f5'; g.fill(); g.strokeStyle = 'rgba(30,50,80,0.6)'; g.lineWidth = 0.25; g.stroke(); if (Math.sin(time * 2.3) > 0.75) sparkle(g, 4.9, B.hem - 6, 0.8, '#ffffff'); }
      },
    }),

    // ---------- Captain Aldric of the Great Gate: a winged silver helm, a blue tabard with gold wings, a spear with a pennant, the gate horn ----------
    aldric: sky_person({ scale: 1.1, tone: '#f8f6ee', edge: '#d9c070' }, {
      build: 'adult', size: 1.04, skin: '#f0d8c0',
      face: { eye: '#3a2a1a', brow: '#4a3018', browW: 1.1, browIn: 1.3, mouth: 'smile', nose: 'long', blush: 'rgba(220,110,100,0.35)' },
      hair: { style: 'short', c: '#6a4a2a' },
      beard: { style: 'moustache', c: '#6a4a2a' },
      hat: { kind: 'helmet', c: '#dfe6f0', plume: '#3b5ba8' },
      body: { kind: 'tunic', c: '#3b5ba8', under: '#dfe6f0', belt: '#2a2a3a', buckle: '#f5c542', pouch: false, sleeve: '#3b5ba8', epaulet: '#f5c542' },
      over: [{ kind: 'tabard', c: '#2e4a90', trim: '#f5c542', badge: (g, x, y) => sky_wingBadge(g, x, y + 1.2, '#f5c542', 1.1) }],
      legs: { c: '#2a3450', boot: '#2a2a34', cuff: '#f5c542' },
      held: { kind: 'spear', haft: '#8a6a3a', blade: '#eef3fa', band: '#f5c542', pennant: '#3b5ba8', len: 32 },
      head: (g, C) => sky_helmWings(g, C, '#eef2f8'),
      // the gate horn at his hip: white, banded in gold
      torso: (g, C) => {
        if (C.back) return; const x = -7, y = C.B.waist + 1.6;
        g.strokeStyle = '#2a2a3a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x + 2.4, y - 1.4); g.lineTo(x + 2, y + 0.4); g.moveTo(x - 1.4, y - 1.2); g.lineTo(x - 1.8, y + 1.2); g.stroke();
        g.beginPath(); g.moveTo(x + 3, y + 0.4); g.quadraticCurveTo(x, y + 3.6, x - 3, y + 0.6); g.lineTo(x - 3.4, y + 2.6); g.quadraticCurveTo(x, y + 5.6, x + 3.2, y + 1.4); g.closePath(); g.fillStyle = vfill(g, '#f2ead8', y, y + 5, 0.2, -0.25); g.fill(); outline(g, 0.45);
        g.fillStyle = '#f5c542'; g.fillRect(x - 0.4, y + 2.2, 0.9, 2); g.fillRect(x + 2.2, y + 0.6, 0.8, 1.4);
      },
    }),

    // ---------- Tamsin the baker of the Cloud Oven: flour on her cheek, a basket of honey buns, a rolling pin ----------
    tamsin: sky_person({ scale: 0.95, tone: '#fbf6ea', edge: '#d9b88a' }, {
      build: 'adult', skin: '#f2d6bf',
      face: { eye: '#5a3a1e', lash: '#3a2414', brow: '#7a3a1e', browW: 0.7, mouth: 'smile', lip: '#b8605a', freckles: true, blush: 'rgba(235,110,100,0.5)' },
      hair: { style: 'bun', c: '#8a3a1e', tie: '#e9d8b8' },
      body: { kind: 'dress', c: '#c9784a', under: '#f2e6d0', sleeve: '#e9d8b8', rolled: '#f6eedc', belt: false },
      over: [{ kind: 'apron', c: '#f6efe2', stain: 'rgba(200,150,80,0.4)', pocketItem: (g, x, y) => { rr(g, x - 0.4, y - 3, 0.8, 3.4, 0.3); g.fillStyle = '#b8864a'; g.fill(); outline(g, 0.25); ell(g, x, y - 3.4, 0.9, 1.1); g.fillStyle = '#c9965a'; g.fill(); outline(g, 0.25); } }],
      legs: { boot: '#5a3a22' },
      held: { kind: 'basket', c: '#c9965a', fill: sky_buns, cloth: '#e9d8b8' },
      off: { kind: 'tool', tool: 'rollingpin' },
      // flour: a dab on her cheek and her nose, a dusting in her hair
      head: (g, C) => {
        const { hy, r, ex, ey } = sky_H(C); g.fillStyle = 'rgba(255,255,255,0.75)';
        if (!C.back) { ell(g, 4.2 + ex, hy + 2.2 + ey, 1.2, 0.7, 0.3); g.fill(); ell(g, ex + 0.3, hy + 2 + ey, 0.6, 0.4); g.fill(); ell(g, -3 + ex, hy - 4.4 + ey, 1, 0.5); g.fill(); }
        for (const [x, y] of [[-2, -r + 1.2], [2.4, -r + 2], [0.4, -r + 0.6]]) { ell(g, x, hy + y, 0.5, 0.3); g.fill(); }
      },
    }),

    // ---------- Mossbeard, keeper of the Queen's Garden: a mossy beard with flowers in it, a straw hat, a hoe and shears ----------
    mossbeard: sky_person({ scale: 0.85, tone: '#f2f0e0', edge: '#a0b080', tip: '#b4c49a' }, {
      build: 'adult', skin: '#e8c8a8',
      face: { eye: '#3a5a2a', lines: true, brow: '#6a7a4a', browW: 1.5, browIn: 1.1, browTilt: 0.25, nose: 'big', noseC: '#e0a888', mouth: 'smile', blush: 'rgba(220,110,90,0.45)' },
      hair: { style: 'short', c: '#7a8a5a' },
      beard: { style: 'full', c: '#7a8a5a' },
      hat: { kind: 'straw', c: '#d9c88a', band: '#4f7a3a', flower: '#f6e6f2' },
      body: { kind: 'tunic', c: '#4f7a3a', under: '#d9d0b0', rolled: '#d9d0b0', belt: '#5a3a20', buckle: '#b89a5a', pouch: '#8a6a4a', sleeve: '#8a6a4a' },
      over: [{ kind: 'apron', c: '#8a6a4a', pocketItem: (g, x, y) => { rr(g, x + 0.2, y - 2.6, 0.7, 2.8, 0.3); g.fillStyle = '#6b4a2a'; g.fill(); g.beginPath(); g.moveTo(x - 0.2, y - 2.4); g.lineTo(x + 0.5, y - 5); g.lineTo(x + 1.2, y - 2.4); g.closePath(); g.fillStyle = metal(g, '#9aa3b2', y - 5, y - 2.4); g.fill(); outline(g, 0.25); } }],
      legs: { c: '#5a5040', boot: '#4a3a28', patch: '#6a8a4a' },
      held: { kind: 'tool', tool: 'hoe', c: '#9aa3b2' },
      off: { kind: 'sky_shears' },
      // little white flowers and leaves growing in his beard
      head: (g, C) => {
        if (C.back) return; const { hy, ex } = sky_H(C), bx = ex * 0.6 + C.step * 0.3;
        for (const [x, y, c] of [[-3.6, 6.2, '#ffffff'], [2.8, 8, '#f6e070'], [-0.6, 9.4, '#ffffff'], [4, 5.4, '#e8a0c8']]) {
          for (let k = 0; k < 5; k++) { const b = k / 5 * Math.PI * 2; ell(g, bx + x + Math.cos(b) * 0.55, hy + y + Math.sin(b) * 0.55, 0.42, 0.42); g.fillStyle = c; g.fill(); }
          ell(g, bx + x, hy + y, 0.3, 0.3); g.fillStyle = '#f5c542'; g.fill();
        }
        g.fillStyle = '#5a9a3a'; for (const [x, y, a] of [[-2.4, 7.8, 0.6], [1.2, 9.6, -0.5]]) { g.save(); g.translate(bx + x, hy + y); g.rotate(a); ell(g, 0, 0, 1.1, 0.45); g.fill(); g.restore(); }
      },
    }),

    // ---------- Sister Aubade of the Chapel of the Four Winds: a white robe and coif, a pale blue veil, a wind chime, a hymn book ----------
    aubade: sky_person({ scale: 1.05, tone: '#fdfcf6', edge: '#b8c8e0' }, {
      build: 'adult', skin: '#f0d8c0', hand: '#f0d8c0',
      face: { eye: '#5a7aa0', eyes: 'happy', lash: '#6a6050', brow: '#c9c6bf', browW: 0.7, lines: true, mouth: 'smile', lip: '#b8706a', blush: 'rgba(230,130,130,0.4)' },
      hair: { style: 'short', c: '#d9d6cf' },
      hat: { kind: 'coif', c: '#fbfaf6' },
      body: { kind: 'robe', c: '#f4f1ea', under: '#9fb8dc', edge: '#c9b676', belt: '#9fb8dc', sleeve: '#e8e4da' },
      legs: { boot: '#c9c0b0' },
      held: { kind: 'sky_chime' },
      off: { kind: 'book', c: '#7a9ac8' },
      // the veil: down behind her shoulders facing us, over her back facing away
      behind: (g, C) => sky_veil(g, C, false),
      back: (g, C) => sky_veil(g, C, true),
      head: (g, C) => { if (!C.back) return; const { hy, r } = sky_H(C), c = '#9fb8dc'; g.beginPath(); g.moveTo(-r - 0.6, hy + 2); g.quadraticCurveTo(-r - 1, hy - r - 1.4, 0, hy - r - 1.2); g.quadraticCurveTo(r + 1, hy - r - 1.4, r + 0.6, hy + 2); g.quadraticCurveTo(r + 1.4, hy + 5, r - 0.4, hy + 7); g.lineTo(-r + 0.4, hy + 7); g.quadraticCurveTo(-r - 1.4, hy + 5, -r - 0.6, hy + 2); g.closePath(); g.fillStyle = vfill(g, c, hy - r, hy + 7, 0.3, -0.25); g.fill(); outline(g, 0.6); g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.45; for (const x of [-3, 0, 3]) { g.beginPath(); g.moveTo(x * 0.6, hy - r + 1); g.quadraticCurveTo(x * 1.1, hy, x * 1.2, hy + 6.6); g.stroke(); } g.strokeStyle = '#fbfaf6'; g.lineWidth = 1; g.beginPath(); g.moveTo(-r - 0.2, hy - 1); g.quadraticCurveTo(0, hy - r - 2.2, r + 0.2, hy - 1); g.stroke(); },
      // the four winds: a silver star on a cord
      torso: (g, C) => {
        if (C.back) return; const y = C.B.sh + 5.8;
        g.strokeStyle = '#9fb8dc'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-2.4, C.B.sh - 0.6); g.lineTo(0, y - 1.6); g.lineTo(2.4, C.B.sh - 0.6); g.stroke();
        g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 - Math.PI / 2, rad = k % 2 ? 0.7 : 2; g.lineTo(Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath(); g.fillStyle = metal(g, '#dfe6f0', y - 2, y + 2); g.fill(); outline(g, 0.35);
        ell(g, 0, y, 0.45, 0.45); g.fillStyle = '#5a8ad0'; g.fill();
      },
    }),

    // ---------- Guildmaster Corvin of the Wingwrights: crow-dark wing tips, a forked black beard, spectacles, a crow-head cane, a sealed letter ----------
    corvin: sky_person({ scale: 1.0, tone: '#eceef4', edge: '#8a9ab8', tip: '#3a4060' }, {
      build: 'adult', skin: '#e8c8a8',
      face: { eye: '#1f1f28', eyes: 'narrow', brow: '#1f1f28', browW: 1.1, browIn: 1.2, browTilt: 0.25, lines: true, nose: 'long', mouth: 'flat', lip: '#8a4a42' },
      hair: { style: 'short', c: '#1f1f28' },
      beard: { style: 'short', c: '#24242e' },
      body: { kind: 'coat', c: '#2e3f66', under: '#dfe6f0', button: '#c9d6ea', belt: '#1a1f30', buckle: '#c9d6ea', pouch: false, sleeve: '#26365a', len: 1 },
      over: [{ kind: 'chain', c: '#c9d6ea', medal: (g, x, y) => sky_wingBadge(g, x, y - 0.4, '#eef2f8', 0.75) }],
      legs: { c: '#1f2638', boot: '#141820' },
      held: { kind: 'sky_cane' },
      off: { kind: 'scroll' },
      // silver at his temples, and little round spectacles
      head: (g, C) => {
        const { hy, r, ex, ey } = sky_H(C); g.fillStyle = 'rgba(210,214,224,0.8)';
        for (const s of [-1, 1]) { ell(g, s * (r - 0.8), hy - 0.4, 0.8, 1.6, s * 0.2); g.fill(); }
        if (C.back) return;
        g.strokeStyle = '#c9d6ea'; g.lineWidth = 0.45; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 2.6 + ex, hy + 0.8 + ey, 1.6, 0, Math.PI * 2); g.stroke(); }
        g.beginPath(); g.moveTo(-1 + ex, hy + 0.5 + ey); g.quadraticCurveTo(ex, hy + 0.1 + ey, 1 + ex, hy + 0.5 + ey); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.4)'; for (const s of [-1, 1]) { ell(g, s * 2.6 + ex - 0.6, hy + 0.2 + ey, 0.5, 0.35, -0.5); g.fill(); }
      },
    }),

    // ---------- Merriweather of the Tailwind: round and ginger, a big moustache, an apron, a ladle and a bowl of cloud soup ----------
    merriweather: sky_person({ scale: 0.95, tone: '#faf4e8', edge: '#d9b36a' }, {
      build: 'adult', size: 1.07, geo: { w: 9.2, gap: 3.9, lw: 5.4, hand: { x: 11.2, y: 5 } }, skin: '#f2d0b5',
      face: { eye: '#5a3a1e', eyes: 'happy', brow: '#b8682a', browW: 1.1, nose: 'big', noseC: '#f0a890', mouth: 'grin', blush: 'rgba(230,100,90,0.55)' },
      hair: { style: 'curly', c: '#c9783a' },
      beard: { style: 'moustache', c: '#c9783a' },
      body: { kind: 'tunic', c: '#9a5a3a', under: '#efe4cc', rolled: '#efe4cc', belt: '#4a3020', buckle: '#d9b36a', pouch: false, sleeve: '#d9b36a' },
      over: [{ kind: 'apron', c: '#f6efe2', stain: 'rgba(180,110,60,0.35)', w: 5.4 }],
      legs: { c: '#4a3a2a', boot: '#3a2a1c' },
      held: { kind: 'tool', tool: 'ladle' },
      off: { kind: 'sky_soup' },
      // a checked cloth tucked in his apron string
      torso: (g, C) => {
        if (C.back) return; const x = 4.6, y = C.B.waist + 0.6, sw = C.step * 0.4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2.8, y); g.lineTo(x + 3 + sw, y + 5); g.lineTo(x + 0.4 + sw, y + 5.2); g.closePath(); g.fillStyle = '#f6efe2'; g.fill(); outline(g, 0.4);
        g.save(); g.clip(); g.fillStyle = 'rgba(190,50,50,0.6)'; for (let yy = y; yy < y + 5.4; yy += 1.4) for (let xx = x; xx < x + 3.4; xx += 1.4) if (((yy - y) / 1.4 + (xx - x) / 1.4) % 2 < 1) g.fillRect(xx + sw * (yy - y) / 5, yy, 0.7, 0.7); g.restore();
      },
    }),

    // ---------- Warden Orla of the throne room: a plumed silver helm, flax braids, a gold sash (she is the senior), a spear ----------
    orla: sky_person({ scale: 1.05, tone: '#f8faff', edge: '#9ab0d0' }, {
      build: 'adult', size: 1.03, skin: '#f0d8c0',
      face: { eye: '#3a5a8a', lash: '#5a4a2a', brow: '#b8a060', browW: 0.8, browIn: 1.4, mouth: 'flat', lip: '#a8605a', nose: 'long' },
      hair: { style: 'braids', c: '#e8d9a0', tie: '#9ab0d0' },
      hat: { kind: 'helmet', c: '#dfe6f0' },
      body: { kind: 'tunic', c: '#c9d6ea', under: '#f2f6fb', belt: '#5a6a8a', buckle: '#f5c542', pouch: false, sleeve: '#9ab0d0', epaulet: '#dfe6f0' },
      over: [{ kind: 'tabard', c: '#eef3fa', trim: '#9ab0d0', badge: (g, x, y) => sky_wingBadge(g, x, y + 1.2, '#f5c542', 1) }, { kind: 'sash', c: '#f5c542' }],
      legs: { c: '#8f9aaa', boot: '#3a4458', cuff: '#dfe6f0' },
      held: { kind: 'spear', haft: '#e9eef5', blade: '#eef3fa', band: '#f5c542', pennant: '#9ab0d0', len: 31 },
      head: (g, C) => sky_helmWings(g, C, '#f4f6fb'),
    }),

    // ---------- Warden Brisk, twenty years at the throne room door: a big brown moustache, greying temples, keys on his belt ----------
    brisk: sky_person({ scale: 1.05, tone: '#f8faff', edge: '#9ab0d0' }, {
      build: 'adult', size: 1.03, skin: '#e8c0a0',
      face: { eye: '#3a2a1a', brow: '#4a2a14', browW: 1.2, browIn: 1.2, browTilt: 0.15, lines: true, nose: 'big', noseC: '#e0a888', mouth: 'smile' },
      hair: { style: 'short', c: '#5a3a1e' },
      beard: { style: 'moustache', c: '#5a3a1e' },
      hat: { kind: 'helmet', c: '#dfe6f0' },
      body: { kind: 'tunic', c: '#c9d6ea', under: '#f2f6fb', belt: '#5a6a8a', buckle: '#f5c542', pouch: false, sleeve: '#9ab0d0', epaulet: '#dfe6f0' },
      over: [{ kind: 'tabard', c: '#eef3fa', trim: '#9ab0d0', badge: (g, x, y) => sky_wingBadge(g, x, y + 1.2, '#f5c542', 1) }],
      legs: { c: '#8f9aaa', boot: '#3a4458', cuff: '#dfe6f0' },
      held: { kind: 'spear', haft: '#e9eef5', blade: '#eef3fa', band: '#f5c542', pennant: '#9ab0d0', len: 31 },
      head: (g, C) => { sky_helmWings(g, C, '#f4f6fb'); const { hy, r } = sky_H(C); g.fillStyle = 'rgba(200,200,205,0.85)'; for (const s of [-1, 1]) { ell(g, s * (r - 0.9), hy + 0.4, 0.7, 1.3, s * 0.2); g.fill(); } },
      // the throne room keys on his belt
      torso: (g, C) => { if (C.back) return; g.save(); g.translate(-6, C.B.waist + 1.2); PROPS.keys(g, C, {}); g.restore(); },
    }),

    // ---------- Lark, the Queen's daughter, ten today: small downy wings, gold braids, a circlet, a honey bun with a bite out of it ----------
    lark: sky_person({ scale: 0.8, tone: '#fffaf0', edge: '#e8c870', down: true }, {
      build: 'child', size: 1.08, skin: '#f5dcc8',
      face: { eye: '#3a7ac8', eyes: 'big', age: 'child', lash: '#5a4020', brow: '#d9b050', freckles: true, mouth: 'grin' },
      hair: { style: 'braids', c: '#f5d77a', tie: '#7fb2e8' },
      hat: { kind: 'circlet', c: '#f5c542', gem: '#7fb2e8', glow: 'rgba(150,200,255,0.6)' },
      body: { kind: 'dress', c: '#7fb2e8', under: '#f4f8fc', trim: '#f5c542', sleeve: '#f5c542', puff: true, belt: '#f5c542', knot: false },
      legs: { boot: '#f4f0e8' },
      held: { kind: 'sky_bun' },
      // a crumb of honey bun on her chin
      head: (g, C) => { if (C.back) return; const { hy, ex, ey } = sky_H(C); ell(g, ex + 1.6, hy + 5.6 + ey, 0.4, 0.35); g.fillStyle = '#d99a40'; g.fill(); },
    }),

    // ---------- Bellweather the lamplighter: a tall hat, a purple coat, a lamplighter's pole burning at the top, a lantern ----------
    bellweather: sky_person({ scale: 0.95, tone: '#f4f0e6', edge: '#e0b546' }, {
      build: 'adult', skin: '#f0d8c0',
      face: { eye: '#4a3a5a', age: 'elder', brow: '#d8d8d8', browW: 1.2, nose: 'long', mouth: 'smile', blush: 'rgba(220,110,100,0.4)' },
      hair: { style: 'bald', c: '#bfbfbf' },
      beard: { style: 'short', c: '#c8c8c8' },
      body: { kind: 'coat', c: '#6a5a8a', under: '#e6dcc8', button: '#f5c542', belt: '#3a2e40', buckle: '#f5c542', pouch: false, sleeve: '#5a4a78', len: 1.4 },
      legs: { c: '#3a3448', boot: '#2a2430' },
      held: { kind: 'sky_lamppole' },
      off: { kind: 'lantern' },
      head: (g, C) => sky_tallHat(g, C, '#3a3048', '#f5c542'),
    }),

    // ---------- Brannoc the porter: big and strong, a flour sack on his back, a basket of bread, flour in his hair ----------
    brannoc: sky_person({ scale: 0.95, tone: '#f2ece0', edge: '#c9a36a' }, {
      build: 'adult', size: 1.06, geo: { w: 9, gap: 4, lw: 5.4, hand: { x: 11, y: 5 } }, skin: '#e0b894',
      face: { eye: '#3a2a1a', brow: '#2a1a0a', browW: 1.3, browIn: 1.1, mouth: 'smile', nose: 'button', blush: 'rgba(210,100,80,0.4)' },
      hair: { style: 'crop', c: '#3a2a1a' },
      beard: { style: 'stubble', c: '#3a2a1a' },
      body: { kind: 'tunic', c: '#7a5a3a', under: '#e8dcc4', rolled: '#e8dcc4', belt: '#3a2614', buckle: '#c9a36a', pouch: false, laces: true, sleeve: '#c9a36a' },
      legs: { c: '#4a3a2a', boot: '#3a2a1c', cuff: '#c9a36a' },
      held: { kind: 'basket', c: '#b8864a', fill: 'bread', cloth: '#efe6d4' },
      behind: (g, C) => sky_sackPeek(g, C, { c: '#efe6d0' }),
      back: (g, C) => sky_sackBack(g, C, { c: '#efe6d0', tie: '#8a6a3a', strap: '#5a3a20', stamp: sky_wheat }),
      torso: (g, C) => sky_strap(g, C, '#5a3a20', 1.2),
      // flour dust in his hair
      head: (g, C) => { const { hy, r } = sky_H(C); g.fillStyle = 'rgba(255,255,255,0.6)'; for (const [x, y] of [[-3, -r + 1.6], [1.6, -r + 1.2], [3.6, -r + 2.6], [-0.6, -r + 2.8]]) { ell(g, x, hy + y, 0.7, 0.4); g.fill(); } },
    }),

    // ---------- Fen: a boy with a cap, bare wet feet, and a fishing net (there is no fish in the fountain; he looked) ----------
    fen: sky_person({ scale: 0.7, tone: '#fffaf0', edge: '#8ab8e8', down: true }, {
      build: 'child', size: 1.05, skin: '#f2d6bf',
      face: { eye: '#5a3a1e', eyes: 'big', age: 'child', brow: '#6a3a1e', freckles: true, mouth: 'o' },
      hair: { style: 'short', c: '#7a4a2a' },
      hat: { kind: 'cap', c: '#3a78c8' },
      body: { kind: 'tunic', c: '#58a6ff', under: '#f2f6fb', belt: '#5a3a20', buckle: '#f5c542', pouch: false, sleeve: '#f5c542' },
      legs: { c: '#4a5a7a', feet: '#f2d6bf' },
      held: { kind: 'sky_net' },
    }),

    // ---------- Tilly: a pink dress, a ponytail with a white bow, and a jar with a cloud fish (you only see it when you are not looking) ----------
    tilly: sky_person({ scale: 0.7, tone: '#fffaf8', edge: '#f0a8c8', down: true }, {
      build: 'child', size: 1.05, skin: '#f5dcc8',
      face: { eye: '#4a6ab0', eyes: 'big', age: 'child', lash: '#5a4020', brow: '#d0a050', mouth: 'smile' },
      hair: { style: 'ponytail', c: '#f0c060', tie: '#ffffff' },
      body: { kind: 'dress', c: '#ff9ec8', under: '#ffffff', trim: '#ffffff', sleeve: '#ffffff', puff: true, belt: '#ffffff', knot: false },
      legs: { boot: '#d96a9a' },
      held: { kind: 'sky_jar', fish: true, tie: '#ff9ec8' },
      // a white bow where her ponytail is tied
      head: (g, C) => { const { hy, r } = sky_H(C), x = C.back ? 0 : r - 0.6, y = C.back ? hy + 2.4 : hy - 1.6; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * 2.4, y - 2, x + s * 2.4, y + 0.6); g.closePath(); g.fillStyle = '#ffffff'; g.fill(); outline(g, 0.35); } ell(g, x, y, 0.7, 0.7); g.fillStyle = '#ffe0ee'; g.fill(); outline(g, 0.3); },
    }),

    // ---------- Wick the messenger: long swept wings beating fast, a leather flying cap and goggles, a red scarf, a satchel of letters ----------
    wick: sky_person({ scale: 1.3, tone: '#fbf6e6', edge: '#8ac4c4', tip: '#3a9a9a', swept: true, flapK: 2.2 }, {
      build: 'adult', lift: 3, skin: '#f0d8c0',
      face: { eye: '#2b6a6a', brow: '#b88a50', browW: 0.7, freckles: true, mouth: 'grin', blush: 'rgba(235,120,110,0.45)' },
      hair: { style: 'short', c: '#ecc690' },
      hat: { kind: 'goggles', c: '#b98a3a', cap: '#6b4a2a', lens: '#8fd0ff' },
      body: { kind: 'tunic', c: '#2b8c8c', under: '#e9f2f2', belt: '#5a3a20', buckle: '#f5c542', pouch: false, sleeve: '#f5c542' },
      legs: { c: '#3a4a5a', boot: '#5a3a22', cuff: '#f5c542' },
      held: { kind: 'sky_letter' },
      collar: (g, C) => sky_scarf(g, C, '#d0503a', '#f6e6c4'),
      torso: (g, C) => { sky_strap(g, C, '#5a3a20', 1); if (!C.back) { sky_satchel(g, C); sky_wingBadge(g, 3.6, C.B.sh + 2.4, '#d4dce8', 0.7); } },
      back: (g, C) => { g.strokeStyle = '#5a3a20'; g.lineWidth = 1; g.beginPath(); g.moveTo(C.B.w - 1.4, C.B.sh - 0.4); g.lineTo(-C.B.w + 2.2, C.B.waist - 0.2); g.stroke(); sky_satchel(g, C); },
    }),

    // ---------- the Windward Market (the Cloud Kingdom polish, 2026-10-03): a seller behind each stall, and two shoppers ----------
    // Pippa the fruit seller: a red dress, a kerchief, an apron with an apple in the pocket, a basket of sky-apples
    pippa: sky_person({ scale: 0.95, tone: '#fbf6ea', edge: '#e0a090' }, {
      build: 'adult', skin: '#f2d6bf',
      face: { eye: '#3a2414', lash: '#2a1a10', brow: '#5a2a10', eyes: 'happy', mouth: 'grin', lip: '#b0404a', blush: 'rgba(235,100,90,0.55)', freckles: true },
      hair: { style: 'long', c: '#6a3a1e' },
      hat: { kind: 'kerchief', c: '#f5c542', dots: '#d9534f' },
      body: { kind: 'dress', c: '#d9534f', under: '#f2e8d4', rolled: '#f2e8d4', sleeve: '#c4463f', belt: '#7a2a20' },
      over: [{ kind: 'apron', c: '#f6efe2', pocketItem: (g, x, y) => { ell(g, x + 0.6, y + 0.2, 1.1, 1); g.fillStyle = rfill(g, '#d8402a', x + 0.6, y + 0.2, 1.1); g.fill(); outline(g, 0.3); } }],
      legs: { boot: '#5a3a22' },
      held: { kind: 'basket', c: '#c9965a', fill: 'apples' },
      off: { kind: 'apple', c: '#9ab83a' },
    }),
    // Maudie the weaver: grey hair in a bun, a blue dress, a shawl of her own wing-cloth, a bolt of it under her arm
    maudie: sky_person({ scale: 1.0, tone: '#f8f6f0', edge: '#9ab8dc' }, {
      build: 'adult', skin: '#f0d8c0',
      face: { eye: '#3a5a8a', lash: '#5a5050', brow: '#a8a8a8', browW: 0.8, lines: true, mouth: 'smile', lip: '#b0606a', blush: 'rgba(230,130,130,0.4)' },
      hair: { style: 'bun', c: '#c9c9c9', tie: '#5b9be0' },
      body: { kind: 'dress', c: '#5b9be0', under: '#f6eedc', sleeve: '#4f86d0', belt: '#2e5a9a' },
      over: [{ kind: 'shawl', c: '#f5e6a8' }],
      legs: { boot: '#4a3a2a' },
      held: { kind: 'sky_cloth', c: '#5b9be0' },
      // a needle and thread pinned at her collar
      torso: (g, C) => { if (C.back) return; const y = C.B.sh + 1.4; g.strokeStyle = '#a9adb5'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(2.4, y - 1.6); g.lineTo(3.4, y + 1.6); g.stroke(); g.strokeStyle = '#d9534f'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(2.5, y - 1.3); g.quadraticCurveTo(4.6, y, 3.2, y + 2.6); g.stroke(); },
    }),
    // Old Plume the feather seller: big wings, a long white beard, a hat with feathers in its band, a fan of feathers
    plume: sky_person({ scale: 1.15, tone: '#fbf8ee', edge: '#e0c070', tip: '#f5c542' }, {
      build: 'adult', skin: '#e8c8a8',
      face: { eye: '#3a3a2a', eyes: 'happy', brow: '#f4f1ea', browW: 1.4, lines: true, nose: 'big', noseC: '#e0a888', mouth: 'smile', blush: 'rgba(220,110,90,0.4)' },
      hair: { style: 'short', c: '#f4f1ea' },
      beard: { style: 'long', c: '#f4f1ea' },
      hat: { kind: 'straw', c: '#e8b84a', band: '#3b6fc0', flower: '#ffffff' },
      body: { kind: 'robe', c: '#e8b84a', under: '#fbf8f0', edge: '#3b6fc0', belt: '#8a6a3a', sleeve: '#d9a838' },
      legs: { boot: '#6a4a2a' },
      held: { kind: 'sky_featherFan' },
      // two long feathers stuck in his hat band
      head: (g, C) => { const { hy, r } = sky_H(C), x = C.back ? -r * 0.6 : r * 0.7; sky_tuck(g, x, hy - r + 1, -1.1, 8, '#ffffff', '#3b6fc0'); sky_tuck(g, x - 0.8, hy - r + 1.4, -1.45, 7, '#f5c542', '#d9a838'); },
    }),
    // Crockett the potter: shirtsleeves rolled up, a clay-spattered apron, dried clay on his hands, a white jug
    crockett: sky_person({ scale: 0.9, tone: '#f4efe4', edge: '#a8c8a0' }, {
      build: 'adult', skin: '#e0b894',
      face: { eye: '#3a2a1a', brow: '#2a1a0a', browW: 1.2, mouth: 'grin', nose: 'button', blush: 'rgba(210,100,80,0.4)' },
      hair: { style: 'curly', c: '#3a2a1a' },
      beard: { style: 'stubble', c: '#3a2a1a' },
      body: { kind: 'tunic', c: '#5aa86a', under: '#efe4cc', rolled: '#efe4cc', belt: '#4a3020', buckle: '#c9a36a', pouch: false, sleeve: '#efe4cc' },
      over: [{ kind: 'apron', c: '#d9cbb4', stain: 'rgba(160,120,80,0.45)' }],
      legs: { c: '#4a4a3a', boot: '#3a2a1c' },
      held: { kind: 'sky_pot' },
    }),
    // Hazel, who came for one apple: a purple dress, golden hair, and a basket full of everything except an apple
    hazel: sky_person({ scale: 0.9, tone: '#fdfaf6', edge: '#c8a8e8' }, {
      build: 'adult', skin: '#f5dcc8',
      face: { eye: '#5a3a8a', lash: '#3a2414', brow: '#c9a050', mouth: 'o', lip: '#c05a6a', blush: 'rgba(235,120,140,0.5)' },
      hair: { style: 'ponytail', c: '#f0c060', tie: '#b07ad9' },
      body: { kind: 'dress', c: '#b07ad9', under: '#ffffff', puff: true, sleeve: '#ffffff', belt: '#7a4aa8' },
      legs: { boot: '#7a4aa8' },
      held: { kind: 'basket', c: '#c9965a', fill: sky_marketFill },
    }),
    // Wim, whose wings are moulting: small ragged wings, a grey coat, a single white feather he is buying to put back
    wim: sky_person({ scale: 0.8, tone: '#e8e4dc', edge: '#a8a49c' }, {
      build: 'adult', skin: '#f2d0b5',
      face: { eye: '#3a2a1a', brow: '#6a4a2a', browW: 1, browTilt: 0.3, mouth: 'flat', nose: 'button', blush: 'rgba(220,110,100,0.5)' },
      hair: { style: 'short', c: '#8a5a2a' },
      body: { kind: 'coat', c: '#7a8a9a', under: '#efe8dc', button: '#f5c542', belt: '#3a3a44', buckle: '#f5c542', pouch: false, sleeve: '#6a7a8a' },
      legs: { c: '#4a4a54', boot: '#3a2a1c' },
      held: { kind: 'td_feather' },
      // a loose feather drifting down behind him
      behind: (g, C) => { const t = (time * 0.4 + C.seed) % 1; sky_feather(g, -9 + Math.sin(t * 9) * 1.4, -6 + t * 14, Math.PI / 2 + Math.sin(t * 7) * 0.6, 5, 1.6, '#e8e4dc', '#a8a49c'); },
    }),
  });

  // ---------- pieces used by more than one of them ----------
  // little silver wings on the sides of a helm (the Gate and the throne room)
  function sky_helmWings(g, C, c) {
    const { hy, r, ex } = sky_H(C), lift = Math.sin(time * 2.2 + C.seed) * 0.06;
    for (const s of [-1, 1]) { g.save(); g.translate(s * (r + 0.4) + ex * 0.3, hy - 3.6); g.scale(s, 1); g.rotate(-lift);
      for (let f = 2; f >= 0; f--) sky_feather(g, 0, 0, -0.7 - f * 0.4, 6.4 - f * 1, 2.4, shade(c, -f * 0.04), '#9ab0d0', null);
      ell(g, 0.2, 0.2, 1, 0.9); g.fillStyle = metal(g, '#f5c542', -0.8, 1.1); g.fill(); outline(g, 0.3);
      g.restore(); }
  }
  // the veil behind a coif: pale blue, falling to the shoulders, folds swaying
  function sky_veil(g, C, over) {
    const B = C.B, hy = B.hy, r = B.hr, y1 = B.sh + 8, sw = Math.sin(time * 2 + C.seed) * 0.4 + C.step * 0.4, c = '#9fb8dc';
    g.save(); if (!over) g.translate(0, C.bob);
    const v = () => { g.beginPath(); g.moveTo(-r + 0.4, hy - 2); g.quadraticCurveTo(-r - 2.4, hy + 6, -B.w + 0.4 + sw, y1); swayHem(g, -B.w + 0.4 + sw, B.w - 0.4 + sw, y1, 4, sw * 0.3, 1); g.quadraticCurveTo(r + 2.4, hy + 6, r - 0.4, hy - 2); g.quadraticCurveTo(0, hy - r - 2, -r + 0.4, hy - 2); g.closePath(); };
    v(); g.fillStyle = vfill(g, c, hy - r, y1, 0.3, -0.28); g.fill(); outline(g, 0.6);
    g.save(); v(); g.clip(); g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.45; for (const x of [-3.6, -1.2, 1.2, 3.6]) { g.beginPath(); g.moveTo(x * 0.5, hy + 2); g.quadraticCurveTo(x * 1.1 + sw * 0.4, (hy + y1) / 2, x * 1.4 + sw, y1); g.stroke(); } g.restore();
    g.restore();
  }
  // a tall lamplighter's hat with a gold band, a spare wick tucked in it
  function sky_tallHat(g, C, c, band) {
    const { hy, r, ex } = sky_H(C), x = C.back ? 0 : ex * 0.3, by = hy - r + 2.6, top = by - 7.6;
    ell(g, x, by, r + 1.8, 1.6); g.fillStyle = vfill(g, c, by - 1.6, by + 1.6, 0.3, -0.25); g.fill(); outline(g, 0.6);
    g.beginPath(); g.moveTo(x - r + 1.4, by); g.lineTo(x - r + 1.8, top); g.quadraticCurveTo(x, top - 1, x + r - 1.8, top); g.lineTo(x + r - 1.4, by); g.quadraticCurveTo(x, by + 1, x - r + 1.4, by); g.closePath();
    g.fillStyle = (() => { const gr = g.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, shade(c, 0.35)); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, -0.35)); return gr; })(); g.fill(); outline(g, 0.6);
    ell(g, x, top, r - 1.8, 0.9); g.fillStyle = shade(c, 0.25); g.fill(); outline(g, 0.4);
    g.beginPath(); g.moveTo(x - r + 1.5, by - 2.2); g.quadraticCurveTo(x, by - 1.4, x + r - 1.5, by - 2.2); g.lineTo(x + r - 1.4, by - 0.6); g.quadraticCurveTo(x, by + 0.2, x - r + 1.4, by - 0.6); g.closePath(); g.fillStyle = metal(g, band, by - 2.2, by); g.fill(); outline(g, 0.3);
    if (!C.back) { rr(g, x + r - 3.4, by - 5.4, 0.9, 4, 0.3); g.fillStyle = '#f2ead2'; g.fill(); outline(g, 0.25); g.strokeStyle = '#2a1a10'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(x + r - 2.95, by - 5.4); g.lineTo(x + r - 2.95, by - 6.2); g.stroke(); }
  }
  // Wick's satchel at his hip, letters sticking out of it
  function sky_satchel(g, C) {
    const x = -6.6, y = C.B.waist - 0.4, sw = C.step * 0.3;
    g.save(); g.translate(x, y); g.rotate(sw * 0.06);
    for (const [dx, a, c] of [[-1, -0.25, '#f6eedb'], [0.8, 0.2, '#e8f0f8']]) { g.save(); g.translate(dx, -0.6); g.rotate(a); rr(g, -1.2, -2.4, 2.4, 3, 0.2); g.fillStyle = c; g.fill(); outline(g, 0.3); g.restore(); }
    rr(g, -3, -0.4, 6, 5, 0.9); g.fillStyle = vfill(g, '#7a4a26', -0.4, 4.6, 0.25, -0.3); g.fill(); outline(g, 0.5);
    g.beginPath(); g.moveTo(-3, -0.4); g.lineTo(3, -0.4); g.lineTo(2.8, 2); g.quadraticCurveTo(0, 2.8, -2.8, 2); g.closePath(); g.fillStyle = vfill(g, '#8a5a30', -0.4, 2.6, 0.25, -0.2); g.fill(); outline(g, 0.4);
    rr(g, -0.6, 1.4, 1.2, 1.2, 0.3); g.fillStyle = '#f5c542'; g.fill();
    g.restore();
  }
  // what Old Ferris has pulled out of the cloud: a plank end, a cog, a teacup
  function sky_ferrisFinds(g, x, y) {
    g.save(); g.translate(x, y);
    g.save(); g.rotate(-0.5); rr(g, -0.8, -4.6, 1.6, 4.6, 0.3); g.fillStyle = vfill(g, '#a07a4a', -4.6, 0, 0.25, -0.25); g.fill(); outline(g, 0.35); g.restore();
    ell(g, 1.6, -1.2, 1.5, 1.5); g.fillStyle = metal(g, '#a9adb5', -2.7, 0.3); g.fill(); outline(g, 0.35); ell(g, 1.6, -1.2, 0.5, 0.5); g.fillStyle = '#4a4f5a'; g.fill();
    g.beginPath(); g.moveTo(-2.4, -0.4); g.lineTo(-2.2, -2.2); g.lineTo(-0.2, -2.2); g.lineTo(0, -0.4); g.closePath(); g.fillStyle = '#f2f2ec'; g.fill(); outline(g, 0.3); g.strokeStyle = '#5a8ad0'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(-2.2, -1.6); g.lineTo(-0.2, -1.6); g.stroke();
    g.restore();
  }
  // a wheat stamp on the flour sack
  function sky_wheat(g, x, y) {
    g.strokeStyle = '#4a6aa8'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(x, y + 3); g.lineTo(x, y - 2.6); g.stroke();
    g.fillStyle = '#4a6aa8'; for (let k = 0; k < 3; k++) for (const s of [-1, 1]) { ell(g, x + s * 0.7, y - 1.8 + k * 1.3, 0.5, 0.9, s * 0.5); g.fill(); } ell(g, x, y - 3, 0.4, 0.8); g.fill();
  }

  // ---------- groups/thistledown.js ----------
  // ================= THISTLEDOWN: the town's people, and Garrick the follower =================
  // Everyone in Thistledown but the four reference people (Brakka, Duke Ferrin, Old Wren live in reference.js), plus Garrick
  // the hired follower (the Dragon Killer Garrick who fights is the monster sample's). Each shopkeeper holds their trade at
  // the waist; the villagers each have their own hair, clothes and colours; Tess and Robin are small. Colours are today's.
  // Helpers here are prefixed td_; new held things are PROPS.td_*.

  // ---------- shared pieces ----------
  const TD = { mail: '#8f96a3', red: '#7a2e2e', purple: '#5a2e7a', leather: '#6b4a2a', cream: '#efe6d4', gold: '#e0b546', iron: '#4a4f5a' };
  // the thistle of Thistledown on a cream roundel with a gold rim (the town guards' badge, from mob-sample people.js)
  function td_thistle(g, x, y, k) {
    g.save(); g.translate(x, y); g.scale(k, k);
    ell(g, 0, 0, 2.9, 2.9); g.fillStyle = rfill(g, '#f2e8d0', 0, 0, 2.9); g.fill(); g.strokeStyle = TD.gold; g.lineWidth = 0.6; g.stroke();
    g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, 0.8); g.lineTo(0, 2.4); g.stroke();
    g.fillStyle = '#4a8a3a'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, 1.8); g.quadraticCurveTo(s * 1.4, 1, s * 2, 1.8); g.quadraticCurveTo(s * 1.2, 2.3, 0, 2.1); g.closePath(); g.fill(); }
    ell(g, 0, 0.5, 1.05, 0.85); g.fillStyle = '#5a9a3a'; g.fill(); g.strokeStyle = '#2f5a2a'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(-0.8, 0.1); g.lineTo(0.6, 1); g.moveTo(0.8, 0.1); g.lineTo(-0.6, 1); g.stroke();
    g.strokeStyle = '#a45ad0'; g.lineWidth = 0.55; g.lineCap = 'round'; for (let k2 = 0; k2 < 5; k2++) { const a = -Math.PI / 2 + (k2 - 2) * 0.32; g.beginPath(); g.moveTo(0, -0.2); g.lineTo(Math.cos(a) * 2.1, -0.2 + Math.sin(a) * 2.1); g.stroke(); }
    g.fillStyle = '#d8a6f0'; for (let k2 = 0; k2 < 5; k2++) { const a = -Math.PI / 2 + (k2 - 2) * 0.32; ell(g, Math.cos(a) * 2.1, -0.2 + Math.sin(a) * 2.1, 0.32, 0.32); g.fill(); }
    g.restore();
  }
  // mail rings on a tunic, round the sides of a tabard (the tabard's middle is left clear), and a hem of rings
  function td_mail(g, C) {
    const B = C.B, w = B.w, y0 = B.sh, hem = B.hem;
    g.save(); bodyPath(g, w, w + 1.3, w - 0.5, y0, hem); g.clip(); g.fillStyle = 'rgba(40,46,56,0.45)';
    for (let y = y0; y < hem; y += 1.45) { const odd = Math.round((y - y0) / 1.45) % 2; for (let x = -w - 1.5 + odd * 0.72; x < w + 1.5; x += 1.45) { if (Math.abs(x) < 5.9) continue; ell(g, x, y, 0.42, 0.34); g.fill(); } }
    g.restore();
    g.fillStyle = shade(TD.mail, -0.15); for (let x = -w + 0.6; x <= w - 0.6; x += 1.5) { if (Math.abs(x) < 5.6) continue; ell(g, x, hem + 0.1, 0.85, 0.75); g.fill(); outline(g, 0.2); }
  }
  // a belt drawn again over a tabard, with its buckle (and a little pouch)
  function td_belt(g, C, c, buckle, pouch) {
    const B = C.B, w = B.w, wy = B.waist;
    rr(g, -w - 0.3, wy, (w + 0.3) * 2, 1.6, 0.6); g.fillStyle = c; g.fill(); outline(g, 0.4);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(-w, wy + 0.2, w * 2, 0.4);
    if (C.back) return;
    rr(g, -1.3, wy - 0.3, 2.6, 2.2, 0.5); g.fillStyle = buckle || TD.gold; g.fill(); outline(g, 0.35); g.fillStyle = c; g.fillRect(-0.5, wy + 0.3, 1, 1);
    if (pouch) { rr(g, -w + 0.4, wy + 1.4, 3.2, 3, 0.9); g.fillStyle = vfill(g, pouch, wy + 1, wy + 4.4); g.fill(); outline(g, 0.45); g.fillStyle = shade(pouch, 0.25); g.fillRect(-w + 0.4, wy + 1.4, 3.2, 0.9); }
  }
  // steel shoulder plates with a lame below and a rivet
  function td_pauldrons(g, C, c) {
    const B = C.B, y = B.sh + 1.3;
    for (const s of [-1, 1]) {
      const x = s * (B.w + 0.6);
      ell(g, x + s * 0.2, y + 2.2, 3.2, 1.8, s * 0.25); g.fillStyle = metal(g, c, y + 0.6, y + 4); g.fill(); outline(g, 0.5);
      ell(g, x, y, 3.9, 3.1, s * 0.2); g.fillStyle = metal(g, c, y - 3, y + 3); g.fill(); outline(g, 0.6);
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.5; g.beginPath(); g.ellipse(x, y, 2.8, 2, s * 0.2, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
      rivets(g, [[x - s * 1.6, y + 1.4], [x + s * 1.6, y + 0.6]], shade(c, 0.6), 0.42);
    }
  }
  // round spectacles on the nose, the arms back to the ears
  function td_specs(g, C, col) {
    const hy = C.B.hy, r = C.B.hr, ex = C.fx * 1.8, ey = C.fy * 1.2;
    g.strokeStyle = col || '#c9a040'; g.lineWidth = 0.45;
    if (C.back) { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r - 0.4), hy + 0.4); g.lineTo(s * (r - 0.9), hy + 1.6); g.stroke(); } return; }
    for (const s of [-1, 1]) { const x = s * 2.7 + ex, y = hy + 0.9 + ey; ell(g, x, y, 1.75, 1.6); g.fillStyle = 'rgba(220,240,255,0.22)'; g.fill(); g.stroke(); g.beginPath(); g.moveTo(x + s * 1.7, y - 0.4); g.lineTo(s * (r - 0.3) + ex * 0.3, y - 0.9); g.stroke(); }
    g.beginPath(); g.moveTo(-1 + ex, hy + 0.6 + ey); g.quadraticCurveTo(ex, hy + 0.1 + ey, 1 + ex, hy + 0.6 + ey); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (const s of [-1, 1]) { ell(g, s * 2.7 + ex - 0.6, hy + 0.3 + ey, 0.45, 0.3, -0.5); g.fill(); }
  }
  // a smudge on the face (flour, soot, coal dust): spots = [[x, y, rx, ry]] from the face's centre
  function td_smudge(g, C, col, spots) { if (C.back) return; const hy = C.B.hy, ex = C.fx * 1.8, ey = C.fy * 1.2; g.fillStyle = col; for (const [x, y, rx, ry] of spots) { ell(g, x + ex, hy + y + ey, rx, ry, 0.3); g.fill(); } }
  // a ribbon bow, for hair
  function td_bow(g, x, y, c, k) {
    g.save(); g.translate(x, y); g.scale(k || 1, k || 1);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 1.6, -1.8, s * 2.6, -0.6); g.quadraticCurveTo(s * 2.4, 1.2, 0, 0); g.closePath(); g.fillStyle = vfill(g, c, -1.6, 1.2, 0.3, -0.25); g.fill(); outline(g, 0.3); g.beginPath(); g.moveTo(s * 0.3, 0.4); g.lineTo(s * 1.2, 2.4); g.lineTo(s * 0.4, 2.2); g.closePath(); g.fillStyle = c; g.fill(); outline(g, 0.25); }
    ell(g, 0, 0, 0.7, 0.6); g.fillStyle = shade(c, -0.15); g.fill(); outline(g, 0.25);
    g.restore();
  }
  // a little five-petal flower
  function td_flower(g, x, y, c, r) { r = r || 0.8; for (let k = 0; k < 5; k++) { const b = k / 5 * Math.PI * 2 - Math.PI / 2; ell(g, x + Math.cos(b) * r, y + Math.sin(b) * r, r * 0.8, r * 0.8); g.fillStyle = c; g.fill(); } g.strokeStyle = 'rgba(40,24,10,0.35)'; g.lineWidth = 0.2; for (let k = 0; k < 5; k++) { const b = k / 5 * Math.PI * 2 - Math.PI / 2; ell(g, x + Math.cos(b) * r, y + Math.sin(b) * r, r * 0.8, r * 0.8); g.stroke(); } ell(g, x, y, r * 0.55, r * 0.55); g.fillStyle = '#f5c542'; g.fill(); }
  // a leaf
  function td_leaf(g, x, y, len, ang, c) { g.save(); g.translate(x, y); g.rotate(ang); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.4, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.4, 0, 0); g.closePath(); g.fillStyle = c; g.fill(); outline(g, 0.25); g.restore(); }
  // a patch sewn on cloth
  function td_patch(g, x, y, w, h, c) { rr(g, x, y, w, h, 0.4); g.fillStyle = c; g.fill(); g.strokeStyle = 'rgba(30,20,10,0.6)'; g.lineWidth = 0.3; g.setLineDash([0.5, 0.5]); g.stroke(); g.setLineDash([]); }

  // ---------- new held things (hand at 0, 0; upright is -y) ----------
  // a goose-feather quill, ink on the nib
  PROPS.td_quill = (g, C, o) => {
    g.save(); g.rotate(0.3);
    g.beginPath(); g.moveTo(0, 0.6); g.quadraticCurveTo(-2.6, -4, -0.6, -10.6); g.quadraticCurveTo(0.6, -11.2, 0.6, -10); g.quadraticCurveTo(1.8, -4, 0.3, 0.6); g.closePath();
    g.fillStyle = vfill(g, o.c || '#f4f0e6', -11, 1, 0.2, -0.2); g.fill(); outline(g, 0.4);
    g.strokeStyle = 'rgba(120,110,95,0.6)'; g.lineWidth = 0.25; for (let y = -9; y < 0; y += 1.4) { g.beginPath(); g.moveTo(0, y); g.lineTo(-1.4, y + 0.9); g.moveTo(0.1, y + 0.4); g.lineTo(1, y + 1.1); g.stroke(); }
    g.strokeStyle = '#c9b89a'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(0.2, 3); g.quadraticCurveTo(-0.4, -4, -0.3, -10.4); g.stroke();
    g.strokeStyle = '#1a1830'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0.2, 1.6); g.lineTo(0.3, 3.4); g.stroke();
    g.restore();
  };
  // a big brass spanner, upright
  PROPS.td_wrench = (g, C, o) => {
    const c = o.c || '#a9adb5';
    rr(g, -0.9, -10.6, 1.8, 13.4, 0.8); g.fillStyle = metal(g, c, -10, 3); g.fill(); outline(g, 0.45);
    rr(g, -1, -0.6, 2, 3.4, 0.6); g.fillStyle = '#7a2e2e'; g.fill(); outline(g, 0.3);
    g.beginPath(); g.moveTo(-2.7, -9.8); g.lineTo(-2.9, -14.2); g.lineTo(-1.1, -14.6); g.lineTo(-1, -12.4); g.lineTo(1, -12.4); g.lineTo(1.1, -14.6); g.lineTo(2.9, -14.2); g.lineTo(2.7, -9.8); g.quadraticCurveTo(0, -8.6, -2.7, -9.8); g.closePath();
    g.fillStyle = metal(g, c, -14.6, -9); g.fill(); outline(g, 0.5);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-2.3, -13.8, 0.6, 3.4);
  };
  // a brass cog
  PROPS.td_cog = (g, C, o) => {
    const c = o.c || '#c9963a', cx = 0, cy = -2.6, spin = time * 0.6;
    g.beginPath(); for (let k = 0; k < 16; k++) { const a = spin + k / 16 * Math.PI * 2, rr2 = k % 2 ? 2.2 : 2.9; g.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } g.closePath();
    g.fillStyle = rfill(g, c, cx, cy, 2.9); g.fill(); outline(g, 0.4);
    ell(g, cx, cy, 0.8, 0.8); g.fillStyle = '#3a2a1a'; g.fill();
  };
  // a wooden bowl, empty, with a spoon in it
  PROPS.td_bowl = (g, C, o) => {
    g.save(); g.rotate(-0.1);
    g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0.6, 0.4); g.lineTo(2.6, -4.6); g.stroke(); g.strokeStyle = '#c9a06a'; g.lineWidth = 0.7; g.stroke();
    g.beginPath(); g.moveTo(-3.6, -0.2); g.quadraticCurveTo(-3.4, 3.4, 0, 3.4); g.quadraticCurveTo(3.4, 3.4, 3.6, -0.2); g.closePath(); g.fillStyle = vfill(g, '#9a6a3a', -0.2, 3.4, 0.25, -0.3); g.fill(); outline(g, 0.45);
    ell(g, 0, -0.2, 3.6, 0.9); g.fillStyle = '#5a3a1e'; g.fill(); outline(g, 0.35);
    g.strokeStyle = '#c9925a'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-3, 1.2); g.quadraticCurveTo(0, 2.2, 3, 1.2); g.stroke();
    g.restore();
  };
  // a garden trowel
  PROPS.td_trowel = (g, C, o) => {
    rr(g, -0.8, -1, 1.6, 3.6, 0.7); g.fillStyle = vfill(g, '#8a5a2b', -1, 2.6); g.fill(); outline(g, 0.35);
    g.strokeStyle = '#7d8087'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -1); g.lineTo(0, -2.6); g.stroke();
    g.beginPath(); g.moveTo(0, -2.4); g.quadraticCurveTo(-2.2, -3.4, -1.4, -6.6); g.quadraticCurveTo(-0.4, -8.4, 0, -8.8); g.quadraticCurveTo(0.4, -8.4, 1.4, -6.6); g.quadraticCurveTo(2.2, -3.4, 0, -2.4); g.closePath(); g.fillStyle = metal(g, '#9aa3b2', -9, -2); g.fill(); outline(g, 0.4);
    g.fillStyle = 'rgba(90,60,30,0.6)'; ell(g, 0.4, -7.2, 0.9, 0.7); g.fill();
  };
  // a woodcutter's axe, standing head-up beside him
  PROPS.td_axe = (g, C, o) => {
    const bot = (C.B.hip + C.B.leg) - C.B.hand.y;
    g.beginPath(); g.moveTo(-0.9, bot); g.quadraticCurveTo(-1.3, -4, -0.8, -15); g.lineTo(0.8, -15); g.quadraticCurveTo(0.6, -4, 0.9, bot); g.closePath(); g.fillStyle = vfill(g, '#9a7040', -15, bot, 0.3, -0.3); g.fill(); outline(g, 0.45);
    g.beginPath(); g.moveTo(-0.6, -15.4); g.lineTo(2.6, -15.2); g.quadraticCurveTo(5.4, -17.6, 6.4, -17); g.quadraticCurveTo(7, -13.6, 6.2, -10.4); g.quadraticCurveTo(5, -10.6, 2.6, -12.4); g.lineTo(-0.6, -12.6); g.closePath(); g.fillStyle = metal(g, o.c || '#8f96a3', -17, -10); g.fill(); outline(g, 0.5);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(6.2, -16.6); g.quadraticCurveTo(6.7, -13.6, 6, -10.8); g.stroke();
    rr(g, -1.1, -16, 2.2, 4.2, 0.5); g.fillStyle = metal(g, '#5a5f6a', -16, -12); g.fill(); outline(g, 0.35);
  };
  // a pie in its tin, crimped crust and steam
  PROPS.td_pie = (g, C, o) => {
    const y = 0.6;
    ell(g, 0, y + 1.2, 4, 1.5); g.fillStyle = vfill(g, '#8f96a3', y, y + 2.6, 0.3, -0.3); g.fill(); outline(g, 0.45);
    ell(g, 0, y, 3.6, 1.6); g.fillStyle = rfill(g, '#d9a050', 0, y, 3.6); g.fill(); outline(g, 0.4);
    g.fillStyle = '#b8782a'; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; ell(g, Math.cos(a) * 3.3, y + Math.sin(a) * 1.35, 0.45, 0.35); g.fill(); }
    g.strokeStyle = '#8a4a1a'; g.lineWidth = 0.4; for (const a of [-0.5, 0.5, Math.PI / 2 * 3]) { g.beginPath(); g.moveTo(Math.cos(a) * 0.6, y + Math.sin(a) * 0.3); g.lineTo(Math.cos(a) * 1.6, y + Math.sin(a) * 0.7); g.stroke(); }
    g.fillStyle = '#7a1e3a'; ell(g, 0, y, 0.5, 0.3); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.45; for (const [x, p] of [[-1.2, 0], [1, 1.7]]) { const t = (time * 0.8 + p) % 2, k = t / 2; g.globalAlpha *= 1 - k; g.beginPath(); g.moveTo(x, y - 1 - t * 2); g.quadraticCurveTo(x + 0.8, y - 2 - t * 2, x, y - 3 - t * 2); g.quadraticCurveTo(x - 0.8, y - 4 - t * 2, x, y - 5 - t * 2); g.stroke(); g.globalAlpha /= 1 - k; }
  };
  // a lump of coal
  PROPS.td_coal = (g, C, o) => {
    g.beginPath(); g.moveTo(-2, 0); g.lineTo(-1.4, -2.2); g.lineTo(0.6, -2.8); g.lineTo(2.2, -1.4); g.lineTo(2, 0.8); g.lineTo(0, 1.6); g.closePath(); g.fillStyle = vfill(g, '#2a2a30', -3, 2, 0.25, -0.2); g.fill(); outline(g, 0.4);
    g.strokeStyle = 'rgba(200,210,230,0.6)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-1.2, -1.6); g.lineTo(0.4, -2.2); g.lineTo(1.6, -1.2); g.stroke();
  };
  // a clay jug with a blue band
  PROPS.td_jug = (g, C, o) => {
    const c = o.c || '#c98a5a';
    g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.arc(-2.6, 0.2, 1.8, Math.PI * 0.5, Math.PI * 1.5); g.stroke(); g.strokeStyle = c; g.lineWidth = 0.8; g.stroke();
    g.beginPath(); g.moveTo(-1.4, -2.2); g.lineTo(1.4, -2.2); g.lineTo(2.2, -2.9); g.lineTo(1.8, -1.4); g.quadraticCurveTo(3.2, 0.4, 2.4, 3.4); g.lineTo(-2.4, 3.4); g.quadraticCurveTo(-3.2, 0.4, -1.4, -1.4); g.closePath();
    g.fillStyle = vfill(g, c, -2.6, 3.4, 0.3, -0.3); g.fill(); outline(g, 0.45);
    g.strokeStyle = '#3a6aa0'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-2.6, 0.6); g.quadraticCurveTo(0, 1.3, 2.6, 0.6); g.stroke();
    g.fillStyle = '#3a6aa0'; for (const x of [-1.4, 0, 1.4]) { ell(g, x, 1.9, 0.3, 0.3); g.fill(); }
    ell(g, -0.1, -2.3, 1.4, 0.4); g.fillStyle = '#6aa0d0'; g.fill();
  };
  // a fishing rod standing up, a little fish wriggling on the line
  PROPS.td_rod = (g, C, o) => {
    const bot = (C.B.hip + C.B.leg) - C.B.hand.y, top = -24, sw = Math.sin(time * 2.4 + C.seed) * 0.8 + C.step * 0.6;
    g.strokeStyle = OUT; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, bot); g.quadraticCurveTo(0.6, top / 2, 2.6, top); g.stroke();
    g.strokeStyle = '#a07a4a'; g.lineWidth = 0.9; g.stroke();
    g.strokeStyle = '#3a5a3a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, bot); g.lineTo(0.05, 1.2); g.stroke();
    ell(g, 1.6, 2.4, 1.1, 1.1); g.fillStyle = metal(g, '#a9adb5', 1.4, 3.4); g.fill(); outline(g, 0.3);
    g.strokeStyle = 'rgba(240,240,240,0.85)'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(2.6, top); g.lineTo(4.6 + sw, top + 9); g.stroke();
    g.save(); g.translate(4.6 + sw, top + 9); g.rotate(Math.PI / 2 + Math.sin(time * 7) * 0.3);
    ell(g, 1.6, 0, 1.9, 0.9); g.fillStyle = vfill(g, '#9ab0c0', -0.9, 0.9, 0.35, -0.2); g.fill(); outline(g, 0.3);
    g.beginPath(); g.moveTo(3.2, 0); g.lineTo(4.4, -0.9); g.lineTo(4.4, 0.9); g.closePath(); g.fillStyle = '#7a90a0'; g.fill(); outline(g, 0.25);
    ell(g, 0.6, -0.2, 0.25, 0.25); g.fillStyle = '#1a1a1a'; g.fill();
    g.restore();
  };
  // the gatehouse keys: a big iron ring and three great keys
  PROPS.td_bigkeys = (g, C, o) => {
    const sw = C.step * 0.15 + Math.sin(time * 2 + C.seed) * 0.05; g.save(); g.rotate(sw);
    g.strokeStyle = OUT; g.lineWidth = 1.1; g.beginPath(); g.arc(0, 1.8, 1.8, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#6a6f7a'; g.lineWidth = 0.6; g.stroke();
    for (const [a, c] of [[0.35, '#5a5f6a'], [0, '#c9a040'], [-0.35, '#5a5f6a']]) {
      g.save(); g.translate(0, 3.2); g.rotate(a);
      ell(g, 0, 0.6, 1, 1); g.strokeStyle = OUT; g.lineWidth = 0.9; g.stroke(); g.strokeStyle = c; g.lineWidth = 0.5; g.stroke();
      rr(g, -0.35, 1.4, 0.7, 4.6, 0.3); g.fillStyle = metal(g, c, 1, 6); g.fill(); outline(g, 0.25);
      g.fillStyle = c; g.fillRect(0.3, 4.4, 1.2, 0.6); g.fillRect(0.3, 5.4, 0.9, 0.5); g.strokeStyle = OUT; g.lineWidth = 0.2; g.strokeRect(0.3, 4.4, 1.2, 0.6);
      g.restore();
    }
    g.restore();
  };
  // a white swan feather
  PROPS.td_feather = (g, C, o) => {
    g.save(); g.rotate(-0.35 + Math.sin(time * 2.4) * 0.06);
    g.beginPath(); g.moveTo(0, 0.4); g.quadraticCurveTo(-2.2, -3.4, -0.4, -7.6); g.quadraticCurveTo(1.8, -4, 0.3, 0.4); g.closePath(); g.fillStyle = vfill(g, '#fbfaf4', -8, 0, 0.1, -0.15); g.fill(); outline(g, 0.35);
    g.strokeStyle = '#d9d2c0'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(0.1, 1.6); g.quadraticCurveTo(-0.2, -3, -0.4, -7.4); g.stroke();
    g.restore();
  };
  // one daisy
  PROPS.td_daisy = (g, C, o) => {
    const sw = Math.sin(time * 3 + C.seed) * 0.15; g.save(); g.rotate(sw);
    g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, 1); g.quadraticCurveTo(0.6, -2.6, 0, -6); g.stroke(); td_leaf(g, 0.2, -2.2, 2, -0.6, '#5a9a3a');
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ell(g, Math.cos(a) * 1.1, -6.4 + Math.sin(a) * 1.1, 0.75, 0.38, a); g.fillStyle = '#fbfaf4'; g.fill(); g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 0.2; g.stroke(); }
    ell(g, 0, -6.4, 0.6, 0.6); g.fillStyle = '#f5c542'; g.fill(); outline(g, 0.2);
    g.restore();
  };
  // a leather coin purse, the strings tied, a coin glinting
  PROPS.td_purse = (g, C, o) => {
    const sw = C.step * 0.12; g.save(); g.rotate(sw);
    g.beginPath(); g.moveTo(-1.2, 0.8); g.quadraticCurveTo(-3.4, 3, -2.4, 5.4); g.quadraticCurveTo(0, 6.6, 2.4, 5.4); g.quadraticCurveTo(3.4, 3, 1.2, 0.8); g.closePath(); g.fillStyle = vfill(g, '#8a5a2b', 0.8, 6, 0.3, -0.3); g.fill(); outline(g, 0.45);
    g.strokeStyle = '#d9b25c'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-1.4, 1.4); g.quadraticCurveTo(0, 2, 1.4, 1.4); g.stroke();
    ell(g, 0.8, 4, 0.9, 0.9); g.fillStyle = metal(g, TD.gold, 3, 5); g.fill(); outline(g, 0.25); sparkle(g, 1.2, 3.6, 0.9 * Math.max(0, Math.sin(time * 2.6)), '#fffbe0');
    g.restore();
  };
  // a twisted rope ending in a tassel (the bell-rope he carries)
  function td_rope(g, pts, c) {
    g.strokeStyle = OUT; g.lineWidth = 1.7; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.strokeStyle = c; g.lineWidth = 1.05; g.stroke();
    g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.3; g.setLineDash([0.5, 0.7]); g.stroke(); g.setLineDash([]);
  }

  // ---------- the basket fills ----------
  // Marta's general goods: a loaf, a coil of rope, a little hammer and a jar
  function td_goods(g) {
    ell(g, -2.4, 3, 2.2, 1.4, -0.2); g.fillStyle = rfill(g, '#c98a3a', -2.4, 3, 2.2); g.fill(); outline(g, 0.35);
    g.strokeStyle = '#f2d39a'; g.lineWidth = 0.3; for (const x of [-3.2, -2.2]) { g.beginPath(); g.moveTo(x, 2.4); g.lineTo(x + 0.6, 3.2); g.stroke(); }
    rr(g, 0.4, -1.4, 1.1, 5.4, 0.4); g.fillStyle = vfill(g, '#8a5a2b', -1, 4); g.fill(); outline(g, 0.3); rr(g, -0.6, -2.4, 3.2, 1.6, 0.4); g.fillStyle = metal(g, '#8f96a3', -2.4, -0.8); g.fill(); outline(g, 0.3);
    rr(g, 2, 0.6, 2.4, 3.2, 0.7); g.fillStyle = vfill(g, '#a8c8c0', 0.6, 3.8, 0.35, -0.15); g.fill(); outline(g, 0.3); rr(g, 1.9, 0.2, 2.6, 0.9, 0.3); g.fillStyle = '#7a2e2e'; g.fill();
    ell(g, 3.2, 2.4, 0.8, 0.6); g.fillStyle = '#c94a3a'; g.fill();
  }
  // Greta's seedlings: sprouts in soil and two seed packets
  function td_seedlings(g) {
    ell(g, 0, 3.8, 4.4, 1); g.fillStyle = '#5a3a1e'; g.fill();
    for (const [x, h, a] of [[-3, 3.4, -0.3], [-1, 4.4, 0], [1.2, 3.6, 0.2], [3, 3, 0.4]]) { g.strokeStyle = '#4a8a3a'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(x, 3.6); g.lineTo(x + a, 3.6 - h); g.stroke(); td_leaf(g, x + a, 3.6 - h, 1.6, -0.5, '#6ab04a'); td_leaf(g, x + a, 3.6 - h, 1.6, Math.PI + 0.5, '#5a9a3a'); }
    for (const [x, c, a] of [[-2, '#e8d9a0', -0.25], [2.2, '#d9a0a0', 0.2]]) { g.save(); g.translate(x, 2.4); g.rotate(a); rr(g, -1.1, -1.6, 2.2, 3, 0.3); g.fillStyle = vfill(g, c, -1.6, 1.4, 0.25, -0.15); g.fill(); outline(g, 0.25); ell(g, 0, -0.4, 0.5, 0.5); g.fillStyle = c === '#e8d9a0' ? '#c94a3a' : '#5a9a3a'; g.fill(); g.restore(); }
  }

  // ---------- the people ----------
  addPeople('thistledown', {
    // ---------- Garrick, the retired guard who follows the knight for 150 coins: his old dented kettle hat, a faded guard's ----------
    // tabard over mail, steel shoulder plates, a grey beard and great moustache, an iron sword standing at his side
    garrick: {
      build: 'adult', size: 1.04, geo: { w: 8.4, gap: 3.8, lw: 5.2 }, skin: SKIN.ruddy, hand: '#6b4a2e',
      face: { eye: '#2a2a3a', brow: '#6a5e52', browW: 1.3, browIn: 1.2, browTilt: 0.15, lines: true, nose: 'big', noseC: '#d99a7a', mouth: 'flat', scar: true },
      hair: { style: 'short', c: '#8a7a6a' },
      beard: { style: 'short', c: '#8a7a6a' },
      hat: { kind: 'helmet', c: TD.mail },
      body: { kind: 'tunic', c: TD.mail, collar: false, belt: '#4a3020', pouch: false, shoulders: false },
      over: [{ kind: 'tabard', c: '#6e3030', trim: '#b8963a', badge: (g, x, y, back) => td_thistle(g, x, back ? y - 1 : y, back ? 0.8 : 0.95) }],
      legs: { c: '#4a4036', boot: '#3a2a1c', cuff: '#5a3a22' },
      held: { kind: 'tool', tool: 'sword', c: '#a9adb5', guard: '#7d8087' },
      torso: (g, C) => {
        td_mail(g, C);
        // the tabard is old: a patch and a fray at the hem
        if (!C.back) { td_patch(g, -4.4, 7.4, 2.2, 2, '#8a4a3a'); g.strokeStyle = '#6e3030'; g.lineWidth = 0.35; for (const x of [1.6, 2.4, 3.2]) { g.beginPath(); g.moveTo(x, C.B.hem + 2.3); g.lineTo(x + 0.2, C.B.hem + 3.1); g.stroke(); } }
        td_belt(g, C, '#4a3020', '#8f96a3', '#6b4a2a');
        // a wineskin on his belt, facing us
        if (!C.back) { g.save(); g.translate(6.4, C.B.waist + 1.4); g.rotate(-0.2); ell(g, 0, 2.2, 1.6, 2.2); g.fillStyle = rfill(g, '#8a5a2b', 0, 2.2, 2.2); g.fill(); outline(g, 0.35); rr(g, -0.5, -0.4, 1, 0.9, 0.2); g.fillStyle = '#3a2410'; g.fill(); g.restore(); }
      },
      collar: (g, C) => td_pauldrons(g, C, TD.mail),
      // a dent in his old helmet; the moustache is long
      head: (g, C) => {
        const hy = C.B.hy;
        if (!C.back) { g.strokeStyle = 'rgba(40,44,52,0.7)'; g.lineWidth = 0.5; g.beginPath(); g.arc(3.2, hy - 8.6, 1.2, 0.3, 2.6); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.35; g.beginPath(); g.arc(3.2, hy - 8.2, 1.2, 0.6, 2.2); g.stroke(); }
      },
    },

    // ---------- Marta of the general store: a red dress, sleeves rolled, a long apron with a pencil in the pocket, ----------
    // her dark hair in a bun with a pencil through it, a basket of goods (a loaf, a hammer, a jar of pickles)
    marta: {
      build: 'adult', skin: SKIN.warm,
      face: { eye: '#3a2414', lash: '#2a1a10', brow: '#2a1a0a', lines: true, mouth: 'smile', lip: '#a04a42' },
      hair: { style: 'bun', c: '#3a2a1a' },
      body: { kind: 'dress', c: '#b04a3a', under: '#f2e8d4', rolled: '#f2e8d4', sleeve: '#a04232', belt: '#5a2a20' },
      over: [{ kind: 'apron', c: '#e8dcc0', pocketItem: (g, x, y) => { g.strokeStyle = OUT; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x + 0.8, y + 0.6); g.lineTo(x + 1.6, y - 2.2); g.stroke(); g.strokeStyle = '#e8c040'; g.lineWidth = 0.55; g.stroke(); g.fillStyle = '#3a2a1a'; ell(g, x + 1.6, y - 2.3, 0.25, 0.25); g.fill(); } }],
      legs: { boot: '#4a2a1c' },
      held: { kind: 'basket', c: '#b8864a', fill: td_goods },
      head: (g, C) => {
        // a pencil through the bun
        const hy = C.B.hy, r = C.B.hr, y = C.back ? hy - 2.4 : hy - r - 0.6;
        g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.moveTo(-3.4, y - 1.4); g.lineTo(3.4, y + 1); g.stroke(); g.strokeStyle = '#e8c040'; g.lineWidth = 0.6; g.stroke();
        g.fillStyle = '#e8a0a0'; ell(g, -3.4, y - 1.4, 0.4, 0.4); g.fill();
      },
    },

    // ---------- Aldous the banker: a navy frock coat with gold buttons over a red waistcoat, a white cravat, spectacles, ----------
    // a gold watch chain; bald on top, white whiskers; the ledger at his waist and a quill in the other hand
    aldous: {
      build: 'adult', skin: SKIN.light, hand: '#f2ece0',
      face: { eye: '#3a3a5a', age: 'elder', brow: '#e6e2da', browW: 0.9, mouth: 'smile', nose: 'long' },
      hair: { style: 'bald', c: '#d9d0c0' },
      body: { kind: 'coat', c: '#2e3b6a', under: '#8a2e2e', button: TD.gold, belt: false, sleeve: '#26325a', len: 1.2 },
      legs: { c: '#3a3a44', boot: '#1e1a1a' },
      held: { kind: 'book', c: '#5a2a1a' },
      off: { kind: 'td_quill' },
      torso: (g, C) => {
        if (C.back) { g.strokeStyle = shade('#2e3b6a', -0.4); g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, C.B.waist + 2); g.lineTo(0, C.B.hem + 3.4); g.stroke(); rivets(g, [[-1.6, C.B.waist + 1.6], [1.6, C.B.waist + 1.6]], TD.gold, 0.45); return; }
        const y0 = C.B.sh;
        // the waistcoat's buttons, the watch chain across it, the watch peeking from the pocket
        rivets(g, [[0, y0 + 4.8], [0, y0 + 6.6], [0, y0 + 8.4]], TD.gold, 0.4);
        g.strokeStyle = TD.gold; g.lineWidth = 0.4; g.beginPath(); g.moveTo(0, y0 + 6.6); g.quadraticCurveTo(1.6, y0 + 8.6, 3.2, y0 + 7.4); g.stroke();
        ell(g, 3.4, y0 + 7.2, 0.9, 0.9); g.fillStyle = metal(g, TD.gold, y0 + 6.2, y0 + 8.2); g.fill(); outline(g, 0.3);
        // the cravat
        g.beginPath(); g.moveTo(-1.8, y0 - 0.6); g.quadraticCurveTo(0, y0 + 0.6, 1.8, y0 - 0.6); g.lineTo(1, y0 + 1.4); g.quadraticCurveTo(1.4, y0 + 3.4, 0, y0 + 3.8); g.quadraticCurveTo(-1.4, y0 + 3.4, -1, y0 + 1.4); g.closePath(); g.fillStyle = vfill(g, '#f6f2e8', y0 - 1, y0 + 4, 0.1, -0.2); g.fill(); outline(g, 0.35);
        ell(g, 0, y0 + 1.6, 0.4, 0.4); g.fillStyle = '#c0392b'; g.fill();
      },
      head: (g, C) => {
        // white side-whiskers down the cheeks, then the spectacles
        const hy = C.B.hy, r = C.B.hr, ex = C.fx * 1.8;
        if (!C.back) { g.fillStyle = vfill(g, '#ece8e0', hy, hy + 5); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r - 0.4), hy - 0.6); g.quadraticCurveTo(s * (r + 0.4), hy + 3, s * (r - 2) + ex * 0.2, hy + 5.2); g.quadraticCurveTo(s * (r - 2.8), hy + 2.6, s * (r - 1.8), hy - 0.4); g.closePath(); g.fill(); outline(g, 0.35); } }
        td_specs(g, C, '#c9a040');
      },
    },

    // ---------- Rosalind of the bakery: a golden dress, a cream kerchief over chestnut braids, flour on her apron and ----------
    // her cheek, a basket of bread under a checked cloth, a rolling pin in the other hand
    rosalind: {
      build: 'adult', skin: SKIN.fair,
      face: { eye: '#3a6a3a', lash: '#2a1a10', brow: '#6a2a10', freckles: true, mouth: 'smile', lip: '#b0505a', blush: 'rgba(230,110,110,0.5)' },
      hair: { style: 'braids', c: '#7a3a1a', tie: '#efe6d4' },
      hat: { kind: 'kerchief', c: '#f2ece0', dots: '#e0b0a0' },
      body: { kind: 'dress', c: '#c89a4a', under: '#f6eedc', puff: true, sleeve: '#f2e6cc', belt: '#8a5a2a' },
      over: [{ kind: 'apron', c: '#f6f2ea', stain: 'rgba(255,255,255,0.9)' }],
      legs: { boot: '#5a3a22' },
      held: { kind: 'basket', c: '#c4904e', fill: 'bread', cloth: '#c0392b' },
      off: { kind: 'tool', tool: 'rollingpin' },
      torso: (g, C) => {
        if (C.back) return;
        // a floury handprint on the apron
        g.fillStyle = 'rgba(255,255,255,0.75)'; const x = 2.6, y = C.B.waist + 3.4; ell(g, x, y, 1.1, 1.2); g.fill(); for (const [dx, dy] of [[-1.2, -1.4], [-0.4, -1.9], [0.4, -1.9], [1.2, -1.5], [1.6, 0]]) { ell(g, x + dx, y + dy, 0.35, 0.6, dx * 0.3); g.fill(); }
      },
      head: (g, C) => td_smudge(g, C, 'rgba(255,255,255,0.8)', [[-4.2, 2.4, 1.1, 0.6], [2.6, -2.2, 0.7, 0.4]]),
      // the checked cloth over the bread
      after: (g, C) => { },
    },

    // ---------- Pim the tinker: ginger curls under a leather cap and brass goggles, freckles and a soot smudge, a leather ----------
    // vest over purple, sleeves rolled, a tool belt (a screwdriver, a little hammer, a pouch of bolts), a big spanner and a cog
    pim: {
      build: 'adult', skin: SKIN.fair,
      face: { eye: '#3a5a2a', lash: '#2a1a10', brow: '#a0582a', freckles: true, eyes: 'happy', mouth: 'grin', blush: 'rgba(230,110,100,0.45)' },
      hair: { style: 'curly', c: '#c9843a' },
      hat: { kind: 'goggles', c: '#c9963a', cap: '#6b4a2a', lens: '#5aa0c0' },
      body: { kind: 'tunic', c: '#6a5a8a', under: '#e9dcc0', rolled: '#e9dcc0', sleeve: '#5e4f7e', belt: '#4a3020', buckle: '#a9adb5', pouch: false, len: 0.8 },
      over: [{ kind: 'vest', c: '#7a5230', button: '#c9963a' }],
      legs: { c: '#4a4050', boot: '#3a2a1c', cuff: '#6b4a2a', patch: '#8a7a5a' },
      held: { kind: 'td_wrench' },
      off: { kind: 'td_cog' },
      torso: (g, C) => {
        if (C.back) return; const wy = C.B.waist;
        // the tool belt: a screwdriver, a little hammer, a pouch of bolts
        g.save(); g.translate(-5.4, wy + 1.4); g.rotate(0.15); rr(g, -0.5, 0, 1, 3.4, 0.3); g.fillStyle = metal(g, '#a9adb5', 0, 3.4); g.fill(); outline(g, 0.25); rr(g, -0.9, -1.8, 1.8, 2.2, 0.6); g.fillStyle = '#c0392b'; g.fill(); outline(g, 0.3); g.restore();
        g.save(); g.translate(-3.2, wy + 1.4); g.rotate(-0.1); rr(g, -0.4, 0, 0.8, 4, 0.3); g.fillStyle = '#8a5a2b'; g.fill(); outline(g, 0.25); rr(g, -1.4, 3.4, 2.8, 1.4, 0.4); g.fillStyle = metal(g, '#7d8087', 3.4, 4.8); g.fill(); outline(g, 0.3); g.restore();
        rr(g, 2.8, wy + 1.4, 3, 2.8, 0.8); g.fillStyle = vfill(g, '#8a6a3a', wy + 1, wy + 4.2); g.fill(); outline(g, 0.35); g.fillStyle = '#a9adb5'; for (const [x, y] of [[3.6, wy + 1.2], [4.6, wy + 0.9], [5.2, wy + 1.4]]) { ell(g, x, y, 0.45, 0.45); g.fill(); }
      },
      head: (g, C) => td_smudge(g, C, 'rgba(40,30,30,0.45)', [[0.8, 2.4, 1, 0.5], [-4.4, -0.4, 0.8, 0.5]]),
    },

    // ---------- Dorran the innkeeper of the Barrel & Boar: big and jolly, bald with a dark beard, a red nose, a long ----------
    // apron with an ale stain, a striped cloth over his shoulder, a foaming tankard and the room keys
    dorran: {
      build: 'adult', size: 1.08, geo: { w: 9, gap: 3.9, lw: 5.4, hand: { x: 11, y: 5 } }, skin: SKIN.light,
      face: { eye: '#2a1a10', eyes: 'happy', brow: '#2a1a0a', browW: 1.1, nose: 'big', noseC: '#e09080', mouth: 'grin', blush: 'rgba(225,90,80,0.5)' },
      hair: { style: 'bald', c: '#3a2a1a' },
      beard: { style: 'full', c: '#3a2a1a' },
      body: { kind: 'tunic', c: '#6a3a2a', under: '#f2e8d4', rolled: '#f2e8d4', sleeve: '#f2e8d4', belt: '#3a2010', buckle: '#a9adb5', pouch: false, collar: false },
      over: [{ kind: 'vest', c: '#4a2a1a', button: '#c9a040' }, { kind: 'apron', c: '#f2ece0', stain: 'rgba(170,110,40,0.4)' }],
      legs: { c: '#3a3028', boot: '#2a1e16' },
      held: { kind: 'tankard' },
      off: { kind: 'keys' },
      // the striped bar cloth over his shoulder
      collar: (g, C) => {
        const B = C.B, s = C.back ? 1 : -1, x = s * (B.w - 1.6), y = B.sh - 1, sw = C.step * 0.3;
        g.save(); g.translate(x, y);
        const cl = () => { g.beginPath(); g.moveTo(-2.2, 0); g.quadraticCurveTo(0, -1.4, 2.4, 0.2); g.lineTo(2 + sw, 8.6); g.lineTo(-1.8 + sw, 8.4); g.closePath(); };
        cl(); g.fillStyle = vfill(g, '#f2ece0', -1, 9, 0.15, -0.2); g.fill(); outline(g, 0.45);
        g.save(); cl(); g.clip(); g.strokeStyle = '#3a6aa0'; g.lineWidth = 0.7; for (const y2 of [5.6, 7]) { g.beginPath(); g.moveTo(-3, y2); g.lineTo(3 + sw, y2 + 0.1); g.stroke(); } g.restore();
        g.strokeStyle = '#d9d0c0'; g.lineWidth = 0.3; for (const x2 of [-1.4, -0.4, 0.6, 1.6]) { g.beginPath(); g.moveTo(x2 + sw, 8.5); g.lineTo(x2 + sw, 9.4); g.stroke(); }
        g.restore();
      },
    },

    // ---------- Sergeant Hale, who drills the town at dawn: a kettle hat with a red plume, a quilted grey gambeson, a red ----------
    // sash and three gold stripes, a great black moustache and a stern brow; a spear with a pennant, a wooden practice sword
    hale: {
      build: 'adult', size: 1.04, geo: { w: 8.6 }, skin: SKIN.tan, hand: '#5a3a22',
      face: { eye: '#1e140c', eyes: 'narrow', brow: '#1a1008', browW: 1.5, browIn: 1, browTilt: -0.35, mouth: 'frown', lines: true, scar: true },
      hair: { style: 'crop', c: '#2a1a0a' },
      beard: { style: 'moustache', c: '#2a1a0a' },
      hat: { kind: 'helmet', c: TD.mail, plume: '#b0202c' },
      body: { kind: 'tunic', c: '#4a4f5a', collar: false, belt: '#3a2614', buckle: TD.gold, pouch: '#5a3a22', sleeve: '#5a5f6a', epaulet: '#b0202c' },
      legs: { c: '#3a3a40', boot: '#1e1a16', cuff: '#4a3020' },
      held: { kind: 'spear', haft: '#8a6a3a', blade: '#c9ccd3', band: '#9aa0aa', pennant: '#a52a2a' },
      off: { kind: 'tool', tool: 'sword', c: '#c9a06a', guard: '#7a5230' },
      torso: (g, C) => {
        const B = C.B, w = B.w;
        // the quilting of the gambeson
        g.save(); bodyPath(g, w, w + 1.3, w - 0.5, B.sh, B.hem); g.clip(); g.strokeStyle = 'rgba(30,32,40,0.45)'; g.lineWidth = 0.35;
        for (let y = B.sh + 1.4; y < B.hem; y += 1.8) { if (y > B.waist - 0.6 && y < B.waist + 2) continue; g.beginPath(); g.moveTo(-w - 1, y); g.quadraticCurveTo(0, y + 0.5, w + 1, y); g.stroke(); }
        for (const x of [-4.4, 0, 4.4]) { g.beginPath(); g.moveTo(x, B.sh); g.lineTo(x * 1.1, B.hem); g.stroke(); } g.restore();
        // the red sash, shoulder to hip
        g.strokeStyle = OUT; g.lineWidth = 2.2; g.beginPath(); g.moveTo(C.back ? w - 1.2 : -w + 1.2, B.sh + 0.2); g.lineTo(C.back ? -w + 1.6 : w - 1.6, B.waist + 1); g.stroke(); g.strokeStyle = '#a52a2a'; g.lineWidth = 1.6; g.stroke();
        g.strokeStyle = 'rgba(255,200,180,0.4)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(C.back ? w - 1.3 : -w + 1.3, B.sh - 0.3); g.lineTo(C.back ? -w + 1.5 : w - 1.5, B.waist + 0.4); g.stroke();
        // the sergeant's stripes on his chest
        if (!C.back) { g.strokeStyle = OUT; g.lineWidth = 1; for (let k = 0; k < 3; k++) { const y = B.sh + 2.6 + k * 1.1; g.beginPath(); g.moveTo(2.6, y); g.lineTo(3.9, y + 0.9); g.lineTo(5.2, y); g.stroke(); } g.strokeStyle = TD.gold; g.lineWidth = 0.6; for (let k = 0; k < 3; k++) { const y = B.sh + 2.6 + k * 1.1; g.beginPath(); g.moveTo(2.6, y); g.lineTo(3.9, y + 0.9); g.lineTo(5.2, y); g.stroke(); } }
      },
    },

    // ---------- Tobin, who wants his loaf: a lanky fellow in a patched olive tunic, a brown cloth cap, a scruffy chin, a ----------
    // rope belt, a walking stick, and an empty bowl he keeps holding out
    tobin: {
      build: 'adult', geo: { w: 7.4, leg: 7.2 }, skin: SKIN.light,
      face: { eye: '#3a2a1a', eyes: 'narrow', brow: '#4a2a10', browW: 0.9, browTilt: 0.3, mouth: 'frown', nose: 'long' },
      hair: { style: 'short', c: '#5a3a1a' },
      beard: { style: 'stubble', c: '#5a3a1a' },
      hat: { kind: 'cap', c: '#6a5a46' },
      body: { kind: 'tunic', c: '#6a6a4a', under: '#d9cfb0', laces: true, belt: '#c9a66b', buckle: '#b8a070', pouch: '#7a5a3a', sleeve: '#5e5e42' },
      legs: { c: '#5a4a3a', boot: '#3a2a1c', patch: '#7a6a4a' },
      held: { kind: 'staff', c: '#8a6a3a', len: 21, top: (g, top) => { ell(g, 0, top + 1.6, 1.6, 1.8); g.fillStyle = rfill(g, '#8a6a3a', 0, top + 1.6, 1.8); g.fill(); outline(g, 0.4); } },
      off: { kind: 'td_bowl' },
      torso: (g, C) => {
        if (C.back) { td_patch(g, 1.4, C.B.sh + 3, 2.6, 2.4, '#8a8a5a'); return; }
        td_patch(g, -5.6, C.B.sh + 3.6, 2.4, 2.2, '#8a7a4a'); td_patch(g, 2.6, C.B.hem - 2.4, 2.2, 1.8, '#5a6a3a');
        // the rope belt's knot and ends
        g.strokeStyle = '#c9a66b'; g.lineWidth = 0.6; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(2 + s * 0.4, C.B.waist + 1.2); g.lineTo(2.4 + s * 0.9 + C.step * 0.3, C.B.waist + 4.4); g.stroke(); }
      },
    },

    // ---------- Greta of the seed shop: a wide straw hat with a green band and a sunflower, blond braids, a green dress ----------
    // and apron with seeds in the pocket, a seed pouch on her belt, a basket of seedlings, a trowel
    greta: {
      build: 'adult', skin: SKIN.light,
      face: { eye: '#3a6a3a', lash: '#2a1a10', brow: '#a08040', freckles: true, mouth: 'smile', lip: '#b05a50', blush: 'rgba(230,120,100,0.5)' },
      hair: { style: 'braids', c: '#e0c080', tie: '#3f7a3a' },
      hat: { kind: 'straw', c: '#e0c87a', band: '#3f7a3a', flower: '#f5c542' },
      body: { kind: 'dress', c: '#4a7a3a', under: '#f2ead2', rolled: '#f2ead2', sleeve: '#426e34', belt: '#5a3a1e' },
      over: [{ kind: 'apron', c: '#e9dfc6', pocketItem: (g, x, y) => { g.fillStyle = '#8a5a2a'; for (const [dx, dy] of [[-1, 0.2], [0, -0.3], [1, 0.1], [-0.4, 0.6], [0.6, 0.7]]) { ell(g, x + dx, y + dy + 0.4, 0.35, 0.25); g.fill(); } } }],
      legs: { boot: '#5a3a22' },
      held: { kind: 'basket', c: '#b8864a', fill: td_seedlings },
      off: { kind: 'td_trowel' },
      torso: (g, C) => {
        if (C.back) return;
        // the seed pouch on her belt, its drawstring tied
        const y = C.B.waist + 1;
        g.save(); g.translate(-6.6, y); g.rotate(0.1); g.beginPath(); g.moveTo(-1, 0); g.quadraticCurveTo(-2.6, 2, -1.8, 3.8); g.quadraticCurveTo(0, 4.6, 1.8, 3.8); g.quadraticCurveTo(2.6, 2, 1, 0); g.closePath(); g.fillStyle = vfill(g, '#a07a4a', 0, 4.4); g.fill(); outline(g, 0.4);
        g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-1.2, 0.6); g.quadraticCurveTo(0, 1.2, 1.2, 0.6); g.stroke(); td_leaf(g, 0, 2.4, 1.4, -0.8, '#5a9a3a'); g.restore();
      },
    },

    // ---------- Fennick the trader, just in off the road: a long ochre travelling coat, a wide felt hat with a feather, ----------
    // a thin moustache and a gold earring, a great pack with a bedroll and a pot, a walking staff and a jingling purse
    fennick: {
      build: 'adult', skin: SKIN.brown,
      face: { eye: '#1e140c', eyes: 'narrow', brow: '#1a1008', browW: 0.8, browTilt: -0.15, mouth: 'grin', nose: 'long' },
      hair: { style: 'tied', c: '#2a1a0a' },
      beard: { style: 'moustache', c: '#2a1a0a' },
      body: { kind: 'coat', c: '#8a6a2a', under: '#5a4a3a', button: '#c9a040', belt: '#4a3020', buckle: '#c9a040', pouch: false, len: 2.4, sleeve: '#7a5c22' },
      legs: { c: '#3e3a34', boot: '#5a3a22', cuff: '#7a5230' },
      held: { kind: 'staff', c: '#7a5230', len: 24, top: (g, top) => { ell(g, 0, top + 1, 2, 2.2); g.fillStyle = rfill(g, '#7a5230', 0, top + 1, 2.2); g.fill(); outline(g, 0.45); g.strokeStyle = '#c9a040'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0.6, top + 2.4); g.lineTo(1.6, top + 5); g.stroke(); ell(g, 1.6, top + 5.8, 0.9, 1); g.fillStyle = metal(g, '#d9a840', top + 5, top + 7); g.fill(); outline(g, 0.3); } },
      off: { kind: 'td_purse' },
      // facing us: the bedroll over his shoulders, behind the head; side-on, the pack behind him
      behind: (g, C) => { if (C.side) td_pack(g, C, -8.4); else td_bedroll(g, C, C.B.sh - 2.4); },
      torso: (g, C) => {
        if (C.back) return; const B = C.B;
        // the pack's straps over his shoulders
        for (const s of [-1, 1]) { g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.moveTo(s * 5.2, B.sh - 0.6); g.quadraticCurveTo(s * 5.6, B.sh + 3, s * 6.4, B.waist - 0.4); g.stroke(); g.strokeStyle = '#5a3a1e'; g.lineWidth = 1; g.stroke(); }
        rivets(g, [[-5.5, B.sh + 2.4], [5.5, B.sh + 2.4]], '#c9a040', 0.45);
      },
      head: (g, C) => {
        td_feltHat(g, C, '#5a3a20', '#a52a2a', '#3a7aa0');
        // the gold earring
        if (!C.back) { const hy = C.B.hy, r = C.B.hr; g.strokeStyle = TD.gold; g.lineWidth = 0.45; g.beginPath(); g.arc(-r + 0.2, hy + 3.2, 0.7, 0, Math.PI * 2); g.stroke(); }
      },
      after: (g, C) => { if (C.back) td_pack(g, C, 0); },
    },

    // ---------- Ada, who hears everything: a plum dress, a white coif over dark hair, a mustard knitted shawl, a basket ----------
    // of eggs under a cloth
    v1: {
      build: 'adult', skin: SKIN.brown,
      face: { eye: '#1e140c', lash: '#1e140c', brow: '#1a1008', lines: true, mouth: 'smile', lip: '#7a3a32', browTilt: 0.2 },
      hair: { style: 'long', c: '#2a1a0a' },
      hat: { kind: 'coif', c: '#f2ece0' },
      body: { kind: 'dress', c: '#7a4a6a', under: '#e9dcc8', sleeve: '#6a3e5c', belt: '#4a2a3a' },
      over: [{ kind: 'shawl', c: '#c9a040' }],
      legs: { boot: '#3a2a22' },
      held: { kind: 'basket', c: '#a87a42', fill: 'eggs', cloth: '#e9dcc0' },
    },

    // ---------- Bram, who warns of wolves: a woodcutter in a rust knitted cap, a short brown beard, a leather vest over ----------
    // blue-grey, a bundle of kindling on his back, an axe standing beside him
    v2: {
      build: 'adult', size: 1.02, geo: { w: 8.4 }, skin: SKIN.tan,
      face: { eye: '#2a1a10', brow: '#3a2410', browW: 1, mouth: 'flat', nose: 'big', noseC: '#b8805a' },
      hair: { style: 'short', c: '#5a3a1a' },
      beard: { style: 'short', c: '#5a3a1a' },
      hat: { kind: 'wool', c: '#a0502a', rim: '#8a4422', bobble: '#e9dcc0' },
      body: { kind: 'tunic', c: '#4a6a7a', under: '#d9cfb0', laces: true, belt: '#3a2614', buckle: '#8f96a3', pouch: '#6b4a2a', rolled: '#d9cfb0', sleeve: '#42606e' },
      over: [{ kind: 'vest', c: '#6b4a2a', button: '#3a2614' }],
      legs: { c: '#4a4036', boot: '#3a2a1c', cuff: '#7a6a5a' },
      held: { kind: 'td_axe' },
      behind: (g, C) => { if (!C.side) td_kindling(g, C, C.B.sh - 1); },
      after: (g, C) => { if (C.back) td_kindling(g, C, C.B.sh + 1 + C.bob, true); },
    },

    // ---------- Cass, who will only say "Rosalind's pies": a sage dress, a ginger ponytail with a green ribbon, freckles, ----------
    // and one of those pies, still steaming
    v3: {
      build: 'adult', skin: SKIN.fair,
      face: { eye: '#3a6a3a', lash: '#2a1a10', brow: '#a0582a', freckles: true, eyes: 'happy', mouth: 'smile', lip: '#b0505a' },
      hair: { style: 'ponytail', c: '#c9843a', tie: '#3f7a3a' },
      body: { kind: 'dress', c: '#6a7a4a', under: '#f2ead2', puff: true, sleeve: '#e9dfc6', belt: '#4a5a2a' },
      legs: { boot: '#5a3a22' },
      held: { kind: 'td_pie' },
      head: (g, C) => { const hy = C.B.hy, r = C.B.hr; if (!C.back) td_bow(g, r - 0.6, hy - 2.2, '#4a8a3a', 0.8); else td_bow(g, 0, hy + 2.4, '#4a8a3a', 0.8); },
    },

    // ---------- Dunn, who digs in the quarry: black curls, coal dust on his face and stubble, a dark leather jerkin, ----------
    // sleeves rolled, a patched knee, a pickaxe standing beside him and a lump of coal
    v4: {
      build: 'adult', size: 1.02, skin: SKIN.light,
      face: { eye: '#2a2a3a', brow: '#1a1008', browW: 1.1, mouth: 'grin', nose: 'button' },
      hair: { style: 'curly', c: '#2a1a0a' },
      beard: { style: 'stubble', c: '#2a1a0a' },
      body: { kind: 'tunic', c: '#5a5a5a', under: '#cdbfa0', rolled: '#cdbfa0', sleeve: '#4e4e4e', belt: '#2a1e16', buckle: '#8f96a3', pouch: '#4a3a2a', collar: false },
      over: [{ kind: 'vest', c: '#3a2e26', button: '#8f96a3' }],
      legs: { c: '#4a4036', boot: '#2a1e16', cuff: '#5a4a3a', patch: '#6a5a4a' },
      held: { kind: 'tool', tool: 'pick', c: '#7d8087' },
      off: { kind: 'td_coal' },
      torso: (g, C) => { g.fillStyle = 'rgba(30,26,24,0.3)'; for (const [x, y, r] of [[-4.2, C.B.waist + 2.6, 1.2], [3.4, C.B.sh + 3, 0.9], [-1.4, C.B.hem - 1.2, 0.8]]) { ell(g, x, y, r, r * 0.7, 0.4); g.fill(); } },
      head: (g, C) => td_smudge(g, C, 'rgba(30,26,24,0.42)', [[3.8, 1.8, 1.4, 0.7], [-2.6, -2.6, 1.2, 0.5], [-4.6, 2.6, 0.7, 0.5]]),
    },

    // ---------- Elsie, who saw a goblin barrel walk (walk!): long blond hair with a pink bow, a mauve dress with puffed ----------
    // sleeves, big round eyes and a little "oh"; a clay water jug
    v5: {
      build: 'adult', skin: SKIN.fair,
      face: { eye: '#3a5a9a', lash: '#2a1a10', brow: '#b09050', eyes: 'big', mouth: 'o', blush: 'rgba(235,120,130,0.55)' },
      hair: { style: 'long', c: '#e0c080' },
      body: { kind: 'dress', c: '#8a5a7a', under: '#f6eedc', puff: true, sleeve: '#f0dce8', belt: '#5a3050', trim: '#f0dce8' },
      legs: { boot: '#4a2a3a' },
      held: { kind: 'td_jug' },
      head: (g, C) => { const hy = C.B.hy, r = C.B.hr; td_bow(g, C.back ? -2 : -r + 1.6, hy - 4.6, '#e88aa8', 1); },
    },

    // ---------- Finn, the lad who knows the drill at dawn: tousled dark hair, freckles, a blue tunic with the sleeves ----------
    // rolled, a satchel across him, a fishing rod with a little fish wriggling on the line
    v6: {
      build: 'adult', size: 0.96, skin: SKIN.light,
      face: { eye: '#3a4a7a', brow: '#2a1a0a', freckles: true, mouth: 'grin', blush: 'rgba(230,120,110,0.4)' },
      hair: { style: 'short', c: '#3a2a1a' },
      body: { kind: 'tunic', c: '#4a5a8a', under: '#e9dfc6', laces: true, rolled: '#e9dfc6', sleeve: '#42507c', belt: '#4a3020', pouch: false },
      legs: { c: '#6a5a44', boot: '#4a3020', cuff: '#e9dfc6' },
      held: { kind: 'td_rod' },
      torso: (g, C) => {
        const B = C.B;
        g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.moveTo(C.back ? -5.8 : 5.8, B.sh - 0.4); g.lineTo(C.back ? 5.6 : -5.6, B.waist); g.stroke(); g.strokeStyle = '#8a5a2b'; g.lineWidth = 0.9; g.stroke();
        if (!C.back) { rr(g, -8.6, B.waist - 0.6, 4.2, 3.6, 0.8); g.fillStyle = vfill(g, '#8a5a2b', B.waist - 1, B.waist + 3); g.fill(); outline(g, 0.4); g.beginPath(); g.moveTo(-8.6, B.waist - 0.4); g.lineTo(-4.4, B.waist - 0.4); g.lineTo(-4.8, B.waist + 1.4); g.lineTo(-8.2, B.waist + 1.4); g.closePath(); g.fillStyle = '#6b4220'; g.fill(); outline(g, 0.3); ell(g, -6.5, B.waist + 1.2, 0.4, 0.4); g.fillStyle = '#c9a040'; g.fill(); }
      },
      // a tuft that sticks up
      head: (g, C) => { const hy = C.B.hy, r = C.B.hr; g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(-1, hy - r + 0.2); g.quadraticCurveTo(-0.6, hy - r - 2.6, 1.6, hy - r - 2); g.quadraticCurveTo(0.4, hy - r - 1, 1, hy - r + 0.4); g.closePath(); g.fill(); outline(g, 0.35); },
    },

    // ---------- Gatewarden Osric, who watches the West Gate all night: Thistledown purple over mail, a kettle hat with a ----------
    // purple plume, a short purple cloak, a full grey beard, a spear with a purple pennant, the great gate keys and a lantern
    osric: {
      build: 'adult', size: 1.04, geo: { w: 8.4 }, skin: SKIN.light, hand: '#5a3a22',
      face: { eye: '#2a2a3a', age: 'elder', brow: '#5a5a5a', browW: 1.2, mouth: 'smile', nose: 'big', noseC: '#e0a088' },
      hair: { style: 'short', c: '#6a6a6a' },
      beard: { style: 'full', c: '#7a7a7a' },
      hat: { kind: 'helmet', c: TD.mail, plume: '#9a5ad0' },
      body: { kind: 'tunic', c: TD.mail, collar: false, belt: '#3a2614', pouch: false, sleeve: '#7d8490' },
      over: [{ kind: 'tabard', c: TD.purple, trim: TD.gold, badge: (g, x, y, back) => td_thistle(g, x, back ? y - 1 : y, back ? 0.8 : 0.95) }],
      cloak: { c: '#3e1e56', lining: '#6a3a8a', clasp: TD.gold, len: -3.4 },
      legs: { c: '#3a3440', boot: '#2a1e16', cuff: '#4a3020' },
      held: { kind: 'spear', haft: '#7a5a3a', blade: '#c9ccd3', band: TD.gold, pennant: '#7a3aa0' },
      off: { kind: 'td_bigkeys' },
      torso: (g, C) => {
        td_mail(g, C); td_belt(g, C, '#3a2614', TD.gold, false);
        // a little lantern hooked on his belt for the night watch
        if (!C.back) { g.save(); g.translate(-5.6, C.B.waist + 1.2); g.scale(0.62, 0.62); PROPS.lantern(g, C, {}); g.restore(); }
      },
    },

    // ---------- Ambrose the bell-ringer: an old man with a white forked beard and bald crown, a slate robe with a rope ----------
    // belt, the bell-rope coiled over his shoulder, a bronze bell on a chain, a hand bell that rings when he talks
    ambrose: {
      build: 'adult', skin: SKIN.light,
      face: { eye: '#3a3a4a', age: 'elder', brow: '#f2eee6', browW: 1.2, browTilt: 0.25, mouth: 'smile', nose: 'big', noseC: '#e0a088' },
      hair: { style: 'bald', c: '#e6e2da' },
      beard: { style: 'forked', c: '#ece8e0' },
      body: { kind: 'robe', c: '#4a4f5a', under: '#2e3240', edge: '#7a8090', belt: '#c9a66b', sleeve: '#40454f' },
      over: [{ kind: 'chain', c: '#b8863a', medal: (g, x, y) => { g.beginPath(); g.moveTo(x - 0.8, y - 1.2); g.quadraticCurveTo(x - 1, y + 0.6, x - 1.6, y + 1.2); g.lineTo(x + 1.6, y + 1.2); g.quadraticCurveTo(x + 1, y + 0.6, x + 0.8, y - 1.2); g.closePath(); g.fillStyle = metal(g, '#b8863a', y - 1.4, y + 1.2); g.fill(); outline(g, 0.3); } }],
      legs: { boot: '#2a2420' },
      held: { kind: 'bell', c: '#d9a840' },
      // the bell-rope over his shoulder and a coil at his hip
      collar: (g, C) => {
        const B = C.B, s = C.back ? -1 : 1;
        td_rope(g, [[-s * (B.w - 1.4), B.sh - 0.6], [-s * 2, B.sh + 3], [s * 3, B.waist], [s * (B.w - 1.2), B.waist + 2.2]], '#c9a66b');
        if (!C.back) { for (let k = 0; k < 3; k++) { g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.ellipse(B.w - 2, B.waist + 3.6 + k * 0.5, 2.2 - k * 0.2, 1.6, 0.3, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#c9a66b'; g.lineWidth = 0.9; g.stroke(); } g.fillStyle = '#c9a66b'; g.beginPath(); g.moveTo(B.w - 1.6, B.waist + 5); g.lineTo(B.w - 2.4, B.waist + 8); g.lineTo(B.w - 0.8, B.waist + 8); g.closePath(); g.fill(); outline(g, 0.3); }
      },
    },

    // ---------- Hettie the apple seller: round and rosy, a red dress, a green dotted kerchief over dark hair, an apron ----------
    // with an apple in the pocket, a basket of red and green apples, and one held out to you
    hettie: {
      build: 'adult', size: 1.03, geo: { w: 8.6 }, skin: SKIN.warm,
      face: { eye: '#3a2414', lash: '#2a1a10', brow: '#2a1a0a', eyes: 'happy', mouth: 'smile', lip: '#a0404a', blush: 'rgba(230,80,80,0.55)', lines: true },
      hair: { style: 'long', c: '#3a2a1a' },
      hat: { kind: 'kerchief', c: '#3f7a3a', dots: '#f2ece0' },
      body: { kind: 'dress', c: '#b8352b', under: '#f2e8d4', rolled: '#f2e8d4', sleeve: '#a42e26', belt: '#5a2018' },
      over: [{ kind: 'apron', c: '#efe6d4', pocketItem: (g, x, y) => { ell(g, x + 0.6, y + 0.2, 1.1, 1); g.fillStyle = rfill(g, '#9ab83a', x + 0.6, y + 0.2, 1.1); g.fill(); outline(g, 0.3); } }],
      legs: { boot: '#4a2a1c' },
      held: { kind: 'basket', c: '#b8864a', fill: 'apples' },
      off: { kind: 'apple', c: '#c8302a' },
    },

    // ---------- Mabel the candle maker: a blue dress, a cream shawl, ginger hair in a bun with a blue ribbon, wax drips ----------
    // on her half apron, a basket of candles and one lit in her other hand
    mabel: {
      build: 'adult', skin: SKIN.fair,
      face: { eye: '#2e5a9a', lash: '#2a1a10', brow: '#a0582a', freckles: true, mouth: 'smile', lip: '#b0505a', eyes: 'sleepy' },
      hair: { style: 'bun', c: '#c9843a', tie: '#2e5a9a' },
      body: { kind: 'dress', c: '#2e5a9a', under: '#f2ead2', sleeve: '#28508a', belt: '#1e3a6a' },
      over: [{ kind: 'apron', c: '#efe6d4', bib: false, stain: '#f2e2a0' }, { kind: 'shawl', c: '#e8dcc0' }],
      legs: { boot: '#3a2a22' },
      held: { kind: 'basket', c: '#a87a42', fill: 'candles' },
      off: { kind: 'candle', c: '#f2ead2' },
      head: (g, C) => { const hy = C.B.hy, r = C.B.hr; if (!C.back) td_bow(g, 2.2, hy - r - 0.8, '#3a6aaa', 0.6); },
    },

    // ---------- Moll the flower seller: long blond hair and a crown of flowers, a green dress and apron, a basket of ----------
    // flowers on her arm and a little posy held out
    moll: {
      build: 'adult', skin: SKIN.light,
      face: { eye: '#3a6a3a', lash: '#2a1a10', brow: '#a08040', mouth: 'smile', lip: '#c05a6a', blush: 'rgba(235,120,140,0.55)' },
      hair: { style: 'long', c: '#e0c080' },
      body: { kind: 'dress', c: '#3f7d33', under: '#f6eedc', puff: true, sleeve: '#f0e6d0', belt: '#2a5a24' },
      over: [{ kind: 'apron', c: '#f2ece0', pocketItem: (g, x, y) => { g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(x, y + 0.6); g.lineTo(x - 0.6, y - 1.6); g.moveTo(x + 0.4, y + 0.6); g.lineTo(x + 1, y - 1.2); g.stroke(); td_flower(g, x - 0.6, y - 1.8, '#e04a6a', 0.55); td_flower(g, x + 1, y - 1.4, '#9a6ad0', 0.5); } }],
      legs: { boot: '#4a3020' },
      held: { kind: 'basket', c: '#c4904e', fill: 'flowers' },
      off: { kind: 'flowers', cs: ['#e04a6a', '#ffffff', '#f5d76a', '#e87a3a'], wrap: '#f2ece0' },
      head: (g, C) => td_wreath(g, C),
    },

    // ---------- Wynn by Swan Pond, still naming the ducklings: a girl in a mauve dress and white pinafore, chestnut ----------
    // braids with pink ribbons, a crust of bread for the swans and a white swan feather
    wynn: {
      build: 'adult', size: 0.86, geo: { hr: 7.8, hy: -10.6 }, skin: SKIN.light,
      face: { eye: '#5a3a1a', lash: '#2a1a10', brow: '#6a2a10', age: 'child', freckles: true, mouth: 'smile', lip: '#b0505a' },
      hair: { style: 'braids', c: '#7a3a1a', tie: '#e88aa8' },
      body: { kind: 'dress', c: '#8a5a7a', under: '#f6eedc', puff: true, sleeve: '#7e5070', belt: false, len: -0.6 },
      over: [{ kind: 'apron', c: '#fbf8f0', w: 4.2 }],
      legs: { boot: '#5a3a2a' },
      held: { kind: 'bread' },
      off: { kind: 'td_feather' },
    },

    // ---------- Tess, who plays tag round the fountain: a little girl in a pink dress with cream puffed sleeves, blond ----------
    // pigtails with pink ribbons, a gap-toothed grin, a daisy
    tess: {
      build: 'child', skin: '#f2d6bf',
      face: { eye: '#3a5a9a', lash: '#2a1a10', brow: '#b09050', age: 'child', freckles: true, mouth: 'grin' },
      hair: { style: 'braids', c: '#e0c080', tie: '#e04a7a' },
      body: { kind: 'dress', c: '#c94a6a', under: '#fbf3e4', puff: true, sleeve: '#e9d8b8', belt: '#e9d8b8', trim: '#fbf3e4' },
      legs: { boot: '#a0303a' },
      off: { kind: 'td_daisy' },
      head: (g, C) => { const hy = C.B.hy, r = C.B.hr; if (!C.back) { g.fillStyle = '#3a1a14'; g.fillRect(-0.3 + C.fx * 1.8, hy + 3.2 + C.fy * 1.2, 0.6, 0.6); } td_flower(g, C.back ? -2.6 : r - 2.4, hy - r + 2.2, '#ffffff', 0.7); },
    },

    // ---------- Robin, who is "it": a little boy in a blue tunic with cream sleeves, scruffy brown hair, bare knees with ----------
    // a plaster on one, a catapult in his belt and a wooden sword
    robin: {
      build: 'child', skin: '#e8c0a0',
      face: { eye: '#3a2a1a', brow: '#4a2a10', age: 'child', freckles: true, mouth: 'grin' },
      hair: { style: 'short', c: '#6a3a1a' },
      body: { kind: 'tunic', c: '#3f7db8', under: '#f2e8d0', sleeve: '#d9c9a0', belt: '#6b4a2a', buckle: '#c9a040', pouch: false, laces: true },
      legs: { bare: '#e8c0a0', boot: '#5a3a22', cuff: '#d9c9a0' },
      held: { kind: 'tool', tool: 'sword', c: '#d9b07a', guard: '#8a5a2b' },
      torso: (g, C) => {
        if (C.back) return;
        // a catapult tucked in his belt
        g.save(); g.translate(-4.6, C.B.waist - 1.6); g.rotate(-0.2); g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 4); g.lineTo(0, 1.6); g.moveTo(0, 1.6); g.lineTo(-1.2, -0.6); g.moveTo(0, 1.6); g.lineTo(1.2, -0.6); g.stroke(); g.strokeStyle = '#a07a4a'; g.lineWidth = 0.7; g.stroke(); g.strokeStyle = '#c0392b'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(-1.2, -0.6); g.quadraticCurveTo(0, 0.6, 1.2, -0.6); g.stroke(); g.restore();
      },
      // messy tufts, and a plaster on his knee
      head: (g, C) => { const hy = C.B.hy, r = C.B.hr; g.fillStyle = '#6a3a1a'; for (const [x, a] of [[-2, -0.5], [0.6, 0.1], [2.8, 0.6]]) { g.save(); g.translate(x, hy - r + 0.6); g.rotate(a); g.beginPath(); g.moveTo(-1, 0.4); g.quadraticCurveTo(-0.2, -2.6, 0.8, -2.2); g.quadraticCurveTo(0.2, -1, 1, 0.4); g.closePath(); g.fill(); outline(g, 0.3); g.restore(); } },
      after: (g, C) => { if (C.back) return; const B = C.B, y = B.hip + C.step * 1.8 + 1.6; rr(g, B.gap - 1.2, y, 2.4, 1.3, 0.4); g.fillStyle = '#f2dcb0'; g.fill(); outline(g, 0.25); g.fillStyle = 'rgba(160,110,70,0.5)'; g.fillRect(B.gap - 0.3, y + 0.2, 0.6, 0.9); },
    },
  });
  // ---------- the riverside (the Great Spread, Stage 5b: 85-riverside): Wilf at the Old Bridge, Tamsin and Odo in ----------
  // Millbrook, Nan Gully in Saltmere. Drawn by the sample's own hand (npc specs, the same pieces as Thistledown's people)
  addPeople('riverside', {
    // ---------- Wilf the stonemason, who mended the Old Bridge in stone: a dusty grey tunic, a leather apron, a flat ----------
    // cap, a short grey beard, a mason's hammer
    wilf: {
      build: 'adult', size: 1.02, geo: { w: 8.4 }, skin: SKIN.ruddy,
      face: { eye: '#2a2a3a', brow: '#8a8278', browW: 1.2, lines: true, nose: 'big', noseC: '#c98a6a', mouth: 'smile', age: 'elder' },
      hair: { style: 'short', c: '#a8a098' },
      beard: { style: 'short', c: '#a8a098' },
      hat: { kind: 'cap', c: '#5a5650' },
      body: { kind: 'tunic', c: '#8a8680', under: '#d9cfb8', rolled: '#d9cfb8', sleeve: '#7a7670', belt: '#3a2a1c', buckle: '#8f96a3', pouch: '#5a4030' },
      over: [{ kind: 'leather', c: '#7a5434' }],
      legs: { c: '#5a5046', boot: '#3a2a1c', cuff: '#7a6a5a', patch: '#6a6056' },
      held: { kind: 'tool', tool: 'hammer', c: '#7d8087' },
      torso: (g, C) => { g.fillStyle = 'rgba(230,226,214,0.35)'; for (const [x, y, r] of [[-3.6, C.B.waist + 1.8, 1.1], [2.8, C.B.sh + 2.6, 0.9], [0.4, C.B.hem - 1.4, 1]]) { ell(g, x, y, r, r * 0.7, 0.3); g.fill(); } },
    },
    // ---------- Tamsin the miller: a sky-blue dress, a white apron dusted with flour, a cream kerchief over brown curls, ----------
    // flour on her cheek, a fresh loaf from her own flour
    tamsin_miller: {
      build: 'adult', skin: SKIN.light,
      face: { eye: '#3a5a7a', lash: '#2a1a10', brow: '#5a3a1a', freckles: true, eyes: 'happy', mouth: 'smile', lip: '#b05a5a', blush: 'rgba(235,130,120,0.45)' },
      hair: { style: 'curly', c: '#6a4426' },
      hat: { kind: 'kerchief', c: '#efe6d0', dots: '#c9b890' },
      body: { kind: 'dress', c: '#5a86b0', under: '#f4ecdc', rolled: '#f4ecdc', sleeve: '#4e7aa2', belt: '#3a5a7a' },
      over: [{ kind: 'apron', c: '#f6f2e8', stain: '#e8e2d2' }],
      legs: { boot: '#4a3020' },
      held: { kind: 'bread' },
      head: (g, C) => { if (C.back) return; g.fillStyle = 'rgba(250,248,240,0.75)'; ell(g, -3.6, C.B.hy + 2.4, 1.3, 0.8, 0.3); g.fill(); },
    },
    // ---------- Odo the farmer: a wide straw hat, a sun-browned face, a brown beard, a green smock under a leather ----------
    // vest, muddy boots, his hoe
    odo: {
      build: 'adult', size: 1.05, geo: { w: 8.8 }, skin: SKIN.tan,
      face: { eye: '#2a1a10', brow: '#4a2e14', browW: 1.2, mouth: 'grin', nose: 'button', lines: true },
      hair: { style: 'short', c: '#5a3a1a' },
      beard: { style: 'full', c: '#5a3a1a' },
      hat: { kind: 'straw', c: '#d9c88a' },
      body: { kind: 'tunic', c: '#5a7a3e', under: '#e0d4b0', laces: true, rolled: '#e0d4b0', sleeve: '#506e38', belt: '#3a2614', buckle: '#8f96a3', pouch: '#6b4a2a' },
      over: [{ kind: 'vest', c: '#7a5434', button: '#3a2614' }],
      legs: { c: '#6a5a44', boot: '#4a3020', cuff: '#8a6a4a', patch: '#7a6a54' },
      held: { kind: 'tool', tool: 'hoe', c: '#7d8087' },
      after: (g, C) => { if (C.back) return; g.fillStyle = 'rgba(90,64,34,0.55)'; for (const s of [-1, 1]) { ell(g, s * C.B.gap, C.B.hip + C.B.leg - 0.6, 1.8, 0.8); g.fill(); } },
    },
    // ---------- Nan Gully the fishmonger: an old woman of the marsh, a sea-grey shawl over a blue dress, a striped ----------
    // apron, a red kerchief over white hair, and a lobster held up by its middle
    nan_gully: {
      build: 'adult', size: 0.97, skin: SKIN.warm,
      face: { eye: '#2a3a4a', lash: '#2a1a10', brow: '#d9d0c0', lines: true, age: 'elder', eyes: 'narrow', mouth: 'grin', lip: '#9a4a42', nose: 'long' },
      hair: { style: 'bun', c: '#e8e2d6' },
      hat: { kind: 'kerchief', c: '#b8352b', dots: '#f2ece0' },
      body: { kind: 'dress', c: '#3a5a7a', under: '#ece4d2', sleeve: '#344f6c', belt: '#2a3a4a' },
      over: [{ kind: 'apron', c: '#dfe6e8', bib: false, stain: '#b8c8cc' }, { kind: 'shawl', c: '#8a9498' }],
      legs: { boot: '#3a2a22' },
      held: { kind: 'hf_lobster' },
    },
  });
  // ---------- the Crossroads Inn (the Great Spread, Stage 5c: 84-crossroads): Mother Hobb the cook, and the two ----------
  // travellers who wander the junction. Drawn by the sample's own hand (npc specs, the same pieces as Thistledown's people)
  addPeople('crossroads', {
    // ---------- Mother Hobb: a round, rosy old cook, white hair in a bun under a cream coif, a rust dress, a stew-spotted ----------
    // apron, a pie in one hand and a steaming bowl in the other
    mother_hobb: {
      build: 'adult', size: 1.04, geo: { w: 9.6, gap: 4 }, skin: SKIN.ruddy,
      face: { eye: '#3a2a1a', lash: '#2a1a10', brow: '#d8d0c4', lines: true, age: 'elder', eyes: 'happy', mouth: 'smile', lip: '#a04a42', nose: 'button', blush: 'rgba(230,110,100,0.55)' },
      hair: { style: 'bun', c: '#d8d0c4' },
      hat: { kind: 'coif', c: '#f2ece0' },
      body: { kind: 'dress', c: '#a0522d', under: '#f4ecdc', rolled: '#f4ecdc', sleeve: '#8e4826', belt: '#5a2a16' },
      over: [{ kind: 'apron', c: '#f4f0e6', stain: 'rgba(150,80,30,0.35)' }],
      legs: { boot: '#3a2418' },
      held: { kind: 'td_pie' },
      off: { kind: 'td_bowl' },
    },
    // ---------- Jory the pedlar: a plum travelling coat, a knitted cap, a stubbly grin, a walking staff and a great ----------
    // pack on his back, a pot and a roll of cloth tied to it
    jory: {
      build: 'adult', size: 1.0, skin: SKIN.tan,
      face: { eye: '#2a1a10', brow: '#4a2a14', browW: 1.1, mouth: 'grin', nose: 'long', lines: true },
      hair: { style: 'short', c: '#7a4a24' },
      beard: { style: 'stubble', c: '#5a3a1a' },
      hat: { kind: 'wool', c: '#7a3a4a' },
      body: { kind: 'coat', c: '#6a5a8a', under: '#d9cfb8', sleeve: '#5e4f7c', belt: '#3a2614', buckle: '#c9a64a', pouch: '#6b4a2a' },
      legs: { c: '#4a4038', boot: '#3a2a1c', cuff: '#6a5a4a', patch: '#5a5046' },
      held: { kind: 'staff', c: '#7a5a34', len: 28 },
      behind: (g, C) => { const B = C.B; rr(g, -B.w - 1.6, B.sh - 4.6, (B.w + 1.6) * 2, 13, 2.2); g.fillStyle = vfill(g, '#8a6a42', B.sh - 5, B.sh + 9, 0.2, -0.25); g.fill(); outline(g, 0.5);
        ell(g, B.w - 0.4, B.sh - 5.4, 2.6, 1.8); g.fillStyle = metal(g, '#9a9ea6', B.sh - 7, B.sh - 4); g.fill(); outline(g, 0.4);
        rr(g, -B.w - 2.2, B.sh - 7.4, 5.4, 3.2, 1.4); g.fillStyle = '#b8352b'; g.fill(); outline(g, 0.35); },
      back: (g, C) => { const B = C.B; rr(g, -B.w - 1.2, B.sh - 3.6, (B.w + 1.2) * 2, B.waist - B.sh + 5.2, 2); g.fillStyle = vfill(g, '#8a6a42', B.sh - 4, B.waist + 2, 0.2, -0.25); g.fill(); outline(g, 0.5);
        g.strokeStyle = '#5a3c22'; g.lineWidth = 0.9; for (const y of [B.sh + 1.4, B.waist - 1]) { g.beginPath(); g.moveTo(-B.w - 1.2, y); g.lineTo(B.w + 1.2, y); g.stroke(); } },
    },
    // ---------- Marigold the drover: a blue kerchief over copper braids, freckles, a moss-green tunic under a leather ----------
    // jerkin, stout boots, and her shepherd's crook
    marigold: {
      build: 'adult', size: 0.98, skin: SKIN.light,
      face: { eye: '#3a5a3a', lash: '#2a1a10', brow: '#a8642a', freckles: true, eyes: 'round', mouth: 'smile', lip: '#b05a5a', blush: 'rgba(235,130,110,0.4)' },
      hair: { style: 'braids', c: '#c9843a' },
      hat: { kind: 'kerchief', c: '#3f5f8a', dots: '#e8dcc0' },
      body: { kind: 'tunic', c: '#7a8a4a', under: '#ece2c8', laces: true, rolled: '#ece2c8', sleeve: '#6e7e42', belt: '#3a2614', buckle: '#a8a090', pouch: '#5a3a22' },
      over: [{ kind: 'leather', c: '#8a5a34' }],
      legs: { c: '#5a4a36', boot: '#3a2a1c', cuff: '#7a5a3a', patch: '#6a5a44' },
      held: { kind: 'staff', c: '#8a6a3a', len: 30, top: (g, top) => { g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(0, top + 3); g.lineTo(0, top - 1); g.arc(-2.8, top - 1, 2.8, 0, Math.PI * 1.15, true); g.stroke();
        g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, top + 3); g.lineTo(0, top - 1); g.arc(-2.8, top - 1, 2.8, 0, Math.PI * 1.15, true); g.stroke(); } },
    },
  });

  // ---------- the wild places (the Great Spread, Stage 5d: 86-wildplaces): Ansel the beacon keeper on the ridge, and ----------
  // Hilde the trapper and Corvin the hunter at the Hunters' Lodge. Drawn by the sample's own hand (npc specs)
  // a wolf pelt over her arm: grey fur, a paler belly, the legs hanging
  PROPS.wl_pelt = (g, C, o) => {
    g.save(); g.rotate(0.15);
    g.beginPath(); g.moveTo(-4.2, -3.6); g.quadraticCurveTo(0, -5.2, 4.4, -3.4); g.lineTo(3.6, 1.6); g.lineTo(4.8, 6.4); g.lineTo(2.4, 4.2); g.lineTo(0.6, 7.6); g.lineTo(-1, 4.4); g.lineTo(-3.6, 6.6); g.lineTo(-3, 1.4); g.closePath();
    g.fillStyle = vfill(g, '#8a8078', -5, 7, 0.2, -0.25); g.fill(); outline(g, 0.5);
    g.fillStyle = 'rgba(235,228,214,0.55)'; ell(g, 0.2, 0.2, 1.8, 3); g.fill();
    g.strokeStyle = 'rgba(60,54,48,0.6)'; g.lineWidth = 0.35; for (const x of [-2.6, -0.8, 1.2, 3]) { g.beginPath(); g.moveTo(x, -3.6); g.lineTo(x + 0.4, -1.6); g.stroke(); }
    g.restore();
  };
  // a steel jaw trap, held up by its chain: two toothed jaws open on the spring plate
  PROPS.wl_trap = (g, C, o) => {
    g.save(); g.lineCap = 'round';
    g.strokeStyle = '#5a5e66'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, -1); g.lineTo(0.4, 2.2); g.stroke();
    for (let k = 0; k < 3; k++) { ell(g, 0.2 + k * 0.1, -0.6 + k * 1.1, 0.5, 0.7); g.strokeStyle = '#7d8087'; g.lineWidth = 0.4; g.stroke(); }
    const cy = 6.2;
    ell(g, 0.4, cy, 2.2, 1.2); g.fillStyle = metal(g, '#8f96a3', cy - 1.2, cy + 1.2); g.fill(); outline(g, 0.35);
    for (const s of [-1, 1]) { g.beginPath(); g.arc(0.4 + s * 2.6, cy, 3, s < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, s < 0 ? Math.PI * 1.5 : Math.PI * 0.5); g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke(); g.strokeStyle = '#a9adb5'; g.lineWidth = 0.8; g.stroke();
      g.fillStyle = '#d8dce2'; for (let k = 0; k < 3; k++) { const a = (s < 0 ? Math.PI : 0) + (k - 1) * 0.7; const x = 0.4 + s * 2.6 + Math.cos(a) * 2.6, y = cy + Math.sin(a) * 2.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - s * 1.1, y - 0.4); g.lineTo(x - s * 1.1, y + 0.4); g.closePath(); g.fill(); } }
    g.restore();
  };
  addPeople('wildplaces', {
    // ---------- Ansel the beacon keeper: a weathered old man in a long brown coat and a knitted cap, a white beard, his ----------
    // lamplighter's pole with its little flame at the top
    ansel: {
      build: 'adult', size: 1.0, geo: { w: 8.2 }, skin: SKIN.ruddy,
      face: { eye: '#2a2a3a', brow: '#d8d2c6', browW: 1.2, lines: true, age: 'elder', nose: 'big', noseC: '#c98a6a', mouth: 'smile' },
      hair: { style: 'short', c: '#cfcac0' },
      beard: { style: 'full', c: '#e2ddd2' },
      hat: { kind: 'wool', c: '#8a3a2a' },
      body: { kind: 'coat', c: '#7a5a3a', under: '#d9cfb8', sleeve: '#6e5034', belt: '#3a2614', buckle: '#c9a64a', pouch: '#5a3a22' },
      legs: { c: '#4a4038', boot: '#3a2a1c', cuff: '#6a5a4a', patch: '#5a5046' },
      held: { kind: 'sky_lamppole' },
    },
    // ---------- Hilde the trapper: a broad, cheerful woman of the wood, auburn braids under a fur-edged hood, a moss ----------
    // tunic under a leather jerkin, and a wolf pelt over her arm
    hilde_trapper: {
      build: 'adult', size: 1.02, geo: { w: 8.8 }, skin: SKIN.tan,
      face: { eye: '#3a4a2a', lash: '#2a1a10', brow: '#8a4a1e', freckles: true, eyes: 'happy', mouth: 'grin', lip: '#a04a42', blush: 'rgba(230,120,100,0.4)' },
      hair: { style: 'braids', c: '#b8742e' },
      hat: { kind: 'hood', c: '#6a4a2e' },
      body: { kind: 'tunic', c: '#5a6a3a', under: '#e6dcc0', laces: true, rolled: '#e6dcc0', sleeve: '#4e5e34', belt: '#3a2614', buckle: '#8f96a3', pouch: '#6b4a2a' },
      over: [{ kind: 'leather', c: '#7a5434' }],
      legs: { c: '#5a4a36', boot: '#3a2a1c', cuff: '#7a5a3a', patch: '#6a5a44' },
      held: { kind: 'wl_pelt' },
    },
    // ---------- Corvin the hunter: a lean man in a green hood, a dark trimmed beard, a leather vest over a brown tunic, ----------
    // a steel jaw trap held up by its chain
    corvin_hunter: {
      build: 'adult', size: 1.03, skin: SKIN.light,
      face: { eye: '#2a3a2a', brow: '#3a2a1a', browW: 1.1, mouth: 'smile', nose: 'long', lines: true },
      hair: { style: 'short', c: '#3a2a1a' },
      beard: { style: 'short', c: '#3a2a1a' },
      hat: { kind: 'hood', c: '#3e5a32' },
      body: { kind: 'tunic', c: '#6a5038', under: '#d9cfb8', rolled: '#d9cfb8', sleeve: '#5e4632', belt: '#2a1e12', buckle: '#a8a090', pouch: '#4a3422' },
      over: [{ kind: 'vest', c: '#4a3a28', button: '#2a1e12' }],
      legs: { c: '#3e4630', boot: '#2e2218', cuff: '#5a4a36', patch: '#4a5238' },
      held: { kind: 'wl_trap' },
    },
  });

  // ---------- pieces only one person uses ----------
  // Fennick's wide felt hat: a dented crown, a red band, a blue feather swept back
  function td_feltHat(g, C, c, band, feather) {
    const hy = C.B.hy, r = C.B.hr, ex = C.fx * 1.8, back = C.back, wv = Math.sin(time * 2.6 + C.seed) * 0.3;
    const brim = () => { g.beginPath(); g.ellipse(ex * 0.3, hy - 3.2, r + 4.4, 2.5, 0, 0, Math.PI * 2); };
    brim(); g.fillStyle = vfill(g, c, hy - 5.6, hy - 0.8, 0.25, -0.3); g.fill(); outline(g, 0.7);
    if (!back) { g.strokeStyle = shade(c, 0.35); g.lineWidth = 0.4; g.beginPath(); g.ellipse(ex * 0.3, hy - 3.2, r + 3.6, 1.9, 0, 0.1, Math.PI - 0.1); g.stroke(); }
    // the feather, swept back from the band
    g.save(); g.translate(-r + 1.4, hy - 5.6); g.rotate(-1 + wv * 0.2);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(2.4, -2, 8, -1.4); g.quadraticCurveTo(3, 0.6, 0, 0.6); g.closePath(); g.fillStyle = vfill(g, feather, -2, 1, 0.35, -0.2); g.fill(); outline(g, 0.35);
    g.strokeStyle = '#f2ece0'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(0.4, 0.2); g.quadraticCurveTo(3, -0.8, 7.4, -1.3); g.stroke(); g.restore();
    g.beginPath(); g.moveTo(-r + 1, hy - 3.6); g.bezierCurveTo(-r + 0.4, hy - 11.6, r - 0.4, hy - 11.6, r - 1, hy - 3.6); g.quadraticCurveTo(0, hy - 2.6, -r + 1, hy - 3.6); g.closePath();
    g.fillStyle = vfill(g, c, hy - 11, hy - 3, 0.3, -0.25); g.fill(); outline(g, 0.6);
    g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.5; g.beginPath(); g.moveTo(-1.6, hy - 10.4); g.quadraticCurveTo(0, hy - 8.6, 1.6, hy - 10.4); g.stroke();
    g.fillStyle = band; g.beginPath(); g.moveTo(-r + 1, hy - 5.2); g.quadraticCurveTo(0, hy - 4.4, r - 1, hy - 5.2); g.lineTo(r - 0.9, hy - 3.7); g.quadraticCurveTo(0, hy - 2.8, -r + 0.9, hy - 3.7); g.closePath(); g.fill(); outline(g, 0.3);
  }
  // Fennick's bedroll, rolled across behind his shoulders (facing us)
  function td_bedroll(g, C, y) {
    const w = C.B.w + 2.4;
    rr(g, -w, y - 2.4, w * 2, 4.8, 2.4); g.fillStyle = vfill(g, '#8a3a2a', y - 2.4, y + 2.4, 0.3, -0.3); g.fill(); outline(g, 0.6);
    g.strokeStyle = '#d9b86a'; g.lineWidth = 0.5; for (const x of [-w + 2, w - 2]) { g.beginPath(); g.moveTo(x, y - 2.2); g.lineTo(x, y + 2.2); g.stroke(); }
    for (const s of [-1, 1]) { ell(g, s * (w - 0.4), y, 1.2, 2.2); g.fillStyle = '#6a2a1e'; g.fill(); outline(g, 0.35); g.strokeStyle = '#d9b86a'; g.lineWidth = 0.3; g.beginPath(); g.ellipse(s * (w - 0.4), y, 0.6, 1.3, 0, 0, Math.PI * 2); g.stroke(); }
  }
  // Fennick's pack: a big canvas pack with a flap and buckles, the bedroll on top, a tin pot hanging off one side
  function td_pack(g, C, x0) {
    const B = C.B, y0 = B.sh - 1 + (C.back ? C.bob : 0), sw = C.step * 0.4 + Math.sin(time * 2 + C.seed) * 0.2;
    g.save(); g.translate(x0, y0);
    // the pot
    g.save(); g.translate(6.6, 7.4); g.rotate(sw * 0.15); g.strokeStyle = '#3a3f4a'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(0, -2.4); g.lineTo(0, -0.8); g.stroke(); rr(g, -1.8, -0.8, 3.6, 3, 0.6); g.fillStyle = metal(g, '#6a6f7a', -0.8, 2.2); g.fill(); outline(g, 0.35); g.restore();
    rr(g, -6, 0, 12, 12.4, 2.2); g.fillStyle = vfill(g, '#a08a5a', 0, 12.4, 0.25, -0.3); g.fill(); outline(g, 0.7);
    g.beginPath(); g.moveTo(-6, 1.4); g.quadraticCurveTo(0, -0.6, 6, 1.4); g.lineTo(5.4, 6); g.quadraticCurveTo(0, 7.4, -5.4, 6); g.closePath(); g.fillStyle = vfill(g, '#7a5a30', 0, 7, 0.25, -0.25); g.fill(); outline(g, 0.5);
    for (const x of [-2.6, 2.6]) { g.strokeStyle = '#4a3020'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x, 5.6); g.lineTo(x, 9); g.stroke(); rr(g, x - 0.8, 6.8, 1.6, 1.2, 0.3); g.fillStyle = '#c9a040'; g.fill(); outline(g, 0.25); }
    rr(g, -3.4, 8.8, 6.8, 2.6, 0.8); g.fillStyle = shade('#a08a5a', -0.12); g.fill(); outline(g, 0.35);
    g.restore();
    td_bedroll(g, { B: { w: 4.6 } }, y0 - 1.2);
    if (x0) { g.save(); g.translate(x0, 0); g.restore(); }
  }
  // Bram's bundle of kindling, tied with twine, sticks out over his shoulder (facing us) or on his back (facing away)
  function td_kindling(g, C, y, back) {
    g.save(); g.translate(back ? 1.4 : -4.4, y); g.rotate(back ? 0.4 : -0.45);
    for (const [x, len, c] of [[-1.8, 15, '#8a6a3a'], [-0.6, 17, '#7a5a30'], [0.6, 15.6, '#9a7a4a'], [1.8, 16.4, '#7a5a30'], [0, 14, '#8a6a3a']]) { rr(g, x - 0.55, -len / 2, 1.1, len, 0.5); g.fillStyle = vfill(g, c, -len / 2, len / 2, 0.25, -0.25); g.fill(); outline(g, 0.3); }
    for (const yy of [-3, 3]) { g.strokeStyle = '#c9a66b'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-2.6, yy); g.lineTo(2.6, yy); g.stroke(); }
    td_leaf(g, -1.8, -7.2, 1.8, -2.2, '#6a9a3a');
    g.restore();
  }
  // Moll's crown of flowers, across the brow facing us and round the back of the head facing away
  function td_wreath(g, C) {
    const hy = C.B.hy, r = C.B.hr, ex = C.fx * 1.8, back = C.back;
    const pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8, a = Math.PI * (1.08 + t * 0.84); pts.push([Math.cos(a) * (r + 0.2) + (back ? 0 : ex * 0.3), hy - 1.6 + Math.sin(a) * (r - 1.8) * (back ? -0.2 : 1) + (back ? 0 : 0)]); }
    if (back) for (const p of pts) p[1] = hy - 2 + Math.abs(p[0]) * -0.15 + 1.4;
    g.strokeStyle = '#3f7a3a'; g.lineWidth = 0.7; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    pts.forEach(([x, y], i) => { td_leaf(g, x, y, 1.5, i % 2 ? -0.6 : Math.PI + 0.6, '#5a9a3a'); });
    const cs = ['#e04a6a', '#ffffff', '#9a6ad0', '#f5d76a', '#e87a3a'];
    pts.forEach(([x, y], i) => { if (i % 2 === 0) td_flower(g, x, y, cs[(i / 2) % cs.length], 0.75); });
  }

  // ---------- a follower's attack, in the knight's style: the one new piece of drawing in this file ----------
  // Sera shoots and Garrick swings (21-companion sets attackT to 0.22 and counts it down). The main hand rises from the
  // waist round the shoulder and what it holds turns with it, leaving a swoosh (as 78-monsterart's people and the knight
  // do); a spear or a staff jabs instead; a bow comes up level with where they face, the string draws back and lets the
  // arrow go. mainHand calls this, so facing away all of it is behind the body.
  function npc_swoosh(g, cx, cy, ang, sw, rad) {
    if (sw < 0 || sw > 0.9) return;
    const a0 = ang - 1.4, a1 = ang + lerp(-1.4, 1.2, ease(sw));
    g.save(); g.strokeStyle = `rgba(255,255,255,${0.42 * (1 - sw)})`; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, rad, a0, a1); g.stroke(); g.restore();
  }
  function npc_swing(g, C) {
    const P = C.P, B = C.B, o = P.held, sw = Math.max(0, Math.min(1, 1 - C.e.attackT / 0.22));
    const ang = Math.atan2(C.fy, C.fx || 0.0001), sx = B.w - 1.4, sy = B.sh + 2.2 + C.bob, hc = handCol(C);
    if (/bow/.test(o.kind)) {
      // the bow held out toward where they face, its belly forward; the string comes back to 6.5 px, then snaps home
      const hx = sx + Math.cos(ang) * 5.4, hy = sy + Math.sin(ang) * 5.4, len = o.len || 11, c = o.c || '#8a5a2b';
      const pull = sw < 0.62 ? ease(sw / 0.62) : 0, nx = 1.2 - pull * 6.5;
      g.save(); g.translate(hx, hy); g.rotate(ang); g.translate(-4, 0);
      const limb = () => { g.beginPath(); g.moveTo(0.2, -len - 1.4); g.quadraticCurveTo(-0.4, -len - 0.2, 1.2, -len); g.quadraticCurveTo(6.2, -len * 0.7, 4.4, -len * 0.25); g.quadraticCurveTo(3.4, 0, 4.4, len * 0.25); g.quadraticCurveTo(6.2, len * 0.7, 1.2, len); g.quadraticCurveTo(-0.4, len + 0.2, 0.2, len + 1.4); };
      g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 2.9; limb(); g.stroke(); g.strokeStyle = c; g.lineWidth = 1.9; limb(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(2.6, -len * 0.74); g.quadraticCurveTo(5, -len * 0.5, 4.3, -len * 0.3); g.stroke();
      rr(g, 2.8, -1.8, 2.4, 3.6, 0.8); g.fillStyle = o.grip || '#3f6a3a'; g.fill(); outline(g, 0.3);
      g.strokeStyle = '#eef2f6'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(1.2, -len); g.lineTo(nx, 0); g.lineTo(1.2, len); g.stroke();
      if (pull > 0.05) {
        // the arrow on the string: a shaft past the grip, a steel head, two red fletchings at the nock
        g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.moveTo(nx, 0); g.lineTo(nx + 15, 0); g.stroke();
        g.strokeStyle = '#8a6a3a'; g.lineWidth = 0.8; g.stroke();
        g.beginPath(); g.moveTo(nx + 15, -1.3); g.lineTo(nx + 18, 0); g.lineTo(nx + 15, 1.3); g.closePath(); g.fillStyle = metal(g, '#c9ccd3', -1.3, 1.3); g.fill(); outline(g, 0.3);
        g.fillStyle = '#c0392b'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(nx + 0.4, 0); g.lineTo(nx + 3, s * 1.5); g.lineTo(nx + 3.6, 0); g.closePath(); g.fill(); }
      }
      g.restore();
      floatHand(g, hx, hy, hc);
      return;
    }
    // a spear or a staff jabs: level with where they face, out and back; anything else swings round the shoulder
    const jab = /spear|staff/.test(o.kind);
    let a, hx, hy;
    if (jab) { const push = Math.sin(Math.min(1, sw * 1.25) * Math.PI), r = 2.5 + push * 8; a = ang + lerp(-0.22, 0.04, ease(sw)); hx = sx + Math.cos(a) * r; hy = sy + Math.sin(a) * r; }
    else { a = ang + lerp(-1.4, 1.2, ease(sw)); hx = sx + Math.cos(a) * 4.6; hy = sy + Math.sin(a) * 4.6; }
    // a held thing is drawn upright (up the screen) from the hand: turned by a quarter more, it points along a
    g.save(); g.translate(hx, hy); g.rotate(a + Math.PI / 2); npc_prop(g, C, o, 'main'); g.restore();
    floatHand(g, hx, hy, hc);
    if (PROP_OVER[o.kind]) { g.save(); g.translate(hx, hy); g.rotate(a + Math.PI / 2); PROP_OVER[o.kind](g, C, o); g.restore(); }
    if (!jab) npc_swoosh(g, sx, sy, ang, sw, 24);
  }

  // every person's name as the sample's people list has it (today.json), for the talking pose; the game's own name for
  // a person wins where the call site hands it in
  const NPC_NAMES = {"sera": "Sera", "garrick": "Garrick", "marta": "Marta", "aldous": "Aldous the banker", "rosalind": "Rosalind", "brakka": "Brakka the smith", "pim": "Pim the tinker", "dorran": "Dorran the innkeeper", "duke": "Duke Ferrin", "hale": "Sergeant Hale", "tobin": "Tobin", "greta": "Greta", "fennick": "Fennick the trader", "wren": "Old Wren", "v1": "Ada", "v2": "Bram", "v3": "Cass", "v4": "Dunn", "v5": "Elsie", "v6": "Finn", "osric": "Gatewarden Osric", "ambrose": "Ambrose the bell-ringer", "hettie": "Hettie the apple seller", "mabel": "Mabel the candle maker", "moll": "Moll the flower seller", "wynn": "Wynn", "tess": "Tess", "robin": "Robin", "death2": "Death", "tam": "Old Tam", "nell": "Nell", "pip": "Pip", "hob": "Hob", "wenna": "Wenna", "harl": "Harl the ferryman", "pete": "Pete", "thrain": "King Thrain", "brunhild": "Brunhild the smith", "dagny": "Dagny", "orik": "Orik", "hilde": "Hilde", "aelith": "Queen Aelith", "lira": "Lira the archery master", "thessaly": "Thessaly the weaver", "faelan": "Faelan", "seraphel": "Queen Seraphel", "halcyon": "Master Halcyon", "pell": "Keeper Pell", "quill": "Quill Windward", "skyla": "Skyla Fleetwing", "ferris": "Old Ferris", "aldric": "Captain Aldric", "tamsin": "Tamsin the baker", "mossbeard": "Mossbeard", "aubade": "Sister Aubade", "corvin": "Guildmaster Corvin", "merriweather": "Merriweather", "orla": "Warden Orla", "brisk": "Warden Brisk", "lark": "Lark", "bellweather": "Bellweather the lamplighter", "brannoc": "Brannoc the porter", "fen": "Fen", "tilly": "Tilly", "wick": "Wick the messenger", "pippa": "Pippa the fruit seller", "maudie": "Maudie the weaver", "plume": "Old Plume the feather seller", "crockett": "Crockett the potter", "hazel": "Hazel", "wim": "Wim", "tinkerton": "Tinkerton", "grubb": "Grubb the cook", "nix": "Nix the scrapper", "snaggle": "Old Snaggle", "pipsqueak": "Pip-squeak", "gnash": "King Gnash", "mudge": "Mudge", "skritch": "Skritch", "ratchet": "Ratchet", "wilf": "Wilf the stonemason", "tamsin_miller": "Tamsin the miller", "odo": "Odo the farmer", "nan_gully": "Nan Gully", "mother_hobb": "Mother Hobb", "jory": "Jory the pedlar", "marigold": "Marigold the drover", "ansel": "Ansel the beacon keeper", "hilde_trapper": "Hilde the trapper", "corvin_hunter": "Corvin the hunter"};
  const H = { lerp, ease, OUT, shade, hex, rr, ell, outline, vfill, rfill, metal, shadow, face4 };
  return { NEW_NPC, NPC_FAMILY, NPC_SPEC, NPC_NAMES, npc, drawPerson, npcFromToday, BUILDS, SKIN, HAIR, H, mark: f => { NPC_MARK = f || null; } };
})();
