// ============================================================================
// PLAYERS ONLINE — the other knights.
// Owner: "make it an online MMORPG so Cohen and his friends can log in and play together."
// This is what "see your friends" means. Our presence goes out on the wire (70-net) a few times a second, theirs comes
// in, and every knight on the same map is drawn among the monsters and the trees with a name over their head. A chip at
// the top says how many are on and opens the Friends panel: who, what level, where, a Give button that hands something
// over (docs/ONLINE.md: gift / gift_ok / gift_no / gift_back) and Follow, which marks a friend on the map.
// Feature file: HOOKS only, plus one core function wrapped by reassignment (drawPanels — the 61-markers trick), because
// the world map is painted after every HUD hook has run and friends should be named on it.
// window.PLAYERS = { lookOf, presence, mapId, remote, online, me, near, give, follow, following } — 74-chat draws the
// speech bubbles over `remote`; 75-coop reuses lookOf / presence.
// ============================================================================
{
  const SEND_EVERY = 1 / 8;     // s: presence goes out at most this often while something is changing (the contract's cap)
  const SEND_IDLE = 1;          // s: and at least this often when nothing is
  const GONE_MS = 6000;         // ms: a knight silent this long has gone
  const LERP_S = 0.12;          // s: a remote knight slides to a fresh position over about this long
  const NEAR = 2 * TILE;        // px: close enough to hand something over
  const GIFT_EVERY = 1;         // s: the contract's cap on gifts
  const MINE = { friends: 1, gift: 1, chatlog: 1 };   // the online files' own panels: the chip stays tappable under them
  const DEFAULT_LOOK = { tunic: '#3b6fb6', hair: '#5a3a1e', shoulder: '#9aa3b2', fists: true };
  // friend blue: the kit's one colour for friends (their seal, dots, names); nothing else is this blue
  const BLUE = HK.T.friend;
  const GOLD = '#f5c542';       // an admin's name, wherever it is written (docs/ONLINE.md, "Roles")
  const isAdmin = o => !!o && o.role === 'admin';
  // The ADMIN tag: a small gold pill with dark letters, its left edge at x and its middle at y. Returns its width.
  // 74-chat and 76-admin draw the same pill through PLAYERS.adminPill, so every screen shows one tag.
  function adminPill(g, x, y, size) {
    g.font = `bold ${size}px sans-serif`;
    const w = Math.ceil(g.measureText('ADMIN').width) + 8, h = size + 5;
    roundRect(g, x, y - h / 2, w, h, h / 2); g.fillStyle = GOLD; g.fill();
    g.fillStyle = '#1a1300'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('ADMIN', x + 4, y + 0.5); g.textBaseline = 'alphabetic';
    return w;
  }

  const REMOTE = {};   // name → the knight as last heard: { n, map, x, y (where they are), shown: {x, y} (where we draw them), facing, moving, walkT, hp, mhp, lv, look, mech, dead, act, hurtT, attackT, r, lastAt }
  let ONLINE = [];     // the roster from `who`: [{ n, map, region, lv }]
  let following = null;
  let friendsPage = 0, giftPage = 0;
  const me = () => NET.me;
  const mapId = () => (window.INSTANCES && INSTANCES.active && INSTANCES.active()) || 'over';
  const instName = id => { const i = window.INSTANCES && INSTANCES.get ? INSTANCES.get(id) : null; return i && i.name ? i.name : String(id); };
  const whereOf = o => o.map === 'over' || !o.map ? (o.region || 'The Fanglands') : instName(o.map);
  // where we are, in words, for the roster and the admin page: the instance's name inside one, else the region under our feet
  const regionName = () => { const id = mapId(); if (id !== 'over') return instName(id); if (player.region) return String(player.region); const r = regionAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE)); return r && r.name ? r.name : 'The Fanglands'; };
  const forget = n => { delete REMOTE[n]; if (following === n) following = null; };
  const clearAll = () => { for (const n in REMOTE) delete REMOTE[n]; ONLINE = []; following = null; };
  const near = n => { const e = REMOTE[n]; return !!e && e.map === mapId() && dist(e.shown.x, e.shown.y, player.x, player.y) <= NEAR; };
  // the ONLINE chip and the F key both do this
  const toggleFriends = () => { if (panel === 'friends') closePanel(); else { friendsPage = 0; openPanel('friends'); } };

  // ---------- out: what we look like and where we are ----------
  function lookOf() {
    const l = playerLook();
    return {
      tunic: l.tunic, hair: l.hair, shoulder: l.shoulder, helm: l.helm || null, body: l.body || null, shield: l.shield || null,
      weapon: l.weapon ? { shape: l.weapon.shape || 'sword', color: l.weapon.color || '#c9ccd3' } : null,
      tool: l.tool || null, toolColor: l.toolColor || null, rod: !!l.rod, fists: !!l.fists,
      // a worn party hat (77-dropparty's playerLook wrapper sets the colour word), so everyone sees it
      hat: l.hat || null,
    };
  }
  function presence() {
    const a = player.action, m = player.mech;
    return {
      t: 'p', map: mapId(), region: regionName(), x: Math.round(player.x), y: Math.round(player.y), fx: +player.facing.x.toFixed(2), fy: +player.facing.y.toFixed(2),
      mv: !!player.moving, wt: +(player.walkT % 100).toFixed(1), hp: Math.ceil(player.hp), mhp: player.maxHp, lv: combatLevel(), look: lookOf(),
      mech: m ? { kind: m.kind || 'walker', hp: Math.ceil(m.hp), maxHp: m.maxHp } : null, dead: !!player.dead, def: playerDefRoll(), act: a ? a.type : null,
    };
  }
  // a cheap signature of everything the contract counts as a change; the full message is only built when it differs
  const lookKey = () => { const e = player.equip, a = player.action, m = player.mech; return (e.weapon || '') + '|' + (e.helm || '') + '|' + (e.body || '') + '|' + (e.shield || '') + '|' + (a ? a.type + ':' + (a.tier || '') : '') + '|' + (m ? Math.ceil(m.hp) : '-'); };
  const sig = () => mapId() + '|' + Math.round(player.x) + ',' + Math.round(player.y) + '|' + player.facing.x.toFixed(2) + ',' + player.facing.y.toFixed(2) + '|' + (player.moving ? 1 : 0) + '|' + Math.ceil(player.hp) + '/' + player.maxHp + '|' + (player.dead ? 1 : 0) + '|' + lookKey();
  let lastSig = null, lastSentAt = -1e9;

  HOOKS.update.push(dt => {
    if (NET.online()) {
      const s = sig(), since = time - lastSentAt;
      if ((s !== lastSig && since >= SEND_EVERY) || since >= SEND_IDLE) { if (NET.send(presence())) { lastSig = s; lastSentAt = time; } }
    } else lastSig = null;
    // the knights we know: slide toward where they really are, tick the hurt flash, forget the silent
    const now = nowMs(), k = Math.min(1, dt / LERP_S);
    for (const n in REMOTE) {
      const e = REMOTE[n];
      if (now - e.lastAt > GONE_MS) { forget(n); continue; }
      e.shown.x += (e.x - e.shown.x) * k; e.shown.y += (e.y - e.shown.y) * k;
      if (e.moving) e.walkT += dt * 9;
      if (e.hurtT > 0) e.hurtT -= dt;
    }
    if (pressed.has('KeyF') && !player.dead) toggleFriends();
  });
  HOOKS.keyHelp.push({ action: 'Friends', codes: ['KeyF'] }); // 43-settings lists it on the Controls line

  // ---------- in: the wire ----------
  NET.on('welcome', () => { clearAll(); lastSig = null; lastSentAt = -1e9; });
  NET.on('offline', clearAll);
  NET.on('error', m => { if (m && m.code === 'elsewhere') { clearAll(); notify('Your knight was opened somewhere else.'); } }); // the same knight logged in from another device: the wire stops reconnecting
  NET.on('who', m => { ONLINE = m && Array.isArray(m.list) ? m.list.filter(o => o && typeof o.n === 'string') : []; });
  NET.on('left', m => { if (m && typeof m.n === 'string') forget(m.n); });
  NET.on('p', m => {
    if (!m || typeof m.n !== 'string' || m.n === me() || typeof m.x !== 'number' || typeof m.y !== 'number') return;
    const map = typeof m.map === 'string' ? m.map : 'over';
    let e = REMOTE[m.n];
    if (!e) e = REMOTE[m.n] = { n: m.n, map, x: m.x, y: m.y, shown: { x: m.x, y: m.y }, facing: { x: 1, y: 0 }, moving: false, walkT: 0, hp: 1, mhp: 1, lv: 1, look: null, mech: null, dead: false, act: null, hurtT: 0, attackT: 0, r: 13, lastAt: 0, role: 'player' };
    // the role is the world's word on every relayed p (the server overwrites whatever the sender claimed); anything else is a player
    e.role = m.role === 'admin' ? 'admin' : 'player';
    if (e.map !== map) { e.map = map; e.shown.x = m.x; e.shown.y = m.y; }   // a new map: no sliding across the world
    e.x = m.x; e.y = m.y;
    if (typeof m.fx === 'number' && typeof m.fy === 'number' && (m.fx || m.fy)) { e.facing.x = m.fx; e.facing.y = m.fy; }
    e.moving = !!m.mv; if (typeof m.wt === 'number') e.walkT = m.wt;
    if (typeof m.hp === 'number') { if (m.hp < e.hp && e.lastAt) e.hurtT = 0.25; e.hp = m.hp; }
    if (typeof m.mhp === 'number' && m.mhp > 0) e.mhp = m.mhp;
    if (typeof m.lv === 'number') e.lv = m.lv;
    if (m.look && typeof m.look === 'object') { e.look = m.look; if (e.look.tool) e.look.toolSwing = true; }
    e.mech = m.mech && typeof m.mech === 'object' ? m.mech : null; e.r = e.mech ? 20 : 13;
    e.dead = !!m.dead; e.act = typeof m.act === 'string' ? m.act : null; e.lastAt = nowMs();
  });

  // ---------- drawing: among the y-sorted world items, like a monster or the knight himself ----------
  function drawKnight(g, e) {
    const look = e.look || DEFAULT_LOOK, x = e.shown.x, y = e.shown.y, onMech = !!e.mech && e.mech.kind !== 'horse';
    g.save(); g.translate(x, y);
    if (e.dead) { g.globalAlpha = 0.3; g.rotate(1.4); drawHuman(g, e, look); g.restore(); return; }   // fallen: lying down and faint, as the knight himself is
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, onMech ? 14 : 11, onMech ? 22 : 12, onMech ? 9 : 6, 0, 0, 7); g.fill();
    if (onMech) drawMech(g, e, e.hurtT > 0, look);
    else { g.translate(0, e.moving ? Math.sin(e.walkT) * 2 : 0); drawHuman(g, e, look); }
    g.restore();
    // the name, the level in smaller grey after it, an hp bar when hurt, a ring when close enough to hand things over.
    // An admin's tag row starts with the gold ADMIN pill and the name is gold; the level stays.
    const top = Math.round(y) - (onMech ? 46 : 33), lv = 'lv ' + e.lv, admin = isAdmin(e);
    g.font = 'bold 8px sans-serif'; const pw = admin ? Math.ceil(g.measureText('ADMIN').width) + 8 + 4 : 0;
    g.font = 'bold 11px sans-serif'; const nw = g.measureText(e.n).width;
    g.font = '9px sans-serif'; const lw = g.measureText(lv).width;
    const x0 = Math.round(x - (pw + nw + 4 + lw) / 2), nx = x0 + pw;
    if (admin) adminPill(g, x0, top - 4, 8);
    g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.font = 'bold 11px sans-serif'; g.strokeText(e.n, nx, top); g.fillStyle = admin ? GOLD : '#ffffff'; g.fillText(e.n, nx, top);
    g.font = '9px sans-serif'; g.strokeText(lv, nx + nw + 4, top); g.fillStyle = '#9aa3b2'; g.fillText(lv, nx + nw + 4, top);
    if (e.hp < e.mhp) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x - 14, top + 3, 28, 4); g.fillStyle = e.hp / e.mhp > 0.5 ? '#3fb950' : e.hp / e.mhp > 0.25 ? '#d29922' : '#f85149'; g.fillRect(x - 14, top + 3, 28 * clamp(e.hp / e.mhp, 0, 1), 4); }
    if (dist(x, y, player.x, player.y) <= NEAR) { g.strokeStyle = 'rgba(111,177,255,0.5)'; g.lineWidth = 1.5; g.setLineDash([4, 4]); g.beginPath(); g.arc(x, y + 2, onMech ? 30 : 22, 0, 7); g.stroke(); g.setLineDash([]); }
  }
  HOOKS.draw.push((g, items) => {
    const my = mapId();
    for (const n in REMOTE) {
      const e = REMOTE[n];
      if (e.map !== my) continue;
      const x = e.shown.x, y = e.shown.y;
      if (x < cam.x - 80 || x > cam.x + VW + 80 || y < cam.y - 80 || y > cam.y + VH + 80) continue;
      items.push({ y: y + 13, who: n, draw: () => drawKnight(g, e) });
    }
  });

  // ---------- the HUD: friends on the minimap, the follow arrow, the ONLINE chip ----------
  HOOKS.hud.push(g => {
    if (paused) return;
    const my = mapId();
    // blue dots on the minimap for the friends on this map (the core painted it just before the hooks run)
    const mm = minimapRect;
    if (mm && !(window.SETTINGS && SETTINGS.get('minimap') === false)) {
      const size = mm.w, { scale, sx, sy } = miniWindow(size);   // the core's window: inside an instance it is the instance's
      const at = e => ({ x: mm.x + (e.shown.x / TILE - sx) * scale, y: mm.y + (e.shown.y / TILE - sy) * scale });
      let any = false;
      for (const n in REMOTE) if (REMOTE[n].map === my) { any = true; break; }
      if (any) {
        g.save(); g.beginPath(); g.arc(mm.x + size / 2, mm.y + size / 2, size / 2, 0, 7); g.clip();   // the ring's round glass (src/59-hudkit.js)
        for (const n in REMOTE) { const e = REMOTE[n]; if (e.map !== my) continue; const p = at(e); g.fillStyle = BLUE; g.beginPath(); g.arc(p.x, p.y, 3, 0, 7); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 1.2; g.stroke(); }
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(mm.x + (player.x / TILE - sx) * scale, mm.y + (player.y / TILE - sy) * scale, 3.5, 0, 7); g.fill(); // the knight stays on top
        g.restore();
      }
      // following someone: a ring on them when they are on the little map, a blue arrow at its edge when they are not
      const f = following && REMOTE[following];
      if (f && f.map === my) {
        // the glass is round (src/59-hudkit.js): the friend is "on the map" inside its circle, and the arrow rides its edge
        const ccx = mm.x + size / 2, ccy = mm.y + size / 2, p = at(f), inside = Math.hypot(p.x - ccx, p.y - ccy) < size / 2 - 8;
        g.strokeStyle = BLUE; g.lineWidth = 2;
        if (inside) { g.beginPath(); g.arc(p.x, p.y, 5 + Math.sin(time * 4) * 1.5, 0, 7); g.stroke(); }
        else {
          const ang = Math.atan2(p.y - ccy, p.x - ccx), kk = size / 2 - 9;
          g.save(); g.translate(ccx + Math.cos(ang) * kk, ccy + Math.sin(ang) * kk); g.rotate(ang);
          g.fillStyle = BLUE; g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, -6); g.lineTo(-2, 0); g.lineTo(-5, 6); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.stroke(); g.restore();
        }
      }
    }
  });
  // FRIENDS is a seal in the kit's seal row (src/59-hudkit.js): blue wax with a brass badge counting the knights online,
  // grey wax while the wire is down, only on the online build. It opens Friends (F); it wears a green halo while open.
  hudSeal('friends', () => ({
    show: !!NET.enabled, wax: NET.online() ? 'blue' : 'grey', badge: NET.online() ? String(ONLINE.length) : null,
    on: panel === 'friends', action: toggleFriends, name: NET.online() ? `Friends: ${ONLINE.length} online` : 'Offline',
  }));
  // ---------- the world map: every friend on this map as a named blue dot (drawn after the core's map, so it wraps drawPanels) ----------
  // The map image's rect is read from the buttons[] entry labelled 'mapimage' (10-hud keeps it exactly the image; 61-markers
  // cuts its foot back to where the key strip starts), so the dots follow the map wherever the panel puts it.
  const mapImage = () => { const b = buttons.find(q => q.label === 'mapimage'); return b ? { x: b.x, y: b.y, w: b.w, h: b.h } : null; };
  const MAP_DOTS = [];   // this frame's dots, for the self-test: { n, x, y }
  function drawMapFriends(g, narrow) {
    MAP_DOTS.length = 0;
    // where 10-hud drew the map this frame (mapLayout: inside an instance only the instance, centred in the box)
    const L = mapLayout, r = mapImage(); if (!panelRect || !L || !r || r.w <= 0 || r.h <= 0) return;
    const { ox, oy, sc } = L, my = mapId(), f = HK.FC(800, narrow ? 11 : 12);
    g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
    for (const n in REMOTE) {
      const e = REMOTE[n]; if (e.map !== my) continue;
      const x = ox + e.shown.x / TILE * sc, y = oy + e.shown.y / TILE * sc;
      if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
      g.fillStyle = BLUE; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.stroke();
      HK.text(g, n, x, y - 9, { font: f, align: 'center', color: BLUE, halo: 3 });
      MAP_DOTS.push({ n, x, y });
    }
    g.restore();
  }
  { const _drawPanels = drawPanels; drawPanels = function (g, narrow, short, qh, hb) { const r = _drawPanels(g, narrow, short, qh, hb); if (panel === 'map') drawMapFriends(g, narrow); return r; }; }
  // Follow on map: a gold target on the world map with the friend's name, like a quest marker, while they are on our map
  // in the same instance the ring goes on that instance's map (13-ux lists only this map's targets)
  HOOKS.mapTarget.push(() => { const e = following && REMOTE[following], my = mapId(); if (!e || e.map !== my) return null; return { x: Math.floor(e.shown.x / TILE), y: Math.floor(e.shown.y / TILE), label: following, id: 'friend', map: my === 'over' ? null : my }; });

  // ---------- gifts ----------
  let lastGiftAt = -1e9; const pending = [];   // [{ to, id, qty }] gifts the world has not answered yet
  function give(to, id, qty) {
    qty = Math.floor(+qty || 0);
    if (!NET.online()) { notify('You are not connected.'); return false; }
    if (!near(to)) { notify('Walk up to ' + to + ' first.'); return false; }
    if (time - lastGiftAt < GIFT_EVERY) { notify('One thing at a time.'); return false; }
    if (!ITEMS[id] || qty < 1 || countItem(id) < qty) return false;
    const took = removeItem(id, qty);
    if (took < qty) { if (took) addItem(id, took); return false; }
    if (!NET.send({ t: 'gift', to, id, qty })) { addItem(id, qty); notify('That did not go through. Try again.'); return false; }
    lastGiftAt = time; pending.push({ to, id, qty }); while (pending.length > 20) pending.shift();
    notify(`Handing ${qty} ${ITEMS[id].name} to ${to}…`); sfx('ui'); save();
    return true;
  }
  const takePending = (id, qty) => { const i = pending.findIndex(p => p.id === id && p.qty === qty); return i >= 0 ? pending.splice(i, 1)[0] : null; };
  NET.on('gift_ok', m => { const p = m ? takePending(m.id, m.qty) : null; floatText(player.x, player.y - 30, 'Given to ' + (p ? p.to : 'your friend'), BLUE); sfx('coins'); });
  NET.on('gift_back', m => {
    if (!m || !ITEMS[m.id] || !(m.qty >= 1)) return;
    const p = takePending(m.id, m.qty);
    giveOrDrop(m.id, m.qty, player.x, player.y, true);
    notify((p ? p.to : 'Your friend') + ' could not take it.'); save();
  });
  NET.on('gift', m => {
    if (!m) return;
    if (!ITEMS[m.id] || !(m.qty >= 1) || !canFit(m.id, m.qty)) { NET.send({ t: 'gift_no', gid: m.gid }); if (ITEMS[m.id]) notify('Your pack is full. ' + (m.from || 'A friend') + ' keeps the ' + ITEMS[m.id].name + '.'); return; }
    addItem(m.id, m.qty);
    notify(`${m.from || 'A friend'} gave you ${m.qty} ${ITEMS[m.id].name}`); floatText(player.x, player.y - 30, `+${m.qty} ${ITEMS[m.id].name}`, ITEMS[m.id].color);
    sfx('pickup'); NET.send({ t: 'gift_ok', gid: m.gid }); save();
  });

  // ---------- the Friends panel ----------
  // The book's frame (panelBox), then one vellum row per friend: the name in friend blue with the exact level, where they
  // are in words (whole words, never cut), and Give / Follow on map as iron plates one kit row tall (HK.row(): 44 px on
  // touch). On a narrow phone the plates drop under the words. Chat log sits at the top; Prev / Next when the list runs over.
  const T = () => HK.T;
  function friendRows(g, list, iw, narrow) {
    const bh = HK.row(), bw1 = 70, bw2 = narrow ? 104 : 136, btnW = bw1 + 8 + bw2;
    const twoTier = iw - 24 - btnW - 12 < 170;
    const textW = twoTier ? iw - 24 : iw - 24 - btnW - 12, wf = HK.FS(600, 12), lh = Math.round(15 * HK.k() * 10) / 10;
    return list.map(o => {
      const here = o.map === mapId();
      const where = HK.wrap(g, (here ? 'On your map: ' : '') + whereOf(o), textW, 2, wf).lines;
      const textH = 12 + 16 + where.length * lh + 8;
      const h = twoTier ? textH + bh + 12 : Math.max(bh + 16, textH);
      return { o, here, where, h, twoTier, textW, bw1, bw2, lh, wf };
    });
  }
  HOOKS.panel.friends = (g, narrow) => {
    const meN = me(), list = ONLINE.filter(o => o.n !== meN), on = NET.online();
    const room = panelRoom(narrow ? 400 : 500, VH), w = room.w, iw = w - 36, bh = HK.row();
    const top = 62 + bh + 12, foot = 44, pagerH = bh + 14;
    const rows = friendRows(g, list, iw, narrow), gap = 8;
    // pages: as many rows as fit the room (with a pager when they do not all fit)
    const all = rows.reduce((a, r) => a + r.h + gap, 0), fits = top + all + foot <= room.h;
    const avail = room.h - top - foot - (fits ? 0 : pagerH), pagesL = [[]]; let used = 0;
    for (const r of rows) { if (used + r.h > avail && pagesL[pagesL.length - 1].length) { pagesL.push([]); used = 0; } pagesL[pagesL.length - 1].push(r); used += r.h + gap; }
    const pages = pagesL.length; friendsPage = clamp(friendsPage, 0, pages - 1);
    const page = pagesL[friendsPage], pageH = Math.max(...pagesL.map(pg => pg.reduce((a, r) => a + r.h + gap, 0)), 40);
    const h = Math.min(room.h, top + pageH + foot + (pages > 1 ? pagerH : 0));
    const { px, py } = panelBox(g, w, h, 'Friends online', on ? `${ONLINE.length} knight${ONLINE.length === 1 ? '' : 's'} in the Fanglands right now` : 'Not connected right now');
    const x0 = px + 18;
    platePush(g, x0, py + 62, Math.min(iw, touchMode() ? 150 : 136), bh, 'Chat log', 'Chat log', () => openPanel('chatlog'), null, { emblem: 'chat', name: 'The chat log' });
    let y = py + top;
    if (!page.length) HK.text(g, on ? 'Nobody else is on right now.' : 'You are not connected.', x0, y + 22, { font: HK.FS(600, 13), color: T().inkDim, box: { x: x0, y, w: iw, h: 40 }, fitId: 'friends:none' });
    for (const r of page) {
      const o = r.o, close = near(o.n), fol = following === o.n;
      HK.vellumPlate(g, x0, y, iw, r.h, { edge: r.here ? 'rgba(111,177,255,0.55)' : null });
      const tx = x0 + 12, nf = HK.FC(800, 14), lv = `Lv ${o.lv || 1}`;
      const nameTop = r.twoTier ? y + 12 : y + Math.max(12, (r.h - (16 + r.where.length * r.lh + 8)) / 2);
      // the name in friend blue, or gold with the ADMIN pill after it for an admin (docs/ONLINE.md, "Roles"), then the level
      const admin = isAdmin(o), nwid = HK.tw(g, o.n, nf);
      HK.text(g, o.n, tx, nameTop + 13, { font: nf, color: admin ? GOLD : T().friend, shadow: 'rgba(0,0,0,0.9)', box: { x: tx, y, w: r.textW, h: r.h }, fitId: 'friends:name' });
      const pillW = admin ? adminPill(g, tx + nwid + 6, nameTop + 8, 9) + 6 : 0;
      HK.text(g, lv, tx + nwid + 8 + pillW, nameTop + 13, { font: HK.FC(800, 12), color: T().inkDim, box: { x: tx, y, w: r.textW, h: r.h }, fitId: 'friends:lv' });
      r.where.forEach((l, i) => HK.text(g, l, tx, nameTop + 16 + (i + 1) * r.lh, { font: r.wf, color: r.here ? T().ink : T().inkDim, box: { x: tx, y, w: r.textW, h: r.h }, fitId: 'friends:where' }));
      const by = r.twoTier ? y + r.h - bh - 10 : y + (r.h - bh) / 2, bx1 = x0 + iw - 12 - r.bw1, bx2 = bx1 - 8 - r.bw2;
      platePush(g, bx1, by, r.bw1, bh, 'Give', 'Give', () => { giftPage = 0; openPanel('gift', o.n); }, 'primary', { enabled: close, name: close ? `Give something to ${o.n}` : `Walk up to ${o.n} to give` });
      const fl = fol ? (narrow ? 'Following' : 'Stop following') : (narrow ? 'Follow' : 'Follow on map');
      platePush(g, bx2, by, r.bw2, bh, fl, fl, () => { following = fol ? null : o.n; sfx('open'); }, fol ? 'warn' : null, { enabled: r.here, name: fol ? `Stop following ${o.n}` : `Mark ${o.n} on the map` });
      y += r.h + gap;
    }
    const note = 'Give works when you stand within two tiles of a friend.' + (touchMode() ? '' : ' F opens this panel.');
    const nf2 = HK.FS(600, 12), nl = HK.wrap(g, note, iw, 2, nf2).lines, ny = py + h - (pages > 1 ? pagerH : 0) - foot + 16;
    nl.forEach((l, i) => HK.text(g, l, x0, ny + i * Math.round(15 * HK.k()), { font: nf2, color: T().inkMute, box: { x: x0, y: ny - 14, w: iw, h: foot }, fitId: 'friends:note' }));
    if (pages > 1) rowPager(g, x0, py + h - pagerH, iw, friendsPage, pages, p => { friendsPage = p; });
  };

  // ---------- the gift picker: the pack's stacks, one tap each ----------
  // Vellum rows with the item's picture, its name and how many you have (exact), and Give 1 / Give all plates one kit row
  // tall. Valuables ask twice. Prev / Next when the pack runs over the screen.
  HOOKS.panel.gift = (g, narrow) => {
    const to = String(panelArg || '');
    const stacks = []; for (const s of player.inv) if (s && s.qty > 0 && ITEMS[s.id]) stacks.push(s);
    const room = panelRoom(narrow ? 390 : 460, VH), w = room.w, iw = w - 36, bh = HK.row(), gap = 8;
    const b1 = 78, b2 = 90, nf = HK.FC(800, 13), cf = HK.FS(600, 12), lh = Math.round(15 * HK.k() * 10) / 10;
    const rows = stacks.map(s => {
      const def = ITEMS[s.id], many = s.qty > 1, oneW = iw - 12 - 40 - (many ? b1 + 8 : 0) - b2 - 12 - 8;
      // too little room beside the plates (a narrow phone): the plates drop under the words
      const twoTier = oneW < 130, textW = twoTier ? iw - 12 - 40 - 12 : oneW;
      const name = HK.wrap(g, def.name, textW, 2, nf).lines, textH = 12 + name.length * 16 + lh + 8;
      return { s, def, many, textW, name, twoTier, textH, h: twoTier ? textH + bh + 10 : Math.max(bh + 14, textH) };
    });
    const top = 64, foot = 12, pagerH = bh + 14;
    const all = rows.reduce((a, r) => a + r.h + gap, 0), fits = top + Math.max(all, 40) + foot <= room.h;
    const avail = room.h - top - foot - (fits ? 0 : pagerH), pagesL = [[]]; let used = 0;
    for (const r of rows) { if (used + r.h > avail && pagesL[pagesL.length - 1].length) { pagesL.push([]); used = 0; } pagesL[pagesL.length - 1].push(r); used += r.h + gap; }
    const pages = pagesL.length; giftPage = clamp(giftPage, 0, pages - 1);
    const page = pagesL[giftPage], pageH = Math.max(...pagesL.map(pg => pg.reduce((a, r) => a + r.h + gap, 0)), 40);
    const h = Math.min(room.h, top + pageH + foot + (pages > 1 ? pagerH : 0));
    const ok = near(to) && NET.online();
    const tap = touchMode() ? 'Tap' : 'Click';
    const { px, py } = panelBox(g, w, h, 'Give to ' + to, ok ? `${tap} what to hand over. It leaves your pack and lands in theirs.` : 'Walk up to ' + to + ' first (within two tiles).');
    const x0 = px + 18; let y = py + top;
    if (!page.length) HK.text(g, 'Your pack is empty.', x0, y + 22, { font: HK.FS(600, 13), color: T().inkDim, box: { x: x0, y, w: iw, h: 40 }, fitId: 'gift:none' });
    for (const r of page) {
      const s = r.s, def = r.def, mid = r.twoTier ? y + r.textH / 2 : y + r.h / 2;
      HK.vellumPlate(g, x0, y, iw, r.h);
      drawItemIcon(g, s.id, x0 + 30, mid, 18);
      const tx = x0 + 52, textTop = mid - (r.name.length * 16 + lh) / 2;
      r.name.forEach((l, i) => HK.text(g, l, tx, textTop + 13 + i * 16, { font: nf, color: T().ink, shadow: 'rgba(0,0,0,0.9)', box: { x: tx, y, w: r.textW, h: r.h }, fitId: 'gift:name' }));
      HK.text(g, `You have ${s.qty}`, tx, textTop + r.name.length * 16 + lh - 1, { font: cf, color: T().inkDim, box: { x: tx, y, w: r.textW, h: r.h }, fitId: 'gift:qty' });
      const arm = needsConfirm(def) && confirmActive('gift:' + s.id);
      const giveN = qty => { const go = () => { if (give(to, s.id, qty)) closePanel(); }; if (needsConfirm(def)) confirmTap('gift:' + s.id, go); else go(); };
      // the drawn word stays Give 1 / Give all; the harness finds each button by its key give:<item>:<1|all>
      const bx2 = x0 + iw - 12 - b2, by = r.twoTier ? y + r.h - bh - 10 : mid - bh / 2;
      if (r.many) platePush(g, bx2 - 8 - b1, by, b1, bh, 'give:' + s.id + ':1', 'Give 1', () => giveN(1), 'primary', { enabled: ok, name: `Give 1 ${def.name}` });
      platePush(g, bx2, by, b2, bh, 'give:' + s.id + ':all', arm ? 'Tap again' : r.many ? 'Give all' : 'Give', () => giveN(s.qty), arm ? 'danger' : 'primary', { enabled: ok, name: `Give ${r.many ? 'all ' + s.qty : 'the'} ${def.name}` });
      y += r.h + gap;
    }
    if (pages > 1) rowPager(g, x0, py + h - pagerH, iw, giftPage, pages, p => { giftPage = p; });
  };

  // what the world says a knight is: their last presence, else the roster, else a player
  const roleOf = n => { const e = REMOTE[n]; if (e) return isAdmin(e) ? 'admin' : 'player'; const o = ONLINE.find(k => k.n === n); return isAdmin(o) ? 'admin' : 'player'; };

  window.PLAYERS = {
    lookOf, presence, mapId, remote: REMOTE, near, give, roleOf, adminPill, GOLD,
    get online() { return ONLINE; }, get me() { return NET.me; },
    follow: n => { following = n && REMOTE[n] ? n : null; }, get following() { return following; },
  };

  // ---------- self-test ----------
  const P = 'players: ';
  HOOKS.selfTest.push((check, F, h) => {
    const was = { enabled: NET.enabled, token: NET.token, fake: NET.fake };
    const made = [];
    const fake = {
      call: async () => ({}),
      open: () => { const s = { readyState: 1, sent: [], send(str) { const m = JSON.parse(str); s.sent.push(m); if (m.t === 'hello') s.onmessage({ data: JSON.stringify({ t: 'welcome', me: 'Cohen', at: 1, keeper: 'Cohen' }) }); }, close() { s.readyState = 3; if (s.onclose) s.onclose(); } }; made.push(s); return s; },
    };
    NET.disconnect(); NET.enabled = true; NET.token = 'players-test'; NET.useFake(fake); NET.connect();
    const sock = made[0], feed = m => sock.onmessage({ data: JSON.stringify(m) });
    const ps = () => sock.sent.filter(m => m.t === 'p'), lastP = () => { const l = ps(); return l[l.length - 1]; };
    const dc = dialog.cur, dq = dialog.queue.slice(); dialog.cur = null; dialog.queue.length = 0;
    const mech0 = player.mech, r0 = player.r; player.mech = null; player.r = 13;
    closePanel(); h.peace(true); player.hp = player.maxHp; const o = h.openSpot(40, 24); F.tp(o.x, o.y); F.step([]);
    // presence out, with the contract's fields, at most 8 a second while moving and about once a second when still
    { F.sim(12, ['KeyD']); const p = lastP();
      const fields = p && ['map', 'region', 'x', 'y', 'fx', 'fy', 'mv', 'wt', 'hp', 'mhp', 'lv', 'look', 'mech', 'dead', 'def', 'act'].every(k => k in p);
      const shaped = !!p && p.map === 'over' && typeof p.region === 'string' && p.region.length > 0 && typeof p.x === 'number' && typeof p.y === 'number' && typeof p.mv === 'boolean' && p.lv === combatLevel() && p.def === playerDefRoll() && p.mech === null && p.dead === false && p.act === null
        && !!p.look && typeof p.look.tunic === 'string' && typeof p.look.hair === 'string' && typeof p.look.shoulder === 'string' && (p.look.weapon ? typeof p.look.weapon.shape === 'string' && typeof p.look.weapon.color === 'string' : p.look.fists === true);
      const n0 = ps().length; F.sim(30, ['KeyD']); F.sim(30, ['KeyA']); const moving = ps().length - n0; const n1 = ps().length; player.hp = player.maxHp; F.sim(120, []); const still = ps().length - n1;
      check(P + 'presence goes out with the contract fields, at most 8 a second while moving and about once a second when still', fields && shaped && moving >= 2 && moving <= 9 && still >= 1 && still <= 4, { fields, shaped, moving, still, p: p && { map: p.map, x: p.x, y: p.y, mv: p.mv, lv: p.lv, act: p.act, look: p.look } }); }
    // inside an instance the map is the instance id, and it is 'over' again outside
    { const id = INSTANCES.list().includes('spider_den') ? 'spider_den' : INSTANCES.list()[0]; const entered = INSTANCES.enter(id); F.sim(12, []); const inside = lastP(); const left = INSTANCES.leave(); F.sim(12, []); const outside = lastP();
      const instRegion = !!inside && inside.region === INSTANCES.get(id).name;
      check(P + 'presence carries the instance id as the map (and its name as the region) inside a dungeon, and over again outside', entered && !!inside && inside.map === id && instRegion && left && !!outside && outside.map === 'over' && outside.region !== INSTANCES.get(id).name, { entered, inside: inside && [inside.map, inside.region], left, outside: outside && [outside.map, outside.region], id });
      dialog.cur = null; dialog.queue.length = 0; F.tp(o.x, o.y); }
    // a knight arrives on our map and is drawn; one on another map is not
    { const look = { tunic: '#a33', hair: '#222', shoulder: '#999', helm: null, body: null, shield: null, weapon: { shape: 'sword', color: '#ccc' }, tool: null, toolColor: null, rod: false, fists: false };
      feed({ t: 'p', n: 'Ava', map: 'over', x: player.x + 40, y: player.y, fx: -1, fy: 0, mv: true, wt: 3, hp: 20, mhp: 25, lv: 7, look, mech: null, dead: false, def: 100, act: null });
      feed({ t: 'p', n: 'Ben', map: 'spider_den', x: player.x - 40, y: player.y, fx: 1, fy: 0, mv: false, wt: 0, hp: 25, mhp: 25, lv: 3, look, mech: { kind: 'walker', hp: 100, maxHp: 130 }, dead: false, def: 90, act: 'chop' });
      F.step([]); render();
      const items = []; for (const hk of HOOKS.draw) hk(ctx, items, cam);
      const ava = items.find(it => it.who === 'Ava'), ben = items.find(it => it.who === 'Ben');
      let drew = false; try { if (ava) { ava.draw(); drew = true; } } catch (e) { drew = String(e && e.message); }
      // a mech rider and a fallen knight draw too (Ben, moved onto our map for a moment)
      let drew2 = true; try { REMOTE.Ben.map = 'over'; const it2 = []; for (const hk of HOOKS.draw) hk(ctx, it2, cam); const b = it2.find(it => it.who === 'Ben'); if (b) b.draw(); REMOTE.Ben.dead = true; if (b) b.draw(); REMOTE.Ben.dead = false; REMOTE.Ben.map = 'spider_den'; } catch (e) { drew2 = String(e && e.message); }
      const slid = REMOTE.Ava && Math.abs(REMOTE.Ava.shown.x - REMOTE.Ava.x) < 0.5;
      check(P + 'a knight on your map is drawn among the world items (with a mech or fallen too); one on another map is not', !!REMOTE.Ava && !!REMOTE.Ben && !!ava && !ben && drew === true && drew2 === true && slid, { ava: !!ava, ben: !!ben, drew, drew2, slid }); }
    // the roster, the chip, the panel and the F key
    { feed({ t: 'who', list: [{ n: 'Cohen', map: 'over', region: 'Thistledown', lv: 5 }, { n: 'Ava', map: 'over', region: 'The Wilds', lv: 7 }, { n: 'Ben', map: 'spider_den', region: 'The Spider Den', lv: 3 }] });
      closePanel(); render(); const chip = buttons.find(b => b.label === 'friends' && b.badge === '3'); if (chip) chip.action(); render();
      const opened = panel === 'friends', give = buttons.find(b => /^(disabled:)?Give$/.test(b.label)), giveOn = !!give && !give.disabled, follow = buttons.find(b => /Follow/.test(b.label)), benFollow = buttons.filter(b => /Follow/.test(b.label))[1];
      if (follow) follow.action(); const followed = PLAYERS.following === 'Ava'; render(); const stop = buttons.find(b => /Stop following|Following/.test(b.label)); const target = mapTargets().find(t => t.id === 'friend'); if (stop) stop.action();
      closePanel(); F.press('KeyF'); const byKey = panel === 'friends'; F.press('KeyF'); const closed = panel === null;
      check(P + 'the FRIENDS seal (its badge counting the 3 knights online) is a button that opens Friends (F does too): Give is live within two tiles, Follow marks a friend on the map', !!chip && opened && giveOn && !!follow && !follow.disabled && !!benFollow && benFollow.disabled && followed && !!stop && !!target && target.label === 'Ava' && PLAYERS.following === null && byKey && closed, { chip: !!chip, opened, giveOn, follow: follow && follow.label, ben: benFollow && benFollow.label, followed, stop: !!stop, target, byKey, closed }); }
    // gifts: out of the pack and onto the wire; back into the pack when the world sends it back; a friend's gift lands
    { const inv0 = player.inv.map(s => s ? { ...s } : null);
      feed({ t: 'p', n: 'Ava', map: 'over', x: player.x + 40, y: player.y, fx: -1, fy: 0, mv: false, wt: 0, hp: 25, mhp: 25, lv: 7, look: null, mech: null, dead: false, def: 100, act: null }); F.step([]);
      player.inv = new Array(INV_SLOTS).fill(null); addItem('stone', 3); addItem('wood', 2);
      openPanel('gift', 'Ava'); render(); const tapped = F.clickButton('give:stone:all');
      const g1 = sock.sent.filter(m => m.t === 'gift'); const went = g1.length === 1 && g1[0].to === 'Ava' && g1[0].id === 'stone' && g1[0].qty === 3 && countItem('stone') === 0 && panel === null;
      feed({ t: 'gift_back', gid: 1, id: 'stone', qty: 3 }); const back = countItem('stone') === 3 && !!notice && /Ava could not take it/.test(notice.text);
      const tooSoon = !PLAYERS.give('Ava', 'wood', 1); F.sim(70, []); const again = PLAYERS.give('Ava', 'wood', 1) && countItem('wood') === 1;
      const fl0 = floaters.length; feed({ t: 'gift_ok', gid: 2, id: 'wood', qty: 1 }); const thanked = floaters.length === fl0 + 1 && /Given to Ava/.test(floaters[floaters.length - 1].text);
      feed({ t: 'gift', gid: 9, from: 'Ava', id: 'coal', qty: 2 }); const got = countItem('coal') === 2 && sock.sent.some(m => m.t === 'gift_ok' && m.gid === 9) && !!notice && /Ava gave you 2/.test(notice.text);
      player.inv = new Array(INV_SLOTS).fill(null).map(() => ({ id: 'iron_dagger', qty: 1 })); feed({ t: 'gift', gid: 10, from: 'Ava', id: 'coal', qty: 1 }); const refused = sock.sent.some(m => m.t === 'gift_no' && m.gid === 10);
      player.inv = inv0; notice = null;
      check(P + 'a gift leaves the pack and goes out; gift_back puts it back with a word; gift_ok floats thanks; a gift that fits lands and one that does not is refused', tapped && went && back && tooSoon && again && thanked && got && refused, { tapped, went, back, tooSoon, again, thanked, got, refused }); }
    // left, and silence
    { feed({ t: 'left', n: 'Ava', map: 'over' }); const gone = !REMOTE.Ava; if (REMOTE.Ben) REMOTE.Ben.lastAt = nowMs() - 7000; F.step([]); const timedOut = !REMOTE.Ben;
      feed({ t: 'p', n: 'Cal', map: 'over', x: player.x, y: player.y + 40, fx: 0, fy: -1, mv: false, wt: 0, hp: 9, mhp: 25, lv: 2, look: null, mech: null, dead: false, def: 50, act: null });
      const n0 = notice; feed({ t: 'error', code: 'elsewhere', text: 'opened elsewhere' }); const elsewhere = !REMOTE.Cal && !!notice && notice.text === 'Your knight was opened somewhere else.'; notice = n0;
      check(P + "'left' removes a knight at once; six seconds of silence removes one too; 'elsewhere' clears everyone and says so", gone && timedOut && elsewhere, { gone, timedOut, elsewhere }); }
    // roles: the world's word rides on every p; an admin's tag is the gold ADMIN pill and a gold name, a player's is neither
    { const rec = []; const st = {};
      const g2 = new Proxy(st, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 6 })) : k === 'fillText' ? ((s) => { rec.push({ text: String(s), fill: st.fillStyle }); }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: () => { } }) : (k in st ? st[k] : () => { }), set: (t, k, v) => { st[k] = v; return true; } });
      const at = { map: 'over', fx: -1, fy: 0, mv: false, wt: 0, hp: 20, mhp: 20, look: null, mech: null, dead: false, def: 100, act: null };
      feed(Object.assign({ t: 'p', n: 'Mud', x: player.x + 30, y: player.y, lv: 99, role: 'admin' }, at));
      feed(Object.assign({ t: 'p', n: 'Sam', x: player.x - 30, y: player.y, lv: 4, role: 'sneaky' }, at));
      feed({ t: 'who', list: [{ n: 'Cohen', map: 'over', region: 'Thistledown', lv: 5, role: 'player' }, { n: 'Mud', map: 'over', region: 'Thistledown', lv: 99, role: 'admin' }, { n: 'Sam', map: 'over', region: 'Thistledown', lv: 4 }] });
      F.step([]);
      const items = []; for (const hk of HOOKS.draw) hk(g2, items, cam);
      const mud = items.find(it => it.who === 'Mud'), sam = items.find(it => it.who === 'Sam');
      let drew = true;
      try { if (mud) mud.draw(); } catch (e) { drew = String(e && e.message); }
      const mudText = rec.splice(0);
      try { if (sam) sam.draw(); } catch (e) { drew = String(e && e.message); }
      const samText = rec.splice(0);
      const tagged = mudText.some(t => t.text === 'ADMIN') && mudText.some(t => t.text === 'Mud' && t.fill === GOLD);
      const plain = samText.length > 0 && !samText.some(t => t.text === 'ADMIN') && samText.some(t => t.text === 'Sam' && t.fill === '#ffffff');
      const roles = REMOTE.Mud.role === 'admin' && REMOTE.Sam.role === 'player' && PLAYERS.roleOf('Mud') === 'admin' && PLAYERS.roleOf('Sam') === 'player' && PLAYERS.roleOf('Nobody') === 'player';
      openPanel('friends'); let listed = false; try { HOOKS.panel.friends(g2, false); const drawn = rec.splice(0); listed = drawn.filter(t => t.text === 'ADMIN').length === 1 && drawn.some(t => t.text === 'Mud' && t.fill === GOLD) && drawn.some(t => t.text === 'Sam' && t.fill === HK.T.friend); } catch (e) { listed = String(e && e.message); } closePanel(); render();
      check(P + 'roles: an admin (the role on their p) gets the gold ADMIN pill and a gold name over the head and in the Friends list; a player, or anything else a p claims, gets neither', !!mud && !!sam && drew === true && tagged && plain && roles && listed === true, { mud: !!mud, sam: !!sam, drew, tagged, plain, roles, listed, mudText: mudText.map(t => t.text) }); }
    // a worn party hat rides in presence as look.hat (77-dropparty's playerLook wrapper sets the colour word); none is null
    { const _look = playerLook; let worn = null;
      try { playerLook = function () { const l = _look(); l.hat = 'purple'; return l; }; worn = [PLAYERS.lookOf().hat, PLAYERS.presence().look.hat]; } finally { playerLook = _look; }
      const bare = PLAYERS.lookOf().hat;
      check(P + "presence carries look.hat, the colour word, when a party hat is worn, and null when it is not", worn && worn[0] === 'purple' && worn[1] === 'purple' && bare === null, { worn, bare }); }
    // layout: the chip overlaps no other button at four screen sizes, in the touch layout and the desktop one. It reads
    // touchMode() (forced both ways here), not the device's isTouch, which is always false headless — so the touch
    // layout, the one the iPad and the phones use, is really tested. On touch it is also a full 44 px control and
    // stays out of the joystick's circle (05-input matches buttons before it starts the stick). Two frames per size: the
    // first frame after a size or layout change reads last frame's hotbar position (10-hud places its boss-bar row
    // before it publishes this frame's layout), and what matters is where the chip settles.
    { const vw0 = window.innerWidth, vh0 = window.innerHeight, t0 = window.__forceTouch, hits = [], sizes = []; const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const setSize = (w, hh) => { try { window.innerWidth = w; window.innerHeight = hh; } catch (e) { } render(); render(); return VW === w && VH === hh; };
      for (const t of [true, false]) {
        window.__forceTouch = t;
        for (const [w, hh, name] of [[390, 844, 'phone'], [844, 390, 'landscape'], [768, 1024, 'tablet'], [1280, 800, 'desktop']]) {
          closePanel(); if (!setSize(w, hh)) continue; const where = name + (t ? ' touch' : ' desktop'); sizes.push(where);
          const bs = buttons.filter(b => !b.offscreen && b.w > 0 && b.h > 0); const mine = bs.filter(b => b.label === 'friends');
          for (const a of mine) for (const b of bs) if (a !== b && overlap(a, b)) hits.push(where + ': ' + a.label + ' × ' + b.label);
          if (!mine.length) hits.push(where + ': no FRIENDS seal');
          if (t) for (const a of mine) {
            if (a.w < 44 || a.h < 44) hits.push(where + ': ' + a.label + ' is ' + Math.round(a.w) + 'x' + Math.round(a.h));
            const st = HK.cur().stick;   // the stick's keep-out circle, wherever Settings › Move stick side puts it
            if (st && Math.hypot(a.cx - st.x, a.cy - st.y) < a.r + st.keep) hits.push(where + ': ' + a.label + ' is inside the joystick');
          }
        }
      }
      window.__forceTouch = t0; setSize(vw0, vh0);
      check(P + 'the FRIENDS seal sits clear of every other button at phone, landscape, tablet and desktop sizes (on touch: 44 px, out of the stick)', hits.length === 0 && sizes.length === 8, { hits, sizes }); }
    // Friends and Give at all 8 device sizes, touch and mouse, normal and Large text, one page and several: from the close
    // seal on, controls 44 px on touch (26 with a mouse), 8 px apart (4), on screen, out of the notch and home bands, and
    // every word inside its row (names, levels and places whole; no '...' anywhere)
    { const restore = panelSizeSaver(), t0 = window.__forceTouch, text0 = SETTINGS.get('text'), inv0 = player.inv.map(q => q ? { ...q } : null), problems = []; let tried = 0, paged = 0;
      const names = ['Ava', 'Maximilian', 'Ben', 'Sam', 'Isabella', 'Theodore', 'Zoe', 'Oliver'];
      feed({ t: 'who', list: [{ n: 'Cohen', map: 'over', region: 'Thistledown', lv: 5 }].concat(names.map((n, i) => ({ n, map: i % 3 === 2 ? 'spider_den' : 'over', region: i % 2 ? 'The Whispering Woods' : 'Thistledown', lv: 3 + i * 11 }))) });
      feed({ t: 'p', n: 'Ava', map: 'over', x: player.x + 40, y: player.y, fx: -1, fy: 0, mv: false, wt: 0, hp: 25, mhp: 25, lv: 7, look: null, mech: null, dead: false, def: 100, act: null }); F.step([]);
      const bag = ['bronze_pickaxe', 'iron_ore', 'wood', 'bread', 'stone', 'coal', 'iron_sword', 'raw_shrimp', 'spider_silk', 'bronze_axe'].filter(id => ITEMS[id]);
      try {
        for (const [w, hh] of HK.audit.SIZES) {
          if (!panelSetSize(w, hh)) continue; tried++;
          for (const tch of [true, false]) for (const big of ['normal', 'large']) {
            window.__forceTouch = tch; SETTINGS.set('text', big);
            player.inv = new Array(INV_SLOTS).fill(null); bag.forEach((id, i) => { player.inv[i] = { id, qty: i % 2 ? 12 : 1 }; });
            for (const [pn, arg] of [['friends'], ['gift', 'Ava']]) {
              closePanel(); openPanel(pn, arg);
              for (let pg = 0; pg < 8; pg++) {
                if (pn === 'friends') friendsPage = pg; else giftPage = pg;
                const where = `${pn} ${w}x${hh} ${tch ? 'touch' : 'mouse'} ${big} page ${pg + 1}`;
                problems.push(...panelFrame(where));
                if (!buttons.some(b => b.label === 'Next')) break; paged++;
              }
            }
          }
        }
      } finally { closePanel(); friendsPage = 0; giftPage = 0; player.inv = inv0; window.__forceTouch = t0; SETTINGS.set('text', text0); restore(); render(); }
      const src = String(HOOKS.panel.friends) + String(HOOKS.panel.gift), dots = !/\u2026|…/.test(src);
      check(P + "Friends and Give at all 8 device sizes, touch and mouse, normal and Large text, every page: controls 44 px on touch (26 with a mouse) and 8 px apart (4), on screen, out of the bands; names, levels and places fit their vellum rows whole (no '...')", tried === 8 && problems.length === 0 && paged > 0 && dots, { tried, paged, dots, problems: problems.slice(0, 10), total: problems.length }); }
    // the world map: each friend on our map is a blue dot inside the map image (the 'mapimage' entry), named beside it
    { closePanel(); openPanel('map'); render(); const img = buttons.find(b => b.label === 'mapimage');
      const inside = !!img && MAP_DOTS.length >= 1 && MAP_DOTS.every(d => d.x >= img.x && d.x <= img.x + img.w && d.y >= img.y && d.y <= img.y + img.h);
      const ava = MAP_DOTS.find(d => d.n === 'Ava'), sc = img ? img.w / MAP_W : 0, right = !!ava && !!img && Math.abs(ava.x - (img.x + REMOTE.Ava.shown.x / TILE * sc)) < 0.5 && Math.abs(ava.y - (img.y + REMOTE.Ava.shown.y / TILE * sc)) < 0.5;
      closePanel();
      check(P + "on the world map a friend's dot lands inside the map image the 'mapimage' entry marks, at their place on it", inside && right, { dots: MAP_DOTS.slice(0, 3), img: img && [img.x, img.y, img.w, img.h], right }); }
    // put the world back
    NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
    clearAll(); lastSig = null; pending.length = 0; lastGiftAt = -1e9;
    player.mech = mech0; player.r = r0; dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq); closePanel(); h.peace(false); render();
  });
}
