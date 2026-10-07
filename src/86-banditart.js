// ============================================================================
// THE BANDITS' LOOK (the Great Spread, Stage 5f: ~/.fanglands/work/spread/spec.md §4 "Bandit hills", §13 STAGE 5)
// src/86-banditart.js
//
// Pictures only (stripped from the server's copy, as 87-critterart is): the three bandit kinds of 86-bandits drawn with the
// core's drawHuman (the spec: "drawn with drawHuman"), each through MONSTER_LOOK.addType so the monster look draws it, keeps
// its pictures and knows its box; and their pages in the book (44-wiki). They die as 'person' (79-deaths reads their
// MONSTER_DEFS `human`), so a falling bandit drops his weapon like a guard.
//
//   bandit         a brown jerkin and a dark hood, a red cloth mask over mouth and nose, a sword
//   bandit archer  a green jerkin and hood, a grey mask, a bow and a quiver on the back (it throws bombs: a thrower)
//   bandit chief   a dark red coat with gold shoulders, a black beard, a wide black hat with a red feather, a battleaxe
//
// This file loads before 86-bandits (name order): the names here are its MONSTER_DEFS names, and its self-test holds the two
// the same. window.BANDIT_LOOKS is the test handle.
// ============================================================================
{
  const NAMES = { bandit: 'Bandit', bandit_archer: 'Bandit archer', bandit_chief: 'Bandit chief' };
  // ---------- the look: each drawn with the core's drawHuman (MONSTER_LOOK.addType), a mask over the face ----------
  const LOOK = {
    bandit: { tunic: '#5e4a36', hair: '#2a1a0a', helm: '#3a3530', shoulder: '#4a3a2a', weapon: { shape: 'sword', color: '#a9adb5' } },
    bandit_archer: { tunic: '#44583a', hair: '#5a3a1e', helm: '#2f3a28', shoulder: '#5a4630', weapon: { shape: 'bow', color: '#7a5a2a' } },
    bandit_chief: { tunic: '#6a1e1e', hair: '#1e140a', beard: true, shoulder: '#c9a36a', weapon: { shape: 'battleaxe', color: '#c9ccd3' } },
  };
  const MASK = { bandit: '#8a2a1e', bandit_archer: '#3a3a3a', bandit_chief: null };
  const STATS = { drawn: 0 };
  function drawBandit(type) {
    return (g, v) => {
      STATS.drawn++;
      const f = v.facing || { x: 0, y: 1 }, fx = f.x, fy = f.y, bob = v.moving ? Math.sin(v.walkT || 0) * 1.5 : 0;
      g.save(); g.translate(0, bob);
      // an archer's quiver, on the back (drawn first: the body hides most of it)
      if (type === 'bandit_archer') { g.save(); g.rotate(Math.atan2(fy, fx) + Math.PI); g.fillStyle = '#6a4a2a'; g.fillRect(4, -9, 9, 5); g.fillStyle = '#e9eef5'; g.fillRect(12, -9, 3, 1.5); g.fillRect(12, -6.5, 3, 1.5); g.restore(); }
      drawHuman(g, v, LOOK[type]);
      // a cloth mask over the mouth and nose (seen from the front and the sides)
      const m = MASK[type];
      if (m) {
        g.save(); g.beginPath(); g.arc(0, -8, 8, 0, 7); g.clip();
        if (fy > -0.6) { g.fillStyle = m; g.fillRect(-9, -5.2 + fy * 1.6, 18, 4); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-9, -1.8 + fy * 1.6, 18, 0.8); }
        g.restore();
      }
      // the chief's wide black hat with a red feather
      if (type === 'bandit_chief') {
        g.fillStyle = '#1e1a18'; g.beginPath(); g.ellipse(0, -12, 12, 4.5, 0, 0, 7); g.fill();
        g.beginPath(); g.arc(0, -13, 7, Math.PI, 0); g.fill(); g.fillStyle = '#8a2a1e'; g.fillRect(-7, -14, 14, 2);
        g.strokeStyle = '#c0392b'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(5, -15); g.quadraticCurveTo(12, -22, 16, -19); g.stroke(); g.lineCap = 'butt';
      }
      g.restore();
    };
  }
  // boxes: [x0, y0, x1, y1] at rest, then swinging, in game pixels round the middle (measure.cjs: every 16th of a turn,
  // standing, walking, swinging, 3 px all round; drawHuman holds the weapon out at rest too, so the two are the same)
  const LOOKS = {
    bandit: { draw: drawBandit('bandit'), size: 1.05, r: 13, pic: true, box: [-41, -43, 41, 43, -41, -43, 41, 43] },
    bandit_archer: { draw: drawBandit('bandit_archer'), size: 1.05, r: 13, pic: true, box: [-28, -30, 28, 30, -28, -30, 28, 30] },
    bandit_chief: { draw: drawBandit('bandit_chief'), size: 1.2, r: 15, pic: true, box: [-42, -43, 42, 43, -42, -43, 42, 43] },
  };
  if (window.MONSTER_LOOK && MONSTER_LOOK.addType) for (const t in LOOKS) MONSTER_LOOK.addType(t, LOOKS[t]);

  // ---------- the book (44-wiki): plain words for each bandit ----------
  if (window.WIKI && WIKI.add) {
    const BLURB = {
      bandit: "A bandit with a cloth mask and a sword. Bandits live in the Bandit Hills and make carts pay at their toll gate. They fight in a gang, so watch your back.",
      bandit_archer: "A bandit with a bow and a bag of bombs. It keeps back and throws them. When a bomb lands by your feet, step away fast.",
      bandit_chief: "The boss of the bandits: big, with a wide black hat and a huge axe. He stays near the back of the camp. Beat him and Wat the carter gets his cart back.",
    };
    for (const id in BLURB) WIKI.add('monsters', { id, name: NAMES[id], blurb: BLURB[id] });
  }

  window.BANDIT_LOOKS = { LOOK, LOOKS, STATS, NAMES };

  // ---------- self-test ----------
  HOOKS.selfTest.push(check => {
    const TYPES = Object.keys(LOOKS);
    // the look: each drawn with drawHuman through MONSTER_LOOK.addType, its hit circle the rules' r
    { const L = window.MONSTER_LOOK, bad = TYPES.filter(t => !L || !L.ADDED.has(t) || !MONSTER_DEFS[t] || L.HIT_R[t] !== MONSTER_DEFS[t].r || !L.BOX[t] || MONSTER_DEFS[t].name !== NAMES[t]);
      const _dh = drawHuman; let n = 0; drawHuman = function () { n++; return _dh.apply(this, arguments); };
      const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => { }), set: (o, k, v) => { o[k] = v; return true; } }), d0 = STATS.drawn;
      try { for (const t of TYPES) LOOKS[t].draw(g, { type: t, facing: { x: 0, y: 1 }, moving: false, walkT: 0, attackT: 0, hurtT: 0 }); } finally { drawHuman = _dh; }
      check('bandit look: the bandits, the archers and the chief are drawn with drawHuman through MONSTER_LOOK.addType under their MONSTER_DEFS names, their hit circles the rules\' r', !bad.length && n === 3 && STATS.drawn - d0 === 3, { bad, n }); }
    // the book: each one's page under its own name, with its words, where it lives and what it drops
    if (window.WIKI && WIKI.get) {
      const bad = TYPES.filter(t => { const e = WIKI.get('monsters', t); return !e || e.name !== NAMES[t] || !e.blurb || !(e.where || []).length || !(e.drops || []).length; });
      check('bandit look: the book has a page for each bandit under its own name, with its words, where it lives and what it drops', !bad.length, { bad }); }
  });
}
