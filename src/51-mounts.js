// ============================================================================
// FEATURE: CINDER, THE GREY MARE — a mount, so 260 x 180 tiles stop being a walk
// Fennick the trader keeps a mare at a hitching rail beside his stall in Thistledown. Eight hundred
// coins buys her; nothing gives her away. Ride her and the road goes past twice as fast (175 -> 350).
//
// She rides on the game's existing vehicle shape (player.mech, the same one the walker, the bulldozer
// and the Barrelbeast use), so the save file, the HUD, tap-to-move and the X key already understand
// her: player.mech = { hp, maxHp, kind: 'horse' }. Two core functions are wrapped by reassignment (the
// accepted way, see 13-ux / 16-instances / 44-wiki) so she parks as a mare and never as a walker wreck:
//   exitMech  -> dismount()  (X, the touch EXIT button, R, the RIDE button)
//   wreckMech -> bolt()      (she is hurt out from under you and runs for the rail)
// A third wrap, playerAttack, refuses to swing from the saddle: she is transport, not a warhorse, and
// that keeps the mech combat bonuses the core hands every rider out of a fight she should not be in.
//
// Where she will not go: indoors, in any dungeon, while you are in another machine, and on water —
// riding her uses the core's 'beast' collision, so doors, water and walls are solid for her even when
// hover armour would float the knight over them. She can never reach ground the knight cannot.
// ============================================================================
{
  // ---------- tiles ----------
  // Her own pair, like the bulldozer's and the Barrelbeast's: HORSE is the mare standing on the ground,
  // HITCH is Fennick's rail. Both solid, both INTERESTING so the core draws the E ring and a tap reaches them.
  const T_HORSE = addTile('HORSE', { solid: true, tex: 'grass', mini: '#c9c3b6' });
  const T_HITCH = addTile('HITCH', { solid: true, tex: 'grass', mini: '#8a6a3a' });
  INTERESTING_TILES.add(T_HORSE); INTERESTING_TILES.add(T_HITCH);
  if (typeof TAP_NAMES !== 'undefined') { TAP_NAMES.HORSE = 'Cinder the grey mare'; TAP_NAMES.HITCH = 'Hitching rail'; }

  const HORSE_PRICE = 800;      // coins, from Fennick
  const HORSE_SPEED = 350;      // exactly twice the knight's 175
  const HORSE_R = 16;           // wider than the knight (13): she fits through less, never more
  const HORSE_HP = 60;          // she carries the hits (the core halves them for any mount) until she has had enough
  const HORSE_REST = 2;         // hp per second back while nobody is on her
  const BASE_SPEED = 175, BASE_R = 13;
  const NAME = 'Cinder';

  // ---------- state ----------
  // player.horse rides in the save with everything else on `player` (see 04-state save/load).
  //   owned  — bought from Fennick
  //   hp     — her stamina between rides
  //   at     — [tx, ty] of the tile she is standing on, null while she is under you
  //   under  — the tile NAME her tile replaced, so parking her never eats the ground she stood on
  const H = () => player.horse || (player.horse = { owned: false, hp: HORSE_HP, at: null, under: null });
  const riding = () => !!(player.mech && player.mech.kind === 'horse');
  const groundUnder = () => { const t = tileId(H().under); return (t === null || t === undefined || SOLID.has(t)) ? T.DIRT : t; };
  let rideWas = false, handled = false, refuseT = -1e9;

  // ---------- the hitching rail ----------
  // One tile, found rather than hard-coded: the map is being worked on by other hands, so the rail takes the
  // nearest open ground to Fennick's stall that has room on three sides for a knight and a horse to stand.
  let POST = null;
  const STALL = { x: 116, y: 28 };
  HOOKS.world.push((rnd, api) => {
    POST = null;
    const roomy = (x, y, strict) => {
      if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return false;
      const t = api.tileAt(x, y);
      if (strict ? (t !== T.GRASS && t !== T.DIRT) : !PLACEABLE_ON.has(t)) return false;
      if (insideBuilding(x, y)) return false;
      let free = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (insideBuilding(x + dx, y + dy)) return false;
        if (PLACEABLE_ON.has(api.tileAt(x + dx, y + dy))) free++;
      }
      return free >= 3;
    };
    for (const strict of [true, false]) {
      for (let r = 1; r <= 20 && !POST; r++) for (let dy = -r; dy <= r && !POST; dy++) for (let dx = -r; dx <= r && !POST; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = STALL.x + dx, y = STALL.y + dy;
        if (roomy(x, y, strict)) POST = { x, y };
      }
      if (POST) break;
    }
    if (POST) api.setTile(POST.x, POST.y, T_HITCH);
  });

  // ---------- putting her down and picking her up ----------
  function horseAt() { const a = H().at; return (a && inMap(a[0], a[1]) && tileAt(a[0], a[1]) === T_HORSE) ? { tx: a[0], ty: a[1] } : null; }
  function liftHorse() { const at = horseAt(); if (at) changeTile(at.tx, at.ty, groundUnder()); H().at = null; H().under = null; }
  function parkAt(tx, ty) {
    if (!inMap(tx, ty)) return false;
    const t = tileAt(tx, ty);
    if (!PLACEABLE_ON.has(t) || insideBuilding(tx, ty)) return false;
    for (const n of NPCS) if (circleHitsTile(n.px, n.py, 14, tx, ty)) return false;
    H().under = tileName(t); changeTile(tx, ty, T_HORSE); H().at = [tx, ty];
    return true;
  }
  // She always has somewhere to be: the rail first, then open ground near it, and if the whole rail is
  // buried she stands next to the knight rather than vanishing out of the game.
  function parkNear(tx, ty, reach) {
    for (let r = 0; r <= reach; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (parkAt(tx + dx, ty + dy)) return true;
    }
    return false;
  }
  function sendToRail() {
    liftHorse();
    if (POST) {
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (parkAt(POST.x + dx, POST.y + dy)) return true;
      if (parkNear(POST.x, POST.y, 4)) return true;
    }
    return parkNear(Math.floor(player.x / TILE), Math.floor(player.y / TILE), 4);
  }

  // ---------- buying her ----------
  function buyHorse() {
    if (H().owned) { notify(`${NAME} is already yours.`); return false; }
    if (coins() < HORSE_PRICE) { notify(`The mare is ${HORSE_PRICE} coins. You have ${coins()}.`); return false; }
    payCoins(HORSE_PRICE);
    H().owned = true; H().hp = HORSE_HP;
    closePanel(); sendToRail(); sfx('coins');
    say(`Fennick unties the rope and puts it in your hand. "Her name is ${NAME}. Grey as a wet roof and steady as one. Walk her at walls, run her on roads, and every mile in the Fanglands is half a mile."`, 'Fennick the trader');
    notify(`${NAME} is at the rail. Stand beside her and press ${keyName('E')} to ride.`);
    save(); return true;
  }

  // ---------- Fennick: the offer, and his stall is still one button away ----------
  // He is a plain trader again the moment she is sold, so nothing about him changes for the rest of the game.
  // 50-economy.js claims this same role for Fennick's standing order, and this file loads after it, so wrap
  // what is already there instead of replacing it: the order is spoken first and still pays, and if that
  // handler ever takes the talk over outright its answer stands and the rail never opens on top of it.
  {
  const prevTrader = HOOKS.talkBefore.trader;
  HOOKS.talkBefore.trader = n => {
    if (prevTrader && prevTrader(n)) return true;
    if (n.id !== 'fennick' || H().owned) return false;
    say(`Pelts, tusks, scrap, aye. But look at your boots, knight. That grey mare on my rail has walked the Hollowford road twice and never spooked. ${HORSE_PRICE} coins and the road gets half as long.`, n.name);
    openPanel('stable');
    return true;
  };
  }
  HOOKS.panel.stable = (g, narrow) => {
    const { px, py, w, h } = panelBox(g, Math.min(440, VW - 20), 250, "Fennick's rail", `A grey mare — ${HORSE_PRICE} coins`);
    const lines = [
      'She carries a knight at twice walking pace.',
      'She will not go indoors, down a dungeon, or into water.',
      'No swinging a sword from the saddle: get down first.',
      `You have ${coins()} coins.`,
    ];
    g.font = '13px sans-serif'; g.textAlign = 'left';
    lines.forEach((t, i) => { g.fillStyle = i === lines.length - 1 ? '#c9a36a' : '#8b949e'; g.fillText(t, px + 18, py + 78 + i * 20); });
    const enough = coins() >= HORSE_PRICE;
    button(g, px + 18, py + h - 100, w - 36, 40, `Buy the mare — ${HORSE_PRICE} coins`, buyHorse, '#238636', enough);
    button(g, px + 18, py + h - 52, w - 36, 40, 'Trade pelts and scrap', () => { closePanel(); openPanel('shop', 'trader'); }, '#21262d');
  };

  // ---------- getting on ----------
  // Every refusal is a real one, checked before anything moves.
  function mountRefusal() {
    if (player.dead) return 'Not now.';
    if (player.mech) return `Get out of the ${player.mech.kind === 'beast' ? 'Barrelbeast' : mechName()} first (${keyName('X')}).`;
    if (window.INSTANCES && INSTANCES.active()) return `${NAME} will not go down here. Ride her outside, in the open.`;
    const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
    if (insideBuilding(tx, ty)) return 'No horses indoors. Take her out to the street first.';
    // WALK_OVER holds whatever the knight is crossing only because of what he is wearing — water in hover
    // armour. She has no armour, so anything in that set (and anything plain solid) is not ground she can stand on.
    const t = tileAt(tx, ty);
    if (WALK_OVER.has(t)) return `Hover armour floats you, not ${NAME}. Ride from dry land.`;
    if (SOLID.has(t)) return `${NAME} cannot stand there. Ride her from open ground.`;
    if (!safeSpot(player.x, player.y, HORSE_R, 'beast')) return 'No room here. Ride her from open ground.';
    return null;
  }
  function mount(tx, ty) {
    const why = mountRefusal();
    if (why) { notify(why); return false; }
    const spot = safeSpot(player.x, player.y, HORSE_R, 'beast');
    if (tx !== undefined && inMap(tx, ty) && tileAt(tx, ty) === T_HORSE) changeTile(tx, ty, groundUnder());
    H().at = null; H().under = null;
    player.mech = { hp: Math.max(1, Math.round(H().hp)), maxHp: HORSE_HP, kind: 'horse' };
    player.x = spot.x; player.y = spot.y; player.r = HORSE_R; player.speed = HORSE_SPEED; player.action = null;
    sfx('ui'); burst(player.x, player.y, '#c9a36a', 10, 60);
    notify(`Up on ${NAME}. Twice the pace. ${keyName('X')} to get down.`);
    save(); return true;
  }
  // Her tile in front of you, or on any of the four sides, so R never needs you to line her up exactly.
  function horseNear() {
    const own = { tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) };
    const ft = frontTile(player, 44);
    if (tileAt(ft.tx, ft.ty) === T_HORSE) return ft;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tileAt(own.tx + dx, own.ty + dy) === T_HORSE) return { tx: own.tx + dx, ty: own.ty + dy };
    return null;
  }
  // What the R key and the RIDE / GET DOWN button both call.
  function tryRide() {
    if (riding()) return dismount();
    if (!H().owned) { notify('You have no horse. Fennick the trader in Thistledown keeps a grey mare on his rail.'); return false; }
    const why = mountRefusal(); if (why) { notify(why); return false; }
    const at = horseNear();
    if (!at) { notify(`${NAME} is not here. Whistle her at Fennick's rail in Thistledown.`); return false; }
    return mount(at.tx, at.ty);
  }

  // ---------- getting off ----------
  // The core's exitMech parks a walker tile it knows nothing about, so the mare does her own dismount:
  // she takes the ground ahead (or the tile you are on), and the knight takes the nearest free spot.
  function aheadTile() { return { tx: Math.floor((player.x + player.facing.x * 44) / TILE), ty: Math.floor((player.y + player.facing.y * 44) / TILE) }; }
  function dismount(quiet) {
    if (!riding()) return false;
    const own = { tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) }, ft = aheadTile();
    const usable = s => inMap(s.tx, s.ty) && PLACEABLE_ON.has(tileAt(s.tx, s.ty)) && !insideBuilding(s.tx, s.ty);
    const spot = ((ft.tx !== own.tx || ft.ty !== own.ty) && usable(ft)) ? ft : usable(own) ? own : null;
    if (!spot) { notify('No room to get down here. Ride somewhere open.'); return false; }
    const onOwn = spot.tx === own.tx && spot.ty === own.ty, prev = tileAt(spot.tx, spot.ty);
    H().under = tileName(prev); changeTile(spot.tx, spot.ty, T_HORSE);
    const want = onOwn ? { x: player.x - player.facing.x * TILE, y: player.y - player.facing.y * TILE } : { x: player.x, y: player.y };
    const free = safeSpot(want.x, want.y, BASE_R, 'player');
    if (!free) { changeTile(spot.tx, spot.ty, prev); H().under = null; notify('No room to get down here. Ride somewhere open.'); return false; }
    H().at = [spot.tx, spot.ty]; H().hp = player.mech.hp;
    player.mech = null; player.r = BASE_R; player.speed = BASE_SPEED;
    player.x = free.x; player.y = free.y;
    handled = true;
    if (!quiet) notify(`You swing down. ${NAME} waits.`);
    save(); return true;
  }
  // She is hurt out from under you: no wreck, no loss. She throws the knight clear and runs for the rail.
  function bolt() {
    const bx = player.x, by = player.y;
    player.mech = null; player.r = BASE_R; player.speed = BASE_SPEED;
    H().hp = 1;
    const free = safeSpot(player.x, player.y, BASE_R, 'player');
    if (free) { player.x = free.x; player.y = free.y; }
    sendToRail(); handled = true;
    burst(bx, by, '#c9a36a', 26, 150); sfx('hurt');
    say(`${NAME} has had enough of that. She throws you clear and bolts for Fennick's rail in Thistledown. She will be standing there, and she will need a rest before she carries you again.`, 'The Voice');
    save();
  }
  // Wraps, so X, the touch EXIT button and every hit that lands all go the mare's way instead of the walker's.
  { const _exitMech = exitMech; exitMech = function () { if (riding()) { dismount(); return; } return _exitMech.apply(this, arguments); }; }
  { const _wreckMech = wreckMech; wreckMech = function () { if (riding()) { bolt(); return; } return _wreckMech.apply(this, arguments); }; }
  // A saddle is not a fighting platform. Refusing here is what keeps the core's mount bonuses (+8 max hit,
  // +20 accuracy, half damage taken) from turning a delivery horse into the best armour in the game.
  { const _playerAttack = playerAttack;
    playerAttack = function () {
      if (riding() && !player.dead) {
        if (time - refuseT > 2) { refuseT = time; notify(`No swinging from the saddle. Press ${keyName('X')} to get down first.`); }
        return;
      }
      return _playerAttack.apply(this, arguments);
    }; }

  // ---------- the rail: whistle her in and let her rest ----------
  function whistle() {
    if (!H().owned) { say("A hitching rail, a rope, and a grey mare tied to it. Fennick keeps her here. He will sell her to anyone who has walked far enough to want her.", 'The Voice'); return; }
    if (riding()) { notify(`You are already on ${NAME}.`); return; }
    const at = horseAt();
    if (at && POST && Math.abs(at.tx - POST.x) <= 1 && Math.abs(at.ty - POST.y) <= 1) {
      H().hp = HORSE_HP; notify(`${NAME} is tied at the rail, rested and ready.`); save(); return;
    }
    if (sendToRail()) { H().hp = HORSE_HP; sfx('ui'); notify(`You whistle. ${NAME} trots up to the rail.`); save(); }
    else notify('No room at the rail. Clear the ground beside the post.');
  }
  HOOKS.use.push((t, tx, ty) => {
    if (t === T_HORSE) { mount(tx, ty); return true; }
    if (t === T_HITCH) { whistle(); return true; }
    return false;
  });

  // ---------- update: the R key, her rest, and the core's walker wording ----------
  HOOKS.keyHelp.push({ action: 'Ride or get down', codes: ['KeyR'] }); // 43-settings lists this on the Controls line
  HOOKS.update.push(dt => {
    const r = riding();
    if (rideWas !== r && typeof tapCancel === 'function') tapCancel('manual'); // the old path was built for the wrong body
    if (rideWas && !r && !handled) { // die() clears player.mech itself: she is loose, so she goes home
      H().hp = Math.max(1, H().hp); sendToRail();
      notify(`${NAME} ran for Fennick's rail in Thistledown.`); save();
    }
    handled = false; rideWas = r;

    const blocked = panel && !['skills', 'quests', 'map'].includes(panel);
    if (!blocked && !player.dead && (pressed.has('KeyR') || tapped('ride'))) tryRide();

    if (riding()) { // asked again: tryRide() just above may have put the knight down this very tick
      if (player.speed !== HORSE_SPEED) player.speed = HORSE_SPEED; // hover armour / agility / webs all reset speed for the knight on foot
      player.mech.maxHp = HORSE_HP;
      // the core owns several "walker" strings; while a horse is under you they should read as a horse
      if (notice && /walker/i.test(notice.text)) notice.text = notice.text.replace(/\bthe walker\b/gi, NAME).replace(/\bwalker\b/gi, 'mare');
      for (const f of floaters) if (f.text.indexOf('(walker)') >= 0) f.text = f.text.replace('(walker)', `(${NAME})`);
    } else if (H().owned && H().hp < HORSE_HP) {
      H().hp = Math.min(HORSE_HP, H().hp + dt * HORSE_REST); // standing about, she gets her wind back
    }
  });
  HOOKS.newGame.push(() => { rideWas = false; handled = false; refuseT = -1e9; });

  // ---------- HUD: her name over the core's "Walker" line, and a RIDE / GET DOWN button ----------
  HOOKS.hud.push((g, narrow) => {
    if (riding()) {
      const label = `${NAME} ${player.mech.hp}/${player.mech.maxHp}`;
      g.font = '13px sans-serif'; g.textAlign = 'left';
      const w = Math.max(g.measureText(`Walker ${player.mech.hp}/${player.mech.maxHp}`).width, g.measureText(label).width);
      g.fillStyle = 'rgba(10,14,22,0.95)'; roundRect(g, 186, 47, w + 10, 19, 5); g.fill();
      g.strokeStyle = 'rgba(201,163,106,0.35)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#c9a36a'; g.fillText(label, 190, 60);
    }
    const near = !player.dead && !riding() && H().owned && !player.mech && !!horseNear();
    if (!riding() && !near) return;
    // HOOKS.hud runs before the panels are drawn, and a click is matched against the button list before it is
    // matched against the open panel — so a button drawn under a panel would still eat the click. Draw nothing
    // while anything is over the world: the panel sits right on top of this rect (Skills starts at x 14, y 90).
    if (panel || paused) return;
    const lay = typeof HUD_LAYOUT !== 'undefined' ? HUD_LAYOUT : null;
    const touchFloor = (isTouch && lay && !lay.short) ? lay.hotbarY + lay.hotbarH + 12 : 0;
    const h = isTouch ? 44 : 34, w = 132, x = 14, y = Math.max(HUD.leftY, touchFloor, 84);
    button(g, x, y, w, h, riding() ? 'GET DOWN' : 'RIDE', tryRide, riding() ? '#6b4f2a' : '#238636');
    if (!isTouch) { g.fillStyle = '#8b949e'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText(riding() ? 'R or X' : 'R', x + w + 8, y + h / 2 + 4); }
    HUD.leftY = y + h + 6;
  });

  // ---------- art: a grey mare with the knight in the saddle, drawn right at all four facings ----------
  // Two builds. Side-on when she faces left or right (mirrored by the sign of facing.x), and end-on when she
  // faces up or down (the same drawing flipped in y: head away from you going up, head toward you coming down).
  const COAT = '#9aa0a8', COAT_DK = '#7a8088', COAT_LT = '#b4b9c0', MANE = '#4a4a52', HOOF = '#2b2b33', TACK = '#5a3a1e', TACK_LT = '#8a6a3a';

  function horseSide(g, e, hurt, graze) {
    const s = e.facing.x >= 0 ? 1 : -1, sw = e.moving ? Math.sin(e.walkT) * 6 : 0, sw2 = e.moving ? Math.sin(e.walkT + 2.2) * 6 : 0;
    const drop = graze ? 9 : 0; // a parked mare has her head down in the grass
    g.save(); g.scale(s, 1);
    g.strokeStyle = HOOF; g.lineWidth = 4.5; g.lineCap = 'round';
    for (const [bx, ph] of [[-16, sw], [-11, -sw], [11, sw2], [16, -sw2]]) { g.beginPath(); g.moveTo(bx, 2); g.lineTo(bx + ph, 19); g.stroke(); }
    g.strokeStyle = MANE; g.lineWidth = 5; g.beginPath(); g.moveTo(-22, -9); g.quadraticCurveTo(-33, -3, -29, 13); g.stroke();   // tail
    g.fillStyle = hurt ? '#ffb0b0' : COAT; g.beginPath(); g.ellipse(0, -4, 23, 12, 0, 0, 7); g.fill();                           // barrel
    g.fillStyle = hurt ? '#ffc0c0' : COAT_DK; g.beginPath(); g.ellipse(-16, -5, 9, 11, 0, 0, 7); g.fill();                       // rump
    g.fillStyle = hurt ? '#ffb0b0' : COAT; g.beginPath(); g.moveTo(10, -12); g.lineTo(20, -28 + drop); g.lineTo(29, -24 + drop); g.lineTo(19, -6); g.closePath(); g.fill(); // neck
    g.beginPath(); g.ellipse(29, -27 + drop, 9, 5.5, -0.4 + drop * 0.05, 0, 7); g.fill();                                        // head
    g.fillStyle = hurt ? '#ffc0c0' : COAT_DK; g.beginPath(); g.ellipse(36, -30 + drop * 1.4, 4.2, 3.4, 0, 0, 7); g.fill();       // muzzle
    g.fillStyle = MANE; g.beginPath(); g.moveTo(11, -13); g.quadraticCurveTo(18, -29 + drop, 25, -34 + drop); g.lineTo(19, -33 + drop); g.quadraticCurveTo(14, -25 + drop, 6, -13); g.closePath(); g.fill(); // mane
    g.fillStyle = COAT_LT; g.beginPath(); g.moveTo(23, -33 + drop); g.lineTo(25, -41 + drop); g.lineTo(29, -32 + drop); g.closePath(); g.fill(); // ear
    g.fillStyle = '#222'; g.beginPath(); g.arc(30, -29 + drop, 1.6, 0, 7); g.fill();                                             // eye
    g.fillStyle = TACK; roundRect(g, -9, -17, 18, 7, 3); g.fill();                                                               // saddle
    g.fillStyle = TACK_LT; g.fillRect(-11, -14, 22, 2);                                                                          // blanket edge
    g.strokeStyle = TACK; g.lineWidth = 2; g.beginPath(); g.moveTo(-5, -13); g.lineTo(-4, 6); g.stroke();                        // girth
    g.beginPath(); g.moveTo(32, -28 + drop); g.quadraticCurveTo(19, -20 + drop / 2, 4, -15); g.stroke();                         // rein into the rider's hand
    g.restore();
  }
  function horseEnd(g, e, hurt) {
    const dir = e.facing.y >= 0 ? 1 : -1, sw = e.moving ? Math.sin(e.walkT) * 4 : 0;
    g.save(); g.scale(1, dir); // drawn head-toward-you; flipped in y it becomes the view from behind
    g.strokeStyle = HOOF; g.lineWidth = 4.5; g.lineCap = 'round';
    for (const [lx, ly, p] of [[-10, -8, sw], [10, -8, -sw], [-9, 5, -sw], [9, 5, sw]]) { g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + p * 0.5, ly + 14); g.stroke(); }
    g.strokeStyle = MANE; g.lineWidth = 5; g.beginPath(); g.moveTo(0, -22); g.quadraticCurveTo(5, -30, 1, -37); g.stroke();      // tail
    g.fillStyle = hurt ? '#ffb0b0' : COAT; g.beginPath(); g.ellipse(0, -2, 13, 21, 0, 0, 7); g.fill();                           // barrel
    g.fillStyle = hurt ? '#ffc0c0' : COAT_DK; g.beginPath(); g.ellipse(0, -17, 12, 10, 0, 0, 7); g.fill();                       // rump
    g.fillStyle = hurt ? '#ffb0b0' : COAT; g.beginPath(); g.ellipse(0, 16, 8, 13, 0, 0, 7); g.fill();                            // neck
    g.beginPath(); g.ellipse(0, 29, 7.5, 9, 0, 0, 7); g.fill();                                                                  // head
    g.fillStyle = MANE; g.beginPath(); g.ellipse(0, 13, 5, 10, 0, 0, 7); g.fill();                                               // crest
    g.fillStyle = COAT_LT; for (const ex of [-6, 6]) { g.beginPath(); g.moveTo(ex, 23); g.lineTo(ex * 1.7, 14); g.lineTo(ex * 0.4, 17); g.closePath(); g.fill(); } // ears
    g.fillStyle = hurt ? '#ffc0c0' : COAT_DK; g.beginPath(); g.ellipse(0, 36, 5, 4.2, 0, 0, 7); g.fill();                        // muzzle
    if (dir === 1) { g.fillStyle = '#222'; g.beginPath(); g.arc(-3.8, 28, 1.6, 0, 7); g.arc(3.8, 28, 1.6, 0, 7); g.fill(); }     // eyes, only when she looks at you
    g.fillStyle = TACK; roundRect(g, -8, -8, 16, 9, 3); g.fill();                                                                // saddle
    g.fillStyle = TACK_LT; g.fillRect(-10, -6, 20, 2);                                                                           // blanket edge
    g.restore();
  }
  // rider = the look to put in the saddle (playerLook()), or null for a mare standing on her own
  function drawHorse(g, e, hurt, rider) {
    const vert = Math.abs(e.facing.y) > Math.abs(e.facing.x);
    if (vert) horseEnd(g, e, hurt); else horseSide(g, e, hurt, !rider);
    if (rider) {
      g.save(); g.translate(0, vert ? -11 : -20); g.scale(0.85, 0.85);
      drawHuman(g, { facing: e.facing, hurtT: e.hurtT || 0, attackT: 0 }, rider);
      g.restore();
    }
  }
  const parkedMare = (x, y, fx) => ({ x, y, r: HORSE_R, facing: { x: fx === undefined ? 1 : fx, y: 0 }, hurtT: 0, attackT: 0, moving: false, walkT: 0 });
  function drawHorseTile(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.save(); g.translate(cx, cy + 4);
    g.fillStyle = 'rgba(0,0,0,0.26)'; g.beginPath(); g.ellipse(0, 20, 28, 9, 0, 0, 7); g.fill();
    g.translate(0, Math.sin(time * 1.4 + tx) * 1.2);
    drawHorse(g, parkedMare(cx, cy), false, null);
    g.restore();
  }
  function drawHitchTile(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.save(); g.translate(cx, cy);
    g.fillStyle = 'rgba(0,0,0,0.24)'; g.beginPath(); g.ellipse(0, 16, 22, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#6b4f2a'; g.fillRect(-17, -18, 6, 34); g.fillRect(11, -18, 6, 34);   // two posts
    g.fillStyle = TACK_LT; g.fillRect(-19, -14, 38, 6);                                  // the rail
    g.fillStyle = '#5a4020'; g.fillRect(-19, -9, 38, 2);
    g.fillStyle = '#c9b07a';                                                             // a bale of hay under it
    g.beginPath(); g.moveTo(-14, 16); g.lineTo(2, 16); g.lineTo(-1, 6); g.lineTo(-11, 6); g.closePath(); g.fill();
    g.strokeStyle = '#9c854f'; g.lineWidth = 1; g.beginPath(); g.moveTo(-12, 11); g.lineTo(0, 11); g.stroke();
    if (!H().owned) { // she is Fennick's until somebody buys her: standing at the rail, nose to the rope
      g.save(); g.translate(20, 13); g.scale(0.72, 0.72);
      drawHorse(g, parkedMare(cx, cy, -1), false, null);
      g.restore();
      g.strokeStyle = 'rgba(210,190,150,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(4, -11); g.quadraticCurveTo(0, 0, -3, 5); g.stroke();      // the rope to her head
    } else {
      g.strokeStyle = 'rgba(210,190,150,0.8)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(4, -11); g.quadraticCurveTo(8, -2, 14, -6); g.stroke();    // the empty rope, looped over the rail
    }
    g.restore();
  }
  HOOKS.draw.push((g, items, cam) => {
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 2), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 2);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 2), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty);
      if (t === T_HITCH) items.push({ y: ty * TILE + TILE - 6, draw: () => drawHitchTile(g, tx, ty) });
      else if (t === T_HORSE) items.push({ y: ty * TILE + TILE - 4, draw: () => drawHorseTile(g, tx, ty) });
    }
    if (!player.dead && riding()) {
      // the core pushed { y: player.y + player.r } drawing the WALKER for a mounted knight: that entry becomes the mare
      const draw = () => {
        const e = { x: player.x, y: player.y, r: player.r, facing: player.facing, moving: player.moving, walkT: player.walkT, hurtT: player.hurtT };
        g.save(); g.translate(player.x, player.y);
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 20, 30, 10, 0, 0, 7); g.fill();
        drawHorse(g, e, player.hurtT > 0, playerLook());
        g.restore();
      };
      let at = -1;
      for (let i = items.length - 1; i >= 0; i--) if (items[i].y === player.y + player.r) { at = i; break; }
      if (at >= 0) items[at].draw = draw; else items.push({ y: player.y + player.r + 1, draw });
    }
  });

  window.MOUNTS = {
    tiles: { HORSE: T_HORSE, HITCH: T_HITCH },
    get post() { return POST; },
    riding, tryRide, mount, dismount, whistle, buyHorse,
    PRICE: HORSE_PRICE, SPEED: HORSE_SPEED, R: HORSE_R, HP: HORSE_HP,
    get state() { return H(); },
  };


  // ---------- self-test ----------
  // These run last in the suite, so the world can be anything from a brand-new game to the far side of a
  // full --play playthrough. Nothing here assumes a landmark: the riding ground is found by scanning for a
  // clear 17 x 5 block of plain ground, and every check that needs the mare under the knight goes through ride().
  const P = 'mounts: ';
  HOOKS.selfTest.push((check, F, h) => {
    const wasTouch = window.__forceTouch; window.__forceTouch = false;
    const dc = dialog.cur, dq = dialog.queue.slice(); dialog.cur = null; dialog.queue.length = 0; closePanel();
    h.peace(true); player.dead = false; player.deadT = 0; player.hp = player.maxHp;
    if (player.mech) { player.mech = null; player.r = BASE_R; player.speed = BASE_SPEED; }
    if (window.INSTANCES && INSTANCES.active()) INSTANCES.leave();
    const body0 = player.equip.body; player.equip.body = null; player.speed = BASE_SPEED; // hover armour sets speed 200: the speed check needs a plain knight
    if (typeof tapCancel === 'function') tapCancel('manual');

    // a clear lane: 17 tiles east by 5 tall of plain ground, outside the village, no building, nobody standing in it
    const PLAIN = new Set([T.GRASS, T.DIRT, T.SAND]);
    function findLane() {
      const clear = (x, y) => {
        for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 1; xx <= x + 15; xx++) {
          if (!inMap(xx, yy) || !PLAIN.has(tileAt(xx, yy)) || insideBuilding(xx, yy) || inVillageBounds(tc(xx), tc(yy))) return false;
        }
        for (const n of NPCS) if (n.px > tc(x - 2) && n.px < tc(x + 16) && n.py > tc(y - 3) && n.py < tc(y + 3)) return false;
        return true;
      };
      for (let y = 3; y < MAP_H - 3; y++) for (let x = 2; x < MAP_W - 17; x++) if (clear(x, y)) return { x, y };
      return null;
    }
    const o = findLane() || h.openSpot(62, 24);
    // she goes beside the knight on the lane and he gets up: everything below rides through this.
    // The suite can arrive here with the knight hurt, dead, in a machine or with a villager parked on the
    // lane (a --play world has been running for a hundred thousand steps), so it clears all of that first.
    let rideWhy = null;
    const ride = () => {
      if (riding()) return true;
      for (let k = 0; k < 3; k++) {
        player.dead = false; player.deadT = 0; player.hp = player.maxHp; closePanel();
        if (player.mech) { player.mech = null; player.r = BASE_R; player.speed = BASE_SPEED; }
        F.tp(o.x, o.y); F.step([]); liftHorse();
        const parked = parkAt(o.x + 1, o.y);
        if (parked) { F.face(o.x + 1, o.y); F.press('KeyE'); F.sim(2, []); }
        // a villager standing in the way takes E before the tile does (the core talks first): mount her directly
        if (!riding() && parked) mount(o.x + 1, o.y);
        if (riding()) return true;
        rideWhy = { parked, tile: tileName(tileAt(o.x + 1, o.y)), notice: notice && notice.text };
        for (const n of NPCS) if (dist(n.px, n.py, tc(o.x), tc(o.y)) < 6 * TILE) { n.px = n.home.x + 8 * TILE; n.py = n.home.y; n.wanderT = 30; n.dir = null; }
        clearLane();
      }
      return riding();
    };
    // nothing wanders onto the lane and nothing grows back on it while the checks are using it
    function clearLane() {
      for (const n of NPCS) if (n.px > tc(o.x - 2) && n.px < tc(o.x + 16) && n.py > tc(o.y - 3) && n.py < tc(o.y + 3)) { n.px = n.home.x + 8 * TILE; n.py = n.home.y; n.wanderT = 20; n.dir = null; }
      for (let yy = o.y - 2; yy <= o.y + 2; yy++) for (let xx = o.x - 1; xx <= o.x + 15; xx++) {
        if (!inMap(xx, yy) || PLAIN.has(tileAt(xx, yy)) || tileAt(xx, yy) === T_HORSE) continue;
        regrow = regrow.filter(r => r.i !== idx(xx, yy)); changeTile(xx, yy, T.GRASS);
      }
    }

    // 1. the rail is in the world, the mare is not: nothing is given away
    { const post = POST && tileAt(POST.x, POST.y) === T_HITCH;
      let mares = 0; for (let i = 0; i < MAP_W * MAP_H; i++) if (map[i] === T_HORSE) mares++;
      check(P + 'a hitching rail stands by Fennick, no mare is given away, and R is a declared key',
        !!post && mares === 0 && H().owned === false && INTERESTING_TILES.has(T_HORSE) && INTERESTING_TILES.has(T_HITCH) && HOOKS.keyHelp.some(k => k.codes.includes('KeyR')),
        { post: POST && [POST.x, POST.y], mares, owned: H().owned, lane: [o.x, o.y] }); }

    // 2. Fennick sells her: refused without the coins, bought with them, and his stall is still one button away
    { h.clearJunk(); while (coins() > 0) removeItem('coins', coins());
      if (h.give('coins', HORSE_PRICE - 1) > 0) { const i = player.inv.findIndex(s => s && !ITEMS[s.id].weapon && !ITEMS[s.id].armour && !ITEMS[s.id].tool); if (i >= 0) player.inv[i] = null; h.give('coins', HORSE_PRICE - 1 - coins()); }
      const fen = NPCS.find(n => n.id === 'fennick'); F.tp(fen.x, fen.y - 1); F.step([]);
      const w = F.talk('fennick'); render();
      const offered = panel === 'stable';
      const greyed = buttons.some(b => b.label === `disabled:Buy the mare — ${HORSE_PRICE} coins`);
      const tradeBtn = buttons.some(b => b.label === 'Trade pelts and scrap');
      h.give('coins', HORSE_PRICE - coins()); render();
      const c0 = coins(); const bought = F.clickButton(`Buy the mare — ${HORSE_PRICE} coins`);
      const at = horseAt();
      const nearRail = !!at && !!POST && Math.max(Math.abs(at.tx - POST.x), Math.abs(at.ty - POST.y)) <= 4;
      closePanel();
      check(P + `Fennick sells the mare for ${HORSE_PRICE} coins — greyed out one coin short, bought at the price, tied at the rail`,
        offered && greyed && tradeBtn && bought && H().owned === true && coins() === c0 - HORSE_PRICE && nearRail,
        { w, offered, greyed, tradeBtn, bought, coins: coins(), at: at && [at.tx, at.ty], post: POST && [POST.x, POST.y] });
      dialog.cur = null; dialog.queue.length = 0; F.talk('fennick'); render();
      check(P + 'once she is sold Fennick opens his own stall again, not the rail', panel === 'shop' && panelArg === 'trader', { panel, panelArg });
      closePanel(); dialog.cur = null; dialog.queue.length = 0; }

    // 3. E on her mounts: twice the speed, her own body, and her tile gives the ground back
    { clearLane(); F.tp(o.x, o.y); F.step([]); liftHorse();
      const parked = parkAt(o.x + 1, o.y);
      F.face(o.x + 1, o.y); F.press('KeyE'); F.sim(2, []);
      check(P + `${keyName('E')} on her mounts up — kind "horse", ${HORSE_SPEED} speed (twice ${BASE_SPEED}), r ${HORSE_R}, and the ground under her comes back`,
        parked && riding() && player.mech.kind === 'horse' && player.mech.maxHp === HORSE_HP && player.speed === HORSE_SPEED && player.r === HORSE_R && PLAIN.has(tileAt(o.x + 1, o.y)) && !H().at,
        { parked, mech: player.mech, speed: player.speed, r: player.r, tile: tileAt(o.x + 1, o.y), notice: notice && notice.text }); }

    // 4. she really is twice as quick over the same ground
    { const up = ride();
      F.tp(o.x, o.y); F.sim(2, []);
      const mx0 = player.x; F.sim(50, ['KeyD']); const mounted = player.x - mx0;
      F.press('KeyX'); F.sim(2, []);
      const onFoot = !riding() && player.speed === BASE_SPEED && player.r === BASE_R;
      F.tp(o.x, o.y); F.sim(2, []);
      const wx0 = player.x; F.sim(50, ['KeyD']); const walked = player.x - wx0;
      const ratio = walked > 1 ? mounted / walked : 0;
      check(P + 'riding covers twice the ground of walking over the same 50 ticks',
        up && onFoot && walked > 100 && ratio > 1.9 && ratio < 2.1, { up, why: rideWhy, onFoot, walked: +walked.toFixed(1), mounted: +mounted.toFixed(1), ratio: +ratio.toFixed(3) }); }

    // 5. X parks her as a mare, never as a walker wreck; the RIDE / GET DOWN button does the same job
    { const up = ride();
      const ptx = Math.floor(player.x / TILE), pty = Math.floor(player.y / TILE);
      F.press('KeyX'); F.sim(2, []);
      const at1 = horseAt();
      const parkedByX = !!at1 && !riding() && player.speed === BASE_SPEED && player.r === BASE_R;
      const noWreck = !nearestTileOfType(ptx, pty, T.WRECK, 3) && !nearestTileOfType(ptx, pty, T.MECH, 3);
      F.tp(o.x, o.y); F.step([]); liftHorse(); parkAt(o.x + 1, o.y); F.face(o.x + 1, o.y);
      render(); const rideBtn = F.clickButton('RIDE'); F.sim(2, []);
      const upAgain = riding();
      render(); const downBtn = F.clickButton('GET DOWN'); F.sim(2, []);
      const downAgain = !riding() && !!horseAt();
      check(P + `${keyName('X')} parks her as a mare (never a walker wreck), and the RIDE / GET DOWN button does the same job`,
        up && parkedByX && noWreck && rideBtn && upAgain && downBtn && downAgain,
        { up, why: rideWhy, parkedByX, noWreck, rideBtn, upAgain, downBtn, downAgain, at: at1 && [at1.tx, at1.ty] }); }

    // 5b. that button is only real while the world is clear. HOOKS.hud draws before the panels, and a click is
    // matched against the button list before the open panel, so a button left drawn under a panel would still
    // eat the click and throw the knight off his horse. With Skills open the button must not be registered at
    // all, and the click must be swallowed by the panel it landed on.
    { const up = ride(); render();
      dialog.cur = null; dialog.queue.length = 0;
      const btn = buttons.find(b => b.label === 'GET DOWN');
      openPanel('skills'); render();
      const gone = !buttons.some(b => b.label === 'RIDE' || b.label === 'GET DOWN');
      const pr = panelRect && { ...panelRect };
      // a point inside both the panel and the rect the button had: exactly where the ghost used to win
      const cx = btn && pr ? Math.max(btn.x, pr.x) + 4 : -1, cy = btn && pr ? Math.max(btn.y, pr.y) + 4 : -1;
      const overlaps = !!btn && !!pr && cx < Math.min(btn.x + btn.w, pr.x + pr.w) && cy < Math.min(btn.y + btn.h, pr.y + pr.h);
      if (overlaps) pointerDown(cx, cy, 'mouse');
      F.sim(2, []); // let the click land the way a real one would, over a frame
      const stillUp = riding(), stillOpen = panel === 'skills';
      closePanel(); render();
      const back = buttons.some(b => b.label === 'GET DOWN') && riding();
      F.press('KeyX'); F.sim(2, []); // leave the lane the way the checks below expect it: on foot, mare parked
      check(P + 'no ghost RIDE / GET DOWN button under an open panel — a click on Skills stays on Skills and never throws you off',
        up && !!btn && overlaps && gone && stillUp && stillOpen && back && !riding(),
        { up, why: rideWhy, btn: btn && [btn.x, btn.y, btn.w, btn.h], panel: pr, click: [cx, cy], overlaps, gone, stillUp, stillOpen, back }); }

    // 6. the R key rides and gets down
    { clearLane(); F.tp(o.x, o.y); F.step([]); liftHorse(); const parked = parkAt(o.x + 1, o.y);
      F.press('KeyR'); F.sim(2, []); const up = riding();
      F.press('KeyR'); F.sim(2, []); const down = !riding() && !!horseAt();
      check(P + 'the R key rides her and gets you down again', parked && up && down, { parked, up, down, notice: notice && notice.text }); }

    // 7. every refusal, for real
    { const refusal = fn => { notice = null; fn(); return notice && notice.text; };
      // indoors: two clear floor tiles in a house with nobody in it, her tile forced onto one, E on her from the other
      let room = null;
      for (const b of BUILDINGS) { if (room || b.coffin) continue;
        for (let y = b.y + 1; y < b.y + b.h - 1 && !room; y++) for (let x = b.x + 1; x < b.x + b.w - 2 && !room; x++) {
          if (tileAt(x, y) !== T.FLOOR || tileAt(x + 1, y) !== T.FLOOR) continue;
          if (NPCS.some(n => dist(n.px, n.py, tc(x), tc(y)) < 5 * TILE)) continue;
          if (monsters.some(m => !m.dead && dist(m.x, m.y, tc(x), tc(y)) < 4 * TILE)) continue;
          room = { x, y };
        } }
      let indoors = null;
      if (room) { const gx = room.x + 1, gy = room.y, was = tileAt(gx, gy);
        liftHorse(); changeTile(gx, gy, T_HORSE); H().at = [gx, gy]; H().under = tileName(was);
        F.tp(room.x, room.y); F.step([]); F.face(gx, gy);
        indoors = refusal(() => { F.press('KeyE'); F.sim(2, []); });
        changeTile(gx, gy, was); H().at = null; H().under = null; }
      const indoorsOk = !riding() && !!indoors && /indoors/i.test(indoors);
      // back to open ground with her beside us
      clearLane(); F.tp(o.x, o.y); F.step([]); liftHorse(); parkAt(o.x + 1, o.y);
      // inside another machine
      player.mech = { hp: 130, maxHp: 130 }; player.r = 20; player.speed = 115;
      const inMech = refusal(() => { F.press('KeyR'); F.sim(1, []); });
      const inMechOk = !riding() && !!player.mech && !!inMech && /walker/i.test(inMech);
      player.mech = null; player.r = BASE_R; player.speed = BASE_SPEED; F.sim(1, []);
      // on water, in hover armour (the only way a knight stands on it at all)
      const px0 = player.x, py0 = player.y;
      const wt = F.nearestTile([T.WATER]);
      let onWater = null, onWaterOk = false;
      if (wt) { player.equip.body = 'hover_armour'; F.sim(2, []);
        F.tp(wt.x, wt.y); F.sim(1, []);
        onWater = refusal(() => { F.press('KeyR'); F.sim(1, []); });
        onWaterOk = !riding() && !!onWater && /water|hover/i.test(onWater);
        player.equip.body = null; F.sim(2, []); player.x = px0; player.y = py0; player.speed = BASE_SPEED; F.sim(1, []); }
      // down a dungeon
      let inDen = null, inDenOk = false, entered = false;
      if (window.INSTANCES && INSTANCES.get) {
        for (const id of ['spider_den', 'aerie']) { if (entered || !INSTANCES.get(id)) continue; entered = INSTANCES.enter(id); F.sim(2, []); }
        if (entered) { inDen = refusal(() => { F.press('KeyR'); F.sim(1, []); }); inDenOk = !riding() && !!inDen && /outside|open/i.test(inDen); INSTANCES.leave(); F.sim(2, []); }
      }
      F.tp(o.x, o.y); F.sim(2, []);
      check(P + 'she refuses indoors, inside another machine, on water (hover armour or not) and down a dungeon',
        indoorsOk && inMechOk && onWaterOk && entered && inDenOk && !riding(),
        { indoors, inMech, onWater, entered, inDen }); }

    // 8. she can never take the knight anywhere his own feet could not go
    { const up = ride();
      const wx = o.x + 3, wy = o.y, dx2 = o.x, dy2 = o.y + 2;
      const wasW = tileAt(wx, wy), wasD = tileAt(dx2, dy2);
      changeTile(wx, wy, T.WATER); changeTile(dx2, dy2, T.DOOR);
      player.equip.body = 'hover_armour'; WALK_OVER.add(T.WATER);
      F.tp(o.x + 2, o.y); F.sim(40, ['KeyD']);
      const stoppedAtWater = Math.floor(player.x / TILE) < wx;
      F.tp(dx2, dy2 - 1); F.sim(40, ['KeyS']);
      const stoppedAtDoor = Math.floor(player.y / TILE) < dy2;
      const who = playerWho();
      player.equip.body = null; WALK_OVER.delete(T.WATER);
      changeTile(wx, wy, wasW); changeTile(dx2, dy2, wasD);
      F.tp(o.x, o.y); F.sim(2, []);
      check(P + 'mounted, she is stopped by water and by a door even while hover armour would float the knight through',
        up && stoppedAtWater && stoppedAtDoor && who === 'beast', { up, why: rideWhy, stoppedAtWater, stoppedAtDoor, who }); }

    // 9. no swinging from the saddle; on foot the swing is back
    { const up = ride();
      player.attackCd = 0; player.attackT = 0; notice = null; refuseT = -1e9;
      F.press('Space'); F.sim(1, []);
      const refused = riding() && player.attackT === 0 && !!notice && /saddle/i.test(notice.text);
      F.press('KeyX'); F.sim(2, []); player.attackCd = 0; player.attackT = 0;
      F.press('Space');
      const swings = !riding() && player.attackT > 0;
      check(P + 'no swinging from the saddle, and the swing comes straight back on foot', up && refused && swings, { up, why: rideWhy, refused, swings, notice: notice && notice.text });
      F.sim(30, []); }

    // 10. she is hurt out from under you: no wreck tile, she bolts to the rail, and she rests back up
    { const up = ride();
      let thrown = false, atRail = false, noWreck = false, tired = false, rested = false, at = null;
      if (up) {
        player.mech.hp = 2; const hp0 = player.hp;
        dialog.cur = null; dialog.queue.length = 0;
        hurtPlayer(30, player.x + 40, player.y);
        thrown = !riding() && player.hp === hp0 && player.r === BASE_R && player.speed === BASE_SPEED;
        at = horseAt();
        atRail = !!at && !!POST && Math.max(Math.abs(at.tx - POST.x), Math.abs(at.ty - POST.y)) <= 4;
        noWreck = !nearestTileOfType(o.x, o.y, T.WRECK, 3) && !nearestTileOfType(o.x, o.y, T.MECH, 3);
        tired = H().hp <= 2;
        F.sim(180, []); // three seconds of standing about
        rested = H().hp > 2 && H().hp <= HORSE_HP;
      }
      check(P + 'a hit too many throws you clear and she bolts to the rail — no wreck, and she gets her wind back',
        up && thrown && atRail && noWreck && tired && rested,
        { up, why: rideWhy, thrown, atRail, noWreck, tired, hp: +H().hp.toFixed(1), at: at && [at.tx, at.ty] });
      dialog.cur = null; dialog.queue.length = 0; }

    // 11. whistling at the rail brings her in from anywhere and rests her
    { clearLane(); liftHorse(); const far = parkAt(o.x + 5, o.y); H().hp = 3;
      F.tp(POST.x, POST.y + 2); F.step([]);
      const w = F.goAdjacent(POST.x, POST.y, 3000); F.face(POST.x, POST.y); F.press('KeyE'); F.sim(2, []);
      const at = horseAt();
      const back = !!at && Math.max(Math.abs(at.tx - POST.x), Math.abs(at.ty - POST.y)) <= 1;
      check(P + 'E on the rail whistles her in from across the map and she is rested and ready',
        far && typeof w === 'number' && back && H().hp === HORSE_HP && tileAt(o.x + 5, o.y) !== T_HORSE,
        { far, w, at: at && [at.tx, at.ty], hp: H().hp, notice: notice && notice.text }); }

    // 12. tap-to-move still drives her (17-tap paths for the wider body)
    { const up = ride();
      F.tp(o.x, o.y); F.step([]); tapCancel('manual'); tap.lastTap = null;
      const gx = o.x + 6, gy = o.y;
      render(); const sx = tc(gx) - cam.x, sy = tc(gy) - cam.y;
      pointerDown(sx, sy, 'mouse'); pointerUp('mouse');
      const started = !!player.walkPath && player.walkPath.length >= 3 && tap.kind === 'walk';
      let s = 0; while (s < 300 && tap.path && tap.path.length) { F.step([]); s++; }
      F.step([]);
      const arrived = dist(player.x, player.y, tc(gx), tc(gy)) <= 14;
      check(P + 'tap-to-move works from the saddle: a tap six tiles off walks her there',
        up && started && arrived && s < 300 && riding(), { up, why: rideWhy, started, arrived, steps: s, who: playerWho() });
      tapCancel('manual'); }

    // 13. the save carries her: under you across a reload, and parked across a reload
    { const up = ride();
      F.tp(o.x, o.y); F.sim(2, []);
      save(); const loadedUp = load();
      const stillUp = loadedUp && riding() && player.mech.kind === 'horse' && player.speed === HORSE_SPEED && player.r === HORSE_R && player.horse.owned === true;
      F.press('KeyX'); F.sim(2, []);
      const at = horseAt(); const hp0 = H().hp;
      save(); const loadedDown = load(); F.sim(1, []);
      const at2 = horseAt();
      const stillParked = loadedDown && !riding() && !!at && !!at2 && at2.tx === at.tx && at2.ty === at.ty && player.horse.owned === true && Math.abs(player.horse.hp - hp0) < 3;
      check(P + 'save and load keep her — under you across a reload, and tied where you left her',
        up && stillUp && stillParked, { up, why: rideWhy, stillUp, stillParked, at: at && [at.tx, at.ty], at2: at2 && [at2.tx, at2.ty] }); }

    // 14. she draws at all four facings, ridden and parked, without throwing
    { let drew = true; const up = ride();
      try {
        for (const f of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { player.facing = { x: f[0], y: f[1] }; player.moving = true; player.walkT += 1.1; render(); }
        player.moving = false; F.press('KeyX'); F.sim(2, []); render();
        drawHitchTile(ctx, POST.x, POST.y); drawHorseTile(ctx, o.x + 1, o.y);
        H().owned = false; drawHitchTile(ctx, POST.x, POST.y); H().owned = true; // the rail before she is bought: she is tied to it
      } catch (e) { drew = false; }
      check(P + 'the mare and the rail draw at all four facings, ridden and parked', up && drew && !riding(), { up, why: rideWhy, drew }); }

    // put the world back the way the rest of the suite expects it
    if (riding()) dismount(true);
    liftHorse();
    player.horse = { owned: false, hp: HORSE_HP, at: null, under: null };
    player.equip.body = body0; player.r = BASE_R; player.speed = BASE_SPEED; player.attackT = 0; player.attackCd = 0;
    if (typeof tapCancel === 'function') tapCancel('manual');
    closePanel(); h.peace(false);
    window.__forceTouch = wasTouch; dialog.cur = dc; dialog.queue.push(...dq);
  });
}
