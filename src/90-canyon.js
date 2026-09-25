// ============================================================================
// THE REDCUT — a plateau of red rock in the south-east, cut through by a canyon
// Owner: "maybe we can add a whole new section to the map in the bottom right where it is dead space, and
// have a plateau canyon?"
// The bottom-right corner (x 200–258, y 97–178) was 4,960 tiles of noise grass and scattered oak: no region,
// no NPC, no building, no spawn, no road, and 966 tiles of it walled into pockets nothing could reach.
// This fills it with one place, built so the height reads at a glance:
//   THE TABLE   an oval of red stone standing above the scrub, ringed by a two-tile escarpment
//   THE RING    a canyon carved right round inside it, open to the scrub at two ends
//   THE MESA    the island of tableland the ring encircles — only reachable by climbing out of the canyon
//   THE SPUR    a dead-end arm running south off the ring, ending in the box head where the story is
// Four heights, four tones, drawn dark to light: canyon floor, ledge, cliff face, table top. Every cliff
// carries a lit rim on its sunward edge and throws a real shadow onto the ground below it, so you can see
// which way is down without being told.
//
// THE WAY IN and THE WAY THROUGH: the ring canyon's mouth (x 213–217, y 105) is a walk straight in off the
// scrub below Castle Gnash. Walk the floor either way round the ring and you come out of the slot (x 244–248,
// y 100), on the same scrub 30 tiles east — the stormstone diggings, and the road up to Castle Gnash.
// Three climbs join the levels: THE RISE (a ramp cut through the west escarpment, x 205–207 y 137–142) onto
// the table; THE STAIR (x 220–221, y 115–119) out of the canyon onto the mesa; THE SWITCHBACK (three legs,
// x 223–227, y 147–151) down from Marlow's camp into the spur. THE FALL — a slab of cliff that came down and
// filled the spur at y 143–144 — is walked over from the table and walked up and over from the canyon floor.
//
// THE GATES, plainly:
//   1. The whole Redcut sits east of the strait. The only way there is Harl's ferry to the Far Shore:
//      COMBAT LEVEL 10 and 40 COINS (26-boats / 33-goblincity). Nothing here is reachable under that.
//   2. What lives here is well above the goblin fields: rimhawks are level 34, dustjaws level 42.
//   3. THE DEEP CACHE, at the bottom of the box head, is behind a crack in the rock: AGILITY 30 to squeeze
//      through, the same kind of gate as the pond stones (10) and the goblin palisade (25). Behind it is the
//      one thing you can only get here — Hux's pick: tier 3, the same as a Mithril pickaxe, and the one pick
//      that cuts 2 redsalt out of a seam where every other pick cuts 1.
//   4. Redsalt is mined nowhere else on the map: MINING 22, and only from the seams in the canyon walls.
//
// No new key. Every tile worth pressing USE on is in INTERESTING_TILES, so a tap on the iPad walks to it and
// uses it, and the winch and the basket are ridden with USE like any other thing.
// Feature file: registers through HOOKS only, edits no core file. window.REDCUT exposes the tables.
// ============================================================================
{
  // ---------- tiles (ids captured locally so a later addTile of the same name cannot move them) ----------
  const RC_TOP = addTile('REDROCK', { tex: 'sand', mini: '#b4643a' });                      // the table top, in the sun
  const RC_LEDGE = addTile('REDLEDGE', { tex: 'dirt', mini: '#8d4b2e' });                    // a shelf part way down
  const RC_FLOOR = addTile('CANYONFLOOR', { tex: 'dirt', mini: '#5a2f22' });                 // the canyon floor, in shade
  const RC_CLIFF = addTile('REDCLIFF', { solid: true, tex: 'wall', mini: '#7a3a22' });       // the wall between them
  const RC_SCRUB = addTile('REDSCRUB', { tex: 'sand', mini: '#a08a5a' });                    // dry ground at the foot of the table
  const RC_BUSH = addTile('DUSTBUSH', { tex: 'sand', mini: '#7a7a42' });                     // a grey thorn bush, walk through it
  const RC_BOULDER = addTile('REDBOULDER', { solid: true, tex: 'sand', mini: '#8d5a3a' });   // a fallen block
  const RC_RAMP = addTile('REDRAMP', { tex: 'dirt', mini: '#c07a4a' });                      // the Rise: cut steps through the escarpment
  const RC_FALL = addTile('ROCKFALL', { tex: 'wall', mini: '#9a5a3a' });                     // the Fall: the slab that filled the spur
  const RC_SALT = addTile('REDSALT_SEAM', { solid: true, tex: 'wall', mini: '#d4726a' });    // redsalt in the wall (Mining 22)
  const RC_SPENT = addTile('SPENT_SEAM', { tex: 'dirt', mini: '#6a4038' });                  // a seam already cut out
  const RC_WINCH = addTile('REDCUT_WINCH', { solid: true, tex: 'dirt', mini: '#c9a36a' });   // Marlow's winch on the rim
  const RC_BASKET = addTile('REDCUT_BASKET', { solid: true, tex: 'dirt', mini: '#c9a36a' }); // the basket at the bottom
  const RC_NEST = addTile('HAWK_NEST', { solid: true, tex: 'sand', mini: '#8a7a4a' });       // a rimhawk nest, and what it stole
  const RC_LAMP = addTile('HUX_LAMP_TILE', { solid: true, tex: 'dirt', mini: '#f5c542' });   // the lamp still burning on the middle leg
  const RC_COIL = addTile('ROPE_COIL', { solid: true, tex: 'dirt', mini: '#a08a5a' });       // the rest of the rope, coiled and tied
  const RC_CRACK = addTile('REDCUT_CRACK', { solid: true, tex: 'wall', mini: '#4a2418' });   // solid below Agility 30 (WALK_OVER)
  const RC_CACHE = addTile('DEEP_CACHE', { solid: true, tex: 'wall', mini: '#f5c542' });     // the cache behind the crack
  const RC_BOARD = addTile('REDCUT_BOARD', { solid: true, tex: 'sand', mini: '#8a6a3a' });   // the board at the mouth and at the Rise
  // THE EDGE (see "the edge" below): the ground that steps from the red rock out to the green country round
  // it. All of it wears the grass texture underneath: the edge's colour wash gives each its colour, and one
  // texture under the wash means no tile shows a seam against the next. Their map colours step too, red dust to scree to dry scrub to dry grass, so the world map shows the
  // same fade the ground does. These are NOT in REDCUT.tiles, on purpose: 92-worldshape keeps every tile in
  // that list inside the Redcut's region box, and a strip of dry grass out on the jungle side is the jungle's.
  const RC_DUST = addTile('REDDUST', { tex: 'grass', mini: '#9c5d3d', placeableOn: true });
  // red dust strewn with stones fallen off the rim
  const RC_SCREE = addTile('REDSCREE', { tex: 'grass', mini: '#8e5b45' });
  const RC_DRYSCRUB = addTile('DRYSCRUB', { tex: 'grass', mini: '#a58d5c', placeableOn: true });
  const RC_DRYGRASS = addTile('DRYGRASS', { tex: 'grass', mini: '#7f8c46', placeableOn: true });
  // a dry thorn bush: walk through it, like the dust bushes
  const RC_DRYBUSH = addTile('DRYBUSH', { tex: 'grass', mini: '#77773f' });
  // a dead tree, bleached and leafless: solid
  const RC_SNAG = addTile('DEADSNAG', { solid: true, tex: 'grass', mini: '#5f4c3b' });
  const CRACK_LV = 30, SALT_LV = 22;
  for (const t of [RC_SALT, RC_WINCH, RC_BASKET, RC_NEST, RC_LAMP, RC_COIL, RC_CRACK, RC_CACHE, RC_BOARD, RC_BOULDER])
    INTERESTING_TILES.add(t);   // the core USE ring, frontTile's reach, and a tap on the iPad

  // ---------- items ----------
  Object.assign(ITEMS, {
    redsalt: { name: 'Redsalt', value: 34, color: '#d4726a', shape: 'rock' },
    salt_beef: { name: 'Salt beef', value: 40, color: '#a8553a', shape: 'meat', heal: 13 },
    hux_pick: { name: "Hux's pick", value: 900, color: '#c07a4a', shape: 'pickaxe', tool: 'pickaxe', tier: 3 },
    hux_lamp: { name: "Hux's lamp", value: 0, color: '#f5c542', shape: 'lodestone' },
    hux_tally: { name: "Hux's tally book", value: 0, color: '#8a6a3a', shape: 'plank' },
    cut_rope: { name: 'The cut rope end', value: 0, color: '#a08a5a', shape: 'silk' },
    winch_handle: { name: 'The winch handle', value: 0, color: '#8d9098', shape: 'hammer' },
  });
  for (const k of ['redsalt', 'salt_beef', 'hux_pick', 'hux_lamp', 'hux_tally', 'cut_rope', 'winch_handle']) {
    ITEMS[k].id = k;
    ITEMS[k].stack = (k === 'redsalt' || k === 'salt_beef') ? 50 : 1;
  }
  // Salt beef is cured, not cooked: it cannot burn, and it heals more than a meat pie. Made at any workbench.
  const SALT_BEEF = { out: 'salt_beef', qty: 3, needs: [['raw_beef', 3], ['redsalt', 2]], station: 'workbench',
    skill: 'cooking', lv: 15, xp: 90, label: '3 Raw beef + 2 Redsalt → 3 Salt beef' };
  RECIPES.push(SALT_BEEF);
  // how many of an item the salt beef recipe takes, read off the recipe so the book and the audit cannot drift
  const beefNeeds = id => { const n = SALT_BEEF.needs.find(([k]) => k === id); return n ? n[1] : 0; };
  GATHER[RC_SALT] = { skill: 'mining', tool: 'pickaxe', lv: SALT_LV, xp: 82, item: 'redsalt', fall: 1, leaves: RC_SPENT, regrow: 70, label: 'redsalt seam' };

  // ---------- Hux's pick ----------
  // Tier 3 swings like a Mithril pickaxe. What no other pick does: Hux cut his seams with it for forty years,
  // and it takes the whole vein out, so a redsalt seam cut with it gives 2 redsalt instead of 1. A seam gives
  // one cut and then goes spent (fall 1), so this is exactly one extra redsalt a seam.
  const HUX_SALT_EXTRA = 1;
  // carried in the pack or worn: the core swings the best pick you have, and nothing out-tiers this one
  const huxPickInHand = () => countItem('hux_pick') > 0 || EQUIP_SLOTS.some(k => player.equip[k] === 'hux_pick');
  // The core pays the xp only when a swing lands, so a rise in Mining xp on a seam is the proof it was cut.
  // Wrapped by reassignment, with no .apply: this runs on every swing.
  const _finishGatherRC = finishGather;
  finishGather = function () {
    const a = player.action, onSeam = !!a && tileAt(a.tx, a.ty) === RC_SALT;
    const xp0 = player.skills.mining.xp;
    _finishGatherRC();
    if (!onSeam || player.skills.mining.xp === xp0 || !huxPickInHand()) return;
    giveOrDrop('redsalt', HUX_SALT_EXTRA, player.x, player.y, true);
    floatText(player.x, player.y - 44, `+${HUX_SALT_EXTRA} redsalt (Hux's pick)`, ITEMS.redsalt.color, 12);
  };
  { const coreBlurb = itemBlurb; itemBlurb = def => def && def.id === 'hux_pick' ? `Mines rocks (${keyName('E')}). Cuts ${1 + HUX_SALT_EXTRA} redsalt from a seam, not 1.` : coreBlurb(def); }

  // ---------- item art ----------
  // src/80-icons.js keeps a per-item drawing registry and an audit that fails when two items paint the same
  // sequence; seven new items with no art of their own would push its "still sharing" count past its ceiling.
  // So they get their own drawings here, in that file's contract: draw around 0,0 inside -9..+9, no translate,
  // no scale, no halo, nothing thinner than 2 units. Guarded, because 80-icons may not be loaded.
  if (window.ICONS && ICONS.set) {
    const line = (g, w) => { g.lineWidth = Math.max(1, w); };
    ICONS.set('redsalt', (g, size, item) => {                       // a cluster of angular salt crystals
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-7, 6); g.lineTo(-4, -5); g.lineTo(0, -2); g.lineTo(-2, 7); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0, 7); g.lineTo(2, -7); g.lineTo(6, -3); g.lineTo(5, 8); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.moveTo(-5, 3); g.lineTo(-3, -3); g.lineTo(-2, -2); g.lineTo(-4, 4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; line(g, 1.2);
      g.beginPath(); g.moveTo(-7, 6); g.lineTo(5, 8); g.stroke();
    });
    ICONS.set('salt_beef', (g, size, item) => {                     // a cured slab: rind along the top, salt on it
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-8, -2); g.lineTo(6, -5); g.lineTo(8, 4); g.lineTo(-6, 7); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,240,225,0.85)';
      g.beginPath(); g.moveTo(-8, -2); g.lineTo(6, -5); g.lineTo(6, -2); g.lineTo(-8, 1); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [cx, cy] of [[-3, 3], [1, 1], [4, 4]]) { g.beginPath(); g.arc(cx, cy, 1.1, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.45)'; line(g, 1.2);
      g.beginPath(); g.moveTo(-8, -2); g.lineTo(6, -5); g.lineTo(8, 4); g.lineTo(-6, 7); g.closePath(); g.stroke();
    });
    ICONS.set('hux_pick', (g, size, item) => {                      // a worked pick: swept head, bound haft
      g.strokeStyle = '#6a4a2a'; line(g, 2.6);
      g.beginPath(); g.moveTo(-6, 8); g.lineTo(5, -6); g.stroke();
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-8, -3); g.quadraticCurveTo(2, -9, 9, -2); g.quadraticCurveTo(2, -5, -6, 1); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.moveTo(-6, -3); g.quadraticCurveTo(1, -7, 6, -3); g.quadraticCurveTo(1, -5, -5, -1); g.closePath(); g.fill();
      g.strokeStyle = '#c9a36a'; line(g, 1.4);
      g.beginPath(); g.moveTo(-3, 4); g.lineTo(0, 1); g.stroke();
      g.beginPath(); g.moveTo(-1, 6); g.lineTo(2, 3); g.stroke();
    });
    ICONS.set('hux_lamp', (g, size, item) => {                      // a caged lamp with the flame still in it
      g.strokeStyle = 'rgba(0,0,0,0.45)'; line(g, 1.4);
      g.beginPath(); g.arc(0, -7, 2.4, Math.PI, 0); g.stroke();
      g.fillStyle = '#6a5a4a';
      g.beginPath(); g.moveTo(-5, -4); g.lineTo(5, -4); g.lineTo(4, -2); g.lineTo(-4, -2); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-5, 8); g.lineTo(5, 8); g.lineTo(4, 6); g.lineTo(-4, 6); g.closePath(); g.fill();
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-4, -2); g.lineTo(4, -2); g.lineTo(4, 6); g.lineTo(-4, 6); g.closePath(); g.fill();
      g.strokeStyle = '#3a2f26'; line(g, 1.2);
      for (const bx of [-2, 0, 2]) { g.beginPath(); g.moveTo(bx, -2); g.lineTo(bx, 6); g.stroke(); }
      g.fillStyle = '#fff0b0'; g.beginPath(); g.arc(0, 2.5, 1.6, 0, 7); g.fill();
    });
    ICONS.set('hux_tally', (g, size, item) => {                     // a bound book of counts, with its cord
      g.fillStyle = item.color;
      g.beginPath(); g.moveTo(-6, -8); g.lineTo(7, -8); g.lineTo(7, 8); g.lineTo(-6, 8); g.closePath(); g.fill();
      g.fillStyle = '#4a3520'; g.fillRect(-6, -8, 3, 16);
      g.fillStyle = 'rgba(245,238,220,0.92)'; g.fillRect(-2, -6, 8, 12);
      g.strokeStyle = 'rgba(60,45,30,0.8)'; line(g, 1);
      for (const ly of [-3, 0, 3]) { g.beginPath(); g.moveTo(-1, ly); g.lineTo(5, ly); g.stroke(); }
      g.strokeStyle = '#a05a3a'; line(g, 1.4);
      g.beginPath(); g.moveTo(7, -4); g.quadraticCurveTo(9, 0, 6, 4); g.stroke();
    });
    ICONS.set('cut_rope', (g, size, item) => {                      // a coil, and the clean cut end off it
      g.strokeStyle = item.color;
      line(g, 2); g.beginPath(); g.ellipse(-1, 2, 7, 4.5, 0, 0, 7); g.stroke();
      line(g, 1.6); g.beginPath(); g.ellipse(-1, -1, 5, 3.2, 0, 0, 7); g.stroke();
      line(g, 1.4); g.beginPath(); g.ellipse(-1, -4, 3, 2, 0, 0, 7); g.stroke();
      line(g, 1.6); g.beginPath(); g.moveTo(6, 0); g.lineTo(9, -6); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; line(g, 1);
      g.beginPath(); g.moveTo(8, -5); g.lineTo(9, -8); g.stroke();
      g.beginPath(); g.moveTo(9, -5); g.lineTo(7, -8); g.stroke();
    });
    ICONS.set('winch_handle', (g, size, item) => {                  // a crank: a Z of bar with a turned grip
      g.strokeStyle = item.color; g.lineCap = 'round';
      line(g, 3); g.beginPath(); g.moveTo(-7, 6); g.lineTo(-7, -3); g.stroke();
      g.beginPath(); g.moveTo(-7, -3); g.lineTo(4, -6); g.stroke();
      g.beginPath(); g.moveTo(4, -6); g.lineTo(4, 1); g.stroke();
      g.lineCap = 'butt';
      g.fillStyle = '#6a4a2a'; g.beginPath(); g.ellipse(4, 4, 2.4, 3.4, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-7, -3, 1.4, 0, 7); g.fill();
    });
  }

  // ---------- monsters ----------
  MONSTER_DEFS.rimhawk = { name: 'Rimhawk', level: 34, r: 14, hp: 130, att: 34, maxHit: 14, def: 26, speed: 205, aggro: true, sight: 7 * TILE, respawn: 65,
    drops: { always: [['coins', 18, 44]], table: [['nothing', 0, 0, 10], ['raw_beef', 1, 2, 12], ['stone_arrow', 6, 14, 10], ['iron_arrow', 3, 8, 6], ['redsalt', 1, 1, 4]], rare: { chance: 45, table: [['redsalt', 3, 6, 3], ['steel_bar', 1, 1, 1]] } } };
  MONSTER_DEFS.dustjaw = { name: 'Dustjaw', level: 42, r: 21, hp: 300, att: 40, maxHit: 20, def: 40, speed: 62, aggro: true, sight: 3.5 * TILE, respawn: 95,
    drops: { always: [['coins', 40, 90], ['redsalt', 1, 3]], table: [['nothing', 0, 0, 8], ['coal', 2, 5, 12], ['stone', 3, 6, 10], ['iron_ore', 2, 4, 8]], rare: { chance: 30, table: [['redsalt', 5, 9, 3], ['steel_bar', 1, 2, 2]] } } };

  HOOKS.drawMonster.rimhawk = (g, e, hurt) => {
    const flap = Math.sin(time * 11 + e.x * 0.05) * (e.moving ? 1 : 0.35);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(0, 15, 15, 5, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#ff9a8a' : '#6b4632';                       // wings
    g.beginPath(); g.moveTo(-3, -2); g.lineTo(-26, -8 - flap * 7); g.lineTo(-24, 2 - flap * 3); g.lineTo(-3, 5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(3, -2); g.lineTo(26, -8 - flap * 7); g.lineTo(24, 2 - flap * 3); g.lineTo(3, 5); g.closePath(); g.fill();
    g.fillStyle = hurt ? '#ffb0a0' : '#8a5c3e'; g.beginPath(); g.ellipse(0, 0, 8, 12, 0, 0, 7); g.fill();   // body
    g.fillStyle = '#c9a36a'; g.beginPath(); g.ellipse(0, 3, 5, 7, 0, 0, 7); g.fill();                        // pale breast
    g.fillStyle = hurt ? '#ffb0a0' : '#7a4e34'; g.beginPath(); g.arc(0, -11, 6, 0, 7); g.fill();             // head
    g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(0, -13); g.lineTo(9 * (e.facing && e.facing.x < 0 ? -1 : 1), -9); g.lineTo(0, -7); g.closePath(); g.fill(); // beak
    g.fillStyle = '#101418'; g.beginPath(); g.arc(2.5 * (e.facing && e.facing.x < 0 ? -1 : 1), -12, 1.6, 0, 7); g.fill();
  };
  HOOKS.drawMonster.dustjaw = (g, e, hurt) => {
    const chew = Math.sin(time * 3 + e.y * 0.03) * 2;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 17, 23, 8, 0, 0, 7); g.fill();
    g.fillStyle = hurt ? '#ff9a8a' : '#6a4a3c'; g.beginPath(); g.ellipse(0, 0, 21, 15, 0, 0, 7); g.fill();   // body
    g.fillStyle = hurt ? '#ffb0a0' : '#8a6450';                                                              // armour plates along the back
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(k * 11, -5, 7, 6, 0, 0, 7); g.fill(); }
    g.fillStyle = '#4a3327';
    for (let k = -1; k <= 1; k++) { g.fillRect(k * 11 - 5, -11, 10, 2.5); }                                  // ridges
    g.fillStyle = hurt ? '#ffb0a0' : '#7a5644'; g.beginPath(); g.ellipse(0, 13 + chew * 0.4, 13, 8, 0, 0, 7); g.fill(); // head, low and forward
    g.fillStyle = '#d9d0c0';                                                                                  // the jaw that chews the rock
    g.beginPath(); g.moveTo(-9, 17 + chew); g.lineTo(-5, 21 + chew); g.lineTo(-1, 17 + chew); g.lineTo(3, 21 + chew); g.lineTo(7, 17 + chew); g.lineTo(9, 19 + chew); g.lineTo(-9, 19 + chew); g.closePath(); g.fill();
    g.fillStyle = '#f5c542'; g.beginPath(); g.arc(-6, 10, 2, 0, 7); g.fill(); g.beginPath(); g.arc(6, 10, 2, 0, 7); g.fill();
  };

  // ---------- the two people ----------
  const MARLOW = { x: 222, y: 152 }, HUX = { x: 233, y: 156 };
  NPCS.push(initNpc({ id: 'marlow', name: 'Marlow the prospector', x: MARLOW.x, y: MARLOW.y, tunic: '#7a5a3a', hair: '#d9d0c0', beard: true, role: 'redcut_rim' }));
  NPCS.push(initNpc({ id: 'hux', name: 'Hux', x: HUX.x, y: HUX.y, tunic: '#5a6a5a', hair: '#3a2a1a', beard: true, role: 'redcut_deep' }));

  // ---------- geometry ----------
  const RC = { x0: 204, y0: 100, x1: 257, y1: 177 };            // the region, and the only ground this file writes to
  const CX = 231, CY = 140, RX = 25.5, RY = 36;                  // the table: an oval, x 206–256, y 104–176
  const ARC = [[214, 108], [216, 120], [221, 130], [229, 136], [238, 135], [244, 127], [247, 116], [246, 102]]; // the ring canyon, out at both ends
  const SPUR = [[230, 136], [231, 146], [232, 158]];             // the dead-end arm south, and the box head at its foot
  const MOUTH = { x: 215, y: 103 }, SLOT = { x: 246, y: 101 };   // where the canyon meets the scrub
  const RISE = { x0: 205, x1: 207, y0: 137, y1: 142 };           // the ramp cut through the west escarpment
  const STAIR = [[220, 115], [220, 116], [221, 116], [221, 117], [220, 118], [221, 118], [220, 119]]; // out of the canyon onto the mesa
  const SWITCHBACK = [                                            // three legs, each dropping at the end of the last
    [223, 147], [224, 147], [225, 147], [226, 147],
    [226, 148],
    [223, 149], [224, 149], [225, 149], [226, 149],
    [223, 150],
    [223, 151], [224, 151], [225, 151], [226, 151], [227, 151],
  ];
  const FALL = { x0: 226, x1: 236, y0: 143, y1: 144 };           // the slab across the spur
  const WINCH_T = { x: 226, y: 153 }, BASKET_T = { x: 230, y: 153 };
  const LAMP_T = { x: 224, y: 149 }, COIL_T = { x: 231, y: 158 };
  const BENCH_T = { x: 234, y: 157 }, FIRE_T = { x: 221, y: 153 };
  const CRACK_T = { x: 232, y: 162 }, CACHE_T = { x: 232, y: 164 };
  const CACHE_POCKET = { x0: 231, y0: 163, x1: 233, y1: 164 };
  const NESTS = [[229, 116], [235, 113], [237, 122]];
  const BOARDS = [[213, 102], [204, 135]];
  const HAWKS = [[226, 116], [232, 110], [238, 114], [238, 118], [230, 126]];
  const JAWS = [[216, 114], [233, 138], [244, 122], [231, 148]];
  const SEED = 9017;

  const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)); };
  const polyD = (pl, x, y) => { let d = 99; for (let i = 0; i < pl.length - 1; i++) d = Math.min(d, segD(x, y, pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1])); return d; };
  const canD = (x, y) => Math.min(polyD(ARC, x, y), polyD(SPUR, x, y) + 0.6);
  // smooth value noise, two octaves on a lattice, 0..1: the same maker 39-worldblend and 92-worldshape use
  const makeNoise = (seed, cell) => {
    const r = mulberry32(seed), N = 64, lat = new Float32Array(N * N); for (let i = 0; i < lat.length; i++) lat[i] = r();
    const at = (ix, iy) => lat[((iy % N + N) % N) * N + ((ix % N + N) % N)];
    const sm = t => t * t * (3 - 2 * t);
    const oct = (x, y, c) => { const fx = x / c, fy = y / c, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy); return lerp(lerp(at(ix, iy), at(ix + 1, iy), tx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty); };
    return (x, y) => clamp(0.5 + (oct(x, y, cell) * 0.7 + oct(x + 37.3, y + 11.7, cell / 2) * 0.3 - 0.5) * 1.7, 0, 1);
  };
  const sm01 = t => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
  // THE TABLE'S OUTLINE wanders off the oval by smooth noise, up to about two and a half tiles either way, and
  // pulls in a little towards the east and south edges of the world so the scrub has room there too. It is
  // held to the exact oval near the Rise (the ramp must still cut clean through the escarpment) and wherever
  // the canyon runs close to the rim (there the ring's own wall is the escarpment, and a wobble could open a
  // ledge straight onto the scrub). Everything the climbs and the ring depend on is exactly where it was.
  // Held means: the outline only moves where the canyon is more than six tiles off it. There every tile of the
  // table that ends up beside the ground outside is past the ledges (4.2) and the canyon's own walls (6.2), so
  // it can only ever become escarpment, and the floor (3) never comes near the outside at all.
  // The pull keeps the table three tiles or more inside the region box on every side, so the escarpment is
  // never cut off by the box edge and there is room for the band all the way round.
  const rimN0 = makeNoise(SEED + 11, 6), rimN1 = makeNoise(SEED + 12, 3);
  // a slow swell and a quick fret on top of it, so no stretch of the rim runs dead straight
  const rimN = (x, y) => rimN0(x, y) * 0.7 + rimN1(x, y) * 0.3;
  const RISE_C = [(RISE.x0 + RISE.x1) / 2, (RISE.y0 + RISE.y1) / 2];
  const rimFree = (x, y) => Math.min(sm01((Math.hypot(x - RISE_C[0], y - RISE_C[1]) - 6) / 5), sm01((canD(x, y) - 6) / 3));
  const rimPull = (x, y) => 0.07 * sm01((x - 249) / 6) + 0.06 * sm01((y - 168) / 6) + 0.08 * sm01((212 - x) / 6);
  // the wander is set in tiles (about two either way), not as a share of the radius, so the long flat top and
  // bottom of the oval move no further than its sides
  const rimOf = (x, y) => { const f = rimFree(x, y); if (f <= 0) return 1; const r = Math.max(8, Math.hypot(x - CX, y - CY)); return 1 + ((rimN(x, y) * 2 - 1) * 2.6 / r - rimPull(x, y)) * f; };
  const inPl = (x, y) => { const e = ((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2; return e <= 0.64 || (e <= 1.44 && e <= rimOf(x, y) ** 2); };
  // 0 floor · 1 ledge · 2 cliff · 3 table top · 4 scrub outside the table
  // the two ends of the ring, where the canyon floor is meant to meet the scrub: within 2 tiles of either
  const nearOpening = (x, y) => [MOUTH, SLOT].some(p => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= 2);
  function classOf(x, y) {
    // Outside the table the ring's two arms run on out to the mouth and the slot. They get a cliff wall of
    // their own two tiles thick (3 < d <= 5), so the arm floor is a canyon cut down into the scrub and not a
    // strip of floor lying open along its whole outer side. Only the mouth and the slot are left open.
    if (!inPl(x, y)) { const d = canD(x, y); return d <= 3 ? 0 : d <= 5 && !nearOpening(x, y) ? 2 : 4; }
    const d = canD(x, y);
    if (d <= 3) return 0;
    if (d <= 4.2) return 1;
    if (d <= 6.2) return 2;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!inPl(x + dx, y + dy)) return 2; // the escarpment
    return 3;
  }
  // how high a tile stands, 0 (canyon floor) to 4 (the table). Read off the tile itself rather than kept in a
  // parallel array, so a save loaded straight into the Redcut shades exactly the same as a fresh world.
  const HEIGHT_OF = { [RC_FLOOR]: 0, [RC_SPENT]: 0, [RC_BASKET]: 0, [RC_COIL]: 0, [RC_LEDGE]: 2, [RC_LAMP]: 2, [RC_RAMP]: 3, [RC_FALL]: 3, [RC_TOP]: 4, [RC_NEST]: 4, [RC_WINCH]: 4, [RC_BOARD]: 4, [RC_CLIFF]: 4, [RC_SALT]: 3, [RC_CRACK]: 3, [RC_CACHE]: 1 };
  const isCliff = (x, y) => { const t = tileAt(x, y); return t === RC_CLIFF || t === RC_SALT || t === RC_CRACK || t === RC_CACHE; };
  const mine = (x, y) => x >= RC.x0 && x <= RC.x1 && y >= RC.y0 && y <= RC.y1;
  const tally = { floor: 0, ledge: 0, cliff: 0, top: 0, scrub: 0, ramp: 0, fall: 0, seams: 0, bushes: 0, boulders: 0, walledIn: 0, sealed: 0, converted: 0 };
  // classOf for every tile of the region, worked out once a world (it reads the noisy outline 25 times a tile);
  // 4 everywhere outside the region. The ground painter reads it to shade a bush or a block by what it stands on.
  const CLASS = new Uint8Array(MAP_W * MAP_H).fill(4);
  const cls = (x, y) => (inMap(x, y) ? CLASS[idx(x, y)] : 4);

  // ---------- THE EDGE ----------
  // Owner, testing: "The canyon doesn't blend with the surrounding environment in the slightest." The table
  // stood in a tan rectangle (every tile of the region box that was not rock was scrub), and the rectangle
  // met the grass and the jungle on two ruled lines. Now the table's outline wanders (inPl above), and round
  // the whole of it runs a band laid by distance from the rock, stepping out through:
  //   red dust and scree at the foot of the escarpment, with fallen blocks
  //   dry scrub, with thorn bushes
  //   dry grass, with the odd dead tree
  //   green grass with patches of dry grass in it — and then the land as it was.
  // The map is drawn from the tiles, so the world map shows the same fade. In the world the band is washed by
  // one soft colour field, red at the rock through tan and straw to nothing, painted from a one-pixel-a-tile
  // picture scaled up smooth, so the ground changes colour with no line anywhere.
  const EXT = { x0: RC.x0 - 14, y0: RC.y0 - 14, x1: MAP_W - 2, y1: MAP_H - 2 };   // the band's reach: x 190-258, y 86-178
  const EW = EXT.x1 - EXT.x0 + 1, EH = EXT.y1 - EXT.y0 + 1;
  const inExt = (x, y) => x >= EXT.x0 && x <= EXT.x1 && y >= EXT.y0 && y <= EXT.y1;
  const ei = (x, y) => (y - EXT.y0) * EW + (x - EXT.x0);
  const ERAW = new Float32Array(EW * EH).fill(1e9);   // tiles from the rock
  const EFIELD = new Float32Array(EW * EH).fill(99);  // the same, moved in and out by smooth noise (no jitter)
  const EDGE_GROUND = new Set([RC_DUST, RC_SCREE, RC_DRYSCRUB, RC_DRYGRASS, RC_DRYBUSH]);
  const edgeState = { gen: 0 };
  const bandN = makeNoise(SEED + 23, 6);
  // a fixed per-tile number in 0..1 (k picks an independent one): the jitter that frays each step
  const hash = (x, y, k) => { const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7 + SEED * 0.013) * 43758.5453; return s - Math.floor(s); };
  // the smooth field: a tile or so of wander at the foot of the rim, close to three tiles out in the grass
  // (it reaches out further than it bites in, so the band is never squeezed thinner than about four tiles)
  const edgeField = (x, y, d) => { const n = bandN(x, y) * 2 - 1; return d + n * (n > 0 ? 0.5 : 1) * (0.6 + 0.35 * Math.min(d, 6)); };
  // where each ground starts, in field tiles from the rock
  const TIERS = { dust: 1.3, scrub: 3.1, dry: 5.4, patchy: 8.0 };
  // what ground a tile gets (null: stays green), from the field plus the jitter
  const edgeTier = (x, y, f0, d) => {
    const f = f0 + (hash(x, y, 1) - 0.5) * 1.1, h = hash(x, y, 2), h3 = hash(x, y, 3);
    if (f < TIERS.dust) return d <= 3.2 && h > 0.5 ? RC_SCREE : RC_DUST;
    if (f < TIERS.scrub) return d <= 2.5 && h > 0.8 ? RC_SCREE : RC_DRYSCRUB;
    if (f < TIERS.dry) return h3 < 0.14 ? RC_DRYSCRUB : RC_DRYGRASS;
    if (f < TIERS.patchy) return h3 < (TIERS.patchy - f) / 2.6 ? RC_DRYGRASS : null;
    return null;
  };

  // ---------- the region ----------
  // Inserted just ahead of the catch-all 'The Wilds', the way 25-elves does it: regionAt still finds it first
  // for these tiles (nothing else covers the bottom-right) and Deepholm stays REGIONS[0] for 24-dwarves.
  {
    const wild = Math.max(0, REGIONS.findIndex(r => r.name === 'The Wilds'));
    REGIONS.splice(wild, 0, { name: 'The Redcut', sub: 'Red rock, and a canyon through it', x0: RC.x0, y0: RC.y0, x1: RC.x1, y1: RC.y1 });
  }

  const REDCUT_SEAMS = [];   // where the seams ended up, for the book and the checks

  // ---------- the carve ----------
  // Runs after every other world hook (file order), so it sees the finished map. It writes only inside RC,
  // and only over ground the base world scattered there: grass, dirt, sand, trees, flowers, mushrooms.
  const OVERWRITABLE = () => new Set([T.GRASS, T.DIRT, T.SAND, T.TREE, T.OAK, T.FLOWERS, T.MUSHROOM, T.STUMP, T.ROCK, T.IRON, T.COAL, T.RUBBLE].filter(t => t !== undefined));
  HOOKS.world.push((rnd0, api) => {
    const set = api.setTile, at = api.tileAt;
    const rnd = mulberry32(SEED);              // our own stream: the world rnd stays where the other files left it
    const noise = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233 + SEED) * 43758.5453; return s - Math.floor(s); };
    for (const k in tally) tally[k] = 0;
    const OK = OVERWRITABLE();
    const put = (x, y, t) => { if (!mine(x, y)) return false; if (!OK.has(at(x, y)) && HEIGHT_OF[at(x, y)] === undefined) return false; set(x, y, t); return true; };
    const force = (x, y, t) => { if (!mine(x, y)) return false; set(x, y, t); return true; };
    CLASS.fill(4);
    for (let y = RC.y0; y <= RC.y1; y++) for (let x = RC.x0; x <= RC.x1; x++) CLASS[idx(x, y)] = classOf(x, y);
    // the ground as the other files left it, so the edge can give the far corners of the box back their grass
    const orig = map.slice();

    // 1. the ground: four heights over the table, dry scrub everywhere outside it (the edge, step 6c, then
    //    re-lays the scrub as the band that steps out from the rock to the country round it)
    for (let y = RC.y0; y <= RC.y1; y++) for (let x = RC.x0; x <= RC.x1; x++) {
      if (!OK.has(at(x, y))) continue;                       // water, and anything another feature put here, is left alone
      tally.converted++;
      const c = CLASS[idx(x, y)];
      // the wall edges wander a little so the canyon is not two smooth curves; the floor itself is untouched,
      // so nothing the connectivity of this place depends on moves
      const w = noise(x, y);
      // the wobble only ever turns a ledge into cliff, never a cliff into a ledge: a two-tile wall with two
      // ledges punched through it is a hole, and a hole in the wrong wall joins the mesa to the table
      const t = c === 0 ? RC_FLOOR
        : c === 1 ? (w > 0.72 ? RC_CLIFF : RC_LEDGE)
          : c === 2 ? RC_CLIFF
            : c === 3 ? RC_TOP : RC_SCRUB;
      put(x, y, t);
      if (t === RC_FLOOR) tally.floor++; else if (t === RC_LEDGE) tally.ledge++; else if (t === RC_CLIFF) tally.cliff++; else if (t === RC_TOP) tally.top++; else tally.scrub++;
    }

    // 2. the three climbs, cut through the walls after the ground is laid
    for (let y = RISE.y0; y <= RISE.y1; y++) for (let x = RISE.x0; x <= RISE.x1; x++) { force(x, y, RC_RAMP); tally.ramp++; }
    for (const [x, y] of STAIR) { force(x, y, RC_LEDGE); tally.ledge++; }
    for (const [x, y] of SWITCHBACK) { force(x, y, RC_LEDGE); tally.ledge++; }
    // 3. the Fall: a slab of the cliff came down and filled the spur. Walked over from the table, walked up
    //    and over from the canyon floor — the only place you cross the Redcut without climbing.
    for (let y = FALL.y0; y <= FALL.y1; y++) for (let x = FALL.x0; x <= FALL.x1; x++) {
      const c = cls(x, y); if (c === 3 || c === 4) continue;
      force(x, y, RC_FALL); tally.fall++;
    }

    // 4. the things that stand in it. Each one forces the ground under and around it, so nothing depends on
    //    where a noisy wall edge happened to land.
    const flat = (x, y, r, t) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) force(x + dx, y + dy, t); };
    flat(MARLOW.x, MARLOW.y, 2, RC_TOP); flat(WINCH_T.x - 1, WINCH_T.y, 1, RC_TOP);
    flat(HUX.x, HUX.y, 2, RC_FLOOR); flat(BASKET_T.x + 1, BASKET_T.y, 1, RC_FLOOR);
    force(WINCH_T.x, WINCH_T.y, RC_WINCH); force(BASKET_T.x, BASKET_T.y, RC_BASKET);
    force(FIRE_T.x, FIRE_T.y, T.FIRE);
    force(LAMP_T.x, LAMP_T.y, RC_LAMP);
    force(COIL_T.x, COIL_T.y, RC_COIL);
    force(BENCH_T.x, BENCH_T.y, T.WORKBENCH); force(BENCH_T.x - 1, BENCH_T.y, RC_FLOOR);
    for (const [x, y] of NESTS) { flat(x, y, 1, RC_TOP); force(x, y, RC_NEST); }
    for (const [x, y] of BOARDS) { force(x, y, RC_BOARD); for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) if (SOLID.has(at(x + dx, y + dy))) force(x + dx, y + dy, cls(x + dx, y + dy) === 4 ? RC_SCRUB : RC_TOP); }
    // the deep cache: a crack in the rock at the foot of the box head, and a pocket cut in behind it.
    // The pocket is walled all the way round bar the crack, so the crack is the only way in and the Agility
    // gate is a real gate rather than a decoration you can walk around.
    for (let y = CACHE_POCKET.y0 - 1; y <= CACHE_POCKET.y1 + 1; y++) for (let x = CACHE_POCKET.x0 - 1; x <= CACHE_POCKET.x1 + 1; x++) force(x, y, RC_CLIFF);
    for (let y = CACHE_POCKET.y0; y <= CACHE_POCKET.y1; y++) for (let x = CACHE_POCKET.x0; x <= CACHE_POCKET.x1; x++) force(x, y, RC_FLOOR);
    force(CRACK_T.x, CRACK_T.y, RC_CRACK); force(CRACK_T.x, CRACK_T.y - 1, RC_FLOOR);
    force(CACHE_T.x, CACHE_T.y, RC_CACHE);

    // 4b. RESEAL. Everything above forces ground under the things that stand in the Redcut, and a forced patch
    //     next to a wall punches a hole through it — one hole in the wrong wall and the mesa is joined to the
    //     table and the whole place stops reading as a plateau. So every tile the geometry calls wall is put
    //     back to cliff unless it is one of the ways in that were cut on purpose.
    {
      const opening = new Set();
      for (let y = RISE.y0; y <= RISE.y1; y++) for (let x = RISE.x0; x <= RISE.x1; x++) opening.add(x + ',' + y);
      for (let y = FALL.y0; y <= FALL.y1; y++) for (let x = FALL.x0; x <= FALL.x1; x++) opening.add(x + ',' + y);
      for (let y = CACHE_POCKET.y0 - 1; y <= CACHE_POCKET.y1 + 1; y++) for (let x = CACHE_POCKET.x0 - 1; x <= CACHE_POCKET.x1 + 1; x++) opening.add(x + ',' + y);
      for (const [x, y] of [...STAIR, ...SWITCHBACK]) opening.add(x + ',' + y);
      for (const n of NPCS) opening.add(n.x + ',' + n.y);
      let sealed = 0;
      for (let y = RC.y0; y <= RC.y1; y++) for (let x = RC.x0; x <= RC.x1; x++) {
        if (cls(x, y) !== 2 || opening.has(x + ',' + y)) continue;
        const t = at(x, y); if (SOLID.has(t) || PUSH_THROUGH.has(t)) continue;
        force(x, y, RC_CLIFF); sealed++;
      }
      tally.sealed = sealed;
    }

    // 5. redsalt seams: only on a canyon wall, and only where the eight tiles round the spot are already
    //    walkable, so a seam can never be the tile that cuts the canyon in two (the rule 62-ores uses)
    {
      const cands = [];
      for (let y = RC.y0; y <= RC.y1; y++) for (let x = RC.x0; x <= RC.x1; x++) {
        if (at(x, y) !== RC_FLOOR) continue;
        let open = true, wall = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const t = at(x + dx, y + dy);
          if (SOLID.has(t) || PUSH_THROUGH.has(t)) open = false;
          if (t === RC_CLIFF) wall = true;
        }
        if (!open) continue;
        // beside a wall, or one tile off it: a seam in the open middle of the floor would read as a boulder
        for (let dy = -2; dy <= 2 && !wall; dy++) for (let dx = -2; dx <= 2 && !wall; dx++) if (at(x + dx, y + dy) === RC_CLIFF) wall = true;
        if (wall) cands.push([x, y]);
      }
      for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = cands[i]; cands[i] = cands[j]; cands[j] = t; }
      const laid = [];
      const clear = [MARLOW, HUX, WINCH_T, BASKET_T, LAMP_T, COIL_T, BENCH_T, CRACK_T, CACHE_T];
      for (const [x, y] of cands) {
        if (tally.seams >= 14) break;
        if (laid.some(([lx, ly]) => Math.max(Math.abs(lx - x), Math.abs(ly - y)) < 5)) continue;
        if (clear.some(p => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= 3)) continue;
        force(x, y, RC_SALT); laid.push([x, y]); tally.seams++;
      }
      REDCUT_SEAMS.length = 0; for (const s of laid) REDCUT_SEAMS.push(s);
    }

    // 6. dressing: thorn bushes you walk through, fallen blocks you walk round. A block is only laid where all
    //    eight neighbours are walkable, so it can never close a way.
    for (let y = RC.y0; y <= RC.y1; y++) for (let x = RC.x0; x <= RC.x1; x++) {
      const t = at(x, y);
      // the scrub outside the table is dressed by the edge (6c), with its own bushes, blocks and dead trees
      if (t !== RC_TOP && t !== RC_FLOOR) continue;
      const n = noise(x * 3 + 7, y * 3 + 11);
      if (n > 0.94) {
        let open = true;
        for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1 && open; dx++) { if (!dx && !dy) continue; const q = at(x + dx, y + dy); if (SOLID.has(q) || PUSH_THROUGH.has(q)) open = false; }
        if (open && !NPCS.some(p => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= 3)) { force(x, y, RC_BOULDER); tally.boulders++; continue; }
      }
      if (n > 0.80 && n <= 0.90) { force(x, y, RC_BUSH); tally.bushes++; }
    }

    // 6c. THE EDGE: the band between the rock and the country round it (the drawing and the reasons are at
    //     "the edge" below). Every tile gets its distance from the rock (the table, the ring and its arms), a
    //     smooth noise moves that in and out (a tile or so at the foot of the rim, nearly three tiles out in
    //     the grass), and a per-tile jitter frays each step so two grounds dither into each other instead of
    //     meeting on a line. Inside the region box the placeholder scrub is re-laid; outside it only open grass
    //     becomes open ground and a tree becomes a dead tree (solid for solid), so no way anywhere opens or
    //     closes. A block or a dead tree added on open ground needs all eight tiles round it open.
    {
      const Tn = n => (n in T ? T[n] : -1);
      const FERN = Tn('FERN'), JUNGLE = Tn('JUNGLE');
      const OUT_GROUND = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, FERN].filter(v => v >= 0));
      const OUT_TREE = new Set([T.TREE, T.OAK, JUNGLE].filter(v => v >= 0));
      const GREEN_BACK = new Set([T.GRASS, T.FLOWERS, T.MUSHROOM, T.DIRT]);
      const E = tally.edge = { dust: 0, scree: 0, scrub: 0, dry: 0, green: 0, bush: 0, snag: 0, boulder: 0, tree: 0, deadTree: 0, outside: 0 };
      const RAW = ERAW, FLD = EFIELD;
      RAW.fill(1e9); FLD.fill(99);
      for (let y = EXT.y0; y <= EXT.y1; y++) for (let x = EXT.x0; x <= EXT.x1; x++) if (mine(x, y) && CLASS[idx(x, y)] < 4) RAW[ei(x, y)] = 0;
      // distance from the rock: a two-pass chamfer (1 straight, root 2 diagonal), exact enough for bands
      const R2 = Math.SQRT2;
      for (let j = 0; j < EH; j++) for (let i = 0; i < EW; i++) {
        const k = j * EW + i; let d = RAW[k];
        if (i > 0) d = Math.min(d, RAW[k - 1] + 1);
        if (j > 0) { d = Math.min(d, RAW[k - EW] + 1); if (i > 0) d = Math.min(d, RAW[k - EW - 1] + R2); if (i < EW - 1) d = Math.min(d, RAW[k - EW + 1] + R2); }
        RAW[k] = d;
      }
      for (let j = EH - 1; j >= 0; j--) for (let i = EW - 1; i >= 0; i--) {
        const k = j * EW + i; let d = RAW[k];
        if (i < EW - 1) d = Math.min(d, RAW[k + 1] + 1);
        if (j < EH - 1) { d = Math.min(d, RAW[k + EW] + 1); if (i < EW - 1) d = Math.min(d, RAW[k + EW + 1] + R2); if (i > 0) d = Math.min(d, RAW[k + EW - 1] + R2); }
        RAW[k] = d;
      }
      for (let y = EXT.y0; y <= EXT.y1; y++) for (let x = EXT.x0; x <= EXT.x1; x++) { const k = ei(x, y); FLD[k] = RAW[k] === 0 ? -1 : edgeField(x, y, RAW[k]); }

      // lay the band
      const regrow = [];
      for (let y = EXT.y0; y <= EXT.y1; y++) for (let x = EXT.x0; x <= EXT.x1; x++) {
        const k = ei(x, y); if (RAW[k] === 0) continue;
        const inside = mine(x, y), t = at(x, y);
        if (inside ? t !== RC_SCRUB : !(OUT_GROUND.has(t) || OUT_TREE.has(t))) continue;
        const to = edgeTier(x, y, FLD[k], RAW[k]);
        if (!inside && OUT_TREE.has(t)) {
          // a tree in the dry ground dies where it stands: solid for solid
          if (to !== null && to !== RC_DRYGRASS) { set(x, y, RC_SNAG); E.deadTree++; E.outside++; }
          else if (to === RC_DRYGRASS && hash(x, y, 4) < 0.55) { set(x, y, RC_SNAG); E.deadTree++; E.outside++; }
          continue;
        }
        if (to === null) {
          // past the band: green again. Inside the box that means giving back what the base world had there
          if (!inside) continue;
          const o = orig[idx(x, y)];
          set(x, y, GREEN_BACK.has(o) ? o : T.GRASS); E.green++;
          if (o === T.TREE || o === T.OAK) regrow.push([x, y, o]);
          continue;
        }
        set(x, y, to);
        if (!inside) E.outside++;
        if (to === RC_DUST) E.dust++; else if (to === RC_SCREE) E.scree++; else if (to === RC_DRYSCRUB) E.scrub++; else E.dry++;
      }

      // dress it: blocks at the foot of the rim, thorn bushes in the scrub, the odd dead tree in the dry grass,
      // and the base world's own trees back in the green corners of the box
      const open8 = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; if (!inMap(x + dx, y + dy)) return false; const q = at(x + dx, y + dy); if (SOLID.has(q) || PUSH_THROUGH.has(q)) return false; } return true; };
      const cheb = (p, x, y) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y));
      const keepClear = (x, y) => NPCS.some(p => cheb(p, x, y) <= 3) || MONSTER_SPAWNS.some(sp => Math.max(Math.abs(sp.tx - x), Math.abs(sp.ty - y)) <= 1)
        || [MOUTH, SLOT].some(p => cheb(p, x, y) <= 3) || BOARDS.some(([bx, by]) => Math.max(Math.abs(bx - x), Math.abs(by - y)) <= 1)
        || (x >= RISE.x0 - 3 && x <= RISE.x1 + 1 && y >= RISE.y0 - 2 && y <= RISE.y1 + 2) || !!buildingAt(x, y);
      const solidOk = (x, y) => open8(x, y) && !keepClear(x, y);
      for (let y = EXT.y0; y <= EXT.y1; y++) for (let x = EXT.x0; x <= EXT.x1; x++) {
        const t = at(x, y); if (!EDGE_GROUND.has(t)) continue;
        const inside = mine(x, y), h = hash(x, y, 7);
        if (t === RC_DUST || t === RC_SCREE) {
          if (inside && h > 0.9 && solidOk(x, y)) { set(x, y, RC_BOULDER); E.boulder++; }
        } else if (t === RC_DRYSCRUB) {
          if (h > 0.8 && h <= 0.89) { set(x, y, RC_DRYBUSH); E.bush++; }
          else if (inside && h > 0.975 && solidOk(x, y)) { set(x, y, RC_BOULDER); E.boulder++; }
        } else if (t === RC_DRYGRASS) {
          if (h > 0.85 && h <= 0.91) { set(x, y, RC_DRYBUSH); E.bush++; }
          else if (h > 0.96 && solidOk(x, y)) { set(x, y, RC_SNAG); E.snag++; }
        }
      }
      for (const [x, y, o] of regrow) if (hash(x, y, 9) < 0.6 && solidOk(x, y)) { set(x, y, o); E.tree++; }
      edgeState.gen++;
    }

    // 6b. the wobbled wall edges can leave a pocket of walkable rock shut inside a cliff: a hole nobody can
    //     stand in. Every walkable run in the Redcut that is smaller than six tiles and is not the deep cache
    //     is filled back in, so every walkable tile here is a tile you can actually get to.
    {
      const seen = new Uint8Array(MAP_W * MAP_H);
      const inCache = (x, y) => x >= CACHE_POCKET.x0 - 1 && x <= CACHE_POCKET.x1 + 1 && y >= CACHE_POCKET.y0 - 1 && y <= CACHE_POCKET.y1 + 1;
      for (let y = RC.y0; y <= RC.y1; y++) for (let x = RC.x0; x <= RC.x1; x++) {
        if (seen[idx(x, y)] || SOLID.has(at(x, y)) || inCache(x, y)) continue;
        // the whole run, not a capped slice of it: stopping early leaves the rest of a big region unseen, a
        // later scan starts inside it, walls itself in against the tiles already seen, and drops cliff pillars
        // in the middle of open ground
        const run = [], q = [[x, y]]; seen[idx(x, y)] = 1;
        while (q.length) {
          const [cx2, cy2] = q.pop(); run.push([cx2, cy2]);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx2 + dx, ny = cy2 + dy;
            if (!inMap(nx, ny) || seen[idx(nx, ny)] || SOLID.has(at(nx, ny))) continue;
            seen[idx(nx, ny)] = 1; q.push([nx, ny]);
          }
        }
        if (run.length >= 6) continue;
        for (const [fx, fy] of run) if (mine(fx, fy)) { force(fx, fy, RC_CLIFF); tally.walledIn++; }
      }
    }

    // 7. what lives here
    api.spawnList('rimhawk', HAWKS);
    api.spawnList('dustjaw', JAWS);
    for (const s of MONSTER_SPAWNS) {
      if (s.type !== 'rimhawk' && s.type !== 'dustjaw') continue;
      if (!SOLID.has(at(s.tx, s.ty))) continue;
      force(s.tx, s.ty, s.type === 'rimhawk' ? RC_TOP : RC_FLOOR);   // never wake inside a cliff
    }
  });

  // ---------- drawing ----------
  // Four heights, four tones, and two things that make the drop read without a word of explanation:
  //   a LIT RIM along the top edge of every cliff face, and a real CAST SHADOW thrown from the foot of that
  //   face onto whatever ground stands below it. Ground in the canyon is darkened by how deep it sits.
  // window.REDCUT.paint counts what was actually painted, so a self-test can prove the height is being drawn
  // rather than take the drawing code's word for it.
  const paint = { grounds: 0, faces: 0, rims: 0, shadows: 0, props: 0, lamps: 0, lampLit: 0 };
  const TONE = {
    [RC_FLOOR]: ['#4e2a20', '#573026', '#48261d'],
    [RC_SPENT]: ['#3f221a', '#472720', '#3a1f18'],
    [RC_LEDGE]: ['#8a4c30', '#965436', '#80452b'],
    [RC_RAMP]: ['#a9633c', '#b06a42', '#a05c37'],
    [RC_FALL]: ['#8a5236', '#94593c', '#824c32'],
    [RC_TOP]: ['#b86a3e', '#c07444', '#b06238'],
    [RC_SCRUB]: ['#9c8654', '#a48e5c', '#947e4d'],
    [RC_WINCH]: ['#b86a3e', '#c07444', '#b06238'], [RC_NEST]: ['#b86a3e', '#c07444', '#b06238'],
    [RC_BASKET]: ['#4e2a20', '#573026', '#48261d'], [RC_COIL]: ['#4e2a20', '#573026', '#48261d'],
    [RC_LAMP]: ['#8a4c30', '#965436', '#80452b'],
  };
  // a bush, a block or a board takes the tone of the ground it stands on: floor, ledge or table. Out in the band
  // it takes none, and the edge's colour wash is its ground like everything else there.
  const groundTone = (t, tx, ty) => {
    const tone = TONE[t]; if (tone) return tone;
    if (t !== RC_BUSH && t !== RC_BOULDER && t !== RC_BOARD) return null;
    const c = cls(tx, ty);
    return c === 0 ? TONE[RC_FLOOR] : c === 1 ? TONE[RC_LEDGE] : c === 3 ? TONE[RC_TOP] : null;
  };
  // the ground a cliff can throw its shadow on
  const SHADED = new Set([...EDGE_GROUND, RC_BUSH, RC_BOULDER, RC_SCRUB]);
  const CLIFF_FACE = ['#6b3320', '#733825', '#642e1d'];
  const CLIFF_CAP = '#c2764a';                       // the sunlit lip along the top of a face
  const CLIFF_DARK = '#3a1a11';

  // one flat item under everything: the ground tones, the depth shading, and the shadows the cliffs throw
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(EXT.x0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(EXT.x1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(EXT.y0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(EXT.y1, Math.ceil((cam.y + VH) / TILE) + 1);
    if (x1 < x0 || y1 < y0) return;
    items.push({ y: -8e8, draw: () => {
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const t = tileAt(tx, ty), tone = groundTone(t, tx, ty);
        const px = tx * TILE, py = ty * TILE;
        if (tone) {
          const v = variant[idx(tx, ty)] % 3;
          g.fillStyle = tone[v]; g.fillRect(px, py, TILE, TILE);
          paint.grounds++;
          // bedding planes: the rock was laid down in layers, so the ground shows them
          g.fillStyle = 'rgba(0,0,0,0.10)';
          for (let k = 0; k < 2; k++) g.fillRect(px, py + 12 + k * 18 + (v * 3), TILE, 2);
          g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(px, py + 10 + v * 3, TILE, 1);
          // the deeper it sits, the less sun reaches it
          const h = HEIGHT_OF[t] === undefined ? 4 : HEIGHT_OF[t];
          if (h < 4 && t !== RC_SCRUB) { g.fillStyle = `rgba(12,8,20,${(4 - h) * 0.055})`; g.fillRect(px, py, TILE, TILE); }
        }
        // the shadow a cliff throws on the ground below it: strongest against the face, gone six tiles down
        if (!tone && !SHADED.has(t)) continue;
        if (isCliff(tx, ty - 1)) {
          const gr = g.createLinearGradient(0, py, 0, py + 26);
          gr.addColorStop(0, 'rgba(10,6,14,0.5)'); gr.addColorStop(1, 'rgba(10,6,14,0)');
          g.fillStyle = gr; g.fillRect(px, py, TILE, 26); paint.shadows++;
        }
        // and the corners of it, so the shadow follows the shape of the wall rather than running in strips
        if (isCliff(tx - 1, ty)) { const gr = g.createLinearGradient(px, 0, px + 16, 0); gr.addColorStop(0, 'rgba(10,6,14,0.32)'); gr.addColorStop(1, 'rgba(10,6,14,0)'); g.fillStyle = gr; g.fillRect(px, py, 16, TILE); paint.shadows++; }
        if (isCliff(tx + 1, ty)) { const gr = g.createLinearGradient(px + TILE, 0, px + TILE - 12, 0); gr.addColorStop(0, 'rgba(10,6,14,0.22)'); gr.addColorStop(1, 'rgba(10,6,14,0)'); g.fillStyle = gr; g.fillRect(px + TILE - 12, py, 12, TILE); paint.shadows++; }
      }
    } });
  });

  // ---------- the edge, drawn ----------
  // THE WASH: one picture, one pixel a tile, over the whole reach of the band. Each pixel is the colour of the
  // ground at that tile's distance from the rock (red dust, tan scrub, straw, then nothing), drawn scaled up
  // with smoothing on, so the colour runs smoothly from tile centre to tile centre and no step has an edge.
  // It lies over the tile textures and under everything else; the rock's own flat tones paint over it.
  // Only open ground takes it: water, cobbles and anything built are left their own colour.
  const WASH = [
    // [field tiles from the rock, r, g, b, alpha]
    [-9, 154, 88, 57, 0.95], [0.8, 157, 92, 60, 0.94], [2.4, 166, 134, 86, 0.88], [4.6, 176, 160, 96, 0.56],
    [7.0, 160, 166, 88, 0.24], [9.0, 150, 160, 80, 0],
  ];
  const washAt = f => {
    if (f <= WASH[0][0]) return WASH[0];
    for (let i = 1; i < WASH.length; i++) if (f <= WASH[i][0]) { const a = WASH[i - 1], b = WASH[i], u = (f - a[0]) / (b[0] - a[0]); return a.map((v, k) => v + (b[k] - v) * u); }
    return WASH[WASH.length - 1];
  };
  const WASHED = new Set([...EDGE_GROUND, RC_SNAG, RC_SCRUB, RC_BUSH, RC_BOULDER, RC_BOARD]);
  const washable = t => WASHED.has(t) || t === T.GRASS || t === T.FLOWERS || t === T.MUSHROOM || t === T.DIRT || t === T.TREE || t === T.OAK || t === T.ROCK || t === T.STUMP
    || ('FERN' in T && t === T.FERN) || ('JUNGLE' in T && t === T.JUNGLE);
  const edgeDraw = { canvas: null, gen: -1, washes: 0, marks: 0, snags: 0, bushes: 0 };
  function buildWash() {
    edgeDraw.gen = edgeState.gen;
    const c = edgeDraw.canvas || (edgeDraw.canvas = document.createElement('canvas'));
    c.width = EW; c.height = EH;
    const w = c.getContext('2d'); if (!w) return;
    w.clearRect(0, 0, EW, EH);
    for (let y = EXT.y0; y <= EXT.y1; y++) for (let x = EXT.x0; x <= EXT.x1; x++) {
      const k = ei(x, y), t = tileAt(x, y);
      let col = null;
      if (ERAW[k] === 0) {
        // the rock itself: only the rim tiles beside the band carry the dust colour, so the wash runs right up
        // to the foot of the cliff instead of fading out half a tile short of it (the rock paints over them)
        let rim = false;
        for (let dy = -1; dy <= 1 && !rim; dy++) for (let dx = -1; dx <= 1 && !rim; dx++) if (inExt(x + dx, y + dy) && ERAW[ei(x + dx, y + dy)] > 0) rim = true;
        if (rim) col = WASH[0];
      } else if (washable(t) && !buildingAt(x, y)) col = washAt(EFIELD[k]);
      if (!col || col[4] <= 0.004) continue;
      w.fillStyle = `rgba(${col[1] | 0},${col[2] | 0},${col[3] | 0},${col[4].toFixed(3)})`;
      w.fillRect(x - EXT.x0, y - EXT.y0, 1, 1);
    }
  }
  // THE MARKS: small things on the ground, drawn once into a sprite per kind and variant and stamped per tile:
  // stones on the scree, a pebble and a crack in the dust, dry tufts in the scrub, straw blades in the dry grass
  const markSprites = {};
  const markSprite = (kind, v) => {
    const key = kind + v; if (markSprites[key] !== undefined) return markSprites[key];
    const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
    const m = c.getContext && c.getContext('2d'); if (!m) return (markSprites[key] = null);
    const r = mulberry32(SEED * 7 + kind.length * 131 + v * 17);
    const tuft = (x, y, h, col) => { m.strokeStyle = col; m.lineWidth = 1.4; for (let k = -2; k <= 2; k++) { m.beginPath(); m.moveTo(x, y); m.quadraticCurveTo(x + k * 1.6, y - h * 0.5, x + k * 3.2, y - h + Math.abs(k)); m.stroke(); } };
    const stone = (x, y, rx, ry, col) => { m.fillStyle = 'rgba(0,0,0,0.25)'; m.beginPath(); m.ellipse(x + 1, y + ry * 0.6, rx, ry * 0.55, 0, 0, 7); m.fill(); m.fillStyle = col; m.beginPath(); m.ellipse(x, y, rx, ry, 0, 0, 7); m.fill(); m.fillStyle = 'rgba(255,225,190,0.28)'; m.beginPath(); m.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.45, ry * 0.35, 0, 0, 7); m.fill(); };
    if (kind === 'scree') {
      for (let i = 0; i < 7; i++) stone(5 + r() * 38, 6 + r() * 36, 2.2 + r() * 3.2, 1.8 + r() * 2.2, ['#7c4a35', '#946046', '#6c3f2e'][i % 3]);
    } else if (kind === 'dust') {
      m.strokeStyle = 'rgba(60,28,18,0.28)'; m.lineWidth = 1.2; m.beginPath(); const cx = 10 + r() * 28, cy = 10 + r() * 28;
      m.moveTo(cx - 8, cy - 3); m.lineTo(cx - 2, cy); m.lineTo(cx + 3, cy - 2); m.lineTo(cx + 9, cy + 3); m.stroke();
      for (let i = 0; i < 2; i++) stone(6 + r() * 36, 6 + r() * 36, 1.6 + r() * 1.6, 1.3 + r() * 1.2, '#8a543b');
    } else if (kind === 'scrub') {
      for (let i = 0; i < 2; i++) tuft(8 + r() * 32, 18 + r() * 26, 7 + r() * 4, 'rgba(130,112,62,0.9)');
      stone(6 + r() * 36, 6 + r() * 36, 1.5, 1.2, '#8f7a52');
    } else if (kind === 'dry') {
      for (let i = 0; i < 3; i++) tuft(6 + r() * 36, 14 + r() * 30, 8 + r() * 5, i === 1 ? 'rgba(150,140,70,0.85)' : 'rgba(176,158,86,0.85)');
    }
    return (markSprites[key] = c);
  };
  const MARK_OF = { [RC_SCREE]: 'scree', [RC_DUST]: 'dust', [RC_DRYSCRUB]: 'scrub', [RC_DRYGRASS]: 'dry' };
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(EXT.x0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(EXT.x1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(EXT.y0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(EXT.y1, Math.ceil((cam.y + VH) / TILE) + 1);
    if (x1 < x0 || y1 < y0 || !edgeState.gen) return;
    // the wash: after the tile textures and 39-worldblend's feathering, before the rock's flat tones
    items.push({ y: -8.5e8, draw: () => {
      if (edgeDraw.gen !== edgeState.gen) buildWash();
      if (!edgeDraw.canvas) return;
      // a block, a board or a bush out in the band stands on sand-textured tiles of the Redcut's own (they are
      // the same tiles that stand on the table and the canyon floor, where a flat tone covers them): give them
      // the grass the rest of the band is washed over, so none of them sits on a pale square
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const t = tileAt(tx, ty); if ((t !== RC_BOULDER && t !== RC_BOARD && t !== RC_BUSH) || cls(tx, ty) !== 4) continue;
        const img = tex['grass' + (variant[idx(tx, ty)] % 3)]; if (img) g.drawImage(img, tx * TILE, ty * TILE, TILE, TILE);
      }
      const smooth = g.imageSmoothingEnabled;
      g.imageSmoothingEnabled = true;
      g.drawImage(edgeDraw.canvas, 0, 0, EW, EH, EXT.x0 * TILE, EXT.y0 * TILE, EW * TILE, EH * TILE);
      g.imageSmoothingEnabled = smooth;
      edgeDraw.washes++;
    } });
    // the marks: after the rock's tones, before anything that stands up
    items.push({ y: -7.95e8, draw: () => {
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const kind = MARK_OF[tileAt(tx, ty)]; if (!kind) continue;
        const v = variant[idx(tx, ty)] % 3, spr = markSprite(kind, v);
        if (spr) { g.drawImage(spr, tx * TILE, ty * TILE); edgeDraw.marks++; }
      }
    } });
  });
  // a dead tree: a bleached trunk that forks, bare branches, no leaves, and its shadow on the dry ground
  function drawSnag(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)] % 3, lean = (v - 1) * 2.5;
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx + 4, cy + 16, 15, 5, 0, 0, 7); g.fill();
    g.strokeStyle = '#6e5a46'; g.lineCap = 'round';
    g.lineWidth = 6; g.beginPath(); g.moveTo(cx, cy + 16); g.lineTo(cx + lean, cy - 8); g.stroke();
    g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(cx + lean, cy - 6); g.lineTo(cx + lean - 11, cy - 22); g.stroke();
    g.beginPath(); g.moveTo(cx + lean, cy - 8); g.lineTo(cx + lean + 9, cy - 26); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx + lean - 6, cy - 14); g.lineTo(cx + lean - 15, cy - 13); g.stroke();
    g.beginPath(); g.moveTo(cx + lean + 5, cy - 18); g.lineTo(cx + lean + 14, cy - 17); g.stroke();
    g.beginPath(); g.moveTo(cx + lean + 9, cy - 26); g.lineTo(cx + lean + 7, cy - 32); g.stroke();
    g.strokeStyle = 'rgba(235,220,195,0.35)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx - 1.5, cy + 14); g.lineTo(cx + lean - 1.5, cy - 7); g.stroke();
    g.lineCap = 'butt';
    edgeDraw.snags++;
  }
  // a dry thorn bush: the dust bush's shape, in straw
  function drawDryBush(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), sway = Math.sin(time * 1.3 + tx) * 1.2;
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.ellipse(cx, cy + 11, 11, 3.5, 0, 0, 7); g.fill();
    g.strokeStyle = '#8f7f45'; g.lineWidth = 1.7;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(cx, cy + 10); g.quadraticCurveTo(cx + k * 3.5, cy, cx + k * 6 + sway, cy - 8 - Math.abs(k) * 0.8); g.stroke(); }
    g.strokeStyle = '#b39f5c'; g.lineWidth = 1.1;
    for (let k = -2; k <= 2; k += 2) { g.beginPath(); g.moveTo(cx, cy + 9); g.lineTo(cx + k * 5 + sway, cy - 6); g.stroke(); }
    edgeDraw.bushes++;
  }

  // the cliffs themselves, one item a tile so a knight walking south of a wall is drawn in front of it
  function drawCliff(g, tx, ty) {
    const px = tx * TILE, py = ty * TILE, v = variant[idx(tx, ty)] % 3;
    const capped = !isCliff(tx, ty - 1);          // the top of the wall: this is where the lit rim goes
    const open = !isCliff(tx, ty + 1);            // the foot of the wall: this is where the face shows
    const top = capped ? py - 12 : py;
    g.fillStyle = CLIFF_FACE[v]; g.fillRect(px, top, TILE, py + TILE - top);
    paint.faces++;
    // vertical fracture lines down the face
    g.fillStyle = 'rgba(0,0,0,0.26)';
    for (let k = 0; k < 3; k++) { const fx = px + 6 + ((v + k) * 13) % (TILE - 10); g.fillRect(fx, top + 4, 2, py + TILE - top - 6); }
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let k = 0; k < 2; k++) { const fx = px + 11 + ((v + k) * 17) % (TILE - 16); g.fillRect(fx, top + 6, 1, py + TILE - top - 10); }
    if (capped) {
      g.fillStyle = CLIFF_CAP; g.fillRect(px, top, TILE, 9);                 // the sun on the lip
      g.fillStyle = 'rgba(255,220,170,0.35)'; g.fillRect(px, top, TILE, 3);
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(px, top + 9, TILE, 3);    // and the shade straight under it
      paint.rims++;
    }
    if (open) { g.fillStyle = CLIFF_DARK; g.fillRect(px, py + TILE - 9, TILE, 9); }  // the dark foot of the face
    if (!isCliff(tx - 1, ty)) { g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(px, top, 3, py + TILE - top); }
    if (!isCliff(tx + 1, ty)) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(px + TILE - 3, top, 3, py + TILE - top); }
  }
  function drawSeam(g, tx, ty) {
    drawCliff(g, tx, ty);
    const cx = tc(tx), cy = tc(ty);
    const a = 0.22 + Math.sin(time * 1.7 + tx * 1.1 + ty * 0.6) * 0.06;
    const gr = g.createRadialGradient(cx, cy, 3, cx, cy, 26);
    gr.addColorStop(0, `rgba(240,120,110,${a.toFixed(3)})`); gr.addColorStop(1, 'rgba(240,120,110,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.fill();
    g.fillStyle = '#d4726a';
    for (const [ox, oy, r] of [[-9, 2, 3.0], [3, -5, 2.6], [8, 7, 2.2], [-3, 9, 2.0], [1, -11, 1.8]]) { g.beginPath(); g.arc(cx + ox, cy + oy, r, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(cx - 8, cy + 1, 1.1, 0, 7); g.fill();
  }
  function drawCrack(g, tx, ty) {
    drawCliff(g, tx, ty);
    const px = tx * TILE, py = ty * TILE, open = skillLv('agility') >= CRACK_LV;
    g.fillStyle = '#120a08'; g.beginPath();
    g.moveTo(px + 20, py); g.lineTo(px + 27, py + 14); g.lineTo(px + 19, py + 26); g.lineTo(px + 28, py + TILE);
    g.lineTo(px + 34, py + TILE); g.lineTo(px + 26, py + 25); g.lineTo(px + 33, py + 13); g.lineTo(px + 27, py);
    g.closePath(); g.fill();
    if (open) { g.strokeStyle = `rgba(126,231,135,${0.35 + Math.sin(time * 3) * 0.15})`; g.lineWidth = 2; g.strokeRect(px + 15, py + 4, 20, TILE - 8); }
  }
  function drawCache(g, tx, ty) {
    const px = tx * TILE, py = ty * TILE, taken = player.chests && player.chests.includes(tx + ',' + ty);
    g.fillStyle = CLIFF_FACE[1]; g.fillRect(px, py - 10, TILE, TILE + 10);
    g.fillStyle = '#2a1710'; g.beginPath(); g.moveTo(px + 6, py + TILE); g.quadraticCurveTo(px + TILE / 2, py - 2, px + TILE - 6, py + TILE); g.closePath(); g.fill();
    g.fillStyle = taken ? '#5a4a3a' : '#8a6a3a'; g.fillRect(px + 13, py + 20, 22, 16);
    g.fillStyle = taken ? '#3a3128' : '#c9a36a'; g.fillRect(px + 13, py + 20, 22, 5);
    if (!taken) { const gr = g.createRadialGradient(tc(tx), tc(ty) + 6, 2, tc(tx), tc(ty) + 6, 30); gr.addColorStop(0, `rgba(245,197,66,${0.25 + Math.sin(time * 2) * 0.08})`); gr.addColorStop(1, 'rgba(245,197,66,0)'); g.fillStyle = gr; g.beginPath(); g.arc(tc(tx), tc(ty) + 6, 30, 0, 7); g.fill(); }
  }
  function drawBoulder(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)] % 3;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, cy + 12, 17, 6, 0, 0, 7); g.fill();
    g.fillStyle = ['#8d5a3a', '#7d4e31', '#96633f'][v]; g.beginPath();
    for (const [x, y] of [[-17, 5], [-13, -8], [-3, -14], [9, -12], [16, -2], [14, 9], [1, 13], [-9, 12]]) g.lineTo(cx + x, cy + y);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,220,170,0.22)'; g.beginPath(); g.moveTo(cx - 9, cy - 6); g.lineTo(cx - 1, cy - 12); g.lineTo(cx + 7, cy - 10); g.lineTo(cx - 3, cy - 4); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(cx - 15, cy + 5, 30, 4);
  }
  function drawBush(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), sway = Math.sin(time * 1.3 + tx) * 1.2;
    g.strokeStyle = '#6a6a3a'; g.lineWidth = 1.6;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx, cy + 10); g.quadraticCurveTo(cx + k * 4, cy, cx + k * 7 + sway, cy - 9 - Math.abs(k)); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.ellipse(cx, cy + 11, 9, 3, 0, 0, 7); g.fill();
  }
  function drawWinch(g, tx, ty) {
    const px = tx * TILE, py = ty * TILE, cx = tc(tx), cy = tc(ty);
    const run = quest.redcut && quest.redcut.winch;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, cy + 13, 17, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#6a4a2a'; g.fillRect(px + 6, py + 8, 6, 30); g.fillRect(px + TILE - 12, py + 8, 6, 30);   // the two posts
    g.fillStyle = '#8a6a3a'; g.fillRect(px + 4, py + 6, TILE - 8, 8);                                        // the drum
    g.fillStyle = '#5a4632'; for (let k = 0; k < 4; k++) g.fillRect(px + 7 + k * 8, py + 6, 2, 8);
    g.strokeStyle = run ? '#c9a36a' : '#7a6a5a'; g.lineWidth = 2;                                            // the rope over the edge
    g.beginPath(); g.moveTo(cx, py + 14); g.lineTo(cx + (run ? 0 : 4), py + TILE + (run ? 6 : -4)); g.stroke();
    if (run) { g.strokeStyle = '#8d9098'; g.lineWidth = 3; g.beginPath(); g.arc(px + TILE - 9, py + 10, 7, 0, 7); g.stroke(); }  // the handle, once it is fitted
    else { g.fillStyle = '#8b949e'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('CUT', cx, py + 30); }
  }
  function drawBasket(g, tx, ty) {
    const px = tx * TILE, py = ty * TILE, cx = tc(tx);
    const run = quest.redcut && quest.redcut.winch;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, py + 38, 15, 5, 0, 0, 7); g.fill();
    g.strokeStyle = run ? '#c9a36a' : '#6a5a4a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, py - 12); g.lineTo(cx, py + 16); g.stroke();
    g.fillStyle = '#8a6a3a'; g.beginPath(); g.moveTo(px + 10, py + 18); g.lineTo(px + TILE - 10, py + 18); g.lineTo(px + TILE - 14, py + 38); g.lineTo(px + 14, py + 38); g.closePath(); g.fill();
    g.strokeStyle = '#5a4632'; g.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(px + 11 + k, py + 23 + k * 6); g.lineTo(px + TILE - 11 - k, py + 23 + k * 6); g.stroke(); }
  }
  function drawNest(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), taken = player.chests && player.chests.includes(tx + ',' + ty);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx, cy + 11, 18, 6, 0, 0, 7); g.fill();
    g.strokeStyle = '#7a6242'; g.lineWidth = 2;
    for (let k = 0; k < 9; k++) { const a = k * 0.7; g.beginPath(); g.moveTo(cx - 16 + k * 3.5, cy + 8 - (k % 3)); g.lineTo(cx + 16 - k * 2.6, cy - 2 + Math.sin(a) * 5); g.stroke(); }
    g.fillStyle = '#3a2a1e'; g.beginPath(); g.ellipse(cx, cy + 2, 11, 6, 0, 0, 7); g.fill();
    if (!taken) { g.fillStyle = '#f5c542'; for (const [ox, oy] of [[-4, 1], [2, 3], [5, -1]]) { g.beginPath(); g.arc(cx + ox, cy + oy, 2.4, 0, 7); g.fill(); } }
  }
  function drawLamp(g, tx, ty) {
    paint.lamps++;
    // lit while the lamp is still on its spike: it goes dark the moment the knight takes it, whatever stage
    const q = quest.redcut, lit = !(q && (q.lamp || q.stage >= 2));
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.24)'; g.beginPath(); g.ellipse(cx, cy + 12, 9, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#6a5a4a'; g.fillRect(cx - 6, cy - 4, 12, 14); g.fillRect(cx - 2, cy - 12, 4, 8);
    if (lit) {
      paint.lampLit++;
      const a = 0.5 + Math.sin(time * 6) * 0.2;
      g.fillStyle = `rgba(255,200,110,${a})`; g.fillRect(cx - 4, cy - 2, 8, 10);
      const gr = g.createRadialGradient(cx, cy + 2, 3, cx, cy + 2, 52); gr.addColorStop(0, `rgba(255,190,90,${0.3 * a})`); gr.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy + 2, 52, 0, 7); g.fill();
    } else { g.fillStyle = '#2a2018'; g.fillRect(cx - 4, cy - 2, 8, 10); }
  }
  function drawCoil(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.24)'; g.beginPath(); g.ellipse(cx, cy + 10, 15, 5, 0, 0, 7); g.fill();
    g.strokeStyle = '#b09a6a'; g.lineWidth = 3.5;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx, cy + 4 - k * 3, 14 - k * 2, 6 - k, 0, 0, 7); g.stroke(); }
    g.strokeStyle = '#8a7450'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 12, cy - 6); g.lineTo(cx + 12, cy - 9); g.stroke();
  }
  function drawBoard(g, tx, ty) {
    const px = tx * TILE, py = ty * TILE, cx = tc(tx);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, py + 40, 12, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#6a4a2a'; g.fillRect(cx - 3, py + 16, 6, 24);
    g.fillStyle = '#8a6a3a'; g.fillRect(px + 4, py + 6, TILE - 8, 18);
    g.fillStyle = '#5a4632'; g.fillRect(px + 4, py + 6, TILE - 8, 3);
    g.fillStyle = '#e6d5b0'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center';
    g.fillText('THE', cx, py + 14); g.fillText('REDCUT', cx, py + 22);
  }
  function drawRampSteps(g, tx, ty) {
    const px = tx * TILE, py = ty * TILE;
    g.fillStyle = 'rgba(0,0,0,0.22)'; for (let k = 0; k < 3; k++) g.fillRect(px, py + 6 + k * 14, TILE, 3);
    g.fillStyle = 'rgba(255,220,170,0.18)'; for (let k = 0; k < 3; k++) g.fillRect(px, py + 9 + k * 14, TILE, 2);
  }
  function drawFallRubble(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty), v = variant[idx(tx, ty)] % 3;
    g.fillStyle = ['#6b4230', '#75492f', '#5f3a29'][v];
    for (const [ox, oy, r] of [[-13, -6, 8], [4, -9, 7], [12, 2, 8], [-6, 8, 7], [2, 4, 6]]) { g.beginPath(); g.ellipse(cx + ox, cy + oy, r, r * 0.75, v, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,220,170,0.16)';
    for (const [ox, oy, r] of [[-13, -9, 5], [4, -12, 4], [12, -1, 5]]) { g.beginPath(); g.ellipse(cx + ox, cy + oy, r, r * 0.4, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(cx - 24, cy + 12, TILE, 5);
  }

  const PROP = { [RC_CLIFF]: drawCliff, [RC_SALT]: drawSeam, [RC_CRACK]: drawCrack, [RC_CACHE]: drawCache, [RC_BOULDER]: drawBoulder, [RC_BUSH]: drawBush, [RC_WINCH]: drawWinch, [RC_BASKET]: drawBasket, [RC_NEST]: drawNest, [RC_LAMP]: drawLamp, [RC_COIL]: drawCoil, [RC_BOARD]: drawBoard, [RC_RAMP]: drawRampSteps, [RC_FALL]: drawFallRubble, [RC_SNAG]: drawSnag, [RC_DRYBUSH]: drawDryBush };
  HOOKS.draw.push((g, items) => {
    const x0 = Math.max(EXT.x0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(EXT.x1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(EXT.y0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(EXT.y1, Math.ceil((cam.y + VH) / TILE) + 2);
    if (x1 < x0 || y1 < y0) return;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const f = PROP[tileAt(tx, ty)]; if (!f) continue;
      const flat = f === drawRampSteps || f === drawFallRubble;
      items.push({ y: flat ? -7.9e8 : ty * TILE + TILE - 2, draw: () => { f(g, tx, ty); paint.props++; } });
    }
  });

  // ---------- the story: THE CUT ROPE ----------
  // Not a fetch. Marlow has been sitting at his winch for eight days with a rope that was cut clean through,
  // certain that somebody up on the rim cut it and left his partner at the bottom. Everything he believes is
  // wrong, and the thing that proves it is a length of rope: the winch is still holding the LONG piece. Cut a
  // rope from the top and the top keeps the short end. The rest of it is at the bottom, coiled and tied off by
  // somebody who wanted it there. Hux cut it himself, from below, and he is not sorry.
  QUEST_DEFS.redcut = { name: 'The Cut Rope' };
  const Q = () => { if (!quest.redcut || typeof quest.redcut !== 'object') quest.redcut = { stage: 0, winch: false, lamp: false, coil: false, salt: false, rode: 0 }; return quest.redcut; };
  HOOKS.newGame.push(() => { quest.redcut = { stage: 0, winch: false, lamp: false, coil: false, salt: false, rode: 0 }; });
  HOOKS.activeQuests.push(() => (Q().stage > 0 && Q().stage < 4 ? ['redcut'] : []));
  HOOKS.questText.redcut = () => {
    const q = Q();
    if (q.stage === 1) return 'Marlow says his partner Hux went down into the Redcut eight days ago and the rope was cut. Get down to the canyon floor — the switchback is the three ledges just north of his camp — and find out what happened to him.';
    if (q.stage === 2) return "Hux's lamp was still burning on the middle ledge, eight days after he went down. Somebody has been filling it. Keep going down to the box head at the foot of the spur and find him.";
    if (q.stage === 3) return "Hux cut the rope himself and gave you his tally book to prove why. Climb back up the switchback to Marlow's camp on the rim and show him the numbers.";
    return 'Find Marlow the prospector on the rim above the Redcut, on the table west of the spur.';
  };
  HOOKS.mapTarget.push(() => {
    const q = Q();
    if (q.stage === 1) return { x: SWITCHBACK[0][0], y: SWITCHBACK[0][1], label: 'The switchback', id: 'redcut' };
    if (q.stage === 2) return { x: HUX.x, y: HUX.y, label: 'The box head', id: 'redcut' };
    if (q.stage === 3 || q.stage === 0) return { x: MARLOW.x, y: MARLOW.y, label: 'Marlow the prospector', id: 'redcut' };
    return null;
  });

  HOOKS.talk.redcut_rim = n => {
    const q = Q();
    if (q.stage === 0) {
      // The lamp hangs on the switchback, and a knight can reach it before he ever meets Marlow. If he already
      // has it, the story is already past the lamp: go straight to stage 2, or the lamp (taken once) could never
      // move it on and the quest would stick at stage 1 for good.
      q.stage = q.lamp ? 2 : 1;
      say('Eight days. Eight days I have sat here with a cut rope in my hand.', n.name);
      say('Hux went down on that rope to work the seam. Somebody cut it. Look at the end — clean as a butcher. Somebody stood where you are standing and cut my partner loose.', n.name);
      if (q.lamp) say('You have been down the ledges already? And his lamp was still burning on the middle one, eight days on? Then somebody has been filling it, and that somebody is Hux. Go on down to the bottom and find him. Take the end with you. He knows his own knot.', n.name);
      else say('My knee will not take the switchback, and I will not leave the winch. You take the ledges — three of them, just north of here — and you go down and you find him. Take the end with you. He knows his own knot.', n.name);
      if (!countItem('cut_rope')) giveOrDrop('cut_rope', 1, player.x, player.y);
      quest.tracked = 'redcut'; save(); return;
    }
    if (q.stage === 1) { say('Three ledges north of the fire. Go down slow and keep your hand on the rock.', n.name); return; }
    if (q.stage === 2) { say('You found the lamp? Then he lit it. Keep going down, knight.', n.name); return; }
    if (q.stage === 3) {
      if (!countItem('hux_tally')) { say('He gave you a book, you said. Come back when you have it in your hand.', n.name); return; }
      q.stage = 4; q.winch = true;
      removeItem('hux_tally', 1); removeItem('cut_rope', 1);
      say('That is his hand. That is his counting. Eight days...', n.name);
      say('Eight days on his own and he cut more than the two of us cut in a month. I have been taking the best of every seam and handing him the rubble, and telling myself it was because I am the older man.', n.name);
      say('He did not cut the rope to get away from the canyon. He cut it to get away from me. Well. He can have it.', n.name);
      say('Here — the handle off the drum. I am fitting it back on and I am leaving it running, and you may ride it down whenever you like. Somebody ought to be able to reach him.', n.name);
      addItem('coins', 350); gainXp('mining', 400);
      floatText(player.x, player.y - 34, '+350 coins', '#ffd166', 15);
      notify('The winch runs. Press USE on it to ride down, and on the basket to ride up.');
      save(); return;
    }
    const lines = ['Ride it down. It holds twice a knight and a load of salt.', 'He waves at me of a morning. That is as much as either of us wants.', 'Redsalt, that is what the seams are. Mining 22 and a pick, and it cures beef so it never spoils.'];
    say(lines[Math.floor(Math.random() * lines.length)], n.name);
  };

  HOOKS.talk.redcut_deep = n => {
    const q = Q();
    if (q.stage < 2) { say('You came down the ledges. Nobody comes down the ledges.', n.name); say('Whatever he told you up there, he told you wrong. Look about you first. Then come and ask me.', n.name); return; }
    if (q.stage === 2) {
      if (!q.coil) { say('You have not looked at my rope yet. It is over there, coiled and tied. Look at it, then ask me your question.', n.name); return; }
      q.stage = 3;
      say('You worked it out, then. Nobody up top cut anything. I cut it down here, and I coiled the rest and tied it off because good rope is good rope.', n.name);
      say('Forty years he has taken the bright half of every seam and left me the rubble, and he has never once said so out loud. I could not say it out loud either. So I cut the rope.', n.name);
      say('I am not coming up. Take him this. Eight days of counts, every one of them mine. He does not listen to a word anybody says, but he has never in his life argued with a number.', n.name);
      if (!countItem('hux_tally')) giveOrDrop('hux_tally', 1, player.x, player.y);
      if (!q.salt) { q.salt = true; giveOrDrop('redsalt', 3, player.x, player.y); say('And take some salt with you. Red seams, in the walls, all the way round. Cure your beef with it and it will keep for ever.', n.name); }
      save(); return;
    }
    if (q.stage === 3) { say('Show him the book. He will not argue with the numbers.', n.name); return; }
    const lines = ['The bench is yours if you want it. Beef and two salt and you eat well for a week.', 'He set the winch running. I did not ask him to. It is good of him.', 'Dustjaws chew the salt out of the wall. Let them have the low seams and take the high ones.'];
    say(lines[Math.floor(Math.random() * lines.length)], n.name);
  };

  if (window.QUESTITEMS) {
    QUESTITEMS.register({ id: 'cut_rope', from: 'marlow', role: 'redcut_rim', needed: () => Q().stage >= 1 && Q().stage < 4, line: 'The end of the rope. Do not lose it again — it is the only piece of proof I have.' });
    QUESTITEMS.register({ id: 'hux_tally', from: 'hux', role: 'redcut_deep', needed: () => Q().stage === 3, line: 'I keep the counts in my head as well. Here is another book. Take it up to him.' });
  }

  // ---------- using the place ----------
  const ride = (tx, ty, ox, oy, down) => {
    const spot = safeSpot(tc(ox), tc(oy), 13, 'player') || { x: tc(ox), y: tc(oy) };
    burst(player.x, player.y, '#c9a36a', 20, 120);
    player.x = spot.x; player.y = spot.y; player.action = null;
    burst(player.x, player.y, '#c9a36a', 20, 120);
    Q().rode++; notify(down ? 'The basket runs down the rope into the Redcut.' : 'The drum turns and the basket climbs to the rim.'); sfx('open'); save();
  };
  HOOKS.use.push((t, tx, ty) => {
    const q = Q();
    if (t === RC_WINCH) {
      if (!q.winch) { say(q.stage === 0 ? 'A hand winch over the drop, and a cut rope hanging off the drum. Whoever owns it cannot be far.' : 'The drum has no handle and the rope is cut. Marlow will not run it until he knows what happened down there.', 'The Voice'); return true; }
      ride(tx, ty, BASKET_T.x + 1, BASKET_T.y, true); return true;
    }
    if (t === RC_BASKET) {
      if (!q.winch) { notify('A basket on a cut rope. It is not going anywhere.'); return true; }
      ride(tx, ty, WINCH_T.x - 1, WINCH_T.y, false); return true;
    }
    if (t === RC_LAMP) {
      // taking the lamp and moving the story on are two separate things: the lamp can be taken before Marlow
      // has told you anything, and a save from before this fix can hold { stage: 1, lamp: true }
      if (!q.lamp) {
        q.lamp = true; if (q.stage === 1) q.stage = 2;
        giveOrDrop('hux_lamp', 1, player.x, player.y);
        say("A lamp, hooked over a spike in the rock on the middle ledge. It is still burning. Eight days, and the oil has not run out — because somebody has been climbing up here to fill it.", 'The Voice');
        save();
      } else if (q.stage === 1) {
        q.stage = 2;
        if (!countItem('hux_lamp')) giveOrDrop('hux_lamp', 1, player.x, player.y);
        say("The spike in the rock where Hux's lamp hung. It was still burning when you took it. Eight days, and the oil had not run out — because somebody has been climbing up here to fill it.", 'The Voice');
        save();
      } else notify('The spike in the rock where the lamp hung.');
      return true;
    }
    if (t === RC_COIL) {
      if (!q.coil) {
        q.coil = true;
        say("The rest of the rope. All of it, coiled clean and tied off against the wall. The winch up on the rim is still holding the long piece — and a rope cut from the top leaves the top with the short end. Nobody up there cut this. It was cut down here, by somebody who wanted the rope where he could reach it.", 'The Voice');
        save();
      } else notify('Good rope, coiled and tied. Somebody looks after it.');
      return true;
    }
    if (t === RC_NEST) {
      const key = tx + ',' + ty;
      if (player.chests.includes(key)) { notify('An old nest. The hawks took everything shiny with them.'); return true; }
      player.chests.push(key);
      const coins = 40 + Math.floor(Math.random() * 60);
      giveOrDrop('coins', coins, player.x, player.y);
      giveOrDrop(Math.random() < 0.5 ? 'iron_arrow' : 'stone_arrow', 8 + Math.floor(Math.random() * 10), player.x, player.y);
      if (Math.random() < 0.4) giveOrDrop('redsalt', 1 + Math.floor(Math.random() * 2), player.x, player.y);
      say('A rimhawk nest, woven out of thorn. Hawks take whatever shines and they never spend it.', 'The Voice');
      burst(tc(tx), tc(ty), '#f5c542', 16, 90); save(); return true;
    }
    if (t === RC_CRACK) {
      notify(skillLv('agility') >= CRACK_LV ? 'A crack in the rock, just wide enough. Walk into it.' : `A crack in the rock at the foot of the Redcut. Agility ${CRACK_LV} to squeeze through.`);
      return true;
    }
    if (t === RC_CACHE) {
      const key = tx + ',' + ty;
      if (player.chests.includes(key)) { notify('The cache is empty. You took what was in it.'); return true; }
      player.chests.push(key);
      giveOrDrop('hux_pick', 1, player.x, player.y);
      giveOrDrop('redsalt', 8, player.x, player.y);
      giveOrDrop('coins', 220, player.x, player.y);
      say("A hole cut in the rock behind the crack, dry as a bone, with a pick standing in it. Hux's own — the good one, the one he cut the whole seam with. He left it where only somebody who could get through the crack would ever find it.", 'The Voice');
      levelBanner = { text: 'THE DEEP CACHE', sub: "Hux's pick", t: 3 };
      burst(tc(tx), tc(ty), '#f5c542', 30, 150); save(); return true;
    }
    if (t === RC_BOARD) {
      say(tx === BOARDS[0][0] ? 'THE REDCUT. The canyon runs right round under the table and comes out again at the slot, thirty paces east of here. Keep to the floor and you will come out the other end. The ledges go up. Do not go up in the wet.' : 'THE RISE. Cut steps to the table top. Marlow works the rim above the spur — follow the edge east and you will smell his fire.', 'The board');
      return true;
    }
    if (t === RC_BOULDER) { notify('A block off the cliff. It came down a long time ago.'); return true; }
    return false;
  });

  // the crack: solid below Agility 30, walkable at 30, the same rule as the pond stones and the palisade
  HOOKS.update.push(() => {
    if (skillLv('agility') >= CRACK_LV) WALK_OVER.add(RC_CRACK); else WALK_OVER.delete(RC_CRACK);
  });

  // ---------- what the audit should know about ----------
  if (HOOKS.xpSource) HOOKS.xpSource.push(add => {
    add('mining', 'redsalt seam (the Redcut)', SALT_LV, 82, 4.0, 'bronze pickaxe, at the level it opens');
    add('cooking', `salt beef at a workbench (${beefNeeds('raw_beef')} beef + ${beefNeeds('redsalt')} redsalt → ${SALT_BEEF.qty})`, SALT_BEEF.lv, SALT_BEEF.xp, 12, 'the redsalt is mined in the Redcut');
  });

  // ---------- the book ----------
  if (window.WIKI) WIKI.add('places', { id: 'redcut', name: 'The Redcut', lines: [
    'A table of red rock in the far south-east, with a canyon cut right round inside it. Four heights: the table on top, the ledges, the cliff faces, and the canyon floor in the shade at the bottom.',
    '',
    'GETTING THERE. Harl\'s ferry to the Far Shore (combat level 10, 40 coins), then south past the stormstone diggings until the ground goes red and stands up in front of you.',
    'THE MOUTH, x 215 y 103, is a walk straight in at floor level. Follow the canyon either way round and you come out of THE SLOT, x 246 y 101, back on the same scrub thirty paces east — the short way between the diggings and the east side.',
    'THE RISE, x 206 y 139, is a ramp of cut steps through the west escarpment onto the table.',
    'THE STAIR, x 220 y 117, climbs out of the canyon onto the mesa the ring encircles. There is no other way onto it.',
    'THE SWITCHBACK, three ledges at x 223–227 y 147–151, drops from Marlow\'s camp into the spur.',
    'THE FALL, y 143–144, is a slab of cliff that came down and filled the spur. Walk over it from the table, or up and over it from the floor.',
    '',
    'WHAT LIVES THERE. Rimhawks (level 34) nest on the mesa and dive at anything that walks it. Dustjaws (level 42) chew the salt out of the canyon walls; they are slow and short-sighted and you can walk round one if you keep your distance.',
    `WHAT IS IN IT. Redsalt, Mining ${SALT_LV}, from the seams in the canyon walls — it is mined nowhere else. ${beefNeeds('redsalt')} redsalt and ${beefNeeds('raw_beef')} raw beef at any workbench (Cooking ${SALT_BEEF.lv}) make ${SALT_BEEF.qty} salt beef, which heals ${ITEMS.salt_beef.heal} and cannot burn.`,
    `THE DEEP CACHE, behind the crack at the foot of the box head. Agility ${CRACK_LV} to squeeze through. Hux's pick is in it: tier ${ITEMS.hux_pick.tier}, the same as a Mithril pickaxe, and the only pick that cuts ${1 + HUX_SALT_EXTRA} redsalt out of a seam where any other pick cuts 1.`,
    'THE CUT ROPE. Marlow the prospector sits at his winch on the rim. His partner Hux went down eight days ago and the rope was cut. Marlow is wrong about who cut it, and the rope itself is what proves it.',
  ] });
  if (window.WIKI) WIKI.add('quests', { id: 'redcut', name: 'The Cut Rope', lines: [
    'Marlow the prospector, on the rim of the Redcut.',
    '',
    'Marlow has sat at his winch for eight days holding a rope that was cut clean through, certain somebody on the rim cut his partner loose. Go down the switchback and find out.',
    'On the middle ledge there is a lamp that is still burning after eight days. At the bottom there is the rest of the rope, coiled and tied against the wall — and the winch on the rim is still holding the long piece. Cut a rope from the top and the top keeps the short end.',
    'Hux cut it himself, from below, and he will tell you why if you have looked at the rope first.',
    'Reward: 350 coins, 400 Mining xp, and Marlow fits the handle back on the drum and leaves the winch running for good — ride it down from the rim, ride it up from the floor.',
  ] });

  window.REDCUT = { EXT, edge: { dust: RC_DUST, scree: RC_SCREE, scrub: RC_DRYSCRUB, dry: RC_DRYGRASS, bush: RC_DRYBUSH, snag: RC_SNAG }, edgeDraw, edgeRaw: ERAW, edgeField: EFIELD, TIERS, inPl, RC, CX, CY, RX, RY, ARC, SPUR, MOUTH, SLOT, RISE, STAIR, SWITCHBACK, FALL, WINCH_T, BASKET_T, LAMP_T, COIL_T, CRACK_T, CACHE_T, BENCH_T, MARLOW, HUX, NESTS, BOARDS, HAWKS, JAWS, SEAMS: REDCUT_SEAMS,
    tiles: { top: RC_TOP, ledge: RC_LEDGE, floor: RC_FLOOR, cliff: RC_CLIFF, scrub: RC_SCRUB, ramp: RC_RAMP, fall: RC_FALL, salt: RC_SALT, crack: RC_CRACK, cache: RC_CACHE, winch: RC_WINCH, basket: RC_BASKET, nest: RC_NEST, lamp: RC_LAMP, coil: RC_COIL, board: RC_BOARD, boulder: RC_BOULDER, bush: RC_BUSH, spent: RC_SPENT },
    tally, paint, HEIGHT_OF, classOf, CRACK_LV, SALT_LV, quest: Q };

  // ---------- self-test ----------
  const P = 'redcut: ';
  const WALKABLE = () => new Set([RC_TOP, RC_LEDGE, RC_FLOOR, RC_SCRUB, RC_RAMP, RC_FALL, RC_SPENT, RC_BUSH]);
  // BFS over a chosen set of tiles only: used to prove the route through the canyon really is the canyon
  const bfsIn = (sx, sy, tx, ty, allow) => {
    const seen = new Uint8Array(MAP_W * MAP_H), q = [idx(sx, sy)]; seen[idx(sx, sy)] = 1;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % MAP_W, y = (c / MAP_W) | 0;
      if (x === tx && y === ty) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny);
        if (seen[n] || !allow(tileAt(nx, ny), nx, ny)) continue; seen[n] = 1; q.push(n);
      }
    }
    return false;
  };
  HOOKS.selfTest.push((check, F, h) => {
    if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
    h.peace(true); closePanel(); player.action = null;
    const LAND = [206, 30];   // where Harl's ferry puts you down on the Far Shore: the root the audit uses for x ≥ 200
    const walk = (x, y) => !!F.bfs(LAND[0], LAND[1], x, y);
    const beside = (x, y) => { for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (!SOLID.has(tileAt(x + dx, y + dy)) && walk(x + dx, y + dy)) return true; return false; };

    // 1. the place exists, with the counts it claims
    { const c = {}; for (let y = RC.y0; y <= RC.y1; y++) for (let x = RC.x0; x <= RC.x1; x++) { const n = tileName(tileAt(x, y)); c[n] = (c[n] || 0) + 1; }
      // the ground at the foot of the table: the edge's dust, scree, scrub and dry grass (it was all one scrub)
      const foot = (c.REDDUST || 0) + (c.REDSCREE || 0) + (c.DRYSCRUB || 0) + (c.DRYGRASS || 0) + (c.DRYBUSH || 0) + (c.REDSCRUB || 0);
      const reg = REGIONS.find(r => r.name === 'The Redcut');
      check(P + 'The Redcut is a region in the bottom-right, and the table is cut into four heights: canyon floor, ledge, cliff and table top',
        !!reg && regionAt(230, 140).name === 'The Redcut' && regionAt(215, 110).name === 'The Redcut' && regionAt(150, 120).name !== 'The Redcut'
        && (c.CANYONFLOOR || 0) > 350 && (c.REDLEDGE || 0) > 120 && (c.REDCLIFF || 0) > 500 && (c.REDROCK || 0) > 900 && foot > 700,
        { region: reg && [reg.x0, reg.y0, reg.x1, reg.y1], floor: c.CANYONFLOOR || 0, ledge: c.REDLEDGE || 0, cliff: c.REDCLIFF || 0, top: c.REDROCK || 0, footOfTheTable: foot, tally }); }

    // 2. every point of interest is reachable on foot from where the ferry puts you down
    { const POI = [['the mouth', MOUTH.x, MOUTH.y], ['the slot', SLOT.x, SLOT.y], ['the Rise', RISE.x0 + 1, RISE.y0 + 2],
      ['the Stair (mesa side)', STAIR[STAIR.length - 1][0] + 2, STAIR[STAIR.length - 1][1]], ['the switchback head', SWITCHBACK[0][0], SWITCHBACK[0][1]],
      ['the Fall', (FALL.x0 + FALL.x1) >> 1, FALL.y0], ["Marlow's camp", MARLOW.x, MARLOW.y], ['Hux at the box head', HUX.x, HUX.y],
      ["Hux's lamp", LAMP_T.x, LAMP_T.y], ['the rope coil', COIL_T.x, COIL_T.y], ['the winch', WINCH_T.x, WINCH_T.y], ['the basket', BASKET_T.x, BASKET_T.y],
      ['the salting bench', BENCH_T.x, BENCH_T.y], ['the crack', CRACK_T.x, CRACK_T.y], ...NESTS.map((n, i) => ['hawk nest ' + (i + 1), n[0], n[1]]),
      ...BOARDS.map((b, i) => ['board ' + (i + 1), b[0], b[1]]), ...REDCUT_SEAMS.slice(0, 6).map((s, i) => ['redsalt seam ' + (i + 1), s[0], s[1]])];
      const bad = POI.filter(([, x, y]) => !(SOLID.has(tileAt(x, y)) ? beside(x, y) : walk(x, y))).map(([n, x, y]) => `${n} @${x},${y}`);
      check(P + `every point of interest is walkable from Harl's far dock (${POI.length}: both ends, all three climbs, both people, the winch, the basket, the nests, the seams)`, bad.length === 0, { n: POI.length, unreachable: bad }); }

    // 3. the way in and the way out: a walk from the scrub north of the mouth, along the canyon floor and
    //    nothing but the canyon floor, out of the slot and onto the scrub again
    { const canyonOnly = t => t === RC_FLOOR || t === RC_SPENT || t === RC_FALL || t === RC_LEDGE;
      const through = bfsIn(MOUTH.x, MOUTH.y + 3, SLOT.x, SLOT.y + 4, canyonOnly);
      const inFromScrub = !!F.bfs(LAND[0], LAND[1], MOUTH.x, MOUTH.y - 2) && !SOLID.has(tileAt(MOUTH.x, MOUTH.y - 2));
      const outToScrub = !!F.bfs(LAND[0], LAND[1], SLOT.x, SLOT.y - 2) && !SOLID.has(tileAt(SLOT.x, SLOT.y - 2));
      // and the far end is somewhere worth coming out at: the road up to Castle Gnash
      const useful = !!F.bfs(SLOT.x, SLOT.y - 2, 224, 55);
      check(P + 'the way in and the way through: in at the mouth, round the canyon floor without ever leaving it, out of the slot, and on to the Castle Gnash road', through && inFromScrub && outToScrub && useful, { through, inFromScrub, outToScrub, toCastleGnashGate: useful }); }

    // 4. the levels are really separate: each climb is the only way to what it opens
    { const wal = WALKABLE();
      const set = list => new Set(list.map(([x, y]) => x + ',' + y));
      const rect = r => { const o = []; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) o.push([x, y]); return o; };
      const riseS = set(rect(RISE)), fallS = set(rect(FALL)), stairS = set(STAIR), sbS = set(SWITCHBACK);
      const link = (blocked, ax, ay, bx, by) => bfsIn(ax, ay, bx, by, (t, x, y) => wal.has(t) && !blocked.has(x + ',' + y));
      const none = new Set();
      const scrub = [RISE.x0 - 1, RISE.y0 + 2];
      // a tile of open mesa beside the first nest, found rather than guessed (a thorn bush or a block may sit on it)
      let mesa = null;
      for (let r = 1; r <= 4 && !mesa; r++) for (let dy = -r; dy <= r && !mesa; dy++) for (let dx = -r; dx <= r && !mesa; dx++)
        if (tileAt(NESTS[0][0] + dx, NESTS[0][1] + dy) === RC_TOP) mesa = [NESTS[0][0] + dx, NESTS[0][1] + dy];
      mesa = mesa || [NESTS[0][0], NESTS[0][1] + 2];
      const all3 = new Set([...riseS, ...fallS, ...sbS]);
      // the table: reachable now, cut off from the scrub when the Rise, the Fall and the switchback all go
      const tableOpen = link(none, scrub[0], scrub[1], MARLOW.x, MARLOW.y), tableShut = !link(all3, scrub[0], scrub[1], MARLOW.x, MARLOW.y);
      // the mesa: the Stair and nothing else
      const mesaOpen = link(none, HUX.x, HUX.y, mesa[0], mesa[1]), mesaShut = !link(stairS, HUX.x, HUX.y, mesa[0], mesa[1]);
      // the box head: the Fall from the canyon floor, or the switchback down from the camp
      const boxOpen = link(none, MARLOW.x, MARLOW.y, HUX.x, HUX.y), boxShut = !link(new Set([...fallS, ...sbS]), MOUTH.x, MOUTH.y + 4, HUX.x, HUX.y);
      const sbShort = (F.bfs(MARLOW.x, MARLOW.y, HUX.x, HUX.y) || []).length;
      check(P + 'the levels really are separate: the Rise, the Fall and the switchback are the only ways up onto the table, the Stair is the only way onto the mesa, and the box head is reached by the Fall or the switchback and nothing else',
        tableOpen && tableShut && mesaOpen && mesaShut && boxOpen && boxShut && sbShort > 0 && sbShort < 40,
        { tableOpen, tableShutWithoutTheThreeClimbs: tableShut, mesaOpen, mesaShutWithoutTheStair: mesaShut, boxHeadOpen: boxOpen, boxHeadShutWithoutFallOrSwitchback: boxShut, campToBoxHeadSteps: sbShort }); }

    // 5. the height is actually drawn: cliff faces, the lit rim along their tops, and the shadow they throw
    { const p0 = { ...paint }; const px = player.x, py = player.y;
      F.tp(230, 141); render();
      const faces = paint.faces - p0.faces, rims = paint.rims - p0.rims, shad = paint.shadows - p0.shadows, ground = paint.grounds - p0.grounds;
      // and out on the open scrub there is little cliff to draw. Measured from the north-west corner of the
      // Redcut: the old spot, 210,101 just above the mouth, now looks straight at the wall of the west arm.
      const p1 = { ...paint }; F.tp(RC.x0, RC.y0); render();
      const scrubFaces = paint.faces - p1.faces;
      player.x = px; player.y = py;
      check(P + 'the height reads: standing in the canyon draws cliff faces, a lit rim along the top of each one, and a cast shadow on the ground under them', faces > 40 && rims > 10 && shad > 20 && ground > 300 && scrubFaces < faces / 3,
        { facesInCanyon: faces, litRims: rims, castShadows: shad, groundTiles: ground, facesOnOpenScrub: scrubFaces }); }

    // 6. the gate on the Deep Cache: solid below Agility 30, open at 30, and the pick is only in there
    { const xp0 = player.skills.agility ? player.skills.agility.xp : 0;
      if (player.skills.agility) player.skills.agility.xp = 0;
      F.step([]); const shut = SOLID.has(RC_CRACK) && !WALK_OVER.has(RC_CRACK);
      F.tp(CRACK_T.x, CRACK_T.y - 1); F.sim(50, ['KeyS']); const blockedY = Math.floor(player.y / TILE);
      if (player.skills.agility) player.skills.agility.xp = XP_TABLE[CRACK_LV];
      F.step([]); const open = WALK_OVER.has(RC_CRACK);
      F.tp(CRACK_T.x, CRACK_T.y - 1); F.sim(90, ['KeyS']); const throughY = Math.floor(player.y / TILE);
      if (player.skills.agility) player.skills.agility.xp = xp0;
      check(P + `the Deep Cache is behind a crack that is solid below Agility ${CRACK_LV} and open at ${CRACK_LV}`, shut && blockedY < CRACK_T.y && open && throughY >= CRACK_T.y, { blockedAt: blockedY, crackAt: CRACK_T.y, throughTo: throughY, shut, open }); }

    // 7. redsalt is mined here and nowhere else, and it makes salt beef
    { let inside = 0, outside = 0;
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (tileAt(x, y) === RC_SALT) { if (mine(x, y)) inside++; else outside++; }
      const g = GATHER[RC_SALT];
      const rec = RECIPES.find(r => r.out === 'salt_beef');
      const bag0 = player.inv.slice(), lv0 = player.skills.mining.xp;
      player.inv = player.inv.map(() => null); h.give('bronze_pickaxe', 1);
      player.skills.mining.xp = 0;
      const seam = REDCUT_SEAMS.find(([sx, sy]) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => !SOLID.has(tileAt(sx + dx, sy + dy))));
      let refused = false, side = null;
      if (seam) {
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (!side && !SOLID.has(tileAt(seam[0] + dx, seam[1] + dy))) side = [seam[0] + dx, seam[1] + dy];
        notice = null; F.tp(side[0], side[1]); F.face(seam[0], seam[1]); F.press('KeyE');
        refused = !player.action && !!notice && /Mining level 22/.test(notice.text);
      }
      player.skills.mining.xp = lv0; player.inv = bag0; player.action = null;
      const needs = rec ? Object.fromEntries(rec.needs) : {};
      // and the book says what the recipe says (it once said three redsalt when the recipe takes two)
      const book = window.WIKI ? WIKI.lines('places', 'redcut').map(l => l.t).join(' | ') : '';
      const bookRight = !window.WIKI || (book.includes(`${needs.redsalt} redsalt and ${needs.raw_beef} raw beef`) && book.includes(`make ${rec.qty} salt beef`));
      check(P + 'redsalt is cut from seams in the Redcut and nowhere else on the map: Mining 22, 82 xp, and 3 beef + 2 redsalt make 3 salt beef that cannot burn',
        inside >= 8 && outside === 0 && !!g && g.lv === SALT_LV && g.xp === 82 && g.item === 'redsalt' && !!rec && rec.qty === 3 && needs.raw_beef === 3 && needs.redsalt === 2 && rec.skill === 'cooking' && ITEMS.salt_beef.heal === 13 && !ITEMS.salt_beef.cook && refused && bookRight,
        { seamsInside: inside, seamsElsewhere: outside, mineLv: g && g.lv, refusedBelowLevel: refused, seam, side, notice: notice && notice.text, heal: ITEMS.salt_beef.heal, needs, bookRight }); }

    // 8. Hux's pick: tier 3 like a Mithril pickaxe, and the one pick that cuts 2 redsalt out of a seam. Proved by
    //    cutting the same seam twice, once with each pick, and counting what lands in an empty pack.
    { const inShops = Object.keys(SHOPS).some(s => SHOPS[s].stock.some(([id]) => id === 'hux_pick'));
      const inDrops = Object.keys(MONSTER_DEFS).some(t => JSON.stringify(MONSTER_DEFS[t].drops || {}).includes('hux_pick'));
      const inRecipes = RECIPES.some(r => r.out === 'hux_pick');
      const rival = ITEMS.mithril_pickaxe ? 'mithril_pickaxe' : 'steel_pickaxe';
      const open4 = (x, y) => [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => [x + dx, y + dy]).find(([nx, ny]) => !SOLID.has(tileAt(nx, ny)));
      const seam = REDCUT_SEAMS.find(([sx, sy]) => tileAt(sx, sy) === RC_SALT && open4(sx, sy));
      const bag0 = player.inv.slice(), eq0 = { ...player.equip }, xp0 = player.skills.mining.xp;
      const cut = pick => {
        if (!seam) return -1;
        const [sx, sy] = seam, side = open4(sx, sy);
        player.inv = player.inv.map(() => null); for (const k of EQUIP_SLOTS) player.equip[k] = null;
        h.give(pick, 1); player.skills.mining.xp = XP_TABLE[60];
        F.tp(side[0], side[1]); F.face(sx, sy);
        player.action = { type: 'mine', tx: sx, ty: sy, t: 0, need: 1, tier: hasTool('pickaxe') };
        for (let i = 0; i < 80 && player.action && tileAt(sx, sy) === RC_SALT; i++) finishGather();
        const got = tileAt(sx, sy) === RC_SALT ? -1 : countItem('redsalt');
        player.action = null; regrow = regrow.filter(r => r.i !== idx(sx, sy)); changeTile(sx, sy, RC_SALT); mapDiffs.delete(idx(sx, sy));
        return got;
      };
      const withRival = cut(rival), withHux = cut('hux_pick');
      player.inv = bag0; Object.assign(player.equip, eq0); player.skills.mining.xp = xp0;
      const blurb = itemBlurb(ITEMS.hux_pick);
      check(P + "Hux's pick swings at tier 3 like a Mithril pickaxe but cuts 2 redsalt from a seam where the Mithril pickaxe cuts 1, and the Deep Cache is the only place it comes from",
        ITEMS.hux_pick.tier === 3 && ITEMS[rival].tier === ITEMS.hux_pick.tier && withRival === 1 && withHux === 2 && /2 redsalt/.test(blurb)
        && !inShops && !inDrops && !inRecipes && tileAt(CACHE_T.x, CACHE_T.y) === RC_CACHE,
        { tier: ITEMS.hux_pick.tier, rival, rivalTier: ITEMS[rival].tier, seam, redsaltWithRival: withRival, redsaltWithHuxPick: withHux, blurb, inShops, inDrops, inRecipes }); }

    // 9. what lives here, and how far above the fields it is
    { const hawks = MONSTER_SPAWNS.filter(s => s.type === 'rimhawk'), jaws = MONSTER_SPAWNS.filter(s => s.type === 'dustjaw');
      const placed = [...hawks, ...jaws].every(s => mine(s.tx, s.ty) && !SOLID.has(tileAt(s.tx, s.ty)));
      const onMesa = hawks.every(s => tileAt(s.tx, s.ty) === RC_TOP), inCanyon = jaws.every(s => tileAt(s.tx, s.ty) === RC_FLOOR);
      check(P + 'rimhawks (level 34) nest on the mesa, dustjaws (level 42) chew the canyon walls; every one of them stands on ground it can stand on', hawks.length === 5 && jaws.length === 4 && placed && onMesa && inCanyon && MONSTER_DEFS.rimhawk.level === 34 && MONSTER_DEFS.dustjaw.level === 42 && !!HOOKS.drawMonster.rimhawk && !!HOOKS.drawMonster.dustjaw,
        { hawks: hawks.length, jaws: jaws.length, placed, onMesa, inCanyon }); }

    // 10. the story, start to finish, and the turn in the middle of it
    { const q0 = JSON.parse(JSON.stringify(Q())), bag = player.inv.slice(), mxp0 = player.skills.mining.xp;
      quest.redcut = { stage: 0, winch: false, lamp: false, coil: false, salt: false, rode: 0 };
      const marlow = NPCS.find(n => n.id === 'marlow'), hux = NPCS.find(n => n.id === 'hux');
      const clearSay = () => { dialog.queue.length = 0; dialog.cur = null; notice = null; };
      const said = re => { const all = [dialog.cur, ...dialog.queue].filter(Boolean).map(d => d.text).join(' | '); return re.test(all); };
      player.inv = player.inv.map(() => null);
      const c0 = coins();                        // counted with the pack already empty, so the 350 is the only coins in it
      clearSay(); HOOKS.talk.redcut_rim(marlow);
      const started = Q().stage === 1 && countItem('cut_rope') === 1 && said(/cut it/i);
      // the winch is dead before the story is done
      F.tp(WINCH_T.x - 1, WINCH_T.y); const before = { x: player.x, y: player.y };
      clearSay(); HOOKS.use.some(fn => fn(RC_WINCH, WINCH_T.x, WINCH_T.y));
      const winchDead = player.x === before.x && player.y === before.y;
      // the lamp on the middle ledge moves it on
      clearSay(); F.tp(LAMP_T.x, LAMP_T.y - 1); HOOKS.use.some(fn => fn(RC_LAMP, LAMP_T.x, LAMP_T.y));
      const lamp = Q().stage === 2 && countItem('hux_lamp') === 1 && said(/fill it/i);
      // Hux will not explain himself until you have looked at the rope
      clearSay(); HOOKS.talk.redcut_deep(hux);
      const heldBack = Q().stage === 2 && countItem('hux_tally') === 0;
      clearSay(); F.tp(COIL_T.x, COIL_T.y - 1); HOOKS.use.some(fn => fn(RC_COIL, COIL_T.x, COIL_T.y));
      const clue = Q().coil === true && said(/short end/i);
      clearSay(); HOOKS.talk.redcut_deep(hux);
      const turn = Q().stage === 3 && countItem('hux_tally') === 1 && countItem('redsalt') >= 3 && said(/I cut it down here/i);
      clearSay(); HOOKS.talk.redcut_rim(marlow);
      const done = Q().stage === 4 && Q().winch === true && coins() === c0 + 350 && countItem('hux_tally') === 0;
      // and now the winch runs, both ways
      F.tp(WINCH_T.x - 1, WINCH_T.y); clearSay(); HOOKS.use.some(fn => fn(RC_WINCH, WINCH_T.x, WINCH_T.y));
      const wentDown = Math.abs(player.y - tc(BASKET_T.y)) < 2 * TILE && Math.abs(player.x - tc(BASKET_T.x)) < 3 * TILE;
      F.tp(BASKET_T.x + 1, BASKET_T.y); clearSay(); HOOKS.use.some(fn => fn(RC_BASKET, BASKET_T.x, BASKET_T.y));
      const cameUp = Math.abs(player.y - tc(WINCH_T.y)) < 2 * TILE && Math.abs(player.x - tc(WINCH_T.x)) < 3 * TILE;
      // Out of order: the lamp hangs on the switchback beside Marlow's camp, so a knight can take it (and look at
      // the coil) before Marlow has said a word. The story must still run to the end and pay out.
      quest.redcut = { stage: 0, winch: false, lamp: false, coil: false, salt: false, rode: 0 };
      player.inv = player.inv.map(() => null);
      const c1 = coins(), xp1 = player.skills.mining.xp;
      clearSay(); F.tp(LAMP_T.x, LAMP_T.y - 1); HOOKS.use.some(fn => fn(RC_LAMP, LAMP_T.x, LAMP_T.y));
      const earlyLamp = Q().stage === 0 && Q().lamp === true && countItem('hux_lamp') === 1;
      clearSay(); F.tp(COIL_T.x, COIL_T.y - 1); HOOKS.use.some(fn => fn(RC_COIL, COIL_T.x, COIL_T.y));
      clearSay(); HOOKS.talk.redcut_rim(marlow);
      const pastLamp = Q().stage === 2 && countItem('cut_rope') === 1 && said(/filling it/i);
      clearSay(); HOOKS.talk.redcut_deep(hux);
      const turn2 = Q().stage === 3 && countItem('hux_tally') === 1;
      clearSay(); HOOKS.talk.redcut_rim(marlow);
      const done2 = Q().stage === 4 && Q().winch === true && coins() === c1 + 350 && player.skills.mining.xp > xp1;
      // a save from before the fix, already stuck at { stage: 1, lamp: true }: the empty spike moves it on
      quest.redcut = { stage: 1, winch: false, lamp: true, coil: false, salt: false, rode: 0 };
      clearSay(); F.tp(LAMP_T.x, LAMP_T.y - 1); HOOKS.use.some(fn => fn(RC_LAMP, LAMP_T.x, LAMP_T.y));
      const rescued = Q().stage === 2 && said(/fill it/i);
      // and the lamp on its spike is drawn lit until it is taken, dark after, whatever stage the story is at
      quest.redcut = { stage: 0, winch: false, lamp: false, coil: false, salt: false, rode: 0 };
      F.tp(LAMP_T.x, LAMP_T.y + 1);
      let n0 = paint.lamps, l0 = paint.lampLit; render();
      const litOnSpike = paint.lamps > n0 && paint.lampLit > l0;
      Q().lamp = true; n0 = paint.lamps; l0 = paint.lampLit; render();
      const darkOnceTaken = paint.lamps > n0 && paint.lampLit === l0;
      clearSay(); player.inv = bag; quest.redcut = q0; player.skills.mining.xp = mxp0;
      check(P + 'The Cut Rope runs start to finish: Marlow accuses the rim, the lamp is still lit, Hux says nothing until you have looked at the coiled rope, and then he says he cut it himself',
        started && winchDead && lamp && heldBack && clue && turn && done && wentDown && cameUp && earlyLamp && pastLamp && turn2 && done2 && rescued && litOnSpike && darkOnceTaken,
        { started, winchDeadBeforeTheStory: winchDead, lamp, huxHeldBack: heldBack, ropeClue: clue, theTurn: turn, finished: done, rodeDown: wentDown, rodeUp: cameUp,
          lampBeforeMarlow: earlyLamp, marlowSkipsPastTheLamp: pastLamp, outOfOrderTurn: turn2, outOfOrderFinished: done2, stuckSaveRescued: rescued, litOnSpike, darkOnceTaken }); }

    // 12. the ring's two arms run out past the table to the mouth and the slot. They are walled along their
    //     outer side, so the canyon floor touches the ground outside the table (the edge's band, whatever it
    //     is dressed as) at those two openings and nowhere else.
    { const scrubAt = (x, y) => { const t = tileAt(x, y); return cls(x, y) === 4 && !SOLID.has(t); };
      const atOpening = (x, y) => [MOUTH, SLOT].some(p => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= 2);
      let contacts = 0, mouth = 0, slot = 0; const stray = [];
      for (let y = RC.y0; y <= RC.y1; y++) for (let x = RC.x0; x <= RC.x1; x++) {
        if (tileAt(x, y) !== RC_FLOOR) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (!scrubAt(nx, ny)) continue;
          contacts++;
          if (!atOpening(nx, ny)) { if (stray.length < 12) stray.push(`${x},${y}>${nx},${ny}`); continue; }
          if (Math.max(Math.abs(MOUTH.x - nx), Math.abs(MOUTH.y - ny)) <= 2) mouth++; else slot++;
        }
      }
      const strayCount = contacts - mouth - slot;
      check(P + 'the canyon floor meets the scrub only at the mouth and the slot', strayCount === 0 && mouth > 0,
        { contacts, atTheMouth: mouth, atTheSlot: slot, elsewhere: strayCount, firstStray: stray }); }

    // 13. THE EDGE. The owner: "The canyon doesn't blend with the surrounding environment in the slightest."
    //     It stood in a tan rectangle whose west side ran down x 204 and whose north side ran along y 100.
    { const E = REDCUT.edge, FOOT = new Set([E.dust, E.scree, E.scrub, E.dry, E.bush, E.snag, RC_BOULDER]);
      const rock = (x, y) => mine(x, y) && cls(x, y) < 4;
      const country = (x, y) => rock(x, y) || FOOT.has(tileAt(x, y));
      // (a) the outline: the outermost tile of the canyon country, row by row on the west and column by column
      //     on the north, never holds one line for more than a few tiles (the old box held one for 78 and 54)
      const longest = arr => { let best = 0, run = 0, prev = null; for (const v of arr) { run = v !== null && v === prev ? run + 1 : 1; prev = v; if (v !== null) best = Math.max(best, run); } return best; };
      const west = [], north = [];
      for (let y = RC.y0; y <= RC.y1 - 3; y++) { let e = null; for (let x = EXT.x0; x <= RC.x1; x++) if (country(x, y)) { e = x; break; } west.push(e); }
      for (let x = RC.x0; x <= RC.x1 - 3; x++) { let e = null; for (let y = EXT.y0; y <= RC.y1; y++) if (country(x, y)) { e = y; break; } north.push(e); }
      const onBoxWest = west.filter(v => v === RC.x0).length, onBoxNorth = north.filter(v => v === RC.y0).length;
      check(P + 'the edge: the Redcut\'s outline is ragged, not a box (no straight run longer than 6 tiles down its west side or along its north side)',
        longest(west) <= 6 && longest(north) <= 6 && onBoxWest < 20 && onBoxNorth < 14,
        { longestWest: longest(west), longestNorth: longest(north), rowsOnTheOldWestLine: onBoxWest, columnsOnTheOldNorthLine: onBoxNorth }); }
    // (b) the transition: walking straight out from the foot of the rim, the ground steps red dust or scree →
    //     dry scrub → dry grass → green, and the band from the last rock tile to the first green one is several
    //     tiles wide, on every side that has room for it (the east and south run into the edge of the world)
    { const rock = (x, y) => mine(x, y) && cls(x, y) < 4;
      const E = REDCUT.edge, green = t => t === T.GRASS || t === T.FLOWERS || t === T.MUSHROOM || ('FERN' in T && t === T.FERN) || t === T.TREE || t === T.OAK || ('JUNGLE' in T && t === T.JUNGLE);
      const rank = t => (t === E.dust || t === E.scree || t === RC_BOULDER) ? 0 : (t === E.scrub || t === E.bush) ? 1 : (t === E.dry || t === E.snag) ? 2 : green(t) ? 3 : -1;
      // each ray starts on the rock and walks out until it leaves it
      const rays = [['west', -1, 0, 215, 120], ['west', -1, 0, 215, 160], ['north-west', -1, -1, 222, 112], ['north', 0, -1, 231, 112], ['north', 0, -1, 226, 112], ['south-west', -1, 1, 218, 158]];
      const out = rays.map(([name, dx, dy, sx, sy]) => {
        let x = sx, y = sy; while (rock(x, y) && inMap(x + dx, y + dy)) { x += dx; y += dy; }
        const seen = []; let width = 0, max = -1, back = 0;
        for (let k = 0; k < 20 && inMap(x, y); k++, x += dx, y += dy) {
          const r = rank(tileAt(x, y)); if (r < 0) continue;
          if (r === 3) break;
          width++; if (!seen.includes(r)) seen.push(r); if (r < max - 1) back++; max = Math.max(max, r);
        }
        // in tiles of distance: a diagonal step covers 1.4
        return { name, width: +(width * Math.hypot(dx, dy)).toFixed(1), steps: seen.length, back };
      });
      check(P + 'the edge: out from the rim the ground steps dust, scrub, dry grass, green, in a band at least 4 tiles wide on the west and north',
        out.every(o => o.width >= 4 && o.steps >= 2 && o.back === 0), out); }
    // (c) the band opened nothing and shut nothing: every open tile of it inside the box can be walked to from
    //     where the ferry lands, and outside the box it only turned grass into grass-coloured ground and trees
    //     into dead trees, so the rest of the map is exactly as walkable as it was
    { const seen = new Uint8Array(MAP_W * MAP_H), q = [idx(206, 30)]; seen[q[0]] = 1;
      for (let i = 0; i < q.length; i++) { const c = q[i], x = c % MAP_W, y = (c / MAP_W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny); if (seen[n] || SOLID.has(tileAt(nx, ny))) continue; seen[n] = 1; q.push(n); } }
      const E = REDCUT.edge, BAND = new Set([E.dust, E.scree, E.scrub, E.dry, E.bush]);
      let band = 0; const stranded = [];
      for (let y = RC.y0; y <= RC.y1; y++) for (let x = RC.x0; x <= RC.x1; x++) { if (!BAND.has(tileAt(x, y))) continue; band++; if (!seen[idx(x, y)] && stranded.length < 12) stranded.push(x + ',' + y); }
      check(P + 'the edge: every tile of the band can be walked to from the far dock', band > 700 && stranded.length === 0, { band, stranded, edge: tally.edge }); }

    // 11. nothing else on the map lost its way
    if (window.PLAYTHROUGH) { const c = PLAYTHROUGH.connectivity();
      check(P + 'nothing anywhere else became unreachable: the whole-map audit still walks to every target', c.unreachable.length === 0, { targets: c.rows.length, unreachable: c.unreachable, gated: c.gated.length }); }
    h.peace(false);
  });
}
