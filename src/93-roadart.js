// ============================================================================
// THE ROADS' LOOK AND WORDS (the Great Spread's Stage 6; the rules are src/93-roads.js)
// src/93-roadart.js
//
// Pictures and book words only (tools/build-sim.mjs STRIP_FILES: the server's copy never draws):
//   - the six named beasts by the roads, each drawn in the approved sample's hand as the beast it is a big old one of
//     (MONSTER_LOOK.addType: Grizzlejaw a great boar, Stonebiter a rock-crusted golemling, Greyfang a grey wolf, Old Sneak a
//     goblin, Ashjaw a dustjaw of the ash, Mossback a bear grown over with moss), its box the sample's grown by its size;
//   - their pages in the book (44-wiki), and the book's page for the roads: each road, what it joins, and everything on it.
// It loads before 93-roads (name order) and reads that file's tables only when the world is made.
// ============================================================================
{
  // [type, the sample's beast it is drawn as, how much bigger]
  const LOOKS = [['grizzlejaw', 'boar', 1.4], ['stonebiter', 'golemling', 1.1], ['greyfang', 'wolf', 1.35], ['old_sneak', 'goblin', 1.1], ['ashjaw', 'dustjaw', 0.85], ['mossback', 'bear', 1.2]];
  const R_OF = { grizzlejaw: 17, stonebiter: 16, greyfang: 16, old_sneak: 13, ashjaw: 18, mossback: 20 };   // MONSTER_DEFS' r (93-roads)
  const ADDED = [];
  if (window.MONSTER_LOOK && MONSTER_LOOK.addType && typeof MONSTER_ART !== 'undefined' && MONSTER_ART.NEW_DRAW) for (const [type, base, f] of LOOKS) {
    const draw = MONSTER_ART.NEW_DRAW[base], box = MONSTER_LOOK.BOX[base]; if (!draw || !box) continue;
    MONSTER_LOOK.addType(type, { draw: (g, v) => draw(g, v), size: (MONSTER_ART.MOB_SIZE[base] || 1) * f, box: box.map(b => Math.round(b * f)), r: R_OF[type], pic: MONSTER_LOOK.PIC_TYPES.has(base), top: MONSTER_LOOK.TOP_DIRS.has(base) });
    ADDED.push(type);
  }

  // ---------- the icons of what the roads hand out (80-icons' rules: inside -9..+9, nothing under 2 units across) ----------
  if (window.ICONS && ICONS.set) {
    const line = (g, col, w, cap) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = cap || 'butt'; };
    const edge = 'rgba(0,0,0,0.55)';
    ICONS.set('iron_key', (g, size, item) => {          // a big old iron key: a round bow, a long shank, two square teeth
      g.save(); g.rotate(-0.7);
      line(g, edge, 4.2, 'round'); g.beginPath(); g.moveTo(-3, 0); g.lineTo(8.4, 0); g.stroke();
      line(g, item.color, 2.6, 'round'); g.beginPath(); g.moveTo(-3, 0); g.lineTo(8.4, 0); g.stroke();
      g.fillStyle = item.color; g.fillRect(4.6, 0, 2.2, 3.6); g.fillRect(7.2, 0, 2, 2.8); line(g, edge, 1); g.strokeRect(4.6, 0, 2.2, 3.6); g.strokeRect(7.2, 0, 2, 2.8);
      line(g, edge, 4.6); g.beginPath(); g.arc(-5.6, 0, 3.4, 0, 7); g.stroke(); line(g, item.color, 2.8); g.beginPath(); g.arc(-5.6, 0, 3.4, 0, 7); g.stroke();
      g.restore();
    });
    ICONS.set('haws', (g, size, item) => {              // a sprig of hawthorn: four red haws on a twig, two green leaves
      line(g, '#5a3a20', 1.4, 'round'); g.beginPath(); g.moveTo(-7, 7); g.quadraticCurveTo(-1, 1, 6, -6); g.stroke();
      g.fillStyle = '#4c8a34'; for (const [x, y, a] of [[-4, 1, -0.8], [3, -6, 0.4]]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 3.4, 1.8, 0, 0, 7); g.fill(); line(g, edge, 1); g.stroke(); g.restore(); }
      for (const [x, y] of [[-3, 5], [1, 3], [4, 0], [0, -1]]) { g.fillStyle = item.color; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); line(g, edge, 1); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x - 0.8, y - 0.8, 1, 0, 7); g.fill(); }
    });
    ICONS.set('river_pearl', (g, size, item) => {       // a pearl in an open mussel shell
      g.fillStyle = '#2f3a52'; g.beginPath(); g.ellipse(0, 3, 8.4, 4.6, 0, 0, Math.PI); g.closePath(); g.fill(); line(g, edge, 1); g.stroke();
      g.fillStyle = '#3d4a66'; g.beginPath(); g.ellipse(0, 1.6, 8.4, 3, 0, Math.PI, 7); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#bcc6dc'; g.beginPath(); g.ellipse(0, 2.6, 6.6, 2.2, 0, 0, 7); g.fill();
      g.fillStyle = item.color; g.beginPath(); g.arc(0, 0.4, 3.6, 0, 7); g.fill(); line(g, 'rgba(0,0,0,0.4)', 1); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(-1.2, -0.8, 1.2, 0, 7); g.fill();
    });
    ICONS.set('grizzle_tusk', (g, size, item) => {      // one great curved tusk, broken at the tip
      g.fillStyle = item.color; g.beginPath(); g.moveTo(-8, 6); g.quadraticCurveTo(-6, -6, 6, -8); g.lineTo(7, -5.4); g.quadraticCurveTo(-2, -3, -3.4, 7.2); g.closePath(); g.fill(); line(g, edge, 1.2); g.stroke();
      g.fillStyle = 'rgba(120,96,60,0.55)'; g.beginPath(); g.moveTo(-8, 6); g.lineTo(-3.4, 7.2); g.lineTo(-4.4, 4.4); g.lineTo(-7.4, 3.8); g.closePath(); g.fill();
      line(g, 'rgba(255,255,255,0.5)', 1); g.beginPath(); g.moveTo(-5.6, 3); g.quadraticCurveTo(-4, -4, 4, -6.4); g.stroke();
    });
    ICONS.set('stone_heart', (g, size, item) => {       // a heart of grey stone with a glowing crack
      g.fillStyle = item.color; g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-10, 1, -7, -8.4, 0, -4); g.bezierCurveTo(7, -8.4, 10, 1, 0, 8); g.closePath(); g.fill(); line(g, edge, 1.2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(-3.2, -2.6, 2.4, 1.6, -0.5, 0, 7); g.fill();
      line(g, '#ffb347', 1.4, 'round'); g.beginPath(); g.moveTo(-1, -3); g.lineTo(1, 0); g.lineTo(-1, 2.6); g.lineTo(1, 5.4); g.stroke();
    });
    ICONS.set('grey_pelt', (g, size, item) => {         // a grey wolf's pelt laid flat, a pale stripe down its back
      g.fillStyle = item.color; g.beginPath(); g.moveTo(0, -8); g.lineTo(4.6, -6); g.lineTo(8.4, -7); g.lineTo(6.4, -2); g.lineTo(7.4, 4); g.lineTo(8.6, 8); g.lineTo(3, 5.6); g.lineTo(0, 8.4); g.lineTo(-3, 5.6); g.lineTo(-8.6, 8); g.lineTo(-7.4, 4); g.lineTo(-6.4, -2); g.lineTo(-8.4, -7); g.lineTo(-4.6, -6); g.closePath(); g.fill(); line(g, edge, 1.2); g.stroke();
      g.fillStyle = '#d6d8e2'; g.beginPath(); g.ellipse(0, 0, 2.2, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#5a5d6a'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2, -8); g.lineTo(s * 3.6, -9.4); g.lineTo(s * 4.2, -6.6); g.closePath(); g.fill(); }
    });
    ICONS.set('cinder_scale', (g, size, item) => {      // a big orange scale, glowing at its edge like a coal
      g.fillStyle = '#7a2a12'; g.beginPath(); g.moveTo(0, -8.6); g.quadraticCurveTo(8.4, -4, 6.4, 3); g.quadraticCurveTo(3, 8.4, 0, 8.6); g.quadraticCurveTo(-3, 8.4, -6.4, 3); g.quadraticCurveTo(-8.4, -4, 0, -8.6); g.closePath(); g.fill(); line(g, edge, 1.2); g.stroke();
      g.fillStyle = item.color; g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(5.6, -3, 4.2, 2.4); g.quadraticCurveTo(2, 6, 0, 6.2); g.quadraticCurveTo(-2, 6, -4.2, 2.4); g.quadraticCurveTo(-5.6, -3, 0, -6); g.closePath(); g.fill();
      line(g, '#ffd27a', 1.2, 'round'); g.beginPath(); g.moveTo(0, -4.4); g.lineTo(0, 4.4); g.stroke();
    });
    ICONS.set('moss_bloom', (g, size, item) => {        // a green flower of moss: five round petals, a gold heart
      for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 - Math.PI / 2; g.fillStyle = item.color; g.beginPath(); g.arc(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 3.4, 0, 7); g.fill(); line(g, edge, 1); g.stroke(); }
      g.fillStyle = '#e8c547'; g.beginPath(); g.arc(0, 0, 2.6, 0, 7); g.fill(); line(g, edge, 1); g.stroke();
    });
    ICONS.set('sneak_purse', (g, size, item) => {       // a fat drawstring purse, coins spilling at its mouth
      g.fillStyle = '#7a4a24'; g.beginPath(); g.moveTo(-3, -4); g.quadraticCurveTo(-8.6, 0, -6.4, 6); g.quadraticCurveTo(0, 9, 6.4, 6); g.quadraticCurveTo(8.6, 0, 3, -4); g.closePath(); g.fill(); line(g, edge, 1.2); g.stroke();
      line(g, '#c9a227', 1.4); g.beginPath(); g.moveTo(-3.4, -4); g.lineTo(3.4, -4); g.stroke();
      g.fillStyle = '#5e3a1c'; g.beginPath(); g.moveTo(-3, -4); g.lineTo(-4.4, -8); g.lineTo(0, -6); g.lineTo(4.4, -8); g.lineTo(3, -4); g.closePath(); g.fill();
      for (const [x, y] of [[5.6, -6.4], [7.4, -3]]) { g.fillStyle = item.color; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); line(g, edge, 1); g.stroke(); }
    });
  }

  // ---------- the book ----------
  if (window.WIKI && WIKI.add) {
    const BLURB = {
      grizzlejaw: 'An old boar with one broken tusk. It lives in the briars beside the Cave Road and never wanders far. It will not chase you, so fight it when you are ready.',
      stonebiter: 'A brute crusted all over with rock. It walked down out of the Grey Quarry and stayed by the Quarry Track.',
      greyfang: 'The grey wolf the villagers name. It walks the Wolfwood Road between the Lodge and Old Wren. It leaves you be unless you hit it first.',
      old_sneak: 'A goblin that robs the Sea Road by the Goblin Camp. It carries a purse of everything it has stolen.',
      ashjaw: 'An ash-crusted drakeling on the track to the Fang\'s lair. Hard to hurt, and it hits hard back.',
      mossback: 'Something very old and very green, where the Jungle Path turns. The strongest of the beasts by the roads.',
    };
    for (const id in BLURB) WIKI.add('monsters', { id, name: id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), blurb: BLURB[id] });
    // the roads' page, written each time the world is made (the places stand where the roads let them)
    HOOKS.world.push(() => {
      const RD = window.ROADS; if (!RD || !RD.POI_DEF) return;
      const lines = [{ t: 'Six main roads join the places you go: wide stone roads with a kerb, lanterns that burn all night, and a milestone at each end that names the road and everything on it. The other ways are dirt tracks, marked with cairns.', c: '#8b949e' },
        { t: 'Every signpost names the next stop on each road and how long the walk is. A horse is twice as fast.', c: '#8b949e' }];
      const gives = p => p.kind === 'shrine' ? p.blessName + ' (once every ' + Math.round(p.every / 60) + ' minutes)' : p.kind === 'bramble' ? '2-4 hawthorn haws (every ' + p.every + ' seconds)'
        : p.kind === 'bones' ? '2-4 bones (every ' + Math.round(p.every / 60) + ' minutes)' : p.kind === 'well' ? 'all your hitpoints back (every ' + Math.round(p.every / 60) + ' minutes)'
          : p.kind === 'pool' ? 'trout, and 1 time in ' + p.extraOdds + ' a river pearl (a rod)' : p.kind === 'beast' ? 'a named beast, level ' + (MONSTER_DEFS[p.type] || {}).level
            : p.kind === 'trader' ? (RD.TRADES[p.who] || {}).line || '' : p.kind === 'lore' ? 'words for travellers'
              : (p.loot || []).map(([id, a, b]) => (a === b ? a : a + '-' + b) + ' ' + (ITEMS[id] ? ITEMS[id].name.toLowerCase() : id)).join(', ') + (p.key ? ' (the iron key opens it)' : p.once ? ' (once)' : ' (every ' + Math.round(p.every / 60) + ' minutes)');
      for (const id of Object.keys(RD.NAMES)) {
        lines.push({ t: RD.NAMES[id][0], c: '#e9eef5' }); lines.push({ t: '  ' + RD.NAMES[id][1], c: '#8b949e' });
        for (const p of RD.POI_DEF) if (p.road === id) lines.push({ t: '  ' + p.name + ': ' + gives(p), c: '#c9d1d9' });
      }
      lines.push({ t: 'On the tracks', c: '#e9eef5' });
      for (const p of RD.POI_DEF) if (!RD.NAMES[p.road]) lines.push({ t: '  ' + p.name + ': ' + gives(p), c: '#c9d1d9' });
      WIKI.add('places', { id: 'roads', name: 'The roads', sub: 'Six main roads, the tracks, and what stands along them', lines });
    });
  }
  window.ROAD_LOOKS = { LOOKS, ADDED };

  // ---------- self-test ----------
  HOOKS.selfTest.push(check => {
    const L = window.MONSTER_LOOK, bad = LOOKS.map(l => l[0]).filter(t => !L || !L.ADDED.has(t) || !MONSTER_DEFS[t] || L.HIT_R[t] !== MONSTER_DEFS[t].r || !L.BOX[t]);
    const page = window.WIKI && WIKI.get ? WIKI.get('places', 'roads') : null;
    check("road look: the six named beasts are drawn in the sample's hand through MONSTER_LOOK.addType (each the beast it is a big old one of), their hit circles the rules' r; the book has the roads' page, every place to stop for on it",
      !bad.length && ADDED.length === 6 && !!page && (window.ROADS ? ROADS.POI_DEF.every(p => page.lines.some(l => l.t.includes(p.name))) : false), { bad, added: ADDED, page: !!page });
  });
}
