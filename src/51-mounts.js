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
// riding her uses the core's 'rider' collision (a beast's, except that gates let her through), so doors, water and
// walls are solid for her even when hover armour would float the knight over them. She can never reach ground the knight cannot.
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
  const STALL = (([x, y]) => ({ x, y }))(ATLAS.port('thistledown.stall'));   // Fennick's stall: a port of the Atlas (the spread spec, section 9.1)
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

  // ---------- the rails (the spread spec, section 6 "The horse"; Stage 4b) ----------
  // Every hitching rail the mare knows. Fennick's is first; each new place adds its own with RAILS.add when it is built
  // (Stage 5), and the two reserved plots (ADDENDUM A) have theirs reserved now, with no post yet. When she is hurt out from
  // under the knight, or he falls, she bolts to the NEAREST rail he has visited (stood within VISIT tiles of), and the Voice
  // names that place. Fennick's rail always counts: she was bought there.
  //   { id, place: the words for it ("Fennick's rail in Thistledown"), at: () => { x, y } | null (the post's tile), reserved }
  const VISIT = 6;
  const RAILS = window.RAILS = [];
  RAILS.add = r => { if (!r || !r.id || RAILS.some(q => q.id === r.id) || typeof r.at !== 'function') return null; const e = Object.assign({ place: r.id, reserved: false }, r); RAILS.push(e); return e; };
  RAILS.remove = id => { const i = RAILS.findIndex(q => q.id === id); if (i >= 0) RAILS.splice(i, 1); return i >= 0; };
  RAILS.add({ id: 'thistledown', place: "Fennick's rail in Thistledown", at: () => POST });
  RAILS.add({ id: 'alchemy', place: "the Glasshouse's rail", at: () => null, reserved: true });
  RAILS.add({ id: 'necromancy', place: "the Old Barrow's rail", at: () => null, reserved: true });
  const visited = () => { const h = H(); if (!Array.isArray(h.rails)) h.rails = ['thistledown']; return h.rails; };
  RAILS.visited = id => id === 'thistledown' || visited().includes(id);
  // the nearest built rail he has visited, from a point in pixels (Fennick's when no other is nearer, or none is built)
  RAILS.nearest = (px, py) => {
    let best = null;
    for (const r of RAILS) { const p = r.at(); if (!p || !RAILS.visited(r.id)) continue; const d = dist(px, py, tc(p.x), tc(p.y)); if (!best || d < best.d) best = { r, d }; }
    return best ? best.r : RAILS[0];
  };
  RAILS.of = (tx, ty) => RAILS.find(r => { const p = r.at(); return p && p.x === tx && p.y === ty; }) || null;

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
  // to a rail (Fennick's unless one is named)
  function sendToRail(rail) {
    liftHorse();
    const p = (rail || RAILS[0]).at();
    if (p) {
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (parkAt(p.x + dx, p.y + dy)) return true;
      if (parkNear(p.x, p.y, 4)) return true;
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
  // Fennick's rail: the mare herself on a plate of vellum with her price in Cinzel, what she will and will not do in
  // plain words, the knight's own coins (and how many more he needs), a primary Buy plate and Fennick's stall.
  const STABLE_LINES = ['She carries a knight at twice walking pace.', 'She will not go indoors, down a dungeon, or into water.', 'No swinging a sword from the saddle: get down first.'];
  function stableGeom(g) {
    const K = PLACE_KIT, R = K.R(), G = K.GAP();
    const w = Math.min(460, PANEL_KIT.room().aw), inner = w - 36, f = K.SENT(13), lh = K.lineH(f);
    const textH = STABLE_LINES.reduce((a, t) => a + K.linesOf(g, t, inner, f) * lh, 0) + K.linesOf(g, coinLine(), inner, f) * lh;
    return { K, R, G, w, inner, f, lh, textH, h: 62 + 96 + 10 + textH + 10 + R + G + R + 12 };
  }
  const coinLine = () => coins() >= HORSE_PRICE ? `You have ${coins()} coins.` : `You have ${coins()} coins. ${HORSE_PRICE - coins()} more to go.`;
  HOOKS.panel.stable = (g, narrow) => {
    const Q = stableGeom(g), { K, R, G } = Q;
    const { px, py, h } = panelBox(g, Q.w, Q.h, "Fennick's rail", `A grey mare called ${NAME}, for ${HORSE_PRICE} coins.`);
    const x0 = px + 18; let y = py + 62;
    // the mare, grazing on her plate, and her price
    K.card(g, x0, y, Q.inner, 96);
    g.save(); g.beginPath(); g.rect(x0 + 3, y + 3, Q.inner - 6, 90); g.clip();
    g.translate(x0 + 70, y + 64); g.scale(1.22, 1.22);
    drawHorse(g, Object.assign(parkedMare(0, 0), { headUp: true }), false, null);
    g.restore();
    const tx = x0 + 150, tw0 = Q.inner - 150 - 12;
    K.say(g, NAME, tx, y + 34, tw0, { font: K.NAME(16), color: HK.T.goldHi, id: 'stable:name' });
    K.say(g, 'A grey mare', tx, y + 54, tw0, { font: Q.f, color: HK.T.inkDim, id: 'stable:kind' });
    HK.coin(g, tx + 8, y + 72, 8);
    K.say(g, `${HORSE_PRICE} coins`, tx + 22, y + 77, tw0 - 22, { font: K.NAME(14), color: HK.T.goldHi, id: 'stable:price' });
    y += 96 + 10;
    for (const t of STABLE_LINES) y += K.para(g, t, x0, y + 13, Q.inner, 99, { font: Q.f, color: HK.T.ink, id: 'stable:line' });
    const enough = coins() >= HORSE_PRICE;
    y += K.para(g, coinLine(), x0, y + 13, Q.inner, 99, { font: Q.f, color: enough ? HK.T.good : HK.T.warn, id: 'stable:coins' });
    const by = py + h - 12 - R - G - R;
    K.plate(g, x0, by, Q.inner, R, `Buy ${NAME} for ${HORSE_PRICE} coins`, `Buy the mare — ${HORSE_PRICE} coins`, buyHorse, 'primary', enough, { em: 'coin', name: 'Buy the mare' });
    K.plate(g, x0, by + R + G, Q.inner, R, 'Trade pelts and scrap', 'Trade pelts and scrap', () => { closePanel(); openPanel('shop', 'trader'); }, null, true);
  };
  // the panel audit's scene (PLACE_KIT, run from 63-house): short of coins, then with enough
  PLACE_KIT.scene({
    id: 'stable', panel: 'stable', name: "Fennick's rail (short of coins, and with enough)",
    setup() { const inv = player.inv.map(s => (s ? { ...s } : null)); player.inv = new Array(INV_SLOTS).fill(null); return () => { player.inv = inv; }; },
    variants: [
      { name: 'short', open: () => { player.inv = new Array(INV_SLOTS).fill(null); addItem('coins', 340); openPanel('stable'); } },
      { name: 'enough', open: () => { player.inv = new Array(INV_SLOTS).fill(null); addItem('coins', 999999); openPanel('stable'); } },
    ],
  });

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
    if (!safeSpot(player.x, player.y, HORSE_R, 'rider')) return 'No room here. Ride her from open ground.';
    return null;
  }
  function mount(tx, ty) {
    const why = mountRefusal();
    if (why) { notify(why); return false; }
    const spot = safeSpot(player.x, player.y, HORSE_R, 'rider');
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
  // she takes the ground ahead (or the tile you are on), and the knight takes the nearest free spot. When neither will
  // take her (a gateway, facing along the gate: the gate tile under her and more gate or the wall ahead), she takes the
  // nearest open ground round about, the street beside the gate first. Next to a gate she never stands where she would
  // close it to a mount that could ride through it before (94-mountgates' routes: a mare in the middle lane of a
  // three-tile town gate leaves two 48 px lanes, too narrow for the Barrelbeast).
  function aheadTile() { return { tx: Math.floor((player.x + player.facing.x * 44) / TILE), ty: Math.floor((player.y + player.facing.y * 44) / TILE) }; }
  const nearGate = (tx, ty) => { for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) if (inMap(x, y) && RIDE_THROUGH.has(tileAt(x, y))) return [x, y]; return null; };
  // every way a mount could cross the gates near (tx, ty) right now (94-mountgates loads after this file)
  const gateRoutes = at => window.MOUNTGATES && MOUNTGATES.routes ? MOUNTGATES.routes(at[0], at[1]) : [];
  function dismountSpot() {
    const own = { tx: Math.floor(player.x / TILE), ty: Math.floor(player.y / TILE) }, ft = aheadTile();
    const usable = s => inMap(s.tx, s.ty) && PLACEABLE_ON.has(tileAt(s.tx, s.ty)) && !insideBuilding(s.tx, s.ty) && !NPCS.some(n => circleHitsTile(n.px, n.py, 14, s.tx, s.ty));
    const cands = [];
    if (ft.tx !== own.tx || ft.ty !== own.ty) cands.push(ft);
    cands.push(own);
    // round about: the four sides, then the corners, then two out, nearest first
    const ring = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx || dy) ring.push({ tx: own.tx + dx, ty: own.ty + dy, d: Math.max(Math.abs(dx), Math.abs(dy)) * 10 + Math.abs(dx) + Math.abs(dy) + dist(player.x, player.y, tc(own.tx + dx), tc(own.ty + dy)) / 1000 });
    ring.sort((a, b) => a.d - b.d);
    for (const r of ring) if (!cands.some(c => c.tx === r.tx && c.ty === r.ty)) cands.push({ tx: r.tx, ty: r.ty });
    let first = null;
    for (const c of cands) {
      if (!usable(c)) continue;
      const onOwn = c.tx === own.tx && c.ty === own.ty;
      // the knight steps back off her when she takes his own tile; otherwise he gets down where he is (or close by)
      const want = onOwn ? { x: player.x - player.facing.x * TILE, y: player.y - player.facing.y * TILE } : { x: player.x, y: player.y };
      const i = idx(c.tx, c.ty), was = map[i];
      const g0 = nearGate(c.tx, c.ty), before = g0 ? gateRoutes(g0) : null;
      map[i] = T_HORSE;
      const free = safeSpot(want.x, want.y, BASE_R, 'player');
      const keeps = !g0 || (() => { const after = gateRoutes(g0); return before.every(r => after.includes(r)); })();
      map[i] = was;
      if (!free || dist(free.x, free.y, player.x, player.y) > 2.5 * TILE) continue;
      const pick = { tx: c.tx, ty: c.ty, free };
      if (keeps) return pick;
      if (!first) first = pick;
    }
    return first;
  }
  function dismount(quiet) {
    if (!riding()) return false;
    const spot = dismountSpot();
    if (!spot) { notify('No room to get down here. Ride somewhere open.'); return false; }
    H().under = tileName(tileAt(spot.tx, spot.ty)); changeTile(spot.tx, spot.ty, T_HORSE);
    H().at = [spot.tx, spot.ty]; H().hp = player.mech.hp;
    player.mech = null; player.r = BASE_R; player.speed = BASE_SPEED;
    player.x = spot.free.x; player.y = spot.free.y;
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
    const rail = RAILS.nearest(bx, by);
    sendToRail(rail); handled = true;
    burst(bx, by, '#c9a36a', 26, 150); sfx('hurt');
    say(`${NAME} has had enough of that. She throws you clear and bolts for ${rail.place}. She will be standing there, and she will need a rest before she carries you again.`, 'The Voice');
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
  function whistle(rail) {
    rail = rail || RAILS[0];
    if (!H().owned) { say("A hitching rail, a rope, and a grey mare tied to it. Fennick keeps her here. He will sell her to anyone who has walked far enough to want her.", 'The Voice'); return; }
    if (riding()) { notify(`You are already on ${NAME}.`); return; }
    const at = horseAt(), p = rail.at();
    if (at && p && Math.abs(at.tx - p.x) <= 1 && Math.abs(at.ty - p.y) <= 1) {
      H().hp = HORSE_HP; notify(`${NAME} is tied at the rail, rested and ready.`); save(); return;
    }
    if (sendToRail(rail)) { H().hp = HORSE_HP; sfx('ui'); notify(`You whistle. ${NAME} trots up to the rail.`); save(); }
    else notify('No room at the rail. Clear the ground beside the post.');
  }
  HOOKS.use.push((t, tx, ty) => {
    if (t === T_HORSE) { mount(tx, ty); return true; }
    if (t === T_HITCH) { whistle(RAILS.of(tx, ty)); return true; }
    return false;
  });

  // ---------- update: the R key, her rest, and the core's walker wording ----------
  HOOKS.keyHelp.push({ action: 'Ride or get down', codes: ['KeyG'] }); // 43-settings lists this on the Controls line
  HOOKS.update.push(dt => {
    const r = riding();
    if (rideWas !== r && typeof tapCancel === 'function') tapCancel('manual'); // the old path was built for the wrong body
    if (rideWas && !r && !handled) { // die() clears player.mech itself: she is loose, so she goes to the nearest rail he knows
      const rail = RAILS.nearest(player.x, player.y);
      H().hp = Math.max(1, H().hp); sendToRail(rail);
      notify(`${NAME} ran for ${rail.place}.`); save();
    }
    handled = false; rideWas = r;
    // a rail is visited when the knight stands within VISIT tiles of its post (the overworld only)
    if (H().owned && !window.__instance) { const tx = player.x / TILE, ty = player.y / TILE;
      for (const q of RAILS) { if (q.id === 'thistledown' || RAILS.visited(q.id)) continue; const p = q.at(); if (p && Math.hypot(tx - p.x - 0.5, ty - p.y - 0.5) <= VISIT) { visited().push(q.id); save(); } } }

    const blocked = panel && !['skills', 'quests', 'map'].includes(panel);
    if (!blocked && !player.dead && (pressed.has('KeyG') || tapped('ride'))) tryRide();

    if (riding()) { // asked again: tryRide() just above may have put the knight down this very tick
      if (player.speed !== HORSE_SPEED) player.speed = HORSE_SPEED; // hover armour / agility / webs all reset speed for the knight on foot
      player.mech.maxHp = HORSE_HP;
      // the core owns several "walker" strings; while a horse is under you they should read as a horse
      // (the core's "Press X to climb out of the walker" names a machine's key: on her it is G, or GET DOWN on a touch screen)
      if (notice && /climb out of the walker/i.test(notice.text)) notice.text = touchMode() ? `Tap GET DOWN to get off ${NAME} first.` : `Press G to get off ${NAME} first.`;
      if (notice && /walker/i.test(notice.text)) notice.text = notice.text.replace(/\bthe walker\b/gi, NAME).replace(/\bwalker\b/gi, 'mare');
      for (const f of floaters) if (f.text.indexOf('(walker)') >= 0) f.text = f.text.replace('(walker)', `(${NAME})`);
    } else if (H().owned && H().hp < HORSE_HP) {
      H().hp = Math.min(HORSE_HP, H().hp + dt * HORSE_REST); // standing about, she gets her wind back
    }
  });
  HOOKS.newGame.push(() => { rideWas = false; handled = false; refuseT = -1e9; });

  // ---------- HUD: her name on the crest, and RIDE / GET DOWN on the context seat ----------
  // The mare's hp is the crest's big number while you ride (hudMechName names her). RIDE and GET DOWN are faces of the
  // kit's context seat (src/59-hudkit.js): a horseshoe RIDE when your mare is near (after LEAVE and BUILD), the down-into-
  // the-tray GET DOWN while you are up. The key is G, read from the same handler the update uses (X also gets you down).
  // A seat under an open panel takes no taps (10-hud drops a HUD control a panel covers), so a click on a panel never
  // throws you off.
  hudMechName(() => riding() ? NAME : null);
  hudSeatFace('ctx', { id: 'getdown', prio: 50, when: () => riding() && !player.dead, emblem: 'getdown', ribbon: 'GET DOWN', key: 'G', name: 'Get down (G or X)', action: tryRide });
  hudSeatFace('ctx', { id: 'ride', prio: 10, when: () => !player.dead && !riding() && H().owned && !player.mech && !!horseNear(), emblem: 'horseshoe', ribbon: 'RIDE', key: 'G', name: `Ride ${NAME}`, action: tryRide });
  // the coach: "[G] Ride" at the knight the first times his mare is near
  HOOKS.hud.push(() => { if (!paused && !panel && !player.dead && !riding() && H().owned && !player.mech && horseNear()) HK.teach('ride', 'G', 'Ride', { x: player.x, y: player.y, lift: 46 }, { emblem: 'horseshoe' }); });

  // ---------- art: Cinder in the new look, the knight in the saddle, drawn right at all four facings ----------
  // Drawn the way the monster refit draws its animals (78-monsterart: the wolf, the boar, the sheep, the cow): seen from
  // the side facing left or right (mirrored for left), from the front facing down (her long face toward us) and from
  // behind facing up (her rump and tail toward us); soft dark outline, light from the top left, legs that trot. The
  // knight sits in the saddle in his own drawing (82-knightgear, seated: no legs, as every pilot sits). Her own helpers below are the sample's (shade, ellipse, outline, lit fills), so nothing is shared with a
  // file the server copy strips. Units: the drawing is made at the sample's scale and grown by MARE_K to game pixels;
  // her hooves stand on y 10 (21.5 px under her middle, where the old mare's stood).
  const MARE_K = 2.15, M_OUT = 'rgba(22,14,8,0.62)', M_TAU = Math.PI * 2;
  const MC = { coat: '#a2a8b1', dark: '#7d838c', light: '#c6cad0', dapple: '#bdc2c9', belly: '#b9bec5', mane: '#3f3f48', hoof: '#2b2b33',
    muzzle: '#6f747d', leather: '#6b4423', leatherLt: '#8a5a32', cloth: '#7a2e2e', trim: '#e0b546', steel: '#c9ccd3', bridle: '#4a2f1a' };
  const M_SH = new Map();
  function mShade(c, f) {
    const k = c + '|' + f; let s = M_SH.get(k); if (s) return s;
    const n = parseInt(c.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; gg *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; }
    s = `rgb(${r | 0},${gg | 0},${b | 0})`; if (M_SH.size > 400) M_SH.clear(); M_SH.set(k, s); return s;
  }
  const mEll = (g, x, y, rx, ry, rot) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, M_TAU); };
  const mLine = (g, w) => { g.strokeStyle = M_OUT; g.lineWidth = w || 0.7; g.stroke(); };
  function mV(g, c, y0, y1, hi, lo) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, mShade(c, hi === undefined ? 0.28 : hi)); gr.addColorStop(0.55, c); gr.addColorStop(1, mShade(c, lo === undefined ? -0.28 : lo)); return gr; }
  function mR(g, c, x, y, r) { const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1); gr.addColorStop(0, mShade(c, 0.32)); gr.addColorStop(0.6, c); gr.addColorStop(1, mShade(c, -0.3)); return gr; }
  function mRR(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  // where the stride is: a gallop on the knight's own step clock (she covers twice his ground, so her legs go quicker)
  const strideOf = e => e.moving ? (+e.walkT || 0) * 1.55 : 0;
  // one leg: hip at (x, y), a knee that bends as it swings, a dark hoof with a pale band over it
  function mLeg(g, x, y, len, w, a, c, front, near) {
    g.save(); g.translate(x, y); g.rotate(a);
    const bend = front ? Math.max(0, -a) * 1.6 : Math.max(0, a) * 1.2;
    g.beginPath(); g.moveTo(-w * 0.62, 0); g.lineTo(w * 0.62, 0); g.lineTo(w * 0.42 + bend * 0.6, len * 0.55); g.lineTo(w * 0.36, len - 1.4); g.lineTo(-w * 0.36, len - 1.4); g.lineTo(-w * 0.46 + bend * 0.6, len * 0.55); g.closePath();
    g.fillStyle = near ? mV(g, c, 0, len, 0.12, -0.3) : mShade(c, -0.28); g.fill(); mLine(g, 0.5);
    mEll(g, bend * 0.6 * (front ? 1 : 0.8), len * 0.55, w * 0.5, w * 0.42); g.fillStyle = near ? mShade(c, 0.12) : mShade(c, -0.22); g.fill();
    mRR(g, -w * 0.5, len - 1.9, w, 1.9, 0.6); g.fillStyle = MC.hoof; g.fill(); mLine(g, 0.4);
    g.fillStyle = near ? MC.light : mShade(MC.light, -0.25); g.fillRect(-w * 0.42, len - 2.4, w * 0.84, 0.55);
    g.restore();
  }
  // the four legs from the side: the far pair darker, diagonal pairs swinging together
  function mLegsSide(g, e, bob) {
    const ph = strideOf(e), sw = p => e.moving ? Math.sin(ph + p) * 0.5 : 0;
    mLeg(g, -7.4, 0.6 + bob, 9.6, 2.4, sw(Math.PI), MC.coat, false, false);
    mLeg(g, 4.2, 0.4 + bob, 9.8, 2.2, sw(0), MC.coat, true, false);
    mLeg(g, -6.2, 0.8 + bob, 9.4, 2.5, sw(0), MC.coat, false, true);
    mLeg(g, 5.4, 0.6 + bob, 9.6, 2.3, sw(Math.PI), MC.coat, true, true);
  }
  // the tail: dark, full, swinging as she goes and swishing now and then when she stands
  function mTailSide(g, e, bob) {
    const swish = e.moving ? Math.sin(strideOf(e)) * 0.18 : Math.sin(time * 1.7 + (e.seed || 0)) * 0.12 + Math.max(0, Math.sin(time * 0.9) - 0.9) * 3;
    g.save(); g.translate(-10.6, -4.6 + bob); g.rotate(0.15 + swish);
    g.beginPath(); g.moveTo(0, -0.6); g.quadraticCurveTo(-3.6, 0.4, -3.4, 6); g.quadraticCurveTo(-3.6, 10, -1.6, 12.4); g.quadraticCurveTo(-0.6, 9, 0.6, 7.6); g.quadraticCurveTo(1.6, 3, 1.2, 0.4); g.closePath();
    g.fillStyle = mV(g, MC.mane, -1, 12, 0.18, -0.2); g.fill(); mLine(g, 0.55);
    g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 0.35; for (const k of [-1.6, -0.6]) { g.beginPath(); g.moveTo(k + 0.4, 1); g.quadraticCurveTo(k - 1.4, 5, k - 0.2, 10.4); g.stroke(); }
    g.restore();
  }
  // the barrel of her body, dappled grey, with the belly a shade lighter
  function mBodySide(g) {
    const body = () => { g.beginPath(); g.moveTo(-11.2, -3.4); g.quadraticCurveTo(-11, -7.2, -6, -6.8); g.quadraticCurveTo(-1.4, -5.2, 3.4, -6.6); g.quadraticCurveTo(7.6, -6.6, 8.2, -2.6); g.quadraticCurveTo(8.4, 1.2, 5.6, 2); g.quadraticCurveTo(-1, 3.2, -7.4, 2.2); g.quadraticCurveTo(-11.8, 1.2, -11.2, -3.4); g.closePath(); };
    body(); g.fillStyle = mV(g, MC.coat, -7, 3, 0.2, -0.24); g.fill();
    g.save(); body(); g.clip();
    g.fillStyle = MC.belly; mEll(g, -1.6, 2.4, 7.4, 1.8); g.fill();
    g.fillStyle = MC.dapple; for (const [x, y, r] of [[-8.6, -4.2, 1.1], [-6.6, -2.4, 0.9], [-8.2, -1, 0.7], [-4.4, -4.4, 0.8], [-5.6, -0.6, 0.6], [5.2, -3.6, 0.7], [3.4, -1.6, 0.6]]) { mEll(g, x, y, r, r * 0.8); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; mEll(g, -2, 3.6, 10, 2.2); g.fill();
    g.restore();
    body(); mLine(g, 0.8);
    // the line of her hip and her shoulder
    g.strokeStyle = 'rgba(40,40,50,0.28)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-8.4, -5.6); g.quadraticCurveTo(-5.6, -2.6, -7.6, 1.4); g.stroke(); g.beginPath(); g.moveTo(4.4, -5.4); g.quadraticCurveTo(6.6, -2.2, 5.2, 1.6); g.stroke();
  }
  // the neck and head, from the side. down: 0 standing tall, 1 grazing (the whole neck swung down about its root)
  function mHeadSide(g, e, bob, down) {
    g.save(); g.translate(5.4, -4.4 + bob); g.rotate(down * 1.05 + (e.moving ? Math.sin(strideOf(e) * 2) * 0.05 : Math.sin(time * 1.3 + (e.seed || 0)) * 0.03));
    // the neck, thick at the shoulder and fine at the throat
    g.beginPath(); g.moveTo(-2.4, -1.6); g.quadraticCurveTo(-0.8, -8.2, 3.4, -10.6); g.lineTo(6.6, -9.2); g.quadraticCurveTo(4.6, -5.6, 3.6, 2.6); g.quadraticCurveTo(0, 3, -2.4, -1.6); g.closePath();
    g.fillStyle = mV(g, MC.coat, -11, 3, 0.22, -0.2); g.fill(); mLine(g, 0.7);
    g.strokeStyle = 'rgba(40,40,50,0.22)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(4.6, -6.6); g.quadraticCurveTo(3.4, -2.6, 2.2, 1.2); g.stroke();
    // the head: long, a flat forehead, a soft dark muzzle
    g.save(); g.translate(4.4, -10.4); g.rotate(0.95);
    const head = () => { g.beginPath(); g.moveTo(-1.6, -2.4); g.quadraticCurveTo(2, -3.4, 6.4, -2.2); g.quadraticCurveTo(8.6, -1.6, 8.4, 0.6); g.quadraticCurveTo(8, 2.4, 6, 2.2); g.quadraticCurveTo(2.4, 2.4, -1.4, 2.6); g.quadraticCurveTo(-3, 0, -1.6, -2.4); g.closePath(); };
    head(); g.fillStyle = mV(g, MC.coat, -3, 3, 0.25, -0.22); g.fill();
    g.save(); head(); g.clip(); g.fillStyle = mV(g, MC.muzzle, -2, 3, 0.15, -0.25); mEll(g, 7.4, 0.2, 2.6, 2.6); g.fill(); g.restore();
    head(); mLine(g, 0.7);
    // a nostril, the mouth line, the eye with its lid and a glint
    g.fillStyle = '#2a2a30'; mEll(g, 7.6, -0.4, 0.55, 0.4, 0.4); g.fill();
    g.strokeStyle = 'rgba(30,30,36,0.6)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(8.2, 1.4); g.quadraticCurveTo(7.2, 1.8, 6.2, 1.6); g.stroke();
    g.fillStyle = '#17161a'; mEll(g, 1.4, -0.9, 0.9, 0.72); g.fill(); g.fillStyle = '#ffffff'; mEll(g, 1.15, -1.15, 0.3, 0.3); g.fill();
    g.strokeStyle = 'rgba(40,40,50,0.5)'; g.lineWidth = 0.35; g.beginPath(); g.arc(1.4, -0.9, 1.2, Math.PI * 1.1, Math.PI * 1.8); g.stroke();
    // the bridle: a brow band, a nose band and the cheek strap, a bright bit ring at her mouth
    g.strokeStyle = MC.bridle; g.lineWidth = 0.55; g.beginPath(); g.moveTo(-0.6, -2.6); g.lineTo(0.4, 2.4); g.moveTo(4.6, -2.6); g.lineTo(4.8, 2.3); g.moveTo(0, 0.4); g.lineTo(4.7, 0.2); g.stroke();
    mEll(g, 6.4, 1.6, 0.6, 0.6); g.strokeStyle = MC.steel; g.lineWidth = 0.35; g.stroke();
    // her ears, pricked forward, and the forelock between them
    for (const [x, d] of [[-0.4, 0.75], [0.6, 1]]) { g.beginPath(); g.moveTo(x - 1.2, -2); g.quadraticCurveTo(x - 2.6, -5.2, x - 1.8, -5.8); g.quadraticCurveTo(x - 0.4, -4.4, x + 0.6, -2.2); g.closePath(); g.fillStyle = d < 1 ? MC.dark : MC.coat; g.fill(); mLine(g, 0.45); }
    g.beginPath(); g.moveTo(-1.2, -2.6); g.quadraticCurveTo(0.6, -3.6, 1.6, -1.2); g.quadraticCurveTo(0.2, -2, -1.2, -1.6); g.closePath(); g.fillStyle = MC.mane; g.fill();
    g.restore();
    // the mane down the crest of her neck, falling to the far side in locks
    g.beginPath(); g.moveTo(-2.6, -1.8); g.quadraticCurveTo(-1.2, -8.6, 3.4, -10.9);
    for (let k = 0; k <= 5; k++) { const t = k / 5, x = 3.4 + (-3.6 - 3.4) * t, y = -10.9 + (-0.4 + 10.9) * t; g.lineTo(x + 1.2, y + 1.4 + (k % 2) * 0.8); }
    g.closePath(); g.fillStyle = mV(g, MC.mane, -11, 0, 0.2, -0.2); g.fill(); mLine(g, 0.5);
    g.restore();
  }
  // the head's bit, in her own units on the side view, for the reins: the same turns mHeadSide makes
  function mBitSide(bob, down) {
    const a = down * 1.05, c = Math.cos(a), s = Math.sin(a), b = 0.95, cb = Math.cos(b), sb = Math.sin(b);
    const hx = 4.4 + 6.4 * cb - 1.6 * sb, hy = -10.4 + 6.4 * sb + 1.6 * cb;
    return { x: 5.4 + hx * c - hy * s, y: -4.4 + bob + hx * s + hy * c };
  }
  // the saddle: the red cloth with its gold edge, the leather seat with a pommel and a cantle, the girth
  function mSaddleSide(g, bob) {
    g.save(); g.translate(0, bob);
    mRR(g, -5.6, -6.6, 9.4, 4.6, 1.2); g.fillStyle = mV(g, MC.cloth, -6.6, -2, 0.2, -0.25); g.fill(); mLine(g, 0.5);
    g.strokeStyle = MC.trim; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-5.2, -2.5); g.lineTo(3.4, -2.5); g.stroke();
    g.strokeStyle = MC.leather; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-0.6, -4); g.lineTo(-0.2, 2.2); g.stroke(); g.strokeStyle = M_OUT; g.lineWidth = 0.3; g.stroke();
    g.beginPath(); g.moveTo(-4.6, -8.4); g.quadraticCurveTo(-3.6, -6.4, -1, -6.6); g.quadraticCurveTo(1, -6.6, 2, -8); g.quadraticCurveTo(2.8, -8.6, 2.6, -6.2); g.quadraticCurveTo(-0.6, -4.8, -4.6, -5.4); g.quadraticCurveTo(-5.4, -7, -4.6, -8.4); g.closePath();
    g.fillStyle = mV(g, MC.leather, -8.6, -5, 0.25, -0.3); g.fill(); mLine(g, 0.5);
    g.fillStyle = MC.trim; mEll(g, 2.3, -7.9, 0.45, 0.45); g.fill();
    g.restore();
  }
  // the stirrup on the near side: its leather from the saddle and the iron. A rider sits as every pilot does in the new
  // look (82-knightgear: seated, no legs), so the stirrup hangs as it is
  function mStirrupSide(g, bob) {
    g.save(); g.translate(0, bob);
    g.strokeStyle = MC.leather; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-0.6, -5.6); g.lineTo(-0.4, -0.8); g.stroke();
    g.strokeStyle = MC.steel; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-1.4, -0.9); g.lineTo(-1.6, 0.9); g.lineTo(1.2, 0.9); g.lineTo(1, -0.9); g.stroke();
    g.restore();
  }
  function mareSide(g, e, rider) {
    const bob = e.moving ? -Math.abs(Math.sin(strideOf(e))) * 0.6 : Math.sin(time * 1.6 + (e.seed || 0)) * 0.15;
    const down = rider || e.headUp ? 0 : 1;
    mTailSide(g, e, bob);
    mLegsSide(g, e, bob);
    g.save(); g.translate(0, bob); mBodySide(g); g.restore();
    mHeadSide(g, e, bob, down);
    mSaddleSide(g, bob);
    // the reins from the bit, over her neck, to the saddle's pommel
    const bit = mBitSide(bob, down);
    g.strokeStyle = MC.bridle; g.lineWidth = 0.5; g.beginPath(); g.moveTo(bit.x, bit.y); g.quadraticCurveTo((bit.x + 2) / 2, Math.max(bit.y, -6 + bob) + 0.6, 2.2, -6.4 + bob); g.stroke();
    if (rider) rider(-0.6, -6.4 + bob);
    mStirrupSide(g, bob);
  }
  // facing us: her long face in front of her chest, both front legs, the hind ones behind them; the knight sits behind her head
  function mareFront(g, e, rider) {
    const ph = strideOf(e), sw = p => e.moving ? Math.sin(ph + p) * 1.2 : 0, bob = e.moving ? -Math.abs(Math.sin(ph)) * 0.6 : Math.sin(time * 1.6 + (e.seed || 0)) * 0.15;
    // hind legs, short and dark, then the front pair
    for (const s of [-1, 1]) mLeg(g, s * 3.3, 0.6 + bob, 8.6 - Math.abs(sw(s > 0 ? 0 : Math.PI)) * 0.5, 2.1, 0, MC.coat, false, false);
    for (const s of [-1, 1]) { g.save(); g.translate(0, -Math.max(0, sw(s > 0 ? Math.PI : 0)) * 0.9); mLeg(g, s * 2.7, 1.2 + bob, 9, 2.4, 0, MC.coat, true, true); g.restore(); }
    g.save(); g.translate(0, bob);
    // her chest and shoulders, the saddle cloth showing either side
    mEll(g, 0, -2.2, 6.6, 5.4); g.fillStyle = mR(g, MC.coat, 0, -2.6, 6.4); g.fill(); mLine(g, 0.8);
    for (const s of [-1, 1]) { mRR(g, s > 0 ? 4.4 : -6.6, -7.2, 2.2, 4.8, 0.8); g.fillStyle = mV(g, MC.cloth, -7.2, -2.4, 0.2, -0.25); g.fill(); mLine(g, 0.45); g.fillStyle = MC.trim; g.fillRect(s > 0 ? 4.6 : -6.4, -2.9, 1.8, 0.4); }
    g.strokeStyle = MC.steel; g.lineWidth = 0.45; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6.6, -3.6); g.lineTo(s * 6.8, -0.6); g.stroke(); }
    // the saddle's front, its pommel up between her shoulders
    g.beginPath(); g.moveTo(-3.6, -7.4); g.quadraticCurveTo(0, -9.4, 3.6, -7.4); g.lineTo(3, -6); g.quadraticCurveTo(0, -7.2, -3, -6); g.closePath(); g.fillStyle = mV(g, MC.leather, -9, -6); g.fill(); mLine(g, 0.45);
    g.restore();
    if (rider) rider(0, -7.4 + bob);
    g.save(); g.translate(0, bob);
    // her neck rising behind her face, the mane falling to one side, then the face itself
    g.beginPath(); g.moveTo(-3, -4); g.quadraticCurveTo(-3.4, -9.6, -1.8, -11.6); g.lineTo(1.8, -11.6); g.quadraticCurveTo(3.4, -9.6, 3, -4); g.closePath(); g.fillStyle = mV(g, MC.coat, -12, -4, 0.2, -0.18); g.fill(); mLine(g, 0.6);
    g.beginPath(); g.moveTo(1.6, -11.4); g.quadraticCurveTo(3.8, -8.6, 3.4, -4.6); g.lineTo(2.4, -5.6); g.quadraticCurveTo(2.6, -8.6, 0.8, -11); g.closePath(); g.fillStyle = MC.mane; g.fill();
    const face = () => { g.beginPath(); g.moveTo(-3, -11.4); g.quadraticCurveTo(0, -12.8, 3, -11.4); g.quadraticCurveTo(3.4, -6.4, 2.5, -1.4); g.quadraticCurveTo(2.3, 1.6, 0, 1.8); g.quadraticCurveTo(-2.3, 1.6, -2.5, -1.4); g.quadraticCurveTo(-3.4, -6.4, -3, -11.4); g.closePath(); };
    face(); g.fillStyle = mV(g, MC.coat, -11, 2, 0.28, -0.18); g.fill();
    g.save(); face(); g.clip(); g.fillStyle = mV(g, MC.muzzle, -2, 2, 0.15, -0.25); mEll(g, 0, 0.4, 2.8, 2.4); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; mEll(g, 0, -6.4, 0.7, 2.4); g.fill(); g.restore();
    face(); mLine(g, 0.7);
    for (const s of [-1, 1]) {
      g.fillStyle = '#2a2a30'; mEll(g, s * 1, 0.4, 0.45, 0.6, s * 0.3); g.fill();
      g.fillStyle = '#17161a'; mEll(g, s * 2.3, -6.6, 0.75, 0.85); g.fill(); g.fillStyle = '#ffffff'; mEll(g, s * 2.1, -6.9, 0.25, 0.25); g.fill();
      // ears up either side of her forelock
      g.beginPath(); g.moveTo(s * 1.6, -11.6); g.quadraticCurveTo(s * 3.2, -15.8, s * 3.7, -15.6); g.quadraticCurveTo(s * 4, -13, s * 3.1, -10.8); g.closePath(); g.fillStyle = MC.coat; g.fill(); mLine(g, 0.45);
      g.fillStyle = mShade(MC.dark, -0.2); g.beginPath(); g.moveTo(s * 2.1, -11.6); g.quadraticCurveTo(s * 3.1, -14.2, s * 3.4, -14); g.lineTo(s * 3, -11.4); g.closePath(); g.fill();
    }
    // forelock, the bridle's brow and nose bands, the bit rings
    g.beginPath(); g.moveTo(-1.6, -12.2); g.quadraticCurveTo(0, -13.4, 1.6, -12.2); g.quadraticCurveTo(0.9, -9.2, 0, -8.6); g.quadraticCurveTo(-0.9, -9.2, -1.6, -12.2); g.closePath(); g.fillStyle = MC.mane; g.fill();
    g.strokeStyle = MC.bridle; g.lineWidth = 0.55; g.beginPath(); g.moveTo(-2.6, -9.2); g.quadraticCurveTo(0, -8.4, 2.6, -9.2); g.moveTo(-2.3, -2.4); g.quadraticCurveTo(0, -1.8, 2.3, -2.4); g.moveTo(-2.6, -9.2); g.lineTo(-2.3, -1); g.moveTo(2.6, -9.2); g.lineTo(2.3, -1); g.stroke();
    g.strokeStyle = MC.steel; g.lineWidth = 0.35; for (const s of [-1, 1]) { mEll(g, s * 2.3, -0.8, 0.55, 0.55); g.stroke(); }
    // the reins up to the saddle, where the knight's hands are
    if (rider) { g.strokeStyle = MC.bridle; g.lineWidth = 0.45; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2.4, -0.8); g.quadraticCurveTo(s * 3.6, -4, s * 2.2, -7.6); g.stroke(); } }
    g.restore();
  }
  // from behind: her neck and ears far off, then her back and the saddle, the knight, then her rump and tail nearest us
  function mareRear(g, e, rider) {
    const ph = strideOf(e), sw = p => e.moving ? Math.sin(ph + p) * 1.2 : 0, bob = e.moving ? -Math.abs(Math.sin(ph)) * 0.6 : Math.sin(time * 1.6 + (e.seed || 0)) * 0.15;
    for (const s of [-1, 1]) { g.save(); g.translate(0, -Math.max(0, sw(s > 0 ? 0 : Math.PI)) * 0.6); mLeg(g, s * 2.4, -0.6 + bob, 8.4, 2, 0, MC.coat, true, false); g.restore(); }
    g.save(); g.translate(0, bob);
    // neck and head, going away from us
    g.beginPath(); g.moveTo(-2.6, -6); g.quadraticCurveTo(-2.8, -11, -1.6, -13.4); g.lineTo(1.6, -13.4); g.quadraticCurveTo(2.8, -11, 2.6, -6); g.closePath(); g.fillStyle = mV(g, MC.coat, -14, -6, 0.15, -0.2); g.fill(); mLine(g, 0.6);
    g.beginPath(); g.moveTo(-1.4, -13.6); g.quadraticCurveTo(0, -14.4, 1.4, -13.6); g.lineTo(1, -6.4); g.lineTo(-1, -6.4); g.closePath(); g.fillStyle = MC.mane; g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.8, -13.4); g.quadraticCurveTo(s * 1.8, -17, s * 2.2, -16.8); g.quadraticCurveTo(s * 2.6, -14.6, s * 2, -12.8); g.closePath(); g.fillStyle = MC.coat; g.fill(); mLine(g, 0.45); }
    // her back and flanks, the saddle cloth and the saddle's cantle
    mEll(g, 0, -4.2, 6.4, 4.6); g.fillStyle = mR(g, MC.coat, 0, -5, 6.4); g.fill(); mLine(g, 0.7);
    for (const s of [-1, 1]) { mRR(g, s > 0 ? 4 : -6.4, -6.8, 2.4, 4.6, 0.8); g.fillStyle = mV(g, MC.cloth, -6.8, -2.2, 0.2, -0.25); g.fill(); mLine(g, 0.45); g.fillStyle = MC.trim; g.fillRect(s > 0 ? 4.2 : -6.2, -2.7, 2, 0.4); }
    g.beginPath(); g.moveTo(-3.8, -6.6); g.quadraticCurveTo(0, -9.6, 3.8, -6.6); g.lineTo(3.2, -5.4); g.quadraticCurveTo(0, -7.2, -3.2, -5.4); g.closePath(); g.fillStyle = mV(g, MC.leather, -9, -5.4); g.fill(); mLine(g, 0.45);
    g.strokeStyle = MC.steel; g.lineWidth = 0.45; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6.4, -3.6); g.lineTo(s * 6.6, -0.8); g.stroke(); }
    g.restore();
    if (rider) rider(0, -7 + bob);
    // the hind legs nearest us, and her rump: two round quarters with the tail between them
    for (const s of [-1, 1]) { g.save(); g.translate(0, -Math.max(0, sw(s > 0 ? Math.PI : 0)) * 0.9); mLeg(g, s * 3.4, 0.4 + bob, 9.2, 2.6, 0, MC.coat, false, true); g.restore(); }
    g.save(); g.translate(0, bob);
    for (const s of [-1, 1]) { mEll(g, s * 2.5, -1.4, 3.7, 4.3, -s * 0.12); g.fillStyle = mR(g, MC.coat, s * 2.5, -2.2, 4.2); g.fill(); mLine(g, 0.7); }
    g.fillStyle = MC.dapple; for (const [x, y, r] of [[-3.6, -3.4, 0.8], [3.2, -2.4, 0.7], [-2.2, -0.4, 0.6], [4.4, -4.2, 0.6]]) { mEll(g, x, y, r, r * 0.8); g.fill(); }
    const sx = e.moving ? Math.sin(ph) * 0.8 : Math.sin(time * 1.7 + (e.seed || 0)) * 0.6;
    g.beginPath(); g.moveTo(-1.2, -5.4); g.quadraticCurveTo(-2.2 + sx, 0, -1.4 + sx * 1.4, 6); g.quadraticCurveTo(sx * 1.4, 7.6, 1.4 + sx * 1.4, 6); g.quadraticCurveTo(2.2 + sx, 0, 1.2, -5.4); g.closePath();
    g.fillStyle = mV(g, MC.mane, -6, 7, 0.2, -0.2); g.fill(); mLine(g, 0.55);
    g.restore();
  }
  // the knight's scale and where his middle sits over the saddle (in game pixels: his seat on the saddle's dip)
  const RIDER_S = 0.88, RIDER_UP = 9.4;
  // drawHorse(g, e, hurt, rider): Cinder at the origin of g (her middle; her hooves 21.5 px below it), facing e.facing.
  // rider = the look in the saddle (playerLook(), or a friend's look online), or null for her standing alone (head down
  // in the grass on the side view). hurt = the whole picture flashes red (the knight with her), the way the monsters and
  // the knight flash: drawn on a picture of its own and coloured over, when there is a canvas for it.
  function drawHorse(g, e, hurt, rider) {
    if (hurt && g === ctx && mareTint(g, e, rider)) return;
    paintMare(g, e, rider);
  }
  function paintMare(g, e, rider) {
    const fx = e.facing ? +e.facing.x || 0 : 1, fy = e.facing ? +e.facing.y || 0 : 0;
    const view = fy > 0.55 && Math.abs(fy) >= Math.abs(fx) ? 'front' : fy < -0.55 && Math.abs(fy) >= Math.abs(fx) ? 'rear' : 'side';
    const left = view === 'side' && fx < 0;
    // the knight, sat in the saddle at (sx, sy) in her units; his own facing, never hurt-tinted twice
    const seat = rider ? (sx, sy) => {
      g.save(); g.scale(1 / MARE_K, 1 / MARE_K); g.translate(sx * MARE_K, sy * MARE_K - RIDER_UP); g.scale(RIDER_S, RIDER_S);
      if (left) g.scale(-1, 1);
      drawHuman(g, { facing: { x: view === 'side' ? (left ? -1 : 1) : 0, y: view === 'front' ? 1 : view === 'rear' ? -1 : 0 }, hurtT: 0, attackT: 0, moving: false, walkT: 0, seated: true }, rider);
      g.restore();
    } : null;
    g.save();
    // her shadow on the ground under her hooves
    g.fillStyle = 'rgba(0,0,0,0.26)'; g.beginPath(); g.ellipse(0, 20.5, view === 'side' ? 29 : 15, view === 'side' ? 6.5 : 6, 0, 0, M_TAU); g.fill();
    g.scale(MARE_K, MARE_K);
    if (left) g.scale(-1, 1);
    if (view === 'front') mareFront(g, e, seat);
    else if (view === 'rear') mareRear(g, e, seat);
    else mareSide(g, e, seat);
    g.restore();
  }
  // the red flash: the mare and her rider drawn on a picture, coloured over, and put down
  let mScratch = null;
  function mareTint(g, e, rider) {
    if (typeof document === 'undefined' || !document.createElement) return false;
    const ss = Math.max(1, Math.min(2, typeof DPR === 'number' && DPR > 0 ? DPR : 1)), x0 = -48, y0 = -64, w = 96, h = 92, W = Math.ceil(w * ss), Hh = Math.ceil(h * ss);
    if (!mScratch || mScratch.c.width < W || mScratch.c.height < Hh) { const c = document.createElement('canvas'); c.width = W; c.height = Hh; const cg = c.getContext && c.getContext('2d'); if (!cg) return false; mScratch = { c, cg }; }
    const cg = mScratch.cg;
    cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, mScratch.c.width, mScratch.c.height);
    cg.setTransform(ss, 0, 0, ss, -x0 * ss, -y0 * ss); paintMare(cg, e, rider);
    cg.save(); cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = 'rgba(255,90,90,0.45)'; cg.fillRect(0, 0, W, Hh); cg.restore();
    g.drawImage(mScratch.c, 0, 0, W, Hh, x0, y0, w, h);
    return true;
  }
  const parkedMare = (x, y, fx) => ({ x, y, r: HORSE_R, facing: { x: fx === undefined ? 1 : fx, y: 0 }, hurtT: 0, attackT: 0, moving: false, walkT: 0, seed: (x * 0.013 + y * 0.007) % 6.28 });
  function drawHorseTile(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.save(); g.translate(cx, cy + 2);
    drawHorse(g, parkedMare(cx, cy), false, null);
    g.restore();
  }
  function drawHitchTile(g, tx, ty) {
    const cx = tc(tx), cy = tc(ty);
    g.save(); g.translate(cx, cy);
    g.fillStyle = 'rgba(0,0,0,0.24)'; g.beginPath(); g.ellipse(0, 16, 22, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#6b4f2a'; g.fillRect(-17, -18, 6, 34); g.fillRect(11, -18, 6, 34);   // two posts
    g.fillStyle = '#8a6a3a'; g.fillRect(-19, -14, 38, 6);                                // the rail
    g.fillStyle = '#5a4020'; g.fillRect(-19, -9, 38, 2);
    g.fillStyle = '#c9b07a';                                                             // a bale of hay under it
    g.beginPath(); g.moveTo(-14, 16); g.lineTo(2, 16); g.lineTo(-1, 6); g.lineTo(-11, 6); g.closePath(); g.fill();
    g.strokeStyle = '#9c854f'; g.lineWidth = 1; g.beginPath(); g.moveTo(-12, 11); g.lineTo(0, 11); g.stroke();
    if (!H().owned && POST && tx === POST.x && ty === POST.y) { // she is Fennick's until somebody buys her: standing at his rail (not a new place's), nose to the rope
      g.save(); g.translate(20, 13); g.scale(0.72, 0.72);
      drawHorse(g, Object.assign(parkedMare(cx, cy, -1), { headUp: true }), false, null);
      g.restore();
      g.strokeStyle = 'rgba(210,190,150,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(4, -11); g.quadraticCurveTo(3.4, -5, 1.2, -0.6); g.stroke();  // the rope to her bit
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
    riding, tryRide, mount, dismount, whistle, buyHorse, drawHorse,
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
    const o = findLane() || h.openSpot(...ATLAS.frame('signpost').p(62, 24));
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
        !!post && mares === 0 && H().owned === false && INTERESTING_TILES.has(T_HORSE) && INTERESTING_TILES.has(T_HITCH) && HOOKS.keyHelp.some(k => k.codes.includes('KeyG')),
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
    { const up = ride();
      // a tall phone with the stick on the right puts the context seat (GET DOWN) at the bottom-left, under the Skills list:
      // exactly where a ghost button could eat the click (src/59-hudkit.js layout)
      const own = kk => Object.getOwnPropertyDescriptor(window, kk), sz0 = { w: own('innerWidth'), h: own('innerHeight') }, t0 = window.__forceTouch, sr0 = window.__stickRight;
      window.innerWidth = 390; window.innerHeight = 844; window.__forceTouch = true; window.__stickRight = true; render();
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
      if (sz0.w) { Object.defineProperty(window, 'innerWidth', sz0.w); Object.defineProperty(window, 'innerHeight', sz0.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } }
      window.__forceTouch = t0; window.__stickRight = sr0; render();
      F.press('KeyX'); F.sim(2, []); // leave the lane the way the checks below expect it: on foot, mare parked
      check(P + 'no ghost RIDE / GET DOWN button under an open panel — a click on Skills stays on Skills and never throws you off',
        up && !!btn && overlaps && gone && stillUp && stillOpen && back && !riding(),
        { up, why: rideWhy, btn: btn && [btn.x, btn.y, btn.w, btn.h], panel: pr, click: [cx, cy], overlaps, gone, stillUp, stillOpen, back }); }

    // 6. the R key rides and gets down
    { clearLane(); F.tp(o.x, o.y); F.step([]); liftHorse(); const parked = parkAt(o.x + 1, o.y);
      F.press('KeyG'); F.sim(2, []); const up = riding();
      F.press('KeyG'); F.sim(2, []); const down = !riding() && !!horseAt();
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
      const inMech = refusal(() => { F.press('KeyG'); F.sim(1, []); });
      const inMechOk = !riding() && !!player.mech && !!inMech && /walker/i.test(inMech);
      player.mech = null; player.r = BASE_R; player.speed = BASE_SPEED; F.sim(1, []);
      // on water, in hover armour (the only way a knight stands on it at all)
      const px0 = player.x, py0 = player.y;
      const wt = F.nearestTile([T.WATER]);
      let onWater = null, onWaterOk = false;
      if (wt) { player.equip.body = 'hover_armour'; F.sim(2, []);
        F.tp(wt.x, wt.y); F.sim(1, []);
        onWater = refusal(() => { F.press('KeyG'); F.sim(1, []); });
        onWaterOk = !riding() && !!onWater && /water|hover/i.test(onWater);
        player.equip.body = null; F.sim(2, []); player.x = px0; player.y = py0; player.speed = BASE_SPEED; F.sim(1, []); }
      // down a dungeon
      let inDen = null, inDenOk = false, entered = false;
      if (window.INSTANCES && INSTANCES.get) {
        for (const id of ['spider_den', 'aerie']) { if (entered || !INSTANCES.get(id)) continue; entered = INSTANCES.enter(id); F.sim(2, []); }
        if (entered) { inDen = refusal(() => { F.press('KeyG'); F.sim(1, []); }); inDenOk = !riding() && !!inDen && /outside|open/i.test(inDen); INSTANCES.leave(); F.sim(2, []); }
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
        up && stoppedAtWater && stoppedAtDoor && who === 'rider', { up, why: rideWhy, stoppedAtWater, stoppedAtDoor, who }); }

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

    // 15. she is no machine: on her, V and a held Space start no machine special (55-riding), and nothing stands on her back
    { const up = ride(); let r = { up };
      if (up && window.RIDING) {
        RIDING.resetCool(); notice = null;
        F.press('KeyV'); F.sim(3, []);
        const afterV = RIDING.special;
        F.sim(50, ['Space']); F.sim(3, []);
        const afterHold = RIDING.special;
        const items = []; for (const hk of HOOKS.draw) { try { hk(ctx, items, cam); } catch (err) { } }
        const atBack = items.filter(it => it.y === player.y + player.r + 2).length;
        r = { up, afterV: !!afterV, afterHold: !!afterHold, kind: RIDING.machineKind(), atBack, notice: notice && notice.text };
        RIDING.resetCool();
      }
      check(P + 'on the mare, V and holding Space start no machine special, and no beacon is drawn on her back', !!r.up && r.afterV === false && r.afterHold === false && r.kind === null && r.atBack === 0, r);
      F.press('KeyX'); F.sim(2, []); }

    // 16. she draws in the new look at all four facings, ridden, standing alone and hurt (the knight in her saddle once
    // each time, seated: his own drawing), on a canvas that writes nothing down (the headless one) without throwing
    { let calls = 0, drew = true; const look = playerLook(), dh = drawHuman;
      try {
        drawHuman = function (g, e, lk) { if (lk === look && e.seated) calls++; return dh.apply(this, arguments); };
        for (const f of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const mv of [false, true]) {
          drawHorse(ctx, { facing: { x: f[0], y: f[1] }, moving: mv, walkT: 2.2, hurtT: 0 }, false, look);
          drawHorse(ctx, { facing: { x: f[0], y: f[1] }, moving: mv, walkT: 2.2, hurtT: 0.2 }, true, look);
          drawHorse(ctx, { facing: { x: f[0], y: f[1] }, moving: mv, walkT: 2.2, hurtT: 0 }, false, null);
        }
      } catch (err) { drew = String(err && err.message); } finally { drawHuman = dh; }
      check(P + 'the mare draws in the new look at all four facings, walking and standing, ridden (the knight sat in her saddle), alone and hurt', drew === true && calls === 16, { drew, calls }); }

    // put the world back the way the rest of the suite expects it
    if (riding()) dismount(true);
    liftHorse();
    player.horse = { owned: false, hp: HORSE_HP, at: null, under: null };
    player.equip.body = body0; player.r = BASE_R; player.speed = BASE_SPEED; player.attackT = 0; player.attackCd = 0;
    if (typeof tapCancel === 'function') tapCancel('manual');
    closePanel(); h.peace(false);
    window.__forceTouch = wasTouch; dialog.cur = dc; dialog.queue.push(...dq);
  });

  // ---------- the rails: she bolts to the nearest rail the knight has visited (Stage 4b) ----------
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'mounts: ', h0 = player.horse, dc = dialog.cur, dq = dialog.queue.slice();
    h.peace(true); closePanel(); dialog.cur = null; dialog.queue.length = 0;
    player.horse = { owned: true, hp: HORSE_HP, at: null, under: null };
    // a second rail, as a new place's file adds one (RAILS.add), on open ground by the story signpost, far from Thistledown
    const near = h.openSpot(...ATLAS.port('signpost.sign').map(Math.round), (x, y) => !SOLID.has(tileAt(x + 1, y)) && !SOLID.has(tileAt(x, y + 1)));
    const post = { x: near.x, y: near.y };
    const added = RAILS.add({ id: 'selftest', place: 'the test rail by the signpost', at: () => post });
    const voice = () => { const d = [dialog.cur, ...dialog.queue].find(q => q && q.who === 'The Voice'); return d ? d.text : ''; };
    // thrown off beside it before he has stood there: she runs for Fennick's (the only rail he has visited)
    const throwNear = () => { if (riding()) dismount(true); liftHorse(); dialog.cur = null; dialog.queue.length = 0; F.tp(post.x, post.y + 2); player.mech = null; mount(); bolt(); const at = horseAt(); return { at: at && [at.tx, at.ty], said: voice() }; };
    const first = throwNear();
    const fen = RAILS[0].at(), toFennick = !!first.at && !!fen && Math.max(Math.abs(first.at[0] - fen.x), Math.abs(first.at[1] - fen.y)) <= 4 && /Fennick's rail in Thistledown/.test(first.said);
    // he walks up to the new rail (within six tiles of its post): now it is the nearest he knows, and the Voice names it
    F.tp(post.x, post.y + 2); F.step([]); const seen = RAILS.visited('selftest');
    const second = throwNear(), toNew = !!second.at && Math.max(Math.abs(second.at[0] - post.x), Math.abs(second.at[1] - post.y)) <= 4 && /the test rail by the signpost/.test(second.said);
    // the registry: Fennick's first, the two reserved plots' rails held (no post yet), the visited list saved on the horse
    const reg = RAILS[0].id === 'thistledown' && ['alchemy', 'necromancy'].every(id => { const r = RAILS.find(q => q.id === id); return r && r.reserved && r.at() === null; }) && Array.isArray(player.horse.rails) && player.horse.rails.includes('selftest');
    if (riding()) dismount(true); liftHorse(); RAILS.remove('selftest'); player.horse = h0 || { owned: false, hp: HORSE_HP, at: null, under: null };
    dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq); h.peace(false);
    check(P + "thrown off, she bolts to the NEAREST rail he has visited and the Voice names it: Fennick's while the new rail is unvisited, the new one once he has stood by it (RAILS: Fennick's first, the Glasshouse's and the Old Barrow's reserved)",
      !!added && toFennick && seen && toNew && reg, { first, second, seen, reg, post: [post.x, post.y], fennick: fen && [fen.x, fen.y] });
  });
}
