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
// no item draws that family's plain piece in that colour. Looks without gear (townsfolk, guards, monsters, the four
// old heroes' statues) go on down untouched (a townsperson's look, with `who`, never reaches here: 83-townsfolk). Thistledown's statue of the knight himself is a knight look
// with `stone`: the knight in what he wears, every colour mapped to stone (see tintCtx).
//
// HURT: while e.hurtT > 0 the whole knight flashes red: your own knight drawn live (every colour he sets, through
// tintCtx); a knight online from his own picture with the same red laid over it (hurtOf), so a crowd of hurt friends
// costs a blit each, not a live drawing.
//
// WRAPS (by reassignment, explicit arguments): playerLook (adds gear), drawHuman (a knight look comes here, every other
// look goes on down unchanged; 77's crown and 79's braid are drawn here for a knight), drawCharacter (the player on
// foot: the core bobbed the whole figure, this bobs only the body so the feet stay planted), drawMech, drawDozer and
// HOOKS.drawMonster.barrelbeast (a seat counter: a pilot is drawn without legs). title.KNIGHT gets the Iron knight's gear.
//
// SPEED. The knight is about 7x the old drawing's work, so other knights online (73-players, possibly 50 on one map)
// are drawn from pictures: one per (gear, girl, 8 facings, step, animation phase, screen pixel ratio). At rest the
// weapon and its hand are in that picture (one blit a knight); while he swings or eases back the weapon has its own
// picture per (weapon, phase, ratio), cut to the weapon's own size, turned to its angle. Both are LRU maps; the body
// pictures' one is sized to the crowd (34 a knight, 300 to 1700, under 64 MB of pixels) and a facing to his left shares
// the picture of its mirror to his right (WPIC_MAX for the weapons). A hurt knight (the red flash) and everything else
// (your own knight, the seats, the bank, the title, the choice cards, the statue's sprite) is drawn live, so it is
// never soft at a panel's scale. Pictures are only made for the world canvas (`ctx`).
//
// POSE. Where the weapon points and where the hand is ease from frame to frame. It lives in a WeakMap keyed by the
// entity, never on it: the player object is saved whole into every save.
//
// window.KNIGHTGEAR = { draw, partsOf, gearKey, cleanGear, extent, fit, handAt, poseOf, STATS, PICS, WPICS, ... }
// ============================================================================
const KNIGHTGEAR = (() => {
  // ---------- the clock and the colours of the knight being drawn ----------
  let T = 0;                                        // the clock the drawing reads: `time`, or a picture's frozen phase
  let TUNIC = '#3b6fb6', SKIN = '#e8b790', HAIR = '#5a3a1e', RIB = '#d0567f', GIRL = false;
  const GOLD = '#e0b546', OUT = 'rgba(22,14,8,0.62)', RIBBON = '#d0567f';
  const KG = { seat: 0 };
  const STATS = { pics: 0, wpics: 0, live: 0, blits: 0, skirts: 0, tinted: 0, hurtPics: 0 };
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

  // ---------- the whole knight in other colours: hurt (a red flash) and stone (Thistledown's statue) ----------
  // The knight is drawn as always, through a context that passes every colour he sets through a palette: fillStyle,
  // strokeStyle, shadowColor and every gradient stop. So the flash covers his plate, helm and shield, not only the tunic
  // and the face (a closed helm and plate hid those), and the statue is all of him in stone.
  // hurt: 40% of the way to #ff6b6b. stone: the colour's lightness on pale warm stone (dark lines stay dark grey).
  const PALETTES = {
    hurt: (r, gg, b) => [r + (255 - r) * 0.4, gg + (107 - gg) * 0.4, b + (107 - b) * 0.4],
    stone: (r, gg, b) => { const v = 70 + (0.3 * r + 0.59 * gg + 0.11 * b) * 0.6; return [v + 5, v + 1, v - 7]; },
  };
  const TINTED = new Map();
  function tinted(c, kind) {
    if (typeof c !== 'string') return c;
    const k = kind + c;
    let o = TINTED.get(k);
    if (o !== undefined) return o;
    let r, gg, b, a = 1, m;
    if ((m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c))) { let h = m[1]; if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; const n = parseInt(h, 16); r = n >> 16; gg = (n >> 8) & 255; b = n & 255; }
    else if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c))) { r = +m[1]; gg = +m[2]; b = +m[3]; if (m[4] !== undefined) a = +m[4]; }
    else o = c;
    if (o === undefined) { const q = PALETTES[kind](r, gg, b).map(v => Math.max(0, Math.min(255, Math.round(v)))); o = a < 1 ? `rgba(${q[0]},${q[1]},${q[2]},${a})` : `rgb(${q[0]},${q[1]},${q[2]})`; }
    if (TINTED.size > 4000) TINTED.clear();
    TINTED.set(k, o);
    return o;
  }
  function tintCtx(g, kind) {
    STATS.tinted++;
    const fix = v => typeof v === 'string' ? tinted(v, kind) : v && v.__tg ? v.__tg : v;
    return new Proxy(g, {
      get(o, k) {
        const v = o[k];
        if (typeof v !== 'function') return v;
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => { const gr = v.apply(o, a); return { __tg: gr, addColorStop: (t, c) => gr.addColorStop(t, tinted(c, kind)) }; };
        return (...a) => v.apply(o, a);
      },
      set(o, k, v) { o[k] = k === 'fillStyle' || k === 'strokeStyle' || k === 'shadowColor' ? fix(v) : v; return true; },
    });
  }

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
          if (tier === 'bronze') { g.fillStyle = shade(c, 0.55); ell(g, x - 1.7, y + 3, 0.42, 0.42); g.fill(); ell(g, x + 1.7, y + 3, 0.42, 0.42); g.fill(); }
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

  // at: where a raised shield is held (blocking, see raisedShield); otherwise it hangs at his left side
  function drawShield(g, S, back, at) {
    const fam = S.fam, c = S.color, tier = S.tier, id = S.id;
    g.save();
    if (fam === 'lantern') {
      if (at) g.translate(at.x, at.y - 3); else g.translate(-11.5, 4);
      g.strokeStyle = '#6a6f7a'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, -3); g.lineTo(0, 0); g.stroke();
      const p = (0.55 + Math.sin(T * 4) * 0.25).toFixed(3);
      const gl = g.createRadialGradient(0, 3.5, 0, 0, 3.5, 9); gl.addColorStop(0, `rgba(126,231,200,${p})`); gl.addColorStop(1, 'rgba(126,231,200,0)'); g.fillStyle = gl; ell(g, 0, 3.5, 9, 9); g.fill();
      rr(g, -2.6, 0, 5.2, 7, 1.2); g.fillStyle = '#2b2f37'; g.fill(); outline(g, 0.5);
      rr(g, -1.6, 1.2, 3.2, 4.6, 0.8); g.fillStyle = c; g.fill();
      g.fillStyle = '#2b2f37'; g.fillRect(-0.3, 1, 0.6, 5); g.beginPath(); g.moveTo(-2.8, 0); g.lineTo(0, -1.6); g.lineTo(2.8, 0); g.closePath(); g.fill();
      const fl = (0.6 + Math.sin(T * 9) * 0.25).toFixed(3); g.fillStyle = `rgba(230,255,245,${fl})`; ell(g, 0, 3.6, 0.7, 1.1); g.fill();
      g.restore(); return;
    }
    if (at) { g.translate(at.x, at.y); g.rotate(at.rot); g.scale(at.sx, 1); }
    else if (back) { g.translate(0, 1); g.scale(0.95, 0.95); } else { g.translate(-11.2, 2.2); g.rotate(-0.12); }
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
    // facing away, the head under an open helm (bronze, iron, goggles) is the back of his head: hair, not a face
    const face = () => { ell(g, 0, hy, r, r); g.fillStyle = back ? HAIR : SKIN; g.fill(); outline(g, 0.8); };
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
  // a short flared skirt in the tunic's colour, from the belt, hanging longest at her hips and riding up over her legs
  // so the greaves' plates and marks show under the hem (the greave is x 1.2 to 6.6 a side; the hem stays above y 9.2
  // there; the marks are at about y 9 to 10.5). Under plate's lower edge, under a cloak's panels; the robe is long
  // already, so no skirt with it
  const SKIRT_HEM = [[-10.2, 10, -8.6, 10.4, -6.8, 9], [-6.8, 9, -5.4, 9.4, -3.9, 8.8], [-3.9, 8.8, -2.6, 9.4, -1.2, 8.8], [-1.2, 8.8, 0, 9.6, 1.2, 8.8], [1.2, 8.8, 2.6, 9.4, 3.9, 8.8], [3.9, 8.8, 5.4, 9.4, 6.8, 9], [6.8, 9, 8.6, 10.4, 10.2, 10]];
  function girlSkirt(g, B) {
    if (B && B.fam === 'robe') return;
    STATS.skirts++;
    const sk = () => {
      g.beginPath(); g.moveTo(-7.6, 4.4); g.quadraticCurveTo(-9.4, 7, -10.2, 10);
      for (const h of SKIRT_HEM) g.quadraticCurveTo(h[2], h[3], h[4], h[5]);
      g.quadraticCurveTo(9.4, 7, 7.6, 4.4); g.closePath();
    };
    sk(); const gr = g.createLinearGradient(0, 4.4, 0, 10.4); gr.addColorStop(0, shade(TUNIC, 0.06)); gr.addColorStop(1, shade(TUNIC, -0.3)); g.fillStyle = gr; g.fill(); outline(g, 0.7);
    g.strokeStyle = shade(TUNIC, -0.38); g.lineWidth = 0.5; g.beginPath();
    for (const x of [-7.6, -5.2, 5.2, 7.6]) { g.moveTo(x * 0.86, 6.4); g.lineTo(x, x < -6 || x > 6 ? 9.4 : 8.8); }
    g.stroke();
    g.strokeStyle = shade(TUNIC, 0.45); g.lineWidth = 0.55; g.beginPath(); g.moveTo(-9.9, 9.5);
    for (const h of SKIRT_HEM) g.quadraticCurveTo(h[2], h[3] - 0.5, h[4] * (Math.abs(h[4]) > 10 ? 0.97 : 1), h[5] - 0.5);
    g.stroke();
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
  // plaits, the weave, a ribbon of two loops and a knot, a tuft. `short`: down her back over a cape, two plaits and the
  // ribbon tied at the nape, so the braid ends above the cape's badge (the badge is at y 5, r 3.4: its top is y 1.6)
  function girlBraid(g, side, back, short) {
    const n = short ? 2 : 4, x0 = back ? 0 : side * 6.4, y0 = back ? (short ? -6.2 : -4.4) : -5, dx = back ? 0 : side * 0.42;
    for (let k = 0; k < n; k++) {
      const x = x0 + dx * k, y = y0 + 1.4 + k * 2.7;
      g.fillStyle = HAIR; ell(g, x, y, 2.1 - k * 0.12, 1.7, side * 0.3); g.fill(); outline(g, 0.5);
    }
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 0.6; g.beginPath();
    for (let k = 0; k < n - 1; k++) { const x = x0 + dx * (k + 0.5), y = y0 + 2.75 + k * 2.7; g.moveTo(x - 1.6, y - 0.5); g.lineTo(x + 1.6, y + 0.5); }
    g.stroke();
    const rx = x0 + dx * (n - 0.4), ry = y0 + 1.4 + (n - 0.4) * 2.7;
    g.fillStyle = RIB; ell(g, rx - 1.7, ry, 1.8, 1.1, 0.5); g.fill(); outline(g, 0.4);
    g.fillStyle = RIB; ell(g, rx + 1.7, ry, 1.8, 1.1, -0.5); g.fill(); outline(g, 0.4);
    g.fillStyle = RIB; ell(g, rx, ry, 0.9, 0.9); g.fill();
    g.fillStyle = HAIR; g.beginPath(); g.moveTo(rx - 1.3, ry + 0.7); g.lineTo(rx + 1.3, ry + 0.7); g.lineTo(rx + side * 0.4, ry + (short ? 1.8 : 3.4)); g.closePath(); g.fill(); outline(g, 0.4);
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
  // heat (0 to 1): how hot a held stone is (its glow)
  function drawTool(g, tool, col, heat) {
    const c = hex(col, '#b8863a');
    if (tool === 'stone') {
      // the royal mine's stone, held in the hand into the heat (91's rm_heat and rm_warm), reddening as it warms: no haft
      const h = clamp(+heat || 0, 0, 1), gl = g.createRadialGradient(4.2, 0, 1, 4.2, 0, 11);
      gl.addColorStop(0, `rgba(255,190,110,${(0.3 + 0.6 * h).toFixed(3)})`); gl.addColorStop(1, 'rgba(255,120,60,0)'); g.fillStyle = gl; ell(g, 4.2, 0, 11, 11); g.fill();
      g.beginPath(); g.moveTo(0.6, 1.8); g.lineTo(1.4, -2.6); g.lineTo(5, -4); g.lineTo(8.4, -1.2); g.lineTo(7.4, 3.2); g.lineTo(3.4, 4.2); g.closePath(); g.fillStyle = c; g.fill(); outline(g, 0.6);
      g.fillStyle = 'rgba(255,255,255,0.3)'; ell(g, 4, -1.6, 1.4, 0.8, -0.3); g.fill();
      return;
    }
    if (tool === 'rope') {
      // the lobster pot's rope (26-boats): its end coiled in the hand; 26 draws the rope from the hand to the pot
      g.strokeStyle = '#8a7a4a'; g.lineWidth = 1.6; ell(g, 2.6, 0, 3.2, 2.4); g.stroke();
      g.strokeStyle = '#c9b676'; g.lineWidth = 1.1; ell(g, 2.6, 0, 3.2, 2.4); g.stroke(); ell(g, 3.4, 0.2, 2.4, 1.7); g.stroke();
      return;
    }
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
  // at rest: the weapon's angle and the hand at his waist, for this facing and step
  function restPose(S, fam) {
    const side = !S.back && Math.abs(S.fxm) > 0.7 && Math.abs(S.fy) < 0.6, rh = fam === 'bow' ? REST_HAND.bow : REST_HAND.up;
    return { wa: restAngle(fam, side) + S.step * 0.1, hx: rh.x, hy: rh.y + S.step * 0.5 };
  }
  // once a draw per knight: the weapon's angle and the hand ease back to rest after a swing (dt from the game clock)
  function pose(e, S, fam) {
    let rec = POSE.get(e);
    const swing = S.swing, ang = S.ang;
    let target, tx, ty;
    // the hand: round the shoulder while he swings, down at his waist at rest
    if (swing >= 0) { target = fam === 'bow' ? ang : ang + lerp(-1.4, 1.2, kEase(swing)); tx = SHOULDER.x + Math.cos(target) * REACH; ty = SHOULDER.y + Math.sin(target) * REACH; }
    else { const r = restPose(S, fam); target = r.wa; tx = r.hx; ty = r.hy; }
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

  // where his weapon hand was last drawn, from his feet's centre, in the world's pixels (his frame is scaled 1.08 and
  // mirrored facing left): 26-boats' pot rope starts there. null before he is drawn.
  function handAt(e) { const r = e && POSE.get(e); return r ? { x: (r.mirror ? -r.hx : r.hx) * 1.08, y: r.hy * 1.08 } : null; }

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
  // the shield raised while he blocks (47-outliers: R or the BLOCK seat): his own shield, held up square in front of
  // him with its hand behind it. Facing us it is drawn after his head, over his chest; side-on it is over his chest on
  // the side he faces, turned a little edge-on, the weapon at his waist beside it; facing away it is in front of him
  // too, so behind his body from where we look (its inner face, the top showing over his shoulder).
  function raisedShield(g, S, P) {
    const k = clamp(S.fxm, 0, 1);
    // facing away it is held out on his shield side and up, so a small or round one still shows past his shoulder and over
    // it beside his head (held at -9, -4.2 it was hidden behind his back: only the tall kite peeked out)
    const at = S.back ? { x: lerp(-12.8, -9, k), y: -7, rot: -0.22, sx: lerp(1.05, 0.85, k) } : { x: lerp(-2.6, 3.6, k), y: lerp(2.4, 1.6, k), rot: lerp(0, 0.06, k), sx: lerp(1.08, 0.86, k) };
    g.save(); g.translate(0, S.bob);
    ell(g, at.x - 5.4 * at.sx, at.y + 1.2, 2, 2); g.fillStyle = handOf(P.body); g.fill(); outline(g, 0.5);
    drawShield(g, P.shield, S.back, at);
    g.restore();
  }
  // the body: everything but what the weapon hand holds. stage 'behind' = the shield (or lantern) and its hand when he
  // faces away (they go behind his back, under the weapon); 'rest' = the rest; 'all' = both (a picture)
  function paintBody(g, S, P, seated, stage) {
    const up = !!S.block && !!P.shield;
    if (S.back) {
      if (stage !== 'rest') {
        if (up) raisedShield(g, S, P);
        else { g.save(); g.translate(0, S.bob); if (P.shield) drawShield(g, P.shield, false); drawOffHand(g, P.body, S.step); g.restore(); }
      }
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
      if (!up) { drawOffHand(g, P.body, S.step); if (P.shield) drawShield(g, P.shield, false); }
      if (GIRL && showsHair(P.helm)) girlHairBehind(g);
    }
    drawHead(g, P.helm, S.fxm, S.fy, S.back);
    if (GIRL) {
      girlHairAfter(g, P.helm, S.back);
      // over a cape the braid ends at her nape, above the cape's badge
      if (S.back) girlBraid(g, 0, true, !!P.cape);
      if (!P.helm) girlBow(g);
    }
    g.translate(0, -S.bob);
    if (up && !S.back) raisedShield(g, S, P);
  }
  // what the weapon hand holds (a weapon, a tool or the rod), the hand itself and the swoosh of a swing
  function paintHeld(g, S, P, look, hold, wpic) {
    const W = P.weapon;
    if (hold) {
      g.save(); g.translate(hold.hx, hold.hy + S.bob); g.rotate(hold.wa);
      if (look.rod) drawRod(g); else drawTool(g, look.tool, look.toolColor, look.toolHeat);
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
    S.block = !!look.block;
    g.save();
    g.scale(S.mirror ? -1.08 : 1.08, 1.08);
    // e.seatLine: sitting IN something (the ferry's bow), nothing of him below that line in his own frame is drawn (an
    // upright stave or spear, a robe's hem, a cape: they are down inside the boat, not over its planks)
    if (seated && typeof e.seatLine === 'number') { g.beginPath(); g.rect(-60, -80, 120, 80 + e.seatLine); g.clip(); }
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
  // The body pictures' LRU is sized to the crowd. A knight who walks and turns needs 5 facings (the left ones are
  // mirrors) x 4 poses of the walk = 20 pictures, and a standing one more; 16 a knight was too few (a turning crowd
  // made pictures for ever), and friends online swing (73 plays each swing a presence carries): a swing's body has no
  // weapon in it, one more picture a facing standing and up to four walking. So the cap is 34 for every knight drawn in
  // the busiest recent frame (300 at least, 1700 at most), and the pictures' pixels are held under PIC_BYTES.
  const PIC_MIN = 300, PIC_TOP = 1700, PIC_EACH = 34, PIC_BYTES = 64 * 1024 * 1024, WPIC_MAX = 80;
  let picCap = PIC_MIN, picBytes = 0, crowdN = 0, crowdHi = 0;
  // once a frame (the first HOOKS.draw handler call of a render): the crowd of the last frame sets the cap; it falls
  // back slowly (one knight every 20 frames) when the crowd thins
  function newFrame() {
    crowdHi = Math.max(crowdN, crowdHi - 0.05); crowdN = 0;
    picCap = clamp(Math.ceil(crowdHi) * PIC_EACH, PIC_MIN, PIC_TOP);
  }
  const PICS = new Map(), WPICS = new Map();
  const picScale = () => Math.round(Math.max(1, Math.min(2, typeof DPR === 'number' && DPR > 0 ? DPR : 1)) * 100) / 100;
  // a Map is in the order things went in: touching an entry moves it to the end, so the front is the least lately used
  function lruGet(M, k) { const v = M.get(k); if (v) { M.delete(k); M.set(k, v); } return v; }
  const picBytesOf = o => o && o.c ? (o.c.width * o.c.height * 4) || 0 : 0;
  function lruPut(M, k, v, max, budget) {
    if (budget && !M.size) picBytes = 0;
    const old = M.get(k);
    if (old && old !== v) { M.delete(k); if (budget) picBytes -= picBytesOf(old); }
    M.set(k, v);
    if (budget) picBytes += picBytesOf(v);
    while (M.size > max || (budget && picBytes > budget && M.size > 1)) {
      const [k0, o] = M.entries().next().value; M.delete(k0);
      if (budget) picBytes -= picBytesOf(o);
      try { o.c.width = 0; o.c.height = 0; if (o.hurt) { o.hurt.width = 0; o.hurt.height = 0; } } catch (e) { }
    }
  }
  // check 19's picture canvas: the self-test makes each picture a recorder (and lets a picture be put down on a recorder,
  // not only the world canvas) to prove a picture is the live knight. Always null in the game.
  let PICTEST = null;
  function makeCanvas(w, h, ss) {
    if (PICTEST) return PICTEST(w, h, ss);
    if (typeof document === 'undefined' || !document.createElement) return null;
    const c = document.createElement('canvas'); c.width = Math.ceil(w * ss); c.height = Math.ceil(h * ss);
    const cg = c.getContext ? c.getContext('2d') : null;
    if (!cg || !c.width) return null;
    return { c, cg };
  }
  const animatedBody = P => (P.helm && (ANIMATED.has(P.helm.id) || P.helm.fam === 'party')) || (P.body && ANIMATED.has(P.body.id)) || (P.shield && ANIMATED.has(P.shield.id)) || (P.cape && ANIMATED.has(P.cape.id));
  const STEPS = 8, PHASES = 4, TWO_PI = Math.PI * 2;
  // A picture is cut to what is drawn in it (the bounds of every path, plus two pixels), so a plain knight is a small one.
  // At rest (no swing, not easing back from one, nothing else in the hand) the weapon and its hand are in the picture
  // too: one blit a knight. Otherwise the body is one picture and the weapon another, turned to its angle.
  function drawCached(g, e, look, P, hurt) {
    // his shield raised is drawn live (only your own knight blocks; it is not in the presence look)
    if (look.block) return false;
    crowdN++;
    const ss = picScale();
    // 8 facings (5 pictures: the left ones are mirrors), 4 poses of the walk (-1 = standing), 4 phases of the clock for
    // the pieces that move with it
    const a = Math.atan2(e.facing ? +e.facing.y || 0 : 1, e.facing ? +e.facing.x || 0 : 0);
    const dir = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    // a facing to his left (dir 3, 4, 5) is drawn as its mirror to the right (1, 0, 7) and flipped as it is put down
    const flip = dir >= 3 && dir <= 5, pdir = flip ? (12 - dir) % 8 : dir, da = pdir * Math.PI / 4;
    const moving = !!e.moving;
    // the 8 steps of a walk come in pairs that are the same pose (the step is sin of the walk: steps 0 and 3, 1 and 2, 4
    // and 7, 5 and 6 are equal), so a pair shares one picture: 4 a facing
    const s8 = moving ? Math.floor((((+e.walkT || 0) % TWO_PI) + TWO_PI) % TWO_PI / TWO_PI * STEPS) : -1;
    const sb = s8 < 0 ? -1 : s8 < 4 ? Math.min(s8, 3 - s8) : 4 + Math.min(s8 - 4, 7 - s8);
    const wt = moving ? (sb + 0.5) / STEPS * TWO_PI : 0;
    const fe = { facing: { x: Math.cos(da), y: Math.sin(da) }, moving, walkT: wt, attackT: e.attackT, hurtT: e.hurtT };
    const T0 = T;
    // the stance with the picture's own facing and step, so the weapon sits on the picture's body
    const S = stance(fe, false, wt);
    const hold = holdOf(e, S, look);
    const W = P.weapon, fam = W ? W.fam : null;
    S.rec = hold || pose(e, S, fam);
    let rest = null;
    // at rest once the weapon has eased to within a little of where it rests: walking, the rest itself moves with the
    // step (0.1 a step) and the ease always trails it, so a near miss is the rest (else every walking knight with a
    // weapon would need a second set of pictures without it)
    if (!hold && S.swing < 0) { const r = restPose(S, fam); if (!W || (Math.abs(angDiff(S.rec.wa, r.wa)) < 0.22 && Math.abs(S.rec.hx - r.hx) < 1.2 && Math.abs(S.rec.hy - r.hy) < 1.2)) rest = r; }
    // walking, the step itself moves the clock on (4 pictures a walk, not 32); standing, the clock's own 4 phases
    const anim = !moving && (animatedBody(P) || (!!rest && !!W && WANIMATED.has(W.id))), ph = anim ? Math.floor(time * 4) % PHASES : 0;
    const tPic = moving ? sb * 0.29 : ph * 0.37 + 0.2;
    const key = gearKey(P) + '|' + (rest ? 'R' + (look.fists ? 'f' : '') : '') + '|' + (GIRL ? 'g' + HAIR + RIB : 'b' + HAIR) + '|' + TUNIC + SKIN + '|' + pdir + '|' + sb + '|' + ph + '|' + ss;
    let p = lruGet(PICS, key);
    if (!p) {
      T = tPic;
      const S2 = stance(fe, false, wt);
      if (rest) S2.rec = rest;
      const paint = cg => {
        cg.scale(S2.mirror ? -1.08 : 1.08, 1.08);
        if (!rest) paintBody(cg, S2, P, false, 'all');
        else if (S2.back) { paintBody(cg, S2, P, false, 'behind'); paintHeld(cg, S2, P, look, null, null); paintBody(cg, S2, P, false, 'rest'); }
        else { paintBody(cg, S2, P, false, 'all'); paintHeld(cg, S2, P, look, null, null); }
      };
      let cv = null, bx = null;
      try {
        const tr = tracker(); measuring(() => paint(tr.g)); bx = tr.b;
        // two pixels round what is drawn: the tracker keeps a path's points, and a stroke reaches half its width past them
        // (the bow's outline is 3.4 px wide)
        const x0 = Math.floor(bx.l) - 2, y0 = Math.floor(bx.t) - 2, w = Math.ceil(bx.r) + 2 - x0, h = Math.ceil(bx.b) + 2 - y0;
        cv = makeCanvas(w, h, ss);
        if (cv) { cv.cg.scale(ss, ss); cv.cg.translate(-x0, -y0); paint(cv.cg); p = { c: cv.c, x0, y0, w, h, ss }; }
      } catch (err) { p = null; }
      T = T0;
      if (!p) return false;
      lruPut(PICS, key, p, picCap, PIC_BYTES); STATS.pics++;
    }
    STATS.blits++;
    // S is the picture's own (unflipped) stance, so what he holds is flipped with the picture
    const wp = hurt ? (g2, W2, sw) => weaponPic(g2, W2, sw, true) : weaponPic;
    const held = () => { const gh = hurt ? tintCtx(g, 'hurt') : g; gh.save(); gh.scale(S.mirror ? -1.08 : 1.08, 1.08); paintHeld(gh, S, P, look, hold, wp); gh.restore(); };
    if (flip) { g.save(); g.scale(-1, 1); }
    if (!rest && S.back) held();
    g.drawImage((hurt && hurtOf(p)) || p.c, p.x0, p.y0, p.c.width / p.ss, p.c.height / p.ss);
    if (!rest && !S.back) held();
    if (flip) g.restore();
    return true;
  }
  function clearPics() { for (const o of [...PICS.values(), ...WPICS.values()]) { try { o.c.width = 0; o.c.height = 0; if (o.hurt) { o.hurt.width = 0; o.hurt.height = 0; } } catch (e) { } } PICS.clear(); WPICS.clear(); picBytes = 0; }
  // a picture's hurt flash: the picture with 40% of #ff6b6b laid over what is drawn in it (source-atop keeps the clear
  // pixels clear), which is exactly PALETTES.hurt's mix; made once and kept with the picture
  function hurtOf(p) {
    if (p.hurt) return p.hurt;
    if (typeof document === 'undefined' || !document.createElement) return null;
    const c = document.createElement('canvas'); c.width = p.c.width; c.height = p.c.height;
    const cg = c.getContext ? c.getContext('2d') : null;
    if (!cg || !c.width) return null;
    cg.drawImage(p.c, 0, 0); cg.globalCompositeOperation = 'source-atop'; cg.globalAlpha = 0.4; cg.fillStyle = '#ff6b6b'; cg.fillRect(0, 0, c.width, c.height);
    p.hurt = c; STATS.hurtPics++;
    return c;
  }
  // a weapon's picture, turned to its angle (while he swings or eases back); a bow being drawn is drawn live. The
  // picture is cut to the weapon itself (its own bounds, measured once, plus two pixels): a turned picture costs for every
  // pixel it covers, and most weapons are far smaller than a spear.
  function weaponPic(g, W, swing, hurt) {
    if (W.fam === 'bow' && swing >= 0) return false;
    const ss = picScale(), anim = WANIMATED.has(W.id), ph = anim ? Math.floor(time * 4) % PHASES : 0;
    const key = keyOf(W) + '|' + ph + '|' + ss;
    let p = lruGet(WPICS, key);
    if (!p) {
      const T0 = T; T = ph * 0.37 + 0.2;
      try {
        const tr = tracker(); measuring(() => drawWeapon(tr.g, W, -1)); const bx = tr.b;
        // two pixels round it: the tracker keeps a path's points, and the bow's string is a 3.4 px wide stroke
        const x0 = Math.floor(bx.l) - 2, y0 = Math.floor(bx.t) - 2, w = Math.ceil(bx.r) + 2 - x0, h = Math.ceil(bx.b) + 2 - y0;
        // made at 1.08x the screen ratio: the knight's own frame is scaled 1.08
        const s2 = ss * 1.08, cv = makeCanvas(w, h, s2);
        if (!cv) { T = T0; return false; }
        cv.cg.scale(s2, s2); cv.cg.translate(-x0, -y0); drawWeapon(cv.cg, W, -1);
        p = { c: cv.c, x0, y0, w, h };
      } catch (err) { T = T0; return false; }
      T = T0;
      lruPut(WPICS, key, p, WPIC_MAX, 0); STATS.wpics++;
    }
    g.drawImage((hurt && hurtOf(p)) || p.c, p.x0, p.y0, p.w, p.h);
    return true;
  }

  // the one way in: a knight look (one with gear) on entity e, at (0, 0) = his feet's centre, as drawHuman is
  // opts: { seated, cache, t }; e.seated works too (the boat). cache is for 73's world-scale remote knights only (and only
  // onto the world canvas).
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
      const seated = !!opts.seated || KG.seat > 0 || !!e.seated;
      // hurt, the whole knight flashes red (a knight online from his red picture, your own live); a stone look is all stone
      const hurt = e.hurtT > 0, stone = !!look.stone;
      if (opts.cache && !seated && !stone && (g === ctx || PICTEST) && drawCached(g, e, look, P, hurt)) return;
      drawLive(stone ? tintCtx(g, 'stone') : hurt ? tintCtx(g, 'hurt') : g, e, look, P, seated);
    } finally { T = T0; }
  }

  // ---------- how much room the knight takes (for the panels that show him big: the bank, the choice cards) ----------
  // The new knight stands taller than the old one (an upright spear reaches about -39 px over his feet, a party hat -34),
  // so a panel fits the box round what he really wears: he is drawn once, facing down, into a context that only keeps
  // the outermost point of every path (through every translate, scale and rotate). Kept per look (gear, girl, held).
  // a measuring pass (into a tracker) is not a drawing: the counters the self-tests read are left as they were
  function measuring(fn) { const a = STATS.live, b = STATS.skirts, c = STATS.tinted; try { return fn(); } finally { STATS.live = a; STATS.skirts = b; STATS.tinted = c; } }
  // a context that draws nothing and keeps the outermost point of every path, through translate, scale and rotate.
  // It is a plain object, not a Proxy: every picture a crowd needs is measured through it first, and a Proxy's traps (a
  // new function for every fill and stroke) are slow. Every other drawing call on a canvas is a no-op here (the rest of
  // the CanvasRenderingContext2D API, and HEAD / HEADEND, marks a self-test writes); a colour or width set on it is kept.
  const NOOP = () => { }, NOGRAD = { addColorStop: NOOP }, NOTEXT = { width: 10 };
  const TRACK_NOOPS = ['beginPath', 'closePath', 'fill', 'stroke', 'clip', 'clearRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage', 'setLineDash', 'putImageData', 'drawFocusIfNeeded', 'reset', 'roundRect', 'transform', 'setTransform', 'resetTransform', 'HEAD', 'HEADEND'];
  class Tracker {
    constructor() { this.b = { l: 0, t: 0, r: 0, b: 0 }; this.m = [1, 0, 0, 1, 0, 0]; this.st = []; }
    pt(px, py) { const m = this.m, b = this.b, X = m[0] * px + m[2] * py + m[4], Y = m[1] * px + m[3] * py + m[5]; if (X < b.l) b.l = X; if (X > b.r) b.r = X; if (Y < b.t) b.t = Y; if (Y > b.b) b.b = Y; }
    box(x0, y0, w, h) { this.pt(x0, y0); this.pt(x0 + w, y0); this.pt(x0, y0 + h); this.pt(x0 + w, y0 + h); }
    mul(a, c, d, e, f, h) { const [A, B, C, D, E, F] = this.m; this.m = [A * a + C * c, B * a + D * c, A * d + C * e, B * d + D * e, A * f + C * h + E, B * f + D * h + F]; }
    save() { this.st.push(this.m.slice()); }
    restore() { if (this.st.length) this.m = this.st.pop(); }
    translate(tx, ty) { this.mul(1, 0, 0, 1, tx, ty); }
    scale(sx, sy) { this.mul(sx, 0, 0, sy, 0, 0); }
    rotate(a) { const c = Math.cos(a), s2 = Math.sin(a); this.mul(c, s2, -s2, c, 0, 0); }
    moveTo(x, y) { this.pt(x, y); }
    lineTo(x, y) { this.pt(x, y); }
    quadraticCurveTo(a, b2, c, d) { this.pt(a, b2); this.pt(c, d); }
    bezierCurveTo(a, b2, c, d, e, f) { this.pt(a, b2); this.pt(c, d); this.pt(e, f); }
    arcTo(a, b2, c, d) { this.pt(a, b2); this.pt(c, d); }
    arc(cx, cy, r) { this.box(cx - r, cy - r, 2 * r, 2 * r); }
    ellipse(cx, cy, rx, ry) { const r = Math.max(rx, ry); this.box(cx - r, cy - r, 2 * r, 2 * r); }
    rect(x0, y0, w, h) { this.box(x0, y0, w, h); }
    fillRect(x0, y0, w, h) { this.box(x0, y0, w, h); }
    createLinearGradient() { return NOGRAD; }
    createRadialGradient() { return NOGRAD; }
    createConicGradient() { return NOGRAD; }
    createPattern() { return null; }
    measureText() { return NOTEXT; }
    getTransform() { return undefined; }
  }
  for (const k of TRACK_NOOPS) Tracker.prototype[k] = NOOP;
  function tracker() { const tg = new Tracker(); return { g: tg, b: tg.b }; }
  const EXT = new Map();
  function extent(look) {
    look = look || {};
    const P = partsOf(look), key = gearKey(P) + '|' + (look.girl ? 'g' : '') + '|' + (look.tool || '') + (look.rod ? 'r' : '') + (look.weapon ? 'w' : '');
    let x = EXT.get(key);
    if (x) return x;
    const tr = tracker(), b = tr.b;
    try { measuring(() => draw(tr.g, { facing: { x: 0, y: 1 }, moving: false, walkT: 0, attackT: 0, hurtT: 0 }, look, { t: 0 })); } catch (e) { return { l: -20, t: -24, r: 20, b: 17 }; }
    x = { l: b.l, t: b.t, r: b.r, b: b.b };
    if (EXT.size > 60) EXT.clear();
    EXT.set(key, x);
    return x;
  }
  // the scale and the offset that fit the knight (and a shadow reaching `foot` below his feet) in a w x h box, at most maxS
  function fit(look, w, h, foot, maxS) {
    const x = extent(look), t = x.t, bot = Math.max(x.b, foot || 0), l = Math.min(x.l, -12), r = Math.max(x.r, 12);
    const s = Math.min(maxS || 99, w / (r - l), h / (bot - t));
    // centred on the box; his feet's centre is where the caller translates to
    return { s, x: w / 2 - (l + r) / 2 * s, y: (h - (bot - t) * s) / 2 - t * s };
  }

  // ---------- the wraps ----------
  // the look: the six slots' ids ride along with the old colour fields
  // The work other files add (the core's playerLook sets look.tool only for its own chop, mine, till and smith): the
  // knight holds that tool in his hand too, coloured by the action's tier as 08-draw does. Those files used to draw a
  // loose pick or axe over the old knight; they leave it to the knight now (see 24-dwarves, 25-elves, 27-dragons,
  // 91-royalmine).
  // 53-coalmine's coal face ('coalface') is a pickaxe swing too. Two hold something still, in his hand (owner's decision
  // 1: hands on what he holds): the royal mine's stone held into the heat (91's rm_heat, rm_warm: 'stone', reddening as
  // it warms; 91 no longer draws it loose in front of him) and the lobster pot's rope (26-boats: 'rope', its end in his
  // hand; 26 draws the rope from that hand, handAt). Standing still (rm_watch) and cooking (the core) hold nothing.
  const TOOL_ACTS = { mine_obsidian: 'pickaxe', mine_mithril: 'pickaxe', chop_jungle: 'axe', rm_giant: 'pickaxe', rm_vein: 'pickaxe', coalface: 'pickaxe', rm_heat: 'stone', rm_warm: 'stone', lobster: 'rope' };
  const STILL_TOOLS = { stone: true, rope: true };
  // the warming stone's colour: dull red to orange as it warms (the colours 91 drew it in)
  const stoneHeat = a => clamp((+a.t || 0) / (+a.need || 1), 0, 1);
  const stoneTint = k => '#' + [122 + 133 * k, 42 + 110 * k, 28 + 30 * k].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const heartPick = () => (typeof countItem === 'function' && countItem('heartstone_pickaxe') > 0) || player.equip.weapon === 'heartstone_pickaxe';
  const toolTint = a => /^rm_/.test(a.type) && heartPick() ? '#e0583c' : a.tier >= 3 ? '#7aa0d0' : a.tier === 2 ? '#a9adb5' : '#b8863a';
  const _playerLook = playerLook;
  playerLook = function () {
    const l = _playerLook();
    const q = (player && player.equip) || {};
    l.gear = { helm: q.helm || q.head || null, body: q.body || null, legs: q.legs || null, shield: q.shield || null, cape: q.cape || null, weapon: q.weapon || null };
    const a = player && player.action;
    // an action with no tier of its own (the coal face) is tinted by the best tool of that kind he has, as the core's mine
    if (a && TOOL_ACTS[a.type] && !l.tool && !l.rod) {
      const tool = TOOL_ACTS[a.type];
      if (STILL_TOOLS[tool]) { l.tool = tool; l.toolSwing = false; if (tool === 'stone') { l.toolHeat = stoneHeat(a); l.toolColor = stoneTint(l.toolHeat); } else l.toolColor = '#c9b676'; }
      else { const tier = typeof a.tier === 'number' ? a.tier : (typeof hasTool === 'function' ? hasTool(tool) : 1); l.tool = tool; l.toolSwing = true; l.toolColor = toolTint({ type: a.type, tier }); }
      delete l.weapon; delete l.fists;
    }
    // the shield raised (47-outliers' block): your own knight only (it is not in the presence look)
    const O = window.OUTLIERS;
    if (O && O.BLOCK && O.BLOCK.t > 0 && !player.mech && !player.dead && q.shield && ITEMS[q.shield]) l.block = true;
    return l;
  };
  // a frame begins: the crowd of the last one sizes the picture cache
  HOOKS.draw.push((g, items) => { newFrame(); });
  // drawHuman: a knight look is drawn here; every other look goes on down unchanged (83-townsfolk, outside this one, takes the townsfolk)
  const _drawHuman = drawHuman;
  // a stone look (95-thistledown's statue of the knight) stands still: its clock is stopped at 0 (no breathing bob)
  const STILL = { t: 0 };
  drawHuman = function (g, e, look) {
    if (!look || !look.gear || typeof look.gear !== 'object') return _drawHuman(g, e, look);
    draw(g, e, look, look.stone ? STILL : null);
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
  // Every point of every path a recorder saw after op i0, in the frame op i0 was drawn in (a translate moves the
  // points with it; a path inside a turned or scaled frame is skipped): [x, y, r], r the radius a circle or an ellipse
  // reaches round its point. Curves are sampled at quarters.
  function ptsAfter(ops, i0) {
    const out = [], st = [];
    let ox = 0, oy = 0, moved = false, cx = 0, cy = 0;
    const put = (x, y, r) => { out.push([x + ox, y + oy, r || 0]); };
    for (let i = i0 + 1; i < ops.length; i++) {
      const o = ops[i], sp = o.indexOf(' '), k = sp < 0 ? o : o.slice(0, sp);
      const n = sp < 0 ? [] : o.slice(sp + 1).split(' ').filter(Boolean).map(Number);
      if (k === 'save') { st.push([ox, oy, moved]); continue; }
      if (k === 'restore') { if (st.length) [ox, oy, moved] = st.pop(); continue; }
      if (k === 'translate') { if (!moved) { ox += n[0]; oy += n[1]; } continue; }
      if (k === 'rotate' || k === 'scale' || k === 'transform' || k === 'setTransform') { moved = true; continue; }
      if (moved) continue;
      if (k === 'moveTo' || k === 'lineTo') { put(n[0], n[1]); cx = n[0]; cy = n[1]; }
      else if (k === 'quadraticCurveTo') { for (const t of [0.25, 0.5, 0.75, 1]) { const u = 1 - t; put(u * u * cx + 2 * u * t * n[0] + t * t * n[2], u * u * cy + 2 * u * t * n[1] + t * t * n[3]); } cx = n[2]; cy = n[3]; }
      else if (k === 'bezierCurveTo') { for (const t of [0.25, 0.5, 0.75, 1]) { const u = 1 - t; put(u * u * u * cx + 3 * u * u * t * n[0] + 3 * u * t * t * n[2] + t * t * t * n[4], u * u * u * cy + 3 * u * u * t * n[1] + 3 * u * t * t * n[3] + t * t * t * n[5]); } cx = n[4]; cy = n[5]; }
      else if (k === 'arcTo') { put(n[0], n[1]); put(n[2], n[3]); cx = n[2]; cy = n[3]; }
      else if (k === 'ellipse') put(n[0], n[1], Math.max(n[2], n[3]));
      else if (k === 'arc') put(n[0], n[1], n[2]);
      else if (k === 'fillRect' || k === 'rect' || k === 'strokeRect') { put(n[0], n[1]); put(n[0] + n[2], n[1]); put(n[0], n[1] + n[3]); put(n[0] + n[2], n[1] + n[3]); }
    }
    return out;
  }
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
        // a skill cape's badge shows on the knight's back only, a boy's or a girl's (bare-headed with her long hair, or
        // in a helm), and nothing drawn after it covers it (her braid ends above it): no path after the badge reaches
        // into its circle (0, 5, r 3.4)
        const BADGE = 'ellipse 0.0 5.0 3.4 3.4';
        const who = { boy: {}, girl: { girl: true, woman: true }, girlHelm: { girl: true, woman: true } };
        const badge = (id, w) => {
          const r = [false, false, true];
          [FACES[0], FACES[2]].forEach((f, i) => {
            const rec = recorder(); draw(rec.g, ent(f), lookWith(w === 'girlHelm' ? { cape: id, helm: 'iron_helm' } : { cape: id }, who[w]), { t: 0.5 });
            const at = rec.ops.findIndex(o => o.startsWith(BADGE)); r[i] = at >= 0;
            // from the end of the badge's own picture (its save ... restore) on
            if (i === 1 && at >= 0) {
              let j = rec.ops.findIndex((o, k) => k > at && o.startsWith('save')), d = 0, end = -1;
              for (let k = j; j >= 0 && k < rec.ops.length; k++) { if (rec.ops[k].startsWith('save')) d++; else if (rec.ops[k].startsWith('restore') && --d === 0) { end = k; break; } }
              r[2] = end >= 0 && ptsAfter(rec.ops, end).every(([x, y, rad]) => Math.hypot(x, y - 5) >= 3.4 + rad - 0.05);
            }
          });
          return r;
        };
        const capes = Object.keys(ITEMS).filter(id => /^cape_/.test(id) || id === 'guild_cape');
        const badges = [];
        for (const w in who) for (const id of capes) { const b = badge(id, w); if (b[0] || !b[1] || !b[2]) badges.push(w + ' ' + id + (b[1] && !b[2] ? ' (covered)' : '')); }
        const missing = Object.keys(marks).filter(k => !marks[k]);
        check(P0 + 'each family draws its own mark (crest, plume, slit, robe lining, hood eyes, party cone, lantern, wings, horns, goggles, pouch), and each of the ' + capes.length + ' skill capes shows its badge on the back only, a boy\'s or a girl\'s, with nothing (her braid, her hair) drawn over it', !missing.length && !badges.length && capes.length >= 14, { missing, badges: badges.slice(0, 8) }); }

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
          // the hand as DRAWN at rest, at all four facings: the gauntlet's own circle (r 2.2), below the shoulder plates
          // and at the belt (y 4 to 6 in his own frame, the breathing bob aside); a bow's hand at his side
          const low = [];
          for (const fc of FACES) {
            const r2 = recorder(), e2 = ent(fc); draw(r2.g, e2, look, { t: 0 });
            const hands = r2.ops.filter(o => /^ellipse \S+ \S+ 2\.2 2\.2/.test(o)).map(o => o.split(' ').slice(1, 3).map(Number)).filter(([x]) => x > 7 && x < 13);
            const hy = hands.length === 1 ? hands[0][1] : NaN;
            if (!(f === 'bow' ? hy >= SHOULDER.y + 2 && hy <= 5 : hy >= SHOULDER.y + 3 && hy <= 6)) low.push([fc.x, fc.y, hy]);
          }
          if (!(upright && atWaist && reach && back && !low.length)) bad.push({ f, id, upright, atWaist, reach, back, low, wa: +rec.wa.toFixed(2), hand: [+rec.hx.toFixed(1), +rec.hy.toFixed(1)] });
        }
        // the owner's numbers themselves (the checks above compare the hand with REST_HAND, so they alone cannot see it moved)
        const near = (p, x, y) => !!p && Math.abs(p.x - x) <= 0.3 && Math.abs(p.y - y) <= 0.3;
        const nums = near(REST_HAND.up, 10.4, 4.8) && near(REST_HAND.bow, 10.8, 3.6);
        check(P0 + 'at rest every weapon family (' + Object.keys(fams).length + ') stands upright with the hand at his waist (REST_HAND 10.4, 4.8; the bow at his side, 10.8, 3.6), drawn below the shoulder plates at the belt at all four facings; a swing lifts the hand round the shoulder and half a second after it the hand is back at the waist', nums && !bad.length && Object.keys(fams).length >= 10, { nums, rest: REST_HAND, bad, fams: Object.keys(fams) }); }

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
        const skirt = helm.ops.some(o => o.startsWith('createLinearGradient 0.0 4.4 0.0 10.4'));
        const lashes = bare.ops.includes('#ss #222');
        const boy = recorder(); draw(boy.g, ent(FACES[0]), lookWith({ helm: 'iron_helm' }, { hair: HAIR0 }), { t: 0.5 });
        check(P0 + 'a girl knight is drawn in the new style: under the iron helm her locks and braid (3+ hair fills) and the ribbon; bare-headed the bow too; facing away the braid down her back; a party hat shows her hair; a skirt, lashes; a boy under a helm shows no hair', style && n(helm) >= 3 && rib(helm) >= 3 && rib(bare) >= 6 && n(back) >= 4 && rib(back) >= 3 && n(party) >= 5 && skirt && lashes && n(boy) === 0, { style, helm: [n(helm), rib(helm)], bare: rib(bare), back: [n(back), rib(back)], party: n(party), skirt, lashes, boy: n(boy) }); }

      // 6b. a girl walking up the screen (facing away) has no face: the old drawing drew her face and her braid from the
      // chin down the front, so she looked bearded. Bare-headed and in every helm in the game, with and without a cape,
      // standing and walking: no skin on her head, no eyes, brows, cheeks or lashes; the braid's ribbon knot is on her
      // back (x 0, below her head) and drawn after her head. Facing us the same detectors do find her face (so they work).
      { const HAIR0 = '#654321', SKIN0 = '#e8b791', helms = [null];
        for (const id in ITEMS) if (slotOf(ITEMS[id]) === 'helm') helms.push(id);
        const brow = shade(HAIR0, -0.2), cheek = 'rgba(232,108,120,0.5)';
        const faceOf = rec => {
          const o = rec.ops;
          return {
            skin: o.filter(x => x === '@fill ' + SKIN0).length,
            eyes: o.filter(x => { const n = x.split(' '); return n[0] === 'ellipse' && n[3] === '1.1' && n[4] === '1.3'; }).length,
            brows: o.filter(x => x === '#ss ' + brow).length,
            cheeks: o.filter(x => x === '@fill ' + cheek).length,
            lashes: o.filter(x => x === '#ss #222').length,
          };
        };
        // the ribbon's knot: the r 0.9 circle filled in the ribbon's colour (the bow on a bare head is another, at y -17);
        // where it is and when (op index). The head is marked by wrapping drawHead (the recorder writes down any call).
        const knotOf = rec => { const o = rec.ops; for (let i = o.length - 1; i >= 2; i--) if (o[i] === '@fill ' + RIBBON && /^ellipse \S+ \S+ 0\.9 0\.9/.test(o[i - 2])) { const e = o[i - 2].split(' '); if (+e[2] > -14) return { x: +e[1], y: +e[2], i }; } return null; };
        const headAt = rec => rec.ops.lastIndexOf('HEADEND ');
        const _dh = drawHead;
        const bad = []; let tried = 0, front = null;
        drawHead = function (g, H, fxm, fy, back) { g.HEAD(); try { return _dh(g, H, fxm, fy, back); } finally { g.HEADEND(); } };
        try {
          for (const helm of helms) for (const cape of [null, 'cape_melee']) for (const moving of [false, true]) {
            const look = lookWith({ helm, cape, body: 'iron_body' }, { girl: true, woman: true, hair: HAIR0, skin: SKIN0 });
            const rec = recorder(); draw(rec.g, ent(FACES[2], { moving, walkT: 1.1 }), look, { t: 0.5 }); tried++;
            const f = faceOf(rec), k = knotOf(rec), hd = headAt(rec);
            const faceless = !f.skin && !f.eyes && !f.brows && !f.cheeks && !f.lashes;
            const onBack = !!k && Math.abs(k.x) < 0.5 && k.y > -2.8 && k.y < 8 && k.i > hd && hd >= 0;
            if (!faceless || !onBack) bad.push({ helm, cape, moving, f, knot: k, head: hd });
          }
          front = recorder(); draw(front.g, ent(FACES[0]), lookWith({}, { girl: true, woman: true, hair: HAIR0, skin: SKIN0 }), { t: 0.5 });
        } finally { drawHead = _dh; }
        const ff = faceOf(front), fk = knotOf(front);
        const sees = ff.skin >= 1 && ff.eyes === 2 && ff.brows >= 1 && ff.cheeks === 2 && ff.lashes >= 1 && !!fk && Math.abs(fk.x) > 5;
        check(P0 + 'a girl knight facing away (walking up the screen) has no face and her braid hangs down her back: bare-headed and in all ' + (helms.length - 1) + ' helms, with and without a cape, standing and walking (' + tried + ' drawings), no skin on her head, no eyes, brows, cheeks or lashes, and the ribbon knot on her back below her head, drawn after it; facing us the face is found', sees && !bad.length && tried >= 80, { tried, sees, front: ff, frontKnot: fk, bad: bad.slice(0, 4), n: bad.length }); }

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
        const seatsAt = [['walker', (g, lk) => drawMech(g, e, false, lk)], ['dozer', (g, lk) => drawDozer(g, e, false, lk, false)], ['beast', (g, lk) => HOOKS.drawMonster.barrelbeast(g, e, false, lk)]];
        // the mare (51-mounts), facing down and side-on
        if (window.MOUNTS && MOUNTS.drawHorse) for (const f of [FACES[0], FACES[1]]) seatsAt.push(['mare ' + f.x + ',' + f.y, (g, lk) => MOUNTS.drawHorse(g, ent(f), false, lk)]);
        for (const [name, fn] of seatsAt) seats[name] = legs(fn, look, bootOf) + legs(fn, plainLook, '#3a2a1c');
        const foot = legs((g, lk) => draw(g, ent(FACES[0]), lk, null), look, bootOf) + legs((g, lk) => draw(g, ent(FACES[0]), lk, null), plainLook, '#3a2a1c');
        check(P0 + 'a pilot sits: no legs or boots in the walker, the dozer, the beast or on the mare; on foot both boots show', Object.values(seats).every(n => n === 0) && Object.keys(seats).length === 5 && foot === 4 && KG.seat === 0, { seats, foot, seat: KG.seat }); }

      // 9. the crowd's pictures: six other knights drawn twice make no new picture the second time; at a 1.5 screen the
      // pictures are made at 1.5; the cache never touches the town's building pictures
      { const looks = [{ helm: 'iron_helm', body: 'iron_body', weapon: 'iron_sword' }, { helm: 'party_hat_blue', body: 'silk_cloak', weapon: 'yew_bow', cape: 'cape_hitpoints' }, { helm: 'necro_hood', body: 'necro_robe', shield: 'soul_lantern', weapon: 'mithril_dagger' }, { helm: 'dragon_helm', body: 'dragon_body', weapon: 'dragon_spear' }, { helm: 'godly_helm', body: 'godly_body', legs: 'godly_legs' }, { body: 'ruined_body' }].map((gr, i) => ({ look: lookWith(gr, i === 1 ? { girl: true, woman: true } : null), e: ent(FACES[i % 4], { moving: i % 2 === 1, walkT: i }) }));
        clearPics(); time = 50;
        const frame = () => { for (const k of looks) draw(ctx, k.e, k.look, { cache: true }); };
        const w0 = STATS.wpics; frame(); const n1 = STATS.pics, w1 = STATS.wpics; frame(); const n2 = STATS.pics, w2 = STATS.wpics;
        const madeFirst = PICS.size;
        DPR = 1.5; clearPics(); frame();
        const sizes = [...PICS.values()].map(p => [p.c.width, p.w, p.ss]);
        DPR = dpr0;
        // at rest the weapon is in the picture (one blit a knight): no weapon pictures were needed
        check(P0 + 'six other knights drawn twice: the first frame makes their pictures (weapon and all, at rest), the second makes none; at a 1.5 screen the pictures are made at 1.5', madeFirst === 6 && n2 === n1 && w2 === w1 && w1 === w0 && sizes.length === 6 && sizes.every(([cw, w, ss]) => ss === 1.5 && cw === Math.ceil(w * 1.5) && w > 20 && w < 90), { madeFirst, again: n2 - n1, wagain: w2 - w1, w1, sizes }); }

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

      // what the hooks put at the player's place in the draw list (as 09-render: every HOOKS.draw handler, then the
      // player's own entry), and which of those items paint: their ops, in one recorder
      const atPlayer = () => {
        const items = [], hk = recorder();
        for (const fn of HOOKS.draw) fn(hk.g, items, cam);
        items.push({ y: player.y + player.r, draw: () => drawCharacter(hk.g, player, 'player') });
        const band = items.filter(it => it.y >= player.y + player.r - 0.02 && it.y <= player.y + player.r + 0.6);
        let painting = 0; const n0 = hk.ops.length;
        for (const it of band) { const a = hk.ops.length; it.draw(); if (hk.ops.slice(a).some(o => o.startsWith('@fill') || o.startsWith('stroke'))) painting++; }
        return { painting, ops: hk.ops.slice(n0) };
      };
      const keep = () => { const s0 = { equip: Object.assign({}, player.equip), action: player.action, x: player.x, y: player.y, facing: player.facing, mech: player.mech, dead: player.dead, attackT: player.attackT };
        return () => { for (const k in player.equip) if (!(k in s0.equip)) delete player.equip[k]; Object.assign(player.equip, s0.equip); Object.assign(player, { action: s0.action, x: s0.x, y: s0.y, facing: s0.facing, mech: s0.mech, dead: s0.dead, attackT: s0.attackT }); recomputeMaxHp(); }; };

      // 12. one knight at the player's place: the old trailing cape (38-agility), the godly helm's old gold wings
      // (27-dragons) and the loose pick or axe of the obsidian, mithril, jungle and royal-mine work are not drawn over
      // the knight; for that work the knight holds the tool himself (one tool, two hands)
      { const back = keep(), bad = [], picks0 = countItem('steel_pickaxe');
        try {
          const o = h.openSpot(ATLAS.world.tx(40), ATLAS.world.ty(20)); F.tp(o.x, o.y); player.y += 0.37; player.mech = null; player.dead = false; player.facing = { x: 0, y: 1 }; player.attackT = 0;
          const hand = shade(ITEMS.iron_body.color, -0.15);
          const cases = [['cape_melee', { cape: 'cape_melee' }], ['godly_helm', { helm: 'godly_helm' }], ['mine_obsidian', null, 'pickaxe'], ['mine_mithril', null, 'pickaxe'], ['chop_jungle', null, 'axe'], ['rm_giant', null, 'pickaxe'], ['rm_vein', null, 'pickaxe'], ['coalface', null, 'pickaxe', true]];
          for (const [name, eq, tool, noTier] of cases) {
            Object.assign(player.equip, { helm: null, cape: null, body: 'iron_body', shield: null }, eq || {});
            // 53-coalmine's coal face carries no tier: the pick is tinted by the best pickaxe he has (a steel one here: tier 2)
            if (noTier) h.give('steel_pickaxe', 1);
            player.action = tool ? Object.assign({ type: name, t: 0, need: 9, tx: o.x, ty: o.y + 1 }, noTier ? {} : { tier: 2 }) : null;
            const r = atPlayer(), n = c => r.ops.filter(x => x === '@fill ' + c).length;
            const lk = playerLook();
            const tint = !noTier || (hasTool('pickaxe') >= 2 && lk.toolColor === '#a9adb5');
            const ok = r.painting === 1 && (!tool || (lk.tool === tool && n('#8a6a3a') === 1 && n(hand) === 2 && !lk.weapon && tint));
            if (!ok) bad.push({ name, painting: r.painting, tool: lk.tool, color: lk.toolColor, hafts: n('#8a6a3a'), hands: n(hand) });
          }
        } finally { back(); const extra = countItem('steel_pickaxe') - picks0; if (extra > 0) removeItem('steel_pickaxe', extra); }
        check(P0 + 'one knight at the player\'s place: in a skill cape, in the winged helm, mining obsidian or mithril, chopping jungle, in the royal mine and at the coal face nothing else is drawn over him, and at that work he holds the tool himself (one tool, two hands; at the coal face tinted by his best pickaxe)', !bad.length, { bad }); }

      // 13. blocking: the knight raises his own shield (its own shape and colours, once), in front of him facing down or
      // side-on and behind his body facing away; 47-outliers' plain shield is not drawn; every shield and the lantern
      // can be raised at every facing
      { const sc = ITEMS.steel_shield.color, res = {}, threw = [];
        const look = lookWith({ shield: 'steel_shield', weapon: 'iron_sword', body: 'iron_body' }, { block: true });
        for (const [nm, f] of [['down', FACES[0]], ['side', FACES[1]], ['up', FACES[2]]]) {
          const rec = recorder(); draw(rec.g, ent(f), look, { t: 0.5 });
          const fills = rec.ops.filter(o => o.startsWith('@fill ')).map(o => o.slice(6));
          const sh = fills.map((x, i) => x.startsWith('grad(') && x.includes(sc) ? i : -1).filter(i => i >= 0);
          res[nm] = { shields: sh.length, at: sh[0], torso: fills.indexOf('#3b6fb6'), head: fills.lastIndexOf('#e8b790'), plain: fills.filter(x => x === sc).length };
        }
        for (const id in ITEMS) if (slotOf(ITEMS[id]) === 'shield') for (const f of FACES) { try { draw(recorder().g, ent(f), lookWith({ shield: id }, { block: true }), { t: 0.5 }); } catch (err) { threw.push(id + ': ' + (err && err.message)); } }
        // the real thing: R raised on the player, through the hooks and drawCharacter
        const back = keep(), O = window.OUTLIERS; let real = null;
        try {
          if (O && O.BLOCK) {
            const t0 = O.BLOCK.t; Object.assign(player.equip, { shield: 'steel_shield', body: null, cape: null, helm: null }); player.action = null; player.mech = null; player.dead = false; player.facing = { x: 0, y: 1 };
            O.BLOCK.t = 0.5;
            try { const r = atPlayer(); real = { painting: r.painting, shields: r.ops.filter(x => x.startsWith('@fill grad(') && x.includes(sc)).length, plain: r.ops.filter(x => x === '@fill ' + sc).length, block: playerLook().block === true }; }
            finally { O.BLOCK.t = t0; }
          }
        } finally { back(); }
        const d = res.down, sd = res.side, u = res.up;
        const ok = d.shields === 1 && d.at > d.torso && d.at > d.head && sd.shields === 1 && sd.at > sd.torso && u.shields === 1 && u.at < u.torso && d.plain + sd.plain + u.plain === 0
          && !threw.length && !!real && real.painting === 1 && real.shields === 1 && real.plain === 0 && real.block;
        check(P0 + 'blocking raises the knight\'s own shield once, in front of him facing down (after his head) or side-on and behind his body facing away; the old plain shield is not drawn; every shield and the lantern can be raised at every facing', ok, { res, real, threw: threw.slice(0, 4) }); }

      // 14. a girl's greaves show under her skirt: wearing each leg item, nothing drawn after her legs reaches below y 9.6
      // over the greaves (x 1.2 to 6.6 a side; the greave reaches 11.1 and its mark is at about 9 to 10.5), and no two
      // leg items draw alike on her
      { const ids = Object.keys(ITEMS).filter(id => slotOf(ITEMS[id]) === 'legs'), sigs = new Map(), same = [], covered = [];
        for (const id of ids) {
          const rec = recorder(); draw(rec.g, ent(FACES[0]), lookWith({ legs: id }, { girl: true, woman: true }), { t: 0.5 });
          const k = rec.shape(); if (sigs.has(k)) same.push(sigs.get(k) + ' = ' + id); else sigs.set(k, id);
          const at = rec.ops.findIndex(o => o.startsWith('fillRect 1.0 10.3 5.8 0.9'));
          const over = at < 0 ? [['no legs']] : ptsAfter(rec.ops, at).filter(([x, y, r]) => Math.abs(x) + r > 1.2 && Math.abs(x) - r < 6.6 && y + r > 9.6);
          if (over.length) covered.push(id + ' ' + JSON.stringify(over[0].map(n => typeof n === 'number' ? +n.toFixed(2) : n)));
        }
        check(P0 + 'a girl\'s greaves show under her skirt: for each of the ' + ids.length + ' leg items nothing drawn after her legs reaches below y 9.6 over them, and no two draw alike on her', ids.length >= 9 && !covered.length && !same.length, { covered: covered.slice(0, 5), same }); }

      // 15. the crowd's pictures keep up with a crowd that turns: 50 knights in 50 different outfits walk a whole step
      // cycle (42 frames) at each of the 8 facings and then stand for a second; then, for 60 frames more, they turn
      // through all 8 facings again (a new one every 5 frames) and stand. Those 60 frames make (close to) no new picture:
      // the cache holds every knight's 20 walking pictures and his standing ones (34 a knight, 1700 for the 50)
      { clearPics(); crowdN = 0; crowdHi = 0; picCap = PIC_MIN;
        const by = {}; for (const id in ITEMS) { const s = slotOf(ITEMS[id]); if (s) (by[s] = by[s] || []).push(id); }
        const D8 = [...Array(8)].map((_, k) => ({ x: Math.cos(k * Math.PI / 4), y: Math.sin(k * Math.PI / 4) }));
        const crowd = [];
        for (let i = 0; i < 50; i++) { const gr = {}; SLOTS.forEach((sl, j) => { const L = by[sl]; gr[sl] = L[(i * (j + 3) + j * 7) % L.length]; }); crowd.push({ look: lookWith(gr, i % 2 ? { girl: true, woman: true } : null), e: ent(D8[i % 8], { moving: true, walkT: i }) }); }
        const outfits = new Set(crowd.map(k => gearKey(partsOf(k.look)) + (k.look.girl ? 'g' : ''))).size;
        time = 200;
        const frame = () => { newFrame(); time += 1 / 60; for (const k of crowd) { if (k.e.moving) k.e.walkT += 9 / 60; draw(ctx, k.e, k.look, { cache: true }); } };
        const set = (moving, dir) => crowd.forEach((k, i) => { k.e.moving = moving; k.e.facing = D8[(i + dir) % 8]; });
        for (let d = 0; d < 8; d++) { set(true, d); for (let f = 0; f < 42; f++) frame(); }
        set(false, 7); for (let f = 0; f < 60; f++) frame();
        const warm = STATS.pics, p0 = STATS.pics;
        for (let f = 0; f < 60; f++) { if (f < 40) set(true, Math.floor(f / 5)); else set(false, 7); frame(); }
        const made = STATS.pics - p0, cap = picCap, size = PICS.size;
        clearPics(); crowdN = 0; crowdHi = 0; picCap = PIC_MIN;
        check(P0 + 'a crowd of 50 knights in ' + outfits + ' outfits that walk at all 8 facings and stand: once warm, 60 frames of turning through every facing and standing make (close to) no new picture (made ' + made + ' of ' + size + ' kept; the cache grew to ' + cap + ')', outfits >= 45 && made <= 5 && PIC_EACH >= 26 && cap >= 50 * 26 && size >= 50 * 20, { made, cap, size, warm, outfits }); }

      // 16. hurt, the whole knight flashes red: a knight in full Mithril (closed helm, plate, greaves, shield, sword),
      // facing down, side-on and away, sets no colour hurt that he sets calm (fills, strokes and gradient stops alike), and
      // every one is nearer #ff6b6b; the drawing itself is the same. Another knight online who is hurt makes no picture.
      { const look = lookWith({ helm: 'mithril_helm', body: 'mithril_body', legs: 'mithril_legs', shield: 'mithril_shield', weapon: 'mithril_sword' });
        const rgbOf = c => { let m = /^#([0-9a-f]{6})$/i.exec(c); if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; } if ((m = /^#([0-9a-f]{3})$/i.exec(c))) return [...m[1]].map(d => parseInt(d + d, 16)); m = /^rgba?\(([\d.]+),([\d.]+),([\d.]+)/.exec(String(c).replace(/\s/g, '')); return m ? [+m[1], +m[2], +m[3]] : null; };
        const toRed = c => { const q = rgbOf(c); return q ? Math.hypot(q[0] - 255, q[1] - 107, q[2] - 107) : null; };
        const colours = rec => { const out = []; for (const o of rec.ops) { if (o.startsWith('#fs ') || o.startsWith('#ss ')) { const v = o.slice(4); if (v.startsWith('grad(')) out.push(...v.slice(5, -1).split(/,(?![^(]*\))/)); else out.push(v); } } return out; };
        const bad = [];
        let n = 0;
        for (const f of [FACES[0], FACES[1], FACES[2]]) {
          const c = recorder(), h2 = recorder();
          draw(c.g, ent(f), look, { t: 0.5 }); draw(h2.g, ent(f, { hurtT: 0.2 }), look, { t: 0.5 });
          const a = colours(c), b = colours(h2), calm = new Set(a);
          if (c.shape() !== h2.shape() || a.length !== b.length) { bad.push({ f, shape: c.shape() === h2.shape(), n: [a.length, b.length] }); continue; }
          for (let i = 0; i < a.length; i++) {
            const d0 = toRed(a[i]), d1 = toRed(b[i]); n++;
            if (calm.has(b[i]) || d0 === null || d1 === null || !(d1 < d0 || d0 < 1)) { bad.push({ f, calm: a[i], hurt: b[i] }); break; }
          }
        }
        const p0 = STATS.pics, h0 = STATS.hurtPics, l0 = STATS.live; clearPics();
        // twenty hurt friends in the same gear, standing: one picture, one red copy of it, nothing drawn live
        for (let k = 0; k < 20; k++) draw(ctx, ent(FACES[0], { hurtT: 0.2 }), look, { cache: true });
        const pic = STATS.pics - p0, red = STATS.hurtPics - h0, live = STATS.live - l0;
        check(P0 + 'hurt, the whole knight flashes: in full Mithril (closed helm and plate) facing down, side-on and away, every colour he sets (' + n + ') changes and moves toward red, none is a calm colour, the drawing is the same; twenty hurt knights online are each blitted from one picture and its one red copy, with nothing drawn live', !bad.length && n >= 150 && pic === 1 && red === 1 && live === 0, { bad: bad.slice(0, 4), n, pic, red, live }); }

      // 17. falling and getting up: the core's fall (09-render tips the knight over and fades him) and 79-deaths (which
      // wraps drawCharacter and drawHuman for monsters and people) still draw the knight in the new look. A real frame
      // (render) is drawn with the knight just fallen and hurt, fading, and back on his feet: each time the player is
      // drawn once, as the new knight (a knight look, the new drawing run once); every look without gear (townsfolk,
      // guards) still goes to the old drawing. A knight look marked unarmed (79-deaths: a fallen person's weapon leaves
      // his hand) is drawn without his weapon.
      { const back = keep(), hurt0 = player.hurtT, dT0 = player.deadT, seen = [], _dh = drawHuman, r = {};
        try {
          // beside a townsperson, so the frame has looks without gear in it too
          // (an open tile a step or two from her, so she is in the frame: on the bigger map the nearest open strip of grass
          // outside the town can be out of a 1000 x 700 view)
          const tp = NPCS.find(n => !n.ghost), ntx = tp ? Math.floor(tp.px / TILE) : 0, nty = tp ? Math.floor(tp.py / TILE) : 0;
          let o = null; if (tp) for (let r = 1; r <= 3 && !o; r++) for (let dy = -r; dy <= r && !o; dy++) for (let dx = -r; dx <= r && !o; dx++) { const x = ntx + dx, y = nty + dy; if (!SOLID.has(tileAt(x, y)) && !PUSH_THROUGH.has(tileAt(x, y)) && !collides(tc(x), tc(y), 13, 'player')) o = { x, y }; }
          if (!o) o = tp ? h.openSpot(ntx + 1, nty) : h.openSpot(ATLAS.world.tx(40), ATLAS.world.ty(20));
          F.tp(o.x, o.y); player.mech = null; player.action = null; player.attackT = 0; F.step([]);
          Object.assign(player.equip, { helm: 'iron_helm', body: 'iron_body', legs: 'iron_legs', shield: 'iron_shield', weapon: 'iron_sword' });
          drawHuman = function (g, e, l) { const a = STATS.live; try { return _dh(g, e, l); } finally { seen.push({ e, knight: !!(l && l.gear), live: STATS.live - a }); } };
          const frame = () => {
            seen.length = 0; render();
            const me = seen.filter(s => s.e === player);
            return { calls: me.length, knight: me.length > 0 && me.every(s => s.knight && s.live === 1), people: seen.filter(s => !s.knight).length, oldToNew: seen.filter(s => !s.knight && s.live !== 0).length };
          };
          player.dead = true; player.deadT = 0.3; player.hurtT = 0.3; r.fallen = frame();
          player.deadT = 1.4; player.hurtT = 0; r.fading = frame();
          player.dead = false; player.deadT = 0; player.facing = { x: 1, y: 0 }; r.up = frame();
        } finally { drawHuman = _dh; back(); player.hurtT = hurt0; player.deadT = dT0; }
        const _dw = drawWeapon; let swords = 0;
        try {
          drawWeapon = function (g, W, s) { swords++; return _dw(g, W, s); };
          const lk = lookWith({ body: 'iron_body', weapon: 'iron_sword' });
          draw(recorder().g, ent(FACES[0]), lk, { t: 0.5 }); r.armed = swords; swords = 0;
          draw(recorder().g, ent(FACES[0], { unarmed: true }), lk, { t: 0.5 }); r.unarmed = swords;
        } finally { drawWeapon = _dw; }
        const ok = k => r[k] && r[k].calls === 1 && r[k].knight && r[k].oldToNew === 0 && r[k].people >= 1;
        check(P0 + 'falling and getting up: in a real frame the knight just fallen (hurt), fading, and back on his feet is drawn once each time as the new knight; the townsfolk beside him (looks without gear) never reach the knight drawing; a fallen (unarmed) knight look drops his weapon', ok('fallen') && ok('fading') && ok('up') && r.armed === 1 && r.unarmed === 0, r); }

      // 18. a weapon's picture (another knight online swinging, or easing back after a swing) is cut to the weapon: for
      // every weapon in the game it holds the whole weapon, every path's points and the widest stroke's half (1.7 px)
      // round them, and at most 3 px more on any side; together they cover less than half the pixels of the old fixed
      // 68 x 38 box (a turned picture costs for every pixel it covers)
      { const bad = [], dpr = DPR; let area = 0, n = 0;
        try {
          DPR = 1; WPICS.clear();
          for (const id in ITEMS) {
            if (slotOf(ITEMS[id]) !== 'weapon') continue;
            const W = partsOf(lookWith({ weapon: id })).weapon;
            if (!W) { bad.push(id + ': no weapon'); continue; }
            const tr = tracker(); T = 0.2; drawWeapon(tr.g, W, -1); const b = tr.b;
            // easing back after a swing (a bow too: only a bow being drawn is drawn live)
            if (!weaponPic(recorder().g, W, -1)) { bad.push(id + ': no picture'); continue; }
            const ph = WANIMATED.has(W.id) ? Math.floor(time * 4) % PHASES : 0;
            const p = lruGet(WPICS, keyOf(W) + '|' + ph + '|' + picScale()); if (!p) { bad.push(id + ': not kept'); continue; }
            n++; area += p.w * p.h;
            const holds = p.x0 <= b.l - 1.7 && p.y0 <= b.t - 1.7 && p.x0 + p.w >= b.r + 1.7 && p.y0 + p.h >= b.b + 1.7;
            const tight = p.x0 >= b.l - 4.7 && p.y0 >= b.t - 4.7 && p.x0 + p.w <= b.r + 4.7 && p.y0 + p.h <= b.b + 4.7;
            if (!holds || !tight) bad.push({ id, pic: [p.x0, p.y0, p.w, p.h], bounds: [b.l, b.t, b.r, b.b].map(v => +v.toFixed(1)) });
          }
        } finally { DPR = dpr; WPICS.clear(); T = 0; }
        check(P0 + 'a weapon\'s turned picture holds the whole weapon and little more: all ' + n + ' weapons, and together less than half the pixels of the old fixed box', !bad.length && n >= 25 && area < 0.5 * n * 68 * 38, { bad: bad.slice(0, 5), n, area, old: n * 68 * 38 }); }
      // 19. a picture is the live knight. Every other knight online is drawn from pictures (drawCached), so here the
      // pictures are made as recorders (PICTEST) and put down on a recorder, and set beside the live drawing. Four outfits
      // (two boys alike but for their gear, two girls, two tunics, a skill cape, a shield and the lantern, an upright sword,
      // a spear, the bow and a dagger) at all 8 facings: standing at two times of the clock, at the four poses of a walk,
      // and mid-swing, one after another with the pictures kept, as in a crowd, so a picture handed to the wrong knight
      // shows; then two of them standing again on a screen of ratio 1.
      // (a) a picture at rest paints exactly what the live knight paints at the picture's own facing, step and clock
      // (colours, legs and all), at the screen's ratio, and is put down where it was painted, at its own size; (b) a facing
      // to his left (3, 4, 5) is put down inside a scale(-1, 1) and no other is; (c) he holds one weapon, in his picture at
      // rest and outside it mid-swing; facing away his weapon, its hand, the shield or lantern and the other hand are
      // painted before his torso, standing, walking or mid-swing; facing us or side-on the weapon and its hand after it;
      // (d) two knights alike but for the tunic, the skin, the hair, boy or girl, or the ribbon get a picture each (the
      // same knight twice gets one).
      { const _t = drawTorso, _w = drawWeapon, _a = drawWeaponArm, _s = drawShield, _o = drawOffHand;
        const crowd0 = [crowdN, crowdHi, picCap], dpr = DPR, pics = [];
        const r = { cases: 0, rest: 0, same: 0, bad: [], flips: [], order: [], own: {}, twice: 0 };
        try {
          // a mark in a recorder where each part begins (a measuring tracker and a real canvas have no such method)
          const mk = (g, m) => { if (typeof g[m] === 'function') g[m](); };
          drawTorso = function (g, B, back) { mk(g, 'MKtorso'); return _t(g, B, back); };
          drawWeapon = function (g, W, sw) { mk(g, 'MKweapon'); return _w(g, W, sw); };
          drawWeaponArm = function (g, B, hx, hy) { mk(g, 'MKarm'); return _a(g, B, hx, hy); };
          drawShield = function (g, S, back, at) { mk(g, 'MKshield'); return _s(g, S, back, at); };
          drawOffHand = function (g, B, step) { mk(g, 'MKoff'); return _o(g, B, step); };
          PICTEST = (w, hh, ss) => { const rc = recorder(), c = { width: Math.ceil(w * ss), height: Math.ceil(hh * ss) }; pics.push({ c, rc, w, h: hh, ss }); return { c, cg: rc.g }; };
          clearPics(); DPR = 2;
          const looks = [
            lookWith({ helm: 'iron_helm', body: 'iron_body', legs: 'iron_legs', shield: 'iron_shield', weapon: 'iron_sword' }),
            lookWith({ body: 'silk_cloak', legs: 'iron_legs', shield: 'soul_lantern', cape: 'cape_hitpoints', weapon: 'dragon_spear' }, { girl: true, woman: true, tunic: '#8a3b3b', hair: '#c9a050', ribbon: '#3bb08a' }),
            lookWith({ helm: 'mithril_helm', body: 'mithril_body', shield: 'iron_shield', cape: 'cape_melee', weapon: 'yew_bow' }),
            lookWith({ helm: 'iron_helm', body: 'necro_robe', legs: 'mithril_legs', shield: 'soul_lantern', weapon: 'mithril_dagger' }, { girl: true, woman: true }),
          ];
          const D8 = [...Array(8)].map((_, k) => ({ x: Math.cos(k * Math.PI / 4), y: Math.sin(k * Math.PI / 4) }));
          // the picture's ops after its own setup (scale to the screen ratio, translate to its corner) laid in where it is put down
          const flat = (ops, out) => { for (const o of ops) { if (o.startsWith('IMG ')) { const p = pics[+o.slice(4)]; out.push('['); if (p) flat(p.rc.ops.slice(2), out); else out.push('IMG?'); out.push(']'); } else out.push(o); } return out; };
          const signs = ops => { const st = [], out = []; let sg = 1; for (const o of ops) { const k = o.split(' '); if (k[0] === 'save') st.push(sg); else if (k[0] === 'restore') sg = st.length ? st.pop() : 1; else if (k[0] === 'scale') sg *= Math.sign(+k[1]) || 1; else if (k[0] === 'IMG') out.push(sg); } return out; };
          const f1 = n => n.toFixed(1);
          // mode: -1 standing, 0..7 a step of the walk, 's' mid-swing; clock: the game's time
          const one = (li, dir, mode, clock) => {
            const look = looks[li], P = partsOf(look), swing = mode === 's', moving = !swing && mode >= 0, walkT = moving ? (mode + 0.5) / STEPS * TWO_PI : 0;
            time = clock;
            const b0 = STATS.blits, put = [], o = recorder();
            o.g.drawImage = (img, x, y, w, h) => { const k = pics.findIndex(p => p.c === img); put.push({ p: pics[k], x, y, w, h }); o.ops.push('IMG ' + k); };
            draw(o.g, ent(D8[dir], { moving, walkT, attackT: swing ? 0.11 : 0 }), look, { cache: true, t: 0.2 });
            r.cases++;
            const tag = li + '/' + dir + '/' + mode + '@' + clock + 'x' + DPR, body = put.map(q => q.p).find(p => p && p.rc.ops.includes('MKtorso '));
            if (STATS.blits !== b0 + 1 || !body) { r.bad.push(tag + ': no picture'); return; }
            // (a) each picture painted from its corner and put down at that corner at its own size; the body at the screen's ratio
            const off = put.find(q => !q.p || q.p.rc.ops[0] !== 'scale ' + f1(q.p.ss) + ' ' + f1(q.p.ss) || q.p.rc.ops[1] !== 'translate ' + f1(-q.x) + ' ' + f1(-q.y) || Math.abs(q.w - q.p.w) > 1e-6 || Math.abs(q.h - q.p.h) > 1e-6);
            if (body.ss !== picScale() || off) r.bad.push({ tag, ss: body.ss, off: off && [off.x, off.y, off.w, off.h, off.p && off.p.rc.ops.slice(0, 2), off.p && [off.p.w, off.p.h]] });
            // (b)
            const flip = dir >= 3 && dir <= 5, sg = signs(o.ops);
            if (!sg.length || sg.some(v => v !== (flip ? -1 : 1))) r.flips.push(tag + ': ' + sg.join());
            // (c)
            const all = flat(o.ops, []), at = m => all.reduce((a, s, i) => (s === m + ' ' ? a.concat(i) : a), []);
            const torso = at('MKtorso'), wpn = at('MKweapon'), arm = at('MKarm'), sh = at('MKshield'), oh = at('MKoff');
            const back = dir >= 5 && dir <= 7, inPic = body.rc.ops.includes('MKweapon ');
            const okOrder = torso.length === 1 && wpn.length === 1 && arm.length === 1 && inPic === !swing && (back ? [wpn, arm, sh, oh].every(x => x.length >= 1 && x.every(i => i < torso[0])) : wpn[0] > torso[0] && arm[0] > torso[0]);
            if (!okOrder) r.order.push({ tag, torso, wpn, arm, sh, oh, inPic });
            // (a) at rest, against the live knight at the picture's own facing, step and clock
            if (swing) return;
            r.rest++;
            const pdir = flip ? (12 - dir) % 8 : dir, s8 = moving ? mode : -1, sb = s8 < 0 ? -1 : s8 < 4 ? Math.min(s8, 3 - s8) : 4 + Math.min(s8 - 4, 7 - s8);
            const ph = !moving && (animatedBody(P) || WANIMATED.has(P.weapon.id)) ? Math.floor(clock * 4) % PHASES : 0;
            const wt = moving ? (sb + 0.5) / STEPS * TWO_PI : 0, tPic = moving ? sb * 0.29 : ph * 0.37 + 0.2;
            const lv = recorder();
            draw(lv.g, { facing: { x: Math.cos(pdir * Math.PI / 4), y: Math.sin(pdir * Math.PI / 4) }, moving, walkT: wt, attackT: 0, hurtT: 0 }, look, { t: tPic });
            const a = body.rc.ops.slice(2), b = lv.ops.slice(1, -1);
            if (a.join(';') === b.join(';')) r.same++;
            else { let i = 0; while (i < a.length && a[i] === b[i]) i++; r.bad.push({ tag, at: i, pic: a.slice(i, i + 3), live: b.slice(i, i + 3), n: [a.length, b.length] }); }
          };
          for (let li = 0; li < looks.length; li++) for (let dir = 0; dir < 8; dir++) {
            one(li, dir, -1, 0.05); one(li, dir, -1, 0.55);
            for (const mode of [0, 1, 4, 5]) one(li, dir, mode, 0.05);
            one(li, dir, 's', 0.05);
          }
          DPR = 1;
          for (const li of [0, 1]) for (let dir = 0; dir < 8; dir++) one(li, dir, -1, 0.05);
          DPR = 2;
          // (d)
          const base = lookWith({ helm: 'iron_helm', body: 'iron_body', weapon: 'iron_sword' }, { girl: true, woman: true, ribbon: '#d0567f' });
          const two = (l1, l2) => { clearPics(); const p0 = STATS.pics; draw(recorder().g, ent(D8[2]), l1, { cache: true, t: 0.2 }); draw(recorder().g, ent(D8[2]), l2, { cache: true, t: 0.2 }); return STATS.pics - p0; };
          const vary = { tunic: { tunic: '#8a3b3b' }, skin: { skin: '#a8754f' }, hair: { hair: '#d8c07a' }, boy: { girl: false, woman: false }, ribbon: { ribbon: '#3bb08a' } };
          for (const k in vary) r.own[k] = two(base, Object.assign({}, base, vary[k]));
          r.twice = two(base, Object.assign({}, base));
        } finally {
          drawTorso = _t; drawWeapon = _w; drawWeaponArm = _a; drawShield = _s; drawOffHand = _o;
          PICTEST = null; clearPics(); DPR = dpr; [crowdN, crowdHi, picCap] = crowd0;
        }
        const ownOk = Object.keys(r.own).length === 5 && Object.values(r.own).every(n => n === 2) && r.twice === 1;
        check(P0 + 'every other knight online is drawn from a picture, and the picture is the live knight: 4 outfits (boy and girl, two tunics, a skill cape, a shield and the lantern, a sword, a spear, the bow and a dagger) at all 8 facings, standing and walking, the pictures kept as in a crowd (' + r.rest + ' at rest), paint exactly what the live knight paints, colours and legs and all, at the screen\'s ratio, put down where they were painted; facing left the picture is flipped; he holds one weapon, in his picture at rest; facing away his weapon, hands and shield or lantern are behind his body, mid-swing too; a different tunic, skin, hair, ribbon or boy or girl gets its own picture', r.cases === 240 && r.rest === 208 && r.same === 208 && !r.bad.length && !r.flips.length && !r.order.length && ownOk, { cases: r.cases, rest: r.rest, same: r.same, bad: r.bad.slice(0, 3), flips: r.flips.slice(0, 4), order: r.order.slice(0, 3), own: r.own, twice: r.twice }); }

      // 20. blocking facing away, every shield shows: held out on his shield side and up, its outer edge reaches past his
      // shoulder plate (x -13.6) by 4 px or more and its top over the shoulders (y -6.2), so a small or round shield is
      // not hidden behind his back; the lantern is held out too
      { const bad = [];
        for (const id in ITEMS) {
          if (slotOf(ITEMS[id]) !== 'shield') continue;
          const P = partsOf(lookWith({ shield: id, body: 'iron_body' })), S = stance(ent(FACES[2]), false); S.bob = 0;
          const tr = tracker(); measuring(() => raisedShield(tr.g, S, P)); const b = tr.b;
          const ok = P.shield.fam === 'lantern' ? b.l <= -17.5 : b.l <= -17.5 && b.t <= -11;
          if (!ok) bad.push({ id, l: +b.l.toFixed(1), t: +b.t.toFixed(1) });
        }
        check(P0 + 'blocking facing away, every shield (and the lantern) is held out past his shoulder and up over it, so it shows: none is hidden behind his back', !bad.length, { bad: bad.slice(0, 6) }); }

      // 21. sitting IN the ferry (26-boats gives him a seatLine), nothing of him is drawn below the gunwale: a stave or a
      // spear, a robe's hem stay down in the boat, not over its planks. On the mare (no seatLine) nothing is cut.
      { const r = {}, q = quest.boats || (quest.boats = {}), s0 = q.sailing, w0 = q.where, _dh = drawHuman, lines = [];
        try {
          q.sailing = { to: 'gull', t: 0.5, from: 'dock', fx: player.x, fy: player.y }; q.where = 'dock';
          drawHuman = function (g, e, l) { if (l && l.gear) lines.push(e && e.seated ? e.seatLine : 'not seated'); return _dh(g, e, l); };
          if (HOOKS.panel.sailing) HOOKS.panel.sailing(recorder().g, false);
          r.ferry = lines.slice();
        } finally { drawHuman = _dh; q.sailing = s0; q.where = w0; }
        const look = lookWith({ body: 'necro_robe', weapon: 'bone_stave' });
        const cut = recorder(); draw(cut.g, ent(FACES[1], { seated: true, seatLine: 7.6 }), look, { t: 0.5 });
        const free = recorder(); draw(free.g, ent(FACES[1], { seated: true }), look, { t: 0.5 });
        const clipAt = rec => { const i = rec.ops.findIndex(o => o === 'clip '); return i > 0 ? rec.ops[i - 1] : null; };
        r.cut = clipAt(cut); r.free = free.ops.some(o => o.startsWith('rect -60.0 -80.0'));
        check(P0 + 'sitting in the ferry he is cut at the gunwale (nothing of him below it over the hull: a stave, a robe\'s hem); on the mare nothing is cut', r.ferry.length === 1 && r.ferry[0] === 7.6 && r.cut === 'rect -60.0 -80.0 120.0 87.6' && r.free === false, r); }

      // 22. what he holds still is in his hand (owner's decision 1): warming a stone in the royal mine he holds it (tinted
      // as it warms, nothing else drawn at his place: 91 no longer draws it loose); at the lobster pot he holds the
      // rope's end, and handAt is where his hand is drawn (26-boats starts the rope there)
      { const back = keep(), r = {};
        try {
          const o = h.openSpot(ATLAS.world.tx(40), ATLAS.world.ty(20)); F.tp(o.x, o.y); player.y += 0.37; player.mech = null; player.dead = false; player.facing = { x: 1, y: 0 }; player.attackT = 0;
          Object.assign(player.equip, { body: 'iron_body', shield: 'iron_shield', weapon: 'iron_sword', helm: null, cape: null });
          const hand = shade(ITEMS.iron_body.color, -0.15);
          for (const [type, tool] of [['rm_warm', 'stone'], ['rm_heat', 'stone'], ['lobster', 'rope']]) {
            player.action = { type, t: 1, need: 2, tx: o.x + 1, ty: o.y };
            const lk = playerLook(), at = atPlayer(), n = c => at.ops.filter(x => x === '@fill ' + c).length;
            r[type] = { tool: lk.tool, still: lk.toolSwing === false, weapon: !!lk.weapon, painting: at.painting, hands: n(hand), hafts: n('#8a6a3a'), stone: tool === 'stone' ? n(lk.toolColor) : null };
          }
          player.action = null;
          // the hand: at rest facing right and left, drawn where handAt says
          const hands = [];
          for (const f of [{ x: 1, y: 0 }, { x: -1, y: 0 }]) {
            player.facing = f; const e = ent(f), rec = recorder(); draw(rec.g, e, lookWith({ weapon: 'iron_sword' }), { t: 0 });
            const hp = handAt(e); hands.push(hp && [+hp.x.toFixed(1), +hp.y.toFixed(1)]);
          }
          r.hands = hands;
          r.handOk = !!hands[0] && !!hands[1] && Math.abs(hands[0][0] - REST_HAND.up.x * 1.08) < 0.3 && Math.abs(hands[0][1] - REST_HAND.up.y * 1.08) < 0.3 && Math.abs(hands[1][0] + hands[0][0]) < 0.01;
        } finally { back(); }
        const held = k => r[k] && r[k].still && !r[k].weapon && r[k].painting === 1 && r[k].hands === 2 && r[k].hafts === 0;
        check(P0 + 'what he holds still is in his hand: warming a stone in the royal mine (both ways in) he holds it, coloured as it warms, and nothing loose is drawn at his place; at the lobster pot he holds the rope\'s end; handAt is where his hand is drawn', held('rm_warm') && held('rm_heat') && held('lobster') && r.rm_warm.tool === 'stone' && r.rm_warm.stone >= 1 && r.lobster.tool === 'rope' && r.handOk, r); }

      // 23. the bank's knight card (60-bank) fits the taller knight: in a party hat with a dragon spear (taller than the
      // old knight) the card asks fit() for what he wears, and all of him, his shadow too, is inside the card
      { const back = keep(), K = window.KNIGHTGEAR, calls = [], _fit = K.fit; let r = null;
        try {
          Object.assign(player.equip, { helm: 'party_hat_red', body: 'dragon_body', weapon: 'dragon_spear', shield: null, cape: null });
          K.fit = function (look, w, hh, foot, maxS) { const f = _fit(look, w, hh, foot, maxS); calls.push({ look, w, h: hh, foot, f }); return f; };
          openPanel('bank'); render();
          const c = calls.find(q => q.look && q.look.gear && q.look.gear.weapon === 'dragon_spear' && q.look.gear.helm === 'party_hat_red');
          if (c) { const x = extent(c.look), f = c.f; r = { top: +(f.y + x.t * f.s).toFixed(1), bottom: +(f.y + Math.max(x.b, c.foot) * f.s).toFixed(1), left: +(f.x + Math.min(x.l, -12) * f.s).toFixed(1), right: +(f.x + Math.max(x.r, 12) * f.s).toFixed(1), w: c.w, h: c.h, tall: x.t }; }
        } finally { K.fit = _fit; closePanel(); back(); }
        check(P0 + 'the bank\'s knight card fits the taller knight (a party hat and an upright dragon spear): all of him and his shadow are inside the card', !!r && r.tall < -36 && r.top >= -0.01 && r.left >= -0.01 && r.bottom <= r.h + 0.01 && r.right <= r.w + 0.01, r); }
    } finally { time = time0; DPR = dpr0; T = 0; }
  });

  return { draw, partsOf, gearKey, cleanGear, extent, fit, handAt, poseOf: e => POSE.get(e), STATS, PICS, WPICS, clearPics, picCap: () => picCap, KG, SLOTS, REST_HAND, SHOULDER, REACH };
})();
window.KNIGHTGEAR = KNIGHTGEAR;
