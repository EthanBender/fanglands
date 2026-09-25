// ============================================================================
// PARTY HATS — the six pack icons
// Owner: "...make it so i can drop party hats that will be SUPER RARE". src/77-dropparty.js makes the six hats (the
// items, the crown on the knight's head, the Death rule); this file only draws their icons, because ICONS.set lives in
// src/80-icons.js and this file loads after it. Six colours, six different drawings: the icon audit counts a recolour
// as the same picture (docs/ONLINE.md, "Party hats"), so every paper crown carries its own mark on the band: dots,
// stripes, a star, a zigzag, a diamond, checks. Nothing but a cracker gives one and each is worth 10,000, so the rarity
// tiers call them unique and the gold halo goes behind them. That is right.
// Feature file: registers through window.ICONS and HOOKS.selfTest only.
// ============================================================================
{
  const COLOURS = ['red', 'yellow', 'blue', 'green', 'purple', 'white'];
  const pale = hex => { const h = String(hex || '#888888').replace('#', ''); const n = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); return (n[0] * 0.299 + n[1] * 0.587 + n[2] * 0.114) / 255 > 0.6; };
  // the paper crown every hat shares: four points, a band a shade lighter, the fold down the middle.
  // Answers the ink for the mark: dark on the pale yellow and white hats, white on the others.
  function crown(g, item) {
    g.fillStyle = item.color;
    g.beginPath(); g.moveTo(-8.4, 7.4); g.lineTo(-8.4, -3.6); g.lineTo(-5.6, 0.6); g.lineTo(-2.8, -6.8); g.lineTo(0, -1.2);
    g.lineTo(2.8, -6.8); g.lineTo(5.6, 0.6); g.lineTo(8.4, -3.6); g.lineTo(8.4, 7.4); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-8.4, 2.4, 16.8, 5);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -1.2); g.lineTo(0, 2.4); g.stroke();
    return pale(item.color) ? '#2d333b' : '#ffffff';
  }
  const MARK = {
    // red: three dots round the band
    red: (g, ink) => { g.fillStyle = ink; for (const x of [-5, 0, 5]) { g.beginPath(); g.arc(x, 4.9, 1.3, 0, 7); g.fill(); } },
    // yellow: four stripes
    yellow: (g, ink) => { g.fillStyle = ink; for (const x of [-7, -3, 1, 5]) g.fillRect(x, 2.4, 2, 5); },
    // blue: a five-point star at the front
    blue: (g, ink) => {
      g.fillStyle = ink; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 1.3 : 3, x = Math.cos(a) * r, y = 4.9 + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.closePath(); g.fill();
    },
    // green: a zigzag all the way round
    green: (g, ink) => {
      g.strokeStyle = ink; g.lineWidth = 1.4; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-7.4, 6.4); g.lineTo(-4.9, 3.4); g.lineTo(-2.5, 6.4); g.lineTo(0, 3.4); g.lineTo(2.5, 6.4); g.lineTo(4.9, 3.4); g.lineTo(7.4, 6.4); g.stroke();
    },
    // purple: a diamond between two dots
    purple: (g, ink) => {
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(0, 2.6); g.lineTo(2.6, 4.9); g.lineTo(0, 7.2); g.lineTo(-2.6, 4.9); g.closePath(); g.fill();
      g.beginPath(); g.arc(-5.6, 4.9, 1.1, 0, 7); g.arc(5.6, 4.9, 1.1, 0, 7); g.fill();
    },
    // white: two rows of checks
    white: (g, ink) => { g.fillStyle = ink; for (const [x, y] of [[-8.4, 2.4], [-4.2, 2.4], [0, 2.4], [4.2, 2.4], [-6.3, 4.9], [-2.1, 4.9], [2.1, 4.9], [6.3, 4.9]]) g.fillRect(x, y, 2.1, 2.5); },
  };
  if (window.ICONS && typeof ICONS.set === 'function') for (const c of COLOURS) ICONS.set('party_hat_' + c, (g, size, item) => { const ink = crown(g, item); MARK[c](g, ink); });

  // ---------- self-test ----------
  HOOKS.selfTest.push(check => {
    if (!window.ICONS) return;
    const ids = COLOURS.map(c => 'party_hat_' + c);
    const registered = ids.filter(id => ICONS.has(id) && ITEMS[id]);
    const hashes = ids.map(id => ICONS.record(id).hash);
    const a = ICONS.audit();
    const implicated = ids.filter(id => a.groups.some(gr => gr.includes(id)));
    const bad = [];
    for (const id of ids) {
      const s = ICONS.art(id, 13), b = ICONS.art(id, 35), r = ICONS.record(id, 13);
      if (!s || s.threw || !s.calls) { bad.push(id + ': ' + (s && s.threw || 'draws nothing')); continue; }
      if (s.reach > ICONS.BOUND || r.reach > ICONS.BOUND) bad.push(id + ': reaches ' + Math.max(s.reach, r.reach).toFixed(2));
      if (s.small.length) bad.push(id + ': a feature of ' + s.small[0]);
      if (s.thin.length) bad.push(id + ': a line of ' + s.thin[0]);
      if (s.hash !== b.hash) bad.push(id + ': changes with size');
    }
    const unique = ids.filter(id => ICONS.rarity(id) !== 'unique');
    check('party hats: six icons of their own (six different drawings), none sharing a picture with any other item, all inside the box with nothing under the 2-unit minimum, the gold halo of a unique',
      registered.length === 6 && new Set(hashes).size === 6 && !implicated.length && a.implicated <= 149 && !bad.length && !unique.length && !ICONS.broken().some(l => /^party_hat_/.test(l)),
      { registered: registered.length, distinct: new Set(hashes).size, implicated, stillSharing: a.implicated, bad, notUnique: unique, reach: ids.map(id => +ICONS.art(id, 18).reach.toFixed(2)) });
  });
}
