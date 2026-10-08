// ============================================================================
// MEGA RARE — the pictures (54-megarare is the rules; this file is pictures only, stripped from the server's copy)
//   * the Void Scythe's icon (pack, belt, bank, book): ICONS 'void_scythe', a diagonal scythe as in the owner's picture
//   * a mega rare lying on the ground: the Void Scythe laid down full size (KNIGHTGEAR.weaponArt, the same drawing the
//     knight holds), in a purple glow with a gold rim, sparks rising off it; any other mega rare: its icon, bigger, in
//     the same glow
//   * the flash: for 0.9 s after MEGA_RARE.announce (a drop, a gift) a purple and gold burst of light from where it
//     happened, over the world and under the banner, read off MEGA_RARE.FLASH and `time` (never an update hook)
//   * the words: the pack's sentence starts "Mega rare.", the book's page has the blurb below; its sound, SFX.mega
// The gold-and-purple MEGA RARE banner and the book's tag are 59-hudkit's (style 'mega', HK.rarityTag), the halo
// 80-icons' 'mega' tier.
// ============================================================================
{
  const isMega = id => !!(window.MEGA_RARE && MEGA_RARE.isMega(id));

  // ---------- the sound: a bright rising chime over a low hum ----------
  if (typeof SFX === 'object' && SFX && !SFX.mega) SFX.mega = () => {
    [392, 523, 659, 784, 988, 1319].forEach((f, i) => tone('triangle', f, f, 0.26, 0.055, i * 0.08));
    tone('sine', 98, 82, 0.9, 0.06); tone('sine', 1568, 2093, 0.4, 0.03, 0.5);
  };

  // ---------- the words ----------
  { const coreBlurb = itemBlurb; itemBlurb = def => def && isMega(def.id) ? `${MEGA_RARE.RARITY[def.rarity].word}. ${coreBlurb(def)}` : coreBlurb(def); }
  if (window.WIKI) WIKI.add('items', {
    id: 'void_scythe', name: ITEMS.void_scythe.name,
    blurb: 'A long scythe from the void, held in both hands. Its blade glows purple and pink, and an orange eye watches from the top. One wide swing cuts every monster in front of you. It goes with the necromancer\'s robe, hood, wraps and lantern.',
  });

  // ---------- the icon: 18 units across, a scythe leaning from the bottom right up to its head, the blade sweeping left ----------
  const ICON = (g, size, item) => {
    g.lineCap = 'round';
    // the shaft, outlined, wrapped in a black vine, two gold runes
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(5.8, 6.8); g.lineTo(-0.2, -4.6); g.stroke();
    g.strokeStyle = '#4a3d5e'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(5.8, 6.8); g.lineTo(-0.2, -4.6); g.stroke();
    g.strokeStyle = '#0b090f'; g.lineWidth = 1; g.beginPath(); g.moveTo(5, 6.6); g.lineTo(4.8, 4.6); g.lineTo(3.6, 4.2); g.lineTo(3.4, 1.6); g.lineTo(1.8, 0.8); g.lineTo(1.6, -1.8); g.stroke();
    g.fillStyle = '#c9a03c'; g.beginPath(); g.arc(3.4, 2.4, 1, 0, 7); g.fill();
    // the orange stripe at the butt, the purple orb
    g.strokeStyle = '#ff8a3d'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(4.6, 6.4); g.lineTo(6.2, 5.6); g.stroke();
    g.fillStyle = '#a24bff'; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.beginPath(); g.arc(6.3, 7.2, 1.4, 0, 7); g.fill(); g.stroke();
    // the back spike
    g.fillStyle = '#d98ad8'; g.beginPath(); g.moveTo(0.4, -6.4); g.lineTo(3.8, -8.2); g.lineTo(1.8, -4.4); g.closePath(); g.fill();
    // the blade: purple, pink at the head, a pale back edge
    const bg = g.createLinearGradient(0, -7, -7, 6); bg.addColorStop(0, '#ffb08a'); bg.addColorStop(0.3, '#e872cc'); bg.addColorStop(1, '#8f4dff');
    g.fillStyle = bg; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0.2, -7.8); g.quadraticCurveTo(-9, -8.6, -7.4, 6.2); g.quadraticCurveTo(-3.4, -2.2, -0.6, -3.6); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(244,232,255,0.75)'; g.beginPath(); g.moveTo(-2, -7.4); g.quadraticCurveTo(-7.9, -7.6, -7.2, 2.6); g.stroke();
    // the dark head and its orange eye
    g.fillStyle = '#2a2632'; g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.beginPath(); g.moveTo(-2.2, -4.2); g.lineTo(-1.6, -7.4); g.lineTo(1.4, -7.6); g.lineTo(1.8, -4.4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ff8a1a'; g.beginPath(); g.ellipse(-0.2, -6, 1.3, 1, 0, 0, 7); g.fill();
    // two black tendrils on the blade
    g.strokeStyle = '#0b090f'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-2.6, -6); g.quadraticCurveTo(-5.6, -4, -5, -1.6); g.arc(-4, -1.6, 1, Math.PI, Math.PI * 2.4); g.stroke();
    g.beginPath(); g.moveTo(-6.6, -6.8); g.quadraticCurveTo(-7.8, -4.4, -6.2, -3.2); g.stroke();
  };
  HOOKS.world.push(() => { if (window.ICONS && ICONS.set) ICONS.set('void_scythe', ICON); });

  // ---------- on the ground ----------
  // a soft purple glow with a gold rim under it, a few sparks rising (each on its own clock: no random numbers)
  function groundGlow(g, x, y, r, p) {
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, `rgba(162,75,255,${(0.42 + p * 0.16).toFixed(3)})`); gr.addColorStop(0.7, `rgba(162,75,255,${(0.16 + p * 0.08).toFixed(3)})`);
    gr.addColorStop(0.86, `rgba(245,197,66,${(0.22 + p * 0.12).toFixed(3)})`); gr.addColorStop(1, 'rgba(245,197,66,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 0.62, 0, 0, 7); g.fill();
  }
  function sparks(g, x, y) {
    for (let i = 0; i < 4; i++) {
      const k = ((time * 0.6 + i * 0.25) % 1), sx = x + Math.sin(i * 2.3 + time * 1.3) * 14 + (i - 1.5) * 6, sy = y - 4 - k * 26;
      g.globalAlpha = (1 - k) * 0.85; g.fillStyle = i % 2 ? '#f5c542' : '#c79bff';
      g.beginPath(); g.arc(sx, sy, 1.4 - k * 0.6, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  const _drawDrop = drawDrop;
  drawDrop = function (g, d) {
    if (!d || !isMega(d.id)) return _drawDrop(g, d);
    const y = d.y + Math.sin((d.t || 0) * 3) * 1.2, p = 0.5 + 0.5 * Math.sin(time * 3);
    g.save();
    groundGlow(g, d.x, d.y + 2, 34, p);
    const K = window.KNIGHTGEAR;
    if (K && K.weaponArt && ITEMS[d.id].weapon) {
      // the scythe laid down, its blade up: a little shadow, then the weapon's own drawing at 0.82
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(d.x, d.y + 7, 24, 4, -0.08, 0, 7); g.fill();
      g.save(); g.translate(d.x, y + 2); g.rotate(-0.2); g.scale(0.82, -0.82); g.translate(-12, 0);
      K.weaponArt(g, d.id, time);
      g.restore();
    } else {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(d.x, d.y + 7, 9, 3, 0, 0, 7); g.fill();
      drawItemIcon(g, d.id, d.x, y, 24);
    }
    sparks(g, d.x, d.y);
    g.restore();
  };

  // ---------- the flash ----------
  const FLASH_FOR = 0.9;
  HOOKS.hud.push(g => {
    const F = window.MEGA_RARE && MEGA_RARE.FLASH;
    if (!F || !F.id || typeof time !== 'number') return;
    const k = (time - F.at) / FLASH_FOR;
    if (!(k >= 0 && k < 1)) return;
    const cx = typeof cam === 'object' && cam ? F.x - cam.x : VW / 2, cy = typeof cam === 'object' && cam ? F.y - cam.y : VH / 2;
    const R = Math.max(VW, VH) * (0.35 + k * 0.75), a = (1 - k) * (1 - k);
    g.save();
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    gr.addColorStop(0, `rgba(255,236,190,${(0.55 * a).toFixed(3)})`); gr.addColorStop(0.25, `rgba(162,75,255,${(0.38 * a).toFixed(3)})`);
    gr.addColorStop(0.7, `rgba(90,30,180,${(0.16 * a).toFixed(3)})`); gr.addColorStop(1, 'rgba(90,30,180,0)');
    g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
    // a gold ring racing out from it
    g.strokeStyle = `rgba(245,197,66,${(0.8 * a).toFixed(3)})`; g.lineWidth = 3 + 6 * (1 - k);
    g.beginPath(); g.arc(cx, cy, 20 + k * Math.max(VW, VH) * 0.5, 0, 7); g.stroke();
    g.restore();
  });

  // ---------- self-test ----------
  const P = 'mega rare art: ';
  HOOKS.selfTest.push((check, F, h) => {
    // the icon: registered, its own drawing, inside the icon box; the halo is the mega tier's (purple and gold)
    const icon = !!(window.ICONS && ICONS.has('void_scythe'));
    const m = icon ? ICONS.measure('void_scythe') : null;
    const tier = window.ICONS ? ICONS.tier('void_scythe') : null;
    const a = window.ICONS ? ICONS.audit() : null;
    const alone = !!a && !(a.implicated || []).includes('void_scythe') && !(a.missing || []).includes('void_scythe');
    check(P + 'the Void Scythe has its own icon inside the 18-unit box, and wears the mega tier\'s purple-and-gold halo (above unique)',
      icon && !!m && m.reach <= ICONS.SAFE + 0.5 && !!tier && tier.key === 'mega' && tier.order > ICONS.TIERS.unique.order && tier.glow === '#f5c542' && tier.glow2 === '#a24bff' && alone && ICONS.broken().length === 0,
      { icon, reach: m && +m.reach.toFixed(2), tier: tier && tier.key, alone, broken: window.ICONS ? ICONS.broken() : null });
    // the words: the pack's sentence, the book's blurb and tag
    const blurb = itemBlurb(ITEMS.void_scythe), page = window.WIKI ? WIKI.get('items', 'void_scythe') : null;
    // (its one source since Necromancy: the Hollow, 1 in 250; 54-megarare's SOURCES row, set from 89-necromancy's CHOICES)
    check(P + 'the pack says "Mega rare." first; the book\'s page has its blurb and its one source (the Hollow); a plain item\'s sentence is unchanged',
      blurb === 'Mega rare. Weapon: strength +48, accuracy +34, cleave.' && !!page && /held in both hands/.test(page.blurb || '') && page.sources.length === 1 && itemBlurb(ITEMS.iron_sword) === 'Weapon: strength +9, accuracy +8.',
      { blurb, page: !!page, sources: page && page.sources.length });
    // the banner: gold words on the purple tag, the item's name under it in pale violet; it fits a phone's lane
    if (window.HK && HK.banner && HK.audit) {
      const run = (w, small) => { const log = []; HK.banner(HK.audit.fitCtx(log), { x: 0, y: 0, w, h: 48 }, { kind: 'level', style: 'mega', title: 'MEGA RARE', sub: 'Void Scythe', small }); return log; };
      const wide = run(560, false), narrow = run(300, true);
      const ok = L => L.some(r => r.s === 'MEGA RARE' && r.fill === '#ffd76a') && L.some(r => r.s === 'Void Scythe' && r.fill === '#e9d5ff') && L.every(r => r.x - (r.w || 0) / 2 >= -1);
      check(P + 'the MEGA RARE banner draws its gold words and the item\'s name, wide and on a phone', ok(wide) && ok(narrow), { wide: wide.map(r => r.s + ' ' + r.fill), narrow: narrow.map(r => r.s) });
    }
    // the live path on phones: drawBanners with the real phone layouts (the scroll slot, a short lane that drops other banners'
    // sentences) still says the item's name, beside the tag, inside the lane
    if (window.HK && HK.drawBanners && HK.layoutFor && HK.audit) {
      const b0 = levelBanner, out = {};
      try {
        levelBanner = { text: 'MEGA RARE', sub: 'Void Scythe', t: 4.5, style: 'mega' };
        for (const [w, h] of [[390, 844], [844, 390], [360, 640]]) {
          const L = HK.layoutFor(w, h, { touch: true, online: true, minimap: true }), lane = L.banners && L.banners[0], log = [];
          if (!lane) { out[w + 'x' + h] = 'no lane'; continue; }
          HK.drawBanners(HK.audit.fitCtx(log), L);
          const tag = log.find(r => r.s === 'MEGA RARE'), name = log.find(r => r.s === 'Void Scythe');
          out[w + 'x' + h] = { fam: L.fam, laneH: lane.h, tag: !!tag && tag.fill === '#ffd76a', name: !!name && name.fill === '#e9d5ff', inLane: !!name && name.x >= lane.x && name.x < lane.x + lane.w && name.y > lane.y && name.y <= lane.y + lane.h };
        }
      } finally { levelBanner = b0; }
      const vals = Object.values(out);
      check(P + 'on a phone the live banner (drawBanners, the real phone layouts) shows MEGA RARE and the item\'s name inside its lane',
        vals.length === 3 && vals.every(v => v && v.tag && v.name && v.inLane), out);
    }
    // on the ground: drawn as itself without a throw; a plain drop goes on to the old drawing
    { let threw = null; try { const L = []; const c = HK.audit.fitCtx(L); const at = { x: player.x, y: player.y }; drawDrop(c, Object.assign({ id: 'void_scythe', qty: 1, t: 0.4, mega: true }, at)); drawDrop(c, Object.assign({ id: 'iron_sword', qty: 1, t: 0 }, at)); } catch (e) { threw = String(e && e.message || e); }
      check(P + 'a dropped Void Scythe draws (laid down in its glow) and a plain drop still draws the old way', !threw, { threw }); }
  });
}
