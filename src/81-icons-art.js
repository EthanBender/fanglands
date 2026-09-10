// ============================================================================
// ITEM ART — the 167 icons the framework left undrawn
// src/81-icons-art.js. Feature file: registers through ICONS.set, edits no core file.
//
// src/80-icons.js built the registry, the rarity halo and the audit. It drew 26 icons — the fifteen capes and
// the eleven items that drew as something they are not — and left 167 items still falling through to the shape
// switch in src/08-draw.js, where a shrimp and a shark are the same picture and eleven helms are one helm.
//
// This file draws those 167. The rule it works to is the owner's: the icon has to say what the thing IS at
// 13 px, not merely differ from the item beside it. So:
//
//   * SILHOUETTE FIRST, COLOUR SECOND. Every tier of a thing is a different object, not a recolour. The eleven
//     helms are a battered pot, a nasal cap, a kettle hat, a great helm, a barbute, a winged helm, a scale
//     hood, a crown, a dragon face, a glass crown, a sallet, a sunburst and a bolt crest. A child on a bright
//     screen can tell those apart with the colour turned off.
//   * TIERS READ AS A PROGRESSION. Bronze is small and plain, steel is bigger and banded, mithril is fine and
//     swept, sunstone glows, stormstone throws sparks — but each is still its own object.
//   * SEVEN ANIMALS, NOT FOURTEEN FISH. Shrimp, trout, pike, salmon, swordfish, shark and lobster are drawn
//     from their own anatomy. Cooked is the same animal served: on a plate, grill-marked, steaming.
//
// HOUSE RULES THE AUDIT ENFORCES (src/80-icons.js): draw inside -9..+9, never past ±11; nothing under 2 units
// across (arc radius >= 1, rect short side >= 2, lineWidth >= 1); never branch on `size`, or the icon drifts
// between the 13 px hotbar and the 35 px panel and the suite fails.
// ============================================================================
{
  const set = ICONS.set;
  const OUT = 'rgba(0,0,0,0.45)';         // the house outline every core icon starts from
  const dk = a => 'rgba(0,0,0,' + a + ')';
  const lt = a => 'rgba(255,255,255,' + a + ')';
  const WOOD = '#8a6a3a', WOOD_D = '#6b4a2a', GRIP = '#4a2e13', CORD = '#c9a36a';
  const IRON_D = '#3a3a42', STEEL_L = '#e9eef5';

  // reset the outline after an icon has changed it, so a helper never inherits the last one's ink
  const line = (g, col, w, cap) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = cap || 'butt'; };

  // ==========================================================================
  // FISH — seven animals. Raw is the animal as it comes out of the water; cooked is the same animal on a
  // plate, grill-marked and steaming. The plate and the steam are the "cooked" word; the body is the noun.
  // ==========================================================================
  const plate = g => {                       // a shallow dish under the food
    g.fillStyle = '#cfd6df'; g.beginPath(); g.ellipse(0, 7.2, 8.8, 2, 0, 0, 7); g.fill();
    line(g, dk(0.35), 1); g.stroke();
    g.fillStyle = lt(0.5); g.beginPath(); g.ellipse(-3, 6.6, 3.2, 1, 0, 0, 7); g.fill();
  };
  const steam = (g, x) => {                  // one curl of steam, rising and leaning
    line(g, 'rgba(226,236,248,0.8)', 1.2, 'round');
    g.beginPath(); g.moveTo(x, -5); g.quadraticCurveTo(x - 2, -6.6, x, -8.2); g.quadraticCurveTo(x + 1.8, -9.4, x + 0.8, -9.4); g.stroke();
  };
  const grill = (g, x0, x1, y, n) => {       // bars off the pan, burnt across the flank
    line(g, dk(0.42), 1.3, 'round');
    for (let k = 0; k < n; k++) { const x = x0 + (x1 - x0) * k / (n - 1); g.beginPath(); g.moveTo(x - 1.2, y - 2.2); g.lineTo(x + 1.2, y + 2.2); g.stroke(); }
  };
  const wetEye = (g, x, y) => { g.fillStyle = '#1a1a1f'; g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill(); g.fillStyle = lt(0.8); g.beginPath(); g.arc(x - 0.4, y - 0.4, 1, 0, 7); g.fill(); };
  const cookedEye = (g, x, y) => { line(g, dk(0.6), 1.2, 'round'); g.beginPath(); g.moveTo(x - 1.4, y); g.lineTo(x + 1.4, y); g.stroke(); };

  // --- shrimp: a comma of a body, segmented, fan tail, whiskers out front
  const shrimpBody = (g, col, dy) => {
    g.save(); g.translate(0, dy);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(6.4, -3.6); g.quadraticCurveTo(-2.6, -5.6, -6.4, -0.6);
    g.quadraticCurveTo(-8.4, 3.6, -3.6, 4.6); g.quadraticCurveTo(0.6, 5.2, 2.6, 2.6);
    g.quadraticCurveTo(0.6, 3.4, -1.4, 1.6); g.quadraticCurveTo(0.4, -1.4, 6.4, -3.6); g.closePath();
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, dk(0.3), 1.1);                       // the shell segments
    for (const [ax, ay, a0, a1] of [[-3.6, -1.6, 0.5, 2.4], [-5.2, 0.8, 0.2, 2.2]]) { g.beginPath(); g.arc(ax, ay, 3, a0, a1); g.stroke(); }
    g.fillStyle = col;                           // the tail fan
    g.beginPath(); g.moveTo(6.4, -3.6); g.lineTo(9, -6.4); g.lineTo(9.4, -1.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.stroke();
    g.restore();
  };
  set('raw_shrimp', (g, size, item) => {
    shrimpBody(g, item.color, 0.6);
    line(g, dk(0.5), 1, 'round');                // two whiskers, still on it
    g.beginPath(); g.moveTo(-6.4, -1); g.quadraticCurveTo(-8.6, -5, -5.4, -7.6); g.moveTo(-6, 0.6); g.quadraticCurveTo(-9.4, -1.6, -8.6, -5.4); g.stroke();
    wetEye(g, -5, 0.6);
  });
  set('shrimp', (g, size, item) => {
    plate(g); steam(g, -1.6);
    shrimpBody(g, item.color, -0.8);
    grill(g, -3.6, 1.4, -0.6, 2);
    cookedEye(g, -4.6, -0.8);
  });

  // --- trout: fusiform, forked tail, spotted flank, the little adipose fin
  const troutBody = (g, col, dy) => {
    g.save(); g.translate(0, dy);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(-3.6, -4.4, 2.4, -3.4); g.quadraticCurveTo(6, -2.8, 7, 0);
    g.quadraticCurveTo(6, 2.8, 2.4, 3.4); g.quadraticCurveTo(-3.6, 4.4, -8, 0); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(6.4, -1.6); g.lineTo(9.4, -4.4); g.lineTo(9.4, 4.4); g.lineTo(6.4, 1.6); g.closePath(); g.fill(); g.stroke();  // forked tail
    g.beginPath(); g.moveTo(-2.6, -3.6); g.lineTo(0.6, -6.4); g.lineTo(1.6, -3.2); g.closePath(); g.fill();                                  // dorsal
    g.beginPath(); g.moveTo(4.4, -2.6); g.lineTo(6, -4.4); g.lineTo(6, -2.2); g.closePath(); g.fill();                                        // adipose
    g.beginPath(); g.moveTo(-3.4, 3); g.lineTo(-2.4, 5.6); g.lineTo(0.4, 3.4); g.closePath(); g.fill();                                       // pelvic
    g.restore();
  };
  set('raw_trout', (g, size, item) => {
    troutBody(g, item.color, 0.4);
    g.fillStyle = '#7a3a3a'; for (const [x, y] of [[-2, -1], [1.4, 0.6], [-4.4, 1], [2.6, -1.4]]) { g.beginPath(); g.arc(x, y + 0.4, 1, 0, 7); g.fill(); }
    wetEye(g, -6, 0.4);
  });
  set('trout', (g, size, item) => {
    plate(g); steam(g, -2.4);
    troutBody(g, item.color, -1.2);
    grill(g, -4, 3, -1.2, 3);
    cookedEye(g, -6, -1.2);
  });

  // --- pike: a long torpedo with a duck-bill snout and fins set right at the back
  const pikeBody = (g, col, dy) => {
    g.save(); g.translate(0, dy);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-9, 1.6); g.lineTo(-5.6, -1.4); g.quadraticCurveTo(0, -3.4, 5.6, -2.4);
    g.quadraticCurveTo(6.6, 0, 5.6, 2.4); g.quadraticCurveTo(0, 3.6, -5.6, 2); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(5.2, -1.6); g.lineTo(9.4, -4); g.lineTo(8.4, 0); g.lineTo(9.4, 4); g.lineTo(5.2, 1.6); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(1.4, -2.8); g.lineTo(4.4, -6); g.lineTo(4.8, -2.4); g.closePath(); g.fill();      // dorsal, far back
    g.beginPath(); g.moveTo(1.4, 2.8); g.lineTo(4.4, 6); g.lineTo(4.8, 2.4); g.closePath(); g.fill();         // anal, mirrored
    line(g, dk(0.32), 1.1);                                                                                   // the bars along the flank
    for (const x of [-3, -0.6, 1.8]) { g.beginPath(); g.moveTo(x, -2.2); g.lineTo(x - 0.8, 2.2); g.stroke(); }
    g.restore();
  };
  set('raw_pike', (g, size, item) => {
    pikeBody(g, item.color, 0.4);
    line(g, dk(0.55), 1.2, 'round'); g.beginPath(); g.moveTo(-8.8, 2); g.lineTo(-5.2, 1.2); g.stroke();   // the jaw line of the bill
    wetEye(g, -5.4, -0.4);
  });
  set('pike', (g, size, item) => {
    plate(g); steam(g, -3);
    pikeBody(g, item.color, -1.2);
    grill(g, -3.6, 2.4, -1.2, 3);
    cookedEye(g, -5.4, -1.6);
  });

  // --- salmon: deep body, hooked jaw, heavy shoulder, spotted back
  const salmonBody = (g, col, dy) => {
    g.save(); g.translate(0, dy);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-8.4, -0.6); g.quadraticCurveTo(-6.4, -4.6, -1.4, -5); g.quadraticCurveTo(4.4, -4.6, 6.4, -0.8);
    g.quadraticCurveTo(4.4, 3.8, -1.4, 4.4); g.quadraticCurveTo(-6.4, 3.8, -8.4, -0.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(5.8, -2); g.lineTo(9.4, -5); g.lineTo(8.2, -0.6); g.lineTo(9.4, 3.6); g.lineTo(5.8, 1.4); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-2.4, -5); g.lineTo(0.4, -8.4); g.lineTo(2.4, -4.4); g.closePath(); g.fill();     // tall dorsal
    g.beginPath(); g.moveTo(-1.4, 4.2); g.lineTo(0.4, 6.8); g.lineTo(3, 3.4); g.closePath(); g.fill();
    g.fillStyle = lt(0.28); g.beginPath(); g.moveTo(-7, 0.6); g.quadraticCurveTo(-1, 2.6, 5.4, 0.4); g.quadraticCurveTo(-1, 1, -7, 0.6); g.closePath(); g.fill();  // the pale belly stripe
    g.restore();
  };
  set('raw_salmon', (g, size, item) => {
    salmonBody(g, item.color, 0.8);
    g.fillStyle = dk(0.35); for (const [x, y] of [[-3.4, -2.4], [0.4, -3], [3.4, -1.6]]) { g.beginPath(); g.arc(x, y + 0.8, 1, 0, 7); g.fill(); }
    line(g, dk(0.55), 1.3, 'round');                                     // the hooked jaw
    g.beginPath(); g.moveTo(-8.4, 1); g.quadraticCurveTo(-6, 2.6, -4, 1.4); g.stroke();
    wetEye(g, -5.8, -0.8);
  });
  set('salmon', (g, size, item) => {
    plate(g); steam(g, -2);
    salmonBody(g, item.color, -1.4);
    grill(g, -4.4, 3, -1.4, 3);
    cookedEye(g, -5.8, -3);
  });

  // --- swordfish: the bill is the whole animal. Crescent tail, sail of a dorsal
  const swordBody = (g, col, dy) => {
    g.save(); g.translate(0, dy);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-9.4, -0.2); g.lineTo(-3.4, -1.6); g.quadraticCurveTo(1.4, -3.4, 4.6, -1.4);
    g.quadraticCurveTo(5.6, 0.4, 4.6, 2.2); g.quadraticCurveTo(1.4, 4, -3.4, 1.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(4.2, -1); g.quadraticCurveTo(8.6, -3, 9.4, -6); g.quadraticCurveTo(7.6, -1, 9.4, 5);
    g.quadraticCurveTo(8, 1.6, 4.2, 2); g.closePath(); g.fill(); g.stroke();                                    // crescent tail
    g.beginPath(); g.moveTo(-1.6, -2.6); g.quadraticCurveTo(0.4, -8.6, 3.4, -1.8); g.closePath(); g.fill();      // the sail
    g.restore();
  };
  set('raw_swordfish', (g, size, item) => {
    swordBody(g, item.color, 1);
    line(g, '#dfe7f0', 1.4, 'round'); g.beginPath(); g.moveTo(-9.4, 0.4); g.lineTo(-4.6, 0.2); g.stroke();  // the bright edge of the bill
    wetEye(g, -3.2, 0.4);
  });
  set('swordfish', (g, size, item) => {
    plate(g); steam(g, 0.4);
    swordBody(g, item.color, -1.4);
    grill(g, -1.6, 2.4, -1.4, 2);
    cookedEye(g, -3.2, -2);
  });

  // --- shark: pointed snout, the big triangular dorsal, gill slits, a mouth full of nothing good
  const sharkBody = (g, col, dy) => {
    g.save(); g.translate(0, dy);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-9, 1.4); g.quadraticCurveTo(-5.4, -2.6, 0.4, -2.8); g.quadraticCurveTo(4.4, -2.6, 5.6, -0.6);
    g.quadraticCurveTo(4.4, 2.4, -1.6, 3.4); g.quadraticCurveTo(-6, 3.4, -9, 1.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(5.2, -1.4); g.lineTo(9.4, -6.4); g.lineTo(8.6, 0.6); g.lineTo(9.4, 3.4); g.lineTo(5.2, 1.4); g.closePath(); g.fill(); g.stroke();  // top-heavy tail
    g.beginPath(); g.moveTo(-2.4, -2.8); g.lineTo(0.6, -8.4); g.lineTo(2.6, -2.4); g.closePath(); g.fill(); g.stroke();   // the fin everyone knows
    g.beginPath(); g.moveTo(-3.4, 3); g.lineTo(-5.4, 6.4); g.lineTo(-0.4, 3.4); g.closePath(); g.fill();                  // pectoral
    line(g, dk(0.34), 1.1);
    for (const x of [-4.4, -3.2, -2]) { g.beginPath(); g.moveTo(x, -1); g.lineTo(x - 0.6, 1.6); g.stroke(); }             // gill slits
    g.restore();
  };
  set('raw_shark', (g, size, item) => {
    sharkBody(g, item.color, 0.4);
    line(g, '#f2f2ec', 1.2, 'round'); g.beginPath(); g.moveTo(-8.6, 2); g.quadraticCurveTo(-6.4, 3.2, -4.4, 2.4); g.stroke();  // the grin
    wetEye(g, -6, 0.4);
  });
  set('shark', (g, size, item) => {
    plate(g); steam(g, 1.6);
    sharkBody(g, item.color, -1.6);
    grill(g, -3.4, 1.6, -1.4, 3);
    cookedEye(g, -6, -1.6);
  });

  // --- lobster: two claws out front, a segmented tail curled under, long antennae
  const lobsterBody = (g, col, dy) => {
    g.save(); g.translate(0, dy);
    g.fillStyle = col;
    g.beginPath(); g.ellipse(-1.4, -1.4, 3.4, 4, 0, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();     // carapace
    for (let k = 0; k < 3; k++) {                                                                                            // the tail, narrowing
      g.beginPath(); g.ellipse(-1.4 + k * 0.5, 3 + k * 1.9, 3.1 - k * 0.5, 1.4, 0, 0, 7); g.fill(); g.stroke();
    }
    g.beginPath(); g.moveTo(-0.4, 7.4); g.lineTo(3.4, 8.6); g.lineTo(0.4, 5.6); g.closePath(); g.fill(); g.stroke();          // tail fan
    for (const [cx, cy, r] of [[-6.4, -4.4, 2.4], [4.4, -4.6, 2]]) {                                                         // the claws
      g.beginPath(); g.ellipse(cx, cy, r, r * 0.78, cx < 0 ? -0.6 : 0.6, 0, 7); g.fill(); g.stroke();
      line(g, dk(0.5), 1.1); g.beginPath(); g.moveTo(cx - r * 0.9, cy - r * 0.3); g.lineTo(cx + r * 0.6, cy + r * 0.5); g.stroke();
      g.fillStyle = col; line(g, OUT, 1.2);
      g.beginPath(); g.moveTo(cx + (cx < 0 ? 1.4 : -1.4), cy + 1.4); g.lineTo(-1.4, -3); g.lineTo(cx + (cx < 0 ? 2.4 : -2.4), cy + 2.6); g.closePath(); g.fill();
    }
    g.restore();
  };
  set('raw_lobster', (g, size, item) => {
    lobsterBody(g, item.color, -0.6);
    line(g, dk(0.5), 1, 'round');
    g.beginPath(); g.moveTo(-2.6, -5.4); g.quadraticCurveTo(-5.4, -8.4, -3, -9.4); g.moveTo(-0.2, -5.4); g.quadraticCurveTo(2.6, -8.4, 0.4, -9.4); g.stroke();  // antennae
    g.fillStyle = '#1a1a1f'; g.beginPath(); g.arc(-2.6, -4, 1, 0, 7); g.arc(-0.2, -4, 1, 0, 7); g.fill();
  });
  set('lobster', (g, size, item) => {
    plate(g); steam(g, -4.4); steam(g, 3.6);
    lobsterBody(g, item.color, -1.8);
    line(g, dk(0.4), 1.3, 'round');
    g.beginPath(); g.moveTo(-3.4, -1.4); g.lineTo(0.6, -1.4); g.moveTo(-3.4, 1); g.lineTo(0.6, 1); g.stroke();   // split down the back, the way a cooked one is served
  });

  // ==========================================================================
  // HELMS — thirteen helmets that were one helmet. Each is a different piece of headgear, so the outline alone
  // names it: a battered pot, a nasal cap, a kettle hat, a great helm, a barbute, wings, a hood of scales,
  // a crown, a dragon's face, a crown of glass shards, a sallet, a sunburst and a bolt.
  // ==========================================================================

  // --- ruined helm: dented, holed, the rim split. Whatever was in it is long gone
  set('ruined_helm', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-7.6, 4.6); g.quadraticCurveTo(-8, -4.4, -1.4, -6.6); g.quadraticCurveTo(5.2, -7.4, 7.2, -0.6);
    g.lineTo(7.6, 4.6); g.lineTo(3.4, 3.4); g.lineTo(0.4, 5); g.lineTo(-3.4, 3.2); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#241f1a'; g.beginPath(); g.ellipse(2.4, -1.4, 2.4, 1.8, 0.3, 0, 7); g.fill();      // a hole punched clean through
    line(g, dk(0.45), 1.3, 'round');                                                                    // the dent, and the split running down
    g.beginPath(); g.moveTo(-5.4, -3.4); g.quadraticCurveTo(-3.4, -1.4, -5, 0.6); g.stroke();
    g.beginPath(); g.moveTo(-1.6, 4); g.lineTo(-0.6, 1); g.lineTo(-2.4, -1.4); g.stroke();
    g.fillStyle = '#7a6a52'; g.fillRect(-8, 4.4, 16, 2.2);                                              // the buckled rim
    line(g, dk(0.4), 1); g.strokeRect(-8, 4.4, 16, 2.2);
  });

  // --- bronze: the first helm anyone owns. A round cap, a nasal bar, a band of rivets
  set('bronze_helm', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.arc(0, 2.4, 7.4, Math.PI, 0); g.lineTo(7.4, 4.6); g.lineTo(-7.4, 4.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = dk(0.28); g.fillRect(-7.4, 2.4, 14.8, 2.2);                                            // the browband
    g.fillStyle = item.color; g.fillRect(-1.4, 2.4, 2.8, 6.4); line(g, OUT, 1.2); g.strokeRect(-1.4, 2.4, 2.8, 6.4);  // the nasal
    g.fillStyle = lt(0.35); for (const x of [-5, 5]) { g.beginPath(); g.arc(x, 3.5, 1, 0, 7); g.fill(); }
    g.fillStyle = lt(0.3); g.beginPath(); g.arc(-2.6, -1.6, 2, 0, 7); g.fill();                          // the shine off the crown
  });

  // --- iron: a kettle hat. All brim, and that brim is the silhouette
  set('iron_helm', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.arc(0, 1.4, 5.6, Math.PI, 0); g.lineTo(5.6, 1.4); g.lineTo(-5.6, 1.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(-9, 1.4); g.quadraticCurveTo(0, -0.6, 9, 1.4); g.quadraticCurveTo(0, 5.4, -9, 1.4); g.closePath(); g.fill(); g.stroke();   // the wide brim
    line(g, dk(0.32), 1.2);
    g.beginPath(); g.moveTo(0, -4.2); g.lineTo(0, 1.4); g.stroke();                                       // the ridge over the crown
    g.fillStyle = dk(0.35); g.beginPath(); g.ellipse(0, 2.8, 5.4, 1, 0, 0, 7); g.fill();
  });

  // --- steel: a great helm. A flat-topped bucket with one slit to see out of and a cross of breaths
  set('steel_helm', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, -7); g.lineTo(6.4, -7); g.lineTo(7, 2.4); g.quadraticCurveTo(0, 8.6, -7, 2.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#16161a'; g.fillRect(-6.2, -3.4, 12.4, 2.2);                                           // the sight slit
    g.fillStyle = dk(0.4); g.fillRect(-1.2, -1.2, 2.4, 6.4);                                              // the breath cross
    g.fillStyle = dk(0.4); for (const y of [1.6, 3.6]) g.fillRect(-4.2, y, 8.4, 1.2 + 0.8);
    g.fillStyle = lt(0.3); g.fillRect(-5.4, -6.2, 2.4, 2.4);
  });

  // --- mithril: a barbute. One shell drawn down the face, open in a Y
  set('mithril_helm', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.8, 6.4); g.quadraticCurveTo(-8, -5, 0, -7.4); g.quadraticCurveTo(8, -5, 6.8, 6.4);
    g.lineTo(3.4, 6.4); g.lineTo(3.4, 0.4); g.quadraticCurveTo(0, -2.4, -3.4, 0.4); g.lineTo(-3.4, 6.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, dk(0.3), 1.2);
    g.beginPath(); g.moveTo(0, -7.2); g.lineTo(0, -2.4); g.stroke();                                      // the comb
    g.fillStyle = lt(0.32); g.beginPath(); g.moveTo(-6, 4.4); g.quadraticCurveTo(-6.6, -4, -1.4, -6.2);
    g.quadraticCurveTo(-4.4, -3.4, -4, 4.4); g.closePath(); g.fill();
  });

  // --- godly: the winged helm. Wings out both sides, and they are most of the outline
  set('godly_helm', (g, size, item) => {
    g.fillStyle = item.color;
    for (const s of [-1, 1]) {                                                                            // three feathers a side, swept back and up
      g.beginPath(); g.moveTo(s * 3.4, -1.4);
      g.quadraticCurveTo(s * 8, -5.4, s * 9, -8); g.quadraticCurveTo(s * 8.4, -3.4, s * 9, -1.4);
      g.quadraticCurveTo(s * 7, 0.6, s * 3.4, 1.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
      line(g, dk(0.3), 1.1); g.beginPath(); g.moveTo(s * 4, -0.6); g.quadraticCurveTo(s * 7, -2.4, s * 8.4, -5.4); g.stroke();
    }
    g.fillStyle = item.color;
    g.beginPath(); g.arc(0, 1.4, 4.6, Math.PI, 0); g.lineTo(4.6, 5.4); g.lineTo(-4.6, 5.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#16161a'; g.fillRect(-3, 1.6, 6, 2);
    g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(0, -2.4, 1.4, 0, 7); g.fill();                          // the gem on the brow
  });

  // --- scale: a hood of dragon plates, not a metal shell. Overlapping courses and a drape at the neck
  set('scale_helm', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, 7.4); g.quadraticCurveTo(-8.4, -3.4, 0, -7.4); g.quadraticCurveTo(8.4, -3.4, 6.4, 7.4);
    g.quadraticCurveTo(0, 5.4, -6.4, 7.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, dk(0.36), 1.1);
    for (let row = 0; row < 3; row++) {                                                                   // courses of scales down the hood
      const y = -4 + row * 3.2, n = 3 + (row % 2), off = (row % 2) ? 0 : 1.7;
      for (let k = 0; k < n; k++) { g.beginPath(); g.arc(-5.1 + off + k * 3.4, y, 1.7, 0, Math.PI); g.stroke(); }
    }
    g.fillStyle = '#1c1a16'; g.beginPath(); g.ellipse(-2.6, 1.6, 1.4, 1, 0, 0, 7); g.ellipse(2.6, 1.6, 1.4, 1, 0, 0, 7); g.fill();   // the eye holes
  });

  // --- Gnash's crown: five spikes and three stones. Not a helmet at all
  set('gnash_crown', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8, 5.4); g.lineTo(-8, -1.4); g.lineTo(-5, -6.4); g.lineTo(-2.6, -1.4);
    g.lineTo(0, -8); g.lineTo(2.6, -1.4); g.lineTo(5, -6.4); g.lineTo(8, -1.4); g.lineTo(8, 5.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = dk(0.3); g.fillRect(-8, 1.6, 16, 2.2);                                                   // the band
    g.fillStyle = '#c0294a'; g.beginPath(); g.arc(0, 2.6, 1.6, 0, 7); g.fill();
    g.fillStyle = '#7ec8ff'; g.beginPath(); g.arc(-4.6, 2.6, 1.2, 0, 7); g.arc(4.6, 2.6, 1.2, 0, 7); g.fill();
    g.fillStyle = lt(0.4); g.beginPath(); g.moveTo(-5, -5.4); g.lineTo(-4, -1.6); g.lineTo(-5.8, -1.6); g.closePath(); g.fill();
  });

  // --- dragon: a face, not a bucket. Two horns swept back, a snout, and eyes lit from inside
  set('dragon_helm', (g, size, item) => {
    g.fillStyle = item.color;
    for (const s of [-1, 1]) {                                                                             // the horns
      g.beginPath(); g.moveTo(s * 4.4, -3.4); g.quadraticCurveTo(s * 9, -6.4, s * 8.6, -8.6);
      g.quadraticCurveTo(s * 8, -5, s * 4.4, -0.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    }
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-5.4, -3.4); g.quadraticCurveTo(0, -7.4, 5.4, -3.4); g.lineTo(4.4, 2.4);
    g.quadraticCurveTo(2.6, 3.4, 2.6, 6.4); g.lineTo(-2.6, 6.4); g.quadraticCurveTo(-2.6, 3.4, -4.4, 2.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#ffcf5a'; g.beginPath(); g.moveTo(-4.2, -0.6); g.lineTo(-1.2, 0.4); g.lineTo(-4.2, 1.6); g.closePath();
    g.moveTo(4.2, -0.6); g.lineTo(1.2, 0.4); g.lineTo(4.2, 1.6); g.closePath(); g.fill();                   // the lit eyes
    line(g, dk(0.45), 1.2, 'round');
    g.beginPath(); g.moveTo(-2, 4.4); g.lineTo(2, 4.4); g.stroke();                                         // the muzzle line
  });

  // --- obsidian: knapped glass. A crown of shards with nothing round about it
  set('obsidian_helm', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-7.4, 5.4); g.lineTo(-6.4, -2.4); g.lineTo(-4, -6.4); g.lineTo(-2.4, -2);
    g.lineTo(0, -8.4); g.lineTo(2.4, -2); g.lineTo(4.6, -7); g.lineTo(6.6, -2.4); g.lineTo(7.4, 5.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = lt(0.3);                                                                                  // the flat faces the glass broke along
    g.beginPath(); g.moveTo(-4, -6.4); g.lineTo(-2.4, -2); g.lineTo(-4.4, 4.4); g.lineTo(-5.4, -1.4); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(4.6, -7); g.lineTo(6.6, -2.4); g.lineTo(5.4, 3.4); g.lineTo(3.4, -1.6); g.closePath(); g.fill();
    g.fillStyle = '#c9a7ff'; g.beginPath(); g.moveTo(0, -8.4); g.lineTo(1.4, -3.4); g.lineTo(-1.4, -3.4); g.closePath(); g.fill();
    g.fillStyle = dk(0.4); g.fillRect(-7.2, 3.4, 14.4, 2.2);
  });

  // --- blackiron: a sallet. Rounded front, a long tail off the back, one narrow slit
  set('blackiron_helm', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-7.4, 1.4); g.quadraticCurveTo(-7, -6.4, 0.4, -6.6); g.quadraticCurveTo(6.4, -6.4, 7, -1.4);
    g.lineTo(9, 5.4); g.lineTo(4.4, 4); g.quadraticCurveTo(-2.6, 5.4, -7.4, 3.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#111114'; g.beginPath(); g.moveTo(-7, -1.6); g.lineTo(4.4, -1.4); g.lineTo(4.4, 0.6); g.lineTo(-7, -0.2); g.closePath(); g.fill();
    line(g, dk(0.4), 1.2);
    g.beginPath(); g.moveTo(-2.4, -6.6); g.quadraticCurveTo(-1.4, -2.4, -1, 4.6); g.stroke();               // the raised comb
    g.fillStyle = lt(0.28); g.beginPath(); g.moveTo(-6.4, -1.6); g.quadraticCurveTo(-6, -5.4, -0.6, -5.6); g.quadraticCurveTo(-4.4, -4, -4.4, -1.6); g.closePath(); g.fill();
  });

  // --- sunstone: a cap wearing the sun. Rays all round the crown
  set('sunstone_helm', (g, size, item) => {
    g.fillStyle = item.color;
    for (let k = 0; k < 7; k++) {                                                                            // the rays
      const a = Math.PI + (k + 0.5) / 7 * Math.PI, c = Math.cos(a), s2 = Math.sin(a);
      g.beginPath(); g.moveTo(c * 4.4 - s2 * 1.6, 2 + s2 * 4.4 + c * 1.6); g.lineTo(c * 8.8, 2 + s2 * 8.8);
      g.lineTo(c * 4.4 + s2 * 1.6, 2 + s2 * 4.4 - c * 1.6); g.closePath(); g.fill();
    }
    g.beginPath(); g.arc(0, 2, 5.4, Math.PI, 0); g.lineTo(5.4, 5.4); g.lineTo(-5.4, 5.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#fff0c0'; g.beginPath(); g.arc(0, -0.4, 2, 0, 7); g.fill();                               // the stone itself, sat on the brow
    g.fillStyle = dk(0.3); g.fillRect(-5.4, 3, 10.8, 2.2);
  });

  // --- stormstone: a bolt for a crest, and the sparks it has not finished throwing
  set('stormstone_helm', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(1.4, -9); g.lineTo(-3.4, -2.4); g.lineTo(-0.4, -2.4); g.lineTo(-2.4, 2.4);
    g.lineTo(4.4, -4.4); g.lineTo(1, -4.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();  // the crest
    g.beginPath(); g.arc(0, 2.6, 6.4, Math.PI, 0); g.lineTo(6.4, 6); g.lineTo(-6.4, 6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#16161a'; g.fillRect(-4.4, 2.6, 8.8, 2);
    line(g, '#e0d4ff', 1.2, 'round');                                                                        // sparks jumping the brim
    g.beginPath(); g.moveTo(-7.4, 0.4); g.lineTo(-8.8, -2.4); g.moveTo(7.4, 0.4); g.lineTo(8.8, -2.4); g.stroke();
    g.fillStyle = lt(0.3); g.beginPath(); g.arc(-3.6, -0.4, 1.4, 0, 7); g.fill();
  });

  // ==========================================================================
  // BODIES — thirteen chest pieces that were one chest piece. Torn mail, a breastplate, a hauberk, banded
  // plate, a silk cloak, a coat of plates, hover armour, a winged cuirass, a hood, dragon plate, a studded
  // brigandine, a sun tabard and a storm cuirass. Different garments, not different greys.
  // ==========================================================================

  // --- ruined chainmail: holed, hanging off its own shoulders, rings coming loose at the hem
  set('ruined_body', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-7.4, -5); g.lineTo(-3.4, -8); g.lineTo(3.4, -8); g.lineTo(7.4, -5);
    g.lineTo(6.4, 5.4); g.lineTo(3.4, 3.4); g.lineTo(0.4, 6.4); g.lineTo(-2.6, 3.6); g.lineTo(-6.4, 6.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#241f1a'; g.beginPath(); g.ellipse(2.4, -1.4, 2.6, 2, -0.3, 0, 7); g.fill();          // the hole a spear made
    line(g, dk(0.34), 1.1);                                                                                // what is left of the rings
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(-5 + k * 2.4, -4.4 + r * 2.6, 1.1, 0, 7); g.stroke(); }
    g.fillStyle = '#8a7a62'; g.beginPath(); g.arc(-3.4, 7.4, 1.1, 0, 7); g.arc(4.4, 6.4, 1.1, 0, 7); g.fill();
  });

  // --- bronze: a plain breastplate. Two rounded pauldrons, a belt, and a shine down the middle
  set('bronze_body', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-5.4, -6.4); g.quadraticCurveTo(0, -8.4, 5.4, -6.4); g.lineTo(5.4, 4.4);
    g.quadraticCurveTo(0, 7.4, -5.4, 4.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 6.8, -4.4, 2.4, 2, 0, 0, 7); g.fill(); g.stroke(); }   // pauldrons
    g.fillStyle = GRIP; g.fillRect(-5.4, 2.4, 10.8, 2.2);                                                          // belt
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(0, 3.5, 1.2, 0, 7); g.fill();                                    // buckle
    g.fillStyle = lt(0.3); g.beginPath(); g.moveTo(-2.4, -6); g.quadraticCurveTo(-3.4, -1, -2.4, 2); g.quadraticCurveTo(-0.4, -1, -0.4, -6.4); g.closePath(); g.fill();
  });

  // --- iron: a mail hauberk. Rings all over it, short sleeves, a slit hem
  set('iron_body', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8.6, -3.4); g.lineTo(-6.4, -6.6); g.lineTo(-2.4, -7.4); g.lineTo(2.4, -7.4);
    g.lineTo(6.4, -6.6); g.lineTo(8.6, -3.4); g.lineTo(6.4, -1.4); g.lineTo(6, 6.6); g.lineTo(-6, 6.6);
    g.lineTo(-6.4, -1.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, dk(0.33), 1);                                                                                   // the mail itself: rows of rings
    for (let r = 0; r < 4; r++) { const y = -4.4 + r * 2.7, off = (r % 2) ? 1.1 : 0;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(-4.4 + off + k * 2.2, y, 1.05, 0, 7); g.stroke(); } }
    g.fillStyle = dk(0.4); g.fillRect(-1, 3.4, 2, 3.2);                                                      // the riding slit
  });

  // --- steel: banded plate. Horizontal lames across the belly, a gorget at the throat
  set('steel_body', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, -6.4); g.lineTo(-2.4, -8); g.lineTo(2.4, -8); g.lineTo(6.4, -6.4);
    g.lineTo(6.4, 6.4); g.lineTo(-6.4, 6.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = dk(0.3); for (const y of [-0.6, 2, 4.6]) g.fillRect(-6.4, y, 12.8, 2.2);                    // the bands
    g.fillStyle = item.color; g.beginPath(); g.moveTo(-3.4, -8); g.quadraticCurveTo(0, -5.4, 3.4, -8);
    g.lineTo(3.4, -6); g.quadraticCurveTo(0, -3.4, -3.4, -6); g.closePath(); g.fill(); g.stroke();            // the gorget
    for (const s of [-1, 1]) { g.fillStyle = item.color; g.beginPath(); g.moveTo(s * 6.4, -6.4); g.lineTo(s * 9, -4.4); g.lineTo(s * 9, -0.4); g.lineTo(s * 6.4, -1.4); g.closePath(); g.fill(); g.stroke(); }
  });

  // --- silk cloak: cloth, not armour. It hangs, it has a clasp, and the hem swings
  set('silk_cloak', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-4.4, -7.4); g.quadraticCurveTo(0, -5.4, 4.4, -7.4); g.quadraticCurveTo(8.4, -1.4, 8.4, 6.4);
    g.quadraticCurveTo(4.4, 8.4, 0, 6.4); g.quadraticCurveTo(-4.4, 8.4, -8.4, 6.4); g.quadraticCurveTo(-8.4, -1.4, -4.4, -7.4); g.closePath();
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, dk(0.22), 1.2);                                                                                   // the folds falling out of the shoulders
    g.beginPath(); g.moveTo(-3.4, -5.4); g.quadraticCurveTo(-4.4, 0.6, -4.4, 6.4);
    g.moveTo(3.4, -5.4); g.quadraticCurveTo(4.4, 0.6, 4.4, 6.4); g.moveTo(0, -5.4); g.lineTo(0, 6.4); g.stroke();
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(0, -6.6, 1.6, 0, 7); g.fill(); line(g, dk(0.4), 1); g.stroke();  // the clasp
  });

  // --- mithril: a coat of plates. A high collar and two columns of rivets holding the plates inside
  set('mithril_body', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, -4.4); g.lineTo(-4.4, -7.4); g.lineTo(4.4, -7.4); g.lineTo(6.4, -4.4);
    g.lineTo(7.4, 7); g.lineTo(-7.4, 7); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = item.color; g.beginPath(); g.moveTo(-4.4, -7.4); g.lineTo(-3.4, -9); g.lineTo(3.4, -9); g.lineTo(4.4, -7.4); g.closePath(); g.fill(); g.stroke();  // the collar
    g.fillStyle = lt(0.4);                                                                                     // the rivets, two columns of them
    for (const x of [-4.4, 4.4]) for (const y of [-2.4, 0.6, 3.6]) { g.beginPath(); g.arc(x, y, 1, 0, 7); g.fill(); }
    line(g, dk(0.3), 1.2); g.beginPath(); g.moveTo(0, -6.4); g.lineTo(0, 6.6); g.stroke();                      // the seam down the front
    g.fillStyle = lt(0.26); g.beginPath(); g.moveTo(-5.4, -3.4); g.lineTo(-2, -3.4); g.lineTo(-2.6, 5.4); g.lineTo(-6, 5.4); g.closePath(); g.fill();
  });

  // --- hover armour: a machine you wear. A lit core, vents at the shoulder, thrusters underneath
  set('hover_armour', (g, size, item) => {
    g.fillStyle = '#3d434d';
    g.beginPath(); g.moveTo(-6.4, -6.4); g.lineTo(-2.4, -8); g.lineTo(2.4, -8); g.lineTo(6.4, -6.4);
    g.lineTo(6.4, 3.4); g.lineTo(-6.4, 3.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#22262e'; for (const s of [-1, 1]) g.fillRect(s * 3.4 - 1.6, -6, 3.2, 2.2);                  // shoulder vents
    g.fillStyle = item.color; g.beginPath(); g.arc(0, -1.4, 3, 0, 7); g.fill();
    g.fillStyle = lt(0.75); g.beginPath(); g.arc(0, -1.4, 1.4, 0, 7); g.fill();                                 // the core
    g.fillStyle = '#22262e'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2, 3.4); g.lineTo(s * 6, 3.4); g.lineTo(s * 5, 6); g.lineTo(s * 3, 6); g.closePath(); g.fill(); }
    g.fillStyle = item.color; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3, 6); g.lineTo(s * 5, 6); g.lineTo(s * 4, 9); g.closePath(); g.fill(); }   // the two jets holding it up
  });

  // --- godly: an ornate cuirass. Winged pauldrons, a laurel on the chest, a scalloped hem
  set('godly_body', (g, size, item) => {
    g.fillStyle = item.color;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 4.4, -6.4); g.quadraticCurveTo(s * 9, -6.4, s * 9, -2.4);
      g.quadraticCurveTo(s * 7, -3.4, s * 4.4, -3.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke(); }
    g.beginPath(); g.moveTo(-5.4, -7); g.quadraticCurveTo(0, -8.6, 5.4, -7); g.lineTo(5.4, 3.4);
    g.lineTo(3.4, 6.4); g.lineTo(1.2, 3.6); g.lineTo(-1.2, 6.4); g.lineTo(-3.4, 3.6); g.lineTo(-5.4, 6.4); g.closePath(); g.fill(); g.stroke();
    line(g, '#fff6c8', 1.4);                                                                                    // the laurel
    g.beginPath(); g.arc(0, 0.4, 3.4, 0.5, 2.64); g.stroke();
    g.beginPath(); g.arc(0, 0.4, 3.4, 3.64, 5.78); g.stroke();
    g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(0, -2.6, 1.4, 0, 7); g.fill();
  });

  // --- shadow cloak: the hood is up and there is nobody in it. The hem goes to smoke
  set('shadow_cloak', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(0, -8.6); g.quadraticCurveTo(5.4, -7.4, 6.4, -1.4); g.lineTo(8, 5.4);
    g.quadraticCurveTo(4, 7.4, 0, 5.4); g.quadraticCurveTo(-4, 7.4, -8, 5.4); g.lineTo(-6.4, -1.4);
    g.quadraticCurveTo(-5.4, -7.4, 0, -8.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#07060a'; g.beginPath(); g.moveTo(-3.4, -5.4); g.quadraticCurveTo(0, -7.4, 3.4, -5.4);
    g.quadraticCurveTo(2.6, -0.4, 0, 0.6); g.quadraticCurveTo(-2.6, -0.4, -3.4, -5.4); g.closePath(); g.fill();   // the empty hood
    g.fillStyle = '#7b3fe4'; g.beginPath(); g.arc(-1.4, -3.4, 1, 0, 7); g.arc(1.4, -3.4, 1, 0, 7); g.fill();      // two lights in it
    line(g, 'rgba(90,80,110,0.6)', 1.2, 'round');                                                                 // the hem coming apart
    g.beginPath(); g.moveTo(-6, 5.4); g.lineTo(-7, 8.6); g.moveTo(-1.4, 5.6); g.lineTo(-2, 8.6);
    g.moveTo(3, 5.6); g.lineTo(3.6, 8.6); g.stroke();
  });

  // --- dragon: plate with a dragon's head over the heart and spikes on both shoulders
  set('dragon_body', (g, size, item) => {
    g.fillStyle = item.color;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 5, -6.4); g.lineTo(s * 8.6, -7.4); g.lineTo(s * 8.6, -2.4);
      g.lineTo(s * 5, -2.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
      g.beginPath(); g.moveTo(s * 6, -7.4); g.lineTo(s * 6.6, -9.4); g.lineTo(s * 7.6, -7.4); g.closePath(); g.fill(); }
    g.beginPath(); g.moveTo(-5.4, -6.4); g.lineTo(5.4, -6.4); g.lineTo(6, 4.4); g.lineTo(0, 7.4); g.lineTo(-6, 4.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = dk(0.4);                                                                                       // the head: snout, jaw and a lit eye
    g.beginPath(); g.moveTo(-3.4, -3.4); g.lineTo(3.4, -3.4); g.lineTo(2.4, 1.4); g.lineTo(0, 3.4); g.lineTo(-2.4, 1.4); g.closePath(); g.fill();
    g.fillStyle = '#ffcf5a'; g.beginPath(); g.arc(-1.4, -1.4, 1, 0, 7); g.arc(1.4, -1.4, 1, 0, 7); g.fill();
    line(g, dk(0.45), 1.2, 'round'); g.beginPath(); g.moveTo(-1.6, 1.4); g.lineTo(1.6, 1.4); g.stroke();
  });

  // --- blackiron: a brigandine. Cloth outside, plates inside, and a grid of rivets that gives them away
  set('blackiron_body', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, -6); g.lineTo(-3.4, -7.6); g.lineTo(3.4, -7.6); g.lineTo(6.4, -6);
    g.lineTo(7, 7.4); g.lineTo(-7, 7.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#c9d1d9';                                                                                     // the rivet grid
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { const off = (r % 2) ? 1.5 : 0;
      g.beginPath(); g.arc(-4.5 + off + k * 3, -4.4 + r * 3.2, 1, 0, 7); g.fill(); }
    g.fillStyle = GRIP; g.fillRect(-7, 4.4, 14, 2.2);                                                             // the strap across the waist
    g.fillStyle = '#c9d1d9'; g.fillRect(-1.4, 4.2, 2.8, 2.6);
  });

  // --- sunstone: a tabard, worn over the plate, with the sun on it
  set('sunstone_body', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-5.4, -7.4); g.lineTo(5.4, -7.4); g.lineTo(5.4, 5.4); g.lineTo(2.6, 8.4);
    g.lineTo(-2.6, 8.4); g.lineTo(-5.4, 5.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 5.4, -7); g.lineTo(s * 8.6, -5.4); g.lineTo(s * 8.6, -1.4);
      g.lineTo(s * 5.4, -2.4); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#fff0c0';                                                                                      // the sun: disc and eight rays
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a);
      g.beginPath(); g.moveTo(c * 3 - s2 * 1.1, -0.4 + s2 * 3 + c * 1.1); g.lineTo(c * 5, -0.4 + s2 * 5);
      g.lineTo(c * 3 + s2 * 1.1, -0.4 + s2 * 3 - c * 1.1); g.closePath(); g.fill(); }
    g.beginPath(); g.arc(0, -0.4, 2.4, 0, 7); g.fill();
    g.fillStyle = dk(0.3); g.beginPath(); g.arc(0, -0.4, 1.1, 0, 7); g.fill();
  });

  // --- stormstone: a cuirass with the bolt struck across it and spikes on the shoulders
  set('stormstone_body', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6, -6.4); g.lineTo(-2.4, -8); g.lineTo(2.4, -8); g.lineTo(6, -6.4);
    g.quadraticCurveTo(7.4, 0.6, 6, 6.4); g.lineTo(-6, 6.4); g.quadraticCurveTo(-7.4, 0.6, -6, -6.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 5.4, -6.4); g.lineTo(s * 9, -3.4); g.lineTo(s * 5.6, -1.4); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#efe6ff';                                                                                      // the bolt
    g.beginPath(); g.moveTo(2.4, -6.4); g.lineTo(-3.4, 0.6); g.lineTo(-0.4, 0.6); g.lineTo(-2.4, 6);
    g.lineTo(3.6, -1.4); g.lineTo(0.6, -1.4); g.closePath(); g.fill();
    g.fillStyle = dk(0.3); g.fillRect(-6.6, 3.4, 13.2, 2.2);
  });

  // ==========================================================================
  // LEGS — eight, and each is a different garment: cuisses, mail chausses, articulated plate, a fauld skirt,
  // an ornate belt, a studded pair, sun-etched greaves and storm legs with spiked knees.
  // ==========================================================================
  set('bronze_legs', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, -7.4); g.lineTo(6.4, -7.4); g.lineTo(5.4, 8); g.lineTo(1.4, 8);
    g.lineTo(0, -0.4); g.lineTo(-1.4, 8); g.lineTo(-5.4, 8); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = lt(0.34); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 3.2, 3.4, 2, 1.8, 0, 0, 7); g.fill(); }   // knee discs
    g.fillStyle = dk(0.3); g.fillRect(-6.4, -7.4, 12.8, 2.2);
  });
  set('iron_legs', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, -7.4); g.lineTo(6.4, -7.4); g.lineTo(6.4, 8.4); g.lineTo(1.6, 8.4);
    g.lineTo(0.6, 0.6); g.lineTo(-0.6, 0.6); g.lineTo(-1.6, 8.4); g.lineTo(-6.4, 8.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, dk(0.33), 1);                                                                                       // mail, ring by ring
    for (let r = 0; r < 5; r++) { const y = -5.4 + r * 2.7, off = (r % 2) ? 1.1 : 0;
      for (let k = 0; k < 5; k++) { const x = -4.6 + off + k * 2.2; if (Math.abs(x) < 1.1 && y > 0.6) continue; g.beginPath(); g.arc(x, y, 1.05, 0, 7); g.stroke(); } }
    g.fillStyle = GRIP; g.fillRect(-6.4, -7.4, 12.8, 2.4);
  });
  set('steel_legs', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6, -7.4); g.lineTo(6, -7.4); g.lineTo(6.4, 8.4); g.lineTo(2, 8.4);
    g.lineTo(0, -1.4); g.lineTo(-2, 8.4); g.lineTo(-6.4, 8.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = dk(0.28); for (const y of [-4.6, -2.2, 0.2]) g.fillRect(-5.8, y, 11.6, 2);                     // the lames on the thigh
    g.fillStyle = item.color; for (const s of [-1, 1]) {                                                         // pointed knee cops
      g.beginPath(); g.moveTo(s * 1.6, 2.4); g.lineTo(s * 6.2, 2.4); g.lineTo(s * 6.6, 5.4); g.lineTo(s * 3.4, 6.4); g.closePath(); g.fill(); g.stroke(); }
  });
  set('mithril_legs', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-4.4, 0.4); g.lineTo(4.4, 0.4); g.lineTo(4.4, 8.4); g.lineTo(1.4, 8.4);
    g.lineTo(0.6, 3.4); g.lineTo(-0.6, 3.4); g.lineTo(-1.4, 8.4); g.lineTo(-4.4, 8.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(-6.4, -7.4); g.lineTo(6.4, -7.4); g.lineTo(8.4, 1.4); g.lineTo(-8.4, 1.4); g.closePath(); g.fill(); g.stroke();  // the fauld skirt over the top
    line(g, dk(0.32), 1.2);
    for (const x of [-4.4, 0, 4.4]) { g.beginPath(); g.moveTo(x, -7.2); g.lineTo(x * 1.3, 1.2); g.stroke(); }     // the plates in it
    g.fillStyle = lt(0.3); g.fillRect(-6.4, -7.4, 12.8, 2);
  });
  set('godly_legs', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, -6.4); g.quadraticCurveTo(0, -8.4, 6.4, -6.4); g.lineTo(5.4, 8.4);
    g.lineTo(1.6, 8.4); g.quadraticCurveTo(0, 2.4, -1.6, 8.4); g.lineTo(-5.4, 8.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#fff6c8'; g.beginPath(); g.moveTo(-6.6, -5.4); g.lineTo(6.6, -5.4); g.lineTo(6.2, -2.4);
    g.lineTo(-6.2, -2.4); g.closePath(); g.fill();                                                                // the gold belt
    g.fillStyle = item.color; g.beginPath(); g.arc(0, -3.9, 1.4, 0, 7); g.fill();
    line(g, '#fff6c8', 1.2);                                                                                      // etching down both thighs
    g.beginPath(); g.moveTo(-3.4, -0.4); g.quadraticCurveTo(-4.4, 3.6, -3.6, 7);
    g.moveTo(3.4, -0.4); g.quadraticCurveTo(4.4, 3.6, 3.6, 7); g.stroke();
  });
  set('blackiron_legs', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.6, -6.4); g.lineTo(6.6, -6.4); g.lineTo(6, 8.6); g.lineTo(2.4, 8.6);
    g.lineTo(0, 1.4); g.lineTo(-2.4, 8.6); g.lineTo(-6, 8.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = GRIP; g.fillRect(-7, -7.4, 14, 3);                                                              // a heavy belt
    g.fillStyle = '#c9d1d9'; g.fillRect(-1.6, -7.6, 3.2, 3.4);
    g.fillStyle = '#c9d1d9'; for (const s of [-1, 1]) for (const y of [-1.4, 2.4, 5.6]) { g.beginPath(); g.arc(s * 3.4, y, 1, 0, 7); g.fill(); }  // the studs
  });
  set('sunstone_legs', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-5.4, -6.4); g.lineTo(5.4, -6.4); g.lineTo(4.4, 2.4); g.lineTo(6.4, 8.6);
    g.lineTo(1.4, 8.6); g.lineTo(0, 1.4); g.lineTo(-1.4, 8.6); g.lineTo(-6.4, 8.6); g.lineTo(-4.4, 2.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#fff0c0'; g.beginPath(); g.arc(0, -5.4, 2.2, 0, Math.PI); g.fill();                            // half a sun at the waist
    for (let k = 0; k < 4; k++) { const a = Math.PI * (0.15 + k * 0.23);
      g.beginPath(); g.moveTo(Math.cos(a) * 2.6, -5.4 + Math.sin(a) * 2.6); g.lineTo(Math.cos(a) * 4.4, -5.4 + Math.sin(a) * 4.4);
      g.lineTo(Math.cos(a) * 2.6 + 1, -5.4 + Math.sin(a) * 2.6 + 1); g.closePath(); g.fill(); }
    line(g, '#fff0c0', 1.2); g.beginPath(); g.moveTo(-4.4, 3.4); g.lineTo(-5.4, 7.4); g.moveTo(4.4, 3.4); g.lineTo(5.4, 7.4); g.stroke();
  });
  set('stormstone_legs', (g, size, item) => {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, -6.6); g.lineTo(6.4, -6.6); g.lineTo(5.6, 3.4); g.lineTo(6.6, 8.6);
    g.lineTo(1.6, 8.6); g.lineTo(0, 0.4); g.lineTo(-1.6, 8.6); g.lineTo(-6.6, 8.6); g.lineTo(-5.6, 3.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#efe6ff'; for (const s of [-1, 1]) {                                                           // a bolt down each thigh
      g.beginPath(); g.moveTo(s * 4.4, -5); g.lineTo(s * 1.6, -0.4); g.lineTo(s * 3.4, -0.4); g.lineTo(s * 1.6, 4.4);
      g.lineTo(s * 5, -1.4); g.lineTo(s * 3.2, -1.4); g.closePath(); g.fill(); }
    g.fillStyle = item.color; for (const s of [-1, 1]) {                                                          // spiked knees
      g.beginPath(); g.moveTo(s * 2.4, 4.4); g.lineTo(s * 8.6, 4.4); g.lineTo(s * 5, 7.4); g.closePath(); g.fill(); g.stroke(); }
  });

  // ==========================================================================
  // SHIELDS — nine outlines, so the shape alone names the shield: a buckler, a heater, a kite, a pavise,
  // wings, a shell of scales, a horned dragon face, a sun disc and a storm hexagon split by its own bolt.
  // ==========================================================================
  set('bronze_shield', (g, size, item) => {                        // a little round buckler with a domed boss
    g.fillStyle = item.color; g.beginPath(); g.arc(0, 0, 7.4, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, dk(0.3), 1.4); g.beginPath(); g.arc(0, 0, 5.6, 0, 7); g.stroke();
    g.fillStyle = lt(0.4); g.beginPath(); g.arc(0, 0, 2.6, 0, 7); g.fill();
    g.fillStyle = dk(0.3); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 1, 0, 7); g.fill(); }
  });
  set('iron_shield', (g, size, item) => {                          // a heater: flat top, straight sides, a point
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, -8); g.lineTo(6.4, -8); g.lineTo(6, 1.4); g.quadraticCurveTo(4.4, 6.4, 0, 8.6);
    g.quadraticCurveTo(-4.4, 6.4, -6, 1.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = dk(0.3); g.fillRect(-2, -7.6, 4, 14);                                                            // the reinforcing band
    g.fillStyle = lt(0.3); g.beginPath(); g.moveTo(-5.4, -7); g.lineTo(-2.6, -7); g.lineTo(-3.4, 2.4); g.lineTo(-5.2, 0.4); g.closePath(); g.fill();
  });
  set('steel_shield', (g, size, item) => {                         // a kite: round shoulders, a long tail
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(0, -8.6); g.quadraticCurveTo(5.4, -8.4, 5.4, -3.4); g.quadraticCurveTo(5, 4.4, 0, 8.8);
    g.quadraticCurveTo(-5, 4.4, -5.4, -3.4); g.quadraticCurveTo(-5.4, -8.4, 0, -8.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, dk(0.34), 1.6);
    g.beginPath(); g.moveTo(0, -7.4); g.lineTo(0, 7); g.moveTo(-4.6, -2.4); g.lineTo(4.6, -2.4); g.stroke();        // the cross on it
    g.fillStyle = lt(0.3); g.beginPath(); g.arc(0, -2.4, 1.6, 0, 7); g.fill();
  });
  set('mithril_shield', (g, size, item) => {                       // a pavise: a wall you stand behind, stepped at the top
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, -6.4); g.lineTo(-2.4, -6.4); g.lineTo(-2.4, -8.4); g.lineTo(2.4, -8.4);
    g.lineTo(2.4, -6.4); g.lineTo(6.4, -6.4); g.lineTo(6.4, 8); g.lineTo(-6.4, 8); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, dk(0.3), 1.2);
    for (const x of [-3.4, 0, 3.4]) { g.beginPath(); g.moveTo(x, -6.2); g.lineTo(x, 7.8); g.stroke(); }             // the planks of it
    g.fillStyle = dk(0.34); g.fillRect(-6.4, 1.4, 12.8, 2.2);
    g.fillStyle = lt(0.4); g.fillRect(-1.4, -3.4, 2.8, 3.2);
  });
  set('godly_shield', (g, size, item) => {                         // two wings meeting on a centre ridge
    g.fillStyle = item.color;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 0.8, -8); g.quadraticCurveTo(s * 8.4, -6.4, s * 8.6, -0.4);
      g.quadraticCurveTo(s * 6.4, 5.4, s * 0.8, 8.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
      line(g, dk(0.3), 1.2);
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(s * 1.4, -5 + k * 3.4); g.quadraticCurveTo(s * 5.4, -4.4 + k * 3.2, s * 7.4, -1.4 + k * 2.2); g.stroke(); }
    }
    g.fillStyle = '#fff6c8'; g.beginPath(); g.moveTo(-1.6, -8.4); g.lineTo(1.6, -8.4); g.lineTo(1.2, 8.6); g.lineTo(-1.2, 8.6); g.closePath(); g.fill();
    g.fillStyle = item.color; g.beginPath(); g.arc(0, -2.4, 1.4, 0, 7); g.fill();
  });
  set('scale_shield', (g, size, item) => {                         // a shell: an oval of overlapping plates
    g.fillStyle = item.color;
    g.beginPath(); g.ellipse(0, 0, 6.8, 8.4, 0, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, dk(0.36), 1.2);
    for (let r = 0; r < 4; r++) { const y = -5.4 + r * 3.4, n = r === 0 || r === 3 ? 2 : 3, off = (r % 2) ? 0 : 1.8;
      for (let k = 0; k < n; k++) { g.beginPath(); g.arc(-3.6 + off + k * 3.6, y, 1.8, 0, Math.PI); g.stroke(); } }
    g.fillStyle = lt(0.3); g.beginPath(); g.ellipse(-3, -4.4, 1.6, 2.4, 0.4, 0, 7); g.fill();
  });
  set('dragon_shield', (g, size, item) => {                        // horns at the top, a barb at the bottom, claw marks across it
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8.4, -7.4); g.lineTo(-3.4, -4.4); g.lineTo(0, -7.4); g.lineTo(3.4, -4.4);
    g.lineTo(8.4, -7.4); g.lineTo(6.4, 2.4); g.lineTo(0, 9); g.lineTo(-6.4, 2.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, '#ffcf5a', 1.4, 'round');                                                                               // three claw scores
    for (const x of [-2.6, 0.4, 3.4]) { g.beginPath(); g.moveTo(x - 1.4, -2.4); g.quadraticCurveTo(x, 1.6, x + 0.6, 5); g.stroke(); }
    g.fillStyle = dk(0.34); g.beginPath(); g.moveTo(-8.4, -7.4); g.lineTo(-3.4, -4.4); g.lineTo(-6.4, -2.4); g.closePath();
    g.moveTo(8.4, -7.4); g.lineTo(3.4, -4.4); g.lineTo(6.4, -2.4); g.closePath(); g.fill();
  });
  set('sunstone_shield', (g, size, item) => {                      // a sun disc: a ring of triangles round a bright centre
    g.fillStyle = item.color;
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a);
      g.beginPath(); g.moveTo(c * 6 - s2 * 1.6, s2 * 6 + c * 1.6); g.lineTo(c * 8.8, s2 * 8.8);
      g.lineTo(c * 6 + s2 * 1.6, s2 * 6 - c * 1.6); g.closePath(); g.fill(); }
    g.beginPath(); g.arc(0, 0, 6.4, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#fff0c0'; g.beginPath(); g.arc(0, 0, 3.4, 0, 7); g.fill();
    g.fillStyle = dk(0.28); g.beginPath(); g.arc(0, 0, 1.4, 0, 7); g.fill();
  });
  set('stormstone_shield', (g, size, item) => {                    // a hexagon the bolt has split down the middle
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-4.4, -8); g.lineTo(4.4, -8); g.lineTo(7.4, 0); g.lineTo(4.4, 8);
    g.lineTo(-4.4, 8); g.lineTo(-7.4, 0); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#efe6ff';
    g.beginPath(); g.moveTo(2.4, -7); g.lineTo(-3.4, 0.4); g.lineTo(-0.4, 0.4); g.lineTo(-2.4, 7);
    g.lineTo(3.6, -1); g.lineTo(0.6, -1); g.closePath(); g.fill();
    line(g, dk(0.32), 1.2);
    g.beginPath(); g.moveTo(-6.4, -2.4); g.lineTo(6.4, -2.4); g.moveTo(-6.4, 2.4); g.lineTo(6.4, 2.4); g.stroke();
  });

  // ==========================================================================
  // SWORDS — eight blades, eight blade shapes. A plank, a straight arming sword, a fullered longsword, a leaf
  // blade, a chopper, a knapped shard, a flame blade and a bolt. Held the way the core icons hold a sword.
  // ==========================================================================
  set('wooden_sword', (g, size, item) => {                        // a training sword: blunt, grained, rope on the grip
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-2.4, -2); g.lineTo(8, -2); g.quadraticCurveTo(9.6, 0, 8, 2); g.lineTo(-2.4, 2); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, dk(0.28), 1);
    g.beginPath(); g.moveTo(-1.4, -0.6); g.lineTo(7, -0.6); g.moveTo(-1.4, 0.8); g.lineTo(6.4, 0.8); g.stroke();  // the grain
    g.fillStyle = WOOD_D; g.fillRect(-4.4, -3, 2.4, 6);
    g.fillStyle = CORD; for (const x of [-8.4, -6.8, -5.2]) g.fillRect(x, -1.8, 1.2 + 0.8, 3.6);                   // the wrap
    g.restore();
  });
  set('iron_sword', (g, size, item) => {                          // straight, double-edged, a bar for a guard
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-2, -2.2); g.lineTo(7, -2.2); g.lineTo(10.4, 0); g.lineTo(7, 2.2); g.lineTo(-2, 2.2); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = lt(0.35); g.beginPath(); g.moveTo(-1.4, -1.2); g.lineTo(6.6, -1.2); g.lineTo(8.4, 0); g.lineTo(-1.4, 0); g.closePath(); g.fill();
    g.fillStyle = '#7a6a52'; g.fillRect(-3.6, -4.4, 2.4, 8.8);                                                      // the crossguard
    g.fillStyle = GRIP; g.fillRect(-8.4, -1.6, 5, 3.2);
    g.fillStyle = '#7a6a52'; g.beginPath(); g.arc(-9.4, 0, 1.6, 0, 7); g.fill();
    g.restore();
  });
  set('steel_sword', (g, size, item) => {                         // a longsword: a fuller down it, a curved guard, a disc pommel
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-1.4, -2.6); g.lineTo(8.4, -1.6); g.lineTo(10.6, 0); g.lineTo(8.4, 1.6); g.lineTo(-1.4, 2.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = dk(0.26); g.beginPath(); g.moveTo(0.6, -0.7); g.lineTo(7.6, -0.5); g.lineTo(7.6, 0.5); g.lineTo(0.6, 0.7); g.closePath(); g.fill();
    g.fillStyle = '#9aa3ad';                                                                                        // the guard, swept toward the blade
    g.beginPath(); g.moveTo(-3.4, -5.4); g.quadraticCurveTo(-1, -2.6, -1, 0); g.quadraticCurveTo(-1, 2.6, -3.4, 5.4);
    g.quadraticCurveTo(-4.6, 2.6, -4.6, 0); g.quadraticCurveTo(-4.6, -2.6, -3.4, -5.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = GRIP; g.fillRect(-8.6, -1.6, 4.4, 3.2);
    g.fillStyle = '#9aa3ad'; g.beginPath(); g.arc(-9.6, 0, 2, 0, 7); g.fill(); g.stroke();
    g.restore();
  });
  set('mithril_sword', (g, size, item) => {                       // a leaf blade with a swept guard and a teardrop pommel
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-1.4, -1.4); g.quadraticCurveTo(3.4, -4, 6.4, -2.6); g.lineTo(10.4, 0);
    g.lineTo(6.4, 2.6); g.quadraticCurveTo(3.4, 4, -1.4, 1.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, lt(0.4), 1.2); g.beginPath(); g.moveTo(0.6, 0); g.lineTo(8.4, 0); g.stroke();
    g.fillStyle = '#c9d1d9';                                                                                        // the guard, swept back over the hand
    g.beginPath(); g.moveTo(-2.4, -1.6); g.quadraticCurveTo(-5.4, -6.4, -7.4, -4.4); g.quadraticCurveTo(-5.4, -2.6, -4.4, 0);
    g.quadraticCurveTo(-5.4, 2.6, -7.4, 4.4); g.quadraticCurveTo(-5.4, 6.4, -2.4, 1.6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = GRIP; g.fillRect(-8.6, -1.4, 4.6, 2.8);
    g.fillStyle = '#7ec8ff'; g.beginPath(); g.moveTo(-10.4, 0); g.quadraticCurveTo(-9.4, -2.4, -8, 0); g.quadraticCurveTo(-9.4, 2.4, -10.4, 0); g.closePath(); g.fill();
    g.restore();
  });
  set('blackiron_sword', (g, size, item) => {                     // a chopper: one edge, a chisel tip, a block for a guard
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-2, -2.6); g.lineTo(8.4, -3.4); g.lineTo(10, -1); g.lineTo(9.4, 2.6); g.lineTo(-2, 2.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = lt(0.3); g.beginPath(); g.moveTo(-1.4, 1); g.lineTo(9.2, 1.4); g.lineTo(9.4, 2.4); g.lineTo(-1.4, 2.4); g.closePath(); g.fill();  // the ground edge
    g.fillStyle = IRON_D; g.fillRect(-4.6, -4, 3, 8);
    g.fillStyle = GRIP; g.fillRect(-9, -1.8, 4.6, 3.6);
    g.fillStyle = IRON_D; g.fillRect(-10.4, -2.4, 2.2, 4.8);
    g.restore();
  });
  set('obsidian_blade', (g, size, item) => {                      // knapped glass, chipped along both edges, bound in hide
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-2, -2.4); g.lineTo(1.4, -3.4); g.lineTo(3.4, -1.6); g.lineTo(6, -3); g.lineTo(7.4, -1);
    g.lineTo(10.4, 0.4); g.lineTo(7, 1.6); g.lineTo(5, 3.4); g.lineTo(2.4, 1.6); g.lineTo(-2, 2.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = lt(0.3); g.beginPath(); g.moveTo(-1.4, -1.4); g.lineTo(3.4, -0.6); g.lineTo(8.4, 0.4); g.lineTo(2.4, 0.6); g.closePath(); g.fill();
    g.fillStyle = '#c9a7ff'; g.beginPath(); g.moveTo(6, -3); g.lineTo(7.4, -1); g.lineTo(5.4, -1.2); g.closePath(); g.fill();
    g.fillStyle = '#5a4a3a'; g.fillRect(-8.6, -2.2, 6.8, 4.4);
    line(g, dk(0.5), 1.1);                                                                                          // the binding
    for (const x of [-7.2, -5.4, -3.6]) { g.beginPath(); g.moveTo(x, -2.2); g.lineTo(x + 0.8, 2.2); g.stroke(); }
    g.restore();
  });
  set('sunstone_sword', (g, size, item) => {                      // a flame blade, waved along its whole length, sun on the pommel
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-1.4, -2.2);
    g.quadraticCurveTo(1.4, -4.4, 3.4, -1.6); g.quadraticCurveTo(5.4, 1.2, 7.4, -1.4); g.lineTo(10.4, 0.6);
    g.quadraticCurveTo(6.4, 3.4, 4.4, 1); g.quadraticCurveTo(2.4, -1.4, -1.4, 2.2); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#fff0c0'; g.beginPath(); g.moveTo(-3.6, -4.6); g.lineTo(-1, -3.4); g.lineTo(-1, 3.4); g.lineTo(-3.6, 4.6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = GRIP; g.fillRect(-8.4, -1.6, 4.8, 3.2);
    g.fillStyle = '#fff0c0'; g.beginPath(); g.arc(-9.6, 0, 2, 0, 7); g.fill(); g.stroke();
    g.fillStyle = item.color; g.beginPath(); g.arc(-9.6, 0, 1, 0, 7); g.fill();
    g.restore();
  });
  set('stormstone_sword', (g, size, item) => {                    // the blade is the bolt: it zigs, and the tip forks
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-1.4, -2.4); g.lineTo(3.4, -3.4); g.lineTo(2.4, -0.6); g.lineTo(6.4, -1.6);
    g.lineTo(10.4, -2.4); g.lineTo(7.4, 0.6); g.lineTo(10.4, 2.4); g.lineTo(5.4, 1.4); g.lineTo(2.4, 2.6); g.lineTo(-1.4, 2.4); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#efe6ff'; g.beginPath(); g.moveTo(-0.6, -1.4); g.lineTo(2.8, -2); g.lineTo(2, -0.4); g.lineTo(6, -1); g.lineTo(4.4, 0.4); g.closePath(); g.fill();
    g.fillStyle = '#3a3548'; g.fillRect(-4.4, -4.4, 2.6, 8.8);
    g.fillStyle = GRIP; g.fillRect(-8.8, -1.6, 4.4, 3.2);
    g.fillStyle = '#efe6ff'; g.beginPath(); g.moveTo(-10.6, -1.6); g.lineTo(-8.4, 0); g.lineTo(-10.6, 1.6); g.closePath(); g.fill();
    g.restore();
  });

  // ==========================================================================
  // DAGGERS — five short blades, five shapes: a leaf, a spike, a broad triangle, a needle and a cleaver.
  // ==========================================================================
  set('bronze_dagger', (g, size, item) => {                       // a leaf blade, no guard to speak of
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-1.4, 0); g.quadraticCurveTo(1.4, -3, 4.4, -2); g.lineTo(7.4, 0);
    g.lineTo(4.4, 2); g.quadraticCurveTo(1.4, 3, -1.4, 0); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#7a6a52'; g.fillRect(-2.8, -2.4, 2.2, 4.8);
    g.fillStyle = GRIP; g.fillRect(-7.4, -1.4, 4.8, 2.8);
    g.restore();
  });
  set('iron_dagger', (g, size, item) => {                         // a spike with a proper crossguard
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-1, -1.6); g.lineTo(5.4, -1); g.lineTo(8.4, 0); g.lineTo(5.4, 1); g.lineTo(-1, 1.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#7a6a52'; g.fillRect(-2.8, -3.6, 2, 7.2);
    g.fillStyle = GRIP; g.fillRect(-7.4, -1.4, 4.6, 2.8);
    g.fillStyle = '#7a6a52'; g.fillRect(-8.8, -2, 2, 4);
    g.restore();
  });
  set('steel_dagger', (g, size, item) => {                        // broad, triangular, a fuller cut into it
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-1.4, -3); g.lineTo(8.4, 0); g.lineTo(-1.4, 3); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = dk(0.26); g.beginPath(); g.moveTo(-0.4, -1); g.lineTo(5.4, 0); g.lineTo(-0.4, 1); g.closePath(); g.fill();
    g.fillStyle = '#9aa3ad'; g.fillRect(-3.4, -3.4, 2, 6.8);
    g.fillStyle = GRIP; g.fillRect(-7.6, -1.4, 4.2, 2.8);
    g.fillStyle = '#9aa3ad'; g.beginPath(); g.arc(-8.6, 0, 1.4, 0, 7); g.fill();
    g.restore();
  });
  set('mithril_dagger', (g, size, item) => {                      // a needle: long, thin, a ring for a guard
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-0.4, -1.2); g.lineTo(9.4, -0.4); g.lineTo(9.4, 0.4); g.lineTo(-0.4, 1.2); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    line(g, '#c9d1d9', 1.4); g.beginPath(); g.arc(-2, 0, 2.4, 0, 7); g.stroke();                                     // the ring guard
    g.fillStyle = GRIP; g.fillRect(-8, -1.2, 5.4, 2.4);
    line(g, CORD, 1);
    for (const x of [-6.8, -5.4, -4]) { g.beginPath(); g.moveTo(x, -1.2); g.lineTo(x, 1.2); g.stroke(); }
    g.fillStyle = '#7ec8ff'; g.beginPath(); g.arc(-9, 0, 1.4, 0, 7); g.fill();
    g.restore();
  });
  set('blackiron_dagger', (g, size, item) => {                    // a cleaver of a knife, clipped point, knuckle bar
    g.save(); g.rotate(-0.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-1.4, -2.6); g.lineTo(5.4, -2.6); g.lineTo(8.4, -0.4); g.lineTo(8, 2.6); g.lineTo(-1.4, 2.6); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = lt(0.3); g.beginPath(); g.moveTo(-1.4, 1.2); g.lineTo(7.8, 1.4); g.lineTo(8, 2.4); g.lineTo(-1.4, 2.4); g.closePath(); g.fill();
    g.fillStyle = IRON_D; g.fillRect(-3.4, -3, 2, 6);
    g.fillStyle = GRIP; g.fillRect(-8, -1.6, 4.6, 3.2);
    g.fillStyle = IRON_D; g.beginPath(); g.moveTo(-3.4, 3); g.quadraticCurveTo(-6.4, 5.4, -8, 1.6); g.lineTo(-8, 3.4);
    g.quadraticCurveTo(-6, 6.6, -2.4, 3.4); g.closePath(); g.fill();
    g.restore();
  });

  // ==========================================================================
  // HAFTED WEAPONS — a hammer with a claw, a sledge, a flanged maul, a spear and a skull on a stick.
  // ==========================================================================
  set('iron_warhammer', (g, size, item) => {                      // one flat face, one crow's beak on the back
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD_D; g.fillRect(-10, -1.6, 17, 3.2);
    line(g, dk(0.3), 1); g.strokeRect(-10, -1.6, 17, 3.2);
    g.fillStyle = item.color; g.fillRect(4.4, -4.6, 5.4, 9.2);
    line(g, OUT, 1.2); g.strokeRect(4.4, -4.6, 5.4, 9.2);
    g.beginPath(); g.moveTo(4.4, -3.4); g.lineTo(-1.4, -5.4); g.lineTo(-0.4, -2.4); g.lineTo(4.4, -1.4); g.closePath(); g.fill(); g.stroke();  // the beak
    g.fillStyle = lt(0.32); g.fillRect(7.6, -3.6, 2, 7.2);
    g.restore();
  });
  set('steel_warhammer', (g, size, item) => {                     // a sledge: two faces, a band round the head, a wrapped grip
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD_D; g.fillRect(-10.4, -1.6, 15, 3.2);
    g.fillStyle = CORD; for (const x of [-9.4, -7.4, -5.4]) g.fillRect(x, -1.8, 2, 3.6);
    g.fillStyle = item.color; g.fillRect(1.4, -4.8, 7.8, 9.6);
    line(g, OUT, 1.2); g.strokeRect(1.4, -4.8, 7.8, 9.6);
    g.fillStyle = dk(0.32); g.fillRect(4.2, -4.8, 2.6, 9.6);                                                    // the band
    g.fillStyle = lt(0.34); g.fillRect(7, -3.8, 2, 7.6); g.fillRect(1.6, -3.8, 2, 7.6);
    g.restore();
  });
  set('mithril_warhammer', (g, size, item) => {                   // a maul with flanges standing off the head like a crown
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD_D; g.fillRect(-10.4, -1.4, 15, 2.8);
    g.fillStyle = item.color;
    g.beginPath(); g.arc(5.4, 0, 3.4, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a);
      g.beginPath(); g.moveTo(5.4 + c * 3 - s2 * 1.3, s2 * 3 + c * 1.3); g.lineTo(5.4 + c * 5.6, s2 * 5.6);
      g.lineTo(5.4 + c * 3 + s2 * 1.3, s2 * 3 - c * 1.3); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#7ec8ff'; g.beginPath(); g.arc(5.4, 0, 1.5, 0, 7); g.fill();
    g.restore();
  });
  set('dragon_spear', (g, size, item) => {                        // not a hammer at all: a spear, barbed, with wings behind the head
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD_D; g.fillRect(-10.4, -1.2, 15, 2.4);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(3.4, -2.4); g.quadraticCurveTo(7.4, -2.4, 10.4, 0); g.quadraticCurveTo(7.4, 2.4, 3.4, 2.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.beginPath(); g.moveTo(3.4, -1.4); g.lineTo(0.4, -5.4); g.lineTo(2.4, -1.4); g.closePath();                   // barbs
    g.moveTo(3.4, 1.4); g.lineTo(0.4, 5.4); g.lineTo(2.4, 1.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffcf5a'; g.fillRect(0.4, -2.2, 2.4, 4.4);                                                      // the collar
    g.fillStyle = lt(0.35); g.beginPath(); g.moveTo(4.4, -0.9); g.lineTo(9, -0.2); g.lineTo(4.4, 0.4); g.closePath(); g.fill();
    g.restore();
  });
  set('skull_mace', (g, size, item) => {                          // a skull, jaw and all, lashed to a bone haft
    g.save(); g.rotate(-0.8);
    g.fillStyle = '#d9d3c4'; g.fillRect(-10.4, -1.4, 13, 2.8);
    g.beginPath(); g.arc(-10.4, 0, 1.8, 0, 7); g.fill(); line(g, dk(0.35), 1); g.stroke();
    g.fillStyle = item.color;
    g.beginPath(); g.arc(5, -0.4, 4.6, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.beginPath(); g.moveTo(2.6, 2.6); g.lineTo(7.4, 2.6); g.lineTo(6.6, 5.6); g.lineTo(3.4, 5.6); g.closePath(); g.fill(); g.stroke();  // the jaw
    g.fillStyle = '#1a1a1f'; g.beginPath(); g.arc(3.4, -0.8, 1.4, 0, 7); g.arc(6.8, -0.8, 1.4, 0, 7); g.fill();
    line(g, dk(0.5), 1.1);
    for (const x of [4, 5.4, 6.8]) { g.beginPath(); g.moveTo(x, 2.8); g.lineTo(x - 0.3, 5.4); g.stroke(); }        // teeth
    g.fillStyle = CORD; g.fillRect(-0.4, -2.2, 2.4, 4.4);
    g.restore();
  });

  // ==========================================================================
  // AXES — four woodcutting axes and three battleaxes. A hatchet, a felling axe, a splitter, a crescent;
  // then a single bit with a spike, a double bit, and a halberd head.
  // ==========================================================================
  set('bronze_axe', (g, size, item) => {                          // a hatchet: short haft, small bearded bit
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD; g.fillRect(-8.4, -1.4, 13, 2.8); line(g, dk(0.3), 1); g.strokeRect(-8.4, -1.4, 13, 2.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(3.4, -3.4); g.lineTo(7.4, -3.4); g.quadraticCurveTo(9.4, 0.6, 6.4, 4.4);
    g.quadraticCurveTo(4.4, 3.4, 3.4, 1.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = lt(0.32); g.beginPath(); g.moveTo(6.4, -2.4); g.quadraticCurveTo(8.4, 0.6, 6, 3.4); g.quadraticCurveTo(7.4, 0.6, 5.6, -2.4); g.closePath(); g.fill();
    g.restore();
  });
  set('iron_axe', (g, size, item) => {                            // a felling axe: long haft, a wedge with a poll behind it
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD; g.fillRect(-10.4, -1.4, 16, 2.8); line(g, dk(0.3), 1); g.strokeRect(-10.4, -1.4, 16, 2.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(1.4, -3.4); g.lineTo(6.4, -4.4); g.lineTo(9.4, 0); g.lineTo(6.4, 4.4); g.lineTo(1.4, 3.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = dk(0.3); g.fillRect(1.4, -3.2, 2.2, 6.4);                                                        // the poll
    g.fillStyle = lt(0.34); g.beginPath(); g.moveTo(7.4, -2.4); g.lineTo(9.2, 0); g.lineTo(7.4, 2.4); g.lineTo(6.6, 0); g.closePath(); g.fill();
    g.restore();
  });
  set('steel_axe', (g, size, item) => {                           // a splitter: a wide flaring bit and a wrapped grip
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD_D; g.fillRect(-10.4, -1.6, 15, 3.2);
    g.fillStyle = CORD; for (const x of [-9.4, -7.2]) g.fillRect(x, -1.8, 2, 3.6);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(2.4, -2.4); g.lineTo(5.4, -6.4); g.quadraticCurveTo(9.6, 0, 5.4, 6.4);
    g.lineTo(2.4, 2.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = lt(0.34); g.beginPath(); g.moveTo(5.4, -5.4); g.quadraticCurveTo(8.4, 0, 5.4, 5.4); g.quadraticCurveTo(6.8, 0, 4.4, -4.4); g.closePath(); g.fill();
    g.restore();
  });
  set('mithril_axe', (g, size, item) => {                         // a deep crescent with a spike out the back
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD_D; g.fillRect(-10.4, -1.4, 16, 2.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(3.4, -5.4); g.quadraticCurveTo(9.6, -2.4, 9.6, 2.4); g.quadraticCurveTo(6.4, 1.4, 3.4, 5.4);
    g.quadraticCurveTo(5.4, 0, 3.4, -5.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.beginPath(); g.moveTo(2.6, -1.4); g.lineTo(-2.4, -3.4); g.lineTo(-2.4, -0.4); g.lineTo(2.6, 1.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#7ec8ff'; g.beginPath(); g.arc(3.4, 0, 1.4, 0, 7); g.fill();
    g.restore();
  });
  set('iron_battleaxe', (g, size, item) => {                      // one great bit, and a spike standing off the top
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD_D; g.fillRect(-10.4, -1.6, 16, 3.2);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(1.4, -3.4); g.quadraticCurveTo(7.4, -6.4, 9, -0.4); g.quadraticCurveTo(7.6, 6.4, 1.4, 3.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.beginPath(); g.moveTo(2.4, -3.4); g.lineTo(3.4, -8.2); g.lineTo(4.6, -3.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = dk(0.3); g.fillRect(0.4, -3.2, 2.2, 6.4);
    g.restore();
  });
  set('steel_battleaxe', (g, size, item) => {                     // two bits, one each side of the haft
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD_D; g.fillRect(-9.4, -1.6, 15, 3.2);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(3.4, -2.6); g.quadraticCurveTo(7.8, -5.8, 9.4, 0); g.quadraticCurveTo(7.8, 5.8, 3.4, 2.6); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.beginPath(); g.moveTo(2.6, -2.6); g.quadraticCurveTo(-3.4, -7.4, -3.6, 0); g.quadraticCurveTo(-3.4, 7.4, 2.6, 2.6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = dk(0.3); g.fillRect(2.4, -3, 2.2, 6);
    g.restore();
  });
  set('mithril_battleaxe', (g, size, item) => {                   // a halberd head: a bit, a long spike, a hook behind
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD_D; g.fillRect(-10.4, -1.4, 14, 2.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(2.4, -2.4); g.quadraticCurveTo(7.4, -6.4, 7.4, 0.6); g.quadraticCurveTo(6.4, 4.4, 2.4, 3.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.beginPath(); g.moveTo(1.4, -2.4); g.lineTo(3.4, -3.4); g.lineTo(8.4, -5.4); g.lineTo(4.4, -1.4); g.closePath(); g.fill(); g.stroke();   // the spike, out past the bit
    g.beginPath(); g.moveTo(1.4, 1.4); g.lineTo(-3.4, 4.4); g.lineTo(-1.4, 5.4); g.lineTo(1.4, 3.4); g.closePath(); g.fill(); g.stroke();     // the hook
    g.fillStyle = '#7ec8ff'; g.beginPath(); g.arc(2.4, 0.4, 1.2, 0, 7); g.fill();
    g.restore();
  });

  // ==========================================================================
  // PICKAXES — four heads: a one-point pick, a two-point pick, an adze-and-point, and a toothed head.
  // ==========================================================================
  set('bronze_pickaxe', (g, size, item) => {
    g.save(); g.rotate(-0.3);
    g.fillStyle = WOOD; g.fillRect(-1.4, -6.4, 2.8, 15); line(g, dk(0.3), 1); g.strokeRect(-1.4, -6.4, 2.8, 15);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-1.4, -6.4); g.lineTo(-8.4, -3.4); g.lineTo(-8, -1.4); g.lineTo(-1.4, -3.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.beginPath(); g.moveTo(1.4, -6.4); g.lineTo(5.4, -5.4); g.lineTo(5.4, -2.4); g.lineTo(1.4, -3.4); g.closePath(); g.fill(); g.stroke();   // the chisel end
    g.fillStyle = '#5a4a3a'; g.fillRect(-2, -7.4, 4, 2.4);
    g.restore();
  });
  set('iron_pickaxe', (g, size, item) => {
    g.save(); g.rotate(-0.3);
    g.fillStyle = WOOD; g.fillRect(-1.6, -7, 3.2, 16); line(g, dk(0.3), 1); g.strokeRect(-1.6, -7, 3.2, 16);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(0, -8.4); g.quadraticCurveTo(-6.4, -8, -9.4, -3.4); g.quadraticCurveTo(-5.4, -5.4, 0, -5.4);
    g.quadraticCurveTo(5.4, -5.4, 9.4, -3.4); g.quadraticCurveTo(6.4, -8, 0, -8.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#5a4a3a'; g.fillRect(-2.2, -7.6, 4.4, 2.6);
    g.fillStyle = lt(0.3); g.beginPath(); g.moveTo(-2.4, -7); g.quadraticCurveTo(-6.4, -6, -8, -4); g.quadraticCurveTo(-5.4, -6.4, -2.4, -6.6); g.closePath(); g.fill();
    g.restore();
  });
  set('steel_pickaxe', (g, size, item) => {                       // a point on one side, a flat adze on the other
    g.save(); g.rotate(-0.3);
    g.fillStyle = WOOD_D; g.fillRect(-1.6, -6.4, 3.2, 15);
    g.fillStyle = CORD; for (const y of [3.4, 6]) g.fillRect(-1.8, y, 3.6, 2);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-1.6, -7); g.quadraticCurveTo(-6.4, -6.4, -9.4, -2.4); g.quadraticCurveTo(-6.4, -4.4, -1.6, -4.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.beginPath(); g.moveTo(1.6, -7.4); g.lineTo(8.4, -6.4); g.lineTo(8.4, -2.4); g.lineTo(1.6, -4.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = lt(0.34); g.fillRect(5.4, -6.2, 2.4, 3.4);
    g.restore();
  });
  set('mithril_pickaxe', (g, size, item) => {                     // three teeth on the biting side, a reinforced eye
    g.save(); g.rotate(-0.3);
    g.fillStyle = WOOD_D; g.fillRect(-1.4, -6.4, 2.8, 15);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(0, -7.6); g.quadraticCurveTo(-6.4, -7, -9.4, -2.4);
    g.lineTo(-7.4, -2.6); g.lineTo(-6.4, -4.4); g.lineTo(-4.4, -3.8); g.lineTo(-3.4, -5.4); g.lineTo(-1.4, -5); g.lineTo(0, -5.4);
    g.quadraticCurveTo(5.4, -5.4, 9.4, -2.4); g.quadraticCurveTo(6.4, -7, 0, -7.6); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#3d434d'; g.fillRect(-2.4, -6.4, 4.8, 2.6);
    g.fillStyle = '#7ec8ff'; g.beginPath(); g.arc(0, -5.1, 1, 0, 7); g.fill();
    g.restore();
  });

  // ==========================================================================
  // BOWS AND ARROWS — three bows by their limbs (a short stave, a recurve, a longbow), three arrows by
  // their heads (knapped flint, a bodkin, an elven leaf).
  // ==========================================================================
  set('shortbow', (g, size, item) => {                            // a plain stave, bent in one arc
    line(g, item.color, 2.6, 'round');
    g.beginPath(); g.arc(-3.4, 0, 7.4, -1.15, 1.15); g.stroke();
    line(g, STEEL_L, 1.1); g.beginPath(); g.moveTo(-0.4, -6.8); g.lineTo(-0.4, 6.8); g.stroke();
    g.fillStyle = GRIP; g.fillRect(3.2, -1.8, 2.2, 3.6);
  });
  set('oak_bow', (g, size, item) => {                             // a recurve: the tips turn back on themselves
    line(g, item.color, 2.8, 'round');
    g.beginPath(); g.moveTo(1.4, -8.4); g.quadraticCurveTo(-2.6, -7.4, -3.4, -3.4);
    g.quadraticCurveTo(-4.4, 0, -3.4, 3.4); g.quadraticCurveTo(-2.6, 7.4, 1.4, 8.4); g.stroke();
    line(g, STEEL_L, 1.1); g.beginPath(); g.moveTo(1.4, -8.4); g.lineTo(1.4, 8.4); g.stroke();
    g.fillStyle = GRIP; g.fillRect(-4.8, -2.4, 2.6, 4.8);
    line(g, CORD, 1); for (const y of [-1.4, 0.4, 2]) { g.beginPath(); g.moveTo(-4.8, y); g.lineTo(-2.2, y); g.stroke(); }
  });
  set('yew_bow', (g, size, item) => {                             // a longbow: tall, barely curved, horn nocks top and bottom
    line(g, item.color, 2.4, 'round');
    g.beginPath(); g.moveTo(-1.4, -9); g.quadraticCurveTo(-4.4, 0, -1.4, 9); g.stroke();
    line(g, STEEL_L, 1.1); g.beginPath(); g.moveTo(-1.4, -9); g.lineTo(-1.4, 9); g.stroke();
    g.fillStyle = '#e8dcc0'; for (const y of [-9, 9]) { g.beginPath(); g.arc(-1.4, y, 1.2, 0, 7); g.fill(); }   // the nocks
    g.fillStyle = GRIP; g.fillRect(-4.6, -2.6, 2.4, 5.2);
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(-3.4, 0, 1, 0, 7); g.fill();
  });
  set('stone_arrow', (g, size, item) => {                         // a chipped flint head lashed to a rough shaft
    line(g, WOOD, 1.6, 'round'); g.beginPath(); g.moveTo(-8, 8); g.lineTo(4.4, -4.4); g.stroke();
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(8.4, -8.4); g.lineTo(6.4, -2.6); g.lineTo(4.4, -3.4); g.lineTo(5, -5.4); g.lineTo(2.6, -6.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, CORD, 1.1); g.beginPath(); g.moveTo(3.4, -3.4); g.lineTo(5.4, -5.4); g.stroke();                     // the lashing
    g.fillStyle = '#8a7a62';                                                                                      // plain feather, one side
    g.beginPath(); g.moveTo(-8, 8); g.lineTo(-3.4, 5.4); g.lineTo(-5.4, 3.4); g.closePath(); g.fill();
  });
  set('iron_arrow', (g, size, item) => {                          // a bodkin point, a collar, two clipped vanes
    line(g, WOOD, 1.4, 'round'); g.beginPath(); g.moveTo(-8, 8); g.lineTo(5.4, -5.4); g.stroke();
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(8.6, -8.6); g.lineTo(5.4, -3.4); g.lineTo(3.4, -5.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#5a4a3a'; g.beginPath(); g.moveTo(4.6, -2.6); g.lineTo(2.6, -4.6); g.lineTo(3.6, -5.6); g.lineTo(5.6, -3.6); g.closePath(); g.fill();
    g.fillStyle = '#c0504d';                                                                                      // two vanes
    g.beginPath(); g.moveTo(-7.4, 7.4); g.lineTo(-2.6, 6); g.lineTo(-4, 3.4); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-8.4, 6.4); g.lineTo(-6, 1.4); g.lineTo(-3.4, 2.8); g.closePath(); g.fill();
  });
  set('elven_arrow', (g, size, item) => {                         // a leaf for a head, and fletching that sweeps the length of the nock
    line(g, '#cbe6d0', 1.3, 'round'); g.beginPath(); g.moveTo(-8, 8); g.lineTo(4.4, -4.4); g.stroke();
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(8.4, -8.4); g.quadraticCurveTo(7.4, -3.4, 4.4, -2.4); g.quadraticCurveTo(3.4, -5.4, 8.4, -8.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#cbe6d0';
    g.beginPath(); g.moveTo(-8.4, 8.4); g.quadraticCurveTo(-1.4, 5.4, 0.4, 1.4); g.quadraticCurveTo(-4.4, 3.4, -8.4, 8.4); g.closePath(); g.fill();
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(2.4, -2.4, 1.1, 0, 7); g.fill();
  });

  // ==========================================================================
  // TOOLS AND TRAPS — the working end tells you what it is: a hoe blade, a claw hammer, a rod with a reel,
  // a slatted lobster pot, a jaw trap, a powder keg and a bomb with a lit fuse.
  // ==========================================================================
  set('bronze_hoe', (g, size, item) => {                          // the blade sits square across the end of the haft
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD; g.fillRect(-10, -1.4, 17, 2.8); line(g, dk(0.3), 1); g.strokeRect(-10, -1.4, 17, 2.8);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(6.4, -1.4); g.lineTo(9, -1.4); g.lineTo(9, 5); g.lineTo(6, 5); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = lt(0.32); g.fillRect(6.4, 3, 2.4, 2);
    g.fillStyle = GRIP; g.fillRect(-10.4, -2, 2.4, 4);
    g.restore();
  });
  set('hammer', (g, size, item) => {                              // a claw hammer, and the claw is the tell
    g.save(); g.rotate(-0.8);
    g.fillStyle = WOOD; g.fillRect(-9.4, -1.4, 15, 2.8);
    g.fillStyle = CORD; g.fillRect(-9.4, -1.6, 3, 3.2);
    g.fillStyle = '#5a5a62'; g.fillRect(4.4, -3.4, 4.6, 6.8); line(g, OUT, 1.2); g.strokeRect(4.4, -3.4, 4.6, 6.8);
    g.beginPath(); g.moveTo(4.4, -2.4); g.quadraticCurveTo(-0.6, -6.4, -3.4, -4.4);
    g.quadraticCurveTo(-0.6, -4.4, 1.4, -1.4); g.lineTo(4.4, -1.4); g.closePath(); g.fill(); g.stroke();          // the claw
    g.fillStyle = lt(0.3); g.fillRect(7.4, -2.6, 2, 5.2);
    g.restore();
  });
  set('fishing_rod', (g, size, item) => {                         // rod, reel, line and a hook on the end of it
    line(g, WOOD, 2.2, 'round'); g.beginPath(); g.moveTo(-8.4, 8.4); g.quadraticCurveTo(0, 2.4, 6.4, -7.4); g.stroke();
    g.fillStyle = '#5a5a62'; g.beginPath(); g.arc(-4.4, 5, 2.4, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();   // the reel
    g.fillStyle = CORD; g.beginPath(); g.arc(-4.4, 5, 1.1, 0, 7); g.fill();
    line(g, 'rgba(233,238,245,0.85)', 1);                                                                          // the line, and the hook it ends in
    g.beginPath(); g.moveTo(6.4, -7.4); g.quadraticCurveTo(8.4, -2.4, 7.4, 2.4); g.stroke();
    line(g, '#c9d1d9', 1.3); g.beginPath(); g.arc(6.2, 3.4, 1.4, -1.2, 3.2); g.stroke();
    g.fillStyle = '#c0504d'; g.beginPath(); g.arc(8.4, -0.4, 1.2, 0, 7); g.fill();
  });
  set('lobster_pot', (g, size, item) => {                         // a slatted basket with a funnel mouth and a float rope
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8.4, 6.4); g.quadraticCurveTo(-8.4, -3.4, 0, -3.4); g.quadraticCurveTo(8.4, -3.4, 8.4, 6.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, dk(0.35), 1.2);                                                                                        // the slats
    for (const x of [-5, -1.6, 1.6, 5]) { g.beginPath(); g.moveTo(x, -2.6); g.lineTo(x * 1.12, 6.4); g.stroke(); }
    g.beginPath(); g.moveTo(-8, 1.4); g.lineTo(8, 1.4); g.stroke();
    g.fillStyle = '#2a2620'; g.beginPath(); g.ellipse(0, 3.4, 2.6, 2, 0, 0, 7); g.fill();                          // the way in
    line(g, CORD, 1.3, 'round'); g.beginPath(); g.moveTo(-6.4, -3.4); g.quadraticCurveTo(-2.4, -8.4, 3.4, -6.4); g.stroke();
    g.fillStyle = '#e63946'; g.beginPath(); g.arc(4.6, -6.6, 2, 0, 7); g.fill(); line(g, OUT, 1); g.stroke();       // the float
  });
  set('goblin_trap', (g, size, item) => {                         // two toothed jaws on a spring plate, and a chain off the back
    g.fillStyle = '#3d434d'; g.beginPath(); g.ellipse(0, 3.4, 5.4, 2.4, 0, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = item.color;
    for (const s of [-1, 1]) {                                                                                      // the jaws, open
      g.beginPath(); g.moveTo(s * 1.4, 2.4);
      g.quadraticCurveTo(s * 7.4, -1.4, s * 6.4, -7.4); g.quadraticCurveTo(s * 4.4, -2.4, s * 0.4, 0.4); g.closePath(); g.fill(); g.stroke();
      line(g, '#e9eef5', 1.2);
      for (let k = 0; k < 3; k++) { const t = 0.25 + k * 0.26;
        g.beginPath(); g.moveTo(s * (1.4 + 5 * t), 2.4 - 8 * t); g.lineTo(s * (0.6 + 4.4 * t), 1.4 - 7.4 * t); g.stroke(); }
    }
    g.fillStyle = '#c9d1d9'; g.beginPath(); g.arc(0, 3.4, 1.6, 0, 7); g.fill();                                     // the plate
    line(g, '#8f96a3', 1.2);                                                                                        // the chain
    for (const [x, y] of [[-6.4, 5.4], [-8.4, 6.4]]) { g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.stroke(); }
  });
  set('blast_powder', (g, size, item) => {                        // a keg, hooped, with a fuse coming out of the bung
    g.fillStyle = WOOD_D;
    g.beginPath(); g.moveTo(-5.4, -5.4); g.quadraticCurveTo(-7.4, 0.4, -5.4, 6.4); g.lineTo(5.4, 6.4);
    g.quadraticCurveTo(7.4, 0.4, 5.4, -5.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#5a5a62'; g.fillRect(-6.6, -2.4, 13.2, 2.2); g.fillRect(-6.6, 2.4, 13.2, 2.2);                   // the hoops
    g.fillStyle = item.color; g.beginPath(); g.ellipse(0, -5.4, 5.4, 1.6, 0, 0, 7); g.fill(); g.stroke();
    line(g, CORD, 1.3, 'round'); g.beginPath(); g.moveTo(0, -5.8); g.quadraticCurveTo(2.4, -8.4, 5.4, -7.4); g.stroke();
    g.fillStyle = '#ffb347'; g.beginPath(); g.arc(5.8, -7.4, 1.4, 0, 7); g.fill();
  });
  set('bomb', (g, size, item) => {                                // goblin work: a riveted iron ball with the fuse already lit
    g.fillStyle = item.color; g.beginPath(); g.arc(0, 2, 6.6, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#6a6a72'; g.fillRect(-2.4, -5.4, 4.8, 2.6);                                                      // the neck
    g.fillStyle = lt(0.22); g.beginPath(); g.arc(-2.4, -0.4, 2.2, 0, 7); g.fill();
    g.fillStyle = '#8f96a3'; for (let k = 0; k < 5; k++) { const a = 0.4 + k * 1.05; g.beginPath(); g.arc(Math.cos(a) * 4.8, 2 + Math.sin(a) * 4.8, 1, 0, 7); g.fill(); }
    line(g, CORD, 1.4, 'round'); g.beginPath(); g.moveTo(0.4, -5.4); g.quadraticCurveTo(3.4, -8, 6, -6.4); g.stroke();
    g.fillStyle = '#ffb347'; g.beginPath(); g.arc(6.4, -6.6, 1.8, 0, 7); g.fill();
    g.fillStyle = '#fff0c0'; g.beginPath(); g.arc(6.4, -6.6, 1, 0, 7); g.fill();
  });

  // ==========================================================================
  // SALVAGE — four kinds of junk that were one kind of junk: a torn offcut, a cogwheel, a coil, a handful
  // of fixings.
  // ==========================================================================
  set('goblin_scrap', (g, size, item) => {                        // sheet metal, torn off something, still holding a nail
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8, -4.4); g.lineTo(-3.4, -6.4); g.lineTo(1.4, -4.4); g.lineTo(6.4, -7.4);
    g.lineTo(8.4, -1.4); g.lineTo(5.4, 3.4); g.lineTo(7.4, 6.4); g.lineTo(-1.4, 7.4); g.lineTo(-4.4, 2.4); g.lineTo(-8.4, 2.4); g.closePath();
    g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = dk(0.35); g.beginPath(); g.arc(-3.4, -0.4, 1.4, 0, 7); g.fill();                                  // the hole it was bolted through
    line(g, dk(0.3), 1.2);
    g.beginPath(); g.moveTo(1.4, -3.4); g.lineTo(3.4, 2.4); g.moveTo(-6, -1.4); g.lineTo(-5.4, 4.4); g.stroke();     // the creases
    g.fillStyle = lt(0.3); g.beginPath(); g.moveTo(3.4, -5.4); g.lineTo(6.4, -6.4); g.lineTo(7.4, -2.4); g.lineTo(4.4, -1.4); g.closePath(); g.fill();
  });
  set('gear_wheel', (g, size, item) => {                          // teeth all round, spokes across the middle
    g.fillStyle = item.color;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a);
      g.beginPath(); g.moveTo(c * 5.4 - s2 * 1.6, s2 * 5.4 + c * 1.6); g.lineTo(c * 8.4 - s2 * 1.2, s2 * 8.4 + c * 1.2);
      g.lineTo(c * 8.4 + s2 * 1.2, s2 * 8.4 - c * 1.2); g.lineTo(c * 5.4 + s2 * 1.6, s2 * 5.4 - c * 1.6); g.closePath(); g.fill(); }
    g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#2a2620'; g.beginPath(); g.arc(0, 0, 3.4, 0, 7); g.fill();
    g.fillStyle = item.color; g.fillRect(-3.4, -1.1, 6.8, 2.2); g.fillRect(-1.1, -3.4, 2.2, 6.8);                    // the spokes
    g.fillStyle = '#2a2620'; g.beginPath(); g.arc(0, 0, 1.4, 0, 7); g.fill();
  });
  set('lightning_coil', (g, size, item) => {                      // wire wound on a core, sparking off the top
    g.fillStyle = '#5a4a3a'; g.fillRect(-2.4, -4.4, 4.8, 10.8); line(g, OUT, 1.2); g.strokeRect(-2.4, -4.4, 4.8, 10.8);
    line(g, item.color, 1.6);                                                                                        // the winding
    for (let k = 0; k < 5; k++) { const y = -3 + k * 2.1; g.beginPath(); g.ellipse(0, y, 4.6, 1.2, 0, 0, 7); g.stroke(); }
    g.fillStyle = '#3d434d'; g.fillRect(-6, 6.4, 12, 2.4); line(g, OUT, 1.2); g.strokeRect(-6, 6.4, 12, 2.4);         // the base
    g.fillStyle = item.color;                                                                                         // the arc jumping off the terminal
    g.beginPath(); g.moveTo(1.4, -4.4); g.lineTo(-2.4, -8.4); g.lineTo(0.4, -8); g.lineTo(-1.4, -9.4);
    g.lineTo(4.4, -6.4); g.lineTo(1.6, -6.6); g.closePath(); g.fill();
  });
  set('machine_parts', (g, size, item) => {                       // a bolt, a nut and a bracket, in a heap
    g.fillStyle = item.color;                                                                                         // the bolt, lying across
    g.save(); g.rotate(-0.35);
    g.fillRect(-7.4, -1.4, 11, 2.8); line(g, OUT, 1.2); g.strokeRect(-7.4, -1.4, 11, 2.8);
    g.fillRect(-9.4, -2.6, 2.4, 5.2); g.strokeRect(-9.4, -2.6, 2.4, 5.2);
    line(g, dk(0.3), 1); for (const x of [0, 1.6]) { g.beginPath(); g.moveTo(x, -1.4); g.lineTo(x, 1.4); g.stroke(); }
    g.restore();
    g.fillStyle = '#6a7078';                                                                                          // the nut, on its side
    g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.lineTo(4.4 + Math.cos(a) * 3.4, 4.4 + Math.sin(a) * 3.4); }
    g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#2a2620'; g.beginPath(); g.arc(4.4, 4.4, 1.6, 0, 7); g.fill();
    g.fillStyle = '#8f96a3';                                                                                          // the bracket
    g.beginPath(); g.moveTo(-8.4, 2.4); g.lineTo(-4.4, 2.4); g.lineTo(-4.4, 4.4); g.lineTo(-6.4, 4.4);
    g.lineTo(-6.4, 7.4); g.lineTo(-8.4, 7.4); g.closePath(); g.fill(); g.stroke();
  });

  // ==========================================================================
  // SEEDS AND CROPS — ten of these drew the same four ovals. A seed is drawn as the seed it actually is:
  // a sprouting tuber, a heap of grain, a pod, a pip in a cloud, a sapling in a root ball.
  // ==========================================================================
  set('potato_seed', (g, size, item) => {                         // a seed potato, already sprouting
    g.fillStyle = item.color; g.beginPath(); g.ellipse(0, 2.4, 6.4, 4.6, 0.2, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = dk(0.32); for (const [x, y] of [[-2.4, 2.4], [2.4, 4], [0.4, 0.4]]) { g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill(); }
    line(g, '#6fc24a', 1.6, 'round');                                                                             // the shoots
    g.beginPath(); g.moveTo(-1.4, -1.4); g.quadraticCurveTo(-3.4, -5.4, -1.4, -8); g.moveTo(1.4, -1.6); g.quadraticCurveTo(3.4, -5.4, 2.4, -8.4); g.stroke();
    g.fillStyle = '#6fc24a'; g.beginPath(); g.ellipse(-2.4, -8, 1.8, 1.1, -0.5, 0, 7); g.ellipse(3.4, -8.4, 1.8, 1.1, 0.5, 0, 7); g.fill();
  });
  set('wheat_seed', (g, size, item) => {                          // a heap of grain, each with its crease
    g.fillStyle = item.color;
    for (const [x, y, a] of [[-4.4, 3.4, 0.3], [-1, 4.4, -0.2], [2.6, 3.6, 0.4], [5.4, 4.6, -0.3], [-2.6, 0.4, -0.4], [1.4, 0.6, 0.3], [-0.4, -3, 0.1]]) {
      g.beginPath(); g.ellipse(x, y, 2.4, 1.6, a, 0, 7); g.fill(); line(g, OUT, 1.1); g.stroke();
      line(g, dk(0.3), 1); g.beginPath(); g.moveTo(x - 1.6, y); g.lineTo(x + 1.6, y); g.stroke();
      g.fillStyle = item.color;
    }
    g.fillStyle = lt(0.34); g.beginPath(); g.ellipse(-3.6, -1, 1.4, 1, 0, 0, 7); g.fill();
  });
  set('herb_seed', (g, size, item) => {                           // dark seed, tipped out of a folded paper twist
    g.fillStyle = '#e2dcc6';
    g.beginPath(); g.moveTo(-8.4, -6.4); g.lineTo(1.4, -6.4); g.lineTo(4.4, 2.4); g.lineTo(-5.4, 3.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = dk(0.18); g.beginPath(); g.moveTo(-3.4, -6.4); g.lineTo(1.4, -6.4); g.lineTo(4.4, 2.4); g.lineTo(0.4, 2.8); g.closePath(); g.fill();
    g.fillStyle = item.color;                                                                                      // the seed that fell out
    for (const [x, y] of [[4.4, 5.4], [7.4, 6.4], [1.4, 7.4], [6.4, 3]]) { g.beginPath(); g.ellipse(x, y, 1.6, 1.1, 0.4, 0, 7); g.fill(); line(g, OUT, 1); g.stroke(); g.fillStyle = item.color; }
  });
  set('herbs', (g, size, item) => {                               // a cut bunch, tied at the stems
    line(g, item.color, 1.6, 'round');
    for (const [x0, x1] of [[-4.4, -1.4], [0, 0], [4.4, 1.4]]) { g.beginPath(); g.moveTo(x0 * 1.2, -7.4); g.quadraticCurveTo(x1, -2.4, 0, 3.4); g.stroke(); }
    g.fillStyle = item.color;
    for (const [x, y, a] of [[-4.6, -6.4, -0.7], [-2.4, -3.4, -0.5], [0.4, -7.4, 0], [1.4, -4.4, 0.4], [4.6, -6.4, 0.7], [3.4, -2.4, 0.5]]) {
      g.beginPath(); g.ellipse(x, y, 2.4, 1.3, a, 0, 7); g.fill(); line(g, dk(0.3), 1); g.stroke(); g.fillStyle = item.color; }
    g.fillStyle = CORD; g.fillRect(-2.6, 3.4, 5.2, 2.4); line(g, OUT, 1.1); g.strokeRect(-2.6, 3.4, 5.2, 2.4);
    line(g, item.color, 1.4, 'round'); g.beginPath(); g.moveTo(-1.4, 5.8); g.lineTo(-2.4, 8.4); g.moveTo(1.4, 5.8); g.lineTo(2.4, 8.4); g.stroke();
  });
  set('goldenwheat_seed', (g, size, item) => {                    // one grain, husk and all, with the shine that gives it away
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(0, -6.4); g.quadraticCurveTo(4.4, -2.4, 3.4, 2.4); g.quadraticCurveTo(1.4, 6.4, 0, 6.4);
    g.quadraticCurveTo(-1.4, 6.4, -3.4, 2.4); g.quadraticCurveTo(-4.4, -2.4, 0, -6.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, dk(0.3), 1.3); g.beginPath(); g.moveTo(0, -5); g.lineTo(0, 5.4); g.stroke();
    line(g, '#a8862a', 1.3, 'round');                                                                              // the awn
    g.beginPath(); g.moveTo(0, -6.4); g.lineTo(1.4, -9.4); g.stroke();
    g.fillStyle = '#fff6c8'; for (const [x, y, r] of [[-2, -2.4, 1.2], [4.6, -4.4, 1.4], [-5.4, 3.4, 1]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  });
  set('golden_wheat', (g, size, item) => {                        // the whole ear on its stalk, long awns and all
    line(g, '#a8862a', 1.6, 'round'); g.beginPath(); g.moveTo(0, 9); g.lineTo(0, -2.4); g.stroke();
    line(g, item.color, 1, 'round');                                                                               // awns off the top
    for (const dx of [-3.4, 0, 3.4]) { g.beginPath(); g.moveTo(dx * 0.3, -5.4); g.lineTo(dx, -9.4); g.stroke(); }
    g.fillStyle = item.color;
    for (let j = 0; j < 4; j++) { const y = -2.4 - j * 1.9;
      g.beginPath(); g.ellipse(-2, y, 2.2, 1.2, -0.6, 0, 7); g.fill(); g.beginPath(); g.ellipse(2, y, 2.2, 1.2, 0.6, 0, 7); g.fill(); }
    g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(-2.6, -7.4, 1, 0, 7); g.arc(3, -4.4, 1, 0, 7); g.fill();
    g.fillStyle = '#6fae5a'; g.beginPath(); g.ellipse(-4.4, 4.4, 4, 1.4, -0.4, 0, 7); g.fill();                    // one leaf on the stalk
  });
  set('dragonfruit_seed', (g, size, item) => {                    // a scaled pod, the fruit in miniature
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(0, -7.4); g.quadraticCurveTo(5.4, -3.4, 4.4, 3.4); g.quadraticCurveTo(2.4, 7.4, 0, 7.4);
    g.quadraticCurveTo(-2.4, 7.4, -4.4, 3.4); g.quadraticCurveTo(-5.4, -3.4, 0, -7.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#6fae5a';                                                                                        // the little fins
    for (const [x, y, s] of [[-4, -1.4, -1], [4, -1.4, 1], [-3.4, 3, -1], [3.4, 3, 1]]) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 3.4, y - 2); g.lineTo(x + s * 0.6, y + 2.2); g.closePath(); g.fill(); }
    g.fillStyle = dk(0.32); g.beginPath(); g.arc(0, 0.4, 1.6, 0, 7); g.fill();
  });
  set('cloudberry_seed', (g, size, item) => {                     // a pip that floats: it came down in a cloud and kept it
    g.fillStyle = '#dff0ff';
    for (const [x, y, r] of [[-4.4, 2.4, 3.4], [0, 0.6, 4.4], [4.4, 2.4, 3.2], [-1.4, 4.4, 3]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    line(g, dk(0.2), 1.1); g.beginPath(); g.arc(0, 0.6, 4.4, Math.PI, 0); g.stroke();
    g.fillStyle = item.color; g.beginPath(); g.ellipse(0, 1.4, 2.4, 3, 0, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = lt(0.5); g.beginPath(); g.arc(-0.8, 0.4, 1, 0, 7); g.fill();
    line(g, 'rgba(160,200,240,0.8)', 1.2, 'round');                                                                 // two drops falling out of it
    g.beginPath(); g.moveTo(-4.4, 6.4); g.lineTo(-4.8, 8.4); g.moveTo(3.4, 6.4); g.lineTo(3.8, 8.4); g.stroke();
  });
  set('tree_sapling', (g, size, item) => {                        // a thin whip with two leaves, in a ball of soil
    g.fillStyle = '#6b4a2a'; g.beginPath(); g.ellipse(0, 6.4, 5.4, 2.6, 0, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, '#8a6a3a', 1.6, 'round'); g.beginPath(); g.moveTo(0, 6.4); g.lineTo(0, -3.4); g.stroke();
    g.fillStyle = item.color;
    g.beginPath(); g.ellipse(-3.4, -4.4, 3.4, 1.8, -0.5, 0, 7); g.fill(); line(g, dk(0.3), 1); g.stroke();
    g.fillStyle = item.color; g.beginPath(); g.ellipse(3.4, -6.4, 3.4, 1.8, 0.5, 0, 7); g.fill(); g.stroke();
    g.fillStyle = dk(0.3); g.beginPath(); g.arc(-2.4, 6.4, 1, 0, 7); g.arc(2.6, 7, 1, 0, 7); g.fill();
  });
  set('oak_sapling', (g, size, item) => {                         // stouter, lobed leaves, and an acorn still on it
    g.fillStyle = '#5a3a1e'; g.beginPath(); g.moveTo(-5.4, 4.4); g.lineTo(5.4, 4.4); g.lineTo(4.4, 8.6); g.lineTo(-4.4, 8.6); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, WOOD_D, 2.2, 'round'); g.beginPath(); g.moveTo(0, 4.4); g.lineTo(0, -2.4); g.stroke();
    g.fillStyle = item.color;                                                                                       // two lobed leaves
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(0, -1.4 - (s > 0 ? 2.4 : 0));
      g.quadraticCurveTo(s * 3, -4.4, s * 2.4, -6.4); g.quadraticCurveTo(s * 5.4, -5.4, s * 6.4, -7.4);
      g.quadraticCurveTo(s * 6.4, -3.4, s * 3.4, -1.4); g.closePath(); g.fill(); line(g, dk(0.3), 1); g.stroke(); g.fillStyle = item.color; }
    g.fillStyle = '#c9a36a'; g.beginPath(); g.ellipse(-1.4, 1.4, 1.8, 2.4, 0, 0, 7); g.fill(); line(g, OUT, 1.1); g.stroke();  // the acorn
    g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(-1.4, -0.4, 1.8, Math.PI, 0); g.fill();
  });
  set('wheat', (g, size, item) => {                               // a sheaf, tied in the middle, the way it comes off the field
    line(g, '#a8862a', 1.4, 'round');
    for (const s of [-1, 0, 1]) { g.beginPath(); g.moveTo(s * 3.4, 8.4); g.quadraticCurveTo(s * 1.4, 2.4, s * 2.4, -3.4); g.stroke(); }
    g.fillStyle = item.color;
    for (const s of [-1, 0, 1]) for (let j = 0; j < 3; j++) { const y = -3.4 - j * 2, x = s * 2.4;
      g.beginPath(); g.ellipse(x - 1.4, y, 1.9, 1.1, -0.6, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + 1.4, y, 1.9, 1.1, 0.6, 0, 7); g.fill(); }
    g.fillStyle = CORD; g.fillRect(-4.4, 2.4, 8.8, 2.4); line(g, OUT, 1.1); g.strokeRect(-4.4, 2.4, 8.8, 2.4);
    line(g, dk(0.3), 1); g.beginPath(); g.moveTo(-4.4, 3.6); g.lineTo(4.4, 3.6); g.stroke();
  });
  set('berries', (g, size, item) => {                             // three on a sprig, with the leaf they grew under
    g.fillStyle = '#3f7d2b'; g.beginPath(); g.ellipse(-4.4, -5.4, 4.2, 2.2, -0.6, 0, 7); g.fill(); line(g, dk(0.3), 1); g.stroke();
    line(g, '#5a3a1e', 1.3, 'round');
    g.beginPath(); g.moveTo(-1.4, -6.4); g.lineTo(-1.4, -2.4); g.moveTo(-1.4, -3.4); g.lineTo(-4.4, -1.4); g.moveTo(-1.4, -3.4); g.lineTo(2.6, -1.4); g.stroke();
    for (const [x, y, r] of [[-4.4, 1.4, 3.4], [2.6, 1.4, 3.2], [-0.6, 5.4, 3]]) {
      g.fillStyle = item.color; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
      g.fillStyle = lt(0.45); g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, 1, 0, 7); g.fill(); }
  });
  set('cloudberry', (g, size, item) => {                          // an aggregate berry: little drupelets, on its own puff of cloud
    g.fillStyle = 'rgba(210,232,250,0.7)'; g.beginPath(); g.ellipse(0, 7, 7.4, 2.2, 0, 0, 7); g.fill();
    g.fillStyle = item.color; g.beginPath(); g.arc(0, 0.4, 5.4, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, dk(0.26), 1.1);                                                                                         // the drupelets that make it one berry
    for (const [x, y] of [[-2.6, -1.6], [1, -2.4], [3, 0.4], [-3.4, 1.6], [0.4, 1.4], [2, 3.4], [-1.4, 4]]) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.stroke(); }
    g.fillStyle = '#6fae5a'; g.beginPath(); g.moveTo(-1.4, -5); g.lineTo(-5.4, -7.4); g.lineTo(-1.4, -7.4);
    g.lineTo(1.4, -8.4); g.lineTo(1.4, -5); g.closePath(); g.fill();                                                 // the calyx
    g.fillStyle = lt(0.5); g.beginPath(); g.arc(-2.6, -1.6, 1.1, 0, 7); g.fill();
  });
  set('dragonfruit', (g, size, item) => {                         // a pitaya: an oval body with green-tipped fins all over it
    g.fillStyle = item.color; g.beginPath(); g.ellipse(0, 0.4, 5, 7, 0, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#6fae5a';
    for (const [x, y, s, a] of [[-4.4, -3.4, -1, -0.5], [4.4, -2.4, 1, 0.4], [-4.6, 2.4, -1, 0.3], [4.4, 3.4, 1, -0.3], [0, -7, 0, 0]]) {
      g.beginPath(); g.moveTo(x, y);
      if (s === 0) { g.lineTo(-2.4, -8.4); g.lineTo(2.4, -8.4); }
      else { g.lineTo(x + s * 4, y - 2.4); g.lineTo(x + s * 1.4, y + 2.6); }
      g.closePath(); g.fill(); }
    g.fillStyle = lt(0.3); g.beginPath(); g.ellipse(-2, -1.4, 1.6, 2.6, 0.3, 0, 7); g.fill();
    g.fillStyle = dk(0.3); for (const [x, y] of [[1.4, 1.4], [-1, 3.4], [2, 4.4]]) { g.beginPath(); g.arc(x, y, 1, 0, 7); g.fill(); }
  });

  // ==========================================================================
  // FOOD — raw beef and cooked beef were the same joint; the pies were one pie. A raw joint still has its
  // bone and its marbling, a cooked one has a crust and steam, burnt food is a lump of charcoal, and the
  // three pies are a crimped top, a lattice and a fish looking out of the crust.
  // ==========================================================================
  set('raw_beef', (g, size, item) => {                            // a joint on the bone, cut face out
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, -4.4); g.quadraticCurveTo(0, -7.4, 6.4, -4.4); g.quadraticCurveTo(8.4, 0.4, 5.4, 4.4);
    g.quadraticCurveTo(0, 7, -5.4, 4.4); g.quadraticCurveTo(-8.4, 0.4, -6.4, -4.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#f2e9d8'; g.beginPath(); g.ellipse(2.4, 1.4, 2.4, 2, 0.3, 0, 7); g.fill(); line(g, dk(0.3), 1); g.stroke();  // the cut bone
    g.fillStyle = '#c9736b'; g.beginPath(); g.arc(2.4, 1.4, 1.1, 0, 7); g.fill();
    line(g, lt(0.4), 1.2);                                                                                         // marbling
    g.beginPath(); g.moveTo(-4.4, -2.4); g.quadraticCurveTo(-1.4, -0.4, -3.4, 2.4);
    g.moveTo(-0.4, -4.4); g.quadraticCurveTo(1.4, -2.4, -0.4, -0.4); g.stroke();
  });
  set('cooked_beef', (g, size, item) => {                         // browned all over, still on the bone, and steaming
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-5.4, -1.4); g.quadraticCurveTo(-4.4, -5.4, 0.4, -5.4); g.quadraticCurveTo(6.4, -5.4, 7, -0.4);
    g.quadraticCurveTo(7.4, 5.4, 0.4, 5.4); g.quadraticCurveTo(-5.4, 5.4, -5.4, -1.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#f2e9d8';                                                                                       // the shank bone sticking out of it
    g.beginPath(); g.moveTo(-5, -1.4); g.lineTo(-8.4, -3.4); g.lineTo(-8.4, 0.6); g.lineTo(-5, 1.4); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(-8.4, -1.4, 2, 0, 7); g.fill(); g.stroke();
    grill(g, -2.4, 4.4, 0, 3);
    steam(g, 1.4);
  });
  set('burnt_food', (g, size, item) => {                          // a lump of charcoal that used to be dinner
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-7.4, 1.4); g.lineTo(-5.4, -3.4); g.lineTo(-1.4, -5.4); g.lineTo(3.4, -4.4);
    g.lineTo(7.4, -0.4); g.lineTo(6.4, 4.4); g.lineTo(1.4, 6.4); g.lineTo(-4.4, 5.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, 'rgba(120,110,100,0.7)', 1.2);                                                                          // the cracks, and the ash in them
    g.beginPath(); g.moveTo(-3.4, -3.4); g.lineTo(-1.4, 0.4); g.lineTo(-3.4, 4.4); g.moveTo(-1.4, 0.4); g.lineTo(3.4, 1.4); g.stroke();
    g.fillStyle = '#5a544e'; for (const [x, y] of [[3.4, -1.6], [-5.4, 2.4], [4.4, 3.4]]) { g.beginPath(); g.arc(x, y, 1, 0, 7); g.fill(); }
    line(g, 'rgba(150,150,150,0.55)', 1.2, 'round');                                                                // the smoke still coming off it
    g.beginPath(); g.moveTo(-1.4, -6); g.quadraticCurveTo(-3.4, -7.4, -1.4, -9); g.moveTo(3, -5.4); g.quadraticCurveTo(1.4, -7, 3.4, -8.6); g.stroke();
  });
  set('potato', (g, size, item) => {                              // a tuber with eyes and the dirt still on it
    g.fillStyle = item.color; g.beginPath(); g.ellipse(0, 0, 8, 5.6, 0.25, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = dk(0.3); for (const [x, y] of [[-3.4, -1.4], [1.4, 1.4], [4.4, -1.4], [-1, 3]]) { g.beginPath(); g.ellipse(x, y, 1.4, 1, 0.4, 0, 7); g.fill(); }
    g.fillStyle = lt(0.3); g.beginPath(); g.ellipse(-2.4, -3, 2.6, 1.2, 0.2, 0, 7); g.fill();
    g.fillStyle = '#6b4a2a'; g.beginPath(); g.arc(5.4, 2.4, 1.2, 0, 7); g.arc(-6, 2, 1, 0, 7); g.fill();
  });
  set('baked_potato', (g, size, item) => {                        // split down the middle, fluffy inside, steaming
    g.fillStyle = item.color; g.beginPath(); g.ellipse(0, 1.4, 8, 5.4, 0.15, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#f6efd8';                                                                                        // the split
    g.beginPath(); g.moveTo(-5.4, 0.4); g.quadraticCurveTo(0, -2.4, 5.4, 1.4); g.quadraticCurveTo(0, 3.4, -5.4, 0.4); g.closePath(); g.fill(); line(g, dk(0.3), 1); g.stroke();
    g.fillStyle = '#e8c07a'; g.beginPath(); g.ellipse(0.4, 0.9, 2.4, 1.1, 0.1, 0, 7); g.fill();                     // the butter in it
    line(g, dk(0.28), 1.2); g.beginPath(); g.moveTo(-6.4, 3.4); g.quadraticCurveTo(0, 5.4, 6.4, 3); g.stroke();
    steam(g, -2.4);
  });
  set('bread', (g, size, item) => {                               // a cottage loaf, slashed across the top
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8.4, 4.4); g.quadraticCurveTo(-8.4, -4.4, 0, -5.4); g.quadraticCurveTo(8.4, -4.4, 8.4, 4.4);
    g.quadraticCurveTo(0, 6.4, -8.4, 4.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, '#8a5a2b', 1.6, 'round');                                                                               // the slashes
    for (const x of [-4.4, 0, 4.4]) { g.beginPath(); g.moveTo(x - 1.4, 1.4); g.lineTo(x + 1.4, -2.4); g.stroke(); }
    g.fillStyle = '#f0d8a8'; g.beginPath(); g.ellipse(0, 5, 7.4, 1.4, 0, 0, 7); g.fill();                           // the pale base
    g.fillStyle = lt(0.3); g.beginPath(); g.ellipse(-4.4, -3, 2.4, 1.1, -0.3, 0, 7); g.fill();
  });
  set('golden_bread', (g, size, item) => {                        // a plaited loaf, glazed, and it catches the light
    g.fillStyle = item.color;
    for (let k = 0; k < 4; k++) { const x = -6.4 + k * 4.2;                                                          // the strands of the plait
      g.beginPath(); g.ellipse(x, k % 2 ? 1.4 : -0.6, 3, 4.4, k % 2 ? 0.5 : -0.5, 0, 7); g.fill(); line(g, OUT, 1.1); g.stroke(); g.fillStyle = item.color; }
    g.fillStyle = lt(0.4);
    for (let k = 0; k < 4; k++) { const x = -6.4 + k * 4.2; g.beginPath(); g.ellipse(x - 0.6, (k % 2 ? 1.4 : -0.6) - 1.4, 1.4, 1.6, k % 2 ? 0.5 : -0.5, 0, 7); g.fill(); }
    g.fillStyle = '#fff6c8'; for (const [x, y, r] of [[-7.4, -4.4, 1.2], [7.4, 4.4, 1.2], [2.4, -5.4, 1]]) {         // the shine on the glaze
      g.beginPath(); g.moveTo(x, y - r * 2.2); g.lineTo(x + r, y); g.lineTo(x, y + r * 2.2); g.lineTo(x - r, y); g.closePath(); g.fill(); }
  });
  set('flour', (g, size, item) => {                               // a sack, tied at the neck, with a scoop of it spilled
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, 7.4); g.lineTo(-5.4, -2.4); g.quadraticCurveTo(-4.4, -5.4, -2.4, -6.4);
    g.lineTo(2.4, -6.4); g.quadraticCurveTo(4.4, -5.4, 5.4, -2.4); g.lineTo(6.4, 7.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = CORD; g.fillRect(-4.4, -4.4, 8.8, 2.2);                                                            // the tie
    g.fillStyle = '#f6f2e6'; g.beginPath(); g.moveTo(-2.4, -6.4); g.quadraticCurveTo(0, -8.4, 2.4, -6.4); g.closePath(); g.fill();
    g.fillStyle = '#8a6a3a'; g.beginPath(); g.ellipse(0, 2.4, 3, 2.4, 0, 0, 7); g.fill();                            // the stamp on the sack
    g.fillStyle = item.color; g.beginPath(); g.ellipse(0, 2.4, 1.6, 1.2, 0, 0, 7); g.fill();
    g.fillStyle = '#f6f2e6'; g.beginPath(); g.ellipse(-6.4, 8.2, 3.4, 1.2, 0, 0, 7); g.fill();                       // what spilled
  });
  set('meat_pie', (g, size, item) => {                            // in its tin, crimped all round, one vent cut in the lid
    g.fillStyle = '#8f96a3'; g.beginPath(); g.moveTo(-8.4, 2.4); g.lineTo(8.4, 2.4); g.lineTo(6.4, 7.4); g.lineTo(-6.4, 7.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = item.color; g.beginPath(); g.ellipse(0, 1.4, 8.4, 4.4, 0, Math.PI, 0); g.fill(); g.stroke();
    g.fillStyle = dk(0.22); for (let k = 0; k < 7; k++) { const x = -7.2 + k * 2.4; g.beginPath(); g.arc(x, 1.4, 1.2, Math.PI, 0); g.fill(); }   // the crimp
    line(g, dk(0.4), 1.4, 'round');                                                                                  // the vent
    g.beginPath(); g.moveTo(-1.4, -1.4); g.lineTo(1.4, -1.4); g.moveTo(0, -2.8); g.lineTo(0, 0); g.stroke();
    steam(g, -3.4);
  });
  set('berry_pie', (g, size, item) => {                           // a lattice top, with the fruit showing through the gaps
    g.fillStyle = '#c98a3a'; g.beginPath(); g.ellipse(0, 1.4, 8.6, 6.4, 0, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = item.color; g.beginPath(); g.ellipse(0, 1.4, 6.4, 4.6, 0, 0, 7); g.fill();
    line(g, '#e8c07a', 1.6);                                                                                         // the lattice
    for (const d of [-3.4, 0, 3.4]) { g.beginPath(); g.moveTo(-5.4 + d, -3.4); g.lineTo(2.4 + d, 5.4); g.stroke(); }
    for (const d of [-3.4, 0, 3.4]) { g.beginPath(); g.moveTo(5.4 - d, -3.4); g.lineTo(-2.4 - d, 5.4); g.stroke(); }
    g.fillStyle = item.color; for (const [x, y] of [[-2.4, 0.4], [2.4, 2.4]]) { g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.fill(); }
    g.fillStyle = '#e8c07a'; g.beginPath(); g.ellipse(0, 6.4, 8, 1.6, 0, 0, 7); g.fill();
  });
  set('fish_pie', (g, size, item) => {                            // baked with the fish still looking out of the crust
    g.fillStyle = item.color; g.beginPath(); g.ellipse(0, 3.4, 8.6, 5, 0, Math.PI, 0); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#8a5a2b'; g.beginPath(); g.moveTo(-8.6, 3.4); g.lineTo(8.6, 3.4); g.lineTo(7.4, 7.4); g.lineTo(-7.4, 7.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#9fb7c9';                                                                                          // the fish, head up out of the lid
    g.beginPath(); g.moveTo(-3.4, -0.4); g.quadraticCurveTo(-2.4, -6.4, 1.4, -7.4); g.quadraticCurveTo(4.4, -6.4, 3.4, -0.4); g.closePath(); g.fill(); line(g, OUT, 1.1); g.stroke();
    g.fillStyle = '#1a1a1f'; g.beginPath(); g.arc(1.4, -5, 1.1, 0, 7); g.fill();
    line(g, dk(0.5), 1.2, 'round'); g.beginPath(); g.moveTo(-1.4, -6.4); g.lineTo(2.4, -6.8); g.stroke();
    g.fillStyle = dk(0.22); for (let k = 0; k < 6; k++) { const x = -6.4 + k * 2.6; g.beginPath(); g.arc(x, 3.4, 1.2, Math.PI, 0); g.fill(); }
  });

  // ==========================================================================
  // LOGS — three trees, three logs. A clean stick of firewood, a knotty oak round, a jungle log with the
  // creeper still wound round it.
  // ==========================================================================
  set('wood', (g, size, item) => {                                // a straight billet, sawn square, rings on the end
    g.save(); g.rotate(-0.5);
    g.fillStyle = item.color; g.fillRect(-9.4, -3.4, 18.8, 6.8); line(g, OUT, 1.2); g.strokeRect(-9.4, -3.4, 18.8, 6.8);
    g.fillStyle = '#e8d3a8'; g.beginPath(); g.ellipse(9.4, 0, 2.2, 3.4, 0, 0, 7); g.fill(); g.stroke();
    line(g, '#a8886a', 1.1); g.beginPath(); g.ellipse(9.4, 0, 1.2, 1.8, 0, 0, 7); g.stroke();                     // the rings
    line(g, dk(0.28), 1.1);                                                                                       // the bark
    g.beginPath(); g.moveTo(-8.4, -1.4); g.lineTo(6.4, -1.4); g.moveTo(-8.4, 1.4); g.lineTo(6.4, 1.4); g.stroke();
    g.restore();
  });
  set('oak_log', (g, size, item) => {                             // a heavy round: thick bark plates, a knot, a split across the end
    g.save(); g.rotate(-0.5);
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-9, -4.2); g.lineTo(7.4, -4.2); g.quadraticCurveTo(9.4, 0, 7.4, 4.2); g.lineTo(-9, 4.2);
    g.quadraticCurveTo(-10.4, 0, -9, -4.2); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#e2c79a'; g.beginPath(); g.ellipse(7.4, 0, 2.4, 4.2, 0, 0, 7); g.fill(); g.stroke();
    line(g, dk(0.4), 1.2); g.beginPath(); g.moveTo(6, -3); g.lineTo(8.4, 2.4); g.stroke();                        // the split
    g.fillStyle = dk(0.3);                                                                                        // the bark plates
    for (const [x, y] of [[-6.4, -2.4], [-2.4, 1.4], [1.4, -2.6], [3.4, 2.4], [-6, 2.6]]) { g.beginPath(); g.ellipse(x, y, 2, 1.1, 0.2, 0, 7); g.fill(); }
    g.fillStyle = '#4a3218'; g.beginPath(); g.arc(-3.4, -1.4, 1.4, 0, 7); g.fill();                               // the knot
    g.restore();
  });
  set('jungle_log', (g, size, item) => {                          // still tied to the canopy: a creeper round it and one broad leaf
    g.save(); g.rotate(-0.5);
    g.fillStyle = item.color; g.fillRect(-9, -3.6, 17.6, 7.2); line(g, OUT, 1.2); g.strokeRect(-9, -3.6, 17.6, 7.2);
    g.fillStyle = '#8a6a4a'; g.beginPath(); g.ellipse(8.6, 0, 2.2, 3.6, 0, 0, 7); g.fill(); g.stroke();
    line(g, '#3f7d2b', 1.6);                                                                                      // the creeper, wound over and under
    for (const x of [-6.4, -1.4, 3.4]) { g.beginPath(); g.arc(x, -3.6, 2.4, 0.2, 2.94); g.stroke(); }
    g.fillStyle = '#4f9a3a';
    g.beginPath(); g.moveTo(-4.4, -3.6); g.quadraticCurveTo(-7.4, -6.6, -3.4, -8.2); g.quadraticCurveTo(-1.4, -6.4, -2.4, -3.6); g.closePath(); g.fill();
    line(g, dk(0.3), 1); g.beginPath(); g.moveTo(-3.4, -3.8); g.lineTo(-4.4, -7.8); g.stroke();
    g.restore();
  });

  // ==========================================================================
  // ROCKS AND ORES — eight, and the ore is what is IN the rock, so the rock is drawn around it: rusty bands,
  // blue crystal points, a glassy shard, a cubic crystal, a molten core, a violet spike.
  // ==========================================================================
  const cobble = (g, col) => {                                    // the plain rock every ore is chipped out of
    g.fillStyle = col; g.beginPath();
    for (const [px, py] of [[-8.4, 2.4], [-6.4, -3.4], [-1.4, -7.4], [4.4, -6.4], [8.4, -0.4], [6.4, 5.4], [0.4, 7.4], [-5.4, 6.4]]) g.lineTo(px, py);
    g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
  };
  set('stone', (g, size, item) => {                               // nothing in it. A chip off it, and the shadow under it
    cobble(g, item.color);
    g.fillStyle = lt(0.28); g.beginPath(); g.moveTo(-5.4, -2.4); g.lineTo(-1.4, -6); g.lineTo(2.4, -4.4); g.lineTo(-2.4, 0.4); g.closePath(); g.fill();
    g.fillStyle = dk(0.24); g.beginPath(); g.moveTo(2.4, 2.4); g.lineTo(7, 0.4); g.lineTo(5.4, 4.4); g.lineTo(0.4, 6); g.closePath(); g.fill();
    line(g, dk(0.35), 1.2); g.beginPath(); g.moveTo(-2.4, 0.4); g.lineTo(2.4, 2.4); g.stroke();
  });
  set('iron_ore', (g, size, item) => {                            // rust running in bands through the broken face
    cobble(g, item.color);
    g.fillStyle = '#a8562a';
    g.beginPath(); g.moveTo(-6.4, -1.4); g.quadraticCurveTo(-1.4, -3.4, 4.4, -4.4); g.quadraticCurveTo(-1.4, -0.4, -6, 1.4); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-4.4, 3.4); g.quadraticCurveTo(0.4, 2.4, 5.4, 0.4); g.quadraticCurveTo(0.4, 5.4, -4, 5.4); g.closePath(); g.fill();
    g.fillStyle = '#e08a4a'; g.beginPath(); g.arc(1.4, -2.4, 1.2, 0, 7); g.arc(-2.4, 4.2, 1, 0, 7); g.fill();
  });
  set('coal', (g, size, item) => {                                // not one rock: a handful of black lumps with a glassy shine
    for (const [x, y, r, a] of [[-4.4, 2.4, 4.4, 0.3], [3.4, 3.4, 4, -0.4], [-0.4, -3.4, 4.6, 0.2]]) {
      g.fillStyle = item.color; g.beginPath();
      for (let k = 0; k < 6; k++) { const t = a + k / 6 * Math.PI * 2; g.lineTo(x + Math.cos(t) * r * (k % 2 ? 0.78 : 1), y + Math.sin(t) * r * (k % 2 ? 1 : 0.8)); }
      g.closePath(); g.fill(); line(g, 'rgba(120,120,132,0.7)', 1.1); g.stroke();
      g.fillStyle = lt(0.24); g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.4); g.lineTo(x, y - r * 0.7); g.lineTo(x + r * 0.2, y - r * 0.1); g.closePath(); g.fill();
    }
  });
  set('mithril_ore', (g, size, item) => {                         // blue crystal growing straight out of the stone
    cobble(g, '#5d6470');
    g.fillStyle = item.color;
    for (const [x, y, w, h] of [[-3.4, -1.4, 2.4, 6.4], [1, -3.4, 2.6, 7.4], [4.4, 0.4, 2, 5]]) {
      g.beginPath(); g.moveTo(x - w / 2, y + h / 2); g.lineTo(x - w / 2, y - h / 2 + 1.4); g.lineTo(x, y - h / 2);
      g.lineTo(x + w / 2, y - h / 2 + 1.4); g.lineTo(x + w / 2, y + h / 2); g.closePath(); g.fill(); line(g, OUT, 1.1); g.stroke(); g.fillStyle = item.color; }
    g.fillStyle = lt(0.45); g.beginPath(); g.moveTo(0.2, -6.8); g.lineTo(1.2, -6.2); g.lineTo(1.2, -1.4); g.lineTo(0.2, -1.4); g.closePath(); g.fill();
  });
  set('obsidian', (g, size, item) => {                            // volcanic glass: one shard, sharp all the way round
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-2.4, -8.4); g.lineTo(5.4, -4.4); g.lineTo(8.4, 3.4); g.lineTo(1.4, 8.4);
    g.lineTo(-6.4, 5.4); g.lineTo(-8.4, -2.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = lt(0.22);                                                                                        // the flat faces the glass broke along
    g.beginPath(); g.moveTo(-2.4, -8.4); g.lineTo(5.4, -4.4); g.lineTo(0.4, 1.4); g.lineTo(-8.4, -2.4); g.closePath(); g.fill();
    g.fillStyle = lt(0.12); g.beginPath(); g.moveTo(0.4, 1.4); g.lineTo(8.4, 3.4); g.lineTo(1.4, 8.4); g.closePath(); g.fill();
    g.fillStyle = '#c9a7ff'; g.beginPath(); g.moveTo(-1.4, -6.4); g.lineTo(2.4, -4.4); g.lineTo(-0.6, -2.4); g.closePath(); g.fill();
  });
  set('blackiron_ore', (g, size, item) => {                       // a cubic crystal set in a sooty rock
    cobble(g, item.color);
    g.fillStyle = '#8f96a3';                                                                                       // the cube, drawn in three faces
    g.beginPath(); g.moveTo(-1.4, -3.4); g.lineTo(3.4, -4.4); g.lineTo(3.4, 0.4); g.lineTo(-1.4, 1.4); g.closePath(); g.fill(); line(g, OUT, 1.1); g.stroke();
    g.fillStyle = '#b6bdc6'; g.beginPath(); g.moveTo(-1.4, -3.4); g.lineTo(0.4, -6.4); g.lineTo(5.4, -7); g.lineTo(3.4, -4.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#6a7078'; g.beginPath(); g.moveTo(3.4, -4.4); g.lineTo(5.4, -7); g.lineTo(5.4, -2.4); g.lineTo(3.4, 0.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = dk(0.4); for (const [x, y] of [[-5.4, 2.4], [-2.4, 5.4], [3.4, 4.4]]) { g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.fill(); }
  });
  set('sunstone_ore', (g, size, item) => {                        // split open, and it is still hot inside
    cobble(g, '#6a5a48');
    g.fillStyle = item.color;                                                                                      // the molten core
    g.beginPath(); g.moveTo(-5.4, 0.4); g.lineTo(-1.4, -4.4); g.lineTo(2.4, -1.4); g.lineTo(5.4, -3.4);
    g.lineTo(4.4, 3.4); g.lineTo(-0.4, 1.4); g.lineTo(-2.4, 5.4); g.closePath(); g.fill();
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.moveTo(-2.4, 0.4); g.lineTo(0.4, -2.4); g.lineTo(2.4, 0.4); g.lineTo(0.4, 2.4); g.closePath(); g.fill();
    line(g, '#ffb347', 1.2, 'round');                                                                              // heat coming out of the cracks
    g.beginPath(); g.moveTo(-4.4, -3.4); g.lineTo(-6.4, -6.4); g.moveTo(4.4, -4.4); g.lineTo(6.4, -7.4); g.stroke();
  });
  set('stormstone_ore', (g, size, item) => {                      // a violet spike out of the rock, throwing static
    cobble(g, '#48445c');
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-1.4, 4.4); g.lineTo(-2.4, -1.4); g.lineTo(0.4, -7.4); g.lineTo(3.4, -1.4); g.lineTo(2.4, 4.4); g.closePath(); g.fill(); line(g, OUT, 1.1); g.stroke();
    g.fillStyle = lt(0.42); g.beginPath(); g.moveTo(0.4, -7.4); g.lineTo(1.6, -2.4); g.lineTo(0.6, 3.4); g.lineTo(-0.4, -2.4); g.closePath(); g.fill();
    g.fillStyle = '#e0d4ff';                                                                                       // the arcs jumping off it
    g.beginPath(); g.moveTo(4.4, -4.4); g.lineTo(7.4, -6.4); g.lineTo(5.6, -4); g.lineTo(8.4, -3.4); g.lineTo(4.6, -2.4); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-3.4, -2.4); g.lineTo(-6.4, -4.4); g.lineTo(-4.8, -2); g.lineTo(-7.4, -0.4); g.lineTo(-3.6, -0.4); g.closePath(); g.fill();
  });

  // ==========================================================================
  // BARS AND PLATE — eight things that were one ingot: a single bar, a stack of two, a tall slender bar, a
  // rough billet, a bar still glowing, a bar throwing arcs, a hammered scale plate, and a twisted grave rail.
  // ==========================================================================
  set('iron_bar', (g, size, item) => {                            // one ingot, cast in a mould, nothing more
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8.4, 4.4); g.lineTo(-5.4, -3.4); g.lineTo(6.4, -3.4); g.lineTo(9.4, 4.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = lt(0.34); g.fillRect(-4.4, -2.4, 9.4, 2.4);
    g.fillStyle = dk(0.24); g.beginPath(); g.moveTo(-8, 4); g.lineTo(9, 4); g.lineTo(9.2, 4.4); g.lineTo(-8.2, 4.4); g.closePath(); g.fill();
  });
  set('steel_bar', (g, size, item) => {                           // two, stacked, and the top one overhangs
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8.4, 7.4); g.lineTo(-6, 1.4); g.lineTo(5.4, 1.4); g.lineTo(7.8, 7.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.beginPath(); g.moveTo(-5.4, 0.4); g.lineTo(-3.4, -5.4); g.lineTo(8, -5.4); g.lineTo(10, 0.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = lt(0.4); g.fillRect(-2.4, -4.4, 9.4, 2.2);
    g.fillStyle = lt(0.2); g.fillRect(-4.4, 2.4, 8.4, 2);
  });
  set('mithril_bar', (g, size, item) => {                         // slender, stood on end, stamped with the smith's mark
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-4.4, -8.4); g.lineTo(4.4, -8.4); g.lineTo(5.4, 8.4); g.lineTo(-5.4, 8.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = lt(0.36); g.beginPath(); g.moveTo(-3.4, -7.4); g.lineTo(-1, -7.4); g.lineTo(-1.6, 7.4); g.lineTo(-4.4, 7.4); g.closePath(); g.fill();
    g.fillStyle = dk(0.3); g.beginPath(); g.arc(1.4, -3.4, 2, 0, 7); g.fill();                                     // the stamp
    g.fillStyle = item.color; g.beginPath(); g.moveTo(1.4, -5); g.lineTo(2.8, -2.4); g.lineTo(0, -2.4); g.closePath(); g.fill();
    line(g, dk(0.28), 1.2); g.beginPath(); g.moveTo(-5, 4.4); g.lineTo(5, 4.4); g.stroke();
  });
  set('blackiron_bar', (g, size, item) => {                       // a rough billet, straight off the hammer, one corner knocked off
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8.4, 5.4); g.lineTo(-7.4, -2.4); g.lineTo(-3.4, -4.4); g.lineTo(6.4, -4.4);
    g.lineTo(8.4, -1.4); g.lineTo(7.4, 5.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = dk(0.36);                                                                                        // slag pits
    for (const [x, y] of [[-4.4, 0.4], [1.4, 2.4], [4.4, -1.4]]) { g.beginPath(); g.ellipse(x, y, 1.6, 1.1, 0.3, 0, 7); g.fill(); }
    g.fillStyle = lt(0.24); g.beginPath(); g.moveTo(-3.4, -3.4); g.lineTo(5.4, -3.4); g.lineTo(4.4, -1.4); g.lineTo(-4.4, -1.4); g.closePath(); g.fill();
    g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(6.4, -4.4); g.lineTo(8.4, -1.4); g.lineTo(5.4, -2); g.closePath(); g.fill();
  });
  set('sunstone_bar', (g, size, item) => {                        // it has not cooled: the underside is still orange and the heat rises off it
    g.fillStyle = '#ff8a2a';
    g.beginPath(); g.moveTo(-8.4, 6.4); g.lineTo(-6, 0.4); g.lineTo(6.4, 0.4); g.lineTo(8.8, 6.4); g.closePath(); g.fill();
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-7.6, 4.4); g.lineTo(-5.4, -1.4); g.lineTo(6, -1.4); g.lineTo(8, 4.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#fff0c0'; g.fillRect(-4.4, -0.4, 9.4, 2.2);
    line(g, 'rgba(255,180,71,0.75)', 1.2, 'round');                                                                 // the shimmer coming off it
    g.beginPath(); g.moveTo(-4.4, -3.4); g.quadraticCurveTo(-6.4, -5.4, -4.4, -7.4);
    g.moveTo(1.4, -3.4); g.quadraticCurveTo(-0.6, -5.4, 1.4, -7.4);
    g.moveTo(6.4, -3.4); g.quadraticCurveTo(4.4, -5.4, 6.4, -7.4); g.stroke();
  });
  set('stormstone_bar', (g, size, item) => {                      // an ingot with the charge still in it, arcing across the top
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8.4, 6.4); g.lineTo(-5.4, -0.4); g.lineTo(6.4, -0.4); g.lineTo(9.4, 6.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = lt(0.3); g.fillRect(-4.4, 0.6, 9.4, 2.2);
    g.fillStyle = '#efe6ff';                                                                                        // the arc between its two ends
    g.beginPath(); g.moveTo(-6.4, -1.4); g.lineTo(-2.4, -5.4); g.lineTo(-3.4, -2.4); g.lineTo(0.4, -6.4);
    g.lineTo(-0.4, -3.4); g.lineTo(3.4, -7.4); g.lineTo(1.4, -2.4); g.lineTo(5.4, -5.4); g.lineTo(4.4, -1.4); g.closePath(); g.fill();
    g.fillStyle = '#efe6ff'; g.beginPath(); g.arc(-6.4, -1.4, 1.2, 0, 7); g.arc(5.4, -1.4, 1.2, 0, 7); g.fill();
  });
  set('scale_plate', (g, size, item) => {                         // not an ingot: a plate hammered flat out of dragon scales
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8.4, -4.4); g.quadraticCurveTo(0, -6.4, 8.4, -4.4); g.quadraticCurveTo(9, 0.4, 8.4, 5.4);
    g.quadraticCurveTo(0, 7.4, -8.4, 5.4); g.quadraticCurveTo(-9, 0.4, -8.4, -4.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, dk(0.34), 1.1);                                                                                         // the scales it was beaten out of
    for (let r = 0; r < 3; r++) { const y = -3 + r * 3, n = 4 - (r % 2), off = (r % 2) ? 2 : 0;
      for (let k = 0; k < n; k++) { g.beginPath(); g.arc(-6 + off + k * 4, y, 2, 0, Math.PI); g.stroke(); } }
    g.fillStyle = lt(0.28); g.beginPath(); g.ellipse(-4.4, -3, 2.4, 1.1, 0.1, 0, 7); g.fill();
  });
  set('grave_iron', (g, size, item) => {                          // a railing off a grave: bent, pitted, and it still has its finial
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-2.6, -4.4); g.quadraticCurveTo(-4.4, 1.4, -1.4, 7.4); g.lineTo(1.6, 7.4);
    g.quadraticCurveTo(-1.4, 1.4, 0.4, -4.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.beginPath(); g.moveTo(-1.4, -4.4); g.lineTo(-3.4, -6.4); g.lineTo(-0.6, -8.6); g.lineTo(2.4, -6.4); g.lineTo(0.4, -4.4); g.closePath(); g.fill(); g.stroke();  // the finial
    g.fillStyle = '#5a4436'; for (const [x, y] of [[-2.4, 0.4], [-0.4, 3.4], [-2.4, 5.4]]) { g.beginPath(); g.arc(x, y, 1.1, 0, 7); g.fill(); }  // the rust pits
    g.fillStyle = item.color;                                                                                        // the cross-bar it was cut from
    g.beginPath(); g.moveTo(-8.4, -1.4); g.lineTo(8.4, -2.4); g.lineTo(8.4, 0.4); g.lineTo(-8.4, 1.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
  });

  // ==========================================================================
  // THE REST — coins, timber, furniture, hides and horn, cloth, and the six powders that were all the same
  // little sack. A salve is a tin, dust is a vial, essence is a flask, a poultice is a bandage, compost is
  // an open sack of earth. Different containers, because that is what tells them apart in the pack.
  // ==========================================================================
  set('coins', (g, size, item) => {                               // a stack with one coin fallen off the top of it, struck with a crown
    g.fillStyle = '#a8801e';
    for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(-2.4, 5.4 - k * 2.2, 6.4, 2.6, 0, 0, 7); g.fill(); line(g, dk(0.3), 1); g.stroke(); }
    g.fillStyle = item.color; g.beginPath(); g.ellipse(-2.4, -1.4, 6.4, 2.6, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = item.color; g.beginPath(); g.arc(4.4, -3.4, 4.6, 0, 7); g.fill(); line(g, '#a8801e', 1.2); g.stroke();  // the one stood on its edge
    g.fillStyle = '#a8801e'; g.beginPath(); g.moveTo(2, -4.4); g.lineTo(3, -2.4); g.lineTo(4.4, -4.4);
    g.lineTo(5.8, -2.4); g.lineTo(6.8, -4.4); g.lineTo(6.4, -1.4); g.lineTo(2.4, -1.4); g.closePath(); g.fill();
    g.fillStyle = lt(0.4); g.beginPath(); g.ellipse(-4.4, -1.8, 2, 1, 0, 0, 7); g.fill();
  });
  set('plank', (g, size, item) => {                               // a sawn board: end grain, and two nails already in it
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-9.4, -4.4); g.lineTo(9.4, -3.4); g.lineTo(9.4, 3.4); g.lineTo(-9.4, 4.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, '#a8804a', 1.2);                                                                                       // the grain
    g.beginPath(); g.moveTo(-8.4, -1.4); g.quadraticCurveTo(0, -2.4, 8.4, -1); g.moveTo(-8.4, 1.6); g.quadraticCurveTo(0, 0.6, 8.4, 1.6); g.stroke();
    g.fillStyle = '#4a3218'; g.beginPath(); g.arc(-5.4, 0.4, 1.2, 0, 7); g.fill();                                  // the knot
    g.fillStyle = '#8f96a3'; for (const x of [1.4, 6.4]) { g.beginPath(); g.arc(x, -0.4, 1.1, 0, 7); g.fill(); }     // the nails
    g.fillStyle = dk(0.22); g.beginPath(); g.moveTo(-9.4, 3.4); g.lineTo(9.4, 2.4); g.lineTo(9.4, 3.4); g.lineTo(-9.4, 4.4); g.closePath(); g.fill();
  });
  set('door', (g, size, item) => {                                // planks, two iron straps, a ring to pull it, and a barred window
    g.fillStyle = item.color; g.fillRect(-6.4, -8.4, 12.8, 17); line(g, OUT, 1.2); g.strokeRect(-6.4, -8.4, 12.8, 17);
    line(g, dk(0.32), 1.2);
    for (const x of [-2.2, 2.2]) { g.beginPath(); g.moveTo(x, -8.4); g.lineTo(x, 8.6); g.stroke(); }                 // the plank joins
    g.fillStyle = '#3d434d'; g.fillRect(-6.4, -6, 12.8, 2.2); g.fillRect(-6.4, 5, 12.8, 2.2);                        // the straps
    g.fillStyle = '#1a1d22'; g.fillRect(-3.4, -2.4, 6.8, 4.4);                                                       // the window
    line(g, '#3d434d', 1.2); g.beginPath(); g.moveTo(0, -2.4); g.lineTo(0, 2); g.moveTo(-3.4, -0.2); g.lineTo(3.4, -0.2); g.stroke();
    line(g, '#f5c542', 1.4); g.beginPath(); g.arc(4.4, 3.4, 1.6, 0, 7); g.stroke();                                  // the ring
  });
  set('bed', (g, size, item) => {                                 // side on: headboard, pillow, blanket turned back, four legs
    g.fillStyle = '#5a3a1e';
    g.fillRect(-9, -6.4, 2.6, 12.8); g.fillRect(7, -1.4, 2, 7.8);                                                    // head and foot
    g.fillRect(-8.4, 1.4, 16.8, 2.4); line(g, OUT, 1.2); g.strokeRect(-8.4, 1.4, 16.8, 2.4);
    g.fillRect(-7.4, 5.4, 2.2, 3.4); g.fillRect(5.4, 5.4, 2.2, 3.4);                                                 // legs
    g.fillStyle = '#f2f2ec'; g.beginPath(); g.ellipse(-4.4, -0.6, 3.6, 2.2, -0.1, 0, 7); g.fill(); line(g, dk(0.3), 1); g.stroke();  // the pillow
    g.fillStyle = item.color; g.beginPath(); g.moveTo(-1.4, 1.4); g.lineTo(8.4, 1.4); g.lineTo(8.4, -1.4);
    g.quadraticCurveTo(3.4, -3.4, -1.4, -1.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();               // the blanket
    line(g, dk(0.25), 1.2); g.beginPath(); g.moveTo(2.4, -2.4); g.lineTo(2.4, 1.4); g.moveTo(5.4, -2.2); g.lineTo(5.4, 1.4); g.stroke();
  });
  set('lodestone', (g, size, item) => {                           // a standing stone with a lit crystal set in it, and the light on the ground
    g.fillStyle = 'rgba(126,200,255,0.28)'; g.beginPath(); g.ellipse(0, 7.4, 7.4, 2.2, 0, 0, 7); g.fill();
    g.fillStyle = '#4a5a72';
    g.beginPath(); g.moveTo(-5.4, 7.4); g.lineTo(-3.4, -6.4); g.lineTo(0, -8.6); g.lineTo(3.4, -6.4); g.lineTo(5.4, 7.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = item.color; g.beginPath(); g.moveTo(0, -4.4); g.lineTo(2.4, -0.4); g.lineTo(0, 3.4); g.lineTo(-2.4, -0.4); g.closePath(); g.fill();  // the crystal
    g.fillStyle = lt(0.55); g.beginPath(); g.moveTo(0, -4.4); g.lineTo(1.1, -0.4); g.lineTo(0, 1.4); g.lineTo(-1.1, -0.4); g.closePath(); g.fill();
    line(g, item.color, 1.2);                                                                                        // the marks cut into the stone
    g.beginPath(); g.moveTo(-3, 4.4); g.lineTo(-1.4, 5.4); g.moveTo(3, 4.4); g.lineTo(1.4, 5.4); g.stroke();
  });
  set('workbench', (g, size, item) => {                           // a bench with a vice on the end and a saw laid across it
    g.fillStyle = item.color; g.fillRect(-9.4, -2.4, 18.8, 3.4); line(g, OUT, 1.2); g.strokeRect(-9.4, -2.4, 18.8, 3.4);
    g.fillStyle = WOOD_D; g.fillRect(-7.4, 1, 2.6, 7.4); g.fillRect(4.8, 1, 2.6, 7.4);                                 // the legs
    g.fillRect(-6, 5.4, 12, 2.2);                                                                                      // the stretcher
    g.fillStyle = '#5a5a62'; g.fillRect(-9.4, -0.4, 3.4, 4.4); line(g, OUT, 1.1); g.strokeRect(-9.4, -0.4, 3.4, 4.4);   // the vice
    line(g, '#8f96a3', 1.3); g.beginPath(); g.moveTo(-7.6, 4); g.lineTo(-7.6, 6.4); g.stroke();
    g.fillStyle = '#c9d1d9';                                                                                            // the saw on the top
    g.beginPath(); g.moveTo(-2.4, -4.4); g.lineTo(7.4, -6.4); g.lineTo(7.8, -4.4); g.lineTo(-2.4, -2.6); g.closePath(); g.fill(); line(g, OUT, 1.1); g.stroke();
    g.fillStyle = GRIP; g.fillRect(-6.4, -5.4, 4.4, 2.6);
  });
  set('spider_silk', (g, size, item) => {                         // a hank of thread wound in a figure of eight, with a loose end
    g.fillStyle = item.color;
    g.beginPath(); g.ellipse(-3.4, -3, 4.4, 3.4, -0.5, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.beginPath(); g.ellipse(3.4, 3, 4.4, 3.4, -0.5, 0, 7); g.fill(); g.stroke();
    g.fillStyle = item.color; g.beginPath(); g.ellipse(0, 0, 3, 2, -0.5, 0, 7); g.fill(); g.stroke();
    line(g, dk(0.25), 1.1);                                                                                            // the winding
    for (const [x, y] of [[-4.4, -3.6], [-2.4, -2.2], [2.4, 2.2], [4.4, 3.6]]) { g.beginPath(); g.moveTo(x - 1.4, y - 1.6); g.lineTo(x + 1.4, y + 1.6); g.stroke(); }
    line(g, item.color, 1.2, 'round');                                                                                 // the end that never got wound in
    g.beginPath(); g.moveTo(6, 5.4); g.quadraticCurveTo(8.4, 7.4, 6.4, 8.8); g.stroke();
  });
  set('wool', (g, size, item) => {                                // a fleece, rolled and tied once round the middle
    g.fillStyle = item.color;
    g.beginPath();
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, r = 7.4 + (k % 2 ? -1.4 : 0.8);
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.86); }
    g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, dk(0.22), 1.2);                                                                                            // the curl of the fleece
    for (const [x, y] of [[-3.4, -2.4], [1.4, -3.4], [3.4, 1.4], [-2.4, 2.4]]) { g.beginPath(); g.arc(x, y, 2, 0.6, 4.4); g.stroke(); }
    g.fillStyle = CORD; g.fillRect(-8, -1.1, 16, 2.2); line(g, dk(0.35), 1); g.strokeRect(-8, -1.1, 16, 2.2);          // the tie
  });
  set('wolf_pelt', (g, size, item) => {                           // stretched out flat, head, four legs and the tail
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(0, -8.6); g.quadraticCurveTo(2.6, -7.4, 2.4, -5);
    g.lineTo(7.4, -6.4); g.lineTo(4.4, -1.4); g.quadraticCurveTo(5.4, 1.4, 4.4, 3.4);
    g.lineTo(7.4, 7.4); g.lineTo(2, 5.4); g.lineTo(1.4, 8.6); g.lineTo(-1.4, 8.6); g.lineTo(-2, 5.4);
    g.lineTo(-7.4, 7.4); g.lineTo(-4.4, 3.4); g.quadraticCurveTo(-5.4, 1.4, -4.4, -1.4);
    g.lineTo(-7.4, -6.4); g.lineTo(-2.4, -5); g.quadraticCurveTo(-2.6, -7.4, 0, -8.6); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = lt(0.24); g.beginPath(); g.ellipse(0, 1.4, 2.2, 4.4, 0, 0, 7); g.fill();                             // the pale belly
    g.fillStyle = '#1a1a1f'; g.beginPath(); g.arc(-1.4, -6.4, 1, 0, 7); g.arc(1.4, -6.4, 1, 0, 7); g.fill();
  });
  set('boar_tusk', (g, size, item) => {                           // one tusk: a fat ridged root and a curve to a point
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-7.4, 7.4); g.quadraticCurveTo(-9, 0.4, -4.4, -4.4); g.quadraticCurveTo(1.4, -9, 8.4, -6.4);
    g.quadraticCurveTo(2.4, -5.4, -1.4, -1.4); g.quadraticCurveTo(-4.4, 2.4, -3.4, 7.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, dk(0.3), 1.2);                                                                                              // the growth ridges, thickest at the root
    for (const [x0, y0, x1, y1] of [[-7, 5.4, -3.6, 5.4], [-7.4, 2.4, -3.4, 3], [-6.6, -0.4, -2.4, 0.6]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    g.fillStyle = lt(0.4); g.beginPath(); g.moveTo(-3.4, -3.4); g.quadraticCurveTo(1.4, -7.4, 7, -6.2); g.quadraticCurveTo(1.4, -5.4, -2.4, -2.4); g.closePath(); g.fill();
  });
  set('dragon_bone', (g, size, item) => {                         // a long bone, knuckled at both ends, with the marrow line down it
    g.save(); g.rotate(-0.6);
    g.fillStyle = item.color; g.fillRect(-6.4, -2.2, 12.8, 4.4);
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 6.4, -2.2, 2.4, 0, 7); g.arc(s * 6.4, 2.2, 2.4, 0, 7); g.fill(); }
    line(g, OUT, 1.2);
    g.beginPath(); g.moveTo(-6.4, -4.4); g.lineTo(6.4, -4.4); g.moveTo(-6.4, 4.4); g.lineTo(6.4, 4.4); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 6.4, -2.2, 2.4, s > 0 ? -1.6 : 1.6, s > 0 ? 1.6 : 4.7); g.stroke();
      g.beginPath(); g.arc(s * 6.4, 2.2, 2.4, s > 0 ? -1.6 : 1.6, s > 0 ? 1.6 : 4.7); g.stroke(); }
    line(g, dk(0.24), 1.2); g.beginPath(); g.moveTo(-4.4, 0); g.lineTo(4.4, 0); g.stroke();
    g.restore();
  });
  set('dragon_horn', (g, size, item) => {                         // a horn off a dragon's head: heavy rings up a tapering spiral
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-6.4, 8.4); g.quadraticCurveTo(-8.4, 0.4, -3.4, -5.4); g.quadraticCurveTo(1.4, -9.4, 7.4, -8.4);
    g.quadraticCurveTo(2.4, -5.4, 0.4, -1.4); g.quadraticCurveTo(-1.6, 3.4, -1.4, 8.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, dk(0.34), 1.3);                                                                                             // the rings
    for (const [x0, y0, x1, y1] of [[-6, 6.4, -1.6, 6.4], [-6.6, 3.4, -1.4, 3.6], [-6.4, 0.4, -0.4, 1], [-5.4, -2.4, 1, -1.6], [-3.4, -4.6, 2.6, -3.8]]) {
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 1.2, x1, y1); g.stroke(); }
    g.fillStyle = dk(0.3); g.beginPath(); g.ellipse(-4, 8, 2.6, 1.2, 0, 0, 7); g.fill();                                // the hollow root
  });
  set('rotten_cloth', (g, size, item) => {                        // a rag: holes through it, threads hanging off the bottom
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-7.4, -6.4); g.lineTo(-2.4, -7.4); g.lineTo(3.4, -5.4); g.lineTo(7.4, -6.8);
    g.lineTo(6.4, 3.4); g.lineTo(2.4, 5.4); g.lineTo(-1.4, 3.4); g.lineTo(-6.4, 5.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = '#1a1d22';                                                                                             // the holes
    g.beginPath(); g.ellipse(-3.4, -2.4, 2, 1.6, 0.3, 0, 7); g.fill();
    g.beginPath(); g.ellipse(3, 0.4, 1.6, 1.2, -0.4, 0, 7); g.fill();
    line(g, dk(0.3), 1.1); g.beginPath(); g.moveTo(-6.4, -3.4); g.lineTo(-5.4, 3.4); g.moveTo(5.4, -4.4); g.lineTo(4.4, 2.4); g.stroke();
    line(g, item.color, 1.2, 'round');                                                                                   // the threads coming away
    g.beginPath(); g.moveTo(-4.4, 4.4); g.lineTo(-5, 8.4); g.moveTo(0.4, 4.4); g.lineTo(0.4, 8.4); g.moveTo(4.4, 4.4); g.lineTo(5.4, 8); g.stroke();
  });
  set('wind_flute', (g, size, item) => {                          // a flute, holes and all, and the wind it calls up
    g.save(); g.rotate(-0.35);
    g.fillStyle = item.color; g.fillRect(-9.4, -2, 17, 4); line(g, OUT, 1.2); g.strokeRect(-9.4, -2, 17, 4);
    g.beginPath(); g.ellipse(7.6, 0, 1.4, 2.4, 0, 0, 7); g.fill(); g.stroke();                                            // the bell
    g.fillStyle = '#2a2620'; for (const x of [-4.4, -1.4, 1.6, 4.4]) { g.beginPath(); g.arc(x, 0, 1.1, 0, 7); g.fill(); }  // the finger holes
    g.fillStyle = '#5a4a3a'; g.fillRect(-9.4, -2.2, 2.4, 4.4);
    g.restore();
    line(g, 'rgba(200,224,248,0.8)', 1.2, 'round');                                                                       // the wind coming out of it
    g.beginPath(); g.moveTo(4.4, -5.4); g.quadraticCurveTo(8.4, -6.4, 7.4, -8.4);
    g.moveTo(1.4, -7); g.quadraticCurveTo(5.4, -8.6, 4.4, -9.4); g.stroke();
  });

  // --- the six that were all the same little sack ---
  set('fireproof_salve', (g, size, item) => {                     // a flat tin with a screw lid, and a flame stamped into it
    g.fillStyle = '#8a6a4a'; g.beginPath(); g.ellipse(0, 3.4, 7.4, 3, 0, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillRect(-7.4, -1.4, 14.8, 4.8); g.strokeRect(-7.4, -1.4, 14.8, 4.8);
    g.fillStyle = '#a8865a'; g.beginPath(); g.ellipse(0, -1.4, 7.4, 3, 0, 0, 7); g.fill(); g.stroke();                    // the lid
    g.fillStyle = item.color;                                                                                              // the flame on it
    g.beginPath(); g.moveTo(0, 0.4); g.quadraticCurveTo(-3.4, -1.4, -1.6, -3.4); g.quadraticCurveTo(-1.4, -5.4, 0.4, -6.4);
    g.quadraticCurveTo(-0.4, -3.4, 1.4, -3.4); g.quadraticCurveTo(3.4, -1.4, 0, 0.4); g.closePath(); g.fill();
    g.fillStyle = lt(0.32); g.fillRect(-6.4, 0.4, 3, 2.2);
  });
  set('grave_dust', (g, size, item) => {                          // a stoppered vial with the ash settled in the bottom of it
    g.fillStyle = 'rgba(210,220,235,0.35)';
    g.beginPath(); g.moveTo(-3.4, -4.4); g.lineTo(3.4, -4.4); g.lineTo(4.4, 4.4); g.quadraticCurveTo(0, 8, -4.4, 4.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = item.color; g.beginPath(); g.moveTo(-4, 1.4); g.lineTo(4, 1.4); g.lineTo(4.4, 4.4); g.quadraticCurveTo(0, 8, -4.4, 4.4); g.closePath(); g.fill();
    g.fillStyle = '#8a6a4a'; g.fillRect(-2.4, -7.4, 4.8, 3.2); line(g, OUT, 1.1); g.strokeRect(-2.4, -7.4, 4.8, 3.2);      // the cork
    g.fillStyle = '#3d434d'; g.fillRect(-3.4, -5.4, 6.8, 2);                                                               // the collar
    g.fillStyle = lt(0.5); g.fillRect(-2.6, -2.4, 2, 5);
    g.fillStyle = item.color; for (const [x, y] of [[-1.4, -1.4], [1.6, -2.4]]) { g.beginPath(); g.arc(x, y, 1, 0, 7); g.fill(); }  // what is still floating
  });
  set('cloud_essence', (g, size, item) => {                       // a round flask with a live cloud shut inside it
    g.fillStyle = 'rgba(190,215,240,0.3)';
    g.beginPath(); g.arc(0, 2.4, 6.4, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = item.color;                                                                                              // the cloud
    for (const [x, y, r] of [[-2.4, 3.4, 2.6], [1.4, 2.4, 3], [3.4, 4.4, 2], [-0.4, 5.4, 2.2]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.fillStyle = lt(0.55); g.beginPath(); g.arc(-3, 0.4, 1.6, 0, 7); g.fill();
    g.fillStyle = 'rgba(190,215,240,0.5)'; g.fillRect(-2.4, -6.4, 4.8, 5.4); line(g, OUT, 1.2); g.strokeRect(-2.4, -6.4, 4.8, 5.4);  // the neck
    g.fillStyle = '#8a6a4a'; g.fillRect(-3.4, -8.6, 6.8, 2.6); g.strokeRect(-3.4, -8.6, 6.8, 2.6);
    line(g, '#e2ecf8', 1.2, 'round'); g.beginPath(); g.moveTo(-4.4, 1.4); g.quadraticCurveTo(-6, 4.4, -4.4, 6.4); g.stroke();
  });
  set('herb_poultice', (g, size, item) => {                       // a folded cloth, tied once, with the leaf still showing at the fold
    g.fillStyle = '#e6e0cc';
    g.beginPath(); g.moveTo(-7.4, -2.4); g.lineTo(0, -6.4); g.lineTo(7.4, -2.4); g.lineTo(6.4, 5.4);
    g.quadraticCurveTo(0, 7.4, -6.4, 5.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = item.color;                                                                                              // the leaf poking out of the fold
    g.beginPath(); g.moveTo(-1.4, -5.4); g.quadraticCurveTo(-5.4, -8.4, -1.4, -9.4); g.quadraticCurveTo(1.4, -8, 1.4, -5.4); g.closePath(); g.fill();
    line(g, dk(0.3), 1); g.beginPath(); g.moveTo(-0.4, -5.4); g.lineTo(-1.4, -8.8); g.stroke();
    g.fillStyle = CORD; g.fillRect(-7, 0.4, 14, 2.4); line(g, dk(0.3), 1); g.strokeRect(-7, 0.4, 14, 2.4);                  // the tie
    g.fillStyle = dk(0.2); g.beginPath(); g.ellipse(0, 4.4, 4.4, 1.6, 0, 0, 7); g.fill();
  });
  set('greater_poultice', (g, size, item) => {                    // a rolled bandage, bound twice, with two leaves worked into it
    g.fillStyle = '#f2ecd8';
    g.beginPath(); g.ellipse(0, 0.4, 6.4, 7.4, 0, 0, 7); g.fill(); line(g, OUT, 1.2); g.stroke();
    line(g, dk(0.22), 1.2);                                                                                                 // the roll of it
    for (const r of [4.4, 2.4]) { g.beginPath(); g.ellipse(0, 0.4, r, r * 1.15, 0, 0, 7); g.stroke(); }
    g.fillStyle = CORD; g.fillRect(-7, -3.4, 14, 2.2); g.fillRect(-7, 2.4, 14, 2.2);                                        // the two bindings
    line(g, dk(0.3), 1); g.strokeRect(-7, -3.4, 14, 2.2); g.strokeRect(-7, 2.4, 14, 2.2);
    g.fillStyle = item.color;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.4, -6.4); g.quadraticCurveTo(s * 6.4, -9.4, s * 7.4, -6.4);
      g.quadraticCurveTo(s * 4.4, -4.4, s * 1.4, -5.4); g.closePath(); g.fill(); }
  });
  set('rich_compost', (g, size, item) => {                        // an open sack of black earth, a sprout in it and a worm going back under
    g.fillStyle = '#6a5a44';
    g.beginPath(); g.moveTo(-6.4, -3.4); g.lineTo(-5.4, 7.4); g.lineTo(5.4, 7.4); g.lineTo(6.4, -3.4);
    g.lineTo(3.4, -5.4); g.lineTo(0, -3.4); g.lineTo(-3.4, -5.4); g.closePath(); g.fill(); line(g, OUT, 1.2); g.stroke();
    g.fillStyle = item.color;                                                                                                // the earth heaped above the rim
    g.beginPath(); g.moveTo(-5.4, -2.4); g.quadraticCurveTo(-2.4, -6.4, 0.4, -4.4); g.quadraticCurveTo(3.4, -6.4, 5.4, -2.4);
    g.quadraticCurveTo(0, -0.4, -5.4, -2.4); g.closePath(); g.fill();
    g.fillStyle = dk(0.35); for (const [x, y] of [[-2.4, -2.4], [2.4, -2], [0.4, -3.4]]) { g.beginPath(); g.arc(x, y, 1, 0, 7); g.fill(); }
    line(g, '#c9736b', 1.4, 'round');                                                                                        // the worm
    g.beginPath(); g.moveTo(-4.4, -3.4); g.quadraticCurveTo(-6.4, -6.4, -3.4, -7.4); g.stroke();
    line(g, '#6fc24a', 1.4, 'round'); g.beginPath(); g.moveTo(3.4, -4.4); g.lineTo(4.4, -8); g.stroke();                      // the sprout
    g.fillStyle = '#6fc24a'; g.beginPath(); g.ellipse(5.6, -8.4, 2, 1.2, 0.4, 0, 7); g.fill();
    g.fillStyle = dk(0.24); g.fillRect(-5.8, 3.4, 11.4, 2.2);
  });

  // ==========================================================================
  // THE PROOF
  // The owner's complaint was measurable, so the proof is measurable too. On master, ICONS.audit() reported
  // 193 items drawing 71 different pictures, with 148 items sharing one and 167 with no art of their own.
  // These checks fail on every one of those numbers, and pass only at 193 of 193.
  // ==========================================================================
  const FAMILIES = {
    'fish (7 animals, raw and cooked)': ['raw_shrimp', 'shrimp', 'raw_trout', 'trout', 'raw_pike', 'pike', 'raw_salmon', 'salmon', 'raw_swordfish', 'swordfish', 'raw_shark', 'shark', 'raw_lobster', 'lobster'],
    'helms': ['ruined_helm', 'bronze_helm', 'iron_helm', 'steel_helm', 'mithril_helm', 'godly_helm', 'scale_helm', 'gnash_crown', 'dragon_helm', 'obsidian_helm', 'blackiron_helm', 'sunstone_helm', 'stormstone_helm'],
    'bodies': ['ruined_body', 'bronze_body', 'iron_body', 'steel_body', 'silk_cloak', 'mithril_body', 'hover_armour', 'godly_body', 'shadow_cloak', 'dragon_body', 'blackiron_body', 'sunstone_body', 'stormstone_body'],
    'legs': ['bronze_legs', 'iron_legs', 'steel_legs', 'mithril_legs', 'godly_legs', 'blackiron_legs', 'sunstone_legs', 'stormstone_legs'],
    'shields': ['bronze_shield', 'iron_shield', 'steel_shield', 'mithril_shield', 'godly_shield', 'scale_shield', 'dragon_shield', 'sunstone_shield', 'stormstone_shield'],
    'swords': ['wooden_sword', 'iron_sword', 'steel_sword', 'mithril_sword', 'obsidian_blade', 'blackiron_sword', 'sunstone_sword', 'stormstone_sword'],
    'bars and plate': ['iron_bar', 'steel_bar', 'mithril_bar', 'scale_plate', 'grave_iron', 'blackiron_bar', 'sunstone_bar', 'stormstone_bar'],
    'rocks and ores': ['stone', 'iron_ore', 'coal', 'mithril_ore', 'obsidian', 'blackiron_ore', 'sunstone_ore', 'stormstone_ore'],
    'seeds and crops': ['potato_seed', 'wheat_seed', 'herb_seed', 'herbs', 'goldenwheat_seed', 'golden_wheat', 'dragonfruit_seed', 'cloudberry_seed', 'tree_sapling', 'oak_sapling'],
    'powders and remedies': ['fireproof_salve', 'grave_dust', 'cloud_essence', 'herb_poultice', 'greater_poultice', 'rich_compost'],
  };

  HOOKS.selfTest.push((check, F, h) => {
    // 1. THE GATE, from the other side: every item in the game has art of its own, and no two items draw the
    //    same picture. ICONS.audit() hashes what is actually painted and records colours by their place in the
    //    icon's own palette, so "the same drawing in another colour" counts as a duplicate, not as art.
    const a = ICONS.audit();
    check('icon art: all ' + a.total + ' items have their own icon, and no two draw the same picture',
      a.missing.length === 0 && a.duplicates.length === 0 && a.unique === a.total && a.implicated === 0 && ICONS.broken().length === 0,
      { total: a.total, distinctDrawings: a.unique, missingArt: a.missing.length, duplicatePairs: a.duplicates.length,
        stillSharing: a.implicated, threw: ICONS.broken().slice(0, 4), worst: a.groups.slice(0, 3).map(gr => gr.length + '×' + gr.slice(0, 3).join('/')) });

    // 2. every icon fits the 18-unit design box at both sizes it is drawn at — 13 px in the hotbar and 35 px
    //    in the pack panel — with no feature under the 2-unit minimum and no line thinner than 1 unit. Also
    //    that no icon changes with `size`: the hotbar and the panel must show the same picture.
    const over = [], tiny = [], thin = [], drift = [], threw = [], slight = [];
    for (const id of ICONS.ids()) {
      const small = ICONS.art(id, 13), big = ICONS.art(id, 35);
      if (small.threw || big.threw) { threw.push(id + ': ' + (small.threw || big.threw)); continue; }
      if (small.reach > ICONS.BOUND + 1e-6 || big.reach > ICONS.BOUND + 1e-6) over.push(id + ' ' + Math.max(small.reach, big.reach).toFixed(2));
      if (small.small.length) tiny.push(id + ' ' + small.small[0]);
      if (small.thin.length) thin.push(id + ' ' + small.thin[0]);
      if (small.hash !== big.hash) drift.push(id);
      if (small.reach < 6 || small.calls < 12) slight.push(id + ' reach ' + small.reach.toFixed(1) + ' calls ' + small.calls);  // and none of them is a dot in the corner
    }
    check('icon art: every icon fits its box at 13 px and 35 px, draws the same at both, and fills the slot',
      over.length === 0 && tiny.length === 0 && thin.length === 0 && drift.length === 0 && threw.length === 0 && slight.length === 0,
      { icons: ICONS.ids().length, outsideBox: over.slice(0, 4), underMinFeature: tiny.slice(0, 4), tooThin: thin.slice(0, 4),
        changesWithSize: drift.slice(0, 4), threw: threw.slice(0, 3), tooSlight: slight.slice(0, 4) });

    // 3. the families the owner named. Each of these drew ONE picture on master: fourteen fish were one fish,
    //    thirteen helms were one helm. Every member must now differ from every other member of its family.
    const clashes = [];
    for (const name in FAMILIES) {
      const ids = FAMILIES[name], seen = new Map();
      for (const id of ids) { const hh = ICONS.record(id).hash; if (seen.has(hh)) clashes.push(name + ': ' + seen.get(hh) + ' = ' + id); else seen.set(hh, id); }
    }
    const counted = Object.keys(FAMILIES).reduce((n, k) => n + FAMILIES[k].length, 0);
    check('icon art: the families that shared one drawing — fish, helms, bodies, legs, shields, swords, bars, ores, seeds, remedies — are all different now',
      clashes.length === 0 && counted === 97 && Object.keys(FAMILIES).every(k => FAMILIES[k].every(id => ICONS.has(id))),
      { families: Object.keys(FAMILIES).length, itemsCovered: counted, clashes: clashes.slice(0, 5) });
  });
}
