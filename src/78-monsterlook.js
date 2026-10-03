// ============================================================================
// MONSTER LOOK — every monster in the game drawn in the owner-approved new look (78-monsterart.js holds the drawings).
// Where: drawCharacter is wrapped, so every place the game draws a monster gets it at once: the world, dungeons and
// instances, online puppets (75-coop), dying and falling bodies (79-deaths draws them through drawCharacter, and its
// own wrapper sits on top of this one: this file loads before it on purpose), the book's portraits (44-wiki) and the
// admin panel's (76-admin). The Ginormous Golem in his mine is drawn by 91-royalmine's own pass through
// ROYALMINE.drawColossus, which this file replaces. Anything that is not a monster type (the knight, his machine, a
// parked or wrecked machine, the townsfolk) goes straight on to the old drawing, untouched.
// What a drawing reads: only what a puppet built from the 'mon' snapshot row also has (docs/ONLINE.md; the shared
// world's spec): type, facing, moving, hurt, attackT, stunT, state, hp / maxHp, and `phase` where a boss uses one. The
// walk's clock, a swing's progress and the moment a state began are kept HERE, per monster, from what is drawn (a
// puppet's walkT never moves and its attackT only changes when a row lands). Where a look needs more than the row
// gives, one field per type carries it (LOOK_FIELDS below, and window.MONSTER_LOOK.LOOK_FIELDS): read off the local
// monster when the game set it, from `phase` when a row brought it, and a plain look when neither is there.
// States: what the approved drawings cannot show by themselves is shown with their own moves (a giant ore's waking
// eyes are its swing, the Ginormous Golem's wind-up and slam are his, a charging dozer rolls) or a small layer drawn
// over them in the same hand (cracks, a humming lightning rod, shut eyes, the z's of a sleeper).
// Cost: the small and common monsters are pictures, made once per type, facing, step, swing frame and pixel ratio and
// kept in a byte-budgeted cache (as 82-knightgear does for the crowd of knights); the big rare ones are drawn live.
// Sizes: a hit circle (MONSTER_DEFS r) was grown in its own file where the new look is bigger and the ground allows it;
// HIT_R below is that table, and the self-test proves every r and every spawn's footing.
// window.MONSTER_LOOK is the test handle.
// ============================================================================
const MONSTER_LOOK = (() => {
  const ART = MONSTER_ART, NEW = ART.NEW_DRAW, SIZE = ART.MOB_SIZE, H = ART.H;
  const TWO_PI = Math.PI * 2;
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  // seconds a type's attackT counts down from when it strikes (the core's melee and throw set 0.2; these set their own)
  const ATTACK_T = { green_dragon: 0.3, red_dragon: 0.3, the_fang: 0.25, ally_knight: 0.22 };
  const ELEMENTS = ['fire', 'ice', 'storm', 'stone'];
  // the extra state each type's look reads, beyond the row's 14 columns: the field, its values, what it means, and where
  // the game sets it today. A puppet gets it from the row's optional `phase` column (the shared world adds it in phase 1);
  // `state` is already a column.
  const LOOK_FIELDS = {
    thunderbird: { field: 'phase', values: ['hunt', 'high', 'perch'], means: 'where the storm bird is: hunting low, lifted into the cloud (pale, no sword reaches it), or perched on a mast (wings folded, crackling: hit it now)', setBy: '66-storm (m.phase)' },
    the_fang: { field: 'element', values: ELEMENTS, means: 'the element the Fang is in: its colours, aura, motes, eyes and breath; a row brings it in `phase`', setBy: '28-thefang setElement (m.element, every 25 s)' },
    zombie_brute: { field: 'phase', values: ['wind', 'stagger'], means: 'hauling the headstone up for its slam (1.1 s), or dragging it back out of the ground after one (1.7 s); the pose plays out on the drawing\'s own clock from the moment the phase arrives', setBy: '54-graves bruteTick (m.windT > 0 is wind, m.stagT > 0 is stagger)' },
    cinderwight: { field: 'phase', values: ['feed', 'cold'], means: 'its heart is out on the ground and it drinks from it (a dark hole in its chest), or the heart was broken and it is cold (steel blue)', setBy: '46-cinderwight (m.heart alive is feed, m.coldT > 0 is cold)' },
    cinder_heart: { field: 'emberT', values: 'seconds since it was set down, 0 to 10', means: 'how far the ember has burned down (it dims)', setBy: '46-cinderwight kindle (m.emberT); without it the look counts from when the heart was first drawn' },
    barrelbeast: { field: 'phase', values: ['volley'], means: 'the lightning rod flaring before a volley of bolts (it brightens over 1.2 s); below 35% hp the rod hums anyway (from hp)', setBy: '20-hollowford (m.rodGlow, 0 to 1)' },
    gnasher: { field: 'phase', values: ['arm'], means: 'a piston arm sweeping across its front (0.35 s), drawn as its swing', setBy: '33-goblincity (m.armT > 0)' },
    bulldozer: { field: 'phase', values: ['charge'], means: 'charging: wheels rolling, though it is not walking', setBy: '22-bulldozer (m.chargeT > 0)' },
    yard_dozer: { field: 'phase', values: ['charge'], means: 'as the bulldozer', setBy: '22-bulldozer (m.chargeT > 0)' },
    ally_knight: { field: 'ally', values: ['hale', 'garrick'], means: 'which Dragon Killer it is (Sergeant Hale or Sir Garrick) and the name under him', setBy: '37-dragonkillers spawnAlly (m.ally, m.allyName); without it the look picks one from the monster\'s nid' },
    giant_mithril: { field: 'state', values: ['idle', 'stir', 'waking'], means: 'the golem inside the rock: asleep, stirring (it quivers, an eye opens), breaking out (it shakes, both eyes wide); hp cracks it and splits it (already row columns)', setBy: '91-royalmine' },
    giant_stormstone: { field: 'state', values: ['idle', 'stir', 'waking'], means: 'as the giant mithril ore', setBy: '91-royalmine' },
    golemling: { field: 'state', values: ['emerge'], means: 'climbing up out of the floor, shaking (already a row column)', setBy: '91-royalmine' },
    ginormous_golem: { field: 'state', values: ['sleep', 'rise', 'fight', 'windup', 'slam'], means: 'asleep (eyes shut, his furnace low, z\'s), standing up (0.9 s), fighting, fists up (1.2 s), fists down (0.5 s); hp cracks him and turns his eyes red at half (already row columns)', setBy: '91-royalmine' },
    zombie_calm: { field: 'state', values: ['chase'], means: 'a calm zombie roused into a fight wakes into the fighting zombie (already a row column)', setBy: 'the core (07-update) when it is hit' },
    grave_zombie_calm: { field: 'state', values: ['chase'], means: 'as the calm zombie', setBy: 'the core (07-update)' },
  };
  // each type's hit circle (MONSTER_DEFS r) as this file expects it; the eight grown ones changed in their own files
  const HIT_R = { spider: 7, goblin: 12, sapper: 12, brute: 18, walker: 24, wolf: 13, boar: 14, sheep: 12, cow: 17, guard_m: 13, guard_f: 13,
    giant_spider: 16, brood_mother: 34, barrelbeast: 36, bulldozer: 24, dwarf_guard: 12, elf_sentinel: 12, green_dragon: 26, red_dragon: 28, the_fang: 48,
    ash_drake: 22, castle_guard: 12, yard_walker: 24, yard_dozer: 24, gnasher: 36, zombie: 13, grave_zombie: 13, zombie_calm: 13, grave_zombie_calm: 13,
    vampire: 13, count_ashvane: 18, sky_sentinel: 12, ally_knight: 13, cinderwight: 22, cinder_heart: 10, grave_skeleton: 12, grave_risen: 13,
    zombie_brute: 44, thunderbird: 26, rimhawk: 14, dustjaw: 24, giant_mithril: 40, giant_stormstone: 62, mithril_golem: 26, stormstone_golem: 36,
    golemling: 12, ginormous_golem: 50 };
  const HIT_R_WAS = { brute: 15, walker: 22, cow: 15, brood_mother: 28, barrelbeast: 30, bulldozer: 22, the_fang: 40, yard_walker: 22, yard_dozer: 22,
    gnasher: 30, count_ashvane: 14, cinderwight: 20, dustjaw: 21 };
  const ON = { on: true, pics: true };
  const STATS = { live: 0, pics: 0, made: 0, hits: 0, held: 0, heldPaints: 0, wrapped: 0, passed: 0, colossus: 0, by: {} };
  const isMonsterKind = kind => typeof kind === 'string' && kind !== 'player' && kind !== 'playermech' && !!NEW[kind] && !!MONSTER_DEFS[kind];

  // ---------- what this file remembers of each monster it draws (never on the monster: it is saved and sent) ----------
  const MEM = new WeakMap();
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  // a monster's seed: the same on every screen (from its nid, which the keeper and every puppet share), else from home
  function seedOf(e, type) {
    if (typeof e.nid === 'string' && e.nid) return hashStr(type + ':' + e.nid) * TWO_PI;
    const h = e.home && Number.isFinite(e.home.x) ? e.home : e;
    return hashStr(type + ':' + Math.round(+h.x || 0) + ',' + Math.round(+h.y || 0)) * TWO_PI;
  }
  function memOf(e, type) {
    let s = MEM.get(e);
    if (!s || s.type !== type) {
      s = { type, t: time, walk: 0, sw0: -1e9, swDur: 0.2, prevAtk: 0, ph: null, phAt: time, st: e.state, stAt: time, born: time, seed: seedOf(e, type) };
      MEM.set(e, s);
    }
    return s;
  }

  // ---------- the view: the sample's `e`, built from what the monster (or a puppet's row) has ----------
  // the one extra field each type reads (LOOK_FIELDS): the local monster's own when the game set it, else the row's phase
  const fromPhase = (e, list) => list.includes(e.phase) ? e.phase : null;
  function stateField(e, type) {
    switch (type) {
      case 'zombie_brute': return e.windT > 0 ? 'wind' : e.stagT > 0 ? 'stagger' : (e.windT === undefined && e.stagT === undefined) ? fromPhase(e, ['wind', 'stagger']) : null;
      case 'cinderwight': return (e.coldT || 0) > 0 ? 'cold' : (e.heart && !e.heart.dead) ? 'feed' : (e.coldT === undefined && e.heart === undefined) ? fromPhase(e, ['feed', 'cold']) : null;
      case 'the_fang': return ELEMENTS.includes(e.element) ? e.element : ELEMENTS.includes(e.phase) ? e.phase : 'fire';
      case 'thunderbird': return e.phase === 'high' || e.phase === 'perch' ? e.phase : 'hunt';
      case 'barrelbeast': return (e.rodGlow || 0) > 0 ? 'volley' : e.rodGlow === undefined ? fromPhase(e, ['volley']) : null;
      case 'gnasher': return (e.armT || 0) > 0 ? 'arm' : e.armT === undefined ? fromPhase(e, ['arm']) : null;
      case 'bulldozer': case 'yard_dozer': return (e.chargeT || 0) > 0 ? 'charge' : e.chargeT === undefined ? fromPhase(e, ['charge']) : null;
      default: return null;
    }
  }
  function viewOf(e, type) {
    const s = memOf(e, type);
    const dt = Math.max(0, Math.min(0.25, time - s.t)); s.t = time;
    if (e.moving) s.walk = (s.walk + dt * 8) % (TWO_PI * 64);
    // a swing: started when attackT rose (a puppet's attackT only changes when a row lands, so the swing runs on this clock)
    const a = +e.attackT || 0;
    if (a > 0 && (s.prevAtk <= 0 || a > s.prevAtk + 1e-4)) { const dur = Math.max(a, ATTACK_T[type] || 0.2); s.swDur = dur; s.sw0 = time - (dur - a); }
    s.prevAtk = a;
    const p = (time - s.sw0) / s.swDur, swing = p >= 0 && p < 1 ? p : -1;
    // the moment a phase or a state began, for the poses that play out from it
    const ph = stateField(e, type);
    if (ph !== s.ph) { s.ph = ph; s.phAt = time; }
    const st = typeof e.state === 'string' ? e.state : 'idle';
    if (st !== s.st) { s.st = st; s.stAt = time; }
    let fx = e.facing ? +e.facing.x : 0, fy = e.facing ? +e.facing.y : 1;
    if (!Number.isFinite(fx)) fx = 0;
    if (!Number.isFinite(fy)) fy = 1;
    const L = Math.hypot(fx, fy);
    if (L < 1e-6) { fx = 0; fy = 1; } else { fx /= L; fy /= L; }
    const v = { type, facing: { x: fx, y: fy }, moving: !!e.moving, walkT: s.walk, attackT: swing >= 0 ? 0.22 * (1 - swing) : 0, hurtT: +e.hurtT || 0,
      seed: s.seed, state: st, stunT: +e.stunT || 0, hp: +e.hp, maxHp: +e.maxHp, unarmed: !!e.unarmed };
    const since = time - s.phAt;
    if (type === 'thunderbird') v.phase = ph;
    else if (type === 'the_fang') v.element = ph;
    else if (type === 'zombie_brute') {
      if (typeof e.windT === 'number' || typeof e.stagT === 'number') { v.windT = e.windT || 0; v.stagT = e.stagT || 0; }
      else if (ph === 'wind') v.windT = Math.max(0, 1.1 - since);
      else if (ph === 'stagger') v.stagT = Math.max(0, 1.7 - since);
    } else if (type === 'cinderwight') { if (ph === 'cold') v.coldT = 1; else if (ph === 'feed') v.heart = { dead: false }; }
    else if (type === 'cinder_heart') v.emberT = typeof e.emberT === 'number' ? e.emberT : Math.min(10, time - s.born);
    else if (type === 'ally_knight') v.ally = e.ally === 'hale' || e.ally === 'garrick' ? e.ally : (Math.floor(s.seed * 7) % 2 ? 'garrick' : 'hale');
    else if (type === 'barrelbeast') v.rodGlow = typeof e.rodGlow === 'number' ? clamp01(e.rodGlow) : ph === 'volley' ? clamp01(since / 1.2) : 0;
    else if (type === 'gnasher') {
      // the arm's sweep is the Gnasher's swing
      const arm = typeof e.armT === 'number' ? (e.armT > 0 ? 1 - e.armT / 0.35 : -1) : ph === 'arm' && since < 0.35 ? since / 0.35 : -1;
      if (arm >= 0) v.attackT = 0.22 * (1 - Math.min(0.999, arm));
    } else if (type === 'bulldozer' || type === 'yard_dozer') { if (ph === 'charge') v.moving = true; }
    else if (type === 'giant_mithril' || type === 'giant_stormstone') {
      // the golem inside: stirring, one look out (a blink now and then); waking, both eyes wide and the rock shaking. The
      // drawing's own 'waking' is its swing, so the state sets the swing that opens the eyes that far
      const w = st === 'waking' ? 1 : st === 'stir' ? (Math.sin(time * 2.3 + s.seed) > 0.94 ? 0.12 : 0.55) : 0;
      v.moving = w > 0; v.attackT = w > 0 ? 0.22 * (1 - Math.asin(Math.min(1, w)) / Math.PI) : 0;
    } else if (type === 'golemling' && st === 'emerge') v.moving = false;
    return v;
  }
  // which approved drawing a monster wears right now: a calm zombie roused into a fight wakes into the fighting one
  function lookType(type, e) {
    if ((type === 'zombie_calm' || type === 'grave_zombie_calm') && e.state === 'chase') return type === 'zombie_calm' ? 'zombie' : 'grave_zombie';
    return type;
  }

  // ---------- how big each look is ----------
  // the box each type is drawn in, around its middle, in game pixels: [x0, y0, x1, y1] at rest (standing, walking, every
  // facing and state) then the same with a swing (its swoosh, a jab, a breath), measured off MONSTER_ART in headless
  // Chromium at every 16th of a turn (~/.fanglands/work/monsterlook/measure/boxes.js), 3 px added all round
  const BOX = { goblin: [-25, -23, 25, 17, -35, -29, 35, 30], sapper: [-27, -23, 27, 17, -35, -29, 35, 30],
    brute: [-49, -43, 49, 26, -63, -53, 63, 55], spider: [-14, -14, 14, 14, -14, -14, 14, 14], giant_spider: [-26, -26, 26, 26, -26, -26, 26, 26],
    wolf: [-24, -19, 24, 18, -26, -19, 26, 18], boar: [-20, -14, 20, 17, -24, -14, 24, 17], grave_skeleton: [-28, -28, 28, 18, -43, -36, 43, 38],
    zombie: [-17, -23, 17, 19, -21, -23, 21, 19], ash_drake: [-76, -76, 76, 76, -95, -95, 95, 95], rimhawk: [-26, -40, 28, 33, -26, -40, 28, 33],
    green_dragon: [-87, -109, 87, 87, -110, -133, 110, 87], sheep: [-18, -16, 18, 17, -18, -16, 19, 17], cow: [-28, -20, 28, 25, -30, -20, 30, 25],
    guard_m: [-27, -42, 27, 20, -65, -57, 65, 59], guard_f: [-26, -40, 26, 20, -63, -56, 63, 58], dwarf_guard: [-39, -31, 39, 21, -48, -38, 48, 43],
    castle_guard: [-23, -37, 23, 18, -59, -52, 59, 54], elf_sentinel: [-21, -27, 21, 25, -42, -34, 42, 36],
    sky_sentinel: [-37, -45, 37, 21, -70, -61, 70, 64], vampire: [-18, -24, 18, 20, -39, -31, 39, 33],
    count_ashvane: [-45, -50, 45, 29, -71, -60, 72, 64], ally_knight: [-35, -45, 35, 21, -69, -61, 69, 63],
    zombie_calm: [-17, -25, 16, 19, -20, -25, 20, 19], grave_risen: [-17, -28, 17, 19, -20, -28, 20, 19],
    grave_zombie: [-20, -27, 20, 21, -24, -27, 24, 21], grave_zombie_calm: [-19, -31, 19, 21, -24, -31, 24, 21],
    zombie_brute: [-91, -88, 118, 87, -119, -109, 119, 87], cinderwight: [-36, -72, 36, 35, -47, -72, 47, 35],
    cinder_heart: [-25, -26, 25, 25, -25, -26, 25, 25], walker: [-57, -109, 57, 42, -90, -109, 90, 42],
    yard_walker: [-59, -109, 59, 42, -92, -109, 92, 42], bulldozer: [-71, -106, 69, 44, -87, -106, 87, 54],
    yard_dozer: [-71, -106, 69, 44, -87, -106, 87, 54], barrelbeast: [-79, -133, 79, 61, -101, -133, 101, 61],
    gnasher: [-77, -128, 77, 51, -77, -128, 106, 53], golemling: [-19, -55, 19, 31, -19, -61, 19, 31],
    mithril_golem: [-47, -51, 47, 39, -68, -51, 68, 42], stormstone_golem: [-63, -81, 63, 52, -92, -81, 92, 56],
    ginormous_golem: [-107, -113, 107, 87, -177, -114, 177, 105], giant_mithril: [-61, -67, 57, 44, -62, -67, 58, 44],
    giant_stormstone: [-77, -103, 76, 55, -79, -104, 77, 55], brood_mother: [-111, -111, 112, 111, -147, -146, 146, 147],
    thunderbird: [-101, -181, 112, 118, -133, -184, 133, 125], red_dragon: [-108, -134, 120, 124, -204, -228, 200, 176],
    dustjaw: [-59, -39, 59, 34, -62, -47, 62, 40], the_fang: [-172, -190, 182, 185, -263, -263, 263, 263], };
  const boxOf = (type, swinging) => { const b = BOX[type]; if (!b) return [-40, -50, 40, 40]; return swinging ? [b[4], b[5], b[6], b[7]] : [b[0], b[1], b[2], b[3]]; };
  // how far the drawing reaches from the middle (for the draw margin and a falling body's clip), and how high it stands
  const reach = type => { const b = BOX[type]; return b ? Math.max(-b[0], b[2], -b[1], b[3]) + 4 : 80; };
  const headroom = type => { const b = BOX[type]; return b ? -(b[1] + 3) : 26; };

  // ---------- states the drawings show through a small layer of their own, in the same hand ----------
  // drawn over the finished drawing, in its own units (inside MOB_SIZE), after undoing nothing: each layer redoes the
  // drawing's own placing (its left mirror, its lift, its bob) so it sits where the part it marks is
  const crackLine = (g, pts, w, glow, a) => {
    const path = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (glow) { path(); g.strokeStyle = glow; g.lineWidth = w * 2.6; g.stroke(); }
    path(); g.strokeStyle = `rgba(16,10,8,${a === undefined ? 0.85 : a})`; g.lineWidth = w; g.stroke();
    g.save(); g.translate(0.35, 0.35); path(); g.strokeStyle = 'rgba(255,240,220,0.18)'; g.lineWidth = w * 0.45; g.stroke(); g.restore();
  };
  // the Barrelbeast: a crack in its staves for every tenth of its hp gone (20-hollowford's enrage stacks), firelight
  // through them once its boiler is cracked (half hp), and the rod's glass ball humming below 35% and flaring before a volley
  const BB_CRACK_SIDE = [[[4, -12], [6, -9], [3.6, -7], [6.4, -4.8]], [[-9, -11.6], [-6.6, -8.6], [-8.4, -6]], [[-1.6, -12], [0.6, -9.4], [-0.8, -7.4], [0.4, -5]],
    [[10.6, -11], [12.4, -8], [10.8, -5.4]], [[-13.4, -9], [-11.4, -6.6], [-12.6, -4.8]], [[7.4, -12.2], [8.6, -10.4]], [[-4.8, -6], [-3.2, -4.4]], [[12, -5.4], [13.6, -7]], [[-11, -12], [-12.6, -10.4]]];
  const BB_CRACK_END = [[[-11, -10], [-8.6, -7.6], [-10, -5], [-7.4, -2.6]], [[8.6, -13], [10.4, -9.6], [8.8, -7.2]], [[-4, -15.6], [-2.6, -12.6], [-4.4, -11]],
    [[11.6, -4], [9.6, -1], [11, 1.6]], [[-12, 0], [-9.6, 2.4], [-10.6, 4.4]], [[3, -16], [4.6, -13.4]], [[-6.6, 3.6], [-4.4, 5.2]], [[6, 4.6], [8, 2.6]], [[-8, -15], [-6.4, -13]]];
  function overBarrelbeast(g, v) {
    const f = H.face4(v), side = f === 'left' || f === 'right', back = f === 'up';
    const frac = v.maxHp > 0 ? clamp01(v.hp / v.maxHp) : 1, stacks = Math.max(0, Math.min(9, Math.floor((1 - frac) * 10))), p2 = frac <= 0.5, p3 = frac <= 0.35;
    const bob = v.moving ? -Math.abs(Math.sin(v.walkT)) * 1.1 : Math.sin(time * 2 + (v.seed || 0)) * 0.3;
    g.save(); g.translate(0, 3); if (f === 'left') g.scale(-1, 1);
    if (side) g.translate(-2.4, 0);
    g.translate(0, bob);
    const list = side ? BB_CRACK_SIDE : BB_CRACK_END;
    for (let k = 0; k < stacks; k++) crackLine(g, list[k], k < 3 ? 0.62 : 0.45, p2 ? `rgba(255,140,40,${(0.3 + Math.sin(time * 9 + k) * 0.2).toFixed(3)})` : null);
    const ball = clamp01((p3 ? 0.45 + Math.sin(time * 18) * 0.1 : 0) + v.rodGlow * 0.55);
    if (ball > 0.2) {
      const bx = side ? 13.6 : back ? -10.4 : 10.4, by = side ? -32.2 : -34.2, R = 3 + v.rodGlow * 3;
      const gl = g.createRadialGradient(bx, by, 0.3, bx, by, R); gl.addColorStop(0, `rgba(235,225,255,${(ball * 0.9).toFixed(3)})`); gl.addColorStop(1, 'rgba(200,180,255,0)');
      g.fillStyle = gl; H.ell(g, bx, by, R, R); g.fill();
      if (v.rodGlow > 0.5) { g.strokeStyle = `rgba(255,255,255,${((v.rodGlow - 0.5) * 1.6).toFixed(3)})`; g.lineWidth = 0.4; for (let k = 0; k < 3; k++) { const a = time * 25 + k * 2.1; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a) * 2.6, by + Math.sin(a) * 2.6); g.lineTo(bx + Math.cos(a + 0.5) * 4.4, by + Math.sin(a + 0.5) * 4.4); g.stroke(); } }
    }
    g.restore();
  }
  // the Gnasher: its hull cracks at half hp (33-goblincity)
  function overGnasher(g, v) {
    if (!(v.maxHp > 0 && v.hp <= v.maxHp * 0.5)) return;
    const f = H.face4(v), side = f === 'left' || f === 'right';
    g.save(); if (f === 'left') g.scale(-1, 1);
    crackLine(g, side ? [[-8, -13.4], [-5.6, -10], [-7.4, -7.4], [-4.6, -4.6]] : [[-11, -10.6], [-9.4, -8], [-10.6, -6], [-9, -3]], 0.6, 'rgba(255,120,40,0.25)');
    g.restore();
  }
  // a giant ore: deep cracks once a third of it is broken, split open with its seam glowing at two thirds (91-royalmine)
  const ORE = { giant_mithril: { rgb: '160,210,255' }, giant_stormstone: { rgb: '210,170,255' } };
  function oreJitter(v) { const mv = v.moving, waking = v.attackT > 0 ? Math.sin((1 - v.attackT / 0.22) * Math.PI) : 0, q = mv ? 0.55 : 0.12, shake = q + waking * 0.9;
    return [Math.sin(time * 41 + (v.walkT || 0) * 7) * shake, Math.cos(time * 37 + (v.walkT || 0) * 5) * shake * 0.5]; }
  function overOre(g, v) {
    const frac = v.maxHp > 0 ? clamp01(v.hp / v.maxHp) : 1; if (frac > 0.66) return;
    const [jx, jy] = oreJitter(v);
    g.save(); g.translate(jx, jy);
    crackLine(g, [[-12.6, -3.4], [-7.4, -1.2], [-4.6, 3.6], [-5.6, 8.4]], 0.9, null);
    crackLine(g, [[3.4, -14], [5.2, -8.4], [9.6, -5.6], [13, -6.2]], 0.9, null);
    g.fillStyle = 'rgba(20,14,28,0.9)'; for (const [x, y, s] of [[-6.2, -13.6, 1], [11.8, 8, -1]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.6 * s, y + 1.9); g.lineTo(x + 3 * s, y - 0.2); g.closePath(); g.fill(); }
    g.restore();
  }
  // split: the two halves drawn apart, the seam glowing between them and grit falling out of it
  function paintOreSplit(g, v, draw) {
    const k = SIZE[draw] || 1, gap = 2.2, [jx, jy] = oreJitter(v), rgb = ORE[draw].rgb;
    for (const s of [-1, 1]) { g.save(); g.scale(k, k); g.beginPath(); g.rect(s < 0 ? -40 : 0, -40, 40, 80); g.clip(); g.translate(s * gap, s < 0 ? 0.3 : 0); NEW[draw](g, v); overOre(g, v); g.restore(); }
    g.save(); g.scale(k, k); g.translate(jx, jy);
    const gr = g.createLinearGradient(0, -15, 0, 10); gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.5, `rgba(${rgb},0.9)`); gr.addColorStop(1, `rgba(${rgb},0.2)`);
    g.fillStyle = gr; g.fillRect(-gap, -14, gap * 2, 24);
    for (let i = 0; i < 5; i++) { const ph = (time * 1.2 + i / 5) % 1; g.fillStyle = `rgba(160,150,135,${(1 - ph).toFixed(3)})`; H.ell(g, Math.sin(i * 2.1) * 1.4, -10 + ph * 21, 0.5, 0.5); g.fill(); }
    g.restore();
  }
  const OVER = { barrelbeast: overBarrelbeast, gnasher: overGnasher, giant_mithril: overOre, giant_stormstone: overOre };
  // placed before the drawing, in game pixels: a little golem climbing out of the floor, a woken golem rising off the ground
  function golemRise(g, v, e, s) {
    if (typeof monsters === 'undefined' || !monsters.includes(e)) return;
    const up = clamp01((time - s.born) / 0.6);
    if (up < 1) { g.translate(0, (1 - up) * 18); g.scale(0.6 + up * 0.4, 0.6 + up * 0.4); }
  }
  const XF = {
    golemling: (g, v) => { if (v.state === 'emerge') { g.translate(Math.sin(time * 40) * 1.5, 10); g.scale(0.8, 0.8); } },
    mithril_golem: golemRise, stormstone_golem: golemRise,
  };

  // ---------- drawing ----------
  function paint(g, v, draw, e, s) {
    const k = SIZE[draw] || 1;
    STATS.by[draw] = (STATS.by[draw] || 0) + 1;
    g.save();
    if (XF[draw] && e) XF[draw](g, v, e, s);
    if (ORE[draw] && v.maxHp > 0 && v.hp / v.maxHp < 0.33) paintOreSplit(g, v, draw);
    else { if (k !== 1) g.scale(k, k); NEW[draw](g, v); if (OVER[draw]) OVER[draw](g, v); }
    g.restore();
  }
  const canvasOf = (w, h) => { if (typeof document === 'undefined' || !document.createElement) return null; const c = document.createElement('canvas'); c.width = w; c.height = h; const cg = c.getContext ? c.getContext('2d') : null; return cg ? { c, cg } : null; };
  const picScale = () => Math.max(1, Math.min(2, typeof DPR === 'number' && DPR > 0 ? DPR : 1));
  // a hit flashes the whole body red, every colour (the sample's own tint), the way the knight flashes; a stone body hit
  // in his mine flashes white
  const HURT = 'rgba(255,90,90,0.45)', FLASH = 'rgba(255,255,255,0.45)';
  function tint(cg, w, h, col) { cg.save(); cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = col; cg.fillRect(0, 0, w, h); cg.restore(); }

  // ---------- pictures: the small, common monsters, drawn once per pose and kept ----------
  // A picture is one type, one of 8 facings (16 for the spiders and the hawk, seen from above and turned to face), one
  // frame (8 steps of a walk, 4 of a swing, 12 of the standing clock), hurt or not, at the screen's pixel ratio. The
  // standing clock runs 6 frames a second on a 2 s loop, each monster's own seed setting where on the loop it is, so a
  // crowd does not breathe in step. The rest (machines, golems, dragons, bosses: big, few, and full of state) is drawn live.
  const PIC_TYPES = new Set(['goblin', 'sapper', 'brute', 'spider', 'giant_spider', 'wolf', 'boar', 'sheep', 'cow', 'grave_skeleton', 'zombie', 'zombie_calm',
    'grave_risen', 'grave_zombie', 'grave_zombie_calm', 'guard_m', 'guard_f', 'dwarf_guard', 'castle_guard', 'elf_sentinel', 'sky_sentinel', 'vampire', 'rimhawk']);
  const TOP_DIRS = new Set(['spider', 'giant_spider', 'rimhawk']);
  const WALK_N = 8, SWING_N = 4, IDLE_N = 12, IDLE_FPS = 6;
  const PIC_MAX = 1400, PIC_BYTES = 48 * 1024 * 1024;
  const PICS = new Map();
  let picBytes = 0;
  function lruGet(k) { const v = PICS.get(k); if (v) { PICS.delete(k); PICS.set(k, v); } return v; }
  function lruPut(k, v) {
    PICS.set(k, v); picBytes += v.bytes;
    while (PICS.size > PIC_MAX || (picBytes > PIC_BYTES && PICS.size > 1)) {
      const [k0, o] = PICS.entries().next().value; PICS.delete(k0); picBytes -= o.bytes;
      try { o.c.width = 0; o.c.height = 0; } catch (err) { }
    }
  }
  function clearPics() { for (const o of PICS.values()) { try { o.c.width = 0; o.c.height = 0; } catch (err) { } } PICS.clear(); picBytes = 0; }
  // the pose a picture is made in: the view snapped to the picture's facing and frame, its clock set to the frame's own
  function picPose(v, draw, s) {
    const dirs = TOP_DIRS.has(draw) ? 16 : 8;
    const a = Math.atan2(v.facing.y, v.facing.x), dir = ((Math.round(a / (TWO_PI / dirs)) % dirs) + dirs) % dirs, da = dir * TWO_PI / dirs;
    const swing = v.attackT > 0 ? 1 - v.attackT / 0.22 : -1, ai = swing >= 0 ? Math.min(SWING_N - 1, Math.floor(swing * SWING_N)) : -1;
    const w8 = v.moving ? Math.floor(((v.walkT % TWO_PI) + TWO_PI) % TWO_PI / TWO_PI * WALK_N) % WALK_N : -1;
    let frame, t;
    if (ai >= 0) { frame = 'a' + ai + (w8 >= 0 ? 'w' + w8 : ''); t = 0.3 + ai * 0.05 + Math.max(0, w8) * 0.25; }
    else if (w8 >= 0) { frame = 'w' + w8; t = 0.1 + w8 * 0.25; }
    else { const i = ((Math.floor(time * IDLE_FPS + (s ? s.seed : 0) / TWO_PI * IDLE_N) % IDLE_N) + IDLE_N) % IDLE_N; frame = 'i' + i; t = i / IDLE_FPS; }
    const pv = Object.assign({}, v, { facing: { x: Math.cos(da), y: Math.sin(da) }, seed: 0,
      walkT: w8 >= 0 ? (w8 + 0.5) / WALK_N * TWO_PI : 0, attackT: ai >= 0 ? 0.22 * (1 - (ai + 0.5) / SWING_N) : 0 });
    return { key: draw + '|' + dir + '|' + frame + '|' + (v.unarmed ? 'u' : '') + '|' + (v.hurtT > 0 ? 'h' : ''), pv, t, swing: ai >= 0 };
  }
  function drawPic(g, v, draw, s) {
    const ss = picScale(), P = picPose(v, draw, s), key = P.key + '|' + ss;
    let p = lruGet(key);
    if (!p) {
      const b = boxOf(draw, P.swing), w = b[2] - b[0], h = b[3] - b[1];
      const cv = canvasOf(Math.ceil(w * ss), Math.ceil(h * ss)); if (!cv) return false;
      cv.cg.setTransform(ss, 0, 0, ss, -b[0] * ss, -b[1] * ss);
      const T0 = time; time = P.t;
      try { paint(cv.cg, P.pv, draw, null, null); } finally { time = T0; }
      if (v.hurtT > 0) tint(cv.cg, cv.c.width, cv.c.height, HURT);
      p = { c: cv.c, x0: b[0], y0: b[1], w, h, bytes: cv.c.width * cv.c.height * 4 };
      lruPut(key, p); STATS.made++;
    } else STATS.hits++;
    g.drawImage(p.c, p.x0, p.y0, p.w, p.h);
    STATS.pics++;
    return true;
  }
  // ---------- held pictures: the big ones, each its own picture, painted again a dozen times a second ----------
  // A big monster (a machine, a golem, a dragon, a boss) is too big and has too many poses and states to keep a picture
  // of every pose. Each one keeps its own picture instead, painted afresh 12 times a second walking, 10 standing, 24 in a
  // swing, and at once when it is hit or its state or phase changes; in between that picture is put down where the
  // monster now is, so it moves smoothly and only its pose steps. A hit flashes it red (a stone colossus white), the body
  // and not the ground.
  // A picture not drawn for 2 s is let go.
  const HELD = new Set(), HELD_FPS = 12, HELD_IDLE_FPS = 10, HELD_SWING_FPS = 24, HELD_KEEP = 2;
  let scratch = null;
  function heldCanvas(h, which, W, Hh) {
    let o = h[which];
    if (!o || o.c.width < W || o.c.height < Hh || o.c.width > W * 2 || o.c.height > Hh * 2) { if (o) { try { o.c.width = 0; o.c.height = 0; } catch (err) { } } o = h[which] = canvasOf(W, Hh); }
    return o;
  }
  function drawHeld(g, s, draw, swinging, moving, tintCol, keyMore, render) {
    const ss = picScale(), b = boxOf(draw, swinging), W = Math.ceil((b[2] - b[0]) * ss), Hh = Math.ceil((b[3] - b[1]) * ss);
    const h = s.held || (s.held = { key: null, used: 0 });
    // each monster's own moments (its seed staggers them), so a crowd of big ones is not all painted on the same frame
    const fps = swinging ? HELD_SWING_FPS : moving ? HELD_FPS : HELD_IDLE_FPS;
    const key = Math.floor(time * fps + (s.seed || 0) / TWO_PI) + '|' + fps + '|' + (tintCol || '') + '|' + keyMore + '|' + ss + '|' + draw;
    const o = heldCanvas(h, swinging ? 'atk' : 'rest', W, Hh); if (!o) return false;
    if (h.key !== key) {
      o.cg.setTransform(1, 0, 0, 1, 0, 0); o.cg.clearRect(0, 0, o.c.width, o.c.height);
      o.cg.setTransform(ss, 0, 0, ss, -b[0] * ss, -b[1] * ss); render(o.cg);
      if (tintCol) tint(o.cg, W, Hh, tintCol);
      h.key = key; STATS.heldPaints++;
    }
    h.used = time; HELD.add(s);
    g.drawImage(o.c, 0, 0, W, Hh, b[0], b[1], W / ss, Hh / ss);
    STATS.held++;
    return true;
  }
  function releaseHeld(all) {
    for (const s of HELD) { const h = s.held; if (!h) { HELD.delete(s); continue; } if (all || time - h.used > HELD_KEEP || time < h.used) { for (const k of ['rest', 'atk']) if (h[k]) { try { h[k].c.width = 0; h[k].c.height = 0; } catch (err) { } } s.held = null; HELD.delete(s); } }
  }
  // drawn live, off the world canvas (a portrait, a test) or when there is no canvas to hold a picture in
  function drawLiveTinted(g, v, draw, e, s, col) {
    const ss = picScale(), b = boxOf(draw, true), w = b[2] - b[0], h = b[3] - b[1], W = Math.ceil(w * ss), Hh = Math.ceil(h * ss);
    if (!scratch || scratch.c.width < W || scratch.c.height < Hh) scratch = canvasOf(Math.max(W, scratch ? scratch.c.width : 0), Math.max(Hh, scratch ? scratch.c.height : 0));
    if (!scratch) { paint(g, v, draw, e, s); return; }
    const cg = scratch.cg; cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, W, Hh);
    cg.setTransform(ss, 0, 0, ss, -b[0] * ss, -b[1] * ss); paint(cg, v, draw, e, s);
    tint(cg, W, Hh, col);
    g.drawImage(scratch.c, 0, 0, W, Hh, b[0], b[1], W / ss, Hh / ss);
  }
  const inMine = () => !!(window.ROYALMINE && window.__instance && window.__instance === ROYALMINE.ID);
  // e at the origin of g (drawCharacter has translated to it)
  function drawLook(g, e, type) {
    // the Ginormous Golem in his own mine is drawn by 91-royalmine's pass (ROYALMINE.drawColossus, below), not here
    if (type === 'ginormous_golem') { if (e.dead || (inMine() && typeof monsters !== 'undefined' && monsters.includes(e))) return; drawColossusLook(g, e, false); return; }
    const v = viewOf(e, type), draw = lookType(type, e), s = MEM.get(e);
    // the Echo of the Fang: a knight who has slain the real one sees it a little see-through (28-thefang)
    const echo = type === 'the_fang' && typeof quest !== 'undefined' && quest.fang && quest.fang.slain;
    if (echo) { g.save(); g.globalAlpha *= 0.75; }
    try {
      if (PIC_TYPES.has(draw) && g === ctx && ON.pics && drawPic(g, v, draw, s)) { }
      else if (g === ctx && ON.pics && !PIC_TYPES.has(draw) && drawHeld(g, s, draw, v.attackT > 0, v.moving, v.hurtT > 0 ? HURT : null, (s.ph || '') + '/' + s.st + '/' + Math.round((v.hp / (v.maxHp || 1)) * 20), cg => paint(cg, v, draw, e, s))) { }
      else { STATS.live++; if (v.hurtT > 0 && g === ctx) drawLiveTinted(g, v, draw, e, s, HURT); else paint(g, v, draw, e, s); }
      if (type === 'ally_knight') allyName(g, e, v);
    } finally { if (echo) g.restore(); }
  }
  // a Dragon Killer's name under his feet, as 37-dragonkillers always wrote it
  function allyName(g, e, v) {
    const name = e.allyName || (v.ally === 'garrick' ? 'Sir Garrick' : 'Sergeant Hale'), y = Math.round(BOX.ally_knight[3] + 8);
    g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(name, 0, y); g.fillStyle = '#9fe0b0'; g.fillText(name, 0, y);
  }

  // ---------- the Ginormous Golem: his states, drawn on the approved standing mountain ----------
  // Asleep he sags a little on his legs, his eyes shut and his furnace low, z's rising; standing up he straightens and
  // opens them (0.9 s); his wind-up raises his fists (the drawing's own slam, held at the top) and his slam brings them
  // down with the ring in the floor; under half hp his eyes burn red; red cracks multiply as he wears down; a hit
  // flashes him white; a mend rings his furnace green. Always seen from the front, as 91-royalmine always drew him.
  const AWAKE = new Set(['rise', 'fight', 'windup', 'slam']);
  const G_CRACKS = [[[-12, -14], [-9.6, -10.6], [-11.4, -7.4], [-9, -4.6]], [[10.4, -14.6], [12, -10.8], [9.6, -8]], [[-14, -1], [-10.4, 0.6], [-12, 3.6]],
    [[7, -2], [10.6, 0.4], [9, 3.6], [12.4, 5]], [[-4.4, -15.4], [-1.8, -13], [-3.6, -10.6]]];
  function colossusView(e) {
    const v = viewOf(e, 'ginormous_golem'), s = MEM.get(e), N = (window.ROYALMINE && ROYALMINE.NUM) || {};
    const st = typeof e.state === 'string' ? e.state : 'sleep', since = time - s.stAt, asleep = !AWAKE.has(st);
    v.facing = { x: 0, y: 1 }; v.moving = false; v.attackT = 0;
    if (st === 'windup') { const k = clamp01(since / (N.WINDUP || 1.2)); v.attackT = 0.22 * (1 - 0.3 * Math.min(0.999, k)); }
    else if (st === 'slam') { const k = clamp01(since / (N.SLAM || 0.5)); v.attackT = 0.22 * (1 - (0.3 + 0.7 * Math.min(0.999, k))); }
    v.riseK = st === 'rise' ? clamp01(since / (N.RISE || 0.9)) : asleep ? 0 : 1;
    v.asleep = asleep; v.slam = st === 'slam';
    return v;
  }
  function paintColossus(g, v) {
    const k = SIZE.ginormous_golem || 1, sag = 1 - v.riseK, frac = v.maxHp > 0 ? clamp01(v.hp / v.maxHp) : 1, half = frac <= 0.5 && !v.asleep;
    STATS.colossus++; STATS.by.ginormous_golem = (STATS.by.ginormous_golem || 0) + 1;
    g.save(); if (v.slam) g.translate(Math.sin(time * 60) * 3, 0);
    g.scale(k, k);
    // asleep he sags down on his legs (about his feet)
    if (sag > 0) { g.translate(0, 14.7); g.scale(1, 1 - 0.07 * sag); g.translate(0, -14.7 + 1.6 * sag); }
    NEW.ginormous_golem(g, v);
    g.translate(0, 3.4);
    const bob = Math.sin(time * 1.2 + (v.seed || 0)) * 0.2;
    g.translate(0, bob);
    // his furnace low while he sleeps
    if (sag > 0) { g.fillStyle = `rgba(30,22,16,${(0.5 * sag).toFixed(3)})`; H.ell(g, 0, -4.6, 5.4, 4.6); g.fill(); }
    // cracks, more as he wears down, glowing red
    const n = frac < 0.2 ? 5 : frac < 0.4 ? 4 : frac < 0.6 ? 3 : frac < 0.8 ? 2 : frac < 0.97 ? 1 : 0, cp = 0.55 + 0.45 * Math.sin(time * (half ? 9 : 4));
    for (let i = 0; i < n; i++) crackLine(g, G_CRACKS[i], 0.7, `rgba(255,${90 + Math.round(70 * cp)},50,${(0.45 + 0.4 * cp).toFixed(3)})`);
    // his eyes: shut while he sleeps (lids of his own stone), opening as he stands; red under half hp
    for (const sx of [-1, 1]) {
      const ex = sx * 2.5, ey = -19.8;
      if (sag > 0) {
        g.fillStyle = `rgba(143,135,122,${sag.toFixed(3)})`; H.ell(g, ex, ey, 1.8, 1.25); g.fill();
        g.strokeStyle = `rgba(42,26,18,${sag.toFixed(3)})`; g.lineWidth = 0.4; g.beginPath(); g.moveTo(ex - 1.5, ey + 0.2); g.quadraticCurveTo(ex, ey + 0.8, ex + 1.5, ey + 0.2); g.stroke();
      } else if (half) {
        const gl = g.createRadialGradient(ex, ey, 0.1, ex, ey, 2.8); gl.addColorStop(0, 'rgba(255,70,50,0.75)'); gl.addColorStop(1, 'rgba(255,70,50,0)'); g.fillStyle = gl; H.ell(g, ex, ey, 2.8, 2.8); g.fill();
        H.ell(g, ex, ey, 1.2, 0.8); g.fillStyle = '#ffd0c0'; g.fill(); H.ell(g, ex, ey, 0.5, 0.5); g.fillStyle = '#ff3a20'; g.fill();
      }
    }
    // a mend: a green ring round his furnace (91-royalmine's mendFlash)
    const mend = window.ROYALMINE && ROYALMINE.run ? clamp01(1 - (time - (ROYALMINE.run.mendFlash || -99)) / 0.9) : 0;
    if (mend > 0) { g.strokeStyle = `rgba(150,235,110,${(0.85 * mend).toFixed(3)})`; g.lineWidth = 0.9; H.ell(g, 0, -4.6, 7 + (1 - mend) * 7, 6 + (1 - mend) * 6); g.stroke(); }
    // z's rising while he sleeps
    if (v.asleep) for (let i = 0; i < 3; i++) {
      const ph = (time * 0.35 + i / 3) % 1, x = 6 + i * 1.8 + Math.sin(time + i) * 0.6, y = -27 - ph * 7, sz = 2.4 + ph * 1.6;
      g.save(); g.translate(x, y); g.font = `800 ${sz.toFixed(2)}px sans-serif`; g.textAlign = 'center';
      g.lineWidth = 0.6; g.strokeStyle = `rgba(22,14,8,${(0.45 * (1 - ph)).toFixed(3)})`; g.strokeText('z', 0, 0); g.fillStyle = `rgba(232,226,210,${(0.85 * (1 - ph)).toFixed(3)})`; g.fillText('z', 0, 0); g.restore();
    }
    g.restore();
  }
  // drawn at the origin of g: in his mine at the size the approved sample shows him, in a portrait fitted to its box
  function drawColossusLook(g, e, flash) {
    const v = colossusView(e), s = MEM.get(e);
    if (g === ctx && ON.pics && drawHeld(g, s, 'ginormous_golem', v.slam || v.attackT > 0, false, flash ? FLASH : null, s.st + '/' + Math.round((v.hp / (v.maxHp || 1)) * 20), cg => paintColossus(cg, v))) return;
    if (!flash || g !== ctx) { paintColossus(g, v); return; }
    const ss = picScale(), b = boxOf('ginormous_golem', true), W = Math.ceil((b[2] - b[0]) * ss), Hh = Math.ceil((b[3] - b[1]) * ss);
    if (!scratch || scratch.c.width < W || scratch.c.height < Hh) scratch = canvasOf(Math.max(W, scratch ? scratch.c.width : 0), Math.max(Hh, scratch ? scratch.c.height : 0));
    if (!scratch) { paintColossus(g, v); return; }
    const cg = scratch.cg; cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, W, Hh);
    cg.setTransform(ss, 0, 0, ss, -b[0] * ss, -b[1] * ss); paintColossus(cg, v); tint(cg, W, Hh, FLASH);
    g.drawImage(scratch.c, 0, 0, W, Hh, b[0], b[1], W / ss, Hh / ss);
  }
  // 91-royalmine's pass and 79-deaths' falling body call ROYALMINE.drawColossus(g, golem, flash); it is put in place the
  // first time anything draws (91 loads after this file)
  let colossusOld = null;
  function installColossus() {
    if (!window.ROYALMINE || ROYALMINE.drawColossus === colossusNew) return;
    colossusOld = ROYALMINE.drawColossus;
    ROYALMINE.drawColossus = colossusNew;
  }
  function colossusNew(g, e, flash) { if (!ON.on && colossusOld) return colossusOld(g, e, flash); drawColossusLook(g, e, !!flash); }

  // ---------- a falling person's own weapon, for 79-deaths to throw clear (it draws its own when this says no) ----------
  // where each weapon's middle is along its length, in the drawing's units (measured), and the person's own scale
  const WEAPON_MID = { goblin: 8.8, sapper: 9, brute: 10, guard_m: 14, guard_f: 14, dwarf_guard: 11.5, castle_guard: 13.4, elf_sentinel: -0.7, sky_sentinel: 15, hale: 15, garrick: 14.4 };
  const BIPED_S = { goblin: 0.92, sapper: 0.92, brute: 1.22 };
  function drawWeapon(g, type, body) {
    if (!ON.on || !ART.WEAPONS) return false;
    const key = type === 'ally_knight' ? (body && body.ally === 'garrick' ? 'garrick' : body && body.ally === 'hale' ? 'hale' : 'garrick') : type;
    const w = ART.WEAPONS[key]; if (!w) return false;
    const k = (SIZE[type] || 1) * (BIPED_S[type] || 1);
    g.save(); g.scale(k, k); g.translate(-(WEAPON_MID[key] || 0), 0);
    try { w(g); } finally { g.restore(); }
    return true;
  }

  // ---------- the wraps ----------
  const _drawCharacter = drawCharacter;
  drawCharacter = function (g, e, kind) {
    if (!ON.on || !e || !isMonsterKind(kind)) { STATS.passed++; return _drawCharacter(g, e, kind); }
    STATS.wrapped++;
    installColossus();
    g.save(); g.translate(+e.x || 0, +e.y || 0);
    try { drawLook(g, e, kind); } finally { g.restore(); }
  };
  // 09-render: the name, the health bar and the stun stars sit just over the new look's head, and a big one is still drawn
  // while its body reaches into the view
  const _monsterTop = monsterTop, _monsterPad = monsterPad;
  monsterTop = m => (ON.on && m && BOX[m.type]) ? Math.max(m.r || 0, headroom(m.type) - 7) : _monsterTop(m);
  monsterPad = m => (ON.on && m && BOX[m.type]) ? Math.max(80, reach(m.type)) : _monsterPad(m);
  HOOKS.draw.push((g, items) => { installColossus(); if (HELD.size) releaseHeld(false); });
  HOOKS.newGame.push(() => { releaseHeld(true); clearPics(); });

  // a portrait (44-wiki, 76-admin): the scale and the offset that fit the whole drawing standing in a size x size box
  function fit(type, size, most) {
    const b = BOX[type]; if (!ON.on || !b) return null;
    const w = b[2] - b[0], h = b[3] - b[1], scale = Math.min(most || 1.8, (size * 0.86) / Math.max(w, h, 20));
    return { scale, ox: -(b[0] + b[2]) / 2 * scale, oy: -(b[1] + b[3]) / 2 * scale };
  }

  // ---------- self-test ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'monster look: ';
    // a context that writes down every call and every colour it is given (the headless canvas is a stub)
    const recorder = () => {
      const log = []; let n = 0;
      const grad = () => ({ addColorStop: () => { } });
      const g = new Proxy({}, {
        get: (t, k) => {
          if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return (...a) => { n++; log.push(k); return grad(); };
          if (k === 'measureText') return () => ({ width: 10 });
          if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
          if (k in t) return t[k];
          if (typeof k !== 'string') return undefined;
          return (...a) => { n++; log.push(k + ':' + a.map(x => typeof x === 'number' ? Math.round(x * 10) / 10 : typeof x).join(',')); };
        },
        set: (t, k, v) => { t[k] = v; if (typeof v === 'string' || typeof v === 'number') log.push('=' + String(k) + ':' + (typeof v === 'number' ? Math.round(v * 100) / 100 : v)); return true; },
      });
      return { g, log, get n() { return n; } };
    };
    const types = Object.keys(MONSTER_DEFS);
    const T0 = time, peace0 = window.__peace, on0 = ON.on, pics0 = ON.pics;
    const ent = (type, o) => Object.assign({ type, x: 0, y: 0, r: MONSTER_DEFS[type].r, home: { x: 0, y: 0 }, hp: MONSTER_DEFS[type].hp, maxHp: MONSTER_DEFS[type].hp, facing: { x: 0, y: 1 },
      moving: false, walkT: 0, attackT: 0, hurtT: 0, stunT: 0, state: 'idle', dead: false }, o || {});
    // the old sprites must never be reached for a monster: every drawMonster hook is a counter while the checks run
    const hooks0 = Object.assign({}, HOOKS.drawMonster); let oldHits = 0;
    for (const k of Object.keys(HOOKS.drawMonster)) HOOKS.drawMonster[k] = function () { oldHits++; };
    try {
      // 1. every monster type has an approved drawing and a size, and nothing else is drawn by the look
      { const missing = types.filter(t => !NEW[t] || !BOX[t]), extra = Object.keys(NEW).filter(t => !MONSTER_DEFS[t]);
        check(P + `every one of the ${types.length} monster types has its approved drawing and a measured size (and the look draws no type the game does not have)`, types.length === 47 && !missing.length && !extra.length, { n: types.length, missing, extra }); }
      // 2. each type, at 8 facings, standing, walking, swinging and hurt, through drawCharacter: the new drawing, never the old
      { const bad = []; const by0 = Object.assign({}, STATS.by), passed0 = STATS.passed; time = 3.1;
        for (const t of types) for (let d = 0; d < 8; d++) for (const pose of ['stand', 'walk', 'swing', 'hurt']) {
          const a = d * Math.PI / 4, e = ent(t, { facing: { x: Math.cos(a), y: Math.sin(a) }, moving: pose === 'walk', attackT: pose === 'swing' ? 0.2 : 0, hurtT: pose === 'hurt' ? 0.2 : 0 });
          if (t === 'ginormous_golem') e.state = 'fight';
          const r = recorder(), draw = lookType(t, e), before = STATS.by[draw] || 0;
          try { drawCharacter(r.g, e, t); } catch (err) { bad.push(t + ' ' + pose + ' threw ' + err.message); continue; }
          if ((STATS.by[draw] || 0) !== before + 1 || r.n < 20) bad.push(t + ' d' + d + ' ' + pose + ' calls ' + r.n);
        }
        check(P + 'every type draws through its new look at 8 facings, standing, walking, swinging and hurt, and never through its old sprite', !bad.length && oldHits === 0 && STATS.passed === passed0, { bad: bad.slice(0, 8), oldHits, passed: STATS.passed - passed0 }); }
      // 3. the states: each one changes the picture (the same moment drawn twice, only the state differs)
      { time = 5.37;
        const fang0 = quest.fang ? quest.fang.slain : undefined;
        const CASES = [
          ['thunderbird high', 'thunderbird', { phase: 'hunt' }, { phase: 'high' }], ['thunderbird perch', 'thunderbird', { phase: 'hunt' }, { phase: 'perch' }],
          ['fang ice', 'the_fang', { element: 'fire' }, { element: 'ice' }], ['fang storm', 'the_fang', { element: 'fire' }, { element: 'storm' }], ['fang stone', 'the_fang', { element: 'fire' }, { element: 'stone' }],
          ['fang element from a row', 'the_fang', { phase: 'fire' }, { phase: 'stone' }],
          ['brute wind-up', 'zombie_brute', { windT: 0, stagT: 0 }, { windT: 0.5, stagT: 0 }], ['brute stagger', 'zombie_brute', { windT: 0, stagT: 0 }, { windT: 0, stagT: 1 }],
          ['brute wind-up from a row', 'zombie_brute', {}, { phase: 'wind' }], ['brute stagger from a row', 'zombie_brute', {}, { phase: 'stagger' }],
          ['wight heart out', 'cinderwight', {}, { heart: { dead: false } }], ['wight cold', 'cinderwight', {}, { coldT: 2 }], ['wight cold from a row', 'cinderwight', {}, { phase: 'cold' }], ['wight feeding from a row', 'cinderwight', {}, { phase: 'feed' }],
          ['heart burning down', 'cinder_heart', { emberT: 0 }, { emberT: 9 }],
          ['Barrelbeast cracked', 'barrelbeast', {}, { hp: 160 }], ['Barrelbeast rod flaring', 'barrelbeast', { rodGlow: 0 }, { rodGlow: 1 }], ['Barrelbeast rod from a row', 'barrelbeast', {}, { phase: 'volley' }, 1],
          ['Gnasher arm', 'gnasher', { armT: 0 }, { armT: 0.2 }], ['Gnasher arm from a row', 'gnasher', {}, { phase: 'arm' }, 0.2], ['Gnasher cracked', 'gnasher', {}, { hp: 150 }],
          ['dozer charging', 'bulldozer', { chargeT: 0 }, { chargeT: 0.5 }], ['dozer charging from a row', 'yard_dozer', {}, { phase: 'charge' }],
          ['mithril ore stirring', 'giant_mithril', { state: 'idle' }, { state: 'stir' }], ['mithril ore waking', 'giant_mithril', { state: 'idle' }, { state: 'waking' }],
          ['stormstone ore cracked', 'giant_stormstone', {}, { hp: 5 }], ['stormstone ore split', 'giant_stormstone', {}, { hp: 2 }],
          ['little golem climbing out', 'golemling', { state: 'walk' }, { state: 'emerge' }],
          ['Ginormous Golem asleep', 'ginormous_golem', { state: 'fight' }, { state: 'sleep' }], ['Ginormous Golem wind-up', 'ginormous_golem', { state: 'fight' }, { state: 'windup' }],
          ['Ginormous Golem slam', 'ginormous_golem', { state: 'fight' }, { state: 'slam' }], ['Ginormous Golem at half', 'ginormous_golem', { state: 'fight' }, { state: 'fight', hp: 200 }],
          ['calm zombie roused', 'zombie_calm', { state: 'idle' }, { state: 'chase' }], ['calm grave zombie roused', 'grave_zombie_calm', { state: 'idle' }, { state: 'chase' }],
          ['Dragon Killers', 'ally_knight', { ally: 'hale' }, { ally: 'garrick' }], ['a falling guard without his spear', 'guard_m', {}, { unarmed: true }], ['a falling goblin without his cleaver', 'goblin', {}, { unarmed: true }],
        ];
        const same = [];
        for (const [name, t, a, b, later] of CASES) {
          // a state that plays out from the moment it arrives (a row's wind-up) is drawn a little after it arrives
          const ea = ent(t, a), eb = ent(t, b); const ra = recorder(), rb = recorder();
          time = 5.37; drawCharacter(ra.g, ea, t); drawCharacter(rb.g, eb, t); time = 5.37 + (later || 0.4); const ra2 = recorder(), rb2 = recorder(); drawCharacter(ra2.g, ea, t); drawCharacter(rb2.g, eb, t);
          if (ra2.log.join('|') === rb2.log.join('|')) same.push(name);
        }
        // the Echo of the Fang: see-through for a knight who slew the real one
        quest.fang = quest.fang || {}; quest.fang.slain = false; const r1 = recorder(); drawCharacter(r1.g, ent('the_fang'), 'the_fang');
        quest.fang.slain = true; const r2 = recorder(); drawCharacter(r2.g, ent('the_fang'), 'the_fang'); quest.fang.slain = fang0;
        const echo = r2.log.some(l => l.startsWith('=globalAlpha')) && !r1.log.some(l => l.startsWith('=globalAlpha'));
        const roused = lookType('zombie_calm', { state: 'chase' }) === 'zombie' && lookType('grave_zombie_calm', { state: 'chase' }) === 'grave_zombie' && lookType('zombie_calm', { state: 'idle' }) === 'zombie_calm';
        check(P + `every state a monster shows changes its new picture (${CASES.length} states, the local field and a puppet row's phase both), and the Echo of the Fang is drawn see-through`, !same.length && echo && roused, { same, echo, roused }); }
      // 4. online puppets: a puppet's walkT never moves and its attackT changes only when a row lands; the look still walks and swings
      { time = 10; const pup = ent('goblin', { nid: 'Ann:51', remote: true, moving: true, walkT: 0, facing: { x: 1, y: 0 } }), steps = new Set(), swings = [];
        for (let k = 0; k < 40; k++) {
          time += 1 / 30;
          if (k === 20) pup.attackT = 0.2;
          if (k === 23) pup.attackT = 0.1;
          if (k === 26) pup.attackT = 0;
          drawCharacter(ctx, pup, 'goblin');
          const v = viewOf(pup, 'goblin'), P2 = picPose(v, 'goblin', MEM.get(pup));
          const m = /\|w(\d)\|/.exec(P2.key), a = /\|a(\d)/.exec(P2.key); if (m) steps.add(m[1]); if (a) swings.push(+a[1]);
        }
        const inOrder = swings.length >= 3 && swings.every((x, i) => i === 0 || x >= swings[i - 1]) && swings[0] === 0 && swings[swings.length - 1] === 3;
        const brute = ent('zombie_brute', { nid: 'Ann:52', remote: true }); time = 20; viewOf(brute, 'zombie_brute'); brute.phase = 'wind'; const w0 = viewOf(brute, 'zombie_brute').windT; time = 20.5; const w1 = viewOf(brute, 'zombie_brute').windT;
        const seedSame = viewOf(ent('wolf', { nid: 'Ann:53' }), 'wolf').seed === viewOf(ent('wolf', { nid: 'Ann:53', x: 999 }), 'wolf').seed;
        check(P + 'an online puppet (walkT stuck at 0, attackT only as rows land) walks through the step pictures, swings once in order, plays a row\'s wind-up on the look\'s own clock, and has the same seed on every screen',
          pup.walkT === 0 && steps.size >= 6 && inOrder && w0 > 1 && w1 > 0.5 && w1 < 0.7 && seedSame, { steps: [...steps], swings, w0, w1, seedSame }); }
      // 5. a dying monster: 79-deaths' falling body is drawn in the new look, and a person's weapon flies as his own
      if (window.DEATHS) {
        h.peace(true); const bad = []; let weap = 0;
        const drawW0 = MONSTER_LOOK.drawWeapon;
        for (const t of ['goblin', 'wolf', 'zombie', 'walker', 'green_dragon', 'mithril_golem', 'guard_m']) {
          const m = ent(t, { x: player.x + 200, y: player.y, nid: null, dead: true, hp: 0 }); monsters.push(m);
          const c = DEATHS.spawn(m); if (!c) { bad.push(t + ' no corpse'); continue; }
          const before = STATS.by[lookType(t, c.body)] || 0, r = recorder();
          for (const age of [0.05, 0.3, 0.55]) { c.t = age * c.dur; DEATHS.draw(r.g, c); }
          if ((STATS.by[lookType(t, c.body)] || 0) < before + 3) bad.push(t + ' drawn ' + ((STATS.by[t] || 0) - before));
          if (c.kind === 'person' && !c.body.unarmed) bad.push(t + ' armed');
          if (c.kind === 'person' && (c.ext < reach(t) || !r.log.length)) bad.push(t + ' ext ' + c.ext);
          if (c.kind === 'undead' && !(c.top >= headroom(t))) bad.push(t + ' top ' + c.top);
          monsters.splice(monsters.indexOf(m), 1); m.dead = false;
        }
        { const r = recorder(); weap = drawWeapon(r.g, 'guard_m', {}) && r.n > 10 ? 1 : 0; }
        check(P + '79-deaths draws a falling body in the new look (every kind of death), clipped to the new size, and throws a person\'s own weapon clear', !bad.length && weap === 1 && oldHits === 0, { bad, weap, oldHits });
      }
      // 6. hit circles: each r is the table's, and every spawn of a grown one still stands on clear ground with room to move
      { const wrong = types.filter(t => MONSTER_DEFS[t].r !== HIT_R[t]).map(t => t + ' ' + MONSTER_DEFS[t].r + '/' + HIT_R[t]);
        const grown = new Set(Object.keys(HIT_R_WAS)), stuck = [];
        const room = (x0, y0, r) => { if (collides(x0, y0, r, 'beast')) return 0; let n = 0; const S = 16; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (!collides(x0 + dx * S, y0 + dy * S, r, 'beast')) n++; return n; };
        if (!window.__instance) for (const sp of MONSTER_SPAWNS) if (grown.has(sp.type)) { const n = room(tc(sp.tx), tc(sp.ty), MONSTER_DEFS[sp.type].r); if (n < 12) stuck.push(sp.type + '@' + sp.tx + ',' + sp.ty + ' ' + n); }
        const pc = window.PLAYTHROUGH ? PLAYTHROUGH.connectivity() : null, ic = window.PLAYTHROUGH ? PLAYTHROUGH.instanceConnectivity().filter(r => r.dist < 0) : [];
        check(P + `hit circles fit the new looks: all ${types.length} radii as the table says (${Object.keys(HIT_R_WAS).length} grown), every grown one's spawn stands clear with room to move, and the world and every instance stay connected`,
          !wrong.length && !stuck.length && (!pc || pc.unreachable.length === 0) && !ic.length, { wrong, stuck, unreachable: pc ? pc.unreachable.slice(0, 4) : null, inst: ic.slice(0, 4) }); }
      // 7. a crowd: the common monsters are pictures, made once and then reused
      { const crowd = [], kinds = [...PIC_TYPES]; time = 40; const made0 = STATS.made, live0 = STATS.live;
        for (let i = 0; i < 40; i++) crowd.push(ent(kinds[i % kinds.length], { nid: 'crowd' + i, moving: i % 3 !== 0, facing: { x: Math.cos(i), y: Math.sin(i) } }));
        // 2.5 s to warm (a whole walk and the whole 2 s standing loop), then a second more must make next to nothing
        let warm = 0;
        for (let k = 0; k < 210; k++) { time += 1 / 60; if (k === 150) warm = STATS.made; for (const e of crowd) drawCharacter(ctx, e, e.type); }
        const later = STATS.made - warm;
        check(P + 'a crowd of 40 common monsters walking and standing is drawn from pictures: none live, and once warm no new pictures are made (frame time against master is measured in headless Chromium, see the report)',
          STATS.live === live0 && later <= 2 && STATS.made - made0 > 0 && PICS.size <= 1400, { live: STATS.live - live0, made: STATS.made - made0, later, pics: PICS.size }); }
      // 7b. the big ones each hold one picture, painted again at most 12 times a second walking and 10 standing
      { const bigs = ['the_fang', 'red_dragon', 'barrelbeast', 'walker', 'ginormous_golem'].map((t, i) => ent(t, { nid: 'big' + i, moving: i % 2 === 0, state: t === 'ginormous_golem' ? 'fight' : 'idle' }));
        time = 60; const p0 = STATS.heldPaints, l0 = STATS.live;
        for (let k = 0; k < 120; k++) { time += 1 / 60; for (const e of bigs) drawCharacter(ctx, e, e.type); }
        const paints = STATS.heldPaints - p0, held = bigs.every(e => MEM.get(e) && MEM.get(e).held);
        time += 5; releaseHeld(false); const let_go = bigs.every(e => !MEM.get(e).held) && !HELD.size;
        check(P + 'the big monsters each keep one picture of their own, painted again 10 to 12 times a second (not every frame), and let go when no longer drawn',
          held && paints >= 5 * 18 && paints <= 5 * 26 && STATS.live === l0 && let_go, { paints, held, live: STATS.live - l0, let_go }); }
      // 8. labels over the heads, big ones drawn while they reach into the view, portraits fitted, the golem's own picture
      { const tall = ent('guard_m'), big = ent('the_fang');
        const labels = monsterTop(tall) >= headroom('guard_m') - 7 && monsterTop(tall) > tall.r && monsterPad(big) >= 190;
        const fits = types.every(t => { const f = fit(t, 64, 1.8), b = BOX[t]; return f && Math.max(b[2] - b[0], b[3] - b[1]) * f.scale <= 64 * 0.87; });
        installColossus(); const c0 = STATS.colossus; if (window.ROYALMINE) ROYALMINE.drawColossus(recorder().g, ent('ginormous_golem', { state: 'sleep' }), false);
        const golem = !window.ROYALMINE || STATS.colossus === c0 + 1;
        check(P + 'a name and health bar sit over the new head, a big monster is drawn while its body reaches into the view, every portrait fits its box, and the Ginormous Golem\'s own pass draws his new look', labels && fits && golem, { labels, fits, golem }); }
    } finally {
      for (const k of Object.keys(HOOKS.drawMonster)) HOOKS.drawMonster[k] = hooks0[k];
      time = T0; window.__peace = peace0; ON.on = on0; ON.pics = pics0;
    }
  });

  return { ON, STATS, LOOK_FIELDS, HIT_R, HIT_R_WAS, ATTACK_T, BOX, PIC_TYPES, viewOf, lookType, isMonsterKind, drawLook, boxOf, reach, headroom, picPose, clearPics,
    PICS, HELD, releaseHeld, MEM, fit, drawWeapon, drawColossusLook, colossusView, installColossus, paint, _drawCharacter };
})();
window.MONSTER_LOOK = MONSTER_LOOK;
