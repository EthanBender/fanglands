// ============================================================================
// AERIE, PART TWO — the light, the city, the Spire Run and what only the sky has. src/88-aerie.js
//
// Three things the owner asked for:
//   1. "the lighting is off in the dwarf city and the sky city too."
//      The cause is one line in the core: 09-render paints the starting cave's darkness over map tiles
//      0-20 x 0-15 whenever the camera is near the origin. Every instance is written into that same
//      corner of the map, so that scrim lands on the instance as a hard-edged dark rectangle -- across
//      more than half of Deepholm (29 x 27) and across the west end of Aerie's great hall. Nobody saw it
//      in the Spider Den because the den is dark anyway. INSTANCE_LIGHT below makes lighting a per-instance
//      mode instead of one hard-coded scrim: it takes the core's cave layer away from every instance and
//      lets each instance say what its light is. 'dark' leaves the overlay 16-instances already draws
//      exactly as it is; 'lamplit' leaves Deepholm's own lamplight alone; 'plain' paints nothing; 'day'
//      is new and is what Aerie gets -- sun, sky, rays and drifting cloud shadow.
//   2. "the sky city needs to be better populated with decoration and points of interest ... more
//      sprawling activities and uniques to it."  Aerie grows from 50 x 34 to 78 x 50 and gains three
//      levels: the Span (the old island), the Crown above it to the north-east, and the Underside
//      hanging below the drop, plus the spires east of both.
//   3. "maybe some agility stuff" -- the Spire Run, a six-flag lap over the spires at Agility 40.
//
// Why the Spire Run does not register with AGILITY.addCourse: 38-agility paints every registered flag and
// obstacle into the OVERWORLD in its HOOKS.world pass, every world generation. A course registered at load
// would be painted on the overworld the moment a new game regenerates the world -- stray flags at (56,26)
// in the Grey Quarry, and free laps for walking over them. So this file paints the run into Aerie's own
// tile array and runs its own laps, reusing 38's LOG / NET / GAP tiles for the look and 38's Agility skill
// and xp for the reward. quest.aerie holds the laps.
//
// Godly Plated: it stays exclusive to Halcyon's sky forge (36-skycity already moved the four recipes off
// Brakka's anvil at load). That is the right answer -- the Song is what makes dragon scale take a shape,
// and the Song is sung here. What was missing is that the anvil said nothing about it: a knight with eight
// dragon scales and Smithing 40 stood at Brakka's anvil and simply did not see the recipe. The anvil now
// says why, and Brakka says it too, and the Songstone on the Crown says it best.
//
// Wrapped by reassignment (each captures the previous binding):
//   render     -- while any instance is active, the core's starting-cave scrim is drawn into a scratch
//                 canvas instead of darkLayer, so it cannot land on the instance. Outside an instance
//                 nothing changes at all.
//   openPanel  -- opening an anvil with dragon scales in the pack explains where Godly plate is forged.
//   HOOKS.talkBefore.shop -- Brakka says the same thing, then his own shop line runs as it always did.
// State: quest.aerie (laps, best lap, the Songstone, the cloak, the snags and perches taken), reset in
// HOOKS.newGame. window.AERIE and window.INSTANCE_LIGHT are the handles for tests and later features.
// ============================================================================
{
  // =========================================================================
  // 1. INSTANCE_LIGHT -- lighting as a per-instance mode
  // =========================================================================
  const MODES = {};
  const declared = {};                       // instance id -> mode name
  const STATS = { frames: 0, blocked: 0, painted: 0, lastMode: null };
  const LAST = { mode: null, id: null, scrim: 0, warm: 0, rays: 0, shadows: 0, sun: null };

  function defineMode(name, def) { MODES[name] = Object.assign({ name, scrim: 0, blurb: '', draw: null }, def); return MODES[name]; }
  // 'dark'    -- 16-instances owns the overlay (drawDark: a 0.6 scrim with holes for the knight, torches and the exit)
  // 'lamplit' -- the feature owns the overlay (Deepholm draws its own lamps in 24-dwarves)
  // 'plain'   -- nothing paints; the tiles are the light (Tinkerton's Lab, the Afterlands, your island)
  // 'day'     -- this file paints sun, rays and cloud shadow (Aerie)
  defineMode('dark', { scrim: 0.6, blurb: 'Dungeon dark: one lamp of your own and whatever burns on the walls.' });
  defineMode('lamplit', { blurb: 'Underground, but lit: the place draws its own lamps.' });
  defineMode('plain', { blurb: 'No overlay: what you see is the floor.' });
  defineMode('day', { blurb: 'Open daylight above the clouds: sun, rays and drifting cloud shadow.', draw: (g, inst) => drawDay(g, inst) });

  const instOf = id => (window.INSTANCES && INSTANCES.get) ? INSTANCES.get(id) : null;
  const modeOf = id => { if (!id) return null; if (declared[id]) return declared[id]; const i = instOf(id); return i && i.dark ? 'dark' : 'plain'; };
  const setMode = (id, name) => { if (!MODES[name]) return false; declared[id] = name; return true; };

  // every instance that draws its own light says so, so the registry never guesses wrong
  setMode('deepholm', 'lamplit');

  // ---------- the day layer ----------
  function drawDay(g, inst) {
    const sx = VW * 0.78 - (cam.x % 400) * 0.05, sy = VH * 0.13 - (cam.y % 400) * 0.04;
    g.save(); g.setTransform(DPR, 0, 0, DPR, 0, 0);
    // the sun's warmth over everything
    g.globalCompositeOperation = 'lighter';
    const R = Math.max(VW, VH) * 0.95;
    const warm = g.createRadialGradient(sx, sy, 10, sx, sy, R);
    warm.addColorStop(0, 'rgba(255,244,214,0.20)'); warm.addColorStop(0.45, 'rgba(255,240,205,0.09)'); warm.addColorStop(1, 'rgba(255,240,205,0)');
    g.fillStyle = warm; g.fillRect(0, 0, VW, VH);
    // five long rays, turning slowly
    const rays = 5;
    for (let k = 0; k < rays; k++) {
      const a = 1.9 + k * 0.24 + Math.sin(time * 0.11 + k) * 0.05, w = 0.055;
      g.fillStyle = 'rgba(255,247,225,0.045)';
      g.beginPath(); g.moveTo(sx, sy);
      g.lineTo(sx + Math.cos(a - w) * R * 1.6, sy + Math.sin(a - w) * R * 1.6);
      g.lineTo(sx + Math.cos(a + w) * R * 1.6, sy + Math.sin(a + w) * R * 1.6);
      g.closePath(); g.fill();
    }
    // the sun itself
    const disc = g.createRadialGradient(sx, sy, 4, sx, sy, 96);
    disc.addColorStop(0, 'rgba(255,253,240,0.85)'); disc.addColorStop(0.25, 'rgba(255,240,190,0.35)'); disc.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = disc; g.beginPath(); g.arc(sx, sy, 96, 0, 7); g.fill();
    // cloud shadow drifting under the city, and the cold air off the drop at the bottom of the screen
    g.globalCompositeOperation = 'source-over';
    const shadows = 3;
    for (let k = 0; k < shadows; k++) {
      const px = ((time * (7 + k * 3) + k * 520 - cam.x * 0.35) % (VW + 700)) - 350, py = VH * (0.22 + k * 0.27);
      const sh = g.createRadialGradient(px, py, 20, px, py, 260);
      sh.addColorStop(0, 'rgba(108,142,196,0.085)'); sh.addColorStop(1, 'rgba(108,142,196,0)');
      g.fillStyle = sh; g.beginPath(); g.ellipse(px, py, 260, 120, 0, 0, 7); g.fill();
    }
    const drop = g.createLinearGradient(0, VH * 0.82, 0, VH);
    drop.addColorStop(0, 'rgba(150,186,236,0)'); drop.addColorStop(1, 'rgba(150,186,236,0.11)');
    g.fillStyle = drop; g.fillRect(0, VH * 0.82, VW, VH * 0.18);
    g.restore();
    STATS.painted++; STATS.lastMode = 'day';
    LAST.mode = 'day'; LAST.id = inst && inst.id; LAST.scrim = 0; LAST.warm = 0.20; LAST.rays = rays; LAST.shadows = shadows; LAST.sun = { x: Math.round(sx), y: Math.round(sy) };
  }

  HOOKS.draw.push((g, items) => {
    const id = window.INSTANCES && INSTANCES.active();
    if (!id) return;
    const m = MODES[modeOf(id)];
    if (m && m.draw) items.push({ y: 1e9, draw: () => m.draw(g, instOf(id)) }); // the same slot 16-instances uses for drawDark
  });

  // ---------- take the core's starting-cave scrim off every instance ----------
  const scratch = document.createElement('canvas');
  let suppressing = false;
  function clearDarkLayer() {
    try { const dg = darkLayer.getContext('2d'); if (!dg) return; dg.setTransform(1, 0, 0, 1, 0, 0); dg.clearRect(0, 0, darkLayer.width || 1, darkLayer.height || 1); } catch (e) { }
  }
  const _render = typeof render === 'function' ? render : null;
  if (_render) render = function () {
    STATS.frames++;
    const id = window.__instance;
    if (!id) { suppressing = false; return _render.apply(this, arguments); }
    if (!suppressing) { clearDarkLayer(); suppressing = true; }  // whatever the cave layer held before we came in
    const real = darkLayer.getContext;
    let asked = false;
    // 89-lighting stands its own sink in front of darkLayer while one of its scenes owns the screen (Deepholm,
    // the Spider Den, the coal road) and COUNTS what lands in it, so its suite can prove the core scrim was
    // swallowed. This wrapper is the inner one, so hand the paint on to that sink rather than our scratch and
    // the count stays honest; anywhere without a lighting scene (Aerie, the Lab) the scratch takes it as before.
    const sceneOwned = () => !!(window.LIGHTS && LIGHTS.activeScene && LIGHTS.activeScene());
    darkLayer.getContext = function (k) { asked = true; return sceneOwned() ? real.call(darkLayer, k) : scratch.getContext(k); };
    try { return _render.apply(this, arguments); }
    finally { darkLayer.getContext = real; if (asked) STATS.blocked++; }
  };

  window.INSTANCE_LIGHT = {
    MODES, define: defineMode, set: setMode, of: modeOf, stats: STATS, last: LAST,
    suppressing: () => suppressing,
    list: () => (window.INSTANCES ? INSTANCES.list() : []).map(id => ({ id, mode: modeOf(id), dark: !!(instOf(id) && instOf(id).dark) })),
  };

  // =========================================================================
  // 2. Aerie: the tiles this file adds
  // =========================================================================
  const SKY_C = window.SKYCITY || null;
  const AER = instOf('aerie');
  const UNDER = addTile('UNDERCLOUD', { tex: 'sand', mini: '#aebfd8' });             // the lower deck, in the city's own shadow
  const RAIL = addTile('SKY_RAIL', { solid: true, tex: 'sand', mini: '#cbd6e6' });   // the rail along the drop
  const NEST = addTile('NEST_HOUSE', { solid: true, tex: 'sand', mini: '#d8c69a' }); // a woven house
  const BRAZIER = addTile('SKY_BRAZIER', { solid: true, tex: 'sand', mini: '#ffd08a' });
  const STATUE = addTile('WIND_STATUE', { solid: true, tex: 'sand', mini: '#e6eef8' });
  const UPDRAFT = addTile('UPDRAFT', { solid: true, tex: 'sand', mini: '#bfe3ff' }); // the way between the three levels
  const PERCH = addTile('HAWK_PERCH', { solid: true, tex: 'sand', mini: '#c9a36a' });
  const SONG = addTile('SONGSTONE', { solid: true, tex: 'sand', mini: '#f5e6a8' });
  const SNAG = addTile('CLOUD_SNAG', { solid: true, tex: 'sand', mini: '#9aa6b8' }); // what the city drops, caught below
  const SPIRE = addTile('CLOUD_SPIRE', { solid: true, tex: 'sand', mini: '#dbe6f4' });
  const STALL = addTile('WIND_STALL', { solid: true, tex: 'sand', mini: '#c0906a' });
  const FLAG = addTile('SPIRE_FLAG', { tex: 'sand', mini: '#f5c542' });              // the Spire Run's own flag, walked over
  const MINE_TILES = [UNDER, RAIL, NEST, BRAZIER, STATUE, UPDRAFT, PERCH, SONG, SNAG, SPIRE, STALL, FLAG];
  const USABLE = [UPDRAFT, PERCH, SONG, SNAG, NEST, STATUE, BRAZIER];
  if (typeof INTERESTING_TILES !== 'undefined') for (const t of USABLE) INTERESTING_TILES.add(t);

  const AG_T = (window.AGILITY && AGILITY.TILES) || {};
  const LOG_T = AG_T.LOG, NET_T = AG_T.NET, GAP_T = AG_T.GAP;
  const RUN_LV = 40, RUN_XP = 340, RUN_PURSE = 60, RUN_EVERY = 5, CLOAK_LAPS = 10;
  // what waking the Songstone pays, once
  const SONG_XP = 250;

  // =========================================================================
  // 3. items only the sky has
  // =========================================================================
  Object.assign(ITEMS, {
    stormglass: { name: 'Stormglass', value: 520, color: '#9fd8ff', shape: 'rock' },
    skyhawk_feather: { name: 'Skyhawk feather', value: 180, color: '#f0e4c4', shape: 'silk' },
    skysinger: { name: 'Skysinger', value: 4200, color: '#bfe3ff', shape: 'sword', stack: 1, weapon: { str: 38, att: 36, cd: 0.5 } },
    skyhawk_arrow: { name: 'Skyhawk arrows', value: 14, color: '#e6d8b0', shape: 'arrow', arrow: { str: 18 } },
    gale_cloak: { name: 'Gale cloak', value: 900, color: '#7fb2e8', shape: 'cape', stack: 1, armour: { slot: 'cape', def: 7 } },
  });
  for (const k of ['stormglass', 'skyhawk_feather', 'skysinger', 'skyhawk_arrow', 'gale_cloak']) { ITEMS[k].id = k; if (!ITEMS[k].stack) ITEMS[k].stack = 50; }

  // Halcyon's second table: the Skysinger, once the Songstone is awake. Registered in RECIPES on the
  // 'skyforge' station so nothing else can make it, and forged from his panel (see the wrapper below).
  const SING = { out: 'skysinger', qty: 1, needs: [['stormglass', 3], ['dragon_scale', 4], ['mithril_bar', 2]], station: 'skyforge', skill: 'smithing', lv: 35, xp: 900, label: '3 Stormglass + 4 Dragon scales + 2 Mithril bars -> Skysinger' };
  RECIPES.push(SING);
  const FLETCH = { out: 'skyhawk_arrow', qty: 12, needs: [['skyhawk_feather', 1], ['wood', 1]], station: 'skyforge', skill: 'crafting', lv: 20, xp: 90, label: '1 Skyhawk feather + 1 Wood -> 12 Skyhawk arrows' };
  RECIPES.push(FLETCH);

  // ---------- their icons ----------
  // 80-icons audits every item for a drawing of its own; these five are the sky's. Silhouette first.
  if (window.ICONS && ICONS.set) {
    const OUT = 'rgba(0,0,0,0.45)';
    const pen = (g, c, w, cap) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = cap || 'butt'; g.lineJoin = 'round'; };
    ICONS.set('stormglass', (g, size, item) => {                   // a shard of sky glass: six facets with the storm still inside
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(0, -8.4); g.lineTo(6.4, -4); g.lineTo(6.4, 4); g.lineTo(0, 8.4); g.lineTo(-6.4, 4); g.lineTo(-6.4, -4); g.closePath(); g.fill();
      pen(g, OUT, 1.2); g.stroke();
      pen(g, 'rgba(0,0,0,0.22)', 1.0);                              // the facets
      g.beginPath(); g.moveTo(-6.4, -4); g.lineTo(0, -1); g.lineTo(6.4, -4); g.moveTo(0, -1); g.lineTo(0, 8.4); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.55)';                       // the light down the left face
      g.beginPath(); g.moveTo(-5.2, -3.6); g.lineTo(-1.2, -6.2); g.lineTo(-1.2, -2.2); g.lineTo(-5.2, 0.4); g.closePath(); g.fill();
      g.fillStyle = '#f6fbff';                                      // the bolt caught in it
      g.beginPath(); g.moveTo(2.4, -1.4); g.lineTo(0.2, 2.2); g.lineTo(1.8, 2.2); g.lineTo(-0.4, 6.2); g.lineTo(3.4, 1.2); g.lineTo(1.8, 1.2); g.closePath(); g.fill();
    });
    ICONS.set('skyhawk_feather', (g, size, item) => {              // a hawk's flight feather: barred, hooked at the tip, stood on its quill
      g.save(); g.rotate(0.9);
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-8, 1.2); g.quadraticCurveTo(-2, -5.4, 8.4, -2.4); g.quadraticCurveTo(7.4, 0.4, 5.4, 0.8);
      g.quadraticCurveTo(0.4, 3.8, -8, 1.2); g.closePath(); g.fill(); pen(g, OUT, 1.2); g.stroke();
      g.fillStyle = '#7a5a3a';                                      // the bars a hawk wears
      g.beginPath(); g.moveTo(-3.4, -1.6); g.lineTo(-1.4, -3.4); g.lineTo(-0.4, -1); g.lineTo(-2.4, 1.6); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(1.6, -3); g.lineTo(3.6, -3.6); g.lineTo(4.2, -1.4); g.lineTo(2.2, -0.2); g.closePath(); g.fill();
      pen(g, '#fffaf0', 1.3, 'round');                              // the shaft
      g.beginPath(); g.moveTo(-8.4, 1.4); g.lineTo(7.4, -2); g.stroke();
      g.fillStyle = '#e8e2d2'; g.fillRect(-9, 0.2, 2.4, 2.4);      // the quill end
      g.restore();
    });
    ICONS.set('skysinger', (g, size, item) => {                    // a slim blade that sings: three wind-holes down the fuller and a ring guard
      g.save(); g.rotate(-0.8);
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-2.4, -1.2); g.lineTo(8.4, -1); g.lineTo(10.4, 0); g.lineTo(8.4, 1); g.lineTo(-2.4, 1.2); g.closePath(); g.fill();
      pen(g, OUT, 1.2); g.stroke();
      g.fillStyle = '#3b5b80';                                      // the holes the wind plays
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0.6 + k * 2.8, 0, 1, 0, Math.PI * 2); g.fill(); }
      pen(g, '#eaf6ff', 1.6); g.beginPath(); g.arc(-4.4, 0, 2.4, 0, Math.PI * 2); g.stroke();   // the ring guard
      g.fillStyle = '#5a6a80'; g.fillRect(-9.2, -1.2, 3, 2.4);     // the grip
      g.fillStyle = '#f5c542'; g.beginPath(); g.arc(-9.6, 0, 1.2, 0, Math.PI * 2); g.fill();     // the pommel
      g.restore();
    });
    ICONS.set('skyhawk_arrow', (g, size, item) => {                // a broadhead on a pale shaft, fletched with the hawk's own barred feather
      g.save(); g.rotate(-0.75);
      pen(g, item.color, 2, 'butt'); g.beginPath(); g.moveTo(-8.4, 0); g.lineTo(5.4, 0); g.stroke();
      pen(g, OUT, 1); g.beginPath(); g.moveTo(-8.4, -1); g.lineTo(5.4, -1); g.moveTo(-8.4, 1); g.lineTo(5.4, 1); g.stroke();
      g.fillStyle = '#c9d1d9';                                      // the broadhead
      g.beginPath(); g.moveTo(9.4, 0); g.lineTo(4.4, -3); g.lineTo(5.4, 0); g.lineTo(4.4, 3); g.closePath(); g.fill(); pen(g, OUT, 1.1); g.stroke();
      g.fillStyle = '#f0e4c4';                                      // the vanes
      g.beginPath(); g.moveTo(-8.4, -0.6); g.quadraticCurveTo(-6, -4.2, -3.4, -1); g.lineTo(-3.4, 1); g.quadraticCurveTo(-6, 4.2, -8.4, 0.6); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#7a5a3a'; g.fillRect(-7, -2.6, 2, 5.2);       // the bar on the vane
      g.restore();
    });
    ICONS.set('gale_cloak', (g, size, item) => {                   // a cloak blown clean sideways, with the wind drawn in
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-7.4, -7.4); g.lineTo(-2.4, -7.4); g.quadraticCurveTo(6, -3, 9, 2.4);
      g.quadraticCurveTo(5, 1.6, 3, 4.4); g.quadraticCurveTo(0, 2, -2.4, 6.4); g.quadraticCurveTo(-4.4, 2, -7.4, 1.4); g.closePath(); g.fill();
      pen(g, OUT, 1.2); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.18)';                             // the fold in shadow
      g.beginPath(); g.moveTo(-6, -6); g.quadraticCurveTo(-3, -1, -5.6, 0.8); g.lineTo(-7, 1); g.lineTo(-7, -6.4); g.closePath(); g.fill();
      g.fillStyle = '#f5c542'; g.beginPath(); g.arc(-5, -8, 1.4, 0, Math.PI * 2); g.fill();      // the clasp
      pen(g, 'rgba(255,255,255,0.75)', 1.2, 'round');               // three streaks of gale
      g.beginPath(); g.moveTo(-8.6, -3.4); g.lineTo(-4.4, -3.8); g.moveTo(-8.8, 4.4); g.lineTo(-3.6, 4); g.moveTo(1.4, 7.8); g.lineTo(6.4, 6.6); g.stroke();
    });
  }

  SHOPS.aerie_market = {
    name: 'The Windward Market', rate: 0.75,
    stock: [['cloud_essence', 140], ['stormglass', 620]],
  };
  // No Wind flute on the stall: it lives on the knight's keyring now (68-questitems), and nobody reaches Aerie
  // without one, so a flute for sale was 300 coins taken and handed back with "Your pack is full." And no
  // rope: there is no rope item in the game, so that row never showed.
  // 61-markers hangs every shop on a mark. The market lives inside Aerie, which has no door tile — a knight goes
  // up from the wind shrine — so its mark goes on the shrine's step (the shrine itself already carries 'Way up').
  if (window.MARKERS && MARKERS.add && SKY_C && SKY_C.STEP_T) MARKERS.add({ x: SKY_C.STEP_T.x, y: SKY_C.STEP_T.y, kind: 'shop', label: SHOPS.aerie_market.name });

  // =========================================================================
  // 4. state
  // =========================================================================
  const fresh = () => ({ laps: 0, best: 0, songstone: false, cloak: false, next: 0, feathers: 0, snags: 0, essence: 0 });
  const Q = () => { let q = quest.aerie; if (!q || typeof q !== 'object') q = quest.aerie = fresh(); for (const k in fresh()) if (q[k] === undefined) q[k] = fresh()[k]; return q; };
  const REGROW = [];   // { tx, ty, t, left } while inside: snags and perches coming back
  HOOKS.newGame.push(() => { quest.aerie = fresh(); REGROW.length = 0; lastTile = null; });
  const inside = () => !!(window.INSTANCES && INSTANCES.active() === 'aerie');
  setMode('aerie', 'day');

  // =========================================================================
  // 5. the map: grow Aerie from 50 x 34 to 78 x 50, three levels
  // =========================================================================
  const NW = 78, NH = 50;
  const SPAN = { w: 50, h: 34 };                                   // the old island, kept exactly as 36-skycity built it
  const CROWN = { cx: 62, cy: 10, rx: 14, ry: 8.5, x0: 51 };       // above and north-east: the Rookery, the market, the Songstone
  const CATCH = { cx: 33, cy: 43, rx: 20, ry: 7.5, y0: 35 };       // below the drop: everything the city lets fall
  const ENTRY = [25, 30];
  // the four winds, named on their statues
  const STATUES = [[20, 20, 'Vireth, the north wind'], [30, 20, 'Sorrow, the east wind'], [52, 10, 'Halloa, the west wind'], [74, 10, 'The Last Wind, that has no name']];
  const NESTS = [[12, 14], [16, 10], [36, 10], [14, 22], [33, 25], [30, 28], [53, 8], [56, 11], [60, 13], [71, 12], [72, 6], [34, 41]];
  const BRAZIERS = [[23, 13], [27, 13], [57, 3], [66, 4], [70, 14]];
  const RAILS = [[21, 31], [22, 31], [27, 31], [28, 31], [60, 17], [61, 17], [62, 17], [63, 17], [64, 17], [30, 37], [31, 37], [35, 37], [36, 37]];
  const SPIRES = [[51, 14], [75, 7], [53, 29], [59, 29], [65, 29], [71, 29], [16, 46], [29, 48], [45, 47], [50, 40]];
  const ORGAN = [[19, 14], [20, 14], [21, 14]];
  const PERCHES = [[55, 7], [58, 5], [61, 7]];
  const STALLS = [[64, 13], [66, 13], [64, 15], [66, 15]];
  const SONG_T = [69, 9];
  const SNAGS = [[20, 44], [26, 41], [30, 46], [37, 40], [41, 45], [47, 42]];
  // the three ways between the levels: E on the tile, the wind sets you down on the far land tile
  const DRAFTS = [
    { t: [46, 17], land: [45, 17], to: 1, name: 'the Crown' },
    { t: [54, 15], land: [55, 15], to: 0, name: 'the Span' },
    { t: [24, 31], land: [24, 30], to: 3, name: 'the Underside' },
    { t: [24, 37], land: [24, 38], to: 2, name: 'the Span' },
    { t: [58, 18], land: [58, 17], to: 5, name: 'the Spire Run' },
    { t: [54, 26], land: [55, 26], to: 4, name: 'the Crown' },
  ];
  // the Spire Run: six flags, three beams, four gaps and a rope net, all at Agility 40 but the net
  const RUN_MARKS = [[56, 26], [63, 26], [69, 26], [69, 22], [63, 22], [56, 22]];
  const RUN_PLATES = [[53, 55, 25, 27], [55, 57, 25, 27], [62, 64, 25, 27], [68, 70, 25, 27], [68, 70, 21, 23], [62, 64, 21, 23], [55, 57, 21, 23]];
  const RUN_GAPS = [[58, 26], [69, 24], [61, 22], [56, 24]];
  const RUN_LOGS = [[59, 26], [60, 26], [61, 26], [65, 26], [66, 26], [67, 26], [60, 22], [59, 22], [58, 22]];
  const RUN_NETS = [[65, 22], [66, 22], [67, 22]];

  const CL = SKY_C ? SKY_C.CLOUD : T.CAVE, SKYT = SKY_C ? SKY_C.SKY : T.WALL;
  let TI = null;                                  // Aerie's own tile grid while we build it (never the live map)
  const gi = (x, y) => y * NW + x;
  const gset = (x, y, t) => { if (x >= 0 && y >= 0 && x < NW && y < NH) TI[gi(x, y)] = t; };
  const gat = (x, y) => (x >= 0 && y >= 0 && x < NW && y < NH) ? TI[gi(x, y)] : SKYT;
  const isDeck = t => t === CL || t === UNDER || t === T.FLOOR || t === FLAG;
  const ell = (x, y, e, wob) => { const dx = (x - e.cx) / e.rx, dy = (y - e.cy) / e.ry; return dx * dx + dy * dy <= 1 + Math.sin(x * 1.7 + y * 1.1) * (wob === undefined ? 0.09 : wob); };
  // a point of interest always stands on deck with deck around it, whatever the ragged edge did
  function pad(x, y, deck) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = gat(x + dx, y + dy); if (t === SKYT) gset(x + dx, y + dy, deck); } }
  function plant(x, y, t, deck) { pad(x, y, deck); gset(x, y, t); }

  function growAerie() {
    if (!AER || !SKY_C) return false;
    const old = AER.tiles, oldV = AER.vars, ow = AER.w, oh = AER.h;
    TI = new Uint8Array(NW * NH).fill(SKYT);
    const vars = new Uint8Array(NW * NH);
    const rnd = mulberry32(0x5171e ^ (NW * 7919) ^ NH);
    for (let i = 0; i < vars.length; i++) vars[i] = Math.floor(rnd() * 3);
    for (let y = 0; y < Math.min(oh, NH); y++) for (let x = 0; x < Math.min(ow, NW); x++) { TI[gi(x, y)] = old[y * ow + x]; vars[gi(x, y)] = oldV[y * ow + x]; }
    // the Crown, north-east and above
    for (let y = 1; y < 20; y++) for (let x = CROWN.x0; x < NW; x++) if (ell(x, y, CROWN)) gset(x, y, CL);
    // the Underside, hanging below the drop
    for (let y = CATCH.y0; y < NH; y++) for (let x = 0; x < NW; x++) if (ell(x, y, CATCH)) gset(x, y, UNDER);
    // the Spire Run's platforms, east of both
    for (const [x0, x1, y0, y1] of RUN_PLATES) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) gset(x, y, CL);
    // ---- the Span: what a city of winged people keeps at home ----
    for (const [x, y] of ORGAN) plant(x, y, STALL, CL);            // the wind organ shares the stall's frame, drawn as pipes
    for (const [x, y] of BRAZIERS) plant(x, y, BRAZIER, y >= CATCH.y0 ? UNDER : CL);
    for (const [x, y] of NESTS) plant(x, y, NEST, y >= CATCH.y0 ? UNDER : CL);
    for (const [x, y, ] of STATUES) plant(x, y, STATUE, CL);
    for (const [x, y] of RAILS) plant(x, y, RAIL, y >= CATCH.y0 ? UNDER : CL);
    for (const [x, y] of SPIRES) { pad(x, y, gat(x, y) === UNDER || y >= CATCH.y0 ? UNDER : CL); gset(x, y, SPIRE); }
    // ---- the Crown: the Rookery, the market, the Songstone ----
    for (const [x, y] of PERCHES) plant(x, y, PERCH, CL);
    for (const [x, y] of STALLS) plant(x, y, STALL, CL);
    for (let y = SONG_T[1] - 1; y <= SONG_T[1] + 1; y++) for (let x = SONG_T[0] - 1; x <= SONG_T[0] + 1; x++) gset(x, y, T.FLOOR);
    plant(SONG_T[0], SONG_T[1], SONG, CL);
    // ---- the Underside: the Catch ----
    for (const [x, y] of SNAGS) plant(x, y, SNAG, UNDER);
    // ---- the ways between ----
    for (const d of DRAFTS) { const deck = d.t[1] >= CATCH.y0 ? UNDER : CL; pad(d.land[0], d.land[1], deck); pad(d.t[0], d.t[1], deck); gset(d.land[0], d.land[1], deck); gset(d.t[0], d.t[1], UPDRAFT); }
    // ---- the Spire Run ----
    for (const [x, y] of RUN_GAPS) gset(x, y, GAP_T === undefined ? SKYT : GAP_T);
    for (const [x, y] of RUN_LOGS) gset(x, y, LOG_T === undefined ? CL : LOG_T);
    for (const [x, y] of RUN_NETS) gset(x, y, NET_T === undefined ? CL : NET_T);
    for (const [x, y] of RUN_MARKS) gset(x, y, FLAG);
    // hand the grown map back to the instance system
    AER.w = NW; AER.h = NH; AER.tiles = TI; AER.vars = vars;
    return true;
  }
  const GREW = growAerie();

  // =========================================================================
  // 6. the winged folk who were not here before
  // =========================================================================
  const FOLK = [
    { id: 'pell', name: 'Keeper Pell', x: 58, y: 8, tunic: '#6a7f5a', hair: '#3a2a1a', role: 'rookery', wing: 1.0, beard: true },
    { id: 'quill', name: 'Quill Windward', x: 65, y: 14, tunic: '#8a6a3a', hair: '#e8d9a0', role: 'market', wing: 1.0 },
    { id: 'skyla', name: 'Skyla Fleetwing', x: 55, y: 27, tunic: '#2b8c8c', hair: '#f0d0b0', role: 'runner', wing: 1.15, woman: true },
    { id: 'ferris', name: 'Old Ferris', x: 33, y: 43, tunic: '#5a6a7a', hair: '#d9d0c0', role: 'picker', wing: 0.8, beard: true },
  ];
  for (const n of FOLK) { n.px = tc(n.x); n.py = tc(n.y); n.facing = { x: 0, y: 1 }; }
  if (GREW) for (const n of FOLK) if (SOLID.has(AER.tiles[gi(n.x, n.y)])) AER.tiles[gi(n.x, n.y)] = n.y >= CATCH.y0 ? UNDER : CL;

  function folkInFront() {
    if (!inside()) return null;
    let best = null;
    for (const e of FOLK) {
      const d = dist(player.x, player.y, e.px, e.py); if (d > 96) continue;
      const dot = ((e.px - player.x) * player.facing.x + (e.py - player.y) * player.facing.y) / (d || 1);
      if (dot < 0.2 && d > 30) continue;
      if (!best || d < best.d) best = { e, d };
    }
    return best ? best.e : null;
  }
  const aerieFacing = PEOPLE_UI.facing(() => { const e = folkInFront(); return e ? { px: e.px, py: e.py, name: e.name } : null; });
  const songDone = () => !!(SKY_C && SKY_C.skyDone());

  function talkFolk(e) {
    { const dx = e.px - player.x, dy = e.py - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
    const q = Q();
    if (e.role === 'rookery') {
      say('The skyhawks hunt the lakes you came from. They will not take food from a hand, but they will take it from a perch.', e.name);
      say(`Put a fish on a perch and step back. What comes back down is a feather. I fletch with them: one feather and one log makes ${FLETCH.qty} Skyhawk arrows, and they fly like nothing you have shot.`, e.name);
      openPanel('rookery');
    } else if (e.role === 'market') {
      say('We have no iron up here and no fire that will hold it. What we have is cloud, and stormglass, and whatever the wind brings. Trade fair and I will trade fair.', e.name);
      openPanel('shop', 'aerie_market');
    } else if (e.role === 'runner') {
      const lv = window.AGILITY ? AGILITY.level() : skillLv('agility');
      if (lv < RUN_LV) say(`The Spire Run is six flags over the drop. Agility ${RUN_LV} before you try it -- below that the beams roll and the gaps do not forgive. You are ${lv}.`, e.name);
      else if (!q.cloak && q.laps < CLOAK_LAPS) say(`Six flags in order, then home to mine. ${RUN_XP} Agility for a lap, ${RUN_PURSE} coins every ${RUN_EVERY}. Run it ${CLOAK_LAPS} times and the Gale cloak is yours. You have run ${q.laps}.`, e.name);
      else if (!q.cloak) { q.cloak = true; giveOrDrop('gale_cloak', 1, player.x, player.y); say(`${CLOAK_LAPS} laps. Nobody down there has run this. Take the Gale cloak -- it was cut for a knight who never came back for it.`, e.name); levelBanner = { text: 'GALE CLOAK', sub: `${CLOAK_LAPS} laps of the Spire Run`, t: 3.5 }; sfx('quest'); burst(player.x, player.y, '#7fb2e8', 30, 160); save(); }
      else say(`${q.laps} laps. Your best is flag to flag without a fall ${q.best} times running. Go again.`, e.name);
    } else if (e.role === 'picker') {
      say('Everything this city drops comes to me. A thousand years of dropped things, snagged in the cloud. Most of it is wood and stone and somebody\'s dinner.', e.name);
      say('But stormglass forms down here where the lightning stops. Halcyon will not sing over anything else. Pull the snags -- they fill again, they always do.', e.name);
      if (countItem('stormglass') > 0) say('You have found some already. Keep it. I have all I need and no arms left to carry it.', e.name);
    }
  }
  TAP_PEOPLE.push(() => inside() ? FOLK.map(n => ({ x: n.px, y: n.py, r: 13, id: n.id, name: n.name, talk: () => talkFolk(n) })) : []);

  // =========================================================================
  // 7. what each point of interest pays
  // =========================================================================
  const FISH = () => player.inv.findIndex(s => s && ITEMS[s.id] && ITEMS[s.id].shape === 'fish');
  function usePerch(tx, ty) {
    const i = FISH();
    if (i < 0) { notify('The perch is empty. A skyhawk trades for fish, nothing else.'); return; }
    if (!canFit('skyhawk_feather', 1)) { notify('Your pack is full.'); return; }
    const id = player.inv[i].id, nm = ITEMS[id].name;
    removeItem(id, 1); setTile(tx, ty, CL); miniDirtyTiles.add(idx(tx, ty)); REGROW.push({ tx, ty, t: PERCH, left: 30 });
    giveOrDrop('skyhawk_feather', 1, player.x, player.y); Q().feathers++;
    burst(tc(tx), tc(ty) - 20, '#f0e4c4', 18, 120); sfx('pickup');
    floatText(tc(tx), tc(ty) - 34, `${nm} for a feather`, '#f0e4c4', 13); save();
  }
  // the Catch: what a thousand years of dropped things is worth, to the percent
  const SALVAGE = [
    { pct: 30, id: 'stormglass', n: 1, line: 'Stormglass. The lightning stopped here and went hard.' },
    { pct: 25, id: 'coins', n: [20, 60], line: 'Coins. Somebody leaned too far over the rail.' },
    { pct: 20, id: 'wood', n: 2, line: 'Two lengths of good wood, still dry.' },
    { pct: 15, id: 'stone', n: 2, line: 'Stone. It fell a long way and did not break.' },
    { pct: 7, id: 'skyhawk_feather', n: 1, line: 'A skyhawk feather, moulted and caught.' },
    { pct: 3, id: 'coins', n: [200, 200], line: 'A purse, and the knot still tied. Two hundred coins.' },
  ];
  function useSnag(tx, ty) {
    let r = Math.random() * 100, hit = SALVAGE[SALVAGE.length - 1];
    for (const s of SALVAGE) { if (r < s.pct) { hit = s; break; } r -= s.pct; }
    const n = Array.isArray(hit.n) ? hit.n[0] + Math.floor(Math.random() * (hit.n[1] - hit.n[0] + 1)) : hit.n;
    if (hit.id !== 'coins' && !canFit(hit.id, n)) { notify('Your pack is full.'); return; }
    setTile(tx, ty, UNDER); miniDirtyTiles.add(idx(tx, ty)); REGROW.push({ tx, ty, t: SNAG, left: 60 });
    giveOrDrop(hit.id, n, player.x, player.y); Q().snags++;
    burst(tc(tx), tc(ty), '#9aa6b8', 14, 90); sfx('pickup'); notify(hit.line); save();
  }
  function useSongstone() {
    const q = Q();
    if (!songDone()) { say('The stone hums under your hand and stops. It is waiting for a voice it knows, and yours is not it yet. Ask the Queen.', 'The Songstone'); return; }
    if (!q.songstone) {
      q.songstone = true;
      say('This is the stone the first Song was sung over. Dragon scale will not take a hammer cold -- no anvil in the Fanglands will move it. It takes the Song, and the Song lives here.', 'The Songstone');
      say('That is why Master Halcyon forges what nobody below can. The stone is awake now. Ask him for the Skysinger.', 'The Songstone');
      levelBanner = { text: 'THE SONGSTONE WAKES', sub: 'Halcyon can forge the Skysinger', t: 3.5 }; sfx('quest'); burst(player.x, player.y, '#f5e6a8', 34, 180); gainXp('smithing', SONG_XP); save();
    } else say('The stone is awake. Halcyon has what he needs.', 'The Songstone');
  }
  function rideDraft(tx, ty) {
    const i = DRAFTS.findIndex(d => d.t[0] === tx && d.t[1] === ty); if (i < 0) return false;
    const to = DRAFTS[DRAFTS[i].to];
    burst(player.x, player.y, '#dff0ff', 26, 200); sfx('open');
    player.x = tc(to.land[0]); player.y = tc(to.land[1]); player.action = null;
    burst(player.x, player.y, '#ffffff', 18, 140);
    notify(`The updraft takes you to ${DRAFTS[i].name}.`);
    return true;
  }

  // =========================================================================
  // 8. the Spire Run -- its own laps (see the header for why not AGILITY.addCourse)
  // =========================================================================
  const agLevel = () => window.AGILITY ? AGILITY.level() : skillLv('agility');
  const runStart = () => ({ x: tc(RUN_MARKS[0][0]), y: tc(RUN_MARKS[0][1]) });
  let lastTile = null;
  function touchFlag(i) {
    const q = Q(), N = RUN_MARKS.length - 1;
    if (i === 0) {
      if (q.next === N + 1) {
        q.laps += 1; q.next = 1; q.best = Math.max(q.best, q.laps);
        gainXp('agility', RUN_XP); floatText(player.x, player.y - 34, `Lap ${q.laps}! +${RUN_XP} Agility xp`, '#7ee787', 16); burst(player.x, player.y, '#7ee787', 18, 110); sfx('quest');
        if (q.laps % RUN_EVERY === 0) { giveOrDrop('coins', RUN_PURSE, player.x, player.y); notify(`${RUN_EVERY} laps of the Spire Run: ${RUN_PURSE} coins.`); }
        if (q.laps === CLOAK_LAPS && !q.cloak) notify(`${CLOAK_LAPS} laps. Skyla owes you a cloak.`);
        save();
      } else { q.next = 1; floatText(player.x, player.y - 34, q.next === 1 && q.laps === 0 ? 'Six flags, in order, then home' : 'Go!', '#f5c542', 14); }
    } else if (i === q.next) { q.next = i + 1; floatText(player.x, player.y - 34, `Flag ${i} of ${N}`, '#f5c542', 14); sfx('pickup'); }
    else if (q.next >= 1) floatText(player.x, player.y - 34, 'Wrong way', '#8b949e', 13);
  }
  function hitObstacle(t, tx, ty) {
    const lv = agLevel();
    if (t === LOG_T) {
      if (lv >= RUN_LV) return;
      const back = lastTile && !(lastTile.tx === tx && lastTile.ty === ty) ? lastTile : null;
      hurtPlayer(1, tc(tx), tc(ty), true); floatText(player.x, player.y - 40, `The beam rolls. Agility ${RUN_LV} for the Spire Run`, '#ff6b6b', 13); burst(player.x, player.y, '#8a5a2b', 8, 60);
      if (back && !player.dead) { const bx = tc(back.tx), by = tc(back.ty); if (!collides(bx, by, player.r, playerWho())) { player.x = bx; player.y = by; } }
    } else if (t === GAP_T) {
      if (lv >= RUN_LV) { floatText(player.x, player.y - 36, 'Jump!', '#8fb4ff', 13); return; }
      hurtPlayer(2, tc(tx), tc(ty) + 1, true); floatText(player.x, player.y - 40, `You fell! Agility ${RUN_LV} for the Spire Run`, '#ff6b6b', 13); burst(player.x, player.y, '#1c2230', 12, 80);
      const q = Q(); q.next = 0;
      if (!player.dead) { const s = runStart(); const spot = safeSpot(s.x, s.y, player.r, playerWho()) || s; player.x = spot.x; player.y = spot.y; player.action = null; }
    }
  }

  // ---------- the progression audit (42-playthrough reads HOOKS.xpSource) ----------
  // Every Agility and Smithing xp this file pays is declared here, or PLAYTHROUGH.sources() cannot see it.
  // A lap is timed the way 48-agility2 times its courses: the flag-to-flag loop at walking speed (175), with
  // the rope net crossed at climbing speed (60, 38-agility).
  const WALK_SPEED = 175, NET_SPEED = 60;
  const runLapSecs = () => {
    let tiles = 0;
    for (let i = 0; i < RUN_MARKS.length; i++) { const a = RUN_MARKS[i], b = RUN_MARKS[(i + 1) % RUN_MARKS.length]; tiles += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
    return tiles * TILE / WALK_SPEED + RUN_NETS.length * TILE * (1 / NET_SPEED - 1 / WALK_SPEED);
  };
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    add('agility', 'Aerie Spire Run (lap)', RUN_LV, RUN_XP, runLapSecs(), `the gaps and beams need Agility ${RUN_LV}; ${RUN_PURSE} coins every ${RUN_EVERY} laps`);
    add('smithing', 'the Songstone (once)', 1, SONG_XP, 0, 'wake it after the Song of Above');
    add('smithing', 'Skysinger on the sky forge', SING.lv, SING.xp, 0, `${SING.label}, once the Songstone is awake (Halcyon, no anvil)`);
  });

  // =========================================================================
  // 9. use, update
  // =========================================================================
  HOOKS.use.push((t, tx, ty) => {
    if (!inside()) return false;
    const n = folkInFront(); if (n) { talkFolk(n); return true; }
    if (t === UPDRAFT) return rideDraft(tx, ty);
    if (t === PERCH) { usePerch(tx, ty); return true; }
    if (t === SNAG) { useSnag(tx, ty); return true; }
    if (t === SONG) { useSongstone(); return true; }
    if (t === NEST) { notify('A woven house. Somebody is asleep in there, wings and all.'); return true; }
    if (t === BRAZIER) { notify('Cloud-fire. It gives light and no heat at all.'); return true; }
    if (t === STATUE) { const s = STATUES.find(v => v[0] === tx && v[1] === ty); say(s ? `${s[2]}. Carved by the winged folk, who name every wind they live on.` : 'A winged statue, worn smooth.', 'Wind statue'); return true; }
    if (t === RAIL) { notify('The rail at the edge. Below it: cloud, then the Fanglands, a long way down.'); return true; }
    if (t === SPIRE) { notify('A spire of cloud-stone, come up out of the drop.'); return true; }
    if (t === STALL) { notify('A stall of woven reed. Everything on it was traded up from below.'); return true; }
    if (t === UNDER) { notify('The Underside. The city is over your head from here.'); return true; }
    if (t === FLAG) { notify('A Spire Run flag. Walk over the six in order, then home to the first.'); return true; }
    return false;
  });

  HOOKS.update.push(dt => {
    if (!inside()) { if (REGROW.length) REGROW.length = 0; lastTile = null; return; }
    for (let i = REGROW.length - 1; i >= 0; i--) {
      const w = REGROW[i]; w.left -= dt;
      if (w.left <= 0 && !circleHitsTile(player.x, player.y, player.r + 2, w.tx, w.ty)) {
        setTile(w.tx, w.ty, w.t); miniDirtyTiles.add(idx(w.tx, w.ty)); burst(tc(w.tx), tc(w.ty), w.t === SNAG ? '#9aa6b8' : '#f0e4c4', 8, 50); REGROW.splice(i, 1);
      }
    }
    if (player.dead || player.mech) { lastTile = null; return; }
    const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE), t = tileAt(tx, ty);
    if (!lastTile || lastTile.tx !== tx || lastTile.ty !== ty) {
      if (t === FLAG) { const i = RUN_MARKS.findIndex(m => m[0] === tx && m[1] === ty); if (i >= 0) touchFlag(i); }
      else if (t === LOG_T || t === GAP_T) hitObstacle(t, tx, ty);
    }
    lastTile = { tx, ty };
  });

  // =========================================================================
  // 10. Halcyon's second table and the Rookery's fletching
  // =========================================================================
  const canMake = r => skillLv(r.skill) >= r.lv && r.needs.every(([id, n]) => countItem(id) >= n);
  function make(r) {
    if (skillLv(r.skill) < r.lv) { notify(`Needs ${r.skill === 'crafting' ? 'Crafting' : 'Smithing'} ${r.lv}.`); return false; }
    for (const [id, n] of r.needs) if (countItem(id) < n) { notify(`Need ${n} ${ITEMS[id].name}.`); return false; }
    const inv0 = player.inv.map(s => s ? { ...s } : null);
    for (const [id, n] of r.needs) removeItem(id, n);
    if (!canFit(r.out, r.qty)) { for (let i = 0; i < inv0.length; i++) player.inv[i] = inv0[i]; notify('Your pack is full.'); return false; }
    addItem(r.out, r.qty); gainXp(r.skill, r.xp); sfx('anvil');
    burst(player.x, player.y, ITEMS[r.out].color, 24, 130); floatText(player.x, player.y - 30, `+${r.qty} ${ITEMS[r.out].name}`, ITEMS[r.out].color);
    save(); return true;
  }
  // KEEPER PELL'S PERCHES: one row, the fletching (the arrows in a pouch, what they take as exact numbers, Fletch)
  const fletchRow = () => {
    const lvOk = skillLv('crafting') >= FLETCH.lv;
    return {
      id: FLETCH.out, name: `${ITEMS[FLETCH.out].name} × ${FLETCH.qty}`, sub: `${PEOPLE_UI.needsText(FLETCH.needs)}. They hit for ${ITEMS.skyhawk_arrow.arrow.str}.`,
      note: lvOk ? null : `Needs Crafting ${FLETCH.lv}. You are ${skillLv('crafting')}.`, noteColor: HK.T.bad,
      verb: { shown: 'Fletch', label: FLETCH.label, action: () => { make(FLETCH); }, tone: 'primary', enabled: canMake(FLETCH) },
    };
  };
  HOOKS.panel.rookery = (g, narrow) => {
    PEOPLE_UI.rowsPanel(g, { title: "Keeper Pell's perches", sub: `Crafting level ${skillLv('crafting')} · needs ${FLETCH.lv}`, intro: 'Put a fish on a perch outside and a skyhawk leaves a feather for it.', rows: [fletchRow()], want: 500 });
  };
  // Halcyon's own panel is 36-skycity's; the Skysinger is one more row on it once the Songstone is awake (until then, a line
  // on the sleeping stone), handed in as the panel's third argument so it is laid out, paged and sized with the others
  { const _halcyon = HOOKS.panel.halcyon;
    if (_halcyon) HOOKS.panel.halcyon = (g, narrow) => {
      const q = Q(), lvOk = skillLv('smithing') >= SING.lv;
      const row = !q.songstone
        ? { name: ITEMS[SING.out].name, nameColor: HK.T.inkMute, sub: 'The Songstone on the Crown is still asleep. Wake it and I will sing a blade.' }
        : {
          id: SING.out, name: ITEMS[SING.out].name, sub: PEOPLE_UI.needsText(SING.needs),
          note: lvOk ? null : `Needs Smithing ${SING.lv}. You are ${skillLv('smithing')}.`, noteColor: HK.T.bad,
          verb: { shown: 'Forge', label: SING.label + `  (lv ${SING.lv})`, action: () => { make(SING); }, tone: 'primary', enabled: canMake(SING) },
        };
      _halcyon(g, narrow, [row]);
    };
  }

  // =========================================================================
  // 11. the anvil path, reconciled: Godly plate is forged here and the anvil says so
  // =========================================================================
  let toldAnvil = false;
  const GODLY_LINE = 'Dragon scale will not take a hammer cold. Godly plate is forged on Master Halcyon\'s sky forge in Aerie, above the Grey Quarry.';
  { const _openPanel = openPanel;
    openPanel = function (name, arg) {
      const r = _openPanel.apply(this, arguments);
      if (name === 'station' && arg === 'anvil' && !toldAnvil && countItem('dragon_scale') > 0) { toldAnvil = true; notify(GODLY_LINE); }
      return r;
    };
  }
  { const _shop = HOOKS.talkBefore.shop;
    HOOKS.talkBefore.shop = n => {
      if (n && n.id === 'brakka' && countItem('dragon_scale') > 0) say(`Scale? Take it off my anvil. I have hit dragon scale until my arm gave out and never marked it. ${GODLY_LINE}`, n.name);
      return _shop ? _shop(n) : false;
    };
  }

  // =========================================================================
  // 12. drawing
  // =========================================================================
  const hash = (x, y) => ((Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0) / 4294967296;
  const underRegion = ty => ty >= CATCH.y0;
  function deck(g, tx, ty, low) {
    const x = tx * TILE, y = ty * TILE, r = hash(tx, ty);
    g.fillStyle = low ? '#c3d0e2' : '#eef3fa'; g.fillRect(x, y, TILE, TILE);
    g.fillStyle = low ? 'rgba(206,220,238,0.85)' : 'rgba(255,255,255,0.85)';
    for (const [ox, oy, rr] of [[12 + r * 8, 14, 12], [30, 22 + r * 6, 14], [20, 34, 11], [38, 10, 8]]) { g.beginPath(); g.arc(x + ox, y + oy, rr, 0, 7); g.fill(); }
    const solidish = t => t !== SKYT && t !== T.WALL && t !== GAP_T;
    if (!solidish(tileAt(tx, ty + 1))) { const gr = g.createLinearGradient(0, y + TILE - 14, 0, y + TILE); gr.addColorStop(0, 'rgba(120,160,220,0)'); gr.addColorStop(1, low ? 'rgba(84,116,176,0.6)' : 'rgba(110,150,215,0.55)'); g.fillStyle = gr; g.fillRect(x, y + TILE - 14, TILE, 14); }
    if (!solidish(tileAt(tx + 1, ty))) { g.fillStyle = 'rgba(120,160,220,0.3)'; g.fillRect(x + TILE - 6, y, 6, TILE); }
    if (!solidish(tileAt(tx - 1, ty))) { g.fillStyle = 'rgba(120,160,220,0.18)'; g.fillRect(x, y, 4, TILE); }
    if (low) { g.fillStyle = 'rgba(70,100,150,0.13)'; g.fillRect(x, y, TILE, TILE); }   // the city's shadow lies on the Underside
  }
  function drawRail(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = '#8e9bb0'; g.fillRect(x + 4, y + 26, 5, 20); g.fillRect(x + TILE - 9, y + 26, 5, 20);
    g.fillStyle = '#cbd6e6'; g.fillRect(x, y + 24, TILE, 5); g.fillRect(x, y + 34, TILE, 3);
    g.fillStyle = '#e9eef5'; g.fillRect(x + 2, y + 24, TILE - 4, 2);
  }
  function drawNest(g, tx, ty) {
    const cx = tc(tx), y = ty * TILE;
    g.fillStyle = 'rgba(60,90,140,0.25)'; g.beginPath(); g.ellipse(cx, y + 42, 20, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#b79a63'; g.beginPath(); g.ellipse(cx, y + 30, 21, 15, 0, 0, 7); g.fill();
    g.strokeStyle = '#8a7040'; g.lineWidth = 1.4;
    for (let k = 0; k < 6; k++) { const a = k * 1.05; g.beginPath(); g.ellipse(cx, y + 30, 21 - k * 1.5, 15 - k, a * 0.2, 0, 7); g.stroke(); }
    g.fillStyle = '#d8c69a'; g.beginPath(); g.ellipse(cx, y + 18, 17, 10, 0, 0, 7); g.fill();
    g.fillStyle = '#2a2f3a'; g.beginPath(); g.ellipse(cx, y + 22, 7, 5, 0, 0, 7); g.fill();   // the doorway
    g.fillStyle = '#f0e4c4'; g.beginPath(); g.arc(cx + 10, y + 14, 3, 0, 7); g.fill();        // a feather tucked in the weave
  }
  function drawBrazier(g, tx, ty) {
    const cx = tc(tx), y = ty * TILE, f = Math.sin(time * 5 + tx) * 2;
    g.fillStyle = 'rgba(60,90,140,0.22)'; g.beginPath(); g.ellipse(cx, y + 42, 12, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#8e9bb0'; g.fillRect(cx - 3, y + 22, 6, 20);
    g.fillStyle = '#cbd6e6'; g.beginPath(); g.moveTo(cx - 13, y + 18); g.lineTo(cx + 13, y + 18); g.lineTo(cx + 8, y + 26); g.lineTo(cx - 8, y + 26); g.closePath(); g.fill();
    const gr = g.createRadialGradient(cx, y + 12 + f, 2, cx, y + 12 + f, 20);
    gr.addColorStop(0, 'rgba(255,246,214,0.95)'); gr.addColorStop(0.5, 'rgba(191,227,255,0.5)'); gr.addColorStop(1, 'rgba(191,227,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, y + 12 + f, 20, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx, y + 12 + f, 4, 6 + f * 0.4, 0, 0, 7); g.fill();
  }
  function drawStatue(g, tx, ty) {
    const cx = tc(tx), y = ty * TILE;
    g.fillStyle = 'rgba(60,90,140,0.25)'; g.beginPath(); g.ellipse(cx, y + 44, 15, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#b9c6d8'; g.fillRect(cx - 12, y + 36, 24, 8);
    g.fillStyle = '#e6eef8'; g.fillRect(cx - 5, y + 12, 10, 26);
    g.beginPath(); g.arc(cx, y + 9, 6, 0, 7); g.fill();
    g.fillStyle = '#dfe8f4';
    for (const s of [-1, 1]) { g.save(); g.translate(cx, y + 18); g.scale(s, 1); g.beginPath(); g.moveTo(3, 0); g.quadraticCurveTo(20, -14, 24, -26); g.quadraticCurveTo(14, -14, 5, 8); g.closePath(); g.fill(); g.restore(); }
  }
  function drawSpire(g, tx, ty) {
    const cx = tc(tx), y = ty * TILE, r = hash(tx, ty);
    g.fillStyle = '#c3d2e6'; g.beginPath(); g.moveTo(cx - 14, y + TILE); g.lineTo(cx - 7, y + 4 + r * 8); g.lineTo(cx, y - 2); g.lineTo(cx + 8, y + 6 + r * 6); g.lineTo(cx + 15, y + TILE); g.closePath(); g.fill();
    g.fillStyle = '#e2ecf8'; g.beginPath(); g.moveTo(cx - 4, y + TILE); g.lineTo(cx, y - 2); g.lineTo(cx + 5, y + TILE); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(cx, y + 6, 11, 4, 0, 0, 7); g.fill();
  }
  function drawStall(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, organ = ORGAN.some(o => o[0] === tx && o[1] === ty);
    if (organ) {   // the wind organ: pipes the city talks through
      g.fillStyle = 'rgba(60,90,140,0.22)'; g.fillRect(x + 6, y + 40, TILE - 12, 5);
      const h = [30, 40, 24, 36, 20];
      for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? '#9fb0c6' : '#c6d3e4'; g.fillRect(x + 5 + k * 8, y + 44 - h[k], 6, h[k]); g.fillStyle = '#e9eef5'; g.fillRect(x + 5 + k * 8, y + 44 - h[k], 6, 3); }
      return;
    }
    g.fillStyle = 'rgba(60,90,140,0.22)'; g.fillRect(x + 4, y + 40, TILE - 8, 5);
    g.fillStyle = '#8a6a3a'; g.fillRect(x + 5, y + 20, 4, 24); g.fillRect(x + TILE - 9, y + 20, 4, 24);
    g.fillStyle = '#c0906a'; g.fillRect(x + 2, y + 12, TILE - 4, 10);
    g.fillStyle = '#e0b48a'; for (let k = 0; k < 4; k++) g.fillRect(x + 2 + k * 11, y + 12, 5, 10);
    g.fillStyle = '#6a5030'; g.fillRect(x + 6, y + 26, TILE - 12, 4);
    g.fillStyle = '#9fd8ff'; g.beginPath(); g.arc(x + 16, y + 24, 3, 0, 7); g.fill();
    g.fillStyle = '#f0e4c4'; g.beginPath(); g.arc(x + 30, y + 24, 3, 0, 7); g.fill();
  }
  function drawPerch(g, tx, ty) {
    const cx = tc(tx), y = ty * TILE;
    g.fillStyle = 'rgba(60,90,140,0.22)'; g.beginPath(); g.ellipse(cx, y + 44, 11, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#8a6a3a'; g.fillRect(cx - 3, y + 14, 6, 30);
    g.fillStyle = '#c9a36a'; g.fillRect(cx - 15, y + 10, 30, 5);
    const hasFish = FISH() >= 0;
    g.fillStyle = hasFish ? '#9fb7c9' : 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(cx, y + 6, 7, 3.5, 0, 0, 7); g.fill();
    if (!hasFish) { g.strokeStyle = 'rgba(240,228,196,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 9, y + 6); g.lineTo(cx + 9, y + 6); g.stroke(); }
  }
  function drawSong(g, tx, ty) {
    const cx = tc(tx), y = ty * TILE, q = Q(), lit = q.songstone ? 1 : 0.35;
    g.fillStyle = 'rgba(60,90,140,0.3)'; g.beginPath(); g.ellipse(cx, y + 44, 17, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#b9a97a'; g.beginPath(); g.moveTo(cx - 11, y + 44); g.lineTo(cx - 7, y - 6); g.lineTo(cx + 7, y - 6); g.lineTo(cx + 11, y + 44); g.closePath(); g.fill();
    g.fillStyle = '#d8c894'; g.fillRect(cx - 4, y - 4, 4, 46);
    g.strokeStyle = `rgba(245,230,168,${0.35 + lit * (0.35 + Math.sin(time * 2.2) * 0.25)})`; g.lineWidth = 2.4; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const a = time * 0.9 + k * 2.1; g.beginPath(); g.arc(cx, y + 16, 15 + k * 7, a, a + 1.7); g.stroke(); }
    if (q.songstone) { g.fillStyle = 'rgba(255,250,220,0.85)'; g.beginPath(); g.arc(cx, y + 16, 4 + Math.sin(time * 3) * 1.2, 0, 7); g.fill(); }
  }
  function drawSnag(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, r = hash(tx, ty);
    g.fillStyle = 'rgba(50,75,120,0.3)'; g.beginPath(); g.ellipse(x + 24, y + 42, 17, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#8a7a68'; g.fillRect(x + 8, y + 26, 20, 6); g.fillRect(x + 20, y + 32, 18, 5);
    g.fillStyle = '#6f7a88'; g.beginPath(); g.arc(x + 16, y + 36, 7, 0, 7); g.fill();
    g.fillStyle = '#9fd8ff'; g.beginPath(); g.moveTo(x + 30, y + 30); g.lineTo(x + 36, y + 16 + r * 5); g.lineTo(x + 40, y + 31); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(230,240,255,0.65)'; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { const yy = y + 20 + k * 8; g.beginPath(); g.moveTo(x + 4, yy); g.quadraticCurveTo(x + 24, yy - 5 + Math.sin(time + k + tx) * 2, x + 44, yy); g.stroke(); }
  }
  function drawDraft(g, tx, ty) {
    const cx = tc(tx), y = ty * TILE;
    g.fillStyle = 'rgba(60,90,140,0.2)'; g.beginPath(); g.ellipse(cx, y + 44, 14, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#cbd6e6'; g.beginPath(); g.moveTo(cx - 13, y + 44); g.lineTo(cx - 8, y + 22); g.lineTo(cx + 8, y + 22); g.lineTo(cx + 13, y + 44); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(191,227,255,0.85)'; g.lineWidth = 2.4; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const ph = (time * 0.9 + k * 0.25) % 1, yy = y + 30 - ph * 40, w = 9 - ph * 4;
      g.globalAlpha = 1 - ph; g.beginPath(); g.moveTo(cx - w, yy); g.quadraticCurveTo(cx, yy - 6, cx + w, yy); g.stroke();
    }
    g.globalAlpha = 1;
    if (dist(player.x, player.y, cx, tc(ty)) < 150) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(`Updraft - ${keyName('E')}`, cx, y - 6); g.fillStyle = '#ffe9a8'; g.fillText(`Updraft - ${keyName('E')}`, cx, y - 6); }
  }
  function drawFlag(g, tx, ty) {
    const x = tx * TILE, y = ty * TILE, q = Q();
    const i = RUN_MARKS.findIndex(m => m[0] === tx && m[1] === ty), N = RUN_MARKS.length - 1;
    const next = q.next === i || (i === 0 && q.next === N + 1), pulse = next ? 1 + Math.sin(time * 6) * 0.12 : 1;
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.arc(x + TILE / 2, y + TILE / 2, 14, 0, 7); g.fill();
    g.fillStyle = '#8e9bb0'; g.fillRect(x + 18, y + 8, 3, 34);
    g.fillStyle = i === 0 ? '#3fb950' : next ? '#ffd166' : '#f5c542';
    g.beginPath(); g.moveTo(x + 21, y + 8); g.lineTo(x + 21 + 20 * pulse, y + 14); g.lineTo(x + 21, y + 20); g.closePath(); g.fill();
    g.fillStyle = '#1b1f27'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText(i === 0 ? 'S' : String(i), x + 27, y + 17);
  }
  function drawFolk(g, n) {
    const e = { x: n.px, y: n.py, r: 13, facing: n.facing, hurtT: 0, attackT: 0, moving: false, walkT: 0 };
    const near = dist(player.x, player.y, e.x, e.y) < 110;
    if (near) e.facing = { x: Math.sign(player.x - e.x) || 0, y: Math.sign(player.y - e.y) || 1 };
    const hover = Math.sin(time * 1.8 + n.x) * 1.5;
    g.save(); g.translate(e.x, e.y + hover);
    g.fillStyle = 'rgba(80,110,170,0.25)'; g.beginPath(); g.ellipse(0, 12 - hover, 12, 5, 0, 0, 7); g.fill();
    wings(g, n.wing, Math.sin(time * 1.6 + n.x) * 0.15);
    drawHuman(g, e, { tunic: n.tunic, hair: n.hair, woman: n.woman, beard: n.beard, shoulder: '#7a8aa0', skin: '#f0d8c0' });
    g.restore();
    if (near) { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(n.name, e.x, e.y - 28); g.fillStyle = '#ffe9a8'; g.fillText(n.name, e.x, e.y - 28); }
  }
  function wings(g, scale, flap) {
    g.save(); g.scale(scale, scale); g.translate(0, -2);
    for (const s of [-1, 1]) {
      g.save(); g.scale(s, 1); g.rotate(-flap);
      g.fillStyle = '#f4f0e0'; g.strokeStyle = '#c9b676'; g.lineWidth = 0.8;
      for (let f = 0; f < 4; f++) { const a = -0.25 - f * 0.3, L = 24 - f * 4; const ex = 9 + Math.cos(a) * L, ey = Math.sin(a) * L;
        g.beginPath(); g.moveTo(9, 0); g.quadraticCurveTo(9 + Math.cos(a) * L * 0.55, Math.sin(a) * L * 0.55 - 5, ex, ey); g.quadraticCurveTo(9 + Math.cos(a) * L * 0.55 + 2, Math.sin(a) * L * 0.55 + 3, 9, 4); g.closePath(); g.fill(); g.stroke(); }
      g.restore();
    }
    g.restore();
  }
  // skyhawks over the spires: they belong to the place and nothing else
  const HAWKS = [[62, 8, 9, 4.5, 0.5], [66, 24, 7, 3.5, -0.7], [30, 40, 8, 4, 0.35], [24, 16, 6, 3, -0.45], [56, 24, 5, 2.5, 0.8]];
  function drawHawk(g, h, k) {
    const a = time * h[4] + k * 1.7, x = tc(h[0]) + Math.cos(a) * h[2] * TILE * 0.5, y = tc(h[1]) + Math.sin(a) * h[3] * TILE * 0.5;
    const flap = Math.sin(time * 6 + k) * 0.5;
    g.save(); g.translate(x, y - 40);
    g.fillStyle = 'rgba(40,60,100,0.18)'; g.beginPath(); g.ellipse(0, 44, 9, 3, 0, 0, 7); g.fill();
    g.fillStyle = '#6b5a45'; g.beginPath(); g.ellipse(0, 0, 5, 3, 0, 0, 7); g.fill();
    g.strokeStyle = '#8a7660'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-2, -1); g.quadraticCurveTo(-11, -4 - flap * 5, -18, 1 + flap * 3); g.stroke();
    g.beginPath(); g.moveTo(2, -1); g.quadraticCurveTo(11, -4 - flap * 5, 18, 1 + flap * 3); g.stroke();
    g.restore();
  }

  const COURSE_T = new Set([LOG_T, NET_T].filter(t => t !== undefined));
  HOOKS.draw.push((g, items, cam2) => {
    const c = cam2 || cam;
    if (!inside()) return;
    const x0 = Math.max(0, Math.floor(c.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((c.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(c.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((c.y + VH) / TILE) + 2);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty); if (t === SKYT) continue;
      const outside36 = tx >= SPAN.w || ty >= SPAN.h;   // 36-skycity paints everything past 50 x 34 as open sky
      const low = underRegion(ty);
      // the deck under everything this file put down, and under the old file's blind spot
      if (t === UNDER || t === RAIL || t === NEST || t === BRAZIER || t === STATUE || t === UPDRAFT || t === PERCH || t === SONG || t === SNAG || t === STALL || t === FLAG || COURSE_T.has(t) || (outside36 && t !== GAP_T))
        items.push({ y: -1e8 + ty * TILE + 0.001, draw: () => deck(g, tx, ty, low) });
      if (t === RAIL) items.push({ y: ty * TILE + TILE - 10, draw: () => drawRail(g, tx, ty) });
      else if (t === NEST) items.push({ y: ty * TILE + TILE - 4, draw: () => drawNest(g, tx, ty) });
      else if (t === BRAZIER) items.push({ y: ty * TILE + TILE - 4, draw: () => drawBrazier(g, tx, ty) });
      else if (t === STATUE) items.push({ y: ty * TILE + TILE - 4, draw: () => drawStatue(g, tx, ty) });
      else if (t === SPIRE) items.push({ y: ty * TILE + TILE - 4, draw: () => drawSpire(g, tx, ty) });
      else if (t === STALL) items.push({ y: ty * TILE + TILE - 4, draw: () => drawStall(g, tx, ty) });
      else if (t === PERCH) items.push({ y: ty * TILE + TILE - 4, draw: () => drawPerch(g, tx, ty) });
      else if (t === SONG) items.push({ y: ty * TILE + TILE - 4, draw: () => drawSong(g, tx, ty) });
      else if (t === SNAG) items.push({ y: ty * TILE + TILE - 4, draw: () => drawSnag(g, tx, ty) });
      else if (t === UPDRAFT) items.push({ y: ty * TILE + TILE - 4, draw: () => drawDraft(g, tx, ty) });
      else if (t === FLAG) items.push({ y: -1e8 + ty * TILE + 0.9, draw: () => drawFlag(g, tx, ty) });
    }
    for (const n of FOLK) if (n.px > c.x - 60 && n.px < c.x + VW + 60 && n.py > c.y - 60 && n.py < c.y + VH + 60) items.push({ y: n.py + 13, draw: () => drawFolk(g, n) });
    HAWKS.forEach((h, k) => items.push({ y: 5e7 + k, draw: () => drawHawk(g, h, k) }));
    // the use highlight for this file's tiles and people (the core only knows its own)
    if (!player.dead && !player.mech && !npcInFront()) items.push({ y: 1e9 + 4, draw: () => {
      // the winged folk you face: the kit's gold corners (PEOPLE_UI adds the verb tag and the TALK seat)
      if (PEOPLE_UI.brackets(g, aerieFacing())) return;
      const { tx, ty } = frontTile(player);
      if (USABLE.includes(tileAt(tx, ty))) { HK.brackets(g, tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4); }
    } });
  });

  // =========================================================================
  // 13. the book
  // =========================================================================
  if (window.WIKI) {
    const P = t => ({ t });
    WIKI.add('items', { id: 'stormglass', lines: [
      'Stormglass. Where the lightning stops it goes hard, and it settles under Aerie.',
      'Only from the snags on the Underside, the shelf below the sky city: 30 out of every 100 pulls. Quill Windward sells it at 620 coins when he has any.',
      'Master Halcyon sings over it. Nothing below the clouds will melt it.' ] });
    WIKI.add('items', { id: 'skyhawk_feather', lines: [
      'A skyhawk feather. The hawks of Aerie will not take food from a hand, only from a perch.',
      'Put any fish on one of the three perches at the Rookery on the Crown: one fish, one feather.',
      'Also 7 out of every 100 pulls on the Underside snags.',
      `Keeper Pell fletches ${FLETCH.qty} Skyhawk arrows from one feather and one wood (Crafting ${FLETCH.lv}).` ] });
    WIKI.add('items', { id: 'skysinger', lines: [
      `Skysinger. Strength +${ITEMS.skysinger.weapon.str}, accuracy +${ITEMS.skysinger.weapon.att}, a swing every ${ITEMS.skysinger.weapon.cd}s.`,
      `Forged by Master Halcyon on the sky forge, and nowhere else: ${SING.needs.map(([id, n]) => n + ' ' + ITEMS[id].name).join(', ')}, Smithing ${SING.lv}, ${SING.xp} xp.`,
      'He will not start until the Songstone on the Crown is awake. Sing the Song of Above first, then put your hand on the stone.' ] });
    WIKI.add('items', { id: 'skyhawk_arrow', lines: [
      `Skyhawk arrows. Strength +${ITEMS.skyhawk_arrow.arrow.str}, the hardest-hitting arrow in the Fanglands.`,
      `Keeper Pell at the Rookery, in Aerie: 1 Skyhawk feather + 1 Wood makes ${FLETCH.qty}, Crafting ${FLETCH.lv}.` ] });
    WIKI.add('items', { id: 'gale_cloak', lines: [
      `The Gale cloak. Defence +${ITEMS.gale_cloak.armour.def}, worn in the cape slot.`,
      `Skyla Fleetwing hands it over after ${CLOAK_LAPS} laps of the Spire Run in Aerie. It is not a skill cape and has no skill trick: it is what the runners wear.` ] });
    WIKI.add('quests', { id: 'spire_run', name: 'The Spire Run', lines: [
      `Aerie's own course: six flags over the spires east of the Crown, at Agility ${RUN_LV}.`,
      'Ride the updraft from the Crown at (58,18). Skyla Fleetwing stands at the start.',
      `Touch the six flags in order and come home to the first: ${RUN_XP} Agility xp a lap, ${RUN_PURSE} coins every ${RUN_EVERY} laps, and the Gale cloak at ${CLOAK_LAPS}.`,
      `Below Agility ${RUN_LV} the beams roll you off for 1 damage and the gaps drop you back to the start for 2.` ] });
    void P;
  }

  // =========================================================================
  // 14. handle
  // =========================================================================
  window.AERIE = {
    TILES: { UNDER, RAIL, NEST, BRAZIER, STATUE, UPDRAFT, PERCH, SONG, SNAG, SPIRE, STALL, FLAG },
    W: NW, H: NH, SPAN, CROWN, CATCH, FOLK, DRAFTS, RUN_MARKS, RUN_GAPS, RUN_LOGS, RUN_NETS, PERCHES, SNAGS, SONG_T, STATUES, NESTS, STALLS, SPIRES, BRAZIERS, RAILS, ORGAN,
    SALVAGE, SING, FLETCH, RUN_LV, RUN_XP, RUN_PURSE, RUN_EVERY, CLOAK_LAPS, SONG_XP, GODLY_LINE, runLapSecs,
    Q, talk: talkFolk, inFront: folkInFront, grew: () => GREW, regrow: REGROW,
    touchFlag, useSnag, usePerch, useSongstone, rideDraft, make, MINE_TILES,
  };

  // =========================================================================
  // 15. self-test
  // =========================================================================
  HOOKS.selfTest.push((check, F, h) => {
    const A = 'aerie2: ';
    const drain = () => { dialog.queue.length = 0; dialog.cur = null; };
    const tileOf = () => ({ tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) });
    const makeRoom = n => { h.clearJunk(); for (let i = player.inv.length - 1; i >= 0 && player.inv.filter(s => !s).length < n; i--) { const s = player.inv[i]; if (s && s.id !== 'coins' && !ITEMS[s.id].weapon && !ITEMS[s.id].armour && !ITEMS[s.id].tool) player.inv[i] = null; } };
    const give = (id, n) => { makeRoom(2); while (countItem(id) < n) { if (h.give(id, 1) > 0) { makeRoom(2); if (h.give(id, 1) > 0) break; } } };
    const strip = id => { while (countItem(id) > 0) removeItem(id, countItem(id)); };
    // a recording canvas: every overlay item is run against it, so what each instance paints can be counted
    const recorder = () => { const log = []; const g = new Proxy({}, {
      get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : typeof k === 'string' ? (() => { log.push(k); }) : undefined,
      set: (t, k) => { log.push('set:' + String(k)); return true; } }); return { g, log }; };
    const overlays = () => { const { g, log } = recorder(); const items = []; for (const hh of HOOKS.draw) { try { hh(g, items, cam); } catch (e) { } }
      // an overlay layer is anything in the band just above 1e9, or 89-lighting's own scrim, which sits at 1e9 - 1 (tagged
      // lightingScrim) so chat bubbles draw over the dark. A chat bubble (74-chat, also at 1e9) is words, not an overlay.
      const top = items.filter(i => i.lightingScrim || (i.y >= 1e9 && i.y < 1e9 + 0.5 && !i.bubble)); for (const it of top) { try { it.draw(); } catch (e) { } } return { n: top.length, log }; };

    h.peace(true); closePanel(); drain(); if (INSTANCES.active()) INSTANCES.leave();
    // a hired companion follows at the knight's heel, and 21-companion's use hook opens its panel for any
    // E pressed while it stands in front -- which would swallow every E in this file's checks. Sit it down.
    const comp = (player.companion && typeof player.companion === 'object') ? player.companion : null;
    const compDown = comp ? comp.downT : 0; if (comp) comp.downT = 999;
    const px0 = player.x, py0 = player.y, hp0 = player.hp, aq0 = JSON.stringify(Q());
    const ag0 = player.skills.agility ? player.skills.agility.xp : 0, sm0 = player.skills.smithing.xp, cr0 = player.skills.crafting.xp;
    const inst = id => INSTANCES.get(id);

    // ---- 1. lighting is a per-instance mode, and every instance declares one ----
    { const rows = INSTANCE_LIGHT.list();
      const allDeclared = rows.every(r => !!INSTANCE_LIGHT.MODES[r.mode]);
      const darkStillDark = rows.filter(r => r.dark).every(r => r.mode === 'dark');
      const days = rows.filter(r => r.mode === 'day').map(r => r.id);
      check(A + 'lighting is per instance: every instance declares a mode, every dark one is still "dark", Deepholm is "lamplit", and Aerie alone is "day"',
        rows.length >= 5 && allDeclared && darkStillDark && INSTANCE_LIGHT.of('deepholm') === 'lamplit' && INSTANCE_LIGHT.of('aerie') === 'day' && days.join(',') === 'aerie' && INSTANCE_LIGHT.MODES.dark.scrim === 0.6 && INSTANCE_LIGHT.MODES.day.draw && !INSTANCE_LIGHT.MODES.dark.draw,
        { rows, days }); }

    // ---- 2. the core's starting-cave scrim: still on the overworld cave, off every instance ----
    { const S = INSTANCE_LIGHT.stats;
      F.tp(5, 7); const b0 = S.blocked, p0 = S.painted; render();
      const overworldKept = S.blocked === b0 && S.painted === p0 && !INSTANCE_LIGHT.suppressing() && isCaveTile(5, 7);
      INSTANCES.enter('spider_den'); F.tp(10, 5); const b1 = S.blocked, p1 = S.painted; render();
      const denBlocked = S.blocked > b1 && S.painted === p1 && INSTANCE_LIGHT.suppressing();
      const denOverlay = overlays(); INSTANCES.leave();
      const dh = INSTANCES.enter('deepholm'); let dhOverlay = { n: -1 }, dhPainted = 0;
      if (dh) { F.tp(6, 6); const p2 = S.painted; render(); dhPainted = S.painted - p2; dhOverlay = overlays(); INSTANCES.leave(); }
      check(A + 'the core cave scrim stays on the overworld cave and is taken off every instance; the dark overlays themselves are untouched (Spider Den 1 layer, Deepholm 1 layer, neither painted by the day mode)',
        overworldKept && denBlocked && denOverlay.n === 1 && inst('spider_den').dark === true && dhOverlay.n === 1 && dhPainted === 0 && inst('deepholm').dark === false,
        { overworldKept, denBlocked, den: denOverlay.n, deepholm: dhOverlay.n, dhPainted, blocked: S.blocked }); }

    // ---- 3. Aerie reads as daylight ----
    { const S = INSTANCE_LIGHT.stats;
      INSTANCES.enter('aerie'); F.tp(20, 6); const b = S.blocked, p = S.painted; render();
      const L = INSTANCE_LIGHT.last, over = overlays();
      check(A + 'Aerie is lit as open daylight: sun, 5 rays and 3 drifting cloud shadows, no scrim at all, and the cave rectangle no longer lands on the great hall',
        S.painted > p && S.blocked > b && L.mode === 'day' && L.id === 'aerie' && L.scrim === 0 && L.warm > 0 && L.rays === 5 && L.shadows === 3 && !!L.sun && over.n === 1 && inst('aerie').dark === false,
        { painted: S.painted - p, blocked: S.blocked - b, last: L, overlays: over.n }); }

    // ---- 4. the city sprawls over three levels and the old island is untouched ----
    { const W = AERIE.W, H = AERIE.H, a = inst('aerie');
      let cloud = 0, sky = 0, floor = 0, wisps = 0, under = 0, crown = 0, mine = 0;
      const S = SKYCITY;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = tileAt(x, y);
        if (x < 50 && y < 34) { if (t === S.CLOUD) cloud++; else if (t === S.SKY) sky++; else if (t === T.FLOOR) floor++; else if (t === S.WISP) wisps++; }
        if (t === AERIE.TILES.UNDER) under++;
        if (x >= 51 && y < 20 && t === S.CLOUD) crown++;
        if (AERIE.MINE_TILES.includes(t)) mine++; }
      check(A + 'Aerie grew from 50x34 to 78x50 with three levels — the Span kept every tile 36-skycity built (cloud, sky, marble, 3 wisps, the leap), the Crown above it, the Underside below the drop',
        AERIE.grew() && a.w === 78 && a.h === 50 && cloud > 800 && sky > 300 && floor > 150 && wisps === 3 && tileAt(25, 31) === S.LEAP && under > 250 && crown > 200 && mine > 60,
        { w: a.w, h: a.h, cloud, sky, floor, wisps, under, crown, mine }); }

    // ---- 5. every point of interest exists and is reachable on foot from its landing ----
    { const D = AERIE.DRAFTS, T2 = AERIE.TILES;
      const legs = [[25, 30, D[0].land[0], D[0].land[1]], [25, 30, D[2].land[0], D[2].land[1]],
        [D[1].land[0], D[1].land[1], 58, 8], [D[1].land[0], D[1].land[1], 69, 10], [D[1].land[0], D[1].land[1], 65, 14], [D[1].land[0], D[1].land[1], D[4].land[0], D[4].land[1]],
        [D[5].land[0], D[5].land[1], 56, 26], [D[3].land[0], D[3].land[1], 33, 43]];
      const walked = legs.map(([ax, ay, bx, by]) => !!F.bfs(ax, ay, bx, by));
      const beside = (x, y) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => !SOLID.has(tileAt(x + dx, y + dy)));
      const perches = AERIE.PERCHES.every(([x, y]) => tileAt(x, y) === T2.PERCH && beside(x, y));
      const snags = AERIE.SNAGS.every(([x, y]) => tileAt(x, y) === T2.SNAG && beside(x, y));
      const drafts = D.every(d => tileAt(d.t[0], d.t[1]) === T2.UPDRAFT && !SOLID.has(tileAt(d.land[0], d.land[1])));
      const props = AERIE.STATUES.every(([x, y]) => tileAt(x, y) === T2.STATUE) && AERIE.NESTS.every(([x, y]) => tileAt(x, y) === T2.NEST) && AERIE.BRAZIERS.every(([x, y]) => tileAt(x, y) === T2.BRAZIER) && AERIE.RAILS.every(([x, y]) => tileAt(x, y) === T2.RAIL) && AERIE.SPIRES.every(([x, y]) => tileAt(x, y) === T2.SPIRE) && AERIE.STALLS.concat(AERIE.ORGAN).every(([x, y]) => tileAt(x, y) === T2.STALL);
      check(A + 'every point of interest is on the map and reachable: the Rookery perches, the Songstone, the market, the Catch snags, the six updraft stones, and 4 statues / 12 nests / 5 braziers / 13 rails / 10 spires / 7 stalls of decoration',
        walked.every(Boolean) && perches && snags && drafts && props && FOLK.length === 4 && tileAt(AERIE.SONG_T[0], AERIE.SONG_T[1]) === T2.SONG,
        { walked, perches, snags, drafts, props }); }

    // ---- 6. the updraft stones carry you between the three levels, both ways ----
    { const D = AERIE.DRAFTS; const hops = [], said = [];
      for (const m of monsters) { m.x = tc(74); m.y = tc(4); m.wanderT = 9; m.wander = { x: 0, y: 0 }; }  // a sentinel standing on the landing would shove the knight a tile
      for (let i = 0; i < D.length; i++) { const to = D[D[i].to];
        closePanel(); drain(); notice = null; F.tp(D[i].land[0], D[i].land[1]); F.face(D[i].t[0], D[i].t[1]); F.press('KeyE'); F.sim(1, []);
        const at = tileOf();
        hops.push(Math.abs(at.tx - to.land[0]) <= 1 && Math.abs(at.ty - to.land[1]) <= 1);
        said.push(!!notice && notice.text === `The updraft takes you to ${D[i].name}.`); }
      check(A + 'each of the six updraft stones sets you down on its partner: the Span to the Crown, the Span to the Underside, the Crown to the Spire Run, and back',
        hops.length === 6 && hops.every(Boolean) && said.every(Boolean), { hops, said }); }

    // ---- 7. the Rookery pays a feather for a fish, and Pell fletches arrows ----
    { const [wx, wy] = AERIE.PERCHES[0]; const q = Q();
      strip('skyhawk_feather'); makeRoom(4);
      for (const id in ITEMS) if (ITEMS[id].shape === 'fish') strip(id);
      give('raw_shrimp', 1);
      closePanel(); F.tp(wx, wy + 1); F.face(wx, wy); drain(); F.press('KeyE'); F.sim(2, []);
      const paid = countItem('skyhawk_feather') === 1 && countItem('raw_shrimp') === 0 && tileAt(wx, wy) === SKYCITY.CLOUD && AERIE.regrow.some(r => r.tx === wx && r.ty === wy);
      F.tp(wx, wy + 3); F.sim(31 * 60 + 6, []); const back = tileAt(wx, wy) === AERIE.TILES.PERCH && !AERIE.regrow.some(r => r.tx === wx && r.ty === wy);
      F.tp(wx, wy + 1); F.face(wx, wy); drain(); notice = null; F.press('KeyE'); F.sim(2, []); const noFish = countItem('skyhawk_feather') === 1 && !!notice && /perch is empty/.test(notice.text);
      give('wood', 1); if (player.skills.crafting.xp < XP_TABLE[AERIE.FLETCH.lv]) player.skills.crafting.xp = XP_TABLE[AERIE.FLETCH.lv];
      strip('skyhawk_arrow'); const cx0 = player.skills.crafting.xp;
      closePanel(); drain(); F.tp(58, 9); AERIE.talk(FOLK[0]); const opened = panel === 'rookery'; render();
      const clicked = F.clickButton(AERIE.FLETCH.label); closePanel();
      check(A + 'a fish on a Rookery perch buys one skyhawk feather (the perch grows back in 30 s, and pays nothing without a fish); Keeper Pell fletches 12 Skyhawk arrows from a feather and a log',
        paid && back && noFish && opened && clicked && countItem('skyhawk_arrow') === 12 && countItem('skyhawk_feather') === 0 && player.skills.crafting.xp === cx0 + AERIE.FLETCH.xp && ITEMS.skyhawk_arrow.arrow.str === 18,
        { paid, back, noFish, opened, clicked, arrows: countItem('skyhawk_arrow'), xp: player.skills.crafting.xp - cx0 });
      strip('skyhawk_arrow'); void q; }

    // ---- 8. the Catch pays on every pull, from a table that sums to 100 ----
    { const [sx, sy] = AERIE.SNAGS[0];
      const sum = AERIE.SALVAGE.reduce((a, s) => a + s.pct, 0);
      strip('stormglass'); strip('wood'); strip('stone'); strip('skyhawk_feather'); makeRoom(6);
      let paid = 0; const seen = {};
      for (let k = 0; k < 40; k++) {
        setTile(sx, sy, AERIE.TILES.SNAG); AERIE.regrow.length = 0;
        const c0 = coins(), got0 = ['stormglass', 'wood', 'stone', 'skyhawk_feather'].reduce((a, id) => a + countItem(id), 0);
        F.tp(sx, sy - 1); F.face(sx, sy); notice = null; AERIE.useSnag(sx, sy);
        const gained = coins() - c0 + (['stormglass', 'wood', 'stone', 'skyhawk_feather'].reduce((a, id) => a + countItem(id), 0) - got0);
        if (gained > 0) paid++;
        for (const s of AERIE.SALVAGE) if (notice && notice.text === s.line) seen[s.id] = (seen[s.id] || 0) + 1;
        if (countItem('wood') > 20 || countItem('stone') > 20) { strip('wood'); strip('stone'); }
      }
      setTile(sx, sy, AERIE.TILES.SNAG); AERIE.regrow.length = 0;
      check(A + 'the Catch on the Underside pays on every pull from a table that sums to exactly 100% (30% stormglass, 25% coins, 20% wood, 15% stone, 7% feather, 3% a 200-coin purse) and the snag grows back in 60 s',
        sum === 100 && paid === 40 && AERIE.SALVAGE.length === 6 && AERIE.SALVAGE[0].id === 'stormglass' && AERIE.SALVAGE[0].pct === 30 && Object.keys(seen).length >= 2
        && AERIE.SNAGS.length === 6 && AERIE.SNAGS.every(([x, y]) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => tileAt(x + dx, y + dy) === AERIE.TILES.UNDER)),
        { sum, paid, seen }); }

    // ---- 9. the Songstone, and the Skysinger it unlocks ----
    { const q = Q(); const S = SKYCITY.SQ(); const stage0 = S.stage;
      q.songstone = false; S.stage = 2; closePanel(); drain();
      F.tp(AERIE.SONG_T[0], AERIE.SONG_T[1] + 1); F.face(AERIE.SONG_T[0], AERIE.SONG_T[1]); F.press('KeyE'); F.sim(2, []);
      const refused = !q.songstone && !!dialog.cur && /waiting for a voice/.test(dialog.cur.text);
      S.stage = 'done'; drain(); const sx1 = player.skills.smithing.xp;
      F.face(AERIE.SONG_T[0], AERIE.SONG_T[1]); F.press('KeyE'); F.sim(2, []);
      const woke = q.songstone && player.skills.smithing.xp === sx1 + 250 && !!dialog.cur && /first Song was sung over/.test(dialog.cur.text);
      makeRoom(6); give('stormglass', 3); give('dragon_scale', 4); give('mithril_bar', 2);
      if (player.skills.smithing.xp < XP_TABLE[AERIE.SING.lv]) player.skills.smithing.xp = XP_TABLE[AERIE.SING.lv];
      const sx2 = player.skills.smithing.xp, sg0 = countItem('stormglass'), ds0 = countItem('dragon_scale'), mb0 = countItem('mithril_bar');
      closePanel(); drain(); F.tp(38, 19); F.face(38, 18); F.press('KeyE'); F.sim(1, []); const open = panel === 'halcyon'; render();
      const clicked = F.clickButton(AERIE.SING.label + `  (lv ${AERIE.SING.lv})`); closePanel();
      const forged = clicked && countItem('skysinger') === 1 && countItem('stormglass') === sg0 - 3 && countItem('dragon_scale') === ds0 - 4 && countItem('mithril_bar') === mb0 - 2 && player.skills.smithing.xp === sx2 + AERIE.SING.xp;
      check(A + 'the Songstone will not wake before the Song is sung; once awake it pays 250 Smithing and opens the Skysinger on Halcyon\'s forge (3 stormglass, 4 scales, 2 mithril, Smithing 35, 900 xp) — the only blade in the game made of stormglass',
        refused && woke && open && forged && ITEMS.skysinger.weapon.str === 38 && ITEMS.skysinger.weapon.att === 36 && AERIE.SING.station === 'skyforge',
        { refused, woke, open, clicked, forged, str: ITEMS.skysinger.weapon.str });
      strip('skysinger'); S.stage = stage0; }

    // ---- 10. the Spire Run refuses below Agility 40 and pays a lap above it ----
    { const q = Q(); const M = AERIE.RUN_MARKS, xp = () => player.skills.agility.xp;
      const go = i => { const [x, y] = M[i]; F.tp(x, y); F.step([]); };
      player.skills.agility.xp = 0; q.next = 0; q.laps = 0; player.hp = player.maxHp; lastTile = null;
      go(0); const started = q.next === 1;
      F.tp(57, 26); F.step([]); const h0 = player.hp; F.tp(58, 26); F.step([]);
      const at = tileOf(), fell = player.hp === h0 - 2 && q.next === 0 && at.tx === M[0][0] && at.ty === M[0][1];
      player.skills.agility.xp = XP_TABLE[AERIE.RUN_LV]; player.hp = player.maxHp; lastTile = null;
      const x0 = xp(); go(0); go(1); go(2); go(3); go(4); go(5); go(0);
      const lap = xp() - x0 === AERIE.RUN_XP && q.laps === 1;
      const x1 = xp(); go(0); go(2); go(1); go(3); go(4); go(5); go(0); const badLap = xp() - x1;
      q.laps = AERIE.RUN_EVERY - 1; q.next = 0; lastTile = null; const c0 = coins();
      go(0); go(1); go(2); go(3); go(4); go(5); go(0);
      const purse = q.laps === AERIE.RUN_EVERY && (coins() - c0 >= AERIE.RUN_PURSE || drops.some(d => d.id === 'coins' && d.qty === AERIE.RUN_PURSE));
      const flags = M.every(([x, y]) => tileAt(x, y) === AERIE.TILES.FLAG) && AERIE.RUN_GAPS.every(([x, y]) => tileAt(x, y) === AGILITY.TILES.GAP) && AERIE.RUN_LOGS.every(([x, y]) => tileAt(x, y) === AGILITY.TILES.LOG) && AERIE.RUN_NETS.every(([x, y]) => tileAt(x, y) === AGILITY.TILES.NET);
      const clean = !MARKS_LEAK();
      check(A + 'the Spire Run: 6 flags, 9 beams, 4 gaps and a rope net over the drop — below Agility 40 the first gap drops you back to the start for 2 damage; at 40 a lap in order pays 340 Agility xp, out of order pays nothing, and every 5th lap pays 60 coins',
        started && fell && lap && badLap === 0 && purse && flags && clean,
        { started, fell, lap, badLap, purse, flags, clean, laps: q.laps });
      q.laps = 0; q.next = 0; }

    // ---- 11. Skyla hands over the Gale cloak at 10 laps, and not before ----
    { const q = Q(); q.cloak = false; q.laps = AERIE.CLOAK_LAPS - 1; strip('gale_cloak'); makeRoom(3);
      player.skills.agility.xp = XP_TABLE[AERIE.RUN_LV];
      closePanel(); drain(); F.tp(FOLK[2].x, FOLK[2].y + 1); AERIE.talk(FOLK[2]);
      const early = countItem('gale_cloak') === 0 && !q.cloak;
      q.laps = AERIE.CLOAK_LAPS; closePanel(); drain(); AERIE.talk(FOLK[2]);
      const given = q.cloak && (countItem('gale_cloak') === 1 || drops.some(d => d.id === 'gale_cloak'));
      const slot = player.inv.findIndex(s => s && s.id === 'gale_cloak'); if (slot >= 0) equipItem(slot);
      check(A + 'Skyla Fleetwing keeps the Gale cloak until the tenth lap, then hands it over; it is worn in the cape slot for 7 defence and is not a skill cape',
        early && given && (player.equip.cape === 'gale_cloak' || slot < 0) && ITEMS.gale_cloak.armour.slot === 'cape' && ITEMS.gale_cloak.armour.def === 7 && !ITEMS.gale_cloak.capeSkill,
        { early, given, worn: player.equip.cape });
      if (player.equip.cape === 'gale_cloak') unequip('cape'); strip('gale_cloak'); q.cloak = false; q.laps = 0; }

    // ---- 12. Godly Plated stays on the sky forge, and the anvil says so ----
    { INSTANCES.leave(); makeRoom(3); give('dragon_scale', 1); toldAnvil = false; drain();
      openPanel('station', 'anvil'); const told = !!notice && notice.text === GODLY_LINE; closePanel();
      toldAnvil = false; notice = null; strip('dragon_scale'); openPanel('station', 'anvil'); const quiet = !(notice && notice.text === GODLY_LINE); closePanel();
      give('dragon_scale', 1); drain(); F.tp(93, 40); const spoke = HOOKS.talkBefore.shop({ id: 'brakka', name: 'Brakka the smith', role: 'shop', shop: 'smith' }); F.sim(2, []);
      const brakka = !!dialog.cur && /never marked it/.test(dialog.cur.text); void spoke; drain(); closePanel();
      check(A + 'Godly Plated is forged on the sky forge and nowhere else — no Godly recipe is left on the anvil, Halcyon still has all four, and the anvil and Brakka now say where it is made instead of saying nothing',
        told && quiet && brakka && !RECIPES.some(r => r.station === 'anvil' && /^godly_/.test(r.out)) && SKYCITY.FORGE.length === 4 && /sky forge in Aerie/.test(GODLY_LINE),
        { told, quiet, brakka, godlyOnAnvil: RECIPES.filter(r => r.station === 'anvil' && /^godly_/.test(r.out)).length }); }

    // ---- 13. the progression audit sees what Aerie pays ----
    { const got = []; for (const f of HOOKS.xpSource) { try { f((skill, name, req, xp, secs) => got.push({ skill, name, req, xp, secs })); } catch (e) { } }
      const run = got.filter(r => r.skill === 'agility' && r.req === AERIE.RUN_LV && r.xp === AERIE.RUN_XP);
      // the lap is timed from the course itself: at least the flag-to-flag loop at walking speed, and not a minute
      let loop = 0; const M = AERIE.RUN_MARKS; for (let i = 0; i < M.length; i++) { const a = M[i], b = M[(i + 1) % M.length]; loop += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
      const secs = run.length ? run[0].secs : 0, timed = secs > loop * TILE / 175 && secs < 60;
      const audit = window.PLAYTHROUGH && PLAYTHROUGH.progression ? (PLAYTHROUGH.progression().sources.agility || []).filter(r => /Spire Run/.test(r.name)) : [];
      const seen = audit.length === 1 && audit[0].req === AERIE.RUN_LV && audit[0].xp === AERIE.RUN_XP && audit[0].rate > 0;
      check(A + 'the progression audit sees the Spire Run as an Agility source at level 40',
        run.length === 1 && timed && seen && AERIE.RUN_LV === 40,
        { run: run.map(r => r.name), secs: +secs.toFixed(2), loopTiles: loop, audit: audit.map(r => ({ name: r.name, req: r.req, xp: r.xp, rate: r.rate })) });
      const smith = window.PLAYTHROUGH && PLAYTHROUGH.progression ? (PLAYTHROUGH.progression().sources.smithing || []) : [];
      const song = smith.filter(r => r.xp === AERIE.SONG_XP && /Songstone/.test(r.name)), sing = smith.filter(r => r.req === AERIE.SING.lv && r.xp === AERIE.SING.xp && /Skysinger/.test(r.name));
      check(A + 'the progression audit sees the Songstone and the Skysinger as Smithing sources',
        song.length === 1 && sing.length === 1,
        { song: song.map(r => r.name), sing: sing.map(r => ({ name: r.name, req: r.req, xp: r.xp })) }); }

    // ---- 14. the market sells only what a knight can carry away ----
    { const stock = SHOPS.aerie_market.stock.map(s => s[0]);
      const onRing = window.KEYRING ? stock.filter(id => KEYRING.KEYS[id]) : [];
      const unknown = stock.filter(id => !ITEMS[id]);
      check(A + 'the Windward Market sells nothing the knight keeps on his keyring',
        !!window.KEYRING && stock.length > 0 && onRing.length === 0 && unknown.length === 0,
        { stock, onRing, unknown }); }

    // ---- 15. the world prompt on Keeper Pell; the Rookery and Halcyon's forge (the Skysinger row asleep and awake) at every size ----
    { if (INSTANCES.active() !== 'aerie') INSTANCES.enter('aerie'); closePanel(); drain(); const pell = FOLK[0]; F.tp(pell.x, pell.y + 1); F.face(pell.x, pell.y); render();
      const r = PEOPLE_UI.auditPrompt({ px: pell.px, py: pell.py, name: pell.name }), face = HK.face('use');
      check(A + 'facing Keeper Pell draws the gold corners on him and a Talk tag beside him (no dashed ring), and the USE seat reads TALK', r.ok && !!face && face.ribbon === 'TALK', { ...r, face: face && face.ribbon });
      const q = Q(), ss0 = q.songstone;
      const a = PEOPLE_UI.auditPanels([
        { name: "Keeper Pell's perches", panel: 'rookery', open: () => openPanel('rookery') },
        { name: "Halcyon's forge, the Songstone asleep", panel: 'halcyon', open: () => { q.songstone = false; openPanel('halcyon'); }, close: () => { q.songstone = ss0; } },
        { name: "Halcyon's forge, the Skysinger row", panel: 'halcyon', open: () => { q.songstone = true; openPanel('halcyon'); }, close: () => { q.songstone = ss0; } },
      ]);
      q.songstone = ss0;
      check(A + "Keeper Pell's perches and Halcyon's Sky Forge (with the Skysinger row) wear the book frame at all 8 sizes, touch and mouse, Normal and Large text: Fletch and Forge plates and pages 44 px on touch, 8 px apart, inside the panel, out of the notch and home-bar bands, every word inside its plate", a.frames === 96 && a.problems.length === 0, { frames: a.frames, total: a.total, problems: a.problems.slice(0, 10) }); }

    // ---- put everything back ----
    if (INSTANCES.active()) INSTANCES.leave();
    closePanel(); drain(); AERIE.regrow.length = 0; lastTile = null;
    quest.aerie = JSON.parse(aq0);
    if (player.skills.agility) player.skills.agility.xp = Math.max(ag0, player.skills.agility.xp);
    player.skills.smithing.xp = Math.max(sm0, player.skills.smithing.xp); player.skills.crafting.xp = Math.max(cr0, player.skills.crafting.xp);
    strip('stormglass'); strip('skyhawk_feather'); strip('skysinger'); strip('skyhawk_arrow'); strip('gale_cloak');
    player.x = px0; player.y = py0; recomputeMaxHp(); player.hp = Math.min(hp0 || player.maxHp, player.maxHp);
    if (comp) comp.downT = compDown;
    h.peace(false); save();
  });
  // the Spire Run must never leak onto the overworld: 38-agility paints every registered flag into the
  // world at every generation, which is why this file keeps its own. This proves none of ours is there.
  function MARKS_LEAK() {
    if (!window.AGILITY) return false;
    const mine = AERIE.RUN_MARKS.concat(AERIE.RUN_GAPS, AERIE.RUN_LOGS, AERIE.RUN_NETS).map(([x, y]) => x + ',' + y);
    for (const id in AGILITY.COURSES) { const c = AGILITY.COURSES[id]; for (const [x, y] of c.marks) if (mine.includes(x + ',' + y)) return true; }
    return false;
  }
}
