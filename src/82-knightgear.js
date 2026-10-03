// ============================================================================
// THE KNIGHT'S GEAR — the knight drawn in the look the owner approved (the "Fanglands Knight Gear" sample page,
// ~/.fanglands/work/knight-sample/knight-gear.html), "roll this out". The drawing below is that page's code, ported.
//
// The owner's decisions, in his words, that this file keeps:
//  1. No arms. A hand floats beside each shoulder plate: a gauntlet in plate armour, a bare hand otherwise.
//  2. Every weapon rests UPRIGHT "like the battle axes" (swords and daggers too), the hand "resting around the waist"
//     (REST_HAND, about 10.4, 4.8 in the knight's own frame). The bow hangs at his side; a spear or stave stands beside
//     him. The hand only rises round the shoulder during a swing and eases back to the waist after.
//  3. Facing forward or side-on, "the sword should be in front": the weapon is in front of the shoulder and body.
//     Facing away, the hands, the weapon and the shield or lantern are all BEHIND his body (an upright tip shows over his
//     shoulder; the cape and its badge show on his back).
//  4. Robes and cloaks are slim and open at the front, never "a brick": the necromancer robe has a dark lining with
//     runes, a cord belt and a tattered hem; the silk and shadow cloaks are two panels over the tunic, the belt showing.
//  5. More detail and more of a look of its own for every piece: every metal its own helm, shield, blade and armour
//     trim, leg armour and capes drawn, each skill cape's badge on the back, the party hat a striped cone with a
//     sparkle, goggles, a hood with glowing eyes, winged and horned helms, eyebrows, cheeks, a belt pouch, boot cuffs, a
//     dark outline, legs that step, a cape that sways, a swoosh on a swing.
// Girl knights (79-boygirl's `girl` flag) are drawn here in the same style: a short skirt, long hair (locks under a
// helm), the braid over the shoulder with its ribbon, a bow on a bare head, rosy cheeks and lashes.
//
// THE LOOK. A KNIGHT look is any look with a `gear` object: { helm, body, legs, shield, cape, weapon }, item ids or
// null. playerLook() gains it here (from player.equip; the obsidian helm sits in equip.head, see below), 73-players
// sends it in presence, and title.KNIGHT carries one. Every old field stays exactly as before (tunic, hair, shoulder,
// helm/body/shield colours, weapon, tool, rod, fists, hat, girl). A slot with no id this game knows (an old client, a
// newer client's item) is read back from the colour fields: every (slot, colour) and (weapon shape, colour) pair is
// unique across the items, so an old look comes back as its exact items; `hat: 'red'` is party_hat_red; a colour that is
// no item draws that family's plain piece in that colour. Looks without gear (townsfolk, guards, monsters, the stone
// statue) go to the old drawHuman untouched.
//
// WRAPS (by reassignment, explicit arguments): playerLook (adds gear), drawHuman (a knight look comes here, every other
// look goes on down unchanged; 77's crown and 79's braid are drawn here for a knight), drawCharacter (the player on
// foot: the core bobbed the whole figure, this bobs only the body so the feet stay planted), drawMech, drawDozer and
// HOOKS.drawMonster.barrelbeast (a seat counter: a pilot is drawn without legs). title.KNIGHT gets the Iron knight's gear.
//
// SPEED. The knight is about 7x the old drawing's work, so other knights online (73-players, possibly 50 on one map)
// are drawn from pictures: one per (gear, girl, hurt, 8 facings, step, animation phase, screen pixel ratio), holding
// everything but the weapon, which has its own picture per (weapon, phase, ratio) and is turned to its angle. Both are
// LRU maps (PIC_MAX, WPIC_MAX). Everything else (your own knight, the seats, the bank, the title, the choice cards) is
// drawn live, so it is never soft at a panel's scale. Pictures are only made for the world canvas (`ctx`).
//
// POSE. Where the weapon points and where the hand is ease from frame to frame. It lives in a WeakMap keyed by the
// entity, never on it: the player object is saved whole into every save.
//
// window.KNIGHTGEAR = { draw, partsOf, gearKey, cleanGear, poseOf, STATS, PICS, WPICS }
// ============================================================================
const KNIGHTGEAR = (() => {
  // ---------- the clock and the colours of the knight being drawn ----------
  let T = 0;                                        // the clock the drawing reads: `time`, or a picture's frozen phase
  let TUNIC = '#3b6fb6', SKIN = '#e8b790', HAIR = '#5a3a1e', RIB = '#d0567f', GIRL = false;
  const GOLD = '#e0b546', OUT = 'rgba(22,14,8,0.62)', RIBBON = '#d0567f';
  const KG = { seat: 0 };
  const STATS = { pics: 0, wpics: 0, live: 0, blits: 0 };
  const kEase = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  // a colour off the wire is only ever used if it is a #rgb or #rrggbb hex (a gradient stop with a bad colour throws)
  const HEXRE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const okHex = c => typeof c === 'string' && HEXRE.test(c);
  const hex = (c, d) => okHex(c) ? c : d;
  const SHADES = new Map();
  function shade(c, f) {
    const k = c + '|' + f;
    let s = SHADES.get(k);
    if (s) return s;
    let h = okHex(c) ? c.slice(1) : '808080';
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; gg *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; }
    s = `rgb(${r | 0},${gg | 0},${b | 0})`;
    if (SHADES.size > 5000) SHADES.clear();
    SHADES.set(k, s);
    return s;
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); }

  // ---------- the families: what kind of piece each item is ----------
  const tierOf = id => { const m = /^(ruined|wooden|bronze|iron|steel|mithril|blackiron|sunstone|stormstone|godly|dragon|obsidian|stoneheart|scale)/.exec(id || ''); return m ? m[1] : null; };
  const isParty = id => !!id && ((ITEMS[id] && ITEMS[id].partyHat) || /^party_hat/.test(id));
  const helmFam = id => !id ? null : isParty(id) ? 'party' : id === 'tinker_goggles' ? 'goggles' : id === 'necro_hood' ? 'hood'
    : id === 'godly_helm' ? 'winged' : id === 'dragon_helm' ? 'horned' : 'metal';
  const bodyFam = id => !id ? null : /cloak/.test(id) ? 'cloak' : id === 'necro_robe' ? 'robe' : id === 'ruined_body' ? 'chain' : id === 'hover_armour' ? 'hover' : 'plate';
  const shieldFam = id => !id ? null : id === 'soul_lantern' ? 'lantern' : 'shield';
  const SHAPES = { sword: 1, dagger: 1, axe: 1, battleaxe: 1, warhammer: 1, bow: 1 };
  const shapeFam = s => SHAPES[s] ? s : 'sword';
  const weaponFam = id => !id ? null : /spear/.test(id) ? 'spear' : id === 'fang_of_the_fang' ? 'fang' : id === 'bone_stave' ? 'stave' : id === 'skull_mace' ? 'mace' : shapeFam(ITEMS[id] && ITEMS[id].shape);
  const gemOf = id => !id ? null : /^sunstone/.test(id) ? '#ffcf5a' : /^stormstone/.test(id) ? '#efe8ff' : null;
  // which item slot an item goes in (the obsidian helm's armour slot is 'head': it is a helm)
  const slotOf = it => !it ? null : it.weapon ? 'weapon' : it.armour ? (it.armour.slot === 'head' ? 'helm' : it.armour.slot) : null;
  const SLOTS = ['helm', 'body', 'legs', 'shield', 'cape', 'weapon'];
  // pieces whose drawing moves with the clock (a picture of them is made at four phases)
  const ANIMATED = new Set(['mithril_helm', 'stormstone_helm', 'obsidian_helm', 'godly_helm', 'necro_robe', 'silk_cloak', 'shadow_cloak', 'hover_armour', 'stormstone_body', 'soul_lantern', 'stormstone_shield', 'gale_cloak']);
  const WANIMATED = new Set(['mithril_sword', 'mithril_dagger', 'skysinger', 'sunstone_sword', 'stormstone_sword', 'bone_stave', 'dragon_spear']);

  // ---------- reading a look: the six pieces ----------
  // part = { id, fam, tier, color } (id null for a piece known only by its colour)
  const PARTS = new Map();
  function part(id, slot) {
    const k = slot + ':' + id;
    let p = PARTS.get(k);
    if (p) return p;
    const it = ITEMS[id];
    const fam = slot === 'helm' ? helmFam(id) : slot === 'body' ? bodyFam(id) : slot === 'shield' ? shieldFam(id) : slot === 'weapon' ? weaponFam(id) : slot;
    p = { id, fam, tier: tierOf(id), color: hex(it.color, '#9aa3b2'), slot };
    PARTS.set(k, p);
    return p;
  }
  const plain = (slot, fam, color) => ({ id: null, fam, tier: null, color: hex(color, '#9aa3b2'), slot });
  let REV = null, REVN = -1;
  function rev() {
    const n = Object.keys(ITEMS).length;
    if (REV && REVN === n) return REV;
    REV = new Map(); REVN = n;
    for (const id in ITEMS) {
      const it = ITEMS[id], s = slotOf(it);
      if (!s) continue;
      const c = String(it.color || '').toLowerCase();
      const k = s === 'weapon' ? 'weapon|' + it.shape + '|' + c : s + '|' + c;
      if (!REV.has(k)) REV.set(k, id);
      if (it.partyHat) REV.set('hat|' + it.partyHat, id);
    }
    return REV;
  }
  const known = (id, slot) => typeof id === 'string' && !!ITEMS[id] && slotOf(ITEMS[id]) === slot;
  // the gear from the wire: only real ids in the right slot survive; an old look with no gear gets an empty one (its
  // colours fill it in when it is drawn)
  function cleanGear(gear) {
    const out = {};
    if (!gear || typeof gear !== 'object') return out;
    for (const s of SLOTS) out[s] = known(gear[s], s) ? gear[s] : null;
    return out;
  }
  const LOOKPARTS = new WeakMap();
  function partsOf(look) {
    if (!look || typeof look !== 'object') look = {};
    let P = LOOKPARTS.get(look);
    if (P) return P;
    const gr = look.gear && typeof look.gear === 'object' ? look.gear : {};
    const R = rev(), lc = c => String(c || '').toLowerCase();
    P = {};
    // the helm: a known id; else a party hat's word; else the helm colour
    if (known(gr.helm, 'helm')) P.helm = part(gr.helm, 'helm');
    else if (look.hat) { const id = R.get('hat|' + look.hat); P.helm = id ? part(id, 'helm') : plain('helm', 'party', '#f4f1ea'); }
    else if (look.helm) { const id = R.get('helm|' + lc(look.helm)); P.helm = id ? part(id, 'helm') : plain('helm', 'metal', look.helm); }
    else P.helm = null;
    if (known(gr.body, 'body')) P.body = part(gr.body, 'body');
    else if (look.body) { const id = R.get('body|' + lc(look.body)); P.body = id ? part(id, 'body') : plain('body', 'plate', look.body); }
    else P.body = null;
    P.legs = known(gr.legs, 'legs') ? part(gr.legs, 'legs') : null;
    if (known(gr.shield, 'shield')) P.shield = part(gr.shield, 'shield');
    else if (look.shield) { const id = R.get('shield|' + lc(look.shield)); P.shield = id ? part(id, 'shield') : plain('shield', 'shield', look.shield); }
    else P.shield = null;
    P.cape = known(gr.cape, 'cape') ? part(gr.cape, 'cape') : null;
    // the weapon only when the look holds one (a tool, the rod, fists or 79-deaths' unarmed win)
    const w = look.weapon;
    if (w && typeof w === 'object') {
      const wid = known(gr.weapon, 'weapon') ? gr.weapon : known(w.id, 'weapon') ? w.id : R.get('weapon|' + w.shape + '|' + lc(w.color));
      P.weapon = wid ? part(wid, 'weapon') : plain('weapon', shapeFam(w.shape), w.color);
    } else P.weapon = null;
    LOOKPARTS.set(look, P);
    return P;
  }
  const keyOf = p => !p ? '-' : p.id || ('~' + p.fam + p.color);
  const gearKey = P => SLOTS.map(s => keyOf(P[s])).join('|');

  // ---------- drawing helpers (the sample's own) ----------
  function metalFill(g, c, y0, y1) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, shade(c, 0.38)); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, -0.32)); return gr; }
  function outline(g, w) { g.strokeStyle = OUT; g.lineWidth = w || 0.8; g.stroke(); }
  function gem(g, x, y, r, c) {
    const gl = g.createRadialGradient(x, y, 0, x, y, r * 2.8); gl.addColorStop(0, c); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; ell(g, x, y, r * 2.8, r * 2.8); g.fill();
    g.fillStyle = c; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.8, y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,40,10,0.6)'; g.lineWidth = 0.4; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)'; ell(g, x - r * 0.2, y - r * 0.35, r * 0.25, r * 0.25); g.fill();
  }
  function sparkle(g, x, y, s, a, col) {
    if (a <= 0 || s <= 0) return;
    g.fillStyle = col.replace('A', a.toFixed(2));
    g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.28, y - s * 0.28); g.lineTo(x + s, y); g.lineTo(x + s * 0.28, y + s * 0.28); g.lineTo(x, y + s); g.lineTo(x - s * 0.28, y + s * 0.28); g.lineTo(x - s, y); g.lineTo(x - s * 0.28, y - s * 0.28); g.closePath(); g.fill();
  }
  function zigzag(g, x0, y0, x1, y1, n, amp) {
    g.beginPath(); g.moveTo(x0, y0);
    for (let k = 1; k <= n; k++) { const t = k / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t); const nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1; const o = k === n ? 0 : (k % 2 ? amp : -amp); g.lineTo(x + nx / L * o, y + ny / L * o); }
    g.stroke();
  }
  function scales(g, x0, y0, cols, rows, sz, col, maxX) {
    g.strokeStyle = col; g.lineWidth = 0.55;
    for (let row = 0; row < rows; row++) for (let k = 0; k < cols; k++) {
      const x = x0 + k * sz * 1.9 + (row % 2) * sz * 0.95, y = y0 + row * sz * 1.5;
      if (maxX !== undefined && Math.abs(x) > maxX) continue;
      g.beginPath(); g.arc(x, y, sz, 0.25, Math.PI - 0.25); g.stroke();
    }
  }

  // ---------- the skill badge on the back of a cape ----------
  function capeBadge(g, id, x, y, col) {
    const k = String(id || '').replace(/^cape_/, '');
    g.save(); g.translate(x, y); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 0.9; g.lineCap = 'round'; g.lineJoin = 'round';
    const line = (a, b, c, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); };
    if (k === 'melee') { line(-2.2, 2.2, 2.2, -2.2); line(-2.4, 0.4, -0.4, 2.4); }
    else if (k === 'defence') { g.beginPath(); g.moveTo(-2, -2.2); g.lineTo(2, -2.2); g.lineTo(2, 0); g.quadraticCurveTo(2, 2, 0, 2.8); g.quadraticCurveTo(-2, 2, -2, 0); g.closePath(); g.fill(); }
    else if (k === 'range') { line(-2.4, 2.4, 2.2, -2.2); g.beginPath(); g.moveTo(2.6, -2.6); g.lineTo(0.8, -2.2); g.lineTo(2.2, -0.8); g.closePath(); g.fill(); }
    else if (k === 'woodcutting') { line(-2, 2.4, 1.2, -1.6); g.beginPath(); g.moveTo(0.4, -2.4); g.quadraticCurveTo(3, -2.6, 2.6, 0); g.closePath(); g.fill(); }
    else if (k === 'mining') { line(-1.8, 2.4, 1, -1); g.beginPath(); g.arc(1, -1, 2.4, Math.PI * 0.9, Math.PI * 1.9); g.stroke(); }
    else if (k === 'fishing') { ell(g, -0.4, 0, 2, 1.2); g.fill(); g.beginPath(); g.moveTo(1.4, 0); g.lineTo(2.8, -1.2); g.lineTo(2.8, 1.2); g.closePath(); g.fill(); }
    else if (k === 'cooking') { g.beginPath(); g.arc(0, 0, 2.3, 0, Math.PI); g.closePath(); g.fill(); line(-2.8, 0, 2.8, 0); }
    else if (k === 'firemaking') { g.beginPath(); g.moveTo(0, -2.8); g.quadraticCurveTo(2.6, 0, 1.4, 2); g.quadraticCurveTo(0, 2.8, -1.4, 2); g.quadraticCurveTo(-2.6, 0, 0, -2.8); g.fill(); }
    else if (k === 'farming') { g.beginPath(); g.moveTo(-2, 2); g.quadraticCurveTo(-2.4, -2.4, 2.4, -2.4); g.quadraticCurveTo(2, 2, -2, 2); g.fill(); }
    else if (k === 'smithing') { g.fillRect(-2.2, -2.2, 4.4, 1.8); line(0, -0.6, 0, 2.6); }
    else if (k === 'crafting') { line(-2.2, 2.2, 2.2, -2.2); g.beginPath(); g.arc(1.6, -1.6, 0.8, 0, 7); g.stroke(); }
    else if (k === 'hitpoints') { g.beginPath(); g.moveTo(0, 2.6); g.bezierCurveTo(-3.4, 0, -1.6, -2.8, 0, -1); g.bezierCurveTo(1.6, -2.8, 3.4, 0, 0, 2.6); g.fill(); }
    else if (k === 'agility') { for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(-1 + i * 1.2, 0.6 - i * 0.9, 0.9, 2.2, 0.7, 0, 7); g.fill(); } }
    else { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 2.7, Math.sin(a) * 2.7); g.stroke(); } }
    g.restore();
  }

  function drawCape(g, C, step, over) {
    const id = C.id || '', c = C.color, skill = /^cape_/.test(id), trim = skill ? shade(c, 0.6) : id === 'guild_cape' ? GOLD : shade(c, 0.35);
    const sway = Math.sin(T * 3 + step) * 0.8 + step * 1.2;
    const path = () => {
      g.beginPath(); g.moveTo(-8, -4);
      g.quadraticCurveTo(-11.5, 5, -11 + sway * 0.4, 14);
      g.quadraticCurveTo(-5, 15.6 + sway * 0.6, 0, 14.6);
      g.quadraticCurveTo(5, 15.6 - sway * 0.6, 11 + sway * 0.4, 14);
      g.quadraticCurveTo(11.5, 5, 8, -4); g.closePath();
    };
    g.save();
    path(); const gr = g.createLinearGradient(0, -4, 0, 15); gr.addColorStop(0, shade(c, 0.12)); gr.addColorStop(1, shade(c, -0.38)); g.fillStyle = gr; g.fill();
    g.save(); path(); g.clip(); g.strokeStyle = trim; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-12 + sway * 0.4, 13.2); g.quadraticCurveTo(-5, 14.8 + sway * 0.6, 0, 13.8); g.quadraticCurveTo(5, 14.8 - sway * 0.6, 12 + sway * 0.4, 13.2); g.stroke(); g.restore();
    path(); outline(g, 0.8);
    if (id === 'gale_cloak' || id === 'scale_cloak') { g.save(); path(); g.clip(); if (id === 'scale_cloak') scales(g, -9, -1, 10, 9, 1.2, shade(c, -0.4)); else { g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 0.6; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-8, 2 + i * 4); g.quadraticCurveTo(0, -1 + i * 4 + Math.sin(T * 3 + i) * 1.2, 8, 2 + i * 4); g.stroke(); } } g.restore(); }
    if (over) {
      g.strokeStyle = shade(c, -0.45); g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(-4, 0); g.quadraticCurveTo(-5, 6, -5.5, 12); g.moveTo(4, 0); g.quadraticCurveTo(5, 6, 5.5, 12); g.stroke();
      if (skill || id === 'guild_cape') { g.fillStyle = trim; ell(g, 0, 5, 3.4, 3.4); g.fill(); g.strokeStyle = shade(c, -0.4); g.lineWidth = 0.6; g.stroke(); capeBadge(g, id, 0, 5, shade(c, -0.25)); }
    }
    g.restore();
  }

  function drawLegs(g, L, B, step) {
    const robe = !!B && B.fam === 'robe';
    const c = L ? L.color : '#5a4632', tier = L && L.tier, wraps = !!L && L.id === 'necro_wraps';
    for (const s of [-1, 1]) {
      const off = step * 1.9 * s, x = s * 3.9, y = 6.5 + off;
      if (!robe) {
        rr(g, x - 2.7, y - 2, 5.4, 6.6, 2); g.fillStyle = L && !wraps ? metalFill(g, c, y - 2, y + 5) : c; g.fill(); outline(g, 0.6);
        if (L && !wraps) {
          g.fillStyle = shade(c, 0.55); ell(g, x, y + 0.6, 2, 1.4); g.fill(); g.strokeStyle = shade(c, -0.5); g.lineWidth = 0.5; g.stroke();
          if (tier === 'blackiron') { g.fillStyle = '#c8ccd4'; g.beginPath(); g.moveTo(x - 0.8, y - 0.2); g.lineTo(x + s * 2.2, y - 1); g.lineTo(x + 0.8, y + 1.2); g.closePath(); g.fill(); }
          if (tier === 'godly' || tier === 'sunstone') { g.strokeStyle = GOLD; g.lineWidth = 0.5; rr(g, x - 2.7, y - 2, 5.4, 6.6, 2); g.stroke(); }
          if (tier === 'stormstone') { g.strokeStyle = 'rgba(240,235,255,0.8)'; g.lineWidth = 0.45; zigzag(g, x - 1.6, y - 1.6, x + 1.4, y + 3, 4, 0.7); }
          // each metal's own mark on the greave (the sample drew bronze to mithril alike)
          if (tier === 'bronze') { g.fillStyle = shade(c, 0.55); ell(g, x - 1.7, y + 2.6, 0.42, 0.42); g.fill(); ell(g, x + 1.7, y + 2.6, 0.42, 0.42); g.fill(); }
          else if (tier === 'iron') { g.fillStyle = shade(c, -0.3); g.fillRect(x - 2.6, y + 2.5, 5.2, 0.8); }
          else if (tier === 'steel') { g.strokeStyle = shade(c, 0.6); g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, y + 1.9); g.lineTo(x, y + 4); g.stroke(); }
          else if (tier === 'mithril') { g.strokeStyle = shade(c, 0.7); g.lineWidth = 0.45; g.beginPath(); g.moveTo(x - 1.2, y + 3.6); g.bezierCurveTo(x - 1, y + 2, x + 1.4, y + 2, x + 0.8, y + 3); g.stroke(); }
          else if (tier === 'sunstone') { g.fillStyle = '#ffcf5a'; ell(g, x, y + 2.9, 0.75, 0.75); g.fill(); }
        } else if (wraps) { g.strokeStyle = shade(c, 0.4); g.lineWidth = 0.7; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x - 2.6, y - 1 + k * 1.8); g.lineTo(x + 2.6, y + k * 1.8); g.stroke(); } }
        else { g.strokeStyle = shade(c, -0.3); g.lineWidth = 0.4; g.beginPath(); g.moveTo(x + s * 0.6, y - 1.6); g.lineTo(x + s * 0.4, y + 3.6); g.stroke(); }
      }
      const boot = L && !wraps ? shade(c, -0.45) : '#3a2a1c';
      rr(g, x - 3, y + 3.8, 6, 3.3, 1.6); g.fillStyle = boot; g.fill(); outline(g, 0.6);
      g.fillStyle = L && !wraps ? shade(c, 0.1) : '#6b4a2e'; g.fillRect(x - 2.9, y + 3.8, 5.8, 0.9);
    }
  }

  function drawTorso(g, B, back) {
    const fam = B && B.fam, c = B && B.color, tier = B && B.tier, bodyId = B && B.id;
    const torso = () => { g.beginPath(); g.moveTo(-8.5, -4); g.quadraticCurveTo(-10.2, 2, -7.6, 8.6); g.lineTo(7.6, 8.6); g.quadraticCurveTo(10.2, 2, 8.5, -4); g.quadraticCurveTo(0, -6.4, -8.5, -4); g.closePath(); };
    const pouch = () => { if (back) return; g.fillStyle = '#6b4a2a'; rr(g, -8.2, 5.4, 3.4, 3.2, 0.9); g.fill(); outline(g, 0.5); g.fillStyle = '#8a6238'; g.fillRect(-8.2, 5.4, 3.4, 1); };
    g.fillStyle = TUNIC; torso(); g.fill(); outline(g, 0.8);
    if (!fam) {
      g.fillStyle = shade(TUNIC, -0.25); ell(g, 0, -3.6, 4, 1.6); g.fill();
      g.strokeStyle = shade(TUNIC, -0.3); g.lineWidth = 0.5; g.beginPath(); g.moveTo(-3, -1); g.quadraticCurveTo(-4, 3, -3.5, 5); g.moveTo(3, -1); g.quadraticCurveTo(4, 3, 3.5, 5); g.stroke();
      g.fillStyle = '#5a3a1e'; g.fillRect(-8.6, 5, 17.2, 2); g.fillStyle = GOLD; g.fillRect(-1.2, 4.8, 2.4, 2.4); g.fillStyle = '#5a3a1e'; g.fillRect(-0.5, 5.4, 1, 1.2);
      pouch(); return;
    }
    if (fam === 'robe') {
      // a long robe from narrow shoulders, flaring a little, open at the front over a dark lining, a cord at the waist, its hem in tatters
      const hemY = 13.2;
      const robe = () => {
        g.beginPath(); g.moveTo(-7.2, -4.6); g.quadraticCurveTo(-8.2, 3, -9.4, hemY);
        const pts = [-9.4, -7.4, -5.6, -3.4, -1.4, 0.6, 2.6, 4.6, 6.6, 8.4, 9.4];
        pts.forEach((x, k) => g.lineTo(x, hemY + (k % 2 ? -1.3 : 0.4)));
        g.quadraticCurveTo(8.2, 3, 7.2, -4.6); g.quadraticCurveTo(0, -6.6, -7.2, -4.6); g.closePath();
      };
      robe(); const gr = g.createLinearGradient(0, -5, 0, 14); gr.addColorStop(0, shade(c, 0.3)); gr.addColorStop(1, shade(c, -0.3)); g.fillStyle = gr; g.fill(); robe(); outline(g, 0.8);
      g.strokeStyle = shade(c, -0.45); g.lineWidth = 0.6; g.beginPath(); g.moveTo(-5, 3); g.quadraticCurveTo(-6.2, 8, -6.4, 12.4); g.moveTo(5, 3); g.quadraticCurveTo(6.2, 8, 6.4, 12.4); g.stroke();
      if (!back) {
        g.beginPath(); g.moveTo(-1, -3.6); g.quadraticCurveTo(-2.2, 6, -3.2, hemY - 0.4); g.lineTo(3.2, hemY - 0.4); g.quadraticCurveTo(2.2, 6, 1, -3.6); g.closePath(); g.fillStyle = '#140f1c'; g.fill();
        g.strokeStyle = '#7d5cc4'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-1, -3.6); g.quadraticCurveTo(-2.2, 6, -3.2, hemY - 0.4); g.moveTo(1, -3.6); g.quadraticCurveTo(2.2, 6, 3.2, hemY - 0.4); g.stroke();
        const glow = 0.55 + Math.sin(T * 3) * 0.25; g.fillStyle = 'rgba(180,140,255,' + glow.toFixed(3) + ')';
        for (const t of [0.35, 0.6, 0.85]) { for (const s of [-1, 1]) { const x = s * lerp(1.2, 3.1, t) * 1.0, y = lerp(-3.4, hemY - 0.6, t); g.fillRect(x - 0.45, y - 0.9, 0.9, 1.8); g.fillRect(x - 0.9, y - 0.45, 1.8, 0.9); } }
        g.fillStyle = '#d8d2c0'; ell(g, 0, -3.4, 1.3, 1.5); g.fill(); g.fillStyle = '#1a1420'; ell(g, -0.45, -3.6, 0.3, 0.35); g.fill(); ell(g, 0.45, -3.6, 0.3, 0.35); g.fill();
      }
      g.strokeStyle = '#cfc5a8'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-7.6, 3.2); g.quadraticCurveTo(0, 4.6, 7.6, 3.2); g.stroke();
      if (!back) { g.beginPath(); g.moveTo(2.2, 3.9); g.quadraticCurveTo(2.8, 6.5, 2.2, 8.2); g.stroke(); ell(g, 2.2, 8.6, 0.6, 0.6); g.fillStyle = '#cfc5a8'; g.fill(); }
      return;
    }
    if (fam === 'cloak') {
      // a cloak over the shoulders, falling open at the front over the tunic, to the knees
      g.fillStyle = '#5a3a1e'; g.fillRect(-8.6, 5, 17.2, 2); g.fillStyle = GOLD; g.fillRect(-1.2, 4.8, 2.4, 2.4);
      const panel = s => {
        g.beginPath(); g.moveTo(s * 1.4, -4.2); g.quadraticCurveTo(s * 5, -5.6, s * 8.4, -4.2);
        g.quadraticCurveTo(s * 10, 3, s * 9.6, 10.6); g.quadraticCurveTo(s * 7.2, 11.8, s * 4.2, 10.9);
        g.quadraticCurveTo(s * 2.4, 4, s * 1.4, -4.2); g.closePath();
      };
      const whole = () => { g.beginPath(); g.moveTo(-8.4, -4.2); g.quadraticCurveTo(-10, 3, -9.6, 10.6); g.quadraticCurveTo(0, 12.6, 9.6, 10.6); g.quadraticCurveTo(10, 3, 8.4, -4.2); g.quadraticCurveTo(0, -6.4, -8.4, -4.2); g.closePath(); };
      const fillIt = () => { const gr = g.createLinearGradient(0, -5, 0, 11); gr.addColorStop(0, shade(c, 0.18)); gr.addColorStop(1, shade(c, -0.3)); g.fillStyle = gr; g.fill(); };
      const parts = back ? [whole] : [() => panel(-1), () => panel(1)];
      for (const p of parts) { p(); fillIt(); p(); outline(g, 0.8); }
      g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.6;
      if (back) { g.beginPath(); g.moveTo(-3.6, -2); g.quadraticCurveTo(-4.4, 4, -4.2, 11); g.moveTo(3.6, -2); g.quadraticCurveTo(4.4, 4, 4.2, 11); g.moveTo(0, -1); g.lineTo(0, 11.6); g.stroke(); }
      else { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6.4, -2.6); g.quadraticCurveTo(s * 7.6, 4, s * 7, 10.8); g.stroke(); } }
      if (bodyId === 'silk_cloak') { const sx = ((T * 9) % 26) - 13; const sh = g.createLinearGradient(sx - 3, 0, sx + 3, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.5)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.save(); for (const p of parts) { p(); } g.clip(); g.fillStyle = sh; g.fillRect(-10, -5, 20, 17); g.restore(); }
      if (bodyId === 'shadow_cloak') { g.strokeStyle = 'rgba(170,120,255,0.55)'; g.lineWidth = 0.7; for (let i = 0; i < 3; i++) { const x = -6 + i * 6, ph = T * 2 + i; g.beginPath(); g.moveTo(x, 10.8); g.quadraticCurveTo(x + Math.sin(ph) * 2, 13, x + Math.sin(ph + 1) * 1.5, 15); g.stroke(); } }
      if (!back) { g.strokeStyle = GOLD; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-1.6, -3.6); g.quadraticCurveTo(0, -2.6, 1.6, -3.6); g.stroke(); g.fillStyle = GOLD; for (const s of [-1, 1]) { ell(g, s * 1.8, -3.8, 1.2, 1.2); g.fill(); outline(g, 0.4); } }
      return;
    }
    // every kind of armour on the body
    g.save(); g.scale(0.97, 0.97); torso(); g.fillStyle = metalFill(g, c, -5, 9); g.fill(); g.restore();
    torso(); outline(g, 0.9);
    if (fam === 'chain') {
      g.save(); torso(); g.clip(); g.fillStyle = shade(c, 0.35);
      for (let y = -4; y < 9; y += 1.6) for (let x = -9 + ((y + 4) / 1.6 % 2) * 0.8; x < 9; x += 1.6) { ell(g, x, y, 0.5, 0.5); g.fill(); }
      g.restore();
      g.fillStyle = 'rgba(0,0,0,0.35)'; for (const [x, y] of [[-4, 0], [3, 4], [5, -1]]) { ell(g, x, y, 1.2, 0.8); g.fill(); }
      g.fillStyle = '#4a3a2a'; g.fillRect(-8.6, 5, 17.2, 1.8); pouch(); return;
    }
    if (!back) { g.strokeStyle = shade(c, 0.6); g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, -4.2); g.lineTo(0, 4.5); g.stroke(); }
    g.strokeStyle = shade(c, -0.42); g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(-7.4, 5.4); g.quadraticCurveTo(0, 6.8, 7.4, 5.4); g.moveTo(-7.6, 7.4); g.quadraticCurveTo(0, 8.8, 7.6, 7.4); g.stroke();
    if (!back && tier !== 'dragon') { g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.moveTo(-6.5, -3.2); g.quadraticCurveTo(-7.5, 0, -6, 3.2); g.lineTo(-5, 3); g.quadraticCurveTo(-6.2, 0, -5.4, -3.4); g.closePath(); g.fill(); }
    if (tier === 'bronze') {
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-7, -3.6); g.lineTo(6.5, 5); g.stroke();
      g.fillStyle = shade(c, 0.55); for (const [x, y] of [[-5, -1.5], [5, -1.5], [-6, 3], [6, 3], [0, 6]]) { ell(g, x, y, 0.55, 0.55); g.fill(); }
    } else if (tier === 'iron') {
      g.fillStyle = shade(c, 0.5); for (const [x, y] of [[-5.5, -2], [5.5, -2], [-6, 2.8], [6, 2.8]]) { ell(g, x, y, 0.5, 0.5); g.fill(); }
    } else if (tier === 'steel') {
      g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.6; g.beginPath(); g.moveTo(-6, 1.5); g.quadraticCurveTo(0, 3, 6, 1.5); g.stroke();
    } else if (tier === 'mithril') {
      g.strokeStyle = shade(c, 0.7); g.lineWidth = 0.55;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.2, -1); g.bezierCurveTo(s * 4.5, -3, s * 5.5, 1, s * 3, 1.4); g.bezierCurveTo(s * 1.8, 1.6, s * 2, 0, s * 3, 0.2); g.stroke(); }
    } else if (tier === 'blackiron') {
      if (!back) { g.fillStyle = '#b8323a'; g.fillRect(-0.8, -4, 1.6, 9); }
    } else if (tier === 'sunstone') {
      g.strokeStyle = 'rgba(255,230,150,0.75)'; g.lineWidth = 0.5;
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 2.8, 0.5 + Math.sin(a) * 2.8); g.lineTo(Math.cos(a) * 5.2, 0.5 + Math.sin(a) * 4.6); g.stroke(); }
    } else if (tier === 'stormstone') {
      g.strokeStyle = 'rgba(240,235,255,0.85)'; g.lineWidth = 0.55; zigzag(g, -6, -3, -2.5, 5.5, 5, 0.9); zigzag(g, 6, -3, 2.5, 5.5, 5, 0.9);
      sparkle(g, 6.5, -4, 1.6, Math.max(0, Math.sin(T * 4)), 'rgba(255,255,255,A)');
    } else if (tier === 'dragon') {
      g.save(); torso(); g.clip(); scales(g, -8, -2, 9, 6, 1.3, shade(c, -0.45)); g.restore();
      g.strokeStyle = GOLD; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-6, -4.2); g.quadraticCurveTo(0, -6, 6, -4.2); g.stroke();
    } else if (tier === 'godly') {
      g.strokeStyle = GOLD; g.lineWidth = 1; torso(); g.stroke();
      if (!back) { g.fillStyle = '#ffffff'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.8, 0); g.quadraticCurveTo(s * 5, -3.5, s * 6.5, -1); g.quadraticCurveTo(s * 4, 0.2, s * 0.8, 1.6); g.closePath(); g.fill(); g.strokeStyle = 'rgba(180,150,80,0.6)'; g.lineWidth = 0.4; g.stroke(); } }
    } else if (fam === 'hover') {
      const p = (0.5 + Math.sin(T * 8) * 0.3).toFixed(3);
      for (const s of [-1, 1]) { const gl = g.createRadialGradient(s * 6, 9, 0, s * 6, 9, 4.5); gl.addColorStop(0, `rgba(160,230,255,${p})`); gl.addColorStop(1, 'rgba(160,230,255,0)'); g.fillStyle = gl; ell(g, s * 6, 9, 4.5, 4.5); g.fill(); }
      g.strokeStyle = 'rgba(200,240,255,0.8)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-5, -1); g.lineTo(5, -1); g.stroke();
    }
    if (tier === 'ruined') { g.fillStyle = 'rgba(0,0,0,0.3)'; ell(g, -3, 0, 1.4, 1); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(3, -3); g.lineTo(4.5, 0); g.lineTo(3.6, 2); g.stroke(); }
    const gc = gemOf(bodyId); if (gc && !back) gem(g, 0, 0.5, 1.9, gc);
    g.fillStyle = 'rgba(40,26,14,0.9)'; g.fillRect(-8.2, 5.6, 16.4, 1.1);
    pouch();
  }

  // the shoulders (pauldrons on armour)
  function drawShoulders(g, B) {
    const fam = B && B.fam, c = B ? B.color : TUNIC, tier = B && B.tier;
    for (const s of [-1, 1]) {
      const y = -2.6;
      if (fam === 'plate' || fam === 'hover') {
        ell(g, s * 9, y, 4.6, 3.6, s * 0.25); g.fillStyle = metalFill(g, c, y - 4, y + 4); g.fill(); outline(g, 0.7);
        if (tier === 'steel' || tier === 'mithril' || tier === 'godly' || tier === 'sunstone' || tier === 'stormstone') { ell(g, s * 9.4, y + 1.8, 3.8, 2.4, s * 0.25); g.fillStyle = shade(c, -0.12); g.fill(); outline(g, 0.5); }
        g.strokeStyle = shade(c, 0.65); g.lineWidth = 0.7; g.beginPath(); g.arc(s * 9, y - 0.6, 2.8, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
        if (tier === 'godly' || tier === 'dragon' || tier === 'sunstone') { g.strokeStyle = GOLD; g.lineWidth = 0.6; ell(g, s * 9, y, 4.6, 3.6, s * 0.25); g.stroke(); }
        if (tier === 'blackiron' || tier === 'dragon') { g.fillStyle = tier === 'dragon' ? '#efe6d0' : '#c8ccd4'; for (const k of [0, 1]) { const bx = s * (8 + k * 2.4), by = y - 2.6 + k * 0.6; g.beginPath(); g.moveTo(bx - 1, by + 0.8); g.lineTo(bx + s * 0.6, by - 2.4); g.lineTo(bx + 1, by + 0.8); g.closePath(); g.fill(); } }
        if (tier === 'bronze' || tier === 'iron') { g.fillStyle = shade(c, 0.55); ell(g, s * 9, y + 0.4, 0.55, 0.55); g.fill(); }
      } else if (fam === 'chain') {
        ell(g, s * 8.8, y + 0.6, 3.8, 3.3); g.fillStyle = shade(c, -0.05); g.fill(); outline(g, 0.6);
      } else {
        ell(g, s * 8.8, y + 0.6, 3.6, 3.2); g.fillStyle = fam ? shade(c, -0.1) : shade(TUNIC, 0.08); g.fill(); outline(g, 0.6);
      }
    }
  }
  const handOf = B => { const f = B && B.fam; return f === 'plate' || f === 'hover' ? shade(B.color, -0.15) : f === 'chain' ? '#6b4a2e' : SKIN; };
  function drawOffHand(g, B, step) { ell(g, -10.4, 3.4 - step * 1.4, 2, 2); g.fillStyle = handOf(B); g.fill(); outline(g, 0.5); }
  // the weapon hand: a hand (or a gauntlet) floating by the shoulder plate, gripping the weapon; no arm (owner's call)
  function drawWeaponArm(g, B, hx, hy) { ell(g, hx, hy, 2.2, 2.2); g.fillStyle = handOf(B); g.fill(); outline(g, 0.5); }

  function drawShield(g, S, back) {
    const fam = S.fam, c = S.color, tier = S.tier, id = S.id;
    g.save();
    if (fam === 'lantern') {
      g.translate(-11.5, 4);
      g.strokeStyle = '#6a6f7a'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, -3); g.lineTo(0, 0); g.stroke();
      const p = (0.55 + Math.sin(T * 4) * 0.25).toFixed(3);
      const gl = g.createRadialGradient(0, 3.5, 0, 0, 3.5, 9); gl.addColorStop(0, `rgba(126,231,200,${p})`); gl.addColorStop(1, 'rgba(126,231,200,0)'); g.fillStyle = gl; ell(g, 0, 3.5, 9, 9); g.fill();
      rr(g, -2.6, 0, 5.2, 7, 1.2); g.fillStyle = '#2b2f37'; g.fill(); outline(g, 0.5);
      rr(g, -1.6, 1.2, 3.2, 4.6, 0.8); g.fillStyle = c; g.fill();
      g.fillStyle = '#2b2f37'; g.fillRect(-0.3, 1, 0.6, 5); g.beginPath(); g.moveTo(-2.8, 0); g.lineTo(0, -1.6); g.lineTo(2.8, 0); g.closePath(); g.fill();
      const fl = (0.6 + Math.sin(T * 9) * 0.25).toFixed(3); g.fillStyle = `rgba(230,255,245,${fl})`; ell(g, 0, 3.6, 0.7, 1.1); g.fill();
      g.restore(); return;
    }
    if (back) { g.translate(0, 1); g.scale(0.95, 0.95); } else { g.translate(-11.2, 2.2); g.rotate(-0.12); }
    const round = tier === 'bronze' || tier === 'sunstone';
    const kite = tier === 'iron' || tier === 'dragon';
    const shape = () => {
      g.beginPath();
      if (round) { g.arc(0, 1.2, 6.4, 0, Math.PI * 2); }
      else if (kite) { g.moveTo(0, -6.8); g.quadraticCurveTo(5.4, -6, 5.2, -0.5); g.quadraticCurveTo(4.6, 5.8, 0, 10); g.quadraticCurveTo(-4.6, 5.8, -5.2, -0.5); g.quadraticCurveTo(-5.4, -6, 0, -6.8); }
      else { g.moveTo(-5.2, -6); g.lineTo(5.2, -6); g.lineTo(5.2, -0.5); g.quadraticCurveTo(5.2, 5.8, 0, 9.2); g.quadraticCurveTo(-5.2, 5.8, -5.2, -0.5); }
      g.closePath();
    };
    shape(); g.fillStyle = metalFill(g, c, -6, 9); g.fill();
    g.strokeStyle = tier === 'godly' || tier === 'dragon' || tier === 'sunstone' ? GOLD : shade(c, -0.55); g.lineWidth = 1.2; shape(); g.stroke();
    shape(); outline(g, 0.6);
    if (!back) {
      if (tier === 'bronze') { g.strokeStyle = shade(c, -0.35); g.lineWidth = 0.6; g.beginPath(); g.arc(0, 1.2, 4.2, 0, 7); g.stroke(); ell(g, 0, 1.2, 1.9, 1.9); g.fillStyle = shade(c, 0.5); g.fill(); outline(g, 0.4); g.fillStyle = shade(c, 0.5); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ell(g, Math.cos(a) * 5.4, 1.2 + Math.sin(a) * 5.4, 0.45, 0.45); g.fill(); } }
      else if (tier === 'iron') { g.fillStyle = shade(c, -0.3); g.fillRect(-5, -1.2, 10, 2.2); ell(g, 0, 0, 1.8, 1.8); g.fillStyle = shade(c, 0.6); g.fill(); }
      else if (tier === 'steel') { g.fillStyle = shade(c, -0.3); g.fillRect(-0.9, -5.4, 1.8, 13); g.fillRect(-4.8, -1.6, 9.6, 1.8); }
      else if (tier === 'mithril') { g.strokeStyle = shade(c, 0.75); g.lineWidth = 0.55; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -4); g.bezierCurveTo(s * 4, -4, s * 4, 1, s * 1.4, 2); g.bezierCurveTo(s * 0.4, 2.3, s * 0.6, 0.6, s * 1.6, 0.8); g.stroke(); } gem(g, 0, 3.6, 1.3, '#bfe3ff'); }
      else if (tier === 'sunstone') { g.strokeStyle = 'rgba(255,230,150,0.8)'; g.lineWidth = 0.55; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 2.6, 1.2 + Math.sin(a) * 2.6); g.lineTo(Math.cos(a) * 5.2, 1.2 + Math.sin(a) * 5.2); g.stroke(); } gem(g, 0, 1.2, 1.6, gemOf(id) || '#ffcf5a'); }
      else if (tier === 'stormstone') { g.strokeStyle = '#ffffff'; g.lineWidth = 1; zigzag(g, 1.6, -4.6, -1.2, 6.5, 4, 1.6); sparkle(g, 3.2, -3.4, 1.4, Math.max(0, Math.sin(T * 5)), 'rgba(255,255,255,A)'); }
      else if (tier === 'dragon') {
        g.fillStyle = '#3a0f10'; g.beginPath(); g.moveTo(-3.2, -3.6); g.lineTo(0, -1); g.lineTo(3.2, -3.6); g.lineTo(2.2, 2); g.lineTo(0, 5.5); g.lineTo(-2.2, 2); g.closePath(); g.fill();
        g.fillStyle = '#ffb24a'; ell(g, -1.2, 0.2, 0.6, 0.6); g.fill(); ell(g, 1.2, 0.2, 0.6, 0.6); g.fill();
      } else if (tier === 'godly') {
        g.fillStyle = GOLD; ell(g, 0, 0.6, 2.2, 2.2); g.fill();
        g.strokeStyle = GOLD; g.lineWidth = 0.7; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 2.8, 0.6 + Math.sin(a) * 2.8); g.lineTo(Math.cos(a) * 4, 0.6 + Math.sin(a) * 4); g.stroke(); }
      } else if (tier === 'scale') { g.save(); shape(); g.clip(); scales(g, -5, -4, 6, 7, 1.2, shade(c, -0.45)); g.restore(); }
      else { ell(g, 0, 0, 1.8, 1.8); g.fillStyle = shade(c, 0.6); g.fill(); }
    }
    g.restore();
  }

  function drawHead(g, H, fxm, fy, back) {
    const fam = H && H.fam, c = H && H.color, tier = H && H.tier, helmId = H && H.id;
    const hy = -10.2, r = 7.4;
    const eyes = (col, glow) => {
      if (back) return;
      const ex = fxm * 1.8, ey = fy * 1.4;
      if (glow) { const gl = g.createRadialGradient(ex, hy + 0.6 + ey, 0, ex, hy + 0.6 + ey, 5); gl.addColorStop(0, 'rgba(180,140,255,0.55)'); gl.addColorStop(1, 'rgba(180,140,255,0)'); g.fillStyle = gl; ell(g, ex, hy + 0.6 + ey, 5, 4); g.fill(); }
      g.fillStyle = col; ell(g, -2.6 + ex, hy + 0.8 + ey, 1.1, 1.25); g.fill(); ell(g, 2.6 + ex, hy + 0.8 + ey, 1.1, 1.25); g.fill();
      if (!glow) { g.fillStyle = 'rgba(255,255,255,0.85)'; ell(g, -2.3 + ex, hy + 0.4 + ey, 0.35, 0.35); g.fill(); ell(g, 2.9 + ex, hy + 0.4 + ey, 0.35, 0.35); g.fill(); }
    };
    const brows = () => {
      if (back) return;
      const ex = fxm * 1.8, ey = fy * 1.4;
      g.strokeStyle = shade(HAIR, -0.2); g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(-3.6 + ex, hy - 1.1 + ey); g.lineTo(-1.6 + ex, hy - 1.4 + ey); g.moveTo(1.6 + ex, hy - 1.4 + ey); g.lineTo(3.6 + ex, hy - 1.1 + ey); g.stroke();
      // a girl: rosier cheeks and lashes at the eyes' outer corners
      g.fillStyle = GIRL ? 'rgba(232,108,120,0.5)' : 'rgba(230,120,110,0.35)';
      ell(g, -4 + ex, hy + 2.6 + ey, GIRL ? 1.5 : 1.3, GIRL ? 0.95 : 0.8); g.fill(); ell(g, 4 + ex, hy + 2.6 + ey, GIRL ? 1.5 : 1.3, GIRL ? 0.95 : 0.8); g.fill();
      if (GIRL) {
        g.strokeStyle = '#222'; g.lineWidth = 0.5; g.beginPath();
        for (const s of [-1, 1]) { const x = s * 2.6 + ex, y = hy + 0.8 + ey; g.moveTo(x + s * 0.8, y - 0.7); g.lineTo(x + s * 1.9, y - 1.4); g.moveTo(x + s * 0.3, y - 1.1); g.lineTo(x + s * 0.8, y - 2.1); }
        g.stroke();
      }
    };
    const hair = () => {
      g.fillStyle = HAIR;
      if (back) { ell(g, 0, hy, r + 0.3, r + 0.3); g.fill(); outline(g, 0.7); return; }
      g.beginPath(); g.arc(0, hy - 0.6, r + 0.3, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(4, hy - 4, 0, hy - 3.2); g.quadraticCurveTo(-4, hy - 4.6, -r, hy - 1); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-1, hy - r); g.quadraticCurveTo(1, hy - r - 3, 2.6, hy - r - 1.6); g.quadraticCurveTo(1, hy - r - 0.6, 0.6, hy - r + 0.6); g.fill();
    };
    const face = () => { ell(g, 0, hy, r, r); g.fillStyle = SKIN; g.fill(); outline(g, 0.8); };
    const helmBall = (fill) => { ell(g, 0, hy, r + 0.6, r + 0.6); g.fillStyle = fill || metalFill(g, c, hy - r, hy + r); g.fill(); outline(g, 0.9); };
    const slit = (col) => { if (back) return; const ox = fxm * 1.6, oy = fy * 1.2; rr(g, -5.2 + ox, hy - 0.2 + oy, 10.4, 1.5, 0.75); g.fillStyle = '#121418'; g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-4.6 + ox, hy - 0.6 + oy, 9.2, 0.4); if (col) { g.fillStyle = col; ell(g, -2.4 + ox, hy + 0.5 + oy, 0.9, 0.55); g.fill(); ell(g, 2.4 + ox, hy + 0.5 + oy, 0.9, 0.55); g.fill(); } };
    const ridge = (col) => { g.strokeStyle = col || shade(c, 0.6); g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, hy - r - 0.4); g.lineTo(0, hy - 2.4); g.stroke(); };

    if (!fam) { face(); hair(); brows(); eyes('#222'); return; }
    if (fam === 'metal') {
      if (tier === 'bronze') {
        // a crested bronze helm with cheek guards
        face(); brows(); eyes('#222');
        g.beginPath(); g.arc(0, hy - 0.2, r + 0.9, Math.PI, 0); g.lineTo(r + 0.9, hy + 3.6); g.lineTo(r - 2, hy + 4.2); g.lineTo(r - 2.6, hy + 0.8); g.lineTo(-r + 2.6, hy + 0.8); g.lineTo(-r + 2, hy + 4.2); g.lineTo(-r - 0.9, hy + 3.6); g.closePath();
        g.fillStyle = metalFill(g, c, hy - 9, hy + 4); g.fill(); outline(g, 0.8);
        g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(-1.2, hy - r - 0.4); g.quadraticCurveTo(0, hy - r - 5.5, 6.5, hy - r - 2.6); g.quadraticCurveTo(3, hy - r - 1.2, 1.2, hy - r + 0.4); g.closePath(); g.fill(); outline(g, 0.5);
        g.fillStyle = shade(c, 0.55); for (const x of [-5.5, -2.6, 2.6, 5.5]) { ell(g, x, hy - 1.2, 0.5, 0.5); g.fill(); }
        return;
      }
      if (tier === 'iron' || tier === 'ruined') {
        // a nasal helm
        face(); brows(); eyes('#222');
        g.beginPath(); g.arc(0, hy - 0.4, r + 0.8, Math.PI, 0); g.closePath(); g.fillStyle = metalFill(g, c, hy - 9, hy); g.fill(); outline(g, 0.8);
        g.fillStyle = shade(c, -0.25); g.fillRect(-r - 0.8, hy - 1.6, (r + 0.8) * 2, 2.2);
        g.fillStyle = shade(c, 0.55); for (const x of [-5.5, -2, 2, 5.5]) { ell(g, x, hy - 0.5, 0.55, 0.55); g.fill(); }
        if (!back) { g.fillStyle = shade(c, -0.15); g.fillRect(-0.8 + fxm * 1.2, hy - 0.6, 1.6, 4.4); }
        ridge();
        if (tier === 'ruined') { g.strokeStyle = shade(c, -0.6); g.lineWidth = 0.7; g.beginPath(); g.moveTo(-2, hy - 7); g.lineTo(0, hy - 4); g.lineTo(-1, hy - 2); g.stroke(); g.fillStyle = 'rgba(0,0,0,0.3)'; ell(g, 3.5, hy - 5, 1.2, 0.8); g.fill(); }
        return;
      }
      if (tier === 'steel') {
        // a great helm: flat-sided, a slit and breathing holes
        rr(g, -r - 0.4, hy - r - 0.4, (r + 0.4) * 2, (r + 0.4) * 2 + 0.8, 3.4); g.fillStyle = metalFill(g, c, hy - r, hy + r); g.fill(); outline(g, 0.9);
        slit();
        if (!back) { g.fillStyle = '#121418'; for (const [x, y] of [[2.6, 3], [4, 3], [2.6, 4.3], [4, 4.3]]) { ell(g, x + fxm * 1.2, hy + y, 0.42, 0.42); g.fill(); } }
        ridge(); g.fillStyle = shade(c, 0.55); for (const x of [-5.6, 5.6]) { ell(g, x, hy - 3.2, 0.5, 0.5); g.fill(); }
        return;
      }
      if (tier === 'mithril') {
        // a full helm with a crest and a flowing plume
        const wave = Math.sin(T * 4) * 1.2;
        g.fillStyle = '#3c6fb6'; g.beginPath(); g.moveTo(0, hy - r - 1); g.quadraticCurveTo(-4, hy - r - 7, -11 + wave, hy - r - 2 + wave * 0.4); g.quadraticCurveTo(-6, hy - r - 2, -1.5, hy - r + 1); g.closePath(); g.fill(); outline(g, 0.5);
        g.fillStyle = '#a8c6f0'; g.beginPath(); g.moveTo(0, hy - r - 1); g.quadraticCurveTo(-3.6, hy - r - 5.4, -8.5 + wave, hy - r - 2.6 + wave * 0.4); g.quadraticCurveTo(-4.5, hy - r - 2, -1, hy - r); g.closePath(); g.fill();
        helmBall(); slit(); ridge(shade(c, 0.75));
        g.strokeStyle = shade(c, 0.75); g.lineWidth = 0.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2, hy - 4); g.bezierCurveTo(s * 5.5, hy - 6, s * 6, hy - 2.2, s * 4, hy - 2.4); g.stroke(); }
        return;
      }
      if (tier === 'blackiron') {
        for (const x of [-4, 0, 4]) { g.fillStyle = '#c8ccd4'; g.beginPath(); g.moveTo(x - 1.2, hy - r + 1.6); g.lineTo(x, hy - r - 3.4 + (x === 0 ? -1.2 : 0)); g.lineTo(x + 1.2, hy - r + 1.6); g.closePath(); g.fill(); outline(g, 0.4); }
        helmBall(); slit('#ff4a3a'); g.fillStyle = '#b8323a'; g.fillRect(-0.7, hy - r, 1.4, 4.6);
        return;
      }
      if (tier === 'sunstone') {
        for (let k = 0; k < 7; k++) { const a = Math.PI + 0.25 + k * (Math.PI - 0.5) / 6; g.fillStyle = GOLD; g.beginPath(); g.moveTo(Math.cos(a - 0.12) * (r + 0.4), hy + Math.sin(a - 0.12) * (r + 0.4)); g.lineTo(Math.cos(a) * (r + 3.6), hy + Math.sin(a) * (r + 3.6)); g.lineTo(Math.cos(a + 0.12) * (r + 0.4), hy + Math.sin(a + 0.12) * (r + 0.4)); g.closePath(); g.fill(); }
        helmBall(); slit(); gem(g, 0, hy - 4.2, 1.4, gemOf(helmId) || '#ffcf5a');
        return;
      }
      if (tier === 'stormstone') {
        for (const s of [-1, 1]) { g.fillStyle = '#efe8ff'; g.beginPath(); g.moveTo(s * 6, hy - 2); g.lineTo(s * 11, hy - 8); g.lineTo(s * 8.6, hy - 6.4); g.lineTo(s * 11.6, hy - 11.6); g.lineTo(s * 6.4, hy - 6.6); g.lineTo(s * 8, hy - 5.6); g.closePath(); g.fill(); outline(g, 0.4); }
        helmBall(); slit('#e9e2ff'); gem(g, 0, hy - 4.2, 1.3, gemOf(helmId) || '#efe8ff');
        sparkle(g, 9, hy - 12, 1.8, Math.max(0, Math.sin(T * 4.5)), 'rgba(255,255,255,A)');
        return;
      }
      if (tier === 'stoneheart') {
        helmBall(); g.fillStyle = 'rgba(40,36,30,0.35)'; for (const [x, y, s] of [[-3, -4, 1.6], [3, -2, 1.2], [-1, 2, 1], [4, -6, 0.9], [-5, 0, 1.1]]) { ell(g, x, hy + y, s, s * 0.8); g.fill(); }
        g.fillStyle = '#6aa04a'; ell(g, -4.6, hy - 5.6, 1.4, 0.9, -0.5); g.fill(); slit();
        return;
      }
      if (tier === 'obsidian') {
        helmBall(); g.strokeStyle = 'rgba(200,170,255,0.45)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-r, hy - 1); g.lineTo(-2, hy - r + 0.5); g.lineTo(3, hy - 2); g.lineTo(r, hy - 4); g.stroke();
        slit('#c08cff'); sparkle(g, -3.5, hy - 5, 1.4, Math.max(0, Math.sin(T * 3.4)), 'rgba(220,190,255,A)');
        return;
      }
      if (tier === 'scale') { helmBall(); g.save(); ell(g, 0, hy, r + 0.6, r + 0.6); g.clip(); scales(g, -7, hy - 7, 8, 5, 1.2, shade(c, -0.45)); g.restore(); slit(); return; }
      helmBall(); slit(); ridge(); return;
    }
    if (fam === 'winged') {
      const flap = Math.sin(T * 5) * 0.08;
      for (const s of [-1, 1]) {
        g.save(); g.translate(s * 6.6, hy - 3); g.rotate(s * (-0.5 - flap));
        for (let k = 0; k < 4; k++) { ell(g, s * (2 + k * 1.1), -2 - k * 1.5, 1.6, 4.4 - k * 0.6, s * 0.4); g.fillStyle = ['#ffffff', '#f2f3f7', '#e3e6ee', '#d4d8e2'][k]; g.fill(); g.strokeStyle = 'rgba(120,120,140,0.5)'; g.lineWidth = 0.35; g.stroke(); }
        g.restore();
      }
      helmBall(); slit(); g.strokeStyle = GOLD; g.lineWidth = 0.9; ell(g, 0, hy, r + 0.6, r + 0.6); g.stroke();
      g.fillStyle = GOLD; g.fillRect(-0.7, hy - r, 1.4, 4);
      sparkle(g, -7, hy - 9, 1.5, Math.max(0, Math.sin(T * 2.6)), 'rgba(255,240,180,A)');
      return;
    }
    if (fam === 'horned') {
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(s * 4, hy - 5); g.quadraticCurveTo(s * 11, hy - 9, s * 9.5, hy - 15.5); g.quadraticCurveTo(s * 8, hy - 10, s * 2.5, hy - 7.2); g.closePath();
        const hg = g.createLinearGradient(s * 3, hy - 6, s * 10, hy - 15); hg.addColorStop(0, '#d8cdb2'); hg.addColorStop(1, '#fbf6e8'); g.fillStyle = hg; g.fill(); outline(g, 0.5);
        g.strokeStyle = 'rgba(120,100,70,0.5)'; g.lineWidth = 0.4; for (const t of [0.35, 0.6]) { g.beginPath(); g.moveTo(s * (4 + t * 6), hy - 6 - t * 3); g.lineTo(s * (3 + t * 6.5), hy - 7.6 - t * 3.6); g.stroke(); }
      }
      helmBall(); slit('#ffb24a');
      g.fillStyle = shade(c, -0.45); for (const x of [-2.5, 0, 2.5]) { g.beginPath(); g.moveTo(x - 1.1, hy - r + 1.4); g.lineTo(x, hy - r - 2.2); g.lineTo(x + 1.1, hy - r + 1.4); g.closePath(); g.fill(); }
      g.save(); ell(g, 0, hy, r + 0.6, r + 0.6); g.clip(); scales(g, -7, hy + 2, 8, 2, 1.1, shade(c, -0.45)); g.restore();
      return;
    }
    if (fam === 'party') {
      face(); hair(); brows(); eyes('#222');
      g.save(); g.translate(0.8, hy - r + 1.2); g.rotate(0.22);
      g.beginPath(); g.moveTo(-5.4, 0); g.lineTo(0, -13); g.lineTo(5.4, 0); g.closePath();
      const gr = g.createLinearGradient(-5, 0, 5, 0); gr.addColorStop(0, shade(c, 0.2)); gr.addColorStop(1, shade(c, -0.2)); g.fillStyle = gr; g.fill();
      g.save(); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.4; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-8, -1 - k * 3.6); g.lineTo(8, -4 - k * 3.6); g.stroke(); } g.fillStyle = '#ffe36b'; for (const [x, y] of [[-2, -3], [1.6, -6.4], [-0.6, -9.6]]) { ell(g, x, y, 0.6, 0.6); g.fill(); } g.restore();
      g.beginPath(); g.moveTo(-5.4, 0); g.lineTo(0, -13); g.lineTo(5.4, 0); g.closePath(); outline(g, 0.6);
      ell(g, 0, -13, 2.1, 2.1); g.fillStyle = '#ffffff'; g.fill(); outline(g, 0.4);
      ell(g, 0, 0, 5.6, 1.2); g.fillStyle = shade(c, -0.3); g.fill();
      g.strokeStyle = '#f2f2f2'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-4.6, 0.6); g.quadraticCurveTo(-4, 5, -2.6, 6.4); g.stroke();
      g.restore();
      const tw = (Math.sin(T * 3.1) + 1) / 2, tw2 = (Math.sin(T * 2.3 + 2) + 1) / 2;
      sparkle(g, 7.5, hy - 13, 3 * Math.max(0, (tw - 0.5) / 0.5), 1, 'rgba(255,236,140,A)');
      sparkle(g, -5.5, hy - 17, 2.2 * Math.max(0, (tw2 - 0.55) / 0.45), 1, 'rgba(255,255,255,A)');
      return;
    }
    if (fam === 'goggles') {
      face(); brows(); eyes('#222');
      g.beginPath(); g.arc(0, hy - 0.6, r + 0.4, Math.PI, 0); g.closePath(); g.fillStyle = '#6b4a2a'; g.fill(); outline(g, 0.7);
      g.strokeStyle = '#4a321c'; g.lineWidth = 0.4; for (const x of [-3, 0, 3]) { g.beginPath(); g.moveTo(x, hy - r); g.lineTo(x * 1.2, hy - 1.4); g.stroke(); }
      g.fillStyle = shade('#c9a36a', -0.25); g.fillRect(-r - 0.4, hy - 3.4, (r + 0.4) * 2, 1.8);
      if (!back) for (const x of [-3, 3]) {
        ell(g, x, hy - 3.6, 2.8, 2.8); g.fillStyle = '#b98a3a'; g.fill(); outline(g, 0.5);
        const gl = g.createRadialGradient(x - 0.8, hy - 4.4, 0.2, x, hy - 3.6, 2.2); gl.addColorStop(0, '#e8f6ff'); gl.addColorStop(1, '#4f88b0'); g.fillStyle = gl; ell(g, x, hy - 3.6, 1.95, 1.95); g.fill();
        g.fillStyle = '#8a6a2a'; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.6; ell(g, x + Math.cos(a) * 2.4, hy - 3.6 + Math.sin(a) * 2.4, 0.35, 0.35); g.fill(); }
      }
      return;
    }
    if (fam === 'hood') {
      g.beginPath(); g.moveTo(-9.5, hy + 6); g.quadraticCurveTo(-10.5, hy - 6, 0, hy - r - 2.5); g.quadraticCurveTo(10.5, hy - 6, 9.5, hy + 6); g.quadraticCurveTo(0, hy + 4, -9.5, hy + 6); g.closePath();
      const gr = g.createLinearGradient(0, hy - 10, 0, hy + 6); gr.addColorStop(0, shade(c, 0.28)); gr.addColorStop(1, shade(c, -0.3)); g.fillStyle = gr; g.fill(); outline(g, 0.8);
      g.strokeStyle = '#7d5cc4'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-9.3, hy + 5.6); g.quadraticCurveTo(0, hy + 3.6, 9.3, hy + 5.6); g.stroke();
      if (!back) { g.fillStyle = '#0d0912'; ell(g, fxm * 1.4, hy + 0.6 + fy, 5.2, 4.8); g.fill(); eyes('#c9a6ff', true); }
      else { g.strokeStyle = shade(c, -0.45); g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, hy - r - 2); g.lineTo(0, hy + 4); g.stroke(); }
    }
  }

  // ---------- the girl knight (79-boygirl's look.girl), in the same style ----------
  // the head is (0,-10.2) r 7.4; the shoulder pads (±9,-2.6); the belt at y 5.6; the legs from 4.5 to 11
  const showsHair = H => !H || H.fam === 'party' || H.fam === 'goggles';
  const underRim = H => !!H && (H.fam === 'metal' || H.fam === 'winged' || H.fam === 'horned');
  // a short flared skirt in the tunic's colour, from the belt over the tops of the legs (under plate's lower edge, under
  // a cloak's panels); the robe is long already, so no skirt with it
  function girlSkirt(g, B) {
    if (B && B.fam === 'robe') return;
    const sk = () => {
      g.beginPath(); g.moveTo(-7.6, 4.4); g.quadraticCurveTo(-9.4, 7.2, -10.2, 10.4);
      g.quadraticCurveTo(-7.6, 11.7, -5.1, 10.7); g.quadraticCurveTo(-2.6, 11.9, 0, 10.9); g.quadraticCurveTo(2.6, 11.9, 5.1, 10.7); g.quadraticCurveTo(7.6, 11.7, 10.2, 10.4);
      g.quadraticCurveTo(9.4, 7.2, 7.6, 4.4); g.closePath();
    };
    sk(); const gr = g.createLinearGradient(0, 4.4, 0, 11.8); gr.addColorStop(0, shade(TUNIC, 0.06)); gr.addColorStop(1, shade(TUNIC, -0.3)); g.fillStyle = gr; g.fill(); outline(g, 0.7);
    g.strokeStyle = shade(TUNIC, -0.38); g.lineWidth = 0.5; g.beginPath();
    for (const x of [-5.6, -1.9, 1.9, 5.6]) { g.moveTo(x * 0.78, 6.6); g.lineTo(x, 10.6); }
    g.stroke();
    g.strokeStyle = shade(TUNIC, 0.45); g.lineWidth = 0.55; g.beginPath(); g.moveTo(-9.6, 10); g.quadraticCurveTo(-7.6, 11.1, -5.1, 10.2); g.quadraticCurveTo(-2.6, 11.3, 0, 10.4); g.quadraticCurveTo(2.6, 11.3, 5.1, 10.2); g.quadraticCurveTo(7.6, 11.1, 9.6, 10); g.stroke();
  }
  // long hair behind the face, falling to the shoulders (a bare head, a party hat, goggles), drawn before the head
  function girlHairBehind(g) {
    g.fillStyle = HAIR;
    g.beginPath(); g.moveTo(-7.6, -13); g.quadraticCurveTo(-10, -6, -8.8, -1.4); g.quadraticCurveTo(-6.8, -0.2, -4.8, -1.8); g.lineTo(4.8, -1.8); g.quadraticCurveTo(6.8, -0.2, 8.8, -1.4); g.quadraticCurveTo(10, -6, 7.6, -13); g.closePath(); g.fill(); outline(g, 0.6);
    g.strokeStyle = shade(HAIR, -0.32); g.lineWidth = 0.45; g.beginPath();
    for (const s of [-1, 1]) { g.moveTo(s * 7.8, -8); g.quadraticCurveTo(s * 8.8, -4.6, s * 7.6, -1.6); }
    g.stroke();
  }
  // after the head: locks at the cheeks (bare / party / goggles) or under a helm's rim; the long hair down the back
  function girlHairAfter(g, H, back) {
    const hy = -10.2;
    if (back) {
      if (!showsHair(H)) return;
      g.fillStyle = HAIR;
      g.beginPath(); g.moveTo(-7.4, -11.4); g.quadraticCurveTo(-9, -4.6, -7.4, 0.4); g.quadraticCurveTo(0, 2.4, 7.4, 0.4); g.quadraticCurveTo(9, -4.6, 7.4, -11.4); g.closePath(); g.fill(); outline(g, 0.6);
      g.strokeStyle = shade(HAIR, -0.32); g.lineWidth = 0.45; g.beginPath(); for (const x of [-3.6, 0, 3.6]) { g.moveTo(x, -8); g.quadraticCurveTo(x * 1.15, -3.6, x * 1.05, 0.8); } g.stroke();
      return;
    }
    if (H && H.fam === 'hood') return;
    if (showsHair(H)) { for (const s of [-1, 1]) { g.fillStyle = HAIR; ell(g, s * 6.5, hy + 2.6, 1.5, 3.4, -s * 0.16); g.fill(); outline(g, 0.45); } return; }
    if (underRim(H)) { for (const s of [-1, 1]) { g.fillStyle = HAIR; ell(g, s * 7.6, hy + 4.6, 1.7, 2.9, -s * 0.2); g.fill(); outline(g, 0.45); } }
  }
  // the braid: from under the head, over the shoulder away from where she faces (down her back facing away), four
  // plaits, the weave, a ribbon of two loops and a knot, a tuft
  function girlBraid(g, side, back) {
    const x0 = back ? 0 : side * 6.4, y0 = back ? -4.4 : -5, dx = back ? 0 : side * 0.42;
    for (let k = 0; k < 4; k++) {
      const x = x0 + dx * k, y = y0 + 1.4 + k * 2.7;
      g.fillStyle = HAIR; ell(g, x, y, 2.1 - k * 0.12, 1.7, side * 0.3); g.fill(); outline(g, 0.5);
    }
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 0.6; g.beginPath();
    for (let k = 0; k < 3; k++) { const x = x0 + dx * (k + 0.5), y = y0 + 2.75 + k * 2.7; g.moveTo(x - 1.6, y - 0.5); g.lineTo(x + 1.6, y + 0.5); }
    g.stroke();
    const rx = x0 + dx * 3.6, ry = y0 + 1.4 + 3.6 * 2.7;
    g.fillStyle = RIB; ell(g, rx - 1.7, ry, 1.8, 1.1, 0.5); g.fill(); outline(g, 0.4);
    g.fillStyle = RIB; ell(g, rx + 1.7, ry, 1.8, 1.1, -0.5); g.fill(); outline(g, 0.4);
    g.fillStyle = RIB; ell(g, rx, ry, 0.9, 0.9); g.fill();
    g.fillStyle = HAIR; g.beginPath(); g.moveTo(rx - 1.3, ry + 0.7); g.lineTo(rx + 1.3, ry + 0.7); g.lineTo(rx + side * 0.4, ry + 3.4); g.closePath(); g.fill(); outline(g, 0.4);
  }
  // a bow in the hair on a bare head
  function girlBow(g) {
    const bx = 4.4, by = -17;
    g.fillStyle = RIB; ell(g, bx - 1.9, by, 2, 1.25, 0.35); g.fill(); outline(g, 0.4);
    g.fillStyle = RIB; ell(g, bx + 1.9, by, 2, 1.25, -0.35); g.fill(); outline(g, 0.4);
    g.fillStyle = RIB; ell(g, bx, by, 0.95, 0.95); g.fill();
  }

  // ---------- what the hand holds ----------
  // a weapon drawn with the hand at (0, 0), pointing along +x
  function drawWeapon(g, W, swinging) {
    const c = W.color, fam = W.fam, tier = W.tier, id = W.id || '';
    const lt = shade(c, 0.55), dk = shade(c, -0.45);
    const fancy = tier === 'godly' || tier === 'dragon' || tier === 'sunstone' || id === 'skysinger';
    const haft = (x0, x1, col) => { rr(g, x0, -1.25, x1 - x0, 2.5, 1.1); g.fillStyle = col || '#6b4a2a'; g.fill(); outline(g, 0.5); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x0 + 1, -0.5); g.lineTo(x1 - 1, -0.5); g.stroke(); };
    if (fam === 'sword') {
      g.fillStyle = tier === 'wooden' ? '#7a5230' : '#4a2e13'; g.fillRect(-3, -1.3, 6, 2.6);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.5; for (const x of [-1.6, 0, 1.6]) { g.beginPath(); g.moveTo(x, -1.3); g.lineTo(x + 0.7, 1.3); g.stroke(); }
      ell(g, -3.8, 0, 1.9, 1.9); g.fillStyle = fancy ? GOLD : tier === 'blackiron' ? '#2a2d33' : '#6b707b'; g.fill(); outline(g, 0.5);
      if (tier === 'wooden') {
        rr(g, 4, -1.9, 22, 3.8, 1.9); g.fillStyle = '#b98a52'; g.fill(); outline(g, 0.6);
        g.strokeStyle = '#8a6238'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(6, -0.6); g.quadraticCurveTo(14, 0.4, 24, -0.4); g.moveTo(8, 0.8); g.lineTo(20, 0.9); g.stroke();
        rr(g, 3, -3.4, 1.8, 6.8, 0.6); g.fillStyle = '#7a5230'; g.fill(); outline(g, 0.4);
        return;
      }
      const guardCol = fancy ? GOLD : tier === 'blackiron' ? '#2a2d33' : tier === 'mithril' ? '#c8d6ee' : '#5b606b';
      g.fillStyle = guardCol;
      if (tier === 'mithril' || id === 'skysinger') { g.beginPath(); g.moveTo(3, -1.6); g.quadraticCurveTo(3.6, -5.4, 6, -6.2); g.quadraticCurveTo(4.4, -3.6, 5.4, -1.4); g.lineTo(5.4, 1.4); g.quadraticCurveTo(4.4, 3.6, 6, 6.2); g.quadraticCurveTo(3.6, 5.4, 3, 1.6); g.closePath(); g.fill(); outline(g, 0.4); }
      else if (tier === 'blackiron') { g.beginPath(); g.moveTo(3, -4.8); g.lineTo(5.4, -6.2); g.lineTo(5.2, -1.6); g.lineTo(5.2, 1.6); g.lineTo(5.4, 6.2); g.lineTo(3, 4.8); g.closePath(); g.fill(); outline(g, 0.4); }
      else if (tier === 'stormstone') { g.beginPath(); g.moveTo(3, -1.4); g.lineTo(5, -3.4); g.lineTo(4, -4.2); g.lineTo(6, -6.2); g.lineTo(5.2, -1.2); g.lineTo(5.2, 1.2); g.lineTo(6, 6.2); g.lineTo(4, 4.2); g.lineTo(5, 3.4); g.lineTo(3, 1.4); g.closePath(); g.fill(); outline(g, 0.4); }
      else if (tier === 'steel') { rr(g, 3, -5.2, 2.4, 10.4, 0.8); g.fill(); outline(g, 0.4); ell(g, 4.2, -5.6, 1, 1); g.fill(); ell(g, 4.2, 5.6, 1, 1); g.fill(); }
      else { rr(g, 3, -4.6, 2.4, 9.2, 0.8); g.fill(); outline(g, 0.4); }
      g.beginPath();
      if (tier === 'bronze') { g.moveTo(5.4, -2); g.quadraticCurveTo(16, -4.2, 27.5, 0); g.quadraticCurveTo(16, 4.2, 5.4, 2); }
      else if (tier === 'steel' || tier === 'mithril' || tier === 'stormstone' || id === 'skysinger') { g.moveTo(5.4, -2.2); g.lineTo(28.5, -1.8); g.lineTo(33.5, 0); g.lineTo(28.5, 1.8); g.lineTo(5.4, 2.2); }
      else if (tier === 'blackiron') { g.moveTo(5.4, -2.4); for (let x = 8; x <= 26; x += 3) { g.lineTo(x, -2.4); g.lineTo(x + 1.5, -3.4); } g.lineTo(27, -2.1); g.lineTo(31, 0); g.lineTo(27, 2.2); g.lineTo(5.4, 2.4); }
      else if (tier === 'sunstone') { g.moveTo(5.4, -2.2); for (let x = 7; x <= 27; x += 4) g.quadraticCurveTo(x + 1, -3.6, x + 2, -2.2); g.lineTo(32, 0); for (let x = 27; x >= 7; x -= 4) g.quadraticCurveTo(x + 1, 3.6, x, 2.2); g.lineTo(5.4, 2.2); }
      else if (tier === 'obsidian') { g.moveTo(5.4, -2.2); g.lineTo(14, -3); g.lineTo(24, -2.2); g.lineTo(31, 0); g.lineTo(24, 2.4); g.lineTo(14, 2.6); g.lineTo(5.4, 2.2); }
      else { g.moveTo(5.4, -2.3); g.lineTo(26, -2); g.lineTo(30.5, 0); g.lineTo(26, 2); g.lineTo(5.4, 2.3); }
      g.closePath(); g.fillStyle = c; g.fill(); outline(g, 0.7);
      g.strokeStyle = lt; g.lineWidth = 0.8; g.beginPath(); g.moveTo(6, -1.5); g.lineTo(27, -1); g.stroke();
      if (tier === 'iron' || tier === 'steel' || tier === 'mithril') { g.strokeStyle = dk; g.lineWidth = 0.7; g.beginPath(); g.moveTo(7, 0.2); g.lineTo(tier === 'iron' ? 23 : 27, 0.2); g.stroke(); }
      if (tier === 'mithril' || id === 'skysinger') { g.save(); g.globalAlpha = 0.45 + Math.sin(T * 4) * 0.2; g.strokeStyle = '#d6ecff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(6, 1.6); g.lineTo(28, 1.2); g.stroke(); g.restore(); }
      if (id === 'skysinger') { g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.6; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(10 + i * 8, -4.5); g.quadraticCurveTo(14 + i * 8, -6.5 + Math.sin(T * 5 + i) * 1.2, 18 + i * 8, -4.6); g.stroke(); } }
      if (tier === 'sunstone') { const gl = g.createLinearGradient(0, -4, 0, 4); gl.addColorStop(0, 'rgba(255,200,90,0)'); gl.addColorStop(0.5, `rgba(255,200,90,${(0.35 + Math.sin(T * 6) * 0.15).toFixed(3)})`); gl.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = gl; g.fillRect(6, -5, 26, 10); }
      if (tier === 'stormstone') { g.strokeStyle = '#ffffff'; g.lineWidth = 0.6; zigzag(g, 8, 0, 28, 0, 8, 0.9); sparkle(g, 30, -3, 1.6, Math.max(0, Math.sin(T * 5)), 'rgba(255,255,255,A)'); }
      if (tier === 'obsidian') { g.strokeStyle = 'rgba(200,170,255,0.55)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(14, -3); g.lineTo(18, 0.2); g.lineTo(24, -2.2); g.moveTo(18, 0.2); g.lineTo(14, 2.6); g.stroke(); }
      const gc = gemOf(id); if (gc) gem(g, 4.2, 0, 1.2, gc);
    } else if (fam === 'dagger') {
      g.fillStyle = '#4a2e13'; g.fillRect(-2.6, -1.2, 5.2, 2.4); ell(g, -3.2, 0, 1.5, 1.5); g.fillStyle = tier === 'blackiron' ? '#2a2d33' : '#6b707b'; g.fill();
      rr(g, 2.6, -3, 1.8, 6, 0.6); g.fillStyle = tier === 'mithril' ? '#c8d6ee' : '#5b606b'; g.fill(); outline(g, 0.4);
      // each metal's own dagger: the steel guard ends in balls, the bronze blade is a broad leaf (the sample drew them alike)
      if (tier === 'steel') { g.fillStyle = '#5b606b'; ell(g, 3.5, -3.3, 0.85, 0.85); g.fill(); ell(g, 3.5, 3.3, 0.85, 0.85); g.fill(); }
      g.beginPath(); g.moveTo(4.4, -2.1);
      if (tier === 'blackiron') { g.lineTo(7, -2.1); g.lineTo(8, -3); g.lineTo(9.5, -2.1); g.lineTo(10.5, -3); g.lineTo(12, -2); }
      if (tier === 'bronze') { g.quadraticCurveTo(10, -4, 17.5, 0); g.quadraticCurveTo(10, 4, 4.4, 2.1); }
      else { g.quadraticCurveTo(12, -2.6, 18.5, 0); g.quadraticCurveTo(12, 1.6, 4.4, 2.1); }
      g.closePath(); g.fillStyle = c; g.fill(); outline(g, 0.6);
      g.strokeStyle = lt; g.lineWidth = 0.7; g.beginPath(); g.moveTo(5, -1.4); g.lineTo(15, -1.1); g.stroke();
      if (tier === 'mithril') { g.save(); g.globalAlpha = 0.5 + Math.sin(T * 4) * 0.2; g.strokeStyle = '#d6ecff'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(5, 1.3); g.lineTo(15, 0.8); g.stroke(); g.restore(); }
    } else if (fam === 'fang') {
      g.fillStyle = '#8a1e1e'; g.fillRect(-3, -1.4, 6.5, 2.8); g.strokeStyle = '#5a0e0e'; g.lineWidth = 0.5; for (const x of [-1.6, 0.2, 2]) { g.beginPath(); g.moveTo(x, -1.4); g.lineTo(x + 0.8, 1.4); g.stroke(); }
      g.beginPath(); g.moveTo(3.5, -3); g.quadraticCurveTo(13.5, -4.5, 20.5, 2.5); g.quadraticCurveTo(12.5, 0.5, 3.5, 3); g.closePath(); const fg = g.createLinearGradient(3, -3, 20, 2); fg.addColorStop(0, '#e9e1c6'); fg.addColorStop(1, '#ffffff'); g.fillStyle = fg; g.fill(); outline(g, 0.6);
      g.strokeStyle = '#b9ae90'; g.lineWidth = 0.6; for (const x of [6.5, 9.5, 12.5]) { g.beginPath(); g.moveTo(x, -2.8); g.lineTo(x + 0.6, 1.6); g.stroke(); }
      g.fillStyle = '#d23a30'; ell(g, 4.6, 0, 0.8, 0.8); g.fill();
    } else if (fam === 'axe') {
      haft(-6, 22);
      const big = tier === 'mithril' ? 1.25 : tier === 'steel' ? 1.1 : tier === 'bronze' ? 0.85 : 1;
      g.save(); g.translate(16, 0); g.scale(big, big);
      g.beginPath(); g.moveTo(-1, -1.3); g.lineTo(0, -6); g.quadraticCurveTo(6.5, -10.5, 9.5, -4.5); g.quadraticCurveTo(7, -1.8, 5, -1.3); g.closePath(); g.fillStyle = metalFill(g, c, -10, 0); g.fill(); outline(g, 0.6);
      g.strokeStyle = lt; g.lineWidth = 0.8; g.beginPath(); g.moveTo(3, -8.6); g.quadraticCurveTo(8, -8, 9.3, -4.8); g.stroke();
      if (tier === 'blackiron') { g.fillStyle = '#c8ccd4'; g.beginPath(); g.moveTo(-1, -1); g.lineTo(-5, -3.4); g.lineTo(-1, -3.2); g.closePath(); g.fill(); }
      g.fillStyle = shade(c, -0.3); g.fillRect(-1.6, -1.8, 4, 3.6);
      g.restore();
    } else if (fam === 'battleaxe') {
      haft(-8, 28);
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(20, s * -1.3); g.quadraticCurveTo(18.5, s * -11, 29, s * -12); g.quadraticCurveTo(26.5, s * -6, 28, s * -1.3); g.closePath(); g.fillStyle = metalFill(g, c, -12, 12); g.fill(); outline(g, 0.6); g.strokeStyle = lt; g.lineWidth = 0.7; g.beginPath(); g.moveTo(28.6, s * -11); g.quadraticCurveTo(26.6, s * -6, 27.6, s * -2); g.stroke(); }
      rr(g, 19, -2, 9.5, 4, 1); g.fillStyle = dk; g.fill(); outline(g, 0.4);
      if (tier === 'mithril') { g.fillStyle = '#c8d6ee'; g.beginPath(); g.moveTo(28.5, -1.4); g.lineTo(33, 0); g.lineTo(28.5, 1.4); g.closePath(); g.fill(); }
      // steel's rivets on the head, as on the steel warhammer (the sample drew iron and steel alike)
      if (tier === 'steel') { g.fillStyle = shade(c, 0.5); for (const y of [-6.5, 6.5]) { ell(g, 24.2, y, 0.55, 0.55); g.fill(); } }
    } else if (fam === 'warhammer' || fam === 'mace') {
      haft(-8, 22);
      if (fam === 'mace') {
        ell(g, 25, 0, 5, 4.6); g.fillStyle = '#efe9d8'; g.fill(); outline(g, 0.6);
        g.fillStyle = '#2a2420'; ell(g, 26.6, -1.6, 1.1, 1.2); g.fill(); ell(g, 26.6, 1.6, 1.1, 1.2); g.fill(); g.fillRect(28.4, -0.5, 1.2, 1);
      } else {
        rr(g, 19, -6.2, 8, 12.4, 1.2); g.fillStyle = metalFill(g, c, -6, 6); g.fill(); outline(g, 0.7);
        g.fillStyle = dk; g.fillRect(19, -1.2, 8, 2.4); g.fillRect(21.6, -6.2, 0.9, 12.4);
        g.fillStyle = c; g.beginPath(); g.moveTo(19, -2.2); g.lineTo(14.5, 0); g.lineTo(19, 2.2); g.closePath(); g.fill(); outline(g, 0.4);
        if (tier === 'mithril') { g.fillStyle = '#c8d6ee'; g.beginPath(); g.moveTo(27, -1.6); g.lineTo(31, 0); g.lineTo(27, 1.6); g.closePath(); g.fill(); }
        if (tier === 'steel') { g.fillStyle = shade(c, 0.5); for (const y of [-4.6, 4.6]) { ell(g, 23, y, 0.5, 0.5); g.fill(); } }
      }
    } else if (fam === 'stave') {
      haft(-14, 26, '#e3dcc6');
      ell(g, 29, 0, 3.6, 3.4); g.fillStyle = '#efe9d8'; g.fill(); outline(g, 0.5);
      g.fillStyle = '#2a2420'; ell(g, 30.2, -1.2, 0.8, 0.9); g.fill(); ell(g, 30.2, 1.2, 0.8, 0.9); g.fill();
      const p = (0.4 + Math.sin(T * 3) * 0.2).toFixed(3); const gl = g.createRadialGradient(29, 0, 0, 29, 0, 7); gl.addColorStop(0, `rgba(160,255,200,${p})`); gl.addColorStop(1, 'rgba(160,255,200,0)'); g.fillStyle = gl; ell(g, 29, 0, 7, 7); g.fill();
    } else if (fam === 'spear') {
      haft(-18, 30);
      g.beginPath(); g.moveTo(29, -2.6); g.quadraticCurveTo(35, -3.6, 41, 0); g.quadraticCurveTo(35, 3.6, 29, 2.6); g.closePath(); g.fillStyle = c; g.fill(); outline(g, 0.6);
      g.strokeStyle = lt; g.lineWidth = 0.7; g.beginPath(); g.moveTo(30, -0.8); g.lineTo(39, -0.4); g.stroke();
      rr(g, 27.4, -1.9, 1.8, 3.8, 0.4); g.fillStyle = GOLD; g.fill();
      g.strokeStyle = '#d23a30'; g.lineWidth = 1; g.beginPath(); g.moveTo(27.5, 1.6); g.quadraticCurveTo(25, 5 + Math.sin(T * 4) * 0.8, 23, 5.5); g.moveTo(27.5, 1.8); g.quadraticCurveTo(26, 6, 24.5, 6.8); g.stroke();
      rr(g, -18.6, -1.5, 2, 3, 0.6); g.fillStyle = '#5b606b'; g.fill();
    } else if (fam === 'bow') {
      const pull = swinging >= 0 ? Math.sin(Math.min(1, swinging * 1.6) * Math.PI) * 6 : 0;
      const len = id === 'shortbow' ? 11 : id === 'oak_bow' ? 13 : 15;
      g.save(); g.translate(-4, 0); g.lineCap = 'round';
      const limb = () => { g.beginPath(); g.moveTo(1.5, -len); if (id === 'yew_bow') g.quadraticCurveTo(-0.5, -len - 1.5, 0.5, -len - 2.6); g.moveTo(1.5, -len); g.quadraticCurveTo(8, -len * 0.7, 6, -len * 0.27); g.quadraticCurveTo(4.5, 0, 6, len * 0.27); g.quadraticCurveTo(8, len * 0.7, 1.5, len); if (id === 'yew_bow') { g.moveTo(1.5, len); g.quadraticCurveTo(-0.5, len + 1.5, 0.5, len + 2.6); } };
      g.strokeStyle = OUT; g.lineWidth = 3.4; limb(); g.stroke();
      g.strokeStyle = c; g.lineWidth = 2.4; limb(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(3.5, -len * 0.75); g.quadraticCurveTo(6.6, -len * 0.5, 5.6, -len * 0.3); g.stroke();
      rr(g, 3.6, -2, 2.6, 4, 0.8); g.fillStyle = id === 'yew_bow' ? '#d9b25c' : '#5a3a1e'; g.fill();
      g.strokeStyle = '#e9eef5'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(1.5, -len); g.lineTo(1.5 - pull, 0); g.lineTo(1.5, len); g.stroke();
      if (pull > 0.5) { g.strokeStyle = '#8a6a3a'; g.lineWidth = 1; g.beginPath(); g.moveTo(1.5 - pull, 0); g.lineTo(22, 0); g.stroke(); g.fillStyle = '#c9ccd3'; g.beginPath(); g.moveTo(22, -1.6); g.lineTo(25.5, 0); g.lineTo(22, 1.6); g.closePath(); g.fill(); g.fillStyle = '#e5484d'; g.beginPath(); g.moveTo(1.5 - pull, 0); g.lineTo(3.5 - pull, -1.6); g.lineTo(5 - pull, 0); g.lineTo(3.5 - pull, 1.6); g.closePath(); g.fill(); }
      g.restore();
    }
  }
  // NOT IN THE SAMPLE (ported minimally, flagged to the owner): the work tools and the fishing rod, in the same outline style
  function drawTool(g, tool, col) {
    const c = hex(col, '#b8863a');
    rr(g, -4, -1.25, 26, 2.5, 1.1); g.fillStyle = '#8a6a3a'; g.fill(); outline(g, 0.5);
    if (tool === 'axe') {
      g.beginPath(); g.moveTo(17, -1.3); g.lineTo(18, -5.4); g.quadraticCurveTo(24, -9.4, 26.5, -4); g.quadraticCurveTo(24, -1.6, 22, -1.3); g.closePath(); g.fillStyle = metalFill(g, c, -9, 0); g.fill(); outline(g, 0.6);
    } else if (tool === 'pickaxe') {
      g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 3.4; g.beginPath(); g.arc(18, 0, 8, -1.15, 1.15); g.stroke();
      g.strokeStyle = c; g.lineWidth = 2.4; g.beginPath(); g.arc(18, 0, 8, -1.15, 1.15); g.stroke();
      rr(g, 23.4, -2.2, 3.4, 4.4, 0.8); g.fillStyle = '#5a4a3a'; g.fill(); outline(g, 0.4);
    } else if (tool === 'hammer') {
      rr(g, 18, -5, 7.4, 10, 1.2); g.fillStyle = metalFill(g, c, -5, 5); g.fill(); outline(g, 0.6);
    } else {
      rr(g, 20.5, -4.6, 3.4, 9.2, 0.8); g.fillStyle = metalFill(g, c, -4.6, 4.6); g.fill(); outline(g, 0.5);
    }
  }
  function drawRod(g) {
    g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-2, 0); g.lineTo(30, -3.6); g.stroke();
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(-2, 0); g.lineTo(30, -3.6); g.stroke();
    g.fillStyle = '#5a3a1e'; rr(g, -2, -1.4, 6, 2.8, 1); g.fill();
    g.strokeStyle = '#e9eef5'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(30, -3.6); g.lineTo(38, 10 + Math.sin(T * 3) * 2); g.stroke();
  }

  // ---------- the pose: where the weapon points and where the hand is ----------
  // how a knight stands with each kind of weapon (angles in his own frame: 0 = to his right, + = down the screen)
  function restAngle(fam, side) {
    if (fam === 'axe' || fam === 'battleaxe' || fam === 'warhammer' || fam === 'mace') return side ? -1.2 : -1.12;
    if (fam === 'spear' || fam === 'stave') return side ? -1.4 : -1.48;
    if (fam === 'bow') return side ? -0.08 : 0;
    // swords, daggers and the Fang: held upright too, blade up beside the shoulder (owner: "should be up like the battle axes")
    return side ? -1.2 : -1.12;
  }
  const SHOULDER = { x: 6.6, y: 1.2 }, REACH = 4.6;
  // at rest the weapon hand hangs at his waist, just outside the hip (owner: "the hand should be resting around the waist")
  const REST_HAND = { up: { x: 10.4, y: 4.8 }, bow: { x: 10.8, y: 3.6 } };
  function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
  const POSE = new WeakMap();
  // once a draw per knight: the weapon's angle and the hand ease back to rest after a swing (dt from the game clock)
  function pose(e, S, fam) {
    let rec = POSE.get(e);
    const swing = S.swing, ang = S.ang, step = S.step, side = !S.back && Math.abs(S.fxm) > 0.7 && Math.abs(S.fy) < 0.6;
    let target;
    if (swing >= 0) target = fam === 'bow' ? ang : ang + lerp(-1.4, 1.2, kEase(swing));
    else target = restAngle(fam, side) + step * 0.1;
    // the hand: round the shoulder while he swings, down at his waist at rest
    let tx, ty;
    if (swing >= 0) { tx = SHOULDER.x + Math.cos(target) * REACH; ty = SHOULDER.y + Math.sin(target) * REACH; }
    else { const rh = fam === 'bow' ? REST_HAND.bow : REST_HAND.up; tx = rh.x; ty = rh.y + step * 0.5; }
    if (!rec) { rec = { wa: target, hx: tx, hy: ty, mirror: S.mirror, t: time }; POSE.set(e, rec); return rec; }
    const dt = clamp(time - rec.t, 0, 0.05), k = Math.min(1, dt * 11);
    rec.t = time;
    if (swing >= 0 || rec.mirror !== S.mirror) { rec.wa = target; rec.hx = tx; rec.hy = ty; }
    else { rec.wa += angDiff(rec.wa, target) * k; rec.hx += (tx - rec.hx) * k; rec.hy += (ty - rec.hy) * k; }
    rec.mirror = S.mirror;
    return rec;
  }
  // a tool or the rod: held out round the shoulder, swinging while he works (as the old drawing did)
  function toolPose(e, S, look) {
    const sw = look.tool && look.toolSwing ? Math.sin(T * 14) * 0.6 : 0;
    const wa = look.rod ? S.ang - 0.6 : S.ang - 0.7 + sw;
    const r = { wa, hx: SHOULDER.x + Math.cos(wa) * REACH, hy: SHOULDER.y + Math.sin(wa) * REACH };
    // the weapon eases back from where the tool was when the work stops
    const rec = POSE.get(e);
    if (rec) { rec.wa = wa; rec.hx = r.hx; rec.hy = r.hy; rec.t = time; rec.mirror = S.mirror; } else POSE.set(e, { wa, hx: r.hx, hy: r.hy, t: time, mirror: S.mirror });
    return r;
  }

  function drawTrail(g, ang, swing) {
    const a0 = ang - 1.4, a1 = ang + lerp(-1.4, 1.2, kEase(swing));
    g.save(); g.translate(SHOULDER.x, SHOULDER.y); g.strokeStyle = `rgba(255,255,255,${(0.42 * (1 - swing)).toFixed(3)})`; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, 28, a0, a1); g.stroke(); g.restore();
  }

  // ---------- the knight ----------
  // S: everything about this frame's stance (facing, step, bob, swing)
  function stance(e, seated, walkT) {
    const fx = e.facing ? +e.facing.x || 0 : 0, fy = e.facing ? +e.facing.y || 0 : 1;
    const back = fy < -0.55, mirror = fx < -0.25, fxm = mirror ? -fx : fx;
    const moving = !!e.moving && !seated, wt = walkT === undefined ? (+e.walkT || 0) : walkT;
    return {
      fx, fy, back, mirror, fxm, ang: Math.atan2(fy, fxm),
      step: moving ? Math.sin(wt) : 0,
      bob: moving ? -Math.abs(Math.sin(wt)) * 1.5 : seated ? 0 : Math.sin(T * 2.2) * 0.35,
      swing: e.attackT > 0 ? 1 - e.attackT / 0.22 : -1,
      side: fxm > 0.35 ? -1 : 1,
    };
  }
  function setColours(e, look) {
    const hurt = !!e && e.hurtT > 0;
    TUNIC = hurt ? '#ff9a9a' : hex(look.tunic, '#3b6fb6');
    SKIN = hurt ? '#ffc7b0' : hex(look.skin, '#e8b790');
    HAIR = hex(look.hair, '#5a3a1e');
    RIB = typeof look.ribbon === 'string' ? look.ribbon : RIBBON;
    GIRL = !!look.girl;
  }
  // the body: everything but what the weapon hand holds. stage 'behind' = the shield (or lantern) and its hand when he
  // faces away (they go behind his back, under the weapon); 'rest' = the rest; 'all' = both (a picture)
  function paintBody(g, S, P, seated, stage) {
    if (S.back) {
      if (stage !== 'rest') { g.save(); g.translate(0, S.bob); if (P.shield) drawShield(g, P.shield, false); drawOffHand(g, P.body, S.step); g.restore(); }
      if (stage === 'behind') return;
    } else if (P.cape) drawCape(g, P.cape, S.step, false);
    if (!seated) drawLegs(g, P.legs, P.body, S.step);
    g.translate(0, S.bob);
    if (GIRL) girlSkirt(g, P.body);
    drawTorso(g, P.body, S.back);
    if (P.cape && S.back) drawCape(g, P.cape, S.step, true);
    drawShoulders(g, P.body);
    if (!S.back) {
      if (GIRL) girlBraid(g, S.side, false);
      drawOffHand(g, P.body, S.step); if (P.shield) drawShield(g, P.shield, false);
      if (GIRL && showsHair(P.helm)) girlHairBehind(g);
    }
    drawHead(g, P.helm, S.fxm, S.fy, S.back);
    if (GIRL) {
      girlHairAfter(g, P.helm, S.back);
      if (S.back) girlBraid(g, 0, true);
      if (!P.helm) girlBow(g);
    }
    g.translate(0, -S.bob);
  }
  // what the weapon hand holds (a weapon, a tool or the rod), the hand itself and the swoosh of a swing
  function paintHeld(g, S, P, look, hold, wpic) {
    const W = P.weapon;
    if (hold) {
      g.save(); g.translate(hold.hx, hold.hy + S.bob); g.rotate(hold.wa);
      if (look.rod) drawRod(g); else drawTool(g, look.tool, look.toolColor);
      g.restore();
      g.save(); g.translate(0, S.bob); drawWeaponArm(g, P.body, hold.hx, hold.hy); g.restore();
      return;
    }
    const rec = S.rec;
    if (W) {
      g.save(); g.translate(rec.hx, rec.hy + S.bob); g.rotate(rec.wa);
      if (!(wpic && wpic(g, W, S.swing))) drawWeapon(g, W, S.swing);
      g.restore();
    }
    g.save(); g.translate(0, S.bob);
    if (W) drawWeaponArm(g, P.body, rec.hx, rec.hy);
    else if (S.swing >= 0 && look.fists) drawWeaponArm(g, P.body, SHOULDER.x + Math.cos(S.ang) * (4 + S.swing * 12), SHOULDER.y + Math.sin(S.ang) * (4 + S.swing * 12));
    else drawWeaponArm(g, P.body, REST_HAND.up.x - 0.4, REST_HAND.up.y - 0.6 + S.step * 1.4);
    g.restore();
    if (W && S.swing >= 0 && S.swing < 0.9 && W.fam !== 'bow') { g.save(); g.translate(0, S.bob); drawTrail(g, S.ang, S.swing); g.restore(); }
  }
  function holdOf(e, S, look) { return look.tool || look.rod ? toolPose(e, S, look) : null; }

  // live: the whole knight, in the sample's order
  function drawLive(g, e, look, P, seated) {
    STATS.live++;
    const S = stance(e, seated);
    const hold = holdOf(e, S, look);
    S.rec = hold || pose(e, S, P.weapon ? P.weapon.fam : null);
    g.save();
    g.scale(S.mirror ? -1.08 : 1.08, 1.08);
    if (S.back) {
      // facing away: the shield (or lantern) and its hand, the weapon and its hand, the swoosh, all behind his back
      paintBody(g, S, P, seated, 'behind');
      paintHeld(g, S, P, look, hold, null);
      paintBody(g, S, P, seated, 'rest');
    } else {
      paintBody(g, S, P, seated, 'all');
      paintHeld(g, S, P, look, hold, null);
    }
    g.restore();
  }

  // ---------- pictures, for the crowd of other knights ----------
  const PIC_MAX = 300, WPIC_MAX = 80;
  const PIC = { w: 48, h: 56, ax: 24, ay: 36 };          // css px round the knight's feet-centre: the party cone to the cape's hem
  const WP = { x0: -22, y0: -19, w: 68, h: 38 };          // css px round the hand, the weapon along +x (the spear tip at 41)
  const PICS = new Map(), WPICS = new Map();
  const picScale = () => Math.round(Math.max(1, Math.min(2, typeof DPR === 'number' && DPR > 0 ? DPR : 1)) * 100) / 100;
  // a Map is in the order things went in: touching an entry moves it to the end, so the front is the least lately used
  function lruGet(M, k) { const v = M.get(k); if (v) { M.delete(k); M.set(k, v); } return v; }
  function lruPut(M, k, v, max) {
    M.set(k, v);
    while (M.size > max) { const [k0, o] = M.entries().next().value; M.delete(k0); try { o.c.width = 0; o.c.height = 0; } catch (e) { } }
  }
  function makeCanvas(w, h, ss) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    const c = document.createElement('canvas'); c.width = Math.ceil(w * ss); c.height = Math.ceil(h * ss);
    const cg = c.getContext ? c.getContext('2d') : null;
    if (!cg || !c.width) return null;
    return { c, cg };
  }
  const animatedBody = P => (P.helm && (ANIMATED.has(P.helm.id) || P.helm.fam === 'party')) || (P.body && ANIMATED.has(P.body.id)) || (P.shield && ANIMATED.has(P.shield.id)) || (P.cape && ANIMATED.has(P.cape.id));
  const STEPS = 8, PHASES = 4, TWO_PI = Math.PI * 2;
  function drawCached(g, e, look, P) {
    const ss = picScale();
    // 8 facings, 8 steps of the walk (0 = standing), 4 phases of the clock for the pieces that move with it
    const a = Math.atan2(e.facing ? +e.facing.y || 0 : 1, e.facing ? +e.facing.x || 0 : 0);
    const dir = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8, da = dir * Math.PI / 4;
    const moving = !!e.moving;
    const sb = moving ? Math.floor((((+e.walkT || 0) % TWO_PI) + TWO_PI) % TWO_PI / TWO_PI * STEPS) : -1;
    const wt = moving ? (sb + 0.5) / STEPS * TWO_PI : 0;
    const anim = animatedBody(P), ph = anim ? Math.floor(time * 4) % PHASES : 0;
    const tPic = moving ? sb * 0.29 + ph * 0.37 : ph * 0.37 + 0.2;
    const key = gearKey(P) + '|' + (GIRL ? 'g' + HAIR + RIB : 'b' + HAIR) + '|' + TUNIC + SKIN + '|' + dir + '|' + sb + '|' + ph + '|' + ss;
    const fe = { facing: { x: Math.cos(da), y: Math.sin(da) }, moving, walkT: wt, attackT: e.attackT, hurtT: e.hurtT };
    // the stance with the picture's own facing and step, so the weapon sits on the picture's body
    const T0 = T;
    T = tPic;
    const S = stance(fe, false, wt);
    T = T0;
    let p = lruGet(PICS, key);
    if (!p) {
      const cv = makeCanvas(PIC.w, PIC.h, ss);
      if (!cv) return false;
      T = tPic;
      try { cv.cg.scale(ss, ss); cv.cg.translate(PIC.ax, PIC.ay); cv.cg.scale(S.mirror ? -1.08 : 1.08, 1.08); paintBody(cv.cg, S, P, false, 'all'); }
      catch (err) { T = T0; return false; }
      T = T0;
      p = { c: cv.c }; lruPut(PICS, key, p, PIC_MAX); STATS.pics++;
    }
    STATS.blits++;
    const hold = holdOf(e, S, look);
    S.rec = hold || pose(e, S, P.weapon ? P.weapon.fam : null);
    const held = () => { g.save(); g.scale(S.mirror ? -1.08 : 1.08, 1.08); paintHeld(g, S, P, look, hold, weaponPic); g.restore(); };
    if (S.back) held();
    g.drawImage(p.c, -PIC.ax, -PIC.ay, PIC.w, PIC.h);
    if (!S.back) held();
    return true;
  }
  // a weapon's picture, turned to its angle; a bow being drawn is drawn live
  function weaponPic(g, W, swing) {
    if (W.fam === 'bow' && swing >= 0) return false;
    const ss = picScale(), anim = WANIMATED.has(W.id), ph = anim ? Math.floor(time * 4) % PHASES : 0;
    const key = keyOf(W) + '|' + ph + '|' + ss;
    let p = lruGet(WPICS, key);
    if (!p) {
      // made at 1.08x the screen ratio: the knight's own frame is scaled 1.08
      const s2 = ss * 1.08, cv = makeCanvas(WP.w, WP.h, s2);
      if (!cv) return false;
      const T0 = T; T = ph * 0.37 + 0.2;
      try { cv.cg.scale(s2, s2); cv.cg.translate(-WP.x0, -WP.y0); drawWeapon(cv.cg, W, -1); }
      catch (err) { T = T0; return false; }
      T = T0;
      p = { c: cv.c }; lruPut(WPICS, key, p, WPIC_MAX); STATS.wpics++;
    }
    g.drawImage(p.c, WP.x0, WP.y0, WP.w, WP.h);
    return true;
  }

  // the one way in: a knight look (one with gear) on entity e, at (0, 0) = his feet's centre, as drawHuman is
  // opts: { seated, cache, t }. cache is for 73's world-scale remote knights only (and only onto the world canvas).
  function draw(g, e, look, opts) {
    opts = opts || {};
    e = e || {};
    look = look || {};
    // 79-deaths (feat/death-anims) strips what a fallen knight held through drawHuman; a knight look keeps that rule here
    if (e.unarmed && (look.weapon || look.tool || look.rod || look.spear)) { look = Object.assign({}, look); delete look.weapon; delete look.tool; delete look.rod; delete look.spear; look.fists = true; }
    const P = partsOf(look);
    const T0 = T;
    T = typeof opts.t === 'number' ? opts.t : time;
    setColours(e, look);
    try {
      const seated = !!opts.seated || KG.seat > 0;
      if (opts.cache && !seated && g === ctx && !(e.attackT > 0) && drawCached(g, e, look, P)) return;
      drawLive(g, e, look, P, seated);
    } finally { T = T0; }
  }

  // ---------- the wraps ----------
  // the look: the six slots' ids ride along with the old colour fields
  const _playerLook = playerLook;
  playerLook = function () {
    const l = _playerLook();
    const q = (player && player.equip) || {};
    l.gear = { helm: q.helm || q.head || null, body: q.body || null, legs: q.legs || null, shield: q.shield || null, cape: q.cape || null, weapon: q.weapon || null };
    return l;
  };
  // drawHuman: a knight look is drawn here; every other look (townsfolk, guards, the statue) goes on down unchanged
  const _drawHuman = drawHuman;
  drawHuman = function (g, e, look) {
    if (!look || !look.gear || typeof look.gear !== 'object') return _drawHuman(g, e, look);
    draw(g, e, look, null);
  };
  // the player on foot: the core bobbed the whole figure; the knight bobs only his body, so his feet stay planted
  const _drawCharacter = drawCharacter;
  drawCharacter = function (g, e, kind) {
    if (kind !== 'player') return _drawCharacter(g, e, kind);
    const look = playerLook();
    if (!look || !look.gear || typeof look.gear !== 'object') return _drawCharacter(g, e, kind);
    g.save(); g.translate(e.x, e.y);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, e.r * 0.85, e.r * 0.9, e.r * 0.45, 0, 0, 7); g.fill();
    drawHuman(g, e, look);
    g.restore();
  };
  // the seats: a pilot sits, so no legs
  const seat = fn => function (g, e, hurt, pilot, up) { KG.seat++; try { return fn(g, e, hurt, pilot, up); } finally { KG.seat--; } };
  { const _m = drawMech; drawMech = function (g, e, hurt, pilot) { KG.seat++; try { return _m(g, e, hurt, pilot); } finally { KG.seat--; } }; }
  if (typeof drawDozer === 'function') { const _d = drawDozer; drawDozer = seat(_d); }
  if (HOOKS.drawMonster.barrelbeast) { const _b = HOOKS.drawMonster.barrelbeast; HOOKS.drawMonster.barrelbeast = function (g, e, hurt, pilot) { KG.seat++; try { return _b(g, e, hurt, pilot); } finally { KG.seat--; } }; }
  // the title screen's knight: the sample's "Iron knight" (79-boygirl dresses it as a girl when the last knight was one)
  if (typeof title !== 'undefined' && title.KNIGHT) title.KNIGHT.gear = { helm: 'iron_helm', body: 'iron_body', legs: 'iron_legs', shield: 'iron_shield', cape: null, weapon: 'iron_sword' };

  // ---------- self-test ----------
  // A drawing context that writes down every call (name and numbers), every colour set and every gradient's stops.
  function recorder() {
    const rec = { ops: [], fills: [], strokes: 0 };
    const desc = v => typeof v === 'string' ? v : v && v.__stops ? 'grad(' + v.__stops.join(',') + ')' : String(v);
    const st = {};
    rec.g = new Proxy(st, {
      get: (o, k) => {
        if (k === 'measureText') return () => ({ width: 10 });
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => { const gr = { __stops: [], addColorStop: (t, c) => { gr.__stops.push(c); } }; rec.ops.push(k + ' ' + a.map(n => (+n).toFixed(1)).join(' ')); return gr; };
        if (k === 'getTransform') return () => undefined;
        if (k in o) return o[k];
        if (typeof k !== 'string') return undefined;
        return (...a) => {
          const nums = a.filter(n => typeof n === 'number').map(n => n.toFixed(1)).join(' ');
          rec.ops.push(k + ' ' + nums);
          if (k === 'fill' || k === 'fillRect') rec.ops.push('@fill ' + desc(st.fillStyle));
          if (k === 'stroke') rec.strokes++;
        };
      },
      set: (o, k, v) => { if (k === 'fillStyle') { rec.fills.push(desc(v)); rec.ops.push('#fs ' + desc(v)); } else if (k === 'strokeStyle') rec.ops.push('#ss ' + desc(v)); o[k] = v; return true; },
    });
    // the drawing with no colours: what shape was drawn
    rec.shape = () => rec.ops.filter(s => s[0] !== '#' && s[0] !== '@').join(';');
    rec.all = () => rec.ops.join(';');
    return rec;
  }
  const FACES = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }];
  const ent = (f, o) => Object.assign({ x: 0, y: 0, r: 13, facing: { x: f.x, y: f.y }, moving: false, walkT: 0, attackT: 0, hurtT: 0 }, o || {});
  const lookWith = (gear, extra) => {
    const l = { tunic: '#3b6fb6', hair: '#5a3a1e', shoulder: '#9aa3b2', gear: Object.assign({ helm: null, body: null, legs: null, shield: null, cape: null, weapon: null }, gear) };
    if (gear.weapon) { const w = ITEMS[gear.weapon]; l.weapon = { shape: w.shape, color: w.color }; } else l.fists = true;
    return Object.assign(l, extra || {});
  };
  HOOKS.selfTest.push((check, F, h) => {
    const P0 = 'knight gear: ';
    const time0 = time, dpr0 = DPR;
    try {
      // 1. every wearable in the game draws in its own way: a knight wearing only it, at four facings, standing, walking
      // and mid-swing, never throws, and no two items of a slot draw the same shape (colours aside). The six party hats
      // are the one hat in six colours.
      { const by = {}, threw = [];
        for (const id in ITEMS) { const s = slotOf(ITEMS[id]); if (s) (by[s] = by[s] || []).push(id); }
        const same = [], counts = {};
        for (const s of SLOTS) {
          const ids = by[s] || []; counts[s] = ids.length;
          const sigs = new Map();
          for (const id of ids) {
            const look = lookWith({ [s]: id });
            if (s === 'helm' && ITEMS[id].armour && ITEMS[id].armour.slot === 'head') look.gear.helm = id;
            const rec = recorder();
            try {
              for (const f of FACES) {
                draw(rec.g, ent(f), look, { t: 0.5 });
                draw(recorder().g, ent(f, { moving: true, walkT: 1.3 }), look, { t: 0.9 });
                draw(recorder().g, ent(f, { attackT: 0.11 }), look, { t: 1.3 });
              }
            } catch (err) { threw.push(id + ': ' + (err && err.message)); }
            const k = rec.shape();
            if (sigs.has(k) && !(isParty(id) && isParty(sigs.get(k)))) same.push(sigs.get(k) + ' = ' + id);
            if (!sigs.has(k)) sigs.set(k, id);
          }
        }
        const total = SLOTS.reduce((n, s) => n + (counts[s] || 0), 0);
        check(P0 + 'every helm, body, legs, shield, cape and weapon in the game (' + total + ') draws at four facings standing, walking and swinging, and no two of a slot draw the same shape (the six party hats are one hat in six colours)', !threw.length && !same.length && total >= 100 && counts.helm >= 20 && counts.weapon >= 31 && counts.cape >= 16, { threw: threw.slice(0, 5), same: same.slice(0, 8), counts }); }

      // 2. the families' marks: each family draws what makes it recognisable
      { const has = (gear, face, want, extra) => { const rec = recorder(); draw(rec.g, ent(face || FACES[0]), lookWith(gear, extra), { t: 0.5 }); return rec.all().includes(want); };
        const marks = {
          'bronze helm crest': has({ helm: 'bronze_helm' }, null, '#fs #c0392b'),
          'mithril plume': has({ helm: 'mithril_helm' }, null, '#fs #3c6fb6'),
          'blackiron red slit': has({ helm: 'blackiron_helm' }, null, '#fs #ff4a3a'),
          'necro robe dark lining': has({ body: 'necro_robe' }, null, '#fs #140f1c'),
          'hood glowing eyes': has({ helm: 'necro_hood' }, null, '#fs #c9a6ff'),
          'party cone white tip': has({ helm: 'party_hat_red' }, null, '#fs #ffffff'),
          'soul lantern': has({ shield: 'soul_lantern' }, null, '#fs #7ee7c8'),
          'winged helm feathers': has({ helm: 'godly_helm' }, null, '#fs #f2f3f7'),
          'dragon horns': has({ helm: 'dragon_helm' }, null, 'grad(#d8cdb2,#fbf6e8)'),
          'goggle lenses': has({ helm: 'tinker_goggles' }, null, 'grad(#e8f6ff,#4f88b0)'),
          'belt pouch': has({}, null, '#fs #6b4a2a'),
        };
        // a skill cape's badge shows on his back only
        const badge = id => { const r = [false, false]; [FACES[0], FACES[2]].forEach((f, i) => { const rec = recorder(); draw(rec.g, ent(f), lookWith({ cape: id }), { t: 0.5 }); r[i] = rec.ops.some(o => o.startsWith('ellipse 0.0 5.0 3.4 3.4')); }); return r; };
        const capes = Object.keys(ITEMS).filter(id => /^cape_/.test(id) || id === 'guild_cape');
        const badges = capes.map(id => [id, badge(id)]).filter(([, b]) => b[0] || !b[1]).map(([id]) => id);
        const missing = Object.keys(marks).filter(k => !marks[k]);
        check(P0 + 'each family draws its own mark (crest, plume, slit, robe lining, hood eyes, party cone, lantern, wings, horns, goggles, pouch), and each of the ' + capes.length + ' skill capes shows its badge on his back only', !missing.length && !badges.length && capes.length >= 14, { missing, badges }); }

      // 3. the rest: every weapon upright with the hand at the waist, the bow at his side; a swing lifts the hand round
      // the shoulder; 0.5 s after it the hand is back at the waist
      { const bad = [];
        const fams = {};
        for (const id in ITEMS) if (slotOf(ITEMS[id]) === 'weapon') { const f = weaponFam(id); if (!fams[f]) fams[f] = id; }
        for (const f in fams) {
          const id = fams[f], look = lookWith({ weapon: id }), e = ent(FACES[0]);
          time = 100; draw(recorder().g, e, look, null);
          let rec = POSE.get(e);
          const rh = f === 'bow' ? REST_HAND.bow : REST_HAND.up;
          const upright = f === 'bow' ? Math.abs(rec.wa) < 0.2 : rec.wa > -1.5 && rec.wa < -1.05;
          const atWaist = Math.hypot(rec.hx - rh.x, rec.hy - rh.y) <= 0.6;
          // a swing: the hand round the shoulder
          e.attackT = 0.11; time += 1 / 60; draw(recorder().g, e, look, null); rec = POSE.get(e);
          const reach = Math.hypot(rec.hx - SHOULDER.x, rec.hy - SHOULDER.y) <= REACH + 0.2;
          // and back: half a second of frames after the swing ends
          e.attackT = 0;
          for (let i = 0; i < 30; i++) { time += 1 / 60; draw(recorder().g, e, look, null); }
          rec = POSE.get(e);
          const back = Math.hypot(rec.hx - rh.x, rec.hy - rh.y) <= 0.3 && (f === 'bow' ? Math.abs(rec.wa) < 0.25 : rec.wa > -1.5 && rec.wa < -1.05);
          if (!(upright && atWaist && reach && back)) bad.push({ f, id, upright, atWaist, reach, back, wa: +rec.wa.toFixed(2), hand: [+rec.hx.toFixed(1), +rec.hy.toFixed(1)] });
        }
        check(P0 + 'at rest every weapon family (' + Object.keys(fams).length + ') stands upright with the hand at his waist (the bow hangs at his side); a swing lifts the hand round the shoulder and half a second after it the hand is back at the waist', !bad.length && Object.keys(fams).length >= 10, { bad, fams: Object.keys(fams) }); }

      // 4. what is in front and what is behind: facing us, the weapon after the body, shoulders and head, the shield after
      // the body; facing away, both hands, the weapon and the shield before the body
      { const look = lookWith({ body: 'iron_body', weapon: null, shield: null }, { weapon: { shape: 'sword', color: '#123456' }, shield: '#654321', fists: false });
        delete look.gear.weapon; delete look.gear.shield;
        const order = f => {
          const rec = recorder(); draw(rec.g, ent(f), look, { t: 0.5 });
          const fills = rec.ops.filter(o => o.startsWith('@fill ')).map(o => o.slice(6));
          const idx = pred => fills.findIndex(pred), last = pred => { for (let i = fills.length - 1; i >= 0; i--) if (pred(fills[i])) return i; return -1; };
          const hand = shade(ITEMS.iron_body.color, -0.15);
          return { torso: idx(s => s === '#3b6fb6'), shoulders: last(s => s.startsWith('grad(') && s.includes(ITEMS.iron_body.color)), head: last(s => s === '#e8b790'), blade: idx(s => s === '#123456'), shield: idx(s => s.includes('#654321')), hands: fills.map((s, i) => s === hand ? i : -1).filter(i => i >= 0) };
        };
        const d = order(FACES[0]), u = order(FACES[2]), s = order(FACES[1]);
        const front = o => o.blade > o.torso && o.blade > o.shoulders && o.blade > o.head && o.shield > o.torso && o.hands.length === 2 && o.hands[1] > o.head;
        const behind = u.blade >= 0 && u.blade < u.torso && u.shield >= 0 && u.shield < u.torso && u.hands.length === 2 && u.hands.every(i => i < u.torso);
        check(P0 + 'facing down or side-on the weapon is drawn after his body, shoulders and head (in front); facing away the hands, the weapon and the shield are drawn before his body (behind it)', front(d) && front(s) && behind, { down: d, side: s, up: u }); }

      // 5. robes and cloaks are slim and open at the front: nothing on the body reaches past the tunic's own width, the
      // robe shows its dark lining and runes, and a cloak is two panels with the belt between
      { const slim = id => {
          const rec = recorder(); setColours({}, {}); T = 0.5;
          drawTorso(rec.g, part(id, 'body'), false);
          let maxX = 0; for (const o of rec.ops) { const m = /^(moveTo|lineTo|quadraticCurveTo|bezierCurveTo|fillRect) (.*)$/.exec(o); if (!m) continue; const n = m[2].split(' ').map(Number); for (let i = 0; i < n.length; i += 2) if (m[1] !== 'fillRect' || i === 0) maxX = Math.max(maxX, Math.abs(n[i])); }
          return { maxX, rec };
        };
        const tunic = slim('iron_body').maxX, robe = slim('necro_robe'), silk = slim('silk_cloak'), shadow = slim('shadow_cloak');
        const open = robe.rec.all().includes('#fs #140f1c') && /rgba\(180,140,255/.test(robe.rec.all()) && robe.rec.all().includes('#ss #cfc5a8');
        const panels = c => c.rec.ops.filter(o => o.startsWith('createLinearGradient 0.0 -5.0 0.0 11.0')).length === 2 && c.rec.all().includes('#fs ' + GOLD);
        check(P0 + 'the robe and the cloaks stay slim (no wider than the tunic, 10.4) and open at the front: the robe its dark lining, runes and cord; each cloak two panels with the belt buckle showing', robe.maxX <= 10.4 && silk.maxX <= 10.4 && shadow.maxX <= 10.4 && tunic <= 10.4 && open && panels(silk) && panels(shadow), { tunic, robe: robe.maxX, silk: silk.maxX, shadow: shadow.maxX, open, silkPanels: panels(silk), shadowPanels: panels(shadow) }); }

      // 6. the girl knight in the new style: under the iron helm her hair (3+ fills) and ribbon; bare-headed a bow; facing
      // away the braid down her back; a skirt; lashes; and the new drawing's outline (not the old drawHuman)
      { const HAIR0 = '#654321';
        const run = (gear, f, extra) => { const rec = recorder(); draw(rec.g, ent(f), lookWith(gear, Object.assign({ girl: true, woman: true, hair: HAIR0 }, extra)), { t: 0.5 }); return rec; };
        const helm = run({ helm: 'iron_helm', body: 'iron_body', legs: 'iron_legs' }, FACES[0]);
        const bare = run({}, FACES[1]);
        const back = run({ helm: 'iron_helm' }, FACES[2]);
        const party = run({ helm: 'party_hat_red' }, FACES[0]);
        const n = r => r.fills.filter(f => f === HAIR0).length, rib = r => r.fills.filter(f => f === RIBBON).length;
        const style = helm.all().includes('#ss ' + OUT);
        const skirt = helm.ops.some(o => o.startsWith('createLinearGradient 0.0 4.4 0.0 11.8'));
        const lashes = bare.ops.includes('#ss #222');
        const boy = recorder(); draw(boy.g, ent(FACES[0]), lookWith({ helm: 'iron_helm' }, { hair: HAIR0 }), { t: 0.5 });
        check(P0 + 'a girl knight is drawn in the new style: under the iron helm her locks and braid (3+ hair fills) and the ribbon; bare-headed the bow too; facing away the braid down her back; a party hat shows her hair; a skirt, lashes; a boy under a helm shows no hair', style && n(helm) >= 3 && rib(helm) >= 3 && rib(bare) >= 6 && n(back) >= 4 && rib(back) >= 3 && n(party) >= 5 && skirt && lashes && n(boy) === 0, { style, helm: [n(helm), rib(helm)], bare: rib(bare), back: [n(back), rib(back)], party: n(party), skirt, lashes, boy: n(boy) }); }

      // 7. an old look with no gear reads back as its exact items; colours that are no item still draw
      { const old = { tunic: '#3b6fb6', hair: '#5a3a1e', shoulder: '#9aa3b2', helm: ITEMS.iron_helm.color, weapon: { shape: 'sword', color: ITEMS.iron_sword.color }, hat: null, gear: {} };
        const P = partsOf(old), hat = partsOf({ hat: 'red', gear: {} }), odd = partsOf({ helm: '#888', body: '#ccc', weapon: { shape: 'sword', color: '#ccc' }, gear: {} });
        let threw = false; try { for (const f of FACES) { draw(recorder().g, ent(f), { tunic: '#a33', hair: 'red', helm: '#888', weapon: { shape: 'sword', color: '#ccc' }, gear: {} }, null); draw(recorder().g, ent(f), { gear: {}, hat: 'no-such-colour', tunic: 'nope' }, null); } } catch (err) { threw = String(err && err.message); }
        check(P0 + 'a look with no ids (an old client) reads back from its colours: the iron helm, the iron sword, the red party hat; colours that are no item draw a plain helm, body and sword without throwing', P.helm && P.helm.id === 'iron_helm' && P.weapon && P.weapon.id === 'iron_sword' && hat.helm && hat.helm.id === 'party_hat_red' && odd.helm && odd.helm.id === null && odd.helm.fam === 'metal' && odd.body.fam === 'plate' && odd.weapon.fam === 'sword' && threw === false, { helm: P.helm && P.helm.id, weapon: P.weapon && P.weapon.id, hat: hat.helm && hat.helm.id, odd: odd.helm && [odd.helm.fam, odd.helm.color], threw }); }

      // 8. a pilot sits: in the walker, the dozer and the beast no legs or boots are drawn; on foot they are
      { const look = lookWith({ legs: 'iron_legs' }), plainLook = lookWith({});
        const bootOf = shade(ITEMS.iron_legs.color, -0.45);
        const legs = (fn, lk, boot) => { const rec = recorder(); fn(rec.g, lk); return rec.fills.filter(f => f === boot).length; };
        const e = ent(FACES[0]), seats = {};
        for (const [name, fn] of [['walker', (g, lk) => drawMech(g, e, false, lk)], ['dozer', (g, lk) => drawDozer(g, e, false, lk, false)], ['beast', (g, lk) => HOOKS.drawMonster.barrelbeast(g, e, false, lk)]]) seats[name] = legs(fn, look, bootOf) + legs(fn, plainLook, '#3a2a1c');
        const foot = legs((g, lk) => draw(g, ent(FACES[0]), lk, null), look, bootOf) + legs((g, lk) => draw(g, ent(FACES[0]), lk, null), plainLook, '#3a2a1c');
        check(P0 + 'a pilot sits: no legs or boots in the walker, the dozer or the beast; on foot both boots show', Object.values(seats).every(n => n === 0) && foot === 4 && KG.seat === 0, { seats, foot, seat: KG.seat }); }

      // 9. the crowd's pictures: six other knights drawn twice make no new picture the second time; at a 1.5 screen the
      // pictures are made at 1.5; the cache never touches the town's building pictures
      { const looks = [{ helm: 'iron_helm', body: 'iron_body', weapon: 'iron_sword' }, { helm: 'party_hat_blue', body: 'silk_cloak', weapon: 'yew_bow', cape: 'cape_hitpoints' }, { helm: 'necro_hood', body: 'necro_robe', shield: 'soul_lantern', weapon: 'mithril_dagger' }, { helm: 'dragon_helm', body: 'dragon_body', weapon: 'dragon_spear' }, { helm: 'godly_helm', body: 'godly_body', legs: 'godly_legs' }, { body: 'ruined_body' }].map((gr, i) => ({ look: lookWith(gr, i === 1 ? { girl: true, woman: true } : null), e: ent(FACES[i % 4], { moving: i % 2 === 1, walkT: i }) }));
        PICS.clear(); WPICS.clear(); time = 50;
        const frame = () => { for (const k of looks) draw(ctx, k.e, k.look, { cache: true }); };
        frame(); const n1 = STATS.pics, w1 = STATS.wpics; frame(); const n2 = STATS.pics, w2 = STATS.wpics;
        const madeFirst = PICS.size;
        DPR = 1.5; PICS.clear(); WPICS.clear(); frame();
        const sizes = [...PICS.values()].map(p => p.c.width);
        DPR = dpr0;
        check(P0 + 'six other knights drawn twice: the first frame makes their pictures, the second makes none; at a 1.5 screen the pictures are made at 1.5 (72 px wide)', madeFirst === 6 && n2 === n1 && w2 === w1 && sizes.length === 6 && sizes.every(w => w === Math.ceil(PIC.w * 1.5)), { madeFirst, again: n2 - n1, wagain: w2 - w1, sizes }); }

      // 10. saves carry no pose: the player drawn, swinging, then saved
      { const look = playerLook(); player.attackT = 0.1; draw(recorder().g, player, look, null); player.attackT = 0;
        const s = JSON.stringify(player);
        check(P0 + 'the pose is never written onto the knight: his save has no wa, hx, hy or waMirror', !/"(wa|hx|hy|waMirror)":/.test(s) && !!POSE.get(player) && Array.isArray(Object.keys(look.gear)) && Object.keys(look.gear).join() === SLOTS.join(), { keys: Object.keys(look.gear) }); }

      // 11. the knight's own look carries the six ids (the obsidian helm from its 'head' slot), and every draw site takes it
      { const q0 = Object.assign({}, player.equip);
        player.equip.helm = null; player.equip.head = 'obsidian_helm'; player.equip.legs = 'iron_legs'; player.equip.cape = 'cape_melee';
        const l = playerLook();
        const ok = l.gear.helm === 'obsidian_helm' && l.gear.legs === 'iron_legs' && l.gear.cape === 'cape_melee';
        for (const k in player.equip) if (!(k in q0)) delete player.equip[k];
        Object.assign(player.equip, q0);
        let threw = false; const rec = recorder();
        try { drawCharacter(rec.g, player, 'player'); drawCharacter(rec.g, player, 'playermech'); title.sprites(rec.g, 0, 0, 1, 0, 0, 1); } catch (err) { threw = String(err && err.message); }
        check(P0 + 'playerLook carries gear with all six slots (the obsidian helm from equip.head); the knight on foot, in the walker and on the title screen draw in the new style', ok && threw === false && rec.all().includes('#ss ' + OUT) && !!title.KNIGHT.gear, { gear: l.gear, threw }); }
    } finally { time = time0; DPR = dpr0; T = 0; }
  });

  return { draw, partsOf, gearKey, cleanGear, poseOf: e => POSE.get(e), STATS, PICS, WPICS, KG, SLOTS, REST_HAND, SHOULDER, REACH };
})();
window.KNIGHTGEAR = KNIGHTGEAR;
