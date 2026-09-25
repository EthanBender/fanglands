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
  const BLUE = '#7ec8ff';

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
    if (!e) e = REMOTE[m.n] = { n: m.n, map, x: m.x, y: m.y, shown: { x: m.x, y: m.y }, facing: { x: 1, y: 0 }, moving: false, walkT: 0, hp: 1, mhp: 1, lv: 1, look: null, mech: null, dead: false, act: null, hurtT: 0, attackT: 0, r: 13, lastAt: 0 };
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
    // the name, the level in smaller grey after it, an hp bar when hurt, a ring when close enough to hand things over
    const top = Math.round(y) - (onMech ? 46 : 33), lv = 'lv ' + e.lv;
    g.font = 'bold 11px sans-serif'; const nw = g.measureText(e.n).width;
    g.font = '9px sans-serif'; const lw = g.measureText(lv).width;
    const x0 = Math.round(x - (nw + 4 + lw) / 2);
    g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.font = 'bold 11px sans-serif'; g.strokeText(e.n, x0, top); g.fillStyle = '#ffffff'; g.fillText(e.n, x0, top);
    g.font = '9px sans-serif'; g.strokeText(lv, x0 + nw + 4, top); g.fillStyle = '#9aa3b2'; g.fillText(lv, x0 + nw + 4, top);
    if (e.hp < e.mhp) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x - 14, top + 3, 28, 4); g.fillStyle = e.hp / e.mhp > 0.5 ? '#3fb950' : e.hp / e.mhp > 0.25 ? '#d29922' : '#f85149'; g.fillRect(x - 14, top + 3, 28 * clamp(e.hp / e.mhp, 0, 1), 4); }
    if (dist(x, y, player.x, player.y) <= NEAR) { g.strokeStyle = 'rgba(126,200,255,0.45)'; g.lineWidth = 1.5; g.setLineDash([4, 4]); g.beginPath(); g.arc(x, y + 2, onMech ? 30 : 22, 0, 7); g.stroke(); g.setLineDash([]); }
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
      const size = mm.w, tilesAcross = 44, scale = size / tilesAcross;
      const sx = clamp(player.x / TILE - tilesAcross / 2, 0, MAP_W - tilesAcross), sy = clamp(player.y / TILE - tilesAcross / 2, 0, MAP_H - tilesAcross);
      const at = e => ({ x: mm.x + (e.shown.x / TILE - sx) * scale, y: mm.y + (e.shown.y / TILE - sy) * scale });
      let any = false;
      for (const n in REMOTE) if (REMOTE[n].map === my) { any = true; break; }
      if (any) {
        g.save(); g.beginPath(); g.arc(mm.x + size / 2, mm.y + size / 2, size / 2, 0, 7); g.clip();   // the ring's round glass (src/59-hudkit.js)
        for (const n in REMOTE) { const e = REMOTE[n]; if (e.map !== my) continue; const p = at(e); g.fillStyle = BLUE; g.beginPath(); g.arc(p.x, p.y, 2.6, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.stroke(); }
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
  function drawMapFriends(g, narrow) {
    const r = panelRect; if (!r) return;
    const iw = r.w - 36, ih = Math.min(r.h - 80, iw * MAP_H / MAP_W), ix = r.x + 18, iy = r.y + 62, sc = iw / MAP_W, my = mapId();
    g.save(); roundRect(g, ix, iy, iw, ih, 8); g.clip();
    g.font = `bold ${narrow ? 9 : 11}px sans-serif`; g.textAlign = 'center';
    for (const n in REMOTE) {
      const e = REMOTE[n]; if (e.map !== my) continue;
      const x = ix + e.shown.x / TILE * sc, y = iy + e.shown.y / TILE * sc;
      g.fillStyle = BLUE; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 1.5; g.stroke();
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(n, x, y - 8); g.fillStyle = BLUE; g.fillText(n, x, y - 8);
    }
    g.restore();
  }
  { const _drawPanels = drawPanels; drawPanels = function (g, narrow, short, qh, hb) { const r = _drawPanels(g, narrow, short, qh, hb); if (panel === 'map') drawMapFriends(g, narrow); return r; }; }
  // Follow on map: a gold target on the world map with the friend's name, like a quest marker, while they are on our map
  HOOKS.mapTarget.push(() => { const e = following && REMOTE[following]; if (!e || e.map !== mapId()) return null; return { x: Math.floor(e.shown.x / TILE), y: Math.floor(e.shown.y / TILE), label: following, id: 'friend' }; });

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
  HOOKS.panel.friends = (g, narrow) => {
    const my = mapId(), meN = me();
    const list = ONLINE.filter(o => o.n !== meN);
    // every button here is one kit row tall (HK.row(): 44 px on touch), so the rows and the header grow to hold them
    const bh = HK.row(), top = 62 + bh + 12, rowH = Math.max(60, bh + 16);
    const per = Math.max(1, Math.min(6, Math.floor((VH - 20 - top - 68) / rowH))), pages = Math.max(1, Math.ceil(list.length / per));
    friendsPage = clamp(friendsPage, 0, pages - 1);
    const page = list.slice(friendsPage * per, friendsPage * per + per);
    const w = narrow ? Math.min(VW - 20, 400) : 500, h = Math.min(VH - 20, top + 26 + Math.max(1, page.length) * rowH + 30 + (pages > 1 ? 40 : 0));
    const on = NET.online();
    const { px, py } = panelBox(g, w, h, 'Friends online', on ? `${ONLINE.length} knight${ONLINE.length === 1 ? '' : 's'} in the Fanglands right now` : 'Not connected right now');
    button(g, px + 18, py + 62, 96, bh, 'Chat log', () => openPanel('chatlog'), '#21262d');
    let y = py + top;
    if (!page.length) { g.fillStyle = '#8b949e'; g.font = '13px sans-serif'; g.textAlign = 'left'; g.fillText(on ? 'Nobody else is on right now.' : 'You are not connected.', px + 18, y + 14); }
    const bw1 = 62, bw2 = narrow ? 92 : 118, bx1 = px + w - 18 - bw1, bx2 = bx1 - 8 - bw2, textW = bx2 - (px + 30) - 10;
    for (const o of page) {
      const here = o.map === my, close = near(o.n), fol = following === o.n;
      roundRect(g, px + 18, y, w - 36, rowH - 8, 8); g.fillStyle = here ? 'rgba(88,166,255,0.12)' : 'rgba(255,255,255,0.05)'; g.fill();
      const mid = y + (rowH - 8) / 2;   // the middle of the row's plate: the name sits above it, where they are below
      g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.fillStyle = '#e6edf3'; g.fillText(o.n, px + 30, mid - 6);
      const nw = g.measureText(o.n).width; g.fillStyle = '#9aa3b2'; g.font = '11px sans-serif'; g.fillText('lv ' + (o.lv || 1), px + 30 + nw + 8, mid - 6);
      let where = here ? 'On your map · ' + whereOf(o) : whereOf(o); g.font = '12px sans-serif'; while (g.measureText(where).width > textW && where.length > 6) where = where.slice(0, -2) + '…';
      g.fillStyle = here ? BLUE : '#8b949e'; g.fillText(where, px + 30, mid + 14);
      button(g, bx1, mid - bh / 2, bw1, bh, 'Give', () => { giftPage = 0; openPanel('gift', o.n); }, close ? '#238636' : '#2a2f3a', close);
      button(g, bx2, mid - bh / 2, bw2, bh, fol ? (narrow ? 'Following' : 'Stop following') : (narrow ? 'Follow' : 'Follow on map'), () => { following = fol ? null : o.n; sfx('open'); }, fol ? '#6b4f2a' : here ? '#21262d' : '#2a2f3a', here);
      y += rowH;
    }
    g.fillStyle = '#6e7681'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText('Give works when you stand within two tiles of a friend. F opens this panel.', px + 18, py + h - (pages > 1 ? 50 : 14));
    if (pages > 1) pager(g, px + 18, py + h - 40, w - 36, friendsPage, pages, p => { friendsPage = p; });
  };

  // ---------- the gift picker: the pack's stacks, one tap each ----------
  HOOKS.panel.gift = (g, narrow) => {
    const to = String(panelArg || '');
    const stacks = []; for (const s of player.inv) if (s && s.qty > 0 && ITEMS[s.id]) stacks.push(s);
    // the Give buttons are one kit row tall (HK.row(): 44 px on touch); each row is that plus its margins
    const bh = HK.row(), rowH = bh + 12, per = Math.max(2, Math.min(8, Math.floor((VH - 20 - 130) / rowH))), pages = Math.max(1, Math.ceil(stacks.length / per));
    giftPage = clamp(giftPage, 0, pages - 1);
    const page = stacks.slice(giftPage * per, giftPage * per + per);
    const w = narrow ? Math.min(VW - 20, 390) : 460, h = Math.min(VH - 20, 74 + Math.max(1, page.length) * rowH + (pages > 1 ? 50 : 20));
    const ok = near(to) && NET.online();
    const { px, py } = panelBox(g, w, h, 'Give to ' + to, ok ? 'Tap what to hand over. It leaves your pack and lands in theirs.' : 'Walk up to ' + to + ' first (within two tiles).');
    let y = py + 64;
    if (!page.length) { g.fillStyle = '#8b949e'; g.font = '13px sans-serif'; g.textAlign = 'left'; g.fillText('Your pack is empty.', px + 18, y + 20); }
    for (const s of page) {
      const def = ITEMS[s.id], many = s.qty > 1;
      const mid = y + (rowH - 6) / 2;   // the middle of the row's plate
      roundRect(g, px + 18, y, w - 36, rowH - 6, 8); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill();
      drawItemIcon(g, s.id, px + 36, mid - 1, 18);
      let name = def.name + ' × ' + s.qty; g.font = 'bold 13px sans-serif'; const maxW = w - 36 - 44 - (many ? 176 : 96);
      while (g.measureText(name).width > maxW && name.length > 6) name = name.slice(0, -2) + '…';
      g.fillStyle = '#e6edf3'; g.textAlign = 'left'; g.fillText(name, px + 54, mid + 4);
      const arm = needsConfirm(def) && confirmActive('gift:' + s.id);
      const giveN = qty => { const go = () => { if (give(to, s.id, qty)) closePanel(); }; if (needsConfirm(def)) confirmTap('gift:' + s.id, go); else go(); };
      const key = (b, suffix) => { b.label = (b.disabled ? 'disabled:' : '') + 'give:' + s.id + ':' + suffix; };   // the drawn word stays; the harness finds the button by key
      if (many) { button(g, px + w - 18 - 82 - 6 - 74, mid - bh / 2, 74, bh, 'Give 1', () => giveN(1), ok ? '#238636' : '#2a2f3a', ok); key(buttons[buttons.length - 1], '1'); }
      button(g, px + w - 18 - 82, mid - bh / 2, 82, bh, arm ? 'Tap again' : many ? 'Give all' : 'Give', () => giveN(s.qty), arm ? '#c0392b' : ok ? '#238636' : '#2a2f3a', ok); key(buttons[buttons.length - 1], 'all');
      y += rowH;
    }
    if (pages > 1) pager(g, px + 18, py + h - 40, w - 36, giftPage, pages, p => { giftPage = p; });
  };

  window.PLAYERS = {
    lookOf, presence, mapId, remote: REMOTE, near, give,
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
    // put the world back
    NET.disconnect(); NET.fake = was.fake; NET.enabled = was.enabled; NET.token = was.token; NET.status = 'off'; NET.me = null;
    clearAll(); lastSig = null; pending.length = 0; lastGiftAt = -1e9;
    player.mech = mech0; player.r = r0; dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq); closePanel(); h.peace(false); render();
  });
}
