// ============================================================================
// THE BULLDOZER BAY — a tunnel on Smithy Lane, and Sprocket's workshop under it
// The owner (BACKLOG, "Bulldozer bay as a facility"): "Tunnel you drive the dozer into, knight walks out, machine parked
// inside a real workshop with the upgrade stations around it."
//
// Out in Thistledown the bay is the same cell it always was (40-dozerup's DOZER_BAY tile on the port
// thistledown.dozer_bay, in the smithy yard over Smithy Lane): no overworld tile changes, so no WORLD_REV and no footprint.
// Only its picture changes: a stone arch over a ramp that goes down under the yard, a board that says BULLDOZER BAY and
// four little lamps on the lintel, one lit for each stall that holds a machine.
//
// Drive any knight-driven machine into the mouth (the walker, the bulldozer, the Barrelbeast; never the mare) and the screen
// goes inside: the machine rolls into the first empty stall of four and the knight climbs down beside it. E (or the DRIVE
// IN seat) at the mouth does the same. Online, a friend riding along is set down outside by his own game the moment the
// driver's map changes (84-ridetogether: "went inside"); only the driver goes down with the machine.
// Inside (an instance, 16-instances): four stalls along the back wall, the parts bench (the old Bulldozer bay panel of
// 40-dozerup, the four upgrades, unchanged), the blueprint board, the repair bench (a hull mended for goblin scrap) and
// Sprocket, a goblin grease-monkey with a short story. E on a stored machine climbs in and drives it back up the tunnel
// onto the street beside the mouth. On foot, E at the mouth opens the bay's door: Go inside, or Take it out for any stall.
//
// The stalls are the knight's own: player.bay = { stalls: [4 x null | { kind, hp }], met, talks }, saved with him, so
// they survive a reload, a log-out and the shared world; nobody else's page ever draws them (every page draws its own
// knight's stalls). An instance is never saved: a save taken inside records the knight on the street outside.
// Built from existing tiles only (the map's tile ids are bytes and only seven were left): the floor is FLOOR under a
// drawn concrete slab, the walls are CWALL, and every solid fixture stands on 95-thistledown's TD_PROP tile with a side
// table of its own (84-crossroads' way), so no tile id anywhere moves.
// Loads after 95-thistledown (TD_PROP must exist when the instance is built). window.DOZERBAY is the handle.
// ============================================================================
{
  const BAY_ID = 'dozer_bay';
  const STALLS = 4;
  const KINDS = ['walker', 'dozer', 'beast'];
  const WHAT = { walker: 'walker', dozer: 'bulldozer', beast: 'Barrelbeast' };
  const SCRAP_PER = 20;            // a hull is mended for one goblin scrap per 20 points it is missing (rounded up)
  const KNIGHT = { r: 13, speed: 175 };

  // ---------- the hall: one character a cell, in the instance's own map ----------
  // W wall   . floor   P a stall post   S a stall's stand (the machine stands on it)   U the parts bench (3 cells)
  // R the repair bench (3 cells)   B the blueprint board   T the ramp up to the street (3 cells)   o oil drums   c the tool
  // chest   y a stack of wheels   x scrap on the floor (walkable)   M where Sprocket stands   e where a knight on foot arrives
  // The hall sits low in the instance on purpose: the core paints its starting-cave darkness over the top-left corner
  // whenever the camera is near it (09-render), and this is a lit workshop.
  const HALL = { x: 2, y: 36, w: 23, h: 11 };
  const INST = { w: HALL.x + HALL.w + 2, h: HALL.y + HALL.h + 2 };
  const ROWS = [
    'WWWWWWWWWWWWWWWWWWWWWWW',
    'WP....P....P....P....PW',
    'WP.SS.P.SS.P.SS.P.SS.PW',
    'WP.SS.P.SS.P.SS.P.SS.PW',
    'W.....................W',
    'W.....................W',
    'WB..UUU.........RRR..cW',
    'W............M........W',
    'W....x............x...W',
    'Wo.........e........yoW',
    'WWWWWWWWWWTTTWWWWWWWWWW',
  ];
  if (ROWS.length !== HALL.h || ROWS.some(r => r.length !== HALL.w)) throw new Error('dozerbay: the hall is ' + HALL.w + ' x ' + HALL.h);
  // the stalls: stall k is the 4 cells between posts k and k + 1; its stand is the 2 x 2 in the middle
  const STALL_COL = k => HALL.x + 2 + 5 * k;              // the stall's first floor column
  const KIND_OF = { P: 'post', S: 'stall', U: 'parts', R: 'repair', B: 'board', T: 'ramp', o: 'drums', c: 'chest', y: 'wheels' };
  const NAME_OF = { post: 'Stall post', stall: 'Stall', parts: 'Parts bench', repair: 'Repair bench', board: 'Blueprint board', ramp: 'The way out', drums: 'Oil drums', chest: 'Tool chest', wheels: 'Spare wheels' };
  const CELLS = new Map(), SCRAP = [], ITEMS_AT = {};
  let ENTRY = null, MECHANIC = null;
  ROWS.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = row[i], x = HALL.x + i, y = HALL.y + j, kind = KIND_OF[c];
      if (kind) {
        const rec = { kind, x, y };
        if (kind === 'stall') rec.k = Math.floor((i - 2) / 5);
        // a thing two or three cells big is one record (drawn once, from its first cell)
        const same = kind === 'parts' || kind === 'repair' || kind === 'ramp' ? (ITEMS_AT[kind] || (ITEMS_AT[kind] = Object.assign(rec, { cells: [] }))) : rec;
        if (same.cells) same.cells.push([x, y]);
        CELLS.set(x + ',' + y, same);
      }
      if (c === 'x') SCRAP.push([x, y]);
      if (c === 'e') ENTRY = [x, y];
      if (c === 'M') MECHANIC = { x, y };
    }
  });
  const cellAt = (tx, ty) => CELLS.get(tx + ',' + ty) || null;
  const isWall = (tx, ty) => tx >= HALL.x && ty >= HALL.y && tx < HALL.x + HALL.w && ty < HALL.y + HALL.h && ROWS[ty - HALL.y][tx - HALL.x] === 'W';
  // where a stored machine stands (its middle, in pixels), and where its knight climbs down beside it
  const standPx = k => ({ x: (STALL_COL(k) + 2) * TILE, y: (HALL.y + 3) * TILE });
  const besidePx = k => ({ x: tc(STALL_COL(k)), y: tc(HALL.y + 3) });

  function buildBay(set) {
    for (let j = 0; j < HALL.h; j++) for (let i = 0; i < HALL.w; i++) {
      const c = ROWS[j][i], x = HALL.x + i, y = HALL.y + j;
      set(x, y, c === 'W' ? T.CWALL : KIND_OF[c] ? T.TD_PROP : T.FLOOR);
    }
  }
  const inst = INSTANCES.define(BAY_ID, {
    name: 'The Bulldozer Bay', sub: "Sprocket's workshop under Smithy Lane", w: INST.w, h: INST.h,
    build: buildBay, spawns: [], exit: null, entry: ENTRY,
  });
  inst.tiles[ENTRY[1] * inst.w + ENTRY[0]] = T.FLOOR;   // define() lays a cave tile on the entry; this is the workshop floor
  inst.plaque = false;                                    // its own plaque below (16's would say "0 left")
  const inBay = () => !!(window.INSTANCES && INSTANCES.active() === BAY_ID);

  // ---------- the knight's stalls (saved on him) ----------
  const fresh = () => ({ stalls: new Array(STALLS).fill(null), met: false, talks: 0 });
  function S() {
    let b = player.bay;
    if (!b || typeof b !== 'object' || !Array.isArray(b.stalls)) b = player.bay = fresh();
    if (b.stalls.length !== STALLS) b.stalls = Array.from({ length: STALLS }, (_, i) => b.stalls[i] || null);
    for (let i = 0; i < STALLS; i++) { const s = b.stalls[i]; if (s && (!KINDS.includes(s.kind) || !(s.hp > 0))) b.stalls[i] = null; }
    return b;
  }
  HOOKS.newGame.push(() => { player.bay = fresh(); });
  const stalls = () => S().stalls;
  const freeStall = () => stalls().findIndex(s => !s);
  const full = () => stalls().filter(Boolean).length;

  // ---------- the machines: what climbing in gives (06-systems' walker, 22-bulldozer, 32-beast; the self-test holds it) ----------
  const ups = () => player.dozerUp || {};
  const MACH = {
    walker: { r: 20, hp: () => 130, speed: () => 115 },
    dozer: { r: 22, hp: () => (ups().boiler ? DOZER_BOILER_HP : DOZER_HP), speed: () => (ups().boiler ? DOZER_BOILER_SPEED : DOZER_SPEED) },
    beast: { r: 26, hp: () => 300, speed: () => 100 },
  };
  const maxHpOf = kind => MACH[kind].hp();
  const hullOf = s => Math.min(Math.max(1, Math.round(s.hp)), maxHpOf(s.kind));
  const scrapFor = s => Math.ceil(Math.max(0, maxHpOf(s.kind) - hullOf(s)) / SCRAP_PER);
  const machineKind = () => (player.mech && player.mech.kind !== 'horse' ? (KINDS.includes(player.mech.kind) ? player.mech.kind : 'walker') : null);
  const riding = () => !!(window.RIDE && RIDE.state && RIDE.state.ride);

  // ---------- the mouth, out in Thistledown ----------
  const bayCell = () => (window.DOZERUP && DOZERUP.bay) || null;
  const atMouth = () => { const b = bayCell(); return !!b && tileAt(b.x, b.y) === DOZERUP.tile; };
  const street = () => { const b = bayCell(); return [b.x, b.y + 1]; };
  // the machine's nose is on the mouth: a probe ahead of it (two distances, three across the blade) lands on the bay's cell
  function noseOnMouth() {
    const b = bayCell(); if (!b || !atMouth()) return false;
    const f = player.facing || { x: 0, y: -1 }, d = Math.hypot(f.x, f.y) || 1, fx = f.x / d, fy = f.y / d;
    for (const ahead of [player.r + 6, player.r + 20]) for (const side of [-12, 0, 12]) {
      const tx = Math.floor((player.x + fx * ahead - fy * side) / TILE), ty = Math.floor((player.y + fy * ahead + fx * side) / TILE);
      if (tx === b.x && ty === b.y) return true;
    }
    return false;
  }
  // near enough to drive in with E: touching the mouth's cell, or close and looking at it
  function nearMouth() {
    const b = bayCell(); if (!b || !atMouth() || inBay()) return false;
    if (noseOnMouth()) return true;
    const vx = tc(b.x) - player.x, vy = tc(b.y) - player.y, dd = Math.hypot(vx, vy) || 1, f = player.facing || { x: 0, y: -1 }, fl = Math.hypot(f.x, f.y) || 1;
    return dd <= player.r + TILE * 1.25 && (vx * f.x + vy * f.y) / (dd * fl) >= 0.25;
  }

  let hintT = -1e9;
  const hint = text => { if (time - hintT < 3) return; hintT = time; notify(text); };
  const whoRides = () => { try { return window.RIDE && window.NET && NET.me ? RIDE.ridersOf(NET.me).filter(r => !r.me).map(r => r.n) : []; } catch (e) { return []; } };

  // ---------- in: the machine rolls into a stall and the knight climbs down beside it ----------
  function driveIn() {
    const kind = machineKind();
    if (!kind || player.dead || riding() || !window.INSTANCES || INSTANCES.active() || !atMouth()) return false;
    const k = freeStall();
    if (k < 0) { hint('All four stalls are full. Take a machine out before you bring another one in.'); return false; }
    const m = player.mech, keep = { r: player.r, speed: player.speed, x: player.x, y: player.y }, riders = whoRides();
    stalls()[k] = { kind, hp: Math.max(1, Math.round(m.hp)) };
    player.mech = null; player.r = KNIGHT.r; player.speed = KNIGHT.speed; player.action = null; player.attackT = 0;
    if (!INSTANCES.enter(BAY_ID, street())) {
      stalls()[k] = null; player.mech = m; player.r = keep.r; player.speed = keep.speed; player.x = keep.x; player.y = keep.y;
      notify('The tunnel will not take it right now.'); return false;
    }
    const p = besidePx(k); player.x = p.x; player.y = p.y; player.facing = { x: 1, y: 0 };
    burst(standPx(k).x, standPx(k).y + 20, '#8f96a3', 18, 90); sfx('open');
    const off = riders.length ? ` ${riders.join(' and ')} ${riders.length > 1 ? 'hop' : 'hops'} down outside.` : '';
    notify(`Your ${WHAT[kind]} rolls down the tunnel into stall ${k + 1}. You climb down beside it.${off}`);
    greet();
    save();
    return true;
  }
  // on foot through the door
  function walkIn() {
    if (!window.INSTANCES || player.mech || player.dead || riding() || INSTANCES.active() || !atMouth()) return false;
    if (!INSTANCES.enter(BAY_ID, street())) { notify('You cannot go down there right now.'); return false; }
    player.facing = { x: 0, y: -1 };
    greet();
    return true;
  }
  // the first time down, Sprocket calls out (once a knight; his story is told when he is talked to)
  function greet() { const b = S(); if (!b.met && !b.called) { b.called = true; say("Oi! A knight! Mind the oil. Come and say hello, I'm over by the posts.", 'Sprocket'); } }

  // ---------- out: climb into a stored machine and drive it up onto the street ----------
  function takeOut(k) {
    const s = stalls()[k];
    if (!s) { notify(`Stall ${k + 1} is empty.`); return false; }
    if (riding() || player.dead) return false;
    if (player.mech) { notify(`Climb out of this ${WHAT[machineKind()] || 'mare'} first (X).`); return false; }
    if (INSTANCES.active() && !inBay()) return false;
    if (inBay()) INSTANCES.leave();
    const M = MACH[s.kind], [sx, sy] = street(), spot = safeSpot(tc(sx), tc(sy), M.r, 'rider');
    if (!spot) { notify('Something is in the way on the street by the tunnel. Clear it and try again.'); return false; }
    const hp = hullOf(s), maxHp = maxHpOf(s.kind);
    stalls()[k] = null;
    player.mech = s.kind === 'walker' ? { hp, maxHp } : { hp, maxHp, kind: s.kind };
    player.r = M.r; player.speed = M.speed(); player.x = spot.x; player.y = spot.y; player.facing = { x: 0, y: 1 }; player.action = null; player.attackT = 0;
    burst(player.x, player.y - 10, '#ffb347', 20, 110); sfx('open');
    notify(`Your ${WHAT[s.kind]} rolls up the tunnel onto the street. Hull ${hp} of ${maxHp}.`);
    save();
    return true;
  }

  // ---------- the repair bench ----------
  function mend(k) {
    const s = stalls()[k]; if (!s) return false;
    const n = scrapFor(s), max = maxHpOf(s.kind);
    if (!n) { notify(`Your ${WHAT[s.kind]} is already whole: hull ${max} of ${max}.`); return false; }
    if (countItem('goblin_scrap') < n) { notify(`Mending the ${WHAT[s.kind]} takes ${n} goblin scrap. You have ${countItem('goblin_scrap')}.`); return false; }
    removeItem('goblin_scrap', n); s.hp = max;
    const p = standPx(k); burst(p.x, p.y, '#ffb347', 16, 90); sfx('levelup');
    notify(`Sprocket mends your ${WHAT[s.kind]}: hull ${max} of ${max}, for ${n} goblin scrap.`);
    save();
    return true;
  }

  // ---------- Sprocket ----------
  const SP = { id: 'sprocket', name: 'Sprocket', px: tc(MECHANIC.x), py: tc(MECHANIC.y), facing: { x: 0, y: 1 } };
  const STORY = [
    "I'm Sprocket. I mend machines. Mind the oil, it gets everywhere.",
    'I used to grease the walkers in the goblin camp. They yelled at me all day and never once said thank you.',
    'So one night I ran off with my spanner and a pocket full of bolts, and I found this old tunnel under the smithy yard.',
    'Brakka lets me stay if I keep the banging down. Knights say thank you, so now I fix knights\' machines.',
    'Drive one down the tunnel and it gets its own stall. Four stalls, one machine in each. Press E on it to drive it back out.',
  ];
  const TIPS = [
    'The parts bench fits the four upgrades: the drill, the iron drill, the ram plate and the big boiler. Blueprint, parts and enough Crafting.',
    `The repair bench mends a hull. One goblin scrap for every ${SCRAP_PER} points it is missing.`,
    'The blueprint board shows which plans you have. The goblins who own the machines drop the rest.',
    'Friends riding with you hop off at the tunnel. Only the driver comes down with the machine.',
    'Your machines stay down here when you go home. Nobody else can drive them out.',
  ];
  function sprocketInFront() {
    if (!inBay() || player.dead || player.mech) return false;
    const dd = dist(player.x, player.y, SP.px, SP.py); if (dd > 80) return false;
    const dot = ((SP.px - player.x) * player.facing.x + (SP.py - player.y) * player.facing.y) / (dd || 1);
    return dot >= 0.2 || dd <= 30;
  }
  function talk() {
    { const dx = SP.px - player.x, dy = SP.py - player.y, d = Math.hypot(dx, dy) || 1; player.facing = { x: dx / d, y: dy / d }; }
    const b = S();
    if (!b.met) { b.met = true; for (const l of STORY) say(l, SP.name); save(); return; }
    const hurt = stalls().findIndex(s => s && scrapFor(s) > 0);
    if (hurt >= 0 && b.talks % 2 === 0) { const s = stalls()[hurt]; say(`Your ${WHAT[s.kind]} in stall ${hurt + 1} is at ${hullOf(s)} of ${maxHpOf(s.kind)}. The repair bench mends it for ${scrapFor(s)} goblin scrap.`, SP.name); }
    else say(TIPS[b.talks % TIPS.length], SP.name);
    b.talks++;
  }
  const spFacing = PEOPLE_UI.facing(() => (sprocketInFront() ? { px: SP.px, py: SP.py, name: SP.name } : null));
  if (typeof TAP_PEOPLE !== 'undefined') TAP_PEOPLE.push(() => (inBay() ? [{ x: SP.px, y: SP.py, r: 13, id: SP.id, name: SP.name, talk }] : []));

  // ---------- the board ----------
  function readBoard() {
    const U = window.DOZERUP; if (!U) return;
    const up = ups(), fitted = [], pack = [], bank = [], missing = [];
    for (const u of U.UPGRADES) {
      const n = u.name.toLowerCase();
      if (up[u.id]) fitted.push(n); else if (countItem(u.blueprint) > 0) pack.push(n); else if (player.bank.some(b => b && b.id === u.blueprint)) bank.push(n); else missing.push(n);
    }
    const part = (head, list) => (list.length ? `${head}: ${list.join(', ')}.` : '');
    say([part('Fitted', fitted), part('Plans in your pack', pack), part('Plans in the bank', bank), part('Still missing', missing)].filter(Boolean).join(' '), 'The blueprint board');
    say(missing.length ? 'Missing plans drop from the goblins who own the machines. Nix the scrapper in Grubmarket sells them too.' : 'Every plan is found. The parts bench fits them.', 'The blueprint board');
  }

  // ---------- E ----------
  function useCell(c) {
    if (c.kind === 'stall') { if (stalls()[c.k]) takeOut(c.k); else notify(`Stall ${c.k + 1} is empty. Drive a machine down the tunnel and it parks here.`); return; }
    if (c.kind === 'parts') { openPanel('dozerup'); return; }
    if (c.kind === 'repair') { openPanel('bayrepair'); return; }
    if (c.kind === 'board') { readBoard(); return; }
    if (c.kind === 'ramp') { INSTANCES.leave(); notify('You walk up the tunnel onto the street.'); return; }
    if (c.kind === 'post') { notify(`The post between the stalls. Stall numbers are painted on the floor.`); return; }
    if (c.kind === 'drums') { notify('Oil drums. Sprocket says do not kick them.'); return; }
    if (c.kind === 'chest') { notify('Sprocket\'s tool chest. Every spanner has its own drawer.'); return; }
    if (c.kind === 'wheels') { notify('Spare wheels off machines that are not coming back.'); return; }
  }
  // the fixture the knight faces (the core's front tile), else one he stands right beside
  function faced() {
    if (!inBay() || player.dead || player.mech) return null;
    const ft = frontTile(player); let c = tileAt(ft.tx, ft.ty) === T.TD_PROP ? cellAt(ft.tx, ft.ty) : null;
    return c;
  }
  HOOKS.use.push((t, tx, ty) => {
    if (!inBay()) return false;
    if (sprocketInFront()) { talk(); return true; }
    const c = t === T.TD_PROP ? cellAt(tx, ty) : null;
    if (c) { useCell(c); return true; }
    return false;
  });
  // in a machine at the mouth, E drives it in (the core's E in a machine only crushes planks)
  { const _use = useAction; useAction = function () { if (!riding() && machineKind() && !player.dead && nearMouth()) { driveIn(); return; } return _use.apply(this, arguments); }; }
  // a machine driven into the mouth goes in by itself
  HOOKS.update.push(() => {
    if (player.dead || riding() || !machineKind() || !player.moving || INSTANCES.active()) return;
    if (noseOnMouth()) driveIn();
  });

  // ---------- the door: E on foot at the mouth ----------
  function door() { if (inBay()) return true; closePanel(); openPanel('baydoor'); return true; }

  // ---------- the touch seats and the words over things ----------
  // what E does to the thing faced: [the seat's word, its emblem, what the world tag adds, the long name]
  const LOOK = ['LOOK', 'hand', '', 'Look'];
  const VERB = { stall: k => (stalls()[k] ? ['DRIVE', 'gear', 'it out', 'Drive out the ' + WHAT[stalls()[k].kind]] : ['LOOK', 'hand', '', 'Stall ' + (k + 1)]),
    parts: () => ['FIT', 'drill', 'upgrades', 'Fit upgrades'], repair: () => ['MEND', 'craft', 'a machine', 'Mend a machine'], board: () => ['READ', 'book', 'the plans', 'Read the board'],
    ramp: () => ['LEAVE', 'leave', '', 'Walk out'], post: () => LOOK, drums: () => LOOK, chest: () => LOOK, wheels: () => LOOK };
  const verbOf = () => { const c = faced(); return c ? VERB[c.kind](c.k) : null; };
  const facesMouth = () => { if (player.mech || player.dead || inBay() || !atMouth()) return false; const ft = frontTile(player), b = bayCell(); return ft.tx === b.x && ft.ty === b.y; };
  // the core frames the faced tile and writes its verb beside it (09-render reads HK.usePreview): these words, not "Use"
  // (the mouth is an INTERESTING tile, so the core frames it and a tap on the iPad walks to it and opens the door)
  if (typeof INTERESTING_TILES !== 'undefined') INTERESTING_TILES.add(T.DOZER_BAY);
  if (typeof HK !== 'undefined' && typeof HK.usePreview === 'function') {
    const _pv = HK.usePreview;
    HK.usePreview = function () {
      const v = !sprocketInFront() && verbOf();
      if (v) { const c = faced(); return { verb: v[0], emblem: v[1], what: v[2], at: { x: c.x * TILE, y: c.y * TILE, w: TILE, h: TILE } }; }
      if (facesMouth()) { const b = bayCell(); return { verb: 'ENTER', emblem: 'door', what: 'the bay', at: { x: b.x * TILE, y: b.y * TILE, w: TILE, h: TILE } }; }
      return _pv.apply(this, arguments);
    };
  }
  hudSeatFace('use', { id: 'bay-fixture', prio: 6, when: () => !!verbOf() && !sprocketInFront(), emblem: () => (verbOf() || [])[1] || 'hand', ribbon: () => (verbOf() || [])[0] || 'USE', key: 'E', name: () => (verbOf() || [])[3] || 'Use', action: () => touch.taps.push('use') });
  hudSeatFace('use', { id: 'bay-door', prio: 6, when: () => facesMouth(), emblem: 'door', ribbon: 'ENTER', key: 'E', name: 'The bulldozer bay', action: () => touch.taps.push('use') });
  hudSeatFace('use', { id: 'bay-drive', prio: 45, when: () => !!machineKind() && !riding() && !player.dead && nearMouth(), emblem: 'door', ribbon: 'DRIVE IN', key: 'E', name: 'Drive into the bulldozer bay', lit: true, action: () => { if (!driveIn()) hint(freeStall() < 0 ? 'All four stalls are full. Take a machine out before you bring another one in.' : 'Line the machine up with the tunnel first.'); } });
  if (typeof tapLabelFor === 'function') {
    const _lbl = tapLabelFor;
    tapLabelFor = function (p) {
      if (p && inBay() && p.t === T.TD_PROP) { const c = cellAt(p.tx, p.ty); if (c) return c.kind === 'stall' ? (stalls()[c.k] ? 'Your ' + WHAT[stalls()[c.k].kind] : 'Stall ' + (c.k + 1)) : NAME_OF[c.kind]; }
      if (p && !inBay() && bayCell() && p.tx === bayCell().x && p.ty === bayCell().y && p.t === DOZERUP.tile) return 'The bulldozer bay';
      return _lbl.apply(this, arguments);
    };
  }
  // where you are, and the coach at the mouth
  HOOKS.hud.push(g => {
    if (inBay() && !panel && !paused) HK.addPlaque(g, { id: 'dozerbay', emblem: 'gear', name: 'BULLDOZER BAY', sub: full() ? `${full()} of ${STALLS} stalls hold a machine` : 'Four empty stalls' });
    if (!inBay() && !paused && !panel && machineKind() && !riding() && nearMouth()) { const b = bayCell(); HK.teach('dozerbay-in', 'E', 'Drive into the bay', { sx: Math.round((b.x + 1) * TILE + 12 - cam.x), sy: Math.round(b.y * TILE - 8 - cam.y) }, { emblem: 'door' }); }
  });

  // ============================================================================
  // PANELS (PLACE_KIT: the bay's door and the repair bench)
  // ============================================================================
  let doorPage = 0, mendPage = 0;
  const stallLine = (k, s) => (s ? `${WHAT[s.kind].charAt(0).toUpperCase() + WHAT[s.kind].slice(1)}. Hull ${hullOf(s)} of ${maxHpOf(s.kind)}.` : 'Empty.');
  function cardsGeom(rowH, extraFoot) {
    const K = PLACE_KIT, R = K.R(), G = K.GAP(), w = Math.min(PANEL_KIT.room().aw, 520), inner = w - 36;
    const heights = new Array(STALLS).fill(rowH);
    const foot = R + 8 + extraFoot, room = PANEL_KIT.room().ah - 62 - 12 - foot;
    const pages = K.pages(heights, room, G);
    const pageH = Math.max(...pages.map(p => p.reduce((a, i) => a + heights[i], 0) + (p.length - 1) * G));
    return { K, R, G, w, inner, heights, pages, foot, h: 62 + pageH + 8 + foot + 4 };
  }
  HOOKS.panel.baydoor = (g) => {
    const K = PLACE_KIT, R = K.R(), Q = cardsGeom(R + 16, 0), G = Q.G;
    doorPage = clamp(doorPage, 0, Q.pages.length - 1);
    const { px, py, h } = panelBox(g, Q.w, Q.h, 'Bulldozer bay', `${full()} of ${STALLS} stalls full. Sprocket's workshop is down the tunnel.`);
    const x0 = px + 18; let y = py + 62;
    for (let k = 0; k < STALLS; k++) {
      const s = stalls()[k], label = `Take out: stall ${k + 1}`;
      if (!Q.pages[doorPage].includes(k)) { if (s) K.offscreen(label, () => { closePanel(); takeOut(k); }); continue; }
      K.card(g, x0, y, Q.inner, Q.heights[k], s ? HK.T.gold : null);
      const bw = s ? K.plateW('Take it out') : 0, tw = Q.inner - 24 - (bw ? bw + 12 : 0);
      K.say(g, `Stall ${k + 1}`, x0 + 12, y + 20, tw, { font: K.NAME(13), color: s ? HK.T.goldHi : HK.T.inkDim, id: 'bay:stall' });
      K.say(g, stallLine(k, s), x0 + 12, y + 38, tw, { font: K.SENT(13), color: s ? HK.T.ink : HK.T.inkMute, id: 'bay:line' });
      if (s) K.plate(g, x0 + Q.inner - 12 - bw, y + Math.round((Q.heights[k] - R) / 2), bw, R, 'Take it out', label, () => { closePanel(); takeOut(k); }, 'primary', !player.mech, { name: `Drive the ${WHAT[s.kind]} out of stall ${k + 1}` });
      y += Q.heights[k] + G;
    }
    const fy = py + h - 12 - R, cw = K.plateW('Close'), gw = K.plateW('Go inside'), fw = K.plateW('Fit upgrades');
    let fx = x0;
    if (Q.pages.length > 1) { K.pager(g, x0, fy - R - G, Q.inner, doorPage, Q.pages.length, p => { doorPage = clamp(p, 0, Q.pages.length - 1); }); }
    K.plate(g, fx, fy, gw, R, 'Go inside', 'Go inside', () => { closePanel(); walkIn(); }, 'primary', !player.mech, { name: 'Walk down into the workshop' }); fx += gw + G;
    if (fx + fw + G + cw <= x0 + Q.inner) K.plate(g, fx, fy, fw, R, 'Fit upgrades', 'Fit upgrades', () => { closePanel(); openPanel('dozerup'); }, null, true, { name: 'The bulldozer upgrades' });
    else K.offscreen('Fit upgrades', () => { closePanel(); openPanel('dozerup'); });
    K.plate(g, x0 + Q.inner - cw, fy, cw, R, 'Close', 'Close', closePanel, null, true);
  };
  HOOKS.panel.bayrepair = (g) => {
    const K = PLACE_KIT, R = K.R(), S0 = K.POUCH(), rowH = 46 + S0 + 24, Q = cardsGeom(rowH, 0), G = Q.G;
    mendPage = clamp(mendPage, 0, Q.pages.length - 1);
    const { px, py, h } = panelBox(g, Q.w, Q.h, 'Repair bench', `One goblin scrap for every ${SCRAP_PER} points of hull missing. You have ${countItem('goblin_scrap')}.`);
    const x0 = px + 18; let y = py + 62;
    for (let k = 0; k < STALLS; k++) {
      const s = stalls()[k], n = s ? scrapFor(s) : 0, label = `Mend: stall ${k + 1}`, ok = !!s && n > 0 && countItem('goblin_scrap') >= n;
      if (!Q.pages[mendPage].includes(k)) { if (s && n) K.offscreen(label, () => mend(k), ok); continue; }
      K.card(g, x0, y, Q.inner, Q.heights[k], !s ? null : n === 0 ? HK.T.good : ok ? HK.T.gold : null);
      const bw = K.plateW('Mend'), tw = Q.inner - 24 - bw - 12;
      K.say(g, `Stall ${k + 1}`, x0 + 12, y + 20, tw, { font: K.NAME(13), color: s ? HK.T.goldHi : HK.T.inkDim, id: 'bay:stall' });
      K.say(g, s ? (n ? stallLine(k, s) : `${stallLine(k, s)} Whole.`) : 'Empty.', x0 + 12, y + 38, tw, { font: K.SENT(13), color: s ? HK.T.ink : HK.T.inkMute, id: 'bay:line' });
      if (s && n) {
        K.costRow(g, x0 + 12, y + 46, [['goblin_scrap', n]]);
        K.plate(g, x0 + Q.inner - 12 - bw, y + Math.round((Q.heights[k] - R) / 2), bw, R, 'Mend', label, () => mend(k), ok ? 'primary' : null, ok, { name: `Mend the ${WHAT[s.kind]} for ${n} goblin scrap` });
      }
      y += Q.heights[k] + G;
    }
    const fy = py + h - 12 - R, cw = K.plateW('Close');
    if (Q.pages.length > 1) K.pager(g, x0, fy, Q.inner - cw - 2 * G, mendPage, Q.pages.length, p => { mendPage = clamp(p, 0, Q.pages.length - 1); });
    K.plate(g, x0 + Q.inner - cw, fy, cw, R, 'Close', 'Close', closePanel, null, true);
  };
  // the panel audit (PLACE_KIT, run from 63-house): a full bay, a damaged machine, scrap for one
  const auditSetup = () => {
    const b0 = player.bay ? JSON.parse(JSON.stringify(player.bay)) : null, inv = player.inv.map(s => (s ? { ...s } : null)), m0 = player.mech;
    player.bay = fresh(); player.bay.stalls = [{ kind: 'dozer', hp: 74 }, { kind: 'walker', hp: 130 }, null, { kind: 'beast', hp: 120 }];
    player.inv = new Array(INV_SLOTS).fill(null); addItem('goblin_scrap', 3);
    return () => { player.bay = b0; player.inv = inv; player.mech = m0; doorPage = 0; mendPage = 0; };
  };
  PLACE_KIT.scene({ id: 'baydoor', panel: 'baydoor', name: 'Bulldozer bay door (three machines stored, first and last page)', setup: auditSetup,
    variants: [{ name: 'first page', open: () => { openPanel('baydoor'); doorPage = 0; } }, { name: 'last page', open: () => { openPanel('baydoor'); doorPage = 99; } }] });
  PLACE_KIT.scene({ id: 'bayrepair', panel: 'bayrepair', name: 'Bulldozer bay repair bench (one machine hurt, one whole, scrap for neither, first and last page)', setup: auditSetup,
    variants: [{ name: 'first page', open: () => { openPanel('bayrepair'); mendPage = 0; } }, { name: 'last page', open: () => { openPanel('bayrepair'); mendPage = 99; } }] });

  // ============================================================================
  // ART
  // ============================================================================
  const near = (x, y, pad) => x > cam.x - pad && x < cam.x + VW + pad && y > cam.y - pad && y < cam.y + VH + pad;
  const ell = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };
  const label = (g, s, x, y, col) => { g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); g.textAlign = 'left'; };

  // ---------- out in Thistledown: the mouth ----------
  function drawMouth(g, b) {
    // the cell is one tile; the arch reaches 8 px past it on each side so a machine looks as if it fits
    const x = b.x * TILE, y = b.y * TILE, cx = x + TILE / 2, top = y - 30, L = x - 8, R = x + TILE + 8, n = full();
    // the ramp going down under the yard: paler at the street, dark where it meets the arch
    const rg = g.createLinearGradient(0, y + TILE, 0, y); rg.addColorStop(0, '#8a8a90'); rg.addColorStop(1, '#2a2a30');
    g.fillStyle = rg; g.beginPath(); g.moveTo(L + 2, y + TILE); g.lineTo(R - 2, y + TILE); g.lineTo(R - 8, y + 4); g.lineTo(L + 8, y + 4); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let k = 1; k < 5; k++) { const yy = y + TILE - k * 9; g.beginPath(); g.moveTo(L + 4 + k, yy); g.lineTo(R - 4 - k, yy); g.stroke(); }
    // iron guide kerbs with yellow and black chevrons: mind the machine
    for (const s of [-1, 1]) {
      const kx = s < 0 ? L + 1 : R - 7;
      g.fillStyle = '#3a3a42'; g.fillRect(kx, y + 6, 6, TILE - 6);
      g.fillStyle = '#e0b030'; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(kx, y + 12 + k * 10); g.lineTo(kx + 6, y + 8 + k * 10); g.lineTo(kx + 6, y + 12 + k * 10); g.lineTo(kx, y + 16 + k * 10); g.closePath(); g.fill(); }
    }
    // the stone arch: two piers and a round head, the dark of the tunnel inside it
    g.fillStyle = '#5f626a'; g.beginPath(); g.moveTo(L - 4, y + 8); g.lineTo(L - 4, top + 12); g.quadraticCurveTo(cx, top - 22, R + 4, top + 12); g.lineTo(R + 4, y + 8); g.closePath(); g.fill();
    g.fillStyle = '#7c7f87'; for (let r = 0; r < 3; r++) for (const s of [-1, 1]) { const bx = s < 0 ? L - 3 : R - 5; g.fillRect(bx, top + 16 + r * 11, 8, 9); }
    const dk = g.createLinearGradient(0, top, 0, y + 8); dk.addColorStop(0, '#050608'); dk.addColorStop(1, '#14151a');
    g.fillStyle = dk; g.beginPath(); g.moveTo(L + 6, y + 8); g.lineTo(L + 6, top + 16); g.quadraticCurveTo(cx, top - 6, R - 6, top + 16); g.lineTo(R - 6, y + 8); g.closePath(); g.fill();
    // warm light far down the tunnel when a machine is stored there
    if (n) { const gl = g.createRadialGradient(cx, y + 2, 2, cx, y + 2, 24); gl.addColorStop(0, 'rgba(255,190,90,0.45)'); gl.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gl; g.beginPath(); g.arc(cx, y + 2, 24, 0, 7); g.fill(); }
    // the keystone and the board over the arch
    g.fillStyle = '#8a8d95'; g.beginPath(); g.moveTo(cx - 6, top - 10); g.lineTo(cx + 6, top - 10); g.lineTo(cx + 5, top + 1); g.lineTo(cx - 5, top + 1); g.closePath(); g.fill();
    g.fillStyle = '#2a2f3a'; roundRect(g, cx - 44, top - 34, 88, 18, 3); g.fill();
    g.strokeStyle = '#7a4a2a'; g.lineWidth = 2; roundRect(g, cx - 44, top - 34, 88, 18, 3); g.stroke();
    g.fillStyle = '#e6c76a'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText('BULLDOZER BAY', cx, top - 21.5); g.textAlign = 'left';
    // four lamps on the lintel, one lit for each stall that holds a machine
    for (let k = 0; k < STALLS; k++) {
      const lx = cx - 18 + k * 12, ly = top - 9, on = !!stalls()[k];
      if (on) { const gl = g.createRadialGradient(lx, ly, 1, lx, ly, 9); gl.addColorStop(0, 'rgba(255,190,90,0.6)'); gl.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gl; g.beginPath(); g.arc(lx, ly, 9, 0, 7); g.fill(); }
      g.fillStyle = on ? '#ffcf6a' : '#3a3a42'; g.beginPath(); g.arc(lx, ly, 2.6, 0, 7); g.fill();
    }
    // warm air drifting out
    for (let k = 0; k < 3; k++) { const ph = (time * 0.7 + k / 3) % 1; g.fillStyle = `rgba(190,196,210,${(0.18 * (1 - ph)).toFixed(3)})`; g.beginPath(); g.arc(cx + Math.sin(time * 1.3 + k * 2) * 8, top + 12 - ph * 22, 3 + ph * 5, 0, 7); g.fill(); }
  }
  HOOKS.draw.push((g, items) => {
    if (window.__instance || !atMouth()) return;
    const b = bayCell(); if (!near(tc(b.x), tc(b.y), 160)) return;
    items.push({ y: b.y * TILE + TILE - 2, draw: () => drawMouth(g, b) });
  });

  // ---------- inside: the floor, the walls ----------
  const hashOf = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
  function drawFloor(g, x0, y0, x1, y1) {
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(tx, ty); if (t !== T.FLOOR && t !== T.TD_PROP) continue;
      if (tx < HALL.x || ty < HALL.y || tx >= HALL.x + HALL.w || ty >= HALL.y + HALL.h) continue;
      const x = tx * TILE, y = ty * TILE, v = hashOf(tx, ty);
      g.fillStyle = ['#585b62', '#5d6067', '#55585f'][v % 3]; g.fillRect(x, y, TILE, TILE);
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      if (v % 7 === 0) { g.fillStyle = 'rgba(15,14,18,0.35)'; ell(g, x + 14 + (v % 20), y + 18 + (v % 13), 9, 5); g.fill(); g.fillStyle = 'rgba(96,116,150,0.12)'; ell(g, x + 12 + (v % 20), y + 17 + (v % 13), 4, 2); g.fill(); }
      else if (v % 11 === 0) { g.fillStyle = '#3a3a42'; g.beginPath(); g.arc(x + 34, y + 34, 4, 0, 7); g.fill(); }
    }
    // the stalls: yellow lines down each side, the number painted at the front
    for (let k = 0; k < STALLS; k++) {
      const sx = STALL_COL(k) * TILE, top = (HALL.y + 1) * TILE, bot = (HALL.y + 5) * TILE;
      g.fillStyle = '#c9a033'; g.fillRect(sx + 2, top, 4, bot - top); g.fillRect(sx + 4 * TILE - 6, top, 4, bot - top); g.fillRect(sx + 2, bot - 4, 4 * TILE - 4, 4);
      g.fillStyle = 'rgba(201,160,51,0.85)'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText(String(k + 1), sx + 2 * TILE, (HALL.y + 4) * TILE + 36); g.textAlign = 'left';
    }
    // a walkway from the tunnel, yellow hatched edges
    const r = ITEMS_AT.ramp; if (r) { const wx = r.cells[0][0] * TILE, wy = (HALL.y + HALL.h - 2) * TILE; g.fillStyle = 'rgba(201,160,51,0.5)'; for (let k = 0; k < 6; k++) g.fillRect(wx + 4 + k * 24, wy + TILE - 6, 12, 4); }
    for (const [sx, sy] of SCRAP) drawScrap(g, sx, sy);
  }
  function drawScrap(g, tx, ty) {
    const x = tc(tx), y = tc(ty);
    g.fillStyle = 'rgba(0,0,0,0.3)'; ell(g, x, y + 10, 16, 5); g.fill();
    g.fillStyle = '#5a5d64'; for (const [ox, oy, w, h, a] of [[-8, 2, 16, 6, 0.2], [4, 6, 14, 5, -0.35], [-2, -3, 11, 5, 0.6]]) { g.save(); g.translate(x + ox, y + oy); g.rotate(a); g.fillRect(-w / 2, -h / 2, w, h); g.restore(); }
    g.fillStyle = '#8f96a3'; for (const [ox, oy] of [[10, -2], [-12, 8], [2, 10], [13, 6]]) { g.beginPath(); g.arc(x + ox, y + oy, 1.8, 0, 7); g.fill(); }
    g.strokeStyle = '#c9ccd3'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 14, y - 4); g.lineTo(x - 4, y - 10); g.stroke(); g.lineCap = 'butt';
  }
  // the back wall's face: shelves, a pegboard of tools, a lamp over every stall, Sprocket's sign
  function drawBackWall(g) {
    const y = HALL.y * TILE, x0 = (HALL.x + 1) * TILE, x1 = (HALL.x + HALL.w - 1) * TILE;
    g.fillStyle = '#4a3b2e'; g.fillRect(x0, y + 8, x1 - x0, TILE - 8);
    g.fillStyle = '#5a4838'; for (let x = x0; x < x1; x += 24) g.fillRect(x + 1, y + 9, 22, TILE - 10);
    g.fillStyle = '#2e2620'; g.fillRect(x0, y + TILE - 6, x1 - x0, 6);
    for (let k = 0; k < STALLS; k++) {
      const c = standPx(k).x;
      // a pegboard with spanners over each stall, and a caged lamp
      g.fillStyle = '#7a6448'; g.fillRect(c - 40, y + 12, 26, 26);
      g.strokeStyle = '#c9ccd3'; g.lineWidth = 2; g.lineCap = 'round';
      for (let s = 0; s < 3; s++) { g.beginPath(); g.moveTo(c - 35 + s * 8, y + 16); g.lineTo(c - 35 + s * 8, y + 32 - s * 3); g.stroke(); }
      g.lineCap = 'butt';
      g.fillStyle = '#2a2a30'; roundRect(g, c - 7, y + 10, 14, 5, 2); g.fill();
      g.fillStyle = '#ffd88a'; g.beginPath(); g.moveTo(c - 6, y + 15); g.lineTo(c + 6, y + 15); g.lineTo(c + 4, y + 24); g.lineTo(c - 4, y + 24); g.closePath(); g.fill();
      // a shelf of tins
      g.fillStyle = '#3a2e24'; g.fillRect(c + 14, y + 26, 30, 4);
      for (let s = 0; s < 4; s++) { g.fillStyle = ['#8a3a2a', '#3f5f8a', '#5a7a4a', '#c9a040'][(s + k) % 4]; g.fillRect(c + 16 + s * 7, y + 17, 5, 9); }
    }
    // the sign over the middle post
    const sx = (STALL_COL(2) - 1) * TILE + TILE / 2;
    g.fillStyle = '#2a2f3a'; roundRect(g, sx - 44, y - 4, 88, 16, 3); g.fill(); g.strokeStyle = '#7a4a2a'; g.lineWidth = 2; roundRect(g, sx - 44, y - 4, 88, 16, 3); g.stroke();
    g.fillStyle = '#e6c76a'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText("SPROCKET'S", sx, y + 7); g.textAlign = 'left';
  }

  // ---------- inside: the fixtures ----------
  function drawPost(g, c) {
    const x = tc(c.x), y = tc(c.y);
    g.fillStyle = 'rgba(0,0,0,0.3)'; ell(g, x, y + 14, 12, 5); g.fill();
    g.fillStyle = '#3a3a42'; g.fillRect(x - 7, y - 14, 14, 28);
    g.fillStyle = '#e0b030'; for (let k = 0; k < 3; k++) g.fillRect(x - 7, y - 12 + k * 10, 14, 5);
    g.fillStyle = '#c9ccd3'; ell(g, x, y - 15, 8, 3); g.fill();
  }
  function drawStand(g, k) {
    const p = standPx(k), s = stalls()[k], x = p.x, y = p.y;
    // a low steel platform the machine stands on
    g.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(g, x - 46, y - 36, 92, 84, 6); g.fill();
    g.fillStyle = '#4a4d54'; roundRect(g, x - 44, y - 40, 88, 80, 6); g.fill();
    g.strokeStyle = '#6e7178'; g.lineWidth = 2; roundRect(g, x - 44, y - 40, 88, 80, 6); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; for (let k2 = 0; k2 < 6; k2++) { g.beginPath(); g.moveTo(x - 36 + k2 * 14, y - 36); g.lineTo(x - 36 + k2 * 14, y + 36); g.stroke(); }
    if (!s) {
      // empty: two chocks and a folded tarp
      g.fillStyle = '#3a3a42'; for (const ox of [-22, 22]) { g.beginPath(); g.moveTo(x + ox - 7, y + 20); g.lineTo(x + ox + 7, y + 20); g.lineTo(x + ox + 3, y + 12); g.closePath(); g.fill(); }
      g.fillStyle = '#6b5238'; g.beginPath(); g.moveTo(x - 12, y - 4); g.lineTo(x + 12, y - 8); g.lineTo(x + 14, y + 2); g.lineTo(x - 10, y + 5); g.closePath(); g.fill();
      return;
    }
    // the machine, parked: nobody aboard (the bulldozer side on, its blade and drill toward the knight; the others facing
    // the floor), with the bulldozer's fitted parts on it and its own hull
    const ent = { x, y, facing: s.kind === 'dozer' ? { x: -1, y: 0 } : { x: 0, y: 1 }, moving: false, walkT: 0, attackT: 0, hurtT: 0, parked: true, hp: hullOf(s), maxHp: maxHpOf(s.kind) };
    g.save(); g.translate(x, y + 6); g.scale(STAND_K, STAND_K);
    try { if (window.MOUNT_LOOK) MOUNT_LOOK.machine(g, ent, s.kind, { parked: true, hp: ent.hp, maxHp: ent.maxHp, up: s.kind === 'dozer' ? ups() : null, seed: k * 0.3 }); }
    finally { g.restore(); }
    // chocks in front of it
    g.fillStyle = '#3a3a42'; for (const ox of [-30, 30]) { g.beginPath(); g.moveTo(x + ox - 6, y + 38); g.lineTo(x + ox + 6, y + 38); g.lineTo(x + ox + 3, y + 31); g.closePath(); g.fill(); }
  }
  function drawParts(g, c) {
    const x0 = c.cells[0][0] * TILE, w = c.cells.length * TILE, y = c.y * TILE, U = window.DOZERUP;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0 + 4, y + TILE - 6, w - 8, 8);
    // a long wooden bench, legs and a shelf under it
    g.fillStyle = '#3f2d1c'; for (const lx of [x0 + 8, x0 + w - 14]) g.fillRect(lx, y + 18, 6, TILE - 20);
    g.fillStyle = '#5a3a1e'; g.fillRect(x0 + 6, y + TILE - 14, w - 12, 4);
    g.fillStyle = '#7a4a2a'; g.fillRect(x0 + 2, y + 6, w - 4, 14); g.fillStyle = '#9a6a3a'; g.fillRect(x0 + 2, y + 6, w - 4, 4);
    // a vice with the drill cone in its jaws
    g.fillStyle = '#4a4d54'; roundRect(g, x0 + 12, y - 4, 16, 12, 2); g.fill();
    g.fillStyle = '#8f96a3'; g.beginPath(); g.moveTo(x0 + 26, y - 6); g.lineTo(x0 + 44, y + 1); g.lineTo(x0 + 26, y + 8); g.closePath(); g.fill();
    g.strokeStyle = '#4a4d54'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x0 + 29 + k * 4, y - 4 + k); g.lineTo(x0 + 31 + k * 4, y + 6 - k); g.stroke(); }
    // a blueprint pinned flat, a ram plate, a coil of chain, a hammer
    g.fillStyle = '#3b6fb6'; g.fillRect(x0 + 56, y - 2, 28, 18); g.fillStyle = 'rgba(233,238,245,0.85)'; for (let k = 0; k < 3; k++) g.fillRect(x0 + 60, y + 2 + k * 4, 20 - k * 5, 1.5);
    g.fillStyle = '#5f636b'; roundRect(g, x0 + 92, y - 4, 22, 14, 2); g.fill(); g.fillStyle = '#c9ccd3'; for (const ox of [96, 103, 110]) { g.beginPath(); g.arc(x0 + ox, y + 3, 1.5, 0, 7); g.fill(); }
    g.strokeStyle = '#8f96a3'; g.lineWidth = 1.6; for (let k = 0; k < 4; k++) { ell(g, x0 + 122 + (k % 2) * 6, y + 2 + Math.floor(k / 2) * 5, 3.2, 2); g.stroke(); }
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x0 + 120, y + 16); g.lineTo(x0 + 136, y + 12); g.stroke(); g.fillStyle = '#3a3a42'; g.fillRect(x0 + 134, y + 7, 6, 10);
    // a gold glint when something can be fitted now
    if (U && U.UPGRADES.some(u => !ups()[u.id] && U.canFitUpgrade(u).ok)) { const bob = Math.sin(time * 4) * 2; g.fillStyle = '#f5c542'; g.beginPath(); g.arc(x0 + w / 2, y - 14 + bob, 4, 0, 7); g.fill(); }
  }
  function drawRepair(g, c) {
    const x0 = c.cells[0][0] * TILE, w = c.cells.length * TILE, y = c.y * TILE;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0 + 4, y + TILE - 6, w - 8, 8);
    // a steel bench
    g.fillStyle = '#2f2f38'; for (const lx of [x0 + 8, x0 + w - 14]) g.fillRect(lx, y + 18, 6, TILE - 20);
    g.fillStyle = '#4a4d54'; g.fillRect(x0 + 2, y + 6, w - 4, 14); g.fillStyle = '#6e7178'; g.fillRect(x0 + 2, y + 6, w - 4, 4);
    // an anvil, a welding torch with a blue flame and its sparks, a bin of scrap, a stack of plate
    g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(x0 + 10, y - 4); g.lineTo(x0 + 36, y - 4); g.lineTo(x0 + 31, y + 2); g.lineTo(x0 + 27, y + 2); g.lineTo(x0 + 27, y + 8); g.lineTo(x0 + 19, y + 8); g.lineTo(x0 + 19, y + 2); g.lineTo(x0 + 10, y + 1); g.closePath(); g.fill();
    const fl = 0.6 + Math.sin(time * 18) * 0.3;
    g.strokeStyle = '#8a3a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 + 52, y + 10); g.lineTo(x0 + 66, y); g.stroke();
    g.fillStyle = `rgba(120,180,255,${fl.toFixed(3)})`; g.beginPath(); g.arc(x0 + 68, y - 2, 3.2, 0, 7); g.fill();
    for (let k = 0; k < 3; k++) { const a = time * 7 + k * 2.1, r = 4 + ((time * 20 + k * 5) % 8); g.fillStyle = 'rgba(255,220,120,0.8)'; g.fillRect(x0 + 68 + Math.cos(a) * r, y - 2 + Math.sin(a) * r, 1.5, 1.5); }
    g.fillStyle = '#3a3a42'; roundRect(g, x0 + 84, y - 6, 24, 20, 2); g.fill();
    g.fillStyle = '#6e7178'; for (const [ox, oy] of [[88, -6], [94, -9], [100, -6], [96, -3]]) { g.beginPath(); g.arc(x0 + ox, y + oy, 3.2, 0, 7); g.fill(); }
    g.fillStyle = '#5f636b'; for (let k = 0; k < 3; k++) g.fillRect(x0 + 116, y + 6 - k * 4, 22, 3);
    // a gold glint when a stored machine is hurt and there is scrap enough to mend it
    if (stalls().some(s => s && scrapFor(s) > 0 && countItem('goblin_scrap') >= scrapFor(s))) { const bob = Math.sin(time * 4) * 2; g.fillStyle = '#f5c542'; g.beginPath(); g.arc(x0 + w / 2, y - 14 + bob, 4, 0, 7); g.fill(); }
  }
  function drawBoard(g, c) {
    const x = tc(c.x), y = tc(c.y), U = window.DOZERUP;
    g.fillStyle = 'rgba(0,0,0,0.3)'; ell(g, x, y + 16, 18, 5); g.fill();
    g.fillStyle = '#5a3a1e'; roundRect(g, x - 20, y - 26, 34, 42, 3); g.fill();
    g.fillStyle = '#3f2d1c'; roundRect(g, x - 17, y - 23, 28, 36, 2); g.fill();
    if (U) U.UPGRADES.forEach((u, i) => {
      const px = x - 15 + (i % 2) * 13, py = y - 20 + Math.floor(i / 2) * 16, have = !!ups()[u.id] || countItem(u.blueprint) > 0 || player.bank.some(b => b && b.id === u.blueprint);
      g.fillStyle = have ? '#3b6fb6' : 'rgba(233,238,245,0.10)'; g.fillRect(px, py, 11, 13);
      if (have) { g.fillStyle = 'rgba(233,238,245,0.85)'; g.fillRect(px + 2, py + 3, 7, 1); g.fillRect(px + 2, py + 6, 5, 1); g.fillRect(px + 2, py + 9, 6, 1); }
      if (ups()[u.id]) { g.strokeStyle = '#7ee787'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(px + 2, py + 8); g.lineTo(px + 4, py + 11); g.lineTo(px + 9, py + 3); g.stroke(); }
    });
  }
  function drawRamp(g, c) {
    const x0 = c.cells[0][0] * TILE, y = c.cells[0][1] * TILE, w = c.cells.length * TILE;
    g.fillStyle = '#6e7178'; g.fillRect(x0, y, w, TILE);
    // daylight coming down from the street
    const dl = g.createLinearGradient(0, y + TILE, 0, y); dl.addColorStop(0, 'rgba(255,248,220,0.55)'); dl.addColorStop(1, 'rgba(255,248,220,0.05)');
    g.fillStyle = dl; g.fillRect(x0 + 6, y, w - 12, TILE);
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 0; k < 5; k++) g.fillRect(x0 + 8, y + 6 + k * 9, w - 16, 2);
    g.fillStyle = '#3a3a42'; g.fillRect(x0, y, 6, TILE); g.fillRect(x0 + w - 6, y, 6, TILE);
    g.fillStyle = '#e0b030'; for (const kx of [x0, x0 + w - 6]) for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(kx, y + 10 + k * 10); g.lineTo(kx + 6, y + 6 + k * 10); g.lineTo(kx + 6, y + 10 + k * 10); g.lineTo(kx, y + 14 + k * 10); g.closePath(); g.fill(); }
  }
  function drawDrums(g, c) {
    const x = tc(c.x), y = tc(c.y);
    g.fillStyle = 'rgba(0,0,0,0.3)'; ell(g, x, y + 16, 20, 6); g.fill();
    for (const [ox, col] of [[-9, '#8a3a2a'], [9, '#3f5f8a']]) {
      g.fillStyle = col; g.fillRect(x + ox - 8, y - 10, 16, 26);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + ox - 8, y - 2, 16, 2); g.fillRect(x + ox - 8, y + 8, 16, 2);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + ox - 6, y - 8, 3, 22);
      g.fillStyle = '#2a2a30'; ell(g, x + ox, y - 10, 8, 3); g.fill();
    }
  }
  function drawChest(g, c) {
    const x = tc(c.x), y = tc(c.y);
    g.fillStyle = 'rgba(0,0,0,0.3)'; ell(g, x, y + 16, 18, 5); g.fill();
    g.fillStyle = '#a0302a'; roundRect(g, x - 16, y - 16, 32, 32, 3); g.fill();
    g.fillStyle = '#7a2420'; for (let k = 0; k < 4; k++) g.fillRect(x - 14, y - 10 + k * 7, 28, 1.5);
    g.fillStyle = '#c9ccd3'; for (let k = 0; k < 4; k++) g.fillRect(x - 5, y - 12 + k * 7, 10, 2);
    g.fillStyle = '#2a2a30'; for (const ox of [-12, 12]) { g.beginPath(); g.arc(x + ox, y + 17, 3, 0, 7); g.fill(); }
  }
  function drawWheels(g, c) {
    const x = tc(c.x), y = tc(c.y);
    g.fillStyle = 'rgba(0,0,0,0.3)'; ell(g, x, y + 16, 18, 6); g.fill();
    for (let k = 0; k < 3; k++) {
      const wy = y + 10 - k * 8;
      g.fillStyle = '#2f2a26'; ell(g, x, wy, 15, 7); g.fill();
      g.fillStyle = '#5a4a3a'; ell(g, x, wy - 1, 8, 3.6); g.fill();
      g.strokeStyle = '#8f96a3'; g.lineWidth = 1.2; ell(g, x, wy, 15, 7); g.stroke();
    }
  }
  const LABEL_REACH = 4 * TILE;    // a stored machine's name and hull show when the knight is this close
  const STAND_K = 1.2;              // a stored machine is drawn a little bigger than out on the map: it fills its stall
  const DRAW = { post: drawPost, parts: drawParts, repair: drawRepair, board: drawBoard, ramp: drawRamp, drums: drawDrums, chest: drawChest, wheels: drawWheels };
  // the lamps' light, over everything in the hall (a soft warm glow, never a darkness)
  function drawGlow(g) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < STALLS; k++) {
      const p = standPx(k), lx = p.x, ly = HALL.y * TILE + 22, fl = 0.9 + Math.sin(time * 3 + k) * 0.05;
      const gl = g.createRadialGradient(lx, ly + 40, 6, lx, ly + 60, 150); gl.addColorStop(0, `rgba(255,200,120,${(0.16 * fl).toFixed(3)})`); gl.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(lx, ly + 60, 150, 0, 7); g.fill();
    }
    g.restore();
  }
  // Sprocket: the townsfolk look (83-townsart's 'sprocket'), turning to the knight when he is near
  function drawSprocket(g) {
    const e = { x: SP.px, y: SP.py, r: 11, facing: SP.facing, hurtT: 0, attackT: 0, moving: false, walkT: 0 };
    const nearK = dist(player.x, player.y, e.x, e.y) < 120;
    if (nearK) { const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1; e.facing = { x: dx / d, y: dy / d }; }
    const look = { who: 'sprocket', name: SP.name };
    const nl = !!(window.TOWNSFOLK && TOWNSFOLK.put(g, e.x, e.y, e, look));
    if (!nl) { g.save(); g.translate(e.x, e.y); g.fillStyle = 'rgba(0,0,0,0.28)'; ell(g, 0, 10, 11, 5); g.fill(); g.scale(0.8, 0.8); drawHuman(g, e, { tunic: '#3f5f8a', hair: '#2a1a0a' }); g.restore(); }
    SP.up = nl ? TOWNSFOLK.labelUp('sprocket', 24) : 24;
    if (nearK) label(g, SP.name, e.x, e.y - SP.up, '#ffe9a8');
  }
  HOOKS.draw.push((g, items) => {
    if (!inBay()) return;
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + VH) / TILE) + 2);
    items.push({ y: -1e9 - 5, draw: () => drawFloor(g, x0, y0, x1, y1) });
    if (near(tc(HALL.x + HALL.w / 2), HALL.y * TILE, VW)) items.push({ y: HALL.y * TILE + TILE - 4, draw: () => drawBackWall(g) });
    const done = new Set();
    for (const c of CELLS.values()) {
      if (done.has(c) || !near(tc(c.x), tc(c.y), 140)) continue; done.add(c);
      if (c.kind === 'stall') { if (done.has('stall' + c.k)) continue; done.add('stall' + c.k); const k = c.k; items.push({ y: standPx(k).y + 34, draw: () => drawStand(g, k) }); continue; }
      const f = DRAW[c.kind]; if (!f) continue;
      const bottom = (c.cells ? c.cells[c.cells.length - 1][1] : c.y) * TILE + TILE - 6;
      items.push({ y: c.kind === 'ramp' ? -1e9 - 4 : bottom, draw: () => f(g, c) });
    }
    if (near(SP.px, SP.py, 120)) items.push({ y: SP.py + 13, draw: () => drawSprocket(g) });
    // names over the stalls' machines when the knight is near, and a hull bar on a hurt one
    items.push({ y: 1e9 - 3, draw: () => {
      drawGlow(g);
      for (let k = 0; k < STALLS; k++) {
        const s = stalls()[k], p = standPx(k); if (!s || dist(player.x, player.y, p.x, p.y) > LABEL_REACH) continue;
        label(g, `${WHAT[s.kind].charAt(0).toUpperCase() + WHAT[s.kind].slice(1)}  ${hullOf(s)} / ${maxHpOf(s.kind)}`, p.x, p.y + 52, scrapFor(s) ? '#ffcf6a' : '#c9e7c0');
      }
    } });
    // the gold corners on Sprocket when he is faced (the core frames the fixture faced: TD_PROP is an INTERESTING tile)
    if (!player.dead && !player.mech) items.push({ y: 1e9 + 1, draw: () => { PEOPLE_UI.brackets(g, spFacing()); } });
  });

  // ---------- the book ----------
  if (window.WIKI && typeof WIKI.add === 'function') WIKI.add('places', {
    id: BAY_ID, name: 'The Bulldozer Bay', sub: "Sprocket's workshop under Smithy Lane, Thistledown", kind: 'instance',
    lines: [
      'A stone arch in the smithy yard, over a ramp that goes down under the street. A board over it says BULLDOZER BAY, and four little lamps on the lintel light up, one for each stall with a machine in it.',
      '',
      'DRIVING IN. Drive the walker, the bulldozer or the Barrelbeast into the arch (or press E there). It rolls into the first empty stall and you climb down beside it. Friends riding with you hop off outside.',
      'WALKING IN. On foot, press E at the arch: go inside, or take any of your machines out.',
      'TAKING A MACHINE OUT. Press E on it in its stall. It rolls up the tunnel onto the street with the hull it went in with.',
      '',
      'FOUR STALLS, one machine in each. They are yours: they stay when you go home, and nobody else can drive them out.',
      'THE PARTS BENCH fits the four bulldozer upgrades (blueprint, parts, Crafting level).',
      `THE REPAIR BENCH mends a hull for goblin scrap: one for every ${SCRAP_PER} points missing.`,
      'THE BLUEPRINT BOARD says which plans you have, and which are still out there.',
      'SPROCKET the goblin mechanic ran away from the goblin camp and fixes knights\' machines now.',
    ],
  });

  window.DOZERBAY = {
    ID: BAY_ID, HALL, ROWS, CELLS, STALLS, ENTRY, MECHANIC, SP, MACH, WHAT, SCRAP_PER,
    inside: inBay, stalls, freeStall, full, standPx, besidePx, street, nearMouth, noseOnMouth,
    driveIn, walkIn, takeOut, mend, door, talk, readBoard, scrapFor, maxHpOf, hullOf, cellAt,
  };

  // ============================================================================
  // SELF-TEST
  // ============================================================================
  HOOKS.selfTest.push((check, F, h) => {
    const P = 'dozerbay: ';
    const b = bayCell();
    check(P + 'the bay is an instance of its own (4 stalls, the parts and repair benches, the board, the ramp, Sprocket) and the mouth out in Thistledown is still 40-dozerup\'s DOZER_BAY cell on its port',
      INSTANCES.list().includes(BAY_ID) && !!b && tileAt(b.x, b.y) === T.DOZER_BAY && b.x === ATLAS.port('thistledown.dozer_bay')[0] && b.y === ATLAS.port('thistledown.dozer_bay')[1]
        && [...CELLS.values()].filter(c => c.kind === 'stall').length === 4 * STALLS && !!ITEMS_AT.parts && !!ITEMS_AT.repair && !!ITEMS_AT.ramp && !!MECHANIC && !!ENTRY,
      { bay: b, cells: CELLS.size });
    if (!b) return;
    const keep = { bay: player.bay ? JSON.parse(JSON.stringify(player.bay)) : null, inv: player.inv.map(s => (s ? { ...s } : null)), up: player.dozerUp ? { ...player.dozerUp } : null, bank: player.bank.map(s => ({ ...s })) };
    const [stx, sty] = street();
    const onFoot = () => { player.mech = null; player.r = KNIGHT.r; player.speed = KNIGHT.speed; };
    const drive = (kind, hp) => { const M = MACH[kind]; player.mech = kind === 'walker' ? { hp, maxHp: M.hp() } : { hp, maxHp: M.hp(), kind }; player.r = M.r; player.speed = M.speed(); };
    h.peace(true); closePanel(); if (INSTANCES.active()) INSTANCES.leave(); onFoot(); dialog.cur = null; dialog.queue.length = 0;
    player.bay = fresh(); player.dozerUp = { drill: true, irondrill: false, ram: false, boiler: false };
    try {
      // 1. what climbing in gives, read from the real machines: the table that takes a machine out matches it
      {
        const o = h.openSpot(...ATLAS.frame('drill_field').p(52, 50)), got = {}, t0 = tileAt(o.x, o.y);
        const climb = (tile, enter) => { changeTile(o.x, o.y, tile); F.tp(o.x - 1, o.y); onFoot(); enter(o.x, o.y); got[machineKind()] = { r: player.r, speed: player.speed, hp: player.mech.hp, max: player.mech.maxHp }; onFoot(); changeTile(o.x, o.y, t0); };
        climb(T.MECH, enterMech); climb(T.DOZER, enterDozer);
        if (window.BEAST && BEAST.tiles) { changeTile(o.x, o.y, BEAST.tiles.BEAST); F.tp(o.x - 1, o.y); F.face(o.x, o.y); closePanel(); F.press('KeyE'); got[machineKind()] = player.mech ? { r: player.r, speed: player.speed, hp: player.mech.hp, max: player.mech.maxHp } : null; onFoot(); changeTile(o.x, o.y, t0); }
        const same = KINDS.every(k => got[k] && got[k].r === MACH[k].r && got[k].speed === MACH[k].speed() && got[k].max === MACH[k].hp() && got[k].hp === MACH[k].hp());
        check(P + 'the walker, the bulldozer and the Barrelbeast come out of a stall as climbing into them makes them (radius, speed, full hull)', same, { got });
      }
      // 2. drive the bulldozer up the street into the mouth: it rolls into stall 1, the knight climbs down beside it, inside
      F.tp(stx, sty + 1); drive('dozer', 74); player.facing = { x: 0, y: -1 };
      let n = 0; while (n < 240 && !inBay()) { F.step(['KeyW']); n++; }
      const at1 = { x: player.x, y: player.y }, st0 = stalls()[0];
      check(P + 'a bulldozer driven up Smithy Lane into the mouth rolls into stall 1 with its hull (74), and the knight climbs down beside it in the workshop',
        inBay() && !player.mech && player.r === KNIGHT.r && !!st0 && st0.kind === 'dozer' && st0.hp === 74 && dist(at1.x, at1.y, standPx(0).x, standPx(0).y) < 2 * TILE && !!notice && /stall 1/.test(notice.text),
        { n, inBay: inBay(), stall: st0, at: [at1.x / TILE, at1.y / TILE], notice: notice && notice.text });
      // 3. a save inside: the knight is on the street outside, the machine in the stall; a load lands outside with it still there
      { save(); const raw = JSON.parse(localStorage.getItem(SAVE_KEY)); const ok1 = raw.player.bay && raw.player.bay.stalls[0] && raw.player.bay.stalls[0].kind === 'dozer' && Math.floor(raw.player.x / TILE) === stx && Math.floor(raw.player.y / TILE) === sty;
        load(); F.sim(2, []);
        check(P + 'saved inside, the knight is on the street by the mouth and the bulldozer is in stall 1; loaded, he is outside and it is still there', ok1 && !inBay() && !!stalls()[0] && stalls()[0].kind === 'dozer' && stalls()[0].hp === 74,
          { ok1, inBay: inBay(), stall: stalls()[0] }); }
      // 4. on foot at the mouth: E opens the door; Go inside walks down; Sprocket talks (his story the first time, then tips)
      { F.tp(stx, sty); onFoot(); F.face(b.x, b.y); closePanel(); F.press('KeyE'); const opened = panel === 'baydoor'; render();
        const take = buttons.some(bt => bt.label === 'Take out: stall 1'), go = F.clickButton('Go inside'), inside = inBay(), arrived = Math.floor(player.x / TILE) === ENTRY[0] && Math.floor(player.y / TILE) === ENTRY[1];
        dialog.cur = null; dialog.queue.length = 0; S().met = false;
        F.tp(MECHANIC.x - 1, MECHANIC.y); F.face(MECHANIC.x, MECHANIC.y); F.press('KeyE'); const lines = [dialog.cur, ...dialog.queue].filter(Boolean);
        const story = lines.length === STORY.length && lines.every(l => l.who === 'Sprocket') && /goblin camp/.test(lines.map(l => l.text).join(' '));
        dialog.cur = null; dialog.queue.length = 0; F.press('KeyE'); const said = [dialog.cur, ...dialog.queue].filter(Boolean)[0] || null, tip = !!said && said.who === 'Sprocket' && /stall 1 is at 74 of 110/.test(said.text);
        const tapped = TAP_PEOPLE.some(f => f().some(p => p.id === 'sprocket'));
        dialog.cur = null; dialog.queue.length = 0;
        check(P + 'on foot, E at the mouth opens the bay\'s door (Take out for stall 1, Go inside); inside, Sprocket tells his story once, then says the bulldozer in stall 1 is at 74 of 110; a tap can reach him',
          opened && take && go && inside && arrived && story && tip && tapped, { opened, take, go, inside, arrived, story, lines: lines.length, tip: said && said.text, tapped }); }
      // 5. the repair bench: refused without scrap, mended for ceil(36 / 20) = 2 goblin scrap
      { removeItem('goblin_scrap', 999); const c = ITEMS_AT.repair, [rx, ry] = c.cells[1]; F.tp(rx, ry + 1); F.face(rx, ry); closePanel(); F.press('KeyE'); const opened = panel === 'bayrepair'; render();
        const grey = buttons.some(bt => bt.label === 'disabled:Mend: stall 1'); h.give('goblin_scrap', 3); render(); const clicked = F.clickButton('Mend: stall 1'); closePanel();
        check(P + 'the repair bench mends the bulldozer (74 of 110) for 2 goblin scrap: greyed with none, mended with 3 (1 left)', opened && grey && clicked && stalls()[0].hp === 110 && countItem('goblin_scrap') === 1 && scrapFor(stalls()[0]) === 0,
          { opened, grey, clicked, hp: stalls()[0].hp, scrap: countItem('goblin_scrap') }); removeItem('goblin_scrap', 999); }
      // 6. the parts bench opens the old Bulldozer bay panel (40-dozerup's upgrades); the board reads the plans; the ramp walks out
      { const c = ITEMS_AT.parts, [ux, uy] = c.cells[1]; F.tp(ux, uy + 1); F.face(ux, uy); closePanel(); F.press('KeyE'); const parts = panel === 'dozerup'; render(); const rows = buttons.filter(bt => /^(disabled:)?Fit/.test(bt.label)).length; closePanel();
        const bd = [...CELLS.values()].find(q => q.kind === 'board'); F.tp(bd.x + 1, bd.y); F.face(bd.x, bd.y); dialog.cur = null; dialog.queue.length = 0; F.press('KeyE'); const board = [dialog.cur, ...dialog.queue].filter(Boolean).map(l => l.text).join(' ');
        dialog.cur = null; dialog.queue.length = 0;
        const r = ITEMS_AT.ramp, [tx, ty] = r.cells[1]; F.tp(tx, ty - 1); F.face(tx, ty); F.press('KeyE'); const out = !inBay() && Math.floor(player.x / TILE) === stx && Math.abs(Math.floor(player.y / TILE) - sty) <= 1;
        check(P + 'inside: the parts bench opens the Bulldozer bay upgrades panel (4 rows), the board says the drill is fitted, and E on the ramp walks out onto the street', parts && rows >= 4 && /Fitted: drill/.test(board) && out,
          { parts, rows, board, out, at: [Math.floor(player.x / TILE), Math.floor(player.y / TILE)] }); }
      // 7. the door's Take it out: the bulldozer comes up the tunnel driven, onto the street, with the boiler's numbers
      { player.dozerUp.boiler = true; F.tp(stx, sty); onFoot(); F.face(b.x, b.y); closePanel(); F.press('KeyE'); render(); const clicked = F.clickButton('Take out: stall 1');
        check(P + 'the door\'s Take it out drives the bulldozer up onto the street beside the mouth (the big boiler fitted since: speed 250, hull 110 of 180), stall 1 empty',
          clicked && machineKind() === 'dozer' && player.speed === DOZER_BOILER_SPEED && player.mech.maxHp === DOZER_BOILER_HP && player.mech.hp === 110 && !stalls()[0] && !inBay() && dist(player.x, player.y, tc(b.x), tc(b.y)) < 3 * TILE && player.facing.y === 1,
          { clicked, mech: player.mech, speed: player.speed, stall: stalls()[0], at: [player.x / TILE, player.y / TILE] }); player.dozerUp.boiler = false; }
      // 8. E in a machine at the mouth drives it in; the walker and the Barrelbeast take stalls too; a fifth is refused outside
      { const ok = [];
        for (const kind of ['walker', 'beast', 'dozer', 'walker']) { if (inBay()) INSTANCES.leave(); F.tp(stx, sty); drive(kind, 60); player.facing = { x: 0, y: -1 }; closePanel(); F.press('KeyE'); ok.push(inBay() && !player.mech); }
        INSTANCES.leave(); F.tp(stx, sty); drive('beast', 200); player.facing = { x: 0, y: -1 }; hintT = -1e9; F.press('KeyE');
        const refused = !inBay() && machineKind() === 'beast' && !!notice && /four stalls are full/.test(notice.text);
        const kinds = stalls().map(s => s && s.kind).join();
        check(P + 'E at the mouth drives a machine in: the walker, the Barrelbeast, a bulldozer and a second walker fill the four stalls; a fifth machine is refused outside (all four stalls are full)',
          ok.every(Boolean) && kinds === 'walker,beast,dozer,walker' && refused, { ok, kinds, refused, notice: notice && notice.text }); onFoot(); }
      // 9. inside, E on a stored machine climbs in and drives it out (the Barrelbeast in stall 2, its stored hull)
      { F.tp(stx, sty); F.face(b.x, b.y); closePanel(); F.press('KeyE'); F.clickButton('Go inside'); const p = besidePx(1); player.x = p.x; player.y = p.y; F.face(STALL_COL(1) + 1, HALL.y + 3); closePanel(); F.press('KeyE');
        check(P + 'inside, E on the Barrelbeast in stall 2 climbs in and drives it up onto the street with its hull (60 of 300)', !inBay() && machineKind() === 'beast' && player.mech.hp === 60 && player.mech.maxHp === 300 && !stalls()[1],
          { inBay: inBay(), mech: player.mech, stalls: stalls().map(s => s && s.kind) }); onFoot(); }
      // 10. riders: a friend on the seat hops down outside (his own game: the driver's map is no longer his), and the driver is told
      if (window.RIDE && window.NET) {
        const me0 = NET.me, rof = RIDE.ridersOf; NET.me = 'Mudtech'; RIDE.ridersOf = () => [{ n: 'Ben', s: 1 }];
        try { F.tp(stx, sty); drive('dozer', 100); player.facing = { x: 0, y: -1 }; closePanel(); F.press('KeyE');
          check(P + 'driving in with a friend aboard: the driver reads that Ben hops down outside', inBay() && !!notice && /Ben hops down outside/.test(notice.text), { notice: notice && notice.text }); }
        finally { NET.me = me0; RIDE.ridersOf = rof; if (inBay()) INSTANCES.leave(); onFoot(); }
      }
      // 11. the mare never goes down the tunnel
      { player.bay = fresh(); F.tp(stx, sty + 1); player.mech = { kind: 'horse', hp: 60, maxHp: 60 }; player.r = 16; player.facing = { x: 0, y: -1 };
        const mare = !driveIn() && !inBay(); onFoot();
        check(P + 'the mare never goes down the tunnel', mare && !stalls().some(Boolean), { mare }); }
      // 12. a new game empties the stalls
      { player.bay.stalls[2] = { kind: 'walker', hp: 9 }; for (const fn of HOOKS.newGame) if (/player\.bay = fresh/.test(String(fn))) fn();
        check(P + 'a new game empties the stalls', !stalls().some(Boolean) && S().met === false, { stalls: stalls() }); }
    } finally {
      if (INSTANCES.active()) INSTANCES.leave(); onFoot(); closePanel(); dialog.cur = null; dialog.queue.length = 0;
      player.bay = keep.bay; player.inv = keep.inv; player.dozerUp = keep.up; player.bank = keep.bank; h.peace(false); save();
    }
  });
}
